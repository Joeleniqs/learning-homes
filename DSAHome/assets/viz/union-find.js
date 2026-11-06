/* Union-Find (Disjoint Set Union) visualizers. Every frame comes from running the real algorithm on your input. */
(() => {
  const S = "union-find";
  const P = (name) => `${S}-${name}`;
  const esc = Viz.esc;
  const col = (...h) => `<div class="uf-col">${h.filter(Boolean).join("")}</div>`;
  const badge = (html, c = "") => `<span class="uf-badge ${c}">${html}</span>`;
  const fmtN = (x) => (Number.isInteger(x) ? String(x) : String(+x.toPrecision(4)));
  const G6 = 6;

  /* Draw a parent array as a forest: every node points UP at its parent, roots sit on the top row. */
  function forest(parent, o = {}) {
    const n = parent.length, kids = Array.from({ length: n }, () => []), roots = [];
    for (let i = 0; i < n; i++) (parent[i] === i ? roots : kids[parent[i]]).push(i);
    const order = o.rootOrder ? o.rootOrder(roots) : roots;
    const nodes = [], edges = [];
    let off = 0;
    for (const r of order) {
      const t = Viz.layoutTree(r, (id) => kids[id], (id) => (o.label ? o.label(id) : String(id)), { dx: o.dx || 44, dy: o.dy || 56 });
      const xs = t.nodes.map((q) => q.x), mn = Math.min(...xs), mx = Math.max(...xs);
      t.nodes.forEach((q) => nodes.push({ ...q, x: q.x - mn + off, sub: o.sub ? o.sub(q.id) : undefined }));
      t.edges.forEach((e) => edges.push({ u: e.v, v: e.u, w: o.w ? o.w(e.v) : undefined }));
      off += mx - mn + Math.max(o.gap || 48, 2 * (o.r || 17) + 18);
    }
    return Viz.graph({ nodes, edges }, { directed: true, r: o.r || 17, label: o.caption, nodeCls: o.nodeCls, edgeCls: o.edgeCls });
  }

  /* Group colour per component, stable by smallest member. */
  function groupClass(parent, findRoot) {
    const n = parent.length, members = new Map();
    for (let i = 0; i < n; i++) { const r = findRoot(i); (members.get(r) || members.set(r, []).get(r)).push(i); }
    const multi = [...members.values()].filter((m) => m.length > 1).sort((a, b) => a[0] - b[0]);
    const cls = new Map();
    multi.forEach((m, k) => m.forEach((i) => cls.set(i, `uf-g${k % G6}`)));
    return (i) => cls.get(i) || "";
  }
  const rootOf = (parent) => (x) => { while (parent[x] !== x) x = parent[x]; return x; };

  /* ---------- 1. The core operations: find, union, size/rank, path compression ---------- */
  Viz.register(P("ops"), (el, opts) => Viz.player(el, {
    title: "find and union on a parent array, drawn as a forest",
    tag: "EDIT THE OPERATIONS",
    legend: [["active", "current node / new link"], ["visit", "path walked by find"], ["done", "root found"], ["path", "re-pointed by compression"]],
    codeLang: "python",
    code: [
      "def find(x):",
      "    root = x",
      "    while parent[root] != root:   # walk up to the root",
      "        root = parent[root]",
      "    while x != root:              # path compression",
      "        parent[x], x = root, parent[x]",
      "    return root",
      "def union(a, b):",
      "    ra, rb = find(a), find(b)",
      "    if ra == rb: return False     # already one set",
      "    if size[ra] < size[rb]:       # union by size",
      "        ra, rb = rb, ra",
      "    parent[rb] = ra               # small tree under big root",
      "    size[ra] += size[rb]",
      "    return True",
    ],
    inputs: [
      { key: "n", label: "n", value: String(opts.n || 8), width: 50 },
      { key: "ops", label: "operations (union a b · find x · connected a b)", value: opts.ops || "union 0 1, union 2 3, union 1 3, union 4 5, union 6 7, union 5 7, union 3 7, find 6, connected 2 7", width: 430 },
      { key: "um", label: "union", type: "select", options: ["by size", "by rank", "naive (no balancing)"], value: "by size" },
      { key: "fm", label: "find", type: "select", options: ["path compression", "no compression"], value: "path compression" },
    ],
    random: () => {
      const n = Viz.rand(6, 10), ops = [];
      for (let k = 0; k < n; k++) ops.push(`union ${Viz.rand(0, n - 1)} ${Viz.rand(0, n - 1)}`);
      ops.push(`find ${Viz.rand(0, n - 1)}`, `connected ${Viz.rand(0, n - 1)} ${Viz.rand(0, n - 1)}`);
      return { n: String(n), ops: ops.join(", ") };
    },
    build: ({ n, ops, um, fm }) => {
      n = Viz.parse.int(n, { min: 2, max: 12 });
      const list = String(ops).split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^(union|u|find|f|connected|conn|c)\s+(\d+)(?:\s+(\d+))?$/i);
        if (!m) throw new Error(`Cannot read "${t}". Use: union a b, find x, connected a b.`);
        const k = m[1][0].toLowerCase();
        const a = +m[2], b = m[3] === undefined ? null : +m[3];
        if ((k === "f") !== (b === null)) throw new Error(`"${t}": find takes one node, union and connected take two.`);
        if (a >= n || (b !== null && b >= n)) throw new Error(`"${t}": nodes must be 0..${n - 1}.`);
        return { k, a, b };
      });
      if (!list.length || list.length > 16) throw new Error("Use 1 to 16 operations.");
      const parent = Array.from({ length: n }, (_, i) => i), size = Array(n).fill(1), rank = Array(n).fill(0);
      const compress = fm === "path compression", mode = um.startsWith("by size") ? "size" : um.startsWith("by rank") ? "rank" : "naive";
      let hops = 0, sets = n;
      const fr = [];
      const snap = (x) => fr.push({ parent: [...parent], size: [...size], rank: [...rank], mode, ...x, vars: { sets, "hops so far": hops, ...(x.vars || {}) } });
      snap({ line: [], note: `${n} singletons: <b>parent[i] = i</b> for every i, so every node is its own root. A set is identified by its root; two nodes are connected exactly when their roots are equal.` });
      const find = (x, tag) => {
        const path = [x];
        let r = x;
        snap({ cur: x, path: [x], line: [0, 1], vars: { [tag]: x }, note: `find(${x}): start at ${x} and follow parent pointers upward until a node points at itself.` });
        while (parent[r] !== r) {
          r = parent[r]; path.push(r); hops++;
          snap({ cur: r, path: [...path], line: [2, 3], vars: { [tag]: x, root: r }, note: `parent[${path[path.length - 2]}] = ${r}, so step up to ${r}.${parent[r] === r ? ` parent[${r}] = ${r}: <b>${r} is the root</b>.` : ""} Every step is one pointer hop; the cost of find is the depth of x.` });
        }
        if (path.length === 1) snap({ cur: x, root: x, path, line: [2, 6], vars: { [tag]: x, root: x }, note: `parent[${x}] = ${x}: ${x} is already a root. Zero hops.` });
        if (compress && path.length > 2) {
          const moved = path.slice(0, -2);
          moved.forEach((y) => { parent[y] = r; });
          snap({ root: r, moved, path, line: [4, 5, 6], vars: { [tag]: x, root: r, "re-pointed": moved.join(" ") }, note: `<b>Path compression</b>: ${moved.join(", ")} ${moved.length > 1 ? "were" : "was"} on the path, so point ${moved.length > 1 ? "them" : "it"} straight at root ${r}. The answer did not change (same root), but the tree is now flatter: the next find from ${moved.join(" or ")} costs one hop.` });
        } else if (path.length > 1) snap({ root: r, path, line: [6], vars: { [tag]: x, root: r }, note: `find(${x}) = <b>${r}</b> after ${path.length - 1} hop(s).${compress ? " The path has no node to re-point (only the root's child), so compression changes nothing." : " Without compression the path stays as long as it is."}` });
        return r;
      };
      for (const op of list) {
        if (op.k === "f") { find(op.a, "x"); continue; }
        if (op.k === "c") {
          const ra = find(op.a, "a"), rb = find(op.b, "b");
          snap({ root: ra, cur: rb, line: [], vars: { ra, rb }, note: `connected(${op.a}, ${op.b}): roots ${ra} and ${rb} are ${ra === rb ? "<b>equal</b>, so yes, they are in the same set" : "<b>different</b>, so no"}.`, verdict: ra === rb ? "done" : "bad" });
          continue;
        }
        const { a, b } = op;
        let ra = find(a, "a"), rb = find(b, "b");
        if (ra === rb) { snap({ root: ra, line: [8, 9], vars: { ra, rb }, note: `union(${a}, ${b}): both roots are ${ra}. They are already in one set, so nothing changes. In a graph, this edge would close a cycle (a <i>redundant</i> edge).`, verdict: "bad" }); continue; }
        let why;
        if (mode === "size") {
          if (size[ra] < size[rb]) { why = `size[${ra}] = ${size[ra]} &lt; size[${rb}] = ${size[rb]}, so swap: the bigger tree's root stays on top.`; [ra, rb] = [rb, ra]; }
          else why = `size[${ra}] = ${size[ra]} ≥ size[${rb}] = ${size[rb]}: ${ra} stays the root.`;
        } else if (mode === "rank") {
          if (rank[ra] < rank[rb]) { why = `rank[${ra}] = ${rank[ra]} &lt; rank[${rb}] = ${rank[rb]}, so swap: hang the shallower tree.`; [ra, rb] = [rb, ra]; }
          else why = `rank[${ra}] = ${rank[ra]} ≥ rank[${rb}] = ${rank[rb]}: ${ra} stays the root.`;
        } else why = `Naive mode: no comparison, ${rb} always goes under ${ra}, however tall either tree is.`;
        parent[rb] = ra; sets--;
        let extra = "";
        if (mode === "size") { size[ra] += size[rb]; extra = ` size[${ra}] becomes ${size[ra]}.`; }
        else if (mode === "rank") { if (rank[ra] === rank[rb]) { rank[ra]++; extra = ` Equal ranks, so rank[${ra}] grows to ${rank[ra]}: the only way height can increase.`; } else extra = ` Ranks differ, so no rank changes: the shorter tree fits under without making it taller.`; }
        snap({ link: [rb, ra], root: ra, line: mode === "naive" ? [12, 14] : [10, 11, 12, 13], vars: { ra, rb }, note: `union(${a}, ${b}): ${why} Set <b>parent[${rb}] = ${ra}</b>.${extra} One pointer write merges two whole sets.` });
      }
      const fr0 = rootOf(parent);
      const groups = {};
      for (let i = 0; i < n; i++) (groups[fr0(i)] ||= []).push(i);
      snap({ line: [], final: true, note: `Done: ${sets} set(s): ${Object.values(groups).map((g) => `{${g.join(", ")}}`).join(" ")}. Total pointer hops: <b>${hops}</b>. Try the same operations with “naive” and “no compression” and compare the hops and the height of the trees.` });
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path || []), moved = new Set(f.moved || []);
      const n = f.parent.length;
      const cls = (i) => (moved.has(i) ? "path" : f.link && i === f.link[0] ? "active" : i === f.cur ? "active" : i === f.root ? "done" : path.has(i) ? "visit" : "");
      const pe = new Set();
      (f.path || []).forEach((x, k, arr) => { if (k < arr.length - 1) pe.add(`${x}-${arr[k + 1]}`); });
      const sub = (i) => (f.parent[i] !== i || f.mode === "naive" ? undefined : f.mode === "size" ? `s=${f.size[i]}` : `r=${f.rank[i]}`);
      const fg = forest(f.parent, {
        caption: "forest (arrows point to the parent)", sub,
        nodeCls: (id) => `${cls(+id)}${f.parent[+id] === +id ? " uf-root" : ""}`,
        edgeCls: (k) => { const [u] = k.split("-").map(Number); return moved.has(u) ? "path" : f.link && u === f.link[0] ? "active" : pe.has(k) ? "visit" : ""; },
      });
      const arr = Viz.array(f.parent, { label: "parent[i]", cls: (i) => cls(i) || (f.parent[i] === i ? "uf-selfroot" : "") });
      const aux = f.mode === "naive" ? "" : Viz.array(f.mode === "size" ? f.size : f.rank, { label: f.mode === "size" ? "size[i] (valid at roots)" : "rank[i] (valid at roots)", cls: (i) => (f.parent[i] === i ? "" : "dim") });
      return col(fg, arr, aux, f.verdict ? badge(f.verdict === "done" ? "same set" : "different sets / already joined", f.verdict) : "");
    },
  }));

  /* ---------- 2. Path compression vs path halving on any forest ---------- */
  Viz.register(P("compress"), (el, opts) => Viz.player(el, {
    title: "Flattening a tall tree: two-pass compression vs path halving",
    tag: "EDIT THE PARENT ARRAY",
    legend: [["active", "x (current)"], ["visit", "walked"], ["done", "root"], ["path", "pointer just rewritten"]],
    codeLang: "python",
    code: [
      "# two-pass path compression",
      "def find(x):",
      "    root = x",
      "    while parent[root] != root: root = parent[root]",
      "    while x != root:",
      "        parent[x], x = root, parent[x]",
      "    return root",
      "# path halving: one pass, no second loop",
      "def find(x):",
      "    while parent[x] != x:",
      "        parent[x] = parent[parent[x]]  # skip one level",
      "        x = parent[x]",
      "    return x",
    ],
    inputs: [
      { key: "p", label: "parent array (parent[i] = i marks a root)", value: opts.p || "0,0,1,2,3,4,5,6,3,8", width: 250 },
      { key: "q", label: "finds", value: opts.q || "7, 9, 7", width: 90 },
      { key: "m", label: "method", type: "select", options: ["two-pass compression", "path halving", "no compression"], value: opts.m || "two-pass compression" },
    ],
    random: () => {
      const n = Viz.rand(7, 11), p = [0];
      for (let i = 1; i < n; i++) p.push(Math.random() < 0.7 ? i - 1 : Viz.rand(0, i - 1));
      return { p: p.join(","), q: `${n - 1}, ${Viz.rand(1, n - 2)}, ${n - 1}` };
    },
    build: ({ p, q, m }) => {
      const parent = Viz.parse.ints(p, { min: 1, max: 12 });
      const n = parent.length;
      parent.forEach((x) => { if (!Number.isInteger(x) || x < 0 || x >= n) throw new Error(`Every parent must be an index 0..${n - 1}.`); });
      for (let i = 0; i < n; i++) { let x = i, k = 0; while (parent[x] !== x) { x = parent[x]; if (++k > n) throw new Error("The parent array has a cycle; every chain must end at a root (parent[r] = r)."); } }
      const qs = Viz.parse.ints(q, { min: 1, max: 6 });
      qs.forEach((x) => { if (x < 0 || x >= n) throw new Error(`Finds must be nodes 0..${n - 1}.`); });
      const fr = [], log = [];
      const depth = (x) => { let d = 0; while (parent[x] !== x) { x = parent[x]; d++; } return d; };
      const height = () => Math.max(...parent.map((_, i) => depth(i)));
      const snap = (x) => fr.push({ parent: [...parent], log: [...log], ...x, vars: { height: height(), ...(x.vars || {}) } });
      snap({ line: [], note: `The starting forest has height ${height()}: the deepest node needs ${height()} hops to reach its root. Each find below runs with <b>${m}</b>. Watch how the second find of the same node costs.` });
      for (const x0 of qs) {
        let hops = 0;
        if (m === "path halving") {
          let x = x0;
          snap({ cur: x, line: [8], vars: { x }, note: `find(${x0}) with path halving: one upward pass, and at every step make x point to its <b>grandparent</b>.` });
          while (parent[x] !== x) {
            const old = parent[x], gp = parent[old];
            parent[x] = gp; hops++;
            snap({ cur: x, rewired: old !== gp ? x : null, line: [9, 10], vars: { x, "old parent": old, "new parent": gp }, note: old !== gp ? `parent[${x}] was ${old}; set it to its grandparent ${gp}. ${x} skips a level, and the tree gets shallower as a side effect of walking.` : `parent[${x}] = ${old} is the root (its own parent), so the grandparent is the same node. Nothing to skip.` });
            x = parent[x];
            snap({ cur: x, line: [11], vars: { x }, note: parent[x] === x ? `Jump to ${x}. It is a root: find(${x0}) = <b>${x}</b> after ${hops} step(s).` : `Jump to ${x} (two levels up from where we were, except at the top). Halving touches every <i>other</i> node of the path, which is why it halves the path length.` });
          }
          log.push(`find(${x0}) = ${x}: ${hops} step(s)`);
          snap({ root: x, line: [12], note: `Returned ${x}. Compare the height before and after: halving gets most of compression's benefit with a single loop and no recursion.` });
          continue;
        }
        const path = [x0]; let r = x0;
        snap({ cur: x0, path: [x0], line: [1, 2], vars: { x: x0 }, note: `find(${x0}): first pass, walk up to the root.` });
        while (parent[r] !== r) { r = parent[r]; path.push(r); hops++; snap({ cur: r, path: [...path], line: [3], vars: { x: x0, root: r, hops }, note: `Up to ${r}.${parent[r] === r ? ` It points at itself: the root is <b>${r}</b>, reached in ${hops} hop(s).` : ""}` }); }
        if (m === "two-pass compression") {
          for (const y of path.slice(0, -2)) {
            parent[y] = r;
            snap({ root: r, path, rewired: y, line: [4, 5], vars: { x: y, root: r }, note: `Second pass: parent[${y}] = ${r}. ${y} (and its whole subtree) now hangs directly under the root.` });
          }
        }
        log.push(`find(${x0}) = ${r}: ${hops} hop(s)`);
        snap({ root: r, path, line: [6], note: m === "no compression" ? `Returned ${r} after ${hops} hops. Nothing was rewritten, so repeating find(${x0}) costs ${hops} hops again, every single time.` : `Returned ${r}. Every node that was on the path is now a child of the root: repeat find(${x0}) and it costs at most 1 hop.` });
      }
      snap({ line: [], final: true, note: `Hops per find: ${log.join(" · ")}. Path compression spends a second pass once to make every later find on those nodes O(1). Combined with union by rank or size, the amortized cost per operation is O(α(n)), at most 4 for any input that fits in the universe.` });
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path || []);
      const cls = (i) => (i === f.rewired ? "path" : i === f.cur ? "active" : i === f.root ? "done" : path.has(i) ? "visit" : "");
      return Viz.row(
        forest(f.parent, { caption: "forest", dy: 50, nodeCls: (id) => `${cls(+id)}${f.parent[+id] === +id ? " uf-root" : ""}`, edgeCls: (k) => (+k.split("-")[0] === f.rewired ? "path" : "") }),
        col(Viz.array(f.parent, { label: "parent[i]", cls }), f.log.length ? `<div class="uf-log">${f.log.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : ""),
      );
    },
  }));

  /* ---------- 3. Height race: why balancing matters ---------- */
  const STRATS = [
    { key: "naive", label: "naive", bal: false, comp: false },
    { key: "naive+pc", label: "naive + compression", bal: false, comp: true },
    { key: "size", label: "by size", bal: true, comp: false },
    { key: "size+pc", label: "by size + compression", bal: true, comp: true },
  ];
  Viz.register(P("race"), (el, opts) => Viz.player(el, {
    title: "Four strategies, one sequence of unions: tree height and total work",
    tag: "RACE",
    legend: [["bad", "naive"], ["active", "naive + compression"], ["visit", "by size"], ["done", "by size + compression"]],
    inputs: [
      { key: "n", label: "n (4–48)", value: String(opts.n || 16), width: 60 },
      { key: "pat", label: "pattern", type: "select", options: ["union(i, 0): new node on top", "union(i, i+1): grow a chain", "pairs, then pairs of pairs", "random"], value: "union(i, 0): new node on top" },
    ],
    random: () => ({ n: String(Viz.rand(10, 40)), pat: "random" }),
    build: ({ n, pat }) => {
      n = Viz.parse.int(n, { min: 4, max: 48 });
      const ops = [];
      if (pat.startsWith("union(i, 0)")) for (let i = 1; i < n; i++) ops.push([i, 0]);
      else if (pat.startsWith("union(i, i+1)")) for (let i = 0; i + 1 < n; i++) ops.push([i, i + 1]);
      else if (pat.startsWith("pairs")) for (let s = 1; s < n; s *= 2) for (let i = 0; i + s < n; i += 2 * s) ops.push([i, i + s]);
      else for (let k = 0; k < n + 4; k++) ops.push([Viz.rand(0, n - 1), Viz.rand(0, n - 1)]);
      const st = STRATS.map((s) => ({ ...s, parent: Array.from({ length: n }, (_, i) => i), size: Array(n).fill(1), hops: 0 }));
      const find = (s, x) => {
        let r = x;
        while (s.parent[r] !== r) { r = s.parent[r]; s.hops++; }
        if (s.comp) while (x !== r) { const nx = s.parent[x]; s.parent[x] = r; x = nx; }
        return r;
      };
      const height = (s) => { let h = 0; for (let i = 0; i < n; i++) { let x = i, d = 0; while (s.parent[x] !== x) { x = s.parent[x]; d++; } h = Math.max(h, d); } return h; };
      const fr = [];
      const snap = (k, note) => fr.push({ n, k, ops, rows: st.map((s) => ({ label: s.label, h: height(s), hops: s.hops })), note });
      snap(-1, `${n} singletons. The pattern performs ${ops.length} unions. Each union calls find twice; we count every pointer hop as one unit of work.`);
      ops.forEach(([a, b], k) => {
        for (const s of st) {
          let ra = find(s, a), rb = find(s, b);
          if (ra === rb) continue;
          if (s.bal && s.size[ra] < s.size[rb]) [ra, rb] = [rb, ra];
          s.parent[rb] = ra; s.size[ra] += s.size[rb];
        }
        const r = fr.length;
        let note = `union(${a}, ${b}).`;
        const naive = st[0], sz = st[2];
        if (pat.startsWith("union(i, 0)")) note += ` Naive puts the new singleton ${a} <b>on top</b> of the whole tree, so 0 sinks one level deeper every time and find(0) walks the entire chain: height ${height(naive)}, ${naive.hops} hops so far, heading for n²/2. By size hangs the singleton under the big root instead: height stays ${height(sz)}.`;
        else if (pat.startsWith("pairs")) note += ` Merging equal-sized trees is the worst case for balancing: height grows by one only when the size doubles, so it can never exceed log₂ n = ${Math.log2(n).toFixed(1)}.`;
        else if (pat.startsWith("union(i, i+1)")) note += ` find(i) and find(i+1) are both cheap here (the chain's root is a neighbour), but naive still builds a tall chain: height ${height(naive)}. Any later find from the bottom pays for it.`;
        else note += " Random unions: even naive trees stay fairly shallow on average. The guarantees matter for adversarial inputs, and interview inputs are often adversarial.";
        if (r) snap(k, note);
      });
      const best = fr[fr.length - 1].rows;
      snap(ops.length, `Final heights: ${best.map((r) => `${r.label} ${r.h}`).join(", ")}. Hops: ${best.map((r) => `${r.label} ${r.hops}`).join(", ")}. Balancing alone guarantees height ≤ log₂ n; compression alone gives O(log n) amortized; <b>both together give O(α(n))</b> amortized, effectively constant.`);
      return fr;
    },
    render: (f) => {
      const maxH = Math.max(1, ...f.rows.map((r) => r.h)), maxW = Math.max(1, ...f.rows.map((r) => r.hops));
      const cls = ["bad", "active", "visit", "done"];
      const bar = (v, mx, c) => `<div class="uf-bar"><div class="uf-fill ${c}" style="width:${Math.max(2, (v / mx) * 100)}%"></div><b>${v}</b></div>`;
      const rows = f.rows.map((r, i) => `<div class="uf-race-l">${esc(r.label)}</div>${bar(r.h, maxH, cls[i])}${bar(r.hops, maxW, cls[i])}`).join("");
      const cur = f.k >= 0 && f.k < f.ops.length ? `union(${f.ops[f.k][0]}, ${f.ops[f.k][1]}) · op ${f.k + 1} of ${f.ops.length}` : f.k < 0 ? "before any union" : "all unions done";
      return `<div class="uf-race"><div class="uf-race-h"></div><div class="uf-race-h">tree height (max depth)</div><div class="uf-race-h">total pointer hops</div>${rows}</div><div class="uf-math">${esc(cur)} · log₂ n = ${Math.log2(f.n).toFixed(2)}</div>`;
    },
  }));

  /* ---------- 4. Connectivity: components and redundant edges ---------- */
  function parseEdges(text, maxN = 12, maxE = 20) {
    const toks = String(text).split(/[,;\s]+/).filter(Boolean);
    const edges = toks.map((t) => {
      const m = t.match(/^(\d+)-(\d+)$/);
      if (!m) throw new Error(`Cannot read "${t}". Write edges as u-v with numbers, e.g. 0-1, 1-2.`);
      if (+m[1] >= maxN || +m[2] >= maxN) throw new Error(`Use node numbers 0..${maxN - 1}.`);
      if (m[1] === m[2]) throw new Error(`Self-loop "${t}" is not allowed.`);
      return [+m[1], +m[2]];
    });
    if (!edges.length || edges.length > maxE) throw new Error(`Use 1 to ${maxE} edges.`);
    return edges;
  }
  const circlePos = (n, rad) => Viz.layout.circle(Array.from({ length: n }, (_, i) => i), rad || Math.max(80, n * 18));

  Viz.register(P("components"), (el, opts) => Viz.player(el, {
    title: "Edges stream in; components merge; a cycle-closing edge is caught instantly",
    tag: "NUMBER OF PROVINCES · REDUNDANT CONNECTION",
    legend: [["active", "edge being processed"], ["done", "edge that merged two sets"], ["bad", "redundant edge (closes a cycle)"], ["dim", "not processed yet"]],
    codeLang: "python",
    code: [
      "dsu = DSU(n); comps = n; redundant = []",
      "for u, v in edges:",
      "    ru, rv = dsu.find(u), dsu.find(v)",
      "    if ru == rv:                # already connected",
      "        redundant.append((u, v))  # this edge closes a cycle",
      "        continue",
      "    dsu.union(ru, rv)           # by size + compression",
      "    comps -= 1",
      "return comps, redundant",
    ],
    inputs: [
      { key: "n", label: "n", value: String(opts.n || 9), width: 50 },
      { key: "e", label: "edges", value: opts.e || "0-1, 2-3, 1-2, 4-5, 0-3, 6-7, 5-6, 7-4, 3-1", width: 330 },
    ],
    random: () => {
      const n = Viz.rand(6, 10), set = new Set(), out = [];
      for (let k = 0; k < n + Viz.rand(-2, 2); k++) { const a = Viz.rand(0, n - 1), b = Viz.rand(0, n - 1), key = [a, b].sort().join("-"); if (a !== b && !set.has(key)) { set.add(key); out.push(`${a}-${b}`); } }
      return { n: String(n), e: out.join(", ") };
    },
    build: ({ n, e }) => {
      n = Viz.parse.int(n, { min: 2, max: 12 });
      const edges = parseEdges(e, n);
      const parent = Array.from({ length: n }, (_, i) => i), size = Array(n).fill(1);
      const find = (x) => { let r = x; while (parent[r] !== r) r = parent[r]; while (x !== r) { const nx = parent[x]; parent[x] = r; x = nx; } return r; };
      let comps = n;
      const status = Array(edges.length).fill(""), red = [], fr = [];
      const snap = (x) => fr.push({ n, edges, parent: [...parent], status: [...status], ...x, vars: { comps, ...(x.vars || {}) } });
      snap({ k: -1, line: [0], note: `${n} nodes and no edges yet: ${n} components. We never build an adjacency list. Each edge is one question: “are u and v already connected?”` });
      edges.forEach(([u, v], k) => {
        const ru = find(u), rv = find(v);
        snap({ k, cur: [u, v], line: [1, 2], vars: { u, v, ru, rv }, note: `Edge ${u}–${v}: find(${u}) = ${ru}, find(${v}) = ${rv}.` });
        if (ru === rv) {
          status[k] = "bad"; red.push(`${u}-${v}`);
          snap({ k, cur: [u, v], line: [3, 4, 5], vars: { u, v, ru, rv }, note: `Same root ${ru}: ${u} and ${v} were <b>already connected</b> through earlier edges, so this edge closes a cycle. For Redundant Connection, the last such edge is the answer. The component count does not change.` });
          return;
        }
        let a = ru, b = rv; if (size[a] < size[b]) [a, b] = [b, a];
        parent[b] = a; size[a] += size[b]; comps--; status[k] = "done";
        snap({ k, cur: [u, v], line: [6, 7], vars: { u, v, ru, rv }, note: `Different roots: merge. parent[${b}] = ${a} (the smaller set goes under the larger). Two components became one: <b>${comps}</b> left.` });
      });
      snap({ k: edges.length, line: [8], final: true, vars: { redundant: red.join(" ") || "none" }, note: `Done. <b>${comps}</b> component(s)${red.length ? `; redundant edges: ${red.join(", ")} (each closed a cycle when it arrived)` : "; no edge closed a cycle, so the edges form a forest"}. Cost: O(E·α(n)), with no adjacency list and no recursion.` });
      return fr;
    },
    render: (f) => {
      const g = groupClass(f.parent, rootOf(f.parent)), cur = new Set(f.cur || []);
      const fr = rootOf(f.parent);
      const nodes = circlePos(f.n).map((p) => ({ ...p, sub: `r${fr(p.id)}` }));
      const edges = f.edges.map(([u, v], k) => ({ u, v, cls: k === f.k && !f.final ? (f.status[k] ? f.status[k] : "active") : f.status[k] || "dim" }));
      return Viz.row(
        Viz.graph({ nodes, edges }, { r: 18, label: "graph (colour = component, rX = root)", nodeCls: (id) => `${g(+id)}${cur.has(+id) ? " uf-cur" : ""}` }),
        col(
          forest(f.parent, { caption: "DSU forest", r: 15, dx: 38, dy: 48, gap: 30, nodeCls: (id) => `${g(+id)}${cur.has(+id) ? " uf-cur" : ""}${f.parent[+id] === +id ? " uf-root" : ""}` }),
          Viz.array(f.parent, { label: "parent[i]", cls: (i) => (cur.has(i) ? "active" : "") }),
        ),
      );
    },
  }));

  /* ---------- 5. Number of Islands II: land appears online ---------- */
  Viz.register(P("islands"), (el, opts) => Viz.player(el, {
    title: "Number of Islands II: add land one cell at a time, union with land neighbours",
    tag: "ONLINE CONNECTIVITY",
    legend: [["active", "cell just added"], ["visit", "land neighbour checked"]],
    codeLang: "python",
    code: [
      "parent = {}; count = 0; out = []",
      "for r, c in positions:",
      "    if (r, c) in parent: out.append(count); continue",
      "    parent[(r, c)] = (r, c); count += 1   # new island",
      "    for nr, nc in neighbours(r, c):",
      "        if (nr, nc) in parent:              # land",
      "            if union((r, c), (nr, nc)):",
      "                count -= 1                  # two islands joined",
      "    out.append(count)",
    ],
    inputs: [
      { key: "rc", label: "rows×cols", value: opts.rc || "4x5", width: 60 },
      { key: "pos", label: "positions r,c (in order)", value: opts.pos || "0 0; 0 1; 1 2; 2 1; 1 1; 3 3; 3 4; 2 3; 0 4", width: 330 },
    ],
    random: () => {
      const R = Viz.rand(3, 5), C = Viz.rand(4, 6), out = [];
      for (let k = 0; k < Viz.rand(7, 12); k++) out.push(`${Viz.rand(0, R - 1)} ${Viz.rand(0, C - 1)}`);
      return { rc: `${R}x${C}`, pos: out.join("; ") };
    },
    build: ({ rc, pos }) => {
      const m = String(rc).trim().match(/^(\d+)\s*[x×*]\s*(\d+)$/i);
      if (!m) throw new Error("Write the size as RxC, e.g. 4x5.");
      const R = +m[1], C = +m[2];
      if (R < 1 || C < 1 || R > 7 || C > 8) throw new Error("Use at most 7 rows and 8 columns.");
      const ps = String(pos).split(/;|\n/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const q = t.match(/^(\d+)[\s,]+(\d+)$/);
        if (!q || +q[1] >= R || +q[2] >= C) throw new Error(`"${t}" is not a cell inside the ${R}×${C} grid.`);
        return [+q[1], +q[2]];
      });
      if (!ps.length || ps.length > 20) throw new Error("Use 1 to 20 positions.");
      const parent = new Map(), size = new Map();
      const find = (x) => { let r = x; while (parent.get(r) !== r) r = parent.get(r); while (x !== r) { const nx = parent.get(x); parent.set(x, r); x = nx; } return r; };
      let count = 0;
      const out = [], fr = [];
      const snap = (x) => fr.push({ R, C, parent: new Map(parent), out: [...out], ...x, vars: { count, ...(x.vars || {}) } });
      snap({ line: [0], note: `An empty ${R}×${C} sea. Re-running a flood fill after every addition would cost O(R·C) per step; a DSU handles each new cell in O(α) time.` });
      for (const [r, c] of ps) {
        const id = r * C + c;
        if (parent.has(id)) { out.push(count); snap({ cur: id, line: [2], vars: { cell: `(${r},${c})` }, note: `(${r},${c}) is already land. Duplicate additions are a classic trap: without this check, count would grow by one for nothing.` }); continue; }
        parent.set(id, id); size.set(id, 1); count++;
        snap({ cur: id, line: [3], vars: { cell: `(${r},${c})` }, note: `New land at (${r},${c}): it starts as its own island, count = ${count}.` });
        const checked = [];
        for (const [dr, dc] of [[-1, 0], [0, 1], [1, 0], [0, -1]]) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
          const nid = nr * C + nc;
          if (!parent.has(nid)) continue;
          checked.push(nid);
          let a = find(id), b = find(nid);
          if (a === b) { snap({ cur: id, nb: [...checked], line: [4, 5, 6], vars: { cell: `(${r},${c})`, nbr: `(${nr},${nc})` }, note: `Neighbour (${nr},${nc}) is land but already in the same island (found through another neighbour). No change.` }); continue; }
          if (size.get(a) < size.get(b)) [a, b] = [b, a];
          parent.set(b, a); size.set(a, size.get(a) + size.get(b)); count--;
          snap({ cur: id, nb: [...checked], line: [6, 7], vars: { cell: `(${r},${c})`, nbr: `(${nr},${nc})` }, note: `Neighbour (${nr},${nc}) belongs to a different island: union them, count drops to <b>${count}</b>. One new cell can merge up to four islands at once.` });
        }
        out.push(count);
        snap({ cur: id, line: [8], vars: { cell: `(${r},${c})` }, note: `Record count = ${count} for this addition.` });
      }
      snap({ line: [], final: true, note: `Answers: [${out.join(", ")}]. O(k·α(R·C)) for k additions. The cell id r·C + c turns 2-D cells into DSU indices.` });
      return fr;
    },
    render: (f) => {
      const grid = Array.from({ length: f.R }, (_, r) => Array.from({ length: f.C }, (_, c) => (f.parent.has(r * f.C + c) ? "" : "")));
      const findR = (x) => { while (f.parent.get(x) !== x) x = f.parent.get(x); return x; };
      const members = new Map();
      for (const k of f.parent.keys()) { const rt = findR(k); (members.get(rt) || members.set(rt, []).get(rt)).push(k); }
      const ordered = [...members.entries()].sort((a, b) => Math.min(...a[1]) - Math.min(...b[1]));
      const gi = new Map(); ordered.forEach(([rt], i) => gi.set(rt, i));
      const nb = new Set(f.nb || []);
      const g = Viz.grid(grid, {
        label: "grid (colour = island, text = root cell)", rowLabels: grid.map((_, r) => r), colLabels: grid[0].map((_, c) => c),
        fmt: (_, r, c) => { const id = r * f.C + c; if (!f.parent.has(id)) return ""; const rt = findR(id); return `${Math.floor(rt / f.C)},${rt % f.C}`; },
        cls: (r, c) => { const id = r * f.C + c; if (!f.parent.has(id)) return "uf-sea"; return `uf-g${gi.get(findR(id)) % G6}${id === f.cur ? " uf-curcell" : nb.has(id) ? " uf-nbcell" : ""}`; },
      });
      return Viz.row(g, col(Viz.labeled("answers so far", `<div class="uf-chips">${f.out.map((v, i) => `<span class="v-item ${i === f.out.length - 1 ? "done" : ""}">${v}</span>`).join("") || '<span class="uf-empty">none yet</span>'}</div>`), badge(`islands = ${f.vars.count}`, "done")));
    },
  }));

  /* ---------- 6. Weighted union-find: Evaluate Division ---------- */
  Viz.register(P("weighted"), (el, opts) => Viz.player(el, {
    title: "Weighted union-find: every pointer carries the ratio x / parent[x]",
    tag: "EVALUATE DIVISION",
    legend: [["active", "current"], ["visit", "on the find path"], ["done", "root"], ["path", "re-pointed with a multiplied weight"], ["bad", "unknown query"]],
    codeLang: "python",
    code: [
      "def find(x):                      # returns (root, x / root)",
      "    if parent[x] == x: return x, 1.0",
      "    r, w = find(parent[x])           # w = parent[x] / root",
      "    parent[x] = r",
      "    weight[x] *= w                   # x/root = x/p * p/root",
      "    return r, weight[x]",
      "def union(a, b, val):               # a / b = val",
      "    ra, wa = find(a); rb, wb = find(b)",
      "    if ra != rb:",
      "        parent[ra] = rb",
      "        weight[ra] = val * wb / wa   # ra / rb",
      "def query(a, b):",
      "    ra, wa = find(a); rb, wb = find(b)",
      "    return wa / wb if ra == rb else -1.0",
    ],
    inputs: [
      { key: "eq", label: "equations a/b=value", value: opts.eq || "a/b=2, b/c=3, d/e=4, c/e=0.5", width: 260 },
      { key: "q", label: "queries", value: opts.q || "a/c, e/a, a/x, d/b", width: 160 },
    ],
    random: () => {
      const L = "abcdef".split(""), out = [], qs = [];
      for (let i = 1; i < 6; i++) if (Math.random() < 0.8) out.push(`${L[Viz.rand(0, i - 1)]}/${L[i]}=${Viz.rand(1, 6)}`);
      for (let k = 0; k < 3; k++) qs.push(`${L[Viz.rand(0, 5)]}/${L[Viz.rand(0, 5)]}`);
      return { eq: out.join(", ") || "a/b=2", q: qs.join(", ") };
    },
    build: ({ eq, q }) => {
      const eqs = String(eq).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^([a-z]{1,2})\s*\/\s*([a-z]{1,2})\s*=\s*([0-9]*\.?[0-9]+)$/i);
        if (!m || +m[3] <= 0) throw new Error(`Cannot read "${t}". Use a/b=2 with names of 1–2 letters and a positive value.`);
        return [m[1].toLowerCase(), m[2].toLowerCase(), +m[3]];
      });
      if (!eqs.length || eqs.length > 8) throw new Error("Use 1 to 8 equations.");
      const qs = String(q).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^([a-z]{1,2})\s*\/\s*([a-z]{1,2})$/i);
        if (!m) throw new Error(`Cannot read query "${t}". Use a/c.`);
        return [m[1].toLowerCase(), m[2].toLowerCase()];
      });
      if (qs.length > 6) throw new Error("Use at most 6 queries.");
      const names = [...new Set(eqs.flatMap(([a, b]) => [a, b]))];
      if (names.length > 10) throw new Error("Use at most 10 distinct variables.");
      const id = new Map(names.map((x, i) => [x, i]));
      const parent = names.map((_, i) => i), weight = names.map(() => 1);
      const fr = [], answers = [];
      const snap = (x) => fr.push({ names, parent: [...parent], weight: [...weight], answers: [...answers], ...x });
      snap({ line: [], note: `Each variable is a node. The pointer x → parent[x] carries <b>weight[x] = x / parent[x]</b>. Then x / root is the product of the weights along the path, and any two variables in one tree can be divided through their common root.` });
      const find = (x, depth = 0) => {
        if (parent[x] === x) return [x, 1];
        const p = parent[x];
        const [r, w] = find(p, depth + 1);
        if (p !== r) {
          parent[x] = r; weight[x] *= w;
          snap({ cur: x, root: r, moved: x, line: [2, 3, 4], vars: { x: names[x], "x/root": fmtN(weight[x]) }, note: `Compress ${names[x]}: it pointed at ${names[p]} with ${names[x]}/${names[p]} = ${fmtN(weight[x] / w)}, and ${names[p]}/${names[r]} = ${fmtN(w)}. Multiply: <b>${names[x]}/${names[r]} = ${fmtN(weight[x])}</b>, and point straight at ${names[r]}.` });
        }
        return [r, weight[x]];
      };
      for (const [a, b, val] of eqs) {
        const ia = id.get(a), ib = id.get(b);
        snap({ cur: ia, other: ib, line: [6], vars: { a, b, val }, note: `Equation ${a} / ${b} = ${val}. Find both roots (compressing on the way) to learn a/root and b/root.` });
        const [ra, wa] = find(ia), [rb, wb] = find(ib);
        if (ra === rb) { snap({ cur: ia, other: ib, root: ra, line: [7, 8], vars: { a, b, [`${a}/root`]: fmtN(wa), [`${b}/root`]: fmtN(wb) }, note: `Already in one tree (root ${names[ra]}); the equation adds nothing new (valid inputs never contradict).` }); continue; }
        parent[ra] = rb; weight[ra] = (val * wb) / wa;
        snap({ cur: ia, other: ib, link: ra, root: rb, line: [7, 8, 9, 10], vars: { [`${a}/${names[ra]}`]: fmtN(wa), [`${b}/${names[rb]}`]: fmtN(wb), [`${names[ra]}/${names[rb]}`]: fmtN(weight[ra]) }, note: `Link root ${names[ra]} under root ${names[rb]}. Its weight must make the equation true: a = wa·ra and b = wb·rb, so ra / rb = val · wb / wa = ${val} · ${fmtN(wb)} / ${fmtN(wa)} = <b>${fmtN(weight[ra])}</b>.` });
      }
      for (const [a, b] of qs) {
        if (!id.has(a) || !id.has(b)) { answers.push(`${a}/${b} = -1`); snap({ line: [11, 13], qbad: true, vars: { query: `${a}/${b}` }, note: `${!id.has(a) ? a : b} never appeared in an equation: the answer is -1.0 (LeetCode's rule, even for x/x).` }); continue; }
        const ia = id.get(a), ib = id.get(b);
        const [ra, wa] = find(ia), [rb, wb] = find(ib);
        if (ra !== rb) { answers.push(`${a}/${b} = -1`); snap({ cur: ia, other: ib, qbad: true, line: [12, 13], vars: { query: `${a}/${b}` }, note: `Roots differ (${names[ra]} vs ${names[rb]}): no chain of equations links ${a} and ${b}, so -1.0.` }); continue; }
        answers.push(`${a}/${b} = ${fmtN(wa / wb)}`);
        snap({ cur: ia, other: ib, root: ra, line: [12, 13], vars: { query: `${a}/${b}`, [`${a}/root`]: fmtN(wa), [`${b}/root`]: fmtN(wb) }, note: `Same root ${names[ra]}: ${a}/${b} = (${a}/root) / (${b}/root) = ${fmtN(wa)} / ${fmtN(wb)} = <b>${fmtN(wa / wb)}</b>.` });
      }
      snap({ line: [], final: true, note: `Answers: ${answers.join(" · ") || "(no queries)"}. The same idea (“potential” or offset to the root) solves parity constraints, “is this equation set consistent?”, and relative positions.` });
      return fr;
    },
    render: (f) => {
      const cls = (i) => (i === f.moved ? "path" : i === f.link ? "active" : i === f.cur || i === f.other ? (f.qbad ? "bad" : "active") : i === f.root ? "done" : "");
      const fg = forest(f.parent, { caption: "forest, edge label = x / parent[x]", label: (i) => f.names[i], w: (i) => fmtN(f.weight[i]), dx: 56, dy: 66, nodeCls: (id) => `${cls(+id)}${f.parent[+id] === +id ? " uf-root" : ""}`, edgeCls: (k) => { const u = +k.split("-")[0]; return u === f.moved ? "path" : u === f.link ? "active" : ""; } });
      const tbl = Viz.grid([f.names.map((_, i) => f.names[f.parent[i]]), f.names.map((_, i) => fmtN(f.weight[i]))], { label: "parent and weight", colLabels: f.names, rowLabels: ["parent", "weight"], cls: (r, c) => cls(c) });
      return col(fg, tbl, f.answers.length ? `<div class="uf-log">${f.answers.map((t) => `<span>${esc(t)}</span>`).join("")}</div>` : "");
    },
  }));

  /* ---------- 7. Offline queries sorted by threshold ---------- */
  Viz.register(P("offline"), (el, opts) => Viz.player(el, {
    title: "Offline queries: sort edges and queries by weight, sweep once",
    tag: "EDGE LENGTH LIMITED PATHS",
    legend: [["active", "edge being added"], ["done", "edge already added (w < limit)"], ["dim", "edge too long so far"], ["path", "query endpoints"]],
    codeLang: "python",
    code: [
      "edges.sort(key=lambda e: e[2])",
      "order = sorted(range(len(qs)), key=lambda i: qs[i][2])",
      "j = 0",
      "for i in order:",
      "    p, q, limit = qs[i]",
      "    while j < len(edges) and edges[j][2] < limit:",
      "        union(edges[j][0], edges[j][1]); j += 1",
      "    ans[i] = find(p) == find(q)",
    ],
    inputs: [
      { key: "n", label: "n", value: String(opts.n || 6), width: 50 },
      { key: "e", label: "edges u-v w", value: opts.e || "0-1 2, 1-2 4, 2-3 3, 3-4 9, 1-5 7, 4-5 1, 2-4 8", width: 290 },
      { key: "q", label: "queries p-q limit", value: opts.q || "0-2 5, 0-4 7, 3-5 8, 0-5 3", width: 200 },
    ],
    random: () => {
      const n = Viz.rand(5, 8), e = [], set = new Set();
      for (let i = 1; i < n; i++) { const j = Viz.rand(0, i - 1); set.add(`${j}-${i}`); e.push(`${j}-${i} ${Viz.rand(1, 12)}`); }
      for (let k = 0; k < 2; k++) { const a = Viz.rand(0, n - 1), b = Viz.rand(0, n - 1); if (a !== b && !set.has(`${a}-${b}`) && !set.has(`${b}-${a}`)) { set.add(`${a}-${b}`); e.push(`${a}-${b} ${Viz.rand(1, 12)}`); } }
      const q = []; for (let k = 0; k < 4; k++) { const a = Viz.rand(0, n - 1); let b = Viz.rand(0, n - 1); if (a === b) b = (b + 1) % n; q.push(`${a}-${b} ${Viz.rand(2, 13)}`); }
      return { n: String(n), e: e.join(", "), q: q.join(", ") };
    },
    build: ({ n, e, q }) => {
      n = Viz.parse.int(n, { min: 2, max: 10 });
      const rd = (s, what, max) => {
        const out = String(s).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
          const m = t.match(/^(\d+)\s*-\s*(\d+)\s+(\d+)$/);
          if (!m || +m[1] >= n || +m[2] >= n) throw new Error(`Cannot read ${what} "${t}". Use u-v w with nodes 0..${n - 1}.`);
          return [+m[1], +m[2], +m[3]];
        });
        if (!out.length || out.length > max) throw new Error(`Use 1 to ${max} ${what}s.`);
        return out;
      };
      const edges = rd(e, "edge", 14), qs = rd(q, "query", 6);
      const sorted = edges.map((x, i) => [...x, i]).sort((a, b) => a[2] - b[2]);
      const order = qs.map((_, i) => i).sort((a, b) => qs[a][2] - qs[b][2]);
      const parent = Array.from({ length: n }, (_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const ans = Array(qs.length).fill(null), added = new Set(), fr = [];
      let j = 0;
      const snap = (x) => fr.push({ n, edges, sorted, qs, order, parent: [...parent], ans: [...ans], added: new Set(added), j, ...x });
      snap({ line: [0, 1, 2], vars: { j: 0 }, note: `Answering each query with its own BFS costs O(Q·(V+E)). Instead, sort both lists by weight. A query with limit L may use exactly the edges with w &lt; L, and that set only <b>grows</b> as L grows. So answer queries from the smallest limit up, adding edges as the limit passes them. Union-find handles “add an edge” and “connected?”, and never needs to delete.` });
      for (const i of order) {
        const [p, qq, L] = qs[i];
        snap({ qi: i, line: [3, 4], vars: { query: `${p}-${qq} < ${L}`, j }, note: `Next query by limit: can ${p} reach ${qq} using only edges shorter than <b>${L}</b>?` });
        while (j < sorted.length && sorted[j][2] < L) {
          const [u, v, w, oi] = sorted[j];
          const ru = find(u), rv = find(v);
          if (ru !== rv) parent[ru] = rv;
          added.add(oi); j++;
          snap({ qi: i, cur: oi, line: [5, 6], vars: { query: `${p}-${qq} < ${L}`, j, edge: `${u}-${v} (${w})` }, note: `Edge ${u}–${v} has w = ${w} &lt; ${L}: add it${ru === rv ? " (its ends were already connected)" : ""}. It stays added for every later query, because later limits are at least ${L}.` });
        }
        ans[i] = find(p) === find(qq);
        snap({ qi: i, line: [7], verdict: ans[i], vars: { query: `${p}-${qq} < ${L}`, j, answer: ans[i] }, note: `${j < sorted.length ? `The next edge (w = ${sorted[j][2]}) is not shorter than ${L}, so stop adding. ` : "All edges are in. "}find(${p}) ${ans[i] ? "==" : "!="} find(${qq}): <b>${ans[i]}</b>. Store it at the query's <i>original</i> index ${i}.` });
      }
      snap({ line: [], final: true, vars: { answers: ans.map(String).join(" ") }, note: `Answers in the original order: [${ans.join(", ")}]. Total O(E log E + Q log Q + (E + Q)·α(n)). This “sort queries offline, then sweep” trick turns many problems with thresholds into one pass.` });
      return fr;
    },
    render: (f) => {
      const qp = f.qi !== undefined ? f.qs[f.qi] : null;
      const nodes = circlePos(f.n, Math.max(85, f.n * 18));
      const g = Viz.graph({ nodes, edges: f.edges.map(([u, v, w], i) => ({ u, v, w, cls: i === f.cur ? "active" : f.added.has(i) ? "done" : "dim" })) }, { r: 18, label: "graph", nodeCls: (id) => (qp && (+id === qp[0] || +id === qp[1]) ? (f.verdict === false ? "bad" : "path") : "") });
      const el = Viz.grid(f.sorted.map(([u, v, w]) => [`${u}-${v}`, w]), { label: "edges by weight", colLabels: ["edge", "w"], rowLabels: f.sorted.map((_, k) => (k === f.j ? "j→" : "")), cls: (r) => (f.sorted[r][3] === f.cur ? "active" : r < f.j ? "done" : "") });
      const ql = Viz.grid(f.order.map((i) => [`${f.qs[i][0]}-${f.qs[i][1]}`, f.qs[i][2], f.ans[i] === null ? "" : String(f.ans[i])]), { label: "queries by limit", colLabels: ["pair", "limit", "ans"], rowLabels: f.order.map((i) => `#${i}`), cls: (r, c) => (f.order[r] === f.qi ? (c === 2 && f.ans[f.qi] !== null ? (f.ans[f.qi] ? "done" : "bad") : "path") : f.ans[f.order[r]] === null ? "" : c === 2 ? (f.ans[f.order[r]] ? "done" : "bad") : "") });
      return Viz.row(g, el, ql);
    },
  }));

  /* ---------- 8. Satisfiability of equality equations ---------- */
  Viz.register(P("equations"), (el, opts) => Viz.player(el, {
    title: "Equalities first, then check every inequality",
    tag: "TWO PASSES",
    legend: [["active", "equation being processed"], ["done", "== merged"], ["bad", "!= violated"], ["visit", "!= satisfied"]],
    codeLang: "python",
    code: [
      "for e in equations:              # pass 1: all ==",
      "    if e[1] == '=': union(e[0], e[3])",
      "for e in equations:              # pass 2: all !=",
      "    if e[1] == '!' and find(e[0]) == find(e[3]):",
      "        return False",
      "return True",
    ],
    inputs: [{ key: "eq", label: "equations", value: opts.eq || "a==b, c==d, b!=c, e==f, e!=a, f==a", width: 380 }],
    random: () => {
      const L = "abcdefg".split(""), out = [];
      for (let k = 0; k < Viz.rand(5, 8); k++) { const a = L[Viz.rand(0, 6)], b = L[Viz.rand(0, 6)]; out.push(`${a}${Math.random() < 0.6 ? "==" : "!="}${b}`); }
      return { eq: out.join(", ") };
    },
    build: ({ eq }) => {
      const es = String(eq).split(/[,;\s]+/).filter(Boolean).map((t) => {
        const m = t.match(/^([a-z])(==|!=)([a-z])$/);
        if (!m) throw new Error(`Cannot read "${t}". Use a==b or a!=b with lowercase letters.`);
        return [m[1], m[2], m[3]];
      });
      if (!es.length || es.length > 12) throw new Error("Use 1 to 12 equations.");
      const names = [...new Set(es.flatMap(([a, , b]) => [a, b]))].sort();
      if (names.length > 10) throw new Error("Use at most 10 distinct letters.");
      const id = new Map(names.map((x, i) => [x, i]));
      const parent = names.map((_, i) => i);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const st = Array(es.length).fill(""), fr = [];
      const snap = (x) => fr.push({ names, es, parent: [...parent], st: [...st], ...x });
      snap({ line: [], note: `Equality is transitive (a==b and b==e force a==e) but inequality is not (a!=b and b!=c says nothing about a and c). So build the equality classes first, then check each != against them. Processing in input order would be wrong: a later == can merge two letters that an earlier != already “checked”.` });
      es.forEach(([a, op, b], k) => {
        if (op !== "==") return;
        const ra = find(id.get(a)), rb = find(id.get(b));
        if (ra !== rb) parent[ra] = rb;
        st[k] = "done";
        snap({ k, line: [0, 1], note: `${a}==${b}: ${ra === rb ? "already in one class" : `merge the classes of ${a} and ${b}`}.` });
      });
      let ok = true;
      for (let k = 0; k < es.length; k++) {
        const [a, op, b] = es[k];
        if (op !== "!=") continue;
        const same = find(id.get(a)) === find(id.get(b));
        st[k] = same ? "bad" : "visit";
        snap({ k, line: same ? [2, 3, 4] : [2, 3], note: same ? `${a}!=${b}, but ${a} and ${b} are in the <b>same</b> equality class: contradiction. Return false.` : `${a}!=${b}: different classes, so this can be satisfied (give each class its own value).` });
        if (same) { ok = false; break; }
      }
      if (ok) snap({ line: [5], final: true, note: `Every != separates two different classes: <b>satisfiable</b>. Assign one value per class.` });
      return fr;
    },
    render: (f) => {
      const g = groupClass(f.parent, rootOf(f.parent));
      const nodes = Viz.layout.circle(f.names.map((_, i) => i), Math.max(80, f.names.length * 17)).map((p) => ({ ...p, label: f.names[p.id] }));
      const cur = f.k !== undefined ? f.es[f.k] : null;
      const edges = f.es.map(([a, op, b], k) => ({ u: f.names.indexOf(a), v: f.names.indexOf(b), cls: k === f.k ? (f.st[k] === "bad" ? "bad" : "active") : op === "==" ? (f.st[k] ? "done" : "dim") : f.st[k] === "visit" ? "visit uf-neq" : f.st[k] === "bad" ? "bad" : "dim uf-neq" })).filter((e) => e.u !== e.v);
      const chips = f.es.map(([a, op, b], k) => `<span class="v-item ${k === f.k ? (f.st[k] === "bad" ? "bad" : "active") : f.st[k]}">${esc(a + op + b)}</span>`).join("");
      return Viz.row(Viz.graph({ nodes, edges }, { r: 18, label: "letters (colour = equality class; dashed = !=)", nodeCls: (id) => `${g(+id)}${cur && (f.names[+id] === cur[0] || f.names[+id] === cur[2]) ? " uf-cur" : ""}` }), Viz.labeled("equations", `<div class="uf-chips">${chips}</div>`));
    },
  }));
})();
