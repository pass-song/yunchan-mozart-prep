import { describe, expect, it } from 'vitest';
import { SyncEngine } from '../src/sync/SyncEngine';

// K.331 3악장처럼 못갖춘마디로 시작하고, 1~2마디를 반복하는 맵
const events = [
  { t: 740.4, m: '0' },
  { t: 741.0, m: '1' },
  { t: 742.0, m: '2' },
  { t: 743.0, m: '1' },
  { t: 744.0, m: '2' },
];

describe('SyncEngine', () => {
  const engine = new SyncEngine(events, 746);

  it('첫 마디 이전이면 null', () => {
    expect(engine.locate(740.0)).toBeNull();
  });

  it('t_i ≤ now < t_(i+1) 인 마디를 찾는다 (경계 포함)', () => {
    expect(engine.locate(740.4)?.measureId).toBe('0');
    expect(engine.locate(740.99)?.measureId).toBe('0');
    expect(engine.locate(741.0)?.measureId).toBe('1');
  });

  it('반복으로 같은 마디가 다시 나오면 index로 구별한다', () => {
    expect(engine.locate(741.5)).toMatchObject({ index: 1, measureId: '1' });
    expect(engine.locate(743.5)).toMatchObject({ index: 3, measureId: '1' });
  });

  it('마디 안 진행률 = (now − t_i) / (t_(i+1) − t_i)', () => {
    expect(engine.locate(742.25)?.progress).toBeCloseTo(0.25);
  });

  it('마지막 마디는 endTime까지를 마디 길이로 본다', () => {
    expect(engine.locate(745.0)).toMatchObject({ index: 4, measureId: '2' });
    expect(engine.locate(745.0)?.progress).toBeCloseTo(0.5);
    expect(engine.locate(800)?.progress).toBe(1);
  });

  it('endTime이 없으면 마지막 마디 진행률은 0', () => {
    expect(new SyncEngine(events).locate(745)?.progress).toBe(0);
  });

  it('시각이 증가하지 않는 맵은 거부한다', () => {
    expect(() => new SyncEngine([{ t: 1, m: '1' }, { t: 1, m: '2' }])).toThrow();
  });

  it('빈 맵은 항상 null', () => {
    expect(new SyncEngine([]).locate(10)).toBeNull();
  });
});
