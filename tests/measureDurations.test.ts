import { expect, it } from 'vitest';
import fs from 'node:fs';
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { buildMeasureIds } from '../src/score/measureIds';
import { buildPerformOrders } from '../src/score/performOrder';
import { measureDurations } from '../src/score/ScoreView';
import { AnchorEditor } from '../src/sync/anchors';

it('K.331 3악장: 마디 길이(4분음표)와 못갖춘 조각, 기준점 보간까지', async () => {
  const tk = new VerovioToolkit(await createVerovioModule());
  tk.setOptions({ inputFrom: 'humdrum' });
  tk.loadData(fs.readFileSync('data/scores/craigsapp-mozart/sonata11-3.krn', 'utf8'));
  const ids = buildMeasureIds(tk.getMEI());
  const dur = measureDurations(tk.renderToTimemap({ includeMeasures: true }), ids);

  expect(dur.get('0')).toBe(1); // 못갖춘마디 1박
  expect(dur.get('1')).toBe(2); // 2/4
  expect(dur.get('8')).toBe(1); // 반복 기호 앞 조각
  expect(dur.get('8.1')).toBe(1); // 반복 기호 뒤 못갖춘 조각
  expect(dur.size).toBe(137);

  // 기준점 두 개(0마디, 9마디)만 주면 사이의 1~8, 반복, 8.1이 박자대로 채워진다
  const order = buildPerformOrders(tk.getMEI(), ids).repeat;
  const editor = new AnchorEditor(order, order.map((id) => dur.get(id)!), 740, null, 0.5);
  editor.set(0, 740);
  editor.set(order.indexOf('9'), 740 + 33 * 0.25); // 0~8 두 번(16박 × 2) + 8.1(1박) = 33박
  const ev = editor.events();
  const i81 = order.indexOf('8.1');
  expect(ev[i81].t).toBeCloseTo(740 + 32 * 0.25);
  expect(ev[order.indexOf('1', 2)].t).toBeCloseTo(740 + 17 * 0.25); // 반복 후 두 번째 1마디
}, 60_000);
