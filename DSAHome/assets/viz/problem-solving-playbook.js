/* Visualizers for the Problem-Solving Playbook. All names are prefixed "problem-solving-playbook-". */
(() => {
  const esc = Viz.esc;
  const SUP = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "-": "⁻" };
  const sup = (n) => String(n).split("").map((c) => SUP[c] || c).join("");
  const pow10 = (lg) => {
    if (lg < 6) return Math.round(10 ** lg).toLocaleString("en-US");
    if (lg >= 1000) return `10${sup(Math.round(lg))}`;
    let e = Math.floor(lg), m = Number((10 ** (lg - e)).toFixed(1));
    if (m >= 10) { m = 1; e += 1; }
    return `${m.toFixed(1)}×10${sup(e)}`;
  };

  /* ---------- Shared pattern catalogue (cost: 1=log n … 7=n!) ---------- */
  const P = {
    tp: ["Two pointers", "two-pointers", 2], sw: ["Sliding window", "sliding-window", 2], ps: ["Prefix sums", "prefix-sums", 2],
    hash: ["Hash map / set", "hashing", 2], mono: ["Monotonic stack/queue", "monotonic-stack-queue", 2], bs: ["Binary search", "binary-search", 1],
    bsa: ["Binary search on the answer", "binary-search", 3], sort: ["Sort first", "sorting", 3], heap: ["Heap / priority queue", "heaps-priority-queues", 3],
    greedy: ["Greedy", "greedy", 3], sweep: ["Sweep line", "intervals-sweep-line", 3], ll: ["Fast/slow pointers, rewiring", "linked-lists", 2],
    tree: ["Tree recursion", "tree-patterns", 2], bfs: ["BFS", "graph-fundamentals", 2], dfs: ["DFS / flood fill", "graph-fundamentals", 2],
    topo: ["Topological sort", "topological-sort", 2], uf: ["Union-find", "union-find", 2], dijk: ["Dijkstra / 0-1 BFS", "shortest-paths", 3],
    mst: ["MST (Kruskal / Prim)", "minimum-spanning-trees", 3], trie: ["Trie", "tries", 2], str: ["KMP / Z / rolling hash", "string-algorithms", 2],
    seg: ["Segment / Fenwick tree", "segment-fenwick-trees", 3], dp1: ["1D / grid DP", "dp-linear-grid", 2], dp2: ["DP over two sequences", "dp-sequences-strings", 4],
    knap: ["Knapsack DP", "dp-knapsack", 4], intdp: ["Interval DP", "dp-intervals-trees", 5], floyd: ["Floyd–Warshall", "shortest-paths", 5],
    bitmask: ["Bitmask DP", "dp-bitmask-digit", 6], bt: ["Backtracking", "backtracking", 6], math: ["Math / number theory", "math-number-theory", 1],
    bits: ["Bit manipulation", "bit-manipulation", 1],
  };
  const pname = (id) => P[id][0];
  const plink = (id) => `<a href="${P[id][1]}.html">${esc(P[id][0])}</a>`;
  const COST = ["", "O(log n)", "O(n)", "O(n log n)", "O(n²)", "O(n³)", "O(2ⁿ)", "O(n!)"];

  /* ================= 1. Input size → feasible complexity ================= */
  const CLASSES = [
    { k: "O(log n)", lg: (L, n) => Math.log10(Math.max(1, Math.log2(n))), use: "binary search, fast power, closed-form math" },
    { k: "O(√n)", niche: true, lg: (L) => L / 2, use: "trial division, sqrt decomposition" },
    { k: "O(n)", lg: (L) => L, use: "two pointers, sliding window, prefix sums, hashing, monotonic stack, BFS/DFS" },
    { k: "O(n log n)", lg: (L, n) => L + Math.log10(Math.max(1, Math.log2(n))), use: "sorting, heaps, binary search per item, Dijkstra, segment trees" },
    { k: "O(n√n)", niche: true, lg: (L) => 1.5 * L, use: "sqrt decomposition, Mo's algorithm" },
    { k: "O(n²)", lg: (L) => 2 * L, use: "all pairs, DP over two indices (LCS, edit distance)" },
    { k: "O(n³)", lg: (L) => 3 * L, use: "interval DP, Floyd–Warshall, three nested choices" },
    { k: "O(2ⁿ)", lg: (L, n) => n * Math.log10(2), use: "subsets, bitmask DP, meet in the middle" },
    { k: "O(n!)", lg: (L, n) => { if (n <= 1e5) { let s = 0; for (let i = 2; i <= n; i++) s += Math.log10(i); return s; } return n * Math.log10(n / Math.E) + 0.5 * Math.log10(2 * Math.PI * n); }, use: "permutations, brute-force orderings" },
  ];
  const parseN = (s) => {
    const t = String(s).replace(/[\s_,]/g, "").replace(/·/g, "*");
    let m = t.match(/^(\d+(?:\.\d+)?)(?:\*?10\^(\d+))?$/), n;
    if (m) n = Number(m[1]) * (m[2] ? 10 ** Number(m[2]) : 1);
    else if ((m = t.match(/^10\^(\d+)$/))) n = 10 ** Number(m[1]);
    else if (/^\d+(\.\d+)?e\d+$/i.test(t)) n = Number(t);
    if (!Number.isFinite(n) || n < 1 || n > 1e18) throw new Error("n must be between 1 and 10^18. Try 100000, 1e5, 2*10^5 or 10^9.");
    return Math.round(n);
  };
  const fmtTime = (sec) => {
    if (sec < 1e-3) return "< 1 ms";
    if (sec < 1) return `${Math.round(sec * 1000)} ms`;
    if (sec < 120) return `${sec.toFixed(sec < 10 ? 1 : 0)} s`;
    if (sec < 7200) return `${Math.round(sec / 60)} min`;
    if (sec < 172800) return `${Math.round(sec / 3600)} h`;
    const yrs = sec / 3.15e7;
    if (yrs < 1) return `${Math.round(sec / 86400)} days`;
    if (yrs > 1.4e10) return "> age of universe";
    return yrs < 1e4 ? `${Math.round(yrs).toLocaleString("en-US")} years` : `${pow10(Math.log10(yrs))} years`;
  };

  Viz.register("problem-solving-playbook-budget", (el) => Viz.player(el, {
    title: "Input size → the slowest complexity that still fits",
    tag: "BUDGET CALCULATOR",
    legend: [["done", "fits the time limit"], ["active", "risky (within 10×)"], ["bad", "too slow"], ["path", "the class the setter probably intends"]],
    codeLang: "python",
    code: [
      "budget = ops_per_second * time_limit",
      "for cls in [log n, √n, n, n log n, n√n, n², n³, 2ⁿ, n!]:",
      "    ops = cls(n)",
      "    if ops <= budget:        verdict = 'fits'",
      "    elif ops <= 10 * budget: verdict = 'risky'",
      "    else:                    verdict = 'too slow'",
      "intended = slowest class that fits",
    ],
    inputs: [
      { key: "n", label: "n (max input size)", value: "100000", width: 150 },
      { key: "rate", label: "language speed", type: "select", value: "C# / Java / C++ / Go (~100M ops/s)", options: ["C# / Java / C++ / Go (~100M ops/s)", "Python / JS (~10M ops/s)"] },
      { key: "sec", label: "time limit (s)", value: "1", width: 80 },
    ],
    random: () => ({ n: ["10", "20", "500", "5000", "100000", "1000000", "10^9", "2*10^5"][Viz.rand(0, 7)], sec: "1" }),
    build: ({ n, rate, sec }) => {
      const N = parseN(n), L = Math.log10(N);
      const secs = Number(sec);
      if (!(secs > 0 && secs <= 60)) throw new Error("Time limit must be between 0.01 and 60 seconds.");
      const r = rate.startsWith("Python") ? 7 : 8, budget = r + Math.log10(secs);
      const rows = CLASSES.map((c) => {
        const lg = c.lg(L, N), v = lg <= budget ? "done" : lg <= budget + 1 ? "active" : "bad";
        return { k: c.k, lg, v, niche: !!c.niche, time: fmtTime(10 ** (lg - r)), use: c.use, ops: lg > 1e6 ? "astronomical" : pow10(lg) };
      });
      const fr = [], bud = `${pow10(budget)} ops`;
      fr.push({ rows, upto: -1, budget, line: 0, vars: { n: N.toLocaleString("en-US"), budget: bud }, note: `Budget first: about <b>10${sup(r)}</b> simple operations per second × ${secs}s ≈ <b>${bud}</b>. Every candidate algorithm must fit under this line.` });
      rows.forEach((row, i) => {
        const why = row.v === "done" ? `fits: ${row.ops} ops ≈ ${row.time}.` : row.v === "active" ? `risky: ${row.ops} ops ≈ ${row.time}. Only with a tiny constant factor.` : `too slow: ${row.ops} ops ≈ ${row.time}.`;
        fr.push({ rows, upto: i, budget, cur: i, line: [2, row.v === "done" ? 3 : row.v === "active" ? 4 : 5], vars: { n: N.toLocaleString("en-US"), cls: row.k, ops: row.ops, verdict: row.v === "done" ? "fits" : row.v === "active" ? "risky" : "too slow" }, note: `<b>${row.k}</b> ${why}${row.v === "done" ? ` Typical tools: ${row.use}.` : ""}` });
      });
      let best = -1; rows.forEach((row, i) => { if (row.v === "done" && !row.niche) best = i; });
      if (best < 0) rows.forEach((row, i) => { if (row.v === "done") best = i; });
      const bestRow = rows[best];
      const nicheAbove = rows.find((row, i) => i > best && row.niche && row.v === "done");
      fr.push({ rows, upto: rows.length - 1, budget, best, line: 6, vars: { n: N.toLocaleString("en-US"), intended: bestRow ? bestRow.k : "none" }, note: bestRow
        ? `The slowest mainstream class that fits is <b>${bestRow.k}</b>. Problem setters pick n so that the intended solution just fits, so start your search with <b>${esc(bestRow.use)}</b>. Anything faster also passes; anything slower will time out.${nicheAbove ? ` (${nicheAbove.k} also fits, but square-root tricks are rare outside contests.)` : ""}`
        : "Nothing fits. n is a value, not a count: think closed-form math or O(log n) search." });
      return fr;
    },
    render: (f) => {
      const scale = Math.max(f.budget * 1.6, 1);
      const rows = f.rows.map((row, i) => {
        const shown = i <= f.upto;
        const cls = !shown ? "pb-pending" : i === f.best ? "path" : row.v;
        const w = shown ? Math.max(1.5, Math.min(100, (row.lg / scale) * 100)) : 0;
        return `<div class="pb-brow ${i === f.cur ? "pb-cur" : ""} ${cls}"><span class="pb-blabel">${row.k}</span>
          <div class="pb-btrack"><div class="pb-bfill" style="width:${w}%"></div><div class="pb-bline" style="left:${(f.budget / scale) * 100}%" title="budget"></div>${row.lg > scale ? '<span class="pb-bclip">off the scale →</span>' : ""}</div>
          <span class="pb-bops">${shown ? row.ops : ""}</span><span class="pb-btime">${shown ? row.time : ""}</span><span class="pb-bverdict">${shown ? (i === f.best ? "intended" : row.v === "done" ? "fits" : row.v === "active" ? "risky" : "too slow") : ""}</span></div>`;
      }).join("");
      return `<div class="pb-budget"><div class="pb-brow pb-bhead"><span>class</span><span>operations (log scale) · the dashed line is the budget</span><span>ops</span><span>time</span><span>verdict</span></div>${rows}</div>`;
    },
  }));

  /* ================= 2. The decision map: size × shape × question ================= */
  const SIZES = {
    "n ≤ 10 (permutations OK)": 7, "n ≤ 20 (subsets OK)": 6, "n ≤ 100–500 (cubic OK)": 5, "n ≤ 2,000–5,000 (quadratic OK)": 4,
    "n ≤ 1e5–1e6 (n log n)": 3, "n ≤ 1e7–1e8 (linear only)": 2, "a single value up to 1e18 (sublinear)": 1,
  };
  const SHAPES = {
    "Sorted array": ["bs", "tp", "bsa", "greedy", "ps"],
    "Unsorted array": ["hash", "sort", "ps", "sw", "tp", "mono", "heap", "dp1", "greedy", "seg"],
    "String": ["sw", "hash", "tp", "str", "trie", "dp2", "dp1", "bt"],
    "Linked list": ["ll", "tp", "hash"],
    "Binary tree / BST": ["tree", "bfs", "bs", "dp1"],
    "Graph (nodes + edges)": ["bfs", "dfs", "topo", "uf", "dijk", "mst", "floyd", "bitmask"],
    "Grid / matrix": ["bfs", "dfs", "dp1", "uf", "dijk", "ps", "bt"],
    "Intervals / events": ["sort", "sweep", "greedy", "heap", "bs"],
    "Stream / online queries": ["heap", "hash", "seg", "sw", "mono"],
    "Items with weight/value (pick a subset)": ["knap", "bt", "bitmask", "dp1", "greedy"],
    "A single number": ["math", "bits", "bs", "bsa"],
  };
  const QUESTIONS = {
    "Count the ways / how many": ["dp1", "dp2", "knap", "ps", "hash", "math", "bitmask", "bt"],
    "Minimise / maximise a value": ["dp1", "dp2", "greedy", "bsa", "heap", "sw", "knap", "intdp"],
    "Is it possible? / does one exist?": ["hash", "bfs", "dfs", "uf", "bsa", "dp1", "tp"],
    "List every solution": ["bt", "dfs"],
    "k-th smallest / top k": ["heap", "bsa", "sort", "bs"],
    "Shortest path / fewest steps": ["bfs", "dijk", "dp1", "floyd", "bitmask"],
    "Longest / shortest contiguous part": ["sw", "ps", "hash", "mono", "dp1"],
    "Order with dependencies / scheduling": ["topo", "sort", "greedy", "heap"],
    "Many range queries or updates": ["ps", "seg", "sort", "bs"],
  };
  const keysOf = (o) => Object.keys(o);

  Viz.register("problem-solving-playbook-map", (el) => Viz.player(el, {
    title: "Decision map: size × shape × question → shortlist",
    tag: "INTERACTIVE DECISION MAP",
    legend: [["active", "budget class"], ["done", "affordable"], ["bad", "over budget"], ["visit", "candidate"], ["path", "shortlist"]],
    codeLang: "python",
    code: [
      "budget = complexity_allowed_by(n)",
      "A = patterns_for(shape)",
      "B = patterns_for(question)",
      "for p in A | B:",
      "    if cost(p) > budget: drop(p)",
      "    score = (p in A) + (p in B) + fits_budget_exactly(p)",
      "shortlist = top(score)",
    ],
    inputs: [
      { key: "size", label: "1 · input size", type: "select", value: "n ≤ 1e5–1e6 (n log n)", options: keysOf(SIZES) },
      { key: "shape", label: "2 · input shape", type: "select", value: "Unsorted array", options: keysOf(SHAPES) },
      { key: "q", label: "3 · question", type: "select", value: "Longest / shortest contiguous part", options: keysOf(QUESTIONS) },
    ],
    random: () => ({ size: keysOf(SIZES)[Viz.rand(0, 6)], shape: keysOf(SHAPES)[Viz.rand(0, 10)], q: keysOf(QUESTIONS)[Viz.rand(0, 8)] }),
    build: ({ size, shape, q }) => {
      const budget = SIZES[size], A = SHAPES[shape], B = QUESTIONS[q];
      if (!budget || !A || !B) throw new Error("Pick one option in each list.");
      const union = [...new Set([...A, ...B])];
      const scored = union.map((p) => {
        const c = P[p][2], over = c > budget;
        const bonus = c === budget ? 1 : c === budget - 1 ? 0.5 : 0;
        return { p, over, s: (A.includes(p) ? 1 : 0) + (B.includes(p) ? 1 : 0) + bonus, inA: A.includes(p), inB: B.includes(p), bonus };
      });
      const ok = scored.filter((x) => !x.over).sort((x, y) => y.s - x.s || P[y.p][2] - P[x.p][2]);
      const top = ok.slice(0, 4);
      const base = { budget, A, B, size, shape, q };
      const dropped = scored.filter((x) => x.over).map((x) => pname(x.p));
      const fr = [];
      fr.push({ ...base, stage: 0, line: [], vars: {}, note: "Three questions decide almost everything: <b>how big</b> is the input, <b>what shape</b> is it, and <b>what is being asked</b>. Step through to apply them in order." });
      fr.push({ ...base, stage: 1, line: 0, vars: { budget: COST[budget] }, note: `<b>${esc(size)}</b> → the budget is about <b>${COST[budget]}</b>. Anything slower is impossible; something close to ${COST[budget]} is probably what the setter intended.` });
      fr.push({ ...base, stage: 2, line: 1, vars: { budget: COST[budget], "|A|": A.length }, note: `<b>${esc(shape)}</b> suggests: ${A.map(pname).join(", ")}.${A.some((p) => P[p][2] > budget) ? ` Over budget and crossed out: ${A.filter((p) => P[p][2] > budget).map(pname).join(", ")}.` : ""}` });
      fr.push({ ...base, stage: 3, line: 2, vars: { budget: COST[budget], "|A|": A.length, "|B|": B.length }, note: `<b>${esc(q)}</b> suggests: ${B.map(pname).join(", ")}. Patterns named by <i>both</i> the shape and the question are the strongest leads.` });
      fr.push({ ...base, stage: 4, line: [3, 4, 5], top, vars: { budget: COST[budget], candidates: union.length, dropped: dropped.length }, note: `Score = in shape (+1) + in question (+1) + matches the budget class (+1, or +½ one class below).${dropped.length ? ` Dropped as too slow: ${dropped.join(", ")}.` : ""}` });
      fr.push({ ...base, stage: 5, line: 6, top, vars: { budget: COST[budget], pick: top[0] ? pname(top[0].p) : "none" }, note: top.length
        ? `Try <b>${plink(top[0].p)}</b> first${top[1] ? `, then ${top.slice(1).map((t) => plink(t.p)).join(", ")}` : ""}. A shortlist is a hypothesis: check it against one hand example before coding.`
        : "Nothing affordable matches. The input is too large for these patterns: look for a math identity, binary search on the answer, or a greedy invariant." });
      return fr;
    },
    render: (f) => {
      const chip = (txt, cls, extra = "") => `<span class="pb-chip ${cls}">${txt}${extra}</span>`;
      const col = (n, title, body, on) => `<div class="pb-col ${on ? "" : "pb-off"}"><div class="pb-col-h"><b>${n}</b>${esc(title)}</div>${body}</div>`;
      const sizeBody = COST.slice(1).map((c, i) => chip(c, f.stage < 1 ? "" : i + 1 === f.budget ? "active" : i + 1 < f.budget ? "done" : "bad")).join("");
      const pats = (list, on) => list.map((p) => chip(esc(pname(p)), !on ? "" : P[p][2] > f.budget ? "bad" : f.top && f.top.some((t) => t.p === p) ? "path" : "visit", `<small>${COST[P[p][2]]}</small>`)).join("");
      const short = f.stage >= 4 ? (f.top.length ? f.top.map((t, i) => `<div class="pb-short ${i === 0 && f.stage === 5 ? "pb-win" : ""}"><span class="pb-rank">${i + 1}</span><span><b>${esc(pname(t.p))}</b><small>${[t.inA ? "shape +1" : "", t.inB ? "question +1" : "", t.bonus ? `budget +${t.bonus === 1 ? 1 : "½"}` : ""].filter(Boolean).join(" · ")}</small></span><span class="pb-score">${t.s}</span></div>`).join("") : '<p class="pb-empty">no affordable match</p>') : '<p class="pb-empty">…</p>';
      return `<div class="pb-map">
        ${col("1", "Size → budget", `<div class="pb-chips pb-vert">${sizeBody}</div>`, f.stage >= 1)}
        ${col("2", f.stage >= 2 ? f.shape : "Shape → patterns", `<div class="pb-chips">${f.stage >= 2 ? pats(f.A, true) : ""}</div>`, f.stage >= 2)}
        ${col("3", f.stage >= 3 ? f.q : "Question → techniques", `<div class="pb-chips">${f.stage >= 3 ? pats(f.B, true) : ""}</div>`, f.stage >= 3)}
        ${col("4", "Shortlist", short, f.stage >= 4)}
      </div>`;
    },
  }));

  /* ================= 3. Workflow on one problem: brute force → bottleneck → optimise ================= */
  Viz.register("problem-solving-playbook-bottleneck", (el, opts) => {
    const fast = opts.mode === "fast";
    return Viz.player(el, {
      title: fast ? "Step 5 · Optimised: prefix sum + hash map, O(n)" : "Step 3 · Brute force: every subarray, O(n²)",
      tag: fast ? "OPTIMISE THE BOTTLENECK" : "BRUTE FORCE FIRST",
      legend: fast ? [["active", "current prefix"], ["done", "lookup hit"], ["bad", "lookup miss"], ["window", "subarrays counted at this step"]] : [["window", "current subarray a[i..j]"], ["active", "element just added"], ["done", "sum == k"]],
      codeLang: "python",
      code: fast ? [
        "count, pre = 0, 0",
        "seen = {0: 1}     # prefix -> count",
        "for j, x in enumerate(a):",
        "    pre += x",
        "    count += seen.get(pre - k, 0)",
        "    seen[pre] = seen.get(pre, 0) + 1",
        "return count",
      ] : [
        "count = 0",
        "for i in range(n):",
        "    s = 0",
        "    for j in range(i, n):",
        "        s += a[j]",
        "        if s == k: count += 1",
        "return count",
      ],
      inputs: [{ key: "a", label: "nums", value: "1,2,-1,2,1,-2,3" }, { key: "k", label: "k", value: "3", width: 60 }],
      random: () => ({ a: Viz.randInts(Viz.rand(5, 9), -3, 4).join(","), k: String(Viz.rand(-1, 5)) }),
      build: ({ a, k }) => {
        const arr = Viz.parse.ints(a, { min: 1, max: 12 }), K = Viz.parse.int(k, { min: -99, max: 99 }), n = arr.length, fr = [];
        let count = 0, ops = 0;
        if (!fast) {
          fr.push({ arr, line: 0, vars: { count, ops }, note: "Brute force is step 3 of the workflow: obviously correct, easy to write, and it shows you <i>where</i> the time goes." });
          for (let i = 0; i < n; i++) {
            let s = 0;
            for (let j = i; j < n; j++) {
              s += arr[j]; ops++;
              const hit = s === K; if (hit) count++;
              fr.push({ arr, i, j, hit, line: hit ? [4, 5] : 4, vars: { i, j, s, count, ops }, note: hit ? `a[${i}..${j}] sums to ${s} = k. Count it (${count}).` : j === i ? `New start i = ${i}: reset s and grow the subarray one element at a time.` : `a[${i}..${j}] sums to ${s}. Not k.` });
            }
          }
          fr.push({ arr, line: 6, vars: { count, ops }, note: `Answer ${count} after <b>${ops}</b> additions = n(n+1)/2. <b>Bottleneck:</b> for each end j we ask "how many starts i make sum(i..j) = k?" by scanning. sum(i..j) = pre[j+1] − pre[i], so the question is "how many earlier prefixes equal pre − k?", which a hash map answers in O(1).` });
        } else {
          const seen = new Map([[0, 1]]); let pre = 0; const pres = [0];
          fr.push({ arr, pres: [...pres], seen: new Map(seen), line: [0, 1], vars: { pre, count, ops }, note: "Seed seen = {0: 1}: the empty prefix lets subarrays that start at index 0 be counted." });
          for (let j = 0; j < n; j++) {
            pre += arr[j]; pres.push(pre); ops++;
            const need = pre - K, got = seen.get(need) || 0; count += got;
            const starts = []; for (let i = 0; i <= j; i++) if (pres[i] === need) starts.push(i);
            fr.push({ arr, j, pres: [...pres], seen: new Map(seen), need, got, starts, line: [3, 4], vars: { j, x: arr[j], pre, "pre-k": need, count, ops }, note: got ? `pre = ${pre}. Need an earlier prefix equal to ${pre} − ${K} = ${need}: seen ${got}×, so ${got} subarr${got > 1 ? "ays end" : "ay ends"} here (start${starts.length > 1 ? "s" : ""} ${starts.join(", ")}).` : `pre = ${pre}. No earlier prefix equals ${need}, so no subarray ending at ${j} sums to ${K}.` });
            seen.set(pre, (seen.get(pre) || 0) + 1);
            fr.push({ arr, j, pres: [...pres], seen: new Map(seen), put: pre, line: 5, vars: { j, pre, count, ops }, note: `Record prefix ${pre} so later positions can pair with it.` });
          }
          fr.push({ arr, pres: [...pres], seen: new Map(seen), line: 6, vars: { count, ops }, note: `Same answer, <b>${count}</b>, with <b>${ops}</b> steps instead of ${n * (n + 1) / 2}. At n = 10⁵ that is 10⁵ versus 5×10⁹: the difference between instant and a time-out.` });
        }
        return fr;
      },
      render: (f) => {
        if (!fast) {
          return Viz.array(f.arr, { ptrs: f.i === undefined ? {} : { i: f.i, j: f.j }, window: f.i === undefined ? undefined : [f.i, f.j], cls: (x) => (f.i === undefined ? "" : f.hit && x >= f.i && x <= f.j ? "done" : x === f.j ? "active" : ""), label: "nums" });
        }
        const keys = [...f.seen.keys()];
        const map = Viz.grid([keys, keys.map((x) => f.seen.get(x))], { rowLabels: ["prefix", "seen"], cls: (r, c) => (keys[c] === f.need ? (f.got ? "done" : "bad") : keys[c] === f.put ? "active" : ""), label: "seen (hash map)" });
        const win = f.starts && f.starts.length ? [Math.min(...f.starts), f.j] : undefined;
        return Viz.row(
          Viz.array(f.arr, { ptrs: f.j === undefined ? {} : { j: f.j }, window: win, cls: (x) => (x === f.j ? "active" : ""), label: "nums" }),
          Viz.array(f.pres, { label: "pre (prefix sums, pre[0] = 0)", cls: (x) => (f.starts && f.starts.includes(x) ? "done" : x === f.pres.length - 1 && f.j !== undefined ? "active" : "") }),
          map,
        );
      },
    });
  });

  /* ================= 4. Which pattern? quiz ================= */
  const QUIZ = [
    { t: "Subarrays that hit a target", s: "Given an integer array (values may be negative) and an integer k, return the number of contiguous subarrays whose sum equals k.", c: "n ≤ 2·10⁴", budget: "O(n) or O(n log n); O(n²) is borderline",
      sig: [["number of contiguous subarrays", "Counting subarrays: think prefix sums, since sum(i..j) = pre[j+1] − pre[i]."], ["sum equals k", "An exact target: look up the complement pre − k in a hash map."], ["may be negative", "Negatives break the sliding window: growing a window no longer only increases the sum."]],
      p: "Prefix sums + hash map", slug: "prefix-sums" },
    { t: "Longest run without repeats", s: "Given a string, find the length of the longest substring that contains no repeated character.", c: "n ≤ 5·10⁴", budget: "O(n)",
      sig: [["longest substring", "Longest contiguous piece: a variable sliding window that grows and shrinks."], ["no repeated character", "The validity rule a window maintains: track the last index or a count per character."]],
      p: "Sliding window (variable size)", slug: "sliding-window" },
    { t: "Slowest speed that still finishes", s: "There are piles of bananas. At speed s you eat s bananas per hour from one pile. Find the minimum speed that finishes all piles within h hours.", c: "piles ≤ 10⁴, pile size ≤ 10⁹", budget: "O(n log max)",
      sig: [["minimum speed", "We are asked for an optimal value, not a structure."], ["within h hours", "A feasibility check: if speed s works, every faster speed also works (monotone)."], ["≤ 10⁹", "The answer range is huge, so search it by halving: about 30 checks."]],
      p: "Binary search on the answer", slug: "binary-search" },
    { t: "Can every course be taken?", s: "There are n courses and a list of prerequisite pairs [a, b] meaning b must be taken before a. Decide whether you can finish all courses.", c: "n ≤ 2000, pairs ≤ 5000", budget: "O(V + E)",
      sig: [["prerequisite pairs", "Pairs \"x before y\" are directed edges in a dependency graph."], ["finish all courses", "Possible exactly when the graph has no cycle, which is what a topological order proves."]],
      p: "Topological sort (Kahn's algorithm)", slug: "topological-sort" },
    { t: "Most frequent elements", s: "Given an integer array and k, return the k most frequent elements in any order.", c: "n ≤ 10⁵", budget: "better than O(n log n)",
      sig: [["integer array", "Frequencies first: a hash map from value to count."], ["k most frequent", "Top-k: a size-k min-heap (O(n log k)) or bucket sort by frequency (O(n))."]],
      p: "Hash map + heap (or buckets)", slug: "heaps-priority-queues" },
    { t: "Wait for a warmer day", s: "Given daily temperatures, return for each day how many days you must wait until a warmer temperature.", c: "n ≤ 10⁵", budget: "O(n)",
      sig: [["for each day", "One answer per element, so an O(n) pass is the goal."], ["until a warmer temperature", "\"Next greater element\": keep a decreasing stack and pop when a larger value arrives."]],
      p: "Monotonic stack", slug: "monotonic-stack-queue" },
    { t: "Fewest coins", s: "Given coin denominations (each usable any number of times) and an amount, return the fewest coins that make up the amount, or -1.", c: "coins ≤ 12, amount ≤ 10⁴", budget: "O(coins × amount)",
      sig: [["fewest coins", "Minimise a count over choices. Greedy fails for coins like {1, 3, 4}."], ["any number of times", "Unbounded reuse: unbounded knapsack with dp[x] = 1 + min dp[x − c]."], ["amount ≤ 10⁴", "A small numeric target can be a DP dimension."]],
      p: "Knapsack DP (unbounded)", slug: "dp-knapsack" },
    { t: "Count the islands", s: "Given a grid of '1' (land) and '0' (water), count the islands, where land cells connect up, down, left and right.", c: "rows, cols ≤ 300", budget: "O(rows × cols)",
      sig: [["grid", "A grid is a graph: each cell is a node with up to 4 neighbours."], ["count the islands", "Count connected components: flood fill with BFS/DFS, or union-find."]],
      p: "BFS / DFS flood fill", slug: "graph-fundamentals" },
    { t: "All balanced bracket strings", s: "Given n, generate all combinations of n pairs of well-formed parentheses.", c: "n ≤ 8", budget: "exponential is fine",
      sig: [["generate all combinations", "Enumerate every solution: backtracking (choose, explore, un-choose)."], ["n ≤ 8", "Tiny n means the setter allows exponential output."], ["well-formed", "A pruning rule: never close more than you have opened."]],
      p: "Backtracking", slug: "backtracking" },
    { t: "Meeting rooms", s: "Given meeting time intervals [start, end], return the minimum number of conference rooms required.", c: "n ≤ 10⁴", budget: "O(n log n)",
      sig: [["intervals", "Intervals: sort by start (or turn them into +1/−1 events)."], ["minimum number of conference rooms", "The answer is the maximum number of overlapping meetings: a sweep line or a min-heap of end times."]],
      p: "Sort + sweep line / min-heap", slug: "intervals-sweep-line" },
    { t: "Running median", s: "Design a structure that adds numbers from a data stream and can return the median of everything seen so far at any time.", c: "up to 5·10⁴ calls", budget: "O(log n) per add",
      sig: [["data stream", "Online: you cannot sort everything again after every add."], ["median", "Split into a lower half (max-heap) and an upper half (min-heap); the median sits at the tops."]],
      p: "Two heaps", slug: "heaps-priority-queues" },
    { t: "Shortest tour of a few cities", s: "Given a weighted graph with at most 12 nodes, find the shortest route that visits every node at least once.", c: "n ≤ 12", budget: "O(2ⁿ · n²)",
      sig: [["at most 12 nodes", "n ≤ 12 is a signal for exponential state: the subset of visited nodes fits in a bitmask."], ["visits every node", "\"Visit all\" means the state must remember which nodes are done: dp[mask][last]."], ["shortest route", "Minimise over orders: DP over (mask, last node), with shortest-path distances between nodes."]],
      p: "Bitmask DP (TSP)", slug: "dp-bitmask-digit" },
  ];
  const TITLES = { "sliding-window": "Sliding Window", "prefix-sums": "Prefix Sums & Difference Arrays", "binary-search": "Binary Search", "monotonic-stack-queue": "Monotonic Stack & Queue", "intervals-sweep-line": "Intervals & Sweep Line", "heaps-priority-queues": "Heaps & Priority Queues", "graph-fundamentals": "Graph Fundamentals: BFS & DFS", "topological-sort": "Topological Sort & DAGs", backtracking: "Backtracking", "dp-knapsack": "Knapsack Family", "dp-bitmask-digit": "Bitmask & Digit DP" };
  const STEPS = ["read the constraints → budget", "underline the signal phrases", "map each phrase → a candidate", "intersect candidates with the budget", "commit; verify on one example"];
  const ALL = "All 12, in order";

  Viz.register("problem-solving-playbook-quiz", (el) => Viz.player(el, {
    title: "Which pattern? Read, spot the signals, then reveal",
    tag: "PATTERN QUIZ · PREDICT BEFORE NEXT",
    speed: 2200,
    legend: [["active", "signal being read"], ["visit", "signals found so far"], ["done", "pattern revealed"]],
    code: STEPS.map((s, i) => `${i + 1}. ${s}`),
    inputs: [{ key: "pick", label: "problem", type: "select", value: ALL, options: [ALL, ...QUIZ.map((q, i) => `${i + 1}. ${q.t}`)] }],
    random: () => { const i = Viz.rand(0, QUIZ.length - 1); return { pick: `${i + 1}. ${QUIZ[i].t}` }; },
    build: ({ pick }) => {
      const list = pick === ALL ? QUIZ.map((_, i) => i) : [Number(String(pick).split(".")[0]) - 1];
      if (list.some((i) => !QUIZ[i])) throw new Error("Choose a problem from the list.");
      const fr = [];
      for (const qi of list) {
        const q = QUIZ[qi];
        q.sig.forEach(([ph]) => { if (!q.s.includes(ph) && !q.c.includes(ph)) throw new Error(`Signal "${ph}" not found in problem ${qi + 1}.`); });
        const base = { qi, n: list.length };
        fr.push({ ...base, stage: 0, found: 0, line: [], vars: { problem: `${qi + 1}/${QUIZ.length}`, signals: 0 }, note: "Read the statement. <b>Guess the pattern before pressing Next.</b>" });
        fr.push({ ...base, stage: 1, found: 0, line: 0, vars: { problem: `${qi + 1}/${QUIZ.length}`, budget: q.budget }, note: `Constraints ${esc(q.c)} → budget <b>${esc(q.budget)}</b>.` });
        q.sig.forEach(([ph, why], k) => fr.push({ ...base, stage: 2, found: k + 1, cur: k, line: [1, 2], vars: { problem: `${qi + 1}/${QUIZ.length}`, budget: q.budget, signals: k + 1 }, note: `“${esc(ph)}” → ${esc(why)}` }));
        fr.push({ ...base, stage: 3, found: q.sig.length, line: [3, 4], vars: { problem: `${qi + 1}/${QUIZ.length}`, budget: q.budget, pattern: q.p }, note: `<b>${esc(q.p)}</b>: every signal points here and it fits the budget. Full treatment: <a href="${q.slug}.html">${esc(TITLES[q.slug] || q.slug)}</a>.` });
      }
      return fr;
    },
    render: (f) => {
      const q = QUIZ[f.qi];
      const mark = (text) => {
        let html = esc(text);
        q.sig.forEach(([ph], k) => {
          if (f.stage < 2 || k >= f.found) return;
          html = html.replace(esc(ph), `<mark class="pb-sig ${k === f.cur ? "active" : "visit"}">${esc(ph)}<sup>${k + 1}</sup></mark>`);
        });
        return html;
      };
      const sigs = q.sig.map(([ph, why], k) => `<li class="${k < f.found ? (k === f.cur ? "active" : "visit") : "pb-hidden"}"><b>${k + 1}</b><span><i>“${esc(ph)}”</i><br>${esc(why)}</span></li>`).join("");
      return `<div class="pb-quiz">
        <div class="pb-qcard"><div class="pb-qnum">Problem ${f.qi + 1} of ${QUIZ.length} · ${esc(q.t)}</div><p class="pb-qtext">${mark(q.s)}</p>
          <div class="pb-qcons ${f.stage >= 1 ? "on" : ""}">constraints: ${mark(q.c)}${f.stage >= 1 ? ` <span>→ budget ${esc(q.budget)}</span>` : ""}</div></div>
        <div class="pb-qside"><div class="v-caption">signals</div><ol class="pb-sigs">${sigs}</ol>
          <div class="pb-reveal ${f.stage >= 3 ? "done" : ""}">${f.stage >= 3 ? `<small>PATTERN</small>${esc(q.p)}` : "<small>PATTERN</small>?"}</div></div>
      </div>`;
    },
  }));

  /* ================= 5. Spaced repetition: the re-solve loop ================= */
  Viz.register("problem-solving-playbook-practice", (el) => Viz.player(el, {
    title: "Spaced repetition for one problem: success pushes the next review out, failure resets it",
    tag: "SIMULATION",
    legend: [["done", "solved from scratch"], ["bad", "failed → re-learn, reset to box 1"], ["active", "this review"]],
    codeLang: "python",
    code: [
      "box, day = 0, 0          # day 0: first solve",
      "for outcome in reviews:",
      "    day += gaps[box]     # re-solve on a blank page",
      "    if outcome == 'solved':",
      "        box = min(box + 1, len(gaps) - 1)",
      "    else:",
      "        box = 0          # re-study, restart",
    ],
    inputs: [{ key: "r", label: "review outcomes (y = solved, n = failed)", value: "y,y,n,y,y,y,y", width: 230 }, { key: "g", label: "gaps in days", value: "1,3,7,14,30,60", width: 160 }],
    random: () => ({ r: Array.from({ length: Viz.rand(5, 9) }, () => (Math.random() < 0.75 ? "y" : "n")).join(",") }),
    build: ({ r, g }) => {
      const outs = String(r).split(/[\s,]+/).filter(Boolean).map((x) => x.toLowerCase());
      if (!outs.length || outs.length > 12 || outs.some((x) => !["y", "n", "1", "0"].includes(x))) throw new Error("Use 1–12 outcomes, each y or n.");
      const gaps = Viz.parse.ints(g, { min: 2, max: 8 });
      if (gaps.some((x, i) => x < 1 || x > 120 || (i && x < gaps[i - 1]))) throw new Error("Gaps must be increasing whole days between 1 and 120.");
      let box = 0, day = 0; const hist = [{ day: 0, ok: true, box: 0, first: true }], fr = [];
      fr.push({ hist: [...hist], gaps, box, line: 0, vars: { day, box: box + 1, "next gap": gaps[box] }, note: "Day 0: you solve it (or study the solution until you could). The card goes into box 1." });
      outs.forEach((o, k) => {
        day += gaps[box];
        const ok = o === "y" || o === "1";
        fr.push({ hist: [...hist, { day, pending: true }], gaps, box, line: 2, vars: { review: k + 1, day, box: box + 1 }, note: `Review ${k + 1} on day ${day}: ${gaps[box]} day${gaps[box] > 1 ? "s" : ""} later. Re-solve from a blank editor; no peeking at old code.` });
        const before = box;
        box = ok ? Math.min(box + 1, gaps.length - 1) : 0;
        hist.push({ day, ok, box });
        fr.push({ hist: [...hist], gaps, box, cur: hist.length - 1, line: ok ? [3, 4] : [5, 6], vars: { review: k + 1, day, box: box + 1, "next gap": gaps[box] }, note: ok
          ? `Solved: move up to box ${box + 1}. The next review is ${gaps[box]} days away, because remembering under a longer delay is what makes it stick.`
          : `Failed (box ${before + 1} → 1): re-study the <i>insight</i>, write down the signal you missed, and see it again tomorrow.` });
      });
      fr.push({ hist: [...hist], gaps, box, line: 1, vars: { reviews: outs.length, "last day": day, box: box + 1 }, note: `${outs.length} reviews spread over ${day} days, a few minutes each. Failures cost only a reset, and the reviews you pass get further apart.` });
      return fr;
    },
    render: (f) => {
      const maxDay = Math.max(14, ...f.hist.map((h) => h.day)) * 1.05, W = 820, x = (d) => 30 + (d / maxDay) * (W - 60);
      const ticks = []; const step = maxDay > 150 ? 30 : maxDay > 60 ? 14 : 7;
      for (let d = 0; d <= maxDay; d += step) ticks.push(`<line class="edge dash" x1="${x(d)}" y1="44" x2="${x(d)}" y2="92"/><text class="small muted" x="${x(d)}" y="108" text-anchor="middle">d${d}</text>`);
      const marks = f.hist.map((h, i) => {
        const cls = h.pending ? "active" : h.ok ? "done" : "bad";
        const y = i % 2 ? 54 : 82;
        return `<line class="edge" x1="${x(h.day)}" y1="68" x2="${x(h.day)}" y2="${y}"/><circle class="box ${cls}" cx="${x(h.day)}" cy="${y}" r="${i === f.cur || h.pending ? 11 : 8}"/><text class="small" x="${x(h.day)}" y="${y + 4}" text-anchor="middle">${h.first ? "0" : h.pending ? "?" : h.ok ? "✓" : "✗"}</text>`;
      }).join("");
      const tl = `<svg class="dg pb-tl" viewBox="0 0 ${W} 116" width="${W}" role="img" aria-label="Review timeline"><line class="edge" x1="30" y1="68" x2="${W - 30}" y2="68"/>${ticks.join("")}${marks}</svg>`;
      const boxes = f.gaps.map((g, i) => `<div class="pb-lbox ${i === f.box ? "active" : ""}"><b>box ${i + 1}</b><small>review after ${g}d</small>${i === f.box ? '<span class="pb-card">card</span>' : ""}</div>`).join("");
      return `${tl}<div class="pb-leitner">${boxes}</div>`;
    },
  }));
})();
