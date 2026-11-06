/* Visualizers for Backtracking. Every registered name starts with "backtracking-".
 * Every frame is recorded while the real search runs: nothing is hard-coded. */
(() => {
  const esc = Viz.esc;
  const hlPy = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines in place when the mode changes (blank lines are hidden). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hlPy(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const compact = (a) => (!a.length ? "∅" : a.every((x) => String(x).length === 1) ? a.join("") : a.join(","));
  const list = (a) => `[${a.join(", ")}]`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pathHtml = (p, label = "path (one shared list)") => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span>${p.length ? `<div class="bt-path">${p.map((v) => `<span class="v-item visit">${esc(v)}</span>`).join("")}</div>` : '<div class="bt-empty">[ ]</div>'}</div>`;
  const resHtml = (rs, label = "res") => `<div class="v-labeled bt-resbox"><span class="v-caption">${esc(label)}: ${rs.length}</span><div class="bt-res">${rs.length ? rs.map((r, i) => `<span class="v-item ${r.c}${i === rs.length - 1 ? " bt-new" : ""}">${esc(r.t)}</span>`).join("") : '<span class="bt-none">none yet</span>'}</div></div>`;

  /* ---------- Decision-tree recorder ----------
   * enter(label, edge) creates a child of the current node and descends; leave() returns.
   * prune(...) draws a child that is cut immediately (red for one frame, then greyed).
   * snap(...) stores a frame: which nodes exist, the current path, node classes and the state panel. */
  const MAX_NODES = 150, MAX_FRAMES = 900;
  function recorder() {
    const nodes = [], persist = [], path = [], frames = [], results = [];
    let panel = () => "";
    const H = {
      nodes, path, results, frames, pruned: 0,
      add(label, edge, cls = "") {
        if (nodes.length >= MAX_NODES) throw new Error("This input grows a tree too big to draw. Use fewer or smaller values.");
        const parent = path.length ? path[path.length - 1] : null;
        nodes.push({ id: nodes.length, parent, label: String(label), edge: edge == null ? "" : String(edge), depth: parent === null ? 0 : nodes[parent].depth + 1 });
        persist.push(cls);
        return nodes.length - 1;
      },
      enter(label, edge) { const id = H.add(label, edge); path.push(id); return id; },
      leave() { path.pop(); },
      top: () => path[path.length - 1],
      mark(cls, id = H.top()) { persist[id] = cls; },
      prune(label, edge, note, line, vars) { const id = H.add(label, edge, "bad"); H.pruned++; H.snap(note, line, vars); persist[id] = "dim"; return id; },
      result(t, c = "done") { results.push({ t, c }); persist[H.top()] = c; },
      panel(fn) { panel = fn; },
      snap(note, line, vars = {}) {
        if (frames.length >= MAX_FRAMES) throw new Error("Too many steps to show. Use a smaller input.");
        frames.push({ n: nodes.length, path: path.slice(), cls: persist.slice(), note, line, vars, panel: panel() });
      },
    };
    return H;
  }

  const DY = 54, NH = 24;
  function layoutTree(nodes) {
    const kids = nodes.map(() => []);
    nodes.forEach((nd) => { if (nd.parent !== null) kids[nd.parent].push(nd.id); });
    const w = nodes.map((nd) => Math.max(28, nd.label.length * 7.4 + 14));
    const slot = nodes.map((nd, i) => Math.max(w[i], nd.edge.length * 6.6 + 6));
    const x = []; let cursor = 0, depth = 0;
    const walk = (id) => {
      depth = Math.max(depth, nodes[id].depth);
      if (!kids[id].length) { x[id] = cursor + slot[id] / 2; cursor += slot[id] + 8; return; }
      kids[id].forEach(walk);
      x[id] = (x[kids[id][0]] + x[kids[id][kids[id].length - 1]]) / 2;
    };
    if (nodes.length) walk(0);
    return { x, w, width: Math.max(0, cursor - 8), depth };
  }

  function treeSvg(T, f) {
    const { nodes, lay } = T;
    const left = T.depthLabel ? 64 : 6;
    const W = Math.ceil(lay.width + left + 8), H = lay.depth * DY + NH + 12;
    const X = (id) => left + lay.x[id], Y = (id) => 6 + nodes[id].depth * DY + NH / 2;
    const pathSet = new Set(f.path), top = f.path[f.path.length - 1];
    const nc = (id) => {
      if (id >= f.n) return "bt-hide";
      const p = f.cls[id];
      if (id === top) return `${p && p !== "dim" ? p : "active"} bt-cur`;
      if (pathSet.has(id)) return "visit";
      return p;
    };
    let edges = "", labels = "", boxes = "", rows = "";
    if (T.depthLabel) for (let d = 0; d <= lay.depth; d++) {
      const t = T.depthLabel(d);
      if (t) rows += `<text class="bt-dl" x="4" y="${6 + d * DY + NH / 2}">${esc(t)}</text>`;
    }
    for (const nd of nodes) {
      if (nd.parent === null) continue;
      const u = nd.parent, v = nd.id;
      const c = v >= f.n ? "bt-hide" : pathSet.has(v) ? "active" : f.cls[v] === "bad" ? "bad" : f.cls[v] === "dim" ? "dim" : "";
      const x1 = X(u), y1 = Y(u) + NH / 2, x2 = X(v), y2 = Y(v) - NH / 2;
      edges += `<line class="bt-e ${c}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
      if (nd.edge) {
        // Push each label to its child's side of the parent so sibling labels never overlap, but keep it inside the child's slot.
        const tw = nd.edge.length * 6.4, half = Math.max(lay.w[v], nd.edge.length * 6.6 + 6) / 2;
        let lx = (x1 + x2) / 2;
        if (x2 < x1 - 1) lx = Math.max(x2 - half + tw / 2, lx - 2 - tw / 2);
        else if (x2 > x1 + 1) lx = Math.min(x2 + half - tw / 2, lx + 2 + tw / 2);
        labels += `<text class="bt-el ${c}" x="${lx}" y="${(y1 + y2) / 2}">${esc(nd.edge)}</text>`;
      }
    }
    for (const nd of nodes) {
      const c = nc(nd.id), w = lay.w[nd.id];
      boxes += `<g class="bt-n ${c}"><rect x="${X(nd.id) - w / 2}" y="${Y(nd.id) - NH / 2}" width="${w}" height="${NH}" rx="7"/><text x="${X(nd.id)}" y="${Y(nd.id)}">${esc(nd.label)}</text></g>`;
    }
    return `<div class="v-labeled bt-treewrap"><span class="v-caption">${esc(T.caption)}</span><svg class="bt-tree" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(T.caption)}">${rows}${edges}${labels}${boxes}</svg></div>`;
  }

  /* A player that runs one of several modes through the recorder and draws the decision tree above the state panel. */
  function treePlayer(el, opts, cfg) {
    const names = Object.keys(cfg.modes);
    const start = names.includes(opts && opts.mode) ? opts.mode : names[0];
    const maxLines = Math.max(...names.map((n) => cfg.modes[n].code.length));
    const curMode = () => (el.querySelector('select[name="mode"]') || {}).value || start;
    const p = Viz.player(el, {
      title: cfg.title, tag: cfg.tag || "DECISION TREE",
      legend: cfg.legend || [["active", "current node"], ["visit", "on the path (ancestors)"], ["done", "recorded answer"], ["bad", "being pruned"], ["dim", "pruned: never explored"]],
      codeLang: "python",
      code: Array(maxLines).fill(""),
      inputs: [
        { key: "mode", label: "problem", type: "select", value: start, options: names },
        ...cfg.inputs.map((inp) => ({ ...inp, value: (opts && opts[inp.key]) ?? cfg.modes[start].defaults[inp.key] ?? "" })),
      ],
      random: () => cfg.modes[curMode()].random(),
      build: (vals) => {
        const M = cfg.modes[vals.mode] || cfg.modes[start];
        setCode(el, M.code);
        const H = recorder();
        const ctx = M.run(vals, H) || {};
        const lay = layoutTree(H.nodes);
        if (lay.width > 1250) throw new Error("This input draws a tree too wide to read. Use a smaller input.");
        const T = { nodes: H.nodes, lay, caption: M.caption, depthLabel: M.depthLabel ? (d) => M.depthLabel(d, ctx) : null };
        return H.frames.map((f) => ({ ...f, T }));
      },
      render: (f) => `<div class="bt-col">${treeSvg(f.T, f)}${f.panel}</div>`,
    });
    const sel = el.querySelector('select[name="mode"]');
    if (sel) sel.addEventListener("change", () => {
      const M = cfg.modes[sel.value], form = el.querySelector(".viz-inputs");
      for (const inp of cfg.inputs) if (form.elements[inp.key]) form.elements[inp.key].value = M.defaults[inp.key] ?? "";
      p.rebuild(Object.fromEntries(new FormData(form).entries()));
    });
    return p;
  }

  /* ================= 1. The three families ================= */
  const parseNums = (s, max, what = "nums") => {
    const a = Viz.parse.ints(s, { min: 1, max });
    if (a.some((x) => !Number.isInteger(x) || x < -9 || x > 20)) throw new Error(`${what}: use whole numbers from -9 to 20.`);
    return a;
  };
  const FAMILIES = {
    "subsets: take / skip": {
      defaults: { a: "1,2,3", b: "" },
      caption: "node = the subset built so far · left edge = take, right edge = skip",
      depthLabel: (d, c) => (d <= c.n ? `i = ${d}` : ""),
      random: () => ({ a: Viz.randInts(Viz.rand(2, 4), 1, 9).join(","), b: "" }),
      code: ["def subsets(nums):", "    res, path = [], []", "    def dfs(i):", "        if i == len(nums):", "            res.append(path[:])    # leaf: one subset (copy!)", "            return", "        path.append(nums[i])       # choose: take nums[i]", "        dfs(i + 1)                 # explore", "        path.pop()                 # un-choose", "        dfs(i + 1)                 # explore: skip nums[i]", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const nums = parseNums(a, 4), n = nums.length, path = [];
        H.panel(() => Viz.row(pathHtml(path), resHtml(H.results)));
        const V = (i) => ({ i, path: list(path), "res size": H.results.length });
        H.enter("∅");
        H.snap(`Start at the root with an empty <b>path</b>. Level i decides nums[i]: the <b>left</b> child takes it, the <b>right</b> child skips it. Every root-to-leaf path is one subset.`, 10, V(0));
        const dfs = (i) => {
          if (i === n) { H.result(list(path)); H.snap(`All ${n} elements are decided, so this leaf is the subset <b>${list(path)}</b>. Append a <b>copy</b>: the same <code>path</code> list keeps changing after this.`, [3, 4], V(i)); return; }
          path.push(nums[i]); H.enter(compact(path), `+${nums[i]}`);
          H.snap(`<b>Choose</b>: take nums[${i}] = ${nums[i]}, so path = ${list(path)}. Explore every subset that contains this choice before trying the other branch.`, [6, 7], V(i));
          dfs(i + 1);
          path.pop(); H.leave();
          H.snap(`<b>Un-choose</b>: pop ${nums[i]}. path is back to ${list(path)}, exactly what it was before the choice, so the skip branch starts clean.`, 8, V(i));
          H.enter(compact(path), `skip ${nums[i]}`);
          H.snap(`Explore the other branch: <b>skip</b> nums[${i}] = ${nums[i]}. Nothing was added, so there is nothing to undo afterwards.`, 9, V(i));
          dfs(i + 1);
          H.leave();
        };
        dfs(0);
        H.snap(`Done: <b>${H.results.length}</b> subsets = 2<sup>${n}</sup>. The tree has ${H.nodes.length} nodes and every leaf is an answer, so nothing can be pruned: the output itself is exponential, O(n · 2<sup>n</sup>) with the copies.`, 11, V(n));
        return { n };
      },
    },
    "subsets: for-loop start index": {
      defaults: { a: "1,2,3", b: "" },
      caption: "node = the subset built so far (every node is an answer) · edge = the element added",
      depthLabel: (d) => `size ${d}`,
      random: () => ({ a: Viz.randInts(Viz.rand(2, 4), 1, 9).join(","), b: "" }),
      code: ["def subsets(nums):", "    res, path = [], []", "    def dfs(start):", "        res.append(path[:])        # every node is a subset", "        for i in range(start, len(nums)):", "            path.append(nums[i])   # choose", "            dfs(i + 1)             # explore: only later indices", "            path.pop()             # un-choose", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const nums = parseNums(a, 4), n = nums.length, path = [];
        H.panel(() => Viz.row(pathHtml(path), resHtml(H.results)));
        const V = (start, i) => ({ start, i: i ?? "·", path: list(path), "res size": H.results.length });
        H.enter("∅");
        const dfs = (start) => {
          H.result(list(path));
          H.snap(`Every node is a subset, so record ${list(path)} on <b>entry</b>. Children may only add indices ≥ ${start}: that is what stops [2,1] from appearing after [1,2].`, 3, V(start));
          for (let i = start; i < n; i++) {
            path.push(nums[i]); H.enter(compact(path), `+${nums[i]}`);
            H.snap(`<b>Choose</b> nums[${i}] = ${nums[i]}. The child continues from index ${i + 1}, never looking back.`, [5, 6], V(start, i));
            dfs(i + 1);
            path.pop(); H.leave();
            H.snap(`<b>Un-choose</b> ${nums[i]}: path = ${list(path)}. ${i + 1 < n ? `The loop moves on to nums[${i + 1}] = ${nums[i + 1]}.` : "The loop is exhausted: return to the parent."}`, 7, V(start, i));
          }
        };
        dfs(0);
        H.snap(`Done: <b>${H.results.length}</b> subsets from ${H.nodes.length} nodes: one node per subset, no wasted leaves. This shape is the one that extends to combinations and to duplicate skipping.`, 9, V(n));
        return { n };
      },
    },
    "permutations: used[]": {
      defaults: { a: "1,2,3", b: "" },
      caption: "node = the permutation prefix · edge = the value appended",
      depthLabel: (d) => `len ${d}`,
      random: () => ({ a: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Viz.rand(2, 3)).join(","), b: "" }),
      code: ["def permute(nums):", "    res, path = [], []", "    used = [False] * len(nums)", "    def dfs():", "        if len(path) == len(nums):", "            res.append(path[:]); return", "        for i in range(len(nums)):", "            if used[i]: continue          # already in path", "            used[i] = True; path.append(nums[i])   # choose", "            dfs()                                  # explore", "            used[i] = False; path.pop()            # un-choose", "    dfs()", "    return res"],
      run({ a }, H) {
        const nums = parseNums(a, 4), n = nums.length, path = [], used = Array(n).fill(false);
        let flash = -1;
        H.panel(() => Viz.row(pathHtml(path), Viz.array(nums, { label: "nums (shaded = used[i] is True)", cls: (i) => (i === flash ? "bad" : used[i] ? "visit" : "") }), resHtml(H.results)));
        const V = (i) => ({ i: i ?? "·", path: list(path), used: used.map((u) => (u ? "T" : "F")).join(" ") });
        H.enter("∅");
        H.snap(`A permutation uses every value once, in any order. At each level, <b>any unused value</b> may go next, so the root has ${n} children, the next level ${n - 1}, and so on: n! leaves.`, 11, V());
        const dfs = () => {
          if (path.length === n) { H.result(list(path)); H.snap(`path holds all ${n} values: record <b>${list(path)}</b>.`, [4, 5], V()); return; }
          for (let i = 0; i < n; i++) {
            if (used[i]) { flash = i; H.snap(`i = ${i}: ${nums[i]} is already in the path (used[${i}] is True). Skip it: a value may appear only once.`, 7, V(i)); flash = -1; continue; }
            used[i] = true; path.push(nums[i]); H.enter(compact(path), `+${nums[i]}`);
            H.snap(`<b>Choose</b> ${nums[i]}: set used[${i}] and append. path = ${list(path)}.`, 8, V(i));
            dfs();
            used[i] = false; path.pop(); H.leave();
            H.snap(`<b>Un-choose</b> ${nums[i]}: clear used[${i}] and pop. It is free again for the siblings' subtrees.`, 10, V(i));
          }
        };
        dfs();
        H.snap(`Done: <b>${H.results.length}</b> permutations = ${n}!. Each leaf costs O(n) to copy, so the total is O(n · n!).`, 12, V());
        return { n };
      },
    },
    "permutations: swap in place": {
      defaults: { a: "1,2,3", b: "" },
      caption: "node = the fixed prefix nums[0..k] · edge = the swap k↔i that chose it",
      depthLabel: (d) => (d ? `k = ${d - 1}` : "start"),
      random: () => ({ a: shuffle([1, 2, 3, 4, 5, 6, 7, 8, 9]).slice(0, Viz.rand(2, 3)).join(","), b: "" }),
      code: ["def permute(nums):", "    res = []", "    def dfs(k):                     # nums[:k] is fixed", "        if k == len(nums):", "            res.append(nums[:]); return", "        for i in range(k, len(nums)):", "            nums[k], nums[i] = nums[i], nums[k]   # choose", "            dfs(k + 1)                            # explore", "            nums[k], nums[i] = nums[i], nums[k]   # un-choose", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const arr = parseNums(a, 4), n = arr.length;
        let K = 0, I = -1, swapped = false;
        H.panel(() => Viz.row(Viz.labeled("nums, permuted in place (green = fixed slots)", Viz.array(arr, { ptrs: { k: K < n ? K : null, i: I >= 0 ? I : null }, cls: (j) => (swapped && (j === K || j === I) ? "active" : j < K ? "done" : "") })), resHtml(H.results)));
        const V = (k, i) => ({ k, i: i ?? "·", nums: list(arr) });
        H.enter("∅");
        H.snap(`No <code>used[]</code> array: the array itself is the state. Slots before k are fixed; slots k..n−1 hold the values not used yet. Choosing = swapping one of them into slot k.`, 9, V(0));
        const dfs = (k) => {
          if (k === n) { K = n; I = -1; H.result(list(arr)); H.snap(`k = n: every slot is fixed. Record <b>${list(arr)}</b>.`, [3, 4], V(k)); return; }
          for (let i = k; i < n; i++) {
            [arr[k], arr[i]] = [arr[i], arr[k]]; K = k; I = i; swapped = true;
            H.enter(compact(arr.slice(0, k + 1)), k === i ? "keep" : `${k}↔${i}`);
            H.snap(k === i ? `<b>Choose</b> nums[${k}] = ${arr[k]} for slot ${k} (swap with itself).` : `<b>Choose</b>: swap slots ${k} and ${i}, bringing ${arr[k]} into slot ${k}.`, 6, V(k, i));
            swapped = false; K = k + 1; I = -1;
            dfs(k + 1);
            K = k; I = i; [arr[k], arr[i]] = [arr[i], arr[k]]; swapped = true; H.leave();
            H.snap(`<b>Un-choose</b>: swap slots ${k} and ${i} back. The array must be restored exactly, or the next iteration would swap the wrong value into slot ${k}.`, 8, V(k, i));
            swapped = false;
          }
        };
        dfs(0);
        K = 0; I = -1;
        H.snap(`Done: <b>${H.results.length}</b> permutations with O(1) extra state besides the recursion. The order differs from the used[] version, and this trick alone cannot skip duplicates in sorted order.`, 10, V(0));
        return { n };
      },
    },
    "combinations C(n, k)": {
      defaults: { a: "4", b: "2" },
      caption: "node = the combination so far · dashed = cut because too few numbers remain",
      depthLabel: (d) => `size ${d}`,
      random: () => { const n = Viz.rand(3, 5); return { a: String(n), b: String(Viz.rand(1, n - 1)) }; },
      code: ["def combine(n, k):", "    res, path = [], []", "    def dfs(start):", "        if len(path) == k:", "            res.append(path[:]); return", "        for x in range(start, n + 1):", "            if n - x + 1 < k - len(path):", "                break                # not enough numbers left", "            path.append(x)           # choose", "            dfs(x + 1)               # explore", "            path.pop()               # un-choose", "    dfs(1)", "    return res"],
      run({ a, b }, H) {
        const n = Viz.parse.int(a, { min: 1, max: 6 }), k = Viz.parse.int(b, { min: 1, max: n });
        const path = [];
        H.panel(() => Viz.row(pathHtml(path), resHtml(H.results)));
        const V = (s, x) => ({ start: s, x: x ?? "·", path: list(path), need: k - path.length });
        H.enter("∅");
        H.snap(`Choose ${k} of the numbers 1..${n}. Like subsets with a start index, but a node is an answer only at size k, and a branch dies if too few numbers remain to fill it.`, 11, V(1));
        const dfs = (s) => {
          if (path.length === k) { H.result(list(path)); H.snap(`Size ${k} reached: record <b>${list(path)}</b>.`, [3, 4], V(s)); return; }
          for (let x = s; x <= n; x++) {
            if (n - x + 1 < k - path.length) {
              H.prune("✗", `+${x}`, `Only ${n - x + 1} number${n - x + 1 === 1 ? "" : "s"} (${x}..${n}) remain but ${k - path.length} are still needed: no completion exists. <b>break</b>: larger x leaves even fewer.`, [6, 7], V(s, x));
              break;
            }
            path.push(x); H.enter(compact(path), `+${x}`);
            H.snap(`<b>Choose</b> ${x}; the child continues from ${x + 1}.`, [8, 9], V(s, x));
            dfs(x + 1);
            path.pop(); H.leave();
            H.snap(`<b>Un-choose</b> ${x}: path = ${list(path)}.`, 10, V(s, x));
          }
        };
        dfs(1);
        H.snap(`Done: <b>${H.results.length}</b> combinations = C(${n},${k}). ${H.pruned} branch${H.pruned === 1 ? " was" : "es were"} cut by the counting bound.`, 12, V(n + 1));
        return {};
      },
    },
    "combination sum (reuse allowed)": {
      defaults: { a: "2,3,6,7", b: "7" },
      caption: "node = remaining target · edge = the candidate added",
      depthLabel: (d) => `depth ${d}`,
      random: () => ({ a: shuffle([2, 3, 4, 5, 6, 7, 8]).slice(0, Viz.rand(2, 4)).sort((x, y) => x - y).join(","), b: String(Viz.rand(6, 9)) }),
      code: ["def combination_sum(cands, target):", "    cands.sort()", "    res, path = [], []", "    def dfs(start, remain):", "        if remain == 0:", "            res.append(path[:]); return", "        for i in range(start, len(cands)):", "            if cands[i] > remain:", "                break                # sorted: the rest are bigger too", "            path.append(cands[i])    # choose", "            dfs(i, remain - cands[i])   # i, not i+1: reuse", "            path.pop()               # un-choose", "    dfs(0, target)", "    return res"],
      run({ a, b }, H) {
        const c = parseNums(a, 5, "candidates").sort((x, y) => x - y), t = Viz.parse.int(b, { min: 1, max: 12 });
        if (c.some((x) => x < 1)) throw new Error("candidates must be positive (a zero or negative value never finishes).");
        if (new Set(c).size !== c.length) throw new Error("candidates must be distinct (see Combination Sum II for duplicates).");
        const path = [];
        H.panel(() => Viz.row(pathHtml(path), Viz.array(c, { label: "cands (sorted)" }), resHtml(H.results)));
        const V = (s, i, r) => ({ start: s, i: i ?? "·", remain: r, path: list(path) });
        H.enter(String(t));
        H.snap(`Sorted candidates ${list(c)}, target ${t}. Each node shows the <b>remaining</b> target. The child restarts at the same index i, which allows reuse but never goes back to smaller indices (no [3,2] after [2,3]).`, [1, 12], V(0, null, t));
        const dfs = (s, r) => {
          if (r === 0) { H.result(list(path)); H.snap(`remain = 0: record <b>${list(path)}</b>.`, [4, 5], V(s, null, r)); return; }
          for (let i = s; i < c.length; i++) {
            if (c[i] > r) {
              H.prune("✗", `+${c[i]}`, `${c[i]} > remain ${r}: it overshoots. The list is sorted, so every later candidate overshoots too. <b>break</b> cuts ${c.length - i} branch${c.length - i === 1 ? "" : "es"} at once.`, [7, 8], V(s, i, r));
              break;
            }
            path.push(c[i]); H.enter(String(r - c[i]), `+${c[i]}`);
            H.snap(`<b>Choose</b> ${c[i]}: remain ${r} → ${r - c[i]}. Recurse with start = ${i} so ${c[i]} may be used again.`, [9, 10], V(s, i, r - c[i]));
            dfs(i, r - c[i]);
            path.pop(); H.leave();
            H.snap(`<b>Un-choose</b> ${c[i]}: back to remain ${r}.`, 11, V(s, i, r));
          }
        };
        dfs(0, t);
        H.snap(`Done: <b>${H.results.length}</b> combination${H.results.length === 1 ? "" : "s"}, ${H.nodes.length - H.pruned} nodes explored, ${H.pruned} cut by the sorted <code>break</code>.`, 13, V(0, null, t));
        return {};
      },
    },
  };
  Viz.register("backtracking-families", (el, opts) => treePlayer(el, opts, {
    title: "The three families: subsets, permutations, combinations",
    modes: FAMILIES,
    inputs: [{ key: "a", label: "nums (or n)", width: 110 }, { key: "b", label: "k or target", width: 70 }],
  }));

  /* ================= 2. Duplicates ================= */
  const dupRandom = () => { const a = Viz.randInts(Viz.rand(3, 4), 1, 3).sort((x, y) => x - y); return { a: a.join(","), b: "" }; };
  const subsetsII = (skip) => ({
    defaults: { a: "1,2,2", b: "" },
    caption: skip ? "node = subset so far · dashed = a duplicate branch cut by the skip rule" : "no skip rule: red answers are repeats of an earlier answer",
    depthLabel: (d) => `size ${d}`,
    random: dupRandom,
    code: ["def subsets_with_dup(nums):", "    nums.sort()                      # equal values side by side", "    res, path = [], []", "    def dfs(start):", "        res.append(path[:])", "        for i in range(start, len(nums)):", skip ? "            if i > start and nums[i] == nums[i - 1]:" : "            # (no duplicate check: BUG)", skip ? "                continue             # same value, same level: skip" : "", "            path.append(nums[i])", "            dfs(i + 1)", "            path.pop()", "    dfs(0)", "    return res"],
    run({ a }, H) {
      const nums = parseNums(a, 5).sort((x, y) => x - y), n = nums.length, path = [], seen = new Set();
      H.panel(() => Viz.row(pathHtml(path), Viz.array(nums, { label: "nums (sorted)" }), resHtml(H.results)));
      const V = (s, i) => ({ start: s, i: i ?? "·", path: list(path) });
      H.enter("∅");
      const dfs = (s) => {
        const key = list(path);
        if (seen.has(key)) { H.result(key, "bad"); H.snap(`Recorded ${key} <b>again</b>. Two siblings with the same value grow identical subtrees, so every answer below the second one is a repeat.`, 4, V(s)); }
        else { seen.add(key); H.result(key); H.snap(`Record ${key}.`, 4, V(s)); }
        for (let i = s; i < n; i++) {
          if (skip && i > s && nums[i] === nums[i - 1]) {
            H.prune("✗", `+${nums[i]}`, `i = ${i} > start = ${s} and nums[${i}] = nums[${i - 1}] = ${nums[i]}. At <b>this level</b> the value ${nums[i]} was already tried by its left sibling, whose subtree covers every subset this branch could build. <b>continue</b>.`, [6, 7], V(s, i));
            continue;
          }
          path.push(nums[i]); H.enter(compact(path), `+${nums[i]}`);
          H.snap(skip && i === s && i > 0 && nums[i] === nums[i - 1] ? `i = start = ${i}: the first pick at this level, so taking another ${nums[i]} is allowed (this is how [${nums[i]},${nums[i]}] is built). Only <b>siblings</b> are deduplicated, not parent→child.` : `<b>Choose</b> nums[${i}] = ${nums[i]}.`, skip ? 8 : [6, 8], V(s, i));
          dfs(i + 1);
          path.pop(); H.leave();
        }
      };
      dfs(0);
      const bad = H.results.filter((r) => r.c === "bad").length;
      H.snap(skip ? `Done: <b>${H.results.length}</b> distinct subsets, no repeats, and ${H.pruned} duplicate branch${H.pruned === 1 ? "" : "es"} never explored.` : `Done: ${H.results.length} recorded, but <b>${bad}</b> are repeats. Deduplicating afterwards with a set works but wastes all that search; the skip rule never builds them.`, 11, V(n));
      return {};
    },
  });
  const permsII = (skip) => ({
    defaults: { a: "1,1,2", b: "" },
    caption: skip ? "node = prefix · dashed = a duplicate value cut at this level" : "no skip rule: red leaves repeat an earlier permutation",
    depthLabel: (d) => `len ${d}`,
    random: () => { const a = Viz.randInts(Viz.rand(3, 4), 1, 2).sort((x, y) => x - y); return { a: a.join(","), b: "" }; },
    code: ["def permute_unique(nums):", "    nums.sort()", "    res, path, used = [], [], [False] * len(nums)", "    def dfs():", "        if len(path) == len(nums):", "            res.append(path[:]); return", "        for i in range(len(nums)):", "            if used[i]: continue", skip ? "            if i > 0 and nums[i] == nums[i-1] and not used[i-1]:" : "            # (no duplicate check: BUG)", skip ? "                continue     # twin not in path: same choice at this level" : "", "            used[i] = True; path.append(nums[i])", "            dfs()", "            used[i] = False; path.pop()", "    dfs()", "    return res"],
    run({ a }, H) {
      const nums = parseNums(a, 4).sort((x, y) => x - y), n = nums.length, path = [], used = Array(n).fill(false), seen = new Set();
      let flash = -1;
      H.panel(() => Viz.row(pathHtml(path), Viz.array(nums, { label: "nums (shaded = used)", cls: (i) => (i === flash ? "bad" : used[i] ? "visit" : "") }), resHtml(H.results)));
      const V = (i) => ({ i: i ?? "·", path: list(path), used: used.map((u) => (u ? "T" : "F")).join(" ") });
      H.enter("∅");
      H.snap(`Sorted: equal values sit next to each other. Rule: among equal values, always use them <b>left to right</b>. Copy i may go into the path only if copy i−1 is already in it.`, 13, V());
      const dfs = () => {
        if (path.length === n) {
          const key = list(path);
          if (seen.has(key)) { H.result(key, "bad"); H.snap(`<b>${key}</b> again: it differs from an earlier leaf only in which copy of a value went where.`, 5, V()); }
          else { seen.add(key); H.result(key); H.snap(`Record <b>${key}</b>.`, [4, 5], V()); }
          return;
        }
        for (let i = 0; i < n; i++) {
          if (used[i]) continue;
          if (skip && i > 0 && nums[i] === nums[i - 1] && !used[i - 1]) {
            flash = i - 1;
            H.prune("✗", `+${nums[i]}`, `nums[${i}] = nums[${i - 1}] = ${nums[i]} and its left twin is <b>not</b> in the path, so it was just tried and released at this same level. Placing this copy here would rebuild the same subtree.`, [8, 9], V(i));
            flash = -1; continue;
          }
          used[i] = true; path.push(nums[i]); H.enter(compact(path), `+${nums[i]}`);
          H.snap(`<b>Choose</b> nums[${i}] = ${nums[i]}.`, 10, V(i));
          dfs();
          used[i] = false; path.pop(); H.leave();
        }
      };
      dfs();
      const bad = H.results.filter((r) => r.c === "bad").length;
      H.snap(skip ? `Done: <b>${H.results.length}</b> distinct permutations (n! divided by the factorial of each value's count).` : `Done: ${H.results.length} leaves, <b>${bad}</b> of them repeats.`, 14, V());
      return {};
    },
  });
  const DUPS = {
    "subsets II (skip rule)": subsetsII(true),
    "subsets II (no skip: bug)": subsetsII(false),
    "permutations II (skip rule)": permsII(true),
    "permutations II (no skip: bug)": permsII(false),
    "combination sum II": {
      defaults: { a: "10,1,2,7,6,1,5", b: "8" },
      caption: "node = remaining target · dashed = duplicate or too big",
      depthLabel: (d) => `depth ${d}`,
      random: () => ({ a: Viz.randInts(Viz.rand(4, 6), 1, 5).join(","), b: String(Viz.rand(5, 8)) }),
      code: ["def combination_sum2(cands, target):", "    cands.sort()", "    res, path = [], []", "    def dfs(start, remain):", "        if remain == 0:", "            res.append(path[:]); return", "        for i in range(start, len(cands)):", "            if i > start and cands[i] == cands[i - 1]:", "                continue                 # duplicate at this level", "            if cands[i] > remain:", "                break                    # sorted: rest too big", "            path.append(cands[i])", "            dfs(i + 1, remain - cands[i])  # i+1: each used once", "            path.pop()", "    dfs(0, target)", "    return res"],
      run({ a, b }, H) {
        const c = parseNums(a, 8, "candidates").sort((x, y) => x - y), t = Viz.parse.int(b, { min: 1, max: 12 });
        if (c.some((x) => x < 1)) throw new Error("candidates must be positive.");
        const path = [];
        H.panel(() => Viz.row(pathHtml(path), Viz.array(c, { label: "cands (sorted)" }), resHtml(H.results)));
        const V = (s, i, r) => ({ start: s, i: i ?? "·", remain: r, path: list(path) });
        H.enter(String(t));
        H.snap(`Each candidate may be used <b>once</b> (recurse with i+1) and the input has repeats. Both prunes are on one sorted array: <code>continue</code> on a repeat at the same level, <code>break</code> when too big.`, [1, 14], V(0, null, t));
        const dfs = (s, r) => {
          if (r === 0) { H.result(list(path)); H.snap(`remain = 0: record <b>${list(path)}</b>.`, [4, 5], V(s, null, r)); return; }
          for (let i = s; i < c.length; i++) {
            if (i > s && c[i] === c[i - 1]) { H.prune("✗", `+${c[i]}`, `cands[${i}] = cands[${i - 1}] = ${c[i]} at the same level: the left sibling already explored "${c[i]} next". <b>continue</b>.`, [7, 8], V(s, i, r)); continue; }
            if (c[i] > r) { H.prune("✗", `+${c[i]}`, `${c[i]} > remain ${r}: <b>break</b>, all later values are at least as big.`, [9, 10], V(s, i, r)); break; }
            path.push(c[i]); H.enter(String(r - c[i]), `+${c[i]}`);
            H.snap(`<b>Choose</b> cands[${i}] = ${c[i]}: remain → ${r - c[i]}; next start = ${i + 1}.`, [11, 12], V(s, i, r - c[i]));
            dfs(i + 1, r - c[i]);
            path.pop(); H.leave();
          }
        };
        dfs(0, t);
        H.snap(`Done: <b>${H.results.length}</b> unique combination${H.results.length === 1 ? "" : "s"}; ${H.pruned} branches cut.`, 15, V(0, null, t));
        return {};
      },
    },
  };
  Viz.register("backtracking-dups", (el, opts) => treePlayer(el, opts, {
    title: "Duplicates: sort, then skip equal siblings",
    modes: DUPS,
    inputs: [{ key: "a", label: "nums", width: 140 }, { key: "b", label: "target", width: 60 }],
  }));

  /* ================= 3. String builders ================= */
  const KEYS = { 2: "abc", 3: "def", 4: "ghi", 5: "jkl", 6: "mno", 7: "pqrs", 8: "tuv", 9: "wxyz" };
  const isPal = (s) => s === [...s].reverse().join("");
  const STRINGS = {
    "generate parentheses": {
      defaults: { a: "3" },
      caption: "node = the prefix · dashed = a bracket the counts forbid",
      depthLabel: (d) => `len ${d}`,
      random: () => ({ a: String(Viz.rand(2, 3)) }),
      code: ["def generate_parenthesis(n):", "    res, path = [], []", "    def dfs(open_, close):", "        if len(path) == 2 * n:", "            res.append(''.join(path)); return", "        if open_ < n:                  # an opener is still available", "            path.append('(')", "            dfs(open_ + 1, close)", "            path.pop()", "        if close < open_:              # something is waiting to close", "            path.append(')')", "            dfs(open_, close + 1)", "            path.pop()", "    dfs(0, 0)", "    return res"],
      run({ a }, H) {
        const n = Viz.parse.int(a, { min: 1, max: 3 }), path = [];
        H.panel(() => Viz.row(pathHtml(path, "path"), resHtml(H.results)));
        const V = (o, c) => ({ open: o, close: c, path: path.join("") || "''" });
        H.enter("''");
        H.snap(`Build ${2 * n} characters. Two counters replace any validity check at the end: <b>open &lt; n</b> allows "(", and <b>close &lt; open</b> allows ")". Every leaf is then valid by construction.`, 13, V(0, 0));
        const dfs = (o, c) => {
          if (path.length === 2 * n) { H.result(path.join("")); H.snap(`Length ${2 * n}: record <b>${path.join("")}</b>.`, [3, 4], V(o, c)); return; }
          if (o < n) { path.push("("); H.enter(path.join(""), "("); H.snap(`open = ${o} &lt; ${n}: add "(".`, [5, 6, 7], V(o + 1, c)); dfs(o + 1, c); path.pop(); H.leave(); }
          else H.prune("✗", "(", `open = ${o} = n: all ${n} openers are used, "(" is cut.`, 5, V(o, c));
          if (c < o) { path.push(")"); H.enter(path.join(""), ")"); H.snap(`close = ${c} &lt; open = ${o}: an unmatched "(" exists, so add ")".`, [9, 10, 11], V(o, c + 1)); dfs(o, c + 1); path.pop(); H.leave(); }
          else H.prune("✗", ")", `close = open = ${o}: nothing is open, ")" would be invalid. Cut.`, 9, V(o, c));
        };
        dfs(0, 0);
        H.snap(`Done: <b>${H.results.length}</b> strings, the Catalan number C<sub>${n}</sub>. Without the counters there would be 2<sup>${2 * n}</sup> = ${2 ** (2 * n)} leaves to filter.`, 14, V(n, n));
        return {};
      },
    },
    "letter combinations": {
      defaults: { a: "23" },
      caption: "node = letters chosen so far · level i = digit i",
      depthLabel: (d, c) => (d < c.d.length ? `digit ${c.d[d]}` : ""),
      random: () => ({ a: Array.from({ length: Viz.rand(2, 3) }, () => Viz.rand(2, 6)).join("") }),
      code: ["KEYS = {'2':'abc','3':'def','4':'ghi','5':'jkl',", "        '6':'mno','7':'pqrs','8':'tuv','9':'wxyz'}", "def letter_combinations(digits):", "    if not digits: return []", "    res, path = [], []", "    def dfs(i):", "        if i == len(digits):", "            res.append(''.join(path)); return", "        for ch in KEYS[digits[i]]:", "            path.append(ch)            # choose", "            dfs(i + 1)                 # explore", "            path.pop()                 # un-choose", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const d = String(a).trim();
        if (!/^[2-9]{1,3}$/.test(d)) throw new Error("Use 1 to 3 digits from 2 to 9.");
        if ([...d].reduce((m, x) => m * KEYS[x].length, 1) > 40) throw new Error("Too many combinations to draw: use digits with 3 letters, or fewer digits.");
        const path = [];
        H.panel(() => Viz.row(pathHtml(path, "path"), resHtml(H.results)));
        const V = (i, ch) => ({ i, digit: d[i] ?? "·", ch: ch ?? "·", path: path.join("") || "''" });
        H.enter("''");
        const dfs = (i) => {
          if (i === d.length) { H.result(path.join("")); H.snap(`One letter per digit: record <b>${path.join("")}</b>.`, [6, 7], V(i)); return; }
          for (const ch of KEYS[d[i]]) {
            path.push(ch); H.enter(path.join(""), ch);
            H.snap(`Digit ${d[i]} offers "${KEYS[d[i]]}". <b>Choose</b> "${ch}".`, [8, 9, 10], V(i, ch));
            dfs(i + 1);
            path.pop(); H.leave();
          }
        };
        dfs(0);
        H.snap(`Done: <b>${H.results.length}</b> = ${[...d].map((x) => KEYS[x].length).join(" × ")}. No pruning is possible: every leaf is an answer.`, 12, V(d.length));
        return { d };
      },
    },
    "palindrome partitioning": {
      defaults: { a: "aab" },
      caption: "node = the piece just cut · dashed = a piece that is not a palindrome",
      depthLabel: (d) => (d ? `piece ${d}` : ""),
      random: () => ({ a: Array.from({ length: Viz.rand(3, 4) }, () => "ab"[Viz.rand(0, 1)]).join("") }),
      code: ["def partition(s):", "    res, path = [], []", "    def dfs(start):", "        if start == len(s):", "            res.append(path[:]); return", "        for end in range(start + 1, len(s) + 1):", "            piece = s[start:end]", "            if piece != piece[::-1]:", "                continue             # not a palindrome: cut", "            path.append(piece)       # choose the cut", "            dfs(end)                 # explore the rest", "            path.pop()               # un-choose", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const s = String(a).trim();
        if (!/^[a-z]{1,5}$/.test(s)) throw new Error("Use 1 to 5 lowercase letters.");
        const path = [];
        let cut = -1;
        H.panel(() => Viz.row(Viz.labeled("s (green = already cut into pieces)", Viz.array([...s], { ptrs: { start: cut >= 0 ? cut : null }, cls: (i) => (i < path.join("").length ? "done" : "") })), pathHtml(path, "path (the pieces)"), resHtml(H.results)));
        const V = (st, e) => ({ start: st, end: e ?? "·", path: list(path) });
        H.enter(`"${s}"`);
        const dfs = (st) => {
          cut = st;
          if (st === s.length) { H.result(path.join("|")); H.snap(`The cuts cover the whole string: record <b>${path.join(" | ")}</b>.`, [3, 4], V(st)); return; }
          for (let e = st + 1; e <= s.length; e++) {
            const piece = s.slice(st, e);
            cut = st;
            if (!isPal(piece)) { H.prune(piece, "✗", `"${piece}" reversed is "${[...piece].reverse().join("")}": not a palindrome. Every partition starting with this piece is cut.`, [7, 8], V(st, e)); continue; }
            path.push(piece); H.enter(piece, `${st}:${e}`);
            H.snap(`"${piece}" is a palindrome: <b>cut</b> it off and partition the rest from index ${e}.`, [9, 10], V(st, e));
            dfs(e);
            path.pop(); H.leave(); cut = st;
          }
        };
        dfs(0);
        H.snap(`Done: <b>${H.results.length}</b> partitions. For long strings, precompute an is_pal[i][j] table (interval DP) so each check is O(1).`, 12, V(0));
        return {};
      },
    },
    "restore IP addresses": {
      defaults: { a: "101023" },
      caption: "node = the octet just placed · dashed = invalid octet or wrong remaining length",
      depthLabel: (d) => (d ? `octet ${d}` : ""),
      random: () => ({ a: ["101023", "25525511135", "0000", "1111", "010010", "1921681"][Viz.rand(0, 5)] }),
      code: ["def restore_ip_addresses(s):", "    res, path = [], []", "    def dfs(start):", "        left, parts = len(s) - start, 4 - len(path)", "        if left < parts or left > 3 * parts:", "            return                     # cannot fill the rest", "        if parts == 0:", "            res.append('.'.join(path)); return", "        for L in (1, 2, 3):", "            seg = s[start:start + L]", "            if len(seg) < L: break", "            if (seg[0] == '0' and L > 1) or int(seg) > 255:", "                break                  # longer segments are worse", "            path.append(seg)", "            dfs(start + L)", "            path.pop()", "    dfs(0)", "    return res"],
      run({ a }, H) {
        const s = String(a).trim();
        if (!/^\d{4,12}$/.test(s)) throw new Error("Use 4 to 12 digits.");
        const path = [];
        H.panel(() => Viz.row(pathHtml(path, "path (octets)"), resHtml(H.results)));
        const V = (st, L) => ({ start: st, L: L ?? "·", left: s.length - st, parts: 4 - path.length });
        H.enter(s);
        const dfs = (st, entered) => {
          const left = s.length - st, parts = 4 - path.length;
          if (left < parts || left > 3 * parts) {
            H.mark("bad"); H.snap(`${left} digit${left === 1 ? "" : "s"} left for ${parts} octet${parts === 1 ? "" : "s"}: need between ${parts} and ${3 * parts}. Dead end, <b>return</b> before any loop runs.`, [4, 5], V(st));
            H.mark("dim"); return;
          }
          if (parts === 0) { H.result(path.join(".")); H.snap(`4 octets, all digits used: record <b>${path.join(".")}</b>.`, [6, 7], V(st)); return; }
          if (!entered) H.snap(`${left} digits for ${parts} octets is feasible. Try octets of length 1, 2, 3.`, [3, 8], V(st));
          for (let L = 1; L <= 3; L++) {
            const seg = s.slice(st, st + L);
            if (seg.length < L) break;
            if ((seg[0] === "0" && L > 1) || +seg > 255) {
              H.prune(seg, "✗", seg[0] === "0" ? `"${seg}" has a leading zero: invalid. Longer segments start with the same 0, so <b>break</b>.` : `${seg} > 255: invalid, and a longer segment is bigger still. <b>break</b>.`, [11, 12], V(st, L));
              break;
            }
            path.push(seg); H.enter(seg, `${L}`);
            H.snap(`Place octet "${seg}" (length ${L}).`, [13, 14], V(st + L, L));
            dfs(st + L, true);
            path.pop(); H.leave();
          }
        };
        dfs(0, false);
        H.snap(`Done: <b>${H.results.length}</b> address${H.results.length === 1 ? "" : "es"}. At most 3<sup>4</sup> = 81 leaves for any input, so this is O(1) work in disguise.`, 16, V(0));
        return {};
      },
    },
  };
  Viz.register("backtracking-strings", (el, opts) => treePlayer(el, opts, {
    title: "Building strings: parentheses, phone letters, palindromes, IPs",
    modes: STRINGS,
    inputs: [{ key: "a", label: "input", width: 120 }],
  }));

  /* ================= 4. Overlapping states: from backtracking to memo ================= */
  const targetSum = (memo) => ({
    defaults: { a: "1,1,1,1", b: "2" },
    caption: memo ? "node = (i, total) · a cache hit is a leaf: its subtree is never re-explored" : "node = (i, total) · purple = this state was already solved elsewhere in the tree",
    depthLabel: (d) => `i = ${d}`,
    random: () => ({ a: Viz.randInts(4, 1, 2).join(","), b: String([0, 2][Viz.rand(0, 1)]) }),
    code: memo
      ? ["from functools import cache", "def find_target_sum_ways(nums, target):", "    @cache                              # memo[(i, total)]", "    def ways(i, total):", "        if i == len(nums):", "            return 1 if total == target else 0", "        return (ways(i + 1, total + nums[i]) +", "                ways(i + 1, total - nums[i]))", "    return ways(0, 0)"]
      : ["def find_target_sum_ways(nums, target):", "    def ways(i, total):", "        if i == len(nums):", "            return 1 if total == target else 0", "        return (ways(i + 1, total + nums[i]) +", "                ways(i + 1, total - nums[i]))", "    return ways(0, 0)"],
    run({ a, b }, H) {
      const nums = parseNums(a, 4), t = Viz.parse.int(b, { min: -20, max: 20 }), n = nums.length;
      const cache = new Map(), firstSeen = new Set();
      let calls = 0, hits = 0, repeats = 0;
      H.panel(() => {
        const entries = [...cache.entries()];
        return Viz.row(
          `<div class="v-labeled"><span class="v-caption">work</span><div class="bt-stats"><div>calls: <b>${calls}</b></div>${memo ? `<div>cache hits: <b>${hits}</b></div>` : `<div>repeated states: <b>${repeats}</b></div>`}</div></div>`,
          memo ? `<div class="v-labeled"><span class="v-caption">memo: (i, total) → ways</span><div class="bt-res">${entries.length ? entries.map(([k, v]) => `<span class="v-item ${v ? "done" : ""}">${esc(k)}→${v}</span>`).join("") : '<span class="bt-none">empty</span>'}</div></div>` : "");
      });
      const lines = memo ? { leaf: [4, 5], rec: [6, 7], hit: 2, end: 8 } : { leaf: [2, 3], rec: [4, 5], hit: 4, end: 6 };
      const ways = (i, tot, edge) => {
        calls++;
        const key = `${i},${tot}`;
        H.enter(`${i},${tot >= 0 ? "+" : ""}${tot}`, edge);
        if (memo && cache.has(key)) { hits++; H.mark("path"); H.snap(`State (${key}) is already in the memo: return ${cache.get(key)} immediately. Its whole subtree is skipped.`, lines.hit, { i, total: tot, ways: cache.get(key) }); const v = cache.get(key); H.leave(); return v; }
        if (!memo && firstSeen.has(key)) { repeats++; H.mark("path"); }
        firstSeen.add(key);
        let r;
        if (i === n) { r = tot === t ? 1 : 0; if (r) H.mark("done"); H.snap(`Leaf: total ${tot} ${r ? "=" : "≠"} target ${t}, so ${r} way${r === 1 ? "" : "s"}.`, lines.leaf, { i, total: tot, ways: r }); }
        else {
          H.snap(!memo && cache.has(key) ? `(${key}) <b>again</b>: the same i and total were reached by a different sign pattern. The answer below cannot differ, yet plain backtracking recomputes it.` : `State (${key}): try +${nums[i]} and −${nums[i]}.`, lines.rec, { i, total: tot });
          r = ways(i + 1, tot + nums[i], `+${nums[i]}`) + ways(i + 1, tot - nums[i], `−${nums[i]}`);
          H.snap(`(${key}) returns ${r}.`, lines.rec, { i, total: tot, ways: r });
        }
        cache.set(key, r);
        H.leave();
        return r;
      };
      const ans = ways(0, 0, "");
      H.snap(memo ? `Answer <b>${ans}</b> with ${calls} calls. There are at most n × (2·sum+1) distinct states, so the memo turns O(2<sup>n</sup>) into O(n · sum).` : `Answer <b>${ans}</b> with ${calls} calls, but only ${cache.size} distinct (i, total) states exist. The purple nodes are wasted work: overlapping subproblems mean it is time to memoize.`, lines.end, { answer: ans, calls });
      return {};
    },
  });
  Viz.register("backtracking-memo", (el, opts) => treePlayer(el, opts, {
    title: "When the tree repeats itself: plain search vs memo (Target Sum)",
    modes: { "plain backtracking": targetSum(false), "with memo (@cache)": targetSum(true) },
    inputs: [{ key: "a", label: "nums", width: 100 }, { key: "b", label: "target", width: 60 }],
    legend: [["active", "current call"], ["visit", "on the call stack"], ["done", "leaf that hits the target"], ["path", "repeated state / cache hit"]],
  }));

  /* ================= 5. N-Queens ================= */
  Viz.register("backtracking-nqueens", (el, opts) => {
    const code = ["def solve_n_queens(n):", "    res, queen = [], [-1] * n          # queen[r] = column in row r", "    cols, diag, anti = set(), set(), set()", "    def dfs(r):", "        if r == n:", "            res.append(queen[:]); return", "        for c in range(n):", "            if c in cols or r - c in diag or r + c in anti:", "                continue                     # attacked: prune", "            queen[r] = c                     # choose", "            cols.add(c); diag.add(r - c); anti.add(r + c)", "            dfs(r + 1)                       # explore", "            cols.remove(c); diag.remove(r - c); anti.remove(r + c)", "            queen[r] = -1                    # un-choose", "    dfs(0)", "    return res"];
    return Viz.player(el, {
      title: "N-Queens: one queen per row, three sets for the attacks",
      tag: "CONSTRAINT SEARCH",
      legend: [["active", "queen just placed / cell tried"], ["done", "placed queen"], ["bad", "attacked or dead end"], ["visit", "occupied column / diagonal"], ["dim", "row not reached yet"]],
      code, codeLang: "python",
      inputs: [
        { key: "n", label: "n", value: (opts && opts.n) || "4", width: 50 },
        { key: "mode", label: "stop", type: "select", value: (opts && opts.mode) || "all solutions", options: ["all solutions", "first solution"] },
      ],
      random: () => ({ n: String(Viz.rand(4, 6)), mode: ["all solutions", "first solution"][Viz.rand(0, 1)] }),
      build({ n: ns, mode }) {
        const n = Viz.parse.int(ns, { min: 4, max: 8 }), first = mode === "first solution";
        const queen = Array(n).fill(-1), cols = new Set(), diag = new Set(), anti = new Set();
        const frames = [], CAP = 650, sols = [];
        let nodes = 0, cut = 0, done = false, capped = false;
        const attackers = (r, c) => queen.map((qc, qr) => (qc >= 0 && qr < r && (qc === c || qr - qc === r - c || qr + qc === r + c) ? qr : -1)).filter((x) => x >= 0);
        const snap = (note, line, row, extra = {}) => {
          if (frames.length >= CAP) { capped = true; return; }
          const att = new Set(), hot = new Set(extra.hot || []);
          for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (queen[r] !== c && queen.some((qc, qr) => qc >= 0 && qr !== r && (qc === c || qr - qc === r - c || qr + qc === r + c))) att.add(`${r},${c}`);
          const board = Array.from({ length: n }, (_, r) => Array.from({ length: n }, (_, c) => (queen[r] === c ? "♛" : "")));
          const cls = (r, c) => {
            const k = `${r},${c}`;
            if (extra.cell && extra.cell[0] === r && extra.cell[1] === c) return extra.cellCls || "active";
            if (hot.has(k)) return "bad";
            if (queen[r] === c) return extra.newest === r ? "active" : "done";
            if (extra.deadRow === r) return "bad";
            if (r === row) return att.has(k) ? "bt-att bt-row" : "bt-row";
            if (r > row) return att.has(k) ? "bt-att dim" : "dim";
            return att.has(k) ? "bt-att" : "";
          };
          const setArr = (len, has, label, idx, hl) => Viz.array(Array.from({ length: len }, (_, i) => (has(i) ? "●" : "")), { label, idxLabel: idx, cls: (i) => (hl.includes(i) ? (extra.setCls || "active") : has(i) ? "visit" : "") });
          const hl = extra.sets || [null, null, null];
          frames.push({
            note, line, vars: { r: row, c: extra.c ?? "·", queen: list(queen.map((q) => (q < 0 ? "·" : q))), solutions: sols.length },
            html: Viz.row(
              Viz.grid(board, { cls, rowLabels: board.map((_, r) => `r${r}`), colLabels: board.map((_, c) => `c${c}`), label: "board" }),
              `<div class="bt-sets">${setArr(n, (i) => cols.has(i), "cols  (c)", (i) => i, hl[0] == null ? [] : [hl[0]])}${setArr(2 * n - 1, (i) => diag.has(i - (n - 1)), "diag  (r − c)", (i) => i - (n - 1), hl[1] == null ? [] : [hl[1] + n - 1])}${setArr(2 * n - 1, (i) => anti.has(i), "anti  (r + c)", (i) => i, hl[2] == null ? [] : [hl[2]])}</div>`,
              sols.length ? `<div class="v-labeled"><span class="v-caption">solutions: ${sols.length}</span><div class="bt-res">${sols.slice(-6).map((s, i, a) => `<span class="v-item done${i === a.length - 1 ? " bt-new" : ""}">${esc(list(s))}</span>`).join("")}</div></div>` : ""),
          });
        };
        snap(`Place ${n} queens so none attack each other. One queen per <b>row</b> is forced, so the search picks a <b>column</b> for row 0, then row 1, … Three sets make the attack test O(1): a column c, a "\\" diagonal (all its cells share r − c), and a "/" diagonal (all share r + c).`, 14, 0);
        const dfs = (r) => {
          nodes++;
          if (r === n) { sols.push(queen.slice()); snap(`Row ${n} reached: all ${n} queens are placed. Record solution <b>${list(queen)}</b> (queen[r] = column).`, [4, 5], r); if (first) done = true; return; }
          let placed = 0;
          for (let c = 0; c < n && !done; c++) {
            if (cols.has(c) || diag.has(r - c) || anti.has(r + c)) {
              cut++;
              const why = [cols.has(c) && `column ${c}`, diag.has(r - c) && `diagonal r−c = ${r - c}`, anti.has(r + c) && `anti-diagonal r+c = ${r + c}`].filter(Boolean).join(" and ");
              const at = attackers(r, c);
              snap(`Try (r${r}, c${c}): ${why} already taken by the queen${at.length > 1 ? "s" : ""} in row ${at.join(", ")}. Attacked: <b>skip</b> without building anything.`, [7, 8], r, { cell: [r, c], cellCls: "bad", hot: at.map((qr) => `${qr},${queen[qr]}`), c, setCls: "bad", sets: [cols.has(c) ? c : null, diag.has(r - c) ? r - c : null, anti.has(r + c) ? r + c : null] });
              continue;
            }
            placed++;
            queen[r] = c; cols.add(c); diag.add(r - c); anti.add(r + c);
            snap(`(r${r}, c${c}) is safe. <b>Place</b> the queen and add c = ${c}, r−c = ${r - c}, r+c = ${r + c} to the sets. The striped cells are now attacked.`, [9, 10], r, { newest: r, c, sets: [c, r - c, r + c] });
            dfs(r + 1);
            if (done) return;
            cols.delete(c); diag.delete(r - c); anti.delete(r + c); queen[r] = -1;
            snap(`Back in row ${r}: <b>remove</b> the queen at c${c} and its three set entries, then try the next column.`, [12, 13], r, { cell: [r, c], cellCls: "visit", c });
          }
          if (!done && r > 0) snap(placed ? `Row ${r} has no more columns to try. Return to row ${r - 1}.` : `<b>Dead end</b>: every column in row ${r} is attacked. Nothing below can work, so return to row ${r - 1} and move its queen.`, 6, r, { deadRow: placed ? -1 : r });
        };
        dfs(0);
        const total = (() => { let cnt = 0, nd = 0; const C = new Set(), D = new Set(), A = new Set(); const go = (r) => { nd++; if (r === n) { cnt++; return; } for (let c = 0; c < n; c++) { if (C.has(c) || D.has(r - c) || A.has(r + c)) continue; C.add(c); D.add(r - c); A.add(r + c); go(r + 1); C.delete(c); D.delete(r - c); A.delete(r + c); } }; go(0); return { cnt, nd }; })();
        capped = capped || frames.length >= CAP;
        frames.length = Math.min(frames.length, CAP - 1);
        const end = first
          ? `Stopped at the first solution after ${nodes} search node${nodes === 1 ? "" : "s"} and ${cut} attacked cells skipped.`
          : `${capped ? `(Frames stop after ${CAP} steps; the search ran to the end.) ` : ""}All <b>${total.cnt}</b> solutions for n = ${n} found with ${total.nd} search nodes. Brute force over every placement of ${n} queens on ${n * n} cells would test C(${n * n}, ${n}) = ${Math.round(choose(n * n, n)).toLocaleString()} boards.`;
        const last = frames[frames.length - 1];
        frames.push({ ...last, note: end, line: 15, vars: { ...last.vars, solutions: first ? sols.length : total.cnt, nodes: first ? nodes : total.nd } });
        return frames;
      },
      render: (f) => f.html,
    });
  });
  function choose(n, k) { let r = 1; for (let i = 1; i <= k; i++) r = (r * (n - k + i)) / i; return r; }

  /* ================= 6. Sudoku with MRV ================= */
  const PUZZLES = {
    "easy (LeetCode 37)": "53..7....6..195....98....6.8...6...34..8.3..17...2...6.6....28....419..5....8..79",
    "medium": "..3.2.6..9..3.5..1..18.64....81.29..7.......8..67.82....26.95..8..2.3..9..5.1.3..",
    "hard (Inkala)": "8..........36......7..9.2...5...7.......457.....1...3...1....68..85...1..9....4..",
  };
  const bitCount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };
  const sudokuParse = (s) => {
    const t = String(s).replace(/\s+/g, "").replace(/0/g, ".");
    if (!/^[1-9.]{81}$/.test(t)) throw new Error("A custom puzzle needs exactly 81 characters: digits 1-9, and . or 0 for blanks.");
    return [...t].map((ch) => (ch === "." ? 0 : +ch));
  };
  /* Shared solver. onEvent (optional) receives every pick/place/undo; returns the number of search nodes (placements tried). */
  function sudokuSolve(g0, mrv, onEvent, limit = 3e6) {
    const g = g0.slice(), row = Array(9).fill(0), col = Array(9).fill(0), box = Array(9).fill(0);
    const B = (i) => 3 * Math.floor(Math.floor(i / 9) / 3) + Math.floor((i % 9) / 3);
    for (let i = 0; i < 81; i++) if (g[i]) { const b = 1 << g[i]; if ((row[(i / 9) | 0] | col[i % 9] | box[B(i)]) & b) return { ok: false, nodes: 0, bad: true }; row[(i / 9) | 0] |= b; col[i % 9] |= b; box[B(i)] |= b; }
    const cand = (i) => ~(row[(i / 9) | 0] | col[i % 9] | box[B(i)]) & 0x3fe;
    let nodes = 0, stop = false;
    const go = () => {
      let pick = -1, best = 10;
      for (let i = 0; i < 81; i++) if (!g[i]) {
        if (!mrv) { pick = i; best = bitCount(cand(i)); break; }
        const k = bitCount(cand(i));
        if (k < best) { best = k; pick = i; if (k <= 1) break; }
      }
      if (pick < 0) return true;
      const m = cand(pick);
      onEvent && onEvent("pick", { g, i: pick, m, cand });
      if (!m) { onEvent && onEvent("dead", { g, i: pick, m, cand }); return false; }
      for (let d = 1; d <= 9; d++) if (m & (1 << d)) {
        if (++nodes > limit) { stop = true; return false; }
        const b = 1 << d, r = (pick / 9) | 0, c = pick % 9, bx = B(pick);
        g[pick] = d; row[r] |= b; col[c] |= b; box[bx] |= b;
        onEvent && onEvent("place", { g, i: pick, m, d, cand });
        if (go()) return true;
        if (stop) return false;
        g[pick] = 0; row[r] &= ~b; col[c] &= ~b; box[bx] &= ~b;
        onEvent && onEvent("undo", { g, i: pick, m, d, cand });
      }
      return false;
    };
    const ok = go();
    return { ok, nodes, stop, g };
  }
  Viz.register("backtracking-sudoku", (el, opts) => {
    const code = ["def solve_sudoku(board):", "    rows, cols, boxes = ...   # digits used per unit", "    def candidates(r, c):", "        return ALL - rows[r] - cols[c] - boxes[box(r, c)]", "    def dfs():", "        empty = [cell for cell in cells if blank(cell)]", "        if not empty: return True", "        r, c = min(empty, key=num_candidates)   # MRV", "        for d in candidates(r, c):    # 0 candidates: no loop", "            place(r, c, d)                 # choose (board + 3 sets)", "            if dfs(): return True          # explore", "            remove(r, c, d)                # un-choose", "        return False                       # dead end: backtrack", "    dfs()"];
    const curMode = () => (el.querySelector('select[name="puzzle"]') || {}).value;
    return Viz.player(el, {
      title: "Sudoku: always fill the most constrained cell first (MRV)",
      tag: "CONSTRAINT SEARCH",
      legend: [["active", "cell being filled"], ["done", "filled by the search"], ["bad", "dead end: 0 candidates"], ["visit", "same row / column / box"]],
      code, codeLang: "python",
      inputs: [
        { key: "puzzle", label: "puzzle", type: "select", value: (opts && opts.puzzle) || "easy (LeetCode 37)", options: Object.keys(PUZZLES) },
        { key: "order", label: "cell order", type: "select", value: (opts && opts.order) || "MRV (fewest candidates)", options: ["MRV (fewest candidates)", "row by row"] },
        { key: "custom", label: "custom 81 chars (optional)", value: "", width: 210 },
      ],
      random: () => ({ puzzle: Object.keys(PUZZLES)[Viz.rand(0, 2)], order: ["MRV (fewest candidates)", "row by row"][Viz.rand(0, 1)], custom: "" }),
      build({ puzzle, order, custom }) {
        const g0 = sudokuParse(String(custom || "").trim() ? custom : PUZZLES[puzzle] || PUZZLES[curMode()] || Object.values(PUZZLES)[0]);
        const mrv = !String(order).startsWith("row");
        const frames = [], CAP = 600;
        let placed = 0, undos = 0, dead = 0;
        const draw = (g, i, kind, m, d, cand) => {
          const r0 = (i / 9) | 0, c0 = i % 9, b0 = 3 * ((r0 / 3) | 0) + ((c0 / 3) | 0);
          const cells = g.map((v, j) => {
            const r = (j / 9) | 0, c = j % 9, bx = 3 * ((r / 3) | 0) + ((c / 3) | 0);
            let cl = g0[j] ? "bt-given" : v ? "done" : "";
            if (j === i) cl = kind === "dead" ? "bad" : "active";
            else if (i >= 0 && (r === r0 || c === c0 || bx === b0)) cl += " bt-peer";
            if (c % 3 === 2 && c < 8) cl += " bt-br";
            if (r % 3 === 2 && r < 8) cl += " bt-bb";
            let txt = v ? String(v) : "";
            if (!v && kind === "pick" && mrv && cand) txt = `<small class="bt-cnt">${bitCount(cand(j))}</small>`;
            else txt = esc(txt);
            return `<div class="bt-sc ${cl}">${txt}</div>`;
          }).join("");
          const digits = [1, 2, 3, 4, 5, 6, 7, 8, 9];
          return Viz.row(
            `<div class="v-labeled"><span class="v-caption">board${mrv && kind === "pick" ? " (small numbers = candidate counts)" : ""}</span><div class="bt-sdk">${cells}</div></div>`,
            `<div class="bt-sdkside">${i >= 0 ? Viz.array(digits, { label: `candidates of (r${r0}, c${c0})`, showIdx: false, cls: (k) => (d === k + 1 ? (kind === "undo" ? "bad" : "active") : m & (1 << (k + 1)) ? "done" : "dim") }) : ""}<div class="v-labeled"><span class="v-caption">search so far</span><div class="bt-stats"><div>placements: <b>${placed}</b></div><div>undone: <b>${undos}</b></div><div>dead ends: <b>${dead}</b></div></div></div></div>`);
        };
        const push = (note, line, html, vars) => { if (frames.length < CAP) frames.push({ note, line, html, vars }); };
        push(`${81 - g0.filter(Boolean).length} blanks. Each step chooses one empty cell and tries its candidates. ${mrv ? "<b>MRV</b> (minimum remaining values) chooses the cell with the <b>fewest</b> candidates: a cell with 1 candidate is forced, and a cell with 0 is a dead end found immediately." : "<b>Row by row</b> takes the first blank, no matter how many choices it has."}`, [5, 7], draw(g0, -1, "start"), { blanks: 81 - g0.filter(Boolean).length });
        const res = sudokuSolve(g0, mrv, (kind, e) => {
          const r = (e.i / 9) | 0, c = e.i % 9, k = bitCount(e.m), V = { cell: `(r${r}, c${c})`, candidates: k, d: e.d ?? "·" };
          if (kind === "pick") push(k === 1 ? `${mrv ? "MRV picks" : "Next blank:"} (r${r}, c${c}), which has a single candidate: it is <b>forced</b>.` : k ? `${mrv ? `MRV picks (r${r}, c${c}): its ${k} candidates are the fewest on the board.` : `Next blank (r${r}, c${c}) has ${k} candidates.`} A wrong guess here will be undone later.` : `(r${r}, c${c}) has <b>no</b> candidates left.`, [7, 8], draw(e.g, e.i, "pick", e.m, null, e.cand), V);
          else if (kind === "dead") { dead++; push(`<b>Dead end</b>: every digit already appears in the row, column or box of (r${r}, c${c}). Return False so the caller undoes its last guess.`, 12, draw(e.g, e.i, "dead", e.m), V); }
          else if (kind === "place") { placed++; push(`<b>Place</b> ${e.d} at (r${r}, c${c}) and add it to that row's, column's and box's sets.`, [9, 10], draw(e.g, e.i, "place", e.m, e.d), V); }
          else { undos++; push(`<b>Undo</b> ${e.d} at (r${r}, c${c}): it led to a dead end below. Try the next candidate.`, 11, draw(e.g, e.i, "undo", e.m, e.d), V); }
        });
        if (res.bad) throw new Error("This puzzle already breaks the rules (a digit repeats in a row, column or box).");
        const other = sudokuSolve(g0, !mrv, null);
        const fmtN = (r) => (r.stop ? "more than 3,000,000" : r.nodes.toLocaleString());
        const last = draw(res.g, -1, "end");
        frames.length = Math.min(frames.length, CAP - 1);
        frames.push({ note: `${res.ok ? "Solved" : res.stop ? "Gave up" : "No solution"}${frames.length >= CAP - 1 ? " (frames stop early; the search finished)" : ""}. Placements tried: <b>${fmtN(res)}</b> with ${mrv ? "MRV" : "row-by-row order"}, versus <b>${fmtN(other)}</b> with ${mrv ? "row-by-row order" : "MRV"}. Same algorithm, same pruning: only the <b>order</b> of decisions changed.`, line: 13, html: last, vars: { placements: res.nodes, other: other.stop ? ">3e6" : other.nodes } });
        return frames;
      },
      render: (f) => f.html,
    });
  });

  /* ================= 7. Word search ================= */
  Viz.register("backtracking-wordsearch", (el, opts) => {
    const code = ["def exist(board, word):", "    R, C = len(board), len(board[0])", "    def dfs(r, c, k):                   # match word[k] at (r, c)", "        if k == len(word): return True", "        if not (0 <= r < R and 0 <= c < C) or board[r][c] != word[k]:", "            return False                # off grid, mismatch, or '#'", "        board[r][c] = '#'               # choose: mark as used", "        found = (dfs(r+1, c, k+1) or dfs(r-1, c, k+1) or", "                 dfs(r, c+1, k+1) or dfs(r, c-1, k+1))", "        board[r][c] = word[k]           # un-choose: restore", "        return found", "    return any(dfs(r, c, 0) for r in range(R) for c in range(C))"];
    return Viz.player(el, {
      title: "Word Search: grid DFS that marks and un-marks cells",
      tag: "GRID BACKTRACKING",
      legend: [["active", "cell being checked"], ["visit", "marked '#': on the current path"], ["bad", "mismatch / already used"], ["done", "word found"], ["dim", "fully explored start"]],
      code, codeLang: "python",
      inputs: [
        { key: "grid", label: "grid rows", value: (opts && opts.grid) || "ABCE,SFES,ADEE", width: 170 },
        { key: "word", label: "word", value: (opts && opts.word) || "ABCESEEEFS", width: 120 },
      ],
      random: () => [{ grid: "ABCE,SFCS,ADEE", word: "ABCCED" }, { grid: "ABCE,SFCS,ADEE", word: "ABCB" }, { grid: "ABCE,SFES,ADEE", word: "ABCESEEEFS" }, { grid: "AAB,ABA,BAA", word: "ABAB" }, { grid: "CAT,ATC,TCA", word: "CATC" }][Viz.rand(0, 4)],
      build({ grid, word }) {
        const rows = String(grid).split(/[,\s]+/).filter(Boolean).map((s) => [...s.toUpperCase()]);
        const w = String(word).trim().toUpperCase();
        if (!rows.length || rows.length > 5 || rows.some((r) => r.length !== rows[0].length || r.length > 6)) throw new Error("Grid: up to 5 rows of equal length (at most 6 letters), separated by commas.");
        if (!/^[A-Z]{1,10}$/.test(w)) throw new Error("Word: 1 to 10 letters.");
        const R = rows.length, C = rows[0].length, b = rows.map((r) => r.slice());
        const frames = [], CAP = 500, onPath = [], starts = new Set();
        let capped = false;
        const snap = (note, line, cur, cls, k, extra = {}) => {
          if (frames.length >= CAP) { capped = true; return; }
          const pathIdx = new Map(onPath.map(([r, c], i) => [`${r},${c}`, i]));
          frames.push({
            note, line, vars: { r: cur ? cur[0] : "·", c: cur ? cur[1] : "·", k, "word[k]": w[k] ?? "·" },
            html: Viz.row(
              Viz.grid(b, {
                label: "board ('#' = marked, on the path)",
                rowLabels: b.map((_, r) => r), colLabels: b[0].map((_, c) => c),
                cls: (r, c) => (cur && cur[0] === r && cur[1] === c ? cls : extra.found && pathIdx.has(`${r},${c}`) ? "done" : pathIdx.has(`${r},${c}`) ? "visit" : starts.has(`${r},${c}`) ? "dim" : ""),
                fmt: (v, r, c) => (v === "#" ? `#${pathIdx.has(`${r},${c}`) ? pathIdx.get(`${r},${c}`) : ""}` : v),
              }),
              Viz.array([...w], { label: "word (green = matched so far)", ptrs: { k: k < w.length ? k : null }, cls: (i) => (i < onPath.length ? "done" : i === k && cls === "bad" ? "bad" : "") })),
          });
        };
        snap(`Find "${w}" by walking between side-adjacent cells, using each cell at most once. Try every start; from each, DFS in 4 directions. The path is remembered by overwriting cells with <b>'#'</b> (the number shows its position in the word).`, 11, null, "", 0);
        let found = false;
        const D = [[1, 0], [-1, 0], [0, 1], [0, -1]];
        const dfs = (r, c, k, from) => {
          if (k === w.length) return true;
          if (r < 0 || r >= R || c < 0 || c >= C) return false;
          if (b[r][c] !== w[k]) {
            if (from || k === 0) snap(b[r][c] === "#" ? `(${r},${c}) is <b>'#'</b>: already on the path. Without marking, the walk could reuse it.` : `(${r},${c}) holds ${b[r][c]}, word[${k}] is ${w[k]}: mismatch, return False.`, [4, 5], [r, c], "bad", k);
            return false;
          }
          b[r][c] = "#"; onPath.push([r, c]);
          snap(`(${r},${c}) = ${w[k]} matches word[${k}]. <b>Mark</b> it '#'${k + 1 < w.length ? ` and look for word[${k + 1}] = ${w[k + 1]} among its neighbours` : ": that was the last letter"}.`, 6, [r, c], "active", k);
          if (k + 1 === w.length) { found = true; snap(`All ${w.length} letters matched: <b>found</b>. The <code>or</code> short-circuits, so every caller returns True straight away.`, 3, [r, c], "done", k + 1, { found: true }); return true; }
          for (const [dr, dc] of D) if (dfs(r + dr, c + dc, k + 1, true)) return true;
          b[r][c] = w[k]; onPath.pop();
          snap(`No neighbour of (${r},${c}) continues the word. <b>Un-mark</b>: restore '${w[k]}' so other paths may use this cell, and return False.`, [9, 10], [r, c], "bad", k);
          return false;
        };
        outer: for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
          if (dfs(r, c, 0, false)) break outer;
          if (b[r][c] === w[0]) starts.add(`${r},${c}`);
        }
        frames.length = Math.min(frames.length, CAP - 1);
        frames.push({ ...frames[frames.length - 1], note: `${capped ? "(Frames stop early.) " : ""}${found ? `"${w}" <b>exists</b>.` : `"${w}" does <b>not</b> exist: every start was tried and every mark was undone, so the board is unchanged.`} Cost: O(R·C·3<sup>L</sup>): each step has at most 3 new directions (the 4th is where it came from).`, line: 11 });
        return frames;
      },
      render: (f) => f.html,
    });
  });

  /* ================= 8. Partition to K equal-sum subsets ================= */
  function partitionK(nums, k, smart, onEvent, limit = 2e6) {
    const total = nums.reduce((s, x) => s + x, 0), target = total / k;
    const a = smart ? nums.slice().sort((x, y) => y - x) : nums.slice();
    const load = Array(k).fill(0), owner = Array(a.length).fill(-1);
    let calls = 0, stop = false;
    if (!Number.isInteger(target) || Math.max(...a) > target) return { ok: false, calls, a, target, quick: true };
    const go = (i) => {
      if (++calls > limit) { stop = true; return false; }
      if (i === a.length) return true;
      const seen = new Set();
      for (let b = 0; b < k; b++) {
        if (load[b] + a[i] > target) { onEvent && onEvent("over", { i, b, load, owner, a }); continue; }
        if (smart && seen.has(load[b])) { onEvent && onEvent("same", { i, b, load, owner, a }); continue; }
        seen.add(load[b]);
        load[b] += a[i]; owner[i] = b;
        onEvent && onEvent("put", { i, b, load, owner, a });
        if (go(i + 1)) return true;
        if (stop) return false;
        load[b] -= a[i]; owner[i] = -1;
        onEvent && onEvent("take", { i, b, load, owner, a });
      }
      onEvent && onEvent("fail", { i, load, owner, a });
      return false;
    };
    return { ok: go(0), calls, stop, a, target, owner, load };
  }
  Viz.register("backtracking-partition-k", (el, opts) => {
    const code = ["def can_partition_k(nums, k):", "    total = sum(nums)", "    if total % k: return False", "    target = total // k", "    nums.sort(reverse=True)            # big items first: fail fast", "    load = [0] * k", "    def dfs(i):", "        if i == len(nums): return True", "        seen = set()                     # bucket loads tried for nums[i]", "        for b in range(k):", "            if load[b] + nums[i] > target: continue", "            if load[b] in seen: continue # same load = same subtree", "            seen.add(load[b])", "            load[b] += nums[i]           # choose bucket b", "            if dfs(i + 1): return True", "            load[b] -= nums[i]           # un-choose", "        return False", "    return dfs(0)"];
    return Viz.player(el, {
      title: "Partition to K equal-sum subsets: the order of choices decides the cost",
      tag: "PRUNING",
      legend: [["active", "item being placed"], ["done", "placed"], ["bad", "overflows the bucket"], ["path", "skipped: same load as a tried bucket"]],
      code, codeLang: "python",
      inputs: [
        { key: "nums", label: "nums", value: (opts && opts.nums) || "3,4,4,2,1,2,6,7,7", width: 160 },
        { key: "k", label: "k", value: (opts && opts.k) || "3", width: 44 },
        { key: "mode", label: "strategy", type: "select", value: (opts && opts.mode) || "descending + same-load skip", options: ["descending + same-load skip", "input order, no skip"] },
      ],
      random: () => { for (;;) { const k = Viz.rand(2, 4), t = Viz.rand(4, 8), out = []; for (let b = 0; b < k; b++) { let left = t; while (left > 0) { const x = Viz.rand(1, Math.min(left, 6)); out.push(x); left -= x; } } if (out.length <= 10) return { nums: shuffle(out).join(","), k: String(k), mode: ["descending + same-load skip", "input order, no skip"][Viz.rand(0, 1)] }; } },
      build({ nums, k: ks, mode }) {
        const a0 = Viz.parse.ints(nums, { min: 1, max: 10 }), k = Viz.parse.int(ks, { min: 1, max: 5 });
        if (a0.some((x) => x < 1 || x > 20)) throw new Error("nums: positive whole numbers up to 20.");
        const smart = mode.startsWith("desc");
        const total = a0.reduce((s, x) => s + x, 0);
        const frames = [], CAP = 500;
        const draw = (e, kind) => {
          const t = total / k;
          const bk = e.load.map((L, b) => {
            const items = e.a.map((x, i) => (e.owner[i] === b ? x : null)).filter((x) => x !== null);
            const hot = e.b === b ? (kind === "over" ? "bad" : kind === "same" ? "path" : kind === "put" ? "active" : kind === "take" ? "visit" : "") : "";
            return `<div class="bt-bk ${hot}"><div class="bt-bkfill" style="height:${Math.min(100, (L / t) * 100)}%"></div><div class="bt-bkitems">${items.map((x) => `<span>${x}</span>`).join("")}</div><div class="bt-bklab">${L}/${t}</div></div>`;
          }).join("");
          return Viz.row(Viz.array(e.a, { label: smart ? "nums (sorted descending)" : "nums (input order)", ptrs: { i: e.i < e.a.length ? e.i : null }, cls: (i) => (i === e.i ? "active" : e.owner[i] >= 0 ? "done" : "") }), `<div class="v-labeled"><span class="v-caption">buckets (fill = load / target)</span><div class="bt-buckets">${bk}</div></div>`);
        };
        let calls = 0;
        const push = (note, line, e, kind) => { if (frames.length < CAP) frames.push({ note, line, html: draw(e, kind), vars: { i: e.i, "nums[i]": e.a[e.i] ?? "·", bucket: e.b ?? "·", loads: list(e.load) } }); };
        const res = partitionK(a0, k, smart, (kind, e) => {
          const x = e.a[e.i];
          if (kind === "put") { calls++; push(`<b>Put</b> ${x} into bucket ${e.b} (load ${e.load[e.b] - x} → ${e.load[e.b]}).`, [13, 14], e, kind); }
          else if (kind === "over") push(`${x} does not fit bucket ${e.b}: ${e.load[e.b]} + ${x} > ${total / k}.`, 10, e, kind);
          else if (kind === "same") push(`Bucket ${e.b} has load ${e.load[e.b]}, the same as a bucket already tried for ${x}. Buckets are interchangeable, so its subtree is identical: <b>skip</b>.`, 11, e, kind);
          else if (kind === "take") push(`Bucket ${e.b} did not lead to a full partition: <b>take</b> ${x} back out.`, 15, e, kind);
          else push(`Every bucket that ${x} could join has been tried and none led to a full partition: return False so the previous item moves.`, 16, e, kind);
        });
        if (res.quick) throw new Error(total % k ? `sum ${total} is not divisible by k = ${k}: the answer is False with no search.` : `The largest number exceeds the target ${total / k}: False with no search.`);
        const other = partitionK(a0, k, !smart, null);
        const fmtC = (r) => (r.stop ? "more than 2,000,000" : r.calls.toLocaleString());
        frames.unshift({ note: `Sum ${total}, k = ${k}, so each bucket must reach exactly <b>${total / k}</b>. Place the items one at a time into some bucket. ${smart ? "Sorting <b>descending</b> puts the hard-to-fit items first, so failures happen near the root, where cutting saves the most." : "Here the items go in their input order and every bucket is tried, even ones with the same load."}`, line: [1, 4], html: draw({ load: Array(k).fill(0), owner: Array(a0.length).fill(-1), a: res.a, i: 0 }, ""), vars: { target: total / k } });
        frames.length = Math.min(frames.length, CAP - 1);
        frames.push({ ...frames[frames.length - 1], note: `${res.ok ? "<b>True</b>: every bucket reaches " + total / k : "<b>False</b>"}. Calls: <b>${fmtC(res)}</b> with this strategy, <b>${fmtC(other)}</b> with the other. The answer is the same; the tree size is not.`, line: 17 });
        return frames;
      },
      render: (f) => f.html,
    });
  });

  /* ================= 9. What pruning buys (N-Queens counts) ================= */
  Viz.register("backtracking-cost", (el, opts) => {
    const nq = (n) => { let nd = 0; const C = new Set(), D = new Set(), A = new Set(); const go = (r) => { nd++; if (r === n) return; for (let c = 0; c < n; c++) { if (C.has(c) || D.has(r - c) || A.has(r + c)) continue; C.add(c); D.add(r - c); A.add(r + c); go(r + 1); C.delete(c); D.delete(r - c); A.delete(r + c); } }; go(0); return nd; };
    const fact = (n) => (n <= 1 ? 1 : n * fact(n - 1));
    return Viz.player(el, {
      title: "Size of the search space for N-Queens, with and without pruning",
      tag: "COMPLEXITY",
      legend: [["bad", "brute force"], ["visit", "smarter encoding"], ["done", "pruned backtracking (measured)"]],
      code: ["# 1. any n of n*n cells:  C(n*n, n)", "# 2. one queen per row:   n ** n", "# 3. + one per column:    n!", "# 4. + diagonal checks:   measured", "#    (nodes the DFS visits)"], codeLang: "python",
      inputs: [{ key: "n", label: "n", value: (opts && opts.n) || "8", width: 50 }],
      random: () => ({ n: String(Viz.rand(4, 12)) }),
      build({ n: ns }) {
        const n = Viz.parse.int(ns, { min: 4, max: 12 });
        const rows = [
          ["any n cells", choose(n * n, n), "bad", `Brute force: choose any ${n} of the ${n * n} cells and check the board.`],
          ["one per row", n ** n, "bad", `Encode one queen per <b>row</b>: a board is a list of ${n} column numbers, ${n}<sup>${n}</sup> lists.`],
          ["permutations", fact(n), "visit", `Also forbid shared <b>columns</b>: the column list is a permutation, ${n}! of them. Better encodings shrink the space before any search.`],
          ["backtracking", nq(n), "done", `Backtracking checks diagonals <b>while placing</b>, so a bad prefix kills its whole subtree. Measured: every node the DFS actually visits.`],
        ];
        const maxL = Math.log10(rows[0][1]);
        return rows.map((_, s) => ({
          note: rows[s][3] + (s === 3 ? ` That is ${(rows[2][1] / rows[3][1]).toFixed(1)}× fewer than n! and ${(rows[0][1] / rows[3][1]).toExponential(1).replace("e+", " × 10^")} fewer than brute force.` : ""),
          line: s,
          vars: { n, count: Math.round(rows[s][1]).toLocaleString() },
          html: `<div class="v-labeled bt-costwrap"><span class="v-caption">boards or nodes, log scale (each grid line = ×10)</span><div class="bt-cost" style="--dec:${Math.ceil(maxL)}">${rows.map(([lab, v, c], i) => `<div class="bt-crow ${i > s ? "bt-hide" : ""}"><span class="bt-clab">${lab}</span><div class="bt-ctrack"><div class="bt-cbar ${c}" style="width:${Math.max(1.5, (Math.log10(v) / Math.ceil(maxL)) * 100)}%"></div></div><span class="bt-cval">${Math.round(v).toLocaleString()}</span></div>`).join("")}</div></div>`,
        }));
      },
      render: (f) => f.html,
    });
  });
})();
