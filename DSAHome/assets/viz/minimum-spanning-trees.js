/* Minimum spanning tree visualizers. Every frame comes from running the real algorithm on your input. */
(() => {
  const S = "minimum-spanning-trees";
  const P = (name) => `${S}-${name}`;
  const esc = Viz.esc;
  const col = (...h) => `<div class="mst-col">${h.filter(Boolean).join("")}</div>`;
  const badge = (html, c = "") => `<span class="mst-badge ${c}">${html}</span>`;

  /* A fixed, planar 9-slot layout. Random graphs only use NEAR pairs, so edges never cross. */
  const SLOTS = [[50, 50], [190, 30], [330, 50], [50, 180], [190, 160], [330, 180], [190, 290], [50, 310], [330, 310]];
  const NEAR = [[0, 1], [1, 2], [0, 3], [0, 4], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5], [3, 6], [4, 6], [5, 6], [3, 7], [6, 7], [5, 8], [6, 8]];
  const DEF_E = "0-1 4, 1-2 8, 0-3 2, 0-4 6, 1-4 3, 2-4 7, 2-5 5, 3-4 9, 4-5 1, 3-6 12, 4-6 10, 5-6 11";

  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  function parseW(text, maxN = 9, maxE = 18) {
    const toks = String(text).split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
    const seen = new Set();
    const edges = toks.map((t) => {
      const m = t.match(/^(\d+)\s*-\s*(\d+)\s+(-?\d+)$/);
      if (!m) throw new Error(`Cannot read "${t}". Write weighted edges as u-v w, for example 0-1 4.`);
      const u = +m[1], v = +m[2], w = +m[3];
      if (u >= maxN || v >= maxN) throw new Error(`Use node numbers 0..${maxN - 1}.`);
      if (u === v) throw new Error(`Self-loop "${t}" is not allowed.`);
      const key = u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seen.has(key)) throw new Error(`Edge ${key} appears twice. Keep only the cheaper copy: a spanning tree never needs both.`);
      seen.add(key);
      return [u, v, w];
    });
    if (!edges.length || edges.length > maxE) throw new Error(`Use 1 to ${maxE} edges.`);
    return edges;
  }
  const nOf = (edges) => Math.max(...edges.flatMap(([u, v]) => [u + 1, v + 1]));
  function positions(n, custom) {
    if (custom && custom.length >= n) return custom.slice(0, n).map(([x, y], id) => ({ id, x, y }));
    if (n <= SLOTS.length) return SLOTS.slice(0, n).map(([x, y], id) => ({ id, x, y }));
    return Viz.layout.circle(Array.from({ length: n }, (_, i) => i), Math.max(90, n * 18));
  }
  function randomGraph(nMin, nMax, extra, wMax = 15) {
    const n = Viz.rand(nMin, nMax), cand = shuffle(NEAR.filter(([a, b]) => a < n && b < n));
    const d = dsu(n), pick = [], rest = [];
    for (const e of cand) (d.union(e[0], e[1]) ? pick : rest).push(e);
    pick.push(...rest.slice(0, extra));
    const ws = shuffle(Array.from({ length: wMax }, (_, i) => i + 1));
    return pick.map(([a, b], i) => `${a}-${b} ${ws[i % ws.length]}`).join(", ");
  }

  function dsu(n) {
    const p = Array.from({ length: n }, (_, i) => i), sz = Array(n).fill(1);
    const find = (x) => { while (p[x] !== x) { p[x] = p[p[x]]; x = p[x]; } return x; };
    const union = (a, b) => { a = find(a); b = find(b); if (a === b) return false; if (sz[a] < sz[b]) [a, b] = [b, a]; p[b] = a; sz[a] += sz[b]; return true; };
    return { p, sz, find, union };
  }
  function kruskal(n, edges, o = {}) {
    const d = dsu(n), chosen = new Set();
    let w = 0, k = 0;
    if (o.force !== undefined) { const [u, v, ww] = edges[o.force]; d.union(u, v); chosen.add(o.force); w += ww; k++; }
    const order = edges.map((_, i) => i).sort((a, b) => edges[a][2] - edges[b][2] || a - b);
    for (const i of order) {
      if (i === o.skip || i === o.force) continue;
      const [u, v, ww] = edges[i];
      if (d.union(u, v)) { chosen.add(i); w += ww; k++; }
    }
    return { w, chosen, spanning: k === n - 1 };
  }
  /* Edge indices on the unique path s -> t inside the forest made of `idx`, or null. */
  function treePath(n, edges, idx, s, t) {
    const adj = Array.from({ length: n }, () => []);
    for (const i of idx) { const [u, v] = edges[i]; adj[u].push([v, i]); adj[v].push([u, i]); }
    const prev = Array(n).fill(null), seen = Array(n).fill(false), q = [s];
    seen[s] = true;
    while (q.length) { const x = q.shift(); for (const [y, i] of adj[x]) if (!seen[y]) { seen[y] = true; prev[y] = [x, i]; q.push(y); } }
    if (!seen[t]) return null;
    const path = [], nodes = [t];
    for (let x = t; x !== s; x = prev[x][0]) { path.push(prev[x][1]); nodes.push(prev[x][0]); }
    return { edges: path.reverse(), nodes: nodes.reverse() };
  }
  const rootOf = (parent) => (x) => { while (parent[x] !== x) x = parent[x]; return x; };
  function groups(n, find) {
    const m = new Map();
    for (let i = 0; i < n; i++) { const r = find(i); if (!m.has(r)) m.set(r, []); m.get(r).push(i); }
    const cls = Array(n).fill("");
    let g = 0;
    for (const mem of m.values()) if (mem.length > 1) { mem.forEach((x) => (cls[x] = `mst-g${g % 6}`)); g++; }
    return cls;
  }
  function draw(n, edges, o = {}) {
    const pos = positions(n, o.pos);
    const blockedAbove = (id) => edges.some(([u, v]) => { const a = u === id ? v : v === id ? u : -1; if (a < 0) return false; const dx = pos[a].x - pos[id].x, dy = pos[a].y - pos[id].y; return dy < 0 && Math.abs(dx) < -dy * 0.6; });
    const nodes = pos.map((p) => { const tag = o.tag ? o.tag(p.id) : undefined, up = tag && !blockedAbove(p.id);
      return { ...p, label: o.label ? o.label(p.id) : String(p.id), sub: tag && !up ? tag : o.sub ? o.sub(p.id) : undefined, top: up ? tag : o.top ? o.top(p.id) : undefined }; });
    return Viz.graph({ nodes, edges: edges.map(([u, v, w], i) => ({ u, v, w: o.hideW && o.hideW(i) ? undefined : w, cls: (o.edgeCls && o.edgeCls(i)) || "" })) }, { r: o.r || 18, label: o.caption, nodeCls: o.nodeCls ? (id) => o.nodeCls(+id) : undefined });
  }
  const eName = ([u, v]) => `${u}-${v}`;

  /* ---------- 1. The cut property, with the exchange argument ---------- */
  Viz.register(P("cut"), (el, opts) => Viz.player(el, {
    title: "The cut property: the lightest edge across any cut belongs to an MST",
    tag: "WHY GREEDY WORKS",
    legend: [["visit", "side S of the cut / other crossing edges"], ["active", "lightest crossing edge e"], ["done", "spanning tree T"], ["path", "cycle that e closes in T"], ["bad", "edge f swapped out"]],
    codeLang: "python",
    code: [
      "# a cut splits the nodes into S and V - S",
      "crossing = [(w, u, v) for u, v, w in edges if (u in S) != (v in S)]",
      "e = min(crossing)              # the lightest crossing edge",
      "# claim: some MST contains e. Take any MST T without e.",
      "# T + e has exactly one cycle, and it runs through e",
      "# the cycle leaves S via e, so it must come back: edge f",
      "# f also crosses the cut, so w(f) >= w(e)",
      "# T - f + e is a spanning tree with weight <= w(T)",
    ],
    inputs: [
      { key: "e", label: "edges u-v w", value: opts.e || DEF_E, width: 330 },
      { key: "s", label: "side S", value: opts.s || "0, 1, 3", width: 90 },
    ],
    random: () => {
      const e = randomGraph(6, 9, 4), n = nOf(parseW(e)), k = Viz.rand(2, Math.max(2, Math.floor(n / 2)));
      return { e, s: shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, k).sort((a, b) => a - b).join(", ") };
    },
    build: ({ e, s }) => {
      const edges = parseW(e), n = nOf(edges);
      const side = String(s).split(/[,\s]+/).filter(Boolean).map((t) => { if (!/^\d+$/.test(t) || +t >= n) throw new Error(`"${t}" is not a node 0..${n - 1}.`); return +t; });
      const inS = new Set(side);
      if (!inS.size || inS.size >= n) throw new Error("S must contain at least one node and leave at least one node outside.");
      const crossing = edges.map((_, i) => i).filter((i) => inS.has(edges[i][0]) !== inS.has(edges[i][1])).sort((a, b) => edges[a][2] - edges[b][2] || a - b);
      if (!crossing.length) throw new Error("No edge crosses this cut, so S is disconnected from the rest. Choose a different S.");
      const ei = crossing[0], [eu, ev, ew] = edges[ei];
      const fr = [], base = { n, edges, inS, crossing };
      const snap = (x) => fr.push({ ...base, ...x });
      snap({ line: [0], note: `A <b>cut</b> is any split of the nodes into two sides. Here S = {${[...inS].sort((a, b) => a - b).join(", ")}} (blue) and everything else. The cut doesn't pick edges for us yet; it only asks which edges <i>cross</i> it.` });
      snap({ line: [1], show: "crossing", note: `${crossing.length} edge(s) cross the cut. Every spanning tree must use <b>at least one</b> of them, otherwise S could never reach the other side.` });
      snap({ line: [2], show: "crossing", e: ei, vars: { e: `${eu}-${ev}`, "w(e)": ew }, note: `The lightest crossing edge is e = ${eu}–${ev} with weight <b>${ew}</b>. Claim: some minimum spanning tree contains e. The next frames prove it with an exchange.` });
      const T = kruskal(n, edges, { skip: ei });
      if (!T.spanning) {
        snap({ line: [3], show: "crossing", e: ei, vars: { e: `${eu}-${ev}` }, note: `Without e the graph falls apart: e is the <b>only</b> crossing edge that keeps the graph connected (a bridge). Every spanning tree must contain it, so the claim holds trivially.` });
        snap({ line: [], show: "crossing", e: ei, final: true, note: `Because the lightest edge across <i>any</i> cut is safe, a greedy algorithm can add edges one at a time without ever undoing a choice. Kruskal and Prim are two ways of choosing which cut to look at next.` });
        return fr;
      }
      const tree = new Set(T.chosen);
      snap({ line: [3], tree, e: ei, vars: { "w(T)": T.w }, note: `Suppose a minimum spanning tree T does <b>not</b> use e (green, weight ${T.w}; this is the best tree that avoids e). We will build a tree that is at least as light and does contain e.` });
      const tp = treePath(n, edges, tree, eu, ev);
      const cyc = new Set(tp.edges);
      snap({ line: [4], tree, e: ei, cyc, vars: { "w(T)": T.w, cycle: tp.nodes.join("→") + "→" + eu }, note: `Add e to T. A tree plus one edge has exactly one cycle: the tree path ${tp.nodes.join(" → ")} (purple) and then e back to ${eu}.` });
      const fi = tp.edges.find((i) => inS.has(edges[i][0]) !== inS.has(edges[i][1]));
      const [fu, fv, fw] = edges[fi];
      snap({ line: [5, 6], tree, e: ei, cyc, f: fi, vars: { "w(T)": T.w, f: `${fu}-${fv}`, "w(f)": fw, "w(e)": ew }, note: `The cycle crosses from S to the other side through e, so it has to cross back somewhere else: f = ${fu}–${fv} (red). f is a crossing edge too, and e is the lightest crossing edge, so w(f) = ${fw} ≥ w(e) = ${ew}.` });
      const tree2 = new Set(tree); tree2.delete(fi); tree2.add(ei);
      const W2 = T.w - fw + ew;
      snap({ line: [7], tree: tree2, e: ei, f: fi, swapped: true, vars: { "w(T)": T.w, "w(T − f + e)": W2 }, note: `Remove f and keep e: the cycle is broken, every node is still connected, and the weight is ${T.w} − ${fw} + ${ew} = <b>${W2}</b> ≤ ${T.w}. ${W2 < T.w ? "It is strictly lighter, so a tree without e can never be minimum here: <b>every</b> MST contains e." : "Equal weight: this is another minimum spanning tree, and it contains e."}` });
      snap({ line: [], tree: tree2, e: ei, final: true, vars: { MST: W2 }, note: `The lightest edge across <i>any</i> cut is always safe to take. Kruskal applies this to the cut around one of its components; Prim applies it to the cut around the tree grown so far. Neither ever has to undo a choice.` });
      return fr;
    },
    render: (f) => {
      const cr = new Set(f.crossing);
      const edgeCls = (i) => {
        if (f.final) return f.tree ? (f.tree.has(i) ? "done" : "dim") : i === f.e ? "active" : "dim";
        if (i === f.f) return f.swapped ? "dim" : "bad";
        if (i === f.e) return "active";
        if (f.cyc && f.cyc.has(i)) return "path";
        if (f.tree) return f.tree.has(i) ? "done" : "dim";
        if (f.show === "crossing") return cr.has(i) ? "visit" : "dim";
        return "";
      };
      const g = draw(f.n, f.edges, { caption: "graph (blue nodes = S)", edgeCls, nodeCls: (id) => (f.inS.has(id) ? "visit" : "") });
      const tbl = Viz.grid(f.crossing.map((i) => [eName(f.edges[i]), f.edges[i][2]]), { label: "crossing edges, lightest first", colLabels: ["edge", "w"], cls: (r) => { const i = f.crossing[r], on = f.show || f.tree; return !on ? "dim" : i === f.e ? "active" : i === f.f ? "bad" : ""; } });
      return Viz.row(g, tbl);
    },
  }));

  /* ---------- 2. Kruskal: sorted edges + union-find ---------- */
  Viz.register(P("kruskal"), (el, opts) => Viz.player(el, {
    title: "Kruskal: scan edges from lightest, keep the ones that join two components",
    tag: "SORT + UNION-FIND",
    legend: [["active", "edge being considered"], ["done", "accepted (tree edge)"], ["bad", "rejected: would close a cycle"], ["path", "the existing tree path it would duplicate"], ["dim", "not needed (stopped early)"]],
    codeLang: "python",
    code: [
      "edges.sort(key=lambda e: e[2])        # lightest first",
      "dsu = DSU(n); total = taken = 0",
      "for u, v, w in edges:",
      "    if taken == n - 1: break          # tree is complete",
      "    if not dsu.union(u, v): continue  # same component: cycle",
      "    total += w; taken += 1            # safe by the cut property",
      "return total if taken == n - 1 else -1",
    ],
    inputs: [{ key: "e", label: "edges u-v w", value: opts.e || DEF_E, width: 420 }],
    random: () => ({ e: randomGraph(6, 9, Viz.rand(3, 6)) }),
    build: ({ e }) => {
      const edges = parseW(e), n = nOf(edges);
      const sorted = edges.map((_, i) => i).sort((a, b) => edges[a][2] - edges[b][2] || a - b);
      const parent = Array.from({ length: n }, (_, i) => i), size = Array(n).fill(1);
      const find = (x) => { while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; } return x; };
      const status = Array(edges.length).fill("");
      let total = 0, taken = 0;
      const fr = [];
      const snap = (x) => fr.push({ n, edges, sorted, parent: [...parent], status: [...status], ...x, vars: { total, taken: `${taken}/${n - 1}`, ...(x.vars || {}) } });
      snap({ line: [0, 1], note: `Sort all ${edges.length} edges by weight (left table). Every node starts as its own component. The plan: walk the list once, and keep an edge exactly when its two ends are in <b>different</b> components.` });
      for (let k = 0; k < sorted.length; k++) {
        const i = sorted[k], [u, v, w] = edges[i];
        if (taken === n - 1) {
          for (let r = k; r < sorted.length; r++) status[sorted[r]] = "skip";
          snap({ line: [3], row: k, note: `${n - 1} edges accepted, so every node is connected. Stop: the remaining ${sorted.length - k} edge(s) can only close cycles.` });
          break;
        }
        const ru = find(u), rv = find(v);
        snap({ cur: i, row: k, line: [2], vars: { edge: `${u}-${v} (${w})`, "find(u)": ru, "find(v)": rv }, note: `Next lightest edge: ${u}–${v}, weight ${w}. find(${u}) = ${ru}, find(${v}) = ${rv}.` });
        if (ru === rv) {
          status[i] = "bad";
          const tp = treePath(n, edges, edges.map((_, j) => j).filter((j) => status[j] === "done"), u, v);
          snap({ cur: i, row: k, cyc: new Set(tp.edges), line: [4], vars: { edge: `${u}-${v} (${w})` }, note: `Same root: ${u} and ${v} are already connected by the tree path ${tp.nodes.join(" → ")} (purple), whose edges are all lighter. Adding ${u}–${v} would close a cycle in which it is the <b>heaviest</b> edge, and the heaviest edge on a cycle is never needed. Reject.` });
        } else {
          let a = ru, b = rv; if (size[a] < size[b]) [a, b] = [b, a];
          parent[b] = a; size[a] += size[b]; status[i] = "done"; total += w; taken++;
          snap({ cur: i, row: k, line: [5], vars: { edge: `${u}-${v} (${w})` }, note: `Different components: accept. Every lighter edge has already been decided, so this is the lightest edge leaving ${u}'s component, which makes it safe by the cut property. Union them. Total = <b>${total}</b>.` });
        }
      }
      const ok = taken === n - 1;
      snap({ line: [6], final: true, note: ok ? `Minimum spanning tree: ${n - 1} edges, total weight <b>${total}</b>. Cost: O(E log E) for the sort, plus O(E·α(V)) for the union-find.` : `Only ${taken} edge(s) accepted for ${n} nodes: the graph is <b>disconnected</b>, so there is no spanning tree. Return −1 (or keep the result as a minimum spanning forest).` });
      return fr;
    },
    render: (f) => {
      const gc = groups(f.n, rootOf(f.parent));
      const edgeCls = (i) => (i === f.cur ? (f.status[i] || "active") : f.cyc && f.cyc.has(i) ? "path" : f.status[i] === "skip" ? "dim" : f.status[i] === "bad" ? "bad dim" : f.status[i] || (f.final ? "dim" : ""));
      const g = draw(f.n, f.edges, { caption: "graph (colour = component)", edgeCls, nodeCls: (id) => gc[id] });
      const verdict = { done: "take", bad: "cycle", skip: "—", "": "" };
      const tbl = Viz.grid(f.sorted.map((i) => [eName(f.edges[i]), f.edges[i][2], verdict[f.status[i]]]), { label: "edges, sorted", colLabels: ["edge", "w", "verdict"], rowLabels: f.sorted.map((_, k) => (k === f.row ? "→" : "")), cls: (r) => { const i = f.sorted[r]; return i === f.cur && !f.status[i] ? "active" : f.status[i] === "done" ? "done" : f.status[i] === "bad" ? "bad" : f.status[i] === "skip" ? "dim" : ""; } });
      return Viz.row(col(g, Viz.array(f.parent, { label: "parent[] (union-find)", cls: (i) => (f.cur !== undefined && (i === f.edges[f.cur][0] || i === f.edges[f.cur][1]) ? "active" : "") })), tbl);
    },
  }));

  /* ---------- 3. Prim with a lazy heap ---------- */
  Viz.register(P("prim"), (el, opts) => Viz.player(el, {
    title: "Prim: grow one tree, always taking the cheapest edge that leaves it",
    tag: "HEAP FRONTIER",
    legend: [["done", "in the tree / tree edge"], ["visit", "frontier edge (in the heap)"], ["active", "edge just popped"], ["bad", "stale entry: both ends already inside"], ["path", "entries just pushed"]],
    codeLang: "python",
    code: [
      "in_tree = {s}; total = 0",
      "heap = [(w, s, v) for v, w in adj[s]]; heapify(heap)",
      "while heap and len(in_tree) < n:",
      "    w, u, v = heappop(heap)          # cheapest edge out of the tree?",
      "    if v in in_tree: continue         # stale: v joined meanwhile",
      "    in_tree.add(v); total += w        # safe by the cut property",
      "    for x, wx in adj[v]:",
      "        if x not in in_tree: heappush(heap, (wx, v, x))",
      "return total if len(in_tree) == n else -1",
    ],
    inputs: [
      { key: "e", label: "edges u-v w", value: opts.e || DEF_E, width: 380 },
      { key: "s", label: "start", value: String(opts.s ?? 0), width: 50 },
    ],
    random: () => { const e = randomGraph(6, 9, Viz.rand(3, 6)); return { e, s: String(Viz.rand(0, nOf(parseW(e)) - 1)) }; },
    build: ({ e, s }) => {
      const edges = parseW(e), n = nOf(edges);
      s = Viz.parse.int(s, { min: 0, max: n - 1 });
      const adj = Array.from({ length: n }, () => []);
      edges.forEach(([u, v, w], i) => { adj[u].push([v, w, i]); adj[v].push([u, w, i]); });
      const inT = new Set([s]), treeE = new Set(), fr = [];
      let heap = [], total = 0;
      const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      const snap = (x) => fr.push({ n, edges, s, inT: new Set(inT), treeE: new Set(treeE), heap: heap.map((h) => [...h]).sort(cmp), ...x, vars: { total, "in tree": `${inT.size}/${n}`, heap: heap.length, ...(x.vars || {}) } });
      const pushFrom = (v) => { const added = []; for (const [x, w, i] of adj[v]) if (!inT.has(x)) { const h = [w, v, x, i]; heap.push(h); added.push(h); } return added; };
      const a0 = pushFrom(s);
      snap({ line: [0, 1], fresh: new Set(a0.map((h) => h[3] + ":" + h[1])), note: `Start the tree at node ${s}. Push every edge leaving it onto a min-heap of (weight, from, to). The heap is the <b>frontier</b>: candidate edges from inside the tree to the outside.` });
      while (heap.length && inT.size < n) {
        heap.sort(cmp);
        const top = heap.shift(), [w, u, v, i] = top;
        if (inT.has(v)) {
          snap({ line: [3, 4], pop: top, stale: true, vars: { popped: `${u}→${v} (${w})` }, note: `Pop (${w}, ${u}→${v}), but ${v} is already in the tree: this entry went <b>stale</b> when ${v} joined through a cheaper edge. Skip it. This is lazy deletion: instead of searching the heap to remove old entries, discard them when they surface.` });
          continue;
        }
        snap({ line: [3], pop: top, vars: { popped: `${u}→${v} (${w})` }, note: `Pop the cheapest frontier entry: ${u}→${v} with weight ${w}. ${v} is outside the tree, so this is the lightest edge crossing the cut (tree | rest).` });
        inT.add(v); treeE.add(i); total += w;
        snap({ line: [5], cur: i, newNode: v, note: `Take it: node ${v} joins the tree through ${u}–${v}. Total = <b>${total}</b>.` });
        const added = pushFrom(v);
        if (inT.size < n) snap({ line: [6, 7], cur: i, newNode: v, fresh: new Set(added.map((h) => h[3] + ":" + h[1])), note: added.length ? `Push ${v}'s edges to nodes still outside: ${added.map((h) => `(${h[0]}, ${h[1]}→${h[2]})`).join(", ")}. Older entries that point at ${v} stay in the heap and will be skipped later.` : `${v} has no edges to new nodes, so nothing is pushed.` });
      }
      const ok = inT.size === n;
      snap({ line: [8], final: true, note: ok ? `All ${n} nodes are in the tree: total weight <b>${total}</b>, the same as Kruskal's. Each edge is pushed at most twice, so the cost is O(E log E) = O(E log V).` : `The heap ran dry with only ${inT.size} of ${n} nodes inside: the graph is disconnected, so return −1.` });
      return fr;
    },
    render: (f) => {
      const inHeap = new Set(f.heap.map((h) => h[3]));
      const edgeCls = (i) => {
        if (f.treeE.has(i)) return i === f.cur ? "active" : "done";
        if (f.pop && f.pop[3] === i) return f.stale ? "bad" : "active";
        if (!f.final && inHeap.has(i) && !(f.inT.has(f.edges[i][0]) && f.inT.has(f.edges[i][1]))) return "visit";
        return "dim";
      };
      const g = draw(f.n, f.edges, { caption: "graph", edgeCls, nodeCls: (id) => (id === f.newNode ? "active" : f.inT.has(id) ? "done" : ""), tag: (id) => (id === f.s ? "start" : undefined) });
      const shown = f.heap.slice(0, 9);
      const rows = shown.map((h) => [h[0], `${h[1]}→${h[2]}`, f.inT.has(h[2]) ? "stale" : ""]);
      if (f.heap.length > shown.length) rows.push(["…", `${f.heap.length - shown.length} more`, ""]);
      const tbl = Viz.grid(rows.length ? rows : [["", "empty", ""]], { label: "heap (sorted view, min on top)", colLabels: ["w", "edge", ""], cls: (r) => { const h = shown[r]; if (!h) return "dim"; return f.fresh && f.fresh.has(h[3] + ":" + h[1]) ? "path" : f.inT.has(h[2]) ? "dim" : r === 0 && !f.final ? "visit" : ""; } });
      const popped = f.pop ? badge(`popped (${f.pop[0]}, ${f.pop[1]}→${f.pop[2]})${f.stale ? " stale" : ""}`, f.stale ? "bad" : "active") : "";
      return Viz.row(g, col(tbl, popped));
    },
  }));

  /* ---------- 4. Dense Prim on points (complete graph) ---------- */
  Viz.register(P("dense"), (el, opts) => Viz.player(el, {
    title: "Dense Prim, O(V²): connect points with Manhattan distances, no heap and no edge list",
    tag: "MIN COST TO CONNECT ALL POINTS",
    legend: [["done", "in the tree / tree edge"], ["active", "point just added"], ["path", "dist[] just improved"], ["visit", "edge that improved a dist[]"]],
    codeLang: "python",
    code: [
      "n = len(points); INF = float('inf')",
      "dist = [INF] * n; dist[0] = 0      # cheapest link into the tree",
      "in_tree = [False] * n; total = 0",
      "for _ in range(n):",
      "    u = min((d, i) for i, d in enumerate(dist) if not in_tree[i])[1]",
      "    in_tree[u] = True; total += dist[u]",
      "    for v in range(n):              # relax every outside point",
      "        if not in_tree[v]:",
      "            dist[v] = min(dist[v], manhattan(points[u], points[v]))",
      "return total",
    ],
    inputs: [{ key: "p", label: "points x,y", value: opts.p || "0,0; 2,2; 3,10; 5,2; 7,0; 9,6", width: 320 }],
    random: () => {
      const k = Viz.rand(5, 8), seen = new Set(), out = [];
      while (out.length < k) { const x = Viz.rand(0, 12), y = Viz.rand(0, 10); if (!seen.has(`${x},${y}`)) { seen.add(`${x},${y}`); out.push(`${x},${y}`); } }
      return { p: out.join("; ") };
    },
    build: ({ p }) => {
      const pts = String(p).split(/;+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^\(?\s*(-?\d+)\s*,\s*(-?\d+)\s*\)?$/);
        if (!m) throw new Error(`Cannot read point "${t}". Write points as x,y separated by semicolons.`);
        if (Math.abs(+m[1]) > 30 || Math.abs(+m[2]) > 30) throw new Error("Keep coordinates between −30 and 30 so the plot stays readable.");
        return [+m[1], +m[2]];
      });
      if (pts.length < 2 || pts.length > 10) throw new Error("Use 2 to 10 points.");
      const n = pts.length, INF = Infinity, md = (a, b) => Math.abs(pts[a][0] - pts[b][0]) + Math.abs(pts[a][1] - pts[b][1]);
      const dist = Array(n).fill(INF), par = Array(n).fill(-1), inT = Array(n).fill(false), tree = [], fr = [];
      dist[0] = 0;
      let total = 0;
      const snap = (x) => fr.push({ n, pts, dist: [...dist], par: [...par], inT: [...inT], tree: tree.map((t) => [...t]), ...x, vars: { total, ...(x.vars || {}) } });
      snap({ line: [0, 1, 2], note: `${n} points means ${n * (n - 1) / 2} possible edges: a <b>complete graph</b>. Building that edge list and sorting it (Kruskal) costs O(V² log V). Instead keep one number per point: <b>dist[v]</b>, the cheapest known link from v into the tree. Start with point 0 at distance 0.` });
      for (let it = 0; it < n; it++) {
        let u = -1;
        for (let i = 0; i < n; i++) if (!inT[i] && (u === -1 || dist[i] < dist[u])) u = i;
        inT[u] = true; total += dist[u];
        if (par[u] >= 0) tree.push([par[u], u, dist[u]]);
        snap({ line: [4, 5], u, vars: { u, "dist[u]": dist[u] }, note: it === 0 ? `Scan dist[] for the smallest value outside the tree: point 0 (distance 0). It becomes the root.` : `Scan all of dist[] (O(V), no heap) for the smallest value outside the tree: point ${u} at distance <b>${dist[u]}</b>, linked to point ${par[u]}. Add it. Total = ${total}.` });
        if (it === n - 1) break;
        const imp = [];
        for (let v = 0; v < n; v++) if (!inT[v]) { const d = md(u, v); if (d < dist[v]) { dist[v] = d; par[v] = u; imp.push(v); } }
        snap({ line: [6, 7, 8], u, imp: new Set(imp), vars: { u }, note: imp.length ? `Relax from ${u}: compute the Manhattan distance |Δx| + |Δy| to every outside point. dist[] improves for ${imp.map((v) => `${v} (→ ${dist[v]})`).join(", ")}. Each round is O(V), so the whole run is O(V²) with O(V) memory.` : `Relax from ${u}: no outside point gets closer through ${u}, so dist[] is unchanged.` });
      }
      snap({ line: [9], final: true, note: `All points connected for a total cost of <b>${total}</b>. For a complete graph E ≈ V²/2, so O(V²) is optimal: a heap would add a log factor, and Kruskal would also need to sort V² edges.` });
      return fr;
    },
    render: (f) => {
      const xs = f.pts.map((q) => q[0]), ys = f.pts.map((q) => q[1]);
      const mnx = Math.min(...xs), mny = Math.min(...ys), mxy = Math.max(...ys);
      const span = Math.max(1, Math.max(...xs) - mnx, mxy - mny), sc = Math.min(40, 360 / span);
      const pos = f.pts.map(([x, y]) => [Math.round((x - mnx) * sc), Math.round((mxy - y) * sc)]);
      const edges = f.tree.map(([a, b, w]) => [a, b, w]), cls = f.tree.map(() => "done");
      if (f.imp) for (const v of f.imp) { edges.push([f.u, v, f.dist[v]]); cls.push("visit"); }
      const g = draw(f.n, edges, { pos, caption: "points (y up), edge label = Manhattan distance", edgeCls: (i) => (i === f.tree.length - 1 && !f.imp && !f.final && f.u !== undefined && f.tree.length ? "active" : cls[i]), nodeCls: (id) => (id === f.u && !f.final ? "active" : f.inT[id] ? "done" : ""), sub: (id) => `(${f.pts[id][0]},${f.pts[id][1]})`, r: 16 });
      const dist = Viz.array(f.dist.map((d) => (d === Infinity ? "∞" : d)), { label: "dist[v]: cheapest link into the tree", cls: (i) => (f.imp && f.imp.has(i) ? "path" : i === f.u && !f.final ? "active" : f.inT[i] ? "done" : "") });
      const par = Viz.array(f.par.map((x) => (x < 0 ? "–" : x)), { label: "link[v]: tree point it would attach to", cls: (i) => (f.inT[i] ? "done" : "") });
      return Viz.row(g, col(dist, par));
    },
  }));

  /* ---------- 5. Critical and pseudo-critical edges ---------- */
  const CRIT_E = "0-1 1, 1-2 1, 2-3 2, 0-3 2, 0-4 3, 3-4 3, 1-4 6";
  Viz.register(P("critical"), (el, opts) => Viz.player(el, {
    title: "Critical and pseudo-critical edges: rebuild the MST without each edge, then with it forced in",
    tag: "LEETCODE 1489",
    legend: [["done", "edges of the MST built in this trial"], ["bad", "edge excluded"], ["active", "edge forced in first"]],
    codeLang: "python",
    code: [
      "base = mst(n, edges)                    # Kruskal weight",
      "critical, pseudo = [], []",
      "for i in range(len(edges)):",
      "    if mst(n, edges, skip=i) > base:    # heavier, or disconnected",
      "        critical.append(i)",
      "    elif mst(n, edges, force=i) == base:",
      "        pseudo.append(i)                # in some MSTs, not all",
      "return [critical, pseudo]",
    ],
    inputs: [{ key: "e", label: "edges u-v w (index = position)", value: opts.e || CRIT_E, width: 380 }],
    random: () => ({ e: randomGraph(4, 6, Viz.rand(2, 4), 4).split(", ").map((t) => t.replace(/ \d+$/, ` ${Viz.rand(1, 4)}`)).join(", ") }),
    build: ({ e }) => {
      const edges = parseW(e), n = nOf(edges);
      const base = kruskal(n, edges);
      if (!base.spanning) throw new Error("The graph must be connected for an MST to exist.");
      const W = base.w, rows = edges.map(() => ["", "", ""]), crit = [], pseudo = [], fr = [];
      const pos = String(e).replace(/\s+/g, " ").trim() === CRIT_E ? [[60, 60], [280, 60], [280, 250], [60, 250], [170, 155]] : undefined;
      const snap = (x) => fr.push({ n, edges, pos, rows: rows.map((r) => [...r]), W, ...x, vars: { "base W": W, ...(x.vars || {}) } });
      snap({ line: [0, 1], tree: base.chosen, note: `First build any MST with Kruskal: weight <b>W = ${W}</b>. With tied weights there can be several different MSTs, so one MST alone can't tell us which edges are essential.` });
      edges.forEach(([u, v, w], i) => {
        const ex = kruskal(n, edges, { skip: i }), exW = ex.spanning ? ex.w : Infinity;
        rows[i][0] = exW === Infinity ? "split" : String(exW);
        if (exW > W) {
          rows[i][2] = "critical"; crit.push(i);
          snap({ line: [2, 3, 4], i, ex: true, tree: ex.chosen, vars: { edge: `#${i} ${u}-${v} (${w})`, "without": rows[i][0] }, note: `Edge #${i} (${u}–${v}, w ${w}) removed: ${exW === Infinity ? "the graph <b>disconnects</b>" : `the best tree weighs <b>${exW}</b> &gt; ${W}`}. Every MST needs it: <b>critical</b>.` });
          return;
        }
        snap({ line: [2, 3], i, ex: true, tree: ex.chosen, vars: { edge: `#${i} ${u}-${v} (${w})`, "without": exW }, note: `Edge #${i} (${u}–${v}, w ${w}) removed: still an MST of weight ${exW} = W, so it is not critical. But is it in <i>some</i> MST? Force it in and see.` });
        const fo = kruskal(n, edges, { force: i });
        rows[i][1] = String(fo.w);
        const ok = fo.w === W;
        rows[i][2] = ok ? "pseudo" : "neither";
        if (ok) pseudo.push(i);
        snap({ line: [5, 6], i, force: true, tree: fo.chosen, vars: { edge: `#${i} ${u}-${v} (${w})`, forced: fo.w }, note: ok ? `Union ${u}–${v} first, then run Kruskal on the rest: weight ${fo.w} = W. Some MST uses it and some MST doesn't: <b>pseudo-critical</b>.` : `Forcing ${u}–${v} in costs ${fo.w} &gt; ${W}: no MST contains it (it is the strictly heaviest edge on some cycle). Neither critical nor pseudo-critical.` });
      });
      snap({ line: [7], final: true, tree: base.chosen, note: `Critical: [${crit.join(", ")}]. Pseudo-critical: [${pseudo.join(", ")}]. Cost: 2E Kruskal runs on presorted edges, O(E²·α(V)), fine for E ≤ 200.` });
      return fr;
    },
    render: (f) => {
      const edgeCls = (i) => (i === f.i ? (f.ex ? "bad" : "active") : f.tree && f.tree.has(i) ? "done" : "dim");
      const g = draw(f.n, f.edges, { pos: f.pos, caption: f.ex ? `trial: MST without #${f.i}` : f.force ? `trial: MST with #${f.i} forced` : "an MST of the graph", edgeCls });
      const tbl = Viz.grid(f.edges.map((ed, i) => [`#${i}`, eName(ed), ed[2], ...f.rows[i]]), { label: `verdicts (W = ${f.W})`, colLabels: ["", "edge", "w", "without", "forced", "verdict"], cls: (r, c) => (r === f.i && !f.final ? "active" : c === 5 && f.rows[r][2] === "critical" ? "bad" : c === 5 && f.rows[r][2] === "pseudo" ? "done" : "") });
      return Viz.row(g, tbl);
    },
  }));

  /* ---------- 6. Virtual node: Optimize Water Distribution ---------- */
  Viz.register(P("virtual"), (el, opts) => Viz.player(el, {
    title: "A virtual node turns “build a well here” into an ordinary edge",
    tag: "OPTIMIZE WATER DISTRIBUTION",
    legend: [["active", "edge being considered"], ["done", "chosen"], ["bad", "rejected: cycle"], ["visit", "virtual well edge (dashed)"]],
    codeLang: "python",
    code: [
      "edges = [(cost, 0, i + 1) for i, cost in enumerate(wells)]",
      "edges += [(w, a, b) for a, b, w in pipes]  # houses are 1..n",
      "edges.sort(); dsu = DSU(n + 1); total = 0",
      "for w, a, b in edges:",
      "    if dsu.union(a, b):",
      "        total += w          # an edge from 0 means: dig a well",
      "return total",
    ],
    inputs: [
      { key: "w", label: "well cost per house 1..n", value: opts.w || "4, 7, 6, 9, 3", width: 160 },
      { key: "p", label: "pipes a-b cost", value: opts.p || "1-2 2, 2-3 3, 3-4 1, 4-5 6, 1-3 5, 2-4 4", width: 280 },
    ],
    random: () => {
      const n = Viz.rand(3, 6), ps = [];
      for (let i = 1; i < n; i++) ps.push(`${i}-${i + 1} ${Viz.rand(1, 9)}`);
      for (let i = 1; i + 2 <= n; i++) if (Math.random() < 0.5) ps.push(`${i}-${i + 2} ${Viz.rand(1, 9)}`);
      return { w: Array.from({ length: n }, () => Viz.rand(1, 9)).join(", "), p: ps.join(", ") };
    },
    build: ({ w, p }) => {
      const wells = String(w).split(/[,\s]+/).filter(Boolean).map((t) => { if (!/^\d+$/.test(t)) throw new Error(`Well cost "${t}" is not a non-negative integer.`); return +t; });
      const n = wells.length;
      if (n < 1 || n > 7) throw new Error("Use 1 to 7 houses.");
      const pipes = String(p).trim() ? parseW(p, n + 1, 12) : [];
      for (const [a, b] of pipes) if (a < 1 || b < 1) throw new Error("Houses are numbered 1..n; node 0 is reserved for the virtual well.");
      const all = [...pipes, ...wells.map((c, i) => [0, i + 1, c])], virt = (i) => i >= pipes.length;
      const order = all.map((_, i) => i).sort((a, b) => all[a][2] - all[b][2] || a - b);
      const d = dsu(n + 1), status = Array(all.length).fill(""), fr = [];
      let total = 0;
      const snap = (x) => fr.push({ n, wells, all, pipes, order, status: [...status], parent: [...d.p], ...x, vars: { total, ...(x.vars || {}) } });
      snap({ line: [], hideVirt: true, note: `Each house needs water: either dig a well (cost under the house) or lay a pipe from a house that has water. Two kinds of choice, so it doesn't look like an MST yet.` });
      snap({ line: [0, 1], note: `Add a <b>virtual node 0</b>, “the water source”, with an edge 0–i of weight wells[i] for every house. Digging a well at i = connecting i to the source. Now every house just has to be <b>connected to node 0</b>, the cheapest way: an MST on ${n + 1} nodes.` });
      for (const i of order) {
        const [a, b, c] = all[i];
        const ok = d.union(a, b);
        status[i] = ok ? "done" : "bad";
        if (ok) total += c;
        const what = virt(i) ? `dig a well at house ${b} (${c})` : `pipe ${a}–${b} (${c})`;
        snap({ line: ok ? [3, 4, 5] : [3, 4], cur: i, vars: { edge: what }, note: ok ? `Take: ${what}. Total = <b>${total}</b>.` : `Skip: ${what} would close a cycle, because ${a === 0 ? "house " + b + " already has water" : `${a} and ${b} are already connected`}.` });
      }
      const wellsAt = order.filter((i) => virt(i) && status[i] === "done").map((i) => all[i][1]).sort((a, b) => a - b);
      snap({ line: [6], final: true, note: `Minimum total <b>${total}</b>: wells at house(s) ${wellsAt.join(", ")}, pipes for the rest. The same trick works whenever a node can either “buy its own” resource or connect to a neighbour.` });
      return fr;
    },
    render: (f) => {
      const n = f.n, mid = 40 + ((n - 1) * 90) / 2;
      const pos = [[mid, 20], ...Array.from({ length: n }, (_, i) => [40 + i * 90, i % 2 ? 250 : 170])];
      const vis = f.all.map((_, i) => !(f.hideVirt && i >= f.pipes.length));
      const edges = f.all.filter((_, i) => vis[i]), idx = f.all.map((_, i) => i).filter((i) => vis[i]);
      const edgeCls = (k) => { const i = idx[k], v = i >= f.pipes.length ? " mst-virt" : ""; return (i === f.cur ? (f.status[i] === "bad" ? "bad" : "active") : f.status[i] === "done" ? "done" : f.status[i] === "bad" ? "bad dim" : f.final ? "dim" : v ? "visit" : "") + v; };
      const g = draw(n + 1, edges, { pos, caption: "houses 1..n, virtual source 0", edgeCls, label: (id) => (id === 0 ? "0" : String(id)), top: (id) => (id === 0 ? "virtual source" : undefined), sub: (id) => (id === 0 ? undefined : `well ${f.wells[id - 1]}`), nodeCls: (id) => (id === 0 ? (f.hideVirt ? "dim" : "visit") : f.final && f.status.some((s, i) => s === "done" && i >= f.pipes.length && f.all[i][1] === id) ? "path" : "") });
      const tbl = Viz.grid(f.order.map((i) => [i >= f.pipes.length ? `well @${f.all[i][1]}` : `pipe ${eName(f.all[i])}`, f.all[i][2], f.status[i] === "done" ? "take" : f.status[i] === "bad" ? "cycle" : ""]), { label: "all edges, sorted", colLabels: ["edge", "cost", "verdict"], cls: (r) => { const i = f.order[r]; return i === f.cur ? (f.status[i] === "bad" ? "bad" : "active") : f.status[i] === "done" ? "done" : f.status[i] === "bad" ? "bad" : f.hideVirt && i >= f.pipes.length ? "dim" : ""; } });
      return Viz.row(g, tbl);
    },
  }));

  /* ---------- 7. Minimax / maximin path = path in the MST ---------- */
  Viz.register(P("minimax"), (el, opts) => Viz.player(el, {
    title: "Bottleneck paths: add edges in sorted order until s and t meet",
    tag: "MINIMAX · MAXIMUM SPANNING TREE",
    legend: [["path", "s, t and the bottleneck path"], ["done", "accepted edge"], ["bad", "rejected: cycle"], ["active", "the edge that connects s and t (the answer)"]],
    codeLang: "python",
    code: [
      "edges.sort(key=lambda e: e[2], reverse=maximin)",
      "dsu = DSU(n)",
      "for u, v, w in edges:",
      "    dsu.union(u, v)",
      "    if dsu.connected(s, t):",
      "        return w      # the bottleneck value",
      "return None          # s and t never connect",
    ],
    inputs: [
      { key: "e", label: "edges u-v w", value: opts.e || DEF_E, width: 330 },
      { key: "s", label: "s", value: String(opts.s ?? 3), width: 40 },
      { key: "t", label: "t", value: String(opts.t ?? 2), width: 40 },
      { key: "m", label: "goal", type: "select", options: ["minimize the largest edge", "maximize the smallest edge"], value: opts.m || "minimize the largest edge" },
    ],
    random: () => { const e = randomGraph(6, 9, Viz.rand(3, 6)), n = nOf(parseW(e)), s = Viz.rand(0, n - 1); let t = Viz.rand(0, n - 1); if (t === s) t = (s + 1) % n; return { e, s: String(s), t: String(t), m: Math.random() < 0.5 ? "minimize the largest edge" : "maximize the smallest edge" }; },
    build: ({ e, s, t, m }) => {
      const edges = parseW(e), n = nOf(edges);
      s = Viz.parse.int(s, { min: 0, max: n - 1 }); t = Viz.parse.int(t, { min: 0, max: n - 1 });
      if (s === t) throw new Error("Pick two different nodes s and t.");
      const maxi = String(m).startsWith("max");
      const order = edges.map((_, i) => i).sort((a, b) => (maxi ? edges[b][2] - edges[a][2] : edges[a][2] - edges[b][2]) || a - b);
      const d = dsu(n), status = Array(edges.length).fill(""), fr = [];
      const snap = (x) => fr.push({ n, edges, s, t, maxi, order, status: [...status], parent: [...d.p], ...x });
      const word = maxi ? "heaviest" : "lightest";
      snap({ line: [0, 1], note: maxi ? `Goal: an s–t path whose <b>smallest</b> edge is as large as possible (think: the widest road, the strongest link). Sort edges from heaviest to lightest and add them until s and t meet. This builds a <b>maximum</b> spanning tree.` : `Goal: an s–t path whose <b>largest</b> edge is as small as possible (the minimax path: least effort, lowest peak). Sort edges from lightest to heaviest and add them until s and t meet. This is Kruskal stopped early.` });
      for (const i of order) {
        const [u, v, w] = edges[i];
        const ok = d.union(u, v);
        status[i] = ok ? "done" : "bad";
        if (d.find(s) === d.find(t)) {
          const tp = treePath(n, edges, edges.map((_, j) => j).filter((j) => status[j] === "done"), s, t);
          snap({ line: [3, 4, 5], cur: i, path: new Set(tp.edges), pathNodes: new Set(tp.nodes), vars: { edge: `${u}-${v} (${w})`, answer: w }, note: `Adding ${u}–${v} (w ${w}) connects s = ${s} and t = ${t}. The answer is <b>${w}</b>. Path: ${tp.nodes.join(" → ")}, and its ${maxi ? "smallest" : "largest"} edge is exactly ${w}.` });
          snap({ line: [5], cur: i, path: new Set(tp.edges), pathNodes: new Set(tp.nodes), final: true, vars: { answer: w }, note: `Why no path can do better: just before this edge, s and t were in <b>different</b> components of the graph made of all edges ${maxi ? "heavier" : "lighter"} than ${w}. So every s–t path uses at least one edge that is ${maxi ? "no heavier" : "no lighter"} than ${w}. The path inside the ${maxi ? "maximum" : "minimum"} spanning tree is a bottleneck-optimal path for <b>every</b> pair at once.` });
          return fr;
        }
        snap({ line: [2, 3], cur: i, vars: { edge: `${u}-${v} (${w})` }, note: ok ? `Next ${word} edge ${u}–${v} (w ${w}): union. s and t are still apart.` : `Next ${word} edge ${u}–${v} (w ${w}): its ends are already connected, skip.` });
      }
      snap({ line: [6], final: true, note: `All edges used and s, t are still in different components: no path exists.` });
      return fr;
    },
    render: (f) => {
      const gc = groups(f.n, rootOf(f.parent));
      const edgeCls = (i) => (i === f.cur && f.path ? "active" : f.path && f.path.has(i) ? "path" : i === f.cur ? (f.status[i] === "bad" ? "bad" : "active") : f.status[i] === "done" ? "done" : f.status[i] === "bad" ? "bad dim" : f.final ? "dim" : "");
      const g = draw(f.n, f.edges, { caption: `graph (${f.maxi ? "maximin" : "minimax"}; colour = component)`, edgeCls, nodeCls: (id) => (id === f.s || id === f.t ? "path" : gc[id]), tag: (id) => (id === f.s ? "s" : id === f.t ? "t" : undefined) });
      const tbl = Viz.grid(f.order.map((i) => [eName(f.edges[i]), f.edges[i][2], f.status[i] === "done" ? "take" : f.status[i] === "bad" ? "cycle" : ""]), { label: f.maxi ? "edges, heaviest first" : "edges, lightest first", colLabels: ["edge", "w", "verdict"], cls: (r) => { const i = f.order[r]; return i === f.cur ? "active" : f.path && f.path.has(i) ? "path" : f.status[i] === "done" ? "done" : f.status[i] === "bad" ? "bad" : ""; } });
      return Viz.row(g, tbl);
    },
  }));
})();
