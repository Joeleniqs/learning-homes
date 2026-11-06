/* Types and immutability: visualizers. Every frame comes from running a small model of the rule being taught. */
(() => {
  const S = "types-and-immutability-";
  const esc = Viz.esc;
  const LANGS = ["C#", "Java", "Python", "Go", "TypeScript"];
  const LID = { "C#": "csharp", Java: "java", Python: "python", Go: "go", TypeScript: "typescript" };
  const pick = (v, opts) => (opts.includes(v) ? v : opts[0]);
  const chip = (k, v, cls = "") => `<span class="ti-chip ${cls}"><b>${esc(k)}</b> ${esc(v)}</span>`;
  const chips = (...c) => `<div class="ti-chips">${c.filter(Boolean).join("")}</div>`;
  function arrow(x1, y1, x2, y2, cls = "", dash = false) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 8, w = 4;
    const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]].map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" ");
    return `<g class="ti-arr ${cls}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" ${dash ? 'stroke-dasharray="5 4"' : ""}/><polygon points="${p}"/></g>`;
  }
  /* Re-mounts the player when a select changes something static (code panel, option lists). */
  function adaptive(host, make, init) {
    const mount = (vals) => {
      const cfg = make(vals);
      const sig = cfg.sig;
      const inner = document.createElement("div");
      host.replaceChildren(inner);
      const build = cfg.build, render = cfg.render;
      cfg.build = (v) => {
        if (make(v).sig !== sig) { setTimeout(() => mount(v), 0); return [{ note: "Switching…", pending: true }]; }
        return build(v);
      };
      cfg.render = (f, ctx) => (f.pending ? '<div class="ti-muted">…</div>' : render(f, ctx));
      Viz.player(inner, cfg);
      inner.querySelector(".viz-inputs")?.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") e.target.form.requestSubmit(); });
    };
    mount(init);
  }

  /* ================= 1. states: count what the type allows vs what the business allows ================= */
  const STATES = {
    "Order lifecycle": {
      fields: [["paid", "isPaid"], ["shipped", "isShipped"], ["cancelled", "isCancelled"], ["tracking", "trackingNo"]],
      rules: [["shipped ⇒ paid", (s) => !s.shipped || s.paid, 6, "an order cannot ship before it is paid"],
        ["tracking ⇔ shipped", (s) => s.tracking === s.shipped, 7, "a tracking number exists exactly when the parcel has shipped"],
        ["cancelled ⇒ not shipped", (s) => !(s.cancelled && s.shipped), 8, "a shipped order is returned, not cancelled"]],
      cases: [["Unpaid", (s) => !s.paid && !s.cancelled, 12], ["Paid", (s) => s.paid && !s.shipped && !s.cancelled, 13], ["Shipped", (s) => s.shipped, 14], ["Cancelled", (s) => s.cancelled, 15]],
      code: ["// flags: 4 independent fields", "class Order {", "  isPaid = false;  isShipped = false;", "  isCancelled = false;", "  trackingNo: string | null = null;", "}  // the rules live in comments:",
        "//   shipped ⇒ paid", "//   tracking ⇔ shipped", "//   cancelled ⇒ not shipped", "", "// union: only legal states exist", "type Order =",
        '  | { kind: "unpaid" }', '  | { kind: "paid"; paidAt: Date }', '  | { kind: "shipped"; trackingNo: string }', '  | { kind: "cancelled"; refundDue: boolean };'],
    },
    "Connection": {
      fields: [["connecting", "isConnecting"], ["connected", "isConnected"], ["socket", "socket"], ["error", "lastError"]],
      rules: [["not connecting and connected", (s) => !(s.connecting && s.connected), 6, "it is either still connecting or already connected"],
        ["socket ⇔ connected", (s) => s.socket === s.connected, 7, "an open socket exists exactly while connected"],
        ["error ⇒ idle", (s) => !s.error || (!s.connecting && !s.connected), 8, "an error belongs to a failed, idle connection"]],
      cases: [["Disconnected", (s) => !s.connecting && !s.connected && !s.error, 12], ["Connecting", (s) => s.connecting, 13], ["Connected", (s) => s.connected, 14], ["Failed", (s) => s.error, 15]],
      code: ["// flags: 4 independent fields", "class Connection {", "  isConnecting = false;  isConnected = false;", "  socket: Socket | null = null;", "  lastError: Error | null = null;", "}  // the rules live in comments:",
        "//   not (connecting and connected)", "//   socket ⇔ connected", "//   error ⇒ not connecting, not connected", "", "// union: only legal states exist", "type Connection =",
        '  | { kind: "disconnected" }', '  | { kind: "connecting"; attempt: number }', '  | { kind: "connected"; socket: Socket }', '  | { kind: "failed"; error: Error };'],
    },
    "Contact info": {
      fields: [["email", "email"], ["emailOk", "emailVerified"], ["phone", "phone"], ["phoneOk", "phoneVerified"]],
      rules: [["at least one way to reach them", (s) => s.email || s.phone, 6, "a customer we cannot contact is useless"],
        ["emailVerified ⇒ email", (s) => !s.emailOk || s.email, 7, "you cannot verify an address you do not have"],
        ["phoneVerified ⇒ phone", (s) => !s.phoneOk || s.phone, 8, "you cannot verify a number you do not have"]],
      cases: [["EmailOnly", (s) => s.email && !s.phone, 12], ["PhoneOnly", (s) => s.phone && !s.email, 13], ["EmailAndPhone", (s) => s.email && s.phone, 14]],
      code: ["// flags: 2 nullables + 2 booleans", "class Contact {", "  email: string | null = null;  emailVerified = false;", "  phone: string | null = null;  phoneVerified = false;", "", "}  // the rules live in comments:",
        "//   email or phone (or both)", "//   emailVerified ⇒ email", "//   phoneVerified ⇒ phone", "", "// union: only legal states exist (Wlaschin's example)", "type Contact =",
        '  | { kind: "emailOnly"; email: Checked<Email> }', '  | { kind: "phoneOnly"; phone: Checked<Phone> }', '  | { kind: "both"; email: Checked<Email>; phone: Checked<Phone> };', "type Checked<T> = { value: T; verified: boolean };"],
    },
  };
  function simulateStates(name) {
    const sc = STATES[name], k = sc.fields.length, n = 1 << k;
    const combos = [...Array(n).keys()].map((m) => Object.fromEntries(sc.fields.map(([f], b) => [f, !!(m & (1 << (k - 1 - b)))])));
    const verdicts = Array(n).fill(null);
    const counts = Object.fromEntries(sc.cases.map(([c]) => [c, 0]));
    const frames = [];
    let legal = 0, illegal = 0;
    const snap = (o) => frames.push({ name, combos, verdicts: verdicts.slice(), counts: { ...counts }, ...o, vars: { checked: legal + illegal, legal, illegal, ...(o.vars || {}) } });
    snap({ line: [1, 2, 3, 4], note: `${k} independent fields give the class <b>2<sup>${k}</sup> = ${n}</b> possible values. The type allows every one of them; the business allows far fewer. Check each combination against the rules.` });
    combos.forEach((s, i) => {
      const broken = sc.rules.find(([, ok]) => !ok(s));
      const desc = sc.fields.map(([f, label]) => `${label}=${s[f] ? (/^(paid|shipped|cancelled|connecting|connected|emailOk|phoneOk)$/.test(f) ? "true" : "set") : (/^(paid|shipped|cancelled|connecting|connected|emailOk|phoneOk)$/.test(f) ? "false" : "null")}`).join(", ");
      if (broken) {
        illegal++; verdicts[i] = { ok: false, why: broken[0] };
        snap({ cur: i, line: broken[2], note: `<code>${esc(desc)}</code> breaks <b>${esc(broken[0])}</b>: ${esc(broken[3])}. The flags type stores it anyway, so every reader must remember to reject it.` });
      } else {
        const cs = sc.cases.filter(([, m]) => m(s));
        if (cs.length !== 1) throw new Error(`model error: combination ${i} maps to ${cs.length} cases`);
        legal++; counts[cs[0][0]]++; verdicts[i] = { ok: true, why: cs[0][0] };
        snap({ cur: i, line: cs[0][2], note: `<code>${esc(desc)}</code> is legal. In the union it is the <b>${esc(cs[0][0])}</b> case, and the case carries exactly the data that state needs.` });
      }
    });
    snap({ done: true, line: sc.cases.map(([, , l]) => l), note: `<b>${n}</b> representable, <b>${legal}</b> legal: ${illegal} states (${Math.round((100 * illegal) / n)}%) can exist only as bugs. The union has ${sc.cases.length} cases that cover exactly the ${legal} legal states, so the rule comments become unnecessary: illegal values cannot be constructed.` });
    return frames;
  }
  Viz.register(S + "states", (el) => adaptive(el, (v) => {
    const name = pick(v.s, Object.keys(STATES)), sc = STATES[name];
    return {
      sig: name, title: "Count the states: flags vs a union", tag: "SIMULATION · ENUMERATE 2^k",
      legend: [["active", "being checked"], ["bad", "illegal but representable"], ["done", "legal → union case"]],
      code: sc.code, codeLang: "typescript",
      inputs: [{ key: "s", label: "model", type: "select", options: Object.keys(STATES), value: name }],
      build: (i) => simulateStates(pick(i.s, Object.keys(STATES))),
      random: () => ({ s: Object.keys(STATES)[Viz.rand(0, 2)] }),
      render: (f) => {
        const cells = f.combos.map((s, i) => {
          const v = f.verdicts[i], cls = i === f.cur ? "active" : v ? (v.ok ? "done" : "bad") : "";
          const tags = sc.fields.map(([fl]) => `<i class="${s[fl] ? "on" : "off"}">${esc(fl)}</i>`).join("");
          return `<div class="ti-state ${cls}"><div class="ti-tags">${tags}</div><small>${v ? (v.ok ? "✓ " : "✗ ") + esc(v.why) : "?"}</small></div>`;
        }).join("");
        const cases = sc.cases.map(([c]) => `<div class="ti-case ${f.counts[c] ? "done" : ""}"><b>${esc(c)}</b><span>${f.counts[c]} state${f.counts[c] === 1 ? "" : "s"}</span></div>`).join("");
        return `<div class="ti-states">${cells}</div><div class="ti-caption">union cases</div><div class="ti-cases">${cases}</div>`;
      },
    };
  }, { s: "Order lifecycle" }));

  /* ================= 2. aliasing: who else can change the list your object holds? ================= */
  // field: how the constructor stores the caller's list; getter: what Items hands out; block: what stops a write through Items
  const ALIAS = {
    "C#": {
      caller: ['var tags = new List<string> { "a", "b" };', "var order = new Order(tags);", 'tags[0] = "z";              // caller reuses its list', 'order.Items[1] = "hacked";  // a consumer writes via Items', 'Console.WriteLine(string.Join(",", order.Items));', "", "class Order(List<string> tags) {"],
      tail: "}",
      strat: {
        "share the reference": { field: "ref", getter: "same", cls: ["    public List<string> Items { get; } = tags;"] },
        "copy in": { field: "copy", getter: "same", cls: ["    public List<string> Items { get; } = new(tags);"] },
        "read-only view, no copy": { field: "view", getter: "same", cls: ["    public IReadOnlyList<string> Items { get; } = tags.AsReadOnly();"], block: ["compile", "error CS0200: Property or indexer 'IReadOnlyList<string>.this[int]' cannot be assigned to -- it is read only"] },
        "copy in + read-only out": { field: "copy", getter: "view", cls: ["    private readonly List<string> _items = new(tags);", "    public IReadOnlyList<string> Items => _items.AsReadOnly();"], block: ["compile", "error CS0200: Property or indexer 'IReadOnlyList<string>.this[int]' cannot be assigned to -- it is read only"] },
        "immutable collection": { field: "imm", getter: "same", cls: ["    public ImmutableArray<string> Items { get; } = [.. tags];"], block: ["compile", "error CS0200: Property or indexer 'ImmutableArray<string>.this[int]' cannot be assigned to -- it is read only"] },
      },
    },
    Java: {
      caller: ['var tags = new ArrayList<>(List.of("a", "b"));', "var order = new Order(tags);", 'tags.set(0, "z");               // caller reuses its list', 'order.items().set(1, "hacked");  // a consumer writes via items()', "System.out.println(order.items());", "", "record Order(List<String> items) {"],
      tail: "}",
      strat: {
        "share the reference": { field: "ref", getter: "same", cls: ["    // canonical constructor keeps the caller's list"] },
        "copy in": { field: "copy", getter: "same", cls: ["    Order { items = new ArrayList<>(items); }"] },
        "read-only view, no copy": { field: "view", getter: "same", cls: ["    Order { items = Collections.unmodifiableList(items); }"], block: ["runtime", "java.lang.UnsupportedOperationException\n    at java.util.Collections$UnmodifiableList.set"] },
        "immutable collection": { field: "imm", getter: "same", cls: ["    Order { items = List.copyOf(items); }"], block: ["runtime", "java.lang.UnsupportedOperationException\n    at java.util.ImmutableCollections.uoe"] },
      },
    },
    Python: {
      caller: ['tags = ["a", "b"]', "order = Order(tags)", 'tags[0] = "z"             # caller reuses its list', 'order.items[1] = "hacked"  # a consumer writes via items', 'print(",".join(order.items))', "", "@dataclass(frozen=True)", "class Order:"],
      tail: "",
      strat: {
        "share the reference": { field: "ref", getter: "same", cls: ["    items: list[str]          # frozen freezes the field, not the list"] },
        "copy in": { field: "copy", getter: "same", cls: ["    items: list[str]", "    def __post_init__(self): object.__setattr__(self, 'items', list(self.items))"] },
        "Sequence hint, no copy": { field: "ref", getter: "same", cls: ["    items: Sequence[str]      # read-only to the type checker only"], block: ["checker", 'error: Unsupported target for indexed assignment ("Sequence[str]")  [index]'] },
        "immutable tuple": { field: "imm", getter: "same", cls: ["    items: tuple[str, ...]", "    def __post_init__(self): object.__setattr__(self, 'items', tuple(self.items))"], block: ["runtime", "TypeError: 'tuple' object does not support item assignment"] },
      },
    },
    Go: {
      caller: ['tags := []string{"a", "b"}', "order := NewOrder(tags)", 'tags[0] = "z"                 // caller reuses its slice', 'order.Items()[1] = "hacked"   // a consumer writes via Items()', "fmt.Println(order.Items())", "", "type Order struct{ items []string }"],
      tail: "",
      strat: {
        "share the reference": { field: "ref", getter: "same", cls: ["func NewOrder(t []string) *Order { return &Order{items: t} }", "func (o *Order) Items() []string { return o.items }"] },
        "copy in": { field: "copy", getter: "same", cls: ["func NewOrder(t []string) *Order { return &Order{items: slices.Clone(t)} }", "func (o *Order) Items() []string { return o.items }"] },
        "copy in + copy out": { field: "copy", getter: "clone", cls: ["func NewOrder(t []string) *Order { return &Order{items: slices.Clone(t)} }", "func (o *Order) Items() []string { return slices.Clone(o.items) }"] },
      },
    },
    TypeScript: {
      caller: ['const tags = ["a", "b"];', "const order = new Order(tags);", 'tags[0] = "z";              // caller reuses its array', 'order.items[1] = "hacked";  // a consumer writes via items', 'console.log(order.items.join(","));', "", "class Order {"],
      tail: "}",
      strat: {
        "share the reference": { field: "ref", getter: "same", cls: ["  constructor(public items: string[]) {}"] },
        "copy in": { field: "copy", getter: "same", cls: ["  items: string[];", "  constructor(t: string[]) { this.items = [...t]; }"] },
        "readonly type, no copy": { field: "view", getter: "same", cls: ["  constructor(public readonly items: readonly string[]) {}"], block: ["compile", "error TS2542: Index signature in type 'readonly string[]' only permits reading."] },
        "copy + freeze + readonly": { field: "imm", getter: "same", cls: ["  readonly items: readonly string[];", "  constructor(t: string[]) { this.items = Object.freeze([...t]); }"], block: ["compile", "error TS2542: Index signature in type 'readonly string[]' only permits reading.\n(and if someone casts it away: TypeError: Cannot assign to read only property '1')"] },
      },
    },
  };
  function simulateAlias(lang, sname) {
    const L = ALIAS[lang], st = L.strat[sname];
    const code = [...L.caller, ...st.cls, ...(L.tail ? [L.tail] : [])];
    const ctorLine = L.caller.length, getLine = L.caller.length + st.cls.length - 1;
    const heap = {}; let nid = 0;
    const alloc = (o) => { const id = "#" + ++nid; heap[id] = o; return id; };
    const resolve = (id) => (heap[id].of ? resolve(heap[id].of) : id);
    const contents = (id) => heap[resolve(id)].items.slice();
    const refs = {};
    const frames = [];
    const show = () => contents(refs["order.items"]).join(",");
    const snap = (o) => frames.push({ heap: Viz.clone(heap), refs: { ...refs }, ...o, vars: { tags: contents(refs.tags).join(","), "order sees": refs["order.items"] ? show() : "·", ...(o.vars || {}) } });
    refs.tags = alloc({ kind: "mutable list", items: ["a", "b"] });
    snap({ line: 0, touched: refs.tags, note: "The caller builds a mutable list and holds it in <code>tags</code>." });
    const fieldKind = { ref: "", copy: "mutable list", view: "read-only view", imm: lang === "Python" ? "tuple" : "immutable" }[st.field];
    if (st.field === "ref") refs["order.items"] = refs.tags;
    else if (st.field === "view") refs["order.items"] = alloc({ kind: "read-only view", of: refs.tags, items: [] });
    else refs["order.items"] = alloc({ kind: fieldKind, items: contents(refs.tags) });
    const why = {
      ref: "The constructor stores the <b>same reference</b>. Two names now lead to one list: the order does not own its data.",
      copy: "The constructor <b>copies</b> the elements into a new list the order owns. Later changes to <code>tags</code> cannot reach it.",
      view: "The constructor wraps the caller's list in a <b>read-only view</b>. The view blocks writes through it, but it still reads the caller's list live.",
      imm: "The constructor copies into an <b>immutable</b> collection. Nobody, not even the order, can change it afterwards.",
    }[st.field];
    snap({ line: [1, ctorLine], touched: refs["order.items"], note: why });
    const before = show();
    heap[refs.tags].items[0] = "z";
    const leaked = show() !== before;
    snap({ line: 2, touched: refs.tags, leak: leaked, note: leaked ? `The caller writes to its own list and the order's items changed too (<b>${esc(show())}</b>). ${st.field === "view" ? "Read-only is not immutable: a view only stops <i>you</i> writing; the owner can still change it under you." : "This is aliasing: a mutation through one name is visible through every other name."}` : `The caller writes to its own list. The order still sees <b>${esc(show())}</b> because it holds its own copy.` });
    let got = refs["order.items"];
    if (st.getter === "view") got = alloc({ kind: "read-only view", of: refs["order.items"], items: [] });
    if (st.getter === "clone") got = alloc({ kind: "mutable list (clone)", items: contents(refs["order.items"]) });
    refs["order.Items()"] = got;
    const b2 = show();
    let outcome;
    if (st.block && st.block[0] !== "checker") {
      outcome = st.block[0];
      snap({ line: [3, getLine], touched: got, err: st.block, note: st.block[0] === "compile" ? "The getter's type has no setter, so the <b>compiler rejects the write</b>. The bug cannot ship." : "The collection refuses the write <b>at run time</b>. Safe, but you learn about it from an exception, not the compiler." });
    } else {
      heap[resolve(got)].items[1] = "hacked";
      const hit = show() !== b2;
      outcome = hit ? "corrupted" : "isolated";
      snap({ line: [3, getLine], touched: resolve(got), err: st.block, leak: hit, note: (st.block ? "mypy flags this line, but Python does not enforce hints at run time, so the write happens anyway. " : "") + (hit ? `The getter handed out the order's own list, so an outsider changed the order's state: <b>${esc(show())}</b>.` : `The getter returned a <b>clone</b>, so the write lands in a throwaway copy. The order still holds <b>${esc(show())}</b>.`) });
    }
    snap({ line: 4, final: true, outcome, note: `Final: the order holds <b>${esc(show())}</b>. ${outcome === "corrupted" || leaked ? "Its invariants are only as safe as every other piece of code that holds the same list." : "The order fully owns its state."}`, vars: { "caller leak": leaked ? "yes" : "no", "consumer write": { compile: "compile error", runtime: "exception", corrupted: "changed order", isolated: "went to a copy" }[outcome] } });
    return { frames, code };
  }
  Viz.register(S + "aliasing", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), opts = Object.keys(ALIAS[lang].strat), sname = pick(v.s, opts);
    const { code } = simulateAlias(lang, sname);
    return {
      sig: lang + "|" + sname, title: "Aliasing: who else can change the list your object holds?", tag: "SIMULATION · REFERENCES + HEAP",
      legend: [["active", "object written this step"], ["bad", "write leaked into the order"], ["done", "order isolated"]],
      code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "s", label: "how Order stores items", type: "select", options: opts, value: sname }],
      build: (i) => simulateAlias(pick(i.lang, LANGS), pick(i.s, Object.keys(ALIAS[pick(i.lang, LANGS)].strat))).frames,
      random: () => { const l = LANGS[Viz.rand(0, 4)], o = Object.keys(ALIAS[l].strat); return { lang: l, s: o[Viz.rand(0, o.length - 1)] }; },
      render: (f) => {
        const ids = Object.keys(f.heap);
        const names = Object.entries(f.refs).map(([n, id]) => `<div class="ti-ref"><code>${esc(n)}</code><span class="ti-to">→</span><span class="ti-id">${esc(id)}</span></div>`).join("");
        const objs = ids.map((id) => {
          const o = f.heap[id];
          let target = id; while (f.heap[target].of) target = f.heap[target].of;
          const items = f.heap[target].items;
          const orderOwns = Object.entries(f.refs).some(([n, r]) => n === "order.items" && r === id);
          const cls = f.touched === id ? (f.leak ? "bad" : "active") : f.final && orderOwns ? (f.outcome === "corrupted" || f.leak ? "bad" : "done") : "";
          return `<div class="ti-obj ${cls}"><div class="ti-objh"><span class="ti-id">${esc(id)}</span> ${esc(o.kind)}${o.of ? ` of <span class="ti-id">${esc(o.of)}</span>` : ""}</div><div class="ti-cells">${items.map((x) => `<span class="${x === "z" || x === "hacked" ? "chg" : ""}">${esc(x)}</span>`).join("")}</div></div>`;
        }).join("");
        const err = f.err ? `<div class="ti-err ${f.err[0]}"><b>${{ compile: "compile error", runtime: "run-time exception", checker: "type checker (CI only)" }[f.err[0]]}</b><pre>${esc(f.err[1])}</pre></div>` : "";
        return `<div class="ti-heap"><div class="ti-col"><div class="ti-caption">names (references)</div>${names}</div><div class="ti-col wide"><div class="ti-caption">heap objects</div>${objs}</div></div>${err}`;
      },
    };
  }, { lang: "C#", s: "copy in" }));

  /* ================= 3. records: `with` copies the record, not what its fields point to ================= */
  // kind: "shared" list behind a reference | "imm" immutable list | "value" array copied by value (Go [N]T)
  const REC = {
    "C#": {
      "List<string> (mutable)": { kind: "shared", eq: "ref", code: ["record Order(int Id, List<string> Lines);", "", 'var a = new Order(1, ["x", "y"]);', "var b = a with { Id = 2 };      // shallow copy", 'b.Lines[0] = "X";', "var c = new Order(1, [.. a.Lines]);", "Console.WriteLine(a == c);"] },
      "ImmutableList<string>": { kind: "imm", eq: "ref", code: ["record Order(int Id, ImmutableList<string> Lines);", "", 'var a = new Order(1, ["x", "y"]);', "var b = a with { Id = 2 };      // shallow copy", 'b = b with { Lines = b.Lines.SetItem(0, "X") };', "var c = new Order(1, [.. a.Lines]);", "Console.WriteLine(a == c);"] },
    },
    Java: {
      "ArrayList (mutable)": { kind: "shared", eq: "value", code: ["record Order(int id, List<String> lines) {}", "", 'var a = new Order(1, new ArrayList<>(List.of("x", "y")));', "var b = new Order(2, a.lines());  // no `with`: copy by hand", 'b.lines().set(0, "X");', "var c = new Order(1, new ArrayList<>(a.lines()));", "System.out.println(a.equals(c));"] },
      "List.copyOf (immutable)": { kind: "imm", eq: "value", code: ["record Order(int id, List<String> lines) {", "    Order { lines = List.copyOf(lines); } }", 'var a = new Order(1, List.of("x", "y"));', "var b = new Order(2, a.lines());", 'var l = new ArrayList<>(b.lines()); l.set(0, "X"); b = new Order(2, l);', "var c = new Order(1, new ArrayList<>(a.lines()));", "System.out.println(a.equals(c));"] },
    },
    Python: {
      "list (mutable)": { kind: "shared", eq: "value", code: ["@dataclass(frozen=True)", "class Order: id: int; lines: list[str]", 'a = Order(1, ["x", "y"])', "b = replace(a, id=2)             # shallow copy", 'b.lines[0] = "X"                 # frozen ≠ deep-frozen', "c = Order(1, list(a.lines))", "print(a == c)"] },
      "tuple (immutable)": { kind: "imm", eq: "value", code: ["@dataclass(frozen=True)", "class Order: id: int; lines: tuple[str, ...]", 'a = Order(1, ("x", "y"))', "b = replace(a, id=2)", 'b = replace(b, lines=("X",) + b.lines[1:])', "c = Order(1, tuple(a.lines))", "print(a == c)"] },
    },
    Go: {
      "[]string (slice)": { kind: "shared", eq: "none", code: ["type Order struct { ID int; Lines []string }", "", 'a := Order{1, []string{"x", "y"}}', "b := a          // copies the struct: the slice header, not the array", "b.ID = 2", 'b.Lines[0] = "X"', "c := Order{1, slices.Clone(a.Lines)}", "fmt.Println(a == c)  // does not compile"] },
      "[2]string (array value)": { kind: "value", eq: "value", code: ["type Order struct { ID int; Lines [2]string }", "", 'a := Order{1, [2]string{"x", "y"}}', "b := a          // arrays are values: copied too", "b.ID = 2", 'b.Lines[0] = "X"', "c := Order{1, a.Lines}", "fmt.Println(a == c)"] },
    },
    TypeScript: {
      "string[] (mutable)": { kind: "shared", eq: "ref", code: ["type Order = { id: number; lines: string[] };", "", 'const a: Order = { id: 1, lines: ["x", "y"] };', "let b = { ...a, id: 2 };          // shallow copy", 'b.lines[0] = "X";', "const c = { id: 1, lines: [...a.lines] };", "console.log(a === c);"] },
      "readonly string[]": { kind: "imm", eq: "ref", code: ["type Order = { readonly id: number; readonly lines: readonly string[] };", "", 'const a: Order = { id: 1, lines: ["x", "y"] };', "let b: Order = { ...a, id: 2 };", 'b = { ...b, lines: b.lines.with(0, "X") };  // ES2023', "const c: Order = { id: 1, lines: [...a.lines] };", "console.log(a === c);"] },
    },
  };
  function simulateRecord(lang, kname) {
    const R = REC[lang][kname], code = R.code, go = lang === "Go";
    const lnA = code.findIndex((l) => l.includes('"x"'));
    const lnB = code.findIndex((l, i) => i > lnA && /(^|\s)b(: Order)? :?=/.test(l));
    const lnMut = code.findIndex((l, i) => i > lnB && l.includes('"X"'));
    const lnC = code.findIndex((l) => /(^|\s)c(: Order)? :?=/.test(l)), lnEq = code.length - 1;
    if ([lnA, lnB, lnMut, lnC].some((x) => x < 0)) throw new Error("model error: code lines not found");
    const heap = {}; let n = 0;
    const alloc = (o) => { const id = (o.rec ? "R" : "L") + ++n; heap[id] = o; return id; };
    const rec = (idv, lines) => alloc({ rec: true, id: idv, lines });
    const list = (items) => alloc({ items, imm: R.kind === "imm", val: R.kind === "value" });
    const names = {}, frames = [];
    const linesOf = (r) => (R.kind === "value" ? heap[r].lines : heap[heap[r].lines].items);
    const snap = (o) => frames.push({ heap: Viz.clone(heap), names: { ...names }, kind: R.kind, ...o, vars: { "a.lines": "[" + linesOf(names.a).join(",") + "]", "b.lines": names.b ? "[" + linesOf(names.b).join(",") + "]" : "·", ...(o.vars || {}) } });
    names.a = R.kind === "value" ? rec(1, ["x", "y"]) : rec(1, list(["x", "y"]));
    snap({ line: [0, lnA], touched: names.a, note: R.kind === "value" ? "<code>a</code> is a struct whose array is stored <b>inline</b>: the two strings are part of the record's own bytes." : "<code>a</code> is a record whose <code>Lines</code> field holds a <b>reference</b> to a separate list object." });
    const src = heap[names.a];
    names.b = rec(2, R.kind === "value" ? src.lines.slice() : src.lines);
    snap({ line: go ? [lnB, lnB + 1] : lnB, touched: names.b, shared: R.kind !== "value" ? heap[names.b].lines : null, note: R.kind === "value" ? "Copying the struct copies the array with it: <code>b</code> has its own two strings." : `The copy is <b>shallow</b>: <code>b</code> is a new record, but its <code>Lines</code> field copied the <i>reference</i>, so both records point at <span class="ti-id">${heap[names.b].lines}</span>.` });
    if (R.kind === "shared") {
      heap[heap[names.b].lines].items[0] = "X";
      snap({ line: lnMut, touched: heap[names.b].lines, bad: true, note: `Writing through <code>b</code> changed the shared list, so <b>a changed too</b>: a.lines = [${linesOf(names.a).join(",")}]. ${lang === "Python" ? "frozen=True only stops reassigning the field; it does not freeze the list inside." : "The record looked immutable; its contents were not."}` });
    } else if (R.kind === "imm") {
      const nl = list(linesOf(names.b).map((x, i) => (i === 0 ? "X" : x)));
      names.b = rec(2, nl);
      snap({ line: lnMut, touched: nl, good: true, note: `An immutable list cannot be written, so "changing" it builds a <b>new list</b> <span class="ti-id">${nl}</span> and a new record for <code>b</code>. <code>a</code> still sees [${linesOf(names.a).join(",")}].` });
    } else {
      heap[names.b].lines[0] = "X";
      snap({ line: lnMut, touched: names.b, good: true, note: `b's array is its own value, so the write stays in b. a still sees [${linesOf(names.a).join(",")}].` });
    }
    names.c = R.kind === "value" ? rec(1, linesOf(names.a).slice()) : rec(1, list(linesOf(names.a).slice()));
    snap({ line: lnC, touched: names.c, note: "<code>c</code> is a brand-new record with the same id and a <b>separate list holding the same strings</b> as a. Is a equal to c?" });
    const sameContents = linesOf(names.a).join() === linesOf(names.c).join();
    let res, why;
    if (R.eq === "none") { res = "compile error"; why = "invalid operation: a == c (struct containing []string cannot be compared). Go only allows == on structs whose fields are all comparable; slices are not."; }
    else if (R.eq === "value") { res = String(sameContents); why = lang === "Go" ? "Arrays compare element by element, so the structs compare equal field by field." : lang === "Java" ? "The record's generated equals() calls lines.equals(), and List.equals compares elements." : "The dataclass __eq__ compares fields as tuples, and list/tuple == compares elements."; }
    else if (lang === "TypeScript") { res = "false"; why = "=== on objects is identity. TypeScript has no structural equality for objects; you write it (or use a library)."; }
    else { res = "false"; why = `Records compare each field with EqualityComparer<T>.Default. ${kname.startsWith("List") ? "List<T>" : "ImmutableList<T>"} does not override Equals, so the field compares by <b>reference</b>, and a.Lines and c.Lines are different objects. Value equality stops at the first reference-typed field.`; }
    snap({ line: lnEq, eq: res, final: true, note: `<b>${esc(res)}</b>. ${why}`, vars: { "a == c": res } });
    return frames;
  }
  Viz.register(S + "records", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), opts = Object.keys(REC[lang]), k = pick(v.k, opts);
    return {
      sig: lang + "|" + k, title: "Records: with/copy is shallow, equality stops at references", tag: "SIMULATION · OBJECT GRAPH",
      legend: [["active", "created / written"], ["path", "shared by two records"], ["bad", "changed through the other record"]],
      code: REC[lang][k].code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "k", label: "Lines field type", type: "select", options: opts, value: k }],
      build: (i) => { const l = pick(i.lang, LANGS); return simulateRecord(l, pick(i.k, Object.keys(REC[l]))); },
      random: () => { const l = LANGS[Viz.rand(0, 4)], o = Object.keys(REC[l]); return { lang: l, k: o[Viz.rand(0, 1)] }; },
      render: (f) => {
        const holders = (lid) => Object.entries(f.names).filter(([, r]) => f.heap[r].lines === lid).map(([nm]) => nm);
        const recs = Object.entries(f.names).map(([nm, r]) => {
          const o = f.heap[r], cls = f.touched === r ? "active" : "";
          const lines = f.kind === "value" ? `<div class="ti-cells">${o.lines.map((x) => `<span class="${x === "X" ? "chg" : ""}">${esc(x)}</span>`).join("")}</div>` : `<span class="ti-to">→</span><span class="ti-id">${esc(o.lines)}</span>`;
          return `<div class="ti-obj ${cls}"><div class="ti-objh"><code>${nm}</code> record <span class="ti-id">${esc(r)}</span></div><div class="ti-field">Id = ${o.id}</div><div class="ti-field">Lines ${lines}</div></div>`;
        }).join("");
        const lists = f.kind === "value" ? "" : Object.entries(f.heap).filter(([id, o]) => !o.rec && holders(id).length).map(([id, o]) => {
          const h = holders(id), cls = f.touched === id ? (f.bad ? "bad" : "active") : h.length > 1 ? "path" : "";
          return `<div class="ti-obj ${cls}"><div class="ti-objh"><span class="ti-id">${esc(id)}</span> ${o.imm ? "immutable list" : "mutable list"} · held by ${h.join(", ")}</div><div class="ti-cells">${o.items.map((x) => `<span class="${x === "X" ? "chg" : ""}">${esc(x)}</span>`).join("")}</div></div>`;
        }).join("");
        return `<div class="ti-heap"><div class="ti-col"><div class="ti-caption">records</div>${recs}</div>${lists ? `<div class="ti-col"><div class="ti-caption">lists on the heap</div>${lists}</div>` : ""}</div>${f.final ? chips(chip("a == c", f.eq, f.eq === "true" ? "done" : "bad")) : ""}`;
      },
    };
  }, { lang: "C#", k: "List<string> (mutable)" }));

  /* ================= 4. sharing: persistent insert copies one path and shares the rest ================= */
  const SHARE_CODE = ["record Node(int Key, Node? Left, Node? Right);", "", "static Node Insert(Node? n, int key) => n switch {", "    null => new Node(key, null, null),", "    _ when key < n.Key => n with { Left = Insert(n.Left, key) },", "    _ when key > n.Key => n with { Right = Insert(n.Right, key) },", "    _ => n,   // already present", "};", "", "var v2 = Insert(v1, key);   // v1 is never touched"];
  function simulateSharing(keys, key) {
    const nodes = {}; let nid = 0;
    const mk = (k, l, r, ver, d) => { const id = ++nid; nodes[id] = { k, l, r, ver, d }; return id; };
    let v1 = null;
    const ins1 = (id, k, d) => { if (!id) return mk(k, null, null, 1, d); const n = nodes[id]; if (k < n.k) n.l = ins1(n.l, k, d + 1); else if (k > n.k) n.r = ins1(n.r, k, d + 1); return id; };
    for (const k of keys) v1 = ins1(v1, k, 0);
    const height = (id) => (id ? 1 + Math.max(height(nodes[id].l), height(nodes[id].r)) : 0);
    if (height(v1) > 6) throw new Error("That insertion order makes a tree deeper than 6 levels. Try a more balanced order, for example 50 30 70 20 40 60 80.");
    const reach = (root) => { const s = new Set(); const go = (id) => { if (!id || s.has(id)) return; s.add(id); go(nodes[id].l); go(nodes[id].r); }; go(root); return s; };
    const v1Set = reach(v1), frames = [];
    let v2 = null, path = [], allocated = 0;
    const snap = (o) => frames.push({ nodes: Viz.clone(nodes), v1, v2, path: path.slice(), ...o, vars: { key, depth: path.length, allocated, ...(o.vars || {}) } });
    snap({ line: 9, note: `v1 holds ${v1Set.size} nodes. Inserting ${key} must not change v1: other code may still be reading it.` });
    const walk = (id, depth) => {
      if (!id) {
        const nn = mk(key, null, null, 2, depth); allocated++;
        snap({ line: 3, cur: nn, note: `Reached an empty spot: allocate the new leaf <b>${key}</b>. This is the only genuinely new data.` });
        return nn;
      }
      const n = nodes[id];
      if (key === n.k) { snap({ line: 6, cur: id, note: `${key} is already present: return the existing node. Everything below is shared.` }); return id; }
      const left = key < n.k;
      path.push(id);
      snap({ line: left ? 4 : 5, cur: id, note: `${key} ${left ? "&lt;" : "&gt;"} ${n.k}: recurse ${left ? "left" : "right"}. The ${left ? "right" : "left"} subtree of ${n.k} will be <b>shared</b>, not copied.` });
      const child = walk(left ? n.l : n.r, depth + 1);
      const c = mk(n.k, left ? child : n.l, left ? n.r : child, 2, depth); allocated++;
      path.pop();
      snap({ line: left ? 4 : 5, cur: c, note: `On the way back up, <code>n with { ${left ? "Left" : "Right"} = … }</code> copies ${n.k}: same key, new ${left ? "left" : "right"} child, and the <b>same ${left ? "right" : "left"} pointer</b> as the old node.` });
      return c;
    };
    v2 = walk(v1, 0);
    const v2Set = reach(v2), shared = [...v2Set].filter((x) => v1Set.has(x)).length;
    snap({ final: true, line: 9, note: `v2 has ${v2Set.size} nodes but only <b>${allocated}</b> are new; <b>${shared}</b> are shared with v1. A full copy would have allocated ${v2Set.size}. Path copying costs O(depth), and both versions stay valid forever: this is how ImmutableDictionary, Clojure maps and Git trees work.`, vars: { shared, "full copy": v2Set.size } });
    return frames;
  }
  Viz.register(S + "sharing", (el) => Viz.player(el, {
    title: "Structural sharing: insert into a persistent tree", tag: "SIMULATION · PATH COPYING",
    legend: [["done", "shared by v1 and v2"], ["visit", "v1 only (replaced in v2)"], ["path", "new in v2"], ["active", "current"]],
    code: SHARE_CODE, codeLang: "csharp",
    inputs: [{ key: "keys", label: "v1 keys (insertion order, ≤ 14)", value: "50 30 70 20 40 60 80 65", width: 240 }, { key: "k", label: "insert", value: "67", width: 70 }],
    build: (i) => {
      const keys = Viz.parse.ints(i.keys, { min: 1, max: 14 });
      if (keys.some((x) => !Number.isInteger(x) || x < 1 || x > 999)) throw new Error("Keys must be whole numbers from 1 to 999.");
      const k = Viz.parse.int(i.k, { min: 1, max: 999 });
      return simulateSharing([...new Set(keys)], k);
    },
    random: () => {
      const pool = [...new Set(Array.from({ length: 30 }, () => Viz.rand(1, 99)))];
      const order = (a) => { if (!a.length) return []; const m = a.length >> 1; return [a[m], ...order(a.slice(0, m)), ...order(a.slice(m + 1))]; };
      const keys = order(pool.slice(0, Viz.rand(6, 11)).sort((x, y) => x - y));
      return { keys: keys.join(" "), k: String(pool[12] || 42) };
    },
    render: (f) => {
      const N = f.nodes, reach = (root) => { const s = new Set(); const go = (id) => { if (!id || s.has(id)) return; s.add(id); go(N[id].l); go(N[id].r); }; go(root); return s; };
      const s1 = reach(f.v1), s2 = f.v2 ? reach(f.v2) : new Set();
      const all = Object.keys(N).map(Number), keysSorted = [...new Set([...all.map((id) => N[id].k), f.vars.key])].sort((a, b) => a - b);
      const W = 500, gap = Math.min(44, (W - 60) / Math.max(1, keysSorted.length - 1));
      const rowH = 62, x0 = (W - gap * (keysSorted.length - 1)) / 2 - 7;
      const pos = (id) => { const n = N[id], x = x0 + keysSorted.indexOf(n.k) * gap; return n.ver === 2 ? [x + 14, 30 + n.d * rowH + 26] : [x, 30 + n.d * rowH]; };
      const H = Math.ceil(Math.max(...all.map((id) => pos(id)[1])) + 22);
      let edges = "", circles = "";
      for (const id of all) {
        const n = N[id];
        const [x, y] = pos(id);
        for (const c of [n.l, n.r]) if (c) { const [cx, cy] = pos(c); const a = Math.atan2(cy - y, cx - x); edges += arrow(x + 15 * Math.cos(a), y + 15 * Math.sin(a), cx - 15 * Math.cos(a), cy - 15 * Math.sin(a), n.ver === 2 ? (N[c].ver === 1 ? "share" : "new") : ""); }
        const cls = id === f.cur ? "active" : n.ver === 2 ? "path" : f.v2 && s2.has(id) && s1.has(id) ? "done" : f.v2 && s1.has(id) ? "visit" : f.path.includes(id) ? "visit" : "";
        circles += `<circle cx="${x}" cy="${y}" r="15" class="box ${cls}"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="mono small">${n.k}</text>`;
      }
      const tag = (id, label, cls) => { if (!id) return ""; const [x, y] = pos(id); return N[id].ver === 2 ? `<text x="${x + 21}" y="${y + 4}" class="small ${cls}">${label}</text>` : `<text x="${x}" y="${y - 21}" text-anchor="middle" class="small ${cls}">${label}</text>`; };
      const svg = `<svg class="dg ti-tree" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="persistent tree versions v1 and v2">${edges}${circles}${tag(f.v1, "v1", "muted")}${f.v2 ? tag(f.v2, "v2", "") : ""}</svg>`;
      return `<div class="ti-fit">${svg}</div>${f.final ? chips(chip("new nodes", f.vars.allocated, "accent"), chip("shared", f.vars.shared, "done"), chip("full copy would allocate", f.vars["full copy"], "bad")) : ""}`;
    },
  }));

  /* ================= 5. unions: add a case and see which switch sites the toolchain flags ================= */
  const FEES = [["Card", "0.029"], ["BankTransfer", "0.005"], ["Wallet", "0.019"]];
  const LABELS = { Card: "Card", BankTransfer: "Bank transfer", Wallet: "Wallet" };
  const UNION = {
    "C#": {
      head: ["enum PaymentKind { Card, BankTransfer, Wallet,", "    GiftCard }   // NEW case added today", ""],
      site: (fn, ret, arms, ca) => [`static ${ret} ${fn}(PaymentKind k) => k switch {`, ...arms.map(([c, v]) => `    PaymentKind.${c} => ${v},`), ...(ca ? [`    _ => ${ret === "decimal" ? "0m" : '"Other"'},   // catch-all`] : []), "};"],
      fee: (v) => v + "m", str: (s) => `"${s}"`, types: ["decimal", "string"], names: ["Fee", "Label"],
      flag: { when: "compile warning", stops: "only with TreatWarningsAsErrors", msg: "warning CS8509: The switch expression does not handle all possible values of its input type (it is not exhaustive). For example, the pattern 'PaymentKind.GiftCard' is not covered.", run: "SwitchExpressionException: Non-exhaustive switch expression failed to match its input. Unmatched value was GiftCard." },
    },
    Java: {
      head: ["sealed interface Payment permits Card, BankTransfer, Wallet, GiftCard {}", "record Card() implements Payment {}  /* … BankTransfer, Wallet … */", "record GiftCard() implements Payment {}   // NEW case added today"],
      site: (fn, ret, arms, ca) => [`static ${ret} ${fn}(Payment p) { return switch (p) {`, ...arms.map(([c, v]) => `    case ${c} x -> ${v};`), ...(ca ? [`    default -> ${ret === "double" ? "0.0" : '"Other"'};   // catch-all`] : []), "}; }"],
      fee: (v) => v, str: (s) => `"${s}"`, types: ["double", "String"], names: ["fee", "label"],
      flag: { when: "compile error", stops: "yes: javac refuses to build", msg: "error: the switch expression does not cover all possible input values" },
    },
    Python: {
      head: ["type Payment = Card | BankTransfer | Wallet | GiftCard   # GiftCard is NEW", "", ""],
      site: (fn, ret, arms, ca) => [`def ${fn}(p: Payment) -> ${ret}:`, "    match p:", ...arms.map(([c, v]) => `        case ${c}(): return ${v}`), ca ? `        case _: return ${ret === "float" ? "0.0" : '"Other"'}   # catch-all` : "        case _: assert_never(p)"],
      fee: (v) => v, str: (s) => `"${s}"`, types: ["float", "str"], names: ["fee", "label"],
      flag: { when: "type checker", stops: "only if mypy/pyright runs in CI", msg: 'error: Argument 1 to "assert_never" has incompatible type "GiftCard"; expected "Never"  [arg-type]', run: "AssertionError: Expected code to be unreachable, but got: GiftCard()" },
    },
    Go: {
      head: ["type Payment interface{ isPayment() }", "type Card struct{}; type BankTransfer struct{}; type Wallet struct{}", "type GiftCard struct{}   // NEW case added today"],
      site: (fn, ret, arms, ca) => [`func ${fn}(p Payment) ${ret} {`, "    switch p.(type) {", ...arms.map(([c, v]) => `    case ${c}: return ${v}`), ...(ca ? [`    default: return ${ret === "float64" ? "0" : '"Other"'}   // catch-all`, "    }"] : ["    }", '    panic(fmt.Sprintf("unhandled %T", p))']), "}"],
      fee: (v) => v, str: (s) => `"${s}"`, types: ["float64", "string"], names: ["Fee", "Label"],
      flag: { when: "run time", stops: "no: Go has no exhaustiveness check (a linter such as gochecksumtype can add one)", msg: "(compiles cleanly)", run: "panic: unhandled main.GiftCard" },
    },
    TypeScript: {
      head: ['type Payment = { kind: "Card" } | { kind: "BankTransfer" }', '  | { kind: "Wallet" } | { kind: "GiftCard" };   // GiftCard is NEW', "const assertNever = (x: never): never => { throw new Error(`unhandled ${JSON.stringify(x)}`); };"],
      site: (fn, ret, arms, ca) => [`function ${fn}(p: Payment): ${ret} {`, "  switch (p.kind) {", ...arms.map(([c, v]) => `    case "${c}": return ${v};`), ca ? `    default: return ${ret === "number" ? "0" : '"Other"'};   // catch-all` : "    default: return assertNever(p);", "  }", "}"],
      fee: (v) => v, str: (s) => `"${s}"`, types: ["number", "string"], names: ["fee", "label"],
      flag: { when: "compile error", stops: "yes: tsc reports an error", msg: "error TS2345: Argument of type '{ kind: \"GiftCard\"; }' is not assignable to parameter of type 'never'." },
    },
  };
  const CATCH = ["no catch-all (exhaustive)", "catch-all in label only", "catch-all in both"];
  function unionCode(lang, mode) {
    const U = UNION[lang], code = [...U.head, ""], sites = [];
    U.names.forEach((fn, k) => {
      const ca = mode === CATCH[2] || (mode === CATCH[1] && k === 1);
      const arms = k === 0 ? FEES.map(([c, v]) => [c, U.fee(v)]) : FEES.map(([c]) => [c, U.str(LABELS[c])]);
      const start = code.length, lines = U.site(fn, U.types[k], arms, ca);
      code.push(...lines);
      sites.push({ fn, ca, start, end: code.length - 1, arm: start + lines.findIndex((l) => /catch-all|assert_never|assertNever\(p\)|panic\(|^\s*\}; *\}?$|^\};$/.test(l)) });
    });
    return { code, sites };
  }
  function simulateUnion(lang, mode) {
    const U = UNION[lang], { sites } = unionCode(lang, mode), frames = [];
    const st = sites.map((s) => ({ fn: s.fn, status: "ok", detail: "" }));
    const snap = (o) => frames.push({ st: Viz.clone(st), ...o, vars: { caught: st.filter((s) => s.status === "caught").length, silent: st.filter((s) => s.status === "silent").length, ...(o.vars || {}) } });
    snap({ line: [0], note: `Yesterday the union had three cases and both <code>${sites[0].fn}</code> and <code>${sites[1].fn}</code> handled all of them.${lang === "C#" ? " (C# enums are open: (PaymentKind)42 is legal, so even a complete switch draws warning CS8524 about unnamed values.)" : ""}` });
    snap({ line: lang === "C#" ? [0, 1] : lang === "Python" ? [0] : lang === "TypeScript" ? [1] : [2], added: true, note: "Today someone adds <b>GiftCard</b>. The question that matters: which of the switch sites will the toolchain point at before this ships?" });
    sites.forEach((s, k) => {
      if (s.ca) {
        st[k] = { fn: s.fn, status: "silent", detail: "a catch-all arm matches GiftCard, so nothing is reported" };
        snap({ line: s.arm, cur: k, note: `<code>${s.fn}</code> has a catch-all arm. GiftCard matches it, so ${lang === "Go" ? "the compiler" : "the compiler and type checker"} see a complete switch and say <b>nothing</b>. The bug is now invisible.` });
      } else {
        const caught = U.flag.when !== "run time";
        st[k] = { fn: s.fn, status: caught ? "caught" : "silent", detail: caught ? U.flag.msg : U.flag.stops };
        snap({ line: s.arm, cur: k, err: caught ? [U.flag.when, U.flag.msg] : null, note: caught ? `<code>${s.fn}</code> has no catch-all, so the ${U.flag.when} names the missing case. Does it block the build? <b>${esc(U.flag.stops)}</b>.` : `<code>${s.fn}</code> has no catch-all, but Go does not check type switches for completeness, so it <b>compiles</b>. The fallback after the switch is all you have.` });
      }
    });
    const run = sites.map((s, k) => {
      if (s.ca) return { fn: s.fn, out: k === 0 ? "0  (free gift-card payments)" : '"Other"', cls: "bad" };
      if (U.flag.run) return { fn: s.fn, out: U.flag.run, cls: lang === "Go" ? "bad" : "visit" };
      return { fn: s.fn, out: "(never deployed: build failed and was fixed)", cls: "done" };
    });
    snap({ final: true, run, line: sites.map((s) => s.start), note: `Production sends a GiftCard. ${run.some((r) => r.cls === "bad") ? "Every catch-all quietly returns a plausible wrong value: the worst failure mode, because nothing alerts. " : ""}${lang === "C#" || lang === "Python" ? `Sites without a catch-all only fail loudly at run time if the ${lang === "C#" ? "warning" : "checker"} was ignored.` : lang === "Go" ? "Go's panic is loud, but it happens in production." : "Exhaustive sites never reach production broken."}` });
    return frames;
  }
  Viz.register(S + "unions", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), mode = pick(v.m, CATCH);
    return {
      sig: lang + "|" + mode, title: "Exhaustiveness: add a case, who tells you?", tag: "SIMULATION · COMPILER CHECKS",
      legend: [["done", "caught before production"], ["bad", "silent wrong behaviour"], ["visit", "loud, but only at run time"]],
      code: unionCode(lang, mode).code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "m", label: "switch style", type: "select", options: CATCH, value: mode }],
      build: (i) => simulateUnion(pick(i.lang, LANGS), pick(i.m, CATCH)),
      random: () => ({ lang: LANGS[Viz.rand(0, 4)], m: CATCH[Viz.rand(0, 2)] }),
      render: (f) => {
        const cases = ["Card", "BankTransfer", "Wallet", "GiftCard"].map((c, k) => `<span class="ti-case ${k === 3 ? (f.added || f.cur !== undefined || f.final ? "active" : "dim") : "done"}"><b>${c}</b>${k === 3 ? "<span>new</span>" : ""}</span>`).join("");
        const sites = f.st.map((s, k) => {
          const cls = f.cur === k ? "active" : s.status === "caught" ? "done" : s.status === "silent" ? "bad" : "";
          const r = f.run && f.run[k];
          return `<div class="ti-site ${cls}"><b>${esc(s.fn)}()</b><span>${{ ok: "handles every case", caught: "flagged by the toolchain", silent: "compiles silently" }[s.status]}</span>${r ? `<div class="ti-run ${r.cls}">GiftCard → <code>${esc(r.out)}</code></div>` : ""}</div>`;
        }).join("");
        const err = f.err ? `<div class="ti-err ${f.err[0] === "compile error" ? "compile" : "checker"}"><b>${esc(f.err[0])}</b><pre>${esc(f.err[1])}</pre></div>` : "";
        return `<div class="ti-caption">union cases</div><div class="ti-cases">${cases}</div><div class="ti-caption">switch sites</div><div class="ti-sites">${sites}</div>${err}`;
      },
    };
  }, { lang: "Java", m: CATCH[1] }));

  /* ================= 6. ids: primitive obsession vs strongly typed IDs ================= */
  const CUST = { 7: "Ada", 42: "Grace" }, ACCT = { 42: { owner: "Ada", name: "Ada's Visa" }, 7: { owner: "Grace", name: "Grace's Amex" } };
  const MISTAKES = ["swapped arguments", "raw literal 42"];
  const IDS = {
    "C#": {
      typings: {
        "plain int": { kind: "raw", decl: ["// IDs are plain ints", "record Order(int CustomerId, int AccountId);", "void Charge(int customer, int account, decimal amount) { /* … */ }"] },
        "using alias": { kind: "alias", decl: ["using CustomerId = int;  using AccountId = int;   // C# 12 aliases", "record Order(CustomerId CustomerId, AccountId AccountId);", "void Charge(CustomerId customer, AccountId account, decimal amount) { /* … */ }"] },
        "record struct per ID": { kind: "distinct", decl: ["readonly record struct CustomerId(int Value);  readonly record struct AccountId(int Value);", "record Order(CustomerId CustomerId, AccountId AccountId);", "void Charge(CustomerId customer, AccountId account, decimal amount) { /* … */ }"] },
      },
      load: "var order = LoadOrder();   // Ada: customer 7, account 42",
      call: ["Charge(order.AccountId, order.CustomerId, 25m);", "Charge(42, order.AccountId, 25m);"],
      err: (k, act, exp) => `error CS1503: Argument ${k}: cannot convert from '${act}' to '${exp}'`, lit: "int",
    },
    Java: {
      typings: {
        "plain long": { kind: "raw", decl: ["// IDs are plain longs (Java has no type aliases)", "record Order(long customerId, long accountId) {}", "void charge(long customer, long account, BigDecimal amount) { /* … */ }"] },
        "record per ID": { kind: "distinct", decl: ["record CustomerId(long value) {}  record AccountId(long value) {}", "record Order(CustomerId customerId, AccountId accountId) {}", "void charge(CustomerId customer, AccountId account, BigDecimal amount) { /* … */ }"] },
      },
      load: "var order = loadOrder();   // Ada: customer 7, account 42",
      call: ["charge(order.accountId(), order.customerId(), new BigDecimal(\"25\"));", "charge(42, order.accountId(), new BigDecimal(\"25\"));"],
      err: (k, act, exp) => `error: incompatible types: ${act} cannot be converted to ${exp}`, lit: "int",
    },
    Python: {
      typings: {
        "plain int": { kind: "raw", decl: ["# IDs are plain ints", "class Order: customer_id: int; account_id: int", "def charge(customer: int, account: int, amount: Decimal) -> None: ..."] },
        "type alias": { kind: "alias", decl: ["type CustomerId = int;  type AccountId = int   # aliases: same type", "class Order: customer_id: CustomerId; account_id: AccountId", "def charge(customer: CustomerId, account: AccountId, amount: Decimal) -> None: ..."] },
        "NewType": { kind: "distinct", decl: ['CustomerId = NewType("CustomerId", int);  AccountId = NewType("AccountId", int)', "class Order: customer_id: CustomerId; account_id: AccountId", "def charge(customer: CustomerId, account: AccountId, amount: Decimal) -> None: ..."] },
      },
      load: "order = load_order()   # Ada: customer 7, account 42",
      call: ['charge(order.account_id, order.customer_id, Decimal("25"))', 'charge(42, order.account_id, Decimal("25"))'],
      err: (k, act, exp) => `error: Argument ${k} to "charge" has incompatible type "${act}"; expected "${exp}"  [arg-type]`, lit: "int", checkerOnly: true,
    },
    Go: {
      typings: {
        "plain int64": { kind: "raw", decl: ["// IDs are plain int64s", "type Order struct{ CustomerID, AccountID int64 }", "func Charge(customer, account int64, amount decimal.Decimal) { /* … */ }"] },
        "alias (=)": { kind: "alias", decl: ["type CustomerID = int64;  type AccountID = int64   // alias: same type", "type Order struct{ CustomerID CustomerID; AccountID AccountID }", "func Charge(customer CustomerID, account AccountID, amount decimal.Decimal) { /* … */ }"] },
        "defined type": { kind: "distinct", decl: ["type CustomerID int64;  type AccountID int64   // new named types", "type Order struct{ CustomerID CustomerID; AccountID AccountID }", "func Charge(customer CustomerID, account AccountID, amount decimal.Decimal) { /* … */ }"] },
      },
      load: "order := LoadOrder()   // Ada: customer 7, account 42",
      call: ['Charge(order.AccountID, order.CustomerID, decimal.NewFromInt(25))', 'Charge(42, order.AccountID, decimal.NewFromInt(25))'],
      err: (k, act, exp) => `cannot use order.${act} (variable of type ${act}) as ${exp} value in argument to Charge`, lit: "untyped const", untypedConst: true,
    },
    TypeScript: {
      typings: {
        "plain number": { kind: "raw", decl: ["// IDs are plain numbers", "type Order = { customerId: number; accountId: number };", "function charge(customer: number, account: number, amount: number) { /* … */ }"] },
        "type alias": { kind: "alias", decl: ["type CustomerId = number;  type AccountId = number;   // structural: same type", "type Order = { customerId: CustomerId; accountId: AccountId };", "function charge(customer: CustomerId, account: AccountId, amount: number) { /* … */ }"] },
        "branded type": { kind: "distinct", decl: ['type CustomerId = number & { readonly __brand: "CustomerId" };  type AccountId = number & { readonly __brand: "AccountId" };', "type Order = { customerId: CustomerId; accountId: AccountId };", "function charge(customer: CustomerId, account: AccountId, amount: number) { /* … */ }"] },
      },
      load: "const order = loadOrder();   // Ada: customer 7, account 42",
      call: ["charge(order.accountId, order.customerId, 25);", "charge(42, order.accountId, 25);"],
      err: (k, act, exp) => `error TS2345: Argument of type '${act}' is not assignable to parameter of type '${exp}'.`, lit: "42",
    },
  };
  const idTypeNames = (lang, kind) => (kind === "distinct" ? (lang === "Go" ? ["CustomerID", "AccountID"] : ["CustomerId", "AccountId"]) : kind === "alias" ? (lang === "Go" ? ["CustomerID (= int64)", "AccountID (= int64)"] : ["CustomerId (= " + ({ "C#": "int", Python: "int", TypeScript: "number" }[lang]) + ")", "AccountId (= " + ({ "C#": "int", Python: "int", TypeScript: "number" }[lang]) + ")"]) : [{ "C#": "int", Java: "long", Python: "int", Go: "int64", TypeScript: "number" }[lang], { "C#": "int", Java: "long", Python: "int", Go: "int64", TypeScript: "number" }[lang]]);
  function idsCode(lang, tname, mistake) {
    const L = IDS[lang], T = L.typings[tname];
    return [...T.decl, "", L.load, L.call[MISTAKES.indexOf(mistake)]];
  }
  function simulateIds(lang, tname, mistake) {
    const L = IDS[lang], T = L.typings[tname], [CT, AT] = idTypeNames(lang, T.kind), frames = [];
    const swapped = mistake === MISTAKES[0];
    const order = { customer: 7, account: 42 };
    const args = swapped ? [{ expr: "order's account id", type: AT, val: order.account }, { expr: "order's customer id", type: CT, val: order.customer }] : [{ expr: "literal 42", type: L.lit, val: 42 }, { expr: "order's account id", type: AT, val: order.account }];
    const params = [{ name: "customer", type: CT }, { name: "account", type: AT }];
    const checks = [];
    const snap = (o) => frames.push({ checks: checks.slice(), args, params, ...o, vars: { "order.customer": order.customer, "order.account": order.account, ...(o.vars || {}) } });
    snap({ line: [0, 1, 2], note: { raw: "Both IDs are the <b>same primitive type</b>. To the compiler a customer id and an account id are interchangeable numbers.", alias: "Aliases give the IDs <b>names</b>, but an alias is just another spelling of the same type. Readers benefit; the compiler sees no difference.", distinct: `Each ID is its <b>own type</b>. ${lang === "Python" ? "NewType exists only for the type checker; at run time CustomerId(7) is just the int 7." : lang === "TypeScript" ? "The brand is a phantom property that exists only in the type system: zero run-time cost." : lang === "Go" ? "A defined type has int64 underneath but is a distinct type for assignment." : "A one-field record/struct costs almost nothing at run time."}` }[T.kind] });
    snap({ line: 4, note: "Load Ada's order: customer 7 pays with account 42.", vars: {} });
    let blocked = false, flagged = false;
    args.forEach((a, k) => {
      const p = params[k];
      let ok, msg = null;
      if (T.kind !== "distinct") ok = true;
      else if (a.type === L.lit) ok = !!L.untypedConst;
      else ok = a.type === p.type;
      if (!ok) { msg = L.err(k + 1, a.type === L.lit && lang === "Python" ? "int" : a.type === L.lit && lang === "TypeScript" ? "42" : a.type === L.lit ? "int" : a.type, p.type); if (L.checkerOnly) flagged = true; else blocked = true; }
      checks.push({ ok, msg });
      const why = ok ? (T.kind === "distinct" && a.type === L.lit ? "An <b>untyped constant</b> converts implicitly to any type whose underlying type is numeric, so <code>42</code> is accepted as a CustomerID. Defined types only stop typed values." : T.kind === "distinct" ? "Types match." : `The parameter wants ${esc(p.type)} and gets ${esc(a.type)}: identical as far as the compiler knows.`) : L.checkerOnly ? "mypy rejects the argument. Python itself will still run the call, because hints are not enforced at run time." : "The types differ, so the compiler rejects the call. This bug never reaches a test, let alone production.";
      snap({ line: 5, cur: k, note: `Argument ${k + 1}: <code>${esc(p.name)}: ${esc(p.type)}</code> ← ${esc(a.expr)} (<code>${esc(a.type)}</code>). ${why}` });
    });
    if (blocked) {
      snap({ line: 5, final: true, outcome: "compile", note: "<b>Build failed.</b> The mix-up is caught at the cheapest possible moment, with an error that names both types.", vars: { result: "compile error" } });
    } else {
      const c = CUST[args[0].val], acct = ACCT[args[1].val];
      const right = args[0].val === order.customer && args[1].val === order.account;
      snap({ line: 5, final: true, outcome: right ? "ok" : "bug", charged: acct.name, cust: c, note: `${flagged ? "mypy flagged it, but if CI does not run mypy the call executes. " : "It compiles and runs. "}Charge looks up customer ${args[0].val} = <b>${c}</b> and account ${args[1].val} = <b>${acct.name}</b>: ${acct.owner === "Ada" && c === "Ada" ? "correct." : `$25 for Ada's order is charged to <b>${acct.name}</b> and the receipt goes to <b>${c}</b>. No exception, no log line: a support ticket weeks later.`}`, vars: { result: flagged ? "checker error, runs anyway" : "runs: wrong charge" } });
    }
    return frames;
  }
  Viz.register(S + "ids", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), opts = Object.keys(IDS[lang].typings), t = pick(v.t, opts), m = pick(v.m, MISTAKES);
    return {
      sig: [lang, t, m].join("|"), title: "Primitive obsession: can the compiler see a swapped ID?", tag: "SIMULATION · TYPE CHECK + RUN",
      legend: [["done", "type check passes"], ["bad", "rejected / wrong result"], ["active", "argument being checked"]],
      code: idsCode(lang, t, m), codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "t", label: "ID representation", type: "select", options: opts, value: t }, { key: "m", label: "mistake", type: "select", options: MISTAKES, value: m }],
      build: (i) => { const l = pick(i.lang, LANGS); return simulateIds(l, pick(i.t, Object.keys(IDS[l].typings)), pick(i.m, MISTAKES)); },
      random: () => { const l = LANGS[Viz.rand(0, 4)], o = Object.keys(IDS[l].typings); return { lang: l, t: o[Viz.rand(0, o.length - 1)], m: MISTAKES[Viz.rand(0, 1)] }; },
      render: (f) => {
        const slots = f.params.map((p, k) => {
          const c = f.checks[k], a = f.args[k], cls = f.cur === k ? "active" : c ? (c.ok ? "done" : "bad") : "";
          return `<div class="ti-slot ${cls}"><div><small>parameter</small><code>${esc(p.name)}: ${esc(p.type)}</code></div><span class="ti-to">←</span><div><small>argument</small><code>${esc(a.expr)}: ${esc(a.type)}</code><small>value ${a.val}</small></div>${c && c.msg ? `<pre class="ti-msg">${esc(c.msg)}</pre>` : ""}</div>`;
        }).join("");
        let out = "";
        if (f.final && f.outcome === "compile") out = `<div class="ti-err compile"><b>compile error</b><pre>build failed: fix the call before anything runs</pre></div>`;
        else if (f.final) out = `<div class="ti-run ${f.outcome === "ok" ? "done" : "bad"}">charged <b>${esc(f.charged)}</b> · receipt to <b>${esc(f.cust)}</b> · order owner <b>Ada</b></div>`;
        return `<div class="ti-slots">${slots}</div>${out}`;
      },
    };
  }, { lang: "C#", t: "plain int", m: MISTAKES[0] }));

  /* ================= 7. parse, don't validate: one boundary check that leaves evidence in the type ================= */
  const PARSE_CODE = ["public sealed record Email {", "    public string Value { get; }", "    private Email(string v) => Value = v;   // only Parse can construct", "    public static Result<Email> Parse(string? raw) {", '        var s = (raw ?? "").Trim();', "        var errors = new List<string>();", '        if (s.Length is 0 or > 254) errors.Add("length 1–254");', "        if (s.Count(c => c == '@') != 1) errors.Add(\"exactly one @\");", "        var (local, domain) = SplitAtLastAt(s);", '        if (local.Length is 0 or > 64) errors.Add("local part 1–64 chars");', "        if (!HasInnerDot(domain)) errors.Add(\"domain needs an inner dot\");", '        if (s.Any(char.IsWhiteSpace)) errors.Add("no spaces");', "        return errors.Count > 0 ? Result.Fail<Email>(errors)", "                                : Result.Ok(new Email(s.ToLowerInvariant()));", "    }", "}", "void Register(Email email) => repo.AddIfNew(email);   // no re-checks"];
  const EXISTING = ["ada@example.com"];
  function simulateParse(raw) {
    const s = raw.trim(), at = s.lastIndexOf("@"), local = at < 0 ? s : s.slice(0, at), domain = at < 0 ? "" : s.slice(at + 1);
    const innerDot = (d) => d.length > 2 && d.slice(1, -1).includes(".") && !d.startsWith(".") && !d.endsWith(".");
    const rules = [
      ["length 1–254", s.length >= 1 && s.length <= 254, 6],
      ["exactly one @", [...s].filter((c) => c === "@").length === 1, 7],
      ["local part 1–64 chars", local.length >= 1 && local.length <= 64, 9],
      ["domain needs an inner dot", innerDot(domain), 10],
      ["no spaces", !/\s/.test(s), 11],
    ];
    const frames = [], done = [];
    const snap = (o) => frames.push({ raw, rules: done.slice(), ...o, vars: { raw: JSON.stringify(raw), trimmed: JSON.stringify(s), errors: done.filter((r) => !r[1]).length, ...(o.vars || {}) } });
    snap({ line: [3, 4], note: `The boundary receives <code>${esc(JSON.stringify(raw))}</code>. Parse trims it first: whatever comes out must already be in canonical form.` });
    rules.forEach((r) => { done.push(r); snap({ line: r[2], cur: done.length - 1, note: `${esc(r[0])}: <b>${r[1] ? "pass" : "fail"}</b>. ${r[1] ? "" : "The error is collected, not thrown, so the caller gets every problem at once."}` }); });
    const ok = rules.every((r) => r[1]), errs = rules.filter((r) => !r[1]).map((r) => r[0]), norm = s.toLowerCase();
    // the "validate" lane: IsValid(raw) uses the same rules but hands the original string onward
    const lanes = {
      validate: ok ? [["Controller", "string", raw, "IsValid(s) → true"], ["Service", "string", raw, "re-checks IsValid(s) (does it? every author must remember)"], ["Repository", "string", raw, EXISTING.includes(raw) ? "duplicate found" : `stores "${raw}": ${EXISTING.includes(norm) ? "DUPLICATE of ada@example.com" : "new row"}`]] : [["Controller", "string", raw, "IsValid(s) → false → 400 \"invalid email\""]],
      parse: ok ? [["Controller", "Email", norm, "Email.Parse(raw) → Ok"], ["Service", "Email", norm, "no check needed: the type is the proof"], ["Repository", "Email", norm, EXISTING.includes(norm) ? "already registered → 409" : `stores "${norm}"`]] : [["Controller", "Result.Fail", errs.join("; "), `400 with ${errs.length} error${errs.length > 1 ? "s" : ""}`]],
    };
    const dupBug = ok && !EXISTING.includes(raw) && EXISTING.includes(norm);
    snap({ line: ok ? 13 : 12, final: true, ok, lanes, dupBug, note: ok ? `Parsed to <code>Email("${esc(norm)}")</code>. Downstream code takes <code>Email</code>, so it cannot receive an unchecked string, and it always sees the canonical form. ${dupBug ? "The string lane stored the raw text, so the same person registered twice." : raw !== norm ? "The string lane carried the un-normalized text everywhere." : "Both lanes agree on this input, but only the Email lane guarantees it for the next one."}` : `Parse returns all ${errs.length} problem${errs.length > 1 ? "s" : ""}. The validate lane only knows <i>false</i>, so the user fixes one thing at a time.`, vars: { result: ok ? `Email(${norm})` : "Fail" } });
    return frames;
  }
  const SAMPLES = ["Ada@Example.COM", " ada@example.com ", "grace@@example.com", "lin.example.com", "bob@localhost", "a b@example.com", "@example.com", "Lin@Example.org"];
  Viz.register(S + "parse", (el) => Viz.player(el, {
    title: "Parse, don't validate: an Email type vs a checked string", tag: "SIMULATION · BOUNDARY + LAYERS",
    legend: [["done", "pass / safe"], ["bad", "fail / bug"], ["active", "rule being checked"]],
    code: PARSE_CODE, codeLang: "csharp",
    inputs: [{ key: "raw", label: "raw input (from a form)", value: "Ada@Example.COM", width: 230 }],
    build: (i) => simulateParse(Viz.parse.str(i.raw ?? "", { min: 0, max: 60 })),
    random: () => ({ raw: SAMPLES[Viz.rand(0, SAMPLES.length - 1)] }),
    render: (f) => {
      const rows = f.rules.map((r, k) => `<tr class="${k === f.cur ? "cur" : ""}"><th>${esc(r[0])}</th><td class="${r[1] ? "done" : "bad"}">${r[1] ? "✓ pass" : "✗ fail"}</td></tr>`).join("");
      const table = `<table class="ti-tbl"><thead><tr><th>rule</th><th>result</th></tr></thead><tbody>${rows || '<tr><th colspan="2">trim, then check each rule</th></tr>'}</tbody></table>`;
      if (!f.final) return table;
      const lane = (name, title) => `<div class="ti-lane"><div class="ti-caption">${title}</div><div class="ti-stages">${f.lanes[name].map(([layer, type, val, what]) => `<div class="ti-stage ${/DUPLICATE|re-checks/.test(what) ? "bad" : name === "parse" ? "done" : ""}"><b>${esc(layer)}</b><code>${esc(type)}</code><span class="ti-val">${esc(JSON.stringify(val))}</span><small>${esc(what)}</small></div>`).join('<span class="ti-to">→</span>')}</div></div>`;
      return `${table}${lane("validate", "validate: bool check, pass the string on")}${lane("parse", "parse: return Email or all errors")}`;
    },
  }));

  /* ================= 8. variance: when is a box of Cats a box of Animals? ================= */
  const VSCEN = ["read-only sequence (producer)", "mutable list, then add a Dog", "array, then store a Dog", "callback that takes Animal (consumer)"];
  const VAR = {
    "C#": [
      { code: ["IEnumerable<Cat> cats = [tom, kit];", "IEnumerable<Animal> animals = cats;   // out T: covariant", "foreach (var a in animals) Console.WriteLine(a.Name);"], assign: "ok", note: "IEnumerable&lt;out T&gt; only hands values <b>out</b>, so a sequence of Cats can safely act as a sequence of Animals." },
      { code: ["List<Cat> cats = [tom, kit];", "List<Animal> animals = cats;", "animals.Add(rex);"], assign: "error CS0029: Cannot implicitly convert type 'List<Cat>' to 'List<Animal>'", note: "List&lt;T&gt; takes values in and out, so it is <b>invariant</b>. If this compiled, Add(rex) would put a Dog in a list of Cats." },
      { code: ["Cat[] cats = [tom, kit];", "Animal[] animals = cats;   // arrays are covariant (legacy)", "animals[0] = rex;", "cats[0].Meow();"], assign: "ok", store: "runtime", storeMsg: "System.ArrayTypeMismatchException: Attempted to access an element as a type incompatible with the array.", note: "Array covariance came from Java in .NET 1.0. It compiles, so the runtime must check <b>every</b> store into a reference-type array." },
      { code: ["Action<Animal> feed = a => a.Eat();", "Action<Cat> feedCat = feed;   // in T: contravariant", "feedCat(tom);"], assign: "ok", note: "Action&lt;in T&gt; only takes values <b>in</b>. Anything that can feed any Animal can certainly feed a Cat." },
    ],
    Java: [
      { code: ["List<Cat> cats = List.of(tom, kit);", "List<? extends Animal> animals = cats;   // use-site covariance", "for (Animal a : animals) System.out.println(a.name());"], assign: "ok", note: "Java has no declaration-site variance; the wildcard <code>? extends Animal</code> says \"I will only read\". PECS: Producer Extends." },
      { code: ["List<Cat> cats = new ArrayList<>(List.of(tom, kit));", "List<Animal> animals = cats;", "animals.add(rex);"], assign: "error: incompatible types: List<Cat> cannot be converted to List<Animal>", note: "Generic types are <b>invariant</b> unless a wildcard says otherwise. (With <code>? extends Animal</code> the assignment works, but then add(rex) is the compile error.)" },
      { code: ["Cat[] cats = { tom, kit };", "Animal[] animals = cats;   // arrays are covariant", "animals[0] = rex;", "cats[0].meow();"], assign: "ok", store: "runtime", storeMsg: "java.lang.ArrayStoreException: Dog", note: "Java arrays are covariant and reified, so the JVM checks each store at run time." },
      { code: ["Consumer<Animal> feed = a -> a.eat();", "Consumer<? super Cat> feedCat = feed;   // use-site contravariance", "feedCat.accept(tom);"], assign: "ok", note: "<code>? super Cat</code>: anything that consumes a supertype of Cat. PECS: Consumer Super." },
    ],
    Python: [
      { code: ["cats: Sequence[Cat] = [tom, kit]", "animals: Sequence[Animal] = cats   # Sequence is covariant", "for a in animals: print(a.name)"], assign: "ok", note: "typing.Sequence is read-only, so the checker treats it as covariant." },
      { code: ["cats: list[Cat] = [tom, kit]", "animals: list[Animal] = cats", "animals.append(rex)", "cats[2].meow()"], assign: "checker", assignMsg: 'error: Incompatible types in assignment (expression has type "list[Cat]", variable has type "list[Animal]")  [assignment]\nnote: "list" is invariant -- consider using "Sequence", which is covariant', store: "ok", read: 'AttributeError: \'Dog\' object has no attribute \'meow\'', note: "list is invariant for mypy. At run time Python never checks, so the Dog goes in and the crash happens later, far from the cause." },
      { code: ["# Python has no typed arrays of objects: list is the array", "cats: list[Cat] = [tom, kit]", "animals: list[Animal] = cats", "animals.append(rex)", "cats[2].meow()"], assign: "checker", assignMsg: 'error: Incompatible types in assignment (expression has type "list[Cat]", variable has type "list[Animal]")  [assignment]', store: "ok", read: "AttributeError: 'Dog' object has no attribute 'meow'", note: "Same as the list case: only the type checker can object." },
      { code: ["def feed(a: Animal) -> None: a.eat()", "feed_cat: Callable[[Cat], None] = feed   # parameters are contravariant", "feed_cat(tom)"], assign: "ok", note: "Callable is contravariant in its parameters: a function accepting any Animal is a fine Cat-feeder." },
    ],
    Go: [
      { code: ["cats := []Cat{tom, kit}", "var animals []Animal = cats", "for _, a := range animals { fmt.Println(a.Name()) }"], assign: "cannot use cats (variable of type []Cat) as []Animal value in variable declaration", note: "Go has no variance at all. []Cat and []Animal have different memory layouts (structs vs interface values), so you copy in a loop." },
      { code: ["cats := []Cat{tom, kit}", "var animals []Animal = cats", "animals = append(animals, rex)"], assign: "cannot use cats (variable of type []Cat) as []Animal value in variable declaration", note: "Invariant, like every Go type. Build a new []Animal if you need one." },
      { code: ["cats := [2]Cat{tom, kit}", "var animals [2]Animal = cats", "animals[0] = rex"], assign: "cannot use cats (variable of type [2]Cat) as [2]Animal value in variable declaration", note: "Arrays are invariant too; Go never had Java's array covariance." },
      { code: ["feed := func(a Animal) { a.Eat() }", "var feedCat func(Cat) = feed", "feedCat(tom)"], assign: "cannot use feed (variable of type func(a Animal)) as func(Cat) value in variable declaration", note: "No function variance either. Wrap it: <code>func(c Cat) { feed(c) }</code>." },
    ],
    TypeScript: [
      { code: ["const cats: readonly Cat[] = [tom, kit];", "const animals: readonly Animal[] = cats;", "animals.forEach((a) => console.log(a.name));"], assign: "ok", note: "readonly arrays are covariant, and safely so: there is no push." },
      { code: ["const cats: Cat[] = [tom, kit];", "const animals: Animal[] = cats;   // allowed: arrays are covariant", "animals.push(rex);", "cats[2].meow();"], assign: "ok", store: "ok", read: "TypeError: cats[2].meow is not a function", note: "TypeScript deliberately makes mutable arrays covariant (unsound, but convenient). Nothing checks at run time, so the Dog sits in the Cat array until someone calls meow()." },
      { code: ["// TypeScript arrays are the same as lists here", "const cats: Cat[] = [tom, kit];", "const animals: Animal[] = cats;", "animals[0] = rex;", "cats[0].meow();"], assign: "ok", store: "ok", read: "TypeError: cats[0].meow is not a function", note: "Same unsoundness as push: the compiler accepts it, JavaScript stores anything." },
      { code: ["const feed = (a: Animal) => a.eat();", "const feedCat: (c: Cat) => void = feed;   // contravariant (strictFunctionTypes)", "feedCat(tom);"], assign: "ok", note: "With strictFunctionTypes, function-typed properties are checked contravariantly. (Method-syntax members are still bivariant: a known hole.)" },
    ],
  };
  function simulateVariance(lang, sc) {
    const V = VAR[lang][VSCEN.indexOf(sc)], frames = [], kind = VSCEN.indexOf(sc);
    const box = { items: kind === 3 ? [] : ["Cat tom", "Cat kit"] };
    const snap = (o) => frames.push({ box: Viz.clone(box), kind, ...o, vars: { "real type": o.real, "typed as": o.view || "–", "dogs inside": box.items.filter((x) => x.startsWith("Dog")).length } });
    const realType = { "C#": ["IEnumerable<Cat>", "List<Cat>", "Cat[]", "Action<Animal>"], Java: ["List<Cat>", "ArrayList<Cat>", "Cat[]", "Consumer<Animal>"], Python: ["list (of Cat)", "list (of Cat)", "list (of Cat)", "function feed"], Go: ["[]Cat", "[]Cat", "[2]Cat", "func(Animal)"], TypeScript: ["Cat[]", "Cat[]", "Cat[]", "(a: Animal) => void"] }[lang][kind];
    snap({ line: 0, real: realType, view: null, note: kind === 3 ? "A function that can feed <b>any</b> Animal." : "A container that really holds Cats." });
    const blocked = V.assign !== "ok" && V.assign !== "checker";
    const asMsg = V.assign === "checker" ? V.assignMsg : blocked ? V.assign : null;
    const viewType = { "C#": ["IEnumerable<Animal>", "List<Animal>", "Animal[]", "Action<Cat>"], Java: ["List<? extends Animal>", "List<Animal>", "Animal[]", "Consumer<? super Cat>"], Python: ["Sequence[Animal]", "list[Animal]", "list[Animal]", "Callable[[Cat], None]"], Go: ["[]Animal", "[]Animal", "[2]Animal", "func(Cat)"], TypeScript: ["readonly Animal[]", "Animal[]", "Animal[]", "(c: Cat) => void"] }[lang][kind];
    const assignLine = V.code[0].startsWith("#") || V.code[0].startsWith("//") ? 2 : 1;
    snap({ line: assignLine, real: realType, view: viewType, err: asMsg ? [V.assign === "checker" ? "checker" : "compile", asMsg] : null, note: (blocked ? "<b>Compile error.</b> " : V.assign === "checker" ? "<b>mypy rejects this</b>, but the interpreter does not care. " : "<b>Allowed.</b> ") + V.note });
    if (blocked) return frames;
    if (kind === 0) {
      snap({ line: 2, real: realType, view: viewType, read: true, note: "Reading through the Animal view only ever produces Cats, which are Animals. Covariance is safe for producers." });
      return frames;
    }
    if (kind === 3) {
      box.items = ["Cat tom"];
      snap({ line: 2, real: realType, view: viewType, read: true, note: "The Cat-feeder is called with a Cat; the underlying function accepts any Animal, so it works. Contravariance is safe for consumers." });
      return frames;
    }
    const storeLine = assignLine + 1;
    if (V.store === "runtime") {
      snap({ line: storeLine, real: realType, view: viewType, err: ["runtime", V.storeMsg], dog: true, note: "The array object remembers it was created as Cat[], so the runtime rejects the Dog <b>at the store</b>, close to the bug. The price: a type check on every reference-array write." });
      return frames;
    }
    box.items[kind === 2 && lang !== "Python" ? 0 : 2] = "Dog rex";
    if (kind === 1 || lang === "Python") { box.items = ["Cat tom", "Cat kit", "Dog rex"]; }
    snap({ line: storeLine, real: realType, view: viewType, dog: true, note: "Nothing checks the store. A <b>Dog is now inside the Cat container</b>, and the code holding <code>cats</code> has no idea (this is called heap pollution)." });
    snap({ line: storeLine + 1, real: realType, view: viewType, dog: true, err: ["runtime", V.read], note: "Much later, code that trusts the type reads a \"Cat\" and calls meow(). The crash points here, not at the line that caused it." });
    return frames;
  }
  Viz.register(S + "variance", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), sc = pick(v.s, VSCEN);
    return {
      sig: lang + "|" + sc, title: "Variance: when is a box of Cats a box of Animals?", tag: "SIMULATION · TYPE CHECK + STORE",
      legend: [["done", "safe"], ["bad", "Dog where a Cat is expected"], ["active", "current operation"]],
      code: VAR[lang][VSCEN.indexOf(sc)].code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "s", label: "scenario", type: "select", options: VSCEN, value: sc }],
      build: (i) => simulateVariance(pick(i.lang, LANGS), pick(i.s, VSCEN)),
      random: () => ({ lang: LANGS[Viz.rand(0, 4)], s: VSCEN[Viz.rand(0, 3)] }),
      render: (f) => {
        const cells = f.box.items.map((x) => `<span class="ti-animal ${x.startsWith("Dog") ? "dog" : "cat"}">${esc(x)}</span>`).join("") || '<span class="ti-muted">(a function, not a container)</span>';
        const views = `<div class="ti-views"><div class="ti-view"><small>object's real type</small><code>${esc(f.real)}</code></div>${f.view ? `<div class="ti-view ${f.err && f.err[0] === "compile" ? "bad" : "path"}"><small>new reference typed as</small><code>${esc(f.view)}</code></div>` : ""}</div>`;
        const err = f.err ? `<div class="ti-err ${f.err[0]}"><b>${{ compile: "compile error", runtime: "run-time error", checker: "type checker (CI only)" }[f.err[0]]}</b><pre>${esc(f.err[1])}</pre></div>` : "";
        return `${views}<div class="ti-box ${f.dog ? "bad" : f.read ? "done" : ""}">${cells}</div>${err}`;
      },
    };
  }, { lang: "C#", s: VSCEN[2] }));
})();
