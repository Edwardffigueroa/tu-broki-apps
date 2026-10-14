/**
 * Diff unificado compacto por líneas (LCS).
 */

export function unifiedDiff(a, b, context = 2, maxLines = 200) {
  const A = String(a || '').split('\n');
  const B = String(b || '').split('\n');
  const n = A.length;
  const m = B.length;
  const dp = Array.from({ length: n + 1 }, () => new Array(m + 1).fill(0));
  for (let i = n - 1; i >= 0; i--) {
    for (let j = m - 1; j >= 0; j--) {
      dp[i][j] = A[i] === B[j] ? dp[i + 1][j + 1] + 1 : Math.max(dp[i + 1][j], dp[i][j + 1]);
    }
  }
  const ops = [];
  let i = 0;
  let j = 0;
  while (i < n && j < m) {
    if (A[i] === B[j]) {
      ops.push({ t: ' ', line: A[i] });
      i++;
      j++;
    } else if (dp[i + 1][j] >= dp[i][j + 1]) {
      ops.push({ t: '-', line: A[i++] });
    } else {
      ops.push({ t: '+', line: B[j++] });
    }
  }
  while (i < n) ops.push({ t: '-', line: A[i++] });
  while (j < m) ops.push({ t: '+', line: B[j++] });

  let added = 0;
  let removed = 0;
  for (const o of ops) {
    if (o.t === '+') added++;
    if (o.t === '-') removed++;
  }

  // Simplificado: volcar con contexto alrededor de cambios
  const show = new Array(ops.length).fill(false);
  for (let k = 0; k < ops.length; k++) {
    if (ops[k].t !== ' ') {
      for (let c = Math.max(0, k - context); c <= Math.min(ops.length - 1, k + context); c++) {
        show[c] = true;
      }
    }
  }

  const out = [];
  let shown = 0;
  let truncated = false;
  let aLine = 1;
  let bLine = 1;
  let blockStart = true;
  for (let k = 0; k < ops.length; k++) {
    if (!show[k]) {
      if (ops[k].t === ' ') {
        aLine++;
        bLine++;
      } else if (ops[k].t === '-') aLine++;
      else bLine++;
      blockStart = true;
      continue;
    }
    if (blockStart) {
      out.push(`@@ -${aLine} +${bLine} @@`);
      blockStart = false;
    }
    if (shown >= maxLines) {
      truncated = true;
      break;
    }
    out.push(`${ops[k].t}${ops[k].line}`);
    shown++;
    if (ops[k].t === ' ') {
      aLine++;
      bLine++;
    } else if (ops[k].t === '-') aLine++;
    else bLine++;
  }
  if (truncated) {
    out.push(`… (+${ops.filter((_, idx) => show[idx]).length - shown} líneas omitidas; usa wiki_get_version para ver completo)`);
  }
  return { text: out.join('\n') || '(sin cambios)', added, removed };
}
