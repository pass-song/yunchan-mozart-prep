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
  /** data/ 기준 악보 경로(.krn .musicxml .xml .mxl .mei). 여러 파일이면 이어 붙인다. 악보를 구할 수 없으면 null(영상만 재생) */
  score: string | string[] | null;
  recordingId: string;
  audio: AudioSpec;
  /** 타이밍 맵 경로 (현재 화면에서 쓰지 않음) */
  timing?: string;
  sections?: { label: string; from: string; to: string }[];
}

export interface Piece {
  id: string;
  /** 화면 표기 이름. 없으면 k (예: "K.282") */
  title?: string;
  /** 작품 번호 (모차르트 쾨헬 번호 등) */
  k?: string;
  no?: number;
  /** 조성 (예: "E♭장조") */
  key?: string;
  movements: Movement[];
}

export function pieceName(piece: Piece): string {
  return piece.title ?? piece.k ?? piece.id;
}

/** data/concerts/index.json: 첫 화면에 보일 공연 순서. 각 공연은 data/concerts/<id>/pieces.json */
export interface ConcertIndex {
  concerts: string[];
}

export function piecesPath(concertId: string): string {
  return `concerts/${concertId}/pieces.json`;
}

export function scorePaths(movement: Movement): string[] {
  if (!movement.score) return [];
  return Array.isArray(movement.score) ? movement.score : [movement.score];
}

/** 악보 출처. 페이지 하단에 표기한다 */
export interface ScoreSourceCredit {
  name: string;
  url: string;
  license: string;
  licenseUrl?: string;
}

export interface PiecesFile {
  concert: { title: string; performer: string; date: string; venue: string };
  recordings: Record<string, { label: string }>;
  scoreSources?: ScoreSourceCredit[];
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
