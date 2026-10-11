import type { AudioSource } from './AudioSource';
import type { MovementEntry } from '../data';

/** 영상을 새로 불러온 직후, 시각이 요청한 start에서 이만큼(초) 안에 들어와야 구간 판정을 다시 시작한다 */
const ARRIVAL_TOLERANCE = 2;

/**
 * 악장 구간(start~end)만 재생한다.
 * 매 프레임 영상 시각이 같은 영상의 어느 악장 구간에 있는지 보고 현재 악장을 맞춘다.
 * (같은 영상 안에서 다음 악장으로 넘어가거나, 사용자가 YouTube 화면에서 시간을 옮긴 경우)
 * 구간을 벗어났는데 같은 영상에 맞는 악장이 없으면 다음 악장(다른 영상)으로 넘어간다.
 */
export class MovementPlayer {
  private current = 0;
  /** select()로 요청한 시작 시각. 영상이 거기 도착하기 전의 시각은 이전 영상 값일 수 있어 판정하지 않는다 */
  private pendingStart: number | null = null;
  private changeCbs: ((entry: MovementEntry, index: number) => void)[] = [];

  constructor(
    private readonly source: AudioSource,
    private readonly entries: MovementEntry[],
  ) {
    source.onEnded(() => this.next());
  }

  get index(): number { return this.current; }
  get entry(): MovementEntry { return this.entries[this.current]; }

  onMovementChange(cb: (entry: MovementEntry, index: number) => void): void {
    this.changeCbs.push(cb);
  }

  /** 악장을 골라 그 구간 처음으로 간다 */
  select(index: number, autoplay = this.source.isPlaying()): void {
    const { audio } = this.entries[index].movement;
    this.pendingStart = audio.start;
    this.source.load(audio, autoplay);
    this.setCurrent(index);
  }

  /** 다음 악장. 마지막 악장이면 멈춘다. */
  next(): void {
    if (this.current + 1 < this.entries.length) this.select(this.current + 1, true);
    else this.source.pause();
  }

  /** 재생/멈춤. 구간 밖에 있으면 구간 처음부터 재생 */
  toggle(): void {
    if (this.source.isPlaying()) return this.source.pause();
    if (!contains(this.entry, this.source.getCurrentTime())) {
      this.pendingStart = this.entry.movement.audio.start;
      this.source.seek(this.pendingStart);
    }
    this.source.play();
  }

  /** 매 프레임 호출. t = 현재 영상 시각 */
  tick(t: number): void {
    if (this.pendingStart !== null) {
      if (Math.abs(t - this.pendingStart) > ARRIVAL_TOLERANCE) return;
      this.pendingStart = null;
    }

    const match = this.movementAt(t);
    if (match >= 0) {
      if (match !== this.current) this.setCurrent(match);
      return;
    }
    const { end } = this.entry.movement.audio;
    if (end !== null && t >= end && this.source.isPlaying()) this.next();
  }

  /** 현재 영상에서 t를 구간에 품은 악장. 없으면 -1 */
  private movementAt(t: number): number {
    const videoId = this.entry.movement.audio.videoId;
    return this.entries.findIndex((e) => e.movement.audio.videoId === videoId && contains(e, t));
  }

  /** 오디오는 건드리지 않고 현재 악장만 바꾼다 */
  private setCurrent(index: number): void {
    this.current = index;
    this.changeCbs.forEach((cb) => cb(this.entry, index));
  }
}

function contains({ movement: { audio } }: MovementEntry, t: number): boolean {
  return t >= audio.start && (audio.end === null || t < audio.end);
}
