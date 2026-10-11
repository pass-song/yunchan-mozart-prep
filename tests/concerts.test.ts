import { beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { buildMeasureIds } from '../src/score/measureIds';
import { formatOf, loadScore, type ScoreSource } from '../src/score/scoreFormat';
import { flattenMovements, piecesPath, scorePaths, type ConcertIndex, type PiecesFile } from '../src/data';

// 새 곡·공연을 추가하면 이 테스트가 데이터와 악보를 검사한다 (/add-piece 절차의 "테스트" 단계)

const DATA = 'data';
const index = JSON.parse(fs.readFileSync(`${DATA}/concerts/index.json`, 'utf8')) as ConcertIndex;
const concerts = index.concerts.map((id) => ({
  id,
  file: JSON.parse(fs.readFileSync(`${DATA}/${piecesPath(id)}`, 'utf8')) as PiecesFile,
}));

describe('concerts/index.json', () => {
  it('공연이 하나 이상, ID 중복 없음, 폴더 이름과 같음', () => {
    expect(index.concerts.length).toBeGreaterThan(0);
    expect(new Set(index.concerts).size).toBe(index.concerts.length);
    for (const id of index.concerts) expect(fs.existsSync(`${DATA}/concerts/${id}/pieces.json`)).toBe(true);
  });
});

describe.each(concerts)('공연 $id', ({ file }) => {
  const entries = flattenMovements(file);

  it('공연 정보와 곡이 있다', () => {
    for (const key of ['title', 'performer', 'date', 'venue'] as const) expect(file.concert[key]).toBeTruthy();
    expect(file.concert.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(entries.length).toBeGreaterThan(0);
  });

  it('곡·악장 ID가 공연 안에서 겹치지 않는다', () => {
    const pieceIds = file.pieces.map((p) => p.id);
    expect(new Set(pieceIds).size).toBe(pieceIds.length);
    const ids = entries.map((e) => e.movement.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('악장 index는 곡마다 1부터 차례로', () => {
    for (const p of file.pieces) expect(p.movements.map((m) => m.index)).toEqual(p.movements.map((_, i) => i + 1));
  });

  it('녹음 ID가 recordings에 있다', () => {
    for (const { movement } of entries) expect(file.recordings, movement.id).toHaveProperty(movement.recordingId);
  });

  it('영상 구간: videoId가 있고 start < end, 같은 영상 안에서 구간이 겹치지 않는다', () => {
    const byVideo = new Map<string, { id: string; start: number; end: number }[]>();
    for (const { movement: m } of entries) {
      const { videoId, start, end } = m.audio;
      expect(videoId, m.id).toMatch(/^[\w-]{11}$/);
      expect(start, m.id).toBeGreaterThanOrEqual(0);
      if (end !== null) expect(end, m.id).toBeGreaterThan(start);
      byVideo.set(videoId, [...(byVideo.get(videoId) ?? []), { id: m.id, start, end: end ?? Infinity }]);
    }
    for (const spans of byVideo.values()) {
      spans.sort((a, b) => a.start - b.start);
      for (let i = 1; i < spans.length; i++) {
        expect(spans[i].start, `${spans[i - 1].id} → ${spans[i].id}`).toBeGreaterThanOrEqual(spans[i - 1].end);
      }
    }
  });

  it('악보 파일이 있고 지원 형식이며, 악보 폴더에 라이선스 파일이 있다', () => {
    for (const { movement } of entries) {
      for (const p of scorePaths(movement)) {
        expect(fs.existsSync(`${DATA}/${p}`), p).toBe(true);
        expect(formatOf(p), p).not.toBeNull();
        const dir = path.dirname(`${DATA}/${p}`);
        expect(fs.readdirSync(dir).some((f) => /^LICENSE/i.test(f)), `${dir}에 LICENSE 파일`).toBe(true);
      }
    }
  });

  it('악보가 있으면 scoreSources(하단 출처 표기)도 있다', () => {
    if (entries.some((e) => scorePaths(e.movement).length > 0)) expect(file.scoreSources?.length).toBeGreaterThan(0);
  });
});

describe('모든 악보가 Verovio로 그려진다', () => {
  let mod: unknown;
  beforeAll(async () => {
    mod = await createVerovioModule();
  }, 60_000);

  const files = [...new Set(concerts.flatMap(({ file }) => flattenMovements(file).flatMap((e) => scorePaths(e.movement))))];

  it.each(files)('%s', (p) => {
    const format = formatOf(p)!;
    const buf = fs.readFileSync(`${DATA}/${p}`);
    const source: ScoreSource = format === 'mxl'
      ? { format, data: buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) as ArrayBuffer }
      : { format, data: buf.toString('utf8') };
    const tk = new VerovioToolkit(mod);
    expect(loadScore(tk, source)).toBe(true);
    const ids = [...buildMeasureIds(tk.getMEI()).values()];
    expect(ids.length).toBeGreaterThan(0);
    expect(new Set(ids).size, '마디 ID 중복').toBe(ids.length);
    expect(tk.renderToSVG(1)).toContain('class="measure');
  });
});
