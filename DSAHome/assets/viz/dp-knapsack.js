/* Visualizers for the Knapsack Family. Every name is prefixed "dp-knapsack-". Frames come from running the real algorithms. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when the mode changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const INF = Infinity;
  const fmtN = (v) => (v === INF ? "∞" : v === -INF ? "-∞" : v === null || v === undefined ? "" : v === true ? "T" : v === false ? "F" : String(v));

  /* ---------- SVG table with dependency arrows (cells use the svg.dg box classes) ---------- */
  function dgrid(M, o = {}) {
    const R = M.length, C = o.cols || Math.max(1, ...M.map((r) => r.length));
    const cs = o.size || 46, gap = o.gap ?? 8;
    const padL = o.rowLabels ? (o.rowLabelW || 50) : 4;
    const up = o.arcUp || 0, down = o.arcDown || 0;
    const padT = (o.colLabels ? 20 : 4) + up;
    const X = (c) => padL + c * (cs + gap), Y = (r) => padT + r * (cs + gap);
    const W = padL + C * (cs + gap) - gap + 6, H = Y(R) - gap + 6 + down;
    const vcls = o.small ? "dks-v sm" : "dks-v";
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dks-lab" x="${X(c) + cs / 2}" y="${13}" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dks-lab" x="${padL - 8}" y="${Y(r) + cs / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((row, r) => row.forEach((v, c) => {
      if (v === undefined) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="${o.small ? 4 : 7}"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fmtN(v);
      s += `<text class="${vcls} ${cl}" x="${x + cs / 2}" y="${y + cs / 2 + (o.tag ? 4 : 0)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
      const tg = o.tag ? o.tag(r, c, v) : "";
      if (tg) s += `<text class="dks-sub" x="${x + cs - 4}" y="${y + 11}" text-anchor="end">${esc(tg)}</text>`;
    }));
    const head = (x2, y2, vx, vy, cl) => `<polygon class="dks-ah ${cl}" points="${x2},${y2} ${x2 - vx * 9 - vy * 4.5},${y2 - vy * 9 + vx * 4.5} ${x2 - vx * 9 + vy * 4.5},${y2 - vy * 9 - vx * 4.5}"/>`;
    let labels = "";
    for (const a of o.arrows || []) {
      const [r1, c1] = a.from, [r2, c2] = a.to, cl = a.cls || "active";
      if (a.arc) {
        const dir = a.arc === "down" ? 1 : -1;
        const x1 = X(c1) + cs / 2 + (c2 > c1 ? 6 : -6), x2 = X(c2) + cs / 2 + (c2 > c1 ? -6 : 6);
        const y1 = dir < 0 ? Y(r1) - 1 : Y(r1) + cs + 1, y2 = dir < 0 ? Y(r2) - 2 : Y(r2) + cs + 2;
        const span = Math.abs(c2 - c1);
        const h = Math.min((dir < 0 ? up : down) - 6, 10 + 9 * span);
        const mx = (x1 + x2) / 2, my = (dir < 0 ? Math.min(y1, y2) : Math.max(y1, y2)) + dir * h * 2;
        const ex = x2 - mx, ey = y2 - my, el = Math.hypot(ex, ey) || 1;
        s += `<path class="dks-halo" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/><path class="dks-e ${cl}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>${head(x2, y2, ex / el, ey / el, cl)}`;
        if (a.label !== undefined) labels += `<text class="dks-el ${cl}" x="${mx}" y="${((dir < 0 ? Math.min(y1, y2) : Math.max(y1, y2)) + my) / 2}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
        continue;
      }
      const cx1 = X(c1) + cs / 2, cy1 = Y(r1) + cs / 2, cx2 = X(c2) + cs / 2, cy2 = Y(r2) + cs / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const m = Math.max(Math.abs(ux), Math.abs(uy));
      const k1 = (cs / 2 / m) * 0.35, k2 = cs / 2 / m + 1;
      const x1 = cx1 + ux * k1, y1 = cy1 + uy * k1, x2 = cx2 - ux * k2, y2 = cy2 - uy * k2;
      s += `<path class="dks-halo" d="M${x1},${y1} L${x2},${y2}"/><path class="dks-e ${cl}" d="M${x1},${y1} L${x2},${y2}"/>${head(x2, y2, ux, uy, cl)}`;
      if (a.label !== undefined) {
        const t = a.labelAt ?? 0.5;
        labels += `<text class="dks-el ${cl}" x="${x1 + (x2 - x1) * t - uy * 10}" y="${y1 + (y2 - y1) * t + ux * 10}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
      }
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dks-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "DP table")}">${s}${labels}</svg></div>`;
  }
  const nums = (s, { min = 1, max = 10, lo = 0, hi = 99, what = "Values" } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what} must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const parseItems = (w, v, { maxN = 6, maxW = 12, maxV = 99 } = {}) => {
    const wt = nums(w, { min: 1, max: maxN, lo: 1, hi: maxW, what: "Weights" });
    const val = nums(v, { min: 1, max: maxN, lo: 0, hi: maxV, what: "Values" });
    if (wt.length !== val.length) throw new Error(`Give one value per weight (${wt.length} weights, ${val.length} values).`);
    return { wt, val };
  };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const srcMap = (arrows) => new Map(arrows.map((a) => [`${a.from[0]},${a.from[1]}`, a.cls]));
  const itemsRow = (wt, val, cls, label = "items (weight / value)") => Viz.array(wt.map((_, k) => k), { label, fmt: (k) => `${wt[k]}/${val[k]}`, idxLabel: (k) => `item ${k + 1}`, cls });
  const knap01 = (wt, val, W) => { const d = Array(W + 1).fill(0); wt.forEach((w, k) => { for (let c = W; c >= w; c--) d[c] = Math.max(d[c], d[c - w] + val[k]); }); return d[W]; };
  const knapUnb = (wt, val, W) => { const d = Array(W + 1).fill(0); wt.forEach((w, k) => { for (let c = w; c <= W; c++) d[c] = Math.max(d[c], d[c - w] + val[k]); }); return d[W]; };

  /* ================= 1. 0/1 knapsack: the 2D table ================= */
  const KN_CODE = [
    "def knapsack(wt, val, W):",
    "    dp = [[0] * (W + 1) for _ in range(n + 1)]   # row 0: no items, value 0",
    "    for i in range(1, n + 1):",
    "        w, v = wt[i - 1], val[i - 1]",
    "        for c in range(W + 1):",
    "            dp[i][c] = dp[i - 1][c]                # SKIP item i",
    "            if w <= c:                             # TAKE item i (if it fits)",
    "                dp[i][c] = max(dp[i][c], dp[i - 1][c - w] + v)",
    "    return dp[n][W]",
    "# walk back: dp[i][c] != dp[i-1][c]  =>  item i was taken",
  ];
  Viz.register("dp-knapsack-table", (el) => Viz.player(el, {
    title: "0/1 knapsack: every cell is a skip-or-take decision",
    tag: "2D TABLE · RECONSTRUCTION",
    legend: [["active", "cell being computed"], ["done", "winning option"], ["visit", "losing option"], ["path", "walk back / items taken"]],
    codeLang: "python",
    code: KN_CODE,
    inputs: [
      { key: "w", label: "weights (1–12)", value: "1,3,4,5", width: 130 },
      { key: "v", label: "values", value: "1,4,5,7", width: 130 },
      { key: "W", label: "capacity W (1–12)", value: "7", width: 60 },
    ],
    random: () => { const n = Viz.rand(3, 5); return { w: Viz.randInts(n, 1, 6).join(","), v: Viz.randInts(n, 1, 12).join(","), W: String(Viz.rand(5, 11)) }; },
    build: ({ w, v, W }) => {
      const { wt, val } = parseItems(w, v, { maxN: 6, maxW: 12 });
      const Wc = Viz.parse.int(W, { min: 1, max: 12 });
      const n = wt.length, M = Array.from({ length: n + 1 }, () => Array(Wc + 1).fill(null)), fr = [];
      M[0].fill(0);
      const snap = (o) => fr.push({ M: Viz.clone(M), arrows: [], cur: null, items: {}, path: [], ...o });
      snap({ note: "Row 0 means <b>no items considered yet</b>, so every capacity is worth 0. Each later row adds one item and asks, for every capacity c: is this item worth its weight here?", line: 1, vars: { n, W: Wc } });
      for (let i = 1; i <= n; i++) {
        const wi = wt[i - 1], vi = val[i - 1];
        for (let c = 0; c <= Wc; c++) {
          const skip = M[i - 1][c];
          let arrows, note, line, take = "—";
          if (wi > c) {
            M[i][c] = skip;
            arrows = [{ from: [i - 1, c], to: [i, c], cls: "done", label: "skip" }];
            note = `Capacity ${c}, item ${i} weighs ${wi}: it does not fit, so <b>skip</b> is the only option. Copy the cell above: dp[${i}][${c}] = ${skip}.`;
            line = [5, 6];
          } else {
            take = M[i - 1][c - wi] + vi;
            const best = Math.max(skip, take), tw = take > skip;
            M[i][c] = best;
            arrows = [{ from: [i - 1, c], to: [i, c], cls: tw ? "visit" : "done", label: "skip" }, { from: [i - 1, c - wi], to: [i, c], cls: tw ? "done" : "visit", label: `+${vi}`, labelAt: 0.35 }];
            note = `Capacity ${c}, item ${i} (w ${wi}, v ${vi}). <b>Skip</b>: best without it, dp[${i - 1}][${c}] = ${skip}. <b>Take</b>: reserve ${wi} units, fill the other ${c - wi} with the best of the earlier items, dp[${i - 1}][${c - wi}] = ${M[i - 1][c - wi]}, plus ${vi} = ${take}. Both arrows start in row ${i - 1}, which has never seen item ${i}, so it is used at most once. dp = <b>${best}</b>${take === skip ? " (tie)" : tw ? " (take wins)" : " (skip wins)"}.`;
            line = [5, 6, 7];
          }
          snap({ cur: [i, c], arrows, items: { [i - 1]: "active" }, note, line, vars: { i, c, w: wi, v: vi, skip, take, "dp[i][c]": M[i][c] } });
        }
      }
      let c = Wc; const taken = [], path = [[n, Wc]], parr = [];
      snap({ path: path.slice(), note: `Table complete: the best value is dp[${n}][${Wc}] = <b>${M[n][Wc]}</b>. To list the items, walk back up from that corner and ask in each row which arrow produced the cell.`, line: 9, vars: { "dp[n][W]": M[n][Wc] } });
      for (let i = n; i >= 1; i--) {
        let note;
        if (M[i][c] === M[i - 1][c]) {
          parr.push({ from: [i - 1, c], to: [i, c], cls: "path", label: "skip" });
          note = `dp[${i}][${c}] = ${M[i][c]} equals the cell above: skipping item ${i} already reaches this value, so item ${i} is <b>not taken</b>. Move straight up.`;
        } else {
          const wi = wt[i - 1];
          parr.push({ from: [i - 1, c - wi], to: [i, c], cls: "path", label: `+${val[i - 1]}`, labelAt: 0.35 });
          taken.push(i - 1);
          note = `dp[${i}][${c}] = ${M[i][c]} differs from the cell above (${M[i - 1][c]}): only the take arrow explains it, so item ${i} is <b>taken</b>. Move up and left by its weight: capacity ${c} − ${wi} = ${c - wi}.`;
          c -= wi;
        }
        path.push([i - 1, c]);
        const items = {}; taken.forEach((k) => { items[k] = "path"; }); items[i - 1] = items[i - 1] || "active";
        snap({ path: path.slice(), arrows: parr.slice(), items, note, line: 9, vars: { i, c, taken: taken.map((k) => k + 1).reverse().join(",") || "—" } });
      }
      taken.reverse();
      const tw = taken.reduce((s, k) => s + wt[k], 0), tv = taken.reduce((s, k) => s + val[k], 0);
      const items = {}; taken.forEach((k) => { items[k] = "path"; });
      snap({ path: path.slice(), arrows: parr.slice(), items, ans: M[n][Wc], taken, note: `Taken: ${taken.length ? taken.map((k) => `item ${k + 1}`).join(", ") : "nothing"}. Weight ${tw} ≤ ${Wc}, value ${tv} = dp[${n}][${Wc}]. Time O(n·W), space O(n·W); the next visualizer squeezes it to one row.`, line: 8, vars: { answer: M[n][Wc], weight: tw } });
      return fr.map((f) => ({ ...f, wt, val }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = new Set(f.path.map(([r, c]) => `${r},${c}`));
      const g = dgrid(f.M, {
        label: "dp[i][c] = best value using only the first i items with capacity c",
        size: 40, gap: 12, colLabels: f.M[0].map((_, c) => `c=${c}`),
        rowLabels: f.M.map((_, i) => (i ? `item ${i} (${f.wt[i - 1]}/${f.val[i - 1]})` : "none")), rowLabelW: 104, arrows: f.arrows,
        cls: (r, c) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (src.has(`${r},${c}`)) return `${src.get(`${r},${c}`)} dep`;
          if (onPath.has(`${r},${c}`)) return "path";
          return "";
        },
      });
      return `<div class="dks-col">${itemsRow(f.wt, f.val, (k) => f.items[k] || "")}${g}</div>`;
    },
  }));

  /* ================= 2. One row: why the 0/1 loop runs backwards ================= */
  const DIR = ["backward: c = W down to w (0/1)", "forward: c = w up to W (unbounded)"];
  const DIR_CODE = {
    back: ["dp = [0] * (W + 1)                 # ONE row, reused for every item", "for w, v in items:", "    for c in range(W, w - 1, -1):  # BACKWARD: big capacities first", "        dp[c] = max(dp[c],           # keep: old value, item not used", "                    dp[c - w] + v)   # take: dp[c-w] is still the OLD row", "# each item is used at most once  ->  0/1 knapsack"],
    fwd: ["dp = [0] * (W + 1)", "for w, v in items:", "    for c in range(w, W + 1):      # FORWARD: small capacities first", "        dp[c] = max(dp[c],", "                    dp[c - w] + v)   # dp[c-w] may ALREADY contain this item", "# an item can be reused  ->  unbounded knapsack"],
  };
  Viz.register("dp-knapsack-direction", (el, opts) => Viz.player(el, {
    title: "Rolling to one row: the loop direction decides 0/1 vs unbounded",
    tag: "1D COMPRESSION",
    legend: [["active", "cell being written"], ["done", "winning option"], ["visit", "losing option"], ["bad", "reads a cell that already holds this item"], ["path", "value uses this item (×copies)"], ["accent", "rewritten, without this item"]],
    codeLang: "python",
    code: Array(6).fill(""),
    inputs: [
      { key: "mode", label: "inner loop", type: "select", value: opts && DIR.includes(opts.mode) ? opts.mode : DIR[0], options: DIR },
      { key: "w", label: "weights", value: (opts && opts.w) || "2,3", width: 90 },
      { key: "v", label: "values", value: (opts && opts.v) || "3,5", width: 90 },
      { key: "W", label: "W (1–12)", value: (opts && opts.W) || "7", width: 55 },
    ],
    random: () => { const n = Viz.rand(1, 3); return { w: Viz.randInts(n, 1, 4).join(","), v: Viz.randInts(n, 1, 9).join(","), W: String(Viz.rand(5, 10)) }; },
    build: ({ mode, w, v, W }) => {
      const back = mode === DIR[0];
      setCode(el, back ? DIR_CODE.back : DIR_CODE.fwd);
      const { wt, val } = parseItems(w, v, { maxN: 4, maxW: 10 });
      const Wc = Viz.parse.int(W, { min: 1, max: 12 });
      const dp = Array(Wc + 1).fill(0), fr = [];
      let old = dp.slice(), written = Array(Wc + 1).fill(false), cnt = Array(Wc + 1).fill(0), k = -1, cur = null, arrows = [];
      const snap = (note, line, vars) => fr.push({ old: old.slice(), dp: dp.slice(), written: written.slice(), cnt: cnt.slice(), k, cur, arrows: arrows.slice(), note, line, vars });
      snap(`One row <code>dp[0..${Wc}]</code> replaces the whole table, and every item rewrites it in place. The only question that matters: when <code>dp[c]</code> reads <code>dp[c − w]</code>, does it see the value from <b>before</b> this item (row i−1 of the 2D table) or <b>after</b> it (row i)?`, 0, { W: Wc });
      wt.forEach((wi, idx) => {
        const vi = val[idx];
        k = idx; old = dp.slice(); written = Array(Wc + 1).fill(false); cnt = Array(Wc + 1).fill(0); cur = null; arrows = [];
        snap(`Item ${idx + 1}: weight ${wi}, value ${vi}. The top row is a frozen copy of the values before this item (row ${idx} of the 2D table). The ${back ? "backward" : "forward"} loop now overwrites the bottom row ${back ? `from c = ${Wc} down to ${wi}` : `from c = ${wi} up to ${Wc}`}.`, [1, 2], { item: idx + 1, w: wi, v: vi });
        const order = [];
        if (back) for (let c = Wc; c >= wi; c--) order.push(c); else for (let c = wi; c <= Wc; c++) order.push(c);
        for (const c of order) {
          const readNew = written[c - wi], holds = cnt[c - wi];
          const keep = dp[c], take = dp[c - wi] + vi, tw = take > keep;
          arrows = [{ from: [0, c], to: [1, c], cls: tw ? "visit" : "done", label: "keep" }, { from: [1, c - wi], to: [1, c], arc: "down", cls: holds ? "bad" : tw ? "done" : "visit", label: `+${vi}` }];
          if (tw) { dp[c] = take; cnt[c] = holds + 1; }
          written[c] = true; cur = c;
          let note;
          if (back) note = `c = ${c}: keep ${keep}, or take = dp[${c - wi}] + ${vi} = ${take}. We move right to left and ${c - wi} &lt; ${c}, so dp[${c - wi}] has <b>not been rewritten yet</b>: it is still the old row and cannot contain item ${idx + 1}. dp[${c}] = <b>${dp[c]}</b>${tw ? " (take)" : " (keep)"}.`;
          else if (holds) note = `c = ${c}: dp[${c - wi}] was <b>already rewritten in this pass</b> and its value uses item ${idx + 1} ×${holds}. Taking it again stacks another copy: ${take}${tw ? ` beats ${keep}, so dp[${c}] now uses the item ×${cnt[c]}` : ` does not beat ${keep}`}. Reuse is exactly what <b>unbounded</b> knapsack wants and exactly what 0/1 forbids.`;
          else note = `c = ${c}: keep ${keep}, or take = dp[${c - wi}] + ${vi} = ${take}. ${readNew ? `dp[${c - wi}] was rewritten this pass but without this item, so no double use yet.` : `dp[${c - wi}] is still old.`} dp[${c}] = <b>${dp[c]}</b>${tw ? " (take)" : " (keep)"}.`;
          snap(note, [3, 4], { item: idx + 1, c, "c-w": c - wi, keep, take, "dp[c]": dp[c] });
        }
        cur = null; arrows = [];
        const reused = cnt.some((x) => x > 1);
        snap(`Item ${idx + 1} done. ${back ? `The live row now equals row ${idx + 1} of the 2D 0/1 table: every cell used item ${idx + 1} at most once.` : reused ? `Some cells now use item ${idx + 1} more than once (tags ×2, ×3…). The live row is row ${idx + 1} of the <b>unbounded</b> table.` : `No cell happened to reuse item ${idx + 1} this time, but nothing in the forward loop prevents it.`}`, 1, { item: idx + 1, "dp[W]": dp[Wc] });
      });
      const z = knap01(wt, val, Wc), u = knapUnb(wt, val, Wc);
      k = wt.length; old = dp.slice(); written = Array(Wc + 1).fill(false); cnt = Array(Wc + 1).fill(0);
      snap(back ? `dp[${Wc}] = <b>${dp[Wc]}</b>, the 0/1 answer (the full 2D table gives ${z}). Backward order guarantees every read sees row i−1. Unbounded would give ${u}.` : `dp[${Wc}] = <b>${dp[Wc]}</b>. The 0/1 answer is ${z}; the unbounded answer is ${u}. The forward loop computed the <b>unbounded</b> one${z === u ? " (they coincide for this input; try weights 2,3 values 3,5 W 7)" : ""}.`, 5, { "dp[W]": dp[Wc], "0/1": z, unbounded: u });
      fr[fr.length - 1].ans = dp[Wc];
      return fr.map((f) => ({ ...f, wt, val, back }));
    },
    render: (f) => {
      const src = srcMap(f.arrows);
      const g = dgrid([f.old, f.dp], {
        label: "top: frozen copy before the item (row i−1)  ·  bottom: the one live row",
        size: 42, gap: 10, colLabels: f.dp.map((_, c) => `c=${c}`), rowLabels: ["before item", "dp (live)"], rowLabelW: 86, arrows: f.arrows, arcDown: 62,
        cls: (r, c) => {
          if (r === 1 && c === f.cur) return "active";
          const s = src.get(`${r},${c}`);
          if (s) return `${s} dep`;
          if (r === 1 && f.cnt[c] > 0) return "path";
          if (r === 1 && f.written[c]) return "accent";
          return "";
        },
        tag: (r, c) => (r === 1 && f.cnt[c] > 0 ? `×${f.cnt[c]}` : ""),
      });
      return `<div class="dks-col">${itemsRow(f.wt, f.val, (k) => (k === f.k ? "active" : k < f.k ? "done" : ""))}${g}</div>`;
    },
  }));

  /* ================= 3. Coin Change: fewest coins (unbounded, min) ================= */
  const COIN_CODE = [
    "def coin_change(coins, amount):",
    "    dp = [0] + [INF] * amount      # dp[a] = fewest coins summing to a",
    "    for a in range(1, amount + 1):",
    "        for c in coins:             # which coin is the LAST one?",
    "            if c <= a and dp[a - c] + 1 < dp[a]:",
    "                dp[a] = dp[a - c] + 1",
    "                last[a] = c",
    "    return dp[amount] if dp[amount] < INF else -1",
  ];
  Viz.register("dp-knapsack-coins", (el) => Viz.player(el, {
    title: "Coin Change: fewest coins, one amount at a time",
    tag: "UNBOUNDED · MIN",
    legend: [["active", "amount being computed"], ["done", "best last coin"], ["visit", "other last coins"], ["bad", "comes from an unreachable amount (∞)"], ["path", "the coins of the answer"]],
    codeLang: "python",
    code: COIN_CODE,
    inputs: [{ key: "coins", label: "coins (1–12)", value: "1,3,4", width: 110 }, { key: "amount", label: "amount (1–16)", value: "6", width: 60 }],
    random: () => ({ coins: [...new Set(Viz.randInts(Viz.rand(2, 4), 2, 9))].sort((a, b) => a - b).join(","), amount: String(Viz.rand(8, 16)) }),
    build: ({ coins, amount }) => {
      const cs = [...new Set(nums(coins, { min: 1, max: 5, lo: 1, hi: 12, what: "Coins" }))].sort((a, b) => a - b);
      const A = Viz.parse.int(amount, { min: 1, max: 16 });
      const dp = Array(A + 1).fill(null), last = Array(A + 1).fill(0), fr = [];
      dp[0] = 0;
      fr.push({ dp: dp.slice(), cur: 0, arrows: [], note: "dp[0] = 0: zero coins make amount 0. Every other amount starts unknown; ∞ will mean unreachable.", line: 1, vars: { a: 0, "dp[a]": 0 } });
      for (let a = 1; a <= A; a++) {
        let best = INF, bc = 0; const parts = [];
        for (const c of cs) {
          if (c > a) continue;
          const cand = dp[a - c] + 1;
          parts.push(dp[a - c] === INF ? `coin ${c}: amount ${a - c} is unreachable` : `coin ${c}: dp[${a - c}] + 1 = ${cand}`);
          if (cand < best) { best = cand; bc = c; }
        }
        dp[a] = best; last[a] = bc;
        const arrows = cs.filter((c) => c <= a).map((c) => ({ from: [0, a - c], to: [0, a], arc: "up", cls: dp[a - c] === INF ? "bad" : c === bc ? "done" : "visit", label: String(c) }));
        fr.push({ dp: dp.slice(), cur: a, arrows, note: parts.length ? `Amount ${a}: try each coin as the <b>last</b> one; what is left must be paid optimally, and dp already knows how. ${parts.join("; ")}. dp[${a}] = <b>${fmtN(best)}</b>${best === INF ? ": no coin combination reaches it" : ` (last coin ${bc})`}.` : `Amount ${a}: every coin is bigger than ${a}, so it is unreachable: ∞.`, line: [3, 4, 5, 6], vars: { a, "dp[a]": fmtN(best), last: bc || "—" } });
      }
      let gLeft = A, gCount = 0; for (const c of [...cs].reverse()) { gCount += Math.floor(gLeft / c); gLeft %= c; }
      const greedy = gLeft ? "fails (−1)" : `${gCount} coins`;
      if (dp[A] === INF) {
        fr.push({ dp: dp.slice(), cur: null, arrows: [], ans: -1, note: `dp[${A}] = ∞, so return <b>−1</b>. No mix of ${cs.join(", ")} sums to ${A}. Greedy (largest coin first): ${greedy}.`, line: 7, vars: { answer: -1 } });
      } else {
        const used = [], arrows = [], path = [A]; let a = A;
        while (a > 0) { const c = last[a]; used.push(c); arrows.push({ from: [0, a - c], to: [0, a], arc: "up", cls: "path", label: String(c) }); a -= c; path.push(a); }
        fr.push({ dp: dp.slice(), cur: null, arrows, path, ans: dp[A], used, note: `Answer <b>${dp[A]}</b> coins: ${used.join(" + ")} = ${A}, found by following last[a] back to 0. Greedy (largest coin first) gives ${greedy}${!gLeft && gCount > dp[A] ? `: <b>worse</b>, because taking the biggest coin first can force many small ones later` : ""}.`, line: 7, vars: { answer: dp[A], coins: used.join("+") } });
      }
      return fr.map((f) => ({ ...f, cs }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), onPath = new Set(f.path || []);
      const g = dgrid([f.dp], {
        label: "dp[a] = fewest coins that sum to a (arc label = the last coin)", size: 40, gap: 8, colLabels: f.dp.map((_, a) => `a=${a}`), arrows: f.arrows, arcUp: 86,
        cls: (r, c) => (c === f.cur ? "active" : src.has(`0,${c}`) ? `${src.get(`0,${c}`)} dep` : onPath.has(c) ? "path" : f.dp[c] === null ? "" : f.dp[c] === INF ? "dim" : ""),
      });
      return `<div class="dks-col">${Viz.array(f.cs, { label: "coins (unlimited supply)", showIdx: false, cls: () => "accent" })}${g}</div>`;
    },
  }));

  /* ================= 4. Loop order: combinations vs permutations ================= */
  const ORD = ["coins outer: combinations (518)", "amounts outer: permutations (377)"];
  const ORD_CODE = {
    comb: ["ways = [1] + [0] * amount", "for c in coins:                     # OUTER loop: coins", "    for a in range(c, amount + 1):   # inner: amounts (forward = reuse c)", "        ways[a] += ways[a - c]       # append c to every way of a - c", "return ways[amount]   # coins appear in loop order: each multiset once"],
    perm: ["ways = [1] + [0] * amount", "for a in range(1, amount + 1):      # OUTER loop: amounts", "    for c in coins:                  # inner: ANY coin may come last", "        if c <= a: ways[a] += ways[a - c]", "return ways[amount]   # 1+2 and 2+1 are counted separately"],
  };
  Viz.register("dp-knapsack-order", (el, opts) => Viz.player(el, {
    title: "Same recurrence, swapped loops: multisets vs sequences",
    tag: "LOOP ORDER",
    legend: [["active", "ways just appended"], ["visit", "column being read (a − c)"], ["bad", "same coins, different order (permutation duplicates)"]],
    codeLang: "python",
    code: Array(5).fill(""),
    inputs: [
      { key: "mode", label: "loop order", type: "select", value: opts && ORD.includes(opts.mode) ? opts.mode : ORD[0], options: ORD },
      { key: "coins", label: "coins (1–8)", value: "1,2,3", width: 90 },
      { key: "amount", label: "amount (1–8)", value: "4", width: 55 },
    ],
    random: () => ({ coins: [...new Set(Viz.randInts(Viz.rand(2, 3), 1, 4))].sort((a, b) => a - b).join(","), amount: String(Viz.rand(4, 6)) }),
    build: ({ mode, coins, amount }) => {
      const comb = mode === ORD[0];
      setCode(el, comb ? ORD_CODE.comb : ORD_CODE.perm);
      const cs = [...new Set(nums(coins, { min: 1, max: 4, lo: 1, hi: 8, what: "Coins" }))].sort((a, b) => a - b);
      const A = Viz.parse.int(amount, { min: 1, max: 8 });
      const L = Array.from({ length: A + 1 }, () => []); L[0].push([]);
      const fr = [];
      const snap = (o) => fr.push({ L: L.map((l) => l.map((w) => w.slice())), ...o });
      snap({ cur: null, note: `ways[0] = 1: the empty selection (∅) is the one way to make 0. Every other way is built by appending one coin to a way of a smaller amount. Each column lists the actual ways, so you can see what is being counted.`, line: 0, vars: { "ways[0]": 1 } });
      if (comb) {
        for (const c of cs) {
          snap({ cur: null, coin: c, note: `Coin ${c} enters. From now on ${c} may be appended, but only <b>after</b> the coins processed earlier (${cs.filter((x) => x < c).join(", ") || "none"}). That fixes the order inside every way, so no multiset can appear twice.`, line: 1, vars: { c } });
          for (let a = c; a <= A; a++) {
            const from = L[a - c].length, before = L[a].length;
            if (!from) { snap({ cur: a, src: a - c, coin: c, newFrom: before, note: `ways[${a}] += ways[${a - c}] = 0: nothing to extend.`, line: 3, vars: { c, a, "ways[a]": before } }); continue; }
            L[a].push(...L[a - c].map((w) => [...w, c]));
            snap({ cur: a, src: a - c, coin: c, newFrom: before, note: `ways[${a}] += ways[${a - c}]: each of the ${from} way${from > 1 ? "s" : ""} to make ${a - c} gets a ${c} appended (orange). ${a - c >= c ? `Column ${a - c} was already updated for coin ${c}, so ways that use ${c} several times appear: that is the unbounded part.` : ""} ways[${a}] = <b>${L[a].length}</b>.`, line: 3, vars: { c, a, "ways[a-c]": from, "ways[a]": L[a].length } });
          }
        }
      } else {
        for (let a = 1; a <= A; a++) {
          for (const c of cs) {
            if (c > a) continue;
            const from = L[a - c].length, before = L[a].length;
            L[a].push(...L[a - c].map((w) => [...w, c]));
            snap({ cur: a, src: a - c, coin: c, newFrom: before, note: `Amount ${a}, last coin ${c}: every way to make ${a - c} (${from}) plus a final ${c}. All of ways[${a - c}] is complete (all coins), so a ${c} can follow <b>any</b> coin, including larger ones. ways[${a}] = <b>${L[a].length}</b>.`, line: 3, vars: { a, c, "ways[a-c]": from, "ways[a]": L[a].length } });
          }
        }
      }
      const total = L[A].length, multis = new Set(L[A].map((w) => w.slice().sort((x, y) => x - y).join("+"))).size;
      snap({ cur: A, final: true, note: comb ? `ways[${A}] = <b>${total}</b> combinations. Each multiset of coins appears exactly once, in non-decreasing order. This is Coin Change II (518).` : `ways[${A}] = <b>${total}</b> sequences, but only ${multis} distinct multisets: red chips are the same coins in a different order. This is Combination Sum IV (377), which (despite its name) counts ordered sequences.`, line: 4, vars: { answer: total, multisets: multis } });
      fr[fr.length - 1].ans = total;
      return fr.map((f) => ({ ...f, comb, A }));
    },
    render: (f) => {
      const cols = f.L.map((list, a) => {
        const keyCount = {};
        list.forEach((w) => { const k = w.slice().sort((x, y) => x - y).join("+"); keyCount[k] = (keyCount[k] || 0) + 1; });
        const shown = list.slice(0, 9).map((w, k) => {
          const isNew = a === f.cur && f.newFrom !== undefined && k >= f.newFrom && !f.final;
          const dup = !f.comb && keyCount[w.slice().sort((x, y) => x - y).join("+")] > 1;
          return `<span class="dks-chip ${isNew ? "active" : dup ? "bad" : ""}">${esc(w.length ? w.join("+") : "∅")}</span>`;
        }).join("");
        const more = list.length > 9 ? `<span class="dks-more">+${list.length - 9} more</span>` : "";
        return `<div class="dks-wcol ${a === f.cur ? "active" : a === f.src ? "visit" : ""}"><div class="dks-wh">a=${a}</div><div class="dks-wn">${list.length}</div>${shown}${more}</div>`;
      }).join("");
      return `<div class="dks-col"><div class="v-labeled"><span class="v-caption">ways[a]: the count, then the actual ways it counts</span><div class="dks-ways">${cols}</div></div></div>`;
    },
  }));

  /* ================= 5. Subset sum as a bitset ================= */
  const BS = ["subset sum: hit the target", "partition equal subset (416)", "last stone weight II (1049)"];
  const BS_CODE = [
    "bits = 1                       # bit s set  <=>  some subset sums to s",
    "for x in nums:",
    "    bits |= bits << x          # old sums, plus every old sum + x",
    "# subset sum:  (bits >> target) & 1",
    "# partition:   S % 2 == 0 and (bits >> S // 2) & 1",
    "# stones:      S - 2 * (largest set bit s <= S // 2)",
  ];
  Viz.register("dp-knapsack-bitset", (el, opts) => Viz.player(el, {
    title: "Subset sum: the whole DP row is one big integer",
    tag: "BITSET",
    legend: [["done", "reachable sum (bit = 1)"], ["active", "newly reachable with x"], ["visit", "shifted copy: old sums + x"], ["accent", "the sum we are asking about"], ["path", "numbers in the reconstructed subset"]],
    codeLang: "python",
    code: BS_CODE,
    inputs: [
      { key: "mode", label: "question", type: "select", value: opts && BS.includes(opts.mode) ? opts.mode : BS[0], options: BS },
      { key: "nums", label: "nums (sum ≤ 30)", value: (opts && opts.nums) || "3,5,6,7", width: 120 },
      { key: "t", label: "target (subset sum)", value: "11", width: 55 },
    ],
    random: () => { let a; do { a = Viz.randInts(Viz.rand(3, 6), 1, 9); } while (a.reduce((s, x) => s + x, 0) > 30); const S = a.reduce((s, x) => s + x, 0); return { nums: a.join(","), t: String(Viz.rand(1, S)) }; },
    build: ({ mode, nums: ns, t }) => {
      const a = nums(ns, { min: 1, max: 8, lo: 1, hi: 30, what: "Numbers" });
      const S = a.reduce((s, x) => s + x, 0);
      if (S > 30) throw new Error(`The numbers sum to ${S}; keep the total at most 30 so the bit row fits.`);
      const m = BS.indexOf(mode);
      let target = m === 0 ? Viz.parse.int(t, { min: 0, max: S }) : Math.floor(S / 2);
      const fr = [], hist = [];
      let bits = Array(S + 1).fill(0); bits[0] = 1; hist.push(bits.slice());
      const big = (b) => "0b" + b.slice().reverse().join("").replace(/^0+(?=.)/, "");
      const blank = Array(S + 1).fill(null);
      const snap = (o) => fr.push({ rows: [bits.slice(), blank, blank], ...o });
      snap({ k: -1, note: `bits = 1: only bit 0 is set, because the empty subset sums to 0. Bit s will be set exactly when some subset of the numbers seen so far sums to s. ${m === 0 ? `We ask about s = ${target}.` : m === 1 ? `Partition asks for S/2 = ${S}/2${S % 2 ? ", which is not an integer: the answer is already false, but watch the row anyway" : ` = ${target}`}.` : `Last Stone Weight II wants the reachable sum closest to S/2 = ${(S / 2).toFixed(1)} from below.`}`, line: 0, vars: { S, bits: big(bits) } });
      a.forEach((x, k) => {
        const sh = Array(S + 1).fill(null); for (let s = 0; s + x <= S; s++) sh[s + x] = bits[s];
        fr.push({ rows: [bits.slice(), sh, blank], k, x, arrowsFrom: bits.map((b, s) => (b && s + x <= S ? s : -1)).filter((s) => s >= 0), note: `x = ${x}: shift the row left by ${x} (in the picture: right by ${x} cells). Every reachable sum s becomes s + ${x}: "the same subset plus ${x}". Sums above S fall off.`, line: 2, vars: { x, bits: big(bits) } });
        const before = bits.slice();
        for (let s = S; s >= x; s--) if (before[s - x]) bits[s] = 1;
        hist.push(bits.slice());
        const fresh = bits.map((b, s) => (b && !before[s] ? s : -1)).filter((s) => s >= 0);
        fr.push({ rows: [before, sh, bits.slice()], k, x, fresh, note: `OR the two rows: a sum is reachable if it was already (skip ${x}) or if it is an old sum + ${x} (take ${x}). ${fresh.length ? `New sums: ${fresh.join(", ")}.` : "Nothing new this time."} One machine word handles 64 sums per instruction, so this is about 64× faster than the boolean-array loop.`, line: 2, vars: { x, bits: big(bits) } });
      });
      let answer, note;
      if (m === 0) { answer = !!bits[target]; note = answer ? `Bit ${target} is set: some subset sums to ${target}.` : `Bit ${target} is 0: no subset sums to ${target}.`; }
      else if (m === 1) { answer = S % 2 === 0 && !!bits[target]; note = S % 2 ? `S = ${S} is odd, so two equal halves are impossible: <b>false</b>.` : answer ? `Bit S/2 = ${target} is set: one subset takes ${target}, the rest is the other ${target}. <b>true</b>.` : `Bit S/2 = ${target} is 0: <b>false</b>.`; }
      else { let s = Math.floor(S / 2); while (!bits[s]) s--; target = s; answer = S - 2 * s; note = `Smash the stones as two teams: the result is |team A − team B| = S − 2·A with A ≤ S/2. Largest reachable A ≤ ${Math.floor(S / 2)} is ${s}, so the last stone weighs ${S} − 2·${s} = <b>${answer}</b>.`; }
      const reach = !!bits[target];
      fr.push({ rows: [bits.slice(), blank, blank], k: a.length, note: `${note}${reach ? " Now reconstruct a subset by walking the history of rows backwards." : ""}`, line: m + 3, vars: { answer: String(answer) }, ans: answer });
      if (reach) {
        let tt = target; const take = [];
        for (let k = a.length - 1; k >= 0; k--) {
          if (hist[k][tt]) { fr.push({ rows: [hist[k + 1], blank, hist[k]], k, take: take.slice(), cell: tt, note: `Was ${tt} already reachable before ${a[k]} (bottom row)? Yes, so skip ${a[k]} and keep looking for ${tt}.`, line: 2, vars: { x: a[k], need: tt } }); }
          else { take.push(k); fr.push({ rows: [hist[k + 1], blank, hist[k]], k, take: take.slice(), cell: tt, note: `${tt} was <b>not</b> reachable before ${a[k]}, so ${a[k]} must be in the subset. Look for ${tt} − ${a[k]} = ${tt - a[k]} next.`, line: 2, vars: { x: a[k], need: tt - a[k] } }); tt -= a[k]; }
        }
        fr.push({ rows: [bits.slice(), blank, blank], k: a.length, take, note: `Subset: ${take.length ? take.slice().reverse().map((k) => a[k]).join(" + ") : "∅"} = ${target}. ${m === 2 ? `The other stones sum to ${S - target}; their difference is ${answer}.` : ""}`, line: m + 3, vars: { answer: String(answer), subset: take.slice().reverse().map((k) => a[k]).join("+") || "∅" }, ans: answer, subset: take.map((k) => a[k]) });
      }
      return fr.map((f) => ({ ...f, a, target, S, m }));
    },
    render: (f) => {
      const recon = f.take !== undefined;
      const labels = recon && f.cell !== undefined ? ["with x", "", "before x"] : ["bits", f.x !== undefined ? `<< ${f.x}` : "", f.rows[2][0] !== null ? "bits |= …" : ""];
      const rows = f.rows.filter((r, i) => i === 0 || r.some((v) => v !== null));
      const rl = labels.filter((_, i) => i === 0 || f.rows[i].some((v) => v !== null));
      const g = dgrid(rows, {
        label: recon ? "reconstruction: compare the row after x with the row before x" : "bit s of the integer = \"some subset sums to s\"",
        size: 24, gap: 3, small: true, colLabels: f.rows[0].map((_, s) => String(s)), rowLabels: rl, rowLabelW: 74,
        fmt: (v) => (v === null ? "" : String(v)),
        cls: (r, c, v) => {
          const real = f.rows.indexOf(rows[r]);
          if (v === null) return "dim";
          if (recon && f.cell === c && (real === 0 || real === 2)) return "active";
          if (real === 1) return v ? "visit" : "dim";
          if (real === 2 && !recon && f.fresh && f.fresh.includes(c)) return "active";
          if (c === f.target && !v) return "accent";
          return v ? "done" : "dim";
        },
      });
      const chosen = new Set(f.take || []);
      return `<div class="dks-col">${Viz.array(f.a, { label: "nums", cls: (k) => (chosen.has(k) ? "path" : k === f.k && f.k < f.a.length ? "active" : k < f.k ? "done" : "") })}${g}</div>`;
    },
  }));

  /* ================= 6. Target Sum: signs become a subset ================= */
  const TS_CODE = [
    "def find_target_sum_ways(nums, target):",
    "    S = sum(nums)",
    "    if abs(target) > S or (S + target) % 2: return 0",
    "    P = (S + target) // 2          # sum of the numbers that get '+'",
    "    ways = [1] + [0] * P            # ways[c] = subsets summing to c",
    "    for x in nums:",
    "        for c in range(P, x - 1, -1):   # backward: each number once",
    "            ways[c] += ways[c - x]",
    "    return ways[P]",
  ];
  Viz.register("dp-knapsack-targetsum", (el) => Viz.player(el, {
    title: "Target Sum: choose the '+' group, then count subsets",
    tag: "TRANSFORM · COUNT",
    legend: [["active", "cell being added to"], ["done", "source ways[c − x]"], ["path", "numbers given '+'"], ["bad", "numbers given '−'"]],
    codeLang: "python",
    code: TS_CODE,
    inputs: [{ key: "nums", label: "nums (0–20)", value: "1,1,1,1,1", width: 130 }, { key: "t", label: "target", value: "3", width: 55 }],
    random: () => { let a, t, P; do { a = Viz.randInts(Viz.rand(3, 6), 0, 6); const S = a.reduce((s, x) => s + x, 0); t = Viz.rand(-S, S); P = (S + t) / 2; } while (!Number.isInteger(P) || P > 20); return { nums: a.join(","), t: String(t) }; },
    build: ({ nums: ns, t }) => {
      const a = nums(ns, { min: 1, max: 8, lo: 0, hi: 20, what: "Numbers" });
      const T = Viz.parse.int(t, { min: -200, max: 200 });
      const S = a.reduce((s, x) => s + x, 0), fr = [];
      let brute = 0, example = null;
      for (let mask = 0; mask < 1 << a.length; mask++) { let v = 0; a.forEach((x, k) => { v += mask >> k & 1 ? x : -x; }); if (v === T) { brute++; if (!example) example = mask; } }
      const base = { a, S, T, signs: null, ways: null, cur: null, arrows: [] };
      fr.push({ ...base, note: `Put a sign on every number so the total is ${T}. Call P the sum of the '+' numbers and N the sum of the '−' numbers. Then P − N = ${T} and P + N = S = ${S}. Add the two equations: 2P = S + T, so <b>P = (S + T) / 2</b>. The signs no longer matter: count the subsets whose sum is P.`, line: [1, 3], vars: { S, target: T } });
      if (Math.abs(T) > S || (S + T) % 2) {
        fr.push({ ...base, ans: 0, note: Math.abs(T) > S ? `|target| = ${Math.abs(T)} &gt; S = ${S}: even all '+' (or all '−') cannot reach it. Answer <b>0</b>.` : `S + T = ${S + T} is odd, so P would not be a whole number: no sign pattern works. Answer <b>0</b> (brute force agrees: ${brute}).`, line: 2, vars: { answer: 0 } });
        return fr;
      }
      const P = (S + T) / 2;
      if (P > 20) throw new Error(`P = (S + target) / 2 = ${P}; keep it at most 20 so the row fits.`);
      const ways = [1, ...Array(P).fill(0)];
      fr.push({ ...base, P, ways: ways.slice(), note: `P = (${S} + ${T}) / 2 = <b>${P}</b>. ways[0] = 1 (the empty subset); everything else 0. This is the 0/1 counting knapsack: each number is used at most once, so the inner loop runs <b>backward</b>.`, line: [3, 4], vars: { P } });
      a.forEach((x, k) => {
        let changed = 0;
        for (let c = P; c >= x; c--) {
          if (!ways[c - x]) continue;
          const before = ways[c];
          ways[c] += ways[c - x]; changed++;
          fr.push({ ...base, P, ways: ways.slice(), k, cur: c, arrows: [{ from: [0, c - x], to: [0, c], arc: "down", cls: "done", label: `+${ways[c - x]}` }], note: x === 0 ? `x = 0: c − x = c, so ways[${c}] doubles (${before} → ${ways[c]}). A zero can be +0 or −0: two sign patterns, same sum.` : `x = ${x}: every subset making ${c - x} plus ${x} makes ${c}. ways[${c}] = ${before} + ${ways[c - x]} = <b>${ways[c]}</b>. ways[${c - x}] has not been touched yet in this pass (we go right to left), so ${x} is used at most once.`, line: [6, 7], vars: { x, c, "ways[c-x]": ways[c - x], "ways[c]": ways[c] } });
        }
        if (!changed) fr.push({ ...base, P, ways: ways.slice(), k, note: `x = ${x}: no reachable sum c − ${x} in range, so nothing changes.`, line: 5, vars: { x } });
      });
      const signs = example === null ? null : a.map((_, k) => (example >> k & 1 ? "+" : "−"));
      fr.push({ ...base, P, ways: ways.slice(), signs, ans: ways[P], note: `ways[${P}] = <b>${ways[P]}</b> sign patterns (brute force over all 2^${a.length} patterns agrees: ${brute}).${signs ? ` One of them: ${a.map((x, k) => `${signs[k]}${x}`).join(" ")} = ${T}; its '+' numbers sum to ${P}.` : ""}`, line: 8, vars: { answer: ways[P] } });
      return fr;
    },
    render: (f) => {
      const arr = Viz.array(f.a, { label: f.signs ? "nums with one valid sign pattern" : "nums", fmt: (v, k) => (f.signs ? `${f.signs[k]}${v}` : String(v)), cls: (k) => (f.signs ? (f.signs[k] === "+" ? "path" : "bad") : k === f.k ? "active" : f.k !== undefined && k < f.k ? "done" : "") });
      const eq = `<div class="dks-eq"><span>P − N = <b>${f.T}</b></span><span>P + N = <b>${f.S}</b></span><span class="dks-eq-res">P = (S + T) / 2 = <b>${f.P !== undefined ? f.P : (f.S + f.T) / 2}</b></span></div>`;
      if (!f.ways) return `<div class="dks-col">${arr}${eq}</div>`;
      const src = srcMap(f.arrows);
      const g = dgrid([f.ways], { label: "ways[c] = number of subsets of the numbers so far that sum to c", size: 38, gap: 6, colLabels: f.ways.map((_, c) => `c=${c}`), arrows: f.arrows, arcDown: 60,
        cls: (r, c) => (c === f.cur ? "active" : src.has(`0,${c}`) ? "done dep" : c === f.P ? "accent" : f.ways[c] ? "" : "dim") });
      return `<div class="dks-col">${arr}${eq}${g}</div>`;
    },
  }));

  /* ================= 7. Bounded knapsack: binary splitting ================= */
  const BIN_CODE = [
    "def split(count, w, v):",
    "    pieces, b = [], 1",
    "    while count > 0:",
    "        take = min(b, count)        # 1, 2, 4, 8, ... then the remainder",
    "        pieces.append((take * w, take * v))",
    "        count -= take; b *= 2",
    "    return pieces    # now run plain 0/1 knapsack over the pieces",
  ];
  Viz.register("dp-knapsack-bounded", (el) => Viz.player(el, {
    title: "Bounded knapsack: k copies become about log₂ k ordinary items",
    tag: "BINARY SPLITTING",
    legend: [["active", "piece being created"], ["done", "pieces chosen to make this count"], ["dim", "pieces left out"]],
    codeLang: "python",
    code: BIN_CODE,
    inputs: [{ key: "k", label: "copies k (1–40)", value: "13", width: 60 }, { key: "w", label: "weight", value: "2", width: 50 }, { key: "v", label: "value", value: "3", width: 50 }],
    random: () => ({ k: String(Viz.rand(5, 40)), w: String(Viz.rand(1, 5)), v: String(Viz.rand(1, 9)) }),
    build: ({ k, w, v }) => {
      const K = Viz.parse.int(k, { min: 1, max: 40 }), wi = Viz.parse.int(w, { min: 1, max: 99 }), vi = Viz.parse.int(v, { min: 0, max: 999 });
      const pieces = [], fr = [];
      let left = K, b = 1;
      fr.push({ pieces: [], left, q: null, sel: [], note: `One item type, ${K} copies, each weight ${wi} and value ${vi}. Treating the copies as ${K} separate 0/1 items is correct but costs ${K}× the work. Instead, bundle them into pieces of 1, 2, 4, … copies.`, line: [0, 1], vars: { count: K, b: 1 } });
      while (left > 0) {
        const take = Math.min(b, left);
        pieces.push(take); left -= take;
        fr.push({ pieces: pieces.slice(), left, q: null, sel: [], cur: pieces.length - 1, note: take === b ? `Bundle ${take} cop${take > 1 ? "ies" : "y"} into one piece (weight ${take * wi}, value ${take * vi}). ${left} left.` : `Only ${take} left, fewer than the next power ${b}: they form the last piece. With the powers before it, every count from 0 to ${K} is still reachable (next frames).`, line: [3, 4, 5], vars: { take, count: left, b: b * 2 } });
        b *= 2;
      }
      const P = pieces.length, sums = new Map();
      for (let mask = 0; mask < 1 << P; mask++) { let s = 0; for (let j = 0; j < P; j++) if (mask >> j & 1) s += pieces[j]; if (!sums.has(s)) sums.set(s, mask); }
      fr.push({ pieces, left: 0, q: null, sel: [], note: `${K} copies became ${P} pieces: ${pieces.join(" + ")} = ${K}. Claim: <b>every</b> count 0…${K} is a sum of some of these pieces, so a 0/1 choice over the pieces can express "take q copies" for any q. Check every q:`, line: 6, vars: { pieces: P } });
      for (let q = 0; q <= K; q++) {
        if (!sums.has(q)) throw new Error(`Internal check failed for q = ${q}.`);
        const mask = sums.get(q), sel = range(P).filter((j) => mask >> j & 1);
        fr.push({ pieces, left: 0, q, sel, note: `${q} cop${q === 1 ? "y" : "ies"} = ${sel.length ? sel.map((j) => pieces[j]).join(" + ") : "no pieces"}: weight ${q * wi}, value ${q * vi}.`, line: 6, vars: { q, pieces: sel.map((j) => pieces[j]).join("+") || "∅" } });
      }
      fr.push({ pieces, left: 0, q: null, sel: [], note: `All ${K + 1} counts are covered, so the ${P} pieces are an exact replacement for the ${K} copies. Cost per item type drops from O(k·W) to O(log k · W). (A monotone-queue trick brings it to O(W); see State Machines &amp; DP Optimisations.)`, line: 6, vars: { copies: K, items: P }, ans: P });
      return fr.map((f) => ({ ...f, K, wi, vi }));
    },
    render: (f) => {
      const chosen = new Set(f.sel);
      const arr = Viz.array(f.pieces, { label: "pieces (copies bundled together)", fmt: (p) => `×${p}`, idxLabel: (j) => `w${f.pieces[j] * f.wi} v${f.pieces[j] * f.vi}`, cls: (j) => (j === f.cur ? "active" : f.q === null ? "" : chosen.has(j) ? "done" : "dim") });
      let units = "", start = 0;
      f.pieces.forEach((p, j) => {
        const st = f.q === null ? (j === f.cur ? "active" : "visit") : chosen.has(j) ? "done" : "dim";
        for (let u = 0; u < p; u++) units += `<span class="dks-unit ${st} ${u === 0 ? "first" : ""}" title="piece ${j + 1}"></span>`;
        start += p;
      });
      for (let u = start; u < f.K; u++) units += `<span class="dks-unit"></span>`;
      return `<div class="dks-col">${arr}<div class="v-labeled"><span class="v-caption">${f.q === null ? `the ${f.K} copies, grouped by piece` : `q = ${f.q}: the copies taken`}</span><div class="dks-units">${units}</div></div></div>`;
    },
  }));

  /* ================= 8. Ones and Zeroes: two capacities ================= */
  const OZ_CODE = [
    "def find_max_form(strs, m, n):",
    "    dp = [[0] * (n + 1) for _ in range(m + 1)]   # dp[i][j]: most strings, <= i zeros, <= j ones",
    "    for s in strs:",
    "        z, o = s.count('0'), s.count('1')",
    "        for i in range(m, z - 1, -1):              # BOTH capacities backward",
    "            for j in range(n, o - 1, -1):",
    "                dp[i][j] = max(dp[i][j], dp[i - z][j - o] + 1)",
    "    return dp[m][n]",
  ];
  Viz.register("dp-knapsack-ones", (el) => Viz.player(el, {
    title: "Ones and Zeroes: a knapsack with two capacities",
    tag: "2D CAPACITY",
    legend: [["active", "cell being updated"], ["done", "take wins: source cell"], ["visit", "keep wins: source cell"], ["path", "improved during this string"]],
    codeLang: "python",
    code: OZ_CODE,
    inputs: [{ key: "strs", label: "strings of 0/1", value: "10,0001,111001,1,0", width: 170 }, { key: "m", label: "m zeros (0–5)", value: "5", width: 50 }, { key: "n", label: "n ones (0–5)", value: "3", width: 50 }],
    random: () => ({ strs: Array.from({ length: Viz.rand(3, 5) }, () => Array.from({ length: Viz.rand(1, 4) }, () => (Math.random() < 0.5 ? "0" : "1")).join("")).join(","), m: String(Viz.rand(2, 5)), n: String(Viz.rand(2, 4)) }),
    build: ({ strs, m, n }) => {
      const ss = String(strs).split(/[\s,]+/).filter(Boolean);
      if (!ss.length || ss.length > 6 || ss.some((s) => !/^[01]{1,6}$/.test(s))) throw new Error("Give 1–6 strings of 0s and 1s (each 1–6 characters), separated by commas.");
      const Mz = Viz.parse.int(m, { min: 0, max: 5 }), No = Viz.parse.int(n, { min: 0, max: 5 });
      const dp = Array.from({ length: Mz + 1 }, () => Array(No + 1).fill(0)), fr = [];
      let improved = new Set();
      fr.push({ dp: Viz.clone(dp), k: -1, cur: null, arrows: [], improved: [], note: `Each string costs some zeros and some ones; both budgets must hold. So capacity is a <b>pair</b> (i, j) and dp is a 2D table, one cell per remaining budget. It is still 0/1 knapsack (value 1 per string).`, line: 1, vars: { m: Mz, n: No } });
      ss.forEach((s, k) => {
        const z = [...s].filter((c) => c === "0").length, o = s.length - z;
        improved = new Set();
        fr.push({ dp: Viz.clone(dp), k, cur: null, arrows: [], improved: [], note: `"${s}" costs ${z} zero${z === 1 ? "" : "s"} and ${o} one${o === 1 ? "" : "s"}. ${z > Mz || o > No ? "It exceeds a budget, so no cell can take it." : "Both loops run backward, so every dp[i − z][j − o] read below is still the value before this string."}`, line: 3, vars: { s, z, o } });
        for (let i = Mz; i >= z; i--) for (let j = No; j >= o; j--) {
          const keep = dp[i][j], take = dp[i - z][j - o] + 1, tw = take > keep;
          if (tw) { dp[i][j] = take; improved.add(`${i},${j}`); }
          const arrows = (z || o) ? [{ from: [i - z, j - o], to: [i, j], cls: tw ? "done" : "visit", label: "+1" }] : [];
          fr.push({ dp: Viz.clone(dp), k, cur: [i, j], arrows, improved: [...improved], note: `Budget (${i} zeros, ${j} ones): keep ${keep}, or take "${s}" and use the best answer for the leftover budget (${i - z}, ${j - o}): ${take - 1} + 1 = ${take}. dp = <b>${dp[i][j]}</b>.`, line: 6, vars: { s, i, j, keep, take, "dp[i][j]": dp[i][j] } });
        }
      });
      let brute = 0;
      for (let mask = 0; mask < 1 << ss.length; mask++) { let zz = 0, oo = 0, c = 0; ss.forEach((s, k) => { if (mask >> k & 1) { c++; for (const ch of s) ch === "0" ? zz++ : oo++; } }); if (zz <= Mz && oo <= No) brute = Math.max(brute, c); }
      fr.push({ dp: Viz.clone(dp), k: ss.length, cur: [Mz, No], arrows: [], improved: [], ans: dp[Mz][No], note: `dp[${Mz}][${No}] = <b>${dp[Mz][No]}</b> strings (trying all 2^${ss.length} subsets agrees: ${brute}). Time O(L · m · n) for L strings.`, line: 7, vars: { answer: dp[Mz][No] } });
      return fr.map((f) => ({ ...f, ss }));
    },
    render: (f) => {
      const src = srcMap(f.arrows), imp = new Set(f.improved);
      const arr = Viz.array(f.ss, { label: "strings", cls: (k) => (k === f.k ? "active" : k < f.k ? "done" : "") });
      const g = dgrid(f.dp, { label: "dp[i][j] = most strings that fit in i zeros and j ones", size: 44, gap: 16, colLabels: f.dp[0].map((_, j) => `${j} ones`), rowLabels: f.dp.map((_, i) => `${i} zeros`), rowLabelW: 64, arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${src.get(`${r},${c}`)} dep` : imp.has(`${r},${c}`) ? "path" : "") });
      return `<div class="dks-col">${arr}${g}</div>`;
    },
  }));

  /* ================= 9. Meet in the middle ================= */
  const MM_CODE = [
    "def best_sum_at_most(nums, W):",
    "    L, R = nums[:n // 2], nums[n // 2:]",
    "    A = sorted(subset_sums(L))        # 2^(n/2) sums",
    "    B = sorted(subset_sums(R))",
    "    i, j, best = 0, len(B) - 1, 0",
    "    while i < len(A) and j >= 0:",
    "        if A[i] + B[j] <= W:",
    "            best = max(best, A[i] + B[j]); i += 1   # fits: try a bigger A",
    "        else:",
    "            j -= 1                     # too big: B[j] is too big for every later A",
    "    return best",
  ];
  Viz.register("dp-knapsack-mitm", (el) => Viz.player(el, {
    title: "Meet in the middle: when the numbers are huge but n is small",
    tag: "2^(n/2) · TWO POINTERS",
    legend: [["active", "pair being tested"], ["done", "best pair so far"], ["dim", "ruled out"], ["visit", "left-half items"], ["path", "items in the best subset"]],
    codeLang: "python",
    code: MM_CODE,
    inputs: [{ key: "nums", label: "nums (n ≤ 8, any size)", value: "3712,9105,5880,1314,7206,4527", width: 210 }, { key: "W", label: "limit W", value: "15000", width: 80 }],
    random: () => { const a = Viz.randInts(Viz.rand(4, 8), 100, 9999); return { nums: a.join(","), W: String(Math.floor(a.reduce((s, x) => s + x, 0) * (0.3 + Math.random() * 0.4))) }; },
    build: ({ nums: ns, W }) => {
      const a = nums(ns, { min: 2, max: 8, lo: 1, hi: 1e9, what: "Numbers" });
      const Wl = Viz.parse.int(W, { min: 0, max: 1e10 });
      const n = a.length, h = n >> 1, Lh = a.slice(0, h), Rh = a.slice(h), fr = [];
      const sums = (arr, off) => { const out = []; for (let mask = 0; mask < 1 << arr.length; mask++) { let s = 0, lab = ""; arr.forEach((x, k) => { if (mask >> k & 1) { s += x; lab += String.fromCharCode(97 + off + k); } }); out.push({ s, lab: lab || "∅" }); } return out.sort((p, q) => p.s - q.s || p.lab.localeCompare(q.lab)); };
      const A = sums(Lh, 0), B = sums(Rh, h);
      const base = { a, h, A, B };
      fr.push({ ...base, i: null, j: null, note: `A knapsack table would need W + 1 = ${(Wl + 1).toLocaleString()} columns. That is pseudo-polynomial: fine for W = 10⁴, hopeless for 10⁹. With only n = ${n} items, split them into halves (${Lh.length} and ${Rh.length}) instead.`, line: 1, vars: { n, W: Wl } });
      fr.push({ ...base, i: null, j: null, showSums: true, note: `List all subset sums of each half: ${A.length} + ${B.length} sums instead of 2^${n} = ${1 << n} full subsets. Sort both. Any subset of all items = one subset of the left half + one of the right.`, line: [2, 3], vars: { "|A|": A.length, "|B|": B.length } });
      let i = 0, j = B.length - 1, best = 0, bi = 0, bj = 0;
      const dead = { A: new Set(), B: new Set() };
      const snap = (note, line, extra = {}) => fr.push({ ...base, showSums: true, i, j, bi, bj, best, deadA: [...dead.A], deadB: [...dead.B], note, line, vars: { i, j, "A[i]": i < A.length ? A[i].s : "—", "B[j]": j >= 0 ? B[j].s : "—", best }, ...extra });
      snap(`Start with the smallest left sum and the largest right sum.`, 4);
      while (i < A.length && j >= 0) {
        const s = A[i].s + B[j].s;
        if (s <= Wl) {
          if (s > best) { best = s; bi = i; bj = j; }
          snap(`${A[i].s} + ${B[j].s} = ${s} ≤ ${Wl}: it fits${s === best ? ` and is the best so far` : ""}. For this A[i], no smaller B[j] can do better, so move on to a larger A: i += 1.`, [6, 7]);
          dead.A.add(i); i++;
        } else {
          snap(`${A[i].s} + ${B[j].s} = ${s} &gt; ${Wl}: too big. Every later A is at least as large, so B[j] can never fit again: j −= 1.`, [8, 9]);
          dead.B.add(j); j--;
        }
      }
      let brute = 0, bmask = 0;
      for (let mask = 0; mask < 1 << n; mask++) { let s = 0; for (let k = 0; k < n; k++) if (mask >> k & 1) s += a[k]; if (s <= Wl && s > brute) { brute = s; bmask = mask; } }
      const picked = (A[bi].lab + B[bj].lab).replace(/∅/g, "");
      fr.push({ ...base, showSums: true, i: null, j: null, bi, bj, best, deadA: [], deadB: [], final: true, picked, ans: best, note: `Best sum ≤ ${Wl}: <b>${best}</b> = ${A[bi].s} (${A[bi].lab}) + ${B[bj].s} (${B[bj].lab}). Brute force over all ${1 << n} subsets agrees: ${brute}. Cost O(2^(n/2) · n) instead of O(2ⁿ) or O(n · W).`, line: 10, vars: { best } });
      return fr;
    },
    render: (f) => {
      const pk = new Set((f.picked || "").split(""));
      const items = Viz.array(f.a, { label: "items (blue = left half, rest = right half)", idxLabel: (k) => `${String.fromCharCode(97 + k)}`, cls: (k) => (pk.has(String.fromCharCode(97 + k)) ? "path" : k < f.h ? "visit" : "") });
      if (!f.showSums) return `<div class="dks-col">${items}</div>`;
      const dA = new Set(f.deadA || []), dB = new Set(f.deadB || []);
      const A = Viz.array(f.A.map((p) => p.s), { label: "A = sorted sums of the left half (label = subset)", ptrs: f.i !== null ? { i: f.i } : {}, idxLabel: (k) => f.A[k].lab, cls: (k) => (k === f.i ? "active" : f.final && k === f.bi ? "done" : dA.has(k) ? "dim" : "") });
      const B = Viz.array(f.B.map((p) => p.s), { label: "B = sorted sums of the right half", ptrs: f.j !== null && f.j >= 0 ? { j: f.j } : {}, idxLabel: (k) => f.B[k].lab, cls: (k) => (k === f.j ? "active" : f.final && k === f.bj ? "done" : dB.has(k) ? "dim" : "") });
      return `<div class="dks-col">${items}${A}${B}</div>`;
    },
  }));
})();
