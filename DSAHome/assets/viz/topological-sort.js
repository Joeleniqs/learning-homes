/* Topological Sort & DAGs visualizers. Every frame is produced by running the real algorithm. */
(() => {
  const S = "topological-sort";
  const P = (name) => `${S}-${name}`;

  /* ---------- shared helpers ---------- */
  const natural = (a, b) => {
    const na = /^-?\d+$/.test(a), nb = /^-?\d+$/.test(b);
    if (na && nb) return Number(a) - Number(b);
    if (na !== nb) return na ? -1 : 1;
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const ek = (u, v) => `${u}-${v}`;
  const arrow = (u, v) => `${u}→${v}`;
  const list = (xs) => (xs.length ? xs.join(", ") : "—");

  /* Parse "0>1,1>2,5" (u>v or u->v means u must come before v). A lone label adds an isolated node. */
  function parseDag(text, { maxN = 12, maxE = 22 } = {}) {
    const toks = String(text).split(/[,;\s]+/).filter(Boolean);
    if (!toks.length) throw new Error("Enter edges like 0>1,1>2 (a lone label such as 5 adds an isolated node).");
    const ids = [], seen = new Set(), edges = [], keys = new Set();
    const add = (x) => {
      if (!/^[A-Za-z0-9]{1,3}$/.test(x)) throw new Error(`"${x}" is not a valid node label: use 1-3 letters or digits.`);
      if (!seen.has(x)) { seen.add(x); ids.push(x); }
    };
    for (const t of toks) {
      if (/^[A-Za-z0-9]+-[A-Za-z0-9]+$/.test(t)) throw new Error(`"${t}" has no direction. Write u>v for an arrow from u to v (u comes first).`);
      const m = t.match(/^([A-Za-z0-9]+)(?:(?:->|>)([A-Za-z0-9]+))?$/);
      if (!m) throw new Error(`Cannot read "${t}". Write edges as u>v separated by commas.`);
      add(m[1]);
      if (m[2] === undefined) continue;
      add(m[2]);
      if (m[1] === m[2]) throw new Error(`Self-loop "${t}" can never be ordered; remove it.`);
      const k = ek(m[1], m[2]);
      if (keys.has(k)) throw new Error(`Edge "${t}" appears twice.`);
      keys.add(k);
      edges.push([m[1], m[2]]);
    }
    if (ids.length > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${ids.length}).`);
    if (edges.length > maxE) throw new Error(`Use at most ${maxE} edges (you have ${edges.length}).`);
    ids.sort(natural);
    const adj = Object.fromEntries(ids.map((i) => [i, []])), pred = Object.fromEntries(ids.map((i) => [i, []]));
    for (const [u, v] of edges) { adj[u].push(v); pred[v].push(u); }
    for (const k in adj) { adj[k].sort(natural); pred[k].sort(natural); }
    return { ids, edges, adj, pred };
  }

  /* Plain Kahn (no frames), used for layouts and for checks. */
  function kahn(G, pick = (q) => q.shift()) {
    const indeg = Object.fromEntries(G.ids.map((u) => [u, 0]));
    G.edges.forEach(([, v]) => indeg[v]++);
    const q = G.ids.filter((u) => !indeg[u]), order = [], layer = {};
    q.forEach((u) => (layer[u] = 0));
    while (q.length) {
      const u = pick(q); order.push(u);
      for (const v of G.adj[u]) {
        layer[v] = Math.max(layer[v] ?? 0, layer[u] + 1);
        if (--indeg[v] === 0) q.push(v);
      }
    }
    return { order, layer, indeg, rest: G.ids.filter((u) => !order.includes(u)) };
  }

  /* Layered left-to-right layout: column = longest path from a source, so every DAG arrow points right.
     Nodes stuck on a cycle are placed on a ring to the right. */
  function layered(G, gapX = 108, gapY = 76) {
    const { order, layer, rest } = kahn(G);
    const cols = [];
    order.forEach((u) => (cols[layer[u]] ||= []).push(u));
    const y = {}, x = {};
    const bary = (u) => { const ps = G.pred[u].filter((p) => p in y); return ps.length ? ps.reduce((s, p) => s + y[p], 0) / ps.length : 0; };
    cols.forEach((col, k) => {
      if (k > 0) col.sort((a, b) => bary(a) - bary(b) || natural(a, b));
      col.forEach((u, i) => { y[u] = (i - (col.length - 1) / 2) * gapY; x[u] = k * gapX; });
    });
    /* Nudge a node that sits on top of a long edge that skips its column. */
    for (let pass = 0; pass < 3; pass++) {
      for (const [u, v] of G.edges) {
        if (!(u in x) || !(v in x) || layer[v] - layer[u] < 2) continue;
        for (const w of order) {
          if (w === u || w === v || layer[w] <= layer[u] || layer[w] >= layer[v]) continue;
          const t = (x[w] - x[u]) / (x[v] - x[u]), ly = y[u] + t * (y[v] - y[u]);
          const top = y[w] - 26, bot = y[w] + 38;   /* the circle plus the "in k" label under it */
          if (ly > top && ly < bot) {
            const cands = [ly + 28, ly - 40].sort((a, b) => Math.abs(a - y[w]) - Math.abs(b - y[w]));
            y[w] = cands.find((c) => !cols[layer[w]].some((o) => o !== w && Math.abs(y[o] - c) < gapY - 10)) ?? cands[0];
          }
        }
      }
    }
    /* Keep nodes in one column far enough apart for the circle and its label. */
    cols.forEach((col) => {
      const s = [...col].sort((a, b) => y[a] - y[b]);
      for (let i = 1; i < s.length; i++) if (y[s[i]] - y[s[i - 1]] < gapY - 10) y[s[i]] = y[s[i - 1]] + gapY - 10;
    });
    const pos = order.map((u) => ({ id: u, x: x[u], y: y[u] }));
    if (rest.length) {
      const R = rest.length <= 1 ? 0 : Math.max(52, rest.length * 18);
      const cx = order.length ? (cols.length - 1) * gapX + gapX * 0.9 + R : 0;
      pos.push(...Viz.layout.circle(rest, R, cx, 0));
    }
    return pos;
  }

  function drawDag(G, pos, o = {}) {
    return Viz.graph({
      nodes: pos.map((p) => ({ ...p, label: p.id, sub: o.sub ? o.sub(p.id) : undefined, top: o.top ? o.top(p.id) : undefined })),
      edges: G.edges.map(([u, v]) => ({ u, v })),
    }, { directed: true, nodeCls: o.nodeCls, edgeCls: o.edgeCls, label: o.label || "graph", r: o.r || 19 });
  }

  /* An order drawn on a line: forward arrows arc above, backward arrows (violations) arc below in red. */
  function strip(order, edges, o = {}) {
    const label = o.label || "order";
    if (!order.length) return Viz.labeled(label, `<div class="ts-empty">nothing placed yet</div>`);
    const r = 17, gap = o.gap || 58, pad = 8, at = Object.fromEntries(order.map((u, i) => [u, i]));
    const es = edges.filter(([u, v]) => u in at && v in at);
    const hOf = (s) => 9 + s * 11;
    const up = Math.max(0, ...es.filter(([u, v]) => at[v] > at[u]).map(([u, v]) => at[v] - at[u]));
    const down = Math.max(0, ...es.filter(([u, v]) => at[v] < at[u]).map(([u, v]) => at[u] - at[v]));
    const base = pad + (up ? hOf(up) + 2 : 0) + r;
    const X = (i) => pad + r + i * gap;
    const W = 2 * pad + 2 * r + (order.length - 1) * gap;
    const H = base + r + 18 + (down ? hOf(down) : 0);
    const unit = (dx, dy) => { const l = Math.hypot(dx, dy) || 1; return [dx / l, dy / l]; };
    const arcs = es.map(([u, v]) => {
      const i = at[u], j = at[v], fwd = j > i, h = hOf(Math.abs(j - i));
      const ax = X(i), bx = X(j), cx = (ax + bx) / 2, cy = fwd ? base - 2 * h : base + 2 * h;
      const [sx, sy] = unit(cx - ax, cy - base), [tx, ty] = unit(cx - bx, cy - base);
      const x1 = ax + sx * r, y1 = base + sy * r, x2 = bx + tx * (r + 2), y2 = base + ty * (r + 2);
      const [dx, dy] = unit(x2 - cx, y2 - cy);
      const c = (o.edgeCls && o.edgeCls(ek(u, v))) || (fwd ? "" : "bad");
      const head = `${x2},${y2} ${x2 - dx * 10 - dy * 5},${y2 - dy * 10 + dx * 5} ${x2 - dx * 10 + dy * 5},${y2 - dy * 10 - dx * 5}`;
      return `<path class="e ${c}" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}"/><polygon class="ah ${c}" points="${head}"/>`;
    }).join("");
    const nodes = order.map((u, i) => `<g class="n ${(o.nodeCls && o.nodeCls(u)) || ""}" transform="translate(${X(i)},${base})"><circle r="${r}"/><text>${Viz.esc(u)}</text><text class="nl" y="${r + 12}">#${i}</text></g>`).join("");
    return Viz.labeled(label, `<svg class="v-graph ts-strip" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${Viz.esc(label)}">${arcs}${nodes}</svg>`);
  }

  const side = (...parts) => `<div class="ts-side">${parts.filter(Boolean).join("")}</div>`;
  const col = (...parts) => `<div class="ts-col">${parts.filter(Boolean).join("")}</div>`;
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* Random DAG: edges only go forward in a hidden random order. With cycle=true one closing edge is added. */
  function randomDag(n, extra, cycle = false) {
    const perm = shuffle([...Array(n).keys()]), set = new Set(), out = [], adj = {};
    const add = (a, b) => {
      const k = `${a}>${b}`;
      if (a === b || set.has(k) || set.has(`${b}>${a}`)) return false;
      set.add(k); out.push(k); (adj[a] ||= []).push(b); return true;
    };
    for (let j = 1; j < n; j++) if (Math.random() < 0.85) add(perm[Viz.rand(0, j - 1)], perm[j]);
    let t = 0;
    while (extra > 0 && t++ < 200) { const i = Viz.rand(0, n - 2), j = Viz.rand(i + 1, n - 1); if (add(perm[i], perm[j])) extra--; }
    if (cycle && out.length) {
      const [a, b] = out[Viz.rand(0, out.length - 1)].split(">").map(Number);
      let c = b, steps = Viz.rand(1, 3);
      while (steps-- && adj[c] && adj[c].length) c = adj[c][Viz.rand(0, adj[c].length - 1)];
      if (c !== a && !set.has(`${c}>${a}`)) { set.add(`${c}>${a}`); out.push(`${c}>${a}`); }
    }
    for (let i = 0; i < n; i++) if (!out.some((e) => e.split(">").includes(String(i)))) out.push(String(i));
    return out.join(",");
  }

  const DEFAULT_DAG = "0>2,1>2,1>3,2>4,3>4,3>5,4>6,5>6,7>5";

  /* ---------- 1. Kahn's algorithm ---------- */
  Viz.register(P("kahn"), (el, opts) => Viz.player(el, {
    title: "Kahn's algorithm: in-degrees, a queue of ready nodes, and the output order",
    tag: "EDIT THE GRAPH",
    legend: [["active", "popped (u)"], ["visit", "ready: in the queue"], ["done", "placed in the order"], ["dim", "deleted arrow"], ["bad", "stuck (cycle)"]],
    codeLang: "python",
    code: [
      "indeg = {u: 0 for u in nodes}",
      "for u, v in edges: indeg[v] += 1",
      "q = deque(u for u in nodes if indeg[u] == 0)",
      "order = []",
      "while q:",
      "    u = q.popleft()",
      "    order.append(u)",
      "    for v in adj[u]:     # delete u's arrows",
      "        indeg[v] -= 1",
      "        if indeg[v] == 0: q.append(v)",
      "return order if len(order) == n else None",
    ],
    inputs: [
      { key: "edges", label: "edges (u>v: u before v)", value: opts.edges || DEFAULT_DAG, width: 300 },
    ],
    random: () => ({ edges: randomDag(Viz.rand(6, 9), Viz.rand(2, 4), Math.random() < 0.25) }),
    build: ({ edges }) => {
      const G = parseDag(edges);
      const pos = layered(G), n = G.ids.length;
      const indeg = Object.fromEntries(G.ids.map((u) => [u, 0]));
      G.edges.forEach(([, v]) => indeg[v]++);
      const q = [], order = [], removed = new Set(), fr = [];
      const snap = (x) => ({ G, pos, indeg: { ...indeg }, q: [...q], order: [...order], removed: new Set(removed), ...x });
      const zeros = G.ids.filter((u) => !indeg[u]);
      fr.push(snap({ line: [0, 1], vars: { n, E: G.edges.length }, note: `Count <b>in-degrees</b> (the small “in” under each node): indeg[v] is the number of arrows pointing <i>into</i> v, i.e. how many things must happen before v. Sources (in 0): ${list(zeros)}.` }));
      q.push(...zeros);
      fr.push(snap({ line: [2, 3], vars: { q: list(q) }, note: zeros.length ? `Every node with in-degree 0 waits for nothing, so any of them may go first. Queue them all: <b>${q.join(" ")}</b>.` : `No node has in-degree 0: every node waits for another one. That is only possible if there is a cycle, so the queue starts empty.` }));
      while (q.length) {
        const u = q.shift(); order.push(u);
        fr.push(snap({ u, line: [4, 5, 6], vars: { u, order: order.join(" ") }, note: `Pop <b>${u}</b> and place it at position #${order.length - 1}. Its in-degree is 0, so everything it depends on is already placed. Now delete its outgoing arrows${G.adj[u].length ? "" : " (it has none)"}.` }));
        for (const v of G.adj[u]) {
          indeg[v]--; removed.add(ek(u, v));
          const zero = indeg[v] === 0;
          if (zero) q.push(v);
          fr.push(snap({ u, v, cur: ek(u, v), line: zero ? [7, 8, 9] : [7, 8], vars: { u, v, "indeg[v]": indeg[v], q: list(q) }, note: zero ? `Delete ${arrow(u, v)}: indeg[${v}] drops to <b>0</b>. All of ${v}'s prerequisites are placed, so ${v} becomes ready and joins the queue.` : `Delete ${arrow(u, v)}: indeg[${v}] drops to ${indeg[v]}. ${v} still waits for ${indeg[v]} more node${indeg[v] > 1 ? "s" : ""}.` }));
        }
      }
      const rest = G.ids.filter((x) => !order.includes(x)), ok = !rest.length;
      fr.push(snap({ fin: true, ok, rest, line: 10, vars: { "len(order)": order.length, n }, note: ok ? `Queue empty and all ${n} nodes placed: <b>${order.join(" → ")}</b>. In the strip every arrow points right: each edge u→v has u earlier than v. That is exactly what a topological order is.` : `The queue is empty but only ${order.length} of ${n} nodes were placed. <b>${rest.join(", ")}</b> still have in-degree ≥ 1, and every one of those arrows comes from another stuck node: they sit on a cycle (or behind one), so <b>no valid order exists</b>.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f, inQ = new Set(f.q), placed = new Set(f.order), rest = new Set(f.rest || []);
      const graph = drawDag(G, f.pos, {
        sub: (id) => `in ${f.indeg[id]}`,
        nodeCls: (id) => (id === f.u ? "active" : rest.has(id) ? "bad" : placed.has(id) ? "done" : inQ.has(id) ? "visit" : ""),
        edgeCls: (k) => (k === f.cur ? "active" : f.removed.has(k) ? "dim" : f.fin && !f.ok ? "bad" : ""),
      });
      const ind = Viz.array(G.ids.map((x) => f.indeg[x]), { label: "indeg", idxLabel: (i) => G.ids[i], cls: (i) => { const x = G.ids[i]; return x === f.v ? "active" : rest.has(x) ? "bad" : placed.has(x) ? "done" : inQ.has(x) ? "visit" : ""; } });
      const queue = Viz.queue(f.q, { label: "ready queue", cls: (i, x) => (x === f.v ? "active" : "visit") });
      const st = strip(f.order, G.edges, { label: "order so far (every arrow must point right)", nodeCls: (id) => (id === f.u ? "active" : "done"), edgeCls: () => "done" });
      return col(Viz.row(graph, side(ind, queue)), st);
    },
  }));

  /* ---------- 2. DFS finishing order ---------- */
  Viz.register(P("dfs"), (el, opts) => Viz.player(el, {
    title: "DFS finishing order: a node finishes after everything it points to",
    tag: "EDIT THE GRAPH",
    legend: [["active", "current call"], ["visit", "GREY: on the call stack"], ["done", "BLACK: finished"], ["bad", "back edge = cycle"]],
    codeLang: "python",
    code: [
      "def dfs(u):",
      "    state[u] = GREY       # on the path now",
      "    for v in adj[u]:",
      "        if state[v] == GREY:  # back edge",
      "            raise ValueError('cycle')",
      "        if state[v] == WHITE:",
      "            dfs(v)",
      "    state[u] = BLACK",
      "    post.append(u)    # after all u reaches",
      "for u in nodes:",
      "    if state[u] == WHITE: dfs(u)",
      "order = post[::-1]",
    ],
    inputs: [
      { key: "edges", label: "edges (u>v)", value: opts.edges || DEFAULT_DAG, width: 300 },
    ],
    random: () => ({ edges: randomDag(Viz.rand(6, 9), Viz.rand(2, 4), Math.random() < 0.3) }),
    build: ({ edges }) => {
      const G = parseDag(edges);
      const pos = layered(G), state = Object.fromEntries(G.ids.map((u) => [u, "W"])), post = [], stack = [], tree = new Set(), fr = [];
      let cyc = null;
      const snap = (x) => ({ G, pos, state: { ...state }, post: [...post], stack: [...stack], tree: new Set(tree), ...x });
      fr.push(snap({ line: 9, vars: { post: "—" }, note: `All nodes start WHITE (unvisited). We call dfs on each WHITE node in label order and write a node into <b>post</b> at the moment it <i>finishes</i>.` }));
      const dfs = (u, from) => {
        state[u] = "G"; stack.push(u);
        fr.push(snap({ u, cur: from ? ek(from, u) : null, line: [0, 1], vars: { u, stack: stack.join(" ") }, note: `Enter <b>dfs(${u})</b>: mark it GREY. GREY means “on the current path, not finished yet”.` }));
        for (const v of G.adj[u]) {
          if (state[v] === "G") {
            cyc = stack.slice(stack.indexOf(v));
            fr.push(snap({ u, cur: ek(u, v), back: ek(u, v), line: [2, 3, 4], vars: { u, v, "state[v]": "GREY" }, note: `${arrow(u, v)} points at <b>${v}</b>, which is GREY: it is an ancestor still on the stack. Following the stack ${cyc.join(" → ")} → ${v} closes a <b>cycle</b>, so no topological order exists. Stop.` }));
            return true;
          }
          if (state[v] === "B") {
            fr.push(snap({ u, cur: ek(u, v), line: [2, 5], vars: { u, v, "state[v]": "BLACK" }, note: `${arrow(u, v)}: ${v} is already BLACK, so it is <i>already in post</i>. When ${u} finishes it lands later in post, and after reversing, ${u} comes before ${v}. Exactly what the arrow demands.` }));
            continue;
          }
          tree.add(ek(u, v));
          if (dfs(v, u)) return true;
          fr.push(snap({ u, line: 2, vars: { u, post: post.join(" ") }, note: `Back in dfs(${u}) after ${v} finished. Continue with ${u}'s next arrow.` }));
        }
        state[u] = "B"; stack.pop(); post.push(u);
        fr.push(snap({ u, fin: u, line: [7, 8], vars: { u, post: post.join(" ") }, note: `<b>${u}</b> finishes: every node reachable from ${u} is already BLACK and already in post. Append ${u}: post = [${post.join(", ")}].` }));
        return false;
      };
      for (const u of G.ids) {
        if (state[u] !== "W") continue;
        fr.push(snap({ line: [9, 10], vars: { u }, note: `Outer loop: <b>${u}</b> is still WHITE, so start a new DFS there.${post.length ? ` (Nodes finished so far stay finished.)` : ""}` }));
        if (dfs(u, null)) break;
      }
      if (cyc) {
        fr.push(snap({ fin: true, cyc, line: 4, vars: { cycle: cyc.join("→") + "→" + cyc[0] }, note: `Cycle <b>${cyc.join(" → ")} → ${cyc[0]}</b>: each node on it would have to come before itself. DFS detects this through the <b>GREY</b> state; merely “already visited” (BLACK) would not be a cycle.` }));
      } else {
        const order = [...post].reverse();
        fr.push(snap({ fin: true, order, line: 11, vars: { order: order.join(" ") }, note: `Reverse post: <b>${order.join(" → ")}</b>. Why it works: for every arrow u→v, v finished before u (it was BLACK already, or it finished inside u's call), so u lands to the left of v. Every arrow in the strip points right.` }));
      }
      return fr;
    },
    render: (f) => {
      const { G } = f, cyc = new Set(f.cyc || []);
      const cycE = new Set((f.cyc || []).map((x, i, a) => ek(x, a[(i + 1) % a.length])));
      const top = f.stack[f.stack.length - 1];
      const graph = drawDag(G, f.pos, {
        sub: (id) => { const i = f.post.indexOf(id); return i >= 0 ? `post ${i}` : undefined; },
        nodeCls: (id) => (cyc.has(id) ? "bad" : id === f.u && f.state[id] === "G" && id === top ? "active" : f.state[id] === "G" ? "visit" : f.state[id] === "B" ? "done" : ""),
        edgeCls: (k) => (cycE.has(k) || k === f.back ? "bad" : k === f.cur ? "active" : f.tree.has(k) ? "done" : ""),
      });
      const st = Viz.stack(f.stack.map((x) => `dfs(${x})`), { label: "call stack", cls: (i) => (i === f.stack.length - 1 ? "active" : "visit") });
      const post = Viz.array(f.post.length ? f.post : [null], { label: "post (finish order)", showIdx: !!f.post.length, cls: (i, x) => (x === f.fin ? "active" : x === null ? "dim" : "done") });
      const bottom = f.order ? strip(f.order, G.edges, { label: "reversed post = topological order", nodeCls: () => "done", edgeCls: () => "done" }) : "";
      return col(Viz.row(graph, side(st, post)), bottom);
    },
  }));

  /* ---------- 3. No order exists: find the cycle ---------- */
  Viz.register(P("cycle"), (el, opts) => Viz.player(el, {
    title: "When Kahn stalls: the leftover nodes always contain a cycle, and here it is",
    tag: "EDIT THE GRAPH",
    legend: [["done", "placed by Kahn"], ["visit", "left over (in ≥ 1)"], ["active", "walk position"], ["bad", "the cycle"]],
    codeLang: "python",
    code: [
      "order = kahn(nodes, adj)  # stalls: a cycle",
      "if len(order) == n: return None   # a DAG",
      "left = set(nodes) - set(order) # indeg >= 1",
      "x = any node of left; walk = []",
      "while x not in walk:",
      "    walk.append(x)",
      "    x = any p in pred[x] that is in left",
      "cycle = walk[walk.index(x):][::-1]",
    ],
    inputs: [
      { key: "edges", label: "edges (u>v)", value: opts.edges || "0>1,1>2,2>3,3>1,3>4,0>5,5>4,6>0", width: 300 },
    ],
    random: () => ({ edges: randomDag(Viz.rand(6, 9), Viz.rand(2, 4), true) }),
    build: ({ edges }) => {
      const G = parseDag(edges);
      const pos = layered(G), n = G.ids.length, fr = [];
      const indeg = Object.fromEntries(G.ids.map((u) => [u, 0]));
      G.edges.forEach(([, v]) => indeg[v]++);
      const q = G.ids.filter((u) => !indeg[u]), order = [];
      const snap = (x) => ({ G, pos, indeg: { ...indeg }, order: [...order], ...x });
      fr.push(snap({ line: 0, vars: { sources: list(q) }, note: `Run Kahn's algorithm as usual. Sources: ${list(q)}. Each pop deletes that node's arrows.` }));
      while (q.length) {
        const u = q.shift(); order.push(u);
        const freed = [];
        for (const v of G.adj[u]) if (--indeg[v] === 0) { q.push(v); freed.push(v); }
        fr.push(snap({ u, line: 0, vars: { u, order: order.join(" ") }, note: `Place <b>${u}</b> and delete its arrows.${freed.length ? ` Newly ready: ${freed.join(", ")}.` : " Nothing new becomes ready."}` }));
      }
      const left = G.ids.filter((u) => !order.includes(u));
      if (!left.length) {
        fr.push(snap({ fin: true, line: 1, vars: { "len(order)": n }, note: `All ${n} nodes were placed, so this graph is a <b>DAG</b> and has no cycle. Add an arrow that points backwards (e.g. from a late node to an early one) to see the stall.` }));
        return fr;
      }
      fr.push(snap({ left, line: [1, 2], vars: { left: left.join(" ") }, note: `The queue is empty with ${left.length} node${left.length > 1 ? "s" : ""} left: <b>${left.join(", ")}</b>. Each has in-degree ≥ 1, and placed nodes no longer count, so every leftover node has an arrow coming <i>from another leftover node</i>.` }));
      let x = left[left.length - 1];
      const walk = [];
      while (!walk.includes(x)) {
        walk.push(x);
        const p = G.pred[x].find((y) => left.includes(y));
        fr.push(snap({ left, walk: [...walk], x, step: ek(p, x), line: [4, 5, 6], vars: { x, "pred in left": p }, note: `At <b>${x}</b>: it has a leftover predecessor <b>${p}</b> (arrow ${arrow(p, x)}), so step backwards to ${p}. We can always keep stepping, and with finitely many nodes we must eventually repeat one.` }));
        x = p;
      }
      const cycle = walk.slice(walk.indexOf(x)).reverse();
      const behind = left.filter((u) => !cycle.includes(u));
      fr.push(snap({ left, walk, cycle, fin: true, line: 7, vars: { cycle: cycle.join("→") + "→" + cycle[0] }, note: `We returned to <b>${x}</b>: the cycle is <b>${cycle.join(" → ")} → ${cycle[0]}</b>.${behind.length ? ` ${behind.join(", ")} ${behind.length > 1 ? "are" : "is"} left over too but not on the cycle: ${behind.length > 1 ? "they are" : "it is"} stuck <i>behind</i> it, waiting for a node that can never be placed.` : ""} So “nodes left over” is not the same as “nodes on the cycle”.` }));
      return fr;
    },
    render: (f) => {
      const { G } = f, left = new Set(f.left || []), walk = new Set(f.walk || []), cyc = new Set(f.cycle || []);
      const cycE = new Set((f.cycle || []).map((x, i, a) => ek(x, a[(i + 1) % a.length])));
      const placed = new Set(f.order);
      const graph = drawDag(G, f.pos, {
        sub: (id) => (placed.has(id) ? `#${f.order.indexOf(id)}` : `in ${f.indeg[id]}`),
        nodeCls: (id) => (cyc.has(id) ? "bad" : id === f.x || id === f.u ? "active" : placed.has(id) ? "done" : left.has(id) || walk.has(id) ? "visit" : ""),
        edgeCls: (k) => (cycE.has(k) ? "bad" : k === f.step ? "active" : placed.has(k.split("-")[0]) ? "dim" : ""),
      });
      const parts = [Viz.array(f.order.length ? f.order : [null], { label: "placed by Kahn", showIdx: !!f.order.length, cls: (i, x) => (x === null ? "dim" : "done") })];
      if (f.walk) parts.push(Viz.array(f.walk, { label: "backward walk", cls: (i, x) => (cyc.has(x) ? "bad" : x === f.x ? "active" : "visit") }));
      return Viz.row(graph, side(...parts));
    },
  }));

  /* ---------- 4. Alien dictionary ---------- */
  Viz.register(P("alien"), (el, opts) => Viz.player(el, {
    title: "Alien dictionary: every adjacent word pair teaches at most one rule",
    tag: "EDIT THE WORDS",
    legend: [["done", "equal prefix / placed"], ["active", "first difference"], ["visit", "ready queue"], ["bad", "contradiction"]],
    codeLang: "python",
    code: [
      "adj = {c: set() for w in words for c in w}",
      "for a, b in zip(words, words[1:]):",
      "    for x, y in zip(a, b):",
      "        if x != y:     # first difference",
      "            adj[x].add(y)   # x before y",
      "            break",
      "    else:                   # a prefix pair",
      "        if len(a) > len(b): return \"\"",
      "order = kahn(adj)       # None on a cycle",
      "return ''.join(order) if order else ''",
    ],
    inputs: [
      { key: "words", label: "sorted alien words", value: opts.words || "wrt,wrf,er,ett,rftt", width: 300 },
    ],
    random: () => {
      const pool = shuffle("abcdefghijklmnopqrstuvwxyz".split("")).slice(0, Viz.rand(4, 6));
      const rank = Object.fromEntries(pool.map((c, i) => [c, i]));
      const ws = new Set();
      const n = Viz.rand(5, 7);
      while (ws.size < n) ws.add(Array.from({ length: Viz.rand(1, 4) }, () => pool[Viz.rand(0, pool.length - 1)]).join(""));
      const cmp = (a, b) => { for (let i = 0; i < Math.min(a.length, b.length); i++) if (a[i] !== b[i]) return rank[a[i]] - rank[b[i]]; return a.length - b.length; };
      return { words: [...ws].sort(cmp).join(",") };
    },
    build: ({ words }) => {
      const W = String(words).split(/[,\s]+/).filter(Boolean);
      if (W.length < 2 || W.length > 8) throw new Error("Use 2 to 8 words separated by commas.");
      for (const w of W) if (!/^[a-z]{1,7}$/.test(w)) throw new Error(`"${w}" is not valid: use lowercase letters a-z, at most 7 per word.`);
      const letters = [...new Set(W.join(""))].sort();
      if (letters.length > 12) throw new Error(`Use at most 12 distinct letters (you have ${letters.length}).`);
      const pairs = [], edges = [], keys = new Set();
      let invalid = null;
      for (let i = 0; i + 1 < W.length; i++) {
        const a = W[i], b = W[i + 1];
        let j = 0;
        while (j < Math.min(a.length, b.length) && a[j] === b[j]) j++;
        if (j < Math.min(a.length, b.length)) {
          const k = ek(a[j], b[j]), dup = keys.has(k);
          if (!dup) { keys.add(k); edges.push([a[j], b[j]]); }
          pairs.push({ i, j, x: a[j], y: b[j], dup, ne: edges.length });
        } else if (a.length > b.length) { invalid = i; pairs.push({ i, j, bad: true, ne: edges.length }); break; }
        else pairs.push({ i, j, prefix: true, ne: edges.length });
      }
      const adj = Object.fromEntries(letters.map((c) => [c, []])), pred = Object.fromEntries(letters.map((c) => [c, []]));
      for (const [u, v] of edges) { adj[u].push(v); pred[v].push(u); }
      for (const c of letters) { adj[c].sort(); pred[c].sort(); }
      const G = { ids: letters, edges, adj, pred };
      const pos = layered(G), fr = [];
      const snap = (x) => ({ W, G, pos, ne: 0, ...x });
      fr.push(snap({ line: 0, vars: { letters: letters.join("") }, note: `The words are sorted by an unknown alphabet. The letters are the nodes (${letters.length} of them); each rule “x comes before y” will be an arrow x→y. Compare <b>neighbouring</b> words only: that is all the sorted list guarantees.` }));
      for (const p of pairs) {
        const a = W[p.i], b = W[p.i + 1];
        let note;
        if (p.bad) note = `“${a}” comes before “${b}”, but ${b} is a proper prefix of ${a}. In <i>every</i> alphabet a prefix sorts first, so this list is impossible: return <b>""</b>.`;
        else if (p.prefix) note = `“${a}” is a prefix of “${b}”: a prefix sorts first in any alphabet, so this pair teaches <b>nothing</b>.`;
        else if (p.dup) note = `“${a}” vs “${b}”: they first differ at position ${p.j}: ${p.x} before ${p.y}. We already know that rule; a set skips the duplicate, so in-degrees are not inflated.`;
        else note = `“${a}” vs “${b}”: equal up to position ${p.j}, where <b>${p.x}</b> ≠ <b>${p.y}</b>. So ${p.x} comes before ${p.y}: add the arrow ${arrow(p.x, p.y)}. The letters <i>after</i> the first difference tell us nothing.`;
        fr.push(snap({ pair: p, ne: p.ne, cur: p.bad || p.prefix ? null : ek(p.x, p.y), line: p.bad ? [6, 7] : p.prefix ? [1, 2, 6] : [1, 2, 3, 4, 5], vars: { a, b, rule: p.bad ? "invalid" : p.prefix ? "none" : `${p.x}<${p.y}` }, note }));
        if (p.bad) return fr;
      }
      const indeg = Object.fromEntries(letters.map((c) => [c, pred[c].length]));
      const q = letters.filter((c) => !indeg[c]), order = [];
      const ksnap = (x) => snap({ ne: edges.length, kahn: true, indeg: { ...indeg }, q: [...q], order: [...order], ...x });
      fr.push(ksnap({ line: 8, vars: { rules: edges.length, sources: list(q) }, note: `All ${edges.length} rules collected. Now it is plain Kahn's algorithm on the letters. Letters with no incoming rule are ready: ${list(q)}. Letters that appear in no rule at all are ready immediately and may go anywhere.` }));
      while (q.length) {
        const u = q.shift(); order.push(u);
        const freed = [];
        for (const v of adj[u]) if (--indeg[v] === 0) { q.push(v); freed.push(v); }
        fr.push(ksnap({ u, line: 8, vars: { u, order: order.join("") }, note: `Place <b>${u}</b> and delete its arrows.${freed.length ? ` Newly ready: ${freed.join(", ")}.` : ""}` }));
      }
      const ok = order.length === letters.length, rest = letters.filter((c) => !order.includes(c));
      fr.push(ksnap({ fin: true, ok, rest, line: 9, vars: { answer: ok ? `"${order.join("")}"` : '""' }, note: ok ? `Every letter placed: the alphabet is <b>${order.join("")}</b>. (If several letters were ready at once, other answers are also valid.)` : `Kahn stalls with ${rest.join(", ")} left: the rules contradict each other in a cycle, so no alphabet fits. Return <b>""</b>.` }));
      return fr;
    },
    render: (f) => {
      const { G, W, pair: p } = f;
      const placed = new Set(f.order || []), inQ = new Set(f.q || []), rest = new Set(f.rest || []);
      const maxL = Math.max(...W.map((w) => w.length));
      const words = Viz.grid(W.map((w) => Array.from({ length: maxL }, (_, c) => w[c] ?? null)), {
        label: "words (sorted)", rowLabels: W.map((_, i) => `${i}`),
        cls: (r, c, v) => {
          if (v === null) return "ts-blank";
          if (f.kahn) return placed.has(v) ? "done" : "";
          if (!p || (r !== p.i && r !== p.i + 1)) return "dim";
          if (c < p.j) return "done";
          if (c === p.j) return p.bad ? "bad" : "active";
          return "";
        },
      });
      const Gs = { ...G, edges: G.edges.slice(0, f.ne) };
      const graph = drawDag(Gs, f.pos, {
        label: "letter graph",
        sub: f.kahn ? (id) => `in ${f.indeg[id]}` : undefined,
        nodeCls: (id) => (f.kahn ? (id === f.u ? "active" : rest.has(id) ? "bad" : placed.has(id) ? "done" : inQ.has(id) ? "visit" : "") : p && !p.prefix && !p.bad && (id === p.x || id === p.y) ? "active" : ""),
        edgeCls: (k) => (k === f.cur ? "active" : f.fin && !f.ok ? "bad" : f.kahn && placed.has(k.split("-")[0]) ? "dim" : ""),
      });
      if (!f.kahn) {
        const rules = Viz.array(G.edges.slice(0, f.ne).map(([x, y]) => `${x}<${y}`).concat(f.ne ? [] : [null]), { label: "rules learned", showIdx: false, cls: (i, v) => (v === null ? "dim" : f.cur === ek(...String(v).split("<")) ? "active" : "done") });
        return Viz.row(words, graph, rules);
      }
      const st = strip(f.order, G.edges, { label: "alphabet so far", nodeCls: (id) => (id === f.u ? "active" : "done"), edgeCls: () => "done", gap: 50 });
      return col(Viz.row(words, graph, side(Viz.queue(f.q, { label: "ready", cls: () => "visit" }))), st);
    },
  }));

  /* ---------- 5. Smallest order: min-heap instead of a FIFO queue ---------- */
  Viz.register(P("lexi"), (el, opts) => Viz.player(el, {
    title: "Lexicographically smallest order: always take the smallest ready node",
    tag: "SWITCH HEAP / QUEUE",
    legend: [["active", "popped (u)"], ["visit", "ready"], ["done", "placed"], ["bad", "stuck (cycle)"]],
    codeLang: "python",
    code: [
      "ready = [u for u in nodes if indeg[u] == 0]",
      "heapify(ready)        # FIFO: deque(ready)",
      "order = []",
      "while ready:",
      "    u = heappop(ready)  # FIFO: popleft()",
      "    order.append(u)",
      "    for v in adj[u]:",
      "        indeg[v] -= 1",
      "        if indeg[v] == 0:",
      "            heappush(ready, v)  # or append",
    ],
    inputs: [
      { key: "edges", label: "edges (u>v)", value: opts.edges || "3>1,4>1,4>0,2>0,5>2,6>1", width: 260 },
      { key: "mode", label: "ready set", type: "select", options: ["min-heap", "FIFO queue"], value: opts.mode || "min-heap" },
    ],
    random: () => ({ edges: randomDag(Viz.rand(6, 9), Viz.rand(1, 3)) }),
    build: ({ edges, mode }) => {
      const G = parseDag(edges), heapMode = mode !== "FIFO queue";
      const pos = layered(G);
      const run = (useHeap, rec) => {
        const indeg = Object.fromEntries(G.ids.map((u) => [u, 0]));
        G.edges.forEach(([, v]) => indeg[v]++);
        const R = [], order = [];
        const less = (i, j) => natural(R[i], R[j]) < 0;
        const push = (x) => {
          R.push(x);
          if (!useHeap) return;
          let i = R.length - 1;
          while (i > 0) { const p = (i - 1) >> 1; if (!less(i, p)) break; [R[i], R[p]] = [R[p], R[i]]; i = p; }
        };
        const pop = () => {
          if (!useHeap) return R.shift();
          const top = R[0], last = R.pop();
          if (R.length) {
            R[0] = last; let i = 0;
            for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < R.length && less(l, m)) m = l; if (r < R.length && less(r, m)) m = r; if (m === i) break; [R[i], R[m]] = [R[m], R[i]]; i = m; }
          }
          return top;
        };
        G.ids.filter((u) => !indeg[u]).forEach(push);
        rec && rec({ line: [0, 1, 2], indeg: { ...indeg }, R: [...R], order: [], vars: { ready: list(R) }, note: useHeap ? `Ready nodes (in-degree 0) go into a <b>min-heap</b>, so the smallest label is always at index 0. Several nodes are ready at once: that choice is the only freedom in a topological sort.` : `Ready nodes go into a <b>FIFO queue</b>: whoever became ready first leaves first, no matter its label.` });
        while (R.length) {
          const choices = [...R].sort(natural);
          const u = pop(); order.push(u);
          const freed = [];
          for (const v of G.adj[u]) if (--indeg[v] === 0) { push(v); freed.push(v); }
          rec && rec({ u, line: freed.length ? [4, 5, 6, 7, 8, 9] : [4, 5, 6], indeg: { ...indeg }, R: [...R], order: [...order], vars: { ready: list(choices), u, order: order.join(" ") }, note: `Ready set was {${choices.join(", ")}}. ${useHeap ? `The heap gives the <b>smallest</b>: ${u}.` : `The queue gives the <b>oldest</b>: ${u}${u !== choices[0] ? `, although ${choices[0]} is smaller` : ""}.`}${freed.length ? ` Deleting ${u}'s arrows frees ${freed.join(", ")}.` : ""}` });
        }
        return order;
      };
      const fr = [];
      const order = run(heapMode, (x) => fr.push({ G, pos, heapMode, ...x }));
      const other = run(!heapMode, null);
      const ok = order.length === G.ids.length, rest = G.ids.filter((u) => !order.includes(u));
      const [h, q] = heapMode ? [order, other] : [other, order];
      const same = h.join() === q.join();
      fr.push({ ...fr[fr.length - 1], u: null, fin: true, rest, line: 3, vars: { "heap order": h.join(" "), "queue order": q.join(" ") }, note: !ok ? `Only ${order.length} of ${G.ids.length} nodes placed: ${rest.join(", ")} are stuck on a cycle. A heap does not change that.` : same ? `Both ready sets give <b>${h.join(" ")}</b> here: the choices never differed. Try the default graph to see them split.` : `Heap: <b>${h.join(" ")}</b>. Queue: ${q.join(" ")}. Both are valid topological orders, but only the heap's is the lexicographically smallest: at every step it takes the smallest node that is allowed. Cost: O((V + E) log V) instead of O(V + E).` });
      return fr;
    },
    render: (f) => {
      const { G } = f, inR = new Set(f.R), placed = new Set(f.order), rest = new Set(f.rest || []);
      const graph = drawDag(G, f.pos, {
        sub: (id) => `in ${f.indeg[id]}`,
        nodeCls: (id) => (id === f.u ? "active" : rest.has(id) ? "bad" : placed.has(id) ? "done" : inR.has(id) ? "visit" : ""),
        edgeCls: (k) => (placed.has(k.split("-")[0]) ? "dim" : f.fin && rest.size ? "bad" : ""),
      });
      const ready = f.heapMode
        ? Viz.array(f.R.length ? f.R : [null], { label: "min-heap array (smallest at [0])", showIdx: !!f.R.length, cls: (i, v) => (v === null ? "dim" : i === 0 ? "path" : "visit") })
        : Viz.queue(f.R, { label: "FIFO queue", cls: () => "visit" });
      const st = strip(f.order, G.edges, { label: "order so far", nodeCls: (id) => (id === f.u ? "active" : "done"), edgeCls: () => "done" });
      return col(Viz.row(graph, side(ready)), st);
    },
  }));

  /* ---------- 6. Longest path / scheduling on a DAG ---------- */
  Viz.register(P("dag-dp"), (el, opts) => Viz.player(el, {
    title: "DP on a DAG: earliest finish times and the critical path",
    tag: "EDIT GRAPH + TIMES",
    legend: [["active", "u (final)"], ["visit", "v being relaxed"], ["done", "processed"], ["path", "critical path"]],
    codeLang: "python",
    code: [
      "start = {u: 0 for u in nodes}",
      "for u in topo_order:      # preds all done",
      "    finish[u] = start[u] + time[u]",
      "    for v in adj[u]:",
      "        if finish[u] > start[v]:  # v waits",
      "            start[v] = finish[u]; best[v] = u",
      "return max(finish.values())",
    ],
    inputs: [
      { key: "edges", label: "edges (u>v)", value: opts.edges || "0>3,1>3,1>4,2>4,3>5,4>5,4>6,5>7,6>7", width: 250 },
      { key: "times", label: "time per node (label order)", value: opts.times || "3,2,5,4,1,2,6,1", width: 160 },
      { key: "measure", label: "measure", type: "select", options: ["course times (LC 2050)", "semesters (LC 1136)"], value: opts.measure || "course times (LC 2050)" },
    ],
    random: () => {
      const n = Viz.rand(6, 9);
      return { edges: randomDag(n, Viz.rand(2, 4)), times: Array.from({ length: n }, () => Viz.rand(1, 9)).join(",") };
    },
    build: ({ edges, times, measure }) => {
      const G = parseDag(edges), sem = String(measure).startsWith("semesters");
      const { order, rest } = kahn(G);
      if (rest.length) throw new Error(`This graph has a cycle through ${rest.join(", ")}, so no schedule exists. Remove a backwards arrow.`);
      let T = Viz.parse.ints(times, { min: 1, max: 12 });
      if (!sem && T.length !== G.ids.length) throw new Error(`Give exactly ${G.ids.length} times, one per node in label order ${G.ids.join(", ")} (you gave ${T.length}).`);
      if (!sem && T.some((t) => !Number.isInteger(t) || t < 1 || t > 99)) throw new Error("Use whole-number times from 1 to 99.");
      const time = Object.fromEntries(G.ids.map((u, i) => [u, sem ? 1 : T[i]]));
      const pos = layered(G, 108, 92), start = Object.fromEntries(G.ids.map((u) => [u, 0])), finish = {}, best = {}, done = new Set(), fr = [];
      const snap = (x) => ({ G, pos, time, start: { ...start }, finish: { ...finish }, best: { ...best }, done: new Set(done), order, ...x });
      fr.push(snap({ line: [0, 1], vars: { order: order.join(" ") }, note: sem ? `Every course takes one semester and any number can run in parallel. Visit nodes in topological order (${order.join(" ")}): when we reach u, every prerequisite has already been settled.` : `Each node is a course with a duration; any number may run in parallel. The answer is the earliest time everything is finished. Visit nodes in topological order (${order.join(" ")}) so that start[u] is final when we reach u.` }));
      for (const u of order) {
        finish[u] = start[u] + time[u]; done.add(u);
        fr.push(snap({ u, line: 2, vars: { u, "start[u]": start[u], "time[u]": time[u], "finish[u]": finish[u] }, note: `<b>${u}</b>: all its prerequisites are processed, so start[${u}] = ${start[u]} is final${best[u] !== undefined ? ` (it waits for ${best[u]})` : G.pred[u].length ? "" : " (no prerequisites)"}. finish[${u}] = ${start[u]} + ${time[u]} = <b>${finish[u]}</b>.` }));
        for (const v of G.adj[u]) {
          const better = finish[u] > start[v], old = start[v];
          if (better) { start[v] = finish[u]; best[v] = u; }
          fr.push(snap({ u, v, cur: ek(u, v), line: better ? [3, 4, 5] : [3, 4], vars: { u, v, "finish[u]": finish[u], "start[v]": start[v] }, note: better ? `${arrow(u, v)}: ${v} cannot start before ${u} finishes. start[${v}] rises from ${old} to <b>${finish[u]}</b>, and ${u} becomes ${v}'s bottleneck.` : `${arrow(u, v)}: ${u} finishes at ${finish[u]}, but ${v} already waits until ${start[v]} for ${best[v]}. No change. (This is a <b>max</b> over predecessors.)` }));
        }
      }
      const ans = Math.max(...Object.values(finish));
      let x = G.ids.find((u) => finish[u] === ans);
      const crit = [x];
      while (best[x] !== undefined) { x = best[x]; crit.unshift(x); }
      fr.push(snap({ fin: true, crit, line: 6, vars: { answer: ans, path: crit.join("→") }, note: `Answer <b>${ans}</b>${sem ? " semesters" : ""}. Following best[] backwards gives the <b>critical path</b> ${crit.join(" → ")}${sem ? "" : ` (${crit.map((c) => time[c]).join(" + ")} = ${ans})`}: delay any node on it and the whole project slips. Every node was processed once and every arrow relaxed once: O(V + E).` }));
      return fr;
    },
    render: (f) => {
      const { G } = f, crit = new Set(f.crit || []);
      const critE = new Set((f.crit || []).slice(1).map((x, i) => ek(f.crit[i], x)));
      const graph = drawDag(G, f.pos, {
        sub: (id) => `t=${f.time[id]}`,
        top: (id) => (id in f.finish ? `F ${f.finish[id]}` : f.start[id] ? `s ${f.start[id]}` : undefined),
        nodeCls: (id) => (crit.has(id) ? "path" : id === f.v ? "visit" : id === f.u ? "active" : f.done.has(id) ? "done" : ""),
        edgeCls: (k) => (critE.has(k) ? "path" : k === f.cur ? "active" : ""),
      });
      const cls = (r, c) => { const id = G.ids[c]; return crit.has(id) ? "path" : id === f.v && r === 1 ? "visit" : id === f.u ? "active" : f.done.has(id) ? "done" : ""; };
      const table = Viz.grid([G.ids.map((u) => f.time[u]), G.ids.map((u) => f.start[u]), G.ids.map((u) => f.finish[u] ?? null)], { label: "schedule table", rowLabels: ["time", "start", "finish"], colLabels: G.ids, cls });
      return Viz.row(graph, table);
    },
  }));

  /* ---------- 7. Longest increasing path in a matrix = peel a DAG layer by layer ---------- */
  Viz.register(P("lip"), (el, opts) => Viz.player(el, {
    title: "Longest increasing path in a matrix: peel the DAG one layer at a time",
    tag: "EDIT THE MATRIX",
    legend: [["active", "current layer"], ["visit", "next layer (in-degree 0)"], ["done", "peeled"], ["path", "one longest path"]],
    codeLang: "python",
    code: [
      "indeg[r][c] = number of smaller neighbours",
      "layer = [cells with indeg 0]  # local minima",
      "length = 0",
      "while layer:",
      "    length += 1  # one more cell on a path",
      "    nxt = []",
      "    for r, c in layer:",
      "        for nr, nc in larger_nbrs(r, c):",
      "            indeg[nr][nc] -= 1  # arrow used",
      "            if indeg[nr][nc] == 0:",
      "                nxt.append((nr, nc))",
      "    layer = nxt",
      "return length",
    ],
    inputs: [
      { key: "m", label: "matrix (rows split by ;)", value: opts.m || "9,9,4;6,6,8;2,1,1", width: 230 },
    ],
    random: () => {
      const R = Viz.rand(3, 5), C = Viz.rand(3, 5);
      return { m: Array.from({ length: R }, () => Array.from({ length: C }, () => Viz.rand(1, 9)).join(",")).join(";") };
    },
    build: ({ m }) => {
      const M = Viz.parse.matrix(m);
      if (!M.length) throw new Error("Enter rows separated by semicolons, e.g. 9,9,4;6,6,8.");
      if (M.length > 6 || M[0].length > 6) throw new Error("Use at most 6 rows and 6 columns.");
      if (M.some((r) => r.length !== M[0].length)) throw new Error("Every row must have the same number of values.");
      if (M.flat().some((v) => typeof v !== "number" || !Number.isInteger(v) || v < -99 || v > 999)) throw new Error("Use whole numbers from -99 to 999.");
      const R = M.length, C = M[0].length, D = [[-1, 0], [0, 1], [1, 0], [0, -1]];
      const nb = (r, c) => D.map(([dr, dc]) => [r + dr, c + dc]).filter(([a, b]) => a >= 0 && b >= 0 && a < R && b < C);
      const indeg = M.map((row, r) => row.map((v, c) => nb(r, c).filter(([a, b]) => M[a][b] < v).length));
      const len = M.map((row) => row.map(() => null));
      let layer = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (!indeg[r][c]) layer.push([r, c]);
      const fr = [], key = (r, c) => `${r},${c}`;
      const snap = (x) => ({ M, indeg: Viz.clone(indeg), len: Viz.clone(len), ...x });
      fr.push(snap({ next: layer.map(([r, c]) => key(r, c)), line: [0, 1, 2], vars: { cells: R * C, "layer 1": layer.length }, note: `Think of an arrow from every cell to each <b>strictly larger</b> neighbour. Values strictly increase along arrows, so there is no cycle: it is a DAG and an increasing path is just a path in it. indeg = number of smaller neighbours. Cells with indeg 0 (local minima, ${layer.length} here) can only <i>start</i> a path.` }));
      let length = 0;
      while (layer.length) {
        length++;
        for (const [r, c] of layer) len[r][c] = length;
        const cur = layer.map(([r, c]) => key(r, c));
        fr.push(snap({ cur, line: [3, 4], vars: { length, layer: layer.length }, note: `Layer <b>${length}</b>: ${cur.length} cell${cur.length > 1 ? "s" : ""} whose smaller neighbours are all peeled. The longest increasing path <i>ending</i> at each of them has exactly ${length} cell${length > 1 ? "s" : ""}.` }));
        const nxt = [], touched = new Set();
        for (const [r, c] of layer) for (const [a, b] of nb(r, c)) if (M[a][b] > M[r][c]) { touched.add(key(a, b)); if (--indeg[a][b] === 0) nxt.push([a, b]); }
        fr.push(snap({ cur, touched, next: nxt.map(([r, c]) => key(r, c)), line: [5, 6, 7, 8, 9, 10, 11], vars: { length, "next layer": nxt.length }, note: nxt.length ? `Delete the arrows leaving layer ${length}: ${touched.size} larger neighbour${touched.size > 1 ? "s lose" : " loses"} in-degree. ${nxt.length} reach 0 and form layer ${length + 1}.` : `No cell reached in-degree 0, so nothing is left to peel.` }));
        layer = nxt;
      }
      let [r, c] = (() => { for (let i = 0; i < R; i++) for (let j = 0; j < C; j++) if (len[i][j] === length) return [i, j]; })();
      const path = [key(r, c)];
      while (len[r][c] > 1) { [r, c] = nb(r, c).find(([a, b]) => M[a][b] < M[r][c] && len[a][b] === len[r][c] - 1); path.unshift(key(r, c)); }
      const vals = path.map((k) => { const [a, b] = k.split(",").map(Number); return M[a][b]; });
      fr.push(snap({ path, fin: true, line: 12, vars: { answer: length }, note: `${length} layer${length > 1 ? "s" : ""}, so the longest increasing path has <b>${length}</b> cell${length > 1 ? "s" : ""}${length > 1 ? `, e.g. ${vals.join(" → ")}` : ""}. Each cell and each arrow was handled once: O(R·C). (Memoized DFS gives the same answer; this is the Kahn view of it.)` }));
      return fr;
    },
    render: (f) => {
      const cur = new Set(f.cur || []), next = new Set(f.next || []), path = new Set(f.path || []), touched = f.touched || new Set();
      const base = (r, c) => { const k = `${r},${c}`; return path.has(k) ? "path" : cur.has(k) ? "active" : next.has(k) ? "visit" : f.len[r][c] !== null ? "done" : ""; };
      const vals = Viz.grid(f.M, { label: "matrix", cls: base });
      const ind = Viz.grid(f.indeg, { label: "indeg (smaller neighbours left)", cls: (r, c) => (touched.has(`${r},${c}`) && !next.has(`${r},${c}`) ? "active" : next.has(`${r},${c}`) ? "visit" : f.len[r][c] !== null ? "dim" : "") });
      const len = Viz.grid(f.len, { label: "layer = longest path ending here", cls: base });
      return Viz.row(vals, ind, len);
    },
  }));
})();
