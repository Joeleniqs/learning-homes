/* Visualizers for "Advanced DI: Decorators, Factories, Options & Testing". Every registered name is prefixed with the slug. */
(() => {
  const esc = Viz.esc;
  const pick = (a) => a[Viz.rand(0, a.length - 1)];
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const list = (s) => String(s).split(/[;,]/).map((x) => x.trim()).filter(Boolean);
  const chip = (text, cls = "", title = "") => `<span class="dav-chip ${cls}"${title ? ` title="${esc(title)}"` : ""}>${text}</span>`;

  /* =====================================================================
   * 1. Multi-registration: Add / TryAdd / TryAddEnumerable / Replace / RemoveAll
   * ===================================================================== */
  const MULTI_PRESETS = {
    "app, then a library": "Add Email; Add Sms; TryAdd Push; TryAddEnumerable Sms; TryAddEnumerable Push",
    "library first, app second": "TryAdd Email; Add Sms",
    "test swap with Replace": "Add Email; Add Sms; Replace FakeNotifier",
    "test swap with RemoveAll + Add": "Add Email; Add Sms; RemoveAll; Add FakeNotifier",
    "custom (edit the script)": null,
  };
  const MULTI_OPS = { add: "Add", tryadd: "TryAdd", tryaddenumerable: "TryAddEnumerable", replace: "Replace", removeall: "RemoveAll" };
  const MULTI_LINE = { Add: 0, TryAdd: 1, TryAddEnumerable: 2, Replace: 3, RemoveAll: 4 };
  function parseMulti(s) {
    const ops = list(String(s).replace(/,/g, ";")).map((raw) => {
      const m = raw.match(/^(Add|TryAdd|TryAddEnumerable|Replace|RemoveAll)(?:\s+([A-Za-z]\w*))?$/i);
      if (!m) throw new Error(`Cannot read "${raw}". Use Add X, TryAdd X, TryAddEnumerable X, Replace X or RemoveAll, separated by ";".`);
      const op = MULTI_OPS[m[1].toLowerCase()];
      if (op !== "RemoveAll" && !m[2]) throw new Error(`${op} needs an implementation name, for example "${op} Email".`);
      if (op === "RemoveAll" && m[2]) throw new Error("RemoveAll takes no name: it removes every INotifier.");
      if (m[2] && m[2].length > 16) throw new Error("Keep implementation names to 16 characters.");
      return { op, impl: m[2] || "" };
    });
    if (!ops.length || ops.length > 10) throw new Error("Use 1 to 10 operations.");
    return ops;
  }
  Viz.register("di-advanced-multi", (host) => Viz.player(host, {
    title: "One interface, many registrations: what each call does to the list",
    tag: "SERVICE COLLECTION · STEP THROUGH",
    legend: [["active", "appended now"], ["bad", "removed"], ["dim", "skipped (no-op)"], ["done", "in the list"]],
    code: [
      "services.AddSingleton<INotifier, X>();           // always appends",
      "services.TryAddSingleton<INotifier, X>();        // only if INotifier has no registration",
      "services.TryAddEnumerable(Singleton<INotifier, X>()); // only if X is not in the list",
      "services.Replace(Singleton<INotifier, X>());     // removes the FIRST INotifier, appends X",
      "services.RemoveAll<INotifier>();                  // removes every INotifier",
      "sp.GetService<INotifier>()   // one service: the LAST descriptor wins",
      "sp.GetServices<INotifier>()  // IEnumerable: all of them, in order",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "preset", label: "scenario", type: "select", options: Object.keys(MULTI_PRESETS), value: "app, then a library" },
      { key: "script", label: "custom script", value: "Add Email; TryAdd Sms; Add Push; Replace Fake", width: 330 },
    ],
    random: () => {
      const names = ["Email", "Sms", "Push", "Slack", "Fake"];
      const ops = Array.from({ length: Viz.rand(3, 6) }, () => { const o = pick(["Add", "Add", "TryAdd", "TryAddEnumerable", "Replace", "RemoveAll"]); return o === "RemoveAll" ? o : `${o} ${pick(names)}`; });
      return { preset: "custom (edit the script)", script: ops.join("; ") };
    },
    build: ({ preset, script }) => {
      if (!(preset in MULTI_PRESETS)) throw new Error("Pick a scenario from the list.");
      const ops = parseMulti(MULTI_PRESETS[preset] ?? script);
      const fr = [];
      let L = [], seq = 0;
      const snap = (line, note, st = {}) => fr.push({ L: L.map((d) => ({ ...d })), ghosts: st.ghosts || [], hi: st.hi ?? null, res: st.res || null, line, note, vars: { descriptors: L.length, "single resolve": L.length ? L[L.length - 1].impl : "throws / null", ...(st.vars || {}) } });
      snap(-1, "<b>An empty <code>IServiceCollection</code>.</b> Registration is just appending <code>ServiceDescriptor</code>s to a list. Nothing is built until <code>BuildServiceProvider()</code>, so the <i>order</i> of the list is the whole story.");
      for (const { op, impl } of ops) {
        const line = MULTI_LINE[op];
        if (op === "Add") {
          L.push({ impl, id: ++seq });
          snap(line, `<b>Add ${esc(impl)}</b> appends unconditionally. ${L.length > 1 ? `There are now ${L.length} <code>INotifier</code> descriptors: a single resolve will return <b>${esc(impl)}</b> because it is last, while <code>IEnumerable&lt;INotifier&gt;</code> returns all ${L.length}.` : "It is the only one, so it is both the single answer and the whole list."}`, { hi: L.length - 1 });
        } else if (op === "TryAdd") {
          if (L.length) snap(line, `<b>TryAdd ${esc(impl)}</b> is a no-op: <code>INotifier</code> already has ${L.length} registration${L.length > 1 ? "s" : ""}. This is how a library says "only if the app has not chosen one". It checks the <i>service type</i> only.`, { ghosts: [{ impl, cls: "dim", why: "skipped: INotifier already registered" }] });
          else { L.push({ impl, id: ++seq }); snap(line, `<b>TryAdd ${esc(impl)}</b> adds it because <code>INotifier</code> has no registration yet. Careful: anything added <i>later</i> with <code>Add</code> is appended after it, and ${esc(impl)} stays in the list.`, { hi: L.length - 1 }); }
        } else if (op === "TryAddEnumerable") {
          const dup = L.findIndex((d) => d.impl === impl);
          if (dup >= 0) snap(line, `<b>TryAddEnumerable ${esc(impl)}</b> is a no-op: the pair (<code>INotifier</code>, <code>${esc(impl)}</code>) is already at position ${dup}. It checks the service <i>and</i> implementation type, so calling a library's <code>AddX()</code> twice does not register the same handler twice.`, { ghosts: [{ impl, cls: "dim", why: `skipped: ${impl} already in the list` }], hi: dup });
          else { L.push({ impl, id: ++seq }); snap(line, `<b>TryAddEnumerable ${esc(impl)}</b> appends: no existing descriptor uses <code>${esc(impl)}</code>. Use it for plug-in style lists (validators, handlers, notifiers) where every distinct implementation should appear once.`, { hi: L.length - 1 }); }
        } else if (op === "Replace") {
          const gone = L.shift();
          L.push({ impl, id: ++seq });
          snap(line, gone ? `<b>Replace ${esc(impl)}</b> removed only the <b>first</b> <code>INotifier</code> (${esc(gone.impl)}) and appended ${esc(impl)}. ${L.length > 1 ? `<b>${L.slice(0, -1).map((d) => esc(d.impl)).join(", ")}</b> ${L.length > 2 ? "are" : "is"} still registered: a single resolve gets ${esc(impl)}, but anything that injects <code>IEnumerable&lt;INotifier&gt;</code> still calls the real one${L.length > 2 ? "s" : ""}.` : "It was the only one, so Replace behaved like a swap."}` : `<b>Replace ${esc(impl)}</b> found nothing to remove, so it simply appended ${esc(impl)}.`, { hi: L.length - 1, ghosts: gone ? [{ impl: gone.impl, cls: "bad", why: "removed by Replace (first match only)" }] : [] });
        } else {
          const gone = L; L = [];
          snap(line, gone.length ? `<b>RemoveAll</b> deleted all ${gone.length} <code>INotifier</code> descriptors. Followed by <code>Add</code>, this is the reliable way to swap a multi-registered service in a test host.` : "<b>RemoveAll</b> on an empty list does nothing.", { ghosts: gone.map((d) => ({ impl: d.impl, cls: "bad", why: "removed by RemoveAll" })) });
        }
      }
      const single = L.length ? L[L.length - 1].impl : null;
      snap(5, single ? `<b>GetService&lt;INotifier&gt;()</b> → <b>${esc(single)}</b>. The provider keeps every descriptor but answers a single request with the <b>last</b> one. That is why the app's registration beats a library's when the app registers after it.` : "<b>GetService&lt;INotifier&gt;()</b> → <b>null</b> (and <code>GetRequiredService</code> throws <i>No service for type 'INotifier' has been registered</i>).", { hi: L.length - 1, res: "single" });
      const all = L.map((d) => d.impl);
      const fake = all.some((x) => /fake/i.test(x)), real = all.filter((x) => !/fake/i.test(x));
      snap(6, `<b>GetServices&lt;INotifier&gt;()</b> → [${all.map(esc).join(", ") || "empty"}]. ${fake && real.length ? `<b>Danger:</b> the fake won the single resolve, but a fan-out that injects <code>IEnumerable&lt;INotifier&gt;</code> still calls <b>${real.map(esc).join(", ")}</b>. In a test that means real SMS or email. Use <code>RemoveAll</code> then <code>Add</code>.` : all.length > 1 ? "A composite or fan-out sees every registration, in registration order. Order matters for pipelines (validators, handlers)." : "Single and enumerable agree because there is at most one."}`, { res: "all", vars: { "GetServices": `[${all.join(", ")}]` } });
      return fr;
    },
    render: (f) => {
      const rows = f.L.map((d, i) => `<div class="dav-desc ${f.hi === i ? "active" : "done"} ${f.res === "single" && i === f.L.length - 1 ? "win" : ""} ${f.res === "all" ? "all" : ""}"><span class="dav-idx">${i}</span><code>INotifier → ${esc(d.impl)}</code><small>${i === f.L.length - 1 ? "last: wins a single resolve" : ""}</small></div>`).join("");
      const ghosts = f.ghosts.map((g) => `<div class="dav-desc ghost ${g.cls}"><span class="dav-idx">–</span><code>INotifier → ${esc(g.impl)}</code><small>${esc(g.why)}</small></div>`).join("");
      const single = f.L.length ? f.L[f.L.length - 1].impl : "null";
      return `<div class="dav-two"><div class="v-labeled dav-col"><span class="v-caption">IServiceCollection (in order)</span><div class="dav-descs">${rows || '<div class="dav-empty">no INotifier registrations</div>'}${ghosts}</div></div>
        <div class="v-labeled dav-col"><span class="v-caption">what consumers would get now</span>
        <div class="dav-res ${f.res === "single" ? "cur" : ""}"><b>OrderService(INotifier n)</b><span>${chip(esc(single), single === "null" ? "bad" : "path")}</span></div>
        <div class="dav-res ${f.res === "all" ? "cur" : ""}"><b>Fanout(IEnumerable&lt;INotifier&gt; all)</b><span>${f.L.map((d) => chip(esc(d.impl), /fake/i.test(d.impl) ? "path" : "done")).join("") || chip("empty", "dim")}</span></div></div></div>`;
    },
  }));

  /* =====================================================================
   * 2. Keyed services: exact key → AnyKey fallback → throw
   * ===================================================================== */
  const KEY_CALLS = ["GetRequiredKeyedService(key)", "GetKeyedService(key)", "GetService() — no key"];
  Viz.register("di-advanced-keyed", (host) => Viz.player(host, {
    title: "Keyed resolution: exact key, then AnyKey, then fail",
    tag: "KEYED SERVICES · STEP THROUGH",
    legend: [["active", "checking"], ["done", "match"], ["path", "reused instance"], ["bad", "no match / throws"], ["dim", "not considered"]],
    code: [
      "s.AddKeyedSingleton<IPaymentGateway, StripeGateway>(\"stripe\");",
      "s.AddKeyedSingleton<IPaymentGateway, AdyenGateway>(\"adyen\");",
      "s.AddKeyedSingleton<IPaymentGateway, FallbackGateway>(KeyedService.AnyKey);",
      "s.AddSingleton<IPaymentGateway, StripeGateway>();   // non-keyed default",
      "// FallbackGateway([ServiceKey] string key) learns which key was asked for",
      "var gw = sp.GetRequiredKeyedService<IPaymentGateway>(key);",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "keys", label: "keys asked for, in order", value: "stripe, klarna, klarna, adyen", width: 230 },
      { key: "anykey", label: "AnyKey fallback", type: "select", options: ["registered", "not registered"], value: "registered" },
      { key: "def", label: "non-keyed default", type: "select", options: ["registered", "not registered"], value: "not registered" },
      { key: "call", label: "call", type: "select", options: KEY_CALLS, value: KEY_CALLS[0] },
    ],
    random: () => ({ keys: Array.from({ length: Viz.rand(2, 5) }, () => pick(["stripe", "adyen", "klarna", "paypal", "stripe"])).join(", "), anykey: pick(["registered", "not registered"]), def: pick(["registered", "not registered"]), call: pick(KEY_CALLS) }),
    build: ({ keys, anykey, def, call }) => {
      const ks = list(keys);
      if (!ks.length || ks.length > 6) throw new Error("Ask for 1 to 6 keys, separated by commas.");
      ks.forEach((k) => { if (!/^[a-z0-9-]{1,12}$/i.test(k)) throw new Error(`"${k}": use letters, digits or "-", up to 12 characters.`); });
      if (!KEY_CALLS.includes(call)) throw new Error("Pick a call from the list.");
      const regs = [{ key: "stripe", impl: "StripeGateway", line: 0 }, { key: "adyen", impl: "AdyenGateway", line: 1 }];
      if (anykey === "registered") regs.push({ key: "*", impl: "FallbackGateway", line: 2 });
      if (def === "registered") regs.push({ key: null, impl: "StripeGateway", line: 3 });
      const inst = new Map(); let n = 0;
      const fr = [], out = [];
      const snap = (line, note, st = {}) => fr.push({ regs, inst: [...inst.entries()].map(([k, v]) => ({ k, ...v })), cur: st.cur ?? null, regSt: st.regSt || {}, out: out.slice(), line, note, vars: { key: st.key ?? "—", instances: inst.size, ...(st.vars || {}) } });
      snap(-1, `<b>${regs.length} registrations for one interface.</b> Keyed and non-keyed registrations live side by side but never mix: a keyed lookup ignores non-keyed entries and a plain <code>GetService</code> ignores keyed ones. Singletons are cached <i>per key</i>.`);
      const getInst = (r, key, i) => {
        const id = `${r.line}|${r.key === "*" ? key : r.key}`;
        if (inst.has(id)) { snap(5, `Same registration and same key as before, so it is the <b>same singleton</b> #${inst.get(id).n}.`, { cur: i, key, regSt: { [r.line]: "path" } }); return inst.get(id); }
        const v = { n: ++n, impl: r.impl, key: r.key === "*" ? key : r.key };
        inst.set(id, v);
        snap(r.key === "*" ? 4 : 5, r.key === "*" ? `Construct <b>FallbackGateway #${v.n}</b> with <code>[ServiceKey]</code> = "${esc(key)}". An AnyKey singleton is created <b>once per distinct key</b>, so it can route by key, but it also means unbounded keys mean unbounded singletons.` : `Construct <b>${esc(r.impl)} #${v.n}</b>${r.key ? ` for key "${esc(r.key)}"` : " (the non-keyed registration: a different singleton from the keyed one)"}.`, { cur: i, key, regSt: { [r.line]: "done" } });
        return v;
      };
      ks.forEach((key, i) => {
        if (call === KEY_CALLS[2]) {
          const d = regs.filter((r) => r.key === null).pop();
          snap(5, `<b>GetService&lt;IPaymentGateway&gt;()</b> for "${esc(key)}": a plain lookup has no key, so the key is simply ignored and only <b>non-keyed</b> registrations are candidates.`, { cur: i, key, regSt: Object.fromEntries(regs.map((r) => [r.line, r.key === null ? "active" : "dim"])) });
          if (!d) { out.push({ key, res: "null", cls: "bad" }); snap(5, "No non-keyed registration exists, so the result is <b>null</b>. Keyed registrations are invisible here; a constructor that takes a plain <code>IPaymentGateway</code> fails to resolve.", { cur: i, key, regSt: { 0: "dim", 1: "dim", 2: "dim" } }); return; }
          const v = getInst(d, key, i); out.push({ key, res: `${v.impl} #${v.n}`, cls: "done" }); return;
        }
        snap(5, `<b>Lookup "${esc(key)}".</b> First look for a registration whose key equals "${esc(key)}" exactly.`, { cur: i, key, regSt: Object.fromEntries(regs.map((r) => [r.line, r.key === key ? "active" : r.key === null ? "dim" : ""])) });
        const exact = regs.filter((r) => r.key === key).pop();
        if (exact) { const v = getInst(exact, key, i); out.push({ key, res: `${v.impl} #${v.n}`, cls: "done" }); return; }
        const any = regs.find((r) => r.key === "*");
        if (any) { snap(2, `No exact key "${esc(key)}". An <code>AnyKey</code> registration exists, so it is the fallback for <i>every</i> key not registered explicitly.`, { cur: i, key, regSt: { 2: "active", 3: "dim" } }); const v = getInst(any, key, i); out.push({ key, res: `${v.impl} #${v.n}`, cls: "path" }); return; }
        if (call === KEY_CALLS[1]) { out.push({ key, res: "null", cls: "bad" }); snap(5, `No key "${esc(key)}" and no AnyKey: <b>GetKeyedService returns null</b>. Your code must handle it, or you get a NullReferenceException far away from the cause.`, { cur: i, key, regSt: Object.fromEntries(regs.map((r) => [r.line, "bad"])) }); return; }
        out.push({ key, res: "throws", cls: "bad" });
        snap(5, `<b>InvalidOperationException:</b> <i>No keyed service for type 'IPaymentGateway' using key type 'System.String' has been registered.</i> ${def === "registered" ? "The non-keyed StripeGateway does not count as a fallback." : ""} Validate keys at the edge (config, request input) instead of letting a typo reach the container.`, { cur: i, key, regSt: Object.fromEntries(regs.map((r) => [r.line, "bad"])) });
      });
      snap(-1, `<b>${inst.size} instance${inst.size === 1 ? "" : "s"}</b> for ${ks.length} lookup${ks.length === 1 ? "" : "s"}. Keys are runtime values: the container cannot prove at startup that "${esc(ks[ks.length - 1])}" will exist. Prefer a small, closed set of keys (an enum or constants) and test each one.`);
      return fr;
    },
    render: (f) => {
      const regs = f.regs.map((r) => `<div class="dav-kreg ${f.regSt[r.line] || ""}"><code>${r.key === "*" ? "AnyKey" : r.key === null ? "(no key)" : `"${esc(r.key)}"`}</code><span>→ ${esc(r.impl)}</span></div>`).join("");
      const inst = f.inst.map((v) => chip(`${esc(v.impl)} #${v.n}<small>${v.key ? `key ${esc(v.key)}` : "non-keyed"}</small>`, "done")).join("") || chip("none yet", "dim");
      const outs = f.out.map((o, i) => `<div class="dav-kout ${i === f.cur ? "cur" : ""}"><code>"${esc(o.key)}"</code>${chip(esc(o.res), o.cls)}</div>`).join("");
      return `<div class="dav-two"><div class="v-labeled dav-col"><span class="v-caption">registrations for IPaymentGateway</span><div class="dav-kregs">${regs}</div><span class="v-caption">singletons created</span><div class="dav-chips">${inst}</div></div>
        <div class="v-labeled dav-col"><span class="v-caption">lookups</span><div class="dav-kouts">${outs || '<div class="dav-empty">no lookups yet</div>'}</div></div></div>`;
    },
  }));

  /* =====================================================================
   * 3. Eager vs Lazy<T> vs Func<T> vs a singleton Func that captured the root
   * ===================================================================== */
  const LZ_STRATS = ["constructor injection (eager)", "Lazy<T> registered scoped", "Func<T> registered scoped", "Func<T> registered as singleton"];
  Viz.register("di-advanced-lazy", (host) => Viz.player(host, {
    title: "Deferring an expensive dependency: who pays, and who owns it?",
    tag: "FACTORIES · STEP THROUGH",
    legend: [["active", "constructed now (300 ms)"], ["done", "alive, owned by the request scope"], ["bad", "held by the root until shutdown / error"], ["dim", "disposed"]],
    code: [
      "public ReportsController(PdfRenderer pdf)            // eager",
      "public ReportsController(Lazy<PdfRenderer> pdf)      // pdf.Value on first use",
      "public ReportsController(Func<PdfRenderer> pdf)      // pdf() on every call",
      "s.AddScoped(sp => new Lazy<PdfRenderer>(() => sp.GetRequiredService<PdfRenderer>()));",
      "s.AddScoped<Func<PdfRenderer>>(sp => () => sp.GetRequiredService<PdfRenderer>());",
      "s.AddSingleton<Func<PdfRenderer>>(sp => () => sp.GetRequiredService<PdfRenderer>()); // sp is the ROOT",
      "// end of request: the scope disposes what it created",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "strat", label: "strategy", type: "select", options: LZ_STRATS, value: LZ_STRATS[1] },
      { key: "life", label: "PdfRenderer lifetime", type: "select", options: ["transient", "scoped"], value: "transient" },
      { key: "reqs", label: "requests (list | pdf | pdf2)", value: "list, pdf, list, pdf2", width: 200 },
      { key: "val", label: "ValidateScopes", type: "select", options: ["on", "off"], value: "on" },
    ],
    random: () => ({ strat: pick(LZ_STRATS), life: pick(["transient", "scoped"]), reqs: Array.from({ length: Viz.rand(2, 5) }, () => pick(["list", "pdf", "pdf2"])).join(", "), val: pick(["on", "off"]) }),
    build: ({ strat, life, reqs, val }) => {
      const R = list(reqs).map((x) => x.toLowerCase());
      if (!R.length || R.length > 6) throw new Error("Use 1 to 6 requests: list, pdf or pdf2.");
      R.forEach((x) => { if (!["list", "pdf", "pdf2"].includes(x)) throw new Error(`"${x}": each request is list (no PDF), pdf (render once) or pdf2 (render twice).`); });
      const si = LZ_STRATS.indexOf(strat); if (si < 0) throw new Error("Pick a strategy from the list.");
      const fr = [], inst = []; let n = 0, ms = 0, rootSingle = null;
      const regLine = [0, 3, 4, 5][si];
      const snap = (line, note, req, cur) => fr.push({ inst: inst.map((x) => ({ ...x })), req, cur, line, note, vars: { request: req ? `${req.no}: ${req.kind}` : "—", "ctor time": `${ms} ms`, created: n, "held by root": inst.filter((x) => x.owner === "root" && !x.disposed).length } });
      snap(regLine, `<b>${esc(strat)}</b>, PdfRenderer is <b>${life}</b> and costs 300 ms to construct. Watch how many renderers get built, which scope owns them, and when they are disposed. ${si === 3 ? "The singleton's factory lambda receives the <b>root</b> provider, because singletons are built by the root." : ""}`);
      const make = (owner, req) => { const x = { n: ++n, owner, req: req.no, disposed: false }; inst.push(x); ms += 300; return x; };
      for (let r = 0; r < R.length; r++) {
        const req = { no: r + 1, kind: R[r] };
        const uses = { list: 0, pdf: 1, pdf2: 2 }[req.kind];
        let held = null, lazyVal = null, scopedOne = null, err = null;
        snap(si === 0 ? 0 : si === 1 ? 1 : 2, `<b>Request ${req.no} (${req.kind})</b> opens a scope and constructs the controller. ${uses === 0 ? "This request never renders a PDF." : uses === 1 ? "It renders one PDF." : "It renders two PDFs."}`, req);
        if (si === 0) { held = make("scope", req); snap(0, `Eager: the renderer #${held.n} is built <b>while constructing the controller</b>, before the action even runs. ${uses === 0 ? "<b>300 ms wasted</b>: this request does not need it." : ""}`, req, held.n); }
        for (let u = 0; u < uses && !err; u++) {
          if (si === 0) { snap(0, `Render ${u + 1} uses the injected renderer #${held.n}.`, req, held.n); continue; }
          if (si === 1) {
            if (lazyVal) { snap(1, `<code>pdf.Value</code> again: <code>Lazy&lt;T&gt;</code> caches, so it returns renderer #${lazyVal.n} even though the renderer is ${life}.`, req, lazyVal.n); continue; }
            lazyVal = make("scope", req); snap(1, `First <code>pdf.Value</code>: the Lazy calls the <b>scope's</b> provider and builds renderer #${lazyVal.n} now. The cost moved from construction to first use, and only requests that render pay it.`, req, lazyVal.n); continue;
          }
          if (si === 2) {
            if (life === "scoped" && scopedOne) { snap(2, `<code>pdf()</code> again: the renderer is scoped, so the scope returns the same #${scopedOne.n}.`, req, scopedOne.n); continue; }
            const x = make("scope", req); if (life === "scoped") scopedOne = x;
            snap(2, `<code>pdf()</code> resolves from the request scope: ${life === "transient" ? `a <b>new</b> transient #${x.n} on every call. Use Func when you really want a fresh instance each time.` : `scoped renderer #${x.n}, owned by this request.`}`, req, x.n); continue;
          }
          if (life === "scoped" && val === "on") { err = true; snap(5, "<b>InvalidOperationException:</b> <i>Cannot resolve scoped service 'PdfRenderer' from root provider.</i> The singleton Func captured the root. ValidateOnBuild did not catch this: the lambda is opaque, so it fails only when called.", req); break; }
          if (life === "scoped") {
            if (!rootSingle) { rootSingle = make("root", req); snap(5, `Validation is off, so the root quietly builds scoped renderer #${rootSingle.n} <b>in the root scope</b>. It is now a de facto singleton shared by every request and every thread: a captive dependency.`, req, rootSingle.n); }
            else snap(5, `The root returns the same renderer #${rootSingle.n} it created for request ${rootSingle.req}. Requests now share state they were never meant to share.`, req, rootSingle.n);
            continue;
          }
          const x = make("root", req);
          snap(5, `The root builds transient renderer #${x.n}. Because PdfRenderer is <code>IDisposable</code>, the <b>root tracks it</b> so it can dispose it at shutdown: it can never be collected. One leaked renderer per call.`, req, x.n);
        }
        const mine = inst.filter((x) => x.owner === "scope" && x.req === req.no && !x.disposed);
        mine.slice().reverse().forEach((x) => { x.disposed = true; });
        snap(6, `<b>Request ${req.no} ends.</b> ${mine.length ? `The scope disposes ${mine.slice().reverse().map((x) => `#${x.n}`).join(", ")} (newest first).` : "The scope owned no renderers."} ${inst.some((x) => x.owner === "root" && !x.disposed) ? `${inst.filter((x) => x.owner === "root" && !x.disposed).length} renderer(s) remain held by the root.` : ""}`, req);
      }
      const need = R.filter((x) => x !== "list").length;
      snap(-1, `<b>Total: ${n} renderer${n === 1 ? "" : "s"}, ${ms} ms of construction</b> for ${R.length} request${R.length === 1 ? "" : "s"} (${need} needed a PDF). ${si === 0 ? "Eager pays on every request." : si === 1 ? "Lazy pays once per request that renders, and never more." : si === 2 ? "Func gives control over how many instances you make; with transient it makes one per call." : "A singleton Func turns scoped into captive and transient into a leak. Register factories with the shortest lifetime of what they create, or inject IServiceScopeFactory."}`);
      return fr;
    },
    render: (f) => {
      const lane = (title, xs) => `<div class="dav-lzlane"><span class="v-caption">${title}</span><div class="dav-chips">${xs.map((x) => chip(`renderer #${x.n}<small>req ${x.req}</small>`, x.n === f.cur ? "active" : x.disposed ? "dim" : x.owner === "root" ? "bad" : "done")).join("") || chip("none", "dim")}</div></div>`;
      const reqLane = f.req ? `<div class="dav-lzreq">${chip(`request ${f.req.no}`, "path")}<span>${esc(f.req.kind === "list" ? "GET /reports (no PDF)" : f.req.kind === "pdf" ? "GET /reports/7.pdf (render once)" : "GET /reports/bundle (render twice)")}</span></div>` : "";
      return `<div class="dav-lz">${reqLane}${lane("owned by request scopes", f.inst.filter((x) => x.owner === "scope"))}${lane("owned by the ROOT provider", f.inst.filter((x) => x.owner === "root"))}</div>`;
    },
  }));

  /* =====================================================================
   * 4. Decorator chain: Decorate order → nesting → behaviour
   * ===================================================================== */
  const DEC_KNOWN = { logging: "Logging", caching: "Caching", retry: "Retry", metrics: "Metrics" };
  const DEC_SCEN = ["cache miss, database OK", "cache hit", "database fails once, then OK", "database down"];
  Viz.register("di-advanced-decorators", (host) => Viz.player(host, {
    title: "Decorator chain: the last Decorate call is the outermost layer",
    tag: "DECORATORS · STEP THROUGH",
    legend: [["active", "executing"], ["path", "call travelling inward"], ["done", "returned OK"], ["bad", "failed"], ["dim", "skipped"]],
    code: [
      "services.AddScoped<IOrderRepository, SqlOrderRepository>();",
      "services.Decorate<IOrderRepository, X>();  // wraps whatever is registered now",
      "// resolved: Outermost(…(Innermost(SqlOrderRepository)))",
      "LoggingRepo:  log start → inner → log outcome",
      "CachingRepo:  hit? return : inner, then store",
      "RetryRepo:    up to 3 attempts on transient errors",
      "MetricsRepo:  start timer → inner → record",
      "SqlOrderRepository.GetAsync(42)  // the real query",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "order", label: "Decorate order (first → last)", value: "Retry, Caching, Logging", width: 240 },
      { key: "scen", label: "scenario", type: "select", options: DEC_SCEN, value: DEC_SCEN[2] },
    ],
    random: () => ({ order: shuffle(Object.values(DEC_KNOWN)).slice(0, Viz.rand(2, 4)).join(", "), scen: pick(DEC_SCEN) }),
    build: ({ order, scen }) => {
      const L = list(order).map((x) => { const k = DEC_KNOWN[x.toLowerCase().replace(/repo(sitory)?$/, "")]; if (!k) throw new Error(`"${x}" is not a decorator here. Use Logging, Caching, Retry or Metrics.`); return k; });
      if (!L.length || L.length > 4) throw new Error("Use 1 to 4 decorators.");
      if (new Set(L).size !== L.length) throw new Error("Use each decorator once.");
      if (!DEC_SCEN.includes(scen)) throw new Error("Pick a scenario from the list.");
      const chain = L.slice().reverse();
      const fr = [], log = [];
      let db = 0, logs = 0, writes = 0, cached = scen === "cache hit", fails = scen === "database down" ? Infinity : scen.startsWith("database fails") ? 1 : 0, recorded = 0;
      const st = {};
      const snap = (line, note, cur) => fr.push({ chain, st: { ...st }, cur, log: log.slice(-8), line, note, vars: { "DB queries": db, "log lines": logs, "cache writes": writes, "metrics points": recorded } });
      snap(0, "<b>Register the real repository.</b> Nothing wraps it yet.");
      L.forEach((d, i) => snap(1, `<b>Decorate&lt;IOrderRepository, ${d}Repo&gt;()</b> replaces the registration with one that wraps <i>the current one</i>: ${d}(${L.slice(0, i).reverse().reduce((acc, x) => `${x}(${acc})`, "Sql")}). Each call nests the previous chain, so the <b>last</b> call ends up <b>outermost</b>.`, null));
      snap(2, `<b>Resolved chain:</b> ${chain.join(" → ")} → Sql. A call enters from the outside and the result comes back out in reverse. Now run <code>GetAsync(42)</code> (${esc(scen)}).`, null);
      const call = (i) => {
        if (i === chain.length) {
          db++; st.Sql = "active";
          if (fails > 0) { fails--; st.Sql = "bad"; log.push(["bad", `Sql: query ${db} failed (timeout)`]); snap(7, `<b>Database query ${db} fails</b> with a transient timeout. The exception travels back out through every layer that does not catch it.`, "Sql"); return { ok: false }; }
          st.Sql = "done"; log.push(["done", `Sql: query ${db} OK`]); snap(7, `<b>Database query ${db} succeeds.</b> Order 42 travels back out through the layers.`, "Sql"); return { ok: true };
        }
        const d = chain[i];
        st[d] = "active";
        if (d === "Logging") {
          logs++; log.push(["path", "Logging: GetAsync(42) start"]);
          snap(3, `<b>Logging</b> writes "start". ${i > 0 ? `It sits inside ${chain.slice(0, i).join(", ")}, so it only sees calls that get past ${i > 1 ? "them" : "it"}.` : "It is outermost, so it sees every call, including cache hits and the final outcome after all retries."}`, d);
          const r = call(i + 1); logs++; st[d] = r.ok ? "done" : "bad"; log.push([r.ok ? "done" : "bad", `Logging: ${r.ok ? "OK" : "ERROR"}`]);
          snap(3, `<b>Logging</b> writes "${r.ok ? "OK" : "ERROR"}".`, d); return r;
        }
        if (d === "Caching") {
          if (cached) { st[d] = "done"; log.push(["done", "Caching: hit"]); chain.slice(i + 1).forEach((x) => { st[x] = "dim"; }); st.Sql = "dim"; snap(4, `<b>Cache hit.</b> Caching returns immediately: ${chain.slice(i + 1).length ? `${chain.slice(i + 1).join(", ")} and the database never run` : "the database never runs"}. Layers <i>outside</i> the cache still run on hits; layers <i>inside</i> it do not.`, d); return { ok: true }; }
          log.push(["path", "Caching: miss"]); snap(4, "<b>Cache miss.</b> Caching calls the inner layer and will store only a <i>successful</i> result.", d);
          const r = call(i + 1);
          if (r.ok) { writes++; cached = true; st[d] = "done"; log.push(["done", "Caching: stored"]); snap(4, "<b>Caching stores order 42</b> on the way out, so the next call is a hit.", d); }
          else { st[d] = "bad"; snap(4, "<b>Caching does not store failures</b> (caching an exception would serve errors after the database recovers). The error passes through.", d); }
          return r;
        }
        if (d === "Retry") {
          for (let a = 1; a <= 3; a++) {
            log.push(["path", `Retry: attempt ${a}`]);
            snap(5, `<b>Retry, attempt ${a}/3.</b> ${i < chain.length - 1 ? `Everything inside Retry (${chain.slice(i + 1).join(", ")}) runs again on each attempt.` : "Only the database call repeats."}`, d);
            const r = call(i + 1);
            if (r.ok) { st[d] = "done"; return r; }
            if (a < 3) { st[d] = "active"; snap(5, `Attempt ${a} failed with a transient error, so Retry backs off and tries again.`, d); }
          }
          st[d] = "bad"; log.push(["bad", "Retry: gave up after 3"]); snap(5, "<b>Retry gives up after 3 attempts</b> and rethrows. Anything outside sees one failure; anything inside saw three.", d); return { ok: false };
        }
        log.push(["path", "Metrics: timer start"]); snap(6, `<b>Metrics</b> starts a timer. ${i < chain.length - 1 ? `It measures everything inside it: ${chain.slice(i + 1).join(", ")}.` : "It measures only the database call."}`, d);
        const r = call(i + 1); recorded++; st[d] = r.ok ? "done" : "bad"; log.push([r.ok ? "done" : "bad", `Metrics: recorded ${r.ok ? "ok" : "error"}`]);
        snap(6, `<b>Metrics</b> records one data point (${r.ok ? "success" : "error"}).`, d); return r;
      };
      const r = call(0);
      const tips = [];
      const pos = (x) => chain.indexOf(x);
      if (pos("Caching") >= 0 && pos("Logging") > pos("Caching")) tips.push("Logging is inside Caching, so cache hits are invisible in the logs.");
      if (pos("Retry") >= 0 && pos("Logging") > pos("Retry")) tips.push("Logging is inside Retry, so each attempt logs separately (noisy but detailed).");
      if (pos("Retry") >= 0 && pos("Caching") > pos("Retry")) tips.push("Caching is inside Retry, so each attempt re-checks the cache (harmless here).");
      if (pos("Metrics") >= 0 && pos("Retry") > pos("Metrics")) tips.push("Metrics wraps Retry, so its timing includes every attempt and back-off.");
      snap(2, `<b>Caller gets ${r.ok ? "order 42" : "an exception"}.</b> ${db} database quer${db === 1 ? "y" : "ies"}, ${logs} log line${logs === 1 ? "" : "s"}. ${tips.join(" ")} Reorder the Decorate calls and rerun: same classes, different behaviour.`, null);
      return fr;
    },
    render: (f) => {
      let inner = `<div class="dav-core ${f.st.Sql || ""} ${f.cur === "Sql" ? "cur" : ""}"><b>SqlOrderRepository</b></div>`;
      for (let i = f.chain.length - 1; i >= 0; i--) {
        const d = f.chain[i];
        inner = `<div class="dav-layer ${f.st[d] || ""} ${f.cur === d ? "cur" : ""}"><span class="dav-ln">${esc(d)}Repo${i === 0 ? " · outermost" : ""}</span>${inner}</div>`;
      }
      const log = f.log.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("");
      return `<div class="dav-two"><div class="v-labeled dav-col"><span class="v-caption">resolved object graph</span><div class="dav-nest">${inner}</div></div><div class="v-labeled dav-col"><span class="v-caption">trace (latest 8)</span><ol class="dav-log">${log || "<li>—</li>"}</ol></div></div>`;
    },
  }));

  /* =====================================================================
   * 5. Open generics: exact first, then close the open registration
   * ===================================================================== */
  const GEN_REGS = ["open, then closed", "closed, then open", "open only"];
  const GEN_REQ = ["IRepository<Order>", "IRepository<Customer>", "IRepository<string>", "IEnumerable<IRepository<Order>>", "IEnumerable<IRepository<string>>"];
  Viz.register("di-advanced-generic", (host) => Viz.player(host, {
    title: "Open generics: how IRepository<> becomes EfRepository<Order>",
    tag: "OPEN GENERICS · STEP THROUGH",
    legend: [["active", "checking"], ["done", "used"], ["bad", "rejected / throws"], ["dim", "not a candidate"]],
    code: [
      "s.AddScoped(typeof(IRepository<>), typeof(EfRepository<>)); // where T : IEntity",
      "s.AddScoped<IRepository<Order>, OrderRepository>();           // hand-written special case",
      "single: 1) last EXACT closed registration wins",
      "        2) else last open registration: close it with T",
      "        3) check constraints (T : IEntity) — violation throws",
      "IEnumerable: every match in registration order; constraint misses are skipped",
      "call site cached per closed type: the next resolve is a lookup",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "regs", label: "registrations", type: "select", options: GEN_REGS, value: GEN_REGS[0] },
      { key: "req", label: "resolve", type: "select", options: GEN_REQ, value: GEN_REQ[0] },
    ],
    random: () => ({ regs: pick(GEN_REGS), req: pick(GEN_REQ) }),
    build: ({ regs, req }) => {
      if (!GEN_REGS.includes(regs) || !GEN_REQ.includes(req)) throw new Error("Pick from the lists.");
      const open = { kind: "open", svc: "IRepository<>", impl: "EfRepository<T>", line: 0 };
      const closed = { kind: "closed", svc: "IRepository<Order>", impl: "OrderRepository", line: 1 };
      const R = regs === GEN_REGS[0] ? [open, closed] : regs === GEN_REGS[1] ? [closed, open] : [open];
      const many = req.startsWith("IEnumerable");
      const T = req.match(/IRepository<(\w+)>/)[1];
      const entity = T !== "string";
      const fr = [];
      const snap = (line, note, st = {}) => fr.push({ R, T, st: st.st || {}, closing: st.closing || null, result: st.result || null, line, note, vars: { request: req, T, "T : IEntity": entity ? "yes" : "no", ...(st.vars || {}) } });
      snap(-1, `<b>Resolve ${esc(req)}.</b> The container has ${R.length} registration${R.length > 1 ? "s" : ""}. An open generic is a <i>recipe for a family of types</i>: it is only turned into a concrete type when someone asks for one. That is also why <code>ValidateOnBuild</code> skips it: there is no T to check yet.`);
      if (!many) {
        const ex = R.filter((r) => r.kind === "closed" && r.svc === `IRepository<${T}>`).pop();
        snap(2, `<b>Step 1: exact match?</b> Look for a closed registration of exactly <code>IRepository&lt;${T}&gt;</code>. ${ex ? "Found one." : "None."} Exact registrations win over open ones <b>regardless of order</b>.`, { st: Object.fromEntries(R.map((r) => [r.line, r.kind === "closed" ? (ex ? "active" : "dim") : "dim"])) });
        if (ex) { snap(2, `<b>${esc(ex.impl)}</b> is used. The open generic is never consulted, so your special case beats the generic default${regs === GEN_REGS[1] ? " even though the open generic was registered after it (for a single resolve, last-wins does not apply between open and closed)" : ""}.`, { st: { [ex.line]: "done", 0: "dim" }, result: [[ex.impl, "done"]] }); }
        else {
          const op = R.filter((r) => r.kind === "open").pop();
          snap(3, `<b>Step 2: open registration.</b> <code>IRepository&lt;&gt;</code> matches the generic definition of <code>IRepository&lt;${T}&gt;</code>, so close <code>EfRepository&lt;T&gt;</code> with T = <code>${T}</code>.`, { st: { 0: "active", 1: "dim" }, closing: { T, ok: null } });
          if (!entity) {
            snap(4, `<b>Step 3: constraints.</b> <code>EfRepository&lt;T&gt;</code> declares <code>where T : IEntity</code>; <code>string</code> is not an entity. <b>ArgumentException:</b> <i>GenericArguments[0], 'System.String', on 'EfRepository\`1[T]' violates the constraint of type 'T'.</i>`, { st: { 0: "bad", 1: "dim" }, closing: { T, ok: false }, result: [["throws", "bad"]] });
          } else snap(4, `<b>Step 3: constraints.</b> <code>${T}</code> implements <code>IEntity</code>, so <b>EfRepository&lt;${T}&gt;</b> is built. The closed call site is cached: the next <code>IRepository&lt;${T}&gt;</code> skips steps 1 to 3.`, { st: { [op.line]: "done", 1: "dim" }, closing: { T, ok: true }, result: [[`EfRepository<${T}>`, "done"]] });
        }
      } else {
        const res = [];
        R.forEach((r) => {
          if (r.kind === "closed") {
            const hit = r.svc === `IRepository<${T}>`;
            if (hit) res.push([r.impl, "done"]);
            snap(5, `Walk registrations in order. <code>${esc(r.svc)}</code> → ${hit ? `<b>matches</b>: add ${esc(r.impl)}.` : `does not match <code>IRepository&lt;${T}&gt;</code>.`}`, { st: { [r.line]: hit ? "done" : "dim" }, result: res.slice() });
          } else {
            if (entity) { res.push([`EfRepository<${T}>`, "done"]); snap(5, `<code>IRepository&lt;&gt;</code> → close with T = ${T}; constraint OK: add <b>EfRepository&lt;${T}&gt;</b>.`, { st: { 0: "done" }, closing: { T, ok: true }, result: res.slice() }); }
            else snap(5, `<code>IRepository&lt;&gt;</code> → T = string violates <code>T : IEntity</code>. For IEnumerable the container <b>skips</b> it silently instead of throwing, so you get fewer items, not an error.`, { st: { 0: "bad" }, closing: { T, ok: false }, result: res.slice() });
          }
        });
        snap(5, `<b>Result: [${res.map((x) => esc(x[0])).join(", ") || "empty"}]</b> in registration order. ${res.length > 1 ? "Both the special case and the generic default appear: a consumer of IEnumerable gets <i>two</i> repositories for orders. That is rarely what you want for repositories, but it is exactly what you want for validators and handlers." : res.length ? "" : "An empty sequence, not an exception: easy to miss in a test."}`, { result: res.length ? res : [["empty", "bad"]] });
      }
      return fr;
    },
    render: (f) => {
      const rows = f.R.map((r) => `<div class="dav-kreg ${f.st[r.line] || ""}"><code>${esc(r.svc)}</code><span>→ ${esc(r.impl)}</span><small>${r.kind}</small></div>`).join("");
      const c = f.closing;
      const closing = c ? `<div class="dav-close ${c.ok === false ? "bad" : c.ok ? "done" : "active"}"><code>EfRepository&lt;T&gt;</code><span>T = <b>${esc(c.T)}</b></span><span>${c.ok === null ? "checking where T : IEntity…" : c.ok ? "✓ T : IEntity" : "✗ violates T : IEntity"}</span><code>${c.ok === false ? "—" : `EfRepository&lt;${esc(c.T)}&gt;`}</code></div>` : "";
      const res = f.result ? f.result.map(([t, cls]) => chip(esc(t), cls)).join("") : chip("…", "dim");
      return `<div class="dav-two"><div class="v-labeled dav-col"><span class="v-caption">registrations (in order)</span><div class="dav-kregs">${rows}</div></div><div class="v-labeled dav-col"><span class="v-caption">closing the open type</span>${closing || '<div class="dav-empty">not needed yet</div>'}<span class="v-caption">result</span><div class="dav-chips">${res}</div></div></div>`;
    },
  }));

  /* =====================================================================
   * 6. Per-tenant child scopes: root → tenant → request, disposal in reverse
   * ===================================================================== */
  const SC_GRAPH = [
    ["Clock", "root", false], ["HttpPool", "root", true], ["TenantSettings", "tenant", false],
    ["TenantDb", "tenant", true], ["UnitOfWork", "request", true], ["OrderHandler", "request", false],
  ];
  function parseScopeScript(s) {
    const ops = list(String(s).replace(/,/g, ";")).map((raw) => {
      const m = raw.match(/^(req|evict)\s+([a-z][a-z0-9-]{0,9})$/i) || raw.match(/^(shutdown)$/i);
      if (!m) throw new Error(`Cannot read "${raw}". Use "req <tenant>", "evict <tenant>" or "shutdown", separated by ";".`);
      return { op: m[1].toLowerCase(), t: (m[2] || "").toLowerCase() };
    });
    if (!ops.length || ops.length > 9) throw new Error("Use 1 to 9 steps.");
    const sd = ops.findIndex((o) => o.op === "shutdown");
    if (sd >= 0 && sd !== ops.length - 1) throw new Error("Nothing can run after shutdown: make it the last step.");
    if (new Set(ops.filter((o) => o.t).map((o) => o.t)).size > 3) throw new Error("Use at most 3 tenants so the tree stays readable.");
    return ops;
  }
  Viz.register("di-advanced-scopes", (host) => Viz.player(host, {
    title: "Per-tenant scopes: three levels of sharing, disposed inside-out",
    tag: "SCOPE TREE · STEP THROUGH",
    legend: [["active", "created now"], ["done", "alive"], ["path", "reused"], ["dim", "disposed / released"]],
    code: [
      "root: Clock, HttpPool                       // singletons for the whole app",
      "tenant = root.BeginLifetimeScope(t, b => b.RegisterInstance(settingsFor(t)))",
      "  TenantSettings, TenantDb                  // one per tenant",
      "request = tenant.BeginLifetimeScope()",
      "  UnitOfWork (per request), OrderHandler (transient)",
      "end of request: request.Dispose()           // newest first",
      "evict / shutdown: tenant.Dispose(), then root.Dispose()",
    ],
    codeLang: "csharp",
    inputs: [{ key: "script", label: "steps", value: "req contoso; req fabrikam; req contoso; evict contoso; req contoso; shutdown", width: 470 }],
    random: () => {
      const ts = ["contoso", "fabrikam", "tailspin"];
      const ops = Array.from({ length: Viz.rand(3, 6) }, () => (Viz.rand(0, 4) ? `req ${pick(ts)}` : `evict ${pick(ts)}`));
      if (Viz.rand(0, 1)) ops.push("shutdown");
      return { script: ops.join("; ") };
    },
    build: ({ script }) => {
      const ops = parseScopeScript(script);
      const fr = [], disp = [];
      const root = { inst: [] }, tenants = [];
      let n = 0, reqNo = 0, cur = null, served = {};
      const snap = (line, note, hi = {}) => fr.push({
        root: root.inst.map((x) => ({ ...x })),
        tenants: tenants.map((t) => ({ name: t.name, gen: t.gen, alive: t.alive, inst: t.inst.map((x) => ({ ...x })), served: t.served })),
        req: cur ? { no: cur.no, t: cur.t, gen: cur.gen, inst: cur.inst.map((x) => ({ ...x })) } : null,
        disp: disp.slice(-9), hi, line, note,
        vars: { "live objects": [...root.inst, ...tenants.flatMap((t) => t.inst), ...(cur ? cur.inst : [])].filter((x) => !x.disposed).length, disposed: disp.length, "tenant scopes": tenants.filter((t) => t.alive).length },
      });
      const disposeList = (xs, where) => xs.slice().reverse().forEach((x) => { if (!x.disposed) { x.disposed = true; if (x.disp) disp.push(`${x.name} #${x.n} (${where})`); } });
      snap(-1, "<b>One root container for the app.</b> Some objects are shared by everyone (root), some by one tenant (tenant scope), some by one request. Run the steps to watch where each object lives and in what order things are disposed.");
      for (const o of ops) {
        if (o.op === "req") {
          let t = tenants.find((x) => x.name === o.t && x.alive);
          if (!t) {
            const gen = tenants.filter((x) => x.name === o.t).length + 1;
            t = { name: o.t, gen, alive: true, inst: [], served: 0 };
            tenants.push(t);
            snap(1, `<b>First request for "${esc(o.t)}"${gen > 1 ? " since it was evicted" : ""}.</b> Open a <b>tenant scope</b> (generation ${gen}) and register this tenant's settings into it. Everything resolved here is shared by "${esc(o.t)}" only: other tenants can never receive it.`, { tenant: `${o.t}#${gen}` });
          }
          cur = { no: ++reqNo, t: o.t, gen: t.gen, inst: [] };
          snap(3, `<b>Request ${reqNo} (${esc(o.t)})</b> opens a request scope <i>under the tenant scope</i>, so it can see tenant and root objects, never another tenant's.`, { tenant: `${o.t}#${t.gen}` });
          for (const [name, level, d] of SC_GRAPH) {
            const home = level === "root" ? root : level === "tenant" ? t : cur;
            const have = home.inst.find((x) => x.name === name && !x.disposed);
            if (have) { snap(level === "root" ? 0 : 2, `<b>${name}</b> already exists in the ${level} scope (#${have.n}): reused.`, { obj: have.n, tenant: `${o.t}#${t.gen}` }); continue; }
            const x = { name, n: ++n, disp: d, disposed: false };
            home.inst.push(x);
            snap(level === "root" ? 0 : level === "tenant" ? 2 : 4, `Create <b>${name} #${x.n}</b> in the <b>${level}</b> scope${level === "request" && name === "OrderHandler" ? " (transient, not disposable: nothing to track)" : ""}. ${level === "tenant" && name === "TenantDb" ? `Its connection string comes from "${esc(o.t)}" settings, which is why it must not be a root singleton.` : level === "request" && name === "UnitOfWork" ? "It depends on TenantDb, a longer-lived object: that is allowed (short may depend on long)." : ""}`, { obj: x.n, tenant: `${o.t}#${t.gen}` });
          }
          t.served++;
          const before = disp.length;
          disposeList(cur.inst, `request ${cur.no}`);
          snap(5, `<b>Request ${cur.no} ends.</b> The request scope disposes ${disp.length > before ? disp.slice(before).join(", ") : "nothing"}. Tenant and root objects stay alive for the next request.`, { tenant: `${o.t}#${t.gen}` });
          cur = null;
        } else if (o.op === "evict") {
          const t = tenants.find((x) => x.name === o.t && x.alive);
          if (!t) { snap(6, `<b>Evict "${esc(o.t)}":</b> it has no live scope, so there is nothing to dispose.`); continue; }
          const before = disp.length;
          disposeList(t.inst, `tenant ${t.name}`); t.alive = false;
          snap(6, `<b>Evict "${esc(o.t)}"</b> (its settings changed, or it went idle). Disposing the tenant scope disposes ${disp.length > before ? disp.slice(before).join(", ") : "nothing disposable"}, newest first. The next request for "${esc(o.t)}" builds a fresh scope with fresh settings. Other tenants are untouched.`, { tenant: `${t.name}#${t.gen}` });
        } else {
          const live = tenants.filter((t) => t.alive);
          live.slice().reverse().forEach((t) => {
            const before = disp.length;
            disposeList(t.inst, `tenant ${t.name}`); t.alive = false;
            snap(6, `<b>Shutdown:</b> dispose tenant scope "${esc(t.name)}" first (${disp.length > before ? disp.slice(before).join(", ") : "nothing disposable"}). Children before parents, because tenant objects may still use root objects while they close.`, { tenant: `${t.name}#${t.gen}` });
          });
          const before = disp.length;
          disposeList(root.inst, "root");
          snap(6, `<b>Finally the root</b> disposes ${disp.length > before ? disp.slice(before).join(", ") : "nothing disposable"}. Order overall: requests → tenants (newest first) → root.`);
        }
      }
      snap(-1, `<b>${n} objects for ${reqNo} request${reqNo === 1 ? "" : "s"}.</b> Root objects were built once, tenant objects once per tenant generation, request objects every time. Disposal log on the right is the exact order a correct container must follow.`);
      return fr;
    },
    render: (f) => {
      const ch = (x) => chip(`${esc(x.name)} #${x.n}`, x.disposed ? "dim" : f.hi.obj === x.n ? "active" : "done");
      const reqBox = (t) => f.req && f.req.t === t.name && f.req.gen === t.gen ? `<div class="dav-scope req"><span class="dav-sn">request ${f.req.no}</span><div class="dav-chips">${f.req.inst.map(ch).join("") || chip("empty", "dim")}</div></div>` : "";
      const tenants = f.tenants.map((t) => `<div class="dav-scope tenant ${t.alive ? "" : "gone"} ${f.hi.tenant === `${t.name}#${t.gen}` ? "cur" : ""}"><span class="dav-sn">tenant ${esc(t.name)} · gen ${t.gen}${t.alive ? "" : " · disposed"}</span><div class="dav-chips">${t.inst.map(ch).join("") || chip("empty", "dim")}</div>${reqBox(t)}<small class="dav-mute">${t.served} request${t.served === 1 ? "" : "s"} served</small></div>`).join("");
      const disp = f.disp.map((d) => `<li>${esc(d)}</li>`).join("");
      return `<div class="dav-two wide-left"><div class="v-labeled dav-col"><span class="v-caption">scope tree</span><div class="dav-scope root"><span class="dav-sn">root container</span><div class="dav-chips">${f.root.map(ch).join("") || chip("empty", "dim")}</div><div class="dav-tenants">${tenants}</div></div></div><div class="v-labeled dav-col"><span class="v-caption">disposal order</span><ol class="dav-log">${disp || "<li>—</li>"}</ol></div></div>`;
    },
  }));

  /* =====================================================================
   * 7. NestJS-style module visibility: providers, exports, imports, @Global
   * ===================================================================== */
  const MOD_SCEN = ["everything wired", "PaymentsModule forgets to export PaymentGateway", "OrdersModule forgets to import PaymentsModule", "ConfigModule is not @Global", "OrderService injects private StripeClient"];
  function modulesFor(scen) {
    const M = {
      ConfigModule: { providers: { ConfigService: [] }, exports: ["ConfigService"], imports: [], global: true },
      DatabaseModule: { providers: { DatabaseService: ["ConfigService"] }, exports: ["DatabaseService"], imports: [] },
      PaymentsModule: { providers: { StripeClient: ["ConfigService"], PaymentGateway: ["StripeClient"] }, exports: ["PaymentGateway"], imports: [] },
      OrdersModule: { providers: { OrderRepository: ["DatabaseService"], OrderService: ["OrderRepository", "PaymentGateway", "ConfigService"] }, exports: ["OrderService"], imports: ["DatabaseModule", "PaymentsModule"] },
      AppModule: { providers: {}, exports: [], imports: ["ConfigModule", "OrdersModule"] },
    };
    if (scen === MOD_SCEN[1]) M.PaymentsModule.exports = [];
    if (scen === MOD_SCEN[2]) M.OrdersModule.imports = ["DatabaseModule"];
    if (scen === MOD_SCEN[3]) M.ConfigModule.global = false;
    if (scen === MOD_SCEN[4]) M.OrdersModule.providers.OrderService = ["OrderRepository", "StripeClient", "ConfigService"];
    return M;
  }
  const MOD_ORDER = ["ConfigModule", "DatabaseModule", "PaymentsModule", "OrdersModule", "AppModule"];
  Viz.register("di-advanced-modules", (host) => Viz.player(host, {
    title: "Module visibility: where may a provider look for its dependencies?",
    tag: "MODULES · STEP THROUGH",
    legend: [["active", "being instantiated"], ["visit", "searched"], ["done", "found / built"], ["bad", "not visible"]],
    code: [
      "for each module (deepest imports first):",
      "  for each provider P in module M: resolve P's constructor params",
      "    1) M's own providers",
      "    2) providers EXPORTED by modules M imports",
      "    3) providers exported by @Global() modules",
      "    else: Nest can't resolve dependencies of P … in the M context",
    ],
    codeLang: "typescript",
    inputs: [{ key: "scen", label: "scenario", type: "select", options: MOD_SCEN, value: MOD_SCEN[1] }],
    random: () => ({ scen: pick(MOD_SCEN) }),
    build: ({ scen }) => {
      if (!MOD_SCEN.includes(scen)) throw new Error("Pick a scenario from the list.");
      const M = modulesFor(scen);
      const fr = [], built = new Set();
      let err = null;
      const snap = (line, note, st = {}) => fr.push({ M, built: [...built], st: st.st || {}, mod: st.mod || null, err, line, note, vars: { module: st.mod || "—", provider: st.p || "—", built: built.size } });
      snap(-1, `<b>${esc(scen)}.</b> Each module is a box with private providers. Only <b>exported</b> providers cross the box boundary, and only into modules that <b>import</b> it (or everywhere, for a <code>@Global()</code> module). Nest instantiates modules starting from the deepest imports.`);
      outer: for (const mod of MOD_ORDER) {
        const ps = Object.keys(M[mod].providers);
        if (!ps.length) { snap(0, `<b>${mod}</b> has no providers of its own; it only composes imports. Done.`, { mod }); continue; }
        for (const p of ps) {
          const deps = M[mod].providers[p];
          snap(1, `<b>${p}</b> in ${mod} needs (${deps.join(", ") || "nothing"}).`, { mod, p, st: { [`${mod}/${p}`]: "active" } });
          for (let di = 0; di < deps.length; di++) {
            const d = deps[di];
            if (M[mod].providers[d]) { snap(2, `<code>${d}</code>: declared in ${mod} itself, so it is visible.`, { mod, p, st: { [`${mod}/${p}`]: "active", [`${mod}/${d}`]: "done" } }); continue; }
            const viaImp = M[mod].imports.find((im) => M[im].exports.includes(d));
            if (viaImp) { snap(3, `<code>${d}</code>: ${mod} imports <b>${viaImp}</b>, which exports it.`, { mod, p, st: { [`${mod}/${p}`]: "active", [`${viaImp}/${d}`]: "done" } }); continue; }
            const viaGlobal = MOD_ORDER.find((g) => M[g].global && M[g].exports.includes(d));
            if (viaGlobal) { snap(4, `<code>${d}</code>: not imported, but <b>${viaGlobal}</b> is <code>@Global()</code> and exports it, so every module can see it.`, { mod, p, st: { [`${mod}/${p}`]: "active", [`${viaGlobal}/${d}`]: "done" } }); continue; }
            const owner = MOD_ORDER.find((g) => M[g].providers[d]);
            const searched = Object.fromEntries([[`${mod}/${p}`, "bad"], ...M[mod].imports.map((im) => [`mod:${im}`, "visit"]), ...(owner ? [[`${owner}/${d}`, "bad"]] : [])]);
            const sig = deps.map((x, k) => (k === di ? "?" : x)).join(", ");
            err = `Nest can't resolve dependencies of the ${p} (${sig}). Please make sure that the argument ${d} at index [${di}] is available in the ${mod} context.`;
            const why = !owner ? "no module provides it" : !M[owner].exports.includes(d) ? `${owner} declares it but does <b>not export</b> it: it is private to ${owner}` : `${mod} does <b>not import</b> ${owner}`;
            snap(5, `<code>${d}</code>: not in ${mod}, not exported by its imports (${M[mod].imports.join(", ") || "none"}), not global. Here, ${why}. Startup fails.`, { mod, p, st: searched });
            break outer;
          }
          built.add(`${mod}/${p}`);
          snap(1, `<b>${p}</b> built (a singleton within ${mod}).`, { mod, p, st: { [`${mod}/${p}`]: "done" } });
        }
      }
      if (!err) snap(-1, "<b>Application started.</b> Every provider found its dependencies through its own module, an import's exports, or a global module. Fewer exports and fewer @Global modules mean fewer accidental couplings: a module's exports are its public API.");
      return fr;
    },
    render: (f) => {
      const card = (mod) => {
        const m = f.M[mod];
        const ps = Object.keys(m.providers).map((p) => {
          const k = `${mod}/${p}`;
          const cls = f.st[k] || (f.built.includes(k) ? "done" : "");
          return `<div class="dav-prov ${cls}"><code>${p}</code>${m.exports.includes(p) ? '<span class="dav-exp">exported</span>' : '<span class="dav-priv">private</span>'}</div>`;
        }).join("") || '<div class="dav-empty">no providers</div>';
        return `<div class="dav-mod ${f.mod === mod ? "cur" : ""} ${f.st[`mod:${mod}`] || ""}"><div class="dav-mh"><b>${mod}</b>${m.global ? '<span class="dav-glob">@Global</span>' : ""}</div>${ps}<small>imports: ${m.imports.join(", ") || "—"}</small></div>`;
      };
      return `<div class="dav-mods">${MOD_ORDER.map(card).join("")}</div>${f.err ? `<pre class="dav-err">${esc(f.err)}</pre>` : ""}`;
    },
  }));

  /* =====================================================================
   * 8. Async initialization: blocking constructors vs Lazy<Task> vs warm-up
   * ===================================================================== */
  const AI_STRATS = ["blocking .GetAwaiter().GetResult() in constructor", "await Lazy<Task<T>>", "Lazy<Task<T>>, first attempt fails", "AsyncLazy that retries, first attempt fails", "warm up in hosted service + readiness gate"];
  Viz.register("di-advanced-asyncinit", (host) => Viz.player(host, {
    title: "Async initialization on a thread pool: blocking vs awaiting vs warming up",
    tag: "THREAD POOL · 100 MS PER STEP",
    legend: [["done", "doing request work"], ["bad", "thread blocked"], ["active", "init continuation"], ["path", "started init / awaiting"], ["dim", "idle"]],
    code: [
      "public TokenCache(IdpClient c) { _keys = c.FetchKeysAsync().GetAwaiter().GetResult(); } // blocks",
      "_keys = new Lazy<Task<Keys>>(() => c.FetchKeysAsync());  ...  var k = await _keys.Value;",
      "// Lazy<Task> caches the FAULTED task too: every later await rethrows",
      "AsyncLazy: on failure, drop the task so the next caller starts a new attempt",
      "IHostedService.StartAsync: await cache.WarmAsync(); health.Ready = true;",
      "thread pool: all threads busy + queue non-empty → inject ~1 thread / 500 ms",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "strat", label: "strategy", type: "select", options: AI_STRATS, value: AI_STRATS[0] },
      { key: "threads", label: "pool threads (2–8)", value: "4", width: 60 },
      { key: "reqs", label: "requests (2–12)", value: "8", width: 60 },
      { key: "init", label: "init I/O ms (200–3000)", value: "1000", width: 80 },
      { key: "gap", label: "arrival gap ms", value: "200", width: 70 },
    ],
    random: () => ({ strat: pick(AI_STRATS), threads: String(Viz.rand(2, 6)), reqs: String(Viz.rand(4, 10)), init: String(Viz.rand(4, 15) * 100), gap: String(pick([100, 200, 200, 300])) }),
    build: ({ strat, threads, reqs, init, gap: gapIn }) => {
      const si = AI_STRATS.indexOf(strat); if (si < 0) throw new Error("Pick a strategy from the list.");
      const T0 = Viz.parse.int(threads, { min: 2, max: 8 }), N = Viz.parse.int(reqs, { min: 2, max: 12 });
      const initMs = Viz.parse.int(init, { min: 200, max: 3000 }), gap = Viz.parse.int(gapIn || "200", { min: 100, max: 1000 });
      if (initMs % 100 || gap % 100) throw new Error("Use multiples of 100 ms for the init time and the gap.");
      const IT = initMs / 100, failFirst = si === 2 || si === 3;
      const th = Array.from({ length: T0 }, () => ({ item: null, hist: [] }));
      const G = gap / 100, R = Array.from({ length: N }, (_, i) => ({ i, arr: (si === 4 ? IT + 2 : 0) + i * G, st: "future", end: null }));
      const q = [], waiters = [], fr = [];
      let svc = si === 4 ? "initializing" : "none", ioDone = si === 4 ? IT : null, attempts = si === 4 ? 1 : 0, lastInject = -99, t = 0, contQueued = false, injected = 0;
      const doneAll = () => R.every((r) => ["done", "failed", "skipped"].includes(r.st));
      const lineFor = [0, 1, 2, 3, 4][si];
      const snapT = (note, line = lineFor) => fr.push({ t, hist: th.map((x) => x.hist.slice()), R: R.map((r) => ({ ...r })), svc, line, note, vars: { "time": `${t * 100} ms`, threads: th.length, queued: q.length, service: svc, attempts } });
      snapT(`<b>${esc(strat)}.</b> ${N} requests arrive ${gap} ms apart${si === 4 ? " (the load balancer only starts routing once readiness is true)" : ""}; each needs the TokenCache, whose initialization waits ${initMs} ms on I/O. The pool starts with ${T0} threads. ${si === 4 ? "The hosted service starts the warm-up at time 0, before traffic is routed." : "Nothing is initialized until the first request asks."}`, si === 4 ? 4 : lineFor);
      while (!doneAll() && t < 90) {
        const notes = [];
        R.forEach((r) => { if (r.arr === t) { r.st = "queued"; q.push({ k: "req", r }); } });
        if (svc === "initializing" && ioDone !== null && t >= ioDone && !contQueued) { q.push({ k: "cont" }); contQueued = true; notes.push("Init I/O completed: its continuation is <b>queued</b> and needs a free thread to run."); }
        const idle = th.filter((x) => !x.item).length;
        if (q.length && !idle && t - lastInject >= 5 && th.length < 32) { th.push({ item: null, hist: Array(t).fill("i") }); lastInject = t; injected++; notes.push(`Pool starved: all threads busy with work queued, so the pool <b>injects thread ${th.length}</b> (about one per 500 ms).`); }
        const readyAtStart = svc === "ready";
        th.forEach((x) => {
          if (x.item && x.item.k === "blocked") { if (readyAtStart) { x.item = { k: "work", r: x.item.r }; } else { x.hist.push("b"); return; } }
          if (x.item && x.item.k === "work") { x.hist.push("w"); x.item.r.st = "done"; x.item.r.end = t; x.item = null; return; }
          if (!x.item && q.length) {
            const it = q.shift();
            if (it.k === "cont") {
              x.hist.push("c"); contQueued = false; ioDone = null;
              const fail = failFirst && attempts === 1;
              if (fail) {
                svc = si === 2 ? "faulted" : "none";
                notes.push(`Init continuation runs: <b>the fetch failed</b>. ${si === 2 ? "Lazy&lt;Task&gt; keeps the faulted task, so the service is now <b>permanently broken</b> until the process restarts." : "AsyncLazy discards the failed task, so the <b>next</b> caller starts a fresh attempt."}`);
                waiters.splice(0).forEach((r) => q.push({ k: "resume", r, fail: true }));
              } else {
                svc = "ready"; notes.push("Init continuation runs: <b>the service is ready</b>. Waiters can continue.");
                if (si === 0) {} else waiters.splice(0).forEach((r) => q.push({ k: "resume", r }));
              }
              return;
            }
            if (it.k === "resume") { x.hist.push(it.fail ? "f" : "w"); it.r.st = it.fail ? "failed" : "done"; it.r.end = t; return; }
            const r = it.r; r.st = "running";
            if (svc === "ready") { x.hist.push("w"); r.st = "done"; r.end = t; return; }
            if (svc === "faulted") { x.hist.push("f"); r.st = "failed"; r.end = t; notes.push(`r${r.i + 1} awaits the cached faulted task and <b>fails instantly</b> with the old exception.`); return; }
            if (svc === "none") { svc = "initializing"; attempts++; ioDone = t + IT; notes.push(`r${r.i + 1} is first: it <b>starts init attempt ${attempts}</b>.`); }
            if (si === 0) { x.item = { k: "blocked", r }; r.st = "blocked"; x.hist.push("b"); }
            else { x.hist.push("s"); r.st = "awaiting"; waiters.push(r); }
            return;
          }
          x.hist.push("i");
        });
        const blocked = th.filter((x) => x.item && x.item.k === "blocked").length;
        if (si === 0 && blocked === th.length && q.length) notes.push(`<b>Every thread is blocked</b> waiting for an init whose continuation ${contQueued ? "is stuck in the queue behind new requests" : "has not been scheduled yet"}. This is sync-over-async starvation.`);
        snapT(notes.join(" ") || (svc === "ready" ? "Serving normally." : si === 0 ? `${blocked} thread${blocked === 1 ? "" : "s"} blocked, doing nothing useful.` : `Waiting for I/O: ${waiters.length} request${waiters.length === 1 ? "" : "s"} awaiting, threads free.`), notes.some((s) => s.includes("inject")) ? 5 : lineFor);
        t++;
      }
      const ok = R.filter((r) => r.st === "done"), bad = R.filter((r) => r.st === "failed"), skip = R.filter((r) => r.st === "skipped");
      const lat = ok.map((r) => (r.end - r.arr + 1) * 100).sort((a, b) => a - b);
      snapT(`<b>Finished at ${t * 100} ms.</b> ${ok.length} OK${lat.length ? ` (worst latency ${lat[lat.length - 1]} ms, best ${lat[0]} ms)` : ""}, ${bad.length} failed${skip.length ? `, ${skip.length} routed elsewhere while warming up` : ""}; ${injected} extra thread${injected === 1 ? "" : "s"} injected. ${si === 0 ? "Blocking turned a " + initMs + " ms wait into pool starvation." : si === 2 ? "One transient failure poisoned the service for the life of the process." : si === 3 ? "The failure hurt only the requests waiting on that attempt." : si === 4 ? "No user request ever waited for initialization." : "Threads were free while I/O was in flight."}`);
      return fr;
    },
    render: (f, { frames }) => {
      const T = frames[frames.length - 1].t + 1;
      const cls = { w: "done", b: "bad", c: "active", s: "path", i: "dim", f: "fail" };
      const rows = f.hist.map((h, k) => `<div class="dav-gl">T${k + 1}</div><div class="dav-gr" style="grid-template-columns:repeat(${T},minmax(0,1fr))">${Array.from({ length: T }, (_, c) => `<span class="${c < h.length ? cls[h[c]] : "empty"} ${c === f.t ? "now" : ""}"></span>`).join("")}</div>`).join("");
      const reqs = f.R.map((r) => chip(`r${r.i + 1}<small>${r.st === "done" ? `${(r.end - r.arr + 1) * 100} ms` : r.st === "future" ? "not yet" : r.st === "skipped" ? "elsewhere" : r.st}</small>`, { done: "done", failed: "bad", blocked: "bad", awaiting: "path", queued: "visit", running: "active", future: "dim", skipped: "dim" }[r.st])).join("");
      return `<div class="dav-gantt"><div class="dav-gl"></div><div class="dav-gaxis"><span>0 ms</span><span>${(T - 1) * 100} ms</span></div>${rows}</div><div class="v-labeled dav-full"><span class="v-caption">requests · TokenCache: ${esc(f.svc)}</span><div class="dav-chips">${reqs}</div></div>`;
    },
  }));

  /* =====================================================================
   * 9. What validation cannot see: opaque edges
   * ===================================================================== */
  const BS_SCEN = {
    "factory lambda hides a missing dependency": {
      regs: [["OrderService", "scoped"], ["PaymentClient", "singleton"]],
      edges: [["OrderService", "PaymentClient", "ctor"], ["PaymentClient", "IApiKeyProvider", "factory"]],
      code: "s.AddSingleton(sp => new PaymentClient(sp.GetRequiredService<IApiKeyProvider>()));",
      fix: "s.AddSingleton<PaymentClient>();   // ctor(IApiKeyProvider keys): now visible",
      runtime: "No service for type 'IApiKeyProvider' has been registered.", when: "first request that resolves OrderService",
    },
    "service locator inside a method": {
      regs: [["OrderService", "scoped"]],
      edges: [["OrderService", "IServiceProvider", "ctor"], ["OrderService", "IFraudCheck", "locator"]],
      code: "public Task PlaceAsync(Order o) { var fraud = _sp.GetRequiredService<IFraudCheck>(); … }",
      fix: "public OrderService(IFraudCheck fraud)   // ask for what you use",
      runtime: "No service for type 'IFraudCheck' has been registered.", when: "first order that reaches PlaceAsync (resolving OrderService itself succeeds)",
    },
    "singleton Func<T> captures the root": {
      regs: [["PriceCache", "singleton"], ["AppDbContext", "scoped"], ["Func<AppDbContext>", "singleton"]],
      edges: [["PriceCache", "Func<AppDbContext>", "ctor"], ["Func<AppDbContext>", "AppDbContext", "factory"]],
      code: "s.AddSingleton<Func<AppDbContext>>(sp => () => sp.GetRequiredService<AppDbContext>());",
      fix: "PriceCache(IServiceScopeFactory f)   // open a scope per refresh",
      runtime: "Cannot resolve scoped service 'AppDbContext' from root provider.", when: "first time the cache calls the Func (with ValidateScopes); silently captive without it",
    },
    "open generic with a missing dependency": {
      regs: [["IRepository<>", "scoped"], ["AppDbContext", "scoped"]],
      edges: [["IRepository<>", "AppDbContext", "generic"], ["IRepository<>", "IAuditLog", "generic"]],
      code: "s.AddScoped(typeof(IRepository<>), typeof(EfRepository<>)); // ctor(AppDbContext, IAuditLog)",
      fix: "test: resolve IRepository<T> for every entity T in a scope",
      runtime: "Unable to resolve service for type 'IAuditLog' while attempting to activate 'EfRepository`1[Order]'.", when: "first resolve of each closed IRepository<T>",
    },
  };
  const BS_HOW = { ctor: "constructor", factory: "factory lambda", locator: "GetRequiredService in a method", generic: "open generic (no T yet)" };
  Viz.register("di-advanced-blindspots", (host) => Viz.player(host, {
    title: "ValidateOnBuild checks the edges it can see. Which edges are opaque?",
    tag: "VALIDATION BLIND SPOTS · STEP THROUGH",
    legend: [["done", "visible and OK"], ["bad", "error"], ["path", "opaque to the validator"], ["active", "checking"]],
    code: [
      "BuildServiceProvider(new() { ValidateOnBuild = true, ValidateScopes = true })",
      "for each closed registration: build its call site from constructor parameters",
      "  missing type?  → startup error",
      "  singleton → scoped?  → startup error (captive)",
      "  factory lambda / GetService inside a method / open generic → cannot look inside",
      "at runtime the opaque edges are finally executed",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "scen", label: "scenario", type: "select", options: Object.keys(BS_SCEN), value: Object.keys(BS_SCEN)[0] },
      { key: "fix", label: "version", type: "select", options: ["as written", "made visible"], value: "as written" },
    ],
    random: () => ({ scen: pick(Object.keys(BS_SCEN)), fix: pick(["as written", "made visible"]) }),
    build: ({ scen, fix }) => {
      const S = BS_SCEN[scen]; if (!S) throw new Error("Pick a scenario from the list.");
      const vis = fix === "made visible";
      const reg = new Map(S.regs);
      reg.set("IServiceProvider", "built-in");
      const edges = S.edges.map(([a, b, how]) => ({ a, b, how: vis && how !== "ctor" ? (how === "generic" ? "test" : "ctor") : how }));
      if (vis && scen.startsWith("singleton Func")) { edges.length = 0; edges.push({ a: "PriceCache", b: "IServiceScopeFactory", how: "ctor" }); reg.set("IServiceScopeFactory", "built-in"); reg.delete("Func<AppDbContext>"); }
      if (vis && scen.startsWith("service locator")) edges.splice(0, 1);
      const fr = [], st = {}, report = [];
      let phase = "validate", started = false;
      const snap = (line, note, cur = null) => fr.push({ edges: edges.map((e) => ({ ...e })), st: { ...st }, cur, report: report.slice(), phase, line, note, code: vis ? S.fix : S.code, vars: { phase, errors: report.filter((r) => r[0] === "bad").length, opaque: edges.filter((e) => !["ctor", "test"].includes(e.how)).length } });
      snap(0, `<b>${esc(scen)}</b> (${vis ? "made visible" : "as written"}). The validator only knows what a registration <i>declares</i>: constructor parameters of a concrete type. Code inside a lambda or a method body is a black box until it runs.`);
      edges.forEach((e, k) => {
        snap(1, `Check <code>${esc(e.a)}</code> → <code>${esc(e.b)}</code> (${BS_HOW[e.how] || "resolved in a test"}).`, k);
        if (e.how === "test") { if (reg.has(e.b)) { st[k] = "done"; snap(1, `<b>Smoke test:</b> resolving <code>IRepository&lt;Order&gt;</code> in a scope closes the generic, and <code>${esc(e.b)}</code> is registered. OK.`, k); return; } st[k] = "bad"; report.push(["bad", `test fails: ${S.runtime}`]); snap(2, `<b>Your smoke test</b> resolves <code>IRepository&lt;Order&gt;</code> and friends in CI, so the open generic is closed and actually built: <i>${esc(S.runtime)}</i>`, k); return; }
        if (e.how !== "ctor") { st[k] = "path"; report.push(["path", `cannot see ${e.a} → ${e.b}`]); snap(4, `<b>Opaque:</b> ${e.how === "factory" ? "a factory lambda is just a <code>Func&lt;IServiceProvider, T&gt;</code>; the validator cannot read what it will ask for." : e.how === "locator" ? "the call happens inside a method body, long after construction. Nothing declares the dependency." : "an open generic has no T, so there is no concrete constructor to check. ValidateOnBuild skips it."} Marked as <b>unchecked</b>.`, k); return; }
        if (!reg.has(e.b)) { st[k] = "bad"; report.push(["bad", `Unable to resolve service for type '${e.b}' while attempting to activate '${e.a}'.`]); snap(2, `<b>Missing:</b> <code>${esc(e.b)}</code> is not registered. Because it is a constructor parameter, the validator sees it and the app <b>refuses to start</b>. That is the good outcome: a failed deploy, not a failed customer.`, k); return; }
        if (reg.get(e.a) === "singleton" && reg.get(e.b) === "scoped") { st[k] = "bad"; report.push(["bad", `Cannot consume scoped service '${e.b}' from singleton '${e.a}'.`]); snap(3, "<b>Captive dependency</b> detected at startup.", k); return; }
        st[k] = "done"; snap(1, `<code>${esc(e.b)}</code> is registered${reg.get(e.b) === "built-in" ? " (built into the container)" : ` as ${reg.get(e.b)}`}. OK.`, k);
      });
      const errs = report.filter((r) => r[0] === "bad");
      phase = errs.length ? "startup failed" : "running";
      started = !errs.length;
      snap(started ? 5 : 2, started ? `<b>Validation passed</b> with ${report.filter((r) => r[0] === "path").length} unchecked edge${report.filter((r) => r[0] === "path").length === 1 ? "" : "s"}. The app starts and the health check is green.` : `<b>${vis && edges.some((e) => e.how === "test") ? "CI fails" : "Startup fails"}</b> with ${errs.length} error${errs.length === 1 ? "" : "s"}. Annoying, but found before any customer request.`);
      if (started) {
        const opaque = edges.map((e, k) => [e, k]).filter(([e]) => !["ctor", "test"].includes(e.how) && (!reg.has(e.b) || (reg.get(e.a) === "singleton" && reg.get(e.b) === "scoped") || e.how === "factory" && reg.get(e.b) === "scoped"));
        if (opaque.length) {
          phase = "runtime error";
          opaque.forEach(([e, k]) => { st[k] = "bad"; });
          report.push(["bad", `runtime: ${S.runtime}`]);
          snap(5, `<b>In production, at the ${esc(S.when)}:</b> <i>${esc(S.runtime)}</i> The bug shipped because the dependency was invisible. Switch to "made visible" to move this failure to startup or CI.`, opaque[0][1]);
        } else { phase = "running"; snap(5, "<b>Runtime:</b> every dependency is declared, so there is nothing left to surprise you. The remaining risk lives only in code you did not register at all."); }
      }
      return fr;
    },
    render: (f) => {
      const rows = f.edges.map((e, k) => `<div class="dav-edge ${f.st[k] || ""} ${f.cur === k ? "cur" : ""} ${["ctor", "test"].includes(e.how) ? "" : "opaque"}"><code>${esc(e.a)}</code><span class="dav-arrow">${e.how === "ctor" ? "──▶" : e.how === "test" ? "═▶" : "┄┄▶"}</span><code>${esc(e.b)}</code><small>${esc(BS_HOW[e.how] || "checked by a test")}</small></div>`).join("");
      const rep = f.report.map(([c, t]) => `<li class="${c}">${esc(t)}</li>`).join("");
      return `<div class="dav-full"><pre class="dav-snip">${esc(f.code)}</pre></div><div class="dav-two"><div class="v-labeled dav-col"><span class="v-caption">dependency edges</span><div class="dav-edges">${rows}</div></div><div class="v-labeled dav-col"><span class="v-caption">report · ${esc(f.phase)}</span><ol class="dav-log">${rep || "<li>—</li>"}</ol></div></div>`;
    },
  }));

  /* =====================================================================
   * 10. Options: IOptions vs IOptionsSnapshot vs IOptionsMonitor over time
   * ===================================================================== */
  const OPT_OK = (v) => v >= 1 && v <= 10000;
  function parseOptScript(s) {
    const ops = list(String(s).replace(/,/g, ";")).map((raw) => {
      const m = raw.match(/^(req|long|end)$/i) || raw.match(/^(change)\s+(-?\d{1,6})$/i);
      if (!m) throw new Error(`Cannot read "${raw}". Use req, long, end or change <number>, separated by ";".`);
      return { op: m[1].toLowerCase(), v: m[2] !== undefined ? Number(m[2]) : null };
    });
    if (!ops.length || ops.length > 10) throw new Error("Use 1 to 10 steps.");
    let open = false;
    ops.forEach((o) => { if (o.op === "long") { if (open) throw new Error("Only one long request at a time: add 'end' before the next 'long'."); open = true; } if (o.op === "end") { if (!open) throw new Error("'end' needs an earlier 'long'."); open = false; } });
    return ops;
  }
  Viz.register("di-advanced-options", (host) => Viz.player(host, {
    title: "Which value does each consumer see after the config file changes?",
    tag: "OPTIONS PATTERN · STEP THROUGH",
    legend: [["done", "current value"], ["visit", "stale (by design)"], ["bad", "OptionsValidationException"], ["active", "changed now"]],
    code: [
      "s.AddOptions<PayOptions>().BindConfiguration(\"Pay\").ValidateDataAnnotations()",
      "  .ValidateOnStart();                     // [Range(1, 10000)] TimeoutMs",
      "PaymentClient(IOptions<PayOptions> o)          // singleton: built once, never reloads",
      "CheckoutHandler(IOptionsSnapshot<PayOptions> o) // scoped: fixed for the request",
      "RetryPolicy(IOptionsMonitor<PayOptions> o)      // singleton: CurrentValue follows reloads",
      "appsettings.json changes → reloadOnChange → change token fires",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "init", label: "initial TimeoutMs", value: "500", width: 70 },
      { key: "script", label: "steps (req | long | end | change N)", value: "req; long; change 900; req; end; change -5; req; change 700; req", width: 380 },
      { key: "vos", label: "ValidateOnStart", type: "select", options: ["on", "off"], value: "on" },
    ],
    random: () => {
      const ops = []; let open = false;
      for (let k = 0; k < Viz.rand(4, 8); k++) {
        const r = Viz.rand(0, 5);
        if (r <= 1) ops.push("req"); else if (r === 2 && !open) { ops.push("long"); open = true; } else if (r === 3 && open) { ops.push("end"); open = false; } else ops.push(`change ${pick([300, 900, 1500, -5, 0, 20000, 700])}`);
      }
      return { init: String(pick([500, 500, 0])), script: ops.join("; "), vos: pick(["on", "off"]) };
    },
    build: ({ init, script, vos }) => {
      const v0 = Viz.parse.int(init, { min: -100000, max: 100000 });
      const ops = parseOptScript(script);
      let file = v0, optCache = null, monCache = null, changes = 0;
      const rows = [], fr = [];
      let longSnap = null;
      const snap = (line, note, hi = null) => fr.push({ file, rows: rows.map((r) => ({ ...r })), hi, line, note, vars: { "file TimeoutMs": file, "IOptions cached": optCache === null ? "not yet" : optCache, reloads: changes } });
      const readOpt = () => { if (optCache !== null) return { v: optCache, cls: optCache === file ? "done" : "visit" }; if (!OPT_OK(file)) return { err: true }; optCache = file; return { v: file, cls: "done" }; };
      const readMon = () => { if (monCache === null) { if (!OPT_OK(file)) return { err: true }; monCache = file; } return { v: monCache, cls: "done" }; };
      const readSnap = (held) => { if (held) return held; if (!OPT_OK(file)) return { err: true, held: true }; return { v: file, cls: "done" }; };
      const cell = (r) => (r.err ? { t: "throws", cls: "bad" } : { t: String(r.v), cls: r.v === file ? "done" : "visit" });
      snap(0, `<b>Startup.</b> appsettings.json says <code>TimeoutMs = ${v0}</code>. ${vos === "on" ? "<code>ValidateOnStart</code> validates now, before the host accepts traffic." : "Without <code>ValidateOnStart</code>, nothing is validated until the first consumer reads <code>.Value</code>."}`);
      if (!OPT_OK(v0) && vos === "on") { snap(1, `<b>Host fails to start:</b> <i>OptionsValidationException: The field TimeoutMs must be between 1 and 10000.</i> This is the outcome you want: the bad config never serves a request.`); return fr; }
      if (!OPT_OK(v0)) snap(1, "<b>The app starts with invalid config.</b> Validation is lazy, so the error waits for the first reader, inside a customer request.");
      let rq = 0;
      for (const o of ops) {
        if (o.op === "change") {
          file = o.v; changes++; monCache = null;
          snap(5, `<b>appsettings.json changes to ${o.v}.</b> The file watcher fires the change token (often <b>twice</b> for one save: make <code>OnChange</code> handlers idempotent). IOptionsMonitor drops its cached value; IOptions does not care. ${OPT_OK(o.v) ? "" : "<b>The new value is invalid</b>, but nothing validates it until someone reads it."}`);
          continue;
        }
        if (o.op === "end") {
          const so = readOpt(), sm = readMon();
          rows.push({ label: `long req (end)`, o: cell(so), s: cell(longSnap), m: cell(sm) });
          snap(3, `<b>The long request reads again before finishing.</b> Its snapshot is still <b>${longSnap.err ? "the exception it got" : longSnap.v}</b>: a snapshot is computed once per scope, so one request never sees two different configs. The monitor ${sm.err ? "throws, because the current file is invalid" : `says ${sm.v}`}.`, rows.length - 1);
          longSnap = null; continue;
        }
        rq++;
        const so = readOpt(), ss = readSnap(null), sm = readMon();
        if (o.op === "long") longSnap = ss;
        rows.push({ label: o.op === "long" ? `long req ${rq} (start)` : `req ${rq}`, o: cell(so), s: cell(ss), m: cell(sm) });
        const bits = [];
        bits.push(so.err ? "<b>IOptions throws</b> (validation runs on first read and a failed read is not cached, so it will keep throwing until the file is valid)" : so.v !== file ? `IOptions still returns <b>${so.v}</b>: it was computed once, on first read, and never reloads` : `IOptions returns ${so.v}`);
        bits.push(ss.err ? "<b>the snapshot throws</b> for this request" : `the snapshot is ${ss.v} for this request`);
        bits.push(sm.err ? "<b>the monitor's CurrentValue throws</b> (an invalid reload is not silently ignored)" : `the monitor returns ${sm.v}`);
        snap(o.op === "long" ? 3 : 2, `<b>${o.op === "long" ? `A long-running request ${rq} starts` : `Request ${rq}`}.</b> ${bits.join("; ")}.`, rows.length - 1);
      }
      snap(-1, "<b>Summary.</b> IOptions = one value for the life of the process (cheap, predictable). IOptionsSnapshot = one value per request (consistent inside a request, reloads between requests). IOptionsMonitor = always current, plus change callbacks (for singletons that must react). Pick per consumer, and validate on start.");
      return fr;
    },
    render: (f) => {
      const rows = f.rows.map((r, k) => `<div class="dav-orow ${f.hi === k ? "cur" : ""}"><span>${esc(r.label)}</span>${["o", "s", "m"].map((c) => `<span>${chip(esc(r[c].t), r[c].cls)}</span>`).join("")}</div>`).join("");
      return `<div class="dav-ofile ${OPT_OK(f.file) ? "" : "bad"}"><code>appsettings.json</code><span>"Pay": { "TimeoutMs": <b>${f.file}</b> }</span>${OPT_OK(f.file) ? "" : chip("invalid", "bad")}</div>
        <div class="dav-otab"><div class="dav-orow head"><span>reader</span><span>IOptions (singleton)</span><span>IOptionsSnapshot (scoped)</span><span>IOptionsMonitor (singleton)</span></div>${rows || '<div class="dav-empty">no reads yet</div>'}</div>`;
    },
  }));
})();
