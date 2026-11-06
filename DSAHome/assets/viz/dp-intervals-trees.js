/* Interval & Tree DP visualizers. Every name is prefixed "dp-intervals-trees-". Frames come from running the real algorithms on your input. */
(() => {
  const S = "dp-intervals-trees", P = (n) => `${S}-${n}`;
  const esc = Viz.esc;
  const hl = (line) => (typeof window !== "undefined" && window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; visualizers with a "problem" select rewrite it in place. */
  const setCode = (el, code) => { if (!el || !el.querySelectorAll) return; el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.display = k < code.length ? "" : "none"; }); };
  const blank = (codes) => Array(Math.max(...codes.map((c) => c.length))).fill("");
  const fm = (v) => (v === Infinity ? "∞" : v === -Infinity ? "−∞" : v === null || v === undefined ? "" : String(v));
  const col = (...p) => `<div class="dit-col">${p.filter(Boolean).join("")}</div>`;
  const row = (...p) => `<div class="dit-row">${p.filter(Boolean).join("")}</div>`;
  const chips = (label, list) => Viz.labeled(label, `<div class="dit-chips">${list.length ? list.map((c) => `<span class="dit-chip ${c.cls || ""}">${c.html}</span>`).join("") : '<span class="dit-more">none yet</span>'}</div>`);
  const answer = (label, value, cls = "done") => Viz.labeled(label, `<div class="v-item ${cls} dit-ans">${esc(value)}</div>`);
  /* When the problem select changes, load that problem's example and rebuild. */
  const onMode = (el, api, defs, key = "vals") => {
    if (!el || !el.querySelector || !api) return api;
    const sel = el.querySelector('select[name="mode"]'), form = el.querySelector("form.viz-inputs");
    if (!sel || !form) return api;
    sel.addEventListener("change", () => {
      const d = defs[sel.value];
      if (d) for (const [k, v] of Object.entries(typeof d === "string" ? { [key]: d } : d)) if (form.elements[k]) form.elements[k].value = v;
      api.rebuild(Object.fromEntries(new FormData(form).entries()));
    });
    return api;
  };
  const curMode = (el, fallback) => (el && el.querySelector && el.querySelector('select[name="mode"]') ? el.querySelector('select[name="mode"]').value : fallback);

  function ints(s, what, { min = 1, max = 8, lo = 1, hi = 99 } = {}) {
    const t = String(s ?? "").split(/[\s,]+/).filter(Boolean);
    const a = t.map(Number);
    if (a.some((x) => !Number.isInteger(x))) throw new Error(`${what}: use whole numbers separated by commas.`);
    if (a.length < min || a.length > max) throw new Error(`${what}: use between ${min} and ${max} numbers (you gave ${a.length}).`);
    if (a.some((x) => x < lo || x > hi)) throw new Error(`${what}: every number must be between ${lo} and ${hi}.`);
    return a;
  }
  const table = (R, C, v = null) => Array.from({ length: R }, () => Array(C).fill(v));

  /* ---------- SVG DP table: cells use the svg.dg box classes so both themes work ---------- */
  function tbl(M, o = {}) {
    const R = M.length, C = o.cols || Math.max(1, ...M.map((r) => r.length));
    const cs = o.size || 42, gap = o.gap ?? 6;
    const padL = o.rowLabels ? (o.rowLabelW || 44) : 4, padT = o.colLabels ? 22 : 4;
    const X = (c) => padL + c * (cs + gap), Y = (r) => padT + r * (cs + gap);
    const W = X(C) - gap + 6, H = Y(R) - gap + 6;
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dit-lab" x="${X(c) + cs / 2}" y="14" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dit-lab" x="${padL - 8}" y="${Y(r) + cs / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((rw, r) => rw.forEach((v, c) => {
      if (o.skip && o.skip(r, c)) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="6"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fm(v);
      const sm = String(t).length > (o.smallAt || 4);
      s += `<text class="dit-v ${sm ? "sm" : ""} ${cl}" x="${x + cs / 2}" y="${y + cs / 2 + (o.tag ? 4 : 0)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
      const tg = o.tag ? o.tag(r, c, v) : "";
      if (tg) s += `<text class="dit-sub" x="${x + cs - 4}" y="${y + 11}" text-anchor="end">${esc(tg)}</text>`;
    }));
    let labels = "";
    for (const a of o.arrows || []) {
      const [r1, c1] = a.from, [r2, c2] = a.to, cl = a.cls || "active";
      const cx1 = X(c1) + cs / 2, cy1 = Y(r1) + cs / 2, cx2 = X(c2) + cs / 2, cy2 = Y(r2) + cs / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const m = Math.max(Math.abs(ux), Math.abs(uy));
      const k1 = (cs / 2 / m) * 0.3, k2 = cs / 2 / m + 1;
      const x1 = cx1 + ux * k1, y1 = cy1 + uy * k1, x2 = cx2 - ux * k2, y2 = cy2 - uy * k2;
      s += `<path class="dit-halo" d="M${x1},${y1} L${x2},${y2}"/><path class="dit-e ${cl}" d="M${x1},${y1} L${x2},${y2}"/><polygon class="dit-ah ${cl}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
      const anc = Math.abs(uy) > 0.7 ? (uy < 0 ? "start" : "end") : "middle", off = anc === "middle" ? 11 : 6;
      if (a.label !== undefined) labels += `<text class="dit-el ${cl}" x="${(x1 + x2) / 2 - uy * off}" y="${(y1 + y2) / 2 + ux * off}" text-anchor="${anc}" dominant-baseline="central">${esc(a.label)}</text>`;
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dit-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "DP table")}">${s}${labels}</svg></div>`;
  }
  const cellSize = (maxVal) => Math.max(40, Math.min(58, 10 * String(maxVal).length + 18));

  /* =====================================================================
     1. Split-point interval DP: fill by length, scan k
     ===================================================================== */
  const SPLIT_MODES = ["matrix chain multiplication", "merge adjacent stones", "cut a stick (1547)", "polygon triangulation (1039)"];
  const SPLIT_DEF = { [SPLIT_MODES[0]]: "30,35,15,5,10,20", [SPLIT_MODES[1]]: "3,4,3,1,2,6", [SPLIT_MODES[2]]: "7; 1,3,4,5", [SPLIT_MODES[3]]: "3,7,4,5,2,6" };
  const SPLIT_CODE = [
    [
      "def matrix_chain(p):                     # matrix t is p[t] x p[t+1]",
      "    n = len(p) - 1                       # number of matrices",
      "    dp = [[0] * n for _ in range(n)]     # dp[i][i] = 0: one matrix, no work",
      "    for length in range(2, n + 1):       # shorter chains first",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            dp[i][j] = inf",
      "            for k in range(i, j):        # LAST multiply: (A_i..A_k)(A_k+1..A_j)",
      "                cost = dp[i][k] + dp[k + 1][j] + p[i] * p[k + 1] * p[j + 1]",
      "                if cost < dp[i][j]:",
      "                    dp[i][j], split[i][j] = cost, k",
      "    return dp[0][n - 1]",
    ],
    [
      "def merge_stones(a):                     # merging two piles costs their total",
      "    n = len(a); pre = prefix_sums(a)",
      "    dp = [[0] * n for _ in range(n)]     # dp[i][i] = 0: already one pile",
      "    for length in range(2, n + 1):",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            dp[i][j] = inf",
      "            for k in range(i, j):        # LAST merge: pile(i..k) + pile(k+1..j)",
      "                cost = dp[i][k] + dp[k + 1][j] + (pre[j + 1] - pre[i])",
      "                if cost < dp[i][j]:",
      "                    dp[i][j], split[i][j] = cost, k",
      "    return dp[0][n - 1]",
    ],
    [
      "def min_cost_cut(n, cuts):",
      "    pts = [0] + sorted(cuts) + [n]; m = len(pts)",
      "    dp = [[0] * m for _ in range(m)]     # dp[i][i+1] = 0: no cut inside",
      "    for length in range(2, m):           # distance between end points",
      "        for i in range(m - length):",
      "            j = i + length",
      "            dp[i][j] = inf",
      "            for k in range(i + 1, j):    # FIRST cut at pts[k]: pay the length",
      "                cost = dp[i][k] + dp[k][j] + (pts[j] - pts[i])",
      "                if cost < dp[i][j]:",
      "                    dp[i][j], split[i][j] = cost, k",
      "    return dp[0][m - 1]",
    ],
    [
      "def min_score_triangulation(v):",
      "    n = len(v)",
      "    dp = [[0] * n for _ in range(n)]     # dp[i][i+1] = 0: an edge, no triangle",
      "    for length in range(2, n):",
      "        for i in range(n - length):",
      "            j = i + length",
      "            dp[i][j] = inf",
      "            for k in range(i + 1, j):    # edge (i, j) sits in triangle (i, k, j)",
      "                cost = dp[i][k] + dp[k][j] + v[i] * v[k] * v[j]",
      "                if cost < dp[i][j]:",
      "                    dp[i][j], split[i][j] = cost, k",
      "    return dp[0][n - 1]",
    ],
  ];

  function splitProblem(md, vals) {
    if (md === 0) {
      const p = ints(vals, "dimensions", { min: 3, max: 8, lo: 1, hi: 60 });
      const n = p.length - 1;
      return { N: n, shared: false, items: p.slice(0, n).map((x, t) => `${x}×${p[t + 1]}`), itemLabel: "matrices A_t = p[t] × p[t+1]", name: (t) => `A${t}`,
        w: (i, k, j) => p[i] * p[k + 1] * p[j + 1], wText: (i, k, j) => `${p[i]}·${p[k + 1]}·${p[j + 1]}`, p };
    }
    if (md === 1) {
      const a = ints(vals, "stones", { min: 2, max: 8, lo: 1, hi: 30 });
      const pre = [0]; a.forEach((x) => pre.push(pre[pre.length - 1] + x));
      return { N: a.length, shared: false, items: a, itemLabel: "stone piles", name: (t) => `${a[t]}`,
        w: (i, k, j) => pre[j + 1] - pre[i], wText: (i, k, j) => `sum(a[${i}..${j}])`, a };
    }
    if (md === 2) {
      const parts = String(vals).split(/[;|:]/);
      if (parts.length !== 2) throw new Error('Cut a stick: write "n; cuts", for example "7; 1,3,4,5".');
      const n = ints(parts[0], "stick length n", { min: 1, max: 1, lo: 2, hi: 40 })[0];
      const cuts = [...new Set(ints(parts[1], "cuts", { min: 1, max: 6, lo: 1, hi: 39 }))].sort((x, y) => x - y);
      if (cuts.some((c) => c >= n)) throw new Error("Every cut must lie strictly inside the stick (1 … n − 1).");
      const pts = [0, ...cuts, n];
      return { N: pts.length, shared: true, items: pts, itemLabel: "cut points (0, cuts…, n)", name: (t) => `${pts[t]}`,
        w: (i, k, j) => pts[j] - pts[i], wText: (i, k, j) => `${pts[j]} − ${pts[i]}`, pts, n, cuts };
    }
    const v = ints(vals, "polygon values", { min: 3, max: 8, lo: 1, hi: 9 });
    return { N: v.length, shared: true, items: v, itemLabel: "polygon vertices", name: (t) => `${v[t]}`,
      w: (i, k, j) => v[i] * v[k] * v[j], wText: (i, k, j) => `${v[i]}·${v[k]}·${v[j]}`, v };
  }

  function splitDP(pb) {
    const { N, shared } = pb, dp = table(N, N, null), split = table(N, N, null), fl = shared ? 2 : 1;
    for (let i = 0; i < N; i++) for (let j = i; j < N; j++) if (j - i < fl) dp[i][j] = shared ? (j - i === 1 ? 0 : null) : 0;
    for (let len = fl; len < N; len++) for (let i = 0; i + len < N; i++) {
      const j = i + len; dp[i][j] = Infinity;
      for (let k = shared ? i + 1 : i; k < j; k++) {
        const c = dp[i][k] + dp[shared ? k : k + 1][j] + pb.w(i, k, j);
        if (c < dp[i][j]) { dp[i][j] = c; split[i][j] = k; }
      }
    }
    return { dp, split };
  }

  Viz.register(P("split"), (el, opts) => {
    let api;
    const cfg = {
      title: "Interval DP: fill by length, try every split point k",
      tag: "INTERVAL DP · SPLIT POINT",
      legend: [["active", "dp[i][j] being computed"], ["visit", "left piece dp[i][k]"], ["path", "right piece"], ["done", "best so far / finished"], ["window", "the current diagonal (same length)"]],
      codeLang: "python",
      code: blank(SPLIT_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: opts && SPLIT_MODES.includes(opts.mode) ? opts.mode : SPLIT_MODES[0], options: SPLIT_MODES },
        { key: "vals", label: "input", value: (opts && opts.vals) || SPLIT_DEF[(opts && opts.mode) || SPLIT_MODES[0]] || SPLIT_DEF[SPLIT_MODES[0]], width: 170 },
      ],
      random: () => {
        const md = SPLIT_MODES.indexOf(curMode(el, SPLIT_MODES[0]));
        if (md === 0) return { vals: Viz.randInts(Viz.rand(4, 7), 2, 40).join(",") };
        if (md === 1) return { vals: Viz.randInts(Viz.rand(4, 7), 1, 9).join(",") };
        if (md === 2) { const n = Viz.rand(8, 20), c = new Set(); const want = Viz.rand(3, 5); while (c.size < want) c.add(Viz.rand(1, n - 1)); return { vals: `${n}; ${[...c].sort((a, b) => a - b).join(",")}` }; }
        return { vals: Viz.randInts(Viz.rand(4, 7), 1, 9).join(",") };
      },
      build: ({ mode, vals }) => {
        const md = Math.max(0, SPLIT_MODES.indexOf(mode));
        setCode(el, SPLIT_CODE[md]);
        const pb = splitProblem(md, vals), { N, shared } = pb, fl = shared ? 2 : 1;
        const dp = table(N, N, null), split = table(N, N, null), fr = [];
        for (let i = 0; i < N; i++) for (let j = i; j < N; j++) if (j - i < fl && !(shared && j === i)) dp[i][j] = 0;
        const snap = (o) => fr.push({ dp: Viz.clone(dp), split: Viz.clone(split), cur: null, L: null, R: null, k: null, band: null, cands: [], ...o });
        const base = md === 0 ? "A single matrix needs no multiplication" : md === 1 ? "A single pile needs no merge" : md === 2 ? "Two neighbouring points have no cut between them" : "Two neighbouring vertices form an edge, not a triangle";
        snap({ note: `dp[i][j] answers the question for the <b>interval</b> i..j only. ${base}, so the ${shared ? "first off-diagonal (j = i + 1)" : "diagonal"} is <b>0</b>: those are the base cases. A longer interval is built from <b>shorter</b> ones on both sides of a split, so we fill one diagonal (one length) at a time, moving up and to the right.`, line: 2, vars: { cells: (N * (N + (shared ? -1 : 1))) / 2, base: 0 } });
        for (let len = fl; len < N; len++) {
          const band = []; for (let i = 0; i + len < N; i++) band.push([i, i + len]);
          snap({ band, note: `Length ${len + (shared ? 0 : 1)}: the next diagonal (dashed). Every cell on it needs only cells from diagonals already finished, which is why the outer loop is the length and not i.`, line: 3, vars: { length: len + (shared ? 0 : 1), cells: band.length } });
          for (let i = 0; i + len < N; i++) {
            const j = i + len; dp[i][j] = Infinity;
            const cands = []; let bestK = null;
            for (let k = shared ? i + 1 : i; k < j; k++) {
              const lv = dp[i][k], rr = shared ? k : k + 1, rv = dp[rr][j], w = pb.w(i, k, j), c = lv + rv + w;
              const better = c < dp[i][j];
              if (better) { dp[i][j] = c; split[i][j] = k; bestK = k; }
              cands.forEach((x) => { if (better) x.cls = ""; });
              cands.push({ k, c, cls: better ? "done" : "bad", html: `k=${k}: ${lv} + ${rv} + ${esc(pb.wText(i, k, j))} = <b>${c}</b>` });
              let what;
              if (md === 0) what = `Last multiplication at k = ${k}: (${pb.name(i)}..${pb.name(k)}) × (${pb.name(k + 1)}..${pb.name(j)}). The left product costs dp[${i}][${k}] = ${lv}, the right dp[${k + 1}][${j}] = ${rv}. They are ${pb.p[i]}×${pb.p[k + 1]} and ${pb.p[k + 1]}×${pb.p[j + 1]}, so the final multiply costs ${pb.wText(i, k, j)} = ${w}.`;
              else if (md === 1) what = `Last merge at k = ${k}: first turn a[${i}..${k}] into one pile (dp = ${lv}) and a[${k + 1}..${j}] into another (dp = ${rv}). Merging those two piles costs their total, which is always sum(a[${i}..${j}]) = ${w} whatever k is.`;
              else if (md === 2) what = `First cut at point ${pb.pts[k]} (k = ${k}): it costs the current piece's length ${pb.pts[j]} − ${pb.pts[i]} = ${w}, and leaves two independent sticks [${pb.pts[i]}, ${pb.pts[k]}] (dp = ${lv}) and [${pb.pts[k]}, ${pb.pts[j]}] (dp = ${rv}).`;
              else what = `Edge (${i}, ${j}) must belong to exactly one triangle. Try apex k = ${k}: triangle (${i}, ${k}, ${j}) scores ${pb.wText(i, k, j)} = ${w}, and it cuts the polygon into the parts i..k (dp = ${lv}) and k..j (dp = ${rv}).`;
              snap({ cur: [i, j], L: [i, k], R: [rr, j], k, cands: cands.map((x) => ({ ...x })), note: `${what} Total <b>${c}</b>. ${better ? (cands.length === 1 ? "First candidate, so it is the best so far." : "New best for this interval.") : `Not better than ${dp[i][j]} (k = ${bestK}).`}`, line: better ? [7, 8, 9, 10] : [7, 8, 9], vars: { i, j, k, "dp[i][k]": lv, [shared ? "dp[k][j]" : "dp[k+1][j]"]: rv, w, cost: c, "dp[i][j]": dp[i][j] } });
            }
            snap({ cur: [i, j], fin: true, k: bestK, L: [i, bestK], R: [shared ? bestK : bestK + 1, j], cands: cands.map((x) => ({ ...x })), note: `All ${cands.length} split${cands.length > 1 ? "s" : ""} of ${i}..${j} tried. dp[${i}][${j}] = <b>${dp[i][j]}</b> with the split at k = ${bestK} (the small tag in the cell). We remember the winning k so the answer can be rebuilt.`, line: 10, vars: { i, j, "best k": bestK, "dp[i][j]": dp[i][j] } });
          }
        }
        // Rebuild the optimal split tree.
        const tree = new Map(), order = [];
        const rec = (i, j) => {
          const id = `${i}_${j}`;
          if (j - i < fl) { if (shared) return null; tree.set(id, { lab: pb.name(i), kids: [], i, j, leaf: true }); return id; }
          const k = split[i][j];
          tree.set(id, { lab: `${i}..${j}`, i, j, k, kids: [] });
          order.push([i, k, j]);
          const a = rec(i, k), b = rec(shared ? k : k + 1, j);
          tree.get(id).kids = [a, b];
          return id;
        };
        rec(0, N - 1);
        let text;
        if (md === 0) { const par = (i, j) => (i === j ? `A${i}` : `(${par(i, split[i][j])}${par(split[i][j] + 1, j)})`); text = par(0, N - 1); }
        else if (md === 1) { const par = (i, j) => (i === j ? `${pb.a[i]}` : `(${par(i, split[i][j])} + ${par(split[i][j] + 1, j)})`); text = par(0, N - 1); }
        else if (md === 2) text = `cut order: ${order.map(([i, k]) => pb.pts[k]).join(" → ")}`;
        else text = order.map(([i, k, j]) => `(${i},${k},${j})`).join(" ");
        const ans = dp[0][N - 1];
        const sum = md === 0 ? `Optimal order <b>${text}</b> costs <b>${ans}</b> scalar multiplications.` : md === 1 ? `Optimal merge tree <b>${esc(text)}</b>: total cost <b>${ans}</b>.` : md === 2 ? `Minimum total cost <b>${ans}</b>. Read the tree top-down for the ${text}.` : `Minimum score <b>${ans}</b> from the triangles ${text}.`;
        snap({ tree, done: true, note: `Answer in the top-right cell: dp[0][${N - 1}] = <b>${ans}</b>. Following the stored splits from that cell gives the optimal <b>split tree</b>: each node is an interval, its children are the two pieces. ${sum} Time O(n³): O(n²) cells × O(n) splits; space O(n²).`, line: 11, vars: { answer: ans } });
        return fr.map((f) => ({ ...f, md, pb, N, shared }));
      },
      render: (f) => {
        const { pb, N, shared, md } = f;
        const inL = (t) => f.L && t >= f.L[0] && t <= f.L[1], inR = (t) => f.R && t >= f.R[0] && t <= f.R[1];
        const arr = Viz.array(pb.items, {
          label: pb.itemLabel,
          ptrs: f.cur ? (shared ? { i: f.cur[0], k: f.k, j: f.cur[1] } : { i: f.cur[0], j: f.cur[1] }) : {},
          ptrsTop: !shared && f.cur && f.k !== null ? { k: f.k } : undefined,
          cls: (t) => {
            if (!f.cur) return "";
            if (shared) { if (t === f.k) return "active"; if (t === f.cur[0] || t === f.cur[1]) return "accent"; if (t > f.cur[0] && t < f.k) return "visit"; if (t > f.k && t < f.cur[1]) return "path"; return t < f.cur[0] || t > f.cur[1] ? "dim" : ""; }
            if (inL(t)) return "visit"; if (inR(t)) return "path"; return "dim";
          },
        });
        const isBand = (r, c) => f.band && f.band.some(([a, b]) => a === r && b === c);
        const maxV = Math.max(1, ...f.dp.flat().filter((v) => v !== null && v !== Infinity));
        const g = tbl(f.dp, {
          label: "dp[i][j] (row i, column j); tag = best split k", size: cellSize(maxV), colLabels: Array.from({ length: N }, (_, c) => `j=${c}`), rowLabels: Array.from({ length: N }, (_, r) => `i=${r}`),
          skip: (r, c) => r > c || (shared && r === c),
          fmt: (v) => (v === Infinity ? "…" : fm(v)),
          tag: (r, c) => (f.split[r][c] !== null && f.dp[r][c] !== Infinity ? `k${f.split[r][c]}` : ""),
          cls: (r, c, v) => {
            if (f.cur && f.cur[0] === r && f.cur[1] === c) return f.fin ? "done" : "active";
            if (f.L && f.L[0] === r && f.L[1] === c) return "visit";
            if (f.R && f.R[0] === r && f.R[1] === c) return "path";
            if (f.done && r === 0 && c === N - 1) return "done";
            if (isBand(r, c)) return "window";
            return v === null ? "dim" : "";
          },
        });
        let extra = "";
        if (md === 2 && f.cur) {
          const L = pb.n, Wd = 520, X = (x) => 20 + (x / L) * Wd, y = 34;
          let s = `<line class="dit-stick" x1="${X(0)}" y1="${y}" x2="${X(L)}" y2="${y}"/>`;
          s += `<line class="dit-stick on" x1="${X(pb.pts[f.cur[0]])}" y1="${y}" x2="${X(pb.pts[f.cur[1]])}" y2="${y}"/>`;
          pb.pts.forEach((x, t) => { s += `<line class="dit-tick ${t === f.k ? "cut" : ""}" x1="${X(x)}" y1="${y - 14}" x2="${X(x)}" y2="${y + 14}"/><text class="dit-lab" x="${X(x)}" y="${y + 30}" text-anchor="middle">${x}</text>`; });
          extra = Viz.labeled(`the piece [${pb.pts[f.cur[0]]}, ${pb.pts[f.cur[1]]}] (bold) and the cut being tried`, `<svg class="dg dit-g" viewBox="0 0 560 72" width="560" height="72">${s}</svg>`);
        }
        if (md === 3) {
          const ids = pb.v.map((_, t) => String(t)), pos = Viz.layout.circle(ids, 82);
          const nodes = pos.map((p, t) => ({ ...p, label: pb.v[t], top: undefined }));
          const edges = []; const ecl = {};
          for (let t = 0; t < N; t++) edges.push({ u: String(t), v: String((t + 1) % N) });
          const tri = (i, k, j, cl) => { [[i, k], [k, j], [i, j]].forEach(([a, b]) => { if (!edges.some((e) => (e.u === String(a) && e.v === String(b)) || (e.u === String(b) && e.v === String(a)))) edges.push({ u: String(a), v: String(b) }); ecl[`${a}-${b}`] = cl; }); };
          if (f.done) f.tree.forEach((nd) => { if (!nd.leaf) tri(nd.i, nd.k, nd.j, "path"); });
          else if (f.cur && f.k !== null) tri(f.cur[0], f.k, f.cur[1], f.fin ? "done" : "active");
          const nc = {};
          if (f.cur && !f.done) { for (let t = 0; t < N; t++) nc[t] = t === f.k ? "active" : t >= f.cur[0] && t <= f.cur[1] ? "" : "dim"; }
          extra = Viz.graph({ nodes, edges }, { r: 17, label: f.done ? "the optimal triangulation" : "triangle (i, k, j) being tried", nodeCls: (id) => nc[id] || "", edgeCls: (key) => { const [a, b] = key.split("-"); return ecl[`${a}-${b}`] || ecl[`${b}-${a}`] || ""; } });
        }
        let treeHtml = "";
        if (f.done) {
          const lay = Viz.layoutTree(`0_${N - 1}`, (id) => (f.tree.get(id).kids.length ? f.tree.get(id).kids : []), (id) => f.tree.get(id).lab, { dx: 50, dy: 62 });
          lay.nodes.forEach((nd) => { const t = f.tree.get(nd.id); if (!t.leaf) nd.sub = `${f.dp[t.i][t.j]}`; });
          treeHtml = Viz.graph(lay, { r: 20, label: "optimal split tree (sub-label = dp of that interval)", nodeCls: (id) => (f.tree.get(id).leaf ? "" : "path") });
        }
        const cand = f.cur ? chips(`candidates for dp[${f.cur[0]}][${f.cur[1]}]`, f.cands) : "";
        return col(row(arr, extra), row(g, col(cand, treeHtml)));
      },
    };
    api = Viz.player(el, cfg);
    return onMode(el, api, SPLIT_DEF);
  });

  /* =====================================================================
     2. Burst balloons: think about the LAST balloon
     ===================================================================== */
  const BB_CODE = [
    "def max_coins(nums):",
    "    v = [1] + nums + [1]                 # walls that never burst",
    "    n = len(v)",
    "    dp = [[0] * n for _ in range(n)]     # dp[i][j]: best for OPEN interval (i, j)",
    "    for length in range(2, n):           # j - i; length 1 has nothing inside",
    "        for i in range(n - length):",
    "            j = i + length",
    "            for k in range(i + 1, j):    # k is the LAST balloon popped in (i, j)",
    "                coins = dp[i][k] + v[i] * v[k] * v[j] + dp[k][j]",
    "                if coins > dp[i][j]:",
    "                    dp[i][j], last[i][j] = coins, k",
    "    return dp[0][n - 1]",
  ];
  Viz.register(P("balloons"), (el, opts) => Viz.player(el, {
    title: "Burst Balloons: choose the balloon that pops LAST, and the walls stay put",
    tag: "INTERVAL DP · REPLAY",
    legend: [["active", "k: popped last in (i, j)"], ["accent", "walls i and j (still alive)"], ["visit", "left part, cleared first"], ["path", "right part, cleared first"], ["done", "best so far"], ["dim", "outside / already popped"]],
    codeLang: "python",
    code: BB_CODE,
    inputs: [{ key: "nums", label: "nums (≤ 6)", value: (opts && opts.nums) || "3,1,5,8", width: 150 }],
    random: () => ({ nums: Viz.randInts(Viz.rand(3, 6), 1, 9).join(",") }),
    build: ({ nums }) => {
      const a = ints(nums, "nums", { min: 1, max: 6, lo: 0, hi: 9 });
      const v = [1, ...a, 1], N = v.length, dp = table(N, N, null), last = table(N, N, null), fr = [];
      for (let i = 0; i + 1 < N; i++) dp[i][i + 1] = 0;
      const snap = (o) => fr.push({ dp: Viz.clone(dp), last: Viz.clone(last), cur: null, k: null, cands: [], phase: "dp", ...o });
      snap({ note: `Pad with a 1 on each side: these walls never burst. dp[i][j] = the most coins from bursting <b>every balloon strictly between</b> i and j while i and j are still standing. Neighbouring indices (j = i + 1) have nothing between them, so those cells are <b>0</b>.`, line: [1, 3], vars: { n: N } });
      for (let len = 2; len < N; len++) for (let i = 0; i + len < N; i++) {
        const j = i + len; dp[i][j] = -1; const cands = []; let bk = null;
        for (let k = i + 1; k < j; k++) {
          const c = dp[i][k] + v[i] * v[k] * v[j] + dp[k][j], better = c > dp[i][j];
          if (better) { dp[i][j] = c; last[i][j] = k; bk = k; cands.forEach((x) => { x.cls = ""; }); }
          cands.push({ cls: better ? "done" : "bad", html: `k=${k}: ${dp[i][k]} + ${v[i]}·${v[k]}·${v[j]} + ${dp[k][j]} = <b>${c}</b>` });
          snap({ cur: [i, j], k, cands: cands.map((x) => ({ ...x })), note: `Suppose balloon ${k} (value ${v[k]}) is the <b>last</b> one popped between the walls ${i} and ${j}. Then when it pops, its neighbours can only be the walls: it earns ${v[i]}·${v[k]}·${v[j]} = ${v[i] * v[k] * v[j]}. Until then ${k} stands between the two sides, so the left side (${i}, ${k}) and the right side (${k}, ${j}) never touch each other: dp[${i}][${k}] = ${dp[i][k]} and dp[${k}][${j}] = ${dp[k][j]}. Total <b>${c}</b>${better ? (cands.length > 1 ? ", the new best" : "") : `, not better than ${dp[i][j]}`}.`, line: better ? [7, 8, 9, 10] : [7, 8, 9], vars: { i, j, k, "dp[i][k]": dp[i][k], "v[i]·v[k]·v[j]": v[i] * v[k] * v[j], "dp[k][j]": dp[k][j], coins: c, "dp[i][j]": dp[i][j] } });
        }
        snap({ cur: [i, j], fin: true, k: bk, cands: cands.map((x) => ({ ...x })), note: `dp[${i}][${j}] = <b>${dp[i][j]}</b>: balloon ${bk} goes last in this interval.`, line: 10, vars: { i, j, last: bk, "dp[i][j]": dp[i][j] } });
      }
      const order = []; const rec = (i, j) => { if (j - i < 2) return; const k = last[i][j]; rec(i, k); rec(k, j); order.push(k); };
      rec(0, N - 1);
      const alive = Array(N).fill(true); let total = 0;
      snap({ phase: "replay", popped: [], total, note: `Table done: the answer is dp[0][${N - 1}] = <b>${dp[0][N - 1]}</b>. Now <b>replay</b> it. Reading the stored "last" choices recursively gives a real burst order: ${order.map((k) => `${k}`).join(" → ")} (indices into the padded row). Watch the coins add up to the same number.`, line: 11, vars: { answer: dp[0][N - 1], order: order.join(",") } });
      const popped = [];
      for (const k of order) {
        let l = k - 1; while (!alive[l]) l--;
        let r = k + 1; while (!alive[r]) r++;
        const c = v[l] * v[k] * v[r]; total += c; alive[k] = false; popped.push(k);
        snap({ phase: "replay", popped: popped.slice(), pk: k, nb: [l, r], total, note: `Pop balloon ${k} (value ${v[k]}). Its live neighbours are ${l} (${v[l]}) and ${r} (${v[r]}): +${v[l]}·${v[k]}·${v[r]} = ${c}. Running total ${total}.`, line: 8, vars: { pop: k, left: l, right: r, coins: c, total } });
      }
      snap({ phase: "replay", popped: popped.slice(), total, end: true, note: `Every balloon is gone and the total is <b>${total}</b>, exactly dp[0][${N - 1}]. The forward question "which balloon first?" has no clean subproblem, because popping one makes its two neighbours adjacent. Asking "which balloon <b>last</b>?" fixes both of its neighbours, so the two sides become independent intervals. O(n³) time, O(n²) space.`, line: 11, vars: { total, answer: dp[0][N - 1] } });
      return fr.map((f) => ({ ...f, v, N }));
    },
    render: (f) => {
      const { v, N } = f;
      let arr;
      if (f.phase === "dp") {
        arr = Viz.array(v, {
          label: "balloons with walls: v = [1] + nums + [1]",
          ptrs: f.cur ? { i: f.cur[0], k: f.k, j: f.cur[1] } : {},
          cls: (t) => {
            if (!f.cur) return t === 0 || t === N - 1 ? "accent" : "";
            if (t === f.k) return "active";
            if (t === f.cur[0] || t === f.cur[1]) return "accent";
            if (t > f.cur[0] && t < f.k) return "visit";
            if (t > f.k && t < f.cur[1]) return "path";
            return "dim";
          },
        });
      } else {
        const gone = new Set(f.popped);
        arr = Viz.array(v, { label: "replay: popped balloons fade", ptrs: f.pk !== undefined ? { pop: f.pk } : {}, cls: (t) => (t === f.pk ? "active" : f.nb && f.nb.includes(t) ? "accent" : gone.has(t) ? "dim" : t === 0 || t === N - 1 ? "accent" : "") });
      }
      const maxV = Math.max(1, ...f.dp.flat().filter((x) => x !== null && x >= 0));
      const g = tbl(f.dp, {
        label: "dp[i][j]: best for the open interval (i, j); tag = last balloon", size: cellSize(maxV), colLabels: Array.from({ length: N }, (_, c) => `j=${c}`), rowLabels: Array.from({ length: N }, (_, r) => `i=${r}`),
        skip: (r, c) => c <= r,
        fmt: (x) => (x === -1 ? "…" : fm(x)),
        tag: (r, c) => (f.last[r][c] !== null ? `k${f.last[r][c]}` : ""),
        cls: (r, c, x) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return f.fin ? "done" : "active";
          if (f.cur && f.k !== null && r === f.cur[0] && c === f.k) return "visit";
          if (f.cur && f.k !== null && r === f.k && c === f.cur[1]) return "path";
          if (f.phase === "replay" && r === 0 && c === N - 1) return "done";
          return x === null ? "dim" : "";
        },
      });
      const side = f.phase === "dp" ? chips(f.cur ? `candidates for dp[${f.cur[0]}][${f.cur[1]}]` : "candidates", f.cands) : answer(f.end ? "replayed total = dp[0][n−1]" : "coins so far", f.total, f.end ? "done" : "active");
      return col(arr, row(g, side));
    },
  }));

  /* =====================================================================
     3. Two-player "take an end" games: dp = best score DIFFERENCE for the mover
     ===================================================================== */
  const GAME_MODES = ["predict the winner (486)", "stone game VII (1690)"];
  const GAME_DEF = { [GAME_MODES[0]]: "1,5,233,7", [GAME_MODES[1]]: "5,3,1,4,2" };
  const GAME_CODE = [
    [
      "def predict_the_winner(a):",
      "    n = len(a); dp = [[0] * n for _ in range(n)]",
      "    for i in range(n): dp[i][i] = a[i]   # one number left: take it",
      "    for length in range(2, n + 1):",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            left = a[i] - dp[i + 1][j]       # I take a[i]; opponent then leads by dp[i+1][j]",
      "            right = a[j] - dp[i][j - 1]      # I take a[j]",
      "            dp[i][j] = max(left, right)      # my best lead on a[i..j]",
      "    return dp[0][n - 1] >= 0",
    ],
    [
      "def stone_game_vii(a):",
      "    n = len(a); pre = prefix_sums(a); dp = [[0] * n for _ in range(n)]",
      "    # dp[i][i] = 0: removing the last stone scores nothing",
      "    for length in range(2, n + 1):",
      "        for i in range(n - length + 1):",
      "            j = i + length - 1",
      "            left = (pre[j + 1] - pre[i + 1]) - dp[i + 1][j]   # remove a[i], score the rest",
      "            right = (pre[j] - pre[i]) - dp[i][j - 1]          # remove a[j]",
      "            dp[i][j] = max(left, right)",
      "    return dp[0][n - 1]",
    ],
  ];
  Viz.register(P("game"), (el, opts) => {
    const cfg = {
      title: "Take-an-end games: store the score difference, not the score",
      tag: "INTERVAL DP · MINIMAX",
      legend: [["active", "dp[i][j] being computed"], ["visit", "if I take the left end"], ["path", "if I take the right end"], ["done", "chosen / finished"], ["dim", "already taken"]],
      codeLang: "python",
      code: blank(GAME_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: GAME_MODES[0], options: GAME_MODES },
        { key: "vals", label: "row", value: (opts && opts.vals) || GAME_DEF[GAME_MODES[0]], width: 150 },
      ],
      random: () => ({ vals: Viz.randInts(Viz.rand(4, 7), 1, 12).join(",") }),
      build: ({ mode, vals }) => {
        const md = Math.max(0, GAME_MODES.indexOf(mode));
        setCode(el, GAME_CODE[md]);
        const a = ints(vals, "row", { min: 2, max: 8, lo: 1, hi: 300 }), n = a.length;
        const pre = [0]; a.forEach((x) => pre.push(pre[pre.length - 1] + x));
        const S = (i, j) => (j < i ? 0 : pre[j + 1] - pre[i]);
        const dp = table(n, n, null), fr = [];
        for (let i = 0; i < n; i++) dp[i][i] = md === 0 ? a[i] : 0;
        const snap = (o) => fr.push({ dp: Viz.clone(dp), cur: null, ...o });
        snap({ note: `dp[i][j] = how far ahead the player <b>about to move</b> ends up on the row a[i..j], assuming both play perfectly. Storing a difference means one table serves both players: whoever moves is "me". ${md === 0 ? "With one number left you simply take it, so dp[i][i] = a[i]." : "With one stone left, removing it leaves nothing to score, so dp[i][i] = 0."}`, line: 2, vars: { n } });
        for (let len = 2; len <= n; len++) for (let i = 0; i + len - 1 < n; i++) {
          const j = i + len - 1;
          const gL = md === 0 ? a[i] : S(i + 1, j), gR = md === 0 ? a[j] : S(i, j - 1);
          const L = gL - dp[i + 1][j], R = gR - dp[i][j - 1], best = Math.max(L, R);
          snap({ cur: [i, j], arrows: [{ from: [i + 1, j], to: [i, j], cls: "visit", label: `${gL}−` }, { from: [i, j - 1], to: [i, j], cls: "path", label: `${gR}−` }], note: `Row a[${i}..${j}]. <b>Take the left end</b>: I gain ${md === 0 ? `a[${i}] = ${gL}` : `the sum of the rest, ${gL}`}, then my opponent moves on a[${i + 1}..${j}] and gets ahead by dp[${i + 1}][${j}] = ${dp[i + 1][j]}. Net ${gL} − ${dp[i + 1][j]} = <b>${L}</b>. <b>Take the right end</b>: ${gR} − dp[${i}][${j - 1}] = ${gR} − ${dp[i][j - 1]} = <b>${R}</b>. Both sources are one diagonal shorter (below and to the left).`, line: [6, 7], vars: { i, j, left: L, right: R } });
          dp[i][j] = best;
          snap({ cur: [i, j], fin: true, choice: L >= R ? "L" : "R", arrows: [L >= R ? { from: [i + 1, j], to: [i, j], cls: "done", label: `${gL}−` } : { from: [i, j - 1], to: [i, j], cls: "done", label: `${gR}−` }], note: `dp[${i}][${j}] = max(${L}, ${R}) = <b>${best}</b>: the mover should take the ${L >= R ? "left" : "right"} end here.`, line: 8, vars: { i, j, "dp[i][j]": best } });
        }
        const D = dp[0][n - 1];
        snap({ play: true, taken: [], sc: [0, 0], note: `Table done: dp[0][${n - 1}] = <b>${D}</b>. ${md === 0 ? (D >= 0 ? "Player 1 can at least tie, so the answer is true." : "Player 1 falls behind whatever they do, so the answer is false.") : `Alice can finish ${D} points ahead.`} Now let both players follow the table and watch the actual scores.`, line: 9, vars: { "dp[0][n-1]": D } });
        let i = 0, j = n - 1, who = 0; const sc = [0, 0], taken = [];
        while (i <= j) {
          const gL = md === 0 ? a[i] : S(i + 1, j), gR = md === 0 ? a[j] : S(i, j - 1);
          const L = gL - (i + 1 <= j ? dp[i + 1][j] : 0), R = gR - (i <= j - 1 ? dp[i][j - 1] : 0);
          const left = L >= R, t = left ? i : j, g = left ? gL : gR;
          sc[who] += g; taken.push(t);
          snap({ play: true, taken: taken.slice(), last: t, sc: sc.slice(), who, note: `${who ? "Player 2" : "Player 1"} looks at dp for a[${i}..${j}] and takes the <b>${left ? "left" : "right"}</b> end (value ${a[t]}), scoring ${g}. Scores: ${sc[0]} vs ${sc[1]}.`, line: left ? 6 : 7, vars: { mover: who ? "P2" : "P1", took: a[t], P1: sc[0], P2: sc[1] } });
          if (left) i++; else j--; who ^= 1;
        }
        snap({ play: true, taken: taken.slice(), sc: sc.slice(), end: true, note: `Game over: ${sc[0]} − ${sc[1]} = <b>${sc[0] - sc[1]}</b>, exactly dp[0][${n - 1}]. Each cell was filled from two cells one diagonal shorter, so the fill order is again "by length". O(n²) time and space (O(n) with a rolling row).`, line: 9, vars: { P1: sc[0], P2: sc[1], diff: sc[0] - sc[1] } });
        return fr.map((f) => ({ ...f, a, n }));
      },
      render: (f) => {
        const { a, n } = f;
        const tk = new Set(f.taken || []);
        const arr = Viz.array(a, {
          label: f.play ? "the row during optimal play" : "the row",
          ptrs: f.cur ? { i: f.cur[0], j: f.cur[1] } : {},
          cls: (t) => {
            if (f.play) return t === f.last ? (f.who ? "path" : "visit") : tk.has(t) ? "dim" : "";
            if (!f.cur) return "";
            if (t < f.cur[0] || t > f.cur[1]) return "dim";
            if (f.fin) return (f.choice === "L" && t === f.cur[0]) || (f.choice === "R" && t === f.cur[1]) ? "done" : "";
            return t === f.cur[0] ? "visit" : t === f.cur[1] ? "path" : "";
          },
        });
        const maxV = Math.max(1, ...f.dp.flat().filter((v) => v !== null).map((v) => Math.abs(v)));
        const g = tbl(f.dp, {
          label: "dp[i][j]: mover's best lead on a[i..j]", size: Math.max(46, cellSize(maxV)), colLabels: Array.from({ length: n }, (_, c) => `j=${c}`), rowLabels: Array.from({ length: n }, (_, r) => `i=${r}`),
          skip: (r, c) => c < r, arrows: f.arrows,
          cls: (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c ? (f.fin ? "done" : "active") : (f.play && r === 0 && c === n - 1) ? "done" : v === null ? "dim" : ""),
        });
        const side = f.play ? col(answer("player 1", f.sc[0], f.who === 0 && !f.end ? "visit" : ""), answer("player 2", f.sc[1], f.who === 1 && !f.end ? "path" : ""), f.end ? answer("difference", f.sc[0] - f.sc[1]) : "") : "";
        return col(arr, row(g, side));
      },
    };
    const api = Viz.player(el, cfg);
    return onMode(el, api, GAME_DEF);
  });

  /* =====================================================================
     4. Remove Boxes: dp(l, r, k) with k ghost boxes glued to the left
     ===================================================================== */
  const RB_CODE = [
    "@cache",
    "def dp(l, r, k):                 # boxes[l..r], plus k extra boxes equal to boxes[l] glued on its left",
    "    if l > r: return 0",
    "    while l < r and boxes[l + 1] == boxes[l]:",
    "        l += 1; k += 1             # absorb equal neighbours into the glued group",
    "    best = (k + 1) ** 2 + dp(l + 1, r, 0)          # A: remove the group now",
    "    for m in range(l + 1, r + 1):",
    "        if boxes[m] == boxes[l]:                     # B: clear l+1..m-1 first,",
    "            best = max(best, dp(l + 1, m - 1, 0)     #    then the group joins boxes[m]",
    "                             + dp(m, r, k + 1))",
    "    return best",
    "# answer = dp(0, n - 1, 0)",
  ];
  Viz.register(P("boxes"), (el, opts) => Viz.player(el, {
    title: "Remove Boxes: when two indices are not enough, add what the subproblem cannot see",
    tag: "INTERVAL DP · 3D STATE",
    legend: [["active", "boxes[l] and its glued group"], ["visit", "ghost boxes (the k extra)"], ["path", "same colour further right (option B targets)"], ["done", "returned / memo hit"], ["dim", "outside l..r"]],
    codeLang: "python",
    code: RB_CODE,
    inputs: [{ key: "boxes", label: "boxes (≤ 9)", value: (opts && opts.boxes) || "1,3,2,2,2,3,4,3,1", width: 190 }],
    random: () => ({ boxes: Viz.randInts(Viz.rand(5, 8), 1, 3).join(",") }),
    build: ({ boxes }) => {
      const b = ints(boxes, "boxes", { min: 1, max: 9, lo: 1, hi: 9 }), n = b.length;
      const memo = new Map(), fr = [], stack = []; let calls = 0, hits = 0;
      const snap = (o) => { if (fr.length < 360) fr.push({ stack: stack.slice(), memoN: memo.size, calls, hits, ...o }); };
      snap({ note: `Removing a group of x equal adjacent boxes scores x². Plain dp[l][r] fails: how much boxes[l] is worth depends on equal boxes that were <b>outside</b> the interval and may get glued to it later. So the state carries a third number <b>k</b>: how many boxes equal to boxes[l] are already glued on its left (drawn as ghosts).`, line: 1, vars: { n } });
      const f = (l, r, k) => {
        calls++;
        if (l > r) return 0;
        const key = `${l},${r},${k}`;
        if (memo.has(key)) { hits++; snap({ l, r, k, hit: true, ret: memo.get(key), note: `dp(${l}, ${r}, ${k}) was solved before: memo hit, returns <b>${memo.get(key)}</b> immediately.`, line: 0, vars: { l, r, k, ret: memo.get(key) } }); return memo.get(key); }
        stack.push(`dp(${l},${r},${k})`);
        snap({ l, r, k, note: `Call dp(${l}, ${r}, ${k}): boxes ${l}..${r} = [${b.slice(l, r + 1).join(",")}] with ${k} ghost ${b[l]}${k === 1 ? "" : "s"} glued in front.`, line: 1, vars: { l, r, k } });
        let L = l, K = k;
        while (L < r && b[L + 1] === b[L]) { L++; K++; }
        if (L !== l) snap({ l: L, r, k: K, ol: l, note: `boxes[${l + 1}..${L}] equal boxes[${l}] = ${b[l]}: absorb them, so we work on dp(${L}, ${r}, ${K}). Same answer, fewer options to try.`, line: [3, 4], vars: { l: L, r, k: K } });
        let best = (K + 1) ** 2 + f(L + 1, r, 0), arg = "A";
        const opt = [`A: ${(K + 1)}² + dp(${L + 1},${r},0) = ${best}`];
        for (let m = L + 1; m <= r; m++) if (b[m] === b[L]) {
          snap({ l: L, r, k: K, m, note: `Option B with m = ${m}: first clear boxes ${L + 1}..${m - 1} on their own, so the group of ${K + 1} ${b[L]}'s slides next to box ${m} and becomes ${K + 1} ghosts for dp(${m}, ${r}, ${K + 1}).`, line: [7, 8, 9], vars: { l: L, r, k: K, m, best } });
          const v = f(L + 1, m - 1, 0) + f(m, r, K + 1);
          opt.push(`B m=${m}: ${v}`);
          if (v > best) { best = v; arg = `B m=${m}`; }
        }
        memo.set(key, best); stack.pop();
        snap({ l: L, r, k: K, ret: best, opts: opt, note: `dp(${l}, ${r}, ${k}) = <b>${best}</b> via ${arg === "A" ? "option A (remove the group now)" : arg.replace("B", "option B,")}. Stored in the memo.`, line: 10, vars: { l, r, k, ret: best, memo: memo.size } });
        return best;
      };
      const ans = f(0, n - 1, 0);
      fr.push({ stack: [], memoN: memo.size, calls, hits, l: 0, r: n - 1, k: 0, ret: ans, end: true, note: `Answer dp(0, ${n - 1}, 0) = <b>${ans}</b>. ${memo.size} states were solved and the memo answered ${hits} repeat calls. States are O(n³), each tries O(n) values of m: O(n⁴) time worst case, O(n³) memory.${fr.length >= 360 ? " (Only the first 360 steps are shown.)" : ""}`, line: 11, vars: { answer: ans, states: memo.size, "memo hits": hits } });
      return fr.map((x) => ({ ...x, b, n }));
    },
    render: (f) => {
      const { b, n } = f;
      const cells = [], cls = [];
      for (let g = 0; g < (f.k || 0) && !f.end; g++) { cells.push(b[f.l]); cls.push("visit ghost"); }
      const idx = [];
      for (let t = 0; t < n; t++) { cells.push(b[t]); idx.push(t); cls.push(f.end ? "done" : t < (f.ol ?? f.l) || t > f.r ? "dim" : t >= (f.ol ?? f.l) && t <= f.l ? "active" : t === f.m ? "path" : b[t] === b[f.l] && t > f.l ? "path" : ""); }
      const ghosts = f.end ? 0 : f.k || 0;
      const arr = Viz.array(cells, { label: ghosts ? `${ghosts} ghost${ghosts > 1 ? "s" : ""} (dashed) + boxes` : "boxes", cls: (t) => cls[t], idxLabel: (t) => (t < ghosts ? "+" : idx[t - ghosts]), ptrs: f.end ? {} : { l: f.l + ghosts, r: f.r + ghosts, m: f.m !== undefined ? f.m + ghosts : null } });
      const st = Viz.stack(f.stack.slice().reverse(), { label: "call stack", cls: (i) => (i === 0 ? "active" : "") });
      const info = col(answer(f.end ? "answer" : f.hit ? "memo hit" : "returned", f.ret === undefined ? "…" : f.ret, f.ret === undefined ? "" : "done"), Viz.labeled("memo states / hits", `<div class="v-item">${f.memoN} / ${f.hits}</div>`), f.opts ? chips("options", f.opts.map((o) => ({ html: esc(o) }))) : "");
      return col(arr, row(st, info));
    },
  }));

  /* =====================================================================
     5. Knuth optimisation: opt[i][j-1] <= opt[i][j] <= opt[i+1][j]
     ===================================================================== */
  const KN_CODE = [
    "def merge_stones_knuth(a):",
    "    n = len(a); pre = prefix_sums(a)",
    "    dp = [[0] * n for _ in range(n)]; opt = [[i] * n for i in range(n)]",
    "    for length in range(2, n + 1):",
    "        for i in range(n - length + 1):",
    "            j = i + length - 1; dp[i][j] = inf",
    "            lo, hi = opt[i][j - 1], min(opt[i + 1][j], j - 1)   # the window",
    "            for k in range(lo, hi + 1):",
    "                c = dp[i][k] + dp[k + 1][j] + pre[j + 1] - pre[i]",
    "                if c < dp[i][j]: dp[i][j], opt[i][j] = c, k",
    "    return dp[0][n - 1]          # O(n²) total instead of O(n³)",
  ];
  Viz.register(P("knuth"), (el, opts) => Viz.player(el, {
    title: "Knuth's optimisation: the best split only moves right",
    tag: "INTERVAL DP · OPTIMISATION",
    legend: [["active", "dp[i][j] being computed"], ["visit", "opt[i][j−1]: window start"], ["path", "opt[i+1][j]: window end"], ["window", "split points actually tried"], ["done", "finished"]],
    codeLang: "python",
    code: KN_CODE,
    inputs: [{ key: "a", label: "stones (≤ 10)", value: (opts && opts.a) || "4,1,3,8,2,6,5,7", width: 190 }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 10), 1, 9).join(",") }),
    build: ({ a }) => {
      const v = ints(a, "stones", { min: 2, max: 10, lo: 1, hi: 40 }), n = v.length;
      const pre = [0]; v.forEach((x) => pre.push(pre[pre.length - 1] + x));
      const dp = table(n, n, null), opt = table(n, n, null), fr = [];
      for (let i = 0; i < n; i++) { dp[i][i] = 0; opt[i][i] = i; }
      let tried = 0, plain = 0;
      const snap = (o) => fr.push({ dp: Viz.clone(dp), opt: Viz.clone(opt), tried, plain, cur: null, ...o });
      snap({ note: `The same merge-stones DP as before, but we also record opt[i][j], the split that won. For costs like "sum of the interval" (they satisfy the quadrangle inequality) the winner is <b>monotone</b>: opt[i][j−1] ≤ opt[i][j] ≤ opt[i+1][j]. So each cell only scans the window between two already-known splits.`, line: 2, vars: { n } });
      for (let len = 2; len <= n; len++) for (let i = 0; i + len - 1 < n; i++) {
        const j = i + len - 1, lo = opt[i][j - 1], hi = Math.min(opt[i + 1][j], j - 1);
        dp[i][j] = Infinity; const cs = [];
        for (let k = lo; k <= hi; k++) { const c = dp[i][k] + dp[k + 1][j] + pre[j + 1] - pre[i]; cs.push(`k=${k}: ${c}`); if (c < dp[i][j]) { dp[i][j] = c; opt[i][j] = k; } tried++; }
        plain += j - i;
        snap({ cur: [i, j], lo, hi, cs, note: `dp[${i}][${j}]: the window is k ∈ [opt[${i}][${j - 1}], opt[${i + 1}][${j}]] = [${lo}, ${hi}], so ${hi - lo + 1} split${hi === lo ? "" : "s"} tried${hi - lo + 1 < j - i ? ` instead of ${j - i}` : ` (the plain loop also tries ${j - i})`}. Best: k = ${opt[i][j]}, cost <b>${dp[i][j]}</b>.`, line: [6, 7, 8, 9], vars: { i, j, lo, hi, "opt[i][j]": opt[i][j], "dp[i][j]": dp[i][j], "tried so far": tried, "plain would try": plain } });
      }
      const chk = splitDP({ N: n, shared: false, w: (i, k, j) => pre[j + 1] - pre[i] }).dp[0][n - 1];
      snap({ end: true, note: `Answer <b>${dp[0][n - 1]}</b> (the plain O(n³) DP also gives ${chk}). Split points tried: <b>${tried}</b> with Knuth versus ${plain} without. Along each diagonal the windows overlap only at their ends and telescope to O(n), so the total is O(n²). Details and proof sketch: State Machines & DP Optimisations.`, line: 10, vars: { answer: dp[0][n - 1], tried, plain } });
      return fr.map((f) => ({ ...f, v, n }));
    },
    render: (f) => {
      const { v, n } = f;
      const arr = Viz.array(v, { label: "stones", ptrs: f.cur ? { i: f.cur[0], j: f.cur[1] } : {}, ptrsTop: f.cur ? { lo: f.lo, hi: f.hi } : undefined, cls: (t) => (!f.cur ? "" : t < f.cur[0] || t > f.cur[1] ? "dim" : t >= f.lo && t <= f.hi ? "window" : "") });
      const lab = { colLabels: Array.from({ length: n }, (_, c) => `${c}`), rowLabels: Array.from({ length: n }, (_, r) => `${r}`), rowLabelW: 22, skip: (r, c) => c < r };
      const maxV = Math.max(1, ...f.dp.flat().filter((x) => x !== null && x !== Infinity));
      const g1 = tbl(f.dp, { ...lab, label: "dp[i][j]", size: Math.min(46, cellSize(maxV)), gap: 4, cls: (r, c, x) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : f.end && r === 0 && c === n - 1 ? "done" : x === null ? "dim" : "") });
      const g2 = tbl(f.opt, { ...lab, label: "opt[i][j] (winning k)", size: 34, gap: 4, cls: (r, c, x) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : f.cur && r === f.cur[0] && c === f.cur[1] - 1 ? "visit" : f.cur && r === f.cur[0] + 1 && c === f.cur[1] ? "path" : x === null ? "dim" : "") });
      const bars = Viz.labeled("split points tried", `<div class="dit-meter"><span>Knuth</span><div><i class="k" style="width:${f.plain ? (100 * f.tried) / f.plain : 0}%"></i></div><b>${f.tried}</b><span>plain</span><div><i style="width:${f.plain ? 100 : 0}%"></i></div><b>${f.plain}</b></div>`);
      return col(arr, row(g1, g2), row(bars, f.cs ? chips("window", f.cs.map((c) => ({ html: c }))) : ""));
    },
  }));

  /* ---------- tree helpers (level-order binary trees, parent-array trees, edge lists) ---------- */
  function parseLevel(s, { maxN = 15, lo = 0, hi = 99, what = "tree" } = {}) {
    const t = String(s ?? "").replace(/[\[\]]/g, "").split(/[\s,]+/).filter(Boolean);
    if (!t.length) throw new Error(`${what}: give a level-order list such as 3,4,5,1,3,null,1.`);
    const raw = t.map((x) => (/^(null|#|-|n)$/i.test(x) ? null : Number(x)));
    if (raw.some((x) => x !== null && !Number.isInteger(x))) throw new Error(`${what}: use whole numbers or null.`);
    if (raw[0] === null) throw new Error(`${what}: the root cannot be null.`);
    if (raw.some((x) => x !== null && (x < lo || x > hi))) throw new Error(`${what}: values must be between ${lo} and ${hi}.`);
    const val = [raw[0]], L = [null], R = [null], q = [0]; let p = 1;
    while (q.length && p < raw.length) {
      const u = q.shift();
      for (const side of [L, R]) { if (p >= raw.length) break; const x = raw[p++]; if (x !== null) { const id = val.length; val.push(x); L.push(null); R.push(null); side[u] = id; q.push(id); } }
    }
    if (p < raw.length && raw.slice(p).some((x) => x !== null)) throw new Error(`${what}: some values have no parent (too many after the nulls).`);
    if (val.length > maxN) throw new Error(`${what}: at most ${maxN} nodes, please.`);
    return { val, L, R, n: val.length };
  }
  function randLevel(n, lo, hi) {
    const L = [null], R = [null];
    for (let id = 1; id < n; id++) {
      const free = []; for (let u = 0; u < id; u++) { if (L[u] === null) free.push([u, L]); if (R[u] === null) free.push([u, R]); }
      const [u, side] = free[Viz.rand(0, Math.min(free.length - 1, 2 + Math.floor(free.length / 2)))];
      side[u] = id; L.push(null); R.push(null);
    }
    const out = [], q = [0];
    while (q.length) { const u = q.shift(); if (u === null) { out.push("null"); continue; } out.push(String(Viz.rand(lo, hi))); q.push(L[u], R[u]); }
    while (out[out.length - 1] === "null") out.pop();
    return out.join(",");
  }
  const binLayout = (T, label, o = {}) => Viz.layoutTree(0, (id) => (T.L[id] === null && T.R[id] === null ? [] : [T.L[id], T.R[id]]), label, { dx: o.dx || 50, dy: o.dy || 70 });
  const postOrder = (T) => { const out = []; const go = (u) => { if (u === null) return; go(T.L[u]); go(T.R[u]); out.push(u); }; go(0); return out; };

  /* =====================================================================
     6. House Robber III: each node returns the pair (rob, skip)
     ===================================================================== */
  const HR_CODE = [
    "def rob(root):",
    "    def go(node):                  # returns (best if node robbed, best if node skipped)",
    "        if not node: return (0, 0)",
    "        lr, ls = go(node.left)",
    "        rr, rs = go(node.right)",
    "        robbed = node.val + ls + rs  # robbing node forbids robbing its children",
    "        skipped = max(lr, ls) + max(rr, rs)   # children are free to choose",
    "        return (robbed, skipped)",
    "    return max(go(root))",
  ];
  Viz.register(P("robber"), (el, opts) => Viz.player(el, {
    title: "House Robber III: every node hands its parent a pair (rob, skip)",
    tag: "TREE DP · POST-ORDER",
    legend: [["active", "node being combined"], ["visit", "children whose pairs are read"], ["done", "pair ready (sub-label rob / skip)"], ["path", "robbed in the optimal plan"], ["dim", "not processed yet"]],
    codeLang: "python",
    code: HR_CODE,
    inputs: [{ key: "tree", label: "tree (level order)", value: (opts && opts.tree) || "3,4,5,1,3,null,1", width: 220 }],
    random: () => ({ tree: randLevel(Viz.rand(6, 11), 1, 9) }),
    build: ({ tree }) => {
      const T = parseLevel(tree, { maxN: 15, lo: 0, hi: 99 }), { val, L, R, n } = T;
      const rb = Array(n).fill(null), sk = Array(n).fill(null), fr = [];
      const snap = (o) => fr.push({ rb: rb.slice(), sk: sk.slice(), cur: null, robbed: null, ...o });
      snap({ note: `Plain "rob or not" needs to know whether the parent was robbed. Flip it around: let every node report <b>two</b> answers for its subtree, one if it is robbed and one if it is not. The parent can then pick whatever is legal. Children must finish first, so this is a <b>post-order</b> walk. A missing child reports (0, 0).`, line: [1, 2], vars: { nodes: n } });
      for (const u of postOrder(T)) {
        const lr = L[u] === null ? 0 : rb[L[u]], ls = L[u] === null ? 0 : sk[L[u]], rr = R[u] === null ? 0 : rb[R[u]], rs = R[u] === null ? 0 : sk[R[u]];
        rb[u] = val[u] + ls + rs; sk[u] = Math.max(lr, ls) + Math.max(rr, rs);
        const kids = [L[u], R[u]].filter((x) => x !== null);
        snap({ cur: u, kids, note: kids.length ? `Node ${val[u]}: its children reported ${kids.map((c) => `(${rb[c]}, ${sk[c]})`).join(" and ")}. <b>Rob it</b>: ${val[u]} + the children's skip values ${ls} + ${rs} = <b>${rb[u]}</b>. <b>Skip it</b>: each child takes its larger value, max(${lr}, ${ls}) + max(${rr}, ${rs}) = <b>${sk[u]}</b>.` : `Leaf ${val[u]}: rob = ${val[u]}, skip = 0.`, line: kids.length ? [3, 4, 5, 6, 7] : [5, 6, 7], vars: { node: val[u], "(l rob, l skip)": `(${lr}, ${ls})`, "(r rob, r skip)": `(${rr}, ${rs})`, rob: rb[u], skip: sk[u] } });
      }
      const robbed = new Set(); const pick = (u, parentRobbed) => { if (u === null) return; const take = !parentRobbed && rb[u] >= sk[u]; if (take) robbed.add(u); pick(L[u], take); pick(R[u], take); };
      pick(0, false);
      const ans = Math.max(rb[0], sk[0]);
      snap({ robbed: [...robbed], end: true, note: `Root pair (${rb[0]}, ${sk[0]}): the answer is the larger, <b>${ans}</b>. Walking down again (rob a node only if its parent was not robbed and robbing is at least as good) gives the houses: ${[...robbed].map((u) => val[u]).join(" + ")} = ${[...robbed].reduce((s, u) => s + val[u], 0)}. Each node is visited once: O(n) time, O(h) stack.`, line: 8, vars: { answer: ans } });
      return fr.map((f) => ({ ...f, T }));
    },
    render: (f) => {
      const T = f.T, lay = binLayout(T, (id) => T.val[id]);
      lay.nodes.forEach((nd) => { if (f.rb[nd.id] !== null) nd.sub = `${f.rb[nd.id]} / ${f.sk[nd.id]}`; });
      const rs = new Set(f.robbed || []);
      const g = Viz.graph(lay, { r: 19, label: "sub-label = rob / skip", nodeCls: (id) => { id = Number(id); if (f.end) return rs.has(id) ? "path" : ""; if (id === f.cur) return "active"; if (f.kids && f.kids.includes(id)) return "visit"; return f.rb[id] !== null ? "done" : "dim"; } });
      const ids = postOrder(T).filter((u) => f.rb[u] !== null);
      const grid = Viz.grid([ids.map((u) => f.rb[u]), ids.map((u) => f.sk[u])], { label: "pairs so far (post-order)", colLabels: ids.map((u) => `${T.val[u]}`), rowLabels: ["rob", "skip"], cls: (r, c) => (ids[c] === f.cur ? "active" : "") });
      return row(g, col(ids.length ? grid : "", f.end ? answer("max(rob, skip) at root", Math.max(f.rb[0], f.sk[0])) : ""));
    },
  }));

  /* =====================================================================
     7. Binary Tree Cameras: three states per node
     ===================================================================== */
  const CAM_CODE = [
    "def min_camera_cover(root):",
    "    def go(node):                  # -> (cam, cov, unc) for this subtree",
    "        if not node: return (INF, 0, INF)   # nothing to cover, cannot hold a camera",
    "        l, r = go(node.left), go(node.right)",
    "        cam = 1 + min(l) + min(r)            # camera here covers both children",
    "        cov = min(l[0] + min(r[0], r[1]),    # a child's camera covers me",
    "                  min(l[0], l[1]) + r[0])",
    "        unc = l[1] + r[1]                    # I'm not covered yet; my parent must be",
    "        return (cam, cov, unc)",
    "    c = go(root)",
    "    return min(c[0], c[1])                   # the root has no parent to rescue it",
  ];
  Viz.register(P("cameras"), (el, opts) => Viz.player(el, {
    title: "Binary Tree Cameras: three states bubble up, then a top-down replay",
    tag: "TREE DP · MULTI-STATE",
    legend: [["active", "node being combined"], ["visit", "children"], ["done", "triple ready"], ["path", "camera placed"], ["window", "covered by a neighbour"]],
    codeLang: "python",
    code: CAM_CODE,
    inputs: [{ key: "tree", label: "tree (level order)", value: (opts && opts.tree) || "0,0,0,0,null,0,0,0,null,null,null,null,0", width: 260 }],
    random: () => ({ tree: randLevel(Viz.rand(6, 12), 0, 0) }),
    build: ({ tree }) => {
      const T = parseLevel(tree, { maxN: 15, lo: -99, hi: 99 }), { L, R, n } = T, I = Infinity;
      const st = Array(n).fill(null), fr = [];
      const S = (c) => (c === null ? [I, 0, I] : st[c]);
      const snap = (o) => fr.push({ st: st.map((x) => (x ? x.slice() : null)), cur: null, ...o });
      snap({ note: `Each node reports three costs for its subtree, all with every node below it covered: <b>cam</b> (a camera on this node), <b>cov</b> (no camera here, but a child's camera covers it), <b>unc</b> (no camera here and not covered yet: the parent must put a camera on itself). A missing child is (∞, 0, ∞): there is nothing to cover and no camera can sit there.`, line: [1, 2], vars: { nodes: n } });
      for (const u of postOrder(T)) {
        const l = S(L[u]), r = S(R[u]);
        const cam = 1 + Math.min(...l) + Math.min(...r), cov = Math.min(l[0] + Math.min(r[0], r[1]), Math.min(l[0], l[1]) + r[0]), unc = l[1] + r[1];
        st[u] = [cam, cov, unc];
        const kids = [L[u], R[u]].filter((x) => x !== null);
        snap({ cur: u, kids, note: `<b>cam</b> = 1 + cheapest of each child (anything goes under a camera) = 1 + ${fm(Math.min(...l))} + ${fm(Math.min(...r))} = <b>${fm(cam)}</b>. <b>cov</b> needs at least one child with a camera; the other child must be covered on its own: min(${fm(l[0])} + ${fm(Math.min(r[0], r[1]))}, ${fm(Math.min(l[0], l[1]))} + ${fm(r[0])}) = <b>${fm(cov)}</b>. <b>unc</b> needs both children covered without cameras: ${fm(l[1])} + ${fm(r[1])} = <b>${fm(unc)}</b>.${kids.length ? "" : " A leaf can never be covered from below, so its cov is ∞."}`, line: [3, 4, 5, 6, 7, 8], vars: { "left (cam,cov,unc)": l.map(fm).join(","), "right (cam,cov,unc)": r.map(fm).join(","), cam: fm(cam), cov: fm(cov), unc: fm(unc) } });
      }
      const ans = Math.min(st[0][0], st[0][1]);
      snap({ note: `At the root (${st[0].map(fm).join(", ")}): <b>unc</b> is not allowed because nobody above can cover the root. Answer = min(cam, cov) = <b>${ans}</b>. Now replay the choices from the top to place the cameras.`, line: [9, 10], vars: { answer: ans } });
      const cams = new Set(), pick = (u, s) => {
        if (u === null) return;
        const l = S(L[u]), r = S(R[u]);
        const am = (x) => x.indexOf(Math.min(...x));
        if (s === 0) cams.add(u);
        const why = s === 0 ? "a camera goes here, so each child may take its cheapest state" : s === 1 ? "one child must carry a camera, the other is covered on its own" : "both children are covered without cameras; this node waits for its parent's camera";
        fr.push({ st: fr[fr.length - 1].st, cams: [...cams], cur: u, state: s, place: true, note: `Top-down replay: node #${u} is in state <b>${["cam", "cov", "unc"][s]}</b> (cost ${fm(st[u][s])}): ${why}.`, line: [4, 5, 7][s], vars: { node: `#${u}`, state: ["cam", "cov", "unc"][s], cameras: cams.size } });
        if (s === 0) { if (L[u] !== null) pick(L[u], am(l)); if (R[u] !== null) pick(R[u], am(r)); }
        else if (s === 1) {
          if (L[u] !== null && l[0] + Math.min(r[0], r[1]) === st[u][1]) { pick(L[u], 0); if (R[u] !== null) pick(R[u], r[0] <= r[1] ? 0 : 1); }
          else { pick(R[u], 0); if (L[u] !== null) pick(L[u], l[0] <= l[1] ? 0 : 1); }
        } else { pick(L[u], 1); pick(R[u], 1); }
      };
      pick(0, st[0][0] <= st[0][1] ? 0 : 1);
      const covered = new Set(); const par = Array(n).fill(null); for (let u = 0; u < n; u++) for (const c of [L[u], R[u]]) if (c !== null) par[c] = u;
      for (const u of cams) { covered.add(u); if (par[u] !== null) covered.add(par[u]); if (L[u] !== null) covered.add(L[u]); if (R[u] !== null) covered.add(R[u]); }
      fr.push({ st: fr[fr.length - 1].st, cams: [...cams], covered: [...covered], end: true, note: `<b>${cams.size}</b> camera${cams.size === 1 ? "" : "s"} and all ${covered.size} of ${n} nodes are covered. The greedy version (put cameras on parents of leaves, bottom up) gives the same count, but the three-state DP is the pattern that generalises: whenever a node's status depends on its neighbours, give it one state per situation. O(n) time.`, line: 10, vars: { cameras: cams.size, covered: `${covered.size}/${n}` } });
      return fr.map((f) => ({ ...f, T }));
    },
    render: (f) => {
      const T = f.T, lay = binLayout(T, () => "");
      const cs = new Set(f.cams || []), cv = new Set(f.covered || []);
      lay.nodes.forEach((nd) => { nd.label = cs.has(nd.id) ? "📷" : ""; if (f.st[nd.id]) nd.sub = f.st[nd.id].map(fm).join("·"); });
      const g = Viz.graph(lay, { r: 17, label: "sub-label = cam · cov · unc", nodeCls: (id) => { id = Number(id); if (cs.has(id)) return "path"; if (f.end) return cv.has(id) ? "window" : "bad"; if (id === f.cur) return "active"; if (f.kids && f.kids.includes(id)) return "visit"; return f.st[id] ? "done" : "dim"; } });
      const ids = postOrder(T).filter((u) => f.st[u]);
      const grid = ids.length ? Viz.grid([0, 1, 2].map((s) => ids.map((u) => f.st[u][s])), { label: "triples (columns in post-order)", colLabels: ids.map((u) => `#${u}`), rowLabels: ["cam", "cov", "unc"], cls: (r, c) => (ids[c] === f.cur ? (f.place && r === f.state ? "path" : "active") : "") }) : "";
      return row(g, col(grid, f.end ? answer("cameras", cs.size) : ""));
    },
  }));

  /* =====================================================================
     8. Tree knapsack: choose exactly k connected nodes containing the root
     ===================================================================== */
  const TK_CODE = [
    "def best_k(children, val, k):     # pick k nodes; a picked node's parent must be picked",
    "    def go(v):                    # dp[t] = best sum with t nodes in v's subtree, v picked",
    "        dp = [-INF, val[v]]       # size 1 so far: only v itself",
    "        for c in children[v]:",
    "            dc = go(c)            # dc[b], b = nodes taken from c's subtree (dc[0] = 0)",
    "            new = [-INF] * min(k + 1, len(dp) + len(dc) - 1)",
    "            for a in range(1, len(dp)):",
    "                for b in range(0, len(dc)):          # merge: a from what we have, b from c",
    "                    if a + b <= k: new[a + b] = max(new[a + b], dp[a] + dc[b])",
    "            dp = new",
    "        return [0] + dp[1:]       # for the parent: taking 0 nodes from here is allowed",
    "    return go(0)[k]               # sizes cap the loops: O(n·k) overall",
  ];
  Viz.register(P("knap"), (el, opts) => Viz.player(el, {
    title: "Tree knapsack: merge children one at a time with a max-plus table",
    tag: "TREE DP · SUBTREE MERGE",
    legend: [["active", "node v merging"], ["visit", "child c being merged"], ["done", "finished subtree"], ["path", "chosen nodes"], ["window", "cells that land on the same t = a + b"]],
    codeLang: "python",
    code: TK_CODE,
    inputs: [
      { key: "par", label: "parent of 1..n−1", value: (opts && opts.par) || "0,0,1,1,2,2,4", width: 160 },
      { key: "val", label: "values 0..n−1", value: (opts && opts.val) || "2,7,1,-3,6,4,5,8", width: 160 },
      { key: "k", label: "k", type: "number", value: (opts && opts.k) || "4", width: 60 },
    ],
    random: () => { const n = Viz.rand(6, 9); return { par: Array.from({ length: n - 1 }, (_, i) => Viz.rand(0, i)).join(","), val: Viz.randInts(n, -4, 9).join(","), k: String(Viz.rand(2, Math.min(5, n))) }; },
    build: ({ par, val, k }) => {
      const pa = ints(par, "parents", { min: 1, max: 9, lo: 0, hi: 9 }), n = pa.length + 1;
      pa.forEach((p, i) => { if (p > i) throw new Error(`parent of node ${i + 1} must be a smaller index (0..${i}), so the input is a tree.`); });
      const v = ints(val, "values", { min: n, max: n, lo: -50, hi: 50 });
      const K = Number(k); if (!Number.isInteger(K) || K < 1 || K > n) throw new Error(`k must be between 1 and ${n}.`);
      const ch = Array.from({ length: n }, () => []); pa.forEach((p, i) => ch[p].push(i + 1));
      const NI = -Infinity, dps = Array(n).fill(null), choice = Array.from({ length: n }, () => []), fr = [];
      const snap = (o) => fr.push({ dps: dps.map((x) => (x ? x.slice() : null)), ...o });
      snap({ note: `Pick exactly ${K} nodes so that every picked node's parent is picked too (a connected piece hanging from the root), maximising the sum. dp_v[t] = best sum using t nodes from v's subtree with v picked. A parent combines its children <b>one at a time</b>, like a knapsack where each child is an item that can be "bought" in any size b.`, line: 0, vars: { n, k: K } });
      const go = (u) => {
        let d = [NI, v[u]];
        snap({ v: u, cur: d.slice(), note: `Enter node ${u} (value ${v[u]}): before any child, the only option is v itself, dp = [−∞, ${v[u]}].`, line: 2, vars: { v: u, dp: d.map(fm).join(",") } });
        for (const c of ch[u]) {
          const dc = go(c), nw = Array(Math.min(K + 1, d.length + dc.length - 1)).fill(NI), bc = Array(nw.length).fill(null);
          const cells = [];
          for (let a = 1; a < d.length; a++) for (let b = 0; b < dc.length; b++) if (a + b <= K) { const s = d[a] + dc[b]; cells.push([a, b, s]); if (s > nw[a + b]) { nw[a + b] = s; bc[a + b] = b; } }
          snap({ v: u, c, d: d.slice(), dc: dc.slice(), nw: nw.slice(), cells, note: `Merge child ${c} into ${u}. Rows a = nodes already taken around ${u}, columns b = nodes taken from ${c}'s subtree (b = 0 means leave it out). Every cell is dp[a] + dc[b]; each <b>anti-diagonal</b> a + b = t competes for new[t], and its maximum wins. Only a ≤ ${d.length - 1} and b ≤ ${dc.length - 1} exist, so small subtrees make small tables.`, line: [5, 6, 7, 8], vars: { v: u, c, "dp (rows)": d.map(fm).join(","), "dc (cols)": dc.map(fm).join(","), new: nw.map(fm).join(",") } });
          choice[u].push({ c, bc });
          d = nw;
        }
        dps[u] = d.slice();
        snap({ v: u, cur: d.slice(), fin: true, note: `Node ${u} done: dp = [${d.map(fm).join(", ")}]. It hands [0, ${d.slice(1).map(fm).join(", ")}] to its parent (taking 0 nodes from here is allowed).`, line: 10, vars: { v: u, dp: d.map(fm).join(",") } });
        return [0, ...d.slice(1)];
      };
      go(0);
      const ans = dps[0][K];
      if (ans === undefined || ans === NI) throw new Error("No valid choice: k is larger than the tree.");
      const picked = new Set(); const rec = (u, t) => { picked.add(u); for (let i = choice[u].length - 1; i >= 0; i--) { const { c, bc } = choice[u][i]; const b = bc[t]; if (b > 0) rec(c, b); t -= b; } };
      rec(0, K);
      snap({ end: true, picked: [...picked], note: `Answer dp_0[${K}] = <b>${fm(ans)}</b>, picking nodes {${[...picked].sort((a, b) => a - b).join(", ")}} (rebuilt by remembering which b won each merge). Bounding each loop by the subtree sizes seen so far makes the total O(n·k), not O(n·k²): each pair of nodes is "merged" only once, at their lowest common ancestor.`, line: 11, vars: { answer: ans } });
      return fr.map((f) => ({ ...f, ch, vals: v, n, K }));
    },
    render: (f) => {
      const { ch, vals, n } = f;
      const lay = Viz.layoutTree(0, (id) => ch[id], (id) => vals[id], { dx: 52, dy: 64 });
      lay.nodes.forEach((nd) => { nd.top = `#${nd.id}`; });
      const pk = new Set(f.picked || []);
      const sub = new Set(); const mark = (u) => { sub.add(u); ch[u].forEach(mark); }; if (f.c !== undefined) mark(f.c);
      const g = Viz.graph(lay, { r: 17, label: "tree (label = value, #id above)", nodeCls: (id) => { id = Number(id); if (f.end) return pk.has(id) ? "path" : "dim"; if (id === f.v) return "active"; if (sub.has(id)) return "visit"; return f.dps[id] ? "done" : ""; } });
      let mid = "";
      if (f.cells) {
        const R = f.d.length, C = f.dc.length, M = table(R - 1, C, null);
        f.cells.forEach(([a, b, s]) => { M[a - 1][b] = s; });
        const win = (a, b) => f.nw[a + b] === M[a - 1][b] && f.nw[a + b] !== -Infinity;
        mid = col(tbl(M, { label: "dp[a] + dc[b]  (best on each anti-diagonal is outlined)", size: 40, colLabels: Array.from({ length: C }, (_, b) => `b=${b}`), rowLabels: Array.from({ length: R - 1 }, (_, a) => `a=${a + 1}`), fmt: (x) => (x === null ? "" : fm(x)), cls: (r, c, x) => (x === null ? "dim" : win(r + 1, c) ? "done" : "window") }),
          Viz.array(f.nw, { label: "new[t] = max over a + b = t", fmt: fm, cls: (t) => (t === 0 ? "dim" : "done") }));
      } else if (f.cur) mid = Viz.array(f.cur, { label: `dp for node ${f.v}`, fmt: fm, cls: (t) => (t === 0 ? "dim" : f.fin ? "done" : "active") });
      else if (f.end) mid = answer(`best sum with k = ${f.K}`, f.dps[0][f.K]);
      return row(g, mid);
    },
  }));

  /* =====================================================================
     9. Rerooting: one pass down, one pass up, an answer for every root
     ===================================================================== */
  const RR_MODES = ["sum of distances (834)", "farthest node from each root"];
  const RR_CODE = [
    [
      "def sum_of_distances(n, adj):            # rooted at 0 for the first pass",
      "    size, down, up = [1]*n, [0]*n, [0]*n",
      "    def dfs1(v, p):                        # pass 1 (post-order): look DOWN",
      "        for c in adj[v]:",
      "            if c != p: dfs1(c, v); size[v] += size[c]; down[v] += down[c] + size[c]",
      "    def dfs2(v, p):                        # pass 2 (pre-order): bring the outside in",
      "        for c in adj[v]:",
      "            if c == p: continue",
      "            outside = up[v] + down[v] - (down[c] + size[c])   # v's answer without c's part",
      "            up[c] = outside + (n - size[c])                   # every outside node is 1 step farther",
      "            dfs2(c, v)",
      "    dfs1(0, -1); dfs2(0, -1)",
      "    return [down[v] + up[v] for v in range(n)]",
    ],
    [
      "def farthest_from_every_root(n, adj):",
      "    down, up = [0]*n, [0]*n               # height below / longest path leaving via parent",
      "    def dfs1(v, p):                        # pass 1: height of each subtree",
      "        for c in adj[v]:",
      "            if c != p: dfs1(c, v); down[v] = max(down[v], down[c] + 1)",
      "    def dfs2(v, p):                        # pass 2: keep the TOP TWO child heights",
      "        best1, best2 = top_two(down[c] + 1 for c in adj[v] if c != p)",
      "        for c in adj[v]:",
      "            if c == p: continue",
      "            other = best2 if down[c] + 1 == best1 else best1   # best route avoiding c",
      "            up[c] = 1 + max(up[v], other); dfs2(c, v)",
      "    dfs1(0, -1); dfs2(0, -1)",
      "    return [max(down[v], up[v]) for v in range(n)]",
    ],
  ];
  const RR_DEF = { [RR_MODES[0]]: "0-1,0-2,2-3,2-4,2-5", [RR_MODES[1]]: "0-1,1-2,1-3,3-4,4-5,0-6,6-7" };
  function parseEdges(s, maxN) {
    const t = String(s ?? "").split(/[\s,;]+/).filter(Boolean);
    if (!t.length) throw new Error('edges: write them like "0-1,0-2,2-3".');
    const E = t.map((x) => { const m = x.match(/^(\d+)\s*[-–>]\s*(\d+)$/); if (!m) throw new Error(`"${x}" is not an edge: use u-v, for example 0-1.`); return [Number(m[1]), Number(m[2])]; });
    const n = Math.max(...E.flat()) + 1;
    if (n > maxN) throw new Error(`use node ids 0..${maxN - 1}.`);
    if (E.some(([u, v]) => u === v)) throw new Error("no self-loops, please.");
    return { E, n };
  }
  Viz.register(P("reroot"), (el, opts) => {
    const cfg = {
      title: "Rerooting: answer for every root in two passes instead of n",
      tag: "TREE DP · REROOTING",
      legend: [["active", "node being processed"], ["visit", "its subtree (pass 1) / its child (pass 2)"], ["path", "the outside part handed down"], ["done", "finished in this pass"]],
      codeLang: "python",
      code: blank(RR_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: RR_MODES[0], options: RR_MODES },
        { key: "edges", label: "tree edges", value: (opts && opts.edges) || RR_DEF[RR_MODES[0]], width: 220 },
      ],
      random: () => { const n = Viz.rand(6, 10); return { edges: Array.from({ length: n - 1 }, (_, i) => `${Viz.rand(0, i)}-${i + 1}`).join(",") }; },
      build: ({ mode, edges }) => {
        const md = Math.max(0, RR_MODES.indexOf(mode));
        setCode(el, RR_CODE[md]);
        const { E, n } = parseEdges(edges, 12);
        if (E.length !== n - 1) throw new Error(`a tree on ${n} nodes has exactly ${n - 1} edges (you gave ${E.length}).`);
        const adj = Array.from({ length: n }, () => []); E.forEach(([u, v]) => { adj[u].push(v); adj[v].push(u); });
        const par = Array(n).fill(-2), order = []; par[0] = -1; const stk = [0];
        while (stk.length) { const v = stk.pop(); order.push(v); for (const c of adj[v]) if (par[c] === -2) { par[c] = v; stk.push(c); } }
        if (order.length !== n) throw new Error("the edges do not connect all nodes, so this is not a tree.");
        const ch = Array.from({ length: n }, () => []); order.forEach((v) => { if (par[v] >= 0) ch[par[v]].push(v); });
        ch.forEach((c) => c.sort((a, b) => a - b));
        const size = Array(n).fill(1), down = Array(n).fill(0), up = Array(n).fill(null), fr = [];
        const known = Array(n).fill(false), ansA = Array(n).fill(null);
        const snap = (o) => fr.push({ down: down.slice(), up: up.slice(), size: size.slice(), known: known.slice(), ans: ansA.slice(), ...o });
        snap({ phase: 1, note: `The naive way runs one full traversal per root: O(n²). Rerooting does two passes. <b>Pass 1</b> (post-order, root 0) computes <b>down[v]</b>, the answer looking only into v's subtree. <b>Pass 2</b> (pre-order) computes <b>up[c]</b>, the answer looking only <b>outside</b> c's subtree, from its parent's values. Then answer[v] combines down[v] and up[v].`, line: [2, 5], vars: { n } });
        const post = []; const dfs = (v) => { for (const c of ch[v]) dfs(c); post.push(v); }; dfs(0);
        for (const v of post) {
          if (md === 0) { for (const c of ch[v]) { size[v] += size[c]; down[v] += down[c] + size[c]; } }
          else for (const c of ch[v]) down[v] = Math.max(down[v], down[c] + 1);
          known[v] = true;
          snap({ phase: 1, cur: v, note: ch[v].length ? (md === 0 ? `Node ${v}: size = 1 + ${ch[v].map((c) => size[c]).join(" + ")} = ${size[v]}. Every node in child c's subtree is one step farther from ${v} than from c, so down[${v}] = Σ (down[c] + size[c]) = ${ch[v].map((c) => `(${down[c]} + ${size[c]})`).join(" + ")} = <b>${down[v]}</b>.` : `Node ${v}: down = 1 + the tallest child = 1 + max(${ch[v].map((c) => down[c]).join(", ")}) = <b>${down[v]}</b>.`) : `Leaf ${v}: down = 0${md === 0 ? ", size = 1" : ""}.`, line: [3, 4], vars: { v, ...(md === 0 ? { "size[v]": size[v] } : {}), "down[v]": down[v] } });
        }
        up[0] = 0; ansA[0] = md === 0 ? down[0] : down[0];
        snap({ phase: 2, cur: 0, note: `Pass 1 done. The root has no outside: up[0] = 0, so answer[0] = down[0] = <b>${ansA[0]}</b>, which is exactly what a single traversal would give. Now push information <b>downward</b>, parents before children.`, line: [5, 11], vars: { "up[0]": 0, "answer[0]": ansA[0] } });
        const pre = []; const dfs2 = (v) => { pre.push(v); for (const c of ch[v]) dfs2(c); }; dfs2(0);
        for (const v of pre) {
          let b1 = -1, b2 = -1; if (md === 1) for (const c of ch[v]) { const h = down[c] + 1; if (h > b1) { b2 = b1; b1 = h; } else if (h > b2) b2 = h; }
          for (const c of ch[v]) {
            let note;
            if (md === 0) {
              const outside = up[v] + down[v] - (down[c] + size[c]); up[c] = outside + (n - size[c]);
              note = `Edge ${v} → ${c}. Seen from ${v}, everything <b>except</b> ${c}'s subtree contributes up[${v}] + down[${v}] − (down[${c}] + size[${c}]) = ${up[v]} + ${down[v]} − (${down[c]} + ${size[c]}) = ${outside}. Those ${n - size[c]} nodes are each one step farther from ${c}: up[${c}] = ${outside} + ${n - size[c]} = <b>${up[c]}</b>. answer[${c}] = down + up = ${down[c]} + ${up[c]} = <b>${down[c] + up[c]}</b>.`;
            } else {
              const other = down[c] + 1 === b1 ? Math.max(b2, 0) : Math.max(b1, 0); up[c] = 1 + Math.max(up[v], other);
              note = `Edge ${v} → ${c}. From ${c}, the longest route leaving through ${v} goes either further up (up[${v}] = ${up[v]}) or down a <b>different</b> child of ${v}. ${v}'s top two child routes are ${b1} and ${Math.max(b2, 0)}; ${down[c] + 1 === b1 ? `the best one goes through ${c} itself, so use the second best, ${Math.max(b2, 0)}` : `the best (${b1}) avoids ${c}`}. up[${c}] = 1 + max(${up[v]}, ${other}) = <b>${up[c]}</b>, so answer[${c}] = max(${down[c]}, ${up[c]}) = <b>${Math.max(down[c], up[c])}</b>.`;
            }
            ansA[c] = md === 0 ? down[c] + up[c] : Math.max(down[c], up[c]);
            snap({ phase: 2, cur: v, kid: c, note, line: md === 0 ? [8, 9] : [6, 9, 10], vars: { v, c, "up[c]": up[c], "answer[c]": ansA[c] } });
          }
        }
        // verify against BFS from every node
        const bf = Array.from({ length: n }, (_, s) => { const d = Array(n).fill(-1); d[s] = 0; const q = [s]; while (q.length) { const x = q.shift(); for (const y of adj[x]) if (d[y] < 0) { d[y] = d[x] + 1; q.push(y); } } return md === 0 ? d.reduce((a, b) => a + b, 0) : Math.max(...d); });
        const ok = bf.every((x, i) => x === ansA[i]);
        snap({ phase: 3, note: `Every node has its answer: [${ansA.join(", ")}]. A BFS from every node (the slow O(n²) way) gives [${bf.join(", ")}]: ${ok ? "identical" : "MISMATCH"}. Two O(n) passes replaced n traversals. The recipe is always: down[] from children, up[] from the parent's up plus the parent's down <b>with this child removed</b>. Removing needs an inverse (subtraction for sums) or the top-two trick (for max).`, line: 12, vars: { answers: ansA.join(",") } });
        return fr.map((f) => ({ ...f, ch, n, md }));
      },
      render: (f) => {
        const { ch, n } = f;
        const lay = Viz.layoutTree(0, (id) => ch[id], (id) => id, { dx: 54, dy: 72 });
        lay.nodes.forEach((nd) => { nd.sub = `↓${f.known[nd.id] ? f.down[nd.id] : "?"} ↑${f.up[nd.id] ?? "?"}`; });
        const subt = new Set(); const mark = (u) => { subt.add(u); ch[u].forEach(mark); };
        if (f.phase === 1 && f.cur !== undefined) mark(f.cur);
        if (f.phase === 2 && f.kid !== undefined) mark(f.kid);
        const g = Viz.graph(lay, {
          r: 17, label: "sub-label: ↓down ↑up", edgeCls: (key) => (f.kid !== undefined && key === `${f.cur}-${f.kid}` ? "active" : ""),
          nodeCls: (id) => {
            id = Number(id);
            if (f.phase === 3) return "done";
            if (f.phase === 1) return id === f.cur ? "active" : subt.has(id) ? "visit" : f.known[id] ? "done" : "dim";
            if (id === f.kid) return "visit";
            if (id === f.cur) return "active";
            if (f.kid !== undefined && !subt.has(id)) return "path";
            return f.up[id] !== null ? "done" : "";
          },
        });
        const arr = Viz.array(f.ans.map((x) => (x === null ? "?" : x)), { label: "answer[v]", cls: (t) => (t === f.kid ? "active" : f.ans[t] !== null ? "done" : "dim") });
        return row(g, col(arr, f.md === 0 ? Viz.array(f.size, { label: "size[v]", cls: (t) => (f.known[t] ? "" : "dim") }) : ""));
      },
    };
    const api = Viz.player(el, cfg);
    return onMode(el, api, RR_DEF, "edges");
  });

  /* =====================================================================
     10. DP on a DAG: process nodes in topological order
     ===================================================================== */
  const DAG_MODES = ["longest path (edges)", "count paths 0 → n−1"];
  const DAG_CODE = [
    [
      "def longest_path(n, edges):",
      "    adj, indeg = build(n, edges)",
      "    order = kahn_topological_order(adj, indeg)   # sources first",
      "    best = [0] * n                 # longest path ENDING at v",
      "    for u in order:                # all of u's predecessors are final",
      "        for v in adj[u]:",
      "            if best[u] + 1 > best[v]:",
      "                best[v], parent[v] = best[u] + 1, u",
      "    return max(best)",
    ],
    [
      "def count_paths(n, edges, s=0, t=None):",
      "    adj, indeg = build(n, edges)",
      "    order = kahn_topological_order(adj, indeg)",
      "    ways = [0] * n; ways[s] = 1    # one way to stand at the start",
      "    for u in order:                # ways[u] is final when we reach it",
      "        for v in adj[u]:",
      "            ways[v] += ways[u]     # every path to u extends to v",
      "    # (ways[v] is final once every in-edge of v has pushed)",
      "    return ways[t]",
    ],
  ];
  const DAG_DEF = { [DAG_MODES[0]]: "0>1,0>2,1>3,2>3,3>4,2>5,5>4,1>5,4>6,5>6", [DAG_MODES[1]]: "0>1,0>2,1>3,2>3,1>4,3>4,3>5,4>6,5>6,2>5" };
  Viz.register(P("dag"), (el, opts) => {
    const cfg = {
      title: "DP on a DAG: topological order is the fill order",
      tag: "DAG DP",
      legend: [["active", "u: just popped, value final"], ["visit", "v: being relaxed"], ["done", "processed"], ["path", "reconstructed longest path"], ["dim", "waiting (in-degree > 0)"]],
      codeLang: "python",
      code: blank(DAG_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: DAG_MODES[0], options: DAG_MODES },
        { key: "edges", label: "edges u>v", value: (opts && opts.edges) || DAG_DEF[DAG_MODES[0]], width: 280 },
      ],
      random: () => { const n = Viz.rand(6, 9), E = new Set(); for (let v = 1; v < n; v++) { E.add(`${Viz.rand(0, v - 1)}>${v}`); if (Math.random() < 0.6) E.add(`${Viz.rand(0, v - 1)}>${v}`); } return { edges: [...E].join(",") }; },
      build: ({ mode, edges }) => {
        const md = Math.max(0, DAG_MODES.indexOf(mode));
        setCode(el, DAG_CODE[md]);
        const { E, n } = parseEdges(edges, 12);
        const key = new Set(); const EE = E.filter(([u, v]) => { const k = `${u}>${v}`; if (key.has(k)) return false; key.add(k); return true; });
        const adj = Array.from({ length: n }, () => []), indeg = Array(n).fill(0);
        EE.forEach(([u, v]) => { adj[u].push(v); indeg[v]++; });
        adj.forEach((a) => a.sort((x, y) => x - y));
        const deg = indeg.slice(), q = [], order = [];
        for (let v = 0; v < n; v++) if (!deg[v]) q.push(v);
        while (q.length) { const u = q.shift(); order.push(u); for (const v of adj[u]) if (--deg[v] === 0) q.push(v); }
        if (order.length !== n) throw new Error("this graph has a cycle, so there is no topological order (and no DAG DP).");
        const layer = Array(n).fill(0); for (const u of order) for (const v of adj[u]) layer[v] = Math.max(layer[v], layer[u] + 1);
        const byL = {}; order.forEach((v) => (byL[layer[v]] ||= []).push(v));
        const pos = {}; Object.entries(byL).forEach(([l, vs]) => vs.forEach((v, i) => { pos[v] = { x: Number(l) * 95, y: (i - (vs.length - 1) / 2) * 72 }; }));
        const val = Array(n).fill(0), parent = Array(n).fill(null), fr = [], done = Array(n).fill(false);
        if (md === 1) val[0] = 1;
        const snap = (o) => fr.push({ val: val.slice(), done: done.slice(), ...o });
        snap({ note: `A DAG has no cycles, so it has a <b>topological order</b>: every edge points forward in it. If we process nodes in that order, all of a node's predecessors are finished before we touch it, exactly the "dependencies first" rule of any DP. Order here (Kahn's algorithm): ${order.join(", ")}. ${md === 0 ? "best[v] = edges on the longest path ending at v; every node starts at 0." : "ways[v] = number of paths from 0 to v; ways[0] = 1."}`, line: [2, 3], vars: { order: order.join(","), [md ? "ways[0]" : "best"]: md ? 1 : 0 } });
        for (const u of order) {
          done[u] = true;
          if (!adj[u].length) { snap({ u, note: `Pop ${u}: no outgoing edges, nothing to push.`, line: 4, vars: { u, [md ? "ways[u]" : "best[u]"]: val[u] } }); continue; }
          for (const v of adj[u]) {
            let note;
            if (md === 0) { const better = val[u] + 1 > val[v]; const old = val[v]; if (better) { val[v] = val[u] + 1; parent[v] = u; } note = `${u} → ${v}: a path ending at ${u} has ${val[u]} edge${val[u] === 1 ? "" : "s"}, so through this edge ${v} could end a path of ${val[u] + 1}. ${better ? `Better than ${old}: best[${v}] = <b>${val[v]}</b>, parent ${u}.` : `Not better than ${old}.`}`; }
            else { val[v] += val[u]; note = `${u} → ${v}: each of the ${val[u]} path${val[u] === 1 ? "" : "s"} reaching ${u} continues to ${v}. ways[${v}] = <b>${val[v]}</b>.`; }
            snap({ u, v, note, line: md === 0 ? [5, 6, 7] : [5, 6], vars: { u, v, [md ? "ways[u]" : "best[u]"]: val[u], [md ? "ways[v]" : "best[v]"]: val[v] } });
          }
        }
        let path = [];
        if (md === 0) { let end = val.indexOf(Math.max(...val)); while (end !== null) { path.unshift(end); end = parent[end]; } }
        const res = md === 0 ? Math.max(...val) : val[n - 1];
        snap({ end: true, path, note: md === 0 ? `Longest path has <b>${res}</b> edges: ${path.join(" → ")} (follow parent pointers back from the largest best[v]). On a general graph longest path is NP-hard; on a DAG it is O(V + E) because the topological order removes all cycles.` : `ways[${n - 1}] = <b>${res}</b> paths from 0 to ${n - 1}. Counting, longest, shortest, "max weight", even probability: on a DAG they are all one pass in topological order, O(V + E).`, line: 8, vars: { answer: res } });
        return fr.map((f) => ({ ...f, n, EE, pos, order, md }));
      },
      render: (f) => {
        const { n, EE, pos, order, md } = f;
        const pe = new Set(); for (let i = 0; f.path && i + 1 < f.path.length; i++) pe.add(`${f.path[i]}-${f.path[i + 1]}`);
        const nodes = Array.from({ length: n }, (_, v) => ({ id: String(v), x: pos[v].x, y: pos[v].y, label: v, sub: `${md ? "w" : "b"}=${f.val[v]}` }));
        const g = Viz.graph({ nodes, edges: EE.map(([u, v]) => ({ u: String(u), v: String(v) })) }, {
          directed: true, r: 18, label: md ? "sub-label = ways[v]" : "sub-label = best[v]",
          edgeCls: (k) => (pe.has(k) ? "path" : f.u !== undefined && f.v !== undefined && k === `${f.u}-${f.v}` ? "active" : ""),
          nodeCls: (id) => { id = Number(id); if (f.end) return f.path.includes(id) || (md === 1 && (id === 0 || id === n - 1)) ? "path" : "done"; if (id === f.u) return "active"; if (id === f.v) return "visit"; return f.done[id] ? "done" : ""; },
        });
        const ord = Viz.array(order, { label: "topological order", cls: (t) => (order[t] === f.u ? "active" : f.done[order[t]] ? "done" : "") });
        const vals = Viz.array(f.val, { label: md ? "ways[v]" : "best[v]", cls: (t) => (t === f.v ? "visit" : t === f.u ? "active" : "") });
        return col(g, row(ord, vals));
      },
    };
    const api = Viz.player(el, cfg);
    return onMode(el, api, DAG_DEF, "edges");
  });
})();
