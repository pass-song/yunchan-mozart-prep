/**
 * YouTube getCurrentTime()은 몇백 ms 간격으로만 갱신된다.
 * 값이 마지막으로 바뀐 순간을 기준점으로 잡고 performance.now() 경과 시간으로 보간한다.
 */
export class TimeInterpolator {
  /** 보고값보다 이만큼(초) 넘게 앞서가지 않는다. 버퍼링이 이벤트로 늦게 잡히는 경우 대비 */
  static readonly MAX_LEAD = 1;

  private lastReported = NaN;
  private anchorTime = 0;
  private anchorClock = 0;

  constructor(private readonly clock: () => number = () => performance.now()) {}

  /**
   * @param reported 플레이어가 돌려준 현재 시각(초)
   * @param running 실제로 소리가 나는 중인지 (버퍼링·멈춤이면 false)
   * @param rate 재생 속도
   */
  estimate(reported: number, running: boolean, rate: number): number {
    const now = this.clock();
    if (reported !== this.lastReported || !running) {
      this.lastReported = reported;
      this.anchorTime = reported;
      this.anchorClock = now;
    }
    if (!running) return reported;
    const est = this.anchorTime + ((now - this.anchorClock) / 1000) * rate;
    return Math.min(est, reported + TimeInterpolator.MAX_LEAD);
  }
}
