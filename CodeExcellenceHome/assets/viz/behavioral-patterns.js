/* Behavioral patterns visualizers. Every registered name is prefixed "behavioral-patterns-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const STATES = new Set(["active", "visit", "done", "bad", "path", "accent"]);

  /* ---------- shared drawing helpers (inline SVG using the svg.dg vocabulary) ---------- */
  const svg = (w, h, body, label, cls = "") => `<svg class="dg bh-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const box = (x, y, w, h, cls, title, sub, o = {}) => {
    let s = `<rect class="box ${cls || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 8}"${o.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
    const cx = x + w / 2;
    if (sub) {
      s += `<text class="bh-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle">${esc(title)}</text>`;
      s += `<text class="bh-s" x="${cx}" y="${y + h / 2 + 12}" text-anchor="middle">${esc(sub)}</text>`;
    } else s += `<text class="bh-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 + 4.5}" text-anchor="middle">${esc(title)}</text>`;
    return s;
  };
  const arrow = (x1, y1, x2, y2, cls = "", label = "", o = {}) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const first = String(cls).split(" ")[0];
    const fill = STATES.has(first) ? "fill-" + first : "muted";
    const p = `${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`;
    let s = `<path class="edge ${cls}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${fill}" points="${p}"/>`;
    if (label) {
      const lx = o.lx ?? (x1 + x2) / 2, ly = o.ly ?? (y1 + y2) / 2 - 6;
      s += `<text class="small bh-lbl" x="${lx}" y="${ly}" text-anchor="${o.anchor || "middle"}">${esc(label)}</text>`;
    }
    return s;
  };
  const txt = (x, y, t, cls = "small", anchor = "start") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  /* key/value panel: rows [[key, value, cls]] */
  const kv = (title, rows, o = {}) => `<div class="bh-kv ${o.cls || ""}"><div class="bh-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="bh-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="bh-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  /* stat chips: [[label, value, cls]] */
  const stats = (items) => `<div class="bh-stats">${items.map(([l, v, c]) => `<div class="bh-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  /* in-stage code panel, for visualizers whose code depends on a select input */
  const codePanel = (lines, lang, cur = [], title = "") => `<div class="bh-codebox">${title ? `<div class="bh-kv-h">${esc(title)}</div>` : ""}<ol class="bh-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""}">${hl(l, lang) || "&nbsp;"}</li>`).join("")}</ol></div>`;
  const varsPanel = (vars) => `<div class="bh-vars">${Object.entries(vars || {}).map(([k, v]) => `<span>${esc(k)}</span><span>${esc(Viz.fmt(v))}</span>`).join("")}</div>`;
  const split = (left, right) => `<div class="bh-split"><div class="bh-split-l">${left}</div><div class="bh-split-r">${right}</div></div>`;
  const money = (x) => `$${x.toFixed(2)}`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const words = (s) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);

  /* =====================================================================
   * 1. Strategy: pick an algorithm at runtime (registry) vs a switch
   * ===================================================================== */
  const SHIP = {
    standard: { cls: "StandardShipping", f: "5 + 1.20 × kg", cost: (kg) => 5 + 1.2 * kg },
    express: { cls: "ExpressShipping", f: "12 + 2.50 × kg", cost: (kg) => 12 + 2.5 * kg },
    drone: { cls: "DroneShipping", f: "15 flat, max 2 kg", cost: (kg) => { if (kg > 2) throw new Error("drone max 2 kg"); return 15; } },
    freight: { cls: "FreightShipping", f: "40 + 0.60 × kg", cost: (kg) => 40 + 0.6 * kg },
  };
  const SHIP_KEYS = Object.keys(SHIP);
  const STRAT_CODE = {
    "strategy registry": [
      "interface IShippingStrategy { decimal Cost(Order o); }",
      "class ShippingCalculator(",
      "    IReadOnlyDictionary<string, IShippingStrategy> byKey)",
      "{",
      "    public decimal Cost(Order o) =>",
      "        byKey.TryGetValue(o.Method, out var s)",
      "            ? s.Cost(o)              // polymorphic call",
      "            : throw new UnknownMethod(o.Method);",
      "}",
      "// add 'pickup' = 1 new class + 1 registration",
    ],
    "switch statement": [
      "class OrderService {",
      "  public decimal Cost(Order o) => o.Method switch",
      "  {",
      "      \"standard\" => 5m + 1.2m * o.Kg,",
      "      \"express\"  => 12m + 2.5m * o.Kg,",
      "      \"drone\"    => o.Kg <= 2 ? 15m : throw new TooHeavy(),",
      "      \"freight\"  => 40m + 0.6m * o.Kg,",
      "      _          => throw new UnknownMethod(o.Method),",
      "  };",
      "  // Eta(), Label(), CanShipTo() each repeat this switch",
    ],
  };
  const STRAT_LINE = { "strategy registry": { look: 5, call: 6, miss: 7 }, "switch statement": { look: 1, call: { standard: 3, express: 4, drone: 5, freight: 6 }, miss: 7 } };
  Viz.register("behavioral-patterns-strategy", (el) => Viz.player(el, {
    title: "Strategy: the context picks an algorithm at runtime",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "strategy chosen for this order"], ["done", "priced"], ["bad", "rejected / unknown"], ["path", "change needed to add a method"]],
    inputs: [
      { key: "orders", label: "orders (method:kg, …)", value: "standard:2.5, express:1, drone:0.4, drone:3, freight:120, pickup:1", width: 420 },
      { key: "mode", label: "dispatch", type: "select", options: ["strategy registry", "switch statement"], value: "strategy registry" },
    ],
    random: () => ({ orders: Array.from({ length: Viz.rand(3, 6) }, () => `${pick([...SHIP_KEYS, ...SHIP_KEYS, "pickup"])}:${pick([0.3, 0.8, 1, 1.5, 2.5, 4, 12, 60])}`).join(", ") }),
    build: ({ orders, mode }) => {
      const list = words(orders).map((t) => {
        const m = t.match(/^([a-z]+)\s*:\s*([\d.]+)$/i);
        if (!m) throw new Error(`"${t}": write each order as method:kg, for example express:1.5`);
        const kg = Number(m[2]);
        if (!(kg > 0 && kg <= 1000)) throw new Error(`"${t}": weight must be between 0 and 1000 kg.`);
        return { method: m[1].toLowerCase(), kg };
      });
      if (!list.length || list.length > 7) throw new Error("Use 1 to 7 orders.");
      const L = STRAT_LINE[mode], fr = [], results = [];
      const base = (extra) => ({ mode, list, results: results.map((r) => ({ ...r })), ...extra });
      fr.push(base({ k: -1, line: mode === "switch statement" ? 1 : 1, note: mode === "switch statement"
        ? "One method owns every algorithm. It works, and for two or three stable cases it is the simplest thing. The cost appears when the list keeps growing and the same switch is copied into Eta(), Label() and CanShipTo()."
        : "The calculator (the <b>context</b>) knows only the interface. Each algorithm is its own small class, registered by key. The context never names a concrete class.", vars: { orders: list.length } }));
      list.forEach((o, k) => {
        const s = SHIP[o.method];
        fr.push(base({ k, sel: o.method, phase: "look", line: L.look, vars: { method: o.method, kg: o.kg }, note: mode === "switch statement"
          ? `Order ${k + 1}: the switch compares <code>"${esc(o.method)}"</code> against each case label in turn.`
          : `Order ${k + 1}: look up <code>"${esc(o.method)}"</code> in the registry. This is the only place the key matters; nothing else in the context changes per method.` }));
        if (!s) {
          results.push({ ...o, out: "unknown", cls: "bad" });
          fr.push(base({ k, sel: o.method, phase: "miss", line: L.miss, vars: { method: o.method, result: "throw" }, note: `No algorithm for <code>${esc(o.method)}</code>. Both designs must fail loudly here. The registry has a bonus: you can <b>validate every configured key at startup</b> instead of finding out on the first order.` }));
          return;
        }
        let cost = null, err = null;
        try { cost = s.cost(o.kg); } catch (e) { err = e.message; }
        results.push({ ...o, out: err ? err : money(cost), cls: err ? "bad" : "done" });
        const line = mode === "switch statement" ? L.call[o.method] : L.call;
        fr.push(base({ k, sel: o.method, phase: err ? "bad" : "done", line, vars: { method: o.method, kg: o.kg, cost: err ? "rejected" : money(cost) }, note: err
          ? `${s.cls} refuses: ${esc(err)}. The rule lives <b>inside the strategy</b> that owns it, so it can't leak into the other algorithms.`
          : `${mode === "switch statement" ? `Case "${o.method}"` : `${s.cls}.Cost()`}: ${s.f} with ${o.kg} kg = <b>${money(cost)}</b>.` }));
      });
      fr.push(base({ k: -1, phase: "change", line: mode === "switch statement" ? 9 : 9, vars: { "files to edit": mode === "switch statement" ? 4 : 2 }, note: mode === "switch statement"
        ? "Now product asks for <b>pickup</b>. Every method that switches on <code>Method</code> must change (Cost, Eta, Label, CanShipTo), all in a class that also does other work. Miss one and the default branch throws in production."
        : "Now product asks for <b>pickup</b>. Write <code>PickupShipping</code> and register it. The calculator, its tests and the other strategies are untouched: open for extension, closed for modification." }));
      return fr;
    },
    render: (f) => {
      const W = 600, rows = SHIP_KEYS.length + 1, H = 40 + rows * 54;
      let b = "";
      const ctxLabel = f.mode === "switch statement" ? "OrderService" : "ShippingCalculator";
      const ctxSub = f.mode === "switch statement" ? "Cost(): switch (o.Method)" : "Cost(o) → byKey[o.Method]";
      const cy = 40 + (rows * 54) / 2 - 30;
      b += box(16, cy, 200, 60, f.phase === "change" && f.mode === "switch statement" ? "path" : "accent", ctxLabel, ctxSub);
      const keys = [...SHIP_KEYS, "pickup"];
      keys.forEach((key, i) => {
        const y = 22 + i * 54, s = SHIP[key];
        let cls = "";
        if (f.sel === key) cls = f.phase === "look" ? "active" : f.phase === "done" ? "done" : f.phase === "bad" || f.phase === "miss" ? "bad" : "";
        if (f.phase === "change" && key === "pickup") cls = "path";
        const missing = !s;
        if (missing && f.phase !== "change" && f.sel !== key) { b += box(370, y, 214, 42, "", "pickup?", "not registered", { dash: true }); }
        else b += box(370, y, 214, 42, cls, s ? s.cls : f.phase === "change" ? "PickupShipping (new)" : "pickup?", s ? s.f : f.phase === "change" ? "+1 class, +1 registration" : "no strategy", { dash: missing && f.phase !== "change" });
        if (f.mode === "strategy registry" || f.mode === "switch statement") {
          const on = f.sel === key && f.phase;
          const ec = on ? (f.phase === "look" ? "active" : f.phase === "done" ? "done" : "bad") : (f.phase === "change" && key === "pickup" ? "path" : "dash");
          if (!(missing && f.phase !== "change" && !on)) b += arrow(216, cy + 30, 368, y + 21, ec, on ? (f.mode === "switch statement" ? `case "${key}"` : `byKey["${key}"]`) : "", { lx: 300, ly: (cy + 30 + y + 21) / 2 - 4 });
        }
      });
      if (f.mode === "switch statement") b += txt(16, cy + 84, "all algorithms compiled into one method", "small muted");
      else b += txt(16, cy + 84, "knows only IShippingStrategy", "small muted");
      const res = kv("priced orders", f.results.map((r, i) => [`${i + 1}. ${r.method} ${r.kg} kg`, r.out, i === f.k ? r.cls + " cur" : r.cls]), { empty: "none yet" });
      let change = "";
      if (f.phase === "change") change = kv("to add 'pickup' you edit", f.mode === "switch statement"
        ? [["OrderService.Cost()", "switch", "bad"], ["OrderService.Eta()", "switch", "bad"], ["OrderService.Label()", "switch", "bad"], ["Shipping.CanShipTo()", "switch", "bad"]]
        : [["PickupShipping.cs", "new file", "path"], ["Program.cs", "+1 line", "path"]]);
      return split(svg(W, H, b, "Context and strategies"), `${res}${change}`) + codePanel(STRAT_CODE[f.mode], "csharp", [].concat(f.line ?? []), f.mode === "switch statement" ? "C# · the switch version" : "C# · the strategy version");
    },
  }));

  /* =====================================================================
   * 2. Observer: subscriptions, ghost deliveries and leaks
   * ===================================================================== */
  const OBS_MODES = ["forgot to unsubscribe", "dispose subscription on close", "weak references"];
  Viz.register("behavioral-patterns-observer", (el) => Viz.player(el, {
    title: "Observer: who is still listening, and who is still in memory?",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "alive subscriber"], ["active", "receiving the event"], ["bad", "closed but still subscribed (ghost / leak)"], ["dim", "unreachable, waiting for GC"]],
    codeLang: "csharp",
    code: [
      "class OrderEvents {",
      "  public event Action<OrderEvent>? Changed;",
      "  public void Publish(OrderEvent e)",
      "      => Changed?.Invoke(e);",
      "}",
      "// subscriber",
      "events.Changed += OnChanged; // subject → us",
      "events.Changed -= OnChanged; // way out",
      "using var sub = stream.Subscribe(OnChanged);",
      "// GC frees only what nothing references",
    ],
    inputs: [
      { key: "script", label: "script", value: "sub Email; sub Sms; sub Panel; pub Placed; close Panel; pub Shipped; gc; unsub Sms; pub Paid", width: 520 },
      { key: "mode", label: "subscriber behaviour", type: "select", options: OBS_MODES, value: OBS_MODES[0] },
    ],
    random: () => {
      const names = ["Email", "Sms", "Panel", "Audit", "Toast"], ops = [];
      const live = [];
      for (let i = 0; i < Viz.rand(7, 11); i++) {
        const r = Math.random();
        if (live.length < 2 || r < 0.25) { const n = pick(names.filter((x) => !live.includes(x)) .concat(["Email"])); if (!live.includes(n)) { ops.push(`sub ${n}`); live.push(n); } else ops.push("pub Tick"); }
        else if (r < 0.55) ops.push(`pub ${pick(["Placed", "Paid", "Shipped", "Refunded"])}`);
        else if (r < 0.75) ops.push(`close ${pick(live)}`);
        else if (r < 0.85) ops.push(`unsub ${pick(live)}`);
        else ops.push("gc");
      }
      ops.push("gc"); ops.push("pub Final");
      return { script: ops.join("; "), mode: pick(OBS_MODES) };
    },
    build: ({ script, mode }) => {
      const ops = words(script).map((t) => {
        const m = t.match(/^(sub|unsub|close|pub|gc)\b\s*([A-Za-z][\w]{0,11})?$/i);
        if (!m) throw new Error(`"${t}": use sub X, unsub X, close X, pub Event or gc.`);
        if (m[1].toLowerCase() !== "gc" && !m[2]) throw new Error(`"${t}" needs a name.`);
        return { op: m[1].toLowerCase(), name: m[2] };
      });
      if (ops.length > 16) throw new Error("Use at most 16 steps.");
      const comps = new Map(); // name -> state: alive | closed | collected
      let handlers = []; // names, in subscription order
      let ghosts = 0, delivered = 0;
      const fr = [];
      const snap = (extra) => ({ mode, comps: [...comps.entries()], handlers: [...handlers], ghosts, delivered, ...extra });
      fr.push(snap({ line: [0, 1, 2, 3], note: "The subject keeps a list of callbacks. Each callback is a delegate that points at its subscriber, so <b>the subject's list is a reference that keeps every subscriber alive</b>.", vars: { mode } }));
      for (const { op, name } of ops) {
        if (op === "sub") {
          if (comps.get(name) === "alive" && handlers.includes(name)) { fr.push(snap({ line: 6, cur: name, note: `${name} is already subscribed. Subscribing twice would deliver every event twice: a classic duplicate-handler bug.`, vars: { op: `sub ${name}` } })); continue; }
          comps.set(name, "alive"); handlers.push(name);
          if (comps.size > 6) throw new Error("Use at most 6 distinct subscribers.");
          fr.push(snap({ line: mode === OBS_MODES[1] ? 8 : 6, cur: name, note: `${name} subscribes. ${mode === OBS_MODES[2] ? "The subject stores a <b>weak</b> reference: it can call " + name + " but does not keep it alive." : "The subject now holds a <b>strong</b> reference to " + name + "."}`, vars: { op: `sub ${name}`, subscribers: handlers.length } }));
        } else if (op === "unsub") {
          const had = handlers.includes(name);
          handlers = handlers.filter((h) => h !== name);
          fr.push(snap({ line: mode === OBS_MODES[1] ? 8 : 7, cur: name, note: had ? `${name} unsubscribes explicitly. The subject drops its reference; ${name} is now free to be collected when its owner lets go.` : `${name} was not subscribed; unsubscribing is a harmless no-op.`, vars: { op: `unsub ${name}`, subscribers: handlers.length } }));
        } else if (op === "close") {
          if (!comps.has(name) || comps.get(name) !== "alive") { fr.push(snap({ line: 6, note: `${name} is not open, nothing to close.`, vars: { op: `close ${name}` } })); continue; }
          comps.set(name, "closed");
          if (mode === OBS_MODES[1]) {
            handlers = handlers.filter((h) => h !== name);
            fr.push(snap({ line: 8, cur: name, note: `${name} closes and disposes its subscription (<code>using</code> / <code>Dispose()</code> / <code>AbortController.abort()</code>). The subject forgets it, so nothing references it any more.`, vars: { op: `close ${name}`, subscribers: handlers.length } }));
          } else {
            fr.push(snap({ line: 6, cur: name, note: mode === OBS_MODES[0]
              ? `${name} closes (the window is gone, the request is over) but <b>never unsubscribed</b>. Its owner let go of it, yet the subject still references its handler.`
              : `${name} closes without unsubscribing. Only a weak reference remains, so it <i>can</i> be collected, but it is still callable until the GC actually runs.`, vars: { op: `close ${name}` } }));
          }
        } else if (op === "pub") {
          const recv = [];
          for (const h of [...handlers]) {
            const st = comps.get(h);
            if (st === "collected") { handlers = handlers.filter((x) => x !== h); continue; } // weak entry pruned
            recv.push(h);
            if (st === "alive") delivered++; else ghosts++;
          }
          fr.push(snap({ line: [2, 3], pub: name, recv, note: recv.length
            ? `Publish <b>${esc(name)}</b>: the subject calls ${recv.length} handler${recv.length > 1 ? "s" : ""} in subscription order${recv.some((h) => comps.get(h) !== "alive") ? `. <b>${recv.filter((h) => comps.get(h) !== "alive").join(", ")}</b> is closed but still runs: it updates a disposed view, logs twice, or throws ObjectDisposedException. That is a ghost delivery.` : ". Every receiver is alive."}`
            : `Publish <b>${esc(name)}</b>: nobody is listening. Observers make that legal; the publisher doesn't know or care.`, vars: { op: `pub ${name}`, delivered, ghosts } }));
        } else if (op === "gc") {
          const freed = [], leaked = [];
          for (const [n, st] of comps) {
            if (st !== "closed") continue;
            const strongRef = mode === OBS_MODES[0] && handlers.includes(n);
            if (strongRef) leaked.push(n); else { comps.set(n, "collected"); freed.push(n); }
          }
          if (mode === OBS_MODES[2]) handlers = handlers.filter((h) => comps.get(h) !== "collected");
          fr.push(snap({ line: 9, gc: true, note: `Garbage collection. ${freed.length ? `Freed: ${freed.join(", ")}.` : "Nothing freed."} ${leaked.length ? `<b>Leaked: ${leaked.join(", ")}</b>: closed, but reachable from the subject, so the GC must keep it and everything it references (its view, its cache, its data). Do this once per page view and memory grows forever.` : ""}`, vars: { op: "gc", freed: freed.length, leaked: leaked.length } }));
        }
      }
      const leaks = [...comps.values()].filter((s) => s === "closed").length;
      fr.push(snap({ line: mode === OBS_MODES[1] ? 8 : 7, end: true, note: `Done: ${delivered} real deliveries, <b>${ghosts} ghost deliveries</b>, ${leaks} closed subscriber${leaks === 1 ? "" : "s"} still in memory. ${mode === OBS_MODES[0] ? "Fix: tie every subscription to the subscriber's lifetime (dispose on close)." : mode === OBS_MODES[1] ? "Disposing the subscription with its owner is the reliable fix." : "Weak references stop the leak but not the ghosts: delivery depends on when the GC happens to run."}`, vars: { delivered, ghosts, retained: leaks } }));
      return fr;
    },
    render: (f) => {
      const comps = new Map(f.comps), names = [...comps.keys()];
      const H = Math.max(200, 30 + names.length * 52), W = 600;
      let b = "";
      const sy = H / 2 - 32;
      b += box(20, sy, 170, 64, f.pub ? "accent" : "", "OrderEvents", f.pub ? `Publish(${f.pub})` : `${f.handlers.length} handler${f.handlers.length === 1 ? "" : "s"}`);
      names.forEach((n, i) => {
        const y = 20 + i * 52, st = comps.get(n), subd = f.handlers.includes(n);
        let cls = st === "alive" ? "done" : st === "closed" ? (subd || f.mode === OBS_MODES[0] && f.handlers.includes(n) ? "bad" : "") : "";
        if (f.recv && f.recv.includes(n)) cls = st === "alive" ? "active" : "bad";
        const sub = st === "collected" ? "collected" : st === "closed" ? (subd ? "closed · still subscribed" : "closed · unreachable") : subd ? "alive · subscribed" : "alive · not subscribed";
        const g = `<g class="${st === "collected" || (st === "closed" && !subd) ? "bh-dim" : ""}">${box(380, y, 200, 40, cls, n + "View", sub)}</g>`;
        b += g;
        if (subd) {
          const on = f.recv && f.recv.includes(n);
          const ec = on ? (st === "alive" ? "active" : "bad") : st === "closed" ? "bad" : "";
          b += arrow(190, sy + 32, 378, y + 20, `${ec} ${f.mode === OBS_MODES[2] ? "dash" : ""}`, on ? f.pub : f.mode === OBS_MODES[2] ? "weak" : "", { lx: 300, ly: (sy + 32 + y + 20) / 2 - 3 });
        }
      });
      if (!names.length) b += txt(390, H / 2, "no subscribers yet", "small muted");
      const retained = [...comps.values()].filter((s) => s === "closed").length;
      return Viz.row(svg(W, H, b, "Subject and subscribers"), stats([["real deliveries", f.delivered, "done"], ["ghost deliveries", f.ghosts, f.ghosts ? "bad" : ""], ["closed but in memory", retained, retained ? "bad" : ""]]));
    },
  }));

  /* =====================================================================
   * 3. Command: undo / redo stacks (inverse operations vs mementos)
   * ===================================================================== */
  const CMD_MODES = ["inverse commands", "memento snapshots"];
  Viz.register("behavioral-patterns-command", (el) => Viz.player(el, {
    title: "Command: undo and redo are two stacks of objects",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "command just moved"], ["done", "can be undone"], ["visit", "can be redone"], ["bad", "redo history discarded"]],
    codeLang: "python",
    code: [
      "def execute(cmd):",
      "    cmd.do(doc)",
      "    undo_stack.append(cmd)",
      "    redo_stack.clear()  # new edit: fork",
      "def undo():",
      "    cmd = undo_stack.pop()",
      "    cmd.undo(doc)",
      "    redo_stack.append(cmd)",
      "def redo():",
      "    cmd = redo_stack.pop()",
      "    cmd.do(doc)",
      "    undo_stack.append(cmd)",
    ],
    inputs: [
      { key: "script", label: "script (_ = space)", value: "type Hello; type _world; undo; undo; redo; type !; upper; undo; redo", width: 470 },
      { key: "mode", label: "undo by", type: "select", options: CMD_MODES, value: CMD_MODES[0] },
    ],
    random: () => {
      const ops = [];
      for (let i = 0; i < Viz.rand(6, 10); i++) ops.push(pick(["type " + pick(["Hi", "_there", "abc", "_ok", "!"]), "undo", "undo", "redo", "del 2", "upper"]));
      return { script: ops.join("; "), mode: pick(CMD_MODES) };
    },
    build: ({ script, mode }) => {
      const ops = words(script).map((t) => {
        const m = t.match(/^(type)\s+(\S{1,12})$|^(del)\s+(\d{1,2})$|^(upper|undo|redo)$/i);
        if (!m) throw new Error(`"${t}": use type TEXT, del N, upper, undo or redo.`);
        if (m[1]) return { op: "type", text: m[2].replace(/_/g, " ") };
        if (m[3]) return { op: "del", n: Number(m[4]) };
        return { op: m[5].toLowerCase() };
      });
      if (ops.length > 14) throw new Error("Use at most 14 steps.");
      const memento = mode === CMD_MODES[1];
      let doc = "", undo = [], redo = [], dropped = [];
      const label = (c) => c.op === "type" ? `Insert "${c.text}"` : c.op === "del" ? `Delete ${c.n}${c.removed !== undefined ? ` ("${c.removed}")` : ""}` : "Uppercase";
      const stored = (c) => memento ? c.before.length : c.op === "type" ? c.text.length : c.op === "del" ? (c.removed || "").length : c.before.length;
      const memory = () => [...undo, ...redo].reduce((s, c) => s + stored(c), 0);
      const doCmd = (c) => {
        if (memento || c.op === "upper") c.before = doc;
        if (c.op === "type") { c.pos = doc.length; doc += c.text; }
        else if (c.op === "del") { const k = Math.min(c.n, doc.length); c.removed = doc.slice(doc.length - k); doc = doc.slice(0, doc.length - k); }
        else doc = doc.toUpperCase();
        if (doc.length > 40) throw new Error("The document grew past 40 characters; use a shorter script.");
      };
      const undoCmd = (c) => {
        if (memento || c.op === "upper") { doc = c.before; return; }
        if (c.op === "type") doc = doc.slice(0, c.pos);
        else doc += c.removed;
      };
      const fr = [];
      const snap = (extra) => ({ doc, undo: undo.map(label).reverse(), redo: redo.map(label).reverse(), dropped: [...dropped], mem: memory(), mode, ...extra });
      fr.push(snap({ line: 0, note: `Each edit is an <b>object</b> with do() and undo(). The invoker only knows that interface, so it can stack, replay, log or queue edits without knowing what they do. Undo here uses <b>${memento ? "mementos: a snapshot of the whole document before each command" : "inverse operations: each command stores just enough to reverse itself"}</b>.`, vars: { doc: '""' } }));
      for (const o of ops) {
        dropped = [];
        if (o.op === "undo" || o.op === "redo") {
          const from = o.op === "undo" ? undo : redo;
          if (!from.length) { fr.push(snap({ line: o.op === "undo" ? 5 : 9, warn: true, note: `${o.op}: the stack is empty, so the button is disabled. Nothing happens.`, vars: { op: o.op } })); continue; }
          const c = from.pop();
          if (o.op === "undo") { undoCmd(c); redo.push(c); } else { doCmd(c); undo.push(c); }
          fr.push(snap({ line: o.op === "undo" ? [5, 6, 7] : [9, 10, 11], moved: o.op, note: o.op === "undo"
            ? `Undo pops <b>${esc(label(c))}</b>, reverses it ${memento || c.op === "upper" ? "by restoring the saved snapshot" : c.op === "type" ? `by cutting back to position ${c.pos}` : `by re-appending "${esc(c.removed)}"`}, and keeps it on the redo stack.`
            : `Redo pops <b>${esc(label(c))}</b> and runs do() again. The same object, the same parameters.`, vars: { op: o.op, doc: JSON.stringify(doc), "stored chars": memory() } }));
        } else {
          const c = { ...o };
          doCmd(c); undo.push(c);
          const lost = redo.map(label); dropped = lost; redo = [];
          fr.push(snap({ line: [0, 1, 2, 3], moved: "exec", note: `Execute <b>${esc(label(c))}</b>.${memento ? ` Snapshot saved: ${c.before.length} chars.` : c.op === "upper" ? " Uppercase can't be reversed (was it 'Hi' or 'hI'?), so even in inverse mode this command keeps the old text: a small memento." : ""}${lost.length ? ` A new edit after undo <b>discards the redo history</b> (${lost.length} command${lost.length > 1 ? "s" : ""}). That's what every editor does; a history <i>tree</i> is the alternative.` : ""}`, vars: { op: o.op, doc: JSON.stringify(doc), "stored chars": memory() } }));
        }
      }
      fr.push(snap({ line: [], note: `Final document: <b>"${esc(doc)}"</b>. Undo history costs <b>${memory()} stored characters</b> with ${memento ? "snapshots. Snapshots are simple and always correct, but cost grows with document size × history length" : "inverse commands. They store only the delta, but every command must be exactly reversible"}. Switch the mode and run again to compare.`, vars: { doc: JSON.stringify(doc), "stored chars": memory() } }));
      return fr;
    },
    render: (f) => Viz.row(
      Viz.labeled("document", `<div class="bh-doc">${esc(f.doc) || '<span class="bh-muted">(empty)</span>'}<span class="bh-caret"></span></div>`),
      Viz.stack(f.undo, { label: "undo stack", cls: (i) => (i === 0 && (f.moved === "exec" || f.moved === "redo") ? "active" : "done") }),
      Viz.stack(f.redo, { label: "redo stack", cls: (i) => (i === 0 && f.moved === "undo" ? "active" : "visit") }),
      f.dropped.length ? Viz.stack(f.dropped, { label: "discarded", cls: () => "bad" }) : "",
      stats([["chars kept for undo", f.mem, f.mode === CMD_MODES[1] ? "active" : "done"]]),
    ),
  }));

  /* =====================================================================
   * 4. State: an order lifecycle as an explicit state machine
   * ===================================================================== */
  const SM = {
    Draft: { submit: "Submitted", cancel: "Cancelled" },
    Submitted: { pay: "Paid", cancel: "Cancelled" },
    Paid: { ship: "Shipped", cancel: "Refunded" },
    Shipped: { deliver: "Delivered" },
    Delivered: { return: "Refunded" },
    Cancelled: {}, Refunded: {},
  };
  const SM_POS = { Draft: [10, 30], Submitted: [220, 30], Paid: [430, 30], Shipped: [640, 30], Delivered: [640, 170], Cancelled: [115, 170], Refunded: [430, 170] };
  const SM_EVENTS = ["submit", "pay", "ship", "deliver", "cancel", "return"];
  const SM_CODE = {
    "state objects": [
      "abstract class OrderState {",
      "  public virtual OrderState Submit(Order o) => Illegal();",
      "  public virtual OrderState Pay(Order o)    => Illegal();",
      "  public virtual OrderState Ship(Order o)   => Illegal();",
      "  public virtual OrderState Cancel(Order o) => Illegal();",
      "}",
      "sealed class Paid : OrderState {",
      "  public override OrderState Ship(Order o)   { o.BookCourier(); return new Shipped(); }",
      "  public override OrderState Cancel(Order o) { o.Refund();      return new Refunded(); }",
      "}",
      "order.State = order.State.Ship(order);   // context delegates",
    ],
    "transition table": [
      "static readonly Dictionary<(Status, Trigger), Status> Next = new()",
      "{",
      "  [(Draft, Submit)] = Submitted,  [(Draft, Cancel)] = Cancelled,",
      "  [(Submitted, Pay)] = Paid,      [(Submitted, Cancel)] = Cancelled,",
      "  [(Paid, Ship)] = Shipped,       [(Paid, Cancel)] = Refunded,",
      "  [(Shipped, Deliver)] = Delivered,",
      "  [(Delivered, Return)] = Refunded,",
      "};",
      "public void Fire(Trigger t) => Status = Next.TryGetValue((Status, t), out var s)",
      "    ? s : throw new InvalidTransition(Status, t);",
      "// side effects: OnEnter(Shipped) => BookCourier() ...",
    ],
  };
  Viz.register("behavioral-patterns-state", (el) => Viz.player(el, {
    title: "State: the current state decides which events are legal",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "current state"], ["path", "transition just taken"], ["done", "visited"], ["bad", "illegal event, rejected"]],
    inputs: [
      { key: "events", label: "events", value: "submit, ship, pay, ship, cancel, deliver, return", width: 400 },
      { key: "mode", label: "implemented as", type: "select", options: Object.keys(SM_CODE), value: "state objects" },
    ],
    random: () => ({ events: Array.from({ length: Viz.rand(4, 8) }, () => pick(SM_EVENTS)).join(", ") }),
    build: ({ events, mode }) => {
      const evs = words(events).map((e) => e.toLowerCase());
      if (!evs.length || evs.length > 12) throw new Error("Use 1 to 12 events.");
      for (const e of evs) if (!SM_EVENTS.includes(e)) throw new Error(`"${e}" is not an event. Use: ${SM_EVENTS.join(", ")}.`);
      let cur = "Draft"; const visited = new Set([cur]), log = [];
      const tbl = mode === "transition table";
      const fr = [{ cur, visited: [...visited], log: [], mode, line: tbl ? [0, 7] : [0, 5], note: "Every order starts in <b>Draft</b>. The arrows are the only legal moves; anything else is a bug that the model should refuse, not silently accept.", vars: { state: cur } }];
      for (const e of evs) {
        const to = SM[cur][e];
        if (!to) {
          log.push([`${cur} + ${e}`, "rejected", "bad"]);
          fr.push({ cur, visited: [...visited], log: log.map((x) => [...x]), mode, bad: e, line: tbl ? [8, 9] : [1, 2, 3, 4].filter((k) => SM_CODE[mode][k].toLowerCase().includes(e)).concat(e === "deliver" || e === "return" ? [0] : []), note: `<b>${esc(e)}</b> is illegal in <b>${cur}</b>${Object.keys(SM[cur]).length ? ` (legal: ${Object.keys(SM[cur]).join(", ")})` : " (a final state: nothing is legal)"}. ${tbl ? "The lookup misses and throws InvalidTransition." : "The base class's default implementation throws, because this state did not override it."} With a scattered enum, this check is a <code>if (status == …)</code> someone has to remember in every method.`, vars: { state: cur, event: e, result: "rejected" } });
          continue;
        }
        const from = cur; cur = to; visited.add(cur);
        log.push([`${from} + ${e}`, to, "done"]);
        fr.push({ cur, from, ev: e, visited: [...visited], log: log.map((x) => [...x]), mode, line: tbl ? [2 + ["Draft", "Submitted", "Paid", "Shipped", "Delivered"].indexOf(from), 8] : from === "Paid" ? [6, e === "ship" ? 7 : 8, 10] : [10], note: `<b>${from}</b> --${esc(e)}--> <b>${to}</b>.${from === "Paid" && e === "cancel" ? " Cancelling after payment is a different transition (refund) from cancelling before it: the state owns that difference." : ""}${!Object.keys(SM[to]).length ? ` ${to} is a final state.` : ""}`, vars: { state: cur, event: e } });
      }
      fr.push({ cur, visited: [...visited], log, mode, line: [], end: true, note: `Ended in <b>${cur}</b>. ${log.filter((x) => x[2] === "bad").length} illegal event(s) were refused. The diagram, the table and the code say the same thing, so the diagram can be generated from the code (or the code from a table) and stay true.`, vars: { state: cur } });
      return fr;
    },
    render: (f) => {
      const W = 780, H = 230, BW = 130, BH = 40;
      const c = (s) => [SM_POS[s][0] + BW / 2, SM_POS[s][1] + BH / 2];
      let b = "";
      const drawn = new Set();
      for (const [s, tr] of Object.entries(SM)) for (const [e, t] of Object.entries(tr)) {
        const [x1, y1] = c(s), [x2, y2] = c(t);
        const key = s + t; if (drawn.has(key)) continue; drawn.add(key);
        // edge from box border to box border
        const clip = (x, y, tx, ty) => { const dx = tx - x, dy = ty - y; const k = Math.min(Math.abs((BW / 2 + 2) / (dx || 1e-9)), Math.abs((BH / 2 + 2) / (dy || 1e-9))); return [x + dx * k, y + dy * k]; };
        const [ax, ay] = clip(x1, y1, x2, y2), [bx, by] = clip(x2, y2, x1, y1);
        const on = f.from === s && f.cur === t;
        const evs = Object.entries(tr).filter(([, v]) => v === t).map(([k]) => k).join("/");
        b += arrow(ax, ay, bx, by, on ? "path" : "", evs, { lx: (ax + bx) / 2 + (Math.abs(ay - by) > 20 ? 6 : 0), ly: (ay + by) / 2 - 6, anchor: Math.abs(ay - by) > 20 ? "start" : "middle" });
      }
      for (const s of Object.keys(SM)) {
        const [x, y] = SM_POS[s];
        let cls = f.cur === s ? (f.bad ? "bad" : "active") : f.visited.includes(s) ? "done" : "";
        const legal = Object.keys(SM[s]);
        b += box(x, y, BW, BH, cls, s, f.cur === s ? (legal.length ? `legal: ${legal.join(", ")}` : "final") : legal.length ? "" : "final");
      }
      if (f.bad) b += txt(SM_POS[f.cur][0] + BW / 2, SM_POS[f.cur][1] - 6, `✗ ${f.bad}`, "small bh-bad", "middle");
      return Viz.row(svg(W, H, b, "Order state machine"), kv("history", f.log.slice(-8), { empty: "no events yet" })) + codePanel(SM_CODE[f.mode], "csharp", f.line, `C# · ${f.mode}`);
    },
  }));

  /* =====================================================================
   * 5. Template method vs strategy: who calls whom?
   * ===================================================================== */
  const TPL_ROWS = [["Ada", 36], ["Linus", 54], ["Grace", 85]];
  const FMT = {
    csv: { open: () => "", header: () => "name,age", row: (r) => `${r[0]},${r[1]}`, sep: () => "", close: () => "" },
    json: { open: () => "[", header: () => "", row: (r) => `  {"name":"${r[0]}","age":${r[1]}}`, sep: () => ",", close: () => "]" },
    markdown: { open: () => "", header: () => "| name | age |\n|---|---|", row: (r) => `| ${r[0]} | ${r[1]} |`, sep: () => "", close: () => "" },
  };
  Viz.register("behavioral-patterns-template", (el) => Viz.player(el, {
    title: "Template method vs strategy: the same exporter, inheritance vs composition",
    tag: "SEQUENCE · STEP THROUGH",
    legend: [["accent", "fixed algorithm (skeleton)"], ["active", "the varying step"], ["done", "output written"]],
    inputs: [
      { key: "format", label: "format", type: "select", options: Object.keys(FMT), value: "json" },
      { key: "style", label: "variation by", type: "select", options: ["template method (inheritance)", "strategy (composition)"], value: "template method (inheritance)" },
      { key: "rows", label: "rows", type: "select", options: ["1", "2", "3"], value: "2" },
    ],
    build: ({ format, style, rows }) => {
      const tm = style.startsWith("template");
      const F = FMT[format], n = Number(rows), out = [], fr = [];
      const A = tm ? `Exporter (base)` : "Exporter", B = tm ? `${format.toUpperCase()}Exporter : Exporter` : `I${"RowFormat"} = ${format.toUpperCase()}Format`;
      const msgs = [];
      const step = (from, to, label, note, lineCls = "active") => { msgs.push({ from, to, label, cls: lineCls }); fr.push({ tm, format, A, B, msgs: msgs.map((m) => ({ ...m })), out: [...out], cur: msgs.length - 1, note, vars: { call: label, lines: out.length } }); };
      const write = (s) => { if (s !== "") out.push(...s.split("\n")); };
      fr.push({ tm, format, A, B, msgs: [], out: [], cur: -1, note: tm
        ? "<b>Template method</b>: the base class owns <code>Export()</code>, a non-virtual method that fixes the order of steps. Subclasses override only the hooks. Control flows <b>down</b> the inheritance chain: the base calls the subclass (the Hollywood principle: don't call us, we'll call you)."
        : "<b>Strategy</b>: the exporter owns the same fixed loop, but receives the varying steps as an object (or just functions). The format is chosen at runtime and can be swapped, combined or unit-tested on its own.", vars: { format } });
      step(0, 0, "Export(rows)", "Client calls the one public method. The skeleton is identical for every format.", "accent");
      write(F.open()); step(0, 1, tm ? "this.Open()" : "fmt.Open()", `${tm ? "Hook" : "Strategy call"}: Open() returns ${JSON.stringify(F.open())}.`);
      write(F.header()); step(0, 1, tm ? "this.WriteHeader()" : "fmt.Header()", F.header() ? `Header: <code>${esc(F.header().split("\n")[0])}</code>` : `This format has no header; the ${tm ? "base hook's default does nothing" : "strategy returns an empty string"}.`);
      for (let i = 0; i < n; i++) {
        write(F.row(TPL_ROWS[i]) + (i < n - 1 ? F.sep() : ""));
        step(0, 1, tm ? `this.WriteRow(r${i})` : `fmt.Row(r${i})`, `Row ${i + 1}: the loop, the escaping policy and the error handling live once in the skeleton; only the line shape varies.`);
      }
      write(F.close()); step(0, 1, tm ? "this.Close()" : "fmt.Close()", `Close: ${JSON.stringify(F.close())}.`);
      step(0, 0, "return text", tm
        ? "Template method is fine when the skeleton is stable and there's one axis of variation. It breaks down when you need two axes (format × compression) or want to choose at runtime: inheritance gives you a class per combination."
        : "Strategy composes: <code>new Exporter(new JsonFormat(), new GzipSink())</code>. In languages with first-class functions the strategy is often just a lambda or a record of functions.", "done");
      return fr;
    },
    render: (f) => {
      const W = 520, colX = [110, 400], top = 52, gap = 34, H = top + Math.max(1, f.msgs.length) * gap + 30;
      let b = "";
      [f.A, f.B].forEach((n, i) => { b += box(colX[i] - 105, 8, 210, 34, i === 0 ? "accent" : "active", n); b += `<line class="edge dash" x1="${colX[i]}" y1="42" x2="${colX[i]}" y2="${H - 8}"/>`; });
      f.msgs.forEach((m, i) => {
        const y = top + i * gap + 10, c = i === f.cur ? m.cls : "";
        if (m.from === m.to) { b += `<rect class="${i === f.cur ? "fill-" + (m.cls === "accent" ? "accent" : "done") : "muted"}" x="${colX[0] - 4}" y="${y - 10}" width="8" height="20" rx="2"/>`; b += txt(colX[0] + 12, y + 4, m.label, `small mono ${i === f.cur ? "" : "muted"}`); }
        else { b += arrow(colX[m.from] + 4, y, colX[m.to] - 4, y, c || "", m.label, { ly: y - 6 }); }
      });
      const outHtml = `<pre class="bh-out">${f.out.length ? f.out.map(esc).join("\n") : '<span class="bh-muted">(nothing yet)</span>'}</pre>`;
      return Viz.row(svg(W, H, b, "Sequence diagram"), Viz.labeled(`output · ${f.format}`, outHtml));
    },
  }));

  /* =====================================================================
   * 6. Chain of responsibility: approval limits (brief, see request-pipeline)
   * ===================================================================== */
  Viz.register("behavioral-patterns-chain", (el) => Viz.player(el, {
    title: "Chain of responsibility: pass the request along until someone handles it",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "considering"], ["visit", "passed it on"], ["done", "handled"], ["bad", "fell off the end"]],
    codeLang: "csharp",
    code: [
      "abstract class Approver(Approver? next) {",
      "  public Decision Handle(Expense e) =>",
      "      CanApprove(e) ? Approve(e)",
      "    : next is not null ? next.Handle(e)",
      "    : Decision.Unhandled(e);  // the end",
      "  protected abstract bool CanApprove(Expense e);",
      "}",
    ],
    inputs: [
      { key: "chain", label: "chain (role:limit)", value: "TeamLead:1000, Manager:10000, Director:50000, CFO:250000", width: 420 },
      { key: "amount", label: "expense $", value: "18500", width: 100 },
    ],
    random: () => ({ amount: String(pick([300, 999, 1000, 4200, 18500, 75000, 260000])) }),
    build: ({ chain, amount }) => {
      const hs = words(chain).map((t) => { const m = t.match(/^([A-Za-z]\w{0,11})\s*:\s*(\d{1,9})$/); if (!m) throw new Error(`"${t}": use Role:limit.`); return { n: m[1], lim: Number(m[2]) }; });
      if (!hs.length || hs.length > 6) throw new Error("Use 1 to 6 handlers.");
      const amt = Number(amount);
      if (!Number.isFinite(amt) || amt < 0 || amt > 1e9) throw new Error("Amount must be a number from 0 to 1,000,000,000.");
      const fr = [];
      const unordered = hs.some((h, i) => i && h.lim < hs[i - 1].lim);
      fr.push({ hs, k: -1, line: 1, note: `An expense of <b>$${amt.toLocaleString("en-US")}</b> enters at the head. The sender knows only the first handler; each handler knows only its successor.${unordered ? " <b>Note: this chain is not sorted by limit</b>, so a broad handler early on will shadow a narrower one later." : ""}`, vars: { amount: amt } });
      let handled = -1;
      for (let i = 0; i < hs.length; i++) {
        const ok = amt <= hs[i].lim;
        fr.push({ hs, k: i, st: "active", line: [2, 5], note: `${hs[i].n}: can I approve $${amt.toLocaleString("en-US")}? My limit is $${hs[i].lim.toLocaleString("en-US")}.`, vars: { amount: amt, handler: hs[i].n, limit: hs[i].lim } });
        if (ok) { handled = i; fr.push({ hs, k: i, st: "done", line: 2, note: `<b>${hs[i].n} approves.</b> The chain stops here; later handlers never see the request.`, vars: { amount: amt, handler: hs[i].n, result: "approved" } }); break; }
        fr.push({ hs, k: i, st: "pass", line: 3, note: i < hs.length - 1 ? `Over the limit: pass to ${hs[i + 1].n}.` : "Over the limit, and there is no next handler.", vars: { amount: amt, handler: hs[i].n, result: "pass" } });
      }
      if (handled < 0) fr.push({ hs, k: hs.length, st: "bad", line: 4, note: "<b>Nobody handled it.</b> This is the classic CoR failure: an unhandled request that silently disappears. Always end the chain with an explicit terminal (reject, 404, dead-letter) so 'no one claimed it' is visible.", vars: { amount: amt, result: "unhandled" } });
      fr.push({ hs, k: handled < 0 ? hs.length : handled, st: handled < 0 ? "bad" : "done", end: true, line: [], note: "ASP.NET Core middleware, servlet filters, Express/Koa, Go http.Handler wrappers, MediatR behaviours and HttpClient DelegatingHandlers are all this pattern with a twist: each link can also run code <i>after</i> the next one returns. See <a href=\"request-pipeline.html\">Request pipeline</a> and <a href=\"middleware-patterns.html\">Middleware patterns</a> for that version.", vars: { amount: amt, result: handled < 0 ? "unhandled" : hs[handled].n } });
      return fr;
    },
    render: (f) => {
      const n = f.hs.length, bw = 190, bh = 44, gap = 26, x = 90, W = 420, H = 64 + (n + 1) * (bh + gap);
      let b = box(x + 25, 6, bw - 50, 36, "accent", "expense");
      f.hs.forEach((h, i) => {
        const y = 64 + i * (bh + gap);
        const cls = i === f.k ? (f.st === "done" ? "done" : f.st === "pass" ? "visit" : "active") : i < f.k ? "visit" : "";
        b += arrow(x + bw / 2, i ? y - gap + 2 : 44, x + bw / 2, y - 2, i <= f.k ? (i === f.k && f.st === "active" ? "active" : "done") : "", i ? "next" : "", { lx: x + bw / 2 + 8, ly: y - gap / 2 + 4, anchor: "start" });
        b += box(x, y, bw, bh, cls, h.n, `approves ≤ $${h.lim.toLocaleString("en-US")}`);
        if (i === f.k) b += txt(x + bw + 14, y + bh / 2 + 4, f.st === "done" ? "✓ handled" : f.st === "pass" ? "over limit → pass" : "can I?", f.st === "done" ? "small" : "small muted", "start");
      });
      const ey = 64 + n * (bh + gap);
      b += arrow(x + bw / 2, ey - gap + 2, x + bw / 2, ey - 2, f.k >= n ? "bad" : "dash");
      b += box(x + 25, ey, bw - 50, 36, f.k >= n ? "bad" : "", "unhandled", "", { dash: f.k < n });
      return svg(W, H, b, "Approval chain");
    },
  }));

  /* =====================================================================
   * 7. Mediator: mesh of n components vs a hub
   * ===================================================================== */
  const MED_NAMES = ["Search", "Filters", "Results", "Map", "Cart", "Badge", "Toast", "Auth", "Prefs", "Audit"];
  Viz.register("behavioral-patterns-mediator", (el) => Viz.player(el, {
    title: "Mediator: n² direct references vs one hub",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "component that changed"], ["bad", "components you must edit/retest"], ["accent", "mediator"], ["path", "messages routed"]],
    inputs: [
      { key: "n", label: "components", type: "select", options: ["3", "4", "5", "6", "7", "8", "10"], value: "6" },
      { key: "mode", label: "wiring", type: "select", options: ["direct references (mesh)", "mediator (hub)"], value: "direct references (mesh)" },
    ],
    build: ({ n, mode }) => {
      const N = Number(n), hub = mode.startsWith("mediator"), names = MED_NAMES.slice(0, N);
      const links = hub ? N : (N * (N - 1)) / 2;
      const fr = [];
      fr.push({ N, hub, names, phase: "wire", note: hub
        ? `${N} components, each holding a single reference: the mediator. <b>${N} links</b>. Components no longer know each other; they announce what happened and the mediator decides who reacts.`
        : `${N} UI components that talk to each other directly. In the worst case every pair is connected: <b>n(n−1)/2 = ${links} links</b>. Each component imports and calls several others.`, vars: { components: N, links } });
      fr.push({ N, hub, names, phase: "change", changed: 0, note: hub
        ? `Change <b>${names[0]}</b>'s API. Only the mediator calls it, so <b>1 other file</b> changes. The interaction rules are in one place you can read top to bottom.`
        : `Change <b>${names[0]}</b>'s API. Everything that calls it must change and be retested: <b>${N - 1} other components</b>. That ripple is the coupling cost.`, vars: { "files touched": hub ? 2 : N } });
      fr.push({ N, hub, names, phase: "event", changed: 0, note: hub
        ? `${names[0]} raises "query changed". The mediator routes it: ${names.slice(1, Math.min(N, 4)).join(", ")} update. The routing is <i>explicit</i> code, which is the point and also the risk.`
        : `${names[0]} changes and calls ${N - 1} components itself. Add a component and you edit the senders, not just the newcomer.`, vars: { messages: N - 1 } });
      if (hub) fr.push({ N, hub, names, phase: "god", note: `The trap: every new rule goes into the mediator. After a year it has ${N * 6}+ handlers, knows every component's internals and is the <a href="anti-patterns.html#god-object">god object</a> you were trying to avoid. Keep mediators small and per-feature (one per screen or per workflow), or replace them with events where nobody needs a central decision.`, vars: { "mediator size": `${N * 6}+ rules` } });
      return fr;
    },
    render: (f) => {
      const R = 120, cx = 170, cy = 150, W = 340, H = 300;
      const pts = Viz.layout.circle(f.names, R, cx, cy);
      let b = "";
      const mark = (i) => f.phase === "change" && (f.hub ? false : i !== f.changed);
      if (f.hub) {
        pts.forEach((p, i) => { const ec = f.phase === "event" && i > 0 && i < 4 ? "path" : f.phase === "event" && i === 0 ? "active" : f.phase === "change" && i === 0 ? "bad" : ""; b += `<line class="edge ${ec}" x1="${cx}" y1="${cy}" x2="${p.x}" y2="${p.y}"/>`; });
        b += box(cx - 46, cy - 20, 92, 40, f.phase === "god" ? "bad" : "accent", f.phase === "god" ? "GodMediator" : "Mediator", "", {});
      } else {
        for (let i = 0; i < pts.length; i++) for (let j = i + 1; j < pts.length; j++) {
          const on = (i === f.changed || j === f.changed) && f.phase !== "wire";
          b += `<line class="edge ${on ? (f.phase === "event" ? "path" : "bad") : ""}" x1="${pts[i].x}" y1="${pts[i].y}" x2="${pts[j].x}" y2="${pts[j].y}"/>`;
        }
      }
      pts.forEach((p, i) => {
        let cls = i === f.changed && f.phase !== "wire" ? "active" : mark(i) ? "bad" : f.phase === "event" && f.hub && i > 0 && i < 4 ? "path" : "";
        b += box(p.x - 34, p.y - 14, 68, 28, cls, p.id, "", { rx: 6 });
      });
      const links = f.hub ? f.N : (f.N * (f.N - 1)) / 2;
      const curve = [3, 4, 5, 6, 7, 8, 10].map((n) => [n, (n * (n - 1)) / 2, n]);
      const tbl = `<table class="bh-tbl"><tr><th>n</th><th>mesh links</th><th>hub links</th></tr>${curve.map(([n, m, h]) => `<tr class="${n === f.N ? "cur" : ""}"><td>${n}</td><td>${m}</td><td>${h}</td></tr>`).join("")}</table>`;
      return Viz.row(svg(W, H, b, "Components"), `<div>${stats([["links", links, f.hub ? "done" : "bad"], ["files touched by one change", f.hub ? 2 : f.N, f.hub ? "done" : "bad"]])}${tbl}</div>`);
    },
  }));

  /* =====================================================================
   * 8. Iterator / generators: lazy pull pipeline vs eager collections
   * ===================================================================== */
  const IT_LAZY = {
    "C# (IEnumerable + yield)": { lang: "csharp", lines: [
      "static IEnumerable<int> Naturals() {",
      "    for (var i = 1; ; i++) yield return i;   // infinite, lazy",
      "}",
      "var q = Naturals()",
      "    .Where(x => x % 2 == 1)",
      "    .Select(x => x * x)",
      "    .Take(N);                     // nothing has run yet",
      "foreach (var v in q) Console.WriteLine(v);  // MoveNext() pulls",
    ], at: { source: 1, filter: 4, map: 5, take: 6, consume: 7 } },
    "Java (Stream)": { lang: "java", lines: [
      "Stream.iterate(1, i -> i + 1)       // infinite, lazy",
      "      .filter(x -> x % 2 == 1)",
      "      .map(x -> x * x)",
      "      .limit(N)                     // short-circuits",
      "      .forEach(System.out::println);  // terminal op starts the pull",
    ], at: { source: 0, filter: 1, map: 2, take: 3, consume: 4 } },
    "Python (generators)": { lang: "python", lines: [
      "def naturals():",
      "    i = 1",
      "    while True:",
      "        yield i          # pauses here until next() is called",
      "        i += 1",
      "q = (x * x for x in naturals() if x % 2 == 1)",
      "for v in itertools.islice(q, N):",
      "    print(v)",
    ], at: { source: 3, filter: 5, map: 5, take: 6, consume: 7 } },
    "Go (iter.Seq, push)": { lang: "go", lines: [
      "func Naturals() iter.Seq[int] {",
      "    return func(yield func(int) bool) {",
      "        for i := 1; ; i++ {",
      "            if !yield(i) { return }   // consumer said stop",
      "        }",
      "    }",
      "}",
      "n := 0",
      "for v := range Naturals() {          // the loop body IS yield",
      "    if v%2 == 0 { continue }",
      "    fmt.Println(v * v)",
      "    if n++; n == N { break }         // yield returns false",
      "}",
    ], at: { source: 3, filter: 9, map: 10, take: 11, consume: 10 } },
    "TypeScript (generators)": { lang: "typescript", lines: [
      "function* naturals() { for (let i = 1; ; i++) yield i; }",
      "function* filter<T>(s: Iterable<T>, p: (x: T) => boolean) { for (const x of s) if (p(x)) yield x; }",
      "function* map<T, U>(s: Iterable<T>, f: (x: T) => U) { for (const x of s) yield f(x); }",
      "function* take<T>(s: Iterable<T>, n: number) {",
      "  if (n <= 0) return;",
      "  for (const x of s) { yield x; if (--n === 0) return; }",
      "}",
      "for (const v of take(map(filter(naturals(), x => x % 2 === 1), x => x * x), N))",
      "  console.log(v);",
    ], at: { source: 0, filter: 1, map: 2, take: 5, consume: 8 } },
  };
  const IT_EAGER = {
    "C# (IEnumerable + yield)": ["csharp", ["var all   = Enumerable.Range(1, 12).ToList();   // must be finite", "var odd   = all.Where(x => x % 2 == 1).ToList(); // new list", "var sq    = odd.Select(x => x * x).ToList();     // new list", "var first = sq.Take(N).ToList();"]],
    "Java (Stream)": ["java", ["List<Integer> all = IntStream.rangeClosed(1, 12).boxed().toList();", "List<Integer> odd = all.stream().filter(x -> x % 2 == 1).toList();", "List<Integer> sq  = odd.stream().map(x -> x * x).toList();", "List<Integer> first = sq.subList(0, N);"]],
    "Python (generators)": ["python", ["all_ = list(range(1, 13))            # must be finite", "odd = [x for x in all_ if x % 2 == 1]  # new list", "sq = [x * x for x in odd]              # new list", "first = sq[:N]"]],
    "Go (iter.Seq, push)": ["go", ["all := make([]int, 12); for i := range all { all[i] = i + 1 }", "odd := []int{}; for _, x := range all { if x%2 == 1 { odd = append(odd, x) } }", "sq := []int{}; for _, x := range odd { sq = append(sq, x*x) }", "first := sq[:min(N, len(sq))]"]],
    "TypeScript (generators)": ["typescript", ["const all = Array.from({ length: 12 }, (_, i) => i + 1);", "const odd = all.filter(x => x % 2 === 1);   // new array", "const sq = odd.map(x => x * x);              // new array", "const first = sq.slice(0, N);"]],
  };
  const IT_STAGES = ["source", "filter", "map", "take", "consume"];
  Viz.register("behavioral-patterns-iterator", (el) => Viz.player(el, {
    title: "Iterator: values are pulled one at a time, on demand",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "stage running now"], ["done", "value emitted"], ["bad", "value rejected"], ["visit", "intermediate collection"]],
    inputs: [
      { key: "lang", label: "language", type: "select", options: Object.keys(IT_LAZY), value: "C# (IEnumerable + yield)" },
      { key: "mode", label: "evaluation", type: "select", options: ["lazy (streaming)", "eager (collections)"], value: "lazy (streaming)" },
      { key: "n", label: "take N", type: "select", options: ["1", "2", "3", "4", "5"], value: "3" },
    ],
    build: ({ lang, mode, n }) => {
      const N = Number(n), lazy = mode.startsWith("lazy"), fr = [];
      const calls = { source: 0, filter: 0, map: 0, take: 0 };
      const out = [];
      const L = IT_LAZY[lang], push = lang.startsWith("Go");
      if (lazy) {
        const at = (s) => L.at[s];
        fr.push({ lazy, lang, N, calls: { ...calls }, out: [], st: null, line: [L.at.take], note: push
          ? "Go 1.23 iterators are <b>push</b>-style: <code>Naturals()</code> returns a function that calls <code>yield</code> for each value. The <code>for … range</code> body <i>is</i> that yield callback, and <code>break</code> makes yield return false. Same laziness, inverted control."
          : "Building the pipeline runs <b>nothing</b>. Each operator just wraps the previous iterator. Work starts only when the consumer asks for the first value.", vars: { emitted: 0 } });
        let v = 0;
        while (out.length < N) {
          v++; calls.source++;
          fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "source", item: v, line: at("source"), note: `${push ? "The source loop calls yield(" + v + ")" : "The consumer pulls; the request travels up to the source, which resumes after its last <code>yield</code> and produces"} <b>${v}</b>.`, vars: { x: v, emitted: out.length } });
          calls.filter++;
          if (v % 2 === 0) { fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "filter", item: v, rej: true, line: at("filter"), note: `filter: ${v} is even, rejected. The filter immediately pulls again; map and take never see it.`, vars: { x: v, emitted: out.length } }); continue; }
          fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "filter", item: v, line: at("filter"), note: `filter: ${v} is odd, passes down.`, vars: { x: v, emitted: out.length } });
          calls.map++;
          fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "map", item: v * v, line: at("map"), note: `map: ${v} → <b>${v * v}</b>.`, vars: { x: v, y: v * v, emitted: out.length } });
          calls.take++; out.push(v * v);
          fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "take", item: v * v, line: [at("take"), at("consume")], note: `take: emit ${v * v} (${out.length} of ${N}).${out.length === N ? " Quota reached, so take stops asking. The infinite source is simply never resumed again: no flag, no exception." : " The consumer handles it before the next value even exists."}`, vars: { y: v * v, emitted: out.length } });
        }
        fr.push({ lazy, lang, N, calls: { ...calls }, out: [...out], st: "end", line: [], note: `Done. The source produced only <b>${calls.source}</b> numbers for ${N} results, there was never more than one value in flight, and no intermediate list was allocated. Laziness is what lets you write a pipeline over an infinite (or huge, or slow) source.`, vars: { produced: calls.source, emitted: out.length } });
      } else {
        const all = Array.from({ length: 12 }, (_, i) => i + 1), odd = all.filter((x) => x % 2), sq = odd.map((x) => x * x), first = sq.slice(0, N);
        const base = { lazy, lang, N };
        fr.push({ ...base, arrays: [], line: [], note: "Eager style: each step builds a complete collection before the next step starts. That means the source <b>must be finite</b>. An infinite generator here would never return.", vars: {} });
        fr.push({ ...base, arrays: [["all", all]], line: 0, note: `Materialize the source: 12 elements (we had to guess an upper bound).`, vars: { allocated: 12 } });
        fr.push({ ...base, arrays: [["all", all], ["odd", odd]], line: 1, note: `filter over all 12 → a new collection of ${odd.length}.`, vars: { allocated: 12 + odd.length } });
        fr.push({ ...base, arrays: [["all", all], ["odd", odd], ["sq", sq]], line: 2, note: `map over all ${odd.length} → another new collection. Every square is computed, including ones we'll throw away.`, vars: { allocated: 12 + 2 * odd.length } });
        fr.push({ ...base, arrays: [["all", all], ["odd", odd], ["sq", sq], ["first", first]], line: 3, note: `Keep the first ${N}. Work done: ${12 + odd.length} predicate/projection calls and ${12 + 2 * odd.length + N} elements allocated, versus ${2 * N - 1} source values with lazy. Eager is still the right call when you'll iterate the result several times, need its Count, or must not hold a database connection open while you loop.`, vars: { allocated: 12 + 2 * odd.length + N, "calls": 12 + odd.length } });
      }
      return fr;
    },
    render: (f) => {
      if (!f.lazy) {
        const [lang, lines] = IT_EAGER[f.lang];
        const arrs = f.arrays.map(([nm, a], k) => Viz.array(a, { label: nm, showIdx: false, cls: () => (k === f.arrays.length - 1 ? "active" : "visit") }));
        return `<div class="bh-col">${arrs.join("") || '<div class="bh-muted">no collections yet</div>'}</div>` + codePanel(lines.map((l) => l.replace(/\bN\b/g, String(f.N))), lang, [].concat(f.line ?? []), `${f.lang.split(" (")[0]} · eager`);
      }
      const L = IT_LAZY[f.lang], W = 640, H = 128, bw = 96, gap = 28;
      const lbl = { source: "naturals()", filter: "filter odd", map: "map x²", take: `take ${f.N}`, consume: "consumer" };
      let b = "";
      IT_STAGES.forEach((s, i) => {
        const x = 6 + i * (bw + gap);
        const cls = f.st === s ? (f.rej ? "bad" : s === "take" ? "done" : "active") : f.st === "end" && s === "consume" ? "done" : "";
        b += box(x, 34, bw, 46, cls, lbl[s], s === "consume" ? `${f.out.length} received` : `${f.calls[s]} call${f.calls[s] === 1 ? "" : "s"}`);
        if (i) {
          const pushStyle = f.lang.startsWith("Go");
          b += arrow(x - gap, 50, x - 2, 50, f.st === IT_STAGES[i - 1] && !f.rej ? "active" : "");
          b += arrow(x - 2, 66, x - gap, 66, "dash", "");
          if (i === 1) b += txt(x - gap / 2, 98, pushStyle ? "yield(v)" : "next()", "small muted", "middle");
        }
        if (f.st === s && f.item !== undefined) b += `<text class="bh-chip-t" x="${x + bw / 2}" y="24" text-anchor="middle">${esc(f.item)}</text>`;
      });
      b += txt(6, 118, f.lang.startsWith("Go") ? "values pushed → ; loop body returns true/false ←" : "values flow → ; requests (MoveNext / next) flow ←", "small muted");
      return Viz.row(svg(W, H, b, "Lazy pipeline"), Viz.array(f.out, { label: "results", showIdx: false, cls: (i) => (i === f.out.length - 1 && f.st === "take" ? "active" : "done") })) + codePanel(L.lines.map((l) => l.replace(/\bN\b/g, String(f.N))), L.lang, [].concat(f.line ?? []), `${f.lang} · lazy`);
    },
  }));

  /* =====================================================================
   * 9. Visitor: double dispatch over an expression tree
   * ===================================================================== */
  const parseExpr = (src) => {
    const toks = src.match(/\d+(?:\.\d+)?|[-+*/()]|\S/g) || [];
    let p = 0; const nodes = [];
    const mk = (n) => { n.id = nodes.length; nodes.push(n); if (nodes.length > 15) throw new Error("Keep the expression to at most 15 nodes."); return n; };
    const peek = () => toks[p];
    const prim = () => {
      const t = toks[p++];
      if (t === undefined) throw new Error("The expression ends too early.");
      if (t === "(") { const e = add(); if (toks[p++] !== ")") throw new Error("Missing a closing parenthesis."); return e; }
      if (/^\d/.test(t)) return mk({ k: "Num", v: Number(t) });
      throw new Error(`Unexpected "${t}". Use numbers, + - * / and parentheses.`);
    };
    const mul = () => { let l = prim(); while (peek() === "*" || peek() === "/") { const op = toks[p++]; const r = prim(); l = mk({ k: "Bin", op, l, r }); } return l; };
    const add = () => { let l = mul(); while (peek() === "+" || peek() === "-") { const op = toks[p++]; const r = mul(); l = mk({ k: "Bin", op, l, r }); } return l; };
    const root = add();
    if (p < toks.length) throw new Error(`Unexpected "${toks[p]}".`);
    return { root, nodes };
  };
  const VISITORS = {
    "Evaluate": { num: (n) => n.v, bin: (op, a, b) => { if (op === "/" && b === 0) throw new Error("div0"); return +({ "+": a + b, "-": a - b, "*": a * b, "/": a / b }[op]).toFixed(4); }, combine: "apply the operator" },
    "Print as RPN": { num: (n) => String(n.v), bin: (op, a, b) => `${a} ${b} ${op}`, combine: "concatenate l, r, op" },
    "Count nodes": { num: () => 1, bin: (op, a, b) => a + b + 1, combine: "l + r + 1" },
  };
  Viz.register("behavioral-patterns-visitor", (el) => Viz.player(el, {
    title: "Visitor: node.Accept(v) then v.Visit(node), two dispatches",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "Accept / Visit running"], ["visit", "waiting for children"], ["done", "returned a result"], ["bad", "error"]],
    codeLang: "csharp",
    code: [
      "interface IVisitor<T> { /* VisitNum, VisitBin */ }",
      "record Num(double V) : Expr {",
      "  T Accept<T>(IVisitor<T> v) => v.VisitNum(this); }",
      "record Bin(char Op, Expr L, Expr R) : Expr {",
      "  T Accept<T>(IVisitor<T> v) => v.VisitBin(this); }",
      "class Evaluate : IVisitor<double> {",
      "  double VisitNum(Num n) => n.V;",
      "  double VisitBin(Bin b) {",
      "    var l = b.L.Accept(this);",
      "    var r = b.R.Accept(this);",
      "    return Combine(b.Op, l, r); } }",
    ],
    inputs: [
      { key: "expr", label: "expression", value: "(2 + 3) * 4 - 6 / 2", width: 220 },
      { key: "visitor", label: "visitor", type: "select", options: Object.keys(VISITORS), value: "Evaluate" },
    ],
    random: () => ({ expr: pick(["1 + 2 * 3", "(1 + 2) * 3", "8 / (4 - 4)", "7 - 2 - 1", "(5 + 5) / (1 + 1)", "2 * (3 + 4) * 5", "10 / 4 + 3 * (2 - 1)"]), visitor: pick(Object.keys(VISITORS)) }),
    build: ({ expr, visitor }) => {
      if (String(expr).length > 50) throw new Error("Keep the expression under 50 characters.");
      const { root, nodes } = parseExpr(expr);
      const V = VISITORS[visitor], res = {}, fr = [], stack = [];
      const state = {};
      const snap = (extra) => ({ nodes, root: root.id, res: { ...res }, state: { ...state }, stack: [...stack].reverse(), visitor, ...extra });
      fr.push(snap({ line: [0], note: `Parsed into ${nodes.length} nodes. The tree classes never change; each new operation (evaluate, print, count, type-check, optimize…) is a new <b>visitor</b> class. Adding a new <i>node type</i>, though, means editing every visitor.`, vars: { visitor } }));
      let failed = false;
      const walk = (n) => {
        const label = n.k === "Num" ? `Num(${n.v})` : `Bin('${n.op}')`;
        stack.push(`${label}.Accept`); state[n.id] = "active";
        fr.push(snap({ cur: n.id, line: n.k === "Num" ? 2 : 4, note: `Dispatch 1: <code>${esc(label)}.Accept(v)</code>. The virtual call picks the <b>node's</b> type, and Accept calls <code>v.Visit${n.k}(this)</code>.`, vars: { node: label } }));
        stack[stack.length - 1] = `${visitor.split(" ")[0]}.Visit${n.k}`;
        if (n.k === "Num") {
          res[n.id] = V.num(n); state[n.id] = "done";
          fr.push(snap({ cur: n.id, line: 6, note: `Dispatch 2: <code>Visit${n.k}</code> on the <b>${esc(visitor)}</b> visitor. A leaf returns <b>${esc(res[n.id])}</b>.`, vars: { node: label, result: res[n.id] } }));
          stack.pop(); return res[n.id];
        }
        state[n.id] = "visit";
        fr.push(snap({ cur: n.id, line: [7, 8], note: `Dispatch 2: <code>VisitBin</code> on <b>${esc(visitor)}</b>. It visits the left child first.`, vars: { node: label } }));
        const a = walk(n.l); if (failed) return;
        fr.push(snap({ cur: n.id, line: 9, note: `Back in VisitBin('${n.op}'): left = ${esc(a)}. Now the right child.`, vars: { node: label, l: a } }));
        const b = walk(n.r); if (failed) return;
        try { res[n.id] = V.bin(n.op, a, b); }
        catch (e) {
          state[n.id] = "bad"; failed = true;
          fr.push(snap({ cur: n.id, line: 10, err: true, note: `<b>Division by zero</b> at '${n.op}' (${esc(a)} / ${esc(b)}). The exception unwinds the whole call stack, which is why real evaluators return a Result or report a diagnostic instead of throwing.`, vars: { node: label, l: a, r: b, result: "error" } }));
          return;
        }
        state[n.id] = "done";
        fr.push(snap({ cur: n.id, line: 10, note: `Combine: ${esc(V.combine)} → <b>${esc(res[n.id])}</b>.`, vars: { node: label, l: a, r: b, result: res[n.id] } }));
        stack.pop(); return res[n.id];
      };
      walk(root);
      if (!failed) fr.push(snap({ line: [], end: true, note: `Result: <b>${esc(res[root.id])}</b>. In C# 9+, Java 21, Python 3.10, TypeScript and Rust you would usually write this as one recursive function with <code>switch</code> / <code>match</code> over a closed set of node types instead: the compiler checks exhaustiveness and there is no Accept boilerplate. See the comparison below.`, vars: { result: res[root.id] } }));
      return fr;
    },
    render: (f) => {
      const byId = new Map(f.nodes.map((n) => [n.id, n]));
      const t = Viz.layoutTree(f.root, (id) => { const n = byId.get(id); return n.k === "Bin" ? [n.l.id, n.r.id] : []; }, (id) => { const n = byId.get(id); return n.k === "Num" ? String(n.v) : n.op; }, { dx: 50, dy: 62 });
      t.nodes.forEach((n) => { if (f.res[n.id] !== undefined && f.res[n.id] !== null) n.sub = String(f.res[n.id]).length > 12 ? String(f.res[n.id]).slice(0, 11) + "…" : f.res[n.id]; });
      const g = Viz.graph(t, { nodeCls: (id) => (f.state[id] === "bad" ? "bad" : Number(id) === f.cur && f.state[id] !== "done" ? "active" : f.state[id] === "visit" ? "visit" : f.state[id] === "done" ? "done" : ""), label: `AST · ${f.visitor}` });
      return Viz.row(g, Viz.stack(f.stack, { label: "call stack", cls: (i) => (i === 0 ? (f.err ? "bad" : "active") : "") }));
    },
  }));

  /* =====================================================================
   * 10. Specification: composable business rules, in memory and as SQL
   * ===================================================================== */
  const CUSTOMERS = [
    { name: "Ada", active: true, premium: true, blocked: false, spent: 300, country: "NO" },
    { name: "Bob", active: true, premium: false, blocked: false, spent: 1500, country: "SE" },
    { name: "Cy", active: false, premium: true, blocked: false, spent: 5000, country: "NO" },
    { name: "Di", active: true, premium: false, blocked: false, spent: 200, country: "DK" },
    { name: "Ed", active: true, premium: true, blocked: true, spent: 9000, country: "NO" },
  ];
  const SPEC_FIELDS = { active: "bool", premium: "bool", blocked: "bool", spent: "num", country: "str" };
  const parseSpec = (src) => {
    const toks = String(src).match(/>=|<=|!=|[()=<>]|[A-Za-z]+|\d+/g) || [];
    let p = 0; const nodes = [];
    const mk = (n) => { n.id = nodes.length; nodes.push(n); if (nodes.length > 13) throw new Error("Keep the spec to at most 13 nodes."); return n; };
    const kw = (w) => toks[p] && toks[p].toLowerCase() === w;
    const atom = () => {
      if (kw("not")) { p++; return mk({ k: "not", a: atom() }); }
      if (toks[p] === "(") { p++; const e = orE(); if (toks[p++] !== ")") throw new Error("Missing ')'."); return e; }
      const id = (toks[p++] || "").toLowerCase();
      if (!SPEC_FIELDS[id]) throw new Error(`Unknown field "${id}". Fields: ${Object.keys(SPEC_FIELDS).join(", ")}.`);
      if (/^(>=|<=|!=|=|<|>)$/.test(toks[p] || "")) {
        const op = toks[p++], val = toks[p++];
        if (val === undefined) throw new Error(`"${id} ${op}" needs a value.`);
        if (SPEC_FIELDS[id] === "num" && !/^\d+$/.test(val)) throw new Error(`${id} compares with a number.`);
        if (SPEC_FIELDS[id] === "bool") throw new Error(`${id} is a flag: write "${id}" or "not ${id}".`);
        if (SPEC_FIELDS[id] === "str" && !/^(=|!=)$/.test(op)) throw new Error(`${id} supports = and != only.`);
        return mk({ k: "cmp", f: id, op, v: SPEC_FIELDS[id] === "num" ? Number(val) : val.toUpperCase() });
      }
      if (SPEC_FIELDS[id] !== "bool") throw new Error(`${id} needs a comparison, e.g. ${id === "spent" ? "spent>1000" : "country=NO"}.`);
      return mk({ k: "flag", f: id });
    };
    const andE = () => { let l = atom(); while (kw("and")) { p++; l = mk({ k: "and", a: l, b: atom() }); } return l; };
    const orE = () => { let l = andE(); while (kw("or")) { p++; l = mk({ k: "or", a: l, b: andE() }); } return l; };
    const root = orE();
    if (p < toks.length) throw new Error(`Unexpected "${toks[p]}".`);
    return { root, nodes };
  };
  const specLabel = (n) => n.k === "flag" ? n.f : n.k === "cmp" ? `${n.f}${n.op}${n.v}` : n.k.toUpperCase();
  const evalSpec = (n, c, log) => {
    let r;
    if (n.k === "flag") r = !!c[n.f];
    else if (n.k === "cmp") { const x = c[n.f], v = n.v; r = { ">": x > v, "<": x < v, ">=": x >= v, "<=": x <= v, "=": x === v, "!=": x !== v }[n.op]; }
    else if (n.k === "not") r = !evalSpec(n.a, c, log);
    else if (n.k === "and") r = evalSpec(n.a, c, log) && evalSpec(n.b, c, log);
    else r = evalSpec(n.a, c, log) || evalSpec(n.b, c, log);
    log.push([n.id, r]); return r;
  };
  const toSql = (n, parent) => {
    let s;
    if (n.k === "flag") s = `${n.f} = 1`;
    else if (n.k === "cmp") s = `${n.f} ${n.op === "!=" ? "<>" : n.op} ${typeof n.v === "number" ? n.v : `'${n.v}'`}`;
    else if (n.k === "not") s = `NOT (${toSql(n.a, "not")})`;
    else s = `${toSql(n.a, n.k)} ${n.k.toUpperCase()} ${toSql(n.b, n.k)}`;
    return n.k === "or" && parent === "and" ? `(${s})` : s;
  };
  Viz.register("behavioral-patterns-spec", (el) => Viz.player(el, {
    title: "Specification: a business rule as a composable object",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "evaluated true"], ["bad", "evaluated false"], ["dim", "skipped (short-circuit)"], ["active", "customer under test"]],
    codeLang: "csharp",
    code: [
      "abstract class Spec<T> {",
      "  abstract Expression<Func<T,bool>> ToExpression();",
      "  bool IsSatisfiedBy(T x) => compiled(x);",
      "  Spec<T> And(Spec<T> o) => new And<T>(this, o);",
      "}",
      "var vip = Active & (Premium | Big) & !Blocked;",
      "bool ok = vip.IsSatisfiedBy(c);     // in memory",
      "var rows = db.Customers.Where(vip.ToExpression());",
    ],
    inputs: [{ key: "spec", label: "spec", value: "active and (premium or spent>1000) and not blocked", width: 420 }],
    random: () => ({ spec: pick(["active and not blocked", "premium or spent>=1000", "active and country=NO and not blocked", "(premium or spent>1000) and not blocked", "not (active and premium)", "country!=NO or spent<500"]) }),
    build: ({ spec }) => {
      if (String(spec).length > 90) throw new Error("Keep the spec under 90 characters.");
      const { root, nodes } = parseSpec(spec);
      const fr = [], verdict = {};
      fr.push({ nodes, root: root.id, ci: -1, seen: {}, verdict: { ...verdict }, line: [5], note: "The rule is built from small named specs combined with And / Or / Not. Each piece is reusable, unit-testable and has a domain name instead of being a lambda copied into five queries.", vars: { nodes: nodes.length } });
      CUSTOMERS.forEach((c, ci) => {
        const log = [];
        const r = evalSpec(root, c, log);
        if (ci === 0) {
          const seen = {};
          log.forEach(([id, v], k) => { seen[id] = v; fr.push({ nodes, root: root.id, ci, seen: { ...seen }, verdict: { ...verdict }, line: 6, note: `${c.name}: <b>${esc(specLabel(nodes[id]))}</b> is ${v}.${k === log.length - 1 ? "" : ""}`, vars: { customer: c.name, node: specLabel(nodes[id]), value: v } }); });
        }
        verdict[c.name] = r;
        const seen = Object.fromEntries(log);
        const skipped = nodes.length - log.length;
        fr.push({ nodes, root: root.id, ci, seen, verdict: { ...verdict }, line: 6, note: `<b>${c.name}</b> ${r ? "satisfies" : "fails"} the spec. ${log.length} of ${nodes.length} nodes evaluated${skipped ? `; ${skipped} skipped by short-circuit (dimmed)` : ""}.`, vars: { customer: c.name, result: r } });
      });
      fr.push({ nodes, root: root.id, ci: -1, seen: {}, verdict: { ...verdict }, sql: toSql(root), line: 7, note: "The same object can become a query. Because <code>ToExpression()</code> returns an expression tree, EF Core translates it to SQL and the filtering happens in the database: one rule, two execution targets, no drift between the in-memory check and the query.", vars: { matches: Object.values(verdict).filter(Boolean).length } });
      return fr;
    },
    render: (f) => {
      const byId = new Map(f.nodes.map((n) => [n.id, n]));
      const t = Viz.layoutTree(f.root, (id) => { const n = byId.get(id); return n.k === "and" || n.k === "or" ? [n.a.id, n.b.id] : n.k === "not" ? [n.a.id] : []; }, (id) => id, { dx: 98, dy: 58 });
      const xs = t.nodes.map((n) => n.x), minX = Math.min(...xs), W = Math.max(...xs) - minX + 120, H = Math.max(...t.nodes.map((n) => n.y)) + 50;
      const P = new Map(t.nodes.map((n) => [n.id, { x: n.x - minX + 60, y: n.y + 20 }]));
      let b = "";
      t.edges.forEach((e) => { const a = P.get(e.u), c = P.get(e.v); b += `<line class="edge ${f.ci >= 0 && f.seen[e.v] === undefined ? "bh-dimline" : ""}" x1="${a.x}" y1="${a.y + 14}" x2="${c.x}" y2="${c.y - 14}"/>`; });
      t.nodes.forEach((n) => {
        const p = P.get(n.id), node = byId.get(n.id), v = f.seen[n.id];
        const cls = f.ci < 0 ? (node.k === "and" || node.k === "or" || node.k === "not" ? "accent" : "") : v === undefined ? "" : v ? "done" : "bad";
        const g = box(p.x - 46, p.y - 14, 92, 28, cls, specLabel(node), "", { mono: true, rx: node.k === "flag" || node.k === "cmp" ? 6 : 14 });
        b += f.ci >= 0 && v === undefined ? `<g class="bh-dim">${g}</g>` : g;
      });
      const rows = CUSTOMERS.map((c, i) => `<tr class="${i === f.ci ? "cur" : ""}"><td>${c.name}</td><td>${c.active ? "✓" : "·"}</td><td>${c.premium ? "✓" : "·"}</td><td>${c.blocked ? "✓" : "·"}</td><td>${c.spent}</td><td>${c.country}</td><td class="${f.verdict[c.name] === undefined ? "" : f.verdict[c.name] ? "ok" : "no"}">${f.verdict[c.name] === undefined ? "" : f.verdict[c.name] ? "match" : "no"}</td></tr>`).join("");
      const tbl = `<table class="bh-tbl"><tr><th>name</th><th>active</th><th>premium</th><th>blocked</th><th>spent</th><th>country</th><th>spec</th></tr>${rows}</table>`;
      const sql = f.sql ? `<pre class="bh-out bh-sql">${hl("SELECT * FROM Customers", "sql")}\n${hl("WHERE " + f.sql, "sql")}</pre>` : "";
      return `<div class="bh-col">${svg(W, H, b, "Specification tree")}<div class="bh-scroll">${tbl}${sql}</div></div>`;
    },
  }));
})();
