/* API security visualizers. Every registered name is prefixed "api-security-". */
(() => {
  const esc = Viz.esc;
  const int = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: use a whole number from ${min} to ${max}.`);
    return n;
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const J = (o) => JSON.stringify(o);
  const clone = (o) => JSON.parse(JSON.stringify(o));

  const kv = (title, rows, o = {}) => `<div class="as-kv ${o.cls || ""}"><div class="as-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="as-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="as-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="as-stats">${items.map(([l, v, c]) => `<div class="as-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const panels = (...p) => `<div class="as-panels">${p.filter(Boolean).join("")}</div>`;
  const verdict = (html, c) => `<div class="as-verdict ${c || ""}">${html}</div>`;

  /* sequence diagram. lanes [{id,label,sub,cls}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 600, n = lanes.length, lw = W / n, rowH = o.rowH || 29, max = o.max || 12;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, (i + 0.5) * lw]));
    let s = `<svg class="as-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 10, 170);
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
   * Real crypto, small enough to read: SHA-256, HMAC-SHA256, base64url,
   * and a toy RSA (528-bit, generated deterministically) for RS256.
   * ===================================================================== */
  const utf8 = (s) => new TextEncoder().encode(s);
  const K256 = new Uint32Array([
    0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3,
    0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174, 0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
    0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967, 0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13,
    0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208,
    0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2]);
  function sha256(bytes) {
    const len = bytes.length, total = ((len + 9 + 63) >> 6) << 6, m = new Uint8Array(total);
    m.set(bytes); m[len] = 0x80;
    const bits = len * 8, dv = new DataView(m.buffer);
    dv.setUint32(total - 8, Math.floor(bits / 0x100000000)); dv.setUint32(total - 4, bits >>> 0);
    const H = new Uint32Array([0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19]);
    const w = new Uint32Array(64), r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let off = 0; off < total; off += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(off + i * 4);
      for (let i = 16; i < 64; i++) {
        const s0 = r(w[i - 15], 7) ^ r(w[i - 15], 18) ^ (w[i - 15] >>> 3), s1 = r(w[i - 2], 17) ^ r(w[i - 2], 19) ^ (w[i - 2] >>> 10);
        w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
      }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      H[0] += a; H[1] += b; H[2] += c; H[3] += d; H[4] += e; H[5] += f; H[6] += g; H[7] += h;
    }
    const out = new Uint8Array(32), ov = new DataView(out.buffer);
    H.forEach((x, i) => ov.setUint32(i * 4, x));
    return out;
  }
  function hmac256(key, msg) {
    let k = key.length > 64 ? sha256(key) : key;
    const ipad = new Uint8Array(64 + msg.length), opad = new Uint8Array(96);
    for (let i = 0; i < 64; i++) { const b = k[i] || 0; ipad[i] = b ^ 0x36; opad[i] = b ^ 0x5c; }
    ipad.set(msg, 64); opad.set(sha256(ipad), 64);
    return sha256(opad);
  }
  const hex = (b) => Array.from(b, (x) => x.toString(16).padStart(2, "0")).join("");
  const b64u = (bytes) => {
    let s = ""; bytes.forEach((b) => { s += String.fromCharCode(b); });
    return btoa(s).replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "");
  };
  const unb64u = (s) => {
    if (!/^[A-Za-z0-9_-]*$/.test(s)) throw new Error("not base64url");
    const t = s.replace(/-/g, "+").replace(/_/g, "/"), p = t + "=".repeat((4 - (t.length % 4)) % 4);
    return Uint8Array.from(atob(p), (c) => c.charCodeAt(0));
  };
  const b64uJson = (o) => b64u(utf8(J(o)));
  const eqBytes = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);

  /* toy RSA: enough to sign and verify RS256 for real, far too small for anything else */
  const big = {
    pow(b, e, m) { let r = 1n; b %= m; while (e > 0n) { if (e & 1n) r = (r * b) % m; b = (b * b) % m; e >>= 1n; } return r; },
    inv(a, m) { let [r0, r1, s0, s1] = [m, a % m, 0n, 1n]; while (r1) { const q = r0 / r1; [r0, r1] = [r1, r0 - q * r1]; [s0, s1] = [s1, s0 - q * s1]; } return ((s0 % m) + m) % m; },
    prime(n) {
      if (n < 2n) return false;
      for (const p of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) { if (n === p) return true; if (n % p === 0n) return false; }
      let d = n - 1n, s = 0; while (!(d & 1n)) { d >>= 1n; s++; }
      outer: for (const a of [2n, 3n, 5n, 7n, 11n, 13n, 17n, 19n, 23n, 29n, 31n, 37n]) {
        let x = big.pow(a, d, n); if (x === 1n || x === n - 1n) continue;
        for (let i = 1; i < s; i++) { x = (x * x) % n; if (x === n - 1n) continue outer; }
        return false;
      }
      return true;
    },
    fromBytes: (b) => BigInt("0x" + (hex(b) || "0")),
    toBytes(x, len) { let h = x.toString(16); h = h.padStart(len * 2, "0"); return Uint8Array.from(h.match(/../g), (p) => parseInt(p, 16)); },
  };
  let RSA = null;
  function rsaKey() {
    if (RSA) return RSA;
    const E = 65537n, seed = (tag) => (1n << 263n) | big.fromBytes(sha256(utf8("api-security toy RSA " + tag)));
    const next = (x) => { x |= 1n; while (!big.prime(x) || x % E === 1n) x += 2n; return x; };
    const p = next(seed("p")), q = next(seed("q")), n = p * q, d = big.inv(E, (p - 1n) * (q - 1n));
    const k = Math.ceil(n.toString(16).length / 2);
    RSA = { n, e: E, d, k, jwk: { kty: "RSA", kid: "rsa-2026", alg: "RS256", use: "sig", n: b64u(big.toBytes(n, k)), e: "AQAB" } };
    return RSA;
  }
  const DI256 = [0x30, 0x31, 0x30, 0x0d, 0x06, 0x09, 0x60, 0x86, 0x48, 0x01, 0x65, 0x03, 0x04, 0x02, 0x01, 0x05, 0x00, 0x04, 0x20];
  function emsa(msg, k) {
    const t = [...DI256, ...sha256(msg)], em = new Uint8Array(k);
    em[1] = 1; em.fill(0xff, 2, k - t.length - 1); em.set(t, k - t.length);
    return em;
  }
  const rs256Sign = (msg) => { const K = rsaKey(); return big.toBytes(big.pow(big.fromBytes(emsa(msg, K.k)), K.d, K.n), K.k); };
  const rs256Verify = (msg, sig) => { const K = rsaKey(); if (sig.length !== K.k) return false; return eqBytes(big.toBytes(big.pow(big.fromBytes(sig), K.e, K.n), K.k), emsa(msg, K.k)); };

  /* expose the primitives for the test harness only (not used by the page) */
  Viz._apiSecurityCrypto = { sha256, hmac256, b64u, unb64u, rs256Sign, rs256Verify, rsaKey, utf8, hex };

  /* =====================================================================
   * 1. The gate: 401, 403 or 404?
   * ===================================================================== */
  const ORDERS = { 42: { tenant: "contoso", owner: "alice", total: "€120" }, 43: { tenant: "fabrikam", owner: "dave", total: "€80" } };
  const GOOD = { sig: true, iss: true, aud: true, exp: true, scp: ["orders.read", "orders.write"], tid: "contoso", sub: "alice", roles: [] };
  const GATE_CASES = {
    "No Authorization header": { token: null, id: 42 },
    "Expired token (exp 20 min ago)": { token: { ...GOOD, exp: false }, id: 42 },
    "Token issued for another API (aud = graph)": { token: { ...GOOD, aud: false }, id: 42 },
    "Signature doesn't verify (payload edited)": { token: { ...GOOD, sig: false }, id: 42 },
    "Valid token, only scope orders.read": { token: { ...GOOD, scp: ["orders.read"] }, id: 42 },
    "Valid token, order 43 belongs to another tenant": { token: GOOD, id: 43 },
    "Valid token, order 99 doesn't exist": { token: GOOD, id: 99 },
    "Valid token, Bob reads Alice's order (same tenant)": { token: { ...GOOD, sub: "bob" }, id: 42 },
    "Valid token, Bob with role Orders.Manager": { token: { ...GOOD, sub: "bob", roles: ["Orders.Manager"] }, id: 42 },
    "Valid token, Alice's own order": { token: GOOD, id: 42 },
  };
  const GATES = [
    ["authn", "Authenticate", "token present; signature, iss, aud, exp valid"],
    ["scope", "Endpoint policy", "token carries the scope this endpoint needs"],
    ["load", "Load the resource", "does order {id} exist at all?"],
    ["owner", "Resource policy", "same tenant, and owner or manager role"],
    ["run", "Handler", "do the work"],
  ];
  function gateRun(c, method, hide) {
    const t = c.token, need = method === "GET" ? "orders.read" : "orders.write", steps = [];
    const res = (code, text, why, hdr) => ({ code, text, why, hdr });
    if (!t) { steps.push(["authn", false, "no token"]); return { steps, out: res(401, "401 Unauthorized", "Nobody is authenticated.", 'WWW-Authenticate: Bearer realm="orders"') }; }
    const bad = !t.sig ? "signature" : !t.iss ? "issuer" : !t.aud ? "audience" : !t.exp ? "lifetime" : null;
    if (bad) { steps.push(["authn", false, `${bad} check failed`]); return { steps, out: res(401, "401 Unauthorized", `The token is invalid (${bad}). Asking again with the same token won't help; get a new one.`, `WWW-Authenticate: Bearer error="invalid_token", error_description="${bad} check failed"`) }; }
    steps.push(["authn", true, `sub=${t.sub}, tid=${t.tid}`]);
    if (!t.scp.includes(need)) { steps.push(["scope", false, `needs ${need}, has ${t.scp.join(" ")}`]); return { steps, out: res(403, "403 Forbidden", `We know who you are, but this token doesn't carry <code>${need}</code>. The client must ask the user to consent to that scope.`, `WWW-Authenticate: Bearer error="insufficient_scope", scope="${need}"`) }; }
    steps.push(["scope", true, `${need} ✓`]);
    const o = ORDERS[c.id];
    if (!o) { steps.push(["load", false, `no order ${c.id}`]); return { steps, out: res(404, "404 Not Found", "There is no such order.", "Content-Type: application/problem+json") }; }
    steps.push(["load", true, `order ${c.id}: tenant ${o.tenant}, owner ${o.owner}`]);
    const sameTenant = o.tenant === t.tid, allowed = sameTenant && (o.owner === t.sub || t.roles.includes("Orders.Manager"));
    if (!allowed) {
      steps.push(["owner", false, !sameTenant ? `tenant ${o.tenant} ≠ ${t.tid}` : `${t.sub} isn't the owner and has no manager role`]);
      const code = hide && !sameTenant ? 404 : 403;
      return { steps, out: res(code, code === 404 ? "404 Not Found" : "403 Forbidden", code === 404 ? "The order exists, but answering 403 would confirm that to someone from another tenant. 404 reveals nothing." : sameTenant ? "Same tenant, so the caller may know the order exists; they just can't touch it." : "403 confirms that order exists. An attacker iterating ids now knows which ones are real.", "Content-Type: application/problem+json") };
    }
    steps.push(["owner", true, o.owner === t.sub ? "caller owns it" : "manager role in the same tenant"]);
    steps.push(["run", true, method === "GET" ? "read" : "updated"]);
    return { steps, out: res(method === "GET" ? 200 : 204, method === "GET" ? `200 OK {total: "${o.total}"}` : "204 No Content", "Every gate passed.", "") };
  }
  Viz.register("api-security-gate", (el) => Viz.player(el, {
    title: "401, 403 or 404? Walk one request through the security gates",
    legend: [["active", "gate being checked"], ["done", "passed"], ["bad", "rejected here"]],
    codeLang: "python",
    code: [
      "user = authenticate(req)                  # JwtBearer / resource server",
      "if user is None: return 401               # + WWW-Authenticate: Bearer error=...",
      "if need not in user.scopes: return 403    # endpoint policy (coarse)",
      "order = db.find(id)",
      "if order is None: return 404",
      "if not can_access(user, order):           # resource policy (fine-grained)",
      "    return 404 if other_tenant else 403   # don't confirm it exists",
      "return handle(order)",
    ],
    inputs: [
      { key: "c", label: "token and target", type: "select", options: Object.keys(GATE_CASES), value: "Valid token, order 43 belongs to another tenant" },
      { key: "m", label: "request", type: "select", options: ["GET", "PATCH"], value: "GET" },
      { key: "h", label: "other tenant's order →", type: "select", options: ["404 (hide it)", "403"], value: "404 (hide it)" },
    ],
    random: () => ({ c: pick(Object.keys(GATE_CASES)), m: pick(["GET", "PATCH"]), h: pick(["404 (hide it)", "403"]) }),
    build: ({ c, m, h }) => {
      const cs = GATE_CASES[c]; if (!cs) throw new Error("Pick a scenario from the list.");
      if (m !== "GET" && m !== "PATCH") throw new Error("Pick GET or PATCH.");
      const { steps, out } = gateRun(cs, m, h !== "403"), fr = [], t = cs.token;
      const claims = t ? [["sub", t.sub], ["tid", t.tid], ["aud", t.aud ? "api://orders" : "https://graph.microsoft.com", t.aud ? "" : "bad"], ["exp", t.exp ? "in 42 min" : "20 min ago", t.exp ? "" : "bad"], ["signature", t.sig ? "valid" : "invalid", t.sig ? "" : "bad"], ["scp", t.scp.join(" ")], ["roles", t.roles.join(" ") || "(none)"]] : [];
      const base = { claims, req: `${m} /orders/${cs.id}`, state: {}, out: null };
      const LINE = { authn: [0, 1], scope: 2, load: [3, 4], owner: [5, 6], run: 7 };
      fr.push({ ...base, line: 0, vars: { request: `${m} /orders/${cs.id}` }, note: `The request: <code>${m} /orders/${cs.id}</code>${t ? " with a bearer token" : " with <b>no</b> token"}. Gates run cheapest and most general first. Each one can stop the request, and <i>which</i> gate stops it decides the status code.` });
      const state = {};
      steps.forEach(([g, ok, why]) => {
        state[g] = "active";
        fr.push({ ...base, state: { ...state }, why: { g, text: why }, line: LINE[g], vars: { gate: g }, note: `Checking <b>${GATES.find((x) => x[0] === g)[1]}</b>: ${GATES.find((x) => x[0] === g)[2].replace("{id}", cs.id)}.` });
        state[g] = ok ? "done" : "bad";
        fr.push({ ...base, state: { ...state }, why: { g, text: why }, line: LINE[g], vars: { gate: g, passed: ok }, note: ok ? `Passed: ${esc(why)}.` : `<b>Rejected</b>: ${esc(why)}.` });
      });
      fr.push({ ...base, state: { ...state }, out, line: out.code >= 400 ? LINE[steps[steps.length - 1][0]] : 7, vars: { status: out.code }, note: `<b>${out.text}</b>. ${out.why}` });
      return fr;
    },
    render: (f) => {
      const gates = GATES.map(([id, name, desc]) => {
        const st = f.state[id] || "", why = f.why && f.why.g === id ? f.why.text : st === "done" ? "passed" : "";
        return `<div class="as-gate ${st}"><b>${esc(name)}</b><span>${esc(desc.replace("{id}", ""))}</span>${why ? `<em>${esc(why)}</em>` : ""}</div>`;
      }).join('<div class="as-gate-ar">↓</div>');
      const out = f.out ? `<div class="as-resp ${f.out.code >= 400 ? "bad" : "done"}"><b>${esc(f.out.text)}</b>${f.out.hdr ? `<code>${esc(f.out.hdr)}</code>` : ""}</div>` : "";
      return `<div class="as-row"><div class="as-col">${kv(f.req, f.claims, { empty: "no token" })}</div><div class="as-col as-gates">${gates}${out}</div></div>`;
    },
  }));

  /* =====================================================================
   * 2. OAuth 2.0 / OIDC flows as sequence diagrams
   * ===================================================================== */
  const FLOWS = {
    "Authorization code + PKCE (user signs in)": {
      lanes: [{ id: "u", label: "Browser", sub: "user" }, { id: "c", label: "Client app", sub: "web / SPA / mobile" }, { id: "as", label: "Auth server", sub: "Entra ID, Auth0, Keycloak" }, { id: "api", label: "Orders API", sub: "resource server" }],
      steps: [
        [{ from: "u", to: "c", label: "click “Sign in”" }, 0, "The user wants the app to read their orders. The app must never see the user's password, so it sends the user to the authorization server."],
        [{ from: "c", to: "c", label: "verifier = random(43..128); challenge = S256(verifier)", cls: "info" }, 0, "The app creates a one-time secret, the <b>code_verifier</b>, and keeps it. It sends only its hash, the <b>code_challenge</b>. It also makes a random <code>state</code> (CSRF protection for the redirect) and an OIDC <code>nonce</code>."],
        [{ from: "c", to: "u", label: "302 /authorize?code_challenge=…&state=…" }, 0, "A redirect to <code>/authorize</code> with <code>response_type=code</code>, <code>client_id</code>, <code>redirect_uri</code>, <code>scope=openid orders.read</code>, the challenge and <code>code_challenge_method=S256</code>."],
        [{ from: "u", to: "as", label: "GET /authorize?…" }, 0, "The browser goes to the authorization server. Everything in this URL is visible to the browser, extensions and history. That's why only the <i>hash</i> of the verifier travels here."],
        [{ from: "as", to: "as", label: "login + MFA + consent to orders.read", cls: "info" }, 0, "The user authenticates <i>at the authorization server</i> (passwords, MFA, passkeys never touch the app) and consents to the scopes."],
        [{ from: "as", to: "u", label: "302 redirect_uri?code=Splx…&state=…" }, 0, "The server redirects back with a short-lived, single-use <b>authorization code</b>. The code alone is not enough to get tokens."],
        [{ from: "u", to: "c", label: "GET /callback?code=…&state=…" }, 0, "The app checks that <code>state</code> matches what it stored. If it doesn't, someone is injecting their own code: stop."],
        [{ from: "c", to: "as", label: "POST /token code + code_verifier", cls: "path" }, 0, "The app redeems the code over a direct back-channel call, sending the <b>verifier</b>. A confidential client (server-side web app) also authenticates itself with a certificate or secret."],
        [{ from: "as", to: "as", label: "S256(verifier) == challenge? code unused?", cls: "info" }, 0, "The server hashes the verifier and compares it with the challenge it stored with the code. An attacker who stole the code doesn't have the verifier, so it can't redeem the code."],
        [{ from: "as", to: "c", label: "access_token + id_token + refresh_token", cls: "hit" }, 0, "The <b>access token</b> is for the API (<code>aud = api://orders</code>), short-lived. The <b>ID token</b> is for the app: it says who signed in. Never send the ID token to an API."],
        [{ from: "c", to: "api", label: "GET /orders  Authorization: Bearer eyJ…" }, 1, "The app calls the API with the access token in the <code>Authorization</code> header. Not in the URL: URLs end up in logs."],
        [{ from: "api", to: "api", label: "verify sig (JWKS) · iss · aud · exp · scp", cls: "info" }, 2, "The API validates the token offline against the authorization server's published keys. No call per request."],
        [{ from: "api", to: "c", label: "200 OK [orders]", cls: "hit" }, 3, "Authorized by the scope <code>orders.read</code>, which the user consented to, <i>and</i> by the user's own permissions."],
      ],
    },
    "Client credentials (service to service, no user)": {
      lanes: [{ id: "svc", label: "Billing job", sub: "daemon, no user" }, { id: "as", label: "Auth server" }, { id: "api", label: "Orders API" }],
      steps: [
        [{ from: "svc", to: "as", label: "POST /token grant_type=client_credentials" }, 0, "No user is involved. The service authenticates <b>as itself</b>: ideally with a certificate-signed <code>client_assertion</code> or a managed identity, not a shared secret. It asks for <code>scope=api://orders/.default</code>."],
        [{ from: "as", to: "as", label: "client authenticated; app roles granted by an admin", cls: "info" }, 0, "There's no consent screen. An administrator granted this app the application permission (app role) <code>Orders.Read.All</code> ahead of time."],
        [{ from: "as", to: "svc", label: "access_token {sub: app, roles: [Orders.Read.All]}", cls: "hit" }, 0, "The token has <code>roles</code>, and no <code>scp</code>: there is no user to have delegated anything. The subject is the app itself."],
        [{ from: "svc", to: "svc", label: "cache until ~5 min before exp", cls: "info" }, 0, "Cache the token and reuse it. Requesting a new token per call adds latency and gets you throttled by the authorization server."],
        [{ from: "svc", to: "api", label: "GET /orders?status=unbilled  Bearer eyJ…" }, 1, "The service calls the API with its own token."],
        [{ from: "api", to: "api", label: "app-only token → check roles, not scp", cls: "info" }, 3, "The API must handle both kinds of token. Delegated tokens carry <code>scp</code> (and the user's roles); app-only tokens carry <code>roles</code>. A policy that only checks <code>scp</code> rejects every daemon. A policy that only checks <code>roles</code> lets apps act as nobody in particular."],
        [{ from: "api", to: "svc", label: "200 OK [all tenants' unbilled orders]", cls: "hit" }, 3, "App permissions are usually broad (all users, all tenants of this API). That's why they need an administrator, and why they're dangerous to over-grant."],
      ],
    },
    "On-behalf-of / token exchange (API calls API as the user)": {
      lanes: [{ id: "c", label: "Client app" }, { id: "a", label: "Orders API", sub: "middle tier" }, { id: "as", label: "Auth server" }, { id: "b", label: "Payments API", sub: "downstream" }],
      steps: [
        [{ from: "c", to: "a", label: "POST /orders/42:pay  Bearer T1" }, 1, "T1 has <code>aud = api://orders</code> and <code>scp = orders.write</code>, for user Alice."],
        [{ from: "a", to: "a", label: "T1 valid; must charge Alice's card", cls: "info" }, 2, "The Orders API needs to call the Payments API <i>as Alice</i>, so Payments can apply Alice's limits and audit her."],
        [{ from: "a", to: "b", label: "✗ forward T1 as-is", cls: "miss", dash: true }, 1, "The tempting shortcut. Payments must reject it: T1's audience is Orders. If Payments accepted tokens meant for other APIs, any API that receives a token could replay it anywhere."],
        [{ from: "a", to: "as", label: "POST /token grant=jwt-bearer|token-exchange, T1", cls: "path" }, 0, "Exchange it instead: Entra's on-behalf-of flow (<code>grant_type=urn:ietf:params:oauth:grant-type:jwt-bearer</code>) or standard token exchange (RFC 8693, <code>subject_token=T1</code>). The Orders API authenticates as itself too."],
        [{ from: "as", to: "as", label: "T1 valid · Orders may call Payments · user consented", cls: "info" }, 0, "The authorization server checks the whole chain, not just the token."],
        [{ from: "as", to: "a", label: "T2 {aud: payments, sub: alice, scp: payments.charge}", cls: "hit" }, 0, "A new token for the downstream audience, still about Alice, narrowed to what Payments needs. RFC 8693 records the caller in an <code>act</code> (actor) claim."],
        [{ from: "a", to: "b", label: "POST /charges  Bearer T2" }, 1, "Each hop gets its own token with its own audience and the smallest scope that works."],
        [{ from: "b", to: "a", label: "201 Created", cls: "hit" }, 3, "Payments validated <code>aud = payments</code> and authorized Alice."],
        [{ from: "a", to: "c", label: "200 OK {paid: true}", cls: "hit" }, 3, "Cache T2 per user and scope until it expires; don't exchange on every request."],
      ],
    },
    "Refresh token rotation (reuse detection)": {
      lanes: [{ id: "c", label: "Client app" }, { id: "x", label: "Attacker", sub: "stole RT1 earlier", cls: "bad" }, { id: "as", label: "Auth server" }, { id: "api", label: "Orders API" }],
      steps: [
        [{ from: "c", to: "api", label: "GET /orders  Bearer AT1" }, 1, "Access tokens are short-lived (minutes to an hour) on purpose: they can't be revoked once issued, so their lifetime is the damage window."],
        [{ from: "api", to: "c", label: "401 error=\"invalid_token\" (expired)", cls: "miss" }, 2, "Expired. The client doesn't bother the user; it uses its refresh token."],
        [{ from: "c", to: "as", label: "POST /token grant_type=refresh_token RT1" }, 0, "Refresh tokens are long-lived and must be stored carefully (server-side, or in secure OS storage on devices)."],
        [{ from: "as", to: "c", label: "AT2 + RT2 (RT1 now spent)", cls: "hit" }, 0, "<b>Rotation</b>: each refresh returns a new refresh token and invalidates the old one. Required for public clients by the OAuth security BCP (RFC 9700) unless the token is sender-constrained."],
        [{ from: "x", to: "as", label: "POST /token refresh_token=RT1", cls: "miss" }, 0, "The attacker replays the refresh token they stole."],
        [{ from: "as", to: "as", label: "RT1 already used → revoke the whole family", cls: "miss" }, 0, "Reuse of a spent refresh token means two parties hold it. The server can't tell which is legitimate, so it revokes every token descended from the original grant."],
        [{ from: "as", to: "x", label: "400 invalid_grant", cls: "miss" }, 0, "The attacker gets nothing."],
        [{ from: "c", to: "as", label: "POST /token refresh_token=RT2" }, 0, "Later, the legitimate client tries to refresh too."],
        [{ from: "as", to: "c", label: "400 invalid_grant → sign in again", cls: "miss" }, 0, "The real user signs in again: a small cost to contain a stolen token. Without rotation, the attacker could have refreshed silently for months."],
      ],
    },
  };
  Viz.register("api-security-flows", (el) => Viz.player(el, {
    title: "OAuth 2.0 and OpenID Connect flows, one message at a time",
    legend: [["path", "secret proof sent"], ["done", "tokens or data returned"], ["bad", "rejected / attack"], ["visit", "local check"]],
    codeLang: "python",
    code: [
      "token = authorization_server.issue(grant)   # who is asking, for whom, for what",
      "resp  = api.call(Authorization=f'Bearer {token}')",
      "api.validate(token)        # signature (JWKS), iss, aud, exp/nbf",
      "api.authorize(token, op)   # scp for delegated, roles for app-only, + resource",
    ],
    inputs: [{ key: "f", label: "flow", type: "select", options: Object.keys(FLOWS), value: Object.keys(FLOWS)[0] }],
    random: () => ({ f: pick(Object.keys(FLOWS)) }),
    build: ({ f }) => {
      const fl = FLOWS[f]; if (!fl) throw new Error("Pick a flow from the list.");
      const fr = [{ lanes: fl.lanes, msgs: [], line: 0, vars: { step: 0 }, note: `<b>${esc(f)}</b>. Press play or step through the messages.` }];
      fl.steps.forEach(([m, line, note], i) => fr.push({ lanes: fl.lanes, msgs: fl.steps.slice(0, i + 1).map((s) => s[0]), line, vars: { step: `${i + 1} / ${fl.steps.length}` }, note }));
      return fr;
    },
    render: (f) => `<div class="as-col"><div class="as-fit">${seq(f.lanes, f.msgs, { width: f.lanes.length === 3 ? 560 : 640, max: 13, label: "OAuth flow sequence" })}</div></div>`,
  }));

  /* =====================================================================
   * 3. PKCE with real SHA-256
   * ===================================================================== */
  const PKCE_ATTACK = ["Attacker intercepts the code", "Attacker sees the /authorize URL and intercepts the code", "No attack"];
  const randVerifier = () => { const b = new Uint8Array(32); for (let i = 0; i < 32; i++) b[i] = Math.floor(Math.random() * 256); return b64u(b); };
  Viz.register("api-security-pkce", (el) => Viz.player(el, {
    title: "PKCE: a stolen authorization code is useless without the verifier",
    legend: [["path", "secret (never leaves the client)"], ["visit", "public, visible in the browser"], ["done", "match"], ["bad", "mismatch / attack succeeds"]],
    codeLang: "python",
    code: [
      "verifier  = base64url(os.urandom(32))                 # 43 chars, kept by the client",
      "challenge = base64url(sha256(verifier.encode()))      # S256",
      "redirect(f'/authorize?...&code_challenge={challenge}&code_challenge_method=S256')",
      "# auth server stores (code -> challenge, method), redirects back with ?code=...",
      "POST /token  code=..., code_verifier=verifier         # back channel",
      "ok = base64url(sha256(code_verifier)) == stored_challenge   # at the auth server",
    ],
    inputs: [
      { key: "m", label: "method", type: "select", options: ["S256", "plain", "no PKCE"], value: "S256" },
      { key: "a", label: "attack", type: "select", options: PKCE_ATTACK, value: PKCE_ATTACK[1] },
      { key: "v", label: "code_verifier", value: "dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", width: 430 },
    ],
    random: () => ({ m: pick(["S256", "plain", "no PKCE"]), a: pick(PKCE_ATTACK), v: randVerifier() }),
    build: ({ m, a, v }) => {
      v = String(v ?? "").trim();
      if (!["S256", "plain", "no PKCE"].includes(m)) throw new Error("Pick a method.");
      if (!PKCE_ATTACK.includes(a)) throw new Error("Pick an attack.");
      if (m !== "no PKCE" && !/^[A-Za-z0-9._~-]{43,128}$/.test(v)) throw new Error("A code_verifier is 43 to 128 characters from A-Z a-z 0-9 - . _ ~ (RFC 7636 §4.1).");
      const digest = sha256(utf8(v)), ch = m === "S256" ? b64u(digest) : m === "plain" ? v : "";
      const steal = a !== "No attack", sawUrl = a.startsWith("Attacker sees");
      const st = { m, v, ch, digest: m === "S256" ? hex(digest) : "", url: "", code: "", attacker: [], server: [], result: null, legit: null };
      const fr = [], push = (line, note, extra = {}) => fr.push({ ...clone(st), cmp: null, ...extra, line, note });
      if (m === "no PKCE") push(0, "No PKCE: the client creates no verifier. Whoever presents the authorization code (and the public <code>client_id</code>) gets the tokens.");
      else push(0, `The client creates a random <b>code_verifier</b> (${v.length} chars) and keeps it in memory. It never goes through the browser's address bar.`);
      if (m === "S256") push(1, `It hashes it: SHA-256 gives <code>${hex(digest).slice(0, 16)}…</code> (32 bytes), base64url-encoded to the <b>code_challenge</b> <code>${esc(ch)}</code>. SHA-256 is one-way: you can't get the verifier back from it.`);
      if (m === "plain") push(1, "With <code>plain</code> the challenge <i>is</i> the verifier. RFC 7636 allows it only for clients that can't compute SHA-256, which today is none of them.");
      st.url = `/authorize?response_type=code&client_id=spa-123&scope=orders.read${m === "no PKCE" ? "" : `&code_challenge=${ch}&code_challenge_method=${m}`}&state=af0ifjsldkj`;
      push(2, `The redirect URL travels through the browser.${m === "no PKCE" ? "" : " The challenge is public now: browser history, extensions, proxies and logs can see it."}`);
      if (sawUrl && m !== "no PKCE") { st.attacker.push(["code_challenge", ch, "visit"]); push(2, "The attacker reads the URL (a malicious browser extension, a shared log, a proxy). It now has the challenge."); }
      st.code = "Splx" + hex(sha256(utf8("code" + v + m))).slice(0, 10);
      st.server.push(["code", st.code]);
      if (m !== "no PKCE") st.server.push(["challenge", ch], ["method", m]);
      push(3, `The user signs in. The auth server issues code <code>${st.code}</code>${m === "no PKCE" ? "" : " and stores the challenge with it"}, then redirects to the app's redirect URI.`);
      const tryRedeem = (verifier) => {
        if (m === "no PKCE") return { ok: true, why: "no PKCE, so the code alone is enough" };
        if (!verifier) return { ok: false, why: "no code_verifier was sent" };
        const calc = m === "S256" ? b64u(sha256(utf8(verifier))) : verifier;
        return calc === ch ? { ok: true, calc, why: `${m === "S256" ? "the SHA-256 of the verifier" : "the verifier"} equals the stored challenge` } : { ok: false, calc, why: `${m === "S256" ? "the SHA-256 of what was sent" : "what was sent"} ≠ the stored challenge` };
      };
      if (steal) {
        st.attacker.push(["code", st.code, "visit"]);
        push(3, "The attacker intercepts the redirect: another app registered the same custom URI scheme on the phone, or the code leaked through a Referer header or a log.");
        const guess = sawUrl && m !== "no PKCE" ? ch : "";
        const r = tryRedeem(guess);
        st.attacker.push(["sends verifier", guess || "(none: doesn't know it)", guess ? "visit" : ""]);
        st.result = r.ok ? "bad" : "done";
        push(4, r.ok
          ? `<b>The attack works.</b> The attacker redeems the code first: ${r.why}. It now holds Alice's tokens.${m === "plain" ? " With <code>plain</code>, seeing the URL was enough." : ""}`
          : `<b>Rejected</b> (<code>invalid_grant</code>): ${r.why}. ${guess ? "Sending the challenge as the verifier doesn't work: the server hashes it again, and nobody can reverse SHA-256." : "Without the verifier the stolen code is worthless."}`, { cmp: r.calc !== undefined ? { calc: r.calc, ok: r.ok } : null });
        st.server = st.server.filter((x) => x[0] !== "code state").concat([["code state", r.ok ? "redeemed by attacker" : "still unused"]]);
        if (r.ok) {
          st.legit = "bad";
          push(4, "The real app now tries to redeem the same code. Codes are single-use, so it fails, and the server should revoke the tokens already issued for that code. Too late if the attacker has used them.");
          return fr;
        }
      }
      const r2 = tryRedeem(m === "no PKCE" ? "" : v);
      st.legit = r2.ok ? "done" : "bad";
      st.server = st.server.filter((x) => x[0] !== "code state").concat([["code state", "redeemed by the client"]]);
      push(5, `The real app redeems the code with its verifier: ${r2.why}. It gets the tokens.${m === "no PKCE" && !steal ? " It worked this time, but only because nobody stole the code." : ""}`, { cmp: r2.calc !== undefined ? { calc: r2.calc, ok: r2.ok } : null });
      return fr;
    },
    render: (f) => {
      const client = kv("Client app (secret)", f.m === "no PKCE" ? [] : [["code_verifier", f.v, "path"]].concat(f.digest ? [["sha256 (hex)", f.digest.slice(0, 32) + "…"]] : []), { empty: "no verifier" });
      const url = `<div class="as-url ${f.url ? "" : "empty"}"><div class="as-kv-h">Front channel (browser address bar)</div><code>${f.url ? esc(f.url).replace(/(code_challenge=)([^&]+)/, "$1<mark>$2</mark>") : "not sent yet"}</code></div>`;
      const server = kv("Authorization server", f.server, { empty: "nothing stored yet" });
      const atk = kv("Attacker knows", f.attacker, { empty: "nothing", cls: "atk" });
      const cmp = f.cmp ? `<div class="as-cmp ${f.cmp.ok ? "done" : "bad"}"><div><span>stored challenge</span><code>${esc(f.ch)}</code></div><div><span>${f.m === "S256" ? "base64url(sha256(sent))" : "sent verifier"}</span><code>${esc(f.cmp.calc)}</code></div><b>${f.cmp.ok ? "match → tokens issued" : "mismatch → invalid_grant"}</b></div>` : "";
      const res = f.result || f.legit ? stats([["attacker", f.result ? (f.result === "bad" ? "got tokens" : "rejected") : "no attempt", f.result || ""], ["real app", f.legit ? (f.legit === "done" ? "got tokens" : "invalid_grant") : "waiting", f.legit || ""]]) : "";
      return `${url}${panels(client, server, atk)}${cmp}${res}`;
    },
  }));

  /* =====================================================================
   * 4. JWT: build real tokens and validate them step by step
   * ===================================================================== */
  const NOW = 1800000000, ISS = "https://login.example.com/contoso/v2.0", AUD = "api://orders";
  const baseClaims = () => ({ iss: ISS, aud: AUD, sub: "alice", tid: "contoso", scp: "orders.read orders.write", iat: NOW - 300, nbf: NOW - 300, exp: NOW + 3300 });
  const RSH = { alg: "RS256", typ: "JWT", kid: "rsa-2026" };
  const signRS = (h, p) => { const si = `${b64uJson(h)}.${b64uJson(p)}`; return `${si}.${b64u(rs256Sign(utf8(si)))}`; };
  const pubBytes = () => utf8(J(rsaKey().jwk));
  const EVIL = { sub: "mallory", scp: "orders.read orders.write admin" };
  const JWT_CASES = {
    "Valid token": () => signRS(RSH, baseClaims()),
    "Payload edited: scp += admin": () => { const t = signRS(RSH, { ...baseClaims(), scp: "orders.read" }).split("."); t[1] = b64uJson({ ...baseClaims(), scp: "orders.read orders.write admin" }); return t.join("."); },
    "alg: none, signature removed": () => `${b64uJson({ alg: "none", typ: "JWT" })}.${b64uJson({ ...baseClaims(), ...EVIL })}.`,
    "alg: HS256 keyed with the public key": () => { const si = `${b64uJson({ alg: "HS256", typ: "JWT", kid: "rsa-2026" })}.${b64uJson({ ...baseClaims(), ...EVIL })}`; return `${si}.${b64u(hmac256(pubBytes(), utf8(si)))}`; },
    "Expired 90 s ago": () => signRS(RSH, { ...baseClaims(), iat: NOW - 3690, nbf: NOW - 3690, exp: NOW - 90 }),
    "nbf 30 s in the future (issuer clock ahead)": () => signRS(RSH, { ...baseClaims(), iat: NOW + 30, nbf: NOW + 30, exp: NOW + 3630 }),
    "Audience is another API": () => signRS(RSH, { ...baseClaims(), aud: "https://graph.example.com" }),
    "Another tenant's issuer (shared signing key)": () => signRS(RSH, { ...baseClaims(), iss: "https://login.example.com/fabrikam/v2.0", tid: "fabrikam", sub: "mallory" }),
    "Valid, but scp = orders.read only": () => signRS(RSH, { ...baseClaims(), scp: "orders.read" }),
  };
  const VALIDATORS = ["Strict (allow-list, iss, aud, lifetime, scope)", "Trusts the header's alg, checks exp", "Decodes without verifying"];
  const ago = (t) => { const d = t - NOW; return d === 0 ? "now" : d > 0 ? `now + ${d} s` : `now − ${-d} s`; };
  const dec = (s) => JSON.parse(new TextDecoder().decode(unb64u(s)));
  function jwtValidate(token, mode, skew) {
    const steps = [], add = (name, ok, detail, line) => { steps.push({ name, ok, detail, line }); return ok !== false; };
    const parts = token.split("."), h = dec(parts[0]), p = dec(parts[1]);
    const out = (status) => ({ steps, h, p, status });
    add("decode", true, `alg = ${h.alg}, ${parts[2] ? `${unb64u(parts[2]).length}-byte signature` : "empty signature"}`, 0);
    const si = utf8(`${parts[0]}.${parts[1]}`), sig = parts[2] ? unb64u(parts[2]) : new Uint8Array(0);
    if (mode === 2) add("signature", null, "skipped: the token was only decoded", 1);
    else if (mode === 1) {
      let ok;
      if (h.alg === "none") ok = add("signature", null, "alg is none, so there is nothing to verify (!)", 1);
      else if (h.alg === "HS256") { ok = eqBytes(hmac256(pubBytes(), si), sig); add("signature", ok ? "warn" : false, ok ? "HMAC-SHA256 keyed with our public key matches (!)" : "HMAC mismatch", 1); }
      else { ok = rs256Verify(si, sig); add("signature", ok, ok ? "RSA signature valid" : "RSA signature does not match the content", 1); }
      if (!ok) return out(401);
    } else {
      if (!add("alg allow-list", h.alg === "RS256", h.alg === "RS256" ? "RS256 is the only algorithm we accept" : `${h.alg} is not in [RS256]`, 1)) return out(401);
      if (!add("kid in JWKS", h.kid === rsaKey().jwk.kid, `${h.kid} found in the issuer's JWKS`, 1)) return out(401);
      const ok = rs256Verify(si, sig);
      if (!add("signature", ok, ok ? "RSA signature valid over header.payload" : "RSA signature doesn't match the content", 1)) return out(401);
      if (!add("iss", p.iss === ISS, p.iss === ISS ? "our tenant's issuer" : `${p.iss} ≠ expected ${ISS}`, 2)) return out(401);
      const aOk = [].concat(p.aud).includes(AUD);
      if (!add("aud", aOk, aOk ? `${AUD} (this API)` : `${p.aud} is not this API`, 2)) return out(401);
    }
    const sk = mode === 0 ? skew : 0, expOk = NOW < p.exp + sk;
    if (!add("exp", expOk, `exp = ${ago(p.exp)}${sk ? `, skew ${sk} s` : ""} → ${expOk ? "still valid" : "expired"}`, 3)) return out(401);
    if (mode !== 0) return out(200);
    const nOk = NOW >= p.nbf - sk;
    if (!add("nbf", nOk, `nbf = ${ago(p.nbf)}${sk ? `, skew ${sk} s` : ""} → ${nOk ? "valid" : "not valid yet"}`, 3)) return out(401);
    const sOk = String(p.scp || "").split(" ").includes("orders.write");
    if (!add("scope", sOk, sOk ? "orders.write present" : "PATCH needs orders.write", 4)) return out(403);
    return out(200);
  }
  Viz.register("api-security-jwt", (el) => Viz.player(el, {
    title: "JWT validation, with real signatures (RS256, HS256, none)",
    legend: [["active", "check running"], ["done", "passed"], ["bad", "failed"], ["warn", "skipped or dangerous pass"]],
    codeLang: "python",
    code: [
      "header, payload, sig = token.split('.')            # anyone can decode these",
      "claims = jwt.decode(token, key, algorithms=['RS256'],   # never from the header",
      "                    issuer=ISSUER, audience='api://orders',",
      "                    leeway=60, options={'require': ['exp', 'iss', 'aud']})",
      "if 'orders.write' not in claims['scp'].split(): return 403",
    ],
    inputs: [
      { key: "c", label: "token", type: "select", options: Object.keys(JWT_CASES), value: "alg: HS256 keyed with the public key" },
      { key: "v", label: "validator", type: "select", options: VALIDATORS, value: VALIDATORS[1] },
      { key: "s", label: "clock skew", type: "select", options: ["0 s", "60 s", "300 s"], value: "60 s" },
    ],
    random: () => ({ c: pick(Object.keys(JWT_CASES)), v: pick(VALIDATORS), s: pick(["0 s", "60 s", "300 s"]) }),
    build: ({ c, v, s }) => {
      const mk = JWT_CASES[c]; if (!mk) throw new Error("Pick a token.");
      const mode = VALIDATORS.indexOf(v); if (mode < 0) throw new Error("Pick a validator.");
      const skew = { "0 s": 0, "60 s": 60, "300 s": 300 }[s]; if (skew === undefined) throw new Error("Pick a clock skew.");
      const token = mk(), r = jwtValidate(token, mode, skew), fr = [];
      const P = r.p, evil = P.sub === "mallory" || /admin/.test(P.scp) || P.aud !== AUD || P.iss !== ISS || P.exp <= NOW || !P.scp.split(" ").includes("orders.write");
      const base = { token, h: r.h, p: P, status: 0, evil: false };
      fr.push({ ...base, checks: [], line: 0, vars: { request: "PATCH /orders/42" }, note: "<code>PATCH /orders/42</code> arrives with this bearer token. A JWT is <b>three base64url parts</b>: header, payload, signature. Anyone can decode the first two; they are signed, not encrypted. Only a verified signature makes them trustworthy." });
      r.steps.forEach((st, i) => {
        const done = r.steps.slice(0, i);
        fr.push({ ...base, checks: [...done, { ...st, ok: "run" }], line: st.line, vars: { check: st.name }, note: `Checking <b>${esc(st.name)}</b>…` });
        fr.push({ ...base, checks: [...done, st], line: st.line, vars: { check: st.name, result: st.ok === true ? "pass" : st.ok === false ? "fail" : st.ok === null ? "skipped" : "pass (!)" }, note: `${st.ok === false ? "<b>Failed</b>" : st.ok === null ? "<b>Not checked</b>" : "Passed"}: ${esc(st.detail)}.` });
      });
      const code = r.status, bad = code === 200 && evil;
      const why = !bad ? "" : mode === 2 ? "Decoding is not validating: anyone can write any payload." : mode === 1 && r.h.alg !== "RS256" ? "Letting the token pick its own algorithm lets the attacker pick how it's checked." : mode === 1 ? "The signature is genuine, but nobody checked who issued it, who it's for, or what it allows." : "The skew allowance accepted a token just outside its lifetime. That's the trade-off: keep skew small (60 s is typical, 5 min at most).";
      const msg = code === 200 ? (bad ? `<b>200: accepted, and it shouldn't have been.</b> ${why}` : "<b>200</b>: every check passed. The handler can now trust <code>sub</code>, <code>tid</code> and <code>scp</code>.")
        : r.steps[r.steps.length - 1].name === "nbf" ? "<b>401</b>, but this token is genuine: the issuer's clock is 30 s ahead of ours. That false rejection is exactly what a small clock-skew allowance is for."
        : code === 403 ? "<b>403 Forbidden</b> with <code>WWW-Authenticate: Bearer error=\"insufficient_scope\"</code>: the token is genuine, it just doesn't allow this operation."
          : "<b>401 Unauthorized</b> with <code>WWW-Authenticate: Bearer error=\"invalid_token\"</code>. Log the exact reason; tell the caller little.";
      fr.push({ ...base, checks: r.steps, status: code, evil: bad, line: code === 403 ? 4 : r.steps[r.steps.length - 1].line, vars: { status: code }, note: msg });
      return fr;
    },
    render: (f) => {
      const [a, b, c] = f.token.split(".");
      const tok = `<div class="as-jwt"><span class="h">${esc(a)}</span>.<span class="p">${esc(b)}</span>.<span class="s">${c ? esc(c) : "(empty)"}</span></div>`;
      const fmt = (o) => esc(JSON.stringify(o, null, 1)).replace(/\n\s*/g, " ");
      const decoded = `<div class="as-panels"><div class="as-kv"><div class="as-kv-h h">header</div><pre class="as-json">${fmt(f.h)}</pre></div><div class="as-kv"><div class="as-kv-h p">payload (now = ${NOW})</div><pre class="as-json">${fmt(f.p)}</pre></div></div>`;
      const cls = (s) => (s.ok === "run" ? "active" : s.ok === true ? "done" : s.ok === false ? "bad" : "warn");
      const checks = `<div class="as-checks">${f.checks.length ? f.checks.map((s) => `<div class="${cls(s)}"><b>${esc(s.name)}</b><span>${s.ok === "run" ? "…" : esc(s.detail)}</span></div>`).join("") : '<div class="empty"><b>checks</b><span>not started</span></div>'}</div>`;
      const res = f.status ? `<div class="as-resp ${f.status === 200 && !f.evil ? "done" : "bad"}"><b>${f.status === 200 ? (f.evil ? "200 OK (the attacker wins)" : "200 OK") : f.status === 403 ? "403 Forbidden" : "401 Unauthorized"}</b></div>` : "";
      return `${tok}${decoded}${checks}${res}`;
    },
  }));

  /* =====================================================================
   * 5. Authorization: which checks does your policy actually run?
   * ===================================================================== */
  const AZ_REQ = [
    { who: "Alice", tid: "contoso", roles: [], app: "Orders web", scp: ["orders.read", "orders.write"], op: "PATCH", order: "A1 (Alice, contoso)", why: "Owner editing her own order" },
    { who: "Bob", tid: "contoso", roles: ["Orders.Reader"], app: "Orders web", scp: ["orders.read", "orders.write"], op: "PATCH", order: "A1 (Alice, contoso)", why: "The app may write, but Bob is only a reader" },
    { who: "Bob", tid: "contoso", roles: ["Orders.Reader"], app: "Orders web", scp: ["orders.read", "orders.write"], op: "GET", order: "A1 (Alice, contoso)", why: "Readers may read every order in their tenant" },
    { who: "Carol", tid: "contoso", roles: ["Orders.Manager"], app: "Reporting", scp: ["orders.read"], op: "PATCH", order: "A1 (Alice, contoso)", why: "Carol may write, but she only consented to a read-only app" },
    { who: "Carol", tid: "contoso", roles: ["Orders.Manager"], app: "Orders web", scp: ["orders.read", "orders.write"], op: "PATCH", order: "A1 (Alice, contoso)", why: "Manager, via an app with write scope" },
    { who: "Mallory", tid: "fabrikam", roles: ["Orders.Manager"], app: "Orders web", scp: ["orders.read", "orders.write"], op: "PATCH", order: "A1 (Alice, contoso)", why: "A manager, but of another tenant" },
    { who: "Billing job", tid: "contoso", appOnly: true, roles: ["Orders.Read.All"], app: "(app-only)", scp: [], op: "GET", order: "A1 (Alice, contoso)", why: "Daemon with an admin-granted read role" },
    { who: "Billing job", tid: "contoso", appOnly: true, roles: ["Orders.Read.All"], app: "(app-only)", scp: [], op: "PATCH", order: "A1 (Alice, contoso)", why: "Read-only app role can't write" },
  ];
  const AZ_POL = { "Scope only": ["scope"], "User permission only": ["perm"], "Scope + user permission": ["scope", "perm"], "Scope + permission + tenant (resource-based)": ["scope", "perm", "tenant"] };
  function azCheck(r) {
    const need = r.op === "GET" ? "read" : "write", owner = r.who === "Alice";
    const scope = r.appOnly ? r.roles.some((x) => x === "Orders.ReadWrite.All" || (need === "read" && x === "Orders.Read.All")) : r.scp.includes(`orders.${need}`);
    const perm = r.appOnly ? scope : owner || r.roles.includes("Orders.Manager") || (need === "read" && r.roles.includes("Orders.Reader"));
    const tenant = r.tid === "contoso";
    return { scope, perm, tenant, truth: scope && perm && tenant };
  }
  Viz.register("api-security-authz", (el) => Viz.player(el, {
    title: "Scopes, roles and resources: three different questions",
    legend: [["done", "allowed, correctly"], ["bad", "allowed, but shouldn't be (a hole)"], ["visit", "denied, correctly"], ["dim", "check not run by this policy"]],
    codeLang: "python",
    code: [
      "def authorize(token, op, order):",
      "    scope  = needs_scope(op) in token.scp      # what the APP may do for the user",
      "    perm   = user_may(token.sub, token.roles, op, order)   # what the USER may do",
      "    tenant = order.tenant_id == token.tid      # is it even theirs to see?",
      "    return scope and perm and tenant           # delegated access = intersection",
    ],
    inputs: [{ key: "p", label: "policy", type: "select", options: Object.keys(AZ_POL), value: "Scope only" }],
    random: () => ({ p: pick(Object.keys(AZ_POL)) }),
    build: ({ p }) => {
      const pol = AZ_POL[p]; if (!pol) throw new Error("Pick a policy.");
      const rows = [], fr = [], tally = { ok: 0, hole: 0 };
      fr.push({ rows: [], pol, tally: { ...tally }, line: 0, vars: { policy: p }, note: `Policy <b>${esc(p)}</b>. Eight real requests follow. For each one we run the checks this policy includes and compare with the right answer (all three checks).` });
      AZ_REQ.forEach((r, i) => {
        const c = azCheck(r), dec = pol.every((k) => c[k]);
        const outcome = dec === c.truth ? (dec ? "done" : "visit") : dec ? "bad" : "warn";
        if (outcome === "bad") tally.hole++; else tally.ok++;
        rows.push({ ...r, ...c, dec, outcome });
        const missed = ["scope", "perm", "tenant"].filter((k) => !c[k] && !pol.includes(k));
        const label = { scope: "scope", perm: "user permission", tenant: "tenant" };
        fr.push({ rows: clone(rows), pol, tally: { ...tally }, cur: i, line: dec === c.truth ? 4 : 1 + ["scope", "perm", "tenant"].indexOf(missed[0]), vars: { request: i + 1, allowed: dec, correct: c.truth },
          note: `<b>${esc(r.who)}</b> ${r.op} ${esc(r.order)} via ${esc(r.app)}. ${esc(r.why)}. ${dec === c.truth ? (dec ? "Allowed, correctly." : "Denied, correctly.") : `<b>Allowed, but it shouldn't be</b>: the ${missed.map((k) => label[k]).join(" and ")} check would have said no, and this policy doesn't run it.`}` });
      });
      fr.push({ rows: clone(rows), pol, tally: { ...tally }, line: 4, vars: { holes: tally.hole }, note: tally.hole ? `<b>${tally.hole} hole${tally.hole > 1 ? "s" : ""}</b>. ${pol.length === 1 && pol[0] === "scope" ? "A scope says what the user let the <i>app</i> do, not what the <i>user</i> may do." : pol.length === 1 ? "Roles alone ignore what the user consented to: a read-only app becomes a confused deputy." : "Scope and role both passed, but nobody checked whose order it was."}` : "<b>No holes.</b> Delegated access is the <i>intersection</i> of what the app was granted and what the user may do, applied to <i>this</i> resource." });
      return fr;
    },
    render: (f) => {
      const yes = (v, k) => (f.pol.includes(k) ? `<td class="${v ? "done" : "bad"}">${v ? "✓" : "✗"}</td>` : `<td class="dim">${v ? "✓" : "✗"}</td>`);
      const head = "<tr><th>caller</th><th>via (scp / roles)</th><th>op</th><th>scope</th><th>user</th><th>tenant</th><th>policy</th><th>truth</th></tr>";
      const body = f.rows.map((r, i) => `<tr class="${i === f.cur ? "cur" : ""}"><td>${esc(r.who)}<small>${esc(r.tid)}${r.roles.length ? " · " + esc(r.roles.join(",")) : ""}</small></td><td>${esc(r.app)}<small>${esc(r.appOnly ? "roles: " + r.roles.join(" ") : r.scp.join(" "))}</small></td><td>${r.op}</td>${yes(r.scope, "scope")}${yes(r.perm, "perm")}${yes(r.tenant, "tenant")}<td class="${r.outcome}">${r.dec ? "allow" : "deny"}</td><td>${r.truth ? "allow" : "deny"}</td></tr>`).join("");
      return `<div class="as-scroll"><table class="as-table">${head}${body || '<tr><td colspan="8" class="dim">no requests yet</td></tr>'}</table></div>${stats([["requests", f.rows.length], ["correct", f.tally.ok, "done"], ["holes", f.tally.hole, f.tally.hole ? "bad" : ""]])}`;
    },
  }));

  /* =====================================================================
   * 6. BOLA / IDOR: an attacker enumerates object ids
   * ===================================================================== */
  const rng = (seed) => () => { seed = (seed * 1103515245 + 12345) % 2147483648; return seed / 2147483648; };
  Viz.register("api-security-bola", (el) => Viz.player(el, {
    title: "BOLA: GET /orders/{id} for ids that aren't yours",
    legend: [["done", "your own order"], ["bad", "someone else's data leaked"], ["warn", "403: confirms it exists"], ["dim", "404: learned nothing"]],
    codeLang: "python",
    code: [
      "@app.get('/orders/{id}')",
      "def get_order(id, user = Depends(current_user)):",
      "    order = db.get(id)",
      "    if order is None: raise HTTPException(404)",
      "    if order.owner_id != user.id:              # the line that's often missing",
      "        raise HTTPException(404)               # or 403, which confirms existence",
      "    return order",
    ],
    inputs: [
      { key: "ids", label: "id scheme", type: "select", options: ["sequential integers", "random UUIDs (one leaked in a shared link)"], value: "sequential integers" },
      { key: "chk", label: "ownership check", type: "select", options: ["none (any signed-in user)", "yes, answers 403", "yes, answers 404"], value: "none (any signed-in user)" },
      { key: "n", label: "attempts", value: "16", width: 60 },
    ],
    random: () => ({ ids: pick(["sequential integers", "random UUIDs (one leaked in a shared link)"]), chk: pick(["none (any signed-in user)", "yes, answers 403", "yes, answers 404"]), n: String(6 + Math.floor(Math.random() * 20)) }),
    build: ({ ids, chk, n }) => {
      const N = int(n, "attempts", 1, 30);
      const seq = ids === "sequential integers"; if (!seq && !ids.startsWith("random")) throw new Error("Pick an id scheme.");
      const mode = ["none (any signed-in user)", "yes, answers 403", "yes, answers 404"].indexOf(chk); if (mode < 0) throw new Error("Pick a check.");
      const r = rng(7), owners = ["alice", "bob", "carol", "dave", "erin"], db = new Map(), uuid = () => "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, (c) => { const v = Math.floor(r() * 16); return (c === "x" ? v : (v & 3) | 8).toString(16); });
      const list = [];
      for (let i = 0; i < 40; i++) { const id = seq ? String(1001 + i) : uuid(); const o = i === 16 || i === 31 ? "mallory" : owners[Math.floor(r() * 5)]; db.set(id, { id, owner: o, total: 10 + Math.floor(r() * 90) }); list.push(id); }
      const mine = list[16], leaked = list[23];
      const guesses = [];
      if (seq) { guesses.push(mine); for (let d = 1; guesses.length < N; d++) { guesses.push(String(+mine + d)); if (guesses.length < N && +mine - d > 1000) guesses.push(String(+mine - d)); } }
      else { guesses.push(mine); if (N > 1) guesses.push(leaked); while (guesses.length < N) guesses.push(uuid()); }
      const tries = [], s = { leak: 0, conf: 0, none: 0, own: 0 }, fr = [];
      fr.push({ tries: [], s: { ...s }, seq, line: 0, vars: { attacker: "mallory", "her order": mine }, note: `Mallory is a legitimate, signed-in customer. Her own order is <code>${mine}</code>. She'll request ${N} order ids ${seq ? "next to hers, counting up and down" : "including one UUID she saw in a shared link and random guesses"}.` });
      guesses.slice(0, N).forEach((id) => {
        const o = db.get(id); let status, cls, body;
        if (!o) { status = 404; cls = "dim"; s.none++; body = "not found"; }
        else if (o.owner === "mallory") { status = 200; cls = "done"; s.own++; body = J(o); }
        else if (mode === 0) { status = 200; cls = "bad"; s.leak++; body = J({ ...o, address: `${o.owner}'s home address` }); }
        else if (mode === 1) { status = 403; cls = "warn"; s.conf++; body = "forbidden"; }
        else { status = 404; cls = "dim"; s.none++; body = "not found"; }
        tries.push({ id, status, cls, body });
        const line = !o ? 3 : o.owner === "mallory" || mode === 0 ? 6 : 5;
        fr.push({ tries: tries.slice(), s: { ...s }, seq, line, vars: { id: seq ? id : id.slice(0, 8) + "…", status }, note: `<code>GET /orders/${esc(seq ? id : id.slice(0, 13) + "…")}</code> → <b>${status}</b>. ${cls === "bad" ? `Leaked ${esc(o.owner)}'s order. The token was valid; the API just never asked whether this order is <i>hers</i>.` : cls === "warn" ? "Blocked, but the 403 tells her the id is real." : cls === "done" ? "Her own order." : !o ? (seq ? "No such order." : "A random UUID guess: a 1 in 2<sup>122</sup> shot.") : "Exists, but the answer is the same as for a missing id. She learns nothing."}` });
      });
      fr.push({ tries, s: { ...s }, seq, line: mode ? 5 : 4, vars: { leaked: s.leak, confirmed: s.conf }, note: s.leak ? `<b>${s.leak} record${s.leak > 1 ? "s" : ""} leaked</b> with a perfectly valid token. ${seq ? "Sequential ids make enumeration trivial" : "Even unguessable UUIDs leak, because ids end up in links, logs and screenshots"}. The fix is the ownership check, not the id format.` : s.conf ? `Nothing leaked, but ${s.conf} id${s.conf > 1 ? "s" : ""} confirmed to exist. Fine within one tenant; across tenants prefer 404.` : "Nothing leaked and nothing confirmed. Unguessable ids are a nice extra layer, but the ownership check is what protects the data." });
      return fr;
    },
    render: (f) => {
      const grid = `<div class="as-ids">${f.tries.map((t) => `<div class="${t.cls}"><code>${esc(f.seq ? t.id : t.id.slice(0, 8))}</code><b>${t.status}</b></div>`).join("") || '<div class="dim"><code>none</code><b>·</b></div>'}</div>`;
      const last = f.tries[f.tries.length - 1];
      const resp = last ? `<div class="as-resp ${last.cls}"><b>${last.status}</b><code>${esc(last.body)}</code></div>` : "";
      return `${grid}${resp}${stats([["records leaked", f.s.leak, f.s.leak ? "bad" : ""], ["existence confirmed", f.s.conf, f.s.conf ? "warn" : ""], ["learned nothing", f.s.none], ["own orders", f.s.own, "done"]])}`;
    },
  }));

  /* =====================================================================
   * 7. CORS: what the browser enforces, and what it doesn't
   * ===================================================================== */
  const CORS_ORIGINS = ["https://app.contoso.com (on the allow-list)", "https://evil.example (not on it)"];
  const CORS_REQ = {
    "GET /me with cookies (simple)": { method: "GET", ct: "", auth: false, cred: true, effect: "" },
    "POST form-encoded /transfer with cookies (simple)": { method: "POST", ct: "application/x-www-form-urlencoded", auth: false, cred: true, effect: "transfer of €500 executed" },
    "PATCH JSON /orders/42 + Authorization: Bearer": { method: "PATCH", ct: "application/json", auth: true, cred: false, effect: "order 42 updated" },
  };
  const CORS_POL = ["Allow-list + credentials", "Reflect any Origin + credentials", "Allow-Origin: * (methods *, headers *)", "No CORS headers"];
  function corsHeaders(pol, origin, pre) {
    const allowed = origin.startsWith("https://app.contoso.com");
    const h = {};
    if (pol === 0 && allowed) Object.assign(h, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true", Vary: "Origin" }, pre ? { "Access-Control-Allow-Methods": "GET, POST, PATCH", "Access-Control-Allow-Headers": "Authorization, Content-Type", "Access-Control-Max-Age": "600" } : {});
    if (pol === 0 && !allowed) Object.assign(h, { Vary: "Origin" });
    if (pol === 1) Object.assign(h, { "Access-Control-Allow-Origin": origin, "Access-Control-Allow-Credentials": "true" }, pre ? { "Access-Control-Allow-Methods": "GET, POST, PATCH, DELETE", "Access-Control-Allow-Headers": "Authorization, Content-Type" } : {});
    if (pol === 2) Object.assign(h, { "Access-Control-Allow-Origin": "*" }, pre ? { "Access-Control-Allow-Methods": "*", "Access-Control-Allow-Headers": "*" } : {});
    return h;
  }
  function corsCheck(h, origin, cred) {
    const acao = h["Access-Control-Allow-Origin"];
    if (!acao) return "no Access-Control-Allow-Origin header";
    if (cred) {
      if (acao === "*") return "credentialed request, and * is not allowed with credentials";
      if (acao !== origin) return `Allow-Origin ${acao} ≠ ${origin}`;
      if (h["Access-Control-Allow-Credentials"] !== "true") return "Allow-Credentials: true is missing";
    } else if (acao !== "*" && acao !== origin) return `Allow-Origin ${acao} ≠ ${origin}`;
    return "";
  }
  Viz.register("api-security-cors", (el) => Viz.player(el, {
    title: "CORS: preflight, the actual request, and who gets to read the answer",
    legend: [["path", "preflight"], ["done", "allowed / readable"], ["bad", "blocked, or side effect ran anyway"], ["visit", "browser decision"]],
    codeLang: "javascript",
    code: [
      "// JavaScript running on the page's origin",
      "const res = await fetch('https://api.contoso.com/...', { method, headers, credentials });",
      "// browser: not simple? -> OPTIONS preflight first; denied -> request never sent",
      "// browser: sends the request (cookies if credentials: 'include')",
      "// server: runs the handler. CORS doesn't stop this",
      "// browser: Allow-Origin matches? -> JS reads res; otherwise TypeError: Failed to fetch",
    ],
    inputs: [
      { key: "o", label: "page origin", type: "select", options: CORS_ORIGINS, value: CORS_ORIGINS[1] },
      { key: "r", label: "request", type: "select", options: Object.keys(CORS_REQ), value: "POST form-encoded /transfer with cookies (simple)" },
      { key: "p", label: "server policy", type: "select", options: CORS_POL, value: CORS_POL[0] },
    ],
    random: () => ({ o: pick(CORS_ORIGINS), r: pick(Object.keys(CORS_REQ)), p: pick(CORS_POL) }),
    build: ({ o, r, p }) => {
      const req = CORS_REQ[r], pol = CORS_POL.indexOf(p); if (!req || pol < 0 || !CORS_ORIGINS.includes(o)) throw new Error("Pick an option from each list.");
      const origin = o.split(" ")[0], evil = origin.includes("evil");
      const lanes = [{ id: "js", label: "JavaScript", sub: origin.replace("https://", ""), cls: evil ? "bad" : "" }, { id: "br", label: "Browser", sub: "enforces CORS" }, { id: "api", label: "api.contoso.com" }];
      const msgs = [], fr = [], st = { reached: false, effect: false, read: null, hdr: {}, pre: null };
      const push = (line, note) => fr.push({ lanes, msgs: msgs.slice(), st: clone(st), line, note, vars: { origin: origin.replace("https://", "") } });
      const reqHeaders = { Origin: origin, ...(req.ct ? { "Content-Type": req.ct } : {}), ...(req.auth ? { Authorization: "Bearer eyJ…" } : {}), ...(req.cred ? { Cookie: "session=…" } : {}) };
      msgs.push({ from: "js", to: "br", label: `fetch ${req.method} ${req.cred ? "credentials: include" : ""}` });
      push(1, `${evil ? "A page on <b>evil.example</b>" : "The real front end"} calls <code>fetch</code>. ${req.cred ? "With <code>credentials: 'include'</code> the browser attaches the user's cookies for api.contoso.com (assuming <code>SameSite=None</code>; see CSRF below)." : "No cookies: the token travels in the Authorization header, which only code that already <i>has</i> the token can set."}`);
      const simple = ["GET", "HEAD", "POST"].includes(req.method) && (!req.ct || req.ct !== "application/json") && !req.auth;
      if (!simple) {
        msgs.push({ from: "br", to: "br", label: `not simple (${req.method !== "POST" && req.method !== "GET" ? req.method : ""}${req.ct === "application/json" ? " JSON" : ""}${req.auth ? " Authorization" : ""}) → preflight`, cls: "info" });
        push(2, `This request isn't "simple": ${[req.method === "PATCH" ? "PATCH is not GET/HEAD/POST" : "", req.ct === "application/json" ? "<code>Content-Type: application/json</code> isn't a form type" : "", req.auth ? "<code>Authorization</code> isn't a safelisted header" : ""].filter(Boolean).join("; ")}. The browser asks permission first.`);
        msgs.push({ from: "br", to: "api", label: `OPTIONS  Origin, Access-Control-Request-Method: ${req.method}`, cls: "path" });
        const h = corsHeaders(pol, origin, true);
        st.pre = h; push(2, `Preflight: <code>OPTIONS</code> with <code>Access-Control-Request-Method: ${req.method}</code> and <code>Access-Control-Request-Headers: ${req.auth ? "authorization, " : ""}content-type</code>. No cookies, no body. The handler doesn't run.`);
        let why = corsCheck(h, origin, req.cred);
        const m = h["Access-Control-Allow-Methods"] || "", hd = h["Access-Control-Allow-Headers"] || "";
        if (!why && !(m.split(/,\s*/).includes(req.method) || (m === "*" && !req.cred))) why = `${req.method} not in Allow-Methods`;
        if (!why && req.auth && !hd.toLowerCase().split(/,\s*/).includes("authorization")) why = `Allow-Headers "${hd}" doesn't list Authorization (a * wildcard never covers it)`;
        if (!why && !(hd.toLowerCase().split(/,\s*/).includes("content-type") || (hd === "*" && !req.cred))) why = "Content-Type not in Allow-Headers";
        msgs.push({ from: "api", to: "br", label: `204  ${Object.keys(h).filter((k) => k.startsWith("Access")).length} Access-Control-* headers`, cls: why ? "miss" : "hit" });
        push(2, `The server answers the preflight. ${Object.keys(h).length ? "" : "No CORS headers at all."}`);
        if (why) {
          msgs.push({ from: "br", to: "js", label: "TypeError: Failed to fetch", cls: "miss" });
          st.read = false;
          push(2, `<b>Preflight denied</b>: ${esc(why)}. The real ${req.method} is <b>never sent</b>. This is the only case where CORS stops a request reaching your server.`);
          return fr;
        }
        msgs.push({ from: "br", to: "br", label: "preflight OK (cached for Max-Age)", cls: "info" });
        push(2, "Preflight passed. The browser may cache this answer for <code>Access-Control-Max-Age</code> seconds.");
      } else {
        msgs.push({ from: "br", to: "br", label: "simple request → no preflight, send it", cls: "info" });
        push(3, `A <b>simple</b> request (GET/HEAD/POST, form or text content type, no custom headers). Browsers sent these cross-site long before CORS existed, so there's <b>no preflight</b>: it goes straight to the server.`);
      }
      msgs.push({ from: "br", to: "api", label: `${req.method}  ${Object.keys(reqHeaders).join(", ")}` });
      st.reached = true; push(3, `The actual request goes out with ${Object.keys(reqHeaders).map((k) => `<code>${k}</code>`).join(", ")}.`);
      if (evil && req.auth) {
        msgs.push({ from: "api", to: "api", label: "no valid token for the victim → 401", cls: "hit" });
        const h = corsHeaders(pol, origin, false); st.hdr = h; st.read = !corsCheck(h, origin, req.cred);
        msgs.push({ from: "api", to: "br", label: "401 Unauthorized", cls: "hit" });
        push(4, `Preflight passed, but that doesn't matter: a bearer token is never attached automatically, and evil.example can't read the victim's token from the real app. All it can send is no token, or its own. <b>401</b>. For header-token APIs, CORS is about letting <i>your</i> front end in, not about keeping attackers out.`);
        return fr;
      }
      st.effect = !!req.effect;
      msgs.push({ from: "api", to: "api", label: req.effect ? `handler runs: ${req.effect}` : "handler runs: read profile", cls: req.effect && evil ? "miss" : "info" });
      push(4, req.effect ? `The server runs the handler: <b>${req.effect}</b>. ${evil ? "Whatever the browser decides next, this already happened. CORS is not access control for your server." : ""}` : "The server runs the handler (a read; no side effects).");
      const h = corsHeaders(pol, origin, false); st.hdr = h;
      msgs.push({ from: "api", to: "br", label: `200  ${h["Access-Control-Allow-Origin"] ? "Allow-Origin: " + h["Access-Control-Allow-Origin"] : "(no Allow-Origin)"}` });
      push(5, "The response arrives with these headers.");
      const why = corsCheck(h, origin, req.cred);
      st.read = !why;
      msgs.push({ from: "br", to: "js", label: why ? "TypeError: Failed to fetch" : "Response readable", cls: why ? "miss" : evil ? "miss" : "hit" });
      push(5, why ? `<b>Blocked from JavaScript</b>: ${esc(why)}. The page can't read the body.${req.effect && evil ? " <b>But the transfer already ran.</b> Protect state-changing endpoints against CSRF; CORS won't." : ""}` : evil ? `<b>The attacker's page reads the response</b>, using the victim's ${req.cred ? "cookies" : "session"}. ${pol === 1 ? "Reflecting any Origin with credentials is the classic CORS misconfiguration: it turns CORS off while looking configured." : ""}` : "Allowed: the real front end reads the response.");
      return fr;
    },
    render: (f) => {
      const hdr = (title, h) => kv(title, Object.entries(h || {}).map(([k, v]) => [k, v]), { empty: "no CORS headers" });
      return `<div class="as-row"><div class="as-col"><div class="as-fit">${seq(f.lanes, f.msgs, { width: 560, max: 12, label: "CORS sequence" })}</div></div><div class="as-col as-side">${f.st.pre ? hdr("Preflight response", f.st.pre) : ""}${hdr("Response headers", f.st.hdr)}${stats([["reached the server", f.st.reached ? "yes" : "no", f.st.reached ? "" : "done"], ["side effect ran", f.st.effect ? "yes" : "no", f.st.effect ? "bad" : ""], ["JS can read it", f.st.read === null ? "…" : f.st.read ? "yes" : "no", f.st.read ? "done" : ""]])}</div></div>`;
    },
  }));

  /* =====================================================================
   * 8. CSRF: SameSite, tokens, Origin checks, and bearer tokens
   * ===================================================================== */
  const CSRF_AUTH = ["Cookie, SameSite=None", "Cookie, SameSite=Lax", "Cookie, SameSite=Strict", "Bearer token (Authorization header)"];
  const CSRF_DEF = ["No CSRF defense", "Anti-CSRF token on POST/PUT/PATCH/DELETE", "Check the Origin header"];
  const CSRF_ATK = ["Auto-submitting <form method=POST>", "Link to GET /transfer?to=mallory (state-changing GET)", "fetch POST JSON, credentials: include"];
  Viz.register("api-security-csrf", (el) => Viz.player(el, {
    title: "CSRF: can evil.example make the victim's browser move money?",
    legend: [["bad", "attack succeeded"], ["done", "attack stopped"], ["visit", "browser decision"]],
    codeLang: "python",
    code: [
      "# victim is signed in to bank.example, then opens evil.example",
      "browser.send(request, cookies=same_site_allows(cookie, request))",
      "user = authenticate(request)          # cookie or Authorization header",
      "if request.method not in SAFE: verify_csrf(request)   # token or Origin",
      "transfer(user, to, amount)",
    ],
    inputs: [
      { key: "a", label: "how the API authenticates", type: "select", options: CSRF_AUTH, value: CSRF_AUTH[1] },
      { key: "d", label: "defense", type: "select", options: CSRF_DEF, value: CSRF_DEF[0] },
      { key: "k", label: "attack", type: "select", options: CSRF_ATK, value: CSRF_ATK[1] },
    ],
    random: () => ({ a: pick(CSRF_AUTH), d: pick(CSRF_DEF), k: pick(CSRF_ATK) }),
    build: ({ a, d, k }) => {
      const ai = CSRF_AUTH.indexOf(a), di = CSRF_DEF.indexOf(d), ki = CSRF_ATK.indexOf(k);
      if (ai < 0 || di < 0 || ki < 0) throw new Error("Pick an option from each list.");
      const lanes = [{ id: "v", label: "Victim's browser", sub: "tab on evil.example", cls: "bad" }, { id: "b", label: "bank.example API" }];
      const msgs = [], fr = [], st = { cookie: null, origin: null, token: false, result: null };
      const push = (line, note) => fr.push({ lanes, msgs: msgs.slice(), st: { ...st }, line, note, vars: { attack: ["form POST", "GET link", "fetch"][ki] } });
      msgs.push({ from: "v", to: "v", label: ai === 3 ? "app keeps token in memory for bank.example" : "bank session cookie stored earlier", cls: "info" });
      push(0, ai === 3 ? "The victim uses the bank's single-page app, which holds an access token in memory and sends it in the <code>Authorization</code> header. Nothing is attached to requests automatically." : `The victim signed in to the bank earlier. The browser holds a session cookie with <code>${a.split(", ")[1]}</code>, and attaches cookies <i>automatically</i>. That automatic attachment is what CSRF abuses.`);
      msgs.push({ from: "v", to: "v", label: ["page auto-submits a hidden form", "victim clicks a link (top-level GET)", "page script calls fetch()"][ki], cls: "miss" });
      push(0, ["evil.example contains a hidden form that posts <code>to=mallory&amount=500</code> to the bank and submits itself on load.", "evil.example shows a link (or an <code>&lt;img&gt;</code>, or a redirect) to <code>https://bank.example/transfer?to=mallory&amount=500</code>. Someone built a state-changing GET.", "evil.example's script calls <code>fetch</code> with a JSON body and <code>credentials: 'include'</code>."][ki]);
      const method = ki === 1 ? "GET" : "POST";
      if (ki === 2) {
        msgs.push({ from: "v", to: "b", label: "OPTIONS (JSON needs a preflight)", cls: "path" });
        msgs.push({ from: "b", to: "v", label: "204, no Allow-Origin for evil.example", cls: "miss" });
        st.result = "done";
        push(1, "<code>application/json</code> isn't a form content type, so the browser preflights. The bank's CORS allow-list doesn't include evil.example: <b>the POST is never sent</b>. JSON-only endpoints that reject other content types get this for free; endpoints that also accept forms or <code>text/plain</code> don't.");
        return fr;
      }
      const cookieSent = ai === 3 ? null : ai === 0 ? true : ai === 1 ? method === "GET" : false;
      st.cookie = ai === 3 ? "none (no cookie auth)" : cookieSent ? "sent" : "withheld";
      st.origin = ki === 1 ? "(not sent on a GET navigation)" : "https://evil.example";
      msgs.push({ from: "v", to: "v", label: ai === 3 ? "no way to add the Authorization header" : `SameSite=${a.split("=")[1]} → cookie ${cookieSent ? "attached" : "withheld"}`, cls: "info" });
      push(1, ai === 3 ? "evil.example can't read the bank app's token (same-origin policy) and a form can't set an <code>Authorization</code> header. The request goes out <b>unauthenticated</b>." : ai === 0 ? "<code>SameSite=None</code>: the cookie goes with every cross-site request." : ai === 1 ? (cookieSent ? "<code>SameSite=Lax</code> allows cookies on <b>top-level navigations with a safe method</b>, so a GET link carries the cookie." : "<code>SameSite=Lax</code> withholds cookies on cross-site POSTs.") : "<code>SameSite=Strict</code> never sends the cookie on cross-site requests, not even when the user clicks a link (which also means arriving from an email link looks signed out).");
      msgs.push({ from: "v", to: "b", label: `${method} /transfer  ${cookieSent ? "Cookie: session=…" : "no credentials"}${ki === 0 ? "  Origin: evil.example" : ""}` });
      push(1, `The request reaches the bank. <code>Origin</code>: ${esc(st.origin)}.`);
      if (!cookieSent) {
        msgs.push({ from: "b", to: "v", label: "401 Unauthorized", cls: "hit" });
        st.result = "done"; push(2, "No credentials, so the bank can't tell who this is: <b>401</b>. The attack fails before any CSRF check."); return fr;
      }
      if (di === 1 && method !== "GET") {
        msgs.push({ from: "b", to: "b", label: "no X-CSRF-Token matching the session → 403", cls: "hit" });
        st.result = "done"; push(3, "The bank expects a per-session anti-CSRF token in a header or form field. evil.example can't read it from the bank's pages (same-origin policy), so it can't include it: <b>403</b>."); msgs.push({ from: "b", to: "v", label: "403 Forbidden", cls: "hit" }); return fr;
      }
      if (di === 2 && ki === 0) {
        msgs.push({ from: "b", to: "b", label: "Origin evil.example not allowed → 403", cls: "hit" });
        st.result = "done"; push(3, "Browsers send <code>Origin</code> on cross-site POSTs, and a page can't forge it. Not in the allow-list: <b>403</b>."); msgs.push({ from: "b", to: "v", label: "403 Forbidden", cls: "hit" }); return fr;
      }
      if (di > 0) {
        msgs.push({ from: "b", to: "b", label: di === 1 ? "GET is 'safe' → CSRF check skipped" : "no Origin header → can't tell, allowed", cls: "miss" });
        push(3, di === 1 ? "CSRF middleware (correctly) only checks unsafe methods. But this GET <i>changes state</i>, so it walks straight past the defense." : "Browsers don't send <code>Origin</code> on a top-level GET navigation, so the check has nothing to compare. Most implementations then allow the request.");
      }
      msgs.push({ from: "b", to: "b", label: "authenticated as victim → transfer €500 to mallory", cls: "miss" });
      msgs.push({ from: "b", to: "v", label: "200 OK", cls: "miss" });
      st.result = "bad";
      push(4, `<b>The transfer ran</b> as the victim. ${ki === 1 ? "The real bug is a GET that changes state: <code>SameSite=Lax</code> and CSRF tokens both assume GET is safe. Make it a POST." : "A cookie that's sent cross-site with no CSRF defense is exactly what CSRF needs."}`);
      return fr;
    },
    render: (f) => `<div class="as-row"><div class="as-col"><div class="as-fit">${seq(f.lanes, f.msgs, { width: 520, max: 10, label: "CSRF sequence" })}</div></div><div class="as-col as-side">${kv("What the bank sees", [["cookie", f.st.cookie || "…", f.st.cookie === "sent" ? "bad" : ""], ["Origin", f.st.origin || "…"]])}${f.st.result ? `<div class="as-resp ${f.st.result}"><b>${f.st.result === "bad" ? "Attack succeeded" : "Attack stopped"}</b></div>` : ""}</div></div>`,
  }));

  /* =====================================================================
   * 9. Rate limiting algorithms on the same traffic
   * ===================================================================== */
  const RL_W = 10, RL_L = 10, RL_R = 1, RL_C = 10, RL_Q = 5, RL_T = 40;
  const RL_ALGS = ["Fixed window", "Sliding log", "Sliding window counter", "Token bucket", "Leaky bucket (queue)"];
  const RL_TRAFFIC = {
    "Steady, 1.5× the limit": () => Array.from({ length: 59 }, (_, k) => +(0.3 + k / 1.5).toFixed(2)),
    "Burst at a window edge": () => [...Array.from({ length: 10 }, (_, k) => 8.5 + k * 0.15), ...Array.from({ length: 10 }, (_, k) => 10.05 + k * 0.15), ...Array.from({ length: 12 }, (_, k) => 28.6 + k * 0.2), 35, 37, 39].map((x) => +x.toFixed(2)),
    "Bursts of 8 every 7 s": () => { const a = []; for (let b = 1; b < RL_T; b += 7) for (let k = 0; k < 8; k++) if (b + k * 0.12 < RL_T) a.push(+(b + k * 0.12).toFixed(2)); return a; },
    "Random (Poisson, 1.3/s)": () => { const r = rng(42), a = []; let t = 0; for (;;) { t += -Math.log(1 - r()) / 1.3; if (t >= RL_T) break; a.push(+t.toFixed(2)); } return a; },
  };
  function rlSim(alg, times) {
    const ev = [], series = [];
    let st = { win: -1, cnt: 0, prev: 0, log: [], tokens: RL_C, last: 0, departs: [] };
    const level = (t) => {
      if (alg === 0) return Math.floor(t / RL_W) === st.win ? st.cnt : 0;
      if (alg === 1) return st.log.filter((x) => x > t - RL_W).length;
      if (alg === 2) { const w = Math.floor(t / RL_W), cur = w === st.win ? st.cnt : 0, prev = w === st.win ? st.prev : w === st.win + 1 ? st.cnt : 0; return prev * (1 - (t - w * RL_W) / RL_W) + cur; }
      if (alg === 3) return Math.min(RL_C, st.tokens + (t - st.last) * RL_R);
      return st.departs.filter((d) => d > t).length;
    };
    const sampleTo = (t) => { for (let s = series.length * 0.25; s <= t + 1e-9 && s <= RL_T; s = series.length * 0.25) series.push([s, level(s)]); };
    for (const t of times) {
      sampleTo(t);
      let ok, info = "", depart = t;
      if (alg === 0) { const w = Math.floor(t / RL_W); if (w !== st.win) { st.win = w; st.cnt = 0; } ok = st.cnt < RL_L; if (ok) st.cnt++; info = `window ${w * RL_W}–${w * RL_W + RL_W} s: ${st.cnt}/${RL_L}`; }
      else if (alg === 1) { st.log = st.log.filter((x) => x > t - RL_W); ok = st.log.length < RL_L; if (ok) st.log.push(t); info = `${st.log.length} accepted in the last ${RL_W} s`; }
      else if (alg === 2) {
        const w = Math.floor(t / RL_W);
        if (w !== st.win) { st.prev = w === st.win + 1 ? st.cnt : 0; st.cnt = 0; st.win = w; }
        const est = st.prev * (1 - (t - w * RL_W) / RL_W) + st.cnt; ok = est + 1 <= RL_L; if (ok) st.cnt++;
        info = `estimate ${st.prev}×${(1 - (t - w * RL_W) / RL_W).toFixed(2)} + ${st.cnt - (ok ? 1 : 0)} = ${est.toFixed(2)}`;
      } else if (alg === 3) { st.tokens = Math.min(RL_C, st.tokens + (t - st.last) * RL_R); st.last = t; ok = st.tokens >= 1; if (ok) st.tokens -= 1; info = `${st.tokens.toFixed(2)} tokens left`; }
      else {
        const q = st.departs.filter((d) => d > t).length; ok = q < RL_Q;
        if (ok) { depart = Math.max(t, (st.departs[st.departs.length - 1] ?? -Infinity) + 1 / RL_R); st.departs.push(depart); }
        info = ok ? `queued; starts at ${depart.toFixed(2)} s (waits ${(depart - t).toFixed(2)} s)` : `queue full (${q}/${RL_Q})`;
      }
      ev.push({ t, ok, info, depart: +depart.toFixed(2) });
    }
    sampleTo(RL_T);
    return { ev, series };
  }
  const maxInWindow = (ts) => { const a = ts.slice().sort((x, y) => x - y); let m = 0, j = 0; for (let i = 0; i < a.length; i++) { while (a[i] - a[j] >= RL_W - 1e-6) j++; m = Math.max(m, i - j + 1); } return m; };
  Viz.register("api-security-ratelimit", (el) => Viz.player(el, {
    title: "Rate limiting: five algorithms, the same traffic (limit 10 per 10 s)",
    legend: [["done", "allowed"], ["bad", "429 Too Many Requests"], ["visit", "limiter state"]],
    codeLang: "python",
    code: [
      "fixed:   n[t // W] < L                                   # resets at boundaries",
      "log:     len([x for x in log if x > t - W]) < L          # exact, O(L) memory per client",
      "counter: prev * (1 - (t % W) / W) + cur + 1 <= L          # weighted estimate, O(1)",
      "bucket:  tokens = min(C, tokens + (t - last) * R); tokens >= 1   # bursts up to C",
      "leaky:   queue < Q: start at max(t, last_start + 1/R)    # smooths, adds delay",
    ],
    inputs: [
      { key: "a", label: "algorithm", type: "select", options: RL_ALGS, value: RL_ALGS[0] },
      { key: "tr", label: "traffic", type: "select", options: Object.keys(RL_TRAFFIC), value: "Burst at a window edge" },
    ],
    random: () => ({ a: pick(RL_ALGS), tr: pick(Object.keys(RL_TRAFFIC)) }),
    build: ({ a, tr }) => {
      const alg = RL_ALGS.indexOf(a), mk = RL_TRAFFIC[tr]; if (alg < 0 || !mk) throw new Error("Pick an algorithm and a traffic pattern.");
      const times = mk(), { ev, series } = rlSim(alg, times), fr = [];
      const accT = ev.filter((e) => e.ok).map((e) => (alg === 4 ? e.depart : e.t));
      const peak = maxInWindow(accT);
      const base = { alg, ev, series, peak };
      fr.push({ ...base, t: 0, line: alg, vars: { requests: times.length }, note: `<b>${esc(a)}</b>. ${times.length} requests arrive over ${RL_T} s. The limit is ${RL_L} per ${RL_W} s (a rate of 1/s${alg === 3 ? `; bucket capacity ${RL_C}` : alg === 4 ? `; queue holds ${RL_Q}` : ""}).` });
      for (let t = 2; t <= RL_T; t += 2) {
        const now = ev.filter((e) => e.t <= t), recent = now.filter((e) => e.t > t - 2), last = now[now.length - 1];
        const acc = now.filter((e) => e.ok).length;
        fr.push({ ...base, t, line: alg, vars: { t: `${t} s`, allowed: acc, rejected: now.length - acc },
          note: recent.length ? `t = ${t - 2}–${t} s: ${recent.length} request${recent.length > 1 ? "s" : ""}, ${recent.filter((e) => e.ok).length} allowed. Last one: ${esc(last.info)}.` : `t = ${t - 2}–${t} s: quiet.` });
      }
      const acc = ev.filter((e) => e.ok).length;
      const verdictTxt = [
        peak > RL_L ? `<b>${peak} requests got through in a single ${RL_W}-second span</b>, double the limit: a full window's quota just before the boundary, another just after. Simple and cheap, but leaky at the edges.` : "No burst straddled a boundary this time, so the fixed window held.",
        `The sliding log is exact: never more than ${RL_L} in any ${RL_W}-second span (peak here: ${peak}). It costs a timestamp per accepted request per client.`,
        `The sliding window counter estimates the previous window's share. It needs two counters per client and stays close to the limit (peak here: ${peak}).`,
        `The token bucket allows a burst of up to ${RL_C} and then the refill rate, so up to ${RL_C + RL_R * RL_W} in ${RL_W} s (peak here: ${peak}). That's deliberate: real clients are bursty.`,
        `The leaky bucket rejects little but <b>delays</b>: work starts at a steady 1/s (peak here: ${peak}). Good in front of a fragile dependency; bad for latency-sensitive calls.`,
      ][alg];
      fr.push({ ...base, t: RL_T, line: alg, vars: { allowed: acc, rejected: ev.length - acc, peak }, note: verdictTxt });
      return fr;
    },
    render: (f) => {
      const W = 600, H = 230, x0 = 34, x1 = W - 10, X = (t) => x0 + (t / RL_T) * (x1 - x0), yMax = Math.max(RL_L, RL_C, RL_Q) + 1;
      const cy0 = 216, cy1 = 92, Y = (v) => cy0 - (v / yMax) * (cy0 - cy1);
      let s = `<svg class="as-rl" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="rate limiter timeline">`;
      for (let t = 0; t <= RL_T; t += RL_W) s += `<line class="${f.alg <= 2 ? "win" : "grid"}" x1="${X(t)}" y1="14" x2="${X(t)}" y2="${cy0}"/><text class="ax" x="${X(t)}" y="${H - 2}">${t}s</text>`;
      s += `<line class="axis" x1="${x0}" y1="${cy0}" x2="${x1}" y2="${cy0}"/><line class="lim" x1="${x0}" y1="${Y(f.alg === 4 ? RL_Q : f.alg === 3 ? RL_C : RL_L)}" x2="${x1}" y2="${Y(f.alg === 4 ? RL_Q : f.alg === 3 ? RL_C : RL_L)}"/>`;
      s += `<text class="ax" x="${x0 - 4}" y="${Y(0) + 4}" text-anchor="end">0</text><text class="ax" x="${x0 - 4}" y="${Y(f.alg === 4 ? RL_Q : 10) + 4}" text-anchor="end">${f.alg === 4 ? RL_Q : 10}</text>`;
      s += `<text class="lbl" x="${x0}" y="10">requests (✓ allowed, ✗ 429)</text><text class="lbl" x="${x0}" y="${cy1 - 6}">${["requests in the current window", "accepted in the last 10 s", "estimated count", "tokens in the bucket", "requests queued"][f.alg]}</text>`;
      const vis = f.ev.filter((e) => e.t <= f.t);
      const lanes = {}; vis.forEach((e) => { const k = Math.floor(e.t * 2); lanes[k] = (lanes[k] || 0) + 1; e._row = lanes[k] - 1; });
      vis.forEach((e) => {
        const x = X(e.t), y = 24 + (e._row % 5) * 11;
        if (f.alg === 4 && e.ok && e.depart > e.t + 0.01) s += `<line class="delay" x1="${x}" y1="${y}" x2="${X(Math.min(e.depart, RL_T))}" y2="${y}"/>`;
        s += e.ok ? `<circle class="ok" cx="${x}" cy="${y}" r="3.6"/>` : `<g class="no"><line x1="${x - 3.5}" y1="${y - 3.5}" x2="${x + 3.5}" y2="${y + 3.5}"/><line x1="${x - 3.5}" y1="${y + 3.5}" x2="${x + 3.5}" y2="${y - 3.5}"/></g>`;
      });
      const pts = f.series.filter(([t]) => t <= f.t).map(([t, v]) => `${X(t).toFixed(1)},${Y(v).toFixed(1)}`).join(" ");
      if (pts) s += `<polyline class="lvl" points="${pts}"/>`;
      s += `<line class="now" x1="${X(f.t)}" y1="14" x2="${X(f.t)}" y2="${cy0}"/></svg>`;
      const vis2 = f.ev.filter((e) => e.t <= f.t), acc = vis2.filter((e) => e.ok).length;
      const final = f.t >= RL_T;
      return `<div class="as-fit">${s}</div>${stats([["allowed", acc, "done"], ["429s", vis2.length - acc, vis2.length - acc ? "bad" : ""], ["peak in any 10 s", final ? f.peak : "…", final && f.peak > RL_L ? "bad" : ""]])}`;
    },
  }));
  Viz._apiSecurityRate = { rlSim, maxInWindow, RL_TRAFFIC, RL_ALGS };

  /* =====================================================================
   * 10. Mass assignment: binding a request onto an entity
   * ===================================================================== */
  const MA_ENTITY = { id: 7, email: "mallory@example.com", displayName: "Mallory", role: "customer", balance: 0, tenantId: "fabrikam", emailVerified: false };
  const MA_PAYLOADS = {
    "{ displayName }": { displayName: "Mal" },
    "{ displayName, role: \"admin\" }": { displayName: "Mal", role: "admin" },
    "{ displayName, balance: 1000000 }": { displayName: "Mal", balance: 1000000 },
    "{ displayName, tenantId: \"contoso\" }": { displayName: "Mal", tenantId: "contoso" },
    "{ displayName, emailVerified: true }": { displayName: "Mal", emailVerified: true },
    "{ id: 1, displayName, role: \"admin\" }": { id: 1, displayName: "Mal", role: "admin" },
  };
  const MA_BIND = ["Bind the JSON straight onto the entity", "DTO with only DisplayName (extra fields ignored)", "DTO + reject unknown fields (400)"];
  Viz.register("api-security-mass-assign", (el) => Viz.player(el, {
    title: "Mass assignment: PATCH /me with fields nobody meant to expose",
    legend: [["done", "applied, as intended"], ["bad", "applied, and it shouldn't be"], ["dim", "ignored"], ["warn", "rejected with 400"]],
    codeLang: "python",
    code: [
      "body = await request.json()",
      "for k, v in body.items(): setattr(user, k, v)    # entity binding: everything goes",
      "dto = ProfileUpdate(**body)                      # DTO: only declared fields",
      "class ProfileUpdate(BaseModel): model_config = ConfigDict(extra='forbid')",
      "user.display_name = dto.display_name; db.commit()",
    ],
    inputs: [
      { key: "p", label: "request body", type: "select", options: Object.keys(MA_PAYLOADS), value: "{ displayName, role: \"admin\" }" },
      { key: "b", label: "binding", type: "select", options: MA_BIND, value: MA_BIND[0] },
    ],
    random: () => ({ p: pick(Object.keys(MA_PAYLOADS)), b: pick(MA_BIND) }),
    build: ({ p, b }) => {
      const body = MA_PAYLOADS[p], mode = MA_BIND.indexOf(b); if (!body || mode < 0) throw new Error("Pick a body and a binding.");
      const before = clone(MA_ENTITY), after = clone(MA_ENTITY), fields = {}, fr = [];
      const base = { body, before };
      fr.push({ ...base, after: clone(after), fields: {}, line: 0, vars: { user: "mallory (id 7)" }, note: `Mallory edits her profile. The UI only shows a display-name box, but she sends the request by hand with <code>${esc(p)}</code>.` });
      const extra = Object.keys(body).filter((k) => k !== "displayName");
      if (mode === 2 && extra.length) {
        extra.forEach((k) => { fields[k] = "warn"; });
        fr.push({ ...base, after: clone(after), fields: { ...fields }, status: 400, line: 3, vars: { status: 400 }, note: `<b>400 Bad Request</b>: unknown field${extra.length > 1 ? "s" : ""} ${extra.map((k) => `<code>${k}</code>`).join(", ")}. Nothing changed, and the client learns its request was wrong instead of silently half-working. Log these: they are often probes.` });
        return fr;
      }
      Object.entries(body).forEach(([k, v]) => {
        if (mode === 0 || k === "displayName") {
          after[k] = v; fields[k] = k === "displayName" ? "done" : "bad";
          fr.push({ ...base, after: clone(after), fields: { ...fields }, line: mode === 0 ? 1 : 4, vars: { field: k, value: J(v) }, note: k === "displayName" ? "<code>displayName</code> applied: the one field this endpoint is for." : `<b><code>${k}</code> = ${esc(J(v))} applied.</b> ${{ role: "Mallory just made herself an administrator.", balance: "Free money: the balance is a server-computed fact, not user input.", tenantId: "She moved her account into another customer's tenant and will now see their data.", emailVerified: "She skipped email verification, and with it any flow that trusts a verified address.", id: "The primary key changed: the ORM now writes this row over <b>user 1</b>." }[k] || ""}` });
        } else {
          fields[k] = "dim";
          fr.push({ ...base, after: clone(after), fields: { ...fields }, line: 2, vars: { field: k, value: "ignored" }, note: `<code>${k}</code> isn't on the DTO, so it's dropped. Safe, though silent: consider rejecting unknown fields so mistakes and probes are visible.` });
        }
      });
      const harm = Object.values(fields).filter((x) => x === "bad").length;
      fr.push({ ...base, after: clone(after), fields: { ...fields }, status: harm ? 200 : 204, harm, line: 4, vars: { "fields changed": Object.values(fields).filter((x) => x === "done" || x === "bad").length }, note: harm ? `<b>${harm} protected field${harm > 1 ? "s" : ""} overwritten.</b> Binding onto the entity exposes every settable property, including ones added next year. Bind to a request DTO that lists exactly what the client may change.` : "Only the display name changed. The DTO is the allow-list." });
      return fr;
    },
    render: (f) => {
      const rows = Object.keys(f.before).map((k) => {
        const c = f.fields[k] || "", changed = J(f.before[k]) !== J(f.after[k]);
        return `<tr class="${c}"><td><code>${k}</code></td><td>${esc(J(f.before[k]))}</td><td>${k in f.body ? esc(J(f.body[k])) : ""}</td><td>${changed ? `<b>${esc(J(f.after[k]))}</b>` : esc(J(f.after[k]))}</td></tr>`;
      }).join("");
      const res = f.status ? `<div class="as-resp ${f.status === 400 ? "warn" : f.harm ? "bad" : "done"}"><b>${f.status === 400 ? "400 Bad Request" : f.status === 204 ? "204 No Content" : "200 OK (and an incident)"}</b></div>` : "";
      return `<div class="as-scroll"><table class="as-table ma"><tr><th>field</th><th>stored before</th><th>request body</th><th>stored after</th></tr>${rows}</table></div>${res}`;
    },
  }));
})();
