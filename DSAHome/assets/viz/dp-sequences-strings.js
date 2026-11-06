/* Visualizers for DP on Sequences and Strings. Every name is prefixed "dp-sequences-strings-". Frames come from running the real algorithms. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when the mode changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const fmtN = (v) => (v === null || v === undefined ? "" : v === true ? "T" : v === false ? "F" : String(v));

  /* ---------- SVG table with dependency arrows (cells use the svg.dg box classes) ---------- */
  function dgrid(M, o = {}) {
    const R = M.length, C = o.cols || Math.max(1, ...M.map((r) => r.length));
    const cs = o.size || 46, gap = o.gap ?? 8;
    const padL = o.rowLabels ? (o.rowLabelW || 50) : 4;
    const up = o.arcUp || 0, down = o.arcDown || 0;
    const padT = (o.colLabels ? 20 : 4) + up;
    const X = (c) => padL + c * (cs + gap), Y = (r) => padT + r * (cs + gap);
    const W = padL + C * (cs + gap) - gap + 6, H = Y(R) - gap + 6 + down;
    const vcls = o.small ? "dss-v sm" : "dss-v";
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dss-lab" x="${X(c) + cs / 2}" y="${13}" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dss-lab" x="${padL - 8}" y="${Y(r) + cs / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((row, r) => row.forEach((v, c) => {
      if (v === undefined || (o.skip && o.skip(r, c))) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="${o.small ? 4 : 7}"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fmtN(v);
      s += `<text class="${vcls} ${cl}" x="${x + cs / 2}" y="${y + cs / 2 + (o.tag ? 4 : 0)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
      const tg = o.tag ? o.tag(r, c, v) : "";
      if (tg) s += `<text class="dss-sub" x="${x + cs - 4}" y="${y + 11}" text-anchor="end">${esc(tg)}</text>`;
    }));
    const head = (x2, y2, vx, vy, cl) => `<polygon class="dss-ah ${cl}" points="${x2},${y2} ${x2 - vx * 9 - vy * 4.5},${y2 - vy * 9 + vx * 4.5} ${x2 - vx * 9 + vy * 4.5},${y2 - vy * 9 - vx * 4.5}"/>`;
    let labels = "";
    for (const a of o.arrows || []) {
      const [r1, c1] = a.from, [r2, c2] = a.to, cl = a.cls || "active";
      if (a.arc) {
        const dir = a.arc === "down" ? 1 : -1;
        const x1 = X(c1) + cs / 2 + (c2 > c1 ? 6 : -6), x2 = X(c2) + cs / 2 + (c2 > c1 ? -6 : 6);
        const y1 = dir < 0 ? Y(r1) - 1 : Y(r1) + cs + 1, y2 = dir < 0 ? Y(r2) - 2 : Y(r2) + cs + 2;
        const span = Math.abs(c2 - c1);
        const h = a.arcH ?? Math.min((dir < 0 ? up : down) - 6, 10 + 9 * span);
        const mx = (x1 + x2) / 2, my = (dir < 0 ? Math.min(y1, y2) : Math.max(y1, y2)) + dir * h * 2;
        const ex = x2 - mx, ey = y2 - my, el = Math.hypot(ex, ey) || 1;
        s += `<path class="dss-halo" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/><path class="dss-e ${cl}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>${head(x2, y2, ex / el, ey / el, cl)}`;
        if (a.label !== undefined) labels += `<text class="dss-el ${cl}" x="${mx}" y="${((dir < 0 ? Math.min(y1, y2) : Math.max(y1, y2)) + my) / 2}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
        continue;
      }
      const cx1 = X(c1) + cs / 2, cy1 = Y(r1) + cs / 2, cx2 = X(c2) + cs / 2, cy2 = Y(r2) + cs / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const m = Math.max(Math.abs(ux), Math.abs(uy));
      const k1 = (cs / 2 / m) * 0.35, k2 = cs / 2 / m + 1;
      const x1 = cx1 + ux * k1, y1 = cy1 + uy * k1, x2 = cx2 - ux * k2, y2 = cy2 - uy * k2;
      s += `<path class="dss-halo" d="M${x1},${y1} L${x2},${y2}"/><path class="dss-e ${cl}" d="M${x1},${y1} L${x2},${y2}"/>${head(x2, y2, ux, uy, cl)}`;
      if (a.label !== undefined) {
        const t = a.labelAt ?? 0.5;
        labels += `<text class="dss-el ${cl}" x="${x1 + (x2 - x1) * t - uy * 10}" y="${y1 + (y2 - y1) * t + ux * 10}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
      }
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dss-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "DP table")}">${s}${labels}</svg></div>`;
  }

  /* ---------- small helpers ---------- */
  const word = (s, what, max, min = 1) => {
    const w = String(s ?? "").trim().toLowerCase();
    if (!/^[a-z]*$/.test(w) || w.length < min || w.length > max) throw new Error(`${what} must be ${min}–${max} lowercase letters a–z.`);
    return w;
  };
  const rw = (n, al = "abc") => Array.from({ length: n }, () => al[Viz.rand(0, al.length - 1)]).join("");
  const lab = (s) => ["∅", ...[...s].map((ch, k) => `${k + 1}:${ch}`)];
  const chars = (s, cls, label, o = {}) => Viz.array([...s], { label, cls: (i) => (cls ? cls(i) : "") || "", ...o });
  const srcMap = (arrows) => new Map(arrows.map((a) => [`${a.from[0]},${a.from[1]}`, a.cls]));
  const keyset = (cells) => new Set(cells.map(([r, c]) => `${r},${c}`));
  const table = (R, C, v) => Array.from({ length: R }, () => Array(C).fill(v));
  const lcsLen = (a, b) => { let row = Array(b.length + 1).fill(0); for (const x of a) { const p = row.slice(); for (let j = 1; j <= b.length; j++) row[j] = x === b[j - 1] ? p[j - 1] + 1 : Math.max(p[j], row[j - 1]); } return row[b.length]; };

  /* ================= 1. LCS family: subsequence, substring, supersequence ================= */
  const LCS_MODES = ["subsequence (1143)", "common substring (718)", "supersequence (1092)"];
  const LCS_CODE = {
    sub: [
      "def lcs(a, b):",
      "    n, m = len(a), len(b)",
      "    dp = [[0] * (m + 1) for _ in range(n + 1)]   # row/col 0 = empty prefix",
      "    for i in range(1, n + 1):",
      "        for j in range(1, m + 1):",
      "            if a[i - 1] == b[j - 1]:",
      "                dp[i][j] = dp[i - 1][j - 1] + 1  # pair them: diagonal +1",
      "            else:",
      "                dp[i][j] = max(dp[i - 1][j],    # drop a's letter (from above)",
      "                               dp[i][j - 1])    # drop b's letter (from left)",
      "    return dp[n][m]",
      "# walk back: diagonal on a match, else toward the larger neighbour",
    ],
    str: [
      "def longest_common_substring(a, b):",
      "    n, m = len(a), len(b)",
      "    dp = [[0] * (m + 1) for _ in range(n + 1)]   # run ENDING at a[i-1], b[j-1]",
      "    best = 0",
      "    for i in range(1, n + 1):",
      "        for j in range(1, m + 1):",
      "            if a[i - 1] == b[j - 1]:",
      "                dp[i][j] = dp[i - 1][j - 1] + 1  # the run grows diagonally",
      "                best = max(best, dp[i][j])",
      "            # else dp[i][j] stays 0: a mismatch breaks the run",
      "    return best",
      "# substring = walk the diagonal back from the best cell",
    ],
    scs: [
      "def scs(a, b):",
      "    dp = lcs_table(a, b)                  # filled exactly as in mode 1",
      "    i, j, out = len(a), len(b), []",
      "    while i > 0 and j > 0:",
      "        if a[i - 1] == b[j - 1]:          # shared letter: write it ONCE",
      "            out.append(a[i - 1]); i -= 1; j -= 1",
      "        elif dp[i - 1][j] >= dp[i][j - 1]:  # a[i-1] is not in the LCS",
      "            out.append(a[i - 1]); i -= 1",
      "        else:                              # b[j-1] is not in the LCS",
      "            out.append(b[j - 1]); j -= 1",
      "    out += a[:i][::-1] + b[:j][::-1]      # one side ran out: copy the rest",
      "    return ''.join(reversed(out))",
    ],
  };
  Viz.register("dp-sequences-strings-lcs", (el, opts) => Viz.player(el, {
    title: "LCS table: diagonal on a match, best of up/left on a mismatch",
    tag: "2D TABLE · WALK BACK",
    legend: [["active", "cell being computed"], ["done", "winning move (+1 = matched pair)"], ["visit", "losing move"], ["accent", "best substring end"], ["path", "walk back / letters in the answer"]],
    codeLang: "python",
    code: Array(12).fill(""),
    inputs: [
      { key: "mode", label: "problem", type: "select", value: opts && LCS_MODES.includes(opts.mode) ? opts.mode : LCS_MODES[0], options: LCS_MODES },
      { key: "a", label: "a (≤ 9 letters)", value: (opts && opts.a) || "abcbdab", width: 110 },
      { key: "b", label: "b (≤ 9 letters)", value: (opts && opts.b) || "bdcaba", width: 110 },
    ],
    random: () => ({ a: rw(Viz.rand(4, 8), "abcd"), b: rw(Viz.rand(4, 8), "abcd") }),
    build: ({ mode, a, b }) => {
      const md = mode === LCS_MODES[1] ? "str" : mode === LCS_MODES[2] ? "scs" : "sub";
      setCode(el, LCS_CODE[md]);
      a = word(a, "a", 9); b = word(b, "b", 9);
      const n = a.length, m = b.length, M = table(n + 1, m + 1, null), fr = [];
      for (let i = 0; i <= n; i++) M[i][0] = 0;
      M[0].fill(0);
      let best = null;
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, path: [], ha: {}, hb: {}, out: null, best: best && { ...best }, ...o });
      if (md === "scs") {
        for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) M[i][j] = a[i - 1] === b[j - 1] ? M[i - 1][j - 1] + 1 : Math.max(M[i - 1][j], M[i][j - 1]);
        snap({ note: `Shortest common supersequence = both strings merged so that every <b>shared</b> letter is written once. The letters we can share are exactly an LCS, so first fill the LCS table (mode 1 shows it cell by cell): LCS = ${M[n][m]}, so the answer has ${n} + ${m} − ${M[n][m]} = <b>${n + m - M[n][m]}</b> letters. Now walk back from the corner and <b>write a letter on every move</b>.`, line: 1, vars: { n, m, LCS: M[n][m], "answer length": n + m - M[n][m] } });
      } else {
        snap({ note: `Row 0 and column 0 are the <b>empty prefixes</b>: nothing is common with an empty string, so they are all 0. Cell dp[i][j] will answer the question for the prefixes a[:i] and b[:j] only.`, line: 2, vars: { n, m } });
        for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
          const x = a[i - 1], y = b[j - 1];
          if (x === y) {
            M[i][j] = M[i - 1][j - 1] + 1;
            let extra = "";
            if (md === "str" && (!best || M[i][j] > best.v)) { best = { v: M[i][j], i, j }; extra = ` New best run: <b>${M[i][j]}</b>.`; }
            snap({ cur: [i, j], arrows: [{ from: [i - 1, j - 1], to: [i, j], cls: "done", label: "+1" }], ha: { [i - 1]: "done" }, hb: { [j - 1]: "done" },
              note: md === "str"
                ? `a[${i - 1}] = b[${j - 1}] = '${x}': the common run that ended one step up-left (${M[i - 1][j - 1]} letters) grows by one: dp[${i}][${j}] = <b>${M[i][j]}</b>.${extra}`
                : `a[${i - 1}] = b[${j - 1}] = '${x}': both prefixes end in the same letter, so <b>pair them</b>. Best for the shorter prefixes, dp[${i - 1}][${j - 1}] = ${M[i - 1][j - 1]}, plus this pair: <b>${M[i][j]}</b>. Only the diagonal is needed.`,
              line: md === "str" ? [6, 7, 8] : [5, 6], vars: { i, j, "a[i-1]": x, "b[j-1]": y, "dp[i][j]": M[i][j], ...(md === "str" ? { best: best.v } : {}) } });
          } else if (md === "str") {
            M[i][j] = 0;
            snap({ cur: [i, j], ha: { [i - 1]: "bad" }, hb: { [j - 1]: "bad" }, note: `'${x}' ≠ '${y}': a <b>substring</b> must be contiguous, so any run ending here is broken. dp[${i}][${j}] = <b>0</b> (no arrows: nothing carries over).`, line: 9, vars: { i, j, "a[i-1]": x, "b[j-1]": y, "dp[i][j]": 0, best: best ? best.v : 0 } });
          } else {
            const upv = M[i - 1][j], lfv = M[i][j - 1], upW = upv >= lfv;
            M[i][j] = Math.max(upv, lfv);
            snap({ cur: [i, j], arrows: [{ from: [i - 1, j], to: [i, j], cls: upW ? "done" : "visit" }, { from: [i, j - 1], to: [i, j], cls: upW ? "visit" : "done" }], ha: { [i - 1]: "active" }, hb: { [j - 1]: "active" },
              note: `'${x}' ≠ '${y}': they cannot both be the last pair, so one of them is useless here. Drop a's '${x}' → dp[${i - 1}][${j}] = ${upv} (arrow from above), or drop b's '${y}' → dp[${i}][${j - 1}] = ${lfv} (arrow from the left). Keep the larger: <b>${M[i][j]}</b>${upv === lfv ? " (tie: prefer up)" : ""}.`,
              line: [7, 8, 9], vars: { i, j, "a[i-1]": x, "b[j-1]": y, up: upv, left: lfv, "dp[i][j]": M[i][j] } });
          }
        }
      }
      const path = [], parr = [], ka = {}, kb = {};
      if (md === "str") {
        if (!best) { snap({ ans: 0, sub: "", note: "No letter appears in both strings, so the longest common substring is empty (length <b>0</b>).", line: 10, vars: { answer: 0 } }); return fr.map((f) => ({ ...f, a, b, md })); }
        let { i, j } = best; path.push([i, j]);
        snap({ path: path.slice(), note: `Table complete. Unlike LCS, the answer is <b>not</b> in the corner: it is the largest cell anywhere, dp[${i}][${j}] = ${best.v}. That run ends at a[${i - 1}] and b[${j - 1}]; walk the diagonal back to read it.`, line: 10, vars: { best: best.v, "ends at": `a[${i - 1}], b[${j - 1}]` } });
        while (M[i][j] > 0) { parr.push({ from: [i - 1, j - 1], to: [i, j], cls: "path", label: "+1" }); ka[i - 1] = "path"; kb[j - 1] = "path"; i--; j--; path.push([i, j]); }
        const sub = a.slice(i, best.i);
        snap({ path: path.slice(), arrows: parr.slice(), ha: { ...ka }, hb: { ...kb }, ans: best.v, sub, note: `The diagonal run spells <b>"${sub}"</b> = a[${i}:${best.i}] = b[${j}:${best.j}]. Same table shape as LCS, different rule on a mismatch (reset to 0 instead of max) and a different answer cell (max anywhere instead of the corner).`, line: 11, vars: { answer: best.v, substring: sub } });
        return fr.map((f) => ({ ...f, a, b, md }));
      }
      let i = n, j = m; path.push([i, j]);
      const out = [], lcs = [];
      if (md === "sub") snap({ path: path.slice(), note: `Table complete: LCS length = dp[${n}][${m}] = <b>${M[n][m]}</b>. To read the letters, start at the corner and retrace which arrow produced each cell.`, line: 11, vars: { "dp[n][m]": M[n][m] } });
      while (i > 0 && j > 0) {
        let note, line;
        if (a[i - 1] === b[j - 1]) {
          parr.push({ from: [i - 1, j - 1], to: [i, j], cls: "path", label: "+1" }); ka[i - 1] = "path"; kb[j - 1] = "path";
          lcs.unshift(a[i - 1]); out.unshift({ ch: a[i - 1], k: "s" });
          note = md === "sub" ? `a[${i - 1}] = b[${j - 1}] = '${a[i - 1]}': this cell came from the diagonal, so '${a[i - 1]}' is in the LCS. Move up-left.` : `Shared letter '${a[i - 1]}': write it <b>once</b> and move diagonally.`;
          line = md === "sub" ? 11 : [4, 5]; i--; j--;
        } else if (M[i - 1][j] >= M[i][j - 1]) {
          parr.push({ from: [i - 1, j], to: [i, j], cls: "path" }); if (md === "scs" && !ka[i - 1]) ka[i - 1] = "visit";
          out.unshift({ ch: a[i - 1], k: "a" });
          note = md === "sub" ? `Mismatch; the value came from above (dp[${i - 1}][${j}] = ${M[i - 1][j]} ≥ left ${M[i][j - 1]}), so a's '${a[i - 1]}' was dropped. Move up.` : `'${a[i - 1]}' ≠ '${b[j - 1]}' and the LCS lives above (${M[i - 1][j]} ≥ ${M[i][j - 1]}): a's '${a[i - 1]}' is not shared, so <b>write it</b> and move up.`;
          line = md === "sub" ? 11 : [6, 7]; i--;
        } else {
          parr.push({ from: [i, j - 1], to: [i, j], cls: "path" }); if (md === "scs" && !kb[j - 1]) kb[j - 1] = "visit";
          out.unshift({ ch: b[j - 1], k: "b" });
          note = md === "sub" ? `Mismatch; the left neighbour is larger (${M[i][j - 1]} > ${M[i - 1][j]}), so b's '${b[j - 1]}' was dropped. Move left.` : `'${a[i - 1]}' ≠ '${b[j - 1]}' and the LCS lives to the left: b's '${b[j - 1]}' is not shared, so <b>write it</b> and move left.`;
          line = md === "sub" ? 11 : [8, 9]; j--;
        }
        path.push([i, j]);
        snap({ path: path.slice(), arrows: parr.slice(), ha: { ...ka }, hb: { ...kb }, out: md === "scs" ? out.slice() : null, note, line, vars: md === "sub" ? { i, j, lcs: lcs.join("") || "—" } : { i, j, out: out.map((o) => o.ch).join("") } });
      }
      if (md === "sub") {
        snap({ path: path.slice(), arrows: parr.slice(), ha: { ...ka }, hb: { ...kb }, ans: M[n][m], lcs: lcs.join(""), note: `Reached an edge: done. One LCS is <b>"${lcs.join("")}"</b> (length ${M[n][m]}). Ties can produce other, equally long answers. Time O(n·m); one-row space O(min(n, m)) if you only need the length.`, line: 10, vars: { answer: M[n][m], lcs: lcs.join("") } });
      } else {
        const rest = i > 0 ? "a" : j > 0 ? "b" : "";
        while (i > 0) { parr.push({ from: [i - 1, 0], to: [i, 0], cls: "path" }); ka[i - 1] = "visit"; out.unshift({ ch: a[i - 1], k: "a" }); i--; path.push([i, 0]); }
        while (j > 0) { parr.push({ from: [0, j - 1], to: [0, j], cls: "path" }); kb[j - 1] = "visit"; out.unshift({ ch: b[j - 1], k: "b" }); j--; path.push([0, j]); }
        const s = out.map((o) => o.ch).join("");
        snap({ path: path.slice(), arrows: parr.slice(), ha: { ...ka }, hb: { ...kb }, out: out.slice(), ans: s, note: `${rest ? `One string ran out, so copy what is left of ${rest} along the border. ` : ""}Supersequence <b>"${s}"</b>: ${s.length} = ${n} + ${m} − ${M[n][m]} letters. Purple letters were shared (the LCS) and written once; every other letter appears exactly where its own string needs it.`, line: [10, 11], vars: { answer: s, length: s.length } });
      }
      return fr.map((f) => ({ ...f, a, b, md }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = keyset(f.path);
      const g = dgrid(f.M, {
        label: f.md === "str" ? "dp[i][j] = length of the common run ending at a[i-1] and b[j-1]" : "dp[i][j] = LCS length of the prefixes a[:i] and b[:j]",
        size: 38, gap: 14, colLabels: lab(f.b), rowLabels: lab(f.a), rowLabelW: 40, arrows: f.arrows,
        cls: (r, c, v) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (src.has(`${r},${c}`)) return `${src.get(`${r},${c}`)} dep`;
          if (onPath.has(`${r},${c}`)) return "path";
          if (f.best && f.best.i === r && f.best.j === c) return "accent";
          if (f.md === "str" && v === 0 && r > 0 && c > 0) return "dim";
          return "";
        },
      });
      const strs = `<div class="dss-row">${chars(f.a, (k) => f.ha[k], "a (rows)")}${chars(f.b, (k) => f.hb[k], "b (columns)")}</div>`;
      const out = f.out ? chars(f.out.map((o) => o.ch).join(""), (k) => (f.out[k].k === "s" ? "path" : ""), "supersequence so far (purple = shared, written once)", { showIdx: false }) : "";
      return `<div class="dss-col">${strs}${g}${out}</div>`;
    },
  }));

  /* ================= 2. Edit distance with the alignment it produces ================= */
  const ED_CODE = [
    "def min_distance(a, b):",
    "    n, m = len(a), len(b)",
    "    dp = [[0] * (m + 1) for _ in range(n + 1)]",
    "    for i in range(n + 1): dp[i][0] = i      # delete all of a[:i]",
    "    for j in range(m + 1): dp[0][j] = j      # insert all of b[:j]",
    "    for i in range(1, n + 1):",
    "        for j in range(1, m + 1):",
    "            if a[i - 1] == b[j - 1]:",
    "                dp[i][j] = dp[i - 1][j - 1]       # letters agree: free",
    "            else:",
    "                dp[i][j] = 1 + min(dp[i - 1][j - 1],  # replace a[i-1] by b[j-1]",
    "                                   dp[i - 1][j],      # delete a[i-1]",
    "                                   dp[i][j - 1])      # insert b[j-1]",
    "    return dp[n][m]",
  ];
  const OPC = { "=": "eq", R: "rep", D: "del", I: "ins" }, OPN = { "=": "keep", R: "replace", D: "delete", I: "insert" };
  const alignHtml = (cols, label) => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="dss-align">${cols.length ? cols.map((c) => `<div class="dss-acol ${OPC[c.op]}"><span>${esc(c.t)}</span><span>${esc(c.b)}</span><small>${OPN[c.op]}</small></div>`).join("") : '<span class="dss-more">empty</span>'}</div></div>`;
  Viz.register("dp-sequences-strings-edit", (el, opts) => Viz.player(el, {
    title: "Edit distance: three arrows into every cell, one alignment out",
    tag: "2D TABLE · ALIGNMENT",
    legend: [["active", "cell being computed"], ["done", "cheapest move"], ["visit", "more expensive move"], ["path", "walk back = the edit script"]],
    codeLang: "python",
    code: ED_CODE,
    inputs: [
      { key: "a", label: "from a (≤ 9)", value: (opts && opts.a) || "horse", width: 110 },
      { key: "b", label: "to b (≤ 9)", value: (opts && opts.b) || "ros", width: 110 },
    ],
    random: () => ({ a: rw(Viz.rand(3, 7), "abcde"), b: rw(Viz.rand(3, 7), "abcde") }),
    build: ({ a, b }) => {
      a = word(a, "a", 9, 0); b = word(b, "b", 9, 0);
      const n = a.length, m = b.length, M = table(n + 1, m + 1, null), fr = [];
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, path: [], ha: {}, hb: {}, cols: null, ...o });
      for (let i = 0; i <= n; i++) M[i][0] = i;
      snap({ note: `Column 0: turning a[:i] into the empty string takes <b>i deletions</b>. Each cell answers "cheapest way to turn a[:i] into b[:j]".`, line: 3, vars: { n, m } });
      for (let j = 0; j <= m; j++) M[0][j] = j;
      snap({ note: `Row 0: building b[:j] from nothing takes <b>j insertions</b>. These borders are the base cases every other cell eventually leans on.`, line: 4, vars: { n, m } });
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        const x = a[i - 1], y = b[j - 1];
        if (x === y) {
          M[i][j] = M[i - 1][j - 1];
          snap({ cur: [i, j], arrows: [{ from: [i - 1, j - 1], to: [i, j], cls: "done", label: "=" }], ha: { [i - 1]: "done" }, hb: { [j - 1]: "done" }, note: `'${x}' = '${y}': keep the letter for free. Cost = whatever it took to align the shorter prefixes, dp[${i - 1}][${j - 1}] = <b>${M[i][j]}</b>.`, line: [7, 8], vars: { i, j, "a[i-1]": x, "b[j-1]": y, "dp[i][j]": M[i][j] } });
        } else {
          const rv = M[i - 1][j - 1], dv = M[i - 1][j], iv = M[i][j - 1], mn = Math.min(rv, dv, iv);
          const win = rv === mn ? "R" : dv === mn ? "D" : "I";
          M[i][j] = 1 + mn;
          snap({ cur: [i, j], ha: { [i - 1]: "active" }, hb: { [j - 1]: "active" },
            arrows: [{ from: [i - 1, j - 1], to: [i, j], cls: win === "R" ? "done" : "visit", label: "rep" }, { from: [i - 1, j], to: [i, j], cls: win === "D" ? "done" : "visit", label: "del" }, { from: [i, j - 1], to: [i, j], cls: win === "I" ? "done" : "visit", label: "ins", labelAt: 0.45 }],
            note: `'${x}' ≠ '${y}': pay 1 for the last edit. <b>Replace</b> '${x}'→'${y}' (diagonal, ${rv}), <b>delete</b> '${x}' (from above, ${dv}), or <b>insert</b> '${y}' (from the left, ${iv}). Cheapest: ${OPN[win]}, so dp[${i}][${j}] = 1 + ${mn} = <b>${M[i][j]}</b>.`,
            line: [9, 10, 11, 12], vars: { i, j, "a[i-1]": x, "b[j-1]": y, rep: rv, del: dv, ins: iv, "dp[i][j]": M[i][j] } });
        }
      }
      let i = n, j = m;
      const path = [[i, j]], parr = [], cols = [], ka = {}, kb = {};
      snap({ path: path.slice(), cols: [], note: `Distance = dp[${n}][${m}] = <b>${M[n][m]}</b>. Walk back from the corner to recover <i>which</i> edits: every move you retrace becomes one column of the alignment below.`, line: 13, vars: { distance: M[n][m] } });
      while (i > 0 || j > 0) {
        let op, note;
        if (i > 0 && j > 0 && a[i - 1] === b[j - 1] && M[i][j] === M[i - 1][j - 1]) {
          op = "="; parr.push({ from: [i - 1, j - 1], to: [i, j], cls: "path", label: "=" }); cols.unshift({ t: a[i - 1], b: b[j - 1], op }); ka[i - 1] = "done"; kb[j - 1] = "done";
          note = `'${a[i - 1]}' = '${b[j - 1]}' and the value did not change: a free <b>keep</b>. Move diagonally.`; i--; j--;
        } else if (i > 0 && j > 0 && M[i][j] === M[i - 1][j - 1] + 1) {
          op = "R"; parr.push({ from: [i - 1, j - 1], to: [i, j], cls: "path", label: "rep" }); cols.unshift({ t: a[i - 1], b: b[j - 1], op }); ka[i - 1] = "active"; kb[j - 1] = "active";
          note = `${M[i][j]} = 1 + diagonal ${M[i - 1][j - 1]}: <b>replace</b> '${a[i - 1]}' with '${b[j - 1]}'.`; i--; j--;
        } else if (i > 0 && M[i][j] === M[i - 1][j] + 1) {
          op = "D"; parr.push({ from: [i - 1, j], to: [i, j], cls: "path", label: "del" }); cols.unshift({ t: a[i - 1], b: "-", op }); ka[i - 1] = "bad";
          note = `${M[i][j]} = 1 + above ${M[i - 1][j]}: <b>delete</b> '${a[i - 1]}' (it lines up with a gap in b).`; i--;
        } else {
          op = "I"; parr.push({ from: [i, j - 1], to: [i, j], cls: "path", label: "ins" }); cols.unshift({ t: "-", b: b[j - 1], op }); kb[j - 1] = "visit";
          note = `${M[i][j]} = 1 + left ${M[i][j - 1]}: <b>insert</b> '${b[j - 1]}' (a gap in a lines up with it).`; j--;
        }
        path.push([i, j]);
        snap({ path: path.slice(), arrows: parr.slice(), cols: cols.slice(), ha: { ...ka }, hb: { ...kb }, note, line: 13, vars: { i, j, op: OPN[op], edits: cols.filter((c) => c.op !== "=").length } });
      }
      const ed = cols.filter((c) => c.op !== "=").length;
      snap({ path: path.slice(), arrows: parr.slice(), cols: cols.slice(), ha: { ...ka }, hb: { ...kb }, ans: M[n][m], note: `Back at (0, 0). The alignment reads top = a, bottom = b; ${ed} non-keep column${ed === 1 ? "" : "s"} = distance <b>${M[n][m]}</b>. A diagonal is keep/replace, a vertical step deletes from a, a horizontal step inserts from b. Time O(n·m), space O(m) with two rows.`, line: 13, vars: { distance: M[n][m], columns: cols.length } });
      return fr.map((f) => ({ ...f, a, b }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = keyset(f.path);
      const g = dgrid(f.M, {
        label: "dp[i][j] = fewest edits turning a[:i] into b[:j]", size: 38, gap: 18, colLabels: lab(f.b), rowLabels: lab(f.a), rowLabelW: 40, arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : onPath.has(`${r},${c}`) ? "path" : ""),
      });
      const strs = `<div class="dss-row">${chars(f.a, (k) => f.ha[k], "a (rows) → transform")}${chars(f.b, (k) => f.hb[k], "b (columns) = target")}</div>`;
      return `<div class="dss-col">${strs}${g}${f.cols ? alignHtml(f.cols, "alignment (top = a, bottom = b)") : ""}</div>`;
    },
  }));

  /* ================= 3. Distinct subsequences (115): counting, so the arrows ADD ================= */
  const DS_CODE = [
    "def num_distinct(s, t):",
    "    n, m = len(s), len(t)",
    "    dp = [[0] * (m + 1) for _ in range(n + 1)]",
    "    for i in range(n + 1): dp[i][0] = 1      # empty t: one way (pick nothing)",
    "    for i in range(1, n + 1):",
    "        for j in range(1, m + 1):",
    "            dp[i][j] = dp[i - 1][j]          # ways that SKIP s[i-1]",
    "            if s[i - 1] == t[j - 1]:",
    "                dp[i][j] += dp[i - 1][j - 1] # ways that USE s[i-1] as t[j-1]",
    "    return dp[n][m]",
  ];
  const waysOf = (s, t, cap) => {
    const res = []; let total = 0;
    const go = (i, j, pick) => { if (j === t.length) { total++; if (res.length < cap) res.push(pick.slice()); return; } for (let k = i; k <= s.length - (t.length - j); k++) if (s[k] === t[j]) { pick.push(k); go(k + 1, j + 1, pick); pick.pop(); } };
    go(0, 0, []); return { res, total };
  };
  Viz.register("dp-sequences-strings-distinct", (el, opts) => Viz.player(el, {
    title: "Distinct subsequences: counting cells add their arrows instead of taking a max",
    tag: "COUNTING TABLE",
    legend: [["active", "cell being computed"], ["done", "contributing source"], ["visit", "source that cannot contribute"], ["path", "letters picked by one way"]],
    codeLang: "python",
    code: DS_CODE,
    inputs: [
      { key: "s", label: "s (≤ 10)", value: (opts && opts.s) || "babgbag", width: 110 },
      { key: "t", label: "t (≤ 4)", value: (opts && opts.t) || "bag", width: 70 },
    ],
    random: () => ({ s: rw(Viz.rand(6, 10), "abg"), t: rw(Viz.rand(2, 3), "abg") }),
    build: ({ s, t }) => {
      s = word(s, "s", 10); t = word(t, "t", 4);
      const n = s.length, m = t.length, M = table(n + 1, m + 1, null), fr = [];
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, hs: {}, ht: {}, ways: null, ...o });
      for (let i = 0; i <= n; i++) M[i][0] = 1;
      for (let j = 1; j <= m; j++) M[0][j] = 0;
      snap({ note: `Column 0 is all <b>1</b>: there is exactly one way to form the empty t (pick nothing). Row 0 is 0 beyond that: an empty s cannot form a non-empty t. dp[i][j] counts the ways to pick t[:j] out of s[:i].`, line: 3, vars: { n, m } });
      for (let i = 1; i <= n; i++) for (let j = 1; j <= m; j++) {
        const x = s[i - 1], y = t[j - 1], sk = M[i - 1][j];
        if (x === y) {
          const us = M[i - 1][j - 1];
          M[i][j] = sk + us;
          snap({ cur: [i, j], arrows: [{ from: [i - 1, j], to: [i, j], cls: sk ? "done" : "visit", label: "skip" }, { from: [i - 1, j - 1], to: [i, j], cls: us ? "done" : "visit", label: "use", labelAt: 0.4 }], hs: { [i - 1]: "done" }, ht: { [j - 1]: "done" },
            note: `s[${i - 1}] = '${x}' = t[${j - 1}]. Every way either <b>skips</b> this letter (${sk} ways that already formed t[:${j}] from s[:${i - 1}]) or <b>uses</b> it as the last letter of t[:${j}] (${us} ways that formed t[:${j - 1}] first). The two groups never overlap, so <b>add</b>: ${sk} + ${us} = <b>${M[i][j]}</b>.`,
            line: [6, 7, 8], vars: { i, j, "s[i-1]": x, "t[j-1]": y, skip: sk, use: us, "dp[i][j]": M[i][j] } });
        } else {
          M[i][j] = sk;
          snap({ cur: [i, j], arrows: [{ from: [i - 1, j], to: [i, j], cls: sk ? "done" : "visit", label: "skip" }], hs: { [i - 1]: "active" }, ht: { [j - 1]: "active" },
            note: `'${x}' ≠ '${y}': this letter cannot play t[${j - 1}], so every way must skip it: dp[${i}][${j}] = dp[${i - 1}][${j}] = <b>${sk}</b>.`, line: 6, vars: { i, j, "s[i-1]": x, "t[j-1]": y, skip: sk, "dp[i][j]": sk } });
        }
      }
      const { res, total } = waysOf(s, t, 8);
      snap({ ans: M[n][m], ways: res, total, cur: [n, m], note: `dp[${n}][${m}] = <b>${M[n][m]}</b> ways. Brute force agrees: the chips list ${res.length < total ? `the first ${res.length} of ${total}` : `all ${total}`} index choices (bold letters are the picked ones). The table counted them without listing a single one.`, line: 9, vars: { answer: M[n][m], listed: res.length } });
      return fr.map((f) => ({ ...f, s, t }));
    },
    render: (f) => {
      const src = srcMap(f.arrows);
      const g = dgrid(f.M, {
        label: "dp[i][j] = ways to pick t[:j] as a subsequence of s[:i]", size: 38, gap: 16, colLabels: lab(f.t), rowLabels: lab(f.s), rowLabelW: 40, arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[0] === r && f.cur[1] === c ? (f.ways ? "path" : "active") : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : ""),
      });
      const strs = `<div class="dss-row">${chars(f.s, (k) => f.hs[k], "s (rows)")}${chars(f.t, (k) => f.ht[k], "t (columns)")}</div>`;
      const ways = f.ways ? `<div class="v-labeled"><span class="v-caption">ways (bold = picked letters)</span><div class="dss-chips">${f.ways.map((w) => { const set = new Set(w); return `<span class="dss-way">${[...f.s].map((ch, k) => (set.has(k) ? `<b>${esc(ch)}</b>` : `<i>${esc(ch)}</i>`)).join("")}</span>`; }).join("")}${f.total > f.ways.length ? `<span class="dss-more">+${f.total - f.ways.length} more</span>` : ""}${f.total ? "" : '<span class="dss-more">no way</span>'}</div></div>` : "";
      return `<div class="dss-col">${strs}<div class="dss-row">${g}${ways}</div></div>`;
    },
  }));

  /* ================= 4. Interleaving string (97): a boolean grid, path = the weave ================= */
  const IL_CODE = [
    "def is_interleave(s1, s2, s3):",
    "    n, m = len(s1), len(s2)",
    "    if n + m != len(s3): return False",
    "    dp = [[False] * (m + 1) for _ in range(n + 1)]",
    "    dp[0][0] = True                        # empty + empty makes empty",
    "    for i in range(n + 1):",
    "        for j in range(m + 1):",
    "            k = i + j - 1                  # the s3 letter cell (i, j) must place",
    "            if i > 0 and dp[i - 1][j] and s1[i - 1] == s3[k]:",
    "                dp[i][j] = True            # ...taken from s1 (arrow down)",
    "            if j > 0 and dp[i][j - 1] and s2[j - 1] == s3[k]:",
    "                dp[i][j] = True            # ...taken from s2 (arrow right)",
    "    return dp[n][m]",
  ];
  Viz.register("dp-sequences-strings-interleave", (el, opts) => Viz.player(el, {
    title: "Interleaving string: a monotone path of T cells is a valid weave",
    tag: "BOOLEAN GRID · PATH",
    legend: [["active", "cell being computed"], ["done", "letter fits and source is T"], ["visit", "letter fits but source is F"], ["bad", "letter does not fit"], ["accent", "T = reachable"], ["path", "the weave"]],
    codeLang: "python",
    code: IL_CODE,
    inputs: [
      { key: "s1", label: "s1 (≤ 6)", value: (opts && opts.s1) || "aabcc", width: 80 },
      { key: "s2", label: "s2 (≤ 6)", value: (opts && opts.s2) || "dbbca", width: 80 },
      { key: "s3", label: "s3", value: (opts && opts.s3) || "aadbbcbcac", width: 130 },
    ],
    random: () => {
      const s1 = rw(Viz.rand(3, 5), "ab"), s2 = rw(Viz.rand(3, 5), "ab");
      let i = 0, j = 0, s3 = "";
      while (i < s1.length || j < s2.length) s3 += (j >= s2.length || (i < s1.length && Math.random() < 0.5)) ? s1[i++] : s2[j++];
      if (Math.random() < 0.4) { const k = Viz.rand(0, s3.length - 1); s3 = s3.slice(0, k) + (s3[k] === "a" ? "b" : "a") + s3.slice(k + 1); }
      return { s1, s2, s3 };
    },
    build: ({ s1, s2, s3 }) => {
      s1 = word(s1, "s1", 6, 0); s2 = word(s2, "s2", 6, 0); s3 = word(s3, "s3", 12, 0);
      const n = s1.length, m = s2.length, fr = [];
      if (n + m !== s3.length) return [{ M: [[null]], arrows: [], cur: null, path: [], s1, s2, s3, own: null, k: -1, ans: false, note: `len(s1) + len(s2) = ${n} + ${m} = ${n + m}, but len(s3) = ${s3.length}. Every letter of s3 must come from exactly one of them, so the answer is <b>False</b> before any table is built. (Try matching lengths to see the grid.)`, line: 2, vars: { "n+m": n + m, "len(s3)": s3.length, answer: false } }];
      const M = table(n + 1, m + 1, null);
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, path: [], own: null, k: -1, h1: {}, h2: {}, ...o });
      for (let i = 0; i <= n; i++) for (let j = 0; j <= m; j++) {
        if (i === 0 && j === 0) { M[0][0] = true; snap({ cur: [0, 0], note: `Cell (i, j) asks: can s1[:i] and s2[:j] be woven into s3[:i+j]? (0, 0) is <b>T</b>: two empty strings make the empty prefix. Moving <b>down</b> spends a letter of s1, moving <b>right</b> spends a letter of s2.`, line: 4, vars: { "n+m": n + m } }); continue; }
        const k = i + j - 1, arrows = [];
        let v = false;
        const parts = [];
        if (i > 0) {
          const fits = s1[i - 1] === s3[k], src = M[i - 1][j];
          arrows.push({ from: [i - 1, j], to: [i, j], cls: !fits ? "bad" : src ? "done" : "visit", label: s1[i - 1] });
          if (fits && src) v = true;
          parts.push(`from above: s1's '${s1[i - 1]}' ${fits ? "=" : "≠"} s3[${k}] = '${s3[k]}'${fits ? (src ? " and (" + (i - 1) + ", " + j + ") is T ✓" : ", but (" + (i - 1) + ", " + j + ") is F") : ""}`);
        }
        if (j > 0) {
          const fits = s2[j - 1] === s3[k], src = M[i][j - 1];
          arrows.push({ from: [i, j - 1], to: [i, j], cls: !fits ? "bad" : src ? "done" : "visit", label: s2[j - 1] });
          if (fits && src) v = true;
          parts.push(`from the left: s2's '${s2[j - 1]}' ${fits ? "=" : "≠"} s3[${k}] = '${s3[k]}'${fits ? (src ? " and (" + i + ", " + (j - 1) + ") is T ✓" : ", but (" + i + ", " + (j - 1) + ") is F") : ""}`);
        }
        M[i][j] = v;
        snap({ cur: [i, j], arrows, k, h1: i > 0 ? { [i - 1]: "active" } : {}, h2: j > 0 ? { [j - 1]: "active" } : {}, note: `Cell (${i}, ${j}) must place s3[${k}] = '${s3[k]}'. ${parts.join("; ")}. So dp[${i}][${j}] = <b>${v ? "T" : "F"}</b>.`, line: [7, 8, 9, 10, 11], vars: { i, j, k, "s3[k]": s3[k], "dp[i][j]": v } });
      }
      const ok = M[n][m];
      if (!ok) { snap({ ans: false, note: `dp[${n}][${m}] = <b>F</b>: no chain of T cells reaches the corner, so s3 is <b>not</b> an interleaving. Every T cell is a partial weave that worked; they all got stuck.`, line: 12, vars: { answer: false } }); return fr.map((f) => ({ ...f, s1, s2, s3 })); }
      let i = n, j = m;
      const path = [[i, j]], parr = [], own = Array(n + m).fill(0);
      snap({ path: path.slice(), own: own.slice(), note: `dp[${n}][${m}] = <b>T</b>. Walk back through T cells: each vertical step says "this s3 letter came from s1", each horizontal step "from s2".`, line: 12, vars: { answer: true } });
      while (i > 0 || j > 0) {
        const k = i + j - 1;
        if (i > 0 && M[i - 1][j] && s1[i - 1] === s3[k]) { own[k] = 1; parr.push({ from: [i - 1, j], to: [i, j], cls: "path", label: s1[i - 1] }); i--; }
        else { own[k] = 2; parr.push({ from: [i, j - 1], to: [i, j], cls: "path", label: s2[j - 1] }); j--; }
        path.push([i, j]);
        snap({ path: path.slice(), arrows: parr.slice(), own: own.slice(), k, note: `s3[${k}] = '${s3[k]}' comes from <b>${own[k] === 1 ? "s1" : "s2"}</b> (step ${own[k] === 1 ? "up" : "left"} to (${i}, ${j})).`, line: own[k] === 1 ? [8, 9] : [10, 11], vars: { i, j, k } });
      }
      snap({ path: path.slice(), arrows: parr.slice(), own: own.slice(), ans: true, note: `The weave: top row takes s1's letters in order, bottom row s2's letters in order, and together they spell s3. Time O(n·m); one row of booleans is enough for the yes/no answer.`, line: 12, vars: { answer: true } });
      return fr.map((f) => ({ ...f, s1, s2, s3 }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = keyset(f.path);
      const g = dgrid(f.M, {
        label: "dp[i][j]: can s1[:i] + s2[:j] weave into s3[:i+j]?", size: 38, gap: 16, colLabels: lab(f.s2), rowLabels: lab(f.s1), rowLabelW: 40, arrows: f.arrows,
        cls: (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : onPath.has(`${r},${c}`) ? "path" : v === true ? "accent" : v === false ? "dim" : ""),
      });
      const strs = `<div class="dss-row">${chars(f.s1, (k) => (f.h1 || {})[k], "s1 (rows)")}${chars(f.s2, (k) => (f.h2 || {})[k], "s2 (columns)")}${chars(f.s3, (k) => (k === f.k ? "active" : ""), "s3")}</div>`;
      const weave = f.own ? Viz.grid([[...f.s3].map((ch, k) => (f.own[k] === 1 ? ch : "")), [...f.s3].map((ch, k) => (f.own[k] === 2 ? ch : ""))], { label: "the weave", rowLabels: ["from s1", "from s2"], colLabels: [...f.s3].map((ch, k) => `${k}:${ch}`), cls: (r, c) => (f.own[c] === r + 1 ? (r ? "visit" : "done") : "") }) : "";
      return `<div class="dss-col">${strs}${g}${weave}</div>`;
    },
  }));

  /* ================= 5. Palindromes on an interval table: LPS (516) and pal[i][j] (5, 647) ================= */
  const PAL_MODES = ["subsequence (516)", "substring (5, 647)"];
  const PAL_CODE = {
    seq: [
      "def longest_palindrome_subseq(s):",
      "    n = len(s)",
      "    dp = [[0] * n for _ in range(n)]          # dp[i][j]: best inside s[i..j]",
      "    for i in range(n): dp[i][i] = 1           # one letter is a palindrome",
      "    for length in range(2, n + 1):            # fill by interval LENGTH",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            if s[i] == s[j]:",
      "                dp[i][j] = dp[i + 1][j - 1] + 2  # wrap the inside with s[i], s[j]",
      "            else:",
      "                dp[i][j] = max(dp[i + 1][j], dp[i][j - 1])  # drop one end",
      "    return dp[0][n - 1]",
      "# rebuild: equal ends -> keep both, step inside; else follow the larger",
    ],
    sub: [
      "def palindromic_substrings(s):",
      "    n = len(s)",
      "    pal = [[False] * n for _ in range(n)]     # pal[i][j]: is s[i..j] a palindrome?",
      "    best, count = (0, 0), 0",
      "    for length in range(1, n + 1):",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            pal[i][j] = s[i] == s[j] and (length <= 2 or pal[i + 1][j - 1])",
      "            if pal[i][j]:",
      "                count += 1                     # LC 647 counts these",
      "                best = (i, j)                  # LC 5: longer lengths come later",
      "    return s[best[0]:best[1] + 1], count",
    ],
  };
  const lab0 = (s) => [...s].map((ch, k) => `${k}:${ch}`);
  Viz.register("dp-sequences-strings-palin", (el, opts) => Viz.player(el, {
    title: "Palindromes on the interval table: fill by length, read from the inside out",
    tag: "INTERVAL DP",
    legend: [["active", "interval being computed"], ["done", "winning / valid source"], ["visit", "losing source"], ["bad", "inside is not a palindrome"], ["accent", "palindrome (T)"], ["path", "answer"]],
    codeLang: "python",
    code: Array(13).fill(""),
    inputs: [
      { key: "mode", label: "problem", type: "select", value: opts && PAL_MODES.includes(opts.mode) ? opts.mode : PAL_MODES[0], options: PAL_MODES },
      { key: "s", label: "s (≤ 10)", value: (opts && opts.s) || "bbbab", width: 110 },
    ],
    random: () => ({ s: rw(Viz.rand(5, 9), "abc") }),
    build: ({ mode, s }) => {
      const seq = mode !== PAL_MODES[1];
      setCode(el, seq ? PAL_CODE.seq : PAL_CODE.sub);
      s = word(s, "s", 10);
      const n = s.length, M = table(n, n, null), fr = [];
      let count = 0, best = [0, 0];
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, path: [], hs: {}, ...o });
      for (let i = 0; i < n; i++) M[i][i] = seq ? 1 : true;
      count = n;
      snap({ note: seq ? `dp[i][j] = longest palindromic <b>subsequence</b> inside s[i..j]. Only i ≤ j makes sense, so only the upper triangle exists. The diagonal is length-1 intervals: every single letter is a palindrome of length <b>1</b>. Longer intervals depend on <b>shorter</b> ones, so fill diagonal by diagonal.` : `pal[i][j] = is s[i..j] a palindrome? Every single letter is (the diagonal is all <b>T</b>), so count starts at ${n}. Longer intervals need the interval one step <b>inside</b> them, so fill by length.`, line: seq ? 3 : [4, 7, 9], vars: seq ? { n } : { n, count } });
      for (let len = 2; len <= n; len++) for (let i = 0; i + len - 1 < n; i++) {
        const j = i + len - 1, eq = s[i] === s[j];
        const hs = { [i]: eq ? "done" : "active", [j]: eq ? "done" : "active" };
        for (let k = i + 1; k < j; k++) hs[k] = "window";
        if (seq) {
          if (eq) {
            const inner = len === 2 ? 0 : M[i + 1][j - 1];
            M[i][j] = inner + 2;
            snap({ cur: [i, j], hs, arrows: len === 2 ? [] : [{ from: [i + 1, j - 1], to: [i, j], cls: "done", label: "+2" }], note: `s[${i}] = s[${j}] = '${s[i]}': both ends can wrap the best palindrome inside. ${len === 2 ? "The inside is empty (0)" : `Inside s[${i + 1}..${j - 1}] the best is dp[${i + 1}][${j - 1}] = ${inner}`}, so dp[${i}][${j}] = ${inner} + 2 = <b>${M[i][j]}</b>.`, line: [6, 7, 8], vars: { length: len, i, j, "s[i]": s[i], "s[j]": s[j], "dp[i][j]": M[i][j] } });
          } else {
            const dn = M[i + 1][j], lf = M[i][j - 1], dW = dn >= lf;
            M[i][j] = Math.max(dn, lf);
            snap({ cur: [i, j], hs, arrows: [{ from: [i + 1, j], to: [i, j], cls: dW ? "done" : "visit", label: `-${s[i]}` }, { from: [i, j - 1], to: [i, j], cls: dW ? "visit" : "done", label: `-${s[j]}` }], note: `'${s[i]}' ≠ '${s[j]}': they cannot both be the outer pair, so drop one end. Drop s[${i}] → dp[${i + 1}][${j}] = ${dn} (cell below); drop s[${j}] → dp[${i}][${j - 1}] = ${lf} (cell to the left). Max = <b>${M[i][j]}</b>.`, line: [9, 10], vars: { length: len, i, j, "s[i]": s[i], "s[j]": s[j], below: dn, left: lf, "dp[i][j]": M[i][j] } });
          }
        } else {
          const inner = len <= 2 ? true : M[i + 1][j - 1], v = eq && inner;
          M[i][j] = v;
          if (v) { count++; best = [i, j]; }
          snap({ cur: [i, j], hs, arrows: eq && len > 2 ? [{ from: [i + 1, j - 1], to: [i, j], cls: inner ? "done" : "bad", label: "inside" }] : [], note: !eq ? `'${s[i]}' ≠ '${s[j]}': the ends differ, so s[${i}..${j}] is <b>not</b> a palindrome (no need to look inside).` : len === 2 ? `Two equal letters '${s[i]}${s[j]}': a palindrome (<b>T</b>). count = ${count}.` : inner ? `Ends match ('${s[i]}') and the inside s[${i + 1}..${j - 1}] is a palindrome: <b>T</b>. count = ${count}${best[0] === i && best[1] === j ? `, new longest "${s.slice(i, j + 1)}"` : ""}.` : `Ends match ('${s[i]}') but the inside s[${i + 1}..${j - 1}] is not a palindrome, so neither is this: <b>F</b>.`, line: v ? [5, 6, 7, 8, 9, 10] : [5, 6, 7], vars: { length: len, i, j, "pal[i][j]": v, count, best: s.slice(best[0], best[1] + 1) } });
        }
      }
      if (seq) {
        let i = 0, j = n - 1;
        const path = [[i, j]], parr = [], pick = new Set();
        snap({ path: path.slice(), note: `Answer: dp[0][${n - 1}] = <b>${M[0][n - 1]}</b>. To read the palindrome, start at the top-right corner and retrace the arrows inward.`, line: 11, vars: { answer: M[0][n - 1] } });
        while (i <= j) {
          let note;
          if (i === j) { pick.add(i); note = `Single letter s[${i}] = '${s[i]}' sits in the middle.`; i++; }
          else if (s[i] === s[j]) { pick.add(i); pick.add(j); note = `Ends match: keep s[${i}] and s[${j}] ('${s[i]}') as an outer pair.`; if (j - i >= 2) parr.push({ from: [i + 1, j - 1], to: [i, j], cls: "path", label: "+2" }); i++; j--; }
          else if (M[i + 1][j] >= M[i][j - 1]) { parr.push({ from: [i + 1, j], to: [i, j], cls: "path" }); note = `Value came from below: s[${i}] = '${s[i]}' was dropped.`; i++; }
          else { parr.push({ from: [i, j - 1], to: [i, j], cls: "path" }); note = `Value came from the left: s[${j}] = '${s[j]}' was dropped.`; j--; }
          if (i <= j) path.push([i, j]);
          const hs = {}; pick.forEach((k) => { hs[k] = "path"; });
          snap({ path: path.slice(), arrows: parr.slice(), hs, note, line: 12, vars: { i, j, kept: pick.size } });
        }
        const res = [...pick].sort((x, y) => x - y).map((k) => s[k]).join("");
        const hs = {}; pick.forEach((k) => { hs[k] = "path"; });
        snap({ path: path.slice(), arrows: parr.slice(), hs, ans: M[0][n - 1], res, note: `Longest palindromic subsequence: <b>"${res}"</b> (length ${res.length}), the purple letters, read left to right. Equivalent view: it is the LCS of s and reversed(s). O(n²) time and space.`, line: 11, vars: { answer: M[0][n - 1], palindrome: res } });
      } else {
        const res = s.slice(best[0], best[1] + 1), hs = {};
        for (let k = best[0]; k <= best[1]; k++) hs[k] = "path";
        snap({ path: [best], hs, ans: res, count, note: `Done. <b>${count}</b> palindromic substrings (every T cell, LC 647); the longest is <b>"${res}"</b> = s[${best[0]}..${best[1]}] (LC 5). O(n²) time and space; expand-around-center (next visualizer) gets the same in O(1) space, Manacher in O(n).`, line: 11, vars: { longest: res, count } });
      }
      return fr.map((f) => ({ ...f, s, seq }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = keyset(f.path);
      const g = dgrid(f.M, {
        label: f.seq ? "dp[i][j] = longest palindromic subsequence in s[i..j] (row i, column j)" : "pal[i][j]: is s[i..j] a palindrome? (row i, column j)", size: 38, gap: 16, colLabels: lab0(f.s), rowLabels: lab0(f.s), rowLabelW: 40, arrows: f.arrows,
        skip: (r, c) => r > c,
        cls: (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : onPath.has(`${r},${c}`) ? "path" : v === true ? "accent" : v === false ? "dim" : ""),
      });
      return `<div class="dss-col">${chars(f.s, (k) => f.hs[k], "s (window = the interval)")}${g}</div>`;
    },
  }));

  /* ================= 6. Expand around center: 2n − 1 centres, O(1) space ================= */
  const EX_CODE = [
    "def count_and_longest(s):",
    "    n, count, best = len(s), 0, (0, 0)",
    "    for c in range(2 * n - 1):             # n letter centres + (n - 1) gap centres",
    "        lo, hi = c // 2, (c + 1) // 2      # odd length: lo == hi; even: hi == lo + 1",
    "        while lo >= 0 and hi < n and s[lo] == s[hi]:",
    "            count += 1                     # s[lo..hi] is a palindrome",
    "            if hi - lo > best[1] - best[0]: best = (lo, hi)",
    "            lo, hi = lo - 1, hi + 1        # grow one letter on each side",
    "    return s[best[0]:best[1] + 1], count",
  ];
  Viz.register("dp-sequences-strings-expand", (el, opts) => Viz.player(el, {
    title: "Expand around center: every palindrome has a middle, so try every middle",
    tag: "TWO POINTERS · O(1) SPACE",
    legend: [["active", "centre"], ["done", "palindrome s[lo..hi]"], ["bad", "mismatch: stop growing"], ["path", "longest so far"]],
    codeLang: "python",
    code: EX_CODE,
    inputs: [{ key: "s", label: "s (≤ 12)", value: (opts && opts.s) || "abaxabaxabb", width: 130 }],
    random: () => ({ s: rw(Viz.rand(6, 11), "ab") }),
    build: ({ s }) => {
      s = word(s, "s", 12);
      const n = s.length, fr = [], found = [];
      let count = 0, best = [0, 0];
      const snap = (o) => fr.push({ found: found.slice(), best: best.slice(), count, ...o });
      for (let c = 0; c < 2 * n - 1; c++) {
        let lo = Math.floor(c / 2), hi = Math.floor((c + 1) / 2);
        const kind = c % 2 ? `the gap between s[${lo}] and s[${hi}] (even lengths)` : `the letter s[${lo}] = '${s[lo]}' (odd lengths)`;
        let first = true;
        while (lo >= 0 && hi < n && s[lo] === s[hi]) {
          count++;
          const nb = hi - lo > best[1] - best[0];
          if (nb) best = [lo, hi];
          found.push([lo, hi]);
          snap({ c, lo, hi, ok: [lo, hi], note: `${first ? `Centre ${c}: ${kind}. ` : ""}s[${lo}] = s[${hi}] = '${s[lo]}', so <b>"${s.slice(lo, hi + 1)}"</b> is a palindrome (count ${count})${nb ? ", the longest so far" : ""}. Grow one letter on each side.`, line: [4, 5, 6, 7], vars: { c, lo, hi, count, best: s.slice(best[0], best[1] + 1) } });
          first = false;
          lo--; hi++;
        }
        const why = lo < 0 || hi >= n ? "ran off the end of the string" : `s[${lo}] = '${s[lo]}' ≠ s[${hi}] = '${s[hi]}'`;
        snap({ c, lo, hi, ok: lo + 1 <= hi - 1 ? [lo + 1, hi - 1] : null, badPair: lo >= 0 && hi < n ? [lo, hi] : null, note: `${first ? `Centre ${c}: ${kind}. ` : ""}Stop: ${why}. ${first ? "Nothing grows from this centre." : lo < 0 || hi >= n ? "No wider window exists around this centre." : `Any wider window around this centre would contain the same mismatch, so it can never be a palindrome.`}`, line: [2, 3, 4], vars: { c, lo, hi, count, best: s.slice(best[0], best[1] + 1) } });
      }
      const res = s.slice(best[0], best[1] + 1);
      snap({ c: null, ok: null, final: true, ans: res, note: `All ${2 * n - 1} centres tried. <b>${count}</b> palindromic substrings, longest <b>"${res}"</b>. Each centre costs at most O(n), so O(n²) time worst case (all one letter), but only O(1) extra space. Manacher reuses mirror information to make it O(n).`, line: 8, vars: { longest: res, count } });
      return fr.map((f) => ({ ...f, s }));
    },
    render: (f) => {
      const n = f.s.length, slots = [];
      for (let k = 0; k < 2 * n - 1; k++) slots.push(k % 2 ? "·" : f.s[k / 2]);
      const inOk = (k) => f.ok && k >= 2 * f.ok[0] && k <= 2 * f.ok[1];
      const arr = Viz.array(slots, {
        label: "letters and gaps: centre c sits on slot c",
        idxLabel: (k) => (k % 2 ? "" : String(k / 2)),
        ptrsTop: f.c === null || f.c === undefined ? {} : { c: f.c },
        ptrs: f.c === null || f.c === undefined || f.final ? {} : { lo: f.lo >= 0 ? 2 * f.lo : null, hi: f.hi < n ? 2 * f.hi : null },
        cls: (k) => {
          if (f.badPair && (k === 2 * f.badPair[0] || k === 2 * f.badPair[1])) return "bad";
          if (k === f.c && !inOk(k)) return "active";
          if (inOk(k)) return "done";
          if (f.final && k >= 2 * f.best[0] && k <= 2 * f.best[1]) return "path";
          return "";
        },
      });
      const shown = f.found.slice(-14), more = f.found.length - shown.length;
      const chips = `<div class="v-labeled"><span class="v-caption">palindromes found: ${f.count} · longest "${esc(f.s.slice(f.best[0], f.best[1] + 1))}"</span><div class="dss-chips">${more > 0 ? `<span class="dss-more">${more} earlier…</span>` : ""}${shown.map(([lo, hi], k) => `<span class="dss-chip ${k === shown.length - 1 && !f.final ? "active" : lo === f.best[0] && hi === f.best[1] ? "path" : ""}">${esc(f.s.slice(lo, hi + 1))}</span>`).join("")}${f.found.length ? "" : '<span class="dss-more">none yet</span>'}</div></div>`;
      return `<div class="dss-col"><div class="dss-slots">${arr}</div>${chips}</div>`;
    },
  }));

  /* ================= 7. Palindrome partitioning II (132): min cuts ================= */
  const MC_CODE = [
    "def min_cut(s):",
    "    n = len(s)",
    "    pal = [[False] * n for _ in range(n)]",
    "    cuts = [0] * n                          # cuts[i]: fewest cuts for s[0..i]",
    "    for i in range(n):",
    "        cuts[i] = i                         # worst case: cut before every letter",
    "        for j in range(i + 1):              # try the LAST piece s[j..i]",
    "            if s[j] == s[i] and (i - j < 2 or pal[j + 1][i - 1]):",
    "                pal[j][i] = True",
    "                cuts[i] = 0 if j == 0 else min(cuts[i], cuts[j - 1] + 1)",
    "    return cuts[n - 1]",
    "# rebuild: remember which j won for each i, then jump to j - 1",
  ];
  Viz.register("dp-sequences-strings-mincut", (el, opts) => Viz.player(el, {
    title: "Min cuts: choose the last palindromic piece, pay one cut, reuse the prefix answer",
    tag: "1D DP + PAL TABLE",
    legend: [["active", "cell being computed"], ["done", "palindrome piece / improving move"], ["bad", "not a palindrome"], ["visit", "valid but not better"], ["accent", "pal[j][i] = T"], ["path", "chosen pieces"]],
    codeLang: "python",
    code: MC_CODE,
    inputs: [{ key: "s", label: "s (≤ 10)", value: (opts && opts.s) || "aabbaba", width: 120 }],
    random: () => ({ s: rw(Viz.rand(5, 10), "ab") }),
    build: ({ s }) => {
      s = word(s, "s", 10);
      const n = s.length, pal = table(n, n, null), cuts = Array(n).fill(null), par = Array(n).fill(0), fr = [];
      const snap = (o) => fr.push({ pal: Viz.clone(pal), cuts: cuts.slice(), arrows: [], palDep: null, cur: null, win: null, pieces: null, ...o });
      for (let i = 0; i < n; i++) {
        cuts[i] = i; par[i] = i;
        for (let j = 0; j <= i; j++) {
          const inner = i - j < 2 ? true : pal[j + 1][i - 1], ok = s[j] === s[i] && inner;
          pal[j][i] = ok;
          const pre = j === 0 ? `cuts[${i}] starts at ${i} (a cut before every letter). ` : "";
          const palWhy = s[j] !== s[i] ? `s[${j}] = '${s[j]}' ≠ s[${i}] = '${s[i]}'` : i - j < 2 ? `ends '${s[j]}' match and the piece is that short` : inner ? `ends '${s[j]}' match and pal[${j + 1}][${i - 1}] = T` : `ends match but pal[${j + 1}][${i - 1}] = F`;
          const palDep = s[j] === s[i] && i - j >= 2 ? [j + 1, i - 1, inner ? "done" : "bad"] : null;
          if (!ok) { snap({ cur: [j, i], win: [j, i, false], palDep, note: `${pre}Last piece s[${j}..${i}] = "${s.slice(j, i + 1)}": ${palWhy}, so it is <b>not</b> a palindrome. Skip it.`, line: [6, 7], vars: { i, j, piece: s.slice(j, i + 1), "cuts[i]": cuts[i] } }); continue; }
          if (j === 0) {
            cuts[i] = 0; par[i] = 0;
            snap({ cur: [j, i], win: [j, i, true], palDep, note: `${pre}The whole prefix s[0..${i}] = "${s.slice(0, i + 1)}" is a palindrome (${palWhy}): <b>no cut</b> needed, cuts[${i}] = 0.`, line: [7, 8, 9], vars: { i, j, piece: s.slice(j, i + 1), "cuts[i]": 0 } });
          } else {
            const cand = cuts[j - 1] + 1, old = cuts[i], better = cand < old;
            if (better) { cuts[i] = cand; par[i] = j; }
            snap({ cur: [j, i], win: [j, i, true], palDep, arrows: [{ from: [0, j - 1], to: [0, i], arc: "up", cls: better ? "done" : "visit", label: "+1" }], note: `${pre}"${s.slice(j, i + 1)}" is a palindrome (${palWhy}). Make it the last piece: cut after s[${j - 1}], and the prefix s[0..${j - 1}] costs cuts[${j - 1}] = ${cuts[j - 1]}. Total ${cuts[j - 1]} + 1 = ${cand}${better ? ` < ${old}, so <b>cuts[${i}] = ${cand}</b>` : `, not better than ${old}`}.`, line: [7, 8, 9], vars: { i, j, piece: s.slice(j, i + 1), "cuts[j-1]+1": cand, "cuts[i]": cuts[i] } });
          }
        }
      }
      const pieces = [];
      let i = n - 1;
      while (i >= 0) { pieces.unshift([par[i], i]); i = par[i] - 1; }
      snap({ pieces, note: `cuts[${n - 1}] = <b>${cuts[n - 1]}</b>. Rebuild by following, from the end, the j that won each cuts[i]: ${pieces.map(([a, b]) => `"${s.slice(a, b + 1)}"`).join(" | ")} — ${pieces.length} palindromic pieces, ${pieces.length - 1} cuts. O(n²) time and space.`, line: [10, 11], vars: { answer: cuts[n - 1], pieces: pieces.length } });
      return fr.map((f) => ({ ...f, s, ans: f.pieces ? cuts[n - 1] : undefined }));
    },
    render: (f) => {
      const n = f.s.length, pc = {};
      if (f.pieces) f.pieces.forEach(([a, b], k) => { for (let x = a; x <= b; x++) pc[x] = k % 2 ? "done" : "path"; });
      const sArr = chars(f.s, (k) => (f.pieces ? pc[k] : f.win && k >= f.win[0] && k <= f.win[1] ? (f.win[2] ? "done" : "bad") : ""), f.pieces ? "s split into palindromes" : "s (window = candidate last piece s[j..i])", { ptrs: f.win && !f.pieces ? (f.win[0] === f.win[1] ? { "j=i": f.win[0] } : { j: f.win[0], i: f.win[1] }) : {} });
      const pg = dgrid(f.pal.map((row) => row.map((v) => v)), {
        label: "pal[j][i] (row j, column i)", size: 24, gap: 4, small: true, colLabels: f.s.split("").map((_, k) => String(k)), rowLabels: f.s.split("").map((_, k) => String(k)), rowLabelW: 22,
        skip: (r, c) => r > c, fmt: (v) => (v === true ? "T" : ""),
        cls: (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : f.palDep && f.palDep[0] === r && f.palDep[1] === c ? `${f.palDep[2]} dep` : v === true ? "accent" : v === false ? "dim" : ""),
      });
      const src = srcMap(f.arrows);
      const cg = dgrid([f.cuts], {
        label: "cuts[i] = fewest cuts for s[0..i]", size: 38, gap: 10, arcUp: 46, colLabels: lab0(f.s), arrows: f.arrows,
        cls: (r, c, v) => (f.cur && f.cur[1] === c ? "active" : src.has(`0,${c}`) ? `${src.get(`0,${c}`)} dep` : v === null ? "dim" : ""),
      });
      const pcs = f.pieces ? `<div class="dss-chips">${f.pieces.map(([a, b], k) => `<span class="dss-chip ${k % 2 ? "done" : "path"}">${esc(f.s.slice(a, b + 1))}</span>`).join('<span class="dss-more">|</span>')}</div>` : "";
      return `<div class="dss-col">${sArr}<div class="dss-row">${cg}${pg}</div>${pcs}</div>`;
    },
  }));

  /* ================= 8. Regular expression (10) and wildcard (44) matching ================= */
  const RX_MODES = ["regex: . and x* (10)", "wildcard: ? and * (44)"];
  const RX_CODE = {
    rx: [
      "def is_match(s, p):",
      "    n, m = len(s), len(p)",
      "    dp = [[False] * (m + 1) for _ in range(n + 1)]",
      "    dp[0][0] = True",
      "    for i in range(n + 1):                    # i = 0 too: x* can match nothing",
      "        for j in range(1, m + 1):",
      "            if p[j - 1] == '*':",
      "                dp[i][j] = dp[i][j - 2]           # use x* ZERO times",
      "                if i > 0 and p[j - 2] in (s[i - 1], '.'):",
      "                    dp[i][j] |= dp[i - 1][j]      # x* eats s[i-1] and stays",
      "            elif i > 0 and p[j - 1] in (s[i - 1], '.'):",
      "                dp[i][j] = dp[i - 1][j - 1]       # one letter or '.': diagonal",
      "    return dp[n][m]",
    ],
    wc: [
      "def is_match_wild(s, p):",
      "    n, m = len(s), len(p)",
      "    dp = [[False] * (m + 1) for _ in range(n + 1)]",
      "    dp[0][0] = True",
      "    for i in range(n + 1):",
      "        for j in range(1, m + 1):",
      "            if p[j - 1] == '*':",
      "                dp[i][j] = dp[i][j - 1]           # * matches the empty string",
      "                if i > 0:",
      "                    dp[i][j] |= dp[i - 1][j]      # * eats s[i-1] and stays",
      "            elif i > 0 and p[j - 1] in (s[i - 1], '?'):",
      "                dp[i][j] = dp[i - 1][j - 1]       # one letter or '?': diagonal",
      "    return dp[n][m]",
    ],
  };
  let rxLast = true;
  const randPat = (s, rx) => {
    let p = "", k = 0, guard = 0;
    while (k < s.length && guard++ < 40) {
      const r = Math.random();
      if (rx) {
        if (r < 0.25) { let e = k; while (e < s.length && s[e] === s[k] && Math.random() < 0.75) e++; p += s[k] + "*"; k = e; }
        else if (r < 0.4) { p += "."; k++; }
        else if (r < 0.48) p += "c*";
        else { p += s[k]; k++; }
      } else if (r < 0.25) { p += "*"; k = Math.min(s.length, k + Viz.rand(0, 2)); }
      else if (r < 0.4) { p += "?"; k++; }
      else { p += s[k]; k++; }
    }
    if (!rx) p = p.replace(/\*+/g, "*");
    if (Math.random() < 0.3) { const idx = [...p].map((ch, q) => (/[ab]/.test(ch) ? q : -1)).filter((q) => q >= 0); if (idx.length) { const q = idx[Viz.rand(0, idx.length - 1)]; p = p.slice(0, q) + (p[q] === "a" ? "b" : "a") + p.slice(q + 1); } }
    p = p.slice(0, 8);
    return p || (rx ? "a*" : "*");
  };
  Viz.register("dp-sequences-strings-regex", (el, opts) => Viz.player(el, {
    title: "Pattern matching: what a star is allowed to do, cell by cell",
    tag: "BOOLEAN TABLE · VERY HARD",
    legend: [["active", "cell being computed"], ["done", "move that makes it T"], ["visit", "allowed move, but source is F"], ["bad", "characters do not match"], ["accent", "T = prefixes match"], ["path", "one way the pattern matches"]],
    codeLang: "python",
    code: Array(13).fill(""),
    inputs: [
      { key: "mode", label: "problem", type: "select", value: opts && RX_MODES.includes(opts.mode) ? opts.mode : RX_MODES[0], options: RX_MODES },
      { key: "s", label: "s (0–8 letters)", value: (opts && opts.s) || "aab", width: 100 },
      { key: "p", label: "p (≤ 8)", value: (opts && opts.p) || "c*a*b", width: 100 },
    ],
    random: () => { const s = rw(Viz.rand(2, 6), "ab"); return { s, p: randPat(s, rxLast) }; },
    build: ({ mode, s, p }) => {
      const rx = mode !== RX_MODES[1];
      rxLast = rx;
      setCode(el, rx ? RX_CODE.rx : RX_CODE.wc);
      s = word(s, "s", 8, 0);
      p = String(p ?? "").trim().toLowerCase();
      if (!p.length || p.length > 8) throw new Error("p must have 1–8 characters.");
      if (rx && !/^[a-z.*]+$/.test(p)) throw new Error("A regex p must use only a–z, '.' and '*'.");
      if (!rx && !/^[a-z?*]+$/.test(p)) throw new Error("A wildcard p must use only a–z, '?' and '*'.");
      if (rx && (p[0] === "*" || p.includes("**"))) throw new Error("In a regex each '*' must follow a letter or '.', so p must not start with '*' or contain '**'.");
      const n = s.length, m = p.length, M = table(n + 1, m + 1, null), fr = [], any = rx ? "." : "?";
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, path: [], hs: {}, hp: {}, ...o });
      M[0][0] = true;
      for (let i = 1; i <= n; i++) M[i][0] = false;
      snap({ note: `dp[i][j]: does s[:i] match p[:j]? Column 0 is the empty pattern: it matches only the empty string, so dp[0][0] = <b>T</b> and the rest of column 0 is F. Row 0 is not trivial: ${rx ? "'x*' can match nothing, so patterns like \"a*b*\" match the empty s" : "'*' can match nothing, so leading stars match the empty s"}.`, line: [2, 3], vars: { n, m } });
      for (let i = 0; i <= n; i++) for (let j = 1; j <= m; j++) {
        const pc = p[j - 1], arrows = [];
        let v = false, note, line;
        const hs = i > 0 ? { [i - 1]: "active" } : {}, hp = { [j - 1]: "active" };
        if (pc === "*") {
          if (rx) {
            hp[j - 2] = "active";
            const x = p[j - 2], z = M[i][j - 2];
            arrows.push({ from: [i, j - 2], to: [i, j], arc: "up", arcH: 13, cls: z ? "done" : "visit", label: "0×" });
            v = z;
            let eat = "";
            if (i > 0) {
              const fits = x === "." || x === s[i - 1], src = M[i - 1][j];
              arrows.push({ from: [i - 1, j], to: [i, j], cls: !fits ? "bad" : src ? "done" : "visit", label: "eat" });
              if (fits && src) v = true;
              eat = fits ? ` <b>Eat</b>: '${x}' matches s[${i - 1}] = '${s[i - 1]}', so x* swallows it and stays available: dp[${i - 1}][${j}] = ${src ? "T" : "F"}.` : ` <b>Eat</b> is impossible: '${x}' ≠ s[${i - 1}] = '${s[i - 1]}'.`;
            }
            note = `p[${j - 2}..${j - 1}] = "${x}*". <b>Zero copies</b>: pretend "${x}*" is not there and look two columns left, dp[${i}][${j - 2}] = ${z ? "T" : "F"} (the arc).${eat} dp[${i}][${j}] = <b>${v ? "T" : "F"}</b>.`;
            line = i > 0 ? [6, 7, 8, 9] : [6, 7];
          } else {
            const z = M[i][j - 1];
            arrows.push({ from: [i, j - 1], to: [i, j], cls: z ? "done" : "visit", label: "empty" });
            v = z;
            let eat = "";
            if (i > 0) {
              const src = M[i - 1][j];
              arrows.push({ from: [i - 1, j], to: [i, j], cls: src ? "done" : "visit", label: "eat" });
              if (src) v = true;
              eat = ` <b>Eat</b> s[${i - 1}] = '${s[i - 1]}' and keep the star: dp[${i - 1}][${j}] = ${src ? "T" : "F"}.`;
            }
            note = `p[${j - 1}] = '*'. <b>Empty</b>: the star matches nothing, so look left, dp[${i}][${j - 1}] = ${z ? "T" : "F"}.${eat} dp[${i}][${j}] = <b>${v ? "T" : "F"}</b>.`;
            line = i > 0 ? [6, 7, 8, 9] : [6, 7];
          }
        } else if (i === 0) {
          note = `p[${j - 1}] = '${pc}' must consume exactly one character, but s[:0] is empty: <b>F</b>.`;
          line = 10;
        } else {
          const fits = pc === any || pc === s[i - 1], src = M[i - 1][j - 1];
          arrows.push({ from: [i - 1, j - 1], to: [i, j], cls: !fits ? "bad" : src ? "done" : "visit", label: fits ? "=" : "≠" });
          v = fits && src;
          note = fits ? `p[${j - 1}] = '${pc}' matches s[${i - 1}] = '${s[i - 1]}'${pc === any ? ` (${any} matches anything)` : ""}, so inherit the diagonal: dp[${i - 1}][${j - 1}] = <b>${src ? "T" : "F"}</b>.` : `p[${j - 1}] = '${pc}' ≠ s[${i - 1}] = '${s[i - 1]}': <b>F</b>.`;
          line = [10, 11];
        }
        M[i][j] = v;
        snap({ cur: [i, j], arrows, hs, hp, note, line, vars: { i, j, "s[i-1]": i > 0 ? s[i - 1] : "—", "p[j-1]": pc, "dp[i][j]": v } });
      }
      const ok = M[n][m];
      if (!ok) { snap({ ans: false, note: `dp[${n}][${m}] = <b>F</b>: "${s}" does <b>not</b> match "${p}". No chain of T cells connects (0, 0) to the corner.`, line: 12, vars: { answer: false } }); return fr.map((f) => ({ ...f, s, p, rx })); }
      let i = n, j = m;
      const path = [[i, j]], parr = [], ms = {}, mp = {};
      snap({ path: path.slice(), note: `dp[${n}][${m}] = <b>T</b>: "${s}" matches "${p}". Walk back through T cells to see <i>how</i> each pattern piece was used.`, line: 12, vars: { answer: true } });
      while (i > 0 || j > 0) {
        let note;
        if (p[j - 1] === "*") {
          const back = rx ? 2 : 1;
          if (M[i][j - back]) { parr.push({ from: [i, j - back], to: [i, j], ...(rx ? { arc: "up", arcH: 13, label: "0×" } : { label: "empty" }), cls: "path" }); note = rx ? `"${p[j - 2]}*" is used zero more times: jump two columns left.` : `'*' matches nothing more: step left.`; mp[j - 1] = mp[j - 1] || "dim"; if (rx) mp[j - 2] = mp[j - 2] || "dim"; j -= back; }
          else { parr.push({ from: [i - 1, j], to: [i, j], cls: "path", label: "eat" }); ms[i - 1] = "path"; mp[j - 1] = "path"; if (rx) mp[j - 2] = "path"; note = `${rx ? `"${p[j - 2]}*"` : "'*'"} eats s[${i - 1}] = '${s[i - 1]}': step up (same pattern column).`; i--; }
        } else { parr.push({ from: [i - 1, j - 1], to: [i, j], cls: "path", label: "=" }); ms[i - 1] = "path"; mp[j - 1] = "path"; note = `p[${j - 1}] = '${p[j - 1]}' matches s[${i - 1}] = '${s[i - 1]}': step diagonally.`; i--; j--; }
        path.push([i, j]);
        snap({ path: path.slice(), arrows: parr.slice(), hs: { ...ms }, hp: { ...mp }, note, line: 12, vars: { i, j } });
      }
      snap({ path: path.slice(), arrows: parr.slice(), hs: { ...ms }, hp: { ...mp }, ans: true, note: `The path is a full explanation of the match: diagonals pair one character, vertical steps are a star eating, ${rx ? "arcs are an x* used zero times" : "horizontal steps are a star matching empty"}. O(n·m) time; one or two rows suffice for the yes/no answer.`, line: 12, vars: { answer: true } });
      return fr.map((f) => ({ ...f, s, p, rx }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = keyset(f.path);
      const g = dgrid(f.M, {
        label: "dp[i][j]: does s[:i] match p[:j]? (rows = s, columns = p)", size: 36, gap: 18, arcUp: 18, colLabels: lab(f.p), rowLabels: lab(f.s), rowLabelW: 40, arrows: f.arrows,
        cls: (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : onPath.has(`${r},${c}`) ? "path" : v === true ? "accent" : v === false ? "dim" : ""),
      });
      return `<div class="dss-col"><div class="dss-row">${chars(f.s, (k) => f.hs[k], "s (rows)")}${chars(f.p, (k) => f.hp[k], "p (columns)")}</div>${g}</div>`;
    },
  }));

  /* ================= 9. Minimum operations to make a subsequence (1713): LCS → LIS ================= */
  const LL_CODE = [
    "def min_operations(target, arr):",
    "    pos = {x: k for k, x in enumerate(target)}  # target values are DISTINCT",
    "    seq = [pos[x] for x in arr if x in pos]    # arr rewritten as target positions",
    "    tails = []                                 # tails[L]: smallest end of a run of length L+1",
    "    for x in seq:",
    "        L = bisect_left(tails, x)              # strictly increasing -> bisect_left",
    "        if L == len(tails): tails.append(x)    # the longest run grows",
    "        else: tails[L] = x                      # same length, smaller end: better",
    "    return len(target) - len(tails)             # insert every target value not kept",
  ];
  Viz.register("dp-sequences-strings-lislcs", (el, opts) => Viz.player(el, {
    title: "When one side has distinct values, LCS collapses to LIS in O(n log n)",
    tag: "REDUCTION · PATIENCE",
    legend: [["active", "current element / slot"], ["done", "kept (part of the LCS)"], ["bad", "must be inserted"], ["dim", "not in target: ignored"], ["path", "the increasing run"]],
    codeLang: "python",
    code: LL_CODE,
    inputs: [
      { key: "t", label: "target (distinct, ≤ 8)", value: (opts && opts.t) || "6,4,8,1,3,2", width: 130 },
      { key: "a", label: "arr (≤ 12)", value: (opts && opts.a) || "4,7,6,2,3,8,6,1", width: 150 },
    ],
    random: () => { const pool = [1, 2, 3, 4, 5, 6, 7, 8, 9].sort(() => Math.random() - 0.5); const t = pool.slice(0, Viz.rand(4, 7)); return { t: t.join(","), a: Viz.randInts(Viz.rand(6, 11), 1, 9).join(",") }; },
    build: ({ t, a }) => {
      const T = Viz.parse.ints(t, { min: 1, max: 8 }), A = Viz.parse.ints(a, { min: 1, max: 12 });
      if ([...T, ...A].some((x) => !Number.isInteger(x) || x < 0 || x > 99)) throw new Error("Values must be whole numbers from 0 to 99.");
      if (new Set(T).size !== T.length) throw new Error("Target values must be distinct (that is what makes the LIS trick work).");
      const pos = new Map(T.map((x, k) => [x, k])), seq = [], from = [];
      A.forEach((x, k) => { if (pos.has(x)) { seq.push(pos.get(x)); from.push(k); } });
      const fr = [], tails = [], tIdx = [], par = [];
      const snap = (o) => fr.push({ tails: tails.slice(), cur: -1, slot: -1, kept: null, ...o });
      snap({ note: `Goal: insert as few numbers into arr as possible so that target becomes a subsequence. Kept numbers form a common subsequence, so answer = len(target) − LCS. Because target is <b>distinct</b>, rename each arr value by its <b>position in target</b> (✗ = not in target, useless). A common subsequence is now just an <b>increasing</b> run of positions.`, line: [1, 2], vars: { "len(target)": T.length, "len(seq)": seq.length } });
      seq.forEach((x, q) => {
        let lo = 0, hi = tails.length;
        while (lo < hi) { const md = (lo + hi) >> 1; if (tails[md] < x) lo = md + 1; else hi = md; }
        const L = lo, grow = L === tails.length, old = tails[L];
        if (grow) tails.push(x); else tails[L] = x;
        tIdx[L] = q; par[q] = L > 0 ? tIdx[L - 1] : -1;
        snap({ cur: q, slot: L, note: `seq[${q}] = ${x} (arr value ${A[from[q]]}). bisect_left finds slot L = ${L}: ${grow ? `${x} is larger than every tail, so it <b>extends</b> the longest run to length ${tails.length}.` : `a run of length ${L + 1} can now end in ${x} instead of ${old}: a <b>smaller end</b> is easier to extend later.`}`, line: grow ? [4, 5, 6] : [4, 5, 7], vars: { x, L, "len(tails)": tails.length } });
      });
      const keptQ = [];
      for (let q = tails.length ? tIdx[tails.length - 1] : -1; q >= 0; q = par[q]) keptQ.unshift(q);
      const keptT = new Set(keptQ.map((q) => seq[q]));
      const ans = T.length - tails.length;
      snap({ kept: keptQ, keptT: [...keptT], ans, note: `LIS = ${tails.length}, rebuilt with parent pointers: positions ${keptQ.map((q) => seq[q]).join(" < ") || "(none)"}. Keep those target values, insert the other <b>${ans}</b>. The plain LCS table would cost O(n·m); this is O(m log m). (tails itself is not the run: it only stores the best ends.)`, line: 8, vars: { LIS: tails.length, answer: ans } });
      return fr.map((f) => ({ ...f, T, A, seq, from }));
    },
    render: (f) => {
      const keptT = new Set(f.keptT || []), keptQ = new Set(f.kept || []);
      const curA = f.cur >= 0 ? f.from[f.cur] : -1, keptA = new Set([...keptQ].map((q) => f.from[q]));
      const tArr = Viz.array(f.T, { label: "target (index = position)", cls: (k) => (f.kept ? (keptT.has(k) ? "done" : "bad") : "") });
      const aArr = Viz.array(f.A, { label: "arr (below: position in target)", idxLabel: (k) => { const q = f.from.indexOf(k); return q >= 0 ? `→${f.seq[q]}` : "✗"; }, cls: (k) => (f.from.indexOf(k) < 0 ? "dim" : k === curA ? "active" : keptA.has(k) ? "path" : "") });
      const sArr = f.seq.length ? Viz.array(f.seq, { label: "seq = positions (find the longest strictly increasing run)", cls: (q) => (q === f.cur ? "active" : keptQ.has(q) ? "path" : "") }) : '<span class="dss-more">no arr value appears in target</span>';
      const tl = Viz.array(f.tails.length ? f.tails : [""], { label: "tails[L] = smallest end of an increasing run of length L+1", idxLabel: (L) => `L=${L}`, cls: (L) => (L === f.slot ? "active" : f.tails.length ? "" : "dim") });
      return `<div class="dss-col"><div class="dss-row">${tArr}${aArr}</div><div class="dss-row">${sArr}${tl}</div></div>`;
    },
  }));

  /* ================= 10. Hirschberg: the LCS string in linear space ================= */
  const HB_CODE = [
    "def hirschberg(a, b):",
    "    if not a or not b: return ''",
    "    if len(a) == 1: return a if a in b else ''",
    "    mid = len(a) // 2",
    "    F = lcs_row(a[:mid], b)                     # top half, forward: last row only",
    "    B = lcs_row(a[mid:][::-1], b[::-1])[::-1]   # bottom half, run backwards",
    "    k = max(range(len(b) + 1), key=lambda k: F[k] + B[k])  # best crossing column",
    "    return hirschberg(a[:mid], b[:k]) + hirschberg(a[mid:], b[k:])",
    "def lcs_row(a, b):                              # O(len(b)) memory",
    "    row = [0] * (len(b) + 1)",
    "    for x in a:",
    "        prev = row[:]",
    "        for j in range(1, len(b) + 1):",
    "            row[j] = prev[j - 1] + 1 if x == b[j - 1] else max(prev[j], row[j - 1])",
    "    return row",
  ];
  const lcsRow = (a, b) => { let row = Array(b.length + 1).fill(0); for (const x of a) { const p = row.slice(); for (let j = 1; j <= b.length; j++) row[j] = x === b[j - 1] ? p[j - 1] + 1 : Math.max(p[j], row[j - 1]); } return row; };
  Viz.register("dp-sequences-strings-hirschberg", (el, opts) => Viz.player(el, {
    title: "Hirschberg: find where the LCS path crosses the middle row, then recurse",
    tag: "DIVIDE & CONQUER · O(n + m) SPACE",
    legend: [["visit", "top half (forward pass)"], ["accent", "bottom half (backward pass)"], ["active", "middle row"], ["path", "crossing points found"], ["done", "matched letter"], ["dim", "outside the current subproblem"]],
    codeLang: "python",
    code: HB_CODE,
    inputs: [
      { key: "a", label: "a (≤ 8)", value: (opts && opts.a) || "abcbdab", width: 100 },
      { key: "b", label: "b (≤ 8)", value: (opts && opts.b) || "bdcaba", width: 100 },
    ],
    random: () => ({ a: rw(Viz.rand(4, 8), "abcd"), b: rw(Viz.rand(4, 8), "abcd") }),
    build: ({ a, b }) => {
      a = word(a, "a", 8); b = word(b, "b", 8);
      const n = a.length, m = b.length, fr = [], out = [], splits = [], matches = [];
      const snap = (o) => fr.push({ rect: null, mid: null, row: null, F: null, B: null, S: null, k: null, splits: splits.slice(), matches: matches.slice(), out: out.join(""), ...o });
      snap({ note: `The full LCS table needs O(n·m) memory to walk back. Hirschberg keeps only <b>one row</b> at a time: run the row DP down to the middle row from the top (F) and up to it from the bottom (B). F[k] + B[k] is the best LCS whose path crosses the middle row at column k, so the max tells us one point on an optimal path. Split there and recurse on two smaller rectangles.`, line: 0, vars: { n, m, "LCS length": lcsLen(a, b) } });
      const stack = [[0, n, 0, m]];
      while (stack.length) {
        const [i0, i1, j0, j1] = stack.pop(), A = a.slice(i0, i1), Bs = b.slice(j0, j1), rect = [i0, i1, j0, j1];
        const v0 = { "a part": A || "''", "b part": Bs || "''" };
        if (!A.length || !Bs.length) { snap({ rect, note: `Subproblem a[${i0}:${i1}] = "${A}", b[${j0}:${j1}] = "${Bs}": one side is empty, so it contributes nothing.`, line: 1, vars: v0 }); continue; }
        if (A.length === 1) {
          const idx = Bs.indexOf(A);
          if (idx >= 0) { out.push(A); matches.push([i0 + 1, j0 + idx + 1]); }
          snap({ rect, note: `Base case: a single letter '${A}' vs "${Bs}". ${idx >= 0 ? `It appears at b[${j0 + idx}], so it contributes <b>'${A}'</b> (the matched cell turns green).` : "It does not appear, so it contributes nothing."} LCS so far: "${out.join("")}".`, line: 2, vars: { ...v0, "LCS so far": out.join("") || "''" } });
          continue;
        }
        const mid = A.length >> 1, r = i0 + mid;
        snap({ rect, mid: r, note: `Subproblem rows ${i0}..${i1} × columns ${j0}..${j1} ("${A}" vs "${Bs}"). Split a in half at row ${r}: top "${A.slice(0, mid)}", bottom "${A.slice(mid)}".`, line: 3, vars: { ...v0, mid: r } });
        const F = lcsRow(A.slice(0, mid), Bs);
        snap({ rect, mid: r, row: F, F, note: `<b>Forward</b>: LCS of the top half "${A.slice(0, mid)}" against every prefix of "${Bs}", keeping only one row. F[k] = LCS(top, b[${j0}:${j0}+k]). Shown in the middle row.`, line: [4, 8, 9, 10, 11, 12, 13], vars: { ...v0, F: F.join(" ") } });
        const B = lcsRow([...A.slice(mid)].reverse().join(""), [...Bs].reverse().join("")).reverse();
        snap({ rect, mid: r, row: B, F, B, note: `<b>Backward</b>: the same row DP on the reversed bottom half and reversed b. B[k] = LCS(bottom "${A.slice(mid)}", the suffix b[${j0}+k:${j1}]).`, line: [5, 8, 9, 10, 11, 12, 13], vars: { ...v0, B: B.join(" ") } });
        const S = F.map((x, t) => x + B[t]);
        let k = 0; S.forEach((x, t) => { if (x > S[k]) k = t; });
        splits.push([r, j0 + k]);
        snap({ rect, mid: r, row: S, F, B, S, k, note: `F[k] + B[k] peaks at k = ${k} with ${S[k]} = LCS of this subproblem. So an optimal path crosses row ${r} at column ${j0 + k} (purple). Recurse on the top-left rectangle and the bottom-right rectangle; everything else can never be on this path.`, line: [6, 7], vars: { ...v0, k: j0 + k, "F+B": S[k] } });
        stack.push([r, i1, j0 + k, j1], [i0, r, j0, j0 + k]);
      }
      const res = out.join("");
      snap({ ans: res, note: `Done: LCS = <b>"${res}"</b> (length ${res.length}). The purple crossing points and green matches trace one optimal path through the table, found with O(n + m) memory and still O(n·m) time (each level of recursion does about half the work of the previous one).`, line: 7, vars: { LCS: res, length: res.length } });
      return fr.map((f) => ({ ...f, a, b }));
    },
    render: (f) => {
      const n = f.a.length, m = f.b.length, sp = keyset(f.splits), mt = new Map(f.matches.map(([r, c]) => [`${r},${c}`, f.a[r - 1]]));
      const inR = (r, c) => f.rect && r >= f.rect[0] && r <= f.rect[1] && c >= f.rect[2] && c <= f.rect[3];
      const M = Array.from({ length: n + 1 }, (_, r) => Array.from({ length: m + 1 }, (_, c) => {
        if (f.row && r === f.mid && inR(r, c)) return String(f.row[c - f.rect[2]]);
        if (mt.has(`${r},${c}`)) return mt.get(`${r},${c}`);
        return sp.has(`${r},${c}`) ? "•" : "";
      }));
      const g = dgrid(M, {
        label: f.rect ? `subproblem: rows ${f.rect[0]}..${f.rect[1]}, columns ${f.rect[2]}..${f.rect[3]}` : "the LCS lattice (rows = a, columns = b)", size: 34, gap: 8, colLabels: lab(f.b), rowLabels: lab(f.a), rowLabelW: 40, fmt: (v) => v,
        cls: (r, c) => {
          if (f.k !== null && r === f.mid && c === f.rect[2] + f.k) return "path";
          if (f.mid !== null && r === f.mid && inR(r, c)) return "active";
          if (mt.has(`${r},${c}`)) return "done";
          if (sp.has(`${r},${c}`)) return "path";
          if (!f.rect) return "";
          if (!inR(r, c)) return "dim";
          return f.mid === null ? "" : r < f.mid ? "visit" : "accent";
        },
      });
      const lbl = (t) => (f.rect ? `j=${f.rect[2] + t}` : String(t));
      const rows = [f.F && Viz.array(f.F, { label: "F (forward)", idxLabel: lbl, cls: (t) => (t === f.k ? "path" : "") }), f.B && Viz.array(f.B, { label: "B (backward)", idxLabel: lbl, cls: (t) => (t === f.k ? "path" : "") }), f.S && Viz.array(f.S, { label: "F + B", idxLabel: lbl, cls: (t) => (t === f.k ? "path" : "") })].filter(Boolean).join("");
      const out = `<div class="dss-out">LCS so far: <b>${esc(f.out || "''")}</b></div>`;
      return `<div class="dss-col"><div class="dss-row">${g}<div class="dss-col dss-narrow">${rows}${out}</div></div></div>`;
    },
  }));
})();
