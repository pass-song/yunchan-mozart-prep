/**
 * Verovio가 만든 MEI에서 <measure xml:id> → 마디 ID 매핑을 만든다.
 *
 * 마디 ID 규칙 (CLAUDE.md 참고):
 * - 원본 Humdrum의 마디 번호(@n)를 그대로 쓴다. 1·2번 괄호도 각자 번호를 가진다.
 * - 번호 없는 첫 마디(못갖춘마디) → "0"
 * - 번호 없는 중간 마디(반복 기호에서 쪼개진 조각, 카덴차) → 직전 마디 ID + ".1", ".2" …
 */
export function buildMeasureIds(mei: string): Map<string, string> {
  const ids = new Map<string, string>();
  let prev: string | null = null;
  let sub = 0;
  for (const [tag] of mei.matchAll(/<measure\b[^>]*>/g)) {
    const xmlId = tag.match(/\bxml:id="([^"]+)"/)?.[1];
    if (!xmlId) continue;
    const n = tag.match(/\bn="([^"]+)"/)?.[1];
    let id: string;
    if (n) {
      id = n;
      prev = n;
      sub = 0;
    } else if (prev === null) {
      id = '0';
      prev = '0';
      sub = 0;
    } else {
      id = `${prev}.${++sub}`;
    }
    ids.set(xmlId, id);
  }
  return ids;
}
