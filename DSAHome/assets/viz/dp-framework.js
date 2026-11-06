/* Visualizers for The DP Framework. Every name is prefixed "dp-framework-". Frames are produced by running the real algorithms. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when the program changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const INF = Infinity;
  const fmtN = (v) => (v === INF ? "∞" : v === -INF ? "-∞" : v === null || v === undefined ? "" : String(v));

  /* ---------- SVG table with dependency arrows (cells use the svg.dg box classes) ---------- */
  function dgrid(M, o = {}) {
    const R = M.length, C = Math.max(1, ...M.map((r) => r.length));
    const cs = o.size || 46, gap = o.gap ?? 8;
    const padL = o.rowLabels ? (o.rowLabelW || 50) : 4;
    const up = o.arcUp || 0, down = o.arcDown || 0;
    const padT = (o.colLabels ? 20 : 4) + up;
    const off = (r) => (o.rowOffset ? o.rowOffset(r) : 0);
    const X = (r, c) => padL + (c + off(r)) * (cs + gap), Y = (r) => padT + r * (cs + gap);
    const W = padL + C * (cs + gap) - gap + 6, H = Y(R) - gap + 6 + down;
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dpf-lab" x="${X(0, c) + cs / 2}" y="13" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dpf-lab" x="${padL - 8}" y="${Y(r) + cs / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((row, r) => row.forEach((v, c) => {
      if (v === undefined) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(r, c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="7"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fmtN(v);
      s += `<text class="dpf-v ${cl}" x="${x + cs / 2}" y="${y + cs / 2 + (o.sub ? 4 : 0)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
      const sb = o.sub ? o.sub(r, c, v) : "";
      if (sb !== "" && sb !== null && sb !== undefined) s += `<text class="dpf-sub" x="${x + 5}" y="${y + 12}">${esc(sb)}</text>`;
      const tg = o.tag ? o.tag(r, c, v) : "";
      if (tg) s += `<text class="dpf-sub" x="${x + cs - 5}" y="${y + 12}" text-anchor="end">${esc(tg)}</text>`;
    }));
    const head = (x2, y2, vx, vy, cl) => `<polygon class="dpf-ah ${cl}" points="${x2},${y2} ${x2 - vx * 9 - vy * 4.5},${y2 - vy * 9 + vx * 4.5} ${x2 - vx * 9 + vy * 4.5},${y2 - vy * 9 - vx * 4.5}"/>`;
    for (const a of o.arrows || []) {
      const [r1, c1] = a.from, [r2, c2] = a.to, cl = a.cls || "active";
      if (a.arc) {
        const dir = a.arc === "down" ? 1 : -1;
        const x1 = X(r1, c1) + cs / 2 + (c2 > c1 ? 6 : -6), x2 = X(r2, c2) + cs / 2 + (c2 > c1 ? -6 : 6);
        const y1 = dir < 0 ? Y(r1) - 1 : Y(r1) + cs + 1, y2 = dir < 0 ? Y(r2) - 2 : Y(r2) + cs + 2;
        const span = Math.abs(c2 - c1) + Math.abs(off(r2) - off(r1));
        const h = Math.min((dir < 0 ? up : down) - 6, 10 + 9 * span);
        const mx = (x1 + x2) / 2, my = Math.min(y1, y2) + dir * h * 2;
        const ex = x2 - mx, ey = y2 - my, el = Math.hypot(ex, ey) || 1;
        s += `<path class="dpf-halo" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/><path class="dpf-e ${cl}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>${head(x2, y2, ex / el, ey / el, cl)}`;
        if (a.label !== undefined) s += `<text class="dpf-el ${cl}" x="${mx}" y="${(Math.min(y1, y2) + my) / 2 + dir * 2}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
        continue;
      }
      const cx1 = X(r1, c1) + cs / 2, cy1 = Y(r1) + cs / 2, cx2 = X(r2, c2) + cs / 2, cy2 = Y(r2) + cs / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const m = Math.max(Math.abs(ux), Math.abs(uy));
      const k1 = (cs / 2 / m) * 0.35, k2 = cs / 2 / m + 1;
      const x1 = cx1 + ux * k1, y1 = cy1 + uy * k1, x2 = cx2 - ux * k2, y2 = cy2 - uy * k2;
      s += `<path class="dpf-halo" d="M${x1},${y1} L${x2},${y2}"/><path class="dpf-e ${cl}" d="M${x1},${y1} L${x2},${y2}"/>${head(x2, y2, ux, uy, cl)}`;
      if (a.label !== undefined) s += `<text class="dpf-el ${cl}" x="${(x1 + x2) / 2 - uy * 9}" y="${(y1 + y2) / 2 + ux * 9}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dpf-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "DP table")}">${s}</svg></div>`;
  }
  const parseGrid = (s, { maxR = 6, maxC = 7, min = -99, max = 99 } = {}) => {
    const g = Viz.parse.matrix(s);
    if (!g.length || g.length > maxR) throw new Error(`Use 1 to ${maxR} rows separated by ";".`);
    if (g.some((r) => r.length !== g[0].length)) throw new Error("Every row needs the same number of values.");
    if (g[0].length > maxC) throw new Error(`Use at most ${maxC} columns.`);
    if (g.flat().some((v) => typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)) throw new Error(`Cells must be whole numbers from ${min} to ${max}.`);
    return g;
  };
  const parseSize = (s, maxR = 5, maxC = 6) => {
    const m = String(s).trim().match(/^(\d+)\s*[x×*, ]\s*(\d+)$/i);
    if (!m) throw new Error('Write the size as rows x cols, for example "3x4".');
    const R = +m[1], C = +m[2];
    if (R < 1 || C < 1 || R > maxR || C > maxC) throw new Error(`Use 1–${maxR} rows and 1–${maxC} columns.`);
    return [R, C];
  };
  const randGrid = (R, C, lo, hi) => Array.from({ length: R }, () => Viz.randInts(C, lo, hi).join(",")).join("; ");
  const minCostTable = (cost) => { const n = cost.length, dp = [0, 0]; for (let i = 2; i <= n; i++) dp[i] = Math.min(dp[i - 1] + cost[i - 1], dp[i - 2] + cost[i - 2]); return dp; };

  /* ================= 1. Recursion tree: plain vs memo, with call counters ================= */
  const TREE_MODES = ["plain recursion", "memoized"];
  const TREE_CODE = {
    plain: ["def f(i):              # min cost to stand on step i", "    if i < 2:", "        return 0       # start on step 0 or 1 for free", "    return min(f(i - 1) + cost[i - 1],", "               f(i - 2) + cost[i - 2])", "", ""],
    memo: ["memo = {}", "def f(i):", "    if i < 2: return 0", "    if i in memo: return memo[i]   # hit: no subtree", "    memo[i] = min(f(i - 1) + cost[i - 1],", "                  f(i - 2) + cost[i - 2])", "    return memo[i]"],
  };
  const plainCalls = (n) => { const C = [1, 1]; for (let i = 2; i <= n; i++) C[i] = 1 + C[i - 1] + C[i - 2]; return C[n]; };
  Viz.register("dp-framework-tree", (el, opts) => Viz.player(el, {
    title: "Min Cost Climbing Stairs as a recursion tree: count the calls",
    tag: "RECURSION TREE → MEMO",
    legend: [["active", "current call"], ["visit", "waiting for its children"], ["done", "solved the first time"], ["bad", "repeat: solved again from scratch"], ["path", "memo hit: answered in O(1)"]],
    codeLang: "python",
    code: Array(7).fill(""),
    inputs: [
      { key: "mode", label: "mode", type: "select", value: opts && TREE_MODES.includes(opts.mode) ? opts.mode : TREE_MODES[0], options: TREE_MODES },
      { key: "cost", label: "cost (2 to 7 steps)", value: (opts && opts.cost) || "1,100,1,1,1,100", width: 190 },
    ],
    random: () => ({ cost: Viz.randInts(Viz.rand(4, 7), 1, 20).join(",") }),
    build: ({ mode, cost: cs }) => {
      const memo = mode === TREE_MODES[1];
      setCode(el, memo ? TREE_CODE.memo : TREE_CODE.plain);
      const cost = Viz.parse.ints(cs, { min: 2, max: 7 });
      if (cost.some((c) => c < 0 || c > 999)) throw new Error("Costs must be 0 to 999.");
      const n = cost.length, L = (k) => (memo ? k : [0, 1, 2, 3, 3, 4, 4][k]);
      const nodes = [], kids = new Map(), cache = new Map(), seen = new Set(), st = new Map(), val = new Map(), path = [], count = Array(n + 1).fill(0), fr = [];
      let calls = 0, repeats = 0, hits = 0;
      const total = memo ? 2 * n - 1 : plainCalls(n);
      const snap = (note, line) => fr.push({
        st: new Map(st), val: new Map(val), path: path.slice(), count: count.slice(),
        memoArr: Array.from({ length: n + 1 }, (_, i) => (cache.has(i) ? cache.get(i) : null)), note, line,
        vars: { calls, [memo ? "memo hits" : "repeated calls"]: memo ? hits : repeats, "calls when finished": total, "distinct states": n + 1 },
      });
      const go = (i, parent) => {
        const id = nodes.length; nodes.push(i); kids.set(id, []); if (parent !== null) kids.get(parent).push(id);
        calls++; count[i]++; path.push(id); path.slice(0, -1).forEach((p) => st.set(p, "visit")); st.set(id, "active");
        const again = seen.has(i) && i >= 2;
        if (i < 2) {
          val.set(id, 0); st.set(id, "done");
          snap(`f(${i}): step ${i} is a <b>base case</b>. You may start there for free, so it costs 0.`, memo ? 2 : [1, 2]);
          path.pop(); return 0;
        }
        if (memo && cache.has(i)) {
          hits++; val.set(id, cache.get(i)); st.set(id, "path");
          snap(`f(${i}) is already in the memo: <b>hit</b>, return ${cache.get(i)} immediately. Its whole subtree is skipped. That is the saving.`, 3);
          path.pop(); return cache.get(i);
        }
        snap(again ? `f(${i}) <b>again</b>. Plain recursion has no memory, so the identical subtree under it is rebuilt from scratch.` : `Call f(${i}): the cheapest way to stand on step ${i} is to arrive from step ${i - 1} or from step ${i - 2}. Ask both.`, memo ? 1 : 0);
        const a = go(i - 1, id) + cost[i - 1]; st.set(id, "active");
        snap(`Back in f(${i}): coming from step ${i - 1} costs f(${i - 1}) + cost[${i - 1}] = ${a - cost[i - 1]} + ${cost[i - 1]} = ${a}. Now ask about step ${i - 2}.`, L(4));
        const b = go(i - 2, id) + cost[i - 2]; st.set(id, "active");
        const r = Math.min(a, b);
        if (again && !memo) repeats++;
        seen.add(i); if (memo) cache.set(i, r);
        val.set(id, r); st.set(id, again && !memo ? "bad" : "done");
        snap(`f(${i}) = min(${a}, f(${i - 2}) + cost[${i - 2}] = ${b}) = <b>${r}</b>${memo ? `. Store memo[${i}] = ${r}` : again ? ". Wasted: this exact value was computed before" : ""}.`, memo ? [4, 5] : [3, 4]);
        path.pop(); return r;
      };
      const ans = go(n, null);
      fr.push({ ...fr[fr.length - 1], path: [], ans, line: memo ? 6 : 3, note: memo
        ? `Answer f(${n}) = <b>${ans}</b> in <b>${calls}</b> calls (plain recursion: ${plainCalls(n)}). Each of the ${n - 1} non-base states is solved once and asks two questions, so calls = 2n − 1: <b>O(n)</b>. That is top-down DP.`
        : `Answer f(${n}) = <b>${ans}</b> after <b>${calls}</b> calls, ${repeats} of them repeats, yet there are only <b>${n + 1} distinct states</b> (i = 0…${n}). Calls grow like 1.6ⁿ; states grow like n. Switch the mode to "memoized".` });
      const lay = Viz.layoutTree(0, (id) => kids.get(id), (id) => String(nodes[id]), { dx: 36, dy: 56 });
      return fr.map((f) => ({ ...f, lay, memo }));
    },
    render: (f) => {
      const t = { nodes: f.lay.nodes.map((nd) => ({ ...nd, sub: f.val.has(nd.id) ? f.val.get(nd.id) : undefined })), edges: f.lay.edges };
      const ps = new Set(f.path);
      const g = Viz.graph(t, { r: 15, label: "node = step i of f(i); number under it = the cost it returned", nodeCls: (id) => f.st.get(Number(id)) || "dpf-hide", edgeCls: (key) => { const [u, v] = key.split("-").map(Number); return !f.st.has(v) ? "dpf-hide" : ps.has(u) && ps.has(v) ? "active" : ""; } });
      const side = f.memo
        ? Viz.array(f.memoArr, { label: "memo (index = i)", cls: (i, v) => (v !== null ? "done" : "dim"), fmt: (v) => (v === null ? "·" : v) })
        : Viz.array(f.count, { label: "times f(i) was called (index = i)", cls: (i, v) => (v > 1 ? "bad" : v === 1 ? "done" : "dim") });
      return `<div class="dpf-col">${g}${side}</div>`;
    },
  }));

  /* ================= 2. Top-down vs bottom-up, racing on the same table ================= */
  const SBS = ["min cost climbing stairs (1D)", "unique paths (grid)"];
  const SBS_CODE = {
    stairs: ["# TOP-DOWN: recursion + memo", "def f(i):", "    if i < 2: return 0", "    if i in memo: return memo[i]", "    memo[i] = min(f(i-1) + cost[i-1], f(i-2) + cost[i-2])", "    return memo[i]",
      "# BOTTOM-UP: loop in dependency order", "dp = [0] * (n + 1)              # dp[0] = dp[1] = 0", "for i in range(2, n + 1):", "    dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])", ""],
    grid: ["# TOP-DOWN: recursion + memo", "def f(r, c):", "    if r == 0 or c == 0: return 1", "    if (r, c) in memo: return memo[r, c]", "    memo[r, c] = f(r - 1, c) + f(r, c - 1)", "    return memo[r, c]",
      "# BOTTOM-UP: loop in dependency order", "dp = [[1] * C for _ in range(R)]   # row 0, col 0 = 1", "for r in range(1, R):", "    for c in range(1, C):", "        dp[r][c] = dp[r - 1][c] + dp[r][c - 1]"],
  };
  Viz.register("dp-framework-side-by-side", (el, opts) => Viz.player(el, {
    title: "Top-down and bottom-up fill the same table: watch them race",
    tag: "MEMO vs TABULATION",
    legend: [["active", "cell being computed"], ["visit", "on the call stack (waiting)"], ["done", "final value"], ["path", "base case"]],
    codeLang: "python",
    code: Array(11).fill(""),
    speed: 700,
    inputs: [
      { key: "p", label: "problem", type: "select", value: opts && SBS.includes(opts.p) ? opts.p : SBS[0], options: SBS },
      { key: "cost", label: "cost (stairs)", value: "10,15,20,5,10,25,5", width: 170 },
      { key: "size", label: "rows x cols (grid)", value: "3x4", width: 70 },
    ],
    random: () => ({ cost: Viz.randInts(Viz.rand(4, 9), 1, 30).join(","), size: `${Viz.rand(2, 4)}x${Viz.rand(3, 5)}` }),
    build: ({ p, cost: cs, size }) => {
      const grid = p === SBS[1];
      setCode(el, grid ? SBS_CODE.grid : SBS_CODE.stairs);
      let R, C, cost;
      if (grid) [R, C] = parseSize(size, 4, 5);
      else { cost = Viz.parse.ints(cs, { min: 2, max: 10 }); if (cost.some((x) => x < 0 || x > 999)) throw new Error("Costs must be 0 to 999."); R = 1; C = cost.length + 1; }
      const key = (r, c) => r * C + c;
      /* ---- top-down events ---- */
      const td = [], tdTab = Array.from({ length: R }, () => Array(C).fill(null)), tdOrd = Array.from({ length: R }, () => Array(C).fill(null)), tdBase = new Set(), stack = [];
      let calls = 0, fills = 0;
      const tdSnap = (cur, note, line, deps = []) => td.push({ tab: Viz.clone(tdTab), ord: Viz.clone(tdOrd), base: new Set(tdBase), stack: stack.slice(), cur, deps, note, line, calls, fills });
      const lab = (r, c) => (grid ? `f(${r},${c})` : `f(${c})`);
      const goTD = (r, c) => {
        calls++; stack.push([r, c]);
        const isBase = grid ? r === 0 || c === 0 : c < 2;
        if (isBase) {
          tdTab[r][c] = grid ? 1 : 0; tdBase.add(key(r, c));
          tdSnap([r, c], `${lab(r, c)} is a base case: return ${tdTab[r][c]} without recursing.`, 2);
          stack.pop(); return tdTab[r][c];
        }
        if (tdOrd[r][c] !== null) { tdSnap([r, c], `${lab(r, c)} is memoized: hit, return ${tdTab[r][c]}.`, 3); stack.pop(); return tdTab[r][c]; }
        tdSnap([r, c], `Call ${lab(r, c)}. Not solved yet, so it must first ask its smaller subproblems: the stack <b>descends</b>.`, 1);
        let v, deps;
        if (grid) { v = goTD(r - 1, c) + goTD(r, c - 1); deps = [[r - 1, c], [r, c - 1]]; }
        else { v = Math.min(goTD(0, c - 1) + cost[c - 1], goTD(0, c - 2) + cost[c - 2]); deps = [[0, c - 1], [0, c - 2]]; }
        tdTab[r][c] = v; tdOrd[r][c] = ++fills;
        tdSnap([r, c], `Both answers are back: ${lab(r, c)} = <b>${v}</b>. It is cell #${fills} to be finalised.`, 4, deps);
        stack.pop(); return v;
      };
      goTD(R - 1, C - 1);
      /* ---- bottom-up events ---- */
      const bu = [], buTab = Array.from({ length: R }, () => Array(C).fill(null)), buOrd = Array.from({ length: R }, () => Array(C).fill(null));
      let iters = 0, bfills = 0;
      if (grid) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) { if (r === 0 || c === 0) buTab[r][c] = 1; }
      else { buTab[0][0] = 0; buTab[0][1] = 0; }
      bu.push({ tab: Viz.clone(buTab), ord: Viz.clone(buOrd), cur: null, deps: [], note: "Allocate the table and write the base cases directly. No recursion, no stack.", line: 7, iters });
      if (grid) {
        for (let r = 1; r < R; r++) for (let c = 1; c < C; c++) {
          iters++; buTab[r][c] = buTab[r - 1][c] + buTab[r][c - 1]; buOrd[r][c] = ++bfills;
          bu.push({ tab: Viz.clone(buTab), ord: Viz.clone(buOrd), cur: [r, c], deps: [[r - 1, c], [r, c - 1]], note: `dp[${r}][${c}] = above ${buTab[r - 1][c]} + left ${buTab[r][c - 1]} = <b>${buTab[r][c]}</b>. Both inputs were filled earlier in row-major order.`, line: 10, iters });
        }
      } else {
        for (let i = 2; i < C; i++) {
          iters++; buTab[0][i] = Math.min(buTab[0][i - 1] + cost[i - 1], buTab[0][i - 2] + cost[i - 2]); buOrd[0][i] = ++bfills;
          bu.push({ tab: Viz.clone(buTab), ord: Viz.clone(buOrd), cur: [0, i], deps: [[0, i - 1], [0, i - 2]], note: `dp[${i}] = min(${buTab[0][i - 1]} + ${cost[i - 1]}, ${buTab[0][i - 2]} + ${cost[i - 2]}) = <b>${buTab[0][i]}</b>. Its inputs are to the left, already final.`, line: 9, iters });
        }
      }
      const F = Math.max(td.length, bu.length), fr = [];
      const ans = grid ? buTab[R - 1][C - 1] : buTab[0][C - 1];
      for (let k = 0; k < F; k++) {
        const a = td[Math.min(k, td.length - 1)], b = bu[Math.min(k, bu.length - 1)];
        const tdDone = k >= td.length - 1, buDone = k >= bu.length - 1;
        const lines = []; if (k < td.length) lines.push(a.line); if (k < bu.length) lines.push(b.line);
        fr.push({ a, b, R, C, grid, cost, tdDone: k >= td.length, buDone: k >= bu.length, line: lines,
          note: `<b>Top-down:</b> ${k < td.length ? a.note : "finished."}<br><b>Bottom-up:</b> ${k < bu.length ? b.note : `finished after ${bu.length} steps; top-down is still unwinding its calls.`}`,
          vars: { "TD calls": a.calls, "TD stack depth": a.stack.length, "TD filled": a.fills, "BU iterations": b.iters, "BU filled": b.iters } });
      }
      fr.push({ ...fr[fr.length - 1], line: [], tdDone: true, buDone: true, ans, note: `Same table, same answer <b>${ans}</b>. Top-down made ${calls} calls and needed a stack ${Math.max(...td.map((x) => x.stack.length))} deep; bottom-up made ${iters} loop iterations and no calls. ${grid ? "The fill <b>order</b> differed (compare the #numbers): any order that computes a cell after the cells it reads is valid." : "In 1D both finalise cells in the same order 2, 3, 4…: top-down just has to descend first to discover it."}` });
      return fr;
    },
    render: (f) => {
      const one = (s, title, isTD) => {
        const cls = (r, c) => {
          const k = r * f.C + c;
          if (s.cur && s.cur[0] === r && s.cur[1] === c) return "active";
          if (s.deps.some(([a, b]) => a === r && b === c)) return "done dep";
          if (isTD && s.stack.some(([a, b]) => a === r && b === c)) return "visit";
          if (isTD ? s.base.has(k) : (s.tab[r][c] !== null && s.ord[r][c] === null)) return "path";
          return s.tab[r][c] !== null ? "done" : "";
        };
        const arrows = s.cur ? s.deps.map((d) => ({ from: d, to: s.cur, cls: "visit", arc: f.grid ? undefined : "up" })) : [];
        const g = dgrid(s.tab, { label: title, cls, arrows, arcUp: f.grid ? 0 : 34, size: 44, sub: (r, c) => (s.ord[r][c] ? `#${s.ord[r][c]}` : ""), colLabels: f.grid ? s.tab[0].map((_, c) => `c${c}`) : s.tab[0].map((_, i) => `i=${i}`), rowLabels: f.grid ? s.tab.map((_, r) => `r${r}`) : undefined, rowLabelW: 30 });
        if (!isTD) return g;
        const stk = Viz.stack(s.stack.map(([r, c]) => (f.grid ? `f(${r},${c})` : `f(${c})`)), { label: "call stack", cls: (i) => (i === s.stack.length - 1 ? "active" : "visit") });
        return Viz.row(g, stk);
      };
      return `<div class="dpf-col">${f.grid ? "" : Viz.array(f.cost, { label: "cost[i] (pay it when you leave step i)" })}${Viz.row(one(f.a, "TOP-DOWN memo (#k = order finalised)", true), one(f.b, "BOTTOM-UP dp table (#k = order finalised)", false))}</div>`;
    },
  }));

  /* ================= 3. State-space DAG: counting vs optimizing vs feasibility ================= */
  const DAG_MODES = ["min cost (min, +)", "count routes (sum, ×)", "reachable? (or, and)"];
  const DAG_CODE = {
    min: ["for v in topological_order:        # G, 0, 1, ..., top", "    if v is broken: val[v] = inf; continue", "    val[v] = min(val[u] + w(u, v)  for u -> v)", "answer = val[top]          # min-plus: shortest path"],
    count: ["for v in topological_order:        # G, 0, 1, ..., top", "    if v is broken: val[v] = 0; continue", "    val[v] = sum(val[u]  for u -> v)", "answer = val[top]          # sum-product: count paths"],
    reach: ["for v in topological_order:        # G, 0, 1, ..., top", "    if v is broken: val[v] = False; continue", "    val[v] = any(val[u]  for u -> v)", "answer = val[top]          # or-and: is there a path?"],
  };
  Viz.register("dp-framework-dag", (el) => Viz.player(el, {
    title: "Every DP is a computation over a DAG of states",
    tag: "STATE-SPACE DAG",
    legend: [["active", "state being computed"], ["visit", "incoming edges it reads"], ["done", "final"], ["bad", "broken step"], ["path", "optimal / witness path"]],
    codeLang: "python",
    code: Array(4).fill(""),
    inputs: [
      { key: "mode", label: "question", type: "select", value: DAG_MODES[0], options: DAG_MODES },
      { key: "cost", label: "cost[i]", value: "1,100,1,1,1,100,1,1", width: 190 },
      { key: "broken", label: "broken steps", value: "", width: 90 },
    ],
    random: () => { const n = Viz.rand(5, 9); const b = new Set(); for (let k = 0; k < Viz.rand(0, 2); k++) b.add(Viz.rand(0, n - 1)); return { cost: Viz.randInts(n, 1, 30).join(","), broken: [...b].join(",") }; },
    build: ({ mode, cost: cs, broken: bs }) => {
      const kind = mode === DAG_MODES[0] ? "min" : mode === DAG_MODES[1] ? "count" : "reach";
      setCode(el, DAG_CODE[kind]);
      const cost = Viz.parse.ints(cs, { min: 2, max: 9 });
      if (cost.some((x) => x < 0 || x > 999)) throw new Error("Costs must be 0 to 999.");
      const n = cost.length;
      const broken = new Set(String(bs).trim() ? Viz.parse.ints(bs, { min: 0, max: 9 }) : []);
      for (const b of broken) if (!Number.isInteger(b) || b < 0 || b >= n) throw new Error(`Broken steps are indices 0 to ${n - 1} (the top cannot be broken).`);
      /* nodes: G (ground), 0..n-1 (steps), n (top) */
      const ids = ["G", ...Array.from({ length: n + 1 }, (_, i) => String(i))];
      const lbl = (id) => (id === String(n) ? "top" : id);
      const nodes = ids.map((id) => (id === "G" ? { id, x: 0, y: 55 } : { id, x: (Number(id) + 1) * 78, y: Number(id) % 2 ? 0 : 110, label: lbl(id) }));
      const edges = [{ u: "G", v: "0", w: 0 }, { u: "G", v: "1", w: 0 }];
      for (let i = 0; i < n; i++) for (const d of [1, 2]) if (i + d <= n) edges.push({ u: String(i), v: String(i + d), w: cost[i] });
      const inc = (v) => edges.filter((e) => e.v === v);
      const val = { G: kind === "min" ? 0 : kind === "count" ? 1 : true }, par = {}, fr = [];
      const show = (x) => (kind === "reach" ? (x ? "T" : "F") : fmtN(x));
      const snap = (cur, reads, note, line, extra = {}) => fr.push({ val: { ...val }, cur, reads, note, line, vars: { v: cur ? lbl(cur) : "—", ...(cur && val[cur] !== undefined ? { "val[v]": show(val[cur]) } : {}) }, ...extra });
      snap("G", [], `G is the ground before step 0. It is the <b>source</b> of the DAG: val[G] = ${show(val.G)} (${kind === "min" ? "standing on the ground costs nothing" : kind === "count" ? "one way to do nothing" : "you are already there"}). Every arrow u → v is one legal move; its weight is the cost of leaving u.`, 0);
      for (let i = 0; i <= n; i++) {
        const v = String(i), ins = inc(v);
        if (broken.has(i)) {
          val[v] = kind === "min" ? INF : kind === "count" ? 0 : false;
          snap(v, [], `Step ${i} is <b>broken</b>: no move may land on it. Its value is the identity for "${kind === "min" ? "min" : kind === "count" ? "sum" : "or"}" (${show(val[v])}), so it contributes nothing downstream.`, 1);
          continue;
        }
        let best, parts = [];
        if (kind === "min") { best = INF; for (const e of ins) { const c = val[e.u] + e.w; parts.push(`${show(val[e.u])}+${e.w}`); if (c < best) { best = c; par[v] = e.u; } } }
        else if (kind === "count") { best = 0; for (const e of ins) { best += val[e.u]; parts.push(show(val[e.u])); } }
        else { best = false; for (const e of ins) { parts.push(show(val[e.u])); if (val[e.u] && !best) { best = true; par[v] = e.u; } } }
        val[v] = best;
        const nm = kind === "min" ? "min" : kind === "count" ? "sum" : "any";
        snap(v, ins.map((e) => `${e.u}-${e.v}`), `${i === n ? "The <b>top</b>" : `Step ${i}`}: every predecessor (${ins.map((e) => lbl(e.u)).join(", ")}) comes earlier in topological order, so its value is final. val = ${nm}(${parts.join(", ")}) = <b>${show(best)}</b>.`, 2);
      }
      const top = String(n), witness = new Set(), wNodes = new Set();
      if (kind !== "count" && (kind === "min" ? val[top] < INF : val[top])) { let x = top; wNodes.add(x); while (par[x] !== undefined) { witness.add(`${par[x]}-${x}`); x = par[x]; wNodes.add(x); } }
      const ans = val[top];
      snap(null, [], kind === "min"
        ? (ans === INF ? "The top is unreachable: every route crosses a broken step, so the minimum over an empty set is ∞." : `Minimum cost <b>${ans}</b>. Following the arrows that achieved each minimum backwards gives the cheapest route (purple): a <b>shortest path</b> in the DAG.`)
        : kind === "count" ? `There are <b>${ans}</b> distinct routes from the ground to the top. Same DAG, same order; only the operators changed from (min, +) to (sum, ×).`
          : ans ? "The top is <b>reachable</b>; the purple route is one witness. Feasibility DP is the same loop with (or, and)." : "The top is <b>not</b> reachable: two broken steps in a row cut every route.", 3, { witness, wNodes, ans });
      return fr.map((f) => ({ ...f, nodes, edges, broken, kind, n }));
    },
    render: (f) => {
      const reads = new Set(f.reads || []);
      const g = { nodes: f.nodes.map((nd) => ({ ...nd, sub: f.val[nd.id] === undefined ? undefined : (f.kind === "reach" ? (f.val[nd.id] ? "T" : "F") : f.val[nd.id]) })), edges: f.edges.map((e) => ({ ...e })) };
      return Viz.graph(g, {
        directed: true, r: 19,
        label: "states = steps; arrow u → v = one move, weight = cost[u]; number under a node = its value",
        nodeCls: (id) => (f.broken.has(Number(id)) && id !== "G" ? "bad" : id === f.cur ? "active" : f.wNodes && f.wNodes.has(id) ? "path" : reads.size && f.edges.some((e) => e.v === f.cur && e.u === id) ? "visit" : f.val[id] !== undefined ? "done" : ""),
        edgeCls: (k) => (reads.has(k) ? "visit" : f.witness && f.witness.has(k) ? "path" : f.broken.has(Number(k.split("-")[1])) || f.broken.has(Number(k.split("-")[0])) ? "dim" : ""),
      });
    },
  }));

  /* ================= 4. The five-step recipe, problem by problem ================= */
  const RECIPES = {
    "Climbing Stairs": {
      def: "5", parse: (s) => [Viz.parse.int(s, { min: 1, max: 12 })], rnd: () => String(Viz.rand(3, 10)),
      state: "dp[i] = number of distinct ways to reach step i", trans: "dp[i] = dp[i-1] + dp[i-2]   (last move was 1 or 2 steps)",
      base: "dp[0] = 1 (one way: do nothing), dp[1] = 1", order: "i = 2, 3, …, n (each cell reads two cells to its left)", answer: "dp[n]",
      setup: ([n]) => ({ R: 1, C: n + 1, cols: Array.from({ length: n + 1 }, (_, i) => `i=${i}`), base: [[0, 0, 1], [0, 1, 1]].filter((b) => b[1] <= n), cells: Array.from({ length: Math.max(0, n - 1) }, (_, k) => [0, k + 2]), ans: [0, n], example: [0, Math.min(n, 4)] }),
      deps: (r, c) => [[0, c - 1], [0, c - 2]], calc: (T, r, c) => T[0][c - 1] + T[0][c - 2], why: (T, r, c) => `${T[0][c - 1]} + ${T[0][c - 2]}`,
    },
    "Min Cost Climbing Stairs": {
      def: "10,15,20,5,1", parse: (s) => Viz.parse.ints(s, { min: 2, max: 11 }), rnd: () => Viz.randInts(Viz.rand(4, 9), 1, 25).join(","),
      state: "dp[i] = minimum cost to stand on step i (i = n is the top)", trans: "dp[i] = min(dp[i-1] + cost[i-1], dp[i-2] + cost[i-2])",
      base: "dp[0] = dp[1] = 0 (you may start on either for free)", order: "i = 2, 3, …, n", answer: "dp[n]: the top is one past the last step",
      setup: (cost) => ({ R: 1, C: cost.length + 1, cols: Array.from({ length: cost.length + 1 }, (_, i) => `i=${i}`), base: [[0, 0, 0], [0, 1, 0]], cells: Array.from({ length: cost.length - 1 }, (_, k) => [0, k + 2]), ans: [0, cost.length], example: [0, Math.min(cost.length, 4)] }),
      deps: (r, c) => [[0, c - 1], [0, c - 2]], calc: (T, r, c, a) => Math.min(T[0][c - 1] + a[c - 1], T[0][c - 2] + a[c - 2]), why: (T, r, c, a) => `min(${T[0][c - 1]}+${a[c - 1]}, ${T[0][c - 2]}+${a[c - 2]})`,
    },
    "House Robber": {
      def: "2,7,9,3,1", parse: (s) => Viz.parse.ints(s, { min: 1, max: 11 }), rnd: () => Viz.randInts(Viz.rand(4, 9), 1, 20).join(","),
      state: "dp[i] = most money from the first i houses", trans: "dp[i] = max(dp[i-1], dp[i-2] + nums[i-1])   (skip or rob house i-1)",
      base: "dp[0] = 0 (no houses), dp[1] = nums[0]", order: "i = 2, 3, …, n", answer: "dp[n]",
      setup: (a) => ({ R: 1, C: a.length + 1, cols: Array.from({ length: a.length + 1 }, (_, i) => `i=${i}`), base: [[0, 0, 0], [0, 1, a[0]]], cells: Array.from({ length: a.length - 1 }, (_, k) => [0, k + 2]), ans: [0, a.length], example: [0, Math.min(a.length, 4)] }),
      deps: (r, c) => [[0, c - 1], [0, c - 2]], calc: (T, r, c, a) => Math.max(T[0][c - 1], T[0][c - 2] + a[c - 1]), why: (T, r, c, a) => `max(${T[0][c - 1]}, ${T[0][c - 2]}+${a[c - 1]})`,
    },
    "Unique Paths": {
      def: "3x5", parse: (s) => parseSize(s, 5, 6), rnd: () => `${Viz.rand(2, 5)}x${Viz.rand(3, 6)}`,
      state: "dp[r][c] = number of paths from (0,0) to (r,c) moving right/down", trans: "dp[r][c] = dp[r-1][c] + dp[r][c-1]   (arrived from above or from the left)",
      base: "row 0 and column 0 are all 1 (a single straight path)", order: "row by row, left to right", answer: "dp[R-1][C-1]",
      setup: ([R, C]) => { const base = [], cells = []; for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) (r === 0 || c === 0 ? base.push([r, c, 1]) : cells.push([r, c])); return { R, C, cols: Array.from({ length: C }, (_, c) => `c${c}`), rows: Array.from({ length: R }, (_, r) => `r${r}`), base, cells, ans: [R - 1, C - 1], example: [Math.min(1, R - 1), Math.min(2, C - 1)] }; },
      deps: (r, c) => [[r - 1, c], [r, c - 1]], calc: (T, r, c) => T[r - 1][c] + T[r][c - 1], why: (T, r, c) => `${T[r - 1][c]} + ${T[r][c - 1]}`,
    },
  };
  const RNAMES = Object.keys(RECIPES);
  const STEP_NAMES = ["1 · STATE", "2 · TRANSITION", "3 · BASE CASES", "4 · ORDER", "5 · ANSWER"];
  Viz.register("dp-framework-recipe", (el, opts) => Viz.player(el, {
    title: "The five-step recipe, applied visually",
    tag: "DESIGN RECIPE",
    legend: [["active", "cell in focus"], ["visit", "cells it depends on"], ["path", "base case"], ["done", "filled"]],
    inputs: [
      { key: "p", label: "problem", type: "select", value: opts && RECIPES[opts.p] ? opts.p : RNAMES[0], options: RNAMES },
      { key: "x", label: "input (n, array, or RxC)", value: RECIPES[(opts && RECIPES[opts.p]) ? opts.p : RNAMES[0]].def, width: 160 },
    ],
    random: () => { const p = RNAMES[Viz.rand(0, RNAMES.length - 1)]; return { p, x: RECIPES[p].rnd() }; },
    build: ({ p, x }) => {
      const P = RECIPES[p];
      let arg;
      /* switching the problem while the box still holds another problem's example: use this problem's example */
      if (RNAMES.some((q) => q !== p && RECIPES[q].def === String(x).trim())) x = P.def;
      try { arg = P.parse(x); } catch (e) { throw new Error(`${p} expects input like "${P.def}". ${e.message}`); }
      const S = P.setup(arg), a = Array.isArray(arg) && p !== "Unique Paths" && p !== "Climbing Stairs" ? arg : null;
      const T = Array.from({ length: S.R }, () => Array(S.C).fill(null)), fr = [];
      const push = (step, note, extra = {}) => fr.push({ T: Viz.clone(T), step, note, S, a, P, ...extra });
      push(0, `<b>State.</b> Write in words what one cell means: <i>${esc(P.state)}</i>. Each cell is one subproblem; the table holds all of them.`, { focus: S.example });
      const ex = S.example, exDeps = ex[1] >= (S.R > 1 ? 1 : 2) && (S.R === 1 || ex[0] >= 1) ? P.deps(ex[0], ex[1]) : [];
      push(1, `<b>Transition.</b> How does one cell follow from smaller ones? Think about the <i>last decision</i>: <code>${esc(P.trans)}</code>. The arrows show which cells this cell reads.`, { focus: ex, deps: exDeps });
      for (const [r, c, v] of S.base) T[r][c] = v;
      push(2, `<b>Base cases.</b> The cells the transition cannot compute (it would read outside the table): <code>${esc(P.base)}</code>.`, { baseShow: true });
      push(3, `<b>Order.</b> Every arrow points from a cell computed earlier: <i>${esc(P.order)}</i>. The small numbers show the evaluation order.`, { order: true });
      push(4, `<b>Answer.</b> Which cell answers the original question? <code>${esc(P.answer)}</code>. Now run the loop.`, { focus: S.ans, ansShow: true });
      S.cells.forEach(([r, c], k) => {
        T[r][c] = P.calc(T, r, c, a);
        push(5, `Fill cell ${S.R > 1 ? `(${r},${c})` : c} (#${k + 1}): ${esc(P.why(T, r, c, a))} = <b>${T[r][c]}</b>.`, { focus: [r, c], deps: P.deps(r, c) });
      });
      const ans = T[S.ans[0]][S.ans[1]];
      push(6, `Done: the answer cell holds <b>${ans}</b>. Five decisions, written down before any code, produced the whole algorithm.`, { focus: S.ans, ansShow: true, ans });
      return fr;
    },
    render: (f) => {
      const S = f.S, ordIdx = new Map(S.cells.map(([r, c], k) => [`${r},${c}`, k + 1]));
      const isBase = (r, c) => S.base.some((b) => b[0] === r && b[1] === c);
      const deps = f.deps || [];
      const cls = (r, c, v) => {
        if (f.focus && f.focus[0] === r && f.focus[1] === c) return f.step === 6 ? "path" : "active";
        if (deps.some(([a, b]) => a === r && b === c)) return (v === null ? "visit" : "done") + " dep";
        if (isBase(r, c) && v !== null) return "path";
        return v !== null ? "done" : "";
      };
      const arrows = f.focus ? deps.filter(([a, b]) => a >= 0 && b >= 0).map((d) => ({ from: d, to: f.focus, cls: "visit", arc: S.R === 1 ? "up" : undefined })) : [];
      const grid = dgrid(f.T, { cls, arrows, arcUp: S.R === 1 ? 34 : 0, colLabels: S.cols, rowLabels: S.rows, rowLabelW: 30, size: 44, sub: (r, c) => (f.order && ordIdx.has(`${r},${c}`) ? `#${ordIdx.get(`${r},${c}`)}` : ""), fmt: (v, r, c) => (v === null ? (f.step === 0 && f.focus && f.focus[0] === r && f.focus[1] === c ? "?" : "") : String(v)), label: "dp table" });
      const card = `<div class="dpf-recipe">${STEP_NAMES.map((nm, k) => `<div class="dpf-rstep ${f.step === k ? "on" : f.step > k ? "past" : ""}"><b>${nm}</b><span>${esc([f.P.state, f.P.trans, f.P.base, f.P.order, f.P.answer][k])}</span></div>`).join("")}</div>`;
      const inp = f.a ? Viz.array(f.a, { label: f.P === RECIPES["House Robber"] ? "nums (house i-1 is column i)" : "cost[i]" }) : "";
      return `<div class="dpf-col">${card}${inp}${grid}</div>`;
    },
  }));

  /* ================= 5. Space optimisation: keep only what the next cell reads ================= */
  const ROLL = ["1D → two variables", "2D → two rows", "2D → one row, in place"];
  const ROLL_CODE = {
    one: ["a, b = 0, 0            # a = dp[i-2], b = dp[i-1]", "for i in range(2, n + 1):", "    a, b = b, min(b + cost[i-1], a + cost[i-2])", "return b               # O(1) memory instead of O(n)", "", "", "", ""],
    two: ["prev = [INF] * C                 # row -1: unreachable", "for r in range(R):", "    cur = [INF] * C", "    for c in range(C):", "        best = 0 if r == c == 0 else min(prev[c], cur[c-1] if c else INF)", "        cur[c] = grid[r][c] + best", "    prev = cur                   # row r-1 is now garbage", "return prev[C - 1]"],
    row: ["row = [INF] * C", "for r in range(R):", "    for c in range(C):", "        # row[c] still holds row r-1 (up); row[c-1] already holds row r (left)", "        best = 0 if r == c == 0 else min(row[c], row[c-1] if c else INF)", "        row[c] = grid[r][c] + best", "return row[C - 1]", ""],
  };
  Viz.register("dp-framework-rolling", (el) => Viz.player(el, {
    title: "Space optimisation: a cell only needs its dependency footprint",
    tag: "ROLLING ARRAYS",
    legend: [["active", "computing"], ["visit", "still in memory (will be read)"], ["done", "kept, final"], ["dim", "discarded: no future cell reads it"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "mode", type: "select", value: ROLL[0], options: ROLL },
      { key: "cost", label: "cost (1D)", value: "10,15,20,5,10,25,5", width: 160 },
      { key: "grid", label: "grid (2D, rows split by ;)", value: "1,3,1,2; 1,5,1,4; 4,2,1,3", width: 190 },
    ],
    random: () => ({ cost: Viz.randInts(Viz.rand(4, 9), 1, 30).join(","), grid: randGrid(Viz.rand(2, 4), Viz.rand(3, 5), 0, 9) }),
    build: ({ mode, cost: cs, grid: gs }) => {
      const fr = [];
      if (mode === ROLL[0]) {
        setCode(el, ROLL_CODE.one);
        const cost = Viz.parse.ints(cs, { min: 2, max: 11 });
        if (cost.some((x) => x < 0 || x > 999)) throw new Error("Costs must be 0 to 999.");
        const n = cost.length, dp = Array(n + 1).fill(null); dp[0] = 0; dp[1] = 0;
        let a = 0, b = 0;
        fr.push({ kind: "1d", dp: dp.slice(), i: 1, cost, a, b, note: "The full table would hold n + 1 values, but dp[i] reads only dp[i-1] and dp[i-2]. So two variables are enough: a = dp[i-2], b = dp[i-1].", line: 0, vars: { a, b, "memory cells": 2, "full table": n + 1 } });
        for (let i = 2; i <= n; i++) {
          const v = Math.min(b + cost[i - 1], a + cost[i - 2]); dp[i] = v;
          fr.push({ kind: "1d", dp: dp.slice(), i, cost, a, b, cur: true, note: `dp[${i}] = min(b + cost[${i - 1}], a + cost[${i - 2}]) = min(${b}+${cost[i - 1]}, ${a}+${cost[i - 2]}) = <b>${v}</b>. Then slide: a ← b, b ← dp[${i}]. dp[${i - 2}] falls out of the window forever.`, line: 2, vars: { i, a: b, b: v, "memory cells": 2, "full table": n + 1 } });
          a = b; b = v;
        }
        fr.push({ kind: "1d", dp: dp.slice(), i: n + 1, cost, a, b, note: `Answer b = <b>${b}</b> using 2 variables instead of ${n + 1} cells. The tuple assignment matters: compute the new value from the <i>old</i> a and b, then shift both.`, line: 3, vars: { a, b, "memory cells": 2, "full table": n + 1 }, ans: b });
        return fr;
      }
      const g = parseGrid(gs, { maxR: 5, maxC: 6, min: 0, max: 99 });
      const R = g.length, C = g[0].length, inPlace = mode === ROLL[2];
      setCode(el, inPlace ? ROLL_CODE.row : ROLL_CODE.two);
      const full = Array.from({ length: R }, () => Array(C).fill(null));
      let prev = Array(C).fill(INF), cur = Array(C).fill(INF), row = Array(C).fill(INF);
      fr.push({ kind: "2d", g, full: Viz.clone(full), r: -1, c: -1, mem: inPlace ? { row: row.slice() } : { prev: prev.slice(), cur: null }, note: `Minimum path sum. dp[r][c] reads only <b>up</b> and <b>left</b>, so only the previous row and the current row are ever read. The full table needs ${R * C} cells; ${inPlace ? "one row needs" : "two rows need"} ${inPlace ? C : 2 * C}.`, line: 0, vars: { "memory cells": inPlace ? C : 2 * C, "full table": R * C } });
      for (let r = 0; r < R; r++) {
        if (!inPlace) { cur = Array(C).fill(INF); }
        for (let c = 0; c < C; c++) {
          const upV = inPlace ? row[c] : prev[c], leftV = c ? (inPlace ? row[c - 1] : cur[c - 1]) : INF;
          const best = r === 0 && c === 0 ? 0 : Math.min(upV, leftV);
          const v = g[r][c] + best; full[r][c] = v;
          if (inPlace) row[c] = v; else cur[c] = v;
          const why = r === 0 && c === 0 ? `start cell: just grid[0][0] = ${v}` : `grid ${g[r][c]} + min(up ${fmtN(upV)}, left ${fmtN(leftV)}) = <b>${v}</b>`;
          fr.push({ kind: "2d", g, full: Viz.clone(full), r, c, mem: inPlace ? { row: row.slice() } : { prev: prev.slice(), cur: cur.slice() }, note: `(${r},${c}): ${why}.${inPlace ? ` row[${c}] held the value from row ${r - 1} (up) and is now overwritten with row ${r}: nobody will need the old value again.` : ""}`, line: inPlace ? [4, 5] : [4, 5], vars: { r, c, up: fmtN(upV), left: fmtN(leftV), "memory cells": inPlace ? C : 2 * C, "full table": R * C } });
        }
        if (!inPlace) { prev = cur; fr.push({ kind: "2d", g, full: Viz.clone(full), r, c: C, mem: { prev: prev.slice(), cur: null }, note: `Row ${r} is complete. It becomes <code>prev</code>; row ${r - 1 >= 0 ? r - 1 : "-1"} is dropped.`, line: 6, vars: { r, "memory cells": 2 * C, "full table": R * C } }); }
      }
      const ans = full[R - 1][C - 1];
      fr.push({ ...fr[fr.length - 1], r: R, c: C, line: inPlace ? 6 : 7, ans, note: `Answer <b>${ans}</b>. Memory O(C) instead of O(R·C). The catch: once rows are discarded you can no longer <b>reconstruct</b> the path. Keep the full table (or parent pointers) when you need the route, not just its cost.` });
      return fr;
    },
    render: (f) => {
      if (f.kind === "1d") {
        const n = f.dp.length - 1;
        const cls = (r, c, v) => (f.cur && c === f.i ? "active" : f.cur && (c === f.i - 1 || c === f.i - 2) ? "visit dep" : !f.cur && f.i <= n && (c === f.i || c === f.i - 1) ? "visit" : f.i > n && c === n ? "done" : v !== null ? "dim" : "");
        const arrows = f.cur ? [{ from: [0, f.i - 1], to: [0, f.i], cls: "visit", arc: "up", label: "b" }, { from: [0, f.i - 2], to: [0, f.i], cls: "visit", arc: "up", label: "a" }] : [];
        return `<div class="dpf-col">${Viz.array(f.cost, { label: "cost[i]" })}${dgrid([f.dp], { cls, arrows, arcUp: 40, size: 44, colLabels: f.dp.map((_, i) => `i=${i}`), label: "the conceptual dp[] (faded = forgotten)" })}${Viz.array([f.a, f.b], { label: "what is actually stored", idxLabel: (i) => (i ? "b" : "a"), cls: () => "visit" })}</div>`;
      }
      const R = f.g.length, C = f.g[0].length;
      const live = (r, c) => {
        if (f.mem.row) return (r === f.r && c <= f.c) || (r === f.r - 1 && c > f.c);
        if (f.c >= C) return r === f.r;
        return (r === f.r && c <= f.c) || r === f.r - 1;
      };
      const cls = (r, c, v) => {
        if (r === f.r && c === f.c) return "active";
        if (f.r < R && ((r === f.r - 1 && c === f.c) || (r === f.r && c === f.c - 1))) return "visit dep";
        if (v === null) return "";
        if (f.r >= R) return r === R - 1 ? "done" : "dim";
        return live(r, c) ? "visit" : "dim";
      };
      const arrows = f.r >= 0 && f.r < R && f.c < C ? [[f.r - 1, f.c], [f.r, f.c - 1]].filter(([a, b]) => a >= 0 && b >= 0).map((d) => ({ from: d, to: [f.r, f.c], cls: "visit" })) : [];
      const tab = dgrid(f.full, { cls, arrows, size: 46, sub: (r, c) => `g${f.g[r][c]}`, colLabels: f.full[0].map((_, c) => `c${c}`), rowLabels: f.full.map((_, r) => `r${r}`), rowLabelW: 30, label: "conceptual dp[r][c] (g = grid value)" });
      let mem;
      if (f.mem.row) mem = Viz.array(f.mem.row, { label: "row[] in memory", fmt: fmtN, idxLabel: (i) => (f.r < 0 || f.r >= R ? `c${i}` : i < f.c || (i === f.c) ? `c${i}: r${f.r}` : `c${i}: r${f.r - 1}`), cls: (i) => (f.r < 0 || f.r >= R ? "" : i === f.c ? "active" : i < f.c ? "done" : "visit") });
      else mem = `<div class="dpf-col" style="gap:6px">${Viz.array(f.mem.prev, { label: "prev (row r-1)", fmt: fmtN, cls: (i) => (f.r < R && i === f.c && f.mem.cur ? "visit" : "") })}${f.mem.cur ? Viz.array(f.mem.cur, { label: "cur (row r)", fmt: fmtN, cls: (i) => (i === f.c ? "active" : i < f.c ? "done" : "dim") }) : ""}</div>`;
      return Viz.row(tab, Viz.labeled("memory actually used", mem));
    },
  }));

  /* ================= 6. Reconstructing the answer ================= */
  const REC = ["min cost climbing stairs", "minimum path sum (grid)"];
  const REC_CODE = {
    stairs: ["dp, parent = [0, 0] + [0] * (n - 1), [-1] * (n + 1)", "for i in range(2, n + 1):", "    a, b = dp[i-1] + cost[i-1], dp[i-2] + cost[i-2]", "    dp[i], parent[i] = (a, i - 1) if a <= b else (b, i - 2)", "path, i = [], n", "while i > 1:                      # walk the parent pointers back", "    path.append(i); i = parent[i]", "path.append(i); path.reverse()"],
    grid: ["for r in range(R):", "    for c in range(C):", "        up, left = dp[r-1][c] if r else INF, dp[r][c-1] if c else INF", "        dp[r][c] = grid[r][c] + (0 if r == c == 0 else min(up, left))", "r, c = R - 1, C - 1               # start at the answer cell", "while (r, c) != (0, 0):           # which neighbour produced dp[r][c]?", "    if r and dp[r][c] - grid[r][c] == dp[r-1][c]: r -= 1", "    else: c -= 1"],
  };
  Viz.register("dp-framework-reconstruct", (el) => Viz.player(el, {
    title: "From the optimal value to the optimal choices: walk back through the table",
    tag: "RECONSTRUCTION",
    legend: [["active", "current cell"], ["visit", "candidates compared"], ["done", "filled"], ["path", "on the optimal route"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "p", label: "problem", type: "select", value: REC[0], options: REC },
      { key: "cost", label: "cost (stairs)", value: "1,100,1,1,1,100,1,1,100,1", width: 200 },
      { key: "grid", label: "grid", value: "1,3,1,8; 1,5,1,2; 4,2,1,9; 7,1,3,1", width: 190 },
    ],
    random: () => ({ cost: Viz.randInts(Viz.rand(5, 10), 1, 30).join(","), grid: randGrid(Viz.rand(3, 5), Viz.rand(3, 5), 0, 9) }),
    build: ({ p, cost: cs, grid: gs }) => {
      const fr = [];
      if (p === REC[0]) {
        setCode(el, REC_CODE.stairs);
        const cost = Viz.parse.ints(cs, { min: 2, max: 11 });
        if (cost.some((x) => x < 0 || x > 999)) throw new Error("Costs must be 0 to 999.");
        const n = cost.length, dp = Array(n + 1).fill(null), par = Array(n + 1).fill(-1);
        dp[0] = 0; dp[1] = 0;
        const S = (extra) => ({ kind: "s", cost, dp: dp.slice(), par: par.slice(), ...extra });
        fr.push(S({ note: "Fill the table as usual, but also record <b>which choice won</b> in parent[i]. That one extra array is all reconstruction needs.", line: 0, path: [] }));
        for (let i = 2; i <= n; i++) {
          const a = dp[i - 1] + cost[i - 1], b = dp[i - 2] + cost[i - 2];
          if (a <= b) { dp[i] = a; par[i] = i - 1; } else { dp[i] = b; par[i] = i - 2; }
          fr.push(S({ cur: i, cand: [i - 1, i - 2], note: `dp[${i}] = min(from ${i - 1}: ${a}, from ${i - 2}: ${b}) = <b>${dp[i]}</b>, so parent[${i}] = ${par[i]}.`, line: [2, 3], path: [], vars: { i, "from i-1": a, "from i-2": b, "parent[i]": par[i] } }));
        }
        const path = [n];
        fr.push(S({ cur: n, note: `The answer is dp[${n}] = <b>${dp[n]}</b>. Now walk backwards from the top along the parent pointers.`, line: 4, path: path.slice() }));
        let i = n;
        while (i > 1) { const pi = par[i]; path.push(pi); fr.push(S({ cur: pi, note: `parent[${i}] = ${pi}: the best way onto ${i === n ? "the top" : `step ${i}`} came from step ${pi}, paying cost[${pi}] = ${cost[pi]}.`, line: [5, 6], path: path.slice(), vars: { i: pi } })); i = pi; }
        const steps = path.slice(1).reverse();
        fr.push(S({ note: `Optimal route: ${steps.join(" → ")} → top (start free on step ${steps[0]}, pay each step you leave). Paid ${steps.map((s) => cost[s]).join(" + ")} = <b>${dp[n]}</b> ✓. Reconstruction is O(n) extra work.`, line: 7, path: path.slice(), done: true, ans: dp[n], route: steps }));
        return fr;
      }
      setCode(el, REC_CODE.grid);
      const g = parseGrid(gs, { maxR: 5, maxC: 6, min: 0, max: 99 }), R = g.length, C = g[0].length;
      const dp = Array.from({ length: R }, () => Array(C).fill(null));
      const S = (extra) => ({ kind: "g", g, dp: Viz.clone(dp), ...extra });
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const up = r ? dp[r - 1][c] : INF, left = c ? dp[r][c - 1] : INF;
        dp[r][c] = g[r][c] + (r === 0 && c === 0 ? 0 : Math.min(up, left));
        fr.push(S({ cur: [r, c], cand: [[r - 1, c], [r, c - 1]].filter(([a, b]) => a >= 0 && b >= 0), note: r === 0 && c === 0 ? `Start: dp[0][0] = ${g[0][0]}.` : `dp[${r}][${c}] = ${g[r][c]} + min(${fmtN(up)}, ${fmtN(left)}) = <b>${dp[r][c]}</b>.`, line: [2, 3], path: [], vars: { r, c } }));
      }
      let r = R - 1, c = C - 1; const path = [[r, c]];
      fr.push(S({ cur: [r, c], note: `Minimum sum <b>${dp[r][c]}</b>. No parent array this time: the table itself tells us the choice. dp[r][c] − grid[r][c] must equal the neighbour we came from.`, line: 4, path: path.slice() }));
      while (r || c) {
        const need = dp[r][c] - g[r][c];
        const cand = [[r - 1, c], [r, c - 1]].filter(([a, b]) => a >= 0 && b >= 0);
        if (r && dp[r - 1][c] === need) r--; else c--;
        path.push([r, c]);
        fr.push(S({ cur: [r, c], cand, note: `Need ${need} = dp[${path[path.length - 2].join("][")}] − ${g[path[path.length - 2][0]][path[path.length - 2][1]]}. The ${path[path.length - 2][0] !== r ? "upper" : "left"} neighbour holds ${dp[r][c]}, so we came from (${r},${c}).`, line: [5, 6, 7], path: path.slice(), vars: { r, c, need } }));
      }
      const ans = dp[R - 1][C - 1];
      fr.push(S({ note: `Route found: ${path.slice().reverse().map(([a, b]) => g[a][b]).join(" + ")} = <b>${ans}</b> ✓. Re-deriving the choice from the table costs O(R + C) and no extra memory, but it needs the <b>full</b> table: a rolling-row version cannot do this.`, line: 7, path: path.slice(), done: true, ans }));
      return fr;
    },
    render: (f) => {
      if (f.kind === "s") {
        const n = f.dp.length - 1, onPath = new Set(f.path);
        const cls = (r, c, v) => (c === f.cur && !f.done ? "active" : onPath.has(c) ? "path" : f.cand && f.cand.includes(c) ? "visit dep" : v !== null ? "done" : "");
        const arrows = [];
        if (f.cand && f.cur !== undefined) f.cand.forEach((k) => arrows.push({ from: [0, k], to: [0, f.cur], cls: k === f.par[f.cur] ? "done" : "dim", arc: "up" }));
        for (let k = 1; k < f.path.length; k++) arrows.push({ from: [0, f.path[k]], to: [0, f.path[k - 1]], cls: "path", arc: "down" });
        const g = dgrid([f.dp], { cls, arrows, arcUp: 34, arcDown: 40, size: 44, colLabels: f.dp.map((_, i) => (i === n ? "top" : `i=${i}`)), tag: (r, c) => (f.par[c] >= 0 ? `←${f.par[c]}` : ""), label: "dp[i] (corner = parent pointer)" });
        return `<div class="dpf-col">${Viz.array(f.cost, { label: "cost[i]", cls: (i) => (f.path.includes(i) && i < n ? "path" : "") })}${g}</div>`;
      }
      const onPath = new Set(f.path.map(([a, b]) => `${a},${b}`));
      const cls = (r, c, v) => (f.cur && f.cur[0] === r && f.cur[1] === c && !f.done ? "active" : onPath.has(`${r},${c}`) ? "path" : f.cand && f.cand.some(([a, b]) => a === r && b === c) ? "visit dep" : v !== null ? "done" : "");
      const arrows = [];
      for (let k = 1; k < f.path.length; k++) arrows.push({ from: f.path[k], to: f.path[k - 1], cls: "path" });
      if (!f.path.length && f.cur && f.cand) f.cand.forEach((d) => arrows.push({ from: d, to: f.cur, cls: "visit" }));
      return dgrid(f.dp, { cls, arrows, size: 48, sub: (r, c) => `g${f.g[r][c]}`, colLabels: f.dp[0].map((_, c) => `c${c}`), rowLabels: f.dp.map((_, r) => `r${r}`), rowLabelW: 30, label: "dp[r][c] = cheapest sum to reach (r,c); g = grid value" });
    },
  }));

  /* ================= 7. Evaluation order: any topological order works, others read garbage ================= */
  const ORDERS = ["row by row, left → right ✓", "column by column ✓", "anti-diagonals ✓", "row by row, right → left ✗", "last row first ✗"];
  Viz.register("dp-framework-order", (el) => Viz.player(el, {
    title: "Evaluation order: every cell must come after the cells it reads",
    tag: "ITERATION ORDER",
    legend: [["active", "computing"], ["done", "read a final value"], ["bad", "read a cell not computed yet (still 0)"], ["path", "matches the correct table"]],
    codeLang: "python",
    code: ["dp = [[0] * C for _ in range(R)]; dp[0][0] = 1", "for (r, c) in ORDER:", "    if (r, c) == (0, 0): continue", "    up   = dp[r - 1][c] if r else 0", "    left = dp[r][c - 1] if c else 0", "    dp[r][c] = up + left          # number of paths"],
    inputs: [
      { key: "o", label: "order", type: "select", value: ORDERS[0], options: ORDERS },
      { key: "size", label: "rows x cols", value: "3x4", width: 70 },
    ],
    random: () => ({ o: ORDERS[Viz.rand(0, ORDERS.length - 1)], size: `${Viz.rand(2, 4)}x${Viz.rand(3, 5)}` }),
    build: ({ o, size }) => {
      const [R, C] = parseSize(size, 4, 5);
      const seq = [];
      const k = ORDERS.indexOf(o);
      if (k === 0) for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) seq.push([r, c]);
      if (k === 1) for (let c = 0; c < C; c++) for (let r = 0; r < R; r++) seq.push([r, c]);
      if (k === 2) for (let d = 0; d < R + C - 1; d++) for (let r = 0; r < R; r++) { const c = d - r; if (c >= 0 && c < C) seq.push([r, c]); }
      if (k === 3) for (let r = 0; r < R; r++) for (let c = C - 1; c >= 0; c--) seq.push([r, c]);
      if (k === 4) for (let r = R - 1; r >= 0; r--) for (let c = 0; c < C; c++) seq.push([r, c]);
      const right = Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => { let x = 1; for (let i = 1; i <= Math.min(r, c); i++) x = (x * (r + c - i + 1)) / i; return Math.round(x); }));
      const dp = Array.from({ length: R }, () => Array(C).fill(0)); dp[0][0] = 1;
      const done = new Set(["0,0"]), ord = Array.from({ length: R }, () => Array(C).fill(null)), badCells = new Set(), fr = [];
      let n = 0, garbage = 0;
      fr.push({ dp: Viz.clone(dp), ord: Viz.clone(ord), done: new Set(done), badCells: new Set(badCells), note: `dp[r][c] reads <b>up</b> and <b>left</b>. Order: ${esc(o)}. The table starts as zeros, so reading a cell too early silently returns 0: no crash, just a wrong answer.`, line: 0, vars: { "garbage reads": 0 } });
      for (const [r, c] of seq) {
        if (r === 0 && c === 0) continue;
        const deps = [[r - 1, c], [r, c - 1]].filter(([a, b]) => a >= 0 && b >= 0);
        const bad = deps.filter(([a, b]) => !done.has(`${a},${b}`));
        dp[r][c] = (r ? dp[r - 1][c] : 0) + (c ? dp[r][c - 1] : 0); done.add(`${r},${c}`); ord[r][c] = ++n;
        if (bad.length) { garbage += bad.length; badCells.add(`${r},${c}`); }
        fr.push({ dp: Viz.clone(dp), ord: Viz.clone(ord), done: new Set(done), badCells: new Set(badCells), cur: [r, c], deps, bad, line: [3, 4, 5], vars: { r, c, "garbage reads": garbage },
          note: bad.length ? `(${r},${c}) reads ${bad.map(([a, b]) => `(${a},${b})`).join(" and ")} <b>before it is computed</b> (still 0). dp[${r}][${c}] = ${dp[r][c]}, but the true value is ${right[r][c]}.` : `(${r},${c}): both inputs are already final. dp = ${dp[r][c]}${dp[r][c] !== right[r][c] ? ` (wrong, because an input was wrong: ${right[r][c]} expected)` : ""}.` });
      }
      const wrong = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (dp[r][c] !== right[r][c]) wrong.push(`${r},${c}`);
      fr.push({ dp: Viz.clone(dp), ord: Viz.clone(ord), done, badCells, final: true, wrong: new Set(wrong), right, line: 5, ans: dp[R - 1][C - 1], vars: { "garbage reads": garbage, answer: dp[R - 1][C - 1], correct: right[R - 1][C - 1] },
        note: wrong.length ? `<b>Wrong:</b> ${wrong.length} cells differ from the true table, and the answer is ${dp[R - 1][C - 1]} instead of ${right[R - 1][C - 1]}. This order is not a topological order of the dependency DAG.` : `<b>Correct</b> (${dp[R - 1][C - 1]} paths). This order is a topological order of the dependency DAG: every arrow points from an earlier cell to a later one. Row-major, column-major and diagonals all qualify here.` });
      return fr;
    },
    render: (f) => {
      const cls = (r, c) => {
        if (f.final) return f.wrong.has(`${r},${c}`) ? "bad" : "path";
        if (f.cur && f.cur[0] === r && f.cur[1] === c) return f.bad.length ? "bad" : "active";
        if (f.cur && f.deps.some(([a, b]) => a === r && b === c)) return (f.done.has(`${r},${c}`) && !f.bad.some(([a, b]) => a === r && b === c) ? "done" : "bad") + " dep";
        if (f.done.has(`${r},${c}`)) return f.badCells.has(`${r},${c}`) ? "bad" : "done";
        return "";
      };
      const arrows = f.cur ? f.deps.map((d) => ({ from: d, to: f.cur, cls: f.bad.some(([a, b]) => a === d[0] && b === d[1]) ? "bad" : "done" })) : [];
      const sub = (r, c) => (f.ord[r][c] ? `#${f.ord[r][c]}` : r === 0 && c === 0 ? "base" : "");
      const left = dgrid(f.dp, { cls, arrows, sub, size: 48, colLabels: f.dp[0].map((_, c) => `c${c}`), rowLabels: f.dp.map((_, r) => `r${r}`), rowLabelW: 30, label: "dp table (#k = evaluation order)" });
      return f.final ? Viz.row(left, dgrid(f.right, { cls: () => "done", size: 48, colLabels: f.dp[0].map((_, c) => `c${c}`), label: "correct table" })) : left;
    },
  }));

  /* ================= 8. Greedy vs DP on coin change ================= */
  Viz.register("dp-framework-greedy", (el) => Viz.player(el, {
    title: "Greedy commits to the locally best choice; DP keeps every option open",
    tag: "GREEDY vs DP",
    legend: [["active", "current amount"], ["visit", "amounts it reads (a − coin)"], ["done", "solved"], ["bad", "greedy dead end / worse"], ["path", "optimal choice chain"]],
    codeLang: "python",
    code: ["# greedy: always take the biggest coin that fits", "while rest: rest -= max(c for c in coins if c <= rest)", "# DP: dp[a] = fewest coins that make amount a", "dp = [0] + [INF] * amount", "for a in range(1, amount + 1):", "    dp[a] = 1 + min(dp[a - c] for c in coins if c <= a)", "# walk back: which coin achieved the min?"],
    inputs: [
      { key: "coins", label: "coins", value: "1,3,4", width: 110 },
      { key: "amount", label: "amount (≤ 18)", value: "6", width: 70 },
    ],
    random: () => { const pool = [[1, 3, 4], [1, 5, 6, 9], [2, 5], [1, 7, 10], [3, 7], [1, 2, 5], [4, 5, 7]]; return { coins: pool[Viz.rand(0, pool.length - 1)].join(","), amount: String(Viz.rand(6, 18)) }; },
    build: ({ coins: cs, amount: am }) => {
      const coins = [...new Set(Viz.parse.ints(cs, { min: 1, max: 5 }))].sort((x, y) => x - y);
      if (coins.some((c) => !Number.isInteger(c) || c < 1 || c > 18)) throw new Error("Coins must be whole numbers from 1 to 18.");
      const A = Viz.parse.int(am, { min: 1, max: 18 });
      const fr = [], dp = Array(A + 1).fill(null); dp[0] = 0;
      const gPicks = []; let rest = A;
      const S = (extra) => ({ dp: dp.slice(), coins, A, gPicks: gPicks.slice(), rest, ...extra });
      fr.push(S({ phase: "g", note: `Make ${A} with the fewest coins from {${coins.join(", ")}}. First, the greedy rule: take the biggest coin that fits, never look back.`, line: [0, 1] }));
      while (rest > 0) {
        const c = Math.max(...coins.filter((x) => x <= rest).concat([-1]));
        if (c < 0) { fr.push(S({ phase: "g", stuck: true, note: `Greedy is <b>stuck</b> with ${rest} left: no coin fits, and it cannot undo earlier picks.`, line: 1, vars: { rest } })); break; }
        rest -= c; gPicks.push(c);
        fr.push(S({ phase: "g", note: `Greedy takes ${c} (largest ≤ ${rest + c}). Left: ${rest}.`, line: 1, vars: { rest, picked: gPicks.join("+") } }));
      }
      const greedyRes = rest === 0 ? gPicks.length : null;
      for (let a = 1; a <= A; a++) {
        let best = INF, from = null; const reads = [];
        for (const c of coins) if (c <= a) { reads.push(a - c); if (dp[a - c] !== INF && dp[a - c] + 1 < best) { best = dp[a - c] + 1; from = c; } }
        dp[a] = best;
        fr.push(S({ phase: "d", cur: a, reads, note: `dp[${a}] = 1 + min(${reads.map((r) => `dp[${r}]=${fmtN(dp[r])}`).join(", ") || "nothing"}) = <b>${fmtN(best)}</b>${from ? ` (last coin ${from})` : ": unreachable"}. DP tries <i>every</i> last coin, not just the biggest.`, line: [4, 5], vars: { a, "dp[a]": fmtN(best) } }));
      }
      const opt = [], chain = [];
      if (dp[A] !== INF) { let a = A; chain.push(a); while (a > 0) { const c = coins.find((x) => x <= a && dp[a - x] === dp[a] - 1); opt.push(c); a -= c; chain.push(a); } }
      const ans = dp[A] === INF ? -1 : dp[A];
      const verdict = ans === -1 ? `No combination makes ${A}; DP proves it (dp = ∞).` : greedyRes === null ? `Greedy got stuck, but DP finds ${opt.join(" + ")} = ${A} with <b>${ans}</b> coins.` : greedyRes > ans ? `Greedy used ${greedyRes} coins (${gPicks.join(" + ")}); DP needs only <b>${ans}</b> (${opt.join(" + ")}). The biggest coin first was a trap.` : `Here greedy happens to be optimal (${ans} coins). Try coins 1,3,4 with amount 6, or 2,5 with amount 6.`;
      fr.push(S({ phase: "d", chain, opt, final: true, note: `${verdict} Greedy is safe only when an exchange argument proves the local choice is always part of some optimum; otherwise use DP.`, line: 6, ans, vars: { greedy: greedyRes === null ? "stuck" : greedyRes, dp: ans } }));
      return fr;
    },
    render: (f) => {
      const chain = new Set(f.chain || []);
      const cls = (r, c, v) => (f.final && chain.has(c) ? "path" : c === f.cur ? "active" : f.reads && f.reads.includes(c) ? "done dep" : v !== null ? "done" : "");
      const arrows = f.cur !== undefined && f.reads ? f.reads.map((r) => ({ from: [0, r], to: [0, f.cur], cls: "visit", arc: "up", label: `+${f.cur - r}` })) : [];
      if (f.final && f.chain) for (let k = 1; k < f.chain.length; k++) arrows.push({ from: [0, f.chain[k]], to: [0, f.chain[k - 1]], cls: "path", arc: "down", label: `${f.chain[k - 1] - f.chain[k]}` });
      const greedy = Viz.array(f.gPicks.length ? f.gPicks : ["—"], { label: `greedy picks${f.stuck ? " (stuck)" : ""}`, showIdx: false, cls: () => (f.stuck || (f.final && f.ans !== -1 && f.gPicks.length > f.ans) ? "bad" : f.phase === "g" ? "active" : "done") });
      const tab = f.phase === "d" ? dgrid([f.dp], { cls, arrows, arcUp: 96, arcDown: f.final ? 70 : 0, size: 40, gap: 6, colLabels: f.dp.map((_, i) => `${i}`), label: "dp[a] = fewest coins for amount a", fmt: (v) => fmtN(v) }) : "";
      return `<div class="dpf-col">${greedy}${tab}</div>`;
    },
  }));
})();
