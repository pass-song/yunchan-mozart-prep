import type { TimingEvent } from '../data';

export interface SyncPosition {
  /** events 배열 안의 위치 (같은 마디가 반복돼도 구별된다) */
  index: number;
  measureId: string;
  /** 마디 안 진행률 0~1 */
  progress: number;
}

/**
 * 오디오 시각 → 현재 마디 (설계서 5절).
 * events는 연주된 순서대로의 마디 목록이며 t가 단조 증가해야 한다.
 */
export class SyncEngine {
  constructor(
    private readonly events: TimingEvent[],
    /** 마지막 마디의 끝 시각(초). 없으면 마지막 마디 진행률은 0 */
    private readonly endTime: number | null = null,
  ) {
    for (let i = 1; i < events.length; i++) {
      if (!(events[i].t > events[i - 1].t)) {
        throw new Error(`타이밍 맵 시각이 증가하지 않음: events[${i}] t=${events[i].t}`);
      }
    }
  }

  /** now 시각의 위치. 첫 마디 이전이면 null */
  locate(now: number): SyncPosition | null {
    const ev = this.events;
    // t_i ≤ now 인 가장 큰 i (이진 탐색)
    let lo = 0;
    let hi = ev.length - 1;
    let i = -1;
    while (lo <= hi) {
      const mid = (lo + hi) >> 1;
      if (ev[mid].t <= now) {
        i = mid;
        lo = mid + 1;
      } else {
        hi = mid - 1;
      }
    }
    if (i < 0) return null;

    const nextT = i + 1 < ev.length ? ev[i + 1].t : this.endTime;
    const progress = nextT !== null && nextT > ev[i].t ? (now - ev[i].t) / (nextT - ev[i].t) : 0;
    return { index: i, measureId: ev[i].m, progress: Math.min(1, Math.max(0, progress)) };
  }
}
