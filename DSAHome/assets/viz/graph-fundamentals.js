/* Graph Fundamentals: BFS & DFS visualizers. Every frame is produced by running the real algorithm. */
(() => {
  const S = "graph-fundamentals";
  const P = (name) => `${S}-${name}`;

  /* ---------- shared helpers ---------- */
  const natural = (a, b) => {
    const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const ek = (u, v) => `${u}-${v}`;

  /* Parse "0-1,1-2,5" (or "a>b" for directed). A lone label adds an isolated node. */
  function parseGraph(text, directed, { maxN = 12, maxE = 24 } = {}) {
    const toks = String(text).split(/[,;\s]+/).filter(Boolean);
    if (!toks.length) throw new Error("Enter edges like 0-1,1-2 (a lone label such as 5 adds an isolated node).");
    const ids = [], seen = new Set(), edges = [], keys = new Set();
    const add = (x) => {
      if (!/^[A-Za-z0-9]{1,3}$/.test(x)) throw new Error(`"${x}" is not a valid node label: use 1-3 letters or digits.`);
      if (!seen.has(x)) { seen.add(x); ids.push(x); }
    };
    for (const t of toks) {
      const m = t.match(/^([A-Za-z0-9]+)(?:(->|-|>)([A-Za-z0-9]+))?$/);
      if (!m) throw new Error(`Cannot read "${t}". Write edges as u-v (or u>v) separated by commas.`);
      add(m[1]);
      if (m[3] === undefined) continue;
      add(m[3]);
      if (m[1] === m[3]) throw new Error(`Self-loop "${t}" is not allowed in this visualizer.`);
      const k = directed ? ek(m[1], m[3]) : [m[1], m[3]].sort(natural).join("-");
      if (keys.has(k)) throw new Error(`Edge "${t}" appears twice.`);
      keys.add(k);
      edges.push([m[1], m[3]]);
    }
    if (ids.length > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${ids.length}).`);
    if (edges.length > maxE) throw new Error(`Use at most ${maxE} edges (you have ${edges.length}).`);
    ids.sort(natural);
    const adj = Object.fromEntries(ids.map((i) => [i, []]));
    for (const [u, v] of edges) { adj[u].push(v); if (!directed) adj[v].push(u); }
    for (const k in adj) adj[k].sort(natural);
    return { ids, edges, adj, directed };
  }

  const circle = (ids) => Viz.layout.circle(ids, ids.length <= 1 ? 0 : Math.max(78, ids.length * 19));

  function drawGraph(G, pos, o = {}) {
    return Viz.graph({
      nodes: pos.map((p) => ({ ...p, label: p.id, sub: o.sub ? o.sub(p.id) : undefined, top: o.top ? o.top(p.id) : undefined })),
      edges: G.edges.map(([u, v]) => ({ u, v })),
    }, { directed: G.directed, nodeCls: o.nodeCls, edgeCls: o.edgeCls, label: o.label, r: o.r });
  }

  function randomEdges(n, extra, { directed = false, connected = true } = {}) {
    const set = new Set(), out = [];
    const addE = (u, v) => {
      if (u === v) return false;
      const k = [u, v].sort((a, b) => a - b).join("-");
      if (set.has(k)) return false;
      set.add(k); out.push(`${u}${directed ? ">" : "-"}${v}`); return true;
    };
    if (connected) for (let i = 1; i < n; i++) addE(Viz.rand(0, i - 1), i);
    let tries = 0;
    while (extra > 0 && tries++ < 300) if (addE(Viz.rand(0, n - 1), Viz.rand(0, n - 1))) extra--;
    for (let i = 0; i < n; i++) if (!out.some((e) => e.split(/[->]/).includes(String(i)))) out.push(String(i));
    return out.join(",");
  }

  /* Pad ragged rows for Viz.grid; blank cells get the gf-blank class. */
  const pad = (rows, minCols = 1) => {
    const w = Math.max(minCols, ...rows.map((r) => r.length));
    return rows.map((r) => Array.from({ length: w }, (_, i) => (i < r.length ? r[i] : null)));
  };

  /* Grid parsing for flood-fill style visualizers. */
  function parseCells(text, allowed, { maxR = 8, maxC = 10 } = {}) {
    const rows = String(text).split(/;|\n/).map((r) => r.replace(/[\s,]/g, "")).filter(Boolean);
    if (!rows.length) throw new Error("Enter rows separated by semicolons, e.g. 110;011.");
    if (rows.length > maxR) throw new Error(`Use at most ${maxR} rows.`);
    const C = rows[0].length;
    if (rows.some((r) => r.length !== C)) throw new Error("Every row must have the same number of cells.");
    if (C > maxC) throw new Error(`Use at most ${maxC} columns.`);
    for (const r of rows) for (const ch of r) if (!allowed.includes(ch)) throw new Error(`Unexpected cell "${ch}". Allowed: ${allowed.split("").join(" ")}.`);
    return rows.map((r) => r.split(""));
  }
  const DIR4 = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  const DIR8 = [[-1, 0], [-1, 1], [0, 1], [1, 1], [1, 0], [1, -1], [0, -1], [-1, -1]];
  const rc = (r, c) => `(${r},${c})`;

  /* ---------- 1. Representations, built edge by edge ---------- */
  Viz.register(P("repr"), (el, opts) => Viz.player(el, {
    title: "One graph, three representations, built edge by edge",
    tag: "EDIT THE EDGE LIST",
    legend: [["active", "edge being stored"], ["done", "already stored"]],
    codeLang: "python",
    code: [
      "adj = {u: [] for u in nodes}  # list",
      "M = [[0] * n for _ in range(n)]  # matrix",
      "for u, v in edges:  # the edge list itself",
      "    adj[u].append(v)",
      "    M[u][v] = 1",
      "    if not directed:",
      "        adj[v].append(u)",
      "        M[v][u] = 1",
    ],
    inputs: [
      { key: "edges", label: "edges (u-v, comma separated)", value: opts.edges || "0-1,0-2,1-2,2-3,3-4", width: 250 },
      { key: "dir", label: "type", type: "select", options: ["undirected", "directed"], value: opts.dir || "undirected" },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(4, 7), Viz.rand(1, 3)) }),
    build: ({ edges, dir }) => {
      const G = parseGraph(edges, dir === "directed", { maxN: 8, maxE: 12 });
      const n = G.ids.length, idx = Object.fromEntries(G.ids.map((x, i) => [x, i]));
      const adj = Object.fromEntries(G.ids.map((x) => [x, []]));
      const M = G.ids.map(() => G.ids.map(() => 0));
      const pos = circle(G.ids), fr = [];
      const snap = (x) => ({ G, pos, adj: Viz.clone(adj), M: Viz.clone(M), ...x });
      fr.push(snap({ cur: -1, line: [0, 1], vars: { n, E: G.edges.length }, note: `The <b>edge list</b> (left table) is the raw input: ${G.edges.length} pairs. We turn it into an adjacency list (one bucket per node) and an ${n}×${n} matrix.` }));
      G.edges.forEach(([u, v], k) => {
        adj[u].push(v); M[idx[u]][idx[v]] = 1;
        fr.push(snap({ cur: k, added: [[u, adj[u].length - 1]], cells: [[idx[u], idx[v]]], line: [2, 3, 4], vars: { u, v, "adj[u]": adj[u].join(" ") }, note: `Edge ${u}${G.directed ? "→" : "–"}${v}: append ${v} to ${u}'s bucket (O(1)) and set M[${u}][${v}] = 1 (O(1)).${G.directed ? " Directed: only one direction is stored." : ""}` }));
        if (!G.directed) {
          adj[v].push(u); M[idx[v]][idx[u]] = 1;
          fr.push(snap({ cur: k, added: [[v, adj[v].length - 1]], cells: [[idx[v], idx[u]]], line: [5, 6, 7], vars: { u, v, "adj[v]": adj[v].join(" ") }, note: `Undirected, so the edge is also stored the other way: ${u} goes into ${v}'s bucket and M[${v}][${u}] = 1. The matrix stays symmetric.` }));
        }
      });
      const entries = Object.values(adj).reduce((s, a) => s + a.length, 0);
      fr.push(snap({ cur: -1, fin: true, line: [], vars: { "list entries": entries, "matrix cells": n * n }, note: `Done. The list stores <b>${entries}</b> neighbour entries (${G.directed ? "E" : "2E"}) plus ${n} heads: O(V + E). The matrix always stores <b>${n * n}</b> cells: O(V²), but answers “is ${G.ids[0]} adjacent to ${G.ids[n - 1]}?” in O(1).` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const cur = f.cur >= 0 ? G.edges[f.cur] : null;
      const graph = drawGraph(G, f.pos, {
        label: "drawing",
        nodeCls: (id) => (cur && cur.includes(id) ? "active" : ""),
        edgeCls: (k) => {
          const i = G.edges.findIndex(([u, v]) => ek(u, v) === k);
          return i < 0 ? "" : i === f.cur ? "active" : f.fin || i < f.cur ? "done" : "";
        },
      });
      const list = Viz.grid(G.edges.map(([u, v]) => [u, v]), {
        label: "edge list", colLabels: ["u", "v"], rowLabels: G.edges.map((_, i) => `e${i}`),
        cls: (r) => (r === f.cur ? "active" : ""),
      });
      const rows = pad(G.ids.map((x) => f.adj[x]));
      const isNew = (r, c) => (f.added || []).some(([x, k]) => x === G.ids[r] && k === c);
      const adjGrid = Viz.grid(rows, {
        label: "adjacency list", rowLabels: G.ids.map((x) => `${x} →`),
        cls: (r, c, v) => (v === null ? "gf-blank" : isNew(r, c) ? "active" : "done"),
      });
      const mat = Viz.grid(f.M, {
        label: "adjacency matrix", rowLabels: G.ids, colLabels: G.ids, corner: "u\\v",
        cls: (r, c, v) => ((f.cells || []).some(([a, b]) => a === r && b === c) ? "active" : v ? "done" : "gf-zero"),
      });
      return Viz.row(graph, list, adjGrid, mat);
    },
  }));

  /* ---------- 2. BFS with layers, distances and the queue ---------- */
  Viz.register(P("bfs"), (el, opts) => Viz.player(el, {
    title: "Breadth-first search: layers, distances and the FIFO queue",
    tag: "EDIT THE GRAPH",
    legend: [["active", "popped (u)"], ["visit", "in the queue"], ["done", "finished / BFS-tree edge"], ["path", "shortest path to target"], ["dim", "unreachable"]],
    codeLang: "python",
    code: [
      "dist = {src: 0}; parent = {src: None}",
      "q = deque([src])",
      "while q:",
      "    u = q.popleft()",
      "    for v in adj[u]:",
      "        if v in dist: continue  # seen it",
      "        dist[v] = dist[u] + 1",
      "        parent[v] = u",
      "        q.append(v)  # marked on ENQUEUE",
    ],
    inputs: [
      { key: "edges", label: "edges", value: opts.edges || "0-1,0-2,1-3,2-3,2-4,3-5,4-5,4-6,5-7,6-7,8-9", width: 300 },
      { key: "src", label: "source", value: "0", width: 60 },
      { key: "t", label: "target (optional)", value: "7", width: 60 },
      { key: "dir", label: "type", type: "select", options: ["undirected", "directed"], value: "undirected" },
    ],
    random: () => { const n = Viz.rand(6, 10); return { edges: randomEdges(n, Viz.rand(2, 4)), src: "0", t: String(n - 1) }; },
    build: ({ edges, src, t, dir }) => {
      const G = parseGraph(edges, dir === "directed", { maxN: 12, maxE: 22 });
      const s = String(src).trim(), tg = String(t).trim();
      if (!(s in G.adj)) throw new Error(`Source "${s}" is not a node of the graph.`);
      if (tg && !(tg in G.adj)) throw new Error(`Target "${tg}" is not a node of the graph.`);
      const pos = circle(G.ids), dist = { [s]: 0 }, parent = { [s]: null }, q = [s], done = new Set(), tree = {}, fr = [];
      const snap = (x) => ({ G, pos, dist: { ...dist }, q: [...q], done: new Set(done), tree: { ...tree }, ...x });
      fr.push(snap({ line: [0, 1], vars: { q: s }, note: `Seed the queue with <b>${s}</b> at distance 0. We record dist the moment a node is discovered, so dist doubles as the “visited” set.` }));
      while (q.length) {
        const u = q.shift();
        fr.push(snap({ u, line: [2, 3], vars: { u, "dist[u]": dist[u], q: q.join(" ") || "—" }, note: `Pop <b>${u}</b> (distance ${dist[u]}). The queue is FIFO, so every node at distance ${dist[u]} leaves before any node at ${dist[u] + 1}: BFS finishes a whole layer before starting the next.` }));
        for (const v of G.adj[u]) {
          if (v in dist) {
            const why = parent[u] === v ? `that is the edge we arrived on` : `it was discovered earlier`;
            fr.push(snap({ u, v, cur: ek(u, v), line: [4, 5], vars: { u, v, "dist[v]": dist[v] }, note: `${v} already has dist ${dist[v]} (${why}). Any route found now is at least as long, so skip it.` }));
            continue;
          }
          dist[v] = dist[u] + 1; parent[v] = u; q.push(v);
          tree[ek(u, v)] = 1; if (!G.directed) tree[ek(v, u)] = 1;
          fr.push(snap({ u, v, cur: ek(u, v), line: [6, 7, 8], vars: { u, v, "dist[v]": dist[v], q: q.join(" ") }, note: `Discover <b>${v}</b> through ${u}: dist[${v}] = ${dist[u]} + 1 = <b>${dist[v]}</b>, parent[${v}] = ${u}. It is marked now, on enqueue, so no other node can add it to the queue a second time.` }));
        }
        done.add(u);
      }
      const unreached = G.ids.filter((x) => !(x in dist));
      const path = new Set(), pathE = {};
      let msg = `Queue empty after visiting ${Object.keys(dist).length} node(s).`;
      if (tg) {
        if (tg in dist) {
          let x = tg; const seq = [];
          while (x !== null) { seq.push(x); path.add(x); const p = parent[x]; if (p !== null) { pathE[ek(p, x)] = 1; if (!G.directed) pathE[ek(x, p)] = 1; } x = p; }
          msg += ` Follow parent pointers back from ${tg}: <b>${seq.reverse().join(" → ")}</b>, ${dist[tg]} edge(s), the fewest possible.`;
        } else msg += ` Target ${tg} was never discovered: no path exists.`;
      }
      if (unreached.length) msg += ` Unreachable from ${s}: ${unreached.join(", ")} (another component).`;
      fr.push(snap({ line: [2], final: true, path, pathE, vars: { reached: Object.keys(dist).length, unreached: unreached.length }, note: msg }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        sub: (id) => (id in f.dist ? `d=${f.dist[id]}` : "∞"),
        nodeCls: (id) => (f.final && f.path.has(id) ? "path" : id === f.u ? "active" : f.done.has(id) ? "done" : f.q.includes(id) ? "visit" : f.final ? "dim" : ""),
        edgeCls: (k) => (f.final && f.pathE[k] ? "path" : k === f.cur ? "active" : f.tree[k] ? "done" : ""),
      });
      const maxD = Math.max(0, ...Object.values(f.dist));
      const layers = Array.from({ length: maxD + 1 }, (_, d) => G.ids.filter((x) => f.dist[x] === d));
      const lay = Viz.grid(pad(layers), {
        label: "layers (BFS rings)", rowLabels: layers.map((_, d) => `d=${d}`),
        cls: (r, c, v) => (v === null ? "gf-blank" : v === f.u ? "active" : f.q.includes(v) ? "visit" : "done"),
      });
      const q = Viz.queue(f.q, { fmt: (v) => `${v}·d${f.dist[v]}`, cls: (i, v) => (v === f.v ? "active" : "visit") });
      return Viz.row(graph, `<div class="gf-col">${q}${lay}</div>`);
    },
  }));

  /* ---------- 3. DFS: call stack, colours, discovery/finish times, edge types ---------- */
  const ETYPE_CLS = { tree: "path", back: "bad", forward: "done", cross: "visit" };
  Viz.register(P("dfs"), (el, opts) => Viz.player(el, {
    title: "Depth-first search: WHITE → GREY → BLACK, discovery/finish times, edge types",
    tag: "EDIT THE GRAPH",
    legend: [["active", "current u / edge"], ["visit", "GREY: on the call stack"], ["done", "BLACK: finished"], ["path", "tree edge"], ["bad", "back edge = cycle"]],
    codeLang: "python",
    code: [
      "def dfs(u):",
      "    color[u] = GREY; d[u] = time; time += 1",
      "    for v in adj[u]:",
      "        if color[v] == WHITE:",
      "            parent[v] = u; dfs(v)  # tree",
      "        elif color[v] == GREY:  # on stack",
      "            back edge u→v  =>  cycle",
      "        else:  # v is BLACK",
      "            forward (d[u]<d[v]) or cross",
      "    color[u] = BLACK; f[u] = time; time += 1",
      "for s in nodes:",
      "    if color[s] == WHITE: dfs(s)  # new tree",
    ],
    inputs: [
      { key: "edges", label: "edges", value: opts.edges || "0>1,1>2,2>3,3>1,0>2,4>3,4>5,5>6", width: 280 },
      { key: "dir", label: "type", type: "select", options: ["directed", "undirected"], value: opts.dir || "directed" },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(5, 8), Viz.rand(1, 4), { directed: true, connected: Math.random() < 0.5 }) }),
    build: ({ edges, dir }) => {
      const G = parseGraph(edges, dir === "directed", { maxN: 10, maxE: 16 });
      const pos = circle(G.ids), color = {}, d = {}, fin = {}, parent = {}, etype = {}, stack = [], fr = [];
      const elist = [];
      G.ids.forEach((x) => (color[x] = "W"));
      let time = 1;
      const snap = (x) => ({ G, pos, color: { ...color }, d: { ...d }, fin: { ...fin }, etype: { ...etype }, elist: [...elist], stack: [...stack], ...x });
      const arrow = G.directed ? "→" : "–";
      fr.push(snap({ line: [10], vars: { time }, note: "Every node starts <b>WHITE</b> (undiscovered). A global clock stamps each node twice: when we enter it (d) and when we leave it (f)." }));
      const dfs = (u) => {
        color[u] = "G"; d[u] = time++; stack.push(u);
        fr.push(snap({ u, line: [0, 1], vars: { u, "d[u]": d[u], time }, note: `Enter dfs(${u}): colour it <b>GREY</b> and stamp d[${u}] = ${d[u]}. GREY means “still on the call stack”: we have not finished ${u}.` }));
        for (const v of G.adj[u]) {
          const k = ek(u, v);
          if (!G.directed && v === parent[u]) {
            fr.push(snap({ u, cur: k, line: [2], vars: { u, v }, note: `${v} is ${u}'s parent: this is the tree edge we came in on, seen from the other end. Not a new edge, so skip it.` }));
            continue;
          }
          if (color[v] === "W") {
            etype[k] = "tree"; elist.push([`${u}${arrow}${v}`, "tree"]); parent[v] = u;
            fr.push(snap({ u, cur: k, line: [2, 3, 4], vars: { u, v, "color[v]": "WHITE" }, note: `${v} is WHITE: ${u}${arrow}${v} becomes a <b>tree edge</b> and we dive into ${v} immediately, before looking at ${u}'s other neighbours. That is the “depth-first” part.` }));
            dfs(v);
            fr.push(snap({ u, line: [2], vars: { u, time }, note: `Back in dfs(${u}): ${v} is finished, so continue with ${u}'s next neighbour.` }));
          } else if (color[v] === "G") {
            etype[k] = "back"; elist.push([`${u}${arrow}${v}`, "back"]);
            fr.push(snap({ u, cur: k, line: [5, 6], vars: { u, v, "color[v]": "GREY" }, note: `${v} is <b>GREY</b>: it is an ancestor of ${u} on the current stack (${stack.join(" → ")}). The path ${v} ⇝ ${u} plus this edge closes a loop: a <b>back edge proves a cycle</b>.` }));
          } else if (G.directed) {
            const t = d[u] < d[v] ? "forward" : "cross";
            etype[k] = t; elist.push([`${u}${arrow}${v}`, t]);
            fr.push(snap({ u, cur: k, line: [7, 8], vars: { u, v, "d[u]": d[u], "d[v]": d[v] }, note: t === "forward" ? `${v} is BLACK and d[${u}]=${d[u]} &lt; d[${v}]=${d[v]}: ${v} is a finished descendant of ${u}. A <b>forward edge</b>, a shortcut down the tree. No cycle.` : `${v} is BLACK and was discovered before ${u} (d=${d[v]} &lt; ${d[u]}) in a different branch: a <b>cross edge</b>. ${v} cannot reach ${u}, or ${u} would already be finished. No cycle.` }));
          } else {
            fr.push(snap({ u, cur: k, line: [7], vars: { u, v }, note: `${v} is BLACK: in an undirected graph this edge was already classified from ${v}'s side (as a back edge). Undirected DFS only ever has tree and back edges.` }));
          }
        }
        color[u] = "B"; fin[u] = time++; stack.pop();
        fr.push(snap({ u, line: [9], vars: { u, "f[u]": fin[u], time }, note: `All of ${u}'s neighbours are handled: colour it <b>BLACK</b>, stamp f[${u}] = ${fin[u]} and return. Everything reachable from ${u} finished before ${u} did.` }));
      };
      for (const s of G.ids) if (color[s] === "W") {
        fr.push(snap({ line: [10, 11], vars: { s }, note: `${s} is still WHITE, so start a new DFS tree from it.` }));
        dfs(s);
      }
      const back = elist.filter((e) => e[1] === "back").length;
      fr.push(snap({ line: [], vars: { "back edges": back }, note: `Done. Each node and edge was handled once: O(V + E). The [d, f] intervals nest like parentheses (a descendant's interval sits inside its ancestor's). ${back ? `${back} back edge(s), so the graph <b>has a cycle</b>.` : "No back edges, so the graph is <b>acyclic</b>."}` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        top: (id) => (id in f.d ? `${f.d[id]}/${f.fin[id] ?? "·"}` : undefined),
        nodeCls: (id) => (id === f.u ? "active" : f.color[id] === "G" ? "visit" : f.color[id] === "B" ? "done" : ""),
        edgeCls: (k) => (k === f.cur ? "active" : ETYPE_CLS[f.etype[k]] || ""),
      });
      const st = Viz.stack(f.stack.map((x) => `dfs(${x})`), { label: "call stack", cls: (i) => (i === f.stack.length - 1 ? "active" : "visit") });
      const col = Viz.array(G.ids.map((x) => f.color[x]), { label: "colour", idxLabel: (i) => G.ids[i], cls: (i) => (f.color[G.ids[i]] === "G" ? "visit" : f.color[G.ids[i]] === "B" ? "done" : "") });
      const et = f.elist.length ? Viz.grid(f.elist, { label: "edge types", cls: (r) => ETYPE_CLS[f.elist[r][1]] }) : "";
      return Viz.row(graph, st, `<div class="gf-col">${col}${et}</div>`);
    },
  }));

  /* ---------- 4. Grid flood fill: number of islands ---------- */
  const islandName = (k) => (k <= 26 ? String.fromCharCode(64 + k) : String(k));
  Viz.register(P("islands"), (el, opts) => Viz.player(el, {
    title: "Number of islands: a grid is a graph whose edges are implied",
    tag: "EDIT THE GRID",
    legend: [["active", "cell being expanded"], ["visit", "in the frontier"], ["done", "claimed by an island"]],
    codeLang: "python",
    code: [
      "for r in range(R):",
      "  for c in range(C):",
      "    if grid[r][c] and (r, c) not in seen:",
      "      islands += 1; seen.add((r, c))",
      "      q = deque([(r, c)])",
      "      while q:",
      "        cr, cc = q.popleft()  # DFS: q.pop()",
      "        for nr, nc in land_nbrs(cr, cc):",
      "          if (nr, nc) not in seen:",
      "            seen.add((nr, nc))",
      "            q.append((nr, nc))",
    ],
    inputs: [
      { key: "grid", label: "grid (rows of 0/1, separated by ;)", value: opts.grid || "11001;10011;00100;10110", width: 230 },
      { key: "mode", label: "frontier", type: "select", options: ["BFS (queue)", "DFS (stack)"], value: "BFS (queue)" },
      { key: "conn", label: "neighbours", type: "select", options: ["4-way", "8-way"], value: "4-way" },
    ],
    random: () => {
      const R = Viz.rand(4, 6), C = Viz.rand(5, 8);
      return { grid: Array.from({ length: R }, () => Array.from({ length: C }, () => (Math.random() < 0.45 ? 1 : 0)).join("")).join(";") };
    },
    build: ({ grid, mode, conn }) => {
      const g = parseCells(grid, "01", { maxR: 7, maxC: 9 });
      const R = g.length, C = g[0].length, dirs = conn === "8-way" ? DIR8 : DIR4, bfs = mode.startsWith("BFS");
      const id = g.map((r) => r.map(() => 0)), fr = [];
      let islands = 0, best = 0, frontier = [];
      const snap = (x) => ({ g, bfs, id: Viz.clone(id), frontier: frontier.map((p) => [...p]), ...x });
      fr.push(snap({ line: [0, 1], vars: { islands, best }, note: `Every land cell is a node; it has an edge to each ${conn === "8-way" ? "of its 8 surrounding" : "of its 4 up/right/down/left"} land neighbours. Nobody builds those edges: we compute them on the fly. Scan the grid; each unclaimed land cell starts a new island.` }));
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (g[r][c] !== "1" || id[r][c]) continue;
        islands++; id[r][c] = islands; frontier = [[r, c]];
        let area = 0;
        fr.push(snap({ cur: [r, c], line: [2, 3, 4], vars: { r, c, islands }, note: `The scan reaches unclaimed land ${rc(r, c)}: island <b>${islandName(islands)}</b>. Every cell the flood touches from here belongs to the same island.` }));
        while (frontier.length) {
          const [cr, cc] = bfs ? frontier.shift() : frontier.pop();
          area++;
          const added = [];
          for (const [dr, dc] of dirs) {
            const nr = cr + dr, nc = cc + dc;
            if (nr < 0 || nc < 0 || nr >= R || nc >= C || g[nr][nc] !== "1" || id[nr][nc]) continue;
            id[nr][nc] = islands; frontier.push([nr, nc]); added.push(rc(nr, nc));
          }
          fr.push(snap({ cur: [cr, cc], line: [5, 6, 7, 8, 9, 10], vars: { cell: rc(cr, cc), island: islandName(islands), area, frontier: frontier.length }, note: `${bfs ? "popleft" : "pop"} ${rc(cr, cc)}. ${added.length ? `Claim its unclaimed land neighbour(s) ${added.join(", ")} immediately so no one adds them twice.` : "No unclaimed land around it: a dead end."} ${bfs ? "The queue grows outward in rings." : "The stack dives along one direction first."}` }));
        }
        best = Math.max(best, area);
        fr.push(snap({ line: [5], vars: { islands, area, best }, note: `Frontier empty: island ${islandName(islands)} is complete with area <b>${area}</b>. Resume the scan; claimed cells are skipped, which is why the whole thing is O(R·C).` }));
      }
      frontier = [];
      fr.push(snap({ line: [], vars: { islands, "max area": best }, note: `Scan finished: <b>${islands}</b> island(s), the largest has area ${best}. BFS and DFS give the same islands; only the visiting order differs.${conn === "4-way" ? " Switch to 8-way to see diagonal touches merge islands." : ""}` }));
      return fr;
    },
    render: (f) => {
      const inF = new Set(f.frontier.map(([r, c]) => `${r},${c}`));
      const grid = Viz.grid(f.g, {
        rowLabels: f.g.map((_, i) => i), colLabels: f.g[0].map((_, j) => j),
        fmt: (v, r, c) => (v === "0" ? "" : f.id[r][c] ? islandName(f.id[r][c]) : "1"),
        cls: (r, c, v) => (v === "0" ? "gf-water" : f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : inF.has(`${r},${c}`) ? "visit" : f.id[r][c] ? "done" : ""),
      });
      const items = f.frontier.map(([r, c]) => rc(r, c));
      const fr = f.bfs ? Viz.queue(items, { label: "frontier queue", cls: () => "visit" }) : Viz.stack(items, { label: "frontier stack", cls: () => "visit" });
      return Viz.row(grid, fr);
    },
  }));

  /* ---------- 5. Multi-source BFS: rotting oranges / walls and gates ---------- */
  Viz.register(P("multisource"), (el, opts) => Viz.player(el, {
    title: "Multi-source BFS: every source starts in the queue at distance 0",
    tag: "EDIT THE GRID",
    legend: [["path", "source"], ["active", "popped"], ["visit", "in the queue"], ["done", "reached (distance shown)"], ["bad", "never reached"]],
    codeLang: "python",
    code: [
      "q = deque(); dist = {}",
      "for s in sources:  # rotten oranges / gates",
      "    dist[s] = 0; q.append(s)  # ALL of them",
      "while q:",
      "    r, c = q.popleft()",
      "    for nr, nc in open_nbrs(r, c):",
      "        if (nr, nc) not in dist:",
      "            dist[nr, nc] = dist[r, c] + 1",
      "            q.append((nr, nc))",
      "ans = max(dist.values())  # -1 if fresh left",
    ],
    inputs: [
      { key: "grid", label: "grid (S source, . open, # blocked; rows split by ;)", value: opts.grid || "S..#.;.#...;..#.S;#....;..#..", width: 290 },
      { key: "story", label: "story", type: "select", options: ["rotting oranges", "walls and gates"], value: opts.story || "rotting oranges" },
    ],
    random: () => {
      const R = Viz.rand(4, 6), C = Viz.rand(5, 7);
      const g = Array.from({ length: R }, () => Array.from({ length: C }, () => (Math.random() < 0.18 ? "#" : ".")));
      for (let k = Viz.rand(1, 3); k > 0; k--) g[Viz.rand(0, R - 1)][Viz.rand(0, C - 1)] = "S";
      return { grid: g.map((r) => r.join("")).join(";") };
    },
    build: ({ grid, story }) => {
      const g = parseCells(grid, "S.#", { maxR: 7, maxC: 9 });
      const R = g.length, C = g[0].length, oranges = story === "rotting oranges";
      const dist = g.map((r) => r.map(() => null)), q = [], fr = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] === "S") { dist[r][c] = 0; q.push([r, c]); }
      const snap = (x) => ({ g, oranges, dist: Viz.clone(dist), q: q.map((p) => [...p]), ...x });
      const open = g.flat().filter((x) => x === ".").length;
      fr.push(snap({ line: [0, 1, 2], vars: { sources: q.length, open }, note: q.length ? `Put <b>all ${q.length} source(s)</b> in the queue at distance 0 before the loop starts. It is exactly as if one virtual super-source sat one step before them: BFS from it gives every cell the distance to its <i>nearest</i> source.` : "No source cell (S) at all: nothing can spread." }));
      let layer = 0;
      while (q.length) {
        const [r, c] = q.shift();
        if (dist[r][c] > layer) {
          layer = dist[r][c];
          fr.push(snap({ cur: [r, c], line: [3], vars: { layer, q: q.length + 1 }, note: oranges ? `Minute <b>${layer}</b> is complete: every orange now rotten got infected at the same tick. The queue holds exactly the next wave.` : `Layer ${layer} begins: every room in the queue is ${layer} step(s) from its nearest gate.` }));
        }
        const added = [];
        for (const [dr, dc] of DIR4) {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || g[nr][nc] !== "." || dist[nr][nc] !== null) continue;
          dist[nr][nc] = dist[r][c] + 1; q.push([nr, nc]); added.push(rc(nr, nc));
        }
        fr.push(snap({ cur: [r, c], line: [4, 5, 6, 7, 8], vars: { cell: rc(r, c), "dist": dist[r][c], queue: q.length }, note: `Pop ${rc(r, c)} at distance ${dist[r][c]}. ${added.length ? `${oranges ? "It rots" : "It reaches"} ${added.join(", ")} at distance ${dist[r][c] + 1}.` : "No new open neighbours."} Whichever source gets to a cell first claims it; the FIFO order guarantees that source is the nearest.` }));
      }
      const left = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (g[r][c] === "." && dist[r][c] === null) left.push(rc(r, c));
      const maxD = Math.max(0, ...dist.flat().filter((x) => x !== null));
      const ans = oranges ? (left.length ? -1 : maxD) : null;
      fr.push(snap({ final: true, line: [9], vars: oranges ? { answer: ans, "fresh left": left.length } : { "rooms filled": open - left.length, unreachable: left.length }, note: oranges ? (left.length ? `Queue empty but ${left.join(", ")} never rotted (walled off), so the answer is <b>-1</b>.` : `Every orange is rotten after <b>${maxD}</b> minute(s): the largest distance in the grid.`) : `Each room now holds the distance to its nearest gate.${left.length ? ` ${left.join(", ")} cannot reach any gate and stay ∞ (INF).` : ""} One BFS for all gates: O(R·C), instead of one BFS per gate.` }));
      return fr;
    },
    render: (f) => {
      const inQ = new Set(f.q.map(([r, c]) => `${r},${c}`));
      const grid = Viz.grid(f.g, {
        rowLabels: f.g.map((_, i) => i), colLabels: f.g[0].map((_, j) => j),
        fmt: (v, r, c) => (v === "#" ? "" : v === "S" ? (f.oranges ? "R" : "G") : f.dist[r][c] !== null ? f.dist[r][c] : f.oranges ? "F" : "∞"),
        cls: (r, c, v) => (v === "#" ? "wall" : f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : inQ.has(`${r},${c}`) ? "visit" : v === "S" ? "path" : f.dist[r][c] !== null ? "done" : f.final ? "bad" : ""),
      });
      const q = Viz.queue(f.q.map(([r, c]) => `${rc(r, c)}·${f.dist[r][c]}`), { cls: () => "visit" });
      return Viz.row(grid, q);
    },
  }));

  /* ---------- 6. Connected components ---------- */
  const COMP_CLS = ["done", "path"];
  Viz.register(P("components"), (el, opts) => Viz.player(el, {
    title: "Connected components: one BFS per unlabelled node",
    tag: "EDIT THE GRAPH",
    legend: [["active", "popped"], ["visit", "in the queue"], ["done", "labelled (odd component)"], ["path", "labelled (even component)"]],
    codeLang: "python",
    code: [
      "comp = {}; count = 0",
      "for s in nodes:",
      "    if s in comp: continue  # labelled",
      "    count += 1; comp[s] = count",
      "    q = deque([s])",
      "    while q:",
      "        u = q.popleft()",
      "        for v in adj[u]:",
      "            if v not in comp:",
      "                comp[v] = count; q.append(v)",
      "return count",
    ],
    inputs: [{ key: "edges", label: "edges (undirected; lone label = isolated node)", value: opts.edges || "0-1,1-2,0-2,3-4,5-6,6-7,7-8,9", width: 300 }],
    random: () => ({ edges: randomEdges(Viz.rand(7, 11), Viz.rand(3, 7), { connected: false }) }),
    build: ({ edges }) => {
      const G = parseGraph(edges, false, { maxN: 12, maxE: 20 });
      const pos = circle(G.ids), comp = {}, fr = [];
      let count = 0, q = [];
      const snap = (x) => ({ G, pos, comp: { ...comp }, q: [...q], count, ...x });
      fr.push(snap({ line: [0], vars: { count }, note: "A component is a maximal set of nodes that can all reach each other. The outer loop guarantees every node gets a label; each inner BFS labels exactly one component." }));
      for (const s of G.ids) {
        if (s in comp) { fr.push(snap({ s, line: [1, 2], vars: { s, "comp[s]": comp[s] }, note: `${s} already belongs to component ${comp[s]}: a BFS from it would only rediscover the same nodes, so skip.` })); continue; }
        count++; comp[s] = count; q = [s];
        fr.push(snap({ s, line: [1, 3, 4], vars: { s, count }, note: `${s} has no label: it starts component <b>${count}</b>.` }));
        let size = 0;
        while (q.length) {
          const u = q.shift(); size++;
          const added = [];
          for (const v of G.adj[u]) if (!(v in comp)) { comp[v] = count; q.push(v); added.push(v); }
          fr.push(snap({ u, line: [5, 6, 7, 8, 9], vars: { u, count, q: q.join(" ") || "—" }, note: `Pop ${u}. ${added.length ? `Label ${added.join(", ")} with ${count} and enqueue them.` : "All its neighbours are already labelled."}` }));
        }
        fr.push(snap({ line: [5], vars: { count, size }, note: `Component ${count} is closed: ${size} node(s). Nothing outside it is reachable from ${s}.` }));
      }
      fr.push(snap({ line: [10], vars: { components: count }, note: `<b>${count}</b> component(s). Every node was enqueued once and every edge looked at twice: O(V + E). (Union-Find answers the same question when edges arrive one at a time.)` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        sub: (id) => (id in f.comp ? `c${f.comp[id]}` : undefined),
        nodeCls: (id) => (id === f.u || id === f.s ? "active" : f.q.includes(id) ? "visit" : id in f.comp ? COMP_CLS[(f.comp[id] - 1) % 2] : ""),
        edgeCls: (k) => { const [a, b] = k.split("-"); return a in f.comp && b in f.comp ? COMP_CLS[(f.comp[a] - 1) % 2] : ""; },
      });
      const arr = Viz.array(G.ids.map((x) => f.comp[x] ?? null), { label: "comp[]", idxLabel: (i) => G.ids[i], cls: (i) => (G.ids[i] in f.comp ? COMP_CLS[(f.comp[G.ids[i]] - 1) % 2] : "") });
      return Viz.row(graph, `<div class="gf-col">${Viz.queue(f.q, { cls: () => "visit" })}${arr}</div>`);
    },
  }));

  /* ---------- 7. Cycle detection: undirected vs directed (and the classic bug) ---------- */
  Viz.register(P("cycle"), (el, opts) => Viz.player(el, {
    title: "Cycle detection: parent check (undirected) vs GREY check (directed)",
    tag: "SAME EDGES, THREE RULES",
    legend: [["active", "current"], ["visit", "GREY: on the current path"], ["done", "BLACK: finished"], ["path", "tree edge"], ["bad", "cycle / false alarm"]],
    codeLang: "python",
    code: [
      "def dfs(u, parent):",
      "    state[u] = GREY  # on the current path",
      "    for v in adj[u]:",
      "        if undir and v == parent: continue",
      "        if state[v] == GREY: return True",
      "        if state[v] == BLACK: continue",
      "        if dfs(v, u): return True  # WHITE",
      "    state[u] = BLACK  # leave the path",
      "    return False",
    ],
    inputs: [
      { key: "edges", label: "edges", value: opts.edges || "0-1,0-2,1-3,2-3,3-4", width: 240 },
      { key: "mode", label: "rule", type: "select", options: ["directed · GREY check", "undirected · parent check", "directed · visited-only (BUG)"], value: opts.mode || "directed · GREY check" },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(5, 7), Viz.rand(1, 3), { directed: true }) }),
    build: ({ edges, mode }) => {
      const und = mode.startsWith("undirected"), buggy = mode.includes("BUG");
      const G = parseGraph(edges, !und, { maxN: 10, maxE: 16 });
      const pos = circle(G.ids), state = {}, parent = {}, tree = {}, stack = [], fr = [];
      G.ids.forEach((x) => (state[x] = "W"));
      let found = null;
      const arrow = und ? "–" : "→";
      const snap = (x) => ({ G, pos, state: { ...state }, tree: { ...tree }, stack: [...stack], ...x });
      fr.push(snap({ line: [], vars: {}, note: und ? "Undirected: every edge is a two-way street, so the edge back to your parent is not a cycle. Any <i>other</i> already-visited neighbour is." : buggy ? "This mode uses the tempting rule “seen before ⇒ cycle”. Watch it raise a false alarm on a diamond." : "Directed: only an edge back to a node that is still <b>on the current path</b> (GREY) closes a loop." }));
      const dfs = (u, p) => {
        state[u] = "G"; parent[u] = p; stack.push(u);
        fr.push(snap({ u, line: [0, 1], vars: { u, parent: p ?? "—", path: stack.join(arrow) }, note: `Enter ${u}: GREY. Current path: ${stack.join(` ${arrow} `)}.` }));
        for (const v of G.adj[u]) {
          const k = ek(u, v);
          if (und && v === p) { fr.push(snap({ u, cur: k, line: [3], vars: { u, v, parent: p }, note: `${v} is the parent we came from. Going back along the same undirected edge is not a cycle: skip it.` })); continue; }
          if (state[v] === "G" || (buggy && state[v] === "B")) {
            if (state[v] === "B") {
              found = { u, v, bogus: true, nodes: new Set([u, v]), edges: { [k]: 1 } };
              fr.push(snap({ u, cur: k, found, line: [4], vars: { u, v, "state[v]": "BLACK" }, note: `<b>FALSE ALARM.</b> ${v} was visited, but it is BLACK: finished, and not on the current path ${stack.join("→")}. Two routes into ${v} is a diamond, not a loop. The fix: only GREY counts.` }));
              return true;
            }
            const cyc = [u]; let x = u;
            while (x !== v) { x = parent[x]; cyc.push(x); }
            const ce = { [k]: 1 };
            for (let i = 0; i + 1 < cyc.length; i++) { ce[ek(cyc[i + 1], cyc[i])] = 1; if (und) ce[ek(cyc[i], cyc[i + 1])] = 1; }
            if (und) ce[ek(v, u)] = 1;
            found = { u, v, nodes: new Set(cyc), edges: ce };
            const loop = [...cyc].reverse().concat(v).join(` ${arrow} `);
            fr.push(snap({ u, cur: k, found, line: [4], vars: { u, v, "state[v]": "GREY" }, note: `${v} is GREY: it is on the current path, so ${u} ${arrow} ${v} closes the loop <b>${loop}</b>. Cycle found.` }));
            return true;
          }
          if (state[v] === "B") { fr.push(snap({ u, cur: k, line: [5], vars: { u, v, "state[v]": "BLACK" }, note: `${v} is BLACK: fully explored, and it never reached ${u} (otherwise we would already have seen ${u} as GREY from there). Reaching it again is harmless.` })); continue; }
          tree[k] = 1; if (und) tree[ek(v, u)] = 1;
          fr.push(snap({ u, cur: k, line: [6], vars: { u, v }, note: `${v} is WHITE: explore it.` }));
          if (dfs(v, u)) return true;
        }
        state[u] = "B"; stack.pop();
        fr.push(snap({ u, line: [7, 8], vars: { u, path: stack.join(arrow) || "—" }, note: `${u} is finished: BLACK. It leaves the current path, so later edges into ${u} are not loops.` }));
        return false;
      };
      for (const s of G.ids) if (state[s] === "W" && dfs(s, null)) break;
      fr.push(snap({ found, line: [], vars: { cycle: found ? (found.bogus ? "reported (wrong!)" : "yes") : "no" }, note: found ? (found.bogus ? "The buggy rule reported a cycle in an acyclic graph. Switch the rule to “directed · GREY check” on the same edges." : "Stop at the first back edge: that is all a yes/no cycle check needs.") : `No back edge anywhere: the graph is ${und ? "a forest (acyclic)" : "a DAG"}.${und ? "" : " Try the visited-only rule on the same edges to see the bug."}` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        nodeCls: (id) => (f.found && f.found.nodes.has(id) ? "bad" : id === f.u ? "active" : f.state[id] === "G" ? "visit" : f.state[id] === "B" ? "done" : ""),
        edgeCls: (k) => (f.found && f.found.edges[k] ? "bad" : k === f.cur ? "active" : f.tree[k] ? "path" : ""),
      });
      const st = Viz.stack(f.stack, { label: "current path", cls: (i) => (i === f.stack.length - 1 ? "active" : "visit") });
      const arr = Viz.array(G.ids.map((x) => f.state[x]), { label: "state", idxLabel: (i) => G.ids[i], cls: (i) => (f.state[G.ids[i]] === "G" ? "visit" : f.state[G.ids[i]] === "B" ? "done" : "") });
      return Viz.row(graph, st, arr);
    },
  }));

  /* ---------- 8. Bipartite check by BFS 2-colouring ---------- */
  Viz.register(P("bipartite"), (el, opts) => Viz.player(el, {
    title: "Bipartite check: colour by BFS layer, look for a same-colour edge",
    tag: "EDIT THE GRAPH",
    legend: [["active", "popped"], ["visit", "side L (colour 0)"], ["path", "side R (colour 1)"], ["bad", "conflict / odd cycle"]],
    codeLang: "python",
    code: [
      "color = {}",
      "for s in nodes:  # every component",
      "    if s in color: continue",
      "    color[s] = 0; q = deque([s])",
      "    while q:",
      "        u = q.popleft()",
      "        for v in adj[u]:",
      "            if v not in color:",
      "                color[v] = 1 - color[u]",
      "                q.append(v)",
      "            elif color[v] == color[u]:",
      "                return False  # odd cycle",
      "return True",
    ],
    inputs: [{ key: "edges", label: "edges (undirected)", value: opts.edges || "0-1,1-2,0-3,1-4,2-5,3-4,4-5,5-6", width: 300 }],
    random: () => ({ edges: randomEdges(Viz.rand(5, 9), Viz.rand(1, 3)) }),
    build: ({ edges }) => {
      const G = parseGraph(edges, false, { maxN: 10, maxE: 18 });
      const pos = circle(G.ids), color = {}, parent = {}, depth = {}, tree = {}, fr = [];
      let q = [], conflict = null;
      const snap = (x) => ({ G, pos, color: { ...color }, q: [...q], tree: { ...tree }, ...x });
      const side = (c) => (c === 0 ? "L" : "R");
      fr.push(snap({ line: [0], vars: {}, note: "Bipartite means: split the nodes into two sides so that every edge crosses between them. BFS makes the only possible choice at every step." }));
      outer: for (const s of G.ids) {
        if (s in color) continue;
        color[s] = 0; depth[s] = 0; parent[s] = null; q = [s];
        fr.push(snap({ u: s, line: [1, 2, 3], vars: { s }, note: `New component: put ${s} on side L. (Either side works: flipping a whole component changes nothing.)` }));
        while (q.length) {
          const u = q.shift();
          for (const v of G.adj[u]) {
            const k = ek(u, v);
            if (!(v in color)) {
              color[v] = 1 - color[u]; depth[v] = depth[u] + 1; parent[v] = u; q.push(v); tree[k] = 1; tree[ek(v, u)] = 1;
              fr.push(snap({ u, cur: k, line: [5, 6, 7, 8, 9], vars: { u, v, "color[u]": side(color[u]), "color[v]": side(color[v]) }, note: `${v} is uncoloured: it is forced onto the side opposite ${u}, namely <b>${side(color[v])}</b>. Colour = BFS depth parity.` }));
            } else if (color[v] === color[u]) {
              const nodes = new Set(), ce = { [k]: 1, [ek(v, u)]: 1 };
              let a = u, b = v;
              const climb = (x) => { const p = parent[x]; ce[ek(x, p)] = 1; ce[ek(p, x)] = 1; nodes.add(x); return p; };
              while (a !== b) { if (depth[a] >= depth[b]) a = climb(a); else b = climb(b); }
              nodes.add(a); nodes.add(u); nodes.add(v);
              conflict = { u, v, nodes, ce };
              fr.push(snap({ u, cur: k, conflict, line: [10, 11], vars: { u, v, "color[u]": side(color[u]), "color[v]": side(color[v]) }, note: `${u} and ${v} are both on side <b>${side(color[u])}</b> but share an edge. Their tree paths up to the common ancestor ${a} plus this edge form a cycle of odd length ${nodes.size}. An odd cycle can never alternate L/R, so the graph is <b>not bipartite</b>.` }));
              break outer;
            } else {
              fr.push(snap({ u, cur: k, line: [10], vars: { u, v }, note: `${v} is already on the other side (${side(color[v])}): this edge is consistent.` }));
            }
          }
        }
      }
      fr.push(snap({ conflict, line: [conflict ? 11 : 12], vars: { bipartite: conflict ? "no" : "yes" }, note: conflict ? "Return False. Remove an edge of the red cycle, or click Randomize, to try again." : "No edge joins two same-coloured nodes: <b>bipartite</b>. The right-hand picture shows every edge crossing between the two sides. Add an edge such as 0-4 to create an odd cycle." }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const cls = (id) => (f.conflict && f.conflict.nodes.has(id) ? "bad" : id === f.u ? "active" : f.color[id] === 0 ? "visit" : f.color[id] === 1 ? "path" : "");
      const graph = drawGraph(G, f.pos, {
        sub: (id) => (id in f.color ? (f.color[id] ? "R" : "L") : undefined), nodeCls: cls,
        edgeCls: (k) => (f.conflict && f.conflict.ce[k] ? "bad" : k === f.cur ? "active" : f.tree[k] ? "done" : ""),
      });
      const cols = [[], [], []];
      G.ids.forEach((id) => cols[id in f.color ? f.color[id] * 2 : 1].push(id));
      const nodes = [];
      cols.forEach((col, ci) => col.forEach((id, i) => nodes.push({ id, x: ci * 90 + (ci === 1 ? 0 : (i % 2) * 22 * (ci ? 1 : -1)), y: i * 50 })));
      const es = G.edges.filter(([a, b]) => (a in f.color && b in f.color && f.color[a] !== f.color[b]) || (f.conflict && f.conflict.ce[ek(a, b)] && f.color[a] === f.color[b])).map(([u, v]) => ({ u, v }));
      const split = Viz.graph({ nodes, edges: es }, { label: "L | uncoloured | R", r: 17, nodeCls: (id) => (cols[1].includes(id) ? "dim" : cls(id)), edgeCls: (k) => { const [a, b] = k.split("-"); return f.color[a] === f.color[b] ? "bad" : ""; } });
      return Viz.row(graph, split);
    },
  }));

  /* ---------- 9. Implicit graph: word ladder ---------- */
  const diff1 = (a, b) => { let d = 0; for (let i = 0; i < a.length; i++) if (a[i] !== b[i] && ++d > 1) return false; return d === 1; };
  const LADDERS = [
    { b: "hit", e: "cog", w: "hot,dot,dog,lot,log,cog" },
    { b: "cold", e: "warm", w: "cord,card,ward,warm,word,worm,wore,core,cold" },
    { b: "lead", e: "gold", w: "load,goad,gold,lend,bead,bold,lord" },
    { b: "hit", e: "cog", w: "hot,dot,dog,lot,log" },
    { b: "fool", e: "sage", w: "pool,poll,pole,pale,sale,sage,foul,fowl,pall" },
  ];
  Viz.register(P("ladder"), (el) => Viz.player(el, {
    title: "Word ladder: BFS over a graph nobody wrote down",
    tag: "IMPLICIT GRAPH",
    legend: [["active", "popped word"], ["visit", "in the queue"], ["done", "finished"], ["path", "shortest ladder"], ["dim", "not reached (yet)"]],
    codeLang: "python",
    code: [
      "words = set(word_list) - {begin}",
      "dist = {begin: 1}; q = deque([begin])",
      "while q:",
      "    w = q.popleft()",
      "    if w == end: return dist[w]",
      "    for i in range(len(w)):",
      "        for ch in ascii_lowercase:",
      "            nxt = w[:i] + ch + w[i+1:]",
      "            if nxt in words:",
      "                words.remove(nxt)  # seen",
      "                dist[nxt] = dist[w] + 1",
      "                q.append(nxt)",
      "return 0",
    ],
    inputs: [
      { key: "b", label: "begin", value: "hit", width: 70 },
      { key: "e", label: "end", value: "cog", width: 70 },
      { key: "w", label: "word list", value: "hot,dot,dog,lot,log,cog", width: 300 },
    ],
    random: () => LADDERS[Viz.rand(0, LADDERS.length - 1)],
    build: ({ b, e, w }) => {
      const begin = String(b).trim().toLowerCase(), end = String(e).trim().toLowerCase();
      const list = [...new Set(String(w).toLowerCase().split(/[\s,]+/).filter(Boolean))];
      if (!/^[a-z]{2,5}$/.test(begin)) throw new Error("begin must be 2-5 lowercase letters.");
      if (!list.length || list.length > 12) throw new Error("Use 1-12 words in the list.");
      if (list.some((x) => !/^[a-z]+$/.test(x) || x.length !== begin.length)) throw new Error(`Every word must be ${begin.length} lowercase letters, like begin.`);
      if (end.length !== begin.length) throw new Error("end must have the same length as begin.");
      const words = new Set(list), ids = [begin, ...list.filter((x) => x !== begin)];
      const E = [];
      for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) if (diff1(ids[i], ids[j])) E.push([ids[i], ids[j]]);
      const G = { ids, edges: E, directed: false };
      const lay = { [begin]: 0 }, qq = [begin];
      while (qq.length) { const x = qq.shift(); for (const [a, c] of E) { const y = a === x ? c : c === x ? a : null; if (y && !(y in lay)) { lay[y] = lay[x] + 1; qq.push(y); } } }
      const maxL = Math.max(...Object.values(lay));
      const colsOf = {}; ids.forEach((x) => (colsOf[x in lay ? lay[x] : maxL + 1] ||= []).push(x));
      const pos = [];
      Object.entries(colsOf).forEach(([L, col]) => col.forEach((x, i) => pos.push({ id: x, x: Number(L) * 120 + (i % 2) * 26, y: (i - (col.length - 1) / 2) * 60 })));
      const dist = { [begin]: 1 }, parent = { [begin]: null }, q = [begin], done = new Set(), tree = {}, fr = [];
      const snap = (x) => ({ G, pos, dist: { ...dist }, q: [...q], done: new Set(done), tree: { ...tree }, ...x });
      if (!words.has(end)) {
        fr.push(snap({ line: [12], final: true, vars: { answer: 0 }, note: `“${end}” is not in the word list, so no ladder can end there: answer 0. (Check this first; it saves a whole BFS.)` }));
        return fr;
      }
      fr.push(snap({ line: [0, 1], vars: { q: begin }, note: `Nodes are words; an edge joins two words that differ in exactly one letter. The faint lines show that graph, but the code never builds it: it generates neighbours on demand. dist counts words in the ladder, so begin has dist 1.` }));
      let found = false;
      while (q.length) {
        const x = q.shift();
        if (x === end) { found = true; fr.push(snap({ u: x, line: [3, 4], vars: { w: x, "dist[w]": dist[x] }, note: `Popped the end word: BFS pops words in order of distance, so ${dist[x]} words is the shortest possible ladder.` })); break; }
        fr.push(snap({ u: x, line: [3, 4], vars: { w: x, "dist[w]": dist[x], q: q.join(" ") || "—" }, note: `Pop <b>${x}</b>. Try all ${x.length} positions × 26 letters = ${x.length * 26} candidate strings; only those in the word set are real neighbours.` }));
        for (let i = 0; i < x.length; i++) for (const ch of "abcdefghijklmnopqrstuvwxyz") {
          const nx = x.slice(0, i) + ch + x.slice(i + 1);
          if (nx === x || !words.has(nx) || nx in dist) continue;
          dist[nx] = dist[x] + 1; parent[nx] = x; q.push(nx); tree[ek(x, nx)] = 1; tree[ek(nx, x)] = 1;
          fr.push(snap({ u: x, v: nx, cur: ek(x, nx), line: [5, 6, 7, 8, 9, 10, 11], vars: { w: x, i, ch, nxt: nx, "dist[nxt]": dist[nx] }, note: `Position ${i} → '${ch}' gives <b>${nx}</b>, which is in the set and new: dist ${dist[nx]}.` }));
        }
        done.add(x);
      }
      const path = new Set(), pathE = {};
      if (found) { let x = end; while (x !== null) { path.add(x); const p = parent[x]; if (p !== null) { pathE[ek(p, x)] = 1; pathE[ek(x, p)] = 1; } x = p; } }
      const seq = [...path].reverse().join(" → ");
      fr.push(snap({ final: true, path, pathE, line: [found ? 4 : 12], vars: { answer: found ? dist[end] : 0 }, note: found ? `Ladder: <b>${seq}</b>, ${dist[end]} words. Cost: O(N · L · 26) candidate checks with set lookups, instead of O(N² · L) comparing every pair of words.` : `The queue ran dry without reaching “${end}”: answer 0.` }));
      return fr;
    },
    render: (f) => Viz.row(Viz.graph({
      nodes: f.pos.map((p) => ({ ...p, label: p.id, sub: p.id in f.dist ? `d=${f.dist[p.id]}` : undefined })),
      edges: f.G.edges.map(([u, v]) => ({ u, v })),
    }, {
      r: 25,
      nodeCls: (id) => (f.final && f.path && f.path.has(id) ? "path" : id === f.u ? "active" : f.done.has(id) ? "done" : f.q.includes(id) ? "visit" : id in f.dist ? "done" : "dim"),
      edgeCls: (k) => (f.final && f.pathE && f.pathE[k] ? "path" : k === f.cur ? "active" : f.tree[k] ? "done" : "dim"),
    }), Viz.queue(f.q, { cls: () => "visit" })),
  }));
})();
