/* Visualizers for "Performance Patterns". Frames come from simulations run in build(). */
(() => {
  const esc = (s) => Viz.esc(s);
  const rng = (seed) => {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const num = (s, label, lo, hi, int = true) => {
    const t = String(s).trim().replace(/,/g, "");
    const n = Number(t);
    if (t === "" || !Number.isFinite(n) || n < lo || n > hi || (int && !Number.isInteger(n))) throw new Error(`${label} must be ${int ? "a whole number" : "a number"} from ${lo.toLocaleString("en-US")} to ${hi.toLocaleString("en-US")}.`);
    return n;
  };
  const seedInput = { key: "seed", label: "seed", value: "7", width: 70 };
  const randSeed = () => String(Viz.rand(1, 9999));
  const badge = (t, c) => `<span class="pp-badge ${c || ""}">${esc(t)}</span>`;
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
  const big = (n) => Math.round(n).toLocaleString("en-US");
  /* time in ns -> readable */
  const fmtNs = (ns) => {
    if (ns < 1e3) return `${ns.toFixed(0)} ns`;
    if (ns < 1e6) return `${(ns / 1e3).toFixed(ns < 1e4 ? 1 : 0)} µs`;
    if (ns < 1e9) return `${(ns / 1e6).toFixed(ns < 1e7 ? 1 : 0)} ms`;
    const s = ns / 1e9;
    if (s < 120) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
    if (s < 7200) return `${(s / 60).toFixed(0)} min`;
    if (s < 172800) return `${(s / 3600).toFixed(1)} h`;
    return `${(s / 86400).toFixed(0)} days`;
  };
  const fmtMs = (ms) => (ms < 1 ? `${ms.toFixed(2)} ms` : ms < 10 ? `${ms.toFixed(1)} ms` : ms < 10000 ? `${Math.round(ms)} ms` : `${(ms / 1000).toFixed(ms < 100000 ? 1 : 0)} s`);
  const fmtB = (b) => {
    if (b < 1024) return `${Math.round(b)} B`;
    if (b < 1048576) return `${(b / 1024).toFixed(b < 10240 ? 1 : 0)} KB`;
    if (b < 1073741824) return `${(b / 1048576).toFixed(b < 10485760 ? 1 : 0)} MB`;
    return `${(b / 1073741824).toFixed(1)} GB`;
  };

  /* =====================================================================
   * 1. Premature optimisation vs known hot path
   * ===================================================================== */
  const DC_FREQ = ["per request (hot path)", "per item in a hot loop", "once at startup", "rarely (admin page, nightly job)"];
  const DC_COST = ["none (just as clear)", "some (a helper, a comment)", "high (unsafe, intrinsics, custom pool)"];
  const DC_SLO = ["yes, with headroom", "close to the budget", "no, we miss it"];
  Viz.register("performance-patterns-decide", (el) => Viz.player(el, {
    title: "Optimise this? Profile share, Amdahl's best case, and the cost of keeping it",
    tag: "DESCRIBE THE CHANGE · STEP THROUGH THE QUESTIONS",
    legend: [["active", "question being asked"], ["done", "points towards optimising"], ["path", "points away from it"], ["bad", "stop here"]],
    codeLang: "python",
    code: [
      "if not measured_problem(slo, cost): return 'write clear code; keep measuring'",
      "share = profile.share_of_time(code)      # from a profiler, not a hunch",
      "if share < 0.05: return 'premature: look elsewhere'",
      "saved = share * (1 - 1 / speedup)       # Amdahl: the best case",
      "if maintenance_cost(change) > value(saved): return 'find a cheaper fix'",
      "optimise(); benchmark(); verify_in_production()",
    ],
    inputs: [
      { key: "share", label: "share of time in this code (%)", value: "35", width: 80 },
      { key: "speed", label: "expected speedup of it (×)", value: "3", width: 70 },
      { key: "freq", label: "runs", type: "select", value: DC_FREQ[0], options: DC_FREQ },
      { key: "cost", label: "readability cost", type: "select", value: DC_COST[1], options: DC_COST },
      { key: "slo", label: "SLO met today?", type: "select", value: DC_SLO[1], options: DC_SLO },
    ],
    random: () => ({ share: String(pick(Math.random, [1, 3, 8, 15, 35, 60, 80])), speed: String(pick(Math.random, [1.5, 2, 3, 5, 10])), freq: pick(Math.random, DC_FREQ), cost: pick(Math.random, DC_COST), slo: pick(Math.random, DC_SLO) }),
    build: ({ share, speed, freq, cost, slo }) => {
      const p = num(share, "Share of time", 0, 100, false) / 100, s = num(speed, "Speedup", 1, 1000, false);
      const F = DC_FREQ.indexOf(freq), C = DC_COST.indexOf(cost), S = DC_SLO.indexOf(slo);
      if (F < 0 || C < 0 || S < 0) throw new Error("Pick an option in every list.");
      const saved = 100 * p * (1 - 1 / s), maxSaved = 100 * p;
      const steps = [
        { q: "Is there a measured problem?", a: S === 0 ? "No: the SLO is met with headroom. Only cost (CPU, instances) could justify work." : S === 1 ? "Yes, a small one: little margin left before the SLO." : "Yes: users feel it today." , st: S === 0 ? "path" : "done", line: 0 },
        { q: "Did a profile point here?", a: p < 0.05 ? `Only ${(p * 100).toFixed(1)}% of the time. Even an infinitely fast version saves less than ${(p * 100).toFixed(1)}%.` : `${(p * 100).toFixed(0)}% of the time is in this code, measured.`, st: p < 0.05 ? "bad" : "done", line: [1, 2] },
        { q: "How often does it run?", a: F === 0 ? "On every request: a hot path." : F === 1 ? "Per item inside a hot loop: small costs multiply." : F === 2 ? "Once at startup: it only matters for cold starts, autoscaling and serverless." : "Rarely: nobody waits on it.", st: F <= 1 ? "done" : "path", line: 1 },
        { q: "What does the best case buy?", a: `Amdahl: ${(p * 100).toFixed(0)}% of the time made ${s}× faster saves <b>${saved.toFixed(1)}%</b> of the total (at most ${maxSaved.toFixed(0)}% if it took zero time).`, st: saved >= 10 ? "done" : saved >= 3 ? "active" : "path", line: 3 },
        { q: "What does it cost to keep?", a: C === 0 ? "Nothing: the fast version is as clear as the slow one." : C === 1 ? "A little: one helper or a comment explaining why." : "A lot: unsafe code, intrinsics or a custom pool that every future reader must understand.", st: C === 0 ? "done" : C === 1 ? "active" : "path", line: 4 },
      ];
      let verdict, vst;
      if (C === 0 && saved >= 0.5) { verdict = "Do it now. A change that is just as clear and measurably faster is not premature; it is good code (a HashSet instead of a list scan, presizing, hoisting work out of a loop)."; vst = "done"; }
      else if (p < 0.05) { verdict = "Don't. This is premature optimisation: the profile says the time is elsewhere. Go after the biggest bar in the flame graph."; vst = "bad"; }
      else if (F === 3 && S !== 2) { verdict = "Leave it. Rarely-run code is the classic place to keep simple; spend the effort on the hot path."; vst = "bad"; }
      else if (S === 0) { verdict = saved >= 20 && C < 2 ? "Optional. No user-visible problem, but it could cut CPU cost. Schedule it with a benchmark; don't rush it." : "Don't. There is no problem to solve, and the change has a lasting readability cost."; vst = saved >= 20 && C < 2 ? "active" : "bad"; }
      else if (C === 2 && saved < 15) { verdict = "Not like this. The gain is small for code that hard to maintain. Look for an algorithmic, batching or caching fix first."; vst = "path"; }
      else if (saved < 3) { verdict = "Probably not. The best case moves the total by under 3%, inside normal noise. Find a bigger lever."; vst = "path"; }
      else { verdict = `Optimise it. It is a measured ${F === 2 ? "startup" : "hot"} path, the best case saves ${saved.toFixed(0)}%, and the SLO needs it. Benchmark before and after, and verify in production.`; vst = "done"; }
      const fr = [];
      fr.push({ steps, upto: -1, p, s, saved, line: 0, note: `A change would make code that takes ${(p * 100).toFixed(0)}% of the time ${s}× faster. Five questions decide whether that is engineering or premature optimisation.`, vars: { share: `${(p * 100).toFixed(0)}%`, speedup: `${s}×` } });
      steps.forEach((st, i) => fr.push({ steps, upto: i, p, s, saved, line: st.line, note: `<b>${esc(st.q)}</b> ${st.a}`, vars: { share: `${(p * 100).toFixed(0)}%`, "best-case saving": `${saved.toFixed(1)}%` } }));
      fr.push({ steps, upto: steps.length, p, s, saved, verdict, vst, line: vst === "done" || vst === "active" ? 5 : [0, 2, 4][vst === "bad" ? 1 : 2], note: `<b>Verdict:</b> ${verdict}`, vars: { "best-case saving": `${saved.toFixed(1)}%`, verdict: vst === "done" ? "optimise" : vst === "active" ? "optional" : "don't" } });
      return fr;
    },
    render: (f) => {
      const chain = f.steps.map((st, i) => {
        const cls = i < f.upto ? st.st : i === f.upto ? "active" : "pending";
        const ans = i <= f.upto ? `<div class="pp-small">${st.a}</div>` : "";
        return `<div class="pp-step ${cls === "active" && i < f.upto ? "" : cls}"><b>${esc(st.q)}</b>${i < f.upto || (f.upto === f.steps.length) ? badge(st.st === "done" ? "towards" : st.st === "bad" ? "stop" : st.st === "path" ? "away" : "neutral", st.st === "active" ? "" : st.st) : ""}${ans}</div>`;
      }).join('<div class="pp-arrow">↓</div>');
      const rest = (1 - f.p) * 100, part = f.p * 100, after = part / f.s;
      const bar = (a, b, lbl) => `<div class="pp-amd"><span>${lbl}</span><span class="pp-amd-t"><i class="pp-amd-rest" style="width:${a}%"></i><i class="pp-amd-hot" style="width:${b}%"></i></span><b>${(a + b).toFixed(0)}</b></div>`;
      const verdict = f.verdict ? `<div class="pp-verdict ${f.vst}">${esc(f.verdict)}</div>` : "";
      return `<div class="pp-col"><div class="pp-chain">${chain}</div>
        <div class="pp-amds"><div class="pp-small pp-muted">request time, before and after (best case)</div>${bar(rest, part, "before")}${bar(rest, after, "after")}<div class="pp-small pp-muted"><i class="pp-key pp-amd-rest"></i> everything else <i class="pp-key pp-amd-hot"></i> this code</div></div>${verdict}</div>`;
    },
  }));

  /* =====================================================================
   * 2. Algorithmic wins first: four ways to find matches
   * ===================================================================== */
  const BO_MAX = ["1,000", "10,000", "100,000", "1,000,000", "10,000,000"];
  const BO_ALGS = [
    { id: "nested", name: "nested loops", o: "O(n·m)", line: 1 },
    { id: "simd", name: "nested loops, vectorised", o: "O(n·m) / k", line: 2 },
    { id: "sort", name: "sort + binary search", o: "O((n+m) log n)", line: [4, 5] },
    { id: "hash", name: "hash set", o: "O(n+m)", line: [7, 8] },
  ];
  const boOps = (id, n, k) => {
    const lg = Math.log2(Math.max(2, n));
    if (id === "nested") return 0.75 * n * n;
    if (id === "simd") return (0.75 * n * n) / k + n;
    if (id === "sort") return 2 * n * lg + n * lg;
    return 20 * n;
  };
  Viz.register("performance-patterns-bigo", (el) => Viz.player(el, {
    title: "Algorithm before micro-optimisation: which incoming ids already exist?",
    tag: "SET THE SIZE AND THE SIMD SPEEDUP · STEP THROUGH THE SIZES",
    legend: [["done", "fastest at this size"], ["visit", "time (log scale)"], ["bad", "longer than a 1-second budget"]],
    codeLang: "csharp",
    code: [
      "// n known ids, m incoming ids (here m = n); about half of them exist",
      "foreach (var id in incoming) if (known.Contains(id)) hits++;   // List: linear scan",
      "// same loop, vectorised: Vector<long> compares k ids per instruction",
      "",
      "known.Sort();                                                   // n log n",
      "foreach (var id in incoming) if (known.BinarySearch(id) >= 0) hits++;",
      "",
      "var set = known.ToHashSet();                                    // n inserts",
      "foreach (var id in incoming) if (set.Contains(id)) hits++;      // O(1) each",
    ],
    inputs: [
      { key: "max", label: "largest n", type: "select", value: BO_MAX[3], options: BO_MAX },
      { key: "k", label: "SIMD speedup k (×)", value: "8", width: 70 },
      { key: "ns", label: "ns per basic operation", value: "1", width: 70 },
    ],
    random: () => ({ max: pick(Math.random, BO_MAX), k: String(pick(Math.random, [4, 8, 16, 32])), ns: String(pick(Math.random, [0.5, 1, 2])) }),
    build: ({ max, k, ns }) => {
      const M = num(max, "Largest n", 1000, 10000000), K = num(k, "SIMD speedup", 1, 64, false), NS = num(ns, "ns per operation", 0.1, 100, false);
      const fr = [];
      for (let n = 10; n <= M; n *= 10) {
        const rows = BO_ALGS.map((a) => ({ ...a, t: boOps(a.id, n, K) * NS }));
        const best = rows.reduce((b, r) => (r.t < b.t ? r : b));
        const nested = rows[0], hash = rows[3], simd = rows[1];
        let note;
        if (n <= 100) note = `n = ${big(n)}: everything is fast, and the plain nested loop ${best.id === "nested" || best.id === "simd" ? "is actually among the fastest: no allocation, no hashing, tiny data in cache" : "is still only " + fmtNs(nested.t)}. At this size, write the clearest code.`;
        else if (nested.t < 1e9) note = `n = ${big(n)}: the nested loop does ${big(0.75 * n * n)} comparisons (${fmtNs(nested.t)}). The hash set does about ${big(20 * n)} operations (${fmtNs(hash.t)}): <b>${(nested.t / hash.t).toFixed(0)}×</b> less work.`;
        else note = `n = ${big(n)}: the nested loop needs <b>${fmtNs(nested.t)}</b>; even vectorised ${K}× it needs ${fmtNs(simd.t)}. The hash set: <b>${fmtNs(hash.t)}</b>. No constant-factor trick survives a quadratic algorithm.`;
        fr.push({ rows, n, best: best.id, line: best.line, note, vars: { n: big(n), fastest: best.name, "nested / hash": `${(nested.t / hash.t).toFixed(1)}×` } });
      }
      const last = fr[fr.length - 1];
      fr.push({ ...last, line: [7, 8], note: `Summary at n = ${big(last.n)}: vectorising the quadratic loop bought ${K}×; changing the algorithm bought ${(last.rows[0].t / last.rows[3].t).toExponential(1).replace("e+", " × 10^")}. Fix the complexity first, then micro-optimise what the profiler still shows. Sort + binary search is a good choice when you need ordered output or can't afford the hash set's memory.`, vars: { "nested": fmtNs(last.rows[0].t), "hash set": fmtNs(last.rows[3].t) } });
      return fr;
    },
    render: (f) => {
      const ts = f.rows.map((r) => r.t), lo = Math.log10(Math.min(...ts)) - 0.3, hi = Math.max(Math.log10(Math.max(...ts)), lo + 1) + 0.1;
      const rows = f.rows.map((r) => {
        const w = Math.max(2, ((Math.log10(r.t) - lo) / (hi - lo)) * 100);
        const cls = r.id === f.best ? "done" : r.t > 1e9 ? "bad" : "visit";
        return `<div class="pp-brow"><span class="pp-bname">${esc(r.name)} <code>${esc(r.o)}</code></span><span class="pp-bar-t"><i class="pp-bar-f ${cls}" style="width:${w.toFixed(1)}%"></i></span><b class="${r.t > 1e9 ? "pp-t-bad" : ""}">${fmtNs(r.t)}</b></div>`;
      }).join("");
      return `<div class="pp-col"><div class="pp-stats"><span>n = m = <b>${big(f.n)}</b></span><span>fastest: <b>${esc(f.rows.find((r) => r.id === f.best).name)}</b></span></div><div class="pp-brows">${rows}</div><div class="pp-small pp-muted">bar length is log scale: each step right is about 10× slower</div></div>`;
    },
  }));

  /* =====================================================================
   * 3. Building a string: copies and allocations
   * ===================================================================== */
  const SC_STRATS = ["s += piece in a loop", "StringBuilder (grows by doubling)", "StringBuilder presized", "collect, then string.Join"];
  const scCost = (strat, k, n, L) => {
    /* returns { alloc, copy, count } in chars after k appends (k === n includes the final ToString) */
    if (strat === 0) return { alloc: (L * k * (k + 1)) / 2, copy: (L * k * (k + 1)) / 2, count: k };
    if (strat === 1) {
      let cap = 16, alloc = 16, copy = 0, count = 1;
      for (let i = 1; i <= k; i++) { const need = i * L; if (need > cap) { copy += (i - 1) * L; cap = Math.max(cap * 2, need); alloc += cap; count++; } copy += L; }
      if (k === n) { alloc += n * L; copy += n * L; count++; }
      return { alloc, copy, count };
    }
    if (strat === 2) return { alloc: n * L + (k === n ? n * L : 0), copy: k * L + (k === n ? n * L : 0), count: k === n ? 2 : 1 };
    return { alloc: 4 * Math.max(4, k) + (k === n ? n * L : 0), copy: k === n ? n * L : 0, count: Math.ceil(Math.log2(Math.max(4, k))) + (k === n ? 1 : 0) };
  };
  Viz.register("performance-patterns-concat", (el) => Viz.player(el, {
    title: "Building a string piece by piece: bytes allocated and copied",
    tag: "PICK A STRATEGY · STEP THROUGH THE APPENDS",
    legend: [["bad", "s += piece"], ["visit", "StringBuilder, growing"], ["done", "StringBuilder, presized"], ["path", "collect + Join"]],
    codeLang: "csharp",
    code: [
      "var s = \"\"; foreach (var p in pieces) s += p;      // a new string every time",
      "var sb = new StringBuilder(); foreach (var p in pieces) sb.Append(p); var r = sb.ToString();",
      "var sb = new StringBuilder(totalLength); /* same loop */ var r = sb.ToString();",
      "var r = string.Join(\"\", pieces);                     // measures, then allocates once",
    ],
    inputs: [
      { key: "strat", label: "strategy", type: "select", value: SC_STRATS[0], options: SC_STRATS },
      { key: "n", label: "pieces", value: "5000", width: 80 },
      { key: "len", label: "chars per piece", value: "12", width: 70 },
    ],
    random: () => ({ strat: pick(Math.random, SC_STRATS), n: String(pick(Math.random, [100, 1000, 5000, 20000])), len: String(Viz.rand(4, 40)) }),
    build: ({ strat, n, len }) => {
      const S = SC_STRATS.indexOf(strat), N = num(n, "Pieces", 10, 50000), L = num(len, "Chars per piece", 1, 500);
      if (S < 0) throw new Error("Pick a strategy.");
      const pts = [];
      for (let i = 0; i <= 40; i++) pts.push(Math.max(1, Math.round((N * i) / 40)));
      const series = SC_STRATS.map((_, s) => pts.map((k) => scCost(s, k, N, L).alloc * 2));
      const fr = [];
      const checks = [0.02, 0.1, 0.25, 0.5, 0.75, 1].map((x) => Math.max(1, Math.round(N * x)));
      const finalBytes = N * L * 2;
      for (const k of checks) {
        const c = scCost(S, k, N, L), bytes = c.alloc * 2;
        const ratio = bytes / (k * L * 2);
        const notes = [
          `After ${big(k)} appends the string is ${fmtB(k * L * 2)}, but <b>${fmtB(bytes)}</b> has been allocated: each <code>+=</code> creates a new string and copies everything before it. That is ${big(k)} allocations and O(n²) copying (${ratio.toFixed(0)}× the final size).`,
          `After ${big(k)} appends: ${big(c.count)} buffer allocations (the capacity doubles when full, copying the old content), ${fmtB(bytes)} allocated in total, ${ratio.toFixed(1)}× the string size. ${k === N ? "ToString() copies the buffer into the final string once." : ""}`,
          `After ${big(k)} appends: one buffer of ${fmtB(finalBytes)} allocated up front, never regrown. ${k === N ? "ToString() makes the one final copy." : "Each append copies only the new piece."}`,
          `After ${big(k)} appends: the pieces already exist, so collecting them costs only a list of references. ${k === N ? "Join measures the total length, allocates the result once and copies each piece once." : ""}`,
        ];
        fr.push({ series, pts, S, k, N, L, c, line: S, note: notes[S], vars: { appends: big(k), allocated: fmtB(bytes), copied: fmtB(c.copy * 2), allocations: big(c.count) } });
      }
      const all = SC_STRATS.map((_, s) => scCost(s, N, N, L).alloc * 2);
      fr.push({ series, pts, S, k: N, N, L, c: scCost(S, N, N, L), line: [0, 1, 2, 3], note: `Totals for ${big(N)} pieces (final string ${fmtB(finalBytes)}): <b>+=</b> ${fmtB(all[0])}, growing builder ${fmtB(all[1])}, presized ${fmtB(all[2])}, Join ${fmtB(all[3])}. The loop with <code>+=</code> is the only quadratic one. Note: <code>a + b + c</code> in one expression is fine; compilers turn it into a single concat. In Python and JavaScript use <code>"".join(parts)</code> and <code>parts.join("")</code>; CPython sometimes resizes in place for <code>+=</code>, but don't rely on it.`, vars: { "+=": fmtB(all[0]), presized: fmtB(all[2]) } });
      return fr;
    },
    render: (f) => {
      const W = 520, H = 190, PL = 54, PB = 24, PT = 10;
      const all = f.series.flat().filter((v) => v > 0);
      const lo = Math.floor(Math.log10(Math.min(...all))), hi = Math.ceil(Math.log10(Math.max(...all)));
      const X = (k) => PL + ((k - f.pts[0]) / Math.max(1, f.N - f.pts[0])) * (W - PL - 10);
      const Y = (v) => PT + (1 - (Math.log10(Math.max(v, 10 ** lo)) - lo) / Math.max(1, hi - lo)) * (H - PT - PB);
      const cls = ["bad", "visit", "done", "path"];
      let s = `<svg class="pp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="bytes allocated as pieces are appended, log scale">`;
      for (let e = lo; e <= hi; e += Math.max(1, Math.ceil((hi - lo) / 5))) s += `<line class="pp-gline" x1="${PL}" x2="${W - 8}" y1="${Y(10 ** e)}" y2="${Y(10 ** e)}"/><text class="pp-lbl" x="${PL - 4}" y="${Y(10 ** e) + 3}" text-anchor="end">${fmtB(10 ** e)}</text>`;
      f.series.forEach((ser, i) => {
        const d = ser.map((v, j) => `${j ? "L" : "M"}${X(f.pts[j]).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
        s += `<path class="pp-line ${cls[i]} ${i === f.S ? "sel" : ""}" d="${d}"/>`;
      });
      const cx = X(f.k);
      s += `<line class="pp-cursor" x1="${cx}" x2="${cx}" y1="${PT}" y2="${H - PB}"/><circle class="pp-dot ${cls[f.S]}" cx="${cx}" cy="${Y(f.c.alloc * 2)}" r="4"/>`;
      s += `<text class="pp-lbl" x="${PL}" y="${H - 6}">0</text><text class="pp-lbl" x="${W - 8}" y="${H - 6}" text-anchor="end">${big(f.N)} pieces</text></svg>`;
      return `<div class="pp-col">${s}<div class="pp-stats"><span>string so far <b>${fmtB(f.k * f.L * 2)}</b></span><span>allocated <b class="${f.S === 0 ? "pp-t-bad" : ""}">${fmtB(f.c.alloc * 2)}</b></span><span>copied <b>${fmtB(f.c.copy * 2)}</b></span><span>allocations <b>${big(f.c.count)}</b></span></div><div class="pp-small pp-muted">2 bytes per char (UTF-16 as in .NET and Java); y axis is log scale</div></div>`;
    },
  }));

  /* =====================================================================
   * 4. Memory layout: array of structs, struct of arrays, array of references
   * ===================================================================== */
  const LY_MODES = ["array of structs (AoS)", "struct of arrays (SoA)", "array of object references"];
  Viz.register("performance-patterns-layout", (el) => Viz.player(el, {
    title: "Summing one field: which 64-byte cache lines does the CPU fetch?",
    tag: "PICK A LAYOUT · STEP THROUGH THE ELEMENTS",
    legend: [["done", "fetched and used"], ["visit", "fetched, not needed"], ["bad", "cache miss on a scattered object"], ["path", "pointer read"]],
    codeLang: "csharp",
    code: [
      "struct Particle { double X, Y, Z, Vx, Vy, Vz, Mass, Charge; }   // F fields × 8 bytes",
      "Particle[] ps;            double total = 0;",
      "for (int i = 0; i < n; i++) total += ps[i].Mass;            // AoS: strides over F×8 bytes",
      "double[] mass;            // SoA: one array per field",
      "for (int i = 0; i < n; i++) total += mass[i];               // dense: 8 masses per line",
      "class ParticleObj { ... }  ParticleObj[] objs;              // Java/C# objects, Python lists",
      "for (int i = 0; i < n; i++) total += objs[i].Mass;          // pointer, then a jump",
    ],
    inputs: [
      { key: "mode", label: "layout", type: "select", value: LY_MODES[0], options: LY_MODES },
      { key: "fields", label: "fields per element (8 B each)", value: "8", width: 70 },
      { key: "n", label: "elements (for totals)", value: "1000000", width: 100 },
      seedInput,
    ],
    random: () => ({ mode: pick(Math.random, LY_MODES), fields: String(pick(Math.random, [2, 4, 6, 8, 12])), n: String(pick(Math.random, [10000, 1000000, 10000000])), seed: randSeed() }),
    build: ({ mode, fields, n, seed }) => {
      const M = LY_MODES.indexOf(mode), F = num(fields, "Fields per element", 2, 16), N = num(n, "Elements", 100, 100000000);
      if (M < 0) throw new Error("Pick a layout.");
      const r = rng(num(seed, "Seed", 0, 1e9));
      const SHOW = 16, field = Math.min(6, F - 1);
      /* heap for objects: shuffled slots, each object occupies ceil((16+F*8)/64) lines */
      const objLines = Math.ceil((16 + F * 8) / 64);
      const heapSlots = [];
      for (let i = 0; i < 32; i++) heapSlots.push(i);
      for (let i = heapSlots.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [heapSlots[i], heapSlots[j]] = [heapSlots[j], heapSlots[i]]; }
      const fetched = new Set();
      const fr = [];
      const checkpoints = [0, 1, 2, 3, 7, 11, 15];
      let lastI = -1;
      for (const ci of checkpoints) {
        for (let i = lastI + 1; i <= ci; i++) {
          if (M === 0) fetched.add(`a${Math.floor((i * F + field) / 8)}`);
          else if (M === 1) fetched.add(`s${Math.floor(i / 8)}`);
          else { fetched.add(`p${Math.floor(i / 8)}`); for (let L = 0; L < objLines; L++) fetched.add(`h${heapSlots[i] * objLines + L}`); }
        }
        lastI = ci;
        const lines = fetched.size, useful = (ci + 1) * 8;
        const notes = [
          `Element ${ci}: its Mass sits at byte ${(ci * F + field) * 8}. The CPU fetches whole 64-byte lines, so it also drags in the other ${F - 1} fields it doesn't need. ${lines} line${lines > 1 ? "s" : ""} so far for ${ci + 1} masses.`,
          `Element ${ci}: masses are packed together, 8 per cache line, and the access is sequential, so the hardware prefetcher fetches the next line before it is needed. ${lines} line${lines > 1 ? "s" : ""} for ${ci + 1} masses: every fetched byte is used.`,
          `Element ${ci}: first read the reference (8 per line in the array), then jump to wherever the allocator put the object. Those jumps are unpredictable, so each one can be a full cache miss (~80–100 ns) that the prefetcher can't hide.`,
        ];
        fr.push({ M, F, field, fetched: new Set(fetched), heapSlots, objLines, upto: ci, SHOW, line: M === 0 ? [0, 2] : M === 1 ? [3, 4] : [5, 6], note: notes[M], vars: { element: ci, "lines fetched": lines, "useful bytes": `${Math.round((100 * useful) / (lines * 64))}%` } });
      }
      /* totals for N */
      const seqNs = 4, missNs = 90;
      const tot = [
        { name: "AoS", lines: Math.ceil((N * F * 8) / 64), ns: Math.ceil((N * F * 8) / 64) * seqNs },
        { name: "SoA", lines: Math.ceil(N / 8), ns: Math.ceil(N / 8) * seqNs },
        { name: "references", lines: Math.ceil(N / 8) + N * objLines, ns: Math.ceil(N / 8) * seqNs + N * missNs * 0.35 },
      ];
      fr.push({ M, F, field, fetched: new Set(fetched), heapSlots, objLines, upto: 15, SHOW, tot, line: [2, 4, 6], note: `For ${big(N)} elements with ${F} fields: AoS fetches ${big(tot[0].lines)} lines (${fmtB(tot[0].lines * 64)}), SoA ${big(tot[1].lines)} (${fmtB(tot[1].lines * 64)}), references ${big(tot[2].lines)} with mostly random access. Rough times: ${fmtNs(tot[0].ns)}, ${fmtNs(tot[1].ns)}, ${fmtNs(tot[2].ns)}. SoA wins for "one field of everything"; AoS wins when you use most fields of one element at a time.`, vars: { AoS: fmtNs(tot[0].ns), SoA: fmtNs(tot[1].ns), refs: fmtNs(tot[2].ns) } });
      return fr;
    },
    render: (f) => {
      const cell = (cls, txt) => `<i class="pp-cell ${cls}">${txt}</i>`;
      const row = (label, cells, cls) => `<div class="pp-mrow ${cls || ""}"><span class="pp-mlbl">${label}</span>${cells}</div>`;
      let rows = "";
      const FN = ["X", "Y", "Z", "Vx", "Vy", "Vz", "M", "Q", "f8", "f9", "f10", "f11", "f12", "f13", "f14", "f15"];
      if (f.M === 0) {
        const nLines = Math.ceil((f.SHOW * f.F) / 8);
        for (let L = 0; L < Math.min(nLines, 16); L++) {
          const on = f.fetched.has(`a${L}`);
          let cells = "";
          for (let c = 0; c < 8; c++) {
            const slot = L * 8 + c, el = Math.floor(slot / f.F), fi = slot % f.F;
            const isM = fi === f.field, used = isM && el <= f.upto;
            cells += cell(!on ? "" : used ? "done" : "visit", `${esc(fi === f.field ? "M" : FN[fi] === "M" ? "f6" : FN[fi])}<sub>${el}</sub>`);
          }
          rows += row(`line ${L}`, cells, on ? "on" : "");
        }
        if (nLines > 16) rows += `<div class="pp-small pp-muted">… ${nLines - 16} more lines for the first ${f.SHOW} elements</div>`;
      } else if (f.M === 1) {
        for (let L = 0; L < 2; L++) {
          const on = f.fetched.has(`s${L}`);
          let cells = "";
          for (let c = 0; c < 8; c++) { const el = L * 8 + c; cells += cell(on ? (el <= f.upto ? "done" : "visit") : "", `M<sub>${el}</sub>`); }
          rows += row(`mass ${L}`, cells, on ? "on" : "");
        }
        rows += `<div class="pp-small pp-muted">X[], Y[], Z[], Vx[] … ${f.F - 1} other arrays: never touched</div>`;
        for (let L = 0; L < 2; L++) { let cells = ""; for (let c = 0; c < 8; c++) cells += cell("", `X<sub>${L * 8 + c}</sub>`); rows += row(`X ${L}`, cells, ""); }
      } else {
        for (let L = 0; L < 2; L++) {
          const on = f.fetched.has(`p${L}`);
          let cells = "";
          for (let c = 0; c < 8; c++) { const el = L * 8 + c; cells += cell(on ? (el <= f.upto ? "path" : "visit") : "", `→${el}`); }
          rows += row(`refs ${L}`, cells, on ? "on" : "");
        }
        const owner = {};
        f.heapSlots.slice(0, f.SHOW).forEach((s, i) => { owner[s] = i; });
        let heap = "";
        for (let s = 0; s < 32; s++) {
          const i = owner[s];
          const on = i !== undefined && i <= f.upto;
          heap += `<i class="pp-hcell ${i === undefined ? "free" : on ? (i === f.upto ? "bad" : "done") : ""}">${i === undefined ? "" : i}</i>`;
        }
        rows += `<div class="pp-small pp-muted">heap: objects where the allocator happened to put them (${f.objLines} line${f.objLines > 1 ? "s" : ""} each, header + ${f.F} fields)</div><div class="pp-heap">${heap}</div>`;
      }
      const tot = f.tot ? `<div class="pp-stats">${f.tot.map((t) => `<span>${t.name}: <b>${fmtB(t.lines * 64)}</b> fetched, ~<b>${fmtNs(t.ns)}</b></span>`).join("")}</div>` : "";
      return `<div class="pp-col"><div class="pp-mem">${rows}</div>${tot}</div>`;
    },
  }));

  /* =====================================================================
   * 5. Branch prediction: a 2-bit saturating counter
   * ===================================================================== */
  const BR_DATA = ["random bytes", "sorted bytes", "alternating pattern", "95% above the threshold"];
  const BR_CODE = ["if (branch)", "branchless (conditional move / mask)"];
  Viz.register("performance-patterns-branch", (el) => Viz.player(el, {
    title: "Why sorted data sums faster: a branch predictor at work",
    tag: "PICK THE DATA AND THE CODE · STEP THROUGH THE LOOP",
    legend: [["done", "predicted correctly"], ["bad", "mispredicted: pipeline flushed"], ["active", "current element"], ["path", "no branch to predict"]],
    codeLang: "csharp",
    code: [
      "long sum = 0;",
      "for (int i = 0; i < data.Length; i++)",
      "    if (data[i] >= 128) sum += data[i];          // a conditional jump the CPU must guess",
      "// branchless: the same result with no jump",
      "    sum += data[i] & -(data[i] >= 128 ? 1 : 0);   // compilers often emit cmov here",
    ],
    inputs: [
      { key: "data", label: "data", type: "select", value: BR_DATA[0], options: BR_DATA },
      { key: "code", label: "code", type: "select", value: BR_CODE[0], options: BR_CODE },
      { key: "n", label: "elements", value: "100000", width: 90 },
      seedInput,
    ],
    random: () => ({ data: pick(Math.random, BR_DATA), code: pick(Math.random, BR_CODE), n: String(pick(Math.random, [1000, 100000, 1000000])), seed: randSeed() }),
    build: ({ data, code, n, seed }) => {
      const D = BR_DATA.indexOf(data), C = BR_CODE.indexOf(code), N = num(n, "Elements", 100, 5000000);
      if (D < 0 || C < 0) throw new Error("Pick the data and the code.");
      const r = rng(num(seed, "Seed", 0, 1e9));
      const gen = () => {
        const a = new Uint8Array(N);
        for (let i = 0; i < N; i++) a[i] = D === 2 ? (i % 2 ? 200 : 40) : D === 3 ? (r() < 0.95 ? 128 + Math.floor(r() * 128) : Math.floor(r() * 128)) : Math.floor(r() * 256);
        if (D === 1) a.sort();
        return a;
      };
      const a = gen();
      const PEN = 15;
      let ctr = 1, miss = 0;
      const trace = [];
      for (let i = 0; i < N; i++) {
        const taken = a[i] >= 128, pred = ctr >= 2;
        const ok = C === 1 || pred === taken;
        if (!ok) miss++;
        if (C === 0) ctr = taken ? Math.min(3, ctr + 1) : Math.max(0, ctr - 1);
        if (trace.length < 400) trace.push({ v: a[i], taken, pred, ok, ctr });
      }
      const cycles = C === 1 ? N * 1.6 : N * 1 + miss * PEN;
      /* where to show: for sorted, show around the switch point */
      let start = 0;
      if (D === 1) { let k = 0; while (k < N && a[k] < 128) k++; start = Math.max(0, k - 10); }
      const win = [];
      for (let i = start; i < Math.min(N, start + 24); i++) {
        const taken = a[i] >= 128;
        win.push({ i, v: a[i] });
      }
      /* recompute counter states along the window */
      let c2 = 1; const st = [];
      for (let i = 0; i < Math.min(N, start + 24); i++) {
        const taken = a[i] >= 128, pred = c2 >= 2;
        if (i >= start) st.push({ i, v: a[i], taken, pred, ok: C === 1 || pred === taken, ctr: c2 });
        if (C === 0) c2 = taken ? Math.min(3, c2 + 1) : Math.max(0, c2 - 1);
      }
      const fr = [];
      const show = [0, 1, 2, 3, 5, 9, 11, 13, 17, 23].filter((x) => x < st.length);
      const CN = ["strongly not-taken", "weakly not-taken", "weakly taken", "strongly taken"];
      for (const k of show) {
        const s = st[k];
        const note = C === 1
          ? `data[${s.i}] = ${s.v}: no branch. The CPU computes a mask and always adds (${s.v >= 128 ? s.v : 0}). The cost is the same for every element, whatever the data looks like.`
          : `data[${s.i}] = ${s.v}. The predictor is "${CN[s.ctr]}", so it guesses <b>${s.pred ? "taken" : "not taken"}</b>; the real outcome is ${s.taken ? "taken (≥ 128)" : "not taken (&lt; 128)"}. ${s.ok ? "Correct: the pipeline keeps flowing." : `<b>Mispredicted</b>: about ${PEN} cycles of speculative work are thrown away.`}`;
        fr.push({ st, k, C, line: C === 1 ? 4 : 2, note, vars: { i: s.i, "data[i]": s.v, counter: C === 1 ? "—" : s.ctr, guess: C === 1 ? "—" : s.pred ? "taken" : "not taken" } });
      }
      const rate = (100 * miss) / N;
      const msg = C === 1 ? "Branchless code costs a little more per element but never mispredicts, so random data is as fast as sorted data."
        : D === 0 ? "Random data defeats the predictor about half the time, and every miss costs a pipeline flush."
        : D === 1 ? "Sorted data mispredicts only around the single switch point: the counter saturates and stays right."
        : D === 2 ? "A 2-bit counter can't learn alternation (real CPUs use history-based predictors that can, but complex patterns still defeat them)."
        : "A strongly biased branch is cheap: the predictor is right ~95% of the time.";
      fr.push({ st, k: st.length - 1, C, line: C === 1 ? [3, 4] : [1, 2], note: `Over all ${big(N)} elements: <b>${big(miss)}</b> mispredictions (${rate.toFixed(1)}%), about ${big(cycles)} cycles, ${(cycles / N).toFixed(1)} per element. ${msg} Sorting costs O(n log n), so sort for this only if you reuse the sorted data.`, vars: { mispredicts: `${rate.toFixed(1)}%`, "cycles/element": (cycles / N).toFixed(1) } });
      return fr;
    },
    render: (f) => {
      const cells = f.st.map((s, idx) => {
        const cls = idx > f.k ? "" : idx === f.k ? "active" : f.C === 1 ? "path" : s.ok ? "done" : "bad";
        return `<div class="pp-bcell ${cls}"><b>${s.v}</b><span>${idx <= f.k ? (f.C === 1 ? "—" : (s.pred ? "T" : "N") + (s.ok ? "" : "✗")) : ""}</span></div>`;
      }).join("");
      const cur = f.st[Math.min(f.k, f.st.length - 1)];
      const states = ["SN", "WN", "WT", "ST"].map((nm, i) => `<span class="pp-ctr ${f.C === 0 && cur.ctr === i ? "active" : ""}">${nm}</span>`).join('<span class="pp-ctr-arrow">⇄</span>');
      return `<div class="pp-col"><div class="pp-small pp-muted">data[i] with the guess (T = taken, N = not taken, ✗ = wrong); threshold 128</div><div class="pp-bstrip">${cells}</div><div class="pp-small pp-muted">2-bit counter (moves one step towards each real outcome)</div><div class="pp-ctrs">${f.C === 1 ? '<span class="pp-ctr path">no branch: nothing to predict</span>' : states}</div></div>`;
    },
  }));

  /* =====================================================================
   * 6. Chatty I/O: one call per item vs batching vs parallel
   * ===================================================================== */
  const BA_MODES = ["one call per item (sequential)", "batches", "one call per item, in parallel"];
  const baPlan = (mode, N, rtt, over, per, B, P) => {
    const reqs = [];
    if (mode === 1) {
      let t = 0;
      for (let i = 0; i < N; i += B) { const k = Math.min(B, N - i); const d = rtt + over + k * per; reqs.push({ lane: 0, s: t, e: t + d, k }); t += d; }
    } else {
      const lanes = mode === 0 ? 1 : P, free = new Array(lanes).fill(0);
      for (let i = 0; i < N; i++) {
        let L = 0; for (let j = 1; j < lanes; j++) if (free[j] < free[L]) L = j;
        const d = rtt + over + per * (mode === 2 ? 1 + 0.15 * (lanes - 1) / 4 : 1);
        reqs.push({ lane: L, s: free[L], e: free[L] + d, k: 1 }); free[L] += d;
      }
    }
    return reqs;
  };
  Viz.register("performance-patterns-batching", (el) => Viz.player(el, {
    title: "Chatty I/O: the round trip, not the work, dominates",
    tag: "SET LATENCY AND BATCH SIZE · STEP THROUGH THE CALLS",
    legend: [["bad", "one call per item"], ["done", "batched call"], ["visit", "parallel calls"]],
    codeLang: "csharp",
    code: [
      "foreach (var id in ids) prices.Add(await api.GetPriceAsync(id));          // N round trips",
      "foreach (var chunk in ids.Chunk(batchSize))",
      "    prices.AddRange(await api.GetPricesAsync(chunk));                        // N / B round trips",
      "await Parallel.ForEachAsync(ids, new ParallelOptions { MaxDegreeOfParallelism = p },",
      "    async (id, ct) => bag.Add(await api.GetPriceAsync(id, ct)));            // N trips, p at a time",
    ],
    inputs: [
      { key: "mode", label: "strategy", type: "select", value: BA_MODES[0], options: BA_MODES },
      { key: "n", label: "items", value: "200", width: 70 },
      { key: "rtt", label: "round trip (ms)", value: "2", width: 70 },
      { key: "over", label: "per-call overhead (ms)", value: "0.5", width: 70 },
      { key: "per", label: "work per item (ms)", value: "0.05", width: 70 },
      { key: "b", label: "batch size", value: "50", width: 60 },
      { key: "p", label: "parallelism", value: "8", width: 60 },
    ],
    random: () => ({ mode: pick(Math.random, BA_MODES), n: String(pick(Math.random, [50, 200, 500])), rtt: String(pick(Math.random, [0.5, 2, 10, 40])), over: String(pick(Math.random, [0.1, 0.5, 2])), per: String(pick(Math.random, [0.01, 0.05, 0.5])), b: String(pick(Math.random, [10, 50, 100, 500])), p: String(pick(Math.random, [4, 8, 16])) }),
    build: ({ mode, n, rtt, over, per, b, p }) => {
      const M = BA_MODES.indexOf(mode); if (M < 0) throw new Error("Pick a strategy.");
      const N = num(n, "Items", 1, 1000), R = num(rtt, "Round trip", 0, 500, false), O = num(over, "Per-call overhead", 0, 100, false), W = num(per, "Work per item", 0, 100, false), B = num(b, "Batch size", 1, 1000), P = num(p, "Parallelism", 1, 64);
      const reqs = baPlan(M, N, R, O, W, B, P);
      const total = Math.max(...reqs.map((q) => q.e));
      const alt = [0, 1, 2].map((m) => Math.max(...baPlan(m, N, R, O, W, B, P).map((q) => q.e)));
      const fr = [];
      const marks = [0.1, 0.3, 0.6, 1].map((x) => total * x);
      for (const t of marks) {
        const done = reqs.filter((q) => q.e <= t + 1e-9).reduce((a, q) => a + q.k, 0);
        const calls = reqs.filter((q) => q.s < t).length;
        const waitShare = (100 * (R * reqs.length)) / reqs.reduce((a, q) => a + (q.e - q.s), 0);
        const notes = [
          `${fmtMs(t)} in: ${done} of ${N} items fetched with ${calls} calls. Each call pays the ${fmtMs(R)} round trip and ${fmtMs(O)} overhead to do ${fmtMs(W)} of real work: ${waitShare.toFixed(0)}% of the time is spent waiting on the wire.`,
          `${fmtMs(t)} in: ${done} of ${N} items with ${calls} call${calls > 1 ? "s" : ""}. One round trip and one overhead are shared by up to ${B} items.`,
          `${fmtMs(t)} in: ${done} of ${N} items with ${calls} calls, ${P} in flight. Wall time drops, but the server still handles ${N} requests and the extra concurrency adds contention there.`,
        ];
        fr.push({ reqs, total, t, M, N, line: M === 0 ? 0 : M === 1 ? [1, 2] : [3, 4], note: notes[M], vars: { elapsed: fmtMs(t), items: `${done}/${N}`, calls } });
      }
      fr.push({ reqs, total, t: total, M, N, alt, line: [0, 2, 4], note: `All strategies for ${N} items: sequential <b>${fmtMs(alt[0])}</b> (${N} calls), batches of ${B} <b>${fmtMs(alt[1])}</b> (${Math.ceil(N / B)} calls), ${P}-way parallel <b>${fmtMs(alt[2])}</b> (${N} calls). Batching cuts both wall time and load; parallelism cuts only wall time. The same arithmetic is the N+1 query problem in a database.`, vars: { sequential: fmtMs(alt[0]), batched: fmtMs(alt[1]), parallel: fmtMs(alt[2]) } });
      return fr;
    },
    render: (f) => {
      const lanes = Math.max(...f.reqs.map((q) => q.lane)) + 1;
      const W = 520, LH = Math.max(8, Math.min(22, 150 / lanes)), H = lanes * LH + 34;
      const X = (t) => 10 + (t / f.total) * (W - 20);
      const cls = ["bad", "done", "visit"][f.M];
      let s = `<svg class="pp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="timeline of calls">`;
      for (const q of f.reqs) {
        if (q.s >= f.t) continue;
        const e = Math.min(q.e, f.t), x = X(q.s), w = Math.max(0.6, X(e) - x - (f.reqs.length > 120 ? 0 : 0.8));
        s += `<rect class="pp-req ${cls}" x="${x.toFixed(1)}" y="${8 + q.lane * LH}" width="${w.toFixed(1)}" height="${LH - 3}" rx="1.5"/>`;
      }
      s += `<line class="pp-cursor" x1="${X(f.t)}" x2="${X(f.t)}" y1="4" y2="${H - 22}"/><text class="pp-lbl" x="10" y="${H - 6}">0</text><text class="pp-lbl" x="${W - 10}" y="${H - 6}" text-anchor="end">${fmtMs(f.total)}</text></svg>`;
      const cmp = f.alt ? `<div class="pp-brows">${["sequential", "batched", "parallel"].map((nm, i) => `<div class="pp-brow"><span class="pp-bname">${nm}</span><span class="pp-bar-t"><i class="pp-bar-f ${["bad", "done", "visit"][i]}" style="width:${Math.max(2, (100 * f.alt[i]) / Math.max(...f.alt)).toFixed(1)}%"></i></span><b>${fmtMs(f.alt[i])}</b></div>`).join("")}</div>` : "";
      return `<div class="pp-col"><div class="pp-small pp-muted">each bar is one call (${lanes > 1 ? `${lanes} lanes = ${lanes} calls in flight` : "one at a time"})</div>${s}${cmp}</div>`;
    },
  }));

  /* =====================================================================
   * 7. Streaming vs loading everything
   * ===================================================================== */
  const ST_MODES = ["load all, then serialise, then send", "stream rows as they are read"];
  Viz.register("performance-patterns-streaming", (el) => Viz.player(el, {
    title: "Export a big result set: peak memory and time to first byte",
    tag: "SET THE SIZE · STEP THROUGH TIME",
    legend: [["bad", "memory held (load all)"], ["done", "memory held (stream)"], ["active", "first byte reaches the client"]],
    codeLang: "csharp",
    code: [
      "var rows = await db.Orders.ToListAsync();                // every row in memory",
      "var json = JsonSerializer.Serialize(rows);                // and a second copy as text",
      "return Results.Content(json, \"application/json\");      // only now does the client get a byte",
      "// streaming: IAsyncEnumerable flows rows straight into the response",
      "app.MapGet(\"/orders\", (Db db) => db.Orders.AsNoTracking().AsAsyncEnumerable());",
    ],
    inputs: [
      { key: "mode", label: "strategy", type: "select", value: ST_MODES[0], options: ST_MODES },
      { key: "rows", label: "rows", value: "500000", width: 90 },
      { key: "size", label: "bytes per row (JSON)", value: "400", width: 80 },
      { key: "net", label: "client bandwidth (MB/s)", value: "50", width: 70 },
    ],
    random: () => ({ mode: pick(Math.random, ST_MODES), rows: String(pick(Math.random, [10000, 100000, 500000, 2000000])), size: String(pick(Math.random, [100, 400, 1500])), net: String(pick(Math.random, [5, 50, 200])) }),
    build: ({ mode, rows, size, net }) => {
      const M = ST_MODES.indexOf(mode); if (M < 0) throw new Error("Pick a strategy.");
      const N = num(rows, "Rows", 100, 10000000), S = num(size, "Bytes per row", 10, 100000), NET = num(net, "Bandwidth", 0.1, 10000, false);
      const readMs = 0.004, serMs = (S / 400) * 0.002, sendMs = S / (NET * 1000);
      const objBytes = S * 2.5;
      const plan = (m) => {
        if (m === 0) {
          const t1 = N * readMs, t2 = t1 + N * serMs, t3 = t2 + N * sendMs;
          const mem = (t) => (t <= t1 ? (t / t1) * N * objBytes : t <= t2 ? N * objBytes + ((t - t1) / (t2 - t1)) * N * S * 2 : t <= t3 ? N * objBytes + N * S * 2 : 0);
          return { t1, t2, t3, ttfb: t2 + sendMs, total: t3, peak: N * objBytes + N * S * 2, mem };
        }
        const per = Math.max(readMs, serMs, sendMs), bufRows = Math.max(1, Math.ceil(16384 / S)) + 64;
        const total = N * per + readMs + serMs + sendMs, peak = bufRows * (objBytes + S) + 32768;
        const ramp = Math.max(readMs * 64, total / 200);
        return { t1: 0, t2: 0, t3: total, ttfb: readMs + serMs + sendMs + 1, total, peak, mem: (t) => (t <= total ? Math.min(peak, (t / ramp) * peak) : 0) };
      };
      const pl = plan(M), other = plan(1 - M);
      const T = Math.max(pl.total, other.total);
      const pts = (p) => { const a = []; for (let i = 0; i <= 80; i++) { const t = (T * i) / 80; a.push([t, p.mem(t)]); } return a; };
      const series = M === 0 ? [pts(pl), pts(other)] : [pts(other), pts(pl)];
      const fr = [];
      const marks = M === 0 ? [pl.t1 * 0.5, pl.t1, pl.t2, pl.t2 + (pl.t3 - pl.t2) * 0.5, pl.t3] : [pl.ttfb, pl.total * 0.25, pl.total * 0.6, pl.total];
      const notesA = [
        `Reading rows into a list: ${fmtB(pl.mem(marks[0]))} held already, and the client has received nothing.`,
        `All ${big(N)} rows are now objects in memory: ${fmtB(N * objBytes)} (objects cost more than their JSON: headers, pointers, UTF-16 strings).`,
        `Serialised into one big string: another ${fmtB(N * S * 2)}. Peak <b>${fmtB(pl.peak)}</b>, ${pl.peak > 85000 ? "far above the 85 KB large-object threshold in .NET, so the big arrays and the string land on the LOH and need a gen-2 GC to free." : "small enough here."} Only now can the first byte go out, after ${fmtMs(pl.ttfb)}.`,
        `Sending ${fmtB(N * S)} to the client at ${NET} MB/s while everything stays in memory.`,
        `Done in ${fmtMs(pl.t3)}. Ten such requests at once would need ${fmtB(pl.peak * 10)}: this is how export endpoints take down servers.`,
      ];
      const slow = sendMs >= readMs && sendMs >= serMs ? "the client's bandwidth" : readMs >= serMs ? "the database read" : "serialisation";
      const notesB = [
        `The first rows are read, serialised and flushed: the client gets its first byte after <b>${fmtMs(pl.ttfb)}</b>.`,
        `Steady state: reading, serialising and sending overlap. Memory stays at about <b>${fmtB(pl.peak)}</b>, the size of the buffers, no matter how many rows.`,
        `The slowest stage sets the pace (${slow}). If the client is slow, TCP flow control fills the socket buffer and the writer awaits: back-pressure travels up the pipeline for free.`,
        `Done in ${fmtMs(pl.total)}. The trade-off: once the 200 status and headers are sent you can't change them, so an error halfway produces a truncated body. Validate first, then stream.`,
      ];
      marks.forEach((t, i) => fr.push({ series, t, T, M, pl, other, line: M === 0 ? [0, 1, 2, 2, 2][i] : [3, 4], note: (M === 0 ? notesA : notesB)[i], vars: { elapsed: fmtMs(t), "memory now": fmtB(pl.mem(t)), "first byte": t >= pl.ttfb ? fmtMs(pl.ttfb) : "not yet" } }));
      const A = M === 0 ? pl : other, B = M === 0 ? other : pl;
      fr.push({ series, t: T, T, M, pl, other, line: [0, 4], note: `Side by side for ${big(N)} rows: load-all peaks at <b>${fmtB(A.peak)}</b> with the first byte at ${fmtMs(A.ttfb)}; streaming peaks at <b>${fmtB(B.peak)}</b> with the first byte at ${fmtMs(B.ttfb)}. Total time is similar or better when streaming, because the stages overlap.`, vars: { "load-all peak": fmtB(A.peak), "stream peak": fmtB(B.peak) } });
      return fr;
    },
    render: (f) => {
      const W = 520, H = 180, PL = 58, PB = 22, PT = 8;
      const maxM = Math.max(...f.series.flat().map((p) => p[1]), 1);
      const X = (t) => PL + (t / f.T) * (W - PL - 10), Y = (v) => PT + (1 - v / maxM) * (H - PT - PB);
      let s = `<svg class="pp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="memory over time">`;
      [0, 0.5, 1].forEach((g) => { s += `<line class="pp-gline" x1="${PL}" x2="${W - 8}" y1="${Y(maxM * g)}" y2="${Y(maxM * g)}"/><text class="pp-lbl" x="${PL - 4}" y="${Y(maxM * g) + 3}" text-anchor="end">${fmtB(maxM * g)}</text>`; });
      ["bad", "done"].forEach((c, i) => {
        const d = f.series[i].map((p, j) => `${j ? "L" : "M"}${X(p[0]).toFixed(1)},${Y(p[1]).toFixed(1)}`).join(" ");
        s += `<path class="pp-area ${c}" d="${d} L${X(f.T).toFixed(1)},${Y(0)} L${PL},${Y(0)} Z"/><path class="pp-line ${c} ${(f.M === 0) === (i === 0) ? "sel" : ""}" d="${d}"/>`;
      });
      const tt = f.pl.ttfb;
      if (tt <= f.T) s += `<line class="pp-ttfb" x1="${X(tt)}" x2="${X(tt)}" y1="${PT}" y2="${H - PB}"/><text class="pp-lbl pp-lbl-acc" x="${Math.min(X(tt) + 4, W - 70)}" y="${PT + 10}">first byte</text>`;
      s += `<line class="pp-cursor" x1="${X(f.t)}" x2="${X(f.t)}" y1="${PT}" y2="${H - PB}"/><text class="pp-lbl" x="${PL}" y="${H - 5}">0</text><text class="pp-lbl" x="${W - 8}" y="${H - 5}" text-anchor="end">${fmtMs(f.T)}</text></svg>`;
      return `<div class="pp-col">${s}<div class="pp-stats"><span>${f.M === 0 ? "load-all" : "streaming"} peak <b>${fmtB(f.pl.peak)}</b></span><span>first byte <b>${fmtMs(f.pl.ttfb)}</b></span><span>total <b>${fmtMs(f.pl.total)}</b></span></div></div>`;
    },
  }));

  /* =====================================================================
   * 8. Lazy vs eager pipelines
   * ===================================================================== */
  const LZ_MODES = ["eager: ToList() after every step", "lazy: one pass, stop at Take(k)", "lazy, but enumerated twice"];
  Viz.register("performance-patterns-lazy", (el) => Viz.player(el, {
    title: "Filter → map → take: how much work runs, and how much is thrown away?",
    tag: "PICK EAGER OR LAZY · STEP THROUGH THE PIPELINE",
    legend: [["done", "item reached the next stage"], ["visit", "processed, then discarded"], ["bad", "processed again"], ["active", "current item"]],
    codeLang: "csharp",
    code: [
      "var a = orders.Where(o => o.Total > 100).ToList();    // eager: a full list",
      "var b = a.Select(o => Expensive(o)).ToList();          // every match converted",
      "var top = b.Take(k).ToList();                         // and most are thrown away",
      "IEnumerable<Dto> q = orders.Where(o => o.Total > 100).Select(Expensive).Take(k);",
      "foreach (var dto in q) Render(dto);                   // pulls items one at a time",
      "if (q.Any()) { Log(q.Count()); foreach (var dto in q) Render(dto); }  // 3 enumerations",
    ],
    inputs: [
      { key: "mode", label: "pipeline", type: "select", value: LZ_MODES[0], options: LZ_MODES },
      { key: "n", label: "orders", value: "10000", width: 80 },
      { key: "match", label: "match rate (%)", value: "30", width: 60 },
      { key: "k", label: "take k", value: "10", width: 60 },
      seedInput,
    ],
    random: () => ({ mode: pick(Math.random, LZ_MODES), n: String(pick(Math.random, [1000, 10000, 100000])), match: String(pick(Math.random, [5, 30, 70])), k: String(pick(Math.random, [5, 10, 50])), seed: randSeed() }),
    build: ({ mode, n, match, k, seed }) => {
      const M = LZ_MODES.indexOf(mode); if (M < 0) throw new Error("Pick a pipeline.");
      const N = num(n, "Orders", 20, 1000000), P = num(match, "Match rate", 1, 100) / 100, K = num(k, "Take k", 1, 1000);
      const r = rng(num(seed, "Seed", 0, 1e9));
      const isMatch = []; for (let i = 0; i < N; i++) isMatch.push(r() < P);
      const matches = isMatch.reduce((a, b) => a + (b ? 1 : 0), 0);
      let stopAt = N - 1, seen = 0;
      for (let i = 0; i < N; i++) if (isMatch[i] && ++seen === K) { stopAt = i; break; }
      const kept = Math.min(K, matches);
      const SHOW = 40, EXP = 50;
      const cost = (m) => {
        if (m === 0) return { filtered: N, mapped: matches, lists: 3 };
        if (m === 1) return { filtered: stopAt + 1, mapped: kept, lists: 0 };
        const first = Math.max(0, isMatch.indexOf(true)); return { filtered: first + 1 + 2 * (stopAt + 1), mapped: 1 + 2 * kept, lists: 0 };
      };
      const work = (c) => c.filtered + c.mapped * EXP;
      const C = cost(M);
      const fr = [];
      const st = (upto, phase) => ({ isMatch: isMatch.slice(0, SHOW), upto, phase, stopAt, K, M, N, C });
      if (M === 0) {
        fr.push({ ...st(SHOW, 1), line: 0, note: `Step 1: Where runs over all ${big(N)} orders and copies ${big(matches)} matches into a new list.`, vars: { filtered: big(N), mapped: 0, lists: 1 } });
        fr.push({ ...st(SHOW, 2), line: 1, note: `Step 2: Expensive() runs on <b>all ${big(matches)}</b> matches and fills a second list.`, vars: { filtered: big(N), mapped: big(matches), lists: 2 } });
        fr.push({ ...st(SHOW, 3), line: 2, note: `Step 3: Take(${K}) keeps ${kept}. ${big(Math.max(0, matches - K))} expensive conversions and two lists were wasted.`, vars: { kept, wasted: big(Math.max(0, matches - K)), lists: 3 } });
      } else {
        const marks = [0, 2, 5, 10, 20, Math.min(stopAt, SHOW - 1)].filter((x, i, a) => x <= stopAt && a.indexOf(x) === i);
        for (const u of marks) {
          const got = isMatch.slice(0, u + 1).filter(Boolean).length;
          fr.push({ ...st(u, 9), line: [3, 4], note: `Order ${u}: ${isMatch[u] ? "matches, so Expensive() runs on it and the result flows straight to Render()" : "fails the filter; nothing else runs for it"}. ${got} of ${K} so far.${u === stopAt ? ` Take(${K}) is satisfied, so <b>enumeration stops</b>: orders after #${u} are never touched.` : ""}`, vars: { order: u, results: `${got}/${K}` } });
        }
        if (stopAt >= SHOW) fr.push({ ...st(SHOW, 9), line: [3, 4], note: `… the pipeline keeps pulling until the ${K}th match at order #${stopAt}, then stops.`, vars: { "stopped at": stopAt } });
        if (M === 2) fr.push({ ...st(SHOW, 10), line: 5, note: `<code>q</code> is a recipe, not a result. Any() runs it (until the first match), Count() runs it again (to the ${K}th match), and foreach runs it a third time. Against a database that is three queries; over a one-shot stream the later passes may see nothing. Materialise once with ToList() when you need to look more than once.`, vars: { enumerations: 3 } });
      }
      const E = cost(0), L = cost(1), T2 = cost(2);
      fr.push({ ...st(M === 0 ? SHOW : Math.min(stopAt, SHOW - 1), M === 0 ? 3 : M === 2 ? 10 : 9), line: M === 0 ? [0, 1, 2] : M === 1 ? [3, 4] : 5, note: `Work units (filter = 1, Expensive = ${EXP}): eager <b>${big(work(E))}</b> plus ${E.lists} lists; lazy <b>${big(work(L))}</b> and no lists; lazy enumerated three times about ${big(work(T2))}. Lazy wins when you stop early or stream; eager wins when you iterate several times, need a stable snapshot, or the source (a DbContext, a file) is about to close.`, vars: { "eager work": big(work(E)), "lazy work": big(work(L)) } });
      return fr;
    },
    render: (f) => {
      let n = 0;
      const prefix = f.isMatch.map((m) => (m ? ++n : n));
      const cls = (row, i) => {
        const m = f.isMatch[i], rank = prefix[i];
        if (f.M === 0) {
          if (row === 0) return f.phase >= 1 ? (m ? "done" : "visit") : "";
          if (row === 1) return f.phase >= 2 && m ? (rank <= f.K && f.phase >= 3 ? "done" : "visit") : "";
          return f.phase >= 3 && m && rank <= f.K ? "done" : "";
        }
        if (i > f.stopAt) return "";
        if (f.phase === 10) return row === 0 || m ? "bad" : "";
        if (i > f.upto) return "";
        const c = row === 0 ? (m ? "done" : "visit") : m ? "done" : "";
        return i === f.upto && (row === 0 || m) ? "active" : c;
      };
      const lbl = ["Where", "Select(Expensive)", `Take(${f.K})`];
      const rows = lbl.map((l, r) => `<div class="pp-lrow"><span class="pp-mlbl">${esc(l)}</span><span class="pp-lcells">${f.isMatch.map((_, i) => `<i class="pp-lcell ${cls(r, i)}"></i>`).join("")}</span></div>`).join("");
      const c = f.C;
      return `<div class="pp-col"><div class="pp-small pp-muted">first ${f.isMatch.length} of ${big(f.N)} orders, one square each</div>${rows}<div class="pp-stats"><span>filter calls <b>${big(c.filtered)}</b></span><span>Expensive() calls <b>${big(c.mapped)}</b></span><span>intermediate lists <b>${c.lists}</b></span></div></div>`;
    },
  }));

  /* =====================================================================
   * 9. Startup: time to first response vs time to peak throughput
   * ===================================================================== */
  const SU = [
    { id: "net-jit", name: ".NET (JIT)", ph: [50, 220, 150, 110], warm: 25, peak: 100, mem: 70 },
    { id: "net-r2r", name: ".NET ReadyToRun", ph: [50, 80, 120, 35], warm: 25, peak: 100, mem: 75 },
    { id: "net-aot", name: ".NET Native AOT", ph: [12, 0, 45, 4], warm: 0, peak: 92, mem: 30 },
    { id: "jvm", name: "JVM (Spring Boot)", ph: [80, 1100, 900, 180], warm: 60, peak: 100, mem: 220 },
    { id: "jvm-cds", name: "JVM + AppCDS / Spring AOT", ph: [80, 450, 550, 140], warm: 60, peak: 100, mem: 200 },
    { id: "graal", name: "GraalVM native image", ph: [8, 0, 50, 4], warm: 0, peak: 85, mem: 60 },
    { id: "node", name: "Node.js", ph: [40, 280, 90, 25], warm: 10, peak: 100, mem: 60 },
    { id: "python", name: "Python (FastAPI)", ph: [25, 650, 90, 8], warm: 0, peak: 100, mem: 55 },
    { id: "go", name: "Go (static binary)", ph: [4, 0, 15, 1], warm: 0, peak: 100, mem: 15 },
  ];
  const SU_SIZE = ["small API", "medium service", "large app with many dependencies"];
  const SU_SCEN = ["long-running service", "autoscaling on traffic bursts", "serverless function (cold starts)", "CLI tool run many times"];
  const PHASES = ["process + runtime start", "load code, JIT / class loading / imports", "app init: DI, config, connections", "first request (cold path)"];
  Viz.register("performance-patterns-startup", (el) => Viz.player(el, {
    title: "Cold start: where the first second goes, per runtime",
    tag: "PICK A RUNTIME AND A SCENARIO · STEP THROUGH STARTUP",
    legend: [["path", "runtime start"], ["visit", "loading code"], ["active", "app init"], ["done", "first request"]],
    codeLang: "bash",
    code: [
      "dotnet publish -c Release -p:PublishReadyToRun=true     # precompiled IL, JIT still available",
      "dotnet publish -c Release -p:PublishAot=true            # native binary, no JIT, trimmed",
      "java -XX:SharedArchiveFile=app.jsa -jar app.jar         # AppCDS: pre-parsed classes",
      "native-image -jar app.jar                               # GraalVM: closed-world native binary",
      "python -X importtime -c \"import app\" 2> imports.log    # find slow imports",
      "CGO_ENABLED=0 go build -ldflags=\"-s -w\" ./cmd/api       # static binary, starts in ms",
    ],
    inputs: [
      { key: "rt", label: "runtime", type: "select", value: SU[0].name, options: SU.map((x) => x.name) },
      { key: "size", label: "app size", type: "select", value: SU_SIZE[1], options: SU_SIZE },
      { key: "scen", label: "scenario", type: "select", value: SU_SCEN[0], options: SU_SCEN },
    ],
    random: () => ({ rt: pick(Math.random, SU).name, size: pick(Math.random, SU_SIZE), scen: pick(Math.random, SU_SCEN) }),
    build: ({ rt, size, scen }) => {
      const R = SU.find((x) => x.name === rt), Z = SU_SIZE.indexOf(size), SC = SU_SCEN.indexOf(scen);
      if (!R || Z < 0 || SC < 0) throw new Error("Pick an option in every list.");
      const mult = [0.6, 1, 2.2][Z];
      const scale = (x) => x.ph.map((v, i) => (i === 0 ? v : v * mult));
      const ph = scale(R);
      const ttfr = ph.reduce((a, b) => a + b, 0);
      const line = { "net-jit": 0, "net-r2r": 0, "net-aot": 1, jvm: 2, "jvm-cds": 2, graal: 3, node: 4, python: 4, go: 5 }[R.id];
      const fr = [];
      const why = [
        `The OS starts the process and the runtime boots (${fmtMs(ph[0])}). Native binaries skip most of this.`,
        R.ph[1] === 0 ? "Nothing to load or compile: the code was compiled ahead of time into the binary." : R.id.startsWith("net") ? `The runtime loads assemblies and JIT-compiles methods on first call (${fmtMs(ph[1])}). ReadyToRun ships precompiled code, so far less JIT happens.` : R.id.startsWith("jvm") ? `The JVM loads, verifies and interprets thousands of classes (${fmtMs(ph[1])}). AppCDS maps pre-parsed classes from an archive instead.` : R.id === "python" ? `Every import executes module code (${fmtMs(ph[1])}). Heavy libraries (pandas, ML stacks, cloud SDKs) dominate; <code>-X importtime</code> shows which.` : `Node parses and compiles every required module (${fmtMs(ph[1])}). Bundling and lazy requires cut this.`,
        `Your code: build the DI container, read and validate config, open connection pools, warm caches (${fmtMs(ph[2])}). This part is yours to optimise in every runtime.`,
        `The first request runs cold code paths: ${R.warm ? "methods still being compiled at the lowest tier" : "already native code"} (${fmtMs(ph[3])}). Time to first response: <b>${fmtMs(ttfr)}</b>.`,
      ];
      for (let i = 0; i < 4; i++) fr.push({ R, ph, upto: i, ttfr, line, note: why[i], vars: { phase: PHASES[i], elapsed: fmtMs(ph.slice(0, i + 1).reduce((a, b) => a + b, 0)) } });
      fr.push({ R, ph, upto: 4, ttfr, line, note: R.warm ? `Then the warm-up: a JIT recompiles hot methods with profile data, so throughput keeps climbing for about ${R.warm * mult > 60 ? Math.round(R.warm * mult) : Math.round(R.warm * mult)} s until it reaches peak. AOT-compiled code is fast from the start but ${R.id === "net-r2r" ? "R2R code is re-jitted when hot, so it still reaches full peak" : "can't use runtime profile data"}.` : R.peak < 100 ? `No warm-up: full speed at once. The trade-off is a lower ceiling (about ${R.peak}% of a JIT's peak here, workload dependent) because there is no profile-guided recompilation, plus build-time limits on reflection and dynamic loading.` : `No warm-up curve: what you see in the first second is what you get.`, vars: { "time to peak": R.warm ? `~${Math.round(R.warm * mult)} s` : "immediate", "peak throughput": `${R.peak}%` } });
      const all = SU.map((x) => ({ ...x, t: scale(x).reduce((a, b) => a + b, 0) }));
      const coldMatters = SC >= 2, burst = SC === 1;
      let verdict;
      if (SC === 0) verdict = `Long-running service: startup is paid once per deploy. Optimise the app-init phase you own, use readiness probes so traffic waits for warm-up, and keep the JIT for peak throughput. AOT is optional (smaller memory, ${R.mem} MB here, is still a win in dense hosting).`;
      else if (burst) verdict = `Autoscaling: new instances must take traffic within seconds. ${ttfr > 1500 ? `${fmtMs(ttfr)} plus warm-up is slow; try ReadyToRun/AppCDS, trim app init, or keep a warm minimum of instances.` : `${fmtMs(ttfr)} is fine; also watch the warm-up period, since a fresh JIT instance is slower for its first ${R.warm || 0} s.`}`;
      else if (SC === 2) verdict = `Serverless: every cold start is user-visible latency. ${ttfr > 500 ? `${fmtMs(ttfr)} hurts; consider Native AOT, GraalVM native image, Go, SnapStart-style snapshots, or provisioned concurrency.` : `${fmtMs(ttfr)} is a good cold start.`}`;
      else verdict = `CLI tools: startup is the whole run time. ${ttfr > 300 ? `${fmtMs(ttfr)} per invocation feels sluggish; native compilation is the standard fix.` : `${fmtMs(ttfr)} feels instant.`}`;
      fr.push({ R, ph, upto: 4, ttfr, all, line, note: `<b>${esc(SU_SCEN[SC])}:</b> ${verdict} (Numbers are illustrative for a ${SU_SIZE[Z]}; measure your own.)`, vars: { "first response": fmtMs(ttfr), "memory (RSS)": `~${Math.round(R.mem * (Z === 2 ? 1.6 : 1))} MB` } });
      return fr;
    },
    render: (f) => {
      const cls = ["path", "visit", "active", "done"];
      const tot = f.ph.reduce((a, b) => a + b, 0);
      const seg = f.ph.map((v, i) => (i <= f.upto && v > 0 ? `<i class="pp-seg ${cls[i]}" style="width:${((100 * v) / tot).toFixed(2)}%" title="${esc(PHASES[i])}"></i>` : "")).join("");
      const keys = PHASES.map((p, i) => `<span class="${i <= f.upto ? "" : "pp-muted"}"><i class="pp-key ${cls[i]}"></i>${esc(p)} <b>${fmtMs(f.ph[i])}</b></span>`).join("");
      let warm = "";
      if (f.upto >= 4) {
        const W = 520, H = 70, X = (t) => 30 + (t / 90) * (W - 40), Y = (v) => 6 + (1 - v / 100) * (H - 20);
        const curve = []; for (let t = 0; t <= 90; t += 2) { const v = f.R.warm ? f.R.peak * (1 - 0.65 * Math.exp(-t / (f.R.warm / 3))) : f.R.peak; curve.push(`${t ? "L" : "M"}${X(t).toFixed(1)},${Y(v).toFixed(1)}`); }
        warm = `<div class="pp-small pp-muted">throughput over the first 90 s (% of the best JIT peak)</div><svg class="pp-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="warm-up curve"><line class="pp-gline" x1="30" x2="${W - 10}" y1="${Y(100)}" y2="${Y(100)}"/><text class="pp-lbl" x="26" y="${Y(100) + 3}" text-anchor="end">100</text><path class="pp-line done sel" d="${curve.join(" ")}"/><text class="pp-lbl" x="30" y="${H - 2}">0 s</text><text class="pp-lbl" x="${W - 10}" y="${H - 2}" text-anchor="end">90 s</text></svg>`;
      }
      const cmp = f.all ? `<div class="pp-brows">${f.all.map((x) => `<div class="pp-brow"><span class="pp-bname">${esc(x.name)}</span><span class="pp-bar-t"><i class="pp-bar-f ${x.id === f.R.id ? "active" : x.t < 200 ? "done" : x.t > 1500 ? "bad" : "visit"}" style="width:${Math.max(1.5, (100 * Math.log10(1 + x.t)) / Math.log10(1 + Math.max(...f.all.map((y) => y.t)))).toFixed(1)}%"></i></span><b>${fmtMs(x.t)}</b></div>`).join("")}</div><div class="pp-small pp-muted">time to first response, log scale</div>` : "";
      return `<div class="pp-col"><div class="pp-stats"><span><b>${esc(f.R.name)}</b></span><span>first response <b>${fmtMs(f.ph.slice(0, Math.min(4, f.upto + 1)).reduce((a, b) => a + b, 0))}</b></span></div><div class="pp-segbar">${seg}</div><div class="pp-keys">${keys}</div>${f.all ? cmp : warm}</div>`;
    },
  }));

  /* =====================================================================
   * 10. Response compression: CPU vs bytes on the wire
   * ===================================================================== */
  const CP_ALGS = [
    { id: "none", name: "none", r: 1, c: Infinity, d: Infinity },
    { id: "gz1", name: "gzip -1", r: 0.24, c: 120, d: 400 },
    { id: "gz6", name: "gzip -6", r: 0.18, c: 40, d: 420 },
    { id: "br4", name: "brotli 4", r: 0.17, c: 70, d: 450 },
    { id: "br11", name: "brotli 11", r: 0.13, c: 1.5, d: 450 },
    { id: "zstd3", name: "zstd 3", r: 0.16, c: 350, d: 1200 },
  ];
  const CP_KIND = ["JSON / HTML / text", "already compressed (JPEG, PNG, zip, video)"];
  const cpPlan = (a, size, kind, net, cpuSpeed) => {
    let r = a.r;
    if (a.id !== "none") {
      if (kind === 1) r = 1.01;
      else if (size < 1500) r = Math.min(1.05, r + ((1500 - size) / 1500) * 0.75);
    }
    const out = a.id === "none" ? size : size * r + (a.id === "none" ? 0 : 20);
    const c = a.id === "none" ? 0 : (size / (a.c * 1e6)) * 1000 / cpuSpeed;
    const d = a.id === "none" ? 0 : (size / (a.d * 1e6)) * 1000;
    const wire = (out / (net * 125000)) * 1000;
    return { ...a, out, c, d, wire, total: c + d + wire };
  };
  Viz.register("performance-patterns-compress", (el) => Viz.player(el, {
    title: "Compress the response? Bytes saved vs CPU spent, per algorithm",
    tag: "SET PAYLOAD AND NETWORK · STEP THROUGH THE ALGORITHMS",
    legend: [["path", "compress (server CPU)"], ["visit", "transfer"], ["done", "decompress (client)"], ["active", "best total for this case"]],
    codeLang: "csharp",
    code: [
      "builder.Services.AddResponseCompression(o => { o.EnableForHttps = true;",
      "    o.Providers.Add<BrotliCompressionProvider>(); o.Providers.Add<GzipCompressionProvider>(); });",
      "builder.Services.Configure<BrotliCompressionProviderOptions>(o => o.Level = CompressionLevel.Fastest);",
      "app.UseResponseCompression();      // only for compressible MIME types, above a minimum size",
      "// static assets: precompress at build time with the highest level (brotli 11) and serve the .br file",
    ],
    inputs: [
      { key: "size", label: "payload (bytes)", value: "60000", width: 90 },
      { key: "kind", label: "content", type: "select", value: CP_KIND[0], options: CP_KIND },
      { key: "net", label: "network (Mbit/s)", value: "20", width: 70 },
      { key: "cpu", label: "server CPU speed (1 = typical core)", value: "1", width: 60 },
    ],
    random: () => ({ size: String(pick(Math.random, [300, 2000, 60000, 1000000])), kind: pick(Math.random, CP_KIND), net: String(pick(Math.random, [2, 20, 100, 1000])), cpu: String(pick(Math.random, [0.5, 1, 2])) }),
    build: ({ size, kind, net, cpu }) => {
      const S = num(size, "Payload", 50, 100000000), K = CP_KIND.indexOf(kind), N = num(net, "Network", 0.1, 100000, false), CPU = num(cpu, "CPU speed", 0.1, 10, false);
      if (K < 0) throw new Error("Pick the content type.");
      const rows = CP_ALGS.map((a) => cpPlan(a, S, K, N, CPU));
      const best = rows.reduce((b, r) => (r.total < b.total ? r : b));
      const fr = [];
      rows.forEach((r, i) => {
        const note = r.id === "none" ? `Uncompressed: ${fmtB(S)} at ${N} Mbit/s takes ${fmtMs(r.wire)} on the wire. Zero CPU.`
          : `${r.name}: ${fmtB(S)} → <b>${fmtB(r.out)}</b> (${((100 * r.out) / S).toFixed(0)}%), ${fmtMs(r.c)} of server CPU, ${fmtMs(r.wire)} on the wire, ${fmtMs(r.d)} to decompress. ${K === 1 ? "Already-compressed data doesn't shrink; the CPU is pure waste." : S < 1500 ? "Tiny payloads barely shrink and may even grow (headers, dictionary)." : r.id === "br11" ? "Brotli 11 compresses best but is far too slow for dynamic responses; use it to precompress static files at build time." : ""}`;
        fr.push({ rows, upto: i, best: null, S, line: r.id === "none" ? 3 : r.id === "br11" ? 4 : r.id.startsWith("br") ? [1, 2] : [0, 1], note, vars: { algorithm: r.name, size: fmtB(r.out), total: fmtMs(r.total) } });
      });
      let verdict;
      if (K === 1) verdict = "Don't compress already-compressed content. Exclude images, video and archives by MIME type.";
      else if (S < 1000) verdict = "Below about 1 KB, skip compression: savings are tiny and can be negative. Most servers have a minimum-size setting.";
      else if (best.id === "none") verdict = `On a ${N} Mbit/s link the CPU costs more time than the transfer saves. Inside a data centre, compression can still pay for itself in egress cost, but not in latency.`;
      else verdict = `${best.name} gives the best end-to-end time here. A fast level (gzip 1–4, brotli 4–5, zstd 3) is the usual choice for dynamic responses; save the slowest levels for static assets compressed once at build time.`;
      fr.push({ rows, upto: rows.length - 1, best: best.id, S, line: [0, 3, 4], note: `<b>Verdict:</b> ${verdict} Security note: compressing a response that mixes secrets with attacker-controlled input over HTTPS enables BREACH-style attacks, which is why ASP.NET Core leaves EnableForHttps off by default.`, vars: { best: best.name, saved: fmtB(S - best.out) } });
      return fr;
    },
    render: (f) => {
      const shown = f.rows.slice(0, f.upto + 1);
      const mx = Math.max(...f.rows.map((r) => r.total));
      const rows = f.rows.map((r, i) => {
        if (i > f.upto) return `<div class="pp-brow pp-muted"><span class="pp-bname">${esc(r.name)}</span><span class="pp-bar-t"></span><b></b></div>`;
        const w = (v) => ((100 * v) / mx).toFixed(2);
        return `<div class="pp-brow ${f.best === r.id ? "pp-best" : ""}"><span class="pp-bname">${esc(r.name)} <small>${fmtB(r.out)}</small></span><span class="pp-bar-t pp-stack"><i class="pp-seg path" style="width:${w(r.c)}%"></i><i class="pp-seg visit" style="width:${w(r.wire)}%"></i><i class="pp-seg done" style="width:${w(r.d)}%"></i></span><b>${fmtMs(r.total)}</b></div>`;
      }).join("");
      const cur = shown[shown.length - 1];
      return `<div class="pp-col"><div class="pp-stats"><span>payload <b>${fmtB(f.S)}</b></span><span>${esc(cur.name)}: <b>${fmtB(cur.out)}</b> on the wire</span></div><div class="pp-brows">${rows}</div><div class="pp-small pp-muted">end-to-end time = compress + transfer + decompress (illustrative throughputs; benchmark with your payloads)</div></div>`;
    },
  }));
})();

