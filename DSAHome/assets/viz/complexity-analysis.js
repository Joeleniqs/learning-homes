/* Visualizers for Complexity Analysis. All names are prefixed "complexity-analysis-". */
(() => {
  const esc = Viz.esc;
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻", ".": "·" };
  const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");
  const big = (v) => {
    if (!Number.isFinite(v)) return "∞";
    if (Math.abs(v) < 1e6) return (Math.round(v * 10) / 10).toLocaleString("en-US");
    const e = Math.floor(Math.log10(v)); let m = Number((v / 10 ** e).toFixed(1));
    return m >= 10 ? `1.0×10${sup(e + 1)}` : `${m.toFixed(1)}×10${sup(e)}`;
  };
  const bigLg = (lg) => (lg < 6 ? big(10 ** lg) : (() => { let e = Math.floor(lg), m = Number((10 ** (lg - e)).toFixed(1)); if (m >= 10) { m = 1; e++; } return `${m.toFixed(1)}×10${sup(e)}`; })());

  /* ================= 1. Growth curves ================= */
  const CURVES = [
    { k: "O(1)", c: "c0", lg: () => 0 },
    { k: "O(log n)", c: "c1", lg: (n) => Math.log10(Math.max(1, Math.log2(n))) },
    { k: "O(√n)", c: "c2", lg: (n) => Math.log10(n) / 2 },
    { k: "O(n)", c: "c3", lg: (n) => Math.log10(n) },
    { k: "O(n log n)", c: "c4", lg: (n) => Math.log10(n * Math.max(1, Math.log2(n))) },
    { k: "O(n²)", c: "c5", lg: (n) => 2 * Math.log10(n) },
    { k: "O(2ⁿ)", c: "c6", lg: (n) => n * Math.log10(2) },
  ];
  const GROWTH_N = { "n up to 20": 20, "n up to 64": 64, "n up to 1000": 1000, "n up to 1000000": 1e6 };
  const doubling = (k, n) => {
    if (n < 2) return "";
    if (k === "O(1)") return "×1";
    if (k === "O(log n)") return `+1 step`;
    if (k === "O(√n)") return "×1.41";
    if (k === "O(n)") return "×2";
    if (k === "O(n log n)") return "×2.0+";
    if (k === "O(n²)") return "×4";
    return n / 2 > 60 ? "squares it" : `×2${sup(Math.floor(n / 2))}`;
  };

  Viz.register("complexity-analysis-growth", (el) => Viz.player(el, {
    title: "Growth curves: watch n grow and the classes separate",
    tag: "GROWTH",
    legend: [["path", "current n"], ["bad", "off the top of the chart"]],
    codeLang: "python",
    code: [
      "for n in sizes:",
      "    for f in [1, log n, √n, n, n log n, n², 2ⁿ]:",
      "        plot(n, f(n))",
      "    ratio = f(n) / f(n / 2)   # what doubling costs",
    ],
    inputs: [
      { key: "range", label: "range", type: "select", value: "n up to 64", options: Object.keys(GROWTH_N) },
      { key: "scale", label: "y axis", type: "select", value: "linear (honest)", options: ["linear (honest)", "logarithmic (fits everything)"] },
    ],
    build: ({ range, scale }) => {
      const N = GROWTH_N[range] || 64, log = scale.startsWith("log");
      const steps = 18, ns = [];
      for (let i = 1; i <= steps; i++) {
        const n = Math.max(1, Math.round((N * i) / steps));
        if (!ns.includes(n)) ns.push(n);
      }
      const ymaxLg = log ? Math.min(Math.max(CURVES[5].lg(N) * 1.15, 3), 14) : Math.log10(N * Math.max(1, Math.log2(N)) * 1.35);
      return ns.map((n, i) => {
        const vals = CURVES.map((c) => ({ k: c.k, c: c.c, lg: c.lg(n), off: c.lg(n) > ymaxLg + 1e-9, dbl: doubling(c.k, n) }));
        const off = vals.filter((v) => v.off).map((v) => v.k);
        const last = i === ns.length - 1;
        let note = `n = <b>${n.toLocaleString("en-US")}</b>. `;
        if (i === 0) note += "At tiny n every algorithm is instant. The constants matter more than the class here.";
        else if (last) note += log
          ? "On a log axis 2ⁿ is a straight line (it multiplies by 2 at every step), so it rises steeper than every polynomial, which bend over below it. Doubling n adds 1 to log n but <b>squares</b> 2ⁿ."
          : `On an honest linear axis O(log n) and O(√n) hug the floor, n and n log n climb gently, and ${off.length ? off.join(" and ") + " left the chart long ago" : "n² pulls away"}. This is why a better class beats any constant-factor tuning.`;
        else if (off.length) note += `${off.join(" and ")} ${off.length > 1 ? "are" : "is"} already above the chart. The cheaper classes have barely moved.`;
        else note += "Doubling n doubles O(n), quadruples O(n²), and adds just one step to O(log n).";
        return { n, N, vals, ymaxLg, log, line: last ? 3 : [0, 1, 2], vars: Object.fromEntries([["n", n.toLocaleString("en-US")], ...vals.filter((v) => v.k !== "O(1)").map((v) => [v.k, bigLg(v.lg).replace(/×10([⁰¹²³⁴⁵⁶⁷⁸⁹⁻]+)/g, (m, e) => "e" + [...e].map((ch) => (ch === "⁻" ? "-" : "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(ch))).join(""))])]), note };
      });
    },
    render: (f) => {
      const W = 620, H = 300, L = 56, R = 120, T = 14, B = 34, pw = W - L - R, ph = H - T - B;
      const xOf = (n) => L + (n / f.N) * pw;
      const yOf = (lg) => {
        const v = f.log ? lg / f.ymaxLg : 10 ** lg / 10 ** f.ymaxLg;
        return T + ph - Math.min(1, Math.max(0, v)) * ph;
      };
      const samples = 90, pts = [];
      for (let s = 0; s <= samples; s++) pts.push(1 + ((f.N - 1) * s * s) / (samples * samples));
      const lines = CURVES.map((c) => {
        const seg = []; let d = "";
        for (const n of [...pts.filter((p) => p < f.n), f.n]) {
          const lg = c.lg(n);
          d += `${d ? "L" : "M"}${xOf(n).toFixed(1)},${yOf(lg).toFixed(1)}`;
          if (lg > f.ymaxLg) break;
        }
        seg.push(d);
        return `<path class="ca-curve ${c.c}" d="${seg.join("")}"/>`;
      }).join("");
      const ticksX = [0, f.N / 4, f.N / 2, (3 * f.N) / 4, f.N].map((t) => `<line class="ca-grid" x1="${xOf(t)}" x2="${xOf(t)}" y1="${T}" y2="${T + ph}"/><text class="small muted" x="${xOf(t)}" y="${H - 14}" text-anchor="middle">${t.toLocaleString("en-US")}</text>`).join("");
      const yt = []; for (let q = 0; q <= 4; q++) yt.push(q / 4);
      const ticksY = yt.map((q) => {
        const lg = f.log ? q * f.ymaxLg : Math.log10(Math.max(1e-9, q * 10 ** f.ymaxLg));
        const y = T + ph - q * ph, label = q === 0 ? "0" : bigLg(lg);
        return `<line class="ca-grid" x1="${L}" x2="${L + pw}" y1="${y}" y2="${y}"/><text class="small muted" x="${L - 6}" y="${y + 4}" text-anchor="end">${f.log && q === 0 ? "1" : label}</text>`;
      }).join("");
      const GAP = 13, want = f.vals.map((v, i) => ({ i, y: v.off ? T + 6 : yOf(v.lg) })).sort((a, b) => a.y - b.y || a.i - b.i);
      for (let k = 1; k < want.length; k++) want[k].y = Math.max(want[k].y, want[k - 1].y + GAP);
      const bottom = T + ph + 2;
      if (want.length && want[want.length - 1].y > bottom) {
        want[want.length - 1].y = bottom;
        for (let k = want.length - 2; k >= 0; k--) want[k].y = Math.min(want[k].y, want[k + 1].y - GAP);
      }
      const labelY = []; want.forEach((w) => { labelY[w.i] = w.y; });
      const labels = f.vals.map((v, i) => {
        const y = labelY[i];
        return `<g class="${CURVES[i].c}"><circle class="ca-dot" cx="${v.off ? xOf(f.n) : xOf(f.n)}" cy="${v.off ? T : yOf(v.lg)}" r="${v.off ? 0 : 3.5}"/><text class="ca-lbl" x="${L + pw + 8}" y="${y + 4}">${v.k}${v.off ? " ↑" : ""}</text></g>`;
      }).join("");
      return `<svg class="dg ca-plot" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="growth curves">
        ${ticksX}${ticksY}<line class="ca-axis" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/><line class="ca-axis" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>
        <line class="ca-now" x1="${xOf(f.n)}" x2="${xOf(f.n)}" y1="${T}" y2="${T + ph}"/>
        ${lines}${labels}
        <text class="small muted" x="${L + pw / 2}" y="${H - 1}" text-anchor="middle">n</text>
      </svg>
      <div class="ca-dtable">${f.vals.map((v) => `<div class="ca-dcell ${v.c}${v.off ? " off" : ""}"><b>${v.k}</b><span>${v.k === "O(1)" ? "1" : bigLg(v.lg)}</span><small>${v.dbl ? "2n: " + v.dbl : ""}</small></div>`).join("")}</div>`;
    },
  }));

  /* ================= 2. Counting operations through loops ================= */
  const seeded = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  const LOOPS = {
    "single loop": {
      d1: true, max: 64, code: ["count = 0", "for i in range(n):", "    count += 1"], formula: "n", f: (n) => n,
      *run(n) { for (let i = 0; i < n; i++) yield { i, line: 2 }; },
      say: "One pass: each value of i is touched once.",
    },
    "nested loops": {
      max: 12, code: ["count = 0", "for i in range(n):", "    for j in range(n):", "        count += 1"], formula: "n²", f: (n) => n * n,
      *run(n) { for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) yield { i, j, line: 3 }; },
      say: "The inner loop runs n times for each of the n outer values: the whole square fills.",
    },
    "triangular (j > i)": {
      max: 12, code: ["count = 0", "for i in range(n):", "    for j in range(i + 1, n):", "        count += 1"], formula: "n(n−1)/2", f: (n) => (n * (n - 1)) / 2,
      *run(n) { for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) yield { i, j, line: 3 }; },
      say: "Only the triangle above the diagonal: half the square, still Θ(n²). Dropping the ½ is what Big-O does.",
    },
    "halving (i //= 2)": {
      d1: true, max: 64, code: ["count = 0", "i = n", "while i > 0:", "    count += 1", "    i //= 2"], formula: "⌊log₂ n⌋ + 1", f: (n) => Math.floor(Math.log2(n)) + 1,
      *run(n) { for (let i = n; i > 0; i = Math.floor(i / 2)) yield { i, line: 3 }; },
      say: "Each step throws away half of what is left, so only a handful of values are ever visited.",
    },
    "n × doubling": {
      max: 12, code: ["count = 0", "for i in range(n):", "    j = 1", "    while j < n:", "        count += 1", "        j *= 2"], formula: "n·⌈log₂ n⌉", f: (n) => n * Math.ceil(Math.log2(n)),
      *run(n) { for (let i = 0; i < n; i++) for (let j = 1; j < n; j *= 2) yield { i, j, line: 4 }; },
      say: "Each row only visits the powers of two: log n columns per row, n rows.",
    },
    "harmonic (step = i)": {
      max: 12, one: true, code: ["count = 0", "for i in range(1, n + 1):", "    for j in range(i, n + 1, i):", "        count += 1"], formula: "n·Hₙ ≈ n ln n", f: (n) => { let h = 0; for (let k = 1; k <= n; k++) h += 1 / k; return n * h; },
      *run(n) { for (let i = 1; i <= n; i++) for (let j = i; j <= n; j += i) yield { i, j, line: 3 }; },
      say: "Row i visits every i-th column: n + n/2 + n/3 + … = n·(1 + ½ + ⅓ + …) ≈ n ln n. This is the sieve's shape.",
    },
    "two pointers (j never resets)": {
      max: 12, code: ["count, j = 0, 0", "for i in range(n):", "    while j < n and a[j] - a[i] <= k:", "        j += 1", "        count += 1"], formula: "≤ n", f: (n) => n,
      *run(n, a) { let j = 0; for (let i = 0; i < n; i++) while (j < n && a[j] - a[i] <= 3) { yield { i, j, line: 3 }; j++; } },
      say: "Nested loops, yet j only moves forward: across the whole run it advances at most n times. The visited cells form a staircase, not a square.",
    },
    "square root (i·i ≤ n)": {
      d1: true, max: 64, code: ["count = 0", "i = 1", "while i * i <= n:", "    count += 1", "    i += 1"], formula: "⌊√n⌋", f: (n) => Math.floor(Math.sqrt(n)),
      *run(n) { for (let i = 1; i * i <= n; i++) yield { i, line: 3 }; },
      say: "Stops at √n: trial division only needs to test divisors up to the square root.",
    },
  };
  const hlPy = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hlPy(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const countLoop = (L, n) => { const a = arrFor(n); let c = 0; for (const _ of L.run(n, a)) c++; return c; };
  const arrFor = (n) => { const r = seeded(n * 7 + 3), a = []; let v = 0; for (let i = 0; i < n; i++) { v += Math.floor(r() * 3); a.push(v); } return a; };

  Viz.register("complexity-analysis-loops", (el) => Viz.player(el, {
    /* the code panel is rewritten in place for the chosen loop shape (all shapes use 6 lines) */
    title: "Count the operations: run the loop and tally every inner step",
    tag: "LOOP COUNTER",
    legend: [["active", "this step"], ["done", "already counted"], ["dim", "never visited"]],
    codeLang: "python",
    code: ["", "", "", "", "", ""],
    inputs: [
      { key: "shape", label: "loop shape", type: "select", value: "triangular (j > i)", options: Object.keys(LOOPS) },
      { key: "n", label: "n", value: "8", width: 70 },
    ],
    random: () => ({ n: String(Viz.rand(5, 12)) }),
    build: ({ shape, n: ns }) => {
      const L = LOOPS[shape];
      const n = Viz.parse.int(ns, { min: 2, max: L.max });
      setCode(el, L.code);
      const a = arrFor(n), ev = [...L.run(n, a)], fr = [], seen = [];
      const big = [10, 100, 1000, 10000].map((m) => ({ m, c: L.f(m) <= 2e6 ? countLoop(L, m) : null, f: L.f(m) }));
      fr.push({ L, n, a, seen: [], code: L.code, line: 0, vars: { n, count: 0, formula: L.formula }, note: `Predict first: how many times does the innermost line run for n = ${n}? Then step through and count.` });
      ev.forEach((e, k) => {
        seen.push(e);
        if (ev.length > 70 && k % 2 && k !== ev.length - 1) return;
        fr.push({ L, n, a, seen: seen.slice(), cur: e, code: L.code, line: e.line, vars: Object.assign({ n, i: e.i }, e.j !== undefined ? { j: e.j } : {}, { count: k + 1 }), note: `count = <b>${k + 1}</b>${e.j !== undefined ? ` at (i=${e.i}, j=${e.j})` : ` at i = ${e.i}`}.` });
      });
      const exact = Math.round(L.f(n) * 100) / 100;
      fr.push({ L, n, a, seen: seen.slice(), big, code: L.code, line: 0, vars: { n, count: ev.length, formula: `${L.formula} = ${exact}` }, note: `Done: <b>${ev.length}</b> inner steps for n = ${n}; the formula ${L.formula} gives ${exact}. ${L.say}` });
      return fr;
    },
    render: (f) => {
      const L = f.L, n = f.n, on = new Set(f.seen.map((e) => (e.j === undefined ? `${e.i}` : `${e.i},${e.j}`)));
      const curK = f.cur ? (f.cur.j === undefined ? `${f.cur.i}` : `${f.cur.i},${f.cur.j}`) : null;
      let body;
      if (L.d1) {
        const cols = 16, rows = Math.ceil(n / cols), m = [];
        for (let r = 0; r < rows; r++) m.push(Array.from({ length: Math.min(cols, n - r * cols) }, (_, c) => r * cols + c + (L.d1 && L.code[1].startsWith("for") ? 0 : 1)));
        body = Viz.grid(m, { label: `values of i (1 cell = one candidate value)`, cls: (r, c, v) => (String(v) === curK ? "active" : on.has(String(v)) ? "done" : "dim") });
      } else {
        const off = L.one ? 1 : 0, m = [];
        for (let i = 0; i < n; i++) m.push(Array.from({ length: n }, (_, c) => (on.has(`${i + off},${c + off}`) ? "•" : "")));
        body = Viz.grid(m, { label: "rows = i, columns = j (a dot = one inner step)", rowLabels: m.map((_, i) => `i=${i + off}`), colLabels: m[0].map((_, c) => String(c + off)), cls: (r, c) => (`${r + off},${c + off}` === curK ? "active" : on.has(`${r + off},${c + off}`) ? "done" : "") });
        if (L.code[2].includes("a[j]")) body = Viz.row(body, Viz.array(f.a, { label: "a (sorted), k = 3", ptrs: f.cur ? { i: f.cur.i, j: f.cur.j } : {} }));
      }
      const meter = `<div class="ca-meter"><span>count</span><div class="ca-mtrack"><div class="ca-mfill" style="width:${Math.min(100, (f.seen.length / (L.d1 ? n : n * n)) * 100)}%"></div></div><b>${f.seen.length}</b><span class="muted">of ${L.d1 ? "n" : "n²"} = ${L.d1 ? n : n * n}</span></div>`;
      const table = f.big ? `<table class="ca-count"><tr><th>n</th>${f.big.map((b) => `<td>${b.m.toLocaleString("en-US")}</td>`).join("")}</tr><tr><th>counted</th>${f.big.map((b) => `<td>${b.c === null ? "(skipped)" : b.c.toLocaleString("en-US")}</td>`).join("")}</tr><tr><th>${esc(L.formula)}</th>${f.big.map((b) => `<td>${Math.round(b.f).toLocaleString("en-US")}</td>`).join("")}</tr></table>` : "";
      return body + meter + table;
    },
  }));

  /* ================= 3. Amortized analysis: dynamic array growth ================= */
  const GROWTH = { "double (×2)": (c) => c * 2, "grow by half (×1.5)": (c) => Math.ceil(c * 1.5), "add 4 slots (+4)": (c) => c + 4 };
  Viz.register("complexity-analysis-amortized", (el) => Viz.player(el, {
    title: "Dynamic array appends: rare expensive copies, cheap on average",
    tag: "AMORTIZED",
    legend: [["done", "cheap append (1 write)"], ["bad", "append that resizes (copy everything)"], ["active", "this append"], ["path", "running average cost"]],
    codeLang: "python",
    code: [
      "def append(x):",
      "    if size == cap:",
      "        cap = grow(cap)",
      "        copy size items to new block",
      "    data[size] = x;  size += 1",
      "average = total_cost / appends",
    ],
    inputs: [
      { key: "growth", label: "growth rule", type: "select", value: "double (×2)", options: Object.keys(GROWTH) },
      { key: "m", label: "appends", value: "33", width: 70 },
    ],
    random: () => ({ m: String(Viz.rand(20, 48)) }),
    build: ({ growth, m: ms }) => {
      const m = Viz.parse.int(ms, { min: 4, max: 64 }), grow = GROWTH[growth] || GROWTH["double (×2)"];
      const pay = growth.startsWith("grow") ? 4 : 3;
      let cap = 1, size = 0, total = 0, copies = 0;
      const costs = [], avgs = [], fr = [];
      for (let k = 1; k <= m; k++) {
        let copied = 0, oldCap = cap;
        if (size === cap) { cap = grow(cap); copied = size; copies += size; }
        size++; const cost = 1 + copied; total += cost; costs.push({ cost, resized: copied > 0 }); avgs.push(total / k);
        const bank = pay * k - total;
        fr.push({ m, k, cap, oldCap, size, costs: costs.slice(), avgs: avgs.slice(), growth, pay, line: copied ? [1, 2, 3] : 4,
          vars: { append: k, size, cap, cost, total, average: (total / k).toFixed(2), [`bank (pay ${pay} each)`]: bank },
          note: copied
            ? `Append #${k} finds the array full (cap ${oldCap}), grows it to <b>${cap}</b> and copies <b>${copied}</b> items: cost ${cost}. ${growth.startsWith("add") ? "Fixed-size growth means these copies keep coming every few appends." : "Expensive, but the next copy is now far away."}`
            : `Append #${k}: there is room (size ${size - 1} &lt; cap ${cap}), so one write, cost 1. Running average ${(total / k).toFixed(2)}.` });
      }
      const avg = total / m;
      const last = fr[fr.length - 1];
      last.line = 5;
      last.note = growth.startsWith("add")
        ? `After ${m} appends: total ${total}, average <b>${avg.toFixed(2)}</b> and still climbing. Growing by a constant makes copies happen every 4 appends, so the total is about m²/8: <b>O(n) per append</b>, O(n²) overall. The bank goes negative.`
        : pay === 4 ? `After ${m} appends: total cost ${total} (${copies} copies), average <b>${avg.toFixed(2)}</b>. Copies still form a geometric series (ratio 1.5), now summing to less than 3m, so total &lt; 4m: <b>O(1) amortized</b> with a bigger constant than doubling, in exchange for less wasted memory. The bank (4 per append) never goes negative.`
        : `After ${m} appends: total cost ${total} (${copies} copies), average <b>${avg.toFixed(2)}</b>. Copies form a geometric series 1 + 2 + 4 + … &lt; 2m, so total &lt; 3m: <b>O(1) amortized</b> per append even though one append can cost O(n). The bank never goes negative.`;
      return fr;
    },
    render: (f) => {
      const W = 620, H = 210, L = 34, T = 12, B = 26, pw = W - L - 10, ph = H - T - B;
      const maxC = Math.max(4, ...f.costs.map((c) => c.cost)), bw = pw / f.m;
      const y = (v) => T + ph - (v / maxC) * ph;
      const barsSvg = f.costs.map((c, i) => `<rect class="ca-abar ${i === f.k - 1 ? "active" : c.resized ? "bad" : "done"}" x="${L + i * bw + 1}" y="${y(c.cost)}" width="${Math.max(2, bw - 2)}" height="${T + ph - y(c.cost)}"/>${c.resized && bw > 9 ? `<text class="small" x="${L + i * bw + bw / 2}" y="${y(c.cost) - 3}" text-anchor="middle">${c.cost}</text>` : ""}`).join("");
      const avgPath = f.avgs.map((a, i) => `${i ? "L" : "M"}${(L + i * bw + bw / 2).toFixed(1)},${y(a).toFixed(1)}`).join("");
      const three = f.growth.startsWith("add") ? "" : `<line class="ca-ref" x1="${L}" x2="${L + pw}" y1="${y(f.pay)}" y2="${y(f.pay)}"/><text class="small muted" x="${L + 6}" y="${T + 8}">dashed line: the average never exceeds ${f.pay}</text>`;
      const yt = [0, Math.round(maxC / 2), maxC].map((v) => `<text class="small muted" x="${L - 5}" y="${y(v) + 4}" text-anchor="end">${v}</text>`).join("");
      const chart = `<svg class="dg ca-plot" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="cost per append">
        <line class="ca-axis" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>${yt}${barsSvg}${three}
        <path class="ca-avg" d="${avgPath}"/><circle class="ca-avgdot" cx="${L + (f.k - 1) * bw + bw / 2}" cy="${y(f.avgs[f.k - 1])}" r="4"/>
        <text class="small muted" x="${L + pw / 2}" y="${H - 6}" text-anchor="middle">append number 1 … ${f.m} (bar = cost of that append)</text></svg>`;
      const resized = f.costs[f.k - 1].resized;
      const slots = Array.from({ length: f.cap }, (_, i) => {
        const c = i === f.size - 1 ? "active" : i < f.size ? (resized ? "visit" : "done") : "free";
        return `<span class="ca-slot ${c}">${i < f.size ? i + 1 : ""}</span>`;
      }).join("");
      const arr = `<div class="ca-block"><div class="ca-block-lbl">backing block: size <b>${f.size}</b> / capacity <b>${f.cap}</b>${resized ? ` · just copied ${f.size - 1} item${f.size === 2 ? "" : "s"} into a new block` : ""}</div><div class="ca-slots">${slots}</div></div>`;
      return chart + arr;
    },
  }));

  /* ================= 4. Recursion tree → Master theorem ================= */
  const MASTER_PRESETS = [
    ["2", "2", "1", "merge sort"], ["1", "2", "0", "binary search"], ["2", "2", "0", "tree traversal"],
    ["3", "2", "1", "Karatsuba"], ["4", "2", "1", "naive 4-way split"], ["1", "2", "1", "quickselect (good pivots)"], ["7", "2", "2", "Strassen"], ["2", "4", "1", "T(n)=2T(n/4)+n"],
  ];
  const fmtPow = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)) : x.toFixed(2));
  const nPow = (e) => (Math.abs(e) < 1e-9 ? "1" : Math.abs(e - 1) < 1e-9 ? "n" : `n${sup(fmtPow(e))}`);
  Viz.register("complexity-analysis-master", (el) => Viz.player(el, {
    title: "Recursion tree → Master theorem: T(n) = a·T(n/b) + n^d",
    tag: "MASTER THEOREM",
    legend: [["visit", "subproblems on this level"], ["active", "level being summed"], ["done", "level summed"]],
    codeLang: "python",
    code: [
      "def T(n):",
      "    if n <= 1: return 1",
      "    work = n ** d          # outside the calls",
      "    for _ in range(a):",
      "        work += T(n / b)",
      "    return work",
    ],
    inputs: [
      { key: "a", label: "a (calls)", value: "2", width: 60 },
      { key: "b", label: "b (shrink)", value: "2", width: 60 },
      { key: "d", label: "d (work n^d)", value: "1", width: 60 },
      { key: "n", label: "n", value: "64", width: 80 },
    ],
    random: () => { const p = MASTER_PRESETS[Viz.rand(0, MASTER_PRESETS.length - 1)]; return { a: p[0], b: p[1], d: p[2], n: p[1] === "4" ? "256" : "64" }; },
    build: ({ a: as, b: bs, d: ds, n: nsx }) => {
      const a = Viz.parse.int(as, { min: 1, max: 8 }), b = Viz.parse.int(bs, { min: 2, max: 4 }), d = Number(ds), n = Viz.parse.int(nsx, { min: 2, max: 4096 });
      if (!(d >= 0 && d <= 3)) throw new Error("d must be between 0 and 3 (decimals allowed).");
      const depth = Math.floor(Math.log(n) / Math.log(b) + 1e-9);
      if (b ** depth !== n) throw new Error(`n must be a power of b (try ${b ** Math.max(2, depth)}).`);
      const crit = Math.log(a) / Math.log(b), levels = [];
      for (let i = 0; i <= depth; i++) { const nodes = a ** i, size = n / b ** i; levels.push({ i, nodes, size, work: nodes * size ** d }); }
      const total = levels.reduce((s, l) => s + l.work, 0);
      const rel = Math.abs(crit - d) < 1e-9 ? 0 : crit < d ? -1 : 1;
      const name = (MASTER_PRESETS.find((p) => p[0] == a && p[1] == b && Number(p[2]) === d) || [])[3];
      const fr = [];
      const vars = (extra) => Object.assign({ a, b, d, "log_b a": crit.toFixed(3) }, extra);
      fr.push({ levels, upto: -1, a, b, d, n, line: [0, 3, 4], vars: vars({ levels: depth + 1 }), note: `T(n) = ${a}·T(n/${b}) + ${nPow(d)}${name ? ` (${name})` : ""}. Each call does ${nPow(d)} work itself and makes ${a} call${a > 1 ? "s" : ""} on inputs ${b}× smaller. The tree has log<sub>${b}</sub> ${n} + 1 = <b>${depth + 1}</b> levels.` });
      let run = 0;
      levels.forEach((l, i) => {
        run += l.work;
        fr.push({ levels, upto: i, cur: i, a, b, d, n, line: i === depth ? 1 : 2, vars: vars({ level: i, nodes: l.nodes, "size each": l.size, "level work": big(l.work), "sum so far": big(run) }),
          note: `Level ${i}: <b>${a}${sup(i)} = ${l.nodes.toLocaleString("en-US")}</b> subproblem${l.nodes > 1 ? "s" : ""} of size n/${b}${sup(i)} = ${l.size}, each doing ${nPow(d)} = ${big(l.size ** d)} work, so the level costs <b>${big(l.work)}</b>.${i ? ` Ratio to the level above: ×${(a / b ** d).toFixed(2)} (a / b^d).` : ""}` });
      });
      const verdict = rel < 0 ? `Θ(${nPow(d)})` : rel === 0 ? (d === 0 ? "Θ(log n)" : `Θ(${nPow(d)} log n)`) : `Θ(${nPow(crit)})`;
      const why = rel < 0 ? `a = ${a} &lt; b^d = ${fmtPow(b ** d)}: level work <b>shrinks</b> geometrically going down, so the root dominates. Case 1 (root-heavy).`
        : rel === 0 ? `a = ${a} = b^d: every level costs the same ${nPow(d)}, and there are log n levels. Case 2 (balanced).`
        : `a = ${a} &gt; b^d = ${fmtPow(b ** d)}: level work <b>grows</b> going down, so the ${levels[depth].nodes.toLocaleString("en-US")} leaves dominate: n^(log<sub>${b}</sub> ${a}) = ${nPow(crit)}. Case 3 (leaf-heavy).`;
      const pred = rel < 0 ? n ** d : rel === 0 ? n ** d * (depth + 1) : n ** crit;
      fr.push({ levels, upto: depth, verdict, rel, a, b, d, n, line: 5, vars: vars({ total: big(total), [verdict]: big(pred) }), note: `${why} Total ${big(total)} ≈ <b>T(n) = ${verdict}</b> (the shape ${big(pred)} is within a constant factor).` });
      return fr;
    },
    render: (f) => {
      const W = 640, rowH = 40, T = 8, H = T + f.levels.length * rowH + 6;
      const maxW = Math.max(...f.levels.map((l) => l.work));
      const rows = f.levels.map((l, i) => {
        const y = T + i * rowH, shown = i <= f.upto, show = Math.min(l.nodes, 8);
        const span = 300, gap = span / show;
        const boxes = Array.from({ length: show }, (_, k) => `<rect class="box ${i === f.cur ? "active" : shown ? "done" : "visit"}" x="${10 + k * gap + 2}" y="${y + 4}" width="${Math.max(10, gap - 4)}" height="24" rx="5"/>${gap > 26 ? `<text class="small" x="${10 + k * gap + gap / 2}" y="${y + 20}" text-anchor="middle">${fmtPow(l.size)}</text>` : ""}`).join("");
        const more = l.nodes > 8 ? `<text class="small muted" x="${314}" y="${y + 20}">+${(l.nodes - 8).toLocaleString("en-US")}</text>` : "";
        const bw = shown ? Math.max(2, (l.work / maxW) * 190) : 0;
        return `${boxes}${more}<text class="small" x="360" y="${y + 20}">L${i}: ${l.nodes.toLocaleString("en-US")}×</text>
          <rect class="ca-lbar ${i === f.cur ? "active" : "done"}" x="430" y="${y + 6}" width="${bw}" height="20" rx="3"/>${shown ? `<text class="small" x="${434 + bw}" y="${y + 20}">${big(l.work)}</text>` : ""}`;
      }).join("");
      const verdict = f.verdict ? `<div class="ca-verdict ${f.rel < 0 ? "root" : f.rel === 0 ? "even" : "leaf"}"><b>${f.verdict}</b><span>${f.rel < 0 ? "root-heavy · case 1" : f.rel === 0 ? "every level equal · case 2" : "leaf-heavy · case 3"}</span></div>` : "";
      return `<svg class="dg ca-plot" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="recursion tree levels"><text class="small muted" x="10" y="${T - 1}"></text>${rows}</svg>
        <div class="ca-mlegend muted">left: subproblems per level (labelled with their size) · right: total work on that level</div>${verdict}`;
    },
  }));

  /* ================= 5. Space: the call stack is memory too ================= */
  const SPACE = {
    "sum(n): one call per level": { max: 12, def: 6, code: ["def total(n):", "    if n == 0: return 0", "    return n + total(n - 1)", "", "# stack depth n + 1 → O(n) space"],
      run(n, ev) { const go = (k, d) => { ev.push({ t: "call", lab: `total(${k})`, d, line: 0 }); if (k === 0) { ev.push({ t: "ret", lab: `total(0)`, d, val: 0, line: 1 }); return 0; } const r = k + go(k - 1, d + 1); ev.push({ t: "ret", lab: `total(${k})`, d, val: r, line: 2 }); return r; }; go(n, 1); },
      sum: (calls, depth) => `${calls} calls, max depth ${depth}: the chain of pending “n + …” additions is O(n) stack memory even though no array was allocated.` },
    "fib(n): many calls, shallow stack": { max: 7, def: 5, code: ["def fib(n):", "    if n < 2: return n", "    return fib(n - 1) + fib(n - 2)", "", "# depth ≤ n but calls ≈ 1.6ⁿ"],
      run(n, ev) { const go = (k, d) => { ev.push({ t: "call", lab: `fib(${k})`, d, line: 0 }); if (k < 2) { ev.push({ t: "ret", lab: `fib(${k})`, d, val: k, line: 1 }); return k; } const r = go(k - 1, d + 1) + go(k - 2, d + 1); ev.push({ t: "ret", lab: `fib(${k})`, d, val: r, line: 2 }); return r; }; go(n, 1); },
      sum: (calls, depth) => `${calls} calls but the stack never got deeper than ${depth}. Time counts every call (exponential); space counts only the frames alive <b>at the same moment</b> (O(n)).` },
    "binary search (recursive)": { max: 1024, def: 100, code: ["def find(lo, hi):", "    if lo > hi: return -1", "    mid = (lo + hi) // 2", "    if a[mid] < t: return find(mid + 1, hi)", "    return find(lo, mid - 1)"],
      run(n, ev) { const go = (lo, hi, d) => { ev.push({ t: "call", lab: `find(${lo},${hi})`, d, line: 0 }); if (lo > hi) { ev.push({ t: "ret", lab: `find(${lo},${hi})`, d, val: -1, line: 1 }); return -1; } const mid = (lo + hi) >> 1; const r = go(mid + 1, hi, d + 1); ev.push({ t: "ret", lab: `find(${lo},${hi})`, d, val: r, line: 3 }); return r; }; go(0, n - 1, 1); },
      sum: (calls, depth) => `Searching for a value larger than every item: ${calls} calls, max depth ${depth} ≈ log₂ n. O(log n) stack. A while loop would make it O(1).` },
    "sum with a loop": { max: 12, def: 6, code: ["def total(n):", "    s = 0", "    for i in range(1, n + 1):", "        s += i", "    return s"],
      run(n, ev) { ev.push({ t: "call", lab: `total(${n})`, d: 1, line: 0 }); let s = 0; for (let i = 1; i <= n; i++) { s += i; ev.push({ t: "step", lab: `total(${n})`, d: 1, val: s, line: 3, i }); } ev.push({ t: "ret", lab: `total(${n})`, d: 1, val: s, line: 4 }); },
      sum: (calls, depth) => `One frame the whole time: O(1) extra space. Same answer, same O(n) time as the recursive version.` },
  };
  Viz.register("complexity-analysis-space", (el, opts) => {
    const first = (opts && opts.fn && SPACE[opts.fn]) ? opts.fn : "sum(n): one call per level";
    return Viz.player(el, {
      title: "Space complexity: frames alive at the same time",
      tag: "CALL STACK",
      legend: [["active", "running frame"], ["visit", "waiting frame"], ["done", "returned"], ["path", "deepest point so far"]],
      codeLang: "python",
      code: ["", "", "", "", ""],
      inputs: [
        { key: "fn", label: "program", type: "select", value: first, options: Object.keys(SPACE) },
        { key: "n", label: "n", value: String(SPACE[first].def), width: 70 },
      ],
      build: ({ fn, n: nsx }) => {
        const S = SPACE[fn]; setCode(el, S.code);
        const n = Viz.parse.int(nsx, { min: fn.startsWith("binary") ? 2 : 0, max: S.max });
        const ev = []; S.run(n, ev);
        const stack = [], hist = [], fr = []; let calls = 0, maxD = 0;
        ev.forEach((e, k) => {
          if (e.t === "call") { stack.push(e.lab); calls++; }
          maxD = Math.max(maxD, stack.length); hist.push(stack.length);
          const vars = { n, depth: stack.length, "max depth": maxD, calls };
          if (e.val !== undefined) vars[e.t === "step" ? "s" : "returns"] = e.val;
          const note = e.t === "call" ? `Call <b>${e.lab}</b>: a new frame is pushed (depth ${stack.length}).` : e.t === "step" ? `i = ${e.i}: the loop reuses the same frame; s = ${e.val}.` : `<b>${e.lab}</b> returns ${e.val}; its frame is popped.`;
          fr.push({ stack: stack.slice(), hist: hist.slice(), maxD, total: ev.length, popped: e.t === "ret", line: e.line, vars, note });
          if (e.t === "ret") stack.pop();
        });
        fr[fr.length - 1].note += " " + S.sum(calls, maxD);
        if (ev.length > 160) return fr.filter((_, k) => k % 2 === 0 || k === fr.length - 1);
        return fr;
      },
      render: (f) => {
        const items = f.stack.map((s, i) => s), top = items.length - 1;
        const st = Viz.stack(items.length > 14 ? ["…", ...items.slice(-13)] : items, { label: "call stack", cls: (i) => (i === (items.length > 14 ? 13 : top) ? (f.popped ? "done" : "active") : i === 0 && items.length > 14 ? "" : "visit") });
        const W = 420, H = 190, L = 30, T = 12, B = 22, pw = W - L - 8, ph = H - T - B;
        const maxY = Math.max(4, f.maxD), x = (k) => L + (k / Math.max(1, f.total - 1)) * pw, y = (d) => T + ph - (d / maxY) * ph;
        const d = f.hist.map((h, k) => `${k ? "L" + x(k).toFixed(1) + "," + y(f.hist[k - 1]).toFixed(1) + "L" : "M"}${x(k).toFixed(1)},${y(h).toFixed(1)}`).join("");
        const chart = `<div class="v-labeled"><span class="v-caption">stack depth over time</span><svg class="dg ca-plot" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="stack depth over time">
          <line class="ca-axis" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/><line class="ca-axis" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>
          <line class="ca-ref path" x1="${L}" x2="${L + pw}" y1="${y(f.maxD)}" y2="${y(f.maxD)}"/><text class="small" x="${L + pw - 2}" y="${y(f.maxD) - 4}" text-anchor="end">max depth ${f.maxD}</text>
          <text class="small muted" x="${L - 5}" y="${y(0) + 4}" text-anchor="end">0</text><text class="small muted" x="${L - 5}" y="${y(maxY) + 4}" text-anchor="end">${maxY}</text>
          <path class="ca-depth" d="${d}"/><text class="small muted" x="${L + pw / 2}" y="${H - 5}" text-anchor="middle">time (events) →</text></svg></div>`;
        return Viz.row(st, chart);
      },
    });
  });

  /* ================= 6. log n intuition: halving ================= */
  Viz.register("complexity-analysis-halving", (el) => Viz.player(el, {
    title: "Halving: how many times can you cut n in half?",
    tag: "LOG n",
    legend: [["active", "what is left"], ["dim", "thrown away"], ["path", "binary digit removed"]],
    codeLang: "python",
    code: ["steps = 0", "while n > 1:", "    n //= 2        # drop the last bit", "    steps += 1", "# steps == floor(log2(original n))"],
    inputs: [{ key: "n", label: "n (up to 10^15)", value: "1000000", width: 170 }],
    random: () => ({ n: String([1000, 1e6, 1e9, 123456789, 4096, 1e15, 37][Viz.rand(0, 6)]) }),
    build: ({ n: nsx }) => {
      const t = String(nsx).replace(/[\s_,]/g, "");
      let n = /^\d+(\.\d+)?e\d+$/i.test(t) ? Number(t) : /^10\^\d+$/.test(t) ? 10 ** Number(t.slice(3)) : Number(t);
      if (!Number.isInteger(n) || n < 2 || n > 1e15) throw new Error("Use a whole number from 2 to 10^15 (1e15 works too).");
      const orig = n, bits = orig.toString(2), fr = [], vals = [n];
      fr.push({ orig, vals: vals.slice(), bits, cut: 0, line: 0, vars: { n: orig.toLocaleString("en-US"), steps: 0, "bits in n": bits.length }, note: `Start with n = <b>${orig.toLocaleString("en-US")}</b>. In binary that is ${bits.length} digits. Guess: how many halvings until 1 is left?` });
      let steps = 0;
      while (n > 1) {
        n = Math.floor(n / 2); steps++; vals.push(n);
        fr.push({ orig, vals: vals.slice(), bits, cut: steps, line: [2, 3], vars: { n: n.toLocaleString("en-US"), steps, "bits in n": bits.length - steps }, note: `Step ${steps}: ${n.toLocaleString("en-US")} left${steps === 10 ? " (one thousandth of where we started)" : steps === 20 ? " (one millionth)" : steps === 30 ? " (one billionth)" : ""}. Halving = deleting the last binary digit.` });
      }
      fr.push({ orig, vals: vals.slice(), bits, cut: steps, line: 4, vars: { steps, "log₂ n": Math.log2(orig).toFixed(2), "bits − 1": bits.length - 1 }, note: `<b>${steps}</b> halvings, and log₂ ${orig.toLocaleString("en-US")} = ${Math.log2(orig).toFixed(2)}. Going from ${orig.toLocaleString("en-US")} to 1 takes one step per binary digit (after the leading 1). That is why binary search on 10${sup(15)} items needs about 50 comparisons.` });
      return fr;
    },
    render: (f) => {
      const k = f.vals.length - 1, show = f.vals.length > 12 ? [0, -1, ...f.vals.map((_, i) => i).slice(-11)] : f.vals.map((_, i) => i);
      const rows = show.map((i) => {
        if (i === -1) return `<div class="ca-hrow ca-hgap"><span></span><span>⋮</span><span></span></div>`;
        const v = f.vals[i], w = (v / f.orig) * 100;
        return `<div class="ca-hrow ${i === k ? "cur" : ""}"><span class="ca-hstep">${i === 0 ? "start" : "÷2 ×" + i}</span><div class="ca-htrack"><div class="ca-hfill" style="width:${Math.max(0.4, w)}%"></div></div><span class="ca-hval">${v.toLocaleString("en-US")}</span></div>`;
      }).join("");
      const bits = f.bits.split("").map((b, i) => `<span class="${i >= f.bits.length - f.cut ? "gone" : ""}">${b}</span>`).join("");
      return `<div class="ca-halving">${rows}</div><div class="ca-bits"><span class="v-caption">n in binary (each halving deletes the last digit)</span><div class="ca-bitrow">${bits}</div></div>`;
    },
  }));
})();
