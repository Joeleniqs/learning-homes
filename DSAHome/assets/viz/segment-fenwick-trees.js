/* Segment trees, Fenwick trees and sparse tables. Every frame comes from running the real algorithm on your input. */
(() => {
  const S = "segment-fenwick-trees";
  const P = (n) => `${S}-${n}`;
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; visualizers whose program changes with a select rewrite it in place. */
  const setCode = (el, code) => { if (!el || !el.querySelectorAll) return; el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.display = k < code.length ? "" : "none"; }); };
  const blank = (progs) => Array(Math.max(...progs.map((p) => p.length))).fill("");
  const fm = (v) => (v === Infinity ? "∞" : v === -Infinity ? "-∞" : v === null || v === undefined ? "·" : String(v));
  const lowbit = (i) => i & -i;
  const bin = (x, w) => { let s = ""; for (let k = w - 1; k >= 0; k--) s += (x >> k) & 1; return s; };
  const col = (...parts) => `<div class="sft-col">${parts.filter(Boolean).join("")}</div>`;
  const sgn = (x) => (x < 0 ? `− ${-x}` : `+ ${x}`);

  function ints(text, { min = 1, max = 16, lo = -99, hi = 99, name = "array" } = {}) {
    const toks = String(text).replace(/[[\]]/g, " ").split(/[\s,]+/).filter(Boolean);
    if (toks.length < min || toks.length > max) throw new Error(`Use between ${min} and ${max} numbers for the ${name} so the picture stays readable.`);
    return toks.map((t) => {
      const v = Number(t);
      if (!Number.isInteger(v) || v < lo || v > hi) throw new Error(`"${t}" must be a whole number from ${lo} to ${hi}.`);
      return v;
    });
  }
  /* Script of operations such as "add 2 6 3; sum 0 4". */
  function script(text, spec, { maxOps = 6 } = {}) {
    const parts = String(text).split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length || parts.length > maxOps) throw new Error(`Use between 1 and ${maxOps} operations separated by semicolons.`);
    return parts.map((p) => {
      const toks = p.split(/[\s,()]+/).filter(Boolean);
      const word = toks[0].toLowerCase();
      const kind = Object.keys(spec).find((k) => spec[k].words.includes(word));
      if (!kind) throw new Error(`"${p}": use operations like ${Object.values(spec).map((s) => s.example).join(", ")}.`);
      const nums = toks.slice(1).map(Number);
      if (nums.length !== spec[kind].args || nums.some((x) => !Number.isInteger(x))) throw new Error(`"${p}" must look like "${spec[kind].example}" (whole numbers).`);
      return { kind, nums, text: p };
    });
  }

  /* Range bars: every node is a bar spanning the array columns it covers; rows are levels.
     items: [{l, r, row, main, sub, tag, cls}] with 0-based inclusive columns. */
  function rangeBars(n, rowLabels, items, o = {}) {
    const cw = o.cw || 48, lw = o.lw || 60, R = rowLabels.length;
    let h = "";
    rowLabels.forEach((t, r) => { h += `<div class="sft-rl" style="grid-row:${r + 1}">${esc(t)}</div>`; });
    for (const it of items) {
      h += `<div class="sft-bar ${it.cls || ""}" style="grid-column:${it.l + 2} / ${it.r + 3};grid-row:${it.row + 1}">${it.sub !== undefined ? `<small>${esc(it.sub)}</small>` : ""}<b>${esc(fm(it.main))}</b>${it.tag ? `<span class="sft-tag">${esc(it.tag)}</span>` : ""}</div>`;
    }
    (o.foot || []).forEach((row, k) => {
      const gr = R + k + 1;
      h += `<div class="sft-rl" style="grid-row:${gr}">${esc(row.label)}</div>`;
      row.cells.forEach((c, j) => { h += `<div class="sft-cell ${c.cls || ""}${row.small ? " sm" : ""}" style="grid-column:${j + 2};grid-row:${gr}">${esc(fm(c.t))}</div>`; });
    });
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<div class="sft-rb" style="grid-template-columns:${lw}px repeat(${n}, ${cw}px)">${h}</div></div>`;
  }
  /* Fenwick blocks: t[i] spans a[i - lowbit(i) + 1 .. i]; the row is log2(lowbit(i)). */
  const fenTop = (n) => { let L = 0; while ((2 << L) <= n) L++; return L; };
  function fenBars(n, t, cls, o = {}) {
    const top = fenTop(n), items = [];
    for (let i = 1; i <= n; i++) {
      if (o.only && !o.only(i)) continue;
      const lb = lowbit(i), L = Math.log2(lb);
      items.push({ l: i - lb, r: i - 1, row: top - L, main: o.main ? o.main(i) : t[i], sub: o.sub ? o.sub(i) : `t[${i}]`, cls: cls(i) || "", tag: o.tag ? o.tag(i) : "" });
    }
    const labels = []; for (let L = top; L >= 0; L--) labels.push(`len ${1 << L}`);
    return rangeBars(n, labels, items, o);
  }
  const fenNaive = (A, n) => { const t = Array(n + 1).fill(0); for (let i = 1; i <= n; i++) for (let j = i - lowbit(i) + 1; j <= i; j++) t[i] += A[j]; return t; };
  /* Recursive segment tree shape (heap numbering, root 1). */
  function segShape(n) {
    const nodes = {}; let maxD = 0;
    const go = (node, l, r, d) => { nodes[node] = { l, r, d }; maxD = Math.max(maxD, d); if (l === r) return; const m = (l + r) >> 1; go(2 * node, l, m, d + 1); go(2 * node + 1, m + 1, r, d + 1); };
    go(1, 0, n - 1, 0);
    return { n, nodes, maxD, ids: Object.keys(nodes).map(Number) };
  }
  function segBars(shape, val, cls, o = {}) {
    const items = shape.ids.map((id) => {
      const nd = shape.nodes[id];
      return { l: nd.l, r: nd.r, row: nd.d, main: val(id), sub: o.sub ? o.sub(id) : nd.l === nd.r ? `#${id}` : `#${id} · ${nd.l}..${nd.r}`, cls: cls(id) || "", tag: o.tag ? o.tag(id) : "" };
    });
    const labels = Array.from({ length: shape.maxD + 1 }, (_, d) => `depth ${d}`);
    return rangeBars(shape.n, labels, items, o);
  }
  const FN = { sum: { f: (a, b) => a + b, id: 0 }, min: { f: (a, b) => Math.min(a, b), id: Infinity }, max: { f: (a, b) => Math.max(a, b), id: -Infinity } };

  /* =====================================================================
     1. lowbit: the bit trick behind Fenwick trees
     ===================================================================== */
  Viz.register(P("lowbit"), (el, opts) => Viz.player(el, {
    title: "lowbit(i) = i & -i decides which block t[i] owns",
    tag: "FENWICK · BITS",
    legend: [["active", "lowest set bit of i"], ["visit", "bits that differ from i"], ["path", "block owned by t[i]"], ["done", "blocks drawn so far"]],
    codeLang: "python",
    code: [
      "def lowbit(i):",
      "    return i & -i      # only the lowest 1 survives",
      "",
      "# -i == ~i + 1 in two's complement: flip all bits,",
      "# then the +1 ripples up to i's lowest 1 and stops",
      "for i in range(1, n + 1):",
      "    size = lowbit(i)",
      "    lo = i - size + 1  # t[i] = a[lo] + ... + a[i]",
    ],
    inputs: [{ key: "n", label: "n (1–16)", value: opts.n || "16", width: 60 }],
    random: () => ({ n: String(Viz.rand(6, 16)) }),
    build: ({ n }) => {
      n = Viz.parse.int(n, { min: 1, max: 16 });
      const fr = [];
      fr.push({ n, i: 0, note: `A Fenwick tree keeps n = ${n} partial sums t[1..${n}] (1-based). Each t[i] owns a block of the array that <b>ends at i</b>, and the block's length is the value of the lowest set bit of i. Step through to see why.`, line: [0, 1], vars: { n } });
      for (let i = 1; i <= n; i++) {
        const lb = i & -i, lo = i - lb + 1, tz = Math.log2(lb), down = i - lb, up = i + lb;
        fr.push({
          n, i, lb,
          note: `i = ${i} = <code>${bin(i, 8)}</code>. ${tz ? `Its ${tz} trailing zero${tz > 1 ? "s become" : " becomes"} 1 in ~i, so the +1 carries through ${tz > 1 ? "them" : "it"} and` : "Its lowest bit is bit 0, so ~i ends in 0 and the +1"} stops on bit ${tz}. Above that bit, -i is the flip of i, so <code>i &amp; -i</code> keeps only <b>${lb}</b>. t[${i}] owns ${lb} element${lb > 1 ? "s" : ""}: <b>a[${lo}..${i}]</b>. Drop the bit (${i} − ${lb} = ${down}) ${down ? `to reach block t[${down}] just to the left (prefix queries)` : "and you reach 0: this block alone is the whole prefix"}; add it (${i} + ${lb} = ${up}) ${up <= n ? `to reach t[${up}], the next block that also contains i (updates)` : `and you pass n: no bigger block contains i`}.`,
          line: [5, 6, 7],
          vars: { i, "bin(i)": bin(i, 8), "lowbit(i)": lb, block: `a[${lo}..${i}]`, "i - lowbit": down, "i + lowbit": up },
        });
      }
      fr.push({ n, i: n + 1, note: `Every block ends at its own index, and the lengths are powers of two. Any prefix a[1..i] splits into one block per set bit of i (at most ⌊log₂ n⌋ + 1 = ${fenTop(n) + 1} blocks), and every index sits inside at most that many blocks. That is the whole Fenwick tree: O(log n) for both queries and updates in an array of n numbers.`, line: [5, 6, 7], vars: { n, levels: fenTop(n) + 1 } });
      return fr;
    },
    render: (f) => {
      const i = f.i, n = f.n;
      let grid = "";
      if (i >= 1 && i <= n) {
        const tz = Math.log2(i & -i);
        const rows = [i & 255, ~i & 255, -i & 255, i & -i].map((v) => bin(v, 8).split(""));
        grid = Viz.grid(rows, {
          label: `i = ${i} as 8-bit two's complement`,
          rowLabels: ["i", "~i", "-i = ~i + 1", "i & -i"],
          colLabels: ["128", "64", "32", "16", "8", "4", "2", "1"],
          cls: (r, c) => { const b = 7 - c; if (b === tz) return "active"; if (r === 1 || (r === 2 && b > tz)) return "visit"; if (r === 3) return "dim"; return ""; },
        });
      }
      const bars = fenBars(n, [], (j) => (j === i ? "path" : i > n || j < i ? "done" : ""), {
        only: (j) => i === 0 || i > n || j <= i,
        main: (j) => `t[${j}]`,
        sub: (j) => (lowbit(j) > 1 ? `a[${j - lowbit(j) + 1}..${j}]` : `a[${j}]`),
        label: "blocks owned by t[1..n], one row per block length",
        foot: [
          { label: "i", cells: Array.from({ length: n }, (_, j) => ({ t: j + 1, cls: j + 1 === i ? "active" : "" })) },
          { label: "binary", small: true, cells: Array.from({ length: n }, (_, j) => ({ t: bin(j + 1, 5), cls: j + 1 === i ? "active" : "" })) },
        ],
      });
      return col(grid, bars);
    },
  }));

  /* =====================================================================
     2. Fenwick tree: prefix query, range query, point update, O(n) build
     ===================================================================== */
  const BITP = {
    query: [
      "def prefix(i):              # a[1] + ... + a[i]",
      "    s = 0",
      "    while i > 0:",
      "        s += t[i]           # block a[i-lowbit+1 .. i]",
      "        i -= i & -i         # drop lowest bit: go left",
      "    return s",
      "",
      "def range_sum(l, r):        # 1-based, inclusive",
      "    return prefix(r) - prefix(l - 1)",
    ],
    add: [
      "def add(i, delta):          # a[i] += delta",
      "    while i <= n:",
      "        t[i] += delta       # this block contains i",
      "        i += i & -i         # add lowest bit: next block up",
    ],
    build: [
      "def build(a):               # a[1..n], O(n)",
      "    t = a[:]                # t[i] starts as a[i]",
      "    for i in range(1, n + 1):",
      "        j = i + (i & -i)    # the block directly above i",
      "        if j <= n:",
      "            t[j] += t[i]    # t[i] is final: pass it up",
      "    return t",
    ],
  };
  const BIT_OPS = ["prefix sum(i)", "range sum(l, r)", "add(i, delta)", "build in O(n)"];
  Viz.register(P("bit"), (el, opts) => Viz.player(el, {
    title: "Fenwick tree: queries walk left, updates walk up",
    tag: "QUERY · UPDATE · BUILD",
    legend: [["active", "block being read or written"], ["done", "added to the answer / updated"], ["bad", "subtracted: prefix(l − 1)"], ["visit", "final (build)"]],
    codeLang: "python",
    code: blank(Object.values(BITP)),
    inputs: [
      { key: "a", label: "a[1..n] (up to 16 values)", value: opts.a || "5,3,7,9,6,4,1,2,8,6,3,5,7,2,4,6", width: 300 },
      { key: "op", label: "operation", value: opts.op || BIT_OPS[0], type: "select", options: BIT_OPS },
      { key: "p1", label: "i or l", value: opts.p1 || "7", width: 50 },
      { key: "p2", label: "r or delta", value: opts.p2 || "13", width: 60 },
    ],
    random: () => { const n = Viz.rand(8, 16), l = Viz.rand(1, n); return { a: Viz.randInts(n, 0, 9).join(","), p1: String(l), p2: String(Viz.rand(l, n)) }; },
    build: ({ a, op, p1, p2 }) => {
      const A = [0, ...ints(a, { min: 1, max: 16 })], n = A.length - 1;
      const kind = op.startsWith("prefix") ? "prefix" : op.startsWith("range") ? "range" : op.startsWith("add") ? "add" : "build";
      setCode(el, kind === "add" ? BITP.add : kind === "build" ? BITP.build : BITP.query);
      const fr = [];
      let t = kind === "build" ? [...A] : fenNaive(A, n);
      let bars = {}, cells = {};
      const snap = (note, line, vars, extra = {}) => fr.push({ n, A: [...A], t: [...t], bars: { ...bars }, cells: { ...cells }, note, line, vars, ...extra });
      if (kind === "prefix" || kind === "range") {
        let l = 1, r;
        if (kind === "prefix") r = Viz.parse.int(p1, { min: 1, max: n });
        else { l = Viz.parse.int(p1, { min: 1, max: n }); r = Viz.parse.int(p2, { min: l, max: n }); }
        const walk = (i0, mark, base) => {
          let i = i0, s = 0, used = 0;
          snap(`prefix(${i0}): ${i0 ? `i = ${i0} = <code>${bin(i0, 5)}</code> has ${bin(i0, 5).split("").filter((c) => c === "1").length} set bit${bin(i0, 5).split("").filter((c) => c === "1").length > 1 ? "s" : ""}, so the prefix a[1..${i0}] splits into exactly that many blocks.` : "i = 0 means the empty prefix: the loop does not run and the answer is 0."}`, [0, 1], { i: i0, s: 0 });
          while (i > 0) {
            const lb = lowbit(i), lo = i - lb + 1;
            s += t[i]; used++;
            bars[i] = mark; for (let j = lo; j <= i; j++) cells[j] = mark;
            snap(`i = ${i} = <code>${bin(i, 5)}</code>: add t[${i}] = ${t[i]}, the sum of a[${lo}..${i}]; s = ${s}. Drop the lowest bit: i = ${i} − ${lb} = ${i - lb}${i - lb ? ", the block that ends just left of " + lo : ", so the prefix is complete"}.`, [2, 3, 4], { i, "lowbit(i)": lb, s, ...(base !== undefined ? { "prefix(r)": base } : {}) });
            i -= lb;
          }
          snap(`prefix(${i0}) = <b>${s}</b> using ${used} block${used === 1 ? "" : "s"} instead of ${i0} additions.`, 5, { "prefix": s, ...(base !== undefined ? { "prefix(r)": base } : {}) });
          return s;
        };
        if (kind === "prefix") {
          const s = walk(r, "done");
          fr[fr.length - 1].res = s;
        } else {
          const sr = walk(r, "done");
          const sl = walk(l - 1, "bad", sr);
          for (let j = 1; j < l; j++) cells[j] = "bad";
          snap(`range_sum(${l}, ${r}) = prefix(${r}) − prefix(${l - 1}) = ${sr} − ${sl} = <b>${sr - sl}</b>. The red part a[1..${l - 1}] cancels and only the green a[${l}..${r}] is left. Blocks used: ${bars ? Object.keys(bars).length : 0}, never more than 2·⌈log₂(n + 1)⌉.`, [7, 8], { "prefix(r)": sr, "prefix(l-1)": sl, answer: sr - sl }, { res: sr - sl });
        }
      } else if (kind === "add") {
        const p = Viz.parse.int(p1, { min: 1, max: n }), d = Viz.parse.int(p2, { min: -99, max: 99 });
        cells[p] = "active";
        snap(`add(${p}, ${d}): a[${p}] changes, so every block that <b>contains</b> position ${p} must change by ${d}. Those blocks are t[${p}], then t[i + lowbit(i)] repeatedly: adding the lowest bit jumps to the smallest block that swallows the current one.`, 0, { i: p, delta: d });
        A[p] += d;
        let i = p, touched = 0;
        while (i <= n) {
          const lb = lowbit(i);
          t[i] += d; touched++;
          bars[i] = "active";
          snap(`i = ${i} = <code>${bin(i, 5)}</code>: block a[${i - lb + 1}..${i}] holds position ${p}, so t[${i}] += ${d} → ${t[i]}. Next: i + lowbit(i) = ${i} + ${lb} = ${i + lb}${i + lb > n ? `, which is past n = ${n}: stop` : ""}.`, [1, 2, 3], { i, "lowbit(i)": lb, delta: d, "t[i]": t[i] });
          bars[i] = "done";
          i += lb;
        }
        snap(`Done: ${touched} block${touched === 1 ? "" : "s"} updated (at most ⌊log₂ n⌋ + 1 = ${fenTop(n) + 1}). Every prefix query that crosses position ${p} now sees the new value.`, 1, { updated: touched }, { final: true });
      } else {
        snap(`O(n) build. Start with t = a (every block holds just its last element). Visit i = 1..n in order. When we reach i, every block inside t[i] has already handed its total to t[i], so t[i] is final; hand it to the block directly above, j = i + lowbit(i).`, [0, 1], { n });
        for (let i = 1; i <= n; i++) {
          const j = i + lowbit(i);
          bars[i] = "visit";
          if (j <= n) {
            bars[j] = "active";
            t[j] += t[i];
            snap(`i = ${i}: t[${i}] = ${t[i]} is final (block a[${i - lowbit(i) + 1}..${i}]). j = ${i} + ${lowbit(i)} = ${j}: t[${j}] += ${t[i]} → ${t[j]}.`, [2, 3, 4, 5], { i, j, "t[i]": t[i], "t[j]": t[j] });
            bars[j] = "";
          } else snap(`i = ${i}: t[${i}] = ${t[i]} is final. j = ${j} is past n, so nothing above needs it.`, [2, 3, 4], { i, j });
        }
        snap(`Every block is built with n additions in total: O(n) instead of n calls to add (O(n log n)).`, 6, { n }, { final: true });
      }
      return fr;
    },
    render: (f) => fenBars(f.n, f.t, (i) => f.bars[i] || "", {
      label: "Fenwick blocks: t[i] (value) spans a[i − lowbit(i) + 1 .. i]",
      foot: [
        { label: "a[i]", cells: Array.from({ length: f.n }, (_, j) => ({ t: f.A[j + 1], cls: f.cells[j + 1] || "" })) },
        { label: "i", small: true, cells: Array.from({ length: f.n }, (_, j) => ({ t: j + 1 })) },
      ],
    }),
  }));

  /* =====================================================================
     3. Range updates with Fenwick trees (one BIT on differences, or two BITs)
     ===================================================================== */
  const BRP = {
    two: [
      "# sum a[1..i] = prefix(B1, i)*i - prefix(B2, i)",
      "def range_add(l, r, x):",
      "    add(B1, l, x);           add(B1, r + 1, -x)",
      "    add(B2, l, x * (l - 1)); add(B2, r + 1, -x * r)",
      "def prefix_sum(i):",
      "    return prefix(B1, i) * i - prefix(B2, i)",
      "def range_sum(l, r):",
      "    return prefix_sum(r) - prefix_sum(l - 1)",
    ],
    one: [
      "# B = Fenwick tree over d; a[i] = d[1] + ... + d[i]",
      "def range_add(l, r, x):     # a[l..r] += x",
      "    add(B, l, x)            # d[l] += x: lifts a[l..n]",
      "    add(B, r + 1, -x)       # d[r+1] -= x: undo after r",
      "def point_query(i):         # a[i]",
      "    return prefix(B, i)",
    ],
  };
  const BR_MODES = ["range add + range sum (2 BITs)", "range add + point query (1 BIT)"];
  Viz.register(P("bitrange"), (el, opts) => Viz.player(el, {
    title: "Range updates on a Fenwick tree: difference array inside a BIT",
    tag: "RANGE ADD · RANGE SUM",
    legend: [["active", "touched by this update"], ["done", "read by prefix(·, r)"], ["bad", "read by prefix(·, l − 1)"], ["path", "range being changed or asked"]],
    codeLang: "python",
    code: blank(Object.values(BRP)),
    inputs: [
      { key: "mode", label: "mode", value: opts.mode || BR_MODES[0], type: "select", options: BR_MODES },
      { key: "n", label: "n", value: opts.n || "10", width: 46 },
      { key: "ops", label: "operations: add l r x · sum l r · get i", value: opts.ops || "add 2 7 3; add 5 10 -2; sum 4 8; get 6", width: 360 },
    ],
    random: () => {
      const n = Viz.rand(6, 12), ops = [];
      for (let k = 0; k < 4; k++) { const l = Viz.rand(1, n), r = Viz.rand(l, n); const c = Viz.rand(0, 3); ops.push(c < 2 ? `add ${l} ${r} ${Viz.rand(-5, 6) || 1}` : c === 2 ? `sum ${l} ${r}` : `get ${l}`); }
      return { n: String(n), ops: ops.join("; ") };
    },
    build: ({ mode, n, ops }) => {
      const two = mode.startsWith("range add + range");
      setCode(el, two ? BRP.two : BRP.one);
      n = Viz.parse.int(n, { min: 2, max: 12 });
      const prog = script(ops, {
        add: { words: ["add", "upd", "update"], args: 3, example: "add 2 7 3" },
        sum: { words: ["sum", "query", "q"], args: 2, example: "sum 4 8" },
        get: { words: ["get", "point"], args: 1, example: "get 6" },
      }, { maxOps: 6 });
      for (const o of prog) {
        const [l, r, x] = o.nums;
        if (l < 1 || l > n || (o.kind !== "get" && (r < l || r > n))) throw new Error(`"${o.text}": indices must satisfy 1 ≤ l ≤ r ≤ n = ${n}.`);
        if (o.kind === "add" && Math.abs(x) > 20) throw new Error(`"${o.text}": keep x between -20 and 20.`);
      }
      const truth = Array(n + 1).fill(0), d1 = Array(n + 2).fill(0), d2 = Array(n + 2).fill(0), t1 = Array(n + 1).fill(0), t2 = Array(n + 1).fill(0);
      const add = (t, d, i, x) => { const touched = []; if (i <= n) d[i] += x; for (; i <= n; i += lowbit(i)) { t[i] += x; touched.push(i); } return touched; };
      const pre = (t, i) => { let s = 0; const touched = []; for (; i > 0; i -= lowbit(i)) { s += t[i]; touched.push(i); } return { s, touched }; };
      const fr = [], outs = [];
      let hl = {};
      const snap = (note, line, vars, extra = {}) => fr.push({ two, n, truth: [...truth], d1: [...d1], d2: [...d2], t1: [...t1], t2: [...t2], hl: { ...hl }, outs: [...outs], note, line, vars, ...extra });
      snap(two ? `All zeros. B1 is a Fenwick tree over the difference array d (a[i] = d[1] + … + d[i]); B2 is a Fenwick tree over d[j]·(j − 1). Two BITs are enough to answer <b>range sums</b> after <b>range adds</b>, each in O(log n).` : `All zeros. B is a Fenwick tree over the difference array d, so a[i] = d[1] + … + d[i] = prefix(B, i). A range add only touches two entries of d.`, 0, { n });
      const key = (row, i) => `${row}:${i}`;
      for (const o of prog) {
        const [l, r, x] = o.nums;
        if (o.kind === "add") {
          hl = {}; for (let j = l; j <= r; j++) hl[key("truth", j)] = "path";
          const steps = two
            ? [["B1", l, x, `d[${l}] += ${x}: every a[j] with j ≥ ${l} rises by ${x}.`, 2], ["B1", r + 1, -x, `d[${r + 1}] −= ${x}: cancel the rise after r = ${r}.`, 2], ["B2", l, x * (l - 1), `B2 at ${l} gets x·(l − 1) = ${x * (l - 1)}: inside the range prefix(B1, i)·i = ${x}·i would also count the ${l - 1} cell${l - 1 === 1 ? "" : "s"} before l; this subtracts them.`, 3], ["B2", r + 1, -x * r, `B2 at ${r + 1} gets −x·r = ${-x * r}: past r, prefix(B1, i) is back to 0 and prefix(B2, i) = x·(l − 1) − x·r, so the range contributes exactly x·(r − l + 1).`, 3]]
            : [["B1", l, x, `d[${l}] += ${x}: prefix(B, j) for every j ≥ ${l} grows by ${x}.`, 2], ["B1", r + 1, -x, `d[${r + 1}] −= ${x}: from r + 1 on the rise is cancelled.`, 3]];
          for (const [which, i, v, why, line] of steps) {
            if (i > n) { snap(`add(${which}, ${i}, ${v}) is a no-op: r + 1 = ${i} is past n, so nothing needs cancelling.`, line, { op: o.text }); continue; }
            const touched = which === "B1" ? add(t1, d1, i, v) : add(t2, d2, i, v);
            for (const k of Object.keys(hl)) if (!k.startsWith("truth")) delete hl[k];
            hl[key(which === "B1" ? "d1" : "d2", i)] = "active";
            for (const tI of touched) hl[key(which === "B1" ? "t1" : "t2", tI)] = "active";
            snap(`${o.text}: add(${two ? which : "B"}, ${i}, ${v}). ${why} Fenwick path ${touched.join(" → ")}.`, line, { op: o.text, index: i, value: v });
          }
          for (let j = l; j <= r; j++) truth[j] += x;
          for (const k of Object.keys(hl)) if (!k.startsWith("truth")) delete hl[k];
          snap(`${o.text} done with ${two ? 4 : 2} point updates, no matter how long the range. The top row shows the array you are simulating; nobody stores it.`, 1, { op: o.text });
        } else {
          const ps = (i, mark, line) => {
            for (const k of Object.keys(hl)) if (hl[k] === mark && !k.startsWith("truth")) delete hl[k];
            const a1 = pre(t1, i), a2 = pre(t2, i);
            for (const tI of a1.touched) hl[key("t1", tI)] = mark;
            if (two) for (const tI of a2.touched) hl[key("t2", tI)] = mark;
            const v = two ? a1.s * i - a2.s : a1.s;
            return { v, a1, a2 };
          };
          hl = {};
          if (o.kind === "get" && !two) {
            hl[key("truth", l)] = "path";
            const { v, a1 } = ps(l, "done");
            outs.push({ op: o.text, v });
            snap(`get ${l} = prefix(B, ${l}) = d[1] + … + d[${l}] = <b>${v}</b> (blocks ${a1.touched.join(", ") || "none"}). A point value is a prefix sum of the differences.`, [4, 5], { op: o.text, answer: v }, { out: v });
          } else if (!two) {
            for (let j = l; j <= r; j++) hl[key("truth", j)] = "path";
            let s = 0; for (let j = l; j <= r; j++) s += pre(t1, j).s;
            outs.push({ op: o.text, v: s });
            snap(`${o.text} with one BIT needs ${r - l + 1} separate point queries (one per index): ${s}. That is O(len · log n). The second BIT exists to make this O(log n); switch the mode to see it.`, [4, 5], { op: o.text, answer: s }, { out: s });
          } else {
            const L = l, R = o.kind === "get" ? l : r;
            for (let j = L; j <= R; j++) hl[key("truth", j)] = "path";
            const A = ps(R, "done", 5);
            snap(`prefix_sum(${R}) = prefix(B1, ${R})·${R} − prefix(B2, ${R}) = ${A.a1.s}·${R} − ${A.a2.s} = <b>${A.v}</b>. Why: a[j] = d[1] + … + d[j], so in a[1..${R}] each d[j] is counted ${R} − j + 1 times = ${R}·d[j] − (j − 1)·d[j]. B1 supplies the first part, B2 the second.`, [4, 5], { op: o.text, "S1": A.a1.s, "S2": A.a2.s, "prefix_sum(r)": A.v });
            const B = ps(L - 1, "bad", 5);
            const v = A.v - B.v;
            outs.push({ op: o.text, v });
            snap(`prefix_sum(${L - 1}) = ${B.a1.s}·${L - 1} − ${B.a2.s} = ${B.v}. ${o.text} = ${A.v} − ${B.v} = <b>${v}</b>. Check it against the top row: the purple cells really do sum to ${v}.`, [6, 7], { op: o.text, "prefix_sum(r)": A.v, "prefix_sum(l-1)": B.v, answer: v }, { out: v });
          }
        }
      }
      fr[fr.length - 1].final = true;
      return fr;
    },
    render: (f) => {
      const row = (name, arr, label) => Viz.array(arr.slice(1, f.n + 1), { label, idxLabel: (j) => String(j + 1), cls: (j) => f.hl[`${name}:${j + 1}`] || "" });
      return col(
        row("truth", f.truth, "a: the array being simulated (not stored)"),
        row("d1", f.d1, f.two ? "d[j]: point values inside B1" : "d[j]: point values inside B"),
        row("t1", f.t1, f.two ? "B1 tree array t1[i]" : "B tree array t[i]"),
        f.two ? row("d2", f.d2, "d[j]·(j − 1): point values inside B2") : "",
        f.two ? row("t2", f.t2, "B2 tree array t2[i]") : "",
        f.outs.length ? `<div class="sft-outs">${f.outs.map((o) => `<span class="v-item done">${esc(o.op)} → ${esc(o.v)}</span>`).join("")}</div>` : "",
      );
    },
  }));

  /* =====================================================================
     4. Recursive segment tree: build, range query, point update
     ===================================================================== */
  const SEG_OPS = ["query(l, r)", "update(i, value)", "build"];
  Viz.register(P("segtree"), (el, opts) => Viz.player(el, {
    title: "Segment tree: every node owns a range; queries stop at covered nodes",
    tag: "BUILD · QUERY · UPDATE",
    legend: [["active", "current call"], ["visit", "partial overlap: split"], ["done", "fully inside: used whole / rebuilt"], ["dim", "disjoint: skipped"], ["path", "query range in the array"]],
    codeLang: "python",
    code: [
      "# f = add | min | max;  ID = 0 | inf | -inf",
      "def build(node, l, r):",
      "    if l == r: tree[node] = a[l]; return",
      "    m = (l + r) // 2",
      "    build(2*node, l, m); build(2*node+1, m+1, r)",
      "    tree[node] = f(tree[2*node], tree[2*node+1])",
      "def query(node, l, r, ql, qr):",
      "    if qr < l or r < ql: return ID       # disjoint",
      "    if ql <= l and r <= qr: return tree[node]  # inside",
      "    m = (l + r) // 2                     # partial",
      "    return f(query(2*node, l, m, ql, qr),",
      "             query(2*node+1, m+1, r, ql, qr))",
      "def update(node, l, r, i, val):",
      "    if l == r: tree[node] = val; return",
      "    m = (l + r) // 2",
      "    if i <= m: update(2*node, l, m, i, val)",
      "    else: update(2*node+1, m+1, r, i, val)",
      "    tree[node] = f(tree[2*node], tree[2*node+1])",
    ],
    inputs: [
      { key: "a", label: "a[0..n−1] (up to 16)", value: opts.a || "5,8,6,3,2,7,2,6,9,1,4,3", width: 260 },
      { key: "fn", label: "f", value: opts.fn || "sum", type: "select", options: ["sum", "min", "max"] },
      { key: "op", label: "operation", value: opts.op || SEG_OPS[0], type: "select", options: SEG_OPS },
      { key: "p1", label: "l or i", value: opts.p1 || "2", width: 46 },
      { key: "p2", label: "r or value", value: opts.p2 || "9", width: 56 },
    ],
    random: () => { const n = Viz.rand(6, 16), l = Viz.rand(0, n - 1); return { a: Viz.randInts(n, 0, 9).join(","), p1: String(l), p2: String(Viz.rand(l, n - 1)) }; },
    build: ({ a, fn, op, p1, p2 }) => {
      const A = ints(a, { min: 1, max: 16 }), n = A.length, F = FN[fn], shape = segShape(n);
      const kind = op.startsWith("query") ? "query" : op.startsWith("update") ? "update" : "build";
      const tree = {};
      const fr = [];
      let st = {}, tag = {};
      const snap = (note, line, vars, extra = {}) => fr.push({ shape, A: [...A], tree: { ...tree }, st: { ...st }, tag: { ...tag }, note, line, vars, ...extra });
      const nm = (id) => { const nd = shape.nodes[id]; return `#${id} [${nd.l}..${nd.r}]`; };
      if (kind === "build") {
        snap(`Build over n = ${n}. Node 1 owns [0..${n - 1}]; node k's children are 2k and 2k + 1 and split its range at the middle. The tree has ${shape.ids.length} nodes (2n − 1) and depth ⌈log₂ n⌉ = ${shape.maxD}. Values are filled bottom-up (post-order).`, [1], { n, nodes: shape.ids.length });
        const go = (node, l, r) => {
          if (l === r) { tree[node] = A[l]; st[node] = "done"; snap(`Leaf ${nm(node)}: tree[${node}] = a[${l}] = ${A[l]}.`, 2, { node, l, r, "tree[node]": A[l] }); return; }
          st[node] = "visit";
          const m = (l + r) >> 1;
          go(2 * node, l, m); go(2 * node + 1, m + 1, r);
          tree[node] = F.f(tree[2 * node], tree[2 * node + 1]); st[node] = "done";
          snap(`${nm(node)}: both halves are ready, tree[${node}] = ${fn}(${fm(tree[2 * node])}, ${fm(tree[2 * node + 1])}) = <b>${fm(tree[node])}</b>.`, [3, 4, 5], { node, l, r, m, "tree[node]": fm(tree[node]) });
        };
        go(1, 0, n - 1);
        snap(`Built in O(n): every node is computed once from its two children.`, 5, { nodes: shape.ids.length }, { final: true });
        return fr;
      }
      const pre = (node, l, r) => { if (l === r) { tree[node] = A[l]; return; } const m = (l + r) >> 1; pre(2 * node, l, m); pre(2 * node + 1, m + 1, r); tree[node] = F.f(tree[2 * node], tree[2 * node + 1]); };
      pre(1, 0, n - 1);
      if (kind === "query") {
        const ql = Viz.parse.int(p1, { min: 0, max: n - 1 }), qr = Viz.parse.int(p2, { min: ql, max: n - 1 });
        let visited = 0, used = 0;
        const base = { ql, qr };
        snap(`query(${ql}, ${qr}) asks for ${fn}(a[${ql}..${qr}]). Start at the root and ask each node one question: is my range disjoint from [${ql}..${qr}], fully inside it, or partly overlapping?`, 6, { ql, qr }, base);
        const go = (node, l, r) => {
          visited++;
          if (qr < l || r < ql) { st[node] = "dim"; snap(`${nm(node)} is <b>disjoint</b> from [${ql}..${qr}]: return ${fm(F.id)} (the identity) without looking inside.`, 7, { node, l, r, returns: fm(F.id), visited }, base); return F.id; }
          if (ql <= l && r <= qr) { st[node] = "done"; used++; snap(`${nm(node)} lies <b>fully inside</b> [${ql}..${qr}]: return tree[${node}] = ${fm(tree[node])} as one piece. Nothing below it is visited.`, 8, { node, l, r, returns: fm(tree[node]), visited }, base); return tree[node]; }
          st[node] = "active";
          snap(`${nm(node)} <b>partly overlaps</b> [${ql}..${qr}]: split at m = ${(l + r) >> 1} and ask both children.`, 9, { node, l, r, m: (l + r) >> 1, visited }, base);
          st[node] = "visit";
          const m = (l + r) >> 1;
          const x = go(2 * node, l, m), y = go(2 * node + 1, m + 1, r);
          const v = F.f(x, y);
          tag[node] = `↑ ${fm(v)}`;
          snap(`Back at ${nm(node)}: ${fn}(${fm(x)}, ${fm(y)}) = <b>${fm(v)}</b> goes up.`, [10, 11], { node, left: fm(x), right: fm(y), returns: fm(v), visited }, base);
          return v;
        };
        const res = go(1, 0, n - 1);
        let brute = F.id; for (let i = ql; i <= qr; i++) brute = F.f(brute, A[i]);
        snap(`Answer: <b>${fm(res)}</b> from ${used} fully covered node${used === 1 ? "" : "s"} (green) after ${visited} calls. A range splits into at most 2 covered nodes per level, so a query visits O(log n) nodes: at most 4 per level.`, [10, 11], { answer: fm(res), "covered nodes": used, calls: visited }, { ...base, res, final: true });
      } else {
        const i = Viz.parse.int(p1, { min: 0, max: n - 1 }), val = Viz.parse.int(p2, { min: -99, max: 99 });
        const base = { ui: i };
        snap(`update(${i}, ${val}): only the nodes whose range contains index ${i} can change, one per level, the root-to-leaf path.`, 12, { i, val }, base);
        const go = (node, l, r) => {
          if (l === r) { A[i] = val; tree[node] = val; st[node] = "active"; snap(`Leaf ${nm(node)}: tree[${node}] = ${val}.`, 13, { node, "tree[node]": val }, base); st[node] = "done"; return; }
          const m = (l + r) >> 1;
          st[node] = "active";
          snap(`${nm(node)}: ${i} ${i <= m ? "≤" : ">"} m = ${m}, so go ${i <= m ? "left" : "right"}. The other child cannot change.`, [14, i <= m ? 15 : 16], { node, l, r, m }, base);
          st[node] = "visit";
          if (i <= m) { st[2 * node + 1] = "dim"; go(2 * node, l, m); } else { st[2 * node] = "dim"; go(2 * node + 1, m + 1, r); }
          const old = tree[node];
          tree[node] = F.f(tree[2 * node], tree[2 * node + 1]); st[node] = "done";
          snap(`Pull up at ${nm(node)}: ${fn}(${fm(tree[2 * node])}, ${fm(tree[2 * node + 1])}) = <b>${fm(tree[node])}</b>${old !== tree[node] ? ` (was ${fm(old)})` : " (unchanged)"}.`, 17, { node, "tree[node]": fm(tree[node]) }, base);
        };
        go(1, 0, n - 1);
        snap(`Done: ${shape.maxD + 1} nodes rewritten, one per level: O(log n).`, 17, { rewritten: shape.maxD + 1 }, { ...base, final: true });
      }
      return fr;
    },
    render: (f) => segBars(f.shape, (id) => (id in f.tree ? f.tree[id] : "?"), (id) => f.st[id] || "", {
      n: f.shape.n,
      tag: (id) => f.tag[id] || "",
      label: "each bar is one node: #heap index · range, value in bold",
      foot: [
        { label: "a[i]", cells: f.A.map((v, j) => ({ t: v, cls: (f.ql !== undefined && j >= f.ql && j <= f.qr) || f.ui === j ? "path" : "" })) },
        { label: "i", small: true, cells: f.A.map((_, j) => ({ t: j })) },
      ],
    }),
  }));

  /* =====================================================================
     5. Lazy propagation: range add / range assign, tags pushed on demand
     ===================================================================== */
  const lzBase = [
    "def apply(node, l, r, x):      # node fully covered",
    "    tree[node] += x * (r - l + 1)",
    "    if l != r: lazy[node] += x  # owed to children",
    "def push(node, l, r):          # pay the debt first",
    "    if lazy[node]:",
    "        m = (l + r) // 2",
    "        apply(2*node, l, m, lazy[node])",
    "        apply(2*node+1, m+1, r, lazy[node])",
    "        lazy[node] = 0",
    "def update(node, l, r, ql, qr, x):",
    "    if qr < l or r < ql: return",
    "    if ql <= l and r <= qr: apply(node, l, r, x); return",
    "    push(node, l, r)",
    "    m = (l + r) // 2",
    "    update(2*node, l, m, ql, qr, x)",
    "    update(2*node+1, m+1, r, ql, qr, x)",
    "    tree[node] = tree[2*node] + tree[2*node+1]",
    "def query(node, l, r, ql, qr):",
    "    if qr < l or r < ql: return 0",
    "    if ql <= l and r <= qr: return tree[node]",
    "    push(node, l, r)",
    "    m = (l + r) // 2",
    "    return (query(2*node, l, m, ql, qr) +",
    "            query(2*node+1, m+1, r, ql, qr))",
  ];
  const lzWith = (patch) => lzBase.map((s, k) => (k in patch ? patch[k] : s));
  const LZP = {
    add: lzBase,
    assign: lzWith({ 1: "    tree[node] = x * (r - l + 1)", 2: "    if l != r: lazy[node] = x   # newest tag wins", 4: "    if lazy[node] is not None:", 8: "        lazy[node] = None" }),
    max: lzWith({ 1: "    tree[node] += x             # the max shifts by x", 16: "    tree[node] = max(tree[2*node], tree[2*node+1])", 18: "    if qr < l or r < ql: return -inf", 22: "    return max(query(2*node, l, m, ql, qr),", 23: "               query(2*node+1, m+1, r, ql, qr))" }),
  };
  const LZ_MODES = ["range add + range sum", "range assign + range sum", "range add + range max"];
  Viz.register(P("lazy"), (el, opts) => Viz.player(el, {
    title: "Lazy propagation: tag a covered node, push the tag down only when you must",
    tag: "RANGE UPDATE · RANGE QUERY",
    legend: [["active", "current call"], ["visit", "partial overlap"], ["done", "fully covered: tagged / used whole"], ["path", "child receiving a pushed tag"], ["dim", "disjoint: skipped"]],
    codeLang: "python",
    code: blank(Object.values(LZP)),
    inputs: [
      { key: "a", label: "a[0..n−1] (up to 16)", value: opts.a || "3,1,4,1,5,9,2,6,5,3", width: 230 },
      { key: "mode", label: "mode", value: opts.mode || LZ_MODES[0], type: "select", options: LZ_MODES },
      { key: "ops", label: "operations: add l r x · sum l r", value: opts.ops || "add 2 8 3; sum 0 4; add 0 6 -1; sum 3 5", width: 330 },
    ],
    random: () => {
      const n = Viz.rand(6, 16), ops = [];
      for (let k = 0; k < 4; k++) { const l = Viz.rand(0, n - 1), r = Viz.rand(l, n - 1); ops.push(k % 2 === 0 ? `add ${l} ${r} ${Viz.rand(-4, 6) || 2}` : `sum ${l} ${r}`); }
      return { a: Viz.randInts(n, 0, 9).join(","), ops: ops.join("; ") };
    },
    build: ({ a, mode, ops }) => {
      const A = ints(a, { min: 1, max: 16, lo: -20, hi: 20 }), n = A.length;
      const M = mode.includes("assign") ? "assign" : mode.includes("max") ? "max" : "add";
      setCode(el, LZP[M]);
      const prog = script(ops, {
        upd: { words: ["add", "set", "assign", "upd", "update", "u"], args: 3, example: M === "assign" ? "set 2 6 4" : "add 2 6 3" },
        qry: { words: ["sum", "max", "query", "q"], args: 2, example: M === "max" ? "max 0 5" : "sum 0 5" },
      }, { maxOps: 5 });
      for (const o of prog) {
        const [l, r, x] = o.nums;
        if (l < 0 || r < l || r >= n) throw new Error(`"${o.text}": indices must satisfy 0 ≤ l ≤ r ≤ ${n - 1}.`);
        if (o.kind === "upd" && Math.abs(x) > 20) throw new Error(`"${o.text}": keep x between -20 and 20.`);
      }
      const shape = segShape(n), tree = {}, lazy = {};
      const isMax = M === "max", comb = isMax ? (x, y) => Math.max(x, y) : (x, y) => x + y, ID = isMax ? -Infinity : 0;
      const qname = isMax ? "max" : "sum", uname = M === "assign" ? "assign" : "add";
      const pre = (node, l, r) => { if (l === r) { tree[node] = A[l]; return; } const m = (l + r) >> 1; pre(2 * node, l, m); pre(2 * node + 1, m + 1, r); tree[node] = comb(tree[2 * node], tree[2 * node + 1]); };
      pre(1, 0, n - 1);
      const truth = [...A];
      const fr = [], outs = [];
      let st = {}, cur = null;
      const nm = (id) => { const nd = shape.nodes[id]; return `#${id} [${nd.l}..${nd.r}]`; };
      const tagText = (x) => (M === "assign" ? `=${x}` : x >= 0 ? `+${x}` : `${x}`);
      const snap = (note, line, vars) => fr.push({ shape, M, tree: { ...tree }, lazy: { ...lazy }, st: { ...st }, truth: [...truth], cur, outs: [...outs], note, line, vars });
      const apply = (node, l, r, x) => {
        if (M === "add") tree[node] += x * (r - l + 1); else if (M === "assign") tree[node] = x * (r - l + 1); else tree[node] += x;
        if (l !== r) { lazy[node] = M === "assign" ? x : (lazy[node] ?? 0) + x; if (M !== "assign" && lazy[node] === 0) delete lazy[node]; }
      };
      const applyWhy = (node, l, r, x) => (M === "add" ? `tree[${node}] += ${x}·${r - l + 1} = ${fm(tree[node])}` : M === "assign" ? `tree[${node}] = ${x}·${r - l + 1} = ${tree[node]}` : `every value in [${l}..${r}] rises by ${x}, so the max does too: tree[${node}] = ${fm(tree[node])}`);
      const push = (node, l, r, qLine) => {
        if (lazy[node] === undefined) return;
        const x = lazy[node], m = (l + r) >> 1;
        apply(2 * node, l, m, x); apply(2 * node + 1, m + 1, r, x);
        delete lazy[node];
        st[2 * node] = "path"; st[2 * node + 1] = "path";
        snap(`${nm(node)} carries tag ${tagText(x)} and we need to look inside it, so <b>push</b> first: both children absorb ${tagText(x)} (their values become ${fm(tree[2 * node])} and ${fm(tree[2 * node + 1])}${l !== m || m + 1 !== r ? "; internal children keep the tag for later" : ""}) and the parent's tag is cleared. Without this, the children would be stale.`, [qLine, 3, 4, 5, 6, 7, 8], { node, pushed: tagText(x) });
        delete st[2 * node]; delete st[2 * node + 1];
      };
      snap(`Lazy segment tree in mode <b>${mode}</b>. Bars show tree[node]; a purple <b>tag</b> on a bar is an update that has been applied to that node but not yet to its children. The bottom row is the real array, which the tree never stores directly.`, 0, { n, mode: M });
      for (const o of prog) {
        const [ql, qr, x] = o.nums;
        st = {}; cur = o.text;
        if (o.kind === "upd") {
          snap(`<b>${uname}(${ql}, ${qr}, ${x})</b>: without laziness this touches ${qr - ql + 1} leaves and all their ancestors. With tags, it stops at the O(log n) nodes that cover [${ql}..${qr}].`, 9, { op: o.text });
          const go = (node, l, r) => {
            if (qr < l || r < ql) { st[node] = "dim"; return; }
            if (ql <= l && r <= qr) {
              apply(node, l, r, x); st[node] = "done";
              snap(`${nm(node)} is fully inside [${ql}..${qr}]: ${applyWhy(node, l, r, x)}${l !== r ? `, and leave tag ${tagText(lazy[node] ?? x)} for its ${r - l + 1 >= 2 ? "descendants" : "children"} instead of visiting them` : " (a leaf needs no tag)"}.`, [11, 0, 1, 2], { node, l, r, x });
              return;
            }
            st[node] = "active";
            if (lazy[node] !== undefined) push(node, l, r, 12);
            else snap(`${nm(node)} partly overlaps [${ql}..${qr}] and has no tag, so nothing to push: recurse into both halves.`, [12, 13], { node, l, r });
            st[node] = "visit";
            const m = (l + r) >> 1;
            go(2 * node, l, m); go(2 * node + 1, m + 1, r);
            tree[node] = comb(tree[2 * node], tree[2 * node + 1]);
            st[node] = "active";
            snap(`Pull up at ${nm(node)}: tree[${node}] = ${isMax ? "max" : ""}(${fm(tree[2 * node])}${isMax ? ", " : " + "}${fm(tree[2 * node + 1])}) = <b>${fm(tree[node])}</b>.`, 16, { node, "tree[node]": fm(tree[node]) });
            st[node] = "visit";
          };
          go(1, 0, n - 1);
          for (let i = ql; i <= qr; i++) truth[i] = M === "assign" ? x : truth[i] + x;
          snap(`${o.text} done. Tagged nodes: ${Object.keys(lazy).map((k) => `#${k} ${tagText(lazy[k])}`).join(", ") || "none"}. Their descendants are stale on purpose; they will be fixed the moment a later call needs to look inside.`, 9, { op: o.text, tags: Object.keys(lazy).length });
        } else {
          snap(`<b>${qname}(${ql}, ${qr})</b>: same three cases as a plain segment tree, plus one rule: <b>push before you descend</b>.`, 17, { op: o.text });
          let calls = 0;
          const go = (node, l, r) => {
            calls++;
            if (qr < l || r < ql) { st[node] = "dim"; return ID; }
            if (ql <= l && r <= qr) { st[node] = "done"; snap(`${nm(node)} is fully inside: its value ${fm(tree[node])} is already correct (its own tag only concerns its children), so use it whole.`, 19, { node, returns: fm(tree[node]) }); return tree[node]; }
            st[node] = "active";
            if (lazy[node] !== undefined) push(node, l, r, 20);
            else snap(`${nm(node)} partly overlaps [${ql}..${qr}]: no tag here, recurse.`, [20, 21], { node });
            st[node] = "visit";
            const m = (l + r) >> 1;
            const v = comb(go(2 * node, l, m), go(2 * node + 1, m + 1, r));
            return v;
          };
          const v = go(1, 0, n - 1);
          let brute = ID; for (let i = ql; i <= qr; i++) brute = comb(brute, truth[i]);
          outs.push({ op: o.text, v, brute });
          snap(`${o.text} = <b>${fm(v)}</b> after ${calls} calls. Check against the real array: ${fm(brute)}. ✓`, [22, 23], { op: o.text, answer: fm(v), calls });
        }
      }
      cur = null; st = {};
      snap(`Final state. Every update and every query cost O(log n), no matter how wide the range: covered nodes absorb the change in O(1) each, and a tag is pushed at most once per visit.`, 9, { tags: Object.keys(lazy).length });
      return fr;
    },
    render: (f) => {
      const tagT = (id) => (f.lazy[id] === undefined ? "" : `tag ${f.M === "assign" ? "=" : f.lazy[id] >= 0 ? "+" : ""}${f.lazy[id]}`);
      return col(
        segBars(f.shape, (id) => f.tree[id], (id) => f.st[id] || "", {
          n: f.shape.n,
          tag: tagT,
          label: `bars: tree[node]${f.cur ? ` · running: ${f.cur}` : ""}`,
          foot: [
            { label: "real a[i]", cells: f.truth.map((v) => ({ t: v })) },
            { label: "i", small: true, cells: f.truth.map((_, j) => ({ t: j })) },
          ],
        }),
        f.outs.length ? `<div class="sft-outs">${f.outs.map((o) => `<span class="v-item done">${esc(o.op)} → ${esc(fm(o.v))}</span>`).join("")}</div>` : "",
      );
    },
  }));

  /* =====================================================================
     6. Iterative (bottom-up) segment tree on a 2n array
     ===================================================================== */
  const itBase = [
    "t = [0] * n + a                # leaves t[n..2n-1]",
    "for i in range(n - 1, 0, -1):  # parents, right to left",
    "    t[i] = t[2*i] + t[2*i+1]",
    "def update(i, value):",
    "    i += n; t[i] = value",
    "    while i > 1:",
    "        i //= 2; t[i] = t[2*i] + t[2*i+1]",
    "def query(l, r):               # a[l:r], half-open",
    "    res = 0; l += n; r += n",
    "    while l < r:",
    "        if l & 1: res += t[l]; l += 1    # right child",
    "        if r & 1: r -= 1; res += t[r]    # left child",
    "        l //= 2; r //= 2",
    "    return res",
  ];
  const ITP = {
    sum: itBase,
    min: itBase.map((s, k) => ({ 2: "    t[i] = min(t[2*i], t[2*i+1])", 6: "        i //= 2; t[i] = min(t[2*i], t[2*i+1])", 8: "    res = inf; l += n; r += n", 10: "        if l & 1: res = min(res, t[l]); l += 1", 11: "        if r & 1: r -= 1; res = min(res, t[r])" }[k] ?? s)),
  };
  const IT_OPS = ["query [l, r)", "update(i, value)", "build"];
  Viz.register(P("iterative"), (el, opts) => Viz.player(el, {
    title: "Bottom-up segment tree: 2n cells, no recursion",
    tag: "ITERATIVE · HALF-OPEN",
    legend: [["active", "l / r − 1 being examined"], ["done", "taken into res / rebuilt"], ["visit", "children being combined"], ["path", "leaves of the query range"]],
    codeLang: "python",
    code: blank(Object.values(ITP)),
    inputs: [
      { key: "a", label: "a[0..n−1] (up to 16)", value: opts.a || "5,8,6,3,2,7,2,6,9,1", width: 230 },
      { key: "fn", label: "f", value: opts.fn || "sum", type: "select", options: ["sum", "min"] },
      { key: "op", label: "operation", value: opts.op || IT_OPS[0], type: "select", options: IT_OPS },
      { key: "p1", label: "l or i", value: opts.p1 || "1", width: 46 },
      { key: "p2", label: "r or value", value: opts.p2 || "8", width: 56 },
    ],
    random: () => { const n = Viz.rand(5, 16), l = Viz.rand(0, n - 1); return { a: Viz.randInts(n, 0, 9).join(","), p1: String(l), p2: String(Viz.rand(l + 1, n)) }; },
    build: ({ a, fn, op, p1, p2 }) => {
      const A = ints(a, { min: 1, max: 16 }), n = A.length, F = FN[fn];
      setCode(el, ITP[fn]);
      const kind = op.startsWith("query") ? "query" : op.startsWith("update") ? "update" : "build";
      const t = Array(2 * n).fill(null);
      for (let i = 0; i < n; i++) t[n + i] = A[i];
      const fr = [];
      let cls = {}, ptr = {};
      const snap = (note, line, vars, extra = {}) => fr.push({ n, t: [...t], cls: { ...cls }, ptr: { ...ptr }, note, line, vars, ...extra });
      if (kind === "build") {
        snap(`The whole tree lives in one array of 2n = ${2 * n} cells. Leaves a[0..${n - 1}] go to t[${n}..${2 * n - 1}]; node i has children 2i and 2i + 1; t[0] is never used. Rows below are heap levels (index 2^k to 2^(k+1) − 1).`, 0, { n });
        for (let i = n - 1; i >= 1; i--) {
          t[i] = F.f(t[2 * i], t[2 * i + 1]);
          cls = { [i]: "active", [2 * i]: "visit", [2 * i + 1]: "visit" };
          snap(`t[${i}] = ${fn}(t[${2 * i}], t[${2 * i + 1}]) = ${fn}(${fm(t[2 * i])}, ${fm(t[2 * i + 1])}) = <b>${fm(t[i])}</b>. Going right to left guarantees both children are already built.`, [1, 2], { i, "t[i]": fm(t[i]) });
        }
        cls = {};
        snap(`Built with n − 1 = ${n - 1} combines. When n is not a power of two some nodes mix leaves from different depths; the query loop below still works because it only relies on "node i's children are 2i and 2i + 1".`, 2, { n }, { final: true });
        return fr;
      }
      for (let i = n - 1; i >= 1; i--) t[i] = F.f(t[2 * i], t[2 * i + 1]);
      if (kind === "update") {
        const p = Viz.parse.int(p1, { min: 0, max: n - 1 }), v = Viz.parse.int(p2, { min: -99, max: 99 });
        let i = p + n;
        t[i] = v; cls = { [i]: "active" }; ptr = { i };
        snap(`update(${p}, ${v}): the leaf for a[${p}] is t[${p} + ${n}] = t[${i}]; set it to ${v}.`, [3, 4], { i, value: v });
        while (i > 1) {
          i >>= 1;
          t[i] = F.f(t[2 * i], t[2 * i + 1]);
          cls[i] = "active"; for (const k of Object.keys(cls)) if (+k !== i) cls[k] = "done";
          ptr = { i };
          snap(`i //= 2 → ${i}: recompute t[${i}] = ${fn}(t[${2 * i}], t[${2 * i + 1}]) = <b>${fm(t[i])}</b>.`, [5, 6], { i, "t[i]": fm(t[i]) });
        }
        cls[1] = "done";
        snap(`Reached the root: ${Object.keys(cls).length} cells rewritten, O(log n).`, 5, { rewritten: Object.keys(cls).length }, { final: true });
        return fr;
      }
      const L0 = Viz.parse.int(p1, { min: 0, max: n - 1 }), R0 = Viz.parse.int(p2, { min: L0 + 1, max: n });
      let l = L0 + n, r = R0 + n, res = F.id;
      ptr = { l, r };
      snap(`query(${L0}, ${R0}) = ${fn}(a[${L0}:${R0}]), half-open. Move both ends to the leaf level: l = ${l}, r = ${r}. Invariant: the answer = res combined with ${fn}(t[l:r]) on the current level.`, [7, 8], { l, r, res: fm(res) }, { L0, R0 });
      while (l < r) {
        const took = [];
        if (l & 1) { res = F.f(res, t[l]); took.push(l); cls[l] = "done"; ptr = { l, r }; snap(`l = ${l} is odd, a <b>right child</b>: its parent also covers t[${l - 1}], which is outside the range. So take t[${l}] = ${fm(t[l])} by itself (res = ${fm(res)}) and step l right.`, 10, { l, r, res: fm(res) }, { L0, R0, act: [l] }); l++; }
        if (r & 1) { r--; res = F.f(res, t[r]); took.push(r); cls[r] = "done"; ptr = { l, r }; snap(`r = ${r + 1} is odd, so t[${r}] (just inside the open end) is a <b>left child</b> whose parent sticks out past r. Take t[${r}] = ${fm(t[r])} (res = ${fm(res)}) and move r left to ${r}.`, 11, { l, r, res: fm(res) }, { L0, R0, act: [r] }); }
        if (!took.length) snap(`l = ${l} even, r = ${r} even: [l, r) is made of whole sibling pairs, so nothing needs taking at this level.`, [10, 11], { l, r, res: fm(res) }, { L0, R0 });
        l >>= 1; r >>= 1;
        ptr = { l, r };
        snap(`Climb one level: l = ${l}, r = ${r}. ${l < r ? `t[${l}..${r - 1}] are the parents that exactly cover what is left.` : "l ≥ r: nothing left."}`, 12, { l, r, res: fm(res) }, { L0, R0 });
      }
      let brute = F.id; for (let i = L0; i < R0; i++) brute = F.f(brute, A[i]);
      snap(`Return <b>${fm(res)}</b> (brute force: ${fm(brute)}). Each level contributes at most two cells, so the loop is O(log n), with no recursion and no 4n array.`, 13, { res: fm(res) }, { L0, R0, res, final: true });
      return fr;
    },
    render: (f) => {
      const n = f.n, rows = [];
      const rowOf = (x) => (x >= 2 * n ? -1 : Math.floor(Math.log2(x)));
      const levels = Math.floor(Math.log2(2 * n - 1)) + 1;
      for (let k = 0; k < levels; k++) {
        const lo = Math.max(1, 1 << k), hi = Math.min((1 << (k + 1)) - 1, 2 * n - 1);
        if (lo > hi) continue;
        const vals = [], ptrs = {};
        for (let i = lo; i <= hi; i++) vals.push(f.t[i]);
        for (const [name, x] of Object.entries(f.ptr)) { if (x < 1) continue; const rk = rowOf(x); if (rk === k || (rk === -1 && k === levels - 1)) ptrs[name] = x - lo; }
        rows.push(Viz.array(vals, {
          ptrs,
          idxLabel: (j) => (lo + j >= n ? `${lo + j}·a${lo + j - n}` : String(lo + j)),
          cls: (j) => f.cls[lo + j] || (f.act && f.act.includes(lo + j) ? "active" : "") || (f.L0 !== undefined && lo + j >= f.L0 + n && lo + j < f.R0 + n ? "path" : ""),
          fmt: (v) => fm(v),
        }));
      }
      return `<div class="sft-col sft-levels"><span class="v-caption">t[1..${2 * n - 1}] drawn level by level (index under each cell; leaves show i·a[j])</span>${rows.join("")}</div>`;
    },
  }));

  /* =====================================================================
     7. Sparse table: O(1) idempotent range queries
     ===================================================================== */
  const gcd = (x, y) => { x = Math.abs(x); y = Math.abs(y); while (y) [x, y] = [y, x % y]; return x; };
  const SP_FN = { min: (x, y) => Math.min(x, y), max: (x, y) => Math.max(x, y), gcd, "sum (breaks: overlap)": (x, y) => x + y };
  Viz.register(P("sparse"), (el, opts) => Viz.player(el, {
    title: "Sparse table: precompute power-of-two blocks, answer with two that overlap",
    tag: "RMQ · O(1) QUERY",
    legend: [["active", "cell being built / block A"], ["visit", "cells it reads / block B"], ["done", "row finished"], ["bad", "counted twice (only harmful for sum)"], ["path", "query range"]],
    codeLang: "python",
    code: [
      "LOG = n.bit_length()",
      "st = [a[:]]                # st[k][i] = f(a[i : i + 2**k])",
      "for k in range(1, LOG):",
      "    half = 1 << (k - 1)",
      "    st.append([f(st[k-1][i], st[k-1][i + half])",
      "               for i in range(n - (1 << k) + 1)])",
      "def query(l, r):           # inclusive, O(1)",
      "    k = (r - l + 1).bit_length() - 1   # 2**k <= len",
      "    return f(st[k][l], st[k][r - (1 << k) + 1])",
    ],
    inputs: [
      { key: "a", label: "a[0..n−1] (up to 16)", value: opts.a || "4,7,1,8,3,9,2,6,5,8,1,7,3", width: 260 },
      { key: "fn", label: "f", value: opts.fn || "min", type: "select", options: Object.keys(SP_FN) },
      { key: "l", label: "l", value: opts.l || "2", width: 46 },
      { key: "r", label: "r", value: opts.r || "10", width: 46 },
    ],
    random: () => { const n = Viz.rand(6, 16), l = Viz.rand(0, n - 1); return { a: Viz.randInts(n, 1, 20).join(","), l: String(l), r: String(Viz.rand(l, n - 1)) }; },
    build: ({ a, fn, l, r }) => {
      const A = ints(a, { min: 1, max: 16 }), n = A.length, f = SP_FN[fn], isSum = fn.startsWith("sum");
      const ql = Viz.parse.int(l, { min: 0, max: n - 1 }), qr = Viz.parse.int(r, { min: ql, max: n - 1 });
      const LOG = n.toString(2).length;
      const st = [[...A]];
      const fr = [];
      const snap = (note, line, vars, extra = {}) => fr.push({ n, A, LOG, st: st.map((row) => [...row]), note, line, vars, ...extra });
      snap(`Row k = 0 is the array itself: st[0][i] covers the single cell a[i]. Row k will hold f over every block of length 2<sup>k</sup>. n = ${n}, so LOG = ${LOG} rows.`, [0, 1], { n, LOG }, { rowDone: 0 });
      for (let k = 1; k < LOG; k++) {
        const half = 1 << (k - 1), row = [];
        for (let i = 0; i + (1 << k) <= n; i++) row.push(f(st[k - 1][i], st[k - 1][i + half]));
        st.push(row);
        const ex = Math.min(row.length - 1, Math.floor(row.length / 2));
        snap(`Row k = ${k}: blocks of length ${1 << k}. Each is two blocks of length ${half} from the row above. Example: st[${k}][${ex}] = ${fn.split(" ")[0]}(st[${k - 1}][${ex}], st[${k - 1}][${ex + half}]) = ${fn.split(" ")[0]}(${st[k - 1][ex]}, ${st[k - 1][ex + half]}) = <b>${row[ex]}</b>, covering a[${ex}..${ex + (1 << k) - 1}].`, [2, 3, 4, 5], { k, half, cells: row.length }, { rowDone: k, cell: [k, ex], deps: [[k - 1, ex], [k - 1, ex + half]] });
      }
      const len = qr - ql + 1, k = len.toString(2).length - 1, j = qr - (1 << k) + 1;
      const res = f(st[k][ql], st[k][j]);
      let brute = A[ql]; for (let i = ql + 1; i <= qr; i++) brute = f(brute, A[i]);
      const over = Math.max(0, ql + (1 << k) - j);
      const q = { ql, qr, k, j };
      snap(`Table done: O(n log n) cells. Query [${ql}..${qr}]: length ${len}; the biggest power of two that fits is 2<sup>${k}</sup> = ${1 << k} (k = bit_length − 1).`, [6, 7], { l: ql, r: qr, len, k }, { ...q, rowDone: LOG - 1 });
      snap(`Block A = st[${k}][${ql}] covers a[${ql}..${ql + (1 << k) - 1}] from the left; block B = st[${k}][${j}] covers a[${j}..${qr}] from the right. Together they cover [${ql}..${qr}] exactly${over ? `, overlapping on ${over} cell${over > 1 ? "s" : ""}` : " with no overlap (len is a power of two)"}.`, 8, { A: st[k][ql], B: st[k][j], overlap: over }, { ...q, rowDone: LOG - 1, blocks: true });
      snap(isSum
        ? `${fn.split(" ")[0]}(${st[k][ql]}, ${st[k][j]}) = <b>${res}</b>, but the true sum is ${brute}. ${over ? `The ${over} overlapping cell${over > 1 ? "s were" : " was"} counted twice (red). Overlap is only safe when f(x, x) = x (min, max, gcd, and, or). For sums use prefix sums or a Fenwick tree.` : "This time len is a power of two, so there is no overlap and the sum happens to be right."}`
        : `${fn}(${st[k][ql]}, ${st[k][j]}) = <b>${res}</b> (brute force: ${brute}). The overlap is harmless because ${fn}(x, x) = x: counting a cell twice cannot change a ${fn}. Two lookups, O(1), no matter how long the range.`,
        8, { answer: res, brute }, { ...q, rowDone: LOG - 1, blocks: true, res, brute, isSum, final: true });
      return fr;
    },
    render: (f) => {
      const m = f.st.map((row) => Array.from({ length: f.n }, (_, i) => (i < row.length ? row[i] : "")));
      const grid = Viz.grid(m, {
        label: "st[k][i] = f over a[i .. i + 2^k − 1]",
        rowLabels: m.map((_, k) => `k=${k} (${1 << k})`),
        colLabels: f.A.map((_, i) => String(i)),
        corner: "i →",
        cls: (r, c) => {
          if (c >= f.st[r].length) return "sft-na";
          if (f.blocks && r === f.k && c === f.ql) return "active";
          if (f.blocks && r === f.k && c === f.j) return "visit";
          if (f.cell && f.cell[0] === r && f.cell[1] === c) return "active";
          if (f.deps && f.deps.some(([x, y]) => x === r && y === c)) return "visit";
          if (!f.blocks && f.cell && r === f.cell[0]) return "done";
          return "";
        },
      });
      if (f.k === undefined) return col(grid);
      const items = f.blocks ? [
        { l: f.ql, r: f.ql + (1 << f.k) - 1, row: 0, main: `A = ${f.st[f.k][f.ql]}`, sub: `st[${f.k}][${f.ql}]`, cls: "active" },
        { l: f.j, r: f.qr, row: 1, main: `B = ${f.st[f.k][f.j]}`, sub: `st[${f.k}][${f.j}]`, cls: "visit" },
      ] : [];
      const times = f.A.map((_, i) => (f.blocks ? (i >= f.ql && i <= f.ql + (1 << f.k) - 1 ? 1 : 0) + (i >= f.j && i <= f.qr ? 1 : 0) : 0));
      const bars = rangeBars(f.n, ["block A", "block B"], items, {
        label: "the two blocks laid over the array",
        foot: [
          { label: "a[i]", cells: f.A.map((v, i) => ({ t: v, cls: i >= f.ql && i <= f.qr ? "path" : "" })) },
          { label: "covered", small: true, cells: times.map((c) => ({ t: c ? `${c}×` : "", cls: c === 2 ? (f.isSum ? "bad" : "visit") : "" })) },
          { label: "i", small: true, cells: f.A.map((_, i) => ({ t: i })) },
        ],
      });
      return col(grid, bars);
    },
  }));

  /* =====================================================================
     8. Counting with a Fenwick tree over ranks (LC 315, inversions, LC 493)
     ===================================================================== */
  const smBase = [
    "rank = {v: k + 1 for k, v in enumerate(sorted(set(nums)))}",
    "t = [0] * (len(rank) + 1)        # Fenwick over ranks",
    "ans = [0] * n",
    "for i in range(n - 1, -1, -1):   # right to left",
    "    r = rank[nums[i]]",
    "    ans[i] = prefix(t, r - 1)    # seen and strictly smaller",
    "    add(t, r, 1)                 # nums[i] is now 'seen'",
    "return ans",
  ];
  const SMP = {
    smaller: smBase,
    inv: smBase.map((s, k) => ({ 2: "inv = 0", 5: "    inv += prefix(t, r - 1)      # pairs (i, j>i), a[j]<a[i]", 7: "return inv" }[k] ?? s)),
    rev: [
      "vals = sorted(set(2 * v for v in nums))   # what we insert",
      "t = [0] * (len(vals) + 1)",
      "count = 0",
      "for i in range(n - 1, -1, -1):",
      "    k = bisect_left(vals, nums[i])   # ranks 1..k: 2v < nums[i]",
      "    count += prefix(t, k)",
      "    add(t, bisect_left(vals, 2 * nums[i]) + 1, 1)",
      "return count",
    ],
  };
  const SM_MODES = ["count smaller after self (LC 315)", "count inversions", "reverse pairs (LC 493)"];
  Viz.register(P("smaller"), (el, opts) => Viz.player(el, {
    title: "Counting pairs with a Fenwick tree over value ranks",
    tag: "COMPRESS · SCAN · COUNT",
    legend: [["active", "current element / Fenwick node written"], ["visit", "already inserted (to the right)"], ["done", "counted by the prefix query"], ["path", "Fenwick nodes read"]],
    codeLang: "python",
    code: blank(Object.values(SMP)),
    inputs: [
      { key: "nums", label: "nums (up to 12, −50..50)", value: opts.nums || "5,2,6,1,3,2,7,4", width: 260 },
      { key: "mode", label: "problem", value: opts.mode || SM_MODES[0], type: "select", options: SM_MODES },
    ],
    random: () => ({ nums: Viz.randInts(Viz.rand(5, 12), -9, 20).join(",") }),
    build: ({ nums, mode }) => {
      const a = ints(nums, { min: 1, max: 12, lo: -50, hi: 50 }), n = a.length;
      const M = mode.startsWith("count smaller") ? "smaller" : mode.startsWith("count inv") ? "inv" : "rev";
      setCode(el, SMP[M]);
      const vals = [...new Set(M === "rev" ? a.map((v) => 2 * v) : a)].sort((x, y) => x - y), m = vals.length;
      const bl = (x) => { let lo = 0, hi = m; while (lo < hi) { const mid = (lo + hi) >> 1; if (vals[mid] < x) lo = mid + 1; else hi = mid; } return lo; };
      const t = Array(m + 1).fill(0), cnt = Array(m + 1).fill(0), ans = Array(n).fill(null);
      let total = 0;
      const fr = [];
      const snap = (note, line, vars, extra = {}) => fr.push({ M, a, vals, n, m, t: [...t], cnt: [...cnt], ans: [...ans], total, note, line, vars, ...extra });
      snap(M === "rev"
        ? `Reverse pairs: count i &lt; j with nums[i] &gt; 2·nums[j]. Scan right to left and insert <b>2·nums[j]</b>; for each nums[i], count inserted values strictly below it. Values can be huge or negative, so first <b>compress</b> the ${m} distinct doubled values to ranks 1..${m}.`
        : `Scan right to left. Everything already in the Fenwick tree lies to the right of i, so "how many of them are smaller than nums[i]" is a prefix count over value ranks. First <b>compress</b>: the ${m} distinct values get ranks 1..${m}, so the tree has ${m} slots no matter how big the values are.`, [0, 1, 2], { n, distinct: m });
      for (let i = n - 1; i >= 0; i--) {
        const k = bl(a[i]);
        let s = 0; const read = [];
        for (let x = k; x > 0; x -= lowbit(x)) { s += t[x]; read.push(x); }
        if (M === "smaller") ans[i] = s; total += s;
        snap(`i = ${i}, nums[i] = ${a[i]}. ${M === "rev" ? `Inserted values below ${a[i]} have ranks 1..${k}` : `Its rank is ${k + 1}, so smaller values have ranks 1..${k}`}: prefix(${k}) reads Fenwick nodes ${read.join(", ") || "(none)"} = <b>${s}</b>. ${M === "smaller" ? `ans[${i}] = ${s}.` : `Running total ${total}.`}`, [3, 4, 5], { i, "nums[i]": a[i], k, found: s, total }, { i, read, pre: k });
        const r = (M === "rev" ? bl(2 * a[i]) : k) + 1, wrote = [];
        for (let x = r; x <= m; x += lowbit(x)) { t[x]++; wrote.push(x); }
        cnt[r]++;
        snap(`Insert ${M === "rev" ? `2·${a[i]} = ${2 * a[i]}` : a[i]} at rank ${r}: add(${r}, 1) touches Fenwick nodes ${wrote.join(" → ")}. Now it counts for every element further left.`, 6, { i, rank: r, total }, { i, wrote, ins: r });
      }
      snap(M === "smaller" ? `ans = [${ans.join(", ")}]. n prefix queries and n updates: O(n log n), plus O(n log n) for the sort that compresses.` : `${M === "inv" ? "Inversions" : "Reverse pairs"} = <b>${total}</b>. O(n log n), the same bound as the merge-sort solution, but the scan is online: it works on a stream from the right.`, 7, { answer: M === "smaller" ? `[${ans.join(",")}]` : total }, { i: -1, final: true });
      return fr;
    },
    render: (f) => {
      const numsRow = Viz.array(f.a, { label: "nums", ptrs: f.i >= 0 ? { i: f.i } : {}, cls: (j) => (j === f.i ? "active" : f.i === -1 || j > f.i ? "visit" : "") });
      const ansRow = f.M === "smaller" ? Viz.array(f.ans, { label: "ans", fmt: (v) => fm(v), cls: (j) => (j === f.i && f.read ? "done" : "") }) : "";
      const cntRow = Viz.array(f.cnt.slice(1), { label: `how many inserted values have each rank (${f.M === "rev" ? "2·value" : "value"} under the cell)`, idxLabel: (j) => String(f.vals[j]), cls: (j) => (f.ins === j + 1 ? "active" : f.read && j + 1 <= f.pre ? "done" : "") });
      const tRow = Viz.array(f.t.slice(1), { label: "Fenwick array t[1..m]", idxLabel: (j) => String(j + 1), cls: (j) => (f.wrote && f.wrote.includes(j + 1) ? "active" : f.read && f.read.includes(j + 1) ? "path" : "") });
      const tot = f.M !== "smaller" ? `<div class="sft-outs"><span class="v-item done">${f.M === "inv" ? "inversions" : "reverse pairs"} so far: ${f.total}</span></div>` : "";
      return col(Viz.row(numsRow, ansRow), cntRow, tRow, tot);
    },
  }));

  /* =====================================================================
     9. Fenwick descent: k-th smallest / lower_bound on prefix sums in O(log n)
     ===================================================================== */
  Viz.register(P("descend"), (el, opts) => Viz.player(el, {
    title: "Walking down a Fenwick tree: the k-th smallest in O(log n)",
    tag: "ORDER STATISTICS",
    legend: [["active", "block being tested"], ["done", "skipped whole: all below k"], ["bad", "too big or past n: the answer is inside"], ["path", "answer"]],
    codeLang: "python",
    code: [
      "def kth(k):                # smallest i with prefix(i) >= k",
      "    pos = 0                # invariant: prefix(pos) < k",
      "    for s in reversed(range(LOG + 1)):  # 2**LOG <= n",
      "        nxt = pos + (1 << s)",
      "        if nxt <= n and t[nxt] < k:     # block fits",
      "            pos = nxt                   # skip it whole",
      "            k -= t[nxt]",
      "    return pos + 1",
    ],
    inputs: [
      { key: "vals", label: "multiset of values in 1..16", value: opts.vals || "3,7,7,2,12,9,7,15,5,10,14", width: 280 },
      { key: "k", label: "k", value: opts.k || "6", width: 46 },
    ],
    random: () => { const c = Viz.rand(4, 14); return { vals: Viz.randInts(c, 1, 16).join(","), k: String(Viz.rand(1, c)) }; },
    build: ({ vals, k }) => {
      const V = ints(vals, { min: 1, max: 24, lo: 1, hi: 16, name: "multiset" }), n = 16, LOG = 4;
      const K0 = Viz.parse.int(k, { min: 1, max: V.length });
      const cnt = Array(n + 1).fill(0); for (const v of V) cnt[v]++;
      const t = fenNaive(cnt, n);
      const fr = [], st = {};
      let pos = 0, kk = K0;
      const snap = (note, line, vars, extra = {}) => fr.push({ n, t, cnt, st: { ...st }, pos, note, line, vars, ...extra });
      snap(`cnt[v] = how many copies of v are in the multiset, and t is its Fenwick tree. The k-th smallest is the first index whose prefix count reaches k = ${K0}. Binary search over prefix(i) would cost O(log² n); walking down the tree costs O(log n), because block t[pos + 2^s] is exactly a[pos + 1 .. pos + 2^s] whenever pos is a multiple of 2^(s+1).`, [0, 1], { k: K0, pos });
      for (let s = LOG; s >= 0; s--) {
        const nxt = pos + (1 << s);
        if (nxt <= n && t[nxt] < kk) {
          st[nxt] = "active";
          snap(`s = ${s}: test t[${nxt}] = ${t[nxt]}, the count in values ${pos + 1}..${nxt}. ${t[nxt]} &lt; k = ${kk}, so the k-th smallest is further right: skip the whole block.`, [2, 3, 4], { s, nxt, "t[nxt]": t[nxt], k: kk, pos });
          kk -= t[nxt]; pos = nxt; st[nxt] = "done";
          snap(`pos = ${pos}, k = ${kk} left to find beyond value ${pos}.`, [5, 6], { s, pos, k: kk });
        } else {
          if (nxt <= n) st[nxt] = "active";
          snap(nxt > n ? `s = ${s}: pos + ${1 << s} = ${nxt} is past n = ${n}; try a smaller step.` : `s = ${s}: t[${nxt}] = ${t[nxt]} ≥ k = ${kk}, so the k-th smallest is inside values ${pos + 1}..${nxt}. Do not move; halve the step.`, [2, 3, 4], { s, nxt, ...(nxt <= n ? { "t[nxt]": t[nxt] } : {}), k: kk, pos });
          if (nxt <= n) st[nxt] = "bad";
        }
      }
      const sorted = [...V].sort((x, y) => x - y);
      snap(`Answer: value <b>${pos + 1}</b> (sorted multiset: ${sorted.join(", ")}; element #${K0} is ${sorted[K0 - 1]}). ${LOG + 1} tests, one per bit: O(log n).`, 7, { answer: pos + 1 }, { ans: pos + 1, final: true });
      return fr;
    },
    render: (f) => fenBars(f.n, f.t, (i) => (f.ans === i ? "path" : f.st[i] || ""), {
      label: "Fenwick blocks over the counts (t[i] in bold)",
      foot: [
        { label: "cnt[v]", cells: Array.from({ length: f.n }, (_, j) => ({ t: f.cnt[j + 1], cls: f.ans === j + 1 ? "path" : j + 1 <= f.pos ? "done" : "" })) },
        { label: "v", small: true, cells: Array.from({ length: f.n }, (_, j) => ({ t: j + 1 })) },
      ],
    }),
  }));

  /* =====================================================================
     10. Rectangle Area II: sweep line + cover-count segment tree
     ===================================================================== */
  Viz.register(P("area"), (el, opts) => Viz.player(el, {
    title: "Union of rectangles: sweep x, segment tree of covered y-length",
    tag: "SWEEP · COVER COUNT · NO PUSH-DOWN",
    legend: [["active", "current event"], ["done", "count changed here"], ["visit", "partial: recomputed from children"], ["dim", "untouched"]],
    codeLang: "python",
    code: [
      "def update(node, l, r, ql, qr, d):   # segments l..r",
      "    if qr < l or r < ql: return",
      "    if ql <= l and r <= qr: cnt[node] += d",
      "    else:",
      "        m = (l + r) // 2",
      "        update(2*node, l, m, ql, qr, d)",
      "        update(2*node+1, m+1, r, ql, qr, d)",
      "    if cnt[node] > 0: cov[node] = ys[r+1] - ys[l]",
      "    elif l == r: cov[node] = 0",
      "    else: cov[node] = cov[2*node] + cov[2*node+1]",
      "area, prev = 0, events[0][0]",
      "for x, d, y1, y2 in events:          # sorted by x",
      "    area += cov[1] * (x - prev); prev = x",
      "    update(1, 0, len(ys) - 2, iy[y1], iy[y2] - 1, d)",
    ],
    inputs: [{ key: "rects", label: "rectangles x1 y1 x2 y2 (up to 5, coords 0..20)", value: opts.rects || "1 1 6 5; 3 3 9 8; 7 0 10 4; 4 6 12 9", width: 420 }],
    random: () => {
      const k = Viz.rand(2, 5), out = [];
      for (let i = 0; i < k; i++) { const x1 = Viz.rand(0, 14), y1 = Viz.rand(0, 12); out.push(`${x1} ${y1} ${x1 + Viz.rand(2, 6)} ${y1 + Viz.rand(2, 6)}`); }
      return { rects: out.join("; ") };
    },
    build: ({ rects }) => {
      const parts = String(rects).split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
      if (!parts.length || parts.length > 5) throw new Error("Use between 1 and 5 rectangles separated by semicolons.");
      const R = parts.map((p) => {
        const v = p.split(/[\s,]+/).filter(Boolean).map(Number);
        if (v.length !== 4 || v.some((x) => !Number.isInteger(x) || x < 0 || x > 20)) throw new Error(`"${p}" must be four whole numbers 0..20: x1 y1 x2 y2.`);
        if (v[0] >= v[2] || v[1] >= v[3]) throw new Error(`"${p}": use x1 < x2 and y1 < y2.`);
        return v;
      });
      const ys = [...new Set(R.flatMap((r) => [r[1], r[3]]))].sort((x, y) => x - y), S = ys.length - 1;
      const iy = (y) => ys.indexOf(y);
      const ev = [];
      R.forEach((r, k) => { ev.push({ x: r[0], d: 1, y1: r[1], y2: r[3], k }); ev.push({ x: r[2], d: -1, y1: r[1], y2: r[3], k }); });
      ev.sort((p, q) => p.x - q.x || q.d - p.d);
      const shape = segShape(S), cnt = {}, cov = {};
      for (const id of shape.ids) { cnt[id] = 0; cov[id] = 0; }
      const segCnt = Array(S).fill(0), strips = [];
      let area = 0, prev = ev[0].x, st = {}, cur = null, sweep = prev;
      const fr = [];
      const snap = (note, line, vars) => fr.push({ R, ys, S, shape, cnt: { ...cnt }, cov: { ...cov }, segCnt: [...segCnt], strips: strips.map((s) => ({ ...s })), st: { ...st }, cur, sweep, area, note, line, vars });
      snap(`${R.length} rectangle${R.length > 1 ? "s" : ""}, ${ev.length} vertical edges (events). The y edges cut the axis into ${S} elementary segment${S > 1 ? "s" : ""}: ${ys.slice(0, -1).map((y, k) => `[${y},${ys[k + 1]})`).join(" ")}. A segment tree over those segments keeps cov[1] = total y-length covered by at least one open rectangle.`, [10], { events: ev.length, segments: S });
      for (const e of ev) {
        const dx = e.x - prev;
        sweep = e.x; cur = e; st = {};
        if (dx > 0 && cov[1] > 0) {
          const ivs = []; for (let k = 0; k < S; k++) if (segCnt[k] > 0) { if (ivs.length && ivs[ivs.length - 1][1] === ys[k]) ivs[ivs.length - 1][1] = ys[k + 1]; else ivs.push([ys[k], ys[k + 1]]); }
          strips.push({ x0: prev, x1: e.x, ivs });
        }
        area += cov[1] * dx;
        snap(`Sweep to x = ${e.x}. Between x = ${prev} and ${e.x} the covered y-length stayed cov[1] = ${cov[1]}, so area += ${cov[1]} × ${dx} = ${cov[1] * dx}. Total ${area}.`, [11, 12], { x: e.x, "cov[1]": cov[1], dx, area });
        prev = e.x;
        const ql = iy(e.y1), qr = iy(e.y2) - 1;
        const go = (node, l, r) => {
          if (qr < l || r < ql) { st[node] = "dim"; return; }
          if (ql <= l && r <= qr) { cnt[node] += e.d; st[node] = "done"; }
          else { st[node] = "visit"; const m = (l + r) >> 1; go(2 * node, l, m); go(2 * node + 1, m + 1, r); }
          cov[node] = cnt[node] > 0 ? ys[r + 1] - ys[l] : l === r ? 0 : cov[2 * node] + cov[2 * node + 1];
        };
        go(1, 0, S - 1);
        for (let k = ql; k <= qr; k++) segCnt[k] += e.d;
        snap(`Rectangle ${e.k + 1} ${e.d > 0 ? "opens" : "closes"} on y ∈ [${e.y1}, ${e.y2}) = segments ${ql}..${qr}: cnt ${e.d > 0 ? "+1" : "−1"} on the ${Object.values(st).filter((c) => c === "done").length} node(s) that cover it (green). Their ancestors recompute cov on the way back. No push-down is ever needed: cnt is only read at its own node, and a −1 always matches an earlier +1 on exactly the same nodes. cov[1] = <b>${cov[1]}</b>.`, [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 13], { x: e.x, d: e.d, segments: `${ql}..${qr}`, "cov[1]": cov[1], area });
      }
      cur = null; st = {};
      snap(`All edges processed: union area = <b>${area}</b>. ${ev.length} events × O(log n) each = O(n log n) after sorting, versus O(n²) for scanning every segment per event.`, 12, { area }, {});
      fr[fr.length - 1].final = true;
      return fr;
    },
    render: (f) => {
      const W = Math.max(...f.R.map((r) => r[2])), H = Math.max(...f.R.map((r) => r[3]));
      const sc = Math.min(24, 400 / Math.max(W, H, 1)), px = 34, py = 14;
      const X = (x) => px + x * sc, Y = (y) => py + (H - y) * sc;
      let g = "";
      for (const y of f.ys) g += `<line class="sft-gl" x1="${X(0)}" x2="${X(W)}" y1="${Y(y)}" y2="${Y(y)}"/><text class="sft-ax" x="${px - 6}" y="${Y(y)}" text-anchor="end" dominant-baseline="central">${y}</text>`;
      for (const s of f.strips) for (const [a, b] of s.ivs) g += `<rect class="sft-swept" x="${X(s.x0)}" y="${Y(b)}" width="${(s.x1 - s.x0) * sc}" height="${(b - a) * sc}"/>`;
      f.R.forEach((r, k) => { g += `<rect class="sft-rect${f.cur && f.cur.k === k ? " cur" : ""}" x="${X(r[0])}" y="${Y(r[3])}" width="${(r[2] - r[0]) * sc}" height="${(r[3] - r[1]) * sc}"/><text class="sft-rl2" x="${X(r[0]) + 4}" y="${Y(r[3]) + 12}">${k + 1}</text>`; });
      const xs = [...new Set(f.R.flatMap((r) => [r[0], r[2]]))];
      for (const x of xs) g += `<text class="sft-ax" x="${X(x)}" y="${Y(0) + 14}" text-anchor="middle">${x}</text>`;
      if (f.cur) {
        g += `<line class="sft-sweep" x1="${X(f.sweep)}" x2="${X(f.sweep)}" y1="${Y(H) - 6}" y2="${Y(0) + 2}"/>`;
        for (let k = 0; k < f.S; k++) if (f.segCnt[k] > 0) g += `<line class="sft-cov" x1="${X(f.sweep)}" x2="${X(f.sweep)}" y1="${Y(f.ys[k + 1])}" y2="${Y(f.ys[k])}"/>`;
      }
      const vw = X(W) + 16, vh = Y(0) + 22;
      const plane = `<div class="v-labeled"><span class="v-caption">plane: swept area in green, sweep line in amber · area so far ${f.area}</span><svg class="sft-plane" viewBox="0 0 ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="rectangles and sweep line">${g}</svg></div>`;
      const tree = segBars(f.shape, (id) => f.cov[id], (id) => f.st[id] || "", {
        n: f.S, cw: 64,
        sub: (id) => `cnt ${f.cnt[id]}`,
        label: "segment tree over y-segments: bold = covered length, cnt = full covers",
        foot: [
          { label: "y-seg", small: true, cells: Array.from({ length: f.S }, (_, k) => ({ t: `${f.ys[k]}–${f.ys[k + 1]}`, cls: f.segCnt[k] > 0 ? "done" : "" })) },
          { label: "open", small: true, cells: f.segCnt.map((c) => ({ t: c })) },
        ],
      });
      return Viz.row(plane, tree);
    },
  }));
})();
