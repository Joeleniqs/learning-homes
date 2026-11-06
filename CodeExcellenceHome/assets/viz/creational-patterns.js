/* Creational patterns visualizers. Every registered name is prefixed "creational-patterns-". */
(() => {
  const esc = Viz.esc;
  const P = "creational-patterns-";

  /* ---------- shared helpers ---------- */
  const list = (s, label, { min = 1, max = 8, re = /^[a-z][a-z0-9]{0,11}$/ } = {}) => {
    const a = String(s).split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (a.length < min || a.length > max) throw new Error(`${label}: use ${min} to ${max} items separated by commas.`);
    for (const x of a) if (!re.test(x)) throw new Error(`${label}: "${x}" is not a valid name (letters and digits, up to 12).`);
    return a;
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const kv = (title, rows, o = {}) => `<div class="pt-kv ${o.cls || ""}"><div class="pt-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="pt-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="pt-kv-r dim"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="pt-stats">${items.map(([l, v, c]) => `<div class="pt-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const verdict = (text, cls) => `<div class="pt-verdict ${cls || ""}">${esc(text)}</div>`;
  const col = (...p) => `<div class="pt-col">${p.filter(Boolean).join("")}</div>`;
  const panels = (...p) => `<div class="pt-panels">${p.filter(Boolean).join("")}</div>`;

  /* sequence diagram. lanes [{id,label,sub,cls}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 640, n = lanes.length, lw = W / n, rowH = o.rowH || 27, max = o.max || 10;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, (i + 0.5) * lw]));
    let s = `<svg class="pt-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 12, 170);
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
        const x = X[m.from], bw = Math.min(W - 8, Math.max(120, m.label.length * 6.6 + 18));
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

  /* box graph: nodes [{id,x,y,w,title,sub,rows:[[text,cls]],cls}], edges [{from,row,to,label,cls,loop}] */
  function boxGraph(nodes, edges, o = {}) {
    const RH = 17, HH = 24;
    const byId = {};
    for (const n of nodes) { n.h = HH + (n.rows || []).length * RH + ((n.rows || []).length ? 6 : 0); byId[n.id] = n; }
    const pad = o.pad ?? 10;
    const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + pad + (o.extraW || 0), maxY = Math.max(...nodes.map((n) => n.y + n.h)) + pad + (o.extraH || 0);
    const minY = Math.min(...nodes.map((n) => n.y)) - pad - (o.topPad || 0);
    let s = `<svg class="pt-bg" viewBox="${-pad} ${minY} ${maxX + pad} ${maxY - minY}" width="${maxX + pad}" role="img" aria-label="${esc(o.label || "object graph")}">`;
    const head = (x2, y2, ux, uy, c) => `<polygon class="ah ${c}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
    let es = "", labels = "";
    for (const e of edges) {
      const a = byId[e.from], b = byId[e.to];
      if (!a || !b) continue;
      const c = e.cls || "";
      if (e.loop) {
        const x = a.x + a.w / 2, y = a.y;
        es += `<path class="e ${c}" d="M${x - 26},${y} C${x - 40},${y - 42} ${x + 40},${y - 42} ${x + 28},${y - 6}"/>` + head(x + 26, y - 1, -0.3, 0.95, c);
        labels += `<text class="el ${c}" x="${x}" y="${y - 36}">${esc(e.label || "")}</text>`;
        continue;
      }
      const y1 = e.row !== undefined ? a.y + HH + 6 + e.row * RH + RH / 2 - 3 : a.y + a.h / 2;
      const fwd = b.x >= a.x + a.w - 1;
      const x1 = fwd ? a.x + a.w : a.x;
      const tx = fwd ? b.x : b.x + b.w, ty = Math.max(b.y + 8, Math.min(b.y + b.h - 8, e.toY !== undefined ? b.y + e.toY : y1 + (b.y + b.h / 2 - y1) * 0.85));
      const dx = tx - x1, dy = ty - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const mx = x1 + dx * 0.5, my = y1 + dy * 0.5;
      es += `<path class="e ${c}" d="M${x1},${y1} C${x1 + dx * 0.45},${y1} ${tx - dx * 0.45},${ty} ${tx - ux * 6},${ty - uy * 6}"/>` + head(tx, ty, 1 * Math.sign(dx || 1), 0, c);
      if (e.label) labels += `<text class="el ${c}" x="${mx}" y="${my - 4}">${esc(e.label)}</text>`;
    }
    let ns = "";
    for (const n of nodes) {
      ns += `<g class="bn ${n.cls || ""}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7"/>`;
      ns += `<text class="bt" x="${n.x + n.w / 2}" y="${n.y + 16}">${esc(n.title)}</text>`;
      if (n.tag) ns += `<text class="btag" x="${n.x + n.w - 6}" y="${n.y - 4}">${esc(n.tag)}</text>`;
      (n.rows || []).forEach(([t, rc], i) => {
        const y = n.y + HH + 6 + i * RH;
        if (rc) ns += `<rect class="br ${rc}" x="${n.x + 3}" y="${y - 2}" width="${n.w - 6}" height="${RH - 1}" rx="3"/>`;
        ns += `<text class="bf" x="${n.x + 8}" y="${y + 11}">${esc(t)}</text>`;
      });
      if ((n.rows || []).length) ns += `<line class="bs" x1="${n.x}" y1="${n.y + HH}" x2="${n.x + n.w}" y2="${n.y + HH}"/>`;
      ns += "</g>";
    }
    return s + es + ns + labels + "</svg>";
  }

  /* =====================================================================
   * 1. Factory: one place that knows the concrete types
   * ===================================================================== */
  Viz.register(P + "factory", (el) => Viz.player(el, {
    title: "A registry factory: the client asks for a kind, gets an interface",
    legend: [["active", "lookup / construct"], ["done", "returned to client"], ["visit", "reused instance"], ["bad", "unknown kind: fail fast"]],
    codeLang: "csharp",
    code: [
      "public INotifier Create(string kind)",
      "{",
      "    if (!_registry.TryGetValue(kind, out var make))",
      "        throw new UnknownChannelException(kind, _registry.Keys);",
      "    if (_reuse && _made.TryGetValue(kind, out var x)) return x;",
      "    var n = make(_options);      // the only `new` for this kind",
      "    if (_reuse) _made[kind] = n;",
      "    return n;                    // caller sees INotifier only",
      "}",
    ],
    inputs: [
      { key: "reg", label: "registered kinds", value: "email,sms,push", width: 170 },
      { key: "req", label: "client requests", value: "sms,email,sms,fax,push", width: 220 },
      { key: "mode", label: "instances", type: "select", options: ["new instance per call", "reuse one per kind"], value: "new instance per call" },
    ],
    random: () => {
      const pool = ["email", "sms", "push", "slack", "webhook", "teams"];
      const reg = pool.filter(() => Math.random() < 0.6); if (!reg.length) reg.push("email");
      const req = Array.from({ length: Viz.rand(3, 7) }, () => pool[Viz.rand(0, pool.length - 1)]);
      return { reg: reg.join(","), req: req.join(","), mode: Math.random() < 0.5 ? "new instance per call" : "reuse one per kind" };
    },
    build: ({ reg, req, mode }) => {
      const kinds = list(reg, "registered kinds", { min: 1, max: 6 });
      if (new Set(kinds).size !== kinds.length) throw new Error("registered kinds: each kind once (a second registration would silently win).");
      const reqs = list(req, "client requests", { min: 1, max: 8 });
      const reuse = mode === "reuse one per kind";
      const fr = [], msgs = [], made = {}, inst = [];
      let errors = 0, reused = 0, hl = null;
      const snap = (o) => fr.push({ kinds, msgs: msgs.slice(), inst: inst.slice(), made: { ...made }, errors, reused, hl, reuse, nreq: reqs.length, ...o });
      snap({ line: 0, note: `The registry is filled <b>once</b>, at startup, in the composition root: ${kinds.map((k) => `<code>${k}</code> → <code>${cap(k)}Notifier</code>`).join(", ")}. From now on, nobody else in the codebase writes <code>new XxxNotifier</code>.`, vars: { registered: kinds.length, mode: reuse ? "reuse" : "new" } });
      reqs.forEach((k, i) => {
        hl = k;
        msgs.push({ from: "c", to: "f", label: `Create("${k}")` });
        snap({ line: 2, step: i, note: `Request ${i + 1}: the client passes a <b>key</b>, not a type. It has no <code>using</code> or <code>import</code> for any concrete notifier, so it cannot depend on one.`, vars: { kind: k, found: kinds.includes(k) } });
        if (!kinds.includes(k)) {
          errors++;
          msgs.push({ from: "f", to: "c", label: `✗ UnknownChannel("${k}")`, cls: "bad" });
          snap({ line: 3, step: i, bad: true, note: `<b>"${k}" is not registered.</b> A good factory fails loudly here and lists what it does know (${kinds.join(", ")}). Returning <code>null</code> or a silent default just moves the crash somewhere harder to debug.`, vars: { kind: k, errors } });
          return;
        }
        if (reuse && made[k]) {
          reused++;
          msgs.push({ from: "f", to: "c", label: `INotifier (#${made[k]})`, cls: "reuse" });
          snap({ line: 4, step: i, reusedNow: made[k], note: `Already built a <code>${cap(k)}Notifier</code> (#${made[k]}). The factory hands back the same instance. The client can't tell, which is exactly the freedom a factory buys you: it controls <i>how many</i>, not just <i>which</i>.`, vars: { kind: k, instance: "#" + made[k], reused } });
          return;
        }
        const id = inst.length + 1;
        inst.push({ id, kind: k });
        msgs.push({ from: "f", to: "p", label: `new ${cap(k)}Notifier(opts)`, cls: "make" });
        snap({ line: 5, step: i, newId: id, note: `Construct <code>${cap(k)}Notifier</code> #${id}. This is the <b>only</b> line in the app that names that class. Its constructor arguments (options, HTTP client, keys) are the factory's problem, not the client's.`, vars: { kind: k, instance: "#" + id, created: inst.length } });
        if (reuse) { made[k] = id; snap({ line: 6, step: i, newId: id, note: `Remember #${id} for the next "${k}" request.`, vars: { kind: k, cached: Object.keys(made).length } }); }
        msgs.push({ from: "f", to: "c", label: `INotifier (#${id})`, cls: "ret" });
        snap({ line: 7, step: i, retId: id, note: `Return it typed as <code>INotifier</code>. The client calls <code>SendAsync</code> and never learns the concrete type.`, vars: { kind: k, returned: "#" + id } });
      });
      hl = null;
      snap({ line: 7, final: true, note: `<b>${reqs.length} requests → ${inst.length} constructions${reused ? `, ${reused} reused` : ""}${errors ? `, ${errors} rejected` : ""}.</b> To add a channel you add <b>one registry line</b>; the ${reqs.length} call sites don't change. That is the Open/Closed Principle bought with one level of indirection.`, vars: { requests: reqs.length, created: inst.length, reused, errors } });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "c", label: "Client", sub: "knows INotifier" }, { id: "f", label: "NotifierFactory", sub: "knows the registry", cls: "accent" }, { id: "p", label: "Concrete classes", sub: "EmailNotifier, …" }];
      const reg = kv("registry (built at startup)", f.kinds.map((k) => [k, `${cap(k)}Notifier` + (f.made[k] ? `  #${f.made[k]}` : ""), f.hl === k ? (f.bad ? "bad" : "active") : ""]).concat(f.bad ? [[f.hl, "— not registered —", "bad"]] : []));
      const live = kv("instances created", f.inst.map((x) => [`#${x.id}`, `${cap(x.kind)}Notifier`, x.id === f.newId ? "active" : x.id === f.retId ? "done" : x.id === f.reusedNow ? "visit" : ""]), { empty: "none yet" });
      return col(
        `<div class="pt-fit">${seq(lanes, f.msgs, { width: 640, max: 9, label: "factory call sequence" })}</div>`,
        panels(reg, live),
        stats([["requests", f.nreq], ["constructed", f.inst.length, "active"], ["reused", f.reused, "visit"], ["rejected", f.errors, f.errors ? "bad" : ""]]),
      );
    },
  }));

  /* =====================================================================
   * 2. Abstract factory: families that must match (ADO.NET DbProviderFactory)
   * ===================================================================== */
  const FAM = {
    SqlServer: { Connection: "SqlConnection", Command: "SqlCommand", Parameter: "SqlParameter", f: "SqlClientFactory" },
    Postgres: { Connection: "NpgsqlConnection", Command: "NpgsqlCommand", Parameter: "NpgsqlParameter", f: "NpgsqlFactory" },
    Sqlite: { Connection: "SqliteConnection", Command: "SqliteCommand", Parameter: "SqliteParameter", f: "SqliteFactory" },
  };
  const FAMS = Object.keys(FAM), PRODS = ["Connection", "Command", "Parameter"];
  const famOf = (s, what) => {
    const k = FAMS.find((f) => f.toLowerCase() === String(s).trim().toLowerCase());
    if (!k) throw new Error(`${what}: use one of ${FAMS.join(", ")}.`);
    return k;
  };
  Viz.register(P + "abstract-factory", (el) => Viz.player(el, {
    title: "Abstract factory: one choice, a matching family of products",
    legend: [["active", "being created"], ["done", "created, family matches"], ["bad", "mixed families: runtime failure"], ["path", "the chosen family"]],
    codeLang: "csharp",
    code: [
      "DbProviderFactory f = /* chosen once, at startup */;",
      "using var conn = f.CreateConnection();",
      "using var cmd  = f.CreateCommand();",
      "var p          = f.CreateParameter();",
      "cmd.Connection = conn;          // types must match",
      "cmd.Parameters.Add(p);          // types must match",
      "await cmd.ExecuteReaderAsync();",
    ],
    inputs: [
      { key: "mode", label: "who picks the classes", type: "select", options: ["one abstract factory", "each call site uses new"], value: "each call site uses new" },
      { key: "fam", label: "factory family", type: "select", options: FAMS, value: "Postgres" },
      { key: "sites", label: "call sites (new mode)", value: "conn=Postgres, cmd=SqlServer, param=Postgres", width: 330 },
    ],
    random: () => {
      const r = () => FAMS[Viz.rand(0, 2)];
      return { mode: Math.random() < 0.5 ? "one abstract factory" : "each call site uses new", fam: r(), sites: `conn=${r()}, cmd=${r()}, param=${r()}` };
    },
    build: ({ mode, fam, sites }) => {
      const useF = mode === "one abstract factory";
      const pick = {};
      const parts = String(sites).split(",").map((x) => x.trim()).filter(Boolean);
      for (const p of parts) {
        const m = p.match(/^(conn|cmd|param)\s*=\s*(\w+)$/i);
        if (!m) throw new Error(`call sites: write "conn=Postgres, cmd=SqlServer, param=Sqlite" (got "${p}").`);
        pick[{ conn: "Connection", cmd: "Command", param: "Parameter" }[m[1].toLowerCase()]] = famOf(m[2], m[1]);
      }
      for (const p of PRODS) if (!pick[p]) throw new Error(`call sites: missing ${p === "Connection" ? "conn" : p === "Command" ? "cmd" : "param"}=…`);
      const chosen = useF ? { Connection: fam, Command: fam, Parameter: fam } : pick;
      const fr = [], made = [];
      let broke = null;
      const snap = (o) => fr.push({ useF, fam, chosen, made: made.slice(), broke, ...o });
      snap({ line: 0, note: useF ? `The composition root picks <code>${FAM[fam].f}.Instance</code> once (from config: "provider=${fam}"). Every product below comes from that one object, so mixing is <b>impossible by construction</b>.` : `No factory: each call site writes its own <code>new XxxConnection()</code>. Three files, three decisions, and nothing forces them to agree. Here they say ${PRODS.map((p) => `${p}=${pick[p]}`).join(", ")}.`, vars: { mode: useF ? "factory" : "new" } });
      PRODS.forEach((p, i) => {
        made.push({ p, fam: chosen[p] });
        snap({ line: 1 + i, cur: p, note: `Create the <b>${p.toLowerCase()}</b>: <code>${FAM[chosen[p]][p]}</code>${useF ? ` (the factory decides; the call site only says <code>Create${p}()</code>)` : ` (this call site hard-coded ${chosen[p]})`}.`, vars: { product: p, "class": FAM[chosen[p]][p] } });
      });
      const c = chosen;
      if (c.Command !== c.Connection) {
        broke = "conn";
        snap({ line: 4, note: `<b>InvalidCastException</b>: <code>${FAM[c.Command].Command}.Connection</code> needs a <code>${FAM[c.Command].Connection}</code>, but got a <code>${FAM[c.Connection].Connection}</code>. It compiled, because both are typed as <code>DbConnection</code>. It fails at runtime, the first time this code path runs.`, vars: { command: c.Command, connection: c.Connection } });
      } else {
        snap({ line: 4, ok: "conn", note: `<code>${FAM[c.Command].Command}</code> accepts <code>${FAM[c.Connection].Connection}</code>: same family.`, vars: { command: c.Command, connection: c.Connection } });
      }
      if (!broke) {
        if (c.Parameter !== c.Command) {
          broke = "param";
          snap({ line: 5, note: `<b>InvalidCastException</b>: "The ${FAM[c.Command].Command.replace("Command", "ParameterCollection")} only accepts non-null ${FAM[c.Command].Parameter} type objects, not ${FAM[c.Parameter].Parameter} objects." Again a runtime failure that the type system could not see.`, vars: { command: c.Command, parameter: c.Parameter } });
        } else snap({ line: 5, ok: "param", note: `Parameter matches the command's family.`, vars: { command: c.Command, parameter: c.Parameter } });
      }
      snap({ line: 6, final: true, note: broke ? `<b>Mixed families.</b> Abstract Factory exists for exactly this: products that only work <i>together</i>. Put the choice in one object and inject that object.` : `<b>A consistent family.</b> ${useF ? "Switching to another database is one line in the composition root: inject a different factory." : "It works, but only because three people happened to agree. The next edit can break it."}`, vars: { result: broke ? "InvalidCastException" : "OK" } });
      return fr;
    },
    render: (f) => {
      const g = Viz.grid(FAMS.map((fm) => PRODS.map((p) => FAM[fm][p])), {
        rowLabels: FAMS, colLabels: PRODS, corner: "family",
        cls: (r, c) => {
          const fm = FAMS[r], p = PRODS[c];
          const m = f.made.find((x) => x.p === p);
          if (m && m.fam === fm) {
            if (f.cur === p) return "active";
            const mixed = new Set(f.made.map((x) => x.fam)).size > 1;
            return mixed && f.made.length === 3 ? "bad" : "done";
          }
          return f.useF && fm === f.fam ? "path" : "";
        },
      });
      const fams = new Set(f.made.map((x) => x.fam));
      const asm = kv("what the code assembled", f.made.map((x) => [x.p, FAM[x.fam][x.p], f.broke && ((f.broke === "conn" && x.p !== "Parameter") || (f.broke === "param" && x.p !== "Connection")) ? "bad" : f.cur === x.p ? "active" : fams.size > 1 && f.made.length === 3 ? "" : "done"]), { empty: "nothing yet" });
      return col(
        `<div class="pt-fit">${g}</div>`,
        panels(kv("decided by", [[f.useF ? "one factory" : "each call site", f.useF ? FAM[f.fam].f : "3 separate `new`s", f.useF ? "path" : "active"]]), asm),
        f.final ? verdict(f.broke ? "Mixed family → InvalidCastException at runtime" : "Consistent family", f.broke ? "bad" : "done") : "",
      );
    },
  }));

  /* =====================================================================
   * 3. Builder: fluent vs step builder
   * ===================================================================== */
  const B_STATES = { url: "IUrlStep", auth: "IAuthStep", opt: "IOptionsStep", done: "HttpRequest" };
  const B_ALLOWED = { url: ["url"], auth: ["auth", "anonymous"], opt: ["timeout", "header", "retries", "build"], done: [] };
  const B_NEXT = { url: "auth", auth: "auth", anonymous: "opt", timeout: "opt", header: "opt", retries: "opt", build: "done" };
  const B_METHODS = ["url", "auth", "anonymous", "timeout", "header", "retries", "build"];
  Viz.register(P + "builder", (el) => Viz.player(el, {
    title: "Builder: assemble step by step, validate, then freeze",
    legend: [["active", "current call / state"], ["done", "accepted"], ["bad", "rejected"], ["path", "frozen product"]],
    codeLang: "csharp",
    code: [
      "var req = HttpRequestBuilder.Create()",
      "    .Url(\"https://…\")        // per-call checks: format",
      "    .Auth(\"token\")           // or .Anonymous()",
      "    .Timeout(5).Header(\"k\", \"v\").Retries(3)",
      "    .Build();                // cross-field checks, then freeze",
      "// Step builder: each method returns the NEXT interface,",
      "// so a wrong order is a compile error, not a runtime one.",
    ],
    inputs: [
      { key: "calls", label: "calls in order", value: "url(https://api.contoso.com/orders) timeout(5) header(X-Trace:abc) auth(token123) retries(3) build()", width: 520 },
      { key: "mode", label: "builder style", type: "select", options: ["fluent builder", "step builder (typed stages)"], value: "fluent builder" },
    ],
    random: () => {
      const opts = ["timeout(5)", "timeout(0)", "header(X-Trace:abc)", "header(bad)", "retries(3)", "retries(99)", "auth(t0k)", "anonymous()"];
      const a = [Math.random() < 0.85 ? "url(https://api.contoso.com/x)" : "url(ftp://x)"];
      for (let i = Viz.rand(1, 4); i > 0; i--) a.push(opts[Viz.rand(0, opts.length - 1)]);
      if (Math.random() < 0.3) a.splice(Viz.rand(0, a.length), 0, "auth(abc)");
      if (Math.random() < 0.85) a.push("build()");
      if (Math.random() < 0.2) a.shift();
      return { calls: a.join(" "), mode: Math.random() < 0.5 ? "fluent builder" : "step builder (typed stages)" };
    },
    build: ({ calls, mode }) => {
      const src = String(calls).trim();
      const re = /\s*(\w+)\(([^()]*)\)\s*/y;
      const cs = [];
      let m;
      while (re.lastIndex < src.length && (m = re.exec(src))) cs.push({ name: m[1], arg: m[2].trim() });
      if (re.lastIndex < src.length || !cs.length) throw new Error('calls: use method(arg) calls separated by spaces, e.g. "url(https://x) auth(t) build()".');
      if (cs.length > 10) throw new Error("calls: Too many calls (10 max).");
      for (const c of cs) if (!B_METHODS.includes(c.name)) throw new Error(`calls: "${c.name}" is not a builder method. Use ${B_METHODS.join(", ")}.`);
      const step = mode.startsWith("step");
      const fr = [], fields = {}, log = [];
      let state = "url", product = null, failed = null, built = false;
      const snap = (o) => fr.push({ step, state, fields: { ...fields }, log: log.slice(), product, failed, cs, ...o });
      snap({ line: 0, note: step ? `A <b>step builder</b> is a chain of interfaces. <code>Create()</code> returns <code>IUrlStep</code>, which has <i>only</i> <code>Url()</code>. You can't forget the URL or call <code>Build()</code> too early, because the method isn't there for the compiler to find.` : `A <b>fluent builder</b> is one mutable object whose methods return <code>this</code>. You can call them in any order and the compiler can't help. Checks happen at runtime: per-argument checks inside each method, cross-field checks in <code>Build()</code>.`, vars: { calls: cs.length, mode: step ? "step" : "fluent" } });
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i], sig = `${c.name}(${c.arg})`;
        if (built) {
          log.push([sig, "ignored", "bad"]);
          snap({ line: 4, cur: i, note: `<code>${sig}</code> after <code>Build()</code>: the product is already <b>frozen</b> (immutable). ${step ? "In a step builder <code>HttpRequest</code> has no such method: compile error." : "A fluent builder mutates <i>itself</i>, not the product. The request you already built is unaffected, which surprises people who reuse builders."}`, vars: { call: sig, product: "unchanged" } });
          if (step) { failed = { kind: "compile", msg: `CS1061: 'HttpRequest' does not contain a definition for '${cap(c.name)}'` }; snap({ line: 6, cur: i, final: true, note: `<b>Compile error.</b> Nothing ran.`, vars: { error: "CS1061" } }); return fr; }
          continue;
        }
        if (step && !B_ALLOWED[state].includes(c.name)) {
          failed = { kind: "compile", msg: `CS1061: '${B_STATES[state]}' does not contain a definition for '${cap(c.name)}'` };
          log.push([sig, "CS1061", "bad"]);
          snap({ line: 6, cur: i, final: true, note: `<b>Compile error</b>: you're in stage <code>${B_STATES[state]}</code>, which only offers ${B_ALLOWED[state].map((x) => `<code>${cap(x)}()</code>`).join(", ")}. The mistake is caught <b>before the program runs</b>. That's the whole point of the step builder, and it costs one interface per stage.`, vars: { stage: B_STATES[state], call: c.name } });
          return fr;
        }
        let err = null, val = c.arg;
        if (c.name === "url" && !/^https?:\/\/[\w.-]+/.test(c.arg)) err = `ArgumentException: Url must be absolute http(s), got "${c.arg}"`;
        if (c.name === "timeout") { const n = Number(c.arg); if (!Number.isInteger(n) || n < 1 || n > 300) err = `ArgumentOutOfRangeException: Timeout must be 1..300 s, got "${c.arg}"`; else val = n + " s"; }
        if (c.name === "retries") { const n = Number(c.arg); if (!Number.isInteger(n) || n < 0 || n > 10) err = `ArgumentOutOfRangeException: Retries must be 0..10, got "${c.arg}"`; }
        if (c.name === "header" && !/^[\w-]+:.+$/.test(c.arg)) err = `ArgumentException: header must be Name:value, got "${c.arg}"`;
        if (c.name === "auth" && !c.arg) err = "ArgumentException: token must not be empty";
        if (err) {
          failed = { kind: "runtime", msg: err };
          log.push([sig, "throws", "bad"]);
          snap({ line: { url: 1, auth: 2 }[c.name] ?? 3, cur: i, final: true, note: `<b>Rejected at the call</b>: ${esc(err)}. Validate each argument where it arrives, so the stack trace points at the offending line rather than at some distant <code>Build()</code>.`, vars: { call: c.name, error: err.split(":")[0] } });
          return fr;
        }
        if (c.name === "build") {
          const problems = [];
          if (!fields.url) problems.push("Url is required");
          if (!fields.auth) problems.push("choose Auth(token) or Anonymous()");
          if (fields.retries && Number(fields.retries) > 0 && !fields.timeout) problems.push("Retries need a Timeout (else one hung attempt blocks forever)");
          if (problems.length) {
            failed = { kind: "runtime", msg: "InvalidOperationException: " + problems.join("; ") };
            log.push([sig, "throws", "bad"]);
            snap({ line: 4, cur: i, final: true, note: `<b>Build() refuses</b>: ${esc(problems.join("; "))}. Cross-field rules can only be checked when everything has been given, so they belong in <code>Build()</code>. ${step ? "" : "A step builder would have made the first two impossible to write."}`, vars: { problems: problems.length } });
            return fr;
          }
          product = { Url: fields.url, Auth: fields.auth, Timeout: fields.timeout || "100 s (default)", Headers: fields.header || "(none)", Retries: fields.retries ?? "0 (default)" };
          built = true; state = "done";
          log.push([sig, "built", "done"]);
          snap({ line: 4, cur: i, note: `<b>Build()</b> runs the cross-field checks, fills in defaults and returns an <b>immutable</b> <code>HttpRequest</code>. The builder was the mutable scaffolding; the product never has a half-built moment.`, vars: { product: "HttpRequest", fields: Object.keys(fields).length } });
          continue;
        }
        if (c.name === "anonymous") fields.auth = "anonymous";
        else if (c.name === "auth") fields.auth = "Bearer " + c.arg;
        else if (c.name === "header") fields.header = fields.header ? fields.header + "; " + c.arg : c.arg;
        else fields[c.name] = val;
        const prev = state;
        if (step) state = B_NEXT[c.name] === "auth" ? "auth" : B_NEXT[c.name];
        log.push([sig, "ok", "done"]);
        snap({ line: { url: 1, auth: 2, anonymous: 2 }[c.name] ?? 3, cur: i, note: `<code>${sig}</code> stores a field on the builder${step && prev !== state ? ` and returns <code>${B_STATES[state]}</code>, so the next call can only be ${B_ALLOWED[state].map((x) => `<code>${cap(x)}()</code>`).join(" / ")}` : " and returns the same builder"}.`, vars: { call: c.name, stage: step ? B_STATES[state] : "RequestBuilder" } });
      }
      if (!built) snap({ line: 4, final: true, note: `No <code>Build()</code> call: you're holding a <b>builder</b>, not a request. ${step ? "The step builder's type says so; you can't pass an <code>IOptionsStep</code> where an <code>HttpRequest</code> is expected." : "In a fluent API this mistake usually only shows up as a type error where the request is used."}`, vars: { built: false } });
      else snap({ line: 4, final: true, note: `<b>Done.</b> ${cs.length} calls produced one immutable value. ${step ? "Order mistakes were impossible to write." : "Order didn't matter; mistakes are caught when each call or Build() runs."}`, vars: { built: true } });
      return fr;
    },
    render: (f) => {
      let chart;
      if (f.step) {
        const st = ["url", "auth", "opt", "done"], cur = f.failed ? f.state : f.state;
        const nodes = st.map((s, i) => ({ id: s, x: i * 175, y: 30, w: 140, title: B_STATES[s], rows: (s === "done" ? [["immutable"]] : B_ALLOWED[s].map((x) => [cap(x) + "()"])), cls: s === cur ? (f.failed ? "bad" : s === "done" ? "path" : "active") : st.indexOf(s) < st.indexOf(cur) ? "done" : "" }));
        const edges = [{ from: "url", to: "auth", label: "Url()", toY: 20 }, { from: "auth", to: "opt", label: "Auth / Anonymous", toY: 20 }, { from: "opt", to: "done", label: "Build()", toY: 20 }, { from: "opt", loop: true, label: "Timeout / Header / Retries" }];
        chart = boxGraph(nodes, edges, { label: "step builder stages", topPad: 30 });
      } else {
        const nodes = [{ id: "b", x: 0, y: 30, w: 190, title: "RequestBuilder (mutable)", rows: B_METHODS.filter((x) => x !== "build").map((x) => [cap(x) + "()  → this"]), cls: f.state === "done" ? "done" : "active" },
          { id: "p", x: 300, y: 70, w: 170, title: "HttpRequest (immutable)", rows: [["Url, Auth, Timeout"], ["Headers, Retries"]], cls: f.product ? "path" : "" }];
        chart = boxGraph(nodes, [{ from: "b", to: "p", label: "Build()", toY: 20 }, { from: "b", loop: true, label: "any method, any order" }], { label: "fluent builder", topPad: 30 });
      }
      const fieldsKv = kv("builder fields (mutable)", Object.entries(f.fields).map(([k, v]) => [k, String(v)]), { empty: "nothing set" });
      const callsKv = kv("calls", f.cs.map((c, i) => { const l = f.log[i]; return [`${c.name}(${c.arg})`, l ? l[1] : "·", i === f.cur ? (l && l[2] === "bad" ? "bad" : "active") : l ? l[2] : "dim"]; }));
      const prod = f.product ? kv("product (frozen)", Object.entries(f.product).map(([k, v]) => [k, String(v), "path"])) : kv("product", [], { empty: "not built" });
      return col(`<div class="pt-fit">${chart}</div>`, panels(callsKv, fieldsKv, prod), f.failed ? verdict(f.failed.msg, "bad") : f.final && f.product ? verdict("Built: immutable HttpRequest", "done") : "");
    },
  }));

  /* =====================================================================
   * 4. Prototype: shallow vs deep copy on a real object graph
   * ===================================================================== */
  const PR_MODES = ["shallow (MemberwiseClone / copy.copy)", "shallow + copy the lines list", "deep copy"];
  Viz.register(P + "prototype", (el) => Viz.player(el, {
    title: "Prototype: what a clone shares with the original",
    legend: [["path", "shared by both"], ["visit", "copied (clone's own)"], ["active", "mutated now"], ["bad", "original changed too!"]],
    codeLang: "csharp",
    code: [
      "Order Clone(Order o) {",
      "    var c = (Order)o.MemberwiseClone(); // copies fields; refs copied as refs",
      "    if (copyList) c.Lines = new List<Line>(o.Lines);",
      "    if (deep) { c.Customer = o.Customer.Clone();",
      "                c.Lines = o.Lines.Select(l => l.Clone()).ToList(); }",
      "    return c;",
      "}",
      "var clone = Clone(original);",
      "clone.<path> = value;   // does the original see it?",
    ],
    inputs: [
      { key: "mode", label: "copy depth", type: "select", options: PR_MODES, value: PR_MODES[0] },
      { key: "muts", label: "mutations on the clone", value: "clone.id=2; clone.customer.name=Bob; clone.lines[0].qty=5; clone.lines.push(C)", width: 470 },
    ],
    random: () => {
      const ops = ["clone.id=9", "clone.customer.name=Eve", "clone.lines[0].qty=7", "clone.lines[1].sku=Z", "clone.lines.push(D)", "clone.lines.pop()", "clone.customer=new(Max)"];
      const a = Array.from({ length: Viz.rand(1, 4) }, () => ops[Viz.rand(0, ops.length - 1)]);
      return { mode: PR_MODES[Viz.rand(0, 2)], muts: a.join("; ") };
    },
    build: ({ mode, muts }) => {
      const H = {
        1: { id: 1, type: "Order", f: { id: 1, customer: { ref: 2 }, lines: { ref: 3 } } },
        2: { id: 2, type: "Customer", f: { name: "Ada" } },
        3: { id: 3, type: "List<Line>", f: { items: [{ ref: 4 }, { ref: 5 }] } },
        4: { id: 4, type: "Line", f: { sku: "A", qty: 1 } },
        5: { id: 5, type: "Line", f: { sku: "B", qty: 2 } },
      };
      let nextId = 6;
      const alloc = (type, f) => { const id = nextId++; H[id] = { id, type, f }; return id; };
      const ORIG = 1;
      const steps = String(muts).split(";").map((s) => s.trim()).filter(Boolean);
      if (steps.length > 6) throw new Error("mutations: Too many (6 max).");
      const parsed = steps.map((s) => {
        let m;
        if ((m = s.match(/^clone\.id\s*=\s*(\d{1,6})$/))) return { k: "set", path: [], field: "id", v: Number(m[1]), s };
        if ((m = s.match(/^clone\.customer\.name\s*=\s*(\w{1,10})$/))) return { k: "set", path: ["customer"], field: "name", v: m[1], s };
        if ((m = s.match(/^clone\.customer\s*=\s*new\((\w{1,10})\)$/))) return { k: "newcust", v: m[1], s };
        if ((m = s.match(/^clone\.lines\[(\d)\]\.(qty|sku)\s*=\s*(\w{1,6})$/))) return { k: "set", path: ["lines", Number(m[1])], field: m[2], v: m[2] === "qty" ? Number(m[3]) : m[3], s, bad: m[2] === "qty" && !/^\d+$/.test(m[3]) };
        if ((m = s.match(/^clone\.lines\.push\((\w{1,6})\)$/))) return { k: "push", v: m[1], s };
        if (/^clone\.lines\.pop\(\)$/.test(s)) return { k: "pop", s };
        throw new Error(`mutations: "${s}" is not understood. Use clone.id=N, clone.customer.name=X, clone.customer=new(X), clone.lines[i].qty=N, clone.lines[i].sku=X, clone.lines.push(X), clone.lines.pop().`);
      });
      for (const p of parsed) if (p.bad) throw new Error(`mutations: qty must be a whole number in "${p.s}".`);
      const mi = PR_MODES.indexOf(mode);
      const view = (id) => { const o = H[id]; if (o.type === "Order") return { id: o.f.id, customer: view(o.f.customer.ref), lines: view(o.f.lines.ref) }; if (o.type === "Customer") return { name: o.f.name }; if (o.type === "List<Line>") return o.f.items.map((x) => view(x.ref)); return { sku: o.f.sku, qty: o.f.qty }; };
      const reach = (id, acc = new Set()) => { if (acc.has(id)) return acc; acc.add(id); const o = H[id]; for (const v of Object.values(o.f)) if (v && v.ref) reach(v.ref, acc); if (o.f.items) o.f.items.forEach((x) => reach(x.ref, acc)); return acc; };
      const before = JSON.stringify(view(ORIG));
      const fr = [];
      let clone = null, act = null, hurt = 0, hl = new Set();
      const snap = (o) => fr.push({ H: JSON.parse(JSON.stringify(H)), clone, act, hl: [...hl], ov: view(ORIG), cv: clone ? view(clone) : null, changed: JSON.stringify(view(ORIG)) !== before, hurt, ...o });
      snap({ line: 7, note: `The <b>original</b> is a small object graph: an <code>Order</code> that <i>references</i> a <code>Customer</code> and a list of <code>Line</code>s. A copy has to decide, reference by reference, whether to <b>share</b> or <b>duplicate</b>.`, vars: { objects: 5 } });
      clone = alloc("Order", JSON.parse(JSON.stringify(H[ORIG].f)));
      hl = new Set([clone]);
      snap({ line: 1, note: `<code>MemberwiseClone()</code> / <code>copy.copy()</code> / <code>{...o}</code> copies the <b>fields</b> of one object. <code>id</code> is a value, so it's duplicated. <code>Customer</code> and <code>Lines</code> are references, so only the <i>arrows</i> are copied, and both orders now point at the same objects.`, vars: { new: "#" + clone } });
      if (mi >= 1) {
        const nl = alloc("List<Line>", { items: H[3].f.items.map((x) => ({ ...x })) });
        H[clone].f.lines = { ref: nl };
        hl.add(nl);
        snap({ line: mi === 1 ? 2 : 4, note: `${mi === 1 ? "Copy the <b>list</b>" : "Deep copy starts with the list"}: a new <code>List</code> #${nl}. ${mi === 1 ? "Its slots still point at the <b>same</b> <code>Line</code> objects, so this is one level deeper but still shallow below that." : ""}`, vars: { list: "#" + nl } });
        if (mi === 2) {
          H[nl].f.items = H[nl].f.items.map((x) => { const id = alloc("Line", { ...H[x.ref].f }); hl.add(id); return { ref: id }; });
          const nc = alloc("Customer", { ...H[2].f });
          hl.add(nc);
          H[clone].f.customer = { ref: nc };
          snap({ line: 3, note: `<b>Deep copy</b>: every reachable object gets its own duplicate (Customer #${nc}, Lines #${H[nl].f.items.map((x) => x.ref).join(", #")}). Nothing is shared, so nothing can leak. The cost is time and memory proportional to the whole graph, and cycles need care.`, vars: { objects: Object.keys(H).length } });
        }
      }
      snap({ line: 5, note: `Clone ready. <b>${[...reach(clone)].filter((x) => reach(ORIG).has(x)).length} object(s)</b> are reachable from <i>both</i> roots (shown as shared). Any write through the clone into one of those also shows up in the original.`, vars: { shared: [...reach(clone)].filter((x) => reach(ORIG).has(x)).length } });
      for (const p of parsed) {
        const shared0 = reach(ORIG);
        let target = clone, desc = "";
        if (p.k === "set") {
          if (p.path[0] === "customer") target = H[clone].f.customer.ref;
          if (p.path[0] === "lines") {
            const items = H[H[clone].f.lines.ref].f.items;
            if (p.path[1] >= items.length) { act = null; snap({ line: 8, note: `<code>${esc(p.s)}</code>: index ${p.path[1]} is out of range (the clone has ${items.length} line${items.length === 1 ? "" : "s"}). <b>IndexOutOfRange</b>, so this one is skipped.`, vars: { op: "skip" }, err: true }); continue; }
            target = items[p.path[1]].ref;
          }
          H[target].f[p.field] = p.v;
          desc = `sets <code>${p.field}</code> on ${H[target].type} #${target}`;
        } else if (p.k === "newcust") {
          target = alloc("Customer", { name: p.v });
          H[clone].f.customer = { ref: target };
          desc = `points the clone's <code>customer</code> at a <b>new</b> Customer #${target}. Rebinding a reference never affects the original, even in a shallow copy`;
        } else {
          target = H[clone].f.lines.ref;
          const items = H[target].f.items;
          if (p.k === "push") { if (items.length >= 4) { snap({ line: 8, note: `List full for this demo (4 lines max), skipped.`, vars: { op: "skip" }, err: true }); continue; } items.push({ ref: alloc("Line", { sku: p.v, qty: 1 }) }); desc = `appends to List #${target}`; }
          else { if (!items.length) { snap({ line: 8, note: `<code>pop()</code> on an empty list: skipped.`, vars: { op: "skip" }, err: true }); continue; } items.pop(); desc = `removes the last item from List #${target}`; }
        }
        act = target;
        const leaked = shared0.has(target) && p.k !== "newcust";
        if (leaked) hurt++;
        snap({ line: 8, leaked, note: `<code>${esc(p.s)}</code> ${desc}. ${leaked ? `<b>That object is shared with the original</b>, so <code>original</code> changed too. This is the classic shallow-copy bug: "I edited the copy and the original moved."` : "Only the clone owns that object, so the original is untouched."}`, vars: { target: "#" + target, leaked } });
      }
      act = null;
      const changed = JSON.stringify(view(ORIG)) !== before;
      snap({ line: 8, final: true, note: changed ? `<b>The original changed in ${hurt} place(s)</b> even though you only wrote to the clone. Either copy deeper or make the shared parts <b>immutable</b> (records, frozen objects), because sharing immutable data is free and safe.` : `<b>The original is intact.</b> ${mi === 2 ? "A deep copy guarantees that, at the cost of copying everything." : "These particular writes only touched objects the clone owns. A different write could still leak; try <code>clone.lines[0].qty=5</code>."}`, vars: { originalChanged: changed } });
      return fr;
    },
    render: (f) => {
      const H = f.H, reach = (id, acc = new Set()) => { if (!id || acc.has(id) || !H[id]) return acc; acc.add(id); const o = H[id]; for (const v of Object.values(o.f)) if (v && v.ref) reach(v.ref, acc); if (o.f.items) o.f.items.forEach((x) => reach(x.ref, acc)); return acc; };
      const ro = reach(1), rc = f.clone ? reach(f.clone) : new Set();
      const live = [...new Set([...ro, ...rc])];
      const colX = { Order: 0, Customer: 220, "List<Line>": 220, Line: 430 };
      const place = {};
      const sect = (ids, base) => {
        let lineY = base, maxY = base;
        for (const id of ids.filter((i) => H[i].type === "Order")) { place[id] = base; }
        for (const id of ids.filter((i) => H[i].type === "Customer")) { place[id] = base; maxY = Math.max(maxY, base + 60); }
        for (const id of ids.filter((i) => H[i].type === "List<Line>")) { place[id] = base + 64; maxY = Math.max(maxY, base + 64 + 24 + 6 + H[id].f.items.length * 17); }
        for (const id of ids.filter((i) => H[i].type === "Line")) { place[id] = lineY; lineY += 72; maxY = Math.max(maxY, lineY); }
        return Math.max(maxY, base + 120);
      };
      const top = live.filter((i) => ro.has(i)).sort((a, b) => a - b), bottom = live.filter((i) => !ro.has(i)).sort((a, b) => a - b);
      const h1 = sect(top, 0);
      sect(bottom, h1 + 26);
      const fmtF = (o) => o.type === "Order" ? [[`id = ${o.f.id}`], [`customer → #${o.f.customer.ref}`], [`lines → #${o.f.lines.ref}`]] : o.type === "Customer" ? [[`name = "${o.f.name}"`]] : o.type === "Line" ? [[`sku = "${o.f.sku}"`], [`qty = ${o.f.qty}`]] : o.f.items.map((x, i) => [`[${i}] → #${x.ref}`]);
      const nodes = live.map((id) => {
        const o = H[id], shared = ro.has(id) && rc.has(id);
        let cls = shared ? "path" : f.clone && rc.has(id) && !ro.has(id) ? "visit" : "";
        if (f.hl.includes(id) && !f.act && !f.final) cls = "visit";
        if (id === f.act) cls = f.leaked ? "bad" : "active";
        return { id, x: colX[o.type], y: place[id], w: o.type === "Order" ? 160 : 150, title: `${o.type} #${id}`, rows: fmtF(o), cls, tag: id === 1 ? "original" : id === f.clone ? "clone" : "" };
      });
      const edges = [];
      for (const id of live) {
        const o = H[id];
        if (o.type === "Order") { edges.push({ from: id, row: 1, to: o.f.customer.ref, cls: rc.has(o.f.customer.ref) && ro.has(o.f.customer.ref) && f.clone ? "path" : "" }); edges.push({ from: id, row: 2, to: o.f.lines.ref, cls: rc.has(o.f.lines.ref) && ro.has(o.f.lines.ref) && f.clone ? "path" : "" }); }
        if (o.f.items) o.f.items.forEach((x, i) => edges.push({ from: id, row: i, to: x.ref, cls: rc.has(x.ref) && ro.has(x.ref) && f.clone ? "path" : "" }));
      }
      const g = boxGraph(nodes, edges, { label: "heap object graph", topPad: 14 });
      const js = (v) => JSON.stringify(v).replace(/"(\w+)":/g, "$1: ").replace(/,/g, ", ");
      return col(
        `<div class="pt-fit">${g}</div>`,
        `<div class="pt-json-row"><div class="pt-json ${f.changed ? "bad" : ""}"><span>original${f.changed ? " (changed!)" : ""}</span><code>${esc(js(f.ov))}</code></div><div class="pt-json"><span>clone</span><code>${esc(f.cv ? js(f.cv) : "(not yet cloned)")}</code></div></div>`,
        stats([["objects on heap", live.length], ["shared", [...rc].filter((x) => ro.has(x)).length, "path"], ["leaks into original", f.hurt, f.hurt ? "bad" : "done"]]),
      );
    },
  }));

  /* =====================================================================
   * 5. Singleton: thread interleavings
   * ===================================================================== */
  const SG_IMPL = ["naive (no lock)", "lock every call", "double-checked + volatile", "double-checked, NO volatile", "Lazy<T> / holder idiom"];
  const SG_LBL = { 1: "fast-chk", 2: "lock", 3: "check", 4: "alloc", 5: "ctor", 6: "publish", 8: "unlock", 9: "return" };
  Viz.register(P + "singleton", (el) => Viz.player(el, {
    title: "Lazy singleton under concurrency: you pick the thread schedule",
    legend: [["active", "step just executed"], ["visit", "blocked on the lock"], ["done", "got a good instance"], ["bad", "duplicate or half-built instance"]],
    codeLang: "csharp",
    code: [
      "static Config Get() {",
      "  if (_i != null) return _i;   // fast path (DCL / Lazy)",
      "  lock (_gate) {               // not in naive",
      "    if (_i == null) {",
      "      var t = alloc(Config);   // memory reserved",
      "      t.ctor();                // fields filled",
      "      _i = t;                  // publish",
      "    }",
      "  }                            // unlock",
      "  return _i;",
      "}",
    ],
    inputs: [
      { key: "impl", label: "implementation", type: "select", options: SG_IMPL, value: SG_IMPL[0] },
      { key: "sched", label: "schedule (A–D = which thread runs a step)", value: "ABABAB", width: 170 },
    ],
    random: () => {
      const t = "ABCD".slice(0, Viz.rand(2, 4));
      return { impl: SG_IMPL[Viz.rand(0, 4)], sched: Array.from({ length: Viz.rand(4, 10) }, () => t[Viz.rand(0, t.length - 1)]).join("") };
    },
    build: ({ impl, sched }) => {
      const s = String(sched).toUpperCase().replace(/[\s,]/g, "");
      if (!/^[A-D]{1,16}$/.test(s)) throw new Error("schedule: use 1 to 16 letters A–D, e.g. ABAB (each letter runs one step of that thread).");
      const names = [...new Set(s)].sort();
      if (names.length < 2) throw new Error("schedule: use at least two different threads, e.g. ABAB.");
      const k = SG_IMPL.indexOf(impl);
      const prog = k === 0 ? [3, 4, 5, 6, 9] : k === 1 ? [2, 3, 4, 5, 6, 8, 9] : k === 3 ? [1, 2, 3, 4, 6, 5, 8, 9] : [1, 2, 3, 4, 5, 6, 8, 9];
      const T = Object.fromEntries(names.map((n) => [n, { pc: 0, done: false, got: null, blocked: false, tmp: null, hist: [] }]));
      const objs = [];
      let inst = null, owner = null, ctors = 0, locks = 0, time = 0;
      const fr = [];
      const snap = (o) => fr.push({ names, T: JSON.parse(JSON.stringify(T)), objs: JSON.parse(JSON.stringify(objs)), inst, owner, ctors, locks, time, k, ...o });
      snap({ line: 0, note: `${names.length} threads call <code>Config.Get()</code> at the same moment, and nothing has been created yet. ${k === 0 ? "The naive version checks and creates with <b>no lock</b>." : k === 1 ? "This version takes the lock on <b>every</b> call: correct, but every reader serialises on it." : k === 4 ? "<code>Lazy&lt;T&gt;</code> (ExecutionAndPublication), Java's holder idiom and Go's <code>sync.Once</code> run this same double-checked algorithm, written correctly by the runtime authors." : k === 2 ? "Double-checked locking: a lock-free fast path, then lock and check again. <code>_i</code> is <code>volatile</code>, so the publish can't move before the constructor." : "Double-checked locking <b>without volatile</b>: the compiler or CPU may reorder <i>publish</i> before <i>ctor</i>. Watch the code panel: lines 6 and 5 run in that order."}`, vars: { threads: names.length, instance: "null" } });
      const step = (n, forced) => {
        const t = T[n];
        if (t.done) return snap({ line: 9, who: n, note: `Thread ${n} already returned; the scheduler skips it.`, vars: { thread: n } });
        const ln = prog[t.pc];
        time++;
        if (ln === 2 && owner && owner !== n) {
          t.blocked = true; t.hist.push([time, "wait"]);
          return snap({ line: 2, who: n, note: `Thread ${n} wants the lock, but <b>${owner} holds it</b>, so ${n} blocks. Under contention this is the cost of locking on every call.`, vars: { thread: n, lock: owner } });
        }
        t.blocked = false;
        let note = "", bad = false;
        if (ln === 1) {
          if (inst !== null) {
            const o = objs[inst - 1];
            t.got = { id: inst, ok: o.built }; t.done = true; t.hist.push([time, "fast→#" + inst]);
            bad = !o.built;
            note = bad ? `Thread ${n} sees <code>_i != null</code> and returns it immediately, but <b>Config #${inst}'s constructor hasn't run yet</b>. ${n} now reads default or zero fields. This is the famous broken-DCL bug: rare, timing-dependent and invisible in tests.` : `Fast path: <code>_i</code> is set, so ${n} returns Config #${inst} <b>without touching the lock</b>. After start-up this is the only line that ever runs.`;
            return snap({ line: 1, who: n, bad, note, vars: { thread: n, got: "#" + inst, built: o.built } });
          }
          t.pc++; t.hist.push([time, "fast-chk"]);
          note = `Fast path: <code>_i</code> is null, so ${n} falls through to the lock.`;
        } else if (ln === 2) {
          owner = n; locks++; t.pc++; t.hist.push([time, "lock"]);
          note = `Thread ${n} <b>acquires</b> the lock (acquisition #${locks}).`;
        } else if (ln === 3) {
          if (inst !== null) {
            t.pc = prog.indexOf(k === 0 ? 9 : 8); t.hist.push([time, "check"]);
            note = `${n} re-checks <i>inside</i> the lock and finds Config #${inst} already there, so it skips creation. That second check is why it's called <b>double</b>-checked.`;
          } else { t.pc++; t.hist.push([time, "check"]); note = `${n} checks: <code>_i == null</code>, so it will create one.${k === 0 ? " <b>Nothing stops another thread from seeing null too.</b>" : ""}`; }
        } else if (ln === 4) {
          objs.push({ id: objs.length + 1, built: false, by: n }); t.tmp = objs.length; t.pc++; t.hist.push([time, "alloc#" + t.tmp]);
          note = `${n} allocates memory for Config #${t.tmp}. Its fields are still zero.`;
        } else if (ln === 5) {
          objs[t.tmp - 1].built = true; ctors++; t.pc++; t.hist.push([time, "ctor#" + t.tmp]);
          note = `${n} runs the <b>constructor</b> of Config #${t.tmp} (constructions so far: ${ctors}).${ctors > 1 ? " <b>A second construction: side effects like opening files or connections now happen twice.</b>" : ""}`;
          bad = ctors > 1;
        } else if (ln === 6) {
          const prev = inst; inst = t.tmp; t.pc++; t.hist.push([time, "pub#" + t.tmp]);
          note = `${n} <b>publishes</b> <code>_i = #${t.tmp}</code>.${prev ? ` It overwrote #${prev}: two threads now hold different "singletons".` : ""}${!objs[t.tmp - 1].built ? " <b>Its constructor hasn't run yet</b> (reordered). Any thread on the fast path will see a half-built object." : ""}`;
          bad = !!prev || !objs[t.tmp - 1].built;
        } else if (ln === 8) {
          owner = null; t.pc++; t.hist.push([time, "unlock"]);
          const w = names.filter((x) => T[x].blocked);
          note = `${n} releases the lock.${w.length ? ` ${w.join(", ")} can now proceed.` : ""}`;
        } else if (ln === 9) {
          t.got = { id: inst, ok: objs[inst - 1].built }; t.done = true; t.hist.push([time, "ret#" + inst]);
          note = `${n} returns Config #${inst}.`;
          bad = names.some((x) => T[x].got && T[x].got.id !== inst);
        }
        snap({ line: ln, who: n, bad, forced, note, vars: { thread: n, "_i": inst ? "#" + inst : "null", lock: owner || "free", ctors } });
      };
      for (const n of s) step(n, false);
      let guard = 0, rr = 0;
      if (names.some((n) => !T[n].done)) snap({ line: 0, note: "Your schedule is used up. The scheduler now runs the remaining threads round-robin until every call returns.", vars: { remaining: names.filter((n) => !T[n].done).length } });
      while (names.some((n) => !T[n].done) && guard++ < 80) {
        const n = names[rr++ % names.length];
        if (T[n].done) continue;
        if (prog[T[n].pc] === 2 && owner && owner !== n && names.some((x) => x === owner)) { const o = T[owner]; if (!o.done) { step(owner, true); continue; } }
        step(n, true);
      }
      const ids = new Set(names.map((n) => T[n].got && T[n].got.id));
      const broken = names.filter((n) => T[n].got && !T[n].got.ok);
      snap({ line: 9, final: true, note: ctors > 1 || ids.size > 1 ? `<b>Not a singleton:</b> ${ctors} constructions; threads hold ${[...ids].map((x) => "#" + x).join(" and ")}. The naive check-then-act is a race; it only "works" when the timing is kind.` : broken.length ? `<b>Half-built object returned</b> to ${broken.join(", ")}. Exactly one instance, but some threads saw it before its constructor ran. Fix: <code>volatile</code>, or better, <code>Lazy&lt;T&gt;</code> / holder idiom / <code>sync.Once</code>.` : `<b>Correct:</b> one construction, everyone got Config #${[...ids][0]}, ${locks} lock acquisition${locks === 1 ? "" : "s"}. ${k === 1 ? "But every call took the lock." : "Later calls take the lock-free fast path."} Better still, let the DI container own the single instance.`, vars: { constructions: ctors, locks, distinct: ids.size } });
      return fr;
    },
    render: (f) => {
      const cols = Math.min(16, f.time);
      const start = Math.max(1, f.time - cols + 1);
      const m = f.names.map((n) => Array.from({ length: cols }, (_, c) => { const h = f.T[n].hist.find((x) => x[0] === start + c); return h ? h[1] : ""; }));
      const g = cols ? Viz.grid(m, { rowLabels: f.names.map((n) => "thread " + n), colLabels: Array.from({ length: cols }, (_, c) => "t" + (start + c)), corner: "time →", cls: (r, c, v) => {
        if (!v) return "";
        if (v === "wait") return "visit";
        if (start + c === f.time && f.names[r] === f.who) return f.bad ? "bad" : "active";
        if (/^(ret|fast→)/.test(v)) { const g2 = f.T[f.names[r]].got; return g2 && g2.ok && f.objs.length < 2 ? "done" : g2 && !g2.ok ? "bad" : f.objs.length > 1 ? "bad" : "done"; }
        return "";
      } }) : `<div class="pt-empty">no steps yet</div>`;
      const thr = kv("threads", f.names.map((n) => { const t = f.T[n]; return [n, t.done ? `got #${t.got.id}${t.got.ok ? "" : " (half-built!)"}` : t.blocked ? "blocked on lock" : "running", t.done ? (t.got.ok && f.ctors <= 1 ? "done" : "bad") : t.blocked ? "visit" : n === f.who ? "active" : ""]; }));
      const mem = kv("shared memory", [["_i", f.inst ? `→ Config #${f.inst}` : "null", f.inst ? (f.objs[f.inst - 1].built ? "done" : "bad") : ""], ["lock owner", f.owner || "free", f.owner ? "active" : ""]].concat(f.objs.map((o) => [`Config #${o.id}`, o.built ? `constructed by ${o.by}` : "allocated, ctor NOT run", o.built ? (f.objs.length > 1 ? "bad" : "done") : "bad"])));
      return col(`<div class="pt-fit">${g}</div>`, panels(thr, mem), stats([["constructions", f.ctors, f.ctors > 1 ? "bad" : "done"], ["lock acquisitions", f.locks, "visit"], ["steps", f.time]]));
    },
  }));

  /* =====================================================================
   * 6. Test isolation: static singleton vs DI scopes
   * ===================================================================== */
  const TESTS = {
    T1: { d: "set region=eu, expect EUR", run: (s) => { s.region = "eu"; return [cur(s) === "EUR", `currency=${cur(s)}`]; } },
    T2: { d: "default region, expect USD", run: (s) => [cur(s) === "USD", `currency=${cur(s)}`] },
    T3: { d: "cart.Add(x), expect count 1", run: (s) => { s.cart++; return [s.cart === 1, `count=${s.cart}`]; } },
    T4: { d: "new cart, expect empty", run: (s) => [s.cart === 0, `count=${s.cart}`] },
  };
  function cur(s) { return s.region === "eu" ? "EUR" : "USD"; }
  const TI_MODES = ["static singleton (Settings.Instance)", "DI: fresh container per test", "DI: one container shared by all tests"];
  Viz.register(P + "test-isolation", (el) => Viz.player(el, {
    title: "Why global singletons make tests order-dependent",
    legend: [["done", "passed"], ["bad", "failed"], ["active", "running"], ["visit", "state leaked from an earlier test"]],
    codeLang: "csharp",
    code: [
      "// production code reads shared state",
      "string Currency() => _settings.Region == \"eu\" ? \"EUR\" : \"USD\";",
      "// static: _settings = Settings.Instance   (one per process)",
      "// DI:     _settings injected; the test decides the lifetime",
      "[Fact] void T1() { settings.Region = \"eu\"; Assert.Equal(\"EUR\", Currency()); }",
      "[Fact] void T2() { Assert.Equal(\"USD\", Currency()); }",
      "[Fact] void T3() { cart.Add(x); Assert.Equal(1, cart.Count); }",
      "[Fact] void T4() { Assert.Empty(cart); }",
    ],
    inputs: [
      { key: "mode", label: "where the state lives", type: "select", options: TI_MODES, value: TI_MODES[0] },
      { key: "order", label: "test runner order", value: "T1,T2,T3,T4", width: 160 },
    ],
    random: () => {
      const a = ["T1", "T2", "T3", "T4"].sort(() => Math.random() - 0.5);
      return { mode: TI_MODES[Viz.rand(0, 2)], order: a.slice(0, Viz.rand(2, 4)).join(",") };
    },
    build: ({ mode, order }) => {
      const ts = String(order).toUpperCase().split(/[\s,]+/).filter(Boolean);
      if (!ts.length || ts.length > 6) throw new Error("order: use 1 to 6 test names, e.g. T1,T2,T3.");
      for (const t of ts) if (!TESTS[t]) throw new Error(`order: "${t}" is not a test. Use T1, T2, T3, T4.`);
      const mi = TI_MODES.indexOf(mode), fresh = mi === 1;
      const fr = [], res = [];
      let shared = { region: "us", cart: 0 }, containers = fresh ? 0 : 1;
      const snap = (o) => fr.push({ ts, res: res.slice(), state: { ...shared }, mi, containers, ...o });
      snap({ line: mi === 0 ? 2 : 3, note: mi === 0 ? "<code>Settings.Instance</code> and <code>Cart.Instance</code> are <b>static</b>: one copy per process. Every test in the run shares them." : fresh ? "Each test builds its <b>own</b> container (or uses <code>new</code> plus fakes), so singletons are singletons <i>per test</i>." : "One container, built once and shared by the whole test class/assembly (a static <code>ServiceProvider</code> or class fixture). Its singletons behave exactly like statics.", vars: { tests: ts.length } });
      ts.forEach((t, i) => {
        if (fresh) { shared = { region: "us", cart: 0 }; containers++; }
        const before = { ...shared };
        const dirty = before.region !== "us" || before.cart !== 0;
        snap({ line: 4 + Number(t[1]) - 1, cur: i, dirty, note: `Run <b>${t}</b> (${TESTS[t].d}). ${fresh ? `Fresh container #${containers}: clean state.` : dirty ? `<b>It starts with leftovers</b> from earlier tests: region=${before.region}, cart=${before.cart}.` : "State is still clean, so far."}`, vars: { test: t, region: before.region, cart: before.cart } });
        const [ok, got] = TESTS[t].run(shared);
        res.push({ t, ok, got, dirty });
        snap({ line: 4 + Number(t[1]) - 1, cur: i, note: `${t} ${ok ? "<b>passes</b>" : "<b>fails</b>"} (${got}). ${!ok && dirty ? "The test is correct; it failed because <i>another</i> test changed shared state. Run it alone and it passes, the definition of a flaky, order-dependent suite." : ok && dirty ? "It passed, but only because the leftovers happened not to matter." : ""}`, vars: { test: t, result: ok ? "pass" : "FAIL", region: shared.region, cart: shared.cart } });
      });
      const fails = res.filter((r) => !r.ok).length;
      snap({ line: 1, final: true, note: fails ? `<b>${fails} of ${ts.length} failed</b> because of shared state, not bugs. Try the same order with <i>fresh container per test</i>: same production code, all green. That's the testability argument against static singletons: DI lets the <b>test</b> decide what "one instance" means.` : `<b>All ${ts.length} passed.</b> ${fresh ? "Every test owned its state, so any order and any parallelism works." : "This time. Reorder the tests (e.g. T1 before T2, or T3 before T4) and watch it break."}`, vars: { passed: ts.length - fails, failed: fails } });
      return fr;
    },
    render: (f) => {
      const g = Viz.grid([f.ts, f.ts.map((t, i) => (f.res[i] ? (f.res[i].ok ? "pass" : "FAIL") : "")), f.ts.map((t, i) => (f.res[i] ? f.res[i].got : ""))], {
        rowLabels: ["test", "result", "observed"], cls: (r, c) => (c === f.cur && !f.res[c] ? "active" : f.res[c] ? (r === 0 && f.res[c].dirty ? "visit" : f.res[c].ok ? "done" : "bad") : ""),
      });
      const st = kv(f.mi === 1 ? "this test's container" : f.mi === 0 ? "static state (process-wide)" : "shared container", [["Settings.Region", f.state.region, f.state.region !== "us" ? "visit" : ""], ["Cart.Count", String(f.state.cart), f.state.cart ? "visit" : ""]]);
      const passed = f.res.filter((r) => r.ok).length;
      return col(`<div class="pt-fit">${g}</div>`, panels(st, kv("lifetime model", [["mode", ["static", "per-test DI", "shared DI"][f.mi]], ["containers built", String(f.containers)]])), stats([["passed", passed, "done"], ["failed", f.res.length - passed, f.res.length - passed ? "bad" : ""]]));
    },
  }));

  /* =====================================================================
   * 7. Object pool: rent, return, reset, misuse
   * ===================================================================== */
  Viz.register(P + "pool", (el) => Viz.player(el, {
    title: "Object pool: reuse instead of allocate, and the bugs that come with it",
    legend: [["active", "rented / in use"], ["done", "idle in the pool"], ["bad", "misuse or leaked data"], ["visit", "dropped (pool full) → GC"]],
    codeLang: "csharp",
    code: [
      "var buf = pool.Rent();          // reuse if idle, else allocate",
      "try {",
      "    Fill(buf, secret);          // use it",
      "} finally {",
      "    pool.Return(buf);           // reset? then keep or drop",
      "}",
      "// misuse: Return twice, or touch buf after Return",
    ],
    inputs: [
      { key: "ops", label: "ops (+x rent, *x write, -x return)", value: "+a *a -a +b -b +c *c -c -c +d +e", width: 300 },
      { key: "max", label: "max retained", value: "2", width: 70 },
      { key: "reset", label: "on return", type: "select", options: ["clear the buffer", "no reset (fast, risky)"], value: "no reset (fast, risky)" },
    ],
    random: () => {
      const ns = "abcde";
      const a = [];
      const held = new Set();
      for (let i = Viz.rand(5, 10); i > 0; i--) {
        const n = ns[Viz.rand(0, 4)];
        if (!held.has(n) || Math.random() < 0.15) { a.push("+" + n); held.add(n); }
        else if (Math.random() < 0.5) a.push("*" + n);
        else { a.push("-" + n); if (Math.random() < 0.8) held.delete(n); }
      }
      return { ops: a.join(" "), max: String(Viz.rand(1, 3)), reset: Math.random() < 0.5 ? "clear the buffer" : "no reset (fast, risky)" };
    },
    build: ({ ops, max, reset }) => {
      const mx = Viz.parse.int(max, 0, 4);
      const os = String(ops).trim().split(/\s+/).filter(Boolean);
      if (!os.length || os.length > 14) throw new Error("ops: use 1 to 14 operations like +a *a -a.");
      for (const o of os) if (!/^[+*-][a-z]$/.test(o)) throw new Error(`ops: "${o}" is not valid. Use +x (rent), *x (write), -x (return), where x is one letter.`);
      const clear = reset === "clear the buffer";
      const B = [], idle = [], held = {}, returned = {};
      let allocs = 0, reuses = 0, dropped = 0, misuse = 0, leaks = 0, rents = 0;
      const fr = [];
      const snap = (o) => fr.push({ B: JSON.parse(JSON.stringify(B)), idle: idle.slice(), held: { ...held }, allocs, reuses, dropped, misuse, leaks, rents, mx, ...o });
      snap({ line: 0, note: `A pool keeps up to <b>${mx}</b> idle buffer${mx === 1 ? "" : "s"} for reuse. ${clear ? "Returned buffers are <b>cleared</b> first." : "Returned buffers are <b>not</b> cleared (that's what <code>ArrayPool.Return(buf)</code> does by default)."}`, vars: { max: mx, reset: clear } });
      for (const o of os) {
        const op = o[0], n = o[1];
        if (op === "+") {
          if (held[n]) { misuse++; snap({ line: 0, cur: o, bad: held[n], note: `<code>${n}</code> already holds Buffer #${held[n]} and rents another without returning the first: <b>the first one leaks</b> from the pool's point of view.`, vars: { op: o } }); }
          rents++;
          let id;
          if (idle.length) {
            id = idle.pop(); reuses++;
            const stale = B[id - 1].data;
            held[n] = id; B[id - 1].owner = n; delete returned[n];
            if (stale) { leaks++; snap({ line: 0, cur: o, bad: id, note: `<code>${n}</code> rents Buffer #${id} from the pool and <b>finds "${stale}" still inside</b>. Without a reset, data from the previous renter leaks to the next one. Fine for scratch bytes you fully overwrite; a security bug for tokens or PII.`, vars: { op: o, buffer: "#" + id, reused: true } }); }
            else snap({ line: 0, cur: o, act: id, note: `<code>${n}</code> rents Buffer #${id}: <b>reused</b>, no allocation.`, vars: { op: o, buffer: "#" + id, reused: true } });
          } else {
            B.push({ id: B.length + 1, owner: n, data: "", state: "use" }); id = B.length; allocs++;
            held[n] = id; delete returned[n];
            snap({ line: 0, cur: o, act: id, note: `Pool is empty, so <code>${n}</code> gets a <b>newly allocated</b> Buffer #${id} (allocations: ${allocs}).`, vars: { op: o, buffer: "#" + id, reused: false } });
          }
          B[id - 1].state = "use";
        } else if (op === "*") {
          if (held[n]) { B[held[n] - 1].data = `${n}'s secret`; snap({ line: 2, cur: o, act: held[n], note: `<code>${n}</code> writes "${n}'s secret" into Buffer #${held[n]}.`, vars: { op: o, buffer: "#" + held[n] } }); }
          else if (returned[n]) {
            misuse++; const id = returned[n]; B[id - 1].data = `${n}'s secret`;
            snap({ line: 6, cur: o, bad: id, note: `<b>Use after return.</b> <code>${n}</code> gave Buffer #${id} back but kept the reference and writes to it. ${B[id - 1].owner && B[id - 1].owner !== n && B[id - 1].state === "use" ? `<b>${B[id - 1].owner} is using that buffer right now</b>, so its data is corrupted.` : "The next renter inherits this write."} A GC'd language won't catch this; the object is perfectly alive.`, vars: { op: o, buffer: "#" + id } });
          } else snap({ line: 2, cur: o, note: `<code>${n}</code> holds no buffer, so there's nothing to write. Skipped.`, vars: { op: o } });
        } else {
          if (!held[n]) {
            if (returned[n]) {
              misuse++; const id = returned[n];
              const inPool = idle.includes(id);
              if (inPool && idle.length < mx) idle.push(id);
              snap({ line: 6, cur: o, bad: id, note: `<b>Double return</b> of Buffer #${id}. ${inPool ? "It's now in the idle list <b>twice</b>, so the next two renters get the <i>same</i> buffer and overwrite each other." : "Someone else may be using it already."} Pools rarely detect this; set your reference to null after returning.`, vars: { op: o, buffer: "#" + id } });
            } else snap({ line: 4, cur: o, note: `<code>${n}</code> has nothing to return. Skipped.`, vars: { op: o } });
            continue;
          }
          const id = held[n]; delete held[n]; returned[n] = id;
          if (clear) B[id - 1].data = "";
          if (idle.length < mx) { idle.push(id); B[id - 1].state = "idle"; B[id - 1].owner = ""; snap({ line: 4, cur: o, idleNow: id, note: `<code>${n}</code> returns Buffer #${id}${clear ? " (cleared)" : " <b>with its contents intact</b>"}; it goes back to the idle list (${idle.length}/${mx}).`, vars: { op: o, idle: idle.length } }); }
          else { dropped++; B[id - 1].state = "gone"; B[id - 1].owner = ""; snap({ line: 4, cur: o, drop: id, note: `Pool already holds ${mx} idle buffer${mx === 1 ? "" : "s"}, so Buffer #${id} is <b>dropped</b> for the GC to collect. Bounded retention stops a burst from pinning memory forever.`, vars: { op: o, dropped } }); }
        }
      }
      snap({ line: 4, final: true, note: `<b>${rents} rents → ${allocs} allocations</b> (without a pool: ${rents}). ${misuse || leaks ? `<b>${misuse + leaks} problem(s)</b>: ${leaks ? `${leaks} stale-data leak${leaks > 1 ? "s" : ""}` : ""}${leaks && misuse ? ", " : ""}${misuse ? `${misuse} misuse${misuse > 1 ? "s" : ""}` : ""}. Pools trade allocation cost for <b>ownership discipline</b>; only pay that when a profiler shows allocation is the bottleneck.` : "Clean run. Pools pay off for large buffers or expensive resources (connections), not for small short-lived objects the GC handles cheaply."}`, vars: { rents, allocations: allocs, saved: rents - allocs } });
      return fr;
    },
    render: (f) => {
      const bufs = f.B.map((b) => [`Buffer #${b.id}`, `${b.state === "use" ? "in use by " + b.owner : b.state === "idle" ? "idle in pool" : "dropped → GC"}${b.data ? ` · "${b.data}"` : ""}`, b.id === f.bad ? "bad" : b.id === f.act ? "active" : b.id === f.drop ? "visit" : b.state === "use" ? "active" : b.state === "idle" ? "done" : "dim"]);
      const idle = Viz.array(f.idle.length ? f.idle.map((x) => "#" + x) : [], { label: `idle list (${f.idle.length}/${f.mx})`, cls: (i) => (f.idle[i] === f.idleNow ? "done" : f.idle.filter((x) => x === f.idle[i]).length > 1 ? "bad" : "") });
      const holders = kv("renters", Object.entries(f.held).map(([n, id]) => [n, "Buffer #" + id, "active"]), { empty: "nobody holds a buffer" });
      return col(panels(kv("buffers ever allocated", bufs, { empty: "none yet" }), col(idle, holders)), stats([["rents", f.rents], ["allocations", f.allocs, "active"], ["reused", f.reuses, "done"], ["dropped", f.dropped, "visit"], ["misuse / leaks", f.misuse + f.leaks, f.misuse + f.leaks ? "bad" : ""]]));
    },
  }));

  /* =====================================================================
   * 8. Which creational pattern? decision tree
   * ===================================================================== */
  const DT = {
    q1: { x: 442, y: 10, w: 270, t: "What are you creating?", s: "behaviour + deps, or data" },
    q2: { x: 262, y: 84, w: 200, t: "One instance for the app?", s: "stateless / shared state" },
    q3: { x: 262, y: 152, w: 200, t: "Type chosen at runtime?", s: "config, user input, tenant" },
    q4: { x: 262, y: 220, w: 200, t: "A family that must match?", s: "conn + cmd + param" },
    q5: { x: 622, y: 84, w: 200, t: "Copy a configured template?", s: "tweak a few fields" },
    q6: { x: 622, y: 152, w: 200, t: "Measured: hot + costly?", s: "allocation shows in profiler" },
    q7: { x: 622, y: 220, w: 200, t: "Many optional parts / steps?", s: "> 3–4 params, invariants" },
    q8: { x: 622, y: 288, w: 200, t: "Named args or records?", s: "C#, Kotlin, Python, TS objects" },
    sg: { x: 72, y: 84, w: 132, t: "DI singleton", s: "AddSingleton", leaf: 1 },
    ci: { x: 72, y: 152, w: 132, t: "Constructor injection", s: "just ask for it", leaf: 1 },
    af: { x: 72, y: 220, w: 132, t: "Abstract Factory", s: "inject the family", leaf: 1 },
    fm: { x: 262, y: 288, w: 200, t: "Factory / keyed service", s: "Func<key,T>, registry", leaf: 1 },
    pr: { x: 806, y: 84, w: 128, t: "Prototype", s: "clone / with", leaf: 1 },
    po: { x: 806, y: 152, w: 128, t: "Object pool", s: "bounded, reset", leaf: 1 },
    ct: { x: 806, y: 220, w: 128, t: "new / NewX()", s: "static factory", leaf: 1 },
    na: { x: 806, y: 288, w: 128, t: "Named args", s: "record + with", leaf: 1 },
    bu: { x: 622, y: 356, w: 200, t: "Builder", s: "fluent, or functional options", leaf: 1 },
  };
  const DT_E = [["q1", "q2", "service"], ["q1", "q5", "data"], ["q2", "sg", "yes"], ["q2", "q3", "no"], ["q3", "ci", "no"], ["q3", "q4", "yes"], ["q4", "af", "yes"], ["q4", "fm", "no"],
    ["q5", "pr", "yes"], ["q5", "q6", "no"], ["q6", "po", "yes"], ["q6", "q7", "no"], ["q7", "ct", "no"], ["q7", "q8", "yes"], ["q8", "na", "yes"], ["q8", "bu", "no"]];
  const DH = 44;
  function dtSvg(cls, ecls) {
    const arrow = (x1, y1, x2, y2, c) => {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      return `<path class="edge ${c}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${c ? "fill-" + c : "pt-mk"}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
    };
    let s = '<svg class="dg pt-tree" viewBox="0 0 880 410" width="880" role="img" aria-label="Decision tree: which creational pattern?">';
    for (const [a, b, lab] of DT_E) {
      const A = DT[a], B = DT[b], c = ecls[`${a}-${b}`] || "";
      let x1, y1, x2, y2, lx, ly, an = "middle";
      if (B.y === A.y) { const d = Math.sign(B.x - A.x); x1 = A.x + d * A.w / 2; y1 = A.y + DH / 2; x2 = B.x - d * B.w / 2; y2 = y1; lx = (x1 + x2) / 2; ly = y1 - 5; }
      else if (a === "q1") { x1 = A.x + (B.x < A.x ? -60 : 60); y1 = A.y + DH; x2 = B.x; y2 = B.y; lx = (x1 + x2) / 2; ly = (y1 + y2) / 2 - 2; an = B.x < A.x ? "end" : "start"; }
      else { x1 = A.x; y1 = A.y + DH; x2 = B.x; y2 = B.y; lx = x1 + 7; ly = (y1 + y2) / 2 + 4; an = "start"; }
      s += arrow(x1, y1, x2, y2, c) + `<text class="small ${c ? "" : "muted"}" x="${lx}" y="${ly}" text-anchor="${an}">${lab}</text>`;
    }
    for (const [id, n] of Object.entries(DT)) {
      s += `<rect class="box ${cls[id] || ""}" x="${n.x - n.w / 2}" y="${n.y}" width="${n.w}" height="${DH}" rx="8"/>`;
      s += `<text class="pt-t" x="${n.x}" y="${n.y + 18}" text-anchor="middle">${esc(n.t)}</text><text class="pt-s" x="${n.x}" y="${n.y + 34}" text-anchor="middle">${esc(n.s)}</text>`;
    }
    return s + "</svg>";
  }
  const DQ = {
    kind: ["a service (behaviour, dependencies)", "a data object / value"],
    one: ["one per use or request", "one shared instance is fine"],
    rt: ["fixed at startup", "chosen per call (key, config, input)"],
    fam: ["independent product", "a family that must match"],
    tpl: ["no template", "yes, copy a configured prototype"],
    hot: ["no, or not measured", "yes, profiler says allocation hurts"],
    opt: ["few required values", "many optional parts or steps"],
    named: ["named args / records available", "no named args (Java, Go)"],
  };
  const LEAF_NOTE = {
    sg: "<b>Register it as a singleton in the container</b> (<code>AddSingleton</code>, Spring's default scope, a module-level instance in Python, a value built once in <code>main</code> in Go). You get one instance without a static <code>Instance</code> property, so tests can still swap it.",
    ci: "<b>No pattern needed.</b> The type is known at composition time, so declare it as a constructor parameter and let the composition root wire it. Most \"factories\" in business code should be this.",
    af: "<b>Abstract Factory.</b> Inject one object that creates every member of the family (<code>DbProviderFactory</code>, a UI-theme factory, a cloud-provider SDK factory) so the members can't be mixed.",
    fm: "<b>Factory or keyed services.</b> Inject <code>Func&lt;string, INotifier&gt;</code>, <code>IServiceProvider.GetKeyedService</code>, a registry map, or a factory interface. The decision lives in one place, and adding a kind means adding one registration.",
    pr: "<b>Prototype.</b> Copy a preconfigured instance and change what differs: record <code>with</code>, <code>dataclasses.replace</code>, <code>structuredClone</code>, or a hand-written copy constructor. Decide <i>deep or shallow</i> per field, or make the shared parts immutable.",
    po: "<b>Object pool</b>, but only for things that are genuinely expensive (connections, large buffers): <code>ArrayPool&lt;T&gt;</code>, <code>ObjectPool&lt;T&gt;</code>, HikariCP, <code>sync.Pool</code>. Bound it, reset on return, and measure again afterwards.",
    ct: "<b>Plain constructor or a static factory function</b> (<code>NewClient(...)</code>, <code>Money.Of(10, \"EUR\")</code>, <code>TimeSpan.FromSeconds</code>). A named function can validate, cache and return a subtype; that's usually all the \"pattern\" you need.",
    na: "<b>Named/optional arguments or a record with <code>with</code>.</b> In C#, Kotlin, Python and TS (options objects) the language already is the builder. A builder class here is ceremony.",
    bu: "<b>Builder.</b> Java and Go lack named args, so a fluent builder (Java) or functional options (Go: <code>NewServer(addr, WithTimeout(5*time.Second))</code>) gives readable construction with validation in one place.",
  };
  Viz.register(P + "decide", (el) => Viz.player(el, {
    title: "Which creational pattern? Answer for your case",
    legend: [["active", "question being asked"], ["path", "answered, keep going"], ["done", "use this"]],
    codeLang: "python",
    code: [
      "if creating_a_service:",
      "    if one_shared_instance: return DI_SINGLETON",
      "    if not chosen_at_runtime: return CONSTRUCTOR_INJECTION",
      "    return ABSTRACT_FACTORY if family else FACTORY_OR_KEYED",
      "if copy_of_template: return PROTOTYPE",
      "if measured_hot_and_costly: return OBJECT_POOL",
      "if not many_optional_parts: return NEW_OR_STATIC_FACTORY",
      "return NAMED_ARGS if language_has_them else BUILDER",
    ],
    inputs: Object.entries(DQ).map(([k, o]) => ({ key: k, label: { kind: "creating", one: "how many", rt: "concrete type", fam: "products", tpl: "template", hot: "hot path", opt: "parameters", named: "language" }[k], type: "select", options: o, value: k === "rt" ? o[1] : o[0] })),
    random: () => Object.fromEntries(Object.entries(DQ).map(([k, o]) => [k, o[Viz.rand(0, 1)]])),
    build: (inp) => {
      for (const [k, o] of Object.entries(DQ)) if (!o.includes(inp[k])) throw new Error(`Pick one of the listed answers for "${k}".`);
      const yes = (k) => inp[k] === DQ[k][1];
      const fr = [], cls = {}, ecls = {};
      const snap = (o) => fr.push({ cls: { ...cls }, ecls: { ...ecls }, ...o });
      const ask = (id, line, note, vars) => { cls[id] = "active"; snap({ line, note, vars }); cls[id] = "path"; };
      const go = (a, b) => { ecls[`${a}-${b}`] = "path"; };
      const end = (a, b, line) => { ecls[`${a}-${b}`] = "done"; cls[b] = "done"; snap({ line, final: true, leaf: b, note: LEAF_NOTE[b], vars: { answer: DT[b].t } }); return fr; };
      const svc = !yes("kind");
      ask("q1", 0, "Start with the most important split. <b>Services</b> (things with behaviour and dependencies: repositories, clients, handlers) are created by your <b>DI container</b>. <b>Data</b> (orders, requests, configs, DTOs) is created by your code, often many times per request.", { creating: svc ? "service" : "data" });
      if (svc) {
        go("q1", "q2");
        ask("q2", 1, yes("one") ? "One shared instance is fine: it's stateless or its shared state is thread-safe (HTTP client handler, cache, clock)." : "Each use needs its own instance (per request or per operation).", { shared: yes("one") });
        if (yes("one")) return end("q2", "sg", 1);
        go("q2", "q3");
        ask("q3", 2, yes("rt") ? "The concrete class depends on something only known at runtime: a tenant, a message type, a user's choice." : "The implementation is fixed once the app starts (config is read at startup).", { runtime: yes("rt") });
        if (!yes("rt")) return end("q3", "ci", 2);
        go("q3", "q4");
        ask("q4", 3, yes("fam") ? "Several products must come from the same family, or they won't work together." : "Each product stands alone.", { family: yes("fam") });
        return yes("fam") ? end("q4", "af", 3) : end("q4", "fm", 3);
      }
      go("q1", "q5");
      ask("q5", 4, yes("tpl") ? "You have a configured exemplar (a default request, a game unit, a document template) and want variations of it." : "No template; each value is built from scratch.", { template: yes("tpl") });
      if (yes("tpl")) return end("q5", "pr", 4);
      go("q5", "q6");
      ask("q6", 5, yes("hot") ? "A profiler shows creation cost or GC pressure on a hot path, for something large or expensive." : "Not measured, or the objects are small. Modern GCs make short-lived small objects nearly free, so don't pool on a hunch.", { hot: yes("hot") });
      if (yes("hot")) return end("q6", "po", 5);
      go("q6", "q7");
      ask("q7", 6, yes("opt") ? "Many optional values, or construction has to happen in steps with invariants checked at the end." : "A handful of required values: a constructor says it all.", { optional: yes("opt") });
      if (!yes("opt")) return end("q7", "ct", 6);
      go("q7", "q8");
      ask("q8", 7, !yes("named") ? "Your language has named/optional arguments, object initialisers or records." : "No named arguments, so a long positional parameter list would be unreadable and error-prone.", { named: !yes("named") });
      return !yes("named") ? end("q8", "na", 7) : end("q8", "bu", 7);
    },
    render: (f) => `<div class="pt-fit">${dtSvg(f.cls, f.ecls)}</div>${f.final ? verdict("→ " + DT[f.leaf].t, "done") : ""}`,
  }));
})();
