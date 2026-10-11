import { describe, expect, it } from 'vitest';
import { AnchorEditor, interpolateStarts } from '../src/sync/anchors';
import { SyncEngine } from '../src/sync/SyncEngine';

describe('interpolateStarts', () => {
  it('기준점 사이를 박자 길이 비율로 나눈다', () => {
    // 1박 못갖춘마디 + 2박 마디 3개 = 7박을 0~7초에
    const starts = interpolateStarts([1, 2, 2, 2], [{ index: 0, t: 0 }, { index: 4, t: 7 }], 0.5);
    expect(starts).toEqual([0, 1, 3, 5]);
  });

  it('구간마다 빠르기가 다르면 구간별로 따로 보간한다', () => {
    const starts = interpolateStarts([2, 2, 2, 2], [{ index: 0, t: 0 }, { index: 2, t: 4 }, { index: 4, t: 6 }], 0.5);
    expect(starts).toEqual([0, 2, 4, 5]);
  });

  it('마지막 기준점 뒤는 직전 구간 빠르기로 연장한다 (end를 모를 때)', () => {
    const starts = interpolateStarts([2, 2, 2, 2], [{ index: 0, t: 10 }, { index: 1, t: 11 }], 0.5);
    expect(starts).toEqual([10, 11, 12, 13]);
  });

  it('기준점이 하나뿐이면 악보 템포로 연장한다', () => {
    expect(interpolateStarts([2, 2], [{ index: 0, t: 10 }], 0.5)).toEqual([10, 11]);
  });

  it('첫 기준점 앞은 다음 구간 빠르기로 거슬러 계산한다', () => {
    expect(interpolateStarts([1, 1, 1], [{ index: 1, t: 5 }, { index: 2, t: 6 }], 9)).toEqual([4, 5, 6]);
  });

  it('길이 0인 마디가 있어도 시각은 엄격히 증가한다', () => {
    const starts = interpolateStarts([2, 0, 2], [{ index: 0, t: 0 }, { index: 3, t: 4 }], 0.5);
    expect(() => new SyncEngine(starts.map((t, i) => ({ t, m: String(i) })))).not.toThrow();
  });
});

// K.331 3악장 앞부분 축소판: 0(1박) 1 2(2박씩) 2.1(1박, 못갖춘 조각) | 반복 | 0 1 2 2.1 3
const order = ['0', '1', '2', '2.1', '0', '1', '2', '2.1', '3'];
const dur = [1, 2, 2, 1, 1, 2, 2, 1, 2]; // 합 14박
const editor = () => new AnchorEditor(order, dur, 100, 114, 0.5);

describe('AnchorEditor', () => {
  it('악장 start·end가 자동 기준점: 기준점 없이도 전체가 채워진다', () => {
    const ev = editor().events();
    expect(ev).toHaveLength(order.length);
    expect(ev.map((e) => e.t)).toEqual([100, 101, 103, 105, 106, 107, 109, 111, 112]);
    expect(ev.some((e) => e.anchor)).toBe(false);
  });

  it('못갖춘 조각(2.1)도 박자 길이대로 자동 계산된다', () => {
    const e = editor();
    e.add('3', 116); // 마지막 마디가 늦게 시작 → 앞부분이 늘어난다
    const ev = e.events();
    const i = order.indexOf('2.1', 4);
    // 0~12박이 100~116초 → 1박 = 4/3초
    expect(ev[i].t).toBeCloseTo(100 + 11 * (16 / 12));
  });

  it('저장 형식은 모든 마디 + 사용자 기준점에만 anchor: true', () => {
    const e = editor();
    e.add('1', 101.5);
    const ev = e.events();
    expect(ev.filter((x) => x.anchor).map((x) => x.m)).toEqual(['1']);
    expect(ev.map((x) => x.m)).toEqual(order);
  });

  it('반복으로 두 번 나오는 마디는 탭 시각에 가까운 회차에 기준점을 둔다', () => {
    const e = editor();
    expect(e.add('1', 101.2)).toBe(1);
    expect(e.add('1', 107.3)).toBe(5);
  });

  it('어긋난 마디를 기준점으로 추가하면 그 주변만 다시 보간된다', () => {
    const e = editor();
    e.add('2', 103); // 보간값과 같음
    e.add('3', 113); // 실제로는 1초 늦음
    const ev = e.events();
    expect(ev[2].t).toBe(103); // 기준점 앞은 그대로
    expect(ev[8]).toEqual({ t: 113, m: '3', anchor: true });
    expect(ev[7].t).toBeGreaterThan(111); // 2.1(두 번째)은 늘어난 구간에 맞춰 뒤로
  });

  it('순서가 꼬이는 기존 기준점은 지우고, 되돌리기로 함께 복원한다', () => {
    const e = editor();
    e.set(5, 107);
    e.set(2, 108); // index 2가 index 5보다 늦을 수 없다 → 5를 지움
    expect(e.userAnchors).toEqual([{ index: 2, t: 108 }]);
    e.undo();
    expect(e.userAnchors).toEqual([{ index: 5, t: 107 }]);
  });

  it('같은 위치를 다시 치면 덮어쓰고, 되돌리면 이전 값으로', () => {
    const e = editor();
    e.set(3, 105);
    e.set(3, 105.4);
    expect(e.userAnchors).toEqual([{ index: 3, t: 105.4 }]);
    e.undo();
    expect(e.userAnchors).toEqual([{ index: 3, t: 105 }]);
  });

  it('사용자 기준점이 자동 start보다 앞이면 사용자 쪽을 쓴다', () => {
    const e = editor();
    e.set(0, 98);
    expect(e.anchors()[0]).toEqual({ index: 0, t: 98 });
    e.set(1, 99); // start(100)보다 이른 1마디 → 자동 start 무시
    expect(e.anchors().map((a) => a.index)).toEqual([0, 1, order.length]);
  });

  it('end가 null이면 끝 기준점 없이 마지막 구간 빠르기로 연장한다', () => {
    const e = new AnchorEditor(order, dur, 100, null, 0.5);
    e.set(1, 102); // 0번 마디(1박)가 2초 → 1박 = 2초
    expect(e.events()[2].t).toBe(106);
  });

  it('저장한 맵에서 기준점을 되살린다 (연주 순서가 다르면 거부)', () => {
    const e = editor();
    e.add('2', 103.3);
    const saved = e.events();
    const e2 = editor();
    expect(e2.importEvents(saved)).toBe(true);
    expect(e2.userAnchors).toEqual([{ index: 2, t: 103.3 }]);
    expect(editor().importEvents(saved.slice(1))).toBe(false);
  });

  it('보간 결과는 SyncEngine에 그대로 넣을 수 있다', () => {
    const e = editor();
    e.add('1', 101.5);
    e.add('3', 112.5);
    const sync = new SyncEngine(e.events(), 114);
    expect(sync.locate(112.6)?.measureId).toBe('3');
  });
});
