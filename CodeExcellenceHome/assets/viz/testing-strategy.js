/* Testing strategy visualizers. Every registered name is prefixed "testing-strategy-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const STATES = new Set(["active", "visit", "done", "bad", "path", "accent"]);
  const svg = (w, h, body, label) => `<svg class="dg ts-svg" viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const txt = (x, y, t, cls = "small", anchor = "start") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  const arrow = (x1, y1, x2, y2, cls = "") => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const first = String(cls).split(" ")[0];
    const fill = STATES.has(first) ? "fill-" + first : "muted";
    return `<path class="edge ${cls}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${fill}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
  };
  const stats = (items) => `<div class="ts-stats">${items.map(([l, v, c]) => `<div class="ts-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const codePanel = (lines, lang, cur = [], title = "", marks = {}) => `<div class="ts-codebox">${title ? `<div class="ts-h">${esc(title)}</div>` : ""}<ol class="ts-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""} ${marks[i] || ""}">${hl(l, lang) || "&nbsp;"}</li>`).join("")}</ol></div>`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const pct = (p) => (p >= 0.9995 ? "100%" : p < 0.0005 ? "0%" : (p * 100).toFixed(p < 0.1 ? 1 : 0) + "%");
  const fmtMs = (ms) => (ms < 1000 ? `${Math.round(ms)} ms` : ms < 60000 ? `${(ms / 1000).toFixed(1)} s` : `${(ms / 60000).toFixed(1)} min`);
  const badge = (kind) => `<span class="ts-badge ts-k-${esc(kind.toLowerCase())}">${esc(kind)}</span>`;

  /* =====================================================================
   * 1. Suite shapes: pyramid, trophy, honeycomb, ice-cream cone.
   *    Each layer has a per-test runtime and flake rate; each bug class has a per-test
   *    chance of being exercised by a test at that layer. P(caught) = 1 - prod (1-q)^n.
   * ===================================================================== */
  const LAYERS = [
    { k: "e2e", name: "End-to-end", ms: 9000, flake: 0.015, cls: "bad" },
    { k: "int", name: "Integration + contract", ms: 300, flake: 0.001, cls: "path" },
    { k: "unit", name: "Unit", ms: 4, flake: 0.00005, cls: "done" },
    { k: "static", name: "Static analysis", ms: 0, flake: 0, cls: "visit" },
  ];
  const BUGS = [
    { name: "null deref / type mismatch / typo'd property", q: { static: 0.97, unit: 0.02, int: 0.02, e2e: 0.03 } },
    { name: "off-by-one in a pricing rule", q: { unit: 0.02, int: 0.004, e2e: 0.003 } },
    { name: "leap-day or Unicode edge case", q: { unit: 0.005, int: 0.0006, e2e: 0.0002 } },
    { name: "wrong SQL / ORM mapping", q: { int: 0.03, e2e: 0.02 } },
    { name: "missing DI registration / middleware order", q: { int: 0.05, e2e: 0.08 } },
    { name: "another team renamed a JSON field", q: { int: 0.02, e2e: 0.03 } },
    { name: "button posts to the wrong endpoint", q: { e2e: 0.06 } },
    { name: "race under concurrent requests", q: { int: 0.0004, e2e: 0.0006 } },
  ];
  const SHAPES = {
    "pyramid (Cohn)": { st: true, n: [600, 80, 10] },
    "trophy (Dodds)": { st: true, n: [120, 300, 8] },
    "honeycomb (Spotify)": { st: true, n: [40, 250, 3] },
    "ice-cream cone (anti-pattern)": { st: false, n: [30, 40, 220] },
    "custom (use the counts)": null,
  };
  Viz.register("testing-strategy-shapes", (el) => Viz.player(el, {
    title: "Suite shapes: what each mix costs and what it catches",
    tag: "MODEL · STEP THROUGH",
    legend: [["visit", "static analysis"], ["done", "unit"], ["path", "integration + contract"], ["bad", "end-to-end"]],
    inputs: [
      { key: "shape", label: "shape", type: "select", options: Object.keys(SHAPES), value: "pyramid (Cohn)" },
      { key: "counts", label: "custom counts: unit, integration, e2e", value: "300, 120, 20", width: 150 },
      { key: "st", label: "custom: static analysis", type: "select", options: ["on", "off"], value: "on" },
    ],
    random: () => ({ shape: "custom (use the counts)", counts: [Viz.rand(0, 900), Viz.rand(0, 400), Viz.rand(0, 150)].join(", "), st: pick(["on", "on", "off"]) }),
    build: ({ shape, counts, st }) => {
      let cfg = SHAPES[shape];
      if (!cfg) {
        const n = Viz.parse.ints(counts, { min: 3, max: 3 });
        if (n.some((x) => !Number.isInteger(x) || x < 0 || x > 5000)) throw new Error("Counts must be whole numbers from 0 to 5000.");
        cfg = { st: st === "on", n };
      }
      const count = { static: cfg.st ? 1 : 0, unit: cfg.n[0], int: cfg.n[1], e2e: cfg.n[2] };
      const order = ["static", "unit", "int", "e2e"];
      const fr = [];
      const snap = (added, note) => {
        const on = (k) => added.includes(k);
        const ms = order.filter(on).reduce((a, k) => a + count[k] * LAYERS.find((l) => l.k === k).ms, 0);
        const flakeOk = order.filter(on).reduce((a, k) => a * Math.pow(1 - LAYERS.find((l) => l.k === k).flake, count[k]), 1);
        const caught = BUGS.map((b) => 1 - order.filter(on).reduce((a, k) => a * Math.pow(1 - (b.q[k] || 0), count[k]), 1));
        const by = BUGS.map((b) => order.filter((k) => on(k) && count[k] && b.q[k]).map((k) => k));
        return { count, added: [...added], ms, flake: 1 - flakeOk, caught, by, note };
      };
      fr.push(snap([], `<b>${esc(shape)}</b>: ${count.unit} unit, ${count.int} integration and ${count.e2e} end-to-end tests${count.static ? ", plus a type checker and linters" : ", with no static analysis"}. We add the layers from the cheapest up and watch the cost and the catch rate change.`));
      const added = [];
      for (const k of order) {
        added.push(k);
        const L = LAYERS.find((l) => l.k === k);
        const s = snap(added, "");
        const gain = s.caught.map((p, i) => p - (fr[fr.length - 1].caught[i] || 0));
        const best = gain.indexOf(Math.max(...gain));
        s.cur = k;
        s.note = !count[k] ? `<b>${L.name}</b>: none in this suite. ${k === "static" ? "Every null dereference and type error now has to be caught by a test that happens to run that line." : k === "e2e" ? "Nothing checks that the UI is wired to the API." : "That layer's bugs are now only caught by luck."}`
          : k === "static" ? `<b>Static analysis</b> runs in seconds and needs no test code. It catches nearly every type error and null dereference before a single test runs. This is the base of the trophy.`
          : `<b>${count[k]} ${L.name.toLowerCase()} tests</b> at about ${fmtMs(L.ms)} each add ${fmtMs(count[k] * L.ms)} of runtime. The biggest gain is on <b>${esc(BUGS[best].name)}</b> (+${pct(gain[best])}).${k === "e2e" ? " They are the only layer that sees the UI wiring, but each one is slow and flaky." : k === "int" ? " These see real SQL, real DI wiring and real serialization, which unit tests never touch." : " Fast and precise, but blind to wiring and data access."}`;
        fr.push(s);
      }
      const last = fr[fr.length - 1];
      const weak = last.caught.map((p, i) => [p, i]).sort((a, b) => a[0] - b[0])[0];
      fr.push({ ...last, cur: null, end: true, note: `Whole suite: <b>${fmtMs(last.ms / 8)}</b> on 8 parallel CI workers, and <b>${pct(last.flake)}</b> of runs have at least one flaky failure. Weakest spot: <b>${esc(BUGS[weak[1]].name)}</b> (${pct(weak[0])}). ${last.flake > 0.5 ? "With that much flakiness people stop trusting red builds and just re-run them." : weak[0] < 0.5 ? "Note that no shape catches races well; those need stress tests, property tests or a type system." : "A balanced suite: fast feedback and broad coverage."}` });
      return fr;
    },
    render: (f) => {
      const maxW = 520, W = 900, rowH = 46, top = 16;
      const scale = (n) => (n ? 70 + (maxW - 70) * Math.log10(n + 1) / Math.log10(1001) : 0);
      let b = "";
      LAYERS.forEach((L, i) => {
        const n = f.count[L.k], on = f.added.includes(L.k), w = L.k === "static" ? (n ? maxW * 0.62 : 0) : scale(n);
        const y = top + i * (rowH + 6), x = 300 - w / 2;
        if (w) b += `<rect class="box ${on ? L.cls : ""}" x="${x}" y="${y}" width="${w}" height="${rowH}" rx="6" ${on ? "" : 'stroke-dasharray="5 4" opacity=".45"'}/>`;
        else b += `<rect class="box" x="230" y="${y}" width="140" height="${rowH}" rx="6" stroke-dasharray="5 4" opacity=".4"/>`;
        b += txt(300, y + 20, L.k === "static" ? (n ? "types + linters" : "no static analysis") : `${n} tests`, "ts-t", "middle");
        b += txt(300, y + 36, L.name, "ts-s", "middle");
        if (f.cur === L.k) b += `<rect x="${Math.min(x, 230) - 6}" y="${y - 4}" width="${Math.max(w, 140) + 12}" height="${rowH + 8}" rx="9" class="ts-focus"/>`;
        b += txt(600, y + 20, L.k === "static" ? "seconds, once" : `${fmtMs(L.ms)} each`, "small", "start");
        b += txt(600, y + 36, L.k === "static" ? "never flaky" : `flaky ${(L.flake * 100).toFixed(L.flake < 0.001 ? 3 : 1)}% per test`, "small muted", "start");
        b += txt(760, y + 28, on && L.k !== "static" ? `= ${fmtMs(n * L.ms)}` : "", "small mono", "start");
      });
      const fig = svg(W, top + LAYERS.length * (rowH + 6) + 4, b, "Test suite shape by layer");
      const rows = BUGS.map((bug, i) => {
        const p = f.caught[i];
        const c = p >= 0.9 ? "done" : p >= 0.5 ? "active" : "bad";
        return `<tr><td class="ts-left">${esc(bug.name)}</td><td><div class="ts-meter"><span class="${f.added.length ? c : ""}" style="width:${(p * 100).toFixed(1)}%"></span></div></td><td class="mono">${f.added.length ? pct(p) : "–"}</td><td class="ts-left ts-by">${f.by[i].map((k) => LAYERS.find((l) => l.k === k).name.split(" ")[0].toLowerCase()).join(", ") || "–"}</td></tr>`;
      }).join("");
      const tbl = `<table class="ts-tbl"><tr><th>bug class</th><th>chance the suite catches it</th><th></th><th>caught by</th></tr>${rows}</table>`;
      return `<div class="ts-col">${fig}${stats([["CI time, 8 workers", fmtMs(f.ms / 8), f.ms / 8 > 600000 ? "bad" : f.ms / 8 > 180000 ? "active" : "done"], ["runs with a flaky failure", pct(f.flake), f.flake > 0.3 ? "bad" : f.flake > 0.05 ? "active" : "done"], ["serial runtime", fmtMs(f.ms)]])}${tbl}</div>`;
    },
  }));

  /* =====================================================================
   * 2. Test doubles: the same test written three ways, run against four versions of the code.
   * ===================================================================== */
  const ORDER = { id: 42, card: "tok_visa", coupon: "TEN", items: [{ sku: "BOOK", price: 60 }, { sku: "PEN", price: 40 }] };
  const subtotal = (o) => o.items.reduce((a, i) => a + i.price, 0);
  const realQuote = (o) => { const s = subtotal(o), d = o.coupon === "TEN" ? s * 0.1 : 0; return { Subtotal: s, Discount: d, Total: s - d }; };
  const DVERS = {
    "v1: original": { code: ["public void PlaceOrder(Order order)", "{", "    var total = _pricing.Total(order);", "    _orders.Save(order);", "    _payments.Charge(order.Card, total);", "    _log.Info($\"order {order.Id} placed\");", "}"],
      steps: [{ line: 2, dep: "pricing", m: "Total", bind: "total" }, { line: 3, dep: "orders", m: "Save" }, { line: 4, dep: "payments", m: "Charge", amt: "total" }, { line: 5, dep: "log", m: "Info" }] },
    "v2: refactor (same behaviour)": { code: ["public void PlaceOrder(Order order)", "{", "    var quote = _pricing.Quote(order);   // richer API", "    _orders.SaveAll(new[] { order });   // batch method", "    _payments.Charge(order.Card, quote.Total);", "    _log.Info($\"order {order.Id} placed\");", "}"],
      steps: [{ line: 2, dep: "pricing", m: "Quote", bind: "quote" }, { line: 3, dep: "orders", m: "SaveAll" }, { line: 4, dep: "payments", m: "Charge", amt: "quote.Total" }, { line: 5, dep: "log", m: "Info" }] },
    "v3: bug (charges the subtotal)": { code: ["public void PlaceOrder(Order order)", "{", "    var total = _pricing.Total(order);", "    _orders.Save(order);", "    _payments.Charge(order.Card, order.Subtotal);   // BUG", "    _log.Info($\"order {order.Id} placed\");", "}"],
      steps: [{ line: 2, dep: "pricing", m: "Total", bind: "total" }, { line: 3, dep: "orders", m: "Save" }, { line: 4, dep: "payments", m: "Charge", amt: "subtotal" }, { line: 5, dep: "log", m: "Info" }] },
    "v4: bug (never saves)": { code: ["public void PlaceOrder(Order order)", "{", "    var total = _pricing.Total(order);", "    // _orders.Save(order);   BUG: deleted in a merge", "    _payments.Charge(order.Card, total);", "    _log.Info($\"order {order.Id} placed\");", "}"],
      steps: [{ line: 2, dep: "pricing", m: "Total", bind: "total" }, { line: 4, dep: "payments", m: "Charge", amt: "total" }, { line: 5, dep: "log", m: "Info" }] },
  };
  const DSTYLES = {
    "classicist: real objects + fakes": {
      deps: { pricing: ["REAL", "PriceCalculator: pure, so use the real one"], orders: ["FAKE", "InMemoryOrderRepository: works, stores in a dictionary"], payments: ["FAKE", "FakePaymentGateway: records charges in a list"], log: ["DUMMY", "NullLogger: passed in, never checked"] },
      asserts: [["orders.Get(42) is not null", "state"], ["payments.Charges == [(tok_visa, 90)]", "state"]],
    },
    "stubs + spies": {
      deps: { pricing: ["STUB", "Total(order) returns 90; nothing else configured"], orders: ["SPY", "records every call; asserted afterwards"], payments: ["SPY", "records every call; asserted afterwards"], log: ["DUMMY", "NullLogger: passed in, never checked"] },
      asserts: [["orders received Save(order)", "interaction"], ["payments received Charge(tok_visa, 90)", "interaction"]],
    },
    "mockist: strict mocks": {
      deps: { pricing: ["MOCK", "expects Total(order) → 90, exactly once"], orders: ["MOCK", "expects Save(order), exactly once"], payments: ["MOCK", "expects Charge(tok_visa, 90), exactly once"], log: ["DUMMY", "NullLogger: passed in, never checked"] },
      asserts: [["VerifyAll(): every expectation met", "interaction"], ["VerifyNoOtherCalls()", "interaction"]],
    },
  };
  const DEP_NAMES = { pricing: "IPricing", orders: "IOrderRepository", payments: "IPaymentGateway", log: "ILogger" };
  Viz.register("testing-strategy-doubles", (el) => Viz.player(el, {
    title: "Test doubles: one test, three styles, four versions of the code",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "current call"], ["done", "recorded / passed"], ["bad", "test failed"], ["path", "assertion"]],
    inputs: [
      { key: "style", label: "how the test isolates PlaceOrder", type: "select", options: Object.keys(DSTYLES), value: "classicist: real objects + fakes" },
      { key: "ver", label: "production code", type: "select", options: Object.keys(DVERS), value: "v2: refactor (same behaviour)" },
    ],
    random: () => ({ style: pick(Object.keys(DSTYLES)), ver: pick(Object.keys(DVERS)) }),
    build: ({ style, ver }) => {
      const S = DSTYLES[style], V = DVERS[ver];
      if (!S || !V) throw new Error("Pick a style and a version.");
      const kind = Object.fromEntries(Object.entries(S.deps).map(([k, v]) => [k, v[0]]));
      const rec = { pricing: [], orders: [], payments: [], log: [] };
      const store = new Map();
      const charges = [];
      const env = { subtotal: subtotal(ORDER) };
      const fr = [];
      const snap = (o) => ({ style, ver, code: V.code, kind, deps: S.deps, rec: JSON.parse(JSON.stringify(rec)), asserts: S.asserts, ...o });
      fr.push(snap({ line: 0, phase: "arrange", note: `<b>Arrange.</b> The test builds <code>CheckoutService</code> with a double for each collaborator: ${Object.entries(kind).map(([k, v]) => `${DEP_NAMES[k]} → <b>${v.toLowerCase()}</b>`).join(", ")}. Order 42 is 60 + 40 with a 10% coupon, so the right charge is <b>90</b>.` }));
      let failed = null;
      for (const st of V.steps) {
        const k = kind[st.dep];
        let note = "", ret = "";
        if (st.dep === "pricing") {
          if (k === "REAL") { const q = realQuote(ORDER); env.total = q.Total; env["quote.Total"] = q.Total; ret = st.m === "Quote" ? "Quote{Total=90}" : "90"; note = `The <b>real</b> PriceCalculator computes the answer. It's a pure function, so there is nothing to fake; refactoring its API is free.`; }
          else if (k === "STUB") {
            if (st.m === "Total") { env.total = 90; ret = "90"; note = "The <b>stub</b> returns its canned answer, 90. A stub only answers questions; nobody checks how it was asked."; }
            else { env.quoteNull = true; ret = "null"; note = `<code>Quote()</code> was never configured on the stub, so it returns the default: <b>null</b>. Nothing breaks yet, but <code>quote</code> is now a time bomb.`; }
          } else {
            if (st.m === "Total") { env.total = 90; ret = "90"; note = "The strict <b>mock</b> matches the expected call <code>Total(order)</code> and returns 90."; }
            else { failed = { line: st.line, why: "MockException: unexpected call IPricing.Quote(order). The strict mock only allows Total(order)." }; note = "The strict <b>mock</b> sees <code>Quote(order)</code>, which nobody expected, and throws <b>at once</b>. Behaviour is identical; the test is coupled to the old method name."; }
          }
          rec.pricing.push(`${st.m}(order) → ${ret || "throws"}`);
        } else if (st.dep === "orders") {
          if (k === "FAKE") { store.set(ORDER.id, ORDER); note = `The <b>fake</b> repository really stores the order in a dictionary. It implements both <code>Save</code> and <code>SaveAll</code>, like the real one.`; }
          else if (k === "SPY") note = `The <b>spy</b> writes <code>${st.m}(…)</code> into its call log and does nothing else.`;
          else if (st.m === "Save") note = "The strict <b>mock</b> ticks off its expectation <code>Save(order)</code>.";
          else { failed = { line: st.line, why: "MockException: unexpected call IOrderRepository.SaveAll(…). Expected Save(order)." }; note = "The strict <b>mock</b> expected <code>Save</code>, saw <code>SaveAll</code>, and throws."; }
          rec.orders.push(`${st.m}(${st.m === "SaveAll" ? "[order 42]" : "order 42"})${failed && failed.line === st.line ? " ✗" : ""}`);
        } else if (st.dep === "payments" && st.amt === "quote.Total" && env.quoteNull) {
          failed = { line: st.line, why: "NullReferenceException: quote is null because the stub was only configured for Total(order)." };
          note = `<code>quote.Total</code> dereferences the null from the stub and throws. The test fails because the <i>test</i> hard-coded which query the code uses.`;
          rec.payments.push("(never called)");
        } else if (st.dep === "payments") {
          const amt = st.amt === "subtotal" ? env.subtotal : env[st.amt];
          if (k === "FAKE") { charges.push(amt); note = `The <b>fake</b> gateway appends <code>(tok_visa, ${amt})</code> to its list of charges.`; }
          else if (k === "SPY") note = `The <b>spy</b> records <code>Charge(tok_visa, ${amt})</code>.`;
          else if (amt === 90) note = "The strict <b>mock</b> matches <code>Charge(tok_visa, 90)</code>.";
          else { failed = { line: st.line, why: `MockException: Charge(tok_visa, ${amt}) does not match the expected Charge(tok_visa, 90).` }; note = `The strict <b>mock</b> gets <code>Charge(tok_visa, ${amt})</code>, which doesn't match the expected arguments, and throws. A real bug, caught.`; }
          env.charged = amt;
          rec.payments.push(`Charge(tok_visa, ${amt})${failed && failed.line === st.line ? " ✗" : ""}`);
        } else {
          note = "The logger is a <b>dummy</b>: it has to be passed in, but no assertion looks at it. Making it a strict mock would fail the test on a harmless log line.";
          rec.log.push("Info(…) ignored");
        }
        fr.push(snap({ line: st.line, phase: "act", cur: st.dep, failed: failed ? failed.why : null, note }));
        if (failed) break;
      }
      if (failed) {
        fr.push(snap({ line: failed.line, phase: "result", failed: failed.why, verdict: "fail", note: ver.startsWith("v2") ? `<b>Red, but nothing is broken.</b> v2 behaves exactly like v1 (it still charges 90 and saves the order). This is a <b>false alarm</b> caused by asserting <i>how</i> the work is done instead of <i>what</i> it achieves. Repeat it across 300 tests and nobody dares to refactor.` : `<b>Red, correctly.</b> ${esc(failed.why)} The mock caught the bug while the code was still running.` }));
        return fr;
      }
      const results = S.asserts.map(([a]) => {
        if (a.startsWith("orders.Get")) return store.has(42);
        if (a.startsWith("payments.Charges")) return charges.length === 1 && charges[0] === 90;
        if (a.startsWith("orders received")) return rec.orders.some((r) => r.startsWith("Save("));
        if (a.startsWith("payments received")) return env.charged === 90;
        if (a.startsWith("VerifyAll")) return V.steps.some((s) => s.dep === "orders") && env.charged === 90;
        return true;
      });
      results.forEach((ok, i) => {
        fr.push(snap({ line: 0, phase: "assert", aIdx: i, results: results.slice(0, i + 1), note: `<b>Assert</b> (${S.asserts[i][1]}-based): <code>${esc(S.asserts[i][0])}</code> is <b>${ok ? "true" : "false"}</b>. ${!ok && S.asserts[i][0].startsWith("VerifyAll") ? "The expectation <code>Save(order)</code> was never met." : !ok && S.asserts[i][1] === "state" ? "The test looks at the <i>outcome</i>, so it only fails when the outcome is wrong." : !ok && S.asserts[i][0].startsWith("orders received") ? (rec.orders.length ? "The spy saw <code>SaveAll</code>, not <code>Save</code>." : "The spy recorded no call at all.") : ""}` }));
      });
      const pass = results.every(Boolean);
      const isBug = ver.startsWith("v3") || ver.startsWith("v4");
      fr.push(snap({ line: 0, phase: "result", results, verdict: pass ? "pass" : "fail", note: pass ? (isBug ? "<b>Green, but the code is broken!</b> This test missed the bug." : `<b>Green.</b> ${ver.startsWith("v2") ? "The refactor changed which methods are called, but this test only checks outcomes, so it didn't notice. That's the point: <b>tests should survive refactoring</b>." : "The original code does the right thing."}`) : `<b>Red, correctly.</b> ${isBug ? "The code really is broken, and the test says so." : "Hmm: the behaviour is fine, so this is a false alarm caused by checking interactions."}` }));
      return fr;
    },
    render: (f) => {
      const card = (k) => {
        const [kd, desc] = f.deps[k];
        const failedHere = f.failed && f.cur === k;
        const cls = failedHere ? "bad" : f.cur === k ? "active" : f.rec[k].length ? "done" : "";
        return `<div class="ts-dbl ${cls}"><div class="ts-dbl-h">${badge(kd)}<code>${esc(DEP_NAMES[k])}</code></div><div class="ts-dbl-d">${esc(desc)}</div><div class="ts-dbl-r"><span>records</span>${f.rec[k].length ? f.rec[k].map((r) => `<code>${esc(r)}</code>`).join("") : "<em>nothing yet</em>"}</div></div>`;
      };
      const asserts = f.asserts.map(([a, kind], i) => {
        const r = f.results ? f.results[i] : undefined;
        const c = r === undefined ? (f.aIdx === i ? "active" : "") : r ? "done" : "bad";
        return `<div class="ts-assert ${c}"><span>${r === undefined ? "○" : r ? "✓" : "✗"}</span><code>${esc(a)}</code><em>${kind}</em></div>`;
      }).join("");
      const verdict = f.verdict ? `<div class="ts-verdict ${f.verdict === "pass" ? "done" : "bad"}">${f.verdict === "pass" ? "TEST PASSED" : "TEST FAILED"}${f.failed ? `<small>${esc(f.failed)}</small>` : ""}</div>` : "";
      return `<div class="ts-split"><div class="ts-split-l">${codePanel(f.code, "csharp", f.phase === "act" || f.phase === "result" ? [f.line] : [], "CheckoutService.PlaceOrder: " + f.ver.split(":")[0])}<div class="ts-phase">${["arrange", "act", "assert"].map((p) => `<span class="${f.phase === p ? "on" : ""}">${p}</span>`).join("")}</div><div class="ts-asserts">${asserts}</div>${verdict}</div><div class="ts-dbls">${["pricing", "orders", "payments", "log"].map(card).join("")}</div></div>`;
    },
  }));

  /* =====================================================================
   * 3. TDD red → green → refactor, driving toRoman() with real functions.
   * ===================================================================== */
  const ROMAN = [[1000, "M"], [900, "CM"], [500, "D"], [400, "CD"], [100, "C"], [90, "XC"], [50, "L"], [40, "XL"], [10, "X"], [9, "IX"], [5, "V"], [4, "IV"], [1, "I"]];
  const tableRoman = (n) => { let s = ""; for (const [v, r] of ROMAN) while (n >= v) { s += r; n -= v; } return s; };
  const refRoman = (n) => ["", "M", "MM", "MMM"][Math.floor(n / 1000)] + ["", "C", "CC", "CCC", "CD", "D", "DC", "DCC", "DCCC", "CM"][Math.floor(n / 100) % 10] + ["", "X", "XX", "XXX", "XL", "L", "LX", "LXX", "LXXX", "XC"][Math.floor(n / 10) % 10] + ["", "I", "II", "III", "IV", "V", "VI", "VII", "VIII", "IX"][n % 10];
  const IMPLS = [
    { code: ["function toRoman(n) {", "  throw new Error(\"not implemented\");", "}"], fn: () => { throw new Error("not implemented"); } },
    { code: ["function toRoman(n) {", "  return \"I\";               // fake it", "}"], fn: () => "I" },
    { code: ["function toRoman(n) {", "  return \"I\".repeat(n);      // generalise", "}"], fn: (n) => "I".repeat(Math.max(0, Math.min(n, 4000))) },
    { code: ["function toRoman(n) {", "  if (n === 4) return \"IV\";", "  return \"I\".repeat(n);", "}"], fn: (n) => (n === 4 ? "IV" : "I".repeat(Math.max(0, Math.min(n, 4000)))) },
    { code: ["function toRoman(n) {", "  if (n === 5) return \"V\";", "  if (n === 4) return \"IV\";", "  return \"I\".repeat(n);", "}"], fn: (n) => (n === 5 ? "V" : n === 4 ? "IV" : "I".repeat(Math.max(0, Math.min(n, 4000)))) },
    { code: ["const TABLE = [[1000,\"M\"],[900,\"CM\"],[500,\"D\"],[400,\"CD\"],", "  [100,\"C\"],[90,\"XC\"],[50,\"L\"],[40,\"XL\"],[10,\"X\"],", "  [9,\"IX\"],[5,\"V\"],[4,\"IV\"],[1,\"I\"]];", "function toRoman(n) {", "  let s = \"\";", "  for (const [v, r] of TABLE)", "    while (n >= v) { s += r; n -= v; }", "  return s;", "}"], fn: tableRoman },
    { code: ["const TABLE = [[1000,\"M\"],[900,\"CM\"],[500,\"D\"],[400,\"CD\"],", "  [100,\"C\"],[90,\"XC\"],[50,\"L\"],[40,\"XL\"],[10,\"X\"],", "  [9,\"IX\"],[5,\"V\"],[4,\"IV\"],[1,\"I\"]];", "function toRoman(n) {", "  if (!Number.isInteger(n) || n < 1 || n > 3999)", "    throw new RangeError(`out of range: ${n}`);", "  let s = \"\";", "  for (const [v, r] of TABLE)", "    while (n >= v) { s += r; n -= v; }", "  return s;", "}"], fn: (n) => { if (!Number.isInteger(n) || n < 1 || n > 3999) throw new RangeError(`out of range: ${n}`); return tableRoman(n); } },
  ];
  const TDD_SCRIPT = [
    { add: [[1, "I"]], impl: 0, phase: "red", note: "Write the <b>smallest failing test</b> first: <code>toRoman(1)</code> should be <code>\"I\"</code>. It fails because nothing exists yet, which proves the test can fail." },
    { impl: 1, phase: "green", note: "Make it pass with the <b>simplest thing that could work</b>: return <code>\"I\"</code>. That looks silly, but it proves the test is wired up, and the next test will force a real implementation." },
    { add: [[2, "II"]], impl: 1, phase: "red", note: "A second example <b>triangulates</b>: the constant answer can't satisfy both tests." },
    { impl: 2, phase: "green", note: "Generalise: <code>\"I\".repeat(n)</code>. Both tests pass." },
    { add: [[3, "III"]], impl: 2, phase: "green", note: "<code>toRoman(3)</code> passes <b>immediately</b>. A test that never went red didn't drive any code. It's still worth keeping as documentation, but always check that a new test <i>can</i> fail (break the code briefly) before you trust it." },
    { add: [[4, "IV"]], impl: 2, phase: "red", note: "4 is <code>\"IV\"</code>, not <code>\"IIII\"</code>. Red, with a clear message: expected IV, got IIII." },
    { impl: 3, phase: "green", note: "A special case gets it green. That's fine for a moment; the duplication is building up." },
    { add: [[5, "V"]], impl: 3, phase: "red", note: "5 forces another special case." },
    { impl: 4, phase: "green", note: "Green again, but the <code>if</code> ladder is clearly the wrong shape. Never refactor on red; we're green now, so it's safe." },
    { impl: 5, phase: "refactor", note: "<b>Refactor:</b> replace the special cases with a value table and a greedy loop. The tests stay green, so the behaviour is unchanged. <b>The tests are what make this safe</b>." },
    { add: [[9, "IX"], [10, "X"], [40, "XL"], [1994, "MCMXCIV"]], impl: 5, phase: "green", note: "Add harder examples. They all pass at once, which confirms the table generalised. If one had failed, it would point at the exact table entry that was missing." },
    { add: [[0, "RangeError"]], impl: 5, phase: "red", note: "Now the error case: Romans had no zero, so 0 should throw. The table version silently returns <code>\"\"</code>. That's a <b>quiet bug</b> that only a test for the edge case reveals." },
    { impl: 6, phase: "green", note: "A guard clause makes it green. The cycle took about ten minutes, and every line of the final code was demanded by a test." },
  ];
  const runCase = (fn, [n, want]) => {
    try { const got = fn(n); return { got: JSON.stringify(got), ok: want !== "RangeError" && got === want }; }
    catch (e) { return { got: e.name === "RangeError" ? "throws RangeError" : `throws ${e.message}`, ok: want === "RangeError" && e.name === "RangeError" }; }
  };
  Viz.register("testing-strategy-tdd", (el) => Viz.player(el, {
    title: "TDD: red → green → refactor on toRoman()",
    tag: "REAL CODE · STEP THROUGH",
    legend: [["bad", "red: failing test"], ["done", "green: all pass"], ["path", "refactor"]],
    inputs: [{ key: "n", label: "after the cycle, also test n =", value: "2024", width: 70 }],
    random: () => ({ n: String(Viz.rand(1, 3999)) }),
    build: ({ n }) => {
      const x = Viz.parse.int(n, { min: 1, max: 3999 });
      const tests = [];
      const fr = TDD_SCRIPT.map((s) => {
        if (s.add) tests.push(...s.add);
        const fn = IMPLS[s.impl].fn;
        const res = tests.map((t) => ({ t, ...runCase(fn, t) }));
        return { phase: s.phase, impl: s.impl, res, newIdx: s.add ? tests.length - s.add.length : -1, note: s.note, vars: { tests: tests.length, passing: res.filter((r) => r.ok).length } };
      });
      const want = refRoman(x);
      tests.push([x, want]);
      const res = tests.map((t) => ({ t, ...runCase(IMPLS[6].fn, t) }));
      const ok = res[res.length - 1].ok;
      fr.push({ phase: ok ? "green" : "red", impl: 6, res, newIdx: tests.length - 1, note: `Your number: <code>toRoman(${x})</code> returns <b>${esc(res[res.length - 1].got)}</b>. An independent digit-by-digit implementation says <code>"${want}"</code>. ${ok ? "It matches. The final code was never written for this input, yet it handles it, because each test pushed the design toward the general rule." : "Mismatch!"}`, vars: { tests: tests.length, passing: res.filter((r) => r.ok).length } });
      return fr;
    },
    render: (f) => {
      const ph = ["red", "green", "refactor"];
      const cx = 120, cy = 92, R = 62;
      let b = "";
      ph.forEach((p, i) => {
        const a0 = -Math.PI / 2 + i * 2 * Math.PI / 3 + 0.12, a1 = a0 + 2 * Math.PI / 3 - 0.24;
        const x0 = cx + R * Math.cos(a0), y0 = cy + R * Math.sin(a0), x1 = cx + R * Math.cos(a1), y1 = cy + R * Math.sin(a1);
        const cls = p === "red" ? "bad" : p === "green" ? "done" : "path";
        const on = f.phase === p;
        b += `<path class="edge ${on ? cls : ""}" style="stroke-width:${on ? 9 : 5}px${on ? "" : ";opacity:.35"}" fill="none" d="M${x0},${y0} A${R},${R} 0 0 1 ${x1},${y1}"/>`;
        const am = (a0 + a1) / 2, tx = cx + (R + 24) * Math.cos(am), ty = cy + (R + 24) * Math.sin(am);
        b += `<text class="${on ? "title" : "small muted"}" x="${tx}" y="${ty + 4}" text-anchor="middle">${p.toUpperCase()}</text>`;
      });
      b += txt(cx, cy - 2, `${f.res.filter((r) => r.ok).length}/${f.res.length}`, "ts-big", "middle") + txt(cx, cy + 16, "tests passing", "ts-s", "middle");
      const ring = svg(240, 190, b, "TDD cycle");
      const rows = f.res.map((r, i) => `<tr class="${i >= f.newIdx && f.newIdx >= 0 ? "new" : ""}"><td class="${r.ok ? "ok" : "ko"}">${r.ok ? "✓" : "✗"}</td><td class="ts-left">toRoman(${r.t[0]})</td><td class="ts-left">${r.t[1] === "RangeError" ? "throws RangeError" : `"${esc(r.t[1])}"`}</td><td class="ts-left ${r.ok ? "" : "ts-ko"}">${esc(r.got)}</td></tr>`).join("");
      return `<div class="ts-split"><div class="ts-ring">${ring}</div><div class="ts-split-l">${codePanel(IMPLS[f.impl].code, "javascript", [], "toRoman.js")}<table class="ts-tbl ts-tests"><tr><th></th><th>test</th><th>expected</th><th>actual</th></tr>${rows}</table></div></div>`;
    },
  }));

  /* =====================================================================
   * 4. Property-based testing: generate, find a counterexample, shrink it.
   * ===================================================================== */
  const rleEncode = (s) => s.replace(/(.)\1*/g, (m, c) => m.length + c);
  const rleDecodeBuggy = (e) => { let out = ""; for (let i = 0; i + 1 < e.length; i += 2) out += e[i + 1].repeat(+e[i]); return out; };
  const PROPS = {
    "sort: output is ascending (JS default sort)": {
      kind: "ints", code: ["// property: for any array xs, sort(xs) is non-decreasing", "const sortNums = (xs) => [...xs].sort();   // no comparator!", "fc.assert(fc.property(fc.array(fc.nat(100)), xs => {", "  const s = sortNums(xs);", "  return s.every((v, i) => i === 0 || s[i - 1] <= v);", "}));"],
      run: (xs) => { const s = [...xs].sort(); return { ok: s.every((v, i) => i === 0 || s[i - 1] <= v), out: "[" + s.join(", ") + "]" }; },
      lesson: "Array.prototype.sort compares <b>strings</b> by default, so 10 sorts before 2. Hand-written examples like [3, 1, 2] all pass; the generator found it within a few runs.",
    },
    "dedupe: no value appears twice": {
      kind: "ints", code: ["// property: dedupe(xs) contains no duplicates", "const dedupe = (xs) => xs.filter((v, i) => i === 0 || xs[i - 1] !== v);", "fc.assert(fc.property(fc.array(fc.nat(9)), xs => {", "  const d = dedupe(xs);", "  return new Set(d).size === d.length;", "}));"],
      run: (xs) => { const d = xs.filter((v, i) => i === 0 || xs[i - 1] !== v); return { ok: new Set(d).size === d.length, out: "[" + d.join(", ") + "]" }; },
      lesson: "The implementation only removes <b>adjacent</b> duplicates. It is correct for sorted input, which is what every hand-written test happened to use.",
    },
    "RLE: decode(encode(s)) == s": {
      kind: "str", code: ["// property: decoding an encoding gives back the original", "const encode = (s) => s.replace(/(.)\\1*/g, (m, c) => m.length + c);", "const decode = (e) => {           // reads ONE digit per run", "  let out = \"\";", "  for (let i = 0; i + 1 < e.length; i += 2) out += e[i + 1].repeat(+e[i]);", "  return out; };", "fc.assert(fc.property(fc.string(), s => decode(encode(s)) === s));"],
      run: (s) => { const e = rleEncode(s), d = rleDecodeBuggy(e); return { ok: d === s, out: `encode → "${e}", decode → "${d}"` }; },
      lesson: "A round-trip property needs no expected values at all. It found that runs of 10 or more produce two digits, which the decoder can't read.",
    },
    "reverse: reverse(reverse(xs)) == xs": {
      kind: "ints", code: ["// property: reversing twice is the identity", "const rev = (xs) => [...xs].reverse();", "fc.assert(fc.property(fc.array(fc.integer()), xs => {", "  const r = rev(rev(xs));", "  return r.length === xs.length && r.every((v, i) => v === xs[i]);", "}));"],
      run: (xs) => { const r = [...xs].reverse().reverse(); return { ok: r.length === xs.length && r.every((v, i) => v === xs[i]), out: "[" + r.join(", ") + "]" }; },
      lesson: "",
    },
  };
  const genInts = (r, size, max) => Array.from({ length: Math.floor(r() * (size + 1)) }, () => Math.floor(r() * (max + 1)));
  const genStr = (r, size) => { let s = ""; const runs = 1 + Math.floor(r() * 3); for (let k = 0; k < runs; k++) s += "abc"[Math.floor(r() * 3)].repeat(1 + Math.floor(r() * size)); return s; };
  const shrinkCands = (v, kind) => {
    const out = [];
    if (kind === "str") {
      for (let i = 0; i < v.length; i++) out.push([v.slice(0, i) + v.slice(i + 1), `remove char ${i}`]);
      for (const c of new Set(v)) if (c !== "a") out.push([v.split(c).join("a"), `every '${c}' → 'a'`]);
      for (let i = 0; i < v.length; i++) if (v[i] !== "a") out.push([v.slice(0, i) + "a" + v.slice(i + 1), `char ${i} → 'a'`]);
      return out;
    }
    if (v.length > 1) out.push([v.slice(0, Math.ceil(v.length / 2)), "keep first half"], [v.slice(Math.ceil(v.length / 2)), "keep second half"]);
    for (let i = 0; i < v.length; i++) out.push([v.slice(0, i).concat(v.slice(i + 1)), `remove [${i}]`]);
    for (let i = 0; i < v.length; i++) for (const c of [0, Math.floor(v[i] / 2), v[i] - 1]) if (c >= 0 && c < v[i]) out.push([v.map((x, j) => (j === i ? c : x)), `[${i}]: ${v[i]} → ${c}`]);
    return out;
  };
  const showVal = (v) => (typeof v === "string" ? `"${v}"` : `[${v.join(", ")}]`);
  Viz.register("testing-strategy-property", (el) => Viz.player(el, {
    title: "Property-based testing: generate, fail, shrink",
    tag: "REAL GENERATOR + SHRINKER",
    legend: [["done", "property held"], ["bad", "counterexample"], ["path", "smaller failing input"]],
    inputs: [
      { key: "prop", label: "property", type: "select", options: Object.keys(PROPS), value: "sort: output is ascending (JS default sort)" },
      { key: "seed", label: "seed", value: "7", width: 60 },
    ],
    random: () => ({ prop: pick(Object.keys(PROPS)), seed: String(Viz.rand(1, 9999)) }),
    build: ({ prop, seed }) => {
      const P = PROPS[prop];
      if (!P) throw new Error("Pick a property.");
      const r = rng(Viz.parse.int(seed, { min: 0, max: 1e9 }) + 11);
      const fr = [];
      const hist = [];
      let found = null, run = 0;
      for (run = 1; run <= 100; run++) {
        const size = Math.min(15, 1 + Math.floor(run / 4));
        const v = P.kind === "str" ? genStr(r, size) : genInts(r, size, prop.startsWith("dedupe") ? 9 : 100);
        const res = P.run(v);
        hist.push({ run, ok: res.ok, size: P.kind === "str" ? v.length : v.length });
        if (!res.ok) { found = v; fr.push({ hist: [...hist], cur: v, res, phase: "found", shrinks: [], note: `Run ${run} (generator size ${size}): <b>${esc(showVal(v))}</b> breaks the property. Output: <code>${esc(res.out)}</code>. Real counterexamples are often big and noisy, so now the framework <b>shrinks</b> it.`, vars: { run, size } }); break; }
        if (run <= 3 || run === 10 || run === 50 || run === 100) fr.push({ hist: [...hist], cur: v, res, phase: "gen", shrinks: [], note: run === 1 ? `Run 1: the generator starts with <b>small</b> inputs, <b>${esc(showVal(v))}</b>. The property holds. Frameworks grow the size as runs go by, because small cases (empty, one element) are where many bugs live.` : `Run ${run}: <b>${esc(showVal(v))}</b> holds.`, vars: { run, size } });
      }
      if (!found) { fr.push({ hist, cur: null, phase: "pass", shrinks: [], note: `<b>100 runs, no counterexample.</b> That's not a proof, but 100 random cases explore much more ground than three hand-picked examples. ${P.lesson}`, vars: { runs: 100 } }); return fr.map((x) => ({ ...x, code: P.code })); }
      let cur = found;
      const shrinks = [{ v: cur, how: "original" }];
      for (let step = 0; step < 200; step++) {
        const c = shrinkCands(cur, P.kind).find(([v]) => !P.run(v).ok);
        if (!c) break;
        cur = c[0];
        shrinks.push({ v: cur, how: c[1] });
        if (shrinks.length <= 6 || step % 4 === 0) fr.push({ hist, cur, res: P.run(cur), phase: "shrink", shrinks: [...shrinks], note: `Shrink: <b>${esc(c[1])}</b> → ${esc(showVal(cur))} still fails, so keep it. The shrinker tries simpler candidates (fewer elements, smaller numbers, simpler characters) and keeps any that still fail.`, vars: { steps: shrinks.length - 1 } });
      }
      fr.push({ hist, cur, res: P.run(cur), phase: "min", shrinks: [...shrinks], note: `<b>Minimal counterexample: ${esc(showVal(cur))}</b>, after ${shrinks.length - 1} shrink steps. No smaller candidate fails. ${P.lesson} Turn it into a regular example test so it never comes back.`, vars: { steps: shrinks.length - 1 } });
            return fr.map((x) => ({ ...x, code: P.code }));
    },
    render: (f) => {
      const W = 600, H = 70, n = f.hist.length;
      const bw = Math.min(14, (W - 20) / Math.max(n, 1));
      let b = "";
      f.hist.forEach((h, i) => {
        const hh = 8 + Math.min(16, h.size) * 3;
        b += `<rect class="box ${h.ok ? "done" : "bad"}" x="${10 + i * bw}" y="${H - 14 - hh}" width="${Math.max(2, bw - 2)}" height="${hh}" rx="2"/>`;
      });
      b += txt(10, H - 2, `run 1`, "ts-s") + txt(10 + (n - 1) * bw, H - 2, `run ${n}`, "ts-s", n > 4 ? "middle" : "start");
      const runs = svg(W, H, b, "Generated runs; bar height is input size");
      const chips = (v, cls) => (v === null ? "" : typeof v === "string" ? `<div class="ts-chips">${[...v].map((c) => `<span class="${cls}">${esc(c)}</span>`).join("") || '<em class="ts-muted">""</em>'}</div>` : `<div class="ts-chips">${v.map((x) => `<span class="${cls}">${x}</span>`).join("") || '<em class="ts-muted">[]</em>'}</div>`);
      const curCls = f.phase === "gen" ? "done" : f.phase === "pass" ? "done" : f.phase === "found" ? "bad" : "path";
      const ladder = f.shrinks.length ? `<div class="ts-ladder">${f.shrinks.slice(-7).map((s) => `<div><code>${esc(showVal(s.v))}</code><em>${esc(s.how)}</em></div>`).join("")}</div>` : "";
      return `<div class="ts-col">${runs}<div class="ts-split"><div class="ts-split-l ts-col">${f.cur !== null ? `<div class="ts-h">${f.phase === "min" ? "minimal counterexample" : f.phase === "gen" ? "generated input" : "failing input"}</div>${chips(f.cur, curCls)}${f.res ? `<code class="ts-out ${f.res.ok ? "" : "ts-ko"}">${esc(f.res.out)}</code>` : ""}` : `<div class="ts-verdict done">PROPERTY HELD FOR 100 RUNS</div>`}${ladder}</div><div class="ts-split-r ts-wide">${codePanel(f.code, "javascript", [], "property (fast-check style)")}</div></div></div>`;
    },
  }));

  /* =====================================================================
   * 5. Mutation testing: coverage says 100%, mutants disagree.
   * ===================================================================== */
  const FEE_SRC = (m) => [
    "decimal ShippingFee(decimal total, bool member)",
    "{",
    m.throwGone ? "    if (total " + m.neg + " 0) { }   // throw removed" : `    if (total ${m.neg} 0) throw new ArgumentOutOfRangeException(nameof(total));`,
    m.f2 ? "    if (false) return 0;" : `    if (member ${m.op2} total ${m.c2} 50) return 0;`,
    m.t3 ? "    if (true) return 0;" : `    if (total ${m.c3} 100) return 0;`,
    `    return ${m.ret};`,
    "}",
  ];
  const FEE0 = { neg: "<", throwGone: false, op2: "&&", c2: ">=", c3: ">=", f2: false, t3: false, ret: 5 };
  const MUTANTS = [
    { id: "M1", line: 2, d: "< → <=", m: { neg: "<=" } },
    { id: "M2", line: 2, d: "throw removed", m: { throwGone: true } },
    { id: "M3", line: 3, d: "&& → ||", m: { op2: "||" } },
    { id: "M4", line: 3, d: ">= 50 → > 50", m: { c2: ">" } },
    { id: "M5", line: 3, d: "condition → false", m: { f2: true } },
    { id: "M6", line: 4, d: ">= 100 → > 100", m: { c3: ">" } },
    { id: "M7", line: 4, d: "condition → true", m: { t3: true } },
    { id: "M8", line: 5, d: "return 5 → return 0", m: { ret: 0 } },
  ];
  const cmp = (op, a, b) => (op === "<" ? a < b : op === "<=" ? a <= b : op === ">=" ? a >= b : a > b);
  const fee = (m, total, member, hit) => {
    hit.add(2);
    if (cmp(m.neg, total, 0)) { if (!m.throwGone) throw new RangeError("total"); }
    hit.add(3);
    if (!m.f2 && (m.op2 === "&&" ? member && cmp(m.c2, total, 50) : member || cmp(m.c2, total, 50))) return 0;
    hit.add(4);
    if (m.t3 || cmp(m.c3, total, 100)) return 0;
    hit.add(5);
    return m.ret;
  };
  const T = (t, mem, want) => ({ t, mem, want, name: `Fee(${t}, ${mem ? "member" : "guest"})${want === "throws" ? " throws" : " == " + want}` });
  const SUITES = {
    "happy-path suite (100% line coverage)": [T(-1, false, "throws"), T(80, true, 0), T(150, false, 0), T(20, false, 5)],
    "boundary-value suite": [T(-1, false, "throws"), T(0, false, 5), T(49, true, 5), T(50, true, 0), T(50, false, 5), T(99, false, 5), T(100, false, 0), T(20, false, 5)],
    "assertion-free suite (calls, never checks)": [T(80, true, "any"), T(150, false, "any"), T(20, false, "any"), T(-1, false, "any")],
  };
  const runFee = (m, test, hit) => {
    let got;
    try { got = fee(m, test.t, test.mem, hit); } catch (e) { got = "throws"; }
    if (test.want === "any") return { got, pass: true };
    return { got, pass: got === test.want };
  };
  Viz.register("testing-strategy-mutation", (el) => Viz.player(el, {
    title: "Mutation testing: does the suite notice when the code changes?",
    tag: "REAL MUTANTS · STEP THROUGH",
    legend: [["done", "killed (a test failed)"], ["bad", "survived (all tests passed)"], ["active", "current mutant"]],
    inputs: [{ key: "suite", label: "test suite", type: "select", options: Object.keys(SUITES), value: "happy-path suite (100% line coverage)" }],
    random: () => ({ suite: pick(Object.keys(SUITES)) }),
    build: ({ suite }) => {
      const tests = SUITES[suite];
      if (!tests) throw new Error("Pick a suite.");
      const hit = new Set();
      const base = tests.map((t) => runFee(FEE0, t, hit));
      const cov = [2, 3, 4, 5].filter((l) => hit.has(l)).length / 4;
      const fr = [{ mi: -1, src: FEE_SRC(FEE0), grid: [], base, tests, cov, note: `First, run the ${tests.length} tests against the <b>original</b> code: all green, and <b>line coverage is ${pct(cov)}</b>. Coverage only says each line <i>ran</i>, not that any test would notice if it were wrong. Now a mutation tool (Stryker.NET, PIT, mutmut, Stryker JS, go-mutesting) makes small edits, one at a time, and reruns the suite.`, vars: { coverage: pct(cov) } }];
      const grid = [];
      MUTANTS.forEach((mu, i) => {
        const m = { ...FEE0, ...mu.m };
        const res = tests.map((t) => runFee(m, t, new Set()));
        const killer = res.findIndex((r) => !r.pass);
        grid.push({ res, killed: killer >= 0 });
        const t = killer >= 0 ? tests[killer] : null;
        fr.push({ mi: i, src: FEE_SRC(m), grid: grid.map((g) => g), base, tests, cov, line: mu.line, note: killer >= 0
          ? `<b>${mu.id} (${esc(mu.d)}) killed</b> by <code>${esc(t.name)}</code>, which got <b>${res[killer].got}</b>. Good: a test pins that behaviour.`
          : `<b>${mu.id} (${esc(mu.d)}) survived.</b> Every test still passes with this change. ${suite.startsWith("assertion") ? "These tests can't fail: they never assert anything." : mu.id === "M1" ? "No test uses total = 0, so nobody knows whether 0 is valid." : mu.id === "M3" ? "No test has a guest spending between 50 and 99." : mu.id === "M4" || mu.id === "M6" ? "No test sits exactly <b>on</b> the boundary." : "That line runs, but its exact behaviour is never checked."} A survivor is a <b>missing test</b>, pointed at precisely.`, vars: { killed: grid.filter((g) => g.killed).length, survived: grid.filter((g) => !g.killed).length } });
      });
      const k = grid.filter((g) => g.killed).length;
      fr.push({ mi: -2, src: FEE_SRC(FEE0), grid, base, tests, cov, note: `<b>Mutation score ${k}/${MUTANTS.length} = ${pct(k / MUTANTS.length)}</b>, with line coverage at ${pct(cov)}. ${k === MUTANTS.length ? "Every mutant died, because the tests check values on both sides of each boundary." : k === 0 ? "Full coverage, zero protection. This is how coverage targets get gamed." : "Each survivor tells you which test to write next: here, the boundary values 0, 50 and 100, and a guest between 50 and 99."}`, vars: { score: pct(k / MUTANTS.length), coverage: pct(cov) } });
      return fr;
    },
    render: (f) => {
      const marks = f.mi >= 0 ? { [MUTANTS[f.mi].line]: "ts-mut" } : {};
      const head = `<tr><th>mutant</th><th>change</th>${f.tests.map((t, i) => `<th title="${esc(t.name)}">T${i + 1}</th>`).join("")}<th>result</th></tr>`;
      const rows = MUTANTS.map((mu, i) => {
        const g = f.grid[i];
        const cur = i === f.mi;
        if (!g) return `<tr class="ts-dimrow"><td>${mu.id}</td><td class="ts-left">${esc(mu.d)}</td>${f.tests.map(() => "<td></td>").join("")}<td></td></tr>`;
        return `<tr class="${cur ? "cur" : ""}"><td>${mu.id}</td><td class="ts-left">${esc(mu.d)}</td>${g.res.map((r) => `<td class="${r.pass ? "" : "ko"}">${r.pass ? "·" : "✗"}</td>`).join("")}<td class="${g.killed ? "ok" : "ko"}">${g.killed ? "killed" : "SURVIVED"}</td></tr>`;
      }).join("");
      const tlist = `<div class="ts-tlist">${f.tests.map((t, i) => `<div><b>T${i + 1}</b> <code>${esc(t.name)}</code></div>`).join("")}</div>`;
      const k = f.grid.filter((g) => g.killed).length;
      return `<div class="ts-col"><div class="ts-split"><div class="ts-split-l">${codePanel(f.src, "csharp", f.mi >= 0 ? [MUTANTS[f.mi].line] : [], f.mi >= 0 ? `mutant ${MUTANTS[f.mi].id}: ${MUTANTS[f.mi].d}` : "original", marks)}</div><div class="ts-split-r">${stats([["line coverage", pct(f.cov), f.cov === 1 ? "done" : "active"], ["mutation score", f.grid.length ? `${k}/${f.grid.length}` : "–", f.grid.length ? (k === f.grid.length ? "done" : "bad") : ""]])}${tlist}</div></div><table class="ts-tbl ts-mt">${head}${rows}</table></div>`;
    },
  }));

  /* =====================================================================
   * 6. Flaky tests: the same suite run 20 times on CI.
   * ===================================================================== */
  const FLAKY_TESTS = [
    { id: "TaxTests.UsesOverride", cause: "state", stable: true },
    { id: "TaxTests.DefaultRateIs10", cause: "state" },
    { id: "SubscriptionTests.ExpiresNextMonth", cause: "clock" },
    { id: "ReportJobTests.CompletesInBackground", cause: "wait" },
    { id: "CartTests.AddsLine", stable: true },
    { id: "CartTests.RemovesLine", stable: true },
  ];
  const DAYS = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
  Viz.register("testing-strategy-flaky", (el) => Viz.player(el, {
    title: "Flaky tests: same code, 20 CI runs, different results",
    tag: "SEEDED SIMULATION",
    legend: [["done", "pass"], ["bad", "fail"], ["active", "current run"]],
    inputs: [
      { key: "state", label: "shared static state", type: "select", options: ["flaky", "fixed: fresh state per test"], value: "flaky" },
      { key: "clock", label: "DateTime.Now", type: "select", options: ["flaky", "fixed: inject a fake clock"], value: "flaky" },
      { key: "wait", label: "Thread.Sleep(100)", type: "select", options: ["flaky", "fixed: await the completion signal"], value: "flaky" },
      { key: "seed", label: "seed", value: "3", width: 60 },
    ],
    random: () => ({ state: pick(["flaky", "fixed: fresh state per test"]), clock: pick(["flaky", "fixed: inject a fake clock"]), wait: pick(["flaky", "fixed: await the completion signal"]), seed: String(Viz.rand(1, 999)) }),
    build: ({ state, clock, wait, seed }) => {
      const r = rng(Viz.parse.int(seed, { min: 0, max: 1e9 }) * 7919 + 5);
      const fix = { state: state.startsWith("fixed"), clock: clock.startsWith("fixed"), wait: wait.startsWith("fixed") };
      const grid = FLAKY_TESTS.map(() => []);
      const fr = [];
      fr.push({ grid: grid.map((g) => [...g]), run: -1, note: `Six tests, no code changes, 20 CI runs. Three tests hide a classic source of non-determinism: <b>shared state</b> (${fix.state ? "fixed" : "flaky"}), <b>the wall clock</b> (${fix.clock ? "fixed" : "flaky"}) and <b>sleeping instead of waiting</b> (${fix.wait ? "fixed" : "flaky"}). The test runner shuffles the test order on each run, as xUnit, pytest-randomly and Jest's <code>--randomize</code> can.`, vars: {} });
      for (let run = 0; run < 20; run++) {
        const order = FLAKY_TESTS.map((_, i) => i).sort(() => r() - 0.5);
        const posOverride = order.indexOf(0), posDefault = order.indexOf(1);
        const doy = Math.floor(r() * 365);
        let m = 0, d = doy;
        while (d >= DAYS[m]) { d -= DAYS[m]; m++; }
        const day = d + 1;
        let m2 = m, d2 = d + 30;
        while (d2 >= DAYS[m2 % 12]) { d2 -= DAYS[m2 % 12]; m2++; }
        const load = 0.6 + r() * 2.2, jobMs = Math.round(55 * load);
        const why = [];
        FLAKY_TESTS.forEach((t, i) => {
          let ok = true;
          if (t.cause === "state" && !t.stable && !fix.state && posOverride < posDefault) { ok = false; why.push(`<code>DefaultRateIs10</code> ran after <code>UsesOverride</code>, which left the static rate at 0.2.`); }
          if (t.cause === "clock" && !fix.clock && m2 - m !== 1) { ok = false; why.push(`Today was ${MONTHS[m]} ${day}; +30 days is ${MONTHS[m2 % 12]} ${d2 + 1}, ${m2 === m ? "the <b>same</b> month" : "<b>two</b> months later"}.`); }
          if (t.cause === "wait" && !fix.wait && jobMs > 100) { ok = false; why.push(`The CI box was busy (load ×${load.toFixed(1)}), so the job took ${jobMs} ms and the 100 ms sleep was too short.`); }
          grid[i].push(ok);
        });
        const fails = FLAKY_TESTS.filter((_, i) => !grid[i][run]).length;
        fr.push({ grid: grid.map((g) => [...g]), run, note: `Run ${run + 1}: ${fails ? `<b>${fails} red.</b> ${why.join(" ")}` : `<b>All green.</b> (Today: ${MONTHS[m]} ${day}; job ${jobMs} ms; ${posOverride < posDefault ? "override ran first" : "default ran first"}.)`}`, vars: { run: run + 1, red: fails } });
      }
      const flakyRuns = grid[0].map((_, j) => grid.some((g) => !g[j])).filter(Boolean).length;
      const anyFix = fix.state || fix.clock || fix.wait;
      fr.push({ grid, run: 20, note: `<b>${flakyRuns} of 20 runs were red</b> without any code change. ${flakyRuns === 0 ? "Every source of non-determinism was removed: the suite is a reliable signal again." : `People learn to hit "re-run", and then a real failure gets re-run too. ${anyFix ? "Fix the rest:" : "The fixes:"} reset state per test (new instance, no statics), inject <code>TimeProvider</code>/<code>Clock</code>/fake timers, and await a signal instead of sleeping.`}`, vars: { "red runs": `${flakyRuns}/20` } });
      return fr;
    },
    render: (f) => {
      const cw = 24, ch = 24, lx = 250, top = 22;
      let b = "";
      for (let j = 0; j < 20; j++) b += txt(lx + j * cw + cw / 2, 14, String(j + 1), j === f.run ? "small" : "ts-s", "middle");
      FLAKY_TESTS.forEach((t, i) => {
        const y = top + i * (ch + 4);
        b += txt(lx - 8, y + 16, t.id, "small mono", "end");
        f.grid[i].forEach((ok, j) => { b += `<rect class="box ${ok ? "done" : "bad"}" x="${lx + j * cw + 2}" y="${y}" width="${cw - 4}" height="${ch}" rx="3"/>${ok ? "" : txt(lx + j * cw + cw / 2, y + 16, "✗", "ts-x", "middle")}`; });
      });
      if (f.run >= 0 && f.run < 20) b += `<rect class="ts-focus" x="${lx + f.run * cw}" y="${top - 4}" width="${cw}" height="${FLAKY_TESTS.length * (ch + 4) + 4}" rx="4"/>`;
      const reds = f.grid[0].map((_, j) => f.grid.some((g) => !g[j])).filter(Boolean).length;
      return `<div class="ts-col">${svg(lx + 20 * cw + 10, top + FLAKY_TESTS.length * (ch + 4) + 6, b, "Test results per CI run")}${stats([["runs so far", String(f.grid[0].length)], ["red runs", String(reds), reds ? "bad" : "done"], ["code changes", "0"]])}</div>`;
    },
  }));

  /* =====================================================================
   * 7. Testing through DI: swap registrations, last registration wins.
   * ===================================================================== */
  const DEPS = [
    { k: "clock", svc: "clock", prod: "system clock", fake: "fixed clock (2025-03-10 09:00)" },
    { k: "payments", svc: "payment gateway", prod: "HTTPS client → api.payments.example", fake: "FakePaymentGateway (records charges)" },
    { k: "db", svc: "database", prod: "Postgres at prod-db:5432", fake: "Testcontainers Postgres :49153" },
    { k: "email", svc: "email sender", prod: "SMTP → smtp.mail.example", fake: "InMemoryEmailSender (outbox list)" },
  ];
  const DI_OVR = {
    "override every external edge": ["clock", "payments", "db", "email"],
    "forgot the email sender": ["clock", "payments", "db"],
    "no overrides (production wiring)": [],
  };
  const DI_CODE = {
    "C# (WebApplicationFactory)": { lang: "csharp", lines: [
      ["public class OrdersApiTests(WebApplicationFactory<Program> factory)", null], ["    : IClassFixture<WebApplicationFactory<Program>>", null], ["{", null],
      ["    HttpClient Client => factory.WithWebHostBuilder(b =>", "any"], ["        b.ConfigureTestServices(s =>   // runs AFTER Program.cs", "any"], ["        {", "any"],
      ["            s.AddSingleton<TimeProvider>(new FakeTimeProvider(Start));", "clock"], ["            s.AddSingleton<IPaymentGateway, FakePaymentGateway>();", "payments"],
      ["            s.AddDbContext<ShopDb>(o => o.UseNpgsql(Pg.GetConnectionString()));", "db"], ["            s.AddSingleton<IEmailSender, InMemoryEmailSender>();", "email"],
      ["        })).CreateClient();", "any"], ["    HttpClient Plain => factory.CreateClient();", "none"], ["", null],
      ["    [Fact] public async Task Post_order_returns_201() =>", null], ["        (await Client.PostAsJsonAsync(\"/orders\", Order42)).EnsureSuccessStatusCode();", null], ["}", null]] },
    "Java (Spring Boot)": { lang: "java", lines: [
      ["@SpringBootTest(webEnvironment = RANDOM_PORT)", null], ["@Testcontainers", "db"], ["class OrdersApiTest {", null],
      ["  @Container @ServiceConnection", "db"], ["  static PostgreSQLContainer<?> pg = new PostgreSQLContainer<>(\"postgres:16\");", "db"],
      ["  @MockitoBean PaymentGateway payments;   // replaces the bean", "payments"], ["  @MockitoBean EmailSender email;", "email"],
      ["  @TestConfiguration static class FixedTime {", "clock"], ["    @Bean @Primary Clock clock() { return Clock.fixed(START, UTC); } }", "clock"],
      ["  @Autowired TestRestTemplate http;", null], ["", null], ["  @Test void postOrderReturns201() {", null],
      ["    assertThat(http.postForEntity(\"/orders\", ORDER_42, Void.class)", null], ["        .getStatusCode()).isEqualTo(HttpStatus.CREATED); }", null], ["}", null]] },
    "Python (FastAPI)": { lang: "python", lines: [
      ["from fastapi.testclient import TestClient", null], ["from app.main import app, get_clock, get_payments, get_db, get_email", null], ["", null],
      ["app.dependency_overrides[get_clock] = lambda: FixedClock(START)", "clock"], ["app.dependency_overrides[get_payments] = lambda: FakePayments()", "payments"],
      ["app.dependency_overrides[get_db] = lambda: session_for(pg_container)", "db"], ["app.dependency_overrides[get_email] = lambda: InMemoryEmail()", "email"],
      ["client = TestClient(app)", null], ["", null], ["def test_post_order_returns_201():", null],
      ["    assert client.post(\"/orders\", json=ORDER_42).status_code == 201", null], ["", null], ["# teardown: app.dependency_overrides.clear()", null]] },
    "Go (constructor + httptest)": { lang: "go", lines: [
      ["func TestPostOrder(t *testing.T) {", null], ["    deps := app.Deps{", "anyg"],
      ["        Clock:    fakeClock{now: start},", "clock"], ["        Payments: &fakePayments{},", "payments"], ["        DB:       testDB(t), // Testcontainers", "db"], ["        Email:    &memOutbox{},", "email"],
      ["    }", "anyg"], ["    deps := app.ProdDeps(os.Getenv)   // copied from main()", "none"],
      ["    srv := httptest.NewServer(app.NewRouter(deps))", null], ["    defer srv.Close()", null],
      ["    res, err := http.Post(srv.URL+\"/orders\", \"application/json\", order42())", null], ["    require.NoError(t, err)", null], ["    require.Equal(t, http.StatusCreated, res.StatusCode)", null], ["}", null]] },
    "TypeScript (NestJS)": { lang: "typescript", lines: [
      ["const moduleRef = await Test.createTestingModule({ imports: [AppModule] })", null],
      ["  .overrideProvider(Clock).useValue(new FixedClock(START))", "clock"], ["  .overrideProvider(PaymentGateway).useClass(FakePayments)", "payments"],
      ["  .overrideProvider(DataSource).useFactory({ factory: () => pgFrom(container) })", "db"], ["  .overrideProvider(EmailSender).useClass(InMemoryEmail)", "email"],
      ["  .compile();", null], ["const app = moduleRef.createNestApplication();", null], ["await app.init();", null], ["", null],
      ["it(\"POST /orders returns 201\", () =>", null], ["  request(app.getHttpServer()).post(\"/orders\").send(order42).expect(201));", null]] },
  };
  Viz.register("testing-strategy-di-swap", (el) => Viz.player(el, {
    title: "Testing through DI: replace only the edges",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "test double"], ["visit", "real code"], ["bad", "escaped to the real world"], ["active", "current call"]],
    inputs: [
      { key: "lang", label: "framework", type: "select", options: Object.keys(DI_CODE), value: "C# (WebApplicationFactory)" },
      { key: "ovr", label: "test overrides", type: "select", options: Object.keys(DI_OVR), value: "forgot the email sender" },
    ],
    random: () => ({ lang: pick(Object.keys(DI_CODE)), ovr: pick(Object.keys(DI_OVR)) }),
    build: ({ lang, ovr }) => {
      const C = DI_CODE[lang], O = DI_OVR[ovr];
      if (!C || !O) throw new Error("Pick a framework and an override set.");
      const isGo = lang.startsWith("Go");
      const none = O.length === 0;
      const code = C.lines.filter(([, tag]) => tag === null || (tag === "any" && !none) || (tag === "anyg" && !none) || (tag === "none" && none) || O.includes(tag)).map(([l]) => l);
      const reg = DEPS.map((d) => ({ ...d, now: "prod", ovr: O.includes(d.k) }));
      const fr = [];
      const S = (o) => ({ code, lang: C.lang, reg: reg.map((r) => ({ ...r })), calls: [...calls], ...o });
      const calls = [];
      fr.push(S({ phase: "boot", note: isGo ? "Go has no container: <code>main()</code> builds a <code>Deps</code> struct by hand and passes it to the router. The test does the same thing with its own struct, so \"overriding\" just means passing something else." : `The test boots the <b>real</b> application: the same <code>Program</code>/<code>AppModule</code>, the same routing, middleware and validation. First the production registrations run…` }));
      if (!isGo) {
        reg.forEach((r) => (r.now = "prod"));
        fr.push(S({ phase: "prod", note: "…and every service resolves to its production implementation." }));
        if (O.length) {
          O.forEach((k) => (reg.find((r) => r.k === k).now = "fake"));
          fr.push(S({ phase: "ovr", note: `Then the test's overrides run. In every one of these containers <b>the last registration wins</b>, so ${O.length} service${O.length > 1 ? "s" : ""} now resolve${O.length > 1 ? "" : "s"} to test doubles. Everything else (controllers, validation, serialization, the <code>OrdersService</code> itself) stays real.` }));
        }
      } else {
        reg.forEach((r) => (r.now = none ? "prod" : O.includes(r.k) ? "fake" : "nil"));
        fr.push(S({ phase: "ovr", note: none ? "The test copies the production wiring from <code>main()</code>, so it talks to real systems." : O.length < 4 ? "The struct literal leaves <code>Email</code> out. In Go that compiles: the field is simply <b>nil</b>." : "Every field is a test double. Nothing is hidden: the wiring is plain code." }));
      }
      const flow = [["clock", "OrdersService reads the time for order.PlacedAt"], ["payments", "charges 90.00 to tok_visa"], ["db", "INSERT INTO orders …"], ["email", "sends the confirmation to ana@example.com"]];
      let failed = null, leaked = [];
      for (const [k, what] of flow) {
        const r = reg.find((x) => x.k === k);
        let res, cls;
        if (r.now === "fake") { res = k === "clock" ? "2025-03-10T09:00Z (deterministic)" : k === "payments" ? "recorded Charge(tok_visa, 90.00)" : k === "db" ? "row 1 in a throwaway container" : "added to outbox[0]"; cls = "done"; }
        else if (r.now === "nil") { res = "panic: nil pointer dereference"; cls = "bad"; failed = "The test panics on the nil Email field. Loud and immediate, which is better than silently emailing a customer."; }
        else if (k === "clock") { res = "real time, so the result changes every run"; cls = "visit"; }
        else if (k === "payments") { res = "HTTPS call leaves CI → 401 (no API key)"; cls = "bad"; failed = "The real payment client tried to reach the internet. In CI it fails; on a dev box with keys in the environment it could create a real charge."; }
        else if (k === "db") { res = "dial tcp prod-db:5432: connection refused"; cls = "bad"; failed = "The real connection string points at production."; }
        else { res = "250 OK: a REAL email was sent"; cls = "bad"; leaked.push("A real customer received a test email."); }
        calls.push({ k, what, res, cls });
        fr.push(S({ phase: "run", cur: k, note: `<b>${esc(r.svc)}</b> → <code>${esc(r.now === "fake" ? r.fake : r.now === "nil" ? "nil" : r.prod)}</code>: ${esc(what)}. Result: <b>${esc(res)}</b>.${cls === "bad" && !failed ? " <b>The test will still pass.</b> Nothing asserts on emails, so nothing notices." : ""}` }));
        if (failed) break;
      }
      fr.push(S({ phase: "end", verdict: failed ? "fail" : "pass", note: failed ? `<b>Test failed.</b> ${esc(failed)}` : leaked.length ? `<b>Test passed, and a real email went out.</b> ${leaked.join(" ")} Override <b>every</b> collaborator that crosses a process boundary, and add a test that fails if an unexpected real client gets resolved.` : "<b>Test passed.</b> The whole HTTP pipeline ran for real, and only the four process boundaries were replaced. This is the sweet spot of the testing trophy: realistic, fast enough and deterministic." }));
      return fr;
    },
    render: (f) => {
      const rows = f.reg.map((r) => {
        const val = f.phase === "boot" ? "–" : r.now === "fake" ? r.fake : r.now === "nil" ? "nil (not set)" : r.prod;
        const cls = f.phase === "boot" ? "" : r.now === "fake" ? "done" : r.now === "nil" ? "bad" : "visit";
        const call = f.calls.find((c) => c.k === r.k);
        return `<tr class="${f.cur === r.k ? "cur" : ""}"><td class="ts-left"><b>${esc(r.svc)}</b></td><td class="ts-left ts-cell-${cls}">${esc(val)}</td><td class="ts-left ${call ? "ts-cell-" + call.cls : ""}">${call ? esc(call.res) : ""}</td></tr>`;
      }).join("");
      const verdict = f.verdict ? `<div class="ts-verdict ${f.verdict === "pass" ? (f.calls.some((c) => c.cls === "bad") ? "active" : "done") : "bad"}">${f.verdict === "pass" ? (f.calls.some((c) => c.cls === "bad") ? "PASSED (with a real side effect)" : "TEST PASSED") : "TEST FAILED"}</div>` : "";
      return `<div class="ts-split"><div class="ts-split-l ts-di-l">${codePanel(f.code, f.lang, [], "test setup")}</div><div class="ts-split-r ts-wide"><table class="ts-tbl ts-reg"><tr><th>service</th><th>resolves to</th><th>during POST /orders</th></tr>${rows}</table>${verdict}</div></div>`;
    },
  }));

  /* =====================================================================
   * 8. Consumer-driven contract tests (Pact): who breaks whom.
   * ===================================================================== */
  const BASE_RESP = { id: 42, total: 90.0, status: "PAID", currency: "EUR", legacyCode: "X-17" };
  const PACT = [["id", "integer"], ["total", "number"], ["status", "string"]];
  const PCHANGE = {
    "no change": (o) => o,
    "rename total → amount": ({ total, ...o }) => ({ ...o, amount: total }),
    "add field discount": (o) => ({ ...o, discount: 10.0 }),
    "remove unused legacyCode": ({ legacyCode, ...o }) => o,
    "id becomes a string": (o) => ({ ...o, id: String(o.id) }),
  };
  const typeOf = (v) => (v === undefined ? "missing" : Number.isInteger(v) ? "integer" : typeof v === "number" ? "number" : typeof v);
  const matches = (want, v) => (want === "number" ? typeof v === "number" : typeOf(v) === want);
  Viz.register("testing-strategy-contract", (el) => Viz.player(el, {
    title: "Contract tests: the consumer writes the expectations, the provider proves it meets them",
    tag: "PACT FLOW · STEP THROUGH",
    legend: [["active", "current step"], ["done", "matches the contract"], ["bad", "breaks a consumer"]],
    inputs: [{ key: "chg", label: "the orders-api team changes", type: "select", options: Object.keys(PCHANGE), value: "rename total → amount" }],
    random: () => ({ chg: pick(Object.keys(PCHANGE)) }),
    build: ({ chg }) => {
      const resp = PCHANGE[chg] ? PCHANGE[chg]({ ...BASE_RESP }) : null;
      if (!resp) throw new Error("Pick a change.");
      const fr = [];
      const S = (o) => ({ resp, chg, checks: [], ...o });
      fr.push(S({ step: 0, note: "<b>Consumer side</b> (web-shop). Its unit test runs against a <b>Pact mock server</b>: \"given order 42 exists, <code>GET /orders/42</code> returns <code>id</code> (integer), <code>total</code> (number) and <code>status</code> (string)\". It only lists the fields it actually reads." }));
      fr.push(S({ step: 1, note: "The test passes and writes a <b>pact file</b>: the request and the minimum response the consumer depends on, using type matchers rather than exact values." }));
      fr.push(S({ step: 2, note: "CI publishes the pact to the <b>Pact Broker</b> (or PactFlow), tagged with the consumer's version and branch." }));
      fr.push(S({ step: 3, note: `<b>Provider side</b> (orders-api) made a change: <b>${esc(chg)}</b>. Its own unit and integration tests are all <b>green</b>, because they encode the provider's assumptions, not the consumer's.` }));
      const checks = [];
      for (const [field, want] of PACT) {
        const ok = matches(want, resp[field]);
        checks.push({ field, want, got: typeOf(resp[field]), ok });
        fr.push(S({ step: 4, checks: [...checks], cur: field, note: `Verification replays <code>GET /orders/42</code> against the <b>real</b> provider and checks <code>${field}</code>: expected ${want}, got <b>${typeOf(resp[field])}</b>${resp[field] !== undefined ? ` (<code>${esc(JSON.stringify(resp[field]))}</code>)` : ""}. ${ok ? "✓" : "<b>✗ This would break web-shop in production.</b>"}` }));
      }
      const ok = checks.every((c) => c.ok);
      const extra = Object.keys(resp).filter((k) => !PACT.some(([f]) => f === k));
      fr.push(S({ step: 5, checks, verdict: ok, note: ok ? `<b>can-i-deploy: yes.</b> ${chg.startsWith("add") ? "Adding a field is safe: consumers ignore what they don't read." : chg.startsWith("remove") ? "No consumer's pact mentions <code>legacyCode</code>, so the broker <i>knows</i> it's safe to remove. Without contracts you would have to keep it forever, just in case." : "Nothing changed for this consumer."} Extra fields (${extra.map((e) => `<code>${e}</code>`).join(", ")}) don't matter.` : `<b>can-i-deploy: no.</b> The provider's pipeline fails <i>before</i> deploy. Fix: add the new shape alongside the old one, let consumers move over, and only then remove the old one (expand → migrate → contract).` }));
      return fr;
    },
    render: (f) => {
      const nodes = [["web-shop test", "consumer"], ["pact file", "JSON contract"], ["Pact Broker", "versions + results"], ["orders-api", "provider"], ["verification", "replay vs real API"], ["can-i-deploy", "release gate"]];
      let b = "";
      nodes.forEach(([t, s], i) => {
        const x = 8 + i * 150, cls = i === f.step ? "active" : i < f.step ? "done" : "";
        const vcls = i === 5 && f.verdict !== undefined ? (f.verdict ? "done" : "bad") : i === 4 && f.checks.some((c) => !c.ok) ? "bad" : cls;
        b += `<rect class="box ${vcls}" x="${x}" y="10" width="128" height="50" rx="8"/>` + txt(x + 64, 32, t, "ts-t", "middle") + txt(x + 64, 49, s, "ts-s", "middle");
        if (i < nodes.length - 1) b += arrow(x + 130, 35, x + 148, 35, i < f.step ? "done" : "");
      });
      const flow = svg(910, 70, b, "Pact flow");
      const pactJson = `{\n  "request": { "method": "GET", "path": "/orders/42" },\n  "response": { "status": 200, "body": {\n${PACT.map(([k, t]) => `    "${k}": like(${t})`).join(",\n")}\n  } }\n}`;
      const respRows = Object.entries(f.resp).map(([k, v]) => {
        const c = f.checks.find((x) => x.field === k);
        return `<div class="ts-jrow ${c ? (c.ok ? "done" : "bad") : ""} ${f.cur === k ? "cur" : ""}"><code>"${esc(k)}": ${esc(JSON.stringify(v))}</code>${PACT.some(([p]) => p === k) ? "" : "<em>not in pact</em>"}</div>`;
      }).join("") + f.checks.filter((c) => c.got === "missing").map((c) => `<div class="ts-jrow bad"><code>"${c.field}": (missing)</code><em>expected ${c.want}</em></div>`).join("");
      return `<div class="ts-col">${flow}<div class="ts-split"><div class="ts-codebox ts-narrow"><div class="ts-h">pact (consumer's expectations)</div><pre class="ts-pre">${esc(pactJson)}</pre></div><div class="ts-codebox ts-narrow"><div class="ts-h">orders-api response after: ${esc(f.chg)}</div><div class="ts-json">${f.step >= 3 ? respRows : '<em class="ts-muted">provider not involved yet</em>'}</div></div></div></div>`;
    },
  }));
})();
