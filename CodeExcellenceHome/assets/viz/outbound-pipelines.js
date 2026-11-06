/* Outbound pipeline visualizers. Every registered name is prefixed "outbound-pipelines-". */
(() => {
  const esc = Viz.esc;

  /* ---------- shared helpers ---------- */
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const num = (s, label, min, max) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const int = (s, label, min, max) => {
    const n = num(s, label, min, max);
    if (!Number.isInteger(n)) throw new Error(`${label}: use a whole number.`);
    return n;
  };
  const hex = (rng, n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(rng() * 16)]).join("");
  const shuffle = (a) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  /* parse "A,B,C" against an allowed vocabulary (case-insensitive) */
  const names = (s, allowed, label, min = 1) => {
    const parts = String(s).split(/[\s,>→]+/).filter(Boolean);
    const out = parts.map((p) => {
      const m = allowed.find((a) => a.toLowerCase() === p.toLowerCase());
      if (!m) throw new Error(`${label}: unknown "${p}". Use ${allowed.join(", ")}.`);
      return m;
    });
    if (out.length < min || out.length > allowed.length) throw new Error(`${label}: list ${min}–${allowed.length} names separated by commas.`);
    if (new Set(out).size !== out.length) throw new Error(`${label}: use each name once.`);
    return out;
  };
  /* key/value panel: rows [[key, value, cls]] */
  const kv = (title, rows, o = {}) => `<div class="ob-kv ${o.cls || ""}"><div class="ob-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="ob-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v ?? "")}</span></div>`).join("")
      : `<div class="ob-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const lines = (title, items, o = {}) => `<div class="ob-kv ${o.cls || ""}"><div class="ob-kv-h">${esc(title)}</div>${
    items.length ? items.map(([t, c]) => `<div class="ob-kv-r one ${c || ""}"><span>${esc(t)}</span></div>`).join("")
      : `<div class="ob-kv-r empty one"><span>${esc(o.empty || "nothing yet")}</span></div>`}</div>`;
  const stats = (items) => `<div class="ob-stats">${items.map(([l, v, c]) => `<div class="ob-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const badge = (b, c = "") => (b ? `<span class="ob-badge ${c}">${esc(b)}</span>` : "");

  /* stacked bar chart. layers: [[values per bar]...], cls per layer, cut: bars >= cut are not drawn yet */
  function stackChart(o) {
    const W = o.w || 600, H = o.h || 160, pl = 44, pr = 12, pt = 18, pb = 22;
    const n = o.layers[0].length, bw = (W - pl - pr) / n, ih = H - pt - pb;
    const y = (v) => pt + ih - (Math.min(v, o.ymax) / o.ymax) * ih;
    const fy = o.fmtY || ((v) => (v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${Math.round(v)}`));
    let s = `<svg class="ob-chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label)}">`;
    for (let g = 0; g <= 4; g++) {
      const v = (o.ymax * g) / 4, yy = y(v);
      s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="ax" x="${pl - 5}" y="${yy + 3.5}" text-anchor="end">${esc(fy(v))}</text>`;
    }
    const cut = o.cut ?? n;
    for (let i = 0; i < Math.min(n, cut); i++) {
      let base = 0;
      o.layers.forEach((L, li) => {
        const v = L[i];
        if (!(v > 0)) return;
        const y1 = y(base + v), y0 = y(base);
        s += `<rect class="bar ${o.cls[li]}" x="${(pl + i * bw + 0.4).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(0.8, bw - 0.8).toFixed(1)}" height="${Math.max(0.6, y0 - y1).toFixed(1)}"/>`;
        base += v;
      });
    }
    if (o.cap !== undefined) {
      const yy = y(o.cap);
      s += `<line class="cap" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="capt" x="${W - pr - 4}" y="${yy - 4}" text-anchor="end">${esc(o.capLabel || "")}</text>`;
    }
    (o.markers || []).forEach((m) => {
      if (m.i < 0 || m.i > n) return;
      const x = pl + m.i * bw;
      s += `<line class="mark ${m.cls || ""}" x1="${x}" x2="${x}" y1="${pt - 4}" y2="${pt + ih}"/>`;
      if (m.label) s += `<text class="markt ${m.cls || ""}" x="${x + 3}" y="${pt - 6}">${esc(m.label)}</text>`;
    });
    if (cut < n) { const x = pl + cut * bw; s += `<line class="now" x1="${x}" x2="${x}" y1="${pt}" y2="${pt + ih}"/>`; }
    (o.xTicks || []).forEach(({ i, label }) => { s += `<text class="ax" x="${pl + i * bw}" y="${H - 6}" text-anchor="middle">${esc(label)}</text>`; });
    if (o.yLabel) s += `<text class="ax" x="4" y="11">${esc(o.yLabel)}</text>`;
    return s + "</svg>";
  }

  /* =====================================================================
   * 1. The handler chain: one request down, the response back up
   * ===================================================================== */
  const CH = ["Log", "Trace", "Auth", "Retry", "Timeout"];
  const CH_SUB = { Log: "→ / ← lines", Trace: "span + traceparent", Auth: "Bearer token, 401 → refresh", Retry: "3 tries, 200/400 ms", Timeout: "1 s deadline" };
  const CH_SCEN = ["503, then 200", "200 OK", "401: token expired", "slow first attempt (4 s)", "server down"];
  const transient = (s) => s >= 500 || s === 408 || s === 429;
  const errText = (e) => (e.kind === "cancel" ? "OperationCanceledException" : e.kind === "timeout" ? "TimeoutException" : "HttpRequestException (connection refused)");

  function chainInsights(order) {
    const ix = (k) => order.indexOf(k), out = [];
    const r = ix("Retry"), to = ix("Timeout"), lg = ix("Log"), au = ix("Auth"), tr = ix("Trace");
    if (r >= 0 && to >= 0) out.push(to > r ? "Timeout inside Retry = a per-attempt timeout: a slow try is abandoned and the next try gets a fresh second." : "Timeout outside Retry = a total budget: every attempt and every backoff wait share one second.");
    if (r >= 0 && lg >= 0) out.push(lg < r ? "Log outside Retry writes one line pair per logical call, timed end to end." : "Log inside Retry writes one line pair per attempt.");
    if (au >= 0 && lg >= 0 && lg > au) out.push("Log sits inside Auth, so it sees the Authorization header: redaction is mandatory.");
    if (r >= 0 && tr >= 0) out.push(tr > r ? "Trace inside Retry gives one span per attempt: retries are visible in the trace." : "Trace outside Retry gives one span that hides the retries.");
    if (r >= 0 && au >= 0 && au < r) out.push("Auth outside Retry still works: the token is set once and reused by every attempt.");
    if (r < 0) out.push("No Retry: a single transient blip fails the call.");
    if (to < 0) out.push("No Timeout handler: only HttpClient.Timeout (100 s by default) bounds the call.");
    return out;
  }

  function chainSim(order, scen) {
    const n = order.length, frames = [], rng = mulberry(42), traceId = hex(rng, 32);
    const S = { t: 0, L: order.map(() => ({ st: "", b: "" })), wire: { st: "", b: "" }, srv: { st: "", b: "" }, hdr: {}, log: [], calls: 0, refresh: 0, spans: 0, token: "tok-1", dl: [], attempt: "-", status: "-" };
    const retryAt = order.indexOf("Retry");
    const snap = (note, line, cur) => frames.push({
      note, line, cur, order, t: S.t, L: S.L.map((x) => ({ ...x })), wire: { ...S.wire }, srv: { ...S.srv }, hdr: { ...S.hdr }, log: S.log.slice(), calls: S.calls, refresh: S.refresh, spans: S.spans,
      vars: { t: `${S.t} ms`, layer: cur === undefined ? "caller" : cur === n ? "primary" : order[cur], attempt: S.attempt, status: S.status, deadline: S.dl.length ? `t=${Math.min(...S.dl.map((d) => d.at))} ms` : "none" },
    });
    const spend = (ms) => {
      const dl = S.dl.length ? S.dl.reduce((a, b) => (b.at < a.at ? b : a)) : null;
      if (dl && S.t + ms > dl.at) { S.t = dl.at; throw { kind: "cancel", owner: dl.owner }; }
      S.t += ms;
    };
    const fail = (d, e, why) => { S.L[d].st = "bad"; S.L[d].b = "✖"; snap(why || `<b>${order[d]}</b> does not handle <code>${errText(e)}</code>, so it simply propagates outward.`, 8, d); throw e; };

    const primary = () => {
      S.calls++;
      const k = S.calls;
      let lat = 80, status = 200, down = false;
      if (scen === "503, then 200") status = k === 1 ? 503 : 200;
      else if (scen === "401: token expired") { lat = 60; status = S.hdr.Authorization === "Bearer tok-1" || !S.hdr.Authorization ? 401 : 200; }
      else if (scen.startsWith("slow")) lat = k === 1 ? 4000 : 80;
      else if (scen === "server down") { down = true; lat = 5; }
      S.wire = { st: "active", b: `send #${k}` }; S.srv = { st: "", b: "" };
      snap(`The primary handler (<code>SocketsHttpHandler</code>) takes a pooled connection and writes request #${k}. Every layer above it was plain in-process code; this is the only one that does network I/O.`, 6, n);
      S.srv = { st: down ? "bad" : "active", b: down ? "down" : `working ${lat} ms` };
      const t0 = S.t;
      try { spend(lat); } catch (e) {
        S.wire = { st: "bad", b: "cancelled" }; S.srv = { st: "bad", b: "still working" };
        snap(`A deadline fired ${S.t - t0} ms into the wait. The client stops waiting and drops the connection, but the server may keep working on a response nobody will read: cancellation is local.`, 6, n);
        throw e;
      }
      if (down) {
        S.wire = { st: "bad", b: "refused" };
        snap(`Connect failed: <code>HttpRequestException</code> (connection refused). Nothing reached the server, so retrying is safe even for a POST.`, 8, n);
        throw { kind: "http" };
      }
      S.status = status;
      const ok = status < 400;
      S.wire = { st: ok ? "done" : "bad", b: String(status) }; S.srv = { st: ok ? "done" : "bad", b: String(status) };
      snap(`Response <code>${status}</code> arrives after ${lat} ms. It now travels back <i>up</i> through the same handlers in reverse order.`, 7, n);
      return { status };
    };

    const H = {
      Log(d) {
        const L = S.L[d], t0 = S.t, auth = !!S.hdr.Authorization, perTry = retryAt >= 0 && d > retryAt;
        L.st = "active"; L.b = "→";
        S.log.push([`→ GET /orders${auth ? "  auth=Bearer ***" : ""}`, ""]);
        snap(auth ? `<b>Log</b> writes the request line. It sits <i>inside</i> Auth, so it can see the Authorization header and must redact it (written as <code>Bearer ***</code>).`
          : `<b>Log</b> writes the request line, then calls the inner handler. It sits outside Auth, so no token is on the request yet: nothing secret can leak here.`, 3, d);
        L.st = "visit"; L.b = "";
        let res;
        try { res = send(d + 1); } catch (e) {
          S.log.push([`✖ ${errText(e)} after ${S.t - t0} ms`, "bad"]);
          return fail(d, e, `<b>Log</b> sees the exception pass, records it with the elapsed time (${S.t - t0} ms) and rethrows. A logging handler observes; it never swallows.`);
        }
        L.st = "active"; L.b = "←";
        S.log.push([`← ${res.status} in ${S.t - t0} ms`, res.status >= 400 ? "bad" : "done"]);
        snap(`<b>Log</b> records <code>${res.status}</code> after ${S.t - t0} ms. ${perTry ? "It sits inside Retry, so this time covers one attempt only." : retryAt >= 0 ? "It sits outside Retry, so this time includes every attempt and backoff wait: it is what the caller felt." : ""}`, 7, d);
        L.st = res.status >= 400 ? "bad" : "done";
        return res;
      },
      Trace(d) {
        const L = S.L[d], perTry = retryAt >= 0 && d > retryAt;
        S.spans++;
        const span = hex(rng, 16), no = S.spans;
        S.hdr.traceparent = `00-${traceId.slice(0, 8)}…-${span.slice(0, 8)}…-01`;
        L.st = "active"; L.b = `span ${no}`;
        snap(`<b>Trace</b> starts client span #${no} and writes <code>traceparent</code> so the server's span joins the same trace. ${retryAt < 0 ? "" : perTry ? "Inside Retry, every attempt gets its own span." : "Outside Retry, one span covers all attempts."}`, 3, d);
        L.st = "visit";
        let res;
        try { res = send(d + 1); } catch (e) { return fail(d, e, `<b>Trace</b> sets span #${no} status to Error, records the exception event and rethrows.`); }
        L.st = "active";
        snap(`<b>Trace</b> ends span #${no} with <code>http.response.status_code=${res.status}</code>.`, 7, d);
        L.st = res.status >= 400 ? "bad" : "done";
        return res;
      },
      Auth(d) {
        const L = S.L[d];
        L.st = "active"; L.b = "token";
        S.hdr.Authorization = `Bearer ${S.token}`;
        snap(`<b>Auth</b> reads the cached access token <code>${S.token}</code> and sets <code>Authorization</code>. Call sites never touch tokens.`, 3, d);
        L.st = "visit";
        let res;
        try {
          res = send(d + 1);
          if (res.status === 401) {
            L.st = "active"; L.b = "refresh";
            snap(`<b>Auth</b> got <code>401</code>: the token was revoked or expired early. It refreshes once (120 ms) and resends. Only Auth knows how to fix a 401, so this is not Retry's job; and it refreshes at most once, or a bad credential would loop forever.`, 7, d);
            spend(120);
            S.refresh++; S.token = `tok-${S.refresh + 1}`; S.hdr.Authorization = `Bearer ${S.token}`;
            snap(`New token <code>${S.token}</code>. Auth sends the same request again through the inner handlers.`, 6, d);
            L.st = "visit";
            res = send(d + 1);
          }
        } catch (e) { return fail(d, e); }
        L.st = "active"; L.b = "←";
        snap(`<b>Auth</b> passes <code>${res.status}</code> up${res.status === 401 ? ": the refreshed token was rejected too, so this is a real authorization failure" : ""}.`, 7, d);
        L.st = res.status >= 400 ? "bad" : "done";
        return res;
      },
      Retry(d) {
        const L = S.L[d];
        for (let a = 1; a <= 3; a++) {
          S.attempt = `${a}/3`; L.st = "active"; L.b = `try ${a}/3`;
          snap(a === 1 ? `<b>Retry</b> starts attempt 1 of 3 and calls the inner handler.` : `<b>Retry</b> sends attempt ${a}. It resends the same request object: fine for a GET without a body; a request with a streamed body must be buffered or rebuilt.`, 6, d);
          L.st = "visit";
          let res = null, err = null;
          try { res = send(d + 1); } catch (e) { err = e; }
          if (err) {
            if (err.kind === "cancel") return fail(d, err, `<b>Retry</b> sees a cancellation that came from <i>outside</i> it (an outer deadline). It never retries that: whoever cancelled has stopped waiting.`);
            if (a === 3) return fail(d, err, `<b>Retry</b> is out of attempts (3/3) and rethrows the last exception.`);
            L.st = "active"; L.b = "transient";
            snap(`<b>Retry</b> caught <code>${errText(err)}</code>: transient. Attempt ${a} of 3 failed, so it will back off and try again.`, 8, d);
          } else {
            if (!transient(res.status) || a === 3) {
              L.st = "active"; L.b = "←";
              snap(transient(res.status) ? `<b>Retry</b> is out of attempts and returns the last response, <code>${res.status}</code>.`
                : `<b>Retry</b> got <code>${res.status}</code>. ${res.status === 401 ? "401 is not transient (retrying with the same token cannot help), so it is returned as-is." : "Not transient, so it returns it."}`, 7, d);
              L.st = res.status >= 400 ? "bad" : "done";
              return res;
            }
            L.st = "active"; L.b = String(res.status);
            snap(`<b>Retry</b> got <code>${res.status}</code>: transient (5xx, 408 or 429). It disposes that response, so the connection goes back to the pool, then backs off.`, 7, d);
          }
          const delay = 200 * 2 ** (a - 1);
          L.b = `wait ${delay} ms`;
          snap(`<b>Retry</b> waits ${delay} ms (exponential backoff; production code adds jitter). The wait observes the cancellation token, so an outer deadline can end it early.`, 9, d);
          try { spend(delay); } catch (e) { return fail(d, e, `An outer deadline fired during the backoff wait. <b>Retry</b> stops immediately: no further attempts once the budget is gone.`); }
        }
        return null;
      },
      Timeout(d) {
        const L = S.L[d], at = S.t + 1000;
        S.dl.push({ at, owner: d });
        L.st = "active"; L.b = `until t=${at}`;
        snap(`<b>Timeout</b> arms a 1 s deadline (until t=${at} ms) with a linked <code>CancellationTokenSource</code>. ${retryAt < 0 ? "" : d > retryAt ? "It sits inside Retry, so it is a <i>per-attempt</i> timeout." : "It sits outside Retry, so it is a <i>total</i> timeout: all attempts and waits share this second."}`, 3, d);
        L.st = "visit";
        try {
          const res = send(d + 1);
          S.dl.pop();
          L.st = "active"; L.b = "←";
          snap(`<b>Timeout</b>: finished at t=${S.t} ms, inside the deadline. It disposes the timer and passes the response up.`, 7, d);
          L.st = res.status >= 400 ? "bad" : "done";
          return res;
        } catch (e) {
          S.dl.pop();
          if (e.kind === "cancel" && e.owner === d) {
            L.st = "bad"; L.b = "timed out";
            snap(`<b>Timeout</b>'s deadline hit at t=${S.t} ms. It cancelled everything inside it and now turns its <i>own</i> cancellation into <code>TimeoutException</code>, so outer layers can tell "too slow" (retryable) from "the caller gave up" (not retryable).`, 8, d);
            throw { kind: "timeout" };
          }
          return fail(d, e);
        }
      },
    };
    const send = (d) => (d === n ? primary() : H[order[d]](d));

    snap(`<code>await client.GetAsync("/orders")</code>. HttpClient hands the request to the outermost handler, <b>${order[0]}</b>. Each handler is a <code>DelegatingHandler</code> whose <code>InnerHandler</code> is the next one down.`, 1);
    let outcome, bad = false;
    try { const res = send(0); outcome = `${res.status}`; bad = res.status >= 400; } catch (e) { outcome = errText(e); bad = true; }
    S.attempt = S.attempt === "-" ? "-" : S.attempt;
    const ins = chainInsights(order).map((x) => `<li>${esc(x)}</li>`).join("");
    snap(`<b>Caller receives ${esc(outcome)}</b> at t=${S.t} ms after ${S.calls} send${S.calls === 1 ? "" : "s"} on the wire. What this order means:<ul>${ins}</ul>`, 10);
    frames[frames.length - 1].final = bad ? "bad" : "done";
    frames[frames.length - 1].outcome = outcome;
    return frames;
  }

  Viz.register("outbound-pipelines-chain", (el) => Viz.player(el, {
    title: "An outbound request through a DelegatingHandler chain",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "handler running now"], ["visit", "request passed down"], ["done", "response passed up"], ["bad", "error / failure status"]],
    code: [
      "class XHandler : DelegatingHandler {",
      "  protected override async Task<HttpResponseMessage> SendAsync(",
      "      HttpRequestMessage req, CancellationToken ct) {",
      "    Before(req);  // header, traceparent, deadline, log →",
      "    for (var attempt = 1; ; attempt++) { // Retry only",
      "      try {",
      "        var res = await base.SendAsync(req, ct); // next",
      "        if (!ShouldRetry(res, attempt)) return After(res);",
      "      } catch (Exception e) when (Transient(e, attempt)) { }",
      "      await Task.Delay(Backoff(attempt), ct);",
      "    } } }",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "order", label: "handlers, outermost first", value: "Log,Retry,Timeout,Auth,Trace", width: 250 },
      { key: "scen", label: "server behaviour", type: "select", value: CH_SCEN[0], options: CH_SCEN },
    ],
    random: () => ({ order: shuffle(CH).slice(0, 3 + Math.floor(Math.random() * 3)).join(","), scen: pick(CH_SCEN) }),
    build: ({ order, scen }) => chainSim(names(order, CH, "Handlers", 1), scen),
    speed: 1300,
    render(f) {
      const n = f.order.length;
      let core = `<div class="ob-layer core ${f.wire.st} ${f.cur === n ? "cur" : ""}"><div class="ob-lname"><span><b>SocketsHttpHandler</b> <small>primary</small></span>${badge(f.wire.b)}</div><div class="ob-server ${f.srv.st}"><span>server</span>${badge(f.srv.b)}</div></div>`;
      for (let d = n - 1; d >= 0; d--) {
        const L = f.L[d];
        core = `<div class="ob-layer ${L.st} ${f.cur === d ? "cur" : ""}"><div class="ob-lname"><span><b>${esc(f.order[d])}</b> <small>${esc(CH_SUB[f.order[d]])}</small></span>${badge(L.b)}</div>${core}</div>`;
      }
      const caller = `<div class="ob-caller ${f.final || ""}">HttpClient.GetAsync("/orders")${f.outcome ? ` → ${esc(f.outcome)}` : ""}</div>`;
      const hdr = kv("request headers on the wire", Object.entries(f.hdr), { empty: "Host, Accept only" });
      return Viz.row(`<div class="ob-onion">${caller}${core}</div>`, `<div class="ob-col">${hdr}${lines("log output", f.log)}</div>`)
        + stats([["elapsed", `${f.t} ms`], ["sends on wire", f.calls, f.calls > 1 ? "active" : ""], ["token refreshes", f.refresh, f.refresh ? "visit" : ""], ["client spans", f.spans]]);
    },
  }));

  /* =====================================================================
   * 2. Connection pooling: socket exhaustion vs stale DNS
   * ===================================================================== */
  const SK = ["new HttpClient per call", "static singleton HttpClient", "IHttpClientFactory (handler lifetime)", "singleton + PooledConnectionLifetime", "Go DefaultTransport (2 idle per host)"];
  const SK_LINES = [[0, 1], [2, 3], [4, 5], [6, 7, 8], [9, 10]];
  const SK_WHY = [
    "Every call builds a new handler and a new TCP+TLS connection, then disposes it. Closing a socket parks its port in TIME_WAIT for minutes, so ports pile up.",
    "One pooled handler for the whole process: connections are reused, so very few ports are used. But a pooled connection keeps talking to the IP it resolved when it was opened.",
    "The factory pools handlers and swaps in a fresh one every handler lifetime. New requests use the new pool (fresh DNS); the old pool drains and closes.",
    "One long-lived handler, but every connection is retired once it is older than PooledConnectionLifetime, so DNS is re-resolved on a rolling basis.",
    "Go reuses connections too, but keeps only MaxIdleConnsPerHost = 2 idle ones. Under concurrency, every other returned connection is closed and reopened later.",
  ];

  function socketsSim(o) {
    const rng = mulberry(11), TICK = 10, end = o.dur * 1000, strat = SK.indexOf(o.strategy);
    const idleTO = strat === 4 ? 90000 : 60000, dnsAt = o.dns * 1000, life = o.life * 1000;
    let pool = { idle: [], busy: 0, closeAt: Infinity };
    let old = [];
    let open = 0, opened = 0, nextRot = life, peak = 0;
    const tw = []; let twH = 0;
    const fly = [];
    const B = Array.from({ length: Math.ceil(o.dur / 10) }, () => ({ ok: 0, stale: 0, fail: 0 }));
    const ser = [], rot = [];
    let firstFail = -1, firstStale = -1, lastStale = -1;
    const close = (c, now) => { open--; tw.push(now + o.tw * 1000); };
    const release = (c, now) => {
      c.pool.busy--;
      if (strat === 0) return close(c, now);
      if (strat === 2 && c.pool !== pool && now >= c.pool.closeAt) return close(c, now);
      if (strat === 3 && now - c.created >= life) return close(c, now);
      if (strat === 4 && c.pool.idle.length >= 2) return close(c, now);
      c.last = now; c.pool.idle.push(c);
    };
    const lam = (o.rps * TICK) / 1000, L = Math.exp(-lam);
    const poisson = () => { let k = 0, p = 1; do { k++; p *= rng(); } while (p > L); return k - 1; };
    for (let now = 0; now < end; now += TICK) {
      for (let i = fly.length - 1; i >= 0; i--) if (fly[i].at <= now) { release(fly[i].c, now); fly.splice(i, 1); }
      while (twH < tw.length && tw[twH] <= now) twH++;
      for (const p of [pool, ...old]) while (p.idle.length && (now - p.idle[0].last >= idleTO || now >= p.closeAt)) close(p.idle.shift(), now);
      old = old.filter((p) => p.busy > 0 || p.idle.length > 0);
      if (strat === 2 && now >= nextRot) { pool.closeAt = now + 10000; old.push(pool); pool = { idle: [], busy: 0, closeAt: Infinity }; rot.push(now / 1000); nextRot += life; }
      const k = poisson(), bi = Math.floor(now / 10000);
      for (let j = 0; j < k; j++) {
        let c = null;
        if (strat !== 0) while (pool.idle.length) { const x = pool.idle.pop(); if (strat === 3 && now - x.created >= life) { close(x, now); continue; } c = x; break; }
        let lat = 20 - 30 * Math.log(1 - rng());
        if (!c) {
          if (open + (tw.length - twH) >= o.ports) { B[bi].fail++; if (firstFail < 0) firstFail = now / 1000; continue; }
          c = { ip: now >= dnsAt ? "new" : "old", created: now, pool, last: now };
          open++; opened++; lat += 30;
        }
        c.pool.busy++;
        if (c.ip === "old" && now >= dnsAt) { B[bi].stale++; lat = 5; if (firstStale < 0) firstStale = now / 1000; lastStale = now / 1000; } else B[bi].ok++;
        fly.push({ c, at: now + Math.ceil(Math.min(lat, 3000) / TICK) * TICK });
      }
      if (now % 1000 === 0) { const t = tw.length - twH; ser.push({ open, tw: t }); peak = Math.max(peak, open + t); }
    }
    return { o, strat, B, ser, rot, opened, peak, firstFail, firstStale, lastStale };
  }

  function socketsFrames(o) {
    const sim = socketsSim(o), frames = [], step = o.dur > 600 ? 30 : 20;
    let prev = 0;
    for (let s = 0; s <= o.dur; s += step) {
      const nb = Math.floor(s / 10), tot = { ok: 0, stale: 0, fail: 0 };
      for (let i = 0; i < nb; i++) { tot.ok += sim.B[i].ok; tot.stale += sim.B[i].stale; tot.fail += sim.B[i].fail; }
      const cur = sim.ser[Math.min(sim.ser.length - 1, Math.max(0, s - 1))] || { open: 0, tw: 0 };
      const ev = [];
      const inWin = (x) => s > 0 && x >= 0 && x <= s && (x > prev || prev === 0);
      if (s === 0) ev.push(`<b>${esc(o.strategy)}</b>: ${SK_WHY[sim.strat]} Traffic: ~${o.rps} req/s; closed sockets stay in TIME_WAIT for ${o.tw} s; ${o.ports} ephemeral ports; DNS for the API moves to a new IP at t=${o.dns} s and the old backend then answers <code>503</code>.`);
      if (inWin(sim.firstFail)) ev.push(`<b>Port exhaustion at t≈${Math.round(sim.firstFail)} s.</b> Open + TIME_WAIT sockets reached ${o.ports}: new connections now fail with <code>SocketException</code> until old TIME_WAIT entries expire. The service is healthy; the client is starving itself.`);
      if (inWin(o.dns)) ev.push(`<b>DNS changed at t=${o.dns} s.</b> Only <i>new</i> connections resolve the new IP. Existing pooled connections keep talking to the old one.`);
      if (inWin(sim.firstStale)) ev.push(`<b>Stale DNS:</b> requests on pooled connections opened before t=${o.dns} s reach the old backend and get <code>503</code>.`);
      sim.rot.forEach((r) => { if (inWin(r)) ev.push(`Handler rotation at t=${r} s: new requests use a fresh pool (fresh DNS); the expired handler drains, then its connections close.`); });
      if (inWin(sim.lastStale) && sim.lastStale < o.dur - 2) ev.push(`Last stale request at t≈${Math.round(sim.lastStale)} s: every connection to the old IP has now been retired.`);
      if (!ev.length) ev.push(`t=${s} s. ${cur.tw > o.ports * 0.8 ? "TIME_WAIT is pinned near the port limit." : sim.strat === 1 && s > o.dns ? "The singleton keeps reusing connections to the old IP; nothing ever re-resolves DNS while traffic keeps them busy." : "Steady state: connections are being reused."} So far ${tot.ok} ok, ${tot.stale} stale, ${tot.fail} failed.`);
      frames.push({ sim, now: s, tot, cur, note: ev.join(" "), line: SK_LINES[sim.strat],
        vars: { t: `${s} s`, open: cur.open, time_wait: cur.tw, ports_free: Math.max(0, o.ports - cur.open - cur.tw), opened: "see stats" } });
      prev = s;
    }
    frames[frames.length - 1].vars.opened = sim.opened;
    return frames;
  }

  Viz.register("outbound-pipelines-sockets", (el) => Viz.player(el, {
    title: "Connection pooling: socket exhaustion vs stale DNS",
    tag: "SIMULATION · 10 ms TICKS",
    legend: [["path", "open connections"], ["visit", "sockets in TIME_WAIT"], ["done", "ok"], ["active", "stale DNS → 503"], ["bad", "no free port"]],
    code: [
      "// A: new client per call (disposed)",
      "using var c = new HttpClient(); await c.GetAsync(url);",
      "// B: one static client",
      "static readonly HttpClient Client = new();",
      "// C: IHttpClientFactory",
      "services.AddHttpClient<Api>(); // rotates every 2 min",
      "// D: static client, connections recycled",
      "static HttpClient Client = new(new SocketsHttpHandler {",
      "    PooledConnectionLifetime = TimeSpan.FromMinutes(2) });",
      "// E: Go: http.DefaultTransport",
      "// MaxIdleConnsPerHost = 2 (DefaultMaxIdleConnsPerHost)",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "strategy", label: "client strategy", type: "select", value: SK[0], options: SK },
      { key: "rps", label: "req/s", value: "200", width: 60 },
      { key: "tw", label: "TIME_WAIT s", value: "120", width: 60 },
      { key: "ports", label: "ephemeral ports", value: "16384", width: 80 },
      { key: "dns", label: "DNS change at s", value: "300", width: 60 },
      { key: "life", label: "lifetime s", value: "120", width: 60 },
      { key: "dur", label: "duration s", value: "600", width: 60 },
    ],
    random: () => ({ strategy: pick(SK), rps: String(Viz.rand(50, 300)), tw: pick(["60", "120", "240"]), ports: pick(["8192", "16384", "28232"]), dns: String(Viz.rand(10, 50) * 10), life: pick(["60", "120", "300"]), dur: "600" }),
    build: (v) => {
      const o = { strategy: v.strategy, rps: int(v.rps, "req/s", 1, 400), tw: int(v.tw, "TIME_WAIT", 1, 240), ports: int(v.ports, "Ephemeral ports", 500, 65535),
        dns: int(v.dns, "DNS change", 0, 900), life: int(v.life, "Lifetime", 10, 900), dur: int(v.dur, "Duration", 60, 900) };
      if (!SK.includes(o.strategy)) throw new Error("Pick a strategy from the list.");
      return socketsFrames(o);
    },
    speed: 900,
    render(f) {
      const { sim, now } = f, o = sim.o;
      const n5 = Math.ceil(o.dur / 5), openL = [], twL = [];
      for (let i = 0; i < n5; i++) { const k = Math.min(sim.ser.length - 1, (i + 1) * 5 - 1); openL.push(sim.ser[k].open); twL.push(sim.ser[k].tw); }
      const tickEvery = o.dur > 600 ? 120 : 60;
      const xt = (per) => Array.from({ length: Math.floor(o.dur / tickEvery) + 1 }, (_, k) => ({ i: (k * tickEvery) / per, label: `${k * tickEvery}s` }));
      const marks = (per) => [{ i: o.dns / per, label: "DNS → new IP", cls: "dns" }, ...sim.rot.filter((r) => r <= now).map((r) => ({ i: r / per, label: "", cls: "rot" }))];
      const c1 = stackChart({ label: "sockets in use over time", w: 600, h: 150, layers: [openL, twL], cls: ["path", "visit"], cut: Math.floor(now / 5), ymax: Math.max(o.ports * 1.15, sim.peak * 1.05),
        cap: o.ports, capLabel: `port limit ${o.ports}`, markers: marks(5), xTicks: xt(5), yLabel: "sockets" });
      const okL = [], stL = [], flL = [];
      sim.B.forEach((b) => { const t = b.ok + b.stale + b.fail || 1; okL.push((100 * b.ok) / t); stL.push((100 * b.stale) / t); flL.push((100 * b.fail) / t); });
      const c2 = stackChart({ label: "request outcomes per 10 s", w: 600, h: 120, layers: [okL, stL, flL], cls: ["done", "active", "bad"], cut: Math.floor(now / 10), ymax: 100,
        fmtY: (v) => `${Math.round(v)}%`, markers: marks(10).map((m) => ({ ...m, label: "" })), xTicks: xt(10), yLabel: "outcome %" });
      const t = f.tot, all = t.ok + t.stale + t.fail;
      return `<div class="ob-fit">${c1}</div><div class="ob-fit">${c2}</div>` + stats([
        ["requests", all], ["ok", t.ok, "done"], ["stale 503", t.stale, t.stale ? "active" : ""], ["no free port", t.fail, t.fail ? "bad" : ""],
        ["open now", f.cur.open, "path"], ["TIME_WAIT now", f.cur.tw, "visit"]]);
    },
  }));

  /* =====================================================================
   * 3. Token refresh: naive vs single-flight vs proactive
   * ===================================================================== */
  const TK_MODES = ["naive: every 401 refreshes", "single-flight on 401", "proactive + single-flight"];

  function tokenSim(o) {
    const N = o.lanes, T = o.ticks, mode = TK_MODES.indexOf(o.mode);
    const cells = Array.from({ length: N }, () => Array(T).fill(null));
    const idp = Array(T).fill(0), idpCum = Array(T).fill(0), notes = Array.from({ length: T }, () => []), lineAt = Array.from({ length: T }, () => new Set());
    const expOf = { 1: o.exp };
    let cache = { ver: 1, rt: 1 };
    let idpRT = 1, revoked = false, nextVer = 2;
    const lane = Array.from({ length: N }, () => ({ st: "send", until: -1, rt: 0, fail: false }));
    let flight = null;
    const tot = { ok: 0, e401: 0, idp: 0, failed: 0, reuse: 0 };
    const idpRefresh = (rt, t) => {
      tot.idp++;
      if (revoked || (o.rotation && rt !== idpRT)) {
        if (!revoked && o.rotation) { revoked = true; tot.reuse++; notes[t].push(`IdP sees refresh token #${rt} used twice: <b>reuse detection revokes the whole token family</b> (OAuth 2.0 Security BCP). Access tokens already issued keep working until they expire, but no refresh token from this family will ever work again.`); }
        return null;
      }
      const v = nextVer++;
      expOf[v] = t + 1000;
      if (o.rotation) idpRT++;
      return { ver: v, rt: o.rotation ? idpRT : cache.rt };
    };
    const valid = (v, t) => t < expOf[v];
    for (let t = 0; t < T; t++) {
      if (mode === 2 && !flight && !revoked && t >= expOf[cache.ver] - o.skew && cache.ver === nextVer - 1) {
        flight = { done: t + o.dur - 1, rt: cache.rt, seen: cache.ver, leader: -1 };
        notes[t].push(`Token expires at tick ${expOf[cache.ver]}; with ${o.skew} ticks of skew a <b>background refresh starts now</b> while every lane keeps using the still-valid token.`);
        lineAt[t].add(1);
      }
      for (let i = 0; i < N; i++) {
        const L = lane[i];
        if (L.fail) { cells[i][t] = "fail"; continue; }
        if (L.st === "refresh") { cells[i][t] = "refresh"; continue; }
        if (L.st === "wait") { cells[i][t] = "wait"; lineAt[t].add(3); continue; }
        const used = cache.ver;
        if (valid(used, t)) { cells[i][t] = "ok"; tot.ok++; lineAt[t].add(0); continue; }
        cells[i][t] = "401"; tot.e401++;
        if (mode === 0) {
          L.st = "refresh"; L.until = t + o.dur; L.rt = cache.rt; lineAt[t].add(10);
        } else if (flight) {
          L.st = "wait";
        } else if (cache.ver !== used) {
          L.st = "send";
        } else {
          flight = { done: t + o.dur, rt: cache.rt, seen: used, leader: i };
          L.st = "refresh"; lineAt[t].add(6);
        }
      }
      idp[t] = lane.filter((L) => mode === 0 && !L.fail && L.st === "refresh" && L.until - o.dur + 1 <= t && t <= L.until).length + (flight && flight.done - o.dur + 1 <= t && t <= flight.done ? 1 : 0);
      const started401 = cells.filter((r) => r[t] === "401").length;
      if (started401) {
        if (mode === 0) notes[t].push(`${started401} lane${started401 > 1 ? "s" : ""} got <code>401</code>, and <b>each one starts its own refresh</b> with refresh token #${cache.rt}.`);
        else notes[t].push(`${started401} lane${started401 > 1 ? "s" : ""} got <code>401</code>. The first takes the gate and refreshes; the rest <b>wait on the same task</b> instead of calling the IdP.`);
      }
      // completions at the end of the tick
      if (mode === 0) {
        lane.forEach((L, i) => {
          if (L.fail || L.st !== "refresh" || L.until !== t) return;
          const r = idpRefresh(L.rt, t);
          if (!r) { L.fail = true; tot.failed++; notes[t].push(`Lane ${i + 1}: <code>invalid_grant</code>. The user is effectively logged out.`); return; }
          cache = { ver: r.ver, rt: r.rt }; L.st = "send";
          notes[t].push(`Lane ${i + 1} stores token v${r.ver}${o.rotation ? ` and refresh token #${r.rt}` : ""} (last writer wins).`);
        });
      }
      if (flight && flight.done === t) {
        const r = idpRefresh(flight.rt, t);
        const waiters = lane.filter((L) => !L.fail && (L.st === "wait" || L.st === "refresh"));
        if (!r) { waiters.forEach((L) => { L.fail = true; tot.failed++; }); notes[t].push(`Refresh failed; every waiting lane fails with it.`); }
        else { cache = { ver: r.ver, rt: r.rt }; waiters.forEach((L) => { L.st = "send"; }); notes[t].push(`Refresh done: token v${r.ver}. ${waiters.length ? `${waiters.length} lane${waiters.length > 1 ? "s" : ""} resume${waiters.length > 1 ? "" : "s"} with it, sharing <b>one</b> IdP call.` : "No lane ever waited."}`); lineAt[t].add(7); }
        flight = null;
      }
      idpCum[t] = tot.idp;
    }
    return { o, cells, idp, idpCum, notes, lineAt, tot };
  }

  Viz.register("outbound-pipelines-token", (el) => Viz.player(el, {
    title: "Token refresh under concurrency: stampede vs single-flight",
    tag: "SIMULATION · ONE COLUMN PER TICK",
    legend: [["done", "request ok"], ["bad", "401 / failed"], ["active", "calling the IdP"], ["visit", "waiting for someone else's refresh"]],
    code: [
      "string Token => _current.Value;        // fast path",
      "if (_current.ExpiresAt - Skew <= now) Refresh(_current);",
      "async Task<Token> Refresh(Token seen) {",
      "    await _gate.WaitAsync();            // single flight",
      "    try {",
      "        if (_current != seen) return _current; // done",
      "        _current = await _idp.Refresh(_current.Rt);",
      "        return _current;                // waiters reuse it",
      "    } finally { _gate.Release(); }",
      "}",
      "// naive: every 401 → await _idp.Refresh(rt) (no gate)",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "mode", label: "strategy", type: "select", value: TK_MODES[0], options: TK_MODES },
      { key: "rotation", label: "refresh-token rotation", type: "select", value: "on", options: ["on", "off"] },
      { key: "lanes", label: "concurrent callers", value: "5", width: 60 },
      { key: "exp", label: "token expires at tick", value: "5", width: 60 },
      { key: "dur", label: "refresh takes", value: "3", width: 50 },
      { key: "skew", label: "skew", value: "4", width: 50 },
      { key: "ticks", label: "ticks", value: "18", width: 50 },
    ],
    random: () => ({ mode: pick(TK_MODES), rotation: pick(["on", "off"]), lanes: String(Viz.rand(2, 8)), exp: String(Viz.rand(3, 8)), dur: String(Viz.rand(1, 4)), skew: String(Viz.rand(2, 5)), ticks: "18" }),
    build: (v) => {
      const o = { mode: v.mode, rotation: v.rotation === "on", lanes: int(v.lanes, "Callers", 1, 8), exp: int(v.exp, "Expiry tick", 1, 25), dur: int(v.dur, "Refresh duration", 1, 6), skew: int(v.skew, "Skew", 1, 10), ticks: int(v.ticks, "Ticks", 8, 30) };
      if (o.exp >= o.ticks) throw new Error("Make the token expire before the last tick.");
      const sim = tokenSim(o), frames = [];
      frames.push({ sim, t: -1, note: `${o.lanes} callers share one cached access token (v1) that the server stops accepting at tick ${o.exp}. A refresh takes ${o.dur} tick${o.dur > 1 ? "s" : ""}. ${o.rotation ? "The IdP <b>rotates</b> refresh tokens: each one is single-use." : "Refresh tokens are reusable (no rotation)."}`, line: [], vars: { tick: "-", token: "v1" } });
      let ver = 1;
      for (let t = 0; t < o.ticks; t++) {
        const nt = sim.notes[t];
        nt.forEach((s) => { const m = /token v(\d+)/.exec(s); if (m) ver = +m[1]; });
        const col = sim.cells.map((r) => r[t]);
        const base = col.every((c) => c === "ok") ? "All lanes succeed with the cached token." : col.every((c) => c === "fail") ? "Every lane is dead: the session needs an interactive sign-in." : col.every((c) => c === "ok" || c === "fail") ? `${col.filter((c) => c === "ok").length} lane(s) succeed; ${col.filter((c) => c === "fail").length} stay logged out.` : "";
        frames.push({ sim, t, note: `<b>Tick ${t}.</b> ${nt.join(" ") || base || "Lanes keep working."}`, line: [...sim.lineAt[t]], vars: { tick: t, token: `v${ver}`, idp_calls_done: sim.idpCum[t], refreshes_in_flight: sim.idp[t] } });
      }
      const T = sim.tot, last = frames[frames.length - 1];
      last.note += ` <br><b>Totals:</b> ${T.e401} × 401, ${T.idp} IdP refresh call${T.idp === 1 ? "" : "s"}, ${T.failed} lane${T.failed === 1 ? "" : "s"} logged out.`;
      return frames;
    },
    speed: 1000,
    render(f) {
      const { sim, t } = f, o = sim.o, GL = { ok: "✓", 401: "401", refresh: "R", wait: "…", fail: "✖" }, CL = { ok: "done", 401: "bad", refresh: "active", wait: "visit", fail: "bad dead" };
      let h = `<table class="ob-tl"><tr><th></th>${Array.from({ length: o.ticks }, (_, k) => `<th class="${k === t ? "cur" : ""}">${k}</th>`).join("")}</tr>`;
      sim.cells.forEach((row, i) => {
        h += `<tr><th>caller ${i + 1}</th>${row.map((c, k) => (k > t ? `<td class="fut"></td>` : `<td class="${CL[c]} ${k === t ? "cur" : ""}">${GL[c]}</td>`)).join("")}</tr>`;
      });
      h += `<tr class="idprow"><th>IdP calls</th>${sim.idp.map((v, k) => (k > t ? `<td class="fut"></td>` : `<td class="${k === t ? "cur" : ""}">${v ? `<i class="${v > 1 ? "hot" : ""}" style="height:${Math.min(100, v * 22)}%"></i><em>${v}</em>` : ""}</td>`)).join("")}</tr>`;
      h += `<tr class="exprow"><th>token v1</th>${Array.from({ length: o.ticks }, (_, k) => `<td class="${k < o.exp ? "ok" : "exp"}"></td>`).join("")}</tr></table>`;
      const sofar = { e401: 0, fail: 0, ok: 0 };
      sim.cells.forEach((r) => r.slice(0, t + 1).forEach((c) => { if (c === "401") sofar.e401++; if (c === "ok") sofar.ok++; }));
      sofar.fail = sim.cells.filter((r) => t >= 0 && r[t] === "fail").length;
      const idpSoFar = t >= 0 ? sim.idpCum[t] : 0;
      return `<div class="ob-fit">${h}</div>` + stats([["ok requests", sofar.ok, "done"], ["401 responses", sofar.e401, sofar.e401 ? "bad" : ""], ["IdP refresh calls", idpSoFar, idpSoFar > 1 ? "active" : ""], ["callers logged out", sofar.fail, sofar.fail ? "bad" : ""]]);
    },
  }));

  /* =====================================================================
   * 4. Registration order → execution order, library by library
   * ===================================================================== */
  const lc = (x) => x.charAt(0).toLowerCase() + x.slice(1);
  const LIBS = [
    { id: ".NET AddHttpMessageHandler", first: true, snip: (r) => ["services.AddHttpClient<OrdersClient>()", ...r.map((x) => `    .AddHttpMessageHandler<${x}Handler>()`)], why: "IHttpClientFactory builds the chain in registration order: the first handler added is the outermost. (Its built-in logging adds one handler outside all of yours, which logs the whole logical call, and one innermost, next to the primary handler, which logs every attempt.)" },
    { id: "OkHttp addInterceptor", first: true, snip: (r) => ["new OkHttpClient.Builder()", ...r.map((x) => `    .addInterceptor(${lc(x)})`), "    .build();"], why: "Interceptors run in the order added; each calls chain.proceed(request) to reach the next." },
    { id: "Spring RestClient requestInterceptor", first: true, snip: (r) => ["RestClient.builder()", ...r.map((x) => `    .requestInterceptor(${lc(x)})`), "    .build();"], why: "ClientHttpRequestInterceptors run in list order; execution.execute(request, body) calls the next one." },
    { id: "Spring WebClient filter", first: true, snip: (r) => ["WebClient.builder()", ...r.map((x) => `    .filter(${lc(x)})`), "    .build();"], why: "ExchangeFilterFunctions are combined with andThen, so the first filter added wraps all later ones." },
    { id: "axios interceptors", first: false, snip: (r) => r.flatMap((x) => [`api.interceptors.request.use(${lc(x)}.onRequest);`, `api.interceptors.response.use(${lc(x)}.onResponse);`]), why: "Request interceptors run last-registered-first; response interceptors run first-registered-first. The net effect is an onion whose outermost layer is the LAST registration." },
    { id: "Go RoundTripper wrap loop", first: false, snip: (r) => ["var rt http.RoundTripper = http.DefaultTransport", `for _, mw := range []Middleware{${r.join(", ")}} {`, "    rt = mw(rt) // wraps everything so far", "}"], why: "A forward loop wraps the previous result, so the last element ends up outermost. Loop backwards if you want list order." },
    { id: "Go grpc.WithChainUnaryInterceptor", first: true, snip: (r) => ["conn, err := grpc.NewClient(target,", `    grpc.WithChainUnaryInterceptor(${r.join(", ")}))`], why: "The first interceptor in the chain is the outermost." },
    { id: "grpc-java ClientInterceptors.intercept", first: false, snip: (r) => [`Channel ch = ClientInterceptors.intercept(channel, ${r.join(", ")});`], why: "Documented: the last interceptor has its interceptCall called first. ManagedChannelBuilder.intercept(...) behaves the same way." },
    { id: "TypeScript compose (reduceRight)", first: true, snip: (r) => [`const send = [${r.join(", ")}]`, "  .reduceRight((next, mw) => mw(next), fetch);"], why: "reduceRight starts wrapping from the end of the array, so the first element ends up outermost." },
    { id: "MediatR AddOpenBehavior", first: true, snip: (r) => ["services.AddMediatR(cfg => {", ...r.map((x) => `    cfg.AddOpenBehavior(typeof(${x}Behavior<,>));`), "});"], why: "Pipeline behaviors wrap the handler in registration order: the first registered is the outermost." },
    { id: "httpx event_hooks (not an onion)", hooks: true, snip: (r) => ["client = httpx.Client(event_hooks={", `    "request":  [${r.map((x) => `${x.toLowerCase()}_req`).join(", ")}],`, `    "response": [${r.map((x) => `${x.toLowerCase()}_res`).join(", ")}],`, "})"], why: "Hooks are callbacks, not wrappers. Both lists run in list order, and a hook can observe or mutate but cannot catch an exception, retry, or short-circuit. Use httpx.Auth or a custom transport for that." },
  ];

  function orderFrames(reg, lib) {
    const L = LIBS.find((x) => x.id === lib);
    if (!L) throw new Error("Pick a library from the list.");
    const snip = L.snip(reg), frames = [], trail = [];
    const exec = L.hooks ? reg.slice() : L.first ? reg.slice() : reg.slice().reverse();
    const at = (x, ph) => {
      const re = new RegExp(`(^|[^A-Za-z0-9])(${x}|${lc(x)}|${x.toLowerCase()})(?![a-z0-9])`);
      const cand = snip.map((s, i) => [s, i]).filter(([s]) => re.test(s));
      if (!cand.length) return -1;
      const pref = ph === "out" ? /response/ : ph === "in" ? /request/ : null;
      const hit = pref && cand.find(([s]) => pref.test(s));
      return (hit || cand[0])[1];
    };
    const push = (o) => frames.push({ L, reg, exec, snip, trail: trail.slice(), ...o });
    push({ phase: "reg", upto: -1, note: `Registration order: <b>${reg.join(" → ")}</b>. The question every library answers differently: which one runs first?`, line: 0, vars: { phase: "register", built: "-" } });
    reg.forEach((x, i) => push({ phase: "reg", upto: i, hi: at(x, "reg"), note: `Register <b>${esc(x)}</b> (#${i + 1}).`, line: 0, vars: { phase: "register", registered: reg.slice(0, i + 1).join(",") } }));
    push({ phase: "built", upto: reg.length - 1, note: L.hooks ? `httpx keeps two flat lists. ${esc(L.why)}` : `Built. Execution order, outermost first: <b>${exec.join(" → ")}</b>. ${esc(L.why)}`, line: L.hooks ? 0 : L.first ? 2 : 3, vars: { phase: "build", outermost: L.hooks ? "n/a" : exec[0] } });
    exec.forEach((x, i) => {
      trail.push([`${x}${L.hooks ? ".request_hook" : ".before"}`, "in"]);
      push({ phase: "in", cur: x, depth: i, hi: at(x, "in"), note: L.hooks ? `Request hook <b>${esc(x)}</b> runs (hook ${i + 1} of ${exec.length}). It sees the request, returns, and the next hook runs. Nothing is "inside" anything.` : `Request phase: <b>${esc(x)}</b> runs its before-code, then calls next. ${i === 0 ? "It is the outermost layer, so it sees the request first and the response last." : ""}`, line: 5, vars: { phase: "request", running: x } });
    });
    trail.push(["network", "net"]);
    push({ phase: "net", note: "The terminal handler does the actual I/O and a response comes back.", line: 4, vars: { phase: "network", running: "transport" } });
    const back = L.hooks ? reg.slice() : exec.slice().reverse();
    back.forEach((x, i) => {
      trail.push([`${x}${L.hooks ? ".response_hook" : ".after"}`, "out"]);
      push({ phase: "out", cur: x, depth: exec.indexOf(x), hi: at(x, "out"), note: L.hooks ? `Response hook <b>${esc(x)}</b> runs, again in list order. ${i === 0 ? "Notice it is the same order as the request hooks: there is no unwinding, which is why hooks cannot wrap behaviour." : ""}` : `Response phase: <b>${esc(x)}</b> runs its after-code. Unwinding goes innermost → outermost.`, line: 6, vars: { phase: "response", running: x } });
    });
    push({ phase: "end", note: `Done. Trace: <code>${trail.map((t) => t[0]).join(" → ")}</code>. ${L.hooks ? "Flat callbacks, list order both ways." : `Outermost = <b>${exec[0]}</b> (the ${L.first ? "first" : "last"} registration).`}`, line: 4, vars: { phase: "done", outermost: L.hooks ? "n/a" : exec[0] } });
    return frames;
  }

  Viz.register("outbound-pipelines-order", (el) => Viz.player(el, {
    title: "Registration order vs execution order, across libraries",
    tag: "STEP THROUGH",
    legend: [["active", "running now"], ["visit", "request phase done"], ["done", "response phase done"]],
    code: [
      "chain = [A, B, C]     # registration order",
      "h = transport         # terminal: does I/O",
      "for mw in reversed(chain): h = mw(h)  # first = outer",
      "for mw in chain: h = mw(h)            # last = outer",
      "response = h(request)",
      "    # mw: before(req); res = next(req)",
      "    #     after(res); return res",
    ],
    codeLang: "python",
    inputs: [
      { key: "reg", label: "registered, in order", value: "Auth,Logging,Retry", width: 200 },
      { key: "lib", label: "library", type: "select", value: LIBS[0].id, options: LIBS.map((x) => x.id) },
    ],
    random: () => ({ reg: shuffle(["Auth", "Logging", "Retry", "Tracing", "Timeout"]).slice(0, Viz.rand(2, 4)).join(","), lib: pick(LIBS).id }),
    build: ({ reg, lib }) => {
      const r = String(reg).split(/[\s,]+/).filter(Boolean);
      if (r.length < 1 || r.length > 5) throw new Error("Register 1–5 names, separated by commas.");
      if (r.some((x) => !/^[A-Za-z][A-Za-z0-9]{0,11}$/.test(x))) throw new Error("Names: letters/digits, start with a letter, at most 12 characters.");
      if (new Set(r.map((x) => x.toLowerCase())).size !== r.length) throw new Error("Use each name once.");
      return orderFrames(r.map((x) => x.charAt(0).toUpperCase() + x.slice(1)), lib);
    },
    speed: 1000,
    render(f) {
      const { L, reg, exec } = f;
      const regRow = `<div class="ob-chips">${reg.map((x, i) => `<span class="ob-chip ${f.upto !== undefined && i <= f.upto ? "visit" : "dim"}"><small>#${i + 1}</small> ${esc(x)}</span>`).join("")}</div>`;
      const st = (x) => {
        const done = f.trail.some((t) => t[0].startsWith(x + ".") && t[1] === "out"), inn = f.trail.some((t) => t[0].startsWith(x + ".") && t[1] === "in");
        return f.cur === x ? "active cur" : done ? "done" : inn ? "visit" : "";
      };
      let body;
      if (f.phase === "reg" && f.upto < reg.length - 1) body = `<div class="ob-hint">registering…</div>`;
      else if (L.hooks) {
        body = `<div class="ob-hooks"><div><div class="ob-kv-h">request hooks</div>${reg.map((x) => `<span class="ob-chip ${f.trail.some((t) => t[0] === `${x}.request_hook`) ? (f.cur === x && f.phase === "in" ? "active" : "visit") : ""}">${esc(x)}</span>`).join("")}</div>
          <div class="ob-net ${f.trail.some((t) => t[1] === "net") ? "done" : ""}">network</div>
          <div><div class="ob-kv-h">response hooks</div>${reg.map((x) => `<span class="ob-chip ${f.trail.some((t) => t[0] === `${x}.response_hook`) ? (f.cur === x && f.phase === "out" ? "active" : "done") : ""}">${esc(x)}</span>`).join("")}</div></div>`;
      } else {
        let core = `<div class="ob-layer core ${f.phase === "net" ? "active cur" : f.trail.some((t) => t[1] === "net") ? "done" : ""}"><div class="ob-lname"><b>transport / handler</b></div></div>`;
        for (let d = exec.length - 1; d >= 0; d--) core = `<div class="ob-layer ${st(exec[d])}"><div class="ob-lname"><span><b>${esc(exec[d])}</b> <small>registered #${reg.indexOf(exec[d]) + 1}</small></span>${d === 0 ? badge("outermost") : ""}</div>${core}</div>`;
        body = `<div class="ob-onion narrow">${core}</div>`;
      }
      const snip = `<pre class="ob-snip">${f.snip.map((s, i) => `<span class="${i === f.hi ? "hi" : ""}">${esc(s)}</span>`).join("\n")}</pre>`;
      const trail = `<div class="ob-trail">${f.trail.map((t, i) => `<span class="${t[1]} ${i === f.trail.length - 1 ? "cur" : ""}">${esc(t[0])}</span>`).join("")}</div>`;
      return regRow + Viz.row(body, `<div class="ob-col">${snip}</div>`) + trail;
    },
  }));

  /* =====================================================================
   * 5. OkHttp: application vs network interceptors
   * ===================================================================== */
  const OK_LAYERS = [
    { n: "AppLog", k: "application interceptor", g: "app" },
    { n: "RetryAndFollowUpInterceptor", k: "retries routes, follows redirects" },
    { n: "BridgeInterceptor", k: "adds Host, gzip, User-Agent; unzips" },
    { n: "CacheInterceptor", k: "serves / validates from cache" },
    { n: "ConnectInterceptor", k: "opens or reuses a connection" },
    { n: "NetLog", k: "network interceptor", g: "net" },
    { n: "CallServerInterceptor", k: "writes request, reads response" },
  ];
  const OK_SCEN = ["200 with gzip", "301 redirect", "fresh cache hit", "conditional GET → 304", "first route refused"];

  function okFrames(scen) {
    const frames = [], cnt = { app: 0, net: 0, srv: 0 };
    const st = OK_LAYERS.map(() => "");
    let route = 1;
    const snap = (i, dir, req, res, note, line) => frames.push({ i, dir, st: st.slice(), req: req ? { ...req } : null, res: res ? { ...res } : null, cnt: { ...cnt }, note, line,
      vars: { layer: i < 0 ? "-" : i === 7 ? "server" : OK_LAYERS[i].n.replace("Interceptor", ""), direction: dir, app_calls: cnt.app, net_calls: cnt.net } });
    const proceed = (i, rq) => {
      const me = OK_LAYERS[i];
      st[i] = "active";
      if (i === 0) {
        cnt.app++;
        snap(i, "↓", rq, null, `<b>Application interceptor</b> sees the request exactly as your code built it: no Host, no Accept-Encoding, no cache headers. It runs <b>once per call</b>, no matter what happens below.`, 6);
        st[i] = "visit";
        const r = proceed(1, rq);
        st[i] = "active";
        snap(i, "↑", rq, r, `<b>Application interceptor</b> sees the <i>final</i> response: ${r._why || "decoded and complete"}. Counters: application ${cnt.app}, network ${cnt.net}.`, 8);
        st[i] = "done";
        return r;
      }
      if (i === 1) {
        let req = rq;
        for (;;) {
          snap(i, "↓", req, null, `<b>RetryAndFollowUp</b> owns the loop that can send more than one network request for this call.`, 7);
          st[i] = "visit";
          let r;
          try { r = proceed(2, req); } catch (e) {
            st[i] = "active";
            snap(i, "↑", req, null, `<b>RetryAndFollowUp</b> caught <code>ConnectException</code> before anything was sent. <code>retryOnConnectionFailure</code> is true by default, so it tries the next route (10.0.0.6). Interceptors above never see this.`, 7);
            route++;
            continue;
          }
          st[i] = "active";
          if (r.code === 301) {
            snap(i, "↑", req, r, `<b>RetryAndFollowUp</b> gets <code>301</code> and builds a follow-up request to <code>${r.Location}</code>. It goes back down: the network interceptor will run again.`, 7);
            req = { ...req, url: r.Location };
            continue;
          }
          snap(i, "↑", req, r, `<b>RetryAndFollowUp</b>: no follow-up needed, returns the response.`, 8);
          st[i] = "done";
          return r;
        }
      }
      if (i === 2) {
        const b = { ...rq, Host: "api.shop.test", Connection: "Keep-Alive", "Accept-Encoding": "gzip", "User-Agent": "okhttp/4.12.0" };
        snap(i, "↓", b, null, `<b>Bridge</b> turns your request into a network request: adds <code>Host</code>, <code>Connection</code>, <code>Accept-Encoding: gzip</code> and <code>User-Agent</code>.`, 7);
        st[i] = "visit";
        let r = proceed(3, b);
        st[i] = "active";
        if (r["Content-Encoding"] === "gzip") {
          r = { ...r }; delete r["Content-Encoding"]; delete r["Content-Length"]; r._why = "already gunzipped by Bridge, so Content-Encoding and Content-Length are gone";
          snap(i, "↑", b, r, `<b>Bridge</b> asked for gzip itself, so it transparently gunzips the body and strips <code>Content-Encoding</code>/<code>Content-Length</code>.`, 8);
        } else snap(i, "↑", b, r, `<b>Bridge</b> passes the response up.`, 8);
        st[i] = "done";
        return r;
      }
      if (i === 3) {
        if (scen === "fresh cache hit") {
          const r = { code: 200, "Cache-Control": "max-age=60", Age: "12", _why: "served from the disk cache; no network at all" };
          snap(i, "↑", rq, r, `<b>Cache</b> has a fresh entry (age 12 s &lt; max-age 60). It answers immediately: Connect, the network interceptor and the server never run.`, 8);
          st[i] = "done";
          return r;
        }
        let req = rq;
        if (scen === "conditional GET → 304") {
          req = { ...rq, "If-None-Match": '"v7"' };
          snap(i, "↓", req, null, `<b>Cache</b> has a <i>stale</i> entry with ETag <code>"v7"</code>, so it adds <code>If-None-Match</code> to revalidate instead of re-downloading.`, 7);
        } else snap(i, "↓", req, null, `<b>Cache</b>: nothing usable cached, pass through.`, 7);
        st[i] = "visit";
        let r = proceed(4, req);
        st[i] = "active";
        if (r.code === 304) {
          r = { code: 200, ETag: '"v7"', "Cache-Control": "max-age=60", _why: "a 200 rebuilt from the cache after a 304: your code never sees the 304" };
          snap(i, "↑", req, r, `<b>Cache</b> got <code>304 Not Modified</code>: it merges the new headers with the cached body and returns a <code>200</code>.`, 8);
        } else snap(i, "↑", req, r, `<b>Cache</b> stores the response if it is cacheable and passes it up.`, 8);
        st[i] = "done";
        return r;
      }
      if (i === 4) {
        if (scen === "first route refused" && route === 1) {
          st[i] = "bad";
          snap(i, "✖", rq, null, `<b>Connect</b> tries route 1 (10.0.0.5:443): connection refused. The exception unwinds before the network interceptor ran.`, 7);
          st[i] = "";
          throw new Error("connect");
        }
        snap(i, "↓", rq, null, `<b>Connect</b> ${route > 1 ? "connects on route 2 (10.0.0.6)" : "takes a pooled connection (or opens one)"}. Only from here on is there a real socket.`, 7);
        st[i] = "visit";
        const r = proceed(5, rq);
        st[i] = "done";
        return r;
      }
      if (i === 5) {
        cnt.net++;
        snap(i, "↓", rq, null, `<b>Network interceptor</b> (call #${cnt.net}) sees what really goes on the wire: Bridge's headers${rq["If-None-Match"] ? ", the cache's If-None-Match" : ""}, and the connection (<code>chain.connection()</code> is non-null here).`, 6);
        st[i] = "visit";
        const r = proceed(6, rq);
        st[i] = "active";
        snap(i, "↑", rq, r, `<b>Network interceptor</b> sees the raw response${r["Content-Encoding"] ? ", still gzipped" : ""}: <code>${r.code}</code>.`, 8);
        st[i] = "done";
        return r;
      }
      if (i === 6) {
        cnt.srv++;
        snap(i, "↓", rq, null, `<b>CallServer</b> writes the request bytes.`, 7);
        let r;
        if (scen === "301 redirect" && rq.url === "/items") r = { code: 301, Location: "/v2/items" };
        else if (scen === "conditional GET → 304") r = { code: 304, ETag: '"v7"' };
        else r = { code: 200, "Content-Encoding": "gzip", "Content-Length": "312", "Cache-Control": "max-age=60" };
        st[i] = "done";
        snap(7, "↑", rq, r, `Server answers <code>${r.code}</code>.`, 7);
        return r;
      }
      return null;
    };
    const req0 = { method: "GET", url: "/items", Authorization: "Bearer ***" };
    snap(-1, "", req0, null, `<code>client.newCall(request).execute()</code>. Scenario: <b>${esc(scen)}</b>. Watch which interceptor runs how many times, and which headers each one can see.`, 0);
    proceed(0, req0);
    frames.push({ ...frames[frames.length - 1], i: -1, note: `Done. Application interceptor ran <b>${cnt.app}×</b>, network interceptor <b>${cnt.net}×</b>, server hit <b>${cnt.srv}×</b>. Put auth/logging of the <i>logical</i> call in an application interceptor; put wire-level concerns (exact headers, bytes on the wire, per-hop timing) in a network interceptor.`, line: 2 });
    return frames;
  }

  Viz.register("outbound-pipelines-okhttp", (el) => Viz.player(el, {
    title: "OkHttp: application vs network interceptors",
    tag: "STEP THROUGH",
    legend: [["active", "running"], ["visit", "waiting on chain.proceed()"], ["done", "returned"], ["bad", "failed"]],
    code: [
      "OkHttpClient client = new OkHttpClient.Builder()",
      "    .addInterceptor(appLog)        // per call",
      "    .addNetworkInterceptor(netLog) // per request",
      "    .cache(new Cache(dir, 10L << 20)).build();",
      "",
      "Response intercept(Chain chain) {",
      "  Request req = chain.request(); log(\"→\", req);",
      "  Response res = chain.proceed(req); // next",
      "  log(\"←\", res.code()); return res;",
      "}",
    ],
    codeLang: "java",
    inputs: [{ key: "scen", label: "scenario", type: "select", value: OK_SCEN[0], options: OK_SCEN }],
    random: () => ({ scen: pick(OK_SCEN) }),
    build: ({ scen }) => { if (!OK_SCEN.includes(scen)) throw new Error("Pick a scenario."); return okFrames(scen); },
    speed: 1200,
    render(f) {
      const stack = `<div class="ob-stack">${OK_LAYERS.map((L, i) => `<div class="ob-slot ${f.st[i]} ${f.i === i ? "cur" : ""} ${L.g || "int"}"><span><b>${esc(L.n)}</b><small>${esc(L.k)}</small></span>${f.i === i ? badge(f.dir) : ""}</div>`).join("")}<div class="ob-slot server ${f.i === 7 ? "active cur" : ""}"><span><b>server</b><small>api.shop.test</small></span>${f.i === 7 ? badge("↑") : ""}</div></div>`;
      const rq = f.req ? Object.entries(f.req).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k, v]) : [];
      const rs = f.res ? Object.entries(f.res).filter(([k]) => !k.startsWith("_")).map(([k, v]) => [k === "code" ? "status" : k, v]) : [];
      return Viz.row(stack, `<div class="ob-col">${kv("request as seen here", rq)}${kv("response as seen here", rs, { empty: "not yet" })}</div>`)
        + stats([["application interceptor", f.cnt.app, "path"], ["network interceptor", f.cnt.net, "visit"], ["server requests", f.cnt.srv]]);
    },
  }));

  /* =====================================================================
   * 6. MediatR-style pipeline behaviors
   * ===================================================================== */
  const MB = ["Logging", "Authorization", "Validation", "Transaction"];
  const MB_SUB = { Logging: "start/end + outcome", Authorization: "may this user do it?", Validation: "is the command well-formed?", Transaction: "BEGIN … COMMIT / ROLLBACK" };
  const MCMD = ["valid order", "quantity = 0", "user not allowed", "not allowed AND quantity = 0", "DB conflict on save"];

  function medFrames(order, cmd) {
    const n = order.length, frames = [];
    const S = { L: order.map(() => ({ st: "", b: "" })), h: { st: "", b: "" }, log: [], tx: "none", rows: [], tx0: 0, wasted: false };
    const bad = { auth: cmd.includes("not allowed"), qty: cmd.includes("quantity"), conflict: cmd === "DB conflict on save" };
    const snap = (note, line, cur) => frames.push({ note, line, cur, order, L: S.L.map((x) => ({ ...x })), h: { ...S.h }, log: S.log.slice(), tx: S.tx, rows: S.rows.slice(),
      vars: { behavior: cur === undefined ? "-" : cur === n ? "handler" : order[cur], tx: S.tx, rows: S.rows.length } });
    const fail = (d, e, note) => { S.L[d].st = "bad"; S.L[d].b = "✖"; snap(note || `<b>${order[d]}</b> lets <code>${e.type}</code> pass through.`, 8, d); throw e; };
    const handler = () => {
      S.h = { st: "active", b: "running" };
      snap(`The <b>handler</b> finally runs: <code>INSERT orders</code> and <code>INSERT outbox</code>, then <code>SaveChanges</code>. It contains only business logic; every cross-cutting concern lives in a behavior.`, 4, n);
      if (bad.conflict) { S.h = { st: "bad", b: "conflict" }; snap(`<code>SaveChanges</code> throws <code>DbUpdateConcurrencyException</code>: another request changed the same stock row.`, 8, n); throw { type: "DbUpdateConcurrencyException" }; }
      S.rows.push(S.tx === "open" ? "order 1042 (pending commit)" : "order 1042", S.tx === "open" ? "outbox: OrderPlaced (pending)" : "outbox: OrderPlaced");
      S.h = { st: "done", b: "OrderId 1042" };
      snap(`Handler returns <code>OrderId 1042</code>.`, 5, n);
      return "OrderId 1042";
    };
    const B = {
      Logging(d) {
        const L = S.L[d]; L.st = "active"; L.b = "start";
        S.log.push([`PlaceOrder start (user=${bad.auth ? "guest-7" : "alice"})`, ""]);
        snap(`<b>Logging</b> writes the start line with the command name.`, 2, d);
        L.st = "visit";
        try { const r = send(d + 1); L.st = "active"; L.b = "ok"; S.log.push([`PlaceOrder ok in 14 ms`, "done"]); snap(`<b>Logging</b> records success and duration.`, 5, d); L.st = "done"; return r; }
        catch (e) { S.log.push([`PlaceOrder failed: ${e.type}`, "bad"]); return fail(d, e, `<b>Logging</b> records the failure (<code>${e.type}</code>) and rethrows. Because it is ${d === 0 ? "outermost, every outcome is logged, including rejected ones" : "not outermost, anything rejected by the behaviors outside it is never logged"}.`); }
      },
      Authorization(d) {
        const L = S.L[d]; L.st = "active"; L.b = "check";
        if (bad.auth) { L.st = "bad"; L.b = "403"; snap(`<b>Authorization</b>: guest-7 lacks <code>orders:write</code>. It throws <code>ForbiddenException</code>; nothing inside it runs.`, 2, d); throw { type: "ForbiddenException" }; }
        snap(`<b>Authorization</b>: alice has <code>orders:write</code>. Continue.`, 2, d);
        L.st = "visit";
        try { const r = send(d + 1); L.st = "done"; return r; } catch (e) { return fail(d, e); }
      },
      Validation(d) {
        const L = S.L[d]; L.st = "active"; L.b = "validate";
        if (bad.qty) { L.st = "bad"; L.b = "400"; snap(`<b>Validation</b>: <code>Quantity must be greater than 0</code>. It throws <code>ValidationException</code> with the field errors${bad.auth && order.indexOf("Authorization") > d ? ". <b>Leak:</b> an unauthorized caller just learned your validation rules" : ""}.`, 2, d); throw { type: "ValidationException" }; }
        snap(`<b>Validation</b>: all validators pass.`, 2, d);
        L.st = "visit";
        try { const r = send(d + 1); L.st = "done"; return r; } catch (e) { return fail(d, e); }
      },
      Transaction(d) {
        const L = S.L[d]; L.st = "active"; L.b = "BEGIN";
        S.tx = "open";
        snap(`<b>Transaction</b> opens a DB transaction. Everything inside it either commits together or not at all.`, 2, d);
        L.st = "visit";
        try {
          const r = send(d + 1);
          S.tx = "committed"; S.rows = S.rows.map((x) => x.replace(/ \(pending( commit)?\)/, ""));
          L.st = "active"; L.b = "COMMIT"; snap(`<b>Transaction</b> commits: the order and its outbox message become visible atomically.`, 5, d);
          L.st = "done"; return r;
        } catch (e) {
          S.tx = "rolled back"; S.rows = [];
          if (e.type !== "DbUpdateConcurrencyException") S.wasted = true;
          return fail(d, e, `<b>Transaction</b> rolls back and rethrows.${S.wasted ? " The command was invalid from the start: a transaction (and its locks/round-trips) was opened for nothing, because Transaction sits outside the check that rejected it." : " Nothing half-written survives."}`);
        }
      },
    };
    const send = (d) => (d === n ? handler() : B[order[d]](d));
    snap(`<code>await mediator.Send(new PlaceOrder(...))</code> — command: <b>${esc(cmd)}</b>. The mediator resolves the handler and wraps it in the behaviors, outermost first: ${order.join(" → ")}.`, 0);
    let out, ok = true;
    try { out = send(0); } catch (e) { out = e.type; ok = false; }
    const tips = [];
    const ix = (k) => order.indexOf(k);
    if (ix("Logging") > 0) tips.push("Logging is not outermost: rejections by outer behaviors are never logged (audit gap).");
    if (ix("Transaction") >= 0 && (ix("Validation") > ix("Transaction") || ix("Authorization") > ix("Transaction"))) tips.push("Transaction sits outside a cheap check: rejected commands still pay for BEGIN/ROLLBACK.");
    if (ix("Validation") >= 0 && ix("Authorization") > ix("Validation")) tips.push("Validation runs before Authorization: unauthenticated callers can probe your validation rules.");
    if (ix("Transaction") < 0) tips.push("No Transaction behavior: the order row and the outbox row are not atomic.");
    if (!tips.length) tips.push("This order is the usual recommendation: Logging → Authorization → Validation → Transaction → handler.");
    snap(`<b>Result: ${esc(out)}</b>. ${tips.map(esc).join(" ")}`, ok ? 6 : 9);
    frames[frames.length - 1].final = ok ? "done" : "bad";
    frames[frames.length - 1].outcome = out;
    return frames;
  }

  Viz.register("outbound-pipelines-mediator", (el) => Viz.player(el, {
    title: "In-process pipeline: MediatR-style behaviors around a handler",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "running"], ["visit", "inside next()"], ["done", "completed"], ["bad", "threw / rejected"]],
    code: [
      "public async Task<TRes> Handle(TReq req,",
      "  RequestHandlerDelegate<TRes> next, CancellationToken ct) {",
      "  Before(req); // log · authorize · validate · BEGIN",
      "  try {",
      "    var res = await next(); // next behavior/handler",
      "    After(res);   // COMMIT · log success",
      "    return res;",
      "  } catch (Exception e) {",
      "    OnError(e);   // ROLLBACK · log failure",
      "    throw;",
      "  } }",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "order", label: "behaviors, outermost first", value: "Logging,Authorization,Validation,Transaction", width: 300 },
      { key: "cmd", label: "command", type: "select", value: MCMD[0], options: MCMD },
    ],
    random: () => ({ order: shuffle(MB).slice(0, Viz.rand(2, 4)).join(","), cmd: pick(MCMD) }),
    build: ({ order, cmd }) => { if (!MCMD.includes(cmd)) throw new Error("Pick a command."); return medFrames(names(order, MB, "Behaviors", 1), cmd); },
    speed: 1200,
    render(f) {
      const n = f.order.length;
      let core = `<div class="ob-layer core ${f.h.st} ${f.cur === n ? "cur" : ""}"><div class="ob-lname"><span><b>PlaceOrderHandler</b> <small>business logic only</small></span>${badge(f.h.b)}</div></div>`;
      for (let d = n - 1; d >= 0; d--) { const L = f.L[d]; core = `<div class="ob-layer ${L.st} ${f.cur === d ? "cur" : ""}"><div class="ob-lname"><span><b>${esc(f.order[d])}</b> <small>${esc(MB_SUB[f.order[d]])}</small></span>${badge(L.b)}</div>${core}</div>`; }
      const caller = `<div class="ob-caller ${f.final || ""}">mediator.Send(PlaceOrder)${f.outcome ? ` → ${esc(f.outcome)}` : ""}</div>`;
      const db = kv("database", [["transaction", f.tx, f.tx === "open" ? "active" : f.tx === "committed" ? "done" : f.tx === "rolled back" ? "bad" : ""], ...f.rows.map((r) => ["row", r, "done"])]);
      return Viz.row(`<div class="ob-onion">${caller}${core}</div>`, `<div class="ob-col">${db}${lines("log", f.log)}</div>`);
    },
  }));

  /* =====================================================================
   * 7. Trace context propagation across hops
   * ===================================================================== */
  const TR_TREE = { svc: "web-bff", op: "GET /checkout", t0: 0, t1: 262, calls: [
    { svc: "orders", op: "POST /orders", t0: 14, t1: 250, calls: [
      { svc: "inventory", op: "GET /stock/42", t0: 26, t1: 64, calls: [] },
      { svc: "payments", op: "POST /charges", t0: 76, t1: 238, calls: [
        { svc: "bank-gateway", op: "POST /authorize", t0: 92, t1: 222, calls: [] }] }] }] };
  const TR_HOPS = ["none (all hops instrumented)", "web-bff → orders", "orders → inventory", "orders → payments", "payments → bank-gateway"];

  function traceFrames(broken) {
    const rng = mulberry(7), spans = [], frames = [];
    const snap = (now, note, line, cur, wire) => frames.push({ now, note, line, cur, wire, spans: spans.map((s) => ({ ...s })),
      vars: { now: `${now} ms`, traces: new Set(spans.map((s) => s.trace)).size, spans: spans.length, wire: wire ? (wire === "none" ? "no traceparent" : "traceparent ✓") : "-" } });
    const visit = (node, hdr, depth) => {
      const fresh = !hdr;
      const trace = fresh ? hex(rng, 32) : hdr.trace;
      const srv = { id: hex(rng, 16), trace, parent: fresh ? null : hdr.span, svc: node.svc, op: node.op, kind: "server", t0: node.t0, t1: node.t1, open: true, depth, orphan: fresh && depth > 0 };
      spans.push(srv);
      snap(node.t0, fresh ? (depth === 0 ? `<b>${node.svc}</b> receives <code>${node.op}</code> from the browser with no <code>traceparent</code>, so it starts a new trace <code>${trace.slice(0, 8)}…</code> (root span).`
        : `<b>${node.svc}</b> receives <code>${node.op}</code> with <b>no traceparent</b>. It cannot know it is part of a checkout, so it starts a <b>brand-new trace</b> <code>${trace.slice(0, 8)}…</code>. Everything below now lives in a different trace.`)
        : `<b>${node.svc}</b> extracts <code>traceparent</code> and starts a server span whose parent is the caller's client span: same trace <code>${trace.slice(0, 8)}…</code>.`, fresh ? 2 : 1, srv.id);
      node.calls.forEach((c) => {
        const cli = { id: hex(rng, 16), trace, parent: srv.id, svc: node.svc, op: `→ ${c.svc} ${c.op}`, kind: "client", t0: c.t0 - 4, t1: c.t1 + 4, open: true, depth: depth + 0.5 };
        spans.push(cli);
        const hop = `${node.svc} → ${c.svc}`, isBroken = hop === broken;
        snap(cli.t0, isBroken ? `<b>${node.svc}</b> calls ${c.svc} with a client that has <b>no propagation handler</b> (a hand-built client, a raw socket SDK, a queue message without headers). The client span exists here, but nothing is written to the wire.`
          : `<b>${node.svc}</b> starts a client span and its outbound handler injects <code>traceparent: 00-${trace.slice(0, 8)}…-${cli.id.slice(0, 8)}…-01</code>.`, isBroken ? 4 : 5, cli.id, isBroken ? "none" : `00-${trace.slice(0, 8)}…-${cli.id.slice(0, 8)}…-01`);
        visit(c, isBroken ? null : { trace, span: cli.id }, depth + 1);
        cli.open = false;
        cli.dangling = isBroken;
        snap(cli.t1, `The client span <b>${node.svc} → ${c.svc}</b> ends (${cli.t1 - cli.t0} ms).${isBroken ? " In this trace it has <b>no children</b>: a black box. The work it waited for is in another trace that nobody will find from here." : ""}`, 6, cli.id);
      });
      srv.open = false;
      snap(node.t1, `<b>${node.svc}</b> finishes <code>${node.op}</code> (${node.t1 - node.t0} ms).`, 3, srv.id);
    };
    snap(0, `A checkout request will fan out across five services. Pick a hop that lacks propagation and watch what the trace looks like. ${broken.startsWith("none") ? "Here every hop propagates." : `Broken hop: <b>${esc(broken)}</b>.`}`, 0);
    visit(TR_TREE, null, 0);
    const traces = new Set(spans.map((s) => s.trace)).size;
    frames.push({ ...frames[frames.length - 1], note: traces === 1 ? `One trace, ${spans.length} spans, one waterfall: you can see that bank-gateway's 130 ms is most of the checkout time.` : `<b>${traces} disconnected traces.</b> The checkout trace has a gap, and the orphan trace has a root span with no caller. Fix: use an instrumented client everywhere (OpenTelemetry HTTP instrumentation / otelhttp transport / interceptor), and for queues put <code>traceparent</code> in message headers.`, line: 7 });
    return frames;
  }

  Viz.register("outbound-pipelines-trace", (el) => Viz.player(el, {
    title: "Trace propagation: one missing outbound handler splits the trace",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["path", "span in the checkout trace"], ["bad", "orphan trace / dangling client span"], ["active", "just changed"]],
    code: [
      "// server: prop = otel.GetTextMapPropagator()",
      "ctx := prop.Extract(r.Context(), carrier(r.Header))",
      "ctx, span := tracer.Start(ctx, \"POST /orders\")",
      "defer span.End()",
      "bare := &http.Client{}             // ✗ no traceparent",
      "client := &http.Client{Transport: otelhttp.NewTransport(nil)}",
      "resp, err := client.Do(req.WithContext(ctx)) // injects",
      "// one trace per user action, end to end",
    ],
    codeLang: "go",
    inputs: [{ key: "broken", label: "hop without propagation", type: "select", value: TR_HOPS[3], options: TR_HOPS }],
    random: () => ({ broken: pick(TR_HOPS) }),
    build: ({ broken }) => { if (!TR_HOPS.includes(broken)) throw new Error("Pick a hop."); return traceFrames(broken); },
    speed: 1100,
    render(f) {
      const W = 600, LBL = 210, X0 = LBL + 6, X1 = W - 12, T = 270, sx = (t) => X0 + ((X1 - X0) * t) / T;
      const order = [], byTrace = new Map();
      f.spans.forEach((s) => { if (!byTrace.has(s.trace)) { byTrace.set(s.trace, []); order.push(s.trace); } byTrace.get(s.trace).push(s); });
      const rowH = 21; let y = 26, body = "";
      order.forEach((tr, k) => {
        const list = byTrace.get(tr), orphan = list[0].orphan;
        body += `<text class="th ${orphan ? "bad" : ""}" x="4" y="${y + 12}">trace ${k + 1} · ${tr.slice(0, 8)}…${orphan ? "  (orphan root)" : ""}</text>`;
        y += rowH;
        list.forEach((s) => {
          const ind = Math.round(s.depth * 2) * 6, end = s.open ? Math.max(s.t0 + 1, f.now) : s.t1, cls = `${orphan ? "bad" : s.dangling ? "bad dangling" : "path"} ${s.kind} ${s.id === f.cur ? "cur" : ""} ${s.open ? "open" : ""}`;
          body += `<text class="lb ${s.kind}" x="${8 + ind}" y="${y + 14}">${esc(s.svc)} ${esc(s.kind === "client" ? s.op : s.op)}</text>`;
          body += `<rect class="sp ${cls}" x="${sx(s.t0).toFixed(1)}" y="${y + 4}" width="${Math.max(2, sx(end) - sx(s.t0)).toFixed(1)}" height="${rowH - 8}" rx="3"/>`;
          if (!s.open) body += `<text class="dur" x="${(sx(s.t1) - 3).toFixed(1)}" y="${y + 14}" text-anchor="end">${s.t1 - s.t0}</text>`;
          y += rowH;
        });
        y += 6;
      });
      let ax = "";
      for (let t = 0; t <= 250; t += 50) ax += `<line class="grid" x1="${sx(t)}" x2="${sx(t)}" y1="18" y2="${y}"/><text class="ax" x="${sx(t)}" y="13" text-anchor="middle">${t} ms</text>`;
      const svg = `<svg class="ob-wf" viewBox="0 0 ${W} ${y + 4}" width="${W}" role="img" aria-label="trace waterfall">${ax}<line class="now" x1="${sx(f.now)}" x2="${sx(f.now)}" y1="18" y2="${y}"/>${body}</svg>`;
      const wire = f.wire ? kv("on the wire for this hop", [["traceparent", f.wire === "none" ? "(missing)" : f.wire, f.wire === "none" ? "bad" : "done"]]) : "";
      return `<div class="ob-fit">${svg}</div>${wire}`;
    },
  }));
})();
