import { ScoreView } from './score/ScoreView';
import { YouTubeSource } from './audio/YouTubeSource';
import { MovementPlayer } from './audio/MovementPlayer';
import { assetUrl, fetchJson, flattenMovements, type MovementEntry, type PiecesFile } from './data';

// 탭 모드·타이밍 맵 싱크(src/sync, src/ui/TapRecorder)는 화면에서 뺐다. 모듈과 테스트는 남아 있다.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** 처음 띄울 악장. 주소 끝에 #k331-2 처럼 붙이면 그 악장으로 시작 */
const DEFAULT_MOVEMENT = 'k331-3';

/** 악보 크기(Verovio scale, %) */
const SCALE_MIN = 15;
const SCALE_MAX = 80;
const SCALE_STEP = 5;
/** 폰에서는 한 줄에 3~4마디 이상 들어가게 작게 시작 */
const defaultScale = () => (window.innerWidth < 600 ? 20 : 40);

let loadToken = 0;

async function main(): Promise<void> {
  const pieces = await fetchJson<PiecesFile>(assetUrl('pieces.json'));
  if (!pieces) throw new Error('pieces.json을 읽을 수 없음');
  const entries = flattenMovements(pieces);
  const recordingLabels = Object.fromEntries(Object.entries(pieces.recordings).map(([k, v]) => [k, v.label]));

  const select = $<HTMLSelectElement>('movement');
  entries.forEach(({ piece, movement }, i) => {
    select.add(new Option(`${piece.k} · ${movement.index}악장 ${movement.title}`, String(i)));
  });

  let scale = load<number>('score-scale') ?? defaultScale();
  const score = await ScoreView.create($('score'), scale);
  score.onMeasureClick = (id) => console.log('마디', id);
  const showScale = () => ($('scale').textContent = `${scale}%`);
  showScale();
  const changeScale = (delta: number) => {
    const next = Math.min(SCALE_MAX, Math.max(SCALE_MIN, scale + delta));
    if (next === scale) return;
    scale = next;
    store('score-scale', scale);
    showScale();
    score.setScale(scale);
  };
  $('scale-down').addEventListener('click', () => changeScale(-SCALE_STEP));
  $('scale-up').addEventListener('click', () => changeScale(SCALE_STEP));

  const audio = await YouTubeSource.create('yt-player');
  const player = new MovementPlayer(audio, entries);
  audio.onError((code) => {
    $('status').textContent = code === 101 || code === 150
      ? `영상 퍼가기가 막혀 있음 (오류 ${code})`
      : `영상을 찾을 수 없음 (오류 ${code})`;
  });

  player.onMovementChange((entry, i) => {
    select.value = String(i);
    location.hash = entry.movement.id;
    showHeader(entry, recordingLabels);
    void loadScore(entry, score);
  });

  const playButton = $<HTMLButtonElement>('play-pause');
  playButton.disabled = false;
  playButton.addEventListener('click', () => player.toggle());
  audio.onStateChange((playing) => (playButton.textContent = playing ? '멈춤' : '재생'));
  select.addEventListener('change', () => player.select(Number(select.value)));

  // 버튼·선택 상자에 포커스가 남아 있으면 스페이스바가 그 버튼을 누르므로 바로 풀어 준다
  for (const el of document.querySelectorAll<HTMLElement>('button, select')) {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'click', () => el.blur());
  }
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || e.target instanceof HTMLSelectElement) return;
    e.preventDefault();
    player.toggle();
  });

  const start = entries.findIndex((e) => e.movement.id === (location.hash.slice(1) || DEFAULT_MOVEMENT));
  player.select(Math.max(0, start), false);

  const tick = () => {
    // 다음 프레임을 먼저 예약해 둔다. 한 프레임에서 오류가 나도 루프(악장 전환 판정 포함)는 멈추지 않는다
    requestAnimationFrame(tick);
    try {
      player.tick(audio.getCurrentTime());
    } catch (e) {
      console.error(e);
    }
  };
  tick();
}

function showHeader({ piece, movement }: MovementEntry, recordingLabels: Record<string, string>): void {
  $('title').textContent = `${piece.k} · ${movement.index}악장 ${movement.title}`;
  $('subtitle').textContent = `${piece.key} · ${recordingLabels[movement.recordingId] ?? movement.recordingId}`;
}

/** 악장 악보로 바꾸고 맨 위로 스크롤한다 */
async function loadScore({ movement }: MovementEntry, score: ScoreView): Promise<void> {
  const token = ++loadToken;
  const paths = Array.isArray(movement.score) ? movement.score : [movement.score];
  const texts = await Promise.all(paths.map((p) => fetch(assetUrl(p)).then((r) => r.text())));
  if (token === loadToken) score.load(texts);
}

function load<T>(key: string): T | null {
  try {
    return JSON.parse(localStorage.getItem(key) ?? 'null') as T | null;
  } catch {
    return null;
  }
}

function store(key: string, value: unknown): void {
  try {
    localStorage.setItem(key, JSON.stringify(value));
  } catch { /* 저장 못 해도 이번 화면에서는 적용된다 */ }
}

main().catch((e) => {
  console.error(e);
  $('title').textContent = `오류: ${e instanceof Error ? e.message : e}`;
});
