/* Anti-patterns visualizers. Every registered name is prefixed "anti-patterns-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const STATES = new Set(["active", "visit", "done", "bad", "path", "accent"]);

  /* ---------- shared drawing helpers (inline SVG using the svg.dg vocabulary) ---------- */
  const svg = (w, h, body, label, cls = "") => `<svg class="dg ap-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const box = (x, y, w, h, cls, title, sub, o = {}) => {
    let s = `<rect class="box ${cls || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 8}"${o.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
    const cx = x + w / 2;
    if (sub) {
      s += `<text class="ap-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle">${esc(title)}</text>`;
      s += `<text class="ap-s" x="${cx}" y="${y + h / 2 + 12}" text-anchor="middle">${esc(sub)}</text>`;
    } else s += `<text class="ap-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 + 4.5}" text-anchor="middle">${esc(title)}</text>`;
    return s;
  };
  const arrow = (x1, y1, x2, y2, cls = "", label = "", o = {}) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const first = String(cls).split(" ")[0];
    const fill = STATES.has(first) ? "fill-" + first : "muted";
    const p = `${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`;
    let s = `<path class="edge ${cls}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"${o.w ? ` style="stroke-width:${o.w}px"` : ""}/><polygon class="${fill}" points="${p}"/>`;
    if (label) {
      const lx = o.lx ?? (x1 + x2) / 2, ly = o.ly ?? (y1 + y2) / 2 - 6;
      s += `<text class="small ap-lbl" x="${lx}" y="${ly}" text-anchor="${o.anchor || "middle"}">${esc(label)}</text>`;
    }
    return s;
  };
  const txt = (x, y, t, cls = "small", anchor = "start") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  const stats = (items) => `<div class="ap-stats">${items.map(([l, v, c]) => `<div class="ap-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const codePanel = (lines, lang, cur = [], title = "") => `<div class="ap-codebox">${title ? `<div class="ap-kv-h">${esc(title)}</div>` : ""}<ol class="ap-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""}">${hl(l, lang) || "&nbsp;"}</li>`).join("")}</ol></div>`;
  const col = (...parts) => `<div class="ap-col">${parts.join("")}</div>`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const words = (s) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const NAME = /^[A-Za-z_][A-Za-z0-9_]{0,19}$/;
  const GROUP_CLS = ["ap-g0", "ap-g1", "ap-g2", "ap-g3"];
  const gcls = (c) => (c === undefined ? "" : GROUP_CLS[c % GROUP_CLS.length]);
  /* deterministic RNG so Monte Carlo runs are reproducible for the same inputs */
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };

  /* =====================================================================
   * 1. God object: which methods touch which fields? Union-find the groups.
   * ===================================================================== */
  function parseClassSpec(s) {
    const parts = String(s).split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 10) throw new Error("Describe 2 to 10 methods, separated by ;  (Method: field, field).");
    const methods = [], fields = [];
    for (const p of parts) {
      const m = p.match(/^([^:]+):(.*)$/);
      if (!m) throw new Error(`"${p}": write it as Method: field, field`);
      const name = m[1].trim();
      if (!NAME.test(name)) throw new Error(`"${name}" is not a valid method name.`);
      if (methods.some((x) => x.name === name)) throw new Error(`Method ${name} appears twice.`);
      const fs = [...new Set(m[2].split(",").map((x) => x.trim()).filter(Boolean))];
      for (const f of fs) { if (!NAME.test(f)) throw new Error(`"${f}" is not a valid field name.`); if (!fields.includes(f)) fields.push(f); }
      methods.push({ name, fs });
    }
    if (fields.length > 12) throw new Error("Use at most 12 distinct fields so the matrix stays readable.");
    return { methods, fields };
  }
  const GOD_PRESETS = [
    "PlaceOrder: cart, stock, prices; ApplyDiscount: cart, prices; ReserveStock: stock, warehouse; Charge: payments, ledger; Refund: payments, ledger; EmailReceipt: smtp, templates; RenderInvoicePdf: templates, pdf; WriteAudit: auditDb",
    "Register: users, hasher, mailer; Login: users, hasher, tokens; ResetPassword: users, mailer, tokens; ExportCsv: users, csv; ResizeAvatar: images, blobs; CropAvatar: images",
    "Add: items, total; Remove: items, total; Recalculate: items, total, coupon; ApplyCoupon: coupon, total; Clear: items, coupon, total",
    "Load: db, cache; Save: db, cache; Validate: rules; Notify: bus; Retry: policy, clock; Schedule: clock, jobs",
  ];
  Viz.register("anti-patterns-god", (el) => Viz.player(el, {
    title: "God object: find the classes hiding inside one class",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "method being added"], ["done", "group 1"], ["path", "group 2"], ["visit", "group 3"], ["accent", "group 4"]],
    inputs: [{ key: "spec", label: "methods and the fields each one uses  (Method: field, field; ...)", value: GOD_PRESETS[0], width: 820 }],
    random: () => ({ spec: pick(GOD_PRESETS) }),
    build: ({ spec }) => {
      const { methods, fields } = parseClassSpec(spec);
      const parent = new Map();
      const add = (k) => { if (!parent.has(k)) parent.set(k, k); };
      const find = (k) => { while (parent.get(k) !== k) { parent.set(k, parent.get(parent.get(k))); k = parent.get(k); } return k; };
      const union = (a, b) => { const ra = find(a), rb = find(b); if (ra !== rb) parent.set(rb, ra); };
      fields.forEach((f) => add("f:" + f));
      let done = 0;
      const groups = () => {
        const ids = new Map(), mC = {}, fC = {};
        for (const m of methods.slice(0, done)) { const r = find("m:" + m.name); if (!ids.has(r)) ids.set(r, ids.size); mC[m.name] = ids.get(r); }
        for (const f of fields) { const r = find("f:" + f); if (ids.has(r)) fC[f] = ids.get(r); }
        return { mC, fC, k: ids.size };
      };
      const snap = (o) => ({ methods, fields, done, ...groups(), ...o });
      const fr = [snap({ note: `${methods.length} methods share ${fields.length} fields. If two methods use a common field they belong together; the question is whether <b>every</b> method is connected to every other, directly or through a chain. (This is the LCOM4 cohesion metric.)` })];
      methods.forEach((m, i) => {
        add("m:" + m.name);
        const prevRoots = new Set(methods.slice(0, i).map((p) => find("m:" + p.name)));
        const touched = new Set(m.fs.map((f) => find("f:" + f)).filter((r) => prevRoots.has(r)));
        m.fs.forEach((f) => union("m:" + m.name, "f:" + f));
        done = i + 1;
        const note = !m.fs.length ? `<code>${esc(m.name)}</code> uses <b>no fields</b>. It could be a static helper, or it belongs somewhere else entirely.`
          : touched.size === 0 ? `<code>${esc(m.name)}</code> uses ${esc(m.fs.join(", "))}. None of those is used by an earlier method, so it <b>starts a new group</b>.`
          : touched.size === 1 ? `<code>${esc(m.name)}</code> uses ${esc(m.fs.join(", "))}, which an earlier group already uses, so it <b>joins that group</b>.`
          : `<code>${esc(m.name)}</code> touches fields from <b>${touched.size} groups</b> and merges them. Methods like this are the glue; check that the merge is real and not a convenience.`;
        fr.push(snap({ cur: i, note }));
      });
      const g = groups();
      const sizes = Array.from({ length: g.k }, (_, c) => methods.filter((m) => g.mC[m.name] === c).length);
      const pairs = methods.length * (methods.length - 1) / 2, inside = sizes.reduce((a, n) => a + n * (n - 1) / 2, 0);
      fr.push(snap({ end: true, pairs: pairs - inside, note: g.k === 1
        ? `LCOM4 = 1: every method is connected to every other through shared fields. By this measure the class has <b>one responsibility</b>. It may still be large, but splitting it would only scatter one concept.`
        : `LCOM4 = <b>${g.k}</b>: this is ${g.k} classes sharing one name. ${pairs - inside} of ${pairs} method pairs have nothing in common. Extract each group into its own class (the groups below) and let the old class delegate to them while callers migrate.` }));
      return fr;
    },
    render: (f) => {
      const head = `<tr><th>method</th>${f.fields.map((x) => `<th class="${gcls(f.fC[x])}">${esc(x)}</th>`).join("")}<th>group</th></tr>`;
      const rows = f.methods.map((m, i) => {
        const on = i < f.done, c = f.mC[m.name];
        return `<tr class="${i === f.cur ? "cur" : on ? "" : "ap-pending"}"><td class="ap-mname">${esc(m.name)}</td>${f.fields.map((x) => `<td class="${m.fs.includes(x) ? (on ? gcls(c) : "ap-use") : ""}">${m.fs.includes(x) ? "●" : ""}</td>`).join("")}<td class="${on ? gcls(c) : ""}">${on ? c + 1 : ""}</td></tr>`;
      }).join("");
      const tbl = `<div class="ap-scroll"><table class="ap-tbl ap-matrix">${head}${rows}</table></div>`;
      let cards = "";
      if (f.end) {
        cards = `<div class="ap-groups">${Array.from({ length: f.k }, (_, c) => {
          const ms = f.methods.filter((m) => f.mC[m.name] === c).map((m) => m.name), fs = f.fields.filter((x) => f.fC[x] === c);
          return `<div class="ap-grp ${gcls(c)}"><b>${f.k === 1 ? "one cohesive class" : `extract class ${c + 1}`}</b><div><span>fields</span> ${esc(fs.join(", ") || "none")}</div><div><span>methods</span> ${esc(ms.join(", "))}</div></div>`;
        }).join("")}</div>`;
      }
      return col(tbl, cards, stats([["methods", f.methods.length], ["fields (ctor deps)", f.fields.length, f.fields.length > 7 ? "warn" : ""], ["LCOM4 groups", f.k, f.k > 1 ? "warn" : f.done ? "ok" : ""], ...(f.end ? [["unrelated method pairs", f.pairs, f.pairs ? "warn" : "ok"]] : [])]));
    },
  }));

  /* =====================================================================
   * 2. Shotgun surgery: one business change, how many files?
   * ===================================================================== */
  const TIER_MODULES = [
    { file: "Pricing.cs", lang: "csharp", sc: 'case "Gold": return 0.10m;', co: "return price * (1 - tier.Discount);", bug: "Platinum falls through to the default case and pays full price." },
    { file: "Checkout.cs", lang: "csharp", sc: 'if (tier == "Gold" || tier == "Silver") free = true;', co: "free = tier.FreeShipping;", bug: "Platinum customers lose free shipping." },
    { file: "SignupRequest.cs", lang: "csharp", sc: '[RegularExpression("^(Bronze|Silver|Gold)$")]', co: "CustomerTier.TryParse(dto.Tier, out var t)", bug: "The API rejects Platinum sign-ups with 400 Bad Request." },
    { file: "TierPicker.tsx", lang: "typescript", sc: 'const tiers = ["Bronze", "Silver", "Gold"];', co: 'const tiers = await api.get("/tiers");', bug: "Admins can't select Platinum in the UI." },
    { file: "revenue.sql", lang: "sql", sc: "CASE tier WHEN 'GOLD' THEN 3 ELSE 1 END", co: "JOIN customer_tiers t ON t.code = c.tier", bug: "The revenue report puts Platinum in the ELSE bucket; finance sees wrong numbers for months." },
    { file: "Welcome.cs", lang: "csharp", sc: 'var tpl = $"welcome-{tier.ToLower()}.html";', co: "var tpl = tier.WelcomeTemplate;", bug: "welcome-platinum.html doesn't exist; Platinum sign-ups get no welcome email." },
    { file: "points.py", lang: "python", sc: 'POINTS = {"bronze": 1, "silver": 2, "gold": 3}', co: 'points = tiers[c.tier]["points"]  # from /tiers', bug: "KeyError: 'platinum' in the nightly points job." },
    { file: "AuditLog.cs", lang: "csharp", sc: 'log.Info($"tier changed to {tier}");', co: 'log.Info($"tier changed to {tier}");', none: true },
  ];
  const TIER_OWNER = { file: "CustomerTier.cs", lang: "csharp", co: 'Gold = new("Gold", 0.10m, true, 3, "welcome-gold.html");', owner: true };
  Viz.register("anti-patterns-shotgun", (el) => Viz.player(el, {
    title: "Shotgun surgery: add one customer tier, count the files",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "file being checked"], ["done", "found and edited"], ["bad", "needed a change, but was missed"], ["dim", "no change needed"]],
    inputs: [
      { key: "design", label: "design", type: "select", options: ["scattered: each file knows the tiers", "consolidated: one CustomerTier type"], value: "scattered: each file knows the tiers" },
      { key: "term", label: "developer searches for", value: "Gold", width: 150 },
      { key: "mcase", label: "search", type: "select", options: ["match case", "ignore case"], value: "match case" },
    ],
    random: () => ({ design: pick(["scattered: each file knows the tiers", "scattered: each file knows the tiers", "consolidated: one CustomerTier type"]), term: pick(["Gold", "gold", '"Gold"', "tier", "Silver"]), mcase: pick(["match case", "ignore case"]) }),
    build: ({ design, term, mcase }) => {
      const scattered = design.startsWith("scattered");
      const t = String(term).trim();
      if (!t || t.length > 20) throw new Error("Search for 1 to 20 characters.");
      const ci = mcase === "ignore case";
      const hit = (s) => (ci ? s.toLowerCase().includes(t.toLowerCase()) : s.includes(t));
      const mods = (scattered ? [] : [TIER_OWNER]).concat(TIER_MODULES).map((m) => ({ ...m, code: scattered ? m.sc : m.co, st: "" }));
      const fr = [];
      const snap = (o) => ({ scattered, t, mods: mods.map((m) => ({ ...m })), ...o });
      fr.push(snap({ note: scattered ? `Product asks for a <b>Platinum</b> tier. The tier rules live in ${TIER_MODULES.length - 1} different files, in four languages. The developer searches for <code>${esc(t)}</code> (${ci ? "ignoring" : "matching"} case) to find them.` : "Product asks for a <b>Platinum</b> tier. Everything a tier means (discount, shipping, points, template) lives in <b>one type</b>. Every other file asks the tier instead of knowing the list." }));
      mods.forEach((m, i) => {
        if (scattered) {
          const found = hit(m.code);
          m.st = m.none ? (found ? "seen" : "none") : found ? "edit" : "miss";
          fr.push(snap({ cur: i, note: m.none ? `<code>${esc(m.file)}</code> ${found ? "matches the search, but" : ""} works for any tier. No change.` : found ? `<code>${esc(m.file)}</code> matches <code>${esc(t)}</code>. Edit it to add Platinum.` : `<code>${esc(m.file)}</code> <b>does not match</b> <code>${esc(t)}</code>, so the developer never opens it. It still needs a change.` }));
        } else {
          m.st = m.owner ? "edit" : "none";
          fr.push(snap({ cur: i, note: m.owner ? "Add one line: <code>Platinum = new(\"Platinum\", 0.15m, true, 4, \"welcome-platinum.html\")</code>. The compiler checks every field is supplied." : `<code>${esc(m.file)}</code> asks the tier object (<code>${esc(m.code.split("=").pop().trim().slice(0, 40))}</code>). Nothing to change.` }));
        }
      });
      const missed = mods.filter((m) => m.st === "miss");
      fr.push(snap({ end: true, note: missed.length ? `Shipped with <b>${missed.length} missed file(s)</b>: ${missed.map((m) => `${esc(m.bug)}`).join(" ")} Each one is found by a customer, not by the compiler.` : scattered ? `This search happened to find every copy, but that took ${mods.filter((m) => m.st === "edit").length} edits in 4 languages and luck. Try searching for <code>"Gold"</code> or matching case.` : "One file edited, nothing missed. The compiler and the single source of truth did the searching for you." }));
      return fr;
    },
    render: (f) => {
      const n = f.mods.length, W = 270, H = 48, gy = 10, cw = 250, ax = 170;
      const width = 10 + cw + ax + W + 10, height = Math.max(n * (H + gy) - gy + 20, 80);
      const fx = width - W - 10, my = height / 2;
      let b = box(10, my - 30, cw, 60, "accent", "Change: add a Platinum tier", f.scattered ? "knowledge copied into many files" : "one owner of tier knowledge");
      f.mods.forEach((m, i) => {
        const y = 10 + i * (H + gy);
        const shown = i < (f.cur ?? -1) || f.end || i === f.cur;
        const st = !shown ? "" : i === f.cur && !f.end ? "active" : m.st === "edit" ? "done" : m.st === "miss" ? (f.end ? "bad" : "") : "dim";
        const sub = !shown ? "not checked yet" : m.st === "edit" ? (m.owner ? "edited (the owner)" : "found → edited") : m.st === "miss" ? (f.end ? "MISSED → bug in prod" : "not found by the search") : "no change needed";
        if (shown && (m.st === "edit" || (m.st === "miss" && f.end))) b += arrow(10 + cw, my, fx - 2, y + H / 2, m.st === "edit" ? "done" : "bad dash");
        b += box(fx, y, W, H, st, m.file, sub, { mono: true, dash: m.st === "miss" && f.end });
      });
      const cur = f.mods[f.cur];
      const edits = f.mods.filter((m, i) => m.st === "edit" && (i <= (f.cur ?? -1) || f.end)).length;
      const misses = f.mods.filter((m, i) => m.st === "miss" && (i <= (f.cur ?? -1) || f.end)).length;
      return col(svg(width, height, b, "Change ripple across files"), cur ? codePanel([cur.code], cur.lang, f.scattered && cur.st === "edit" ? [0] : [], cur.file) : "",
        stats([["files edited", edits, edits > 2 ? "warn" : "ok"], ["languages touched", new Set(f.mods.filter((m) => m.st === "edit").map((m) => m.lang)).size], ["missed (future bugs)", misses, misses ? "warn" : "ok"]]));
    },
  }));

  /* =====================================================================
   * 3. Feature envy: whose data does this method really use?
   * ===================================================================== */
  Viz.register("anti-patterns-envy", (el) => Viz.player(el, {
    title: "Feature envy: count whose data a method reads",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "access being counted"], ["bad", "the class this method envies"], ["accent", "the method's own class"]],
    inputs: [
      { key: "host", label: "method lives in", value: "InvoiceService", width: 150 },
      { key: "method", label: "method", value: "LoyaltyDiscount", width: 150 },
      { key: "acc", label: "member accesses in the body, in order", value: "customer.Tier, customer.YearsActive, order.Total, customer.IsEmployee, this.rates, customer.Country, order.Total", width: 560 },
    ],
    random: () => pick([
      { host: "InvoiceService", method: "LoyaltyDiscount", acc: "customer.Tier, customer.YearsActive, order.Total, customer.IsEmployee, this.rates, customer.Country, order.Total" },
      { host: "ShippingCalculator", method: "Cost", acc: "this.zones, this.rates, parcel.Weight, this.zones, address.Country, this.surcharge" },
      { host: "ReportBuilder", method: "FullAddress", acc: "address.Street, address.Number, address.City, address.Zip, address.Country, this.format" },
      { host: "OrderController", method: "CanShip", acc: "order.Status, order.Lines, order.Paid, stock.Has, order.Lines, order.Address" },
    ]),
    build: ({ host, method, acc }) => {
      if (!NAME.test(host.trim()) || !NAME.test(method.trim())) throw new Error("Class and method names must be identifiers.");
      const toks = words(acc);
      if (toks.length < 2 || toks.length > 12) throw new Error("List 2 to 12 accesses like customer.Tier or this.rates.");
      const parsed = toks.map((t) => { const m = t.match(/^([A-Za-z_]\w{0,15})\.([A-Za-z_]\w{0,19})$/); if (!m) throw new Error(`"${t}": write object.member, for example customer.Tier or this.rates.`); return { obj: m[1], mem: m[2], tok: t }; });
      const objs = [...new Set(parsed.map((p) => p.obj).filter((o) => o !== "this"))];
      if (objs.length > 5) throw new Error("Use at most 5 different objects besides this.");
      const count = Object.fromEntries([["this", 0], ...objs.map((o) => [o, 0])]);
      const code = [`decimal ${method.trim()}(${objs.map((o) => `${cap(o)} ${o}`).join(", ")})`, "{", ...parsed.map((p, i) => {
        const prev = parsed.slice(0, i);
        if (prev.some((q) => q.tok === p.tok)) return `    Use(${p.tok}); // read again`;
        const v = prev.some((q) => q.mem === p.mem) ? p.obj + cap(p.mem) : p.mem.charAt(0).toLowerCase() + p.mem.slice(1);
        return `    var ${v} = ${p.tok};`;
      }), "    // ... combine them ...", "}"];
      const fr = [];
      const snap = (o) => ({ host: host.trim(), method: method.trim(), objs, count: { ...count }, code, ...o });
      fr.push(snap({ line: [0], note: `<code>${esc(method)}</code> lives in <code>${esc(host)}</code>. Count every member it reads, and whose member it is. Behaviour usually belongs next to the data it uses most.` }));
      parsed.forEach((p, i) => {
        count[p.obj]++;
        fr.push(snap({ line: [i + 2], cur: p.obj, note: `<code>${esc(p.tok)}</code>: ${p.obj === "this" ? `own state of ${esc(host)}` : `data owned by <b>${esc(cap(p.obj))}</b>`}. Count for ${esc(p.obj)} is now ${count[p.obj]}.` }));
      });
      const own = count.this, ranked = objs.slice().sort((a, b) => count[b] - count[a]);
      const top = ranked[0], envious = top !== undefined && count[top] > own && count[top] >= 2;
      const second = ranked[1], split = envious && second !== undefined && count[second] > own && count[second] >= 2;
      const note = !envious ? `No envy: the method uses its own class's data at least as much as anyone else's (${own} own vs ${top ? count[top] : 0} for ${esc(top || "others")}). Leave it where it is.`
        : split ? `<b>Envy of ${esc(cap(top))}</b> (${count[top]} reads) and ${esc(cap(second))} (${count[second]}) against ${own} of its own. Move the ${esc(top)} part to <code>${esc(cap(top))}</code> as a method and pass the result in; keep only the coordination here.`
        : `<b>Envy of ${esc(cap(top))}</b>: ${count[top]} reads of its data against ${own} of its own. Move the method (or the part that reads ${esc(top)}) to <code>${esc(cap(top))}</code>; callers then ask <code>${esc(top)}.${esc(method)}(...)</code> instead of pulling its fields out.`;
      fr.push(snap({ end: true, top: envious ? top : null, line: [], note }));
      return fr;
    },
    render: (f) => {
      const n = f.objs.length, rowH = 62, H = Math.max(170, n * rowH + 30), W = 700;
      const hy = H / 2;
      let b = `<rect class="box accent" x="10" y="${hy - 62}" width="250" height="124" rx="10"/>` + txt(135, hy - 40, f.host, "ap-t", "middle");
      b += box(40, hy - 26, 190, 44, f.cur === "this" ? "active" : "", f.method + "()", `own state read ${f.count.this}×`, { mono: true });
      const max = Math.max(1, ...f.objs.map((o) => f.count[o]));
      f.objs.forEach((o, i) => {
        const y = 15 + i * rowH + (H - 30 - n * rowH) / 2 + 15, c = f.count[o];
        const cls = f.cur === o ? "active" : f.top === o ? "bad" : c ? "visit" : "";
        b += box(470, y, 210, 44, cls, cap(o), `${c} member read${c === 1 ? "" : "s"}`, { mono: true });
        if (c) b += arrow(232, hy - 4, 466, y + 22, cls === "visit" ? "" : cls, `${c}×`, { w: 1.2 + 2.4 * c / max, lx: 350, ly: (hy - 4 + y + 22) / 2 - 7 });
      });
      return col(svg(W, H, b, "Method and the classes whose data it reads"), codePanel(f.code, "csharp", f.line, `${f.host}.cs`),
        stats([["own reads", f.count.this], ...f.objs.map((o) => [`${o} reads`, f.count[o], f.top === o ? "warn" : ""])]));
    },
  }));

  /* =====================================================================
   * 4. Global state: two tests share a static, the schedule decides who fails
   * ===================================================================== */
  const GT = { A: { rate: 0.2, exp: 120 }, B: { rate: 0, exp: 100 } };
  function runSchedule(seq, global) {
    let G = 0.1;
    const st = { A: { k: 0, cfg: null, price: null, res: null }, B: { k: 0, cfg: null, price: null, res: null } };
    const steps = [];
    for (const who of seq) {
      const T = st[who], k = T.k++;
      let op;
      if (k === 0) { if (global) G = GT[who].rate; else T.cfg = GT[who].rate; op = `Rate = ${GT[who].rate.toFixed(2)}`; }
      else if (k === 1) { const r = global ? G : T.cfg; T.price = Math.round(100 * (1 + r)); op = `price = ${T.price}`; }
      else { T.res = T.price === GT[who].exp; op = `assert ${GT[who].exp} ${T.res ? "✓" : "✗"}`; }
      steps.push({ who, k, op, G, A: { ...st.A }, B: { ...st.B } });
    }
    return { steps, A: st.A.res, B: st.B.res };
  }
  const ALL_SCHED = (() => { const out = []; const rec = (s, a, b) => { if (a === 3 && b === 3) return out.push(s); if (a < 3) rec(s + "A", a + 1, b); if (b < 3) rec(s + "B", a, b + 1); }; rec("", 0, 0); return out; })();
  const GLOBAL_CODE = {
    g: ["static class TaxConfig { public static decimal Rate; }", "// Test A (Test B is the same with 0.00 / 100)", "TaxConfig.Rate = 0.20m;", "var p = Checkout.Price(100); // reads the static", "Assert.Equal(120m, p);"],
    i: ["record TaxConfig(decimal Rate);", "// Test A (Test B is the same with 0.00 / 100)", "var checkout = new Checkout(new TaxConfig(0.20m));", "var p = checkout.Price(100); // its own config", "Assert.Equal(120m, p);"],
  };
  Viz.register("anti-patterns-global", (el) => Viz.player(el, {
    title: "Global state: two tests, one static, a flaky build",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "step running now"], ["done", "assert passed"], ["bad", "assert failed"], ["path", "shared mutable state"]],
    inputs: [
      { key: "design", label: "design", type: "select", options: ["static global: TaxConfig.Rate", "injected: each test owns a TaxConfig"], value: "static global: TaxConfig.Rate" },
      { key: "sched", label: "interleaving (3 × A, 3 × B; the test runner decides)", value: "A A B A B B", width: 300 },
    ],
    random: () => ({ sched: pick(ALL_SCHED).split("").join(" ") }),
    build: ({ design, sched }) => {
      const seq = String(sched).toUpperCase().replace(/[\s,]+/g, "");
      if (!/^[AB]{6}$/.test(seq) || seq.split("A").length - 1 !== 3) throw new Error("Write exactly three A and three B, e.g. A B A B A B.");
      const global = design.startsWith("static");
      const run = runSchedule(seq, global);
      const failing = ALL_SCHED.filter((s) => { const r = runSchedule(s, global); return !(r.A && r.B); }).length;
      const fr = [];
      const snap = (o) => ({ global, seq, run, failing, ...o });
      fr.push(snap({ t: -1, line: [0], note: global ? "Both tests run in parallel (xUnit collections, JUnit parallel mode, pytest-xdist, Go <code>t.Parallel()</code>, Jest workers in one process). Each sets the <b>static</b> rate, computes a price, and checks it." : "Same two tests, but each builds its <b>own</b> TaxConfig and passes it to the constructor. There is nothing for them to share." }));
      run.steps.forEach((s, i) => {
        const line = [s.k + 2];
        let note = `Test ${s.who}: <code>${esc(s.op)}</code>.`;
        if (s.k === 0 && global) note += ` The static now holds ${s.G.toFixed(2)} for <b>everyone</b> in the process.`;
        if (s.k === 1) { const exp = GT[s.who].rate; const used = global ? s.G : exp; note += used === exp ? ` It read rate ${used.toFixed(2)}, its own value.` : ` It read rate <b>${used.toFixed(2)}</b>: the <b>other</b> test's value, written in between.`; }
        if (s.k === 2) note += s.op.endsWith("✓") ? " Passed." : " <b>Failed</b>, although the code under test is correct.";
        fr.push(snap({ t: i, line, note }));
      });
      fr.push(snap({ t: 6, end: true, line: [], note: global ? `Of all ${ALL_SCHED.length} possible interleavings, <b>${failing}</b> make at least one test fail. Locally (sequential runner) it always passes; on the 32-core CI agent it fails "randomly". Fix: inject the config, or give each test its own instance.` : `0 of ${ALL_SCHED.length} interleavings fail. Tests can run in any order, in parallel, forever. Try "Randomize".` }));
      return fr;
    },
    render: (f) => {
      const vis = f.run.steps.slice(0, f.t + 1);
      const cell = (who, i) => {
        const s = f.run.steps[i];
        if (s.who !== who || i > f.t) return "<td></td>";
        const c = i === f.t && !f.end ? "cur" : s.k === 2 ? (s.op.endsWith("✓") ? "ok" : "no") : "";
        return `<td class="${c}">${esc(s.op)}</td>`;
      };
      const shared = (i) => {
        if (i > f.t) return "<td></td>";
        const s = f.run.steps[i];
        return f.global ? `<td class="ap-shared ${s.k === 0 ? "hot" : ""}">${s.G.toFixed(2)}</td>` : `<td class="ap-shared">A: ${s.A.cfg === null ? "–" : s.A.cfg.toFixed(2)} · B: ${s.B.cfg === null ? "–" : s.B.cfg.toFixed(2)}</td>`;
      };
      const cols = [0, 1, 2, 3, 4, 5];
      const tbl = `<div class="ap-scroll"><table class="ap-tbl ap-lanes"><tr><th></th>${cols.map((i) => `<th class="${i === f.t ? "on" : ""}">t${i + 1}</th>`).join("")}</tr>
        <tr><td class="ap-mname">Test A</td>${cols.map((i) => cell("A", i)).join("")}</tr>
        <tr><td class="ap-mname">${f.global ? "TaxConfig.Rate (static)" : "each test's own config"}</td>${cols.map(shared).join("")}</tr>
        <tr><td class="ap-mname">Test B</td>${cols.map((i) => cell("B", i)).join("")}</tr></table></div>`;
      const res = (x) => (x === null ? "running" : x ? "pass" : "FAIL");
      const fin = vis.length === 6;
      return col(tbl, codePanel(GLOBAL_CODE[f.global ? "g" : "i"], "csharp", f.line, f.global ? "static global" : "injected"),
        stats([["Test A", fin ? res(f.run.A) : "…", fin ? (f.run.A ? "ok" : "warn") : ""], ["Test B", fin ? res(f.run.B) : "…", fin ? (f.run.B ? "ok" : "warn") : ""], ["failing interleavings", `${f.failing}/${ALL_SCHED.length}`, f.failing ? "warn" : "ok"]]));
    },
  }));

  /* =====================================================================
   * 5. Sync over async: thread-pool starvation, tick by tick
   * ===================================================================== */
  const IO_TICKS = 3, INJECT_EVERY = 4, MAX_TICKS = 40;
  function simulatePool({ threads, n, arrive, sync }) {
    const arr = Array.from({ length: n }, (_, r) => arrive(r));
    const ioDue = Array(n).fill(-1), doneAt = Array(n).fill(-1);
    const T = Array.from({ length: threads }, () => ({ st: "idle", item: null, r: -1, hist: [] }));
    const queue = [], ticks = [];
    let starve = 0;
    for (let t = 0; t < MAX_TICKS; t++) {
      const ev = [];
      for (let r = 0; r < n; r++) if (ioDue[r] === t) { queue.push({ k: "C", r }); ev.push(`I/O for request ${r} completes; its continuation C${r} joins the queue`); }
      const arrived = [];
      for (let r = 0; r < n; r++) if (arr[r] === t) { queue.push({ k: "S", r }); arrived.push(r); }
      if (arrived.length) ev.push(`${arrived.length} request(s) arrive (${arrived.map((r) => "S" + r).join(", ")})`);
      for (const th of T) if (th.st === "idle" && queue.length) { th.st = "run"; th.item = queue.shift(); }
      let injected = false;
      if (queue.length && !T.some((th) => th.st === "idle")) {
        starve++;
        if (starve >= INJECT_EVERY) { T.push({ st: "idle", item: null, r: -1, hist: Array(t).fill("") }); starve = 0; injected = true; ev.push(`the pool has been starved for ${INJECT_EVERY} ticks, so it <b>injects a new thread</b> (it starts work next tick)`); }
      } else starve = 0;
      for (const th of T) th.hist.push(th.st === "run" ? th.item.k + th.item.r : th.st === "blocked" ? "B" + th.r : "");
      const blocked = T.filter((th) => th.st === "blocked").length;
      ticks.push({ t, hist: T.map((th) => th.hist.slice()), queue: queue.map((q) => q.k + q.r), ev, blocked, done: doneAt.filter((d) => d >= 0).length, injected, threads: T.length });
      for (const th of T) {
        if (th.st !== "run") continue;
        const { k, r } = th.item;
        th.item = null;
        if (k === "S") { ioDue[r] = t + IO_TICKS; if (sync) { th.st = "blocked"; th.r = r; } else th.st = "idle"; }
        else {
          doneAt[r] = t; th.st = "idle";
          if (sync) { const w = T.find((x) => x.st === "blocked" && x.r === r); if (w) { w.st = "idle"; w.r = -1; } }
        }
      }
      if (doneAt.every((d) => d >= 0)) break;
    }
    const lat = doneAt.map((d, r) => (d < 0 ? null : d - arr[r] + 1));
    return { ticks, lat, arr, finished: doneAt.every((d) => d >= 0) };
  }
  const POOL_CODE = {
    sync: ["public IActionResult Get(int id)", "{", "    // blocks this pool thread until the I/O", "    // AND its continuation have finished", "    var order = _repo.GetAsync(id).Result;", "    return Ok(order);", "}"],
    async: ["public async Task<IActionResult> Get(int id)", "{", "    // the thread returns to the pool here;", "    // a pool thread runs the rest later", "    var order = await _repo.GetAsync(id);", "    return Ok(order);", "}"],
  };
  const ARRIVALS = { "burst: all at tick 0": () => 0, "steady: 2 per tick": (r) => Math.floor(r / 2), "steady: 1 per tick": (r) => r };
  Viz.register("anti-patterns-starvation", (el) => Viz.player(el, {
    title: "Sync over async: how .Result starves the thread pool",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "S = request starts (CPU)"], ["done", "C = continuation after I/O"], ["bad", "B = thread blocked in .Result"], ["path", "work queued, no free thread"]],
    inputs: [
      { key: "mode", label: "handler", type: "select", options: ["sync over async (.Result)", "async all the way (await)"], value: "sync over async (.Result)" },
      { key: "threads", label: "pool threads", type: "select", options: ["2", "3", "4", "6"], value: "4" },
      { key: "n", label: "requests", value: "8", width: 70 },
      { key: "arrive", label: "arrivals", type: "select", options: Object.keys(ARRIVALS), value: "burst: all at tick 0" },
    ],
    random: () => ({ mode: pick(["sync over async (.Result)", "async all the way (await)"]), threads: pick(["2", "3", "4"]), n: String(Viz.rand(4, 10)), arrive: pick(Object.keys(ARRIVALS)) }),
    build: ({ mode, threads, n, arrive }) => {
      if (!/^\d{1,2}$/.test(String(n).trim()) || +n < 1 || +n > 12) throw new Error("Use 1 to 12 requests.");
      const sync = mode.startsWith("sync");
      const sim = simulatePool({ threads: +threads, n: +n, arrive: ARRIVALS[arrive], sync });
      const fr = [];
      fr.push({ sim, k: -1, sync, line: [4], note: `${threads} pool threads. Each request runs a little CPU (S), waits ${IO_TICKS} ticks for the database, then runs its continuation (C). ${sync ? "With <code>.Result</code> the thread that started the request <b>stays blocked</b> until another pool thread runs the continuation." : "With <code>await</code> the thread goes back to the pool while the database works."} When work waits and no thread is free, the pool adds one thread every ${INJECT_EVERY} ticks (.NET's hill-climbing injects roughly one or two per second).` });
      sim.ticks.forEach((tk, i) => {
        const starving = tk.queue.length && tk.hist.every((h) => h[h.length - 1] !== "");
        let note = `Tick ${tk.t}: ${tk.ev.length ? tk.ev.join("; ") + "." : "no new events."}`;
        if (sync && tk.blocked && starving) note += ` <b>${tk.blocked} thread(s) are blocked</b> waiting for continuations that sit in the queue behind new requests: the pool is starving itself.`;
        else if (starving) note += " Every thread is busy, so work waits in the queue.";
        fr.push({ sim, k: i, sync, line: [4], note });
      });
      const L = sim.lat.filter((x) => x !== null), avg = L.length ? (L.reduce((a, b) => a + b, 0) / L.length) : 0;
      const last = sim.ticks[sim.ticks.length - 1];
      fr.push({ sim, k: sim.ticks.length - 1, sync, end: true, line: [], note: sim.finished
        ? `All ${n} requests done by tick ${last.t}. Average latency <b>${avg.toFixed(1)} ticks</b>, worst ${Math.max(...L)}; the pool grew to ${last.threads} threads. ${sync ? "The same work with <code>await</code> needs no extra threads: switch the handler and compare." : "Threads were never blocked, so a small pool served everything."}`
        : `Still not finished after ${MAX_TICKS} ticks: the pool keeps adding threads, each new one picks up a new request and blocks too. In production this looks like a hang with low CPU.` });
      return fr;
    },
    render: (f) => {
      const tk = f.sim.ticks[Math.max(0, f.k)];
      const upto = f.k < 0 ? 0 : tk.t + 1;
      const head = `<tr><th>thread</th>${Array.from({ length: upto }, (_, t) => `<th class="${t === tk.t && f.k >= 0 ? "on" : ""}">${t}</th>`).join("")}</tr>`;
      const rows = (f.k < 0 ? tk.hist.map(() => []) : tk.hist).map((h, i) => `<tr><td class="ap-mname">T${i + 1}</td>${h.slice(0, upto).map((c) => `<td class="ap-g-${c ? c[0] : "i"}">${c ? esc(c) : ""}</td>`).join("")}</tr>`).join("");
      const gantt = `<div class="ap-scroll"><table class="ap-tbl ap-gantt">${head}${rows}</table></div>`;
      const q = `<div class="ap-queue"><span>queue</span>${f.k < 0 || !tk.queue.length ? '<em>empty</em>' : tk.queue.map((x) => `<b class="ap-q-${x[0]}">${esc(x)}</b>`).join("")}</div>`;
      const L = f.sim.lat.filter((x, r) => x !== null && f.k >= 0 && (f.end || f.sim.arr[r] + x - 1 < tk.t));
      return col(gantt, q, `<div class="ap-split">${codePanel(POOL_CODE[f.sync ? "sync" : "async"], "csharp", f.line, f.sync ? "sync over async" : "async all the way")}${stats([["tick", f.k < 0 ? "-" : tk.t], ["requests done", `${f.k < 0 ? 0 : tk.done}/${f.sim.lat.length}`], ["pool threads", tk.threads, tk.threads > f.sim.ticks[0].threads ? "warn" : ""], ["blocked now", f.k < 0 ? 0 : tk.blocked, tk.blocked ? "warn" : "ok"], ["avg latency (ticks)", L.length ? (L.reduce((a, b) => a + b, 0) / L.length).toFixed(1) : "-"]])}</div>`);
    },
  }));

  /* =====================================================================
   * 6. Distributed monolith: availability multiplies, latency adds
   * ===================================================================== */
  function parseChain(s) {
    const parts = String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (parts.length < 2 || parts.length > 6) throw new Error("List 2 to 6 services: Name availability% latencyMs, ...");
    return parts.map((p) => {
      const m = p.match(/^([A-Za-z][\w-]{0,13})\s+(\d{2}(?:\.\d{1,3})?)\s+(\d{1,4})$/);
      if (!m) throw new Error(`"${p}": write Name 99.9 40 (availability %, latency ms).`);
      const a = Number(m[2]);
      if (a < 50 || a > 99.999) throw new Error(`${m[1]}: availability must be between 50 and 99.999.`);
      return { name: m[1], a: a / 100, ms: Number(m[3]) };
    });
  }
  const DM_PRESETS = ["Gateway 99.95 15, Orders 99.9 40, Pricing 99.9 30, Stock 99.5 60, Customers 99.9 25", "Web 99.9 20, Cart 99.9 30, Promo 99 45, Tax 99.9 35, Payment 99.95 120, Fraud 99.5 80", "Api 99.99 10, Users 99.95 20, Profiles 99.95 25"];
  Viz.register("anti-patterns-distmono", (el) => Viz.player(el, {
    title: "Distributed monolith: every synchronous hop multiplies the risk",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "service just added to the request path"], ["done", "in the request path"], ["path", "off the request path (events)"]],
    inputs: [
      { key: "chain", label: "services the request touches (name availability% latency-ms)", value: DM_PRESETS[0], width: 560 },
      { key: "mode", label: "coupling", type: "select", options: ["synchronous call chain", "async events + local data"], value: "synchronous call chain" },
    ],
    random: () => ({ chain: pick(DM_PRESETS), mode: pick(["synchronous call chain", "async events + local data"]) }),
    build: ({ chain, mode }) => {
      const S = parseChain(chain), sync = mode.startsWith("sync");
      const inPath = sync ? S.length : 1;
      const fr = [];
      let A = 1, ms = 0;
      const snap = (o) => ({ S, sync, inPath, A, ms, ...o });
      fr.push(snap({ k: -1, note: sync ? "One user request calls each service in turn, synchronously. The request succeeds only if <b>every</b> service is up, and it waits for <b>all</b> of them." : "The first service owns the data it needs (a local copy kept fresh by events). The others react to events <b>after</b> the response, so they're off the request path." }));
      for (let i = 0; i < inPath; i++) {
        A *= S[i].a; ms += S[i].ms;
        fr.push(snap({ k: i, note: `${esc(S[i].name)} (${(S[i].a * 100).toFixed(3).replace(/\.?0+$/, "")}%, ${S[i].ms} ms) joins the path. Availability so far: ${(A * 100).toFixed(3)}% (a product, so it only goes <b>down</b>); latency so far: ${ms} ms (a sum, so it only goes <b>up</b>).` }));
      }
      const rnd = rng(S.reduce((h, s) => h * 31 + s.ms + Math.round(s.a * 1e5), 7) >>> 0);
      const N = 20000;
      let ok = 0, lastFail = null;
      for (let r = 0; r < N; r++) {
        let fail = -1;
        for (let i = 0; i < inPath; i++) if (rnd() > S[i].a) { fail = i; break; }
        if (fail < 0) ok++; else lastFail = fail;
      }
      const down = (1 - A) * 30 * 24 * 60;
      fr.push(snap({ k: inPath - 1, end: true, ok, N, failAt: lastFail, note: `Simulated ${N.toLocaleString()} requests: <b>${ok.toLocaleString()}</b> succeeded (${(ok / N * 100).toFixed(2)}%), matching the product ${(A * 100).toFixed(2)}%. That is about <b>${Math.round(down)} minutes of failed requests per month</b>, ${sync ? `although no single service is worse than ${(Math.min(...S.map((s) => s.a)) * 100).toFixed(1)}%. If these services also share a database or must deploy together, you have paid for microservices and kept the monolith's coupling.` : "and the other services can be down without the user noticing; their work catches up from the event log."}` }));
      return fr;
    },
    render: (f) => {
      const n = f.S.length, w = 112, gap = 24, x0 = 70, top = 34;
      const width = Math.max(x0 + n * (w + gap) + 10, 560);
      const H = f.sync ? 150 : 230;
      let b = box(4, top + 8, 52, 40, "", "user", "", {});
      const pos = (i) => (f.sync || i === 0 ? { x: x0 + i * (w + gap), y: top } : { x: x0 + (i - 1) * (w + gap) + w / 2 + 40, y: top + 120 });
      if (!f.sync) b += txt(x0 + w + 16, top + 102, "events, after the response", "small muted");
      f.S.forEach((s, i) => {
        const p = pos(i), inP = i < f.inPath;
        const cls = !inP ? "path" : i === f.k && !f.end ? "active" : i <= f.k ? "done" : "";
        const prev = i === 0 ? { x: 56, y: top } : pos(i - 1);
        if (i === 0) b += arrow(56, top + 28, p.x - 2, top + 28, i <= f.k ? "done" : "");
        else if (f.sync) b += arrow(prev.x + w, top + 28, p.x - 2, top + 28, i <= f.k ? "done" : "");
        else b += arrow(pos(0).x + w / 2, top + 56, p.x + w / 2, p.y - 2, "path dash");
        b += box(p.x, p.y, w, 56, cls, s.name, `${(s.a * 100).toFixed(3).replace(/\.?0+$/, "")}% · ${s.ms} ms`, { dash: !inP });
      });
      b += txt(x0, 18, f.sync ? "request path: user → every service, in sequence" : "request path: user → one service with its own data", "small muted");
      const down = (1 - f.A) * 30 * 24 * 60;
      return col(svg(width, H, b, "Services on the request path"), stats([["services on the path", f.k < 0 ? 0 : Math.min(f.k + 1, f.inPath)], ["availability (product)", f.k < 0 ? "-" : (f.A * 100).toFixed(2) + "%", f.A < 0.995 ? "warn" : "ok"], ["failed minutes / month", f.k < 0 ? "-" : Math.round(down), down > 60 ? "warn" : "ok"], ["latency (sum, ms)", f.k < 0 ? "-" : f.ms], ...(f.end ? [["simulated success", (f.ok / f.N * 100).toFixed(2) + "%"]] : [])]));
    },
  }));

  /* =====================================================================
   * 7. Big ball of mud: find dependency cycles with Tarjan's SCC algorithm
   * ===================================================================== */
  function parseDeps(s) {
    const parts = String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (!parts.length || parts.length > 16) throw new Error("Give 1 to 16 dependencies like Orders->Billing.");
    const nodes = [], edges = [];
    for (const p of parts) {
      const m = p.match(/^([A-Za-z]\w{0,7})\s*->\s*([A-Za-z]\w{0,7})$/);
      if (!m) throw new Error(`"${p}": write A->B (module names up to 8 letters).`);
      if (m[1] === m[2]) throw new Error(`${m[1]}->${m[2]}: a module depending on itself isn't a module dependency.`);
      for (const x of [m[1], m[2]]) if (!nodes.includes(x)) nodes.push(x);
      if (!edges.some((e) => e.u === m[1] && e.v === m[2])) edges.push({ u: m[1], v: m[2] });
    }
    if (nodes.length > 9) throw new Error("Use at most 9 modules.");
    return { nodes, edges };
  }
  function sccOf(nodes, edges) {
    const adj = new Map(nodes.map((n) => [n, []]));
    edges.forEach((e) => adj.get(e.u).push(e.v));
    const idx = new Map(), low = new Map(), on = new Set(), st = [], comps = [];
    let c = 0;
    const dfs = (v) => {
      idx.set(v, c); low.set(v, c); c++; st.push(v); on.add(v);
      for (const w of adj.get(v)) {
        if (!idx.has(w)) { dfs(w); low.set(v, Math.min(low.get(v), low.get(w))); }
        else if (on.has(w)) low.set(v, Math.min(low.get(v), idx.get(w)));
      }
      if (low.get(v) === idx.get(v)) { const comp = []; let w; do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== v); comps.push(comp); }
    };
    nodes.forEach((n) => { if (!idx.has(n)) dfs(n); });
    return comps;
  }
  const MUD_PRESETS = [
    "Orders->Billing, Billing->Customer, Customer->Orders, Billing->Shipping, Shipping->Orders, Reports->Orders, Reports->Billing, Auth->Customer",
    "Web->Cart, Cart->Pricing, Pricing->Promo, Promo->Cart, Cart->Stock, Stock->Catalog, Catalog->Pricing, Web->Catalog",
    "Api->Orders, Api->Users, Orders->Users, Orders->Payments, Payments->Ledger, Users->Ledger",
    "A->B, B->C, C->A, C->D, D->E, E->D, F->A",
  ];
  Viz.register("anti-patterns-mud", (el) => Viz.player(el, {
    title: "Big ball of mud: find the cycles that make modules inseparable",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "module being visited"], ["visit", "on the DFS stack"], ["bad", "inside a cycle (tangle)"], ["done", "acyclic: can be extracted"], ["path", "best edge to cut"]],
    inputs: [{ key: "deps", label: "module dependencies (A->B means A uses B)", value: MUD_PRESETS[0], width: 760 }],
    random: () => ({ deps: pick(MUD_PRESETS) }),
    build: ({ deps }) => {
      const { nodes, edges } = parseDeps(deps);
      const adj = new Map(nodes.map((n) => [n, []]));
      edges.forEach((e) => adj.get(e.u).push(e.v));
      const idx = {}, low = {}, on = new Set(), st = [], comps = [], fr = [];
      let c = 0;
      const snap = (o) => ({ nodes, edges, idx: { ...idx }, low: { ...low }, st: st.slice(), comps: comps.map((x) => x.slice()), ...o });
      fr.push(snap({ note: `${nodes.length} modules, ${edges.length} dependencies. A <b>cycle</b> means none of its modules can be built, tested, deployed or understood without the others. Tarjan's algorithm finds every group of mutually dependent modules (strongly connected component) in one depth-first pass.` }));
      const dfs = (v) => {
        idx[v] = low[v] = c++; st.push(v); on.add(v);
        fr.push(snap({ cur: v, note: `Visit <b>${esc(v)}</b>: give it number ${idx[v]} and push it on the stack. low = ${low[v]} means "the oldest module on the stack I can reach so far is myself".` }));
        for (const w of adj.get(v)) {
          if (idx[w] === undefined) {
            dfs(w);
            if (low[w] < low[v]) { low[v] = low[w]; fr.push(snap({ cur: v, edge: `${v}-${w}`, note: `Back at ${esc(v)}: ${esc(w)} reached something older (low ${low[w]}), so ${esc(v)} can too: low(${esc(v)}) = ${low[v]}.` })); }
          } else if (on.has(w)) {
            low[v] = Math.min(low[v], idx[w]);
            fr.push(snap({ cur: v, edge: `${v}-${w}`, note: `${esc(v)} → ${esc(w)}, and ${esc(w)} is <b>still on the stack</b>: that edge closes a cycle. low(${esc(v)}) = ${low[v]}.` }));
          }
        }
        if (low[v] === idx[v]) {
          const comp = []; let w;
          do { w = st.pop(); on.delete(w); comp.push(w); } while (w !== v);
          comps.push(comp);
          fr.push(snap({ cur: v, note: comp.length > 1 ? `low(${esc(v)}) = its own number, so everything above it on the stack forms one tangle: <b>${comp.map(esc).join(", ")}</b>. These ${comp.length} modules are effectively one module.` : `${esc(v)} is not part of any cycle. It can be extracted, versioned and tested on its own.` }));
        }
      };
      nodes.forEach((n) => { if (idx[n] === undefined) dfs(n); });
      const big = comps.reduce((a, b) => (b.length > a.length ? b : a), []);
      let cut = null;
      if (big.length > 1) {
        const inner = edges.filter((e) => big.includes(e.u) && big.includes(e.v));
        let best = Infinity;
        for (const e of inner) {
          const rest = edges.filter((x) => x !== e);
          const cs = sccOf(nodes, rest), m = Math.max(...cs.map((x) => x.length)), tangled = cs.filter((x) => x.length > 1).reduce((a, x) => a + x.length, 0);
          const score = m * 100 + tangled;
          if (score < best) { best = score; cut = { e, m }; }
        }
      }
      const tangles = comps.filter((x) => x.length > 1);
      fr.push(snap({ end: true, cut: cut && `${cut.e.u}-${cut.e.v}`, note: tangles.length
        ? `${tangles.length} tangle(s); the largest has <b>${big.length}</b> modules. Cutting <b>${esc(cut.e.u)} → ${esc(cut.e.v)}</b> shrinks the largest tangle to ${cut.m}. Cut it by inverting the dependency (an interface owned by ${esc(cut.e.u)}), publishing an event, or moving the shared piece into a new lower module.`
        : "No cycles: the modules form a layered graph (a DAG). Each one can be understood and changed with only the modules below it in mind." }));
      return fr;
    },
    render: (f) => {
      const n = f.nodes.length, R = n <= 3 ? 110 : 150 + (n - 5) * 8;
      const sccIdx = {}; f.comps.forEach((comp, i) => comp.forEach((x) => { sccIdx[x] = { i, big: comp.length > 1 }; }));
      const nodes = f.nodes.map((id, i) => {
        const a = -Math.PI / 2 + (2 * Math.PI * i) / n;
        const s = sccIdx[id];
        return { id, x: Math.round(R * 1.35 * Math.cos(a)), y: Math.round(R * Math.sin(a)), label: id, sub: f.idx[id] === undefined ? "" : s ? (s.big ? "tangle" : "free") : `#${f.idx[id]} low ${f.low[id]}` };
      });
      const cls = (id) => (id === f.cur && !f.end ? "active" : sccIdx[id] ? (sccIdx[id].big ? "bad" : "done") : f.st.includes(id) ? "visit" : "");
      const edges = f.edges.map((e) => {
        const k = `${e.u}-${e.v}`, a = sccIdx[e.u], b = sccIdx[e.v];
        const c = k === f.cut ? "path" : k === f.edge ? "active" : a && b && a.big && a.i === b.i ? "bad" : "";
        return { u: e.u, v: e.v, cls: c };
      });
      const g = Viz.graph({ nodes, edges, directed: true }, { r: 34, nodeCls: cls, directed: true });
      const stack = `<div class="ap-queue"><span>DFS stack</span>${f.st.length ? f.st.map((x) => `<b class="ap-q-S">${esc(x)}</b>`).join("") : "<em>empty</em>"}</div>`;
      const tangles = f.comps.filter((x) => x.length > 1);
      return col(`<div class="ap-graph">${g}</div>`, stack, stats([["modules", f.nodes.length], ["dependencies", f.edges.length], ["tangles found", tangles.length, tangles.length ? "warn" : ""], ["largest tangle", tangles.length ? Math.max(...tangles.map((x) => x.length)) : f.end ? 1 : "-", tangles.length ? "warn" : f.end ? "ok" : ""]]));
    },
  }));

  /* =====================================================================
   * 8. Leaky abstraction: the ORM's N+1 queries
   * ===================================================================== */
  const N1_CODE = {
    lazy: ["var orders = db.Orders", "    .Where(o => o.Date == today).ToList();", "foreach (var o in orders)", "    Print(o.Customer.Name); // a query?"],
    eager: ["var orders = db.Orders", "    .Include(o => o.Customer)      // JOIN", "    .Where(o => o.Date == today).ToList();", "foreach (var o in orders)", "    Print(o.Customer.Name); // loaded"],
    batch: ["var orders = db.Orders", "    .Where(o => o.Date == today).ToList();", "var ids = orders.Select(o => o.CustomerId);", "var byId = db.Customers", "    .Where(c => ids.Contains(c.Id))", "    .ToDictionary(c => c.Id);      // 1 query", "foreach (var o in orders)", "    Print(byId[o.CustomerId].Name);"],
  };
  const N1_MODES = { "lazy loading (o.Customer on demand)": "lazy", "eager: Include(o => o.Customer)": "eager", "batched: one IN (...) query": "batch" };
  const RTTS = { "1 ms (same host)": 1, "5 ms (same region)": 5, "40 ms (cross-region)": 40 };
  Viz.register("anti-patterns-nplus1", (el) => Viz.player(el, {
    title: "Leaky abstraction: a property read that is really a query",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "order being printed"], ["bad", "triggered a database round trip"], ["done", "already in memory"]],
    inputs: [
      { key: "cust", label: "customer of each order", value: "c1, c2, c1, c3, c2, c4, c5, c1", width: 260 },
      { key: "mode", label: "loading", type: "select", options: Object.keys(N1_MODES), value: "lazy loading (o.Customer on demand)" },
      { key: "rtt", label: "database round trip", type: "select", options: Object.keys(RTTS), value: "5 ms (same region)" },
    ],
    random: () => ({ cust: Array.from({ length: Viz.rand(4, 10) }, () => "c" + Viz.rand(1, 6)).join(", "), mode: pick(Object.keys(N1_MODES)), rtt: pick(Object.keys(RTTS)) }),
    build: ({ cust, mode, rtt }) => {
      const C = words(cust);
      if (!C.length || C.length > 12) throw new Error("Give 1 to 12 orders (one customer id each).");
      C.forEach((c) => { if (!/^[A-Za-z]\w{0,5}$/.test(c)) throw new Error(`"${c}" is not a short customer id like c1.`); });
      const M = N1_MODES[mode], ms = RTTS[rtt], code = N1_CODE[M];
      const loaded = new Set(), sql = [], st = C.map(() => ""), fr = [];
      const snap = (o) => ({ C, M, ms, code, sql: sql.slice(), st: st.slice(), loaded: loaded.size, ...o });
      const distinct = [...new Set(C)];
      if (M === "eager") {
        sql.push(`SELECT o.*, c.* FROM Orders o JOIN Customers c ON c.Id = o.CustomerId WHERE o.Date = @d  -- ${C.length} rows`);
        distinct.forEach((c) => loaded.add(c));
        fr.push(snap({ line: [0, 1, 2], note: "<code>Include</code> tells the ORM what you're about to touch, so it loads orders <b>and</b> customers in one JOIN." }));
      } else {
        sql.push(`SELECT * FROM Orders WHERE Date = @d  -- ${C.length} rows`);
        fr.push(snap({ line: [0, 1], note: `One query loads ${C.length} orders. <code>o.Customer</code> is not loaded yet; ${M === "lazy" ? "the ORM put a <b>proxy</b> there that will query when touched." : "we'll fetch customers ourselves, all at once."}` }));
        if (M === "batch") {
          sql.push(`SELECT * FROM Customers WHERE Id IN (${distinct.map((d) => `'${d}'`).join(", ")})`);
          distinct.forEach((c) => loaded.add(c));
          fr.push(snap({ line: [2, 3, 4, 5], note: `Collect the ${distinct.length} distinct customer ids and load them with <b>one</b> <code>IN (...)</code> query. Works with any data access library, ORM or not.` }));
        }
      }
      const loopLine = M === "batch" ? [6, 7] : M === "eager" ? [3, 4] : [2, 3];
      C.forEach((c, i) => {
        if (loaded.has(c)) { st[i] = "mem"; fr.push(snap({ cur: i, line: loopLine, note: `Order ${i + 1}: customer ${esc(c)} is already in memory${M === "lazy" ? " (the change tracker's identity map remembers it)" : ""}. No round trip.` })); }
        else { loaded.add(c); st[i] = "db"; sql.push(`SELECT * FROM Customers WHERE Id = '${c}'`); fr.push(snap({ cur: i, line: loopLine, note: `Order ${i + 1}: <code>o.Customer.Name</code> looks like a field read, but customer ${esc(c)} isn't loaded, so the proxy runs <b>another query</b>. The abstraction hid a network call inside a dot.` })); }
      });
      const total = sql.length * ms;
      fr.push(snap({ end: true, line: [], note: `${sql.length} round trip(s) × ${ms} ms ≈ <b>${total} ms</b> of waiting. ${M === "lazy" ? `With 1,000 orders it would be up to 1,001 queries. Lazy loading leaks: you must know how the ORM loads data to write fast code with it. Fix with Include or a batched query, and log the SQL in development so you see it.` : `Constant in the number of orders. ${M === "eager" ? "A JOIN repeats customer columns on every row; for big graphs, EF Core's AsSplitQuery() or the batched form avoids that." : "Two queries no matter how many orders."}`}` }));
      return fr;
    },
    render: (f) => {
      const cells = f.C.map((c, i) => `<div class="ap-cell ${i === f.cur && !f.end ? "active" : f.st[i] === "db" ? "bad" : f.st[i] === "mem" ? "done" : ""}">o${i + 1}<small>${esc(c)}</small></div>`).join("");
      const log = `<pre class="ap-sql">${f.sql.map((q, i) => `${String(i + 1).padStart(2)}  ${esc(q)}`).join("\n")}</pre>`;
      return col(`<div class="ap-cells">${cells}</div>`, `<div class="ap-scroll">${log}</div>`, codePanel(f.code, "csharp", f.line, "EF Core"),
        stats([["queries", f.sql.length, f.sql.length > 2 ? "warn" : "ok"], ["waiting (ms)", f.sql.length * f.ms], ["distinct customers", new Set(f.C).size]]));
    },
  }));

  /* =====================================================================
   * 9. Boolean flag parameters: 2^n behaviours, some of them nonsense
   * ===================================================================== */
  function parseRule(src, names) {
    const s = String(src).trim();
    const toks = s.match(/\s*([A-Za-z_]\w*|&&|\|\||[&|!()])\s*/gy);
    if (!toks || toks.join("").length !== s.length) throw new Error(`Can't read rule "${s}". Use flag names, & | ! and ( ).`);
    const t = toks.map((x) => x.trim()).map((x) => (x === "&&" ? "&" : x === "||" ? "|" : x));
    let i = 0;
    const atom = () => {
      const k = t[i++];
      if (k === undefined) throw new Error(`Rule "${s}" ends too early.`);
      if (k === "!") { const a = atom(); return (v) => !a(v); }
      if (k === "(") { const e = or(); if (t[i++] !== ")") throw new Error(`Missing ) in "${s}".`); return e; }
      const j = names.indexOf(k);
      if (j < 0) throw new Error(`Rule "${s}" uses "${k}", which is not one of the flags.`);
      return (v) => v[j];
    };
    const and = () => { let l = atom(); while (t[i] === "&") { i++; const a = l, r = atom(); l = (v) => a(v) && r(v); } return l; };
    const or = () => { let l = and(); while (t[i] === "|") { i++; const a = l, r = and(); l = (v) => a(v) || r(v); } return l; };
    const f = or();
    if (i !== t.length) throw new Error(`Unexpected "${t[i]}" in "${s}".`);
    return f;
  }
  Viz.register("anti-patterns-flags", (el) => Viz.player(el, {
    title: "Boolean flag parameters: every flag doubles the behaviours",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "combination being checked"], ["done", "meaningful combination"], ["bad", "nonsense combination the signature still allows"]],
    inputs: [
      { key: "flags", label: "bool parameters of Export(report, ...)", value: "zip, email, dryRun, overwrite", width: 280 },
      { key: "rules", label: "invalid when (one rule per ;)", value: "dryRun & email; dryRun & overwrite", width: 300 },
    ],
    random: () => pick([
      { flags: "zip, email, dryRun, overwrite", rules: "dryRun & email; dryRun & overwrite" },
      { flags: "async, retry, force", rules: "force & !async" },
      { flags: "includeDeleted, onlyDeleted, paged", rules: "onlyDeleted & !includeDeleted" },
      { flags: "compress, encrypt, plain, sign, verbose", rules: "plain & encrypt; plain & compress" },
      { flags: "isAdmin, isGuest", rules: "isAdmin & isGuest" },
    ]),
    build: ({ flags, rules }) => {
      const names = words(flags);
      if (!names.length || names.length > 5) throw new Error("Use 1 to 5 flag names.");
      names.forEach((x) => { if (!NAME.test(x)) throw new Error(`"${x}" is not a valid parameter name.`); });
      if (new Set(names).size !== names.length) throw new Error("Flag names must be different.");
      const R = String(rules).split(";").map((x) => x.trim()).filter(Boolean).map((r) => ({ src: r, f: parseRule(r, names) }));
      const n = names.length, total = 1 << n, combos = [], fr = [];
      const snap = (o) => ({ names, combos: combos.map((c) => ({ ...c })), total, R: R.map((r) => r.src), ...o });
      fr.push(snap({ note: `<code>Export(report, ${names.map((x) => "bool " + x).join(", ")})</code> accepts <b>2<sup>${n}</sup> = ${total}</b> combinations. The signature can't say which ones make sense, so every caller, reviewer and test has to know.` }));
      for (let m = 0; m < total; m++) {
        const v = names.map((_, j) => !!(m & (1 << (n - 1 - j))));
        const broke = R.find((r) => r.f(v));
        combos.push({ v, bad: !!broke, why: broke ? broke.src : "" });
        fr.push(snap({ cur: m, note: `${v.map((b, j) => `${esc(names[j])}=${b}`).join(", ")}: ${broke ? `<b>meaningless</b> (breaks rule <code>${esc(broke.src)}</code>), yet it compiles and someone will eventually pass it.` : "a real behaviour that needs a test."}` }));
      }
      const bad = combos.filter((c) => c.bad).length, inRules = names.filter((x) => R.some((r) => new RegExp(`\\b${x}\\b`).test(r.src)));
      fr.push(snap({ end: true, note: `${total} combinations, <b>${bad}</b> of them nonsense, ${total - bad} real behaviours to test. ${inRules.length ? `The flags in the rules (${inRules.map(esc).join(", ")}) are really one <b>mode</b>: model it as an enum or a separate method (e.g. <code>Preview()</code> vs <code>Export()</code>) and the nonsense combinations can't be written.` : "No conflicts, but positional <code>true, false, true</code> is still unreadable: use an options object or named arguments."} The independent flags that remain belong in an options object with names.` }));
      return fr;
    },
    render: (f) => {
      const card = (c, i) => {
        const on = c.v.map((b, j) => (b ? f.names[j] : null)).filter(Boolean);
        return `<div class="ap-combo ${i === f.cur && !f.end ? "active" : c.bad ? "bad" : "done"}"><code>${c.v.map((b) => (b ? "1" : "0")).join("")}</code><span>${esc(on.length ? on.join(" + ") : "(all false)")}</span></div>`;
      };
      const cards = Array.from({ length: f.total }, (_, i) => (f.combos[i] ? card(f.combos[i], i) : `<div class="ap-combo ap-pending"><code>${i.toString(2).padStart(f.names.length, "0")}</code><span>not checked</span></div>`)).join("");
      const cur = f.combos[f.cur ?? -1];
      const v = cur ? cur.v : f.names.map(() => false);
      const callBool = `Export(report, ${v.map(String).join(", ")});`;
      const set = f.names.filter((_, j) => v[j]).map((x) => `${cap(x)} = true`);
      const callOpt = `Export(report, new() { ${set.join(", ") || "/* defaults */"} });`;
      const bad = f.combos.filter((c) => c.bad).length;
      return col(`<div class="ap-combos">${cards}</div>`, codePanel(["// positional bools: what is the 3rd true?", callBool, "// options object: names at the call site", callOpt], "csharp", cur ? [1, 3] : [], "call site"),
        stats([["combinations (2^n)", f.total], ["nonsense so far", bad, bad ? "warn" : ""], ["checked", `${f.combos.length}/${f.total}`]]));
    },
  }));
})();
