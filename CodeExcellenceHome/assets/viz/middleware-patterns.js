/* Visualizers for "Middleware Patterns & Ordering". Every frame is produced by running a small simulation. */
(() => {
  const esc = Viz.esc;

  /* ---------- shared rendering helpers (classes styled in assets/topics/middleware-patterns.css) ---------- */
  const panel = (title, inner, cls = "") => `<div class="mp-panel ${cls}"><div class="mp-ptitle">${esc(title)}</div>${inner}</div>`;
  const kv = (rows) => `<div class="mp-kv">${rows.map(([k, v, c]) => `<span>${esc(k)}</span><span class="${c || ""}">${v}</span>`).join("")}</div>`;
  const code = (s) => `<code>${esc(s)}</code>`;
  const chip = (txt, cls = "") => `<span class="mp-chip ${cls}">${txt}</span>`;
  const muted = (s) => `<span class="muted">${esc(s)}</span>`;
  const statusCls = (s) => (s >= 500 ? "bad" : s >= 400 ? "warn" : s ? "ok" : "");
  const hdrs = (h) => {
    const e = Object.entries(h || {});
    return e.length ? `<pre class="mp-body">${e.map(([k, v]) => `${esc(k)}: ${esc(v)}`).join("\n")}</pre>` : muted("no headers yet");
  };
  const fail = (type, msg) => Object.assign(new Error(msg || type), { type });

  /* =====================================================================================
   * A. Order matters: run one request through a pipeline in any order you like and
   *    compare the outcome with the canonical order. Every middleware is a real closure.
   * ===================================================================================== */
  const MW = {
    Exception: { line: "app.UseExceptionHandler();", name: "ExceptionHandler" },
    Hsts: { line: "app.UseHsts();", name: "Hsts" },
    Https: { line: "app.UseHttpsRedirection();", name: "HttpsRedirection" },
    Static: { line: "app.UseStaticFiles();", name: "StaticFiles" },
    Routing: { line: "app.UseRouting();", name: "Routing" },
    Cors: { line: "app.UseCors();", name: "Cors" },
    AuthN: { line: "app.UseAuthentication();", name: "Authentication" },
    AuthZ: { line: "app.UseAuthorization();", name: "Authorization" },
    RateLimit: { line: "app.UseRateLimiter();", name: "RateLimiter" },
    Correlation: { line: "app.UseMiddleware<CorrelationId>();", name: "CorrelationId" },
    Endpoints: { line: "app.UseEndpoints(e => e.MapControllers());", name: "Endpoints" },
  };
  const CANON = Object.keys(MW);
  const ALIAS = {
    exceptionhandler: "Exception", exceptions: "Exception", httpsredirection: "Https", staticfiles: "Static",
    authentication: "AuthN", authorization: "AuthZ", ratelimiter: "RateLimit", ratelimiting: "RateLimit",
    correlationid: "Correlation", custom: "Correlation", endpoint: "Endpoints",
  };
  const moveAfter = (key, after) => { const o = CANON.filter((k) => k !== key); o.splice(o.indexOf(after) + 1, 0, key); return o; };
  const moveBefore = (keys, before) => { const o = CANON.filter((k) => !keys.includes(k)); o.splice(o.indexOf(before), 0, ...keys); return o; };
  const PRESETS = {
    "canonical": CANON,
    "CORS after auth": moveAfter("Cors", "AuthZ"),
    "AuthZ before AuthN": moveAfter("AuthN", "AuthZ"),
    "auth before routing": moveBefore(["AuthN", "AuthZ"], "Routing"),
    "exception handler not first": moveAfter("Exception", "RateLimit"),
    "static after auth": moveAfter("Static", "AuthZ"),
    "static before HTTPS": moveAfter("Https", "Static"),
    "limiter before routing": moveBefore(["RateLimit"], "Routing"),
    "limiter before auth": moveBefore(["RateLimit"], "AuthN"),
    "endpoints before auth": moveAfter("Endpoints", "Cors"),
  };
  const CUSTOM = "custom (edit the order)";
  const SCEN = {
    "GET /api/orders with token": { m: "GET", scheme: "https", path: "/api/orders", token: true },
    "GET /api/orders, no token": { m: "GET", scheme: "https", path: "/api/orders", token: false },
    "SPA preflight OPTIONS": { m: "OPTIONS", scheme: "https", path: "/api/orders", token: false, origin: "https://spa.example", acrm: "GET" },
    "SPA GET with token": { m: "GET", scheme: "https", path: "/api/orders", token: true, origin: "https://spa.example" },
    "GET /css/site.css": { m: "GET", scheme: "https", path: "/css/site.css", token: false },
    "http:// GET /css/site.css": { m: "GET", scheme: "http", path: "/css/site.css", token: false },
    "GET /api/boom (throws)": { m: "GET", scheme: "https", path: "/api/boom", token: true },
    "101st request this minute": { m: "GET", scheme: "https", path: "/api/orders", token: true, used: 100 },
    "limiter store is down": { m: "GET", scheme: "https", path: "/api/orders", token: true, limiterDown: true },
  };
  const ORDERS = { name: "GET /api/orders", meta: "[Authorize], RequireCors(\"spa\"), RequireRateLimiting(\"per-user\")", auth: true, cors: true, limit: true };
  const BOOM = { name: "GET /api/boom", meta: "[Authorize]", auth: true, throws: true };
  const ACAO = "Access-Control-Allow-Origin";
  const PROBLEM = '{\n  "type": "…/rfc9110#section-15.6.1",\n  "title": "An error occurred while processing your request.",\n  "status": 500,\n  "traceId": "00-4bf92f35…-01"\n}';
  const match = (s) => (s.path === "/api/orders" && (s.m === "GET" || (s.m === "OPTIONS" && s.acrm)) ? ORDERS : s.path === "/api/boom" && s.m === "GET" ? BOOM : null);

  function parseOrder(text) {
    const toks = String(text).split(/[\s,>→]+/).map((t) => t.trim()).filter(Boolean);
    const out = [];
    for (const t of toks) {
      const lc = t.toLowerCase().replace(/^use/, "").replace(/[()<>;]/g, "");
      const key = CANON.find((k) => k.toLowerCase() === lc) || ALIAS[lc];
      if (!key) throw new Error(`Unknown middleware "${t}". Use: ${CANON.join(", ")}.`);
      if (out.includes(key)) throw new Error(`"${key}" appears twice. Each middleware is registered once.`);
      out.push(key);
    }
    for (const req of ["Routing", "Endpoints"]) if (!out.includes(req)) throw new Error(`Keep ${req} in the list: this demo needs routing and endpoints.`);
    if (out.indexOf("Endpoints") < out.indexOf("Routing")) throw new Error("UseEndpoints before UseRouting fails at startup: ASP.NET Core throws InvalidOperationException because EndpointRoutingMiddleware must come before EndpointMiddleware.");
    return out;
  }

  function lintOrder(order) {
    const p = (k) => order.indexOf(k), has = (k) => p(k) >= 0, out = [];
    const add = (cls, keys, msg) => out.push({ cls, keys, msg });
    if (!has("Exception")) add("bad", [], "<b>No exception handler</b>: an unhandled exception becomes a bare 500 with an empty body.");
    else if (p("Exception") > 0) add("bad", ["Exception"], `<b>ExceptionHandler is #${p("Exception") + 1}</b>: exceptions from the ${p("Exception")} middleware before it are not caught.`);
    if (has("Static") && has("Https") && p("Static") < p("Https")) add("bad", ["Static"], "<b>StaticFiles before HttpsRedirection</b>: files are served over plain HTTP.");
    if (has("Static") && has("Hsts") && p("Hsts") > p("Static")) add("warn", ["Hsts"], "<b>HSTS after StaticFiles</b>: static responses carry no Strict-Transport-Security.");
    if (has("Static") && has("AuthZ") && p("Static") > p("AuthZ")) add("bad", ["Static"], "<b>StaticFiles after Authorization</b>: public assets now need a login (FallbackPolicy).");
    if (has("Cors") && p("Cors") < p("Routing")) add("warn", ["Cors"], "<b>CORS before Routing</b>: no endpoint yet, so RequireCors policies are invisible.");
    if (has("Cors") && has("AuthZ") && p("Cors") > p("AuthZ")) add("bad", ["Cors"], "<b>CORS after Authorization</b>: preflights carry no credentials and get 401 first.");
    if (has("AuthN") && has("AuthZ") && p("AuthZ") < p("AuthN")) add("bad", ["AuthZ"], "<b>Authorization before Authentication</b>: User is always anonymous there.");
    if (has("AuthZ") && p("AuthZ") < p("Routing")) add("bad", ["AuthZ"], "<b>Authorization before Routing</b>: it cannot see [Authorize]; the endpoint middleware throws.");
    if (has("RateLimit") && p("RateLimit") < p("Routing")) add("bad", ["RateLimit"], "<b>RateLimiter before Routing</b>: endpoint policies are invisible, so nothing is limited.");
    if (has("RateLimit") && has("AuthN") && p("RateLimit") < p("AuthN")) add("bad", ["RateLimit"], "<b>RateLimiter before Authentication</b>: the per-user key sees no user; everyone shares one bucket.");
    const after = order.slice(p("Endpoints") + 1);
    if (after.length) add("warn", after, `<b>${after.map((k) => MW[k].name).join(", ")} after Endpoints</b>: never runs for a request that matches an endpoint.`);
    if (!has("AuthZ")) add("bad", [], "<b>No UseAuthorization</b>: endpoints with [Authorize] make the endpoint middleware throw.");
    if (!has("AuthN")) add("warn", [], "<b>No UseAuthentication</b>: nobody is ever signed in, so [Authorize] always answers 401.");
    if (!has("Cors")) add("bad", [], "<b>No UseCors</b>: endpoints with RequireCors make the endpoint middleware throw.");
    return out;
  }

  function simOrder(order, s) {
    const fr = [], st = order.map(() => ""), sub = order.map(() => "");
    const res = { status: 200, headers: {}, body: "", kind: "empty", started: false };
    const onStarting = [], ctx = { user: null, endpoint: null, items: {}, warn: [] };
    const buckets = { alice: s.used ?? 3, "(anonymous)": 340 };
    const push = (i, note, extra = {}) => fr.push({
      note, line: i >= 0 ? i + 1 : [], st: st.slice(), sub: sub.slice(), cur: i, res: JSON.parse(JSON.stringify(res)), ...extra,
      vars: { layer: i >= 0 ? MW[order[i]].name : "—", User: ctx.user ?? "anonymous", endpoint: ctx.endpoint ? ctx.endpoint.name : "null", status: res.status, HasStarted: res.started },
    });
    const start = () => { if (res.started) return; for (const [h, v] of onStarting) res.headers[h] = v; res.started = true; };
    const write = (status, body, kind, h = {}) => { res.status = status; Object.assign(res.headers, h); res.body = body; res.kind = kind; if (body) start(); };
    const p = (k) => order.indexOf(k);

    const L = {
      Exception(i, next) {
        sub[i] = "try { await next() }";
        push(i, "<b>ExceptionHandler</b> wraps everything registered after it in a try/catch. That is why it goes first: an exception thrown by <i>any</i> later middleware or endpoint lands here.");
        try {
          next();
          sub[i] = "returned normally";
          push(i, "The call returned without an exception, so the handler has nothing to do. The response passes out unchanged.");
        } catch (e) {
          st[i] = "active";
          res.headers = {};
          write(500, PROBLEM, "problem", { "Content-Type": "application/problem+json" });
          st[i] = "path"; sub[i] = `caught ${e.type} → 500`;
          push(i, `Caught <code>${esc(e.type)}</code>. The response has not started, so it clears the headers (OnStarting callbacks survive the clear), sets <b>500</b> and writes <b>ProblemDetails</b> through <code>IProblemDetailsService</code>, with a <code>traceId</code> that matches the logs.`);
        }
      },
      Hsts(i, next) {
        if (s.scheme === "https") {
          res.headers["Strict-Transport-Security"] = "max-age=2592000";
          sub[i] = "STS header set";
          push(i, "HSTS sets <code>Strict-Transport-Security</code> immediately, on the way <i>in</i>, so every response produced by a later middleware carries it. It skips plain HTTP, where the header means nothing.");
        } else { sub[i] = "plain http: skipped"; push(i, "Plain HTTP request: HSTS only adds its header to HTTPS responses, so it does nothing and calls next."); }
        next();
      },
      Https(i, next) {
        if (s.scheme === "http") {
          write(307, "", "empty", { Location: `https://shop.example${s.path}` });
          st[i] = "path"; sub[i] = "307 → https://";
          push(i, "Plain HTTP: <b>307 Temporary Redirect</b> to the https URL, then it short-circuits. No later middleware ever sees an insecure request.");
          return;
        }
        sub[i] = "already https"; push(i, "Already HTTPS: nothing to do, call next."); next();
      },
      Static(i, next) {
        if (s.path.startsWith("/css/")) {
          const insecure = s.scheme === "http";
          if (insecure) ctx.warn.push("site.css was served over plain HTTP: the HTTPS redirect never ran.");
          write(200, "/* site.css, 4 KB */", "file", { "Content-Type": "text/css" });
          st[i] = insecure ? "bad" : "path"; sub[i] = "served site.css";
          push(i, insecure
            ? "StaticFiles found the file and served it, <b>over plain HTTP</b>, because HttpsRedirection comes after it. The redirect never runs for files."
            : "The file exists in wwwroot, so StaticFiles writes it and <b>short-circuits</b>. Routing, auth and your endpoints never run for a public asset, which keeps it cheap.");
          return;
        }
        sub[i] = "not a file: next"; push(i, "Not a file in wwwroot, so StaticFiles calls next."); next();
      },
      Routing(i, next) {
        ctx.endpoint = match(s);
        sub[i] = ctx.endpoint ? `→ ${ctx.endpoint.name}` : "no match";
        push(i, ctx.endpoint
          ? `Routing matches <b>${esc(ctx.endpoint.name)}</b>${s.m === "OPTIONS" ? " (a preflight matches the endpoint it is asking about)" : ""} and stores it on the HttpContext. It does <i>not</i> run it. From here on, <code>GetEndpoint()</code> returns it, with its metadata: <code>${esc(ctx.endpoint.meta)}</code>.`
          : "No endpoint matches this path, so <code>GetEndpoint()</code> stays null.");
        next();
      },
      Cors(i, next) {
        const ep = ctx.endpoint;
        if (ep) ctx.items.cors = true;
        if (!s.origin) { sub[i] = "no Origin: skip"; push(i, `No <code>Origin</code> header: not a cross-origin request, so CORS does nothing${ep ? ". It still records that it ran, which the endpoint middleware checks later" : ""}.`); next(); return; }
        if (!ep) { sub[i] = "no endpoint: no policy"; push(i, "A cross-origin request, but no endpoint has been selected yet, so the endpoint's <code>RequireCors(\"spa\")</code> policy is invisible and no CORS headers are added."); next(); return; }
        if (s.m === "OPTIONS") {
          write(204, "", "empty", { [ACAO]: s.origin, "Access-Control-Allow-Methods": "GET", "Access-Control-Allow-Headers": "authorization" });
          st[i] = "path"; sub[i] = "preflight → 204";
          push(i, "A preflight for policy <code>spa</code>, and the origin is allowed. CORS answers <b>204</b> with the <code>Access-Control-Allow-*</code> headers and short-circuits. Auth never sees it, which matters because browsers never send credentials on a preflight.");
          return;
        }
        onStarting.push([ACAO, s.origin]); sub[i] = "ACAO via OnStarting";
        push(i, "Cross-origin request from an allowed origin. CORS registers <code>Access-Control-Allow-Origin</code> through <code>OnStarting</code>, so the header is added whenever the response starts: on a 200, a 401 or a 500.");
        next();
      },
      AuthN(i, next) {
        if (s.token) { ctx.user = "alice"; sub[i] = "User = alice"; push(i, "The bearer token is valid, so <code>HttpContext.User</code> becomes <b>alice</b>. Authentication only <i>identifies</i> the caller; it never rejects a request."); }
        else { sub[i] = "anonymous"; push(i, "No credentials, so User stays anonymous. Authentication does not reject anything: that is authorization's job."); }
        next();
      },
      AuthZ(i, next) {
        const ep = ctx.endpoint;
        if (ep) ctx.items.authz = true;
        const policy = ep ? "[Authorize]" : "FallbackPolicy";
        if (!ctx.user) {
          write(401, "", "empty", { "WWW-Authenticate": "Bearer" });
          st[i] = "path"; sub[i] = `${policy} → 401`;
          let why = "<code>[Authorize]</code> needs an authenticated user and there is none: challenge, <b>401</b> with <code>WWW-Authenticate: Bearer</code>. Nothing inside runs.";
          if (s.m === "OPTIONS") why = "This is a CORS <b>preflight</b>. Browsers never send credentials on a preflight, so it is anonymous and gets <b>401</b>. CORS never got to answer it: the browser reports a CORS error and the real request is never sent.";
          else if (s.token) why = "The request <i>does</i> carry a valid token, but authentication has not run yet, so User is still anonymous. Result: <b>401</b> for a perfectly good caller.";
          else if (!ep) why = `No endpoint is selected here, so the <b>FallbackPolicy</b> (require an authenticated user) applies${s.path.startsWith("/css/") ? " to a public CSS file" : ""}: <b>401</b>.`;
          push(i, why);
          return;
        }
        sub[i] = `${policy}: ok`;
        push(i, ep
          ? "alice satisfies <code>[Authorize]</code>. Authorization also marks the request as \"authorization ran for this endpoint\"; the endpoint middleware checks that mark later."
          : "No endpoint yet, so it can only evaluate the <b>FallbackPolicy</b>. alice passes, but it cannot mark \"authorization ran for this endpoint\", because there is no endpoint.");
        next();
      },
      RateLimit(i, next) {
        const ep = ctx.endpoint;
        if (!ep || !ep.limit) {
          sub[i] = "no policy: pass";
          push(i, !ep ? "No endpoint selected yet, so the endpoint policy <code>per-user</code> is invisible. No global limiter is configured, so every request passes." : "This endpoint has no rate-limit policy, so the request passes.");
          next(); return;
        }
        if (s.limiterDown) {
          st[i] = "bad"; sub[i] = "⚡ RedisConnectionException";
          push(i, "The limiter keeps its counters in a shared store, which is unreachable: acquiring a lease throws <code>RedisConnectionException</code>. The exception now unwinds outwards through every layer that wraps this one.");
          throw fail("RedisConnectionException");
        }
        const key = ctx.user ?? "(anonymous)", used = buckets[key];
        if (used >= 100) {
          write(429, "", "empty", { "Retry-After": "23" });
          st[i] = "path"; sub[i] = `${key}: ${used}/100 → 429`;
          push(i, ctx.user
            ? "alice has used all 100 permits in this one-minute window: <b>429 Too Many Requests</b> with <code>Retry-After</code>. (The default rejection status is 503; this app sets 429.)"
            : `The partition key reads <code>User</code>, but authentication has not run yet, so <b>every</b> caller shares the <code>(anonymous)</code> bucket, which is already at ${used}. ${s.token ? "alice is rejected because of other people's traffic" : "The request is rejected"}: <b>429</b>.`);
          return;
        }
        buckets[key]++; sub[i] = `${key}: ${used + 1}/100`;
        push(i, `Partition <b>${esc(key)}</b> has used ${used} of 100 permits this minute. It takes one and continues.`);
        next();
      },
      Correlation(i, next) {
        onStarting.push(["X-Correlation-ID", "c-7f3a"]); sub[i] = "id = c-7f3a";
        push(i, "Your custom middleware takes the incoming <code>X-Correlation-ID</code> (or makes one), opens a logging scope with it and echoes it on the response through OnStarting. Placed here it also knows the user and the endpoint.");
        next();
      },
      Endpoints(i, next) {
        const ep = ctx.endpoint;
        if (!ep) { sub[i] = "no endpoint: next"; push(i, "No endpoint was matched, so the endpoint middleware just calls next."); next(); return; }
        if (ep.auth && !ctx.items.authz) {
          st[i] = "bad"; sub[i] = "⚡ InvalidOperationException";
          push(i, `Before running <b>${esc(ep.name)}</b> it checks the endpoint's metadata: it has <code>[Authorize]</code>, but no authorization middleware ran for it. Rather than serve a protected endpoint to anyone, ASP.NET Core throws <code>InvalidOperationException</code>: "…contains authorization metadata, but a middleware was not found that supports authorization."`);
          throw fail("InvalidOperationException");
        }
        if (ep.cors && !ctx.items.cors) {
          st[i] = "bad"; sub[i] = "⚡ InvalidOperationException";
          push(i, `<b>${esc(ep.name)}</b> has CORS metadata, but no CORS middleware ran for it, so the endpoint middleware throws <code>InvalidOperationException</code>: "…contains CORS metadata, but a middleware was not found that supports CORS."`);
          throw fail("InvalidOperationException");
        }
        if (ep.throws) {
          st[i] = "bad"; sub[i] = "⚡ TimeoutException";
          push(i, "The endpoint runs and its database call times out: <code>TimeoutException</code>. Nothing has been written yet, so the response has not started.");
          throw fail("TimeoutException");
        }
        write(200, '[{"id":1,"total":42.50}]', "json", { "Content-Type": "application/json" });
        st[i] = "path"; sub[i] = "ran: 200 OK";
        push(i, "All checks pass, so the endpoint runs and writes 200 JSON. Writing the body <b>starts the response</b>: the OnStarting callbacks fire now and the headers are sent. The endpoint does not call next, so anything registered after it never runs.");
      },
    };

    const run = (i) => {
      if (i >= order.length) {
        write(404, "", "empty");
        push(-1, "Nothing handled the request, so the terminal delegate at the end of the pipeline answers <b>404</b>.");
        return;
      }
      st[i] = "active";
      try {
        L[order[i]](i, () => { st[i] = "visit"; run(i + 1); st[i] = "active"; });
        if (st[i] === "active") st[i] = "done";
      } catch (e) {
        if (st[i] !== "bad") {
          st[i] = "bad"; sub[i] = "⚡ unwinding";
          push(i, `<code>${esc(e.type)}</code> unwinds through <b>${MW[order[i]].name}</b>, which has no catch. Its code after <code>next()</code> never runs.`);
        }
        throw e;
      }
    };

    push(-1, `<b>${s.m} ${s.scheme}://shop.example${s.path}</b> arrives. The middleware run top to bottom on the way in, and unwind bottom to top on the way out.`);
    let escaped = null;
    try { run(0); } catch (e) { escaped = e; }
    for (let k = 0; k < st.length; k++) if (!st[k]) st[k] = "dim";
    if (escaped) {
      res.headers = {}; res.status = 500; res.body = ""; res.kind = "empty"; res.started = true;
      push(-1, `<code>${esc(escaped.type)}</code> escaped the whole pipeline ${p("Exception") < 0 ? "(there is no exception handler)" : "(it was thrown <i>outside</i> the exception handler, which only protects what is registered after it)"}. The server logs it and sends a bare <b>500 with an empty body</b>: no ProblemDetails, no traceId, no CORS header.`);
    } else {
      const was = res.started;
      start();
      push(-1, `The pipeline has unwound${was ? "" : ". Nothing wrote a body, so the server starts the response now and the OnStarting callbacks fire"}. Final status: <b>${res.status}</b>.`);
    }
    const result = { status: res.status, kind: res.kind, acao: !!res.headers[ACAO], hsts: !!res.headers["Strict-Transport-Security"], corr: !!res.headers["X-Correlation-ID"], warn: ctx.warn };
    return { fr, result };
  }

  function orderFrames(order, scenName) {
    const s = SCEN[scenName] || SCEN[Object.keys(SCEN)[0]];
    const { fr, result } = simOrder(order, s);
    const ref = simOrder(CANON, s).result;
    const isCanon = order.join() === CANON.join();
    const broken = [], warns = [...result.warn];
    if (result.status !== ref.status) broken.push(`status ${result.status}, canonical gives ${ref.status}`);
    else if (result.kind !== ref.kind) broken.push(`body is ${result.kind}, canonical gives ${ref.kind}`);
    if (result.acao !== ref.acao) broken.push(result.acao ? "unexpected CORS header" : "no Access-Control-Allow-Origin: the browser blocks it");
    if (!broken.length && result.hsts !== ref.hsts) warns.push(result.hsts ? "extra HSTS header" : "no Strict-Transport-Security header");
    if (!broken.length && result.corr !== ref.corr) warns.push(result.corr ? "has X-Correlation-ID (canonical does not)" : "no X-Correlation-ID header");
    const kind = isCanon ? "ok" : broken.length ? "bad" : warns.length ? "warn" : "ok";
    const label = isCanon ? "REFERENCE ORDER" : { ok: "SAME AS CANONICAL", warn: "WORKS, WITH WARNINGS", bad: "BROKEN" }[kind];
    const last = fr[fr.length - 1];
    last.verdict = { kind, label, broken, warns, ref };
    const lint = lintOrder(order);
    for (const f of fr) { f.lint = lint; f.req = s; }
    const summary = isCanon ? "This is the reference order." : broken.length ? `Compared with the canonical order: <b>${esc(broken.join("; "))}</b>.` : warns.length ? `Same status as the canonical order, but: ${esc(warns.join("; "))}.` : "Same outcome as the canonical order for this request. Try another request: the lint panel lists what this order gets wrong.";
    last.note += " " + summary;
    return fr;
  }

  function orderHtml(f, order) {
    const linted = new Set((f.lint || []).flatMap((l) => (l.cls === "bad" ? l.keys : [])));
    const stages = order.map((k, i) => `<div class="mp-stage ${f.st[i]} ${linted.has(k) ? "lint" : ""}"><b><span class="n">${i + 1}</span>${MW[k].name}</b><small>${esc(f.sub[i] || "") || "&nbsp;"}</small></div>`).join("");
    return `<div class="mp-stages">${stages}</div>`;
  }
  function orderSide(f, s) {
    const r = f.res;
    const req = kv([["request", code(`${s.m} ${s.path}`)], ["scheme", s.scheme, s.scheme === "http" ? "warn" : ""], ["Origin", s.origin ? code(s.origin) : muted("(none)")], ["Bearer", s.token ? "valid token (alice)" : muted("(none)")]]);
    const resp = kv([["status", `<b>${r.status}</b>`, statusCls(r.status)], ["HasStarted", String(r.started), r.started ? "warn" : ""]]) + hdrs(r.headers) +
      (r.body ? `<pre class="mp-body">${esc(r.body)}</pre>` : "");
    const v = f.verdict;
    const verdict = v ? panel("verdict", `<div class="mp-verdict ${v.kind}">${esc(v.label)}</div>${[...v.broken.map((b) => `<div class="mp-kv"><span class="bad">✗ ${esc(b)}</span></div>`), ...v.warns.map((w) => `<div class="mp-kv"><span class="warn">! ${esc(w)}</span></div>`)].join("")}`, v.kind) : "";
    const lint = f.lint || [];
    const lintBox = panel(`order lint · ${lint.length ? lint.length + " issue" + (lint.length > 1 ? "s" : "") : "clean"}`, lint.length ? `<ul class="mp-lint">${lint.map((l) => `<li class="${l.cls}">${l.msg}</li>`).join("")}</ul>` : muted("No ordering rule is broken."));
    return `<div class="mp-col">${verdict}${panel("request", req)}${panel("response", resp)}${lintBox}</div>`;
  }

  Viz.register("middleware-patterns-order", (el) => {
    const mount = (state) => {
      const order = state.order;
      Viz.player(el, {
        title: "Order matters: reorder the pipeline and watch what breaks",
        legend: [["active", "running now"], ["visit", "waiting in await next()"], ["done", "passed through"], ["path", "produced the response"], ["bad", "threw / exception unwinding"], ["dim", "never reached"]],
        codeLang: "csharp",
        code: ["var app = builder.Build();", ...order.map((k) => MW[k].line), "app.Run();"],
        inputs: [
          { key: "preset", label: "preset", type: "select", options: [CUSTOM, ...Object.keys(PRESETS)], value: state.preset },
          { key: "scenario", label: "request", type: "select", options: Object.keys(SCEN), value: state.scenario },
          { key: "order", label: "order (outermost first)", value: order.join(", "), width: 700 },
        ],
        random: () => {
          const ps = Object.keys(PRESETS), ss = Object.keys(SCEN);
          return { preset: ps[1 + Math.floor(Math.random() * (ps.length - 1))], scenario: ss[Math.floor(Math.random() * ss.length)] };
        },
        build: (vals) => {
          const next = vals.preset !== state.preset && PRESETS[vals.preset] ? PRESETS[vals.preset].slice() : parseOrder(vals.order);
          const name = Object.keys(PRESETS).find((k) => PRESETS[k].join() === next.join()) || CUSTOM;
          const frames = orderFrames(next, vals.scenario);
          if (next.join() !== order.join() || name !== vals.preset) setTimeout(() => mount({ preset: name, order: next, scenario: vals.scenario }));
          return frames;
        },
        render: (f) => Viz.row(Viz.labeled("pipeline, outermost first", orderHtml(f, order)), orderSide(f, f.req || SCEN[state.scenario])),
      });
    };
    mount({ preset: "canonical", order: CANON.slice(), scenario: Object.keys(SCEN)[0] });
  });

  /* =====================================================================================
   * B. Exceptions to ProblemDetails: where the exception goes, what the client sees,
   *    and the two cases no handler can fix (response already started, client gone).
   * ===================================================================================== */
  const EXC_CODE = [
    "builder.Services.AddProblemDetails();",
    "builder.Services",
    "  .AddExceptionHandler<DomainErrors>();",
    "app.UseExceptionHandler();",
    "app.UseMiddleware<RequestLogging>();",
    "app.MapGet(\"/orders/{id}/export\", Export);",
    "",
    "class DomainErrors(IProblemDetailsService pd)",
    "  : IExceptionHandler",
    "{",
    "  public async ValueTask<bool>",
    "    TryHandleAsync(HttpContext ctx,",
    "      Exception ex, CancellationToken ct)",
    "  {",
    "    var status = ex switch {",
    "      OrderNotFoundException => 404,",
    "      ValidationException => 400,",
    "      _ => 0 };",
    "    if (status == 0) return false; // next",
    "    ctx.Response.StatusCode = status;",
    "    return await pd.TryWriteAsync(new() {",
    "      HttpContext = ctx, Exception = ex });",
    "  }",
    "}",
  ];
  const EXC = {
    "OrderNotFoundException": { short: "OrderNotFoundException", status: 404, title: "Not Found", type: "…/rfc9110#section-15.5.5" },
    "ValidationException": { short: "ValidationException", status: 400, title: "Bad Request", type: "…/rfc9110#section-15.5.1" },
    "OperationCanceled (client left)": { short: "OperationCanceledException", cancel: true },
    "NullReferenceException (bug)": { short: "NullReferenceException", status: 0 },
  };
  const WHEN = ["before the response starts", "after streaming started"];
  const HANDLER = ["UseExceptionHandler + DomainErrors", "no UseExceptionHandler"];
  const pd = (status, title, type) => `{\n  "type": "${type}",\n  "title": "${title}",\n  "status": ${status},\n  "traceId": "00-4bf92f35…-01"\n}`;

  function simException(exName, when, handler) {
    const ex = EXC[exName] || EXC["OrderNotFoundException"], late = when === WHEN[1], none = handler === HANDLER[1];
    const fr = [], st = ["", "", ""], sub = ["", "", ""], log = [];
    const res = { status: 200, started: false, body: "", ctype: "" };
    let client = null, thrown = false;
    const push = (cur, line, note) => fr.push({ cur, line, note, st: st.slice(), sub: sub.slice(), log: log.slice(), res: { ...res }, client, none,
      vars: { exception: thrown ? ex.short : "—", StatusCode: res.status, HasStarted: res.started } });
    const csv = "id,total\n1,42.50\n2,19.99\n";

    push(-1, [], `<b>GET /orders/42/export</b> arrives. The endpoint streams a CSV. ${none ? "This app has <b>no</b> <code>UseExceptionHandler()</code>: imagine line 4 deleted." : "The exception handler is the outermost middleware."}`);
    if (none) { st[0] = "dim"; sub[0] = "not registered"; }
    else { st[0] = "visit"; sub[0] = "try { await next() }"; push(0, 3, "<b>ExceptionHandler</b> calls the rest of the pipeline inside a try/catch."); }
    st[1] = "visit"; sub[1] = "stopwatch; try/finally";
    push(1, 4, "<b>RequestLogging</b> starts a stopwatch and calls next inside <code>try { … } finally { log }</code>, so it logs even when something throws.");
    st[2] = "active";
    if (late) {
      res.started = true; res.ctype = "text/csv"; res.body = csv;
      sub[2] = "flushed 2 rows";
      push(2, 5, "The endpoint writes the header row and two rows and flushes them. The status line and headers are now <b>on the wire</b>: <code>HasStarted = true</code>. Nobody can change the status code any more.");
    }
    st[2] = "bad"; sub[2] = `⚡ ${ex.short}`; thrown = true;
    push(2, 5, ex.cancel
      ? `The client closed the connection, so <code>RequestAborted</code> fired and the database call throws <code>${ex.short}</code>.`
      : `The endpoint throws <code>${ex.short}</code>${late ? " halfway through the stream" : " before writing anything"}.`);
    st[1] = "bad"; sub[1] = `finally: logs ${res.status}`;
    log.push({ lvl: "info", msg: `GET /orders/42/export → ${res.status} in 38 ms`, bad: true });
    push(1, 4, `The exception unwinds through RequestLogging. Its <code>finally</code> block logs the status code <i>as it is right now</i>: <b>${res.status}</b>. That is wrong: the exception handler has not run yet, so the final status is decided <i>outside</i> this middleware. Logging middleware that sits inside the exception handler cannot know the final status.`);
    st[1] = "done";

    if (none) {
      if (res.started) {
        client = { status: "200 (already sent)", body: csv, cut: true, msg: "connection reset: truncated CSV" };
        log.push({ lvl: "error", msg: `Connection id "0HN…": An unhandled exception was thrown by the application.` });
        push(-1, [], "No handler. The server logs the exception and, because the response already started, can only <b>abort the connection</b>. The client gets 200 and a truncated file.");
      } else if (ex.cancel) {
        client = { status: "(nobody listening)", body: "", msg: "the client already left" };
        log.push({ lvl: "error", msg: "Unhandled exception: OperationCanceledException" });
        push(-1, [], "No handler, so the server logs a cancelled request as an unhandled <b>error</b>: noise in your alerts for something that is not a bug. The client is gone anyway.");
      } else {
        res.status = 500;
        client = { status: 500, body: "", msg: "empty body: no detail, no traceId" };
        log.push({ lvl: "error", msg: `Unhandled exception: ${ex.short}` });
        push(-1, [], "No handler. In Production the server logs it and sends a bare <b>500 with an empty body</b>. Even a 404-worthy <code>OrderNotFoundException</code> becomes a 500. (In Development, WebApplication adds the developer exception page, which hides this.)");
      }
      return finish();
    }

    st[0] = "active"; sub[0] = `catch (${ex.short})`;
    if (ex.cancel) {
      if (!res.started) res.status = 499;
      st[0] = "done"; sub[0] = res.started ? "aborted: client left" : "499, debug log only";
      log.push({ lvl: "debug", msg: "The request was aborted by the client." });
      client = { status: "(nobody listening)", body: "", msg: "the client already left" };
      push(0, 3, `The exception is an <code>OperationCanceledException</code> and <code>RequestAborted</code> is cancelled: the client left. The handler logs it at <b>Debug</b>, not Error${res.started ? "" : ", sets status <b>499</b> (Client Closed Request) for the access logs,"} and runs no IExceptionHandler. Nothing to send: nobody is listening.`);
      return finish();
    }
    log.push({ lvl: "error", msg: `An unhandled exception has occurred: ${ex.short}` });
    if (res.started) {
      st[0] = "bad"; sub[0] = "HasStarted: rethrow";
      log.push({ lvl: "warn", msg: "The response has already started, the error handler will not be executed." });
      client = { status: "200 (already sent)", body: csv, cut: true, msg: "connection reset: truncated CSV" };
      push(0, 3, "Caught, but <code>HasStarted</code> is true: the 200 status line and the first rows are already on the wire. The handler cannot clear them, so it logs <i>\"The response has already started, the error handler will not be executed\"</i> and <b>rethrows</b>. The server aborts the connection; the client sees a truncated file and a network error.");
      return finish();
    }
    res.status = 500; res.ctype = ""; res.body = "";
    push(0, 3, "Caught, and nothing has been sent yet. The handler logs the exception, calls <code>Response.Clear()</code> (status and headers reset), sets <b>500</b>, then asks each registered <code>IExceptionHandler</code> in turn.");
    if (ex.status) {
      res.status = ex.status;
      push(0, [14, 15, 16, 17, 19], `<code>DomainErrors</code> maps <code>${ex.short}</code> to <b>${ex.status}</b> and sets the status code.`);
      res.ctype = "application/problem+json"; res.body = pd(ex.status, ex.title, ex.type); res.started = true;
      st[0] = "path"; sub[0] = `DomainErrors → ${ex.status}`;
      client = { status: ex.status, body: res.body, msg: "machine-readable error with a traceId" };
      push(0, [20, 21], `It writes <b>ProblemDetails</b> through <code>IProblemDetailsService</code> and returns <code>true</code>: handled, so no other handler runs. The client gets a proper <b>${ex.status}</b> with <code>application/problem+json</code> and a <code>traceId</code> that matches the error log line.`);
      return finish();
    }
    push(0, [14, 17, 18], "<code>DomainErrors</code> does not recognise a <code>NullReferenceException</code>: the switch yields 0 and it returns <code>false</code>, meaning \"not mine, ask the next handler\". There is no other handler.");
    res.ctype = "application/problem+json"; res.body = pd(500, "An error occurred while processing your request.", "…/rfc9110#section-15.6.1"); res.started = true;
    st[0] = "path"; sub[0] = "default → 500";
    client = { status: 500, body: res.body, msg: "generic: no stack trace leaks" };
    push(0, 3, "No handler claimed it, so the middleware falls back to the default: <b>500 ProblemDetails</b> written by <code>IProblemDetailsService</code>. No stack trace or exception message leaks; the <code>traceId</code> links the response to the logged exception.");
    return finish();

    function finish() {
      const last = fr[fr.length - 1];
      last.note += ` Note the RequestLogging line: it says <b>${log[0].msg.match(/→ (\d+)/)[1]}</b>, while the client ${typeof client.status === "number" ? `got <b>${client.status}</b>` : `saw: ${esc(client.msg)}`}.`;
      return fr;
    }
  }

  const EXC_NAMES = ["ExceptionHandler", "RequestLogging", "Export endpoint"];
  function excHtml(f) {
    const stages = EXC_NAMES.map((n, i) => `<div class="mp-stage ${f.st[i]}"><b>${n}</b><small>${esc(f.sub[i] || "") || "&nbsp;"}</small></div>`).join("");
    const c = f.client;
    const clientBox = c ? panel("what the client receives", kv([["status", `<b>${esc(String(c.status))}</b>`, typeof c.status === "number" ? statusCls(c.status) : "warn"]]) + (c.body ? `<pre class="mp-body ${c.cut ? "cut" : ""}">${esc(c.body)}${c.cut ? "✂ connection reset" : ""}</pre>` : "") + `<div class="muted" style="font-size:12px;margin-top:4px">${esc(c.msg)}</div>`, c.cut || c.status === 500 && !c.body ? "bad" : typeof c.status === "number" && c.status < 500 ? "ok" : "") : "";
    const logBox = panel("log", f.log.length ? `<pre class="mp-body">${f.log.map((l) => `${l.bad ? "✗ " : ""}${l.lvl.padEnd(5)} ${esc(l.msg)}`).join("\n")}</pre>` : muted("nothing logged yet"));
    return Viz.row(Viz.labeled("pipeline", `<div class="mp-stages">${stages}</div>`),
      `<div class="mp-col">${panel("HttpContext.Response", kv([["StatusCode", `<b>${f.res.status}</b>`, statusCls(f.res.status)], ["HasStarted", String(f.res.started), f.res.started ? "warn" : ""], ["Content-Type", f.res.ctype ? code(f.res.ctype) : muted("—")]]))}${clientBox}</div>`) + logBox;
  }

  Viz.register("middleware-patterns-exception", (el) => Viz.player(el, {
    title: "From exception to ProblemDetails (and when that is impossible)",
    legend: [["active", "running now"], ["visit", "waiting in await next()"], ["done", "finished"], ["path", "wrote the error response"], ["bad", "exception passing through"], ["dim", "not registered"]],
    codeLang: "csharp", code: EXC_CODE,
    inputs: [
      { key: "ex", label: "endpoint throws", type: "select", options: Object.keys(EXC), value: "OrderNotFoundException" },
      { key: "when", label: "when", type: "select", options: WHEN, value: WHEN[0] },
      { key: "handler", label: "app", type: "select", options: HANDLER, value: HANDLER[0] },
    ],
    random: () => ({ ex: Object.keys(EXC)[Math.floor(Math.random() * 4)], when: WHEN[Math.random() < 0.3 ? 1 : 0], handler: HANDLER[Math.random() < 0.25 ? 1 : 0] }),
    build: ({ ex, when, handler }) => simException(ex, when, handler),
    render: excHtml,
  }));

  /* =====================================================================================
   * C. Correlation id: AsyncLocal-backed logging scopes vs a static field, with
   *    overlapping requests. Events are processed in time order.
   * ===================================================================================== */
  const CORR_CODE = [
    "class CorrelationId(RequestDelegate next,",
    "  ILogger<CorrelationId> log)",
    "{",
    "  const string Hdr = \"X-Correlation-ID\";",
    "  public async Task InvokeAsync(HttpContext c)",
    "  {",
    "    string id = c.Request.Headers[Hdr]",
    "      .FirstOrDefault() ?? NewId();",
    "    c.Response.OnStarting(() => {",
    "      c.Response.Headers[Hdr] = id;",
    "      return Task.CompletedTask; });",
    "    using var _ = log.BeginScope(",
    "      new Dictionary<string, object>",
    "      { [\"CorrelationId\"] = id });",
    "    // static mode instead: Current = id;",
    "    log.LogInformation(\"→ {Path}\",",
    "      c.Request.Path);",
    "    await next(c);",
    "    log.LogInformation(\"← {Status}\",",
    "      c.Response.StatusCode);",
    "  }",
    "}",
    "// endpoint: await db.LoadAsync(n);",
    "// then: log.LogInformation(\"loaded {N}\", n)",
  ];
  const CORR_MODES = ["BeginScope (AsyncLocal)", "static string Current"];
  const GEN = ["9c1e", "4b7d", "e05a", "31f2"];

  function simCorr(mode, latText, hdrA) {
    const lats = String(latText).split(/[\s,]+/).filter(Boolean).map(Number);
    if (lats.length < 2 || lats.length > 4 || lats.some((x) => !Number.isFinite(x) || x < 5 || x > 200)) throw new Error("Give 2 to 4 database latencies between 5 and 200 ms, e.g. 40, 10, 25.");
    const isStatic = mode === CORR_MODES[1];
    const reqs = lats.map((L, k) => ({ name: "ABCD"[k], n: 41 + k, t0: k * 5, L: Math.round(L), id: k === 0 && hdrA === "web-42" ? "web-42" : GEN[k], logs: [], state: "" }));
    const ev = [];
    for (const r of reqs) ev.push({ t: r.t0, k: 0, r }, { t: r.t0 + r.L, k: 1, r }, { t: r.t0 + r.L + 1, k: 2, r });
    ev.sort((a, b) => a.t - b.t || a.k - b.k);
    let current = null, wrong = 0, lastT = 0;
    const fr = [];
    const snap = (note, line, curReq) => fr.push({ note, line, cur: curReq ? curReq.name : null, current, isStatic,
      reqs: reqs.map((r) => ({ name: r.name, n: r.n, id: r.id, state: r === curReq ? "active" : r.state, logs: r.logs.slice() })),
      vars: { t: `${curReq ? curReq._t : lastT} ms`, request: curReq ? curReq.name : "—", "own id": curReq ? curReq.id : "—", [isStatic ? "Current" : "scope id"]: isStatic ? current ?? "null" : curReq ? curReq.id : "—", "wrong lines": wrong } });
    snap(`${reqs.length} requests overlap: each arrives 5 ms after the previous one and waits on the database for its own latency (${reqs.map((r) => `${r.name}: ${r.L} ms`).join(", ")}). Each must stamp <b>its own</b> correlation id on every log line.`, [], null);
    for (const e of ev) {
      const r = e.r; r._t = e.t; lastT = e.t;
      if (e.k === 0) {
        r.state = "visit";
        if (isStatic) current = r.id;
        r.logs.push({ t: e.t, msg: `→ /orders/${r.n}`, id: r.id, ok: true });
        snap(`t=${e.t} ms: <b>${r.name}</b> arrives. ${r.id === "web-42" ? "It carries <code>X-Correlation-ID: web-42</code> from the caller, so the middleware reuses it." : `No incoming header, so the middleware generates <b>${r.id}</b>.`} ${isStatic ? `It stores it in the <b>static</b> field: <code>Current = "${r.id}"</code>, shared by every request in the process.` : "<code>BeginScope</code> stores the scope in an <code>AsyncLocal</code>: it flows with <i>this</i> request's awaits only."} Then it awaits the database.`, isStatic ? [6, 7, 14, 15, 16] : [6, 7, 11, 12, 13, 15, 16], r);
      } else {
        const seen = isStatic ? current : r.id, ok = seen === r.id;
        if (!ok) wrong++;
        r.logs.push({ t: e.t, msg: e.k === 1 ? `loaded ${r.n}` : "← 200", id: seen, ok });
        if (e.k === 2) r.state = "done";
        const what = e.k === 1 ? `The database answers for <b>${r.name}</b> and the endpoint logs "loaded ${r.n}".` : `<b>${r.name}</b>'s middleware resumes after <code>await next()</code> and logs "← 200".`;
        snap(`t=${e.t} ms: ${what} ${ok
          ? isStatic ? `The static field still holds <b>${seen}</b>, which happens to be ${r.name}'s own id: no other request has overwritten it (yet).` : `The logger reads the scope from the AsyncLocal, which this continuation inherited from ${r.name}'s own execution context: <b>${seen}</b>. Correct.`
          : `The logger reads the static field, which now holds <b>${seen}</b>, written by another request that arrived later. This line is filed under the <b>wrong request</b>: search the logs for ${r.id} and it is missing.`}`, e.k === 1 ? [22, 23] : [18, 19], r);
      }
    }
    snap(wrong ? `Done: <b>${wrong}</b> of ${reqs.length * 3} log lines carry another request's id. A static (or singleton-field) correlation id is a race: it is only correct when requests never overlap, which is never in production. Switch to BeginScope to fix it.` : `Done: all ${reqs.length * 3} log lines carry the right id. ${isStatic ? "Lucky: with these latencies no request overwrote the field before another finished. Try 40, 10, 25." : "AsyncLocal gives every request its own copy, however the awaits interleave. (The response header used the local <code>id</code> variable, so it was right in both modes.)"}`, [], null);
    return fr;
  }

  function corrHtml(f) {
    const slot = f.isStatic
      ? `<div class="mp-slot">static string? Current = ${f.current ? `<b>"${esc(f.current)}"</b>` : "<b>null</b>"} <span class="muted">one slot, shared by all requests</span></div>`
      : `<div class="mp-slot">${f.reqs.map((r) => chip(`${r.name}: ${esc(r.id)}`, r.state === "active" ? "active" : r.state === "done" ? "done" : r.state ? "visit" : "dim")).join("")} <span class="muted">one AsyncLocal copy per request</span></div>`;
    const lanes = f.reqs.map((r) => `<div class="mp-lane"><div class="mp-lane-h">${r.name} · /orders/${r.n}<span>id ${esc(r.id)}</span></div><ol>${r.logs.map((l, k) => `<li class="${!l.ok ? "bad" : r.state === "active" && k === r.logs.length - 1 ? "active" : ""}"><span class="t">${l.t}ms</span>[${esc(l.id)}] ${esc(l.msg)}</li>`).join("") || `<li class="muted">not arrived</li>`}</ol></div>`).join("");
    return Viz.labeled("ambient value the logger reads", slot) + `<div class="mp-lanes" style="grid-template-columns:repeat(${f.reqs.length},minmax(0,1fr))">${lanes}</div>`;
  }

  Viz.register("middleware-patterns-correlation", (el) => Viz.player(el, {
    title: "Correlation ids under concurrency: AsyncLocal scope vs static field",
    legend: [["active", "this request is running now"], ["done", "log line has the right id"], ["bad", "log line has another request's id"]],
    codeLang: "csharp", code: CORR_CODE,
    inputs: [
      { key: "mode", label: "where the id lives", type: "select", options: CORR_MODES, value: CORR_MODES[1] },
      { key: "lat", label: "DB latency per request (ms)", value: "40, 10, 25", width: 150 },
      { key: "hdr", label: "A's incoming header", type: "select", options: ["web-42", "(none)"], value: "web-42" },
    ],
    random: () => ({ mode: CORR_MODES[Math.random() < 0.5 ? 0 : 1], lat: Array.from({ length: 2 + Math.floor(Math.random() * 3) }, () => 5 + Math.floor(Math.random() * 60)).join(", "), hdr: Math.random() < 0.5 ? "web-42" : "(none)" }),
    build: ({ mode, lat, hdr }) => simCorr(mode, lat, hdr),
    render: corrHtml,
  }));

  /* =====================================================================================
   * D. Reading the request body in middleware: the stream is forward-only unless you
   *    buffer it, and someone after you (model binding) wants to read it too.
   * ===================================================================================== */
  const BODY_CODE = [
    "app.Use(async (ctx, next) => {",
    "  ctx.Request.EnableBuffering();",
    "  string raw;",
    "  using (var reader = new StreamReader(",
    "      ctx.Request.Body, leaveOpen: true))",
    "    raw = await reader.ReadToEndAsync();",
    "  ctx.Request.Body.Position = 0; // rewind",
    "  Audit(raw);",
    "  await next(ctx);",
    "});",
    "app.MapPost(\"/orders\", (Order o) =>",
    "  Results.Created($\"/orders/{o.Id}\", o));",
  ];
  const BODY_MODES = {
    "no EnableBuffering": { buf: false, rewind: false, open: true },
    "EnableBuffering, no rewind": { buf: true, rewind: false, open: true },
    "EnableBuffering + rewind": { buf: true, rewind: true, open: true },
    "rewind without EnableBuffering": { buf: false, rewind: true, open: true },
    "rewind, but leaveOpen: false": { buf: true, rewind: true, open: false },
  };
  const fmtBytes = (n) => (n >= 1048576 ? `${(n / 1048576).toFixed(1)} MB` : n >= 1024 ? `${(n / 1024).toFixed(1)} KB` : `${n} B`);

  function simBody(modeName, sizeText) {
    const m = BODY_MODES[modeName] || BODY_MODES["EnableBuffering + rewind"];
    const size = Math.round(Number(String(sizeText).replace(/[_\s]/g, "")));
    if (!Number.isFinite(size) || size < 16 || size > 50000000) throw new Error("Body size: a number of bytes from 16 to 50000000.");
    const N = 8, chunk = Math.ceil(size / N), fr = [];
    const cells = Array(N).fill("");
    const s = { type: "HttpRequestStream", canSeek: false, pos: 0, store: "socket", disposed: false, mwRead: null, mbRead: null, status: null, err: null };
    const push = (line, note) => fr.push({ line, note, cells: cells.slice(), s: { ...s }, m, size, chunk,
      vars: { "Body type": s.type, CanSeek: s.canSeek, Position: fmtBytes(s.pos), disposed: s.disposed, status: s.status ?? "—" } });
    const tooBig = size > 30000000;
    push([], `<b>POST /orders</b> with a ${fmtBytes(size)} JSON body. <code>Request.Body</code> is a <b>forward-only</b> stream straight off the connection: <code>CanSeek = false</code>. Bytes are read once, then they are gone.`);
    if (m.buf) {
      s.type = "FileBufferingReadStream"; s.canSeek = true; s.store = "nothing buffered yet";
      push(1, "<code>EnableBuffering()</code> swaps <code>Request.Body</code> for a <code>FileBufferingReadStream</code>. It still reads from the socket, but it keeps a copy of every byte it has read, so it can seek: <code>CanSeek = true</code>.");
    } else push(1, "No <code>EnableBuffering()</code> here (imagine line 2 deleted). Request.Body is still the raw, forward-only stream.");
    if (tooBig) {
      s.status = 413; s.err = "BadHttpRequestException: Request body too large";
      for (let k = 0; k < N; k++) cells[k] = "bad";
      push([3, 4, 5], `Reading starts, but Content-Length is ${fmtBytes(size)}, above Kestrel's <code>MaxRequestBodySize</code> (30,000,000 bytes, about 28.6 MB). Kestrel throws <code>BadHttpRequestException</code> and the request ends with <b>413 Payload Too Large</b>. Raise the limit per endpoint with <code>[RequestSizeLimit]</code> if you really mean it.`);
      return fr;
    }
    for (let k = 0; k < N; k++) cells[k] = m.buf ? "done" : "bad";
    s.pos = size; s.mwRead = size;
    if (m.buf) s.store = size > 30720 ? `temp file (${fmtBytes(size)} > 30 KB)` : `memory (${fmtBytes(size)})`;
    push([3, 4, 5], `<code>ReadToEndAsync()</code> reads all ${fmtBytes(size)}. ${m.buf
      ? `The buffering stream keeps a copy: ${size > 30720 ? "above 30 KB it <b>spills to a temp file</b> on disk, so big uploads cost disk I/O, not just memory" : "under 30 KB it stays in memory"}. Position is now at the end.`
      : "There is no copy: those bytes have been <b>consumed</b> from the connection. Position is at the end, and there is no going back."}`);
    if (!m.open) {
      s.disposed = true;
      push([3, 4, 5], "The <code>using</code> block ends and disposes the reader. Without <code>leaveOpen: true</code>, disposing a <code>StreamReader</code> <b>also disposes the stream it wraps</b>: <code>Request.Body</code> is now disposed. (Imagine line 5 without <code>leaveOpen</code>.)");
    }
    if (m.rewind) {
      if (!m.buf) {
        s.status = 500; s.err = "NotSupportedException: Specified method is not supported.";
        push(6, "Setting <code>Position = 0</code> on a stream with <code>CanSeek = false</code> throws <b>NotSupportedException</b>. The exception handler turns it into a <b>500</b>. You cannot rewind what was never buffered.");
        return fr;
      }
      if (s.disposed) {
        s.status = 500; s.err = "ObjectDisposedException: Cannot access a disposed object.";
        push(6, "<code>Position = 0</code> on the disposed stream throws <b>ObjectDisposedException</b>, which becomes a <b>500</b>. The fix is one argument: <code>leaveOpen: true</code>.");
        return fr;
      }
      s.pos = 0;
      push(6, "<code>Position = 0</code> rewinds the buffered copy. The next reader will start from the first byte again.");
    } else push(6, "No rewind (imagine line 7 deleted). Position stays at the end of the body.");
    push(7, `<code>Audit(raw)</code> gets all ${fmtBytes(size)}: the middleware itself is happy, which is why this bug survives code review.`);
    const avail = size - s.pos;
    s.mbRead = avail;
    if (avail > 0) for (let k = 0; k < N; k++) cells[k] = "path";
    if (avail === 0) {
      s.status = 400; s.err = "Failed to read parameter \"Order o\" from the request body as JSON.";
      push([8, 10, 11], `<code>await next(ctx)</code>: the endpoint binds <code>Order o</code> from the body. It reads from Position ${fmtBytes(s.pos)}, which is the end: <b>0 bytes</b>. The JSON reader finds no tokens, so minimal APIs answer <b>400</b>: <i>${esc(s.err)}</i> The client sent a perfectly good body.`);
      return fr;
    }
    s.pos = size; s.status = 201;
    push([8, 10, 11], `<code>await next(ctx)</code>: model binding reads the body from byte 0 and deserializes <code>Order o</code>. <b>201 Created</b>. The body was read twice: once by your middleware, once by the framework.`);
    return fr;
  }

  function bodyHtml(f) {
    const vals = f.cells.map((_, k) => `${fmtBytes(k * f.chunk)}`);
    const ptr = f.s.pos >= f.size ? f.cells.length - 1 : Math.floor(f.s.pos / f.chunk);
    const arr = Viz.array(vals, { label: "request body, 8 chunks", ptrs: f.s.status && f.s.status >= 400 && f.s.status !== 400 ? {} : { [f.s.pos >= f.size && f.s.mwRead ? "pos=end" : "pos"]: ptr }, cls: (k) => f.cells[k] });
    const stream = kv([["Type", code(f.s.type)], ["CanSeek", String(f.s.canSeek), f.s.canSeek ? "ok" : "warn"], ["Position", fmtBytes(f.s.pos)], ["buffer", esc(f.s.store)], ["disposed", String(f.s.disposed), f.s.disposed ? "bad" : ""]]);
    const reads = kv([["middleware read", f.s.mwRead == null ? muted("—") : fmtBytes(f.s.mwRead)], ["model binding read", f.s.mbRead == null ? muted("—") : fmtBytes(f.s.mbRead), f.s.mbRead === 0 ? "bad" : f.s.mbRead ? "ok" : ""], ["status", f.s.status ? `<b>${f.s.status}</b>` : muted("—"), statusCls(f.s.status)]]) + (f.s.err ? `<div class="mp-kv" style="margin-top:4px"><span class="bad">${esc(f.s.err)}</span></div>` : "");
    return arr + Viz.row(panel("Request.Body", stream), panel("who got the bytes", reads, f.s.status >= 400 ? "bad" : f.s.status ? "ok" : ""));
  }

  Viz.register("middleware-patterns-body", (el) => Viz.player(el, {
    title: "Reading the request body in middleware without stealing it",
    legend: [["done", "read, kept in the buffer"], ["bad", "read and gone (not buffered)"], ["path", "read again by model binding"]],
    codeLang: "csharp", code: BODY_CODE,
    inputs: [
      { key: "mode", label: "middleware does", type: "select", options: Object.keys(BODY_MODES), value: "no EnableBuffering" },
      { key: "size", label: "body size (bytes)", value: "512", width: 110 },
    ],
    random: () => ({ mode: Object.keys(BODY_MODES)[Math.floor(Math.random() * 5)], size: String([200, 512, 4096, 45000, 2000000][Math.floor(Math.random() * 5)]) }),
    build: ({ mode, size }) => simBody(mode, size),
    render: bodyHtml,
  }));

  /* =====================================================================================
   * E. Middleware vs filters: which stages see which request, and what each can see.
   * ===================================================================================== */
  const FILT_CODE = [
    "// MVC: filters run inside the endpoint",
    "[ApiController, Authorize]",
    "[Route(\"api/orders\")]",
    "public class OrdersController(OrderSvc svc)",
    "  : ControllerBase",
    "{",
    "  [HttpPost, OutOfStockFilter]",
    "  public IActionResult Create(Order o) =>",
    "    Created($\"/api/orders/{o.Id}\",",
    "      svc.Place(o));",
    "}",
    "// Minimal API: endpoint filters",
    "app.MapPost(\"/api/orders\", (Order o,",
    "    OrderSvc svc) => Results.Created(",
    "      $\"/api/orders/{o.Id}\", svc.Place(o)))",
    "  .RequireAuthorization()",
    "  .AddEndpointFilter<ValidateOrder>();",
    "class ValidateOrder : IEndpointFilter {",
    "  public ValueTask<object?> InvokeAsync(",
    "    EndpointFilterInvocationContext c,",
    "    EndpointFilterDelegate next) =>",
    "    c.GetArgument<Order>(0).Qty > 0",
    "      ? next(c)",
    "      : ValueTask.FromResult<object?>(",
    "          Results.ValidationProblem(Errs));",
    "}",
  ];
  const FK = ["MVC controller action", "minimal API endpoint"];
  const FREQ = ["valid order", "invalid body (Qty = 0)", "service throws OutOfStock", "no route (/api/nope)", "anonymous (no token)"];
  const MID_ST = [
    ["ExceptionHandler", "HttpContext only"],
    ["Routing", "picks the endpoint"],
    ["Authentication", "sets User"],
    ["Authorization", "User + endpoint metadata"],
    ["Endpoint middleware", "runs the endpoint"],
  ];
  const MVC_ST = [
    ["Authorization filters", "legacy; [Authorize] is done by middleware"],
    ["Resource filters", "before model binding (caching)"],
    ["Model binding + validation", "fills Order o, ModelState"],
    ["Action filters", "bound args + ModelState"],
    ["Action Create(o)", "your code"],
    ["Exception filters", "exceptions from MVC stages"],
    ["Result filters + result", "IActionResult before it runs"],
  ];
  const MIN_ST = [
    ["Parameter binding", "fills Order o"],
    ["Endpoint filter ValidateOrder", "c.Arguments: typed args"],
    ["Handler lambda", "your code"],
  ];

  function simFilters(kind, req) {
    const mvc = kind === FK[0], inner = mvc ? MVC_ST : MIN_ST;
    const mst = MID_ST.map(() => ""), ist = inner.map(() => ""), fr = [];
    let status = null, body = "", who = "";
    const push = (line, note) => fr.push({ line, note, mvc, mst: mst.slice(), ist: ist.slice(), status, body, who,
      vars: { request: req, status: status ?? "—", "answered by": who || "—" } });
    const done = (arr, k) => { arr[k] = "done"; };
    const finish = (note) => { mst.forEach((x, k) => { if (!x) mst[k] = "dim"; }); ist.forEach((x, k) => { if (!x) ist[k] = "dim"; }); push([], note); return fr; };
    const R = FREQ.indexOf(req);
    push([], `<b>POST ${R === 3 ? "/api/nope" : "/api/orders"}</b> (${esc(req)}) against ${mvc ? "an MVC controller action" : "a minimal API endpoint"}. Middleware sees <i>every</i> request; filters only run once an endpoint has been chosen and is executing.`);
    mst[0] = "visit"; push([], "ExceptionHandler wraps everything. It can only see the <code>HttpContext</code>: raw request, raw response.");
    mst[1] = "active";
    if (R === 3) {
      push([], "Routing finds <b>no endpoint</b> for /api/nope. No endpoint means no filters, no model binding, no controller: those all live <i>inside</i> an endpoint.");
      mst[1] = "done"; mst[2] = "done"; mst[3] = "done"; mst[4] = "active";
      status = 404; who = "end of pipeline";
      push([], "Authentication and authorization run (the fallback policy is not set, so anonymous is fine), the endpoint middleware has nothing to run, and the pipeline answers <b>404</b>. Only middleware could have logged, timed or rewritten this request.");
      mst[4] = "done"; mst[0] = "done";
      return finish("Result: <b>404</b>, seen only by middleware. This is why request logging, timing and correlation ids belong in middleware, not filters.");
    }
    done(mst, 1); mst[2] = "active";
    push([], "Routing matched the endpoint; Authentication reads the token and sets <code>User</code>.");
    done(mst, 2); mst[3] = "active";
    if (R === 4) {
      status = 401; who = "Authorization middleware"; mst[3] = "path";
      push([1, 15], "<b>Authorization middleware</b> reads the endpoint's <code>[Authorize]</code> / <code>RequireAuthorization()</code> metadata and rejects the anonymous caller: <b>401</b>. With endpoint routing this happens in middleware, before any MVC authorization filter or endpoint filter could run.");
      mst[0] = "done";
      return finish("Result: <b>401</b> from middleware. No filter ever saw this request, so an action filter that \"logs every call\" silently misses every rejected one.");
    }
    done(mst, 3); mst[4] = "visit";
    push([], "Authorized. The endpoint middleware now executes the endpoint, and everything that happens next is <b>inside</b> it.");
    if (mvc) {
      ist[0] = "done"; ist[1] = "done";
      push([1, 2], "MVC's own filter pipeline starts. Authorization filters and resource filters run first: they see the <code>ActionContext</code> (route values, action descriptor), but no bound arguments yet.");
      ist[2] = "active";
      push(7, R === 1 ? "Model binding deserializes <code>Order o</code> and runs validation: <code>Qty</code> has <code>[Range(1, 100)]</code>, so <b>ModelState is invalid</b>." : "Model binding deserializes <code>Order o</code> and validates it. ModelState is valid.");
      done(ist, 2); ist[3] = "active";
      if (R === 1) {
        status = 400; who = "ModelStateInvalidFilter"; ist[3] = "path";
        body = "ValidationProblemDetails: { \"errors\": { \"Qty\": [\"…between 1 and 100.\"] } }";
        push(1, "<code>[ApiController]</code> adds <b>ModelStateInvalidFilter</b>, an action filter. It sees the invalid ModelState and short-circuits with <b>400 ValidationProblemDetails</b>. The action never runs.");
        ist[6] = "done"; mst[4] = "done"; mst[0] = "done";
        return finish("Result: <b>400</b> from an MVC action filter. Validation belongs here (or in an endpoint filter): it needs the <i>bound, typed</i> model, which middleware never has.");
      }
      push(6, "Action filters see the bound arguments (<code>context.ActionArguments[\"o\"]</code>) and can run code before and after the action.");
      done(ist, 3); ist[4] = "active";
      if (R === 2) {
        ist[4] = "bad";
        push([7, 8, 9], "The action calls <code>svc.Place(o)</code>, which throws <code>OutOfStockException</code>.");
        ist[5] = "path"; status = 409; who = "OutOfStockFilter (exception filter)";
        body = "ProblemDetails: { \"title\": \"Out of stock\", \"status\": 409 }";
        push(6, "The <b>exception filter</b> <code>OutOfStockFilter</code> catches it and sets a <b>409</b> result. It knows which action failed and its arguments. The ExceptionHandler middleware never sees the exception.");
        ist[6] = "done"; mst[4] = "done"; mst[0] = "done";
        return finish("Result: <b>409</b> from an MVC exception filter. It only catches exceptions from MVC stages; anything thrown in middleware still needs UseExceptionHandler.");
      }
      done(ist, 4); status = 201; who = "action";
      push([7, 8, 9], "The action runs and returns <code>Created(…)</code>.");
      ist[6] = "done";
      push([], "Result filters wrap the execution of the result, then the JSON is written: <b>201 Created</b>.");
      mst[4] = "done"; mst[0] = "done";
      return finish("Result: <b>201</b>. Every stage ran: 5 middleware and 7 MVC stages.");
    }
    ist[0] = "active";
    push([12, 13], "Minimal APIs bind <code>Order o</code> from the JSON body and <code>OrderSvc</code> from DI. There is no ModelState: nothing validates <code>Order</code> unless you add it.");
    done(ist, 0); ist[1] = "active";
    if (R === 1) {
      status = 400; who = "ValidateOrder (endpoint filter)"; ist[1] = "path";
      body = "ValidationProblemDetails: { \"errors\": { \"Qty\": [\"must be > 0\"] } }";
      push([16, 17, 18, 19, 20, 21, 23, 24], "The <b>endpoint filter</b> reads the typed argument with <code>c.GetArgument&lt;Order&gt;(0)</code>, sees <code>Qty = 0</code> and returns <code>Results.ValidationProblem</code> <i>without</i> calling <code>next</code>: <b>400</b>. The handler never runs.");
      mst[4] = "done"; mst[0] = "done";
      return finish("Result: <b>400</b> from an endpoint filter: the minimal-API equivalent of an action filter. It sees typed arguments, like MVC filters, and only runs for the endpoints you attach it to.");
    }
    push([16, 21, 22], "The endpoint filter sees a valid <code>Qty</code> and calls <code>next(c)</code>.");
    done(ist, 1); ist[2] = "active";
    if (R === 2) {
      ist[2] = "bad"; ist[1] = "bad";
      push([12, 13, 14], "The handler calls <code>svc.Place(o)</code>, which throws <code>OutOfStockException</code>. Minimal APIs have <b>no exception filters</b>: it propagates out through the endpoint filter (which does not catch it)…");
      mst[4] = "bad"; mst[3] = "bad"; mst[2] = "bad"; mst[1] = "bad";
      push([], "…and out through the endpoint, authorization, authentication and routing middleware…");
      mst[0] = "path"; status = 409; who = "ExceptionHandler → DomainErrors";
      body = "ProblemDetails: { \"title\": \"Out of stock\", \"status\": 409 }";
      push([], "…to <b>UseExceptionHandler</b>, whose <code>IExceptionHandler</code> maps <code>OutOfStockException</code> to <b>409 ProblemDetails</b>. One global mapping serves every endpoint, minimal or MVC.");
      return finish("Result: <b>409</b>, mapped centrally by the exception-handling middleware. Prefer this over per-controller exception filters: it also covers exceptions from middleware and minimal APIs.");
    }
    done(ist, 2); status = 201; who = "handler";
    push([12, 13, 14], "The handler runs and returns <code>Results.Created(…)</code>: <b>201</b>.");
    mst[4] = "done"; mst[0] = "done";
    return finish("Result: <b>201</b>. 5 middleware and 3 endpoint stages ran.");
  }

  function filtHtml(f) {
    const card = ([n, s], st) => `<div class="mp-stage ${st}"><b>${esc(n)}</b><small>sees: ${esc(s)}</small></div>`;
    const left = `<div class="mp-filters"><div class="grp">middleware: every request</div>${MID_ST.map((x, k) => card(x, f.mst[k])).join("")}</div>`;
    const right = `<div class="mp-filters"><div class="grp">${f.mvc ? "MVC filter pipeline" : "minimal API endpoint"}: inside the endpoint</div>${(f.mvc ? MVC_ST : MIN_ST).map((x, k) => card(x, f.ist[k])).join("")}
      ${panel("response", kv([["status", f.status ? `<b>${f.status}</b>` : muted("—"), statusCls(f.status)], ["answered by", f.who ? esc(f.who) : muted("—")]]) + (f.body ? `<pre class="mp-body">${esc(f.body)}</pre>` : ""), f.status >= 400 ? "warn" : f.status ? "ok" : "")}</div>`;
    return Viz.row(left, right);
  }

  Viz.register("middleware-patterns-filters", (el) => Viz.player(el, {
    title: "Middleware or filter? Who sees which request",
    legend: [["active", "running now"], ["visit", "waiting for inner stages"], ["done", "ran"], ["path", "produced the response"], ["bad", "exception passing through"], ["dim", "never ran"]],
    codeLang: "csharp", code: FILT_CODE,
    inputs: [
      { key: "kind", label: "endpoint", type: "select", options: FK, value: FK[0] },
      { key: "req", label: "request", type: "select", options: FREQ, value: FREQ[1] },
    ],
    random: () => ({ kind: FK[Math.random() < 0.5 ? 0 : 1], req: FREQ[Math.floor(Math.random() * FREQ.length)] }),
    build: ({ kind, req }) => simFilters(kind, req),
    render: filtHtml,
  }));

  /* =====================================================================================
   * F. Rate limiting algorithms: the same arrivals through fixed window, sliding window
   *    and token bucket. Each arrival is one frame.
   * ===================================================================================== */
  const RL_CODE = [
    "builder.Services.AddRateLimiter(o => {",
    "  o.RejectionStatusCode = 429; // default 503",
    "  o.OnRejected = (ctx, ct) => {",
    "    if (ctx.Lease.TryGetMetadata(",
    "        MetadataName.RetryAfter, out var r))",
    "      ctx.HttpContext.Response.Headers",
    "        .RetryAfter = $\"{r.TotalSeconds:0}\";",
    "    return ValueTask.CompletedTask; };",
    "  o.AddFixedWindowLimiter(\"fixed\", f => {",
    "    f.PermitLimit = limit;",
    "    f.Window = window; });",
    "  o.AddSlidingWindowLimiter(\"sliding\", s => {",
    "    s.PermitLimit = limit; s.Window = window;",
    "    s.SegmentsPerWindow = 3; });",
    "  o.AddTokenBucketLimiter(\"bucket\", t => {",
    "    t.TokenLimit = limit;",
    "    t.ReplenishmentPeriod = window / limit;",
    "    t.TokensPerPeriod = 1; });",
    "});",
    "app.UseRateLimiter(); // after UseRouting",
    "app.MapGet(\"/api/orders\", GetOrders)",
    "  .RequireRateLimiting(\"fixed\");",
  ];
  const ALGOS = ["fixed window", "sliding window (3 segments)", "token bucket"];
  const ALGO_LINES = [[8, 9, 10], [11, 12, 13], [14, 15, 16, 17]];
  const r2 = (x) => Math.round(x * 100) / 100;

  function simRate(algo, limitText, windowText, arrText) {
    const limit = Math.round(Number(limitText)), W = Number(windowText);
    if (!(limit >= 1 && limit <= 10)) throw new Error("limit: a whole number from 1 to 10.");
    if (!(W >= 1 && W <= 30)) throw new Error("window: seconds, from 1 to 30.");
    const ts = String(arrText).split(/[\s,]+/).filter(Boolean).map(Number);
    if (ts.length < 1 || ts.length > 16 || ts.some((t) => !Number.isFinite(t) || t < 0 || t > 60)) throw new Error("arrivals: 1 to 16 times in seconds between 0 and 60.");
    ts.sort((a, b) => a - b);
    const A = ALGOS.indexOf(algo) < 0 ? 0 : ALGOS.indexOf(algo), lines = ALGO_LINES[A];
    const seg = W / 3, period = W / limit;
    const acc = [], dots = ts.map((t) => ({ t, st: "pend", ra: null }));
    const fr = [];
    let tokens = limit, lastTick = 0;
    const tokHist = [[0, limit]];
    const push = (k, note, line, state) => fr.push({ note, line, k, A, W, limit, seg, period, dots: dots.map((d) => ({ ...d })), state, tokHist: tokHist.slice(), tmax: Math.max(W * 2, Math.ceil((ts[ts.length - 1] + 1) / W) * W),
      vars: { t: k >= 0 ? `${ts[k]} s` : "—", accepted: dots.filter((d) => d.st === "ok").length, rejected: dots.filter((d) => d.st === "rej").length, ...(A === 2 ? { tokens: r2(tokens) } : {}) } });
    push(-1, `${ts.length} requests, limit <b>${limit}</b> per <b>${W} s</b>, ${A === 0 ? "fixed window: a counter that resets at every window boundary" : A === 1 ? `sliding window: the window is split into 3 segments of ${r2(seg)} s; permits used in a segment come back when that segment slides out` : `token bucket: holds at most ${limit} tokens, gets 1 back every ${r2(period)} s (${W} s / ${limit})`}. Watch the burst around t = ${W} s.`, [0, 1, ...lines], null);
    ts.forEach((t, k) => {
      let ok, state, why, ra = null;
      if (A === 0) {
        const w = Math.floor(t / W), used = acc.filter((a) => Math.floor(a / W) === w).length;
        ok = used < limit; state = { label: `[${w * W}, ${(w + 1) * W}) s`, used: used + (ok ? 1 : 0), cur: w };
        if (!ok) ra = r2((w + 1) * W - t);
        why = ok ? `It falls in window [${w * W}, ${(w + 1) * W}), which has used ${used} of ${limit}: accepted.${used === 0 && w > 0 && acc.some((a) => Math.floor(a / W) === w - 1) ? " The counter just reset at the boundary, even though the previous window ended a moment ago: that is how a fixed window lets up to <b>2 × limit</b> through in a short burst across a boundary." : ""}` : `Window [${w * W}, ${(w + 1) * W}) has already used ${used} of ${limit}: <b>429</b>, Retry-After ${Math.ceil(ra)} s (when this window resets).`;
      } else if (A === 1) {
        const sNow = Math.floor(t / seg), first = sNow - 2;
        const counts = [first, first + 1, sNow].map((s) => acc.filter((a) => Math.floor(a / seg) === s).length);
        const used = counts.reduce((a, b) => a + b, 0);
        ok = used < limit;
        state = { label: `[${r2(Math.max(0, first * seg))}, ${r2((sNow + 1) * seg)}) s`, segs: [first, first + 1, sNow].map((s, i) => ({ s, from: r2(s * seg), n: counts[i] + (ok && s === sNow ? 1 : 0) })), used: used + (ok ? 1 : 0), cur: sNow };
        if (!ok) {
          let b = sNow + 1;
          while (b < sNow + 4) { const u = [b - 2, b - 1, b].reduce((a, s) => a + acc.filter((x) => Math.floor(x / seg) === s).length, 0); if (u < limit) break; b++; }
          ra = r2(b * seg - t);
        }
        why = ok ? `The last 3 segments hold ${used} permits (${counts.join(" + ")}), below ${limit}: accepted.` : `The last 3 segments already hold ${used} permits (${counts.join(" + ")}): <b>429</b>, Retry-After ${Math.ceil(ra)} s, when enough old segments slide out. Unlike the fixed window, the boundary at ${W} s gives no fresh allowance.`;
      } else {
        const ticks = Math.floor(t / period) - Math.floor(lastTick / period);
        let added = 0; if (ticks > 0) { for (let i = 1; i <= ticks; i++) { const tt = r2((Math.floor(lastTick / period) + i) * period); if (tokens < limit) { tokens += 1; added++; tokHist.push([tt, tokens]); } } }
        lastTick = t;
        ok = tokens >= 1;
        if (ok) { tokens -= 1; tokHist.push([t, tokens]); }
        state = { label: "bucket", tokens };
        if (!ok) ra = r2((Math.floor(t / period) + 1) * period - t);
        why = ok ? `${added > 0 ? `${added} token${added > 1 ? "s" : ""} refilled since the last request. ` : ""}A token is available: take it, ${tokens} left.` : `The bucket is empty: <b>429</b>, Retry-After ${Math.ceil(ra)} s (the next token arrives at ${r2((Math.floor(t / period) + 1) * period)} s). Bursts are capped at ${limit}, and the long-run rate at 1 per ${r2(period)} s.`;
      }
      dots[k].st = ok ? "ok" : "rej"; dots[k].ra = ra;
      if (ok) acc.push(t);
      push(k, `t = ${t} s: ${why}`, ok ? lines : [...lines, 1, 2, 3, 4, 5, 6], state);
    });
    const okN = dots.filter((d) => d.st === "ok").length;
    let maxBurst = 0;
    for (const a of acc) maxBurst = Math.max(maxBurst, acc.filter((b) => b >= a && b < a + W).length);
    push(-1, `Done: <b>${okN}</b> accepted, <b>${ts.length - okN}</b> rejected with 429. The most requests accepted inside any ${W}-second span was <b>${maxBurst}</b>${maxBurst > limit ? (A === 0 ? `, more than the limit of ${limit}: the fixed-window boundary burst` : `, more than the limit of ${limit}: a full bucket (${limit}) plus tokens refilled during the span. The bucket caps the burst, not the per-window count`) : ""}. Try the other algorithms on the same arrivals.`, [], null);
    return fr;
  }

  function rateHtml(f) {
    const Wpx = 540, x0 = 14, sc = (Wpx - 2 * x0) / f.tmax, X = (t) => x0 + t * sc, axisY = f.A === 2 ? 128 : 92;
    let g = "";
    if (f.A === 0) for (let w = 0; w * f.W < f.tmax; w++) g += `<rect class="win ${f.state && f.state.cur === w ? "cur" : ""}" x="${X(w * f.W)}" y="20" width="${f.W * sc}" height="${axisY - 20}" rx="4"/>`;
    if (f.A === 1) {
      for (let s = 0; s * f.seg < f.tmax + 1e-9; s++) g += `<line class="seg" x1="${X(s * f.seg)}" y1="20" x2="${X(s * f.seg)}" y2="${axisY}"/>`;
      if (f.state) g += `<rect class="win cur" x="${X(Math.max(0, f.state.segs[0].s * f.seg))}" y="20" width="${(f.state.cur + 1 - Math.max(0, f.state.segs[0].s)) * f.seg * sc}" height="${axisY - 20}" rx="4"/>`;
    }
    if (f.A === 2) {
      const pts = [];
      let prev = null;
      const tY = (n) => 22 + (f.limit - n) * (64 / f.limit);
      for (const [t, n] of f.tokHist) { if (prev !== null) pts.push(`${X(t)},${tY(prev)}`); pts.push(`${X(t)},${tY(n)}`); prev = n; }
      const tEnd = f.k >= 0 ? f.dots[f.k].t : f.tmax;
      pts.push(`${X(tEnd)},${tY(prev)}`);
      g += `<polyline class="tokline" points="${pts.join(" ")}"/><text class="lbl" x="${x0}" y="14">tokens (0 to ${f.limit})</text>`;
      for (let t = f.period; t <= f.tmax; t += f.period) g += `<line class="tick" x1="${X(t)}" y1="${axisY - 4}" x2="${X(t)}" y2="${axisY + 4}"/>`;
    }
    for (let t = 0; t <= f.tmax; t += f.W) g += `<line class="tick" x1="${X(t)}" y1="${axisY}" x2="${X(t)}" y2="${axisY + 6}"/><text class="lbl" x="${X(t)}" y="${axisY + 19}" text-anchor="middle">${t}s</text>`;
    g += `<line class="axis" x1="${x0}" y1="${axisY}" x2="${Wpx - x0}" y2="${axisY}"/>`;
    if (f.k >= 0) g += `<line class="now" x1="${X(f.dots[f.k].t)}" y1="16" x2="${X(f.dots[f.k].t)}" y2="${axisY}"/>`;
    f.dots.forEach((d, i) => {
      const y = (f.A === 2 ? axisY - 14 : 40 + (i % 3) * 16);
      g += `<g class="${d.st} ${i === f.k ? "cur" : ""}"><circle cx="${X(d.t)}" cy="${y}" r="6"/></g>`;
    });
    const svg = `<svg class="mp-tl" viewBox="0 0 ${Wpx} ${axisY + 26}" width="${Wpx}" role="img" aria-label="timeline of requests and rate limiter state">${g}</svg>`;
    let st = muted("no request yet");
    if (f.state) {
      if (f.A === 0) st = kv([["window", esc(f.state.label)], ["used", `${f.state.used} / ${f.limit}`, f.state.used >= f.limit ? "warn" : ""]]);
      else if (f.A === 1) st = kv([["window", esc(f.state.label)], ...f.state.segs.filter((s) => s.s >= 0).map((s) => [`segment @${s.from}s`, String(s.n)]), ["used", `${f.state.used} / ${f.limit}`, f.state.used >= f.limit ? "warn" : ""]]);
      else st = kv([["tokens left", `${r2(f.state.tokens)} / ${f.limit}`, f.state.tokens < 1 ? "warn" : ""], ["refill", `+1 every ${r2(f.period)} s`]]);
    }
    const cur = f.k >= 0 ? f.dots[f.k] : null;
    const resp = cur ? kv([["t", `${cur.t} s`], ["status", cur.st === "ok" ? "<b>200</b>" : "<b>429</b>", cur.st === "ok" ? "ok" : "warn"], ["Retry-After", cur.ra != null ? `${Math.ceil(cur.ra)}` : muted("—")]]) : muted("—");
    const list = f.dots.map((d) => chip(`${d.t}s`, d.st === "ok" ? "done" : d.st === "rej" ? "bad" : "")).join("");
    return Viz.labeled("arrivals on a timeline", svg) + Viz.row(panel("limiter state", st), panel("this request", resp), panel("all requests", `<div style="max-width:220px">${list}</div>`));
  }

  Viz.register("middleware-patterns-ratelimit", (el) => Viz.player(el, {
    title: "Fixed window, sliding window, token bucket: same traffic, different 429s",
    legend: [["done", "accepted"], ["bad", "rejected: 429 + Retry-After"], ["active", "current window / now"]],
    codeLang: "csharp", code: RL_CODE,
    inputs: [
      { key: "algo", label: "algorithm", type: "select", options: ALGOS, value: ALGOS[0] },
      { key: "limit", label: "limit", value: "4", width: 50 },
      { key: "window", label: "window (s)", value: "6", width: 50 },
      { key: "arr", label: "arrivals (s)", value: "4.5, 5, 5.5, 5.9, 6.1, 6.3, 6.6, 7, 9, 12", width: 300 },
    ],
    random: () => {
      const n = 6 + Math.floor(Math.random() * 7), out = [];
      for (let i = 0; i < n; i++) out.push(Math.round(Math.random() * 140) / 10);
      return { algo: ALGOS[Math.floor(Math.random() * 3)], arr: out.sort((a, b) => a - b).join(", ") };
    },
    build: ({ algo, limit, window, arr }) => simRate(algo, limit, window, arr),
    render: rateHtml,
  }));
})();
