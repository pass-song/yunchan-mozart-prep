import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { buildMeasureIds } from '../src/score/measureIds';
import { buildPerformOrders, type PerformOrders } from '../src/score/performOrder';

let mod: unknown;
beforeAll(async () => {
  mod = await createVerovioModule();
}, 60_000);

function orders(file: string): PerformOrders {
  const tk = new VerovioToolkit(mod);
  tk.setOptions({ inputFrom: 'humdrum' });
  tk.loadData(fs.readFileSync(`data/scores/${file}`, 'utf8'));
  const mei = tk.getMEI();
  return buildPerformOrders(mei, buildMeasureIds(mei));
}

const range = (a: number, b: number) => Array.from({ length: b - a + 1 }, (_, i) => String(a + i));

describe('buildPerformOrders', () => {
  it('K.331 3악장: 각 부분 반복, 1·2번 괄호(96 → 97)', () => {
    const o = orders('sonata11-3.krn');
    const A = ['0', ...range(1, 8)];
    expect(o.repeat.slice(0, 19)).toEqual([...A, ...A, '8.1']);
    const i96 = o.repeat.indexOf('96');
    expect(o.repeat.slice(i96, i96 + 2)).toEqual(['96', '88.1']);
    expect(o.repeat.slice(o.repeat.indexOf('97') - 1, o.repeat.indexOf('97') + 2)).toEqual(['95', '97', '98']);
    expect(o.repeat.at(-1)).toBe('128');
  });

  it('K.331 3악장 반복 생략: 1번 괄호(96)를 건너뛴다', () => {
    const o = orders('sonata11-3.krn');
    expect(o.norep).not.toContain('96');
    expect(new Set(o.norep).size).toBe(o.norep.length);
  });

  it('K.331 2악장: 트리오 뒤 다 카포로 미뉴에트(1~48)가 다시 나온다', () => {
    const o = orders('sonata11-2.krn');
    expect(o.repeat.slice(-48)).toEqual(range(1, 48));
    expect(o.norep.slice(-48)).toEqual(range(1, 48));
  });

  it('악보 순서는 모든 마디를 한 번씩', () => {
    expect(orders('sonata11-3.krn').score).toHaveLength(137);
  });
});
