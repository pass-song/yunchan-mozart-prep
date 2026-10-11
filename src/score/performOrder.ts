/**
 * MEI의 <expansion> (Humdrum `*>[A,A,B,…]`)을 읽어 연주 순서대로의 마디 ID 목록을 만든다.
 * 다 카포·1·2번 괄호가 이 목록에 반영된다.
 */
export interface PerformOrders {
  /** 반복 포함 (expansion 기본) */
  repeat: string[];
  /** 반복 생략 (type="norep") */
  norep: string[];
  /** 악보에 적힌 순서 그대로 */
  score: string[];
}

export function buildPerformOrders(mei: string, measureIds: Map<string, string>): PerformOrders {
  const expansions = [...mei.matchAll(/<expansion\b[^>]*>/g)].map(([tag]) => ({
    plist: (tag.match(/\bplist="([^"]*)"/)?.[1] ?? '').split(/\s+/).filter(Boolean).map((r) => r.replace(/^#/, '')),
    norep: /\btype="norep"/.test(tag),
  }));
  const referenced = new Set(expansions.flatMap((e) => e.plist));

  // 각 마디를 그것을 감싸는 가장 안쪽의 "참조된" section/ending에 배정한다
  const byContainer = new Map<string, string[]>();
  const score: string[] = [];
  const stack: (string | null)[] = [];
  for (const [tag, close, name] of mei.matchAll(/<(\/?)(section|ending|measure)\b[^>]*?>/g)) {
    if (name === 'measure') {
      if (close) continue;
      const id = measureIds.get(tag.match(/\bxml:id="([^"]+)"/)?.[1] ?? '');
      if (id === undefined) continue;
      score.push(id);
      const owner = [...stack].reverse().find((s): s is string => s !== null && referenced.has(s));
      if (owner) byContainer.set(owner, [...(byContainer.get(owner) ?? []), id]);
    } else if (close) {
      stack.pop();
    } else if (!tag.endsWith('/>')) {
      stack.push(tag.match(/\bxml:id="([^"]+)"/)?.[1] ?? null);
    }
  }

  const expand = (plist: string[]) => plist.flatMap((ref) => byContainer.get(ref) ?? []);
  const rep = expansions.find((e) => !e.norep);
  const norep = expansions.find((e) => e.norep);
  return {
    repeat: rep ? expand(rep.plist) : score,
    norep: norep ? expand(norep.plist) : score,
    score,
  };
}
