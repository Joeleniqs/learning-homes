/* Visualizers for the "DI Fundamentals" topic. Every name is prefixed with the slug. */
(() => {
  const esc = Viz.esc;
  const LIFE_CLS = { singleton: "path", scoped: "visit", transient: "muted", "?": "bad" };

  /* ---------- Box graph: rounded-rect nodes, arrows clipped to the box border ---------- */
  const NODE_H = 46;
  const boxW = (title, sub) => Math.max(96, Math.ceil(Math.max(String(title).length * 7.4, String(sub || "").length * 6.3)) + 24);
  function boxGraph(nodes, edges, o = {}) {
    if (!nodes.length) return "";
    const H = o.h || NODE_H, by = new Map(nodes.map((n) => [n.k, n]));
    const all = o.bounds || nodes;
    const minX = Math.min(...all.map((n) => n.x - n.w / 2)) - 14, maxX = Math.max(...all.map((n) => n.x + n.w / 2)) + 14;
    const minY = Math.min(...all.map((n) => n.y - H / 2 - (n.top ? 20 : 0))) - 8, maxY = Math.max(...all.map((n) => n.y + H / 2)) + 14;
    const clip = (a, tx, ty) => {
      const dx = tx - a.x, dy = ty - a.y;
      if (!dx && !dy) return { x: a.x, y: a.y };
      const t = Math.min(dx ? (a.w / 2 + 3) / Math.abs(dx) : Infinity, dy ? (H / 2 + 3) / Math.abs(dy) : Infinity);
      return { x: a.x + dx * t, y: a.y + dy * t };
    };
    const es = edges.map((e) => {
      const a = by.get(e.u), b = by.get(e.v);
      if (!a || !b) return "";
      let d, fx, fy, tip;
      if (e.curve) {
        const mx = (a.x + b.x) / 2, my = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const off = typeof e.curve === "number" ? e.curve : 70;
        const cx = mx + (-(b.y - a.y) / len) * off, cy = my + ((b.x - a.x) / len) * off;
        const p1 = clip(a, cx, cy); tip = clip(b, cx, cy);
        d = `M${p1.x},${p1.y} Q${cx},${cy} ${tip.x},${tip.y}`; fx = cx; fy = cy;
      } else {
        const p1 = clip(a, b.x, b.y); tip = clip(b, a.x, a.y);
        d = `M${p1.x},${p1.y} L${tip.x},${tip.y}`; fx = p1.x; fy = p1.y;
      }
      const vx = tip.x - fx, vy = tip.y - fy, vl = Math.hypot(vx, vy) || 1, ux = vx / vl, uy = vy / vl;
      const head = `${tip.x},${tip.y} ${tip.x - ux * 10 - uy * 5},${tip.y - uy * 10 + ux * 5} ${tip.x - ux * 10 + uy * 5},${tip.y - uy * 10 - ux * 5}`;
      const lbl = e.label ? `<text class="gl" x="${(a.x + b.x) / 2 + (e.lx || 0)}" y="${(a.y + b.y) / 2 + (e.ly || 0)}" text-anchor="middle">${esc(e.label)}</text>` : "";
      return `<path class="ge ${e.cls || ""}" d="${d}"/><polygon class="gah ${e.cls || ""}" points="${head}"/>${lbl}`;
    }).join("");
    const ns = nodes.map((n) => {
      const sub = n.sub === undefined ? "" : `<text class="t2" y="13">${esc(n.sub)}${n.life ? `<tspan class="lt ${LIFE_CLS[n.life] || ""}">${esc(n.life)}</tspan>` : ""}</text>`;
      return `<g class="nb ${n.cls || ""}" transform="translate(${n.x},${n.y})"><rect x="${-n.w / 2}" y="${-H / 2}" width="${n.w}" height="${H}" rx="8"/>` +
        `<text class="t1" y="${n.sub === undefined ? 4 : -4}">${esc(n.title)}</text>${sub}` +
        `${n.top ? `<text class="t0" y="${-H / 2 - 8}">${esc(n.top)}</text>` : ""}</g>`;
    }).join("");
    const vw = maxX - minX, vh = maxY - minY;
    return `<svg class="dif-g" viewBox="${minX} ${minY} ${vw} ${vh}" width="${vw}" height="${vh}" role="img" aria-label="${esc(o.label || "object graph")}">${es}${ns}</svg>`;
  }

  /* Tidy forest layout with per-depth contours so variable-width boxes never overlap. */
  function layoutForest(roots, kids, widthOf, gap = 16, dy = 84) {
    const pos = new Map(), contour = [];
    const shift = (k, s) => { pos.get(k).x += s; kids(k).forEach((c) => shift(c, s)); };
    const extent = (k, acc) => { const p = pos.get(k); acc[p.d] = Math.max(acc[p.d] ?? -Infinity, p.x + p.w / 2); kids(k).forEach((c) => extent(c, acc)); return acc; };
    const place = (k, d) => {
      const w = widthOf(k), ch = kids(k);
      ch.forEach((c) => place(c, d + 1));
      let x;
      if (!ch.length) x = (contour[d] ?? 0) + w / 2;
      else {
        const xs = ch.map((c) => pos.get(c).x);
        x = (Math.min(...xs) + Math.max(...xs)) / 2;
        const left = contour[d] ?? 0;
        if (x - w / 2 < left) {
          pos.set(k, { x, y: d * dy, w, d });
          shift(k, left - (x - w / 2));
          extent(k, []).forEach((v, dd) => { contour[dd] = Math.max(contour[dd] ?? 0, v + gap); });
          return;
        }
      }
      pos.set(k, { x, y: d * dy, w, d });
      contour[d] = x + w / 2 + gap;
    };
    roots.forEach((r) => {
      place(r, 0);
      const m = Math.max(0, ...contour.filter((v) => v !== undefined));
      for (let i = 0; i < contour.length; i++) contour[i] = m + 26;
    });
    return pos;
  }

  /* ---------- Registration parsing (shared by the resolver) ---------- */
  const IDENT = /^[A-Za-z_]\w{0,23}$/;
  function parseRegs(text) {
    const parts = String(text).split(/[;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!parts.length) throw new Error("Add at least one registration, e.g. OrderService(ILogger)@scoped; ILogger=ConsoleLogger@singleton");
    if (parts.length > 9) throw new Error("Keep it to 9 registrations or fewer so the graph stays readable.");
    const regs = new Map();
    for (const p of parts) {
      const m = p.match(/^([A-Za-z_]\w*)\s*(?:=\s*([A-Za-z_]\w*))?\s*(?:\(([^)]*)\))?\s*(?:@\s*(\w+))?$/);
      if (!m) throw new Error(`Can't read “${p}”. Use Service=Impl(Dep1,Dep2)@lifetime (Impl, deps and lifetime are optional).`);
      const [, svc, impl, depStr, lifeRaw] = m;
      const life = (lifeRaw || "transient").toLowerCase();
      if (!["singleton", "scoped", "transient"].includes(life)) throw new Error(`“${lifeRaw}” is not a lifetime. Use singleton, scoped or transient.`);
      const deps = (depStr || "").split(",").map((s) => s.trim()).filter(Boolean);
      for (const x of [svc, impl || svc, ...deps]) if (!IDENT.test(x)) throw new Error(`“${x}” is not a valid type name (letters, digits, _; max 24 chars).`);
      if (deps.length > 4) throw new Error(`${impl || svc} has ${deps.length} constructor parameters; use at most 4 here.`);
      if (regs.has(svc)) throw new Error(`${svc} is registered twice. Keep one registration per service here.`);
      regs.set(svc, { svc, impl: impl || svc, deps, life });
    }
    return regs;
  }

  const PRESETS = {
    healthy: "OrderService(IOrderRepo,IPayments,ILogger)@scoped; IOrderRepo=SqlOrderRepo(IDbFactory,ILogger)@scoped; IPayments=StripePayments(HttpClient,ILogger)@transient; IDbFactory=SqlDbFactory(Settings)@singleton; HttpClient@singleton; ILogger=ConsoleLogger@singleton; Settings@singleton",
    cycle: "OrderService(IOrderRepo,ILogger)@scoped; IOrderRepo=SqlOrderRepo(IAuditLog,ILogger)@scoped; IAuditLog=DbAuditLog(IOrderRepo)@scoped; ILogger=ConsoleLogger@singleton",
    missing: "OrderService(IOrderRepo,IPayments,ILogger)@scoped; IOrderRepo=SqlOrderRepo(ILogger)@scoped; ILogger=ConsoleLogger@singleton",
    transient: "OrderService(IOrderRepo,IPayments,ILogger)@transient; IOrderRepo=SqlOrderRepo(ILogger)@transient; IPayments=StripePayments(ILogger)@transient; ILogger=ConsoleLogger@transient",
  };

  /* ---------- 1. Container resolution, recursive, with reuse and cycle detection ---------- */
  function simulateResolve(regs, root, runs) {
    const fr = [], meta = [], edges = [], lines = [], chain = [];
    const singles = new Map(), STOP = {};
    let scope = new Map(), run = 0, made = 0, reused = 0, err = null, cur = null, flash = null;
    const vname = (n) => n.impl[0].toLowerCase() + n.impl.slice(1) + n.id;
    const add = (svc, impl, life, parent, ghost) => { const n = { k: meta.length, svc, impl, life, parent, run, ghost, state: ghost ? "bad" : "pending", id: null }; meta.push(n); return n; };
    const snap = (line, note, x = {}) => fr.push({
      line, note, meta,
      ns: meta.map((n) => ({ state: n.state, id: n.id })),
      edges: edges.map((e) => ({ ...e })),
      chain: chain.map((c) => c.svc).concat(x.tail || []), chainBad: !!x.bad, chainK: chain.map((c) => c.k),
      lines: [...lines], newLine: !!x.newLine,
      singles: new Map([...singles].map(([s, k]) => [s, meta[k].id])),
      scoped: new Map([...scope].map(([s, k]) => [s, meta[k].id])),
      run, cur, flash, err, regs,
      vars: { resolving: cur ?? "·", "chain depth": chain.length, created: made, reused, "singleton cache": singles.size, [`scope ${run || 1} cache`]: scope.size },
    });
    const resolve = (svc, parentK, why) => {
      cur = svc; flash = null;
      const reg = regs.get(svc), parentImpl = parentK === null ? null : meta[parentK].impl;
      if (!reg) {
        const g = add(svc, svc, "?", parentK, "missing");
        if (parentK !== null) edges.push({ u: parentK, v: g.k, cls: "bad" });
        err = parentK === null
          ? `InvalidOperationException: No service for type '${svc}' has been registered.`
          : `InvalidOperationException: Unable to resolve service for type '${svc}' while attempting to activate '${parentImpl}'.`;
        snap(1, `${why}: <b>${esc(svc)}</b> has <b>no registration</b>. The container cannot invent an implementation, so resolution stops here. With <code>ValidateOnBuild</code> this exact error is raised at startup instead of on the first request.`, { tail: [svc], bad: true });
        throw STOP;
      }
      const at = chain.findIndex((c) => c.svc === svc);
      if (at >= 0) {
        edges.push({ u: parentK, v: chain[at].k, cls: "bad", curve: 80, label: "cycle!" });
        err = `InvalidOperationException: A circular dependency was detected for the service of type '${svc}'. ${chain.map((c) => c.svc).concat(svc).join(" -> ")}`;
        snap(2, `${why}: <b>${esc(svc)}</b> is <b>already on the resolve chain</b>. To build it we would first need ${esc(meta[parentK].impl)}, which needs ${esc(svc)}, which is still waiting for its own arguments. No construction order exists, so the container reports the cycle instead of recursing forever.`, { tail: [svc], bad: true });
        throw STOP;
      }
      const hitK = reg.life === "singleton" ? singles.get(svc) : reg.life === "scoped" ? scope.get(svc) : undefined;
      if (hitK !== undefined) {
        reused++;
        if (parentK !== null) edges.push({ u: parentK, v: hitK, cls: "visit", reuse: true });
        flash = hitK;
        snap(3, `${why}: <b>${esc(svc)}</b> is <b>${reg.life}</b> and is already cached ${reg.life === "singleton" ? "in the root (application-wide) cache" : `in request ${run}'s scope`}, so the container hands back <b>${esc(reg.impl)} #${meta[hitK].id}</b>. No constructor runs: this is what “shared” means.`, { tail: [svc] });
        return hitK;
      }
      const n = add(svc, reg.impl, reg.life, parentK, null);
      if (parentK !== null) edges.push({ u: parentK, v: n.k, cls: "" });
      chain.push({ svc, k: n.k });
      snap([4, 5], reg.deps.length
        ? `${why}: <b>${esc(svc)}</b> maps to <b>${esc(reg.impl)}</b> (${reg.life}, not cached yet). Its constructor needs <b>(${reg.deps.map(esc).join(", ")})</b>. It cannot be <code>new</code>-ed until every argument exists, so the container resolves each parameter first.`
        : `${why}: <b>${esc(svc)}</b> maps to <b>${esc(reg.impl)}</b> (${reg.life}). Its constructor takes no parameters: it is a <b>leaf</b>, so it can be created right away.`);
      const args = reg.deps.map((d, i) => resolve(d, n.k, `${reg.impl} parameter ${i + 1}/${reg.deps.length}`));
      cur = svc;
      n.state = "new"; n.id = ++made;
      lines.push(`var ${vname(n)} = new ${reg.impl}(${args.map((a) => vname(meta[a])).join(", ")});`);
      chain.pop();
      if (reg.life === "singleton") singles.set(svc, n.k); else if (reg.life === "scoped") scope.set(svc, n.k);
      flash = n.k;
      snap([6, 7, 8], `All ${reg.deps.length || "zero"} argument${reg.deps.length === 1 ? " is" : "s are"} ready, so <code>new ${esc(reg.impl)}(${args.map((a) => "#" + meta[a].id).join(", ")})</code> creates <b>#${n.id}</b>. ${reg.life === "transient" ? "Transient: never cached, the next request for it builds a new one." : reg.life === "singleton" ? "Singleton: stored in the root cache for the life of the app." : `Scoped: stored in request ${run}'s scope cache.`}`, { newLine: true });
      n.state = "done";
      return n.k;
    };
    for (let r = 1; r <= runs; r++) {
      run = r; scope = new Map(); cur = null; flash = null;
      lines.push(`// request ${r}${r === 1 ? ": the container's work, by hand" : ": a new scope"}`);
      snap(0, r === 1
        ? `Request 1 arrives. The framework opens a <b>scope</b> and asks it for <b>${esc(root)}</b>. The container knows only the registration table on the left; it discovers the graph by reading constructor parameters.`
        : `Request 2 arrives with a <b>fresh scope</b>. The scoped cache starts empty; the singleton cache still holds what request 1 built.`);
      try { resolve(root, null, `Request ${r} asks for it`); }
      catch (e) { if (e !== STOP) throw e; break; }
      cur = null; flash = null;
      snap(9, `Request ${r} has its <b>${esc(regs.get(root).impl)}</b>. ${made} instance${made === 1 ? "" : "s"} created and ${reused} reused so far. The order was forced by the constructors: <b>leaves first</b>, then each consumer as soon as its arguments exist.`);
    }
    return fr;
  }

  Viz.register("di-fundamentals-resolve", (host, opts) => {
    const order = ["healthy", "cycle", "missing", "transient"];
    let next = 1;
    const preset = PRESETS[opts.preset] ? opts.preset : "healthy";
    return Viz.player(host, {
      title: opts.title || "A container resolving OrderService, one constructor at a time",
      tag: "RECURSIVE RESOLUTION · STEP THROUGH",
      legend: [["active", "being resolved / just created"], ["done", "new instance"], ["visit", "reused (cached) instance"], ["bad", "error"], ["path", "singleton"]],
      codeLang: "csharp",
      code: [
        "object Resolve(Type t) {",
        "  var reg = registry[t] ?? throw NotRegistered(t, parent);",
        "  if (chain.Contains(t)) throw Circular(chain + t);",
        "  if (TryCached(reg, t, out var hit)) return hit; // reuse",
        "  chain.Push(t);",
        "  var args = reg.Impl.CtorParams.Select(Resolve); // recurse",
        "  var obj = Construct(reg.Impl, args); // leaves first",
        "  chain.Pop();",
        "  if (reg.Life != Transient) cache(reg)[t] = obj;",
        "  return obj;",
        "}",
      ],
      inputs: [
        { key: "regs", label: "registrations  (Service=Impl(Dep,Dep)@lifetime; …)", value: PRESETS[preset], width: 860 },
        { key: "root", label: "resolve", value: "OrderService", width: 140 },
        { key: "runs", label: "requests", type: "select", options: ["1 request", "2 requests (new scope each)"], value: opts.runs === 2 ? "2 requests (new scope each)" : "1 request" },
      ],
      random: () => { const p = order[next++ % order.length]; return { regs: PRESETS[p], root: "OrderService", runs: p === "healthy" || p === "transient" ? "2 requests (new scope each)" : "1 request" }; },
      build: ({ regs, root, runs }) => {
        const map = parseRegs(regs);
        const r = String(root).trim();
        if (!IDENT.test(r)) throw new Error("“resolve” must be a type name such as OrderService.");
        return simulateResolve(map, r, String(runs).startsWith("2") ? 2 : 1);
      },
      render: (f) => {
        const meta = f.meta;
        const kids = (k) => meta.filter((n) => n.parent === k).map((n) => n.k);
        const roots = meta.filter((n) => n.parent === null).map((n) => n.k);
        const sub = (n, st) => (n.ghost ? "not registered" : st.id ? `#${st.id} · ` : "resolving… · ");
        const pos = layoutForest(roots, kids, (k) => boxW(meta[k].impl, meta[k].ghost ? "not registered" : `resolving… · ${meta[k].life}`));
        const onChain = new Set(f.chainK);
        const box = (n, i) => {
          const st = f.ns[i], p = pos.get(n.k);
          const cls = n.ghost ? "bad" : st.state === "pending" ? "active pending" : st.state === "new" ? "active" : f.flash === n.k ? "visit" : n.life === "singleton" ? "done single" : "done";
          return { k: n.k, x: p.x, y: p.y, w: p.w, title: n.impl, sub: sub(n, st), life: n.ghost ? "" : n.life, cls, top: n.parent === null ? `request ${n.run}` : "" };
        };
        const allBoxes = meta.map((n) => { const p = pos.get(n.k); return { x: p.x, y: p.y, w: p.w, top: n.parent === null }; });
        const visible = meta.slice(0, f.ns.length).map((n, i) => box(n, i));
        const edges = f.edges.map((e) => ({ ...e, cls: e.cls || (onChain.has(e.v) ? "active" : ""), label: e.label || (e.reuse ? "" : "") }));
        const rows = [...f.regs.values()].map((r) => {
          const cached = r.life === "singleton" ? (f.singles.has(r.svc) ? `#${f.singles.get(r.svc)} (root)` : "—") : r.life === "scoped" ? (f.scoped.has(r.svc) ? `#${f.scoped.get(r.svc)} (scope ${f.run})` : "—") : "never cached";
          const rc = f.cur === r.svc ? (f.err ? "bad" : "active") : "";
          return `<div class="dif-tr ${rc}"><span>${esc(r.svc)}</span><span>${esc(r.impl)}</span><span class="dif-life ${r.life}">${r.life}</span><span class="${cached.startsWith("#") ? "dif-hit" : "dif-mute"}">${esc(cached)}</span></div>`;
        }).join("");
        const missingRow = f.err && f.cur && !f.regs.has(f.cur) ? `<div class="dif-tr bad"><span>${esc(f.cur)}</span><span>?</span><span class="dif-life">—</span><span>no registration</span></div>` : "";
        const table = `<div class="v-labeled"><span class="v-caption">registrations (the container's only knowledge)</span><div class="dif-tbl"><div class="dif-tr dif-th"><span>service</span><span>implementation</span><span>lifetime</span><span>cached instance</span></div>${rows}${missingRow}</div></div>`;
        const code = `<div class="v-labeled"><span class="v-caption">the same wiring written by hand (pure DI)</span><div class="dif-code">${f.lines.map((l, i) => `<div class="${l.startsWith("//") ? "c" : ""} ${f.newLine && i === f.lines.length - 1 ? "cur" : ""}">${esc(l)}</div>`).join("") || '<div class="c">// nothing created yet</div>'}</div></div>`;
        const chain = f.chain.length ? `<div class="dif-chain"><span class="v-caption">resolve chain (call stack)</span>${f.chain.map((s, i) => `<span class="dif-ci ${f.chainBad && (i === f.chain.length - 1 || s === f.chain[f.chain.length - 1]) ? "bad" : i === f.chain.length - 1 ? "active" : ""}">${esc(s)}</span>`).join('<span class="dif-arr">→</span>')}</div>` : `<div class="dif-chain"><span class="v-caption">resolve chain (call stack)</span><span class="dif-mute">empty</span></div>`;
        const err = f.err ? `<div class="dif-err">${esc(f.err)}</div>` : "";
        return Viz.row(table, code) + chain + (visible.length ? boxGraph(visible, edges, { bounds: allBoxes, label: "object graph being built" }) : "") + err;
      },
    });
  });

  /* ---------- 2. Seams: who receives each call when the test runs? ---------- */
  const SEAMS = {
    hard: {
      label: "hard-wired",
      who: "OrderService itself (new inside the constructor)",
      deps: {
        log: { impl: "FileLogger", how: 'new FileLogger(@"C:\\logs\\app.log")', ms: 3, fx: "line appended to C:\\logs\\app.log", c: "bad" },
        pay: { impl: "StripeGateway", how: "new StripeGateway(new HttpClient())", ms: 420, fx: "HTTPS to api.stripe.com: a real charge", c: "bad" },
        clock: { impl: "DateTime.UtcNow", how: "static call, cannot be swapped", ms: 0, fx: "wall-clock time: different every run", c: "bad" },
        repo: { impl: "SqlOrderRepository", how: 'new SqlOrderRepository("Server=prod-db;…")', ms: 38, fx: "INSERT into the shared database", c: "bad" },
      },
    },
    prod: {
      label: "injected (production)",
      who: "the composition root (Program.cs)",
      deps: {
        log: { impl: "FileLogger", how: "chosen in Program.cs", ms: 3, fx: "line appended to the app log", c: "done" },
        pay: { impl: "StripeGateway", how: "chosen in Program.cs", ms: 420, fx: "HTTPS to api.stripe.com (intended)", c: "done" },
        clock: { impl: "SystemClock", how: "chosen in Program.cs", ms: 0, fx: "wall-clock time (intended)", c: "done" },
        repo: { impl: "SqlOrderRepository", how: "chosen in Program.cs", ms: 38, fx: "INSERT into the orders table (intended)", c: "done" },
      },
    },
    fake: {
      label: "injected (test fakes)",
      who: "the test (passes fakes to the constructor)",
      deps: {
        log: { impl: "ListLogger", how: "new ListLogger()", ms: 0.01, fx: "appended to an in-memory list", c: "done" },
        pay: { impl: "FakePaymentGateway", how: "new FakePaymentGateway(approve: ?)", ms: 0.01, fx: "recorded Charge(59.90); scripted reply", c: "done" },
        clock: { impl: "FixedClock", how: "new FixedClock(2026-01-01T09:00Z)", ms: 0, fx: "always 2026-01-01T09:00Z", c: "done" },
        repo: { impl: "InMemoryOrderRepository", how: "new InMemoryOrderRepository()", ms: 0.01, fx: "added to a List<Order>", c: "done" },
      },
    },
  };
  const SEAM_KEYS = { "hard-wired, run by a unit test": "hard", "injected, production composition root": "prod", "injected, unit test with fakes": "fake" };

  Viz.register("di-fundamentals-seams", (host) => Viz.player(host, {
    title: "Same method, three wirings: who handles each call?",
    tag: "SEAMS · STEP THROUGH",
    legend: [["active", "current call"], ["done", "controlled / intended effect"], ["bad", "uncontrolled side effect"], ["visit", "chosen by"]],
    codeLang: "csharp",
    code: [
      "public Receipt PlaceOrder(Order order) {",
      "  _log.Info($\"placing {order.Id}\");",
      "  var charge = _payments.Charge(order.Total);",
      "  if (!charge.Approved) return Receipt.Declined(order.Id);",
      "  order.PlacedAt = _clock.UtcNow;",
      "  _repo.Save(order);",
      "  _log.Info($\"placed {order.Id}\");",
      "  return Receipt.Ok(order.Id, charge.Id);",
      "}",
    ],
    inputs: [
      { key: "wiring", label: "wiring", type: "select", options: Object.keys(SEAM_KEYS), value: "hard-wired, run by a unit test" },
      { key: "card", label: "the test wants to check", type: "select", options: ["approved card", "declined card"], value: "approved card" },
    ],
    random: () => ({ wiring: Object.keys(SEAM_KEYS)[Viz.rand(0, 2)], card: Viz.rand(0, 1) ? "declined card" : "approved card" }),
    build: ({ wiring, card }) => {
      const key = SEAM_KEYS[wiring];
      if (!key) throw new Error("Pick a wiring from the list.");
      const W = SEAMS[key], wantDecline = card === "declined card";
      const approved = key === "hard" ? true : !wantDecline;
      const fr = [], calls = [];
      let total = 0;
      const vars = () => ({ wiring: W.label, "elapsed ms": +total.toFixed(2), calls: calls.length, "side effects": calls.filter((c) => c.c === "bad").length });
      const call = (line, dep, what, note, extra = {}) => {
        const d = W.deps[dep];
        total += d.ms;
        calls.push({ what, impl: d.impl, ms: d.ms, fx: extra.fx || d.fx, c: d.c });
        fr.push({ key, line, calls: calls.map((c) => ({ ...c })), cur: calls.length - 1, note, vars: vars() });
      };
      fr.push({ key, line: 0, calls: [], cur: -1, vars: vars(), note: key === "hard"
        ? "OrderService's constructor runs <code>new</code> for each collaborator. The test can call <code>PlaceOrder</code>, but it has <b>no say</b> in what the four fields point at."
        : key === "prod" ? "The constructor only <b>receives</b> its four collaborators. Program.cs (the composition root) chose the real ones. The method body is byte-for-byte the same as the hard-wired version."
          : "The test constructed OrderService itself and passed in <b>fakes</b>. The method body did not change; only <b>who decided</b> changed." });
      call(1, "log", "_log.Info(\"placing 42\")", key === "hard" ? "The first line already touches the disk of whatever machine runs the test." : "Logging goes wherever the composition root pointed it.");
      call(2, "pay", "_payments.Charge(59.90)", key === "hard"
        ? `A real HTTPS call: about 420 ms, needs network and credentials, and <b>moves real money</b>.${wantDecline ? " The test wanted a decline but cannot script one: the real sandbox card is approved." : ""}`
        : key === "prod" ? `Production does want the real gateway. The card is ${approved ? "approved" : "declined"}.` : `The fake returns exactly what the test scripted: <b>${approved ? "approved" : "declined"}</b>, instantly.`,
        { fx: (W.deps.pay.fx) + (approved ? " → approved" : " → declined") });
      if (!approved) {
        fr.push({ key, line: 3, calls: calls.map((c) => ({ ...c })), cur: -1, vars: vars(), note: "Declined: the method returns early. Nothing is saved; the branch is exercised." });
      } else {
        call(4, "clock", "_clock.UtcNow", key === "hard" ? "<code>DateTime.UtcNow</code> is a static call, the least visible dependency of all. The test cannot assert an exact <code>PlacedAt</code>." : key === "fake" ? "The fixed clock makes <code>PlacedAt</code> exactly 2026-01-01T09:00Z, so the test can assert it." : "Real time, as production wants.");
        call(5, "repo", "_repo.Save(order)", key === "hard" ? "A row lands in a shared database. Run the test twice and you get two orders; run two builds in parallel and they collide." : key === "fake" ? "Saved into a list the test can inspect afterwards." : "Saved to the real database, as intended.");
        call(6, "log", "_log.Info(\"placed 42\")", "Second log line.");
      }
      const verdict = key === "hard"
        ? wantDecline
          ? { c: "bad", t: `TEST FAILS: expected Receipt.Declined, got Receipt.Ok. The declined branch is unreachable because the test cannot choose the gateway. Meanwhile it spent ${total.toFixed(0)} ms and charged a real card.` }
          : { c: "warn", t: `Test passes in ${total.toFixed(0)} ms, but it charged a card, wrote to the shared database and the log disk, and cannot assert PlacedAt. Without network (CI) it fails. This is an integration test pretending to be a unit test.` }
        : key === "prod"
          ? { c: "ok", t: `Production run: ${total.toFixed(0)} ms, all effects intended. DI added zero runtime cost: the same objects as hard-wiring, just chosen in one place.` }
          : { c: "ok", t: wantDecline ? `TEST PASSES in ${total.toFixed(2)} ms: Receipt.Declined, nothing saved, Charge called once with 59.90. Deterministic, no network, no disk.` : `TEST PASSES in ${total.toFixed(2)} ms: Receipt.Ok, one order saved with PlacedAt == 2026-01-01T09:00Z, Charge called once with 59.90. Deterministic, no side effects.` };
      fr.push({ key, line: approved ? 7 : 3, calls: calls.map((c) => ({ ...c })), cur: -1, verdict, vars: vars(), note: `<b>Outcome.</b> ${esc(verdict.t)}` });
      return fr;
    },
    render: (f) => {
      const W = SEAMS[f.key];
      const fields = [["_log", "log"], ["_payments", "pay"], ["_clock", "clock"], ["_repo", "repo"]].map(([fld, d]) => {
        const x = W.deps[d];
        return `<div class="dif-field ${x.c}"><code>${fld}</code><span class="dif-arr">→</span><b>${esc(x.impl)}</b><small>${esc(x.how)}</small></div>`;
      }).join("");
      const card = `<div class="v-labeled"><span class="v-caption">OrderService's collaborators</span><div class="dif-card"><div class="dif-who">chosen by: <b>${esc(W.who)}</b></div>${fields}</div></div>`;
      const rows = f.calls.map((c, i) => `<div class="dif-tr ${i === f.cur ? "active" : ""}"><span>${i + 1}</span><span><code>${esc(c.what)}</code></span><span>${esc(c.impl)}</span><span>${c.ms} ms</span><span class="dif-fx ${c.c}">${esc(c.fx)}</span></div>`).join("");
      const log = `<div class="v-labeled"><span class="v-caption">calls made while PlaceOrder runs</span><div class="dif-tbl dif-calls"><div class="dif-tr dif-th"><span>#</span><span>call</span><span>handled by</span><span>time</span><span>effect in the world</span></div>${rows || '<div class="dif-tr"><span></span><span class="dif-mute">no calls yet</span></div>'}</div></div>`;
      const v = f.verdict ? `<div class="dif-verdict ${f.verdict.c}">${esc(f.verdict.t)}</div>` : "";
      return Viz.row(card, log) + v;
    },
  }));

  /* ---------- 3. Constructor vs property vs method injection ---------- */
  Viz.register("di-fundamentals-styles", (host) => Viz.player(host, {
    title: "Constructor, property and method injection: when is the object valid?",
    tag: "INJECTION STYLES · STEP THROUGH",
    legend: [["done", "valid / succeeded"], ["bad", "invalid / failed"], ["active", "current statement"], ["visit", "per-call dependency"]],
    codeLang: "csharp",
    code: [
      "// constructor injection",
      "var a = new ReportService(clock, store);",
      "a.Generate(request);",
      "// property (setter) injection",
      "var b = new ReportService();",
      "b.Clock = clock;",
      "b.Store = store;",
      "b.Generate(request);",
      "// method injection: varies per call",
      "var c = new ReportService(clock, store);",
      "c.Generate(request, new CsvFormatter());",
      "c.Generate(request, new PdfFormatter());",
    ],
    inputs: [
      { key: "style", label: "style", type: "select", options: ["constructor", "property", "method"], value: "property" },
      { key: "mistake", label: "what happens", type: "select", options: ["everything wired", "caller forgets the store", "dependency swapped later"], value: "caller forgets the store" },
    ],
    random: () => ({ style: ["constructor", "property", "method"][Viz.rand(0, 2)], mistake: ["everything wired", "caller forgets the store", "dependency swapped later"][Viz.rand(0, 2)] }),
    build: ({ style, mistake }) => {
      if (!["constructor", "property", "method"].includes(style)) throw new Error("Pick a style.");
      const fr = [], steps = [];
      const obj = { Clock: null, Store: null };
      const forget = mistake === "caller forgets the store", swap = mistake === "dependency swapped later";
      const valid = () => !!(obj.Clock && obj.Store);
      const push = (line, label, ok, note, x = {}) => {
        steps.push({ label, c: ok === true ? "done" : ok === false ? "bad" : "warn" });
        fr.push({ line, obj: { ...obj }, valid: valid(), steps: steps.map((s) => ({ ...s })), fmt: x.fmt || null, err: x.err || null, note, vars: { style, Clock: obj.Clock || "null", Store: obj.Store || "null", valid: valid(), ...(x.fmt ? { formatter: x.fmt } : {}) } });
      };
      if (style === "constructor") {
        if (forget) {
          push(1, "new ReportService(clock)", false, "The caller forgot <code>store</code>. This <b>does not compile</b>: the constructor demands both. No half-built object can ever exist, and the mistake costs seconds at your desk, not an incident.", { err: "error CS7036: There is no argument given that corresponds to the required parameter 'store' of 'ReportService(IClock, IReportStore)'" });
          return fr;
        }
        obj.Clock = "SystemClock"; obj.Store = "BlobReportStore";
        push(1, "new (clock, store)", true, "Both dependencies arrive in the constructor and are stored in <code>readonly</code> fields. The object is <b>valid from birth</b>; there is no moment when it is half-initialised.");
        push(2, "Generate()", true, "Generate runs with both collaborators present. Nothing to check, nothing to forget.");
        if (swap) push(2, "a.Clock = fake", false, "Someone tries to swap the clock after construction. <b>Compile error</b>: there is no setter and the field is readonly. Immutability makes the object safe to share between threads.", { err: "error CS0200: Property or indexer 'ReportService.Clock' cannot be assigned to -- it is read only" });
        else push(2, "done", true, "Constructor injection: dependencies are <b>explicit</b> (in the signature), <b>required</b> (compiler-checked) and <b>immutable</b>. Default to it.");
        return fr;
      }
      if (style === "property") {
        push(4, "new ()", false, "<code>new ReportService()</code> compiles and runs. The object exists but both properties are <b>null</b>: it is <b>invalid</b>, and nothing in the type system says so.");
        obj.Clock = "SystemClock";
        push(5, "Clock = clock", false, "Clock is set. Still invalid: Store is null. This window between construction and the last setter is called <b>temporal coupling</b>: statements must run in an order nobody enforces.");
        if (forget) {
          push(7, "Generate()", false, "The caller forgot <code>b.Store = store</code>. It compiled. It even passed the tests that never call Generate. Now it fails at <b>runtime</b>, in production, possibly after the clock was read and a partial report was built.", { err: "System.NullReferenceException: Object reference not set to an instance of an object.\n   at ReportService.Generate(ReportRequest r) in ReportService.cs:line 18" });
          return fr;
        }
        obj.Store = "BlobReportStore";
        push(6, "Store = store", true, "Now valid, two statements after it started existing.");
        push(7, "Generate()", true, "Works, because this caller remembered both setters in the right order.");
        if (swap) {
          obj.Clock = "FakeClock";
          push(7, "Clock = other", false, "Some other code holding the same instance sets <code>b.Clock</code> to a different clock. Every later call (on every thread sharing it) silently changes behaviour. Public setters make the dependency <b>mutable shared state</b>.");
        } else push(7, "done", null, "Property injection is legitimate only for <b>optional</b> dependencies with a safe default (for example a <code>NullLogger</code>), or when a framework instantiates the object for you.");
        return fr;
      }
      obj.Clock = "SystemClock"; obj.Store = "BlobReportStore";
      push(9, "new (clock, store)", true, "Stable collaborators (clock, store) still come through the constructor. The <b>formatter</b> is different: it is chosen by each caller, per call.");
      if (forget) {
        push(10, "Generate(request)", false, "The caller omitted the per-call dependency. <b>Compile error</b> at the call site: method injection is as explicit as constructor injection, just scoped to one call.", { err: "error CS7036: There is no argument given that corresponds to the required parameter 'formatter' of 'ReportService.Generate(ReportRequest, IFormatter)'" });
        return fr;
      }
      push(10, "Generate(csv)", true, "The CSV formatter is used for this call only and is not stored. The object stays stateless and thread-safe.", { fmt: "CsvFormatter" });
      push(11, "Generate(pdf)", true, "A different formatter for the next call. If the formatter were a field, the object would remember the last caller's choice: a classic shared-state bug.", { fmt: "PdfFormatter" });
      push(11, "done", true, swap ? "Nothing to swap: each call brings its own formatter, so there is no stored state to corrupt. Typical method-injected things: a formatter or strategy, a CancellationToken, an ASP.NET Core <code>[FromServices]</code> action parameter." : "Use method injection when the dependency <b>varies per call</b> or is only needed by one rarely used method.");
      return fr;
    },
    render: (f) => {
      const fld = (name, v) => `<div class="dif-field ${v ? "done" : "bad"}"><code>${name}</code><span class="dif-arr">→</span><b>${esc(v || "null")}</b></div>`;
      const card = `<div class="v-labeled"><span class="v-caption">the ReportService instance</span><div class="dif-card"><div class="dif-who">state: <b class="${f.valid ? "dif-ok" : "dif-bad"}">${f.valid ? "valid" : "INVALID (half-built)"}</b></div>${fld("Clock", f.obj.Clock)}${fld("Store", f.obj.Store)}${f.fmt ? `<div class="dif-field visit"><code>formatter</code><span class="dif-arr">→</span><b>${esc(f.fmt)}</b><small>argument of this call only</small></div>` : ""}</div></div>`;
      const strip = `<div class="v-labeled"><span class="v-caption">statements so far</span><div class="dif-steps">${f.steps.map((s, i) => `<span class="dif-step ${s.c} ${i === f.steps.length - 1 ? "cur" : ""}">${esc(s.label)}</span>`).join('<span class="dif-arr">→</span>')}</div></div>`;
      const err = f.err ? `<div class="dif-err">${esc(f.err).replace(/\n/g, "<br>")}</div>` : "";
      return Viz.row(card, strip) + err;
    },
  }));

  /* ---------- 4. Service locator vs dependency injection ---------- */
  Viz.register("di-fundamentals-locator", (host) => Viz.player(host, {
    title: "Service locator vs constructor injection: when do you find out?",
    tag: "COMPARE · STEP THROUGH",
    legend: [["done", "fine"], ["bad", "failure"], ["active", "warning / hidden cost"]],
    codeLang: "csharp",
    code: [
      "// A: service locator (dependencies hidden in method bodies)",
      "class OrderService(IServiceProvider sp) {",
      "  public void PlaceOrder(Order o) {",
      "    sp.GetRequiredService<IPaymentGateway>().Charge(o.Total);",
      "    sp.GetRequiredService<IOrderRepository>().Save(o);",
      "    sp.GetRequiredService<IEmailSender>().Confirm(o);",
      "} }",
      "// B: constructor injection (dependencies in the signature)",
      "class OrderService(IPaymentGateway pay, IOrderRepository repo,",
      "                   IEmailSender mail) {",
      "  public void PlaceOrder(Order o) {",
      "    pay.Charge(o.Total); repo.Save(o); mail.Confirm(o);",
      "} }",
    ],
    inputs: [{ key: "missing", label: "forgotten registration", type: "select", options: ["none", "IEmailSender", "IPaymentGateway"], value: "IEmailSender" }],
    random: () => ({ missing: ["none", "IEmailSender", "IPaymentGateway"][Viz.rand(0, 2)] }),
    build: ({ missing }) => {
      if (!["none", "IEmailSender", "IPaymentGateway"].includes(missing)) throw new Error("Pick an option from the list.");
      const deps = ["IPaymentGateway", "IOrderRepository", "IEmailSender"];
      const has = (d) => d !== missing;
      const L = [], D = [], fr = [];
      const snap = (line, phase, note) => fr.push({ line, phase, L: L.map((x) => ({ ...x })), D: D.map((x) => ({ ...x })), note, vars: { missing, "locator events": L.length, "DI events": D.length } });
      L.push({ p: "read the class", c: "warn", t: "Constructor: (IServiceProvider sp). What does it need? Read every method body to find out." });
      D.push({ p: "read the class", c: "ok", t: "Constructor: (IPaymentGateway, IOrderRepository, IEmailSender). The signature is the complete list." });
      snap([1, 8, 9], "read", "Start where a reviewer starts: the constructor. The locator version <b>lies by omission</b>: it claims to need one thing (the container) but really needs three.");
      L.push({ p: "startup (ValidateOnBuild)", c: "warn", t: "Validation sees IServiceProvider, which always resolves. Startup succeeds" + (missing !== "none" ? `, even though ${missing} is not registered.` : ".") });
      if (missing === "none") D.push({ p: "startup (ValidateOnBuild)", c: "ok", t: "Every constructor parameter resolves. Startup succeeds." });
      else D.push({ p: "startup (ValidateOnBuild)", c: "bad", t: `Startup FAILS: Unable to resolve service for type '${missing}' while attempting to activate 'OrderService'. The deploy is blocked; no customer sees it.` });
      snap([1, 8], "startup", missing === "none" ? "Both start. The container can only validate what it can <b>see</b>: constructor parameters." : `The container walks constructors at startup. DI fails <b>fast and loud</b>; the locator's dependencies are invisible, so the gap ships.`);
      if (missing !== "none") D.push({ p: "first request", c: "ok", t: "Never reached in production: fixed before release." });
      else D.push({ p: "first request", c: "ok", t: "Charge, Save, Confirm. Order placed." });
      let failed = false;
      for (let i = 0; i < 3 && !failed; i++) {
        const d = deps[i];
        if (!has(d)) {
          failed = true;
          L.push({ p: "first request", c: "bad", t: `GetRequiredService<${d}>() throws: No service for type '${d}' has been registered.` + (i > 0 ? " The card was ALREADY charged and the order saved: partial work, a 500 for the customer, and a retry that charges again." : " Request fails with a 500.") });
        } else L.push({ p: "first request", c: "ok", t: [`Charge(59.90) succeeded: money moved.`, `Save(order) succeeded.`, `Confirm(order) sent the email.`][i] });
      }
      snap([3, 4, 5], "request", missing === "none" ? "With nothing missing both behave the same at runtime: the locator's problems are about <b>visibility</b> and <b>testability</b>." : `The locator discovers the gap <b>in the middle of a request</b>${missing === "IEmailSender" ? ", after irreversible side effects" : ""}. This is the 2 a.m. page.`);
      L.push({ p: "unit test", c: "warn", t: "Build a ServiceCollection, read PlaceOrder's body to guess what to register, register fakes, BuildServiceProvider(). Forget one and the test fails at runtime." });
      D.push({ p: "unit test", c: "ok", t: "new OrderService(fakePay, fakeRepo, fakeMail). Forget one and the compiler refuses. No container in the test at all." });
      snap([1, 8, 11], "test", "Testing exposes the difference most clearly: with DI, <b>the compiler enumerates the dependencies for you</b>. A service locator is still IoC, but it is <b>pull</b>, not push.");
      return fr;
    },
    render: (f) => {
      const col = (title, cls, items) => `<div class="dif-lane ${cls}"><div class="dif-lane-h">${title}</div>${items.map((x, i) => `<div class="dif-ev ${x.c} ${i === items.length - 1 ? "cur" : ""}"><small>${esc(x.p)}</small>${esc(x.t)}</div>`).join("")}</div>`;
      return `<div class="dif-lanes">${col("A · Service locator (pull)", "bad", f.L)}${col("B · Constructor injection (push)", "ok", f.D)}</div>`;
    },
  }));

  /* ---------- 5. The ripple: what changes when a constructor grows ---------- */
  const RIP_CLASSES = {
    OrdersController: { deps: ["OrderService"], x: 150, y: 0 },
    ReportsController: { deps: ["ReportService"], x: 470, y: 0 },
    OrderService: { deps: ["SqlOrderRepo", "StripePayments", "ConsoleLogger"], x: 150, y: 96 },
    ReportService: { deps: ["SqlOrderRepo", "ConsoleLogger"], x: 470, y: 96 },
    SqlOrderRepo: { deps: ["ConsoleLogger"], x: 300, y: 192 },
    StripePayments: { deps: ["ConsoleLogger"], x: 70, y: 192 },
    ConsoleLogger: { deps: [], x: 300, y: 288 },
  };
  Viz.register("di-fundamentals-ripple", (host) => Viz.player(host, {
    title: "A constructor gains a parameter: how many places must change?",
    tag: "COMPOSITION ROOT · STEP THROUGH",
    legend: [["active", "the class that changed"], ["bad", "must be edited"], ["done", "composition root edit"], ["path", "duplicate instances"]],
    codeLang: "csharp",
    code: [
      "// the change: the selected class X now needs IMetrics",
      "public X(/* existing deps */, IMetrics metrics) { … }",
      "// hard-wired: every class that says `new X(…)` is edited",
      "// pure DI: Program.cs is the only place that calls new",
      "var metrics = new PrometheusMetrics();",
      "var x = new X(/* existing deps */, metrics);",
      "// container: one registration, zero call-site edits",
      "services.AddSingleton<IMetrics, PrometheusMetrics>();",
    ],
    inputs: [
      { key: "changed", label: "class whose constructor grows", type: "select", options: ["SqlOrderRepo", "ConsoleLogger", "StripePayments", "OrderService"], value: "ConsoleLogger" },
      { key: "wiring", label: "wiring", type: "select", options: ["hard-wired (new inside)", "pure DI (composition root)", "container"], value: "hard-wired (new inside)" },
    ],
    random: () => ({ changed: ["SqlOrderRepo", "ConsoleLogger", "StripePayments", "OrderService"][Viz.rand(0, 3)], wiring: ["hard-wired (new inside)", "pure DI (composition root)", "container"][Viz.rand(0, 2)] }),
    build: ({ changed, wiring }) => {
      if (!RIP_CLASSES[changed]) throw new Error("Pick a class from the list.");
      const consumers = (c) => Object.keys(RIP_CLASSES).filter((k) => RIP_CLASSES[k].deps.includes(c));
      // hard-wired: each consumer instance creates its own copy -> count instances per class (one root per controller)
      const copies = {};
      const count = (c) => { copies[c] = (copies[c] || 0) + 1; RIP_CLASSES[c].deps.forEach(count); };
      ["OrdersController", "ReportsController"].forEach(count);
      const fr = [], hard = wiring.startsWith("hard"), pure = wiring.startsWith("pure");
      const edits = [];
      const snap = (line, note, x = {}) => fr.push({ changed, hard, pure, edits: [...edits], root: !!x.root, copies: hard ? copies : null, line, note, vars: { "files edited": edits.length + (x.root ? 1 : 0), [`${changed} instances`]: hard ? copies[changed] : 1 } });
      snap([0, 1], `<b>${changed}</b>'s constructor gains a parameter (<code>IMetrics</code>). That edit is unavoidable. The question is how far it <b>ripples</b>.`);
      if (hard) {
        const sites = consumers(changed);
        if (!sites.length) { snap(2, `${changed} is created by the framework (a controller), so no class news it. The cost shows up one level down instead.`); }
        sites.forEach((s) => { edits.push(s); snap(2, `<b>${s}</b> contains <code>new ${changed}(…)</code>. It must be edited, and it must now obtain an <code>IMetrics</code>: either <code>new</code> one (another hard-wire, another copy) or take it as a constructor parameter, which ripples further up.`); });
        snap(2, `Total: <b>${sites.length}</b> call site${sites.length === 1 ? "" : "s"} edited, and because each consumer builds its own, there are <b>${copies[changed]}</b> separate ${changed} instance${copies[changed] === 1 ? "" : "s"} at runtime (ConsoleLogger alone exists ${copies.ConsoleLogger}×). Hard-wiring also makes sharing impossible.`);
      } else if (pure) {
        snap([3, 4, 5], `With pure DI, <b>no class</b> calls <code>new</code> on its collaborators. The only place that does is the composition root, so that is the only other edit: two lines in Program.cs. The compiler points at it.`, { root: true });
        snap([3, 4, 5], `Total: 1 file besides ${changed} itself, and still exactly <b>one</b> ${changed} instance shared by everyone who needs it.`, { root: true });
      } else {
        snap([6, 7], `With a container, constructors are read by reflection at runtime. Register <code>IMetrics</code> once; every consumer of ${changed} is untouched. If you forget, <code>ValidateOnBuild</code> fails at startup.`, { root: true });
        snap([6, 7], `Total: one registration line. The trade: the error moves from compile time (pure DI) to startup time (container). Both are far better than hard-wiring.`, { root: true });
      }
      return fr;
    },
    render: (f) => {
      const nodes = Object.entries(RIP_CLASSES).map(([k, v]) => {
        const sub = f.hard ? `${f.copies[k]} instance${f.copies[k] === 1 ? "" : "s"}` : "1 instance";
        const cls = k === f.changed ? "active" : f.edits.includes(k) ? "bad" : f.hard && f.copies[k] > 1 ? "path" : "";
        return { k, x: v.x, y: v.y, w: boxW(k, sub), title: k, sub, cls };
      });
      if (!f.hard) nodes.push({ k: "root", x: 610, y: 288, w: 176, title: "Program.cs", sub: f.pure ? "composition root" : "registrations", cls: f.root ? "done" : "" });
      const edges = [];
      Object.entries(RIP_CLASSES).forEach(([k, v]) => v.deps.forEach((d) => edges.push({ u: k, v: d, cls: f.hard && f.edits.includes(k) && d === f.changed ? "bad" : "" })));
      return boxGraph(nodes, edges, { label: "class dependency graph" }) +
        `<div class="dif-note">${f.hard ? "Arrows = “news up”. Every arrow is a hard-coded <code>new</code> inside the consumer." : "Arrows = “receives in its constructor”. Only Program.cs calls <code>new</code>."}</div>`;
    },
  }));
})();
