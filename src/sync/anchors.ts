import type { TimingEvent } from '../data';

/** 기준점: 연주 순서 위치(index)의 마디가 t초에 시작한다. index = order.length 는 마지막 마디의 끝 */
export interface Anchor {
  index: number;
  t: number;
}

/** 0 길이 마디가 있어도 시각이 엄격히 증가하도록 */
const MIN_DURATION = 0.01;

/**
 * 연주 순서 각 마디의 시작 시각을 기준점 사이 박자 길이 비율로 보간한다.
 * @param durations 연주 순서대로의 마디 길이(4분음표 단위)
 * @param anchors index 오름차순, 시각도 오름차순
 * @param fallbackSecPerQuarter 기준점이 하나뿐일 때 쓰는 빠르기 (악보 템포)
 */
export function interpolateStarts(durations: number[], anchors: Anchor[], fallbackSecPerQuarter: number): number[] {
  if (anchors.length === 0) return [];
  const q = [0];
  for (const d of durations) q.push(q[q.length - 1] + Math.max(d, MIN_DURATION));

  const rate = (a: Anchor, b: Anchor) =>
    q[b.index] > q[a.index] ? (b.t - a.t) / (q[b.index] - q[a.index]) : fallbackSecPerQuarter;
  const first = anchors[0];
  const last = anchors[anchors.length - 1];
  const headRate = anchors.length > 1 ? rate(first, anchors[1]) : fallbackSecPerQuarter;
  const tailRate = anchors.length > 1 ? rate(anchors[anchors.length - 2], last) : fallbackSecPerQuarter;

  const starts: number[] = [];
  let k = 0; // anchors[k].index ≤ i < anchors[k+1].index
  for (let i = 0; i < durations.length; i++) {
    while (k + 1 < anchors.length && anchors[k + 1].index <= i) k++;
    let t: number;
    if (i < first.index) t = first.t - (q[first.index] - q[i]) * headRate;
    else if (k + 1 < anchors.length) t = anchors[k].t + (q[i] - q[anchors[k].index]) * rate(anchors[k], anchors[k + 1]);
    else t = last.t + (q[i] - q[last.index]) * tailRate;
    starts.push(t);
  }
  return starts;
}

interface HistoryEntry {
  index: number;
  prev: number | undefined;
  removed: Anchor[];
}

/**
 * 탭 모드 "기준점" 편집 상태.
 * 사용자가 고른 마디에서만 탭하고, 나머지 마디는 interpolateStarts로 채운다.
 * 악장 start는 첫 마디의 시작, end는 마지막 마디의 끝으로 자동 기준점이 된다(사용자 기준점이 우선).
 */
export class AnchorEditor {
  private readonly user = new Map<number, number>();
  private readonly history: HistoryEntry[] = [];

  constructor(
    readonly order: string[],
    private readonly durations: number[],
    private readonly start: number,
    private readonly end: number | null,
    private readonly fallbackSecPerQuarter: number,
  ) {}

  get userAnchors(): Anchor[] {
    return [...this.user].map(([index, t]) => ({ index, t })).sort((a, b) => a.index - b.index);
  }

  get lastAdded(): Anchor | undefined {
    const h = this.history.at(-1);
    return h && { index: h.index, t: this.user.get(h.index)! };
  }

  /** 사용자 기준점 + 그와 충돌하지 않는 자동 기준점(start, end) */
  anchors(): Anchor[] {
    const user = this.userAnchors;
    const all = [...user];
    const n = this.order.length;
    if (!this.user.has(0) && (user.length === 0 || this.start < user[0].t)) all.unshift({ index: 0, t: this.start });
    if (this.end !== null && !this.user.has(n) && (user.length === 0 || this.end > user[user.length - 1].t)) {
      all.push({ index: n, t: this.end });
    }
    return all;
  }

  starts(): number[] {
    return interpolateStarts(this.durations, this.anchors(), this.fallbackSecPerQuarter);
  }

  /** 저장 형식: 모든 마디를 채운 타이밍 맵 events. 사용자 기준점에만 anchor: true */
  events(): TimingEvent[] {
    return this.starts().map((t, i) => (this.user.has(i) ? { t, m: this.order[i], anchor: true } : { t, m: this.order[i] }));
  }

  /**
   * measureId 마디가 t초에 시작한다고 기준점을 추가한다.
   * 반복으로 그 마디가 여러 번 나오면, 지금 보간값이 t에 가장 가까운 회차를 고른다.
   * @returns 기준점을 둔 연주 순서 위치. 악보에 없는 마디면 -1
   */
  add(measureId: string, t: number): number {
    const starts = this.starts();
    let best = -1;
    this.order.forEach((m, i) => {
      if (m === measureId && (best < 0 || Math.abs(starts[i] - t) < Math.abs(starts[best] - t))) best = i;
    });
    if (best >= 0) this.set(best, t);
    return best;
  }

  /** index에 기준점을 둔다. 순서가 꼬이는 기존 기준점은 지운다(새로 친 쪽을 믿는다) */
  set(index: number, t: number): void {
    const removed = this.userAnchors.filter((a) => a.index !== index && (a.index < index ? a.t >= t : a.t <= t));
    removed.forEach((a) => this.user.delete(a.index));
    this.history.push({ index, prev: this.user.get(index), removed });
    this.user.set(index, t);
  }

  undo(): void {
    const h = this.history.pop();
    if (!h) return;
    if (h.prev === undefined) this.user.delete(h.index);
    else this.user.set(h.index, h.prev);
    h.removed.forEach((a) => this.user.set(a.index, a.t));
  }

  clear(): void {
    this.user.clear();
    this.history.length = 0;
  }

  restore(anchors: Anchor[]): void {
    this.clear();
    anchors.forEach((a) => this.user.set(a.index, a.t));
  }

  /** 기준점 모드로 저장한 타이밍 맵에서 기준점을 되살린다. 연주 순서가 다르면 false */
  importEvents(events: TimingEvent[]): boolean {
    if (events.length !== this.order.length || events.some((e, i) => e.m !== this.order[i])) return false;
    this.restore(events.flatMap((e, i) => (e.anchor ? [{ index: i, t: e.t }] : [])));
    return true;
  }
}
