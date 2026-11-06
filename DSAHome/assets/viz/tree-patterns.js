/* Tree Problem Patterns visualizers. Every frame is produced by running the real algorithm on the input you type. */
(() => {
  const S = "tree-patterns";
  const P = (n) => `${S}-${n}`;
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; programs that change with a select rewrite it in place. */
  const setCode = (el, code) => { if (!el || !el.querySelectorAll) return; el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.display = k < code.length ? "" : "none"; }); };
  const blank = (progs) => Array(Math.max(...Object.values(progs).map((p) => p.code.length))).fill("");
  const fm = (v) => (v === Infinity ? "∞" : v === -Infinity ? "-∞" : String(v));
  const col = (...parts) => `<div class="tp-col">${parts.filter(Boolean).join("")}</div>`;

  /* ---------- binary trees from LeetCode level-order arrays ---------- */
  const tokens = (text) => String(text).replace(/[[\]]/g, " ").split(/[\s,]+/).filter(Boolean);
  function parseTree(text, { maxN = 15, maxDepth = 4, distinct = false, dx = 52, dy = 70, maxAbs = 99 } = {}) {
    const toks = tokens(text);
    if (!toks.length) throw new Error("Enter a level-order array such as 3,9,20,null,null,15,7.");
    const arr = toks.map((t) => {
      if (/^(null|none|nil|#)$/i.test(t)) return null;
      const v = Number(t);
      if (!Number.isInteger(v) || Math.abs(v) > maxAbs) throw new Error(`"${t}" is not a whole number between -${maxAbs} and ${maxAbs} (or null).`);
      return v;
    });
    if (arr[0] === null) throw new Error("The root cannot be null (an empty tree has nothing to show).");
    const T = { val: [], L: [], R: [], par: [], depth: [] };
    const mk = (v, d, p) => { T.val.push(v); T.L.push(null); T.R.push(null); T.par.push(p); T.depth.push(d); return T.val.length - 1; };
    mk(arr[0], 0, null);
    const q = [0];
    let i = 1;
    while (q.length && i < arr.length) {
      const p = q.shift();
      for (const side of ["L", "R"]) {
        if (i >= arr.length) break;
        if (arr[i] !== null) { const c = mk(arr[i], T.depth[p] + 1, p); T[side][p] = c; q.push(c); }
        i++;
      }
    }
    if (arr.slice(i).some((v) => v !== null)) throw new Error(`Entry ${i} has no parent slot left: each non-null node owns exactly two slots, so the array is too long.`);
    T.n = T.val.length;
    if (T.n > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${T.n}).`);
    T.height = Math.max(...T.depth);
    if (T.height > maxDepth) throw new Error(`Keep the tree at most ${maxDepth + 1} levels deep (yours has ${T.height + 1}).`);
    if (distinct && new Set(T.val).size !== T.n) throw new Error("This visualizer finds nodes by value, so values must be distinct.");
    T.lay = Viz.layoutTree(0, (id) => [T.L[id], T.R[id]], (id) => T.val[id], { dx, dy });
    T.find = (v) => T.val.indexOf(v);
    return T;
  }
  function toLevel(L, R, val) {
    const out = [], q = [0];
    while (q.length) {
      const u = q.shift();
      if (u === null) { out.push("null"); continue; }
      out.push(String(val[u])); q.push(L[u], R[u]);
    }
    while (out[out.length - 1] === "null") out.pop();
    return out.join(",");
  }
  function randomShape(n, maxDepth) {
    const L = [null], R = [null], D = [0];
    while (L.length < n) {
      const open = [];
      for (let u = 0; u < L.length; u++) if (D[u] < maxDepth) { if (L[u] === null) open.push([u, L]); if (R[u] === null) open.push([u, R]); }
      if (!open.length) break;
      const [u, side] = open[Viz.rand(0, open.length - 1)];
      side[u] = L.length; L.push(null); R.push(null); D.push(D[u] + 1);
    }
    return { L, R };
  }
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  function randomTree(n, maxDepth, gen) {
    const { L, R } = randomShape(n, maxDepth);
    const vals = gen ? L.map((_, i) => gen(i)) : shuffle(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, L.length);
    return toLevel(L, R, vals);
  }
  const isLeaf = (T, id) => T.L[id] === null && T.R[id] === null;
  const subtreeIds = (T, id, out = []) => { if (id === null) return out; out.push(id); subtreeIds(T, T.L[id], out); subtreeIds(T, T.R[id], out); return out; };

  function drawTree(T, o = {}) {
    const nodes = T.lay.nodes.map((nd) => ({ ...nd, sub: o.sub ? o.sub(nd.id) : undefined, top: o.top ? o.top(nd.id) : undefined }));
    return Viz.graph({ nodes, edges: T.lay.edges }, {
      r: o.r || 19,
      label: o.caption,
      nodeCls: (id) => (o.cls && o.cls(Number(id))) || "",
      edgeCls: (k) => {
        const [u, v] = k.split("-").map(Number);
        if (T.par[v] !== u) return "";
        return (o.ecls && o.ecls(u, v)) || "";
      },
    });
  }
  const stackBox = (items, label = "call stack") => Viz.stack(items, { label, cls: (i) => (i === items.length - 1 ? "active" : "visit") });
  const answerBox = (label, value, cls = "") => Viz.labeled(label, `<div class="v-item ${cls}" style="font-size:15px;padding:7px 14px">${esc(value)}</div>`);

  /* =====================================================================
     1. Top-down: pass state down
     ===================================================================== */
  const TD = {
    "good nodes (max so far)": {
      code: [
        "def good_nodes(root):",
        "    count = 0",
        "    def dfs(node, best):        # best = max on the path ABOVE node",
        "        nonlocal count",
        "        if node is None: return",
        "        if node.val >= best: count += 1",
        "        best = max(best, node.val)   # what the children will see",
        "        dfs(node.left, best)",
        "        dfs(node.right, best)",
        "    dfs(root, float(\"-inf\"))",
        "    return count",
      ],
    },
    "max depth (depth parameter)": {
      code: [
        "def max_depth(root):",
        "    ans = 0",
        "    def dfs(node, depth):       # depth of node, counted in nodes",
        "        nonlocal ans",
        "        if node is None: return",
        "        if node.left is None and node.right is None:",
        "            ans = max(ans, depth)   # a finished root-to-leaf path",
        "        dfs(node.left, depth + 1)",
        "        dfs(node.right, depth + 1)",
        "    dfs(root, 1)",
        "    return ans",
      ],
    },
    "path sum II (root-to-leaf = target)": {
      code: [
        "def path_sum(root, target):",
        "    res, path = [], []",
        "    def dfs(node, remain):      # remain = target - sum ABOVE node",
        "        if node is None: return",
        "        path.append(node.val); remain -= node.val",
        "        if node.left is None and node.right is None and remain == 0:",
        "            res.append(path.copy())   # copy: path keeps changing",
        "        dfs(node.left, remain)",
        "        dfs(node.right, remain)",
        "        path.pop()              # un-choose before returning",
        "    dfs(root, target)",
        "    return res",
      ],
    },
    "max ancestor difference (min, max)": {
      code: [
        "def max_ancestor_diff(root):",
        "    ans = 0",
        "    def dfs(node, lo, hi):      # min and max on the path ABOVE node",
        "        nonlocal ans",
        "        if node is None: return",
        "        ans = max(ans, abs(node.val - lo), abs(node.val - hi))",
        "        lo, hi = min(lo, node.val), max(hi, node.val)",
        "        dfs(node.left, lo, hi)",
        "        dfs(node.right, lo, hi)",
        "    dfs(root, root.val, root.val)",
        "    return ans",
      ],
    },
  };
  const TDK = Object.keys(TD);
  Viz.register(P("topdown"), (el, opts) => Viz.player(el, {
    title: "Top-down recursion: every call receives what its ancestors know",
    tag: "PASS STATE DOWN",
    legend: [["active", "current call"], ["visit", "on the call stack"], ["done", "good / counted / matched"], ["bad", "fails the check"], ["path", "the winning path"]],
    codeLang: "python",
    code: blank(TD),
    inputs: [
      { key: "mode", label: "problem", type: "select", value: TDK.find((k) => k.startsWith(opts.mode || "~")) || TDK[0], options: TDK },
      { key: "t", label: "tree (level order, null = gap)", value: opts.t || "5,4,8,11,null,13,4,7,2,null,null,5,1", width: 280 },
      { key: "target", label: "target (path sum)", value: opts.target || "22", width: 70 },
    ],
    random: () => ({ t: randomTree(Viz.rand(7, 12), 3, () => Viz.rand(1, 12)), target: String(Viz.rand(10, 30)) }),
    build: ({ mode, t, target }) => {
      const prog = TD[mode];
      if (!prog) throw new Error("Pick a problem.");
      setCode(el, prog.code);
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const tgt = Viz.parse.int(target, { min: -999, max: 999 });
      const fr = [], top = {}, mark = {}, stack = [], path = [], res = [], texts = [];
      let ans = 0, hiPath = null;
      const snap = (note, line, vars) => fr.push({ T, mode, cur: stack.length ? stack[stack.length - 1] : null, stack: [...stack], texts: [...texts], top: { ...top }, mark: { ...mark }, path: [...path], res: res.map((r) => [...r]), hiPath: hiPath && [...hiPath], ans, note, line, vars });
      if (mode.startsWith("good")) {
        const go = (id, best) => {
          if (id === null) return;
          const v = T.val[id];
          stack.push(id); texts.push(`dfs(${v}, best=${fm(best)})`); top[id] = `best ${fm(best)}`;
          snap(`Call on <b>${v}</b> with best = ${fm(best)}: the largest value on the path from the root down to, but not including, ${v}. The parent computed it; this call only reads it.`, [2, 4], { node: v, best: fm(best), count: ans });
          if (v >= best) { ans++; mark[id] = "done"; snap(`${v} ≥ ${fm(best)}: nothing above it is bigger, so <b>${v} is a good node</b>. count = ${ans}.`, 5, { node: v, best: fm(best), count: ans }); }
          else { mark[id] = "bad"; snap(`${v} &lt; ${best}: an ancestor is bigger, so ${v} is not good.`, 5, { node: v, best: fm(best), count: ans }); }
          const nb = Math.max(best, v);
          if (!isLeaf(T, id)) snap(`Hand best = max(${fm(best)}, ${v}) = <b>${nb}</b> to both children. One number summarises the entire path above them; that is what makes top-down O(n).`, [6, 7, 8], { node: v, best: nb, count: ans });
          go(T.L[id], nb); go(T.R[id], nb);
          stack.pop(); texts.pop();
        };
        go(0, -Infinity);
        snap(`Done: <b>${ans}</b> good node${ans === 1 ? "" : "s"}. No call returned anything; the count lives outside the recursion and each call only needed the state handed down to it.`, 10, { count: ans });
      } else if (mode.startsWith("max depth")) {
        let bestLeaf = null;
        const go = (id, d) => {
          if (id === null) return;
          const v = T.val[id];
          stack.push(id); texts.push(`dfs(${v}, depth=${d})`); top[id] = `d=${d}`;
          snap(`Call on <b>${v}</b> with depth = ${d}. The parent added 1 to its own depth before calling; nobody needs to look back up.`, [2, 4], { node: v, depth: d, ans });
          if (isLeaf(T, id)) {
            const old = ans; ans = Math.max(ans, d); mark[id] = "done";
            if (d > old) bestLeaf = id;
            snap(`${v} is a leaf: one complete root-to-leaf path of ${d} node${d === 1 ? "" : "s"}. ans = max(${old}, ${d}) = <b>${ans}</b>.`, [5, 6], { node: v, depth: d, ans });
          } else snap(`${v} is not a leaf: call each child with depth + 1 = ${d + 1}.`, [7, 8], { node: v, depth: d, ans });
          go(T.L[id], d + 1); go(T.R[id], d + 1);
          stack.pop(); texts.pop();
        };
        go(0, 1);
        hiPath = []; for (let x = bestLeaf; x !== null; x = T.par[x]) hiPath.push(x);
        snap(`Maximum depth = <b>${ans}</b>. The highlighted path is the first deepest leaf the walk reached. Compare the bottom-up version below: same answer, information flowing the other way.`, 10, { ans });
      } else if (mode.startsWith("path sum")) {
        const go = (id, remain) => {
          if (id === null) return;
          const v = T.val[id];
          stack.push(id); texts.push(`dfs(${v}, remain=${remain})`); top[id] = `rem ${remain}`;
          path.push(v); const r2 = remain - v;
          snap(`Call on <b>${v}</b> with remain = ${remain}. Choose ${v}: append it to <code>path</code> and subtract, remain = ${remain} − ${v} = <b>${r2}</b>.`, [2, 4], { node: v, remain: r2, path: `[${path.join(", ")}]`, found: res.length });
          if (isLeaf(T, id)) {
            if (r2 === 0) {
              res.push([...path]); mark[id] = "done"; hiPath = [...stack];
              snap(`Leaf with remain == 0: <b>${path.join(" → ")}</b> sums to ${tgt}. Append a <i>copy</i>; the list object keeps changing as the search backtracks.`, [5, 6], { node: v, remain: r2, path: `[${path.join(", ")}]`, found: res.length });
              hiPath = null;
            } else { mark[id] = "bad"; snap(`Leaf, but remain = ${r2} ≠ 0: this root-to-leaf path sums to ${tgt - r2}, not ${tgt}. Nothing to record.`, 5, { node: v, remain: r2, path: `[${path.join(", ")}]`, found: res.length }); }
          }
          go(T.L[id], r2); go(T.R[id], r2);
          path.pop(); stack.pop(); texts.pop();
          snap(`Leave ${v}: <code>path.pop()</code> removes it, so the caller gets <code>path</code> back exactly as it handed it over. path = [${path.join(", ")}].`, 9, { node: v, path: `[${path.join(", ")}]`, found: res.length });
        };
        go(0, tgt);
        snap(`Finished. ${res.length ? `Found <b>${res.length}</b> path${res.length > 1 ? "s" : ""}: ${res.map((r) => "[" + r.join(", ") + "]").join(", ")}.` : "No root-to-leaf path sums to the target."} One shared <code>path</code> list was reused the whole time: append on the way down, pop on the way up.`, 11, { found: res.length });
      } else {
        let bestPair = null;
        const go = (id, lo, hi, loId, hiId) => {
          if (id === null) return;
          const v = T.val[id];
          stack.push(id); texts.push(`dfs(${v}, lo=${lo}, hi=${hi})`); top[id] = `[${lo},${hi}]`;
          const dl = Math.abs(v - lo), dh = Math.abs(v - hi), cand = Math.max(dl, dh), old = ans;
          if (cand > ans) { ans = cand; bestPair = [dl >= dh ? loId : hiId, id]; }
          mark[id] = "done";
          snap(`Call on <b>${v}</b>. The path above holds values in [${lo}, ${hi}]. Its best partner is whichever extreme is farther away: max(|${v} − ${lo}|, |${v} − ${hi}|) = ${cand}. ans = max(${old}, ${cand}) = <b>${ans}</b>. Two numbers replace the whole list of ancestors.`, [2, 4, 5], { node: v, lo, hi, ans });
          const nlo = Math.min(lo, v), nhi = Math.max(hi, v);
          go(T.L[id], nlo, nhi, v < lo ? id : loId, v > hi ? id : hiId);
          go(T.R[id], nlo, nhi, v < lo ? id : loId, v > hi ? id : hiId);
          stack.pop(); texts.pop();
        };
        go(0, T.val[0], T.val[0], 0, 0);
        if (bestPair) { hiPath = []; for (let x = bestPair[1]; x !== null; x = T.par[x]) { hiPath.push(x); if (x === bestPair[0]) break; } }
        snap(`Answer: <b>${ans}</b>${bestPair ? `, from ancestor ${T.val[bestPair[0]]} and descendant ${T.val[bestPair[1]]}` : ""}. Passing (min, max) down beats comparing every node with every ancestor, which is O(n·h).`, 10, { ans });
      }
      return fr;
    },
    render: (f) => {
      const T = f.T, inStack = new Set(f.stack), hp = f.hiPath ? new Set(f.hiPath) : null;
      const tree = drawTree(T, {
        top: (id) => f.top[id],
        cls: (id) => (hp && hp.has(id) ? "path" : id === f.cur && !f.mark[id] ? "active" : f.mark[id] || (inStack.has(id) ? "visit" : "")),
        ecls: (u, v) => (hp && hp.has(u) && hp.has(v) ? "path" : inStack.has(u) && inStack.has(v) ? "active" : ""),
        caption: "label above a node = the state its parent passed down",
      });
      const side = [stackBox(f.texts.length ? f.texts : [], "call stack, running call")];
      if (f.mode.startsWith("path sum")) {
        side.push(f.path.length ? Viz.array(f.path, { label: "path (shared list)", showIdx: false, cls: (i) => (i === f.path.length - 1 ? "active" : "visit") }) : answerBox("path (shared list)", "[]"));
        side.push(answerBox("res", f.res.length ? f.res.map((r) => `[${r.join(",")}]`).join("  ") : "[]", f.res.length ? "done" : ""));
      } else side.push(answerBox(f.mode.startsWith("good") ? "count" : "ans", f.ans, "done"));
      return Viz.row(tree, col(...side));
    },
  }));

  /* =====================================================================
     2. Bottom-up: return information up
     ===================================================================== */
  const BU = {
    "height (max depth)": {
      code: [
        "def max_depth(node):",
        "    if node is None:",
        "        return 0                # empty tree: depth 0",
        "    l = max_depth(node.left)    # leap of faith: trust the child",
        "    r = max_depth(node.right)",
        "    return 1 + max(l, r)        # combine on the way up",
      ],
    },
    "balanced? (-1 = unbalanced)": {
      code: [
        "def height_or_fail(node):      # height, or -1 = 'unbalanced below'",
        "    if node is None:",
        "        return 0",
        "    l = height_or_fail(node.left)",
        "    if l == -1: return -1       # already failed: skip the right side",
        "    r = height_or_fail(node.right)",
        "    if r == -1 or abs(l - r) > 1:",
        "        return -1",
        "    return 1 + max(l, r)",
        "# is_balanced(root) = height_or_fail(root) != -1",
      ],
    },
    "diameter (global best + return value)": {
      code: [
        "def diameter(root):",
        "    best = 0",
        "    def depth(node):",
        "        nonlocal best",
        "        if node is None: return 0",
        "        l, r = depth(node.left), depth(node.right)",
        "        best = max(best, l + r)   # path that BENDS here (answer)",
        "        return 1 + max(l, r)      # path that CONTINUES up (one arm)",
        "    depth(root)",
        "    return best",
      ],
    },
  };
  const BUK = Object.keys(BU);
  Viz.register(P("bottomup"), (el, opts) => Viz.player(el, {
    title: "Bottom-up recursion: every call returns a summary of its subtree",
    tag: "RETURN INFO UP",
    legend: [["active", "current call"], ["visit", "waiting for its children"], ["done", "returned (value underneath)"], ["bad", "returned -1 (unbalanced)"], ["dim", "never visited (short-circuit)"], ["path", "diameter path"]],
    codeLang: "python",
    code: blank(BU),
    inputs: [
      { key: "mode", label: "question", type: "select", value: BUK.find((k) => k.startsWith(opts.mode || "~")) || BUK[0], options: BUK },
      { key: "t", label: "tree (level order, null = gap)", value: opts.t || "1,2,3,4,5,null,6,7,null,8,9,null,null,null,null,10", width: 300 },
    ],
    random: () => ({ t: randomTree(Viz.rand(7, 13), 4, () => Viz.rand(1, 9)) }),
    build: ({ mode, t }) => {
      const prog = BU[mode];
      if (!prog) throw new Error("Pick a question.");
      setCode(el, prog.code);
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const fr = [], st = {}, ret = {}, topL = {}, stack = [];
      let best = 0, bestNode = null, hiPath = null;
      const snap = (note, line, vars) => fr.push({ T, mode, st: { ...st }, ret: { ...ret }, topL: { ...topL }, stack: [...stack], hiPath: hiPath && [...hiPath], bestNode, note, line, vars });
      const val = (id) => T.val[id];
      if (mode.startsWith("height")) {
        const go = (id) => {
          if (id === null) return 0;
          stack.push(id); st[id] = "active";
          snap(`Call on <b>${val(id)}</b>. It cannot answer yet: its height depends on its children's heights, so it asks them first.`, [0, 1], { node: val(id) });
          st[id] = "visit";
          const l = go(T.L[id]); st[id] = "active";
          const r = go(T.R[id]); st[id] = "active";
          const x = 1 + Math.max(l, r); ret[id] = x; st[id] = "done"; stack.pop();
          snap(`Back at <b>${val(id)}</b>: left returned ${l}, right returned ${r}${isLeaf(T, id) ? " (both empty)" : ""}. Return 1 + max(${l}, ${r}) = <b>${x}</b>.`, [3, 4, 5], { node: val(id), l, r, returns: x });
          return x;
        };
        const h = go(0);
        snap(`The root's return value is the answer: depth <b>${h}</b>. Each node was combined exactly once, after both children: postorder, O(n).`, 5, { answer: h });
      } else if (mode.startsWith("balanced")) {
        const go = (id) => {
          if (id === null) return 0;
          stack.push(id); st[id] = "active";
          snap(`Call on <b>${val(id)}</b>: ask the left child for its height (or -1 if something below is already unbalanced).`, [0, 3], { node: val(id) });
          st[id] = "visit";
          const l = go(T.L[id]); st[id] = "active";
          if (l === -1) {
            ret[id] = -1; st[id] = "bad"; stack.pop();
            for (const x of subtreeIds(T, T.R[id])) st[x] = "dim";
            snap(`Left child of ${val(id)} returned -1. The answer is already "not balanced", so return -1 <b>without visiting the right subtree</b> (dimmed). The sentinel short-circuits the whole climb.`, 4, { node: val(id), l, returns: -1 });
            return -1;
          }
          const r = go(T.R[id]); st[id] = "active";
          let x;
          if (r === -1 || Math.abs(l - r) > 1) {
            x = -1; st[id] = "bad";
            snap(r === -1 ? `Right child of ${val(id)} returned -1: pass the failure up.` : `At <b>${val(id)}</b>: heights ${l} and ${r} differ by ${Math.abs(l - r)} &gt; 1. Unbalanced here: return <b>-1</b>.`, [6, 7], { node: val(id), l, r, returns: -1 });
          } else {
            x = 1 + Math.max(l, r); st[id] = "done";
            snap(`At <b>${val(id)}</b>: heights ${l} and ${r} differ by ${Math.abs(l - r)} ≤ 1. Balanced so far; return the height 1 + max = <b>${x}</b>.`, 8, { node: val(id), l, r, returns: x });
          }
          ret[id] = x; stack.pop();
          return x;
        };
        const h = go(0);
        snap(h === -1 ? `The root returned -1: <b>not balanced</b>. One return value carried two facts (height and "already failed"), so the check is O(n) instead of the O(n²) "compute height at every node" version.` : `The root returned ${h}: <b>balanced</b>, height ${h}. One pass, O(n). The naive version calls height() at every node: O(n²) on a chain.`, 9, { answer: h === -1 ? "False" : "True" });
      } else {
        const go = (id) => {
          if (id === null) return 0;
          stack.push(id); st[id] = "active";
          snap(`Call on <b>${val(id)}</b>: get the depth of each side first.`, [2, 4], { node: val(id), best });
          st[id] = "visit";
          const l = go(T.L[id]); st[id] = "active";
          const r = go(T.R[id]); st[id] = "active";
          const old = best;
          if (l + r > best) { best = l + r; bestNode = id; }
          topL[id] = `bend ${l + r}`;
          const x = 1 + Math.max(l, r); ret[id] = x; st[id] = "done"; stack.pop();
          snap(`At <b>${val(id)}</b>: l = ${l}, r = ${r}. A path that <b>bends</b> here has ${l} + ${r} = ${l + r} edges, a candidate for the answer: best = max(${old}, ${l + r}) = <b>${best}</b>. But the parent can only extend <i>one</i> arm, so return 1 + max(l, r) = <b>${x}</b>, not ${l + r}.`, [5, 6, 7], { node: val(id), l, r, best, returns: x });
          return x;
        };
        go(0);
        const arm = (c) => { const out = []; for (let x = c; x !== null;) { out.push(x); const a = T.L[x] === null ? 0 : ret[T.L[x]], b = T.R[x] === null ? 0 : ret[T.R[x]]; x = a === 0 && b === 0 ? null : a >= b ? T.L[x] : T.R[x]; } return out; };
        hiPath = [bestNode, ...(T.L[bestNode] !== null ? arm(T.L[bestNode]) : []), ...(T.R[bestNode] !== null ? arm(T.R[bestNode]) : [])];
        snap(`Diameter = <b>${best}</b> edges, bending at ${val(bestNode)} (purple). Note the root returned ${ret[0]}, which is <i>not</i> the answer: the answer lives in <code>best</code>, the return value only feeds the parent.`, 9, { answer: best });
      }
      return fr;
    },
    render: (f) => {
      const T = f.T, hp = f.hiPath ? new Set(f.hiPath) : null;
      const tree = drawTree(T, {
        sub: (id) => (f.ret[id] !== undefined ? `↑ ${f.ret[id]}` : undefined),
        top: (id) => f.topL[id],
        cls: (id) => (hp && hp.has(id) ? "path" : f.st[id] || ""),
        ecls: (u, v) => (hp && hp.has(u) && hp.has(v) ? "path" : f.st[v] === "done" ? "done" : f.st[v] === "bad" ? "bad" : f.st[v] === "dim" ? "dim" : f.st[v] === "active" || f.st[v] === "visit" ? "active" : ""),
        caption: f.mode.startsWith("diameter") ? "above: l + r if the path bends here · below: what the call returns" : "the number under a node is what its call returned",
      });
      return Viz.row(tree, stackBox(f.stack.map((id) => `f(${T.val[id]})`), "call stack, running call"));
    },
  }));

  /* =====================================================================
     3. Binary Tree Maximum Path Sum
     ===================================================================== */
  Viz.register(P("maxpath"), (el, opts) => Viz.player(el, {
    title: "Maximum path sum: return one arm, record the bend",
    tag: "GLOBAL BEST vs RETURN VALUE",
    legend: [["active", "current call"], ["visit", "waiting for children"], ["done", "returned its gain"], ["bad", "arm dropped (gain < 0)"], ["path", "best path found"]],
    codeLang: "python",
    code: [
      "def max_path_sum(root):",
      "    best = float(\"-inf\")",
      "    def gain(node):            # best path from node going down",
      "        nonlocal best",
      "        if node is None: return 0",
      "        l = max(gain(node.left), 0)    # negative arm: take no arm",
      "        r = max(gain(node.right), 0)",
      "        best = max(best, node.val + l + r)   # bend here: both arms",
      "        return node.val + max(l, r)          # report up: one arm only",
      "    gain(root)",
      "    return best",
    ],
    inputs: [{ key: "t", label: "tree (level order, negatives allowed)", value: opts.t || "-3,9,20,-6,4,15,-7,null,2,null,null,-1,8", width: 320 }],
    random: () => ({ t: randomTree(Viz.rand(7, 13), 3, () => Viz.rand(-12, 15)) }),
    build: ({ t }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const fr = [], st = {}, ret = {}, through = {}, dropped = new Set(), choice = {};
      let best = -Infinity, bestNode = null, hiPath = null;
      const snap = (note, line, vars) => fr.push({ T, st: { ...st }, ret: { ...ret }, through: { ...through }, dropped: new Set(dropped), bestNode, hiPath: hiPath && [...hiPath], note, line, vars });
      const go = (id) => {
        if (id === null) return 0;
        const v = T.val[id];
        st[id] = "active";
        snap(`Call gain(<b>${v}</b>): "what is the best downward path that starts here?" First ask both children.`, [2, 4], { node: v, best: fm(best) });
        st[id] = "visit";
        const gl = go(T.L[id]); st[id] = "active";
        const gr = go(T.R[id]); st[id] = "active";
        const l = Math.max(gl, 0), r = Math.max(gr, 0);
        if (T.L[id] !== null && gl < 0) dropped.add(T.L[id]);
        if (T.R[id] !== null && gr < 0) dropped.add(T.R[id]);
        const thr = v + l + r, old = best;
        through[id] = thr;
        if (thr > best) { best = thr; bestNode = id; }
        const x = v + Math.max(l, r);
        choice[id] = l === 0 && r === 0 ? null : l >= r ? T.L[id] : T.R[id];
        ret[id] = x; st[id] = "done";
        const clip = [gl < 0 && T.L[id] !== null ? `left gain ${gl} is negative, so drop it (use 0)` : "", gr < 0 && T.R[id] !== null ? `right gain ${gr} is negative, so drop it (use 0)` : ""].filter(Boolean).join("; ");
        snap(`At <b>${v}</b>: l = ${l}, r = ${r}${clip ? ` (${clip})` : ""}. <b>Bend here</b>: ${v} + ${l} + ${r} = ${thr}; best = max(${fm(old)}, ${thr}) = <b>${best}</b>. <b>Return up</b> only one arm: ${v} + max(${l}, ${r}) = <b>${x}</b>, because a path through the parent cannot fork.`, [5, 6, 7, 8], { node: v, l, r, "bend": thr, best, returns: x });
        return x;
      };
      go(0);
      const arm = (c) => { const out = []; for (let x = c; x !== null && x !== undefined; x = choice[x]) out.push(x); return out; };
      const b = bestNode;
      hiPath = [b, ...(T.L[b] !== null && !dropped.has(T.L[b]) && ret[T.L[b]] > 0 ? arm(T.L[b]) : []), ...(T.R[b] !== null && !dropped.has(T.R[b]) && ret[T.R[b]] > 0 ? arm(T.R[b]) : [])];
      snap(`Maximum path sum = <b>${best}</b>, the purple path bending at ${T.val[b]}. The root returned ${ret[0]}: a different number, because a return value must be extendable upward while the answer may bend anywhere.`, 10, { answer: best });
      return fr;
    },
    render: (f) => {
      const T = f.T, hp = f.hiPath ? new Set(f.hiPath) : null;
      return drawTree(T, {
        sub: (id) => (f.ret[id] !== undefined ? `↑ ${f.ret[id]}` : undefined),
        top: (id) => (f.through[id] !== undefined ? `bend ${f.through[id]}` : undefined),
        cls: (id) => (hp && hp.has(id) ? "path" : f.dropped.has(id) && f.st[id] === "done" ? "bad" : f.st[id] || ""),
        ecls: (u, v) => (hp && hp.has(u) && hp.has(v) ? "path" : f.dropped.has(v) ? "bad" : f.st[v] === "done" ? "done" : f.st[v] ? "active" : ""),
        caption: "above: node + l + r (path bending here) · below: node + max(l, r) (returned)",
      });
    },
  }));

  /* =====================================================================
     4. Lowest common ancestor by return propagation
     ===================================================================== */
  Viz.register(P("lca"), (el, opts) => Viz.player(el, {
    title: "LCA in a binary tree: found nodes bubble up until two meet",
    tag: "RETURN PROPAGATION",
    legend: [["active", "current call"], ["visit", "waiting for children"], ["done", "returned a found node"], ["dim", "never searched (shortcut)"], ["path", "the LCA"]],
    codeLang: "python",
    code: [
      "def lca(node, p, q):",
      "    if node is None or node is p or node is q:",
      "        return node             # nothing here, or found one of them",
      "    left = lca(node.left, p, q)",
      "    right = lca(node.right, p, q)",
      "    if left and right:",
      "        return node             # p and q on different sides: split here",
      "    return left or right        # pass up whatever was found (maybe None)",
    ],
    inputs: [
      { key: "t", label: "tree (distinct values)", value: opts.t || "3,5,1,6,2,0,8,null,null,7,4", width: 230 },
      { key: "p", label: "p", value: opts.p || "7", width: 50 },
      { key: "q", label: "q", value: opts.q || "8", width: 50 },
    ],
    random: () => { const t = randomTree(Viz.rand(7, 12), 3); const vals = tokens(t).filter((x) => x !== "null"); shuffle(vals); return { t, p: vals[0], q: vals[1] }; },
    build: ({ t, p, q }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4, distinct: true });
      const pv = Viz.parse.int(p), qv = Viz.parse.int(q);
      const pid = T.find(pv), qid = T.find(qv);
      if (pid < 0 || qid < 0) throw new Error("p and q must both be values in the tree (the classic version promises they exist).");
      if (pid === qid) throw new Error("Pick two different nodes.");
      const fr = [], st = {}, ret = {}, stack = [];
      let answer = null;
      const name = (id) => (id === null ? "None" : String(T.val[id]));
      const snap = (note, line, vars) => fr.push({ T, pid, qid, st: { ...st }, ret: { ...ret }, stack: [...stack], answer, note, line, vars });
      const go = (id) => {
        if (id === null) return null;
        stack.push(id); st[id] = "active";
        if (id === pid || id === qid) {
          ret[id] = id; st[id] = "done"; stack.pop();
          const below = subtreeIds(T, id).slice(1);
          for (const x of below) st[x] = "dim";
          snap(`<b>${T.val[id]}</b> is ${id === pid ? "p" : "q"}: return it immediately${below.length ? " and never look below it (dimmed)" : ""}. If the other target is underneath, this node <i>is</i> the LCA and returning it is already correct; if not, the other target will turn up elsewhere and the split happens higher.`, [1, 2], { node: T.val[id], returns: T.val[id] });
          return id;
        }
        snap(`Call on <b>${T.val[id]}</b>: it is neither p nor q. Ask both subtrees "did you find p or q?"`, [0, 1], { node: T.val[id] });
        st[id] = "visit";
        const l = go(T.L[id]); st[id] = "active";
        const r = go(T.R[id]); st[id] = "active";
        let x;
        if (l !== null && r !== null) {
          x = id; answer = id; st[id] = "path";
          snap(`At <b>${T.val[id]}</b>: left returned ${name(l)}, right returned ${name(r)}. One target on each side, so the paths to p and q <b>split here</b>: ${T.val[id]} is the LCA. Return it; every ancestor will just pass it up.`, [5, 6], { node: T.val[id], left: name(l), right: name(r), returns: T.val[id] });
        } else {
          x = l !== null ? l : r; st[id] = x === null ? "" : "done";
          snap(x === null ? `At <b>${T.val[id]}</b>: both sides returned None. Neither target is in this subtree; return None.` : `At <b>${T.val[id]}</b>: left returned ${name(l)}, right returned ${name(r)}. Only one side found something, so pass <b>${name(x)}</b> up unchanged. (It may be a target, or an LCA found deeper.)`, 7, { node: T.val[id], left: name(l), right: name(r), returns: name(x) });
        }
        ret[id] = x; stack.pop();
        return x;
      };
      const res = go(0);
      answer = res;
      snap(`The root's call returns <b>${name(res)}</b>: the lowest common ancestor of ${pv} and ${qv}. Each node was visited at most once: O(n) time, O(h) stack.`, 7, { answer: name(res) });
      return fr;
    },
    render: (f) => {
      const T = f.T, inStack = new Set(f.stack);
      return Viz.row(drawTree(T, {
        top: (id) => (id === f.pid ? "p" : id === f.qid ? "q" : undefined),
        sub: (id) => (id in f.ret ? `↑ ${f.ret[id] === null ? "∅" : T.val[f.ret[id]]}` : undefined),
        cls: (id) => (f.answer === id ? "path" : f.st[id] || ""),
        ecls: (u, v) => (f.st[v] === "dim" ? "dim" : f.ret[v] !== undefined && f.ret[v] !== null ? "done" : inStack.has(v) ? "active" : ""),
        caption: "under a node: what its call returned (∅ = None)",
      }), stackBox(f.stack.map((id) => `lca(${T.val[id]})`), "call stack, running call"));
    },
  }));

  /* ---------- general (n-ary) trees from an edge list, rooted at 0 ---------- */
  function parseEdges(text, { maxN = 16 } = {}) {
    const nums = (String(text).match(/\d+/g) || []).map(Number);
    if (nums.length % 2) throw new Error("Write edges as pairs, for example 0-1, 0-2, 1-3.");
    const E = []; for (let i = 0; i < nums.length; i += 2) E.push([nums[i], nums[i + 1]]);
    const n = E.length + 1;
    if (n < 2) throw new Error("Give at least one edge.");
    if (n > maxN) throw new Error(`Use at most ${maxN - 1} edges (${maxN} nodes) so the picture stays readable.`);
    for (const [a, b] of E) if (a < 0 || b < 0 || a >= n || b >= n || a === b) throw new Error(`Edge ${a}-${b}: with ${E.length} edges the nodes must be 0..${n - 1} (a tree has n − 1 edges).`);
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of E) { adj[a].push(b); adj[b].push(a); }
    for (const a of adj) a.sort((x, y) => x - y);
    const par = Array(n).fill(-2), depth = Array(n).fill(0), order = [0], kids = Array.from({ length: n }, () => []);
    par[0] = -1;
    for (let i = 0; i < order.length; i++) { const v = order[i]; for (const c of adj[v]) if (par[c] === -2) { par[c] = v; depth[c] = depth[v] + 1; kids[v].push(c); order.push(c); } }
    if (order.length !== n) throw new Error("Those edges do not connect every node (or they contain a cycle): a tree on n nodes is connected with exactly n − 1 edges.");
    return { n, E, adj, par, depth, kids, order };
  }
  const randomEdges = (n, maxDepth = 5) => {
    const d = [0], out = [];
    for (let v = 1; v < n; v++) { let p; do { p = Viz.rand(0, v - 1); } while (d[p] >= maxDepth); d.push(d[p] + 1); out.push(`${p}-${v}`); }
    return out.join(", ");
  };

  /* =====================================================================
     5. Binary lifting
     ===================================================================== */
  Viz.register(P("lifting"), (el, opts) => Viz.player(el, {
    title: "Binary lifting: a jump table of 1, 2, 4, 8 … ancestors",
    tag: "BUILD TABLE · ANSWER LCA",
    legend: [["active", "u / cell being read"], ["visit", "v / cell it depends on"], ["done", "table row built"], ["path", "LCA"], ["dim", "not involved"]],
    codeLang: "python",
    code: [
      "LOG = max(1, (n - 1).bit_length())  # 2**LOG > any depth",
      "up = [parent]                 # up[0][v] = parent (root -> itself)",
      "for k in range(1, LOG):",
      "    up.append([up[k-1][up[k-1][v]] for v in range(n)])",
      "def lca(u, v):",
      "    if depth[u] < depth[v]: u, v = v, u",
      "    diff = depth[u] - depth[v]",
      "    for k in range(LOG):        # lift u by diff, one set bit at a time",
      "        if diff >> k & 1: u = up[k][u]",
      "    if u == v: return u",
      "    for k in reversed(range(LOG)):",
      "        if up[k][u] != up[k][v]:     # still below the LCA: jump both",
      "            u, v = up[k][u], up[k][v]",
      "    return up[0][u]",
    ],
    inputs: [
      { key: "e", label: "edges (rooted at 0)", value: opts.e || "0-1, 1-2, 2-3, 3-4, 4-5, 5-6, 6-7, 7-8, 2-9, 9-10, 10-11, 11-12, 0-13, 13-14", width: 380 },
      { key: "u", label: "u", value: opts.u || "8", width: 50 },
      { key: "v", label: "v", value: opts.v || "12", width: 50 },
    ],
    random: () => { const n = Viz.rand(10, 16); return { e: randomEdges(n, 8), u: String(Viz.rand(1, n - 1)), v: String(Viz.rand(1, n - 1)) }; },
    build: ({ e, u, v }) => {
      const G = parseEdges(e, { maxN: 16 });
      const n = G.n;
      if (Math.max(...G.depth) > 9) throw new Error("Keep the tree at most 10 levels deep so it fits.");
      let a = Viz.parse.int(u, { min: 0, max: n - 1 }), b = Viz.parse.int(v, { min: 0, max: n - 1 });
      const LOG = Math.max(1, (n - 1).toString(2).length);
      const up = [G.par.map((p, i) => (p < 0 ? i : p))];
      const lay = Viz.layoutTree(0, (x) => G.kids[x], (x) => String(x), { dx: 44, dy: 52 });
      const fr = [];
      const snap = (o) => fr.push({ G, lay, LOG, up: up.map((r) => [...r]), rows: up.length, ...o });
      snap({ cell: null, note: `up[0] is just the parent array (the root points to itself so jumps past the top stay at the root). To jump 2<sup>k</sup> levels we will combine two jumps of 2<sup>k−1</sup>. LOG = ${LOG}, because 2<sup>${LOG}</sup> = ${1 << LOG} exceeds every depth.`, line: [0, 1], vars: { n, LOG } });
      for (let k = 1; k < LOG; k++) {
        up.push(up[k - 1].map((x) => up[k - 1][x]));
        const deep = G.order[G.order.length - 1], mid = up[k - 1][deep];
        snap({ cell: [k, deep], deps: [[k - 1, deep], [k - 1, mid]], note: `Row k = ${k} (jumps of ${1 << k}). Example: up[${k}][${deep}] = up[${k - 1}][ up[${k - 1}][${deep}] ] = up[${k - 1}][${mid}] = <b>${up[k][deep]}</b>. Jump ${1 << (k - 1)}, then ${1 << (k - 1)} more. Every cell reads only the row above, so the table costs O(n log n).`, line: [2, 3], vars: { k, jump: 1 << k } });
      }
      const nm = (x) => String(x);
      let jumps = [];
      const pathEdges = (from, to) => { const s = new Set(); for (let x = from; x !== to && G.par[x] >= 0; x = G.par[x]) s.add(`${G.par[x]}-${x}`); return s; };
      snap({ u: a, v: b, note: `Query lca(${a}, ${b}). depth[${a}] = ${G.depth[a]}, depth[${b}] = ${G.depth[b]}.`, line: 4, vars: { u: a, v: b, "depth[u]": G.depth[a], "depth[v]": G.depth[b] } });
      if (G.depth[a] < G.depth[b]) { [a, b] = [b, a]; snap({ u: a, v: b, note: `Swap so that u = ${a} is the deeper node.`, line: 5, vars: { u: a, v: b } }); }
      const diff = G.depth[a] - G.depth[b];
      snap({ u: a, v: b, note: `diff = ${diff} = ${diff.toString(2).padStart(LOG, "0")}<sub>2</sub>. Lift u by exactly diff using one jump per set bit${diff ? `: ${[...Array(LOG).keys()].filter((k) => (diff >> k) & 1).map((k) => 1 << k).join(" + ")}` : " (none needed)"}.`, line: 6, vars: { u: a, v: b, diff, bits: diff.toString(2) } });
      for (let k = 0; k < LOG; k++) {
        if ((diff >> k) & 1) {
          const na = up[k][a];
          jumps = [...pathEdges(a, na)];
          snap({ u: na, v: b, cell: [k, a], jumpEdges: jumps, note: `Bit ${k} of diff is set: u = up[${k}][${a}] = <b>${na}</b>, ${1 << k} level${k ? "s" : ""} up in one step.`, line: [7, 8], vars: { k, u: na, v: b } });
          a = na;
        }
      }
      let ans;
      if (a === b) {
        ans = a;
        snap({ u: a, v: b, ans, note: `After lifting, u == v = ${a}: the shallower node was an ancestor of the deeper one, so it is the LCA.`, line: 9, vars: { u: a, v: b, lca: a } });
      } else {
        snap({ u: a, v: b, note: `Same depth (${G.depth[a]}), different nodes. Now jump both together, biggest jump first, but <b>only if they would land on different nodes</b>. Landing on the same node means we may have overshot above the LCA.`, line: 9, vars: { u: a, v: b } });
        for (let k = LOG - 1; k >= 0; k--) {
          const na = up[k][a], nb = up[k][b];
          if (na !== nb) {
            jumps = [...pathEdges(a, na), ...pathEdges(b, nb)];
            snap({ u: na, v: nb, cell: [k, a], cell2: [k, b], jumpEdges: jumps, note: `k = ${k}: up[${k}][${a}] = ${na} ≠ up[${k}][${b}] = ${nb}. Different, so both are still strictly below the LCA: jump both ${1 << k} up.`, line: [10, 11, 12], vars: { k, u: na, v: nb } });
            a = na; b = nb;
          } else {
            snap({ u: a, v: b, cell: [k, a], cell2: [k, b], note: `k = ${k}: up[${k}][${a}] = up[${k}][${b}] = ${na}. A common ancestor, but maybe not the lowest one. Do not jump; try a smaller power.`, line: [10, 11], vars: { k, u: a, v: b } });
          }
        }
        ans = up[0][a];
        snap({ u: a, v: b, ans, cell: [0, a], note: `u = ${a} and v = ${b} are now the children of the LCA on the two paths. Their parent up[0][${a}] = <b>${ans}</b> is the answer. O(log n) per query after the O(n log n) table.`, line: 13, vars: { u: a, v: b, lca: ans } });
      }
      return fr;
    },
    render: (f) => {
      const G = f.G, je = new Set(f.jumpEdges || []);
      const tree = Viz.graph({ nodes: f.lay.nodes.map((nd) => ({ ...nd, sub: `d${G.depth[nd.id]}` })), edges: f.lay.edges }, {
        r: 15,
        label: "node id · depth underneath",
        nodeCls: (id) => { id = Number(id); return f.ans === id ? "path" : id === f.u ? "active" : id === f.v ? "visit" : ""; },
        edgeCls: (k) => (je.has(k) ? "active" : ""),
      });
      const m = f.up.slice(0, f.rows);
      const grid = Viz.grid(m, {
        label: "jump table up[k][v] = ancestor 2^k levels above v",
        rowLabels: m.map((_, k) => `k=${k} (${1 << k})`),
        colLabels: m[0].map((_, i) => String(i)),
        corner: "v →",
        cls: (r, c) => {
          if (f.cell && f.cell[0] === r && f.cell[1] === c) return "active";
          if (f.cell2 && f.cell2[0] === r && f.cell2[1] === c) return "visit";
          if (f.deps && f.deps.some(([a, b]) => a === r && b === c)) return "visit";
          return f.u === undefined && f.cell && r === f.cell[0] ? "done" : "";
        },
      });
      return `<div class="tp-col">${tree}${grid}</div>`;
    },
  }));

  /* =====================================================================
     6. Path Sum III: prefix sums on the root path + backtracking counts
     ===================================================================== */
  Viz.register(P("pathsum3"), (el, opts) => Viz.player(el, {
    title: "Path Sum III: prefix sums along the root path, undone on the way back",
    tag: "PREFIX SUM + HASH MAP + BACKTRACK",
    legend: [["active", "current node"], ["visit", "on the current root path"], ["path", "a downward path summing to target"], ["done", "finished"]],
    codeLang: "python",
    code: [
      "def path_sum(root, target):",
      "    seen = {0: 1}               # prefix sums on the CURRENT root path",
      "    def dfs(node, cur):",
      "        if node is None: return 0",
      "        cur += node.val                       # prefix sum root..node",
      "        found = seen.get(cur - target, 0)     # paths that END here",
      "        seen[cur] = seen.get(cur, 0) + 1",
      "        found += dfs(node.left, cur) + dfs(node.right, cur)",
      "        seen[cur] -= 1          # leaving: no longer above anyone",
      "        return found",
      "    return dfs(root, 0)",
    ],
    inputs: [
      { key: "t", label: "tree (level order)", value: opts.t || "10,5,-3,3,2,null,11,3,-2,null,1", width: 260 },
      { key: "target", label: "target", value: opts.target || "8", width: 60 },
    ],
    random: () => ({ t: randomTree(Viz.rand(8, 13), 3, () => Viz.rand(-4, 8)), target: String(Viz.rand(2, 10)) }),
    build: ({ t, target }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const tgt = Viz.parse.int(target, { min: -999, max: 999 });
      const fr = [], seen = new Map([[0, 1]]), stack = [], prefix = {}, done = new Set();
      let total = 0;
      const snap = (o) => fr.push({ T, seen: [...seen.entries()], stack: [...stack], prefix: { ...prefix }, done: new Set(done), total, ...o });
      snap({ note: `<code>seen</code> starts as {0: 1}: the empty prefix "above the root". It lets a path that starts at the root count, exactly like subarray-sum-equals-k on an array.`, line: 1, vars: { target: tgt, total: 0 } });
      const go = (id, cur) => {
        if (id === null) return 0;
        const v = T.val[id];
        const before = [0, ...stack.map((x) => prefix[x])]; // prefix sums strictly above each start option
        stack.push(id);
        cur += v; prefix[id] = cur;
        const need = cur - tgt, cnt = seen.get(need) || 0;
        const paths = [];
        before.forEach((pv, j) => { if (pv === need) paths.push(stack.slice(j)); });
        total += cnt;
        snap({ cur: id, look: need, paths, note: `At <b>${v}</b>: prefix cur = ${cur - v} + ${v} = ${cur}. A downward path ending here sums to target iff some prefix <i>above</i> equals cur − target = ${cur} − ${tgt} = <b>${need}</b>. seen[${need}] = ${cnt}${cnt ? `: ${cnt} path${cnt > 1 ? "s" : ""} found (purple). total = ${total}` : ", nothing ends here"}.`, line: [4, 5], vars: { node: v, cur, "cur-target": need, found: cnt, total } });
        seen.set(cur, (seen.get(cur) || 0) + 1);
        snap({ cur: id, add: cur, note: `Record cur = ${cur}: seen[${cur}] = ${seen.get(cur)}. Every node below ${v} may start a path just after ${v}, and the map now offers that option.`, line: 6, vars: { node: v, cur, total } });
        go(T.L[id], cur); go(T.R[id], cur);
        seen.set(cur, seen.get(cur) - 1);
        stack.pop(); done.add(id);
        snap({ cur: id, del: cur, note: `Leaving ${v}: seen[${cur}] -= 1 → ${seen.get(cur)}. Its prefix is not "above" the nodes in other branches; leaving it in would count paths that jump between branches.`, line: 8, vars: { node: v, cur, total } });
        if (seen.get(cur) === 0) seen.delete(cur);
        return cnt;
      };
      go(0, 0);
      snap({ note: `Total: <b>${total}</b> downward path${total === 1 ? "" : "s"} sum to ${tgt}. Each node does O(1) map work: O(n) instead of the O(n·h) "start a search at every node" approach.`, line: 10, vars: { total } });
      return fr;
    },
    render: (f) => {
      const T = f.T, onPath = new Set(f.stack), pp = new Set((f.paths || []).flat());
      const pe = new Set(); for (const p of f.paths || []) for (let i = 1; i < p.length; i++) pe.add(`${p[i - 1]}-${p[i]}`);
      const tree = drawTree(T, {
        sub: (id) => (onPath.has(id) ? `P=${f.prefix[id]}` : undefined),
        cls: (id) => (id === f.cur ? "active" : pp.has(id) ? "path" : onPath.has(id) ? "visit" : f.done.has(id) ? "done" : ""),
        ecls: (u, v) => (pe.has(`${u}-${v}`) ? "path" : onPath.has(u) && onPath.has(v) ? "active" : ""),
        caption: "P = prefix sum from the root, shown for the current root path",
      });
      const keys = f.seen.map(([k]) => k), cnts = f.seen.map(([, c]) => c);
      const map = Viz.grid([keys, cnts], {
        label: "seen: prefix sum → count (current root path only)",
        rowLabels: ["prefix", "count"],
        cls: (r, c) => { const k = keys[c]; return k === f.look ? (cnts[c] ? "path" : "visit") : k === f.add ? "active" : k === f.del ? "bad" : ""; },
      });
      const miss = f.look !== undefined && !keys.includes(f.look) ? `<div class="tp-note">looked up ${esc(f.look)}: not in the map</div>` : "";
      return Viz.row(tree, col(map, miss, answerBox("total", f.total, "done")));
    },
  }));

  /* =====================================================================
     7. Serialize / deserialize: preorder with null markers
     ===================================================================== */
  Viz.register(P("serialize"), (el, opts) => Viz.player(el, {
    title: "Serialize with preorder + null markers, then rebuild from the tokens alone",
    tag: "ENCODE · DECODE",
    legend: [["active", "current node / token"], ["done", "written or rebuilt"], ["dim", "# null marker"]],
    codeLang: "python",
    code: [
      "def serialize(root):",
      "    out = []",
      "    def walk(node):               # preorder: node, left, right",
      "        if node is None: out.append(\"#\"); return",
      "        out.append(str(node.val))",
      "        walk(node.left); walk(node.right)",
      "    walk(root); return \",\".join(out)",
      "def deserialize(data):",
      "    tokens = iter(data.split(\",\"))",
      "    def build():                  # consumes exactly one subtree",
      "        tok = next(tokens)",
      "        if tok == \"#\": return None",
      "        node = TreeNode(int(tok))",
      "        node.left = build(); node.right = build()",
      "        return node",
      "    return build()",
    ],
    inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "1,2,3,null,null,4,5", width: 230 }],
    random: () => ({ t: randomTree(Viz.rand(4, 8), 3, () => Viz.rand(1, 9)) }),
    build: ({ t }) => {
      const T = parseTree(t, { maxN: 9, maxDepth: 4 });
      let g = 0;
      const ghost = {}; // ghost id -> parent id
      const kids = (id) => {
        if (typeof id === "string") return [];
        return [T.L[id], T.R[id]].map((c) => { if (c !== null) return c; const gid = `g${g++}`; ghost[gid] = id; return gid; });
      };
      const kidMemo = new Map();
      const K = (id) => { if (!kidMemo.has(id)) kidMemo.set(id, kids(id)); return kidMemo.get(id); };
      const lay = Viz.layoutTree(0, K, (id) => (typeof id === "string" ? "#" : String(T.val[id])), { dx: 40, dy: 58 });
      const fr = [], tokensOut = [], shown = new Set(), written = new Set();
      const snap = (o) => fr.push({ T, lay, tokens: [...tokensOut], shown: new Set(shown), written: new Set(written), ...o });
      const walk = (id) => {
        if (typeof id === "string") { tokensOut.push("#"); written.add(id); snap({ phase: "ser", cur: id, note: `Empty child of ${T.val[ghost[id]]}: write <b>#</b>. Without these markers the shape would be ambiguous: "1,2,3" fits several different trees.`, line: 3, vars: { out: tokensOut.join(",") } }); return; }
        tokensOut.push(String(T.val[id])); written.add(id);
        snap({ phase: "ser", cur: id, note: `Preorder visits <b>${T.val[id]}</b> before its children: write it, then serialize the left subtree, then the right.`, line: [4, 5], vars: { out: tokensOut.join(",") } });
        const [l, r] = K(id); walk(l); walk(r);
      };
      walk(0);
      snap({ phase: "ser", note: `Serialized: <b>${tokensOut.join(",")}</b>. ${T.n} values + ${T.n + 1} markers: a tree with n nodes always has n + 1 empty child slots.`, line: 6, vars: { out: tokensOut.join(",") } });
      written.clear();
      let i = 0;
      const build = (id) => {
        const tok = tokensOut[i];
        shown.add(id);
        if (typeof id === "string") { snap({ phase: "de", cur: id, ti: i, note: `Token ${i} is <b>#</b>: this slot is empty. Return None; the caller moves on to its next child.`, line: [10, 11], vars: { i, tok } }); i++; return; }
        snap({ phase: "de", cur: id, ti: i, note: `Token ${i} is <b>${tok}</b>: create the node. Preorder guarantees the next tokens describe its left subtree completely, then its right subtree.`, line: [10, 12], vars: { i, tok } });
        i++;
        const [l, r] = K(id); build(l); build(r);
        written.add(id);
        snap({ phase: "de", cur: id, ti: i - 1, note: `Both subtrees of ${T.val[id]} are complete; return it to its parent.`, line: [13, 14], vars: { i } });
      };
      build(0);
      snap({ phase: "de", note: `Rebuilt the same tree from tokens alone, consuming each token exactly once: O(n) both ways. The recursion itself knows where each subtree ends, so no lengths or brackets are needed.`, line: 15, vars: { i } });
      return fr;
    },
    render: (f) => {
      const T = f.T, ser = f.phase === "ser";
      const vis = (id) => ser || f.shown.has(isNaN(Number(id)) ? id : Number(id));
      const nodes = f.lay.nodes.map((nd) => ({ ...nd }));
      const g = Viz.graph({ nodes, edges: f.lay.edges }, {
        r: 17,
        label: ser ? "phase 1: serialize (preorder walk)" : "phase 2: deserialize (only the tokens are known)",
        nodeCls: (id) => {
          const key = isNaN(Number(id)) ? id : Number(id), ghost = typeof key === "string";
          if (!vis(id)) return "tp-hide";
          const base = ghost ? "tp-null " : "";
          if (key === f.cur) return base + "active";
          return base + (f.written.has(key) ? (ghost ? "" : "done") : "");
        },
        edgeCls: (k) => { const v = k.split("-")[1]; return vis(v) ? (v.startsWith("g") ? "tp-nulledge" : "") : "tp-hide"; },
      });
      const toks = Viz.array(f.tokens, { label: ser ? "out" : "tokens", ptrs: ser ? {} : { i: f.ti }, cls: (i, v) => (!ser && i === f.ti ? "active" : !ser && f.ti !== undefined && i < f.ti ? "done" : v === "#" ? "dim" : ser && i === f.tokens.length - 1 ? "active" : "") });
      return `<div class="tp-col">${g}${toks}</div>`;
    },
  }));

  /* =====================================================================
     8. Subtree identity: canonical ids (find duplicate subtrees)
     ===================================================================== */
  Viz.register(P("hash"), (el, opts) => Viz.player(el, {
    title: "Give every distinct subtree a small id: (left id, value, right id)",
    tag: "TREE HASHING",
    legend: [["active", "current node"], ["visit", "waiting for children"], ["done", "has an id"], ["path", "duplicated shape"]],
    codeLang: "python",
    code: [
      "def find_duplicate_subtrees(root):",
      "    ids, seen, res = {}, {}, []",
      "    def uid(node):                 # same shape + values <=> same id",
      "        if node is None: return 0",
      "        key = (uid(node.left), node.val, uid(node.right))",
      "        if key not in ids: ids[key] = len(ids) + 1",
      "        i = ids[key]",
      "        seen[i] = seen.get(i, 0) + 1",
      "        if seen[i] == 2: res.append(node)   # report each shape once",
      "        return i",
      "    uid(root)",
      "    return res",
    ],
    inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "1,2,3,4,null,2,4,null,null,4", width: 260 }],
    random: () => ({ t: randomTree(Viz.rand(8, 13), 3, () => Viz.rand(1, 3)) }),
    build: ({ t }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const ids = new Map(), seen = new Map(), res = [], fr = [], st = {}, nid = {};
      const snap = (o) => fr.push({ T, st: { ...st }, nid: { ...nid }, table: [...ids.entries()].map(([k, i]) => [k, i, seen.get(i) || 0]), res: [...res], ...o });
      const go = (id) => {
        if (id === null) return 0;
        st[id] = "active";
        snap({ cur: id, note: `uid(<b>${T.val[id]}</b>): a subtree's identity depends on its children's identities, so compute those first (postorder).`, line: [2, 4], vars: { node: T.val[id] } });
        st[id] = "visit";
        const l = go(T.L[id]); st[id] = "active";
        const r = go(T.R[id]);
        const key = `(${l}, ${T.val[id]}, ${r})`;
        const isNew = !ids.has(key);
        if (isNew) ids.set(key, ids.size + 1);
        const i = ids.get(key);
        seen.set(i, (seen.get(i) || 0) + 1);
        nid[id] = i; st[id] = "done";
        const dup = seen.get(i) === 2;
        if (dup) res.push(id);
        snap({ cur: id, key, note: `Key for ${T.val[id]} = (left id ${l}, value ${T.val[id]}, right id ${r}) = ${key}. ${isNew ? `New shape: give it id <b>${i}</b>.` : `Seen before: it reuses id <b>${i}</b>.`} seen[${i}] = ${seen.get(i)}${dup ? `: <b>second time</b>, so report this subtree.` : "."} The key is 3 small numbers, never the whole subtree, so each step is O(1).`, line: dup ? [4, 5, 6, 7, 8] : [4, 5, 6, 7], vars: { node: T.val[id], key, id: i, seen: seen.get(i) } });
        return i;
      };
      go(0);
      snap({ note: res.length ? `Duplicates: ${res.map((x) => `the subtree rooted at a ${T.val[x]} (id ${nid[x]})`).join("; ")}. Equal ids ⇔ identical subtrees, exactly, with no hash collisions: the ids are assigned by a dictionary.` : "No two subtrees are identical.", line: 11, vars: { distinct: ids.size, duplicates: res.length } });
      return fr;
    },
    render: (f) => {
      const T = f.T;
      const dupIds = new Set(f.table.filter(([, , c]) => c >= 2).map(([, i]) => i));
      const tree = drawTree(T, {
        sub: (id) => (f.nid[id] !== undefined ? `id ${f.nid[id]}` : undefined),
        cls: (id) => (id === f.cur ? "active" : f.nid[id] !== undefined && dupIds.has(f.nid[id]) ? "path" : f.st[id] || ""),
        ecls: (u, v) => (f.nid[v] !== undefined && dupIds.has(f.nid[v]) && f.nid[u] !== undefined && dupIds.has(f.nid[u]) ? "path" : f.nid[v] !== undefined ? "done" : ""),
        caption: "under a node: its subtree id (0 = empty)",
      });
      const rows = f.table.map(([k, i, c]) => [k, i, c]);
      const tbl = rows.length ? Viz.grid(rows, {
        label: "ids: key → id, how many times seen",
        colLabels: ["(left, val, right)", "id", "seen"],
        cls: (r, c) => (rows[r][0] === f.key ? "active" : rows[r][2] >= 2 ? "path" : ""),
      }) : answerBox("ids", "{ }");
      return Viz.row(tree, tbl);
    },
  }));

  /* =====================================================================
     9. Count complete tree nodes in O(log^2 n)
     ===================================================================== */
  Viz.register(P("complete"), (el, opts) => Viz.player(el, {
    title: "Count nodes of a complete tree without visiting most of them",
    tag: "O(log² n)",
    legend: [["active", "current root"], ["visit", "walked on a spine"], ["done", "counted by formula 2^h − 1"], ["bad", "unequal spines: recurse"]],
    codeLang: "python",
    code: [
      "def count_nodes(root):",
      "    if root is None: return 0",
      "    lh, node = 0, root",
      "    while node: lh += 1; node = node.left    # down the left edge",
      "    rh, node = 0, root",
      "    while node: rh += 1; node = node.right   # down the right edge",
      "    if lh == rh:                # perfect subtree: never look inside",
      "        return (1 << lh) - 1",
      "    return 1 + count_nodes(root.left) + count_nodes(root.right)",
    ],
    inputs: [{ key: "n", label: "nodes in the complete tree (1–31)", value: opts.n || "21", width: 90 }],
    random: () => ({ n: String(Viz.rand(5, 31)) }),
    build: ({ n }) => {
      const N = Viz.parse.int(n, { min: 1, max: 31 });
      const kid = (i) => [2 * i <= N ? 2 * i : null, 2 * i + 1 <= N ? 2 * i + 1 : null];
      const lay = Viz.layoutTree(1, kid, (i) => String(i), { dx: 28, dy: 56 });
      const fr = [], st = {};
      let touched = 0;
      const snap = (o) => fr.push({ lay, st: { ...st }, touched, N, ...o });
      const sub = (i, out = []) => { if (i > N) return out; out.push(i); sub(2 * i, out); sub(2 * i + 1, out); return out; };
      const go = (i) => {
        if (i > N) return 0;
        st[i] = "active";
        const left = [], right = [];
        for (let x = i; x <= N; x = 2 * x) left.push(x);
        for (let x = i; x <= N; x = 2 * x + 1) right.push(x);
        touched += left.length + right.length - 1;
        const lh = left.length, rh = right.length;
        snap({ cur: i, spines: [...left, ...right], note: `At node ${i}: walk its left edge (${lh} node${lh > 1 ? "s" : ""}) and its right edge (${rh} node${rh > 1 ? "s" : ""}). In a complete tree the left edge is always the deepest path.`, line: [2, 3, 4, 5], vars: { node: i, lh, rh, touched } });
        if (lh === rh) {
          for (const x of sub(i)) st[x] = "done";
          snap({ cur: i, note: `lh == rh == ${lh}: the last level under ${i} is full, so this subtree is <b>perfect</b> and has 2<sup>${lh}</sup> − 1 = <b>${(1 << lh) - 1}</b> nodes. None of them needs a visit.`, line: [6, 7], vars: { node: i, lh, rh, returns: (1 << lh) - 1, touched } });
          return (1 << lh) - 1;
        }
        st[i] = "bad";
        snap({ cur: i, note: `lh = ${lh} ≠ rh = ${rh}: the last level under ${i} is only partly filled. Count ${i} itself and recurse into both children. At least one of them is perfect and will return after its two spine walks.`, line: 8, vars: { node: i, lh, rh, touched } });
        const total = 1 + go(2 * i) + go(2 * i + 1);
        return total;
      };
      const c = go(1);
      snap({ note: `count = <b>${c}</b>. Spine nodes walked: ${touched} versus n = ${N}. Only one root-to-leaf path ever recurses (the one leading to the last node), and each level costs a spine walk of O(log n): O(log² n) total.`, line: 8, vars: { count: c, touched, n: N } });
      return fr;
    },
    render: (f) => {
      const sp = new Set(f.spines || []);
      return Viz.graph({ nodes: f.lay.nodes, edges: f.lay.edges }, {
        r: 13,
        label: `complete tree, nodes numbered in level order (n = ${f.N})`,
        nodeCls: (id) => { id = Number(id); return id === f.cur && !f.st[id] ? "active" : f.st[id] === "done" ? "done" : sp.has(id) ? "visit" : f.st[id] || ""; },
        edgeCls: (k) => { const [u, v] = k.split("-").map(Number); return f.st[v] === "done" ? "done" : sp.has(u) && sp.has(v) ? "visit" : ""; },
      });
    },
  }));

  /* =====================================================================
     10. Rerooting: sum of distances in a tree
     ===================================================================== */
  Viz.register(P("reroot"), (el, opts) => Viz.player(el, {
    title: "Rerooting: every node's answer from its parent's, in O(1) per edge",
    tag: "TWO PASSES",
    legend: [["active", "current node"], ["done", "1 step closer after the move"], ["bad", "1 step farther after the move"], ["visit", "pass-1 values known"], ["path", "answer final"]],
    codeLang: "python",
    code: [
      "def sum_of_distances(n, edges):",
      "    adj = build_adjacency(n, edges)",
      "    size, down, ans = [1] * n, [0] * n, [0] * n",
      "    def post(v, p):            # pass 1: look DOWN from root 0",
      "        for c in adj[v]:",
      "            if c != p:",
      "                post(c, v)",
      "                size[v] += size[c]",
      "                down[v] += down[c] + size[c]   # +1 edge each",
      "    def pre(v, p):             # pass 2: move the root across each edge",
      "        for c in adj[v]:",
      "            if c != p:",
      "                ans[c] = ans[v] - size[c] + (n - size[c])",
      "                pre(c, v)",
      "    post(0, -1); ans[0] = down[0]; pre(0, -1)",
      "    return ans",
    ],
    inputs: [{ key: "e", label: "edges (rooted at 0)", value: opts.e || "0-1, 0-2, 1-3, 1-4, 2-5, 4-6, 4-7, 5-8, 5-9", width: 320 }],
    random: () => ({ e: randomEdges(Viz.rand(6, 12), 4) }),
    build: ({ e }) => {
      const G = parseEdges(e, { maxN: 14 });
      const n = G.n;
      const lay = Viz.layoutTree(0, (x) => G.kids[x], (x) => String(x), { dx: 56, dy: 76 });
      const size = Array(n).fill(1), down = Array(n).fill(0), ans = Array(n).fill(null), known = new Set(), fin = new Set();
      const fr = [];
      const snap = (o) => fr.push({ G, lay, size: [...size], down: [...down], ans: [...ans], known: new Set(known), fin: new Set(fin), ...o });
      const subOf = (v, out = new Set()) => { out.add(v); for (const c of G.kids[v]) subOf(c, out); return out; };
      snap({ note: `Goal: for every node, the sum of its distances to all ${n} nodes. BFS from each node is O(n²). Rerooting does it in two O(n) passes. Pass 1 roots the tree at 0 and summarises each subtree.`, line: [0, 2], vars: { n } });
      const post = (v) => {
        for (const c of G.kids[v]) {
          post(c);
          size[v] += size[c]; down[v] += down[c] + size[c];
        }
        known.add(v);
        snap({ cur: v, note: G.kids[v].length ? `Node ${v}: size = 1 + ${G.kids[v].map((c) => size[c]).join(" + ")} = <b>${size[v]}</b>. down = ${G.kids[v].map((c) => `(${down[c]} + ${size[c]})`).join(" + ")} = <b>${down[v]}</b>: each child's own total, plus one extra edge for each of its ${G.kids[v].map((c) => size[c]).join("/")} nodes.` : `Leaf ${v}: size 1, down 0.`, line: [6, 7, 8], vars: { v, "size[v]": size[v], "down[v]": down[v] } });
      };
      post(0);
      ans[0] = down[0]; fin.add(0);
      snap({ cur: 0, note: `Node 0 is the real root, so its subtree is the whole tree: ans[0] = down[0] = <b>${ans[0]}</b>. Now push answers downward.`, line: 14, vars: { "ans[0]": ans[0] } });
      const pre = (v) => {
        for (const c of G.kids[v]) {
          const closer = subOf(c);
          ans[c] = ans[v] - size[c] + (n - size[c]);
          snap({ cur: c, from: v, closer, note: `Move the root from ${v} to ${c} across one edge. The ${size[c]} nodes in c's subtree (green) each get <b>1 closer</b>; the other ${n - size[c]} nodes (red) each get <b>1 farther</b>. ans[${c}] = ${ans[v]} − ${size[c]} + ${n - size[c]} = <b>${ans[c]}</b>.`, line: [12], vars: { v, c, "size[c]": size[c], "n-size[c]": n - size[c], "ans[c]": ans[c] } });
          fin.add(c);
          pre(c);
        }
      };
      pre(0);
      const bfs = (s) => { const d = Array(n).fill(-1); d[s] = 0; const q = [s]; for (let i = 0; i < q.length; i++) for (const x of G.adj[q[i]]) if (d[x] < 0) { d[x] = d[q[i]] + 1; q.push(x); } return d.reduce((a, b) => a + b, 0); };
      const ok = ans.every((a, v) => a === bfs(v));
      snap({ note: `All answers: [${ans.join(", ")}]. ${ok ? "They match a brute-force BFS from every node." : "MISMATCH with brute force."} Total work O(n): one post-order pass, one pre-order pass, O(1) per edge.`, line: 15, vars: { ans: `[${ans.join(",")}]` } });
      return fr;
    },
    render: (f) => {
      const G = f.G;
      const nodes = f.lay.nodes.map((nd) => ({ ...nd, sub: f.known.has(nd.id) ? `s${f.size[nd.id]} d${f.down[nd.id]}` : undefined, top: f.ans[nd.id] !== null ? `ans ${f.ans[nd.id]}` : undefined }));
      return Viz.graph({ nodes, edges: f.lay.edges }, {
        r: 18,
        label: "below: size and down (pass 1) · above: final answer (pass 2)",
        nodeCls: (id) => { id = Number(id); if (f.closer) return id === f.cur ? "active" : f.closer.has(id) ? "done" : "bad"; return id === f.cur ? "active" : f.fin.has(id) ? "path" : f.known.has(id) ? "visit" : ""; },
        edgeCls: (k) => { const [u, v] = k.split("-").map(Number); return f.closer && u === f.from && v === f.cur ? "active" : ""; },
      });
    },
  }));
})();
