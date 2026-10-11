/** data/pieces.json 스키마 */
export interface AudioSpec {
  type: 'youtube';
  videoId: string;
  start: number;
  /** null = 영상 끝까지 */
  end: number | null;
}

export interface Movement {
  id: string;
  index: number;
  title: string;
  score: string | string[];
  recordingId: string;
  audio: AudioSpec;
  timing: string;
  sections: { label: string; from: string; to: string }[];
}

export interface Piece {
  id: string;
  k: string;
  no: number;
  key: string;
  movements: Movement[];
}

export interface PiecesFile {
  concert: { title: string; performer: string; date: string; venue: string };
  recordings: Record<string, { label: string }>;
  pieces: Piece[];
}

/** 타이밍 맵 (CLAUDE.md 참고) */
export interface TimingEvent {
  t: number;
  m: string;
  /** 기준점 모드에서 사용자가 직접 탭한 마디. 없으면 보간값(또는 모든 마디 탭) */
  anchor?: boolean;
}

export interface TimingMap {
  movementId: string;
  recordingId: string;
  audioOffset: number;
  events: TimingEvent[];
}

/** 공연 순서대로 펼친 악장 하나 */
export interface MovementEntry {
  piece: Piece;
  movement: Movement;
}

export function flattenMovements(file: PiecesFile): MovementEntry[] {
  return file.pieces.flatMap((piece) => piece.movements.map((movement) => ({ piece, movement })));
}

/** data/ 기준 경로("pieces.json", "scores/…")를 배포 주소(GitHub Pages는 /yunchan-mozart-prep/)에 맞춘다 */
export function assetUrl(path: string): string {
  return import.meta.env.BASE_URL + path;
}

/** JSON 파일을 읽는다. 없으면 null (Vite dev 서버는 없는 경로에 index.html을 돌려주므로 파싱 실패도 null). */
export async function fetchJson<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(path);
    if (!res.ok) return null;
    return JSON.parse(await res.text()) as T;
  } catch {
    return null;
  }
}
