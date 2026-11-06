/* Linked Lists visualizers. Every frame comes from running the real pointer algorithm on a small heap model:
 * nodes [{id, val, slot, row}] plus next / prev / rand maps (id -> id | null). Arrows are drawn from those maps,
 * so what you see is exactly the pointer state the code has produced. */
(() => {
  const esc = Viz.esc;

  /* ---------- heap model ---------- */
  const mkList = (vals, o = {}) => {
    const p = o.prefix || "n";
    const nodes = vals.map((v, i) => ({ id: p + i, val: v, slot: (o.slot0 || 0) + i * (o.step || 1), row: o.row || 0 }));
    const next = {};
    nodes.forEach((n, i) => { next[n.id] = i + 1 < nodes.length ? nodes[i + 1].id : null; });
    return { nodes, next, prev: null, rand: null };
  };
  const nodeOf = (st, id) => st.nodes.find((n) => n.id === id);
  const valOf = (st, id) => (id === null || id === undefined ? "null" : nodeOf(st, id).val);
  const walk = (st, start, limit = 60) => {
    const out = [], seen = new Set();
    let c = start;
    while (c !== null && c !== undefined && !seen.has(c) && out.length < limit) { seen.add(c); out.push(c); c = st.next[c]; }
    return out;
  };
  const vals = (st, start) => walk(st, start).map((id) => valOf(st, id));
  /* Re-draw nodes in list order (slot = position). Unreachable nodes drop to row 1, or are removed when drop is set. */
  const relayout = (st, start, drop = false) => {
    const order = walk(st, start), set = new Set(order);
    order.forEach((id, i) => { const n = nodeOf(st, id); n.slot = i; n.row = 0; });
    if (drop) st.nodes = st.nodes.filter((n) => set.has(n.id));
    else st.nodes.filter((n) => !set.has(n.id)).forEach((n) => { n.row = 1; });
  };
  const snapOf = (st) => ({ nodes: st.nodes.map((n) => ({ ...n })), next: { ...st.next }, prev: st.prev ? { ...st.prev } : null, rand: st.rand ? { ...st.rand } : null });
  const listStr = (a) => (a.length ? a.join(" → ") + " → null" : "null");
  const parseList = (s, min, max) => Viz.parse.ints(s, { min, max }).map((v) => {
    if (!Number.isInteger(v) || Math.abs(v) > 999) throw new Error("Use whole numbers between -999 and 999.");
    return v;
  });

  /* ---------- renderer: boxes with a next field (and a prev field for doubly linked lists) ---------- */
  function llSvg(f, o = {}) {
    const NW0 = o.nw || 56, FW = 16, NH = 34, SX = o.sx || 86, SY = o.sy || 104;
    const dbl = !!f.prev, nw = dbl ? NW0 + FW : NW0;
    const ptrs = f.ptrs || {}, ncls = f.ncls || {}, ecls = f.ecls || {}, pecls = f.pecls || {};
    const nodes = f.nodes, by = new Map(nodes.map((n) => [n.id, n]));
    const nullNames = Object.entries(ptrs).filter(([, v]) => v === null);
    const slots = nodes.map((n) => n.slot);
    const minS = slots.length ? Math.min(...slots) : 0, maxS = slots.length ? Math.max(...slots) : -1;
    const nullBox = nullNames.length || !nodes.length ? (o.nullAt === "right" ? { slot: maxS + 1, row: o.nullRow || 0 } : { slot: minS - 1, row: o.nullRow || 0 }) : null;
    const X = (n) => n.slot * SX, Y = (n) => (n.row || 0) * SY;
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    const ext = (x, y) => { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); };
    const edges = [], body = [], labels = [];
    const draw = (d, ex, ey, tx, ty, cls) => {
      const L = Math.hypot(ex - tx, ey - ty) || 1, ux = (ex - tx) / L, uy = (ey - ty) / L;
      edges.push(`<path class="ll-e ${cls}" d="${d}"/><polygon class="ll-ah ${cls}" points="${ex},${ey} ${ex - ux * 10 - uy * 5},${ey - uy * 10 + ux * 5} ${ex - ux * 10 + uy * 5},${ey - uy * 10 - ux * 5}"/>`);
    };
    const top = (n) => (n.row || 0) < 0.75;
    const link = (a, b, kind, cls) => {
      const ax = X(a), ay = Y(a), bx = X(b), by_ = Y(b);
      const off = dbl ? (kind === "prev" ? 7 : -7) : 0;
      const ds = b.slot - a.slot, same = Math.abs((a.row || 0) - (b.row || 0)) < 1e-9;
      const sx = kind === "prev" ? ax + FW / 2 : ax + nw - FW / 2;
      if (a === b) {
        const up = top(a), k = up ? -1 : 1, sy = up ? ay : ay + NH, ex = ax + nw / 2 - 8;
        ext(sx + 10, sy + k * 40);
        return draw(`M${sx},${sy} C${sx + 18},${sy + k * 48} ${ex - 26},${sy + k * 48} ${ex},${sy}`, ex, sy, ex - 26, sy + k * 48, cls);
      }
      if (same) {
        const cy = ay + NH / 2 + off;
        if (kind !== "prev" && ds > 0 && ds <= 1.01) return draw(`M${sx},${cy} L${bx - 1},${cy}`, bx - 1, cy, sx, cy, cls);
        if (kind === "prev" && ds < 0 && ds >= -1.01) return draw(`M${sx},${cy} L${bx + nw + 1},${cy}`, bx + nw + 1, cy, sx, cy, cls);
        const forward = ds > 0, above = top(a) ? forward : !forward;
        const h = 20 + 8 * Math.min(Math.abs(ds), 7);
        const sy = above ? ay : ay + NH, ex = bx + nw / 2 + (forward ? -6 : 6), ey = above ? by_ : by_ + NH;
        const cx = (sx + ex) / 2, cyy = above ? sy - 2 * h : sy + 2 * h;
        ext(cx, above ? sy - h : sy + h);
        return draw(`M${sx},${sy} Q${cx},${cyy} ${ex},${ey}`, ex, ey, cx, cyy, cls);
      }
      const down = (b.row || 0) > (a.row || 0), sy = down ? ay + NH : ay;
      const tcx = bx + nw / 2, tcy = by_ + NH / 2, dx = sx - tcx, dy = sy - tcy;
      const t = Math.min(dx ? (nw / 2 + 2) / Math.abs(dx) : Infinity, dy ? (NH / 2 + 2) / Math.abs(dy) : Infinity);
      return draw(`M${sx},${sy} L${tcx + dx * t},${tcy + dy * t}`, tcx + dx * t, tcy + dy * t, sx, sy, cls);
    };
    const rlink = (a, b, cls) => {
      const up = top(a), k = up ? -1 : 1, ay = Y(a), sy = up ? ay : ay + NH;
      const sx = X(a) + nw / 2 + 4, ex = X(b) + nw / 2 - 4, ey = up ? Y(b) : Y(b) + NH;
      if (a === b) {
        ext(sx, sy + k * 38);
        return draw(`M${sx},${sy} C${sx + 16},${sy + k * 44} ${sx - 24},${sy + k * 44} ${sx - 10},${sy}`, sx - 10, sy, sx - 24, sy + k * 44, cls);
      }
      const h = 16 + 9 * Math.min(Math.abs(b.slot - a.slot), 6), cx = (sx + ex) / 2, cyy = sy + k * 2 * h;
      ext(cx, sy + k * h);
      return draw(`M${sx},${sy} Q${cx},${cyy} ${ex},${ey}`, ex, ey, cx, cyy, cls);
    };
    for (const n of nodes) {
      const t = f.next[n.id];
      if (t !== null && t !== undefined && by.has(t)) link(n, by.get(t), "next", ecls[n.id] || "");
      if (dbl) { const p = f.prev[n.id]; if (p !== null && p !== undefined && by.has(p)) link(n, by.get(p), "prev", pecls[n.id] || "prv"); }
      if (f.rand) { const r = f.rand[n.id]; if (r !== null && r !== undefined && by.has(r)) rlink(n, by.get(r), (f.rcls && f.rcls[n.id]) || "rand"); }
    }
    for (const [a, b] of f.ghost || []) if (by.has(a) && by.has(b)) link(by.get(a), by.get(b), "next", "ghost");
    const slash = (fx, y) => `<line class="ll-null" x1="${fx + 3}" y1="${y + NH - 5}" x2="${fx + FW - 3}" y2="${y + 5}"/>`;
    for (const n of nodes) {
      const x = X(n), y = Y(n), c = ncls[n.id] || n.cls || "";
      ext(x, y); ext(x + nw, y + NH);
      body.push(`<g class="ll-node ${c}"><rect x="${x}" y="${y}" width="${nw}" height="${NH}" rx="7"/>${dbl ? `<line x1="${x + FW}" y1="${y}" x2="${x + FW}" y2="${y + NH}"/>` : ""}<line x1="${x + nw - FW}" y1="${y}" x2="${x + nw - FW}" y2="${y + NH}"/><text x="${x + (dbl ? FW : 0) + (NW0 - FW) / 2}" y="${y + NH / 2}">${esc(n.val)}</text>${f.next[n.id] === null ? slash(x + nw - FW, y) : ""}${dbl && f.prev[n.id] === null ? slash(x, y) : ""}</g>`);
      const sub = o.sub ? o.sub(n, f) : f.sub && f.sub[n.id];
      if (sub !== undefined && sub !== null && sub !== "") { labels.push(`<text class="ll-sub" x="${x + nw / 2}" y="${y + NH + 14}">${esc(sub)}</text>`); ext(x, y + NH + 18); }
    }
    if (nullBox) {
      const x = X(nullBox), y = Y(nullBox);
      body.push(`<g class="ll-nullbox"><rect x="${x + (nw - NW0) / 2}" y="${y}" width="${NW0}" height="${NH}" rx="7"/><text x="${x + nw / 2}" y="${y + NH / 2}">null</text></g>`);
      ext(x, y); ext(x + nw, y + NH);
    }
    const at = new Map();
    for (const [k, v] of Object.entries(ptrs)) if (v !== undefined) { const key = v === null ? "∅" : v; if (!at.has(key)) at.set(key, []); at.get(key).push(k); }
    const pc = o.ptrCls || {};
    for (const [id, names] of at) {
      const n = id === "∅" ? nullBox : by.get(id);
      if (!n) continue;
      const x = X(n) + nw / 2, y = Y(n) - 8, txt = names.join(",");
      labels.push(`<text class="ll-pl" x="${x}" y="${y}">${names.map((nm) => `<tspan class="${pc[nm] || ""}">${esc(nm)}</tspan>`).join(",")}↓</text>`);
      ext(x - txt.length * 4 - 6, y - 14); ext(x + txt.length * 4 + 6, y);
    }
    if (f.span) {
      const a = by.get(f.span.a), b = f.span.b === null ? nullBox : by.get(f.span.b);
      if (a && b) {
        const y = Math.max(Y(a), Y(b)) + NH + 22, xa = X(a) + nw / 2, xb = X(b) + nw / 2;
        labels.push(`<g class="ll-span"><path d="M${xa},${y - 6} L${xa},${y} L${xb},${y} L${xb},${y - 6}"/><text x="${(xa + xb) / 2}" y="${y + 14}">${esc(f.span.text)}</text></g>`);
        ext(xa, y + 18);
      }
    }
    if (!isFinite(x0)) { x0 = 0; x1 = 100; y0 = 0; y1 = 40; }
    const P = 8, w = x1 - x0 + 2 * P, h = y1 - y0 + 2 * P;
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="ll-svg" viewBox="${x0 - P} ${y0 - P} ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(o.label || "linked list")}">${edges.join("")}${body.join("")}${labels.join("")}</svg></div>`;
  }
  const chips = (label, items, cls = "") => Viz.labeled(label, `<div class="ll-chips">${items.length ? items.map((t) => `<span class="v-item ${cls}">${esc(t)}</span>`).join("") : '<span class="ll-empty">none yet</span>'}</div>`);
  const PTRC = { prev: "p-done", curr: "p-active", nxt: "p-visit", head: "p-path", dummy: "p-path", fast: "p-visit", slow: "p-active", tail: "p-done", pre: "p-done", move: "p-active", kth: "p-visit", gp: "p-path", pa: "p-active", pb: "p-visit", p: "p-done", node: "p-active", victim: "p-bad" };

  /* 1 ─ Insert / delete with a dummy head, and the wrong-order bug. data-opts {"op": "insert" | "insertBug" | "delete" | "removeAll"} */
  const SURG = {
    insert: ["dummy = ListNode(0, head)", "prev = dummy", "for _ in range(k):", "    prev = prev.next", "node = ListNode(x)", "node.next = prev.next   # 1) hook the rest first", "prev.next = node        # 2) then splice in", "return dummy.next"],
    insertBug: ["dummy = ListNode(0, head)", "prev = dummy", "for _ in range(k):", "    prev = prev.next", "node = ListNode(x)", "prev.next = node        # BUG: splice first...", "node.next = prev.next   # ...reads the new link", "return dummy.next"],
    delete: ["dummy = ListNode(0, head)", "prev = dummy", "for _ in range(k):", "    prev = prev.next", "victim = prev.next", "prev.next = victim.next  # bypass it", "return dummy.next"],
    removeAll: ["dummy = ListNode(0, head)", "prev = dummy", "while prev.next:", "    if prev.next.val == x:", "        prev.next = prev.next.next  # stay put", "    else:", "        prev = prev.next", "return dummy.next"],
  };
  Viz.register("linked-lists-surgery", (el, opts) => {
    const op = SURG[opts.op] ? opts.op : "insert";
    const isIns = op === "insert" || op === "insertBug";
    const inputs = [{ key: "list", label: "list (0–7 values)", value: op === "removeAll" ? "6,1,6,6,3,6" : "3,7,9,12" }];
    if (op !== "removeAll") inputs.push({ key: "k", label: isIns ? "index k (0..n)" : "index k (0..n-1)", value: isIns ? "2" : "1", width: 60 });
    if (op !== "delete") inputs.push({ key: "x", label: isIns ? "new value x" : "remove value x", value: isIns ? "5" : "6", width: 60 });
    return Viz.player(el, {
      title: { insert: "Insert at index k: hook the rest first, then splice", insertBug: "The wrong order: splice first and the rest of the list is lost", delete: "Delete at index k: one pointer bypasses the victim", removeAll: "Remove every node equal to x: advance only when you keep" }[op],
      tag: op === "insertBug" ? "WATCH THE BUG" : "POINTER SURGERY",
      legend: [["path", "dummy (sentinel)"], ["active", "node being changed"], ["bad", "removed / lost"], ["done", "result"]],
      codeLang: "python", code: SURG[op], inputs,
      random: () => {
        const n = Viz.rand(op === "delete" ? 1 : 0, 6), a = Viz.randInts(n, 1, 9);
        if (op === "removeAll") return { list: a.join(","), x: String(a.length ? a[Viz.rand(0, a.length - 1)] : 1) };
        return op === "delete" ? { list: a.join(","), k: String(Viz.rand(0, n - 1)) } : { list: a.join(","), k: String(Viz.rand(0, n)), x: String(Viz.rand(10, 99)) };
      },
      build: (inp) => {
        const a = parseList(inp.list, op === "delete" ? 1 : 0, 7);
        const st = mkList(a), fr = [], headId = a.length ? "n0" : null;
        const S = (x) => fr.push({ ...snapOf(st), ...x });
        S({ ptrs: { head: headId }, line: [], note: `The list is <b>${listStr(a)}</b>. Each box is a node: value on the left, <i>next</i> field on the right (a slash means null).` });
        st.nodes.unshift({ id: "d", val: "D", slot: -1, row: 0 });
        st.next.d = headId;
        const base = { d: "path" };
        S({ ptrs: { dummy: "d", head: headId }, ncls: base, line: 0, note: "A <b>dummy</b> node is placed before the head. Now every real node, including the head, has a predecessor, so the head is no longer a special case." });
        let prev = "d";
        if (op === "removeAll") {
          const x = Viz.parse.int(inp.x, { min: -999, max: 999 });
          S({ ptrs: { prev }, ncls: base, line: 1, vars: { x }, note: "prev sits on the last node we have decided to <b>keep</b>. We always inspect prev.next, the candidate." });
          while (st.next[prev] !== null) {
            const c = st.next[prev];
            S({ ptrs: { prev, "prev.next": c }, ncls: { ...base, [c]: "active" }, line: [2, 3], vars: { x, "prev.next.val": valOf(st, c) }, note: `Inspect prev.next = ${valOf(st, c)}. ${valOf(st, c) === x ? "It equals x, so it must go." : "It is not x, so it stays."}` });
            if (valOf(st, c) === x) {
              st.next[prev] = st.next[c];
              S({ ptrs: { prev, "prev.next": st.next[prev] }, ncls: { ...base, [c]: "bad" }, ecls: { [prev]: "active" }, ghost: [[prev, c]], line: 4, vars: { x }, note: `Bypass it: prev.next = prev.next.next. <b>Do not advance prev</b>: the new prev.next (${valOf(st, st.next[prev])}) has not been inspected and may also equal ${x}.` });
              st.nodes = st.nodes.filter((n) => n.id !== c);
            } else {
              prev = c;
              S({ ptrs: { prev }, ncls: base, line: 6, vars: { x }, note: `Keep ${valOf(st, c)} and step prev onto it.` });
            }
          }
          relayout(st, "d", true);
          const res = vals(st, st.next.d);
          S({ ptrs: { "dummy.next": st.next.d }, ncls: { d: "path", ...Object.fromEntries(walk(st, st.next.d).map((id) => [id, "done"])) }, line: 7, vars: { x, result: res.length ? res.join(",") : "empty" }, note: `prev.next is null: done. Return <b>dummy.next</b>, which is correct even when every node (including the old head) was removed. Result: ${listStr(res)}.` });
          return fr;
        }
        const k = Viz.parse.int(inp.k, { min: 0, max: isIns ? a.length : a.length - 1 });
        S({ ptrs: { prev }, ncls: base, line: 1, vars: { k }, note: `prev must stop on the node <b>before</b> position ${k}: a singly linked node can only change what comes after it.` });
        for (let i = 0; i < k; i++) {
          prev = st.next[prev];
          S({ ptrs: { prev }, ncls: base, line: [2, 3], vars: { k, i: i + 1 }, note: `Step ${i + 1} of ${k}: prev moves to ${valOf(st, prev)}.` });
        }
        if (op === "delete") {
          const victim = st.next[prev];
          S({ ptrs: { prev, victim }, ncls: { ...base, [victim]: "bad" }, line: 4, vars: { k }, note: `The victim is prev.next = ${valOf(st, victim)}.` });
          st.next[prev] = st.next[victim];
          S({ ptrs: { prev, victim }, ncls: { ...base, [victim]: "bad" }, ecls: { [prev]: "active", [victim]: "dim" }, ghost: [[prev, victim]], line: 5, vars: { k }, note: `prev.next = victim.next. Nothing points to ${valOf(st, victim)} any more, so it is unreachable: Python and C# collect it; in C or C++ you would free it now. Its own next pointer is harmless.` });
          st.nodes = st.nodes.filter((n) => n.id !== victim);
          relayout(st, "d", true);
          S({ ptrs: { "dummy.next": st.next.d }, ncls: base, line: 6, vars: { k }, note: `Return dummy.next: ${listStr(vals(st, st.next.d))}. Deleting index 0 used the very same code; without the dummy it needs its own branch.` });
          return fr;
        }
        const x = Viz.parse.int(inp.x, { min: -999, max: 999 });
        const succ = st.next[prev];
        st.nodes.push({ id: "x", val: x, slot: nodeOf(st, prev).slot + 0.5, row: 1 });
        st.next.x = null;
        S({ ptrs: { prev, node: "x" }, ncls: { ...base, x: "active" }, line: 4, vars: { k, x }, note: `The new node ${x} exists, but nothing points to it and its next is null.` });
        if (op === "insert") {
          st.next.x = succ;
          S({ ptrs: { prev, node: "x" }, ncls: { ...base, x: "active" }, ecls: { x: "active" }, line: 5, vars: { k, x }, note: succ === null ? "node.next = prev.next = null: we are appending at the tail." : `node.next = prev.next: the new node now also holds a reference to ${valOf(st, succ)}. The old link prev → ${valOf(st, succ)} is still there, so nothing can be lost.` });
          st.next[prev] = "x";
          S({ ptrs: { prev, node: "x" }, ncls: { ...base, x: "done" }, ecls: { [prev]: "active", x: "done" }, ghost: succ === null ? [] : [[prev, succ]], line: 6, vars: { k, x }, note: `prev.next = node: the old link is replaced, and the rest is still reachable through the new node. Two assignments, O(1), no shifting.` });
          relayout(st, "d", true);
          S({ ptrs: { "dummy.next": st.next.d }, ncls: { ...base, x: "done" }, line: 7, vars: { k, x }, note: `Return dummy.next: ${listStr(vals(st, st.next.d))}.` });
          return fr;
        }
        st.next[prev] = "x";
        const lost = new Set(walk(st, succ));
        const lostCls = Object.fromEntries([...lost].map((id) => [id, "bad"]));
        S({ ptrs: { prev, node: "x" }, ncls: { ...base, x: "active", ...lostCls }, ecls: { [prev]: "active" }, ghost: succ === null ? [] : [[prev, succ]], line: 5, vars: { k, x }, note: succ === null ? "At the tail nothing is lost yet, but watch the next line." : `prev.next was the <b>only</b> reference to ${valOf(st, succ)}. It has been overwritten, so ${[...lost].map((id) => valOf(st, id)).join(" → ")} is now unreachable.` });
        st.next.x = st.next[prev];
        S({ ptrs: { prev, node: "x" }, ncls: { ...base, x: "bad", ...lostCls }, ecls: { x: "bad" }, line: 6, vars: { k, x }, note: "node.next = prev.next reads the link we just wrote, which is node itself. The node now points to itself: any traversal spins forever." });
        S({ ptrs: { "dummy.next": st.next.d }, ncls: { ...base, x: "bad", ...lostCls }, ecls: { x: "bad" }, line: 7, vars: { k, x }, note: "Rule: <b>read every link you still need before you overwrite one</b>. Wire the new node to its successor first, then repoint the predecessor." });
        return fr;
      },
      render: (f) => llSvg(f, { ptrCls: PTRC, nullAt: "left" }),
    });
  });

  /* 2 ─ Iterative reversal (prev / curr / nxt). data-opts {"bug": true} shows what happens without nxt. */
  const REV = ["prev, curr = None, head", "while curr:", "    nxt = curr.next     # 1) save the rest", "    curr.next = prev    # 2) flip one arrow", "    prev = curr         # 3) advance prev", "    curr = nxt          # 4) advance curr", "return prev             # new head"];
  const REV_BUG = ["prev, curr = None, head", "while curr:", "    curr.next = prev    # flip without saving", "    prev = curr", "    curr = curr.next    # BUG: that is prev now", "return prev"];
  Viz.register("linked-lists-reverse", (el, opts) => {
    const bug = !!opts.bug;
    return Viz.player(el, {
      title: bug ? "Reversal without saving next: the rest of the list falls off" : "Reverse a list in place: three pointers, one arrow flipped per step",
      tag: bug ? "WATCH THE BUG" : "O(n) time · O(1) space",
      legend: [["active", "curr (being flipped)"], ["done", "already reversed"], ["bad", "lost"]],
      codeLang: "python", code: bug ? REV_BUG : REV,
      inputs: [{ key: "list", label: "list (1–8 values)", value: "1,2,3,4,5" }],
      random: () => ({ list: Viz.randInts(Viz.rand(2, 7), 1, 9).join(",") }),
      build: (inp) => {
        const a = parseList(inp.list, 1, 8), st = mkList(a), fr = [];
        const S = (x) => fr.push({ ...snapOf(st), ...x });
        const done = new Set(), D = () => Object.fromEntries([...done].map((id) => [id, "done"]));
        let prev = null, curr = "n0", it = 0;
        S({ ptrs: { prev, curr }, line: 0, vars: { reversed: 0 }, note: "Invariant: <b>prev</b> heads the part already reversed (empty at first, so null); <b>curr</b> heads the part not yet touched. Each step moves one node from the right part to the left part." });
        while (curr !== null) {
          it++;
          if (bug) {
            const was = st.next[curr];
            st.next[curr] = prev; done.add(curr);
            const lost = walk(st, was);
            S({ ptrs: { prev, curr }, ncls: { ...D(), [curr]: "active", ...Object.fromEntries(lost.map((id) => [id, "bad"])) }, ecls: { [curr]: "active" }, ghost: was === null ? [] : [[curr, was]], line: [1, 2], vars: { step: it }, note: was === null ? "Flipped the last arrow." : `curr.next = prev overwrote the <b>only</b> reference to ${valOf(st, was)}. Nothing in the program can reach ${lost.map((id) => valOf(st, id)).join(", ")} any more.` });
            prev = curr;
            S({ ptrs: { prev, curr }, ncls: { ...D(), ...Object.fromEntries(lost.map((id) => [id, "bad"])) }, line: 3, vars: { step: it }, note: "prev = curr." });
            curr = st.next[curr];
            S({ ptrs: { prev, curr }, ncls: { ...D(), ...Object.fromEntries(lost.map((id) => [id, "bad"])) }, line: 4, vars: { step: it }, note: `curr = curr.next reads the arrow we just flipped, which points back to ${curr === null ? "null" : valOf(st, curr)}. ${curr === null ? "The loop ends after one node." : ""}` });
            if (it > 2) break;
            continue;
          }
          const nxt = st.next[curr];
          S({ ptrs: { prev, curr, nxt }, ncls: { ...D(), [curr]: "active" }, ecls: { [curr]: "visit" }, line: [1, 2], vars: { reversed: done.size }, note: nxt === null ? "nxt = curr.next = null: this is the last node." : `Save <b>nxt = curr.next</b> (${valOf(st, nxt)}). The next line overwrites curr.next, and nxt will be the only handle on the rest of the list.` });
          st.next[curr] = prev; done.add(curr);
          S({ ptrs: { prev, curr, nxt }, ncls: { ...D(), [curr]: "active" }, ecls: { [curr]: "active" }, ghost: nxt === null ? [] : [[curr, nxt]], line: 3, vars: { reversed: done.size }, note: `Flip: curr.next = prev. ${valOf(st, curr)} now points ${prev === null ? "to null (it becomes the new tail)" : "back to " + valOf(st, prev)}. The dashed red link is the arrow that no longer exists.` });
          prev = curr; curr = nxt;
          S({ ptrs: { prev, curr }, ncls: D(), line: [4, 5], vars: { reversed: done.size }, note: `Slide both pointers right. Reversed part: ${vals(st, prev).join(" → ")} → null. ${curr === null ? "curr is null, so every node has been flipped." : "Still to do: " + vals(st, curr).join(" → ") + "."}` });
        }
        if (bug) {
          S({ ptrs: { prev }, ncls: D(), line: 5, vars: { returned: vals(st, prev).join("→") }, note: "The function returns a one-node list. Fix: save <code>nxt = curr.next</code> <b>before</b> the flip and advance with <code>curr = nxt</code>." });
          return fr;
        }
        S({ ptrs: { prev, curr }, ncls: D(), line: 6, vars: { reversed: done.size }, note: "Return prev: it points at the old tail, which is the new head." });
        relayout(st, prev);
        S({ ptrs: { head: prev }, ncls: D(), line: 6, vars: { result: vals(st, prev).join("→") }, note: `The same nodes redrawn in their new order: ${listStr(vals(st, prev))}. No node moved in memory; only n arrows changed.` });
        return fr;
      },
      render: (f) => llSvg(f, { ptrCls: PTRC, nullAt: "left" }),
    });
  });

  /* 3 ─ Recursive reversal with the call stack */
  Viz.register("linked-lists-reverse-rec", (el) => Viz.player(el, {
    title: "Recursive reversal: trust the call, then fix one link on the way back",
    tag: "O(n) time · O(n) stack",
    legend: [["active", "this call's head"], ["visit", "head.next"], ["done", "reversed suffix"]],
    codeLang: "python",
    code: ["def reverse(head):", "    if head is None or head.next is None:", "        return head              # 0 or 1 node", "    new_head = reverse(head.next)", "    head.next.next = head        # the node after me points back", "    head.next = None             # I become the tail", "    return new_head"],
    inputs: [{ key: "list", label: "list (1–6 values)", value: "1,2,3,4" }],
    random: () => ({ list: Viz.randInts(Viz.rand(2, 6), 1, 9).join(",") }),
    build: (inp) => {
      const a = parseList(inp.list, 1, 6), st = mkList(a), fr = [], calls = [];
      const rev = new Set();
      const S = (h, x) => fr.push({ ...snapOf(st), stack: calls.map((id) => `reverse(${valOf(st, id)})`), ...x, ncls: { ...Object.fromEntries([...rev].map((id) => [id, "done"])), ...(h ? { [h]: "active" } : {}), ...(x.ncls || {}) } });
      const go = (h) => {
        calls.push(h);
        S(h, { ptrs: { head: h }, line: 0, vars: { depth: calls.length }, note: `Call reverse(${valOf(st, h)}). Depth ${calls.length}.` });
        if (st.next[h] === null) {
          rev.add(h);
          S(h, { ptrs: { head: h }, line: [1, 2], vars: { depth: calls.length }, note: `Base case: ${valOf(st, h)} has no next, so a one-node list is already reversed. Return it; it will be the final head.` });
          calls.pop();
          return h;
        }
        S(h, { ptrs: { head: h }, line: 3, vars: { depth: calls.length }, note: `Not a base case. Recurse on the rest first, and <b>trust</b> that the call returns the rest reversed.` });
        const nh = go(st.next[h]);
        const nx = st.next[h];
        S(h, { ptrs: { head: h, new_head: nh }, ncls: { [nx]: "visit" }, line: 3, vars: { depth: calls.length }, note: `Back in reverse(${valOf(st, h)}). Everything after ${valOf(st, h)} is reversed and ends at ${valOf(st, nx)}. Key fact: <b>head.next still points at ${valOf(st, nx)}</b>, the tail of the reversed suffix.` });
        st.next[nx] = h;
        S(h, { ptrs: { head: h, new_head: nh }, ncls: { [nx]: "visit" }, ecls: { [nx]: "active" }, line: 4, vars: { depth: calls.length }, note: `head.next.next = head: ${valOf(st, nx)} now points back to ${valOf(st, h)}. For a moment ${valOf(st, h)} ⇄ ${valOf(st, nx)} form a 2-cycle.` });
        st.next[h] = null; rev.add(h);
        S(h, { ptrs: { head: h, new_head: nh }, ecls: { [nx]: "done" }, ghost: [[h, nx]], line: 5, vars: { depth: calls.length }, note: `head.next = None breaks the cycle. ${valOf(st, h)} is the new tail of a reversed list of ${rev.size} nodes.` });
        calls.pop();
        S(null, { ptrs: { new_head: nh }, line: 6, vars: { depth: calls.length }, note: `Return new_head (${valOf(st, nh)}) unchanged up the stack. Every level returns the same node.` });
        return nh;
      };
      const nh = go("n0");
      relayout(st, nh);
      fr.push({ ...snapOf(st), stack: [], ptrs: { head: nh }, ncls: Object.fromEntries(st.nodes.map((n) => [n.id, "done"])), line: 6, vars: { result: vals(st, nh).join("→") }, note: `Redrawn in order: ${listStr(vals(st, nh))}. Recursion depth was n, so this uses O(n) stack; the iterative version is O(1).` });
      return fr;
    },
    render: (f) => Viz.row(llSvg(f, { ptrCls: PTRC, nullAt: "left" }), Viz.stack(f.stack, { label: "call stack", cls: (i) => (i === f.stack.length - 1 ? "active" : "") })),
  }));

  /* 4 ─ Reverse between left..right by head insertion */
  Viz.register("linked-lists-reverse-between", (el) => Viz.player(el, {
    title: "Reverse positions left..right: keep moving the node after curr to the front",
    tag: "ONE PASS · O(1) SPACE",
    legend: [["path", "dummy / pre (fixed)"], ["active", "move (being lifted)"], ["visit", "curr (slides back)"], ["done", "reversed segment"]],
    codeLang: "python",
    code: ["dummy = ListNode(0, head)", "pre = dummy", "for _ in range(left - 1):", "    pre = pre.next", "curr = pre.next             # stays the same node", "for _ in range(right - left):", "    move = curr.next", "    curr.next = move.next   # unhook move", "    move.next = pre.next    # move points at the front", "    pre.next = move         # pre adopts move", "return dummy.next"],
    inputs: [{ key: "list", label: "list (1–8 values)", value: "1,2,3,4,5,6" }, { key: "l", label: "left", value: "2", width: 50 }, { key: "r", label: "right", value: "5", width: 50 }],
    random: () => { const n = Viz.rand(3, 8), l = Viz.rand(1, n - 1); return { list: Viz.randInts(n, 1, 9).join(","), l: String(l), r: String(Viz.rand(l + 1, n)) }; },
    build: (inp) => {
      const a = parseList(inp.list, 1, 8);
      const l = Viz.parse.int(inp.l, { min: 1, max: a.length }), r = Viz.parse.int(inp.r, { min: l, max: a.length });
      const st = mkList(a), fr = [];
      st.nodes.unshift({ id: "d", val: "D", slot: -1, row: 0 }); st.next.d = "n0";
      const seg = new Set();
      const S = (x) => fr.push({ ...snapOf(st), ...x, ncls: { d: "path", ...Object.fromEntries([...seg].map((id) => [id, "done"])), ...(x.ncls || {}) } });
      S({ ptrs: { dummy: "d" }, line: 0, vars: { left: l, right: r }, note: `Reverse positions ${l}..${r} (1-indexed). The dummy covers left = 1, where the head itself changes.` });
      let pre = "d";
      for (let i = 0; i < l - 1; i++) pre = st.next[pre];
      S({ ptrs: { pre }, ncls: { [pre]: "path" }, line: [1, 2, 3], vars: { left: l, right: r }, note: `Walk pre to position ${l - 1}: the node <b>just before</b> the segment. pre never moves again.` });
      const curr = st.next[pre]; seg.add(curr);
      S({ ptrs: { pre, curr }, ncls: { [pre]: "path", [curr]: "visit" }, line: 4, vars: { left: l, right: r }, note: `curr = ${valOf(st, curr)}, the first node of the segment. It will end up as the segment's <b>last</b> node and stays the same object throughout.` });
      for (let i = 0; i < r - l; i++) {
        const mv = st.next[curr], mn = nodeOf(st, mv);
        mn.row = 1;
        S({ ptrs: { pre, curr, move: mv }, ncls: { [pre]: "path", [curr]: "visit", [mv]: "active" }, line: [5, 6], vars: { round: `${i + 1}/${r - l}` }, note: `move = curr.next = ${valOf(st, mv)} (lifted down so the arrows are easy to see).` });
        st.next[curr] = st.next[mv];
        S({ ptrs: { pre, curr, move: mv }, ncls: { [pre]: "path", [curr]: "visit", [mv]: "active" }, ecls: { [curr]: "active" }, ghost: [[curr, mv]], line: 7, vars: { round: `${i + 1}/${r - l}` }, note: `curr.next = move.next: the list skips ${valOf(st, mv)}. curr now points at ${valOf(st, st.next[curr])}.` });
        st.next[mv] = st.next[pre];
        S({ ptrs: { pre, curr, move: mv }, ncls: { [pre]: "path", [curr]: "visit", [mv]: "active" }, ecls: { [mv]: "active" }, line: 8, vars: { round: `${i + 1}/${r - l}` }, note: `move.next = pre.next: ${valOf(st, mv)} points at the current front of the segment (${valOf(st, st.next[pre])}).` });
        const old = st.next[pre];
        st.next[pre] = mv; seg.add(mv);
        S({ ptrs: { pre, curr, move: mv }, ncls: { [pre]: "path", [curr]: "visit", [mv]: "active" }, ecls: { [pre]: "active" }, ghost: [[pre, old]], line: 9, vars: { round: `${i + 1}/${r - l}` }, note: `pre.next = move: ${valOf(st, mv)} is the new front of the segment.` });
        relayout(st, "d");
        S({ ptrs: { pre, curr }, ncls: { [pre]: "path", [curr]: "visit" }, line: 5, vars: { round: `${i + 1}/${r - l}` }, note: `Redrawn: ${vals(st, st.next.d).join(" → ")}. The reversed part grew by one; curr slid one place right without being reassigned.` });
      }
      S({ ptrs: { "dummy.next": st.next.d }, line: 10, vars: { result: vals(st, st.next.d).join("→") }, note: `Done after ${r - l} moves: ${listStr(vals(st, st.next.d))}. Three assignments per move, no second pass, no reconnecting at the end.` });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: PTRC, nullAt: "left" }),
  }));

  /* 5 ─ Reverse nodes in k-groups */
  Viz.register("linked-lists-reverse-k", (el) => Viz.player(el, {
    title: "Reverse in k-groups: find the k-th node, flip the group, stitch it back",
    tag: "HARD · O(n) · O(1)",
    legend: [["path", "group_prev (fixed anchor)"], ["visit", "kth / group_next"], ["active", "curr"], ["done", "finished groups"]],
    codeLang: "python",
    code: ["dummy = ListNode(0, head)", "group_prev = dummy", "while True:", "    kth = group_prev", "    for _ in range(k):          # is there a full group?", "        kth = kth.next", "        if kth is None: return dummy.next", "    group_next = kth.next", "    prev, curr = group_next, group_prev.next", "    while curr is not group_next:   # plain reversal", "        curr.next, prev, curr = prev, curr, curr.next", "    first = group_prev.next     # old first = new last", "    group_prev.next = kth       # stitch the front", "    group_prev = first"],
    inputs: [{ key: "list", label: "list (1–9 values)", value: "1,2,3,4,5,6,7,8" }, { key: "k", label: "k", value: "3", width: 50 }],
    random: () => { const n = Viz.rand(3, 9); return { list: Viz.randInts(n, 1, 9).join(","), k: String(Viz.rand(2, Math.min(4, n))) }; },
    build: (inp) => {
      const a = parseList(inp.list, 1, 9), k = Viz.parse.int(inp.k, { min: 1, max: 9 });
      const st = mkList(a), fr = [];
      st.nodes.unshift({ id: "d", val: "D", slot: -1, row: 0 }); st.next.d = "n0";
      const done = new Set();
      const S = (x) => fr.push({ ...snapOf(st), ...x, ncls: { d: "path", ...Object.fromEntries([...done].map((id) => [id, "done"])), ...(x.ncls || {}) } });
      let gp = "d", g = 0;
      S({ ptrs: { dummy: "d", group_prev: gp }, line: [0, 1], vars: { k }, note: `group_prev is the node just before the next group. The dummy plays that role for the first group, whose new head becomes the list's head.` });
      for (;;) {
        let kth = gp, ok = true;
        for (let i = 0; i < k; i++) { kth = st.next[kth]; if (kth === null) { ok = false; break; } }
        const span = ok ? { a: st.next[gp], b: kth, text: `group ${g + 1}: k = ${k}` } : null;
        if (!ok) {
          S({ ptrs: { group_prev: gp, kth: null }, line: [3, 4, 5, 6], vars: { k, groups: g }, note: `Fewer than ${k} nodes remain${st.next[gp] === null ? "" : " (" + vals(st, st.next[gp]).join(", ") + ")"}, so kth runs off the end. They stay as they are. Return dummy.next.` });
          break;
        }
        g++;
        const gn = st.next[kth];
        S({ ptrs: { group_prev: gp, kth, group_next: gn }, ncls: { [gp]: "path", [kth]: "visit" }, span, line: [3, 4, 5, 7], vars: { k, group: g }, note: `Walk k = ${k} steps: kth = ${valOf(st, kth)}, so a full group exists. Save group_next = ${valOf(st, gn)}, the first node after it.` });
        let prev = gn, curr = st.next[gp];
        S({ ptrs: { group_prev: gp, prev, curr }, ncls: { [gp]: "path", [kth]: "visit", [curr]: "active" }, line: 8, vars: { k, group: g }, note: `Start a normal reversal, but with prev = group_next instead of null. The first node of the group will then point straight at the next group.` });
        while (curr !== gn) {
          const nx = st.next[curr];
          st.next[curr] = prev; done.add(curr);
          S({ ptrs: { group_prev: gp, prev: curr, curr: nx }, ncls: { [gp]: "path", [kth]: "visit", ...(nx !== null && nx !== gn ? { [nx]: "active" } : {}) }, ecls: { [curr]: "active" }, ghost: nx === null ? [] : [[curr, nx]], line: [9, 10], vars: { k, group: g }, note: `${valOf(st, curr)}.next = ${valOf(st, prev)}.` });
          prev = curr; curr = nx;
        }
        const first = st.next[gp];
        S({ ptrs: { group_prev: gp, kth, first }, ncls: { [gp]: "path" }, line: 11, vars: { k, group: g }, note: `The group is reversed internally, but group_prev still points at ${valOf(st, first)}, the old first node, which is now the group's <b>last</b> node.` });
        st.next[gp] = kth;
        S({ ptrs: { group_prev: gp, kth, first }, ncls: { [gp]: "path" }, ecls: { [gp]: "active" }, ghost: [[gp, first]], line: 12, vars: { k, group: g }, note: `group_prev.next = kth: the anchor now points at ${valOf(st, kth)}, the new front of the group.` });
        relayout(st, "d");
        gp = first;
        S({ ptrs: { group_prev: gp }, ncls: { [gp]: "path" }, line: 13, vars: { k, group: g }, note: `Redrawn: ${vals(st, st.next.d).join(" → ")}. ${valOf(st, first)} becomes the next group_prev.` });
      }
      relayout(st, "d");
      S({ ptrs: { "dummy.next": st.next.d }, line: 6, vars: { result: vals(st, st.next.d).join("→") }, note: `Result: ${listStr(vals(st, st.next.d))}. Each node is visited twice (counting and flipping), so O(n) time and O(1) extra space.` });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: { ...PTRC, group_prev: "p-path", group_next: "p-visit", first: "p-done" }, nullAt: "right", sx: 80 }),
  }));

  /* 6 ─ Merge two sorted lists with a dummy tail */
  Viz.register("linked-lists-merge", (el) => Viz.player(el, {
    title: "Merge two sorted lists: a dummy and a tail pointer that only moves forward",
    tag: "O(n + m) · O(1)",
    legend: [["path", "dummy"], ["active", "tail"], ["visit", "a / b fronts"], ["done", "merged"]],
    codeLang: "python",
    code: ["dummy = tail = ListNode(0)", "while a and b:", "    if a.val <= b.val:          # <= keeps it stable", "        tail.next, a = a, a.next", "    else:", "        tail.next, b = b, b.next", "    tail = tail.next", "tail.next = a or b              # attach the leftover", "return dummy.next"],
    inputs: [{ key: "a", label: "list a (sorted, 0–6)", value: "1,4,5,9" }, { key: "b", label: "list b (sorted, 0–6)", value: "2,3,6,7,10" }],
    random: () => ({ a: Viz.randInts(Viz.rand(1, 5), 1, 20).sort((x, y) => x - y).join(","), b: Viz.randInts(Viz.rand(1, 5), 1, 20).sort((x, y) => x - y).join(",") }),
    build: (inp) => {
      const A = parseList(inp.a, 0, 6), B = parseList(inp.b, 0, 6);
      const sorted = (v) => v.every((x, i) => !i || v[i - 1] <= x);
      if (!sorted(A) || !sorted(B)) throw new Error("Both lists must be sorted ascending.");
      const la = mkList(A, { prefix: "a" }), lb = mkList(B, { prefix: "b", row: 1 });
      let i = 0, j = 0, r = 0;
      while (i < A.length || j < B.length) {
        if (j >= B.length || (i < A.length && A[i] <= B[j])) la.nodes[i++].slot = r++; else lb.nodes[j++].slot = r++;
      }
      const st = { nodes: [{ id: "d", val: "D", slot: -1, row: 0.5 }, ...la.nodes, ...lb.nodes], next: { d: null, ...la.next, ...lb.next }, prev: null, rand: null };
      const fr = [], done = new Set();
      const S = (x) => fr.push({ ...snapOf(st), ...x, ncls: { d: "path", ...Object.fromEntries([...done].map((id) => [id, "done"])), ...(x.ncls || {}) } });
      let a = A.length ? "a0" : null, b = B.length ? "b0" : null, tail = "d";
      S({ ptrs: { a, b, tail }, line: 0, vars: {}, note: `Each node is drawn at the column it will occupy in the answer, so you can see the final order before we start. The dummy gives tail somewhere to stand before any node is chosen.` });
      while (a !== null && b !== null) {
        const takeA = valOf(st, a) <= valOf(st, b), pick = takeA ? a : b;
        S({ ptrs: { a, b, tail }, ncls: { [a]: "visit", [b]: "visit", [tail]: "active" }, line: [1, 2], vars: { "a.val": valOf(st, a), "b.val": valOf(st, b) }, note: `Compare fronts: ${valOf(st, a)} vs ${valOf(st, b)}. Take ${takeA ? "a" : "b"}'s ${valOf(st, pick)}${valOf(st, a) === valOf(st, b) ? " (a tie goes to a, which keeps the merge stable)" : ""}.` });
        st.next[tail] = pick; done.add(pick);
        if (takeA) a = st.next[a]; else b = st.next[b];
        S({ ptrs: { a, b, tail }, ncls: { [tail]: "active" }, ecls: { [tail]: "active" }, line: takeA ? 3 : 5, vars: {}, note: `tail.next = ${valOf(st, pick)}, and ${takeA ? "a" : "b"} advances. We relink existing nodes; nothing is allocated.` });
        tail = pick;
        S({ ptrs: { a, b, tail }, ncls: { [tail]: "active" }, line: 6, vars: {}, note: `tail moves onto ${valOf(st, tail)}.` });
      }
      const rest = a !== null ? a : b;
      st.next[tail] = rest;
      walk(st, rest).forEach((id) => done.add(id));
      S({ ptrs: { a, b, tail }, ncls: { [tail]: "active" }, ecls: { [tail]: "active" }, line: 7, vars: {}, note: rest === null ? "Both lists are empty: tail.next = null." : `One list is exhausted. The other (${vals(st, rest).join(", ")}) is already sorted and already linked, so attach it with <b>one</b> assignment instead of looping.` });
      relayout(st, "d");
      S({ ptrs: { "dummy.next": st.next.d }, line: 8, vars: { result: vals(st, st.next.d).join(",") }, note: `Return dummy.next: ${listStr(vals(st, st.next.d))}.` });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: { ...PTRC, a: "p-visit", b: "p-visit", tail: "p-active" }, nullAt: "right", sx: 74, nw: 50 }),
  }));

  /* 7 ─ Two pointers on a list: middle (slow/fast) and remove n-th from end (fixed gap). data-opts {"mode": "middle" | "nth"} */
  Viz.register("linked-lists-gap", (el, opts) => {
    const nth = opts.mode === "nth";
    return Viz.player(el, {
      title: nth ? "Remove the n-th node from the end: open a gap of n + 1, then slide" : "Find the middle: fast moves two, slow moves one",
      tag: "ONE PASS",
      legend: [["path", "dummy"], ["active", "slow"], ["visit", "fast"], ["bad", "removed"]],
      codeLang: "python",
      code: nth ? ["dummy = ListNode(0, head)", "fast = slow = dummy", "for _ in range(n + 1):     # open the gap", "    fast = fast.next", "while fast:                # slide together", "    fast = fast.next", "    slow = slow.next", "slow.next = slow.next.next # slow is just before the target", "return dummy.next"]
        : ["slow = fast = head", "while fast and fast.next:", "    slow = slow.next", "    fast = fast.next.next", "return slow    # second middle when n is even"],
      inputs: nth ? [{ key: "list", label: "list (1–9 values)", value: "1,2,3,4,5,6" }, { key: "n", label: "n", value: "2", width: 50 }] : [{ key: "list", label: "list (1–9 values)", value: "1,2,3,4,5,6,7" }],
      random: () => { const n = Viz.rand(1, 9), a = Viz.randInts(n, 1, 9).join(","); return nth ? { list: a, n: String(Viz.rand(1, n)) } : { list: a }; },
      build: (inp) => {
        const a = parseList(inp.list, 1, 9), st = mkList(a), fr = [];
        const S = (x) => fr.push({ ...snapOf(st), ...x });
        if (!nth) {
          let slow = "n0", fast = "n0", s = 0;
          const C = () => ({ [slow]: "active", ...(fast !== null ? { [fast]: "visit" } : {}) });
          S({ ptrs: { slow, fast }, ncls: C(), line: 0, vars: { steps: 0 }, note: "Both start at the head. Every round fast covers two links and slow covers one, so when fast reaches the end, slow has covered half the distance." });
          while (fast !== null && st.next[fast] !== null) {
            S({ ptrs: { slow, fast }, ncls: C(), line: 1, vars: { steps: s }, note: `fast = ${valOf(st, fast)} and fast.next = ${valOf(st, st.next[fast])} both exist, so two more links are available.` });
            slow = st.next[slow]; fast = st.next[st.next[fast]]; s++;
            S({ ptrs: { slow, fast }, ncls: C(), line: [2, 3], vars: { steps: s }, note: `slow → ${valOf(st, slow)}, fast → ${valOf(st, fast)}.` });
          }
          S({ ptrs: { slow, fast }, ncls: { [slow]: "done" }, line: [1, 4], vars: { n: a.length, middle: valOf(st, slow) }, note: `${fast === null ? "fast fell off the end (n is even)" : "fast is on the last node (n is odd)"}. slow = <b>${valOf(st, slow)}</b>, index ${s} = ⌊n/2⌋. ${a.length % 2 === 0 ? "For even n this is the <b>second</b> middle; use <code>while fast.next and fast.next.next</code> to stop on the first." : ""}` });
          return fr;
        }
        const n = Viz.parse.int(inp.n, { min: 1, max: a.length });
        st.nodes.unshift({ id: "d", val: "D", slot: -1, row: 0 }); st.next.d = "n0";
        let fast = "d", slow = "d";
        const C = (x = {}) => ({ d: "path", [slow]: "active", ...(fast !== null ? { [fast]: "visit" } : {}), ...x });
        S({ ptrs: { slow, fast }, ncls: C(), line: [0, 1], vars: { n }, note: `To delete the n-th from the end we need the node <b>before</b> it. Starting both at the dummy lets that "before" node exist even when the head is the target (n = length).` });
        for (let i = 0; i < n + 1; i++) {
          fast = st.next[fast];
          S({ ptrs: { slow, fast }, ncls: C(), span: { a: slow, b: fast, text: `gap ${i + 1}` }, line: [2, 3], vars: { n, gap: i + 1 }, note: `fast steps ${i + 1} of n + 1 = ${n + 1}.` });
        }
        S({ ptrs: { slow, fast }, ncls: C(), span: { a: slow, b: fast, text: `gap n+1 = ${n + 1}` }, line: 4, vars: { n }, note: `The gap is fixed now. When fast reaches null (one past the tail), slow will be exactly n + 1 links behind null, which is the node just before the target.` });
        while (fast !== null) {
          fast = st.next[fast]; slow = st.next[slow];
          S({ ptrs: { slow, fast }, ncls: C(), span: { a: slow, b: fast, text: `gap n+1 = ${n + 1}` }, line: [5, 6], vars: { n }, note: `Slide both. slow = ${valOf(st, slow)}, fast = ${valOf(st, fast)}.` });
        }
        const victim = st.next[slow];
        st.next[slow] = st.next[victim];
        S({ ptrs: { slow, victim }, ncls: C({ [victim]: "bad" }), ecls: { [slow]: "active", [victim]: "dim" }, ghost: [[slow, victim]], line: 7, vars: { n, removed: valOf(st, victim) }, note: `slow.next is ${valOf(st, victim)}, the ${n}${["st", "nd", "rd"][n - 1] || "th"} from the end. Bypass it.` });
        st.nodes = st.nodes.filter((x) => x.id !== victim);
        relayout(st, "d", true);
        S({ ptrs: { "dummy.next": st.next.d }, ncls: { d: "path" }, line: 8, vars: { result: vals(st, st.next.d).join(",") || "empty" }, note: `Return dummy.next: ${listStr(vals(st, st.next.d))}. One pass, no length count.` });
        return fr;
      },
      render: (f) => llSvg(f, { ptrCls: PTRC, nullAt: "right", sx: 78 }),
    });
  });

  /* 8 ─ Floyd cycle detection on a real list (two-pointers.html has the array version) */
  Viz.register("linked-lists-floyd", (el) => Viz.player(el, {
    title: "Floyd on a real list: meet inside the loop, then walk to the entrance",
    tag: "O(n) · O(1)",
    legend: [["active", "slow"], ["visit", "fast"], ["path", "p (from head)"], ["done", "cycle entrance"]],
    codeLang: "python",
    code: ["slow = fast = head", "while fast and fast.next:", "    slow, fast = slow.next, fast.next.next", "    if slow is fast: break       # phase 1: they meet", "else:", "    return None                  # fast hit the end: no cycle", "p = head", "while p is not slow:             # phase 2", "    p, slow = p.next, slow.next", "return p                         # cycle entrance"],
    inputs: [{ key: "list", label: "values (2–10)", value: "3,8,1,6,4,9,2,7" }, { key: "pos", label: "tail → index (-1 = none)", value: "2", width: 60 }],
    random: () => { const n = Viz.rand(3, 10); return { list: Viz.randInts(n, 1, 9).join(","), pos: String(Viz.rand(-1, n - 1)) }; },
    build: (inp) => {
      const a = parseList(inp.list, 2, 10), pos = Viz.parse.int(inp.pos, { min: -1, max: a.length - 1 });
      const st = mkList(a), fr = [];
      if (pos >= 0) st.next["n" + (a.length - 1)] = "n" + pos;
      const S = (x) => fr.push({ ...snapOf(st), ...x });
      const lam = pos >= 0 ? a.length - pos : 0;
      const sub = Object.fromEntries(st.nodes.map((n, i) => [n.id, String(i)]));
      let slow = "n0", fast = "n0", s = 0;
      const C = (x = {}) => ({ [slow]: "active", ...(fast !== null ? { [fast]: "visit" } : {}), ...x });
      S({ sub, ptrs: { slow, fast }, ncls: C(), ecls: pos >= 0 ? { ["n" + (a.length - 1)]: "path" } : {}, line: 0, vars: { "μ (tail)": pos >= 0 ? pos : "-", "λ (loop)": pos >= 0 ? lam : "-" }, note: pos >= 0 ? `The last node points back to index ${pos} (the curved arrow). The tail before the loop has μ = ${pos} nodes; the loop has λ = ${lam}. Code can't see this picture: it only has <code>head</code>.` : "No cycle: the last node's next is null." });
      for (;;) {
        if (fast === null || st.next[fast] === null) {
          S({ sub, ptrs: { slow, fast }, ncls: C(), line: [1, 4, 5], vars: { steps: s }, note: "fast (or fast.next) is null, so the list ends. A list with a cycle never ends, so <b>no cycle</b>." });
          return fr;
        }
        slow = st.next[slow]; fast = st.next[st.next[fast]]; s++;
        const met = slow === fast;
        S({ sub, ptrs: { slow, fast }, ncls: C(met ? { [slow]: "bad" } : {}), line: met ? [2, 3] : 2, vars: { steps: s }, note: met ? `They meet at index ${sub[slow]} after ${s} steps. Inside the loop fast gains one node per step, so once both are in the loop the gap closes within λ = ${lam} steps.` : `slow → ${valOf(st, slow)} (index ${sub[slow]}), fast → ${fast === null ? "null" : valOf(st, fast) + " (index " + sub[fast] + ")"}.` });
        if (met) break;
      }
      let p = "n0";
      S({ sub, ptrs: { p, slow }, ncls: { [p]: "path", [slow]: "active" }, line: 6, vars: { steps: 0 }, note: `Phase 2. Put p at the head; keep slow at the meeting point. The meeting point is μ steps (mod λ) <b>before</b> the entrance, so both reach the entrance after exactly μ = ${pos} steps.` });
      let t = 0;
      while (p !== slow) {
        p = st.next[p]; slow = st.next[slow]; t++;
        S({ sub, ptrs: { p, slow }, ncls: { [p]: "path", [slow]: "active" }, line: [7, 8], vars: { steps: t }, note: `p → index ${sub[p]}, slow → index ${sub[slow]}.` });
      }
      S({ sub, ptrs: { p, slow }, ncls: { [p]: "done" }, line: 9, vars: { entrance: sub[p], "μ": pos, "λ": lam }, note: `They meet at index <b>${sub[p]}</b>, the cycle entrance, after μ = ${t} steps. To get λ, keep one pointer there and walk the other around until it comes back. Proof sketch on <a href="two-pointers.html">Two Pointers</a>.` });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: PTRC, nullAt: "right", sx: 74, nw: 50 }),
  }));

  /* 9 ─ Split, reverse the back half, then compare (palindrome) or weave (reorder). data-opts {"mode": "palindrome" | "reorder"} */
  Viz.register("linked-lists-halves", (el, opts) => {
    const pal = opts.mode !== "reorder";
    const code = pal
      ? ["slow = fast = head", "while fast and fast.next:          # 1) find the middle", "    slow, fast = slow.next, fast.next.next", "prev, curr = None, slow           # 2) reverse from slow", "while curr:", "    curr.next, prev, curr = prev, curr, curr.next", "p, q = head, prev                 # 3) compare outside-in", "while q:", "    if p.val != q.val: return False", "    p, q = p.next, q.next", "return True"]
      : ["slow = fast = head", "while fast and fast.next:          # 1) find the middle", "    slow, fast = slow.next, fast.next.next", "second, slow.next = slow.next, None  # 2) cut after slow", "prev, curr = None, second           # 3) reverse the back", "while curr:", "    curr.next, prev, curr = prev, curr, curr.next", "first, second = head, prev          # 4) weave", "while second:", "    t1, t2 = first.next, second.next", "    first.next, second.next = second, t1", "    first, second = t1, t2"];
    return Viz.player(el, {
      title: pal ? "Palindrome list in O(1) space: middle, reverse the back half, compare" : "Reorder list L0 → Ln → L1 → Ln-1 …: middle, cut, reverse, weave",
      tag: "COMBINE 3 PATTERNS",
      legend: [["active", "slow / p"], ["visit", "fast / q"], ["done", "matched / woven"], ["bad", "mismatch"]],
      codeLang: "python", code,
      inputs: [{ key: "list", label: "list (1–9 values)", value: pal ? "1,2,3,2,1" : "1,2,3,4,5,6" }],
      random: () => { const n = Viz.rand(2, 8); if (!pal) return { list: Array.from({ length: n }, (_, i) => i + 1).join(",") }; const h = Viz.randInts(Math.ceil(n / 2), 1, 5), b = h.slice(0, Math.floor(n / 2)).reverse(); if (Math.random() < 0.3) b[0] = (b[0] || 1) + 1; return { list: h.concat(b).join(",") }; },
      build: (inp) => {
        const a = parseList(inp.list, 1, 9), st = mkList(a), fr = [];
        const S = (x) => fr.push({ ...snapOf(st), ...x });
        let slow = "n0", fast = "n0";
        S({ ptrs: { slow, fast }, ncls: { n0: "active" }, line: 0, vars: { n: a.length }, note: pal ? "A singly linked list can't walk backwards, so we make the back half walk backwards: reverse it in place." : "We need the last node, then the second-to-last, and so on. Reversing the back half turns that into a simple forward walk." });
        while (fast !== null && st.next[fast] !== null) {
          slow = st.next[slow]; fast = st.next[st.next[fast]];
          S({ ptrs: { slow, fast }, ncls: { [slow]: "active", ...(fast !== null ? { [fast]: "visit" } : {}) }, line: [1, 2], vars: { n: a.length }, note: `slow → ${valOf(st, slow)}, fast → ${valOf(st, fast)}.` });
        }
        let start = slow;
        if (!pal) {
          start = st.next[slow]; st.next[slow] = null;
          S({ ptrs: { slow, second: start }, ncls: { [slow]: "active" }, ghost: start === null ? [] : [[slow, start]], line: 3, vars: {}, note: `Cut after slow. Front: ${vals(st, "n0").join(", ")}. Back: ${start === null ? "empty" : vals(st, start).join(", ")}. The front keeps the extra node when n is odd.` });
        } else S({ ptrs: { slow }, ncls: { [slow]: "active" }, line: 3, vars: {}, note: `Middle found at ${valOf(st, slow)}. Reverse from here to the end. The front half still points into slow, which is fine: comparison stops when the back half runs out.` });
        let prev = null, curr = start;
        while (curr !== null) {
          const nx = st.next[curr]; st.next[curr] = prev; prev = curr; curr = nx;
          S({ ptrs: { prev, curr }, ncls: { [prev]: "visit" }, ecls: { [prev]: "active" }, line: pal ? [4, 5] : [5, 6], vars: {}, note: `Flip ${valOf(st, prev)}.` });
        }
        const back = walk(st, prev), front = walk(st, "n0");
        const frontOnly = front.filter((id) => !back.includes(id));
        frontOnly.forEach((id, i) => { const nd = nodeOf(st, id); nd.slot = i; nd.row = 0; });
        back.forEach((id, i) => { const nd = nodeOf(st, id); nd.slot = pal ? i : i + 0.5; nd.row = 1; });
        if (pal) {
          let p = "n0", q = prev, ok = true;
          const good = new Set();
          S({ ptrs: { p, q }, ncls: { [p]: "active", [q]: "visit" }, line: 6, vars: {}, note: `Redrawn: front half on top, reversed back half below. Now p walks the front from the left while q walks the back half, which reads the list from the right.` });
          while (q !== null) {
            const eq = valOf(st, p) === valOf(st, q);
            S({ ptrs: { p, q }, ncls: { ...Object.fromEntries([...good].map((id) => [id, "done"])), [p]: eq ? "active" : "bad", [q]: eq ? "visit" : "bad" }, line: [7, 8], vars: { "p.val": valOf(st, p), "q.val": valOf(st, q) }, note: eq ? `${valOf(st, p)} = ${valOf(st, q)}. Matching pair.` : `${valOf(st, p)} ≠ ${valOf(st, q)}: <b>not a palindrome</b>.` });
            if (!eq) { ok = false; break; }
            good.add(p); good.add(q); p = st.next[p]; q = st.next[q];
          }
          if (ok) S({ ptrs: { p, q }, ncls: Object.fromEntries([...good].map((id) => [id, "done"])), line: 10, vars: { result: "True" }, note: "q ran out with every pair equal: <b>palindrome</b>. Production code reverses the back half again before returning, so the caller gets its list back unchanged." });
          return fr;
        }
        let first = "n0", second = prev;
        S({ ptrs: { first, second }, ncls: { [first]: "active", ...(second ? { [second]: "visit" } : {}) }, line: 7, vars: {}, note: "Front on top, reversed back half below and offset by half a column, which is where each one will slot in." });
        const woven = new Set();
        while (second !== null) {
          const t1 = st.next[first], t2 = st.next[second];
          st.next[first] = second; st.next[second] = t1; woven.add(first); woven.add(second);
          S({ ptrs: { first, second, t1, t2 }, ncls: Object.fromEntries([...woven].map((id) => [id, "done"])), ecls: { [first]: "active", [second]: "active" }, line: [8, 9, 10], vars: {}, note: `Save t1 = ${valOf(st, t1)} and t2 = ${valOf(st, t2)} first, then ${valOf(st, first)} → ${valOf(st, second)} → ${valOf(st, t1)}.` });
          first = t1; second = t2;
        }
        relayout(st, "n0");
        S({ ptrs: { head: "n0" }, ncls: Object.fromEntries(st.nodes.map((n) => [n.id, "done"])), line: 11, vars: { result: vals(st, "n0").join(",") }, note: `Result: ${listStr(vals(st, "n0"))}. O(n) time, O(1) space, no values copied.` });
        return fr;
      },
      render: (f) => llSvg(f, { ptrCls: { ...PTRC, p: "p-active", q: "p-visit", first: "p-active", second: "p-visit", t1: "p-done", t2: "p-done" }, nullAt: "right", sx: 76 }),
    });
  });

  /* 10 ─ Copy list with random pointer: interleave, set randoms, unweave */
  Viz.register("linked-lists-copy-random", (el) => Viz.player(el, {
    title: "Deep-copy a list with random pointers in O(1) extra space: weave, wire, unweave",
    tag: "HARD · 3 PASSES",
    legend: [["active", "c (original)"], ["visit", "copies"], ["path", "random pointers"]],
    codeLang: "python",
    code: ["c = head                                 # pass 1: weave", "while c:", "    c.next = Node(c.val, c.next)         # copy right after original", "    c = c.next.next", "c = head                                 # pass 2: randoms", "while c:", "    if c.random: c.next.random = c.random.next", "    c = c.next.next", "c, copy_head = head, head.next           # pass 3: unweave", "while c:", "    cp = c.next", "    c.next = cp.next", "    cp.next = cp.next.next if cp.next else None", "    c = c.next", "return copy_head"],
    inputs: [{ key: "list", label: "values (1–6)", value: "7,13,11,10,1" }, { key: "rand", label: "random → index (-1 = null)", value: "-1,0,4,2,0" }],
    random: () => { const n = Viz.rand(2, 6); return { list: Viz.randInts(n, 1, 20).join(","), rand: Array.from({ length: n }, () => Viz.rand(-1, n - 1)).join(",") }; },
    build: (inp) => {
      const a = parseList(inp.list, 1, 6), r = Viz.parse.ints(inp.rand, { min: a.length, max: a.length });
      if (r.some((x) => x < -1 || x >= a.length || !Number.isInteger(x))) throw new Error(`Each random index must be -1 or 0..${a.length - 1}.`);
      const st = mkList(a); st.rand = {};
      st.nodes.forEach((n, i) => { st.rand[n.id] = r[i] >= 0 ? "n" + r[i] : null; });
      const fr = [], S = (x) => fr.push({ ...snapOf(st), ...x });
      const cid = (id) => "c" + id.slice(1), copies = () => Object.fromEntries(st.nodes.filter((n) => n.id[0] === "c").map((n) => [n.id, "visit"]));
      S({ ptrs: { head: "n0" }, line: [], vars: {}, note: "Dashed curved arrows are random pointers. The hard part: when copying a node, its random target's copy may not exist yet, and without a hashmap we need some way to get from an original to its copy." });
      let c = "n0";
      while (c !== null) {
        const nx = st.next[c], id = cid(c), i = +c.slice(1);
        st.nodes.push({ id, val: valOf(st, c) + "′", slot: i + 0.5, row: 1 }); st.next[id] = nx; st.next[c] = id; st.rand[id] = undefined;
        S({ ptrs: { c }, ncls: { ...copies(), [c]: "active", [id]: "visit" }, ecls: { [c]: "active", [id]: "active" }, line: [1, 2], vars: {}, note: `Insert ${valOf(st, c)}′ right after ${valOf(st, c)}. Now <b>original.next is its copy</b>: that is the map from original to copy, stored in the list itself.` });
        c = nx;
      }
      S({ ptrs: { c: null }, ncls: copies(), line: 3, vars: {}, note: "Pass 1 done: original, copy, original, copy, … all on one chain." });
      c = "n0";
      const rc = {};
      while (c !== null) {
        const id = cid(c), t = st.rand[c];
        st.rand[id] = t === null ? null : cid(t);
        if (t !== null) rc[id] = "rand hot";
        S({ ptrs: { c }, ncls: { ...copies(), [c]: "active" }, rcls: { ...rc, ...(t !== null ? { [c]: "rand hot" } : {}) }, line: [5, 6], vars: { "c.random": t === null ? "null" : valOf(st, t) }, note: t === null ? `${valOf(st, c)}.random is null, so the copy's random stays null.` : `${valOf(st, c)}.random = ${valOf(st, t)}, so the copy's random is ${valOf(st, t)}.next = <b>${valOf(st, cid(t))}</b>. One hop, no lookup table.` });
        if (t !== null) rc[id] = "rand";
        c = st.next[st.next[c]];
      }
      c = "n0";
      S({ ptrs: { c, copy_head: cid("n0") }, ncls: copies(), line: 8, vars: {}, note: "Pass 3: split the chain back into two lists. The original list must be restored too; judges usually check it." });
      while (c !== null) {
        const cp = st.next[c], after = st.next[cp];
        st.next[c] = after; st.next[cp] = after === null ? null : st.next[after];
        S({ ptrs: { c, cp }, ncls: { ...copies(), [c]: "active" }, ecls: { [c]: "active", [cp]: "active" }, line: [10, 11, 12], vars: {}, note: `${valOf(st, c)} skips its copy; ${valOf(st, cp)} skips the next original.` });
        c = after;
      }
      S({ ptrs: { head: "n0", copy_head: cid("n0") }, ncls: copies(), line: 14, vars: {}, note: "Two independent lists with identical structure: no copy points at an original. O(n) time, O(1) extra space beyond the copies themselves. The hashmap version (original → copy) is simpler and also O(n)." });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: { ...PTRC, c: "p-active", cp: "p-visit", copy_head: "p-visit" }, nullAt: "right", sx: 84, nw: 52, sy: 120 }),
  }));

  /* 11 ─ LRU cache: hashmap + doubly linked list with sentinels */
  Viz.register("linked-lists-lru", (el) => Viz.player(el, {
    title: "LRU cache: the hashmap finds the node, the doubly linked list orders by recency",
    tag: "DESIGN · O(1) PER OP",
    legend: [["path", "head / tail sentinels"], ["active", "touched node"], ["bad", "evicted"]],
    codeLang: "python",
    code: ["def get(self, key):", "    if key not in self.map: return -1", "    node = self.map[key]", "    self._unlink(node)", "    self._push_front(node)       # now most recent", "    return node.val", "def put(self, key, val):", "    if key in self.map:", "        self._unlink(self.map.pop(key))", "    node = self.map[key] = Node(key, val)", "    self._push_front(node)", "    if len(self.map) > self.cap:", "        lru = self.tail.prev     # least recent", "        self._unlink(lru)", "        del self.map[lru.key]"],
    inputs: [{ key: "cap", label: "capacity", value: "2", width: 50 }, { key: "ops", label: "operations", value: "put 1 10, put 2 20, get 1, put 3 30, get 2, put 4 40, get 1, get 3, get 4", width: 420 }],
    random: () => { const ops = []; for (let i = 0; i < 8; i++) ops.push(Math.random() < 0.55 ? `put ${Viz.rand(1, 4)} ${Viz.rand(1, 9) * 10}` : `get ${Viz.rand(1, 4)}`); return { cap: String(Viz.rand(2, 3)), ops: ops.join(", ") }; },
    build: (inp) => {
      const cap = Viz.parse.int(inp.cap, { min: 1, max: 5 });
      const ops = String(inp.ops).split(",").map((s) => s.trim()).filter(Boolean).map((s) => {
        const m = s.match(/^(put)\s+(-?\d+)\s+(-?\d+)$|^(get)\s+(-?\d+)$/i);
        if (!m) throw new Error(`Can't read "${s}". Use "put key value" or "get key".`);
        return m[1] ? { op: "put", k: +m[2], v: +m[3] } : { op: "get", k: +m[5] };
      });
      if (!ops.length || ops.length > 14) throw new Error("Give 1–14 operations.");
      const st = { nodes: [{ id: "H", val: "head", slot: 0, row: 0 }, { id: "T", val: "tail", slot: 1, row: 0 }], next: { H: "T", T: null }, prev: { H: null, T: "H" }, rand: null };
      const map = new Map(), out = [], fr = [];
      let uid = 0;
      const S = (x) => fr.push({ ...snapOf(st), map: [...map].map(([k, id]) => `${k} → ${valOf(st, id)}`), out: [...out], ...x, ncls: { H: "path", T: "path", ...(x.ncls || {}) } });
      const unlink = (id) => { const p = st.prev[id], n = st.next[id]; st.next[p] = n; st.prev[n] = p; relayout(st, "H"); };
      const pushFront = (id) => { const f = st.next.H; st.prev[id] = "H"; st.next[id] = f; st.prev[f] = id; st.next.H = id; relayout(st, "H"); };
      S({ line: [], vars: { cap, size: 0 }, note: "Two sentinels: head side = most recently used, tail side = least recently used. With sentinels every real node always has a prev and a next, so unlink and push_front never test for null." });
      for (const o of ops) {
        const tag = o.op === "get" ? `get(${o.k})` : `put(${o.k}, ${o.v})`;
        if (o.op === "get") {
          if (!map.has(o.k)) { out.push(-1); S({ line: [0, 1], vars: { op: tag, size: map.size }, note: `${tag}: key ${o.k} is not in the map. Return -1; nothing moves.` }); continue; }
          const id = map.get(o.k);
          S({ ptrs: { node: id }, ncls: { [id]: "active" }, line: [0, 2], vars: { op: tag, size: map.size }, note: `${tag}: the map jumps straight to node ${valOf(st, id)} in O(1); no list walk.` });
          unlink(id);
          S({ ptrs: { node: id }, ncls: { [id]: "active" }, line: 3, vars: { op: tag, size: map.size }, note: "Unlink it: its neighbours point at each other. The prev pointer is what makes this O(1); a singly linked list would need a walk to find the predecessor." });
          pushFront(id); out.push(+String(valOf(st, id)).split(":")[1]);
          S({ ptrs: { node: id }, ncls: { [id]: "active" }, line: [4, 5], vars: { op: tag, size: map.size }, note: `Push it right after head: it is now the most recently used. Return ${out[out.length - 1]}.` });
          continue;
        }
        if (map.has(o.k)) {
          const old = map.get(o.k);
          S({ ptrs: { old }, ncls: { [old]: "bad" }, line: [6, 7], vars: { op: tag, size: map.size }, note: `${tag}: key ${o.k} exists. Drop the old node; a fresh one goes to the front.` });
          map.delete(o.k); unlink(old); st.nodes = st.nodes.filter((n) => n.id !== old);
          S({ line: 8, vars: { op: tag, size: map.size }, note: "Old node unlinked and forgotten." });
        }
        const id = "k" + uid++;
        st.nodes.push({ id, val: `${o.k}:${o.v}`, slot: 0.5, row: 1 }); st.next[id] = null; st.prev[id] = null;
        map.set(o.k, id);
        S({ ptrs: { node: id }, ncls: { [id]: "active" }, line: 9, vars: { op: tag, size: map.size }, note: `${tag}: create node ${o.k}:${o.v} and record it in the map.` });
        pushFront(id);
        S({ ptrs: { node: id }, ncls: { [id]: "active" }, line: 10, vars: { op: tag, size: map.size }, note: "Four pointer writes splice it in after head." });
        if (map.size > cap) {
          const lru = st.prev.T;
          S({ ptrs: { lru }, ncls: { [lru]: "bad" }, line: [11, 12], vars: { op: tag, size: map.size }, note: `Size ${map.size} &gt; capacity ${cap}. The least recently used node is always tail.prev: <b>${valOf(st, lru)}</b>.` });
          unlink(lru);
          S({ ptrs: { lru }, ncls: { [lru]: "bad" }, line: 13, vars: { op: tag, size: map.size }, note: "Unlink it from the list…" });
          map.delete(+String(valOf(st, lru)).split(":")[0]); st.nodes = st.nodes.filter((n) => n.id !== lru);
          S({ line: 14, vars: { op: tag, size: map.size }, note: "…and delete its key from the map. This is why each node stores its <b>key</b> as well as its value." });
        }
      }
      S({ line: [], vars: { cap, size: map.size }, note: `Outputs of the get calls: [${out.join(", ")}]. Every operation did O(1) work: one hash lookup plus a constant number of pointer writes.` });
      return fr;
    },
    render: (f) => `<div class="ll-col">${llSvg(f, { ptrCls: { node: "p-active", old: "p-bad", lru: "p-bad" }, nw: 66, sx: 104, sy: 92 })}${Viz.row(chips("hashmap  key → node", f.map), chips("get() outputs", f.out.map(String), "done"))}</div>`,
  }));

  /* 12 ─ Intersection of two lists: switch heads at the end */
  Viz.register("linked-lists-intersection", (el) => Viz.player(el, {
    title: "Intersection of two lists: each pointer walks A then B, so both walk a + b + c",
    tag: "O(a + b) · O(1)",
    legend: [["active", "pa"], ["visit", "pb"], ["done", "shared tail"]],
    codeLang: "python",
    code: ["pa, pb = headA, headB", "while pa is not pb:", "    pa = pa.next if pa else headB", "    pb = pb.next if pb else headA", "return pa      # meeting node, or None"],
    inputs: [{ key: "a", label: "A's own part (0–5)", value: "4,1" }, { key: "b", label: "B's own part (0–5)", value: "5,6,1" }, { key: "c", label: "shared tail (0–4)", value: "8,4,5" }],
    random: () => ({ a: Viz.randInts(Viz.rand(0, 4), 1, 9).join(","), b: Viz.randInts(Viz.rand(1, 5), 1, 9).join(","), c: Viz.randInts(Viz.rand(0, 3), 1, 9).join(",") }),
    build: (inp) => {
      const A = parseList(inp.a, 0, 5), B = parseList(inp.b, 0, 5), C = parseList(inp.c, 0, 4);
      if (!A.length && !C.length && !B.length) throw new Error("Give at least one node.");
      const s0 = Math.max(A.length, B.length);
      const la = mkList(A, { prefix: "a", slot0: s0 - A.length }), lb = mkList(B, { prefix: "b", slot0: s0 - B.length, row: 2 }), lc = mkList(C, { prefix: "s", slot0: s0, row: 1 });
      const st = { nodes: [...la.nodes, ...lb.nodes, ...lc.nodes], next: { ...la.next, ...lb.next, ...lc.next }, prev: null, rand: null };
      const sh = C.length ? "s0" : null;
      if (A.length) st.next["a" + (A.length - 1)] = sh;
      if (B.length) st.next["b" + (B.length - 1)] = sh;
      const hA = A.length ? "a0" : sh, hB = B.length ? "b0" : sh;
      const fr = [], shared = Object.fromEntries(lc.nodes.map((n) => [n.id, "done"]));
      const S = (x) => fr.push({ ...snapOf(st), ...x, ncls: { ...shared, ...(x.ncls || {}) } });
      let pa = hA, pb = hB, steps = 0;
      const C2 = () => ({ ...(pa ? { [pa]: "active" } : {}), ...(pb ? { [pb]: "visit" } : {}) });
      const la_ = A.length + C.length, lb_ = B.length + C.length;
      S({ ptrs: { headA: hA, headB: hB }, line: [], vars: { "len A": la_, "len B": lb_ }, note: `A has ${A.length} own node(s), B has ${B.length}, and they share ${C.length}. Equal values are not enough: the question is about the same <b>node object</b>, and from the heads the code can't tell where the shared part starts.` });
      S({ ptrs: { pa, pb }, ncls: C2(), line: 0, vars: { steps }, note: "Idea: after its own list, each pointer continues on the <b>other</b> list. Both then walk A + B, so they arrive at the junction at the same moment." });
      while (pa !== pb && steps < 40) {
        const na = pa === null ? hB : st.next[pa], nb = pb === null ? hA : st.next[pb];
        const jumpA = pa === null, jumpB = pb === null;
        pa = na; pb = nb; steps++;
        S({ ptrs: { pa, pb }, ncls: C2(), line: [1, 2, 3], vars: { steps }, note: `${jumpA ? "pa was null, so it jumps to headB. " : ""}${jumpB ? "pb was null, so it jumps to headA. " : ""}pa = ${pa === null ? "null" : valOf(st, pa)}, pb = ${pb === null ? "null" : valOf(st, pb)}.${pa === pb ? "" : ""}` });
      }
      S({ ptrs: { pa, pb }, ncls: pa ? { [pa]: "bad" } : {}, line: 4, vars: { steps, "a+b+c": A.length + B.length + C.length }, note: pa === null ? `Both reached null together after ${steps} steps: <b>no intersection</b>. Null is the shared "node" at the end of both lists, which is why the loop always ends.` : `They meet at <b>${valOf(st, pa)}</b> after ${steps} steps. pa walked A's ${A.length} + shared ${C.length} + B's ${B.length}; pb walked the same total in the other order.` });
      return fr;
    },
    render: (f) => llSvg(f, { ptrCls: { ...PTRC, headA: "p-active", headB: "p-visit" }, nullAt: "right", nullRow: 1, sx: 78, sy: 96 }),
  }));
})();
