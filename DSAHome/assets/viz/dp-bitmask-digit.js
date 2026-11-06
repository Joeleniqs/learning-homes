/* Bitmask & Digit DP visualizers. Every name is prefixed "dp-bitmask-digit-". Frames come from running the real algorithms on your input. */
(() => {
  const S = "dp-bitmask-digit", P = (n) => `${S}-${n}`;
  const esc = Viz.esc;
  const hl = (line) => (typeof window !== "undefined" && window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; visualizers with a "problem" select rewrite it in place. */
  const setCode = (el, code) => { if (!el || !el.querySelectorAll) return; el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.display = k < code.length ? "" : "none"; }); };
  const blank = (codes) => Array(Math.max(...codes.map((c) => c.length))).fill("");
  const fm = (v) => (v === Infinity ? "∞" : v === -Infinity ? "−∞" : v === null || v === undefined ? "" : String(v));
  const col = (...p) => `<div class="dbd-col">${p.filter(Boolean).join("")}</div>`;
  const row = (...p) => `<div class="dbd-row">${p.filter(Boolean).join("")}</div>`;
  const chips = (label, list, empty = "none yet") => Viz.labeled(label, `<div class="dbd-chips">${list.length ? list.map((c) => `<span class="dbd-chip ${c.cls || ""}">${c.html}</span>`).join("") : `<span class="dbd-more">${esc(empty)}</span>`}</div>`);
  const answer = (label, value, cls = "done") => Viz.labeled(label, `<div class="v-item ${cls} dbd-ans">${esc(value)}</div>`);
  const onMode = (el, api, defs) => {
    if (!el || !el.querySelector || !api) return api;
    const sel = el.querySelector('select[name="mode"]'), form = el.querySelector("form.viz-inputs");
    if (!sel || !form) return api;
    sel.addEventListener("change", () => {
      const d = defs[sel.value];
      if (d) for (const [k, v] of Object.entries(d)) if (form.elements[k]) form.elements[k].value = v;
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
  function matrix(s, what, { min = 2, max = 5, lo = 0, hi = 99, square = true } = {}) {
    const rows = String(s ?? "").split(";").map((r) => r.trim()).filter(Boolean);
    if (rows.length < min || rows.length > max) throw new Error(`${what}: give between ${min} and ${max} rows separated by ";".`);
    const M = rows.map((r, i) => ints(r, `${what} row ${i}`, { min: 1, max: 10, lo, hi }));
    if (square && M.some((r) => r.length !== M.length)) throw new Error(`${what}: every row needs exactly ${M.length} numbers (a square matrix).`);
    if (!square && M.some((r) => r.length !== M[0].length)) throw new Error(`${what}: every row needs the same number of entries.`);
    return M;
  }
  const bin = (m, n) => m.toString(2).padStart(n, "0");
  const pc = (m) => { let c = 0; for (; m; m &= m - 1) c++; return c; };
  const bitsOf = (m, n) => Array.from({ length: n }, (_, i) => i).filter((i) => m >> i & 1);
  const setTxt = (m, n, name = (i) => i) => `{${bitsOf(m, n).map(name).join(", ")}}`;

  /* ---------- SVG table (rows × cols of boxes), same look as the other DP pages ---------- */
  function tbl(M, o = {}) {
    const R = M.length, C = o.cols || Math.max(1, ...M.map((r) => r.length));
    const cw = o.w || o.size || 40, ch = o.h || o.size || 40, gap = o.gap ?? 5;
    const padL = o.rowLabels ? (o.rowLabelW || 44) : 4, padT = o.colLabels ? 22 : 4;
    const X = (c) => padL + c * (cw + gap), Y = (r) => padT + r * (ch + gap);
    const W = X(C) - gap + 6, H = Y(R) - gap + 6;
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dbd-lab" x="${X(c) + cw / 2}" y="14" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dbd-lab" x="${padL - 8}" y="${Y(r) + ch / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((rw, r) => rw.forEach((v, c) => {
      if (o.skip && o.skip(r, c)) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cw}" height="${ch}" rx="6"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fm(v);
      const sm = String(t).length > (o.smallAt || 4);
      s += `<text class="dbd-v ${sm ? "sm" : ""} ${cl}" x="${x + cw / 2}" y="${y + ch / 2}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
    }));
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dbd-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "table")}">${s}</svg></div>`;
  }

  /* ---------- The subset lattice: one column per popcount, every mask a box ---------- */
  function lattice(n, val, o = {}) {
    const bw = Math.max(52, n * 9 + 22), bh = 38, gx = 46, gy = 7, top = 22;
    const layers = Array.from({ length: n + 1 }, () => []);
    for (let m = 0; m < 1 << n; m++) layers[pc(m)].push(m);
    const tallest = Math.max(...layers.map((l) => l.length));
    const H = top + tallest * (bh + gy) + 4, W = (n + 1) * (bw + gx) - gx + 8;
    const pos = {};
    layers.forEach((l, k) => { const off = ((tallest - l.length) * (bh + gy)) / 2; l.forEach((m, t) => { pos[m] = { x: 4 + k * (bw + gx), y: top + off + t * (bh + gy) }; }); });
    let s = "";
    layers.forEach((l, k) => { s += `<text class="dbd-lab" x="${4 + k * (bw + gx) + bw / 2}" y="13" text-anchor="middle">${esc(o.layerLabel ? o.layerLabel(k) : `${k} bit${k === 1 ? "" : "s"}`)}</text>`; });
    let arrows = "";
    for (const a of o.edges || []) {
      const p = pos[a.from], q = pos[a.to]; if (!p || !q) continue;
      const fwd = q.x > p.x;
      const x1 = fwd ? p.x + bw : p.x, y1 = p.y + bh / 2, x2 = fwd ? q.x : q.x + bw, y2 = q.y + bh / 2;
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L, ex = x2 - ux * 2, ey = y2 - uy * 2;
      arrows += `<path class="dbd-halo" d="M${x1},${y1} L${ex},${ey}"/><path class="dbd-e ${a.cls || ""}" d="M${x1},${y1} L${ex},${ey}"/><polygon class="dbd-ah ${a.cls || ""}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
    }
    for (let m = 0; m < 1 << n; m++) {
      const { x, y } = pos[m], cl = (o.cls ? o.cls(m) : "") || "";
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6"/>`;
      s += `<text class="dbd-bits ${cl}" x="${x + bw / 2}" y="${y + 11}" text-anchor="middle">${bin(m, n)}</text>`;
      const t = o.fmt ? o.fmt(val[m], m) : fm(val[m]);
      s += `<text class="dbd-v ${String(t).length > 5 ? "sm" : ""} ${cl}" x="${x + bw / 2}" y="${y + 27}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dbd-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "subset lattice")}">${arrows}${s}</svg></div>`;
  }

  /* ---------- One row of bit boxes, most significant bit on the left ---------- */
  function bitRow(m, n, o = {}) {
    const cw = 36, gap = 5, padL = o.label ? (o.labelW || 112) : 4, W = padL + n * (cw + gap) + 4, H = 40 + (o.idx ? 14 : 0) + (o.names ? 14 : 0);
    let s = o.label ? `<text class="dbd-lab" x="${padL - 10}" y="20" text-anchor="end" dominant-baseline="central">${esc(o.label)}</text>` : "";
    for (let t = 0; t < n; t++) {
      const b = n - 1 - t, x = padL + t * (cw + gap), on = m >> b & 1, cl = (o.cls ? o.cls(b, on) : on ? "done" : "") || "";
      s += `<rect class="box ${cl}" x="${x}" y="2" width="${cw}" height="36" rx="6"/><text class="dbd-v ${cl}" x="${x + cw / 2}" y="20" text-anchor="middle" dominant-baseline="central">${on}</text>`;
      if (o.idx) s += `<text class="dbd-lab" x="${x + cw / 2}" y="51" text-anchor="middle">b${b}</text>`;
      if (o.names) s += `<text class="dbd-lab" x="${x + cw / 2}" y="${o.idx ? 65 : 51}" text-anchor="middle">${esc(o.names(b))}</text>`;
    }
    return `<svg class="dg dbd-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "bits")}">${s}</svg>`;
  }

  /* =====================================================================
     1. A subset is a number: subset sums by peeling off the lowest bit
     ===================================================================== */
  Viz.register(P("mask"), (el, opts) => Viz.player(el, {
    title: "A subset is a number: every mask reuses a smaller mask",
    tag: "BITMASK · BASICS",
    legend: [["active", "mask being filled / its lowest set bit"], ["visit", "mask ^ low: the smaller mask it reuses"], ["done", "chosen item / finished entry"]],
    codeLang: "python",
    code: [
      "def subset_sums(a):",
      "    n = len(a)",
      "    s = [0] * (1 << n)                 # s[mask] = total of the chosen items",
      "    for mask in range(1, 1 << n):      # every subset, smallest number first",
      "        low = mask & -mask             # lowest set bit, as a number",
      "        b = low.bit_length() - 1       # ... and as an item index",
      "        s[mask] = s[mask ^ low] + a[b] # drop item b: a smaller mask, done",
      "    return s",
    ],
    inputs: [{ key: "a", label: "items a[0..n−1] (n ≤ 5)", value: (opts && opts.a) || "5,2,7,4", width: 150 }],
    random: () => ({ a: Viz.randInts(Viz.rand(3, 5), 1, 9).join(",") }),
    build: ({ a }) => {
      const v = ints(a, "items", { min: 2, max: 5, lo: 0, hi: 99 }), n = v.length, N = 1 << n, s = Array(N).fill(null), fr = [];
      s[0] = 0;
      fr.push({ v, n, s: s.slice(), mask: 0, note: `n = ${n} items, so there are 2<sup>${n}</sup> = ${N} subsets, numbered 0 … ${N - 1}. In mask m, <b>bit b is 1 exactly when item b is chosen</b>. Mask 0 = 0b${bin(0, n)} is the empty set, with sum 0.`, line: 2, vars: { n, "2^n": N } });
      for (let m = 1; m < N; m++) {
        const low = m & -m, b = Math.log2(low);
        s[m] = s[m ^ low] + v[b];
        fr.push({ v, n, s: s.slice(), mask: m, low: b, prev: m ^ low, note: `mask ${m} = 0b${bin(m, n)} = items ${setTxt(m, n)}. Its lowest set bit is b${b} (low = ${low}). Remove it: ${m} ^ ${low} = ${m ^ low} = 0b${bin(m ^ low, n)}, a <b>smaller number</b>, so s[${m ^ low}] = ${s[m ^ low]} is already known. s[${m}] = ${s[m ^ low]} + a[${b}] = <b>${s[m]}</b>.`, line: [4, 5, 6], vars: { mask: m, binary: bin(m, n), low, b, "mask ^ low": m ^ low, "s[mask]": s[m] } });
      }
      fr.push({ v, n, s: s.slice(), end: true, note: `All ${N} subset sums in O(2<sup>n</sup>): each entry is one addition, because <b>removing any bit gives a smaller number</b>. That single fact is why "for mask in range(1 &lt;&lt; n)" is a valid fill order for almost every bitmask DP.`, line: 7, vars: { sums: N } });
      return fr;
    },
    render: (f) => {
      const { v, n } = f;
      const bits = f.end ? "" : bitRow(f.mask, n, { label: `mask = ${f.mask}`, idx: true, names: (b) => `a${b}=${v[b]}`, cls: (b, on) => (b === f.low ? "active" : on ? "done" : "") });
      const items = Viz.array(v, { label: "items (chosen = in the mask)", cls: (i) => (f.end ? "" : i === f.low ? "active" : f.mask >> i & 1 ? "done" : "dim") });
      const sums = lattice(n, f.s, { label: "s[mask], masks grouped by how many items they hold", edges: f.prev !== undefined && !f.end ? [{ from: f.prev, to: f.mask, cls: "active" }] : [], cls: (m) => (f.s[m] === null ? "dim" : m === f.mask && !f.end ? "active" : m === f.prev ? "visit" : "done") });
      return col(row(bits, items), sums);
    },
  }));

  /* =====================================================================
     2. Enumerate the submasks of a mask: sub = (sub - 1) & mask
     ===================================================================== */
  Viz.register(P("submask"), (el, opts) => Viz.player(el, {
    title: "Every submask, largest first: sub = (sub − 1) & mask",
    tag: "BITMASK · SUBMASKS",
    legend: [["accent", "bits of mask (the only places sub may use)"], ["active", "bits flipped by sub − 1"], ["done", "a 1 bit"], ["visit", "visited submasks"]],
    codeLang: "python",
    code: [
      "def submasks(mask):",
      "    sub = mask",
      "    while True:",
      "        visit(sub)                     # every submask, largest first",
      "        if sub == 0: break             # the empty set is the last one",
      "        sub = (sub - 1) & mask         # next smaller submask",
    ],
    inputs: [{ key: "mask", label: "mask in binary (≤ 7 bits)", value: (opts && opts.mask) || "101101", width: 130 }],
    random: () => { const n = Viz.rand(4, 7); let m = 0; while (pc(m) < 2 || pc(m) > 4) m = Viz.rand(1, (1 << n) - 1); return { mask: bin(m, n) }; },
    build: ({ mask }) => {
      const t = String(mask ?? "").trim().replace(/^0b/, "");
      if (!/^[01]{1,7}$/.test(t)) throw new Error("Type the mask in binary using 0 and 1, at most 7 bits (for example 101101).");
      const M = parseInt(t, 2), n = Math.max(t.length, 1);
      if (M === 0) throw new Error("Pick a mask with at least one 1 bit.");
      const fr = [], seen = [];
      let sub = M;
      while (true) {
        seen.push(sub);
        fr.push({ M, n, sub, seen: seen.slice(), note: `Visit sub = 0b${bin(sub, n)} = ${sub}${sub === M ? ", the mask itself (the largest submask)" : ""}. It only uses bits that are 1 in the mask.`, line: 3, vars: { mask: bin(M, n), sub: bin(sub, n), visited: seen.length } });
        if (sub === 0) break;
        const dec = sub - 1, nxt = dec & M;
        fr.push({ M, n, sub, dec, nxt, seen: seen.slice(), note: `sub − 1 = 0b${bin(dec, n)}: the lowest 1 of sub turned into 0 and <b>every bit below it turned into 1</b> (a borrow). "& mask" then wipes the bits the mask does not own. Result: 0b${bin(nxt, n)} = ${nxt}, the next smaller submask. Nothing in between is skipped, because the bits below the borrow are all set again: it is counting down inside the mask's bits.`, line: 5, vars: { mask: bin(M, n), sub: bin(sub, n), "sub - 1": bin(dec, n), "& mask": bin(nxt, n) } });
        sub = nxt;
      }
      const k = pc(M);
      fr.push({ M, n, end: true, seen, note: `Done: ${seen.length} = 2<sup>${k}</sup> submasks (the mask has ${k} ones), each reached in O(1). Running this loop for <b>every</b> mask of n bits costs Σ 2<sup>popcount</sup> = <b>3<sup>n</sup></b>: each bit is either outside the mask, in the mask but not in sub, or in both. For n = 12 that is 531,441 steps, not 4<sup>12</sup> ≈ 16.8 million.`, line: 4, vars: { submasks: seen.length, "2^popcount": 1 << k } });
      return fr;
    },
    render: (f) => {
      const { M, n } = f;
      const own = (b) => M >> b & 1;
      let rows = bitRow(M, n, { label: "mask", idx: true, cls: (b, on) => (on ? "accent" : "dim") });
      if (!f.end) {
        rows += bitRow(f.sub, n, { label: "sub", cls: (b, on) => (on ? "done" : own(b) ? "" : "dim") });
        if (f.dec !== undefined) {
          rows += bitRow(f.dec, n, { label: "sub − 1", cls: (b, on) => ((f.dec ^ f.sub) >> b & 1 ? "active" : on ? "done" : "") });
          rows += bitRow(f.nxt, n, { label: "(sub−1) & mask", cls: (b, on) => (on ? "visit" : own(b) ? "" : "dim") });
        }
      }
      const list = chips(`visited (${f.seen.length})`, f.seen.map((x, i) => ({ html: `${bin(x, n)} = ${esc(setTxt(x, n))}`, cls: i === f.seen.length - 1 && !f.end ? "done" : "" })));
      return row(`<div class="dbd-col dbd-bits-stack">${rows}</div>`, list);
    },
  }));

  /* =====================================================================
     3. TSP / Hamiltonian path: dp[mask][last]
     ===================================================================== */
  const TSP_MODES = ["TSP: tour from city 0 and back", "Hamiltonian path: any start, any end"];
  const TSP_DEF = { [TSP_MODES[0]]: { w: "0,2,9,10; 2,0,6,4; 9,6,0,8; 10,4,8,0" }, [TSP_MODES[1]]: { w: "0,7,3,9; 7,0,2,4; 3,2,0,8; 9,4,8,0" } };
  const TSP_CODE = [
    [
      "def tsp(w):                                # closed tour through every city",
      "    n = len(w); FULL = (1 << n) - 1",
      "    dp = [[INF] * n for _ in range(1 << n)] # dp[mask][j]: visited mask, now at j",
      "    dp[1][0] = 0                           # start at city 0",
      "    for mask in range(1, 1 << n):",
      "        if not mask & 1: continue          # every tour contains city 0",
      "        for j in range(1, n):",
      "            if not mask >> j & 1: continue",
      "            prev = mask ^ (1 << j)         # the set before arriving at j",
      "            for i in range(n):",
      "                if prev >> i & 1:          # came from i, which is in prev",
      "                    dp[mask][j] = min(dp[mask][j], dp[prev][i] + w[i][j])",
      "    return min(dp[FULL][j] + w[j][0] for j in range(1, n))",
    ],
    [
      "def shortest_hamiltonian_path(w):          # visit all, open path",
      "    n = len(w); FULL = (1 << n) - 1",
      "    dp = [[INF] * n for _ in range(1 << n)] # dp[mask][j]: visited mask, now at j",
      "    for j in range(n): dp[1 << j][j] = 0   # start anywhere",
      "    for mask in range(1, 1 << n):",
      "        if mask & (mask - 1) == 0: continue # one city: already set",
      "        for j in range(n):",
      "            if not mask >> j & 1: continue",
      "            prev = mask ^ (1 << j)",
      "            for i in range(n):",
      "                if prev >> i & 1:",
      "                    dp[mask][j] = min(dp[mask][j], dp[prev][i] + w[i][j])",
      "    return min(dp[FULL])                   # end anywhere",
    ],
  ];
  Viz.register(P("tsp"), (el, opts) => {
    let api;
    const start = opts && TSP_MODES.includes(opts.mode) ? opts.mode : TSP_MODES[0];
    api = Viz.player(el, {
      title: "dp[mask][last]: where you have been, and where you are now",
      tag: "BITMASK DP · TSP",
      legend: [["active", "dp[mask][j] being computed / city j"], ["visit", "cities in prev = mask without j / candidate cells"], ["path", "best predecessor / final route"], ["done", "finished"]],
      codeLang: "python",
      code: blank(TSP_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: start, options: TSP_MODES },
        { key: "w", label: "symmetric distance matrix, rows split by ;", value: (opts && opts.w) || TSP_DEF[start].w, width: 300 },
      ],
      random: () => {
        const md = TSP_MODES.indexOf(curMode(el, start)), n = md === 0 ? Viz.rand(4, 5) : 4;
        const W = Array.from({ length: n }, () => Array(n).fill(0));
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) W[i][j] = W[j][i] = Viz.rand(1, 20);
        return { w: W.map((r) => r.join(",")).join("; ") };
      },
      build: ({ mode, w }) => {
        const md = Math.max(0, TSP_MODES.indexOf(mode));
        setCode(el, TSP_CODE[md]);
        const W = matrix(w, "distances", { min: 3, max: md === 0 ? 5 : 4, lo: 0, hi: 99 }), n = W.length, N = 1 << n, FULL = N - 1;
        for (let i = 0; i < n; i++) { if (W[i][i] !== 0) throw new Error(`The diagonal must be 0 (row ${i}).`); for (let j = 0; j < n; j++) if (W[i][j] !== W[j][i]) throw new Error(`Make the matrix symmetric: w[${i}][${j}] = ${W[i][j]} but w[${j}][${i}] = ${W[j][i]}.`); }
        const dp = Array.from({ length: N }, () => Array(n).fill(Infinity)), par = Array.from({ length: N }, () => Array(n).fill(-1));
        const rows = []; for (let m = 1; m < N; m++) if (md === 1 || m & 1) rows.push(m);
        const fr = [];
        const snap = (o) => fr.push({ dp: dp.map((r) => r.slice()), ...o });
        if (md === 0) dp[1][0] = 0; else for (let j = 0; j < n; j++) dp[1 << j][j] = 0;
        snap({ note: md === 0 ? `State dp[mask][j] = the shortest route that starts at city 0, visits <b>exactly</b> the cities in mask, and stands at city j. Only the <b>set</b> matters, not the order it was visited in: that is what shrinks n! orders to 2<sup>n</sup>·n states. Base: dp[0b${bin(1, n)}][0] = 0.` : `Same state, but a path may start anywhere: dp[{j}][j] = 0 for every city j, and the answer is the best dp[FULL][j] over every end j.`, line: 3, vars: { n, states: `${N}×${n}` } });
        for (const m of rows) {
          if (pc(m) < 2) continue;
          for (let j = md === 0 ? 1 : 0; j < n; j++) {
            if (!(m >> j & 1)) continue;
            const prev = m ^ (1 << j), cands = [];
            for (let i = 0; i < n; i++) if (prev >> i & 1 && dp[prev][i] < Infinity) {
              const c = dp[prev][i] + W[i][j]; cands.push({ i, c });
              if (c < dp[m][j]) { dp[m][j] = c; par[m][j] = i; }
            }
            snap({ m, j, prev, cands, best: par[m][j], note: `dp[${bin(m, n)}][${j}]: we are at city ${j}, and before stepping onto it we had visited prev = ${bin(prev, n)} = ${esc(setTxt(prev, n))}. Try every city i in prev as the previous stop: ${cands.map((c) => `dp[${bin(prev, n)}][${c.i}] + w[${c.i}][${j}] = ${dp[prev][c.i]} + ${W[c.i][j]} = ${c.c}`).join("; ") || "no reachable predecessor"}. Best: <b>${fm(dp[m][j])}</b>${par[m][j] >= 0 ? ` (from ${par[m][j]})` : ""}.`, line: [8, 9, 10, 11], vars: { mask: bin(m, n), j, prev: bin(prev, n), "dp[mask][j]": dp[m][j] } });
          }
        }
        let best = Infinity, bj = -1; const fin = [];
        for (let j = 0; j < n; j++) {
          if (md === 0 && j === 0) continue;
          const c = dp[FULL][j] + (md === 0 ? W[j][0] : 0); fin.push({ j, c });
          if (c < best) { best = c; bj = j; }
        }
        const route = []; let m = FULL, j = bj;
        while (j >= 0) { route.push(j); const pj = par[m][j]; m ^= 1 << j; j = pj; }
        route.reverse(); if (md === 0) route.push(0);
        snap({ end: true, fin, bj, route, note: md === 0 ? `Close the tour: answer = min over j of dp[FULL][j] + w[j][0] = ${fin.map((c) => c.c).join(", ")} → <b>${best}</b>. Following the stored predecessors back from (FULL, ${bj}) gives the route ${route.join(" → ")}. Time O(2<sup>n</sup>·n²), memory O(2<sup>n</sup>·n): fine up to n ≈ 16–20.` : `Answer = min over j of dp[FULL][j] = <b>${best}</b>, ending at ${bj}. Route: ${route.join(" → ")}. No return edge, and no fixed start.`, line: 12, vars: { answer: best, route: route.join("→") } });
        return fr.map((f) => ({ ...f, md, W, n, rows }));
      },
      render: (f) => {
        const { W, n, rows, md } = f;
        const pos = Viz.layout.circle(Array.from({ length: n }, (_, i) => String(i)), 78);
        if (n === 4) [[-45, -75], [45, -75], [100, 65], [-100, 65]].forEach(([x, y], i) => { pos[i] = { ...pos[i], x, y }; }); // trapezoid: keeps the two diagonal weight labels apart
        const onRoute = new Set(); if (f.route) for (let t = 0; t + 1 < f.route.length; t++) { onRoute.add(`${f.route[t]}-${f.route[t + 1]}`); onRoute.add(`${f.route[t + 1]}-${f.route[t]}`); }
        const edges = []; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) edges.push({ u: String(i), v: String(j), w: W[i][j] });
        const g = Viz.graph({ nodes: pos.map((p, i) => ({ ...p, label: i })), edges }, {
          r: 17, label: f.end ? "the optimal route" : f.m ? `at ${f.j}, having visited ${setTxt(f.m, n)}` : "cities",
          nodeCls: (id) => { const i = Number(id); if (f.end) return "path"; if (f.m === undefined) return ""; if (i === f.j) return "active"; if (f.prev >> i & 1) return "visit"; return ""; },
          edgeCls: (key) => { if (f.end) return onRoute.has(key) ? "path" : "dim"; if (f.m === undefined) return ""; const [a, b] = key.split("-").map(Number); if (f.best >= 0 && ((a === f.best && b === f.j) || (b === f.best && a === f.j))) return "path"; if ((a === f.j && f.prev >> b & 1) || (b === f.j && f.prev >> a & 1)) return "visit"; return "dim"; },
        });
        const M = rows.map((m) => f.dp[m]);
        const t = tbl(M, {
          label: "dp[mask][last]", w: 40, h: 26, gap: 4, rowLabelW: 14 + n * 8,
          rowLabels: rows.map((m) => bin(m, n)), colLabels: Array.from({ length: n }, (_, j) => `j=${j}`),
          skip: (r, c) => !(rows[r] >> c & 1) || (md === 0 && c === 0 && rows[r] !== 1),
          fmt: (v) => (v === Infinity ? "·" : fm(v)),
          cls: (r, c, v) => {
            const m = rows[r];
            if (f.end) return m === (1 << n) - 1 ? (c === f.bj ? "path" : "done") : "";
            if (m === f.m && c === f.j) return "active";
            if (m === f.prev && f.cands && f.cands.some((x) => x.i === c)) return c === f.best ? "path" : "visit";
            return v === Infinity ? "dim" : "";
          },
        });
        const side = f.end ? chips(md === 0 ? "dp[FULL][j] + w[j][0]" : "dp[FULL][j]", f.fin.map((c) => ({ html: `j=${c.j}: ${fm(c.c)}`, cls: c.j === f.bj ? "done" : "" }))) : f.cands ? chips(`candidates for dp[${bin(f.m, n)}][${f.j}]`, f.cands.map((c) => ({ html: `from ${c.i}: ${fm(f.dp[f.prev][c.i])} + ${W[c.i][f.j]} = ${c.c}`, cls: c.i === f.best ? "done" : "" }))) : "";
        return row(col(g, side), t);
      },
    });
    return onMode(el, api, TSP_DEF);
  });

  /* =====================================================================
     4. Assignment: the person is popcount(mask) / hats: items outside, people in the mask
     ===================================================================== */
  const AS_MODES = ["assignment: person = popcount(mask)", "wear different hats (1434)"];
  const AS_DEF = { [AS_MODES[0]]: { data: "9,2,7,8; 6,4,3,7; 5,8,1,8; 7,6,9,4" }, [AS_MODES[1]]: { data: "3,5,1; 3,5" } };
  const AS_CODE = [
    [
      "def min_cost_assignment(cost):     # cost[p][t]: person p does task t",
      "    n = len(cost)",
      "    dp = [INF] * (1 << n); dp[0] = 0  # dp[mask]: these tasks are taken",
      "    for mask in range(1 << n):",
      "        p = popcount(mask)             # people 0..p-1 already have tasks",
      "        if p == n: continue",
      "        for t in range(n):",
      "            if not mask >> t & 1:      # person p takes a free task t",
      "                nxt = mask | 1 << t",
      "                dp[nxt] = min(dp[nxt], dp[mask] + cost[p][t])",
      "    return dp[(1 << n) - 1]",
    ],
    [
      "def number_ways(hats):             # hats[p]: the hats person p likes",
      "    n = len(hats)                      # n <= 10 people, but 40 hats",
      "    who = defaultdict(list)            # hat -> people who like it",
      "    for p, hs in enumerate(hats):",
      "        for h in hs: who[h].append(p)",
      "    dp = [0] * (1 << n); dp[0] = 1     # dp[mask]: people in mask have hats",
      "    for h in range(1, 41):             # hats are the items, one at a time",
      "        for mask in reversed(range(1 << n)):  # high to low: hat h used once",
      "            for p in who[h]:",
      "                if not mask >> p & 1:",
      "                    dp[mask | 1 << p] += dp[mask]   # (mod 1e9+7)",
      "    return dp[(1 << n) - 1]",
    ],
  ];
  Viz.register(P("assign"), (el, opts) => {
    let api;
    const start = opts && AS_MODES.includes(opts.mode) ? opts.mode : AS_MODES[0];
    api = Viz.player(el, {
      title: "Assignment DP: the mask says what is used, its size says who is next",
      tag: "BITMASK DP · ASSIGNMENT",
      legend: [["active", "mask being expanded"], ["visit", "masks it pushes into"], ["path", "the optimal chain"], ["done", "reached / updated"]],
      codeLang: "python",
      code: blank(AS_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: start, options: AS_MODES },
        { key: "data", label: "cost matrix / liked hats per person (rows split by ;)", value: (opts && opts.data) || AS_DEF[start].data, width: 300 },
      ],
      random: () => {
        const md = AS_MODES.indexOf(curMode(el, start));
        if (md === 0) { const n = Viz.rand(3, 4); return { data: Array.from({ length: n }, () => Viz.randInts(n, 1, 9).join(",")).join("; ") }; }
        const n = Viz.rand(2, 4); return { data: Array.from({ length: n }, () => [...new Set(Viz.randInts(Viz.rand(1, 3), 1, 6))].join(",")).join("; ") };
      },
      build: ({ mode, data }) => {
        const md = Math.max(0, AS_MODES.indexOf(mode));
        setCode(el, AS_CODE[md]);
        const fr = [];
        if (md === 0) {
          const C = matrix(data, "cost", { min: 2, max: 4, lo: 0, hi: 99 }), n = C.length, N = 1 << n;
          const dp = Array(N).fill(Infinity), par = Array(N).fill(-1); dp[0] = 0;
          const snap = (o) => fr.push({ dp: dp.slice(), ...o });
          snap({ note: `${n} people, ${n} tasks. dp[mask] = cheapest way to hand out exactly the tasks in mask. The trick: <b>who gets the next task is not stored</b>, because it is always person popcount(mask). Masks are drawn in columns by popcount: column p holds every way persons 0..p−1 could have been served.`, line: 2, vars: { n, states: N } });
          for (let m = 0; m < N; m++) {
            const p = pc(m); if (p === n) continue;
            const push = [];
            for (let t = 0; t < n; t++) if (!(m >> t & 1)) {
              const nx = m | 1 << t, c = dp[m] + C[p][t], better = c < dp[nx];
              if (better) { dp[nx] = c; par[nx] = m; }
              push.push({ t, nx, c, better });
            }
            snap({ m, p, push, note: `mask ${bin(m, n)} (tasks ${esc(setTxt(m, n))} taken, cost ${dp[m]}). popcount = ${p}, so it is <b>person ${p}</b>'s turn. Push to every free task: ${push.map((x) => `task ${x.t} → dp[${bin(x.nx, n)}] ${x.better ? "=" : "stays ≤"} ${x.better ? x.c : dp[x.nx]}${x.better ? "" : ` (not ${x.c})`}`).join("; ")}.`, line: [4, 7, 8, 9], vars: { mask: bin(m, n), person: p, "dp[mask]": dp[m] } });
          }
          const chain = []; for (let m = N - 1; m >= 0 && m !== -1; m = par[m]) { chain.push(m); if (m === 0) break; }
          const pick = []; for (let t = chain.length - 1; t > 0; t--) { const a = chain[t], b = chain[t - 1]; pick.push([pc(a), Math.log2(a ^ b)]); }
          snap({ end: true, chain, pick, note: `Answer dp[${bin(N - 1, n)}] = <b>${dp[N - 1]}</b>: ${pick.map(([p, t]) => `person ${p} → task ${t} (${C[p][t]})`).join(", ")}. ${N} states × ${n} pushes = O(2<sup>n</sup>·n), against n! = ${[1, 1, 2, 6, 24][n] || "…"} orders for brute force; the gap explodes as n grows (20! ≈ 2.4·10<sup>18</sup>, 2<sup>20</sup>·20 ≈ 2·10<sup>7</sup>).`, line: 10, vars: { answer: dp[N - 1] } });
          return fr.map((f) => ({ ...f, md, C, n }));
        }
        const H = String(data ?? "").split(";").map((r) => r.trim()).filter(Boolean);
        if (H.length < 1 || H.length > 4) throw new Error("hats: give 1 to 4 people, separated by \";\".");
        const hats = H.map((r, p) => [...new Set(ints(r, `person ${p}'s hats`, { min: 1, max: 6, lo: 1, hi: 40 }))]);
        const n = hats.length, N = 1 << n, who = {};
        hats.forEach((hs, p) => hs.forEach((h) => (who[h] ||= []).push(p)));
        const hs = Object.keys(who).map(Number).sort((a, b) => a - b);
        const dp = Array(N).fill(0); dp[0] = 1;
        fr.push({ dp: dp.slice(), hats, note: `${n} people but up to 40 hats. A mask over <b>hats</b> would need 2<sup>40</sup> states, so flip the roles: hats become the items we loop over, and the mask holds <b>people</b> (2<sup>${n}</sup> states). dp[mask] = number of ways the people in mask have each received a different hat so far.`, line: 5, vars: { people: n, hats: hs.length } });
        for (const h of hs) {
          const before = dp.slice(), adds = [];
          for (let m = N - 1; m >= 0; m--) for (const p of who[h]) if (!(m >> p & 1) && dp[m]) { dp[m | 1 << p] += dp[m]; adds.push({ from: m, to: m | 1 << p, p, w: dp[m] }); }
          fr.push({ dp: dp.slice(), before, adds, h, hats, note: `Hat ${h} is liked by person ${who[h].join(", ")}. For each mask (high to low, so hat ${h} is given at most once), give hat ${h} to someone in that list who has no hat yet: ${adds.length ? adds.map((a) => `dp[${bin(a.to, n)}] += dp[${bin(a.from, n)}] (${a.w})`).join("; ") : "no mask can use it yet"}. Skipping the hat is the default: the old values stay.`, line: [7, 8, 9, 10], vars: { hat: h, people: who[h].join(","), updates: adds.length } });
        }
        fr.push({ dp: dp.slice(), hats, end: true, note: `Answer dp[${bin(N - 1, n)}] = <b>${dp[N - 1]}</b> ways (LeetCode reports it mod 10<sup>9</sup>+7). Time O(40 · 2<sup>n</sup> · n). Rule of thumb: <b>put the small dimension in the mask</b>.`, line: 11, vars: { answer: dp[N - 1] } });
        return fr.map((f) => ({ ...f, md, n }));
      },
      render: (f) => {
        const { n, md } = f;
        if (md === 0) {
          const { C } = f;
          const onChain = new Set(f.chain || []);
          const lat = lattice(n, f.dp, {
            label: "dp[mask] (column p = persons 0..p−1 served)", layerLabel: (k) => (k < n ? `person ${k} next` : "all done"),
            edges: f.push ? f.push.map((x) => ({ from: f.m, to: x.nx, cls: x.better ? "visit" : "" })) : f.chain ? f.chain.slice(0, -1).map((m, t) => ({ from: f.chain[t + 1], to: m, cls: "path" })) : [],
            cls: (m) => (f.end ? (onChain.has(m) ? "path" : "") : m === f.m ? "active" : f.push && f.push.some((x) => x.nx === m) ? "visit" : f.dp[m] === Infinity ? "dim" : "done"),
          });
          const pick = new Set((f.pick || []).map(([p, t]) => `${p},${t}`));
          const grid = Viz.grid(C, { label: "cost[person][task]", rowLabels: C.map((_, p) => `p${p}`), colLabels: C.map((_, t) => `t${t}`), cls: (r, c) => (f.end ? (pick.has(`${r},${c}`) ? "path" : "") : f.m === undefined ? "" : r === f.p ? (f.m >> c & 1 ? "dim" : "visit") : r < f.p ? "dim" : "") });
          return row(grid, lat);
        }
        const lat = lattice(n, f.dp, {
          label: "dp[mask]: mask = people who already wear a hat", layerLabel: (k) => `${k} with hats`,
          edges: (f.adds || []).map((a) => ({ from: a.from, to: a.to, cls: "visit" })),
          cls: (m) => (f.end ? (m === (1 << n) - 1 ? "done" : "") : f.adds && f.adds.some((a) => a.to === m) ? "done" : f.adds && f.adds.some((a) => a.from === m) ? "visit" : f.dp[m] ? "" : "dim"),
        });
        const likes = Viz.grid(f.hats.map((hs) => [hs.join(", ")]), { label: "who likes what", rowLabels: f.hats.map((_, p) => `person ${p}`), cls: (r) => (f.h !== undefined && f.hats[r].includes(f.h) ? "active" : "") });
        return row(col(likes, f.h !== undefined ? answer("current hat", f.h, "active") : ""), lat);
      },
    });
    return onMode(el, api, AS_DEF);
  });

  /* =====================================================================
     5. Partition into k equal-sum subsets: dp[mask] = fill of the open bucket
     ===================================================================== */
  Viz.register(P("partition"), (el, opts) => Viz.player(el, {
    title: "k equal subsets: fill buckets one at a time, the mask remembers who is used",
    tag: "BITMASK DP · PARTITION",
    legend: [["active", "current mask / the open bucket"], ["visit", "items that still fit"], ["bad", "items too big for the open bucket"], ["done", "used items / full buckets / reachable masks"]],
    codeLang: "python",
    code: [
      "def can_partition_k_subsets(nums, k):",
      "    total = sum(nums)",
      "    if total % k: return False",
      "    target, n = total // k, len(nums)",
      "    dp = [-1] * (1 << n)            # dp[mask] = fill of the open bucket",
      "    dp[0] = 0                       # -1 = this mask can't be reached",
      "    for mask in range(1 << n):",
      "        if dp[mask] < 0: continue",
      "        for i in range(n):",
      "            if not mask >> i & 1 and dp[mask] + nums[i] <= target:",
      "                dp[mask | 1 << i] = (dp[mask] + nums[i]) % target",
      "    return dp[(1 << n) - 1] == 0",
    ],
    inputs: [{ key: "nums", label: "nums (≤ 7)", value: (opts && opts.nums) || "4,3,2,3,5,2,1", width: 150 }, { key: "k", label: "k", value: (opts && opts.k) || "4", width: 50 }],
    random: () => { const k = Viz.rand(2, 3), t = Viz.rand(4, 8), a = []; for (let b = 0; b < k; b++) { let r = t; while (r > 0 && a.length < 7) { const x = Math.min(r, Viz.rand(1, Math.max(1, t - 2))); a.push(x); r -= x; } if (r > 0) a.push(r); } return { nums: a.slice(0, 7).sort(() => Math.random() - 0.5).join(","), k: String(k) }; },
    build: ({ nums, k }) => {
      const a = ints(nums, "nums", { min: 2, max: 7, lo: 1, hi: 50 }), K = Number(k), n = a.length, N = 1 << n;
      if (!Number.isInteger(K) || K < 1 || K > n) throw new Error(`k must be a whole number between 1 and ${n}.`);
      const total = a.reduce((x, y) => x + y, 0), fr = [];
      if (total % K) { fr.push({ a, n, K, target: 0, dp: Array(N).fill(-1), bad: true, note: `The total ${total} is not divisible by k = ${K}, so the answer is <b>false</b> before any DP. Try another input.`, line: 2, vars: { total, k: K } }); return fr; }
      const T = total / K, dp = Array(N).fill(-1), par = Array(N).fill(-1); dp[0] = 0;
      fr.push({ a, n, K, T, dp: dp.slice(), par: par.slice(), note: `total = ${total}, so each of the ${K} buckets must sum to target = ${T}. Fill buckets <b>one at a time</b>: once a mask's items are fixed, the full buckets are full, and the only open question is how much is in the open bucket: (sum of mask) mod target. So one number per mask is enough.`, line: [3, 4, 5], vars: { total, target: T, masks: N } });
      for (let m = 0; m < N; m++) {
        if (dp[m] < 0) continue;
        const fits = [], big = [];
        for (let i = 0; i < n; i++) if (!(m >> i & 1)) { if (dp[m] + a[i] <= T) { const nx = m | 1 << i; if (dp[nx] < 0) par[nx] = m; dp[nx] = (dp[m] + a[i]) % T; fits.push(i); } else big.push(i); }
        fr.push({ a, n, K, T, m, fits, big, dp: dp.slice(), par: par.slice(), note: `mask ${bin(m, n)}: used ${esc(setTxt(m, n, (i) => a[i]))}, open bucket holds ${dp[m]} of ${T}. ${fits.length ? `Items that fit: ${fits.map((i) => a[i]).join(", ")} → mark those masks reachable.` : "Nothing fits."}${big.length ? ` Too big for the space left (${T - dp[m]}): ${big.map((i) => a[i]).join(", ")}.` : ""}`, line: [7, 8, 9, 10], vars: { mask: bin(m, n), open: dp[m], space: T - dp[m], reachable: dp.filter((x) => x >= 0).length } });
      }
      const ok = dp[N - 1] === 0;
      fr.push({ a, n, K, T, m: ok ? N - 1 : undefined, end: true, dp: dp.slice(), par: par.slice(), note: ok ? `dp[${bin(N - 1, n)}] = 0: every item used and the last bucket closed exactly, so the answer is <b>true</b>. Only ${dp.filter((x) => x >= 0).length} of ${N} masks were ever reachable: the bucket limit prunes for free. O(2<sup>n</sup>·n) time, and no backtracking order issues.` : `The full mask is ${dp[N - 1] < 0 ? "unreachable" : `left with ${dp[N - 1]} in the open bucket`}, so the answer is <b>false</b>.`, line: 11, vars: { answer: ok ? "True" : "False" } });
      return fr;
    },
    render: (f) => {
      const { a, n, K, T } = f;
      if (f.bad) return Viz.array(a, { label: "nums" });
      const m = f.m;
      const items = Viz.array(a, { label: "nums", cls: (i) => (m === undefined ? "" : m >> i & 1 ? "done" : f.fits && f.fits.includes(i) ? "visit" : f.big && f.big.includes(i) ? "bad" : "") });
      let bars = "";
      if (m !== undefined) {
        const seq = []; for (let x = m; x > 0; x = f.par[x]) seq.push(Math.log2(x ^ f.par[x]));
        seq.reverse();
        const groups = Array.from({ length: K }, () => []); let b = 0, s = 0;
        for (const i of seq) { groups[b].push(i); s += a[i]; if (s === T) { b++; s = 0; } }
        const bw = 54, gap = 18, H = 150, sc = (H - 30) / T, Wd = K * (bw + gap) + 10;
        let svg = "";
        groups.forEach((g, t) => {
          const x = 6 + t * (bw + gap), full = g.reduce((u, i) => u + a[i], 0) === T, open = t === b && !full;
          svg += `<rect class="box ${full ? "done" : open ? "active" : ""}" x="${x}" y="${H - 18 - T * sc}" width="${bw}" height="${T * sc}" rx="5" fill-opacity="0.25"/>`;
          let y = H - 18;
          g.forEach((i) => { const h = a[i] * sc; svg += `<rect class="box ${full ? "done" : "active"}" x="${x + 4}" y="${y - h + 1}" width="${bw - 8}" height="${h - 2}" rx="4"/><text class="dbd-v sm" x="${x + bw / 2}" y="${y - h / 2}" text-anchor="middle" dominant-baseline="central">${a[i]}</text>`; y -= h; });
          svg += `<text class="dbd-lab" x="${x + bw / 2}" y="${H - 4}" text-anchor="middle">bucket ${t + 1}</text>`;
        });
        bars = Viz.labeled(`buckets (each must reach ${T})`, `<svg class="dg dbd-g" viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="buckets">${svg}</svg>`);
      }
      const N = 1 << n, per = 16, cs = 15, rowsN = Math.ceil(N / per), Wm = per * (cs + 3) + 4, Hm = rowsN * (cs + 3) + 4;
      let dots = "";
      for (let x = 0; x < N; x++) {
        const cl = x === m ? "active" : f.fits && f.fits.some((i) => (m | 1 << i) === x) ? "visit" : f.dp[x] >= 0 ? "done" : "dim";
        dots += `<rect class="box ${cl}" x="${2 + (x % per) * (cs + 3)}" y="${2 + Math.floor(x / per) * (cs + 3)}" width="${cs}" height="${cs}" rx="3"/>`;
      }
      const map = Viz.labeled(`all ${N} masks, in order (reachable: ${f.dp.filter((x) => x >= 0).length})`, `<svg class="dg dbd-g" viewBox="0 0 ${Wm} ${Hm}" width="${Wm}" height="${Hm}" role="img" aria-label="mask map">${dots}</svg>`);
      return col(row(items, bars), map);
    },
  }));

  /* =====================================================================
     6. SOS DP: sum over subsets, one bit at a time
     ===================================================================== */
  Viz.register(P("sos"), (el, opts) => Viz.player(el, {
    title: "SOS DP: let one bit vary at a time, and every subset gets counted once",
    tag: "BITMASK · SUM OVER SUBSETS",
    legend: [["active", "F[mask] absorbing its twin"], ["visit", "the twin mask ^ (1 << b)"], ["done", "already updated in this pass"]],
    codeLang: "python",
    code: [
      "def sum_over_subsets(A, n):        # F[mask] = sum of A[sub], sub ⊆ mask",
      "    F = A[:]",
      "    for b in range(n):                 # let bit b vary, one bit at a time",
      "        for mask in range(1 << n):",
      "            if mask >> b & 1:          # mask has b: absorb its twin without b",
      "                F[mask] += F[mask ^ (1 << b)]",
      "    return F",
    ],
    inputs: [{ key: "a", label: "A[0..2ⁿ−1] (4, 8 or 16 values)", value: (opts && opts.a) || "3,1,4,1,5,9,2,6", width: 220 }],
    random: () => ({ a: Viz.randInts(Viz.rand(0, 1) ? 8 : 16, 0, 9).join(",") }),
    build: ({ a }) => {
      const A = ints(a, "A", { min: 4, max: 16, lo: -99, hi: 99 });
      const n = Math.log2(A.length);
      if (![2, 3, 4].includes(n)) throw new Error(`A needs 4, 8 or 16 values (one per mask); you gave ${A.length}.`);
      const N = 1 << n, F = A.slice(), who = Array.from({ length: N }, (_, m) => [m]), fr = [];
      fr.push({ F: F.slice(), who: who.map((w) => w.slice()), note: `F starts as a copy of A, so F[mask] holds just A[mask]. Goal: F[mask] = the sum of A over <b>every</b> submask. The naive way enumerates submasks of each mask: 3<sup>n</sup>. SOS does it in n · 2<sup>n</sup> by adding one bit of freedom per pass.`, line: 1, vars: { n, masks: N } });
      for (let b = 0; b < n; b++) {
        const upd = [];
        fr.push({ F: F.slice(), who: who.map((w) => w.slice()), b, upd: upd.slice(), note: `Pass b = ${b}. After this pass, F[mask] will include every submask that differs from mask <b>only in bits 0..${b}</b>. Each mask with bit ${b} set absorbs its twin (the same mask with bit ${b} cleared).`, line: 2, vars: { b } });
        for (let m = 0; m < N; m++) if (m >> b & 1) {
          const t = m ^ (1 << b), old = F[m];
          F[m] += F[t]; who[m] = [...who[m], ...who[t]].sort((x, y) => y - x); upd.push(m);
          fr.push({ F: F.slice(), who: who.map((w) => w.slice()), b, m, t, upd: upd.slice(), note: `F[${bin(m, n)}] += F[${bin(t, n)}]: ${old} + ${F[t]} = <b>${F[m]}</b>. The twin already carries ${who[t].length} submask${who[t].length === 1 ? "" : "s"} (with bit ${b} = 0), so mask now covers ${who[m].length} = 2<sup>${pc(m & ((1 << (b + 1)) - 1))}</sup> of them, none twice: the two groups differ in bit ${b}.`, line: [4, 5], vars: { b, mask: bin(m, n), twin: bin(t, n), "F[mask]": F[m] } });
        }
      }
      fr.push({ F: F.slice(), who: who.map((w) => w.slice()), end: true, note: `Done: F[${bin(N - 1, n)}] = ${F[N - 1]} is the sum of all of A, and F[mask] covers exactly 2<sup>popcount(mask)</sup> submasks. n passes × 2<sup>n</sup> masks = O(n·2<sup>n</sup>). Swap the condition to "if not mask >> b & 1: F[mask] += F[mask | 1 &lt;&lt; b]" for <b>sum over supersets</b>.`, line: 6, vars: { "F[full]": F[N - 1] } });
      return fr.map((f) => ({ ...f, n, A }));
    },
    render: (f) => {
      const { n } = f;
      const lat = lattice(n, f.F, {
        label: "F[mask]", edges: f.m !== undefined ? [{ from: f.t, to: f.m, cls: "visit" }] : [],
        cls: (m) => (f.end ? "done" : m === f.m ? "active" : m === f.t ? "visit" : f.upd && f.upd.includes(m) ? "done" : ""),
      });
      const bitsV = f.b !== undefined ? bitRow((1 << f.b), n, { label: "free bit b", idx: true, cls: (b) => (b === f.b ? "active" : b < f.b ? "done" : "") }) : "";
      const focus = f.m !== undefined ? f.m : (1 << n) - 1;
      const list = chips(`F[${bin(focus, n)}] = sum of A over`, f.who[focus].map((x) => ({ html: `A[${bin(x, n)}] = ${f.A[x]}`, cls: f.t !== undefined && f.who[f.t].includes(x) ? "done" : "" })));
      return row(col(bitsV, Viz.array(f.A, { label: "A (input)", idxLabel: (i) => bin(i, n) }), list), lat);
    },
  }));

  /* =====================================================================
     7. Broken-profile DP: domino tilings, cell by cell
     ===================================================================== */
  Viz.register(P("profile"), (el, opts) => Viz.player(el, {
    title: "Broken profile: tile a grid with dominoes, one cell at a time",
    tag: "BITMASK DP · PROFILE",
    legend: [["active", "current cell"], ["done", "cells already decided"], ["visit", "frontier cell already covered (bit 1)"], ["window", "frontier cell still empty (bit 0)"]],
    codeLang: "python",
    code: [
      "def domino_tilings(R, C):",
      "    ways = {0: 1}                     # profile mask -> number of ways",
      "    for c in range(C):",
      "        for r in range(R):              # cell (r, c), column by column",
      "            nxt = defaultdict(int)",
      "            for mask, w in ways.items():",
      "                if mask >> r & 1:       # covered from the left already",
      "                    nxt[mask & ~(1 << r)] += w",
      "                    continue",
      "                if c + 1 < C:           # horizontal: stick into column c+1",
      "                    nxt[mask | 1 << r] += w",
      "                if r + 1 < R and not mask >> (r + 1) & 1:",
      "                    nxt[mask | 1 << (r + 1)] += w   # vertical: (r+1, c) too",
      "            ways = nxt",
      "    return ways.get(0, 0)",
    ],
    inputs: [{ key: "R", label: "rows (≤ 4)", value: (opts && opts.R) || "3", width: 60 }, { key: "C", label: "columns (≤ 8)", value: (opts && opts.C) || "4", width: 60 }],
    random: () => ({ R: String(Viz.rand(2, 4)), C: String(Viz.rand(2, 6)) }),
    build: ({ R, C }) => {
      const r0 = Number(R), c0 = Number(C);
      if (!Number.isInteger(r0) || r0 < 1 || r0 > 4) throw new Error("rows must be 1 … 4 (the profile has one bit per row).");
      if (!Number.isInteger(c0) || c0 < 1 || c0 > 8) throw new Error("columns must be 1 … 8.");
      let ways = new Map([[0, 1]]);
      const fr = [];
      fr.push({ cell: -1, before: [], after: [[0, 1]], note: `Walk the cells column by column, top to bottom. The <b>profile</b> is one bit per row: bit r says whether the next undecided cell in row r is <b>already covered</b> by a domino that sticks out from the left. Everything else about the past is irrelevant, so ${1 << r0} possible profiles, not ${r0 * c0} cells of history.`, line: 1, vars: { R: r0, C: c0 } });
      for (let c = 0; c < c0; c++) for (let r = 0; r < r0; r++) {
        const nxt = new Map(), add = (k, w) => nxt.set(k, (nxt.get(k) || 0) + w); let sk = 0, ho = 0, ve = 0;
        for (const [m, w] of ways) {
          if (m >> r & 1) { add(m & ~(1 << r), w); sk += w; continue; }
          if (c + 1 < c0) { add(m | 1 << r, w); ho += w; }
          if (r + 1 < r0 && !(m >> (r + 1) & 1)) { add(m | 1 << (r + 1), w); ve += w; }
        }
        const before = [...ways.entries()].sort((a, b) => a[0] - b[0]);
        ways = nxt;
        fr.push({ cell: c * r0 + r, r, c, before, after: [...ways.entries()].sort((a, b) => a[0] - b[0]), note: `Cell (${r}, ${c}). For each profile: if bit ${r} is 1 the cell is already covered, so just clear the bit (${sk} way${sk === 1 ? "" : "s"}). Otherwise cover it: a <b>horizontal</b> domino sets bit ${r} for column ${c + 1}${c + 1 < c0 ? ` (${ho})` : " (impossible: last column)"}; a <b>vertical</b> domino also covers (${r + 1}, ${c}), so it sets bit ${r + 1}${r + 1 < r0 ? ` (${ve})` : " (impossible: last row)"}. ${ways.size} distinct profiles survive.`, line: [6, 7, 9, 10, 11, 12], vars: { cell: `(${r},${c})`, profiles: ways.size, "ways to profile 0": ways.get(0) || 0 } });
      }
      const ans = ways.get(0) || 0;
      fr.push({ cell: r0 * c0, before: [], after: [...ways.entries()], end: true, note: `After the last cell only profile 0 (nothing sticking out of the board) is a real tiling: <b>${ans}</b> way${ans === 1 ? "" : "s"}. Cost O(R·C·2<sup>R</sup>): put the <b>short</b> side in the mask.${(r0 * c0) % 2 ? " (An odd number of cells can never be tiled, so 0 is right.)" : ""}`, line: 14, vars: { answer: ans } });
      return fr.map((f) => ({ ...f, R: r0, C: c0 }));
    },
    render: (f) => {
      const { R, C } = f, cs = 34, gap = 4, Wd = C * (cs + gap) + 6, Hd = R * (cs + gap) + 6;
      const first = f.before.length ? f.before[0][0] : null;
      let s = "";
      for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) {
        const idx = c * R + r; let cl = idx < f.cell ? "done" : idx === f.cell ? "active" : "";
        if (first !== null && idx !== f.cell) {
          const fc = r < f.r ? f.c + 1 : f.c;
          if (c === fc && idx > f.cell) cl = first >> r & 1 ? "visit" : "window";
          if (c === f.c && r === f.r) cl = "active";
        }
        if (first !== null && r === f.r && c === f.c && first >> r & 1) cl = "active";
        s += `<rect class="box ${cl}" x="${3 + c * (cs + gap)}" y="${3 + r * (cs + gap)}" width="${cs}" height="${cs}" rx="5"/>`;
      }
      const board = Viz.labeled(first !== null ? `board (frontier drawn for profile ${bin(first, R)})` : "board", `<svg class="dg dbd-g" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" role="img" aria-label="board">${s}</svg>`);
      const prof = (list, label) => {
        if (!list.length) return "";
        const w = 26, h = 16, g = 12, Wp = list.length * (w + g) + 4, Hp = R * (h + 2) + 22;
        let t = "";
        list.forEach(([m, cnt], k) => {
          const x = 2 + k * (w + g);
          for (let r = 0; r < R; r++) t += `<rect class="box ${m >> r & 1 ? "visit" : ""}" x="${x}" y="${2 + r * (h + 2)}" width="${w}" height="${h}" rx="3"/>`;
          t += `<text class="dbd-lab" x="${x + w / 2}" y="${R * (h + 2) + 14}" text-anchor="middle">×${cnt}</text>`;
        });
        return Viz.labeled(label, `<svg class="dg dbd-g" viewBox="0 0 ${Wp} ${Hp}" width="${Wp}" height="${Hp}" role="img" aria-label="${esc(label)}">${t}</svg>`);
      };
      return row(board, col(prof(f.before, "profiles before this cell (filled = bit 1, row 0 on top)"), prof(f.after, f.end ? "final profiles" : "profiles after")));
    },
  }));

  /* =====================================================================
     8. Digit DP, top-down: the tight chain and its free branches
     ===================================================================== */
  const WALK_MODES = ["count special integers (2376)", "digits from a set (902)"];
  const WALK_DEF = { [WALK_MODES[0]]: { n: "2731" }, [WALK_MODES[1]]: { n: "348; 1,3,5,7" } };
  const WALK_CODE = [
    [
      "def count_special(n):                 # 1..n with all digits distinct",
      "    s = str(n)",
      "    @cache",
      "    def f(pos, mask, tight, started):",
      "        if pos == len(s): return int(started)",
      "        hi = int(s[pos]) if tight else 9   # tight: can't pass n's digit",
      "        total = 0",
      "        for d in range(hi + 1):",
      "            if not started and d == 0:     # still a leading zero",
      "                total += f(pos + 1, mask, tight and d == hi, False)",
      "            elif not mask >> d & 1:        # d unused so far",
      "                total += f(pos + 1, mask | 1 << d, tight and d == hi, True)",
      "        return total",
      "    return f(0, 0, True, False)",
    ],
    [
      "def at_most_n_given_digit_set(digits, n):",
      "    s, D = str(n), sorted(map(int, digits))",
      "    @cache",
      "    def f(pos, tight, started):",
      "        if pos == len(s): return int(started)",
      "        hi = int(s[pos]) if tight else 9",
      "        total = 0",
      "        if not started:                    # leave this place empty",
      "            total += f(pos + 1, False, False)",
      "        for d in D:",
      "            if d > hi: break",
      "            total += f(pos + 1, tight and d == hi, True)",
      "        return total",
      "    return f(0, True, False)",
    ],
  ];
  Viz.register(P("walk"), (el, opts) => {
    let api;
    const start = opts && WALK_MODES.includes(opts.mode) ? opts.mode : WALK_MODES[0];
    api = Viz.player(el, {
      title: "Digit DP: one tight chain down N, every branch off it is free",
      tag: "DIGIT DP · TOP-DOWN",
      legend: [["path", "tight digit (equal to N's digit)"], ["active", "branch being counted"], ["done", "free branch: any digits below, memoised"], ["bad", "not allowed"]],
      codeLang: "python",
      code: blank(WALK_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: start, options: WALK_MODES },
        { key: "n", label: "N  (or  N; digit set)", value: (opts && opts.n) || WALK_DEF[start].n, width: 150 },
      ],
      random: () => {
        const md = WALK_MODES.indexOf(curMode(el, start)), N = Viz.rand(100, 99999);
        if (md === 0) return { n: String(N) };
        const D = [...new Set(Viz.randInts(Viz.rand(2, 4), 1, 9))].sort((a, b) => a - b); return { n: `${N}; ${D.join(",")}` };
      },
      build: ({ mode, n }) => {
        const md = Math.max(0, WALK_MODES.indexOf(mode));
        setCode(el, WALK_CODE[md]);
        const parts = String(n ?? "").split(";");
        const N = Number(parts[0].trim());
        if (!Number.isInteger(N) || N < 1 || N > 999999) throw new Error("N must be a whole number from 1 to 999999 (at most 6 digits, so the chain fits).");
        let D = [];
        if (md === 1) { if (parts.length < 2) throw new Error('Give the digit set after a semicolon, e.g. "348; 1,3,5,7".'); D = [...new Set(ints(parts[1], "digit set", { min: 1, max: 9, lo: 1, hi: 9 }))].sort((a, b) => a - b); }
        const s = String(N).split("").map(Number), L = s.length;
        const opt = (st) => {
          const out = [];
          for (let d = 0; d <= 9; d++) {
            if (md === 0) {
              if (!st.started && d === 0) out.push({ d, lab: "lead", next: { mask: 0, started: false } });
              else if (st.mask >> d & 1) out.push({ d, lab: String(d), next: null, why: "repeat" });
              else out.push({ d, lab: String(d), next: { mask: st.mask | 1 << d, started: true } });
            } else {
              if (d === 0) out.push(st.started ? { d, lab: "0", next: null, why: "not in set" } : { d, lab: "empty", next: { started: false } });
              else if (D.includes(d)) out.push({ d, lab: String(d), next: { started: true } });
              else out.push({ d, lab: String(d), next: null, why: "not in set" });
            }
          }
          return out;
        };
        const key = (pos, st) => `${pos}|${md === 0 ? st.mask : 0}|${st.started ? 1 : 0}`;
        const memo = new Map(); let hits = 0, calls = 0;
        const F = (pos, st) => {
          calls++;
          if (pos === L) return st.started ? 1 : 0;
          const k = key(pos, st); if (memo.has(k)) { hits++; return memo.get(k); }
          let t = 0; for (const o of opt(st)) if (o.next) t += F(pos + 1, o.next);
          memo.set(k, t); return t;
        };
        const stTxt = (st) => (md === 0 ? (st.started ? `used ${setTxt(st.mask, 10)}` : "not started") : st.started ? "started" : "not started");
        const levels = [], fr = [];
        const snap = (o) => fr.push({ levels: levels.map((l) => ({ ...l, br: l.br.map((b) => ({ ...b })) })), memo: memo.size, hits, ...o });
        snap({ note: `Count x in [1, ${N}] ${md === 0 ? "whose digits are all different" : `written only with digits {${D.join(", ")}}`}. Build x one digit at a time from the left. While the prefix <b>equals</b> N's prefix we are <b>tight</b>: the next digit may not exceed N's digit. The moment we put a smaller digit, the rest is <b>free</b> (any digits), and free subproblems depend only on (pos, ${md === 0 ? "used-digit mask, started" : "started"}), so they are memoised.`, line: [3, 5], vars: { N, digits: L } });
        let st = md === 0 ? { mask: 0, started: false } : { started: false }, alive = true, p = 0;
        for (; p < L && alive; p++) {
          const hi = s[p], br = opt(st).filter((o) => o.d <= hi).map((o) => ({ ...o, val: null, tight: o.d === hi }));
          if (md === 1 && !st.started) { const e = br.find((o) => o.d === 0); if (e) { e.tight = false; } }
          levels.push({ p, hi, st: stTxt(st), br, total: 0 });
          const lv = levels[levels.length - 1];
          snap({ cur: [p, -1], note: `pos ${p}: tight, so the digit can go up to N's digit ${hi}. State: ${esc(stTxt(st))}. ${br.filter((b) => !b.next).length ? `Branches marked ✗ break the rule.` : ""}`, line: 5, vars: { pos: p, hi, tight: "True", state: stTxt(st) } });
          let tightNext = null;
          br.forEach((b, bi) => {
            if (!b.next) return;
            if (b.tight) { tightNext = b; return; }
            const m0 = memo.size, h0 = hits, v = F(p + 1, b.next);
            b.val = v; lv.total += v;
            snap({ cur: [p, bi], note: `Digit ${b.lab === "lead" || b.lab === "empty" ? "none yet (leading zero: x will be shorter than N)" : b.d} &lt; ${hi}: from here on the number is <b>free</b>. f(${p + 1}, ${esc(stTxt(b.next))}, tight=False) = <b>${v}</b>${memo.size - m0 ? ` (${memo.size - m0} new memo state${memo.size - m0 === 1 ? "" : "s"})` : ""}${hits - h0 ? `, ${hits - h0} memo hit${hits - h0 === 1 ? "" : "s"}` : ""}.`, line: md === 0 ? (b.next.started ? [10, 11] : [8, 9]) : (b.next.started ? [9, 10, 11] : [7, 8]), vars: { pos: p, d: b.lab, value: v, "level total": lv.total, "memo states": memo.size } });
          });
          if (tightNext) { st = tightNext.next; snap({ cur: [p, br.indexOf(tightNext)], note: `Digit ${hi} = N's digit: stay <b>tight</b> and move to pos ${p + 1}. Only one tight path exists, so tight states are never worth memoising.`, line: md === 0 ? [10, 11] : [9, 10, 11], vars: { pos: p, d: hi, tight: "True" } }); }
          else { alive = false; snap({ cur: [p, -1], dead: p, note: `N's own digit ${hi} is not allowed here (${md === 0 ? "it repeats a digit of N's prefix" : "it is not in the set"}), so the tight path <b>ends</b>: no number starting with N's prefix ${s.slice(0, p + 1).join("")} counts.`, line: md === 0 ? 10 : 9, vars: { pos: p, tight: "dead" } }); }
        }
        let tot = alive ? 1 : 0;
        if (alive) snap({ bottom: true, note: `Reached the end while tight: x = N = ${N} itself is valid, worth 1.`, line: 4, vars: { "f(L, …)": 1 } });
        for (let t = levels.length - 1; t >= 0; t--) {
          tot += levels[t].total; levels[t].ret = tot;
          snap({ ret: t, note: `Return from pos ${t}: free branches ${levels[t].total} + what the tight branch returned (${tot - levels[t].total}) = <b>${tot}</b>.`, line: 12, vars: { pos: t, returns: tot } });
        }
        snap({ end: true, note: `Answer: <b>${tot}</b>. ${md === 0 ? `(LC 1012, numbers with a repeated digit, is just N − ${tot} = ${N - tot}.) ` : ""}The tight chain has at most ${L} levels; everything else came from ${memo.size} memo states (${hits} hits). Work = states × 10 digits, tiny compared with scanning all ${N} numbers.`, line: 13, vars: { answer: tot, "memo states": memo.size, hits } });
        return fr.map((f) => ({ ...f, s, L, md }));
      },
      render: (f) => {
        const { s, L } = f;
        const digits = Viz.array(s, { label: "N, digit by digit", ptrs: f.cur ? { pos: f.cur[0] } : f.ret !== undefined ? { pos: f.ret } : {}, cls: (i) => (f.cur && i < f.cur[0] ? "path" : f.cur && i === f.cur[0] ? "active" : "") });
        const bw = 44, bh = 40, gx = 6, gy = 30, lw = 112, rw = 90;
        const Wd = lw + 10 * (bw + gx) + rw, Hd = Math.max(1, f.levels.length) * (bh + gy) + 10;
        let svg = "";
        f.levels.forEach((lv, t) => {
          const y = 6 + t * (bh + gy);
          svg += `<text class="dbd-lab" x="${lw - 10}" y="${y + bh / 2 - 7}" text-anchor="end" dominant-baseline="central">pos ${lv.p}, ≤ ${lv.hi}</text><text class="dbd-lab sub" x="${lw - 10}" y="${y + bh / 2 + 8}" text-anchor="end" dominant-baseline="central">${esc(lv.st.length > 16 ? lv.st.slice(0, 15) + "…}" : lv.st)}</text>`;
          lv.br.forEach((b, bi) => {
            const x = lw + bi * (bw + gx);
            const cur = f.cur && f.cur[0] === lv.p && f.cur[1] === bi;
            const cl = !b.next ? "bad" : cur ? "active" : b.tight ? "path" : b.val !== null ? "done" : "";
            svg += `<rect class="box ${cl}" x="${x}" y="${y}" width="${bw}" height="${bh}" rx="6"/>`;
            svg += `<text class="dbd-bits ${cl}" x="${x + bw / 2}" y="${y + 12}" text-anchor="middle">${esc(b.lab === "lead" || b.lab === "empty" ? "none" : b.lab)}</text>`;
            const v = !b.next ? "✗" : b.tight ? "↓" : b.val === null ? "…" : String(b.val);
            svg += `<text class="dbd-v ${v.length > 4 ? "sm" : ""} ${cl}" x="${x + bw / 2}" y="${y + 28}" text-anchor="middle" dominant-baseline="central">${esc(v)}</text>`;
            if (b.tight && b.next && t + 1 < f.levels.length) svg += `<path class="dbd-e path" d="M${x + bw / 2},${y + bh} L${x + bw / 2},${y + bh + gy - 4}"/><polygon class="dbd-ah path" points="${x + bw / 2},${y + bh + gy - 1} ${x + bw / 2 - 4.5},${y + bh + gy - 9} ${x + bw / 2 + 4.5},${y + bh + gy - 9}"/>`;
          });
          const xr = lw + lv.br.length * (bw + gx) + 8;
          if (lv.ret !== undefined) svg += `<text class="dbd-ret" x="${xr}" y="${y + bh / 2}" dominant-baseline="central">⇒ ${lv.ret}</text>`;
          else if (f.dead === lv.p) svg += `<text class="dbd-ret bad" x="${xr}" y="${y + bh / 2}" dominant-baseline="central">tight dies</text>`;
        });
        const tree = f.levels.length ? Viz.labeled("the tight chain (one row per position; boxes = the digit placed there)", `<svg class="dg dbd-g" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" height="${Hd}" role="img" aria-label="digit tree">${svg}</svg>`) : "";
        const stats = Viz.labeled("memo states / hits", `<div class="v-item">${f.memo} / ${f.hits}</div>`);
        return col(row(digits, stats), tree);
      },
    });
    return onMode(el, api, WALK_DEF);
  });

  /* =====================================================================
     9. Digit DP, bottom-up: free counts per state, plus the one tight state
     ===================================================================== */
  const TB_MODES = ["digit sum = S (0..N)", "count digit d in 0..N (233)", "no consecutive 1s in binary (600)"];
  const TB_DEF = { [TB_MODES[0]]: { n: "3141; 9" }, [TB_MODES[1]]: { n: "1234; 1" }, [TB_MODES[2]]: { n: "13" } };
  const TB_CODE = [
    [
      "def count_digit_sum(N, S):            # x in [0, N] with digit sum S",
      "    free = [0] * (S + 1)              # free[s]: prefixes already < N, sum s",
      "    tight = 0                         # digit sum of N's own prefix",
      "    for x in map(int, str(N)):",
      "        nxt = [0] * (S + 1)",
      "        for s, c in enumerate(free):    # free: any next digit 0..9",
      "            for t in range(10):",
      "                if s + t <= S: nxt[s + t] += c",
      "        if tight is not None:           # tight: a digit t < x goes free",
      "            for t in range(x):",
      "                if tight + t <= S: nxt[tight + t] += 1",
      "            tight = tight + x if tight + x <= S else None",
      "        free = nxt",
      "    return free[S] + (tight == S)",
    ],
    [
      "def count_digit(N, d):                # total copies of d (1..9) in 0..N",
      "    L = len(str(N))",
      "    free = [0] * (L + 1)              # free[c]: prefixes < N with c copies",
      "    tight = 0                         # copies of d in N's own prefix",
      "    for x in map(int, str(N)):",
      "        nxt = [0] * (L + 1)",
      "        for c, ways in enumerate(free):",
      "            for t in range(10):",
      "                nxt[c + (t == d)] += ways",
      "        for t in range(x):              # tight: a digit t < x goes free",
      "            nxt[tight + (t == d)] += 1",
      "        tight += x == d",
      "        free = nxt",
      "    return sum(c * w for c, w in enumerate(free)) + tight",
    ],
    [
      "def find_integers(N):                 # x in [0, N], no '11' in binary",
      "    free = [0, 0]                     # free[b]: prefixes < N ending in b",
      "    tight, alive = 0, True            # last bit of N's prefix",
      "    for x in map(int, bin(N)[2:]):",
      "        nxt = [free[0] + free[1],       # append 0 after anything",
      "               free[0]]                 # append 1 only after a 0",
      "        if alive and x == 1:            # tight: put 0 where N has 1",
      "            nxt[0] += 1",
      "            if tight == 1: alive = False   # N's own prefix has '11'",
      "        tight = x",
      "        free = nxt",
      "    return free[0] + free[1] + alive",
    ],
  ];
  Viz.register(P("table"), (el, opts) => {
    let api;
    const start = opts && TB_MODES.includes(opts.mode) ? opts.mode : TB_MODES[0];
    api = Viz.player(el, {
      title: "Digit DP as a table: free counts per state, plus one tight path",
      tag: "DIGIT DP · BOTTOM-UP",
      legend: [["path", "the tight state (N's own prefix)"], ["active", "counts written in this step"], ["visit", "counts they came from"], ["done", "states that count toward the answer"]],
      codeLang: "python",
      code: blank(TB_CODE),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: start, options: TB_MODES },
        { key: "n", label: "N; S  /  N; d  /  N", value: (opts && opts.n) || TB_DEF[start].n, width: 130 },
      ],
      random: () => {
        const md = TB_MODES.indexOf(curMode(el, start));
        if (md === 0) return { n: `${Viz.rand(100, 99999)}; ${Viz.rand(2, 12)}` };
        if (md === 1) return { n: `${Viz.rand(10, 99999)}; ${Viz.rand(1, 9)}` };
        return { n: String(Viz.rand(5, 300)) };
      },
      build: ({ mode, n }) => {
        const md = Math.max(0, TB_MODES.indexOf(mode));
        setCode(el, TB_CODE[md]);
        const parts = String(n ?? "").split(";").map((x) => x.trim());
        const N = Number(parts[0]);
        const maxN = md === 2 ? 1023 : 9999999;
        if (!Number.isInteger(N) || N < 1 || N > maxN) throw new Error(`N must be a whole number from 1 to ${maxN}.`);
        let K = 0;
        if (md < 2) {
          K = Number(parts[1]);
          if (parts.length < 2 || !Number.isInteger(K)) throw new Error(md === 0 ? 'Give "N; S", e.g. "3141; 9".' : 'Give "N; d", e.g. "1234; 1".');
          if (md === 0 && (K < 0 || K > 12)) throw new Error("S must be 0 … 12 (one table row per sum).");
          if (md === 1 && (K < 1 || K > 9)) throw new Error("d must be 1 … 9 (counting 0 needs leading-zero care; see the page).");
        }
        const base = md === 2 ? 2 : 10, digs = N.toString(base).split("").map(Number), L = digs.length;
        const NS = md === 0 ? K + 1 : md === 1 ? L + 1 : 2;
        const rowLab = Array.from({ length: NS }, (_, s) => (md === 0 ? `sum ${s}` : md === 1 ? `${s} × ${K}` : `ends ${s}`));
        const step = (s, t) => (md === 0 ? (s + t <= K ? s + t : null) : md === 1 ? s + (t === K ? 1 : 0) : s === 1 && t === 1 ? null : t);
        const cols = [Array(NS).fill(0)], tights = [0], fr = [];
        let free = Array(NS).fill(0), tight = 0;
        const snap = (o) => fr.push({ cols: cols.map((c) => c.slice()), tights: tights.slice(), ...o });
        snap({ note: `Read N = ${N}${base === 2 ? ` = ${digs.join("")}₂` : ""} left to right. Every prefix of a number ≤ N is either <b>tight</b> (equal to N's prefix: exactly one such prefix, drawn in the top row) or <b>free</b> (already smaller: any digits may follow). For free prefixes we only keep a count per state: ${md === 0 ? "the digit sum so far (sums above S are dropped)" : md === 1 ? `how many ${K}s so far` : "the last bit"}. Leading zeros are harmless here: ${md === 2 ? "a 0 never creates '11'" : md === 0 ? "they add 0 to the sum" : `they are not ${K}s`}.`, line: [1, 2], vars: { N, digits: L } });
        for (let p = 0; p < L; p++) {
          const x = digs[p], nxt = Array(NS).fill(0), src = [];
          for (let s = 0; s < NS; s++) if (free[s]) { src.push(s); for (let t = 0; t < base; t++) { const s2 = step(s, t); if (s2 !== null) nxt[s2] += free[s]; } }
          const mid = nxt.slice();
          cols.push(mid.slice()); tights.push(undefined);
          snap({ p, phase: 1, src, note: `Digit ${p} of N is ${x}. Step 1, free → free: every free prefix may take <b>any</b> digit 0..${base - 1}${md === 2 ? " (but 1 only after a 0)" : ""}. ${src.length ? `From ${src.map((s) => `${rowLab[s]} (${free[s]})`).join(", ")}.` : "There are no free prefixes yet."}`, line: md === 2 ? [4, 5] : md === 0 ? [5, 6, 7] : [6, 7, 8], vars: { pos: p, "N digit": x } });
          const spill = [];
          if (tight !== null) {
            for (let t = 0; t < x; t++) { const s2 = step(tight, t); if (s2 !== null) { nxt[s2] += 1; spill.push([t, s2]); } }
          }
          const old = tight;
          tight = tight === null ? null : step(tight, x);
          free = nxt; cols[cols.length - 1] = nxt.slice(); tights[tights.length - 1] = tight;
          snap({ p, phase: 2, oldT: old, spill, note: old === null ? `Step 2: the tight path already died, nothing spills.` : `Step 2, tight → free: N's prefix plus a digit <b>smaller</b> than ${x} becomes free: ${spill.length ? spill.map(([t, s2]) => `digit ${t} → ${rowLab[s2]}`).join(", ") : "nothing (x = 0, or every smaller digit breaks the rule)"}. Then the tight prefix takes ${x} itself: ${tight === null ? "<b>that breaks the rule, so the tight path dies</b>" : `now ${rowLab[tight]}`}.`, line: md === 2 ? [6, 7, 8, 9] : md === 0 ? [8, 9, 10, 11] : [9, 10, 11], vars: { pos: p, "N digit": x, tight: tight === null ? "dead" : rowLab[tight] } });
        }
        let ans, good;
        if (md === 0) { ans = free[K] + (tight === K ? 1 : 0); good = (s) => s === K; }
        else if (md === 1) { ans = free.reduce((a, w, c) => a + c * w, 0) + (tight || 0); good = (s) => s > 0; }
        else { ans = free[0] + free[1] + (tight !== null ? 1 : 0); good = () => true; }
        snap({ end: true, good: Array.from({ length: NS }, (_, s) => good(s)), note: md === 0 ? `Answer: free[${K}] = ${free[K]}, plus 1 if N itself has digit sum ${K} (${tight === K ? "it does" : "it does not"}): <b>${ans}</b>.` : md === 1 ? `Answer: every free prefix in row "c × ${K}" contributes c copies: ${free.map((w, c) => (w && c ? `${c}·${w}` : "")).filter(Boolean).join(" + ") || "0"}, plus N's own ${tight} copies: <b>${ans}</b> copies of ${K} in 0..${N}.` : `Answer: all free prefixes (${free[0] + free[1]}) plus N itself if it survived (${tight !== null ? "yes" : "no"}): <b>${ans}</b> numbers in [0, ${N}].`, line: md === 2 ? 11 : 13, vars: { answer: ans } });
        return fr.map((f) => ({ ...f, md, digs, NS, rowLab, base }));
      },
      render: (f) => {
        const { digs, NS, rowLab } = f, C = digs.length + 1;
        const M = [f.tights.concat(Array(C - f.tights.length).fill(undefined)).map((t, c) => (c < f.tights.length ? t : undefined))];
        for (let s = 0; s < NS; s++) M.push(Array.from({ length: C }, (_, c) => (c < f.cols.length ? f.cols[c][s] : undefined)));
        const cc = f.p !== undefined ? f.p + 1 : -1;
        const g = tbl(M, {
          label: "rows = state, columns = digits read so far", w: 46, h: 30, gap: 4, rowLabelW: 74,
          rowLabels: ["tight", ...rowLab], colLabels: ["start", ...digs.map((d, p) => `${d}`)],
          fmt: (v, r) => (v === undefined ? "" : r === 0 ? (v === null ? "✗" : rowLab[v].replace(/^sum |^ends /, "")) : v === 0 ? "·" : String(v)),
          cls: (r, c, v) => {
            if (v === undefined) return "dim";
            if (r === 0) return v === null ? "bad" : "path";
            if (f.end) return c === C - 1 && v && f.good[r - 1] ? "done" : "";
            if (c === cc) return f.phase === 2 && f.spill && f.spill.some(([, s2]) => s2 === r - 1) ? "active" : f.phase === 1 && v ? "active" : "";
            if (c === cc - 1 && v && f.phase === 1 && f.src.includes(r - 1)) return "visit";
            return "";
          },
        });
        return row(Viz.array(digs, { label: f.base === 2 ? "N in binary" : "N", ptrs: f.p !== undefined ? { pos: f.p } : {}, cls: (i) => (f.p === undefined ? "" : i < f.p ? "path" : i === f.p ? "active" : "") }), g);
      },
    });
    return onMode(el, api, TB_DEF);
  });
})();
