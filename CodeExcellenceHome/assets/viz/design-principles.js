/* Visualizers for "Design Principles". Every frame comes from running the model on the inputs. */
(() => {
  const esc = (s) => Viz.esc(s);
  const num = (s, label, lo, hi) => {
    const n = Number(s);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < lo || n > hi) throw new Error(`${label} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const ident = (s, what) => {
    if (!/^[A-Za-z_][A-Za-z0-9_]{0,13}$/.test(s)) throw new Error(`"${s}" is not a valid ${what} name (letters, digits, _; at most 14 characters).`);
    return s;
  };
  /* Arrow from box edge to box edge, with a polygon head (no shared marker ids). */
  const arrow = (x1, y1, x2, y2, cls, opt = {}) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const hx = x2 - ux * 9, hy = y2 - uy * 9;
    const head = `<polygon class="dp-ah ${cls}" points="${x2},${y2} ${hx - uy * 4.5},${hy + ux * 4.5} ${hx + uy * 4.5},${hy - ux * 4.5}"/>`;
    return `<line class="dp-e ${cls}${opt.dash ? " dash" : ""}" x1="${x1}" y1="${y1}" x2="${hx}" y2="${hy}"/>${head}`;
  };
  /* Clip a centre-to-centre segment to the borders of two w×h boxes. */
  const clipBox = (a, b, w, h) => {
    const cut = (p, q) => {
      const dx = q.x - p.x, dy = q.y - p.y;
      const t = Math.min(dx ? (w / 2 + 2) / Math.abs(dx) : Infinity, dy ? (h / 2 + 2) / Math.abs(dy) : Infinity);
      return { x: p.x + dx * t, y: p.y + dy * t };
    };
    const s = cut(a, b), e = cut(b, a);
    return [s.x, s.y, e.x, e.y];
  };

  /* =====================================================================
   * 1. Change ripple: tight coupling vs ports and adapters
   * ===================================================================== */
  const TIGHT = {
    nodes: {
      checkout: [70, 28, "Checkout UI"], admin: [190, 28, "AdminPage"], reports: [310, 28, "ReportJob"], tests: [460, 28, "OrderTests"],
      svc: [265, 104, "OrderService"],
      pay: [70, 180, "StripeClient"], db: [210, 180, "SqlOrderDao"], mail: [350, 180, "SmtpMailer"], tax: [480, 180, "TaxTable"],
    },
    /* [user, used, usesDetails, apiLeaks, why] */
    edges: [
      ["checkout", "svc", 1, 0], ["checkout", "pay", 1, 0, "builds a StripeToken"], ["admin", "svc", 1, 0], ["admin", "db", 1, 0, "reads SqlOrderRow"],
      ["reports", "db", 1, 0], ["reports", "tax", 1, 0], ["tests", "svc", 1, 0], ["tests", "pay", 1, 0], ["tests", "db", 1, 0], ["tests", "mail", 1, 0],
      ["svc", "pay", 1, 1, "placeOrder(StripeToken)"], ["svc", "db", 1, 1, "returns SqlOrderRow"], ["svc", "mail", 1, 0], ["svc", "tax", 1, 1, "rate(state)"],
    ],
  };
  const LOOSE = {
    nodes: {
      checkout: [60, 26, "Checkout UI"], admin: [170, 26, "AdminPage"], reports: [280, 26, "ReportJob"], tests: [390, 26, "OrderTests"],
      svc: [225, 88, "OrderService"],
      ipay: [65, 150, "IPayments", "port"], iorders: [190, 150, "IOrderStore", "port"], inote: [315, 150, "INotifier", "port"], itax: [440, 150, "ITaxPolicy", "port"],
      pay: [65, 212, "StripePayments"], db: [190, 212, "SqlOrderStore"], mail: [315, 212, "SmtpNotifier"], tax: [440, 212, "TaxTable"],
      main: [500, 88, "Main (wiring)"],
    },
    edges: [
      ["checkout", "svc", 1, 0], ["admin", "svc", 1, 0], ["reports", "iorders", 0, 0], ["reports", "itax", 0, 0], ["tests", "svc", 1, 0],
      ["svc", "ipay", 0, 0], ["svc", "iorders", 0, 0], ["svc", "inote", 0, 0], ["svc", "itax", 0, 0],
      ["pay", "ipay", 0, 0, "", "impl"], ["db", "iorders", 0, 0, "", "impl"], ["mail", "inote", 0, 0, "", "impl"], ["tax", "itax", 0, 0, "", "impl"],
      ["main", "pay", 1, 0], ["main", "db", 1, 0], ["main", "mail", 1, 0], ["main", "tax", 1, 0], ["main", "svc", 1, 0],
    ],
  };
  const CHANGES = {
    "Switch payments: Stripe → Adyen": { target: "pay", tightApi: true, looseApi: true, what: "a new payment provider" },
    "Move orders: SQL → document DB": { target: "db", tightApi: true, looseApi: true, what: "a new order store" },
    "Send SMS instead of email": { target: "mail", tightApi: true, looseApi: true, what: "a new notifier" },
    "Add a tax rule for a new country": { target: "tax", tightApi: true, looseApi: false, what: "a new tax rule" },
  };
  const ripple = (G, target, apiChanged) => {
    const users = (m) => G.edges.filter((e) => e[1] === m);
    const touched = new Set([target]), queue = apiChanged ? [target] : [], steps = [];
    while (queue.length) {
      const m = queue.shift(), hit = [], stopped = [];
      for (const e of users(m)) {
        const d = e[0];
        if (!e[2]) { stopped.push(e); continue; }
        if (touched.has(d)) continue;
        touched.add(d); hit.push(e);
        if (e[3]) queue.push(d);
      }
      steps.push({ m, hit, stopped, touched: new Set(touched), queue: [...queue] });
    }
    return { touched, steps };
  };
  const rippleSvg = (G, f) => {
    const W = 560, BW = 104, BH = 30, H = G === LOOSE ? 236 : 204;
    let s = `<svg class="dp-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Module dependency graph">`;
    const pos = (id) => ({ x: G.nodes[id][0], y: G.nodes[id][1] });
    for (const e of G.edges) {
      const a = pos(e[0]), b = pos(e[1]);
      let cls = e[5] === "impl" ? "impl" : "";
      if (f.hotEdges && f.hotEdges.has(e)) cls = "bad";
      else if (f.stopEdges && f.stopEdges.has(e)) cls = "done";
      else if (e[0] === "main") cls += " faint";
      const [x1, y1, x2, y2] = clipBox(a, b, BW, BH);
      s += arrow(x1, y1, x2, y2, cls, { dash: e[5] === "impl" || e[0] === "main" });
    }
    for (const [id, [x, y, label, kind]] of Object.entries(G.nodes)) {
      let cls = kind === "port" ? "port" : "";
      if (f.touched && f.touched.has(id)) cls += " bad";
      if (id === f.cur) cls += " active";
      if (id === f.target) cls += " target";
      s += `<g class="dp-node ${cls}"><rect x="${x - BW / 2}" y="${y - BH / 2}" width="${BW}" height="${BH}" rx="${kind === "port" ? 15 : 6}"/><text x="${x}" y="${y + 4}" text-anchor="middle">${esc(label)}</text></g>`;
    }
    return s + "</svg>";
  };
  const scoreHtml = (tight, loose) => {
    const max = Math.max(tight || 0, loose || 0, 1), bar = (n, cls) => `<i class="${cls}" style="width:${(n / max) * 300}px"></i>`;
    return `<div class="dp-score"><div><span>tight coupling</span>${tight === null ? "<em>not run yet</em>" : `${bar(tight, "bad")}<b>${tight} file${tight === 1 ? "" : "s"}</b>`}</div><div><span>ports + adapters</span>${loose === null ? "<em>not run yet</em>" : `${bar(loose, "done")}<b>${loose} file${loose === 1 ? "" : "s"}</b>`}</div></div>`;
  };
  Viz.register("design-principles-ripple", (el) => Viz.player(el, {
    title: "Ripple: how far does one change request travel?",
    legend: [["active", "module being processed"], ["bad", "must change (file touched)"], ["done", "edge that stops the ripple"], ["path", "port (interface owned by the core)"]],
    codeLang: "python",
    code: [
      "touched = {target}",
      "queue = [target] if api_changed else []",
      "while queue:",
      "    m = queue.pop(0)",
      "    for d in users_of(m):",
      "        if not d.knows_details_of(m):",
      "            continue        # port: stop",
      "        touched.add(d)",
      "        if d.api_leaks(m): queue += [d]",
      "files_touched = len(touched)",
    ],
    inputs: [{ key: "change", label: "change request", type: "select", options: Object.keys(CHANGES), value: Object.keys(CHANGES)[0] }],
    random: () => ({ change: Object.keys(CHANGES)[Viz.rand(0, Object.keys(CHANGES).length - 1)] }),
    build: ({ change }) => {
      const C = CHANGES[change];
      if (!C) throw new Error("Pick a change request from the list.");
      const frames = [], T = ripple(TIGHT, C.target, C.tightApi), Lr = ripple(LOOSE, C.target, C.looseApi);
      const name = (G, id) => G.nodes[id][2];
      const run = (G, R, label, other) => {
        const isT = G === TIGHT;
        frames.push({ G, target: C.target, cur: C.target, touched: new Set([C.target]), line: [0, 1], score: isT ? [null, other] : [other, null],
          vars: { design: label, target: name(G, C.target), touched: 1 },
          note: isT
            ? `<b>${esc(change)}.</b> In the tightly coupled design, <b>${name(G, C.target)}</b> is used directly: its concrete types (<code>StripeToken</code>, <code>SqlOrderRow</code>, <code>rate(state)</code>) appear in other classes' code and signatures.`
            : `Same change, but now the core owns small interfaces (<b>ports</b>) and the concrete classes are <b>adapters</b> that implement them. Only <b>Main</b> knows which adapter is used.${C.looseApi ? "" : " This change stays inside <b>TaxTable</b>: <code>ITaxPolicy.rateFor(order)</code> already receives the whole order, so its signature does not change."}` });
        R.steps.forEach((st) => {
          const hitNames = st.hit.map((e) => name(G, e[0])), stopNames = st.stopped.map((e) => name(G, e[0]));
          const why = st.hit.filter((e) => e[4]).map((e) => `${name(G, e[0])}: ${e[4]}`), leak = st.hit.filter((e) => e[3]).map((e) => name(G, e[0]));
          frames.push({ G, target: C.target, cur: st.m, touched: st.touched, hotEdges: new Set(st.hit), stopEdges: new Set(st.stopped), line: [3, 4, 7, 8], score: isT ? [null, other] : [other, null],
            vars: { design: label, processing: name(G, st.m), "newly touched": hitNames.join(", ") || "none", queue: st.queue.map((q) => name(G, q)).join(", ") || "empty", touched: st.touched.size },
            note: `${st.m === C.target ? `<b>${name(G, st.m)}</b> is replaced or rewritten.` : `<b>${name(G, st.m)}</b> had to change its public signature.`} ${hitNames.length ? `Everything that knows its details must change too: <b>${hitNames.join(", ")}</b>${why.length ? ` (${why.join("; ")})` : ""}.` : "Nobody else depends on its details."}${leak.length ? ` ${leak.join(" and ")} expose${leak.length === 1 ? "s" : ""} the old type in ${leak.length === 1 ? "its" : "their"} own API, so ${leak.length === 1 ? "its" : "their"} users are next.` : ""}${stopNames.length ? ` <b>${stopNames.join(", ")}</b> only see${stopNames.length === 1 ? "s" : ""} an interface, so the ripple stops there.` : ""}` });
        });
        const n = R.touched.size;
        frames.push({ G, target: C.target, touched: R.touched, line: 9, score: isT ? [n, other] : [other, n],
          vars: { design: label, files_touched: n },
          note: isT
            ? `Tight coupling: <b>${n} files</b> change for ${C.what}: ${[...R.touched].map((x) => name(G, x)).join(", ")}. Each is a merge conflict, a review and a retest, often across teams.`
            : `Ports and adapters: <b>${n} file${n === 1 ? "" : "s"}</b> (${[...R.touched].map((x) => name(G, x)).join(", ")}). ${C.looseApi ? "Write the new adapter and change one line of wiring. OrderService and its tests did not move." : "The rule lives in one adapter."}` });
        return n;
      };
      const nt = run(TIGHT, T, "tight", null);
      const nl = run(LOOSE, Lr, "ports + adapters", nt);
      frames.push({ ...frames[frames.length - 1], score: [nt, nl], line: 9, vars: { tight: nt, loose: nl },
        note: `<b>${nt} vs ${nl}</b> files for the same change. Coupling is not "bad"; it is the <b>cost of change</b>. Pay for ports where change is likely (vendors, storage, I/O). Elsewhere, a direct call is simpler and fine.` });
      return frames;
    },
    render: (f) => `<div class="dp-col">${rippleSvg(f.G, f)}${scoreHtml(f.score[0], f.score[1])}</div>`,
  }));

  /* =====================================================================
   * 2. Cohesion: LCOM4 = connected groups of methods that share fields
   * ===================================================================== */
  const PAL = ["visit", "done", "path", "active", "bad"];
  const parseClass = (s) => {
    const parts = String(s).split(";").map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2) throw new Error("List at least two methods, e.g. total:items,discount; addItem:items");
    if (parts.length > 8) throw new Error("Use at most 8 methods so the picture stays readable.");
    const methods = parts.map((p) => {
      const m = p.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error(`"${p}" should look like method:field1,field2 (use @name for a call to another method).`);
      const uses = m[2].split(",").map((x) => x.trim()).filter(Boolean);
      return { name: ident(m[1].trim(), "method"), fields: uses.filter((u) => !u.startsWith("@")).map((u) => ident(u, "field")), calls: uses.filter((u) => u.startsWith("@")).map((u) => u.slice(1)) };
    });
    const names = new Set(methods.map((m) => m.name));
    if (names.size !== methods.length) throw new Error("Method names must be unique.");
    for (const m of methods) for (const c of m.calls) if (!names.has(c)) throw new Error(`@${c} is not one of the methods.`);
    const fields = [...new Set(methods.flatMap((m) => m.fields))];
    if (fields.length > 10) throw new Error("Use at most 10 distinct fields.");
    return { methods, fields };
  };
  Viz.register("design-principles-cohesion", (el) => Viz.player(el, {
    title: "Cohesion: do the methods of a class share its data? (LCOM4)",
    legend: [["active", "method being linked"], ["visit", "group 1"], ["done", "group 2"], ["path", "group 3"]],
    codeLang: "python",
    code: [
      "groups = UnionFind(methods + fields)",
      "for m in methods:",
      "    for f in m.fields_used:",
      "        groups.union(m, f)",
      "    for other in m.methods_called:",
      "        groups.union(m, other)",
      "lcom4 = groups.count(methods)",
      "if lcom4 > 1: split into lcom4 classes",
    ],
    inputs: [{ key: "cls", label: "class OrderService: method:fields (@ = calls)", value: "total:items,discount; addItem:items; applyCoupon:discount,coupons; emailReceipt:smtp,template; renderPdf:template,@emailReceipt", width: 520 }],
    random: () => {
      const F = ["items", "discount", "coupons", "smtp", "template", "cache", "clock", "log"], M = ["total", "addItem", "remove", "applyCoupon", "emailReceipt", "renderPdf", "audit", "expire"];
      const k = Viz.rand(4, 7);
      return { cls: M.slice(0, k).map((m) => `${m}:${[...new Set([F[Viz.rand(0, 7)], F[Viz.rand(0, 7)]])].join(",")}`).join("; ") };
    },
    build: ({ cls }) => {
      const { methods, fields } = parseClass(cls);
      const parent = new Map(), find = (x) => { while (parent.get(x) !== x) { parent.set(x, parent.get(parent.get(x))); x = parent.get(x); } return x; };
      const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
      for (const m of methods) parent.set("m:" + m.name, "m:" + m.name);
      for (const f of fields) parent.set("f:" + f, "f:" + f);
      const snapshot = () => {
        const roots = [], colour = new Map();
        for (const m of methods) { const r = find("m:" + m.name); if (!roots.includes(r)) roots.push(r); }
        const groupOf = (k) => roots.indexOf(find(k));
        for (const m of methods) colour.set("m:" + m.name, groupOf("m:" + m.name));
        for (const f of fields) colour.set("f:" + f, groupOf("f:" + f));
        return { colour, count: roots.length };
      };
      const frames = [];
      let s = snapshot();
      frames.push({ methods, fields, done: 0, ...s, line: 0, vars: { methods: methods.length, fields: fields.length, groups: s.count }, note: `Each method starts in its own group. A line means "this method reads or writes that field". If methods never touch the same data, they are <b>separate responsibilities sharing one class</b>.` });
      methods.forEach((m, i) => {
        for (const f of m.fields) union("m:" + m.name, "f:" + f);
        for (const c of m.calls) union("m:" + m.name, "m:" + c);
        s = snapshot();
        frames.push({ methods, fields, done: i + 1, cur: m.name, ...s, line: m.calls.length ? [2, 3, 4, 5] : [2, 3],
          vars: { method: m.name, uses: [...m.fields, ...m.calls.map((c) => "@" + c)].join(", ") || "nothing", groups: s.count },
          note: `<b>${esc(m.name)}</b> uses ${m.fields.length ? m.fields.map((f) => `<code>${esc(f)}</code>`).join(", ") : "no fields"}${m.calls.length ? ` and calls ${m.calls.map((c) => `<code>${esc(c)}()</code>`).join(", ")}` : ""}. Anything connected through shared data joins one group. Groups so far: <b>${s.count}</b>.` });
      });
      const groups = [];
      methods.forEach((m) => { const g = s.colour.get("m:" + m.name); (groups[g] ||= { methods: [], fields: new Set() }).methods.push(m.name); m.fields.forEach((f) => groups[g].fields.add(f)); });
      const desc = groups.map((g, i) => `<span class="dp-chip ${PAL[i % PAL.length]}">${g.methods.join(", ")} {${[...g.fields].join(", ")}}</span>`).join(" ");
      frames.push({ methods, fields, done: methods.length, ...s, groups, line: [6, 7], vars: { LCOM4: s.count, verdict: s.count === 1 ? "cohesive" : `split into ${s.count}` },
        note: s.count === 1
          ? `<b>LCOM4 = 1</b>: every method is connected through shared data. The class is <b>cohesive</b>; it is one responsibility. ${desc}`
          : `<b>LCOM4 = ${s.count}</b>: the class is really ${s.count} classes glued together. Split along the groups: ${desc}. Each new class has a reason to change of its own (SRP).` });
      return frames;
    },
    render: (f) => {
      const W = 560, RH = 30, n = Math.max(f.methods.length, f.fields.length), H = n * RH + 34, mx = 150, fx = 410, BW = 130, FW = 110;
      const my = (i) => 26 + i * RH + ((n - f.methods.length) * RH) / 2, fy = (i) => 26 + i * RH + ((n - f.fields.length) * RH) / 2;
      let s = `<svg class="dp-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Methods and the fields they use"><text class="lbl b" x="${mx}" y="12" text-anchor="middle">methods</text><text class="lbl b" x="${fx}" y="12" text-anchor="middle">fields</text>`;
      const fIdx = new Map(f.fields.map((x, i) => [x, i])), mIdx = new Map(f.methods.map((m, i) => [m.name, i]));
      f.methods.forEach((m, i) => {
        if (i >= f.done && m.name !== f.cur) return;
        const g = PAL[f.colour.get("m:" + m.name) % PAL.length], cls = m.name === f.cur ? "active" : g;
        for (const fl of m.fields) s += `<line class="dp-link ${cls}" x1="${mx + BW / 2}" y1="${my(i)}" x2="${fx - FW / 2}" y2="${fy(fIdx.get(fl))}"/>`;
        for (const c of m.calls) { const j = mIdx.get(c), y1 = my(i), y2 = my(j); s += `<path class="dp-link call ${cls}" d="M${mx - BW / 2},${y1} C${mx - BW / 2 - 40},${y1} ${mx - BW / 2 - 40},${y2} ${mx - BW / 2},${y2}"/>`; }
      });
      f.methods.forEach((m, i) => {
        const seen = i < f.done, cls = m.name === f.cur ? "active" : seen ? PAL[f.colour.get("m:" + m.name) % PAL.length] : "";
        s += `<g class="dp-node ${cls}"><rect x="${mx - BW / 2}" y="${my(i) - 11}" width="${BW}" height="22" rx="5"/><text x="${mx}" y="${my(i) + 4}" text-anchor="middle" class="mono">${esc(m.name)}()</text></g>`;
      });
      f.fields.forEach((fl, i) => {
        const used = f.methods.some((m, k) => (k < f.done || m.name === f.cur) && m.fields.includes(fl));
        const cls = used ? PAL[f.colour.get("f:" + fl) % PAL.length] : "";
        s += `<g class="dp-node field ${cls}"><rect x="${fx - FW / 2}" y="${fy(i) - 11}" width="${FW}" height="22" rx="11"/><text x="${fx}" y="${fy(i) + 4}" text-anchor="middle" class="mono">${esc(fl)}</text></g>`;
      });
      s += "</svg>";
      const meter = `<div class="dp-meter"><span>LCOM4</span><b class="${f.count === 1 ? "ok" : "bad"}">${f.count}</b><em>${f.count === 1 ? "one responsibility" : `${f.count} disconnected groups`}</em></div>`;
      return `<div class="dp-col">${s}${meter}</div>`;
    },
  }));

  /* =====================================================================
   * 3. Coupling metrics: Ca, Ce, instability, abstractness, distance
   * ===================================================================== */
  const parseDeps = (deps, abs) => {
    const pk = new Map();
    for (const tok of String(abs).split(",").map((x) => x.trim()).filter(Boolean)) {
      const m = tok.match(/^(\S+)\s+(\d+)\s*\/\s*(\d+)$/);
      if (!m) throw new Error(`"${tok}" should look like "Domain 4/10" (abstract types / all types).`);
      const a = Number(m[2]), t = Number(m[3]);
      if (t < 1 || a > t) throw new Error(`${m[1]}: abstract types must be between 0 and the total, and total at least 1.`);
      if (m[1].length > 8) throw new Error(`Keep package names to 8 characters ("${m[1]}").`);
      pk.set(m[1], { name: m[1], a, t });
    }
    if (pk.size < 2 || pk.size > 7) throw new Error("Describe 2 to 7 packages.");
    const edges = [];
    for (const tok of String(deps).split(",").map((x) => x.trim()).filter(Boolean)) {
      const m = tok.match(/^(\S+)\s*>\s*(\S+)$/);
      if (!m) throw new Error(`"${tok}" should look like "Web>App" (Web depends on App).`);
      if (!pk.has(m[1]) || !pk.has(m[2])) throw new Error(`"${tok}": every package must also appear in the abstractness list.`);
      if (m[1] === m[2]) throw new Error(`"${tok}": a package cannot depend on itself.`);
      if (!edges.some((e) => e[0] === m[1] && e[1] === m[2])) edges.push([m[1], m[2]]);
    }
    return { pk: [...pk.values()], edges };
  };
  const f2 = (x) => x.toFixed(2);
  Viz.register("design-principles-coupling", (el) => Viz.player(el, {
    title: "Coupling metrics: who depends on whom, and is it in the right direction?",
    legend: [["done", "incoming: Ca (afferent)"], ["active", "outgoing: Ce (efferent)"], ["bad", "depends on something less stable"], ["path", "main sequence A + I = 1"]],
    codeLang: "python",
    code: [
      "for p in packages:",
      "    ca = len(users_of(p)) # afferent",
      "    ce = len(p.uses)      # efferent",
      "    I = ce / (ca + ce)    # instability",
      "    A = abstract / types  # abstractness",
      "    D = abs(A + I - 1)    # distance",
      "for u, v in deps:",
      "    if I[u] < I[v]: flag(u, v)  # SDP",
    ],
    inputs: [
      { key: "deps", label: "dependencies (A>B: A uses B)", value: "Web>App, Web>Domain, App>Domain, App>Util, Infra>Domain, Infra>Util, Domain>Util, Domain>Infra", width: 330 },
      { key: "abs", label: "abstract / total types", value: "Web 0/12, App 1/9, Domain 4/10, Infra 0/14, Util 0/6", width: 220 },
    ],
    random: () => {
      const P = ["Web", "App", "Domain", "Infra", "Util"], e = [];
      for (let i = 0; i < 7; i++) { const a = P[Viz.rand(0, 4)], b = P[Viz.rand(0, 4)]; if (a !== b) e.push(`${a}>${b}`); }
      if (!e.length) e.push("Web>App");
      return { deps: e.join(", "), abs: P.map((p) => { const t = Viz.rand(4, 14); return `${p} ${Viz.rand(0, Math.floor(t / 2))}/${t}`; }).join(", ") };
    },
    build: ({ deps, abs }) => {
      const { pk, edges } = parseDeps(deps, abs);
      const M = new Map(), frames = [];
      frames.push({ pk, edges, M: new Map(), line: 0, vars: { packages: pk.length, dependencies: edges.length }, note: `Each arrow is a compile-time dependency. Two numbers per package tell you how risky it is to change: how many depend on it (<b>Ca</b>) and how many it depends on (<b>Ce</b>).` });
      for (const p of pk) {
        const ca = edges.filter((e) => e[1] === p.name).length, ce = edges.filter((e) => e[0] === p.name).length;
        const I = ca + ce ? ce / (ca + ce) : 0, A = p.a / p.t, D = Math.abs(A + I - 1);
        M.set(p.name, { ca, ce, I, A, D });
        const zone = D < 0.3 ? "near the main sequence" : A + I < 1 ? "toward the zone of pain (stable and concrete)" : "toward the zone of uselessness (abstract, nobody uses it)";
        frames.push({ pk, edges, M: new Map(M), cur: p.name, line: [1, 2, 3, 4, 5], vars: { package: p.name, Ca: ca, Ce: ce, I: f2(I), A: f2(A), D: f2(D) },
          note: `<b>${esc(p.name)}</b>: ${ca} package${ca === 1 ? " depends" : "s depend"} on it, and it depends on ${ce}. Instability I = ${ce}/${ca + ce || 1} = <b>${f2(I)}</b> (${I < 0.35 ? "stable: hard to change, many would break" : I > 0.65 ? "unstable: easy to change, few depend on it" : "in between"}). Abstractness ${p.a}/${p.t} = ${f2(A)}. Distance D = <b>${f2(D)}</b>, ${zone}.` });
      }
      const bad = edges.filter((e) => M.get(e[0]).I < M.get(e[1]).I - 1e-9);
      frames.push({ pk, edges, M, bad: new Set(bad), line: [6, 7], vars: { "SDP violations": bad.length, "worst D": [...M.entries()].sort((a, b) => b[1].D - a[1].D)[0][0] },
        note: bad.length
          ? `<b>Stable Dependencies Principle</b>: depend in the direction of stability. ${bad.map((e) => `<b>${esc(e[0])}</b> (I=${f2(M.get(e[0]).I)}) depends on <b>${esc(e[1])}</b> (I=${f2(M.get(e[1]).I)})`).join("; ")}. Fix with <b>dependency inversion</b>: put an interface in the stable package and let the volatile one implement it.`
          : `No dependency points toward a less stable package. ${[...M.entries()].filter(([, v]) => v.D > 0.7).map(([k]) => `<b>${esc(k)}</b> sits in a zone (D &gt; 0.7); for a utility that never changes, like a string library, that is acceptable.`).join(" ")}` });
      return frames;
    },
    render: (f) => {
      const W = 560, H = 270, cx = 128, cy = 136, R = 96, r = 27;
      const P = new Map(f.pk.map((p, i) => [p.name, { x: cx + R * Math.cos((2 * Math.PI * i) / f.pk.length - Math.PI / 2), y: cy + R * Math.sin((2 * Math.PI * i) / f.pk.length - Math.PI / 2) }]));
      let s = `<svg class="dp-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Package dependency graph and the abstractness-instability chart"><text class="lbl b" x="${cx}" y="14" text-anchor="middle">dependencies</text>`;
      for (const e of f.edges) {
        const a = P.get(e[0]), b = P.get(e[1]), dx = b.x - a.x, dy = b.y - a.y, L = Math.hypot(dx, dy), ux = dx / L, uy = dy / L;
        const twin = f.edges.some((g) => g[0] === e[1] && g[1] === e[0]), off = twin ? 5 : 0, nx = -uy * off, ny = ux * off;
        let cls = "";
        if (f.bad && f.bad.has(e)) cls = "bad";
        else if (f.cur && e[1] === f.cur) cls = "done";
        else if (f.cur && e[0] === f.cur) cls = "active";
        s += arrow(a.x + ux * r + nx, a.y + uy * r + ny, b.x - ux * (r + 1) + nx, b.y - uy * (r + 1) + ny, cls);
      }
      for (const p of f.pk) {
        const { x, y } = P.get(p.name), m = f.M.get(p.name), cls = p.name === f.cur ? "active" : m ? "visit" : "";
        s += `<g class="dp-node ${cls}"><circle cx="${x}" cy="${y}" r="${r}"/><text x="${x}" y="${y + (m ? 0 : 4)}" text-anchor="middle" class="b">${esc(p.name)}</text>${m ? `<text x="${x}" y="${y + 12}" text-anchor="middle" class="lbl">I ${f2(m.I)}</text>` : ""}</g>`;
      }
      const px = 300, py = 24, pw = 220, ph = 200, X = (i) => px + i * pw, Y = (a) => py + ph - a * ph;
      s += `<polygon class="dp-zone bad" points="${X(0)},${Y(0)} ${X(0.42)},${Y(0)} ${X(0)},${Y(0.42)}"/><text class="lbl dp-t-bad" x="${X(0.02)}" y="${Y(0.16)}">zone of pain</text>`;
      s += `<polygon class="dp-zone active" points="${X(1)},${Y(1)} ${X(0.58)},${Y(1)} ${X(1)},${Y(0.58)}"/><text class="lbl dp-t-active" x="${X(0.98)}" y="${Y(0.92)}" text-anchor="end">zone of uselessness</text>`;
      s += `<rect class="dp-frame" x="${px}" y="${py}" width="${pw}" height="${ph}"/><line class="dp-main" x1="${X(0)}" y1="${Y(1)}" x2="${X(1)}" y2="${Y(0)}"/>`;
      for (const t of [0, 0.5, 1]) s += `<text class="lbl" x="${X(t)}" y="${py + ph + 14}" text-anchor="middle">${t}</text><text class="lbl" x="${px - 5}" y="${Y(t) + 4}" text-anchor="end">${t}</text>`;
      s += `<text class="lbl" x="${px + pw / 2}" y="${H - 4}" text-anchor="middle">instability I →</text><text class="lbl" x="${px - 26}" y="${py + ph / 2}" text-anchor="middle" transform="rotate(-90 ${px - 26} ${py + ph / 2})">abstractness A →</text>`;
      const placed = [];
      for (const p of f.pk) {
        const m = f.M.get(p.name);
        if (!m) continue;
        const x = X(m.I), y = Y(m.A), k = placed.filter((q) => Math.abs(q.x - x) < 40 && Math.abs(q.y - y) < 12).length;
        placed.push({ x, y });
        const right = m.I < 0.8;
        s += `<circle class="dp-dot ${p.name === f.cur ? "active" : m.D > 0.7 ? "bad" : "visit"}" cx="${x}" cy="${y}" r="5"/><text class="lbl b" x="${x + (right ? 8 : -8)}" y="${y - 6 - k * 11}" text-anchor="${right ? "start" : "end"}">${esc(p.name)}</text>`;
      }
      s += "</svg>";
      const rows = f.pk.map((p) => { const m = f.M.get(p.name); return `<tr class="${p.name === f.cur ? "cur" : ""}"><th>${esc(p.name)}</th>${m ? `<td>${m.ca}</td><td>${m.ce}</td><td>${f2(m.I)}</td><td>${f2(m.A)}</td><td class="${m.D > 0.7 ? "bad" : ""}">${f2(m.D)}</td>` : "<td>·</td><td>·</td><td>·</td><td>·</td><td>·</td>"}</tr>`; }).join("");
      return `<div class="dp-col">${s}<table class="dp-table"><tr><th>package</th><th>Ca</th><th>Ce</th><th>I</th><th>A</th><th>D</th></tr>${rows}</table></div>`;
    },
  }));

  /* =====================================================================
   * 4. Liskov substitution: run Rectangle's contract tests on Square
   * ===================================================================== */
  class Rect { constructor(w, h) { this.w = w; this.h = h; } setWidth(w) { this.w = w; } setHeight(h) { this.h = h; } area() { return this.w * this.h; } }
  class Sq extends Rect { constructor(s) { super(s, s); } setWidth(w) { this.w = w; this.h = w; } setHeight(h) { this.w = h; this.h = h; } }
  class IRect { constructor(w, h) { this.w = w; this.h = h; } withWidth(w) { return new IRect(w, this.h); } withHeight(h) { return new IRect(this.w, h); } area() { return this.w * this.h; } }
  class ISq { constructor(s) { this.w = s; this.h = s; } withSide(s) { return new ISq(s); } area() { return this.w * this.h; } }
  const DESIGNS = ["Square extends Rectangle (mutable)", "Square and Rectangle both implement Shape"];
  Viz.register("design-principles-lsp", (el) => Viz.player(el, {
    title: "Liskov substitution: does Square pass Rectangle's tests?",
    legend: [["visit", "Rectangle"], ["path", "Square"], ["done", "contract holds"], ["bad", "contract broken"]],
    codeLang: "java",
    code: [
      "void resize(Rectangle r) {",
      "    r.setWidth(W);",
      "    r.setHeight(H);",
      "    assert r.area() == W * H;",
      "}",
      "// Square overrides both setters:",
      "// setHeight(h) { w = h; this.h = h; }",
      "// fix: Shape { area() }, immutable",
    ],
    inputs: [
      { key: "w", label: "W", value: "5", width: 60 },
      { key: "h", label: "H", value: "3", width: 60 },
      { key: "design", label: "design", type: "select", options: DESIGNS, value: DESIGNS[0] },
    ],
    random: () => ({ w: String(Viz.rand(1, 9)), h: String(Viz.rand(1, 9)), design: DESIGNS[Viz.rand(0, 1)] }),
    build: ({ w, h, design }) => {
      const W = num(w, "W", 1, 10), H = num(h, "H", 1, 10);
      if (!DESIGNS.includes(design)) throw new Error("Pick a design from the list.");
      const frames = [], results = [];
      const push = (o) => frames.push({ W, H, results: results.map((r) => ({ ...r })), ...o });
      if (design === DESIGNS[0]) {
        push({ line: 0, vars: { W, H }, note: `Rectangle's documented contract: after <code>setWidth(w)</code> the width is w <b>and the height is unchanged</b>. <code>resize</code> is written against that contract. Will every subclass honour it?` });
        for (const [kind, obj] of [["Rectangle", new Rect(2, 2)], ["Square", new Sq(2)]]) {
          obj.setWidth(W);
          push({ kind, shape: { w: obj.w, h: obj.h }, line: 1, vars: { object: kind, width: obj.w, height: obj.h }, note: `${kind}: <code>setWidth(${W})</code> → ${obj.w} × ${obj.h}.${kind === "Square" ? ` Square keeps itself square, so the <b>height silently became ${obj.h}</b>.` : ""}` });
          obj.setHeight(H);
          const ok = obj.area() === W * H;
          push({ kind, shape: { w: obj.w, h: obj.h }, line: 2, vars: { object: kind, width: obj.w, height: obj.h }, note: `${kind}: <code>setHeight(${H})</code> → ${obj.w} × ${obj.h}.${kind === "Square" && W !== H ? ` The width it was given a moment ago is gone.` : ""}` });
          results.push({ kind, test: `resize: area == ${W * H}`, ok, got: obj.area() });
          const keep = (() => { const o = kind === "Square" ? new Sq(2) : new Rect(2, 2); o.setHeight(H); o.setWidth(W); return o.h === H; })();
          results.push({ kind, test: `setWidth keeps height ${H}`, ok: keep, got: keep ? "yes" : "no" });
          push({ kind, shape: { w: obj.w, h: obj.h }, check: ok, line: 3, vars: { object: kind, "area()": obj.area(), expected: W * H, result: ok ? "pass" : "FAIL" },
            note: ok
              ? `${kind}: area ${obj.area()} = ${W} × ${H}. <b>Pass.</b>${kind === "Square" ? ` Only because W = H. A test suite that uses squares-only data <b>hides</b> the bug. Try W ≠ H.` : ""}`
              : `${kind}: area is <b>${obj.area()}</b>, expected ${W * H}. <b>Square is not substitutable for Rectangle.</b> It compiles, the "is-a" sounds right, and the caller's code breaks at run time.` });
        }
        const broken = results.filter((r) => !r.ok).length;
        const last = frames[frames.length - 1];
        push({ kind: last.kind, shape: last.shape, check: last.check, line: [5, 6], vars: { tests: results.length, failing: broken }, note: broken
          ? `<b>${broken} contract test${broken === 1 ? "" : "s"} fail for Square.</b> LSP is about <b>behaviour</b>, not taxonomy: a subtype may not strengthen preconditions or weaken postconditions ("height unchanged"). Inheritance is the wrong tool here.`
          : `All tests passed because W = H. Change W or H and run again: the contract only breaks when the sides differ.` });
      } else {
        push({ line: 7, vars: { W, H }, note: `Fix: there is no mutable "is-a" between them. Both implement <code>Shape { area() }</code> and are <b>immutable</b>: <code>withWidth</code> returns a new Rectangle, Square only has <code>withSide</code>.` });
        const r = new IRect(2, 2).withWidth(W).withHeight(H);
        results.push({ kind: "Rectangle", test: `resize: area == ${W * H}`, ok: r.area() === W * H, got: r.area() });
        push({ kind: "Rectangle", shape: { w: r.w, h: r.h }, check: true, line: [1, 2, 3], vars: { object: "Rectangle", width: r.w, height: r.h, "area()": r.area() }, note: `Rectangle: <code>r.withWidth(${W}).withHeight(${H})</code> → ${r.w} × ${r.h}, area ${r.area()}. <b>Pass.</b>` });
        results.push({ kind: "Square", test: "resize(square)", ok: true, got: "won't compile" });
        push({ kind: "Square", shape: { w: 2, h: 2 }, refused: true, line: 0, vars: { object: "Square", "resize(sq)": "compile error" }, note: `Square: <code>resize(square)</code> <b>does not compile</b>: Square is not a Rectangle. The mistake is caught by the type checker instead of in production.` });
        for (const [kind, o] of [["Rectangle", new IRect(W, H)], ["Square", new ISq(W)]]) results.push({ kind, test: "Shape: area ≥ 0", ok: o.area() >= 0, got: o.area() });
        const sq = new ISq(W);
        push({ kind: "Square", shape: { w: sq.w, h: sq.h }, check: true, line: 7, vars: { tests: results.length, failing: 0 }, note: `Every client that only needs <code>area()</code> takes a <b>Shape</b> and works with both. Each type keeps its own invariant (a square stays square). <b>All contract tests pass.</b>` });
      }
      return frames;
    },
    render: (f) => {
      const Wd = 560, Hd = 210, u = 15, ox = 24, oy = 22;
      let s = `<svg class="dp-svg" viewBox="0 0 ${Wd} ${Hd}" width="${Wd}" role="img" aria-label="The shape after each call and the contract test results">`;
      for (let i = 0; i <= 10; i++) s += `<line class="dp-grid" x1="${ox + i * u}" y1="${oy}" x2="${ox + i * u}" y2="${oy + 10 * u}"/><line class="dp-grid" x1="${ox}" y1="${oy + i * u}" x2="${ox + 10 * u}" y2="${oy + i * u}"/>`;
      s += `<rect class="dp-target" x="${ox}" y="${oy}" width="${f.W * u}" height="${f.H * u}"/><text class="lbl" x="${ox}" y="${oy + 10 * u + 16}">dashed: the ${f.W} × ${f.H} the caller asked for</text>`;
      if (f.shape) {
        const cls = f.refused ? "done" : f.check === false ? "bad" : f.kind === "Square" ? "path" : "visit";
        s += `<rect class="dp-shape ${cls}" x="${ox}" y="${oy}" width="${f.shape.w * u}" height="${f.shape.h * u}"/><text class="b" x="${ox + 6}" y="${oy + 15}">${f.kind} ${f.shape.w}×${f.shape.h}</text>`;
        if (f.refused) s += `<text class="dp-t-done b" x="${ox + 6}" y="${oy + 52}">resize(square)</text><text class="dp-t-done b" x="${ox + 6}" y="${oy + 66}">→ compile error</text>`;
      }
      const tx = 210;
      s += `<text class="lbl b" x="${tx}" y="16">contract tests</text>`;
      f.results.forEach((r, i) => {
        const y = 32 + i * 26;
        s += `<g class="dp-test ${r.ok ? "ok" : "fail"}"><rect x="${tx}" y="${y}" width="${Wd - tx - 4}" height="22" rx="5"/><text x="${tx + 8}" y="${y + 15}" class="b">${r.ok ? "✓" : "✗"}</text><text x="${tx + 24}" y="${y + 15}">${esc(r.kind)} · ${esc(r.test)}</text><text x="${Wd - 12}" y="${y + 15}" text-anchor="end" class="mono">${esc(r.got)}</text></g>`;
      });
      return s + "</svg>";
    },
  }));

  /* =====================================================================
   * 5. DRY, the rule of three and the wrong abstraction
   * ===================================================================== */
  const parseReqs = (s, n) => {
    const out = String(s).split(",").map((x) => x.trim()).filter(Boolean).map((tok) => {
      const m = tok.match(/^([A-Ea-e])\s*:\s*([A-Za-z][A-Za-z0-9]{0,11})$/);
      if (!m) throw new Error(`"${tok}" should look like "B:noHeader" (caller letter, then a flag name).`);
      const c = m[1].toUpperCase();
      if (c.charCodeAt(0) - 65 >= n) throw new Error(`Caller ${c} does not exist with ${n} callers.`);
      return { caller: c, flag: m[2] };
    });
    if (out.length < 1 || out.length > 7) throw new Error("Give 1 to 7 requirements.");
    const flags = out.map((r) => r.flag);
    if (new Set(flags).size !== flags.length) throw new Error("Each requirement needs a different flag name.");
    return out;
  };
  Viz.register("design-principles-wrong-abstraction", (el) => Viz.player(el, {
    title: "DRY gone wrong: one shared function, one flag per new requirement",
    legend: [["visit", "shared code"], ["active", "newest flag / branch"], ["bad", "paths nobody uses"], ["done", "inlined, caller-owned code"]],
    codeLang: "python",
    code: [
      "copies = [a, b]          # WET: fine",
      "shared = extract(a, b, c) # rule of 3",
      "for req in requirements:",
      "    shared.params += [req.flag]",
      "    shared.branches += 1",
      "    retest(all callers of shared)",
      "paths = 2 ** len(shared.params)",
      "if paths >> callers: inline it back",
    ],
    inputs: [
      { key: "callers", label: "callers", value: "3", width: 70 },
      { key: "reqs", label: "requirements (caller:flag)", value: "A:pdf, B:noHeader, A:watermark, C:emailCopy, B:euroDates", width: 420 },
    ],
    random: () => {
      const n = Viz.rand(3, 5), F = ["pdf", "noHeader", "watermark", "emailCopy", "euroDates", "gzip", "utf16", "sortDesc"];
      const k = Viz.rand(2, 6), picks = [...F].sort(() => Math.random() - 0.5).slice(0, k);
      return { callers: String(n), reqs: picks.map((f) => `${String.fromCharCode(65 + Viz.rand(0, n - 1))}:${f}`).join(", ") };
    },
    build: ({ callers, reqs }) => {
      const n = num(callers, "callers", 3, 5), R = parseReqs(reqs, n);
      const C = [...Array(n)].map((_, i) => String.fromCharCode(65 + i));
      const frames = [], base = (o) => ({ n, C, flags: [], uses: Object.fromEntries(C.map((c) => [c, []])), ...o });
      frames.push(base({ stage: "copies", copies: 1, line: 0, vars: { copies: 1 }, note: `Caller <b>A</b> needs a CSV export. Write it inline. One copy is not duplication.` }));
      frames.push(base({ stage: "copies", copies: 2, line: 0, vars: { copies: 2 }, note: `Caller <b>B</b> needs nearly the same thing. <b>WET</b> ("write everything twice") is fine here: with two examples you cannot yet tell what really varies.` }));
      frames.push(base({ stage: "shared", copies: 3, line: 1, vars: { copies: 3, params: 1, branches: 0, paths: 1 }, note: `A third copy for <b>C</b>: <b>rule of three</b>. The copies agree, so extract <code>export(rows)</code>. DRY is about one <b>piece of knowledge</b> in one place, and right now this is one.` }));
      const flags = [], uses = Object.fromEntries(C.map((c) => [c, []]));
      R.forEach((r, i) => {
        flags.push(r.flag); uses[r.caller].push(r.flag);
        const paths = 2 ** flags.length, used = new Set(C.map((c) => uses[c].join("+"))).size;
        frames.push(base({ stage: "shared", flags: [...flags], uses: JSON.parse(JSON.stringify(uses)), newest: r.flag, line: [3, 4, 5, 6],
          vars: { requirement: `${r.caller} wants ${r.flag}`, params: flags.length + 1, branches: flags.length, "possible paths": paths, "used paths": used, "callers to retest": n },
          note: `${r.caller} wants <b>${esc(r.flag)}</b>. Nobody else does, but the code lives in the shared function, so it gains a parameter and an <code>if</code>. All <b>${n}</b> callers must be re-tested.${paths > 2 * used ? ` <b>${paths}</b> flag combinations exist; only <b>${used}</b> are ever used.` : ""}` }));
      });
      const paths = 2 ** flags.length, used = new Set(C.map((c) => uses[c].join("+"))).size;
      frames.push(base({ stage: "inlined", flags, uses, line: 7, vars: { "shared paths": paths, "used paths": used, "per-caller branches": C.map((c) => uses[c].length).join(" / "), "callers to retest": 1 },
        note: `This is <b>the wrong abstraction</b>: the callers' needs diverged, and the shared function became a tangle of flags. Sandi Metz's advice: <b>inline it back</b> into each caller, delete what that caller does not use, then look again for the real shared part (often just <code>write_csv_row</code>). Duplication is far cheaper than the wrong abstraction.` }));
      return frames;
    },
    render: (f) => {
      const code = (lines) => `<pre class="dp-code">${lines.join("\n")}</pre>`;
      if (f.stage === "copies") {
        return `<div class="dp-col"><div class="dp-callers">${f.C.slice(0, f.copies).map((c) => `<div class="dp-caller visit"><b>caller ${c}</b>${code(["rows → csv", "header + lines", "write file"])}</div>`).join("")}</div><div class="dp-meter"><span>copies</span><b>${f.copies}</b><em>${f.copies < 3 ? "wait for a third example" : ""}</em></div></div>`;
      }
      if (f.stage === "shared") {
        const sig = `def export(rows${f.flags.map((x) => `, ${x}=False`).join("")}):`;
        const body = [esc(sig), "    out = to_csv(rows)", ...f.flags.map((x) => `<span class="${x === f.newest ? "dp-new" : ""}">    if ${esc(x)}: out = ${esc(x)}_step(out)</span>`), "    return out"];
        const paths = 2 ** f.flags.length, used = new Set(f.C.map((c) => f.uses[c].join("+"))).size;
        const cells = Math.min(paths, 64), cellHtml = [...Array(cells)].map((_, i) => `<i class="${i < used ? "used" : "dead"}"></i>`).join("");
        return `<div class="dp-col"><div class="dp-shared">${code(body)}</div><div class="dp-callers">${f.C.map((c) => `<div class="dp-caller"><b>caller ${c}</b><code>export(rows${f.uses[c].map((x) => `, ${esc(x)}=True`).join("")})</code></div>`).join("")}</div><div class="dp-paths"><span>${paths} possible paths · ${used} used</span><div>${cellHtml}${paths > cells ? `<em>+${paths - cells}</em>` : ""}</div></div></div>`;
      }
      return `<div class="dp-col"><div class="dp-callers">${f.C.map((c) => `<div class="dp-caller done"><b>caller ${c}</b>${code(["rows → csv", ...f.uses[c].map((x) => `${esc(x)} step`), "write file"])}<span class="dp-cx">branches: ${f.uses[c].length}</span></div>`).join("")}</div><div class="dp-meter"><span>a change to one caller touches</span><b class="ok">1</b><em>file, and needs 1 retest</em></div></div>`;
    },
  }));

  /* =====================================================================
   * 6. Fragile base class: InstrumentedHashSet, inheritance vs composition
   * ===================================================================== */
  const BASES = ["v1: addAll() calls add() per item", "v2: addAll() inserts directly"];
  const STYLES = ["inheritance (extends HashSet)", "composition (wraps a Set)"];
  Viz.register("design-principles-fragile-base", (el) => Viz.player(el, {
    title: "Fragile base class: same subclass, new library version, wrong answer",
    legend: [["visit", "call"], ["active", "counter changes"], ["bad", "self-call dispatched back into your subclass"], ["done", "correct count"]],
    codeLang: "java",
    code: [
      "// Counting extends HashSet<E>",
      "add(e):    added++; super.add(e)",
      "addAll(c): added += c.size()",
      "           super.addAll(c)",
      "// Counting wraps a Set<E> inner",
      "add(e):    added++; inner.add(e)",
      "addAll(c): added += c.size()",
      "           inner.addAll(c)",
      "// library HashSet.addAll, version 1:",
      "for (E e : c) this.add(e) // self-call",
    ],
    inputs: [
      { key: "items", label: "addAll(items)", value: "a, b, c", width: 120 },
      { key: "base", label: "library version", type: "select", options: BASES, value: BASES[0] },
      { key: "style", label: "your class uses", type: "select", options: STYLES, value: STYLES[0] },
    ],
    random: () => ({ items: ["a, b", "a, b, c", "x, y, z, w", "p, q, r, s, t"][Viz.rand(0, 3)], base: BASES[Viz.rand(0, 1)], style: STYLES[Viz.rand(0, 1)] }),
    build: ({ items, base, style }) => {
      const xs = String(items).split(",").map((x) => x.trim()).filter(Boolean);
      if (!xs.length || xs.length > 5) throw new Error("Give 1 to 5 items, e.g. a, b, c");
      if (xs.some((x) => x.length > 6)) throw new Error("Keep each item to 6 characters.");
      if (!BASES.includes(base) || !STYLES.includes(style)) throw new Error("Pick options from the lists.");
      const inherit = style === STYLES[0], v1 = base === BASES[0];
      /* A tiny object model with virtual dispatch: `self` is the most-derived object. */
      const calls = [], set = new Set();
      let added = 0;
      const lib = {
        add: (self, e) => { calls.push({ from: 1, to: 2, label: `HashSet.add(${e})`, line: inherit ? 1 : 5, kind: "visit" }); set.add(e); return true; },
        addAll: (self, c) => {
          for (const e of c) {
            if (v1) {
              if (inherit) { calls.push({ from: 2, to: 1, label: `this.add(${e})`, line: 9, kind: "bad", note: "self" }); self.add(e); }
              else { calls.push({ from: 2, to: 2, label: `this.add(${e})`, line: 9, kind: "visit" }); set.add(e); }
            } else set.add(e);
          }
          if (!v1) calls.push({ from: 2, to: 2, label: `insert ${c.length} items`, line: inherit ? 3 : 7, kind: "visit" });
          return true;
        },
      };
      const counting = {
        add(e) { added++; calls.push({ from: 1, to: 1, label: `added++ → ${added}`, line: inherit ? 1 : 5, kind: "active", added }); return lib.add(this, e); },
        addAll(c) {
          added += c.length; calls.push({ from: 1, to: 1, label: `added += ${c.length} → ${added}`, line: inherit ? 2 : 6, kind: "active", added });
          calls.push({ from: 1, to: 2, label: `${inherit ? "super" : "inner"}.addAll(c)`, line: inherit ? 3 : 7, kind: "visit" });
          return lib.addAll(inherit ? this : null, c);
        },
      };
      calls.push({ from: 0, to: 1, label: `addAll([${xs.join(", ")}])`, line: inherit ? 2 : 6, kind: "visit" });
      counting.addAll(xs);
      const frames = [];
      let cnt = 0;
      frames.push({ calls: [], k: 0, added: 0, inherit, xs, line: inherit ? 0 : 4, vars: { library: v1 ? "v1" : "v2", style: inherit ? "inheritance" : "composition", added: 0 },
        note: `A <b>Counting</b> set wants to know how many items were ever added. ${inherit ? "It <b>extends</b> the library's HashSet and overrides <code>add</code> and <code>addAll</code>." : "It <b>wraps</b> a Set it was given and forwards every call to it."} The library is <b>${v1 ? "version 1" : "version 2"}</b>.` });
      calls.forEach((c, i) => {
        if (c.added !== undefined) cnt = c.added;
        frames.push({ calls, k: i + 1, added: cnt, inherit, xs, line: c.line, vars: { call: c.label, added: cnt, expected: xs.length },
          note: c.note === "self"
            ? `The library's <code>addAll</code> calls <code>this.add(e)</code>. Because of <b>virtual dispatch</b>, <code>this</code> is your subclass, so <b>your</b> <code>add</code> runs and counts the item <b>again</b>. You never saw this call in the library's public API.`
            : c.kind === "active" ? `Counter: <b>${cnt}</b>.` : `Call: <code>${esc(c.label)}</code>.` });
      });
      const ok = added === xs.length;
      frames.push({ calls, k: calls.length, added, inherit, xs, final: ok ? "ok" : "bad", line: inherit ? (v1 ? 9 : 3) : 7, vars: { added, expected: xs.length, set_size: set.size, verdict: ok ? "correct" : "WRONG" },
        note: ok
          ? inherit
            ? `<b>${added}</b>: correct. But only by luck: the subclass depends on <b>how</b> HashSet implements <code>addAll</code>. Switch the library to version 1 (a legal internal change) and the count doubles without you changing a line.`
            : `<b>${added}</b>: correct with <b>either</b> library version. The wrapper only depends on the Set <b>interface</b>; the inner set's self-calls stay inside it. That is composition over inheritance.`
          : `<b>${added}</b> instead of ${xs.length}: every item was counted twice. Your code is correct against HashSet's <b>documented API</b>; it broke on an <b>undocumented self-call</b>, an implementation detail that any library upgrade may add or remove. This is the fragile base class problem (Effective Java, Item 18). Switch to composition and re-run.` });
      return frames;
    },
    render: (f) => {
      const W = 560, lx = [84, 268, 462], top = 46, rh = 22, shown = f.calls.slice(0, f.k), H = top + Math.max(5, f.calls.length) * rh + 20;
      const names = ["client", f.inherit ? "Counting (subclass)" : "Counting (wrapper)", f.inherit ? "HashSet (base, same object)" : "inner HashSet"];
      let s = `<svg class="dp-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Sequence of calls">`;
      if (f.inherit) s += `<rect class="dp-obj" x="${lx[1] - 90}" y="6" width="${lx[2] - lx[1] + 180}" height="${H - 10}" rx="10"/><text class="lbl" x="${lx[2] + 84}" y="${H - 10}" text-anchor="end">one object: this = Counting</text>`;
      names.forEach((n, i) => { s += `<rect class="dp-life-h" x="${lx[i] - 80}" y="14" width="160" height="22" rx="5"/><text x="${lx[i]}" y="29" text-anchor="middle" class="b">${esc(n)}</text><line class="dp-life" x1="${lx[i]}" y1="36" x2="${lx[i]}" y2="${H - 6}"/>`; });
      shown.forEach((c, i) => {
        const y = top + i * rh + 8, cur = i === shown.length - 1, cls = c.kind + (cur ? " cur" : "");
        if (c.from === c.to) s += `<path class="dp-e ${cls}" d="M${lx[c.from]},${y - 4} h26 v10 h-20"/><polygon class="dp-ah ${cls}" points="${lx[c.from] + 2},${y + 6} ${lx[c.from] + 10},${y + 2} ${lx[c.from] + 10},${y + 10}"/><text class="dp-call ${cls}" x="${lx[c.from] + 32}" y="${y + 5}">${esc(c.label)}</text>`;
        else {
          const x1 = lx[c.from], x2 = lx[c.to], dir = Math.sign(x2 - x1);
          s += arrow(x1, y, x2 - dir * 2, y, cls) + `<text class="dp-call ${cls}" x="${(x1 + x2) / 2}" y="${y - 4}" text-anchor="middle">${esc(c.label)}</text>`;
        }
      });
      s += "</svg>";
      return `<div class="dp-col">${s}<div class="dp-meter"><span>added</span><b class="${f.final === "bad" ? "bad" : f.final === "ok" ? "ok" : ""}">${f.added}</b><em>expected ${f.xs.length}</em></div></div>`;
    },
  }));
})();
