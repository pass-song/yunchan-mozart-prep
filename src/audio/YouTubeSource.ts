import type { AudioSource } from './AudioSource';
import type { AudioSpec } from '../data';
import { TimeInterpolator } from './TimeInterpolator';

let apiReady: Promise<void> | null = null;

/** YouTube IFrame Player API 스크립트를 한 번만 불러온다. */
function loadApi(): Promise<void> {
  apiReady ??= new Promise((resolve) => {
    window.onYouTubeIframeAPIReady = () => resolve();
    const s = document.createElement('script');
    s.src = 'https://www.youtube.com/iframe_api';
    document.head.append(s);
  });
  return apiReady;
}

export class YouTubeSource implements AudioSource {
  private endedCbs: (() => void)[] = [];
  private stateCbs: ((playing: boolean) => void)[] = [];
  private errorCbs: ((code: number) => void)[] = [];
  private state = -1;
  private rate = 1;
  private videoId = '';
  private readonly interp = new TimeInterpolator();

  private constructor(private readonly player: YT.Player) {}

  /** elementId 자리에 플레이어를 만든다. 준비되면 resolve. */
  static async create(elementId: string): Promise<YouTubeSource> {
    await loadApi();
    return new Promise((resolve) => {
      let source: YouTubeSource;
      const player = new YT.Player(elementId, {
        width: 320,
        height: 200,
        playerVars: { playsinline: 1, rel: 0 },
        events: {
          onReady: () => resolve(source),
          onError: (e) => source.errorCbs.forEach((cb) => cb(e.data)),
          onStateChange: (e) => {
            source.state = e.data;
            // 새 영상을 불러오면 YouTube가 속도를 1로 되돌리므로 다시 맞춘다
            if (e.data === YT.PlayerState.PLAYING && player.getPlaybackRate() !== source.rate) {
              player.setPlaybackRate(source.rate);
            }
            if (e.data === YT.PlayerState.ENDED) source.endedCbs.forEach((cb) => cb());
            source.stateCbs.forEach((cb) => cb(source.isPlaying()));
          },
        },
      });
      source = new YouTubeSource(player);
    });
  }

  load(spec: AudioSpec, autoplay: boolean): void {
    const args = { videoId: spec.videoId, startSeconds: spec.start };
    if (autoplay && spec.videoId === this.videoId) this.player.seekTo(spec.start, true);
    else if (autoplay) this.player.loadVideoById(args);
    else this.player.cueVideoById(args);
    this.videoId = spec.videoId;
  }

  play(): void { this.player.playVideo(); }
  pause(): void { this.player.pauseVideo(); }
  seek(seconds: number): void { this.player.seekTo(seconds, true); }

  getCurrentTime(): number {
    const running = this.state === YT.PlayerState.PLAYING;
    return this.interp.estimate(this.player.getCurrentTime(), running, this.rate);
  }

  isPlaying(): boolean {
    return this.state === YT.PlayerState.PLAYING || this.state === YT.PlayerState.BUFFERING;
  }

  setPlaybackRate(rate: number): void {
    this.rate = rate;
    this.player.setPlaybackRate(rate);
  }

  onEnded(cb: () => void): void { this.endedCbs.push(cb); }
  onStateChange(cb: (playing: boolean) => void): void { this.stateCbs.push(cb); }
  /** 101·150 = 퍼가기 금지, 100 = 영상 없음 */
  onError(cb: (code: number) => void): void { this.errorCbs.push(cb); }
}
