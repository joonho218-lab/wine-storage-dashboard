// '점검 필요' 항목 찾기.
// signature는 문제의 내용으로 만들어요. 확인 완료 후 문제가 달라지면(중복이 하나 더 생기거나
// 음수 재고가 더 줄어들면) signature가 바뀌어 다시 점검 필요로 표시돼요.

export function findIssues(stock) {
  const issues = [];
  const byKey = new Map();
  stock.forEach((r) => {
    const k = `${r.name}__${r.vintage}__${r.rack}`;
    if (!byKey.has(k)) byKey.set(k, []);
    byKey.get(k).push(r);
  });
  byKey.forEach((list) => {
    if (list.length < 2) return;
    const rows = [...list].sort((a, b) => a.id - b.id);
    const first = rows[0];
    const qtys = rows.map((r) => r.currentQty || 0).sort((a, b) => b - a);
    issues.push({
      kind: 'duplicate',
      signature: `dup|${first.name}|${first.vintage}|${first.rack}|${rows.map((r) => r.id).join(',')}`.slice(0, 500),
      label: `${first.name} ${first.vintage} · ${first.rack}`.slice(0, 300),
      rows,
      extraBottles: qtys.slice(1).reduce((s, q) => s + q, 0),
    });
  });
  stock
    .filter((r) => r.currentQty < 0)
    .forEach((r) => {
      issues.push({
        kind: 'negative',
        signature: `neg|${r.id}|${r.currentQty}`,
        label: `${r.name} ${r.vintage} · ${r.rack}`.slice(0, 300),
        rows: [r],
        extraBottles: 0,
      });
    });
  return issues;
}
