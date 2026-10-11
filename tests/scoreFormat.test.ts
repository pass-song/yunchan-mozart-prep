import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { buildMeasureIds } from '../src/score/measureIds';
import { formatOf, loadScore, type ScoreSource } from '../src/score/scoreFormat';

let mod: unknown;
beforeAll(async () => {
  mod = await createVerovioModule();
}, 60_000);

function read(path: string): ScoreSource {
  const format = formatOf(path)!;
  if (format === 'mxl') {
    const buf = fs.readFileSync(path);
    return { format, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer };
  }
  return { format, data: fs.readFileSync(path, 'utf8') };
}

function measures(path: string): string[] {
  const tk = new VerovioToolkit(mod);
  expect(loadScore(tk, read(path))).toBe(true);
  expect(tk.renderToSVG(1)).toContain('class="measure');
  return [...buildMeasureIds(tk.getMEI()).values()];
}

describe('formatOf', () => {
  it('확장자로 형식을 정한다', () => {
    expect(formatOf('scores/a/sonata11-3.krn')).toBe('humdrum');
    expect(formatOf('x.musicxml')).toBe('musicxml');
    expect(formatOf('x.XML')).toBe('musicxml');
    expect(formatOf('x.mxl')).toBe('mxl');
    expect(formatOf('x.mei')).toBe('mei');
    expect(formatOf('x.pdf')).toBeNull();
  });
});

describe('loadScore: 형식별로 읽어 그리고 마디 ID를 얻는다', () => {
  it('MusicXML (못갖춘마디 → "0")', () => {
    expect(measures('tests/fixtures/tiny.musicxml')).toEqual(['0', '1', '2', '3']);
  });

  it('압축 MusicXML (.mxl)', () => {
    expect(measures('tests/fixtures/tiny.mxl')).toEqual(['0', '1', '2', '3']);
  });

  it('MEI', () => {
    expect(measures('tests/fixtures/tiny.mei')).toEqual(['1', '2', '3']);
  });

  it('Humdrum', () => {
    expect(measures('data/scores/craigsapp-mozart/sonata11-3.krn')).toHaveLength(137);
  });
});
