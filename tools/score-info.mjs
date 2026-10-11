// 악보 파일 하나를 Verovio로 읽어 요약을 출력한다. /add-piece의 "렌더 확인" 단계에서 쓴다.
// 사용: npm run score-info -- data/scores/<출처>/<파일>.(krn|musicxml|xml|mxl|mei) [미리보기.svg]
import fs from 'node:fs';
import createVerovioModule from 'verovio/wasm-hum';
import { VerovioToolkit } from 'verovio/esm';

const [file, svgOut] = process.argv.slice(2);
if (!file) {
  console.error('사용: npm run score-info -- <악보 파일> [미리보기.svg]');
  process.exit(2);
}

const ext = file.toLowerCase().split('.').pop();
const format = { krn: 'humdrum', musicxml: 'musicxml', xml: 'musicxml', mxl: 'mxl', mei: 'mei' }[ext];
if (!format) {
  console.error(`지원하지 않는 형식: .${ext} (.krn .musicxml .xml .mxl .mei)`);
  process.exit(1);
}

const tk = new VerovioToolkit(await createVerovioModule());
tk.setOptions({ pageWidth: 2100, pageHeight: 60000, adjustPageHeight: true, breaks: 'auto', scale: 40 });
let ok;
if (format === 'mxl') {
  const buf = fs.readFileSync(file);
  ok = tk.loadZipDataBuffer(buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength));
} else {
  tk.setOptions({ inputFrom: format });
  ok = tk.loadData(fs.readFileSync(file, 'utf8'));
}
if (!ok) {
  console.error('읽기 실패: Verovio가 이 파일을 읽지 못했습니다.');
  process.exit(1);
}

const mei = tk.getMEI();
const measures = [...mei.matchAll(/<measure\b[^>]*>/g)].map(([tag]) => tag.match(/\bn="([^"]+)"/)?.[1] ?? '(번호 없음)');
const numbered = measures.filter((n) => n !== '(번호 없음)');
const title = mei.match(/<title[^>]*>([^<]+)<\/title>/)?.[1]?.trim();
const meters = [...new Set(
  [...mei.matchAll(/<meterSig\b[^>]*>|meter\.count="\d+"[^>]*meter\.unit="\d+"/g)].map(([s]) => {
    const count = s.match(/count="(\d+)"/)?.[1];
    const unit = s.match(/unit="(\d+)"/)?.[1];
    return count && unit ? `${count}/${unit}` : s.includes('sym="common"') ? 'C' : s.includes('sym="cut"') ? '¢' : '?';
  }),
)];

console.log(JSON.stringify({
  file,
  format,
  title: title ?? null,
  measures: measures.length,
  unnumbered: measures.length - numbered.length,
  first: measures[0],
  last: numbered.at(-1) ?? null,
  meters,
  staves: Number(mei.match(/<staffGrp[\s\S]*?<\/staffGrp>/)?.[0].match(/<staffDef\b/g)?.length ?? 0),
}, null, 2));

if (svgOut) {
  fs.writeFileSync(svgOut, tk.renderToSVG(1));
  console.log(`미리보기: ${svgOut}`);
}
