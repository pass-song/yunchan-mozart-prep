import type { VerovioToolkit } from 'verovio/esm';

/** 읽을 수 있는 악보 형식 */
export type ScoreFormat = 'humdrum' | 'musicxml' | 'mxl' | 'mei';

/** 파일 확장자로 형식을 정한다. 모르는 확장자면 null */
export function formatOf(path: string): ScoreFormat | null {
  const ext = path.toLowerCase().match(/\.([a-z]+)$/)?.[1];
  switch (ext) {
    case 'krn': return 'humdrum';
    case 'musicxml':
    case 'xml': return 'musicxml';
    case 'mxl': return 'mxl';
    case 'mei': return 'mei';
    default: return null;
  }
}

/** 악보 파일 하나의 내용. 압축 MusicXML(.mxl)만 바이너리 */
export interface ScoreSource {
  format: ScoreFormat;
  data: string | ArrayBuffer;
}

/** 경로의 악보를 받아 온다. .mxl은 바이너리로 받는다 */
export async function fetchScore(url: string, path = url): Promise<ScoreSource> {
  const format = formatOf(path);
  if (!format) throw new Error(`지원하지 않는 악보 형식: ${path} (.krn .musicxml .xml .mxl .mei)`);
  const res = await fetch(url);
  if (!res.ok) throw new Error(`악보를 받을 수 없음: ${path} (${res.status})`);
  return { format, data: format === 'mxl' ? await res.arrayBuffer() : await res.text() };
}

/** 툴킷에 악보를 읽힌다. 레이아웃 옵션은 미리 setOptions 해 둔다 */
export function loadScore(tk: VerovioToolkit, source: ScoreSource): boolean {
  if (source.format === 'mxl') return Boolean(tk.loadZipDataBuffer(source.data as ArrayBuffer));
  tk.setOptions({ inputFrom: source.format });
  return Boolean(tk.loadData(source.data as string));
}
