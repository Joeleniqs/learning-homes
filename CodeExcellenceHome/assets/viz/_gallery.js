/* Live component gallery for guide.html. Doubles as reference code for topic authors. */
(() => {
  Viz.register("g-two-sum", (el) => Viz.player(el, {
    title: "Two Sum on a sorted array",
    legend: [["active", "pointer pair"], ["dim", "discarded"], ["done", "answer"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, len(a) - 1",
      "while lo < hi:",
      "    s = a[lo] + a[hi]",
      "    if s == target: return lo, hi",
      "    if s < target: lo += 1",
      "    else: hi -= 1",
      "return None",
    ],
    inputs: [{ key: "a", label: "sorted nums", value: "1,3,4,6,8,11,15" }, { key: "t", label: "target", value: "14", width: 70 }],
    random: () => ({ a: Viz.randInts(8, 1, 30).sort((x, y) => x - y).join(","), t: String(Viz.rand(5, 50)) }),
    build: ({ a, t }) => {
      const arr = Viz.parse.ints(a, { min: 2, max: 16 }), target = Viz.parse.int(t);
      if (arr.some((v, i) => i && v < arr[i - 1])) throw new Error("The array must be sorted ascending.");
      const fr = [];
      let lo = 0, hi = arr.length - 1;
      fr.push({ arr, lo, hi, line: 0, vars: { lo, hi, target }, note: "Start with the widest pair: smallest + largest." });
      while (lo < hi) {
        const s = arr[lo] + arr[hi];
        fr.push({ arr, lo, hi, line: 2, vars: { lo, hi, s, target }, note: `a[${lo}] + a[${hi}] = ${arr[lo]} + ${arr[hi]} = <b>${s}</b>.` });
        if (s === target) { fr.push({ arr, lo, hi, found: true, line: 3, vars: { lo, hi, s, target }, note: `<b>Found it.</b> Indices ${lo} and ${hi}.` }); return fr; }
        if (s < target) { lo++; fr.push({ arr, lo, hi, line: 4, vars: { lo, hi, s, target }, note: `${s} &lt; ${target}: everything paired with a[${lo - 1}] is too small, so discard it.` }); }
        else { hi--; fr.push({ arr, lo, hi, line: 5, vars: { lo, hi, s, target }, note: `${s} &gt; ${target}: everything paired with a[${hi + 1}] is too big, so discard it.` }); }
      }
      fr.push({ arr, lo, hi, line: 6, vars: { lo, hi, target }, note: "Pointers met: no pair sums to the target." });
      return fr;
    },
    render: (f) => Viz.array(f.arr, {
      ptrs: { lo: f.lo, hi: f.hi },
      cls: (i) => (f.found && (i === f.lo || i === f.hi) ? "done" : i === f.lo || i === f.hi ? "active" : i < f.lo || i > f.hi ? "dim" : ""),
    }),
  }));

  Viz.register("g-grid", (el) => Viz.player(el, {
    title: "Unique paths: dp[r][c] = dp[r-1][c] + dp[r][c-1]",
    legend: [["active", "computing"], ["visit", "depends on"], ["done", "filled"]],
    inputs: [{ key: "r", label: "rows", value: "4", width: 60 }, { key: "c", label: "cols", value: "5", width: 60 }],
    build: ({ r, c }) => {
      const R = Viz.parse.int(r, { min: 1, max: 7 }), C = Viz.parse.int(c, { min: 1, max: 8 });
      const dp = Array.from({ length: R }, () => Array(C).fill(null)), fr = [];
      fr.push({ dp: Viz.clone(dp), cur: null, note: "Each cell counts the paths that reach it moving only right or down." });
      for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) {
        dp[i][j] = i === 0 || j === 0 ? 1 : dp[i - 1][j] + dp[i][j - 1];
        fr.push({ dp: Viz.clone(dp), cur: [i, j], note: i === 0 || j === 0 ? `Edge cell (${i},${j}): only one way in.` : `(${i},${j}) = above ${dp[i - 1][j]} + left ${dp[i][j - 1]} = <b>${dp[i][j]}</b>` });
      }
      fr.push({ dp, cur: null, done: true, note: `Answer: <b>${dp[R - 1][C - 1]}</b> paths.` });
      return fr;
    },
    render: (f) => Viz.grid(f.dp, {
      rowLabels: f.dp.map((_, i) => `r${i}`), colLabels: f.dp[0].map((_, j) => `c${j}`),
      cls: (r, c, v) => {
        if (f.cur && r === f.cur[0] && c === f.cur[1]) return "active";
        if (f.cur && f.cur[0] && f.cur[1] && ((r === f.cur[0] - 1 && c === f.cur[1]) || (r === f.cur[0] && c === f.cur[1] - 1))) return "visit";
        if (f.done && r === f.dp.length - 1 && c === f.dp[0].length - 1) return "path";
        return v !== null ? "done" : "";
      },
    }),
  }));

  Viz.register("g-bfs", (el) => {
    const pts = { A: [0, 80], B: [110, 0], C: [110, 160], D: [230, 0], E: [230, 160], F: [350, 80], G: [460, 80] };
    const E = [["A", "B"], ["A", "C"], ["B", "D"], ["C", "E"], ["D", "F"], ["E", "F"], ["B", "C"], ["F", "G"]];
    const nodes = Object.entries(pts).map(([id, [x, y]]) => ({ id, x, y }));
    return Viz.player(el, {
      title: "Breadth-first search: shortest hops from A",
      legend: [["active", "dequeued"], ["visit", "in queue"], ["done", "finished"], ["path", "BFS tree edge"]],
      codeLang: "python",
      code: ["q = deque([src]); dist = {src: 0}", "while q:", "    u = q.popleft()", "    for v in adj[u]:", "        if v not in dist:", "            dist[v] = dist[u] + 1; q.append(v)"],
      build: () => {
        const adj = {}; for (const [u, v] of E) { (adj[u] ||= []).push(v); (adj[v] ||= []).push(u); }
        const dist = { A: 0 }, q = ["A"], done = new Set(), tree = new Set(), fr = [];
        const snap = (extra) => ({ dist: { ...dist }, q: [...q], done: new Set(done), tree: new Set(tree), ...extra });
        fr.push(snap({ line: 0, note: "Seed the queue with A at distance 0.", vars: { q: q.join(" ") } }));
        while (q.length) {
          const u = q.shift();
          fr.push(snap({ u, line: 2, note: `Pop <b>${u}</b> (distance ${dist[u]}). Its unvisited neighbours are one hop further.`, vars: { u, "dist[u]": dist[u] } }));
          for (const v of adj[u].sort()) {
            if (!(v in dist)) { dist[v] = dist[u] + 1; q.push(v); tree.add(`${u}-${v}`); fr.push(snap({ u, v, line: 5, note: `Discover ${v}: dist = ${dist[v]}. Enqueue it.`, vars: { u, v, "dist[v]": dist[v] } })); }
          }
          done.add(u);
        }
        fr.push(snap({ line: 1, note: "Queue empty. Every node's distance is its fewest-edge count from A.", vars: {} }));
        return fr;
      },
      render: (f) => Viz.row(
        Viz.graph({ nodes: nodes.map((n) => ({ ...n, sub: f.dist[n.id] })), edges: E.map(([u, v]) => ({ u, v })) }, {
          nodeCls: (id) => (id === f.u ? "active" : f.done.has(id) ? "done" : f.q.includes(id) ? "visit" : ""),
          edgeCls: (k) => (f.tree.has(k) ? "path" : ""),
        }),
        Viz.queue(f.q, { cls: (i, v) => (v === f.v ? "visit" : "") }),
      ),
    });
  });

  Viz.register("g-tree", (el) => Viz.player(el, {
    title: "Inorder traversal from a LeetCode level-order array",
    legend: [["active", "visiting"], ["done", "emitted"]],
    inputs: [{ key: "t", label: "tree", value: "4,2,6,1,3,5,7" }],
    build: ({ t }) => {
      const arr = String(t).split(",").map((s) => s.trim()).map((s) => (s === "null" || s === "" ? null : Number(s)));
      if (arr.length > 31) throw new Error("Use at most 31 entries.");
      const tree = Viz.treeFromArray(arr);
      if (!tree.nodes.length) throw new Error("Empty tree.");
      const kids = {}; for (const e of tree.edges) (kids[e.u] ||= []).push(e.v);
      const nodeX = Object.fromEntries(tree.nodes.map((n) => [n.id, n.x]));
      const fr = [], out = [];
      const go = (id) => {
        if (id === undefined) return;
        const ch = (kids[id] || []).sort((a, b) => nodeX[a] - nodeX[b]);
        const left = ch.find((c) => nodeX[c] < nodeX[id]), right = ch.find((c) => nodeX[c] > nodeX[id]);
        fr.push({ tree, cur: id, out: [...out], note: `At ${arr[id]}: go left first.` });
        go(left);
        out.push(id);
        fr.push({ tree, cur: id, out: [...out], note: `Left side finished, so emit <b>${arr[id]}</b>, then go right.` });
        go(right);
      };
      go(0);
      fr.push({ tree, cur: null, out: [...out], note: `Inorder: ${out.map((i) => arr[i]).join(", ")}. On a BST that is sorted order.` });
      return fr.map((f) => ({ ...f, arr }));
    },
    render: (f) => Viz.row(
      Viz.graph(f.tree, { nodeCls: (id) => (Number(id) === f.cur ? "active" : f.out.includes(Number(id)) ? "done" : "") }),
      Viz.array(f.out.map((i) => f.arr[i]), { label: "output", showIdx: false }),
    ),
  }));

  Viz.register("g-linear", (el) => Viz.player(el, {
    title: "Renderer sampler: bars · stack · queue · linked list",
    frames: [0, 1, 2, 3].map((k) => ({ k, note: ["Bars suit sorting and histograms.", "Stack: push grows the top.", "Queue: enqueue at the back, dequeue at the front.", "Linked list with named pointers."][k] })),
    render: (f) => Viz.row(
      Viz.bars([5, 2, 8, 3, 6], { cls: (i) => (f.k === 0 && i === 2 ? "active" : "") }),
      Viz.stack(["(", "[", "{"].slice(0, 1 + f.k % 3), { cls: (i) => (i === 0 ? "active" : "") }),
      Viz.queue(["A", "B", "C"].slice(f.k === 2 ? 1 : 0), { cls: (i) => (i === 0 ? "visit" : "") }),
      Viz.list([1, 2, 3, 4], { ptrs: { slow: 1, fast: 3 }, cls: (i) => (f.k === 3 && (i === 1 || i === 3) ? "active" : "") }),
    ),
  }));
})();
