import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';
import { buildMeasureIds } from './measureIds';
import { buildPerformOrders, type PerformOrders } from './performOrder';
import { loadScore, type ScoreSource } from './scoreFormat';

/** Verovio pageHeight 최댓값. 이보다 긴 악장은 여러 장이 되지만 이어 붙여 한 장처럼 보인다 */
const MAX_PAGE_HEIGHT = 60000;

/** 악보를 읽고 얻는 정보 */
export interface ScoreInfo {
  orders: PerformOrders;
  /** 마디 ID → 길이(4분음표 단위). 못갖춘 조각도 실제 길이 */
  durations: Map<string, number>;
  /** 악보 템포 기준 4분음표 하나의 초 */
  secPerQuarter: number;
}

/** 악보 파일 하나. 여러 파일로 나뉜 악장(K.331 1악장)은 Verovio가 한 번에 못 읽어 파일마다 툴킷을 둔다. */
interface Segment {
  tk: VerovioToolkit;
  /** xml:id → 마디 ID */
  measureIds: Map<string, string>;
}

/**
 * Verovio로 악보(Humdrum·MusicXML·MEI)를 화면 폭에 맞춘 긴 한 장으로 그린다. 세로 스크롤로 본다.
 * 폭이나 악보 크기(scale)가 바뀌면 줄바꿈을 다시 한다.
 */
export class ScoreView {
  private segments: Segment[] = [];
  private lastWidth = 0;
  private resizeTimer = 0;
  onMeasureClick: (measureId: string) => void = () => {};

  private constructor(
    private readonly container: HTMLElement,
    private readonly module: unknown,
    /** Verovio 확대율(%) */
    private scale: number,
  ) {
    container.addEventListener('click', (e) => {
      const g = (e.target as Element).closest('g.measure');
      const seg = this.segments[Number(g?.closest('[data-seg]')?.getAttribute('data-seg'))];
      const id = g && seg?.measureIds.get(g.id);
      if (id) this.onMeasureClick(id);
    });
    new ResizeObserver(() => {
      clearTimeout(this.resizeTimer);
      this.resizeTimer = window.setTimeout(() => {
        // 화면이 숨겨지면 폭이 0이 된다. 그때는 다시 그리지 않는다
        const w = this.container.clientWidth;
        if (w > 0 && w !== this.lastWidth) this.relayout();
      }, 150);
    }).observe(container);
  }

  static async create(container: HTMLElement, scale: number): Promise<ScoreView> {
    return new ScoreView(container, await createVerovioModule(), scale);
  }

  /** 악보 없이 안내 문구만 보인다 (악보를 구할 수 없는 곡) */
  showMessage(message: string): void {
    this.segments = [];
    this.container.innerHTML = '';
    const p = document.createElement('p');
    p.className = 'score-message';
    p.textContent = message;
    this.container.append(p);
    this.container.scrollTop = 0;
  }

  /** 악보 파일(들)을 읽어 그리고 맨 위로 스크롤한다. 연주 순서와 마디 길이를 돌려준다. */
  load(sources: ScoreSource[]): ScoreInfo {
    const options = this.layoutOptions();
    this.segments = sources.map((source, i) => {
      const tk = new VerovioToolkit(this.module);
      tk.setOptions(options);
      if (!loadScore(tk, source)) throw new Error(`악보를 읽을 수 없음 (${i + 1}번째 파일, ${source.format})`);
      return { tk, measureIds: buildMeasureIds(tk.getMEI()) };
    });
    this.render();
    this.container.scrollTop = 0;

    const orders = this.segments.map((s) => buildPerformOrders(s.tk.getMEI(), s.measureIds));
    const durations = new Map<string, number>();
    let quarters = 0;
    let ms = 0;
    for (const s of this.segments) {
      const timemap = s.tk.renderToTimemap({ includeMeasures: true });
      measureDurations(timemap, s.measureIds).forEach((d, id) => durations.set(id, d));
      const end = timemap.at(-1);
      quarters += end?.qstamp ?? 0;
      ms += end?.tstamp ?? 0;
    }
    return {
      orders: {
        repeat: orders.flatMap((o) => o.repeat),
        norep: orders.flatMap((o) => o.norep),
        score: orders.flatMap((o) => o.score),
      },
      durations,
      secPerQuarter: quarters > 0 ? ms / 1000 / quarters : 0.5,
    };
  }

  /** 악보 크기를 바꾼다. 보던 위치(비율)는 유지한다 */
  setScale(scale: number): void {
    this.scale = scale;
    this.relayout();
  }

  private layoutOptions(): Record<string, unknown> {
    this.lastWidth = this.container.clientWidth;
    return {
      scale: this.scale,
      pageWidth: Math.max(100, Math.floor((this.lastWidth * 100) / this.scale)),
      pageHeight: MAX_PAGE_HEIGHT,
      adjustPageHeight: true,
      breaks: 'auto',
      footer: 'none',
    };
  }

  private relayout(): void {
    if (this.segments.length === 0) return;
    const { scrollTop, scrollHeight } = this.container;
    const ratio = scrollHeight > 0 ? scrollTop / scrollHeight : 0;
    const options = this.layoutOptions();
    for (const s of this.segments) {
      s.tk.setOptions(options);
      s.tk.redoLayout();
    }
    this.render();
    this.container.scrollTop = ratio * this.container.scrollHeight;
  }

  /** 모든 세그먼트의 모든 장을 세로로 이어 붙인다 */
  private render(): void {
    this.container.innerHTML = this.segments
      .map((s, seg) => {
        let svg = '';
        for (let p = 1; p <= s.tk.getPageCount(); p++) svg += s.tk.renderToSVG(p);
        return `<div data-seg="${seg}">${svg}</div>`;
      })
      .join('');
  }
}

/** Verovio timemap의 마디 시작 qstamp 차이로 마디 길이(4분음표 단위)를 구한다 */
export function measureDurations(
  timemap: { measureOn?: string; qstamp: number }[],
  measureIds: Map<string, string>,
): Map<string, number> {
  const starts = timemap.filter((e) => e.measureOn);
  const total = timemap.at(-1)?.qstamp ?? 0;
  const out = new Map<string, number>();
  starts.forEach((e, i) => {
    const id = measureIds.get(e.measureOn!);
    const next = i + 1 < starts.length ? starts[i + 1].qstamp : total;
    if (id !== undefined) out.set(id, next - e.qstamp);
  });
  return out;
}
