/* Advanced Graph Algorithms visualizers. Every frame is produced by running the real algorithm on your input. */
(() => {
  const S = "advanced-graphs";
  const P = (name) => `${S}-${name}`;
  const esc = Viz.esc;
  const G6 = 6;
  const gcls = (c) => (c === undefined || c === null || c < 0 ? "" : `ag-g${c % G6}`);

  /* ---------- shared helpers ---------- */
  const natural = (a, b) => {
    const na = /^\d+$/.test(a), nb = /^\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const ek = (u, v) => `${u}-${v}`;
  const uk = (u, v) => (natural(u, v) <= 0 ? ek(u, v) : ek(v, u));

  /* Parse "0-1,1-2" (undirected) or "a>b" (directed); "u>v:7" adds a weight / capacity. A lone label adds an isolated node. */
  function parseGraph(text, directed, { maxN = 12, maxE = 24, weighted = false, noAnti = false, minN = 1 } = {}) {
    const toks = String(text).split(/[,;\s]+/).filter(Boolean);
    if (!toks.length) throw new Error(`Enter edges like ${directed ? "0>1,1>2" : "0-1,1-2"}.`);
    const ids = [], seen = new Set(), edges = [], keys = new Set();
    const add = (x) => {
      if (!/^[A-Za-z0-9]{1,3}$/.test(x)) throw new Error(`"${x}" is not a valid node label: use 1-3 letters or digits.`);
      if (!seen.has(x)) { seen.add(x); ids.push(x); }
    };
    for (const t of toks) {
      const m = t.match(/^([A-Za-z0-9]+)(?:(->|-|>)([A-Za-z0-9]+)(?::(\d+))?)?$/);
      if (!m) throw new Error(`Cannot read "${t}". Write edges as ${directed ? "u>v" : "u-v"}${weighted ? ":capacity" : ""}, separated by commas.`);
      add(m[1]);
      if (m[3] === undefined) continue;
      if (directed && m[2] === "-") throw new Error(`"${t}": this visualizer is directed, write u>v.`);
      if (!directed && m[2] !== "-") throw new Error(`"${t}": this visualizer is undirected, write u-v.`);
      add(m[3]);
      if (m[1] === m[3]) throw new Error(`Self-loop "${t}" is not allowed here.`);
      const k = directed ? ek(m[1], m[3]) : uk(m[1], m[3]);
      if (keys.has(k)) throw new Error(`Edge "${t}" appears twice.`);
      if (noAnti && keys.has(ek(m[3], m[1]))) throw new Error(`"${t}" and its reverse both appear. Split one of them through a new middle node (that is a modelling trick from this page).`);
      keys.add(k);
      let w;
      if (weighted) {
        if (m[4] === undefined) throw new Error(`"${t}" needs a capacity, e.g. ${m[1]}>${m[3]}:5.`);
        w = Number(m[4]);
        if (w < 1 || w > 99) throw new Error(`Capacity in "${t}" must be 1–99.`);
      }
      edges.push([m[1], m[3], w]);
    }
    if (ids.length > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${ids.length}).`);
    if (ids.length < minN) throw new Error(`Use at least ${minN} nodes.`);
    if (edges.length > maxE) throw new Error(`Use at most ${maxE} edges (you have ${edges.length}).`);
    ids.sort(natural);
    const adj = Object.fromEntries(ids.map((i) => [i, []]));
    for (const [u, v] of edges) { adj[u].push(v); if (!directed) adj[v].push(u); }
    for (const k in adj) adj[k].sort(natural);
    return { ids, edges, adj, directed };
  }

  const circle = (ids) => Viz.layout.circle(ids, ids.length <= 1 ? 0 : Math.max(80, ids.length * 20));

  function drawGraph(G, pos, o = {}) {
    const edges = (o.edges || G.edges).map(([u, v, w]) => ({ u, v, w: o.w ? o.w(u, v, w) : undefined }));
    return Viz.graph({
      nodes: pos.map((p) => ({ ...p, label: o.labelOf ? o.labelOf(p.id) : p.id, sub: o.sub ? o.sub(p.id) : undefined, top: o.top ? o.top(p.id) : undefined })),
      edges,
    }, { directed: o.directed ?? G.directed, nodeCls: o.nodeCls, edgeCls: o.edgeCls, label: o.label, r: o.r });
  }

  function randomEdges(n, extra, { directed = false, connected = true } = {}) {
    const set = new Set(), out = [];
    const addE = (u, v) => {
      if (u === v) return false;
      const k = directed ? `${u}>${v}` : [u, v].sort((a, b) => a - b).join("-");
      if (set.has(k) || (directed && set.has(`${v}>${u}`) && Math.random() < 0.5)) return false;
      set.add(k); out.push(`${u}${directed ? ">" : "-"}${v}`); return true;
    };
    if (connected) for (let i = 1; i < n; i++) (Math.random() < 0.5 || !directed) ? addE(Viz.rand(0, i - 1), i) : addE(i, Viz.rand(0, i - 1));
    let tries = 0;
    while (extra > 0 && tries++ < 300) if (addE(Viz.rand(0, n - 1), Viz.rand(0, n - 1))) extra--;
    for (let i = 0; i < n; i++) if (!out.some((e) => e.split(/[->]/).includes(String(i)))) out.push(String(i));
    return out.join(",");
  }

  const col = (...h) => `<div class="ag-col">${h.filter(Boolean).join("")}</div>`;
  const badge = (html, c = "") => `<span class="ag-badge ${c}">${html}</span>`;
  const chips = (label, items, empty = "none yet") => Viz.labeled(label, `<div class="ag-chips">${items.length ? items.join("") : `<span class="ag-empty">${empty}</span>`}</div>`);
  const item = (t, c = "") => `<span class="v-item ${c}">${esc(t)}</span>`;

  /* A small table: columns = nodes, rows = named arrays. hot = {"row,node": true} highlights a changed cell. */
  function nodeTable(ids, rows, o = {}) {
    return Viz.grid(rows.map(([, arr]) => ids.map((id) => (arr[id] === undefined || arr[id] === -1 ? "" : arr[id]))), {
      label: o.label || "per-node table", colLabels: ids, rowLabels: rows.map(([n]) => n), corner: "node",
      cls: (r, c) => {
        const id = ids[c];
        if (o.hot && o.hot[`${rows[r][0]},${id}`]) return "active";
        return o.cls ? o.cls(rows[r][0], id) : "";
      },
    });
  }

  /* Tarjan SCC (no frames): returns comp[id] numbered in the order SCCs complete (reverse topological). */
  function tarjanSilent(ids, adj) {
    const tin = {}, low = {}, on = {}, st = [], comp = {};
    let t = 0, c = 0;
    const dfs = (u) => {
      tin[u] = low[u] = t++; st.push(u); on[u] = true;
      for (const v of adj[u]) {
        if (tin[v] === undefined) { dfs(v); low[u] = Math.min(low[u], low[v]); }
        else if (on[v]) low[u] = Math.min(low[u], tin[v]);
      }
      if (low[u] === tin[u]) { let x; do { x = st.pop(); on[x] = false; comp[x] = c; } while (x !== u); c++; }
    };
    for (const u of ids) if (tin[u] === undefined) dfs(u);
    return { comp, count: c };
  }

  /* ---------- 1. Bridges and articulation points with tin / low ---------- */
  Viz.register(P("lowlink"), (el, opts) => Viz.player(el, {
    title: "Bridges and articulation points: tin / low computed live",
    tag: "EDIT THE GRAPH",
    legend: [["active", "current u / edge"], ["visit", "on the DFS stack"], ["done", "finished · tree edge"], ["path", "back edge"], ["bad", "bridge / cut vertex"]],
    codeLang: "python",
    code: [
      "def dfs(u, parent):",
      "    tin[u] = low[u] = timer; timer += 1",
      "    children = 0",
      "    for v in adj[u]:",
      "        if v == parent: continue",
      "        if tin[v] != -1:            # back edge",
      "            low[u] = min(low[u], tin[v])",
      "        else:                        # tree edge",
      "            dfs(v, u); children += 1",
      "            low[u] = min(low[u], low[v])",
      "            if low[v] > tin[u]: bridge(u, v)",
      "            if low[v] >= tin[u] and parent != -1: cut(u)",
      "    if parent == -1 and children > 1: cut(u)",
    ],
    inputs: [
      { key: "edges", label: "edges (undirected, u-v)", value: opts.edges || "0-1,1-2,2-0,2-3,3-4,4-2,4-5,5-6,6-7,7-5,7-8", width: 330 },
    ],
    random: () => {
      const n = Viz.rand(6, 10), out = [];
      for (let i = 1; i < n; i++) out.push(`${Viz.rand(Math.max(0, i - 2), i - 1)}-${i}`);
      const set = new Set(out.map((e) => e.split("-").map(Number).sort((a, b) => a - b).join("-")));
      let extra = Viz.rand(1, 3), tries = 0;
      while (extra > 0 && tries++ < 100) { const a = Viz.rand(0, n - 1), b = Viz.rand(0, n - 1); const k = [a, b].sort((x, y) => x - y).join("-"); if (a !== b && Math.abs(a - b) <= 3 && !set.has(k)) { set.add(k); out.push(k); extra--; } }
      return { edges: out.join(",") };
    },
    build: ({ edges }) => {
      const G = parseGraph(edges, false, { maxN: 12, maxE: 20 });
      const pos = circle(G.ids), tin = {}, low = {}, etype = {}, bridges = [], cuts = new Set(), stack = [], fin = new Set(), fr = [];
      G.ids.forEach((x) => { tin[x] = -1; low[x] = -1; });
      let timer = 0;
      const snap = (x) => ({ G, pos, tin: { ...tin }, low: { ...low }, etype: { ...etype }, bridges: [...bridges], cuts: new Set(cuts), stack: [...stack], fin: new Set(fin), ...x });
      fr.push(snap({ line: [], vars: { timer }, note: "Every node gets two numbers. <b>tin</b> is when DFS first reaches it. <b>low</b> is the smallest tin reachable from its subtree using tree edges down and <b>at most one back edge</b> up. If a child's subtree cannot climb above its parent, the edge between them is the only link: a bridge." }));
      const dfs = (u, parent) => {
        tin[u] = low[u] = timer++; stack.push(u);
        let children = 0;
        fr.push(snap({ u, hot: { [`tin,${u}`]: 1, [`low,${u}`]: 1 }, line: [0, 1, 2], vars: { u, parent: parent ?? "—", "tin[u]": tin[u], "low[u]": low[u] }, note: `Enter <b>${u}</b>: tin = low = ${tin[u]}. Before exploring, the best ${u} can do is reach itself.` }));
        for (const v of G.adj[u]) {
          const k = uk(u, v);
          if (v === parent) {
            fr.push(snap({ u, cur: k, line: [3, 4], vars: { u, v, parent }, note: `${v} is the parent: this is the tree edge we came down on. Using it to "climb" would be cheating (every edge would look like part of a cycle), so skip it.` }));
            continue;
          }
          if (tin[v] !== -1) {
            if (etype[k] === undefined) etype[k] = "back";
            const old = low[u];
            low[u] = Math.min(low[u], tin[v]);
            fr.push(snap({ u, cur: k, hot: { [`low,${u}`]: low[u] !== old }, line: [5, 6], vars: { u, v, "tin[v]": tin[v], "low[u]": low[u] }, note: `${v} is already discovered (tin ${tin[v]}), so ${u}–${v} is a <b>back edge</b> to an ancestor. It is an escape route upward: low[${u}] = min(${old}, ${tin[v]}) = <b>${low[u]}</b>.` }));
            continue;
          }
          etype[k] = "tree";
          fr.push(snap({ u, cur: k, line: [7, 8], vars: { u, v }, note: `${v} is new: ${u}–${v} is a <b>tree edge</b>. Dive into ${v}; we will learn how high ${v}'s whole subtree can climb.` }));
          dfs(v, u); children++;
          const old = low[u];
          low[u] = Math.min(low[u], low[v]);
          const isBridge = low[v] > tin[u];
          const isCut = low[v] >= tin[u] && parent !== null;
          if (isBridge) bridges.push(`${u}–${v}`);
          if (isCut) cuts.add(u);
          let why = `low[${v}] = ${low[v]}`;
          if (isBridge) why += ` &gt; tin[${u}] = ${tin[u]}: nothing under ${v} reaches ${u} or above except through this edge. <b>${u}–${v} is a bridge.</b>`;
          else if (low[v] === tin[u]) why += ` = tin[${u}]: ${v}'s subtree climbs back to ${u} itself but no higher, so the edge is in a cycle (not a bridge)${parent !== null ? `, yet removing <b>${u}</b> would strand it` : ""}.`;
          else why += ` &lt; tin[${u}] = ${tin[u]}: ${v}'s subtree has its own way above ${u}, so neither the edge nor ${u} is critical for it.`;
          if (isCut) why += ` <b>${u} is an articulation point.</b>`;
          fr.push(snap({ u, cur: k, hot: { [`low,${u}`]: low[u] !== old }, line: isBridge || isCut ? [9, 10, 11] : [9], vars: { u, v, "low[v]": low[v], "tin[u]": tin[u], "low[u]": low[u] }, note: `Back in ${u}. Pull up the child's result: low[${u}] = min(${old}, ${low[v]}) = ${low[u]}. Test the child: ${why}` }));
        }
        if (parent === null) {
          if (children > 1) cuts.add(u);
          fr.push(snap({ u, line: [12], vars: { u, children }, note: `${u} is a DFS root, so the low test does not apply (nothing is above it). A root is a cut vertex exactly when it has <b>2+ DFS children</b>: those subtrees are only joined through it. Here it has ${children} → ${children > 1 ? "<b>cut vertex</b>" : "not a cut vertex"}.` }));
        }
        stack.pop(); fin.add(u);
      };
      for (const s of G.ids) if (tin[s] === -1) dfs(s, null);
      fr.push(snap({ line: [], vars: { bridges: bridges.length, "cut vertices": cuts.size }, note: `Done in one DFS, O(V + E). Bridges: <b>${bridges.join(", ") || "none"}</b>. Articulation points: <b>${[...cuts].sort(natural).join(", ") || "none"}</b>. Notice a node can be a cut vertex without any bridge (two cycles sharing a node), and a bridge's endpoint is a cut vertex unless it is a leaf.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const bset = new Set(f.bridges.map((b) => uk(...b.split("–"))));
      const graph = drawGraph(G, f.pos, {
        top: (id) => (f.tin[id] >= 0 ? `${f.tin[id]}/${f.low[id]}` : undefined),
        nodeCls: (id) => (id === f.u ? "active" : f.cuts.has(id) ? "bad" : f.stack.includes(id) ? "visit" : f.fin.has(id) ? "done" : ""),
        edgeCls: (k) => { const [a, b] = k.split("-"); const key = uk(a, b); return key === f.cur ? "active" : bset.has(key) ? "bad" : f.etype[key] === "tree" ? "done" : f.etype[key] === "back" ? "path ag-back" : ""; },
        label: "labels: tin/low",
      });
      const tbl = nodeTable(G.ids, [["tin", f.tin], ["low", f.low]], { label: "tin / low", hot: f.hot, cls: (r, id) => (f.cuts.has(id) ? "bad" : "") });
      const st = Viz.stack(f.stack.map((x) => `dfs(${x})`), { label: "call stack", cls: (i) => (i === f.stack.length - 1 ? "active" : "visit") });
      return Viz.row(graph, col(tbl, Viz.row(st, col(chips("bridges", f.bridges.map((b) => item(b, "bad"))), chips("cut vertices", [...f.cuts].sort(natural).map((c) => item(c, "bad")))))));
    },
  }));

  /* ---------- 2. Tarjan SCC ---------- */
  Viz.register(P("tarjan"), (el, opts) => Viz.player(el, {
    title: "Tarjan's SCC: one DFS, one explicit stack, low-links",
    tag: "EDIT THE GRAPH",
    legend: [["active", "current u / edge"], ["visit", "on Tarjan's stack"], ["path", "back edge into the stack"], ["dim", "edge into a finished SCC (ignored)"]],
    codeLang: "python",
    code: [
      "def dfs(u):",
      "    tin[u] = low[u] = timer; timer += 1",
      "    stack.append(u); on_stack[u] = True",
      "    for v in adj[u]:",
      "        if tin[v] == -1:",
      "            dfs(v); low[u] = min(low[u], low[v])",
      "        elif on_stack[v]:",
      "            low[u] = min(low[u], tin[v])",
      "        # else: v already in a finished SCC",
      "    if low[u] == tin[u]:         # u is an SCC root",
      "        pop stack down to u  ->  one SCC",
    ],
    inputs: [
      { key: "edges", label: "edges (directed, u>v)", value: opts.edges || "0>1,1>2,2>0,1>3,3>4,4>5,5>3,6>5,6>7,7>6,7>8", width: 330 },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(6, 9), Viz.rand(3, 6), { directed: true }) }),
    build: ({ edges }) => {
      const G = parseGraph(edges, true, { maxN: 12, maxE: 22 });
      const pos = circle(G.ids), tin = {}, low = {}, on = {}, st = [], comp = {}, sccs = [], call = [], etype = {}, fr = [];
      G.ids.forEach((x) => { tin[x] = -1; low[x] = -1; });
      let timer = 0;
      const snap = (x) => ({ G, pos, tin: { ...tin }, low: { ...low }, st: [...st], comp: { ...comp }, sccs: sccs.map((s) => [...s]), call: [...call], etype: { ...etype }, ...x });
      fr.push(snap({ line: [], vars: { timer }, note: "A <b>strongly connected component</b> (SCC) is a maximal set where every node reaches every other. Tarjan finds them all in one DFS. Nodes wait on an explicit stack until we know which SCC they belong to." }));
      const dfs = (u) => {
        tin[u] = low[u] = timer++; st.push(u); on[u] = true; call.push(u);
        fr.push(snap({ u, hot: { [`tin,${u}`]: 1, [`low,${u}`]: 1 }, line: [0, 1, 2], vars: { u, "tin[u]": tin[u], stack: st.join(" ") }, note: `Enter <b>${u}</b> (tin = low = ${tin[u]}) and push it on the SCC stack. It stays there until its SCC is complete, even after its DFS call returns.` }));
        for (const v of G.adj[u]) {
          const k = ek(u, v);
          if (tin[v] === -1) {
            etype[k] = "tree";
            fr.push(snap({ u, cur: k, line: [3, 4, 5], vars: { u, v }, note: `${v} is unvisited: tree edge ${u}→${v}, recurse.` }));
            dfs(v);
            const old = low[u]; low[u] = Math.min(low[u], low[v]);
            fr.push(snap({ u, cur: k, hot: { [`low,${u}`]: old !== low[u] }, line: [5], vars: { u, v, "low[v]": low[v], "low[u]": low[u] }, note: `Back in ${u}. ${on[v] ? `${v} is still on the stack, so it is in the same SCC as something at or above ${u}: inherit its reach, low[${u}] = min(${old}, ${low[v]}) = ${low[u]}.` : `${v} already formed its own SCC and left the stack; its low (${low[v]}) ≥ tin[${u}], so min leaves low[${u}] = ${low[u]}.`}` }));
          } else if (on[v]) {
            etype[k] = "back";
            const old = low[u]; low[u] = Math.min(low[u], tin[v]);
            fr.push(snap({ u, cur: k, hot: { [`low,${u}`]: old !== low[u] }, line: [6, 7], vars: { u, v, "tin[v]": tin[v], "low[u]": low[u] }, note: `${v} is <b>on the stack</b>: ${v} can reach ${u} (that is why ${u} is above it on the stack), and now ${u} reaches ${v}. They are in one cycle, so one SCC. low[${u}] = min(${old}, ${tin[v]}) = ${low[u]}.` }));
          } else {
            etype[k] = "cross";
            fr.push(snap({ u, cur: k, line: [8], vars: { u, v, "comp[v]": `C${comp[v]}` }, note: `${v} is visited but <b>not on the stack</b>: it already belongs to finished SCC C${comp[v]}. ${v} cannot reach back to ${u} (or it would still be on the stack), so this edge must not lower low[${u}]. Ignoring it is the bug-prone line.` }));
          }
        }
        if (low[u] === tin[u]) {
          const members = []; let x;
          do { x = st.pop(); on[x] = false; comp[x] = sccs.length; members.push(x); } while (x !== u);
          sccs.push(members.sort(natural));
          call.pop();
          fr.push(snap({ u, line: [9, 10], vars: { u, "low[u]": low[u], "tin[u]": tin[u], SCC: `C${sccs.length - 1}` }, note: `low[${u}] == tin[${u}] = ${tin[u]}: nothing in ${u}'s subtree reaches above ${u}, so ${u} is the <b>root</b> of an SCC. Pop the stack down to ${u}: <b>C${sccs.length - 1} = {${members.join(", ")}}</b>.` }));
        } else {
          call.pop();
          fr.push(snap({ u, line: [9], vars: { u, "low[u]": low[u], "tin[u]": tin[u] }, note: `low[${u}] = ${low[u]} &lt; tin[${u}] = ${tin[u]}: ${u} reaches an older node still on the stack, so ${u} belongs to that node's SCC. Return but leave ${u} on the stack.` }));
        }
      };
      for (const s of G.ids) if (tin[s] === -1) dfs(s);
      fr.push(snap({ line: [], vars: { SCCs: sccs.length }, note: `Done: <b>${sccs.length} SCCs</b> in O(V + E). They came out in <b>reverse topological order</b> of the condensation: C0 is a sink (no edges leave it to another SCC). Read them backwards to get a topological order.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        top: (id) => (f.tin[id] >= 0 ? `${f.tin[id]}/${f.low[id]}` : undefined),
        sub: (id) => (f.comp[id] !== undefined ? `C${f.comp[id]}` : undefined),
        nodeCls: (id) => (f.comp[id] !== undefined ? gcls(f.comp[id]) + (id === f.u ? " ag-cur" : "") : id === f.u ? "active" : f.st.includes(id) ? "visit" : ""),
        edgeCls: (k) => (k === f.cur ? "active" : f.etype[k] === "back" ? "path ag-back" : f.etype[k] === "cross" ? "dim" : f.etype[k] === "tree" ? "done" : ""),
        label: "labels: tin/low · below: SCC id",
      });
      const tbl = nodeTable(G.ids, [["tin", f.tin], ["low", f.low]], { label: "tin / low", hot: f.hot });
      const stk = Viz.stack(f.st, { label: "SCC stack", cls: (i, v) => (v === f.u ? "active" : "visit") });
      const cs = Viz.stack(f.call.map((x) => `dfs(${x})`), { label: "call stack" });
      const out = chips("SCCs found (in order)", f.sccs.map((m, i) => `<span class="v-item ag-g${i % G6}">C${i} {${m.join(",")}}</span>`));
      return Viz.row(graph, col(tbl, Viz.row(stk, cs), out));
    },
  }));

  /* ---------- 3. Kosaraju: two passes ---------- */
  Viz.register(P("kosaraju"), (el, opts) => Viz.player(el, {
    title: "Kosaraju: finish order on G, then DFS on the reversed graph",
    tag: "EDIT THE GRAPH",
    legend: [["active", "current node / edge"], ["visit", "pass 1: visited"], ["done", "pass 1: finished"]],
    codeLang: "python",
    code: [
      "# pass 1: DFS on G, record finishing order",
      "def dfs1(u):",
      "    seen.add(u)",
      "    for v in adj[u]: if v not in seen: dfs1(v)",
      "    order.append(u)           # u finished",
      "# pass 2: reversed graph, latest finisher first",
      "for u in reversed(order):",
      "    if comp[u] is None: dfs2(u, c); c += 1",
      "def dfs2(u, c):",
      "    comp[u] = c",
      "    for v in radj[u]: if comp[v] is None: dfs2(v, c)",
    ],
    inputs: [
      { key: "edges", label: "edges (directed, u>v)", value: opts.edges || "0>1,1>2,2>0,1>3,3>4,4>5,5>3,6>5,6>7,7>6,7>8", width: 330 },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(6, 9), Viz.rand(3, 6), { directed: true }) }),
    build: ({ edges }) => {
      const G = parseGraph(edges, true, { maxN: 12, maxE: 22 });
      const pos = circle(G.ids), seen = new Set(), fin = new Set(), order = [], comp = {}, fr = [];
      const radj = Object.fromEntries(G.ids.map((x) => [x, []]));
      for (const [u, v] of G.edges) radj[v].push(u);
      for (const k in radj) radj[k].sort(natural);
      const redges = G.edges.map(([u, v]) => [v, u]);
      let phase = 1, c = 0;
      const snap = (x) => ({ G, pos, phase, redges, seen: new Set(seen), fin: new Set(fin), order: [...order], comp: { ...comp }, ...x });
      fr.push(snap({ line: [0], vars: { phase }, note: "<b>Pass 1</b> runs an ordinary DFS over G and records each node when it <b>finishes</b>. The last node to finish lies in a <b>source</b> SCC of the condensation, which is what pass 2 needs." }));
      const dfs1 = (u) => {
        seen.add(u);
        fr.push(snap({ u, line: [1, 2], vars: { u, order: order.join(" ") || "—" }, note: `dfs1(${u}): mark visited.` }));
        for (const v of G.adj[u]) {
          if (seen.has(v)) { fr.push(snap({ u, cur: ek(u, v), line: [3], vars: { u, v }, note: `${v} already visited: skip.` })); continue; }
          fr.push(snap({ u, cur: ek(u, v), line: [3], vars: { u, v }, note: `${u}→${v}: ${v} is new, recurse.` }));
          dfs1(v);
        }
        order.push(u); fin.add(u);
        fr.push(snap({ u, line: [4], vars: { u, order: order.join(" ") }, note: `${u} finished: append to order. Everything ${u} reaches finished before it, unless it was already finished earlier.` }));
      };
      for (const s of G.ids) if (!seen.has(s)) dfs1(s);
      phase = 2;
      fr.push(snap({ line: [5], vars: { phase, order: order.join(" ") }, note: `<b>Pass 2.</b> Reverse every edge. An SCC stays an SCC (cycles reversed are still cycles), but edges <i>between</i> SCCs now point backwards. Starting from the latest finisher (${order[order.length - 1]}, in a source SCC of G = a sink of the reversed graph), DFS cannot leak into another SCC.` }));
      const dfs2 = (u) => {
        comp[u] = c;
        fr.push(snap({ u, line: [8, 9], vars: { u, c: `C${c}` }, note: `comp[${u}] = C${c}.` }));
        for (const v of radj[u]) {
          if (comp[v] !== undefined) { fr.push(snap({ u, cur: ek(v, u), line: [10], vars: { u, v }, note: `Reversed edge ${u}→${v} (originally ${v}→${u}): ${v} already in C${comp[v]}, an SCC found earlier. Stop: this is exactly the leak that the order prevents.` })); continue; }
          fr.push(snap({ u, cur: ek(v, u), line: [10], vars: { u, v }, note: `Reversed edge ${u}→${v}: ${v} is unassigned, so it is in the same SCC. Recurse.` }));
          dfs2(v);
        }
      };
      for (let i = order.length - 1; i >= 0; i--) {
        const u = order[i];
        if (comp[u] !== undefined) continue;
        fr.push(snap({ u, line: [6, 7], vars: { u, c: `C${c}`, i }, note: `Next unassigned node in reverse finish order: <b>${u}</b>. Everything it reaches in the reversed graph (and is still unassigned) is one SCC.` }));
        dfs2(u); c++;
        const mem = G.ids.filter((x) => comp[x] === c - 1);
        fr.push(snap({ line: [7], vars: { SCC: `C${c - 1}`, members: mem.join(",") }, note: `SCC <b>C${c - 1} = {${mem.join(", ")}}</b>.` }));
      }
      fr.push(snap({ line: [], vars: { SCCs: c }, note: `Done: ${c} SCCs, two DFS passes, O(V + E). Kosaraju's SCCs come out in <b>topological order</b> (C0 is a source); Tarjan's come out in reverse. Same partition either way.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const graph = drawGraph(G, f.pos, {
        edges: f.phase === 1 ? G.edges : f.redges,
        sub: (id) => (f.comp[id] !== undefined ? `C${f.comp[id]}` : undefined),
        top: (id) => (f.phase === 1 && f.fin.has(id) ? `#${f.order.indexOf(id) + 1}` : undefined),
        nodeCls: (id) => (f.comp[id] !== undefined ? gcls(f.comp[id]) + (id === f.u ? " ag-cur" : "") : id === f.u ? "active" : f.phase === 1 ? (f.fin.has(id) ? "done" : f.seen.has(id) ? "visit" : "") : "dim"),
        edgeCls: (k) => (k === f.cur ? "active" : ""),
        label: f.phase === 1 ? "pass 1: G (above node: finish rank)" : "pass 2: reversed graph Gᵀ",
      });
      const ord = Viz.array(f.order.length ? f.order : ["·"], { label: f.phase === 1 ? "finish order (left = first)" : "finish order: scanned right → left", cls: (i, v) => (f.comp[v] !== undefined ? gcls(f.comp[v]) : f.phase === 2 ? "" : "done") });
      const groups = {};
      for (const [x, cc] of Object.entries(f.comp)) (groups[cc] ||= []).push(x);
      const out = chips("SCCs", Object.entries(groups).map(([cc, m]) => `<span class="v-item ag-g${cc % G6}">C${cc} {${m.sort(natural).join(",")}}</span>`), f.phase === 1 ? "pass 2 builds these" : "none yet");
      return Viz.row(graph, col(badge(f.phase === 1 ? "PASS 1 · G" : "PASS 2 · Gᵀ", f.phase === 1 ? "visit" : "path"), ord, out));
    },
  }));

  /* Longest-path levels for a DAG layout. */
  function dagLayout(k, dagEdges, gapX = 120, gapY = 78) {
    const indeg = Array(k).fill(0), out = Array.from({ length: k }, () => []);
    for (const [a, b] of dagEdges) { indeg[b]++; out[a].push(b); }
    const lvl = Array(k).fill(0), q = [];
    for (let i = 0; i < k; i++) if (!indeg[i]) q.push(i);
    const deg = [...indeg];
    while (q.length) { const a = q.shift(); for (const b of out[a]) { lvl[b] = Math.max(lvl[b], lvl[a] + 1); if (!--deg[b]) q.push(b); } }
    const byL = {};
    for (let i = 0; i < k; i++) (byL[lvl[i]] ||= []).push(i);
    const pos = [];
    for (const [L, arr] of Object.entries(byL)) arr.forEach((c, j) => pos.push({ id: `C${c}`, x: Number(L) * gapX, y: (j - (arr.length - 1) / 2) * gapY }));
    return pos;
  }

  /* ---------- 4. Condensation DAG ---------- */
  Viz.register(P("condense"), (el, opts) => Viz.player(el, {
    title: "Condensation: shrink each SCC to one node, get a DAG",
    tag: "EDIT THE GRAPH",
    legend: [["active", "edge being classified"], ["dim", "edge inside one SCC (vanishes)"],     ["done", "source SCC (in-degree 0): thick ring"], ["bad", "sink SCC (out-degree 0): dashed ring"]],
    codeLang: "python",
    code: [
      "comp = scc(G)              # Tarjan or Kosaraju",
      "for u, v in edges:",
      "    if comp[u] != comp[v]:",
      "        dag.add((comp[u], comp[v]))",
      "    # else: inside one SCC, drop it",
      "sources = [c for c in comps if indeg[c] == 0]",
      "sinks   = [c for c in comps if outdeg[c] == 0]",
      "add = 0 if k == 1 else max(len(sources), len(sinks))",
    ],
    inputs: [
      { key: "edges", label: "edges (directed, u>v)", value: opts.edges || "0>1,1>2,2>0,1>3,3>4,4>5,5>3,6>5,6>7,7>6,7>8,2>8", width: 330 },
    ],
    random: () => ({ edges: randomEdges(Viz.rand(6, 10), Viz.rand(3, 6), { directed: true }) }),
    build: ({ edges }) => {
      const G = parseGraph(edges, true, { maxN: 12, maxE: 22 });
      const { comp, count: k } = tarjanSilent(G.ids, G.adj);
      const pos = circle(G.ids), dag = new Map(), etype = {}, fr = [];
      const snap = (x) => ({ G, pos, comp, k, dag: new Map(dag), etype: { ...etype }, ...x });
      fr.push(snap({ line: [0], vars: { SCCs: k }, note: `Step 1: find the SCCs (${k} of them, coloured). Inside an SCC everyone reaches everyone, so for reachability questions an SCC behaves like <b>one super-node</b>.` }));
      G.edges.forEach(([u, v]) => {
        const k2 = ek(u, v), a = comp[u], b = comp[v];
        if (a === b) {
          etype[k2] = "in";
          fr.push(snap({ cur: k2, line: [1, 4], vars: { edge: `${u}→${v}`, "comp[u]": `C${a}`, "comp[v]": `C${b}` }, note: `${u}→${v} stays inside C${a}. It becomes a self-loop on the super-node, which carries no information: drop it.` }));
        } else {
          etype[k2] = "x";
          const key = `${a}>${b}`, existed = dag.has(key);
          dag.set(key, (dag.get(key) || 0) + 1);
          fr.push(snap({ cur: k2, dcur: key, line: [1, 2, 3], vars: { edge: `${u}→${v}`, "dag edge": `C${a}→C${b}` }, note: existed ? `${u}→${v} goes C${a}→C${b}, which already exists (parallel edge). A set keeps one copy.` : `${u}→${v} crosses from C${a} to C${b}: add DAG edge <b>C${a}→C${b}</b>.` }));
        }
      });
      const dagE = [...dag.keys()].map((s) => s.split(">").map(Number));
      const indeg = Array(k).fill(0), outdeg = Array(k).fill(0);
      dagE.forEach(([a, b]) => { indeg[b]++; outdeg[a]++; });
      const src = [], snk = [];
      for (let i = 0; i < k; i++) { if (!indeg[i]) src.push(i); if (!outdeg[i]) snk.push(i); }
      const add = k === 1 ? 0 : Math.max(src.length, snk.length);
      fr.push(snap({ fin: true, src, snk, line: [5, 6, 7], vars: { sources: src.map((c) => `C${c}`).join(" "), sinks: snk.map((c) => `C${c}`).join(" "), "edges to add": add }, note: `The result is always a <b>DAG</b>: a cycle between SCCs would merge them into one. Sources (thick ring, green badge) cannot be reached from outside; sinks (dashed ring, red badge) cannot get out. To make the whole graph strongly connected you need <b>max(#sources, #sinks) = ${add}</b> new edges (wire sinks back to sources)${k === 1 ? "; it already is one SCC, so 0" : ""}.` }));
      return fr;
    },
    render: (f) => {
      const { G, comp, k } = f;
      const graph = drawGraph(G, f.pos, {
        sub: (id) => `C${comp[id]}`,
        nodeCls: (id) => gcls(comp[id]),
        edgeCls: (key) => (key === f.cur ? "active" : f.etype[key] === "in" ? "dim" : f.etype[key] === "x" ? "visit" : ""),
        label: "G, coloured by SCC",
      });
      const dagE = [...f.dag.keys()].map((s) => s.split(">").map(Number));
      const dpos = dagLayout(k, dagE);
      const members = (c) => G.ids.filter((x) => comp[x] === c);
      const dg = Viz.graph({
        nodes: dpos.map((p) => { const c = Number(p.id.slice(1)); const m = members(c); return { ...p, label: p.id, sub: `{${m.length > 4 ? m.slice(0, 3).join(",") + ",…" : m.join(",")}}` }; }),
        edges: dagE.map(([a, b]) => ({ u: `C${a}`, v: `C${b}` })),
      }, {
        directed: true, r: 22, label: "condensation DAG (left → right = topological)",
        nodeCls: (id) => { const c = Number(id.slice(1)); return gcls(c) + (f.fin && f.snk.includes(c) ? " ag-sink" : f.fin && f.src.includes(c) ? " ag-src" : ""); },
        edgeCls: (key) => { const [a, b] = key.split("-"); return `${a.slice(1)}>${b.slice(1)}` === f.dcur ? "active" : ""; },
      });
      const extra = f.fin ? Viz.row(badge(`sources: ${f.src.map((c) => "C" + c).join(" ")}`, "done"), badge(`sinks: ${f.snk.map((c) => "C" + c).join(" ")}`, "bad")) : "";
      return Viz.row(graph, col(dg, extra));
    },
  }));

  /* ---------- 5. 2-SAT via the implication graph ---------- */
  Viz.register(P("twosat"), (el, opts) => Viz.player(el, {
    title: "2-SAT: clauses → implication graph → SCCs → assignment",
    tag: "EDIT THE CLAUSES",
    legend: [["active", "edges added by this clause"], ["bad", "x and ¬x in one SCC: unsatisfiable"], ["done", "literal set TRUE"]],
    codeLang: "python",
    code: [
      "for a, b in clauses:          # (a OR b)",
      "    add_edge(NOT a, b)        # if a is false, b must hold",
      "    add_edge(NOT b, a)        # if b is false, a must hold",
      "comp = tarjan_scc(graph)      # ids in reverse topo order",
      "for x in variables:",
      "    if comp[x] == comp[NOT x]: return UNSAT",
      "    value[x] = comp[x] < comp[NOT x]   # later in topo order wins",
    ],
    inputs: [
      { key: "cl", label: "clauses (a|b, use ! for NOT)", value: opts.cl || "a|b, !a|c, !b|!c, c|!d, b|d", width: 300 },
    ],
    random: () => {
      const vs = "abcd".slice(0, Viz.rand(2, 4)).split(""), n = Viz.rand(3, 6), out = [];
      for (let i = 0; i < n; i++) { const a = vs[Viz.rand(0, vs.length - 1)]; let b = vs[Viz.rand(0, vs.length - 1)]; if (b === a) b = vs[(vs.indexOf(a) + 1) % vs.length]; out.push(`${Math.random() < 0.5 ? "!" : ""}${a}|${Math.random() < 0.5 ? "!" : ""}${b}`); }
      return { cl: out.join(", ") };
    },
    build: ({ cl }) => {
      const parts = String(cl).split(/[,;]+/).map((s) => s.replace(/\s+/g, "")).filter(Boolean);
      if (!parts.length) throw new Error("Write clauses like a|b, !a|c.");
      if (parts.length > 8) throw new Error("Use at most 8 clauses.");
      const vars = [], clauses = [];
      for (const p of parts) {
        const m = p.match(/^(!?)([a-z])\|(!?)([a-z])$/);
        if (!m) throw new Error(`Cannot read "${p}". Each clause is two literals joined by |, e.g. !a|b (one lowercase letter per variable).`);
        for (const v of [m[2], m[4]]) if (!vars.includes(v)) vars.push(v);
        clauses.push([[m[2], !!m[1]], [m[4], !!m[3]]]);
      }
      if (vars.length > 5) throw new Error("Use at most 5 variables (10 literal nodes).");
      vars.sort();
      const lit = (v, neg) => (neg ? "¬" + v : v);
      const ids = vars.flatMap((v) => [v, "¬" + v]);
      const adj = Object.fromEntries(ids.map((i) => [i, []]));
      const edges = [], ekeys = new Set(), fr = [];
      const pos = [];
      vars.forEach((v, i) => { pos.push({ id: v, x: i * 100, y: 0 }); pos.push({ id: "¬" + v, x: i * 100 + (vars.length > 1 ? 0 : 0), y: 150 }); });
      const snap = (x) => ({ ids, varList: vars, pos, edges: [...edges], clauses, ...x });
      fr.push(snap({ line: [], vars: { variables: vars.length, clauses: clauses.length }, note: "Each variable gives two nodes: <b>x</b> (top row) and <b>¬x</b> (bottom row). A clause (a ∨ b) says “not both false”, which is two implications: <b>¬a → b</b> and <b>¬b → a</b>." }));
      clauses.forEach(([[a, na], [b, nb]], i) => {
        const A = lit(a, na), B = lit(b, nb), notA = lit(a, !na), notB = lit(b, !nb);
        const added = [];
        for (const [u, v] of [[notA, B], [notB, A]]) { const key = ek(u, v); if (!ekeys.has(key)) { ekeys.add(key); edges.push([u, v]); adj[u].push(v); } added.push(key); }
        fr.push(snap({ ci: i, hot: added, line: [0, 1, 2], vars: { clause: `${A} ∨ ${B}` }, note: `Clause <b>${A} ∨ ${B}</b>: if ${A} is false then ${B} must be true (<b>${notA} → ${B}</b>), and if ${B} is false then ${A} must be true (<b>${notB} → ${A}</b>). The graph is symmetric: every edge has a mirrored contrapositive.` }));
      });
      for (const k in adj) adj[k].sort(natural);
      const { comp, count } = tarjanSilent(ids, adj);
      fr.push(snap({ comp, line: [3], vars: { SCCs: count }, note: `Run any SCC algorithm. Literals in one SCC imply each other in a cycle, so they must all share one truth value. Tarjan numbers SCCs in <b>reverse topological order</b> (C0 is a sink).` }));
      const value = {}; let bad = null;
      for (const v of vars) {
        if (comp[v] === comp["¬" + v]) { bad = v; break; }
        value[v] = comp[v] < comp["¬" + v];
        fr.push(snap({ comp, value: { ...value }, focus: v, line: [4, 5, 6], vars: { x: v, [`comp[${v}]`]: `C${comp[v]}`, [`comp[¬${v}]`]: `C${comp["¬" + v]}`, [v]: value[v] ? "TRUE" : "FALSE" }, note: `${v} and ¬${v} are in different SCCs, good. Pick the literal whose SCC is <b>later in topological order</b> (smaller Tarjan id) to be TRUE: ${value[v] ? `${v}` : `¬${v}`}. Implications flow downstream, so making the downstream literal true can never force anything false later.` }));
      }
      if (bad) {
        fr.push(snap({ comp, value, bad, line: [5], vars: { x: bad, verdict: "UNSAT" }, note: `<b>${bad} and ¬${bad} are in the same SCC</b>: ${bad} ⇒ … ⇒ ¬${bad} and ¬${bad} ⇒ … ⇒ ${bad}. Either value contradicts itself, so the formula is <b>unsatisfiable</b>.` }));
      } else {
        const ok = clauses.every(([[a, na], [b, nb]]) => (value[a] !== na) || (value[b] !== nb));
        fr.push(snap({ comp, value, fin: true, line: [], vars: { verdict: ok ? "SAT" : "?", assignment: vars.map((v) => `${v}=${value[v] ? 1 : 0}`).join(" ") }, note: `Satisfiable: ${vars.map((v) => `${v} = ${value[v] ? "T" : "F"}`).join(", ")}. Check: every clause has a true literal. Whole algorithm O(V + E) for V = 2·variables, E = 2·clauses.` }));
      }
      return fr;
    },
    render: (f) => {
      const hot = new Set(f.hot || []);
      const isTrue = (id) => f.value && (id.startsWith("¬") ? f.value[id.slice(1)] === false : f.value[id] === true);
      const g = Viz.graph({ nodes: f.pos.map((p) => ({ ...p, label: p.id, sub: f.comp && p.y > 0 ? `C${f.comp[p.id]}` : undefined, top: f.comp && p.y === 0 ? `C${f.comp[p.id]}` : undefined })), edges: f.edges.map(([u, v]) => ({ u, v })) }, {
        directed: true, r: 20, label: "implication graph (top: x · bottom: ¬x)",
        nodeCls: (id) => {
          const v = id.replace("¬", "");
          if (f.bad && v === f.bad) return "bad";
          if (isTrue(id)) return "done" + (v === f.focus ? " ag-cur" : "");
          if (f.comp) return gcls(f.comp[id]) + (f.value && v in f.value ? " ag-false" : "");
          return "";
        },
        edgeCls: (k) => (hot.has(k) ? "active" : ""),
      });
      const cls = f.clauses.map(([[a, na], [b, nb]], i) => {
        const A = (na ? "¬" : "") + a, B = (nb ? "¬" : "") + b;
        const sat = f.fin ? "done" : "";
        return item(`${A} ∨ ${B}`, i === f.ci ? "active" : sat);
      });
      const asg = f.value ? chips("assignment", f.varList.filter((v) => v in f.value).map((v) => item(`${v} = ${f.value[v] ? "T" : "F"}`, f.value[v] ? "done" : ""))) : "";
      return Viz.row(g, col(chips("clauses", cls), asg, f.bad ? badge("UNSATISFIABLE", "bad") : f.fin ? badge("SATISFIABLE", "done") : ""));
    },
  }));

  /* ---------- 6. Hierholzer: Euler path / circuit ---------- */
  Viz.register(P("hierholzer"), (el, opts) => Viz.player(el, {
    title: "Hierholzer: walk until stuck, back up, splice in detours",
    tag: "EDIT THE GRAPH",
    legend: [["active", "edge just walked / node on top"], ["visit", "edges on the stack (current trail)"], ["done", "edges committed to the answer"], ["bad", "degree condition broken"]],
    codeLang: "python",
    code: [
      "start = node with out - in == 1, else any node with an edge",
      "stack, circuit = [start], []",
      "while stack:",
      "    u = stack[-1]",
      "    if adj[u]:                    # an unused edge leaves u",
      "        v = adj[u].pop()          # use it (smallest first)",
      "        stack.append(v)",
      "    else:                         # dead end: u is finished",
      "        circuit.append(stack.pop())",
      "return circuit[::-1]             # reverse = Euler path",
    ],
    inputs: [
      { key: "edges", label: "edges", value: opts.edges || "A>B,B>C,C>A,A>D,B>E,E>F,F>B", width: 300 },
      { key: "dir", label: "type", type: "select", options: ["directed", "undirected"], value: opts.dir || "directed" },
    ],
    random: () => {
      const n = Viz.rand(4, 6), L = "ABCDEFG", walk = [0];
      const set = new Set(), edges = [];
      for (let s = 0; s < Viz.rand(6, 9); s++) {
        const u = walk[walk.length - 1]; const cand = [];
        for (let v = 0; v < n; v++) if (v !== u && !set.has(`${u}>${v}`) && !set.has(`${v}>${u}`)) cand.push(v);
        if (!cand.length) break;
        const v = cand[Viz.rand(0, cand.length - 1)]; set.add(`${u}>${v}`); edges.push(`${L[u]}>${L[v]}`); walk.push(v);
      }
      return { edges: edges.sort(() => Math.random() - 0.5).join(","), dir: "directed" };
    },
    build: ({ edges, dir }) => {
      const directed = dir === "directed";
      const norm = String(edges).replace(directed ? /-/g : />/g, directed ? ">" : "-");
      const G = parseGraph(norm, directed, { maxN: 10, maxE: 16 });
      const pos = circle(G.ids), fr = [];
      const indeg = {}, outdeg = {}, deg = {};
      G.ids.forEach((x) => { indeg[x] = outdeg[x] = deg[x] = 0; });
      for (const [u, v] of G.edges) { outdeg[u]++; indeg[v]++; deg[u]++; deg[v]++; }
      const diff = Object.fromEntries(G.ids.map((x) => [x, directed ? outdeg[x] - indeg[x] : deg[x] % 2]));
      let start = null, ok = true, why = "";
      if (directed) {
        const plus = G.ids.filter((x) => diff[x] === 1), minus = G.ids.filter((x) => diff[x] === -1), wild = G.ids.filter((x) => Math.abs(diff[x]) > 1);
        if (wild.length || plus.length > 1 || minus.length > 1 || plus.length !== minus.length) { ok = false; why = `need every node balanced (out = in), except at most one start with out − in = +1 and one end with −1. Broken at: ${G.ids.filter((x) => diff[x] !== 0).map((x) => `${x} (${diff[x] > 0 ? "+" : ""}${diff[x]})`).join(", ")}`; }
        start = plus[0] ?? G.ids.find((x) => outdeg[x] > 0);
      } else {
        const odd = G.ids.filter((x) => deg[x] % 2);
        if (odd.length !== 0 && odd.length !== 2) { ok = false; why = `need 0 or 2 odd-degree nodes, found ${odd.length}: ${odd.join(", ")}`; }
        start = odd[0] ?? G.ids.find((x) => deg[x] > 0);
      }
      const kind = directed ? (G.ids.some((x) => diff[x] !== 0) ? "path" : "circuit") : (G.ids.some((x) => deg[x] % 2) ? "path" : "circuit");
      const used = new Set(), out = Object.fromEntries(G.ids.map((x) => [x, []]));
      G.edges.forEach(([u, v], i) => { out[u].push([v, i]); if (!directed) out[v].push([u, i]); });
      for (const k in out) out[k].sort((a, b) => natural(a[0], b[0]));
      const stack = [[start, -1]], circuit = [], estate = {};
      const left = (x) => out[x].filter(([, i]) => !used.has(i)).length;
      const snap = (x) => ({ G, pos, diff, indeg, outdeg, deg, directed, stack: stack.map((s) => s[0]), circuit: [...circuit], estate: { ...estate }, left: Object.fromEntries(G.ids.map((id) => [id, left(id)])), ...x });
      fr.push(snap({ check: true, line: [0], vars: { edges: G.edges.length, start: start ?? "—" }, note: directed
        ? `Check degrees first. An Euler ${kind} uses every edge once, so each pass through a node uses one edge in and one out. Every node must be balanced, except the <b>start (out − in = +1)</b> and the <b>end (−1)</b> of a path. ${ok ? `OK: start at <b>${start}</b>.` : `<b>Fails</b>: ${why}.`}`
        : `Check degrees first. Each pass through a node uses two edges, so all degrees must be even, except the two endpoints of a path. ${ok ? `OK: start at <b>${start}</b>.` : `<b>Fails</b>: ${why}.`}` }));
      if (!ok) { fr.push(snap({ check: true, bad: true, line: [], vars: { result: "no Euler path" }, note: `No Euler path exists. (Degree parity is necessary; the other condition is that all edges lie in one connected piece.)` })); return fr; }
      fr.push(snap({ line: [1], vars: { stack: start }, note: `Push ${start}. The stack is the trail we are currently walking; the circuit list collects nodes in the order they become <b>dead ends</b>.` }));
      let steps = 0;
      while (stack.length && steps++ < 200) {
        const [u] = stack[stack.length - 1];
        const nxt = out[u].find(([, i]) => !used.has(i));
        if (nxt) {
          const [v, i] = nxt; used.add(i); estate[i] = "trail"; stack.push([v, i]);
          fr.push(snap({ u: v, cur: i, line: [3, 4, 5, 6], vars: { u, v, stack: stack.map((s) => s[0]).join(" ") }, note: `${u} still has an unused edge: walk ${u}${directed ? "→" : "–"}${v} (smallest label first) and push ${v}. We do not plan ahead; we just keep walking.` }));
        } else {
          const [x, i] = stack.pop(); circuit.push(x); if (i >= 0) estate[i] = "done";
          const top = stack.length ? stack[stack.length - 1][0] : null;
          const detour = top !== null && left(top) > 0;
          fr.push(snap({ u: x, cur: i >= 0 ? i : undefined, popped: true, line: [3, 7, 8], vars: { u: x, circuit: circuit.join(" "), stack: stack.map((s) => s[0]).join(" ") || "—" }, note: `${x} has no unused edges: it is a <b>dead end</b>, so it must come at this position from the end of the answer. Pop it into the circuit.${detour ? ` Now ${top} is on top and still has unused edges: the walk will continue from ${top} and the loop it finds gets <b>spliced in</b> here.` : ""}` }));
        }
      }
      const ans = [...circuit].reverse();
      const complete = ans.length === G.edges.length + 1;
      fr.push(snap({ fin: true, ans, line: [9], vars: { answer: ans.join(" "), length: ans.length }, note: complete
        ? `Reverse the circuit: <b>${ans.join(" → ")}</b>. It uses all ${G.edges.length} edges once. Each edge is pushed and popped once: <b>O(E)</b> (plus sorting for the smallest-first order).`
        : `The circuit has only ${ans.length - 1} of ${G.edges.length} edges: the edges are not all in one connected piece, so <b>no Euler ${kind}</b> exists even though the degrees are fine.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const idxOf = new Map(G.edges.map(([u, v], i) => [f.directed ? ek(u, v) : uk(u, v), i]));
      const graph = drawGraph(G, f.pos, {
        sub: (id) => (f.check ? `${f.directed ? (f.diff[id] > 0 ? "+" : "") + f.diff[id] : "deg " + f.deg[id]}` : `${f.left[id]} left`),
        nodeCls: (id) => (f.check && (f.directed ? f.diff[id] !== 0 : f.deg[id] % 2) ? (f.bad ? "bad" : "path") : id === f.u ? "active" : f.stack.includes(id) ? "visit" : f.circuit.includes(id) ? "done" : ""),
        edgeCls: (k) => { const [a, b] = k.split("-"); const i = idxOf.get(f.directed ? k : uk(a, b)); return i === f.cur ? "active" : f.estate[i] === "trail" ? "visit" : f.estate[i] === "done" ? "done" : ""; },
        label: f.check ? (f.directed ? "below: out − in" : "below: degree") : "below: unused edges left",
      });
      if (f.check) {
        const rows = f.directed ? [["in", f.indeg], ["out", f.outdeg], ["out−in", f.diff]] : [["degree", f.deg]];
        return Viz.row(graph, col(nodeTable(G.ids, rows, { label: "degree check", cls: (r, id) => ((f.directed ? f.diff[id] !== 0 : f.deg[id] % 2) ? (f.bad ? "bad" : "path") : "done") }), f.bad ? badge("no Euler path", "bad") : ""));
      }
      const st = Viz.stack(f.stack, { label: "stack (trail)", cls: (i) => (i === f.stack.length - 1 ? "active" : "visit") });
      const circ = Viz.array(f.circuit.length ? f.circuit : ["·"], { label: "circuit (dead-end order)", cls: () => (f.circuit.length ? "done" : "") });
      const ans = f.fin ? Viz.array(f.ans, { label: "answer = reversed circuit", cls: () => "path" }) : "";
      return Viz.row(graph, col(Viz.row(st, circ), ans));
    },
  }));

  /* Custom SVG graph that supports self-loops (needed for de Bruijn graphs). */
  function loopGraph(nodes, edges, o = {}) {
    const r = o.r || 22, pos = new Map(nodes.map((n) => [n.id, n]));
    const cx = nodes.reduce((s, n) => s + n.x, 0) / nodes.length, cy = nodes.reduce((s, n) => s + n.y, 0) / nodes.length;
    const has = new Set(edges.map((e) => `${e.u}|${e.v}`));
    const arrow = (tx, ty, ax, ay, c) => { const al = Math.hypot(ax, ay) || 1, vx = ax / al, vy = ay / al; return `<polygon class="ah ${c}" points="${tx},${ty} ${tx - vx * 10 - vy * 5},${ty - vy * 10 + vx * 5} ${tx - vx * 10 + vy * 5},${ty - vy * 10 - vx * 5}"/>`; };
    const parts = edges.map((e) => {
      const a = pos.get(e.u), b = pos.get(e.v), c = e.cls || "";
      if (e.u === e.v) {
        let dx = a.x - cx, dy = a.y - cy; const L = Math.hypot(dx, dy) || 1; dx /= L; dy /= L;
        const rot = (t, d) => [a.x + d * (dx * Math.cos(t) - dy * Math.sin(t)), a.y + d * (dx * Math.sin(t) + dy * Math.cos(t))];
        const [x1, y1] = rot(-0.5, r), [x2, y2] = rot(0.5, r + 2), [c1x, c1y] = rot(-0.75, r + 46), [c2x, c2y] = rot(0.75, r + 46), [lx, ly] = rot(0, r + 44);
        return `<path class="e ${c}" d="M${x1},${y1} C${c1x},${c1y} ${c2x},${c2y} ${x2},${y2}"/>${arrow(x2, y2, x2 - c2x, y2 - c2y, c)}<text class="ew" x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="central">${esc(e.w)}</text>`;
      }
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const curved = has.has(`${e.v}|${e.u}`), off = curved ? 16 : 0, nx = -uy * off, ny = ux * off;
      const x1 = a.x + ux * r + nx * 0.5, y1 = a.y + uy * r + ny * 0.5, x2 = b.x - ux * (r + 2) + nx * 0.5, y2 = b.y - uy * (r + 2) + ny * 0.5;
      const mx = (a.x + b.x) / 2 + nx * 1.4, my = (a.y + b.y) / 2 + ny * 1.4;
      return `<path class="e ${c}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>${arrow(x2, y2, x2 - mx, y2 - my, c)}<text class="ew" x="${(a.x + b.x) / 2 + nx * 1.2 - uy * 9 * (curved ? 0 : 1)}" y="${(a.y + b.y) / 2 + ny * 1.2 + ux * 9 * (curved ? 0 : 1)}" text-anchor="middle" dominant-baseline="central">${esc(e.w)}</text>`;
    }).join("");
    const ns = nodes.map((n) => `<g class="n ${o.nodeCls ? o.nodeCls(n.id) : ""}" transform="translate(${n.x},${n.y})"><circle r="${r}"/><text>${esc(n.label ?? n.id)}</text></g>`).join("");
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y), pad = r + 60;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad, w = Math.max(...xs) - Math.min(...xs) + 2 * pad, h = Math.max(...ys) - Math.min(...ys) + 2 * pad;
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="v-graph" viewBox="${minX} ${minY} ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(o.label || "graph")}">${parts}${ns}</svg></div>`;
  }

  /* ---------- 7. Cracking the safe: de Bruijn sequence via Hierholzer ---------- */
  Viz.register(P("debruijn"), (el, opts) => Viz.player(el, {
    title: "Cracking the Safe: an Euler circuit in the de Bruijn graph",
    tag: "CHOOSE n AND k",
    legend: [["active", "edge being tried"], ["visit", "edge used (password typed)"], ["done", "edge finished (digit emitted)"]],
    codeLang: "python",
    code: [
      "# node = last n-1 digits typed; edge = one more digit",
      "def dfs(node):",
      "    for d in range(k):",
      "        pw = node + str(d)          # an n-digit password",
      "        if pw not in seen:",
      "            seen.add(pw)",
      "            dfs(pw[1:])             # slide the window",
      "            out.append(str(d))      # post-order, like Hierholzer",
      "dfs('0' * (n - 1))",
      "return '0' * (n - 1) + ''.join(reversed(out))",
    ],
    inputs: [
      { key: "n", label: "n (password length)", value: opts.n || "3", width: 60 },
      { key: "k", label: "k (digits 0..k-1)", value: opts.k || "2", width: 60 },
    ],
    random: () => { const c = [[2, 2], [2, 3], [3, 2], [2, 4], [4, 2], [3, 3]][Viz.rand(0, 5)]; return { n: String(c[0]), k: String(c[1]) }; },
    build: ({ n, k }) => {
      n = Viz.parse.int(n, { min: 2, max: 4 }); k = Viz.parse.int(k, { min: 2, max: 4 });
      const V = k ** (n - 1), E = k ** n;
      if (V > 9 || E > 27) throw new Error(`k^(n-1) = ${V} nodes and k^n = ${E} edges is too big to draw; try n=3,k=2 or n=2,k=3.`);
      const names = [];
      const gen = (p) => { if (p.length === n - 1) { names.push(p); return; } for (let d = 0; d < k; d++) gen(p + d); };
      gen("");
      const pts = Viz.layout.circle(names, V <= 2 ? 70 : Math.max(95, V * 24));
      const nodes = pts.map((p) => ({ ...p, label: p.id }));
      const edges = []; for (const u of names) for (let d = 0; d < k; d++) edges.push({ u, v: (u + d).slice(1), w: String(d), pw: u + d });
      const seen = new Set(), done = new Set(), out = [], fr = [], call = [];
      const start = "0".repeat(n - 1);
      const snap = (x) => ({ n, k, nodes, edges, seen: new Set(seen), done: new Set(done), out: [...out], call: [...call], ...x });
      fr.push(snap({ line: [0], vars: { nodes: V, edges: E }, note: `Each <b>node</b> is the last ${n - 1} digit${n > 2 ? "s" : ""} typed. Typing digit d moves from node s to s[1:] + d, and that <b>edge is the password</b> s + d. All ${E} passwords = all ${E} edges. Every node has ${k} edges out and ${k} in (balanced), so an <b>Euler circuit</b> exists: a typing sequence that tries every password exactly once, of length ${E} + ${n - 1} = ${E + n - 1}.` }));
      const dfs = (node) => {
        call.push(node);
        for (let d = 0; d < k; d++) {
          const pw = node + d;
          if (seen.has(pw)) { fr.push(snap({ u: node, cur: pw, line: [2, 3, 4], vars: { node, d, pw }, note: `Password ${pw} was already typed: skip.` })); continue; }
          seen.add(pw);
          fr.push(snap({ u: node, cur: pw, line: [3, 4, 5, 6], vars: { node, d, pw, next: pw.slice(1) }, note: `Type <b>${d}</b>: the last ${n} digits are <b>${pw}</b>, a new password. Slide the window to node ${pw.slice(1)} and keep going.` }));
          dfs(pw.slice(1));
          out.push(String(d)); done.add(pw);
          fr.push(snap({ u: node, cur: pw, line: [7], vars: { node, emitted: out.join("") }, note: `Everything reachable after ${pw} is exhausted, so edge ${pw} is final: emit digit ${d} (post-order). Exactly Hierholzer's “pop when stuck”.` }));
        }
        call.pop();
      };
      dfs(start);
      const ans = start + [...out].reverse().join("");
      const wins = new Set(); for (let i = 0; i + n <= ans.length; i++) wins.add(ans.slice(i, i + n));
      fr.push(snap({ fin: true, ans, line: [9], vars: { answer: ans, length: ans.length, "distinct windows": wins.size }, note: `Answer <b>${ans}</b> (length ${ans.length} = k<sup>n</sup> + n − 1, the minimum possible). Slide a window of ${n} along it and you see all ${wins.size} passwords, each once.` }));
      return fr;
    },
    render: (f) => {
      const es = f.edges.map((e) => ({ ...e, cls: e.pw === f.cur ? "active" : f.done.has(e.pw) ? "done" : f.seen.has(e.pw) ? "visit" : "" }));
      const g = loopGraph(f.nodes, es, { r: 22, label: `de Bruijn graph B(k=${f.k}, n=${f.n}); edge label = digit typed`, nodeCls: (id) => (id === f.u ? "active" : f.call.includes(id) ? "visit" : "") });
      const emitted = Viz.array(f.out.length ? f.out : ["·"], { label: "emitted digits (post-order)", cls: () => (f.out.length ? "done" : "") });
      let ans = "";
      if (f.fin) {
        const chars = f.ans.split("");
        ans = Viz.array(chars, { label: `answer: every window of ${f.n} is a new password`, window: [0, f.n - 1], cls: (i) => (i < f.n - 1 ? "path" : "") });
      }
      return Viz.row(g, col(badge(`typed: ${f.seen.size} / ${f.k ** f.n} passwords`, f.seen.size === f.k ** f.n ? "done" : ""), emitted, ans));
    },
  }));

  /* ---------- 8. Kuhn's augmenting paths (bipartite matching) ---------- */
  Viz.register(P("kuhn"), (el, opts) => Viz.player(el, {
    title: "Bipartite matching (Kuhn): find an augmenting path, flip it",
    tag: "EDIT THE BIPARTITE GRAPH",
    legend: [["done", "matched edge"], ["active", "current try"], ["visit", "right node visited this round"], ["path", "augmenting path (about to flip)"]],
    codeLang: "python",
    code: [
      "def try_kuhn(u):",
      "    for v in adj[u]:",
      "        if v in visited: continue",
      "        visited.add(v)",
      "        if match[v] is None or try_kuhn(match[v]):",
      "            match[v] = u            # flip along the path",
      "            return True",
      "    return False",
      "for u in left:",
      "    visited = set()",
      "    if try_kuhn(u): size += 1",
    ],
    inputs: [
      { key: "edges", label: "edges (left letter - right digit)", value: opts.edges || "a-1,a-2,b-2,b-3,c-3,c-4,d-1", width: 300 },
    ],
    random: () => {
      const L = Viz.rand(3, 5), R = Viz.rand(3, 5), out = new Set();
      for (let i = 0; i < L; i++) { const deg = Viz.rand(1, 2); for (let j = 0; j < deg; j++) out.add(`${"abcde"[i]}-${Viz.rand(1, R)}`); }
      return { edges: [...out].join(",") };
    },
    build: ({ edges }) => {
      const toks = String(edges).split(/[,;\s]+/).filter(Boolean);
      if (!toks.length) throw new Error("Enter edges like a-1,b-2.");
      const adj = {}, Rs = new Set(), elist = [], keys = new Set();
      for (const t of toks) {
        const m = t.match(/^([a-z])-(\d)$/);
        if (!m) throw new Error(`Cannot read "${t}". Use left-letter dash right-digit, e.g. a-1.`);
        if (keys.has(t)) throw new Error(`Edge "${t}" appears twice.`);
        keys.add(t); (adj[m[1]] ||= []).push(m[2]); Rs.add(m[2]); elist.push([m[1], m[2]]);
      }
      const Ls = Object.keys(adj).sort(), Rl = [...Rs].sort(natural);
      if (Ls.length > 6 || Rl.length > 6) throw new Error("Use at most 6 nodes per side.");
      for (const u of Ls) adj[u].sort(natural);
      const pos = [...Ls.map((u, i) => ({ id: u, x: 0, y: i * 66 })), ...Rl.map((v, i) => ({ id: v, x: 250, y: i * 66 }))];
      const match = {}, fr = [];
      let visited = new Set(), trail = [], size = 0;
      const snap = (x) => ({ Ls, Rl, pos, elist, match: { ...match }, visited: new Set(visited), trail: [...trail], size, ...x });
      fr.push(snap({ line: [], vars: { size }, note: "Left nodes want a partner on the right; each node may be used once. Kuhn's idea: give each left node a turn. If its partner is taken, ask the current owner to <b>move to another free option</b>, recursively. A successful chain is an <b>augmenting path</b>: it alternates free / matched edges and ends at a free right node." }));
      const tryK = (u) => {
        for (const v of adj[u]) {
          if (visited.has(v)) { fr.push(snap({ u, cur: `${u}-${v}`, line: [1, 2], vars: { u, v }, note: `${v} was already visited this round: it is either part of the current chain or already failed. Skip (this is what keeps one round O(E)).` })); continue; }
          visited.add(v); trail.push(`${u}-${v}`);
          if (match[v] === undefined) {
            fr.push(snap({ u, cur: `${u}-${v}`, aug: [...trail], line: [3, 4], vars: { u, v, "match[v]": "free" }, note: `${v} is <b>free</b>. The chain ${trail.map((k) => k.replace("-", "→")).join(", ")} is an augmenting path. Flip it: every free edge on it becomes matched and every matched edge becomes free. Matching size grows by 1.` }));
            match[v] = u; trail.pop();
            return true;
          }
          const w = match[v];
          fr.push(snap({ u, cur: `${u}-${v}`, line: [3, 4], vars: { u, v, "match[v]": w }, note: `${v} is taken by <b>${w}</b>. Ask ${w} to find another partner: recurse into try_kuhn(${w}). The chain grows along the matched edge ${v}–${w}.` }));
          trail.push(`${w}-${v}`);
          if (tryK(w)) {
            trail.pop();
            match[v] = u; trail.pop();
            fr.push(snap({ u, cur: `${u}-${v}`, line: [5, 6], vars: { u, v, "match[v]": u }, note: `${w} moved, so ${v} is free for ${u}: match[${v}] = ${u}. The flip unwinds back up the recursion.` }));
            return true;
          }
          trail.pop(); trail.pop();
          fr.push(snap({ u, cur: `${u}-${v}`, line: [4], vars: { u, v }, note: `${w} could not move. ${u} tries its next option.` }));
        }
        return false;
      };
      for (const u of Ls) {
        visited = new Set(); trail = [];
        fr.push(snap({ u, line: [8, 9], vars: { u, size }, note: `Round for <b>${u}</b>: clear visited and look for an augmenting path starting at ${u}.` }));
        const ok = tryK(u);
        if (ok) size++;
        fr.push(snap({ u, line: [10], vars: { u, found: ok, size }, note: ok ? `Augmented: matching size is now <b>${size}</b>.` : `No augmenting path from ${u}. By Berge's theorem, a left node that fails now will never succeed later, so we move on.` }));
      }
      fr.push(snap({ fin: true, line: [], vars: { "max matching": size }, note: `Maximum matching = <b>${size}</b>. One DFS per left node, each O(E): <b>O(V·E)</b>. König's theorem: in a bipartite graph this also equals the minimum vertex cover.` }));
      return fr;
    },
    render: (f) => {
      const matched = new Set(Object.entries(f.match).map(([v, u]) => `${u}-${v}`));
      const aug = new Set(f.aug || []), trail = new Set(f.trail);
      const g = Viz.graph({ nodes: f.pos.map((p) => ({ ...p, label: p.id })), edges: f.elist.map(([u, v]) => ({ u, v })) }, {
        r: 19, label: "left (letters) · right (digits)",
        nodeCls: (id) => (id === f.u ? "active" : f.visited.has(id) ? "visit" : (f.Ls.includes(id) ? Object.values(f.match).includes(id) : f.match[id] !== undefined) ? "done" : ""),
        edgeCls: (k) => (aug.has(k) ? "path" : k === f.cur ? "active" : trail.has(k) ? "visit" : matched.has(k) ? "done" : ""),
      });
      const tbl = Viz.grid([f.Rl.map((v) => f.match[v] ?? "·")], { label: "match[right] = left", colLabels: f.Rl, rowLabels: ["owner"], cls: (r, c) => (f.match[f.Rl[c]] !== undefined ? "done" : "") });
      return Viz.row(g, col(tbl, badge(`matching size = ${f.size}`, f.fin ? "done" : "")));
    },
  }));

  /* ---------- flow helpers ---------- */
  function parseNetwork(edges) {
    const G = parseGraph(edges, true, { maxN: 8, maxE: 14, weighted: true, noAnti: true });
    if (!("s" in G.adj) || !("t" in G.adj)) throw new Error("The network needs a source node named s and a sink node named t.");
    const cap = {}, res = {}, nb = Object.fromEntries(G.ids.map((x) => [x, []]));
    for (const [u, v, w] of G.edges) {
      cap[ek(u, v)] = w; res[ek(u, v)] = w; res[ek(v, u)] = 0;
      nb[u].push(v); nb[v].push(u);
    }
    for (const k in nb) nb[k] = [...new Set(nb[k])].sort(natural);
    /* layered layout: column = BFS distance from s over original edges; t last */
    const d = { s: 0 }, q = ["s"];
    while (q.length) { const u = q.shift(); for (const v of G.adj[u]) if (!(v in d)) { d[v] = d[u] + 1; q.push(v); } }
    let maxd = 0; for (const x of G.ids) if (x !== "t" && x in d) maxd = Math.max(maxd, d[x]);
    const colOf = (x) => (x === "t" ? maxd + 1 : x in d ? d[x] : 1);
    const cols = {};
    for (const x of G.ids) (cols[colOf(x)] ||= []).push(x);
    const pos = [];
    for (const [c, arr] of Object.entries(cols)) arr.forEach((x, j) => pos.push({ id: x, x: Number(c) * 118, y: (j - (arr.length - 1) / 2) * 86 }));
    return { G, cap, res, nb, pos };
  }
  const flowOf = (N, u, v) => N.cap[ek(u, v)] - N.res[ek(u, v)];
  function residualEdges(N) {
    const out = [];
    for (const [u, v] of N.G.edges) {
      if (N.res[ek(u, v)] > 0) out.push([u, v, N.res[ek(u, v)], "fwd"]);
      if (N.res[ek(v, u)] > 0) out.push([v, u, N.res[ek(v, u)], "back"]);
    }
    return out;
  }
  function drawNetwork(N, o = {}) {
    return drawGraph(N.G, N.pos, {
      w: (u, v) => `${flowOf(N, u, v)}/${N.cap[ek(u, v)]}`,
      nodeCls: o.nodeCls, edgeCls: o.edgeCls, top: o.top, label: o.label || "network (edge label: flow / capacity)", r: 19,
    });
  }
  function drawResidual(N, o = {}) {
    const re = residualEdges(N);
    const kinds = Object.fromEntries(re.map(([u, v, , k]) => [ek(u, v), k]));
    return Viz.graph({ nodes: N.pos.map((p) => ({ ...p, label: p.id })), edges: re.map(([u, v, w]) => ({ u, v, w })) }, {
      directed: true, r: 19, label: o.label || "residual graph (dashed = undo edge)",
      nodeCls: o.nodeCls,
      edgeCls: (k) => (o.edgeCls && o.edgeCls(k)) || (kinds[k] === "back" ? "ag-undo" : ""),
    });
  }
  const pathKeys = (path) => { const s = new Set(); for (let i = 0; i + 1 < path.length; i++) s.add(ek(path[i], path[i + 1])); return s; };
  const onPath = (keys, k) => { const [a, b] = k.split("-"); return keys.has(k) || keys.has(ek(b, a)); };

  /* ---------- 9. Edmonds-Karp max flow + min cut ---------- */
  Viz.register(P("maxflow"), (el, opts) => Viz.player(el, {
    title: "Max flow (Edmonds-Karp): BFS in the residual graph, push the bottleneck, repeat",
    tag: "EDIT THE NETWORK",
    legend: [["path", "augmenting path"], ["active", "edges changed by the push"], ["done", "min cut: source side S"], ["bad", "cut edges (saturated)"]],
    codeLang: "python",
    code: [
      "flow = 0",
      "while True:",
      "    parent = bfs(s, t)        # only edges with residual > 0",
      "    if t not in parent: break # no augmenting path left",
      "    b = min(res[u][v] for u, v in path)",
      "    for u, v in path:",
      "        res[u][v] -= b        # use capacity",
      "        res[v][u] += b        # create an undo edge",
      "    flow += b",
      "# min cut: S = nodes the last BFS reached",
    ],
    inputs: [
      { key: "edges", label: "edges u>v:capacity (needs s and t)", value: opts.edges || "s>a:10,s>b:10,a>b:2,a>c:4,a>d:8,b>d:9,d>c:6,c>t:10,d>t:10", width: 420 },
    ],
    random: () => {
      const mids = ["a", "b", "c", "d"].slice(0, Viz.rand(2, 4)), set = new Set(), out = [];
      const add = (u, v) => { if (u === v || set.has(`${u}>${v}`) || set.has(`${v}>${u}`)) return; set.add(`${u}>${v}`); out.push(`${u}>${v}:${Viz.rand(1, 12)}`); };
      mids.forEach((m, i) => { if (i < 2 || Math.random() < 0.5) add("s", m); if (i >= mids.length - 2 || Math.random() < 0.5) add(m, "t"); });
      for (let i = 0; i < mids.length + 1; i++) add(mids[Viz.rand(0, mids.length - 1)], mids[Viz.rand(0, mids.length - 1)]);
      return { edges: out.join(",") };
    },
    build: ({ edges }) => {
      const N = parseNetwork(edges), fr = [];
      let flow = 0, it = 0;
      const snap = (x) => ({ N: { ...N, res: { ...N.res } }, flow, ...x });
      fr.push(snap({ line: [0], vars: { flow }, note: "Each edge carries flow ≤ capacity, and every node except s and t passes on exactly what it receives. The <b>residual graph</b> (below) shows what can still change: a forward edge with the spare capacity, and a dashed <b>undo edge</b> for every unit of flow already sent." }));
      while (it++ < 30) {
        const parent = { s: null }, q = ["s"];
        while (q.length && !("t" in parent)) { const u = q.shift(); for (const v of N.nb[u]) if (!(v in parent) && N.res[ek(u, v)] > 0) { parent[v] = u; q.push(v); } }
        const reached = new Set(Object.keys(parent));
        if (!("t" in parent)) {
          const cut = N.G.edges.filter(([u, v]) => reached.has(u) && !reached.has(v)).map(([u, v]) => ek(u, v));
          const cutSum = cut.reduce((s, k) => s + N.cap[k], 0);
          fr.push(snap({ reached, cut, fin: true, line: [2, 3, 9], vars: { flow, "cut capacity": cutSum, S: [...reached].sort(natural).join(",") }, note: `BFS can no longer reach t: <b>max flow = ${flow}</b>. The nodes it did reach form S (green). Every edge from S to the rest is <b>saturated</b> (red) and every edge back into S carries 0, so all flow crosses this cut: cut capacity ${cut.map((k) => N.cap[k]).join(" + ")} = <b>${cutSum}</b> = max flow. That is the <b>max-flow min-cut theorem</b>, and it is how you read off a minimum cut.` }));
          break;
        }
        const path = ["t"]; while (path[0] !== "s") path.unshift(parent[path[0]]);
        const keys = pathKeys(path);
        const b = Math.min(...[...keys].map((k) => N.res[k]));
        fr.push(snap({ path, keys, reached, line: [2, 4], vars: { flow, path: path.join("→"), bottleneck: b }, note: `BFS finds the <b>shortest</b> path with spare capacity: ${path.join(" → ")}. Its tightest residual edge allows <b>${b}</b>. ${path.some((x, i) => i && N.cap[ek(path[i - 1], x)] === undefined) ? "It uses an <b>undo edge</b>: some earlier flow gets rerouted, which is how the algorithm fixes greedy mistakes." : ""}` }));
        for (const k of keys) { const [u, v] = k.split("-"); N.res[k] -= b; N.res[ek(v, u)] += b; }
        flow += b;
        fr.push(snap({ path, keys, changed: true, line: [5, 6, 7, 8], vars: { flow, pushed: b }, note: `Push ${b}: each path edge loses ${b} residual and its reverse gains ${b}. ${path.some((x, i) => i && N.cap[ek(path[i - 1], x)] === undefined) ? "On the undo edge, that cancels flow already sent the other way. " : ""}Total flow = <b>${flow}</b>. Using shortest paths bounds the number of rounds by O(V·E), so Edmonds-Karp is <b>O(V·E²)</b>.` }));
      }
      return fr;
    },
    render: (f) => {
      const N = f.N, keys = f.keys || new Set(), cut = new Set(f.cut || []);
      const nodeCls = (id) => (f.fin ? (f.reached.has(id) ? "done" : "visit") : f.path && f.path.includes(id) ? "path" : "");
      const net = drawNetwork(N, { nodeCls, edgeCls: (k) => (cut.has(k) ? "bad" : onPath(keys, k) ? (f.changed ? "active" : "path") : "") });
      const resG = drawResidual(N, { nodeCls: (id) => (f.reached && f.reached.has(id) && !f.path ? "done" : f.reached && f.reached.has(id) ? "visit" : ""), edgeCls: (k) => (keys.has(k) ? (f.changed ? "active" : "path") : "") });
      return Viz.row(net, resG, col(badge(`flow = ${f.flow}`, f.fin ? "done" : "")));
    },
  }));

  /* ---------- 10. Dinic: level graph + blocking flow ---------- */
  Viz.register(P("dinic"), (el, opts) => Viz.player(el, {
    title: "Dinic at a glance: BFS levels, then push many paths per phase",
    tag: "EDIT THE NETWORK",
    legend: [["visit", "level-graph edge (level +1, residual > 0)"], ["path", "path found by DFS"], ["dim", "not in the level graph"], ["bad", "dead edge (pointer moved past)"]],
    codeLang: "python",
    code: [
      "while bfs_levels(s):           # level = BFS distance in residual",
      "    it = {u: 0 for u in nodes} # current-arc pointers",
      "    while (f := dfs(s, INF)) > 0:",
      "        flow += f",
      "def dfs(u, pushed):",
      "    if u == t: return pushed",
      "    while it[u] < len(adj[u]):",
      "        v = adj[u][it[u]]",
      "        if res[u][v] > 0 and level[v] == level[u] + 1:",
      "            d = dfs(v, min(pushed, res[u][v]))",
      "            if d: res[u][v] -= d; res[v][u] += d; return d",
      "        it[u] += 1              # never look at this edge again this phase",
      "    return 0",
    ],
    inputs: [
      { key: "edges", label: "edges u>v:capacity (needs s and t)", value: opts.edges || "s>a:10,s>b:10,a>b:2,a>c:4,a>d:8,b>d:9,d>c:6,c>t:10,d>t:10", width: 420 },
    ],
    random: () => {
      const mids = ["a", "b", "c", "d"].slice(0, Viz.rand(2, 4)), set = new Set(), out = [];
      const add = (u, v) => { if (u === v || set.has(`${u}>${v}`) || set.has(`${v}>${u}`)) return; set.add(`${u}>${v}`); out.push(`${u}>${v}:${Viz.rand(1, 12)}`); };
      mids.forEach((m, i) => { if (i < 2 || Math.random() < 0.5) add("s", m); if (i >= mids.length - 2 || Math.random() < 0.5) add(m, "t"); });
      for (let i = 0; i < mids.length + 1; i++) add(mids[Viz.rand(0, mids.length - 1)], mids[Viz.rand(0, mids.length - 1)]);
      return { edges: out.join(",") };
    },
    build: ({ edges }) => {
      const N = parseNetwork(edges), fr = [];
      let flow = 0, phase = 0, level = {}, dead = new Set();
      const snap = (x) => ({ N: { ...N, res: { ...N.res } }, flow, phase, level: { ...level }, dead: new Set(dead), ...x });
      fr.push(snap({ line: [], vars: { flow }, note: "Edmonds-Karp runs a fresh BFS for every single path. Dinic runs one BFS per <b>phase</b>, keeps only edges that go exactly one level deeper (the <b>level graph</b>), and pushes as many paths as fit through it before the next BFS." }));
      while (phase < 12) {
        level = { s: 0 }; const q = ["s"];
        while (q.length) { const u = q.shift(); for (const v of N.nb[u]) if (!(v in level) && N.res[ek(u, v)] > 0) { level[v] = level[u] + 1; q.push(v); } }
        dead = new Set();
        if (!("t" in level)) { fr.push(snap({ fin: true, line: [0], vars: { flow, phases: phase }, note: `BFS cannot reach t: done. <b>Max flow = ${flow}</b> after ${phase} phase${phase === 1 ? "" : "s"}. Each phase strictly increases dist(s, t), so there are at most V phases; total O(V²·E), and O(E·√V) on unit-capacity graphs such as bipartite matching (that is Hopcroft-Karp).` })); break; }
        phase++;
        fr.push(snap({ showLevels: true, line: [0, 1], vars: { phase, "level[t]": level.t, flow }, note: `Phase ${phase}: BFS labels every node with its distance from s in the residual graph (L0, L1, ...). Only edges going from level i to level i+1 are usable this phase (blue). Every s→t path in it is a <b>shortest</b> path.` }));
        const it = Object.fromEntries(N.G.ids.map((x) => [x, 0]));
        const dfs = (u, pushed, path) => {
          if (u === "t") return pushed;
          while (it[u] < N.nb[u].length) {
            const v = N.nb[u][it[u]];
            if (N.res[ek(u, v)] > 0 && level[v] === level[u] + 1) {
              path.push(v);
              const d = dfs(v, Math.min(pushed, N.res[ek(u, v)]), path);
              if (d) { N.res[ek(u, v)] -= d; N.res[ek(v, u)] += d; return d; }
              path.pop();
            }
            if (level[v] === level[u] + 1 && N.res[ek(u, v)] >= 0) dead.add(ek(u, v));
            it[u]++;
          }
          return 0;
        };
        let pushedAny = 0;
        while (true) {
          const path = ["s"], before = { ...N.res };
          const d = dfs("s", Infinity, path);
          if (!d) break;
          flow += d; pushedAny += d;
          fr.push(snap({ showLevels: true, path, keys: pathKeys(path), line: [2, 3, 9, 10], vars: { phase, path: path.join("→"), pushed: d, flow }, note: `DFS walks down the level graph and finds ${path.join(" → ")}; push its bottleneck <b>${d}</b>. Current-arc pointers mean an edge that led nowhere is never retried in this phase.` }));
          void before;
        }
        fr.push(snap({ showLevels: true, blocked: true, line: [11, 12], vars: { phase, "pushed this phase": pushedAny, flow }, note: `No s→t path is left in this level graph: the flow is <b>blocking</b>. Saturated or dead-end edges (red) block every shortest path, so the next BFS must find t <b>farther</b> away (or not at all).` }));
      }
      return fr;
    },
    render: (f) => {
      const N = f.N, keys = f.keys || new Set();
      const inLevel = (k) => { const [u, v] = k.split("-"); return f.level[u] !== undefined && f.level[v] === f.level[u] + 1 && N.res[k] > 0; };
      const net = drawNetwork(N, {
        top: (id) => (f.showLevels ? (f.level[id] !== undefined ? `L${f.level[id]}` : "L∞") : undefined),
        nodeCls: (id) => (f.path && f.path.includes(id) ? "path" : f.showLevels && f.level[id] === undefined ? "dim" : ""),
        edgeCls: (k) => (!f.showLevels ? "" : keys.has(k) ? "path" : f.blocked && f.dead.has(k) ? "bad" : inLevel(k) ? "visit" : "dim"),
        label: "network (flow / capacity) · above: BFS level",
      });
      return Viz.row(net, col(badge(`phase ${f.phase}`, "visit"), badge(`flow = ${f.flow}`, f.fin ? "done" : "")));
    },
  }));

  /* ---------- grid helpers ---------- */
  function parseRows(text, allowed, { maxR = 7, maxC = 10, minR = 1 } = {}) {
    const rows = String(text).split(/;|\n/).map((r) => r.replace(/[\s,]/g, "")).filter(Boolean);
    if (rows.length < minR) throw new Error("Enter rows separated by semicolons.");
    if (rows.length > maxR) throw new Error(`Use at most ${maxR} rows.`);
    const C = rows[0].length;
    if (rows.some((r) => r.length !== C)) throw new Error("Every row must have the same number of cells.");
    if (C > maxC) throw new Error(`Use at most ${maxC} columns.`);
    for (const r of rows) for (const ch of r) if (!allowed.includes(ch)) throw new Error(`Unexpected cell "${ch}". Allowed: ${allowed.split("").join(" ")}.`);
    return rows.map((r) => r.split(""));
  }
  const D4 = [[0, 1], [0, -1], [1, 0], [-1, 0]];

  /* ---------- 11. 0-1 BFS with a deque (Minimum Cost to Make at Least One Valid Path) ---------- */
  Viz.register(P("zero-one"), (el, opts) => Viz.player(el, {
    title: "0-1 BFS: cost-0 moves go to the FRONT of the deque, cost-1 moves to the BACK",
    tag: "EDIT THE ARROW GRID",
    legend: [["active", "popped cell"], ["visit", "in the deque"], ["done", "finalised"], ["path", "cheapest route"]],
    codeLang: "python",
    code: [
      "dist[0][0] = 0; dq = deque([(0, 0)])",
      "while dq:",
      "    cell = dq.popleft()",
      "    if cell is stale: continue      # popped again later",
      "    for d, nxt in moves(cell):",
      "        w = 0 if d == arrow[cell] else 1",
      "        if dist[cell] + w < dist[nxt]:",
      "            dist[nxt] = dist[cell] + w",
      "            if w == 0: dq.appendleft(nxt)",
      "            else:      dq.append(nxt)",
    ],
    inputs: [
      { key: "g", label: "arrows R L D U, rows separated by ;", value: opts.g || "RRRR;LLLL;RRRR;LLLL", width: 260 },
    ],
    random: () => { const R = Viz.rand(3, 5), C = Viz.rand(3, 6); return { g: Array.from({ length: R }, () => Array.from({ length: C }, () => "RLDU"[Viz.rand(0, 3)]).join("")).join(";") }; },
    build: ({ g }) => {
      const grid = parseRows(g, "RLDU", { maxR: 6, maxC: 7 });
      const R = grid.length, C = grid[0].length;
      const dirOf = { R: 0, L: 1, D: 2, U: 3 };
      const dist = grid.map((r) => r.map(() => Infinity)), par = grid.map((r) => r.map(() => null)), fin = grid.map((r) => r.map(() => false));
      dist[0][0] = 0;
      const dq = [[0, 0, 0]], fr = [];
      const snap = (x) => ({ grid, dist: dist.map((r) => [...r]), fin: fin.map((r) => [...r]), dq: dq.map((e) => [...e]), ...x });
      fr.push(snap({ line: [0], vars: { dq: "(0,0)" }, note: "Following a cell's arrow is free; changing it costs 1. Edge weights are only 0 or 1, so we do not need Dijkstra's heap: a <b>deque</b> kept sorted by distance does the job. Cost-0 neighbours belong to the <b>current</b> distance (front); cost-1 neighbours to the next one (back)." }));
      let pops = 0;
      while (dq.length && pops++ < 200) {
        const [r, c, d] = dq.shift();
        if (d > dist[r][c] || fin[r][c]) { fr.push(snap({ cur: [r, c], line: [2, 3], vars: { cell: `(${r},${c})`, "entry d": d, "dist": dist[r][c] }, note: `(${r},${c}) was pushed with ${d} but already finalised at ${dist[r][c]}. Stale entry: skip. (Like lazy Dijkstra.)` })); continue; }
        fin[r][c] = true;
        const relaxed = [];
        D4.forEach(([dr, dc], di) => {
          const nr = r + dr, nc = c + dc;
          if (nr < 0 || nr >= R || nc < 0 || nc >= C) return;
          const w = di === dirOf[grid[r][c]] ? 0 : 1;
          if (dist[r][c] + w < dist[nr][nc]) {
            dist[nr][nc] = dist[r][c] + w; par[nr][nc] = [r, c];
            if (w === 0) dq.unshift([nr, nc, dist[nr][nc]]); else dq.push([nr, nc, dist[nr][nc]]);
            relaxed.push(`${w === 0 ? "front" : "back"} (${nr},${nc})=${dist[nr][nc]}`);
          }
        });
        fr.push(snap({ cur: [r, c], line: relaxed.length ? [2, 4, 5, 6, 7, 8, 9] : [2, 4], vars: { cell: `(${r},${c})`, "dist[cell]": dist[r][c], arrow: grid[r][c] }, note: `Pop (${r},${c}) at distance ${dist[r][c]}: it is <b>final</b>, because the deque front always holds the smallest distance. ${relaxed.length ? `Relax: ${relaxed.join("; ")}.${relaxed.some((s) => s.startsWith("front")) ? ` The free move (along ${grid[r][c]}) jumps the queue.` : ` The free move (along ${grid[r][c]}) improves nothing; only paid moves were pushed.`}` : "No neighbour improves."}` }));
        if (r === R - 1 && c === C - 1) break;
      }
      const path = []; let p = [R - 1, C - 1];
      while (p) { path.push(`${p[0]},${p[1]}`); p = par[p[0]][p[1]]; }
      fr.push(snap({ path: new Set(path), line: [], vars: { answer: dist[R - 1][C - 1] }, note: `Bottom-right reached with cost <b>${dist[R - 1][C - 1]}</b>: that many arrows must change. O(R·C), each cell enters the deque at most a few times. Same skeleton solves "minimum walls to remove" and any 0/1-weighted shortest path.` }));
      return fr;
    },
    render: (f) => {
      const glyph = { R: "→", L: "←", D: "↓", U: "↑" };
      const cls = (r, c) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : f.path && f.path.has(`${r},${c}`) ? "path" : f.fin[r][c] ? "done" : f.dq.some(([a, b]) => a === r && b === c) ? "visit" : "");
      const arrows = Viz.grid(f.grid, { label: "grid (arrow in each cell)", fmt: (v) => glyph[v], cls });
      const dist = Viz.grid(f.dist, { label: "dist (changes needed)", fmt: (v) => (v === Infinity ? "∞" : String(v)), cls });
      const dq = Viz.queue(f.dq.map(([r, c, d]) => `(${r},${c}) ${d}`), { label: "deque", cls: (i) => (i === 0 ? "active" : "visit") });
      return Viz.row(arrows, dist, dq);
    },
  }));

  /* ---------- 12. State-space BFS: Shortest Path to Get All Keys ---------- */
  Viz.register(P("keys"), (el, opts) => Viz.player(el, {
    title: "BFS over (cell, keys held): one copy of the grid per key set",
    tag: "EDIT THE GRID",
    legend: [["active", "this BFS layer (frontier)"], ["visit", "visited earlier"], ["path", "shortest route"], ["wall", "wall"]],
    codeLang: "python",
    code: [
      "q = deque([(sr, sc, 0)]); seen = {(sr, sc, 0)}",
      "steps = 0",
      "while q:",
      "    for _ in range(len(q)):              # one layer",
      "        r, c, keys = q.popleft()",
      "        if keys == ALL: return steps",
      "        for nr, nc in neighbours(r, c):",
      "            ch = grid[nr][nc]",
      "            if ch == '#' or locked(ch, keys): continue",
      "            nk = keys | bit(ch) if is_key(ch) else keys",
      "            if (nr, nc, nk) not in seen:",
      "                seen.add((nr, nc, nk)); q.append((nr, nc, nk))",
      "    steps += 1",
    ],
    inputs: [
      { key: "g", label: "grid (@ start, # wall, a b keys, A B locks)", value: opts.g || "@.a..;###.#;b.A.B", width: 260 },
    ],
    random: () => {
      const pick = [["@.a..", "###.#", "b.A.B"], ["@..aA", "..B#.", "....b"], ["@Aa", "#.#", "b.B"], ["a.#.b", ".#..#", "@.A.B"], ["@.#b.", ".#A#.", "...a."]];
      return { g: pick[Viz.rand(0, pick.length - 1)].join(";") };
    },
    build: ({ g }) => {
      const grid = parseRows(g, "@.#abcABC", { maxR: 5, maxC: 7 });
      const R = grid.length, C = grid[0].length;
      let sr = -1, sc = -1, K = 0;
      grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === "@") { if (sr >= 0) throw new Error("Use exactly one @."); sr = r; sc = c; } if (/[a-c]/.test(ch)) K = Math.max(K, ch.charCodeAt(0) - 96); }));
      if (sr < 0) throw new Error("Put one @ start cell in the grid.");
      const keysPresent = new Set(grid.flat().filter((ch) => /[a-c]/.test(ch)));
      if (keysPresent.size !== K) throw new Error("Keys must be consecutive from a: use a, or a and b, or a, b and c.");
      if (K === 0) throw new Error("Put at least one key (a) in the grid.");
      const ALL = (1 << K) - 1;
      const key3 = (r, c, m) => `${r},${c},${m}`;
      const seen = new Map([[key3(sr, sc, 0), null]]);
      let q = [[sr, sc, 0]], steps = 0, ans = -1, endState = null;
      const fr = [];
      const visitedBy = () => new Set(seen.keys());
      const snap = (x) => ({ grid, K, seen: visitedBy(), steps, ...x });
      fr.push(snap({ frontier: new Set([key3(sr, sc, 0)]), line: [0, 1], vars: { states: `${R}×${C}×${1 << K} = ${R * C * (1 << K)}`, steps }, note: `Position alone is not enough: standing on a cell <b>with</b> key a is a different situation from standing there without it. The state is (row, col, keys as a bitmask), so the search space is ${1 << K} stacked copies of the grid, one per key set. Picking up a key moves you to another copy.` }));
      while (q.length && steps < 40) {
        const nq = [], picked = [];
        for (const [r, c, m] of q) {
          if (m === ALL) { ans = steps; endState = key3(r, c, m); break; }
          for (const [dr, dc] of D4) {
            const nr = r + dr, nc = c + dc;
            if (nr < 0 || nr >= R || nc < 0 || nc >= C) continue;
            const ch = grid[nr][nc];
            if (ch === "#") continue;
            if (/[A-C]/.test(ch) && !(m & (1 << (ch.charCodeAt(0) - 65)))) continue;
            const nm = /[a-c]/.test(ch) ? m | (1 << (ch.charCodeAt(0) - 97)) : m;
            const k = key3(nr, nc, nm);
            if (seen.has(k)) continue;
            seen.set(k, key3(r, c, m)); nq.push([nr, nc, nm]);
            if (nm !== m) picked.push(`${ch} at (${nr},${nc})`);
          }
        }
        if (ans >= 0) break;
        q = nq; steps++;
        if (!q.length) break;
        fr.push(snap({ frontier: new Set(q.map(([r, c, m]) => key3(r, c, m))), line: [3, 4, 6, 7, 8, 9, 10, 11, 12], vars: { steps, "layer size": q.length, "states seen": seen.size }, note: `Layer ${steps}: ${q.length} new state${q.length === 1 ? "" : "s"}. ${picked.length ? `Picked up ${[...new Set(picked)].join(", ")}: those states jump to another key layer, where locks they open become passable and cells already seen in the old layer are <b>fresh again</b>.` : "Locks without their key act as walls in this layer."}` }));
      }
      const path = new Set();
      if (endState) { let s = endState; while (s) { path.add(s); s = seen.get(s); } }
      fr.push(snap({ path, line: ans >= 0 ? [5] : [], vars: { answer: ans, "states seen": seen.size }, note: ans >= 0 ? `A state with all keys is popped at step <b>${ans}</b>, so that is the answer. Follow the purple route through the layers: it switches layer exactly where a key is collected. Cost O(R·C·2<sup>K</sup>).` : "BFS ran out of states without collecting every key: answer −1." }));
      return fr;
    },
    render: (f) => {
      const layers = [];
      for (let m = 0; m < 1 << f.K; m++) {
        const label = `keys {${[...Array(f.K)].map((_, i) => (m & (1 << i) ? "abc"[i] : "")).filter(Boolean).join(",")}}`;
        layers.push(Viz.grid(f.grid, {
          label,
          fmt: (v) => (v === "." ? "" : v === "#" ? "" : v),
          cls: (r, c, v) => {
            const k = `${r},${c},${m}`;
            if (v === "#") return "wall";
            if (f.path && f.path.has(k)) return "path";
            if (f.frontier && f.frontier.has(k)) return "active";
            if (f.seen.has(k)) return "visit";
            if (/[A-C]/.test(v) && !(m & (1 << (v.charCodeAt(0) - 65)))) return "ag-locked";
            return "";
          },
        }));
      }
      return Viz.row(`<div class="ag-layers">${layers.join("")}</div>`, col(badge(`steps = ${f.steps}`, "visit"), badge(`states seen = ${f.seen.size}`)));
    },
  }));

  /* ---------- 13. Bidirectional BFS on a grid ---------- */
  Viz.register(P("bidir"), (el, opts) => Viz.player(el, {
    title: "Bidirectional BFS: two small balls instead of one big one",
    tag: "EDIT THE MAZE",
    legend: [["visit", "seen from S"], ["done", "seen from T"], ["active", "layer just added"], ["path", "shortest path"], ["wall", "wall"]],
    codeLang: "python",
    code: [
      "seen_s, seen_t = {s: 0}, {t: 0}",
      "front_s, front_t = [s], [t]",
      "while front_s and front_t:",
      "    if len(front_s) > len(front_t): swap the two sides",
      "    nxt, best = [], INF",
      "    for u in front_s:",
      "        for v in neighbours(u):",
      "            if v in seen_t: best = min(best, seen_s[u] + 1 + seen_t[v])",
      "            if v not in seen_s: seen_s[v] = seen_s[u] + 1; nxt.append(v)",
      "    if best < INF: return best   # finish the layer, then stop",
      "    front_s = nxt",
    ],
    inputs: [
      { key: "g", label: "maze (S start, T target, # wall, . open)", value: opts.g || "..........#.;..........#.;..#.....S...;.....#...#..;........#...;.......#....;......#.T...", width: 360 },
    ],
    random: () => {
      const R = Viz.rand(4, 6), C = Viz.rand(8, 11), g = Array.from({ length: R }, () => Array.from({ length: C }, () => (Math.random() < 0.22 ? "#" : ".")));
      g[0][0] = "S"; g[R - 1][C - 1] = "T";
      return { g: g.map((r) => r.join("")).join(";") };
    },
    build: ({ g }) => {
      const grid = parseRows(g, "ST#.", { maxR: 7, maxC: 12 });
      const R = grid.length, C = grid[0].length;
      let S = null, T = null;
      grid.forEach((row, r) => row.forEach((ch, c) => { if (ch === "S") S = `${r},${c}`; if (ch === "T") T = `${r},${c}`; }));
      if (!S || !T) throw new Error("Put one S and one T in the maze.");
      const nbrs = (k) => { const [r, c] = k.split(",").map(Number); const out = []; for (const [dr, dc] of D4) { const nr = r + dr, nc = c + dc; if (nr >= 0 && nr < R && nc >= 0 && nc < C && grid[nr][nc] !== "#") out.push(`${nr},${nc}`); } return out; };
      /* plain BFS for comparison */
      const plain = new Map([[S, 0]]); { const q = [S]; while (q.length) { const u = q.shift(); if (u === T) break; for (const v of nbrs(u)) if (!plain.has(v)) { plain.set(v, plain.get(u) + 1); q.push(v); } } }
      const side = [{ seen: new Map([[S, 0]]), par: new Map([[S, null]]), front: [S], name: "S" }, { seen: new Map([[T, 0]]), par: new Map([[T, null]]), front: [T], name: "T" }];
      const fr = [];
      const snap = (x) => ({ grid, sS: new Map(side[0].seen), sT: new Map(side[1].seen), plainCount: plain.size, ...x });
      fr.push(snap({ line: [0, 1], vars: { "plain BFS would see": plain.has(T) ? plain.size : "—" }, note: `One BFS from S explores a "ball" of radius d. Two BFS searches meeting in the middle explore two balls of radius d/2. With branching factor b that is 2·b<sup>d/2</sup> instead of b<sup>d</sup>. On word-ladder graphs that is the difference between timing out and passing.` }));
      let best = Infinity, meet = null, rounds = 0;
      while (side[0].front.length && side[1].front.length && rounds++ < 60) {
        const a = side[0].front.length <= side[1].front.length ? 0 : 1, A = side[a], B = side[1 - a];
        const nxt = [], width = A.front.length;
        for (const u of A.front) for (const v of nbrs(u)) {
          if (B.seen.has(v)) { const cand = A.seen.get(u) + 1 + B.seen.get(v); if (cand < best) { best = cand; meet = [a, u, v]; } }
          if (!A.seen.has(v)) { A.seen.set(v, A.seen.get(u) + 1); A.par.set(v, u); nxt.push(v); }
        }
        A.front = nxt;
        fr.push(snap({ layer: new Set(nxt), line: best < Infinity ? [3, 5, 6, 7, 8, 9] : [3, 5, 6, 8, 10], vars: { expand: A.name, [`|front ${A.name}|`]: nxt.length, [`|front ${B.name}|`]: B.front.length, seen: side[0].seen.size + side[1].seen.size }, note: `Expand the <b>smaller</b> frontier (${A.name}: ${width} cell${width === 1 ? "" : "s"} vs ${B.front.length} on the ${B.name} side). ${best < Infinity ? `A neighbour is already in ${B.name}'s seen set: the searches <b>touched</b>. Best total = ${best}.` : `${nxt.length} new cell${nxt.length === 1 ? "" : "s"}; no contact yet.`}` }));
        if (best < Infinity) break;
      }
      if (!meet) { fr.push(snap({ line: [2], vars: { answer: -1 }, note: "One frontier emptied: S and T are disconnected, answer −1." })); return fr; }
      const [a, u, v] = meet, A = side[a], B = side[1 - a];
      const p1 = []; let x = u; while (x) { p1.unshift(x); x = A.par.get(x); }
      const p2 = []; x = v; while (x) { p2.push(x); x = B.par.get(x); }
      const path = new Set([...p1, ...p2]);
      const total = side[0].seen.size + side[1].seen.size;
      fr.push(snap({ path, line: [9], vars: { answer: best, "bidirectional saw": total, "plain BFS saw": plain.size }, note: `Shortest path length <b>${best}</b>. Stitch the two parent chains at the meeting edge. Cells touched: <b>${total}</b> bidirectionally vs <b>${plain.size}</b> for one BFS that stops at T. The win grows exponentially with branching factor; in an open grid it is smaller, in word graphs it is huge.` }));
      return fr;
    },
    render: (f) => {
      const cls = (r, c, v) => {
        const k = `${r},${c}`;
        if (v === "#") return "wall";
        if (f.path && f.path.has(k)) return "path";
        if (f.layer && f.layer.has(k)) return "active";
        if (f.sS.has(k)) return "visit";
        if (f.sT.has(k)) return "done";
        return "";
      };
      const g = Viz.grid(f.grid, { label: "maze (numbers = BFS distance from its own side)", cls, fmt: (v, r, c) => { const k = `${r},${c}`; if (v === "S" || v === "T") return v; if (v === "#") return ""; return f.sS.has(k) ? String(f.sS.get(k)) : f.sT.has(k) ? String(f.sT.get(k)) : ""; } });
      return Viz.row(g, col(badge(`seen from S: ${f.sS.size}`, "visit"), badge(`seen from T: ${f.sT.size}`, "done"), badge(`plain BFS: ${f.plainCount}`)));
    },
  }));

  /* ---------- 14. Tree centres: peel leaves, or two BFS for the diameter ---------- */
  Viz.register(P("centers"), (el, opts) => Viz.player(el, {
    title: "Tree centres: peel leaves layer by layer, or walk the diameter",
    tag: "EDIT THE TREE",
    legend: [["bad", "leaf removed this round"], ["dim", "already removed"], ["done", "centre"], ["path", "diameter path"], ["active", "BFS farthest node"]],
    codeLang: "python",
    code: [
      "# peel: Minimum Height Trees",
      "leaves = [u for u in nodes if deg[u] <= 1]",
      "remaining = n",
      "while remaining > 2:",
      "    remaining -= len(leaves)",
      "    new = []",
      "    for u in leaves:",
      "        for v in adj[u]:",
      "            deg[v] -= 1",
      "            if deg[v] == 1: new.append(v)",
      "    leaves = new",
      "return leaves                     # 1 or 2 centres",
      "# diameter: a = farthest(any); b = farthest(a)",
    ],
    inputs: [
      { key: "edges", label: "tree edges (u-v)", value: opts.edges || "0-1,1-2,2-3,3-4,2-5,5-6,1-7,7-8,3-9", width: 300 },
      { key: "mode", label: "method", type: "select", options: ["peel leaves", "two BFS (diameter)"], value: opts.mode || "peel leaves" },
    ],
    random: () => { const n = Viz.rand(6, 11), out = []; for (let i = 1; i < n; i++) out.push(`${Viz.rand(0, i - 1)}-${i}`); return { edges: out.join(",") }; },
    build: ({ edges, mode }) => {
      const G = parseGraph(edges, false, { maxN: 13, maxE: 12 });
      const n = G.ids.length;
      if (G.edges.length !== n - 1) throw new Error(`A tree on ${n} nodes has exactly ${n - 1} edges (you have ${G.edges.length}).`);
      const seen0 = new Set([G.ids[0]]), st0 = [G.ids[0]];
      while (st0.length) { const u = st0.pop(); for (const v of G.adj[u]) if (!seen0.has(v)) { seen0.add(v); st0.push(v); } }
      if (seen0.size !== n) throw new Error("The edges must connect every node (a tree is connected).");
      const root = G.ids[0];
      const kids = {}; { const q = [root], vis = new Set([root]); while (q.length) { const u = q.shift(); kids[u] = []; for (const v of G.adj[u]) if (!vis.has(v)) { vis.add(v); kids[u].push(v); q.push(v); } } }
      const t = Viz.layoutTree(root, (id) => kids[id], (id) => id, { dx: 54, dy: 66 });
      const pos = t.nodes.map((p) => ({ id: p.id, x: p.x, y: p.y }));
      const fr = [];
      if (mode === "peel leaves") {
        const deg = Object.fromEntries(G.ids.map((x) => [x, G.adj[x].length]));
        const removed = new Set();
        let leaves = G.ids.filter((x) => deg[x] <= 1), remaining = n, round = 0;
        const snap = (x) => ({ G, pos, removed: new Set(removed), deg: { ...deg }, mode, ...x });
        fr.push(snap({ leaves: new Set(leaves), line: [1, 2], vars: { remaining, leaves: leaves.join(" ") }, note: `A centre minimises the distance to the farthest node. Leaves are the worst possible roots, so peel them off. Every round removes all current leaves at once, like a BFS that starts from every leaf (multi-source) and walks inward. Round 0 leaves: <b>${leaves.join(", ")}</b>.` }));
        while (remaining > 2) {
          round++;
          remaining -= leaves.length;
          const nw = [];
          for (const u of leaves) { removed.add(u); for (const v of G.adj[u]) if (!removed.has(v)) { deg[v]--; if (deg[v] === 1) nw.push(v); } }
          fr.push(snap({ gone: new Set(leaves), leaves: new Set(nw), line: [3, 4, 5, 6, 7, 8, 9, 10], vars: { round, remaining, "new leaves": nw.join(" ") || "—" }, note: `Round ${round}: remove ${leaves.join(", ")}. Their neighbours lose a degree; any that drop to 1 are the next layer of leaves: <b>${nw.join(", ") || "none"}</b>. ${remaining} node${remaining === 1 ? "" : "s"} remain.` }));
          leaves = nw;
        }
        fr.push(snap({ centers: new Set(leaves), line: [11], vars: { centres: leaves.join(" ") }, note: `Stop at ≤ 2 nodes: the centre${leaves.length > 1 ? "s are" : " is"} <b>${leaves.join(" and ")}</b>. A tree always has 1 centre (odd diameter length in nodes) or 2 adjacent ones. These are the roots of the minimum-height trees. O(n).` }));
      } else {
        const bfs = (s) => { const d = { [s]: 0 }, p = { [s]: null }, q = [s]; while (q.length) { const u = q.shift(); for (const v of G.adj[u]) if (!(v in d)) { d[v] = d[u] + 1; p[v] = u; q.push(v); } } let far = s; for (const x of G.ids) if (d[x] > d[far]) far = x; return { d, p, far }; };
        const snap = (x) => ({ G, pos, mode, removed: new Set(), ...x });
        const s = G.ids[0];
        const b1 = bfs(s);
        fr.push(snap({ dist: b1.d, far: b1.far, src: s, line: [12], vars: { start: s, farthest: b1.far, dist: b1.d[b1.far] }, note: `BFS from any node (${s}). The farthest node, <b>${b1.far}</b>, must be one end of a longest path (a diameter endpoint): if it were not, a longer path could be built through it.` }));
        const b2 = bfs(b1.far);
        fr.push(snap({ dist: b2.d, far: b2.far, src: b1.far, line: [12], vars: { start: b1.far, farthest: b2.far, diameter: b2.d[b2.far] }, note: `BFS again from ${b1.far}. The farthest node, <b>${b2.far}</b>, is the other end. Diameter = <b>${b2.d[b2.far]}</b> edges.` }));
        const path = []; let x = b2.far; while (x !== null) { path.push(x); x = b2.p[x]; }
        const L = path.length, mid = L % 2 ? [path[(L - 1) / 2]] : [path[L / 2 - 1], path[L / 2]];
        fr.push(snap({ dist: b2.d, path: new Set(path), pathArr: path, line: [12], vars: { diameter: L - 1, path: path.join("-") }, note: `Walk parents back from ${b2.far}: the diameter path is ${path.join(" – ")}.` }));
        fr.push(snap({ dist: b2.d, path: new Set(path), pathArr: path, centers: new Set(mid), line: [12], vars: { centres: mid.join(" "), radius: Math.ceil((L - 1) / 2) }, note: `The centre${mid.length > 1 ? "s are" : " is"} the middle of the diameter: <b>${mid.join(" and ")}</b>, radius ⌈${L - 1}/2⌉ = ${Math.ceil((L - 1) / 2)}. Same answer as peeling, and it also gives you the diameter.` }));
      }
      return fr;
    },
    render: (f) => {
      const { G } = f;
      const g = drawGraph(G, f.pos, {
        sub: (id) => (f.dist ? (f.dist[id] ?? "") : f.removed.has(id) ? undefined : `deg ${f.deg[id]}`),
        nodeCls: (id) => (f.centers && f.centers.has(id) ? "done" : f.gone && f.gone.has(id) ? "bad" : f.removed.has(id) ? "dim" : f.path && f.path.has(id) ? "path" : id === f.far ? "active" : f.leaves && f.leaves.has(id) ? "visit" : id === f.src ? "visit" : ""),
        edgeCls: (k) => { const [a, b] = k.split("-"); if (f.path && f.pathArr) { const i = f.pathArr.indexOf(a), j = f.pathArr.indexOf(b); if (i >= 0 && j >= 0 && Math.abs(i - j) === 1) return "path"; } return f.removed.has(a) || f.removed.has(b) ? "dim" : ""; },
        label: f.mode === "peel leaves" ? "tree (below: current degree; blue = current leaves)" : "tree (below: BFS distance)",
      });
      return Viz.row(g);
    },
  }));

})();
