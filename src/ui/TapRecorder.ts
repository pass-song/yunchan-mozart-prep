import type { TimingEvent } from '../data';

/**
 * 탭 모드의 기록 상태. 연주 순서(order)를 따라가며 탭할 때마다 다음 마디에 시각을 붙인다.
 * 같은 마디 ID가 order에 여러 번 나오면(반복·다 카포) 기록에도 여러 번 들어간다.
 */
export class TapRecorder {
  readonly events: TimingEvent[] = [];
  /** 각 탭 직전의 pos (되돌리기용) */
  private readonly positions: number[] = [];
  pos = 0;

  constructor(public order: string[]) {}

  /** 다음에 탭할 마디. 끝까지 갔으면 undefined */
  get next(): string | undefined {
    return this.order[this.pos];
  }

  get last(): TimingEvent | undefined {
    return this.events.at(-1);
  }

  /**
   * t 시각을 다음 마디의 시작으로 기록한다.
   * 마지막 기록보다 이른 시각이면(되감아서 다시 탭) 그 이후 기록을 지우고 이어서 기록한다.
   */
  tap(t: number): TimingEvent | null {
    while (this.last && this.last.t >= t) this.undo();
    const m = this.next;
    if (m === undefined) return null;
    const ev = { t, m };
    this.events.push(ev);
    this.positions.push(this.pos);
    this.pos++;
    return ev;
  }

  undo(): void {
    if (this.events.length === 0) return;
    this.events.pop();
    this.pos = this.positions.pop()!;
  }

  /** 다음에 탭할 마디를 바꾼다(연주자가 반복을 생략했을 때 등). 지금 위치 이후의 같은 마디를 먼저 찾는다. */
  jumpTo(measureId: string): boolean {
    let i = this.order.indexOf(measureId, this.pos);
    if (i < 0) i = this.order.indexOf(measureId);
    if (i < 0) return false;
    this.pos = i;
    return true;
  }

  clear(): void {
    this.events.length = 0;
    this.positions.length = 0;
    this.pos = 0;
  }

  /** 저장된 상태로 되살린다 */
  restore(events: TimingEvent[], positions: number[], pos: number): void {
    this.clear();
    this.events.push(...events);
    this.positions.push(...positions);
    this.pos = pos;
  }

  snapshot(): { events: TimingEvent[]; positions: number[]; pos: number } {
    return { events: [...this.events], positions: [...this.positions], pos: this.pos };
  }
}
