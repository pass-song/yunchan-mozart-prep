import { describe, expect, it } from 'vitest';
import { TapRecorder } from '../src/ui/TapRecorder';

// 0 1 2 | 반복 | 0 1 2 | 3
const order = ['0', '1', '2', '0', '1', '2', '3'];

describe('TapRecorder', () => {
  it('탭할 때마다 연주 순서의 다음 마디에 시각을 붙인다 (반복 마디도 다시 나온다)', () => {
    const r = new TapRecorder(order);
    [1, 2, 3, 4, 5].forEach((t) => r.tap(t));
    expect(r.events.map((e) => e.m)).toEqual(['0', '1', '2', '0', '1']);
    expect(r.next).toBe('2');
  });

  it('되돌리기는 마지막 탭을 지우고 다음 마디도 되돌린다', () => {
    const r = new TapRecorder(order);
    r.tap(1);
    r.tap(2);
    r.undo();
    expect(r.events).toEqual([{ t: 1, m: '0' }]);
    expect(r.next).toBe('1');
  });

  it('마디를 골라 건너뛰면(반복 생략) 그 마디부터 이어서 기록하고, 되돌리면 원래 위치로', () => {
    const r = new TapRecorder(order);
    [1, 2, 3].forEach((t) => r.tap(t)); // 0 1 2
    expect(r.jumpTo('3')).toBe(true);
    r.tap(4);
    expect(r.events.at(-1)).toEqual({ t: 4, m: '3' });
    r.undo();
    expect(r.next).toBe('3');
  });

  it('건너뛸 마디는 지금 위치 뒤쪽을 먼저 찾는다', () => {
    const r = new TapRecorder(order);
    [1, 2, 3, 4].forEach((t) => r.tap(t)); // 0 1 2 0
    r.jumpTo('2');
    expect(r.pos).toBe(5);
  });

  it('없는 마디로는 건너뛰지 않는다', () => {
    expect(new TapRecorder(order).jumpTo('99')).toBe(false);
  });

  it('되감아서 이전 시각에 탭하면 그 뒤 기록을 지우고 다시 기록한다', () => {
    const r = new TapRecorder(order);
    [1, 2, 3, 4].forEach((t) => r.tap(t));
    r.tap(2.5);
    expect(r.events).toEqual([
      { t: 1, m: '0' },
      { t: 2, m: '1' },
      { t: 2.5, m: '2' },
    ]);
  });

  it('순서 끝을 넘으면 기록하지 않는다', () => {
    const r = new TapRecorder(['1']);
    r.tap(1);
    expect(r.tap(2)).toBeNull();
    expect(r.events).toHaveLength(1);
  });

  it('snapshot / restore 로 상태를 되살린다', () => {
    const r = new TapRecorder(order);
    [1, 2].forEach((t) => r.tap(t));
    const s = r.snapshot();
    const r2 = new TapRecorder(order);
    r2.restore(s.events, s.positions, s.pos);
    r2.undo();
    expect(r2.events).toEqual([{ t: 1, m: '0' }]);
    expect(r2.next).toBe('1');
  });
});
