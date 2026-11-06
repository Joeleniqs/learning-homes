/* Shortest path visualizers. Every frame comes from running the real algorithm on your input. */
(() => {
  const S = "shortest-paths";
  const P = (name) => `${S}-${name}`;
  const INF = Infinity;
  const fm = (x) => (x === INF ? "∞" : x === -INF ? "−∞" : String(x));
  const col = (...h) => `<div class="sp-col">${h.filter(Boolean).join("")}</div>`;
  const badge = (html, c = "") => `<span class="sp-badge ${c}">${html}</span>`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* A fixed, planar 9-slot layout. Random graphs only use NEAR pairs, so edges never cross. */
  const SLOTS = [[50, 50], [190, 30], [330, 50], [50, 180], [190, 160], [330, 180], [190, 290], [50, 310], [330, 310]];
  const NEAR = [[0, 1], [1, 2], [0, 3], [0, 4], [1, 4], [2, 4], [2, 5], [3, 4], [4, 5], [3, 6], [4, 6], [5, 6], [3, 7], [6, 7], [5, 8], [6, 8]];
  const NEARSET = new Set(NEAR.map(([a, b]) => `${a}-${b}`));
  const DIAMOND = [[40, 110], [190, 30], [190, 190], [340, 110]];
  const DEF_E = "0-1 4, 0-3 1, 3-4 2, 1-4 2, 1-2 6, 4-5 6, 2-5 1, 3-6 7, 4-6 3, 5-6 2";

  function parseE(text, { maxN = 9, maxE = 18, directed = true, neg = true, minW = -99, maxW = 99 } = {}) {
    const toks = String(text).split(/[,;]+/).map((t) => t.trim()).filter(Boolean);
    const seen = new Set();
    const edges = toks.map((t) => {
      const m = t.match(/^(\d+)\s*(?:->|-|>|→)\s*(\d+)\s+(-?\d+)$/);
      if (!m) throw new Error(`Cannot read "${t}". Write weighted edges as u-v w, for example 0-1 4.`);
      const u = +m[1], v = +m[2], w = +m[3];
      if (u >= maxN || v >= maxN) throw new Error(`Use node numbers 0..${maxN - 1}.`);
      if (u === v) throw new Error(`Self-loop "${t}" is not allowed.`);
      if (Math.abs(w) > maxW) throw new Error(`Keep weights between -${maxW} and ${maxW}.`);
      if (!neg && w < 0) throw new Error(`Edge ${u}-${v} has weight ${w}. This algorithm needs non-negative weights (see the negative-edge visualizer and Bellman-Ford).`);
      if (w < minW) throw new Error(`Weights must be at least ${minW} here.`);
      const key = directed ? `${u}>${v}` : u < v ? `${u}-${v}` : `${v}-${u}`;
      if (seen.has(key)) throw new Error(`Edge ${u}-${v} appears twice. Keep only the cheaper copy: a shortest path never uses the dearer one.`);
      seen.add(key);
      return [u, v, w];
    });
    if (!edges.length || edges.length > maxE) throw new Error(`Use 1 to ${maxE} edges.`);
    return edges;
  }
  const nOf = (edges, ...extra) => Math.max(...edges.flatMap(([u, v]) => [u + 1, v + 1]), ...extra.map((x) => x + 1));
  function positions(n, edges) {
    const key = ([u, v]) => (u < v ? `${u}-${v}` : `${v}-${u}`);
    if (n <= 9 && edges.every((e) => NEARSET.has(key(e)))) return SLOTS.slice(0, n).map(([x, y], id) => ({ id, x, y }));
    if (n === 4 && !edges.some((e) => key(e) === "0-3")) return DIAMOND.map(([x, y], id) => ({ id, x, y }));
    return Viz.layout.circle(Array.from({ length: n }, (_, i) => i), Math.max(110, n * 22));
  }
  function adjOf(n, edges, directed) {
    const a = Array.from({ length: n }, () => []);
    edges.forEach(([u, v, w], i) => { a[u].push([v, w, i]); if (!directed) a[v].push([u, w, i]); });
    return a;
  }
  /* Random graph on the planar slots. Directed graphs are oriented away from node 0 along a spanning tree, so most nodes are reachable. */
  function randomGraph({ nMin = 5, nMax = 8, extra = 3, wMin = 1, wMax = 9, directed = false, negP = 0 } = {}) {
    const n = Viz.rand(nMin, nMax), cand = shuffle(NEAR.filter(([a, b]) => a < n && b < n));
    const p = Array.from({ length: n }, (_, i) => i), find = (x) => (p[x] === x ? x : (p[x] = find(p[x])));
    const tree = [], rest = [];
    for (const e of cand) { const a = find(e[0]), b = find(e[1]); if (a !== b) { p[a] = b; tree.push(e); } else rest.push(e); }
    const adj = Array.from({ length: n }, () => []);
    for (const [a, b] of tree) { adj[a].push(b); adj[b].push(a); }
    const depth = Array(n).fill(-1), q = [0]; depth[0] = 0;
    while (q.length) { const x = q.shift(); for (const y of adj[x]) if (depth[y] < 0) { depth[y] = depth[x] + 1; q.push(y); } }
    const out = [...tree.map(([a, b]) => (depth[a] <= depth[b] ? [a, b] : [b, a])), ...rest.slice(0, extra).map(([a, b]) => (Math.random() < 0.5 ? [a, b] : [b, a]))];
    return shuffle(out).map(([a, b]) => { const w = Math.random() < negP ? -Viz.rand(1, 4) : Viz.rand(wMin, wMax); return directed ? `${a}-${b} ${w}` : `${Math.min(a, b)}-${Math.max(a, b)} ${w}`; }).join(", ");
  }
  function draw(n, edges, o = {}) {
    const pos = positions(n, edges);
    const blockedAbove = (id) => edges.some(([u, v]) => { const a = u === id ? v : v === id ? u : -1; if (a < 0) return false; const dx = pos[a].x - pos[id].x, dy = pos[a].y - pos[id].y; return dy < 0 && Math.abs(dx) < -dy * 0.6; });
    const nodes = pos.map((p) => {
      const tag = o.tag ? o.tag(p.id) : undefined, sub = o.sub ? o.sub(p.id) : undefined, up = tag !== undefined && !blockedAbove(p.id);
      return { ...p, label: String(p.id), sub: tag !== undefined && !up ? (sub !== undefined ? `${tag}: ${sub}` : tag) : sub, top: up ? tag : undefined };
    });
    return Viz.graph({ nodes, edges: edges.map(([u, v, w], i) => ({ u, v, w, cls: (o.edgeCls && o.edgeCls(i)) || "" })), directed: !!o.directed }, { r: 18, label: o.caption, nodeCls: o.nodeCls ? (id) => o.nodeCls(+id) || "" : undefined });
  }
  const eName = ([u, v], directed = true) => `${u}${directed ? "→" : "–"}${v}`;
  function heapView(entries, isStale, label, fmtE, max = 8) {
    if (!entries.length) return Viz.labeled(label, badge("empty"));
    const shown = entries.slice(0, max), more = entries.length - shown.length;
    const vals = shown.map(fmtE);
    if (more > 0) vals.push(`+${more}`);
    return Viz.array(vals, { label, showIdx: false, cls: (i) => (i >= shown.length ? "dim" : isStale(shown[i]) ? "bad" : i === 0 ? "active" : "") });
  }
  /* Reference Bellman-Ford: exact distances, −∞ for nodes reachable from a negative cycle. */
  function bfTruth(n, edges, s) {
    const d = Array(n).fill(INF); d[s] = 0;
    for (let r = 0; r < n - 1; r++) for (const [u, v, w] of edges) if (d[u] + w < d[v]) d[v] = d[u] + w;
    const neg = new Set();
    for (const [u, v, w] of edges) if (d[u] !== INF && d[u] + w < d[v]) neg.add(v);
    const st = [...neg];
    while (st.length) { const x = st.pop(); for (const [u, v] of edges) if (u === x && !neg.has(v)) { neg.add(v); st.push(v); } }
    for (const x of neg) d[x] = -INF;
    return d;
  }
  const dirInput = (opts, def = "undirected") => ({ key: "dir", label: "edges are", type: "select", options: ["undirected", "directed"], value: opts.dir || def });

  /* ---------- Dijkstra family: plain (with path), counting shortest paths, multi-source ---------- */
  const CODE = {
    plain: [
      "dist = [inf] * n; dist[s] = 0; parent = [-1] * n",
      "heap = [(0, s)]",
      "while heap:",
      "    d, u = heappop(heap)          # closest unsettled node",
      "    if d > dist[u]: continue      # stale entry: skip it",
      "    for v, w in adj[u]:           # d is final: relax u's edges",
      "        if d + w < dist[v]:",
      "            dist[v] = d + w; parent[v] = u",
      "            heappush(heap, (dist[v], v))",
      "path, x = [], t                   # rebuild s -> t backwards",
      "while x != -1: path.append(x); x = parent[x]",
      "return dist, path[::-1]",
    ],
    ways: [
      "dist = [inf] * n; dist[s] = 0",
      "ways = [0] * n; ways[s] = 1",
      "heap = [(0, s)]",
      "while heap:",
      "    d, u = heappop(heap)",
      "    if d > dist[u]: continue      # u final: so is ways[u]",
      "    for v, w in adj[u]:",
      "        if d + w < dist[v]:       # strictly shorter: restart count",
      "            dist[v] = d + w; ways[v] = ways[u]",
      "            heappush(heap, (dist[v], v))",
      "        elif d + w == dist[v]:    # another shortest route",
      "            ways[v] += ways[u]",
      "return ways[t]",
    ],
    multi: [
      "dist = [inf] * n; owner = [-1] * n",
      "for s in sources: dist[s] = 0; owner[s] = s",
      "heap = [(0, s) for s in sources]  # one heap, every source",
      "while heap:",
      "    d, u = heappop(heap)",
      "    if d > dist[u]: continue",
      "    for v, w in adj[u]:",
      "        if d + w < dist[v]:",
      "            dist[v] = d + w; owner[v] = owner[u]",
      "            heappush(heap, (dist[v], v))",
      "return dist, owner              # nearest source of each node",
    ],
  };
  const LINES = {
    plain: { init: [0, 1], pop: [2, 3], stale: [4], scan: [5], check: [6], improve: [6, 7, 8], tie: [6], path: [9, 10, 11] },
    ways: { init: [0, 1, 2], pop: [3, 4], stale: [5], scan: [6], check: [7], improve: [7, 8, 9], tie: [10, 11], path: [12] },
    multi: { init: [0, 1, 2], pop: [3, 4], stale: [5], scan: [6], check: [7], improve: [7, 8, 9], tie: [7], path: [10] },
  };
  function parseNodes(text, n, what) {
    const a = String(text).split(/[,\s]+/).filter(Boolean).map((t) => { if (!/^\d+$/.test(t) || +t >= n) throw new Error(`${what}: "${t}" is not a node 0..${n - 1}.`); return +t; });
    if (!a.length) throw new Error(`${what}: give at least one node.`);
    return [...new Set(a)];
  }

  function dijkstraFrames(mode, { edges, directed, sources, target }) {
    const n = nOf(edges, ...sources, target ?? 0), A = adjOf(n, edges, directed), L = LINES[mode];
    const dist = Array(n).fill(INF), par = Array(n).fill(-1), parE = Array(n).fill(-1), ways = Array(n).fill(0), owner = Array(n).fill(-1), settled = Array(n).fill(false);
    let heap = [], pops = 0, staleN = 0;
    const cmp = (a, b) => a[0] - b[0] || a[1] - b[1];
    const fr = [];
    const snap = (x) => fr.push({ mode, n, edges, directed, sources, target, dist: [...dist], par: [...par], parE: [...parE], ways: [...ways], owner: [...owner], settled: [...settled], heap: heap.map((h) => [...h]), ...x, vars: { pops, stale: staleN, heap: heap.length, ...(x.vars || {}) } });
    for (const s of sources) { dist[s] = 0; ways[s] = 1; owner[s] = s; heap.push([0, s]); }
    heap.sort(cmp);
    snap({ line: L.init, note: mode === "multi" ? `All ${sources.length} sources start at distance 0 in <b>one</b> heap. That is the same as adding a virtual super-source joined to each of them by a 0-weight edge, then running plain Dijkstra once.` : `Only the source ${sources[0]} has a known distance (0). Every other node starts at ∞. The heap holds <b>candidate</b> distances; the smallest candidate is always safe to finalise.${mode === "ways" ? " ways[s] = 1: there is one way to be at the start." : ""}` });
    while (heap.length) {
      heap.sort(cmp);
      const [d, u] = heap.shift();
      pops++;
      if (d > dist[u]) {
        staleN++;
        snap({ cur: u, line: L.stale, popped: [d, u], vars: { d, u }, note: `Popped (${d}, ${u}), but dist[${u}] is already ${dist[u]} &lt; ${d}. This entry was pushed before a shorter route to ${u} was found: it is <b>stale</b>. Skip it. (Lazy deletion: instead of decreasing a key inside the heap, push a new entry and ignore the old one when it surfaces.)` });
        continue;
      }
      settled[u] = true;
      const why = mode === "ways" ? ` Every shortest route into ${u} comes from a node with a strictly smaller distance, and those were all settled before ${u}, so ways[${u}] = ${ways[u]} is final too.` : mode === "multi" ? ` Its nearest source is ${owner[u]}.` : "";
      snap({ cur: u, line: L.pop, vars: { d, u }, note: `Pop (${d}, ${u}): the smallest candidate in the heap. dist[${u}] = ${d} is now <b>final</b>: any other route to ${u} must leave the settled set through some node already in the heap at distance ≥ ${d}, and the weights after that can only add.${why}` });
      const scan = A[u].filter(([v]) => !settled[v]);
      if (!scan.length) snap({ cur: u, line: L.scan, vars: { d, u }, note: `Every neighbour of ${u} is already settled, so there is nothing to relax.` });
      for (const [v, w, i] of scan) {
        const nd = d + w;
        if (nd < dist[v]) {
          const old = dist[v];
          dist[v] = nd; par[v] = u; parE[v] = i; ways[v] = ways[u]; owner[v] = owner[u];
          heap.push([nd, v]);
          const ex = mode === "ways" ? ` ways[${v}] = ways[${u}] = ${ways[v]}: the old count was for a longer distance, so it is thrown away.` : mode === "multi" ? ` ${v} now belongs to source ${owner[v]}.` : ` parent[${v}] = ${u}.`;
          snap({ cur: u, ce: i, cv: v, line: L.improve, vars: { d, u, v, w, "d + w": nd }, note: `Relax ${eName([u, v], directed)}: ${d} + ${w} = ${nd} &lt; ${fm(old)}. Better route found, so dist[${v}] = ${nd} and push (${nd}, ${v}).${old !== INF ? ` The old entry (${old}, ${v}) is still in the heap; it will be skipped as stale.` : ""}${ex}` });
        } else if (mode === "ways" && nd === dist[v]) {
          ways[v] += ways[u];
          snap({ cur: u, ce: i, cv: v, tie: true, line: L.tie, vars: { d, u, v, w, "d + w": nd }, note: `${d} + ${w} = ${nd} <b>equals</b> dist[${v}]. A second family of shortest routes reaches ${v} through ${u}: ways[${v}] += ways[${u}] → ${ways[v]}. No push: the distance did not change.` });
        } else {
          snap({ cur: u, ce: i, cv: v, nope: true, line: L.check, vars: { d, u, v, w, "d + w": nd }, note: `${eName([u, v], directed)}: ${d} + ${w} = ${nd} is not better than dist[${v}] = ${fm(dist[v])}. Keep the old route.` });
        }
      }
    }
    const reach = dist.filter((x) => x < INF).length;
    if (mode === "plain") {
      const t = target, pathE = new Set(), pathN = [];
      if (dist[t] < INF) { for (let x = t; x !== -1; x = par[x]) { pathN.push(x); if (parE[x] >= 0) pathE.add(parE[x]); } pathN.reverse(); }
      snap({ final: true, pathE, pathN, line: L.path, vars: { [`dist[${t}]`]: fm(dist[t]), pops }, note: dist[t] < INF ? `Heap empty: every reachable node is settled (${reach}/${n}). Follow parent[] back from ${t} and reverse: <b>${pathN.join(" → ")}</b>, length ${dist[t]}. The parent edges (green) form a <b>shortest-path tree</b>: one tree answers "how do I get from ${sources[0]} to anywhere".` : `Heap empty. ${t} was never reached: dist[${t}] = ∞, so there is no path. Return −1 (or whatever the problem asks for).` });
    } else if (mode === "ways") {
      snap({ final: true, line: L.path, vars: { [`ways[${target}]`]: ways[target] }, note: dist[target] < INF ? `Done. dist[${target}] = ${dist[target]} and there are <b>${ways[target]}</b> different shortest routes to it. The counts flow along the "shortest-path DAG": the edges with dist[u] + w = dist[v]. Real problems ask for this modulo 10⁹ + 7.` : `${target} is unreachable: 0 ways.` });
    } else {
      snap({ final: true, line: L.path, note: `Done in one pass: each node is coloured by its nearest source (ties go to whichever reached it first). Running Dijkstra once per source would cost ${sources.length}× as much and still need a min over the results.` });
    }
    return fr;
  }
  function dijkstraRender(f) {
    const tree = new Set(f.parE.filter((i) => i >= 0));
    const edgeCls = (i) => {
      if (f.final && f.pathE) return f.pathE.has(i) ? "path" : tree.has(i) ? "done" : "dim";
      if (i === f.ce) return f.nope ? "bad" : f.tie ? "path" : "active";
      if (tree.has(i)) { const [u, v] = f.edges[i]; const child = f.par[v] === u && f.parE[v] === i ? v : u; return f.settled[child] ? "done" : "visit"; }
      return f.final ? "dim" : "";
    };
    const multi = f.mode === "multi", srcIdx = (x) => f.sources.indexOf(x);
    const nodeCls = (id) => {
      if (multi && f.owner[id] >= 0 && (f.settled[id] || f.final)) return `sp-g${srcIdx(f.owner[id]) % 4}${id === f.cur && !f.final ? " sp-cur" : ""}`;
      if (f.final && f.pathN && f.pathN.includes(id)) return "path";
      if (id === f.cur && !f.final) return "active";
      if (id === f.cv) return "visit";
      if (f.settled[id]) return "done";
      return f.dist[id] < INF ? "visit" : "";
    };
    const g = draw(f.n, f.edges, { directed: f.directed, caption: multi ? "graph (colour = nearest source)" : "graph (number under a node = dist)", sub: (id) => fm(f.dist[id]), edgeCls, nodeCls, tag: (id) => (f.sources.includes(id) ? (multi ? `s${srcIdx(id)}` : "s") : f.mode !== "multi" && id === f.target ? "t" : undefined) });
    const cols = f.mode === "ways" ? ["node", "dist", "ways", "state"] : multi ? ["node", "dist", "owner", "state"] : ["node", "dist", "parent", "state"];
    const rows = Array.from({ length: f.n }, (_, v) => [v, fm(f.dist[v]), f.mode === "ways" ? f.ways[v] : multi ? (f.owner[v] >= 0 ? f.owner[v] : "·") : f.par[v] >= 0 ? f.par[v] : "·", f.settled[v] ? "final" : f.dist[v] < INF ? "in heap" : "—"]);
    const tbl = Viz.grid(rows, { label: "distance table", colLabels: cols, cls: (r) => (r === f.cur && !f.final ? "active" : r === f.cv ? "visit" : f.settled[r] ? "done" : f.dist[r] === INF ? "dim" : "") });
    const hp = [...f.heap].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
    const heap = heapView(hp, ([d, v]) => d > f.dist[v], "heap of (dist, node), smallest first", ([d, v]) => `${d}, ${v}`);
    return Viz.row(col(g, heap), tbl);
  }
  const DIJ_LEGEND = [["active", "node being settled / edge being relaxed"], ["visit", "tentative (in the heap)"], ["done", "final / shortest-path tree"], ["bad", "relaxation that did not help, or a stale heap entry"], ["path", "reconstructed path"]];

  Viz.register(P("dijkstra"), (el, opts) => Viz.player(el, {
    title: "Dijkstra: settle the closest node, relax its edges, repeat",
    tag: "HEAP + DISTANCE TABLE",
    legend: DIJ_LEGEND,
    codeLang: "python",
    code: CODE.plain,
    inputs: [
      { key: "e", label: "edges u-v w (w ≥ 0)", value: opts.e || DEF_E, width: 330 },
      dirInput(opts),
      { key: "s", label: "source", value: String(opts.s ?? 0), width: 46 },
      { key: "t", label: "target", value: String(opts.t ?? 2), width: 46 },
    ],
    random: () => { const e = randomGraph({ extra: Viz.rand(2, 4) }); const n = nOf(parseE(e, { directed: false })); return { e, dir: "undirected", s: "0", t: String(Viz.rand(1, n - 1)) }; },
    build: ({ e, dir, s, t }) => {
      const directed = dir === "directed", edges = parseE(e, { directed, neg: false });
      const n = nOf(edges);
      return dijkstraFrames("plain", { edges, directed, sources: [Viz.parse.int(s, { min: 0, max: n - 1 })], target: Viz.parse.int(t, { min: 0, max: n - 1 }) });
    },
    render: dijkstraRender,
  }));

  Viz.register(P("ways"), (el, opts) => Viz.player(el, {
    title: "Counting shortest paths: Dijkstra plus a ways[] array",
    tag: "DIJKSTRA + COUNTING",
    legend: [["active", "node being settled / edge being relaxed"], ["path", "tie: another shortest route, add its count"], ["done", "final"], ["bad", "longer route, ignored"]],
    codeLang: "python",
    code: CODE.ways,
    inputs: [
      { key: "e", label: "edges u-v w (w ≥ 1)", value: opts.e || "0-1 2, 0-3 2, 0-4 3, 1-4 1, 3-4 1, 1-2 2, 2-5 1, 4-5 2, 3-6 3, 4-6 2, 5-6 1", width: 360 },
      dirInput(opts),
      { key: "t", label: "target", value: String(opts.t ?? 6), width: 46 },
    ],
    random: () => { const e = randomGraph({ extra: Viz.rand(3, 6), wMax: 3 }); return { e, dir: "undirected", t: String(nOf(parseE(e, { directed: false })) - 1) }; },
    build: ({ e, dir, t }) => {
      const directed = dir === "directed", edges = parseE(e, { directed, neg: false, minW: 1 });
      const n = nOf(edges);
      return dijkstraFrames("ways", { edges, directed, sources: [0], target: Viz.parse.int(t, { min: 0, max: n - 1 }) });
    },
    render: dijkstraRender,
  }));

  Viz.register(P("multi"), (el, opts) => Viz.player(el, {
    title: "Multi-source Dijkstra: every source in one heap",
    tag: "VIRTUAL SUPER-SOURCE",
    legend: [["active", "node being settled / edge being relaxed"], ["visit", "tentative"], ["bad", "relaxation that did not help"]],
    codeLang: "python",
    code: CODE.multi,
    inputs: [
      { key: "e", label: "edges u-v w (w ≥ 0)", value: opts.e || DEF_E, width: 330 },
      dirInput(opts),
      { key: "src", label: "sources", value: opts.src || "0, 5", width: 70 },
    ],
    random: () => { const e = randomGraph({ nMin: 6, nMax: 9, extra: Viz.rand(2, 5) }); const n = nOf(parseE(e, { directed: false })); return { e, dir: "undirected", src: shuffle(Array.from({ length: n }, (_, i) => i)).slice(0, Viz.rand(2, 3)).join(", ") }; },
    build: ({ e, dir, src }) => {
      const directed = dir === "directed", edges = parseE(e, { directed, neg: false });
      const n = nOf(edges), sources = parseNodes(src, n, "sources");
      if (sources.length > 4) throw new Error("Use at most 4 sources so the colours stay distinct.");
      return dijkstraFrames("multi", { edges, directed, sources });
    },
    render: dijkstraRender,
  }));

  /* ---------- Why Dijkstra breaks on negative edges ---------- */
  Viz.register(P("negative"), (el, opts) => Viz.player(el, {
    title: "A negative edge breaks Dijkstra's promise",
    tag: "COUNTEREXAMPLE",
    legend: [["active", "node being settled / edge being relaxed"], ["done", "settled (declared final)"], ["bad", "a shorter route found too late / wrong answer"], ["visit", "tentative"]],
    codeLang: "python",
    code: [
      "dist = [inf] * n; dist[s] = 0; done = set()",
      "heap = [(0, s)]",
      "while heap:",
      "    d, u = heappop(heap)",
      "    if u in done: continue        # [textbook] settle each node once",
      "    if d > dist[u]: continue      # [lazy] skip only stale entries",
      "    done.add(u)                   # claim: dist[u] is final",
      "    for v, w in adj[u]:",
      "        if d + w < dist[v]:",
      "            if v in done: continue  # [textbook] too late for v",
      "            dist[v] = d + w; heappush(heap, (dist[v], v))",
    ],
    inputs: [
      { key: "e", label: "directed edges u-v w", value: opts.e || "0-1 2, 0-2 4, 2-1 -3, 1-3 1", width: 300 },
      { key: "mode", label: "Dijkstra version", type: "select", options: ["textbook (settle once)", "lazy (re-push)"], value: opts.mode || "textbook (settle once)" },
    ],
    random: () => ({ e: randomGraph({ nMin: 4, nMax: 6, extra: 2, wMax: 6, directed: true, negP: 0.3 }), mode: Math.random() < 0.5 ? "textbook (settle once)" : "lazy (re-push)" }),
    build: ({ e, mode }) => {
      const edges = parseE(e, { directed: true }), n = nOf(edges), A = adjOf(n, edges, true), lazy = mode.startsWith("lazy");
      const truth = bfTruth(n, edges, 0);
      const dist = Array(n).fill(INF), done = Array(n).fill(false), times = Array(n).fill(0);
      dist[0] = 0;
      let heap = [[0, 0]], pops = 0, broke = false;
      const late = new Set(), fr = [];
      const snap = (x) => fr.push({ n, edges, dist: [...dist], done: [...done], times: [...times], heap: heap.map((h) => [...h]), late: new Set(late), ...x, vars: { pops, ...(x.vars || {}) } });
      snap({ line: [0, 1], note: `Source 0. Edge weights here can be negative. Dijkstra's proof says "the smallest candidate can never get smaller", which relies on every edge adding <b>at least 0</b>. Watch what happens when one subtracts.` });
      while (heap.length) {
        heap.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        const [d, u] = heap.shift();
        pops++;
        if (pops > 6 * n + 6) { broke = true; snap({ cur: u, line: [2], note: `Stopped after ${pops} pops. Distances keep dropping because a <b>negative cycle</b> is reachable: every lap makes the route cheaper, so this loop would never end. Bellman-Ford detects this case instead of spinning.` }); break; }
        if (!lazy && done[u]) { snap({ cur: u, line: [4], vars: { d, u }, note: `Popped (${d}, ${u}) but ${u} is already settled. Skip.` }); continue; }
        if (lazy && d > dist[u]) { snap({ cur: u, line: [5], vars: { d, u }, note: `Popped (${d}, ${u}), stale (dist[${u}] = ${dist[u]}). Skip.` }); continue; }
        const again = done[u];
        done[u] = true; times[u]++;
        snap({ cur: u, line: [3, 6], vars: { d, u }, note: again ? `${u} is popped and processed a <b>second time</b> (dist dropped from an earlier value to ${d}). The guarantee "popped means final" is gone: this is no longer Dijkstra but a label-correcting search, and on bad inputs the number of re-processings grows exponentially.` : `Pop (${d}, ${u}) and declare dist[${u}] = ${d} final.${truth[u] !== d ? ` <b>It is not:</b> the true distance is ${fm(truth[u])}. The cheaper route goes through a node that is still farther away, followed by a negative edge.` : ""}` });
        for (const [v, w, i] of A[u]) {
          const nd = d + w;
          if (!(nd < dist[v])) continue;
          if (!lazy && done[v]) {
            late.add(v);
            snap({ cur: u, ce: i, cv: v, bad: true, line: [8, 9], vars: { d, u, v, w, "d + w": nd }, note: `${d} + (${w}) = ${nd} &lt; dist[${v}] = ${dist[v]}. A shorter route to ${v}, but ${v} was settled earlier and its outgoing edges were already relaxed with the wrong value. The textbook algorithm never looks back, so dist[${v}] and everything computed from it stays wrong.` });
            continue;
          }
          const old = dist[v];
          dist[v] = nd; heap.push([nd, v]);
          snap({ cur: u, ce: i, cv: v, line: [8, 10], vars: { d, u, v, w, "d + w": nd }, note: `Relax ${u}→${v}: ${d} + (${w}) = ${nd} &lt; ${fm(old)}. dist[${v}] = ${nd}, push.${done[v] ? ` ${v} was already processed once; it will be processed again.` : ""}` });
        }
      }
      const wrong = new Set(Array.from({ length: n }, (_, v) => v).filter((v) => dist[v] !== truth[v]));
      const negCyc = truth.some((x) => x === -INF);
      const total = times.reduce((a, b) => a + b, 0);
      snap({ final: true, wrong, truth, line: [], vars: { pops, "node visits": total }, note: wrong.size ? `Final comparison with Bellman-Ford (right column): ${[...wrong].map((v) => `dist[${v}] = ${fm(dist[v])} but truly ${fm(truth[v])}`).join("; ")}. ${negCyc ? "A negative cycle makes some distances −∞: no shortest path exists at all." : lazy ? "" : "One negative edge was enough to break the textbook algorithm."}` : lazy ? `Lazy Dijkstra happened to get every distance right here, but it processed ${total} node visits for ${n} nodes${total > n ? " (some nodes more than once)" : ""}. With negative edges there is no bound like O(E log V) any more. Correct answers do not make it the right tool: use Bellman-Ford (or SPFA) when weights can be negative.` : `All distances happen to match here (the negative edge never undercut a settled node). Try the default input to see the failure.` });
      return fr;
    },
    render: (f) => {
      const edgeCls = (i) => (i === f.ce ? (f.bad ? "bad" : "active") : f.final ? "" : "");
      const nodeCls = (id) => (f.final ? (f.wrong.has(id) ? "bad" : "done") : id === f.cur ? "active" : f.late.has(id) ? "bad" : id === f.cv ? "visit" : f.done[id] ? "done" : f.dist[id] < INF ? "visit" : "");
      const g = draw(f.n, f.edges, { directed: true, caption: "directed graph (number under a node = dist)", sub: (id) => fm(f.dist[id]), edgeCls, nodeCls, tag: (id) => (id === 0 ? "s" : undefined) });
      const rows = Array.from({ length: f.n }, (_, v) => f.final ? [v, fm(f.dist[v]), fm(f.truth[v]), f.wrong.has(v) ? "✗" : "✓"] : [v, fm(f.dist[v]), f.times[v]]);
      const tbl = Viz.grid(rows, { label: f.final ? "Dijkstra vs Bellman-Ford" : "distance table", colLabels: f.final ? ["node", "Dijkstra", "true", ""] : ["node", "dist", "times processed"], cls: (r) => (f.final ? (f.wrong.has(r) ? "bad" : "done") : r === f.cur ? "active" : f.late.has(r) ? "bad" : f.done[r] ? "done" : "") });
      const hp = [...f.heap].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      return Viz.row(col(g, heapView(hp, ([d, v]) => d > f.dist[v], "heap of (dist, node)", ([d, v]) => `${d}, ${v}`)), tbl);
    },
  }));

  /* ---------- Bellman-Ford: rounds of relaxation, then the negative-cycle check ---------- */
  Viz.register(P("bellman"), (el, opts) => Viz.player(el, {
    title: "Bellman-Ford: relax every edge, V − 1 times",
    tag: "ROUNDS + NEGATIVE CYCLES",
    legend: [["active", "edge that just improved a distance"], ["done", "final shortest-path edge"], ["bad", "still improvable after V − 1 rounds: negative cycle"], ["visit", "changed in this round"]],
    codeLang: "python",
    code: [
      "dist = [inf] * n; dist[s] = 0",
      "for rnd in range(n - 1):            # a shortest path has <= n-1 edges",
      "    changed = False",
      "    for u, v, w in edges:            # any fixed order",
      "        if dist[u] + w < dist[v]:",
      "            dist[v] = dist[u] + w; changed = True",
      "    if not changed: break            # nothing moved: all final",
      "for u, v, w in edges:                # one extra round",
      "    if dist[u] + w < dist[v]: return 'negative cycle'",
      "return dist",
    ],
    inputs: [
      { key: "e", label: "directed edges u-v w (in scan order)", value: opts.e || "4-3 2, 5-4 -2, 2-5 3, 1-2 -1, 0-1 4, 0-3 9, 0-4 7, 1-4 6", width: 380 },
      { key: "s", label: "source", value: String(opts.s ?? 0), width: 46 },
    ],
    random: () => ({ e: randomGraph({ nMin: 4, nMax: 7, extra: Viz.rand(1, 3), wMax: 8, directed: true, negP: 0.3 }), s: "0" }),
    build: ({ e, s }) => {
      const edges = parseE(e, { directed: true }), n = nOf(edges);
      s = Viz.parse.int(s, { min: 0, max: n - 1 });
      const dist = Array(n).fill(INF), parE = Array(n).fill(-1);
      dist[s] = 0;
      const hist = [[...dist]], fr = [];
      let status = Array(edges.length).fill(""), rnd = 0, changedSet = new Set();
      const snap = (x) => fr.push({ n, edges, s, dist: [...dist], parE: [...parE], hist: hist.map((h) => [...h]), status: [...status], changed: new Set(changedSet), rnd, ...x });
      snap({ line: [0], vars: { round: 0 }, note: `dist[${s}] = 0, everything else ∞. Bellman-Ford makes no clever choice of order: it simply relaxes <b>every</b> edge, in the listed order, round after round. After round k, every node whose shortest path uses at most k edges has its final distance.` });
      let early = false;
      for (rnd = 1; rnd <= n - 1; rnd++) {
        status = Array(edges.length).fill(""); changedSet = new Set();
        let changed = false;
        snap({ line: [1, 2], vars: { round: rnd }, note: `Round ${rnd} of at most ${n - 1}. Scan all ${edges.length} edges in order.` });
        edges.forEach(([u, v, w], i) => {
          if (dist[u] === INF) { status[i] = "∞"; return; }
          if (dist[u] + w < dist[v]) {
            const old = dist[v];
            dist[v] = dist[u] + w; parE[v] = i; changed = true; status[i] = "relaxed"; changedSet.add(v);
            snap({ ce: i, line: [4, 5], vars: { round: rnd, edge: `${u}→${v} (${w})`, [`dist[${v}]`]: `${fm(old)} → ${dist[v]}` }, note: `${u}→${v}: dist[${u}] + ${w} = ${dist[v]} &lt; ${fm(old)}. Improve dist[${v}].${old !== INF ? " It had a value already, but a route with more edges turned out cheaper." : ""}` });
          } else status[i] = "no";
        });
        hist.push([...dist]);
        const nRel = status.filter((x) => x === "relaxed").length, nInf = status.filter((x) => x === "∞").length;
        if (!changed) { early = true; snap({ line: [6], vars: { round: rnd }, note: `Round ${rnd} changed nothing, so no later round can either (every round reads the same values). Stop early. ${nInf ? `${nInf} edge(s) start at an unreachable node (∞) and never matter.` : ""}` }); break; }
        snap({ line: [3], vars: { round: rnd }, note: `End of round ${rnd}: ${nRel} edge(s) improved something (row "${rnd}" in the history). ${nInf ? `${nInf} edge(s) were skipped because their start is still ∞. ` : ""}Notice how the scan order matters: an edge listed before the edge that feeds it has to wait one more round.` });
      }
      if (rnd > n - 1) rnd = n - 1;
      status = Array(edges.length).fill(""); changedSet = new Set();
      const neg = [];
      edges.forEach(([u, v, w], i) => { if (dist[u] !== INF && dist[u] + w < dist[v]) { neg.push(i); status[i] = "still!"; } });
      if (!neg.length) {
        snap({ final: true, line: [7, 8, 9], vars: { rounds: rnd }, note: `${early ? "Stopped early. " : ""}${early ? "" : "Extra check round: "}no edge can still be relaxed, so there is no negative cycle reachable from ${s}. Final distances: ${dist.map((d, v) => `${v}:${fm(d)}`).join(", ")}. Cost O(V·E), and the parent edges (green) give the paths.` });
        return fr;
      }
      const inf = new Set(neg.map((i) => edges[i][1])), st = [...inf];
      while (st.length) { const x = st.pop(); for (const [u, v] of edges) if (u === x && !inf.has(v)) { inf.add(v); st.push(v); } }
      snap({ neg: new Set(neg), line: [7, 8], vars: { rounds: n - 1 }, note: `After ${n - 1} rounds every simple path has been accounted for, yet ${neg.map((i) => eName(edges[i])).join(", ")} can <b>still</b> be relaxed. That is only possible if a cycle of negative total weight is reachable: going round it once more always helps.` });
      for (const x of inf) dist[x] = -INF;
      snap({ final: true, neg: new Set(neg), inf, line: [8], note: `Nodes reachable from that cycle (${[...inf].sort((a, b) => a - b).join(", ")}) have no shortest path: their distance is −∞. Everything else is still correct. Problems either want "is there a negative cycle?" (arbitrage) or these nodes marked as −∞.` });
      return fr;
    },
    render: (f) => {
      const tree = new Set(f.parE.filter((i) => i >= 0));
      const edgeCls = (i) => (f.neg && f.neg.has(i) ? "bad" : i === f.ce ? "active" : f.final && tree.has(i) && !f.inf ? "done" : "");
      const nodeCls = (id) => (f.inf && f.inf.has(id) ? "bad" : f.ce !== undefined && f.edges[f.ce][1] === id ? "active" : f.changed.has(id) ? "visit" : f.dist[id] < INF ? "done" : "");
      const g = draw(f.n, f.edges, { directed: true, caption: "graph (number under a node = dist)", sub: (id) => fm(f.dist[id]), edgeCls, nodeCls, tag: (id) => (id === f.s ? "s" : undefined) });
      const hist = Viz.grid(f.hist.map((r) => r.map(fm)), { label: "dist after each round", colLabels: Array.from({ length: f.n }, (_, i) => String(i)), corner: "round", rowLabels: f.hist.map((_, i) => (i === 0 ? "start" : String(i))), cls: (r, c) => (r > 0 && f.hist[r][c] !== f.hist[r - 1][c] ? "visit" : f.hist[r][c] === INF ? "dim" : "") });
      const et = Viz.grid(f.edges.map((e, i) => [eName(e), e[2], f.status[i]]), { label: f.neg ? "check round" : `round ${f.rnd || 0} scan`, colLabels: ["edge", "w", "result"], cls: (r) => (r === f.ce ? "active" : f.status[r] === "still!" ? "bad" : f.status[r] === "relaxed" ? "visit" : f.status[r] === "∞" ? "dim" : "") });
      return Viz.row(col(g, hist), et);
    },
  }));

  /* ---------- Cheapest flights within k stops: rounds that read only the previous round ---------- */
  Viz.register(P("kstops"), (el, opts) => Viz.player(el, {
    title: "At most k stops: k + 1 Bellman-Ford rounds, each reading a frozen copy",
    tag: "BOUNDED EDGES",
    legend: [["active", "flight being tried"], ["bad", "bug: reads a value from this same round"], ["visit", "improved this round"], ["path", "the route behind the answer"]],
    codeLang: "python",
    code: [
      "dist = [inf] * n; dist[src] = 0",
      "for _ in range(k + 1):               # round i = at most i flights",
      "    new = dist[:]                     # correct: read last round only",
      "    # new = dist                      # bug: shares one array",
      "    for u, v, w in flights:",
      "        if dist[u] + w < new[v]:",
      "            new[v] = dist[u] + w",
      "    dist = new",
      "return dist[dst] if dist[dst] < inf else -1",
    ],
    inputs: [
      { key: "e", label: "flights u-v price", value: opts.e || "0-1 100, 1-2 100, 2-0 100, 1-3 600, 2-3 200", width: 300 },
      { key: "src", label: "src", value: String(opts.src ?? 0), width: 40 },
      { key: "dst", label: "dst", value: String(opts.dst ?? 3), width: 40 },
      { key: "k", label: "k stops", value: String(opts.k ?? 1), width: 40 },
      { key: "mode", label: "rounds", type: "select", options: ["copy (correct)", "in place (bug)"], value: opts.mode || "copy (correct)" },
    ],
    random: () => { const e = randomGraph({ nMin: 4, nMax: 7, extra: Viz.rand(2, 4), wMax: 9, directed: true }); const n = nOf(parseE(e)); return { e, src: "0", dst: String(n - 1), k: String(Viz.rand(0, 2)), mode: Math.random() < 0.5 ? "copy (correct)" : "in place (bug)" }; },
    build: ({ e, src, dst, k, mode }) => {
      const edges = parseE(e, { directed: true, neg: false, maxW: 999 }), n = nOf(edges);
      src = Viz.parse.int(src, { min: 0, max: n - 1 }); dst = Viz.parse.int(dst, { min: 0, max: n - 1 }); k = Viz.parse.int(k, { min: 0, max: Math.min(5, n) });
      const bug = mode.startsWith("in place");
      const run = (inPlace, cb) => {
        let dist = Array(n).fill(INF), path = Array(n).fill(null);
        dist[src] = 0; path[src] = [];
        for (let r = 1; r <= k + 1; r++) {
          const start = [...dist];
          const nw = inPlace ? dist : [...dist], np = inPlace ? path : [...path];
          if (cb) cb("round", { r, dist, nw });
          edges.forEach(([u, v, w], i) => {
            const du = inPlace ? nw[u] : dist[u];
            if (du === INF) return;
            const leak = inPlace && du !== start[u];
            const ok = du + w < nw[v], old = nw[v];
            if (ok) { nw[v] = du + w; np[v] = [...(inPlace ? np[u] : path[u]), i]; }
            if (cb) cb("edge", { r, i, u, v, w, du, ok, old, leak, start, dist, nw, np });
          });
          dist = nw; path = np;
          if (cb) cb("end", { r, dist, path });
        }
        return { d: dist[dst], p: path[dst] };
      };
      const truth = run(false);
      const fr = [], hist = [];
      const init = Array(n).fill(INF); init[src] = 0; hist.push(init);
      const snap = (x) => fr.push({ n, edges, src, dst, k, bug, hist: hist.map((h) => [...h]), ...x });
      snap({ prev: init, cur: init, line: [0], vars: { round: 0 }, note: `Round i keeps the cheapest price using <b>at most i flights</b>. k stops means k + 1 flights, so we run exactly ${k + 1} round(s). Plain Dijkstra would ignore the flight count and happily return a cheaper route with too many stops.` });
      run(bug, (kind, x) => {
        if (kind === "round") snap({ prev: [...x.dist], cur: [...x.nw], r: x.r, line: bug ? [1, 3] : [1, 2], vars: { round: x.r }, note: bug ? `Round ${x.r}. The bug: "new" is the <b>same</b> array as dist, so an update made early in this round can be read again later in the same round.` : `Round ${x.r}: copy dist into new. Every read uses dist (the state after ${x.r - 1} flight(s)); every write goes to new. So each round adds <b>exactly one</b> flight to any route.` });
        else if (kind === "edge") snap({ prev: [...x.start], cur: [...x.nw], r: x.r, ce: x.i, leak: x.leak, ok: x.ok, cpath: x.ok ? x.np[x.v] : null, line: x.ok ? [5, 6] : [5], vars: { round: x.r, flight: `${x.u}→${x.v} (${x.w})`, [`dist[${x.u}]`]: x.du }, note: `${x.u}→${x.v}: ${x.du} + ${x.w} = ${x.du + x.w}${x.ok ? ` &lt; ${fm(x.old)}, so new[${x.v}] = ${x.du + x.w}` : `, not better than new[${x.v}] = ${fm(x.old)}`}.${x.leak ? ` <b>Bug:</b> dist[${x.u}] = ${x.du} was itself set earlier in round ${x.r}, so this price already uses one flight from this round. The route now has more flights than rounds.` : ""}` });
        else { hist.push([...x.dist]); snap({ prev: [...x.dist], cur: [...x.dist], r: x.r, line: [7], vars: { round: x.r }, note: `End of round ${x.r}: these are the cheapest prices using at most ${x.r} flight(s)${bug ? " (if the rounds were honest)" : ""}.` }); }
      });
      const res = bug ? run(true) : truth;
      const last = hist[hist.length - 1];
      const path = res.p ? res.p : [];
      const stops = path.length ? path.length - 1 : 0;
      snap({ prev: last, cur: last, final: true, pathE: new Set(path), line: [8], vars: { answer: res.d === INF ? -1 : res.d }, note: res.d === INF ? `dst ${dst} cannot be reached within ${k + 1} flight(s): answer −1.` : bug && res.d !== truth.d ? `In-place answer: <b>${res.d}</b> using route with ${path.length} flights (${stops} stops) — more than k = ${k} allows. The correct answer is ${truth.d === INF ? "−1 (no route)" : truth.d}. Always copy the array (or index rounds) when the <i>number</i> of edges is limited.` : `Answer <b>${res.d}</b>: the purple route uses ${path.length} flight(s), ${stops} stop(s) ≤ k = ${k}.${bug ? " The bug happened not to change the answer on this input; the default input shows it does." : ""}` });
      return fr;
    },
    render: (f) => {
      const edgeCls = (i) => (f.final ? (f.pathE.has(i) ? "path" : "dim") : i === f.ce ? (f.leak ? "bad" : f.ok ? "active" : "") : "");
      const changed = (v) => f.prev[v] !== f.cur[v];
      const g = draw(f.n, f.edges, { directed: true, caption: "flights (number under a node = price so far)", sub: (id) => fm(f.cur[id]), edgeCls, nodeCls: (id) => (f.ce !== undefined && f.edges[f.ce][1] === id && f.ok ? "active" : changed(id) ? "visit" : f.cur[id] < INF ? "done" : ""), tag: (id) => (id === f.src ? "src" : id === f.dst ? "dst" : undefined) });
      const hist = Viz.grid(f.hist.map((r) => r.map(fm)), { label: "price with at most i flights", colLabels: Array.from({ length: f.n }, (_, i) => String(i)), corner: "i", rowLabels: f.hist.map((_, i) => String(i)), cls: (r, c) => (c === f.dst ? "path" : f.hist[r][c] === INF ? "dim" : "") });
      const arrs = f.bug ? Viz.array(f.cur.map(fm), { label: "dist = new (one shared array)", cls: (i) => (changed(i) ? "visit" : "") }) : col(Viz.array(f.prev.map(fm), { label: "dist (frozen: last round)" }), Viz.array(f.cur.map(fm), { label: "new (being written)", cls: (i) => (changed(i) ? "visit" : "") }));
      return Viz.row(col(g), col(arrs, hist));
    },
  }));

  /* ---------- Floyd-Warshall: allow one more stop-over node per phase ---------- */
  Viz.register(P("floyd"), (el, opts) => Viz.player(el, {
    title: "Floyd-Warshall: phase k allows node k as a stop-over",
    tag: "ALL PAIRS · O(V³)",
    legend: [["visit", "row k / column k: the only values read in this phase"], ["active", "cell improved right now"], ["done", "improved earlier in this phase"], ["path", "the new route i → … → k → … → j"], ["bad", "negative diagonal: negative cycle"]],
    codeLang: "python",
    code: [
      "d = [[0 if i == j else inf for j in range(n)] for i in range(n)]",
      "for u, v, w in edges: d[u][v] = min(d[u][v], w)",
      "for k in range(n):                  # now allow k as a stop-over",
      "    for i in range(n):",
      "        for j in range(n):",
      "            if d[i][k] + d[k][j] < d[i][j]:",
      "                d[i][j] = d[i][k] + d[k][j]",
      "neg_cycle = any(d[i][i] < 0 for i in range(n))",
    ],
    inputs: [{ key: "e", label: "directed edges u-v w (nodes 0..5)", value: opts.e || "0-1 3, 1-2 4, 0-3 8, 3-4 1, 2-4 -2, 1-4 6, 4-0 2, 4-3 1", width: 400 }],
    random: () => ({ e: randomGraph({ nMin: 4, nMax: 6, extra: Viz.rand(2, 4), wMax: 9, directed: true, negP: 0.12 }) }),
    build: ({ e }) => {
      const edges = parseE(e, { directed: true, maxN: 6, maxE: 14 }), n = nOf(edges);
      const d = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 0 : INF)));
      const nx = Array.from({ length: n }, () => Array(n).fill(-1)), eIdx = new Map();
      edges.forEach(([u, v, w], i) => { if (w < d[u][v]) { d[u][v] = w; nx[u][v] = v; eIdx.set(`${u}>${v}`, i); } });
      const route = (i, j) => { const out = []; let x = i, guard = 0; if (i === j) { x = nx[i][j]; out.push(eIdx.get(`${i}>${x}`)); } while (x !== j && x >= 0 && guard++ < 3 * n) { const y = nx[x][j]; if (y < 0) break; out.push(eIdx.get(`${x}>${y}`)); x = y; } return new Set(out.filter((z) => z !== undefined)); };
      const fr = [];
      let phase = new Set();
      const snap = (x) => fr.push({ n, edges, d: d.map((r) => [...r]), phase: new Set(phase), ...x });
      snap({ line: [0, 1], note: `Start with only direct edges: d[i][j] is the cheapest route from i to j that uses <b>no</b> stop-over node. The plan: add the nodes one at a time as allowed stop-overs. After phase k, d[i][j] is the cheapest route whose intermediate nodes all lie in {0..k}.` });
      for (let k = 0; k < n; k++) {
        phase = new Set();
        snap({ k, line: [2], vars: { k }, note: `Phase k = ${k}. A route that uses ${k} as a stop-over is (best route i → ${k}) + (best route ${k} → j), and both halves only need stop-overs from {0..${k - 1}}${k === 0 ? " (none)" : ""}, which the matrix already holds. Row ${k} and column ${k} are all we read, and they cannot change during this phase (going through ${k} to reach ${k} gains nothing).` });
        let cnt = 0;
        for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
          if (i === k || j === k) continue;
          if (d[i][k] + d[k][j] < d[i][j]) {
            const old = d[i][j];
            d[i][j] = d[i][k] + d[k][j]; nx[i][j] = nx[i][k]; cnt++;
            snap({ k, ci: i, cj: j, route: route(i, j), line: [5, 6], vars: { k, i, j, "d[i][k] + d[k][j]": `${fm(d[i][k])} + ${fm(d[k][j])} = ${d[i][j]}`, was: fm(old) }, note: `d[${i}][${k}] + d[${k}][${j}] = ${fm(d[i][k])} + ${fm(d[k][j])} = ${d[i][j]} &lt; ${fm(old)}. Going ${i} → … → ${k} → … → ${j} is cheaper${old === INF ? " (before, there was no route at all)" : ""}. ${i === j ? `<b>A diagonal entry dropped below 0:</b> a negative cycle through ${i}.` : ""}` });
            phase.add(`${i},${j}`);
          }
        }
        snap({ k, line: [3, 4], vars: { k, "improved this phase": cnt }, note: cnt ? `Phase ${k} improved ${cnt} pair(s). Every one of them is now final for routes with stop-overs in {0..${k}}.` : `No pair gets cheaper by passing through ${k}. That is fine: the phase still had to be checked.` });
      }
      const neg = d.some((r, i) => r[i] < 0);
      phase = new Set();
      snap({ final: true, line: [7], vars: { "negative cycle": neg ? "yes" : "no" }, note: neg ? `Some d[i][i] &lt; 0: a negative cycle exists, and every pair whose route can touch it is meaningless (−∞). Floyd-Warshall detects this for free.` : `All ${n}×${n} shortest distances in ${n}³ = ${n ** 3} checks, with negative edges allowed. Three nested loops, <b>k outermost</b>; that order is the whole algorithm.` });
      return fr;
    },
    render: (f) => {
      const nodeCls = (id) => (id === f.k ? "active" : id === f.ci || id === f.cj ? "visit" : "");
      const g = draw(f.n, f.edges, { directed: true, caption: "directed graph", edgeCls: (i) => (f.route && f.route.has(i) ? "path" : f.final ? "" : f.route ? "dim" : ""), nodeCls, tag: (id) => (id === f.k && !f.final ? "k" : id === f.ci ? "i" : id === f.cj ? "j" : undefined) });
      const idx = Array.from({ length: f.n }, (_, i) => String(i));
      const m = Viz.grid(f.d.map((r) => r.map(fm)), {
        label: f.k !== undefined && !f.final ? `d after phases 0..${f.k}` : "d (shortest i → j)",
        colLabels: idx, rowLabels: idx, corner: "i \\ j",
        cls: (r, c) => (r === c && f.d[r][c] < 0 ? "bad" : r === f.ci && c === f.cj ? "active" : f.phase.has(`${r},${c}`) ? "done" : !f.final && f.k !== undefined && (r === f.k || c === f.k) ? "visit" : f.d[r][c] === INF ? "dim" : ""),
      });
      return Viz.row(g, m);
    },
  }));

  /* ---------- Grid helpers ---------- */
  const D4 = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  function parseRows(text, { maxR = 7, maxC = 10, minR = 2, minC = 2, cell }) {
    const rows = String(text).split(/[\/;\n]+/).map((r) => r.trim()).filter(Boolean).map((r) => (/[\s,]/.test(r) ? r.split(/[\s,]+/) : [...r]).filter(Boolean));
    if (rows.length < minR || rows.length > maxR) throw new Error(`Use ${minR} to ${maxR} rows, separated by "/".`);
    const C = rows[0].length;
    if (rows.some((r) => r.length !== C)) throw new Error("Every row must have the same number of cells.");
    if (C < minC || C > maxC) throw new Error(`Use ${minC} to ${maxC} columns.`);
    return rows.map((r) => r.map(cell));
  }
  const pathCells = (par, R, C, tr, tc) => { const s = new Set(); let x = tr * C + tc; while (x >= 0) { s.add(x); x = par[x]; } return s; };

  /* ---------- 0-1 BFS on a grid: free cells cost 0, obstacles cost 1 ---------- */
  Viz.register(P("zeroone"), (el, opts) => Viz.player(el, {
    title: "0-1 BFS: weight 0 goes to the front of the deque, weight 1 to the back",
    tag: "DEQUE INSTEAD OF HEAP",
    legend: [["active", "cell being expanded"], ["visit", "in the deque"], ["done", "final distance"], ["path", "cheapest route"]],
    codeLang: "python",
    code: [
      "dist = [[inf] * C for _ in range(R)]; dist[0][0] = 0",
      "dq = deque([(0, 0, 0)])                 # (d, r, c)",
      "while dq:",
      "    d, r, c = dq.popleft()",
      "    if d > dist[r][c]: continue          # stale",
      "    for nr, nc in neighbours(r, c):",
      "        w = grid[nr][nc]                   # 1 = obstacle to remove",
      "        if d + w < dist[nr][nc]:",
      "            dist[nr][nc] = d + w",
      "            if w == 0: dq.appendleft((d, nr, nc))      # same layer: front",
      "            else: dq.append((d + 1, nr, nc))           # next layer: back",
      "return dist[R - 1][C - 1]",
    ],
    inputs: [{ key: "g", label: "grid rows (0 free, 1 obstacle), / between rows", value: opts.g || "0 1 0 0 0 0 / 0 1 0 1 1 0 / 0 1 1 1 0 1 / 0 0 0 1 1 0", width: 420 }],
    random: () => { const R = Viz.rand(3, 6), C = Viz.rand(4, 8); return { g: Array.from({ length: R }, (_, r) => Array.from({ length: C }, (_, c) => ((r === 0 && c === 0) || (r === R - 1 && c === C - 1) ? 0 : Math.random() < 0.38 ? 1 : 0)).join(" ")).join(" / ") }; },
    build: ({ g }) => {
      const grid = parseRows(g, { cell: (x) => { if (x !== "0" && x !== "1") throw new Error(`Cells must be 0 or 1, not "${x}".`); return +x; } });
      const R = grid.length, C = grid[0].length, id = (r, c) => r * C + c;
      const dist = Array(R * C).fill(INF), par = Array(R * C).fill(-1), fin = new Set();
      dist[0] = 0;
      let dq = [[0, 0, 0]], pops = 0;
      const fr = [];
      const snap = (x) => fr.push({ R, C, grid, dist: [...dist], fin: new Set(fin), dq: dq.map((q) => [...q]), ...x, vars: { pops, deque: dq.length, ...(x.vars || {}) } });
      snap({ line: [0, 1], note: `Moving into a free cell costs 0, into an obstacle costs 1 (you remove it). With only two weights, the heap is overkill: a <b>deque</b> stays sorted if 0-moves go to the front and 1-moves to the back. It never holds more than two distinct distances, d and d + 1.` });
      while (dq.length) {
        const [d, r, c] = dq.shift();
        pops++;
        if (d > dist[id(r, c)]) { snap({ cur: id(r, c), line: [4], vars: { d, cell: `(${r},${c})` }, note: `(${r},${c}) popped with d = ${d}, but it was reached with ${dist[id(r, c)]} meanwhile (via the front). Stale, skip.` }); continue; }
        fin.add(id(r, c));
        snap({ cur: id(r, c), line: [3], vars: { d, cell: `(${r},${c})` }, note: `Pop the front: (${r},${c}) with d = ${d}. The deque is sorted, so nothing cheaper is waiting: d is final, exactly like a Dijkstra pop, but O(1).` });
        for (const [dr, dc] of D4) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C) continue;
          const w = grid[nr][nc], k = id(nr, nc);
          if (d + w < dist[k]) {
            dist[k] = d + w; par[k] = id(r, c);
            if (w === 0) dq.unshift([d, nr, nc]); else dq.push([d + 1, nr, nc]);
            snap({ cur: id(r, c), cv: k, line: w === 0 ? [7, 8, 9] : [7, 8, 10], vars: { d, cell: `(${r},${c})`, next: `(${nr},${nc})`, w }, note: w === 0 ? `(${nr},${nc}) is free: same distance ${d}. Push it to the <b>front</b>, so it is expanded before anything at ${d + 1}.` : `(${nr},${nc}) is an obstacle: distance ${d + 1}. Push it to the <b>back</b>, behind every cell still at ${d}.` });
          }
        }
      }
      const T = id(R - 1, C - 1), pc = pathCells(par, R, C, R - 1, C - 1);
      snap({ final: true, pc, line: [11], vars: { answer: dist[T] }, note: `Deque empty. The bottom-right corner costs <b>${dist[T]}</b> obstacle removal(s); the purple route is one way to do it. Every cell entered the deque at most twice, so this is O(R·C) instead of O(R·C log(R·C)).` });
      return fr;
    },
    render: (f) => {
      const m = Array.from({ length: f.R }, (_, r) => Array.from({ length: f.C }, (_, c) => fm(f.dist[r * f.C + c]).replace("∞", "")));
      const inQ = new Set(f.dq.map(([, r, c]) => r * f.C + c));
      const cls = (r, c) => { const k = r * f.C + c, ob = f.grid[r][c] ? "sp-ob " : ""; return ob + (f.final ? (f.pc.has(k) ? "path" : f.fin.has(k) ? "done" : "") : k === f.cur ? "active" : k === f.cv ? "visit" : inQ.has(k) ? "visit" : f.fin.has(k) ? "done" : ""); };
      const grid = Viz.grid(m, { label: "dist (hatched = obstacle, costs 1 to enter)", cls, rowLabels: Array.from({ length: f.R }, (_, i) => String(i)), colLabels: Array.from({ length: f.C }, (_, i) => String(i)) });
      const q = f.dq.length ? Viz.queue(f.dq.slice(0, 10).map(([d, r, c]) => `${d}: ${r},${c}`), { label: "deque (d: r,c)", cls: (i) => (i === 0 ? "active" : f.dq[i][0] > f.dq[0][0] ? "sp-later" : "") }) : Viz.labeled("deque", badge("empty"));
      return col(grid, q);
    },
  }));

  /* ---------- State-space Dijkstra on a height grid: three cost rules ---------- */
  const GRID_MODES = { "effort (max |step|)": 8, "swim (max height)": 9, "path sum": 10 };
  Viz.register(P("grid"), (el, opts) => Viz.player(el, {
    title: "Dijkstra on a grid: the path cost can be a max, not only a sum",
    tag: "STATE-SPACE DIJKSTRA",
    legend: [["active", "cell being settled"], ["visit", "tentative (in the heap)"], ["done", "final"], ["path", "best route"]],
    codeLang: "python",
    code: [
      "dist = [[inf] * C for _ in range(R)]",
      "dist[0][0] = start                   # 0 for effort, h[0][0] otherwise",
      "heap = [(dist[0][0], 0, 0)]",
      "while heap:",
      "    d, r, c = heappop(heap)",
      "    if d > dist[r][c]: continue",
      "    if (r, c) == (R - 1, C - 1): return d   # first pop of the target",
      "    for nr, nc in neighbours(r, c):",
      "        nd = max(d, abs(h[nr][nc] - h[r][c]))   # effort",
      "        nd = max(d, h[nr][nc])                  # swim in rising water",
      "        nd = d + h[nr][nc]                      # minimum path sum",
      "        if nd < dist[nr][nc]:",
      "            dist[nr][nc] = nd; heappush(heap, (nd, nr, nc))",
    ],
    inputs: [
      { key: "h", label: "heights, / between rows", value: opts.h || "1 3 2 8 4 / 6 9 3 7 2 / 2 4 5 9 3 / 8 1 6 2 1", width: 300 },
      { key: "mode", label: "cost of a route", type: "select", options: Object.keys(GRID_MODES), value: opts.mode || "effort (max |step|)" },
    ],
    random: () => { const R = Viz.rand(3, 5), C = Viz.rand(3, 6); return { h: Array.from({ length: R }, () => Array.from({ length: C }, () => Viz.rand(0, 9)).join(" ")).join(" / "), mode: Object.keys(GRID_MODES)[Viz.rand(0, 2)] }; },
    build: ({ h, mode }) => {
      const H = parseRows(h, { maxR: 6, maxC: 7, cell: (x) => { if (!/^\d{1,2}$/.test(x)) throw new Error(`Heights are whole numbers 0..99, not "${x}".`); return +x; } });
      const R = H.length, C = H[0].length, id = (r, c) => r * C + c, cl = GRID_MODES[mode];
      const comb = cl === 8 ? (d, r, c, nr, nc) => Math.max(d, Math.abs(H[nr][nc] - H[r][c])) : cl === 9 ? (d, r, c, nr, nc) => Math.max(d, H[nr][nc]) : (d, r, c, nr, nc) => d + H[nr][nc];
      const dist = Array(R * C).fill(INF), par = Array(R * C).fill(-1), fin = new Set();
      dist[0] = cl === 8 ? 0 : H[0][0];
      let heap = [[dist[0], 0, 0]], pops = 0;
      const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
      const fr = [];
      const snap = (x) => fr.push({ R, C, H, mode, dist: [...dist], fin: new Set(fin), heap: heap.map((q) => [...q]).sort(cmp), ...x, vars: { pops, heap: heap.length, ...(x.vars || {}) } });
      const rule = cl === 8 ? "a route costs its <b>largest single step</b> |h difference| (Path With Minimum Effort)" : cl === 9 ? "a route costs the <b>highest cell</b> on it, because you must wait for the water to reach it (Swim in Rising Water)" : "a route costs the <b>sum</b> of the cells on it";
      snap({ line: [0, 1, 2], vars: { start: dist[0] }, note: `The nodes are cells, the edges are the 4 neighbour moves, and ${rule}. Dijkstra still works because extending a route can never make its cost <b>smaller</b> (max and + with non-negative values are both monotone). That is the only property the proof needs.` });
      const T = id(R - 1, C - 1);
      while (heap.length) {
        heap.sort(cmp);
        const [d, r, c] = heap.shift();
        pops++;
        if (d > dist[id(r, c)]) { snap({ cur: id(r, c), line: [5], vars: { d, cell: `(${r},${c})` }, note: `(${r},${c}) popped with ${d}, but its best is already ${dist[id(r, c)]}. Stale, skip.` }); continue; }
        fin.add(id(r, c));
        if (id(r, c) === T) {
          const pc = pathCells(par, R, C, R - 1, C - 1);
          snap({ final: true, pc, cur: T, line: [6], vars: { answer: d }, note: `The target is popped: its value <b>${d}</b> is final, so stop right here. ${R * C - fin.size} cell(s) were never settled; early exit is free with Dijkstra (the purple cells are the route that achieves it).` });
          return fr;
        }
        snap({ cur: id(r, c), line: [4], vars: { d, cell: `(${r},${c})` }, note: `Settle (${r},${c}) at ${d}: the smallest value in the heap, so no other route can beat it.` });
        for (const [dr, dc] of D4) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || fin.has(id(nr, nc))) continue;
          const nd = comb(d, r, c, nr, nc), k = id(nr, nc);
          if (nd < dist[k]) {
            const old = dist[k];
            dist[k] = nd; par[k] = id(r, c); heap.push([nd, nr, nc]);
            const how = cl === 8 ? `max(${d}, |${H[nr][nc]} − ${H[r][c]}|) = ${nd}` : cl === 9 ? `max(${d}, ${H[nr][nc]}) = ${nd}` : `${d} + ${H[nr][nc]} = ${nd}`;
            snap({ cur: id(r, c), cv: k, line: [cl, 11, 12], vars: { d, cell: `(${r},${c})`, next: `(${nr},${nc})`, nd }, note: `To (${nr},${nc}): ${how} &lt; ${fm(old)}. Record it and push.` });
          }
        }
      }
      return fr;
    },
    render: (f) => {
      const inH = new Set(f.heap.map(([, r, c]) => r * f.C + c));
      const st = (k) => (f.final ? (f.pc.has(k) ? "path" : f.fin.has(k) ? "done" : "") : k === f.cur ? "active" : k === f.cv ? "visit" : f.fin.has(k) ? "done" : inH.has(k) ? "visit" : "");
      const lbl = Array.from({ length: Math.max(f.R, f.C) }, (_, i) => String(i));
      const hg = Viz.grid(f.H, { label: "heights h", cls: (r, c) => st(r * f.C + c), rowLabels: lbl.slice(0, f.R), colLabels: lbl.slice(0, f.C) });
      const dg = Viz.grid(Array.from({ length: f.R }, (_, r) => Array.from({ length: f.C }, (_, c) => fm(f.dist[r * f.C + c]).replace("∞", ""))), { label: "dist (best cost so far)", cls: (r, c) => st(r * f.C + c), rowLabels: lbl.slice(0, f.R), colLabels: lbl.slice(0, f.C) });
      const hp = heapView(f.heap, ([d, r, c]) => d > f.dist[r * f.C + c], "heap of (cost, cell)", ([d, r, c]) => `${d}: ${r},${c}`, 7);
      return col(Viz.row(hg, dg), hp);
    },
  }));

  /* ---------- A*: Dijkstra with a sense of direction ---------- */
  const ASTAR_MODES = ["A* (g + h)", "Dijkstra (g)", "greedy best-first (h)"];
  function astarRun(grid, mode, cb) {
    const R = grid.length, C = grid[0].length, id = (r, c) => r * C + c;
    let S = 0, T = 0;
    grid.forEach((row, r) => row.forEach((x, c) => { if (x === "S") S = id(r, c); if (x === "T") T = id(r, c); }));
    const tr = Math.floor(T / C), tc = T % C;
    const h = (k) => Math.abs(Math.floor(k / C) - tr) + Math.abs((k % C) - tc);
    const key = (g, k) => (mode === 0 ? [g + h(k), h(k)] : mode === 1 ? [g, 0] : [h(k), g]);
    const g = Array(R * C).fill(INF), par = Array(R * C).fill(-1), closed = new Set();
    let heap = [[...key(0, S), 0, S]], seq = 1;
    g[S] = 0;
    const cmp = (a, b) => a[0] - b[0] || a[1] - b[1] || a[2] - b[2];
    while (heap.length) {
      heap.sort(cmp);
      const [, , , k] = heap.shift();
      if (closed.has(k)) continue;
      closed.add(k);
      if (k === T) { if (cb) cb("goal", { k, g, par, closed, heap, h }); return { len: g[T], expanded: closed.size, par }; }
      const r = Math.floor(k / C), c = k % C;
      for (const [dr, dc] of D4) {
        const nr = r + dr, nc = c + dc;
        if (nr < 0 || nc < 0 || nr >= R || nc >= C || grid[nr][nc] === "#") continue;
        const q = id(nr, nc);
        if (closed.has(q) || g[k] + 1 >= g[q]) continue;
        g[q] = g[k] + 1; par[q] = k; heap.push([...key(g[q], q), seq++, q]);
      }
      if (cb) cb("expand", { k, g, par, closed, heap, h });
    }
    if (cb) cb("none", { g, par, closed, heap, h });
    return { len: INF, expanded: closed.size, par };
  }
  Viz.register(P("astar"), (el, opts) => Viz.player(el, {
    title: "A*: order the frontier by g + h, where h never overestimates",
    tag: "HEURISTIC SEARCH",
    legend: [["active", "cell being expanded"], ["done", "expanded (closed)"], ["visit", "frontier (open)"], ["path", "route found"]],
    codeLang: "python",
    code: [
      "def h(r, c): return abs(r - tr) + abs(c - tc)   # Manhattan: never overestimates",
      "g = {start: 0}; closed = set()",
      "heap = [(h(*start), start)]                      # key: A* g+h, Dijkstra g, greedy h",
      "while heap:",
      "    _, cell = heappop(heap)",
      "    if cell in closed: continue",
      "    closed.add(cell)",
      "    if cell == target: return g[cell]",
      "    for nxt in neighbours(cell):",
      "        if g[cell] + 1 < g.get(nxt, inf):",
      "            g[nxt] = g[cell] + 1",
      "            heappush(heap, (g[nxt] + h(*nxt), nxt))",
    ],
    inputs: [
      { key: "g", label: "grid (S start, T target, # wall), / between rows", value: opts.g || "...#...... / .#.#...... / .#.#...... / S#.#.....T / .#.#...... / .#.#...... / ..........", width: 420 },
      { key: "mode", label: "frontier order", type: "select", options: ASTAR_MODES, value: opts.mode || ASTAR_MODES[0] },
    ],
    random: () => {
      const R = Viz.rand(5, 7), C = Viz.rand(7, 11), m = Array.from({ length: R }, () => Array.from({ length: C }, () => (Math.random() < 0.22 ? "#" : ".")));
      m[Viz.rand(0, 1)][Viz.rand(0, 1)] = "S"; m[Viz.rand(R - 2, R - 1)][Viz.rand(C - 3, C - 1)] = "T";
      return { g: m.map((r) => r.join("")).join(" / "), mode: ASTAR_MODES[Viz.rand(0, 2)] };
    },
    build: ({ g, mode }) => {
      const grid = parseRows(g, { maxR: 8, maxC: 12, minR: 2, minC: 2, cell: (x) => { if (!/^[.#ST]$/.test(x)) throw new Error(`Use . # S T only, not "${x}".`); return x; } });
      const flat = grid.flat();
      if (flat.filter((x) => x === "S").length !== 1 || flat.filter((x) => x === "T").length !== 1) throw new Error("Put exactly one S and one T in the grid.");
      const mi = ASTAR_MODES.indexOf(mode), R = grid.length, C = grid[0].length;
      const res = [0, 1, 2].map((m) => astarRun(grid, m));
      const fr = [];
      const snap = (x) => fr.push({ R, C, grid, mi, ...x });
      const keyName = ["f = g + h", "g", "h"][mi];
      snap({ g: Array(R * C).fill(INF), closed: new Set(), open: new Set(), line: [0, 1, 2], vars: { expanded: 0 }, note: mi === 0 ? `Every move costs 1. g = steps taken so far, h = Manhattan distance still to go, which can never be <b>more</b> than the true remaining distance (walls only make it longer). Ordering by g + h pulls the search towards T while keeping the answer optimal. Cell numbers show the heap key f.` : mi === 1 ? `Dijkstra orders by g alone (h = 0), so it grows in rings around S and has no idea where T is. With unit weights this is exactly BFS. Cell numbers show g.` : `Greedy best-first orders by h alone: it dives towards T and ignores how far it has come. Fast, but <b>not optimal</b>: the route it finds can be longer. Cell numbers show h.` });
      astarRun(grid, mi, (kind, x) => {
        const open = new Set(x.heap.filter((e) => !x.closed.has(e[3])).map((e) => e[3]));
        const val = (k) => (mi === 0 ? x.g[k] + x.h(k) : mi === 1 ? x.g[k] : x.h(k));
        const vals = Array.from({ length: R * C }, (_, k) => (x.g[k] < INF ? val(k) : null));
        const base = { g: [...x.g], vals, closed: new Set(x.closed), open, vars: { expanded: x.closed.size } };
        if (kind === "expand") snap({ ...base, cur: x.k, line: [4, 6, 8, 9, 10, 11], vars: { ...base.vars, cell: `(${Math.floor(x.k / C)},${x.k % C})`, g: x.g[x.k], h: x.h(x.k) }, note: `Expand (${Math.floor(x.k / C)},${x.k % C}) with g = ${x.g[x.k]}, h = ${x.h(x.k)}: the smallest ${keyName} in the heap. Push its open neighbours with g + 1.` });
        else if (kind === "goal") {
          const pc = pathCells(x.par, R, C, Math.floor(x.k / C), x.k % C);
          snap({ ...base, cur: x.k, final: true, pc, line: [7], vars: { ...base.vars, length: x.g[x.k] }, note: `T reached: route length <b>${x.g[x.k]}</b> after expanding <b>${x.closed.size}</b> cells. Same grid, other orders: A* expands ${res[0].expanded} (length ${res[0].len}), Dijkstra ${res[1].expanded} (length ${res[1].len}), greedy ${res[2].expanded} (length ${res[2].len}${res[2].len > res[1].len ? ", <b>not</b> the shortest" : ""}). A* is Dijkstra on reweighted edges w + h(v) − h(u), which stay ≥ 0 exactly when h is consistent.` });
        } else snap({ ...base, final: true, pc: new Set(), line: [3], note: `The frontier ran dry without reaching T: there is no route.` });
      });
      return fr;
    },
    render: (f) => {
      const m = Array.from({ length: f.R }, (_, r) => Array.from({ length: f.C }, (_, c) => { const x = f.grid[r][c], k = r * f.C + c; if (x === "#") return ""; if (x === "S" || x === "T") return x; return f.vals && f.vals[k] !== null && (f.closed.has(k) || f.open.has(k)) ? f.vals[k] : ""; }));
      const cls = (r, c) => { const k = r * f.C + c; if (f.grid[r][c] === "#") return "wall"; if (f.final && f.pc.has(k)) return "path"; if (k === f.cur) return "active"; if (f.closed.has(k)) return "done"; if (f.open.has(k)) return "visit"; return ""; };
      return Viz.row(Viz.grid(m, { label: `${ASTAR_MODES[f.mi]}: numbers are the heap key`, cls }), Viz.labeled("cells expanded", badge(String(f.closed.size), "active")));
    },
  }));
})();
