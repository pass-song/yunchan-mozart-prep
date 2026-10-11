import type { AudioSpec } from '../data';

/** 파일·YouTube 공통 재생 인터페이스. 악보·싱크 코드는 이것만 본다. */
export interface AudioSource {
  /** 구간 시작 위치로 준비한다. autoplay면 바로 재생 */
  load(spec: AudioSpec, autoplay: boolean): void;
  play(): void;
  pause(): void;
  seek(seconds: number): void;
  /** 현재 재생 위치(초, 영상 기준) */
  getCurrentTime(): number;
  /** 재생 중이거나 버퍼링 중 */
  isPlaying(): boolean;
  setPlaybackRate(rate: number): void;
  onEnded(cb: () => void): void;
  onStateChange(cb: (playing: boolean) => void): void;
}
