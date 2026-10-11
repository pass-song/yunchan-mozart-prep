import { ScoreView } from './score/ScoreView';
import { fetchScore } from './score/scoreFormat';
import { YouTubeSource } from './audio/YouTubeSource';
import { MovementPlayer } from './audio/MovementPlayer';
import {
  assetUrl, fetchJson, flattenMovements, piecesPath, pieceName, scorePaths,
  type ConcertIndex, type MovementEntry, type PiecesFile,
} from './data';

// 화면: #/ 공연 목록 → #/<공연> 곡 목록 → #/<공연>/<악장> 영상+악보
// 탭 모드·타이밍 맵 싱크(src/sync, src/ui/TapRecorder)는 화면에서 뺐다. 모듈과 테스트는 남아 있다.

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;

/** 악보 크기(Verovio scale, %) */
const SCALE_MIN = 15;
const SCALE_MAX = 80;
const SCALE_STEP = 5;
/** 폰에서는 한 줄에 3~4마디 이상 들어가게 작게 시작 */
const defaultScale = () => (window.innerWidth < 600 ? 20 : 40);

type View = 'home' | 'concert' | 'player';

/** 영상·악보 화면. 처음 악장을 열 때 한 번 만든다 */
interface PlayerApp {
  score: ScoreView;
  audio: YouTubeSource;
  player: MovementPlayer;
  concertId: string | null;
}

const concerts = new Map<string, PiecesFile>();
let concertIds: string[] = [];
let app: PlayerApp | null = null;
let appReady: Promise<PlayerApp> | null = null;
let scoreToken = 0;

async function main(): Promise<void> {
  const index = await fetchJson<ConcertIndex>(assetUrl('concerts/index.json'));
  if (!index) throw new Error('concerts/index.json을 읽을 수 없음');
  concertIds = index.concerts;
  window.addEventListener('hashchange', () => void route());
  window.addEventListener('keydown', (e) => {
    if (e.code !== 'Space' || $('player-view').hidden || e.target instanceof HTMLSelectElement) return;
    e.preventDefault();
    app?.player.toggle();
  });
  await route();
}

async function loadConcert(id: string): Promise<PiecesFile> {
  let file = concerts.get(id);
  if (!file) {
    const loaded = await fetchJson<PiecesFile>(assetUrl(piecesPath(id)));
    if (!loaded) throw new Error(`공연을 찾을 수 없음: ${id}`);
    concerts.set(id, (file = loaded));
  }
  return file;
}

async function route(): Promise<void> {
  const hash = location.hash.replace(/^#\/?/, '');
  // 예전 주소(#k331-3)는 첫 공연의 그 악장으로
  if (hash && !hash.includes('/') && !concertIds.includes(hash) && concertIds[0]) {
    history.replaceState(null, '', `#/${concertIds[0]}/${hash}`);
    return route();
  }
  const [concertId, movementId] = hash.split('/');
  try {
    if (!concertId) await showHome();
    else if (!movementId) await showConcert(concertId);
    else await showPlayer(concertId, movementId);
  } catch (e) {
    console.error(e);
    showView('home');
    $('concert-list').textContent = `오류: ${e instanceof Error ? e.message : e}`;
  }
}

function showView(view: View): void {
  if (view !== 'player') app?.audio.pause();
  $('home-view').hidden = view !== 'home';
  $('concert-view').hidden = view !== 'concert';
  $('player-view').hidden = view !== 'player';
  document.body.dataset.view = view;
}

// ---- 공연 목록 ----

async function showHome(): Promise<void> {
  showView('home');
  document.title = '공연 예습';
  const files = await Promise.all(concertIds.map(loadConcert));
  const list = $('concert-list');
  list.replaceChildren(
    ...files.map((file, i) => {
      const { concert } = file;
      const movements = file.pieces.reduce((n, p) => n + p.movements.length, 0);
      return li(
        link(`#/${concertIds[i]}`, [
          el('strong', concert.title),
          el('span', `${concert.performer} · ${concert.date} · ${concert.venue}`),
          el('span', `${file.pieces.length}곡 · ${movements}악장`),
        ]),
      );
    }),
  );
  renderCredit(files);
}

// ---- 곡 목록 ----

async function showConcert(concertId: string): Promise<void> {
  const file = await loadConcert(concertId);
  showView('concert');
  const { concert } = file;
  document.title = concert.title;
  $('concert-title').textContent = concert.title;
  $('concert-meta').textContent = `${concert.performer} · ${concert.date} · ${concert.venue}`;
  $('piece-list').replaceChildren(
    ...file.pieces.map((piece) =>
      li([
        el('div', `${pieceName(piece)}${piece.key ? ` · ${piece.key}` : ''}`, 'piece-title'),
        el(
          'ul',
          piece.movements.map((m) =>
            li(
              link(`#/${concertId}/${m.id}`, [
                el('span', `${m.index}. ${m.title}`),
                el('span', file.recordings[m.recordingId]?.label ?? m.recordingId, 'badge'),
                ...(m.score ? [] : [el('span', '악보 없음', 'badge muted')]),
              ]),
            ),
          ),
        ),
      ]),
    ),
  );
  renderCredit([file]);
}

// ---- 영상 + 악보 ----

async function showPlayer(concertId: string, movementId: string): Promise<void> {
  const file = await loadConcert(concertId);
  const entries = flattenMovements(file);
  const index = entries.findIndex((e) => e.movement.id === movementId);
  if (index < 0) throw new Error(`악장을 찾을 수 없음: ${concertId}/${movementId}`);

  showView('player');
  renderCredit([file]);
  const a = await ensurePlayerApp(entries);
  $<HTMLAnchorElement>('back-to-concert').href = `#/${concertId}`;

  if (a.concertId !== concertId) {
    a.concertId = concertId;
    a.player.setEntries(entries);
    const select = $<HTMLSelectElement>('movement');
    select.replaceChildren(
      ...entries.map(({ piece, movement }, i) => new Option(`${pieceName(piece)} · ${movement.index}악장 ${movement.title}`, String(i))),
    );
    a.player.select(index, false);
  } else if (a.player.index !== index) {
    a.player.select(index);
  }
}

function ensurePlayerApp(entries: MovementEntry[]): Promise<PlayerApp> {
  appReady ??= createPlayerApp(entries).then((created) => (app = created));
  return appReady;
}

async function createPlayerApp(entries: MovementEntry[]): Promise<PlayerApp> {
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
  const created: PlayerApp = { score, audio, player, concertId: null };

  audio.onError((code) => {
    $('status').textContent = code === 101 || code === 150
      ? `영상 퍼가기가 막혀 있음 (오류 ${code})`
      : `영상을 찾을 수 없음 (오류 ${code})`;
  });
  player.onMovementChange((entry, i) => {
    $<HTMLSelectElement>('movement').value = String(i);
    $('status').textContent = '';
    // 재생 중 다음 악장으로 넘어간 경우에도 주소를 맞춘다 (replaceState는 hashchange를 일으키지 않는다)
    history.replaceState(null, '', `#/${created.concertId}/${entry.movement.id}`);
    showHeader(entry, created.concertId!);
    void showScore(entry, score);
  });

  const playButton = $<HTMLButtonElement>('play-pause');
  playButton.disabled = false;
  playButton.addEventListener('click', () => player.toggle());
  audio.onStateChange((playing) => (playButton.textContent = playing ? '멈춤' : '재생'));
  const select = $<HTMLSelectElement>('movement');
  select.addEventListener('change', () => player.select(Number(select.value)));

  // 버튼·선택 상자에 포커스가 남아 있으면 스페이스바가 그 버튼을 누르므로 바로 풀어 준다
  for (const el of document.querySelectorAll<HTMLElement>('#player-view button, #player-view select')) {
    el.addEventListener(el.tagName === 'SELECT' ? 'change' : 'click', () => el.blur());
  }

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
  return created;
}

function showHeader({ piece, movement }: MovementEntry, concertId: string): void {
  const file = concerts.get(concertId)!;
  const title = `${pieceName(piece)} · ${movement.index}악장 ${movement.title}`;
  $('title').textContent = title;
  const recording = file.recordings[movement.recordingId]?.label ?? movement.recordingId;
  $('subtitle').textContent = [piece.key, recording].filter(Boolean).join(' · ');
  document.title = title;
}

/** 악장 악보로 바꾸고 맨 위로 스크롤한다. 악보가 없으면 영상만 */
async function showScore({ movement }: MovementEntry, score: ScoreView): Promise<void> {
  const token = ++scoreToken;
  const paths = scorePaths(movement);
  if (paths.length === 0) {
    score.showMessage('이 곡은 악보가 없습니다. 영상만 재생합니다.');
    return;
  }
  try {
    const sources = await Promise.all(paths.map((p) => fetchScore(assetUrl(p), p)));
    if (token === scoreToken) score.load(sources);
  } catch (e) {
    console.error(e);
    if (token === scoreToken) score.showMessage(`악보를 불러오지 못했습니다. 영상만 재생합니다. (${e instanceof Error ? e.message : e})`);
  }
}

// ---- 하단 출처 ----

function renderCredit(files: PiecesFile[]): void {
  const seen = new Set<string>();
  const parts: Node[] = [];
  for (const s of files.flatMap((f) => f.scoreSources ?? [])) {
    if (seen.has(s.url)) continue;
    seen.add(s.url);
    parts.push(
      text('악보: '),
      link(s.url, s.name),
      text(', '),
      s.licenseUrl ? link(s.licenseUrl, s.license) : text(s.license),
      text(' · '),
    );
  }
  parts.push(text('악보는 '), link('https://www.verovio.org', 'Verovio'), text('(LGPL-3.0)로 조판해 표시 · 영상: YouTube 각 채널'));
  $('credit').replaceChildren(...parts);
}

// ---- DOM 도우미 ----

function el(tag: string, content: string | Node | Node[], className?: string): HTMLElement {
  const e = document.createElement(tag);
  if (className) e.className = className;
  if (typeof content === 'string') e.textContent = content;
  else e.append(...(Array.isArray(content) ? content : [content]));
  return e;
}

function li(content: Node | Node[]): HTMLElement {
  return el('li', content);
}

function link(href: string, content: string | Node[]): HTMLAnchorElement {
  const a = el('a', content) as HTMLAnchorElement;
  a.href = href;
  return a;
}

function text(s: string): Text {
  return document.createTextNode(s);
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
  document.body.textContent = `오류: ${e instanceof Error ? e.message : e}`;
});
