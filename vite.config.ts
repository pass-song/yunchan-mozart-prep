import { defineConfig } from 'vite';

export default defineConfig(({ command, isPreview }) => ({
  // GitHub Pages: https://pass-song.github.io/yunchan-mozart-prep/ (빌드·미리보기). 개발 서버는 그대로 localhost:5173/
  base: command === 'build' || isPreview ? '/yunchan-mozart-prep/' : '/',
  // data/ 를 정적 루트로 서빙한다. pieces.json 안의 경로("scores/…")를 assetUrl()로 그대로 fetch 할 수 있다.
  publicDir: 'data',
  build: {
    // Verovio(wasm 내장) 때문에 번들이 크다. 경고만 끈다
    chunkSizeWarningLimit: 16000,
  },
}));
