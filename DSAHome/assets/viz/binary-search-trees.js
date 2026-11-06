/* Binary Search Trees visualizers. Every frame comes from running the real algorithm on the keys you type. */
(() => {
  const S = "binary-search-trees";
  const P = (n) => `${S}-${n}`;
  const esc = Viz.esc;
  const NEG = "−∞", POS = "∞";
  const fmt = (v) => (v === -Infinity ? NEG : v === Infinity ? POS : String(v));

  /* ---------- input parsing ---------- */
  function toks(text) { return String(text).replace(/[[\]]/g, " ").split(/[\s,]+/).filter(Boolean); }
  function ints(text, what, { min = 1, max = 12, distinct = true } = {}) {
    const a = toks(text).map((t) => {
      const v = Number(t);
      if (!Number.isInteger(v) || Math.abs(v) > 999) throw new Error(`"${t}" is not a whole number between -999 and 999.`);
      return v;
    });
    if (a.length < min) throw new Error(`Enter at least ${min} ${what}.`);
    if (a.length > max) throw new Error(`Use at most ${max} ${what} so the picture stays readable (you have ${a.length}).`);
    if (distinct) { const seen = new Set(); for (const v of a) { if (seen.has(v)) throw new Error(`${v} appears twice. Keys in these demos are distinct (a BST as a set).`); seen.add(v); } }
    return a;
  }
  function num(text, what) {
    const v = Number(String(text).trim());
    if (String(text).trim() === "" || !Number.isInteger(v) || Math.abs(v) > 999) throw new Error(`${what} must be a whole number between -999 and 999.`);
    return v;
  }
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function randKeys(n = Viz.rand(7, 11), hi = 40) { return shuffle(Array.from({ length: hi }, (_, i) => i + 1)).slice(0, n); }

  /* ---------- a mutable BST: node ids index parallel arrays ---------- */
  const newTree = () => ({ val: [], L: [], R: [], root: null });
  const snapT = (T) => ({ val: [...T.val], L: [...T.L], R: [...T.R], root: T.root });
  function mk(T, v) { T.val.push(v); T.L.push(null); T.R.push(null); return T.val.length - 1; }
  function insertPlain(T, v) {
    const id = mk(T, v);
    if (T.root === null) { T.root = id; return id; }
    let c = T.root;
    for (;;) { const s = v < T.val[c] ? "L" : "R"; if (T[s][c] === null) { T[s][c] = id; return id; } c = T[s][c]; }
  }
  function fromKeys(keys) { const T = newTree(); keys.forEach((k) => insertPlain(T, k)); return T; }
  function levels(T, u = T.root) { return u === null ? 0 : 1 + Math.max(levels(T, T.L[u]), levels(T, T.R[u])); }
  function inorder(T, u = T.root, out = []) { if (u === null) return out; inorder(T, T.L[u], out); out.push(u); inorder(T, T.R[u], out); return out; }
  function subtree(T, u, out = new Set()) { if (u === null) return out; out.add(u); subtree(T, T.L[u], out); subtree(T, T.R[u], out); return out; }
  function toLevel(T) {
    const out = [], q = [T.root];
    while (q.length) { const u = q.shift(); if (u === null) { out.push("null"); continue; } out.push(String(T.val[u])); q.push(T.L[u], T.R[u]); }
    while (out[out.length - 1] === "null") out.pop();
    return out.join(",");
  }
  function layOf(T, dx = 48) {
    if (T.root === null) return null;
    const h = levels(T);
    const dy = h >= 8 ? 46 : h >= 6 ? 54 : 62;
    return Viz.layoutTree(T.root, (id) => [T.L[id], T.R[id]], (id) => T.val[id], { dx, dy });
  }
  /* level-order parser for trees that may be invalid BSTs (validate / recover) */
  function parseLevel(text, { maxN = 13, maxDepth = 4 } = {}) {
    const t = toks(text);
    if (!t.length) throw new Error("Enter a level-order array such as 5,3,8,1,4.");
    const arr = t.map((s) => {
      if (/^(null|none|nil|#)$/i.test(s)) return null;
      const v = Number(s);
      if (!Number.isInteger(v) || Math.abs(v) > 999) throw new Error(`"${s}" is not a whole number between -999 and 999 (or null).`);
      return v;
    });
    if (arr[0] === null) throw new Error("The root cannot be null.");
    const T = newTree(), depth = [0];
    T.root = mk(T, arr[0]);
    const q = [T.root];
    let i = 1;
    while (q.length && i < arr.length) {
      const p = q.shift();
      for (const side of ["L", "R"]) {
        if (i >= arr.length) break;
        if (arr[i] !== null) { const c = mk(T, arr[i]); T[side][p] = c; depth[c] = depth[p] + 1; q.push(c); }
        i++;
      }
    }
    if (arr.slice(i).some((v) => v !== null)) throw new Error(`Entry ${i} (${arr[i]}) has no parent slot left, so the array is too long.`);
    if (T.val.length > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${T.val.length}).`);
    if (Math.max(...depth) > maxDepth) throw new Error(`Keep the tree at most ${maxDepth + 1} levels deep.`);
    return T;
  }

  /* ---------- drawing helpers ---------- */
  function draw(T, o = {}) {
    const lay = o.lay || layOf(T, o.dx);
    if (!lay) return `<div class="v-labeled"><span class="v-caption">${esc(o.label || "tree")}</span><div class="bst-empty">empty tree (root is None)</div></div>`;
    const hidden = o.hidden || (() => false);
    const nodes = lay.nodes.map((nd) => ({ ...nd, label: o.lbl ? o.lbl(nd.id) : nd.label, sub: o.sub ? o.sub(nd.id) : undefined, top: o.top ? o.top(nd.id) : undefined }));
    return Viz.graph({ nodes, edges: lay.edges.map((e) => ({ ...e })) }, {
      r: 19,
      label: o.label,
      nodeCls: (id) => (hidden(Number(id)) ? "bst-hide" : (o.cls && o.cls(Number(id))) || ""),
      edgeCls: (k) => {
        const [u, v] = k.split("-").map(Number);
        if (T.L[u] !== v && T.R[u] !== v) return "";
        if (hidden(v)) return "bst-hide";
        return (o.ecls && o.ecls(u, v)) || "";
      },
    });
  }
  function stackHtml(cards, { label = "call stack (top = running)", max = 6 } = {}) {
    const shown = cards.slice(-max), more = cards.length - shown.length;
    const html = shown.map((c, k) => `<div class="bst-frame ${c.cls || (k === shown.length - 1 ? "active" : "visit")}"><div class="bst-fhead"><b>${esc(c.t)}</b>${c.s ? `<span>${esc(c.s)}</span>` : ""}</div></div>`).reverse().join("");
    return `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="bst-stack">${html || '<div class="bst-more">empty</div>'}${more > 0 ? `<div class="bst-more">+ ${more} older frame${more > 1 ? "s" : ""} below</div>` : ""}<div class="bst-floor">bottom</div></div></div>`;
  }
  function seq(label, vals, { cls } = {}) {
    if (!vals.length) return `<div class="v-labeled bst-seq"><span class="v-caption">${esc(label)}</span><div class="bst-none">nothing yet</div></div>`;
    return `<div class="bst-seq">${Viz.array(vals, { label, showIdx: false, cls: cls || (() => "done") })}</div>`;
  }
  const col = (...parts) => `<div class="bst-col">${parts.filter(Boolean).join("")}</div>`;
  const pathEdges = (path) => { const s = new Set(); for (let i = 1; i < path.length; i++) s.add(`${path[i - 1]}-${path[i]}`); return s; };

  /* ======================================================================
     1. Insert: walk down, narrowing the window, attach at the first empty slot
     ====================================================================== */
  const ORDERS = ["as typed", "sorted (worst case)", "random shuffle", "median first (balanced)"];
  function medianOrder(sorted) { const out = []; const go = (lo, hi) => { if (lo > hi) return; const m = (lo + hi) >> 1; out.push(sorted[m]); go(lo, m - 1); go(m + 1, hi); }; go(0, sorted.length - 1); return out; }
  Viz.register(P("insert"), (el, opts) => Viz.player(el, {
    title: "Insert: every comparison halves the number line",
    tag: "TRY THE SORTED ORDER",
    legend: [["active", "comparing x with this node"], ["visit", "path taken"], ["done", "just attached"], ["dim", "outside x's window"]],
    codeLang: "python",
    code: [
      "def insert(root, x):",
      "    if root is None: return TreeNode(x)        # empty tree: x is the root",
      "    cur = root",
      "    while True:",
      "        if x < cur.val:                         # x belongs in the left subtree",
      "            if cur.left is None: cur.left = TreeNode(x); break",
      "            cur = cur.left",
      "        else:                                   # x > cur.val (keys are distinct)",
      "            if cur.right is None: cur.right = TreeNode(x); break",
      "            cur = cur.right",
      "    return root",
    ],
    inputs: [
      { key: "keys", label: "keys to insert", value: opts.keys || "8,3,10,1,6,14,4,7,13", width: 240 },
      { key: "order", label: "insertion order", type: "select", options: ORDERS, value: opts.order || ORDERS[0] },
    ],
    random: () => ({ keys: randKeys(Viz.rand(6, 11), 30).join(",") }),
    build: ({ keys, order }) => {
      let a = ints(keys, "keys", { max: 12 });
      const sorted = [...a].sort((x, y) => x - y);
      if (order === ORDERS[1]) a = sorted; else if (order === ORDERS[2]) a = shuffle([...a]); else if (order === ORDERS[3]) a = medianOrder(sorted);
      const F = fromKeys(a), lay = layOf(F);
      const ins = new Set(), fr = [];
      const snap = (x) => ({ F, lay, a, ins: new Set(ins), ...x });
      fr.push(snap({ line: 0, step: -1, vars: { order: a.join(", ") }, note: `Insert ${a.length} keys in this order: <b>${a.join(", ")}</b>. Watch the strip under the tree: it is the sorted list of keys inserted so far, and every comparison rules out one side of it, exactly like binary search.` }));
      a.forEach((x, i) => {
        if (i === 0) {
          ins.add(0);
          fr.push(snap({ line: 1, step: 0, x, added: 0, path: [], lo: -Infinity, hi: Infinity, vars: { x, cur: "None" }, note: `The tree is empty, so <b>${x}</b> becomes the root. Its window is (${NEG}, ${POS}): any key is allowed.` }));
          return;
        }
        let c = F.root, lo = -Infinity, hi = Infinity;
        const path = [];
        fr.push(snap({ line: 2, step: i, x, cur: c, path: [], lo, hi, vars: { x, cur: F.val[c], window: `(${NEG}, ${POS})` }, note: `Insert <b>${x}</b>. Start at the root ${F.val[c]}.` }));
        for (;;) {
          path.push(c);
          const goLeft = x < F.val[c], s = goLeft ? "L" : "R", child = F[s][c];
          if (goLeft) hi = F.val[c]; else lo = F.val[c];
          const open = !(child !== null && ins.has(child));
          const w = `(${fmt(lo)}, ${fmt(hi)})`;
          const cmp = `${x} ${goLeft ? "&lt;" : "&gt;"} ${F.val[c]}, so ${x} belongs in the <b>${goLeft ? "left" : "right"}</b> subtree and every key ${goLeft ? "≥" : "≤"} ${F.val[c]} is ruled out: the window is now ${esc(w)}.`;
          if (open) {
            ins.add(i);
            fr.push(snap({ line: goLeft ? [4, 5] : [7, 8], step: i, x, cur: c, added: i, path: [...path, i], lo, hi, vars: { x, parent: F.val[c], side: goLeft ? "left" : "right", window: w }, note: `${cmp} That slot is empty: attach <b>${x}</b> there. ${path.length} comparison${path.length > 1 ? "s" : ""}, one per level. A new key always becomes a <i>leaf</i>; nothing above it moves.` }));
            break;
          }
          fr.push(snap({ line: goLeft ? [4, 6] : [7, 9], step: i, x, cur: c, path: [...path], lo, hi, vars: { x, cur: F.val[c], window: w }, note: `${cmp} Step down to ${F.val[child]}.` }));
          c = child;
        }
      });
      const h = levels(F), best = Math.ceil(Math.log2(a.length + 1));
      const chain = h === a.length && a.length > 2;
      fr.push(snap({ line: 10, step: a.length, path: [], vars: { n: a.length, levels: h, "best possible": best }, note: chain ? `<b>Degenerate:</b> ${a.length} keys, ${h} levels. Every node has one child, so this "tree" is a linked list and search costs O(n). Sorted input always does this to a plain BST. Try "median first" or the AVL demo further down.` : `Done: ${a.length} keys in ${h} levels (the minimum possible is ${best}). Search, insert and delete all cost O(h), so the shape decides the speed. Read the nodes left to right: they are sorted.` }));
      return fr;
    },
    render: (f) => {
      const pe = pathEdges(f.path || []), path = new Set(f.path || []);
      const keys = [...f.ins].map((id) => f.F.val[id]).sort((x, y) => x - y);
      const inWin = (v) => f.lo === undefined || (v > f.lo && v < f.hi);
      const nx = f.added !== undefined ? f.F.val[f.added] : null;
      return col(
        draw(f.F, {
          lay: f.lay,
          hidden: (id) => !f.ins.has(id),
          cls: (id) => (id === f.added ? "done" : id === f.cur ? "active" : path.has(id) ? "visit" : f.lo !== undefined && f.step >= 0 && f.step < f.a.length && !inWin(f.F.val[id]) ? "dim" : ""),
          ecls: (u, v) => (pe.has(`${u}-${v}`) ? (v === f.added ? "done" : "visit") : ""),
        }),
        keys.length ? Viz.array(keys, { label: "keys in the tree, sorted (= inorder)", showIdx: false, cls: (k, v) => (v === nx ? "done" : f.F.val[f.cur] === v ? "active" : !inWin(v) && f.x !== undefined ? "dim" : "") }) : "",
      );
    },
  }));

  /* ======================================================================
     2. Search / floor / ceiling: one loop, one remembered candidate
     ====================================================================== */
  const FMODES = ["search", "floor (largest ≤ x)", "ceiling (smallest ≥ x)"];
  Viz.register(P("search"), (el, opts) => Viz.player(el, {
    title: "Search, floor and ceiling: discard half, remember the best candidate",
    tag: "PICK A QUERY",
    legend: [["active", "cur"], ["visit", "path"], ["done", "best candidate so far"], ["dim", "ruled out"]],
    codeLang: "python",
    code: [
      "def find(root, x, mode):",
      "    best, cur = None, root",
      "    while cur:",
      "        if cur.val == x: return cur.val           # exact hit answers all three",
      "        if cur.val < x:                            # cur and its left subtree are too small",
      "            if mode == 'floor': best = cur.val     #   ...but cur may be the floor",
      "            cur = cur.right",
      "        else:                                      # cur and its right subtree are too big",
      "            if mode == 'ceil': best = cur.val      #   ...but cur may be the ceiling",
      "            cur = cur.left",
      "    return best                                    # None if nothing qualifies",
    ],
    inputs: [
      { key: "keys", label: "keys (insertion order)", value: opts.keys || "20,8,30,4,12,25,40,10,14,22,27", width: 240 },
      { key: "x", label: "x", value: opts.x || "13", width: 60 },
      { key: "mode", label: "query", type: "select", options: FMODES, value: opts.mode || FMODES[1] },
    ],
    random: () => ({ keys: randKeys(Viz.rand(7, 12), 40).join(","), x: String(Viz.rand(0, 42)) }),
    build: ({ keys, x, mode }) => {
      const a = ints(keys, "keys", { max: 13 }), X = num(x, "x");
      const T = fromKeys(a), lay = layOf(T);
      const m = mode === FMODES[1] ? "floor" : mode === FMODES[2] ? "ceil" : "search";
      const out = new Set(), path = [], fr = [];
      let best = null, cur = T.root;
      const snap = (y) => ({ T, lay, out: new Set(out), path: [...path], best, cur, X, ...y });
      fr.push(snap({ line: 1, vars: { x: X, mode: m, best: "None" }, note: `${m === "search" ? `Is <b>${X}</b> in the tree?` : m === "floor" ? `Floor of <b>${X}</b>: the largest key ≤ ${X}.` : `Ceiling of <b>${X}</b>: the smallest key ≥ ${X}.`} Each comparison throws away a whole subtree, so the work is the height, not n.` }));
      while (cur !== null) {
        path.push(cur);
        const v = T.val[cur];
        if (v === X) {
          best = cur;
          fr.push(snap({ line: 3, hit: true, vars: { x: X, cur: v, answer: v }, note: `<b>${v} == ${X}</b>: found. For floor and ceiling an exact match is the answer too.` }));
          fr.push(snap({ line: 3, end: true, ans: v, vars: { answer: v, compared: path.length }, note: `Answer <b>${v}</b> after ${path.length} comparison${path.length > 1 ? "s" : ""}.` }));
          return fr;
        }
        if (v < X) {
          const gone = subtree(T, T.L[cur]);
          if (m === "floor") { if (best !== null) out.add(best); best = cur; }
          fr.push(snap({ line: m === "floor" ? [4, 5] : 4, vars: { x: X, cur: v, best: best === null ? "None" : T.val[best] }, note: `${v} &lt; ${X}. Everything in ${v}'s left subtree is even smaller, so it cannot beat ${v}: rule it out (${gone.size} node${gone.size === 1 ? "" : "s"}).${m === "floor" ? ` <b>${v}</b> is ≤ ${X}, so it becomes the best floor so far; anything better must be to its right.` : ""}` }));
          gone.forEach((g) => out.add(g)); if (m !== "floor") out.add(cur);
          cur = T.R[cur];
          fr.push(snap({ line: 6, vars: { x: X, cur: cur === null ? "None" : T.val[cur], best: best === null ? "None" : T.val[best] }, note: cur === null ? `${v} has no right child: nothing left to look at.` : `Go right to ${T.val[cur]}.` }));
        } else {
          const gone = subtree(T, T.R[cur]);
          if (m === "ceil") { if (best !== null) out.add(best); best = cur; }
          fr.push(snap({ line: m === "ceil" ? [7, 8] : 7, vars: { x: X, cur: v, best: best === null ? "None" : T.val[best] }, note: `${v} &gt; ${X}. Everything in ${v}'s right subtree is even bigger: rule it out (${gone.size} node${gone.size === 1 ? "" : "s"}).${m === "ceil" ? ` <b>${v}</b> is ≥ ${X}, so it becomes the best ceiling so far; anything better must be to its left.` : ""}` }));
          gone.forEach((g) => out.add(g)); if (m !== "ceil") out.add(cur);
          cur = T.L[cur];
          fr.push(snap({ line: 9, vars: { x: X, cur: cur === null ? "None" : T.val[cur], best: best === null ? "None" : T.val[best] }, note: cur === null ? `${v} has no left child: nothing left to look at.` : `Go left to ${T.val[cur]}.` }));
        }
      }
      const ans = best === null ? null : T.val[best];
      fr.push(snap({ line: 10, end: true, ans, vars: { answer: ans === null ? "None" : ans, compared: path.length }, note: m === "search" ? `Fell off the tree: <b>${X} is not present</b>. ${path.length} comparisons.` : ans === null ? `No key qualifies, so the answer is <b>None</b>.` : `Fell off the tree. The last candidate recorded is the answer: <b>${ans}</b>. It is the ${m === "floor" ? "last node where we turned right" : "last node where we turned left"}.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pe = pathEdges(f.path);
      const sorted = inorder(f.T);
      return col(
        draw(f.T, {
          lay: f.lay,
          top: (id) => (id === f.best && !f.hit ? "best" : undefined),
          cls: (id) => (id === f.best ? "done" : id === f.cur ? "active" : path.has(id) ? "visit" : f.out.has(id) ? "dim" : ""),
          ecls: (u, v) => (pe.has(`${u}-${v}`) ? "visit" : ""),
        }),
        Viz.array(sorted.map((id) => f.T.val[id]), { label: `sorted keys (x = ${f.X})`, showIdx: false, cls: (k) => { const id = sorted[k]; return id === f.best ? "done" : id === f.cur ? "active" : f.out.has(id) ? "dim" : ""; } }),
      );
    },
  }));

  /* ======================================================================
     3. Delete: the three cases and the successor swap
     ====================================================================== */
  Viz.register(P("delete"), (el, opts) => Viz.player(el, {
    title: "Delete: leaf, one child, or two children (copy the successor)",
    tag: "THREE CASES",
    legend: [["bad", "node holding the key"], ["path", "successor search"], ["active", "current call"], ["visit", "waiting calls"], ["done", "re-linked child"]],
    codeLang: "python",
    code: [
      "def delete(root, key):",
      "    if not root: return None                     # key is not in the tree",
      "    if key < root.val:   root.left = delete(root.left, key)",
      "    elif key > root.val: root.right = delete(root.right, key)",
      "    else:                                        # root holds the key",
      "        if not root.left:  return root.right     # 0 or 1 child: splice it out",
      "        if not root.right: return root.left",
      "        s = root.right                           # 2 children:",
      "        while s.left: s = s.left                 #   successor = leftmost of right subtree",
      "        root.val = s.val                         #   copy the successor's key up",
      "        root.right = delete(root.right, s.val)   #   and delete it below (it has no left child)",
      "    return root",
    ],
    inputs: [
      { key: "keys", label: "keys (insertion order)", value: opts.keys || "50,30,70,20,40,60,80,35,45,65,32", width: 260 },
      { key: "key", label: "delete", value: opts.key || "30", width: 60 },
    ],
    random: () => { const k = randKeys(Viz.rand(6, 11), 40); return { keys: k.join(","), key: String(Math.random() < 0.9 ? k[Viz.rand(0, k.length - 1)] : 41) }; },
    build: ({ keys, key }) => {
      const a = ints(keys, "keys", { max: 12 }), K = num(key, "key");
      const T = fromKeys(a), fr = [];
      const stack = [];
      let target = null, succ = null, sPath = [], relinked = null, removed = null;
      const snap = (x) => ({ T: snapT(T), cards: stack.map((s) => ({ t: `delete(${s.v}, ${s.k})`, s: s.at })), calls: stack.map((s) => s.id), target, succ, sPath: [...sPath], relinked, removed, ...x });
      fr.push(snap({ line: 0, vars: { key: K }, note: `Delete <b>${K}</b>. The recursion walks down like a search; each call <i>returns the new root of its subtree</i> and the parent re-links to whatever comes back. That one idea handles every case.` }));
      const del = (u, k) => {
        if (u === null) {
          stack.push({ id: null, v: "None", k, at: "returns None" });
          fr.push(snap({ line: 1, vars: { key: k }, note: `Reached an empty spot: <b>${k} is not in the tree</b>. Return None, which the parent stores back into the same empty slot. Nothing changes.` }));
          stack.pop();
          return null;
        }
        const fr0 = { id: u, v: T.val[u], k, at: "" };
        stack.push(fr0);
        const v = T.val[u];
        if (k !== v) {
          const side = k < v ? "L" : "R";
          fr0.at = `go ${side === "L" ? "left" : "right"}`;
          fr.push(snap({ cur: u, line: side === "L" ? 2 : 3, vars: { key: k, "root.val": v }, note: `${k} ${k < v ? "&lt;" : "&gt;"} ${v}: the key can only be in the ${side === "L" ? "left" : "right"} subtree. Recurse there; whatever comes back becomes ${v}.${side === "L" ? "left" : "right"}.` }));
          const before = T[side][u];
          const r = del(before, k);
          T[side][u] = r;
          fr0.at = "re-linked";
          relinked = r !== before ? r : null;
          fr.push(snap({ cur: u, line: side === "L" ? 2 : 3, vars: { key: k, [`${v}.${side === "L" ? "left" : "right"}`]: r === null ? "None" : T.val[r] }, note: r !== before ? `Back in ${v}: set ${v}.${side === "L" ? "left" : "right"} = ${r === null ? "None" : T.val[r]}. The deleted node is no longer reachable.` : `Back in ${v}: the child link is unchanged.` }));
          relinked = null;
          stack.pop();
          return u;
        }
        target = u;
        const nl = T.L[u] === null, nr = T.R[u] === null;
        if (nl || nr) {
          const r = nl ? T.R[u] : T.L[u];
          fr0.at = nl && nr ? "leaf" : "one child";
          fr.push(snap({ cur: u, line: nl ? 5 : 6, vars: { key: k, case: nl && nr ? "leaf" : "one child", returns: r === null ? "None" : T.val[r] }, note: nl && nr ? `Found <b>${v}</b>. It is a <b>leaf</b>: return None so the parent simply drops it.` : `Found <b>${v}</b>. It has <b>one child</b> (${T.val[r]}): return that child, so the parent links straight to it. The whole subtree of ${T.val[r]} moves up one level and stays in order, because it was already on the correct side of the parent.` }));
          removed = u;
          stack.pop();
          if (target === u) target = null;
          return r;
        }
        fr0.at = "two children";
        fr.push(snap({ cur: u, line: 4, vars: { key: k, case: "two children" }, note: `Found <b>${v}</b> with <b>two children</b>. We cannot splice it out: two subtrees would need one parent slot. Instead, find a key that can take its place: the <b>successor</b>, the smallest key bigger than ${v}.` }));
        let s = T.R[u];
        sPath = [s]; succ = s;
        fr.push(snap({ cur: u, line: 7, vars: { key: k, s: T.val[s] }, note: `The successor lives in the right subtree (everything there is &gt; ${v})...` }));
        while (T.L[s] !== null) { s = T.L[s]; sPath.push(s); succ = s; fr.push(snap({ cur: u, line: 8, vars: { key: k, s: T.val[s] }, note: `...as far <b>left</b> as possible: step to ${T.val[s]}.` })); }
        fr.push(snap({ cur: u, line: 8, vars: { key: k, successor: T.val[s] }, note: `${T.val[s]} has no left child, so it is the minimum of the right subtree: the <b>successor</b>. It is bigger than everything in ${v}'s left subtree and smaller than everything else on the right, so it can sit exactly where ${v} is.` }));
        T.val[u] = T.val[s];
        fr0.v = T.val[u];
        fr.push(snap({ cur: u, line: 9, copied: true, vars: { key: k, "root.val": T.val[u] }, note: `Copy ${T.val[s]} up into the node that held ${v}. Now ${T.val[s]} appears twice; the lower copy must go. It has <b>at most one child</b> (no left child), so deleting it is the easy case.` }));
        const sv = T.val[s];
        succ = null; sPath = []; target = null;
        fr0.at = `delete ${sv} below`;
        const r = del(T.R[u], sv);
        T.R[u] = r;
        relinked = r;
        fr0.at = "re-linked";
        fr.push(snap({ cur: u, line: 10, vars: { "root.val": T.val[u], "root.right": r === null ? "None" : T.val[r] }, note: `Back in ${T.val[u]}: re-link its right child. Key ${v} is gone and the tree is still a valid BST.` }));
        relinked = null;
        stack.pop();
        return u;
      };
      T.root = del(T.root, K);
      removed = null;
      const left = inorder(T).map((id) => T.val[id]);
      fr.push(snap({ line: 11, end: true, vars: { inorder: left.join(", ") || "(empty)" }, note: a.includes(K) ? `Done. Inorder is still sorted: ${left.join(", ") || "(empty)"}. Cost: one root-to-leaf walk, O(h).` : `Done. ${K} was never in the tree, so it is unchanged.` }));
      return fr;
    },
    render: (f) => {
      const calls = new Set(f.calls), sp = new Set(f.sPath), pe = pathEdges(f.sPath);
      const lay = layOf(f.T);
      const keep = new Set(inorder(f.T));
      return col(
        Viz.row(
          draw(f.T, {
            lay,
            top: (id) => (id === f.succ ? "successor" : undefined),
            cls: (id) => (id === f.removed && keep.has(id) ? "bad" : id === f.target ? "bad" : sp.has(id) ? "path" : id === f.relinked ? "done" : id === f.cur ? (f.copied ? "done" : "active") : calls.has(id) ? "visit" : ""),
            ecls: (u, v) => (pe.has(`${u}-${v}`) ? "path" : v === f.relinked ? "done" : calls.has(u) && calls.has(v) ? "visit" : ""),
          }),
          stackHtml(f.cards),
        ),
        seq("inorder (always sorted)", inorder(f.T).map((id) => f.T.val[id]), { cls: (k) => { const id = inorder(f.T)[k]; return id === f.target ? "bad" : id === f.succ ? "path" : "done"; } }),
      );
    },
  }));

  /* ======================================================================
     4. Validate with (lo, hi) windows
     ====================================================================== */
  Viz.register(P("validate"), (el, opts) => Viz.player(el, {
    title: "Validate a BST: every node inherits a window from all its ancestors",
    tag: "THE PARENT-ONLY TRAP",
    legend: [["active", "checking"], ["visit", "on the call stack"], ["done", "inside its window"], ["bad", "outside its window"]],
    codeLang: "python",
    code: [
      "def valid(node, lo=-inf, hi=inf):",
      "    if not node: return True",
      "    if not (lo < node.val < hi): return False     # outside the window its ancestors allow",
      "    return (valid(node.left, lo, node.val)         # left subtree: hi tightens to node.val",
      "            and valid(node.right, node.val, hi))   # right subtree: lo tightens to node.val",
    ],
    inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "10,5,15,2,7,12,20,null,null,6,11", width: 280 }],
    random: () => {
      const T = fromKeys(randKeys(Viz.rand(6, 10), 30));
      if (levels(T) > 5) return { t: "10,5,15,2,7,12,20,null,null,6,11" };
      if (Math.random() < 0.6) { const ids = T.val.map((_, i) => i); const i = ids[Viz.rand(0, ids.length - 1)]; T.val[i] = Viz.rand(1, 30); }
      return { t: toLevel(T) };
    },
    build: ({ t }) => {
      const T = parseLevel(t, { maxN: 13, maxDepth: 4 });
      const win = {}, ok = new Set(), stack = [], fr = [];
      let bad = null;
      const snap = (x) => ({ T, win: { ...win }, ok: new Set(ok), bad, calls: stack.map((s) => s.id), cards: stack.map((s) => ({ t: `valid(${T.val[s.id]}, ${fmt(s.lo)}, ${fmt(s.hi)})` })), ...x });
      fr.push(snap({ line: 0, vars: {}, note: `A BST needs <b>every</b> key in a left subtree to be smaller than the node, not just the left child. So each node carries a window (lo, hi) built from all of its ancestors. The window is drawn under each node as it is checked.` }));
      const parentOf = {};
      T.L.forEach((c, p) => { if (c !== null) parentOf[c] = p; });
      T.R.forEach((c, p) => { if (c !== null) parentOf[c] = p; });
      const go = (u, lo, hi) => {
        if (u === null) return true;
        win[u] = [lo, hi];
        stack.push({ id: u, lo, hi });
        const v = T.val[u];
        const inside = lo < v && v < hi;
        const p = parentOf[u];
        let parentSays = "";
        if (p !== undefined) {
          const isL = T.L[p] === u, pv = T.val[p];
          const pOk = isL ? v < pv : v > pv;
          parentSays = pOk && !inside ? ` A parent-only check would <b>pass</b> it (${v} ${isL ? "&lt;" : "&gt;"} ${pv}), which is exactly the classic bug.` : "";
        }
        if (!inside) {
          bad = u;
          fr.push(snap({ cur: u, line: 2, vars: { node: v, lo: fmt(lo), hi: fmt(hi) }, note: `<b>${v}</b> must lie in (${fmt(lo)}, ${fmt(hi)}) but it does not: ${v <= lo ? `${v} ≤ ${fmt(lo)}` : `${v} ≥ ${fmt(hi)}`}.${parentSays} Return False all the way up.` }));
          stack.pop();
          return false;
        }
        ok.add(u);
        fr.push(snap({ cur: u, line: 2, vars: { node: v, lo: fmt(lo), hi: fmt(hi) }, note: `${fmt(lo)} &lt; <b>${v}</b> &lt; ${fmt(hi)}: inside its window. Its left child gets (${fmt(lo)}, ${v}) and its right child gets (${v}, ${fmt(hi)}).` }));
        if (T.L[u] !== null) fr.push(snap({ cur: u, line: 3, vars: { node: v, "left window": `(${fmt(lo)}, ${v})` }, note: `Check the left subtree with hi tightened to ${v}.` }));
        if (!go(T.L[u], lo, v)) { stack.pop(); return false; }
        if (T.R[u] !== null) fr.push(snap({ cur: u, line: 4, vars: { node: v, "right window": `(${v}, ${fmt(hi)})` }, note: `Left side of ${v} is fine. Check the right subtree with lo tightened to ${v}.` }));
        if (!go(T.R[u], v, hi)) { stack.pop(); return false; }
        stack.pop();
        return true;
      };
      const res = go(T.root, -Infinity, Infinity);
      let naive = true;
      T.L.forEach((c, p) => { if (c !== null && !(T.val[c] < T.val[p])) naive = false; });
      T.R.forEach((c, p) => { if (c !== null && !(T.val[c] > T.val[p])) naive = false; });
      fr.push(snap({ line: res ? 3 : 2, end: true, res, vars: { valid: res ? "True" : "False", "parent-only check says": naive ? "True" : "False" }, note: res ? `Every node sat inside its window: <b>valid BST</b>. O(n) time, O(h) stack.` : `<b>Not a valid BST.</b> ${naive ? "The parent-only check says True here, so it would be wrong." : "Here even the parent-only check catches it, but it would miss deeper violations."}` }));
      return fr;
    },
    render: (f) => {
      const calls = new Set(f.calls);
      return Viz.row(
        draw(f.T, {
          dx: 56,
          sub: (id) => (f.win[id] ? `(${fmt(f.win[id][0])},${fmt(f.win[id][1])})` : undefined),
          cls: (id) => (id === f.bad ? "bad" : id === f.cur ? "active" : calls.has(id) ? "visit" : f.ok.has(id) ? "done" : ""),
          ecls: (u, v) => (calls.has(u) && (calls.has(v) || v === f.bad) ? "visit" : ""),
        }),
        stackHtml(f.cards),
      );
    },
  }));

  /* ======================================================================
     5. BST iterator / k-th smallest: a controlled inorder
     ====================================================================== */
  Viz.register(P("iter"), (el, opts) => Viz.player(el, {
    title: "BST iterator and k-th smallest: inorder, one step at a time",
    tag: "STACK OF LEFT SPINES",
    legend: [["active", "popped now"], ["visit", "on the stack"], ["done", "already returned"]],
    codeLang: "python",
    code: [
      "class BSTIterator:",
      "    def __init__(self, root):",
      "        self.st = []; self.push_left(root)",
      "    def push_left(self, node):",
      "        while node: self.st.append(node); node = node.left",
      "    def next(self):",
      "        node = self.st.pop()            # smallest key not yet returned",
      "        self.push_left(node.right)      # queue up its successors",
      "        return node.val",
      "# k-th smallest: call next() k times",
    ],
    inputs: [
      { key: "keys", label: "keys (insertion order)", value: opts.keys || "8,3,10,1,6,14,4,7,13", width: 230 },
      { key: "k", label: "k", value: opts.k || "6", width: 50 },
    ],
    random: () => { const k = randKeys(Viz.rand(6, 11), 30); return { keys: k.join(","), k: String(Viz.rand(1, k.length)) }; },
    build: ({ keys, k }) => {
      const a = ints(keys, "keys", { max: 13 }), K = num(k, "k");
      if (K < 1 || K > a.length) throw new Error(`k must be between 1 and ${a.length}.`);
      const T = fromKeys(a), lay = layOf(T);
      const st = [], out = [], fr = [];
      let maxSt = 0;
      const snap = (x) => ({ T, lay, st: [...st], out: [...out], ...x });
      const pushLeft = (u, why) => {
        if (u === null) { fr.push(snap({ line: 4, vars: { k: K, "next() calls": out.length, "stack size": st.length }, note: `${why} Nothing to push.` })); return; }
        const pushed = [];
        while (u !== null) { st.push(u); pushed.push(T.val[u]); u = T.L[u]; }
        maxSt = Math.max(maxSt, st.length);
        fr.push(snap({ line: 4, pushed: new Set(st.slice(-pushed.length)), vars: { k: K, "next() calls": out.length, "stack size": st.length }, note: `${why} Push the left spine: <b>${pushed.join(" → ")}</b>. The top of the stack is now the smallest key not yet returned.` }));
      };
      fr.push(snap({ line: 2, vars: { k: K }, note: `The iterator is the iterative inorder walk frozen between steps. The stack holds the nodes whose left side is finished but which are not returned yet. It never holds more than h nodes.` }));
      pushLeft(T.root, "Constructor:");
      while (out.length < K) {
        const u = st.pop();
        out.push(u);
        fr.push(snap({ cur: u, line: [6, 8], vars: { k: K, "next() calls": out.length, returns: T.val[u] }, note: `next() #${out.length}: pop <b>${T.val[u]}</b>. Everything smaller is already returned, so it is the ${out.length}${out.length === 1 ? "st" : out.length === 2 ? "nd" : out.length === 3 ? "rd" : "th"} smallest.` }));
        pushLeft(T.R[u], T.R[u] === null ? `${T.val[u]} has no right subtree.` : `The next keys after ${T.val[u]} are in its right subtree, starting with that subtree's leftmost node.`);
      }
      fr.push(snap({ line: 9, end: true, vars: { k: K, answer: T.val[out[K - 1]], "max stack": maxSt, height: levels(T) }, note: `The ${K}-th smallest is <b>${T.val[out[K - 1]]}</b>. We touched only about h + k nodes, not all ${a.length}. Each next() is O(1) amortized: every node is pushed and popped once in total.` }));
      return fr;
    },
    render: (f) => {
      const onSt = new Set(f.st), done = new Set(f.out);
      return col(
        Viz.row(
          draw(f.T, { lay: f.lay, cls: (id) => (id === f.cur ? "active" : onSt.has(id) ? "visit" : done.has(id) ? "done" : "") }),
          Viz.stack(f.st.map((id) => f.T.val[id]), { label: "st", cls: (i) => (f.pushed && f.pushed.has(f.st[i]) ? "active" : "visit") }),
        ),
        seq("next() returned", f.out.map((id) => f.T.val[id]), { cls: (i) => (i === f.out.length - 1 && f.cur !== undefined ? "active" : "done") }),
      );
    },
  }));

  /* ======================================================================
     6. Sorted array -> height-balanced BST
     ====================================================================== */
  Viz.register(P("balanced"), (el, opts) => Viz.player(el, {
    title: "Sorted array to balanced BST: the middle is the root, recursively",
    tag: "DIVIDE AT THE MIDDLE",
    legend: [["active", "mid of the current range"], ["visit", "current range"], ["done", "built"]],
    codeLang: "python",
    code: [
      "def build(lo, hi):",
      "    if lo > hi: return None",
      "    mid = (lo + hi) // 2",
      "    node = TreeNode(a[mid])            # the middle key splits the rest evenly",
      "    node.left = build(lo, mid - 1)     # smaller half",
      "    node.right = build(mid + 1, hi)    # larger half",
      "    return node",
      "root = build(0, len(a) - 1)",
    ],
    inputs: [{ key: "a", label: "sorted keys", value: opts.a || "1,2,3,4,5,6,7,8,9,10", width: 300 }],
    random: () => ({ a: randKeys(Viz.rand(5, 15), 40).sort((x, y) => x - y).join(",") }),
    build: ({ a: text }) => {
      const a = ints(text, "keys", { max: 15 });
      for (let i = 1; i < a.length; i++) if (a[i] <= a[i - 1]) throw new Error("The keys must be strictly increasing (sorted, no duplicates).");
      const F = newTree();
      a.forEach((v) => mk(F, v));
      const rec = (lo, hi) => { if (lo > hi) return null; const m = (lo + hi) >> 1; F.L[m] = rec(lo, m - 1); F.R[m] = rec(m + 1, hi); return m; };
      F.root = rec(0, a.length - 1);
      const lay = layOf(F);
      const built = new Set(), stack = [], fr = [];
      const snap = (x) => ({ F, lay, a, built: new Set(built), cards: stack.map((s) => ({ t: `build(${s.lo}, ${s.hi})`, s: s.m !== undefined ? `mid ${s.m}` : "" })), ...x });
      fr.push(snap({ line: 7, vars: { n: a.length }, note: `Inserting sorted keys one by one makes a chain. Instead, pick the <b>middle</b> key as the root: half the keys go left, half go right, and each half repeats the trick. Height ends up ⌈log₂(n+1)⌉ = ${Math.ceil(Math.log2(a.length + 1))}.` }));
      const go = (lo, hi, side) => {
        const card = { lo, hi };
        stack.push(card);
        if (lo > hi) {
          fr.push(snap({ lo, hi, line: 1, vars: { lo, hi }, note: `Empty range [${lo}, ${hi}]: return None (${side}).` }));
          stack.pop();
          return;
        }
        const m = (lo + hi) >> 1;
        card.m = m;
        built.add(m);
        fr.push(snap({ lo, hi, mid: m, line: [2, 3], vars: { lo, hi, mid: m, "a[mid]": a[m] }, note: `Range [${lo}, ${hi}] has ${hi - lo + 1} key${hi > lo ? "s" : ""}. Middle index ${m}: <b>${a[m]}</b> becomes the ${side}. Left of it: ${m - lo} key${m - lo === 1 ? "" : "s"}; right of it: ${hi - m}. The sides differ by at most one.` }));
        go(lo, m - 1, `left child of ${a[m]}`);
        go(m + 1, hi, `right child of ${a[m]}`);
        stack.pop();
      };
      go(0, a.length - 1, "root");
      fr.push(snap({ line: 7, end: true, vars: { n: a.length, levels: levels(F) }, note: `Built ${a.length} nodes in ${levels(F)} levels, O(n) time: each key is visited once. Every node's two subtrees differ in height by at most one.` }));
      return fr;
    },
    render: (f) => col(
      Viz.array(f.a, {
        label: "a",
        ptrs: f.lo !== undefined ? (f.lo <= f.hi ? { lo: f.lo, hi: f.hi } : {}) : {},
        ptrsTop: f.mid !== undefined ? { mid: f.mid } : {},
        cls: (k) => (k === f.mid ? "active" : f.lo !== undefined && k >= f.lo && k <= f.hi ? (f.built.has(k) ? "done" : "visit") : f.built.has(k) ? "done" : "dim"),
      }),
      Viz.row(
        draw(f.F, { lay: f.lay, hidden: (id) => !f.built.has(id), cls: (id) => (id === f.mid ? "active" : "done") }),
        stackHtml(f.cards),
      ),
    ),
  }));

  /* ======================================================================
     7. AVL insert: heights, balance factors, rotations
     ====================================================================== */
  Viz.register(P("avl"), (el, opts) => Viz.player(el, {
    title: "AVL insert: walk back up, fix the first node that tips over",
    tag: "ROTATIONS",
    legend: [["bad", "unbalanced node z (|b| = 2)"], ["active", "child y (rotates up)"], ["path", "grandchild x / moving subtree"], ["visit", "insert path"], ["done", "new key"]],
    codeLang: "python",
    code: [
      "def insert(node, x):",
      "    if not node: return Node(x)                      # new leaf, height 1",
      "    if x < node.val: node.left = insert(node.left, x)",
      "    else:            node.right = insert(node.right, x)",
      "    node.h = 1 + max(h(node.left), h(node.right))",
      "    b = h(node.left) - h(node.right)                 # balance factor",
      "    if b > 1 and x < node.left.val:   return rot_right(node)     # LL",
      "    if b < -1 and x > node.right.val: return rot_left(node)      # RR",
      "    if b > 1:                                        # LR",
      "        node.left = rot_left(node.left);   return rot_right(node)",
      "    if b < -1:                                       # RL",
      "        node.right = rot_right(node.right); return rot_left(node)",
      "    return node",
    ],
    inputs: [{ key: "keys", label: "keys (insertion order)", value: opts.keys || "10,20,30,25,28,5,3,35,33", width: 260 }],
    random: () => ({ keys: (Math.random() < 0.3 ? Array.from({ length: Viz.rand(6, 10) }, (_, i) => i + 1) : randKeys(Viz.rand(6, 11), 40)).join(",") }),
    build: ({ keys }) => {
      const a = ints(keys, "keys", { max: 12 });
      const T = newTree(), H = [], fr = [];
      const h = (u) => (u === null ? 0 : H[u]);
      const upd = (u) => { H[u] = 1 + Math.max(h(T.L[u]), h(T.R[u])); };
      const bf = (u) => h(T.L[u]) - h(T.R[u]);
      let mark = {}, path = [], added = null;
      const plain = fromKeys(a);
      const snap = (x) => ({ T: snapT(T), H: [...H], mark: { ...mark }, path: [...path], added, ...x });
      const rotR = (z) => { const y = T.L[z]; T.L[z] = T.R[y]; T.R[y] = z; upd(z); upd(y); return y; };
      const rotL = (z) => { const y = T.R[z]; T.R[z] = T.L[y]; T.L[y] = z; upd(z); upd(y); return y; };
      const rotFrames = (z, dir, line, tag, setTop) => {
        const y = dir === "R" ? T.L[z] : T.R[z];
        const moving = dir === "R" ? T.R[y] : T.L[y];
        mark = { [z]: "bad", [y]: "active" };
        if (moving !== null) mark[moving] = "path";
        fr.push(snap({ line, vars: { rotate: `${dir === "R" ? "right" : "left"} at ${T.val[z]}` }, note: `${tag}<b>Rotate ${dir === "R" ? "right" : "left"} at ${T.val[z]}</b>: ${T.val[y]} moves up, ${T.val[z]} becomes its ${dir === "R" ? "right" : "left"} child, and ${moving === null ? `${T.val[y]}'s empty ${dir === "R" ? "right" : "left"} slot` : `${T.val[y]}'s ${dir === "R" ? "right" : "left"} subtree (rooted at ${T.val[moving]})`} moves across to become ${T.val[z]}'s ${dir === "R" ? "left" : "right"} child. The sorted order never changes.` }));
        const ny = dir === "R" ? rotR(z) : rotL(z);
        setTop(ny);
        fr.push(snap({ line, vars: { "new subtree root": T.val[ny], [`h(${T.val[z]})`]: H[z], [`h(${T.val[ny]})`]: H[ny] }, note: `After the rotation: ${T.val[ny]} is the subtree root. Compare the strip below with the previous frame: identical. Rotations only change the shape.` }));
        return ny;
      };
      const ins = (u, x, setMe) => {
        if (u === null) {
          const id = mk(T, x); H[id] = 1; added = id; path.push(id);
          setMe(id);
          fr.push(snap({ line: [1, 2, 3], vars: { x }, note: path.length > 1 ? `Ordinary BST descent: ${path.slice(0, -1).map((p) => T.val[p]).join(" → ")}, then attach <b>${x}</b> as a new leaf (height 1). Now the recursion unwinds: every node on the path recomputes its height and balance, bottom-up.` : `The tree was empty: <b>${x}</b> is the root.` }));
          return id;
        }
        path.push(u);
        const goL = x < T.val[u];
        if (goL) ins(T.L[u], x, (c) => { T.L[u] = c; }); else ins(T.R[u], x, (c) => { T.R[u] = c; });
        upd(u);
        const b = bf(u);
        let top = u;
        const setTop = (n) => { top = n; setMe(n); };
        if (Math.abs(b) <= 1) {
          fr.push(snap({ line: [4, 5], cur: u, vars: { node: T.val[u], h: H[u], b }, note: `Back at ${T.val[u]}: height ${H[u]}, balance ${b > 0 ? "+" : ""}${b} (left height − right height). |b| ≤ 1, so it is fine.` }));
          return u;
        }
        mark = { [u]: "bad" };
        const heavy = b > 1 ? "L" : "R";
        const y = heavy === "L" ? T.L[u] : T.R[u];
        const straight = heavy === "L" ? x < T.val[y] : x > T.val[y];
        const kind = (heavy === "L" ? "L" : "R") + (straight ? (heavy === "L" ? "L" : "R") : (heavy === "L" ? "R" : "L"));
        fr.push(snap({ line: [4, 5], cur: u, vars: { node: T.val[u], h: H[u], b, case: kind }, note: `Back at ${T.val[u]}: balance <b>${b > 0 ? "+" : ""}${b}</b>. It is the lowest node that tipped over. The new key went ${heavy === "L" ? "left" : "right"} then ${kind[1] === "L" ? "left" : "right"}: the <b>${kind}</b> case.` }));
        if (kind === "LL") rotFrames(u, "R", 6, "Straight line (LL): one rotation fixes it. ", setTop);
        else if (kind === "RR") rotFrames(u, "L", 7, "Straight line (RR): one rotation fixes it. ", setTop);
        else if (kind === "LR") { rotFrames(y, "L", 9, "Zig-zag (LR): first straighten the kink at the child. ", (n) => { T.L[u] = n; }); rotFrames(u, "R", 9, "Now it is a straight LL line. ", setTop); }
        else { rotFrames(y, "R", 11, "Zig-zag (RL): first straighten the kink at the child. ", (n) => { T.R[u] = n; }); rotFrames(u, "L", 11, "Now it is a straight RR line. ", setTop); }
        mark = { [top]: "done" };
        fr.push(snap({ line: 12, cur: top, vars: { "subtree root": T.val[top], h: H[top], b: bf(top) }, note: `Balanced again. The subtree's height is back to what it was before this insert, so <b>no ancestor needs fixing</b>: at most one (single or double) rotation per insert.` }));
        mark = {};
        return top;
      };
      fr.push(snap({ line: 0, vars: {}, note: `AVL keeps |height(left) − height(right)| ≤ 1 at every node. Each node shows <b>h</b> (height) and its balance <b>b</b> underneath.` }));
      a.forEach((x) => {
        path = []; added = null; mark = {};
        fr.push(snap({ line: 0, vars: { insert: x }, note: `Insert <b>${x}</b>.` }));
        ins(T.root, x, (c) => { T.root = c; });
      });
      path = []; added = null; mark = {};
      fr.push(snap({ line: 12, end: true, vars: { n: a.length, "AVL levels": H[T.root], "plain BST levels": levels(plain) }, note: `All ${a.length} keys inserted. AVL height ${H[T.root]} vs ${levels(plain)} for a plain BST with the same insertion order. AVL height is at most about 1.44·log₂(n), so every operation stays O(log n).` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pe = pathEdges(f.path.length ? f.path : []);
      const bfOf = (u) => (f.T.L[u] === null ? 0 : f.H[f.T.L[u]]) - (f.T.R[u] === null ? 0 : f.H[f.T.R[u]]);
      return col(
        draw(f.T, {
          sub: (id) => { const b = bfOf(id); return `h=${f.H[id]} b=${b > 0 ? "+" : ""}${b}`; },
          cls: (id) => f.mark[id] || (id === f.added ? "done" : id === f.cur ? "active" : path.has(id) ? "visit" : ""),
          ecls: (u, v) => (pe.has(`${u}-${v}`) ? "visit" : ""),
        }),
        seq("inorder (unchanged by rotations)", inorder(f.T).map((id) => f.T.val[id]), { cls: (k) => { const id = inorder(f.T)[k]; return f.mark[id] || "done"; } }),
      );
    },
  }));

  /* ======================================================================
     8. Recover a BST with two swapped keys
     ====================================================================== */
  Viz.register(P("recover"), (el, opts) => Viz.player(el, {
    title: "Recover a BST: two swapped keys leave dents in the inorder sequence",
    tag: "FIND THE DESCENTS",
    legend: [["active", "visiting"], ["done", "visited in order"], ["bad", "swapped node"], ["visit", "prev"]],
    codeLang: "python",
    code: [
      "first = second = prev = None",
      "def inorder(node):",
      "    global first, second, prev",
      "    if not node: return",
      "    inorder(node.left)",
      "    if prev and prev.val > node.val:   # a descent: order broken here",
      "        if not first: first = prev     # first descent: the bigger key is wrong",
      "        second = node                  # last descent: the smaller key is wrong",
      "    prev = node",
      "    inorder(node.right)",
      "inorder(root); first.val, second.val = second.val, first.val",
    ],
    inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "6,2,4,1,8,7,9,null,null,3,5", width: 260 }],
    random: () => {
      for (;;) {
        const T = fromKeys(randKeys(Viz.rand(5, 10), 30));
        if (levels(T) > 5) continue;
        const ids = shuffle(T.val.map((_, i) => i));
        const [i, j] = ids;
        [T.val[i], T.val[j]] = [T.val[j], T.val[i]];
        return { t: toLevel(T) };
      }
    },
    build: ({ t }) => {
      const T = parseLevel(t, { maxN: 13, maxDepth: 4 });
      const lay = layOf(T);
      const seen = [], desc = [], fr = [];
      let first = null, second = null, prev = null;
      const snap = (x) => ({ T: snapT(T), lay, seen: [...seen], desc: [...desc], first, second, prev, ...x });
      fr.push(snap({ line: 0, vars: {}, note: `In a valid BST the inorder sequence is strictly increasing. Swapping two keys breaks it in one or two places (descents). Walk inorder and compare each key with the previous one.` }));
      const go = (u) => {
        if (u === null) return;
        go(T.L[u]);
        seen.push(u);
        if (prev !== null && T.val[prev] > T.val[u]) {
          desc.push([prev, u]);
          const isFirst = first === null;
          if (isFirst) first = prev;
          second = u;
          fr.push(snap({ cur: u, line: isFirst ? [5, 6, 7] : [5, 7], vars: { prev: T.val[prev], node: T.val[u], first: T.val[first], second: T.val[second] }, note: `<b>Descent:</b> ${T.val[prev]} &gt; ${T.val[u]}. ${isFirst ? `First descent: the <i>bigger</i> key ${T.val[prev]} jumped ahead of where it belongs, so first = ${T.val[prev]}. Tentatively second = ${T.val[u]} (correct if the swapped keys were neighbours).` : `Second descent: the <i>smaller</i> key ${T.val[u]} fell behind, so second = ${T.val[u]}.`}` }));
        } else {
          fr.push(snap({ cur: u, line: [5, 8], vars: { prev: prev === null ? "None" : T.val[prev], node: T.val[u], first: first === null ? "None" : T.val[first], second: second === null ? "None" : T.val[second] }, note: prev === null ? `Inorder starts at the leftmost node, <b>${T.val[u]}</b>.` : `${T.val[prev]} &lt; ${T.val[u]}: still increasing.` }));
        }
        prev = u;
        go(T.R[u]);
      };
      go(T.root);
      if (first === null) {
        fr.push(snap({ line: 10, end: true, vars: { descents: 0 }, note: `No descent at all: this tree is already a valid BST, nothing to recover.` }));
        return fr;
      }
      const fv = T.val[first], sv = T.val[second];
      [T.val[first], T.val[second]] = [T.val[second], T.val[first]];
      const sortedNow = inorder(T).map((id) => T.val[id]).every((v, i, arr) => i === 0 || arr[i - 1] < v);
      fr.push(snap({ line: 10, end: true, fixed: true, cur: null, prev: null, vars: { descents: desc.length, swap: `${fv} ↔ ${sv}` }, note: sortedNow ? `Swap the values of first (${fv}) and second (${sv}). ${desc.length === 1 ? "There was only one descent because the swapped keys were neighbours in sorted order. " : ""}The inorder sequence is sorted again: <b>recovered</b>. O(n) time, O(h) space (Morris traversal gets it to O(1)).` : `Swapped ${fv} and ${sv}, but the sequence is still not sorted: this tree differs from a BST by more than one swap.` }));
      return fr;
    },
    render: (f) => {
      const bad = new Set([f.first, f.second].filter((x) => x !== null));
      const dset = new Set(f.desc.flat());
      const seenIds = f.fixed ? inorder(f.T) : f.seen;
      return col(
        draw(f.T, {
          lay: f.lay,
          top: (id) => (id === f.first ? "first" : id === f.second ? "second" : id === f.prev ? "prev" : undefined),
          cls: (id) => (f.fixed && bad.has(id) ? "done" : bad.has(id) ? "bad" : id === f.cur ? "active" : id === f.prev ? "visit" : f.seen.includes(id) ? "done" : ""),
        }),
        seq(f.fixed ? "inorder after the swap" : "inorder so far", seenIds.map((id) => f.T.val[id]), { cls: (k) => { const id = seenIds[k]; return f.fixed ? (bad.has(id) ? "path" : "done") : dset.has(id) ? "bad" : k === seenIds.length - 1 ? "active" : "done"; } }),
      );
    },
  }));

  /* ======================================================================
     9. LCA in a BST: the split point
     ====================================================================== */
  Viz.register(P("lca"), (el, opts) => Viz.player(el, {
    title: "Lowest common ancestor in a BST: walk until p and q split",
    tag: "SPLIT POINT",
    legend: [["path", "p and q"], ["active", "cur"], ["visit", "path"], ["done", "LCA"]],
    codeLang: "python",
    code: [
      "def lca(root, p, q):",
      "    cur = root",
      "    while cur:",
      "        if p < cur.val and q < cur.val: cur = cur.left     # both on the left",
      "        elif p > cur.val and q > cur.val: cur = cur.right  # both on the right",
      "        else: return cur                                   # they split here (or cur is p or q)",
    ],
    inputs: [
      { key: "keys", label: "keys (insertion order)", value: opts.keys || "20,8,30,4,12,25,40,10,14,22,27", width: 240 },
      { key: "p", label: "p", value: opts.p || "10", width: 50 },
      { key: "q", label: "q", value: opts.q || "14", width: 50 },
    ],
    random: () => { const k = randKeys(Viz.rand(6, 12), 40); const s = shuffle([...k]); return { keys: k.join(","), p: String(s[0]), q: String(s[1]) }; },
    build: ({ keys, p, q }) => {
      const a = ints(keys, "keys", { max: 13 }), pv = num(p, "p"), qv = num(q, "q");
      if (!a.includes(pv) || !a.includes(qv)) throw new Error("p and q must both be keys in the tree.");
      const T = fromKeys(a), lay = layOf(T);
      const lo = Math.min(pv, qv), hi = Math.max(pv, qv);
      const path = [], fr = [];
      let cur = T.root;
      const snap = (x) => ({ T, lay, path: [...path], cur, pv, qv, lo, hi, ...x });
      fr.push(snap({ line: 1, vars: { p: pv, q: qv }, note: `Both p and q sit below the root. As long as they are on the <i>same</i> side of cur, the LCA is deeper on that side. The first node where they split, which is the first node whose key lies in [${lo}, ${hi}], is the answer.` }));
      for (;;) {
        path.push(cur);
        const v = T.val[cur];
        if (pv < v && qv < v) { fr.push(snap({ line: 3, vars: { cur: v }, note: `${pv} and ${qv} are both &lt; ${v}: both live in the left subtree. Go left.` })); cur = T.L[cur]; continue; }
        if (pv > v && qv > v) { fr.push(snap({ line: 4, vars: { cur: v }, note: `${pv} and ${qv} are both &gt; ${v}: both live in the right subtree. Go right.` })); cur = T.R[cur]; continue; }
        fr.push(snap({ line: 5, ans: cur, end: true, vars: { cur: v, LCA: v }, note: v === pv || v === qv ? `cur <b>is</b> ${v === pv ? "p" : "q"} (${v}) and the other one is below it, so <b>${v}</b> is the LCA. A node counts as its own ancestor.` : `${lo} &lt; ${v} &lt; ${hi}: p and q are on different sides, so this is where their root paths split. <b>LCA = ${v}</b>. O(h), no recursion, no parent pointers.` }));
        break;
      }
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pe = pathEdges(f.path), sorted = inorder(f.T);
      return col(
        draw(f.T, {
          lay: f.lay,
          top: (id) => (f.T.val[id] === f.pv ? "p" : f.T.val[id] === f.qv ? "q" : undefined),
          cls: (id) => (id === f.ans ? "done" : id === f.cur ? "active" : f.T.val[id] === f.pv || f.T.val[id] === f.qv ? "path" : path.has(id) ? "visit" : ""),
          ecls: (u, v) => (pe.has(`${u}-${v}`) ? "visit" : ""),
        }),
        Viz.array(sorted.map((id) => f.T.val[id]), { label: `sorted keys: the LCA is the first path node inside [${f.lo}, ${f.hi}]`, showIdx: false, cls: (k, v) => (sorted[k] === f.ans ? "done" : sorted[k] === f.cur ? "active" : v === f.pv || v === f.qv ? "path" : v > f.lo && v < f.hi ? "visit" : "") }),
      );
    },
  }));

  /* ======================================================================
     10. Range sum with pruning
     ====================================================================== */
  Viz.register(P("range"), (el, opts) => Viz.player(el, {
    title: "Range sum: prune every subtree that cannot reach [lo, hi]",
    tag: "PRUNING",
    legend: [["active", "current call"], ["visit", "on the stack"], ["done", "counted (in range)"], ["bad", "visited, out of range"], ["dim", "pruned, never visited"]],
    codeLang: "python",
    code: [
      "def range_sum(node, lo, hi):",
      "    if not node: return 0",
      "    if node.val < lo: return range_sum(node.right, lo, hi)   # node and its left subtree are too small",
      "    if node.val > hi: return range_sum(node.left, lo, hi)    # node and its right subtree are too big",
      "    return (node.val + range_sum(node.left, lo, hi)",
      "                     + range_sum(node.right, lo, hi))",
    ],
    inputs: [
      { key: "keys", label: "keys (insertion order)", value: opts.keys || "10,5,15,3,7,13,18,1,4,6,8,12,14", width: 260 },
      { key: "lo", label: "lo", value: opts.lo || "6", width: 50 },
      { key: "hi", label: "hi", value: opts.hi || "13", width: 50 },
    ],
    random: () => { const k = randKeys(Viz.rand(7, 13), 30); const x = Viz.rand(0, 30), y = Viz.rand(0, 30); return { keys: k.join(","), lo: String(Math.min(x, y)), hi: String(Math.max(x, y)) }; },
    build: ({ keys, lo, hi }) => {
      const a = ints(keys, "keys", { max: 13 }), LO = num(lo, "lo"), HI = num(hi, "hi");
      if (LO > HI) throw new Error("lo must be ≤ hi.");
      const T = fromKeys(a), lay = layOf(T);
      const counted = new Set(), outside = new Set(), pruned = new Set(), stack = [], fr = [];
      let sum = 0;
      const snap = (x) => ({ T, lay, LO, HI, counted: new Set(counted), outside: new Set(outside), pruned: new Set(pruned), calls: stack.map((s) => s), cards: stack.map((s) => ({ t: `range_sum(${T.val[s]})` })), sum, ...x });
      fr.push(snap({ line: 0, vars: { lo: LO, hi: HI, sum: 0 }, note: `Sum every key in [${LO}, ${HI}]. A plain traversal visits all ${a.length} nodes. The BST order lets us skip whole subtrees that lie entirely outside the range.` }));
      const go = (u) => {
        if (u === null) return 0;
        stack.push(u);
        const v = T.val[u];
        if (v < LO) {
          outside.add(u);
          const skip = subtree(T, T.L[u]); skip.forEach((s) => pruned.add(s));
          fr.push(snap({ cur: u, line: 2, vars: { node: v, sum }, note: `${v} &lt; ${LO}: ${v} is out, and its whole left subtree is even smaller. <b>Prune ${skip.size} node${skip.size === 1 ? "" : "s"}</b>${skip.size ? " without visiting them" : ""}; only the right side can contribute.` }));
          const r = go(T.R[u]); stack.pop(); return r;
        }
        if (v > HI) {
          outside.add(u);
          const skip = subtree(T, T.R[u]); skip.forEach((s) => pruned.add(s));
          fr.push(snap({ cur: u, line: 3, vars: { node: v, sum }, note: `${v} &gt; ${HI}: ${v} is out, and its whole right subtree is even bigger. <b>Prune ${skip.size} node${skip.size === 1 ? "" : "s"}</b>; only the left side can contribute.` }));
          const r = go(T.L[u]); stack.pop(); return r;
        }
        counted.add(u); sum += v;
        fr.push(snap({ cur: u, line: 4, vars: { node: v, sum }, note: `${LO} ≤ ${v} ≤ ${HI}: count it (sum = ${sum}). Both subtrees may hold in-range keys, so recurse into both.` }));
        const r = v + go(T.L[u]) + go(T.R[u]);
        stack.pop();
        return r;
      };
      const total = go(T.root);
      const visited = counted.size + outside.size;
      fr.push(snap({ line: 4, end: true, vars: { answer: total, visited, pruned: a.length - visited }, note: `Answer <b>${total}</b>. Visited ${visited} of ${a.length} nodes. In general the cost is O(h + m), where m is the number of keys in range: the walk follows the two boundary paths plus the in-range part.` }));
      return fr;
    },
    render: (f) => {
      const calls = new Set(f.calls), sorted = inorder(f.T);
      return col(
        Viz.row(
          draw(f.T, {
            lay: f.lay,
            cls: (id) => (id === f.cur ? "active" : calls.has(id) ? "visit" : f.counted.has(id) ? "done" : f.outside.has(id) ? "bad" : f.pruned.has(id) ? "dim" : ""),
            ecls: (u, v) => (calls.has(u) && calls.has(v) ? "visit" : f.pruned.has(v) ? "dim" : ""),
          }),
          stackHtml(f.cards),
        ),
        Viz.array(sorted.map((id) => f.T.val[id]), { label: `sorted keys, range [${f.LO}, ${f.HI}]`, showIdx: false, cls: (k, v) => (f.counted.has(sorted[k]) ? "done" : v >= f.LO && v <= f.HI ? "visit" : "dim") }),
      );
    },
  }));
})();
