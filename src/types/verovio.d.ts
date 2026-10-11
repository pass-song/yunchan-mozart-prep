// verovio npm 패키지에는 타입 선언이 없어 쓰는 API만 선언한다.
declare module 'verovio/wasm-hum' {
  const createVerovioModule: () => Promise<unknown>;
  export default createVerovioModule;
}

declare module 'verovio/esm' {
  export class VerovioToolkit {
    constructor(module: unknown);
    setOptions(options: Record<string, unknown>): void;
    loadData(data: string): boolean;
    loadZipDataBuffer(data: ArrayBuffer): boolean;
    getMEI(options?: Record<string, unknown>): string;
    getPageCount(): number;
    renderToSVG(pageNo?: number, xmlDeclaration?: boolean): string;
    redoLayout(options?: Record<string, unknown>): void;
    getPageWithElement(xmlId: string): number;
    renderToTimemap(options?: Record<string, unknown>): {
      measureOn?: string;
      qstamp: number;
      tstamp: number;
    }[];
  }
}
