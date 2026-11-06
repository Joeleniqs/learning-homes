/* Visualizers for "The Request Delegate Pipeline". Every frame is produced by running a small simulation. */
(() => {
  const esc = Viz.esc;

  /* ---------- shared rendering helpers (classes styled in assets/topics/request-pipeline.css) ---------- */
  const panel = (title, inner, cls = "") => `<div class="rp-panel ${cls}"><div class="rp-ptitle">${esc(title)}</div>${inner}</div>`;
  const kv = (rows) => `<div class="rp-kv">${rows.map(([k, v, c]) => `<span>${esc(k)}</span><span class="${c || ""}">${v}</span>`).join("")}</div>`;
  const code = (s) => `<code>${esc(s)}</code>`;
  const chip = (txt, cls = "") => `<span class="rp-chip ${cls}">${txt}</span>`;

  /* Box-and-arrow SVG. nodes: {id,x,y,w,h,label,sub,cls}; edges: {from,to,fs,ts,via,label,lx,ly,cls} */
  function flow(nodes, edges, o = {}) {
    const by = Object.fromEntries(nodes.map((n) => [n.id, n]));
    const anchor = (n, s) => ({ l: [n.x, n.y + n.h / 2], r: [n.x + n.w, n.y + n.h / 2], t: [n.x + n.w / 2, n.y], b: [n.x + n.w / 2, n.y + n.h] })[s];
    const es = edges.map((e) => {
      const a = by[e.from], b = by[e.to];
      if (!a || !b) return "";
      const pts = [anchor(a, e.fs || "r"), ...(e.via || []), anchor(b, e.ts || "l")];
      const [ex, ey] = pts[pts.length - 1], [px, py] = pts[pts.length - 2];
      const len = Math.hypot(ex - px, ey - py) || 1, ux = (ex - px) / len, uy = (ey - py) / len;
      const head = `${ex},${ey} ${ex - ux * 9 - uy * 4.5},${ey - uy * 9 + ux * 4.5} ${ex - ux * 9 + uy * 4.5},${ey - uy * 9 - ux * 4.5}`;
      const d = "M" + pts.map((p, i) => (i === pts.length - 1 ? [p[0] - ux * 8, p[1] - uy * 8] : p).join(",")).join(" L");
      const lab = e.label ? `<text class="el" x="${e.lx ?? (pts[0][0] + pts[1][0]) / 2}" y="${e.ly ?? (pts[0][1] + pts[1][1]) / 2 - 5}" text-anchor="middle">${esc(e.label)}</text>` : "";
      return `<g class="ed ${e.cls || ""}"><path d="${d}"/><polygon points="${head}"/>${lab}</g>`;
    }).join("");
    const ns = nodes.map((n) => `<g class="nd ${n.cls || ""}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="8"/>
      <text x="${n.x + n.w / 2}" y="${n.y + (n.sub ? n.h / 2 - 2 : n.h / 2 + 4)}" text-anchor="middle">${esc(n.label)}</text>
      ${n.sub ? `<text class="sub" x="${n.x + n.w / 2}" y="${n.y + n.h / 2 + 12}" text-anchor="middle">${esc(n.sub)}</text>` : ""}</g>`).join("");
    return `<svg class="rp-flow" viewBox="0 0 ${o.w} ${o.h}" width="${o.w}" role="img" aria-label="${esc(o.label || "pipeline diagram")}">${es}${ns}</svg>`;
  }

  /* =====================================================================================
   * A. The onion: request in (code before next), response out (code after next),
   *    short-circuit and exception unwinding. Middleware are real JS closures run recursively.
   * ===================================================================================== */
  const ONION_CODE = [
    "app.Use(async (ctx, next) => {  // 1 errors",
    "  try { await next(ctx); }",
    "  catch { ctx.Response.StatusCode = 500; }",
    "});",
    "app.Use(async (ctx, next) => {  // 2 logging",
    "  log.Info($\"→ {ctx.Request.Path}\");",
    "  await next(ctx);",
    "  log.Info($\"← {ctx.Response.StatusCode}\");",
    "});",
    "app.Use(async (ctx, next) => {  // 3 timing",
    "  var sw = Stopwatch.StartNew();",
    "  try { await next(ctx); }",
    "  finally { Record(sw.Elapsed); }",
    "});",
    "app.Use(async (ctx, next) => {  // 4 auth",
    "  if (!HasToken(ctx))",
    "  { ctx.Response.StatusCode = 401; return; }",
    "  await next(ctx);",
    "});",
    "app.Run(ctx =>                  // 5 endpoint",
    "  ctx.Response.WriteAsync(\"Hello\"));",
  ];
  const ONION_NAMES = ["1 ExceptionHandler", "2 Logging", "3 Timing", "4 Auth", "5 Endpoint"];

  function simOnion(hasToken, throws) {
    const st = Array(5).fill(""), log = [], fr = [], trail = [];
    const res = { status: 200, body: "", started: false };
    let clock = 0;
    const push = (cur, dir, line, note) => {
      if (cur >= 0) trail.push({ i: cur, dir });
      fr.push({
        st: [...st], cur, dir, line, note, log: [...log], res: { ...res }, trail: [...trail],
        vars: { layer: cur >= 0 ? ONION_NAMES[cur] : "—", phase: dir, StatusCode: res.status, HasStarted: res.started, "t (ms)": clock },
      });
    };
    const layers = [
      (next) => {
        st[0] = "active"; clock += 1;
        push(0, "in", [0, 1], "The outermost layer wraps <b>everything inside it</b> in a try. That is why it is registered first: a layer can only catch what runs inside it.");
        st[0] = "visit";
        try {
          next();
          st[0] = "active";
          push(0, "out", 1, "Back in the outermost layer. <code>next</code> finished without an exception, so the catch never runs and the response leaves the server.");
        } catch (e) {
          st[0] = "active"; res.status = 500; res.body = '{"title":"Server error","status":500}'; res.started = true;
          push(0, "catch", 2, "The exception has unwound all the way out and is caught here. The response has <b>not started</b>, so we can still set 500 and write a ProblemDetails body. Without this layer the server would send a bare 500.");
        }
        st[0] = "done";
      },
      (next) => {
        st[1] = "active"; clock += 1; log.push({ d: "in", m: "→ GET /orders" });
        push(1, "in", [5, 6], "Logging writes its request line <b>before</b> calling <code>next</code>. Code before <code>next</code> runs on the way <b>in</b>, in registration order.");
        st[1] = "visit";
        try { next(); } catch (e) {
          st[1] = "bad";
          push(1, "throw", 6, "The exception passes straight through Logging: <code>await next(ctx)</code> rethrows, so line 8 <b>never runs</b> and there is no response log line. Put after-code in <code>finally</code> if it must always run.");
          throw e;
        }
        st[1] = "active"; clock += 1; log.push({ d: "out", m: `← ${res.status}` });
        push(1, "out", 7, `<code>next</code> returned, so the status is now final: Logging records <b>${res.status}</b>. Code after <code>next</code> runs on the way <b>out</b>, in reverse order.`);
        st[1] = "done";
      },
      (next) => {
        st[2] = "active"; clock += 1; const t0 = clock;
        push(2, "in", [10, 11], "Start a stopwatch, then call <code>next</code>. Everything inside this layer is what gets timed.");
        st[2] = "visit";
        let threw = false;
        try { next(); } catch (e) { threw = true; throw e; } finally {
          st[2] = threw ? "bad" : "active"; clock += 1; log.push({ d: "metric", m: `elapsed ${clock - t0} ms` });
          push(2, threw ? "finally" : "out", 12, threw
            ? "The exception is passing through, but <code>finally</code> still runs: the timing is recorded even for the failed request. That is the difference from Logging above."
            : `The inner layers are done. Recorded <b>${clock - t0} ms</b>, which covers auth and the endpoint but not the outer layers.`);
        }
        if (!threw) st[2] = "done";
      },
      (next) => {
        st[3] = "active"; clock += 1;
        push(3, "in", 15, hasToken ? "The request has an Authorization header, so auth lets it continue." : "No Authorization header. Auth decides to answer the request itself.");
        if (!hasToken) {
          res.status = 401; st[3] = "path"; st[4] = "dim";
          push(3, "short", 16, "<b>Short-circuit.</b> Auth sets 401 and returns <i>without</i> calling <code>next</code>. The endpoint never runs. The response now travels back out through 3, 2 and 1, and their after-code still executes.");
          return;
        }
        st[3] = "visit";
        try { next(); } catch (e) {
          st[3] = "bad";
          push(3, "throw", 17, "Auth has no try/catch, so the exception keeps unwinding outwards.");
          throw e;
        }
        st[3] = "active";
        push(3, "out", 17, "<code>next</code> returned. Auth has no after-code, so it just returns.");
        st[3] = "done";
      },
      () => {
        st[4] = "active"; clock += 12;
        if (throws) {
          st[4] = "bad";
          push(4, "throw", [19, 20], "The endpoint throws <code>InvalidOperationException</code> before writing anything. Nothing catches it here, so it unwinds to the layer that called it.");
          throw new Error("boom");
        }
        res.body = "Hello"; res.started = true;
        push(4, "in", [19, 20], "The terminal delegate writes \"Hello\". Writing the body sends the headers, so <b>HasStarted = true</b>. From now on the outer layers cannot change the status or the headers.");
        st[4] = "done";
      },
    ];
    const run = (i) => layers[i](() => run(i + 1));
    push(-1, "start", [], "A request arrives. The server calls the <b>one</b> delegate that <code>Build()</code> produced: layer 1. Each layer decides whether, and when, to call the next one.");
    run(0);
    const order = trail.map((t) => (t.i + 1)).filter((c, k, a) => c !== a[k - 1]).join(" → ");
    push(-1, "done", [], `Response: <b>${res.status}</b>${res.body ? ` ${esc(res.body)}` : " (empty body)"}. The path was ${order}: in through the layers and back out in reverse order.`);
    return fr;
  }

  const DIR_LABEL = { in: "↓ before next()", out: "↑ after next()", short: "✋ short-circuit", throw: "⚡ throws", catch: "✔ catches", finally: "↑ finally" };
  function onionHtml(f) {
    const badge = (i) => (f.cur === i ? `<span class="rp-badge ${f.dir}">${DIR_LABEL[f.dir] || ""}</span>` : "");
    let html = `<div class="rp-layer rp-core ${f.st[4]}"><div class="rp-lname"><b>${ONION_NAMES[4]}</b>${badge(4)}</div></div>`;
    for (let i = 3; i >= 0; i--) html = `<div class="rp-layer ${f.st[i]}"><div class="rp-lname"><b>${ONION_NAMES[i]}</b>${badge(i)}</div>${html}</div>`;
    return `<div class="rp-onion">${html}</div>`;
  }
  const trailHtml = (f) => `<div class="rp-trail">${f.trail.map((t, k) => `<span class="${k === f.trail.length - 1 && f.cur >= 0 ? "cur" : ""} ${t.dir}">${(t.i + 1)}${t.dir === "in" ? "↓" : t.dir === "short" ? "✋" : t.dir === "throw" ? "⚡" : t.dir === "catch" ? "✔" : "↑"}</span>`).join("") || '<span class="muted">request not yet dispatched</span>'}</div>`;

  Viz.register("request-pipeline-onion", (el) => Viz.player(el, {
    title: "The onion: in through the layers, back out in reverse",
    legend: [["active", "running now"], ["visit", "waiting in await next()"], ["done", "finished"], ["path", "short-circuited here"], ["bad", "exception passing through"], ["dim", "never reached"]],
    codeLang: "csharp", code: ONION_CODE,
    inputs: [
      { key: "auth", label: "Authorization header", type: "select", options: ["Bearer eyJhbGci…", "(missing)"], value: "Bearer eyJhbGci…" },
      { key: "ep", label: "endpoint", type: "select", options: ["writes Hello", "throws"], value: "writes Hello" },
    ],
    random: () => ({ auth: Math.random() < 0.5 ? "(missing)" : "Bearer eyJhbGci…", ep: Math.random() < 0.4 ? "throws" : "writes Hello" }),
    build: ({ auth, ep }) => simOnion(auth !== "(missing)", ep === "throws"),
    render: (f) => Viz.row(
      Viz.labeled("pipeline (outer layers wrap inner ones)", onionHtml(f)),
      `<div class="rp-col">${panel("path so far", trailHtml(f))}
        ${panel("HttpContext.Response", kv([["StatusCode", `<b>${f.res.status}</b>`, f.res.status >= 400 ? "bad" : ""], ["HasStarted", String(f.res.started), f.res.started ? "warn" : ""], ["Body", f.res.body ? code(f.res.body) : '<span class="muted">empty</span>']]))}
        ${panel("log", f.log.length ? `<ul class="rp-log">${f.log.map((l) => `<li class="${l.d}">${esc(l.m)}</li>`).join("")}</ul>` : '<span class="muted">nothing logged yet</span>')}</div>`,
    ),
  }));

  /* =====================================================================================
   * B. Build time: fold the component list from the end into one delegate.
   * ===================================================================================== */
  const BUILD_CODE = [
    "public RequestDelegate Build()",
    "{",
    "  RequestDelegate app = ctx => { // terminal",
    "    ctx.Response.StatusCode = 404;",
    "    return Task.CompletedTask; };",
    "  for (var i = _components.Count - 1;",
    "       i >= 0; i--) app = _components[i](app);",
    "  return app;                   // outermost",
    "}",
  ];
  const exprOf = (d) => (!d ? "404" : d.run ? `${d.name}` : `${d.name}(${exprOf(d.inner)})`);
  function nestHtml(d) {
    if (!d) return `<div class="rp-nest term">404<small>terminal</small></div>`;
    if (d.run) return `<div class="rp-nest run">${esc(d.name)}<small>Run: ignores next</small></div>`;
    return `<div class="rp-nest ${d.fresh ? "fresh" : ""}"><span class="rp-nest-l">${esc(d.name)}<small> next ↴</small></span>${nestHtml(d.inner)}</div>`;
  }
  function simBuild(spec) {
    const parts = String(spec).split(",").map((s) => s.trim()).filter(Boolean);
    if (parts.length < 1 || parts.length > 7) throw new Error("List 1 to 7 components, e.g. Use Logging, Use Auth, Run Hello.");
    const comps = parts.map((p) => {
      const m = /^(use|run)\s+([A-Za-z][A-Za-z0-9]{0,11})$/i.exec(p);
      if (!m) throw new Error(`"${p}" should look like "Use Name" or "Run Name" (name: letters/digits, max 12).`);
      return { kind: m[1].toLowerCase(), name: m[2] };
    });
    const fr = [], dead = new Set(), bin = [];
    let app = null;
    const strip = (d) => (d ? { ...d, fresh: false, inner: strip(d.inner) } : d);
    const snap = (i, line, note) => fr.push({ comps, i, app, dead: new Set(dead), bin: [...bin], line, note,
      vars: { i: i < comps.length && i >= 0 ? i : "—", "_components[i]": comps[i] ? `${comps[i].kind === "use" ? "Use" : "Run"} ${comps[i].name}` : "—", app: exprOf(app) } });
    snap(comps.length, [2, 3, 4], "Start from the <b>end of the line</b>: a terminal delegate that returns 404. If every component calls <code>next</code>, this is what finally runs.");
    for (let i = comps.length - 1; i >= 0; i--) {
      const c = comps[i];
      snap(i, 5, `i = ${i}. Take <b>${c.kind === "use" ? "Use" : "Run"} ${esc(c.name)}</b>. Folding from the end means the component registered <i>last</i> gets wrapped <i>first</i>.`);
      if (c.kind === "use") {
        const inner = app;
        app = { name: c.name, inner: strip(inner), fresh: true };
        snap(i, 6, `${esc(c.name)}'s factory receives <code>next = ${esc(exprOf(inner))}</code> and returns a new delegate that closes over it. That new delegate is now <code>app</code>: <code>${esc(exprOf(app))}</code>.`);
      } else {
        if (app) bin.push(exprOf(app));
        for (let k = i + 1; k < comps.length; k++) dead.add(k);
        const lost = app;
        app = { name: c.name, run: true, fresh: true };
        snap(i, 6, `<b>Run</b> receives <code>next = ${esc(exprOf(lost))}</code> and ignores it. ${lost ? "That delegate is dropped, so every component registered after this Run is <b>unreachable</b>." : "It is the terminal component, so the 404 fallback is dropped."}`);
      }
    }
    const reach = comps.map((c, k) => (dead.has(k) ? null : c.name)).filter(Boolean);
    snap(-1, 7, `<code>Build()</code> returns the outermost delegate: <code>${esc(exprOf(app))}</code>. At run time, calling it runs ${reach.map(esc).join(" → ")} in <b>registration order</b>, because each one holds the next in its closure.${dead.size ? ` ${dead.size} component(s) after the first Run never execute.` : ""}`);
    return fr;
  }
  Viz.register("request-pipeline-build", (el) => Viz.player(el, {
    title: "Build(): folding Func<RequestDelegate, RequestDelegate> from the end",
    legend: [["active", "being folded"], ["done", "already wrapped"], ["dim", "unreachable (after Run)"]],
    codeLang: "csharp", code: BUILD_CODE,
    inputs: [{ key: "spec", label: "components (in registration order)", value: "Use Logging, Use Timing, Use Auth, Run Hello", width: 360 }],
    random: () => {
      const pool = ["Use Logging", "Use Cors", "Use Auth", "Use Timing", "Use Gzip", "Use Tenant"];
      const pick = pool.sort(() => Math.random() - 0.5).slice(0, Viz.rand(2, 4));
      pick.splice(Viz.rand(1, pick.length), 0, "Run Hello");
      if (Math.random() < 0.4) pick.push("Use Never");
      return { spec: pick.join(", ") };
    },
    build: ({ spec }) => simBuild(spec),
    render: (f) => Viz.row(
      Viz.array(f.comps.map((c) => `${c.kind === "use" ? "Use" : "Run"} ${c.name}`), {
        label: "_components", ptrs: f.i >= 0 && f.i < f.comps.length ? { i: f.i } : {},
        cls: (k) => (f.dead.has(k) ? "dim" : k === f.i ? "active" : k > f.i ? "done" : ""),
      }),
      `<div class="rp-col wide">${panel("app (the delegate built so far)", `<div class="rp-expr">${esc(exprOf(f.app))}</div>${nestHtml(f.app)}`)}
       ${f.bin.length ? panel("dropped by Run", f.bin.map((b) => chip(esc(b), "bad")).join(" ")) : ""}</div>`,
    ),
  }));

  /* =====================================================================================
   * C. Branching: Map strips the prefix and never rejoins, UseWhen rejoins, MapWhen forks.
   * ===================================================================================== */
  const BRANCH_CODE = [
    "app.Use(Logging);",
    "app.Map(\"/api\", api => {",
    "  api.Use(ApiKeyCheck);",
    "  api.Run(ApiHandler); });",
    "app.UseWhen(ctx => ctx.Request.Path",
    "    .StartsWithSegments(\"/admin\"),",
    "  b => b.Use(Audit));     // rejoins",
    "app.MapWhen(ctx => ctx.Request.Query",
    "    .ContainsKey(\"health\"),",
    "  h => h.Run(Health));    // never rejoins",
    "app.Run(Main);",
  ];
  const BN = [
    { id: "log", x: 4, y: 96, w: 82, h: 38, label: "Logging", sub: "Use" },
    { id: "map", x: 120, y: 96, w: 82, h: 38, label: "Map /api", sub: "fork" },
    { id: "key", x: 236, y: 16, w: 82, h: 38, label: "ApiKeyCheck", sub: "Use" },
    { id: "api", x: 352, y: 16, w: 82, h: 38, label: "ApiHandler", sub: "Run" },
    { id: "uw", x: 236, y: 96, w: 82, h: 38, label: "UseWhen", sub: "/admin?" },
    { id: "audit", x: 352, y: 176, w: 82, h: 38, label: "Audit", sub: "Use" },
    { id: "mw", x: 468, y: 96, w: 82, h: 38, label: "MapWhen", sub: "?health" },
    { id: "health", x: 584, y: 16, w: 82, h: 38, label: "Health", sub: "Run" },
    { id: "main", x: 584, y: 96, w: 82, h: 38, label: "Main", sub: "Run" },
  ];
  const BE = [
    { from: "log", to: "map" },
    { from: "map", to: "key", fs: "t", via: [[161, 35]], label: "match", lx: 198, ly: 30 },
    { from: "key", to: "api" },
    { from: "map", to: "uw", label: "else", lx: 219, ly: 108 },
    { from: "uw", to: "audit", fs: "b", via: [[277, 195]], label: "match", lx: 314, ly: 190 },
    { from: "audit", to: "mw", fs: "r", ts: "b", via: [[509, 195]], label: "rejoin", lx: 472, ly: 190 },
    { from: "uw", to: "mw", label: "else", lx: 393, ly: 108 },
    { from: "mw", to: "health", fs: "t", via: [[509, 35]], label: "match", lx: 546, ly: 30 },
    { from: "mw", to: "main", label: "else", lx: 567, ly: 108 },
  ];
  const segPrefix = (path, prefix) => {
    const p = path.toLowerCase(), q = prefix.toLowerCase();
    if (p === q) return "";
    if (p.startsWith(q + "/")) return path.slice(prefix.length);
    return null;
  };
  function simBranch(url) {
    url = String(url).trim();
    if (!/^\/[\w\-./]*(\?[\w=&\-.]*)?$/.test(url) || url.length > 40) throw new Error("Use a path like /api/orders?key=abc (letters, digits, / ? = &; max 40 chars).");
    const [rawPath, qs = ""] = url.split("?");
    const query = Object.fromEntries(qs.split("&").filter(Boolean).map((kv) => [kv.split("=")[0], kv.split("=")[1] ?? ""]));
    const ctx = { path: rawPath, base: "", status: 200, body: "" };
    const fr = [], nodeSt = {}, edgeSt = new Set(), stack = [];
    const snap = (cur, line, note) => fr.push({ nodeSt: { ...nodeSt, ...(cur ? { [cur]: nodeSt[cur] === "bad" ? "bad" : "active" } : {}) }, edgeSt: new Set(edgeSt), line, note,
      vars: { "Request.Path": ctx.path === "" ? '""' : ctx.path, PathBase: ctx.base === "" ? '""' : ctx.base, Query: qs || "—", StatusCode: ctx.status } });
    const enter = (id, from) => { if (from) edgeSt.add(`${from}-${id}`); nodeSt[id] = "path"; stack.push(id); };
    snap(null, [], `Request <code>${esc(url)}</code> arrives. The branches below were built once at startup; each request only follows one route through them.`);
    enter("log"); snap("log", 0, "Logging runs for every request because it sits before any branch.");
    enter("map", "log");
    const rest = segPrefix(ctx.path, "/api");
    if (rest !== null) {
      snap("map", 1, `<code>${esc(ctx.path)}</code> starts with the <b>segment</b> /api (case-insensitive), so Map takes the branch.`);
      ctx.base = rawPath.slice(0, 4); ctx.path = rest;
      enter("key", "map");
      snap("key", 2, `Inside the branch, Map has moved the matched prefix: <code>PathBase = ${esc(ctx.base)}</code>, <code>Path = ${esc(ctx.path || '""')}</code>. Branch code sees paths relative to /api.`);
      if (!("key" in query)) {
        ctx.status = 401; nodeSt.key = "bad";
        snap("key", 2, "No <code>key</code> in the query: ApiKeyCheck short-circuits with <b>401</b>. A Map branch has no way back to the main pipeline, so Main can never run for /api requests.");
      } else {
        enter("api", "key"); ctx.body = `api: Path=${ctx.path || '""'}`;
        snap("api", 3, `ApiHandler is the branch's terminal delegate. It writes <code>${esc(ctx.body)}</code>. Note the stripped path.`);
      }
      ctx.base = ""; ctx.path = rawPath;
      snap("map", 1, "Unwinding: when the branch returns, Map <b>restores</b> the original Path and PathBase before handing control back to Logging.");
    } else {
      snap("map", 1, `<code>${esc(ctx.path)}</code> does not start with the segment /api${/^\/api/i.test(ctx.path) ? " (a prefix like /apix is <i>not</i> a segment match)" : ""}. Map calls the main pipeline's next.`);
      enter("uw", "map");
      const admin = segPrefix(ctx.path, "/admin") !== null;
      let from = "uw";
      if (admin) {
        snap("uw", [4, 5], "The UseWhen predicate is true, so the request detours through the branch.");
        enter("audit", "uw");
        snap("audit", 6, "Audit runs, then calls <i>its</i> next. Because UseWhen's branch was built with the main pipeline as its terminal, that next is <b>MapWhen</b>: the branch rejoins.");
        from = "audit";
      } else {
        snap("uw", [4, 5], "The UseWhen predicate is false, so the branch is skipped and the main pipeline continues.");
      }
      enter("mw", from);
      if ("health" in query) {
        snap("mw", [7, 8], "The query contains <code>health</code>, so MapWhen forks into its branch.");
        enter("health", "mw"); ctx.body = "healthy";
        snap("health", 9, "Health writes <code>healthy</code>. Like Map, a MapWhen branch never rejoins, so Main does not run.");
      } else {
        snap("mw", [7, 8], "No <code>health</code> key in the query, so the main pipeline continues.");
        enter("main", "mw"); ctx.body = "main";
        snap("main", 10, "Main, the terminal delegate of the main pipeline, writes the response.");
      }
    }
    const visited = stack.filter((id) => !["map", "uw", "mw"].includes(id));
    snap(null, [], `Response <b>${ctx.status}</b>${ctx.body ? ` <code>${esc(ctx.body)}</code>` : ""}. Visited: ${visited.join(" → ")}. Then the stack unwinds in reverse, exactly as in the onion.`);
    return fr;
  }
  Viz.register("request-pipeline-branch", (el) => Viz.player(el, {
    title: "Map, UseWhen and MapWhen: which branch does this request take?",
    legend: [["active", "current"], ["path", "visited"], ["bad", "short-circuited"]],
    codeLang: "csharp", code: BRANCH_CODE,
    inputs: [{ key: "url", label: "request path + query", value: "/api/orders?key=abc", width: 240 }],
    random: () => ({ url: ["/api/orders?key=abc", "/api/orders", "/admin/users", "/admin/users?health", "/apix", "/?health", "/shop/cart", "/API/Orders?key=1", "/api"][Viz.rand(0, 8)] }),
    build: ({ url }) => simBranch(url),
    render: (f) => flow(BN.map((n) => ({ ...n, cls: f.nodeSt[n.id] || "" })), BE.map((e) => ({ ...e, cls: f.edgeSt.has(`${e.from}-${e.to}`) ? "path" : "" })), { w: 670, h: 222, label: "branching pipeline" }),
  }));

  /* =====================================================================================
   * D. Conventional vs factory-based middleware: what is created when, in which scope.
   * ===================================================================================== */
  const DI_CODE = [
    "// A ✗ scoped dependency in the constructor",
    "public Audit(RequestDelegate next,",
    "             AppDbContext db)",
    "// B ✓ scoped dependency per request",
    "public Task InvokeAsync(HttpContext ctx,",
    "                        AppDbContext db)",
    "// C ✓ factory-activated (IMiddleware)",
    "services.AddScoped<Audit>(); // IMiddleware",
    "public Task InvokeAsync(HttpContext ctx,",
    "                        RequestDelegate next)",
    "// registration is the same for all three",
    "app.UseMiddleware<Audit>();",
  ];
  const STYLES = ["A: AppDbContext in constructor", "B: AppDbContext as InvokeAsync parameter", "C: IMiddleware (factory-activated)"];
  function simDi(styleName, env, nStr) {
    const style = "ABC"[STYLES.indexOf(styleName)];
    if (!style) throw new Error("Pick a style.");
    const n = Viz.parse.int(nStr, { min: 1, max: 4 });
    const dev = env.startsWith("Development");
    const root = [], scopes = [], fr = [];
    let mwN = 0, dbN = 0, error = null;
    const snap = (line, note, cur) => fr.push({ root: Viz.clone(root), scopes: Viz.clone(scopes), cur, error, line, note,
      vars: { style, ValidateScopes: dev, "Audit instances": mwN, "DbContext instances": dbN } });
    const age = (list) => list.forEach((x) => { if (x.st === "active") x.st = "visit"; });
    snap(style === "C" ? [6, 7] : style === "A" ? [0, 1, 2] : [3, 4, 5], `Startup. <code>app.UseMiddleware&lt;Audit&gt;()</code> runs while the pipeline is being <b>built</b>, once, using the <b>root</b> service provider.`, null);
    if (style === "C") {
      root.push({ name: "IMiddlewareFactory", st: "active" });
      snap(11, "Audit implements <code>IMiddleware</code>, so UseMiddleware does not construct it. It adds a small shim that will ask <code>IMiddlewareFactory</code> for an instance <b>on every request</b>.", null);
    } else {
      mwN++; root.push({ name: `Audit#${mwN}`, st: "active" });
      snap(11, `Conventional middleware: <code>ActivatorUtilities</code> constructs <b>Audit#1 now</b>, once for the whole app lifetime, and passes <code>next</code> to its constructor. It behaves like a singleton.`, null);
      if (style === "A") {
        if (dev) {
          error = "InvalidOperationException: Cannot resolve scoped service 'AppDbContext' from root provider.";
          root[0].st = "bad";
          snap([1, 2], "The constructor asks for <code>AppDbContext</code>, a <b>scoped</b> service, from the root provider. With scope validation on (the Development default), the host <b>refuses to start</b>. That is the good outcome: the bug is caught on your machine.", null);
          return fr;
        }
        dbN++; root.push({ name: `db#${dbN}`, st: "bad", note: "captive" });
        snap([1, 2], "In Production scope validation is off, so the root provider happily creates <b>db#1</b> and Audit#1 keeps it forever. A scoped service has been <b>captured</b> by a singleton.", null);
      }
    }
    for (let r = 1; r <= n; r++) {
      age(root); scopes.forEach((s) => age(s.items));
      const scope = { name: `request ${r} scope`, items: [], closed: false };
      scopes.push(scope);
      snap([], `Request ${r}: the host creates a fresh DI scope and exposes it as <code>ctx.RequestServices</code>. Scoped services resolved from it live exactly as long as this request.`, r - 1);
      if (style === "A") {
        scope.items.push({ name: "uses db#1", st: "bad" });
        snap([1, 2], `Audit#1 uses its field <code>_db</code>: <b>db#1 again</b>. ${r > 1 ? "Every request, including concurrent ones, shares one DbContext and one change tracker. That is not thread-safe, and it leaks data between requests." : "It looks fine with one request, which is why this bug ships."}`, r - 1);
      } else if (style === "B") {
        dbN++; scope.items.push({ name: `db#${dbN}`, st: "active" });
        snap([4, 5], `Audit#1 is reused, but the <b>extra parameters</b> of <code>InvokeAsync</code> are resolved from <code>ctx.RequestServices</code> on each call: a new <b>db#${dbN}</b> for this request.`, r - 1);
      } else {
        mwN++; dbN++; scope.items.push({ name: `Audit#${mwN}`, st: "active" }, { name: `db#${dbN}`, st: "active" });
        snap([7, 8, 9], `<code>IMiddlewareFactory.Create</code> resolves <b>Audit#${mwN}</b> from the request scope. Its constructor can safely take <b>db#${dbN}</b> because both live in the same scope.`, r - 1);
      }
      if (style !== "A") {
        scope.items.forEach((x) => { x.st = "dim"; }); scope.closed = true;
        snap([], `Request ${r} ends. The scope is disposed, and with it ${scope.items.map((x) => x.name).join(" and ")}. Nothing scoped outlives its request.`, r - 1);
      } else {
        scope.closed = true;
        snap([], `Request ${r} ends. The scope is disposed, but db#1 belongs to the root, so it is <b>not</b> disposed and carries its state into the next request.`, r - 1);
      }
    }
    const verdict = style === "A" ? "Captive dependency: one DbContext for the whole app. Fix it with style B or C." : style === "B" ? `One middleware instance, ${dbN} DbContexts (one per request). The usual choice.` : `${mwN} middleware instances and ${dbN} DbContexts, one of each per request. Use it when the middleware itself needs a scoped or transient lifetime.`;
    snap([], `<b>Summary.</b> ${verdict}`, null);
    return fr;
  }
  Viz.register("request-pipeline-di", (el) => Viz.player(el, {
    title: "Who creates the middleware, and which scope do its dependencies come from?",
    legend: [["active", "created now"], ["visit", "alive"], ["dim", "disposed"], ["bad", "captive / error"]],
    codeLang: "csharp", code: DI_CODE,
    inputs: [
      { key: "style", label: "middleware style", type: "select", options: STYLES, value: STYLES[0] },
      { key: "env", label: "environment", type: "select", options: ["Production", "Development (ValidateScopes)"], value: "Production" },
      { key: "n", label: "requests", value: "3", width: 60 },
    ],
    random: () => ({ style: STYLES[Viz.rand(0, 2)], env: Math.random() < 0.3 ? "Development (ValidateScopes)" : "Production", n: String(Viz.rand(2, 4)) }),
    build: ({ style, env, n }) => simDi(style, env, n),
    render: (f) => {
      const chips = (items) => items.map((x) => chip(esc(x.name) + (x.note ? ` <small>${esc(x.note)}</small>` : ""), x.st)).join("") || '<span class="muted">—</span>';
      return `<div class="rp-scopes">${panel("root provider · app lifetime", chips(f.root), "root")}
        ${f.scopes.map((s, k) => panel(s.name + (s.closed ? " · disposed" : ""), chips(s.items), `${k === f.cur ? "cur" : ""} ${s.closed ? "closed" : ""}`)).join("")}</div>
        ${f.error ? `<div class="rp-error">${esc(f.error)}</div>` : ""}`;
    },
  }));

  /* =====================================================================================
   * E. Endpoint routing: UseRouting selects the endpoint; middleware after it can read metadata.
   * ===================================================================================== */
  const ROUTE_CODE = [
    "app.Use(async (ctx, next) => { // before",
    "  var ep = ctx.GetEndpoint();  // null",
    "  await next(ctx); });",
    "app.UseRouting();       // match, SetEndpoint",
    "app.UseAuthentication();",
    "app.UseAuthorization(); // reads ep.Metadata",
    "app.Use(async (ctx, next) => { // after",
    "  var ep = ctx.GetEndpoint();  // the match",
    "  await next(ctx); });",
    "app.MapGet(\"/orders/{id:int}\", GetOrder);",
    "app.MapPost(\"/orders\", Create)",
    "   .RequireAuthorization();",
    "app.MapGet(\"/admin\", Admin)",
    "   .RequireAuthorization(\"Admin\");",
    "// implicit UseEndpoints: runs the endpoint",
  ];
  const ROUTES = [
    { m: "GET", t: "/orders/{id:int}", name: "GetOrder", meta: "—" },
    { m: "POST", t: "/orders", name: "Create", meta: "[Authorize]", auth: "any" },
    { m: "GET", t: "/admin", name: "Admin", meta: "[Authorize(\"Admin\")]", auth: "Admin" },
  ];
  const STAGES = ["custom (before)", "UseRouting", "UseAuthentication", "UseAuthorization", "custom (after)", "endpoint middleware"];
  function matchTemplate(tpl, path) {
    const ts = tpl.split("/").filter(Boolean), ps = path.split("/").filter(Boolean);
    if (ts.length !== ps.length) return { ok: false, why: `${ps.length} vs ${ts.length} segments` };
    const vals = {};
    for (let i = 0; i < ts.length; i++) {
      const pm = /^\{(\w+)(?::(\w+))?\}$/.exec(ts[i]);
      if (pm) {
        if (pm[2] === "int" && !/^-?\d+$/.test(ps[i])) return { ok: false, why: `"${ps[i]}" fails :int` };
        vals[pm[1]] = ps[i];
      } else if (ts[i].toLowerCase() !== ps[i].toLowerCase()) return { ok: false, why: `"${ps[i]}" ≠ "${ts[i]}"` };
    }
    return { ok: true, vals };
  }
  function simRouting(method, path, user) {
    path = String(path).trim();
    if (!/^\/[\w\-./]*$/.test(path) || path.length > 30) throw new Error("Use a path like /orders/42 (max 30 chars, no query string).");
    const who = user.startsWith("anonymous") ? null : user.startsWith("alice") ? { name: "alice", roles: [] } : { name: "root", roles: ["Admin"] };
    const fr = [], rows = ROUTES.map(() => ({ st: "", why: "" }));
    const ctx = { ep: null, user: null, status: null };
    let stage = -1, stDone = new Set();
    const snap = (line, note, extra = {}) => fr.push({ stage, stDone: new Set(stDone), rows: Viz.clone(rows), ctx: { ...ctx }, line, note, ...extra,
      vars: { "GetEndpoint()": ctx.ep ? ctx.ep.name : "null", User: ctx.user || "anonymous", StatusCode: ctx.status ?? "—" } });
    const next = (s) => { if (stage >= 0) stDone.add(stage); stage = s; };
    snap([], `<code>${esc(method)} ${esc(path)}</code> arrives as <b>${who ? who.name : "anonymous"}</b>.`);
    next(0); snap(1, "Middleware before <code>UseRouting</code> runs before any route is matched: <code>GetEndpoint()</code> is <b>null</b>. It cannot know which endpoint, policy or attributes apply.");
    next(1);
    let pathMatch = false;
    ROUTES.forEach((r, k) => {
      const m = matchTemplate(r.t, path);
      if (m.ok && r.m === method && !ctx.ep) {
        rows[k] = { st: "done", why: "match" };
        ctx.ep = { ...r, vals: m.vals };
        snap(3, `<code>${r.m} ${esc(r.t)}</code> matches${Object.keys(m.vals).length ? ` with ${Object.entries(m.vals).map(([a, b]) => `${a} = ${esc(b)}`).join(", ")}` : ""}. Routing calls <code>ctx.SetEndpoint(…)</code>; the endpoint carries its <b>metadata</b> (${esc(r.meta)}).`, { rowCur: k });
      } else if (m.ok) {
        pathMatch = true; rows[k] = { st: "bad", why: `${method} ≠ ${r.m}` };
        snap(3, `The path fits <code>${esc(r.t)}</code> but the HTTP method is ${esc(method)}, not ${r.m}. Rejected.`, { rowCur: k });
      } else {
        rows[k] = { st: "dim", why: m.why };
        snap(3, `<code>${esc(r.t)}</code> rejected: ${esc(m.why)}. (The real matcher compiles all templates into one DFA, so it never checks rows one by one; this table only shows the outcome.)`, { rowCur: k });
      }
    });
    if (!ctx.ep && pathMatch) { ctx.ep = { name: "405 HTTP Method Not Supported", meta: "—", is405: true }; snap(3, "A template matched the path but not the method, so routing selects a built-in endpoint that answers <b>405</b>."); }
    else if (!ctx.ep) snap(3, "No template matches. The endpoint stays <b>null</b>; routing does not respond, it just calls next.");
    next(2); ctx.user = who ? who.name + (who.roles.length ? " (Admin)" : "") : null;
    snap(4, who ? `Authentication validates the token and sets <code>ctx.User</code> = ${who.name}. It never rejects a request by itself.` : "No credentials. Authentication leaves <code>ctx.User</code> anonymous and moves on: it never rejects a request by itself.");
    next(3);
    if (ctx.ep && ctx.ep.auth) {
      if (!who) { ctx.status = 401; snap(5, `Authorization reads the endpoint's metadata (${esc(ctx.ep.meta)}). The user is anonymous: <b>401</b> challenge, short-circuit.`); }
      else if (ctx.ep.auth === "Admin" && !who.roles.includes("Admin")) { ctx.status = 403; snap(5, `Authorization reads <code>${esc(ctx.ep.meta)}</code>. ${who.name} is authenticated but not an Admin: <b>403</b>, short-circuit.`); }
      else snap(5, `Authorization reads <code>${esc(ctx.ep.meta)}</code> and ${who.name} satisfies it. Continue.`);
    } else snap(5, ctx.ep ? "The endpoint has no authorization metadata, so there is nothing to enforce." : "No endpoint, so no metadata: Authorization has nothing to enforce (unless a fallback policy is configured).");
    if (ctx.status === null) {
      next(4); snap(7, ctx.ep ? `Custom middleware after routing can read <code>GetEndpoint()</code> = <b>${esc(ctx.ep.name)}</b> and its metadata. This is where endpoint-aware middleware belongs.` : "Custom middleware after routing still sees null: nothing matched.");
      next(5);
      if (!ctx.ep) { ctx.status = 404; snap(14, "The endpoint middleware has nothing to run, so it calls next. Nothing is left, and the default terminal answers <b>404</b>."); }
      else if (ctx.ep.is405) { ctx.status = 405; snap(14, "The endpoint middleware runs the 405 endpoint chosen by routing."); }
      else { ctx.status = method === "POST" ? 201 : 200; snap({ GetOrder: [9, 14], Create: [10, 11, 14], Admin: [12, 13, 14] }[ctx.ep.name], `The endpoint middleware invokes <b>${esc(ctx.ep.name)}</b>'s <code>RequestDelegate</code>: <b>${ctx.status}</b>.`); }
    }
    stDone.add(stage); stage = -1;
    snap([], `Done: <b>${ctx.status}</b>. The response unwinds back out through every layer that ran. Key point: everything between UseRouting and the endpoint middleware could see which endpoint was chosen.`);
    return fr;
  }
  Viz.register("request-pipeline-routing", (el) => Viz.player(el, {
    title: "Endpoint routing: where GetEndpoint() stops being null",
    legend: [["active", "running"], ["done", "matched / passed"], ["bad", "rejected"], ["dim", "not a match"]],
    codeLang: "csharp", code: ROUTE_CODE,
    inputs: [
      { key: "method", label: "method", type: "select", options: ["GET", "POST", "DELETE"], value: "GET" },
      { key: "path", label: "path", value: "/admin", width: 150 },
      { key: "user", label: "user", type: "select", options: ["anonymous", "alice (no roles)", "root (Admin)"], value: "alice (no roles)" },
    ],
    random: () => {
      const reqs = [["GET", "/orders/42"], ["GET", "/orders/abc"], ["POST", "/orders"], ["DELETE", "/orders"], ["GET", "/admin"], ["GET", "/nope"], ["GET", "/Orders/7"]];
      const [m, p] = reqs[Viz.rand(0, reqs.length - 1)];
      return { method: m, path: p, user: ["anonymous", "alice (no roles)", "root (Admin)"][Viz.rand(0, 2)] };
    },
    build: ({ method, path, user }) => simRouting(method, path, user),
    render: (f) => {
      const stages = `<div class="rp-stages">${STAGES.map((s, k) => `<div class="rp-stage ${k === f.stage ? "active" : f.stDone.has(k) ? "done" : ""} ${k === 1 ? "routing" : ""}"><b>${esc(s)}</b><small>${k === 0 ? "endpoint: null" : k === 1 ? "selects endpoint" : k === 5 ? "runs endpoint" : k === 4 ? "endpoint: " + esc(f.ctx.ep ? f.ctx.ep.name : "null") : ""}</small></div>`).join("")}</div>`;
      const table = `<table class="rp-routes"><tr><th>route</th><th>metadata</th><th>match?</th></tr>${ROUTES.map((r, k) => `<tr class="${f.rows[k].st} ${k === f.rowCur ? "cur" : ""}"><td><code>${r.m} ${esc(r.t)}</code></td><td>${esc(r.meta)}</td><td>${esc(f.rows[k].why)}</td></tr>`).join("")}</table>`;
      return Viz.row(Viz.labeled("pipeline", stages), `<div class="rp-col wide">${panel("route table (built from MapGet/MapPost)", table)}${panel("HttpContext", kv([["GetEndpoint()", f.ctx.ep ? `<b>${esc(f.ctx.ep.name)}</b>` : "null"], ["metadata", esc(f.ctx.ep ? f.ctx.ep.meta : "—")], ["User", esc(f.ctx.user || "anonymous")], ["StatusCode", f.ctx.status ? `<b>${f.ctx.status}</b>` : "—", f.ctx.status >= 400 ? "bad" : ""]]))}</div>`);
    },
  }));

  /* =====================================================================================
   * F. Express next() vs Koa await next(): when does "after" code run?
   * ===================================================================================== */
  const EK_CODE = [
    "// Express 4: next() returns nothing to await",
    "app.use((req, res, next) => {",
    "  const t0 = Date.now(); next();",
    "  log(`took ${Date.now() - t0}ms`); });",
    "// Koa: next() returns a Promise",
    "app.use(async (ctx, next) => {",
    "  const t0 = Date.now(); await next();",
    "  log(`took ${Date.now() - t0}ms`); });",
    "// handler (both): await db.query(); send",
  ];
  function simEK(latStr, nStr) {
    const L = Viz.parse.int(latStr, { min: 10, max: 400 }), n = Viz.parse.int(nStr, { min: 1, max: 3 });
    const names = ["A", "B", "C"].slice(0, n);
    const ev = [];
    let s = 0;
    // Express: synchronous dispatch; the handler's await returns control immediately, so the stack unwinds at t = 0.
    names.forEach((m) => ev.push({ lane: "express", t: 0, s: s++, m: `${m}: before, call next()`, line: 2 }));
    ev.push({ lane: "express", t: 0, s: s++, m: "handler: await db.query()  (yields)", line: 8 });
    [...names].reverse().forEach((m) => ev.push({ lane: "express", t: 0, s: s++, m: `${m}: after → logs "took 0ms"`, bad: true, line: 3 }));
    ev.push({ lane: "express", t: L, s: s++, m: "handler resumes: res.json() → response sent", good: true, line: 8 });
    s = 0;
    names.forEach((m) => ev.push({ lane: "koa", t: 0, s: s++, m: `${m}: before, await next()`, line: 6 }));
    ev.push({ lane: "koa", t: 0, s: s++, m: "handler: await db.query()  (yields)", line: 8 });
    ev.push({ lane: "koa", t: L, s: s++, m: "handler resumes: ctx.body = rows", line: 8 });
    [...names].reverse().forEach((m) => ev.push({ lane: "koa", t: L, s: s++, m: `${m}: after → logs "took ${L}ms"`, good: true, line: 7 }));
    ev.push({ lane: "koa", t: L, s: s++, m: "compose() resolves → Koa sends response", good: true, line: 8 });
    ev.sort((a, b) => a.t - b.t || a.s - b.s || (a.lane === "express" ? -1 : 1));
    const fr = [{ k: -1, ev, L, line: [], note: `Both apps run the same ${n} timing middleware and a handler that awaits a ${L} ms database call. Watch when the "after" code runs.`, vars: { t: 0 } }];
    ev.forEach((e, k) => {
      let note = esc(e.m);
      if (e.lane === "express" && e.bad && e.m.startsWith(names[n - 1])) note = "Express: the handler hit <code>await</code>, which returned a Promise to Express. Express <b>ignores</b> it, so <code>next()</code> returns immediately and the after-code runs <b>now</b>, before the response exists. The timing is wrong.";
      else if (e.lane === "koa" && e.m.startsWith("handler resumes")) note = `Koa: after ${L} ms the query finishes. Only now does the handler's Promise resolve, which resumes each <code>await next()</code> from the inside out.`;
      else if (e.lane === "koa" && e.good && e.m.startsWith(names[0] + ": after")) note = `Koa: the outermost layer measures <b>${L} ms</b>, the real duration. Because <code>next()</code> is a Promise, Koa is a true onion, like ASP.NET Core.`;
      else if (e.lane === "express" && e.good) note = `Express: the response is finally sent at ${L} ms, long after the middleware already logged and returned. Use <code>res.on("finish")</code> to measure in Express.`;
      fr.push({ k, ev, L, line: e.line, note: `<b>${e.lane === "express" ? "Express" : "Koa"} · t = ${e.t} ms.</b> ${note}`, vars: { t: e.t, lane: e.lane, event: e.m } });
    });
    fr.push({ k: ev.length, ev, L, line: [], note: `Same code shape, different contract. In Express 4, <code>next()</code> returns <code>undefined</code>, so the "after" part of a middleware is not an onion layer. In Koa, ASP.NET Core, Go and servlets, the call to next <b>contains</b> the rest of the pipeline.`, vars: { t: L } });
    return fr;
  }
  Viz.register("request-pipeline-express-koa", (el) => Viz.player(el, {
    title: "Express next() vs Koa await next(): when does the after-code run?",
    legend: [["active", "current event"], ["done", "correct"], ["bad", "runs too early"], ["dim", "not yet"]],
    codeLang: "typescript", code: EK_CODE,
    inputs: [{ key: "lat", label: "db latency (ms)", value: "120", width: 80 }, { key: "n", label: "middleware layers", value: "2", width: 60 }],
    random: () => ({ lat: String(Viz.rand(2, 30) * 10), n: String(Viz.rand(1, 3)) }),
    build: ({ lat, n }) => simEK(lat, n),
    render: (f) => {
      const lane = (name) => {
        const items = f.ev.map((e, k) => ({ e, k })).filter((x) => x.e.lane === name);
        return `<div class="rp-lane"><div class="rp-lane-h">${name === "express" ? "Express 4" : "Koa"}</div><ol>${items.map(({ e, k }) =>
          `<li class="${k === f.k ? "active" : k < f.k ? (e.bad ? "bad" : e.good ? "done" : "seen") : "dim"}"><span class="t">${e.t} ms</span>${esc(e.m)}</li>`).join("")}</ol></div>`;
      };
      const tNow = f.k < 0 ? 0 : f.k >= f.ev.length ? f.L : f.ev[f.k].t;
      return `<div class="rp-clock"><span>0 ms</span><div class="bar"><i style="width:${(tNow / f.L) * 100}%"></i></div><span>${f.L} ms</span></div><div class="rp-lanes">${lane("express")}${lane("koa")}</div>`;
    },
  }));
})();
