/* Clean code visualizers. Every registered name is prefixed "clean-code-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const verdict = (cls, head, sub) => `<div class="cc-verdict ${cls}">${esc(head)}${sub ? `<small>${sub}</small>` : ""}</div>`;
  const stats = (items) => `<div class="cc-stats">${items.map(([l, v, c]) => `<div class="cc-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const codePanel = (lines, lang, cur = [], title = "", marks = {}, side = {}) => `<div class="cc-codebox">${title ? `<div class="cc-h">${esc(title)}</div>` : ""}<ol class="cc-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""} ${marks[i] || ""}"><span class="cc-src">${hl(l, lang) || "&nbsp;"}</span>${side[i] ? `<span class="cc-side">${side[i]}</span>` : ""}</li>`).join("")}</ol></div>`;

  /* =====================================================================
   * 1. Complexity: a small analyzer computes cyclomatic complexity (one per
   *    decision) and cognitive complexity (SonarSource rules: +1 per break
   *    in linear flow, plus the current nesting depth for nested structures).
   * ===================================================================== */
  const CX = {
    "nested ifs (before)": [
      "function discount(order, customer) {",
      "  if (order) {",
      "    if (customer && customer.isActive) {",
      "      if (order.total > 100) {",
      "        if (customer.isVip || order.hasCoupon) {",
      "          return order.total * 0.15;",
      "        } else {",
      "          return order.total * 0.05;",
      "        }",
      "      } else {",
      "        return 0;",
      "      }",
      "    } else {",
      "      throw new Error(\"inactive customer\");",
      "    }",
      "  } else {",
      "    throw new Error(\"order required\");",
      "  }",
      "}",
    ],
    "guard clauses (after)": [
      "function discount(order, customer) {",
      "  if (!order) throw new Error(\"order required\");",
      "  if (!customer || !customer.isActive) throw new Error(\"inactive customer\");",
      "  if (order.total <= 100) return 0;",
      "  if (customer.isVip || order.hasCoupon) return order.total * 0.15;",
      "  return order.total * 0.05;",
      "}",
    ],
    "guards + named helpers": [
      "function discount(order, customer) {",
      "  requireActiveOrder(order, customer);",
      "  if (order.total <= 100) return 0;",
      "  return order.total * (qualifiesForBigDiscount(order, customer) ? 0.15 : 0.05);",
      "}",
      "",
      "function requireActiveOrder(order, customer) {",
      "  if (!order) throw new Error(\"order required\");",
      "  if (!customer?.isActive) throw new Error(\"inactive customer\");",
      "}",
      "",
      "function qualifiesForBigDiscount(order, customer) {",
      "  return customer.isVip || order.hasCoupon;",
      "}",
    ],
    "nested loops (before)": [
      "function overdueInvoices(customers, today) {",
      "  const result = [];",
      "  for (const c of customers) {",
      "    if (c.active) {",
      "      for (const inv of c.invoices) {",
      "        if (!inv.paid && inv.due < today) {",
      "          result.push(inv);",
      "        }",
      "      }",
      "    }",
      "  }",
      "  return result;",
      "}",
    ],
    "pipeline (after)": [
      "function overdueInvoices(customers, today) {",
      "  return customers",
      "    .filter((c) => c.active)",
      "    .flatMap((c) => c.invoices)",
      "    .filter((inv) => !inv.paid && inv.due < today);",
      "}",
    ],
    "else-if chain": [
      "function shippingCost(order) {",
      "  if (order.method === \"express\") {",
      "    return 25;",
      "  } else if (order.method === \"pickup\") {",
      "    return 0;",
      "  } else if (order.method === \"post\") {",
      "    return 15;",
      "  } else {",
      "    return 5;",
      "  }",
      "}",
    ],
    "switch": [
      "function shippingCost(order) {",
      "  switch (order.method) {",
      "    case \"express\": return 25;",
      "    case \"pickup\": return 0;",
      "    case \"post\": return 15;",
      "    default: return 5;",
      "  }",
      "}",
    ],
  };
  const CX_PAIR = {
    "nested ifs (before)": "guard clauses (after)", "guard clauses (after)": "nested ifs (before)", "guards + named helpers": "nested ifs (before)",
    "nested loops (before)": "pipeline (after)", "pipeline (after)": "nested loops (before)", "else-if chain": "switch", switch: "else-if chain",
  };
  /* Exposed for the page's harness check. Returns per-line increments and per-function totals. */
  function analyzeComplexity(lines) {
    const stack = [];
    const rows = [];
    const fns = [];
    let fn = null;
    lines.forEach((raw, i) => {
      const s = raw.replace(/"(?:[^"\\]|\\.)*"|'(?:[^'\\]|\\.)*'|`(?:[^`\\]|\\.)*`/g, '""').replace(/\/\/.*$/, "");
      const t = s.trim();
      const row = { i, cyc: [], cog: [], nest: 0, fn: null };
      if (!t) { rows.push(row); return; }
      if (stack.length === 0) {
        const fm = t.match(/^(?:export\s+)?function\s+(\w+)/) || t.match(/^const\s+(\w+)\s*=\s*\(.*?\)\s*=>/);
        if (fm) { fn = { name: fm[1], start: i, end: i, cyc: 1, cog: 0, maxNest: 0 }; fns.push(fn); row.fn = fn.name; row.cyc.push(["+1", "the function itself: one path through it"]); }
      }
      let k = 0;
      while (t[k] === "}") { stack.pop(); k++; }
      const nesting = stack.filter((x) => x === "ctl").length;
      row.nest = nesting;
      const rest = t.slice(k).trim();
      const elseIf = /^else\s+if\b/.test(rest), isElse = !elseIf && /^else\b/.test(rest);
      let ctl = false;
      const nested = (what) => { row.cyc.push(["+1", what]); row.cog.push([`+${1 + nesting}`, nesting ? `${what}: +1, plus ${nesting} for nesting depth ${nesting}` : `${what}: +1 (top level, no nesting penalty)`]); ctl = true; };
      if (elseIf) { row.cyc.push(["+1", "else if: another decision"]); row.cog.push(["+1", "else if: +1, never a nesting penalty (it reads like a flat list)"]); ctl = true; }
      else if (isElse) { row.cog.push(["+1", "else: the reader has to hold the condition in mind (no new path for cyclomatic)"]); ctl = true; }
      else if (/\bif\s*\(/.test(rest)) nested("if");
      if (/\b(for|while)\s*\(/.test(rest)) nested(rest.match(/\b(for|while)\b/)[1] + " loop");
      if (/\bswitch\s*\(/.test(rest)) { row.cog.push([`+${1 + nesting}`, `switch: +1${nesting ? ` plus ${nesting} nesting` : ""} for the whole switch, however many cases`]); ctl = true; }
      if (/\bcatch\b/.test(rest)) nested("catch");
      if (/^case\b/.test(rest)) row.cyc.push(["+1", "case: one more path (default doesn't add one)"]);
      if (/\s\?\s/.test(s) && /\s:\s/.test(s)) { row.cyc.push(["+1", "ternary ? :"]); row.cog.push([`+${1 + nesting}`, `ternary: +1${nesting ? ` plus ${nesting} nesting` : ""}`]); }
      const ops = s.match(/&&|\|\|/g) || [];
      ops.forEach((o) => row.cyc.push(["+1", `${o}: short-circuit adds a path`]));
      if (ops.length) {
        let seq = 1;
        for (let j = 1; j < ops.length; j++) if (ops[j] !== ops[j - 1]) seq++;
        row.cog.push([`+${seq}`, seq === 1 ? `a run of ${ops[0]}: +1 for the whole sequence` : `${seq} alternating &&/|| sequences: +1 each`]);
      }
      let first = true;
      for (const ch of t.slice(k)) {
        if (ch === "{") { stack.push(first ? (row.fn ? "fn" : ctl ? "ctl" : "blk") : "blk"); first = false; }
        else if (ch === "}") stack.pop();
      }
      if (fn) {
        fn.cyc += row.cyc.filter((c) => !row.fn || c[1].indexOf("the function itself") < 0).length;
        fn.cog += row.cog.reduce((a, c) => a + Number(c[0].slice(1)), 0);
        fn.maxNest = Math.max(fn.maxNest, nesting + (ctl && /\{\s*$/.test(t) ? 1 : 0));
        fn.end = i;
        if (stack.length === 0) fn = null;
      }
      rows.push(row);
    });
    return { rows, fns };
  }
  Viz.register("clean-code-complexity", (el) => Viz.player(el, {
    title: "Complexity: count the paths, then count the effort to read them",
    tag: "REAL ANALYZER · STEP THROUGH",
    legend: [["active", "line being scored"], ["visit", "nesting depth"], ["bad", "cognitive increment"]],
    inputs: [{ key: "v", label: "function", type: "select", options: Object.keys(CX), value: "nested ifs (before)", width: 260 }],
    random: () => ({ v: pick(Object.keys(CX)) }),
    build: ({ v }) => {
      const lines = CX[v];
      if (!lines) throw new Error("Pick one of the listed functions.");
      const { rows, fns } = analyzeComplexity(lines);
      const other = analyzeComplexity(CX[CX_PAIR[v]]).fns;
      const frames = [];
      const run = { cyc: 0, cog: 0 };
      const side = {};
      const base = { v, lines, fns };
      frames.push({ ...base, cur: -1, side: {}, run: { ...run }, note: `Two different questions about the same code. <b>Cyclomatic complexity</b> counts independent paths (one, plus one per decision): it's the number of tests you need to cover every branch. <b>Cognitive complexity</b> (SonarSource) estimates how hard the code is to <i>read</i>: it charges extra for nesting, because every level is one more condition the reader must keep in their head.` });
      rows.forEach((r) => {
        if (!r.cyc.length && !r.cog.length) return;
        const c1 = r.cyc.length, c2 = r.cog.reduce((a, c) => a + Number(c[0].slice(1)), 0);
        run.cyc += c1; run.cog += c2;
        side[r.i] = `${c1 ? `<em class="cc-cyc">cyc +${c1}</em>` : ""}${c2 ? `<em class="cc-cog ${c2 > 1 ? "hot" : ""}">cog +${c2}</em>` : ""}`;
        const why = [...r.cyc.map((c) => `cyclomatic ${c[0]}: ${esc(c[1])}`), ...r.cog.map((c) => `cognitive ${c[0]}: ${esc(c[1])}`)].join("; ");
        frames.push({ ...base, cur: r.i, nest: r.nest, side: { ...side }, run: { ...run }, note: `${r.fn ? `Function <code>${esc(r.fn)}</code> starts. ` : ""}${why}.${c2 >= 3 ? " Deep nesting is what makes this line expensive to read, not the condition itself." : ""}` });
      });
      const tot = fns.reduce((a, f) => ({ cyc: a.cyc + f.cyc, cog: a.cog + f.cog }), { cyc: 0, cog: 0 });
      const otot = other.reduce((a, f) => ({ cyc: a.cyc + f.cyc, cog: a.cog + f.cog }), { cyc: 0, cog: 0 });
      const worst = Math.max(...fns.map((f) => f.cog));
      frames.push({ ...base, cur: -1, side: { ...side }, run: { ...run }, final: true, tot, verdict: worst > 15 ? "bad" : worst > 7 ? "active" : "done", head: `cyclomatic ${tot.cyc} · cognitive ${tot.cog}`, sub: fns.length > 1 ? fns.map((f) => `${esc(f.name)}: ${f.cyc} / ${f.cog}`).join(" · ") : `max nesting ${fns[0].maxNest}`,
        note: `Compare with “${esc(CX_PAIR[v])}”: cyclomatic ${otot.cyc}, cognitive ${otot.cog}. ${v.startsWith("nested ifs") || v.startsWith("guard") ? "Guard clauses keep <b>the same paths</b> (cyclomatic barely moves, because the same decisions still exist) but remove the nesting, so the cognitive score collapses. The happy path now reads top to bottom with no indentation." : v.startsWith("guards +") ? "Named helpers split the score across small functions that each read in seconds. The total barely changes; what matters is that no single function is hard." : v.includes("loop") || v.includes("pipeline") ? "The pipeline expresses the same filtering without nesting. Each step is one idea, and the lambdas hide no extra branching." : "Cyclomatic counts every case as a path, so the switch scores the same as the else-if chain. Cognitive charges the switch once: a reader takes in a flat list of cases at a glance."} Sonar's default threshold is 15 cognitive points per function.` });
      return frames;
    },
    render: (f) => {
      const marks = {};
      f.lines.forEach((_, i) => { if (f.side[i] && i === f.cur) marks[i] = "cur"; });
      const nestBars = {};
      const { rows } = analyzeComplexity(f.lines);
      rows.forEach((r) => { if (f.lines[r.i].trim()) nestBars[r.i] = r.nest; });
      const side = {};
      Object.keys(nestBars).forEach((i) => { side[i] = `<span class="cc-nest">${"<i></i>".repeat(nestBars[i])}</span>${f.side[i] || ""}`; });
      const tot = f.run;
      return `<div class="cc-split"><div class="cc-split-l">${codePanel(f.lines, "typescript", [f.cur], f.v, {}, side)}</div><div class="cc-split-r">${stats([["cyclomatic (paths)", tot.cyc, ""], ["cognitive (reading effort)", tot.cog, tot.cog > 15 ? "bad" : tot.cog > 7 ? "active" : "done"]])}${f.cur >= 0 ? `<div class="cc-kv cur"><span>nesting at this line</span><code>${f.nest}</code></div>` : ""}${f.final ? verdict(f.verdict, f.head, f.sub) : ""}<div class="cc-scale"><div class="cc-h">cognitive score per function</div>${f.fns.map((fn) => `<div class="cc-bar"><span>${esc(fn.name)}</span><b style="width:${Math.min(100, (fn.cog / 20) * 100)}%" class="${fn.cog > 15 ? "bad" : fn.cog > 7 ? "active" : "done"}"></b><em>${f.final ? fn.cog : "?"}</em></div>`).join("")}<div class="cc-tick">threshold 15</div></div></div></div>`;
    },
  }));

  /* =====================================================================
   * 2. Refactoring catalog: each refactoring is shown as mechanics, then the
   *    before and after implementations are run on the same generated inputs
   *    (with boundary values mixed in). A "slip" variant shows the tests
   *    catching a refactoring that changed behaviour.
   * ===================================================================== */
  const near = (a, b) => (typeof a === "number" && typeof b === "number" ? Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a)) : a === b);
  const money = (x) => (typeof x === "number" ? (Math.round(x * 100) / 100).toString() : String(x));
  const ri = (r, a, b) => a + Math.floor(r() * (b - a + 1));
  const RF = {
    "Extract function": {
      before: [
        "function statement(invoice) {",
        "  let out = \"*** Customer owes ***\\n\";",
        "  let total = 0;",
        "  for (const o of invoice.orders) total += o.amount;",
        "  out += `name: ${invoice.customer}\\n`;",
        "  out += `amount: ${total}\\n`;",
        "  return out;",
        "}",
      ],
      after: [
        "function statement(invoice) {",
        "  return banner() + details(invoice.customer, outstanding(invoice));",
        "}",
        "const banner = () => \"*** Customer owes ***\\n\";",
        "const outstanding = (invoice) =>",
        "  invoice.orders.reduce((sum, o) => sum + o.amount, 0);",
        "const details = (name, total) => `name: ${name}\\namount: ${total}\\n`;",
      ],
      slipLines: { 5: "  invoice.orders.filter((o) => o.amount > 0).reduce((sum, o) => sum + o.amount, 0);" },
      slipText: "the extracted <code>outstanding</code> picked up a “positive amounts only” filter copied from another report",
      steps: [
        ["before", [2, 3], "Spot a fragment that does one thing you can name: lines 3–4 compute the outstanding amount. A comment like <i>// calculate outstanding</i> is often the hint."],
        ["after", [4, 5], "Create a function named for <b>what</b> it does, not how: <code>outstanding(invoice)</code>. Variables only read by the fragment become parameters; the one it produces becomes the return value."],
        ["after", [3, 6], "Repeat for the banner and the details. Each extracted function is one level of abstraction below <code>statement</code>."],
        ["after", [1], "<code>statement</code> now reads like a table of contents: banner, then details of the outstanding amount. Run the tests."],
      ],
      gen: (r) => ({ customer: ["Ada", "Linus", "Grace"][ri(r, 0, 2)], orders: Array.from({ length: ri(r, 0, 4) }, () => ({ amount: r() < 0.2 ? -ri(r, 1, 50) : ri(r, 1, 200) })) }),
      fBefore: (inv) => { let out = "*** Customer owes ***\n"; let total = 0; for (const o of inv.orders) total += o.amount; out += `name: ${inv.customer}\n`; out += `amount: ${total}\n`; return out; },
      fAfter: (slip) => (inv) => {
        const banner = () => "*** Customer owes ***\n";
        const outstanding = (i) => (slip ? i.orders.filter((o) => o.amount > 0) : i.orders).reduce((s, o) => s + o.amount, 0);
        const details = (n, t) => `name: ${n}\namount: ${t}\n`;
        return banner() + details(inv.customer, outstanding(inv));
      },
      showIn: (inv) => `[${inv.orders.map((o) => o.amount).join(", ")}]`,
      showOut: (s) => s.split("\n")[2],
    },
    "Inline function": {
      before: [
        "function rating(driver) {",
        "  return moreThanFiveLateDeliveries(driver) ? 2 : 1;",
        "}",
        "function moreThanFiveLateDeliveries(driver) {",
        "  return driver.lateDeliveries > 5;",
        "}",
      ],
      after: [
        "function rating(driver) {",
        "  return driver.lateDeliveries > 5 ? 2 : 1;",
        "}",
      ],
      slipLines: { 1: "  return driver.lateDeliveries >= 5 ? 2 : 1;" },
      slipText: "while inlining, “more than five” was typed as <code>&gt;= 5</code>",
      steps: [
        ["before", [3, 4, 5], "The helper's body is as clear as its name, and it has one caller. The indirection costs a jump and adds nothing: the opposite case to extract function."],
        ["before", [1], "Check that it isn't polymorphic (overridden in a subclass) and find every caller. Here there's one."],
        ["after", [1], "Replace the call with the body, adjusting names. Delete the helper. Run the tests."],
      ],
      gen: (r) => ({ lateDeliveries: r() < 0.3 ? pick([4, 5, 6]) : ri(r, 0, 10) }),
      fBefore: (d) => (d.lateDeliveries > 5 ? 2 : 1),
      fAfter: (slip) => (d) => (slip ? (d.lateDeliveries >= 5 ? 2 : 1) : d.lateDeliveries > 5 ? 2 : 1),
      showIn: (d) => `late=${d.lateDeliveries}`,
      showOut: String,
    },
    "Replace conditional with polymorphism": {
      before: [
        "function fee(payment) {",
        "  switch (payment.kind) {",
        "    case \"card\": return 0.3 + payment.amount * 0.029;",
        "    case \"bank\": return Math.min(5, payment.amount * 0.008);",
        "    case \"wallet\": return payment.amount > 1000 ? 0 : 0.5;",
        "    default: throw new Error(`unknown kind ${payment.kind}`);",
        "  }",
        "}",
      ],
      after: [
        "interface PaymentMethod { fee(amount: number): number; }",
        "class Card implements PaymentMethod { fee(a) { return 0.3 + a * 0.029; } }",
        "class Bank implements PaymentMethod { fee(a) { return Math.min(5, a * 0.008); } }",
        "class Wallet implements PaymentMethod { fee(a) { return a > 1000 ? 0 : 0.5; } }",
        "",
        "const METHODS: Record<string, PaymentMethod> =",
        "  { card: new Card(), bank: new Bank(), wallet: new Wallet() };",
        "const fee = (p) => METHODS[p.kind].fee(p.amount);",
      ],
      slipLines: { 3: "class Wallet implements PaymentMethod { fee(a) { return a >= 1000 ? 0 : 0.5; } }" },
      slipText: "the wallet rule was retyped as <code>a &gt;= 1000</code>",
      steps: [
        ["before", [1, 2, 3, 4], "A switch on a type code. On its own it's fine. It becomes a smell when the <b>same</b> switch appears in fee, refund, limits and display name: adding a payment kind means finding them all."],
        ["after", [0], "Create an interface for the behaviour that varies, and one class per case."],
        ["after", [1, 2, 3], "Move each case's body into its class. Each class can now hold the kind's other rules too, so the next switch on <code>kind</code> moves for free."],
        ["after", [5, 6, 7], "One lookup replaces the switch. A new kind is a new class plus one registration, with no edits to existing cases (open–closed). Run the tests."],
      ],
      gen: (r) => ({ kind: ["card", "bank", "wallet"][ri(r, 0, 2)], amount: r() < 0.25 ? pick([0, 625, 1000, 1000.01]) : Math.round(r() * 200000) / 100 }),
      fBefore: (p) => { switch (p.kind) { case "card": return 0.3 + p.amount * 0.029; case "bank": return Math.min(5, p.amount * 0.008); case "wallet": return p.amount > 1000 ? 0 : 0.5; default: throw new Error("unknown"); } },
      fAfter: (slip) => {
        class Card { fee(a) { return 0.3 + a * 0.029; } }
        class Bank { fee(a) { return Math.min(5, a * 0.008); } }
        class Wallet { fee(a) { return slip ? (a >= 1000 ? 0 : 0.5) : a > 1000 ? 0 : 0.5; } }
        const M = { card: new Card(), bank: new Bank(), wallet: new Wallet() };
        return (p) => M[p.kind].fee(p.amount);
      },
      showIn: (p) => `${p.kind} ${p.amount}`,
      showOut: money,
    },
    "Introduce parameter object": {
      before: [
        "function amountInvoiced(invoices, startDay, endDay) {",
        "  return invoices",
        "    .filter((i) => i.day >= startDay && i.day <= endDay)",
        "    .reduce((sum, i) => sum + i.amount, 0);",
        "}",
        "// also: amountReceived(payments, startDay, endDay),",
        "//       overdueCount(invoices, startDay, endDay) ...",
      ],
      after: [
        "class DayRange {",
        "  constructor(readonly start: number, readonly end: number) {",
        "    if (end < start) throw new RangeError(\"end before start\");",
        "  }",
        "  contains(day: number) { return day >= this.start && day <= this.end; }",
        "}",
        "function amountInvoiced(invoices, range: DayRange) {",
        "  return invoices.filter((i) => range.contains(i.day))",
        "                 .reduce((sum, i) => sum + i.amount, 0);",
        "}",
      ],
      slipLines: { 4: "  contains(day: number) { return day >= this.start && day < this.end; }" },
      slipText: "<code>contains</code> was written with an exclusive end (<code>day &lt; this.end</code>)",
      steps: [
        ["before", [0, 2, 5, 6], "<code>startDay, endDay</code> travel together through several functions: a <b>data clump</b>. Every caller can pass them in the wrong order, and each function re-implements “is this day in range”."],
        ["after", [0, 1, 2, 3], "Create a small immutable type for the clump. It validates itself once, so no function ever sees an inverted range."],
        ["after", [4], "Behaviour moves to the data: <code>contains</code> lives in one place, so “inclusive or exclusive end?” is decided once."],
        ["after", [6, 7], "Change the signatures to take the range, one function at a time, running tests after each."],
      ],
      gen: (r) => { const a = ri(r, 1, 28), b = ri(r, a, 31); return { start: a, end: b, invoices: Array.from({ length: ri(r, 1, 5) }, () => ({ day: r() < 0.3 ? pick([a, b]) : ri(r, 1, 31), amount: ri(r, 10, 500) })) }; },
      fBefore: (x) => x.invoices.filter((i) => i.day >= x.start && i.day <= x.end).reduce((s, i) => s + i.amount, 0),
      fAfter: (slip) => (x) => { const range = { contains: (d) => d >= x.start && (slip ? d < x.end : d <= x.end) }; return x.invoices.filter((i) => range.contains(i.day)).reduce((s, i) => s + i.amount, 0); },
      showIn: (x) => `${x.start}–${x.end}: [${x.invoices.map((i) => i.day).join(",")}]`,
      showOut: String,
    },
    "Replace magic number": {
      before: [
        "function lateFee(daysLate, amount) {",
        "  if (daysLate <= 14) return 0;",
        "  return Math.min(amount * 0.015 * Math.ceil((daysLate - 14) / 30), 50);",
        "}",
      ],
      after: [
        "const GRACE_PERIOD_DAYS = 14;",
        "const MONTHLY_INTEREST = 0.015;",
        "const DAYS_PER_BILLING_MONTH = 30;",
        "const MAX_LATE_FEE = 50;",
        "",
        "function lateFee(daysLate, amount) {",
        "  if (daysLate <= GRACE_PERIOD_DAYS) return 0;",
        "  const months = Math.ceil((daysLate - GRACE_PERIOD_DAYS) / DAYS_PER_BILLING_MONTH);",
        "  return Math.min(amount * MONTHLY_INTEREST * months, MAX_LATE_FEE);",
        "}",
      ],
      slipLines: { 1: "const MONTHLY_INTEREST = 0.15;" },
      slipText: "the constant was typed as <code>0.15</code> instead of <code>0.015</code>",
      steps: [
        ["before", [1, 2], "Four unexplained numbers. Is 14 the same 14 in both places? Is 30 “days in a month” or “days until collections”? The reader has to guess, and a future change must find every copy."],
        ["after", [0, 1, 2, 3], "Name each number for its <b>meaning</b>, not its value (<code>FOURTEEN</code> is no better than 14). Two numbers that happen to be equal but mean different things get two constants."],
        ["after", [6, 7, 8], "Replace each use, one at a time. An explaining variable (<code>months</code>) makes the formula read like the business rule. Run the tests."],
      ],
      gen: (r) => ({ daysLate: r() < 0.3 ? pick([13, 14, 15, 44, 45]) : ri(r, 0, 150), amount: ri(r, 50, 5000) }),
      fBefore: (x) => (x.daysLate <= 14 ? 0 : Math.min(x.amount * 0.015 * Math.ceil((x.daysLate - 14) / 30), 50)),
      fAfter: (slip) => (x) => { const G = 14, R = slip ? 0.15 : 0.015, D = 30, M = 50; if (x.daysLate <= G) return 0; const months = Math.ceil((x.daysLate - G) / D); return Math.min(x.amount * R * months, M); },
      showIn: (x) => `${x.daysLate} days, ${x.amount}`,
      showOut: money,
    },
    "Decompose conditional": {
      before: [
        "function charge(date, quantity) {",
        "  if (date.month >= 6 && date.month <= 8 &&",
        "      !(date.month === 6 && date.day === 24))",
        "    return quantity * SUMMER_RATE;",
        "  else",
        "    return quantity * REGULAR_RATE + SERVICE_CHARGE;",
        "}",
      ],
      after: [
        "function charge(date, quantity) {",
        "  return isSummer(date) ? summerCharge(quantity) : regularCharge(quantity);",
        "}",
        "const isSummer = (d) => d.month >= 6 && d.month <= 8 && !isMidsummerDay(d);",
        "const isMidsummerDay = (d) => d.month === 6 && d.day === 24;",
        "const summerCharge = (q) => q * SUMMER_RATE;",
        "const regularCharge = (q) => q * REGULAR_RATE + SERVICE_CHARGE;",
      ],
      slipLines: { 3: "const isSummer = (d) => d.month >= 6 && d.month < 8 && !isMidsummerDay(d);" },
      slipText: "<code>isSummer</code> was written with <code>d.month &lt; 8</code>, dropping August",
      steps: [
        ["before", [1, 2], "The condition says <i>how</i> (month ranges, a special day) but not <i>why</i>. The reader has to decode it to learn that it means “summer season”."],
        ["after", [3, 4], "Extract the condition into a function named for the business concept. A second level (<code>isMidsummerDay</code>) names the exception."],
        ["after", [5, 6], "Extract each branch too, so both sides read at the same level of abstraction."],
        ["after", [1], "The function is now one sentence. Run the tests."],
      ],
      gen: (r) => ({ month: r() < 0.3 ? pick([5, 6, 8, 9]) : ri(r, 1, 12), day: r() < 0.2 ? 24 : ri(r, 1, 28), quantity: ri(r, 1, 100) }),
      fBefore: (x) => (x.month >= 6 && x.month <= 8 && !(x.month === 6 && x.day === 24) ? x.quantity * 0.8 : x.quantity * 1.0 + 5),
      fAfter: (slip) => (x) => { const mid = (d) => d.month === 6 && d.day === 24; const summer = (d) => d.month >= 6 && (slip ? d.month < 8 : d.month <= 8) && !mid(d); return summer(x) ? x.quantity * 0.8 : x.quantity * 1.0 + 5; },
      showIn: (x) => `${x.month}/${x.day} ×${x.quantity}`,
      showOut: money,
    },
    "Replace temp with query": {
      before: [
        "function price(order) {",
        "  const basePrice = order.quantity * order.itemPrice;",
        "  let discountFactor = 0.98;",
        "  if (basePrice > 1000) discountFactor -= 0.03;",
        "  return basePrice * discountFactor;",
        "}",
      ],
      after: [
        "class Order {",
        "  constructor(readonly quantity: number, readonly itemPrice: number) {}",
        "  get basePrice() { return this.quantity * this.itemPrice; }",
        "  get discountFactor() { return this.basePrice > 1000 ? 0.95 : 0.98; }",
        "  get price() { return this.basePrice * this.discountFactor; }",
        "}",
      ],
      slipLines: { 2: "  get basePrice() { return Math.round(this.quantity * this.itemPrice); }" },
      slipText: "<code>basePrice</code> picked up a <code>Math.round</code> while being moved",
      steps: [
        ["before", [1, 2, 3], "Temporaries hold values that only this function can see. Other methods on <code>Order</code> that need the base price or discount must recompute them, slightly differently each time."],
        ["after", [2], "Turn the temp into a query (a getter with no side effects). It's now reusable and testable on its own."],
        ["after", [3], "Same for the discount factor. The mutable <code>let … -=</code> becomes a single expression, so there's no ordering to get wrong."],
        ["after", [4], "<code>price</code> is built from named queries. Recomputing is cheap; if profiling ever says otherwise, cache inside the getter. Run the tests."],
      ],
      gen: (r) => (r() < 0.2 ? { quantity: 10, itemPrice: 100 } : { quantity: ri(r, 1, 50), itemPrice: r() < 0.5 ? ri(r, 1, 80) : Math.round(r() * 8000) / 100 }),
      fBefore: (o) => { const b = o.quantity * o.itemPrice; let d = 0.98; if (b > 1000) d -= 0.03; return b * d; },
      fAfter: (slip) => (o) => { const b = slip ? Math.round(o.quantity * o.itemPrice) : o.quantity * o.itemPrice; return b * (b > 1000 ? 0.95 : 0.98); },
      showIn: (o) => `${o.quantity} × ${o.itemPrice}`,
      showOut: (x) => (typeof x === "number" ? x.toFixed(4) : String(x)),
    },
  };
  const RF_MODES = ["carefully (behaviour preserved)", "with a slip"];
  Viz.register("clean-code-refactor", (el) => Viz.player(el, {
    title: "Refactoring catalog: change the shape, keep the behaviour",
    tag: "MECHANICS + REAL TEST RUN",
    legend: [["active", "lines involved in this step"], ["done", "before and after agree"], ["bad", "behaviour changed"]],
    inputs: [
      { key: "rf", label: "refactoring", type: "select", options: Object.keys(RF), value: "Extract function", width: 290 },
      { key: "mode", label: "done", type: "select", options: RF_MODES, value: RF_MODES[0], width: 260 },
    ],
    random: () => ({ rf: pick(Object.keys(RF)), mode: pick(RF_MODES) }),
    build: ({ rf, mode }) => {
      const R = RF[rf];
      if (!R) throw new Error("Pick a refactoring from the list.");
      const slip = mode === RF_MODES[1];
      const after = R.after.map((l, i) => (slip && R.slipLines[i] !== undefined ? R.slipLines[i] : l));
      const slipIdx = slip ? Object.keys(R.slipLines).map(Number) : [];
      const base = { rf, slip, before: R.before, after, steps: R.steps.map((s) => s[2]), slipIdx };
      const frames = R.steps.map(([which, cur, note], k) => ({ ...base, step: k, which, cur, note }));
      const r = rng(20240611 + rf.length * 7919);
      const fa = R.fAfter(slip);
      const cases = [];
      let fails = 0, firstFail = null;
      for (let n = 0; n < 300; n++) {
        const input = R.gen(r);
        const exp = R.fBefore(input), act = fa(input);
        const ok = near(exp, act);
        if (!ok) { fails++; if (!firstFail) firstFail = { input, exp, act, n }; }
        if (cases.length < 5 || (!ok && cases.filter((c) => !c.ok).length < 2)) cases.push({ input, exp, act, ok });
      }
      const sample = cases.slice(-5);
      frames.push({ ...base, step: R.steps.length, which: "after", cur: slipIdx, tests: { n: 300, fails, sample, firstFail }, verdict: fails ? "bad" : "done",
        head: fails ? `${fails} of 300 cases changed behaviour` : "300 of 300 cases agree",
        sub: fails ? `first failure: ${esc(R.showIn(firstFail.input))} → expected ${esc(R.showOut(firstFail.exp))}, got ${esc(R.showOut(firstFail.act))}` : "same outputs, better shape",
        note: fails ? `The slip: ${R.slipText}. Running the old and new code on the same inputs (with boundary values deliberately mixed in, as property-based testing does) finds it immediately. This is why refactoring happens in <b>small steps with the tests green after each one</b>: when a test goes red you know exactly which edit did it.` : `The old and new implementations produce identical results on 300 generated inputs, including the boundary cases. That is the definition of a refactoring: structure changes, behaviour doesn't. If you can't run tests like these, you're not refactoring, you're rewriting.` });
      return frames;
    },
    render: (f) => {
      const lines = f.which === "before" ? f.before : f.after;
      const marks = {};
      if (f.which === "after") f.slipIdx.forEach((i) => { marks[i] = "slip"; });
      const steps = `<ol class="cc-steps">${f.steps.map((s, i) => `<li class="${i === f.step ? "cur" : i < f.step ? "done" : ""}">${i + 1}</li>`).join("")}<li class="${f.tests ? (f.verdict === "bad" ? "bad" : "done") : ""}">tests</li></ol>`;
      const t = f.tests;
      const R = RF[f.rf];
      const table = t ? `<table class="cc-tbl"><tr><th>input</th><th>before</th><th>after</th><th></th></tr>${t.sample.map((c) => `<tr class="${c.ok ? "" : "cc-bad"}"><td>${esc(R.showIn(c.input))}</td><td>${esc(R.showOut(c.exp))}</td><td>${esc(R.showOut(c.act))}</td><td>${c.ok ? '<b class="cc-okc">✓</b>' : '<b class="cc-koc">✗</b>'}</td></tr>`).join("")}</table>` : "";
      return `<div class="cc-split"><div class="cc-split-l">${codePanel(lines, "typescript", f.cur, f.which === "before" ? "before" : "after" + (f.slip ? " (with the slip)" : ""), marks)}</div><div class="cc-split-r">${steps}${t ? stats([["generated cases", t.n, ""], ["agree", t.n - t.fails, "done"], ["differ", t.fails, t.fails ? "bad" : ""]]) : ""}${table}${f.verdict ? verdict(f.verdict, f.head, f.sub) : ""}</div></div>`;
    },
  }));

  /* =====================================================================
   * 3. Naming checker: splits an identifier into words, runs the rules a
   *    reviewer applies (convention, abbreviations, type encoding, noise
   *    words, kind-specific grammar) and proposes a better name.
   * ===================================================================== */
  const LANGS = ["C#", "Java", "Python", "Go", "TypeScript"];
  const KINDS = ["variable", "boolean", "function / method", "class / type", "collection", "constant"];
  const ABBR = { usr: "user", mgr: "manager", cnt: "count", tmp: "temp", idx: "index", msg: "message", btn: "button", calc: "calculate", val: "value", lst: "list", cfg: "config", conf: "config", req: "request", res: "response", resp: "response", pwd: "password", addr: "address", dt: "date", qty: "quantity", amt: "amount", cust: "customer", acct: "account", txn: "transaction", tot: "total", num: "number", no: "number", desc: "description", usrs: "users", recs: "records", rec: "record", emp: "employee", inv: "invoice", prod: "product", ord: "order", svc: "service", proc: "process", chk: "check", upd: "update", del: "delete", ret: "result", pmt: "payment", nm: "name", fn: "function", cb: "callback", el: "element", evt: "event", e: "event", ex: "exception", err: "error", dst: "destination", src: "source" };
  const ACRO = new Set(["id", "url", "http", "https", "json", "api", "sql", "html", "xml", "uuid", "io", "ip", "tcp", "utc", "csv", "jwt", "db"]);
  const HUNG = new Set(["str", "s", "sz", "int", "i", "n", "b", "f", "fl", "dbl", "arr", "obj", "lst", "dict", "lp", "p", "m", "g"]);
  const TYPE_SUFFIX = new Set(["list", "array", "arr", "dict", "map", "set", "string", "str", "int", "obj", "object", "collection"]);
  const NOISE = new Set(["manager", "helper", "util", "utils", "utility", "data", "info", "stuff", "thing", "misc", "object", "processor", "foo", "bar", "my", "the", "do", "handle", "common", "general"]);
  const BOOL_PREFIX = new Set(["is", "has", "can", "should", "was", "will", "needs", "allows", "allow", "supports", "contains", "exists", "are", "did", "may", "must"]);
  const NEG = new Set(["not", "no", "never", "disabled", "disable", "dont", "non", "un", "without", "hidden"]);
  const VERBS = new Set(["get", "set", "find", "load", "save", "create", "build", "make", "compute", "calculate", "send", "parse", "validate", "apply", "add", "remove", "delete", "update", "fetch", "render", "is", "has", "can", "to", "should", "run", "start", "stop", "open", "close", "read", "write", "check", "ensure", "format", "convert", "map", "filter", "sort", "merge", "register", "resolve", "try", "emit", "publish", "schedule", "reserve", "charge", "refund", "cancel", "notify", "retry", "list", "count", "sum", "split", "join", "append", "insert", "reset", "clear", "init", "initialize", "connect", "dispose", "encode", "decode", "hash", "verify", "sign", "approve", "reject", "submit", "import", "export", "print", "log", "handle", "process", "do", "manage", "perform", "execute", "enqueue", "dequeue", "subscribe", "dispatch", "invoke", "compare", "select", "accept", "lock", "unlock", "release", "acquire", "watch", "track", "mark", "move", "copy", "clone", "transform", "normalize", "sanitize", "escape", "render", "show", "hide", "toggle", "use"]);
  const VAGUE_VERBS = new Set(["handle", "process", "do", "manage", "perform", "execute"]);
  const IRREG = { person: "people", child: "children", man: "men", woman: "women", datum: "data", index: "indexes", entry: "entries", status: "statuses", address: "addresses", data: "data", info: "info", news: "news" };
  const plural = (w) => IRREG[w] || (/(s|x|z|ch|sh)$/.test(w) ? w + "es" : /[^aeiou]y$/.test(w) ? w.slice(0, -1) + "ies" : w + "s");
  const singular = (w) => { const inv = Object.entries(IRREG).find(([, p]) => p === w); if (inv) return inv[0]; if (/ies$/.test(w)) return w.slice(0, -3) + "y"; if (/(ses|xes|zes|ches|shes)$/.test(w)) return w.slice(0, -2); if (/[^s]s$/.test(w)) return w.slice(0, -1); return w; };
  const isPlural = (w) => w in { data: 1, people: 1, children: 1, info: 1 } || (/s$/.test(w) && !/(ss|us|is)$/.test(w));
  function splitWords(name) {
    const raw = name.replace(/^[_$]+/, "").replace(/^m_/, "m_");
    return raw.replace(/([a-z0-9])([A-Z])/g, "$1 $2").replace(/([A-Z]+)([A-Z][a-z])/g, "$1 $2").replace(/([a-zA-Z])(\d)/g, "$1 $2").split(/[\s_\-]+/).filter(Boolean).map((w) => w.toLowerCase());
  }
  function expectedStyle(lang, kind) {
    const cls = kind === "class / type", con = kind === "constant", fnk = kind === "function / method";
    if (lang === "C#") return cls || fnk || con ? "PascalCase" : "camelCase";
    if (lang === "Java") return cls ? "PascalCase" : con ? "UPPER_SNAKE" : "camelCase";
    if (lang === "Python") return cls ? "PascalCase" : con ? "UPPER_SNAKE" : "snake_case";
    if (lang === "Go") return cls || fnk || con ? "MixedCaps (Pascal if exported)" : "mixedCaps";
    return cls ? "PascalCase" : con ? "UPPER_SNAKE or camelCase" : "camelCase";
  }
  function detectStyle(name) {
    const n = name.replace(/^_+/, "");
    if (/^[A-Z0-9]+(_[A-Z0-9]+)+$/.test(n) || /^[A-Z]{2,}[0-9]*$/.test(n)) return "UPPER_SNAKE";
    if (/_/.test(n)) return /[A-Z]/.test(n) ? "mixed_Snake" : "snake_case";
    if (/^[A-Z]/.test(n)) return "PascalCase";
    if (/[A-Z]/.test(n)) return "camelCase";
    return "lowercase";
  }
  function styleOk(lang, kind, st) {
    const exp = expectedStyle(lang, kind);
    if (st === "lowercase") return exp === "camelCase" || exp === "snake_case" || exp.startsWith("mixedCaps") || (lang === "Go" && exp.startsWith("MixedCaps"));
    if (lang === "Go") return st === "camelCase" || st === "PascalCase";
    if (exp === "UPPER_SNAKE or camelCase") return st === "UPPER_SNAKE" || st === "camelCase";
    return st === exp;
  }
  function fmtName(words, lang, kind, unexported) {
    if (!words.length) return "x";
    if (lang === "Go" && unexported) { const s = fmtName(words, lang, kind); return ACRO.has(words[0]) ? s.slice(0, words[0].length).toLowerCase() + s.slice(words[0].length) : s[0].toLowerCase() + s.slice(1); }
    const cap = (w) => (lang === "Go" && ACRO.has(w) ? w.toUpperCase() : w[0].toUpperCase() + w.slice(1));
    const exp = expectedStyle(lang, kind);
    if (exp === "UPPER_SNAKE" || (exp.startsWith("UPPER") && kind === "constant")) return words.join("_").toUpperCase();
    if (exp === "snake_case") return words.join("_");
    if (exp.startsWith("PascalCase") || exp.startsWith("MixedCaps")) return words.map(cap).join("");
    return words[0] + words.slice(1).map(cap).join("");
  }
  function usage(n, lang, kind, words) {
    const one = fmtName(words.length && isPlural(words[words.length - 1]) ? [...words.slice(0, -1), singular(words[words.length - 1])] : ["item"], lang, "variable");
    const T = {
      variable: { "C#": `var ${n} = Load();`, Java: `var ${n} = load();`, Python: `${n} = load()`, Go: `${n} := load()`, TypeScript: `const ${n} = load();` },
      boolean: { "C#": `if (${n}) { … }`, Java: `if (${n}) { … }`, Python: `if ${n}:`, Go: `if ${n} {`, TypeScript: `if (${n}) { … }` },
      "function / method": { "C#": `var result = ${n}(order);`, Java: `var result = ${n}(order);`, Python: `result = ${n}(order)`, Go: `result, err := ${n}(order)`, TypeScript: `const result = ${n}(order);` },
      "class / type": { "C#": `var x = new ${n}();`, Java: `var x = new ${n}();`, Python: `x = ${n}()`, Go: `x := ${n}{}`, TypeScript: `const x = new ${n}();` },
      collection: { "C#": `foreach (var ${one} in ${n})`, Java: `for (var ${one} : ${n})`, Python: `for ${one} in ${n}:`, Go: `for _, ${one} := range ${n} {`, TypeScript: `for (const ${one} of ${n})` },
      constant: { "C#": `const int ${n} = 3;`, Java: `static final int ${n} = 3;`, Python: `${n} = 3`, Go: `const ${n} = 3`, TypeScript: `const ${n} = 3;` },
    };
    return T[kind][lang];
  }
  const LLANG = { "C#": "csharp", Java: "java", Python: "python", Go: "go", TypeScript: "typescript" };
  const NAME_SAMPLES = [
    ["strCustNameList", "collection", "C#"], ["usrMgr", "class / type", "Java"], ["bIsNotDisabled", "boolean", "TypeScript"], ["data2", "variable", "Python"],
    ["processData", "function / method", "C#"], ["UserDataManagerHelper", "class / type", "C#"], ["flag", "boolean", "Go"], ["calc_tot_amt", "function / method", "Python"],
    ["userId", "variable", "Go"], ["x", "variable", "Java"], ["customerList", "collection", "TypeScript"], ["isNotValid", "boolean", "Java"],
    ["getUserByIdFromDatabaseWithRetryAndCacheFallback", "function / method", "TypeScript"], ["maxRetries", "constant", "Python"], ["invoice", "function / method", "Go"], ["orders", "collection", "C#"],
  ];
  Viz.register("clean-code-naming", (el) => Viz.player(el, {
    title: "Naming checker: the rules a reviewer applies, one at a time",
    tag: "TYPE A NAME · STEP THROUGH",
    legend: [["done", "rule passes"], ["bad", "rule fails"], ["active", "word being fixed"]],
    inputs: [
      { key: "name", label: "identifier", value: "strCustNameList", width: 230 },
      { key: "kind", label: "it is a", type: "select", options: KINDS, value: "collection", width: 170 },
      { key: "lang", label: "language", type: "select", options: LANGS, value: "C#", width: 120 },
    ],
    random: () => { const s = pick(NAME_SAMPLES); return { name: s[0], kind: s[1], lang: s[2] }; },
    build: ({ name, kind, lang }) => {
      name = String(name).trim();
      if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(name)) throw new Error("Type a single identifier: letters, digits and underscores, not starting with a digit.");
      if (name.length > 60) throw new Error("Keep it under 60 characters.");
      const orig = splitWords(name);
      let words = orig.map((w) => ({ w, tag: "" }));
      const checks = [];
      const frames = [];
      const snap = (cur, note, extra = {}) => frames.push({ name, kind, lang, words: words.map((x) => ({ ...x })), checks: checks.map((c) => ({ ...c })), cur, note, ...extra });
      snap(-1, `Split <code>${esc(name)}</code> into words: <b>${orig.map(esc).join(" · ")}</b>. Every rule below works on these words, whatever the casing. A good name answers <i>why it exists, what it does and how it's used</i> without a comment.`);
      const add = (rule, ok, why, fix) => { checks.push({ rule, ok, why }); snap(checks.length - 1, `<b>${esc(rule)}</b>: ${why}${fix ? ` ${fix}` : ""}`); };
      const st = detectStyle(name), exp = expectedStyle(lang, kind);
      const goAcro = lang === "Go" && orig.some((w) => ACRO.has(w)) && /(Id|Url|Http|Json|Api|Sql|Html|Uuid|Ip)(?![a-z])/.test(name);
      add("casing convention", styleOk(lang, kind, st) && !goAcro, styleOk(lang, kind, st) && !goAcro ? `${esc(lang)} expects ${esc(exp)} for a ${esc(kind)}, and <code>${esc(name)}</code> is ${esc(st)}.` : goAcro ? `Go keeps initialisms in one case: <code>userID</code>, <code>HTTPServer</code>, not <code>userId</code>. <code>golint</code>/<code>revive</code> flag this.` : `${esc(lang)} expects <b>${esc(exp)}</b> for a ${esc(kind)}, but this is ${esc(st)}. Mixed conventions make every reader stop and wonder whether it's a type, a constant or a local.`, lang === "Go" ? "In Go the first letter also decides visibility: upper case is exported from the package." : "");
      const hung = orig.length > 1 && HUNG.has(orig[0]) && !(lang === "C#" && kind === "class / type" && orig[0] === "i");
      const mPrefix = /^m_|^_?[a-z]_/.test(name) && !/^_[a-z]/.test(name.replace(/^m_/, "x"));
      const suffixType = orig.length > 1 && TYPE_SUFFIX.has(orig[orig.length - 1]);
      if (hung) words[0].tag = "drop";
      if (suffixType) words[words.length - 1].tag = "drop";
      add("no type encoding", !hung && !suffixType && !mPrefix, hung || suffixType || mPrefix ? `${hung ? `<code>${esc(orig[0])}</code> is a Hungarian type prefix. ` : ""}${suffixType ? `<code>${esc(orig[orig.length - 1])}</code> repeats the type in the name. ` : ""}${mPrefix ? "<code>m_</code>-style scope prefixes duplicate what the IDE already shows. " : ""}The type system and your editor already know the type; if the type changes to a set or a stream, the name becomes a lie.` : "The name describes the role, not the type. Good: the type can change without renaming.", suffixType && kind === "collection" ? "A plural noun says “many” without naming the container." : "");
      let abbrs = 0;
      words.forEach((x) => { if (x.tag !== "drop" && ABBR[x.w] && !(x.w === "e" && kind !== "variable")) { x.tag = "abbr"; abbrs++; } });
      add("no cryptic abbreviations", abbrs === 0, abbrs ? `${words.filter((x) => x.tag === "abbr").map((x) => `<code>${esc(x.w)}</code> → <b>${esc(ABBR[x.w])}</b>`).join(", ")}. Abbreviations save a few keystrokes once and cost every future reader a decoding step. Widely known ones (<code>id</code>, <code>url</code>, <code>http</code>) are fine.` : "Every word is a real word or an industry-standard acronym.");
      words.forEach((x) => { if (x.tag === "abbr") { x.w = ABBR[x.w]; x.tag = "fixed"; } });
      const digits = orig.some((w) => /^\d+$/.test(w));
      words.forEach((x) => { if (/^\d+$/.test(x.w)) x.tag = "drop"; });
      const noise = words.filter((x) => x.tag !== "drop" && NOISE.has(x.w) && !(kind === "function / method" && words[0] === x && VERBS.has(x.w)));
      const meaningful = words.filter((x) => x.tag !== "drop" && !NOISE.has(x.w) && !(kind === "function / method" && VAGUE_VERBS.has(x.w)));
      noise.forEach((x) => { if (meaningful.length) x.tag = "drop"; });
      add("no noise words", noise.length === 0, noise.length ? `${noise.map((x) => `<code>${esc(x.w)}</code>`).join(", ")} ${noise.length > 1 ? "add" : "adds"} letters but no meaning. <code>CustomerData</code> vs <code>Customer</code>, <code>OrderManager</code> vs …? “Manager” and “Helper” often mean the class has no single job: ask what it actually does (<code>OrderRepository</code>, <code>InvoiceMailer</code>).` : "Every word carries information.", noise.length && !meaningful.length ? "Nothing meaningful is left once the noise goes: the name needs to come from the domain, not from a rule." : "");
      if (digits) add("no number series", false, `A trailing number (<code>${esc(name)}</code>) usually means there's also a <code>…1</code>. Say what makes them different: <code>sourceFile</code>/<code>backupFile</code>, not <code>file1</code>/<code>file2</code>.`);
      const live = () => words.filter((x) => x.tag !== "drop");
      const L = live().length, chars = name.length;
      const lenOk = !(L === 1 && live()[0].w.length <= 2 && kind !== "variable") && chars <= 32 && L <= 5 && !(L === 1 && live()[0].w.length === 1);
      add("length fits the scope", lenOk, chars > 32 || L > 5 ? `${chars} characters, ${L} words. Names that long usually describe the implementation (“…FromDatabaseWithRetry…”); that belongs inside the function. Name the intent and let the parameters and types carry the rest.` : L === 1 && live()[0].w.length <= 2 ? `<code>${esc(name)}</code> is fine as a loop index or a two-line lambda, but anything that lives longer than a few lines needs a name a reader can search for. Name length should grow with scope.` : `${L} word${L > 1 ? "s" : ""}, ${chars} characters: specific without being a sentence.`);
      if (chars > 32 || L > 5) { const keep = live(); const cut = keep.findIndex((x, k) => k > 0 && ["from", "with", "and", "or", "using", "via", "then", "in"].includes(x.w)); keep.forEach((x, k) => { if (k >= (cut > 0 ? cut : 3)) x.tag = "drop"; }); }
      const lw = live();
      if (kind === "boolean") {
        const neg = lw.some((x) => NEG.has(x.w));
        const pref = lw.length && BOOL_PREFIX.has(lw[0].w);
        add("reads as a yes/no question", pref && !neg, neg ? `Negative booleans breed double negatives: <code>if (!${esc(name)})</code> forces the reader to flip it twice. Name the positive state and invert at the call site.` : pref ? "It reads as a question: <code>if (isEnabled)</code>." : `<code>${esc(name)}</code> doesn't say what <i>true</i> means. Prefix with <b>is/has/can/should</b> so <code>if (…)</code> reads as a sentence.`);
        if (neg) {
          lw.forEach((x) => { if (NEG.has(x.w)) { x.tag = "drop"; } });
          const opp = { disabled: "enabled", hidden: "visible", invalid: "valid" };
          words.forEach((x) => { if (x.tag !== "drop" && opp[x.w]) { x.w = opp[x.w]; x.tag = "fixed"; } });
          if (name.toLowerCase().includes("disabled") && !words.some((x) => x.w === "enabled")) words.push({ w: "enabled", tag: "added" });
        }
        const l2 = live();
        if (!l2.length || !BOOL_PREFIX.has(l2[0].w)) words.unshift({ w: "is", tag: "added" });
      } else if (kind === "function / method") {
        const v = lw.length && VERBS.has(lw[0].w);
        const vague = v && VAGUE_VERBS.has(lw[0].w);
        add("starts with a verb", v && !vague, !v ? `Functions do things, so their names start with a verb: <code>${esc(name)}</code> reads like a noun. Is it <code>createInvoice</code>, <code>loadInvoice</code> or <code>sendInvoice</code>?` : vague ? `<code>${esc(lw[0].w)}</code> is a verb, but a vague one: it fits any function. Say what happens: validate, charge, publish, reconcile.` : `<code>${esc(lw[0].w)}</code> says what the function does. Queries (<code>get</code>, <code>find</code>, <code>is</code>) shouldn't change state; commands shouldn't return data (command–query separation).`);
        if (!v) words.unshift({ w: "get", tag: "added" });
      } else if (kind === "class / type") {
        const v = lw.length > 1 && VERBS.has(lw[0].w) && !["list", "map", "set", "log", "sort", "hash", "copy", "use"].includes(lw[0].w);
        add("is a noun", !v, v ? `Types are things; <code>${esc(name)}</code> starts with a verb, which often means a function was promoted to a class. Name what it <i>is</i> (<code>InvoiceCalculator</code> → <code>Invoice</code> with a method, or <code>PriceCalculation</code>).` : "Types name things: nouns or noun phrases.");
      } else if (kind === "collection") {
        const last = lw[lw.length - 1];
        const pl = last && isPlural(last.w);
        add("plural noun", !!pl, pl ? `<code>${esc(name)}</code> is plural, so <code>for each ${esc(singular(last.w))} in ${esc(name)}</code> reads naturally.` : `A collection should be a plural noun, so loops read like English and a single item gets the singular for free.`);
        if (last && !pl) { last.w = plural(last.w); last.tag = "fixed"; }
      } else if (kind === "constant") {
        add("names the meaning, not the value", !lw.some((x) => /^(one|two|three|four|five|ten|zero|hundred|thousand)$/.test(x.w)), "A constant named after its value (<code>SIXTY</code>) is a magic number with extra steps. Name the meaning: <code>SESSION_TIMEOUT_MINUTES</code>. Include the unit when there is one.");
      }
      const final = live().map((x) => x.w);
      const better = final.length ? fmtName(final, lang, kind, /^[a-z]/.test(name)) : name;
      const failed = checks.filter((c) => !c.ok).length;
      snap(-1, `${failed ? `Suggested: <code>${esc(better)}</code>. ` : ""}Read both usages aloud. The rules catch the mechanical problems; only the domain can tell you the <i>right</i> word (is it a customer, a payer or an account holder?). Use the words your product owner uses: that's the ubiquitous language from domain-driven design.`, { final: true, better, failed, before: usage(name, lang, kind, orig), after: usage(better, lang, kind, final) });
      return frames;
    },
    render: (f) => {
      const chips = `<div class="cc-words">${f.words.map((x) => `<span class="cc-word ${x.tag}">${esc(x.w)}${x.tag ? `<small>${x.tag === "drop" ? "drop" : x.tag === "abbr" ? "abbrev" : x.tag === "fixed" ? "fixed" : "added"}</small>` : ""}</span>`).join("")}</div>`;
      const list = `<ul class="cc-checks">${f.checks.map((c, i) => `<li class="${c.ok ? "ok" : "ko"} ${i === f.cur ? "cur" : ""}"><b>${c.ok ? "✓" : "✗"}</b>${esc(c.rule)}</li>`).join("")}</ul>`;
      const lang = LLANG[f.lang];
      const out = f.final ? `${verdict(f.failed ? (f.failed > 2 ? "bad" : "active") : "done", f.failed ? `${f.failed} rule${f.failed > 1 ? "s" : ""} failed → ${f.better}` : "clean name", f.failed ? "suggestion, not a verdict" : "keep it")}<div class="cc-usage"><div><span>before</span><code>${hl(f.before, lang)}</code></div>${f.failed ? `<div class="after"><span>after</span><code>${hl(f.after, lang)}</code></div>` : ""}</div>` : "";
      return `<div class="cc-split"><div class="cc-split-l"><div class="cc-h">${esc(f.lang)} · ${esc(f.kind)}</div><div class="cc-bigname">${esc(f.name)}</div>${chips}</div><div class="cc-split-r">${list}${out}</div></div>`;
    },
  }));

  /* =====================================================================
   * 4. Parameter design: the same six-argument call with a caller mix-up,
   *    under four API designs. Each argument is bound and type-checked, and
   *    the outcome is placed on the "where is it caught" ladder.
   * ===================================================================== */
  const PDES = ["positional primitives", "named arguments", "parameter object", "value types"];
  const PSLIP = ["no mix-up", "start and end swapped", "room and organizer swapped", "recurring and notify swapped"];
  const PARAMS = [
    { k: "start", t: "DateTime", v: "lunchStart", show: "12:00" },
    { k: "end", t: "DateTime", v: "lunchEnd", show: "13:00" },
    { k: "roomId", t: "string", v: "\"R-204\"", show: "R-204" },
    { k: "organizerId", t: "string", v: "\"u-417\"", show: "u-417" },
    { k: "recurring", t: "bool", v: "false", show: "false" },
    { k: "notify", t: "bool", v: "true", show: "true" },
  ];
  const SWAP = { "start and end swapped": [0, 1], "room and organizer swapped": [2, 3], "recurring and notify swapped": [4, 5] };
  const LADDER = [["compile error", "caught at your desk, before the code runs"], ["fails fast", "exception at the call site, in the first test"], ["fails far away", "error in another service, minutes or hours later"], ["silent bug", "wrong data saved; a customer finds it"]];
  function paramCode(des, order) {
    const a = order.map((i) => PARAMS[i]);
    if (des === "positional primitives") return { sig: ["void ScheduleMeeting(", "    DateTime start, DateTime end,", "    string roomId, string organizerId,", "    bool recurring, bool notify)"], call: ["ScheduleMeeting(", `    ${a[0].v}, ${a[1].v},`, `    ${a[2].v}, ${a[3].v},`, `    ${a[4].v}, ${a[5].v});`] };
    if (des === "named arguments") return { sig: ["void ScheduleMeeting(", "    DateTime start, DateTime end,", "    string roomId, string organizerId,", "    bool recurring, bool notify)"], call: ["ScheduleMeeting(", `    ${a[0].k}: ${a[0].v}, ${a[1].k}: ${a[1].v},`, `    ${a[2].k}: ${a[2].v}, ${a[3].k}: ${a[3].v},`, `    ${a[4].k}: ${a[4].v}, ${a[5].k}: ${a[5].v});`] };
    if (des === "parameter object") return { sig: ["record MeetingRequest {", "  public required DateTime Start { get; init; }", "  public required DateTime End { get; init; }", "  public required string RoomId { get; init; }", "  public required string OrganizerId { get; init; }", "  public bool Recurring { get; init; }", "  public bool Notify { get; init; }", "}", "void ScheduleMeeting(MeetingRequest request)"], call: ["ScheduleMeeting(new MeetingRequest {", ...a.map((p) => `    ${p.k[0].toUpperCase() + p.k.slice(1)} = ${p.v},`), "});"] };
    const vt = { start: null, end: null, roomId: `new RoomId(${PARAMS[2].v})`, organizerId: `new UserId(${PARAMS[3].v})`, recurring: "Recurrence.Once", notify: "Invites.Send" };
    const slot = `new TimeSlot(${order[0] === 0 ? "lunchStart, lunchEnd" : "lunchEnd, lunchStart"})`;
    return { sig: ["record TimeSlot(DateTime Start, DateTime End) {", "  // ctor throws if End <= Start", "}", "readonly record struct RoomId(string Value);", "readonly record struct UserId(string Value);", "enum Recurrence { Once, Weekly }", "enum Invites { Send, Skip }", "void ScheduleMeeting(TimeSlot slot, RoomId room,", "    UserId organizer, Recurrence recurrence, Invites invites)"], call: ["ScheduleMeeting(", `    ${slot},`, `    ${vt[a[2].k]}, ${vt[a[3].k]},`, `    ${vt[a[4].k]}, ${vt[a[5].k]});`] };
  }
  Viz.register("clean-code-params", (el) => Viz.player(el, {
    title: "Long parameter lists: where does a mixed-up argument get caught?",
    tag: "BIND + TYPE-CHECK · STEP THROUGH",
    legend: [["done", "bound correctly"], ["bad", "wrong value bound"], ["active", "argument being bound"]],
    inputs: [
      { key: "des", label: "API design", type: "select", options: PDES, value: PDES[0], width: 200 },
      { key: "slip", label: "caller", type: "select", options: PSLIP, value: PSLIP[1], width: 250 },
    ],
    random: () => ({ des: pick(PDES), slip: pick(PSLIP) }),
    build: ({ des, slip }) => {
      if (!PDES.includes(des) || !PSLIP.includes(slip)) throw new Error("Pick a design and a caller mistake.");
      const shown = [0, 1, 2, 3, 4, 5];
      const sw = SWAP[slip];
      const positional = des === "positional primitives";
      const vtypes = des === "value types";
      if (sw) [shown[sw[0]], shown[sw[1]]] = [shown[sw[1]], shown[sw[0]]];
      const order = positional || vtypes ? shown : [0, 1, 2, 3, 4, 5];
      const code = paramCode(des, shown);
      const binds = PARAMS.map((p, i) => {
        const got = PARAMS[order[i]];
        let check = "ok";
        if (got !== p) {
          if (vtypes && i >= 2) check = "type";
          else if (vtypes) check = "validate";
          else check = "wrong";
        }
        return { param: p, got, check, expect: vtypes ? ["TimeSlot.Start", "TimeSlot.End", "RoomId", "UserId", "Recurrence", "Invites"][i] : p.t, gotType: vtypes ? ["DateTime", "DateTime", "RoomId", "UserId", "Recurrence", "Invites"][order[i]] : got.t };
      });
      const base = { des, slip, code, order };
      const frames = [];
      const intro = { "positional primitives": "Six parameters, and only three distinct types. The compiler can check types, not meaning: two <code>DateTime</code>s, two <code>string</code>s and two <code>bool</code>s can each be swapped without any complaint.", "named arguments": "Same signature, but the caller writes each parameter's name. The order no longer matters and the call site documents itself. (C#, Python keyword-only args, Kotlin and Swift have this; Java, Go and TypeScript don't.)", "parameter object": "The six values travel in one object with named properties: an <i>introduce parameter object</i> refactoring. Required properties can't be forgotten, defaults live in one place and adding a seventh option doesn't change every call site.", "value types": "Each concept gets its own small type: a <code>TimeSlot</code> that validates itself, distinct <code>RoomId</code>/<code>UserId</code> types (even though both wrap strings), and enums instead of two bare bools." }[des];
      frames.push({ ...base, bi: -1, binds: [], codeSel: "sig", note: intro });
      frames.push({ ...base, bi: -1, binds: [], codeSel: "call", note: sw ? `The caller is in a hurry and ${esc(slip)}.${positional || vtypes ? "" : " But with names on every argument, the order the caller types them in is irrelevant: each value binds to the parameter it's labelled with, and a reviewer can see <code>end: lunchEnd</code> at a glance."}` : "The caller gets everything right this time. Watch how much the design tells the reader anyway." });
      binds.forEach((b, i) => frames.push({ ...base, bi: i, binds: binds.slice(0, i + 1), codeSel: "call", note: b.check === "ok" ? `<code>${esc(b.param.k)}</code> (${esc(b.expect)}) ← <code>${esc(b.got.v)}</code>. Correct.` : b.check === "type" ? `<code>${esc(b.param.k)}</code> expects <b>${esc(b.expect)}</b> but receives a <b>${esc(b.gotType)}</b>. The compiler refuses: <i>cannot convert from '${esc(b.gotType)}' to '${esc(b.expect)}'</i>.` : b.check === "validate" ? `The type is right (both are <code>DateTime</code>), but <code>TimeSlot</code>'s constructor checks its invariant: end must be after start. It throws <i>here</i>, at the line that made the mistake.` : `<code>${esc(b.param.k)}</code> expects ${esc(b.expect)} and receives ${esc(b.gotType)}, so the type check passes. But the <i>meaning</i> is wrong: ${esc(b.param.k)} = <code>${esc(b.got.show)}</code>.` }));
      const bad = binds.filter((b) => b.check !== "ok");
      let rung = -1, outcome;
      if (!bad.length) outcome = "Meeting booked: R-204, 12:00–13:00, one-off, invites sent.";
      else if (bad.some((b) => b.check === "type")) { rung = 0; outcome = "Build fails. The mistake never reaches a test, let alone production."; }
      else if (bad.some((b) => b.check === "validate")) { rung = 1; outcome = "ArgumentException: end (12:00) must be after start (13:00), thrown from new TimeSlot(…) at the caller's line."; }
      else if (sw[0] === 2) { rung = 2; outcome = "RoomNotFound: 'u-417', thrown inside the booking service. The stack trace points at the service, not at the call that swapped the IDs."; }
      else if (sw[0] === 0) { rung = 3; outcome = "Saved a meeting from 13:00 to 12:00. Nothing throws; the calendar shows nothing, and the room looks free to others."; }
      else { rung = 3; outcome = "Saved a weekly meeting that repeats forever and sent no invitations. Nothing throws."; }
      frames.push({ ...base, bi: -1, binds, codeSel: "call", rung, outcome, final: true, note: `${!bad.length ? "Correct, but notice how much of that depended on the caller being careful." : rung === 3 ? "The worst rung: no error at all. Positional parameters of the same type are a <b>silent-bug generator</b>; static analysers flag lists longer than 3–4 for this reason." : rung === 2 ? "It failed, but far from the cause: someone will spend an hour debugging the booking service before finding the swapped arguments." : rung === 1 ? "A self-validating value type turns a silent bug into an immediate, precise exception. Make invalid states unrepresentable (see the types-and-immutability topic)." : "Distinct types turn the mistake into a compile error: the cheapest possible place to catch it."} Per language: C# named args, records and <code>readonly record struct</code> IDs; Java records plus a builder (no named args); Python keyword-only <code>def f(*, start, end)</code> and <code>NewType</code>; Go struct literals with field names and <code>type RoomID string</code>; TypeScript an options object and branded types.` });
      return frames;
    },
    render: (f) => {
      const lines = f.codeSel === "sig" ? f.code.sig : f.code.call;
      const rows = f.binds.map((b, i) => `<tr class="${i === f.bi ? "cc-cur" : ""} ${b.check === "ok" ? "" : "cc-bad"}"><td><code>${esc(b.param.k)}</code></td><td>${esc(b.expect)}</td><td><code>${esc(b.got.show)}</code></td><td>${b.check === "ok" ? '<b class="cc-okc">✓</b>' : b.check === "type" ? '<b class="cc-koc">type error</b>' : b.check === "validate" ? '<b class="cc-koc">throws</b>' : '<b class="cc-warnc">wrong meaning</b>'}</td></tr>`).join("");
      const ladder = `<div class="cc-ladder">${LADDER.map(([h, s], i) => `<div class="${f.final && f.rung === i ? (i <= 1 ? "hit good" : "hit bad") : ""}"><b>${esc(h)}</b><span>${esc(s)}</span></div>`).join("")}</div>`;
      return `<div class="cc-split"><div class="cc-split-l">${codePanel(f.code.sig, "csharp", [], f.des + ": declaration")}${f.codeSel === "call" ? codePanel(f.code.call, "csharp", f.bi >= 0 ? [] : [], "call site") : ""}</div><div class="cc-split-r">${f.binds.length ? `<table class="cc-tbl"><tr><th>parameter</th><th>expects</th><th>gets</th><th></th></tr>${rows}</table>` : ""}${f.final ? `${f.rung < 0 ? verdict("done", "correct", "") : verdict(f.rung <= 1 ? "done" : "bad", LADDER[f.rung][0], "")}<div class="cc-outcome">${esc(f.outcome)}</div>${ladder}` : ""}</div></div>`;
    },
  }));

  /* =====================================================================
   * 5. DRY vs WET vs rule of three: one seeded stream of requirements hits
   *    three call sites. Each strategy pays for it differently: missed copies,
   *    flag parameters and regressions. Model assumptions are stated in notes.
   * ===================================================================== */
  const DRY_STRATS = ["copy-paste (WET)", "abstract at 2nd use", "rule of three"];
  const DRY_MIX = ["mostly shared changes", "mixed", "mostly divergent changes"];
  const SITES = ["invoice", "receipt", "email"];
  const SHARED_REQ = ["fix rounding (half-even)", "add currency symbol", "thousands separator", "negatives in parentheses", "locale-aware decimals", "fix rounding of 0.005"];
  const DIV_REQ = { invoice: ["show currency code", "right-align amounts"], receipt: ["show tax line", "round to 5 cents"], email: ["compact format", "hide decimals for whole amounts"] };
  function dryRun(strat, mix, seed) {
    const r = rng(seed * 2654435761 + mix.length);
    const pDiv = mix === DRY_MIX[0] ? 0.2 : mix === DRY_MIX[1] ? 0.5 : 0.8;
    const evs = [];
    let si = 0;
    const divUsed = { invoice: 0, receipt: 0, email: 0 };
    for (let t = 0; t < 14; t++) {
      if (t === 0 || t === 2 || t === 5) { evs.push({ kind: "site", site: SITES[t === 0 ? 0 : t === 2 ? 1 : 2] }); continue; }
      const live = SITES.slice(0, t < 2 ? 1 : t < 5 ? 2 : 3);
      if (r() < pDiv) { const site = live[Math.floor(r() * live.length)]; evs.push({ kind: "div", site, text: `${site}: ${DIV_REQ[site][divUsed[site]++ % 2]}` }); }
      else evs.push({ kind: "shared", text: `all: ${SHARED_REQ[si++ % SHARED_REQ.length]}` });
    }
    const st = { copies: 0, shared: false, flags: 0, edits: 0, missed: 0, regressions: 0, extractedAt: -1, decided: "" };
    const hist = { shared: 0, div: 0 };
    const rows = evs.map((e, t) => {
      const row = { t, e, edits: 0, bug: "", note: "" };
      if (e.kind === "site") {
        if (st.copies === 0) { st.copies = 1; row.edits = 1; row.note = "first implementation"; }
        else if (strat === DRY_STRATS[1] && !st.shared) { st.shared = true; st.copies++; row.edits = 3; st.extractedAt = t; row.note = "extract a shared function; both sites call it"; }
        else if (strat === DRY_STRATS[2] && st.copies === 2) {
          st.copies++;
          if (hist.shared >= hist.div) { st.shared = true; row.edits = 4; st.extractedAt = t; st.decided = "extract"; row.note = `3rd use. History so far: ${hist.shared} shared vs ${hist.div} divergent changes, so it really is one concept: extract it, leaving the variations already seen at the call sites`; }
          else { row.edits = 1; st.decided = "keep"; row.note = `3rd use. History so far: ${hist.shared} shared vs ${hist.div} divergent changes: the copies are drifting apart, so keep them separate`; }
        } else { st.copies++; row.edits = st.shared ? 1 : 1; row.note = st.shared ? "new site calls the shared function" : "copy the code to the new site"; }
      } else if (e.kind === "shared") {
        hist.shared++;
        if (st.shared) { row.edits = 1; row.note = "one edit in the shared function"; }
        else { row.edits = st.copies; let miss = 0; for (let k = 1; k < st.copies; k++) if (r() < 0.25) miss++; if (miss) { st.missed += miss; row.bug = `${miss} cop${miss > 1 ? "ies" : "y"} missed`; } row.note = `edit ${st.copies} cop${st.copies > 1 ? "ies" : "y"}`; }
      } else {
        hist.div++;
        if (st.shared) {
          row.edits = 2;
          const pBreak = Math.min(0.5, 0.12 * st.flags);
          const roll = r();
          st.flags++;
          if (roll < pBreak) { st.regressions++; row.bug = "broke another caller"; }
          row.note = `add flag #${st.flags} to the shared function and pass it from ${esc(e.site)}; every caller must be retested`;
        } else { row.edits = 1; row.note = `edit only the ${esc(e.site)} copy`; }
      }
      st.edits += row.edits;
      return { ...row, snap: { ...st } };
    });
    return { evs, rows, st };
  }
  Viz.register("clean-code-dry", (el) => Viz.player(el, {
    title: "DRY, WET or the rule of three: replay one stream of changes",
    tag: "SEEDED SIMULATION · STEP THROUGH",
    legend: [["done", "cheap change"], ["active", "flag added to shared code"], ["bad", "bug: missed copy or regression"]],
    inputs: [
      { key: "strat", label: "strategy", type: "select", options: DRY_STRATS, value: DRY_STRATS[1], width: 190 },
      { key: "mix", label: "the changes are", type: "select", options: DRY_MIX, value: DRY_MIX[2], width: 220 },
      { key: "seed", label: "seed", value: "7", width: 70 },
    ],
    random: () => ({ strat: pick(DRY_STRATS), mix: pick(DRY_MIX), seed: String(1 + Math.floor(Math.random() * 999)) }),
    build: ({ strat, mix, seed }) => {
      const sd = Number.parseInt(seed, 10);
      if (!Number.isFinite(sd) || sd < 0 || sd > 1e9) throw new Error("Seed must be a whole number.");
      if (!DRY_STRATS.includes(strat) || !DRY_MIX.includes(mix)) throw new Error("Pick a strategy and a change mix.");
      const run = dryRun(strat, mix, sd);
      const all = DRY_STRATS.map((s) => ({ s, st: dryRun(s, mix, sd).st }));
      const base = { strat, mix, rows: run.rows };
      const frames = [{ ...base, t: -1, note: `Three screens format money: invoice, receipt and email. They appear over time, and 11 change requests arrive. A <b>shared</b> change applies to every screen (a rounding fix); a <b>divergent</b> one applies to one screen only. Model assumptions: each extra copy has a 25% chance of being forgotten on a shared change, and adding a flag to a function that already has <i>k</i> flags breaks another caller with probability 12%·<i>k</i>.` }];
      run.rows.forEach((row) => frames.push({ ...base, t: row.t, note: `<b>${row.e.kind === "site" ? `new screen: ${esc(row.e.site)}` : esc(row.e.text)}</b>. ${row.note}.${row.bug ? ` <b>Bug: ${esc(row.bug)}.</b>` : ""}` }));
      const score = (st) => st.edits + 5 * (st.missed + st.regressions);
      const best = all.reduce((a, b) => (score(b.st) < score(a.st) ? b : a));
      frames.push({ ...base, t: 99, all, best: best.s, score, final: true, note: `${best.s === strat ? "This strategy wins on this stream." : `On this stream <b>${esc(best.s)}</b> wins.`} ${mix === DRY_MIX[0] ? "When changes really are shared, duplication is expensive: every copy is a chance to forget one. DRY pays off." : mix === DRY_MIX[2] ? "When the screens keep diverging, the “duplication” was coincidental: they looked alike but change for different reasons. An early abstraction collects flags until it's harder to change than the copies were (Sandi Metz: <i>duplication is far cheaper than the wrong abstraction</i>)." : "With a mix, waiting for the third use lets you see which parts vary before you choose the shape of the abstraction."} Try other seeds: the ranking is stable, the exact numbers aren't.` });
      return frames;
    },
    render: (f) => {
      const cur = f.t === 99 ? f.rows[f.rows.length - 1].snap : f.t >= 0 ? f.rows[f.t].snap : { copies: 0, flags: 0, edits: 0, missed: 0, regressions: 0, shared: false };
      const rows = f.rows.map((row) => `<tr class="${row.t === f.t ? "cc-cur" : ""} ${row.t > f.t && f.t !== 99 ? "cc-dim" : ""} ${row.bug && row.t <= f.t ? "cc-bad" : ""}"><td>${row.t + 1}</td><td><span class="cc-ev ${row.e.kind}">${row.e.kind === "site" ? "screen" : row.e.kind === "shared" ? "shared" : "diverge"}</span>${esc(row.e.kind === "site" ? row.e.site : row.e.text)}</td><td>${row.t <= f.t || f.t === 99 ? row.edits : ""}</td><td>${row.t <= f.t || f.t === 99 ? esc(row.bug) : ""}</td></tr>`).join("");
      const sig = cur.shared ? `formatMoney(amount${Array.from({ length: cur.flags }, (_, i) => `, flag${i + 1}`).join("")})` : cur.copies ? `${cur.copies} separate cop${cur.copies > 1 ? "ies" : "y"}` : "nothing yet";
      const right = f.final
        ? `<table class="cc-tbl"><tr><th>strategy</th><th>edits</th><th>missed</th><th>broke</th><th>flags</th></tr>${f.all.map((a) => `<tr class="${a.s === f.best ? "cc-good" : ""} ${a.s === f.strat ? "cc-cur" : ""}"><td>${esc(a.s)}${a.s === DRY_STRATS[2] && a.st.decided ? ` <small>(${a.st.decided === "extract" ? "extracted" : "kept copies"})</small>` : ""}</td><td>${a.st.edits}</td><td>${a.st.missed}</td><td>${a.st.regressions}</td><td>${a.st.flags}</td></tr>`).join("")}</table>${verdict("done", `best here: ${f.best}`, "score = edits + 5 × bugs")}`
        : `${stats([["edits so far", cur.edits, ""], ["missed copies", cur.missed, cur.missed ? "bad" : ""], ["regressions", cur.regressions, cur.regressions ? "bad" : ""], ["paths in shared code", cur.shared ? 2 ** cur.flags : "–", cur.flags > 2 ? "active" : ""]])}<div class="cc-kv"><span>shape of the code</span><code>${esc(sig)}</code></div>`;
      return `<div class="cc-split"><div class="cc-split-l"><div class="cc-h">${esc(f.strat)} · ${esc(f.mix)}</div><table class="cc-tbl cc-events"><tr><th>#</th><th>event</th><th>edits</th><th>bug</th></tr>${rows}</table></div><div class="cc-split-r">${right}</div></div>`;
    },
  }));

  /* =====================================================================
   * 6. Boy-scout rule: 24 modules, change frequency follows a Zipf curve,
   *    every change adds a little debt and debt makes changes slower. Three
   *    policies over 20 sprints of fixed capacity.
   * ===================================================================== */
  const BS_POL = ["no cleanup", "boy-scout rule", "cleanup sprint every 5th"];
  const BS_ENT = ["low (0.3 per change)", "medium (0.5 per change)", "high (0.8 per change)"];
  function bsRun(pol, ent, seed) {
    const r = rng(seed * 7919 + 17);
    const N = 24, CAP = 20, S = 20;
    const w = Array.from({ length: N }, (_, i) => 1 / (i + 1) ** 1.1);
    const W = w.reduce((a, b) => a + b, 0);
    const pickM = () => { let x = r() * W; for (let i = 0; i < N; i++) { x -= w[i]; if (x <= 0) return i; } return N - 1; };
    const add = ent.startsWith("low") ? 0.3 : ent.startsWith("high") ? 0.8 : 0.5;
    const debt = Array(N).fill(2);
    const touches = Array(N).fill(0);
    const sprints = [];
    let cum = 0;
    for (let s = 1; s <= S; s++) {
      let cap = CAP, feats = 0, cleaned = 0;
      if (pol === BS_POL[2] && s % 5 === 0) {
        while (cap >= 1) { const m = debt.indexOf(Math.max(...debt)); if (debt[m] <= 0) break; const d = Math.min(1, debt[m]); debt[m] -= d; cleaned += d; cap -= 1; }
      } else {
        for (;;) {
          const m = pickM();
          const extra = pol === BS_POL[1] ? 0.4 : 0;
          const cost = 1 + 0.25 * debt[m] + extra;
          if (cost > cap) break;
          cap -= cost; feats++; touches[m]++;
          debt[m] += add;
          if (pol === BS_POL[1]) { const d = Math.min(debt[m], 1); debt[m] -= d; cleaned += d; }
        }
      }
      cum += feats;
      sprints.push({ s, feats, cum, cleaned, debt: debt.slice(), touches: touches.slice(), total: debt.reduce((a, b) => a + b, 0) });
    }
    return { sprints, w: w.map((x) => x / W) };
  }
  Viz.register("clean-code-boyscout", (el) => Viz.player(el, {
    title: "Boy-scout rule: clean where you work, and the hot spots stay fast",
    tag: "SEEDED SIMULATION · 20 SPRINTS",
    legend: [["done", "low debt"], ["active", "some debt"], ["bad", "high debt"]],
    inputs: [
      { key: "pol", label: "policy", type: "select", options: BS_POL, value: BS_POL[1], width: 220 },
      { key: "ent", label: "debt added", type: "select", options: BS_ENT, value: BS_ENT[1], width: 210 },
      { key: "seed", label: "seed", value: "42", width: 70 },
    ],
    random: () => ({ pol: pick(BS_POL), ent: pick(BS_ENT), seed: String(1 + Math.floor(Math.random() * 999)) }),
    build: ({ pol, ent, seed }) => {
      const sd = Number.parseInt(seed, 10);
      if (!Number.isFinite(sd) || sd < 0 || sd > 1e9) throw new Error("Seed must be a whole number.");
      if (!BS_POL.includes(pol) || !BS_ENT.includes(ent)) throw new Error("Pick a policy and a debt rate.");
      const runs = BS_POL.map((p) => ({ p, ...bsRun(p, ent, sd) }));
      const me = runs.find((x) => x.p === pol);
      const base = { pol, ent, runs, w: me.w };
      const frames = [{ ...base, k: -1, note: `24 modules. Change frequency follows a power law: module 1 is touched about ${Math.round(me.w[0] / me.w[23])}× as often as module 24, as in most real codebases. Every module starts with 2 units of debt. A feature costs <code>1 + 0.25 × debt</code> points in the module it touches, and each change adds ${esc(ent.split(" ")[0])} debt. Capacity is 20 points per sprint. ${pol === BS_POL[1] ? "Boy-scout rule: every change also spends 0.4 points removing up to 1 unit of debt in the module it touched." : pol === BS_POL[2] ? "Every 5th sprint ships no features and spends its 20 points on the most indebted modules." : "No cleanup at all."}` }];
      me.sprints.forEach((sp, k) => frames.push({ ...base, k, note: `Sprint ${sp.s}: ${sp.feats ? `${sp.feats} features shipped` : "cleanup sprint, no features"}${sp.cleaned ? `, ${sp.cleaned.toFixed(1)} debt removed` : ""}. Total debt ${sp.total.toFixed(1)}; the hottest module has ${sp.debt[0].toFixed(1)}.${k === 9 && pol === BS_POL[0] ? " Watch the hot modules on the left: they're where every feature lands, and they're getting slower." : ""}` }));
      const fin = runs.map((x) => ({ p: x.p, cum: x.sprints[19].cum, hot: x.sprints[19].debt[0], total: x.sprints[19].total }));
      const best = fin.reduce((a, b) => (b.cum > a.cum ? b : a));
      frames.push({ ...base, k: 19, final: true, fin, best: best.p, note: `After 20 sprints: ${fin.map((x) => `${esc(x.p)} shipped <b>${x.cum}</b>`).join(", ")}. The boy-scout rule spends a little on every change, but only where changes happen, so the modules that matter stay cheap. A cleanup sprint costs a whole sprint and polishes debt by size, not by traffic. Cold modules can stay messy: debt nobody touches costs nothing.` });
      return frames;
    },
    render: (f) => {
      const sp = f.k >= 0 ? f.runs.find((x) => x.p === f.pol).sprints[f.k] : { debt: Array(24).fill(2), touches: Array(24).fill(0), cum: 0, s: 0 };
      const cls = (d) => (d < 1.5 ? "done" : d < 4 ? "active" : "bad");
      const maxT = Math.max(1, ...sp.touches);
      const heat = `<div class="cc-heat">${sp.debt.map((d, i) => `<div class="cc-cell ${cls(d)}" title="module ${i + 1}"><b>${d.toFixed(1)}</b><small>m${i + 1}</small><i style="width:${Math.round((sp.touches[i] / maxT) * 100)}%"></i></div>`).join("")}</div>`;
      const W = 360, H = 150, X0 = 34, Y0 = 130;
      const maxC = Math.max(...f.runs.map((x) => x.sprints[19].cum));
      const px = (s) => X0 + ((s) / 20) * (W - X0 - 10), py = (v) => Y0 - (v / maxC) * (Y0 - 14);
      const upto = f.k;
      const lines = f.runs.map((x, j) => { const pts = [[0, 0], ...x.sprints.slice(0, upto + 1).map((q) => [q.s, q.cum])]; return `<polyline class="cc-ln cc-ln${j} ${x.p === f.pol ? "me" : ""}" points="${pts.map(([s, v]) => `${px(s).toFixed(1)},${py(v).toFixed(1)}`).join(" ")}"/>${upto >= 0 ? `<text class="cc-lnl cc-ln${j}" x="${(px(x.sprints[upto].s) + 3).toFixed(1)}" y="${(py(x.sprints[upto].cum) + 3 + (j - 1) * 0).toFixed(1)}">${x.sprints[upto].cum}</text>` : ""}`; }).join("");
      const chart = `<svg class="cc-chart" viewBox="0 0 ${W + 24} ${H}" role="img" aria-label="cumulative features per policy"><line class="cc-axis" x1="${X0}" y1="${Y0}" x2="${W - 10}" y2="${Y0}"/><line class="cc-axis" x1="${X0}" y1="${Y0}" x2="${X0}" y2="10"/><text class="cc-axt" x="${X0 - 4}" y="${Y0 + 4}" text-anchor="end">0</text><text class="cc-axt" x="${X0 - 4}" y="18" text-anchor="end">${maxC}</text><text class="cc-axt" x="${(X0 + W) / 2}" y="${H - 2}" text-anchor="middle">sprint ${sp.s} of 20 · cumulative features</text>${lines}</svg>`;
      const key = `<div class="cc-key">${f.runs.map((x, j) => `<span class="cc-ln${j} ${x.p === f.pol ? "me" : ""}"><i></i>${esc(x.p)}</span>`).join("")}</div>`;
      return `<div class="cc-split"><div class="cc-split-l"><div class="cc-h">debt per module (bar = how often it changed) · ${esc(f.pol)}</div>${heat}</div><div class="cc-split-r">${stats([["sprint", sp.s, ""], ["features shipped", sp.cum, "done"], ["debt in hottest module", sp.debt[0].toFixed(1), cls(sp.debt[0])]])}${chart}${key}${f.final ? verdict(f.best === f.pol ? "done" : "active", `most features: ${f.best}`, f.fin.map((x) => `${esc(x.p)}: ${x.cum}`).join(" · ")) : ""}</div></div>`;
    },
  }));

  /* =====================================================================
   * 7. Smell detector: measures each method of a sample class (length,
   *    parameters, nesting, magic numbers, flag arguments, feature envy,
   *    duplicated lines, type switches) and maps each smell to a refactoring.
   * ===================================================================== */
  const SMELL_SRC = {
    "OrderService (before)": [
      "class OrderService {",
      "  checkout(order, user, coupon, express, giftWrap, notify) {",
      "    let total = 0;",
      "    for (const line of order.lines) {",
      "      if (line.qty > 0) {",
      "        if (line.product.onSale) {",
      "          total += line.qty * line.product.price * 0.9;",
      "        } else {",
      "          total += line.qty * line.product.price;",
      "        }",
      "      }",
      "    }",
      "    if (coupon) total -= coupon.amount;",
      "    if (express) total += 25;",
      "    if (giftWrap) total += 4.99;",
      "    if (total > 500) total = total * 0.97;",
      "    this.db.save(order, total);",
      "    if (notify) this.mailer.send(user.email, `Order ${order.id} confirmed`);",
      "    return total;",
      "  }",
      "  shippingLabel(order) {",
      "    return [order.customer.name, order.customer.street,",
      "      `${order.customer.zip} ${order.customer.city}`, order.customer.country].join(\"\\n\");",
      "  }",
      "  refund(order, user, notify) {",
      "    let total = 0;",
      "    for (const line of order.lines) {",
      "      if (line.qty > 0) {",
      "        total += line.qty * line.product.price;",
      "      }",
      "    }",
      "    this.db.refund(order, total);",
      "    if (notify) this.mailer.send(user.email, `Order ${order.id} refunded`);",
      "    return total;",
      "  }",
      "  fee(payment) {",
      "    switch (payment.kind) {",
      "      case \"card\": return 0.3 + payment.amount * 0.029;",
      "      case \"bank\": return 5;",
      "      default: return 0;",
      "    }",
      "  }",
      "}",
    ],
    "OrderService (after)": [
      "class OrderService {",
      "  checkout(order: Order, options: CheckoutOptions) {",
      "    const total = this.pricing.totalFor(order, options);",
      "    this.orders.save(order, total);",
      "    this.events.publish(new OrderPlaced(order.id, total));",
      "    return total;",
      "  }",
      "  refund(order: Order) {",
      "    const total = this.pricing.subtotal(order);",
      "    this.orders.refund(order, total);",
      "    this.events.publish(new OrderRefunded(order.id, total));",
      "    return total;",
      "  }",
      "}",
      "class Pricing {",
      "  subtotal(order: Order) {",
      "    return order.lines.filter((l) => l.qty > 0).reduce((sum, l) => sum + l.total(), 0);",
      "  }",
      "  totalFor(order: Order, options: CheckoutOptions) {",
      "    const gross = this.subtotal(order) - options.couponAmount + this.extras(options);",
      "    return gross > BULK_THRESHOLD ? gross * BULK_FACTOR : gross;",
      "  }",
      "  extras(options: CheckoutOptions) {",
      "    return (options.express ? EXPRESS_FEE : 0) + (options.giftWrap ? GIFT_WRAP_FEE : 0);",
      "  }",
      "}",
      "class Customer {",
      "  mailingLabel() {",
      "    return [this.name, this.street, `${this.zip} ${this.city}`, this.country].join(\"\\n\");",
      "  }",
      "}",
    ],
  };
  const SMELL_FIX = {
    "long method": "Extract function", "long parameter list": "Introduce parameter object", "deep nesting": "Guard clauses / extract function", "magic numbers": "Replace magic number with named constant",
    "flag argument": "Split into separate functions, or an options object", "feature envy": "Move method to the class whose data it uses", "duplicated code": "Extract function (once the copies change together)", "type switch": "Replace conditional with polymorphism",
  };
  function analyzeClass(lines) {
    const methods = [];
    let cls = "", m = null;
    lines.forEach((l, i) => {
      const cm = l.match(/^class\s+(\w+)/);
      if (cm) { cls = cm[1]; return; }
      const mm = l.match(/^ {2}(\w+)\((.*)\)\s*\{\s*$/);
      if (mm && !m) { m = { cls, name: mm[1], params: mm[2] ? mm[2].split(",").map((p) => p.trim().split(":")[0].trim()) : [], start: i, end: i, body: [] }; return; }
      if (m && /^ {2}\}\s*$/.test(l)) { m.end = i; methods.push(m); m = null; return; }
      if (m) m.body.push({ i, l });
    });
    const norm = (s) => s.trim().replace(/\s+/g, " ");
    const lineCount = new Map();
    methods.forEach((me) => new Set(me.body.map((b) => norm(b.l)).filter((s) => s.length >= 18)).forEach((s) => lineCount.set(s, (lineCount.get(s) || 0) + 1)));
    methods.forEach((me) => {
      const code = me.body.map((b) => b.l.replace(/`[^`]*`|"[^"]*"/g, (s) => s.replace(/\$\{([^}]*)\}/g, " $1 ").replace(/[^\s${}\w.]/g, " ")));
      let depth = 0, maxD = 0;
      code.forEach((l) => { for (const ch of l) { if (ch === "{" ) { depth++; maxD = Math.max(maxD, depth); } else if (ch === "}") depth--; } });
      const nums = [];
      code.forEach((l, k) => { const clean = l.replace(/`[^`]*`|"[^"]*"/g, ""); (clean.match(/(?<![\w.])\d+(?:\.\d+)?(?![\w.])/g) || []).forEach((n) => { if (n !== "0" && n !== "1") nums.push({ n, i: me.body[k].i }); }); });
      const all = code.join("\n");
      const flags = me.params.filter((p) => { const uses = (all.match(new RegExp(`\\b${p}\\b`, "g")) || []).length; const asCond = (all.match(new RegExp(`if \\(${p}\\)`, "g")) || []).length; return uses > 0 && uses === asCond; });
      const thisUses = (all.match(/\bthis\./g) || []).length;
      const envy = me.params.map((p) => ({ p, n: (all.match(new RegExp(`\\b${p}\\.`, "g")) || []).length })).filter((x) => x.n >= 3 && x.n > thisUses + 1);
      const dups = me.body.filter((b) => norm(b.l).length >= 18 && lineCount.get(norm(b.l)) > 1);
      const tswitch = me.body.filter((b) => /switch\s*\(\s*\w+\.(kind|type)\s*\)/.test(b.l));
      me.metrics = { lines: me.body.length, params: me.params.length, nest: Math.max(0, maxD), nums, flags, envy, dups, tswitch, thisUses };
    });
    return methods;
  }
  Viz.register("clean-code-smells", (el) => Viz.player(el, {
    title: "Smell detector: measure, name the smell, pick the refactoring",
    tag: "REAL METRICS · STEP THROUGH",
    legend: [["active", "method being measured"], ["bad", "smell found"], ["done", "within limits"]],
    inputs: [
      { key: "src", label: "class", type: "select", options: Object.keys(SMELL_SRC), value: "OrderService (before)", width: 210 },
      { key: "maxLines", label: "max lines", type: "select", options: ["8", "12", "20"], value: "12", width: 80 },
      { key: "maxParams", label: "max params", type: "select", options: ["2", "3", "4"], value: "3", width: 80 },
      { key: "maxNest", label: "max nesting", type: "select", options: ["1", "2", "3"], value: "2", width: 80 },
    ],
    random: () => ({ src: pick(Object.keys(SMELL_SRC)), maxLines: pick(["8", "12", "20"]), maxParams: pick(["2", "3", "4"]), maxNest: pick(["1", "2", "3"]) }),
    build: ({ src, maxLines, maxParams, maxNest }) => {
      const lines = SMELL_SRC[src];
      if (!lines) throw new Error("Pick a class from the list.");
      const lim = { lines: +maxLines, params: +maxParams, nest: +maxNest };
      const methods = analyzeClass(lines);
      const base = { src, lines, lim };
      const frames = [{ ...base, mi: -1, cur: [], found: [], note: `A smell isn't a bug: it's a surface sign that the design may be resisting change (Fowler and Beck's term). Linters measure the mechanical ones. Thresholds are a team decision: tighten them and more methods trip; that's a conversation starter, not a verdict.` }];
      const found = [];
      methods.forEach((me, mi) => {
        const M = me.metrics, sm = [];
        if (M.lines > lim.lines) sm.push(["long method", `${M.lines} lines > ${lim.lines}`]);
        if (M.params > lim.params) sm.push(["long parameter list", `${M.params} params > ${lim.params}`]);
        if (M.nest > lim.nest) sm.push(["deep nesting", `depth ${M.nest} > ${lim.nest}`]);
        if (M.nums.length) sm.push(["magic numbers", M.nums.map((x) => x.n).join(", ")]);
        if (M.flags.length) sm.push(["flag argument", M.flags.join(", ")]);
        if (M.envy.length) sm.push(["feature envy", M.envy.map((x) => `${x.p}.× ${x.n} vs this.× ${M.thisUses}`).join(", ")]);
        if (M.dups.length) sm.push(["duplicated code", `${M.dups.length} line${M.dups.length > 1 ? "s" : ""} also in another method`]);
        if (M.tswitch.length) sm.push(["type switch", "switch on a kind field"]);
        sm.forEach((s) => found.push({ m: me.name, smell: s[0] }));
        const hot = [...new Set([...M.nums.map((x) => x.i), ...M.dups.map((d) => d.i), ...M.tswitch.map((d) => d.i)])];
        frames.push({ ...base, mi, me, sm, cur: [me.start], hot, range: [me.start, me.end], found: found.slice(), note: sm.length ? `<code>${esc(me.cls)}.${esc(me.name)}</code>: ${sm.map((s) => `<b>${esc(s[0])}</b> (${esc(s[1])}) → ${esc(SMELL_FIX[s[0]])}`).join("; ")}.` : `<code>${esc(me.cls)}.${esc(me.name)}</code>: ${M.lines} line${M.lines > 1 ? "s" : ""}, ${M.params} param${M.params === 1 ? "" : "s"}, nesting ${M.nest}. Nothing to flag: it reads in one pass.` });
      });
      const kinds = {};
      found.forEach((x) => { kinds[x.smell] = (kinds[x.smell] || 0) + 1; });
      frames.push({ ...base, mi: -1, cur: [], found, kinds, final: true, nMethods: methods.length, note: found.length ? `${found.length} smells in ${methods.length} methods. Fix them in order of what's changing: a smelly method nobody touches can wait (boy-scout rule). Compare with the other sample to see the same behaviour after the refactorings in the catalog above.` : `No smells at these thresholds. The behaviour is the same as the “before” class, now spread across classes that each have one reason to change. Note the cost: more types and more jumps. That trade is worth it here, but not always (see “when clean code dogma hurts”).` });
      return frames;
    },
    render: (f) => {
      const marks = {};
      if (f.range) for (let i = f.range[0]; i <= f.range[1]; i++) marks[i] = "in";
      (f.hot || []).forEach((i) => { marks[i] = "hot"; });
      const M = f.me && f.me.metrics;
      const row = (k, v, lim, bad) => `<tr class="${bad ? "cc-bad" : ""}"><td>${esc(k)}</td><td>${esc(v)}</td><td>${esc(lim)}</td><td>${bad ? '<b class="cc-koc">✗</b>' : '<b class="cc-okc">✓</b>'}</td></tr>`;
      const metrics = M ? `<table class="cc-tbl"><tr><th>${esc(f.me.name)}</th><th>value</th><th>limit</th><th></th></tr>${row("lines", M.lines, f.lim.lines, M.lines > f.lim.lines)}${row("parameters", M.params, f.lim.params, M.params > f.lim.params)}${row("nesting", M.nest, f.lim.nest, M.nest > f.lim.nest)}${row("magic numbers", M.nums.length, 0, M.nums.length > 0)}${row("flag arguments", M.flags.length, 0, M.flags.length > 0)}${row("feature envy", M.envy.length ? M.envy[0].p : "–", "–", M.envy.length > 0)}${row("duplicated lines", M.dups.length, 0, M.dups.length > 0)}${row("type switch", M.tswitch.length, 0, M.tswitch.length > 0)}</table>` : "";
      const sum = f.final ? (Object.keys(f.kinds).length ? `<table class="cc-tbl"><tr><th>smell</th><th>×</th><th>refactoring</th></tr>${Object.entries(f.kinds).map(([k, n]) => `<tr><td>${esc(k)}</td><td>${n}</td><td>${esc(SMELL_FIX[k])}</td></tr>`).join("")}</table>` : "") + verdict(f.found.length ? (f.found.length > 6 ? "bad" : "active") : "done", f.found.length ? `${f.found.length} smells in ${f.nMethods} methods` : `0 smells in ${f.nMethods} methods`, "") : "";
      return `<div class="cc-split"><div class="cc-split-l">${codePanel(f.lines, "typescript", f.cur, f.src, marks)}</div><div class="cc-split-r">${metrics}${f.sm && f.sm.length ? `<div class="cc-chips">${f.sm.map((s) => `<span class="bad">${esc(s[0])}</span>`).join("")}</div>` : ""}${sum}</div></div>`;
    },
  }));
})();
