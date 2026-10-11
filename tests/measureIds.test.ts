import { describe, expect, it } from 'vitest';
import { buildMeasureIds } from '../src/score/measureIds';

const m = (id: string, n?: string) =>
  `<measure xml:id="${id}"${n ? ` n="${n}"` : ''}>`;

describe('buildMeasureIds', () => {
  it('못갖춘마디는 0, 번호 있는 마디는 원본 번호', () => {
    const ids = buildMeasureIds(m('a') + m('b', '1') + m('c', '2'));
    expect([...ids.values()]).toEqual(['0', '1', '2']);
  });

  it('번호 없는 중간 마디는 직전 ID에 .1, .2 를 붙인다', () => {
    const ids = buildMeasureIds(m('a', '173') + m('b') + m('c') + m('d', '174'));
    expect([...ids.values()]).toEqual(['173', '173.1', '173.2', '174']);
  });

  it('속성 순서가 달라도 읽는다', () => {
    const ids = buildMeasureIds('<measure right="rptend" n="96" xml:id="x">');
    expect(ids.get('x')).toBe('96');
  });
});
