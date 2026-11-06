/* Tree Traversals visualizers. Every frame comes from running the real algorithm on the tree you type. */
(() => {
  const S = "tree-traversals";
  const P = (n) => `${S}-${n}`;
  const esc = Viz.esc;

  /* ---------- trees from LeetCode level-order arrays ---------- */
  function tokens(text) {
    return String(text).replace(/[[\]]/g, " ").split(/[\s,]+/).filter(Boolean);
  }
  function parseTree(text, { maxN = 15, maxDepth = 5 } = {}) {
    const toks = tokens(text);
    if (!toks.length) throw new Error("Enter a level-order array such as 3,9,20,null,null,15,7.");
    const arr = toks.map((t) => {
      if (/^(null|none|nil|#)$/i.test(t)) return null;
      const v = Number(t);
      if (!Number.isInteger(v) || Math.abs(v) > 999) throw new Error(`"${t}" is not a whole number between -999 and 999 (or null).`);
      return v;
    });
    if (arr[0] === null) throw new Error("The root cannot be null (an empty tree has nothing to show).");
    const T = { val: [], L: [], R: [], depth: [], arr, idOfIdx: {}, idxOfId: [] };
    const mk = (v, d, idx) => { T.val.push(v); T.L.push(null); T.R.push(null); T.depth.push(d); T.idOfIdx[idx] = T.val.length - 1; T.idxOfId.push(idx); return T.val.length - 1; };
    mk(arr[0], 0, 0);
    const q = [0];
    let i = 1;
    while (q.length && i < arr.length) {
      const p = q.shift();
      for (const side of ["L", "R"]) {
        if (i >= arr.length) break;
        if (arr[i] !== null) { const c = mk(arr[i], T.depth[p] + 1, i); T[side][p] = c; q.push(c); }
        i++;
      }
    }
    if (arr.slice(i).some((v) => v !== null)) throw new Error(`Entry ${i} (${arr[i]}) has no parent slot left. Each non-null node owns exactly two slots, so the array is too long.`);
    T.arr = arr.slice(0, i);
    T.n = T.val.length;
    if (T.n > maxN) throw new Error(`Use at most ${maxN} nodes so the picture stays readable (you have ${T.n}).`);
    T.height = Math.max(...T.depth);
    if (T.height > maxDepth) throw new Error(`Keep the tree at most ${maxDepth + 1} levels deep (yours has ${T.height + 1}).`);
    T.lay = Viz.layoutTree(0, (id) => [T.L[id], T.R[id]], (id) => T.val[id], { dx: 50, dy: 62 });
    return T;
  }
  function toLevel(L, R, val, root = 0) {
    const out = [], q = [root];
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
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  function randomTreeText(n = Viz.rand(6, 11), maxDepth = 3, distinct = true) {
    const { L, R } = randomShape(n, maxDepth);
    const vals = distinct ? shuffle(Array.from({ length: 30 }, (_, i) => i + 1)).slice(0, L.length) : L.map(() => Viz.rand(1, 9));
    return toLevel(L, R, vals);
  }

  /* ---------- drawing helpers ---------- */
  function draw(T, o = {}) {
    const hidden = o.hidden || (() => false);
    const nodes = T.lay.nodes.map((nd) => ({ ...nd, sub: o.sub ? o.sub(nd.id) : undefined, top: o.top ? o.top(nd.id) : undefined }));
    const edges = T.lay.edges.map((e) => ({ ...e })).concat(o.extra || []);
    return Viz.graph({ nodes, edges }, {
      r: 19,
      label: o.label,
      nodeCls: (id) => (hidden(Number(id)) ? "tt-hide" : (o.cls && o.cls(Number(id))) || ""),
      edgeCls: (k) => {
        const [u, v] = k.split("-").map(Number);
        if (T.L[u] !== v && T.R[u] !== v) return "";
        if (hidden(v)) return "tt-hide";
        return (o.ecls && o.ecls(u, v)) || "";
      },
    });
  }
  function stackHtml(cards, { label = "call stack (top = running)", max = 7, narrow = false } = {}) {
    const shown = cards.slice(-max);
    const more = cards.length - shown.length;
    const html = shown.map((c, k) => {
      const top = k === shown.length - 1;
      return `<div class="tt-frame ${c.cls || (top ? "active" : "visit")}"><div class="tt-fhead"><b>${esc(c.t)}</b>${c.s ? `<span>${esc(c.s)}</span>` : ""}</div></div>`;
    }).reverse().join("");
    return `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="tt-stack${narrow ? " tt-narrow" : ""}">${html || '<div class="tt-more">empty</div>'}${more > 0 ? `<div class="tt-more">+ ${more} older frame${more > 1 ? "s" : ""} below</div>` : ""}<div class="tt-floor">bottom</div></div></div>`;
  }
  function seq(label, vals, { hiLast = false, cls } = {}) {
    if (!vals.length) return `<div class="v-labeled tt-seq"><span class="v-caption">${esc(label)}</span><div class="tt-empty">nothing yet</div></div>`;
    return `<div class="tt-seq">${Viz.array(vals, { label, showIdx: false, cls: cls || ((i) => (hiLast && i === vals.length - 1 ? "active" : "done")) })}</div>`;
  }
  const col = (...parts) => `<div class="tt-col">${parts.filter(Boolean).join("")}</div>`;
  const nm = (T, id) => (id === null || id === undefined ? "None" : String(T.val[id]));

  /* ---------- 1. Level-order array -> tree ---------- */
  Viz.register(P("parse"), (el, opts) => Viz.player(el, {
    title: "From a LeetCode array to a tree: one parent queue",
    tag: "EDIT THE ARRAY",
    legend: [["active", "parent being filled / slot being read"], ["visit", "waiting in the queue"], ["done", "attached, children filled"], ["dim", "null slot"]],
    codeLang: "python",
    code: [
      "root = TreeNode(a[0]); q = deque([root]); i = 1",
      "while q and i < len(a):",
      "    node = q.popleft()        # next parent, in BFS order",
      "    if a[i] is not None:",
      "        node.left = TreeNode(a[i]); q.append(node.left)",
      "    i += 1",
      "    if i < len(a) and a[i] is not None:",
      "        node.right = TreeNode(a[i]); q.append(node.right)",
      "    i += 1",
      "return root",
    ],
    inputs: [{ key: "t", label: "level-order array (null = no child)", value: opts.t || "1,2,3,null,4,5,null,null,6,7", width: 300 }],
    random: () => ({ t: randomTreeText(Viz.rand(6, 10), 3) }),
    build: ({ t }) => {
      const T = parseTree(t);
      const a = T.arr, fr = [];
      const made = new Set([0]), finished = new Set();
      let q = [0], i = 1, p = null, slot = null;
      const snap = (x) => ({ T, a, made: new Set(made), finished: new Set(finished), q: [...q], i, p, slot, ...x });
      fr.push(snap({ line: 0, vars: { i: 1, q: `[${T.val[0]}]` }, note: `a[0] = <b>${a[0]}</b> is the root. The queue holds nodes whose two child slots have <i>not been read yet</i>, in the same order the array lists them.` }));
      while (q.length && i < a.length) {
        p = q.shift();
        fr.push(snap({ line: 2, vars: { node: T.val[p], i, q: `[${q.map((x) => T.val[x]).join(", ")}]` }, note: `Pop <b>${T.val[p]}</b>: the next two array entries, a[${i}] and a[${i + 1}], are its left and right child slots.` }));
        for (const side of ["left", "right"]) {
          if (i >= a.length) break;
          slot = side;
          const lineIf = side === "left" ? 3 : 6, lineMk = side === "left" ? 4 : 7;
          if (a[i] === null) {
            fr.push(snap({ line: lineIf, vars: { node: T.val[p], i, [`a[${i}]`]: "null" }, note: `a[${i}] is <b>null</b>: ${T.val[p]} has no ${side} child. A null uses up an index but never enters the queue, so it reserves <i>no</i> slots for children. That is why LeetCode arrays are not the 2i+1 / 2i+2 heap layout.` }));
          } else {
            const c = T.idOfIdx[i];
            made.add(c); q.push(c);
            fr.push(snap({ line: lineMk, child: c, vars: { node: T.val[p], i, [`a[${i}]`]: a[i], q: `[${q.map((x) => T.val[x]).join(", ")}]` }, note: `a[${i}] = <b>${a[i]}</b> becomes the ${side} child of ${T.val[p]} and joins the back of the queue: its own two slots appear later in the array, after every node already waiting.` }));
          }
          i++;
        }
        finished.add(p);
        slot = null;
      }
      p = null;
      fr.push(snap({ line: 9, vars: { nodes: T.n, height: T.height + 1 }, note: q.length ? `The array ended with ${q.length} node(s) still queued: trailing nulls are omitted, so their slots are simply empty. Built ${T.n} nodes.` : `Every entry consumed. Built ${T.n} nodes, ${T.height + 1} levels.` }));
      return fr;
    },
    render: (f) => col(
      Viz.array(f.a.map((v) => (v === null ? "null" : v)), {
        label: "a (level-order array)",
        ptrs: f.i < f.a.length ? { i: f.i } : {},
        ptrsTop: f.slot && f.i < f.a.length ? { [`${f.slot} of ${f.T.val[f.p]}`]: f.i } : {},
        cls: (k, v) => (k === f.i && f.slot ? "active" : k < f.i ? (v === "null" ? "dim" : "done") : v === "null" ? "dim" : ""),
      }),
      Viz.row(
        draw(f.T, { hidden: (id) => !f.made.has(id), cls: (id) => (id === f.p ? "active" : id === f.child ? "path" : f.finished.has(id) ? "done" : f.q.includes(id) ? "visit" : "") }),
        Viz.queue(f.q.map((id) => f.T.val[id]), { label: "parents waiting", cls: (k) => (k === f.q.length - 1 && f.child !== undefined ? "path" : "visit") }),
      ),
    ),
  }));

  /* ---------- 2. Recursive DFS: one walk, three moments ---------- */
  Viz.register(P("dfs"), (el, opts) => Viz.player(el, {
    title: "Recursive DFS: preorder, inorder and postorder are one walk",
    tag: "WATCH THE CALL STACK",
    legend: [["active", "running frame"], ["visit", "waiting on the stack"], ["done", "returned (subtree finished)"]],
    codeLang: "python",
    code: [
      "def dfs(node):",
      "    if node is None: return      # base case",
      "    pre.append(node.val)         # pass 1: before both children",
      "    dfs(node.left)",
      "    ino.append(node.val)         # pass 2: between the children",
      "    dfs(node.right)",
      "    post.append(node.val)        # pass 3: after both children",
    ],
    inputs: [
      { key: "t", label: "tree (level order)", value: opts.t || "1,2,3,4,5,null,6", width: 230 },
      { key: "nulls", label: "dfs(None) calls", type: "select", options: ["show", "hide"], value: opts.nulls || "show" },
    ],
    random: () => ({ t: randomTreeText(Viz.rand(5, 9), 3) }),
    build: ({ t, nulls }) => {
      const T = parseTree(t, { maxN: 13, maxDepth: 4 });
      const showNull = nulls !== "hide";
      const pre = [], ino = [], post = [], stack = [], fr = [];
      const snap = (x) => ({ T, pre: [...pre], ino: [...ino], post: [...post], stack: stack.map((s) => ({ ...s })), ...x });
      const cards = () => stack.map((s) => ({ t: `dfs(${nm(T, s.id)})`, s: s.at }));
      const vars = (id) => ({ node: nm(T, id), depth: stack.length, pre: pre.length, in: ino.length, post: post.length });
      const go = (id, from) => {
        stack.push({ id, at: "running" });
        if (id === null) {
          if (showNull) fr.push(snap({ cards: cards(), cur: null, line: 1, vars: vars(id), note: `dfs(None) from ${from}: the base case returns at once. These calls are cheap but real: a tree with n nodes makes n + 1 of them.` }));
          stack.pop();
          return;
        }
        const top = stack[stack.length - 1];
        pre.push(id);
        fr.push(snap({ cards: cards(), cur: id, ev: "pre", line: 2, vars: vars(id), note: `First touch of <b>${T.val[id]}</b> (the left side of the node): preorder records it <i>before</i> either child, so a parent always precedes its subtree.` }));
        top.at = "line 4: in left subtree";
        go(T.L[id], `${T.val[id]}.left`);
        top.at = "running";
        ino.push(id);
        fr.push(snap({ cards: cards(), cur: id, ev: "in", line: 4, vars: vars(id), note: `Back in ${T.val[id]} after its whole left subtree: inorder records it now, <i>between</i> the two subtrees. On a BST this is exactly sorted order.` }));
        top.at = "line 6: in right subtree";
        go(T.R[id], `${T.val[id]}.right`);
        top.at = "running";
        post.push(id);
        fr.push(snap({ cards: cards(), cur: id, ev: "post", line: 6, vars: vars(id), note: `Last touch of <b>${T.val[id]}</b>: both children have returned, so postorder records it <i>after</i> its subtree. That is the moment children's answers are available, which is why "compute from children" problems are postorder.` }));
        stack.pop();
      };
      fr.push(snap({ cards: [], cur: null, line: 0, vars: { node: "-" }, note: "One recursive walk visits every node three times: on the way down, between its children, and on the way up. Each traversal order just picks one of the three moments to record the node." }));
      go(0, "the caller");
      fr.push(snap({ cards: [], cur: null, done: true, line: 6, vars: { pre: pre.length, in: ino.length, post: post.length }, note: `Done. Same walk, three orders. Each node was pushed once and popped once: O(n) time, O(h) stack where h is the height.` }));
      return fr;
    },
    render: (f) => {
      const onStack = new Set(f.stack.map((s) => s.id).filter((x) => x !== null));
      const chain = f.stack.map((s) => s.id).filter((x) => x !== null);
      const chainE = new Set(chain.slice(1).map((v, k) => `${chain[k]}-${v}`));
      const posted = new Set(f.post);
      const V = (ids) => ids.map((id) => f.T.val[id]);
      return col(
        Viz.row(
          draw(f.T, { cls: (id) => (id === f.cur ? "active" : onStack.has(id) ? "visit" : posted.has(id) ? "done" : ""), ecls: (u, v) => (chainE.has(`${u}-${v}`) ? "visit" : "") }),
          stackHtml(f.cards),
        ),
        Viz.row(
          seq("preorder (pass 1)", V(f.pre), { hiLast: f.ev === "pre" }),
          seq("inorder (pass 2)", V(f.ino), { hiLast: f.ev === "in" }),
          seq("postorder (pass 3)", V(f.post), { hiLast: f.ev === "post" }),
        ),
      );
    },
  }));

  /* ---------- 3. Iterative traversals with an explicit stack ---------- */
  const ITER = {
    preorder: {
      title: "Iterative preorder: pop, emit, push right then left",
      code: [
        "stack = [root]",
        "while stack:",
        "    node = stack.pop()",
        "    out.append(node.val)",
        "    if node.right: stack.append(node.right)",
        "    if node.left:  stack.append(node.left)   # left on top",
        "return out",
      ],
    },
    inorder: {
      title: "Iterative inorder: slide down the left spine, pop, step right",
      code: [
        "stack, cur = [], root",
        "while cur or stack:",
        "    while cur:                 # push the whole left spine",
        "        stack.append(cur); cur = cur.left",
        "    cur = stack.pop()          # leftmost unfinished node",
        "    out.append(cur.val)",
        "    cur = cur.right            # then its right subtree",
        "return out",
      ],
    },
    postorder: {
      title: "Iterative postorder with one stack and a prev pointer",
      code: [
        "stack, cur, prev = [], root, None",
        "while cur or stack:",
        "    while cur:",
        "        stack.append(cur); cur = cur.left",
        "    top = stack[-1]",
        "    if top.right and top.right is not prev:",
        "        cur = top.right        # right side not done yet",
        "    else:",
        "        stack.pop(); out.append(top.val); prev = top",
        "return out",
      ],
    },
  };
  Viz.register(P("iter"), (el, opts) => {
    const order = ITER[opts.order] ? opts.order : "inorder";
    const spec = ITER[order];
    return Viz.player(el, {
      title: spec.title,
      tag: "EXPLICIT STACK",
      legend: [["active", "cur / popped"], ["visit", "on the stack"], ["path", "prev (last emitted)"], ["done", "emitted"]],
      codeLang: "python",
      code: spec.code,
      inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "1,2,3,4,5,null,6,null,null,7", width: 260 }],
      random: () => ({ t: randomTreeText(Viz.rand(6, 10), 3) }),
      build: ({ t }) => {
        const T = parseTree(t, { maxN: 14, maxDepth: 4 });
        const st = [], out = [], fr = [];
        let cur = null, prev = null;
        const vals = (a) => `[${a.map((x) => T.val[x]).join(", ")}]`;
        const snap = (x) => ({ T, st: [...st], out: [...out], cur, prev, ...x });
        if (order === "preorder") {
          st.push(0);
          fr.push(snap({ line: 0, vars: { stack: vals(st) }, note: "Seed the stack with the root. Each pop is a visit; the stack remembers subtrees we still owe." }));
          while (st.length) {
            cur = st.pop(); out.push(cur);
            fr.push(snap({ line: [2, 3], ev: true, vars: { node: T.val[cur], stack: vals(st) }, note: `Pop <b>${T.val[cur]}</b> and emit it at once: in preorder a node comes before its subtrees.` }));
            const pushed = [];
            if (T.R[cur] !== null) { st.push(T.R[cur]); pushed.push(T.val[T.R[cur]]); }
            if (T.L[cur] !== null) { st.push(T.L[cur]); pushed.push(T.val[T.L[cur]]); }
            if (pushed.length) fr.push(snap({ line: [4, 5], vars: { node: T.val[cur], stack: vals(st) }, note: `Push ${pushed.join(" then ")}. Right goes in <i>first</i> so that left sits on top and is popped first: LIFO reverses the push order.` }));
            else fr.push(snap({ line: [4, 5], vars: { node: T.val[cur], stack: vals(st) }, note: `${T.val[cur]} is a leaf: nothing to push. The next pop resumes the most recent subtree we postponed.` }));
          }
          cur = null;
          fr.push(snap({ line: 6, done: true, vars: { out: vals(out) }, note: "Stack empty: every node emitted once. O(n) time, O(h) stack." }));
        } else if (order === "inorder") {
          cur = 0;
          fr.push(snap({ line: 0, vars: { cur: nm(T, cur), stack: "[]" }, note: "cur walks the tree; the stack holds ancestors whose left side we are still inside." }));
          while (cur !== null || st.length) {
            while (cur !== null) {
              st.push(cur);
              const was = cur; cur = T.L[cur];
              fr.push(snap({ line: 3, vars: { cur: nm(T, cur), stack: vals(st) }, note: `Push ${T.val[was]} and step left${cur === null ? ": None, so the left spine ends here." : ` to ${T.val[cur]}.`} Nothing can be emitted before the leftmost node of this subtree.` }));
            }
            cur = st.pop(); out.push(cur);
            fr.push(snap({ line: [4, 5], ev: true, vars: { cur: T.val[cur], stack: vals(st) }, note: `Pop <b>${T.val[cur]}</b>: its left subtree is fully emitted (or empty), so it is next in inorder. Emit it.` }));
            cur = T.R[cur];
            fr.push(snap({ line: 6, vars: { cur: nm(T, cur), stack: vals(st) }, note: cur === null ? `No right child, so cur = None: the next pop returns to the nearest ancestor still waiting${st.length ? ` (${T.val[st[st.length - 1]]})` : ""}.` : `Step into the right subtree at ${T.val[cur]} and repeat: push its left spine first.` }));
          }
          fr.push(snap({ line: 7, done: true, vars: { out: vals(out) }, note: "cur is None and the stack is empty: done. Each node is pushed once and popped once." }));
        } else {
          cur = 0;
          fr.push(snap({ line: 0, vars: { cur: nm(T, cur), prev: "None", stack: "[]" }, note: "Postorder must emit a node only after <i>both</i> subtrees. A node on the stack is visited twice (back from left, back from right); prev tells the two visits apart." }));
          while (cur !== null || st.length) {
            while (cur !== null) {
              st.push(cur);
              const was = cur; cur = T.L[cur];
              fr.push(snap({ line: 3, vars: { cur: nm(T, cur), prev: nm(T, prev), stack: vals(st) }, note: `Push ${T.val[was]} and go left${cur === null ? " (None: spine ends)." : ` to ${T.val[cur]}.`}` }));
            }
            const top = st[st.length - 1];
            const r = T.R[top];
            if (r !== null && r !== prev) {
              cur = r;
              fr.push(snap({ peek: top, line: [4, 5, 6], vars: { top: T.val[top], cur: nm(T, cur), prev: nm(T, prev), stack: vals(st) }, note: `Peek ${T.val[top]}: it has a right child ${T.val[r]} that is <i>not</i> prev, so we are coming back from the left. Leave ${T.val[top]} on the stack and go right.` }));
            } else {
              st.pop(); out.push(top); prev = top;
              fr.push(snap({ peek: top, ev: true, line: [4, 5, 8], vars: { top: T.val[top], cur: "None", prev: T.val[top], stack: vals(st) }, note: r === null ? `Peek ${T.val[top]}: no right child, so both sides are done. Pop and emit <b>${T.val[top]}</b>; prev = ${T.val[top]}.` : `Peek ${T.val[top]}: its right child ${T.val[r]} <i>is</i> prev, so we just came back from the right. Both sides done: pop and emit <b>${T.val[top]}</b>.` }));
            }
          }
          fr.push(snap({ line: 9, done: true, vars: { out: vals(out) }, note: "Done. Without prev, a node with a right child would be pushed into its right subtree forever." }));
        }
        return fr;
      },
      render: (f) => {
        const onSt = new Set(f.st), emitted = new Set(f.out);
        return col(
          Viz.row(
            draw(f.T, {
              top: (id) => (id === f.cur ? "cur" : id === f.prev && order === "postorder" ? "prev" : undefined),
              cls: (id) => (id === f.cur || id === f.peek ? "active" : order === "postorder" && id === f.prev ? "path" : onSt.has(id) ? "visit" : emitted.has(id) ? "done" : ""),
            }),
            Viz.stack(f.st.map((id) => f.T.val[id]), { cls: (i) => (i === f.st.length - 1 ? "active" : "visit") }),
          ),
          seq(`${order} output`, f.out.map((id) => f.T.val[id]), { hiLast: !!f.ev }),
        );
      },
    });
  });

  /* ---------- 4. Morris traversal ---------- */
  Viz.register(P("morris"), (el, opts) => {
    const pre = opts.order === "preorder";
    return Viz.player(el, {
      title: pre ? "Morris preorder: emit when you build the thread" : "Morris inorder: O(1) space by threading predecessors",
      tag: "THREADS APPEAR AND DISAPPEAR",
      legend: [["active", "cur"], ["visit", "pred search"], ["path", "temporary thread"], ["done", "emitted"]],
      codeLang: "python",
      code: [
        "cur = root",
        "while cur:",
        "    if cur.left is None:",
        "        out.append(cur.val); cur = cur.right",
        "    else:",
        "        pred = cur.left              # rightmost node of left subtree",
        "        while pred.right and pred.right is not cur:",
        "            pred = pred.right",
        "        if pred.right is None:       # first visit: build the thread",
        pre ? "            out.append(cur.val); pred.right = cur; cur = cur.left" : "            pred.right = cur; cur = cur.left",
        "        else:                        # second visit: thread found",
        pre ? "            pred.right = None" : "            pred.right = None; out.append(cur.val)",
        "            cur = cur.right",
      ],
      inputs: [{ key: "t", label: "tree (level order)", value: opts.t || "4,2,6,1,3,5,7", width: 240 }],
      random: () => ({ t: randomTreeText(Viz.rand(5, 9), 3) }),
      build: ({ t }) => {
        const T = parseTree(t, { maxN: 13, maxDepth: 4 });
        const R2 = [...T.R], thr = new Map(), out = [], fr = [];
        let cur = 0, pred = null, steps = 0;
        const isThread = (u) => thr.get(u) !== undefined && R2[u] === thr.get(u);
        const snap = (x) => ({ T, thr: new Map(thr), out: [...out], cur, pred, ...x });
        const V = (x) => nm(T, x);
        fr.push(snap({ line: 0, vars: { cur: V(cur), threads: 0, "extra space": "O(1)" }, note: "No stack, no recursion. Instead we temporarily point the <i>inorder predecessor's</i> empty right pointer back up at cur, so we can climb back later. Every thread is removed again before we finish." }));
        while (cur !== null) {
          if (++steps > 400) throw new Error("Too many steps.");
          if (T.L[cur] === null) {
            out.push(cur);
            const nxt = R2[cur], via = isThread(cur);
            fr.push(snap({ line: [2, 3], ev: true, vars: { cur: V(cur), next: V(nxt), threads: thr.size }, note: `${T.val[cur]} has no left subtree, so it is next: emit <b>${T.val[cur]}</b>. Then cur = cur.right${nxt === null ? " = None." : via ? `, which is a <b>thread</b> back up to ${T.val[nxt]}: that is how Morris climbs without a stack.` : ` = ${T.val[nxt]} (a real child).`}` }));
            cur = nxt;
          } else {
            pred = T.L[cur];
            fr.push(snap({ line: 5, vars: { cur: V(cur), pred: V(pred), threads: thr.size }, note: `${T.val[cur]} has a left subtree. Find its inorder predecessor: start at the left child ${T.val[pred]} and walk right.` }));
            while (R2[pred] !== null && R2[pred] !== cur) {
              pred = R2[pred];
              fr.push(snap({ line: [6, 7], vars: { cur: V(cur), pred: V(pred), threads: thr.size }, note: `pred.right is a real child, keep walking right: pred = ${T.val[pred]}.` }));
            }
            if (R2[pred] === null) {
              R2[pred] = cur; thr.set(pred, cur);
              if (pre) out.push(cur);
              const was = cur; cur = T.L[cur];
              fr.push(snap({ line: [8, 9], ev: pre, made: pred, vars: { cur: V(cur), pred: V(pred), threads: thr.size }, note: `pred ${T.val[pred]} has an empty right pointer: this is the first visit to ${T.val[was]}. Thread ${T.val[pred]} → ${T.val[was]}${pre ? `, emit <b>${T.val[was]}</b> (preorder emits on the first visit)` : ""}, and descend left to ${T.val[cur]}.` }));
            } else {
              R2[pred] = null; thr.delete(pred);
              if (!pre) out.push(cur);
              const was = cur; cur = R2[cur];
              fr.push(snap({ line: [10, 11, 12], ev: !pre, removed: pred, cur: was, vars: { cur: V(was), next: V(cur), pred: V(pred), threads: thr.size }, note: `pred.right already points at ${T.val[was]}: we followed this thread up, so the left subtree is finished. Remove the thread (restoring the tree)${pre ? "" : `, emit <b>${T.val[was]}</b>`} and go right to ${V(cur)}.` }));
              cur = R2[was];
            }
          }
        }
        fr.push(snap({ line: 1, done: true, cur: null, pred: null, vars: { out: out.length, threads: thr.size }, note: `Done with ${thr.size} threads left: the tree is exactly as we found it. Each edge is walked at most a constant number of times (about 3n steps), so it is O(n) time and O(1) extra space.` }));
        return fr;
      },
      render: (f) => {
        const emitted = new Set(f.out);
        const extra = [...f.thr.entries()].map(([u, v]) => ({ u, v, directed: true, cls: u === f.made ? "active tt-thread" : "path tt-thread" }));
        return col(
          draw(f.T, {
            extra,
            top: (id) => (id === f.cur ? "cur" : id === f.pred && !f.done ? "pred" : undefined),
            cls: (id) => (id === f.cur ? "active" : id === f.pred && !f.done ? "visit" : emitted.has(id) ? "done" : ""),
          }),
          seq(pre ? "preorder output" : "inorder output", f.out.map((id) => f.T.val[id]), { hiLast: !!f.ev }),
        );
      },
    });
  });

  /* ---------- 5. Level-order BFS and its variants ---------- */
  const BFS_MODES = ["level order", "zigzag", "right side view", "level averages", "max width (indices)"];
  Viz.register(P("bfs"), (el, opts) => Viz.player(el, {
    title: "Level-order BFS: freeze the queue size to see whole levels",
    tag: "PICK A VARIANT",
    legend: [["active", "dequeued now"], ["visit", "queued, this level"], ["dim", "queued, next level"], ["done", "finished"]],
    codeLang: "python",
    code: [
      "q = deque([root]); res = []",
      "while q:",
      "    level = []",
      "    for _ in range(len(q)):          # exactly this level's nodes",
      "        node = q.popleft()",
      "        level.append(node.val)",
      "        if node.left:  q.append(node.left)",
      "        if node.right: q.append(node.right)",
      "    res.append(finish(level))        # depends on the variant",
    ],
    inputs: [
      { key: "t", label: "tree (level order)", value: opts.t || "3,9,20,8,null,15,7,null,4,null,null,6", width: 260 },
      { key: "mode", label: "variant", type: "select", options: BFS_MODES, value: opts.mode || "zigzag" },
    ],
    random: () => ({ t: randomTreeText(Viz.rand(6, 11), 3) }),
    build: ({ t, mode }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const width = mode === BFS_MODES[4];
      const idx = { 0: 0 };
      let q = [0];
      const done = new Set(), res = [], fr = [];
      let depth = 0;
      const snap = (x) => ({ T, q: [...q], done: new Set(done), res: res.map((r) => ({ ...r })), idx: { ...idx }, mode, width, ...x });
      const lab = (id) => (width ? `${T.val[id]}@${idx[id]}` : String(T.val[id]));
      fr.push(snap({ line: 0, left: 1, level: [], vars: { "len(q)": 1 }, note: width ? "Width variant: give each node a heap-style position (root 0, children 2i+1 and 2i+2). Missing nodes still occupy positions, which is exactly what width counts." : "Seed the queue with the root. BFS visits nodes in order of depth, because a queue serves the oldest discovery first." }));
      while (q.length) {
        const size = q.length, level = [];
        fr.push(snap({ line: [2, 3], left: size, level: [], depth, vars: { depth, "len(q)": size }, note: `Level ${depth} starts. The queue holds <b>exactly</b> this level right now (${size} node${size > 1 ? "s" : ""}). Freezing len(q) before the loop is the whole trick: children appended during the loop wait for the next round.` }));
        for (let k = 0; k < size; k++) {
          const u = q.shift(); level.push(u);
          const kids = [];
          for (const c of [T.L[u], T.R[u]]) if (c !== null) { q.push(c); kids.push(T.val[c]); idx[c] = 2 * idx[u] + (c === T.L[u] ? 1 : 2); }
          fr.push(snap({ u, line: [4, 5, 6, 7], left: size - k - 1, level: [...level], depth, vars: { depth, node: lab(u), "left in level": size - k - 1 }, note: `Dequeue <b>${T.val[u]}</b>${width ? ` (position ${idx[u]})` : ""} and add it to this level. ${kids.length ? `Enqueue ${kids.join(", ")} at the back (next level).` : "No children to enqueue."}` }));
          done.add(u);
        }
        const vals = level.map((x) => T.val[x]);
        let out, why;
        if (mode === "zigzag") { out = depth % 2 ? [...vals].reverse() : vals; why = depth % 2 ? "Odd level: reverse it (right to left). Only the <i>output</i> flips; the queue order never changes." : "Even level: keep left to right."; }
        else if (mode === "right side view") { out = [vals[vals.length - 1]]; why = `The last node dequeued on a level is the rightmost one: ${vals[vals.length - 1]} is what you see from the right.`; }
        else if (mode === "level averages") { const avg = vals.reduce((a, b) => a + b, 0) / vals.length; out = [Number.isInteger(avg) ? avg : Number(avg.toFixed(2))]; why = `Sum ${vals.reduce((a, b) => a + b, 0)} / ${vals.length} nodes.`; }
        else if (width) { const a = idx[level[0]], b = idx[level[level.length - 1]]; out = [b - a + 1]; why = `Width = last position − first position + 1 = ${b} − ${a} + 1 = ${b - a + 1}. (In real code, subtract the level's first position from every index to stop them from doubling out of range.)`; }
        else { out = vals; why = "Plain level order: the level as dequeued."; }
        res.push({ depth, out });
        fr.push(snap({ line: 8, left: 0, level: [...level], depth, fin: true, vars: { depth, finish: `[${out.join(", ")}]` }, note: `Level ${depth} done. ${why}` }));
        depth++;
      }
      let answer = "";
      if (mode === "right side view" || mode === "level averages") answer = `[${res.map((r) => r.out[0]).join(", ")}]`;
      else if (width) answer = String(Math.max(...res.map((r) => r.out[0])));
      else answer = `[${res.map((r) => `[${r.out.join(",")}]`).join(", ")}]`;
      fr.push(snap({ line: 1, left: 0, level: [], fin: false, end: true, vars: { answer }, note: `Queue empty. Answer: <b>${answer}</b>. Every node entered and left the queue once: O(n) time, O(w) space where w is the widest level.` }));
      return fr;
    },
    render: (f) => {
      const inLevel = new Set(f.level || []);
      const thisLevel = new Set(f.q.slice(0, f.left));
      const resHtml = `<div class="v-labeled"><span class="v-caption">res</span><div class="tt-res">${f.res.length ? f.res.map((r, k) => `<div class="${k === f.res.length - 1 && f.fin ? "tt-new" : ""}"><span>L${r.depth}</span>[${r.out.join(", ")}]</div>`).join("") : '<div class="tt-empty">nothing yet</div>'}</div></div>`;
      return col(
        Viz.row(
          draw(f.T, {
            sub: f.width ? (id) => (f.idx[id] !== undefined ? `#${f.idx[id]}` : undefined) : undefined,
            cls: (id) => (id === f.u ? "active" : inLevel.has(id) ? "done" : f.done.has(id) ? "done" : thisLevel.has(id) ? "visit" : f.q.includes(id) ? "dim" : ""),
          }),
          resHtml,
        ),
        Viz.row(
          Viz.queue(f.q.map((id) => f.T.val[id]), { cls: (i) => (i < f.left ? "visit" : "") }),
          seq("level", (f.level || []).map((id) => f.T.val[id]), { hiLast: !f.fin }),
        ),
      );
    },
  }));

  /* ---------- 6. Vertical order / column traversal ---------- */
  const VMODES = ["vertical traversal (LC 987)", "vertical order (LC 314)"];
  Viz.register(P("vertical"), (el, opts) => Viz.player(el, {
    title: "Vertical order: BFS with (row, col) coordinates, then group by column",
    tag: "COLUMNS",
    legend: [["active", "dequeued now"], ["visit", "queued"], ["done", "placed in its column"], ["bad", "tie: same row and column"]],
    codeLang: "python",
    code: [
      "q = deque([(root, 0, 0)]); cols = defaultdict(list)",
      "while q:",
      "    node, r, c = q.popleft()",
      "    cols[c].append((r, node.val))",
      "    if node.left:  q.append((node.left, r + 1, c - 1))",
      "    if node.right: q.append((node.right, r + 1, c + 1))",
      "# LC 987: sort each column by (row, value)",
      "# LC 314: keep BFS order (top to bottom, left to right)",
      "return [[v for r, v in finish(cols[c])] for c in sorted(cols)]",
    ],
    inputs: [
      { key: "t", label: "tree (level order)", value: opts.t || "1,2,3,4,6,5,7", width: 230 },
      { key: "mode", label: "problem", type: "select", options: VMODES, value: opts.mode || VMODES[0] },
    ],
    random: () => ({ t: randomTreeText(Viz.rand(6, 11), 3, false) }),
    build: ({ t, mode }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const sortIt = mode === VMODES[0];
      const rc = { 0: [0, 0] }, cols = new Map(), done = new Set(), fr = [];
      let q = [0];
      const snap = (x) => ({ T, rc: { ...rc }, cols: new Map([...cols].map(([k, v]) => [k, v.map((e) => [...e])])), q: [...q], done: new Set(done), ...x });
      fr.push(snap({ line: 0, vars: { q: `[(${T.val[0]},0,0)]` }, note: "Give the root (row 0, col 0). Going left is col − 1, going right is col + 1, and every step down is row + 1. Nodes in the same column line up vertically." }));
      while (q.length) {
        const u = q.shift(); const [r, c] = rc[u];
        if (!cols.has(c)) cols.set(c, []);
        cols.get(c).push([r, T.val[u], u]);
        const kids = [];
        if (T.L[u] !== null) { rc[T.L[u]] = [r + 1, c - 1]; q.push(T.L[u]); kids.push(`${T.val[T.L[u]]} at (${r + 1},${c - 1})`); }
        if (T.R[u] !== null) { rc[T.R[u]] = [r + 1, c + 1]; q.push(T.R[u]); kids.push(`${T.val[T.R[u]]} at (${r + 1},${c + 1})`); }
        done.add(u);
        fr.push(snap({ u, line: [2, 3, 4, 5], vars: { node: T.val[u], r, c, columns: cols.size }, note: `Dequeue ${T.val[u]} at (row ${r}, col ${c}) and append it to column ${c}. ${kids.length ? `Enqueue ${kids.join(" and ")}.` : "Leaf."} BFS guarantees each column fills top to bottom.` }));
      }
      const keys = [...cols.keys()].sort((a, b) => a - b);
      const ties = new Set();
      for (const k of keys) {
        const e = cols.get(k);
        for (let i = 0; i < e.length; i++) for (let j = 0; j < e.length; j++) if (i !== j && e[i][0] === e[j][0]) ties.add(e[i][2]);
      }
      const finalCols = new Map(keys.map((k) => {
        const e = [...cols.get(k)];
        if (sortIt) e.sort((a, b) => a[0] - b[0] || a[1] - b[1]);
        return [k, e];
      }));
      const answer = `[${keys.map((k) => `[${finalCols.get(k).map((e) => e[1]).join(",")}]`).join(", ")}]`;
      const tieNote = ties.size ? (sortIt ? ` Nodes ${[...ties].map((id) => T.val[id]).join(", ")} share a row <i>and</i> a column, so LC 987 orders them by value, not by BFS arrival.` : ` Nodes ${[...ties].map((id) => T.val[id]).join(", ")} share a row and column; LC 314 keeps them left to right, the BFS order.`) : " No two nodes share a (row, col), so both problems give the same answer here.";
      fr.push(snap({ ties, line: [6, 7, 8], cols: finalCols, fin: true, vars: { answer }, note: `Read columns from the smallest index to the largest.${tieNote} Answer: <b>${answer}</b>.` }));
      return fr;
    },
    render: (f) => {
      const keys = [...f.cols.keys()].sort((a, b) => a - b);
      const rows = Math.max(1, ...keys.map((k) => f.cols.get(k).length));
      const m = Array.from({ length: rows }, (_, r) => keys.map((k) => { const e = f.cols.get(k)[r]; return e ? `${e[1]} r${e[0]}` : null; }));
      const ids = Array.from({ length: rows }, (_, r) => keys.map((k) => (f.cols.get(k)[r] || [])[2]));
      const qs = f.q.map((id) => `${f.T.val[id]} (${f.rc[id][0]},${f.rc[id][1]})`);
      return col(
        Viz.row(
          draw(f.T, {
            sub: (id) => (f.rc[id] ? `c${f.rc[id][1]}` : undefined),
            cls: (id) => (f.ties && f.ties.has(id) ? "bad" : id === f.u ? "active" : f.done.has(id) ? "done" : f.q.includes(id) ? "visit" : ""),
          }),
          keys.length ? Viz.grid(m, { label: f.fin ? "columns (final order)" : "columns (arrival order)", colLabels: keys.map((k) => `col ${k}`), cls: (r, c, v) => (v === null ? "" : f.ties && f.ties.has(ids[r][c]) ? "bad" : ids[r][c] === f.u ? "active" : "done") }) : "",
        ),
        Viz.queue(qs, { label: "queue: value (row, col)", cls: () => "visit" }),
      );
    },
  }));

  /* ---------- 7. Rebuild a tree from two traversals ---------- */
  Viz.register(P("build"), (el, opts) => {
    const post = opts.mode === "post";
    const first = post ? "postorder" : "preorder";
    return Viz.player(el, {
      title: post ? "Rebuild from postorder + inorder: roots come from the back" : "Rebuild from preorder + inorder: the root splits the inorder window",
      tag: "DIVIDE AT THE ROOT",
      legend: [["active", "root just placed"], ["visit", "left-subtree window"], ["path", "right-subtree window"], ["done", "consumed"], ["dim", "outside this call"]],
      codeLang: "python",
      code: [
        "pos = {v: i for i, v in enumerate(inorder)}",
        post ? "p = len(postorder) - 1          # next root, from the back" : "p = 0                            # next root in preorder",
        "def build(lo, hi):               # inorder[lo..hi]",
        "    if lo > hi: return None",
        post ? "    root = TreeNode(postorder[p]); p -= 1" : "    root = TreeNode(preorder[p]); p += 1",
        "    mid = pos[root.val]          # left of mid | right of mid",
        post ? "    root.right = build(mid + 1, hi)   # right first!" : "    root.left = build(lo, mid - 1)",
        post ? "    root.left = build(lo, mid - 1)" : "    root.right = build(mid + 1, hi)",
        "    return root",
      ],
      inputs: [
        { key: "a", label: first, value: opts.a || (post ? "9,15,7,20,3" : "3,9,1,20,15,7"), width: 200 },
        { key: "b", label: "inorder", value: opts.b || (post ? "9,3,15,20,7" : "1,9,3,15,20,7"), width: 200 },
      ],
      random: () => {
        const T = parseTree(randomTreeText(Viz.rand(5, 9), 3));
        const a = [], b = [];
        const walk = (u) => { if (u === null) return; if (!post) a.push(T.val[u]); walk(T.L[u]); b.push(T.val[u]); walk(T.R[u]); if (post) a.push(T.val[u]); };
        walk(0);
        return { a: a.join(","), b: b.join(",") };
      },
      build: ({ a, b }) => {
        const A = Viz.parse.ints(a, { min: 1, max: 13 }), B = Viz.parse.ints(b, { min: 1, max: 13 });
        if (A.length !== B.length) throw new Error(`The two traversals must have the same length (${A.length} vs ${B.length}).`);
        if (new Set(B).size !== B.length) throw new Error("Values must be distinct: with duplicates the root's position in inorder is ambiguous.");
        const pos = new Map(B.map((v, i) => [v, i]));
        if (A.some((v) => !pos.has(v))) throw new Error(`${first} and inorder must contain the same values.`);
        const val = [], L = [], R = [], made = new Set(), stack = [], fr = [];
        let p = post ? A.length - 1 : 0;
        const snap = (x) => ({ A, B, p, made: new Set(made), stack: stack.map((s) => ({ ...s })), ...x });
        fr.push(snap({ line: [0, 1], lo: 0, hi: B.length - 1, vars: { p }, note: post ? "Postorder ends with the root (left, right, <b>root</b>), so read roots from the back. The inorder array tells you which values belong left and right of each root." : "Preorder starts with the root (<b>root</b>, left, right). Inorder puts that root between its left and right subtrees, so its position splits the window in two." }));
        const go = (lo, hi, side, parent) => {
          stack.push({ lo, hi, side });
          if (lo > hi) {
            fr.push(snap({ line: 3, lo, hi, vars: { lo, hi, p }, note: `build(${lo}, ${hi}): empty window, so the ${side} child of ${parent} is None.` }));
            stack.pop(); return null;
          }
          const v = A[p];
          const id = val.length; val.push(v); L.push(null); R.push(null); made.add(id);
          p += post ? -1 : 1;
          const mid = pos.get(v);
          if (mid < lo || mid > hi) throw new Error(`These sequences do not describe one tree: ${v} must lie inside inorder[${lo}..${hi}].`);
          stack[stack.length - 1].root = v;
          const nl = mid - lo, nr = hi - mid;
          fr.push(snap({ line: [4, 5], lo, hi, mid, cur: id, vars: { lo, hi, root: v, mid, p }, note: `Next root from ${first}: <b>${v}</b>${parent !== null ? ` (the ${side} child of ${parent})` : ""}. It sits at inorder[${mid}], so ${nl} value${nl === 1 ? "" : "s"} to its left form the left subtree and ${nr} to its right form the right subtree.` }));
          if (post) { R[id] = go(mid + 1, hi, "right", v); L[id] = go(lo, mid - 1, "left", v); }
          else { L[id] = go(lo, mid - 1, "left", v); R[id] = go(mid + 1, hi, "right", v); }
          stack.pop();
          return id;
        };
        go(0, B.length - 1, "root", null);
        // Verify consistency
        const ta = [], tb = [];
        const walk = (u) => { if (u === null) return; if (!post) ta.push(val[u]); walk(L[u]); tb.push(val[u]); walk(R[u]); if (post) ta.push(val[u]); };
        walk(0);
        if (ta.join() !== A.join() || tb.join() !== B.join()) throw new Error("These two sequences are not traversals of the same tree.");
        let h = 0; const dep = (u, d) => { if (u === null) return; h = Math.max(h, d); dep(L[u], d + 1); dep(R[u], d + 1); }; dep(0, 0);
        if (h > 5) throw new Error("That tree is more than 6 levels deep; use a bushier example so it fits.");
        const lay = Viz.layoutTree(0, (id) => [L[id], R[id]], (id) => val[id], { dx: 50, dy: 62 });
        const T = { val, L, R, lay };
        fr.push(snap({ line: 8, fin: true, lo: 0, hi: -1, vars: { nodes: val.length }, note: `Built. Each value was placed once, and the hash map made each split O(1): O(n) total. Without the map, scanning for mid makes it O(n²) on skewed trees.` }));
        return fr.map((f) => ({ ...f, T }));
      },
      render: (f) => {
        const inW = (i) => i >= f.lo && i <= f.hi;
        const aCls = (i) => {
          const used = post ? i > f.p : i < f.p;
          if (f.cur !== undefined && f.A[i] === f.T.val[f.cur]) return "active";
          return used ? "done" : "";
        };
        const bCls = (i) => {
          if (f.fin) return "done";
          if (!inW(i)) return "dim";
          if (f.mid === undefined) return "window";
          return i === f.mid ? "active" : i < f.mid ? "visit" : "path";
        };
        const cards = f.stack.map((s) => ({ t: `build(${s.lo}, ${s.hi})`, s: s.root !== undefined ? `root ${s.root}` : s.side }));
        return col(
          Viz.row(
            Viz.array(f.A, { label: first, ptrs: f.p >= 0 && f.p < f.A.length ? { p: f.p } : {}, cls: aCls }),
            Viz.array(f.B, { label: "inorder", ptrs: f.mid !== undefined && !f.fin ? { mid: f.mid } : {}, cls: bCls }),
          ),
          Viz.row(
            draw(f.T, { hidden: (id) => !f.made.has(id), cls: (id) => (id === f.cur ? "active" : "done") }),
            stackHtml(cards, { narrow: true }),
          ),
        );
      },
    });
  });

  /* ---------- 8. All nodes at distance K: tree -> graph ---------- */
  Viz.register(P("distk"), (el, opts) => Viz.player(el, {
    title: "All nodes at distance K: add parent pointers, then BFS like a graph",
    tag: "TREE AS GRAPH",
    legend: [["path", "target"], ["active", "dequeued"], ["visit", "frontier"], ["done", "answer (distance K)"], ["dim", "already seen"]],
    codeLang: "python",
    code: [
      "parent = {root: None}  # filled by any traversal",
      "q, seen, d = deque([target]), {target}, 0",
      "while q and d < k:",
      "    for _ in range(len(q)):",
      "        node = q.popleft()",
      "        for nb in (node.left, node.right, parent[node]):",
      "            if nb and nb not in seen:",
      "                seen.add(nb); q.append(nb)",
      "    d += 1",
      "return [node.val for node in q]",
    ],
    inputs: [
      { key: "t", label: "tree (level order)", value: opts.t || "3,5,1,6,2,0,8,null,null,7,4", width: 240 },
      { key: "target", label: "target value", value: opts.target || "5", width: 80 },
      { key: "k", label: "k", value: opts.k || "2", width: 60 },
    ],
    random: () => { const t = randomTreeText(Viz.rand(7, 12), 3); const T = parseTree(t); return { t, target: String(T.val[Viz.rand(0, T.n - 1)]), k: String(Viz.rand(1, 3)) }; },
    build: ({ t, target, k }) => {
      const T = parseTree(t, { maxN: 15, maxDepth: 4 });
      const tv = Viz.parse.int(target), K = Viz.parse.int(k, { min: 0, max: 8 });
      const tid = T.val.indexOf(tv);
      if (tid < 0) throw new Error(`No node has value ${tv}.`);
      if (T.val.filter((v) => v === tv).length > 1) throw new Error("Use distinct values so the target is unambiguous.");
      const par = { 0: null };
      for (let u = 0; u < T.n; u++) for (const c of [T.L[u], T.R[u]]) if (c !== null) par[c] = u;
      const fr = [];
      let q = [tid], d = 0;
      const seen = new Set([tid]);
      const snap = (x) => ({ T, tid, q: [...q], seen: new Set(seen), d, par, ...x });
      fr.push(snap({ line: [0, 1], vars: { target: tv, k: K, d }, note: "A TreeNode only points down, but distance can go <i>up</i> through the parent. Record every node's parent (any traversal), and the tree becomes an undirected graph. Then BFS from the target, one ring per distance." }));
      while (q.length && d < K) {
        const size = q.length;
        for (let s = 0; s < size; s++) {
          const u = q.shift();
          const got = [];
          for (const nb of [T.L[u], T.R[u], par[u]]) if (nb !== null && nb !== undefined && !seen.has(nb)) { seen.add(nb); q.push(nb); got.push(T.val[nb] + (nb === par[u] ? " (parent)" : "")); }
          fr.push(snap({ u, line: [4, 5, 6, 7], vars: { d, node: T.val[u], q: `[${q.map((x) => T.val[x]).join(", ")}]` }, note: `From ${T.val[u]} (distance ${d}) step to unseen neighbours ${got.length ? got.join(", ") : "(none)"}: left, right <i>and parent</i>. They are at distance ${d + 1}.` }));
        }
        d++;
        fr.push(snap({ line: 8, vars: { d, q: `[${q.map((x) => T.val[x]).join(", ")}]` }, note: `Ring ${d} complete: the queue holds exactly the nodes at distance ${d}.` }));
      }
      const ans = `[${q.map((x) => T.val[x]).join(", ")}]`;
      fr.push(snap({ line: 9, fin: true, vars: { answer: ans }, note: `d = k, so the queue is the answer: <b>${ans}</b>. O(n) time and space.` }));
      return fr;
    },
    render: (f) => {
      const inQ = new Set(f.q);
      const pe = new Set(Object.entries(f.par).filter(([, p]) => p !== null).map(([c, p]) => `${p}-${c}`));
      return col(
        draw(f.T, {
          sub: (id) => (id === f.tid ? "target" : undefined),
          cls: (id) => (id === f.tid && !f.fin ? "path" : id === f.u ? "active" : inQ.has(id) ? (f.fin ? "done" : "visit") : f.seen.has(id) ? "dim" : ""),
          ecls: (u, v) => (pe.has(`${u}-${v}`) && (f.seen.has(u) && f.seen.has(v)) ? "visit" : ""),
        }),
        Viz.queue(f.q.map((id) => f.T.val[id]), { label: `queue = ring at distance ${f.d}`, cls: () => (f.fin ? "done" : "visit") }),
      );
    },
  }));
})();
