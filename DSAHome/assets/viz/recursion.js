/* Visualizers for Recursion. All names are prefixed "recursion-". Every frame is produced by running the real algorithm. */
(() => {
  const esc = Viz.esc;
  const hlPy = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The code panel is static in the engine; rewrite its lines in place when the program changes (placeholders keep the line count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hlPy(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const short = (v) => { const s = String(v); return s.length > 12 ? s.slice(0, 5) + "…" + s.slice(-4) : s; };

  /* ================= 1. Call stack: frames push and pop ================= */
  const PROGRAMS = {
    "factorial(n)": {
      max: 10, def: 4,
      code: ["def fact(n):", "    if n <= 1:", "        return 1          # base case", "    return n * fact(n - 1)  # trust the smaller call"],
      run(n, S) {
        const go = (k) => {
          const f = S.push(`fact(${k})`, `n = ${k}`);
          S.snap(`Call <b>fact(${k})</b>: a new frame with its own n = ${k} is pushed on top of the stack.`, 0);
          if (k <= 1) { f.pend = "base case"; f.ret = 1; S.snap(`n = ${k} ≤ 1: the <b>base case</b> answers directly without another call. Return 1.`, [1, 2]); S.pop(); return 1; }
          f.pend = `${k} * fact(${k - 1})`; S.snap(`fact(${k}) cannot finish yet: it needs fact(${k - 1}). It pauses with <b>${k} * ?</b> pending and calls down.`, 3);
          const r = go(k - 1);
          f.pend = `${k} * ${r}`; f.ret = k * r; S.snap(`fact(${k - 1}) returned ${r} into the waiting frame: ${k} * ${r} = <b>${k * r}</b>. Return it and pop.`, 3); S.pop(); return k * r;
        };
        return go(n);
      },
      sum: (r, calls, depth) => `Result <b>${r}</b>. ${calls} call${calls === 1 ? "" : "s"}, maximum depth ${depth}: each frame waited for exactly one smaller call, so time and stack space are both O(n).`,
    },
    "factorial, tail call (acc)": {
      max: 10, def: 4,
      code: ["def fact(n, acc=1):", "    if n <= 1:", "        return acc", "    return fact(n - 1, acc * n)  # nothing left to do after"],
      run(n, S) {
        const go = (k, acc) => {
          const f = S.push(`fact(${k}, ${acc})`, `n = ${k}, acc = ${acc}`);
          S.snap(`Call <b>fact(${k}, acc=${acc})</b>. The answer so far travels <i>down</i> in acc.`, 0);
          if (k <= 1) { f.pend = "base case"; f.ret = acc; S.snap(`Base case: the answer is already in acc. Return <b>${acc}</b>.`, [1, 2]); S.pop(); return acc; }
          f.pend = `return fact(${k - 1}, ${acc * k})`; S.snap(`Tail call: multiply first (acc = ${acc} * ${k} = ${acc * k}), then call. This frame has <b>no pending work</b>; it will only pass the result through.`, 3);
          const r = go(k - 1, acc * k);
          f.pend = `pass ${r} through`; f.ret = r; S.snap(`fact(${k - 1}, ${acc * k}) returned ${r}; this frame just hands it back unchanged. A language with tail-call elimination would have reused one frame.`, 3); S.pop(); return r;
        };
        return go(n, 1);
      },
      sum: (r, calls, depth) => `Result <b>${r}</b>, still ${depth} frames deep: Python and C# do <b>not</b> eliminate tail calls, so a tail-recursive function uses O(n) stack. Rewrite it as a loop: while n > 1: acc *= n; n -= 1.`,
    },
    "fib(n)": {
      max: 6, def: 4,
      code: ["def fib(n):", "    if n < 2:", "        return n", "    return fib(n - 1) + fib(n - 2)"],
      run(n, S) {
        const go = (k) => {
          const f = S.push(`fib(${k})`, `n = ${k}`);
          S.snap(`Call <b>fib(${k})</b>: push a frame.`, 0);
          if (k < 2) { f.pend = "base case"; f.ret = k; S.snap(`Base case: fib(${k}) = ${k}. Return and pop.`, [1, 2]); S.pop(); return k; }
          f.pend = `fib(${k - 1}) + fib(${k - 2})`; S.snap(`fib(${k}) needs two answers. It waits on the <b>first</b> call, fib(${k - 1}); the second has not started yet.`, 3);
          const a = go(k - 1);
          f.pend = `${a} + fib(${k - 2})`; S.snap(`fib(${k - 1}) returned ${a}. The frame resumes and makes its <b>second</b> call, fib(${k - 2}).`, 3);
          const b = go(k - 2);
          f.pend = `${a} + ${b}`; f.ret = a + b; S.snap(`Both answers are in: ${a} + ${b} = <b>${a + b}</b>. Return and pop.`, 3); S.pop(); return a + b;
        };
        return go(n);
      },
      sum: (r, calls, depth) => `Result <b>${r}</b> after <b>${calls} calls</b>, yet the stack never held more than ${depth} frames. Calls grow like 1.6ⁿ (time); the depth grows like n (space). See the recursion tree below for why.`,
    },
    "power(2, n) by halving": {
      max: 40, def: 13,
      code: ["def power(x, n):", "    if n == 0:", "        return 1", "    half = power(x, n // 2)", "    return half * half * (x if n % 2 else 1)"],
      run(n, S) {
        const go = (k) => {
          const f = S.push(`power(2, ${k})`, `n = ${k}`);
          S.snap(`Call <b>power(2, ${k})</b>.`, 0);
          if (k === 0) { f.pend = "base case"; f.ret = 1; S.snap(`n = 0: anything to the power 0 is 1.`, [1, 2]); S.pop(); return 1; }
          f.pend = `half = power(2, ${k >> 1})`; S.snap(`Halve the exponent: ${k} // 2 = ${k >> 1}. One call, on half the problem.`, 3);
          const h = go(k >> 1);
          const r = h * h * (k % 2 ? 2 : 1);
          f.pend = `${short(h)}·${short(h)}${k % 2 ? "·2" : ""}`; f.ret = r; S.snap(`half = ${short(h)}. ${k % 2 ? `${k} is odd, so multiply by one extra 2: ` : ""}${short(h)} · ${short(h)}${k % 2 ? " · 2" : ""} = <b>${short(r)}</b>.`, 4); S.pop(); return r;
        };
        return go(n);
      },
      sum: (r, calls, depth) => `2ⁿ = <b>${r.toLocaleString("en-US")}</b> with only ${calls} calls: one per binary digit of n. T(n) = T(n/2) + O(1) = O(log n).`,
    },
  };
  const RC_PROGS = Object.keys(PROGRAMS);
  Viz.register("recursion-stack", (el, opts) => {
    const first = opts && PROGRAMS[opts.fn] ? opts.fn : RC_PROGS[0];
    return Viz.player(el, {
      title: "The call stack: watch frames push, wait and pop",
      tag: "CALL STACK",
      legend: [["active", "running frame (top)"], ["visit", "paused, waiting for a call"], ["done", "returning a value"]],
      codeLang: "python",
      code: ["", "", "", "", ""],
      inputs: [
        { key: "fn", label: "program", type: "select", value: first, options: RC_PROGS },
        { key: "n", label: "n", value: String(PROGRAMS[first].def), width: 70 },
      ],
      random: () => { const fn = RC_PROGS[Math.floor(Math.random() * RC_PROGS.length)]; const P = PROGRAMS[fn]; return { fn, n: String(Math.max(1, Math.floor(Math.random() * Math.min(P.max, 8)) + 1)) }; },
      build: ({ fn, n: ns }) => {
        const P = PROGRAMS[fn]; setCode(el, P.code);
        const n = Viz.parse.int(ns, { min: 0, max: P.max });
        const stack = [], log = [], fr = []; let calls = 0, maxD = 0;
        const S = {
          push(lab, loc) { const f = { lab, loc, pend: "", ret: undefined }; stack.push(f); calls++; maxD = Math.max(maxD, stack.length); return f; },
          pop() { const f = stack.pop(); log.push(`${f.lab} → ${short(f.ret)}`); },
          snap(note, line) {
            const top = stack[stack.length - 1];
            fr.push({ frames: stack.map((f) => ({ ...f })), log: log.slice(), note, line, vars: { depth: stack.length, "max depth": maxD, calls, ...(top && top.ret !== undefined ? { returns: short(top.ret) } : {}) } });
          },
        };
        const r = P.run(n, S);
        fr.push({ frames: [], log: log.slice(), note: P.sum(r, calls, maxD), line: 0, vars: { depth: 0, "max depth": maxD, calls, result: short(r) } });
        return fr;
      },
      render: (f) => {
        const k = f.frames.length;
        const cards = f.frames.map((fm, i) => {
          const top = i === k - 1, cls = top ? (fm.ret !== undefined ? "done" : "active") : "visit";
          return `<div class="rc-frame ${cls}"><div class="rc-fhead"><b>${esc(fm.lab)}</b><span>${esc(fm.loc)}</span></div><div class="rc-fpend">${fm.ret !== undefined && top ? `returns <b>${esc(short(fm.ret))}</b>${fm.pend && fm.pend !== "base case" ? ` <span class="rc-dim">(${esc(fm.pend)})</span>` : " <span class=\"rc-dim\">(base case)</span>"}` : fm.pend ? (top ? esc(fm.pend) : `waiting: ${esc(fm.pend)}`) : "running…"}</div></div>`;
        });
        const shown = k > 9 ? [`<div class="rc-more">… ${k - 8} older frames below …</div>`, ...cards.slice(-8)] : cards;
        const stackHtml = `<div class="v-labeled"><span class="v-caption">call stack (top = running)</span><div class="rc-stack">${shown.reverse().join("") || '<div class="rc-more">empty: every call has returned</div>'}<div class="rc-floor">main program</div></div></div>`;
        const logs = f.log.slice(-9);
        const logHtml = `<div class="v-labeled"><span class="v-caption">returned so far (newest last)</span><div class="rc-log">${logs.map((l, i) => `<div class="${i === logs.length - 1 ? "rc-new" : ""}">${esc(l)}</div>`).join("") || '<div class="rc-dim">nothing yet</div>'}${f.log.length > 9 ? `<div class="rc-dim">${f.log.length - 9} earlier</div>` : ""}</div></div>`;
        return Viz.row(stackHtml, logHtml);
      },
    });
  });

  /* ================= 2. Recursion tree for fib: repeated work → memoization ================= */
  const MODES = ["plain recursion", "with memo (cache)"];
  Viz.register("recursion-tree", (el, opts) => Viz.player(el, {
    title: "Recursion tree of fib(n): spot the repeated subproblems",
    tag: "RECURSION TREE",
    legend: [["active", "current call"], ["visit", "waiting ancestors"], ["done", "computed"], ["bad", "repeat: already computed before"], ["path", "memo hit: answered from cache"]],
    codeLang: "python",
    code: ["", "", "", "", "", ""],
    inputs: [
      { key: "mode", label: "mode", type: "select", value: (opts && MODES.includes(opts.mode)) ? opts.mode : MODES[0], options: MODES },
      { key: "n", label: "n (2 to 7)", value: String((opts && opts.n) || 5), width: 70 },
    ],
    build: ({ mode, n: ns }) => {
      const memo = mode !== MODES[0];
      setCode(el, memo
        ? ["memo = {}                          # one cache, shared", "def fib(n):", "    if n < 2: return n", "    if n in memo: return memo[n]   # cache hit", "    memo[n] = fib(n - 1) + fib(n - 2)", "    return memo[n]"]
        : ["def fib(n):", "    if n < 2:", "        return n", "    return fib(n - 1) + fib(n - 2)", "", ""]);
      const n = Viz.parse.int(ns, { min: 2, max: 7 });
      const nodes = [], kids = new Map(), cache = new Map(), seen = new Set(), fr = [];
      const st = new Map(), val = new Map(), path = [];
      let calls = 0, repeats = 0, hits = 0;
      const count = Array(n + 1).fill(0);
      const snap = (note, line) => fr.push({ st: new Map(st), val: new Map(val), path: path.slice(), count: count.slice(), memoArr: Array.from({ length: n + 1 }, (_, i) => (cache.has(i) ? cache.get(i) : i < 2 && memo ? i : null)), note, line: memo ? (Array.isArray(line) ? line.map((x) => x + 1) : line + 1) : line, vars: { calls, ...(memo ? { "memo hits": hits } : { "repeated calls": repeats }) } });
      const go = (k, parent) => {
        const id = nodes.length; nodes.push(k); kids.set(id, []); if (parent !== null) kids.get(parent).push(id);
        calls++; count[k]++; path.push(id); st.set(id, "active"); path.slice(0, -1).forEach((p) => st.set(p, "visit"));
        const again = seen.has(k) && k >= 2;
        if (memo && k >= 2 && cache.has(k)) {
          hits++; val.set(id, cache.get(k)); st.set(id, "path");
          snap(`fib(${k}) was computed before: <b>memo hit</b>, return ${cache.get(k)} at once. The whole subtree below it is never built.`, 2);
          path.pop(); return cache.get(k);
        }
        snap(again && !memo ? `Call fib(${k}) <b>again</b>. Its answer was already computed elsewhere in the tree, but plain recursion has no memory: the whole subtree is rebuilt.` : `Call fib(${k}).`, 0);
        let r;
        if (k < 2) { r = k; }
        else { r = go(k - 1, id); st.set(id, "active"); r += go(k - 2, id); st.set(id, "active"); }
        if (again && !memo) repeats++;
        seen.add(k); if (memo && k >= 2) cache.set(k, r);
        val.set(id, r); st.set(id, again && !memo ? "bad" : "done");
        snap(k < 2 ? `Base case fib(${k}) = ${k}.` : `fib(${k}) = fib(${k - 1}) + fib(${k - 2}) = <b>${r}</b>${memo ? `; store it: memo[${k}] = ${r}` : again ? " (wasted work: computed before)" : ""}.`, k < 2 ? 1 : memo ? [3, 4] : 3);
        path.pop(); return r;
      };
      const ans = go(n, null);
      const plainCalls = (() => { const F = [0, 1]; for (let i = 2; i <= n + 1; i++) F.push(F[i - 1] + F[i - 2]); return 2 * F[n + 1] - 1; })();
      fr.push({ ...fr[fr.length - 1], path: [], note: memo
        ? `fib(${n}) = <b>${ans}</b> with ${calls} calls instead of ${plainCalls}. Each value is computed once, so the tree collapses to a path with stubs: <b>O(n)</b> time. This is top-down dynamic programming.`
        : `fib(${n}) = <b>${ans}</b> with <b>${calls} calls</b>, ${repeats} of them repeats. The tree has about 1.6ⁿ nodes but only ${n + 1} distinct arguments. Repeated subproblems are the signal for <b>memoization</b>: switch the mode above.`, line: memo ? 5 : 3 });
      const lay = Viz.layoutTree(0, (id) => kids.get(id), (id) => String(nodes[id]), { dx: 36, dy: 58 });
      return fr.map((f) => ({ ...f, lay, memo }));
    },
    render: (f) => {
      /* the full tree is laid out once; nodes not called yet are drawn invisible so nothing jumps */
      const t = { nodes: f.lay.nodes.map((nd) => ({ ...nd, sub: f.val.has(nd.id) ? f.val.get(nd.id) : undefined })), edges: f.lay.edges };
      const pathSet = new Set(f.path);
      const g = Viz.graph(t, { r: 15, label: "node = argument n, number underneath = the value it returned", nodeCls: (id) => f.st.get(Number(id)) || "rc-hide", edgeCls: (key) => { const [u, v] = key.split("-").map(Number); return !f.st.has(v) ? "rc-hide" : pathSet.has(u) && pathSet.has(v) ? "active" : ""; } });
      const side = f.memo
        ? Viz.array(f.memoArr, { label: "memo table (index = n)", cls: (i, v) => (v !== null ? "done" : "dim"), fmt: (v) => (v === null ? "·" : v) })
        : Viz.array(f.count, { label: "times fib(k) was called (index = k)", cls: (i, v) => (v > 1 ? "bad" : v === 1 ? "done" : "dim") });
      return `<div class="rc-col">${g}${side}</div>`;
    },
  }));

  /* ================= 3. Merge sort: the split tree and the merge tree ================= */
  Viz.register("recursion-mergesort", (el) => Viz.player(el, {
    title: "Divide and conquer: merge sort splits down, then merges up",
    tag: "MERGE SORT",
    legend: [["active", "current call"], ["visit", "split, waiting for its halves"], ["done", "sorted (merged)"]],
    codeLang: "python",
    code: [
      "def sort(a):",
      "    if len(a) <= 1: return a       # base case",
      "    mid = len(a) // 2",
      "    left, right = sort(a[:mid]), sort(a[mid:])",
      "    return merge(left, right)      # O(n) work",
    ],
    inputs: [{ key: "a", label: "array (2 to 10 numbers)", value: "38,27,43,3,9,82,10", width: 230 }],
    random: () => ({ a: Array.from({ length: 5 + Math.floor(Math.random() * 5) }, () => Math.floor(Math.random() * 90) + 1).join(",") }),
    build: ({ a: s }) => {
      const a = Viz.parse.ints(s, { min: 2, max: 10 });
      if (a.some((x) => Math.abs(x) > 999)) throw new Error("Keep numbers between -999 and 999.");
      const n = a.length, D = Math.ceil(Math.log2(n));
      const nodes = [], st = new Map(), fr = [];
      let comps = 0, inv = 0;
      const snap = (note, line, cur) => fr.push({ st: new Map(st), cur, note, line, vars: { comparisons: comps, inversions: inv } });
      const go = (lo, hi, d) => {
        const id = nodes.length;
        nodes.push({ id, lo, hi, d, vals: a.slice(lo, hi + 1), kind: lo === hi ? "leaf" : "split" });
        st.set(id, "active");
        if (lo === hi) {
          snap(`[${a[lo]}] has one item: already sorted. <b>Base case</b>, no work.`, 1, id);
          st.set(id, "done"); return { id, vals: [a[lo]] };
        }
        const mid = (lo + hi) >> 1;
        snap(`Split [${a.slice(lo, hi + 1).join(", ")}] at the middle into [${a.slice(lo, mid + 1).join(", ")}] and [${a.slice(mid + 1, hi + 1).join(", ")}]. Trust each recursive call to return its half sorted.`, [2, 3], id);
        st.set(id, "visit");
        const L = go(lo, mid, d + 1), R = go(mid + 1, hi, d + 1);
        const out = []; let i = 0, j = 0, here = 0;
        while (i < L.vals.length && j < R.vals.length) {
          comps++;
          if (L.vals[i] <= R.vals[j]) out.push(L.vals[i++]);
          else { here += L.vals.length - i; out.push(R.vals[j++]); }
        }
        while (i < L.vals.length) out.push(L.vals[i++]);
        while (j < R.vals.length) out.push(R.vals[j++]);
        inv += here;
        const mid2 = nodes.length;
        nodes.push({ id: mid2, lo, hi, d, vals: out, kind: "merge", from: [L.id, R.id] });
        st.set(mid2, "active"); st.set(id, "");
        snap(`Merge [${L.vals.join(", ")}] + [${R.vals.join(", ")}] → <b>[${out.join(", ")}]</b>: walk both halves, always taking the smaller front item. ${here ? `${here} inversion${here > 1 ? "s" : ""} crossed (a right item jumped ahead of bigger left items).` : "No right item jumped ahead."}`, 4, mid2);
        st.set(mid2, "done");
        return { id: mid2, vals: out };
      };
      go(0, n - 1, 0);
      fr.push({ st: new Map(st), cur: -1, note: `Sorted. Every level of the split tree holds n = ${n} items in total and merging a level costs O(n); there are ⌈log₂ ${n}⌉ = ${D} level${D === 1 ? "" : "s"}, so <b>O(n log n)</b>. Counting the jumps while merging found <b>${inv}</b> inversion${inv === 1 ? "" : "s"}: the trick behind Count of Smaller Numbers After Self.`, line: 4, vars: { comparisons: comps, inversions: inv } });
      return fr.map((f) => ({ ...f, nodes, n, D }));
    },
    render: (f) => {
      const cw = 30, gap = 14, X0 = 14, Y0 = 8, rowH = 54, bh = 30;
      const rows = 2 * f.D + 1, W = X0 + f.n * (cw + gap) + 130, H = Y0 + rows * rowH;
      const xi = (i) => X0 + i * (cw + gap);
      const rowOf = (nd) => (nd.kind === "leaf" ? f.D : nd.kind === "split" ? nd.d : 2 * f.D - nd.d);
      const byId = new Map(f.nodes.map((nd) => [nd.id, nd]));
      const box = (nd) => ({ x: xi(nd.lo) - 4, w: xi(nd.hi) + cw + 4 - (xi(nd.lo) - 4), y: Y0 + rowOf(nd) * rowH });
      let edges = "", boxes = "";
      for (const nd of f.nodes) {
        if (!f.st.has(nd.id)) continue;
        const b = box(nd), cls = f.st.get(nd.id);
        if (nd.kind === "merge") for (const c of nd.from) { const cb = box(byId.get(c)); edges += `<line class="edge ${cls === "done" ? "done" : "active"}" x1="${cb.x + cb.w / 2}" y1="${cb.y + bh}" x2="${b.x + b.w / 2}" y2="${b.y}"/>`; }
        else if (nd.d > 0) {
          const parent = f.nodes.find((p) => p.kind === "split" && p.lo <= nd.lo && p.hi >= nd.hi && p.d === nd.d - 1);
          if (parent) { const pb = box(parent); edges += `<line class="edge" x1="${pb.x + pb.w / 2}" y1="${pb.y + bh}" x2="${b.x + b.w / 2}" y2="${b.y}"/>`; }
        }
        boxes += `<rect class="box ${cls}" x="${b.x}" y="${b.y}" width="${b.w}" height="${bh}" rx="6"/>`;
        nd.vals.forEach((v, k) => {
          boxes += `<text class="mono" x="${xi(nd.lo + k) + cw / 2}" y="${b.y + bh / 2 + 4.5}" text-anchor="middle">${v}</text>`;
          if (k) boxes += `<line class="rc-sep" x1="${xi(nd.lo + k) - gap / 2}" x2="${xi(nd.lo + k) - gap / 2}" y1="${b.y + 6}" y2="${b.y + bh - 6}"/>`;
        });
      }
      const lx = X0 + f.n * (cw + gap) + 8;
      let labels = "";
      for (let r = 0; r < rows; r++) labels += `<text class="small muted" x="${lx}" y="${Y0 + r * rowH + bh / 2 + 4}">${r < f.D ? `split, depth ${r}` : r === f.D ? "single items" : `merge, depth ${2 * f.D - r}`}</text>`;
      return `<svg class="dg rc-ms" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="merge sort split and merge trees">${edges}${boxes}${labels}</svg>`;
    },
  }));

  /* ---------- shared: LeetCode level-order arrays → child map (same order as Viz.treeFromArray) ---------- */
  const parseTree = (s, max = 15) => {
    const arr = String(s).split(/[\s,]+/).filter(Boolean).map((t) => (/^(null|none|#|-)$/i.test(t) ? null : Number(t)));
    if (!arr.length || arr[0] === null) throw new Error("The root cannot be null.");
    if (arr.some((v) => v !== null && !Number.isFinite(v))) throw new Error("Use numbers or null, separated by commas.");
    if (arr.filter((v) => v !== null).length > max) throw new Error(`Use at most ${max} nodes.`);
    const kids = new Map(), q = [0]; let i = 1;
    while (q.length) {
      const p = q.shift(), ch = [null, null];
      for (let k = 0; k < 2 && i < arr.length; k++, i++) if (arr[i] !== null) { ch[k] = i; q.push(i); }
      kids.set(p, ch);
    }
    return { arr, kids, L: (id) => kids.get(id)[0], R: (id) => kids.get(id)[1] };
  };

  /* ================= 4. Recursion on trees: answers flow up ================= */
  const TQ = {
    "max depth": {
      code: ["def depth(node):", "    if node is None: return 0", "    l = depth(node.left)", "    r = depth(node.right)", "    return 1 + max(l, r)"],
      base: 0, comb: (v, l, r) => 1 + Math.max(l, r), why: (v, l, r, x) => `1 + max(${l}, ${r}) = ${x}`,
      end: (x) => `The tree is <b>${x}</b> levels deep. Each node did O(1) work with its children's answers: O(n) time, O(h) stack.`,
    },
    "sum of values": {
      code: ["def total(node):", "    if node is None: return 0", "    l = total(node.left)", "    r = total(node.right)", "    return node.val + l + r"],
      base: 0, comb: (v, l, r) => v + l + r, why: (v, l, r, x) => `${v} + ${l} + ${r} = ${x}`,
      end: (x) => `All values sum to <b>${x}</b>. Same skeleton as max depth; only the combine line changed.`,
    },
    "diameter (longest path)": {
      code: ["def height(node):          # best is a nonlocal", "    if node is None: return 0", "    l, r = height(node.left), height(node.right)", "    best = max(best, l + r)   # path bends here", "    return 1 + max(l, r)     # what the parent needs"],
      base: 0, comb: (v, l, r) => 1 + Math.max(l, r), extra: (l, r) => l + r, why: (v, l, r, x) => `height ${x}; a path bending here has ${l} + ${r} = ${l + r} edges`,
      end: (x, best) => `Diameter = <b>${best}</b> edges. The function <i>returns</i> one thing (height, what the parent needs) but <i>records</i> another (the best bend). That split is the key idea for path problems on trees.`,
    },
    "is it balanced?": {
      code: ["def check(node):           # height, or -1", "    if node is None: return 0", "    l, r = check(node.left), check(node.right)", "    if l < 0 or r < 0 or abs(l - r) > 1: return -1", "    return 1 + max(l, r)"],
      base: 0, comb: (v, l, r) => (l < 0 || r < 0 || Math.abs(l - r) > 1 ? -1 : 1 + Math.max(l, r)), why: (v, l, r, x) => (x < 0 ? (l < 0 || r < 0 ? "a subtree is already unbalanced: pass −1 up" : `heights ${l} and ${r} differ by ${Math.abs(l - r)} > 1: unbalanced, return −1`) : `heights ${l} and ${r} are within 1: height ${x}`),
      end: (x) => (x < 0 ? `<b>Not balanced</b>: −1 is a sentinel that short-circuits all the way up.` : `<b>Balanced</b>, height ${x}. Returning a sentinel (−1) avoids recomputing heights: O(n) instead of O(n log n) or O(n²).`),
    },
  };
  const TQK = Object.keys(TQ);
  Viz.register("recursion-treereturn", (el, opts) => Viz.player(el, {
    title: "Recursion on a tree: ask the children, combine, return up",
    tag: "TREE RECURSION",
    legend: [["active", "current node"], ["visit", "waiting for its children"], ["done", "returned (value underneath)"], ["path", "best bend (diameter)"], ["bad", "unbalanced"]],
    codeLang: "python",
    code: ["", "", "", "", ""],
    inputs: [
      { key: "q", label: "question", type: "select", value: (opts && TQ[opts.q]) ? opts.q : TQK[0], options: TQK },
      { key: "t", label: "tree (level order, null for gaps)", value: (opts && opts.t) || "1,2,3,4,5,null,6,7,null,null,8", width: 260 },
    ],
    random: () => { const vals = [1]; const m = 6 + Math.floor(Math.random() * 6); for (let i = 1; i < m + 4; i++) vals.push(Math.random() < 0.25 ? "null" : Math.floor(Math.random() * 9) + 1); return { q: TQK[Math.floor(Math.random() * TQK.length)], t: vals.join(",") }; },
    build: ({ q, t }) => {
      const Q = TQ[q]; setCode(el, Q.code);
      const T = parseTree(t), st = new Map(), sub = new Map(), fr = [];
      let best = -1, bestNode = null, calls = 0;
      const snap = (note, line, extra = {}) => fr.push({ st: new Map(st), sub: new Map(sub), bestNode, note, line, vars: { calls, ...(q.startsWith("diameter") ? { best: Math.max(0, best) } : {}), ...extra } });
      const go = (id, parent) => {
        if (id === null) return Q.base;
        calls++; st.set(id, "active"); if (parent !== null) st.set(parent, "visit");
        const v = T.arr[id];
        snap(`Visit node <b>${v}</b>. Leap of faith: assume the call on each child returns the right answer for that subtree${T.L(id) === null && T.R(id) === null ? "; this is a leaf, so both children are None and return 0" : ""}.`, 0);
        const l = go(T.L(id), id); st.set(id, "active");
        const r = go(T.R(id), id); st.set(id, "active");
        const x = Q.comb(v, l, r);
        if (Q.extra && Q.extra(l, r) > best) { best = Q.extra(l, r); bestNode = id; }
        sub.set(id, x); st.set(id, x < 0 ? "bad" : "done");
        snap(`Node ${v}: children returned ${l} and ${r}. ${Q.why(v, l, r, x)}. Return <b>${x}</b> to the parent.`, [Q.code.length - 1, ...(Q.extra ? [3] : [])], { l, r, returns: x });
        return x;
      };
      const ans = go(0, null);
      snap(Q.end(ans, best), Q.code.length - 1, { answer: q.startsWith("diameter") ? best : ans });
      fr[fr.length - 1].final = true;
      const lay = Viz.layoutTree(0, (id) => T.kids.get(id), (id) => String(T.arr[id]), { dx: 50, dy: 64 });
      return fr.map((f) => ({ ...f, lay }));
    },
    render: (f) => {
      const t = { nodes: f.lay.nodes.map((nd) => ({ ...nd, sub: f.sub.has(nd.id) ? `↑ ${f.sub.get(nd.id)}` : undefined })), edges: f.lay.edges };
      return Viz.graph(t, { r: 19, label: "the number under a node is what its call returned", nodeCls: (id) => (Number(id) === f.bestNode && f.st.get(Number(id)) === "done" ? "path" : f.st.get(Number(id)) || ""), edgeCls: (key) => { const v = Number(key.split("-")[1]); return f.st.get(v) === "done" || f.st.get(v) === "path" ? "done" : f.st.get(v) === "bad" ? "bad" : ""; } });
    },
  }));

  /* ================= 5. Recursion → explicit stack ================= */
  const ORDERS = {
    "preorder (node, left, right)": ["stack = [root]", "while stack:", "    node = stack.pop()", "    out.append(node.val)", "    if node.right: stack.append(node.right)", "    if node.left: stack.append(node.left)  # popped first", "", ""],
    "inorder (left, node, right)": ["stack, node = [], root", "while node or stack:", "    while node:                # go left, saving", "        stack.append(node)     # the pending frames", "        node = node.left", "    node = stack.pop()", "    out.append(node.val)", "    node = node.right"],
    "postorder with (node, seen) frames": ["stack = [(root, False)]", "while stack:", "    node, seen = stack.pop()", "    if seen: out.append(node.val); continue", "    stack.append((node, True))   # come back later", "    if node.right: stack.append((node.right, False))", "    if node.left: stack.append((node.left, False))", ""],
  };
  const OK = Object.keys(ORDERS);
  Viz.register("recursion-explicit", (el, opts) => Viz.player(el, {
    title: "Recursion without recursion: an explicit stack",
    tag: "EXPLICIT STACK",
    legend: [["active", "node being handled"], ["visit", "waiting on the stack"], ["done", "output"]],
    codeLang: "python",
    code: ["", "", "", "", "", "", "", ""],
    inputs: [
      { key: "o", label: "traversal", type: "select", value: (opts && ORDERS[opts.o]) ? opts.o : OK[0], options: OK },
      { key: "t", label: "tree (level order)", value: "4,2,6,1,3,5,7", width: 200 },
    ],
    random: () => { const v = [1]; for (let i = 0; i < 8; i++) v.push(Math.random() < 0.2 ? "null" : Math.floor(Math.random() * 9) + 1); return { o: OK[Math.floor(Math.random() * OK.length)], t: v.join(",") }; },
    build: ({ o, t }) => {
      setCode(el, ORDERS[o]);
      const T = parseTree(t), fr = [], out = [];
      const V = (id) => T.arr[id];
      const snap = (stack, cur, note, line) => fr.push({ stack: stack.map((s) => (Array.isArray(s) ? s : [s, null])), cur, out: out.slice(), note, line, vars: { "stack size": stack.length, output: out.length } });
      if (o.startsWith("pre")) {
        const stack = [0];
        snap(stack, null, "Push the root. The stack now plays the role of the call stack.", 0);
        while (stack.length) {
          const id = stack.pop(); out.push(id);
          snap(stack, id, `Pop <b>${V(id)}</b> and output it (preorder visits a node before its children).`, [2, 3]);
          const pushed = [];
          if (T.R(id) !== null) { stack.push(T.R(id)); pushed.push(V(T.R(id))); }
          if (T.L(id) !== null) { stack.push(T.L(id)); pushed.push(V(T.L(id))); }
          if (pushed.length) snap(stack, id, `Push ${pushed.length === 2 ? `right (${pushed[0]}) then left (${pushed[1]})` : `child ${pushed[0]}`}. Last in, first out: the left child is handled first, exactly like the recursive order.`, [4, 5]);
        }
      } else if (o.startsWith("in")) {
        const stack = []; let node = 0;
        snap(stack, node, "Start at the root with an empty stack.", 0);
        while (node !== null || stack.length) {
          while (node !== null) { stack.push(node); snap(stack, node, `Push <b>${V(node)}</b>: it must wait until its left subtree is done (a recursive call would wait the same way).`, [3, 4]); node = T.L(node); }
          node = stack.pop(); out.push(node);
          snap(stack, node, `Nothing further left: pop <b>${V(node)}</b> and output it.`, [5, 6]);
          node = T.R(node);
          if (node !== null) snap(stack, node, `Move to the right child ${V(node)} and repeat.`, 7);
        }
      } else {
        const stack = [[0, false]];
        snap(stack, null, "Each stack entry is a <b>frame</b>: the node plus how far its call has got (seen = children already scheduled).", 0);
        while (stack.length) {
          const [id, seen] = stack.pop();
          if (seen) { out.push(id); snap(stack, id, `Frame (${V(id)}, seen): both subtrees are finished, so output <b>${V(id)}</b>. This is the code after the recursive calls.`, 3); continue; }
          stack.push([id, true]);
          if (T.R(id) !== null) stack.push([T.R(id), false]);
          if (T.L(id) !== null) stack.push([T.L(id), false]);
          snap(stack, id, `First visit of ${V(id)}: push it back as (${V(id)}, seen) so we return to it later, then its children. This simulates "call left, call right, then finish".`, [4, 5, 6]);
        }
      }
      fr.push({ ...fr[fr.length - 1], cur: null, note: `Done: ${out.map(V).join(", ")}. Same order as the recursive version, but the pending work lives in a heap-allocated list, so a 10⁵-deep tree cannot overflow the call stack.`, line: 1 });
      const lay = Viz.layoutTree(0, (id) => T.kids.get(id), (id) => String(V(id)), { dx: 46, dy: 60 });
      return fr.map((f) => ({ ...f, lay, vals: T.arr }));
    },
    render: (f) => {
      const inStack = new Set(f.stack.map((s) => s[0])), done = new Set(f.out);
      const g = Viz.graph(f.lay, { r: 18, label: "tree", nodeCls: (id) => (Number(id) === f.cur ? "active" : done.has(Number(id)) ? "done" : inStack.has(Number(id)) ? "visit" : "") });
      const st = Viz.stack(f.stack.map(([id, seen]) => (seen === null ? String(f.vals[id]) : `${f.vals[id]}, ${seen ? "seen" : "new"}`)), { label: "explicit stack", cls: (i) => (i === f.stack.length - 1 ? "visit" : "") });
      const out = Viz.array(f.out.map((id) => f.vals[id]), { label: "output", showIdx: false, cls: (i) => (i === f.out.length - 1 && f.cur === f.out[i] ? "active" : "done") });
      return `<div class="rc-col">${Viz.row(g, st)}${f.out.length ? out : `<div class="v-labeled"><span class="v-caption">output</span><div class="rc-dim">empty</div></div>`}</div>`;
    },
  }));

  /* ================= 6. Recursion on a linked list: reverse it ================= */
  Viz.register("recursion-list", (el) => Viz.player(el, {
    title: "Reverse a linked list recursively: arrows turn as the stack unwinds",
    tag: "LINKED LIST",
    legend: [["active", "head of the running call"], ["visit", "waiting frames' heads"], ["done", "already reversed"], ["path", "new head"]],
    codeLang: "python",
    code: [
      "def reverse(head):",
      "    if head is None or head.next is None:",
      "        return head              # last node: new head",
      "    new_head = reverse(head.next)",
      "    head.next.next = head        # turn the arrow back",
      "    head.next = None",
      "    return new_head",
    ],
    inputs: [{ key: "a", label: "list values (2 to 7)", value: "1,2,3,4,5", width: 180 }],
    random: () => ({ a: Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => Math.floor(Math.random() * 9) + 1).join(",") }),
    build: ({ a: s }) => {
      const vals = Viz.parse.ints(s, { min: 2, max: 7 });
      const n = vals.length, next = vals.map((_, i) => (i + 1 < n ? i + 1 : null)), fr = [], frames = [];
      let newHead = null; const rev = new Set();
      const snap = (note, line) => fr.push({ next: next.slice(), frames: frames.slice(), newHead, rev: new Set(rev), note, line, vars: { depth: frames.length, head: frames.length ? vals[frames[frames.length - 1]] : "·", new_head: newHead === null ? "·" : vals[newHead] } });
      const go = (h) => {
        frames.push(h);
        snap(`Call reverse(<b>${vals[h]}</b>). Leap of faith: assume reverse(head.next) correctly reverses everything after ${vals[h]} and returns its new head.`, 0);
        if (next[h] === null) { newHead = h; rev.add(h); snap(`${vals[h]} has no next: a one-node list is already reversed. <b>Base case</b>: it becomes the new head.`, [1, 2]); frames.pop(); return h; }
        snap(`${vals[h]} is not the last node: recurse on the rest first.`, 3);
        const nh = go(next[h]);
        const nx = next[h];
        next[nx] = h;
        snap(`Back in reverse(${vals[h]}). The rest is reversed and ${vals[nx]} is now its tail. Point ${vals[nx]} back at ${vals[h]}: head.next.next = head.`, 4);
        next[h] = null; rev.add(h);
        snap(`Cut ${vals[h]}'s old forward arrow (head.next = None), so ${vals[h]} is the new tail. Return new_head = ${vals[nh]} unchanged.`, [5, 6]);
        frames.pop(); return nh;
      };
      go(0);
      fr.push({ ...fr[fr.length - 1], frames: [], note: `Reversed: ${(() => { const o = []; for (let p = newHead; p !== null; p = fr[fr.length - 1].next[p]) o.push(vals[p]); return o.join(" → "); })()} → None. n frames deep, so O(n) stack: the iterative three-pointer version is O(1) space. The recursive one is the cleanest way to see the "fix one link on the way back" idea.`, line: 6 });
      return fr.map((f) => ({ ...f, vals }));
    },
    render: (f) => {
      const n = f.vals.length, bw = 50, bh = 34, gap = 46, X0 = 16, Y = 46, W = X0 * 2 + n * bw + (n - 1) * gap + 50, H = 150;
      const x = (i) => X0 + i * (bw + gap);
      const top = f.frames.length ? f.frames[f.frames.length - 1] : null, waiting = new Set(f.frames.slice(0, -1));
      let arrows = "", boxes = "", labels = "";
      f.next.forEach((j, i) => {
        if (j === null) { labels += `<text class="small muted" x="${x(i) + bw + 6}" y="${Y + bh / 2 + 4}">→ ∅</text>`; return; }
        if (j === i + 1) arrows += `<line class="edge" x1="${x(i) + bw}" y1="${Y + bh / 2}" x2="${x(j) - 4}" y2="${Y + bh / 2}" marker-end="url(#recursion-ah)"/>`;
        else arrows += `<path class="edge done" d="M${x(i) + bw / 2 - 6},${Y + bh} C${x(i) + bw / 2 - 6},${Y + bh + 46} ${x(j) + bw / 2 + 6},${Y + bh + 46} ${x(j) + bw / 2 + 6},${Y + bh + 6}" fill="none" marker-end="url(#recursion-ahd)"/>`;
      });
      f.vals.forEach((v, i) => {
        const c = i === top ? "active" : waiting.has(i) ? "visit" : i === f.newHead ? "path" : f.rev.has(i) ? "done" : "";
        boxes += `<rect class="box ${c}" x="${x(i)}" y="${Y}" width="${bw}" height="${bh}" rx="7"/><text x="${x(i) + bw / 2}" y="${Y + bh / 2 + 5}" text-anchor="middle" class="mono">${v}</text>`;
        const tags = [i === top ? "head" : "", i === f.newHead ? "new_head" : ""].filter(Boolean).join(" · ");
        if (tags) labels += `<text class="small" x="${x(i) + bw / 2}" y="${Y - 10}" text-anchor="middle">${tags}</text>`;
      });
      const svg = `<svg class="dg rc-list" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="linked list pointers"><defs><marker id="recursion-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rc-ahead" d="M0,0 L10,5 L0,10 z"/></marker><marker id="recursion-ahd" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="rc-ahead done" d="M0,0 L10,5 L0,10 z"/></marker></defs>${arrows}${boxes}${labels}</svg>`;
      const cards = f.frames.map((h, i) => `<div class="rc-frame ${i === f.frames.length - 1 ? "active" : "visit"}"><div class="rc-fhead"><b>reverse(${f.vals[h]})</b></div></div>`).reverse().join("");
      const stack = `<div class="v-labeled"><span class="v-caption">call stack (top = running)</span><div class="rc-stack rc-narrow">${cards || '<div class="rc-more">empty</div>'}<div class="rc-floor">caller</div></div></div>`;
      return Viz.row(`<div class="v-labeled"><span class="v-caption">list (arrows = next pointers)</span>${svg}</div>`, stack);
    },
  }));
})();
