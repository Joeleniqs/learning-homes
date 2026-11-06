/* Visualizers for "Memory & Garbage Collection". Every registered name starts with "memory-and-gc-". */
(() => {
  const esc = Viz.esc;
  const pick = (a) => a[Viz.rand(0, a.length - 1)];
  const int = (s, name, lo, hi) => {
    const n = Number(String(s).trim());
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${name}: use a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const stats = (items) => `<div class="mg-stats">${items.map(([k, v, c]) => `<div class="mg-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>`;
  const chip = (txt, cls = "") => `<span class="mg-chip ${cls}">${esc(txt)}</span>`;
  const box = (title, sub, body, cls = "") => `<div class="mg-box ${cls}"><div class="mg-box-h"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div><div class="mg-box-b">${body}</div></div>`;
  const empty = (t = "empty") => `<span class="mg-mute">${esc(t)}</span>`;
  const setCode = (host, lines, lang) => {
    host.querySelectorAll(".viz-code li").forEach((li, k) => {
      const src = lines[k] ?? "";
      if (li.dataset.src === src) return;
      li.dataset.src = src;
      li.innerHTML = (window.LearningHome && window.LearningHome.highlight(src, lang)) ?? esc(src);
    });
  };
  const pad = (lines, n) => lines.concat(Array(Math.max(0, n - lines.length)).fill("")).slice(0, n);
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const clone = (x) => JSON.parse(JSON.stringify(x));
  const verdict = (txt, cls) => `<div class="mg-verdict ${cls}">${esc(txt)}</div>`;
  /* object graph input shared by mark-sweep, tri-colour and scavenge: "root>A A>B B>A" */
  function parseRefs(s, maxObj, letters) {
    const toks = String(s).split(/[\s,;]+/).filter(Boolean);
    if (!toks.length) throw new Error("Give at least one reference, for example: root>A A>B");
    if (toks.length > 24) throw new Error("Use at most 24 references so the picture stays readable.");
    const edges = [], objs = new Set();
    for (const t of toks) {
      const m = /^(root|[A-Z])>([A-Z])$/i.exec(t);
      if (!m) throw new Error(`"${t}" is not a reference. Write from>to, where from is root or a letter ${letters}, for example root>A or A>B.`);
      const u = m[1].toLowerCase() === "root" ? "root" : m[1].toUpperCase(), v = m[2].toUpperCase();
      if (!letters.includes(v) || (u !== "root" && !letters.includes(u))) throw new Error(`Objects are single letters ${letters[0]} to ${letters[letters.length - 1]}.`);
      if (!edges.some((e) => e.u === u && e.v === v)) edges.push({ u, v });
      if (u !== "root") objs.add(u);
      objs.add(v);
    }
    if (!edges.some((e) => e.u === "root")) throw new Error("At least one reference must start at root (a local variable or a static field).");
    if (objs.size > maxObj) throw new Error(`Use at most ${maxObj} objects.`);
    return { edges, objs: [...objs].sort() };
  }
  const reach = (edges, from = "root") => {
    const seen = new Set(), st = [from];
    while (st.length) { const x = st.pop(); for (const e of edges) if (e.u === x && !seen.has(e.v)) { seen.add(e.v); st.push(e.v); } }
    return seen;
  };

  /* =====================================================================
   * 1. Stack vs heap: where does this value actually live?
   * ===================================================================== */
  const SH_SCEN = ["C#: struct vs class", "C#: boxing", "C#: closure capture", "Go: escape analysis"];
  const shCode = (sc, v, w) => pad({
    "C#: struct vs class": [
      "struct PointS { public int X; }   // value type",
      "class  PointC { public int X; }   // reference type",
      "",
      `var s1 = new PointS { X = ${v} };`,
      "var s2 = s1;                // copies every field",
      `s2.X = ${w};`,
      `var c1 = new PointC { X = ${v} };`,
      "var c2 = c1;                // copies only the reference",
      `c2.X = ${w};`,
      "Console.WriteLine($\"{s1.X} {c1.X}\");",
    ],
    "C#: boxing": [
      `int n = ${v};`,
      "object o = n;              // box: copy n into a new heap object",
      `n = ${w};                  // changes the local, not the box`,
      "int back = (int)o;         // unbox: copy the value back out",
      "var list = new List<int>(4);",
      "list.Add(n);               // List<int>: stored inline, no box",
      "IComparable c = n;         // struct to interface: boxes again",
      "Console.WriteLine($\"{o} {back} {list[0]}\");",
      "// ArrayList, object parameters, string.Format(object)",
      "// and non-generic interfaces on structs all box.",
    ],
    "C#: closure capture": [
      "Func<int> MakeCounter(int start) {",
      "    int count = start;      // captured by the lambda below,",
      "    return () => ++count;   // so it is hoisted to the heap",
      "}",
      `var next = MakeCounter(${v});`,
      "next();",
      "next();",
      "Console.WriteLine(next());",
      "// the compiler turns 'count' into a field of a hidden",
      "// class <>c__DisplayClass0_0 { public int count; }",
    ],
    "Go: escape analysis": [
      "type User struct{ Name string; Age int }",
      "func sum(xs []int) int {",
      "    t := 0                    // stays in sum's frame",
      "    for _, x := range xs { t += x }",
      "    return t",
      "}",
      "func newUser(age int) *User {",
      "    u := User{Name: \"ada\", Age: age}",
      "    return &u                 // pointer outlives the frame",
      "}",
      `total := sum([]int{${v}, ${w}})   // in main()`,
      "p := newUser(" + v + "); fmt.Println(total, p.Age)",
    ],
  }[sc], 12);

  function shSteps(sc, v, w) {
    const top = (S) => S.frames[S.frames.length - 1];
    const slot = (S, n, val) => { const fr = top(S); const s = fr.slots.find((x) => x.n === n); if (s) { s.v = val; s.cls = "path"; } else fr.slots.push({ n, v: val, cls: "active" }); };
    const get = (S, n) => { for (const fr of S.frames) { const s = fr.slots.find((x) => x.n === n); if (s) return s.v; } return null; };
    const alloc = (S, type, f, size) => { const id = S.heap.length + 1; S.heap.push({ id, type, f, size, cls: "active" }); S.allocs++; S.bytes += size; return { ref: id }; };
    const obj = (S, id) => S.heap.find((o) => o.id === id);
    const setF = (S, id, k, val) => { const o = obj(S, id); o.f.find((x) => x[0] === k)[1] = val; o.cls = "path"; };
    const fld = (S, id, k) => obj(S, id).f.find((x) => x[0] === k)[1];
    const push = (S, fn) => S.frames.push({ fn, slots: [], cls: "active" });
    const pop = (S) => { const fr = S.frames.pop(); S.popped = fr; };
    if (sc === "C#: struct vs class") return [
      { line: 3, act: (S) => slot(S, "s1", { st: "PointS", f: { X: v } }), note: () => "A <b>struct</b> is stored inline: its 4-byte <code>X</code> sits directly in Main's stack frame. No heap allocation, nothing for the GC to track." },
      { line: 4, act: (S) => slot(S, "s2", clone(get(S, "s1"))), note: () => "Assigning a struct copies all of its bytes. <code>s2</code> is a separate value with its own storage." },
      { line: 5, act: (S) => { const x = get(S, "s2"); x.f.X = w; slot(S, "s2", x); }, note: (S) => `<code>s2.X</code> is now ${w}; <code>s1.X</code> is still <b>${get(S, "s1").f.X}</b>. They never shared memory, so there is nothing to alias.` },
      { line: 6, act: (S) => slot(S, "c1", alloc(S, "PointC", [["X", v]], 24)), note: () => "<code>new</code> on a <b>class</b> allocates on the managed heap: an 8-byte object header, an 8-byte method-table pointer, then the fields (24 bytes on x64 for one int). The stack slot holds only an 8-byte reference." },
      { line: 7, act: (S) => slot(S, "c2", { ref: get(S, "c1").ref }), note: () => "Copying a reference copies the 8-byte pointer, not the object. Both variables now point at the <b>same</b> object #1." },
      { line: 8, act: (S) => setF(S, get(S, "c2").ref, "X", w), note: () => `Writing through <code>c2</code> changes the one shared object, so <code>c1.X</code> is now ${w} too.` },
      { line: 9, act: (S) => { S.out = `${get(S, "s1").f.X} ${fld(S, get(S, "c1").ref, "X")}`; }, note: (S) => `Prints <b>${S.out}</b>: value semantics for the struct, reference semantics for the class. The struct cost no GC work at all; the class cost one heap allocation that the GC must later find dead.` },
    ];
    if (sc === "C#: boxing") return [
      { line: 0, act: (S) => slot(S, "n", v), note: () => "<code>int</code> is a value type: 4 bytes in the frame." },
      { line: 1, act: (S) => slot(S, "o", alloc(S, "Int32 (boxed)", [["value", get(S, "n")]], 24)), note: () => "<b>Boxing</b>: <code>object</code> is a reference type, so the runtime allocates a 24-byte heap object (header + method table + the int + padding) and <b>copies</b> the value in. The box is a snapshot." },
      { line: 2, act: (S) => slot(S, "n", w), note: (S) => `<code>n</code> is now ${w}, but the box still holds <b>${fld(S, get(S, "o").ref, "value")}</b>: the two are independent copies.` },
      { line: 3, act: (S) => slot(S, "back", fld(S, get(S, "o").ref, "value")), note: () => "<b>Unboxing</b> checks the type, then copies the value back out of the heap object into the frame." },
      { line: 4, act: (S) => { const arr = alloc(S, "Int32[4]", [["[0]", 0], ["[1]", 0], ["[2]", 0], ["[3]", 0]], 40); slot(S, "list", alloc(S, "List<int>", [["_items", arr], ["_size", 0]], 32)); }, note: () => "A <code>List&lt;int&gt;</code> is two heap objects: the list and its backing <code>int[]</code>. Generics over value types are specialised, so the array stores raw ints inline." },
      { line: 5, act: (S) => { const l = get(S, "list").ref, a = fld(S, l, "_items").ref; setF(S, a, "[0]", get(S, "n")); setF(S, l, "_size", 1); }, note: () => "No box: the int's 4 bytes are copied straight into the array slot. This is why generic collections replaced <code>ArrayList</code>." },
      { line: 6, act: (S) => slot(S, "c", alloc(S, "Int32 (boxed)", [["value", get(S, "n")]], 24)), note: () => "Converting a struct to an <b>interface</b> boxes again: an interface reference must point at a heap object that carries a method table. In hot code use a generic constraint (<code>where T : IComparable&lt;T&gt;</code>) so the JIT calls the method without boxing." },
      { line: 7, act: (S) => { const a = fld(S, get(S, "list").ref, "_items").ref; S.out = `${fld(S, get(S, "o").ref, "value")} ${get(S, "back")} ${fld(S, a, "[0]")}`; }, note: (S) => `Prints <b>${S.out}</b>. ${S.allocs} heap objects for a few ints: two of them were boxes you never wrote <code>new</code> for.` },
    ];
    if (sc === "C#: closure capture") return [
      { line: 4, act: (S) => { push(S, "MakeCounter"); slot(S, "start", v); }, note: () => "Calling <code>MakeCounter</code> pushes a new stack frame holding the parameter <code>start</code>." },
      { line: 1, act: (S) => { slot(S, "<>8__locals", alloc(S, "<>c__DisplayClass", [["count", get(S, "start")]], 24)); }, note: () => "Because a lambda <b>captures</b> <code>count</code>, the compiler cannot keep it in the frame (the frame dies on return). At method entry it allocates a hidden <b>display class</b> on the heap and <code>count</code> becomes its field. This allocation happens on every call." },
      { line: 2, act: (S) => { S.ret = alloc(S, "Func<int>", [["_target", { ref: 1 }], ["_method", "b__0"]], 64); }, note: () => "The lambda becomes a <b>delegate</b>, a second heap object whose target is the display class." },
      { line: 3, act: (S) => { pop(S); }, note: () => "MakeCounter returns and its frame is gone, yet <code>count</code> survives in object #1, reachable through the delegate. That is how closures outlive their method, and how a captured <code>this</code> can keep a whole page alive (a classic leak)." },
      { line: 4, act: (S) => { slot(S, "next", S.ret); }, note: () => "<code>next</code> in Main now references the delegate #2, which references #1." },
      { line: 5, act: (S) => setF(S, 1, "count", fld(S, 1, "count") + 1), note: (S) => `Invoking the delegate runs the lambda against its target: <code>count</code> in the heap object is now ${fld(S, 1, "count")}.` },
      { line: 6, act: (S) => setF(S, 1, "count", fld(S, 1, "count") + 1), note: (S) => `count = ${fld(S, 1, "count")}. Each call mutates the same captured variable, not a copy.` },
      { line: 7, act: (S) => { setF(S, 1, "count", fld(S, 1, "count") + 1); S.out = String(fld(S, 1, "count")); }, note: (S) => `Prints <b>${S.out}</b>. Two hidden allocations per <code>MakeCounter</code> call; in a hot loop, a <code>static</code> lambda (no capture) allocates nothing.` },
    ];
    return [
      { line: 10, act: (S) => { slot(S, "[2]int literal", { st: "[2]int", f: { 0: v, 1: w } }); push(S, "sum"); slot(S, "xs", "slice → main's array, len 2"); }, note: () => "Go decides stack or heap <b>at compile time</b> with escape analysis. The slice literal never leaves <code>sum</code>, so its backing array is placed in main's frame. <code>go build -gcflags=-m</code> reports <code>[]int{...} does not escape</code>." },
      { line: 2, act: (S) => slot(S, "t", 0), note: () => "<code>t</code> is a plain local in sum's frame." },
      { line: 3, act: (S) => { const a = get(S, "[2]int literal").f; slot(S, "t", a[0] + a[1]); }, note: (S) => `The loop adds both elements: t = ${get(S, "t")}. Still no heap allocation.` },
      { line: 4, act: (S) => { const t = get(S, "t"); pop(S); slot(S, "total", t); }, note: () => "Returning a value copies it into main; sum's frame is popped and everything in it is gone for free. Stack memory needs no GC." },
      { line: 7, act: (S) => { push(S, "newUser"); slot(S, "age", v); slot(S, "u", alloc(S, "User", [["Name", "\"ada\""], ["Age", get(S, "age")]], 32)); }, note: () => "Same syntax as a local, different storage: <code>&amp;u</code> is returned, so <code>u</code> must outlive this frame. The compiler prints <code>moved to heap: u</code> and allocates it on the GC heap instead." },
      { line: 8, act: (S) => { const r = get(S, "u"); pop(S); slot(S, "p", r); }, note: () => "newUser's frame is popped; the pointer in <code>p</code> keeps the heap User alive. The JVM does the reverse trick at JIT time: if an object provably does not escape, it can be scalar-replaced and never allocated." },
      { line: 11, act: (S) => { S.out = `${get(S, "total")} ${fld(S, get(S, "p").ref, "Age")}`; }, note: (S) => `Prints <b>${S.out}</b>. One heap allocation in the whole program, and it was the compiler's choice, not a keyword's.` },
    ];
  }
  const shVal = (v) => v && typeof v === "object" ? (v.ref !== undefined ? `<span class="mg-ref">→ #${v.ref}</span>` : `<span class="mg-inl">${esc(v.st)} { ${Object.entries(v.f).map(([k, x]) => `${esc(k)} = ${esc(x)}`).join(", ")} }</span>`) : `<span class="mg-val">${esc(v)}</span>`;
  Viz.register("memory-and-gc-stackheap", (host) => Viz.player(host, {
    title: "Stack or heap? Follow every value as the program runs",
    tag: "VALUE vs REFERENCE · ESCAPE",
    legend: [["active", "just created"], ["path", "just changed"], ["dim", "popped frame"]],
    speed: 1500,
    codeLang: "csharp",
    code: shCode(SH_SCEN[0], 1, 99),
    inputs: [
      { key: "sc", label: "program", type: "select", options: SH_SCEN, value: SH_SCEN[0] },
      { key: "v", label: "first value", value: "1", width: 60 },
      { key: "w", label: "second value", value: "99", width: 60 },
    ],
    random: () => ({ sc: pick(SH_SCEN), v: String(Viz.rand(0, 50)), w: String(Viz.rand(51, 99)) }),
    build: ({ sc, v, w }) => {
      const V = int(v, "first value", 0, 999), W = int(w, "second value", 0, 999);
      const S = { frames: [{ fn: sc.startsWith("Go") ? "main" : "Main", slots: [], cls: "" }], heap: [], out: "", allocs: 0, bytes: 0, popped: null };
      const code = shCode(sc, V, W), lang = sc.startsWith("Go") ? "go" : "csharp";
      const fr = [];
      const snap = (line, note) => fr.push({ code, lang, line, note, st: clone(S), vars: { frames: S.frames.length, "heap objects": S.heap.length, "heap bytes": S.bytes, output: S.out || "–" } });
      snap(null, "The program starts with one empty stack frame. Watch which values stay in a frame (freed instantly on return, never seen by the GC) and which go to the heap (tracked and later collected).");
      for (const st of shSteps(sc, V, W)) {
        S.popped = null;
        for (const f of S.frames) { f.cls = ""; for (const s of f.slots) s.cls = ""; }
        for (const o of S.heap) o.cls = "";
        st.act(S);
        snap(st.line, st.note(S));
      }
      return fr;
    },
    render: (f) => {
      setCode(host, f.code, f.lang);
      const S = f.st;
      const frames = [...S.frames].reverse().map((fr, i) => box(`${esc(fr.fn)}()`, i === 0 ? "top frame" : "caller", `<div class="mg-slots">${fr.slots.map((s) => `<div class="mg-slot ${s.cls}"><span>${esc(s.n)}</span>${shVal(s.v)}</div>`).join("") || empty("no locals yet")}</div>`, "mg-frame"));
      if (S.popped) frames.unshift(box(`${esc(S.popped.fn)}()`, "popped: memory reused", `<div class="mg-slots">${S.popped.slots.map((s) => `<div class="mg-slot"><span>${esc(s.n)}</span>${shVal(s.v)}</div>`).join("")}</div>`, "mg-frame dim"));
      const heap = S.heap.map((o) => `<div class="mg-obj ${o.cls}"><div class="mg-obj-h"><b>#${o.id}</b> ${esc(o.type)}<small>${o.size} B</small></div><div class="mg-hdr"><i>header</i><i>method table</i></div>${o.f.map(([k, x]) => `<div class="mg-slot"><span>${esc(k)}</span>${shVal(x)}</div>`).join("")}</div>`).join("");
      return `<div class="mg-sh"><div>${Viz.labeled("stack (one frame per call, top first)", `<div class="mg-col">${frames.join("")}</div>`)}</div><div>${Viz.labeled("managed heap (GC tracked)", `<div class="mg-heap">${heap || empty("nothing allocated")}</div>`)}</div></div>${S.out ? `<div class="mg-console"><small>output</small><b>${esc(S.out)}</b></div>` : ""}`;
    },
  }));

  /* =====================================================================
   * 2. Mark, sweep, compact: reachability from the roots
   * ===================================================================== */
  const MK_LET = "ABCDEFGHIJKL";
  const mkSize = (c) => 1 + (c.charCodeAt(0) % 3);
  Viz.register("memory-and-gc-mark", (host) => Viz.player(host, {
    title: "Mark from the roots, sweep the rest, then compact",
    tag: "TRACING GC · MARK-SWEEP-COMPACT",
    legend: [["active", "being scanned"], ["visit", "on the mark stack"], ["done", "marked live"], ["bad", "garbage (freed)"], ["path", "moved by compaction"]],
    speed: 1100,
    codeLang: "csharp",
    code: [
      "void Collect(bool compact) {",
      "    var stack = new Stack<Obj>(Roots);   // 1. mark from the roots",
      "    while (stack.TryPop(out var o)) {",
      "        if (o.Marked) continue;          // cycles end here",
      "        o.Marked = true;",
      "        foreach (var child in o.Refs)",
      "            if (!child.Marked) stack.Push(child);",
      "    }",
      "    foreach (var o in Heap.InAddressOrder)  // 2. sweep",
      "        if (o.Marked) o.Marked = false; else Free(o);",
      "    if (compact) SlideLiveObjectsDown();  // 3. compact",
      "}",
    ],
    inputs: [
      { key: "refs", label: "references (from>to; root = stack + statics)", value: "root>A A>B B>C C>A root>D D>F E>G G>E H>D I>I", width: 330 },
      { key: "mode", label: "collector", type: "select", options: ["mark-sweep", "mark-sweep-compact"], value: "mark-sweep-compact" },
    ],
    random: () => {
      const n = Viz.rand(6, 10), L = MK_LET.slice(0, n).split(""), es = new Set();
      es.add(`root>${pick(L)}`); es.add(`root>${pick(L)}`);
      for (let k = 0; k < n + 2; k++) es.add(`${pick(L)}>${pick(L)}`);
      return { refs: [...es].join(" "), mode: pick(["mark-sweep", "mark-sweep-compact"]) };
    },
    build: ({ refs, mode }) => {
      const { edges, objs } = parseRefs(refs, 12, MK_LET);
      const compact = mode === "mark-sweep-compact";
      const live = reach(edges);
      let addr = 0;
      const heap = objs.map((id) => { const o = { id, at: addr, size: mkSize(id) }; addr += o.size; return o; });
      const SIZE = addr;
      const st = Object.fromEntries(objs.map((o) => [o, ""]));
      const marked = new Set(), freed = new Set();
      let stack = [], cur = null, moved = new Set(), fwd = null;
      const fr = [];
      const holes = () => { const used = Array(SIZE).fill(false); for (const o of heap) if (!freed.has(o.id)) for (let k = 0; k < o.size; k++) used[o.at + k] = true; let best = 0, run = 0, tot = 0; for (const u of used) { if (u) run = 0; else { run++; tot++; best = Math.max(best, run); } } return { best, tot }; };
      const snap = (line, note, phase) => { const h = holes(); fr.push({ line, note, phase, st: { ...st }, stack: [...stack], cur, heap: clone(heap), freed: [...freed], moved: [...moved], fwd: fwd && { ...fwd }, edges, objs, SIZE, h,
        vars: { phase, "mark stack": stack.join(" ") || "–", marked: marked.size, freed: freed.size, "free words": h.tot, "largest hole": h.best } }); };
      snap(null, `${objs.length} objects sit on the heap in allocation order. The GC does not know which are garbage: it only knows the <b>roots</b> (locals on every thread's stack, static fields, GC handles). Anything it cannot reach from a root is garbage, even if other garbage still points at it.`, "idle");
      const rootKids = edges.filter((e) => e.u === "root").map((e) => e.v);
      stack = [...rootKids].reverse();
      for (const k of rootKids) st[k] = "visit";
      snap(1, `Stop the world, then push every object a root points at: ${rootKids.join(", ")}. The mark phase is a plain graph traversal (depth-first here; the order does not matter).`, "mark");
      while (stack.length) {
        const o = stack.pop(); cur = o;
        if (marked.has(o)) { snap(3, `${o} is already marked: we reached it a second time through another path${edges.some((e) => e.u === o && reach(edges, o).has(o)) ? " (it is part of a cycle)" : ""}. The mark bit is what stops a cycle from looping forever.`, "mark"); continue; }
        marked.add(o); st[o] = "active";
        const kids = edges.filter((e) => e.u === o && e.v !== o).map((e) => e.v), push = kids.filter((k) => !marked.has(k));
        for (const k of [...push].reverse()) { stack.push(k); if (st[k] !== "done") st[k] = "visit"; }
        snap(push.length ? 6 : 4, `Mark ${o} live. ${kids.length ? `It references ${kids.join(", ")}; ${push.length ? `push the unmarked ${push.join(", ")}` : "all of them are already marked"}.` : "It holds no references."}`, "mark");
        st[o] = "done";
      }
      cur = null;
      const garbage = objs.filter((o) => !marked.has(o));
      snap(7, `Mark phase done: ${marked.size} live, ${garbage.length} unreachable${garbage.length ? ` (${garbage.join(", ")})` : ""}. ${garbage.some((g) => edges.some((e) => e.u === g && garbage.includes(e.v))) ? "Notice the unreachable objects that still point at each other: a tracing GC frees whole cycles, which reference counting alone cannot." : ""} The cost of marking is proportional to <b>live</b> objects, not garbage.`, "mark");
      for (const o of heap) {
        if (marked.has(o.id)) { st[o.id] = "done"; cur = o.id; snap(9, `Sweep walks the heap in address order. ${o.id} at word ${o.at} is marked: keep it and clear its mark bit for the next cycle.`, "sweep"); }
        else { freed.add(o.id); st[o.id] = "bad"; cur = o.id; snap(9, `${o.id} at word ${o.at} is unmarked: its ${o.size} word${o.size > 1 ? "s go" : " goes"} back on the free list. Sweeping touches every object, live or dead.`, "sweep"); }
      }
      cur = null;
      const h1 = holes();
      snap(9, `Sweep done. ${h1.tot} words are free, but the largest contiguous hole is only <b>${h1.best}</b>. A request for a ${h1.best + 1}-word object would fail (or grow the heap) even though there is enough free memory in total: <b>fragmentation</b>.`, "sweep");
      if (compact) {
        let to = 0; fwd = {};
        for (const o of heap) if (!freed.has(o.id)) { fwd[o.id] = `${o.at}→${to}`; if (o.at !== to) moved.add(o.id); o.newAt = to; to += o.size; }
        snap(10, `Compaction computes a forwarding address for every survivor (slide everything down): ${Object.entries(fwd).map(([k, v]) => `${k} ${v}`).join(", ")}.`, "compact");
        for (const o of heap) if (!freed.has(o.id)) { o.at = o.newAt; delete o.newAt; }
        for (const m of moved) st[m] = "path";
        const h2 = holes();
        snap(10, `Survivors are copied down and every reference to a moved object (${moved.size ? [...moved].join(", ") : "none moved"}) is rewritten, including the roots. Now there is one hole of ${h2.best} words and allocation is a simple pointer bump again. This is why .NET and the JVM move your objects, and why native code must pin them.`, "compact");
      }
      fr.push({ ...fr[fr.length - 1], line: null, cur: null, final: { live: marked.size, freed: freed.size, ok: [...live].every((x) => marked.has(x)) && marked.size === live.size },
        note: `Result: kept ${marked.size}, freed ${freed.size}. ${compact ? "Compacting costs extra copying during the pause but leaves no fragmentation." : "Mark-sweep without compaction is cheaper per cycle (Go does this) but relies on size-class allocators to live with the holes."}` });
      return fr;
    },
    render: (f) => {
      const R = f.objs.length > 8 ? 135 : 115;
      const pos = Viz.layout.circle(f.objs, R);
      const nodes = [{ id: "root", x: 0, y: 0, label: "root", cls: "" }].concat(pos.map((p) => ({ ...p, label: p.id, sub: `${mkSize(p.id)}w`, cls: f.cur === p.id ? "active" : (f.st[p.id] === "bad" ? "bad" : f.st[p.id] === "done" && f.phase === "compact" && f.moved.includes(p.id) ? "path" : f.st[p.id] || "") })));
      const g = Viz.graph({ nodes, edges: f.edges.filter((e) => e.u !== e.v).map((e) => ({ ...e, cls: f.freed.includes(e.u) ? "dim" : "" })) }, { directed: true, r: 18, label: "object graph" });
      const cells = [];
      for (const o of [...f.heap].sort((a, b) => a.at - b.at)) {
        if (f.freed.includes(o.id) && f.phase === "compact") continue;
        cells.push({ at: o.at, size: o.size, id: o.id, cls: f.freed.includes(o.id) ? "bad" : f.moved.includes(o.id) && f.phase === "compact" ? "path" : f.cur === o.id ? "active" : f.st[o.id] === "done" ? "done" : "" });
      }
      let strip = "", at = 0;
      for (const c of cells.sort((a, b) => a.at - b.at)) { if (c.at > at) strip += `<div class="mg-cell free" style="flex:${c.at - at}">free</div>`; strip += `<div class="mg-cell ${c.cls}" style="flex:${c.size}">${c.cls === "bad" ? "<s>" + c.id + "</s>" : c.id}</div>`; at = c.at + c.size; }
      if (at < f.SIZE) strip += `<div class="mg-cell free" style="flex:${f.SIZE - at}">free</div>`;
      const ms = `<div class="mg-q">${f.stack.map((x) => chip(x, "visit")).join("") || empty("mark stack empty")}</div>`;
      const fin = f.final ? verdict(`${f.final.live} live · ${f.final.freed} freed · largest hole ${f.h.best}w`, "done") : "";
      return `<div class="mg-mark"><div>${g}</div><div class="mg-side">${Viz.labeled("mark stack (top at right)", ms)}${stats([["phase", f.phase, "path"], ["free words", f.h.tot], ["largest hole", f.h.best, f.h.best < f.h.tot ? "bad" : "done"]])}</div></div>${Viz.labeled(`heap, ${f.SIZE} words in address order`, `<div class="mg-strip">${strip}</div>`)}${fin}`;
    },
  }));

  /* =====================================================================
   * 3. .NET generations: gen0, gen1, gen2 and the Large Object Heap
   * ===================================================================== */
  const GW = ["request-scoped objects (die young)", "mid-life crisis (live a few seconds)", "growing static cache", "100 KB buffers per request (LOH)"];
  const GCODE = {
    [GW[0]]: ["app.MapGet(\"/order/{id}\", (int id) => {", "    var dto  = new OrderDto(id);          // dies with the request", "    var json = JsonSerializer.Serialize(dto);", "    return Results.Text(json);            // garbage after the response", "});", "// The generational hypothesis: most objects die young."],
    [GW[1]]: ["var pending = new ConcurrentDictionary<int, Order>();", "void OnOrder(Order o) {", "    pending[o.Id] = o;              // survives a gen0 GC, promoted", "    _ = Task.Delay(5000).ContinueWith(_ => pending.TryRemove(o.Id, out _));", "}                                   // then dies in gen1/gen2", "// Objects that live 'a little while' are the worst case."],
    [GW[2]]: ["static readonly Dictionary<string, Product> Cache = new();", "Product Get(string sku) {", "    if (!Cache.TryGetValue(sku, out var p))", "        Cache[sku] = p = db.Load(sku);   // a static root: forever", "    return p;", "}   // everything is promoted to gen2 and never freed"],
    [GW[3]]: ["app.MapPost(\"/upload\", async (HttpRequest req) => {", "    var buf = new byte[100_000];       // ≥ 85,000 B: Large Object Heap", "    await req.Body.ReadExactlyAsync(buf);", "    return Results.Ok(Checksum(buf));", "});  // dead at once, but the LOH is only swept by a gen2 GC", "// fix: ArrayPool<byte>.Shared.Rent(100_000) ... Return(buf)"],
  };
  Viz.register("memory-and-gc-generational", (host) => Viz.player(host, {
    title: ".NET generational GC: who gets promoted, and what each GC costs",
    tag: "GEN0 · GEN1 · GEN2 · LOH",
    legend: [["active", "just allocated"], ["bad", "dead (not yet collected)"], ["path", "promoted by this GC"], ["done", "survived a gen2 GC"], ["warn", "condemned generation"]],
    speed: 700,
    codeLang: "csharp",
    code: GCODE[GW[0]],
    inputs: [
      { key: "wl", label: "workload", type: "select", options: GW, value: GW[0] },
      { key: "b0", label: "gen0 budget (objects)", value: "6", width: 60 },
      { key: "n", label: "allocations", value: "30", width: 60 },
    ],
    random: () => ({ wl: pick(GW), b0: String(Viz.rand(4, 9)), n: String(Viz.rand(14, 40)) }),
    build: ({ wl, b0, n }) => {
      const B0 = int(b0, "gen0 budget", 3, 10), N = int(n, "allocations", 8, 48), wi = GW.indexOf(wl);
      const rnd = mulberry(17 + B0 * 31 + N + wi * 7);
      const life = () => {
        const r = rnd();
        if (wi === 0) return r < 0.88 ? 1 + Math.floor(rnd() * 3) : Infinity;
        if (wi === 1) return B0 + 2 + Math.floor(rnd() * B0 * 3);
        if (wi === 2) return r < 0.7 ? Infinity : 1 + Math.floor(rnd() * 2);
        return 1 + Math.floor(rnd() * 2);
      };
      const B1 = B0, B2init = B0 * 2, LB = 4;
      let B2 = B2init, t = 0, id = 0;
      const gen = [[], [], [], []]; // 0,1,2,LOH
      const cnt = { g0: 0, g1: 0, g2: 0, copied: 0, freed: 0, alloc: 0, bytes: 0, maxPause: 0 };
      const dead = (o) => t >= o.die;
      const fr = [];
      const snap = (line, note, extra = {}) => fr.push({ wi, line, note, t, B0, B1, B2, LB, gen: gen.map((g) => g.map((o) => ({ id: o.id, die: o.die, cls: o.cls, big: o.big, dead: dead(o) }))), cnt: { ...cnt }, ...extra,
        vars: { tick: t, gen0: `${gen[0].length}/${B0}`, gen1: gen[1].length, gen2: gen[2].length, LOH: gen[3].length, "GCs g0/g1/g2": `${cnt.g0}/${cnt.g1}/${cnt.g2}`, "objects copied": cnt.copied } });
      const clr = () => gen.forEach((g) => g.forEach((o) => { if (o.cls !== "done") o.cls = ""; }));
      snap(null, "Each tick a request allocates. New objects go into <b>gen0</b>. When gen0's budget is used up, a gen0 GC runs: it only marks gen0 (plus anything older that points into it, found through the card table), so it is cheap when most of gen0 is already dead.");
      const collect = () => {
        let g = 0;
        if (gen[1].length >= B1) g = 1;
        if (g === 1 && gen[2].length + gen[1].filter((o) => !dead(o)).length >= B2) g = 2;
        if (gen[3].length >= LB) g = 2;
        const why = g === 2 ? (gen[3].length >= LB ? `the LOH has ${gen[3].length} buffers (its budget is ${LB}), and the LOH is only collected with gen2` : `gen2 would exceed its budget of ${B2}`) : g === 1 ? `gen1 is at its budget (${gen[1].length}/${B1})` : "gen0 is full";
        snap(null, `<b>Gen${g} GC #${cnt.g0 + cnt.g1 + cnt.g2 + 1}</b> triggered: ${why}. A gen${g} GC condemns gen0${g >= 1 ? " and gen1" : ""}${g === 2 ? ", gen2 and the LOH (a full, blocking-or-background collection)" : ""}. Dead objects are shown struck through.`, { condemned: g });
        let copied = 0, freed = 0;
        const sweep = (k) => { const keep = []; for (const o of gen[k]) { if (dead(o)) freed++; else keep.push(o); } gen[k] = keep; };
        if (g === 2) { for (const k of [2, 3]) sweep(k); gen[2].forEach((o) => { o.cls = "done"; }); copied += gen[2].length; }
        if (g >= 1) { sweep(1); for (const o of gen[1]) { o.cls = "path"; gen[2].push(o); copied++; } gen[1] = []; }
        sweep(0); for (const o of gen[0]) { o.cls = "path"; gen[1].push(o); copied++; } gen[0] = [];
        if (g === 2) B2 = Math.max(B2init, gen[2].length * 2);
        cnt[`g${g}`]++; cnt.copied += copied; cnt.freed += freed; cnt.maxPause = Math.max(cnt.maxPause, copied);
        snap(null, `Gen${g} GC done: freed ${freed} dead object${freed !== 1 ? "s" : ""} for free (dead objects cost nothing to collect) and copied ${copied} survivor${copied !== 1 ? "s" : ""} up a generation${g === 2 ? `; gen2 survivors are compacted in place and its budget becomes ${B2}` : ""}. <b>Pause work is proportional to survivors</b>, so ${copied <= 1 ? "this was nearly free" : copied >= B0 ? "this one was expensive" : "this one cost a little"}.`, { condemned: g, after: true });
        clr();
      };
      for (let k = 0; k < N; k++) {
        t++;
        if (gen[0].length >= B0) collect();
        const o = { id: ++id, die: t + life(), cls: "active" };
        let line = 1;
        if (wi === 3 && k % 2 === 1) { o.big = true; gen[3].push(o); cnt.bytes += 100000; line = 1; }
        else { gen[0].push(o); cnt.bytes += 64; line = wi === 1 ? 2 : wi === 2 ? 3 : 1; }
        cnt.alloc++;
        const ln = Number.isFinite(o.die) ? `dies at tick ${o.die}` : "lives forever (rooted by a static)";
        snap(line, `Tick ${t}: allocate o${o.id}${o.big ? " (a 100,000-byte buffer, straight into the <b>LOH</b>, which is logically part of gen2)" : " in gen0 (a bump of the allocation pointer, a few nanoseconds)"}; it ${ln}.`);
        clr();
      }
      const liveNow = gen.flat().filter((o) => !dead(o)).length;
      fr.push({ ...fr[fr.length - 1], line: null, final: true, note: `${cnt.alloc} allocations caused ${cnt.g0} gen0, ${cnt.g1} gen1 and ${cnt.g2} gen2 GCs and ${cnt.copied} object copies. ${[
        "Healthy: almost everything died in gen0, so GCs were cheap and gen2 stayed small. This is the shape the GC is tuned for.",
        "Mid-life crisis: objects survived gen0, got copied (twice), then died in gen1 or gen2 where collection is expensive. Either make them die sooner or keep them for good (pool them).",
        "A growing cache is promoted all the way to gen2 and every full GC must mark it again. Bound the cache (size limit, expiry) and measure gen2 size.",
        "The buffers died instantly but stayed in the LOH until a gen2 GC, so the small LOH budget forced full GCs. Pool large buffers with ArrayPool instead.",
      ][wi]} ${liveNow} objects are live at the end.` });
      return fr;
    },
    render: (f) => {
      setCode(host, GCODE[GW[f.wi]], "csharp");
      const ochip = (o) => `<span class="mg-chip ${o.dead ? "dead" : o.cls}${o.big ? " big" : ""}" title="${Number.isFinite(o.die) ? `dies at tick ${o.die}` : "never dies (rooted by a static)"}">${o.dead ? `<s>o${o.id}</s>` : `o${o.id}`}<small>${o.dead ? "dead" : Number.isFinite(o.die) ? `${o.die - f.t}t` : "∞"}</small></span>`;
      const lane = (k, name, sub, budget) => {
        const g = f.gen[k], cond = f.condemned !== undefined && !f.after && (k <= f.condemned || (k === 3 && f.condemned === 2));
        const slots = budget ? Array.from({ length: Math.max(0, budget - g.length) }, () => '<span class="mg-chip slot"></span>').join("") : "";
        return `<div class="mg-lane ${cond ? "warn" : ""}"><div class="mg-lane-h"><b>${name}</b><small>${sub}</small></div><div class="mg-lane-b">${g.map(ochip).join("")}${slots || (g.length ? "" : empty())}</div></div>`;
      };
      return `<div class="mg-gens">${lane(0, "gen0", `budget ${f.B0} · collected often`, f.B0)}${lane(1, "gen1", `buffer between young and old · budget ${f.B1}`)}${lane(2, "gen2", `long-lived · budget ${f.B2}`)}${lane(3, "LOH", `objects ≥ 85,000 B · swept with gen2 · budget ${f.LB}`)}</div>${stats([["gen0 GCs", f.cnt.g0], ["gen1 GCs", f.cnt.g1, f.cnt.g1 ? "path" : ""], ["gen2 GCs", f.cnt.g2, f.cnt.g2 ? "bad" : "done"], ["objects copied", f.cnt.copied], ["largest pause (copies)", f.cnt.maxPause]])}`;
    },
  }));

  /* =====================================================================
   * 4. Go: concurrent tri-colour marking and the write barrier
   * ===================================================================== */
  const TC_LET = "ABCDEFGH";
  const TC_B = ["no write barrier", "insertion barrier (Dijkstra)", "deletion barrier (Yuasa)", "hybrid barrier (Go since 1.8)"];
  const tcCode = (bi) => [
    "// GC worker: concurrent mark, about 25% of the CPU",
    "for len(grey) > 0 {",
    "    obj := grey.pop()",
    "    for _, p := range obj.pointers { shade(p) } // white → grey",
    "    obj.color = black",
    "}",
    "// your goroutines keep writing pointers meanwhile:",
    "func writePointer(slot *unsafe.Pointer, ptr unsafe.Pointer) {",
    bi === 2 || bi === 3 ? "    shade(*slot)   // deletion barrier: grey the old target" : "    // (no deletion barrier)",
    bi === 1 || bi === 3 ? "    shade(ptr)     // insertion barrier: grey the new target" : "    // (no insertion barrier)",
    "    *slot = ptr",
    "}",
  ];
  Viz.register("memory-and-gc-tricolor", (host) => Viz.player(host, {
    title: "Concurrent marking: why Go needs a write barrier",
    tag: "TRI-COLOUR MARK · WRITE BARRIER",
    legend: [["dim", "white: not reached yet"], ["visit", "grey: reached, children not scanned"], ["done", "black: scanned"], ["active", "being scanned / written"], ["bad", "live object about to be freed"]],
    speed: 1200,
    codeLang: "go",
    code: tcCode(0),
    inputs: [
      { key: "refs", label: "heap at GC start", value: "root>A root>B B>C A>D", width: 200 },
      { key: "ops", label: "mutator writes (X+Y add, X-Y delete)", value: "A+C B-C", width: 150 },
      { key: "sched", label: "interleaving (G = GC step, M = write)", value: "GMMGGG", width: 120 },
      { key: "bar", label: "barrier", type: "select", options: TC_B, value: TC_B[0] },
    ],
    random: () => {
      const L = TC_LET.slice(0, Viz.rand(4, 6)).split(""), es = new Set([`root>${L[0]}`, `root>${L[1]}`]);
      for (let k = 0; k < L.length; k++) es.add(`${pick(L)}>${pick(L)}`);
      const ops = Array.from({ length: Viz.rand(1, 4) }, () => `${pick(L)}${pick(["+", "-"])}${pick(L.concat(["G", "H"]))}`);
      return { refs: [...es].join(" "), ops: ops.join(" "), sched: Array.from({ length: Viz.rand(3, 9) }, () => pick(["G", "M"])).join(""), bar: pick(TC_B) };
    },
    build: ({ refs, ops, sched, bar }) => {
      const { edges: e0, objs } = parseRefs(refs, 8, TC_LET);
      const bi = TC_B.indexOf(bar);
      const OPS = String(ops).split(/[\s,;]+/).filter(Boolean).map((t) => {
        const m = /^([A-H])([+-])([A-H])$/i.exec(t);
        if (!m) throw new Error(`"${t}" is not a write. Use X+Y (store a pointer to Y in X) or X-Y (clear X's pointer to Y), letters A to H.`);
        return { x: m[1].toUpperCase(), op: m[2], y: m[3].toUpperCase() };
      });
      if (OPS.length > 6) throw new Error("Use at most 6 mutator writes.");
      const S = String(sched).toUpperCase().replace(/[\s,]/g, "");
      if (!/^[GM]{0,20}$/.test(S)) throw new Error("The interleaving is a string of G and M (up to 20), for example GMMGG.");
      let edges = e0.map((e) => ({ ...e }));
      const all = [...new Set(objs.concat(OPS.filter((o) => o.op === "+").map((o) => o.y)))].sort();
      const col = Object.fromEntries(all.map((o) => [o, objs.includes(o) ? "white" : "none"]));
      const grey = [];
      let hot = null, hotEdge = null, oi = 0, si = 0, done = false;
      const fr = [];
      const shade = (o) => { if (col[o] === "white") { col[o] = "grey"; grey.push(o); return true; } return false; };
      const snap = (line, note, extra = {}) => fr.push({ bi, line, note, col: { ...col }, grey: [...grey], edges: edges.map((e) => ({ ...e })), hot, hotEdge, all, e0, oi, OPS, ...extra,
        vars: { grey: grey.join(" ") || "–", black: all.filter((o) => col[o] === "black").join(" ") || "–", white: all.filter((o) => col[o] === "white").join(" ") || "–", "writes done": `${oi}/${OPS.length}` } });
      snap(null, "All objects start <b>white</b>. Go's collector marks <b>while your goroutines keep running</b> (no long stop-the-world). Invariant it must keep: at the end, every reachable object is black. Danger: a black (finished) object gaining the only pointer to a white one.");
      for (const e of edges) if (e.u === "root") shade(e.v);
      snap(null, `Short stop-the-world: turn on the write barrier (if any) and grey everything the roots point at (${grey.join(", ")}). From here on, marking and the mutator interleave.`);
      const gcStep = () => {
        if (!grey.length) { done = true; return; }
        const o = grey.shift(); hot = o; hotEdge = null;
        const kids = edges.filter((e) => e.u === o).map((e) => e.v), newly = kids.filter((k) => shade(k));
        col[o] = "black";
        snap([2, 3, 4], `GC: scan ${o}. ${kids.length ? `It points to ${kids.join(", ")}; ${newly.length ? `grey ${newly.join(", ")}` : "none are white"}.` : "No pointers."} ${o} is now <b>black</b>: the GC will never look at it again this cycle.`);
      };
      const mStep = () => {
        const w = OPS[oi++];
        const R = reach(edges);
        hot = w.x; hotEdge = null;
        if (!R.has(w.x)) { snap(null, `Mutator: skip ${w.x}${w.op}${w.y}: no goroutine can reach ${w.x} any more, so it cannot write into it.`); return; }
        if (w.op === "+") {
          if (edges.some((e) => e.u === w.x && e.v === w.y)) { snap(null, `Mutator: ${w.x} already points to ${w.y}; nothing changes.`); return; }
          const fresh = col[w.y] === "none";
          if (!fresh && !R.has(w.y)) { snap(null, `Mutator: skip ${w.x}+${w.y}: the program has no path to ${w.y}, so it cannot obtain a pointer to it.`); return; }
          let msg = "";
          if (fresh) { col[w.y] = "black"; msg = `${w.y} is a <b>new</b> object: during marking Go allocates it already black, so it survives this cycle. `; }
          const sh = (bi === 1 || bi === 3) && shade(w.y);
          edges.push({ u: w.x, v: w.y }); hotEdge = `${w.x}-${w.y}`;
          const danger = col[w.x] === "black" && col[w.y] === "white";
          snap(bi === 1 || bi === 3 ? [9, 10] : 10, `Mutator: store a pointer to ${w.y} in ${w.x}. ${msg}${sh ? `The insertion barrier greys ${w.y}, so the GC will still scan it.` : danger ? `<b>${w.x} is black and ${w.y} is white</b>: the GC has finished with ${w.x} and will not see this pointer.${bi === 2 ? ` The deletion barrier ignores stores; it protects ${w.y} only if someone deletes a path to it.` : ""}` : `${w.x} is ${col[w.x]}, so ${col[w.x] === "black" ? "this is safe only because " + w.y + " is not white" : "the GC will still scan " + w.x + " and find " + w.y}.`}`);
        } else {
          if (!edges.some((e) => e.u === w.x && e.v === w.y)) { snap(null, `Mutator: ${w.x} has no pointer to ${w.y}; nothing to clear.`); return; }
          const sh = (bi === 2 || bi === 3) && shade(w.y);
          edges = edges.filter((e) => !(e.u === w.x && e.v === w.y));
          const stillRefd = reach(edges).has(w.y);
          snap(bi === 2 || bi === 3 ? [8, 10] : 10, `Mutator: clear ${w.x}'s pointer to ${w.y}. ${sh ? `The deletion barrier greys the old target ${w.y} first: whatever was reachable when marking began stays marked (a snapshot), even if it just became garbage.` : col[w.y] === "white" && stillRefd ? `<b>${w.y} is white and its only grey path is gone.</b> It is still reachable, but only through black objects the GC has already finished.` : `${w.y} is ${col[w.y]}.`}`);
        }
      };
      while (!done) {
        if (fr.length > 80) throw new Error("Too many steps.");
        let c = si < S.length ? S[si++] : (oi < OPS.length && fr.length % 2 ? "M" : "G");
        if (c === "M" && oi >= OPS.length) c = "G";
        if (c === "M") mStep(); else gcStep();
      }
      hot = null; hotEdge = null;
      const R = reach(edges);
      const lost = all.filter((o) => col[o] === "white" && R.has(o));
      const garbage = all.filter((o) => col[o] === "white" && !R.has(o));
      snap(null, `Grey set empty: <b>mark termination</b> (a short stop-the-world). ${oi < OPS.length ? `${OPS.length - oi} write(s) were never reached in this cycle. ` : ""}Everything still white is about to be swept.`, { lost });
      for (const o of all) if (col[o] === "white") col[o] = lost.includes(o) ? "lost" : "freed";
      snap(null, lost.length ? `<b>Bug:</b> ${lost.join(", ")} ${lost.length > 1 ? "are" : "is"} still reachable from a root but white, so the sweeper frees ${lost.length > 1 ? "them" : "it"}. The program now holds a dangling pointer: memory corruption. This is exactly the race a write barrier exists to prevent; try the same interleaving with a barrier.` : `Sweep frees only true garbage${garbage.length ? ` (${garbage.join(", ")})` : " (none this time)"}. Every reachable object is black: the invariant held${bi ? ` thanks to the ${TC_B[bi].split(" (")[0]}` : " (this interleaving got lucky)"}.`, { lost, final: { lost: lost.length, garbage: garbage.length } });
      return fr;
    },
    render: (f) => {
      setCode(host, tcCode(f.bi), "go");
      const lvl = { root: 0 }, q = ["root"], allE = f.e0.concat(f.OPS.filter((o) => o.op === "+").map((o) => ({ u: o.x, v: o.y })));
      while (q.length) { const x = q.shift(); for (const e of allE) if (e.u === x && lvl[e.v] === undefined) { lvl[e.v] = lvl[x] + 1; q.push(e.v); } }
      const maxL = Math.max(0, ...Object.values(lvl));
      for (const o of f.all) if (lvl[o] === undefined) lvl[o] = maxL + 1;
      const rows = {};
      for (const o of f.all) (rows[lvl[o]] ||= []).push(o);
      const nodes = [{ id: "root", x: 0, y: 0, label: "roots" }];
      for (const [l, os] of Object.entries(rows)) os.forEach((o, i) => nodes.push({ id: o, x: (i - (os.length - 1) / 2) * 92, y: Number(l) * 78, label: o }));
      const C = { white: "dim", grey: "visit", black: "done", lost: "bad", freed: "dim", none: "dim" };
      const shown = nodes.filter((n) => n.id === "root" || f.col[n.id] !== "none").map((n) => ({ ...n, cls: n.id === "root" ? "" : f.hot === n.id && f.col[n.id] !== "lost" ? "active" : C[f.col[n.id]], sub: n.id === "root" ? undefined : f.col[n.id] === "none" ? "" : f.col[n.id] }));
      const g = Viz.graph({ nodes: shown, edges: f.edges.filter((e) => e.u !== e.v && f.col[e.v] !== "none").map((e) => ({ ...e, cls: `${e.u}-${e.v}` === f.hotEdge ? "active" : f.col[e.v] === "lost" ? "bad" : "" })) }, { directed: true, r: 19, label: "heap (arrows are pointers)" });
      const ops = f.OPS.map((o, i) => chip(`${o.x}${o.op}${o.y}`, i < f.oi ? "done" : "dim")).join("");
      const fin = f.final ? verdict(f.final.lost ? `${f.final.lost} live object freed: heap corrupted` : "all reachable objects survived", f.final.lost ? "bad" : "done") : "";
      return `<div class="mg-mark"><div>${g}</div><div class="mg-side">${Viz.labeled("grey queue (GC work left)", `<div class="mg-q">${f.grey.map((x) => chip(x, "visit")).join("") || empty("empty")}</div>`)}${Viz.labeled("mutator writes", `<div class="mg-q">${ops || empty("none")}</div>`)}${fin}</div></div>`;
    },
  }));

  /* =====================================================================
   * 5. CPython: reference counting plus the cycle collector
   * ===================================================================== */
  const RC_DEF = 'a = Node("A"); b = Node("B"); a.next = b; b.next = a; c = Node("C"); c.next = b; del a; del b; c = None; gc.collect()';
  function rcParse(src) {
    const lines = String(src).split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!lines.length || lines.length > 10) throw new Error("Use 1 to 10 statements separated by ';'.");
    const N = "[A-Za-z_]\\w*";
    return lines.map((s, i) => {
      let m;
      if ((m = new RegExp(`^(${N})\\s*=\\s*Node\\(\\s*["'](\\w{1,3})["']\\s*\\)$`).exec(s))) return { k: "new", a: m[1], lab: m[2], s };
      if ((m = new RegExp(`^(${N})\\s*=\\s*None$`).exec(s))) return { k: "set", a: m[1], b: null, s };
      if ((m = new RegExp(`^(${N})\\.(${N})\\s*=\\s*None$`).exec(s))) return { k: "attr", a: m[1], f: m[2], b: null, s };
      if ((m = new RegExp(`^(${N})\\.(${N})\\s*=\\s*(${N})$`).exec(s))) return { k: "attr", a: m[1], f: m[2], b: m[3], s };
      if ((m = /^del\s+([A-Za-z_]\w*)$/.exec(s))) return { k: "del", a: m[1], s };
      if (/^gc\.collect\(\)$/.test(s)) return { k: "gc", s };
      if ((m = new RegExp(`^(${N})\\s*=\\s*(${N})$`).exec(s))) return { k: "set", a: m[1], b: m[2], s };
      throw new Error(`Statement ${i + 1} "${s}" is not supported. Use: x = Node("A"), x = y, x = None, x.attr = y, x.attr = None, del x, gc.collect().`);
    });
  }
  Viz.register("memory-and-gc-refcount", (host) => Viz.player(host, {
    title: "CPython: reference counts free most objects at once; cycles need the collector",
    tag: "REFCOUNT · CYCLE DETECTOR",
    legend: [["active", "refcount changed"], ["bad", "freed"], ["visit", "gc_refs > 0: referenced from outside"], ["path", "reachable from an outside reference"], ["dim", "leaked cycle (rc > 0, unreachable)"]],
    speed: 1300,
    codeLang: "python",
    code: pad(rcParse(RC_DEF).map((x) => x.s), 10),
    inputs: [{ key: "src", label: "statements (separated by ;)", value: RC_DEF, width: 560 }],
    random: () => {
      const V = ["a", "b", "c"], L = ["A", "B", "C", "D"], out = [], defined = new Set();
      let li = 0;
      for (let k = 0; k < Viz.rand(5, 10); k++) {
        const r = Math.random(), v = pick(V);
        if (!defined.size && li >= L.length) break;
        if (!defined.size || (r < 0.3 && li < L.length)) { out.push(`${v} = Node("${L[li++]}")`); defined.add(v); continue; }
        const d = pick([...defined]);
        if (r < 0.55) out.push(`${d}.${pick(["next", "peer"])} = ${pick([...defined])}`);
        else if (r < 0.7) { out.push(`del ${d}`); defined.delete(d); }
        else if (r < 0.8) out.push(`${d} = None`);
        else if (r < 0.9) { out.push(`${v} = ${d}`); defined.add(v); }
        else out.push("gc.collect()");
      }
      return { src: out.join("; ") };
    },
    build: ({ src }) => {
      const P = rcParse(src);
      const code = pad(P.map((x) => x.s), 10);
      const objs = [], vars = new Map();
      let hi = new Set(), freedNow = [], gcInfo = null;
      const fr = [];
      const ob = (id) => objs[id - 1];
      const inc = (id) => { if (id) { ob(id).rc++; hi.add(id); } };
      const dec = (id) => {
        if (!id) return;
        const o = ob(id); o.rc--; hi.add(id);
        if (o.rc === 0) { o.freed = true; freedNow.push(o.lab); const kids = Object.values(o.attrs); o.attrs = {}; kids.forEach(dec); }
      };
      const snap = (line, note, extra = {}) => fr.push({ code, line, note, objs: clone(objs), names: [...vars.entries()], hi: [...hi], freedNow: [...freedNow], gcInfo: gcInfo && clone(gcInfo), ...extra,
        vars: { names: [...vars.keys()].join(" ") || "–", "live objects": objs.filter((o) => !o.freed).length, freed: objs.filter((o) => o.freed).map((o) => o.lab).join(" ") || "–" } });
      const fix = (o) => o; // keeps the snapshot shape stable
      snap(null, "Every CPython object carries a reference count. Each name binding or attribute that points at it adds one; when the count drops to zero the object is freed <b>immediately</b>, right inside the statement that dropped it. (sys.getrefcount shows one more: its own argument.)");
      const nameVal = (n, i) => { if (!vars.has(n)) throw new Error(`Statement ${i + 1}: name '${n}' is not defined.`); return vars.get(n); };
      P.forEach((st, i) => {
        hi = new Set(); freedNow = []; gcInfo = null;
        if (st.k === "new") {
          const id = objs.length + 1;
          if (objs.length >= 8) throw new Error("Keep it to at most 8 Node(...) objects.");
          objs.push(fix({ id, lab: st.lab, rc: 0, attrs: {}, freed: false }));
          inc(id); const old = vars.get(st.a); vars.set(st.a, id); dec(old);
          snap(i, `Create ${st.lab} and bind <code>${st.a}</code>: rc(${st.lab}) = ${ob(id).rc}.${freedNow.length ? ` Rebinding dropped the old object: <b>${freedNow.join(", ")} freed</b> on the spot.` : ""}`);
        } else if (st.k === "set") {
          const nv = st.b === null ? null : nameVal(st.b, i), old = vars.get(st.a);
          inc(nv); vars.set(st.a, nv); dec(old);
          snap(i, `<code>${st.a}</code> now ${nv ? `points at ${ob(nv).lab} (rc ${ob(nv).rc})` : "is None"}.${old ? ` ${ob(old).lab} loses a reference: rc ${ob(old).rc}.` : ""}${freedNow.length ? ` <b>${freedNow.join(", ")} freed</b>: the count reached zero, and freeing an object decrements everything it pointed to (a cascade).` : ""}`);
        } else if (st.k === "attr") {
          const tgt = nameVal(st.a, i);
          if (!tgt) throw new Error(`Statement ${i + 1}: '${st.a}' is None, so '${st.a}.${st.f}' raises AttributeError. Each statement must be valid Python.`);
          const nv = st.b === null ? null : nameVal(st.b, i), o = ob(tgt), old = o.attrs[st.f] || null;
          inc(nv); if (nv) o.attrs[st.f] = nv; else delete o.attrs[st.f]; dec(old);
          snap(i, `${o.lab}.${st.f} ${nv ? `now references ${ob(nv).lab}: rc(${ob(nv).lab}) = ${ob(nv).rc}` : "= None"}.${old ? ` The old target ${ob(old).lab} drops to rc ${ob(old).rc}.` : ""}${nv && reach([...objs.flatMap((x) => Object.values(x.attrs).map((v) => ({ u: x.id, v })))], nv).has(o.id) ? " This closes a <b>reference cycle</b>." : ""}${freedNow.length ? ` <b>${freedNow.join(", ")} freed.</b>` : ""}`);
        } else if (st.k === "del") {
          const old = nameVal(st.a, i); vars.delete(st.a); dec(old);
          snap(i, `<code>del ${st.a}</code> removes the name (it does not delete the object). ${old ? `${ob(old).lab} rc → ${ob(old).rc}.` : ""}${freedNow.length ? ` <b>${freedNow.join(", ")} freed.</b>` : old && ob(old).rc > 0 ? ` ${ob(old).lab} is still referenced${[...vars.values()].includes(old) ? " by another name" : " only by other objects"}.` : ""}`);
        } else {
          const live = objs.filter((o) => !o.freed);
          gcInfo = { stage: 1, refs: Object.fromEntries(live.map((o) => [o.id, o.rc])) };
          snap(i, `<code>gc.collect()</code>: the cycle detector looks only at container objects. Step 1: copy each refcount into <code>gc_refs</code>.`);
          for (const o of live) for (const v of Object.values(o.attrs)) gcInfo.refs[v]--;
          gcInfo.stage = 2;
          snap(i, "Step 2: for every reference <b>between</b> tracked objects, subtract 1 from the target. What is left over counts references from outside (names, stack frames, untracked objects).");
          const ext = live.filter((o) => gcInfo.refs[o.id] > 0).map((o) => o.id), ok = new Set(ext), st2 = [...ext];
          while (st2.length) { const x = st2.pop(); for (const v of Object.values(ob(x).attrs)) if (!ok.has(v)) { ok.add(v); st2.push(v); } }
          gcInfo.stage = 3; gcInfo.ext = ext; gcInfo.ok = [...ok];
          snap(i, `Step 3: objects with gc_refs &gt; 0 (${ext.map((x) => ob(x).lab).join(", ") || "none"}) are alive, and so is everything reachable from them. The rest is unreachable even though their refcounts are not zero.`);
          const garbage = live.filter((o) => !ok.has(o.id));
          for (const o of garbage) { for (const v of Object.values(o.attrs)) if (ok.has(v)) { ob(v).rc--; hi.add(v); } o.attrs = {}; o.freed = true; o.rc = 0; freedNow.push(o.lab); }
          gcInfo.stage = 4;
          snap(i, garbage.length ? `Step 4: free the unreachable cycle${garbage.length > 1 ? "s" : ""}: <b>${freedNow.join(", ")}</b>. Without gc.collect (or the automatic generational trigger) these would leak forever. Real CPython runs this on generations 0/1/2 by allocation count.` : "Step 4: nothing unreachable; every object is still referenced from outside.");
        }
      });
      const leaked = objs.filter((o) => !o.freed && !reach([...vars.values()].filter(Boolean).map((v) => ({ u: "root", v })).concat(objs.flatMap((x) => Object.values(x.attrs).map((v) => ({ u: x.id, v })))), "root").has(o.id)).map((o) => o.lab);
      fr.push({ ...fr[fr.length - 1], line: null, hi: [], freedNow: [], gcInfo: null, final: { leaked }, note: leaked.length ? `End: ${leaked.join(", ")} ${leaked.length > 1 ? "are" : "is"} unreachable but still has rc &gt; 0: a reference cycle that only the cycle collector can reclaim. Break cycles with <code>weakref</code> for back-pointers (parent links, caches, observers).` : "End: every unreachable object has been freed. Reference counting is deterministic (files close the moment the last reference goes), but it cannot see cycles, it costs a count update on every assignment, and it is why CPython had the GIL." });
      return fr;
    },
    render: (f) => {
      setCode(host, f.code, "python");
      const names = f.names.map(([n, id]) => `<div class="mg-slot"><span>${esc(n)}</span>${id ? `<span class="mg-ref">→ ${esc(f.objs[id - 1].lab)}</span>` : '<span class="mg-val">None</span>'}</div>`).join("");
      const G = f.gcInfo;
      const leaked = f.final ? f.final.leaked : [];
      const cards = f.objs.map((o) => {
        let cls = o.freed ? (f.freedNow.includes(o.lab) ? "bad" : "gone") : f.hi.includes(o.id) ? "active" : "";
        if (G && !o.freed) cls = G.stage >= 3 ? (G.ext.includes(o.id) ? "visit" : G.ok.includes(o.id) ? "path" : "dim") : cls;
        if (leaked.includes(o.lab)) cls = "dim";
        const at = Object.entries(o.attrs);
        return `<div class="mg-obj ${cls}"><div class="mg-obj-h"><b>${esc(o.lab)}</b> Node<small>${o.freed ? "freed" : `rc ${o.rc}`}</small></div>${G && !o.freed && G.refs[o.id] !== undefined ? `<div class="mg-gcr">gc_refs <b>${G.refs[o.id]}</b></div>` : ""}${at.map(([k, v]) => `<div class="mg-slot"><span>.${esc(k)}</span><span class="mg-ref">→ ${esc(f.objs[v - 1].lab)}</span></div>`).join("") || (o.freed ? "" : empty("no attributes"))}</div>`;
      }).join("");
      return `<div class="mg-sh"><div>${Viz.labeled("names (module globals: the roots)", `<div class="mg-box"><div class="mg-slots">${names || empty("no names")}</div></div>`)}</div><div>${Viz.labeled("objects", `<div class="mg-heap">${cards || empty("no objects yet")}</div>`)}</div></div>${f.final ? verdict(f.final.leaked.length ? `leaked cycle: ${f.final.leaked.join(", ")}` : "nothing leaked", f.final.leaked.length ? "bad" : "done") : ""}`;
    },
  }));

  /* =====================================================================
   * 6. Leaks in a garbage-collected heap: the rising floor
   * ===================================================================== */
  const LK = ["event handler never unsubscribed", "static cache without eviction", "closure captures a big object", "timer never disposed", "unbounded queue (producer outruns consumer)"];
  const LK_PATH = [
    ["GC root: static field", "OrderService.Changed (event)", "EventHandler delegate", "OrderPage (target)", "grid rows + images"],
    ["GC root: static field", "Dictionary<string, Report>", "entry \"user-17:2026-11-03\"", "Report"],
    ["GC root: static List<Action>", "Action (closure)", "display class", "this: ReportBuilder", "List<Row> 50k rows"],
    ["GC root: runtime TimerQueue", "TimerQueueTimer", "TimerCallback", "Poller", "HttpClient + buffers"],
    ["GC root: static Channel", "unbounded queue", "Job waiting", "payload byte[]"],
  ];
  const LK_FIX = ["unsubscribe (-=) in Dispose, or use a weak event", "bounded MemoryCache: SizeLimit + expiry (LRU)", "capture only the id; remove the callback when done", "timer.Dispose() (await using / using)", "Channel.CreateBounded(6): the producer waits"];
  const LK_CODE = [
    [["public OrderPage(OrderService svc) {", "    svc.Changed += OnChanged;     // svc lives forever: it now", "}                                 // references every page ever made", "// no Dispose, no -=", "", "", ""],
     ["public OrderPage(OrderService svc) {", "    _svc = svc; _svc.Changed += OnChanged;", "}", "public void Dispose() {", "    _svc.Changed -= OnChanged;    // cut the edge from the root", "}", ""]],
    [["static readonly Dictionary<string, Report> Cache = new();", "Report Get(string user, DateOnly day) {", "    var key = $\"{user}:{day}\";      // unbounded key space", "    if (!Cache.TryGetValue(key, out var r))", "        Cache[key] = r = Build(user, day);", "    return r;                       // nothing is ever removed", "}"],
     ["static readonly MemoryCache Cache = new(new MemoryCacheOptions { SizeLimit = 8 });", "Report Get(string user, DateOnly day) =>", "    Cache.GetOrCreate($\"{user}:{day}\", e => {", "        e.Size = 1;                     // counts toward SizeLimit", "        e.SlidingExpiration = TimeSpan.FromMinutes(5);", "        return Build(user, day);", "    })!;"]],
    [["static readonly List<Action> Callbacks = new();", "void Start() {", "    var rows = LoadRows();          // 50k rows", "    Callbacks.Add(() => Log(Id, rows.Count));  // captures rows (and this)", "}", "// Callbacks is never cleared", ""],
     ["static readonly List<Action> Callbacks = new();", "void Start() {", "    var id = Id; var count = LoadRows().Count;  // copy small values", "    Action cb = null!;", "    cb = () => { Log(id, count); Callbacks.Remove(cb); };", "    Callbacks.Add(cb);              // and remove it when done", "}"]],
    [["void StartPolling() {", "    var t = new Timer(_ => Poll(), null, 0, 1000);", "    // t goes out of scope, but the runtime's timer queue", "    // still references the callback, which references this", "}", "", ""],
     ["private Timer? _timer;", "void StartPolling() =>", "    _timer = new Timer(_ => Poll(), null, 0, 1000);", "public void Dispose() {", "    _timer?.Dispose();              // removes it from the timer queue", "}", ""]],
    [["static readonly Channel<Job> Jobs = Channel.CreateUnbounded<Job>();", "async Task Produce() {", "    while (true) await Jobs.Writer.WriteAsync(NextJob());  // 2 per tick", "}", "async Task Consume() {", "    await foreach (var j in Jobs.Reader.ReadAllAsync()) Handle(j); // 1 per tick", "}"],
     ["static readonly Channel<Job> Jobs = Channel.CreateBounded<Job>(6);", "async Task Produce() {", "    while (true) await Jobs.Writer.WriteAsync(NextJob());  // waits when full", "}", "async Task Consume() {", "    await foreach (var j in Jobs.Reader.ReadAllAsync()) Handle(j);", "}"]],
  ];
  Viz.register("memory-and-gc-leak", (host) => Viz.player(host, {
    title: "A managed memory leak: the sawtooth whose floor keeps rising",
    tag: "LEAK HUNTING · RETENTION PATH",
    legend: [["bad", "retained by a leak"], ["done", "legitimately live"], ["visit", "garbage waiting for the next GC"], ["path", "GC ran in this tick"]],
    speed: 260,
    codeLang: "csharp",
    code: LK_CODE[0][0],
    inputs: [
      { key: "kind", label: "leak", type: "select", options: LK, value: LK[0] },
      { key: "fix", label: "version", type: "select", options: ["leaky", "fixed"], value: "leaky" },
      { key: "n", label: "requests", value: "48", width: 60 },
    ],
    random: () => ({ kind: pick(LK), fix: pick(["leaky", "fixed"]), n: String(Viz.rand(16, 60)) }),
    build: ({ kind, fix, n }) => {
      const ki = LK.indexOf(kind), good = fix === "fixed", N = int(n, "requests", 10, 60);
      const BASE = 6, GARB = 4, MAXH = 100, BMIN = 24;
      let retained = 0, garbage = 0, budget = BMIN, queue = 0, gcs = 0;
      const cols = [], floors = [];
      const fr = [];
      const snap = (line, note, extra = {}) => fr.push({ ki, good, line, note, cols: cols.map((c) => ({ ...c })), floors: [...floors], budget, MAXH, N, ...extra,
        vars: { request: cols.length, "live (after GC)": floors.length ? floors[floors.length - 1] : BASE, retained, "GC budget": budget, GCs: gcs } });
      snap(null, `Steady traffic: every request allocates ${GARB} units of short-lived garbage. The GC runs when the heap reaches its budget; after each GC the heap drops to what is still <b>reachable</b>. Watch the bottom of the sawtooth, the <b>floor</b>: it is the live set.`);
      let oom = false;
      for (let i = 1; i <= N; i++) {
        let add = 0;
        if (ki === 4) { const before = queue; queue = good ? Math.min(6, queue + 1) : queue + 1; add = queue - before; }
        else if (ki === 1) add = good ? (retained < 8 ? 1 : 0) : 1;
        else add = good ? 0 : [2, 1, 3, 2][ki];
        retained += add; garbage += GARB + (good && ki !== 1 && ki !== 4 ? [2, 1, 3, 2][ki] : 0) + (good && ki === 1 && !add ? 1 : 0);
        let heap = BASE + retained + garbage, gc = false;
        const col = { live: BASE + retained, garb: garbage, gc: false };
        let note = `Request ${i}: +${GARB} garbage${add ? `, <b>+${add} retained</b> (${good ? "within the bound" : LK_PATH[ki][LK_PATH[ki].length - 2]})` : good && ki !== 1 && ki !== 4 ? ", and its per-request object becomes garbage when the request ends" : ""}.`;
        if (heap >= budget) {
          gc = true; gcs++; garbage = 0;
          const live = BASE + retained; floors.push(live);
          budget = Math.max(BMIN, Math.ceil(live * 1.6));
          col.gc = true;
          const d = floors.length > 1 ? live - floors[floors.length - 2] : 0;
          note += ` <b>GC #${gcs}</b>: heap ${heap} → ${live}. ${floors.length > 1 ? (d > 0 ? `The floor rose by ${d}: something reachable keeps growing.` : "The floor is flat: everything per-request was collected.") : "This is the first floor."} New budget ${budget}.`;
          if (live >= MAXH * 0.9) { oom = true; cols.push(col); snap(null, note + ` The live set is ${live} of ${MAXH}: the next allocations cannot fit even after a full GC. <b>OutOfMemoryException</b> (or the container is OOM-killed).`, { oom: true }); break; }
        }
        cols.push(col);
        snap(ki === 4 ? 2 : [1, 4, 3, 1][ki], note);
      }
      const rise = floors.length > 1 ? floors[floors.length - 1] - floors[0] : 0;
      fr.push({ ...fr[fr.length - 1], line: null, final: { rise, oom, floors: [...floors] }, note: oom ? `Crashed after ${cols.length} requests. In a heap dump the culprit is not "big objects" but a <b>retention path</b> from a GC root: ${LK_PATH[ki].join(" → ")}. Fix: ${LK_FIX[ki]}.` : good ? `Fixed: the floor stayed ${rise <= 2 ? "flat" : `bounded (it rose ${rise} and stopped)`}. Memory use is a sawtooth with a level bottom, which is exactly what a healthy GC heap looks like.` : `The floor rose ${rise} units over ${floors.length} GCs. No error yet, just a service that needs restarting every few days. Find it by diffing two heap snapshots and following the path to the root: ${LK_PATH[ki].join(" → ")}.` });
      return fr;
    },
    render: (f) => {
      setCode(host, LK_CODE[f.ki][f.good ? 1 : 0], "csharp");
      const H = 150, sc = H / f.MAXH;
      const bars = f.cols.map((c, i) => `<div class="mg-col1 ${c.gc ? "gc" : ""}" title="request ${i + 1}: live ${c.live}, garbage ${c.garb}"><i class="g" style="height:${Math.round(c.garb * sc)}px"></i><i class="l ${f.good ? "ok" : ""}" style="height:${Math.round(c.live * sc)}px"></i></div>`).join("");
      const fut = Array.from({ length: Math.max(0, f.N - f.cols.length) }, () => '<div class="mg-col1 fut"></div>').join("");
      const path = LK_PATH[f.ki].map((p, i) => chip(p, i === 0 ? "path" : f.good && i === 1 ? "dim" : f.good ? "dim" : "bad")).join('<span class="mg-arrow">→</span>');
      return `${Viz.labeled(`heap size per request (max ${f.MAXH}); dashed line = OOM limit`, `<div class="mg-chart" style="height:${H}px"><div class="mg-oom" style="bottom:${Math.round(f.MAXH * 0.9 * sc)}px"></div>${bars}${fut}</div>`)}${Viz.labeled(f.good ? `retention path, cut by the fix: ${LK_FIX[f.ki]}` : "retention path a heap snapshot would show", `<div class="mg-q">${path}</div>`)}${stats([["GCs", f.floors.length], ["first floor", f.floors[0] ?? "–"], ["latest floor", f.floors.length ? f.floors[f.floors.length - 1] : "–", f.floors.length > 1 && f.floors[f.floors.length - 1] > f.floors[0] + 2 ? "bad" : "done"]])}${f.final ? verdict(f.final.oom ? "OutOfMemoryException" : f.final.rise > 2 && !f.good ? `floor +${f.final.rise}: leaking` : "floor flat: healthy", f.final.oom || (f.final.rise > 2 && !f.good) ? "bad" : "done") : ""}${f.oom && !f.final ? verdict("OutOfMemoryException", "bad") : ""}`;
    },
  }));

  /* =====================================================================
   * 7. Pooling: ArrayPool / sync.Pool, and the two classic bugs
   * ===================================================================== */
  const PM = ["new byte[64 KB] per request", "ArrayPool Rent / Return", "bug: forgot to Return", "bug: Return, then keep using it"];
  const PCODE = [
    ["async Task Handle(Stream body) {", "    var buf = new byte[64 * 1024];      // fresh allocation", "    int n = await body.ReadAsync(buf);", "    Process(buf.AsSpan(0, n));", "}                                      // garbage for the GC", "", ""],
    ["async Task Handle(Stream body) {", "    byte[] buf = ArrayPool<byte>.Shared.Rent(64 * 1024);", "    try {", "        int n = await body.ReadAsync(buf);", "        Process(buf.AsSpan(0, n));      // length may exceed 64 KB!", "    }", "    finally { ArrayPool<byte>.Shared.Return(buf); }"],
    ["async Task Handle(Stream body) {", "    byte[] buf = ArrayPool<byte>.Shared.Rent(64 * 1024);", "    int n = await body.ReadAsync(buf);", "    Process(buf.AsSpan(0, n));", "    // no Return: the pool never gets it back", "}", ""],
    ["async Task Handle(Stream body) {", "    byte[] buf = ArrayPool<byte>.Shared.Rent(64 * 1024);", "    Task write = body.ReadAsync(buf).AsTask();  // still running...", "    ArrayPool<byte>.Shared.Return(buf);        // ...returned too early", "    await write;                               // writes into a buffer", "}                                              // someone else now owns", ""],
  ];
  Viz.register("memory-and-gc-pool", (host) => Viz.player(host, {
    title: "Renting buffers instead of allocating them",
    tag: "POOLING · ArrayPool · sync.Pool",
    legend: [["active", "rented / in use"], ["done", "back in the pool"], ["visit", "garbage for the GC"], ["bad", "corrupted: two owners"]],
    speed: 1000,
    codeLang: "csharp",
    code: PCODE[0],
    inputs: [
      { key: "mode", label: "handler", type: "select", options: PM, value: PM[1] },
      { key: "r", label: "requests", value: "12", width: 60 },
      { key: "c", label: "concurrent", value: "3", width: 60 },
    ],
    random: () => ({ mode: pick(PM), r: String(Viz.rand(4, 20)), c: String(Viz.rand(1, 4)) }),
    build: ({ mode, r, c }) => {
      const mi = PM.indexOf(mode), R = int(r, "requests", 2, 24), C = int(c, "concurrent", 1, 4), CAP = 4;
      const pool = [], bufs = [];
      let inflight = [], late = [], garbage = [], allocs = 0, gcs = 0, gbytes = 0, corrupt = 0, rents = 0, returns = 0;
      const fr = [];
      const snap = (line, note, extra = {}) => fr.push({ mi, line, note, pool: [...pool], inflight: clone(inflight), late: clone(late), garbage: [...garbage], bufs: clone(bufs), cnt: { allocs, gcs, corrupt, rents, returns }, ...extra,
        vars: { "buffers allocated": allocs, "KB allocated": allocs * 64, "gen0 GCs": gcs, "in pool": pool.length, corruptions: corrupt } });
      const newBuf = () => { const b = { id: bufs.length + 1, data: "", owner: null }; bufs.push(b); allocs++; return b.id; };
      const drop = (id) => { garbage.push(id); gbytes += 64; if (gbytes >= 256) { gcs++; gbytes = 0; garbage = []; return true; } return false; };
      snap(null, `${R} requests, ${C} at a time, each needing a 64 KB buffer. ${mi === 0 ? "Allocating each time is simple and safe; the question is how much GC work it causes." : "The pool keeps up to " + CAP + " returned buffers and hands them out again."}`);
      for (let s = 0; s < R; s += C) {
        const batch = Array.from({ length: Math.min(C, R - s) }, (_, k) => s + k + 1);
        inflight = batch.map((q) => {
          let id, from;
          if (mi === 0) { id = newBuf(); from = "new"; }
          else { rents++; if (pool.length) { id = pool.pop(); from = "pool"; } else { id = newBuf(); from = "new"; } }
          bufs[id - 1].owner = q; bufs[id - 1].data = `req${q}`;
          return { q, id, from };
        });
        const reused = inflight.filter((x) => x.from === "pool").length;
        snap(1, `Requests ${batch.join(", ")} start: ${mi === 0 ? `${batch.length} new 64 KB arrays.` : `${reused} buffer${reused !== 1 ? "s" : ""} reused from the pool, ${batch.length - reused} newly allocated.`} Each request writes its own data into its buffer.`);
        if (mi === 3 && late.length) {
          const hit = [];
          for (const l of late) { const b = bufs[l.id - 1]; if (b.owner !== l.q && b.owner !== null) { b.data = `req${l.q}!`; corrupt++; hit.push(`buffer #${l.id}: request ${l.q}'s late write landed in request ${b.owner}'s data`); } }
          late = [];
          snap(4, hit.length ? `<b>Corruption.</b> ${hit.join("; ")}. No exception: the pool cannot know the buffer is still in use. This is the most dangerous pooling bug; it shows up as garbled responses under load.` : "The late writes from the previous batch land in buffers nobody else rented: lucky this time.", { corruptNow: true });
        }
        if (mi === 0 || mi === 2) {
          let gcd = false;
          for (const x of inflight) { bufs[x.id - 1].owner = null; if (drop(x.id)) gcd = true; }
          snap(mi === 0 ? 4 : 4, `Requests finish. ${mi === 2 ? "Nobody calls Return, so the rented arrays just become garbage: the pool stays empty and every Rent allocates. Not a crash, just a pool that buys you nothing." : "The arrays become garbage."}${gcd ? " The 256 KB gen0 budget filled up: <b>a GC ran</b>." : ""}`);
        } else if (mi === 1) {
          for (const x of inflight) { returns++; bufs[x.id - 1].owner = null; if (pool.length < CAP) pool.push(x.id); else drop(x.id); }
          snap(6, `Requests finish and Return their buffers in <code>finally</code>. ${pool.length} buffers are ready for the next batch, so steady state needs <b>zero</b> new allocations. Note: Rent may hand back a larger array than asked for, and Return does not clear it unless you pass clearArray: true.`);
        } else {
          for (const x of inflight) { returns++; bufs[x.id - 1].owner = null; if (pool.length < CAP) pool.push(x.id); late.push({ q: x.q, id: x.id }); }
          snap(3, `Each request returns its buffer <b>before</b> its async read has finished. The pool now holds ${pool.length} buffers that are still being written to.`);
        }
        inflight = [];
      }
      fr.push({ ...fr[fr.length - 1], line: null, final: true, note: [
        `${allocs} allocations (${allocs * 64} KB) and ${gcs} GC${gcs !== 1 ? "s" : ""} for ${R} requests. Often fine: gen0 GCs are cheap. Pool only when a profiler shows allocation or GC time matters.`,
        `${allocs} allocation${allocs !== 1 ? "s" : ""} for ${R} requests (one per concurrent request), ${gcs} GCs. The rule that makes this safe: Return exactly once, in finally, and never touch the array afterwards.`,
        `${allocs} allocations for ${R} requests: the same as plain new, plus the pool's bookkeeping. Forgetting Return is a performance bug, not a correctness bug (for ArrayPool).`,
        `${corrupt} corrupted response${corrupt !== 1 ? "s" : ""}. Pooled memory turns use-after-free back into a possibility in a managed language. Return only after the last use (await everything first).`,
      ][mi] });
      return fr;
    },
    render: (f) => {
      setCode(host, PCODE[f.mi], "csharp");
      const bchip = (id, cls) => { const b = f.bufs[id - 1]; return `<span class="mg-chip ${cls}">#${id}<small>${esc(b.data || "clean")}</small></span>`; };
      const slots = f.mi === 0 ? empty("no pool") : Array.from({ length: 4 }, (_, k) => f.pool[k] ? bchip(f.pool[k], "done") : '<span class="mg-chip slot"></span>').join("");
      const reqs = f.inflight.map((x) => `<div class="mg-box ${x.from === "pool" ? "" : "path"}"><div class="mg-box-h"><b>request ${x.q}</b><small>${x.from === "pool" ? "rented from pool" : "allocated"}</small></div><div class="mg-box-b">${bchip(x.id, f.bufs[x.id - 1].data.endsWith("!") ? "bad" : "active")}</div></div>`).join("");
      const lates = f.late.map((l) => chip(`req${l.q} still writing to #${l.id}`, "bad")).join("");
      const garb = f.garbage.map((id) => chip(`#${id}`, "visit")).join("");
      return `<div class="mg-pool">${Viz.labeled("pool (max 4 kept)", `<div class="mg-q">${slots}</div>`)}${Viz.labeled("in flight", `<div class="mg-row">${reqs || empty("between batches")}</div>`)}${lates ? Viz.labeled("returned but still in use", `<div class="mg-q">${lates}</div>`) : ""}${Viz.labeled("garbage since last GC", `<div class="mg-q">${garb || empty("none")}</div>`)}</div>${stats([["allocations", f.cnt.allocs, f.cnt.allocs > 4 ? "bad" : "done"], ["KB allocated", f.cnt.allocs * 64], ["gen0 GCs", f.cnt.gcs], ["corruptions", f.cnt.corrupt, f.cnt.corrupt ? "bad" : ""]])}`;
    },
  }));

  /* =====================================================================
   * 8. Copies vs views: Substring/Split against ReadOnlySpan<char>
   * ===================================================================== */
  const SPM = ["Split + Substring (copies)", "ReadOnlySpan<char> slicing (views)"];
  const SPCODE = [
    ["var result = new Dictionary<string, string>();", "string[] parts = s.Split(';');        // array + one string per part", "foreach (string part in parts) {", "    string[] kv = part.Split('=');     // array + two more strings", "    result[kv[0]] = kv[1];", "}", "", "", ""],
    ["ReadOnlySpan<char> rest = s;              // (pointer, length): no copy", "while (!rest.IsEmpty) {", "    int semi = rest.IndexOf(';');", "    var part = semi < 0 ? rest : rest[..semi];", "    int eq = part.IndexOf('=');", "    var key = part[..eq];  var value = part[(eq + 1)..];", "    Handle(key, value);                   // compare, TryParse: no strings", "    rest = semi < 0 ? default : rest[(semi + 1)..];", "}"],
  ];
  const strBytes = (n) => Math.ceil((22 + 2 * n) / 8) * 8;
  Viz.register("memory-and-gc-span", (host) => Viz.player(host, {
    title: "Parsing without allocating: copies vs spans",
    tag: "Span<T> · ZERO-COPY SLICING",
    legend: [["path", "rest (remaining input)"], ["visit", "current part"], ["active", "key"], ["done", "value"], ["bad", "a heap copy was made"]],
    speed: 1300,
    codeLang: "csharp",
    code: SPCODE[0],
    inputs: [
      { key: "s", label: "input (key=value;key=value)", value: "id=42;name=Ada;role=admin", width: 260 },
      { key: "mode", label: "parser", type: "select", options: SPM, value: SPM[0] },
    ],
    random: () => {
      const K = ["id", "name", "role", "tz", "lang", "v"], V = ["42", "Ada", "admin", "UTC", "en", "7", ""];
      return { s: Array.from({ length: Viz.rand(1, 4) }, () => `${pick(K)}=${pick(V)}`).join(";"), mode: pick(SPM) };
    },
    build: ({ s, mode }) => {
      const str = String(s);
      if (!str.length || str.length > 44) throw new Error("Use 1 to 44 characters.");
      if (!/^[^;=\s]+=[^;=\s]*(;[^;=\s]+=[^;=\s]*)*$/.test(str)) throw new Error("Use key=value pairs separated by ';' with no spaces, for example id=42;name=Ada.");
      if (str.split(";").length > 5) throw new Error("Use at most 5 pairs.");
      const mi = SPM.indexOf(mode);
      const heap = [], result = [];
      let bytes = 0;
      const fr = [];
      const snap = (line, note, win) => fr.push({ mi, str, line, note, win: win || {}, heap: clone(heap), result: clone(result), bytes,
        vars: { "heap objects": heap.length, "bytes allocated": bytes, pairs: result.length } });
      const alloc = (type, text, from, size) => { heap.push({ type, text, from, size }); bytes += size; };
      snap(null, `Input: ${str.length} chars (a .NET string of ${strBytes(str.length)} B is already on the heap). Goal: get each key and value out. ${mi === 0 ? "The classic way creates new string objects for every piece." : "A span is a (reference, length) pair that lives on the stack and views part of existing memory."}`);
      if (mi === 0) {
        const parts = str.split(";");
        let at = 0;
        const ranges = parts.map((p) => { const r = [at, at + p.length]; at += p.length + 1; return r; });
        alloc(`string[${parts.length}]`, "", null, 24 + 8 * parts.length);
        ranges.forEach((r, k) => alloc("string", parts[k], r, strBytes(parts[k].length)));
        snap(1, `<code>Split(';')</code> scans the whole input, then <b>copies</b> each part into a new string and allocates an array to hold them: ${parts.length + 1} heap objects so far.`, { copy: ranges });
        ranges.forEach((r, k) => {
          const p = parts[k], eq = p.indexOf("=");
          alloc("string[2]", "", null, 40);
          alloc("string", p.slice(0, eq), [r[0], r[0] + eq], strBytes(eq));
          alloc("string", p.slice(eq + 1), [r[0] + eq + 1, r[1]], strBytes(p.length - eq - 1));
          result.push([p.slice(0, eq), p.slice(eq + 1)]);
          snap(3, `<code>part.Split('=')</code> copies "${esc(p.slice(0, eq))}" and "${esc(p.slice(eq + 1))}" <b>again</b> (they were already copied once inside the part) and allocates another array. ${bytes} bytes so far to read ${str.length} characters.`, { part: r, key: [r[0], r[0] + eq], val: [r[0] + eq + 1, r[1]] });
        });
      } else {
        let off = 0;
        while (off <= str.length - 1 || (off === str.length && false)) {
          const rest = [off, str.length];
          const semiRel = str.slice(off).indexOf(";");
          const end = semiRel < 0 ? str.length : off + semiRel;
          snap([2, 3], `<code>rest</code> views chars ${off} to ${str.length - 1}. <code>IndexOf(';')</code> ${semiRel < 0 ? "finds none, so this is the last part" : `finds ';' at offset ${semiRel}`}; slicing just makes a new (start, length) pair on the stack.`, { rest, part: [off, end] });
          const eqRel = str.slice(off, end).indexOf("=");
          const key = [off, off + eqRel], val = [off + eqRel + 1, end];
          result.push([str.slice(key[0], key[1]), str.slice(val[0], val[1])]);
          snap([4, 5, 6], `key = chars ${key[0]}..${key[1] - 1} ("${esc(str.slice(key[0], key[1]))}"), value = ${val[1] > val[0] ? `chars ${val[0]}..${val[1] - 1} ("${esc(str.slice(val[0], val[1]))}")` : "empty"}. Both are views into the original string: <b>0 bytes allocated</b>. Compare with <code>key.SequenceEqual("id")</code> or <code>int.TryParse(value, out n)</code>, which accept spans.`, { rest, part: [off, end], key, val });
          if (semiRel < 0) break;
          off = end + 1;
        }
      }
      fr.push({ ...fr[fr.length - 1], line: null, win: {}, final: true, note: mi === 0 ? `${heap.length} allocations, <b>${bytes} bytes</b>, to read a ${str.length}-char string. At 50,000 requests/s that is ${Math.round(bytes * 50000 / 1048576)} MB/s of garbage for the GC. Still the right choice when you need to <b>keep</b> the strings (store them in a dictionary that outlives the request).` : `0 allocations. The catch: a <code>Span&lt;T&gt;</code> is a ref struct that can only live on the stack, so it cannot be stored in a field, captured by a lambda or held across <code>await</code>. Use <code>Memory&lt;T&gt;</code> (or Go slices, Java ByteBuffer/CharBuffer views) when you need to.` });
      return fr;
    },
    render: (f) => {
      setCode(host, SPCODE[f.mi], "csharp");
      const inR = (r, i) => r && i >= r[0] && i < r[1];
      const cells = [...f.str].map((ch, i) => {
        const w = f.win;
        const cls = inR(w.key, i) ? "active" : inR(w.val, i) ? "done" : inR(w.part, i) ? "visit" : inR(w.rest, i) ? "path" : (w.copy || []).some((r) => inR(r, i)) ? "bad" : "";
        return `<div class="mg-ch ${cls}"><b>${esc(ch)}</b><small>${i}</small></div>`;
      }).join("");
      const views = f.mi === 1 && f.win.key ? `<div class="mg-q">${[["rest", f.win.rest, "path"], ["part", f.win.part, "visit"], ["key", f.win.key, "active"], ["value", f.win.val, "done"]].map(([n, r, c]) => chip(`${n} = (start ${r[0]}, length ${r[1] - r[0]})`, c)).join("")}</div>` : "";
      const heap = f.heap.map((o) => `<span class="mg-chip bad">${esc(o.type)}${o.text !== "" || o.type === "string" ? ` "${esc(o.text)}"` : ""}<small>${o.size} B</small></span>`).join("");
      return `${Viz.labeled("the original string (already on the heap)", `<div class="mg-chars">${cells}</div>`)}${views ? Viz.labeled("spans on the stack (no heap objects)", views) : ""}${Viz.labeled(`new heap objects: ${f.heap.length}, ${f.bytes} B`, `<div class="mg-q">${heap || empty("none: every slice is a view")}</div>`)}${f.result.length ? Viz.labeled("parsed pairs", `<div class="mg-q">${f.result.map(([k, v]) => chip(`${k} → ${v === "" ? "(empty)" : v}`, "done")).join("")}</div>`) : ""}`;
    },
  }));

  /* =====================================================================
   * 9. Go slices: append, shared backing arrays, and growth
   * ===================================================================== */
  const SLM = ["b := a[:k]  (shares a's array)", "b := a[:k:k]  (full slice expression)"];
  const GO_CLASSES = [8, 16, 24, 32, 48, 64, 80, 96, 112, 128, 144, 160, 176, 192, 208, 224, 240, 256];
  const goGrow = (oldCap, newLen) => {
    let nc = newLen > 2 * oldCap ? newLen : oldCap < 256 ? 2 * oldCap : oldCap + (oldCap + 3 * 256) / 4;
    const bytes = nc * 8, cls = GO_CLASSES.find((c) => c >= bytes) || bytes;
    return Math.floor(cls / 8);
  };
  const goSlices = (vals, cap, k, extra, full) => {
    const arrs = [Array.from({ length: cap }, (_, i) => (i < vals.length ? vals[i] : 0))];
    const a = { arr: 0, len: vals.length, cap }, b = { arr: 0, len: k, cap: full ? k : cap };
    const ev = [];
    for (const x of extra) {
      if (b.len < b.cap) { const before = arrs[b.arr][b.len]; arrs[b.arr][b.len] = x; ev.push({ kind: "inplace", idx: b.len, x, alias: b.arr === a.arr && b.len < a.len, before }); b.len++; }
      else { const nc = goGrow(b.cap, b.len + 1); const na = Array(nc).fill(0); for (let i = 0; i < b.len; i++) na[i] = arrs[b.arr][i]; na[b.len] = x; arrs.push(na); ev.push({ kind: "grow", from: b.cap, to: nc, x, arr: arrs.length - 1 }); b.arr = arrs.length - 1; b.cap = nc; b.len++; }
    }
    const view = (h) => arrs[h.arr].slice(0, h.len);
    return { arrs, a, b, ev, outA: view(a), outB: view(b) };
  };
  Viz.register("memory-and-gc-slices", (host) => Viz.player(host, {
    title: "Go slices: one backing array, two views, one surprise",
    tag: "SLICES · append · ALIASING",
    legend: [["visit", "in a's view"], ["active", "in b's view"], ["path", "shared by a and b"], ["bad", "a's element silently overwritten"], ["dim", "spare capacity"]],
    speed: 1300,
    codeLang: "go",
    code: ["a := make([]int, 0, 5)", "a = append(a, 1, 2, 3, 4, 5)", "b := a[:2]", "for _, x := range []int{90, 91, 92} {", "    b = append(b, x)", "}", "fmt.Println(a, b)"],
    inputs: [
      { key: "vals", label: "a's values", value: "1,2,3,4,5", width: 110 },
      { key: "cap", label: "cap(a)", value: "5", width: 50 },
      { key: "k", label: "k", value: "2", width: 40 },
      { key: "extra", label: "append to b", value: "90,91,92,93", width: 110 },
      { key: "mode", label: "slice b with", type: "select", options: SLM, value: SLM[0] },
    ],
    random: () => { const n = Viz.rand(1, 6); return { vals: Array.from({ length: n }, (_, i) => i + 1).join(","), cap: String(Viz.rand(n, 8)), k: String(Viz.rand(0, n)), extra: Array.from({ length: Viz.rand(1, 5) }, (_, i) => 90 + i).join(","), mode: pick(SLM) }; },
    build: ({ vals, cap, k, extra, mode }) => {
      const nums = (s, nm, lo, hi) => { const a = String(s).split(/[\s,]+/).filter(Boolean).map(Number); if (a.some((x) => !Number.isInteger(x) || x < 0 || x > 999)) throw new Error(`${nm}: use whole numbers 0 to 999 separated by commas.`); if (a.length < lo || a.length > hi) throw new Error(`${nm}: use ${lo} to ${hi} numbers.`); return a; };
      const V = nums(vals, "a's values", 1, 8), X = nums(extra, "append to b", 1, 5);
      const CAP = int(cap, "cap(a)", V.length, 10), K = int(k, "k", 0, V.length), full = mode === SLM[1];
      const res = goSlices(V, CAP, K, X, full);
      const code = ["a := make([]int, 0, " + CAP + ")", "a = append(a, " + V.join(", ") + ")", full ? `b := a[:${K}:${K}]       // cap(b) = ${K}` : `b := a[:${K}]         // cap(b) = cap(a) = ${CAP}`, `for _, x := range []int{${X.join(", ")}} {`, "    b = append(b, x)", "}", "fmt.Println(a, b)"];
      const arrs = [Array.from({ length: CAP }, (_, i) => (i < V.length ? V[i] : 0))];
      const a = { arr: 0, len: V.length, cap: CAP }, b = { arr: 0, len: K, cap: full ? K : CAP };
      const fr = [];
      let bad = [], alias = 0;
      const snap = (line, note, extra2 = {}) => fr.push({ code, line, note, arrs: clone(arrs), a: { ...a }, b: { ...b }, bad: [...bad], ...extra2,
        vars: { "len(a)": a.len, "cap(a)": a.cap, "len(b)": b.len, "cap(b)": b.cap, "b's array": `#${b.arr + 1}`, "a overwritten": alias } });
      snap([0, 1], `<code>a</code> is a <b>slice header</b>: (pointer to array #1, len ${a.len}, cap ${a.cap}). The ints live in the backing array; the header is three words, usually on the stack.`);
      snap(2, `<code>b</code> is a second header over the <b>same</b> array: len ${b.len}, cap ${b.cap}. ${full ? "The third index caps b's capacity at k, so b has no spare room it could share." : `Its capacity runs to the end of a's array, so b believes cells ${K}..${CAP - 1} are free space, even though ${K < V.length ? `cells ${K}..${V.length - 1} are a's elements` : "nothing there is in use yet"}.`}`);
      for (const e of res.ev) {
        if (e.kind === "inplace") {
          arrs[b.arr][e.idx] = e.x; b.len++;
          if (e.alias) { bad.push(e.idx); alias++; }
          snap(4, e.alias ? `<code>append(b, ${e.x})</code>: len(b) &lt; cap(b), so append writes <b>in place</b> at index ${e.idx}, which is <b>a[${e.idx}]</b>. a just changed from ${e.before} to ${e.x} and nothing warned you.` : `<code>append(b, ${e.x})</code>: room left (len ${b.len - 1} &lt; cap ${b.cap}), so it writes in place at index ${e.idx}. ${b.arr === a.arr ? "That cell is beyond len(a), so a does not see it (yet: a later append to a would overwrite it)." : ""}`);
        } else {
          arrs.push(Array(e.to).fill(0)); for (let i = 0; i < b.len; i++) arrs[e.arr][i] = arrs[b.arr][i]; arrs[e.arr][b.len] = e.x;
          b.arr = e.arr; b.cap = e.to; b.len++;
          snap(4, `<code>append(b, ${e.x})</code>: len(b) == cap(b) = ${e.from}, so append allocates a new array #${e.arr + 1} with cap ${e.to} (roughly doubling, rounded to a malloc size class), copies b's ${b.len - 1} element${b.len - 1 !== 1 ? "s" : ""}, then writes. From now on b and a are <b>independent</b>. That is why you must always write <code>b = append(b, x)</code>.`);
        }
      }
      const pa = `[${res.outA.join(" ")}]`, pb = `[${res.outB.join(" ")}]`;
      fr.push({ ...fr[fr.length - 1], line: 6, final: { pa, pb, alias }, note: `Prints <code>${pa} ${pb}</code>. ${alias ? `${alias} of a's elements were overwritten through b. Fix: <code>b := a[:k:k]</code> (or <code>slices.Clip</code>, or copy with <code>append([]int(nil), a[:k]...)</code>) whenever you hand a sub-slice to code that may append.` : "No aliasing: b got its own array before it could touch a's elements."}` });
      return fr;
    },
    render: (f) => {
      setCode(host, f.code, "go");
      const rows = f.arrs.map((arr, ai) => {
        const cells = arr.map((v, i) => {
          const inA = ai === f.a.arr && i < f.a.len, inB = ai === f.b.arr && i < f.b.len;
          const cls = ai === f.a.arr && f.bad.includes(i) && inA ? "bad" : inA && inB ? "path" : inA ? "visit" : inB ? "active" : "dim";
          return `<div class="mg-ch ${cls}"><b>${v}</b><small>${i}</small></div>`;
        }).join("");
        const who = [ai === f.a.arr ? "a" : "", ai === f.b.arr ? "b" : ""].filter(Boolean).join(", ");
        return Viz.labeled(`array #${ai + 1} (cap ${arr.length})${who ? ` · used by ${who}` : " · unreferenced: garbage"}`, `<div class="mg-chars">${cells}</div>`);
      }).join("");
      const hdr = (n, h, c) => chip(`${n}: ptr → #${h.arr + 1}[0], len ${h.len}, cap ${h.cap}`, c);
      return `<div class="mg-q">${hdr("a", f.a, "visit")}${hdr("b", f.b, "active")}</div>${rows}${f.final ? verdict(`a = ${f.final.pa}   b = ${f.final.pb}`, f.final.alias ? "bad" : "done") : ""}`;
    },
  }));

  /* =====================================================================
   * 10. Pauses vs throughput: six collectors on the same workload
   * ===================================================================== */
  const GCM = [".NET Workstation, concurrent off", ".NET Workstation + background GC", ".NET Server GC", "JVM G1 (default)", "JVM ZGC (generational)", "Go (GOGC=100)"];
  const GCCODE = [
    ["# runtimeconfig.json (or <ServerGarbageCollection>/<ConcurrentGarbageCollection> in the .csproj)", '"System.GC.Server": false', '"System.GC.Concurrent": false', "# gen0/gen1: short stop-the-world on ONE thread", "# gen2: blocking full GC on one thread: the whole app freezes", "# fits: small containers with 1 core, CLI tools"],
    ["# the default for desktop apps and many containers", '"System.GC.Server": false', '"System.GC.Concurrent": true      # background GC', "# gen0/gen1: still short stop-the-world pauses", "# gen2: marked by ONE background thread while the app runs", "# fits: UI apps, low-core services"],
    ["# the default for ASP.NET Core on multi-core machines", '"System.GC.Server": true          # one heap + GC thread per core', '"System.GC.Concurrent": true', "# bigger gen0 budgets: fewer GCs, more memory", "# pauses use every core in parallel", "# fits: throughput services (cap with GCHeapHardLimit / DOTNET_GCHeapCount)"],
    ["java -XX:+UseG1GC                    # default since JDK 9", "     -XX:MaxGCPauseMillis=200        # a target, not a promise", "     -XX:InitiatingHeapOccupancyPercent=45", "# young pauses: parallel evacuation of eden + survivors", "# old gen: concurrent marking, then mixed pauses", "     -jar app.jar"],
    ["java -XX:+UseZGC -XX:+ZGenerational  # default mode from JDK 23", "     -Xmx4g -XX:SoftMaxHeapSize=3g", "# marking AND relocation run concurrently with the app", "# pauses: well under 1 ms, independent of heap size", "# cost: load barriers on every reference read, spare CPU", "     -jar app.jar"],
    ["GOGC=100 GOMEMLIMIT=512MiB ./server   # next GC when heap = 2x live", "# no generations: every cycle marks the whole live heap", "# marking uses 25% of GOMAXPROCS in background workers", "# allocating goroutines pay 'assist' work if the GC falls behind", "# pauses: two sub-millisecond stop-the-world phases", "# tune with GOGC (CPU vs memory) and GOMEMLIMIT (a ceiling)"],
  ];
  const pauseSim = (mi, L, rate) => {
    const T = 48, C = 4;
    const Y = [32, 32, 64, 40, 40, Math.max(4, L)][mi], K = mi === 5 ? 1 : 4;
    const full = Math.ceil(L / 6);
    const young = () => mi === 2 || mi === 3 ? [{ k: "stw", n: 1, thr: 4, txt: mi === 3 ? "young pause (4 threads evacuate eden)" : "gen0 GC (4 GC threads)" }]
      : mi === 4 ? [{ k: "stw", n: 0, txt: "young cycle starts (sub-ms pause)" }, { k: "conc", n: 1, cores: 1, txt: "young concurrent mark + relocate" }, { k: "stw", n: 0, txt: "" }]
      : [{ k: "stw", n: 1, thr: 1, txt: "gen0 GC (one thread, app stopped)" }];
    const old = () => [
      [{ k: "stw", n: full, thr: 1, txt: `blocking gen2 GC marks ${L} MB on one thread` }],
      [{ k: "stw", n: 1, thr: 1, txt: "background GC starts (short pause)" }, { k: "conc", n: full, cores: 1, txt: "background gen2 marking" }, { k: "stw", n: 1, thr: 1, txt: "background GC final pause" }],
      [{ k: "stw", n: 1, thr: 4, txt: "background GC starts (short pause)" }, { k: "conc", n: Math.ceil(L / 12), cores: 2, txt: "background gen2 marking on 2 threads" }, { k: "stw", n: 1, thr: 4, txt: "background GC final pause" }],
      [{ k: "stw", n: 1, thr: 4, txt: "young pause + initial mark" }, { k: "conc", n: full, cores: 1, txt: "concurrent marking of the old gen" }, { k: "stw", n: 1, thr: 4, txt: "remark + cleanup pause" }],
      [{ k: "stw", n: 0, txt: "major cycle starts (sub-ms pause)" }, { k: "conc", n: full, cores: 1, txt: "major concurrent mark + relocate" }, { k: "stw", n: 0, txt: "" }],
      [{ k: "stw", n: 0, txt: "sweep termination (sub-ms pause)" }, { k: "conc", n: full, cores: 1, assist: rate >= 3, txt: `concurrent mark of all ${L} MB on 1 of 4 cores` }, { k: "stw", n: 0, txt: "mark termination (sub-ms pause)" }],
    ][mi];
    const rows = Array.from({ length: C }, () => []), heap = [], marks = [], events = [], pauses = [];
    let g = 0, og = 0, peak = L, nGC = 0, nFull = 0, q = [], kind = null, cyc = 0, mixed = 0;
    const end = () => { if (kind === "full") { if (mi === 3) mixed = 2; else og = 0; } g = cyc; kind = null; };
    for (let t = 0; t < T; t++) {
      while (q.length && q[0].k === "stw" && q[0].n === 0) { pauses.push(0); marks.push(t); if (q[0].txt) events.push({ t, txt: q[0].txt }); q.shift(); if (!q.length) end(); }
      const ph = q[0];
      if (ph && ph.used === undefined) { ph.used = 0; ph.left = ph.n; if (ph.txt) events.push({ t, txt: ph.txt }); }
      let run = 0;
      for (let c = 0; c < C; c++) {
        let s = "run";
        if (ph && ph.k === "stw") s = c < ph.thr ? "gc" : "stw";
        else if (ph) s = c >= C - ph.cores ? "gc" : ph.assist && c === 0 && t % 2 === 0 ? "assist" : "run";
        if (s === "run") run++;
        rows[c].push(s);
      }
      const a = rate * run;
      g += a; if (kind) cyc += a;
      heap.push(L + og + g); peak = Math.max(peak, L + og + g);
      if (ph) {
        ph.left -= 1 + (ph.assist && t % 2 === 0 && ph.left > 2 ? 1 : 0);
        if (ph.left <= 0) { if (ph.k === "stw") pauses.push(ph.n); q.shift(); if (!q.length) end(); }
      }
      if (!kind && g >= Y) {
        nGC++; cyc = 0;
        const isFull = nGC % K === 0;
        kind = isFull ? "full" : "young";
        if (isFull) nFull++;
        if (!isFull && mixed > 0) { mixed--; og = Math.floor(og / 2); q = [{ k: "stw", n: 2, thr: 4, txt: "mixed pause: eden + the old regions with most garbage" }]; }
        else { if (!isFull) og += 2; q = (isFull ? old() : young()).map((p) => ({ ...p })); }
      }
    }
    const runCells = rows.flat().filter((s) => s === "run").length;
    return { rows, heap, marks, events, pauses, peak, nGC, nFull, T, thr: Math.round((100 * runCells) / (C * T)), maxPause: Math.max(0, ...pauses), total: pauses.reduce((x, y) => x + y, 0), anyPause: pauses.length > 0 };
  };
  Viz.register("memory-and-gc-pauses", (host) => Viz.player(host, {
    title: "Pause time vs throughput: same app, six collectors",
    tag: "GC MODES · LATENCY vs THROUGHPUT",
    legend: [["path", "app thread running"], ["active", "GC work"], ["bad", "stopped (stop-the-world)"], ["warn", "allocation assist"]],
    speed: 1000,
    codeLang: "bash",
    code: GCCODE[0],
    inputs: [
      { key: "mode", label: "collector", type: "select", options: GCM, value: GCM[0] },
      { key: "L", label: "live heap MB (8-60)", value: "48", width: 60 },
      { key: "rate", label: "alloc MB/ms per core (1-4)", value: "2", width: 50 },
    ],
    random: () => ({ mode: pick(GCM), L: String(Viz.rand(8, 60)), rate: String(Viz.rand(1, 4)) }),
    build: ({ mode, L, rate }) => {
      const mi = GCM.indexOf(mode), Lv = int(L, "live heap", 8, 60), r = int(rate, "allocation rate", 1, 4);
      const s = pauseSim(mi, Lv, r), fr = [];
      for (let t = 0; t < s.T; t += 6) {
        const ev = s.events.filter((e) => e.t >= t && e.t < t + 6);
        fr.push({ mi, s, upTo: t + 6, line: ev.length ? [3, 4] : null, vars: { "ms shown": `${t}-${t + 5}`, "heap MB now": s.heap[t + 5], "GC events": s.events.filter((e) => e.t < t + 6).length },
          note: ev.length ? ev.map((e) => `<b>t=${e.t} ms</b>: ${esc(e.txt)}`).join("<br>") : `The app runs on all cores and allocates ${r * 4} MB/ms. No GC in this window.` });
      }
      const pz = s.anyPause && s.maxPause === 0 ? "under 1 ms" : `${s.maxPause} ms`;
      fr.push({ ...fr[fr.length - 1], line: null, final: { maxPause: s.maxPause, thr: s.thr, peak: s.peak }, note: `<b>${esc(mode)}</b>: worst pause ${pz}, app threads did useful work in ${s.thr}% of core time, heap peaked at ${s.peak} MB (live data is ${Lv} MB). ${[
        "Fine for a one-core batch job; terrible for a latency SLO, because every full GC freezes everything for a time proportional to the live heap.",
        "Background GC removes the long gen2 freeze; the young pauses stay but they are short because young data is small.",
        "More threads and bigger budgets: fewer, shorter pauses and the best throughput, paid for with memory. Watch out when many Server-GC processes share a box.",
        "G1 balances: short parallel young pauses, old gen marked concurrently, garbage-rich regions cleaned in mixed pauses.",
        "Pauses no longer depend on heap size. You pay with CPU for concurrent work and barriers, and with headroom: if allocation outruns the collector, threads stall.",
        `Go trades memory (the heap grows to 2x live, more when objects allocated during marking are kept until the next cycle) and a slice of CPU for tiny pauses. ${r >= 3 ? "At this allocation rate goroutines are drafted into marking (assists): latency hides inside your own code." : "Raise the allocation rate to see goroutines pay assist work."}`][mi]}` });
      return fr;
    },
    render: (f) => {
      setCode(host, GCCODE[f.mi], "bash");
      const s = f.s, cell = { run: "path", gc: "active", stw: "bad", assist: "warn" };
      const row = (lab, cells) => `<div class="mg-tl-row"><span class="mg-tl-lab">${lab}</span>${cells}</div>`;
      const cores = s.rows.map((r, c) => row(`core ${c}`, r.map((x, t) => `<i class="mg-tc ${t < f.upTo ? cell[x] : "fut"}${s.marks.includes(t) && t < f.upTo ? " tick" : ""}" title="t=${t} ms: ${x}"></i>`).join(""))).join("");
      const hmax = Math.max(...s.heap);
      const hp = row("heap", s.heap.map((h, t) => `<i class="mg-hb${t < f.upTo ? "" : " fut"}" style="height:${Math.round((26 * h) / hmax) + 2}px" title="${h} MB"></i>`).join(""));
      const mp = s.anyPause && s.maxPause === 0 ? "<1 ms" : `${s.maxPause} ms`;
      return `<div class="mg-tl">${cores}${hp}<div class="mg-tl-row"><span class="mg-tl-lab"></span><span class="mg-tl-axis">0 ms</span><span class="mg-tl-axis r">${s.T} ms</span></div></div>${f.final ? stats([["worst pause", mp, s.maxPause >= 5 ? "bad" : "done"], ["total stop-the-world", `${s.total} ms`], ["app throughput", `${s.thr}%`, s.thr >= 85 ? "done" : ""], ["peak heap", `${s.peak} MB`], ["GC cycles (of which full/major)", `${s.nGC} (${s.nFull})`]]) : ""}`;
    },
  }));

  /* =====================================================================
   * 11. JVM G1: a heap made of regions
   * ===================================================================== */
  const RG_N = 40, RG_CAP = 4;
  Viz.register("memory-and-gc-regions", (host) => Viz.player(host, {
    title: "G1 regions: eden, survivors, old, humongous, mixed collections",
    tag: "JVM G1 · REGION-BASED GENERATIONAL GC",
    legend: [["visit", "Eden"], ["active", "Survivor (age)"], ["done", "Old"], ["path", "Humongous"], ["bad", "full GC"]],
    speed: 1300,
    codeLang: "bash",
    code: ["java -XX:+UseG1GC -Xmx160m            # 40 regions x 4 MB", "     -XX:G1HeapRegionSize=4m         # objects >= 2 MB are humongous", "     -XX:InitiatingHeapOccupancyPercent=45", "     -XX:MaxTenuringThreshold=2       # survivor ages before promotion", "     -XX:G1MixedGCCountTarget=2       # (default 8) mixed GCs after marking", "     -jar app.jar"],
    inputs: [
      { key: "eden", label: "eden regions per cycle", value: "7", width: 50 },
      { key: "surv", label: "survival % (0-75)", value: "45", width: 50 },
      { key: "thr", label: "tenuring threshold", value: "1", width: 40 },
      { key: "hum", label: "humongous every N cycles (0=never)", value: "3", width: 40 },
      { key: "cycles", label: "cycles", value: "8", width: 40 },
      { key: "seed", label: "seed", value: "7", width: 50 },
    ],
    random: () => ({ eden: String(Viz.rand(3, 10)), surv: String(Viz.rand(0, 75)), thr: String(Viz.rand(1, 4)), hum: String(Viz.rand(0, 4)), cycles: String(Viz.rand(2, 10)), seed: String(Viz.rand(1, 999)) }),
    build: (inp) => {
      const E = int(inp.eden, "eden regions", 3, 10), P = int(inp.surv, "survival %", 0, 75) / 100, THR = int(inp.thr, "tenuring threshold", 1, 4);
      const HUM = int(inp.hum, "humongous every N", 0, 4), CY = int(inp.cycles, "cycles", 2, 10), rng = mulberry(int(inp.seed, "seed", 0, 99999));
      const code = ["java -XX:+UseG1GC -Xmx160m            # 40 regions x 4 MB", "     -XX:G1HeapRegionSize=4m         # objects >= 2 MB are humongous", "     -XX:InitiatingHeapOccupancyPercent=45", `     -XX:MaxTenuringThreshold=${THR}       # survivor ages before promotion`, "     -XX:G1MixedGCCountTarget=2       # (default 8) mixed GCs after marking", "     -jar app.jar"];
      const R = Array.from({ length: RG_N }, () => ({ t: "F", live: 0, garb: 0, age: 0 }));
      const fr = [];
      let ok = true, oom = false, nFull = 0, nYoung = 0, nMixed = 0, mixedLeft = 0;
      const count = (t) => R.filter((r) => r.t === t).length;
      const occ = () => Math.round((100 * (count("O") + count("H"))) / RG_N);
      const snap = (line, note, sel = [], bad = false) => fr.push({ code, line, note, R: clone(R), sel, bad,
        vars: { eden: count("E"), survivor: count("S"), old: count("O"), humongous: count("H"), free: count("F"), "old occupancy": `${occ()}%` } });
      const freeIdx = () => R.map((r, i) => (r.t === "F" ? i : -1)).filter((i) => i >= 0);
      const pack = (units, t, age, out = []) => { while (units > 0) { const i = freeIdx()[0]; if (i === undefined) return false; const n = Math.min(RG_CAP, units); R[i] = { t, live: n, garb: 0, age }; out.push(i); units -= n; } return true; };
      const fullGC = (why) => {
        nFull++;
        snap(0, `<b>Full GC</b> (${why}). G1 falls back to a stop-the-world compaction of the whole heap: the slowest thing a JVM can do. In production you see "Pause Full (G1 Compaction Pause)" in the GC log.`, R.map((r, i) => (r.t !== "F" ? i : -1)).filter((i) => i >= 0), true);
        let units = 0;
        R.forEach((r, i) => { if (r.t === "H" && !r.dead) return; if (r.t !== "F" && !r.dead) units += r.live; R[i] = { t: "F", live: 0, garb: 0, age: 0 }; });
        const before = units;
        if (!pack(units, "O", 0)) { oom = true; return; }
        if (R.filter((r) => r.t === "O").reduce((a, r) => a + r.live, 0) !== before) ok = false;
        mixedLeft = 0;
        snap(0, `After the full GC every live object is packed into ${count("O")} old regions. ${count("F")} regions are free again.`);
      };
      const needFree = (n, contiguous, why) => {
        const find = () => { const f = freeIdx(); if (!contiguous) return f.length >= n ? f.slice(0, n) : null; for (const i of f) if (R[i + 1] && R[i + 1].t === "F") return [i, i + 1]; return null; };
        let got = find();
        if (!got) { fullGC(why); if (oom) return null; got = find(); }
        if (!got) oom = true;
        return got;
      };
      snap(null, `The heap is ${RG_N} equal regions (4 MB each here). A region is not permanently "young" or "old": it gets a role when it is handed out and becomes free again when collected.`);
      for (let c = 1; c <= CY && !oom; c++) {
        let died = 0;
        R.forEach((r) => { if (r.t !== "O") return; for (let u = r.live; u > 0; u--) if (rng() < 0.2) { r.live--; r.garb++; died++; } });
        if (HUM && c % HUM === 0) {
          R.forEach((r) => { if (r.t === "H") r.dead = true; });
          const got = needFree(2, true, "no two adjacent free regions for a humongous object");
          if (!got) break;
          got.forEach((i, k) => { R[i] = { t: "H", live: RG_CAP, garb: 0, age: 0, cont: k > 0 }; });
          snap(1, `Cycle ${c}: the app allocates a 6 MB array. Anything at least half a region is <b>humongous</b>: it skips eden and goes straight into contiguous old regions. ${count("H") > 2 ? "The previous humongous array is now unreferenced, but its regions stay occupied until G1 reclaims them." : ""}`, got);
        }
        const eden = needFree(E, false, "no free region for new allocations");
        if (!eden) break;
        eden.forEach((i) => { let live = 0; for (let u = 0; u < RG_CAP; u++) if (rng() < P) live++; R[i] = { t: "E", live, garb: RG_CAP - live, age: 0 }; });
        snap(0, `Cycle ${c}: the app fills ${E} eden regions (dark part of a bar = still-live objects, about ${Math.round(P * 100)}% survive). ${died ? `Meanwhile ${died} units of old objects died: old regions accumulate garbage that young pauses never look at.` : ""}`, eden);
        const cset = R.map((r, i) => (r.t === "E" || r.t === "S" ? i : -1)).filter((i) => i >= 0);
        const mixed = mixedLeft > 0;
        if (mixed) R.map((r, i) => [r, i]).filter(([r]) => r.t === "O" && r.garb >= 2).sort((a, b) => b[0].garb - a[0].garb).slice(0, 3).forEach(([, i]) => cset.push(i));
        const byAge = {}; let toOld = 0, liveIn = 0;
        cset.forEach((i) => { const r = R[i]; liveIn += r.live; if (r.t === "O") { toOld += r.live; return; } const a = r.t === "E" ? 1 : r.age + 1; if (a > THR) toOld += r.live; else byAge[a] = (byAge[a] || 0) + r.live; });
        snap(mixed ? 4 : 3, `${mixed ? "<b>Mixed</b>" : "<b>Young</b>"} pause (stop-the-world, all GC threads): the collection set is ${cset.length} regions${mixed ? `, including old regions with the most garbage` : ""}. Live objects are <b>copied</b> out (evacuated); the source regions are then freed whole, so there is no separate sweep and no fragmentation.`, cset);
        const need = Object.values(byAge).reduce((a, u) => a + Math.ceil(u / RG_CAP), 0) + Math.ceil(toOld / RG_CAP);
        if (need > freeIdx().length) { fullGC("to-space exhausted: no free regions to evacuate into"); if (oom) break; continue; }
        const dest = [];
        Object.keys(byAge).forEach((a) => pack(byAge[a], "S", Number(a), dest));
        pack(toOld, "O", 0, dest);
        cset.forEach((i) => { R[i] = { t: "F", live: 0, garb: 0, age: 0 }; });
        const reclaimed = R.filter((r) => r.t === "H" && r.dead).length;
        R.forEach((r, i) => { if (r.t === "H" && r.dead) R[i] = { t: "F", live: 0, garb: 0, age: 0 }; });
        const liveOut = Object.values(byAge).reduce((a, b) => a + b, 0) + toOld;
        if (liveOut !== liveIn) ok = false;
        mixed ? (nMixed++, mixedLeft--) : nYoung++;
        snap(3, `${liveIn} live units copied: ${Object.keys(byAge).length ? Object.entries(byAge).map(([a, u]) => `${u} to survivor regions at age ${a}`).join(", ") : "none to survivors"}, ${toOld} promoted to old (age above ${THR}${mixed ? ", plus live data from the old regions in the set" : ""}). ${reclaimed ? `The dead humongous array (${reclaimed} regions) is reclaimed eagerly.` : ""}`, dest);
        if (!mixedLeft && occ() >= 45) {
          snap(2, `Old + humongous occupancy is ${occ()}%, past the 45% IHOP. G1 starts <b>concurrent marking</b>: GC threads trace the old generation while the app keeps running, measuring how much garbage each old region holds.`, R.map((r, i) => (r.t === "O" || r.t === "H" ? i : -1)).filter((i) => i >= 0));
          mixedLeft = 2;
          snap(4, `Marking done. The next ${mixedLeft} pauses are <b>mixed</b>: eden and survivors plus the old regions with the most garbage first (that is the "garbage first" in G1).`);
        }
      }
      fr.push({ ...fr[fr.length - 1], line: null, final: { ok, oom, nFull }, note: oom ? `<b>java.lang.OutOfMemoryError: Java heap space.</b> Even a full GC could not find room: the live data is bigger than the heap. Increase -Xmx or find what is keeping objects alive (a heap dump will show the dominators).` : `${nYoung} young pauses, ${nMixed} mixed, ${nFull} full. ${nFull ? "A full GC means G1 lost the race: raise the heap, lower survival (less caching of short-lived data), or start marking earlier." : "No full GC: G1 kept up. That is the goal: pauses only proportional to the regions in each collection set, never to the whole heap."}` });
      return fr;
    },
    render: (f) => {
      setCode(host, f.code, "bash");
      const cls = { F: "", E: "visit", S: "active", O: "done", H: "path" };
      const cells = f.R.map((r, i) => `<div class="mg-rg ${f.bad && f.sel.includes(i) ? "bad" : cls[r.t]}${f.sel.includes(i) ? " sel" : ""}${r.dead ? " dead" : ""}" title="region ${i}: ${r.t}${r.t !== "F" ? `, live ${r.live}/${RG_CAP}` : ""}"><b>${r.t === "F" ? "" : r.t}${r.t === "S" ? `<small>${r.age}</small>` : ""}</b><span class="mg-rg-bar"><i style="width:${(100 * r.live) / RG_CAP}%"></i></span></div>`).join("");
      const c = (t) => f.R.filter((r) => r.t === t).length;
      return `<div class="mg-rgrid">${cells}</div>${stats([["eden", c("E")], ["survivor", c("S")], ["old", c("O")], ["humongous", c("H")], ["free", c("F"), c("F") < 6 ? "bad" : ""], ["old occupancy", `${Math.round((100 * (c("O") + c("H"))) / RG_N)}% (IHOP 45%)`]])}${f.final ? verdict(f.final.oom ? "OutOfMemoryError" : f.final.nFull ? `${f.final.nFull} full GC(s)` : "no full GC", f.final.oom ? "bad" : f.final.nFull ? "warn" : "done") : ""}`;
    },
  }));

  /* =====================================================================
   * 12. V8 scavenger: Cheney's copying collector for the young generation
   * ===================================================================== */
  const SC_LET = "ABCDEFGH";
  const SC_CODE = [
    "for (const r of roots) r.ptr = evacuate(r.ptr);   // stack, globals, remembered set",
    "while (scan < free || promoted.length) {",
    "  const obj = scan < free ? toSpace[scan++] : promoted.shift()!;",
    "  for (const f of obj.fields) f.ptr = evacuate(f.ptr);",
    "}",
    "function evacuate(o: HeapObject): HeapObject {",
    "  if (o.forwardingAddress) return o.forwardingAddress;   // already moved",
    "  const copy = o.survivedOnce ? oldSpace.copy(o)        // promote",
    "                              : (toSpace[free++] = o.clone());",
    "  o.forwardingAddress = copy;                           // leave a forwarding pointer",
    "  return copy;",
    "}",
    "[fromSpace, toSpace] = [toSpace, fromSpace];           // flip: old from-space is all free",
  ];
  Viz.register("memory-and-gc-scavenge", (host) => Viz.player(host, {
    title: "V8 scavenger: copy the survivors, forget the rest",
    tag: "SEMI-SPACE COPYING · CHENEY'S ALGORITHM",
    legend: [["active", "being scanned"], ["done", "copied (forwarded)"], ["path", "promoted to old space"], ["visit", "scanned"], ["bad", "garbage: never touched"]],
    speed: 1100,
    codeLang: "typescript",
    code: SC_CODE,
    inputs: [
      { key: "refs", label: "pointers (from>to)", value: "root>B B>D D>B root>E E>G A>C F>H", width: 260 },
      { key: "old", label: "survived one scavenge already", value: "E", width: 80 },
    ],
    random: () => {
      const n = Viz.rand(5, 8), L = SC_LET.slice(0, n).split(""), es = new Set([`root>${pick(L)}`]);
      for (let k = 0; k < n; k++) es.add(`${pick(L)}>${pick(L)}`);
      if (Math.random() < 0.6) es.add(`root>${pick(L)}`);
      return { refs: [...es].join(" "), old: L.filter(() => Math.random() < 0.25).join(",") };
    },
    build: ({ refs, old }) => {
      const { edges, objs } = parseRefs(refs, 8, SC_LET);
      const oldSet = String(old).toUpperCase().split(/[\s,;]+/).filter(Boolean);
      for (const o of oldSet) if (!objs.includes(o)) throw new Error(`"${o}" is not an object in the pointer list. Name objects that appear in it, or leave this empty.`);
      const live = reach(edges);
      const fwd = {}, to = [], oldSp = [], promoted = [], fixed = [];
      let scan = 0, cur = null, flipped = false;
      const fr = [];
      const snap = (line, note) => fr.push({ objs, edges, oldSet, line, note, fwd: { ...fwd }, to: [...to], oldSp: [...oldSp], promoted: [...promoted], fixed: [...fixed], scan, cur, flipped,
        vars: { scan, free: to.length, "to-space": to.join(" ") || "—", "old space": oldSp.join(" ") || "—", "promotion queue": promoted.join(" ") || "—" } });
      const evac = (x, via) => {
        if (fwd[x]) { snap([6], `${via}: ${x} already has a forwarding pointer (→ ${fwd[x]}), so the pointer is just updated. This is what makes cycles and shared objects safe: each object is copied exactly once.`); return; }
        if (oldSet.includes(x)) { oldSp.push(x); promoted.push(x); fwd[x] = `old[${oldSp.length - 1}]`; snap([7, 9], `${via}: ${x} survived a scavenge before, so it is <b>promoted</b>: copied straight into old space (and queued so its fields get scanned too).`); return; }
        to.push(x); fwd[x] = `to[${to.length - 1}]`;
        snap([8, 9], `${via}: copy ${x} to <code>to[${to.length - 1}]</code> (bump <code>free</code> to ${to.length}) and overwrite the old copy's header with a forwarding pointer.`);
      };
      snap(null, `New objects are bump-allocated into the young generation's <b>from-space</b> (${objs.join(" ")}). When it is full, V8 stops the thread for a <b>scavenge</b>. Nothing is marked and nothing is swept: the survivors are copied and everything left behind is garbage by definition.`);
      edges.filter((e) => e.u === "root").forEach((e) => evac(e.v, `root → ${e.v}`));
      while (scan < to.length || promoted.length) {
        cur = scan < to.length ? to[scan++] : promoted.shift();
        const kids = edges.filter((e) => e.u === cur);
        snap([1, 2], `Scan ${cur}. ${scan <= to.length && fwd[cur].startsWith("to") ? "The region between <code>scan</code> and <code>free</code> <b>is</b> the work queue: no extra stack or mark bits needed (Cheney, 1970)." : "A promoted object's fields can point back into the young generation, so it is scanned as well."} ${kids.length ? `It points to ${kids.map((e) => e.v).join(", ")}.` : "It has no pointers."}`);
        for (const e of kids) { evac(e.v, `${cur}.field → ${e.v}`); fixed.push(`${e.u}>${e.v}`); }
        cur = null;
      }
      const garbage = objs.filter((o) => !fwd[o]);
      flipped = true;
      const ok = garbage.every((o) => !live.has(o)) && objs.filter((o) => live.has(o)).every((o) => fwd[o]);
      snap(12, `Flip. ${garbage.length ? `${garbage.join(", ")} ${garbage.length > 1 ? "were" : "was"} never reached, never touched, and ${garbage.length > 1 ? "are" : "is"} gone with the whole old from-space.` : "Every object survived this time, so the scavenge copied everything: the worst case."} Cost is proportional to <b>survivors</b> (${to.length + oldSp.length}), not to heap size.`);
      fr.push({ ...fr[fr.length - 1], line: null, final: { ok, copied: [...to, ...oldSp].sort(), garbage }, note: `Why this works for JavaScript: most objects (closures, temporary arrays, promise results) die young, so a scavenge copies little and takes about a millisecond. It also <b>compacts</b> for free. The price: half the young space is always empty, and copying long-lived data again and again is wasteful, which is why survivors are promoted after one or two scavenges. The old generation uses mark-sweep-compact instead, mostly concurrently.` });
      return fr;
    },
    render: (f) => {
      const R = f.objs.length > 6 ? 120 : 105;
      const pos = Viz.layout.circle(f.objs, R);
      const st = (o) => (f.cur === o ? "active" : f.fwd[o] ? (f.fwd[o].startsWith("old") ? "path" : "done") : f.flipped ? "bad" : "");
      const nodes = [{ id: "root", x: 0, y: 0, label: "root", cls: "" }].concat(pos.map((p) => ({ ...p, label: p.id, sub: f.fwd[p.id] ? `→ ${f.fwd[p.id]}` : "", cls: st(p.id) })));
      const g = Viz.graph({ nodes, edges: f.edges.filter((e) => e.u !== e.v).map((e) => ({ ...e, cls: f.fixed.includes(`${e.u}>${e.v}`) ? "done" : "" })) }, { directed: true, r: 18, label: "object graph" });
      const from = f.objs.map((o) => `<div class="mg-ch ${f.flipped ? (f.fwd[o] ? "dim" : "bad") : f.fwd[o] ? "done" : ""}"><b>${o}</b><small>${f.fwd[o] ? `→ ${f.fwd[o]}` : "&nbsp;"}</small></div>`).join("");
      const freeAt = f.to.length;
      const to = Array.from({ length: Math.max(f.objs.length, 1) }, (_, i) => {
        const o = f.to[i];
        const cls = o === undefined ? "" : f.cur === o ? "active" : i < f.scan ? "visit" : "done";
        const ptr = [i === f.scan ? "scan" : "", i === freeAt ? "free" : ""].filter(Boolean).join(" / ");
        return `<div class="mg-ch ${cls}"><b>${o ?? "&nbsp;"}</b><small>${ptr ? `↑${ptr}` : "&nbsp;"}</small></div>`;
      }).join("");
      const oldC = f.oldSp.map((o) => `<div class="mg-ch path"><b>${o}</b><small>${f.cur === o ? "scanning" : f.promoted.includes(o) ? "queued" : "scanned"}</small></div>`).join("");
      return `<div class="mg-mark"><div>${g}</div><div class="mg-side">${Viz.labeled(f.flipped ? "old from-space (now free)" : "from-space (full)", `<div class="mg-chars">${from}</div>`)}${Viz.labeled(f.flipped ? "to-space (now the from-space)" : "to-space", `<div class="mg-chars">${to}</div>`)}${Viz.labeled("old space (promoted)", oldC ? `<div class="mg-chars">${oldC}</div>` : `<div class="mg-q">${empty("nothing promoted")}</div>`)}${f.final ? verdict(`copied ${f.final.copied.join(" ") || "nothing"} · garbage ${f.final.garbage.join(" ") || "none"}`, f.final.ok ? "done" : "bad") : ""}</div></div>`;
    },
  }));
})();
