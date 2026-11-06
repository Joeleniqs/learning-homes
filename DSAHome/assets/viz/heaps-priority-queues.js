/* Heaps & Priority Queues visualizers. Each frame comes from running the real algorithm on your input:
 * the tree is always drawn from the array, exactly as a binary heap stores it in memory. */
(() => {
  const esc = Viz.esc;
  const parent = (i) => (i - 1) >> 1;
  /* Lexicographic compare, like Python tuples: numbers, strings, or arrays of them. */
  const cmp = (a, b) => {
    if (Array.isArray(a)) { for (let k = 0; k < a.length; k++) { const c = cmp(a[k], b[k]); if (c) return c; } return 0; }
    return a < b ? -1 : a > b ? 1 : 0;
  };
  const minLess = (a, b) => cmp(a, b) < 0;
  const maxLess = (a, b) => cmp(a, b) > 0;
  /* Textbook binary-heap push / pop. less(a, b) = "a should sit above b". Returns swap counts. */
  const hpush = (h, x, less = minLess) => {
    h.push(x); let i = h.length - 1, s = 0;
    while (i > 0 && less(h[i], h[parent(i)])) { const p = parent(i); [h[i], h[p]] = [h[p], h[i]]; i = p; s++; }
    return s;
  };
  const siftDown = (h, i, less = minLess, n = h.length) => {
    let s = 0;
    for (;;) {
      let c = 2 * i + 1;
      if (c >= n) break;
      if (c + 1 < n && less(h[c + 1], h[c])) c++;
      if (!less(h[c], h[i])) break;
      [h[i], h[c]] = [h[c], h[i]]; i = c; s++;
    }
    return s;
  };
  const hpop = (h, less = minLess) => {
    const top = h[0], last = h.pop();
    if (h.length) { h[0] = last; siftDown(h, 0, less); }
    return top;
  };
  const isHeap = (h, less = minLess) => h.every((v, i) => i === 0 || !less(v, h[parent(i)]));
  /* Tree view of a heap array: node i sits at depth floor(log2(i+1)), evenly spread across its level. */
  const heapTree = (a, o = {}) => {
    const label = o.label || "tree view";
    if (!a.length) return Viz.labeled(label, '<div class="hp-empty">empty</div>');
    const depth = Math.floor(Math.log2(a.length)), W = Math.max(2 ** depth * (o.gap || 46), 180);
    const nodes = a.map((v, i) => {
      const d = Math.floor(Math.log2(i + 1)), cnt = 2 ** d, pos = i - (cnt - 1);
      return { id: i, x: ((pos + 0.5) * W) / cnt, y: d * (o.dy || 62), label: o.fmt ? o.fmt(v, i) : String(v), sub: o.sub === false ? undefined : o.sub ? o.sub(v, i) : i };
    });
    const edges = [];
    for (let i = 1; i < a.length; i++) edges.push({ u: parent(i), v: i, cls: o.edgeCls ? o.edgeCls(parent(i), i) : "" });
    return Viz.graph({ nodes, edges }, { r: o.r || 18, nodeCls: (id) => (o.cls ? o.cls(+id) : "") || "", label });
  };
  const arrView = (a, o = {}) => (a.length ? Viz.array(a, o) : Viz.labeled(o.label || "array", '<div class="hp-empty">empty</div>'));
  const chips = (label, items, cls = () => "", none = "none yet") =>
    Viz.labeled(label, `<div class="hp-chips">${items.length ? items.map((v, i) => `<span class="v-item ${cls(i, v)}">${esc(v)}</span>`).join("") : `<span class="hp-empty">${none}</span>`}</div>`);
  const col = (...parts) => `<div class="hp-col">${parts.filter(Boolean).join("")}</div>`;
  const badge = (text, cls = "") => `<div class="hp-badge ${cls}">${text}</div>`;
  const nums = (s, label, min, max, lo = -99, hi = 99) => {
    const a = String(s).split(/[\s,]+/).filter(Boolean).map(Number);
    if (a.length < min || a.length > max || a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`Use ${min}–${max} whole numbers from ${lo} to ${hi} for ${label}.`);
    return a;
  };
  const ord = (n) => n + (n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] || "th");
  const shuffle = (a) => { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  /* 1 ─ push / pop with sift-up and sift-down, tree and array side by side. */
  Viz.register("heaps-priority-queues-ops", (el) => Viz.player(el, {
    title: "Binary heap: the tree is just a drawing of the array, and push / pop repair one root-to-leaf path",
    tag: "SIFT-UP · SIFT-DOWN · O(log n)",
    legend: [["active", "element being placed"], ["visit", "compared with"], ["bad", "leaving the heap"], ["done", "in place"]],
    codeLang: "python",
    code: [
      "better = lambda a, b: a < b        # min-heap; use > for a max-heap",
      "def push(h, x):",
      "    h.append(x); i = len(h) - 1     # new last leaf",
      "    while i > 0:",
      "        p = (i - 1) // 2",
      "        if not better(h[i], h[p]): break",
      "        h[i], h[p] = h[p], h[i]; i = p   # swap up",
      "def pop(h):",
      "    top, last = h[0], h.pop()       # detach the last leaf",
      "    if h: h[0], i = last, 0         # and put it at the root",
      "    while h and 2 * i + 1 < len(h):",
      "        c = 2 * i + 1               # left child",
      "        if c + 1 < len(h) and better(h[c + 1], h[c]): c += 1",
      "        if not better(h[c], h[i]): break",
      "        h[i], h[c] = h[c], h[i]; i = c   # swap down",
      "    return top",
    ],
    inputs: [
      { key: "mode", label: "heap", type: "select", options: ["min-heap", "max-heap"], value: "min-heap" },
      { key: "ops", label: "operations: push x, pop, peek (up to 20)", value: "push 5, push 3, push 8, push 1, push 9, push 2, push 0, pop, pop", width: 430 },
    ],
    random: () => {
      const ops = []; let n = 0;
      for (let t = 0; t < Viz.rand(8, 12); t++) {
        if (n > 2 && Math.random() < 0.3) { ops.push("pop"); n--; } else { ops.push(`push ${Viz.rand(0, 40)}`); n++; }
      }
      ops.push("pop");
      return { mode: Math.random() < 0.7 ? "min-heap" : "max-heap", ops: ops.join(", ") };
    },
    build: (inp) => {
      const isMin = inp.mode !== "max-heap", less = isMin ? minLess : maxLess, word = isMin ? "smaller" : "larger";
      const ops = String(inp.ops).split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^(push)\s+(-?\d+)$|^(pop|peek)$/i);
        if (!m) throw new Error("Use operations like: push 5, pop, peek.");
        return m[1] ? { op: "push", x: Number(m[2]) } : { op: m[3].toLowerCase() };
      });
      if (!ops.length || ops.length > 20) throw new Error("Use 1–20 operations.");
      if (ops.some((o) => o.op === "push" && Math.abs(o.x) > 999)) throw new Error("Use push values from -999 to 999.");
      const h = [], popped = [], fr = [];
      let swaps = 0;
      const S = (x) => fr.push({ h: [...h], popped: [...popped], cls: {}, edge: null, math: "", ...x, vars: { size: h.length, swaps, ...(x.vars || {}) } });
      S({ line: 0, note: `A ${inp.mode} is a complete binary tree stored in an array: node <b>i</b> has children <b>2i+1</b>, <b>2i+2</b> and parent <b>(i−1)//2</b>. Rule: every parent is ${word} than or equal to its children, so the ${isMin ? "minimum" : "maximum"} is always at index 0.` });
      ops.forEach((o, k) => {
        if (o.op === "push") {
          if (h.length >= 15) throw new Error(`At most 15 elements fit in this view (operation ${k + 1}).`);
          h.push(o.x); let i = h.length - 1;
          S({ line: 2, cls: { [i]: "active" }, vars: { x: o.x, i }, note: `push(${o.x}): append it as the next leaf, index ${i}. The tree stays complete (no gaps in the array); only the order may now be wrong, and only on the path from this leaf to the root.`, math: i ? `parent(${i}) = (${i} − 1) // 2 = ${parent(i)}` : "index 0 is the root" });
          while (i > 0) {
            const p = parent(i);
            if (!less(h[i], h[p])) {
              S({ line: [4, 5], cls: { [i]: "done", [p]: "visit" }, edge: [p, i], vars: { x: o.x, i, p }, note: `${h[i]} is not ${word} than its parent ${h[p]} (index ${p}). Stop: every parent on the path is ${word} or equal again.`, math: `parent(${i}) = (${i} − 1) // 2 = ${p}` });
              break;
            }
            S({ line: [4, 5], cls: { [i]: "active", [p]: "visit" }, edge: [p, i], vars: { x: o.x, i, p }, note: `${h[i]} is ${word} than its parent ${h[p]} (index ${p}): the rule is broken here, so swap them.`, math: `parent(${i}) = (${i} − 1) // 2 = ${p}` });
            [h[i], h[p]] = [h[p], h[i]]; swaps++; i = p;
            S({ line: 6, cls: { [i]: "active" }, edge: null, vars: { x: o.x, i }, note: `${o.x} moved up to index ${i}.${i === 0 ? " It is the new root." : ""}`, math: i ? `next parent: (${i} − 1) // 2 = ${parent(i)}` : "reached the root" });
          }
          if (i === 0 && h.length > 1) S({ line: 3, cls: { 0: "done" }, vars: { x: o.x, i }, note: `${o.x} reached the root: it is the new ${isMin ? "minimum" : "maximum"}. At most ⌊log₂ n⌋ swaps, one per level.` });
          else if (h.length === 1) S({ line: 3, cls: { 0: "done" }, vars: { x: o.x, i }, note: `The heap had been empty, so ${o.x} is the root.` });
        } else if (o.op === "peek") {
          if (!h.length) throw new Error(`Can't peek at an empty heap (operation ${k + 1}).`);
          S({ line: 0, cls: { 0: "done" }, note: `peek() = h[0] = <b>${h[0]}</b>. No work at all: O(1). The rest of the array is only partially ordered.` });
        } else {
          if (!h.length) throw new Error(`Can't pop from an empty heap (operation ${k + 1}).`);
          const top = h[0], n = h.length;
          S({ line: 8, cls: { 0: "bad", [n - 1]: n > 1 ? "visit" : "bad" }, vars: { top }, note: `pop(): the answer is the root, <b>${top}</b>. To keep the array gap-free, detach the <b>last</b> leaf (${h[n - 1]}, index ${n - 1}) and move it into the root's place.` });
          const last = h.pop(); popped.push(top);
          if (!h.length) { S({ line: 15, vars: { top }, note: `That was the only element. Return ${top}; the heap is empty.` }); return; }
          h[0] = last; let i = 0;
          S({ line: 9, cls: { 0: "active" }, vars: { top, i }, note: `${last} now sits at the root, which is almost certainly too high. Sift it down.` });
          while (2 * i + 1 < h.length) {
            let c = 2 * i + 1;
            const two = c + 1 < h.length;
            if (two && less(h[c + 1], h[c])) c++;
            const cls = { [i]: "active", [2 * i + 1]: "visit" };
            if (two) cls[2 * i + 2] = "visit";
            const pick = two ? `The ${word} child is ${h[c]} (index ${c}); compare only with that one, so whichever moves up is ${word} than its new sibling too.` : `Only one child: ${h[c]} (index ${c}).`;
            const math = `children(${i}) = ${2 * i + 1}${two ? `, ${2 * i + 2}` : ""}`;
            if (!less(h[c], h[i])) { S({ line: [11, 12, 13], cls: { ...cls, [i]: "done" }, edge: [i, c], vars: { top, i, c }, math, note: `${pick} ${h[i]} is already ${word} or equal: stop.` }); break; }
            S({ line: [11, 12, 13], cls, edge: [i, c], vars: { top, i, c }, math, note: `${pick} It beats ${h[i]}, so swap them.` });
            [h[i], h[c]] = [h[c], h[i]]; swaps++; i = c;
            S({ line: 14, cls: { [i]: "active" }, vars: { top, i }, math: 2 * i + 1 < h.length ? `children(${i}) = ${2 * i + 1}${2 * i + 2 < h.length ? `, ${2 * i + 2}` : ""}` : `${i} has no children (2·${i}+1 = ${2 * i + 1} ≥ ${h.length})`, note: `${h[i]} moved down to index ${i}.` });
          }
          S({ line: 15, cls: { [i]: "done" }, vars: { top, i }, note: `Heap repaired; pop returns <b>${top}</b>. One root-to-leaf path, at most ⌊log₂ n⌋ swaps: O(log n).` });
        }
      });
      S({ line: 0, note: `Done: ${swaps} swaps in total. Popped in order: [${popped.join(", ")}]: always the current ${isMin ? "minimum" : "maximum"}. Popping everything would give a sorted sequence; that is heapsort.` });
      return fr;
    },
    render: (f) => {
      const cl = (i) => f.cls[i] || "";
      return Viz.row(
        heapTree(f.h, { cls: cl, edgeCls: (p, c) => (f.edge && f.edge[0] === p && f.edge[1] === c ? "active" : "") }),
        col(
          arrView(f.h, { cls: cl, label: "array view (what memory holds)" }),
          `<div class="hp-math">${f.math ? esc(f.math) : "parent(i) = (i − 1) // 2 · children 2i + 1, 2i + 2"}</div>`,
          chips("popped, in order", f.popped, (i) => (i === f.popped.length - 1 ? "done" : "")),
        ),
      );
    },
  }));

  /* 2 ─ heapify bottom-up: why it is O(n), not O(n log n). */
  const heightOf = (i, n) => { let h = 0; while (2 * i + 1 < n) { i = 2 * i + 1; h++; } return h; };
  Viz.register("heaps-priority-queues-heapify", (el) => Viz.player(el, {
    title: "Heapify bottom-up: sift down every parent, last to first; most nodes are near the bottom and barely move",
    tag: "BUILD A HEAP IN O(n)",
    legend: [["done", "already a valid sub-heap"], ["visit", "subtree being fixed"], ["active", "element sifting down"]],
    codeLang: "python",
    code: [
      "def heapify(a):                    # min-heap, in place",
      "    n = len(a)",
      "    for i in range(n // 2 - 1, -1, -1):   # last parent ... root",
      "        while 2 * i + 1 < n:       # sift a[i] down",
      "            c = 2 * i + 1",
      "            if c + 1 < n and a[c + 1] < a[c]: c += 1",
      "            if a[i] <= a[c]: break",
      "            a[i], a[c] = a[c], a[i]; i = c",
    ],
    inputs: [{ key: "a", label: "array (2–15 numbers)", value: "9, 7, 8, 4, 5, 6, 1, 3, 2, 0, 11, 10", width: 330 }],
    random: () => ({ a: shuffle(Array.from({ length: Viz.rand(9, 15) }, (_, i) => i * 2 + Viz.rand(0, 1))).join(", ") }),
    build: (inp) => {
      const a = nums(inp.a, "the array", 2, 15), n = a.length, fr = [];
      let swaps = 0;
      const levels = new Map();
      for (let i = 0; i < n; i++) { const h = heightOf(i, n); levels.set(h, (levels.get(h) || 0) + 1); }
      const bound = [...levels].reduce((s, [h, c]) => s + h * c, 0);
      const S = (x) => fr.push({ a: [...a], swaps, bound, levels: [...levels].sort((p, q) => q[0] - p[0]), ...x, vars: { swaps, ...(x.vars || {}) } });
      const sub = (r) => { const out = new Set(); const st = [r]; while (st.length) { const u = st.pop(); if (u < n) { out.add(u); st.push(2 * u + 1, 2 * u + 2); } } return out; };
      S({ line: [0, 1], from: n, note: `Start from the raw array. Indices ${Math.floor(n / 2)}..${n - 1} are <b>leaves</b> (no children), and a single node is already a valid heap. So only the parents 0..${Math.floor(n / 2) - 1} need work, and we fix them from the bottom up.` });
      for (let r = Math.floor(n / 2) - 1; r >= 0; r--) {
        const tree = sub(r);
        S({ line: 2, from: r + 1, tree, cur: r, vars: { i: r }, note: `i = ${r}: both subtrees under ${a[r]} are already heaps (they were fixed earlier). One sift-down of ${a[r]} makes the whole subtree rooted at ${r} a heap. Its height is ${heightOf(r, n)}, so at most ${heightOf(r, n)} swaps.` });
        let i = r;
        while (2 * i + 1 < n) {
          let c = 2 * i + 1;
          if (c + 1 < n && a[c + 1] < a[c]) c++;
          if (a[i] <= a[c]) { S({ line: [4, 5, 6], from: r + 1, tree, cur: i, cmp: c, vars: { i, c }, note: `${a[i]} ≤ smaller child ${a[c]}: in place. Subtree ${r} is now a heap.` }); break; }
          S({ line: [4, 5, 6], from: r + 1, tree, cur: i, cmp: c, vars: { i, c }, note: `Smaller child of ${a[i]} is ${a[c]} (index ${c}). It is smaller, so swap.` });
          [a[i], a[c]] = [a[c], a[i]]; swaps++; i = c;
          S({ line: 7, from: r + 1, tree, cur: i, vars: { i }, note: `${a[i]} moved down to index ${i}.${2 * i + 1 >= n ? " It is a leaf now." : ""}` });
        }
      }
      S({ line: 2, from: 0, note: `Valid min-heap after <b>${swaps}</b> swaps. The worst case is Σ height × (nodes at that height) = <b>${bound}</b> &lt; n = ${n}: half the nodes have height 0, a quarter height 1, an eighth height 2… so the total is O(n). Pushing the ${n} items one by one could cost up to Σ depth instead, which is O(n log n).` });
      return fr;
    },
    render: (f) => {
      const cl = (i) => (i === f.cur ? "active" : i === f.cmp ? "visit" : f.tree && f.tree.has(i) ? "visit" : i >= f.from ? "done" : "");
      const rows = f.levels.map(([h, c]) => [h, c, h, h * c]);
      return Viz.row(
        heapTree(f.a, { cls: (i) => (i === f.cmp ? "active" : "") || cl(i), edgeCls: (p, c) => (p === f.cur && c === f.cmp ? "active" : "") }),
        col(
          Viz.array(f.a, { cls: cl, label: "array" }),
          Viz.grid(rows, { colLabels: ["height", "nodes", "max swaps each", "max total"], label: `worst-case work by height (sum ${f.bound})` }),
          badge(`swaps so far: <b>${f.swaps}</b> ≤ ${f.bound}`),
        ),
      );
    },
  }));

  /* 3 ─ Top-k with a min-heap of size k. */
  Viz.register("heaps-priority-queues-topk", (el) => Viz.player(el, {
    title: "k largest: keep a min-heap of the best k so far; its root is the bar a newcomer has to beat",
    tag: "O(n log k) TIME · O(k) SPACE",
    legend: [["active", "current number"], ["done", "kept (in the heap)"], ["bad", "evicted later"], ["dim", "rejected"], ["visit", "the bar: heap[0]"]],
    codeLang: "python",
    code: [
      "heap = []                           # min-heap, size ≤ k",
      "for x in nums:",
      "    if len(heap) < k:",
      "        heapq.heappush(heap, x)",
      "    elif x > heap[0]:               # beats the weakest of the top k",
      "        heapq.heapreplace(heap, x)  # pop the root, push x: one sift",
      "    # else: x can never be in the top k",
      "return heap[0]                      # the k-th largest",
    ],
    inputs: [
      { key: "nums", label: "stream of numbers (2–16)", value: "3, 2, 1, 5, 6, 4, 9, 7, 2, 8", width: 300 },
      { key: "k", label: "k", value: "3", width: 60 },
    ],
    random: () => ({ nums: Array.from({ length: Viz.rand(8, 14) }, () => Viz.rand(1, 40)).join(", "), k: String(Viz.rand(2, 5)) }),
    build: (inp) => {
      const a = nums(inp.nums, "the stream", 2, 16);
      const k = Viz.parse.int(inp.k, { min: 1, max: Math.min(8, a.length) });
      const h = [], fr = [], kept = new Map(), status = a.map(() => "");
      const S = (x) => fr.push({ a, h: [...h], status: [...status], ...x });
      S({ line: 0, i: -1, note: `Goal: the ${k} largest of ${a.length} numbers without sorting all of them. Keep a <b>min</b>-heap of at most ${k} numbers: the root is the smallest of the best ${k}, i.e. the bar to beat.` });
      a.forEach((x, i) => {
        if (h.length < k) {
          hpush(h, x); status[i] = "done";
          S({ line: [2, 3], i, hi: h.indexOf(x), vars: { x, size: h.length }, note: `Heap not full yet (${h.length - 1} < ${k}): push ${x}.${h.length === k ? ` Now full; the bar is heap[0] = ${h[0]}.` : ""}` });
        } else if (x > h[0]) {
          const out = h[0];
          S({ line: 4, i, bar: true, vars: { x, "heap[0]": out }, note: `${x} &gt; heap[0] = ${out}: ${x} belongs in the top ${k}, and ${out} is now at best ${ord(k + 1)}.` });
          const j = a.findIndex((v, t) => t < i && v === out && status[t] === "done");
          if (j >= 0) status[j] = "bad";
          h[0] = x; siftDown(h, 0); status[i] = "done";
          S({ line: 5, i, hi: h.indexOf(x), vars: { x, evicted: out }, note: `heapreplace: ${x} takes the root's place and sifts down (≤ log₂ ${k} swaps). New bar: ${h[0]}.` });
        } else {
          status[i] = "rej";
          S({ line: [4, 6], i, bar: true, vars: { x, "heap[0]": h[0] }, note: `${x} ≤ heap[0] = ${h[0]}: at least ${k} numbers are ≥ ${x} already, so it can never be in the top ${k}. Skip it, O(1).` });
        }
      });
      const sorted = [...h].sort((p, q) => q - p);
      S({ line: 7, i: a.length, bar: true, note: `Top ${k}: [${sorted.join(", ")}], and the <b>${ord(k)} largest is heap[0] = ${h[0]}</b>. Each number costs at most one O(log k) heap operation: O(n log k). For the k <i>smallest</i>, flip it: a max-heap of size k (in Python, push −x).` });
      return fr;
    },
    render: (f) => Viz.row(
      col(
        Viz.array(f.a, { cls: (i) => (i === f.i ? "active" : f.status[i] === "rej" ? "dim" : f.status[i]), ptrsTop: f.i >= 0 && f.i < f.a.length ? { x: f.i } : {}, label: "stream" }),
        heapTree(f.h, { label: "min-heap of the best k", cls: (i) => (i === f.hi ? "active" : i === 0 && f.bar ? "visit" : "done") }),
      ),
    ),
  }));

  /* 4 ─ k-way merge: the heap holds one "front runner" per list. */
  Viz.register("heaps-priority-queues-kmerge", (el) => Viz.player(el, {
    title: "Merge k sorted lists: the heap holds the current front of every list, so the global minimum is always on top",
    tag: "O(N log k)",
    legend: [["active", "just popped → output"], ["visit", "in the heap"], ["path", "just pushed"]],
    codeLang: "python",
    code: [
      "heap = [(lst[0], i, 0) for i, lst in enumerate(lists) if lst]",
      "heapq.heapify(heap)                     # one entry per list",
      "out = []",
      "while heap:",
      "    val, i, j = heapq.heappop(heap)     # smallest front overall",
      "    out.append(val)",
      "    if j + 1 < len(lists[i]):           # that list moves forward",
      "        heapq.heappush(heap, (lists[i][j + 1], i, j + 1))",
      "return out",
    ],
    inputs: [{ key: "lists", label: "sorted lists, separated by ; (2–5 lists, ≤ 6 each)", value: "1 4 7 10; 2 5 6; 0 8 9; 3 11", width: 360 }],
    random: () => ({ lists: Array.from({ length: Viz.rand(3, 4) }, () => Array.from({ length: Viz.rand(1, 5) }, () => Viz.rand(0, 30)).sort((p, q) => p - q).join(" ")).join("; ") }),
    build: (inp) => {
      const lists = String(inp.lists).split(";").map((s) => s.trim()).filter(Boolean).map((s) => nums(s, "each list", 1, 6));
      if (lists.length < 2 || lists.length > 5) throw new Error("Use 2–5 lists separated by ;.");
      if (lists.some((l) => l.some((v, i) => i && v < l[i - 1]))) throw new Error("Each list must be sorted in non-decreasing order.");
      const k = lists.length, N = lists.reduce((s, l) => s + l.length, 0);
      const heap = lists.map((l, i) => [l[0], i, 0]);
      const out = [], fr = [], ptr = lists.map(() => 0);
      for (let i = Math.floor(k / 2) - 1; i >= 0; i--) siftDown(heap, i);
      const S = (x) => fr.push({ lists, heap: heap.map((e) => [...e]), out: [...out], ptr: [...ptr], ...x });
      S({ line: [0, 1], note: `Put the first element of each of the ${k} lists in a min-heap of tuples <code>(value, list, position)</code>. Ties on value are broken by the list index, so tuples never compare anything incomparable. The heap never holds more than k = ${k} entries.` });
      while (heap.length) {
        const [val, i, j] = hpop(heap);
        out.push(val); ptr[i] = j + 1;
        S({ line: [4, 5], popped: [i, j], vars: { val, i, j, heap: heap.length }, note: `Pop the smallest front: <b>${val}</b> from list L${i}. Everything still in the lists is ≥ ${val} (each list is sorted and its front is in the heap), so ${val} is the next output.` });
        if (j + 1 < lists[i].length) {
          hpush(heap, [lists[i][j + 1], i, j + 1]);
          S({ line: [6, 7], pushed: [i, j + 1], vars: { val, i, j: j + 1, heap: heap.length }, note: `L${i} moves forward: push its next element ${lists[i][j + 1]}. One pop + one push per output element: O(log k) each.` });
        } else S({ line: 6, vars: { val, i, heap: heap.length }, note: `L${i} is exhausted; the heap shrinks to ${heap.length}.` });
      }
      S({ line: 8, note: `Merged ${N} elements from ${k} lists in O(N log k). Merging pairwise one list at a time would be O(N·k); a divide-and-conquer pairing also gives O(N log k).` });
      return fr;
    },
    render: (f) => {
      const width = Math.max(...f.lists.map((l) => l.length));
      const inHeap = new Set(f.heap.map((e) => `${e[1]},${e[2]}`));
      return Viz.row(
        col(
          Viz.grid(f.lists.map((l) => Array.from({ length: width }, (_, c) => (c < l.length ? l[c] : ""))), {
            rowLabels: f.lists.map((_, i) => `L${i}`),
            cls: (r, c) => (c >= f.lists[r].length ? "" : f.popped && f.popped[0] === r && f.popped[1] === c ? "active" : f.pushed && f.pushed[0] === r && f.pushed[1] === c ? "path" : inHeap.has(`${r},${c}`) ? "visit" : c < f.ptr[r] ? "dim" : ""),
            label: "the k sorted lists",
          }),
          arrView(f.out, { cls: (i) => (i === f.out.length - 1 && f.popped ? "active" : "done"), label: "output" }),
        ),
        heapTree(f.heap, { label: "min-heap of (value, list)", fmt: (e) => e[0], sub: (e) => `L${e[1]}`, cls: (i) => (f.pushed && f.heap[i][1] === f.pushed[0] && f.heap[i][2] === f.pushed[1] ? "path" : "visit") }),
      );
    },
  }));

  /* 5 ─ Running median with two heaps. */
  Viz.register("heaps-priority-queues-median", (el) => Viz.player(el, {
    title: "Running median: a max-heap holds the smaller half, a min-heap the larger half; the median sits on their tops",
    tag: "LC 295 · O(log n) ADD · O(1) MEDIAN",
    legend: [["visit", "smaller half (lo)"], ["done", "larger half (hi)"], ["active", "median / moving"]],
    codeLang: "python",
    code: [
      "lo, hi = [], []      # lo: max-heap (store -x), hi: min-heap",
      "def add(x):",
      "    if not lo or x <= -lo[0]: heappush(lo, -x)",
      "    else: heappush(hi, x)",
      "    if len(lo) > len(hi) + 1: heappush(hi, -heappop(lo))",
      "    elif len(hi) > len(lo): heappush(lo, -heappop(hi))",
      "def median():",
      "    if len(lo) > len(hi): return -lo[0]",
      "    return (-lo[0] + hi[0]) / 2",
    ],
    inputs: [{ key: "s", label: "stream (1–14 numbers)", value: "5, 15, 1, 3, 8, 7, 9, 10, 20, 2", width: 300 }],
    random: () => ({ s: Array.from({ length: Viz.rand(7, 12) }, () => Viz.rand(1, 50)).join(", ") }),
    build: (inp) => {
      const a = nums(inp.s, "the stream", 1, 14);
      const lo = [], hi = [], meds = [], fr = [];
      const S = (x) => fr.push({ lo: [...lo], hi: [...hi], meds: [...meds], ...x });
      const fmtM = (m) => (Number.isInteger(m) ? String(m) : m.toFixed(1));
      S({ line: 0, note: "Invariant: every number in lo ≤ every number in hi, and lo has the same size as hi or one more. Then the median is lo's top (odd count) or the average of the two tops (even count). Only the tops are ever needed, and heaps give exactly the tops." });
      a.forEach((x) => {
        const toLo = !lo.length || x <= lo[0];
        if (toLo) hpush(lo, x, maxLess); else hpush(hi, x, minLess);
        S({ line: toLo ? 2 : 3, x, side: toLo ? "lo" : "hi", vars: { x, "|lo|": lo.length, "|hi|": hi.length }, note: toLo ? `${x} ≤ top of lo (${lo.length > 1 ? lo[0] : "lo was empty"}): it belongs to the smaller half. Push to lo.` : `${x} &gt; top of lo (${lo[0]}): it belongs to the larger half. Push to hi.` });
        if (lo.length > hi.length + 1) {
          const m = hpop(lo, maxLess); hpush(hi, m, minLess);
          S({ line: 4, x: m, side: "hi", vars: { moved: m, "|lo|": lo.length, "|hi|": hi.length }, note: `lo has ${lo.length + 1} vs ${hi.length - 1}: too big. Move its top ${m} (the largest of the small half) to hi. The order invariant still holds.` });
        } else if (hi.length > lo.length) {
          const m = hpop(hi, minLess); hpush(lo, m, maxLess);
          S({ line: 5, x: m, side: "lo", vars: { moved: m, "|lo|": lo.length, "|hi|": hi.length }, note: `hi is bigger than lo: move its top ${m} (the smallest of the large half) to lo.` });
        }
        const med = lo.length > hi.length ? lo[0] : (lo[0] + hi[0]) / 2;
        meds.push(fmtM(med));
        S({ line: lo.length > hi.length ? [6, 7] : [6, 8], med: true, vars: { median: fmtM(med) }, note: lo.length > hi.length ? `Odd count (${lo.length + hi.length}): median = top of lo = <b>${lo[0]}</b>.` : `Even count (${lo.length + hi.length}): median = (${lo[0]} + ${hi[0]}) / 2 = <b>${fmtM(med)}</b>.` });
      });
      S({ line: 6, note: `Medians after each number: [${meds.join(", ")}]. Each add is at most 3 heap operations, O(log n); median() reads two tops, O(1). Sorting after every insert would cost O(n) per add.` });
      return fr;
    },
    render: (f) => {
      const all = [...f.lo.map((v) => [v, "lo"]), ...f.hi.map((v) => [v, "hi"])].sort((p, q) => p[0] - q[0] || (p[1] === "lo" ? -1 : 1));
      const n = all.length, mids = new Set(n % 2 ? [(n - 1) / 2] : [n / 2 - 1, n / 2]);
      const cur = (side, h, i) => f.side === side && h[i] === f.x;
      return col(
        arrView(all.map((p) => p[0]), { cls: (i) => (f.med && mids.has(i) ? "active" : all[i][1] === "lo" ? "visit" : "done"), label: "everything seen, sorted (for reference only)" }),
        chips("median after each number", f.meds, (i) => (i === f.meds.length - 1 ? "done" : "")),
        Viz.row(
          heapTree(f.lo, { label: "lo: max-heap, smaller half", cls: (i) => (cur("lo", f.lo, i) || (f.med && i === 0) ? "active" : "visit"), sub: false, gap: 40 }),
          heapTree(f.hi, { label: "hi: min-heap, larger half", cls: (i) => (cur("hi", f.hi, i) || (f.med && i === 0 && f.hi.length === f.lo.length) ? "active" : "done"), sub: false, gap: 40 }),
        ),
      );
    },
  }));

  /* Timeline drawing for interval problems: lanes = rooms. */
  const timeline = (bars, lanes, now, lo, hi, laneName = "room") => {
    const W = 460, L = 62, R = 14, lane = 30, top = 24, H = top + Math.max(1, lanes) * lane + 30;
    const X = (t) => L + ((t - lo) / Math.max(1, hi - lo)) * (W - L - R);
    const step = Math.max(1, Math.ceil((hi - lo) / 8));
    let s = "";
    for (let r = 0; r < lanes; r++) {
      const y = top + r * lane;
      s += `<text class="hp-tl-lbl" x="6" y="${y + lane / 2}">${laneName} ${r + 1}</text><line class="hp-tl-lane" x1="${L}" y1="${y + lane - 2}" x2="${W - R}" y2="${y + lane - 2}"></line>`;
    }
    for (let t = lo; t <= hi; t += step) s += `<line class="hp-tl-tickl" x1="${X(t)}" y1="${H - 24}" x2="${X(t)}" y2="${H - 20}"></line><text class="hp-tl-tick" x="${X(t)}" y="${H - 8}">${t}</text>`;
    s += `<line class="hp-tl-axis" x1="${L}" y1="${H - 24}" x2="${W - R}" y2="${H - 24}"></line>`;
    bars.forEach((b) => {
      const y = top + b.lane * lane + 3, x1 = X(b.s), w = Math.max(4, X(b.e) - x1);
      s += `<rect class="hp-tl-bar ${b.cls || ""}" x="${x1}" y="${y}" width="${w}" height="${lane - 9}" rx="4"></rect>${w > 34 ? `<text class="hp-tl-txt" x="${x1 + w / 2}" y="${y + (lane - 9) / 2}">${b.s}–${b.e}</text>` : ""}`;
    });
    if (now !== null && now !== undefined) s += `<line class="hp-tl-now" x1="${X(now)}" y1="8" x2="${X(now)}" y2="${H - 24}"></line><text class="hp-tl-nowt" x="${X(now)}" y="8">t = ${now}</text>`;
    return `<svg class="hp-tl" viewBox="0 -6 ${W} ${H + 6}" width="${W}" height="${H + 6}" role="img" aria-label="timeline">${s}</svg>`;
  };
  const parseIntervals = (s, max = 10) => {
    const out = String(s).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
      const m = t.match(/^\[?\s*(\d+)\s*[-–\s]\s*(\d+)\s*\]?$/);
      if (!m || Number(m[1]) >= Number(m[2])) throw new Error("Use intervals like 0-30, 5-10 (start < end).");
      return [Number(m[1]), Number(m[2])];
    });
    if (!out.length || out.length > max || out.some(([a, b]) => b > 200)) throw new Error(`Use 1–${max} intervals with times from 0 to 200.`);
    return out;
  };

  /* 6 ─ Meeting Rooms II: a min-heap of end times. */
  Viz.register("heaps-priority-queues-rooms", (el) => Viz.player(el, {
    title: "Meeting rooms: sort by start; the heap's root is the room that frees up first, the only one worth checking",
    tag: "LC 253 · O(n log n)",
    legend: [["active", "meeting being placed"], ["done", "placed"], ["visit", "earliest-ending room"]],
    codeLang: "python",
    code: [
      "intervals.sort()                   # by start time",
      "ends = []                          # min-heap: end time of each busy room",
      "for s, e in intervals:",
      "    if ends and ends[0] <= s:      # earliest-ending room is free by s",
      "        heapq.heapreplace(ends, e) # reuse it",
      "    else:",
      "        heapq.heappush(ends, e)    # every room is busy: open one",
      "return len(ends)",
    ],
    inputs: [{ key: "iv", label: "meetings start-end (1–10)", value: "0-30, 5-10, 15-20, 10-25, 22-28, 30-35", width: 340 }],
    random: () => ({ iv: Array.from({ length: Viz.rand(5, 9) }, () => { const a = Viz.rand(0, 40); return `${a}-${a + Viz.rand(3, 15)}`; }).join(", ") }),
    build: (inp) => {
      const iv = parseIntervals(inp.iv).sort((p, q) => p[0] - q[0] || p[1] - q[1]);
      const lo = Math.min(...iv.map((p) => p[0])), hi = Math.max(...iv.map((p) => p[1]));
      const heap = [], placed = [], fr = [];
      let rooms = 0;
      const S = (x) => fr.push({ iv, heap: heap.map((e) => [...e]), placed: placed.map((b) => ({ ...b })), rooms, lo, hi, ...x });
      S({ line: [0, 1], now: null, note: `Sorted by start: ${iv.map((p) => `[${p[0]}, ${p[1]}]`).join(" ")}. Walk through them in time order. A busy room only matters for <i>when it frees up</i>, so keep a min-heap of end times; its root is the first room to free up.` });
      iv.forEach(([s, e], k) => {
        if (heap.length && heap[0][0] <= s) {
          const [end, room] = heap[0];
          S({ line: 3, now: s, k, check: true, vars: { s, e, "ends[0]": end }, note: `Meeting [${s}, ${e}): the earliest-ending room (room ${room + 1}) ends at ${end} ≤ ${s}. It is free: reuse it.` });
          heap[0] = [e, room]; siftDown(heap, 0);
          placed.push({ s, e, lane: room, cls: "active" });
          S({ line: 4, now: s, k, vars: { s, e, rooms }, note: `heapreplace: room ${room + 1}'s end time becomes ${e}. Still ${rooms} room${rooms > 1 ? "s" : ""}.` });
        } else {
          S({ line: heap.length ? 3 : 2, now: s, k, check: heap.length > 0, vars: { s, e, "ends[0]": heap.length ? heap[0][0] : "none" }, note: heap.length ? `Meeting [${s}, ${e}): even the earliest-ending room ends at ${heap[0][0]} &gt; ${s}, so <b>every</b> room is busy at time ${s}.` : `Meeting [${s}, ${e}): no rooms yet.` });
          hpush(heap, [e, rooms]); placed.push({ s, e, lane: rooms, cls: "active" }); rooms++;
          S({ line: 6, now: s, k, vars: { s, e, rooms }, note: `Open room ${rooms}. ${rooms} meetings overlap at time ${s}.` });
        }
        placed[placed.length - 1].cls = "done";
      });
      S({ line: 7, now: null, note: `Answer: <b>${rooms}</b> rooms = the most meetings running at the same moment. Each meeting costs one heap operation: O(n log n) with the sort. Ending at t and starting at t do not overlap here (≤); flip it to &lt; if the problem says they do.` });
      return fr;
    },
    render: (f) => {
      const bars = f.placed.map((b, i) => ({ ...b, cls: i === f.placed.length - 1 && f.k !== undefined && f.k === i ? "active" : "done" }));
      const lanes = Math.max(1, f.rooms);
      return Viz.row(
        col(
          Viz.labeled("rooms over time", timeline(bars, lanes, f.now, f.lo, f.hi)),
          chips("meetings, sorted by start", f.iv.map((p) => `${p[0]}–${p[1]}`), (i) => (i === f.k ? "active" : f.k !== undefined && i < f.k ? "done" : f.k === undefined && f.placed.length > i ? "done" : "")),
        ),
        heapTree(f.heap, { label: "min-heap of end times", fmt: (e) => e[0], sub: (e) => `room ${e[1] + 1}`, cls: (i) => (i === 0 && f.check ? "visit" : "") }),
      );
    },
  }));

  /* 7 ─ Task Scheduler: max-heap by remaining count + a cooldown queue. */
  Viz.register("heaps-priority-queues-tasks", (el) => Viz.player(el, {
    title: "Task scheduler: always run the most-remaining task that is not cooling down; cooling tasks wait in a FIFO queue",
    tag: "LC 621 · O(T log 26)",
    legend: [["active", "runs this tick"], ["done", "earlier ticks"], ["dim", "idle tick"], ["visit", "ready (in the heap)"]],
    codeLang: "python",
    code: [
      "heap = [(-c, t) for t, c in Counter(tasks).items()]",
      "heapq.heapify(heap)            # most remaining on top",
      "cool = deque()                 # (ready_time, -c, t), FIFO",
      "time = 0",
      "while heap or cool:",
      "    time += 1",
      "    if heap:",
      "        c, t = heapq.heappop(heap)",
      "        if c + 1: cool.append((time + n, c + 1, t))",
      "    # else: nothing is ready, the CPU idles",
      "    if cool and cool[0][0] == time:",
      "        heapq.heappush(heap, cool.popleft()[1:])",
      "return time",
    ],
    inputs: [
      { key: "tasks", label: "tasks (letters A–Z, 1–14)", value: "AAAABBC", width: 180 },
      { key: "n", label: "cooldown n (0–4)", value: "2", width: 70 },
    ],
    random: () => ({ tasks: Array.from({ length: Viz.rand(5, 11) }, () => "ABCDE"[Math.min(Viz.rand(0, 4), Viz.rand(0, 4))]).join(""), n: String(Viz.rand(1, 3)) }),
    build: (inp) => {
      const tasks = String(inp.tasks).replace(/[\s,]+/g, "").toUpperCase();
      if (!/^[A-Z]{1,14}$/.test(tasks)) throw new Error("Use 1–14 task letters A–Z, like AAABBC.");
      const n = Viz.parse.int(inp.n, { min: 0, max: 4 });
      const cnt = {};
      for (const t of tasks) cnt[t] = (cnt[t] || 0) + 1;
      const heap = Object.entries(cnt).map(([t, c]) => [-c, t]);
      for (let i = (heap.length >> 1) - 1; i >= 0; i--) siftDown(heap, i);
      const cool = [], slots = [], fr = [];
      let time = 0;
      const S = (x) => fr.push({ heap: heap.map((e) => [...e]), cool: cool.map((e) => [...e]), slots: [...slots], n, ...x });
      S({ line: [0, 1, 2, 3], note: `Counts: ${Object.entries(cnt).map(([t, c]) => `${t}×${c}`).join(", ")}. Greedy rule: at every tick run the ready task with the most copies left. The task with the most work left is the one most likely to force idle ticks later, so it should never wait when it could run.` });
      while (heap.length || cool.length) {
        time++;
        let ran = null, back = null;
        if (heap.length) {
          const [c, t] = hpop(heap);
          ran = t; slots.push(t);
          if (c + 1) cool.push([time + n, c + 1, t]);
        } else slots.push("idle");
        if (cool.length && cool[0][0] === time) { const [, c, t] = cool.shift(); hpush(heap, [c, t]); back = t; }
        S({ line: ran ? (back ? [5, 7, 8, 10, 11] : [5, 7, 8]) : back ? [5, 9, 10, 11] : [5, 9], time, ran, back, vars: { time, ran: ran || "idle", ready: heap.length, cooling: cool.length },
          note: (ran ? `t = ${time}: run <b>${ran}</b> (the most copies left among ready tasks)${cool.some((e) => e[2] === ran) ? `; it cools down until t = ${cool.find((e) => e[2] === ran)[0]}` : "; that was its last copy"}.` : `t = ${time}: nothing is ready (every remaining task is cooling down), so the CPU <b>idles</b>.`) +
            (back ? ` ${back} finished its cooldown and goes back into the heap.` : "") });
      }
      const maxc = Math.max(...Object.values(cnt)), top = Object.values(cnt).filter((c) => c === maxc).length;
      const formula = (maxc - 1) * (n + 1) + top;
      S({ line: 12, time, vars: { time }, note: `Total ${time} ticks (${slots.filter((s) => s === "idle").length} idle). Shortcut formula: max(len(tasks), (maxCount − 1)·(n + 1) + #tasks with maxCount) = max(${tasks.length}, ${maxc - 1}·${n + 1} + ${top}) = ${Math.max(tasks.length, formula)}. The heap version also produces the actual schedule.` });
      return fr;
    },
    render: (f) => Viz.row(
      col(
        arrView(f.slots.map((s) => (s === "idle" ? "·" : s)), { cls: (i) => (f.slots[i] === "idle" ? "dim" : i === f.slots.length - 1 && f.ran ? "active" : "done"), label: "schedule (one cell per tick, · = idle)", showIdx: false }),
        chips(`cooling down (front first), n = ${f.n}`, f.cool.map((e) => `${e[2]}×${-e[1]} ready@${e[0]}`), (i) => (i === 0 ? "visit" : ""), "empty"),
      ),
      heapTree(f.heap, { label: "max-heap of ready tasks", fmt: (e) => e[1], sub: (e) => `×${-e[0]}`, cls: (i) => (f.back && f.heap[i][1] === f.back ? "path" : "visit"), r: 19 }),
    ),
  }));

  /* 8 ─ IPO: unlock by capital (sorted pointer), choose by profit (max-heap). */
  Viz.register("heaps-priority-queues-ipo", (el) => Viz.player(el, {
    title: "IPO: a sorted pointer unlocks every project you can afford; a max-heap picks the most profitable unlocked one",
    tag: "LC 502 · O(n log n)",
    legend: [["dim", "locked (costs more than w)"], ["visit", "unlocked, waiting in the heap"], ["active", "chosen now"], ["done", "finished"]],
    codeLang: "python",
    code: [
      "projects = sorted(zip(capital, profits))",
      "avail, i = [], 0               # max-heap of profits (negated)",
      "for _ in range(k):",
      "    while i < len(projects) and projects[i][0] <= w:",
      "        heapq.heappush(avail, -projects[i][1]); i += 1",
      "    if not avail: break        # nothing affordable, ever",
      "    w -= heapq.heappop(avail)  # take the best profit",
      "return w",
    ],
    inputs: [
      { key: "p", label: "projects capital:profit (1–8)", value: "0:1, 1:2, 1:3, 2:5, 4:2, 6:4", width: 280 },
      { key: "k", label: "k", value: "3", width: 50 },
      { key: "w", label: "w", value: "0", width: 50 },
    ],
    random: () => { const n = Viz.rand(4, 7); return { p: Array.from({ length: n }, () => `${Viz.rand(0, 8)}:${Viz.rand(1, 6)}`).join(", "), k: String(Viz.rand(2, n)), w: String(Viz.rand(0, 2)) }; },
    build: (inp) => {
      const pr = String(inp.p).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^(\d+)\s*:\s*(\d+)$/);
        if (!m || +m[1] > 50 || +m[2] > 50) throw new Error("Use projects like 0:1, 1:3 (capital:profit, 0–50).");
        return [+m[1], +m[2]];
      });
      if (!pr.length || pr.length > 8) throw new Error("Use 1–8 projects.");
      const k = Viz.parse.int(inp.k, { min: 1, max: pr.length });
      let w = Viz.parse.int(inp.w, { min: 0, max: 50 });
      const P = pr.map((p, id) => [...p, id]).sort((a, b) => a[0] - b[0] || a[2] - b[2]);
      const avail = [], st = P.map(() => "dim"), fr = [];
      let i = 0;
      const S = (x) => fr.push({ P, avail: avail.map((e) => [...e]), st: [...st], w, i, ...x });
      S({ line: [0, 1], vars: { w, k }, note: `Sort projects by required capital. Capital only grows, so once a project is affordable it stays affordable: a single pointer i sweeps left to right and never goes back. Start with w = ${w}.` });
      for (let r = 0; r < k; r++) {
        const before = i;
        while (i < P.length && P[i][0] <= w) { hpush(avail, [P[i][1], P[i][2]], maxLess); st[i] = "visit"; i++; }
        S({ line: [3, 4], vars: { round: r + 1, w, i, unlocked: i - before }, note: i > before ? `Round ${r + 1}: with w = ${w}, unlock ${i - before} more project${i - before > 1 ? "s" : ""} (capital ≤ ${w}) into the profit max-heap.` : `Round ${r + 1}: nothing new is affordable at w = ${w}.` });
        if (!avail.length) { S({ line: 5, vars: { w }, note: `The heap is empty: no project is affordable now, and w cannot grow without one. Stop early with w = ${w}.` }); break; }
        const [p, id] = hpop(avail, maxLess);
        const pos = P.findIndex((q) => q[2] === id);
        w += p; st[pos] = "active";
        S({ line: 6, pick: pos, vars: { round: r + 1, profit: p, w }, note: `Take the most profitable unlocked project (#${id}, profit ${p}). Any other choice adds less now and unlocks no more later, so greedy is safe. w = ${w}.` });
        st[pos] = "done";
      }
      S({ line: 7, vars: { w }, note: `Final capital <b>${w}</b>. Each project enters and leaves the heap at most once: O(n log n) including the sort.` });
      return fr;
    },
    render: (f) => Viz.row(
      col(
        Viz.grid([f.P.map((p) => p[0]), f.P.map((p) => p[1])], { rowLabels: ["capital", "profit"], colLabels: f.P.map((p) => `#${p[2]}`), cls: (r, c) => f.st[c], label: "projects, sorted by capital" }),
        badge(`w = <b>${f.w}</b> · pointer i = ${f.i}`, "visit"),
      ),
      heapTree(f.avail, { label: "max-heap of unlocked profits", fmt: (e) => e[0], sub: (e) => `#${e[1]}`, cls: () => "visit" }),
    ),
  }));

  /* 9 ─ Lazy deletion: sliding-window maximum with a heap. */
  Viz.register("heaps-priority-queues-lazy", (el) => Viz.player(el, {
    title: "Lazy deletion: don't search the heap for expired entries; discard them only when they reach the top",
    tag: "LC 239 · O(n log n)",
    legend: [["active", "current index"], ["visit", "window"], ["bad", "stale (left the window)"], ["done", "window max"]],
    codeLang: "python",
    code: [
      "heap, out = [], []",
      "for i, x in enumerate(nums):",
      "    heapq.heappush(heap, (-x, i))     # max-heap by value",
      "    while heap[0][1] <= i - k:        # top already left the window?",
      "        heapq.heappop(heap)           # now it is cheap to drop",
      "    if i >= k - 1:",
      "        out.append(-heap[0][0])",
      "return out",
    ],
    inputs: [
      { key: "a", label: "nums (2–14)", value: "1, 3, -1, -3, 5, 3, 6, 7, 2, 1", width: 260 },
      { key: "k", label: "k", value: "3", width: 50 },
    ],
    random: () => ({ a: Array.from({ length: Viz.rand(8, 12) }, () => Viz.rand(-5, 9)).join(", "), k: String(Viz.rand(2, 4)) }),
    build: (inp) => {
      const a = nums(inp.a, "nums", 2, 14);
      const k = Viz.parse.int(inp.k, { min: 1, max: a.length });
      const heap = [], out = [], fr = [];
      const S = (x) => fr.push({ a, k, heap: heap.map((e) => [...e]), out: [...out], ...x });
      S({ line: 0, i: -1, note: `Window size k = ${k}. A heap cannot delete an arbitrary element cheaply (it would have to find it first: O(n)). Trick: leave expired elements inside and only throw one away when it surfaces at the top, where removing it is just a pop.` });
      a.forEach((x, i) => {
        hpush(heap, [-x, i]);
        S({ line: 2, i, vars: { i, x, "heap size": heap.length }, note: `Push (${-x}, ${i}) for x = ${x}.` + (i - k >= 0 ? ` The heap may still contain entries with index ≤ ${i - k} (shown red): they are out of the window but harmless while buried.` : ` The window is still filling up, so nothing can be stale yet.`) });
        while (heap[0][1] <= i - k) {
          const top = heap[0];
          S({ line: 3, i, stale: top[1], vars: { i, "top idx": top[1], "i − k": i - k }, note: `Top is ${-top[0]} from index ${top[1]} ≤ i − k = ${i - k}: it left the window, so it cannot be the answer. Pop it.` });
          hpop(heap);
          S({ line: 4, i, vars: { i, "heap size": heap.length }, note: `Popped. Check the new top.` });
        }
        if (i >= k - 1) {
          out.push(-heap[0][0]);
          S({ line: [5, 6], i, rec: true, vars: { i, max: -heap[0][0] }, note: `The top (index ${heap[0][1]}) is inside window [${i - k + 1}, ${i}]: max = <b>${-heap[0][0]}</b>.${heap.some((e) => e[1] <= i - k) ? ` Note the red stale entries still buried in the heap; nobody cares until they reach the top.` : ""}` });
        }
      });
      S({ line: 7, i: -1, note: `Maxima: [${out.join(", ")}]. Every element is pushed once and popped at most once: O(n log n). The monotonic deque solves this one in O(n), but lazy deletion works for <i>any</i> heap problem with removals: sliding window median, Dijkstra, scheduling with cancellations.` });
      return fr;
    },
    render: (f) => {
      const lo = f.i - f.k + 1;
      const stale = (e) => f.i >= 0 && e[1] < lo;
      return Viz.row(
        col(
          Viz.array(f.a, { cls: (j) => (j === f.i ? "active" : f.i >= 0 && j >= lo && j <= f.i ? "visit" : f.i >= 0 && j < lo && f.heap.some((e) => e[1] === j) ? "bad" : ""), ptrsTop: f.i >= 0 ? { i: f.i } : {}, label: "nums" }),
          chips("window maxima", f.out, (j) => (j === f.out.length - 1 && f.rec ? "done" : "")),
        ),
        heapTree(f.heap, { label: "max-heap of (value, index)", fmt: (e) => -e[0], sub: (e) => `i${e[1]}`, cls: (j) => (f.rec && j === 0 ? "done" : stale(f.heap[j]) ? "bad" : f.heap[j][1] === f.i ? "active" : "") }),
      );
    },
  }));

  /* 10 ─ Dijkstra preview: a heap of tentative distances with lazy deletion. */
  Viz.register("heaps-priority-queues-dijkstra", (el) => Viz.player(el, {
    title: "Dijkstra in one picture: pop the closest unsettled node; outdated heap entries are skipped, not removed",
    tag: "PREVIEW · O((V + E) log E)",
    legend: [["done", "settled (final distance)"], ["active", "just popped"], ["visit", "distance just improved"], ["bad", "stale heap entry"]],
    codeLang: "python",
    code: [
      "dist = {src: 0}",
      "heap = [(0, src)]",
      "while heap:",
      "    d, u = heapq.heappop(heap)",
      "    if d > dist[u]: continue       # stale: u was improved later",
      "    for v, w in adj[u]:",
      "        if d + w < dist.get(v, inf):",
      "            dist[v] = d + w",
      "            heapq.heappush(heap, (d + w, v))  # no decrease-key",
      "return dist",
    ],
    inputs: [
      { key: "e", label: "undirected edges u-v weight (≤ 12)", value: "A-B 4, A-C 1, C-B 2, B-D 1, C-D 5, D-E 3, B-E 6", width: 340 },
      { key: "s", label: "source", value: "A", width: 60 },
    ],
    random: () => {
      const V = "ABCDEF".slice(0, Viz.rand(4, 6)).split(""), E = new Set(), out = [];
      for (let i = 1; i < V.length; i++) { const j = Viz.rand(0, i - 1); E.add(`${V[j]}-${V[i]}`); out.push(`${V[j]}-${V[i]} ${Viz.rand(1, 9)}`); }
      for (let t = 0; t < 3; t++) { const a = Viz.rand(0, V.length - 1), b = Viz.rand(0, V.length - 1); if (a !== b && !E.has(`${V[a]}-${V[b]}`) && !E.has(`${V[b]}-${V[a]}`)) { E.add(`${V[a]}-${V[b]}`); out.push(`${V[a]}-${V[b]} ${Viz.rand(1, 9)}`); } }
      return { e: out.join(", "), s: "A" };
    },
    build: (inp) => {
      const edges = String(inp.e).split(/[,;]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^([A-Za-z0-9])\s*-\s*([A-Za-z0-9])\s+(\d+)$/);
        if (!m || m[1] === m[2] || +m[3] > 50) throw new Error("Use edges like A-B 4 (one-character names, weight 0–50, no self-loops).");
        return [m[1].toUpperCase(), m[2].toUpperCase(), +m[3]];
      });
      if (!edges.length || edges.length > 12) throw new Error("Use 1–12 edges.");
      const V = [...new Set(edges.flatMap((e) => [e[0], e[1]]))].sort();
      if (V.length > 8) throw new Error("At most 8 nodes.");
      const src = String(inp.s).trim().toUpperCase();
      if (!V.includes(src)) throw new Error("Enter a source that appears in the edges.");
      const adj = Object.fromEntries(V.map((v) => [v, []]));
      edges.forEach(([u, v, w]) => { adj[u].push([v, w]); adj[v].push([u, w]); });
      const dist = { [src]: 0 }, done = new Set(), heap = [[0, src]], fr = [];
      const S = (x) => fr.push({ V, edges, dist: { ...dist }, done: new Set(done), heap: heap.map((e) => [...e]), ...x });
      S({ line: [0, 1], vars: { src }, note: `Start: dist[${src}] = 0, every other node ∞. The heap holds (tentative distance, node) pairs; its top is the closest node we have not settled yet.` });
      while (heap.length) {
        const [d, u] = hpop(heap);
        if (d > dist[u]) { S({ line: [3, 4], u, stale: true, vars: { d, u, "dist[u]": dist[u] }, note: `Pop (${d}, ${u}) but dist[${u}] is already ${dist[u]} &lt; ${d}: this is an outdated copy left behind when ${u} improved. Skip it. Pushing duplicates and skipping stale ones replaces the decrease-key operation heapq and PriorityQueue don't have.` }); continue; }
        done.add(u);
        S({ line: [3, 4], u, vars: { d, u }, note: `Pop (${d}, ${u}): the smallest tentative distance in the heap. Every other path to ${u} would go through a node at distance ≥ ${d} and only add non-negative weights, so ${d} is final. ${u} is settled.` });
        for (const [v, w] of adj[u]) {
          const old = dist[v] ?? Infinity;
          if (d + w < old) {
            dist[v] = d + w; hpush(heap, [d + w, v]);
            S({ line: [6, 7, 8], u, v, edge: [u, v], vars: { u, v, "d + w": d + w, was: old === Infinity ? "∞" : old }, note: `Relax ${u}→${v}: ${d} + ${w} = ${d + w} &lt; ${old === Infinity ? "∞" : old}. Record it and push (${d + w}, ${v}).${old !== Infinity ? ` The old entry (${old}, ${v}) stays in the heap and is now stale.` : ""}` });
          }
        }
      }
      S({ line: 9, note: `Final distances: ${V.map((v) => `${v} = ${dist[v] ?? "∞"}`).join(", ")}. Each edge can push one entry, so the heap holds O(E) entries: O((V + E) log E). The full treatment, with negative weights and variants, is in Shortest Paths.` });
      return fr;
    },
    render: (f) => {
      const pos = Viz.layout.circle(f.V, f.V.length <= 4 ? 85 : 110);
      const nodes = pos.map((p) => ({ ...p, sub: f.dist[p.id] === undefined ? "∞" : f.dist[p.id] }));
      const ek = (a, b) => (f.edge && ((f.edge[0] === a && f.edge[1] === b) || (f.edge[0] === b && f.edge[1] === a)) ? "active" : "");
      return Viz.row(
        Viz.graph({ nodes, edges: f.edges.map(([u, v, w]) => ({ u, v, w, cls: ek(u, v) })) }, { r: 18, label: "graph (dist under each node)", nodeCls: (id) => (id === f.u && !f.stale ? "active" : id === f.v ? "visit" : f.done.has(id) ? "done" : "") }),
        col(
          arrView(f.heap.map((e) => `${e[0]},${e[1]}`), { cls: (i) => (f.heap[i][0] > f.dist[f.heap[i][1]] ? "bad" : i === 0 ? "visit" : ""), label: "heap array of (d, node)" }),
          f.stale ? badge(`skipped stale entry for ${esc(f.u)}`, "bad") : "",
        ),
      );
    },
  }));
})();
