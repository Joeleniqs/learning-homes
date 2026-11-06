/* REST API design visualizers. Every registered name is prefixed "api-design-". */
(() => {
  const esc = Viz.esc;
  const int = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: use a whole number from ${min} to ${max}.`);
    return n;
  };
  const num = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const J = (o) => JSON.stringify(o);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  /* key/value panel: rows [[key, value, cls]] */
  const kv = (title, rows, o = {}) => `<div class="ad-kv ${o.cls || ""}"><div class="ad-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="ad-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="ad-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="ad-stats">${items.map(([l, v, c]) => `<div class="ad-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const panels = (...p) => `<div class="ad-panels">${p.filter(Boolean).join("")}</div>`;
  const verdict = (html, c) => `<div class="ad-verdict ${c || ""}">${html}</div>`;

  /* sequence diagram. lanes [{id,label,sub}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 700, n = lanes.length, lw = W / n, rowH = o.rowH || 29, max = o.max || 12;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, (i + 0.5) * lw]));
    let s = `<svg class="ad-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 12, 160);
      s += `<line class="life" x1="${x}" y1="44" x2="${x}" y2="${H - 2}"/>`;
      s += `<rect class="lane ${l.cls || ""}" x="${x - bw / 2}" y="4" width="${bw}" height="40" rx="8"/>`;
      s += `<text class="lt" x="${x}" y="${l.sub ? 21 : 28}">${esc(l.label)}</text>`;
      if (l.sub) s += `<text class="ls" x="${x}" y="36">${esc(l.sub)}</text>`;
    });
    if (start) s += `<text class="ls" x="${W / 2}" y="64">… ${start} earlier message${start > 1 ? "s" : ""} scrolled off</text>`;
    shown.forEach((m, k) => {
      const y = top + k * rowH + rowH - 7, cur = start + k === msgs.length - 1;
      const c = `msg ${m.cls || ""} ${m.dash ? "dash" : ""} ${cur ? "cur" : "old"}`;
      if (m.from === m.to) {
        const x = X[m.from], bw = Math.min(W - 4, Math.max(120, m.label.length * 7.9 + 18));
        const cx = Math.min(W - bw / 2 - 2, Math.max(bw / 2 + 2, x));
        s += `<g class="${c} note"><rect x="${cx - bw / 2}" y="${y - 15}" width="${bw}" height="20" rx="5"/><text x="${cx}" y="${y - 1}">${esc(m.label)}</text></g>`;
        return;
      }
      const x1 = X[m.from], x2 = X[m.to], d = Math.sign(x2 - x1);
      const a = x2 - d * 3, b = x1 + d * 3;
      s += `<g class="${c}"><line x1="${b}" y1="${y}" x2="${a - d * 8}" y2="${y}"/><polygon points="${a},${y} ${a - d * 9},${y - 4.5} ${a - d * 9},${y + 4.5}"/><text x="${(x1 + x2) / 2}" y="${y - 5}">${esc(m.label)}</text></g>`;
    });
    return s + "</svg>";
  }

  /* =====================================================================
   * 1. Methods: retry the same request N times. Which ones are idempotent?
   * ===================================================================== */
  const METHODS = {
    "GET /items/7": {
      spec: "safe + idempotent",
      run: (st) => (st.items[7] ? [200, `200 OK ${J(st.items[7])}`] : [404, "404 Not Found"]),
    },
    "PUT /items/7 {sku:pen, qty:3}": {
      spec: "idempotent",
      run: (st) => { const had = 7 in st.items; st.items[7] = { sku: "pen", qty: 3 }; return had ? [200, "200 OK (replaced)"] : [201, "201 Created"]; },
    },
    "DELETE /items/7": {
      spec: "idempotent",
      run: (st) => { if (!(7 in st.items)) return [404, "404 Not Found"]; delete st.items[7]; return [204, "204 No Content"]; },
    },
    "POST /items {sku:pen, qty:1}": {
      spec: "neither",
      run: (st) => { const id = st.next++; st.items[id] = { sku: "pen", qty: 1 }; return [201, `201 Created · Location: /items/${id}`]; },
    },
    "PATCH /items/7 merge-patch {qty:3}": {
      spec: "neither in general",
      run: (st) => { if (!st.items[7]) return [404, "404 Not Found"]; st.items[7].qty = 3; return [200, "200 OK"]; },
    },
    "PATCH /items/7 {increment qty by 1}": {
      spec: "neither in general",
      run: (st) => { if (!st.items[7]) return [404, "404 Not Found"]; st.items[7].qty += 1; return [200, `200 OK qty=${st.items[7].qty}`]; },
    },
    "POST /items + Idempotency-Key: k-81f": {
      spec: "neither, made idempotent by the key",
      run: (st) => {
        const hit = st.keys["k-81f"];
        if (hit) return [hit[0], `${hit[1]} (replayed)`];
        const id = st.next++; st.items[id] = { sku: "pen", qty: 1 };
        const r = [201, `201 Created · Location: /items/${id}`]; st.keys["k-81f"] = r; return r;
      },
    },
  };
  const initItems = () => ({ items: { 7: { sku: "pen", qty: 1 } }, next: 8, keys: {} });
  const runMethod = (name, n) => { const st = initItems(), out = []; for (let k = 0; k < n; k++) out.push(METHODS[name].run(st)); return { st, out }; };

  Viz.register("api-design-methods", (el) => Viz.player(el, {
    title: "The response was lost. Is it safe to send the request again?",
    legend: [["active", "row created by the retries"], ["done", "response delivered"], ["bad", "response lost (timeout)"], ["path", "row changed"]],
    codeLang: "python",
    code: [
      "for attempt in range(1, n + 1):",
      "    resp = send(method, url, body)   # same request every time",
      "    # the server has ALREADY applied it here",
      "    if resp.lost: continue           # timeout: did it work? unknown",
      "    break",
      "same = state_after(n) == state_after(1)",
    ],
    inputs: [
      { key: "m", label: "request", type: "select", options: Object.keys(METHODS), value: "POST /items {sku:pen, qty:1}" },
      { key: "n", label: "times sent (first n-1 responses lost)", value: "3", width: 60 },
    ],
    random: () => ({ m: pick(Object.keys(METHODS)), n: String(2 + Math.floor(Math.random() * 3)) }),
    build: ({ m, n }) => {
      const def = METHODS[m]; if (!def) throw new Error("Pick a request from the list.");
      const N = int(n, "times sent", 1, 5);
      const st = initItems(), init = clone(st.items), log = [], fr = [];
      const snap = (extra) => ({ items: clone(st.items), init, log: log.slice(), m, N, ...extra });
      fr.push(snap({ line: 0, vars: { attempt: 0, rows: Object.keys(st.items).length }, note: `The store starts with one row, <code>/items/7</code>. The client will send <b>${esc(m)}</b>. Its first ${N - 1} response${N - 1 === 1 ? " is" : "s are"} lost in the network, so it sends the identical request ${N} time${N > 1 ? "s" : ""}. HTTP calls this method <b>${def.spec}</b>; let's see what actually happens to the data.` }));
      for (let k = 1; k <= N; k++) {
        const before = J(st.items);
        const [code, text] = def.run(st);
        const lost = k < N, changed = J(st.items) !== before;
        log.push([`#${k}`, text, lost ? "bad" : "done"]);
        fr.push(snap({ line: [1, 2], vars: { attempt: k, status: code, rows: Object.keys(st.items).length, changed }, note: `Attempt ${k} reaches the server, which applies it and answers <code>${esc(text)}</code>. ${changed ? "The data <b>changed</b>." : "The data did <b>not</b> change."}` }));
        fr.push(snap({ line: lost ? 3 : 4, vars: { attempt: k, status: code, lost }, note: lost ? `The response is lost on the way back. The client can't tell "never arrived" from "applied, then lost", so its only safe move is to retry <b>if</b> the request is idempotent.` : `This response arrives. The client stops after ${k} attempt${k > 1 ? "s" : ""}.` }));
      }
      const one = runMethod(m, 1), same = J(one.st.items) === J(st.items), safe = J(st.items) === J(init);
      fr.push(snap({ done: true, same, safe, one: one.st.items, line: 5, vars: { attempts: N, "same as 1 call": same, "state untouched": safe },
        note: same
          ? `Sending it ${N} times left the server exactly as one call would: <b>idempotent</b>.${safe ? " Nothing changed at all, so it is also <b>safe</b>." : ""}${m.startsWith("DELETE") && N > 1 ? " Notice the responses differ (204, then 404). Idempotency is about the <i>state</i>, not about identical responses." : ""}${m.includes("Idempotency-Key") ? " The key turned a non-idempotent POST into one: retries replay the first response instead of creating rows." : ""}`
          : `${N} sends produced a different state from 1 send: <b>not idempotent</b>. ${m.startsWith("POST") ? `There are now ${N} new rows (duplicate orders, double charges). Add an <code>Idempotency-Key</code>.` : "The patch was relative (increment), so every replay adds again. Use an absolute value, or guard with <code>If-Match</code>."}` }));
      return fr;
    },
    render: (f) => {
      const ids = Object.keys(f.items);
      const rows = ids.map((id) => {
        const it = f.items[id], was = f.init[id];
        return [`/items/${id}`, `${it.sku} × ${it.qty}`, !was ? "active" : J(was) !== J(it) ? "path" : ""];
      });
      const out = [panels(kv("client: attempts", f.log, { empty: "nothing sent yet" }), kv("server: /items", rows, { empty: "no rows" }))];
      if (f.done) {
        out.push(stats([["HTTP spec", METHODS[f.m].spec, ""], ["state after " + f.N + " sends", ids.length + " row" + (ids.length === 1 ? "" : "s"), ""], ["same as 1 send?", f.same ? "yes" : "no", f.same ? "done" : "bad"], ["data untouched?", f.safe ? "yes" : "no", f.safe ? "done" : "path"]]));
      }
      return `<div class="ad-col">${out.join("")}</div>`;
    },
  }));

  /* =====================================================================
   * 2. Status code decision chain
   * ===================================================================== */
  const QS = [
    { id: "rate", q: "Caller over its rate limit or quota?", leaf: "429 Too Many Requests", s: "+ Retry-After" },
    { id: "authn", q: "Credentials missing, expired or invalid?", leaf: "401 Unauthorized", s: "+ WWW-Authenticate" },
    { id: "route", q: "No endpoint for this path and method?", leaf: "404 / 405", s: "405 + Allow if the path exists" },
    { id: "media", q: "Body unreadable or unsupported type?", leaf: "400 / 415", s: "bad JSON → 400, wrong type → 415" },
    { id: "valid", q: "Readable, but the values are invalid?", leaf: "422 (or 400)", s: "problem details + errors" },
    { id: "found", q: "Target resource doesn't exist?", leaf: "404 Not Found", s: "or 410 Gone if deleted for good" },
    { id: "authz", q: "Caller not allowed to do this here?", leaf: "403 Forbidden", s: "or 404 to hide that it exists" },
    { id: "precond", q: "If-Match / If-None-Match fails?", leaf: "412 / 304", s: "428 if If-Match is required" },
    { id: "conflict", q: "Conflicts with the current state?", leaf: "409 Conflict", s: "duplicate, illegal transition" },
    { id: "fail", q: "Our code or a dependency failed?", leaf: "500 / 502 / 503 / 504", s: "bug · bad upstream · busy · timeout" },
    { id: "async", q: "Will the work finish after we reply?", leaf: "202 Accepted", s: "+ Location of a status monitor" },
    { id: "ok", q: "Done. What did it produce?", leaf: "201 / 204 / 200", s: "created · nothing · a body" },
  ];
  const SCEN = {
    "POST /orders with a trailing comma in the JSON": { stop: "media", code: "400 Bad Request", why: "The body can't be parsed, so nothing about its meaning can be checked yet." },
    "POST /orders with Content-Type: text/xml": { stop: "media", code: "415 Unsupported Media Type", why: "The server only reads <code>application/json</code>. 415 tells the client to change the format, not the values." },
    "POST /orders with quantity = -3": { stop: "valid", code: "422 Unprocessable Content", why: "The JSON is fine but a value breaks a rule. Return problem details with an <code>errors</code> map per field. Many teams use 400 for this; pick one and be consistent." },
    "GET /orders/7 with an expired access token": { stop: "authn", code: "401 Unauthorized", why: "401 means <i>unauthenticated</i>: we don't know who you are. Send <code>WWW-Authenticate: Bearer error=\"invalid_token\"</code> so the client refreshes its token." },
    "DELETE /orders/7 as a read-only user": { stop: "authz", code: "403 Forbidden", why: "We know who you are and you may see the order, but you may not delete it. Re-authenticating won't help, which is exactly what 403 says." },
    "GET /orders/7 that belongs to another tenant": { stop: "authz", code: "404 Not Found", why: "Answering 403 would confirm that order 7 exists. For objects outside the caller's scope, answer as if it didn't exist (OWASP API1, BOLA)." },
    "GET /orders/999 (no such order)": { stop: "found", code: "404 Not Found", why: "The route matched but the resource doesn't exist." },
    "PATCH /orders (collection doesn't support PATCH)": { stop: "route", code: "405 Method Not Allowed", why: "The path exists, the method doesn't. Include <code>Allow: GET, POST</code>." },
    "PUT /orders/7 with a stale If-Match": { stop: "precond", code: "412 Precondition Failed", why: "Someone changed the order since this client read it. The client must re-read, merge and retry. See the ETag section." },
    "GET /orders/7 with If-None-Match = current ETag": { stop: "precond", code: "304 Not Modified", why: "The client's copy is current. No body is sent, which saves the transfer." },
    "POST /orders/7/cancel on a shipped order": { stop: "conflict", code: "409 Conflict", why: "The request is valid in isolation but illegal in the order's current state. Explain the state in the problem detail." },
    "The 101st request this minute (limit 100)": { stop: "rate", code: "429 Too Many Requests", why: "Checked first, because it is the cheapest check and protects everything after it. Say when to come back with <code>Retry-After</code>." },
    "GET /orders/7: the database is down": { stop: "fail", code: "503 Service Unavailable", why: "The request was fine; we couldn't serve it right now. 503 + <code>Retry-After</code> tells clients and gateways that retrying later is reasonable." },
    "GET /orders/7: NullReferenceException in the handler": { stop: "fail", code: "500 Internal Server Error", why: "A bug. Return a generic problem detail with a trace id; never the stack trace." },
    "POST /reports (takes 3 minutes to generate)": { stop: "async", code: "202 Accepted", why: "Don't hold the connection for 3 minutes. Accept the work and point at a status monitor (see long-running operations)." },
    "POST /orders: order created": { stop: "ok", code: "201 Created", why: "Return the new resource (or its id) and <code>Location: /orders/8</code>." },
    "DELETE /orders/7: deleted": { stop: "ok", code: "204 No Content", why: "Success with nothing to say. Don't wrap it in <code>{\"success\": true}</code>." },
    "GET /orders/7: found": { stop: "ok", code: "200 OK", why: "The common case: a body that represents the resource." },
  };
  function statusSvg(f) {
    const W = 760, RH = 34, G = 6, H = QS.length * (RH + G) + 6;
    let s = `<svg class="dg ad-chain" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Status code decision chain">`;
    QS.forEach((q, i) => {
      const y = 4 + i * (RH + G), st = f.state[q.id] || "";
      const qc = st === "cur" ? "active" : st === "no" ? "path" : st === "yes" ? "active" : "";
      const lc = st === "yes" ? (f.good ? "done" : "bad") : "";
      if (i < QS.length - 1) s += `<path class="edge ${st === "no" ? "path" : ""}" d="M200,${y + RH} L200,${y + RH + G}"/>`;
      s += `<path class="edge ${st === "yes" ? (f.good ? "done" : "bad") : "dash"}" d="M392,${y + RH / 2} L456,${y + RH / 2}"/>`;
      s += `<text class="small muted ad-h" x="424" y="${y + RH / 2 - 5}" text-anchor="middle">${q.id === "ok" ? "" : "yes"}</text>`;
      s += `<rect class="box ${qc} ${st ? "" : "ad-faint"}" x="8" y="${y}" width="384" height="${RH}" rx="7"/>`;
      s += `<text x="20" y="${y + 21}" class="${st === "cur" || st === "yes" ? "ad-b" : ""}">${i + 1}. ${esc(q.q)}</text>`;
      if (st === "no") s += `<text x="380" y="${y + 21}" text-anchor="end" class="small ad-no">no ↓</text>`;
      s += `<rect class="box ${lc} ${st === "yes" ? "" : "ad-faint"}" x="456" y="${y}" width="296" height="${RH}" rx="7"/>`;
      s += `<text x="468" y="${y + 15}" class="mono ad-b">${esc(st === "yes" ? f.code : q.leaf)}</text>`;
      s += `<text x="468" y="${y + 28}" class="small muted">${esc(q.s)}</text>`;
    });
    return s + "</svg>";
  }
  Viz.register("api-design-status", (el) => Viz.player(el, {
    title: "Which status code? Walk the request through the server's checks",
    legend: [["active", "check being made"], ["path", "passed (no)"], ["bad", "client or server error"], ["done", "success / not modified"]],
    codeLang: "python",
    code: [
      "if over_limit(caller):     return 429",
      "if not authenticated(req): return 401",
      "if not route_for(req):     return 404 or 405",
      "if not readable(req.body): return 400 or 415",
      "if errors := validate(dto): return 422",
      "if (res := load(id)) is None: return 404",
      "if not allowed(user, res): return 403 or 404",
      "if not preconditions(res): return 412 or 304",
      "if conflicts(res, dto):    return 409",
      "try: out = work(res, dto)  except: return 5xx",
      "if out.queued:             return 202",
      "return 201 or 204 or 200",
    ],
    inputs: [{ key: "s", label: "scenario", type: "select", options: Object.keys(SCEN), value: "GET /orders/7 that belongs to another tenant" }],
    random: () => ({ s: pick(Object.keys(SCEN)) }),
    speed: 700,
    build: ({ s }) => {
      const sc = SCEN[s]; if (!sc) throw new Error("Pick a scenario.");
      const good = /^[23]/.test(sc.code), fr = [], state = {};
      for (const [qi, q] of QS.entries()) {
        if (q.id === sc.stop) {
          state[q.id] = "cur";
          fr.push({ state: { ...state }, code: sc.code, good, line: qi, vars: { check: q.id, answer: "?" }, note: `Check: <b>${esc(q.q)}</b>` });
          state[q.id] = "yes";
          fr.push({ state: { ...state }, code: sc.code, good, line: qi, vars: { check: q.id, answer: "yes", status: sc.code }, note: `<b>Yes → ${esc(sc.code)}.</b> ${sc.why}` });
          break;
        }
        state[q.id] = "cur";
        fr.push({ state: { ...state }, code: sc.code, good, line: qi, vars: { check: q.id, answer: "?" }, note: `Check: <b>${esc(q.q)}</b>` });
        state[q.id] = "no";
        fr.push({ state: { ...state }, code: sc.code, good, line: qi, vars: { check: q.id, answer: "no" }, note: `No, so this check passes and the request moves on. The order matters: cheap, request-wide checks come before expensive, resource-specific ones.` });
      }
      return fr;
    },
    render: (f) => `<div class="ad-fit">${statusSvg(f)}</div>`,
  }));

  /* =====================================================================
   * 3. Pagination drift: offset vs keyset while the data changes
   * ===================================================================== */
  const parseEvents = (s) => {
    const toks = String(s).split(/[\s,;]+/).filter(Boolean);
    if (!toks.length || toks.length > 8) throw new Error("events: give 1–8 tokens like +2, -1 or 0.");
    return toks.map((t) => {
      const m = /^([+-]?)(\d)$/.exec(t);
      if (!m || Number(m[2]) > 3) throw new Error(`events: "${t}" isn't valid. Use +k (k new rows on top), -k (delete k rows already read) or 0, with k ≤ 3.`);
      const k = Number(m[2]);
      return m[1] === "-" ? { del: k } : { ins: k };
    });
  };
  function driftWorlds(N, events, maxPages) {
    let world = Array.from({ length: N }, (_, i) => N - i), next = N + 1;
    const worlds = [world.slice()], evs = [null];
    for (let g = 1; g <= maxPages; g++) {
      const e = events[(g - 1) % events.length], info = { ins: [], del: [] };
      if (e.ins) { for (let k = 0; k < e.ins; k++) info.ins.unshift(next++); world = [...info.ins, ...world]; }
      if (e.del) {
        const originals = world.filter((id) => id <= N).slice(0, e.del);
        info.del = originals; world = world.filter((id) => !originals.includes(id));
      }
      worlds.push(world.slice()); evs.push(info);
    }
    return { worlds, evs };
  }
  function driftRun(kind, worlds, N, P, maxPages) {
    const pages = [], counts = {};
    let cursor = Infinity, g = 0, done = false;
    for (; g < maxPages && !done; g++) {
      const w = worlds[g];
      const page = kind === "offset" ? w.slice(g * P, g * P + P) : w.filter((id) => id < cursor).slice(0, P);
      page.forEach((id) => (counts[id] = (counts[id] || 0) + 1));
      if (page.length) cursor = page[page.length - 1];
      done = page.length < P;
      pages.push({ g, page, counts: { ...counts }, cursor, offset: g * P, done });
    }
    const last = worlds[pages.length - 1];
    const skipped = last.filter((id) => id <= N && !counts[id]);
    const dups = Object.keys(counts).filter((id) => counts[id] > 1).map(Number);
    return { pages, skipped, dups, finished: done };
  }
  Viz.register("api-design-drift", (el) => Viz.player(el, {
    title: "Offset vs keyset pagination while rows are inserted and deleted",
    legend: [["active", "this page"], ["done", "returned once"], ["bad", "returned twice / skipped"], ["path", "inserted after the first page"]],
    codeLang: "sql",
    code: [
      "-- offset: page g",
      "SELECT * FROM items ORDER BY id DESC",
      "  LIMIT :size OFFSET :g * :size;",
      "-- keyset: page after the last id seen",
      "SELECT * FROM items WHERE id < :cursor",
      "  ORDER BY id DESC LIMIT :size;",
    ],
    inputs: [
      { key: "n", label: "rows at start", value: "12", width: 60 },
      { key: "p", label: "page size", value: "4", width: 60 },
      { key: "ev", label: "between pages (+k insert on top, -k delete read rows)", value: "+2, 0, -1" },
    ],
    random: () => ({ n: String(8 + Math.floor(Math.random() * 10)), p: String(3 + Math.floor(Math.random() * 3)), ev: pick(["+2", "+1, -1", "-1", "+3, 0", "0, +2, -1", "+1", "-2, +1"]) }),
    build: ({ n, p, ev }) => {
      const N = int(n, "rows at start", 3, 20), P = int(p, "page size", 2, 6), events = parseEvents(ev), MAX = 10;
      const { worlds, evs } = driftWorlds(N, events, MAX);
      const runs = { offset: driftRun("offset", worlds, N, P, MAX), keyset: driftRun("keyset", worlds, N, P, MAX) };
      const G = Math.max(runs.offset.pages.length, runs.keyset.pages.length), fr = [];
      const lane = (kind, g, show) => {
        const r = runs[kind], pg = r.pages[Math.min(g, r.pages.length - 1)];
        return { page: show && g < r.pages.length ? pg.page : [], counts: g < 0 ? {} : pg ? pg.counts : {}, cursor: pg ? pg.cursor : Infinity, offset: pg ? pg.offset : 0, over: g >= r.pages.length };
      };
      fr.push({ world: worlds[0], N, lanes: { offset: lane("offset", -1, false), keyset: lane("keyset", -1, false) }, line: [], vars: { rows: N, size: P }, note: `${N} rows, newest first (ids ${N}…1). Two clients page through the same table, ${P} per page. Between page requests, other users change the data: <b>${esc(ev)}</b> (repeating).` });
      for (let g = 0; g < G; g++) {
        if (g > 0) {
          const e = evs[g], parts = [];
          if (e.ins.length) parts.push(`${e.ins.length} new row${e.ins.length > 1 ? "s" : ""} (${e.ins.join(", ")}) inserted on top`);
          if (e.del.length) parts.push(`row${e.del.length > 1 ? "s" : ""} ${e.del.join(", ")} deleted (already read)`);
          fr.push({ world: worlds[g], N, ins: e.ins, lanes: { offset: lane("offset", g - 1, false), keyset: lane("keyset", g - 1, false) }, line: [], vars: { page: g, inserted: e.ins.length, deleted: e.del.length },
            note: parts.length ? `Meanwhile: ${parts.join("; ")}. ${e.ins.length ? `Every older row shifts <b>down</b> ${e.ins.length} position${e.ins.length > 1 ? "s" : ""}, so the offset client will see rows it already has.` : ""} ${e.del.length ? `Every later row shifts <b>up</b>, so the offset client will jump over one it hasn't seen.` : ""} Keyset doesn't care: it asks for rows <i>older than</i> its cursor, not for a position.` : "No changes this time." });
        }
        const lo = lane("offset", g, true), ks = lane("keyset", g, true);
        fr.push({ world: worlds[g], N, lanes: { offset: lo, keyset: ks }, line: [1, 2, 4, 5], vars: { page: g + 1, offset: lo.over ? "done" : g * P, cursor: ks.over ? "done" : g === 0 ? "none" : runs.keyset.pages[g - 1].cursor },
          note: `Page ${g + 1}. Offset ${lo.over ? "has finished" : `takes positions ${g * P}–${g * P + P - 1}: [${lo.page.join(", ")}]`}. Keyset ${ks.over ? "has finished" : `takes the ${P} rows with id &lt; ${g === 0 ? "∞" : runs.keyset.pages[g - 1].cursor}: [${ks.page.join(", ")}]`}.` });
      }
      const res = (k) => { const r = runs[k]; return `${k}: ${r.dups.length} duplicate${r.dups.length === 1 ? "" : "s"}${r.dups.length ? ` (${r.dups.join(", ")})` : ""}, ${r.skipped.length} skipped${r.skipped.length ? ` (${r.skipped.join(", ")})` : ""}${r.finished ? "" : `, still not finished after ${MAX} pages`}`; };
      fr.push({ world: worlds[G - 1], N, final: runs, lanes: { offset: lane("offset", G - 1, false), keyset: lane("keyset", G - 1, false) }, line: [], vars: { "offset dups": runs.offset.dups.length, "offset skipped": runs.offset.skipped.length, "keyset dups": runs.keyset.dups.length, "keyset skipped": runs.keyset.skipped.length },
        note: `<b>Result.</b> ${res("offset")}. ${res("keyset")}. ${runs.offset.dups.length || runs.offset.skipped.length ? "Offset pagination is a request for a <i>position</i>, and positions move when rows are inserted or deleted ahead of you." : "With these events offset got lucky; try +2 or -1."}` });
      return fr;
    },
    render: (f) => {
      const one = (kind) => {
        const L = f.lanes[kind], fin = f.final && f.final[kind];
        const cls = (i, id) => {
          if (L.page.includes(id)) return L.counts[id] > 1 ? "bad" : "active";
          if (L.counts[id] > 1) return "bad";
          if (L.counts[id]) return "done";
          if (fin && fin.skipped.includes(id)) return "bad";
          if (id > f.N) return "path";
          return "";
        };
        const ptrs = {};
        if (kind === "offset" && !L.over && L.page.length) ptrs.offset = L.offset;
        if (kind === "keyset" && !L.over && L.page.length) { const at = f.world.indexOf(L.page[0]); if (at >= 0) ptrs.next = at; }
        return Viz.labeled(`${kind === "offset" ? "OFFSET / LIMIT" : "keyset (WHERE id < cursor)"}${L.over && !f.final ? " · finished" : ""}`, `<div class="ad-wrap">${Viz.array(f.world, { cls, ptrs, showIdx: true })}</div>`);
      };
      const out = [one("offset"), one("keyset")];
      if (f.final) {
        const s = (k) => f.final[k];
        out.push(stats([["offset duplicates", s("offset").dups.length, s("offset").dups.length ? "bad" : "done"], ["offset skipped", s("offset").skipped.length, s("offset").skipped.length ? "bad" : "done"], ["keyset duplicates", s("keyset").dups.length, "done"], ["keyset skipped", s("keyset").skipped.length, "done"]]));
      }
      return `<div class="ad-col">${out.join("")}</div>`;
    },
  }));

  /* =====================================================================
   * 4. Keyset cursors need a unique tie-breaker
   * ===================================================================== */
  const CURSORS = {
    "WHERE price > :lastPrice": (r, c) => r.price > c.price,
    "WHERE price >= :lastPrice": (r, c) => r.price >= c.price,
    "WHERE (price, id) > (:lastPrice, :lastId)": (r, c) => r.price > c.price || (r.price === c.price && r.id > c.id),
  };
  Viz.register("api-design-ties", (el) => Viz.player(el, {
    title: "Keyset pagination on a non-unique column: why the cursor needs the id too",
    legend: [["active", "this page"], ["done", "returned once"], ["bad", "duplicate or never returned"]],
    codeLang: "sql",
    code: [
      "SELECT * FROM products",
      "WHERE <cursor predicate>      -- omitted on page 1",
      "ORDER BY price, id",
      "LIMIT :size;",
      "-- next cursor = (price, id) of the last row",
    ],
    inputs: [
      { key: "prices", label: "prices (id = position)", value: "10, 15, 15, 15, 20, 20, 25, 30" },
      { key: "p", label: "page size", value: "3", width: 60 },
      { key: "c", label: "cursor", type: "select", options: Object.keys(CURSORS), value: "WHERE price > :lastPrice" },
    ],
    random: () => {
      const n = 6 + Math.floor(Math.random() * 6), a = [];
      let v = 10; for (let i = 0; i < n; i++) { if (Math.random() < 0.45) v += 5; a.push(v); }
      return { prices: a.join(", "), p: String(2 + Math.floor(Math.random() * 3)), c: pick(Object.keys(CURSORS)) };
    },
    build: ({ prices, p, c }) => {
      const vals = Viz.parse.ints(prices, { min: 2, max: 14 }), P = int(p, "page size", 2, 5), pred = CURSORS[c];
      if (!pred) throw new Error("Pick a cursor predicate.");
      if (vals.some((v) => v < 0 || v > 9999 || !Number.isInteger(v))) throw new Error("prices: whole numbers from 0 to 9999.");
      const rows = vals.map((price, i) => ({ id: i + 1, price })).sort((a, b) => a.price - b.price || a.id - b.id);
      const counts = {}, fr = [];
      let cur = null, prevKey = "", stuck = false, done = false;
      fr.push({ rows, counts: {}, page: [], line: 2, vars: { size: P, cursor: "none" }, note: `${rows.length} products sorted by <code>price, id</code>. Price is <b>not unique</b>. The client pages ${P} at a time with <code>${esc(c)}</code>.` });
      for (let g = 0; g < 12 && !done; g++) {
        const cand = cur ? rows.filter((r) => pred(r, cur)) : rows;
        const page = cand.slice(0, P), key = page.map((r) => r.id).join(",");
        if (cur && key === prevKey && page.length) { stuck = true; fr.push({ rows, counts: { ...counts }, page: page.map((r) => r.id), line: 1, vars: { page: g + 1, cursor: `(${cur.price}, ${cur.id})` }, note: `Page ${g + 1} is <b>identical</b> to the previous page. With <code>&gt;=</code> and more tied rows than a page holds, the cursor can't move: an infinite loop. The client gives up.` }); break; }
        prevKey = key;
        page.forEach((r) => (counts[r.id] = (counts[r.id] || 0) + 1));
        const sql = cur ? c.replace(":lastPrice", cur.price).replace(":lastId", cur.id) : "(first page: no predicate)";
        fr.push({ rows, counts: { ...counts }, page: page.map((r) => r.id), line: cur ? [1, 3] : [2, 3], vars: { page: g + 1, cursor: cur ? `(${cur.price}, ${cur.id})` : "none", got: page.length },
          note: `Page ${g + 1}: <code>${esc(sql)}</code> → ${page.length ? page.map((r) => `#${r.id}($${r.price})`).join(", ") : "nothing"}.${page.some((r) => counts[r.id] > 1) ? " <b>Duplicates</b>: the predicate let rows from the last page back in." : ""}` });
        if (page.length) cur = page[page.length - 1];
        done = page.length < P;
        if (!done) fr.push({ rows, counts: { ...counts }, page: [], line: 4, vars: { page: g + 1, cursor: `(${cur.price}, ${cur.id})` }, note: `Next cursor = last row: price ${cur.price}, id ${cur.id}.${rows.filter((r) => r.price === cur.price && r.id > cur.id).length && c === "WHERE price > :lastPrice" ? ` There are still unread rows priced ${cur.price}; <code>price &gt; ${cur.price}</code> will jump over them.` : ""}` });
      }
      const skipped = rows.filter((r) => !counts[r.id]).map((r) => r.id), dups = rows.filter((r) => counts[r.id] > 1).map((r) => r.id);
      fr.push({ rows, counts, page: [], final: true, skipped, line: [], vars: { duplicates: dups.length, skipped: skipped.length, stuck },
        note: dups.length || skipped.length || stuck
          ? `<b>Broken.</b> ${skipped.length ? `Never returned: ${skipped.map((x) => "#" + x).join(", ")}. ` : ""}${dups.length ? `Returned twice: ${dups.map((x) => "#" + x).join(", ")}. ` : ""}${stuck ? "Stuck in a loop. " : ""}A cursor must identify a <i>unique</i> position in the sort order. Add the primary key as the last sort column and compare the tuple.`
          : `<b>Every row exactly once.</b> ${c.includes("(price, id)") ? "The (price, id) tuple is unique, so the cursor always names one exact position, and ties are ordered by id." : "No ties straddled a page boundary this time. Try the default prices."}` });
      return fr;
    },
    render: (f) => {
      const cls = (i) => {
        const id = f.rows[i].id;
        if (f.page.includes(id)) return f.counts[id] > 1 ? "bad" : "active";
        if (f.counts[id] > 1) return "bad";
        if (f.counts[id]) return "done";
        if (f.final && f.skipped.includes(id)) return "bad";
        return "";
      };
      return Viz.array(f.rows.map((r) => r.price), { cls, idxLabel: (i) => `#${f.rows[i].id}`, label: "price, sorted by (price, id); #id below" });
    },
  }));

  /* =====================================================================
   * 5. Idempotency keys for POST
   * ===================================================================== */
  const IDEM_SCEN = ["Response lost, client retries", "Double-click: 2nd request while the 1st is running", "Retry with the same key but a changed body"];
  function idemRun(scen, useKey) {
    const st = { orders: [], charged: 0, store: {}, next: 501 }, msgs = [], fr = [];
    const key = "k-7f3a", fp = (b) => J(b);
    const push = (m, note, line, vars = {}) => { if (m) [].concat(m).forEach((x) => msgs.push(x)); fr.push({ msgs: msgs.slice(), st: clone(st), note, line, vars: { orders: st.orders.length, charged: `$${st.charged}`, ...vars } }); };
    const tag = useKey ? ` · Idempotency-Key: ${key}` : "";
    const begin = (body) => {
      if (!useKey) return { type: "new" };
      const rec = st.store[key];
      if (rec) {
        if (rec.fp !== fp(body)) return { type: "mismatch" };
        if (rec.status === "processing") return { type: "conflict" };
        return { type: "replay", rec };
      }
      st.store[key] = { fp: fp(body), status: "processing", resp: "" };
      return { type: "new" };
    };
    const finish = (body) => {
      const id = st.next++; st.orders.push({ id, qty: body.qty }); st.charged += body.qty * 20;
      const resp = `201 Created · order #${id}`;
      if (useKey) Object.assign(st.store[key], { status: "done", resp });
      return resp;
    };
    /* the server's answer to a request, as messages */
    const serve = (body, label, deliver) => {
      const b = begin(body);
      if (useKey) push([{ from: "api", to: "store", label: `INSERT ${key} IF ABSENT` }, { from: "store", to: "api", label: b.type === "new" ? "inserted (processing)" : `exists: ${b.type === "mismatch" ? "other body" : b.type === "conflict" ? "processing" : "done"}`, cls: b.type === "new" ? "" : "hit" }],
        b.type === "new" ? "The key is new, so this request claims it atomically (insert-if-absent). Any copy that arrives later will find it." : b.type === "replay" ? "The key exists and its work is finished: this is a retry. Don't run the side effects again; replay the stored response." : b.type === "conflict" ? "The key exists but the first request is still running. Running it twice is exactly what we're preventing." : "The key exists, but the body's fingerprint differs. A key names one intent; reusing it for a different request is a client bug.", [1, 2, 3, 4]);
      if (b.type === "replay") { push({ from: "api", to: "client", label: `${b.rec.resp} (replayed)`, cls: "hit" }, "The client gets the original 201 and order id. One order, one charge, however many retries.", 4); return; }
      if (b.type === "conflict") { push({ from: "api", to: "client", label: "409 Conflict · Retry-After: 1", cls: "miss" }, "409: the same key is in flight. The client should wait and retry, and will then get the stored result.", 3); return "conflict"; }
      if (b.type === "mismatch") { push({ from: "api", to: "client", label: "422 key reused with a different body", cls: "miss" }, "422: refuse rather than guess. The client must use a new key for a new intent.", 2); return; }
      push({ from: "api", to: "db", label: `${label}: insert order, charge $${body.qty * 20}`, cls: "db" }, `${useKey ? "Only the request that claimed the key" : "Without a key the server can't tell a retry from a new order, so it"} runs the side effects.`, 5);
      if (deliver === "later") return "running";
      const resp = finish(body);
      if (useKey) push({ from: "api", to: "store", label: `save response for ${key}` }, "Store the response under the key (ideally in the same transaction as the order), with a TTL such as 24 hours.", 6);
      push({ from: "api", to: "client", label: deliver === "lost" ? `${resp} ✗ lost` : resp, cls: deliver === "lost" ? "miss" : "hit", dash: deliver === "lost" }, deliver === "lost" ? "The order exists and the card is charged, but the response is lost (timeout, dropped connection, proxy reset). The client has no idea." : "The client receives the response.", 7);
    };
    const b1 = { sku: "pen", qty: 2 };
    if (scen === IDEM_SCEN[0]) {
      push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag}` }, `The client creates an order${useKey ? `, with a unique key it generated (a UUID) for this one intent` : " with no idempotency key"}.`, 0);
      serve(b1, "#1", "lost");
      push({ from: "client", to: "client", label: "timeout → retry the same request", cls: "info" }, "Retry policies (Polly, Resilience4j, urllib3, fetch wrappers) retry on timeouts automatically. That's correct for GET, dangerous for a plain POST.", 0);
      push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag}` }, "The identical request arrives again.", 0);
      serve(b1, "#2", "ok");
    } else if (scen === IDEM_SCEN[1]) {
      push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag}` }, "The user clicks Pay.", 0);
      serve(b1, "#1", "later");
      push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag} (2nd click)` }, "Nothing seems to happen, so the user clicks again while the first request is still running.", 0);
      const r2 = serve(b1, "#2", "ok");
      const resp = finish(b1);
      if (useKey) push({ from: "api", to: "store", label: `save response for ${key}` }, "The first request finishes and stores its response.", 6);
      push({ from: "api", to: "client", label: resp, cls: "hit" }, "The first request's response arrives.", 7);
      if (r2 === "conflict") {
        push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag} (after 1 s)` }, "The client honours Retry-After and retries the second request.", 0);
        serve(b1, "#2", "ok");
      }
    } else {
      push({ from: "client", to: "api", label: `POST /orders {qty:2}${tag}` }, "The client creates an order for 2 pens.", 0);
      serve(b1, "#1", "lost");
      push({ from: "client", to: "client", label: "user edits qty to 3, app resends with the SAME key", cls: "info" }, "A buggy client keeps the old key after the user changed the order.", 0);
      push({ from: "client", to: "api", label: `POST /orders {qty:3}${tag}` }, "Same key, different body.", 0);
      serve({ sku: "pen", qty: 3 }, "#2", "ok");
    }
    const n = st.orders.length;
    push(null, n > 1 ? `<b>${n} orders and $${st.charged} charged</b> for what the user meant as one purchase.${useKey ? "" : " Turn the key on and run it again."}` : `<b>Exactly one order, $${st.charged} charged.</b> The key turned a non-idempotent POST into a safely retryable one.`, [], { verdict: n > 1 ? "duplicate" : "exactly once" });
    fr[fr.length - 1].final = true;
    return fr;
  }
  const IDEM_LANES = [{ id: "client", label: "Client" }, { id: "api", label: "Orders API" }, { id: "store", label: "Idem. store", sub: "key → hash, response" }, { id: "db", label: "Orders DB", sub: "+ payments" }];
  Viz.register("api-design-idempotency", (el) => Viz.player(el, {
    title: "Idempotency-Key: retries without double charges",
    legend: [["visit", "side effect (order + charge)"], ["bad", "lost / rejected"], ["done", "delivered / replayed"]],
    codeLang: "python",
    code: [
      "def create_order(req):",
      "    rec = store.insert_if_absent(req.key, hash(req.body))",
      "    if rec.existed and rec.hash != hash(req.body): return 422",
      "    if rec.existed and rec.status == 'processing': return 409",
      "    if rec.existed: return rec.response        # replay",
      "    order = db.create_order_and_charge(req.body)",
      "    store.complete(req.key, response := created(order))",
      "    return response",
    ],
    inputs: [
      { key: "s", label: "scenario", type: "select", options: IDEM_SCEN, value: IDEM_SCEN[0] },
      { key: "k", label: "send Idempotency-Key", type: "select", options: ["no", "yes"], value: "no" },
    ],
    random: () => ({ s: pick(IDEM_SCEN), k: pick(["no", "yes"]) }),
    build: ({ s, k }) => { if (!IDEM_SCEN.includes(s)) throw new Error("Pick a scenario."); return idemRun(s, k === "yes"); },
    render: (f) => {
      const store = Object.entries(f.st.store).map(([key, r]) => [key, `${r.status}${r.resp ? " · " + r.resp.replace("201 Created · ", "") : ""}`, r.status === "done" ? "done" : "active"]);
      const orders = f.st.orders.map((o, i) => [`order #${o.id}`, `qty ${o.qty} · $${o.qty * 20}`, i > 0 ? "bad" : ""]);
      return `<div class="ad-col"><div class="ad-fit">${seq(IDEM_LANES, f.msgs, { width: 600, max: 11, label: "idempotency key sequence" })}</div>${panels(kv("idempotency store", store, { empty: "no keys" }), kv("orders table", orders, { empty: "no orders" }))}${f.final ? stats([["orders", f.st.orders.length, f.st.orders.length > 1 ? "bad" : "done"], ["charged", "$" + f.st.charged, f.st.orders.length > 1 ? "bad" : "done"]]) : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 6. ETags and If-Match: the lost update
   * ===================================================================== */
  const ETAG_MODES = ["PUT without If-Match (last write wins)", "PUT with If-Match (optimistic concurrency)", "PATCH only the changed field (no ETag)"];
  const FIELDS = ["title", "status", "owner"];
  const parseEdit = (s, who) => {
    const m = /^\s*(\w+)\s*=\s*(.{1,24})\s*$/.exec(String(s));
    if (!m || !FIELDS.includes(m[1])) throw new Error(`${who}: write field=value where field is ${FIELDS.join(", ")} (value ≤ 24 chars).`);
    return [m[1], m[2].trim()];
  };
  Viz.register("api-design-etag", (el) => Viz.player(el, {
    title: "Two editors, one document: the lost update and how If-Match stops it",
    legend: [["visit", "GET / read"], ["done", "write accepted"], ["bad", "rejected / lost"], ["path", "Bob's re-read and retry"]],
    codeLang: "python",
    code: [
      "def put_doc(id, body, if_match):",
      "    doc = db.get(id)",
      "    if require_etag and if_match is None: return 428",
      "    if if_match and if_match != etag(doc): return 412",
      "    doc.replace(body); doc.version += 1",
      "    return 200, {'ETag': etag(doc)}",
    ],
    inputs: [
      { key: "mode", label: "update style", type: "select", options: ETAG_MODES, value: ETAG_MODES[0] },
      { key: "a", label: "Alice changes", value: "title=Q3 plan v2" },
      { key: "b", label: "Bob changes", value: "status=approved" },
    ],
    random: () => {
      const av = ["title=Q3 roadmap", "status=review", "owner=carol", "title=Plan B"], bv = ["status=approved", "owner=dave", "title=Final plan", "status=rejected"];
      return { mode: pick(ETAG_MODES), a: pick(av), b: pick(bv) };
    },
    build: ({ mode, a, b }) => {
      if (!ETAG_MODES.includes(mode)) throw new Error("Pick an update style.");
      const [af, avl] = parseEdit(a, "Alice"), [bf, bvl] = parseEdit(b, "Bob");
      const useEtag = mode === ETAG_MODES[1], patch = mode === ETAG_MODES[2];
      const srv = { doc: { title: "Q3 plan", status: "draft", owner: "alice" }, v: 1 };
      let alice = null, bob = null; const msgs = [], fr = [];
      const push = (m, note, line, extra = {}) => { if (m) [].concat(m).forEach((x) => msgs.push(x)); fr.push({ msgs: msgs.slice(), srv: clone(srv), alice: alice && clone(alice), bob: bob && clone(bob), note, line, vars: { version: srv.v, ...extra.vars }, ...extra }); };
      const put = (who, copy, ifMatch) => {
        if (useEtag && ifMatch !== `"${srv.v}"`) return [412, `412 Precondition Failed (now "${srv.v}")`];
        srv.doc = { ...copy.doc }; srv.v++; return [200, `200 OK · ETag "${srv.v}"`];
      };
      push(null, `The document is at version 1. Alice wants <code>${esc(af)} = ${esc(avl)}</code>; Bob wants <code>${esc(bf)} = ${esc(bvl)}</code>. Mode: <b>${esc(mode)}</b>.`, []);
      alice = { doc: { ...srv.doc }, etag: `"${srv.v}"` };
      push([{ from: "alice", to: "api", label: "GET /docs/9", cls: "db" }, { from: "api", to: "alice", label: `200 · ETag "${srv.v}"`, cls: "db" }], "Alice loads the document. The ETag is a fingerprint of this version.", [1]);
      bob = { doc: { ...srv.doc }, etag: `"${srv.v}"` };
      push([{ from: "bob", to: "api", label: "GET /docs/9", cls: "db" }, { from: "api", to: "bob", label: `200 · ETag "${srv.v}"`, cls: "db" }], "Bob loads the same version a moment later. Both now hold copy v1.", [1]);
      alice.doc[af] = avl;
      if (patch) {
        srv.doc[af] = avl; srv.v++;
        push([{ from: "alice", to: "api", label: `PATCH {${af}: "${avl}"}` }, { from: "api", to: "alice", label: "200 OK", cls: "hit" }], "Alice sends only the field she changed (JSON merge patch). The server merges it into the current document.", [4, 5]);
      } else {
        const [code, txt] = put("alice", alice, alice.etag);
        push([{ from: "alice", to: "api", label: `PUT whole doc${useEtag ? ` · If-Match ${alice.etag}` : ""}` }, { from: "api", to: "alice", label: txt, cls: code === 200 ? "hit" : "miss" }], `Alice saves the <b>whole</b> document (PUT replaces it).${useEtag ? " Her If-Match matches the current version, so it's accepted and the version moves to 2." : ""}`, useEtag ? [3, 4, 5] : [4, 5]);
      }
      bob.doc[bf] = bvl;
      if (patch) {
        const clobber = bf === af;
        srv.doc[bf] = bvl; srv.v++;
        push([{ from: "bob", to: "api", label: `PATCH {${bf}: "${bvl}"}` }, { from: "api", to: "bob", label: "200 OK", cls: "hit" }], clobber ? `Bob patches the <b>same</b> field. The merge silently overwrites Alice's value: field-level patches shrink the window but don't close it.` : "Bob patches a different field, so the merge keeps both changes. That is luck of the field choice, not a guarantee.", [4, 5]);
      } else {
        const [code, txt] = put("bob", bob, bob.etag);
        push([{ from: "bob", to: "api", label: `PUT whole doc${useEtag ? ` · If-Match ${bob.etag}` : ""}` }, { from: "api", to: "bob", label: txt, cls: code === 200 ? "hit" : "miss" }],
          code === 200 ? `Bob saves his whole copy, which was read <b>before</b> Alice's save. The server has no way to know that, so it replaces the document. Alice's <code>${esc(af)}</code> change is gone.` : `Bob's If-Match says "${bob.etag.replace(/"/g, "")}" but the document is now at ${srv.v}. The server refuses instead of clobbering Alice.`, useEtag ? [3] : [4, 5]);
        if (code === 412) {
          bob = { doc: { ...srv.doc }, etag: `"${srv.v}"` };
          push([{ from: "bob", to: "api", label: "GET /docs/9", cls: "path" }, { from: "api", to: "bob", label: `200 · ETag "${srv.v}"`, cls: "path" }], "Bob's client re-reads the latest version, which includes Alice's change.", [1]);
          bob.doc[bf] = bvl;
          const [c2, t2] = put("bob", bob, bob.etag);
          push([{ from: "bob", to: "api", label: `PUT whole doc · If-Match ${bob.etag}`, cls: "path" }, { from: "api", to: "bob", label: t2, cls: c2 === 200 ? "hit" : "miss" }], `Bob re-applies his change on top of the fresh copy and saves with the new ETag. ${af === bf ? "He changed the same field, but now he did it knowingly: his client could show him Alice's value first." : "Both changes survive."}`, [3, 4, 5]);
        }
      }
      const aliceKept = srv.doc[af] === avl, bobKept = srv.doc[bf] === bvl;
      const lost = !aliceKept && !(af === bf && useEtag);
      push(null, lost ? `<b>Lost update.</b> Final document has ${esc(af)} = "${esc(srv.doc[af])}"; Alice was told her save succeeded, but it was silently undone.` : `<b>No silent loss.</b> Every change that was reported as saved is in the final document${af === bf ? " (or was knowingly overwritten after a 412)" : ""}.`, [], { final: true, lost, vars: { "Alice kept": aliceKept, "Bob kept": bobKept } });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "alice", label: "Alice" }, { id: "api", label: "Docs API", sub: "/docs/9" }, { id: "bob", label: "Bob" }];
      const rows = (d, ref) => d ? FIELDS.map((k) => [k, d.doc ? d.doc[k] : d[k], ref && (d.doc ? d.doc[k] : d[k]) !== ref[k] ? "active" : ""]) : [];
      const orig = { title: "Q3 plan", status: "draft", owner: "alice" };
      return `<div class="ad-col"><div class="ad-fit">${seq(lanes, f.msgs, { width: 600, max: 10, label: "lost update sequence" })}</div>${panels(
        kv(`Alice's copy ${f.alice ? f.alice.etag : ""}`, rows(f.alice, orig), { empty: "not loaded" }),
        kv(`server · version ${f.srv.v}`, rows(f.srv.doc, orig), { cls: f.final ? (f.lost ? "bad" : "done") : "" }),
        kv(`Bob's copy ${f.bob ? f.bob.etag : ""}`, rows(f.bob, orig), { empty: "not loaded" }))}</div>`;
    },
  }));

  /* =====================================================================
   * 7. Long-running operations: 202 + status monitor + polling
   * ===================================================================== */
  const POLL = ["honours Retry-After", "polls every 0.5 s", "polls every 10 s"];
  Viz.register("api-design-lro", (el) => Viz.player(el, {
    title: "Long-running operation: 202 Accepted, a status monitor, and polling",
    legend: [["visit", "work in the background"], ["active", "poll: still running"], ["done", "finished / result"], ["bad", "failed"]],
    codeLang: "python",
    code: [
      "resp = POST('/reports', body)            # 202 Accepted",
      "op_url = resp.headers['Operation-Location']",
      "while True:",
      "    sleep(resp.headers.get('Retry-After', default))",
      "    resp = GET(op_url)",
      "    if resp.json['status'] in TERMINAL: break",
      "if status == 'Succeeded': GET(resp.json['resourceLocation'])",
    ],
    inputs: [
      { key: "w", label: "work takes (s)", value: "10", width: 60 },
      { key: "r", label: "server Retry-After (s)", value: "3", width: 60 },
      { key: "c", label: "client", type: "select", options: POLL, value: POLL[0] },
      { key: "o", label: "outcome", type: "select", options: ["Succeeded", "Failed"], value: "Succeeded" },
    ],
    random: () => ({ w: String(3 + Math.floor(Math.random() * 15)), r: String(1 + Math.floor(Math.random() * 5)), c: pick(POLL), o: Math.random() < 0.75 ? "Succeeded" : "Failed" }),
    build: ({ w, r, c, o }) => {
      const W = num(w, "work", 1, 30), R = int(r, "Retry-After", 1, 10);
      if (!POLL.includes(c)) throw new Error("Pick a client behaviour.");
      const every = c === POLL[0] ? R : c === POLL[1] ? 0.5 : 10;
      if (W / every > 40) throw new Error(`That's ${Math.ceil(W / every)} polls; keep it under 40 (raise the interval or shorten the work).`);
      const msgs = [], fr = []; let polls = 0, wasted = 0, doneShown = false;
      const push = (m, t, note, line, extra = {}) => { if (m) [].concat(m).forEach((x) => msgs.push(x)); fr.push({ msgs: msgs.slice(), t, W, o, pct: Math.min(100, Math.round((t / W) * 100)), note, line, vars: { t: `${+t.toFixed(1)} s`, polls, wasted }, ...extra }); };
      push([{ from: "client", to: "api", label: "POST /reports {year: 2026}" }, { from: "api", to: "worker", label: "enqueue op-5d2", cls: "db" }, { from: "api", to: "client", label: `202 Accepted · Operation-Location · Retry-After: ${R}`, cls: "hit" }], 0,
        `The API validates the request, queues the work and answers <b>immediately</b> with <code>202 Accepted</code>, the URL of a status monitor (<code>/operations/op-5d2</code>), and a hint for when to ask again. No connection is held open for ${W} seconds.`, [0, 1]);
      for (let t = every; ; t += every) {
        if (!doneShown && t >= W) {
          doneShown = true;
          push({ from: "worker", to: "worker", label: `t=${W}s: work ${o === "Succeeded" ? "done" : "failed"}`, cls: o === "Succeeded" ? "hit" : "miss" }, W, `The worker finishes at t = ${W} s and records the outcome on the operation resource. Nobody is told; the client finds out on its next poll.`, []);
        }
        polls++;
        const fin = t >= W, tt = +t.toFixed(2);
        if (!fin) {
          wasted++;
          push([{ from: "client", to: "api", label: `GET /operations/op-5d2 (t=${tt}s)` }, { from: "api", to: "client", label: `200 {status: Running, ${Math.round((t / W) * 100)}%}`, cls: "act" }], t, `Poll ${polls} at t = ${tt} s: still running.${every < R ? ` This client ignores Retry-After: ${R} and polls every ${every} s, which costs the server a request for no new information.` : ""}`, [2, 3, 4, 5]);
          continue;
        }
        const late = +(t - W).toFixed(2);
        push([{ from: "client", to: "api", label: `GET /operations/op-5d2 (t=${tt}s)` }, { from: "api", to: "client", label: o === "Succeeded" ? "200 {status: Succeeded, resourceLocation}" : "200 {status: Failed, error: {...}}", cls: o === "Succeeded" ? "hit" : "miss" }], t,
          `Poll ${polls}: a terminal status. The client learns the outcome ${late ? `${late} s after it happened` : "the moment it happened"}. ${o === "Failed" ? "The <i>poll</i> still returns 200: the status request succeeded; the <i>operation</i> failed, and the body says why (a problem-details style error)." : ""}`, [4, 5], { fin: true });
        if (o === "Succeeded") push([{ from: "client", to: "api", label: "GET /reports/2026" }, { from: "api", to: "client", label: "200 OK (the report)", cls: "hit" }], t, "The client follows <code>resourceLocation</code> to the result. The operation resource stays around (say, 24 h) so late pollers get the same answer.", [6], { fin: true });
        const tot = polls + 1 + (o === "Succeeded" ? 1 : 0);
        push(null, t, `<b>${polls} poll${polls > 1 ? "s" : ""}, ${wasted} of them "still running", outcome seen ${late} s late, ${tot} requests in all.</b> Polling trades latency against load: faster polling finds out sooner and costs more requests. Retry-After lets the <i>server</i> tune that trade-off, and webhooks remove it when clients can receive callbacks.`, [], { fin: true, final: true, late, tot });
        break;
      }
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "client", label: "Client" }, { id: "api", label: "Reports API", sub: "+ /operations/{id}" }, { id: "worker", label: "Worker", sub: "queue consumer" }];
      const bar = `<div class="ad-prog"><div class="ad-prog-h"><span>operation op-5d2</span><span>${f.t < f.W ? "Running" : f.fin ? f.o : f.o + " (client not told yet)"} · ${f.pct}%</span></div><div class="ad-prog-bar"><i class="${f.t < f.W ? "" : f.o === "Failed" ? "bad" : "done"}" style="width:${f.pct}%"></i></div></div>`;
      return `<div class="ad-col"><div class="ad-fit">${seq(lanes, f.msgs, { width: 600, max: 11, label: "long running operation sequence" })}</div>${bar}${f.final ? stats([["polls", f.vars.polls, ""], ["wasted polls", f.vars.wasted, f.vars.wasted > 3 ? "bad" : "active"], ["seen late by", f.late + " s", f.late > 3 ? "bad" : "done"], ["total requests", f.tot, ""]]) : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 8. Evolution: is this change breaking? Run real clients against it.
   * ===================================================================== */
  const RESP_V1 = { id: 42, status: "shipped", total: 19.99, note: "leave at door" };
  const SCHEMA = { id: "number", status: "enum", total: "number", note: "string?" };
  const ENUM = ["open", "shipped"];
  const REQ_V1 = { items: [{ sku: "pen", qty: 20 }] };
  const validateV1 = (b) => { if (!Array.isArray(b.items) || !b.items.length) return "items is required"; for (const it of b.items) { if (typeof it.sku !== "string") return "sku must be a string"; if (!Number.isInteger(it.qty) || it.qty < 1 || it.qty > 100) return "qty must be 1..100"; } return null; };
  const CHANGES = {
    "Add optional response field \"currency\"": { resp: (r) => ({ ...r, currency: "EUR" }), safe: "additive" },
    "Add enum value status = \"cancelled\"": { resp: (r) => ({ ...r, status: "cancelled" }), why: "Clients that switch exhaustively over the enum crash on a value they've never seen." },
    "Rename \"total\" to \"amount\"": { resp: (r) => ({ id: r.id, status: r.status, amount: r.total, note: r.note }) },
    "Change \"id\" from number to string": { resp: (r) => ({ ...r, id: "ord_42" }) },
    "Remove optional field \"note\"": { resp: (r) => { const { note, ...x } = r; return x; }, semantic: "Parsers survive because the field was optional, but anyone who displayed or stored it silently loses data. Both Microsoft and Google guidelines count removal as breaking." },
    "Add required request field \"email\"": { validate: (b) => validateV1(b) || (typeof b.email !== "string" ? "email is required" : null) },
    "Add optional request field \"giftWrap\"": { validate: (b) => validateV1(b) || (b.giftWrap !== undefined && typeof b.giftWrap !== "boolean" ? "giftWrap must be boolean" : null), safe: "additive" },
    "Tighten validation: qty ≤ 10 (was ≤ 100)": { validate: (b) => validateV1(b) || (b.items.some((i) => i.qty > 10) ? "qty must be 1..10" : null) },
    "Relax validation: qty ≤ 1000": { validate: (b) => { if (!Array.isArray(b.items) || !b.items.length) return "items is required"; return b.items.some((i) => !Number.isInteger(i.qty) || i.qty < 1 || i.qty > 1000) ? "qty must be 1..1000" : null; }, safe: "relaxing input" },
  };
  const typeOk = (k, v) => SCHEMA[k] === "number" ? typeof v === "number" : SCHEMA[k] === "enum" ? typeof v === "string" : typeof v === "string";
  const required = (r) => { for (const k of Object.keys(SCHEMA)) { if (SCHEMA[k].endsWith("?")) { if (k in r && typeof r[k] !== "string") return `${k}: wrong type`; continue; } if (!(k in r)) return `missing required "${k}"`; if (!typeOk(k, r[k])) return `"${k}" is ${typeof r[k]}, expected ${SCHEMA[k]}`; } return null; };
  const CLIENTS = [
    { id: "strict", name: "Strict deserializer", sub: "fails on unknown fields and enum values", run: (r) => { const u = Object.keys(r).find((k) => !(k in SCHEMA)); if (u) return `unknown property "${u}"`; const e = required(r); if (e) return e; if (!ENUM.includes(r.status)) return `unknown enum value "${r.status}"`; return null; } },
    { id: "tolerant", name: "Tolerant reader", sub: "ignores unknowns, maps unknown enum → Other", run: (r) => required(r) },
    { id: "sdk", name: "Generated SDK", sub: "ignores unknown fields; exhaustive switch(status)", run: (r) => { const e = required(r); if (e) return e; if (!ENUM.includes(r.status)) return `switch(status): no case for "${r.status}"`; return null; } },
    { id: "req", name: "v1 client sending a request", sub: "POST /orders with the v1 body", req: true },
  ];
  const jsonRows = (o, other) => Object.keys({ ...o, ...other }).filter((k) => k in o).map((k) => [k, J(o[k]), !(k in other) ? "done" : J(other[k]) !== J(o[k]) ? "active" : ""]);
  Viz.register("api-design-evolve", (el) => Viz.player(el, {
    title: "Is this change breaking? Run four real clients against it",
    legend: [["done", "added / passes"], ["active", "changed"], ["bad", "removed / client breaks"]],
    codeLang: "python",
    code: [
      "v2 = apply(change, v1_contract)",
      "for client in clients_in_the_wild:",
      "    try: client.handle(v2)       # their code, not yours",
      "    except Exception: broken.append(client)",
      "breaking = bool(broken) or change.loses_meaning",
    ],
    inputs: [{ key: "c", label: "change", type: "select", options: Object.keys(CHANGES), value: "Add enum value status = \"cancelled\"" }],
    random: () => ({ c: pick(Object.keys(CHANGES)) }),
    build: ({ c }) => {
      const ch = CHANGES[c]; if (!ch) throw new Error("Pick a change.");
      const v2 = ch.resp ? ch.resp(RESP_V1) : RESP_V1, results = {}, fr = [];
      const validate = ch.validate || validateV1;
      const base = { v2, results, c };
      fr.push({ ...base, results: {}, line: 0, vars: { change: ch.resp ? "response" : "request" }, note: `The change: <b>${esc(c)}</b>. Left: the v1 ${ch.resp ? "response" : "request"}; right: what v2 ${ch.resp ? "returns" : "accepts"}. Now run the clients that already exist in the wild against it. You don't control their code.` });
      for (const cl of CLIENTS) {
        const err = cl.req ? validate(REQ_V1) && `server: 400 ${validate(REQ_V1)}` : cl.run(v2);
        results[cl.id] = err || "";
        fr.push({ ...base, results: { ...results }, cur: cl.id, line: [1, 2, 3], vars: { client: cl.id, ok: !err }, note: `<b>${esc(cl.name)}</b> (${esc(cl.sub)}): ${err ? `<b>breaks</b>: ${esc(err)}.` : "works."}` });
      }
      const broken = CLIENTS.filter((cl) => results[cl.id]);
      const onlyStrict = broken.length === 1 && broken[0].id === "strict";
      const kind = broken.length && !onlyStrict ? "bad" : ch.semantic ? "bad" : onlyStrict ? "active" : "done";
      const text = kind === "bad" ? `<b>Breaking.</b> ${ch.semantic || ch.why || `${broken.map((b) => b.name).join(", ")} fail${broken.length === 1 ? "s" : ""}.`} Ship it as a new version (or a new field alongside the old one) and deprecate the old shape on a schedule.`
        : onlyStrict ? `<b>Compatible, by contract.</b> Only the strict deserializer breaks. API guidelines (Microsoft, Google, Zalando) require clients to ignore unknown fields, so this change is allowed, but say so in your docs and SDKs.`
        : `<b>Safe</b> (${esc(ch.safe || "no client affected")}). Existing clients keep working unchanged.`;
      fr.push({ ...base, results: { ...results }, final: kind, line: 4, vars: { broken: broken.length }, note: text });
      return fr;
    },
    render: (f) => {
      const ch = CHANGES[f.c];
      const left = ch.resp ? kv("v1 response", jsonRows(RESP_V1, f.v2).map(([k, v, c]) => [k, v, c === "done" ? "bad" : c])) : kv("v1 request body", [["items", J(REQ_V1.items), ""]]);
      const right = ch.resp ? kv("v2 response", jsonRows(f.v2, RESP_V1)) : kv("v2 server rule", [["rule", f.c.replace(/^[^:]*: /, ""), "active"]]);
      const cards = CLIENTS.map((cl) => {
        const r = f.results[cl.id], st = r === undefined ? "" : r ? "bad" : "done";
        return `<div class="ad-card ${st} ${f.cur === cl.id ? "cur" : ""}"><b>${esc(cl.name)}</b><span>${esc(cl.sub)}</span><em>${r === undefined ? "not run yet" : r ? "✗ " + esc(r) : "✓ works"}</em></div>`;
      }).join("");
      return `<div class="ad-col">${panels(left, `<div class="ad-arrow">→</div>`, right)}<div class="ad-cards">${cards}</div>${f.final ? verdict(f.final === "bad" ? "BREAKING" : f.final === "active" ? "COMPATIBLE (tolerant readers required)" : "SAFE", f.final) : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 9. Bulk operations: atomic vs partial success
   * ===================================================================== */
  const CATALOGUE = ["pen", "mug", "book", "lamp"];
  const BULK_MODES = ["atomic (all or nothing)", "partial success (per-item results)"];
  Viz.register("api-design-bulk", (el) => Viz.player(el, {
    title: "POST /orders:batch — all or nothing, or per-item results?",
    legend: [["active", "validating"], ["done", "ok / written"], ["bad", "rejected"], ["dim", "rolled back"]],
    codeLang: "python",
    code: [
      "errors, results = [], []",
      "for i, item in enumerate(batch):",
      "    err = validate(item, seen)      # catalogue, qty, duplicates",
      "    (errors if err else results).append((i, err or item))",
      "if atomic and errors: rollback(); return 422, problem(errors)",
      "commit(ok_items)",
      "return 200, per_item_results     # or 207 Multi-Status",
    ],
    inputs: [
      { key: "items", label: "items (sku:qty)", value: "pen:2, mug:0, ghost:1, book:3, pen:1" },
      { key: "m", label: "mode", type: "select", options: BULK_MODES, value: BULK_MODES[0] },
    ],
    random: () => {
      const skus = [...CATALOGUE, "ghost", "pen"], n = 3 + Math.floor(Math.random() * 4), a = [];
      for (let i = 0; i < n; i++) a.push(`${pick(skus)}:${pick([1, 2, 3, 5, 0, 150, 4])}`);
      return { items: a.join(", "), m: pick(BULK_MODES) };
    },
    build: ({ items, m }) => {
      if (!BULK_MODES.includes(m)) throw new Error("Pick a mode.");
      const toks = String(items).split(",").map((t) => t.trim()).filter(Boolean);
      if (toks.length < 1 || toks.length > 8) throw new Error("items: give 1–8 entries like pen:2.");
      const rows = toks.map((t) => { const mm = /^([a-z]*)\s*:\s*(-?\d+)$/i.exec(t); if (!mm) throw new Error(`"${t}" should look like sku:qty, e.g. pen:2.`); return { sku: mm[1].toLowerCase(), qty: Number(mm[2]), st: "", msg: "" }; });
      const atomic = m === BULK_MODES[0], seen = new Set(), fr = [];
      const snap = (extra) => ({ rows: clone(rows), atomic, ...extra });
      fr.push(snap({ line: 0, vars: { items: rows.length, mode: atomic ? "atomic" : "partial" }, note: `${rows.length} items in one request. Catalogue: ${CATALOGUE.join(", ")}. Quantity 1–100. Each SKU at most once per batch.` }));
      rows.forEach((r, i) => {
        let err = null, code = 201;
        if (!r.sku) { err = "sku is required"; code = 422; }
        else if (!CATALOGUE.includes(r.sku)) { err = `unknown sku "${r.sku}"`; code = 422; }
        else if (r.qty < 1 || r.qty > 100) { err = "qty must be 1..100"; code = 422; }
        else if (seen.has(r.sku)) { err = `duplicate of an earlier "${r.sku}"`; code = 409; }
        if (!err) seen.add(r.sku);
        r.st = err ? "bad" : "ok"; r.msg = err || "valid"; r.code = code;
        fr.push(snap({ cur: i, line: [1, 2, 3], vars: { i, sku: r.sku || "∅", qty: r.qty, ok: !err }, note: `Item ${i} (<code>${esc(r.sku || "∅")}:${r.qty}</code>): ${err ? `<b>${esc(err)}</b> → ${code}.` : "valid."} Validate <i>every</i> item before deciding, so the client gets all errors in one round trip.` }));
      });
      const bad = rows.filter((r) => r.st === "bad"), good = rows.filter((r) => r.st === "ok");
      let resp;
      if (atomic && bad.length) {
        good.forEach((r) => { r.st = "rolled"; r.msg = "not written (batch rejected)"; });
        resp = { status: 422, body: { type: "https://example.com/probs/batch-invalid", title: "One or more items are invalid", status: 422, errors: rows.map((r, i) => r.code !== 201 ? { index: i, detail: r.msg } : null).filter(Boolean) } };
        fr.push(snap({ line: 4, resp, vars: { written: 0, rejected: bad.length }, note: `Atomic: ${bad.length} item${bad.length > 1 ? "s" : ""} failed, so <b>nothing</b> is written. One status (422) with a problem detail listing every bad index. Simple for clients: fix and resend the whole batch.` }));
      } else {
        good.forEach((r) => { r.st = "written"; r.msg = "created"; });
        resp = { status: 200, body: { results: rows.map((r, i) => ({ index: i, status: r.st === "written" ? 201 : r.code, ...(r.st === "written" ? { id: `ord_${100 + i}` } : { detail: r.msg }) })) } };
        fr.push(snap({ line: [5, 6], resp, vars: { written: good.length, rejected: bad.length }, note: atomic ? "Atomic and all valid: commit everything in one transaction." : `Partial: the ${good.length} valid item${good.length === 1 ? " is" : "s are"} written; each result carries its own status. The HTTP status (200, or 207 Multi-Status) only says the <i>batch</i> was processed. Clients <b>must</b> read every item's status, and retries must resend only the failures (idempotency keys per item help).` }));
      }
      return fr;
    },
    render: (f) => {
      const cls = (r, i) => (f.cur === i ? "active" : r.st === "bad" ? "bad" : r.st === "rolled" ? "dim" : r.st === "ok" || r.st === "written" ? "done" : "");
      const body = f.rows.map((r, i) => `<tr class="${cls(r, i)}"><td>${i}</td><td>${esc(r.sku || "∅")}</td><td>${r.qty}</td><td>${esc(r.msg || "…")}</td></tr>`).join("");
      const table = `<table class="ad-tbl"><thead><tr><th>#</th><th>sku</th><th>qty</th><th>result</th></tr></thead><tbody>${body}</tbody></table>`;
      const resp = f.resp ? `<pre class="ad-pre">HTTP ${f.resp.status} ${f.resp.status === 422 ? "· application/problem+json" : "· application/json"}\n${esc(JSON.stringify(f.resp.body, null, 1).replace(/\n\s*/g, " ").replace(/\{ /g, "{").replace(/ \}/g, "}").replace(/\[ /g, "[").replace(/ \]/g, "]").replace(/\}, \{/g, "},\n  {").replace(/\[\{/g, "[\n  {"))}</pre>` : "";
      return `<div class="ad-col">${panels(table, resp)}</div>`;
    },
  }));
})();
