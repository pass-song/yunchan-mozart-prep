import { describe, expect, it } from 'vitest';
import { TimeInterpolator } from '../src/audio/TimeInterpolator';

function setup() {
  let now = 0;
  const interp = new TimeInterpolator(() => now);
  return { interp, advance: (ms: number) => (now += ms) };
}

describe('TimeInterpolator', () => {
  it('보고값이 그대로인 동안 경과 시간만큼 앞으로 보간한다', () => {
    const { interp, advance } = setup();
    expect(interp.estimate(10, true, 1)).toBe(10);
    advance(100);
    expect(interp.estimate(10, true, 1)).toBeCloseTo(10.1);
    advance(150);
    expect(interp.estimate(10, true, 1)).toBeCloseTo(10.25);
  });

  it('보고값이 바뀌면 그 값을 새 기준점으로 삼는다', () => {
    const { interp, advance } = setup();
    interp.estimate(10, true, 1);
    advance(250);
    expect(interp.estimate(10.24, true, 1)).toBeCloseTo(10.24);
    advance(50);
    expect(interp.estimate(10.24, true, 1)).toBeCloseTo(10.29);
  });

  it('재생 속도를 반영한다', () => {
    const { interp, advance } = setup();
    interp.estimate(10, true, 0.5);
    advance(200);
    expect(interp.estimate(10, true, 0.5)).toBeCloseTo(10.1);
  });

  it('멈춤·버퍼링 중에는 보고값 그대로', () => {
    const { interp, advance } = setup();
    interp.estimate(10, true, 1);
    advance(500);
    expect(interp.estimate(10, false, 1)).toBe(10);
  });

  it('보고값이 오래 멈춰 있어도 MAX_LEAD 이상 앞서가지 않는다', () => {
    const { interp, advance } = setup();
    interp.estimate(10, true, 1);
    advance(5000);
    expect(interp.estimate(10, true, 1)).toBe(10 + TimeInterpolator.MAX_LEAD);
  });
});
