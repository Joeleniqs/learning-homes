/* Visualizers for State Machines & DP Optimisations. Every name is prefixed "dp-advanced-".
 * Frames come from running the real algorithms; each build() cross-checks its answer against a brute force. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when a mode changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const pad = (code, n) => code.concat(Array(Math.max(0, n - code.length)).fill(""));
  const assert = (c, m) => { if (!c) throw new Error("Internal check failed: " + m); };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const nums = (s, { min = 1, max = 10, lo = 0, hi = 99, what = "Values" } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what} must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const int = (s, lo, hi, what) => {
    const n = Number(String(s).trim());
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const f2 = (x) => (x === Infinity ? "∞" : x === -Infinity ? "−∞" : Number.isInteger(x) ? String(x) : x.toFixed(2));
  const f3 = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(3));

  /* ---------- tiny SVG kit: uses the svg.dg classes so light/dark both work ---------- */
  const T = (x, y, s, cls = "", anchor = "middle") => `<text x="${x}" y="${y}" text-anchor="${anchor}" dominant-baseline="central" class="${cls}">${esc(s)}</text>`;
  const arrow = (x1, y1, x2, y2, cls = "", r2 = 0) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const ex = x2 - ux * r2, ey = y2 - uy * r2;
    const head = `<polygon class="dpa-ah ${cls}" points="${ex},${ey} ${ex - ux * 9 - uy * 4.5},${ey - uy * 9 + ux * 4.5} ${ex - ux * 9 + uy * 4.5},${ey - uy * 9 - ux * 4.5}"/>`;
    return `<path class="edge ${cls}" d="M${x1},${y1} L${ex - ux * 6},${ey - uy * 6}"/>${head}`;
  };
  const svg = (w, h, body, label) => `<svg class="dg dpa-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const col = (...parts) => `<div class="dpa-col">${parts.filter(Boolean).join("")}</div>`;

  /* ================= 1. Stock trading: the state machine unrolled into a trellis ================= */
  const STOCK_MODES = ["I · one trade (121)", "II · unlimited trades (122)", "III · two trades (123)", "IV · k trades (188)", "cooldown (309)", "fee (714)"];
  function stockMachine(mode, k, fee) {
    const E = (u, v, kind) => ({ u, v, kind });
    if (mode.startsWith("I ·")) return { states: ["rest", "hold", "sold"], edges: [E(0, 0, "stay"), E(0, 1, "buy"), E(1, 1, "stay"), E(1, 2, "sell"), E(2, 2, "stay")], fin: [0, 2], fee: 0 };
    if (mode.startsWith("II ·") || mode.startsWith("fee")) return { states: ["cash", "hold"], edges: [E(0, 0, "stay"), E(1, 0, "sell"), E(0, 1, "buy"), E(1, 1, "stay")], fin: [0], fee: mode.startsWith("fee") ? fee : 0 };
    if (mode.startsWith("cooldown")) return { states: ["rest", "hold", "sold"], edges: [E(0, 0, "stay"), E(2, 0, "cool"), E(0, 1, "buy"), E(1, 1, "stay"), E(1, 2, "sell")], fin: [0, 2], fee: 0 };
    const K = mode.startsWith("III") ? 2 : k, states = ["s0"], edges = [E(0, 0, "stay")], fin = [0];
    for (let t = 1; t <= K; t++) {
      const b = states.length, s = b + 1;
      states.push(`b${t}`, `s${t}`);
      edges.push(E(s - 2, b, "buy"), E(b, b, "stay"), E(b, s, "sell"), E(s, s, "stay"));
      fin.push(s);
    }
    return { states, edges, fin, fee: 0 };
  }
  function stockBrute(prices, mode, k, fee) {
    const maxT = mode.startsWith("I ·") ? 1 : mode.startsWith("III") ? 2 : mode.startsWith("IV") ? k : Infinity;
    const cd = mode.startsWith("cooldown"), fe = mode.startsWith("fee") ? fee : 0, n = prices.length;
    const rec = (d, hold, used, cool) => {
      if (d === n) return 0;
      const p = prices[d];
      let best = rec(d + 1, hold, used, false);
      if (hold) best = Math.max(best, p - fe + rec(d + 1, false, used, cd));
      else if (!cool && used < maxT) best = Math.max(best, -p + rec(d + 1, true, used + 1, false));
      return best;
    };
    return rec(0, false, 0, false);
  }
  const gainTxt = (kind, fee) => (kind === "buy" ? "− p" : kind === "sell" ? (fee ? `+ p − ${fee}` : "+ p") : "");
  const STOCK_CODE = [
    "val = {s: -inf for s in states}; val[start] = 0",
    "for p in prices:                     # one trellis column per day",
    "    new = {}",
    "    for s in states:                 # every arrow into s is a candidate",
    "        new[s] = max(val[u] + gain(kind, p)",
    "                     for u, kind in into[s])",
    "    val = new",
    "return max(val[s] for s in final_states)",
    "# walk the winning arrows back to list the trades",
  ];
  Viz.register("dp-advanced-stock", (el, opts) => Viz.player(el, {
    title: "Stock trading: the state machine unrolled over the days",
    tag: "TRELLIS · ONE DP COLUMN PER DAY",
    legend: [["active", "state being computed"], ["visit", "candidate source / losing arrow"], ["done", "winning arrow"], ["path", "best plan (walk back)"], ["dim", "unreachable (−∞)"]],
    codeLang: "python",
    code: STOCK_CODE,
    speed: 800,
    inputs: [
      { key: "mode", label: "problem", type: "select", options: STOCK_MODES, value: opts.mode || STOCK_MODES[4] },
      { key: "prices", label: "prices (2–9 days)", value: opts.prices || "1,2,3,0,2", width: 170 },
      { key: "k", label: "k (IV)", value: "2", width: 50 },
      { key: "fee", label: "fee", value: "2", width: 50 },
    ],
    random: () => ({ prices: Viz.randInts(Viz.rand(5, 8), 0, 9).join(","), k: String(Viz.rand(1, 3)), fee: String(Viz.rand(1, 3)) }),
    build: ({ mode, prices, k, fee }) => {
      const P = nums(prices, { min: 2, max: 9, lo: 0, hi: 99, what: "Prices" });
      const K = int(k, 1, 3, "k"), F = int(fee, 0, 9, "The fee");
      const M = stockMachine(mode, K, F), S = M.states.length, n = P.length;
      const into = range(S).map((s) => M.edges.filter((e) => e.v === s));
      const val = [range(S).map((s) => (s === 0 ? 0 : -Infinity))], pred = [range(S).map(() => null)];
      const fr = [];
      const recs = range(S).map((s) => `${M.states[s]} = max(${into[s].map((e) => `${M.states[e.u]}${gainTxt(e.kind, M.fee) ? " " + gainTxt(e.kind, M.fee) : ""}`).join(", ")})`);
      const snap = (o) => fr.push({ P, M, val: Viz.clone(val), pred: Viz.clone(pred), recs, cur: null, cand: [], path: null, ...o });
      snap({ line: 0, note: `Column <b>start</b> is "before day 0": you own nothing and have spent nothing, so <b>${M.states[0]} = 0</b> and every other state is −∞ (impossible). Each later column is one day; each arrow is a move allowed on that day, labelled with what it does to your cash.`, vars: { states: S, days: n } });
      for (let d = 0; d < n; d++) {
        const p = P[d], row = Array(S).fill(-Infinity), prow = Array(S).fill(null);
        val.push(row); pred.push(prow);
        for (let s = 0; s < S; s++) {
          const cand = into[s].map((e) => {
            const g = e.kind === "buy" ? -p : e.kind === "sell" ? p - M.fee : 0;
            return { u: e.u, kind: e.kind, g, v: val[d][e.u] + g };
          });
          let best = null;
          for (const c of cand) if (c.v > -Infinity && (!best || c.v > best.v)) best = c;
          row[s] = best ? best.v : -Infinity; prow[s] = best ? { u: best.u, kind: best.kind } : null;
          const parts = cand.map((c) => `${M.states[c.u]} ${f2(val[d][c.u])}${c.g ? (c.g > 0 ? " + " + c.g : " − " + -c.g) : ""} = ${f2(c.v)}`).join("; ");
          const why = !best ? "No arrow comes from a reachable state yet, so it stays −∞." : best.kind === "buy" ? `Buying today (paying ${p}) beats every alternative.` : best.kind === "sell" ? `Selling today at ${p}${M.fee ? ` (minus the fee ${M.fee})` : ""} is the best way to be in <b>${M.states[s]}</b>.` : best.kind === "cool" ? "The only way back to rest is the cooldown day after a sale (or staying)." : "Doing nothing (the stay arrow) is best: no move today improves this state.";
          snap({ cur: [d, s], cand: cand.map((c) => ({ ...c, win: best && c.u === best.u && c.kind === best.kind })), line: [3, 4, 5], note: `Day ${d}, price ${p}: <b>${M.states[s]}</b> ← ${parts}. ${why}`, vars: { day: d, p, state: M.states[s], value: f2(row[s]) } });
        }
      }
      let bs = M.fin[0];
      for (const s of M.fin) if (val[n][s] > val[n][bs]) bs = s;
      const ans = val[n][bs];
      assert(ans === stockBrute(P, mode, K, F), "trellis answer differs from exhaustive search");
      const nodes = [[n, bs]], trades = [];
      for (let d = n, s = bs; d > 0; d--) {
        const pr = pred[d][s];
        if (pr.kind === "buy") trades.unshift(`buy day ${d - 1} @${P[d - 1]}`);
        if (pr.kind === "sell") trades.unshift(`sell day ${d - 1} @${P[d - 1]}`);
        s = pr.u; nodes.push([d - 1, s]);
      }
      snap({ line: 7, note: `Answer: the best final state is <b>${M.states[bs]} = ${ans}</b> (you must not end holding a share).`, vars: { answer: ans } });
      snap({ line: 8, path: nodes, note: `Walk the winning arrows back from ${M.states[bs]}: <b>${trades.length ? trades.join(" → ") : "no trades at all"}</b>. Profit ${ans}. The plan is a path through the trellis, so this DP is a longest path in a DAG.`, vars: { answer: ans, trades: trades.length } });
      return fr;
    },
    render: (f) => {
      const { P, M, val } = f, S = M.states.length, n = P.length, CW = 74, RH = 50, X0 = 96, Y0 = 62, R = 18;
      const X = (d) => X0 + (d + 1) * CW, Y = (s) => Y0 + s * RH;
      const W = X(n - 1) + 40, H = Y(S - 1) + 34;
      let b = "";
      for (let d = -1; d < n; d++) { b += T(X(d), 14, d < 0 ? "start" : `day ${d}`, "small muted"); if (d >= 0) b += T(X(d), 32, `p=${P[d]}`, "small mono"); }
      M.states.forEach((s, i) => { b += T(10, Y(i), s, "mono", "start"); });
      const onPath = new Set((f.path || []).map(([d, s]) => `${d},${s}`));
      const edges = [];
      for (let d = 1; d < val.length; d++) for (let s = 0; s < S; s++) {
        const pr = f.pred[d][s];
        if (!pr) continue;
        if (f.cur && d === f.cur[0] + 1 && s === f.cur[1]) continue;
        const isPath = onPath.has(`${d},${s}`) && onPath.has(`${d - 1},${pr.u}`);
        edges.push({ d, u: pr.u, s, cls: isPath ? "path" : "", label: isPath ? gainTxt(pr.kind, M.fee).replace("p", P[d - 1]) : "" });
      }
      if (f.cur) for (const c of f.cand) edges.push({ d: f.cur[0] + 1, u: c.u, s: f.cur[1], cls: c.win ? "done" : "visit", label: c.g ? (c.g > 0 ? "+" + c.g : "−" + -c.g) : "0" });
      edges.sort((a, b2) => ["", "visit", "done", "path"].indexOf(a.cls) - ["", "visit", "done", "path"].indexOf(b2.cls));
      let lab = "";
      for (const e of edges) {
        const x1 = X(e.d - 2), y1 = Y(e.u), x2 = X(e.d - 1), y2 = Y(e.s);
        const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy);
        b += arrow(x1 + (dx / L) * R, y1 + (dy / L) * R, x2, y2, e.cls || "dpa-faint", R + 1);
        if (e.label) lab += T((x1 + x2) / 2 + (dy ? 10 : 0), (y1 + y2) / 2 - (dy ? 0 : 9), e.label, `small mono dpa-lbl ${e.cls}`);
      }
      for (let d = 0; d < val.length; d++) for (let s = 0; s < S; s++) {
        const dd = d - 1, v = val[d][s];
        let cls = "";
        if (f.cur && dd === f.cur[0] && s === f.cur[1]) cls = "active";
        else if (onPath.has(`${dd},${s}`)) cls = "path";
        else if (f.cur && dd === f.cur[0] - 1 && f.cand.some((c) => c.u === s)) cls = "visit";
        const future = f.cur && (dd > f.cur[0] || (dd === f.cur[0] && s > f.cur[1]));
        if (future) continue;
        b += `<circle class="box ${cls} ${v === -Infinity && !cls ? "dpa-dim" : ""}" cx="${X(dd)}" cy="${Y(s)}" r="${R}"/>${T(X(dd), Y(s), f2(v), "mono small")}`;
      }
      for (let d = 0; d < n + 1; d++) for (let s = 0; s < S; s++) {
        const dd = d - 1;
        if (f.cur && (dd > f.cur[0] || (dd === f.cur[0] && s > f.cur[1])) && d < val.length + 1) b += `<circle class="box dpa-ghost" cx="${X(dd)}" cy="${Y(s)}" r="${R - 6}"/>`;
        else if (d >= val.length) b += `<circle class="box dpa-ghost" cx="${X(dd)}" cy="${Y(s)}" r="${R - 6}"/>`;
      }
      const recs = `<div class="dpa-recs">${f.recs.map((r, i) => `<span class="${f.cur && f.cur[1] === i ? "active" : ""}">${esc(r)}</span>`).join("")}</div>`;
      return col(svg(W, H, b + lab, "Trellis of states by day"), recs);
    },
  }));

  /* ================= 2. DP on a DAG: Parallel Courses III ================= */
  const DAG_CODE = [
    "indeg = [0] * (n + 1); for u, v in rel: indeg[v] += 1",
    "q = deque(v for v in nodes if indeg[v] == 0)",
    "start = [0] * (n + 1)          # earliest start = max finish of prereqs",
    "while q:                       # pop in topological order",
    "    u = q.popleft()",
    "    finish[u] = start[u] + time[u]",
    "    for v in adj[u]:",
    "        start[v] = max(start[v], finish[u])",
    "        indeg[v] -= 1",
    "        if indeg[v] == 0: q.append(v)",
    "return max(finish)             # = the longest (critical) path",
  ];
  Viz.register("dp-advanced-dag", (el) => Viz.player(el, {
    title: "DP on a DAG: earliest finish = longest path (Parallel Courses III)",
    tag: "TOPOLOGICAL ORDER IS THE FILL ORDER",
    legend: [["active", "popped node / relaxed edge"], ["visit", "in queue (all prereqs done)"], ["done", "finished"], ["path", "critical path"], ["bad", "stuck: cycle"]],
    codeLang: "python",
    code: DAG_CODE,
    inputs: [
      { key: "time", label: "time per course 1..n", value: "3,2,5,4,2,6", width: 150 },
      { key: "rel", label: "prereqs a>b (a before b)", value: "1>3, 2>3, 2>4, 3>5, 4>5, 4>6", width: 230 },
    ],
    random: () => {
      const n = Viz.rand(5, 8), rel = [];
      for (let v = 2; v <= n; v++) for (let u = 1; u < v; u++) if (Math.random() < 0.3) rel.push(`${u}>${v}`);
      return { time: Viz.randInts(n, 1, 9).join(","), rel: rel.join(", ") };
    },
    build: ({ time, rel }) => {
      const t = nums(time, { min: 2, max: 9, lo: 1, hi: 9, what: "Times" }), n = t.length;
      const E = [], seen = new Set();
      for (const tok of String(rel).split(/[,;\s]+/).filter(Boolean)) {
        const m = tok.match(/^(\d+)>(\d+)$/);
        if (!m) throw new Error(`Write each prerequisite as a>b, e.g. 1>3 (got "${tok}").`);
        const u = +m[1], v = +m[2];
        if (u < 1 || v < 1 || u > n || v > n) throw new Error(`Courses are numbered 1..${n}.`);
        if (u === v) throw new Error("A course cannot be its own prerequisite.");
        if (!seen.has(`${u}-${v}`)) { seen.add(`${u}-${v}`); E.push([u, v]); }
      }
      if (E.length > 16) throw new Error("Use at most 16 prerequisites so the picture stays readable.");
      const adj = range(n + 1).map(() => []), indeg = Array(n + 1).fill(0);
      for (const [u, v] of E) { adj[u].push(v); indeg[v]++; }
      adj.forEach((a) => a.sort((x, y) => x - y));
      const layer = Array(n + 1).fill(-1), dg = indeg.slice(), qq = [];
      for (let v = 1; v <= n; v++) if (!dg[v]) { qq.push(v); layer[v] = 0; }
      while (qq.length) { const u = qq.shift(); for (const v of adj[u]) { layer[v] = Math.max(layer[v], layer[u] + 1); if (--dg[v] === 0) qq.push(v); } }
      const maxL = Math.max(0, ...layer);
      for (let v = 1; v <= n; v++) if (dg[v] > 0) layer[v] = maxL + 1;
      const byL = {};
      for (let v = 1; v <= n; v++) (byL[layer[v]] ||= []).push(v);
      const tallest = Math.max(...Object.values(byL).map((a) => a.length));
      const nodes = [];
      for (const [L, vs] of Object.entries(byL)) vs.forEach((v, i) => nodes.push({ id: String(v), x: +L * 130, y: (i - (vs.length - 1) / 2) * 82 + (tallest - 1) * 41 }));
      const ind = indeg.slice(), start = Array(n + 1).fill(0), finish = Array(n + 1).fill(null), from = Array(n + 1).fill(0);
      const q = [], done = new Set(), used = new Set(), fr = [];
      const snap = (o) => fr.push({ nodes, E, t, start: start.slice(), finish: finish.slice(), q: q.slice(), done: new Set(done), used: new Set(used), u: null, edge: null, crit: null, stuck: null, ...o });
      for (let v = 1; v <= n; v++) if (!ind[v]) q.push(v);
      snap({ line: [0, 1], note: `A course can start only after <b>all</b> its prerequisites finish. Courses with no prerequisites (${q.join(", ")}) can start at time 0, so they seed the queue. Processing in topological order guarantees every predecessor is final before we read it.`, vars: { queue: q.join(" ") } });
      while (q.length) {
        const u = q.shift();
        finish[u] = start[u] + t[u - 1];
        snap({ u, line: [4, 5], note: `Pop course ${u}. All its prerequisites are done, so its start ${start[u]} is final: finish = ${start[u]} + ${t[u - 1]} = <b>${finish[u]}</b>.`, vars: { u, "start[u]": start[u], "finish[u]": finish[u] } });
        for (const v of adj[u]) {
          const old = start[v];
          if (finish[u] > start[v]) { start[v] = finish[u]; from[v] = u; }
          ind[v]--;
          used.add(`${u}-${v}`);
          if (ind[v] === 0) q.push(v);
          snap({ u, edge: `${u}-${v}`, line: ind[v] === 0 ? [7, 8, 9] : [7, 8], note: `Edge ${u}→${v}: course ${v} cannot start before ${finish[u]}. start[${v}] = max(${old}, ${finish[u]}) = <b>${start[v]}</b>. ${ind[v] === 0 ? `That was its last prerequisite, so ${v} joins the queue.` : `It still waits for ${ind[v]} more.`}`, vars: { u, v, "start[v]": start[v], "indeg[v]": ind[v] } });
        }
        done.add(u);
      }
      if (done.size < n) {
        const stuck = range(n).map((i) => i + 1).filter((v) => !done.has(v));
        snap({ stuck, line: 3, note: `The queue is empty but courses ${stuck.join(", ")} never reached in-degree 0: they sit on a <b>cycle</b>. A DP needs an order in which every dependency is computed first; a cycle has none. (Kahn's algorithm doubles as cycle detection.)`, vars: { processed: done.size, n } });
        return fr;
      }
      let best = 1;
      for (let v = 1; v <= n; v++) if (finish[v] > finish[best]) best = v;
      const memo = {}, F = (v) => (memo[v] ??= t[v - 1] + Math.max(0, ...E.filter(([, b]) => b === v).map(([a]) => F(a))));
      assert(finish[best] === Math.max(...range(n).map((i) => F(i + 1))), "topological DP differs from memoised DFS");
      const crit = [best];
      while (start[crit[0]] > 0) crit.unshift(from[crit[0]]);
      snap({ crit, line: 10, note: `Every course is scheduled. The answer is the largest finish time, <b>${finish[best]}</b>. Follow the "who set my start time" links back from course ${best}: ${crit.join(" → ")} is the <b>critical path</b>, the longest weighted path in the DAG. Delay any course on it and the whole plan slips.`, vars: { answer: finish[best], critical: crit.join("→") } });
      return fr;
    },
    render: (f) => {
      const critE = new Set(); if (f.crit) for (let i = 1; i < f.crit.length; i++) critE.add(`${f.crit[i - 1]}-${f.crit[i]}`);
      const g = { nodes: f.nodes.map((n) => ({ ...n, top: `t=${f.t[+n.id - 1]}`, sub: f.finish[+n.id] === null ? `s≥${f.start[+n.id]}` : `fin ${f.finish[+n.id]}` })), edges: f.E.map(([u, v]) => ({ u: String(u), v: String(v) })) };
      return Viz.row(
        Viz.graph(g, {
          directed: true,
          nodeCls: (id) => (f.stuck && f.stuck.includes(+id) ? "bad" : f.crit && f.crit.includes(+id) ? "path" : +id === f.u ? "active" : f.q.includes(+id) ? "visit" : f.done.has(+id) ? "done" : ""),
          edgeCls: (k) => (critE.has(k) ? "path" : k === f.edge ? "active" : f.used.has(k) ? "done" : ""),
        }),
        Viz.queue(f.q.map(String), { label: "ready queue" }),
      );
    },
  }));

  /* ================= 3. DP + monotonic deque: Jump Game VI / Constrained Subsequence Sum ================= */
  const DQ_MODES = ["Jump Game VI (1696)", "Constrained Subsequence Sum (1425)"];
  const DQ_CODE = {
    jump: [
      "dp[0] = nums[0]; dq = deque([0])      # indices, dp values decreasing",
      "for i in range(1, n):",
      "    while dq[0] < i - k: dq.popleft() # left the window [i-k, i-1]",
      "    dp[i] = nums[i] + dp[dq[0]]        # front = best reachable state",
      "    while dq and dp[dq[-1]] <= dp[i]:",
      "        dq.pop()                       # dominated: older AND not better",
      "    dq.append(i)",
      "return dp[n - 1]",
    ],
    css: [
      "for i in range(n):",
      "    while dq and dq[0] < i - k: dq.popleft()",
      "    best = dp[dq[0]] if dq else 0",
      "    dp[i] = nums[i] + max(0, best)     # may start fresh at i",
      "    while dq and dp[dq[-1]] <= dp[i]:",
      "        dq.pop()",
      "    dq.append(i)",
      "return max(dp)",
    ],
  };
  Viz.register("dp-advanced-deque", (el, opts) => {
    const p = Viz.player(el, {
      title: "DP + monotonic deque: max over a sliding window of earlier states",
      tag: "O(n·k) → O(n)",
      legend: [["window", "candidate states i−k … i−1"], ["active", "dp[i] being filled"], ["done", "deque front = best candidate"], ["bad", "evicted (too old or dominated)"]],
      codeLang: "python",
      code: DQ_CODE.jump,
      speed: 900,
      inputs: [
        { key: "mode", label: "problem", type: "select", options: DQ_MODES, value: opts.mode || DQ_MODES[0] },
        { key: "nums", label: "nums (3–14)", value: opts.nums || "1,-5,-20,4,-1,3,-6,-3,2", width: 210 },
        { key: "k", label: "k", value: opts.k || "2", width: 46 },
      ],
      random: () => ({ nums: Viz.randInts(Viz.rand(7, 13), -9, 9).join(","), k: String(Viz.rand(1, 4)) }),
      build: ({ mode, nums: s, k: ks }) => {
        const jump = mode === DQ_MODES[0];
        setCode(el, DQ_CODE[jump ? "jump" : "css"]);
        const a = nums(s, { min: 3, max: 14, lo: -99, hi: 99, what: "nums" }), n = a.length, k = int(ks, 1, n, "k");
        const dp = Array(n).fill(null), dq = [], fr = [];
        const snap = (o) => fr.push({ a, dp: dp.slice(), dq: dq.slice(), i: null, k, out: [], ...o });
        let i0 = 0;
        if (jump) {
          dp[0] = a[0]; dq.push(0); i0 = 1;
          snap({ i: 0, line: 0, note: `You start on index 0 and must land on index ${n - 1}, jumping 1..${k} steps; your score is the sum of the cells you land on. dp[i] = best score that ends on i = nums[i] + max(dp[i−k … i−1]). dp[0] = ${a[0]}.`, vars: { k, "dp[0]": a[0] } });
        } else snap({ line: 0, note: `Pick a non-empty subsequence whose consecutive chosen indices are at most ${k} apart, maximising the sum. dp[i] = best sum of a valid subsequence <b>ending</b> at i = nums[i] + max(0, max dp[i−k … i−1]); the 0 means "start a new subsequence here".`, vars: { k } });
        for (let i = i0; i < n; i++) {
          const out = [];
          while (dq.length && dq[0] < i - k) out.push(dq.shift());
          if (out.length) snap({ i, out, line: jump ? 2 : 1, note: `Window for i=${i} is [${Math.max(0, i - k)}, ${i - 1}]. Index ${out.join(", ")} is too far back to jump from, so it leaves the front of the deque.`, vars: { i, window: `${Math.max(0, i - k)}..${i - 1}` } });
          const best = dq.length ? dp[dq[0]] : null;
          dp[i] = jump ? a[i] + best : a[i] + Math.max(0, best ?? 0);
          let bf = -Infinity;
          for (let j = Math.max(0, i - k); j < i; j++) bf = Math.max(bf, dp[j]);
          assert(jump ? dp[i] === a[i] + bf : dp[i] === a[i] + Math.max(0, bf === -Infinity ? 0 : bf), `dp[${i}] disagrees with scanning the window`);
          snap({ i, front: dq[0], line: jump ? 3 : [2, 3], note: `The deque front ${dq.length ? `is index ${dq[0]} with dp = ${best}` : "is empty"}: it is the maximum of the window without scanning it. dp[${i}] = ${a[i]} + ${jump ? best : `max(0, ${best ?? "—"})`} = <b>${dp[i]}</b>.`, vars: { i, front: dq.length ? dq[0] : "—", [`dp[${i}]`]: dp[i] } });
          const pop = [];
          while (dq.length && dp[dq[dq.length - 1]] <= dp[i]) pop.push(dq.pop());
          if (pop.length) snap({ i, out: pop, line: [4, 5], note: `Index ${pop.join(", ")} has dp ≤ ${dp[i]} and is older than ${i}, so it will leave the window sooner and is never better: it can <b>never</b> be the front again. Pop it from the back.`, vars: { i, popped: pop.join(",") } });
          dq.push(i);
          snap({ i, line: 6, note: `Push ${i}. The deque holds indices in increasing order with dp values strictly decreasing: [${dq.map((j) => `${j}:${dp[j]}`).join(", ")}]. Each index enters once and leaves once, so the whole fill is O(n).`, vars: { i, deque: dq.join(" ") } });
        }
        let ans;
        if (jump) ans = dp[n - 1];
        else ans = Math.max(...dp);
        const bfd = Array(n).fill(0);
        for (let i = 0; i < n; i++) {
          let b = jump && i === 0 ? 0 : jump ? -Infinity : 0;
          for (let j = Math.max(0, i - k); j < i; j++) b = Math.max(b, bfd[j]);
          bfd[i] = a[i] + b;
        }
        assert(ans === (jump ? bfd[n - 1] : Math.max(...bfd)), "deque DP differs from O(n·k) DP");
        snap({ line: 7, done: true, note: `Answer: <b>${ans}</b> (${jump ? `dp[${n - 1}]` : "the best dp over all end points"}). Same recurrence as the O(n·k) loop; only the max over the window got cheaper.`, vars: { answer: ans } });
        return fr;
      },
      render: (f) => {
        const lo = f.i === null ? -1 : Math.max(0, f.i - f.k);
        const arr = Viz.array(f.a, { label: "nums", showIdx: true, cls: (j) => (j === f.i ? "active" : f.i !== null && j >= lo && j < f.i ? "window" : "") });
        const dpRow = Viz.array(f.dp, { label: "dp", showIdx: true, ptrs: f.i !== null ? { i: f.i } : {}, cls: (j) => (f.out.includes(j) ? "bad" : j === f.i ? "active" : f.dq.length && j === f.dq[0] && f.i !== null && j !== f.i ? "done" : f.i !== null && j >= lo && j < f.i ? "window" : f.dp[j] === null ? "dim" : "") });
        const q = Viz.queue(f.dq.map((j) => `${j}:${f.dp[j]}`), { label: "deque index:dp", cls: (idx) => (idx === 0 ? "done" : "") });
        return col(arr, dpRow, q);
      },
    });
    return p;
  });

  /* ================= 4. DP + binary search: LIS by patience sorting ================= */
  const LIS_MODES = ["LIS (300)", "Russian Doll Envelopes (354)"];
  const LIS_CODE = [
    "tails, top, prev = [], [], [-1] * n   # tails[L] = smallest tail of a length-(L+1) run",
    "for i, x in enumerate(a):",
    "    lo, hi = 0, len(tails)             # bisect_left: first tail >= x",
    "    while lo < hi:",
    "        mid = (lo + hi) // 2",
    "        if tails[mid] < x: lo = mid + 1",
    "        else: hi = mid",
    "    prev[i] = top[lo - 1] if lo else -1",
    "    if lo == len(tails): tails.append(x); top.append(i)",
    "    else: tails[lo] = x; top[lo] = i     # same length, smaller tail",
    "return len(tails)   # walk prev from top[-1] for one LIS",
  ];
  Viz.register("dp-advanced-lis", (el, opts) => Viz.player(el, {
    title: "LIS in O(n log n): patience piles + binary search + back-pointers",
    tag: "DP + BISECT",
    legend: [["active", "card being placed"], ["visit", "bisect range lo…hi"], ["window", "mid probe"], ["done", "pile tops = tails"], ["path", "reconstructed LIS"]],
    codeLang: "python",
    code: LIS_CODE,
    speed: 700,
    inputs: [
      { key: "mode", label: "problem", type: "select", options: LIS_MODES, value: opts.mode || LIS_MODES[0] },
      { key: "a", label: "nums  or  envelopes w:h", value: opts.a || "3,8,4,1,9,5,2,6,7", width: 250 },
    ],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 11), 1, 12).join(",") }),
    build: ({ mode, a: s }) => {
      let a, env = null, intro;
      if (mode === LIS_MODES[1]) {
        const toks = String(s).split(/[,;\s]+/).filter(Boolean);
        if (toks.every((t) => /^\d+$/.test(t))) env = toks.map((t, i) => [+t, +toks[(i + 3) % toks.length] || 1]);
        else env = toks.map((t) => { const m = t.match(/^(\d+)[:x](\d+)$/); if (!m) throw new Error(`Write envelopes as w:h, e.g. 5:4 (got "${t}").`); return [+m[1], +m[2]]; });
        if (env.length < 2 || env.length > 11) throw new Error("Use 2 to 11 envelopes.");
        if (env.some(([w, h]) => w < 1 || h < 1 || w > 99 || h > 99)) throw new Error("Widths and heights are 1..99.");
        const sorted = env.slice().sort((p, q) => p[0] - q[0] || q[1] - p[1]);
        a = sorted.map((e) => e[1]);
        env = sorted;
        intro = `Sorted by width ascending and, for equal widths, height <b>descending</b>: ${sorted.map((e) => e.join(":")).join(", ")}. Now any strictly increasing run of heights uses strictly increasing widths too (equal widths come in decreasing height, so two of them can never both be picked). The answer is the LIS of the heights.`;
      } else {
        a = nums(s, { min: 2, max: 12, lo: -99, hi: 99, what: "nums" });
        intro = "Deal the numbers left to right like cards. Rule: put each card on the <b>leftmost</b> pile whose top is ≥ it; if none, start a new pile on the right. The pile tops (tails) are always increasing, so the leftmost pile is found by binary search.";
      }
      const n = a.length, tails = [], top = [], prev = Array(n).fill(-1), piles = [], fr = [];
      const snap = (o) => fr.push({ a, env, piles: piles.map((p) => p.slice()), tails: tails.slice(), prev: prev.slice(), i: null, lo: null, hi: null, mid: null, path: [], ...o });
      snap({ line: 0, note: intro, vars: { n } });
      for (let i = 0; i < n; i++) {
        const x = a[i];
        let lo = 0, hi = tails.length;
        snap({ i, lo, hi, line: [1, 2], note: `Card ${x}${env ? ` (envelope ${env[i].join(":")})` : ""}: search the pile tops [${tails.join(", ")}] for the first top ≥ ${x}.`, vars: { x, lo, hi } });
        while (lo < hi) {
          const mid = (lo + hi) >> 1;
          const go = tails[mid] < x;
          snap({ i, lo, hi, mid, line: [4, go ? 5 : 6], note: `mid=${mid}: top ${tails[mid]} ${go ? `&lt; ${x}, so pile ${mid} and everything left of it are too small: lo = ${mid + 1}` : `≥ ${x}, so pile ${mid} works; maybe one further left does too: hi = ${mid}`}.`, vars: { x, lo, hi, mid } });
          if (go) lo = mid + 1; else hi = mid;
        }
        prev[i] = lo ? top[lo - 1] : -1;
        const isNew = lo === tails.length;
        if (isNew) { tails.push(x); top.push(i); piles.push([i]); } else { tails[lo] = x; top[lo] = i; piles[lo].push(i); }
        snap({ i, line: isNew ? [7, 8] : [7, 9], note: `${isNew ? `No top is ≥ ${x}: start pile ${lo}.` : `Place ${x} on pile ${lo}: an increasing run of length ${lo + 1} can now end on the smaller value ${x}.`} Back-pointer: ${prev[i] < 0 ? "none (it starts a run)" : `→ ${a[prev[i]]}, the top of pile ${lo - 1} right now`}. Piles = ${tails.length}.`, vars: { x, pile: lo, "len(tails)": tails.length } });
      }
      const path = [];
      for (let j = top[top.length - 1]; j >= 0; j = prev[j]) path.unshift(j);
      const L = Array(n).fill(1);
      for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) if (a[j] < a[i]) L[i] = Math.max(L[i], L[j] + 1);
      assert(tails.length === Math.max(...L), "patience length differs from O(n²) DP");
      assert(path.length === tails.length && path.every((j, t) => !t || a[path[t - 1]] < a[j]), "reconstructed sequence is not increasing");
      if (env) {
        const E = env.length, M = Array(E).fill(1);
        for (let i = 0; i < E; i++) for (let j = 0; j < i; j++) if (env[j][0] < env[i][0] && env[j][1] < env[i][1]) M[i] = Math.max(M[i], M[j] + 1);
        assert(tails.length === Math.max(...M), "envelope answer differs from O(n²) nesting DP");
      }
      snap({ path, line: 10, note: `${tails.length} piles = LIS length <b>${tails.length}</b>. Note the tails array [${tails.join(", ")}] is <i>not</i> itself an LIS; follow the back-pointers from the last pile's top instead: <b>${path.map((j) => (env ? env[j].join(":") : a[j])).join(" → ")}</b>.`, vars: { answer: tails.length } });
      return fr;
    },
    render: (f) => {
      const { a } = f, pl = f.path.length ? new Set(f.path) : null;
      const card = (j) => `<span class="dpa-card ${pl && pl.has(j) ? "path" : j === f.i ? "active" : ""}">${esc(f.env ? f.env[j].join(":") : a[j])}</span>`;
      const piles = f.piles.map((p, k) => {
        const c = f.mid === k ? "window" : f.lo !== null && k >= f.lo && k < f.hi ? "visit" : "";
        return `<div class="dpa-pile ${c}"><div class="dpa-pcards">${p.map(card).join("")}</div><div class="dpa-ptop mono">${k === f.mid ? "mid " : ""}pile ${k}</div></div>`;
      }).join("");
      const ptr = {}; if (f.lo !== null) { ptr.lo = f.lo; ptr.hi = f.hi; if (f.mid !== null) ptr.mid = f.mid; }
      const seq = Viz.array(f.env ? a.map((h, j) => `${f.env[j][0]}:${h}`) : a, { label: f.env ? "envelopes (sorted) → heights" : "input", showIdx: true, cls: (j) => (pl && pl.has(j) ? "path" : j === f.i ? "active" : f.i !== null && j < f.i ? "done" : "") });
      const prevRow = Viz.array(f.prev.map((p, j) => (f.i === null || j <= f.i || pl ? (p < 0 ? "–" : p) : null)), { label: "prev index", showIdx: true, cls: (j) => (pl && pl.has(j) ? "path" : "") });
      const tails = Viz.array(f.tails.length ? f.tails : [null], { label: "tails (pile tops)", showIdx: true, ptrs: ptr, cls: (k) => (k === f.mid ? "window" : f.lo !== null && k >= f.lo && k < f.hi ? "visit" : f.tails.length ? "done" : "dim") });
      return col(seq, `<div class="dpa-piles">${piles || '<span class="muted">no piles yet</span>'}</div>`, tails, prevRow);
    },
  }));

  /* ================= 5. DP + binary search: Maximum Profit in Job Scheduling ================= */
  const JOB_CODE = [
    "jobs.sort(key=lambda j: j.end)          # fill order = by end time",
    "ends = [j.end for j in jobs]; dp = [0] * (n + 1)",
    "for i, (s, e, p) in enumerate(jobs, 1): # dp[i] = best using first i jobs",
    "    k = bisect_right(ends, s, 0, i - 1) # jobs that end by time s",
    "    take = p + dp[k]",
    "    skip = dp[i - 1]",
    "    dp[i] = max(skip, take)",
    "return dp[n]",
  ];
  const parseJobs = (s) => {
    const toks = String(s).split(/[,;\s]+/).filter(Boolean);
    if (toks.length < 2 || toks.length > 9) throw new Error("Use 2 to 9 jobs, each written start-end:profit, e.g. 1-3:50.");
    return toks.map((t) => {
      const m = t.match(/^(\d+)-(\d+):(\d+)$/);
      if (!m) throw new Error(`Write each job as start-end:profit (got "${t}").`);
      const [st, en, p] = [+m[1], +m[2], +m[3]];
      if (en <= st || en > 20 || p < 1 || p > 999) throw new Error("Need start < end ≤ 20 and profit 1..999.");
      return [st, en, p];
    });
  };
  Viz.register("dp-advanced-jobs", (el) => Viz.player(el, {
    title: "Weighted interval scheduling: sort by end, bisect for the last compatible job",
    tag: "DP + BISECT · O(n log n)",
    legend: [["active", "job i (take it?)"], ["done", "compatible prefix dp[k]"], ["visit", "skip option dp[i−1]"], ["path", "chosen jobs"]],
    codeLang: "python",
    code: JOB_CODE,
    inputs: [{ key: "jobs", label: "jobs start-end:profit", value: "1-3:20, 2-5:20, 3-10:100, 4-6:70, 6-9:60, 1-2:10", width: 330 }],
    random: () => {
      const n = Viz.rand(4, 8), out = [];
      for (let i = 0; i < n; i++) { const s = Viz.rand(0, 14), e = s + Viz.rand(1, 6); out.push(`${s}-${Math.min(20, e)}:${Viz.rand(1, 9) * 10}`); }
      return { jobs: out.join(", ") };
    },
    build: ({ jobs: js }) => {
      const J = parseJobs(js).map((j, id) => [...j, id]).sort((a, b) => a[1] - b[1] || a[0] - b[0]), n = J.length;
      const ends = J.map((j) => j[1]), dp = Array(n + 1).fill(null), from = Array(n + 1).fill(null), fr = [];
      dp[0] = 0;
      const snap = (o) => fr.push({ J, dp: dp.slice(), i: null, k: null, take: null, chosen: [], ...o });
      snap({ line: [0, 1], note: `Jobs sorted by end time. dp[i] = best profit using only the first i jobs (in this order). Either job i is skipped (dp[i−1]) or taken, and then the rest must come from jobs that end by its start: a <b>prefix</b> of the sorted list, found by binary search.`, vars: { n } });
      for (let i = 1; i <= n; i++) {
        const [s, e, p] = J[i - 1];
        let lo = 0, hi = i - 1;
        while (lo < hi) { const m = (lo + hi) >> 1; if (ends[m] <= s) lo = m + 1; else hi = m; }
        const k = lo;
        let lin = 0; while (lin < i - 1 && ends[lin] <= s) lin++;
        assert(k === lin, "bisect_right disagrees with a linear scan");
        const take = p + dp[k], skip = dp[i - 1];
        snap({ i, k, line: [3, 4], note: `Job ${i} runs ${s}→${e} for ${p}. bisect_right(ends, ${s}) = ${k}: the first ${k} jobs end by ${s}${k ? ` (ends ${ends.slice(0, k).join(", ")})` : ""}, so taking job ${i} gives ${p} + dp[${k}] = <b>${take}</b>.`, vars: { i, s, e, p, k, take } });
        dp[i] = Math.max(skip, take); from[i] = take > skip ? k : -1;
        snap({ i, k, take: take > skip, line: [5, 6], note: `Skip gives dp[${i - 1}] = ${skip}. dp[${i}] = max(${skip}, ${take}) = <b>${dp[i]}</b>: ${take > skip ? "taking job " + i + " wins." : "skipping is at least as good."}`, vars: { i, skip, take, [`dp[${i}]`]: dp[i] } });
      }
      const chosen = [];
      for (let i = n; i > 0;) { if (from[i] >= 0) { chosen.push(i - 1); i = from[i]; } else i--; }
      let bf = 0;
      for (let m = 0; m < 1 << n; m++) {
        const sel = J.filter((_, t) => (m >> t) & 1).sort((a, b) => a[0] - b[0]);
        if (sel.every((j, t) => !t || sel[t - 1][1] <= j[0])) bf = Math.max(bf, sel.reduce((x, j) => x + j[2], 0));
      }
      assert(dp[n] === bf, "DP answer differs from trying every subset");
      snap({ chosen, line: 7, note: `Answer dp[${n}] = <b>${dp[n]}</b>, using jobs ${chosen.map((c) => c + 1).reverse().join(", ")}. Sorting + bisect made each transition O(log n) instead of scanning all earlier jobs.`, vars: { answer: dp[n] } });
      return fr;
    },
    render: (f) => {
      const n = f.J.length, U = 34, X0 = 40, RH = 26, W = X0 + 20 * U + 30, H = 30 + n * RH + 20;
      let b = "";
      for (let t = 0; t <= 20; t += 2) b += `<line class="edge dpa-grid" x1="${X0 + t * U}" y1="20" x2="${X0 + t * U}" y2="${H - 14}"/>${T(X0 + t * U, 10, t, "small muted")}`;
      f.J.forEach(([s, e, p], r) => {
        const i = r + 1, cls = f.chosen.includes(r) ? "path" : i === f.i ? "active" : f.k !== null && i <= f.k ? "done" : f.i !== null && i === f.i - 1 ? "visit" : f.i !== null && i > f.i ? "dpa-ghostbox" : "";
        const y = 26 + r * RH;
        b += T(18, y + 10, i, "small mono");
        const lab = `${s}–${e} · ${p}`, fits = (e - s) * U >= lab.length * 7 + 10;
        b += `<rect class="box ${cls}" x="${X0 + s * U}" y="${y}" width="${(e - s) * U}" height="${RH - 6}" rx="5"/>` +
          (fits ? T(X0 + ((s + e) / 2) * U, y + 10, lab, "small mono") : T(X0 + e * U + 6, y + 10, lab, "small mono", "start"));
      });
      if (f.i !== null) { const s = f.J[f.i - 1][0]; b += `<line class="edge active dash" x1="${X0 + s * U}" y1="18" x2="${X0 + s * U}" y2="${H - 10}"/>`; }
      const dpRow = Viz.array(f.dp, { label: "dp[i] = best with first i jobs", showIdx: true, ptrs: f.i !== null ? { i: f.i, k: f.k } : {}, cls: (j) => (j === f.i ? "active" : f.k !== null && j === f.k ? "done" : f.i !== null && j === f.i - 1 ? "visit" : "") });
      return col(svg(W, H, b, "Jobs on a timeline sorted by end"), dpRow);
    },
  }));

  /* ================= 6. DP + segment tree: Longest Increasing Subsequence II ================= */
  const SEG_CODE = [
    "tree = SegTree(maxV + 1)             # tree[v] = best LIS ending with value v",
    "for x in nums:",
    "    best = tree.query(x - k, x - 1)   # previous value within k below x",
    "    tree.update(x, best + 1)          # point max-update",
    "return tree.query(1, maxV)",
  ];
  Viz.register("dp-advanced-segdp", (el) => Viz.player(el, {
    title: "DP over values + segment tree: LIS with gaps at most k (LIS II)",
    tag: "RANGE-MAX QUERY PER TRANSITION",
    legend: [["visit", "node fully inside the query (its max is used)"], ["window", "partly inside: recurse"], ["active", "update path (leaf → root)"], ["done", "current x"]],
    codeLang: "python",
    code: SEG_CODE,
    speed: 1000,
    inputs: [
      { key: "nums", label: "nums (values 1–16)", value: "4,2,1,4,3,4,5,8,15", width: 200 },
      { key: "k", label: "k", value: "3", width: 46 },
    ],
    random: () => ({ nums: Viz.randInts(Viz.rand(6, 10), 1, 16).join(","), k: String(Viz.rand(1, 5)) }),
    build: ({ nums: s, k: ks }) => {
      const a = nums(s, { min: 1, max: 12, lo: 1, hi: 16, what: "nums" }), k = int(ks, 1, 16, "k");
      const M = Math.max(...a), SZ = M <= 4 ? 4 : M <= 8 ? 8 : 16;
      const tr = Array(2 * SZ).fill(0), dpv = Array(SZ + 1).fill(0), fr = [];
      const snap = (o) => fr.push({ a, SZ, tr: tr.slice(), dpv: dpv.slice(), i: null, cover: [], part: [], upd: [], ql: null, qr: null, ...o });
      const query = (node, l, r, ql, qr, cover, part) => {
        if (qr < l || r < ql || ql > qr) return 0;
        if (ql <= l && r <= qr) { cover.push(node); return tr[node]; }
        part.push(node);
        const m = (l + r) >> 1;
        return Math.max(query(2 * node, l, m, ql, qr, cover, part), query(2 * node + 1, m + 1, r, ql, qr, cover, part));
      };
      snap({ line: 0, note: `Index the DP by <b>value</b>, not position: leaf v stores the longest valid subsequence seen so far that ends with value v. A new x may extend any subsequence ending in a value from x−k to x−1: a range-max query. Values here run 1..${SZ}.`, vars: { k, leaves: SZ } });
      a.forEach((x, i) => {
        const ql = Math.max(1, x - k), qr = x - 1, cover = [], part = [];
        const best = qr >= 1 ? query(1, 1, SZ, ql, qr, cover, part) : 0;
        let bf = 0; for (let v = ql; v <= qr; v++) bf = Math.max(bf, dpv[v]);
        assert(best === bf, "range max differs from a direct scan");
        snap({ i, cover, part, ql, qr, line: 2, note: `x = ${x}: ask for max over values [${ql}, ${qr}]${qr < 1 ? " (empty range)" : ""}. ${cover.length ? `The query touches ${cover.length} fully-covered node${cover.length > 1 ? "s" : ""} (and ${part.length} partial ones) instead of ${qr - ql + 1} leaves.` : ""} Best = <b>${best}</b>.`, vars: { x, range: `${ql}..${qr}`, best } });
        const nv = best + 1, upd = [];
        if (nv > dpv[x]) {
          dpv[x] = nv;
          let p = SZ + x - 1; tr[p] = Math.max(tr[p], nv); upd.push(p);
          for (p >>= 1; p; p >>= 1) { tr[p] = Math.max(tr[2 * p], tr[2 * p + 1]); upd.push(p); }
        }
        snap({ i, upd, line: 3, note: upd.length ? `A subsequence of length ${nv} now ends in ${x}. Write ${nv} at leaf ${x} and refresh the ${upd.length - 1} ancestors on the way to the root: O(log V).` : `Length ${nv} does not beat the ${dpv[x]} already stored at leaf ${x}; nothing changes.`, vars: { x, [`best[${x}]`]: dpv[x] } });
      });
      const L = a.map(() => 1);
      for (let i = 0; i < a.length; i++) for (let j = 0; j < i; j++) if (a[j] < a[i] && a[i] - a[j] <= k) L[i] = Math.max(L[i], L[j] + 1);
      assert(tr[1] === Math.max(...L), "segment-tree DP differs from O(n²) DP");
      snap({ line: 4, note: `Answer = the root's max = <b>${tr[1]}</b>. O(n log V) instead of O(n²): the same dp, but the "max over a range of earlier states" became a tree query.`, vars: { answer: tr[1] } });
      return fr;
    },
    render: (f) => {
      const { SZ } = f, LW = SZ === 16 ? 44 : 64, W = SZ * LW + 20, depth = Math.log2(SZ), H = 40 + depth * 58 + 70;
      const pos = (node) => { const d = Math.floor(Math.log2(node)), idx = node - (1 << d), span = SZ >> d; return [10 + (idx + 0.5) * span * LW, 26 + d * 58]; };
      let b = "";
      for (let node = 2; node < 2 * SZ; node++) { const [x1, y1] = pos(node >> 1), [x2, y2] = pos(node); b += `<line class="edge ${f.upd.includes(node) && f.upd.includes(node >> 1) ? "active" : ""}" x1="${x1}" y1="${y1 + 13}" x2="${x2}" y2="${y2 - 13}"/>`; }
      for (let node = 1; node < 2 * SZ; node++) {
        const [x, y] = pos(node), d = Math.floor(Math.log2(node)), span = SZ >> d, lo = (node - (1 << d)) * span + 1, hi = lo + span - 1;
        const cls = f.upd.includes(node) ? "active" : f.cover.includes(node) ? "visit" : f.part.includes(node) ? "dpa-part" : "";
        const w = Math.min(span * LW - 6, 70);
        b += `<rect class="box ${cls}" x="${x - w / 2}" y="${y - 13}" width="${w}" height="26" rx="6"/>${T(x, y, f.tr[node], "mono")}`;
        if (span > 1) b += T(x, y - 20, `${lo}–${hi}`, "small muted");
        else b += T(x, y + 24, `v${lo}`, `small mono ${f.i !== null && f.a[f.i] === lo ? "fill-done" : "muted"}`);
      }
      if (f.ql !== null && f.qr >= f.ql) b += `<rect class="dpa-qband" x="${10 + (f.ql - 1) * LW}" y="${H - 22}" width="${(f.qr - f.ql + 1) * LW}" height="8" rx="3"/>${T(10 + ((f.ql + f.qr - 1) / 2) * LW, H - 6, `query [${f.ql}, ${f.qr}]`, "small fill-visit")}`;
      const arr = Viz.array(f.a, { label: "nums", showIdx: true, cls: (j) => (j === f.i ? "done" : f.i !== null && j < f.i ? "dim" : "") });
      return col(arr, svg(W, H, b, "Segment tree over values"));
    },
  }));

  /* ---------- shared line plot for CHT / Li Chao ---------- */
  function linePlot(lines, { x0, x1, query = null, hot = {}, envelope = true, extraY = [] }) {
    const W = 470, H = 300, L = 46, R = 50, TOP = 16, B = 30;
    const ev = (ln, x) => ln.m * x + ln.b;
    const ys = [...extraY];
    for (const ln of lines) ys.push(ev(ln, x0), ev(ln, x1));
    let y0 = Math.min(...ys), y1 = Math.max(...ys);
    if (y1 - y0 < 1) { y0 -= 1; y1 += 1; }
    const span = y1 - y0; y0 -= span * 0.06; y1 += span * 0.06;
    const X = (x) => L + ((x - x0) / (x1 - x0 || 1)) * (W - L - R), Y = (y) => TOP + (1 - (y - y0) / (y1 - y0)) * (H - TOP - B);
    let b = `<rect class="dpa-plot" x="${L}" y="${TOP}" width="${W - L - R}" height="${H - TOP - B}"/>`;
    const tick = (x) => b += `<line class="edge dpa-grid" x1="${X(x)}" y1="${TOP}" x2="${X(x)}" y2="${H - B}"/>${T(X(x), H - B + 12, x, "small muted")}`;
    const step = Math.max(1, Math.ceil((x1 - x0) / 10));
    for (let x = x0; x <= x1; x += step) tick(x);
    b += T(L - 6, Y(y1 - span * 0.06), Math.round(y1 - span * 0.06), "small muted", "end") + T(L - 6, Y(y0 + span * 0.06), Math.round(y0 + span * 0.06), "small muted", "end");
    lines.forEach((ln) => {
      const c = hot[ln.id] || "dpa-faint";
      b += `<line class="edge ${c}" x1="${X(x0)}" y1="${Y(ev(ln, x0))}" x2="${X(x1)}" y2="${Y(ev(ln, x1))}"/>`;
      b += T(X(x1) + 4, Y(ev(ln, x1)), ln.name, `small mono ${c === "dpa-faint" ? "muted" : "fill-" + c.split(" ")[0]}`, "start");
    });
    if (envelope && lines.length) {
      const pts = [], N = 160;
      for (let s = 0; s <= N; s++) { const x = x0 + ((x1 - x0) * s) / N; pts.push(`${X(x).toFixed(1)},${Y(Math.min(...lines.map((ln) => ev(ln, x)))).toFixed(1)}`); }
      b += `<polyline class="dpa-env" points="${pts.join(" ")}"/>`;
    }
    if (query !== null && lines.length) {
      const best = Math.min(...lines.map((ln) => ev(ln, query)));
      b += `<line class="edge active dash" x1="${X(query)}" y1="${TOP}" x2="${X(query)}" y2="${H - B}"/><circle class="box active" cx="${X(query)}" cy="${Y(best)}" r="5"/>`;
    }
    return svg(W, H, b, "Lines and their lower envelope");
  }
  const lineName = (j) => `L${j}`;

  /* ================= 7. Convex hull trick: Frog 3 ================= */
  const CHT_CODE = [
    "# dp[i] = min_j dp[j] + (h[i]-h[j])**2 + C",
    "#       = h[i]**2 + C + min_j ( m_j*h[i] + b_j ),  m_j = -2h[j], b_j = dp[j] + h[j]**2",
    "dq = deque([line(0)])                       # slopes decrease as j grows",
    "for i in range(1, n):",
    "    while len(dq) >= 2 and val(dq[1], h[i]) <= val(dq[0], h[i]):",
    "        dq.popleft()                        # queries move right: front is done",
    "    dp[i] = val(dq[0], h[i]) + h[i]**2 + C",
    "    while len(dq) >= 2 and bad(dq[-2], dq[-1], line(i)):",
    "        dq.pop()                            # never on the envelope again",
    "    dq.append(line(i))",
  ];
  Viz.register("dp-advanced-cht", (el) => Viz.player(el, {
    title: "Convex hull trick: each earlier state is a line, the DP is a min over lines",
    tag: "MONOTONE CHT · O(n)",
    legend: [["active", "query x = h[i]"], ["done", "line in the hull deque"], ["bad", "line removed"], ["path", "lower envelope"]],
    codeLang: "python",
    code: CHT_CODE,
    speed: 1000,
    inputs: [
      { key: "h", label: "heights (increasing)", value: "1,2,3,6,8,9,12", width: 190 },
      { key: "C", label: "C", value: "6", width: 50 },
    ],
    random: () => {
      const n = Viz.rand(5, 8), s = new Set();
      while (s.size < n) s.add(Viz.rand(1, 20));
      return { h: [...s].sort((a, b) => a - b).join(","), C: String(Viz.rand(1, 30)) };
    },
    build: ({ h: hs, C: cs }) => {
      const h = nums(hs, { min: 3, max: 9, lo: 1, hi: 30, what: "Heights" }), C = int(cs, 0, 99, "C"), n = h.length;
      if (h.some((x, i) => i && x <= h[i - 1])) throw new Error("Heights must be strictly increasing for the monotone version (sorted queries and slopes).");
      const dp = Array(n).fill(null); dp[0] = 0;
      const mk = (j) => ({ id: j, name: lineName(j), m: -2 * h[j], b: dp[j] + h[j] * h[j] });
      const val = (ln, x) => ln.m * x + ln.b;
      const bad = (l1, l2, l3) => (l3.b - l1.b) * (l1.m - l2.m) <= (l2.b - l1.b) * (l1.m - l3.m);
      const all = [mk(0)], dq = [all[0]], gone = new Set(), fr = [];
      const snap = (o) => fr.push({ h, dp: dp.slice(), all: all.slice(), dq: dq.map((l) => l.id), gone: new Set(gone), i: null, hot: null, ...o });
      snap({ line: [0, 1, 2], note: `Expand the square: the part that depends on j is m_j·x + b_j with x = h[i]. So every finished state j is a <b>line</b>, and dp[i] asks "which line is lowest at x = h[i]?". L0: m = ${all[0].m}, b = ${all[0].b}.`, vars: { n, C } });
      for (let i = 1; i < n; i++) {
        const x = h[i];
        while (dq.length >= 2 && val(dq[1], x) <= val(dq[0], x)) {
          const g = dq.shift(); gone.add(g.id);
          snap({ i, hot: { [g.id]: "bad" }, line: [4, 5], note: `At x = ${x}, ${dq[0].name} gives ${val(dq[0], x)} ≤ ${g.name}'s ${val(g, x)}. Queries only move right and the hull lines are ordered by slope, so ${g.name} will never win again: pop it from the front.`, vars: { i, x } });
        }
        const best = val(dq[0], x);
        dp[i] = best + x * x + C;
        let bf = Infinity; for (let j = 0; j < i; j++) bf = Math.min(bf, dp[j] + (x - h[j]) ** 2 + C);
        assert(dp[i] === bf, "CHT dp differs from the O(n²) scan");
        snap({ i, query: x, hot: { [dq[0].id]: "active" }, line: 6, note: `Front line ${dq[0].name} is lowest at x = ${x}: ${dq[0].m}·${x} + ${dq[0].b} = ${best}. dp[${i}] = ${best} + ${x}² + ${C} = <b>${dp[i]}</b> (jump from stone ${dq[0].id}).`, vars: { i, x, best: dq[0].name, [`dp[${i}]`]: dp[i] } });
        const nl = mk(i); all.push(nl);
        while (dq.length >= 2 && bad(dq[dq.length - 2], dq[dq.length - 1], nl)) {
          const g = dq.pop(); gone.add(g.id);
          snap({ i, hot: { [g.id]: "bad", [nl.id]: "active" }, line: [7, 8], note: `New ${nl.name} (m = ${nl.m}, b = ${nl.b}) crosses ${dq[dq.length - 1].name} before ${g.name} does, so ${g.name} is above the envelope everywhere: drop it from the back. The test is cross-multiplied, so it stays in integers.`, vars: { i, removed: g.name } });
        }
        dq.push(nl);
        snap({ i, hot: { [nl.id]: "active" }, line: 9, note: `Append ${nl.name}: y = ${nl.m}x + ${nl.b}. Hull deque: ${dq.map((l) => l.name).join(", ")}. Each line is pushed once and popped at most once: O(n) total.`, vars: { i, hull: dq.map((l) => l.name).join(" ") } });
      }
      snap({ line: 6, note: `dp[${n - 1}] = <b>${dp[n - 1]}</b>: the frog's cheapest total cost. Without the trick this is O(n²); with sorted slopes and sorted queries it is O(n). With unsorted queries, binary search the hull (O(log n)); with unsorted slopes too, use a Li Chao tree.`, vars: { answer: dp[n - 1] } });
      return fr;
    },
    render: (f) => {
      const hot = {};
      f.dq.forEach((id) => { hot[id] = "done"; });
      if (f.hot) Object.assign(hot, f.hot);
      const x0 = f.h[0], x1 = f.h[f.h.length - 1];
      const plot = linePlot(f.all, { x0, x1, query: f.query ?? null, hot });
      const dpRow = Viz.array(f.dp, { label: "dp (stone index)", showIdx: true, cls: (j) => (j === f.i ? "active" : f.dp[j] === null ? "dim" : "") });
      const hRow = Viz.array(f.h, { label: "h = query x", showIdx: true, cls: (j) => (j === f.i ? "active" : "") });
      const dq = Viz.queue(f.dq.map(lineName), { label: "hull deque", cls: (k) => (f.hot && f.hot[f.dq[k]] ? f.hot[f.dq[k]] : "done") });
      return Viz.row(plot, col(hRow, dpRow, dq));
    },
  }));

  /* ================= 8. Li Chao tree ================= */
  const LC_CODE = [
    "def add(node, l, r, new):                # tree over x = 0..7",
    "    m = (l + r) // 2",
    "    left_better = new(l) < cur[node](l)",
    "    mid_better  = new(m) < cur[node](m)",
    "    if mid_better: cur[node], new = new, cur[node]  # keep the mid winner",
    "    if l == r: return",
    "    if left_better != mid_better: add(2*node, l, m, new)    # they cross on the left",
    "    else:                         add(2*node+1, m + 1, r, new)",
    "def query(x): min of cur[node](x) on the root→leaf path to x",
  ];
  Viz.register("dp-advanced-lichao", (el) => Viz.player(el, {
    title: "Li Chao tree: lines in any order, min at any x, O(log X) each",
    tag: "SEGMENT TREE OF LINES",
    legend: [["active", "node / line being pushed down"], ["done", "line kept at node"], ["visit", "query path"], ["path", "lower envelope"]],
    codeLang: "python",
    code: LC_CODE,
    speed: 1000,
    inputs: [
      { key: "lines", label: "lines m:b", value: "1:0, -1:7, 0:3, -2:12, 2:-3", width: 240 },
      { key: "qs", label: "queries x (0–7)", value: "0,3,6", width: 110 },
    ],
    random: () => ({ lines: range(Viz.rand(3, 6)).map(() => `${Viz.rand(-3, 3)}:${Viz.rand(-4, 14)}`).join(", "), qs: Viz.randInts(3, 0, 7).join(",") }),
    build: ({ lines: ls, qs }) => {
      const toks = String(ls).split(/[,;\s]+/).filter(Boolean);
      if (toks.length < 1 || toks.length > 7) throw new Error("Use 1 to 7 lines.");
      const lines = toks.map((t, j) => { const m = t.match(/^(-?\d+):(-?\d+)$/); if (!m) throw new Error(`Write each line as m:b (got "${t}").`); const mm = +m[1], bb = +m[2]; if (Math.abs(mm) > 9 || Math.abs(bb) > 99) throw new Error("Keep |m| ≤ 9 and |b| ≤ 99."); return { id: j, name: lineName(j), m: mm, b: bb }; });
      const Q = nums(qs, { min: 1, max: 6, lo: 0, hi: 7, what: "Queries" });
      const ev = (ln, x) => ln.m * x + ln.b, cur = Array(16).fill(null), fr = [];
      const snap = (o) => fr.push({ lines, cur: cur.slice(), shown: o.shown ?? lines.length, node: null, path: [], q: null, ...o });
      snap({ shown: 0, line: 0, note: "Each tree node covers an x-range and keeps <b>one</b> line: the one that is lowest at the node's midpoint. A loser can only win on one side of the midpoint, so it is pushed down into that half only: one root-to-leaf walk per insertion.", vars: { lines: lines.length } });
      lines.forEach((ln, j) => {
        let node = 1, l = 0, r = 7, nw = ln;
        while (true) {
          const m = (l + r) >> 1;
          if (!cur[node]) { cur[node] = nw; snap({ shown: j + 1, node, hot: { [nw.id]: "active" }, line: 4, note: `${ln === nw ? "Insert" : "Push"} ${nw.name} (y = ${nw.m}x + ${nw.b}) into node [${l}, ${r}]: it is empty, so ${nw.name} simply stays here.`, vars: { node: `[${l},${r}]`, mid: m } }); break; }
          const c = cur[node], lb = ev(nw, l) < ev(c, l), mb = ev(nw, m) < ev(c, m);
          if (mb) cur[node] = nw;
          const keep = mb ? nw : c, loser = mb ? c : nw;
          const txt = `Node [${l}, ${r}], mid ${m}: ${nw.name}(${m}) = ${ev(nw, m)} vs ${c.name}(${m}) = ${ev(c, m)}. ${keep.name} wins the midpoint and stays.`;
          if (l === r) { snap({ shown: j + 1, node, hot: { [keep.id]: "done", [loser.id]: "bad" }, line: [3, 4, 5], note: `${txt} This is a leaf, so ${loser.name} is discarded.`, vars: { node: `[${l},${r}]`, mid: m } }); break; }
          const goL = lb !== mb;
          snap({ shown: j + 1, node, hot: { [keep.id]: "done", [loser.id]: "active" }, line: [2, 3, 4, goL ? 6 : 7], note: `${txt} At the left end x=${l} the ${lb ? "new" : "old"} line is lower${goL ? ", the opposite of the midpoint winner, so they cross in the <b>left</b> half" : ", the same winner, so any crossing is in the <b>right</b> half"}: push ${loser.name} to [${goL ? `${l}, ${m}` : `${m + 1}, ${r}`}].`, vars: { node: `[${l},${r}]`, mid: m, "left better": lb, "mid better": mb } });
          nw = loser;
          if (goL) { node = 2 * node; r = m; } else { node = 2 * node + 1; l = m + 1; }
        }
      });
      for (const x of Q) {
        let node = 1, l = 0, r = 7, best = Infinity, who = null; const path = [];
        while (true) {
          path.push(node);
          if (cur[node] && ev(cur[node], x) < best) { best = ev(cur[node], x); who = cur[node]; }
          if (l === r) break;
          const m = (l + r) >> 1;
          if (x <= m) { node *= 2; r = m; } else { node = node * 2 + 1; l = m + 1; }
        }
        assert(best === Math.min(...lines.map((ln) => ev(ln, x))), "Li Chao query differs from the brute-force minimum");
        snap({ q: x, path, hot: { [who.id]: "active" }, line: 8, note: `Query x = ${x}: walk root → leaf ${x} and take the minimum of the ${path.filter((p) => cur[p]).length} line(s) stored on the way. Best = ${who.name}(${x}) = <b>${best}</b>, equal to checking all ${lines.length} lines.`, vars: { x, best, line: who.name } });
      }
      return fr;
    },
    render: (f) => {
      const shown = f.lines.slice(0, f.shown), hot = {};
      const kept = new Set(f.cur.filter(Boolean).map((l) => l.id));
      shown.forEach((l) => { if (kept.has(l.id)) hot[l.id] = "done"; });
      if (f.hot) Object.assign(hot, f.hot);
      const plot = linePlot(shown, { x0: 0, x1: 7, query: f.q, hot, extraY: [0] });
      const nodes = [], edges = [];
      for (let node = 1; node < 16; node++) {
        const d = Math.floor(Math.log2(node)), idx = node - (1 << d), span = 8 >> d, lo = idx * span;
        nodes.push({ id: String(node), x: (idx + 0.5) * span * 52, y: d * 74, label: f.cur[node] ? f.cur[node].name : "·", sub: span > 1 ? `${lo}–${lo + span - 1}` : `x=${lo}` });
        if (node > 1) edges.push({ u: String(node >> 1), v: String(node) });
      }
      const tree = Viz.graph({ nodes, edges }, { r: 17, nodeCls: (id) => (+id === f.node ? "active" : f.path.includes(+id) ? "visit" : f.cur[+id] ? "done" : "dim"), edgeCls: (k) => { const [u, v] = k.split("-").map(Number); return f.path.includes(u) && f.path.includes(v) ? "visit" : ""; } });
      return Viz.row(plot, tree);
    },
  }));

  /* ================= 9. Divide & conquer optimisation ================= */
  const DNC_CODE = [
    "# dp[t][i] = min over j < i of dp[t-1][j] + cost(j, i),  cost = (pre[i]-pre[j])**2",
    "def solve(t, lo, hi, optL, optR):         # fill dp[t][lo..hi]",
    "    if lo > hi: return",
    "    mid = (lo + hi) // 2",
    "    best, opt = inf, -1",
    "    for j in range(max(optL, t-1), min(optR, mid-1) + 1):",
    "        v = dp[t-1][j] + cost(j, mid)",
    "        if v < best: best, opt = v, j",
    "    dp[t][mid] = best",
    "    solve(t, lo, mid-1, optL, opt)        # opt is monotone in i",
    "    solve(t, mid+1, hi, opt, optR)",
  ];
  Viz.register("dp-advanced-dnc", (el) => Viz.player(el, {
    title: "Divide & conquer optimisation: split points never move left",
    tag: "O(K·n²) → O(K·n log n)",
    legend: [["window", "allowed j range [optL, optR]"], ["visit", "evaluated candidate"], ["done", "opt(i): best split"], ["active", "row mid being solved"]],
    codeLang: "python",
    code: DNC_CODE,
    speed: 1000,
    inputs: [
      { key: "a", label: "array (values 1–9, ≤ 10)", value: "4,1,3,2,6,2,5,1,3,4", width: 200 },
      { key: "K", label: "groups K", value: "3", width: 60 },
    ],
    random: () => { const n = Viz.rand(5, 10); return { a: Viz.randInts(n, 1, 9).join(","), K: String(Viz.rand(2, Math.min(4, n))) }; },
    build: ({ a: s, K: ks }) => {
      const a = nums(s, { min: 2, max: 10, lo: 1, hi: 9, what: "Values" }), n = a.length, K = int(ks, 1, Math.min(4, n), "K");
      const pre = [0]; a.forEach((x) => pre.push(pre[pre.length - 1] + x));
      const cost = (j, i) => (pre[i] - pre[j]) ** 2;
      const dp = range(K + 1).map(() => Array(n + 1).fill(null)), opt = range(K + 1).map(() => Array(n + 1).fill(null));
      dp[0][0] = 0;
      const fr = [];
      let evals = 0;
      const snap = (o) => fr.push({ a, n, K, dp: Viz.clone(dp), opt: Viz.clone(opt), t: 1, cells: {}, mid: null, rng: null, evals, ...o });
      for (let i = 1; i <= n; i++) { dp[1][i] = cost(0, i); opt[1][i] = 0; }
      snap({ t: 1, line: 0, note: `Split ${a.join(",")} into K = ${K} contiguous groups minimising Σ(group sum)². dp[t][i] = best cost for the first i numbers in t groups. Layer t = 1 is one group: dp[1][i] = (prefix sum)². The cost satisfies the quadrangle inequality, which forces opt(i) to be non-decreasing in i.`, vars: { n, K } });
      for (let t = 2; t <= K; t++) {
        const cells = {};
        const solve = (lo, hi, oL, oR) => {
          if (lo > hi) return;
          const mid = (lo + hi) >> 1, jl = Math.max(oL, t - 1), jr = Math.min(oR, mid - 1);
          let best = Infinity, o = -1;
          for (let j = jl; j <= jr; j++) {
            const v = dp[t - 1][j] + cost(j, mid); evals++;
            cells[`${mid},${j}`] = v;
            if (v < best) { best = v; o = j; }
          }
          dp[t][mid] = best; opt[t][mid] = o;
          snap({ t, cells: { ...cells }, mid, rng: [jl, jr], line: [5, 6, 7, 8], note: `Layer t=${t}, solving rows ${lo}..${hi}: take the middle row i=${mid}. Only j in [${jl}, ${jr}] can be its split (bounded by the opts already found above and below). Tried ${jr - jl + 1} value${jr === jl ? "" : "s"}; best j = ${o}, so dp[${t}][${mid}] = ${dp[t - 1][o]} + (${pre[mid]}−${pre[o]})² = <b>${best}</b>. Rows above get [${oL}, ${o}], rows below [${o}, ${oR}].`, vars: { t, mid, range: `${jl}..${jr}`, opt: o, evaluations: evals } });
          solve(lo, mid - 1, oL, o); solve(mid + 1, hi, o, oR);
        };
        solve(t, n, t - 1, n - 1);
        for (let i = t + 1; i <= n; i++) assert(opt[t][i] >= opt[t][i - 1], "opt is not monotone");
      }
      const ref = range(K + 1).map(() => Array(n + 1).fill(Infinity)); ref[0][0] = 0;
      let full = 0;
      for (let t = 1; t <= K; t++) for (let i = t; i <= n; i++) for (let j = t - 1; j < i; j++) { ref[t][i] = Math.min(ref[t][i], ref[t - 1][j] + cost(j, i)); if (t > 1) full++; }
      for (let t = 1; t <= K; t++) for (let i = t; i <= n; i++) assert(dp[t][i] === ref[t][i], `dp[${t}][${i}] differs from the O(K·n²) DP`);
      const cuts = []; for (let t = K, i = n; t > 0; t--) { cuts.unshift(i); i = opt[t][i]; }
      const groups = []; let st = 0; for (const c of cuts) { groups.push(a.slice(st, c).join("+")); st = c; }
      snap({ t: K, cells: fr[fr.length - 1].cells, line: 9, note: `Answer dp[${K}][${n}] = <b>${dp[K][n]}</b>: groups ${groups.map((g) => `(${g})`).join(" | ")}. Layers 2..${K} needed <b>${evals}</b> cost evaluations instead of ${full} for the plain triple loop; each recursion level scans O(n) j's in total, and there are O(log n) levels.`, vars: { answer: dp[K][n], evaluations: evals, plain: full } });
      return fr;
    },
    render: (f) => {
      const { n, t } = f, M = range(n).map((r) => range(n).map((j) => f.cells[`${r + 1},${j}`] ?? (j <= r ? "" : null)));
      const grid = Viz.grid(M, {
        label: `layer t=${t}: row i, column j = last split · cell = dp[t−1][j] + cost(j, i)`,
        rowLabels: range(n).map((r) => `i=${r + 1}`), colLabels: range(n).map((j) => `j${j}`),
        fmt: (v) => (v === null ? "" : v === "" ? "" : String(v)),
        cls: (r, j) => {
          const i = r + 1;
          if (j >= i) return "dim";
          if (f.opt[t] && f.opt[t][i] === j && f.cells[`${i},${j}`] !== undefined) return "done";
          if (f.cells[`${i},${j}`] !== undefined) return i === f.mid ? "active" : "visit";
          if (i === f.mid && f.rng && j >= f.rng[0] && j <= f.rng[1]) return "window";
          return "";
        },
      });
      const dpg = Viz.grid(f.dp.slice(1).map((row) => row.slice(1)), { label: "dp[t][i]", rowLabels: range(f.K).map((k) => `t=${k + 1}`), colLabels: range(n).map((i) => i + 1), fmt: (v) => (v === null || v === Infinity ? "" : String(v)), cls: (r, c) => (r + 1 === t && c + 1 === f.mid ? "active" : r + 1 < t || (r + 1 === t && f.dp[t][c + 1] !== null) ? "done" : "") });
      return col(grid, dpg);
    },
  }));

  /* ================= 10. Probability DP: Knight Probability in Chessboard ================= */
  const KN = [[1, 2], [2, 1], [2, -1], [1, -2], [-1, -2], [-2, -1], [-2, 1], [-1, 2]];
  const KN_CODE = [
    "cur = [[0]*n for _ in range(n)]; cur[r][c] = 1.0",
    "for step in range(k):",
    "    nxt = [[0]*n for _ in range(n)]",
    "    for x, y with cur[x][y] > 0:",
    "        for dx, dy in MOVES:              # 8 moves, each with prob 1/8",
    "            if on_board(x+dx, y+dy):",
    "                nxt[x+dx][y+dy] += cur[x][y] / 8",
    "    cur = nxt                             # mass that fell off is gone",
    "return sum(map(sum, cur))",
  ];
  Viz.register("dp-advanced-knight", (el) => Viz.player(el, {
    title: "Probability DP: push probability mass forward one move at a time",
    tag: "STATE = (step, square) · VALUE = probability",
    legend: [["active", "a sample square and its 8 moves"], ["visit", "darker = more probability"], ["bad", "mass that fell off the board"]],
    codeLang: "python",
    code: KN_CODE,
    speed: 1100,
    inputs: [
      { key: "n", label: "board n (3–8)", value: "5", width: 60 },
      { key: "k", label: "moves k (0–6)", value: "3", width: 60 },
      { key: "rc", label: "start row,col", value: "0,0", width: 70 },
    ],
    random: () => { const n = Viz.rand(3, 8); return { n: String(n), k: String(Viz.rand(1, 5)), rc: `${Viz.rand(0, n - 1)},${Viz.rand(0, n - 1)}` }; },
    build: ({ n: ns, k: ks, rc }) => {
      const n = int(ns, 3, 8, "n"), k = int(ks, 0, 6, "k"), [r0, c0] = nums(rc, { min: 2, max: 2, lo: 0, hi: n - 1, what: "Row and column" });
      let cur = range(n).map(() => Array(n).fill(0)); cur[r0][c0] = 1;
      const fr = [], sum = (g) => g.flat().reduce((x, y) => x + y, 0);
      fr.push({ n, g: cur, step: 0, src: [r0, c0], line: 0, note: `Probability 1 sits on (${r0},${c0}). Each move picks one of 8 knight jumps uniformly; jumps that leave the board lose that mass for good. The answer is the mass still on the board after ${k} moves.`, vars: { step: 0, "on board": 1 } });
      for (let s = 1; s <= k; s++) {
        const nx = range(n).map(() => Array(n).fill(0));
        let lost = 0;
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (cur[x][y]) for (const [dx, dy] of KN) { const a = x + dx, b = y + dy; if (a >= 0 && b >= 0 && a < n && b < n) nx[a][b] += cur[x][y] / 8; else lost += cur[x][y] / 8; }
        let src = null, mx = -1;
        for (let x = 0; x < n; x++) for (let y = 0; y < n; y++) if (cur[x][y] > mx) { mx = cur[x][y]; src = [x, y]; }
        cur = nx;
        fr.push({ n, g: cur, step: s, src, prevVal: mx, line: [3, 4, 5, 6, 7], note: `Move ${s}: every square spreads its probability evenly over its 8 jumps. Example: (${src[0]},${src[1]}) held ${f3(mx)} and sends ${f3(mx / 8)} along each arrow; ${KN.filter(([dx, dy]) => { const a = src[0] + dx, b = src[1] + dy; return a < 0 || b < 0 || a >= n || b >= n; }).length} of its arrows leave the board. This move lost ${f3(lost)} in total. Mass on board: <b>${f3(sum(cur))}</b>.`, vars: { step: s, "lost this move": f3(lost), "on board": f3(sum(cur)) } });
      }
      const memo = new Map(), F = (s, x, y) => { if (x < 0 || y < 0 || x >= n || y >= n) return 0; if (!s) return 1; const key = `${s},${x},${y}`; if (!memo.has(key)) memo.set(key, KN.reduce((acc, [dx, dy]) => acc + F(s - 1, x + dx, y + dy), 0) / 8); return memo.get(key); };
      assert(Math.abs(F(k, r0, c0) - sum(cur)) < 1e-9, "push DP differs from the pull recursion");
      fr.push({ n, g: cur, step: k, line: 8, note: `Answer = <b>${sum(cur).toFixed(5)}</b>. Same answer as the "pull" recursion f(s, x, y) = average of f(s−1, 8 neighbours), which computes the probability of <i>surviving</i> from each square instead. O(k·n²·8).`, vars: { answer: sum(cur).toFixed(5) } });
      return fr;
    },
    render: (f) => {
      const mx = Math.max(...f.g.flat(), 1e-12);
      const tgt = new Set(), off = [];
      if (f.src) for (const [dx, dy] of KN) { const a = f.src[0] + dx, b = f.src[1] + dy; if (a >= 0 && b >= 0 && a < f.n && b < f.n) tgt.add(`${a},${b}`); else off.push(1); }
      const rows = f.g.map((row, r) => `<tr><th>${r}</th>${row.map((v, c) => {
        const p = v ? Math.round(18 + 70 * (v / mx)) : 0, isS = f.src && f.src[0] === r && f.src[1] === c, isT = tgt.has(`${r},${c}`);
        return `<td class="dpa-heat ${isS ? "active" : isT ? "dpa-tgt" : ""}" style="${p ? `background:color-mix(in srgb, var(--v-visit) ${p}%, var(--v-node))` : ""}">${v ? (v < 0.0005 ? "&lt;.001" : v.toFixed(3).replace(/^0/, "")) : ""}</td>`;
      }).join("")}</tr>`).join("");
      const head = `<tr><th></th>${range(f.n).map((c) => `<th>${c}</th>`).join("")}</tr>`;
      const total = f.g.flat().reduce((x, y) => x + y, 0);
      const bar = `<div class="dpa-mass"><span class="v-caption">mass after move ${f.step}</span><div class="dpa-massbar"><span class="dpa-on" style="width:${(total * 100).toFixed(1)}%"></span><span class="dpa-off" style="width:${((1 - total) * 100).toFixed(1)}%"></span></div><span class="mono small">on board ${total.toFixed(4)} · fell off ${(1 - total).toFixed(4)}</span></div>`;
      return col(`<table class="dpa-heatgrid">${head}${rows}</table>`, bar);
    },
  }));

  /* ================= 11. New 21 Game: probability with a sliding window sum ================= */
  const N21_CODE = [
    "dp = [0.0] * (k + W); dp[0] = 1.0       # dp[x] = P(total ever equals x)",
    "window = 1.0                            # sum of dp[x-W .. x-1] that still draw (< k)",
    "for x in range(1, k + W):",
    "    dp[x] = window / W                  # came from x-i by drawing i, prob 1/W",
    "    if x < k: window += dp[x]           # x still draws, so it feeds later x",
    "    if x - W >= 0 and x - W < k: window -= dp[x - W]",
    "return sum(dp[k : n + 1])               # stopped with total <= n",
  ];
  Viz.register("dp-advanced-new21", (el) => Viz.player(el, {
    title: "New 21 Game: each dp cell is the average of a sliding window",
    tag: "PROBABILITY DP + PREFIX WINDOW · O(k + W)",
    legend: [["window", "states feeding dp[x] (they still draw)"], ["active", "dp[x]"], ["done", "stopped with total ≤ n (counts)"], ["bad", "stopped with total > n (bust)"]],
    codeLang: "python",
    code: N21_CODE,
    speed: 800,
    inputs: [
      { key: "n", label: "n", value: "6", width: 50 },
      { key: "k", label: "k (stop at ≥ k)", value: "5", width: 60 },
      { key: "W", label: "maxPts W", value: "4", width: 60 },
    ],
    random: () => { const k = Viz.rand(1, 10), W = Viz.rand(1, 8); return { k: String(k), W: String(W), n: String(Viz.rand(k, Math.min(20, k + W))) }; },
    build: ({ n: ns, k: ks, W: ws }) => {
      const k = int(ks, 1, 12, "k"), W = int(ws, 1, 8, "maxPts"), n = int(ns, k, 25, "n (at least k)");
      const L = k + W, dp = Array(L).fill(null), fr = [];
      dp[0] = 1;
      let win = 1;
      const snap = (o) => fr.push({ k, W, n, dp: dp.slice(), x: null, win, ...o });
      snap({ line: [0, 1], note: `Alice draws cards worth 1..${W} (equally likely) while her total is below ${k}. dp[x] = probability that her running total is ever exactly x. Totals ${k}..${L - 1} are where she stops. dp[0] = 1.`, vars: { window: 1 } });
      for (let x = 1; x < L; x++) {
        dp[x] = win / W;
        const lo = Math.max(0, x - W), hi = Math.min(x - 1, k - 1);
        let bf = 0; for (let j = lo; j <= hi; j++) bf += dp[j];
        assert(Math.abs(bf / W - dp[x]) < 1e-12, "window sum drifted from a direct sum");
        snap({ x, lo, hi, line: 3, note: `dp[${x}]: the last card was i ∈ 1..${W}, from a total x−i that was still drawing (below ${k}): states ${lo}..${hi}. Their sum is ${f3(win)}, so dp[${x}] = ${f3(win)} / ${W} = <b>${f3(dp[x])}</b>.`, vars: { x, window: f3(win), [`dp[${x}]`]: f3(dp[x]) } });
        if (x < k) win += dp[x];
        if (x - W >= 0 && x - W < k) win -= dp[x - W];
      }
      let ans = 0; for (let x = k; x <= Math.min(n, L - 1); x++) ans += dp[x];
      const memo = {}, F = (p) => (p >= k ? (p <= n ? 1 : 0) : (memo[p] ??= range(W).reduce((s, i) => s + F(p + i + 1), 0) / W));
      assert(Math.abs(F(0) - ans) < 1e-9, "sliding-window answer differs from the recursion");
      snap({ x: null, fin: true, line: 6, note: `She stops on a total in ${k}..${L - 1}. P(total ≤ ${n}) = dp[${k}] + … + dp[${Math.min(n, L - 1)}] = <b>${ans.toFixed(5)}</b>. The window turned an O(k·W) sum into O(1) per cell.`, vars: { answer: ans.toFixed(5) } });
      return fr;
    },
    render: (f) => {
      const cls = (j) => {
        if (j === f.x) return "active";
        if (f.x !== null && j >= f.lo && j <= f.hi) return "window";
        if (f.fin && j >= f.k) return j <= f.n ? "done" : "bad";
        if (f.dp[j] === null) return "dim";
        return j >= f.k ? (j <= f.n ? "done" : "bad") : "";
      };
      const arr = Viz.array(f.dp, { label: `dp[x], x = 0..${f.k + f.W - 1}  (draw while x < ${f.k})`, showIdx: true, fmt: (v) => (v === null ? "·" : v === 1 ? "1" : v.toFixed(2).replace(/^0/, "")), cls });
      return arr;
    },
  }));

  /* ================= 12. Matrix exponentiation ================= */
  const MP_MODES = ["Fibonacci, exact (n ≤ 90)", "Fibonacci mod 1e9+7 (n ≤ 10^18)", "Tribonacci, exact (n ≤ 70)"];
  const MP_CODE = [
    "def mat_pow(M, e):                       # O(d³ log e)",
    "    R = identity(d)",
    "    while e:",
    "        if e & 1: R = mul(R, M)           # this bit of e is set: use M^(2^i)",
    "        M = mul(M, M)                      # M^(2^i) -> M^(2^(i+1))",
    "        e >>= 1",
    "    return R",
    "# Fibonacci: [[1,1],[1,0]]^n = [[F(n+1),F(n)],[F(n),F(n-1)]]",
  ];
  const MOD = 1000000007n;
  Viz.register("dp-advanced-matpow", (el) => Viz.player(el, {
    title: "Matrix exponentiation: a linear recurrence in O(log n) multiplications",
    tag: "SQUARE-AND-MULTIPLY ON MATRICES",
    legend: [["active", "current bit of n"], ["done", "bits already used"], ["window", "matrix just updated"]],
    codeLang: "python",
    code: MP_CODE,
    speed: 1000,
    inputs: [
      { key: "mode", label: "recurrence", type: "select", options: MP_MODES, value: MP_MODES[0] },
      { key: "n", label: "n", value: "13", width: 190 },
    ],
    random: () => ({ n: String(Viz.rand(2, 70)) }),
    build: ({ mode, n: ns }) => {
      const tri = mode === MP_MODES[2], md = mode === MP_MODES[1] ? MOD : null;
      const lim = mode === MP_MODES[1] ? 10n ** 18n : tri ? 70n : 90n;
      const t = String(ns).trim();
      if (!/^\d+$/.test(t) || BigInt(t) > lim) throw new Error(`n must be a whole number from 0 to ${lim}.`);
      const N = BigInt(t), d = tri ? 3 : 2;
      const red = (x) => (md ? x % md : x);
      const mul = (A, B) => range(d).map((i) => range(d).map((j) => red(range(d).reduce((s, k) => s + A[i][k] * B[k][j], 0n))));
      let R = range(d).map((i) => range(d).map((j) => (i === j ? 1n : 0n)));
      let M = tri ? [[1n, 1n, 1n], [1n, 0n, 0n], [0n, 1n, 0n]] : [[1n, 1n], [1n, 0n]];
      const bits = N.toString(2).split("").reverse().map(Number), fr = [];
      let e = N, i = 0, muls = 0;
      const snap = (o) => fr.push({ bits, i, R: R.map((r) => r.slice()), M: M.map((r) => r.slice()), tri, hiR: false, hiM: false, ...o });
      snap({ line: [0, 1], note: `${tri ? "T(n) = T(n−1) + T(n−2) + T(n−3)" : "F(n) = F(n−1) + F(n−2)"} is linear, so one step is a matrix-vector product and n steps are M^n. Write n = ${N} in binary (${N.toString(2)}, read right to left) and keep squaring M: M, M², M⁴, M⁸, … Multiply R by the powers whose bit is 1.${md ? " Every entry is reduced mod 1e9+7." : ""}`, vars: { n: String(N), bits: bits.length } });
      while (e > 0n) {
        const b = Number(e & 1n);
        if (b) { R = mul(R, M); muls++; }
        snap({ hiR: !!b, line: [2, 3], note: `Bit ${i} is ${b}: ${b ? `R = R × M^(2^${i}). R now equals M^${(N & ((1n << BigInt(i + 1)) - 1n)).toString()}.` : `skip, M^(2^${i}) is not part of n.`}`, vars: { bit: i, value: b, "R = M^": (N & ((1n << BigInt(i + 1)) - 1n)).toString(), multiplies: muls } });
        e >>= 1n;
        if (e > 0n) { M = mul(M, M); muls++; snap({ i: i + 1, hiM: true, line: [4, 5], note: `Square: M becomes M^(2^${i + 1}) = M^${(1n << BigInt(i + 1)).toString()}.`, vars: { bit: i + 1, multiplies: muls } }); }
        i++;
      }
      let ans;
      if (tri) ans = R[2][0] + R[2][1]; else ans = R[0][1];
      if (tri) ans = range(3).reduce((s, k) => s + R[2][k] * [1n, 1n, 0n][k], 0n);
      let ref;
      if (tri) { const T3 = [0n, 1n, 1n]; for (let k = 3; k <= Number(N); k++) T3.push(T3[k - 1] + T3[k - 2] + T3[k - 3]); ref = T3[Number(N)]; }
      else if (!md) { let a = 0n, b2 = 1n; for (let k = 0n; k < N; k++) [a, b2] = [b2, a + b2]; ref = a; }
      else { const fd = (k) => { if (k === 0n) return [0n, 1n]; const [a, b2] = fd(k >> 1n), c = (a * ((2n * b2 - a + MOD) % MOD)) % MOD, dd = (a * a + b2 * b2) % MOD; return k & 1n ? [dd, (c + dd) % MOD] : [c, dd]; }; ref = fd(N)[0]; }
      assert(ans === ref, "matrix power differs from the reference recurrence");
      snap({ i: bits.length, line: tri ? 6 : [6, 7], note: `${tri ? `T(${N}) = bottom row of M^${N} · [T2, T1, T0] = [1,1,0]` : `F(${N}) = top-right entry of M^${N}`} = <b>${ans.toString()}</b>${md ? " (mod 1e9+7)" : ""}. ${muls} matrix multiplications instead of ${N.toString()} steps.`, vars: { answer: ans.toString(), multiplies: muls } });
      return fr;
    },
    render: (f) => {
      const bits = Viz.array(f.bits, { label: "bits of n (bit 0 first)", showIdx: true, cls: (j) => (j === f.i ? "active" : j < f.i ? "done" : "") });
      const g = (A, lab, hi) => Viz.grid(A.map((r) => r.map(String)), { label: lab, cls: () => (hi ? "window" : "") });
      return col(bits, Viz.row(g(f.R, "R (result so far)", f.hiR), g(f.M, `M^(2^${Math.min(f.i, f.bits.length - 1)})`, f.hiM)));
    },
  }));

  /* ================= 13. Game theory: Sprague-Grundy numbers ================= */
  const GR_CODE = [
    "g = [0] * (N + 1)",
    "for x in range(1, N + 1):",
    "    reach = {g[x - s] for s in S if s <= x}  # positions one move away",
    "    m = 0",
    "    while m in reach: m += 1                 # mex = smallest missing value",
    "    g[x] = m                                  # g == 0  <=>  losing position",
    "# several piles: XOR their g values; 0 means the player to move loses",
  ];
  Viz.register("dp-advanced-grundy", (el) => Viz.player(el, {
    title: "Sprague-Grundy: win/lose DP generalised to numbers you can XOR",
    tag: "GAME DP · MEX",
    legend: [["active", "position x"], ["window", "positions reachable in one move"], ["bad", "g = 0: player to move loses"], ["done", "g > 0: player to move wins"]],
    codeLang: "python",
    code: GR_CODE,
    speed: 800,
    inputs: [
      { key: "S", label: "allowed takes S", value: "1,3,4", width: 100 },
      { key: "N", label: "max pile N", value: "14", width: 60 },
      { key: "piles", label: "piles to judge", value: "5,9,11", width: 110 },
    ],
    random: () => { const S = [...new Set(Viz.randInts(Viz.rand(1, 3), 1, 6))].sort((a, b) => a - b); return { S: S.join(","), N: String(Viz.rand(8, 16)), piles: Viz.randInts(Viz.rand(1, 3), 0, 8).join(",") }; },
    build: ({ S: ss, N: ns, piles: ps }) => {
      const S = [...new Set(nums(ss, { min: 1, max: 5, lo: 1, hi: 9, what: "Moves" }))].sort((a, b) => a - b), N = int(ns, 1, 16, "N");
      const P = String(ps).trim() ? nums(ps, { min: 1, max: 3, lo: 0, hi: N, what: "Piles" }) : [];
      const g = Array(N + 1).fill(null), fr = [];
      g[0] = 0;
      const snap = (o) => fr.push({ g: g.slice(), x: null, reach: [], ...o });
      snap({ line: 0, note: `Two players alternately remove ${S.join(" or ")} stones; whoever cannot move loses. Position 0 has no moves, so it is losing: g(0) = 0. A position is losing exactly when every move leads to a winning one.`, vars: { S: S.join(",") } });
      for (let x = 1; x <= N; x++) {
        const reach = S.filter((s) => s <= x).map((s) => x - s), vals = new Set(reach.map((y) => g[y]));
        let m = 0; while (vals.has(m)) m++;
        g[x] = m;
        snap({ x, reach, line: [2, 3, 4, 5], note: `x = ${x}: moves reach ${reach.length ? reach.join(", ") : "nothing"} with g values {${[...vals].sort((a, b) => a - b).join(", ")}}. mex = <b>${m}</b>. ${m === 0 ? "Every move hands the opponent a winning position: x is <b>losing</b>." : "Some move reaches a g = 0 position, so x is <b>winning</b>."}`, vars: { x, reach: [...vals].join(","), "g[x]": m } });
      }
      const win = [false]; for (let x = 1; x <= N; x++) win[x] = S.some((s) => s <= x && !win[x - s]);
      for (let x = 0; x <= N; x++) assert((g[x] === 0) === !win[x], `g(${x}) = 0 should mean losing`);
      if (P.length) {
        const memo = new Map(), W = (st) => { const k = st.join(","); if (memo.has(k)) return memo.get(k); let r = false; for (let i = 0; i < st.length && !r; i++) for (const s of S) if (s <= st[i]) { const t = st.slice(); t[i] -= s; if (!W(t)) { r = true; break; } } memo.set(k, r); return r; };
        const X = P.reduce((a, p) => a ^ g[p], 0);
        assert((X !== 0) === W(P), "XOR of Grundy numbers disagrees with brute-force game search");
        snap({ piles: P, X, line: 6, note: `Piles ${P.join(", ")} are independent games played side by side. Sprague-Grundy: the sum behaves like Nim with heaps g = ${P.map((p) => g[p]).join(" ⊕ ")} = <b>${X}</b>. ${X ? "Non-zero: the first player wins (move to make the XOR 0)." : "Zero: the first player loses with best play."} Confirmed by brute-force search over all positions.`, vars: { "XOR of g": X, winner: X ? "first" : "second" } });
      }
      return fr;
    },
    render: (f) => {
      const arr = Viz.array(f.g, { label: "g(x) = Grundy number of a pile of x", showIdx: true, cls: (j, v) => (j === f.x ? "active" : f.reach.includes(j) ? "window" : f.piles && f.piles.includes(j) ? "active" : v === null ? "dim" : v === 0 ? "bad" : "done") });
      let extra = "";
      if (f.piles) extra = `<div class="dpa-xor mono">${f.piles.map((p) => `g(${p})=${f.g[p]} <span class="muted">(${f.g[p].toString(2).padStart(3, "0")})</span>`).join(" ⊕ ")} = <b>${f.X}</b></div>`;
      return col(arr, extra);
    },
  }));
})();
