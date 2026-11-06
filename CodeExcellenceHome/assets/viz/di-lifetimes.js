/* Visualizers for the "DI Lifetimes and Scopes" topic. Every name is prefixed with the slug. */
(() => {
  const esc = Viz.esc;
  const LIVES = ["singleton", "scoped", "transient"];
  const chip = (c) => `<span class="dil-chip ${c.life || ""} ${c.st || ""}"><b>${esc(c.type)}</b><span class="dil-id">#${c.id}</span>${c.tag ? `<i>${esc(c.tag)}</i>` : ""}</span>`;
  const logList = (log, cap = "event log") => `<div class="v-labeled dil-logwrap"><span class="v-caption">${esc(cap)}</span><div class="dil-log">${log.length ? log.map((e, i) => `<div class="dil-ev ${e.c || ""} ${i === log.length - 1 ? "cur" : ""}">${e.t}</div>`).join("") : '<div class="dil-ev dil-mute">nothing yet</div>'}</div></div>`;
  const pick = (a) => a[Viz.rand(0, a.length - 1)];

  /* ---------- 1. Lifetimes across two concurrent requests ---------- */
  const SVC = {
    Clock: { type: "SystemClock", svc: "IClock", deps: [], disp: false, safe: "SystemClock is immutable" },
    Db: { type: "AppDbContext", svc: "AppDbContext", deps: [], disp: true, safe: false },
    Calc: { type: "PriceCalculator", svc: "PriceCalculator", deps: ["Clock", "Db"], disp: false, safe: "PriceCalculator has no mutable fields of its own (its dependencies are judged separately)" },
  };
  const LANES = { R: "Root (application)", A: "Request A scope", B: "Request B scope" };
  const SCHEDULES = [
    "A+ B+ A:Calc B:Calc A:Calc A:Db B- A- stop",
    "A+ A:Calc B+ B:Calc B:Db B- A:Calc A- stop",
    "A+ B+ A:Db B:Db A:Clock B:Clock A- B- stop",
    "R:Clock A+ A:Calc A- R:Calc stop",
    "A+ A:Calc A- A:Calc stop",
  ];

  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const regLines = (L) => [
    [`services.Add${cap(L.Clock)}<IClock, SystemClock>();`, "// lifetimes: the selects above"],
    [`services.Add${cap(L.Db)}<AppDbContext>();`, "// not thread-safe, IDisposable"],
    [`services.Add${cap(L.Calc)}<PriceCalculator>();`, "// needs IClock, AppDbContext"],
  ].map(([a, c]) => a.padEnd(46) + c);
  Viz.register("di-lifetimes-timeline", (host, opts = {}) => Viz.player(host, {
    title: opts.title || "Two concurrent requests: which instance does each resolution get?",
    tag: "LIFETIMES · STEP THROUGH",
    legend: [["path", "singleton (root)"], ["visit", "scoped (one per request)"], ["dil-trn", "transient (new every time)"], ["bad", "error / unsafe sharing"]],
    codeLang: "csharp",
    code: [
      ...regLines({ Clock: opts.clock || "singleton", Db: opts.db || "scoped", Calc: opts.calc || "transient" }),
      "var root = services.BuildServiceProvider(new ServiceProviderOptions",
      "  { ValidateScopes = true, ValidateOnBuild = true });",
      "await using var scope = root.CreateAsyncScope(); // per request",
      "var x = scope.ServiceProvider.GetRequiredService<T>();",
      "var y = root.GetRequiredService<T>();         // from the root",
      "// request ends: the scope disposes what it created, newest first",
      "await root.DisposeAsync();                    // shutdown: singletons",
    ],
    inputs: [
      { key: "clock", label: "IClock", type: "select", options: LIVES, value: opts.clock || "singleton" },
      { key: "db", label: "AppDbContext", type: "select", options: LIVES, value: opts.db || "scoped" },
      { key: "calc", label: "PriceCalculator", type: "select", options: LIVES, value: opts.calc || "transient" },
      { key: "plan", label: "schedule  (A+ start · A:Calc resolve · A- end · R:Clock from root · stop)", value: opts.plan || SCHEDULES[0], width: 520 },
    ],
    random: () => ({ clock: pick(LIVES), db: pick(["scoped", "scoped", "transient", "singleton"]), calc: pick(LIVES), plan: pick(SCHEDULES) }),
    build: ({ clock, db, calc, plan }) => {
      const L = { Clock: clock, Db: db, Calc: calc };
      for (const [k, v] of Object.entries(L)) if (!LIVES.includes(v)) throw new Error(`Unknown lifetime for ${k}.`);
      const toks = String(plan).trim().split(/[\s,]+/).filter(Boolean);
      if (!toks.length) throw new Error("Type a schedule, e.g. A+ B+ A:Calc B:Calc A- B- stop");
      if (toks.length > 24) throw new Error("Keep the schedule to 24 steps or fewer.");
      const keyOf = (s) => Object.keys(SVC).find((k) => k.toLowerCase() === s.toLowerCase() || SVC[k].svc.toLowerCase() === s.toLowerCase() || SVC[k].type.toLowerCase() === s.toLowerCase());
      for (const t of toks) {
        const m = /^([ABR])(?:([+-])|:(\w+))$/i.exec(t);
        if (!(/^stop$/i.test(t) || (m && (m[2] ? m[1].toUpperCase() !== "R" : keyOf(m[3]))))) throw new Error(`"${t}" is not a step. Use A+, A-, B+, B-, A:Calc, B:Db, R:Clock or stop (services: Clock, Db, Calc).`);
      }
      const insts = [], rows = [], fr = [];
      const scopes = { R: { open: true, cache: new Map(), disp: [] }, A: { open: false, ended: false, cache: new Map(), disp: [] }, B: { open: false, ended: false, cache: new Map(), disp: [] } };
      let nextId = 1;
      const vars = () => ({ IClock: L.Clock, AppDbContext: L.Db, PriceCalculator: L.Calc, instances: insts.length, live: insts.filter((i) => i.state === "live").length, disposed: insts.filter((i) => i.state === "disposed").length });
      const snap = (line, note, extra = {}) => fr.push({ line, note, rows: rows.map((r) => ({ ...r, cells: { R: [...r.cells.R], A: [...r.cells.A], B: [...r.cells.B] } })), insts: insts.map((i) => ({ ...i, deps: null, users: [...i.users] })), lanes: { A: { ...scopes.A, cache: null, disp: null }, B: { ...scopes.B, cache: null, disp: null } }, vars: vars(), ...extra });
      const newRow = (t, label) => { const r = { t, label, cells: { R: [], A: [], B: [] }, bad: false }; rows.push(r); return r; };

      // ValidateOnBuild: a singleton must not reach a scoped service, even through transients.
      const reachScoped = (k, seen = new Set()) => { if (seen.has(k)) return null; seen.add(k); for (const d of SVC[k].deps) { if (L[d] === "scoped") return d; if (L[d] === "transient") { const r = reachScoped(d, seen); if (r) return r; } } return null; };
      const r0 = newRow("build", "BuildServiceProvider");
      for (const k of Object.keys(SVC)) {
        if (L[k] !== "singleton") continue;
        const bad = reachScoped(k);
        if (bad) {
          r0.cells.R.push({ text: `ValidateOnBuild ✗` }); r0.bad = true;
          snap(3, `<b>Build fails.</b> ${esc(SVC[k].type)} is a singleton, but it needs ${esc(SVC[bad].type)}, which is scoped. A singleton outlives every request, so it would keep one request's ${esc(SVC[bad].type)} forever (a <i>captive dependency</i>). With <code>ValidateOnBuild</code> the app refuses to start; that is the cheapest possible place to find this bug.`,
            { err: `InvalidOperationException: Cannot consume scoped service '${SVC[bad].svc}' from singleton '${SVC[k].svc}'.` });
          return fr;
        }
      }
      r0.cells.R.push({ text: "validated: no singleton reaches a scoped service" });
      snap(3, `The root provider is built. Lifetimes: IClock <b>${L.Clock}</b>, AppDbContext <b>${L.Db}</b>, PriceCalculator <b>${L.Calc}</b>. ValidateOnBuild walked every registration: nothing long-lived captures something short-lived. Nothing has been created yet: containers create lazily.`);

      const owner = (life, prov) => (life === "singleton" ? "R" : prov);
      // resolve: returns the instance, appending chips (in creation order) to out
      const resolve = (k, prov, origin, out, rootNew) => {
        const life = L[k], s = SVC[k];
        const cacheScope = life === "singleton" ? scopes.R : life === "scoped" ? scopes[prov] : null;
        if (cacheScope && cacheScope.cache.has(k)) {
          const inst = cacheScope.cache.get(k);
          const mark = (x) => { x.users.add(origin); (x.deps || []).forEach(mark); };
          mark(inst);
          out.push({ id: inst.id, type: s.type, life, st: "reused", tag: life === "singleton" ? "root cache" : `${prov} cache` });
          return inst;
        }
        const dprov = life === "singleton" ? "R" : prov;
        const depInsts = s.deps.map((d) => resolve(d, dprov, origin, out, rootNew));
        const inst = { id: nextId++, key: k, type: s.type, life, owner: owner(life, dprov), users: new Set([origin]), state: "live", deps: depInsts };
        if (life === "transient" && dprov === "R" && origin !== "R") inst.captive = true;
        insts.push(inst);
        if (cacheScope) cacheScope.cache.set(k, inst);
        if (s.disp) scopes[inst.owner].disp.push(inst);
        out.push({ id: inst.id, type: s.type, life, st: "new", tag: inst.owner === "R" && origin !== "R" ? "owned by root" : life === "transient" && s.disp ? `tracked by ${inst.owner}` : "" });
        if (inst.owner === "R") rootNew.push({ id: inst.id, type: s.type, life, st: "new" });
        return inst;
      };
      const concurrencyCheck = () => {
        const msgs = [];
        for (const i of insts) {
          if (i.state !== "live") continue;
          const open = [...i.users].filter((u) => u !== "R" && scopes[u].open);
          if (open.length > 1 && !i.flagged) {
            i.flagged = true; i.shared = true;
            msgs.push(SVC[i.key].safe ? `${i.type} #${i.id} is now used by requests A and B <b>at the same time</b>. That is fine only because ${SVC[i.key].safe}: anything shared by concurrent requests must be thread-safe.` : `<b>${i.type} #${i.id} is shared by two concurrent requests.</b> DbContext is not thread-safe: the next overlapping query throws, and one request sees the other's tracked entities.`);
            if (!SVC[i.key].safe) i.unsafe = true;
          }
        }
        return msgs;
      };
      const dispose = (lane, row) => {
        const sc = scopes[lane];
        const list = [...sc.disp].reverse();
        for (const inst of list) { inst.state = "disposed"; row.cells[lane].push({ chip: { id: inst.id, type: inst.type, life: inst.life, st: "disposed", tag: "Dispose" } }); }
        sc.disp = [];
        return list;
      };
      let t = 0;
      for (const tok of toks) {
        t++;
        if (/^stop$/i.test(tok)) {
          const row = newRow(t, "shutdown");
          const pre = [];
          for (const ln of ["A", "B"]) if (scopes[ln].open) { scopes[ln].open = false; scopes[ln].ended = true; pre.push(ln); dispose(ln, row); }
          const gone = dispose("R", row);
          scopes.R.open = false;
          if (!gone.length) row.cells.R.push({ text: "nothing disposable in the root" });
          snap(9, `${pre.length ? `Request ${pre.join(" and ")} still running: the host drains it and disposes its scope first. ` : ""}Shutdown: the <b>root</b> disposes what <i>it</i> created${gone.length ? `, newest first: ${gone.map((g) => `${esc(g.type)} #${g.id}`).join(", ")}` : ". No singleton here is IDisposable, so nothing to do"}. Singletons that are not disposable are simply released.${insts.some((i) => i.captive && SVC[i.key].disp) ? " Note that a transient AppDbContext held by a singleton lived until now: effectively a singleton." : ""}`);
          break;
        }
        const m = /^([ABR])(?:([+-])|:(\w+))$/i.exec(tok);
        const lane = m[1].toUpperCase();
        if (m[2] === "+") {
          const row = newRow(t, `${lane}+`);
          if (scopes[lane].open) { row.cells[lane].push({ text: "already running" }); snap(5, `Request ${lane} is already running; one scope per request.`); continue; }
          scopes[lane] = { open: true, ended: false, cache: new Map(), disp: [] };
          row.cells[lane].push({ text: "CreateAsyncScope(): empty scope cache" });
          snap(5, `Request ${lane} arrives. ASP.NET Core creates a <b>new scope</b> for it: an empty cache for scoped services and an empty list of disposables to clean up at the end.${scopes[lane === "A" ? "B" : "A"].open ? ` Request ${lane === "A" ? "B" : "A"} is still running: from now on they run <b>concurrently</b>, on different threads.` : ""}`);
          continue;
        }
        if (m[2] === "-") {
          const row = newRow(t, `${lane}-`);
          if (!scopes[lane].open) { row.cells[lane].push({ text: "not running" }); snap(8, `Request ${lane} is not running, so there is no scope to end.`); continue; }
          scopes[lane].open = false; scopes[lane].ended = true;
          const gone = dispose(lane, row);
          if (!gone.length) row.cells[lane].push({ text: "nothing disposable" });
          snap(8, `Request ${lane} ends and its scope is disposed. It disposes ${gone.length ? `<b>only what it created</b>, newest first: ${gone.map((g) => `${esc(g.type)} #${g.id}`).join(", ")}` : "nothing: it created no disposable objects"}. Singletons are untouched: they belong to the root.`);
          continue;
        }
        const k = keyOf(m[3]), s = SVC[k];
        const row = newRow(t, `${lane}:${k}`);
        if (lane === "R") {
          const bad = L[k] === "scoped" ? k : L[k] === "transient" ? reachScoped(k) : null;
          if (bad) {
            row.bad = true; row.cells.R.push({ text: `GetRequiredService<${s.svc}>() ✗` });
            snap(7, `Resolving from the <b>root</b> has no request to attach a scoped object to. If the root created ${esc(SVC[bad].type)} it would live until shutdown: a silent captive. <code>ValidateScopes</code> turns that into an exception.`,
              { err: bad === k ? `InvalidOperationException: Cannot resolve scoped service '${s.svc}' from root provider.` : `InvalidOperationException: Cannot resolve '${s.svc}' from root provider because it requires scoped service '${SVC[bad].svc}'.` });
            break;
          }
        } else if (!scopes[lane].open) {
          row.bad = true; row.cells[lane].push({ text: `GetRequiredService<${s.svc}>() ✗` });
          snap(6, scopes[lane].ended ? `Request ${lane} already ended; its scope was disposed. Code that kept the scope's provider (for example a fire-and-forget task) now fails.` : `Request ${lane} has not started: write ${lane}+ first.`,
            scopes[lane].ended ? { err: "ObjectDisposedException: Cannot access a disposed object. Object name: 'IServiceProvider'." } : {});
          if (scopes[lane].ended) break;
          continue;
        }
        const out = [], rootNew = [];
        const inst = resolve(k, lane, lane, out, rootNew);
        row.cells[lane].push({ text: `GetRequiredService<${s.svc}>()` }, ...out.map((c) => ({ chip: c })));
        if (lane !== "R") for (const c of rootNew) row.cells.R.push({ chip: { ...c, tag: "cached in root" } });
        const before = new Set(insts.filter((i) => i.unsafe).map((i) => i.id));
        const conc = lane === "R" ? [] : concurrencyCheck();
        if (insts.some((i) => i.unsafe && !before.has(i.id))) row.bad = true;
        const capt = (made) => made.filter((c) => insts.find((i) => i.id === c.id && i.captive));
        const made = out.filter((c) => c.st === "new"), reused = out.filter((c) => c.st === "reused");
        const why = L[k] === "transient" ? "Transient: a brand-new object for every resolution." : L[k] === "scoped" ? (reused.some((c) => c.id === inst.id) ? `Scoped: the same object for the whole of request ${lane}.` : `Scoped: created once for request ${lane} and cached in its scope.`) : reused.some((c) => c.id === inst.id) ? "Singleton: every request gets the one root instance." : "Singleton: created on first use and cached in the root for the life of the app.";
        snap(lane === "R" ? 7 : 6, `${lane === "R" ? "The root resolves" : `Request ${lane} resolves`} <b>${esc(s.type)}</b> → <b>#${inst.id}</b>. ${why} ${made.length ? `New: ${made.map((c) => `${esc(c.type)} #${c.id}`).join(", ")}${made.length > 1 ? " (dependencies first)" : ""}. ` : ""}${reused.length ? `Reused: ${reused.map((c) => `${esc(c.type)} #${c.id}`).join(", ")}. ` : ""}${capt(made).length ? `A <b>transient created inside a singleton</b> (${capt(made).map((c) => `${esc(c.type)} #${c.id}`).join(", ")}) is resolved by the root and lives as long as the singleton. ` : ""}${conc.join(" ")}`);
      }
      return fr;
    },
    render: (f) => {
      const lis = host.querySelectorAll ? host.querySelectorAll(".viz-code li") : [];
      regLines({ Clock: f.vars.IClock, Db: f.vars.AppDbContext, Calc: f.vars.PriceCalculator }).forEach((src, k) => {
        if (!lis[k] || lis[k].dataset.src === src) return;
        lis[k].dataset.src = src;
        lis[k].innerHTML = (window.LearningHome && window.LearningHome.highlight(src, "csharp")) ?? esc(src);
      });
      const laneHead = (ln) => {
        const st = ln === "R" ? "always" : f.lanes[ln].open ? "running" : f.lanes[ln].ended ? "ended" : "not started";
        return `<div class="dil-lh ${ln} ${st.replace(" ", "-")}"><b>${esc(LANES[ln])}</b><small>${st}</small></div>`;
      };
      const cell = (items) => items.map((it) => (it.chip ? chip(it.chip) : `<span class="dil-txt">${esc(it.text)}</span>`)).join("");
      const rows = f.rows.map((r, i) => `<div class="dil-lr ${i === f.rows.length - 1 ? "cur" : ""} ${r.bad ? "bad" : ""}"><span class="dil-t">${esc(r.t)}<small>${esc(r.label)}</small></span>${["R", "A", "B"].map((ln) => `<div class="dil-lc ${ln}">${cell(r.cells[ln])}</div>`).join("")}</div>`).join("");
      const lanes = `<div class="dil-lanes"><div class="dil-lr dil-head"><span class="dil-t">t</span>${["R", "A", "B"].map(laneHead).join("")}</div>${rows}</div>`;
      const ts = (i) => {
        const u = i.users.filter((x) => x !== "R");
        if (i.shared) return i.unsafe ? { c: "bad", t: `shared by ${u.join("+")} concurrently: NOT thread-safe` } : { c: "ok", t: `shared by ${u.join("+")}: immutable, OK` };
        if (i.owner === "R") return { c: "warn", t: i.life === "singleton" ? "must be thread-safe (all requests)" : "lives as long as its singleton" };
        if (i.life === "scoped") return { c: "", t: "one request; no parallel use inside it" };
        return { c: "", t: "not shared" };
      };
      const trs = f.insts.map((i) => { const x = ts(i); return `<div class="dil-tr ${i.state}"><span>#${i.id}</span><span>${esc(i.type)}</span><span class="dil-life ${i.life}">${i.life}</span><span>${i.owner === "R" ? "root" : `scope ${i.owner}`}</span><span>${esc(i.users.map((u) => (u === "R" ? "root" : u)).join(", "))}</span><span class="${i.state === "disposed" ? "dil-mute" : ""}">${i.state}</span><span class="dil-ts ${x.c}">${esc(x.t)}</span></div>`; }).join("");
      const table = `<div class="v-labeled"><span class="v-caption">every instance created so far</span><div class="dil-tbl dil-inst"><div class="dil-tr dil-th"><span>id</span><span>type</span><span>lifetime</span><span>owner</span><span>used by</span><span>state</span><span>thread safety</span></div>${trs || '<div class="dil-tr"><span></span><span class="dil-mute">none yet: containers create lazily</span></div>'}</div></div>`;
      return lanes + (f.err ? `<div class="dil-err">${esc(f.err)}</div>` : "") + table;
    },
  }));

  /* ---------- 2. The captive dependency ---------- */
  const CAPTIVE_FIX = ["no validation (Production default)", "ValidateScopes + ValidateOnBuild", "register PriceCache as scoped", "PriceCache takes IServiceScopeFactory"];
  Viz.register("di-lifetimes-captive", (host) => Viz.player(host, {
    title: "A singleton captures a scoped DbContext",
    tag: "CAPTIVE DEPENDENCY · STEP THROUGH",
    legend: [["path", "owned by the root (lives until shutdown)"], ["visit", "owned by a request scope"], ["bad", "bug"], ["done", "disposed on time"]],
    codeLang: "csharp",
    code: [
      "services.AddDbContext<AppDbContext>();          // scoped",
      "services.AddSingleton<PriceCache>();            // lives forever",
      "class PriceCache(AppDbContext db) {             // captive!",
      "  public Task<Price> Get(string sku) =>",
      "    db.Prices.SingleAsync(p => p.Sku == sku);",
      "}",
      "// fix 1: services.AddScoped<PriceCache>();",
      "// fix 2: class PriceCache(IServiceScopeFactory scopes) {",
      "//   await using var s = scopes.CreateAsyncScope();",
      "//   var db = s.ServiceProvider.GetRequiredService<AppDbContext>(); }",
      "// detect: o.ValidateScopes = true; o.ValidateOnBuild = true;",
    ],
    inputs: [{ key: "fix", label: "configuration", type: "select", options: CAPTIVE_FIX, value: CAPTIVE_FIX[0] }],
    random: () => ({ fix: pick(CAPTIVE_FIX) }),
    build: ({ fix }) => {
      const mode = CAPTIVE_FIX.indexOf(fix);
      if (mode < 0) throw new Error("Pick a configuration from the list.");
      const fr = [], log = [];
      let boxes = [], db = [];
      const B = (name, cls, chips, sub = "") => ({ name, cls, chips, sub });
      const S = (line, note, extra = {}) => fr.push({ line, note, boxes: boxes.map((b) => ({ ...b, chips: b.chips.map((c) => ({ ...c })) })), log: log.map((e) => ({ ...e })), db: db.map((d) => ({ ...d })), vars: { config: ["none", "validate", "scoped", "scope factory"][mode], "DbContexts alive": db.filter((d) => !d.gone).length, "max tracked": Math.max(0, ...db.map((d) => d.tracked)), errors: log.filter((e) => e.c === "bad").length }, ...extra });
      const ev = (c, t) => log.push({ c, t });
      if (mode === 1) {
        boxes = [B("Root", "path", [])];
        ev("", "BuildServiceProvider(): ValidateOnBuild walks every registration");
        S(1, "Development turns on <code>ValidateScopes</code> and <code>ValidateOnBuild</code> by default (any environment can opt in). The validator walks PriceCache's constructor and finds a scoped service under a singleton.");
        ev("bad", "Cannot consume scoped service 'AppDbContext' from singleton 'PriceCache'.");
        S(2, "<b>The app refuses to start.</b> No request ever sees the bug. Now pick one of the two fixes in the list: make the consumer scoped, or let it create a short scope per operation.", { err: "System.AggregateException: Some services are not able to be constructed (Error while validating the service descriptor 'ServiceType: PriceCache Lifetime: Singleton ImplementationType: PriceCache': Cannot consume scoped service 'AppDbContext' from singleton 'PriceCache'.)" });
        return fr;
      }
      boxes = [B("Root", "path", [], "singletons")];
      ev("", "BuildServiceProvider() succeeds");
      S(mode === 0 ? 1 : mode === 2 ? 6 : 7, mode === 0 ? "Production defaults do <b>not</b> validate scopes (validation costs startup time). The provider builds happily: nothing looks wrong yet." : mode === 2 ? "PriceCache is now scoped: a scoped consumer of a scoped dependency is always legal. Validation passes." : "PriceCache stays a singleton but depends on <code>IServiceScopeFactory</code>, which is itself a singleton. Validation passes.");
      if (mode === 0) {
        boxes.push(B("Scope R1", "visit", [], "request 1"));
        db.push({ id: 1, tracked: 0, owner: "root" });
        boxes[0].chips.push({ id: 1, type: "AppDbContext", life: "scoped", st: "bad", tag: "resolved by root!" }, { id: 2, type: "PriceCache", life: "singleton", st: "new" });
        boxes[1].chips.push({ id: 3, type: "PricesController", life: "transient", st: "new" });
        ev("warn", "R1 resolves PriceCache #2: first use, so the <b>root</b> creates it and its AppDbContext #1");
        S(2, "Request 1 needs PriceCache. It is a singleton, so it is built by the <b>root</b> provider, and so are its dependencies. AppDbContext #1 was registered as scoped, but it is now owned by the root: there is no request it belongs to.");
        db[0].tracked = 3; ev("", "R1: cache.Get(\"A1\") → AppDbContext #1 runs a query, tracks 3 entities");
        S(4, "Request 1 queries through the captured context. EF's change tracker keeps every loaded entity until the context is disposed.");
        boxes.push(B("Scope R2", "visit", [{ id: 4, type: "PricesController", life: "transient", st: "new" }, { id: 2, type: "PriceCache", life: "singleton", st: "reused", tag: "same singleton" }], "request 2, concurrent"));
        ev("warn", "R2 (concurrent) gets PriceCache #2, so it also gets AppDbContext #1");
        S(2, "Request 2 arrives while request 1 is still running. It gets the same PriceCache, so it gets <b>the same AppDbContext #1</b>. Two threads now share a DbContext.");
        ev("bad", "InvalidOperationException: A second operation was started on this context instance before a previous operation completed.");
        S(4, "<b>Thread-safety bug.</b> R1 and R2 query at the same time. DbContext is not thread-safe; EF detects the overlap and throws (or, worse, corrupts its state if the detection misses).", { err: "InvalidOperationException: A second operation was started on this context instance before a previous operation completed. This is usually caused by different threads concurrently using the same instance of DbContext." });
        boxes[1].chips = boxes[1].chips.map((c) => ({ ...c, st: "disposed" })); boxes[1].sub = "ended";
        ev("warn", "R1 ends: scope R1 disposes what it created (nothing disposable). AppDbContext #1 is not its to dispose");
        S(8, "Request 1 ends. Its scope disposes only objects <i>it</i> created. AppDbContext #1 belongs to the root, so it is <b>never disposed</b> until shutdown.");
        db[0].tracked = 4; ev("bad", "Admin sets A1 to 12.00. R2 reads A1: gets 10.00 (the tracked entity wins)");
        S(4, "<b>Stale data.</b> Another process changed the price. The query does hit the database, but EF's identity resolution returns the already-tracked entity with the old values.");
        db[0].tracked = 30000; ev("bad", "after 10,000 requests: 30,000 tracked entities in AppDbContext #1, memory keeps growing");
        S(2, "<b>Memory leak.</b> One context for the whole life of the process; its change tracker only grows. Three bugs (thread safety, stale reads, memory), one cause: a long-lived object holding a short-lived one.");
        return fr;
      }
      if (mode === 2) {
        const r1 = B("Scope R1", "visit", [{ id: 1, type: "AppDbContext", life: "scoped", st: "new" }, { id: 2, type: "PriceCache", life: "scoped", st: "new" }, { id: 3, type: "PricesController", life: "transient", st: "new" }], "request 1");
        boxes.push(r1); db.push({ id: 1, tracked: 3, owner: "R1" });
        ev("ok", "R1 resolves PriceCache #2 in its own scope, with AppDbContext #1");
        S(6, "Request 1 gets its own PriceCache and its own AppDbContext, both cached in scope R1.");
        boxes.push(B("Scope R2", "visit", [{ id: 4, type: "AppDbContext", life: "scoped", st: "new" }, { id: 5, type: "PriceCache", life: "scoped", st: "new" }, { id: 6, type: "PricesController", life: "transient", st: "new" }], "request 2, concurrent"));
        db.push({ id: 4, tracked: 3, owner: "R2" });
        ev("ok", "R2 (concurrent) gets PriceCache #5 with AppDbContext #4");
        S(6, "Request 2 runs at the same time with <b>different</b> instances. No sharing, so no locking is needed.");
        ev("ok", "R1 and R2 query simultaneously: two contexts, no conflict");
        S(4, "Both requests query at once. Each context is used by one request only.");
        r1.chips = r1.chips.map((c) => ({ ...c, st: c.type === "AppDbContext" ? "disposed" : "gone" })); r1.sub = "ended"; db[0].gone = true;
        ev("ok", "R1 ends: scope R1 disposes AppDbContext #1 (tracked entities released)");
        S(8, "Request 1 ends; its scope disposes AppDbContext #1 on time. Trade-off: a scoped PriceCache cannot cache across requests. If that was its purpose, keep the cached <i>data</i> in a singleton (<code>IMemoryCache</code>, a <code>ConcurrentDictionary</code>) and keep the database access scoped.");
        return fr;
      }
      boxes[0].chips.push({ id: 1, type: "PriceCache", life: "singleton", st: "new", tag: "holds IServiceScopeFactory" });
      boxes.push(B("Scope R1", "visit", [{ id: 2, type: "PricesController", life: "transient", st: "new" }], "request 1"));
      ev("ok", "R1 resolves PriceCache #1 (singleton). Its only dependency is the scope factory");
      S(7, "PriceCache is still a singleton, which is fine now: it holds no scoped object, only a factory for scopes.");
      boxes.push(B("Inner scope S1", "done", [{ id: 3, type: "AppDbContext", life: "scoped", st: "new" }], "created by PriceCache for one call"));
      db.push({ id: 3, tracked: 3, owner: "S1" });
      ev("ok", "R1: Get(\"A1\") → CreateAsyncScope() → AppDbContext #3 → query");
      S(9, "Each Get creates a short <b>inner scope</b>, resolves a fresh AppDbContext from it, queries, and disposes the scope.");
      boxes.push(B("Inner scope S2", "done", [{ id: 4, type: "AppDbContext", life: "scoped", st: "new" }], "concurrent call from R2"));
      boxes.splice(3, 0, B("Scope R2", "visit", [{ id: 5, type: "PricesController", life: "transient", st: "new" }], "request 2, concurrent"));
      db.push({ id: 4, tracked: 3, owner: "S2" });
      ev("ok", "R2 calls Get concurrently → its own inner scope S2 and AppDbContext #4");
      S(8, "A concurrent call from request 2 gets its own scope and its own context. The singleton's shared state (the cached prices) must still be thread-safe: use a <code>ConcurrentDictionary</code> or <code>IMemoryCache</code>.");
      boxes[2].chips = boxes[2].chips.map((c) => ({ ...c, st: "disposed" })); boxes[2].sub = "disposed after the call"; db[0].gone = true;
      boxes[4].chips = boxes[4].chips.map((c) => ({ ...c, st: "disposed" })); boxes[4].sub = "disposed after the call"; db[1].gone = true;
      ev("ok", "both inner scopes disposed: AppDbContext #3 and #4 released");
      S(8, "<code>await using</code> disposes each inner scope as soon as the call returns. Contexts live for one operation; the singleton lives forever; nothing short-lived is captured. This is the same pattern a <code>BackgroundService</code> uses.");
      return fr;
    },
    render: (f) => {
      const boxes = f.boxes.map((b) => `<div class="dil-own ${b.cls}"><div class="dil-own-h"><b>${esc(b.name)}</b><small>${esc(b.sub || "")}</small></div><div class="dil-own-b">${b.chips.length ? b.chips.map(chip).join("") : '<span class="dil-mute">empty</span>'}</div></div>`).join("");
      const max = Math.max(3, ...f.db.map((d) => d.tracked));
      const bars = f.db.length ? `<div class="v-labeled"><span class="v-caption">entities tracked per AppDbContext</span><div class="dil-bars">${f.db.map((d) => `<div class="dil-bar ${d.gone ? "gone" : d.owner === "root" ? "bad" : ""}"><span>#${d.id} · ${esc(d.owner)}</span><i style="width:${Math.max(4, (Math.log10(d.tracked + 1) / Math.log10(max + 1)) * 100).toFixed(1)}%"></i><b>${d.gone ? "disposed" : d.tracked.toLocaleString("en-US")}</b></div>`).join("")}</div></div>` : "";
      return `<div class="dil-owners">${boxes}</div>` + Viz.row(logList(f.log), bars) + (f.err ? `<div class="dil-err">${esc(f.err)}</div>` : "");
    },
  }));

  /* ---------- 3. The scope validator and the lifetime matrix ---------- */
  const CHAINS = [
    "ReportJob@singleton > Formatter@transient > AppDbContext@scoped",
    "PriceCache@singleton > AppDbContext@scoped",
    "OrdersController@transient > OrderService@scoped > AppDbContext@scoped",
    "OrderService@scoped > Formatter@transient > IClock@singleton",
    "Metrics@singleton > Buffer@transient",
  ];
  const MATRIX = {
    singleton: { singleton: ["ok", "✓"], scoped: ["bad", "✗ captive"], transient: ["warn", "⚠ becomes singleton"] },
    scoped: { singleton: ["ok", "✓"], scoped: ["ok", "✓ same per scope"], transient: ["ok", "✓"] },
    transient: { singleton: ["ok", "✓"], scoped: ["ok", "✓ inside a scope"], transient: ["ok", "✓"] },
  };
  Viz.register("di-lifetimes-validate", (host) => Viz.player(host, {
    title: "Scope validation: walking the dependency chain",
    tag: "VALIDATESCOPES · STEP THROUGH",
    legend: [["active", "being checked"], ["done", "valid"], ["warn", "valid but longer-lived than declared"], ["bad", "rejected"]],
    codeLang: "csharp",
    code: [
      "void Validate(CallSite cs, CallSite? singletonAbove) {",
      "  if (cs.Lifetime == Singleton) singletonAbove = cs;",
      "  else if (cs.Lifetime == Scoped && singletonAbove != null)",
      "    throw Error($\"Cannot consume scoped ... from singleton ...\");",
      "  foreach (var dep in cs.Dependencies) Validate(dep, singletonAbove);",
      "}",
      "// and when resolving from the root provider:",
      "if (cs.Lifetime == Scoped) throw Error(\"Cannot resolve scoped ...\");",
      "if (ReachesScoped(cs)) throw Error(\"... requires scoped service ...\");",
    ],
    inputs: [
      { key: "chain", label: "dependency chain  (Name@lifetime > Name@lifetime > …)", value: CHAINS[0], width: 520 },
      { key: "from", label: "resolved from", type: "select", options: ["a request scope", "the root provider"], value: "a request scope" },
    ],
    random: () => ({ chain: pick(CHAINS), from: Viz.rand(0, 3) ? "a request scope" : "the root provider" }),
    build: ({ chain, from }) => {
      const parts = String(chain).split(">").map((s) => s.trim()).filter(Boolean);
      if (parts.length < 2 || parts.length > 5) throw new Error("Write 2 to 5 links, e.g. A@singleton > B@scoped");
      const nodes = parts.map((p) => {
        const m = /^([A-Za-z_][\w<>.]*)\s*@\s*(\w+)$/.exec(p);
        if (!m) throw new Error(`"${p}" should look like Name@lifetime`);
        const life = m[2].toLowerCase();
        if (!LIVES.includes(life)) throw new Error(`"${m[2]}" is not a lifetime: use singleton, scoped or transient`);
        return { name: m[1], life, st: "", eff: "" };
      });
      const root = from === "the root provider", fr = [];
      const S = (line, note, cur, extra = {}) => fr.push({ line, note, cur, nodes: nodes.map((n) => ({ ...n })), vars: { "resolved from": root ? "root" : "scope", checked: Math.max(0, cur + 1), "singleton above": extra.holder ?? "none" }, ...extra });
      S(0, `The validator walks the chain depth-first and carries one piece of state: the <b>nearest singleton above</b> the current service. Anything under a singleton is created by the root and lives until shutdown, whatever its own lifetime says. Resolving from <b>${root ? "the root provider" : "a request scope"}</b>.`, -1);
      let holder = null;
      for (let i = 0; i < nodes.length; i++) {
        const n = nodes[i], parent = i ? nodes[i - 1] : null;
        const pair = parent ? [parent.life, n.life] : null, eff = holder !== null ? ["singleton", n.life] : null;
        const hn = holder !== null ? nodes[holder].name : null;
        n.st = "active";
        if (n.life === "singleton") {
          n.eff = "app lifetime"; n.st = "done";
          S(1, `<b>${esc(n.name)}</b> is a singleton: from here down, everything is resolved by the root and held for the life of the app. The validator remembers it as the singleton above.`, i, { pair, holder: hn });
          holder = i; continue;
        }
        if (n.life === "scoped" && holder !== null) {
          n.st = "bad"; n.eff = `captured by ${nodes[holder].name}`;
          S(3, `<b>${esc(n.name)}</b> is scoped, and <b>${esc(hn)}</b> (a singleton) is above it${holder !== i - 1 ? `, reached through ${nodes.slice(holder + 1, i).map((x) => `${esc(x.name)} (${x.life})`).join(", ")}. The transient in between does not shorten anything: it is created once by the singleton and kept` : ""}. The singleton would keep one scope's instance forever.`, i, { pair, eff, holder: hn, err: `InvalidOperationException: Cannot consume scoped service '${n.name}' from singleton '${hn}'.` });
          return fr;
        }
        if (n.life === "scoped" && root) {
          n.st = "bad";
          const msg = i === 0 ? `Cannot resolve scoped service '${n.name}' from root provider.` : `Cannot resolve '${nodes[0].name}' from root provider because it requires scoped service '${n.name}'.`;
          S(i === 0 ? 7 : 8, `<b>${esc(n.name)}</b> is scoped, but this resolution comes from the <b>root</b>: there is no request scope to own it, so it would silently live until shutdown.`, i, { pair, eff, holder: hn, err: `InvalidOperationException: ${msg}` });
          return fr;
        }
        if (n.life === "scoped") {
          n.eff = "this request"; n.st = "done";
          S(2, `<b>${esc(n.name)}</b> is scoped and nothing longer-lived is above it: one instance per request scope, disposed when the request ends.`, i, { pair, holder: hn });
          continue;
        }
        if (holder !== null) {
          n.eff = `app lifetime (held by ${nodes[holder].name})`; n.st = "warn";
          S(4, `<b>${esc(n.name)}</b> is transient under singleton <b>${esc(hn)}</b>. The validator allows it, but the singleton asks for it <b>once</b> and keeps it: effectively a singleton. It must be thread-safe, and if it is disposable it is only disposed at shutdown.`, i, { pair, eff, holder: hn });
        } else {
          n.eff = parent ? `as long as ${parent.name}` : "the caller's"; n.st = "done";
          S(4, `<b>${esc(n.name)}</b> is transient: a new instance for this consumer, living as long as ${parent ? esc(parent.name) : "the caller"} holds it.`, i, { pair, holder: hn });
        }
      }
      const warns = nodes.filter((n) => n.st === "warn");
      S(5, `<b>Valid.</b> ${warns.length ? `But ${warns.map((n) => esc(n.name)).join(", ")} ${warns.length > 1 ? "live" : "lives"} far longer than ${warns.length > 1 ? "their" : "its"} declared lifetime: check thread safety. ` : ""}Rule of thumb: a service may depend on services that live <b>at least as long</b> as it does.`, nodes.length, { holder: holder !== null ? nodes[holder].name : null });
      return fr;
    },
    render: (f) => {
      const chainHtml = f.nodes.map((n, i) => `${i ? '<div class="dil-dn">depends on ↓</div>' : ""}<div class="dil-node ${n.st} ${i === f.cur ? "cur" : ""}"><div><b>${esc(n.name)}</b><span class="dil-life ${n.life}">${n.life}</span></div><small>${n.eff ? `effective lifetime: ${esc(n.eff)}` : i > f.cur ? "not checked yet" : ""}</small></div>`).join("");
      const head = `<span class="dil-mh">consumer ↓ / dependency →</span>${LIVES.map((l) => `<span class="dil-mh">${l}</span>`).join("")}`;
      const cells = LIVES.map((c) => `<span class="dil-mh">${c}</span>${LIVES.map((d) => {
        const [cls, txt] = MATRIX[c][d];
        const hit = f.pair && f.pair[0] === c && f.pair[1] === d, eff = f.eff && f.eff[0] === c && f.eff[1] === d;
        return `<span class="dil-mc ${cls} ${hit ? "hit" : ""} ${eff ? "eff" : ""}">${esc(txt)}${hit ? "<i>direct</i>" : eff ? "<i>effective</i>" : ""}</span>`;
      }).join("")}`).join("");
      const matrix = `<div class="v-labeled"><span class="v-caption">who may depend on whom</span><div class="dil-matrix">${head}${cells}</div></div>`;
      return Viz.row(`<div class="v-labeled"><span class="v-caption">the chain being validated</span><div class="dil-chain">${chainHtml}</div></div>`, matrix) + (f.err ? `<div class="dil-err">${esc(f.err)}</div>` : "");
    },
  }));

  /* ---------- 4. Disposal order and ownership ---------- */
  const DISPOSE_SCN = ["request scope", "transient resolved from the root", "AddSingleton(instance) vs type vs factory", "IAsyncDisposable-only service"];
  const DISPOSE_HOW = ["await using → DisposeAsync", "using → Dispose"];
  Viz.register("di-lifetimes-dispose", (host) => Viz.player(host, {
    title: "Who disposes what, and in which order",
    tag: "DISPOSAL · STEP THROUGH",
    legend: [["active", "being created / disposed"], ["done", "disposed"], ["bad", "error or leak"], ["dim", "not tracked by the container"]],
    codeLang: "csharp",
    code: [
      "await using (var scope = root.CreateAsyncScope()) {",
      "  var svc = scope.ServiceProvider.GetRequiredService<T>();",
      "  // each IDisposable/IAsyncDisposable the scope creates is recorded",
      "  await svc.RunAsync();",
      "}                                    // scope.DisposeAsync() runs here",
      "// inside the scope (simplified):",
      "for (int i = _disposables.Count - 1; i >= 0; i--) // newest first",
      "  if (_disposables[i] is IAsyncDisposable a) await a.DisposeAsync();",
      "  else ((IDisposable)_disposables[i]).Dispose();",
      "// sync Dispose(): an IAsyncDisposable-only service throws",
      "// never tracked: AddSingleton(instance), objects you new yourself",
    ],
    inputs: [
      { key: "scn", label: "scenario", type: "select", options: DISPOSE_SCN, value: DISPOSE_SCN[0] },
      { key: "how", label: "the scope / root is disposed with", type: "select", options: DISPOSE_HOW, value: DISPOSE_HOW[0] },
    ],
    random: () => ({ scn: pick(DISPOSE_SCN), how: pick(DISPOSE_HOW) }),
    build: ({ scn, how }) => {
      const sc = DISPOSE_SCN.indexOf(scn), sync = how === DISPOSE_HOW[1];
      if (sc < 0 || !DISPOSE_HOW.includes(how)) throw new Error("Pick a scenario and a disposal method.");
      const fr = [], stack = [], untracked = [], log = [];
      let owner = sc === 0 || sc === 3 ? "scope" : "root";
      const S = (line, note, extra = {}) => fr.push({ line, note, owner, stack: stack.map((x) => ({ ...x })), untracked: untracked.map((x) => ({ ...x })), log: log.map((e) => ({ ...e })), vars: { "disposed with": sync ? "Dispose()" : "DisposeAsync()", tracked: stack.filter((x) => x.st !== "done").length + (stack.find((x) => x.more) ? 9996 : 0), disposed: stack.filter((x) => x.st === "done").length, errors: log.filter((e) => e.c === "bad").length }, ...extra });
      const ev = (c, t) => log.push({ c, t });
      const add = (x, line, note) => { x.st = "active"; stack.push(x); ev("", `created ${x.type} #${x.id} → tracked`); S(line, note); x.st = ""; };
      const callFor = (x) => (x.ifc === "IDisposable" ? "Dispose()" : sync ? (x.ifc === "IAsyncDisposable" ? null : "Dispose()") : "DisposeAsync()");
      const disposeAll = (line, intro) => {
        for (let i = stack.length - 1; i >= 0; i--) {
          const x = stack[i];
          if (x.more) { x.st = "done"; continue; }
          const call = callFor(x);
          x.st = "active";
          if (!call) {
            x.st = "bad"; ev("bad", `${x.type} #${x.id}: only IAsyncDisposable, Dispose() throws`);
            S(9, `<b>${esc(x.type)}</b> implements only <code>IAsyncDisposable</code>. A synchronous <code>Dispose()</code> cannot await it, so the container throws instead of blocking or skipping it. Use <code>await using</code> / <code>CreateAsyncScope()</code>.`, { err: `InvalidOperationException: '${x.type}' type only implements IAsyncDisposable. Use DisposeAsync to dispose the container.` });
            return false;
          }
          ev("ok", `${x.type} #${x.id}.${call}`);
          S(x.ifc === "IDisposable" || sync ? 8 : 7, `${i === stack.length - 1 ? intro + " " : ""}Newest first: <b>${esc(x.type)} #${x.id}</b>.${call}${x.ifc === "both" ? (sync ? " (it supports both; a sync dispose uses Dispose)" : " (it supports both; DisposeAsync is preferred)") : x.ifc === "IDisposable" && !sync ? " (IDisposable only, so even DisposeAsync falls back to Dispose)" : ""}. ${x.why || ""}`);
          x.st = "done";
        }
        return true;
      };
      if (sc === 0) {
        untracked.push({ id: "R", type: "ConsoleLogger", life: "singleton", why: "singleton: owned by the root" });
        S(0, "A request scope starts. Its list of disposables is empty. The logger is a singleton that already exists in the root.");
        add({ id: 1, type: "AppDbContext", life: "scoped", ifc: "both", why: "Disposed last because it was created first: anything that used it is already gone." }, 2, "Resolving OrderService creates its dependencies first. <b>AppDbContext #1</b> (scoped, disposable) is created and recorded.");
        add({ id: 2, type: "AuditWriter", life: "transient", ifc: "IDisposable", why: "A disposable transient is tracked by the scope that created it." }, 2, "<b>AuditWriter #2</b> is transient and disposable: the scope records it too, so it will be disposed at the end of the request.");
        untracked.push({ id: 3, type: "OrderService", life: "scoped", why: "not disposable: nothing to record" });
        S(1, "<b>OrderService #3</b> is created last (its dependencies exist now). It is not disposable, so it is not recorded; the GC collects it.");
        S(3, "The request does its work.");
        if (disposeAll(sync ? 8 : 4, "The block ends and the scope is disposed.")) S(4, "Done: <b>reverse creation order</b>, so every object is disposed before the things it depends on. The singleton logger is untouched; the root disposes it at shutdown.");
      } else if (sc === 1) {
        S(1, "A console job resolves a <b>transient, disposable</b> <code>ReportWriter</code> straight from the <b>root</b> provider in a loop, with no scope.");
        for (let i = 1; i <= 3; i++) add({ id: i, type: "ReportWriter", life: "transient", ifc: "IDisposable" }, 1, `Job ${i}: <code>root.GetRequiredService&lt;ReportWriter&gt;()</code> creates #${i}. The job finishes with it, but the <b>root</b> recorded it and keeps a reference: the GC cannot collect it.`);
        stack.splice(0, 0, { id: "…", type: "9,996 more ReportWriters", life: "transient", ifc: "IDisposable", more: true });
        ev("bad", "after 10,000 jobs: 10,000 writers (and their file handles) held by the root");
        S(1, "<b>Leak.</b> After 10,000 jobs the root holds 10,000 writers and their file handles. Nothing is wrong with each object; the owner is wrong: the root only disposes at shutdown.");
        if (disposeAll(9, "Only at shutdown does the root dispose them.")) {
          ev("ok", "fix: one scope per job, so each writer is disposed when its job ends");
          S(0, "<b>Fix:</b> create a scope per unit of work (<code>await using var s = root.CreateAsyncScope()</code>) and resolve from it. Each writer is then disposed as soon as its job ends.");
        }
      } else if (sc === 2) {
        S(0, "Three singletons, registered three ways. The question is who <i>created</i> each object, because the container only disposes what it created.");
        add({ id: 1, type: "RedisCache", life: "singleton", ifc: "IDisposable", why: "Registered by type: the container constructed it, so it owns it." }, 1, "<code>AddSingleton&lt;ICache, RedisCache&gt;()</code>: the container constructs <b>#1</b> on first use and records it.");
        add({ id: 2, type: "ServiceBus", life: "singleton", ifc: "both", why: "Returned by a factory: the container called the factory, so it owns the result." }, 1, "<code>AddSingleton&lt;IBus&gt;(sp => new ServiceBus(...))</code>: the factory runs inside the container, so <b>#2</b> is recorded too.");
        untracked.push({ id: 3, type: "MetricsSink", life: "singleton", ifc: "IDisposable", why: "AddSingleton(instance): you created it, you dispose it" });
        ev("warn", "AddSingleton(new MetricsSink()) → not tracked");
        S(10, "<code>services.AddSingleton(new MetricsSink())</code>: <b>you</b> created #3 before the container existed. The container never records it.");
        if (disposeAll(sync ? 8 : 7, "Shutdown: the root disposes what it created.")) {
          ev("bad", "MetricsSink #3 is still open after shutdown");
          S(10, "Shutdown finished, but <b>MetricsSink #3 was never disposed</b>: its buffered metrics are never flushed. Dispose it yourself (for example in <code>IHostApplicationLifetime.ApplicationStopped</code>), or register it by type or factory so the container owns it.");
        }
      } else {
        S(0, "A request scope resolves an <code>Exporter</code> that implements <b>only</b> <code>IAsyncDisposable</code> (its cleanup flushes over the network), plus an AppDbContext.");
        add({ id: 1, type: "Exporter", life: "scoped", ifc: "IAsyncDisposable", why: "Its DisposeAsync flushes the export." }, 2, "<b>Exporter #1</b> is recorded.");
        add({ id: 2, type: "AppDbContext", life: "scoped", ifc: "both" }, 2, "<b>AppDbContext #2</b> is recorded.");
        if (disposeAll(sync ? 8 : 7, sync ? "The scope is disposed with a plain <code>using</code>." : "The scope is disposed with <code>await using</code>.")) S(4, "Both disposed. With <code>CreateAsyncScope()</code> and <code>await using</code>, async-only services are always safe. ASP.NET Core already disposes request scopes asynchronously.");
      }
      return fr;
    },
    render: (f) => {
      const item = (x) => `<div class="dil-si ${x.st || ""} ${x.more ? "more" : ""}"><span class="dil-id">#${esc(x.id)}</span><b>${esc(x.type)}</b><span class="dil-life ${x.life}">${x.life}</span><small>${esc(x.ifc || "")}</small><em>${x.st === "done" ? "disposed" : x.st === "bad" ? "threw" : x.st === "active" ? "now" : "live"}</em></div>`;
      const stack = `<div class="v-labeled"><span class="v-caption">${f.owner === "root" ? "root" : "scope"} disposables (newest on top)</span><div class="dil-stack">${f.stack.length ? [...f.stack].reverse().map(item).join("") : '<div class="dil-mute">empty</div>'}</div></div>`;
      const un = f.untracked.length ? `<div class="v-labeled"><span class="v-caption">not tracked by this ${f.owner === "root" ? "root" : "scope"}</span><div class="dil-untracked">${f.untracked.map((x) => `<div class="dil-ui"><span class="dil-id">#${esc(x.id)}</span><b>${esc(x.type)}</b><small>${esc(x.why)}</small></div>`).join("")}</div></div>` : "";
      return Viz.row(`<div class="dil-col">${stack}${un}</div>`, logList(f.log)) + (f.err ? `<div class="dil-err">${esc(f.err)}</div>` : "");
    },
  }));

  /* ---------- 5. Background work: one scope per unit of work ---------- */
  const BG = ["inject AppDbContext into the worker", "Task.Run with the request's DbContext", "IServiceScopeFactory: a scope per batch"];
  Viz.register("di-lifetimes-background", (host) => Viz.player(host, {
    title: "A BackgroundService needs a database: three attempts",
    tag: "BACKGROUND WORK · STEP THROUGH",
    legend: [["done", "fresh context, disposed on time"], ["bad", "captive / disposed too early"], ["path", "singleton (hosted service)"]],
    codeLang: "csharp",
    code: [
      "class OutboxWorker(IServiceScopeFactory scopes) : BackgroundService {",
      "  protected override async Task ExecuteAsync(CancellationToken ct) {",
      "    while (!ct.IsCancellationRequested) {",
      "      await using var scope = scopes.CreateAsyncScope();",
      "      var db = scope.ServiceProvider.GetRequiredService<AppDbContext>();",
      "      await PublishBatchAsync(db, ct);       // up to 50 messages",
      "    }                                        // scope disposed here",
      "  }",
      "}",
      "// wrong: class OutboxWorker(AppDbContext db) : BackgroundService",
      "// wrong: _ = Task.Run(() => db.SaveChangesAsync()); // request's db",
    ],
    inputs: [
      { key: "how", label: "approach", type: "select", options: BG, value: BG[0] },
      { key: "n", label: "batches", type: "select", options: ["4", "6"], value: "4" },
    ],
    random: () => ({ how: pick(BG), n: pick(["4", "6"]) }),
    build: ({ how, n }) => {
      const mode = BG.indexOf(how), N = Number(n);
      if (mode < 0 || !(N >= 1 && N <= 8)) throw new Error("Pick an approach and a batch count.");
      const fr = [], rows = [], log = [];
      const S = (line, note, extra = {}) => fr.push({ line, note, rows: rows.map((r) => ({ ...r })), log: log.map((e) => ({ ...e })), vars: { approach: ["captive", "Task.Run", "scope per batch"][mode], batches: rows.length, contexts: new Set(rows.map((r) => r.ctx)).size, "max tracked": Math.max(0, ...rows.map((r) => r.tracked)) }, ...extra });
      const ev = (c, t) => log.push({ c, t });
      if (mode === 0) {
        ev("bad", "Development: ValidateOnBuild rejects the worker");
        S(9, "Hosted services are registered as <b>singletons</b> (<code>IHostedService</code>), so injecting a scoped DbContext is a captive dependency. In Development, validation stops the app at startup.", { err: "Cannot consume scoped service 'AppDbContext' from singleton 'Microsoft.Extensions.Hosting.IHostedService'." });
        ev("warn", "Production (no validation): the worker starts with AppDbContext #1, owned by the root");
        S(9, "In Production nothing validates. The root builds the worker and one AppDbContext for it, which lives until shutdown.");
        for (let i = 1; i <= N; i++) {
          rows.push({ b: i, ctx: 1, tracked: 50 * i, st: "bad" });
          ev(i === N ? "bad" : "", `batch ${i}: context #1 now tracks ${50 * i} entities`);
          S(5, i === 1 ? "Batch 1 publishes 50 messages and marks them sent. The change tracker keeps all 50." : `Batch ${i}: the <b>same</b> context, ${50 * i} tracked entities. Every SaveChanges scans them all, so each batch is slower than the last. Rows changed by other instances come back stale, and one failed SaveChanges can leave the context in a bad state for every later batch.`);
        }
        return fr;
      }
      if (mode === 1) {
        rows.push({ b: "R1", ctx: 1, tracked: 1, st: "" });
        ev("", "request R1: scope R1 creates AppDbContext #1");
        S(10, "A controller wants to save an audit row <i>after</i> responding, so it starts a fire-and-forget task that captures the request's DbContext.");
        ev("warn", "controller returns 202; _ = Task.Run(() => db.SaveChangesAsync())");
        S(10, "The action returns immediately. The task holds a reference to AppDbContext #1, but it does not own it.");
        rows[0].st = "bad"; rows[0].disposed = true;
        ev("", "response sent → scope R1 disposed → AppDbContext #1 disposed");
        S(6, "The response is sent and the request scope is disposed, together with <b>AppDbContext #1</b>. The background task has not run yet.");
        ev("bad", "task runs: ObjectDisposedException");
        S(10, "<b>The task touches a disposed context.</b> It works on your machine (the task wins the race) and fails under load.", { err: "ObjectDisposedException: Cannot access a disposed context instance. A common cause of this error is disposing a context instance that was resolved from dependency injection and then later trying to use the same context instance elsewhere in your application." });
        ev("ok", "fix: enqueue a message (Channel<T>) and let a BackgroundService handle it in its own scope");
        S(3, "<b>Fix:</b> do not let work outlive the scope that owns its dependencies. Put the work on a queue (<code>Channel&lt;T&gt;</code>) and have a hosted service process it with <b>its own</b> scope, as in the third approach.");
        return fr;
      }
      ev("ok", "worker starts: it holds only IServiceScopeFactory (a singleton)");
      S(0, "The worker is a singleton that holds only <code>IServiceScopeFactory</code>, which is safe to keep forever.");
      for (let i = 1; i <= N; i++) {
        rows.push({ b: i, ctx: i, tracked: 50, st: "active" });
        ev("", `batch ${i}: CreateAsyncScope() → AppDbContext #${i}`);
        S(4, `Batch ${i}: a new scope, so a <b>fresh</b> AppDbContext #${i} with an empty change tracker. It publishes 50 messages.`);
        rows[i - 1].st = "done"; rows[i - 1].disposed = true;
        ev("ok", `batch ${i} done: scope disposed, AppDbContext #${i} disposed`);
        if (i <= 2 || i === N) S(6, i === N ? `Every batch had its own unit of work: memory flat at 50 tracked entities, no stale state carried over, and a failure in one batch cannot poison the next. This is the standard pattern for <code>BackgroundService</code>, queue consumers, timers and Quartz jobs.` : `End of the loop body: <code>await using</code> disposes the scope, and with it AppDbContext #${i}.`);
      }
      return fr;
    },
    render: (f) => {
      const max = Math.max(50, ...f.rows.map((r) => r.tracked));
      const rows = f.rows.map((r) => `<div class="dil-bar ${r.st}"><span>${typeof r.b === "number" ? `batch ${r.b}` : r.b} · ctx #${r.ctx}</span><i style="width:${Math.max(3, (r.tracked / max) * 100).toFixed(1)}%"></i><b>${r.tracked} tracked${r.disposed ? " · disposed" : ""}</b></div>`).join("");
      const bars = `<div class="v-labeled"><span class="v-caption">AppDbContext per unit of work</span><div class="dil-bars wide">${rows || '<div class="dil-mute">no batches yet</div>'}</div></div>`;
      return Viz.row(bars, logList(f.log)) + (f.err ? `<div class="dil-err">${esc(f.err)}</div>` : "");
    },
  }));})();
