/* Visualizers for "Configuration, Feature Flags & Secrets". Frames come from simulations run in build(). */
(() => {
  const esc = (s) => Viz.esc(s);
  const rng = (seed) => {
    let a = (Number(seed) >>> 0) || 1;
    return () => {
      a = (a + 0x6d2b79f5) >>> 0;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  };
  const num = (s, label, lo, hi, int = true) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isFinite(n) || n < lo || n > hi || (int && !Number.isInteger(n))) throw new Error(`${label} must be ${int ? "a whole number" : "a number"} from ${lo} to ${hi}.`);
    return n;
  };
  /* FNV-1a 32-bit: the kind of stable hash flag SDKs use to put a user in a bucket. */
  const fnv = (s) => {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h >>> 0;
  };
  const bucketOf = (flag, user) => (fnv(`${flag}:${user}`) % 10000) / 100;
  const seedInput = { key: "seed", label: "seed", value: "7", width: 70 };
  const randSeed = () => String(Viz.rand(1, 9999));
  const badge = (t, c) => `<span class="cfg-badge ${c || ""}">${esc(t)}</span>`;
  const trunc = (s, n) => (String(s).length > n ? `${String(s).slice(0, n - 1)}…` : String(s));
  const pick = (r, arr) => arr[Math.floor(r() * arr.length)];

  /* =====================================================================
   * 1. The override stack: which layer wins for each key?
   * ===================================================================== */
  const L_KEYS = ["Logging:LogLevel:Default", "ConnectionStrings:Orders", "Db:TimeoutSeconds", "Pricing:BatchLookups", "Payments:ApiKey", "Urls"];
  const L_ENVFILE = {
    Development: { "Logging:LogLevel:Default": "Debug", "ConnectionStrings:Orders": "Server=localhost;Database=orders_dev" },
    Staging: { "ConnectionStrings:Orders": "Server=sql-stg;Database=orders;Authentication=Active Directory Default" },
    Production: { "ConnectionStrings:Orders": "Server=sql-prod;Database=orders;Authentication=Active Directory Default" },
  };
  const canon = (k) => L_KEYS.find((x) => x.toLowerCase() === k.toLowerCase()) || k;
  const parseEnv = (s) => {
    const vals = {}, raw = {}, unknown = [];
    for (const part of String(s).split(";").map((x) => x.trim()).filter(Boolean)) {
      const m = /^([A-Za-z_][A-Za-z0-9_]{0,59})=(.{0,80})$/.exec(part);
      if (!m) throw new Error(`Environment variable "${trunc(part, 40)}" must look like NAME=value (letters, digits, underscores), separated by semicolons.`);
      const key = canon(m[1].replace(/__/g, ":"));
      vals[key] = m[2]; raw[key] = m[1];
      if (!L_KEYS.includes(key)) unknown.push(m[1]);
    }
    if (Object.keys(vals).length > 6) throw new Error("Use at most 6 environment variables.");
    return { vals, raw, unknown };
  };
  const parseCli = (s) => {
    const vals = {}, unknown = [];
    for (const tok of String(s).trim().split(/\s+/).filter(Boolean)) {
      const m = /^(?:--|\/)([A-Za-z][A-Za-z0-9_:.]{0,59})=(\S{0,80})$/.exec(tok);
      if (!m) throw new Error(`Command-line argument "${trunc(tok, 40)}" must look like --Key=value (use : or __ between sections).`);
      const key = canon(m[1].replace(/__/g, ":"));
      vals[key] = m[2];
      if (!L_KEYS.includes(key)) unknown.push(m[1]);
    }
    if (Object.keys(vals).length > 6) throw new Error("Use at most 6 command-line arguments.");
    return { vals, unknown };
  };
  const layersFor = (env, E, C) => {
    const L = [
      { id: "defaults", name: "code defaults", short: "defaults", line: 7, vals: { "Logging:LogLevel:Default": "Information", "Db:TimeoutSeconds": "30", "Pricing:BatchLookups": "true" } },
      { id: "json", name: "appsettings.json", short: "json", line: 1, vals: { "Logging:LogLevel:Default": "Warning", "ConnectionStrings:Orders": "Server=localhost;Database=orders", Urls: "http://+:8080" } },
      { id: "envjson", name: `appsettings.${env}.json`, short: `${env.slice(0, 4).toLowerCase()}.json`, line: 1, vals: L_ENVFILE[env] },
    ];
    if (env === "Development") L.push({ id: "user", name: "user secrets (Development only)", short: "user secrets", line: 2, vals: { "Payments:ApiKey": "dev-sandbox-key" } });
    L.push({ id: "env", name: "environment variables", short: "env vars", line: 3, vals: E.vals });
    L.push({ id: "cli", name: "command-line arguments", short: "args", line: 4, vals: C.vals });
    if (env !== "Development") L.push({ id: "kv", name: "Key Vault (secret store)", short: "Key Vault", line: 5, vals: { "Payments:ApiKey": "•••••• (secret Payments--ApiKey)" } });
    return L;
  };

  Viz.register("configuration-and-secrets-layers", (el) => Viz.player(el, {
    title: "The override stack: later layers win, key by key",
    tag: "EDIT THE LAYERS · STEP THROUGH",
    legend: [["active", "set by the layer being applied"], ["done", "winning value"], ["dim", "overridden by a later layer"], ["bad", "key nobody reads"]],
    codeLang: "csharp",
    code: [
      "var builder = WebApplication.CreateBuilder(args);",
      "// 1-2  appsettings.json, then appsettings.{Environment}.json",
      "// 3    user secrets (only when Environment == Development)",
      "// 4    environment variables: DB__TIMEOUTSECONDS -> Db:TimeoutSeconds",
      "// 5    command line: --Urls=http://+:9090",
      "builder.Configuration.AddAzureKeyVault(vaultUri, new DefaultAzureCredential());",
      "var opts = builder.Configuration.GetSection(\"Db\").Get<DbOptions>();",
      "public sealed class DbOptions { public int TimeoutSeconds { get; set; } = 30; }",
    ],
    inputs: [
      { key: "env", label: "environment", type: "select", value: "Production", options: ["Development", "Staging", "Production"] },
      { key: "ev", label: "environment variables (NAME=value; ...)", value: "DB__TIMEOUTSECONDS=15; PRICING_BATCHLOOKUPS=false", width: 330 },
      { key: "cli", label: "command line", value: "--Urls=http://+:9090", width: 200 },
    ],
    random: () => {
      const r = Math.random;
      const env = pick(r, ["Development", "Staging", "Production"]);
      const evs = [
        "DB__TIMEOUTSECONDS=15; PRICING_BATCHLOOKUPS=false",
        "PRICING__BATCHLOOKUPS=false",
        "LOGGING__LOGLEVEL__DEFAULT=Debug; DB__TIMEOUTSECONDS=5",
        "PAYMENTS__APIKEY=pasted-in-a-hurry; URLS=http://+:7000",
        "Db:TimeoutSeconds=20",
      ];
      const ev = pick(r, evs.filter((x) => !x.includes(":")));
      return { env, ev, cli: pick(r, ["--Urls=http://+:9090", "--Db:TimeoutSeconds=60", "--Pricing:BatchLookups=true --Urls=http://+:5000", ""]) };
    },
    build: ({ env, ev, cli }) => {
      if (!L_ENVFILE[env]) throw new Error("Pick Development, Staging or Production.");
      const E = parseEnv(ev), C = parseCli(cli);
      const layers = layersFor(env, E, C);
      const eff = {}, fr = [];
      const keys = [...new Set([...L_KEYS, ...Object.keys(E.vals), ...Object.keys(C.vals)])];
      const unknown = new Set([...E.unknown.map((n) => canon(n.replace(/__/g, ":"))), ...C.unknown.map((n) => canon(n.replace(/__/g, ":")))]);
      const snap = (cur) => ({ layers, keys, cur, unknown: [...unknown], eff: Object.fromEntries(Object.entries(eff).map(([k, v]) => [k, { ...v }])) });
      fr.push({ ...snap(-1), line: 0, note: `Environment <b>${env}</b>: ${layers.length} configuration sources, applied bottom to top. Each one can set any key; for every key, the <b>last</b> source that sets it wins. Nothing is merged inside a value.`, vars: { environment: env, sources: layers.length } });
      layers.forEach((L, i) => {
        const set = Object.keys(L.vals);
        const over = set.filter((k) => eff[k]);
        const parts = set.map((k) => (eff[k] ? `<code>${esc(k)}</code> ${esc(trunc(eff[k].v, 22))} → <b>${esc(trunc(L.vals[k], 22))}</b>` : `<code>${esc(k)}</code> = ${esc(trunc(L.vals[k], 26))}`));
        for (const k of set) eff[k] = { v: L.vals[k], from: i };
        let note = `Source ${i + 1}, <b>${esc(L.name)}</b>: `;
        note += set.length ? `sets ${set.length} key${set.length > 1 ? "s" : ""}, ${over.length} of them overriding a lower source. ${parts.join("; ")}.` : "sets nothing in this run.";
        if (L.id === "env" && E.unknown.length) note += ` <b>${esc(E.unknown.join(", "))}</b> maps to no setting: only a <b>double</b> underscore means "section separator", so nothing ever reads it and the old value silently stays.`;
        if (L.id === "env" && E.vals["Payments:ApiKey"]) note += " A secret in a plain environment variable shows up in process listings, crash dumps and 'print env' debug pages.";
        if (L.id === "cli" && C.unknown.length) note += ` <b>${esc(C.unknown.join(", "))}</b> matches no setting.`;
        if (L.id === "kv") note += " The secret store is added last, so a secret can never be shadowed by a stale value in a file.";
        fr.push({ ...snap(i), line: L.line, note, vars: { source: L.short, "keys set": set.length, overrides: over.length } });
      });
      const counts = layers.map((L, i) => [L.short, Object.values(eff).filter((v) => v.from === i).length]).filter(([, n]) => n);
      const key = eff["Payments:ApiKey"];
      let fin = `Effective configuration: ${counts.map(([n, c]) => `${c} from ${esc(n)}`).join(", ")}. `;
      fin += `<code>Db:TimeoutSeconds</code> = <b>${esc(eff["Db:TimeoutSeconds"].v)}</b> (from ${esc(layers[eff["Db:TimeoutSeconds"].from].name)}). `;
      if (key) fin += `<code>Payments:ApiKey</code> came from <b>${esc(layers[key.from].name)}</b>${layers[key.from].id === "kv" || layers[key.from].id === "user" ? ", which is where a secret belongs." : ": move it to a secret store."}`;
      else fin += "<code>Payments:ApiKey</code> is not set at all: validate at startup so this fails the deploy, not the first payment.";
      if (unknown.size) fin += ` ${unknown.size} key${unknown.size > 1 ? "s are" : " is"} set but bound by nothing (red row).`;
      fr.push({ ...snap(layers.length), line: 6, note: fin, vars: { "Db:TimeoutSeconds": eff["Db:TimeoutSeconds"].v, "unread keys": unknown.size } });
      return fr;
    },
    render: (f) => {
      const n = f.layers.length;
      const stack = f.layers.map((L, i) => ({ L, i })).reverse().map(({ L, i }) => {
        const wins = Object.values(f.eff).filter((v) => v.from === i).length;
        const cls = i === f.cur ? "active" : i < f.cur || f.cur >= n ? "done" : "pending";
        return `<div class="cfg-layer ${cls}"><span class="cfg-lnum">${i + 1}</span><span class="cfg-lname">${esc(L.name)}</span>${i <= f.cur ? `<span class="cfg-lwins">${wins} win${wins === 1 ? "" : "s"}</span>` : ""}</div>`;
      }).join("");
      const head = `<tr><th>key</th>${f.layers.map((L, i) => `<th class="${i === f.cur ? "cur" : ""}">${esc(L.short)}</th>`).join("")}<th>effective</th></tr>`;
      const rows = f.keys.map((k) => {
        const bad = f.unknown.includes(k);
        const cells = f.layers.map((L, i) => {
          if (!(k in L.vals)) return `<td class="${i === f.cur ? "cur" : ""}"></td>`;
          if (i > f.cur) return `<td class="pend" title="${esc(L.vals[k])}">${esc(trunc(L.vals[k], 13))}</td>`;
          const win = f.eff[k] && f.eff[k].from === i;
          const cls = i === f.cur ? "active" : win ? "done" : "dim";
          return `<td class="${cls}" title="${esc(L.vals[k])}">${esc(trunc(L.vals[k], 13))}</td>`;
        }).join("");
        const e = f.eff[k];
        return `<tr class="${bad ? "bad" : ""}"><th><code>${esc(k)}</code></th>${cells}<td class="eff">${e ? `${esc(trunc(e.v, 16))}<small>${esc(f.layers[e.from].short)}</small>` : "<small>(unset)</small>"}</td></tr>`;
      }).join("");
      return `<div class="cfg-layers"><div class="cfg-stack"><div class="cfg-stack-h">highest priority</div>${stack}<div class="cfg-stack-h">lowest priority</div></div>
        <div class="cfg-scroll"><table class="cfg-tbl cfg-matrix">${head}${rows}</table></div></div>`;
    },
  }));

  /* =====================================================================
   * 2. Validate at startup (fail fast) vs on first use
   * ===================================================================== */
  const FF_BASE = { "ConnectionStrings:Orders": "Server=sql-prod;Database=orders", "Db:TimeoutSeconds": "30", "Payments:BaseUrl": "https://payments.internal", "Pricing:BatchLookups": "true" };
  const FF_SCEN = [
    { name: "all settings valid", set: {} },
    { name: "timeout typed as 3000", set: { "Db:TimeoutSeconds": "3000" } },
    { name: "connection string missing", del: ["ConnectionStrings:Orders"] },
    { name: "BaseUrl without https://", set: { "Payments:BaseUrl": "payments.internal" } },
    { name: "typo: DB__TIMEOUTSECOND=10", set: { "Db:TimeoutSecond": "10" } },
  ];
  const FF_RULES = [
    { key: "ConnectionStrings:Orders", rule: "required", line: 1, share: 0.9, what: "every request that touches the database fails", test: (v) => (v ? "" : "is missing") },
    { key: "Db:TimeoutSeconds", rule: "whole number 1 to 120", line: 1, share: 0.05, what: "requests that hit a slow query hang for 50 minutes instead of failing in 30 s; threads pile up", test: (v) => (/^\d+$/.test(v) && +v >= 1 && +v <= 120 ? "" : `is ${v}, outside 1..120`) },
    { key: "Payments:BaseUrl", rule: "absolute https URL", line: 2, share: 0.3, what: "every checkout fails with 'invalid URI'", test: (v) => (/^https:\/\/[A-Za-z0-9.-]+/.test(v || "") ? "" : `is "${v}", not an absolute https URL`) },
    { key: "Pricing:BatchLookups", rule: "true or false", line: 1, share: 0.6, what: "pricing fails to bind", test: (v) => (/^(true|false)$/i.test(v || "") ? "" : `is "${v}", not true/false`) },
  ];
  const FF_MODES = ["validate on start", "validate lazily (first use)"];
  const FF_RPM = 1200;

  Viz.register("configuration-and-secrets-failfast", (el) => Viz.player(el, {
    title: "Fail fast: bad config should stop the deploy, not the customers",
    tag: "PICK A MISTAKE · STEP THROUGH THE ROLLOUT",
    legend: [["visit", "old version serving"], ["done", "new version, healthy"], ["bad", "new version failing requests"], ["path", "crash-looping, gets no traffic"]],
    codeLang: "csharp",
    code: [
      "builder.Services.AddOptions<OrdersOptions>().BindConfiguration(\"\")",
      "    .ValidateDataAnnotations()   // [Required], [Range(1, 120)]",
      "    .Validate(o => o.BaseUrl.StartsWith(\"https://\"), \"BaseUrl must be https\")",
      "    .ValidateOnStart();          // throws before Kestrel accepts a request",
      "// lazy: nothing is checked until a request first reads options.Value",
      "// strict extra: warn about keys that no options class binds (typos)",
    ],
    inputs: [
      { key: "sc", label: "mistake", type: "select", value: FF_SCEN[1].name, options: FF_SCEN.map((s) => s.name) },
      { key: "mode", label: "validation", type: "select", value: FF_MODES[1], options: FF_MODES },
      { key: "pods", label: "pods", value: "4", width: 60 },
      { key: "detect", label: "minutes until noticed", value: "8", width: 90 },
    ],
    random: () => ({ sc: pick(Math.random, FF_SCEN).name, mode: pick(Math.random, FF_MODES), pods: String(Viz.rand(2, 6)), detect: String(Viz.rand(3, 14)) }),
    build: ({ sc, mode, pods, detect }) => {
      const S = FF_SCEN.find((x) => x.name === sc);
      if (!S) throw new Error("Pick one of the listed mistakes.");
      if (!FF_MODES.includes(mode)) throw new Error("Pick a validation mode.");
      const P = num(pods, "pods", 2, 8), D = num(detect, "minutes until noticed", 2, 20);
      const strict = mode === FF_MODES[0];
      const cfg = { ...FF_BASE, ...(S.set || {}) };
      for (const k of S.del || []) delete cfg[k];
      const results = [], fr = [];
      const T = D + P + 2;
      const rows = Array.from({ length: P }, () => []), surge = [];
      let errors = 0, served = 0, status = "not deployed yet";
      const snap = (t) => ({ results: results.map((r) => ({ ...r })), rows: rows.map((r) => r.slice()), surge: surge.slice(), t, T, P, errors, served, status, strict });
      fr.push({ ...snap(-1), line: strict ? 3 : 4, note: `Mistake: <b>${esc(S.name)}</b>. Mode: <b>${esc(mode)}</b>. First the four validation rules run against the effective configuration, then a rolling deploy replaces one of ${P} pods per minute at ${FF_RPM} requests/min.`, vars: { mistake: S.name, mode: strict ? "on start" : "lazy" } });
      for (const R of FF_RULES) {
        const v = cfg[R.key];
        const msg = R.test(v);
        results.push({ key: R.key, rule: R.rule, ok: !msg, msg, val: v });
        const when = strict ? "at startup, before the pod reports ready" : "only when a request first reads the value";
        fr.push({ ...snap(-1), line: R.line, note: `Rule: <code>${esc(R.key)}</code> must be <b>${esc(R.rule)}</b>. Value: <code>${esc(v ?? "(missing)")}</code> → ${msg ? `<b>fails</b> (${esc(msg)}). This is detected ${when}.` : "passes."}`, vars: { key: R.key, value: v ?? "(missing)", result: msg ? "FAIL" : "ok" } });
      }
      const unknown = Object.keys(cfg).filter((k) => !FF_RULES.some((r) => r.key === k));
      results.push({ key: "(every key bound?)", rule: "no unknown keys", ok: !unknown.length, warn: true, msg: unknown.length ? `${unknown.join(", ")} is bound by nothing` : "" });
      fr.push({ ...snap(-1), line: 5, note: unknown.length
        ? `<code>${esc(unknown.join(", "))}</code> is not a setting anyone reads, so <code>Db:TimeoutSeconds</code> stays at its default 30 instead of the intended 10. Every rule passes: validation cannot catch a value that never arrives. ${strict ? "The strict check logs a warning listing the unknown key; that warning is the only clue." : "Nothing reports it at all."}`
        : "No unknown keys: every configured key is bound by an options class.", vars: { "unknown keys": unknown.length } });
      const failing = FF_RULES.filter((R, i) => !results[i].ok);
      const share = Math.min(1, failing.reduce((a, R) => a + R.share, 0));
      const blocked = strict && failing.length > 0;
      const rollbackAt = !strict && failing.length ? D : Infinity;
      const rbEnd = Number.isFinite(rollbackAt) ? rollbackAt + Math.min(P, rollbackAt) : Infinity;
      for (let t = 0; t < T; t++) {
        let nNew = 0;
        if (!blocked) nNew = t < rollbackAt ? Math.min(P, t) : Math.max(0, Math.min(P, rollbackAt) - (t - rollbackAt));
        for (let p = 0; p < P; p++) rows[p].push(p < nNew ? (share > 0 ? "bad" : "done") : "visit");
        surge.push(blocked && t >= 1 ? "path" : "");
        const errs = Math.round(FF_RPM * (nNew / P) * share);
        errors += errs; served += FF_RPM;
        let note;
        if (blocked) {
          status = t === 0 ? "rollout starting" : t < 10 ? "blocked: new pod in CrashLoopBackOff" : "rollout failed (progress deadline), old version still serving";
          note = t === 0 ? "Minute 0: the rollout creates one extra (surge) pod with the new version."
            : t === 1 ? `Minute 1: the new pod throws <code>OptionsValidationException: ${esc(failing.map((R) => `${R.key} ${results[FF_RULES.indexOf(R)].msg}`).join("; "))}</code> before it listens. It never becomes ready, so it never receives traffic and the rollout stops. ${P} old pods keep serving.`
            : `Minute ${t}: still blocked. The error is in the pod log and the deploy status, word for word. Customers see nothing: ${errors} failed requests.`;
        } else if (failing.length) {
          status = t < rollbackAt ? (nNew ? `${nNew}/${P} new pods serving` : "rollout starting") : t < rbEnd ? "rolling back" : "rolled back";
          note = t < rollbackAt
            ? `Minute ${t}: ${nNew} of ${P} pods run the new version. Every pod passed its readiness probe, because nothing checked the config. ${share > 0 ? `About ${Math.round(share * 100)}% of their requests break (${esc(failing.map((R) => R.what).join("; "))}): <b>${errs}</b> failures this minute.` : ""}`
            : t === rollbackAt ? `Minute ${t}: someone notices (dashboards, a support ticket) and starts a rollback, one pod per minute.`
              : `Minute ${t}: ${t < rbEnd ? "rolling back" : "rollback done"}; ${nNew} new pods left. Total so far: <b>${errors}</b> failed requests.`;
        } else {
          status = nNew >= P ? "rollout complete" : nNew ? `${nNew}/${P} new pods serving` : "rollout starting";
          note = `Minute ${t}: ${nNew} of ${P} pods on the new version, all healthy.${unknown.length ? " Healthy, but with a 30 s timeout instead of 10 s: the typo shipped." : ""}`;
        }
        fr.push({ ...snap(t), line: blocked ? 3 : 4, note, vars: { minute: t, "new pods": nNew, "failed requests": errors } });
      }
      const sum = blocked
        ? `Fail fast: the bad value cost <b>0</b> customer requests. The deploy failed in about a minute with the exact key and rule in the log, and the old version never stopped serving. Fix the value, deploy again.`
        : failing.length
          ? `Fail late: <b>${errors.toLocaleString("en-US")}</b> failed requests out of ${served.toLocaleString("en-US")} before the rollback finished, for a mistake a 10-line validator would have caught at boot. Switch the mode to "validate on start" and run again.`
          : unknown.length ? "Both modes ship the typo: validation checks values, not intent. Catch typos with a strict unknown-key check, a config schema in CI, or typed environment variable names generated from the options class."
            : "Valid configuration: both modes behave the same. Validation on start costs a few milliseconds per boot and nothing else.";
      fr.push({ ...snap(T - 1), line: blocked ? 3 : 4, note: sum, vars: { "failed requests": errors, served } });
      return fr;
    },
    render: (f) => {
      const rules = f.results.map((r) => `<div class="cfg-rule ${r.ok ? "done" : r.warn ? "path" : "bad"}">${badge(r.ok ? "ok" : r.warn ? "warn" : "FAIL", r.ok ? "done" : r.warn ? "path" : "bad")}<code>${esc(r.key)}</code><span class="cfg-muted">${esc(r.rule)}</span>${r.msg ? `<span>${esc(r.msg)}</span>` : ""}</div>`).join("") || '<div class="cfg-muted">rules not run yet</div>';
      const cols = `grid-template-columns: 74px repeat(${f.T}, minmax(0, 1fr));`;
      const cell = (c, t) => `<span class="cfg-cell ${t <= f.t ? c : ""}"></span>`;
      let grid = `<div class="cfg-tl" style="${cols}"><span class="cfg-muted">minute</span>${Array.from({ length: f.T }, (_, t) => `<span class="cfg-tick ${t === f.t ? "cur" : ""}">${t % 2 === 0 ? t : ""}</span>`).join("")}</div>`;
      grid += f.rows.map((r, p) => `<div class="cfg-tl" style="${cols}"><span>pod ${p + 1}</span>${Array.from({ length: f.T }, (_, t) => cell(r[t] || "", t)).join("")}</div>`).join("");
      if (f.surge.some(Boolean)) grid += `<div class="cfg-tl" style="${cols}"><span>surge pod</span>${Array.from({ length: f.T }, (_, t) => cell(f.surge[t] || "", t)).join("")}</div>`;
      return `<div class="cfg-col"><div class="cfg-rules">${rules}</div><div class="cfg-tlwrap">${grid}</div>
        <div class="cfg-stats"><span>status <b>${esc(f.status)}</b></span><span>failed requests <b class="${f.errors ? "cfg-t-bad" : ""}">${f.errors.toLocaleString("en-US")}</b></span></div></div>`;
    },
  }));

  /* =====================================================================
   * 3. Hot reload: two related keys change in two writes
   * ===================================================================== */
  const HR_MODES = ["A: read each key when needed", "B: snapshot per request", "C: validate pair, swap atomically"];
  const HR_LINES = [[0, 1], [2, 3], [4, 5]];
  Viz.register("configuration-and-secrets-reload", (el) => Viz.player(el, {
    title: "Hot reload: the endpoint and its key change in two separate writes",
    tag: "PICK A READ STRATEGY · STEP THROUGH TIME",
    legend: [["visit", "old url + old key"], ["done", "new url + new key"], ["bad", "mismatched pair: 401"], ["path", "candidate rejected, kept last good"]],
    codeLang: "csharp",
    code: [
      "// A: read keys one at a time, at different moments",
      "var url = config[\"Payments:BaseUrl\"]; /* work */ var key = config[\"Payments:ApiKey\"];",
      "// B: bind the section once per request",
      "public PayClient(IOptionsSnapshot<PaymentOptions> o) => _o = o.Value;",
      "// C: build the whole object, validate it, then swap; else keep last good",
      "monitor.OnChange(next => { if (IsValidPair(next)) Volatile.Write(ref _current, next); });",
    ],
    inputs: [
      { key: "mode", label: "read strategy", type: "select", value: HR_MODES[0], options: HR_MODES },
      { key: "gap", label: "seconds between the 2 writes", value: "3", width: 70 },
      { key: "pods", label: "pods", value: "3", width: 60 },
      seedInput,
    ],
    random: () => ({ mode: pick(Math.random, HR_MODES), gap: String(Viz.rand(0, 6)), pods: String(Viz.rand(2, 5)), seed: randSeed() }),
    build: ({ mode, gap, pods, seed }) => {
      const M = HR_MODES.indexOf(mode);
      if (M < 0) throw new Error("Pick a read strategy.");
      const G = num(gap, "gap between writes", 0, 8, false), P = num(pods, "pods", 2, 6), r = rng(num(seed, "seed", 1, 99999));
      const SLOTS = 40, DT = 0.25, END = 20, W1 = 5, W2 = 5 + G, WORK = 0.4;
      const pods_ = Array.from({ length: P }, (_, p) => {
        const seeUrl = W1 + 0.5 + r() * 2.5, seeKey = W2 + 0.5 + r() * 2.5;
        return { name: `pod ${p + 1}`, seeUrl, seeKey, slots: Array(SLOTS).fill(""), fails: 0, reqs: 0, rejected: [], swapAt: null };
      });
      const view = (pd, t) => [t >= pd.seeUrl ? 2 : 1, t >= pd.seeKey ? 2 : 1];
      for (const pd of pods_) {
        let cur = [1, 1];
        const events = [pd.seeUrl, pd.seeKey].sort((a, b) => a - b);
        for (const e of events) {
          const cand = view(pd, e + 1e-9);
          if (cand[0] === cand[1]) { cur = cand; pd.swapAt = e; } else pd.rejected.push(e);
        }
        pd.cur = cur;
        for (let t = 0; t < END; t += DT) {
          let pair;
          if (M === 0) pair = [view(pd, t)[0], view(pd, t + WORK)[1]];
          else if (M === 1) pair = view(pd, t);
          else pair = pd.swapAt !== null && t >= pd.swapAt ? [2, 2] : [1, 1];
          const bad = pair[0] !== pair[1];
          const s = Math.floor(t / 0.5);
          const cls = bad ? "bad" : pair[0] === 2 ? "done" : "visit";
          if (pd.slots[s] !== "bad") pd.slots[s] = cls;
          pd.reqs++; if (bad) pd.fails++;
          pd.reqLog = pd.reqLog || [];
          pd.reqLog.push({ t, bad });
        }
        if (M === 2) for (const e of pd.rejected) { const s = Math.floor(e / 0.5); if (s < SLOTS) pd.slots[s] = "path"; }
      }
      const fr = [];
      const snap = (t) => ({ t, P, pods: pods_.map((pd) => ({ name: pd.name, slots: pd.slots, fails: pd.reqLog.filter((x) => x.t <= t && x.bad).length, seeUrl: pd.seeUrl, seeKey: pd.seeKey })), W1, W2, M });
      fr.push({ ...snap(-1), line: HR_LINES[M], note: `An operator moves payments to a new endpoint that needs a new API key. The config store gets <b>two</b> writes: <code>Payments:BaseUrl</code> at ${W1} s and <code>Payments:ApiKey</code> at ${W2.toFixed(1)} s. Each of ${P} pods notices each change 0.5 to 3 s later (file watcher debounce, provider polling). Strategy: <b>${esc(mode)}</b>.`, vars: { strategy: mode.slice(0, 1), "write gap s": G } });
      for (let t = 1; t <= END; t++) {
        const at = t - 0.001;
        const total = pods_.reduce((a, pd) => a + pd.reqLog.filter((x) => x.t <= at && x.bad).length, 0);
        const ev = [];
        for (const pd of pods_) {
          if (pd.seeUrl > t - 1 && pd.seeUrl <= t) ev.push(`${pd.name} sees the new url at ${pd.seeUrl.toFixed(1)} s`);
          if (pd.seeKey > t - 1 && pd.seeKey <= t) ev.push(`${pd.name} sees the new key at ${pd.seeKey.toFixed(1)} s`);
        }
        let note = `t = ${t} s. ${ev.length ? `${ev.join("; ")}.` : "No change notifications this second."} `;
        const newFails = pods_.reduce((a, pd) => a + pd.reqLog.filter((x) => x.t > t - 1 && x.t <= at && x.bad).length, 0);
        if (newFails) note += M === 0 ? `<b>${newFails}</b> request${newFails === 1 ? "" : "s"} failed: some read the url before a reload and the key after it (or the store itself is half-updated).` : `<b>${newFails}</b> request${newFails === 1 ? "" : "s"} failed: the snapshot is consistent within the request, but the <b>store itself</b> holds new url + old key between the two writes.`;
        else if (M === 2 && pods_.some((pd) => pd.rejected.some((e) => e > t - 1 && e <= t))) note += "A pod received a half-updated pair, validation rejected it, and the pod kept serving with the last good pair.";
        else note += "All requests used a matching pair.";
        fr.push({ ...snap(at), line: HR_LINES[M][1], note, vars: { t, "failed so far": total } });
      }
      const fails = pods_.reduce((a, pd) => a + pd.fails, 0), reqs = pods_.reduce((a, pd) => a + pd.reqs, 0);
      const sum = M === 2
        ? `Strategy C: <b>0</b> failed requests out of ${reqs}. Each pod switched only once it held a matching pair. Pods still disagreed for a few seconds (version skew), so the old endpoint and old key must stay valid until every pod has switched.`
        : `<b>${fails}</b> of ${reqs} requests failed. ${M === 0 ? "Reading keys separately mixes two config versions inside one request." : "A per-request snapshot cannot fix a store that is inconsistent between two writes."} ${G === 0 && M === 1 ? "With a 0 s gap, B is safe only because both writes landed together; C stays safe whatever the gap." : "Write related keys in one change, and validate the whole object before using it."}`;
      fr.push({ ...snap(END), line: HR_LINES[M][1], note: sum, vars: { requests: reqs, failed: fails } });
      return fr;
    },
    render: (f) => {
      const cut = Math.ceil(Math.max(0, f.t) / 0.5 - 1e-6);
      const cols = "grid-template-columns: 58px repeat(40, minmax(0, 1fr)) 46px;";
      const mark = (x, lbl) => `<span class="cfg-hmark" style="left: calc(58px + (100% - 104px) * ${x / 20});">${lbl}</span>`;
      let s = `<div class="cfg-hwrap"><div class="cfg-hmarks">${mark(f.W1, "url write")}${mark(f.W2, f.W2 - f.W1 < 1.6 ? "" : "key write")}</div>`;
      s += `<div class="cfg-tl" style="${cols}"><span class="cfg-muted">seconds</span>${Array.from({ length: 40 }, (_, i) => `<span class="cfg-tick ${i === cut - 1 ? "cur" : ""}">${i % 4 === 0 ? i / 2 : ""}</span>`).join("")}<span class="cfg-muted">fails</span></div>`;
      s += f.pods.map((pd) => `<div class="cfg-tl" style="${cols}"><span>${pd.name}</span>${pd.slots.map((c, i) => `<span class="cfg-cell ${i < cut || f.t >= 20 ? c : ""}"></span>`).join("")}<b class="${pd.fails ? "cfg-t-bad" : ""}">${pd.fails}</b></div>`).join("");
      return `${s}</div>`;
    },
  }));

  /* =====================================================================
   * 4. Evaluating one flag for one user
   * ===================================================================== */
  const FE_COUNTRIES = ["NL", "US", "DE", "IN", "BR"], FE_PLANS = ["free", "pro", "enterprise"];
  const FE_FLAGS = [
    {
      name: "new-checkout (release)", key: "new-checkout", kind: "release", outcomes: ["on", "off"], off: "off",
      why: "Release flag: hides unfinished code while it ships dark. Short-lived: delete it once at 100%.",
      rules: [
        { name: "employees first", test: (u) => (u.id.startsWith("emp-") ? ["on", "user id starts with emp-: dogfooding"] : null) },
        { name: "hold back enterprise", test: (u) => (u.plan === "enterprise" ? ["off", "enterprise customers wait until the rollout is stable"] : null) },
      ],
      rollout: [["on", 10], ["off", 90]],
    },
    {
      name: "recommendations (ops)", key: "recommendations", kind: "ops", outcomes: ["on", "off"], off: "off",
      why: "Ops flag (kill switch): long-lived, flipped by on-call to shed load. Its value matters during incidents, so test both paths.",
      rules: [],
      rollout: [["on", 100]],
    },
    {
      name: "price-test (experiment)", key: "price-test", kind: "experiment", outcomes: ["control", "A", "B"], off: "control",
      why: "Experiment flag: splits users into stable variants and logs exposure so the analysis can compare conversion. Lives for weeks.",
      rules: [{ name: "legal: no price tests in DE", test: (u) => (u.country === "DE" ? ["control", "price experiments are excluded in this market"] : null) }],
      rollout: [["control", 34], ["A", 33], ["B", 33]],
    },
    {
      name: "bulk-export (permission)", key: "bulk-export", kind: "permission", outcomes: ["on", "off"], off: "off",
      why: "Permission flag: an entitlement by plan or contract. Long-lived; arguably belongs in your authorization model, not the flag tool.",
      rules: [
        { name: "plan is enterprise", test: (u) => (u.plan === "enterprise" ? ["on", "enterprise plan includes bulk export"] : null) },
        { name: "allow list", test: (u) => (["u-1001", "u-2002"].includes(u.id) ? ["on", "contract exception on the allow list"] : null) },
      ],
      rollout: [["off", 100]],
    },
  ];
  const feEval = (F, u, enabled) => {
    if (!enabled) return { val: F.off, step: "off" };
    for (let i = 0; i < F.rules.length; i++) { const m = F.rules[i].test(u); if (m) return { val: m[0], step: `r${i}` }; }
    const b = bucketOf(F.key, u.id);
    let acc = 0;
    for (const [v, w] of F.rollout) { acc += w; if (b < acc) return { val: v, step: "roll", b }; }
    return { val: F.rollout[F.rollout.length - 1][0], step: "roll", b };
  };

  Viz.register("configuration-and-secrets-flag-eval", (el) => Viz.player(el, {
    title: "How a flag is evaluated: switch, targeting rules, then a sticky percentage",
    tag: "CHANGE THE USER · STEP THROUGH",
    legend: [["active", "being checked"], ["done", "matched: this decides"], ["dim", "no match / skipped"], ["visit", "bucket position"]],
    codeLang: "typescript",
    code: [
      "function evaluate(flag: Flag, user: Context): string {",
      "  if (!flag.enabled) return flag.offVariation;          // the master switch",
      "  for (const rule of flag.rules)                         // targeting, top to bottom",
      "    if (rule.matches(user)) return rule.variation;      // first match wins",
      "  const bucket = fnv1a(`${flag.key}:${user.id}`) % 10000 / 100;  // 0.00 to 99.99",
      "  return byWeight(flag.rollout, bucket);                 // same user, same answer",
      "}",
    ],
    inputs: [
      { key: "flag", label: "flag", type: "select", value: FE_FLAGS[0].name, options: FE_FLAGS.map((f) => f.name) },
      { key: "user", label: "user id", value: "u-4821", width: 100 },
      { key: "country", label: "country", type: "select", value: "NL", options: FE_COUNTRIES },
      { key: "plan", label: "plan", type: "select", value: "pro", options: FE_PLANS },
      { key: "enabled", label: "switch", type: "select", value: "enabled", options: ["enabled", "disabled"] },
    ],
    random: () => ({ flag: pick(Math.random, FE_FLAGS).name, user: pick(Math.random, ["u-", "u-", "emp-"]) + Viz.rand(1000, 9999), country: pick(Math.random, FE_COUNTRIES), plan: pick(Math.random, FE_PLANS), enabled: Math.random() < 0.85 ? "enabled" : "disabled" }),
    build: ({ flag, user, country, plan, enabled }) => {
      const F = FE_FLAGS.find((x) => x.name === flag);
      if (!F) throw new Error("Pick one of the listed flags.");
      const id = String(user).trim();
      if (!/^[A-Za-z0-9@._-]{1,40}$/.test(id)) throw new Error("User id must be 1 to 40 letters, digits, or . _ - @");
      if (!FE_COUNTRIES.includes(country) || !FE_PLANS.includes(plan)) throw new Error("Pick a listed country and plan.");
      const on = enabled === "enabled";
      const u = { id, country, plan };
      const steps = [{ id: "off", name: "switch", desc: on ? "enabled" : "disabled" }, ...F.rules.map((R, i) => ({ id: `r${i}`, name: R.name })), { id: "roll", name: `rollout ${F.rollout.map(([v, w]) => `${v} ${w}%`).join(" / ")}` }];
      const res = feEval(F, u, on);
      const b = bucketOf(F.key, id);
      const fr = [], state = {};
      const snap = (extra = {}) => ({ F, u, steps, state: { ...state }, b, res, ...extra });
      fr.push({ ...snap(), line: 0, note: `Flag <b>${esc(F.key)}</b>. ${esc(F.why)} The SDK evaluates it locally from cached rules: no network call per check.`, vars: { flag: F.key, kind: F.kind } });
      state.off = "active";
      fr.push({ ...snap(), line: 1, note: on ? "The switch is <b>enabled</b>, so evaluation continues to the targeting rules." : `The switch is <b>disabled</b>: every user gets <b>${esc(F.off)}</b> immediately. This is how an ops flag sheds load in seconds without a deploy.`, vars: { enabled: on } });
      if (!on) { state.off = "done"; }
      else {
        state.off = "dim";
        for (let i = 0; i < F.rules.length; i++) {
          const m = F.rules[i].test(u);
          state[`r${i}`] = m ? "done" : "dim";
          fr.push({ ...snap(), line: m ? 3 : 2, note: m ? `Rule "${esc(F.rules[i].name)}" matches: ${esc(m[1])}. Result <b>${esc(m[0])}</b>; later rules and the percentage are not consulted.` : `Rule "${esc(F.rules[i].name)}" does not match (${esc(id)}, ${country}, ${plan}). Next.`, vars: { rule: F.rules[i].name, match: !!m } });
          if (m) break;
        }
        if (res.step === "roll") {
          state.roll = "done";
          let acc = 0;
          const bands = F.rollout.map(([v, w]) => { const lo = acc; acc += w; return `${v}: ${lo} to ${acc}`; }).join(", ");
          fr.push({ ...snap({ showB: true }), line: [4, 5], note: `No rule matched, so the percentage decides. <code>fnv1a("${esc(F.key)}:${esc(id)}") % 10000 / 100</code> = <b>${b.toFixed(2)}</b>. Bands: ${esc(bands)}. Result <b>${esc(res.val)}</b>. The hash includes the flag key, so the same user lands in a different bucket for each flag.`, vars: { bucket: b.toFixed(2), result: res.val } });
        }
      }
      const N = 10000, cnt = Object.fromEntries(F.outcomes.map((o) => [o, 0])), r = rng(42);
      for (let i = 0; i < N; i++) {
        const uu = { id: `u-${i}`, country: FE_COUNTRIES[Math.floor(r() * 5)], plan: r() < 0.6 ? "free" : r() < 0.8 ? "pro" : "enterprise" };
        cnt[feEval(F, uu, on).val]++;
      }
      fr.push({ ...snap({ showB: res.step === "roll", pop: cnt, N }), line: 5, note: `This user gets <b>${esc(res.val)}</b>, and gets it again on every request and every server, because nothing in the inputs changes. Across ${N.toLocaleString("en-US")} simulated users: ${F.outcomes.map((o) => `${o} ${(cnt[o] / N * 100).toFixed(1)}%`).join(", ")}. Rules carve out segments first, so the result differs from the raw rollout weights.`, vars: { result: res.val } });
      return fr;
    },
    render: (f) => {
      const ctx = `<div class="cfg-ctx"><div class="cfg-ctx-h">evaluation context</div><div><span class="cfg-muted">user.id</span> <code>${esc(f.u.id)}</code></div><div><span class="cfg-muted">country</span> <code>${f.u.country}</code></div><div><span class="cfg-muted">plan</span> <code>${f.u.plan}</code></div>
        <div class="cfg-gauge"><span class="cfg-gauge-fill" style="width:${f.showB ? f.b : 0}%"></span>${f.showB ? `<span class="cfg-gauge-mark" style="left:${f.b}%"></span>` : ""}</div><div class="cfg-muted cfg-small">bucket ${f.showB ? `<b>${f.b.toFixed(2)}</b>` : "?"} of 0 to 100</div></div>`;
      const chain = f.steps.map((s) => `<div class="cfg-step ${f.state[s.id] || "pending"}"><b>${esc(s.name)}</b>${s.desc ? `<span class="cfg-muted"> ${esc(s.desc)}</span>` : ""}${f.state[s.id] === "done" ? badge(f.res.val, "done") : ""}</div>`).join('<div class="cfg-arrow">↓</div>');
      const pop = f.pop ? `<div class="cfg-pop">${f.F.outcomes.map((o) => `<div class="cfg-bar"><span>${esc(o)}</span><span class="cfg-bar-t"><span class="cfg-bar-f ${o === f.res.val ? "done" : "visit"}" style="width:${(f.pop[o] / f.N) * 100}%"></span></span><b>${(f.pop[o] / f.N * 100).toFixed(1)}%</b></div>`).join("")}</div>` : "";
      return `<div class="cfg-col"><div class="cfg-two">${ctx}<div class="cfg-chain">${chain}</div></div>${pop}</div>`;
    },
  }));

  /* =====================================================================
   * 5. Percentage rollout with a guard
   * ===================================================================== */
  const RO_STAGES = [1, 5, 25, 50, 100];
  const RO_MODES = ["sticky: hash(flag:user)", "random per request"];
  Viz.register("configuration-and-secrets-rollout", (el) => Viz.player(el, {
    title: "Ramping a release flag: 1% → 5% → 25% → 50% → 100%, with an automatic guard",
    tag: "SET THE BUG RATE · STEP THROUGH THE RAMP",
    legend: [["done", "has the new code"], ["active", "joined at this stage"], ["path", "flickers between old and new"], ["bad", "hit an error on new code"], ["dim", "old code"]],
    codeLang: "python",
    code: [
      "for pct in [1, 5, 25, 50, 100]:",
      "    flag.rollout = pct                     # users with bucket < pct get it",
      "    wait(soak_time)                        # let real traffic flow",
      "    n, err_new = metrics(flag='on'); err_old = metrics(flag='off').error_rate",
      "    if n >= 300 and err_new - err_old > guard_pp / 100:",
      "        flag.rollout = 0; page('rollout halted'); break   # automatic rollback",
    ],
    inputs: [
      { key: "mode", label: "bucketing", type: "select", value: RO_MODES[0], options: RO_MODES },
      { key: "bug", label: "new-code error %", value: "4", width: 80 },
      { key: "guard", label: "guard (points over old)", value: "2", width: 90 },
      seedInput,
    ],
    random: () => ({ mode: Math.random() < 0.7 ? RO_MODES[0] : RO_MODES[1], bug: String(pick(Math.random, [0.5, 1, 2, 4, 8, 15])), guard: String(Viz.rand(1, 4)), seed: randSeed() }),
    build: ({ mode, bug, guard, seed }) => {
      const M = RO_MODES.indexOf(mode);
      if (M < 0) throw new Error("Pick a bucketing mode.");
      const BUG = num(bug, "new-code error %", 0, 50, false) / 100, GUARD = num(guard, "guard", 0.1, 20, false) / 100, S = num(seed, "seed", 1, 99999), r = rng(S);
      const BASE = 0.005, U = 5000, SHOW = 200, REQ = 4;
      const users = Array.from({ length: U }, (_, i) => ({ id: `u-${S}-${i}`, b: bucketOf("new-checkout", `u-${S}-${i}`), prevOn: false }));
      const grid = Array(SHOW).fill("dim"), fr = [];
      let halted = false, prevPct = 0, totalErrNew = 0;
      fr.push({ grid: grid.slice(), pct: 0, line: 0, note: `${U.toLocaleString("en-US")} users, ${REQ} requests each per stage. Old code fails ${BASE * 100}% of requests, the new code fails <b>${(BUG * 100).toFixed(1)}%</b>. The guard rolls back if the new code is more than <b>${(GUARD * 100).toFixed(1)}</b> points worse, once it has at least 300 requests to judge. The grid shows the first ${SHOW} users.`, vars: { stage: "0%", mode: M ? "random" : "sticky" } });
      for (const pct of RO_STAGES) {
        let nNew = 0, eNew = 0, nOld = 0, eOld = 0, flick = 0, lost = 0, joined = 0;
        users.forEach((u, i) => {
          let sawNew = false, sawOld = false, err = false;
          for (let q = 0; q < REQ; q++) {
            const isNew = M === 0 ? u.b < pct : r() * 100 < pct;
            const e = r() < (isNew ? BUG : BASE);
            if (isNew) { nNew++; if (e) { eNew++; err = true; } sawNew = true; } else { nOld++; if (e) eOld++; sawOld = true; }
          }
          if (sawNew && sawOld) flick++;
          if (u.prevOn && !sawNew) lost++;
          if (sawNew && !u.prevOn) joined++;
          if (i < SHOW) grid[i] = err ? "bad" : sawNew && sawOld ? "path" : sawNew ? (u.prevOn ? "done" : "active") : "dim";
          u.prevOn = sawNew;
        });
        totalErrNew += eNew;
        const rn = nNew ? eNew / nNew : 0, ro = nOld ? eOld / nOld : 0;
        fr.push({ grid: grid.slice(), pct, line: [1, 2], note: `Stage <b>${pct}%</b>: ${nNew.toLocaleString("en-US")} requests ran the new code. ${joined.toLocaleString("en-US")} users saw it for the first time. ${M === 0 ? `Sticky bucketing: everyone who had it at ${prevPct}% still has it (${lost} lost it), and nobody flickers.` : `Random per request: <b>${flick.toLocaleString("en-US")}</b> users flickered between old and new within the stage and <b>${lost.toLocaleString("en-US")}</b> lost a feature they had a minute ago. Support tickets incoming.`}`, vars: { stage: `${pct}%`, "new requests": nNew, flicker: flick } });
        const enough = nNew >= 300;
        const trip = enough && rn - ro > GUARD;
        fr.push({ grid: grid.slice(), pct, line: trip ? [4, 5] : [3, 4], note: `Guard check at ${pct}%: new ${(rn * 100).toFixed(2)}% vs old ${(ro * 100).toFixed(2)}% errors (${eNew} of ${nNew} vs ${eOld} of ${nOld}). ${!enough ? `Only ${nNew} new-code requests: too few to judge, so the ramp continues. Small canaries cannot see small regressions.` : trip ? `<b>${((rn - ro) * 100).toFixed(2)} points worse: guard trips, rollout set to 0%.</b> Only users bucketed below ${pct} were ever exposed.` : `Within ${(GUARD * 100).toFixed(1)} points: continue.`}`, vars: { "err new %": (rn * 100).toFixed(2), "err old %": (ro * 100).toFixed(2), verdict: !enough ? "too few" : trip ? "ROLLBACK" : "ok" } });
        prevPct = pct;
        if (trip) { halted = true; break; }
      }
      const blast = halted ? `The bug reached ${prevPct}% of users before the guard stopped it: ${totalErrNew.toLocaleString("en-US")} errors caused by the new code, instead of ${Math.round(U * REQ * BUG).toLocaleString("en-US")} if it had shipped to everyone at once.` : BUG - BASE > GUARD ? "The guard never had enough data before 100%: give early stages more traffic or more soak time." : `Rollout finished at 100%. ${BUG > BASE ? "The regression was below the guard threshold, so it shipped: pick the threshold from your error budget." : "No regression. Next: remove the flag and the old code path."}`;
      fr.push({ grid: halted ? grid.map((g) => (g === "bad" ? "bad" : "dim")) : grid.slice(), pct: halted ? 0 : 100, line: halted ? 5 : 0, note: blast, vars: { result: halted ? `halted at ${prevPct}%` : "100%" } });
      return fr;
    },
    render: (f) => `<div class="cfg-col"><div class="cfg-ramp">${RO_STAGES.map((p) => `<span class="${p === f.pct ? "cur" : p < f.pct ? "done" : ""}">${p}%</span>`).join('<i>→</i>')}</div>
      <div class="cfg-grid">${f.grid.map((g) => `<span class="cfg-u ${g}"></span>`).join("")}</div>
      <div class="cfg-muted cfg-small">first 200 of 5,000 users; bucket order is random, so the exposed users are scattered</div></div>`,
  }));

  /* =====================================================================
   * 6. Flag debt: flags are cheap to add and easy to forget
   * ===================================================================== */
  const FD_POL = ["no removal policy", "expiry date + reminder", "removal ticket filed at creation"];
  Viz.register("configuration-and-secrets-flag-debt", (el) => Viz.player(el, {
    title: "Flag debt: live flags month by month under three removal policies",
    tag: "PICK A POLICY · STEP THROUGH THE MONTHS",
    legend: [["visit", "long-lived by design (ops, permission)"], ["active", "doing its job (rolling out, experimenting)"], ["bad", "stale: done, still in the code"]],
    codeLang: "python",
    code: [
      "flag = create(kind, owner='team-a', expires=today + 30d)   # metadata at birth",
      "rollout(flag, [1, 5, 25, 50, 100])                         # weeks of real work",
      "if flag.at_100_percent_for(days=14):",
      "    open_pr('remove flag and the old branch')             # code + config",
      "lint: fail the build if a flag is past its expiry date",
    ],
    inputs: [
      { key: "rate", label: "new flags / month", value: "6", width: 80 },
      { key: "pol", label: "removal policy", type: "select", value: FD_POL[0], options: FD_POL },
      { key: "months", label: "months", value: "24", width: 60 },
      seedInput,
    ],
    random: () => ({ rate: String(Viz.rand(2, 12)), pol: pick(Math.random, FD_POL), months: String(Viz.rand(12, 30)), seed: randSeed() }),
    build: ({ rate, pol, months, seed }) => {
      const R = num(rate, "new flags per month", 1, 20), P = FD_POL.indexOf(pol), MO = num(months, "months", 6, 36), r = rng(num(seed, "seed", 1, 99999));
      if (P < 0) throw new Error("Pick a removal policy.");
      const flags = [], hist = [], fr = [];
      let removed = 0, oldestStale = 0;
      for (let m = 1; m <= MO; m++) {
        const k = Math.max(0, Math.round(R * (0.6 + 0.8 * r())));
        for (let i = 0; i < k; i++) {
          const x = r();
          const kind = x < 0.6 ? "release" : x < 0.8 ? "experiment" : x < 0.95 ? "ops" : "permission";
          const done = kind === "release" ? m + 0.5 + r() : kind === "experiment" ? m + 1 + r() : Infinity;
          flags.push({ kind, born: m, done, removedAt: null });
        }
        for (const f of flags) {
          if (f.removedAt !== null || !Number.isFinite(f.done) || m < f.done) continue;
          const age = m - f.done;
          const p = P === 0 ? 0.05 : P === 1 ? (age >= 1 && age < 2 ? 0.75 : age >= 2 ? 0.3 : 0) : age < 1 ? 0.85 : 0.5;
          if (r() < p) { f.removedAt = m; removed++; }
        }
        const live = flags.filter((f) => f.removedAt === null);
        const longLived = live.filter((f) => !Number.isFinite(f.done)).length;
        const working = live.filter((f) => Number.isFinite(f.done) && m < f.done + 1).length;
        const staleF = live.filter((f) => Number.isFinite(f.done) && m >= f.done + 1);
        oldestStale = staleF.length ? Math.max(...staleF.map((f) => m - f.done)) : 0;
        hist.push({ m, longLived, working, stale: staleF.length, created: flags.length, oldest: oldestStale });
        if (m % 2 === 0 || m === MO) {
          const h = hist[hist.length - 1];
          const note = `Month ${m}: ${h.created} flags created so far, ${removed} removed. Live: <b>${h.longLived}</b> long-lived, <b>${h.working}</b> doing their job, <b>${h.stale}</b> stale${h.stale ? ` (oldest finished ${h.oldest.toFixed(0)} months ago)` : ""}. ${P === 0 ? "Nobody owns removal, so most finished flags stay: the code keeps both branches, and tests cover only one." : P === 1 ? "The expiry date turns into a reminder; most teams act on it, some snooze it." : "The removal ticket exists from day one and is planned with the feature."}`;
          fr.push({ hist: hist.slice(), MO, line: P === 0 ? 1 : P === 1 ? [0, 4] : [2, 3], note, vars: { month: m, live: h.longLived + h.working + h.stale, stale: h.stale } });
        }
      }
      const last = hist[hist.length - 1];
      const combos = last.stale > 40 ? "more than a trillion" : (2 ** last.stale).toLocaleString("en-US");
      fr.push({ hist: hist.slice(), MO, line: 4, note: `After ${MO} months: <b>${last.stale}</b> stale flags. Each is an <code>if</code> with a branch that no longer runs in production, and together they allow <b>${combos}</b> on/off combinations, of which you test one. Stale flags also invite reuse: flipping an old flag that a forgotten server still reads is how a 2012 trading firm lost $440 million in 45 minutes. Treat removal as part of the feature.`, vars: { stale: last.stale, removed } });
      return fr;
    },
    render: (f) => {
      const W = 520, H = 170, PL = 30, PB = 22, PT = 8;
      const max = Math.max(5, ...f.hist.map((h) => h.longLived + h.working + h.stale));
      const bw = (W - PL - 6) / f.MO;
      const Y = (v) => PT + (1 - v / max) * (H - PT - PB);
      let s = `<svg class="cfg-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="live flags per month">`;
      for (const g of [0, 0.5, 1]) { const v = Math.round(max * g); s += `<line class="cfg-gline" x1="${PL}" x2="${W - 4}" y1="${Y(v)}" y2="${Y(v)}"/><text class="cfg-lbl" x="${PL - 4}" y="${Y(v) + 3}" text-anchor="end">${v}</text>`; }
      f.hist.forEach((h, i) => {
        const x = PL + 2 + i * bw, w = Math.max(2, bw - 2);
        let y0 = H - PB;
        for (const [v, c] of [[h.longLived, "visit"], [h.working, "active"], [h.stale, "bad"]]) {
          const hh = (v / max) * (H - PT - PB);
          if (hh > 0) s += `<rect class="cfg-f-${c}" x="${x.toFixed(1)}" y="${(y0 - hh).toFixed(1)}" width="${w.toFixed(1)}" height="${hh.toFixed(1)}"/>`;
          y0 -= hh;
        }
        if (h.m % 6 === 0 || h.m === 1) s += `<text class="cfg-lbl" x="${(x + w / 2).toFixed(1)}" y="${H - 7}" text-anchor="middle">m${h.m}</text>`;
      });
      return `${s}</svg>`;
    },
  }));

  /* =====================================================================
   * 7. Getting a token without a stored secret
   * ===================================================================== */
  const ID_MODES = ["client secret in config", "managed identity (Azure host)", "workload identity (Kubernetes)"];
  const ID_FLOW = [
    {
      src: "config / env", srcSub: "ClientSecret=…", stored: 1,
      steps: [
        { e: ["app", "src"], line: 1, t: "The app reads <code>ClientId</code> and <code>ClientSecret</code> from configuration. That secret also lives in the pipeline variables, a vault entry someone copied, and probably a laptop or two." },
        { e: ["app", "idp"], line: 1, t: "POST to the Entra ID token endpoint: <code>grant_type=client_credentials</code>, client_id, <b>client_secret</b>, scope=https://vault.azure.net/.default." },
        { e: ["idp", "app"], line: 4, t: "Entra ID checks the secret and returns a signed access token (a JWT: audience = Key Vault, expiry = token lifetime)." },
      ],
    },
    {
      src: "IMDS endpoint", srcSub: "169.254.169.254", stored: 0,
      steps: [
        { e: ["app", "src"], line: 2, t: "The platform attached an identity to this App Service / VM / Container App. The app calls the local metadata endpoint (IMDS), which is reachable only from inside the host. No secret in the request." },
        { e: ["src", "idp"], line: 2, t: "The platform asks Entra ID for a token on the app's behalf, using a credential that the platform holds and rotates. Your code never sees it." },
        { e: ["idp", "app"], line: 4, t: "The token comes back through IMDS to the app: same JWT shape as before, audience = Key Vault." },
      ],
    },
    {
      src: "projected SA token", srcSub: "/var/run/secrets/…", stored: 0,
      steps: [
        { e: ["app", "src"], line: 3, t: "The kubelet writes a short-lived Kubernetes service account token (a JWT, rotated automatically) into the pod. The app reads the file. It is a proof of 'I am pod X of service account Y', not a stored secret." },
        { e: ["app", "idp"], line: 3, t: "The app sends that JWT to Entra ID as a <b>client assertion</b>. Entra ID checks its signature against the cluster's public OIDC issuer and matches the subject <code>system:serviceaccount:shop:orders</code> to a federated credential." },
        { e: ["idp", "app"], line: 4, t: "Match: Entra ID returns an access token for Key Vault. No secret was configured anywhere; trust comes from the cluster's signing key." },
      ],
    },
  ];
  Viz.register("configuration-and-secrets-identity", (el) => Viz.player(el, {
    title: "Client secret vs managed identity vs workload identity: the token flow",
    tag: "PICK A MODE · STEP THROUGH",
    legend: [["active", "message in flight"], ["done", "completed"], ["bad", "a stored secret you must protect and rotate"], ["visit", "token valid"]],
    codeLang: "csharp",
    code: [
      "var credential = new DefaultAzureCredential();  // tries env, workload id, managed id, dev login",
      "// client secret: new ClientSecretCredential(tenant, clientId, secretFromConfig)",
      "// managed identity: new ManagedIdentityCredential()  -> local IMDS endpoint",
      "// workload identity: new WorkloadIdentityCredential() -> federated SA token",
      "var token = await credential.GetTokenAsync(new([\"https://vault.azure.net/.default\"]));",
      "var client = new SecretClient(vaultUri, credential);   // caches and refreshes tokens",
      "KeyVaultSecret s = await client.GetSecretAsync(\"Payments--ApiKey\");",
    ],
    inputs: [
      { key: "mode", label: "mode", type: "select", value: ID_MODES[1], options: ID_MODES },
      { key: "life", label: "token lifetime (min)", value: "60", width: 80 },
      { key: "hours", label: "hours to simulate", value: "6", width: 70 },
    ],
    random: () => ({ mode: pick(Math.random, ID_MODES), life: String(pick(Math.random, [10, 30, 60, 90, 1440])), hours: String(Viz.rand(2, 24)) }),
    build: ({ mode, life, hours }) => {
      const M = ID_MODES.indexOf(mode);
      if (M < 0) throw new Error("Pick a mode.");
      const LIFE = num(life, "token lifetime", 5, 1440), H = num(hours, "hours to simulate", 1, 48);
      const F = ID_FLOW[M], fr = [];
      const base = { M, F, edges: [], tokens: [], H, LIFE, kv: false };
      fr.push({ ...base, line: 0, note: `Goal: read <code>Payments--ApiKey</code> from Key Vault. To call Key Vault the app needs an access token from Entra ID, and to get a token it must prove who it is. Mode: <b>${esc(mode)}</b>. Secrets you must store for this proof: <b>${F.stored}</b>.`, vars: { mode: ["secret", "managed", "workload"][M], "stored secrets": F.stored } });
      const done = [];
      for (const st of F.steps) {
        fr.push({ ...base, edges: [...done.map((e) => ({ e, c: "done" })), { e: st.e, c: "active" }], line: st.line, note: st.t, vars: { step: `${st.e[0]} → ${st.e[1]}` } });
        done.push(st.e);
      }
      fr.push({ ...base, edges: [...done.map((e) => ({ e, c: "done" })), { e: ["app", "kv"], c: "active" }], line: 6, note: "GET the secret with <code>Authorization: Bearer &lt;token&gt;</code>. Key Vault validates the signature, audience and expiry, then checks RBAC (role <b>Key Vault Secrets User</b> on this identity).", vars: { step: "app → kv" } });
      done.push(["app", "kv"]);
      fr.push({ ...base, kv: true, edges: [...done.map((e) => ({ e, c: "done" })), { e: ["kv", "app"], c: "active" }], line: 6, note: "Key Vault returns the value. The app keeps it in memory, never on disk or in a log.", vars: { step: "kv → app" } });
      const ev = [];
      const skew = LIFE > 10 ? 5 : LIFE / 2;
      let t = 0, acquired = 0;
      while (t < H * 60) { ev.push([t, Math.min(t + LIFE, H * 60)]); acquired++; t += LIFE - skew; }
      const calls = H * 60;
      fr.push({ ...base, kv: true, edges: done.map((e) => ({ e, c: "done" })), tokens: ev, line: 5, note: `Over ${H} h the app makes ${calls.toLocaleString("en-US")} Key Vault calls (one a minute) but asks for only <b>${acquired}</b> tokens: the credential caches each token and refreshes it ${skew} min before expiry, so no request waits on Entra ID. ${M === 0 ? "The client secret itself still expires (typically within 6 to 24 months) and must be rotated by a person or a pipeline." : "Nothing here expires on a human timescale, and nothing needs rotating."}`, vars: { "token requests": acquired, "kv calls": calls } });
      fr.push({ ...base, kv: true, edges: done.map((e) => ({ e, c: "done" })), tokens: ev, line: 0, note: M === 0 ? "Score: 1 long-lived secret to store, protect, scan for and rotate, plus a 'secret zero' problem: where does the secret that unlocks the vault live? Use this only where no platform identity exists (another cloud, an on-premises box), and prefer a certificate or workload identity federation there too." : `Score: <b>0</b> stored secrets. The same <code>DefaultAzureCredential</code> line works on a developer laptop (Azure CLI or Visual Studio login), in ${M === 1 ? "App Service, Functions, VMs and Container Apps" : "AKS and any Kubernetes cluster with an OIDC issuer"}, so no environment-specific code. GitHub Actions can use the same federation to deploy without a stored secret.`, vars: { "stored secrets": F.stored } });
      return fr;
    },
    render: (f) => {
      const X = { app: 70, src: 210, idp: 350, kv: 490 };
      const node = (k, title, sub, cls) => `<g class="cfg-n ${cls}"><rect x="${X[k] - 62}" y="44" width="124" height="54" rx="9"/><text x="${X[k]}" y="67" text-anchor="middle" class="b">${esc(title)}</text><text x="${X[k]}" y="84" text-anchor="middle" class="cfg-lbl mono">${esc(sub)}</text></g>`;
      const used = (k) => f.edges.some((x) => x.e.includes(k));
      let s = `<svg class="cfg-svg" viewBox="0 0 560 ${f.tokens.length ? 250 : 190}" width="560" height="${f.tokens.length ? 250 : 190}" role="img" aria-label="token flow"><defs><marker id="configuration-and-secrets-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="cfg-ah"/></marker></defs>`;
      s += node("app", "your app", "orders-api", used("app") ? "done" : "");
      s += node("src", f.F.src, f.F.srcSub, f.M === 0 ? "bad" : used("src") ? "done" : "");
      s += node("idp", "Entra ID", "token endpoint", used("idp") ? "done" : "");
      s += node("kv", "Key Vault", f.kv ? "Payments--ApiKey ✓" : "Payments--ApiKey", used("kv") ? "done" : "");
      f.edges.forEach(({ e, c }) => {
        const [a, b] = e, fwd = X[b] > X[a];
        const x1 = X[a] + (fwd ? 0 : 0), x2 = X[b];
        const y = fwd ? 44 : 98, dy = fwd ? -22 - Math.abs(x2 - x1) / 18 : 22 + Math.abs(x2 - x1) / 18;
        s += `<path class="cfg-e ${c}" d="M${x1},${y} Q${(x1 + x2) / 2},${y + dy * 1.6} ${x2},${y}" marker-end="url(#configuration-and-secrets-ah)"/>`;
      });
      if (f.tokens.length) {
        const W = 520, x0 = 20, span = f.H * 60;
        s += `<text x="${x0}" y="168" class="cfg-lbl">access tokens over ${f.H} h (each bar = one token's validity; overlap = refreshed early)</text>`;
        f.tokens.slice(0, 200).forEach(([a, b], i) => { s += `<rect class="cfg-f-visit" x="${(x0 + (a / span) * W).toFixed(1)}" y="${176 + (i % 2) * 12}" width="${Math.max(1.5, ((b - a) / span) * W).toFixed(1)}" height="9" rx="2"/>`; });
        s += `<line class="cfg-gline" x1="${x0}" x2="${x0 + W}" y1="204" y2="204"/><text x="${x0}" y="218" class="cfg-lbl">0 h</text><text x="${x0 + W}" y="218" class="cfg-lbl" text-anchor="end">${f.H} h</text>`;
      }
      return `${s}</svg>`;
    },
  }));

  /* =====================================================================
   * 8. Rotating a secret without downtime
   * ===================================================================== */
  const RT_MODES = ["replace in place (one secret)", "two keys with overlap"];
  Viz.register("configuration-and-secrets-rotation", (el) => Viz.player(el, {
    title: "Rotating a secret: replace in place vs two keys with an overlap window",
    tag: "SET THE CACHE REFRESH · STEP THROUGH",
    legend: [["visit", "using key 1 (accepted)"], ["done", "using key 2 (accepted)"], ["bad", "using a key the server rejects"], ["path", "pod reloads its secrets"]],
    codeLang: "python",
    code: [
      "# in place: the old value stops working the moment the new one is set",
      "vault.set('db-password', new); db.set_password(new)",
      "# overlap: both keys valid while clients catch up",
      "db.add_key(key2); vault.set('db-key', key2)       # t = rotation start",
      "wait(max_client_cache_ttl + margin)               # every pod has reloaded",
      "assert last_used(key1) older than the wait; db.revoke(key1)",
    ],
    inputs: [
      { key: "mode", label: "strategy", type: "select", value: RT_MODES[0], options: RT_MODES },
      { key: "pods", label: "pods", value: "5", width: 60 },
      { key: "ttl", label: "secret cache refresh (min)", value: "15", width: 80 },
      { key: "revoke", label: "revoke key 1 after (min)", value: "30", width: 80 },
      seedInput,
    ],
    random: () => ({ mode: pick(Math.random, RT_MODES), pods: String(Viz.rand(3, 7)), ttl: String(pick(Math.random, [5, 10, 15, 30])), revoke: String(pick(Math.random, [5, 10, 20, 30, 45])), seed: randSeed() }),
    build: ({ mode, pods, ttl, revoke, seed }) => {
      const M = RT_MODES.indexOf(mode);
      if (M < 0) throw new Error("Pick a strategy.");
      const P = num(pods, "pods", 2, 8), TTL = num(ttl, "cache refresh", 1, 60), RV = num(revoke, "revoke after", 1, 120), r = rng(num(seed, "seed", 1, 99999));
      const START = 5, REVOKE = M === 0 ? START : START + RV, T = Math.min(160, START + Math.max(TTL, M ? RV : 0) + Math.max(6, Math.ceil(TTL / 2)) + 2);
      const RPM = 100;
      const pods_ = Array.from({ length: P }, (_, p) => {
        const off = r() * TTL, reloads = [];
        for (let x = off; x < T; x += TTL) reloads.push(x);
        const sw = reloads.find((x) => x >= START);
        return { name: `pod ${p + 1}`, reloads, sw: sw ?? Infinity, cells: [], failMin: 0 };
      });
      const keyAt = (pd, t) => (t >= pd.sw ? 2 : 1);
      const accepted = (t, k) => (k === 2 ? t >= START : t < REVOKE);
      for (const pd of pods_) for (let t = 0; t < T; t++) {
        let bad = 0;
        for (let q = 0; q < 10; q++) { const tt = t + q / 10; if (!accepted(tt, keyAt(pd, tt))) bad++; }
        const k = keyAt(pd, t + 0.5);
        const reload = pd.reloads.some((x) => x >= t && x < t + 1);
        pd.cells.push({ c: bad >= 5 ? "bad" : k === 2 ? "done" : "visit", reload });
        pd.failMin += bad / 10;
      }
      const events = [[START, "rotate"], ...pods_.map((pd, i) => [pd.sw, `switch${i}`]).filter(([x]) => x < T)];
      if (M === 1) events.push([REVOKE, "revoke"]);
      events.sort((a, b) => a[0] - b[0] || (a[1] === "revoke" ? 1 : -1));
      const fr = [];
      const snap = (t) => ({ T, t, pods: pods_.map((pd) => ({ name: pd.name, cells: pd.cells, fail: pd.cells.slice(0, Math.max(0, Math.ceil(t))).filter((c) => c.c === "bad").length })), START, REVOKE, M });
      const failedUntil = (t) => Math.round(pods_.reduce((a, pd) => {
        let m = 0;
        for (let x = 0; x < Math.min(t, T); x += 0.1) if (!accepted(x, keyAt(pd, x))) m += 0.1;
        return a + m;
      }, 0) * RPM);
      fr.push({ ...snap(START), line: M ? 2 : 0, note: `${P} pods read the secret from the vault and cache it, refreshing every <b>${TTL} min</b> at different moments (they started at different times). Rotation starts at minute ${START}. Strategy: <b>${esc(mode)}</b>.`, vars: { strategy: M ? "overlap" : "in place", "refresh min": TTL } });
      for (const [t, kind] of events) {
        let note, line;
        if (kind === "rotate") {
          note = M === 0 ? `Minute ${START}: the new password is set in the database <b>and</b> the vault at once. The old one stops working immediately, but every pod still has the old one cached.` : `Minute ${START}: key 2 is <b>added</b> next to key 1 (the server accepts both) and the vault now hands out key 2. Nobody is broken; pods switch whenever they next refresh.`;
          line = M ? 3 : 1;
        } else if (kind === "revoke") {
          const late = pods_.filter((pd) => pd.sw > REVOKE).map((pd) => pd.name);
          note = `Minute ${REVOKE.toFixed(0)}: key 1 is revoked. ${late.length ? `<b>${late.join(", ")}</b> ${late.length > 1 ? "have" : "has"} not refreshed yet and start failing: the overlap (${RV} min) is shorter than the cache refresh (${TTL} min).` : "Every pod already uses key 2, so nobody notices."}`;
          line = 5;
        } else {
          const i = Number(kind.slice(6)), pd = pods_[i];
          const wasBroken = M === 0 || pd.sw > REVOKE;
          note = `Minute ${t.toFixed(1)}: ${pd.name} refreshes and gets key 2${wasBroken ? `, after failing for ${(pd.sw - (M === 0 ? START : REVOKE)).toFixed(1)} min` : ""}.`;
          line = M ? 4 : 1;
        }
        fr.push({ ...snap(t + 0.01), line, note, vars: { minute: Number(t.toFixed(1)), "failed requests": failedUntil(t) } });
      }
      const total = failedUntil(T);
      fr.push({ ...snap(T), line: M ? 5 : 1, note: total ? `<b>${total.toLocaleString("en-US")}</b> failed requests (${RPM}/min per pod). ${M === 0 ? `In-place rotation always fails for up to one refresh interval per pod. Use two keys (most services offer primary/secondary keys or allow two active passwords).` : `Overlap of ${RV} min was shorter than the ${TTL} min refresh. Revoke only after the longest cache lifetime plus a margin, and check the old key's 'last used' time first.`}` : `<b>0</b> failed requests. Overlap (${RV} min) ≥ refresh interval (${TTL} min): every pod picked up key 2 before key 1 died. Automate this; a rotation that only a person can do will be skipped.`, vars: { "failed requests": total } });
      return fr;
    },
    render: (f) => {
      const cols = `grid-template-columns: 58px repeat(${f.T}, minmax(0, 1fr)) 38px;`;
      const cut = Math.ceil(f.t);
      const lbl = Array.from({ length: f.T }, (_, i) => `<span class="cfg-tick ${i === cut - 1 ? "cur" : ""}">${i % 10 === 0 ? i : ""}</span>`).join("");
      let s = `<div class="cfg-tl" style="${cols}"><span class="cfg-muted">minute</span>${lbl}<span class="cfg-muted">fail</span></div>`;
      const srv = Array.from({ length: f.T }, (_, i) => { const k1 = i < f.REVOKE, k2 = i >= f.START; return `<span class="cfg-cell cfg-srv ${i < cut ? "" : "pend"}">${i === f.START || (f.M && Math.floor(f.REVOKE) === i) ? (k1 && k2 ? "1+2" : k2 ? "2" : "1") : ""}</span>`; }).join("");
      s += `<div class="cfg-tl" style="${cols}"><span>server</span>${srv}<span></span></div>`;
      s += f.pods.map((pd) => `<div class="cfg-tl" style="${cols}"><span>${pd.name}</span>${pd.cells.map((c, i) => `<span class="cfg-cell ${i < cut ? c.c : ""} ${i < cut && c.reload ? "reload" : ""}"></span>`).join("")}<b class="${pd.fail ? "cfg-t-bad" : ""}">${pd.fail}</b></div>`).join("");
      return `<div class="cfg-tlwrap">${s}<div class="cfg-muted cfg-small">server row: which keys it accepts (1, 1+2, 2). Ringed cell: the pod reloaded its secrets that minute.</div></div>`;
    },
  }));

  /* =====================================================================
   * 9. Secret scanning: provider patterns vs entropy
   * ===================================================================== */
  const SC_RAND = (() => {
    const r = rng(20240611), A = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789";
    return (n, abc = A) => Array.from({ length: n }, () => abc[Math.floor(r() * abc.length)]).join("");
  })();
  const SC_LINES = [
    { file: ".env", text: `STRIPE_KEY=sk_${"live"}_${SC_RAND(24)}`, secret: true, kind: "live payment key" },
    { file: "appsettings.json", text: `"Orders": "Server=sql-prod;User Id=app;Password=Spr1ng-Thaw-42!"`, secret: true, kind: "database password" },
    { file: "deploy.yml", text: `aws_access_key_id: AKIA${SC_RAND(16, "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567")}`, secret: true, kind: "cloud access key id" },
    { file: "README.md", text: "Set API_KEY=<your-key-here> before running the sample", secret: false, kind: "placeholder" },
    { file: "package-lock.json", text: `"integrity": "sha512-${SC_RAND(86, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/")}=="`, secret: false, kind: "package hash" },
    { file: "config.py", text: `SECRET_KEY = "${SC_RAND(32)}"`, secret: true, kind: "framework signing key (no known prefix)" },
    { file: "build.go", text: `const commit = "${SC_RAND(40, "0123456789abcdef")}"`, secret: false, kind: "git commit id" },
    { file: "setup.sh", text: `export GITHUB_TOKEN=gh${"p"}_${SC_RAND(36)}`, secret: true, kind: "personal access token" },
    { file: "Tenant.cs", text: `var tenantId = "${SC_RAND(8, "0123456789abcdef")}-${SC_RAND(4, "0123456789abcdef")}-4${SC_RAND(3, "0123456789abcdef")}-a${SC_RAND(3, "0123456789abcdef")}-${SC_RAND(12, "0123456789abcdef")}";`, secret: false, kind: "tenant id (a public identifier)" },
    { file: "auth.test.ts", text: `const jwt = "eyJhbGciOiJIUzI1NiJ9.eyJzdWIiOiJ0ZXN0LXVzZXIifQ.${SC_RAND(43, "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789_-")}";`, secret: false, kind: "test-only token" },
  ];
  const SC_PATTERNS = [
    ["payment provider live key", /sk_live_[0-9A-Za-z]{24,}/],
    ["cloud access key id", /AKIA[0-9A-Z]{16}/],
    ["GitHub token", /gh[pousr]_[A-Za-z0-9]{36}/],
    ["password in connection string", /(?:password|pwd)\s*=\s*[^;"'\s]{6,}/i],
    ["JSON Web Token", /eyJ[A-Za-z0-9_-]+\.eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+/],
  ];
  const entropy = (s) => {
    const c = {};
    for (const ch of s) c[ch] = (c[ch] || 0) + 1;
    return Object.values(c).reduce((a, n) => a - (n / s.length) * Math.log2(n / s.length), 0);
  };
  const SC_MODES = ["provider patterns only", "patterns + entropy"];
  Viz.register("configuration-and-secrets-scanning", (el) => Viz.player(el, {
    title: "Secret scanning: what patterns catch, what entropy adds, and what it costs",
    tag: "TUNE THE SCANNER · STEP THROUGH A COMMIT",
    legend: [["done", "real secret caught"], ["bad", "real secret missed"], ["path", "false alarm"], ["dim", "correctly ignored"]],
    codeLang: "python",
    code: [
      "for line in diff.added_lines():",
      "    for name, rx in PROVIDER_PATTERNS:          # sk_live_, AKIA, ghp_, Password=",
      "        if rx.search(line): report(name)",
      "    for tok in re.findall(r'[A-Za-z0-9+/=_-]{%d,}' % min_len, line):",
      "        if shannon_entropy(tok) >= threshold:    # bits per character",
      "            report('high-entropy string')",
    ],
    inputs: [
      { key: "mode", label: "scanner", type: "select", value: SC_MODES[1], options: SC_MODES },
      { key: "th", label: "entropy threshold (bits/char)", value: "4.5", width: 80 },
      { key: "min", label: "min token length", value: "20", width: 70 },
    ],
    random: () => ({ mode: pick(Math.random, SC_MODES), th: String(pick(Math.random, [3.5, 4, 4.5, 5, 5.5])), min: String(pick(Math.random, [12, 16, 20, 24, 32])) }),
    build: ({ mode, th, min }) => {
      const M = SC_MODES.indexOf(mode);
      if (M < 0) throw new Error("Pick a scanner mode.");
      const TH = num(th, "entropy threshold", 1, 7, false), MIN = num(min, "min token length", 8, 64);
      const rows = [], fr = [];
      let tp = 0, fn = 0, fp = 0, tn = 0;
      fr.push({ rows: [], line: 0, note: `A commit adds ${SC_LINES.length} lines. ${SC_LINES.filter((l) => l.secret).length} contain real secrets. The scanner runs <b>${esc(mode)}</b>${M ? ` (threshold ${TH} bits/char, tokens of ${MIN}+ characters)` : ""}. For scale: random hex tops out at 4 bits/char, random base64 at 6.`, vars: { lines: SC_LINES.length, mode: M ? "patterns+entropy" : "patterns" } });
      for (const L of SC_LINES) {
        const pat = SC_PATTERNS.find(([, rx]) => rx.test(L.text));
        const toks = (L.text.match(new RegExp(`[A-Za-z0-9+/=_-]{${MIN},}`, "g")) || []).map((t) => ({ t, h: entropy(t) }));
        const hi = M ? toks.filter((x) => x.h >= TH).sort((a, b) => b.h - a.h)[0] : null;
        const best = toks.sort((a, b) => b.h - a.h)[0];
        const flagged = !!pat || !!hi;
        const cls = L.secret ? (flagged ? "done" : "bad") : flagged ? "path" : "dim";
        if (cls === "done") tp++; else if (cls === "bad") fn++; else if (cls === "path") fp++; else tn++;
        const why = pat ? `pattern "${pat[0]}"` : hi ? `entropy ${hi.h.toFixed(2)} ≥ ${TH}` : best ? `highest token entropy ${best.h.toFixed(2)}${M ? ` &lt; ${TH}` : " (entropy check off)"}` : `no token of ${MIN}+ characters`;
        rows.push({ file: L.file, text: L.text, cls, why, kind: L.kind });
        const verdict = { done: "Caught.", bad: "<b>Missed</b>: a real secret goes into history.", path: "<b>False alarm</b>: someone has to triage it, and too many teach people to click 'ignore'.", dim: "Correctly ignored." }[cls];
        fr.push({ rows: rows.slice(), line: pat ? [1, 2] : M ? [3, 4] : 1, note: `<code>${esc(L.file)}</code>: ${esc(L.kind)}. ${why}. ${verdict}`, vars: { caught: tp, missed: fn, "false alarms": fp } });
      }
      fr.push({ rows: rows.slice(), line: M ? 5 : 2, note: `Caught <b>${tp}</b> of ${tp + fn} real secrets with <b>${fp}</b> false alarms. ${fn ? "Provider patterns are precise but blind to secrets without a known shape (a framework signing key, a password in a free-form string). " : ""}${fp ? "Entropy finds unknown shapes but also hashes and ids; tune it and allow-list by path (lock files, test fixtures). " : ""}And a caught secret that was already pushed is <b>leaked</b>: rotate it first, then clean history. Push protection that blocks the commit is cheaper than any cleanup.`, vars: { caught: tp, missed: fn, "false alarms": fp } });
      return fr;
    },
    render: (f) => `<div class="cfg-scan">${f.rows.map((r) => `<div class="cfg-sline ${r.cls}"><span class="cfg-sfile">${esc(r.file)}</span><code title="${esc(r.text)}">${esc(trunc(r.text, 64))}</code><span class="cfg-swhy">${r.why}</span></div>`).join("") || '<div class="cfg-muted">nothing scanned yet</div>'}</div>`,
  }));
})();
