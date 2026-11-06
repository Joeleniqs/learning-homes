/* Visualizers for "Observability: Logs, Metrics & Traces". Frames come from seeded simulations run in build(). */
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
  const gauss = (r) => Math.sqrt(-2 * Math.log(Math.max(r(), 1e-12))) * Math.cos(2 * Math.PI * r());
  const num = (s, label, lo, hi, int = true) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isFinite(n) || n < lo || n > hi || (int && !Number.isInteger(n))) throw new Error(`${label} must be ${int ? "a whole number" : "a number"} from ${lo} to ${hi}.`);
    return n;
  };
  const hex = (r, n) => Array.from({ length: n }, () => "0123456789abcdef"[Math.floor(r() * 16)]).join("");
  const pctSorted = (s, p) => (s.length ? s[Math.min(s.length - 1, Math.max(0, Math.ceil((p / 100) * s.length) - 1))] : 0);
  const msf = (x) => (x >= 1000 ? `${(x / 1000).toFixed(2)} s` : x >= 10 ? `${Math.round(x)} ms` : `${x.toFixed(1)} ms`);
  const big = (n) => (n >= 1e9 ? `${(n / 1e9).toFixed(1)}B` : n >= 1e6 ? `${(n / 1e6).toFixed(1)}M` : n >= 1e4 ? `${(n / 1e3).toFixed(1)}k` : String(Math.round(n)));
  const seedInput = { key: "seed", label: "seed", value: "7", width: 70 };
  const randSeed = () => String(Viz.rand(1, 9999));
  const badge = (t, c) => `<span class="ob-badge ${c || ""}">${esc(t)}</span>`;

  /* Sparkline: values over a fixed x-range of n points. */
  const spark = (vals, o = {}) => {
    const W = o.w || 230, H = o.h || 58, P = 4, n = Math.max(2, o.n || vals.length);
    const fin = vals.filter((v) => Number.isFinite(v));
    const max = o.max ?? Math.max(1e-9, ...fin, ...(o.th || []).map((t) => t.v));
    const X = (i) => P + (i / (n - 1)) * (W - 2 * P);
    const Y = (v) => H - P - (Math.min(Math.max(v, 0), max) / max) * (H - 2 * P - 12);
    let s = `<svg class="ob-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "chart")}">`;
    s += `<rect class="ob-panel" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6"/>`;
    for (const t of o.th || []) s += `<line class="ob-s-${t.c || "bad"} ob-dash" x1="${P}" x2="${W - P}" y1="${Y(t.v)}" y2="${Y(t.v)}"/>`;
    if (o.mark !== undefined) s += `<line class="ob-grid" x1="${X(o.mark)}" x2="${X(o.mark)}" y1="${P + 10}" y2="${H - P}"/>`;
    const d = vals.map((v, i) => (Number.isFinite(v) ? `${X(i).toFixed(1)},${Y(v).toFixed(1)}` : null)).filter(Boolean);
    if (o.area && d.length) s += `<path class="ob-f-${o.cls || "visit"}" d="M${X(0)},${H - P} L${d.join(" L")} L${X(vals.length - 1)},${H - P} Z"/>`;
    if (d.length) s += `<path class="ob-s-${o.cls || "visit"} ob-thick" d="M${d.join(" L")}"/>`;
    if (o.title) s += `<text class="ob-lbl b" x="${P + 3}" y="13">${esc(o.title)}</text>`;
    if (o.value !== undefined) s += `<text class="ob-t-${o.cls || "visit"} b" x="${W - P - 3}" y="13" text-anchor="end">${esc(o.value)}</text>`;
    return s + "</svg>";
  };

  /* =====================================================================
   * 1. Which signal answers which question?
   * ===================================================================== */
  const VERDICT = { detects: ["detects", "visit"], localizes: ["localizes", "active"], explains: ["explains", "done"], hints: ["hints only", "path"], blind: ["blind", "bad"] };
  const PILLARS = [
    { k: "metrics", name: "Metrics", q: "Is it broken, how badly, since when?", line: [0, 1] },
    { k: "traces", name: "Traces", q: "Where in the call graph is the time or the error?", line: [2, 3] },
    { k: "logs", name: "Logs", q: "What happened to this one request, and why?", line: [4, 5] },
    { k: "profiles", name: "Profiles", q: "Which code burns the CPU or holds the memory?", line: [6, 7] },
  ];
  const SCEN = [
    {
      name: "Checkout p99 jumped from 300 ms to 2 s", series: "latency",
      metrics: ["detects", "p99 of http.server.duration jumps at 14:05 on POST /checkout. Rate and errors are flat."],
      traces: ["localizes", "Slow traces spend 1.6 s in 14 back-to-back inventory.check spans."],
      logs: ["explains", "Lines with that trace_id: 'per-item stock check enabled (flag inv-v2)'."],
      profiles: ["blind", "The CPU profile is flat: the request is waiting on I/O, not computing."],
      order: ["metrics", "traces", "logs", "profiles"],
      logLines: ["WARN inventory.check sku=812 took 118 ms", "INFO flag inv-v2 = on (rollout 100%)"],
      flame: [["Kestrel", 1], ["CheckoutHandler", 0.95], ["await (idle)", 0.9]], spans: [0.2, 0.15, 0.9, 0.1],
    },
    {
      name: "5% of POST /orders return HTTP 500", series: "errors",
      metrics: ["detects", "Error ratio 0.1% → 5%, only on pods running v41 (the version label)."],
      traces: ["localizes", "Every failing trace ends in a payments span with status ERROR after 30 ms."],
      logs: ["explains", "ERROR 'currency XOF not supported' with a stack trace, linked by trace_id."],
      profiles: ["blind", "A logic error does not change CPU or memory use."],
      order: ["metrics", "traces", "logs", "profiles"],
      logLines: ["ERROR NotSupportedException: currency XOF", "  at Payments.Fx.Convert(...)"],
      flame: [["Kestrel", 1], ["OrdersHandler", 0.7], ["Json", 0.3]], spans: [0.3, 0.2, 0.1, 0.05],
    },
    {
      name: "Memory grows until OOM every 6 hours", series: "memory",
      metrics: ["detects", "Heap after full GC climbs about 40 MB/h; the pod is OOM-killed near its 512 MB limit."],
      traces: ["blind", "Requests are fast and succeed. Every trace looks healthy."],
      logs: ["hints", "Only the kill event: 'OOMKilled, exit code 137'. No cause."],
      profiles: ["explains", "Heap snapshot diff: 2.1 M CacheEntry objects held by a static Dictionary."],
      order: ["metrics", "traces", "logs", "profiles"],
      logLines: ["INFO container restarted (OOMKilled)", "INFO exit code 137"],
      flame: [["static Dictionary", 1], ["CacheEntry[]", 0.85], ["string", 0.4]], spans: [0.2, 0.2, 0.2, 0.1],
    },
    {
      name: "One customer says order 8812 failed", series: "flat",
      metrics: ["blind", "One failure in 2 million requests vanishes in any aggregate. That is what aggregates are for."],
      traces: ["localizes", "Only if the trace was kept. Tail sampling keeps every error trace, so it is there."],
      logs: ["explains", "Search order_id=8812 → trace_id → 'card declined: insufficient funds' (HTTP 402)."],
      profiles: ["blind", "One request leaves no visible mark on a profile."],
      order: ["logs", "traces", "metrics", "profiles"],
      logLines: ["INFO order_id=8812 status=declined", "WARN card declined: insufficient_funds"],
      flame: [["Kestrel", 1], ["OrdersHandler", 0.6], ["Json", 0.3]], spans: [0.25, 0.2, 0.3, 0.15],
    },
  ];
  const seriesFor = (kind) => {
    const r = rng(kind.length * 97 + 3), out = [];
    for (let i = 0; i < 40; i++) {
      const g = gauss(r) * 0.08;
      if (kind === "latency") out.push((i < 24 ? 300 : 2000) * (1 + g));
      else if (kind === "errors") out.push((i < 22 ? 0.1 : 5) * (1 + g));
      else if (kind === "memory") out.push(Math.min(512, 180 + (i % 20) * 16.5 + g * 20));
      else out.push(1 + g);
    }
    return out;
  };
  const pillarMini = (sc, k, cls) => {
    if (k === "metrics") return spark(seriesFor(sc.series), { w: 210, h: 52, cls: cls === "bad" ? "dim" : "visit", area: true, label: "metric" });
    if (k === "traces") {
      let s = `<svg class="ob-svg" viewBox="0 0 210 52" width="210" height="52" role="img" aria-label="trace">`, x = 6;
      sc.spans.forEach((w, i) => { const W = w * 190; s += `<rect class="${i === sc.spans.indexOf(Math.max(...sc.spans)) && cls !== "bad" ? "ob-f-active" : "ob-f-visit"}" x="${x}" y="${6 + i * 11}" width="${Math.max(4, W)}" height="9" rx="2"/>`; x += W * 0.35; });
      return s + "</svg>";
    }
    if (k === "logs") return `<div class="ob-loglines">${sc.logLines.map((l) => `<code>${esc(l)}</code>`).join("")}</div>`;
    let s = `<svg class="ob-svg" viewBox="0 0 210 52" width="210" height="52" role="img" aria-label="flame graph">`;
    sc.flame.forEach(([n, w], i) => { s += `<rect class="${i === sc.flame.length - 1 && cls === "done" ? "ob-f-bad" : "ob-f-active"}" x="6" y="${36 - i * 15}" width="${w * 198}" height="13" rx="2"/><text class="ob-lbl" x="10" y="${46 - i * 15}">${esc(n)}</text>`; });
    return s + "</svg>";
  };

  Viz.register("observability-pillars", (el) => Viz.player(el, {
    title: "Which signal answers which question?",
    tag: "PICK AN INCIDENT · STEP THROUGH",
    legend: [["visit", "detects it"], ["active", "localizes it"], ["done", "explains it"], ["path", "hints only"], ["bad", "blind to it"]],
    codeLang: "python",
    code: [
      "# metrics: is it broken, how badly, since when?",
      "p99(http.server.duration) by route, version",
      "# traces: where in the call graph?",
      "traces where duration > 1s -> slowest span",
      "# logs: what happened to THIS request?",
      "logs where trace_id == '4bf92f...'",
      "# profiles: which code burns CPU / memory?",
      "flame(service='checkout', type=cpu|alloc)",
    ],
    inputs: [{ key: "s", label: "incident", type: "select", value: SCEN[0].name, options: SCEN.map((s) => s.name) }],
    build: ({ s }) => {
      const sc = SCEN.find((x) => x.name === s);
      if (!sc) throw new Error("Pick one of the listed incidents.");
      const fr = [], seen = [];
      fr.push({ sc, seen: [], cur: null, line: [0, 2, 4, 6], note: `Incident: <b>${esc(sc.name)}</b>. Four signals, four different questions. Step through them in the order an on-call engineer would reach for them.`, vars: { incident: sc.name } });
      for (const k of sc.order) {
        seen.push(k);
        const p = PILLARS.find((x) => x.k === k), [v, why] = sc[k];
        const verdict = VERDICT[v][0];
        fr.push({ sc, seen: [...seen], cur: k, line: p.line, note: `<b>${p.name}</b> answer "${p.q}" Here it <b>${verdict}</b> the problem. ${esc(why)}`, vars: { signal: p.name, verdict } });
      }
      const chain = sc.order.filter((k) => sc[k][0] !== "blind").map((k) => PILLARS.find((x) => x.k === k).name);
      fr.push({ sc, seen: [...seen], cur: null, line: sc.order.filter((k) => sc[k][0] !== "blind").map((k) => PILLARS.find((x) => x.k === k).line[1]), note: `Useful path: <b>${chain.join(" → ")}</b>. No single signal was enough; the <b>trace_id</b> on every log line and the exemplar on every histogram are what let you jump between them.`, vars: { path: chain.join(" → ") } });
      return fr;
    },
    render: (f) => `<div class="ob-pillars">${PILLARS.map((p) => {
      const shown = f.seen.includes(p.k);
      const [v, why] = f.sc[p.k];
      const cls = shown ? VERDICT[v][1] : "";
      return `<div class="ob-card ${cls} ${f.cur === p.k ? "cur" : ""} ${shown ? "" : "pending"}">
        <div class="ob-card-h"><b>${p.name}</b>${shown ? badge(VERDICT[v][0], cls) : badge("?", "")}</div>
        <div class="ob-q">${esc(p.q)}</div>${pillarMini(f.sc, p.k, cls)}
        ${shown ? `<div class="ob-why">${esc(why)}</div>` : ""}</div>`;
    }).join("")}</div>`,
  }));

  /* =====================================================================
   * 2. Message templates vs string interpolation
   * ===================================================================== */
  Viz.register("observability-templates", (el) => Viz.player(el, {
    title: "Interpolated strings vs message templates",
    legend: [["done", "stored and queryable"], ["dim", "filtered by level"], ["bad", "wasted work"], ["visit", "property"]],
    codeLang: "csharp",
    code: [
      "// A: interpolation builds the string BEFORE the call",
      "log.LogInformation($\"Order {id} took {ms} ms\");",
      "log.LogDebug($\"Cache miss for {key}\");",
      "// B: a message template captures named values",
      "log.LogInformation(\"Order {OrderId} took {Elapsed} ms\", id, ms);",
      "log.LogDebug(\"Cache miss for {Key}\", key);",
      "// query: Elapsed > 500  (B: a field filter; A: a regex)",
    ],
    inputs: [
      { key: "n", label: "log calls", value: "14", width: 70 },
      { key: "dbg", label: "debug share %", value: "40", width: 80 },
      { key: "min", label: "minimum level", type: "select", value: "Information", options: ["Debug", "Information"] },
      seedInput,
    ],
    random: () => ({ n: String(Viz.rand(6, 24)), dbg: String(Viz.rand(10, 70)), seed: randSeed() }),
    build: ({ n, dbg, min, seed }) => {
      const N = num(n, "log calls", 1, 30), D = num(dbg, "debug share", 0, 100), r = rng(num(seed, "seed", 1, 99999));
      const debugOn = min === "Debug";
      const A = { formatted: 0, stored: [], distinct: new Set() }, B = { formatted: 0, stored: [], distinct: new Set() };
      const snap = () => ({ A: { formatted: A.formatted, stored: A.stored.slice(-4), distinct: A.distinct.size, total: A.stored.length }, B: { formatted: B.formatted, stored: B.stored.slice(-4), distinct: B.distinct.size, total: B.stored.length } });
      const fr = [], events = [];
      fr.push({ ...snap(), line: [1, 4], note: `Both versions log the same ${N} events with the minimum level at <b>${min}</b>. Watch what each one stores and how much work is wasted on lines nobody keeps.`, vars: { calls: 0, minLevel: min } });
      for (let i = 0; i < N; i++) {
        const isDebug = r() * 100 < D;
        const ev = isDebug ? { lvl: "Debug", key: `sku:${100 + Math.floor(r() * 40)}` } : { lvl: "Information", id: 1000 + i * 7, ms: Math.round(60 * Math.exp(0.9 * gauss(r))) };
        events.push(ev);
        const enabled = !isDebug || debugOn;
        const text = isDebug ? `Cache miss for ${ev.key}` : `Order ${ev.id} took ${ev.ms} ms`;
        A.formatted++;
        if (enabled) { A.stored.push({ text }); A.distinct.add(text); }
        if (enabled) {
          B.formatted++;
          const tpl = isDebug ? "Cache miss for {Key}" : "Order {OrderId} took {Elapsed} ms";
          B.stored.push({ tpl, props: isDebug ? { Key: ev.key } : { OrderId: ev.id, Elapsed: ev.ms } }); B.distinct.add(tpl);
        }
        const why = enabled
          ? (isDebug ? "Debug is enabled, so both store it." : `A stores a unique string; B stores the template plus <code>OrderId=${ev.id}</code>, <code>Elapsed=${ev.ms}</code>.`)
          : "Debug is below the minimum level. B checks <code>IsEnabled</code> first and does nothing; A already paid to format the string, then threw it away.";
        fr.push({ ...snap(), last: { lvl: ev.lvl, enabled, text }, line: isDebug ? [2, 5] : [1, 4], note: `Call ${i + 1}: <b>${esc(text)}</b> (${ev.lvl}). ${why}`, vars: { calls: i + 1, "A distinct msgs": A.distinct.size, "B templates": B.distinct.size, "A wasted formats": A.formatted - A.stored.length } });
      }
      const slow = events.filter((e) => e.lvl === "Information" && e.ms > 500).length;
      const infoCount = events.filter((e) => e.lvl === "Information").length;
      fr.push({ ...snap(), query: slow, line: 6, note: `Query "orders slower than 500 ms": B filters the numeric field <code>Elapsed &gt; 500</code> and finds <b>${slow}</b> of ${infoCount} orders. A must regex-parse ${A.stored.length} strings, and the query silently breaks the day someone rewords the message. Grouping: B has <b>${B.distinct.size}</b> message types; A has <b>${A.distinct.size}</b> "different" messages.`, vars: { "slow orders": slow, "A distinct": A.distinct.size, "B templates": B.distinct.size } });
      return fr;
    },
    render: (f) => {
      const side = (name, s, kind) => `<div class="ob-side"><div class="ob-side-h">${name}</div>
        <div class="ob-stats"><span>formatted <b class="${kind === "A" && s.formatted > s.total ? "ob-t-bad" : ""}">${s.formatted}</b></span><span>stored <b>${s.total}</b></span><span>${kind === "A" ? "distinct msgs" : "templates"} <b>${s.distinct}</b></span></div>
        <div class="ob-recs">${s.stored.map((x) => kind === "A" ? `<div class="ob-rec"><code>${esc(x.text)}</code></div>` : `<div class="ob-rec"><code class="ob-muted">${esc(x.tpl)}</code><div>${Object.entries(x.props).map(([k, v]) => `<span class="ob-prop">${esc(k)}=${esc(v)}</span>`).join("")}</div></div>`).join("") || '<div class="ob-muted">nothing stored yet</div>'}</div></div>`;
      const last = f.last ? `<div class="ob-lastcall ${f.last.enabled ? "done" : "dim"}">${esc(f.last.lvl)}: ${esc(f.last.text)} ${f.last.enabled ? "" : badge("below min level", "bad")}</div>` : "";
      return `<div class="ob-col">${last}<div class="ob-two">${side("A · interpolated", f.A, "A")}${side("B · template", f.B, "B")}</div>${f.query !== undefined ? `<div class="ob-banner done">Elapsed &gt; 500 → ${f.query} order(s)</div>` : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 3. Levels and sampling
   * ===================================================================== */
  const LEVELS = ["Trace", "Debug", "Information", "Warning", "Error"];
  const hash32 = (s) => { let h = 0x811c9dc5; for (const c of s) { h ^= c.charCodeAt(0); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  Viz.register("observability-levels", (el) => Viz.player(el, {
    title: "Log levels, then sampling: what survives?",
    legend: [["done", "kept"], ["bad", "kept: warning or error"], ["path", "rescued by flush-on-error"], ["dim", "sampled out"], ["visit", "below min level"]],
    codeLang: "python",
    code: [
      "if level < min_level: drop            # 1 cheapest filter",
      "if level >= WARNING: keep             # 2 never sample problems",
      "per-line:  keep if random() < rate",
      "per-trace: keep if hash(trace_id) % 100 < rate",
      "flush-on-error: buffer the request's lines;",
      "    on error emit the buffer, else discard it",
    ],
    inputs: [
      { key: "min", label: "minimum level", type: "select", value: "Debug", options: LEVELS.slice(0, 4) },
      { key: "mode", label: "sampling", type: "select", value: "per-trace", options: ["none", "per-line", "per-trace", "flush-on-error"] },
      { key: "rate", label: "keep %", value: "30", width: 60 },
      { key: "n", label: "requests", value: "8", width: 60 },
      seedInput,
    ],
    random: () => ({ rate: String(Viz.rand(5, 60)), n: String(Viz.rand(4, 12)), seed: randSeed() }),
    build: ({ min, mode, rate, n, seed }) => {
      const R = num(rate, "keep %", 0, 100), N = num(n, "requests", 1, 12), r = rng(num(seed, "seed", 1, 99999));
      const minI = LEVELS.indexOf(min);
      if (minI < 0) throw new Error("Pick a minimum level.");
      const reqs = [];
      for (let q = 0; q < N; q++) {
        const tid = hex(r, 6), err = r() < 0.3, lines = [];
        lines.push(2);
        const k = 2 + Math.floor(r() * 4);
        for (let j = 0; j < k; j++) lines.push(r() < 0.45 ? 0 : r() < 0.7 ? 1 : r() < 0.85 ? 2 : 3);
        if (err) lines.push(4);
        lines.push(2);
        reqs.push({ tid, err, lines: lines.map((l) => ({ l })) });
      }
      let emitted = 0, kept = 0, total = 0;
      const done = [], fr = [];
      const snap = (extra) => ({ reqs: done.map((x) => ({ ...x, lines: x.lines.map((l) => ({ ...l })) })), ...extra });
      fr.push(snap({ line: 0, note: `${N} requests, each a handful of lines. Level filter first (it costs nothing), then <b>${mode}</b> sampling at ${R}%. Errors and warnings are never sampled.`, vars: { min, mode, rate: `${R}%` } }));
      for (const q of reqs) {
        const sampledTrace = hash32(q.tid) % 100 < R;
        for (const ln of q.lines) {
          total++;
          if (ln.l < minI) { ln.s = "visit"; continue; }
          emitted++;
          if (ln.l >= 3) ln.s = "bad";
          else if (mode === "none") ln.s = "done";
          else if (mode === "per-line") ln.s = r() * 100 < R ? "done" : "dim";
          else if (mode === "per-trace") ln.s = sampledTrace ? "done" : "dim";
          else ln.s = sampledTrace ? "done" : q.err ? "path" : "dim";
          if (ln.s !== "dim") kept++;
        }
        const relevant = q.lines.filter((x) => x.s !== "visit");
        const complete = relevant.every((x) => x.s !== "dim");
        q.complete = complete;
        done.push(q);
        const story = q.err ? (complete ? "This failing request kept its <b>whole story</b>: every line before the error is there." : "This failing request kept the error line but <b>lost the lines leading up to it</b>, which are the ones you need.") : (complete ? "Kept whole." : relevant.some((x) => x.s !== "dim") ? "Only some lines kept: a fragment of a story." : "Dropped entirely: fine, nothing went wrong.");
        const line = mode === "per-line" ? 2 : mode === "per-trace" ? 3 : mode === "flush-on-error" ? [4, 5] : 1;
        fr.push(snap({ cur: q.tid, line, note: `trace <code>${q.tid}</code>${q.err ? " <b>ends in an error</b>" : ""}${mode === "per-trace" || mode === "flush-on-error" ? `, hash bucket ${hash32(q.tid) % 100} → ${sampledTrace ? "sampled in" : "sampled out"}` : ""}. ${story}`, vars: { total, emitted, kept, "kept %": total ? Math.round((100 * kept) / total) : 0 } }));
      }
      const errs = reqs.filter((q) => q.err), whole = errs.filter((q) => q.complete).length;
      fr.push(snap({ line: [0, 1], note: `Kept <b>${kept}</b> of ${total} lines (${Math.round((100 * kept) / Math.max(1, total))}%). Failing requests with a complete story: <b>${whole} of ${errs.length}</b>. ${mode === "per-line" ? "Per-line sampling cuts volume but shreds stories." : mode === "flush-on-error" ? "Flush-on-error keeps volume low and every failure's full context, at the cost of buffering each request in memory." : mode === "per-trace" ? "Per-trace sampling keeps whole stories, but only for the lucky traces." : "No sampling: complete, and the most expensive."}`, vars: { total, emitted, kept, "complete failures": `${whole}/${errs.length}` } }));
      return fr;
    },
    render: (f) => `<div class="ob-reqs">${f.reqs.length ? f.reqs.map((q) => `<div class="ob-req ${q.tid === f.cur ? "cur" : ""}"><code class="ob-tid">${q.tid}</code>${q.lines.map((x) => `<span class="ob-lv ${x.s}" title="${LEVELS[x.l]}">${LEVELS[x.l][0]}</span>`).join("")}${q.err ? badge(q.complete ? "full story" : "partial", q.complete ? "done" : "bad") : ""}</div>`).join("") : '<div class="ob-muted">requests appear here</div>'}</div>
      <div class="ob-key">T Trace · D Debug · I Information · W Warning · E Error</div>`,
  }));

  /* =====================================================================
   * 4. A trace id travelling across services (W3C traceparent)
   * ===================================================================== */
  const SVC = {
    gw: { name: "Gateway", x: 95, y: 48 }, ord: { name: "Orders", x: 400, y: 48 }, pay: { name: "Payments", x: 705, y: 48 },
    kfk: { name: "Kafka: order-placed", x: 240, y: 158 }, ful: { name: "Fulfillment", x: 520, y: 158 }, mail: { name: "Email", x: 800, y: 158 },
  };
  const HOPS = [
    { to: "gw", from: null, kind: "edge", msg: "POST /checkout received", lvl: "INFO", line: [0, 1, 2] },
    { to: "ord", from: "gw", kind: "http", msg: "order 8812 created, 3 items", lvl: "INFO", line: [3, 0, 1, 2] },
    { to: "pay", from: "ord", kind: "http", msg: "charged 42.00 EUR", lvl: "INFO", line: [3, 0, 1, 2] },
    { to: "kfk", from: "ord", kind: "msg", msg: null, lvl: null, line: [4] },
    { to: "ful", from: "kfk", kind: "consume", msg: "picking 3 items for order 8812", lvl: "INFO", line: [5, 1, 2] },
    { to: "mail", from: "ful", kind: "http", msg: "SMTP timeout after 30 s, confirmation not sent", lvl: "ERROR", line: [3, 0, 1, 2] },
  ];
  Viz.register("observability-correlation", (el) => Viz.player(el, {
    title: "One trace id, six hops: propagation across HTTP and a queue",
    tag: "W3C TRACEPARENT",
    legend: [["done", "joined the trace"], ["active", "current hop"], ["bad", "context lost: new trace"], ["path", "header carried"]],
    codeLang: "csharp",
    code: [
      "var parent = propagator.Extract(incomingHeaders); // may be empty",
      "using var span = tracer.StartActiveSpan(name, parent); // new span id",
      "log.LogInformation(...); // scope adds trace_id + span_id",
      "outgoingHttp.Headers[\"traceparent\"] = $\"00-{traceId}-{span.Id}-01\";",
      "producerMsg.Headers[\"traceparent\"] = ...; // queues need it too",
      "var parent = propagator.Extract(consumedMsg.Headers);",
    ],
    inputs: [
      { key: "mode", label: "propagation", type: "select", value: "everywhere", options: ["everywhere", "lost at the queue", "none"] },
      seedInput,
    ],
    random: () => ({ seed: randSeed() }),
    build: ({ mode, seed }) => {
      const r = rng(num(seed, "seed", 1, 99999));
      const nodes = {}, edges = [], logs = [];
      let firstTrace = null;
      const fr = [];
      const snap = (extra) => ({ nodes: Viz.clone(nodes), edges: Viz.clone(edges), logs: Viz.clone(logs), ...extra });
      fr.push(snap({ line: 0, note: `A checkout request will cross six hops: three synchronous HTTP calls and one Kafka message. Mode: <b>${esc(mode)}</b>. Each hop must read the incoming <code>traceparent</code>, start a child span, and write the header on every outgoing call.`, vars: { mode } }));
      for (const h of HOPS) {
        const parent = h.from ? nodes[h.from] : null;
        let carried = !!parent;
        if (mode === "none") carried = false;
        if (mode === "lost at the queue" && h.kind === "msg") carried = false;
        if (h.kind === "consume" && parent && !parent.carried) carried = false;
        const traceId = carried ? parent.traceId : hex(r, 32);
        const spanId = hex(r, 16);
        if (!firstTrace) firstTrace = traceId;
        const joined = traceId === firstTrace;
        nodes[h.to] = { traceId, spanId, parentSpan: carried ? parent.spanId : null, joined, carried, kind: h.kind };
        if (h.from) edges.push({ from: h.from, to: h.to, carried, header: carried ? `00-${traceId.slice(0, 4)}…-${parent.spanId.slice(0, 4)}…-01` : "no traceparent" });
        if (h.msg) logs.push({ svc: SVC[h.to].name, tid: traceId, lvl: h.lvl, msg: h.msg });
        let why;
        if (!h.from) why = "No incoming header, so the Gateway starts a new trace: a random 16-byte trace id and an 8-byte span id.";
        else if (h.kind === "msg") why = carried ? "The producer copies <code>traceparent</code> into the <b>message headers</b>. A queue is just another hop." : "The producer sends the message <b>without headers</b>. Auto-instrumentation often covers HTTP but not your custom producer wrapper, so the context stops here.";
        else if (h.kind === "consume") why = carried ? "The consumer extracts the context from the message headers. Fulfillment's span is a child of Orders, even though it ran later on another machine." : "Nothing to extract, so Fulfillment starts a <b>brand-new trace</b>. Everything downstream is now invisible from the original request.";
        else why = carried ? `${SVC[h.to].name} reads the header: same trace id, new span id, parent = ${SVC[h.from].name}'s span.` : `No header arrived, so ${SVC[h.to].name} starts its own trace. Its logs carry an id nobody will search for.`;
        fr.push(snap({ cur: h.to, line: h.line, note: `<b>${esc(SVC[h.to].name)}</b>: ${why}`, vars: { trace_id: traceId.slice(0, 12) + "…", span_id: spanId, parent: carried ? parent.spanId : "(root)" } }));
      }
      const found = logs.filter((l) => l.tid === firstTrace).length;
      const errFound = logs.some((l) => l.lvl === "ERROR" && l.tid === firstTrace);
      fr.push(snap({ query: firstTrace, line: 2, note: `Support pastes the trace id from the Gateway's error page and searches the logs: <b>${found} of ${logs.length}</b> lines match. ${errFound ? "The SMTP timeout is right there, attached to order 8812." : "<b>The SMTP timeout is missing</b>. It exists, but under a different trace id, so the customer's 'no confirmation email' ticket goes nowhere."}`, vars: { query: `trace_id=${firstTrace.slice(0, 8)}…`, matched: `${found}/${logs.length}`, "error found": errFound } }));
      return fr;
    },
    render: (f) => {
      let s = `<svg class="ob-svg ob-flow" viewBox="0 0 900 205" role="img" aria-label="services">`;
      s += `<defs><marker id="observability-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="ob-arrowhead" d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
      for (const e of f.edges) {
        const a = SVC[e.from], b = SVC[e.to];
        const x1 = a.x + (b.y === a.y ? 75 : 0), y1 = a.y + (b.y === a.y ? 0 : 24), x2 = b.x - (b.y === a.y ? 78 : 0), y2 = b.y - (b.y === a.y ? 0 : 26);
        s += `<line class="ob-s-${e.carried ? "path" : "bad"} ob-thick ${e.carried ? "" : "ob-dash"}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" marker-end="url(#observability-arr)"/>`;
        const mx = (x1 + x2) / 2, my = (y1 + y2) / 2 + (b.y === a.y ? -8 : 14);
        s += `<text class="ob-lbl mono ${e.carried ? "" : "ob-t-bad"}" x="${b.y === a.y ? mx : mx + 8}" y="${my}" text-anchor="${b.y === a.y ? "middle" : "start"}">${esc(e.header)}</text>`;
      }
      for (const [k, v] of Object.entries(SVC)) {
        const n = f.nodes[k];
        const cls = !n ? "" : k === f.cur ? "active" : n.joined ? "done" : "bad";
        s += `<g class="ob-n ${cls}"><rect x="${v.x - 75}" y="${v.y - 24}" width="150" height="48" rx="8"/>`;
        s += `<text class="ob-lbl b" x="${v.x}" y="${v.y - 6}" text-anchor="middle">${esc(v.name)}</text>`;
        s += `<text class="ob-lbl mono" x="${v.x}" y="${v.y + 12}" text-anchor="middle">${n ? `trace ${n.traceId.slice(0, 6)}… span ${n.spanId.slice(0, 4)}` : "waiting"}</text></g>`;
      }
      s += "</svg>";
      const rows = f.logs.map((l) => {
        const cls = f.query ? (l.tid === f.query ? "done" : "bad") : "";
        return `<tr class="${cls}"><td>${esc(l.svc)}</td><td><code>${l.tid.slice(0, 10)}…</code></td><td>${l.lvl === "ERROR" ? badge("ERROR", "bad") : esc(l.lvl)}</td><td>${esc(l.msg)}</td></tr>`;
      }).join("");
      return `<div class="ob-col">${s}<table class="ob-tbl"><thead><tr><th>service</th><th>trace_id</th><th>level</th><th>message</th></tr></thead><tbody>${rows || '<tr><td colspan="4" class="ob-muted">log lines appear here</td></tr>'}</tbody></table></div>`;
    },
  }));

  /* =====================================================================
   * 5. Cardinality explosion
   * ===================================================================== */
  const parseLabels = (s) => {
    const parts = String(s).split(",").map((x) => x.trim()).filter(Boolean);
    if (!parts.length || parts.length > 8) throw new Error("Give 1 to 8 labels as name:count, separated by commas.");
    return parts.map((p) => {
      const m = /^([a-z_][a-z0-9_]*)\s*:\s*(\d+)$/i.exec(p);
      if (!m) throw new Error(`"${p}" is not name:count (for example route:40).`);
      const c = Number(m[2]);
      if (c < 1 || c > 10000000) throw new Error(`${m[1]} must have 1 to 10,000,000 values.`);
      return { name: m[1], count: c };
    });
  };
  Viz.register("observability-cardinality", (el) => Viz.player(el, {
    title: "Cardinality: every label multiplies the series count",
    legend: [["done", "comfortable"], ["path", "getting expensive"], ["bad", "explosion"], ["visit", "after the fix"]],
    codeLang: "typescript",
    code: [
      "const h = meter.createHistogram('http.server.duration');",
      "h.record(ms, { method, route, status, pod });  // bounded labels",
      "h.record(ms, { ..., user_id });  // unbounded: one series per user",
      "// series = product of label values x (buckets + 3)",
      "// fix: keep user_id in traces and logs, not metric labels",
    ],
    inputs: [
      { key: "labels", label: "labels", value: "method:4, route:40, status:8, pod:30, user_id:50000", width: 340 },
      { key: "b", label: "histogram buckets (0 = counter)", value: "12", width: 60 },
      { key: "max", label: "max values per label", value: "100", width: 70 },
    ],
    random: () => ({ labels: `method:${Viz.rand(2, 6)}, route:${Viz.rand(5, 80)}, status:${Viz.rand(3, 12)}, pod:${Viz.rand(3, 60)}${Math.random() < 0.6 ? `, user_id:${Viz.rand(1000, 90000)}` : ""}`, b: String([0, 8, 12, 20][Viz.rand(0, 3)]), max: String(Viz.rand(50, 500)) }),
    build: ({ labels, b, max }) => {
      const L = parseLabels(labels), B = num(b, "buckets", 0, 60), M = num(max, "max values per label", 1, 100000);
      const per = B === 0 ? 1 : B + 3;
      const rows = [{ name: "base", count: per, series: per, label: B === 0 ? "1 counter series" : `${B} buckets + Inf + sum + count` }];
      const fr = [];
      const sev = (n) => (n < 1e4 ? "done" : n < 1e6 ? "path" : "bad");
      const bytes = (n) => { const kb = n * 3; return kb >= 1e12 ? `${(kb / 1e12).toFixed(1)} PB` : kb >= 1e9 ? `${(kb / 1e9).toFixed(1)} TB` : kb >= 1e6 ? `${(kb / 1e6).toFixed(1)} GB` : kb >= 1e3 ? `${(kb / 1e3).toFixed(1)} MB` : `${kb} KB`; };
      fr.push({ rows: Viz.clone(rows), line: [0, 3], note: `One ${B === 0 ? "counter" : "histogram"} with no labels is <b>${per}</b> time series${B === 0 ? "" : ` (one per bucket boundary, plus +Inf, _sum and _count)`}. Every label you add multiplies that by its number of distinct values.`, vars: { series: per } });
      let total = per;
      L.forEach((l, i) => {
        total *= l.count;
        const s = sev(total);
        rows.push({ name: l.name, count: l.count, series: total, sev: s, big: l.count > M });
        const tone = l.count > M ? `<b>${esc(l.name)}</b> is unbounded in practice: it grows with users or ids, not with your code.` : `${l.count} values is bounded: it only changes when you deploy new code or pods.`;
        fr.push({ rows: Viz.clone(rows), cur: i + 1, line: l.count > M ? 2 : 1, note: `× ${esc(l.name)} (${l.count.toLocaleString("en-US")} values) → <b>${big(total)}</b> series. ${tone} At roughly 3 KB of memory per active series in a Prometheus-style store, that is about <b>${bytes(total)}</b>.`, vars: { label: l.name, values: l.count, series: big(total), memory: bytes(total) } });
      });
      const kept = L.filter((l) => l.count <= M), dropped = L.filter((l) => l.count > M);
      const fixed = kept.reduce((a, l) => a * l.count, per);
      fr.push({ rows: Viz.clone(rows), fixed, dropped: dropped.map((d) => d.name), line: 4, note: dropped.length ? `Fix: drop ${dropped.map((d) => `<b>${esc(d.name)}</b>`).join(", ")} from the metric and put it on the trace span or log line instead, where high cardinality is cheap. Series fall from ${big(total)} to <b>${big(fixed)}</b> (${bytes(fixed)}). The product is an upper bound; real stores only hold combinations that occur, but unbounded labels make that number grow with traffic.` : `Every label has at most ${M} values, so ${big(total)} series is a choice, not an accident. Still check that each label is used in a dashboard or alert; unused labels are pure cost.`, vars: { before: big(total), after: big(fixed), dropped: dropped.map((d) => d.name).join(", ") || "none" } });
      return fr;
    },
    render: (f) => {
      const maxS = Math.max(10, ...f.rows.map((r) => r.series));
      const lg = (n) => Math.log10(Math.max(1, n)) / Math.log10(maxS);
      const rows = f.rows.map((r, i) => `<div class="ob-crow ${i === f.cur ? "cur" : ""}"><span class="ob-cname">${i === 0 ? esc(r.name) : `× ${esc(r.name)}`} <small>${i === 0 ? esc(r.label) : r.count.toLocaleString("en-US")}</small></span><span class="ob-cbar"><span class="ob-cfill ${r.sev || "done"}" style="width:${(lg(r.series) * 100).toFixed(1)}%"></span></span><b class="ob-cval">${big(r.series)}</b>${r.big ? badge("unbounded", "bad") : ""}</div>`).join("");
      const fix = f.fixed !== undefined ? `<div class="ob-crow"><span class="ob-cname">after fix <small>${esc(f.dropped.join(", ") || "nothing dropped")}</small></span><span class="ob-cbar"><span class="ob-cfill visit" style="width:${(lg(f.fixed) * 100).toFixed(1)}%"></span></span><b class="ob-cval">${big(f.fixed)}</b></div>` : "";
      return `<div class="ob-col"><div class="ob-muted ob-small">series count (bar length on a log scale)</div>${rows}${fix}</div>`;
    },
  }));

  /* =====================================================================
   * 6. Histograms, percentiles and why you cannot average p99s
   * ===================================================================== */
  const BUCKETS = {
    "Prometheus default": [5, 10, 25, 50, 100, 250, 500, 1000, 2500, 5000, 10000],
    "dense near a 300 ms SLO": [50, 100, 150, 200, 250, 300, 350, 400, 500, 750, 1000, 2000, 5000],
    "coarse (3 buckets)": [100, 1000, 10000],
  };
  const hq = (q, bounds, counts) => {
    const total = counts.reduce((a, c) => a + c, 0);
    if (!total) return 0;
    const rank = q * total;
    let cum = 0;
    for (let i = 0; i < counts.length; i++) {
      if (cum + counts[i] >= rank) {
        if (i === bounds.length) return bounds[bounds.length - 1];
        const lo = i === 0 ? 0 : bounds[i - 1], hi = bounds[i];
        return lo + ((hi - lo) * (rank - cum)) / Math.max(1, counts[i]);
      }
      cum += counts[i];
    }
    return bounds[bounds.length - 1];
  };
  const bucketize = (xs, bounds) => {
    const c = new Array(bounds.length + 1).fill(0);
    for (const x of xs) { let i = bounds.findIndex((b) => x <= b); if (i < 0) i = bounds.length; c[i]++; }
    return c;
  };
  Viz.register("observability-histogram", (el) => Viz.player(el, {
    title: "Percentiles from histograms: merge buckets, never average p99s",
    legend: [["visit", "pod histogram"], ["active", "current step"], ["bad", "wrong answer"], ["done", "right answer"]],
    codeLang: "python",
    code: [
      "# per pod, the client library only counts per bucket",
      "le_bucket[i] += 1 where latency <= bound[i]",
      "# WRONG: average of per-pod p99s",
      "avg(p99_pod_a, p99_pod_b, p99_pod_c)",
      "# RIGHT: sum buckets across pods, then estimate",
      "histogram_quantile(0.99, sum by (le) (rate(bucket[5m])))",
      "# SLO: good / total, exact only at a bucket boundary",
    ],
    inputs: [
      { key: "bk", label: "buckets", type: "select", value: "Prometheus default", options: Object.keys(BUCKETS) },
      { key: "slow", label: "slow pod share %", value: "5", width: 60 },
      { key: "n", label: "requests", value: "3000", width: 70 },
      seedInput,
    ],
    random: () => ({ slow: String(Viz.rand(3, 40)), n: String(Viz.rand(500, 6000)), seed: randSeed() }),
    build: ({ bk, slow, n, seed }) => {
      const bounds = BUCKETS[bk];
      if (!bounds) throw new Error("Pick a bucket layout.");
      const S = num(slow, "slow pod share", 1, 80), N = num(n, "requests", 300, 20000), r = rng(num(seed, "seed", 1, 99999));
      const share = [(100 - S) / 200, (100 - S) / 200, S / 100];
      const prof = [[90, 0.45], [95, 0.45], [160, 0.95]];
      const pods = ["pod-a", "pod-b", "pod-c (slow)"].map((name, i) => {
        const m = Math.max(5, Math.round(N * share[i]));
        const xs = Array.from({ length: m }, () => Math.min(9500, prof[i][0] * Math.exp(prof[i][1] * gauss(r))));
        const sorted = [...xs].sort((a, b) => a - b);
        return { name, n: m, xs, p99: pctSorted(sorted, 99), counts: bucketize(xs, bounds) };
      });
      const all = pods.flatMap((p) => p.xs).sort((a, b) => a - b);
      const truth = pctSorted(all, 99), mean = all.reduce((a, b) => a + b, 0) / all.length, p50 = pctSorted(all, 50);
      const merged = bounds.map((_, i) => pods.reduce((a, p) => a + p.counts[i], 0)).concat([pods.reduce((a, p) => a + p.counts[bounds.length], 0)]);
      const avgP99 = (pods[0].p99 + pods[1].p99 + pods[2].p99) / 3;
      const est = hq(0.99, bounds, merged);
      const SLO = 300, onB = bounds.includes(SLO);
      const goodTrue = all.filter((x) => x <= SLO).length / all.length;
      let goodEst;
      { const i = bounds.findIndex((b) => b >= SLO); const cumBefore = merged.slice(0, i).reduce((a, c) => a + c, 0); const lo = i === 0 ? 0 : bounds[i - 1]; goodEst = (cumBefore + (i < 0 ? 0 : merged[i] * (SLO - lo) / (bounds[i] - lo))) / all.length; }
      const base = { pods: pods.map((p) => ({ name: p.name, n: p.n, p99: p.p99, counts: p.counts })), merged, bounds };
      const st = { mean, p50, avgP99, est, truth };
      const fr = [];
      fr.push({ ...base, show: [], line: [0, 1], note: `${all.length} requests across three pods. pod-c serves ${S}% of traffic and has a long tail (a noisy neighbour, a cold cache). Each pod only exports <b>bucket counts</b>; raw latencies never leave the process.`, vars: { buckets: bounds.length + 1, requests: all.length } });
      fr.push({ ...base, show: ["mean", "p50"], st, line: 1, note: `The mean is <b>${msf(mean)}</b> and the median ${msf(p50)}. Both look fine and both hide the tail: the slowest 1% of users wait far longer than the mean suggests.`, vars: { mean: msf(mean), p50: msf(p50) } });
      fr.push({ ...base, show: ["mean", "p50", "avgP99"], st, line: [2, 3], hot: "avg", note: `Each pod's own p99: ${pods.map((p) => `${p.name.split(" ")[0]} ${msf(p.p99)}`).join(", ")}. Averaging them gives <b>${msf(avgP99)}</b>. That number is meaningless: it weights a pod with ${pods[2].n} requests the same as one with ${pods[0].n}, and percentiles do not average.`, vars: { "avg of p99s": msf(avgP99) } });
      fr.push({ ...base, show: ["mean", "p50", "avgP99", "est"], st, line: [4, 5], hot: "merged", note: `Sum the buckets across pods, then estimate: <code>histogram_quantile</code> finds the bucket holding the 99th-percentile rank and interpolates linearly inside it. Estimate: <b>${msf(est)}</b>. Its error is bounded by that bucket's width, so bucket layout decides precision.`, vars: { "histogram_quantile": msf(est) } });
      const eE = Math.abs(est - truth), eA = Math.abs(avgP99 - truth);
      fr.push({ ...base, show: ["mean", "p50", "avgP99", "est", "truth"], st, line: 5, note: `True p99 from every raw sample: <b>${msf(truth)}</b>. The merged-bucket estimate is off by ${Math.round(eE)} ms (${Math.round((100 * eE) / truth)}%); the average of p99s is off by ${Math.round(eA)} ms (${Math.round((100 * eA) / truth)}%). ${eA > eE ? "The bucket estimate wins, and you can make it tighter with better buckets." : "This time the average landed closer, by luck: there is no bound on how wrong it can be, while the bucket estimate is always inside one bucket. Try the dense bucket layout."}`, vars: { "true p99": msf(truth), "estimate err": `${Math.round((100 * eE) / truth)}%`, "avg err": `${Math.round((100 * eA) / truth)}%` } });
      fr.push({ ...base, show: ["mean", "p50", "avgP99", "est", "truth"], st, slo: { good: goodTrue, est: goodEst, onB }, line: 6, note: `SLO question: "what share of requests took at most 300 ms?" True answer ${(goodTrue * 100).toFixed(2)}%. ${onB ? "300 ms is a bucket boundary, so the bucket counter gives it <b>exactly</b>." : `300 ms is <b>not</b> a bucket boundary, so you get an interpolated guess of ${(goodEst * 100).toFixed(2)}%. Put a bucket boundary on every SLO threshold.`}`, vars: { "good (true)": `${(goodTrue * 100).toFixed(2)}%`, "good (from buckets)": `${(goodEst * 100).toFixed(2)}%` } });
      return fr;
    },
    render: (f) => {
      const mini = (counts, cls, w, h, title) => {
        const mx = Math.max(1, ...counts), bw = (w - 8) / counts.length;
        let s = `<svg class="ob-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(title)}"><rect class="ob-panel" x="0.5" y="0.5" width="${w - 1}" height="${h - 1}" rx="6"/>`;
        counts.forEach((c, i) => { const bh = (c / mx) * (h - 28); s += `<rect class="ob-f-${cls}" x="${4 + i * bw + 1}" y="${h - 6 - bh}" width="${Math.max(1, bw - 2)}" height="${bh}"/>`; });
        return s + `<text class="ob-lbl b" x="6" y="13">${esc(title)}</text></svg>`;
      };
      const pods = f.pods.map((p) => `<div>${mini(p.counts, f.hot === "avg" ? "active" : "visit", 160, 74, `${p.name.split(" ")[0]} · ${p.n} req`)}${f.show.includes("avgP99") ? `<div class="ob-small">p99 ${msf(p.p99)}</div>` : ""}</div>`).join("");
      const lbls = f.bounds.map((b) => (b >= 1000 ? `${b / 1000}s` : b)).concat(["+Inf"]);
      const merged = `${mini(f.merged, f.hot === "merged" ? "active" : "visit", 500, 86, "sum by (le) across pods")}<div class="ob-ticks">${lbls.map((l) => `<span>${l}</span>`).join("")}</div>`;
      const rowsDef = [["mean", "mean", "path"], ["p50", "median", "path"], ["avgP99", "avg of pod p99s", "bad"], ["est", "histogram_quantile(0.99)", "active"], ["truth", "true p99", "done"]];
      const stats = f.show.length ? `<div class="ob-stats">${rowsDef.filter(([k]) => f.show.includes(k)).map(([k, l, c]) => `<span class="ob-stat ${c}">${l} <b>${msf(f.st[k])}</b></span>`).join("")}</div>` : "";
      const slo = f.slo ? `<div class="ob-banner ${f.slo.onB ? "done" : "path"}">≤ 300 ms: true ${(f.slo.good * 100).toFixed(2)}% · from buckets ${(f.slo.est * 100).toFixed(2)}% ${f.slo.onB ? "(exact)" : "(interpolated)"}</div>` : "";
      return `<div class="ob-col"><div class="ob-pods">${pods}</div>${merged}${stats}${slo}</div>`;
    },
  }));

  /* =====================================================================
   * 7. RED for the service, USE for the resource (discrete-event simulation)
   * ===================================================================== */
  Viz.register("observability-red-use", (el) => Viz.player(el, {
    title: "RED and USE on the same incident: a connection pool under rising load",
    legend: [["visit", "RED: the user's view"], ["active", "USE: the resource's view"], ["bad", "threshold"]],
    codeLang: "go",
    code: [
      "// RED, per endpoint: what users feel",
      "requests.Add(ctx, 1)                     // Rate",
      "if err != nil { failures.Add(ctx, 1) }  // Errors",
      "duration.Record(ctx, elapsed.Seconds()) // Duration",
      "// USE, per resource: why they feel it",
      "pool.InUse() / pool.Size()               // Utilization",
      "pool.Waiting()                           // Saturation",
      "acquireTimeouts.Add(ctx, 1)              // Errors",
    ],
    inputs: [
      { key: "pool", label: "pool size", value: "10", width: 60 },
      { key: "peak", label: "peak req/s", value: "300", width: 70 },
      { key: "svc", label: "median query ms", value: "35", width: 70 },
      { key: "to", label: "acquire timeout ms", value: "1000", width: 80 },
      seedInput,
    ],
    random: () => ({ pool: String(Viz.rand(4, 20)), peak: String(Viz.rand(80, 500)), svc: String(Viz.rand(10, 60)), to: String(Viz.rand(200, 2000)), seed: randSeed() }),
    build: ({ pool, peak, svc, to, seed }) => {
      const P = num(pool, "pool size", 1, 50), PK = num(peak, "peak req/s", 10, 600), SV = num(svc, "median query ms", 1, 200) / 1000, TO = num(to, "acquire timeout", 50, 5000) / 1000;
      const r = rng(num(seed, "seed", 1, 99999));
      const T = 40, W = 2, NW = T / W;
      const rate = (t) => (t < 30 ? PK * (0.2 + (0.8 * t) / 30) : PK);
      const win = Array.from({ length: NW }, () => ({ n: 0, err: 0, lat: [], busy: 0, wait: 0 }));
      const free = new Array(P).fill(0);
      const addSpan = (a, b, key) => { for (let w = Math.floor(a / W); w < NW && w * W < b; w++) { const lo = Math.max(a, w * W), hi = Math.min(b, (w + 1) * W); if (hi > lo) win[w][key] += hi - lo; } };
      let t = 0;
      for (;;) {
        t += -Math.log(Math.max(r(), 1e-12)) / rate(t);
        if (t >= T) break;
        let k = 0;
        for (let i = 1; i < P; i++) if (free[i] < free[k]) k = i;
        const start = Math.max(t, free[k]);
        const w = win[Math.floor(t / W)];
        w.n++;
        if (start - t > TO) { w.err++; w.lat.push(TO); addSpan(t, t + TO, "wait"); continue; }
        const s = SV * Math.exp(0.5 * gauss(r));
        free[k] = start + s;
        addSpan(t, start, "wait"); addSpan(start, start + s, "busy");
        w.lat.push(start - t + s);
      }
      const S = win.map((w) => { const l = [...w.lat].sort((a, b) => a - b); return { rate: w.n / W, err: w.n ? (100 * w.err) / w.n : 0, p99: pctSorted(l, 99) * 1000, util: Math.min(1, w.busy / (P * W)), sat: w.wait / W, aerr: w.err / W }; });
      const cap = P / (SV * Math.exp(0.125));
      const fr = [];
      const pick = (i) => ({ i, S: S.slice(0, i + 1) });
      fr.push({ ...pick(-1), cap, line: [0, 4], note: `Load ramps from ${Math.round(PK * 0.2)} to ${PK} req/s over 30 s, then holds. Each request borrows one of <b>${P}</b> connections for a ~${Math.round(SV * 1000)} ms query, so the pool can serve about <b>${Math.round(cap)} req/s</b> at best. RED watches the endpoint, USE watches the pool.`, vars: { capacity: `${Math.round(cap)} req/s` } });
      let firstSat = -1, firstErr = -1;
      S.forEach((s, i) => {
        if (firstSat < 0 && s.sat > 0.5) firstSat = i;
        if (firstErr < 0 && s.err > 1) firstErr = i;
        const phase = s.util < 0.7 ? "Plenty of headroom: latency is just the query time." : s.util < 0.95 ? "Utilization is high. Requests start waiting for a connection, so <b>saturation</b> (the queue) and p99 rise faster than the load does." : s.err > 1 ? "Utilization is pinned at 100% and stops telling you anything. Saturation shows how far over capacity you are, and the queue is now long enough that waits exceed the timeout: errors." : "The pool is fully busy. Utilization cannot go above 100%, so only saturation shows how much work is queued.";
        fr.push({ ...pick(i), cap, line: s.err > 1 ? [2, 7] : s.util >= 0.7 ? [3, 6] : [1, 5], note: `t = ${i * W}–${(i + 1) * W} s: ${Math.round(s.rate)} req/s, utilization ${Math.round(s.util * 100)}%, ${s.sat.toFixed(1)} waiting, p99 ${msf(s.p99)}, errors ${s.err.toFixed(1)}%. ${phase}`, vars: { "req/s": Math.round(s.rate), util: `${Math.round(s.util * 100)}%`, waiting: s.sat.toFixed(1), p99: msf(s.p99), "err %": s.err.toFixed(1) } });
      });
      fr.push({ ...pick(NW - 1), cap, line: [0, 4], note: `${firstSat >= 0 ? `Saturation crossed 0.5 at ${firstSat * W} s` : "Saturation stayed low"}${firstErr >= 0 ? `; errors crossed 1% at ${firstErr * W} s` : "; errors never crossed 1%"}. RED told you <b>users</b> were hurting; USE told you <b>which resource</b> was the reason. Alert on RED (symptoms); keep USE on the dashboard for diagnosis.`, vars: { "saturation from": firstSat >= 0 ? `${firstSat * W} s` : "never", "errors from": firstErr >= 0 ? `${firstErr * W} s` : "never" } });
      return fr;
    },
    render: (f) => {
      const n = 20, v = (k) => f.S.map((s) => s[k]);
      const last = f.S[f.S.length - 1];
      const card = (k, title, fmt, cls, o = {}) => spark(v(k), { n, w: 162, h: 70, cls, area: true, title, value: last ? fmt(last[k]) : "", mark: f.i >= 0 ? f.i : undefined, label: title, ...o });
      return `<div class="ob-col"><div class="ob-small b">RED · the endpoint</div><div class="ob-sparks">
        ${card("rate", "Rate", (x) => `${Math.round(x)}/s`, "visit")}
        ${card("err", "Errors", (x) => `${x.toFixed(1)}%`, "visit", { th: [{ v: 1 }], max: Math.max(5, ...v("err")) })}
        ${card("p99", "Duration p99", (x) => msf(x), "visit", { th: [{ v: 500 }] })}</div>
        <div class="ob-small b">USE · the connection pool</div><div class="ob-sparks">
        ${card("util", "Utilization", (x) => `${Math.round(x * 100)}%`, "active", { max: 1, th: [{ v: 1, c: "bad" }] })}
        ${card("sat", "Saturation", (x) => `${x.toFixed(1)} wait`, "active", { max: Math.max(5, ...v("sat")) })}
        ${card("aerr", "Errors", (x) => `${x.toFixed(1)}/s`, "active", { max: Math.max(5, ...v("aerr")) })}</div></div>`;
    },
  }));

  /* =====================================================================
   * 8. A trace waterfall: N+1 vs batched vs fan-out, with the critical path
   * ===================================================================== */
  Viz.register("observability-waterfall", (el) => Viz.player(el, {
    title: "Reading a trace waterfall",
    legend: [["visit", "API span"], ["path", "database span"], ["active", "HTTP client span"], ["done", "critical path"]],
    codeLang: "typescript",
    code: [
      "tracer.startActiveSpan('GET /orders/:id/summary', async (root) => {",
      "  const order = await db.orders.find(id);",
      "  for (const it of order.items) await db.products.find(it.id); // N+1",
      "  await db.products.findMany(order.items.map(i => i.id));      // batched",
      "  await Promise.all(order.items.map(i => db.products.find(i.id))); // fan-out",
      "  const quote = await pricing.quote(order); // child span via HTTP",
      "  root.end();",
    ],
    inputs: [
      { key: "mode", label: "data loading", type: "select", value: "N+1 sequential", options: ["N+1 sequential", "batched", "parallel fan-out"] },
      { key: "k", label: "items", value: "8", width: 60 },
      seedInput,
    ],
    random: () => ({ k: String(Viz.rand(2, 16)), seed: randSeed() }),
    build: ({ mode, k, seed }) => {
      const K = num(k, "items", 1, 18), r = rng(num(seed, "seed", 1, 99999));
      const j = (base) => base * (0.8 + 0.4 * r());
      const spans = [];
      const add = (name, svc, start, dur, parent, line) => { const s = { id: spans.length, name, svc, start, end: start + dur, parent, line }; spans.push(s); return s; };
      const root = add("GET /orders/:id/summary", "visit", 0, 0, null, 0);
      let t = 1.5;
      const auth = add("auth.validate_token", "visit", t, j(3), 0, 0); t = auth.end + 0.3;
      const o = add("SELECT orders WHERE id=?", "path", t, j(6), 0, 1); t = o.end + 0.3;
      if (mode === "N+1 sequential") for (let i = 0; i < K; i++) { const s = add(`SELECT products WHERE id=? (#${i + 1})`, "path", t, j(9), 0, 2); t = s.end + 0.4; }
      else if (mode === "batched") { const s = add(`SELECT products WHERE id IN (${K} ids)`, "path", t, j(9 + K * 0.6), 0, 3); t = s.end + 0.3; }
      else { let e = t; for (let i = 0; i < K; i++) { const s = add(`SELECT products WHERE id=? (#${i + 1})`, "path", t + i * 0.25, j(9) * (1 + i * 0.03 * Math.min(K, 8)), 0, 4); e = Math.max(e, s.end); } t = e + 0.3; }
      const q = add("POST pricing/quote", "active", t, j(26), 0, 5);
      add("pricing: SELECT rules", "path", q.start + 4, j(12), q.id, 5);
      t = q.end + 0.3;
      const rend = add("serialize response", "visit", t, j(2.5), 0, 6);
      root.end = rend.end + 1;
      const cp = new Set([0]);
      const walk = (s) => { let at = s.end; const kids = spans.filter((c) => c.parent === s.id && c.id !== s.id).sort((a, b) => b.end - a.end); for (const c of kids) if (c.end <= at + 1e-9) { cp.add(c.id); walk(c); at = c.start; } };
      walk(root);
      const dbTime = spans.filter((s) => s.svc === "path" && s.parent === 0).reduce((a, s) => a + (s.end - s.start), 0);
      const fr = [];
      const order = spans.slice(1).sort((a, b) => a.start - b.start);
      const shown = new Set([0]);
      fr.push({ spans: Viz.clone(spans), shown: [...shown], total: root.end, line: 0, note: `The root span covers the whole request: <b>${msf(root.end)}</b>. Every child span records its own start, end and parent id. The waterfall is just those spans drawn on a shared clock.`, vars: { mode, spans: spans.length, total: msf(root.end) } });
      for (const s of order) {
        shown.add(s.id);
        fr.push({ spans: Viz.clone(spans), shown: [...shown], cur: s.id, total: root.end, line: s.line, note: `<b>${esc(s.name)}</b> ${msf(s.end - s.start)}, starting at ${msf(s.start)}${s.parent ? ", a child of the pricing call: the HTTP header carried the context so the other service's span nests here" : ""}.`, vars: { span: s.name.slice(0, 26), start: msf(s.start), duration: msf(s.end - s.start) } });
      }
      const verdict = mode === "N+1 sequential" ? `A staircase of ${K} identical queries is the N+1 signature. They spend ${msf(dbTime)} in the database, all on the critical path. Batch them.` : mode === "batched" ? `One query replaced ${K}. The staircase is gone, and the pricing call is now the biggest block on the critical path.` : `The ${K} queries overlap, so only the slowest is on the critical path. That is faster, but it uses ${K} connections at once per request, so under load you trade latency for pool saturation (see the RED/USE simulation).`;
      fr.push({ spans: Viz.clone(spans), shown: [...shown], cp: [...cp], total: root.end, line: [0, 6], note: `Critical path (the chain that sets the end time): ${cp.size - 1} spans. ${verdict}`, vars: { total: msf(root.end), "db time": msf(dbTime), "critical spans": cp.size - 1 } });
      return fr;
    },
    render: (f) => {
      const sc = 100 / f.total;
      const rows = f.spans.filter((s) => f.shown.includes(s.id)).sort((a, b) => a.start - b.start || a.id - b.id).map((s) => {
        const onCp = f.cp && f.cp.includes(s.id);
        const depth = s.parent === null ? 0 : s.parent === 0 ? 1 : 2;
        return `<div class="ob-wrow ${s.id === f.cur ? "cur" : ""}"><span class="ob-wname" style="padding-left:${depth * 10}px">${esc(s.name)}</span><span class="ob-wtrack"><span class="ob-wbar ${s.svc} ${onCp ? "cp" : ""}" style="left:${(s.start * sc).toFixed(2)}%;width:max(2px, ${((s.end - s.start) * sc).toFixed(2)}%)"></span></span><span class="ob-wdur">${msf(s.end - s.start)}</span></div>`;
      }).join("");
      return `<div class="ob-col ob-water">${rows}</div>`;
    },
  }));

  /* =====================================================================
   * 9. Head sampling vs tail sampling
   * ===================================================================== */
  Viz.register("observability-sampling", (el) => Viz.player(el, {
    title: "Head vs tail sampling: which traces do you keep?",
    legend: [["bad", "error trace"], ["path", "slow trace"], ["done", "kept"], ["dim", "dropped"]],
    codeLang: "python",
    code: [
      "# head: decide at the first span, before anything is known",
      "keep = int(trace_id[-8:], 16) / 2**32 < rate   # same answer on every service",
      "# tail: buffer every span, decide when the trace completes",
      "keep = has_error or duration > slow_ms or random() < rate",
      "# cost: the collector holds every span for decision_wait seconds",
    ],
    inputs: [
      { key: "rate", label: "base keep %", value: "10", width: 60 },
      { key: "err", label: "error %", value: "2", width: 60 },
      { key: "slow", label: "slow %", value: "3", width: 60 },
      seedInput,
    ],
    random: () => ({ rate: String(Viz.rand(1, 30)), err: String(Viz.rand(1, 8)), slow: String(Viz.rand(1, 8)), seed: randSeed() }),
    build: ({ rate, err, slow, seed }) => {
      const R = num(rate, "base keep %", 0, 100), E = num(err, "error %", 0, 50), SL = num(slow, "slow %", 0, 50), rr = rng(num(seed, "seed", 1, 99999));
      const N = 200;
      const tr = Array.from({ length: N }, () => { const id = hex(rr, 32); const u = rr() * 100; return { id, kind: u < E ? "err" : u < E + SL ? "slow" : "ok", h: parseInt(id.slice(-8), 16) / 2 ** 32, t: rr() }; });
      const head = tr.map((x) => x.h < R / 100);
      const tail = tr.map((x) => x.kind !== "ok" || x.t < R / 100);
      const cnt = (keep, kind) => tr.filter((x, i) => keep[i] && (!kind || x.kind === kind)).length;
      const nE = tr.filter((x) => x.kind === "err").length, nS = tr.filter((x) => x.kind === "slow").length;
      const base = { tr: tr.map((x) => x.kind) };
      const fr = [];
      fr.push({ ...base, line: 0, note: `${N} traces from one minute of traffic: <b>${nE}</b> errors and <b>${nS}</b> slow. Keeping all of them is the most useful and the most expensive option. Sampling decides which ones to pay for.`, vars: { traces: N, errors: nE, slow: nS } });
      fr.push({ ...base, head, line: [0, 1], note: `<b>Head sampling</b> at ${R}%: decided from the trace id at the first span, so every service agrees with no coordination and dropped traces cost nothing. But the decision is made before anyone knows how the request ends: kept <b>${cnt(head, "err")} of ${nE}</b> errors and ${cnt(head, "slow")} of ${nS} slow traces.`, vars: { kept: cnt(head), "errors kept": `${cnt(head, "err")}/${nE}`, "slow kept": `${cnt(head, "slow")}/${nS}` } });
      fr.push({ ...base, head, tail, line: [2, 3], note: `<b>Tail sampling</b>: keep every error and every slow trace, plus ${R}% of the rest. Errors kept: <b>${cnt(tail, "err")} of ${nE}</b>, slow: <b>${cnt(tail, "slow")} of ${nS}</b>, for ${cnt(tail)} traces stored in total versus ${cnt(head)} with head sampling.`, vars: { kept: cnt(tail), "errors kept": `${cnt(tail, "err")}/${nE}`, "slow kept": `${cnt(tail, "slow")}/${nS}` } });
      fr.push({ ...base, head, tail, line: 4, note: `The catch: tail sampling needs a collector tier that receives <b>every</b> span, groups them by trace id, and waits (say 10 s) for stragglers before deciding. At 2,000 req/s × 20 spans × 10 s that is 400,000 spans in memory, and all spans of a trace must reach the same collector instance. A common mix: head-sample at a generous rate in the SDK, tail-sample in the collector.`, vars: { "head stored": cnt(head), "tail stored": cnt(tail) } });
      return fr;
    },
    render: (f) => {
      const grid = (keep, title) => {
        const cols = 20, c = 11;
        let s = `<svg class="ob-svg" viewBox="0 0 ${cols * c + 4} ${10 * c + 20}" width="${cols * c + 4}" height="${10 * c + 20}" role="img" aria-label="${esc(title)}"><text class="ob-lbl b" x="2" y="12">${esc(title)}</text>`;
        f.tr.forEach((k, i) => {
          const x = 2 + (i % cols) * c, y = 18 + Math.floor(i / cols) * c;
          const kept = keep ? keep[i] : true;
          const cls = k === "err" ? "ob-f-bad" : k === "slow" ? "ob-f-path" : kept && keep ? "ob-f-done" : "ob-f-node";
          s += `<rect class="${cls} ${keep && !kept ? "ob-faded" : ""}" x="${x}" y="${y}" width="${c - 2}" height="${c - 2}" rx="2"/>`;
        });
        return s + "</svg>";
      };
      return `<div class="ob-two">${f.head ? grid(f.head, `head ${f.head.filter(Boolean).length} kept`) : grid(null, "all 200 traces")}${f.tail ? grid(f.tail, `tail ${f.tail.filter(Boolean).length} kept`) : ""}</div>`;
    },
  }));

  /* =====================================================================
   * 10. SLO error budget and multiwindow burn-rate alerts (30 days, per minute)
   * ===================================================================== */
  const BURN_SCEN = {
    "slow leak: 2x burn from day 12": (m) => (m >= 12 * 1440 ? 2 : 0.2),
    "outage: 10% errors for 45 min on day 18": (m) => (m >= 18 * 1440 + 600 && m < 18 * 1440 + 645 ? 100 : 0.2),
    "blip: 5 min at 20x on day 9": (m) => (m >= 9 * 1440 + 300 && m < 9 * 1440 + 305 ? 20 : 0.2),
    "healthy month": () => 0.2,
  };
  const RULES = [
    { k: "fast", name: "page: 1h & 5m > 14.4x", long: 60, short: 5, th: 14.4, cls: "bad", line: 2 },
    { k: "med", name: "page: 6h & 30m > 6x", long: 360, short: 30, th: 6, cls: "bad", line: 3 },
    { k: "slow", name: "ticket: 3d & 6h > 1x", long: 4320, short: 360, th: 1, cls: "path", line: 4 },
    { k: "naive", name: "naive: 5m error ratio > budget", long: 5, short: 5, th: 1, cls: "visit", line: 5 },
  ];
  Viz.register("observability-burn", (el) => Viz.player(el, {
    title: "Error budgets and burn-rate alerts over a 30-day window",
    tag: "43,200 MINUTES SIMULATED",
    legend: [["done", "budget remaining"], ["visit", "1h burn rate"], ["bad", "page"], ["path", "ticket"]],
    codeLang: "yaml",
    code: [
      "# budget = 1 - SLO; burn(w) = error_ratio(w) / budget",
      "# a burn rate of 1 spends exactly the whole budget in 30 days",
      "page:   burn(1h) > 14.4 and burn(5m) > 14.4   # 2% of budget in 1 hour",
      "page:   burn(6h) > 6    and burn(30m) > 6     # 5% of budget in 6 hours",
      "ticket: burn(3d) > 1    and burn(6h) > 1      # 10% of budget in 3 days",
      "naive:  error_ratio(5m) > budget              # fires on every blip",
    ],
    inputs: [
      { key: "slo", label: "SLO %", value: "99.9", width: 70 },
      { key: "sc", label: "scenario", type: "select", value: Object.keys(BURN_SCEN)[0], options: Object.keys(BURN_SCEN) },
      seedInput,
    ],
    random: () => ({ slo: ["99", "99.5", "99.9", "99.95"][Viz.rand(0, 3)], seed: randSeed() }),
    build: ({ slo, sc, seed }) => {
      const SLO = num(slo, "SLO", 90, 99.99, false), f = BURN_SCEN[sc];
      if (!f) throw new Error("Pick a scenario.");
      const r = rng(num(seed, "seed", 1, 99999));
      const budget = 1 - SLO / 100, M = 30 * 1440, RPM = 1000;
      const errs = new Float64Array(M + 1);
      for (let m = 0; m < M; m++) {
        let burn = f(m) * (0.6 + 0.8 * r());
        if (r() < 0.0005) burn = 8 + 30 * r();
        errs[m + 1] = errs[m] + Math.min(RPM, burn * budget * RPM);
      }
      const burnAt = (m, w) => { const a = Math.max(0, m - w); return (errs[m] - errs[a]) / ((m - a) * RPM) / budget; };
      const fires = Object.fromEntries(RULES.map((x) => [x.k, []]));
      const active = {};
      for (let m = 5; m <= M; m++) for (const ru of RULES) {
        if (m < ru.long && ru.k !== "naive") continue;
        const on = burnAt(m, ru.long) > ru.th && burnAt(m, ru.short) > ru.th;
        if (on && !active[ru.k]) fires[ru.k].push(m);
        active[ru.k] = on;
      }
      const totalBudget = budget * RPM * M;
      const hours = Array.from({ length: 720 }, (_, h) => ({ burn: burnAt((h + 1) * 60, 60), left: 1 - errs[(h + 1) * 60] / totalBudget }));
      const exhaust = hours.findIndex((h) => h.left <= 0);
      const fmtT = (m) => `day ${Math.floor(m / 1440)} ${String(Math.floor((m % 1440) / 60)).padStart(2, "0")}:${String(m % 60).padStart(2, "0")}`;
      const fr = [];
      const snap = (upto, extra) => ({ hours, upto, fires: Object.fromEntries(RULES.map((x) => [x.k, fires[x.k].filter((m) => m <= upto * 60)])), ...extra });
      fr.push(snap(0, { line: [0, 1], note: `SLO ${SLO}% over 30 days means an error budget of <b>${+(budget * 100).toFixed(3)}%</b>: about ${Math.round(totalBudget).toLocaleString("en-US")} failed requests out of ${(RPM * M).toLocaleString("en-US")}. Burn rate 1 spends it exactly by day 30; burn rate 14.4 spends 2% of it per hour. There are also a few random one-minute spikes, as in real traffic.`, vars: { budget: `${+(budget * 100).toFixed(3)}%`, scenario: sc } }));
      const stops = new Set([2, 5, 8, 10, 12, 14, 16, 18, 19, 20, 22, 24, 26, 28, 30].map((d) => d * 24));
      for (const ru of RULES) for (const m of fires[ru.k]) if (ru.k !== "naive") stops.add(Math.min(720, Math.ceil(m / 60)));
      if (exhaust >= 0) stops.add(exhaust + 1);
      const list = [...stops].filter((h) => h > 0 && h <= 720).sort((a, b) => a - b);
      let prev = 0;
      for (const h of list) {
        const newF = RULES.map((ru) => [ru, fires[ru.k].filter((m) => m > prev * 60 && m <= h * 60)]).filter(([, l]) => l.length);
        const left = hours[h - 1].left;
        const parts = newF.map(([ru, l]) => `<b>${esc(ru.name)}</b> fired ${l.length > 1 ? `${l.length} times` : `at ${fmtT(l[0])}`}`);
        const extra = exhaust >= 0 && h === exhaust + 1 ? " <b>The budget is gone</b>: by policy, feature releases pause until reliability work earns it back." : "";
        fr.push(snap(h, { line: newF.length ? newF.map(([ru]) => ru.line) : [0], note: `Up to ${fmtT(h * 60)}: budget left <b>${Math.max(0, left * 100).toFixed(1)}%</b>, 1h burn rate ${hours[h - 1].burn.toFixed(1)}x. ${parts.length ? parts.join("; ") + "." : "No alert fired in this stretch."}${extra}`, vars: { "budget left": `${Math.max(0, left * 100).toFixed(1)}%`, "burn 1h": `${hours[h - 1].burn.toFixed(1)}x`, pages: fires.fast.filter((m) => m <= h * 60).length + fires.med.filter((m) => m <= h * 60).length, "naive alerts": fires.naive.filter((m) => m <= h * 60).length } }));
        prev = h;
      }
      const pages = fires.fast.length + fires.med.length;
      fr.push(snap(720, { line: [2, 3, 4, 5], note: `Month total: <b>${pages}</b> page(s), ${fires.slow.length} ticket(s), and <b>${fires.naive.length}</b> naive alerts. Multiwindow burn-rate alerts page only when the budget is really at risk (the long window) and stop quickly once it recovers (the short window). The naive alert pages on every one-minute spike: that is how teams learn to ignore pages.`, vars: { pages, tickets: fires.slow.length, "naive alerts": fires.naive.length, "budget left": `${Math.max(0, hours[719].left * 100).toFixed(1)}%` } }));
      return fr;
    },
    render: (f) => {
      const W = 880, H1 = 120, H2 = 150, L = 46, R = 10, X = (h) => L + (h / 720) * (W - L - R);
      let s = `<svg class="ob-svg ob-burnsvg" viewBox="0 0 ${W} ${H1 + H2 + 30}" role="img" aria-label="error budget and burn rate">`;
      s += `<rect class="ob-panel" x="${L}" y="4" width="${W - L - R}" height="${H1 - 8}" rx="4"/><rect class="ob-panel" x="${L}" y="${H1 + 4}" width="${W - L - R}" height="${H2 - 8}" rx="4"/>`;
      for (let d = 0; d <= 30; d += 5) s += `<line class="ob-grid" x1="${X(d * 24)}" x2="${X(d * 24)}" y1="4" y2="${H1 + H2 - 4}"/><text class="ob-lbl" x="${X(d * 24)}" y="${H1 + H2 + 12}" text-anchor="middle">day ${d}</text>`;
      const Y1 = (v) => 4 + (1 - Math.max(-0.1, Math.min(1, v))) * (H1 - 16) + 4;
      s += `<text class="ob-lbl" x="${L - 4}" y="${Y1(1) + 4}" text-anchor="end">100%</text><text class="ob-lbl" x="${L - 4}" y="${Y1(0) + 4}" text-anchor="end">0%</text><line class="ob-grid" x1="${L}" x2="${W - R}" y1="${Y1(0)}" y2="${Y1(0)}"/>`;
      const pts = f.hours.slice(0, f.upto).map((h, i) => `${X(i + 1).toFixed(1)},${Y1(h.left).toFixed(1)}`);
      if (pts.length) s += `<path class="ob-s-done ob-thick" d="M${X(0)},${Y1(1)} L${pts.join(" L")}"/>`;
      s += `<text class="ob-lbl b" x="${L + 6}" y="18">error budget remaining</text>`;
      const lmax = Math.log10(200), lmin = Math.log10(0.05);
      const Y2 = (v) => H1 + 4 + (1 - (Math.log10(Math.min(200, Math.max(0.05, v))) - lmin) / (lmax - lmin)) * (H2 - 16) + 4;
      for (const [v, c] of [[14.4, "bad"], [6, "bad"], [1, "path"]]) s += `<line class="ob-s-${c} ob-dash" x1="${L}" x2="${W - R}" y1="${Y2(v)}" y2="${Y2(v)}"/><text class="ob-lbl ob-t-${c}" x="${L - 4}" y="${Y2(v) + 4}" text-anchor="end">${v}x</text>`;
      const bp = f.hours.slice(0, f.upto).map((h, i) => `${X(i + 1).toFixed(1)},${Y2(h.burn).toFixed(1)}`);
      if (bp.length) s += `<path class="ob-s-visit" d="M${bp.join(" L")}"/>`;
      s += `<text class="ob-lbl b" x="${L + 6}" y="${H1 + 18}">burn rate, 1h window (log scale)</text>`;
      for (const ru of RULES) for (const m of f.fires[ru.k]) {
        const x = X(m / 60);
        if (ru.k === "naive") s += `<line class="ob-s-visit" x1="${x}" x2="${x}" y1="${H1 + H2 - 10}" y2="${H1 + H2 - 4}"/>`;
        else s += `<path class="ob-f-${ru.cls}" d="M${x - 5},${H1 + 8} L${x + 5},${H1 + 8} L${x},${H1 + 17} Z"/>`;
      }
      if (f.upto < 720) s += `<line class="ob-s-active" x1="${X(f.upto)}" x2="${X(f.upto)}" y1="4" y2="${H1 + H2 - 4}"/>`;
      s += "</svg>";
      return `<div class="ob-col">${s}<div class="ob-key">▼ red: page · ▼ amber: ticket · short ticks along the bottom: naive alerts</div></div>`;
    },
  }));

  /* =====================================================================
   * 11. Liveness vs readiness vs startup probes (Kubernetes simulation)
   * ===================================================================== */
  const PROBE_DESIGNS = ["good probes", "liveness checks the database", "no startup probe"];
  Viz.register("observability-health", (el) => Viz.player(el, {
    title: "Liveness, readiness and startup probes during a slow start and a database outage",
    legend: [["done", "ready: gets traffic"], ["path", "running, not ready"], ["visit", "starting"], ["bad", "killed / back-off"]],
    codeLang: "yaml",
    code: [
      "startupProbe:   { httpGet: /health/live,  periodSeconds: 5,  failureThreshold: 12 }",
      "livenessProbe:  { httpGet: /health/live,  periodSeconds: 10, failureThreshold: 3 }",
      "readinessProbe: { httpGet: /health/ready, periodSeconds: 5,  failureThreshold: 1 }",
      "# /health/live:  200 if the process can serve HTTP. No dependencies!",
      "# /health/ready: 200 if warmed up AND the database is reachable",
      "# no startupProbe: liveness uses initialDelaySeconds: 10 instead",
    ],
    inputs: [
      { key: "d", label: "design", type: "select", value: PROBE_DESIGNS[0], options: PROBE_DESIGNS },
      { key: "boot", label: "seconds until HTTP is up", value: "32", width: 60 },
    ],
    random: () => ({ boot: String(Viz.rand(5, 45)) }),
    build: ({ d, boot }) => {
      if (!PROBE_DESIGNS.includes(d)) throw new Error("Pick a design.");
      const BOOT = num(boot, "boot seconds", 2, 55), WARM = BOOT + 8, T = 160, DB0 = 70, DB1 = 100;
      const dbUp = (t) => t < DB0 || t >= DB1;
      const pods = [0, 5, 10].map((s, i) => ({ name: `pod-${i + 1}`, cs: s, restarts: 0, state: "starting", started: false, fails: 0, isReady: false, until: 0, tl: [] }));
      const events = [];
      const ev = (t, m) => events.push({ t, m });
      for (let t = 0; t <= T; t++) {
        for (const p of pods) {
          if (t < p.cs && p.restarts === 0) { p.tl.push(""); continue; }
          if (p.state === "backoff") { if (t >= p.until) { p.state = "starting"; p.cs = t; p.started = false; p.fails = 0; p.isReady = false; ev(t, `${p.name} container restarted (restart #${p.restarts})`); } else { p.tl.push("bad"); continue; } }
          const age = t - p.cs, http = age >= BOOT, warm = age >= WARM;
          const live = http && (d !== "liveness checks the database" || dbUp(t));
          const ready = warm && dbUp(t);
          let kill = null;
          if (d === "no startup probe") {
            if (age >= 10 && age % 10 === 0) { p.fails = live ? 0 : p.fails + 1; if (p.fails >= 3) kill = "liveness failed 3 times while the app was still booting"; }
          } else if (!p.started) {
            if (age > 0 && age % 5 === 0) { if (live) { p.started = true; p.fails = 0; ev(t, `${p.name} startup probe passed; liveness takes over`); } else if (age / 5 >= 12) kill = "startup probe exceeded 12 failures"; }
          } else if (age % 10 === 0) { p.fails = live ? 0 : p.fails + 1; if (p.fails >= 3) kill = "liveness failed 3 times (the database is down)"; }
          if (age > 0 && age % 5 === 0 && ready !== p.isReady) { p.isReady = ready; ev(t, `${p.name} ${ready ? "ready: added to Service endpoints" : "not ready: removed from endpoints, keeps running"}`); }
          if (kill) { const back = Math.min(300, 10 * 2 ** p.restarts); p.restarts++; p.state = "backoff"; p.isReady = false; p.until = t + back; ev(t, `${p.name} killed: ${kill}. Back-off ${back} s`); p.tl.push("bad"); continue; }
          p.tl.push(!http ? "visit" : p.isReady ? "done" : "path");
        }
      }
      const svc = Array.from({ length: T + 1 }, (_, t) => (pods.some((p) => p.tl[t] === "done") && dbUp(t) ? "done" : "bad"));
      const servedFrom = svc.indexOf("done");
      const recovered = svc.findIndex((s, t) => t >= DB1 && s === "done");
      const fr = [];
      const snap = (t, extra) => ({ pods: pods.map((p) => ({ name: p.name, tl: p.tl.slice(0, t + 1), restarts: p.restarts })), svc: svc.slice(0, t + 1), t, T, DB0, DB1, events: events.filter((e) => e.t <= t).slice(-3), ...extra });
      const lineFor = (t) => (d === "no startup probe" ? [1, 5] : t < WARM + 12 ? [0, 3] : t >= DB0 && t < DB1 + 10 ? (d === "liveness checks the database" ? [1, 4] : [2, 4]) : [1, 2]);
      for (let t = 0; t <= T; t += 10) {
        const recent = events.filter((e) => e.t > t - 10 && e.t <= t);
        const where = t < DB0 ? "" : t < DB1 ? " The database is <b>down</b>." : "";
        const text = recent.length ? recent.map((e) => `${e.t} s: ${esc(e.m)}`).join(". ") + "." : "No probe changed state.";
        const cnt = (c) => pods.filter((p) => p.tl[t] === c).length;
        const state = ` Now: ${cnt("visit")} booting, ${cnt("path")} running but not ready, ${cnt("done")} ready, ${cnt("bad")} in back-off.`;
        fr.push(snap(t, { line: lineFor(t), note: `t = ${t} s.${where} ${text}${state}`, vars: { t: `${t} s`, ready: pods.filter((p) => p.tl[t] === "done").length, restarts: pods.reduce((a, p) => a + p.restarts, 0), "db": dbUp(t) ? "up" : "down" } }));
      }
      const restarts = pods.reduce((a, p) => a + p.restarts, 0);
      const verdict = d === "good probes" ? `The database outage made pods <b>unready</b>, not dead. Nothing restarted, and service came back ${recovered >= 0 ? `at ${recovered} s, the moment the database did` : "late"}.` : d === "liveness checks the database" ? `A dependency failure was treated as a process failure: Kubernetes killed every pod (${restarts} restarts), so when the database came back at ${DB1} s the pods were still booting. Service recovered at ${recovered >= 0 ? `${recovered} s` : "never in this window"} instead of ${DB1} s.` : `Liveness started judging the app before it could answer, so every pod was killed mid-boot and entered CrashLoopBackOff (${restarts} restarts). ${servedFrom >= 0 ? `First request served at ${servedFrom} s.` : "No request was ever served."} ${BOOT < 30 ? "With this boot time it got lucky; slower nodes would not." : ""}`;
      fr.push(snap(T, { line: d === "good probes" ? [0, 1, 2] : d === "no startup probe" ? [1, 5] : [1, 3], note: verdict, vars: { restarts, "first served": servedFrom >= 0 ? `${servedFrom} s` : "never", "recovered after db": recovered >= 0 ? `${recovered} s` : "never" } }));
      return fr;
    },
    render: (f) => {
      const W = 380, sx = W / (f.T + 1);
      const track = (tl) => { let out = "", i = 0; while (i < tl.length) { let j = i; while (j < tl.length && tl[j] === tl[i]) j++; if (tl[i]) out += `<span class="ob-seg ${tl[i]}" style="left:${(i * sx).toFixed(1)}px;width:${((j - i) * sx).toFixed(1)}px"></span>`; i = j; } return out; };
      const db = `<span class="ob-seg bad ob-faded" style="left:${(f.DB0 * sx).toFixed(1)}px;width:${(Math.max(0, Math.min(f.t + 1, f.DB1) - f.DB0) * sx).toFixed(1)}px"></span>`;
      const rows = f.pods.map((p) => `<div class="ob-hrow"><span class="ob-hname">${p.name}${p.restarts ? ` <small class="ob-t-bad">×${p.restarts}</small>` : ""}</span><span class="ob-htrack" style="width:${W}px">${track(p.tl)}</span></div>`).join("");
      const dbRow = `<div class="ob-hrow"><span class="ob-hname">database</span><span class="ob-htrack" style="width:${W}px">${f.t >= f.DB0 ? db : ""}</span></div>`;
      const svcRow = `<div class="ob-hrow"><span class="ob-hname b">service</span><span class="ob-htrack" style="width:${W}px">${track(f.svc)}</span></div>`;
      const axis = `<div class="ob-hrow"><span class="ob-hname"></span><span class="ob-htrack ob-axis" style="width:${W}px">${[0, 40, 80, 120, 160].map((t) => `<span style="left:${(t * sx).toFixed(1)}px">${t}s</span>`).join("")}</span></div>`;
      const evs = f.events.map((e) => `<div><code>${e.t}s</code> ${esc(e.m)}</div>`).join("");
      return `<div class="ob-col">${rows}${dbRow}${svcRow}${axis}<div class="ob-events">${evs || '<span class="ob-muted">events appear here</span>'}</div></div>`;
    },
  }));

  /* =====================================================================
   * 12. Walkthrough: investigate a slow request with all the signals
   * ===================================================================== */
  Viz.register("observability-investigate", (el) => Viz.player(el, {
    title: "The 3 a.m. page: from alert to root cause in eight steps",
    tag: "WALKTHROUGH",
    legend: [["visit", "v41 / all traffic"], ["bad", "v42 canary"], ["active", "what you look at now"], ["done", "after the fix"]],
    codeLang: "python",
    code: [
      "ALERT checkout-latency: burn(30m) > 6 and burn(5m) > 6  # page (> 1: ticket)",
      "RED for POST /checkout: rate | error ratio | p99",
      "p99 by (version)                      # slice by a bounded label",
      "exemplar on the slowest bucket -> trace_id",
      "trace(trace_id) -> group spans by name, find the repeat",
      "logs | where trace_id == '<id>'",
      "git diff v41..v42 -- config/",
      "flags set pricing.batch-lookups=on    # mitigate first, then fix",
      "postmortem: regression test + config review + keep exemplars",
    ],
    inputs: [{ key: "share", label: "canary share %", value: "34", width: 60 }, seedInput],
    random: () => ({ share: String(Viz.rand(10, 60)), seed: randSeed() }),
    build: ({ share, seed }) => {
      const SH = num(share, "canary share", 5, 100) / 100, r = rng(num(seed, "seed", 1, 99999));
      const MIN = 60, RPM = 600, DEPLOY = 30, FIX = 50, SLOMS = 400, BUD = 0.01;
      const per = [];
      let exemplar = null;
      const EXB = [100, 250, 500, 1000, 2500], exCounts = [0, 0, 0, 0, 0, 0];
      for (let m = 0; m < MIN; m++) {
        const all = [], v41 = [], v42 = [];
        let bad = 0, errs = 0;
        for (let i = 0; i < RPM; i++) {
          const isNew = m >= DEPLOY && r() < SH;
          const items = 1 + Math.floor(r() * 12);
          let lat = 110 * Math.exp(0.4 * gauss(r));
          if (isNew && m < FIX) lat += items * 40 * (0.8 + 0.4 * r());
          if (r() < 0.001) errs++;
          all.push(lat); (isNew ? v42 : v41).push(lat);
          if (lat > SLOMS) bad++;
          if (isNew && m >= FIX - 8 && m < FIX - 3) { const bi = EXB.findIndex((b) => lat <= b); exCounts[bi < 0 ? 5 : bi]++; }
          if (isNew && m === FIX - 4 && (!exemplar || lat > exemplar.lat)) exemplar = { lat, items, id: hex(r, 32) };
        }
        const p = (xs) => (xs.length ? pctSorted(xs.sort((a, b) => a - b), 99) : NaN);
        per.push({ rate: RPM / 60, err: (100 * errs) / RPM, p99: p(all), p41: p(v41), p42: p(v42), bad: bad / RPM });
      }
      const cum = [0]; per.forEach((x) => cum.push(cum[cum.length - 1] + x.bad));
      const burn = (m, w) => (cum[m + 1] - cum[Math.max(0, m + 1 - w)]) / Math.min(w, m + 1) / BUD;
      let kind = "page", alertAt = per.findIndex((_, m) => m >= DEPLOY && burn(m, 30) > 6 && burn(m, 5) > 6);
      if (alertAt < 0) { kind = "ticket"; alertAt = per.findIndex((_, m) => m >= DEPLOY && burn(m, 30) > 1 && burn(m, 5) > 1); }
      if (alertAt < 0 || alertAt > FIX - 4) { kind = "dashboard"; alertAt = DEPLOY + 12; }
      const ex = exemplar || { lat: 900, items: 12, id: hex(r, 32) };
      const base = { per, alertAt, DEPLOY, FIX, ex, exCounts, EXB };
      const p42 = per[FIX - 3].p42, p41 = per[FIX - 3].p41;
      const steps = [
        { upto: alertAt, view: "alert", note: `Minute ${alertAt}: ${kind === "page" ? "paged" : kind === "ticket" ? "a ticket opens (slow burn, no page)" : "someone notices the dashboard (no alert fired: the canary is too small to move the SLO)"}. The latency SLO ("99% of checkouts under ${SLOMS} ms") is burning at <b>${burn(alertAt, 30).toFixed(1)}x</b> over 30 minutes and ${burn(alertAt, 5).toFixed(1)}x over 5. The alert names a <b>symptom users feel</b>, not a guessed cause.`, vars: { minute: alertAt, "burn 30m": `${burn(alertAt, 30).toFixed(1)}x`, "burn 5m": `${burn(alertAt, 5).toFixed(1)}x` } },
        { upto: alertAt + 1, view: "red", note: `RED for POST /checkout: <b>rate is flat</b> (so not a traffic surge), <b>errors are flat</b> (so nothing is failing), <b>p99 rose at minute ${DEPLOY}</b>. Something got slower without breaking. Minute ${DEPLOY} is a strong hint.`, vars: { "req/s": Math.round(per[alertAt].rate), "err %": per[alertAt].err.toFixed(2), p99: msf(per[alertAt].p99) } },
        { upto: alertAt + 2, view: "version", note: `Split p99 by the <code>version</code> label: v41 is steady at ${msf(p41)}, v42 (the canary, ${Math.round(SH * 100)}% of pods) is at <b>${msf(p42)}</b>. Bounded labels like version, route and region are exactly what metric labels are for.`, vars: { "p99 v41": msf(p41), "p99 v42": msf(p42) } },
        { upto: alertAt + 3, view: "exemplar", note: `Metrics are aggregates: they cannot show one request. But the histogram carries <b>exemplars</b>, a sample trace id stored next to a bucket. Click the slowest v42 bucket: trace <code>${ex.id.slice(0, 16)}…</code> took ${msf(ex.lat)}.`, vars: { exemplar: ex.id.slice(0, 12) + "…", latency: msf(ex.lat) } },
        { upto: alertAt + 4, view: "trace", note: `The trace shows <b>${ex.items} sequential GET /pricing/{sku} spans</b>, one per cart item, about ${Math.round((ex.lat - 60) / ex.items)} ms each${(ex.lat - 60) / ex.items > 48 ? " (it is the slowest trace, so these calls were slower than the typical 40 ms)" : ""}. That staircase is N+1 calls. v41 makes one batched call.`, vars: { spans: ex.items + 3, "pricing calls": ex.items } },
        { upto: alertAt + 5, view: "logs", note: `Logs filtered by the same trace id explain <b>why</b>: the pricing client logged <code>batch lookups disabled (Pricing:BatchLookups=false)</code> at startup and per request. Structured fields made this a one-line query.`, vars: { query: `trace_id=${ex.id.slice(0, 8)}…`, lines: 4 } },
        { upto: alertAt + 6, view: "diff", note: `The v42 diff changed a config default: <code>BatchLookups</code> went from true to false during a refactor. No code path was "broken", which is why tests and error metrics stayed green.`, vars: { file: "appsettings.json", change: "true → false" } },
        { upto: MIN - 1, view: "fixed", note: `Mitigate first: at minute ${FIX} the flag is flipped back on (no deploy needed). v42 p99 drops to ${msf(per[MIN - 2].p42)} and the 5-minute burn rate falls to ${burn(MIN - 1, 5).toFixed(1)}x. Verify with the <b>same</b> SLI that paged you, not with "it looks fine".`, vars: { "p99 now": msf(per[MIN - 2].p99), "burn 5m": `${burn(MIN - 1, 5).toFixed(1)}x` } },
        { upto: MIN - 1, view: "post", note: `Postmortem actions: a test that asserts one pricing call per checkout, a config review for default changes, and keep exemplars on. Six steps from page to cause, because <b>trace_id linked every signal</b>.`, vars: { "time to detect": `${alertAt - DEPLOY} min`, "time to mitigate": `${FIX - alertAt} min` } },
      ];
      return steps.map((s, i) => ({ ...base, ...s, step: i, line: i }));
    },
    render: (f) => {
      const STEPS = ["alert", "RED", "by version", "exemplar", "trace", "logs", "diff", "fix", "learn"];
      const crumbs = `<div class="ob-crumbs">${STEPS.map((s, i) => `<span class="${i === f.step ? "cur" : i < f.step ? "done" : ""}">${s}</span>`).join("")}</div>`;
      const n = 60, ser = (k) => f.per.slice(0, f.upto + 1).map((x) => x[k]);
      let body = "";
      if (f.view === "alert") body = spark(ser("p99"), { n, w: 480, h: 110, area: true, title: "p99 POST /checkout", value: msf(f.per[f.upto].p99), th: [{ v: 400 }], mark: f.DEPLOY, label: "p99" });
      else if (f.view === "red") body = `<div class="ob-sparks">${spark(ser("rate"), { n, w: 156, h: 74, title: "Rate", value: `${Math.round(f.per[f.upto].rate)}/s`, max: 20, area: true })}${spark(ser("err"), { n, w: 156, h: 74, title: "Errors", value: `${f.per[f.upto].err.toFixed(2)}%`, max: 2, area: true })}${spark(ser("p99"), { n, w: 156, h: 74, title: "p99", value: msf(f.per[f.upto].p99), cls: "active", area: true, th: [{ v: 400 }] })}</div>`;
      else if (["version", "fixed", "post"].includes(f.view)) {
        const W = 480, H = 130, P = 6, mx = Math.max(...f.per.map((x) => (Number.isFinite(x.p42) ? x.p42 : x.p41))) * 1.05;
        const X = (i) => P + (i / (n - 1)) * (W - 2 * P), Y = (v) => H - P - (v / mx) * (H - 2 * P - 14);
        const line = (k, cls) => { const d = f.per.slice(0, f.upto + 1).map((x, i) => (Number.isFinite(x[k]) ? `${X(i).toFixed(1)},${Y(x[k]).toFixed(1)}` : null)).filter(Boolean); return d.length ? `<path class="ob-s-${cls} ob-thick" d="M${d.join(" L")}"/>` : ""; };
        body = `<svg class="ob-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="p99 by version"><rect class="ob-panel" x="0.5" y="0.5" width="${W - 1}" height="${H - 1}" rx="6"/><line class="ob-s-bad ob-dash" x1="${P}" x2="${W - P}" y1="${Y(400)}" y2="${Y(400)}"/>${f.view !== "version" ? `<rect class="ob-f-done" x="${X(f.FIX)}" y="${P}" width="${X(n - 1) - X(f.FIX)}" height="${H - 2 * P}" opacity="0.5"/>` : ""}${line("p41", "visit")}${line("p42", "bad")}<text class="ob-lbl b" x="10" y="15">p99 by version: v41 vs v42</text><text class="ob-lbl" x="${X(f.DEPLOY)}" y="${H - 10}">deploy v42</text>${f.view !== "version" ? `<text class="ob-lbl ob-t-done" x="${X(f.FIX) + 4}" y="28">flag flipped</text>` : ""}</svg>`;
        if (f.view === "post") body += `<ul class="ob-list"><li>Test: one pricing call per checkout, whatever the cart size.</li><li>Review: config default changes get the same scrutiny as code.</li><li>Alert stayed on the symptom; dashboards held the causes.</li></ul>`;
      } else if (f.view === "exemplar") {
        const lbl = ["≤100", "≤250", "≤500", "≤1s", "≤2.5s", "+Inf"], est = f.exCounts, top = Math.max(1, ...est);
        let ei = f.EXB.findIndex((b) => f.ex.lat <= b); if (ei < 0) ei = 5;
        body = `<div class="ob-exbars">${est.map((c, i) => `<div class="ob-exbar ${i === ei ? "cur" : ""}"><span style="height:${(Math.log10(c + 1) / Math.log10(top + 1)) * 90 + 2}px"></span><small>${lbl[i]}</small>${i === ei ? `<em>◆ ${f.ex.id.slice(0, 8)}…</em>` : ""}</div>`).join("")}</div><div class="ob-small ob-muted">v42 latency histogram, last 5 minutes (log height). ◆ = exemplar trace id attached to the bucket.</div>`;
      } else if (f.view === "trace") {
        const k = f.ex.items, unit = 100 / f.ex.lat; let t = 4, rows = "";
        const row = (name, st, d, cls) => `<div class="ob-wrow"><span class="ob-wname">${esc(name)}</span><span class="ob-wtrack"><span class="ob-wbar ${cls}" style="left:${(st * unit).toFixed(2)}%;width:max(2px, ${(d * unit).toFixed(2)}%)"></span></span><span class="ob-wdur">${msf(d)}</span></div>`;
        rows += row("POST /checkout", 0, f.ex.lat, "visit");
        rows += row("SELECT cart", t, 12, "path"); t += 14;
        const each = (f.ex.lat - 60) / k;
        for (let i = 0; i < k; i++) { rows += row(`GET /pricing/sku-${101 + i}`, t, each - 1, "active cp"); t += each; }
        rows += row("INSERT order", t, 14, "path");
        body = `<div class="ob-water">${rows}</div>`;
      } else if (f.view === "logs") {
        const id = f.ex.id.slice(0, 10);
        body = `<table class="ob-tbl"><thead><tr><th>time</th><th>level</th><th>message</th><th>fields</th></tr></thead><tbody>
          <tr><td>03:12:04.101</td><td>INFO</td><td>Checkout started</td><td><code>trace_id=${id}… items=${f.ex.items}</code></td></tr>
          <tr class="bad"><td>03:12:04.103</td><td>WARN</td><td>Batch lookups disabled; pricing items one by one</td><td><code>Pricing:BatchLookups=false</code></td></tr>
          <tr><td>03:12:04.${String(Math.min(999, 103 + Math.round(f.ex.lat))).padStart(3, "0")}</td><td>INFO</td><td>Priced cart</td><td><code>calls=${f.ex.items} elapsed_ms=${Math.round(f.ex.lat - 30)}</code></td></tr>
          <tr><td>03:12:05.0xx</td><td>INFO</td><td>Checkout completed</td><td><code>order_id=8812 status=201</code></td></tr></tbody></table>`;
      } else if (f.view === "diff") {
        body = `<pre class="ob-diff"><span class="ob-muted">--- v41/appsettings.json</span>\n<span class="ob-muted">+++ v42/appsettings.json</span>\n   "Pricing": {\n     "BaseUrl": "https://pricing.internal",\n<span class="ob-del">-    "BatchLookups": true,</span>\n<span class="ob-add">+    "BatchLookups": false,</span>\n     "TimeoutMs": 800\n   }</pre>`;
      }
      return `<div class="ob-col">${crumbs}${body}</div>`;
    },
  }));
})();
