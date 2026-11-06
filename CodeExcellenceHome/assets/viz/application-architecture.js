/* Visualizers for "Application Architecture Styles". Every registered name is prefixed "application-architecture-". */
(() => {
  /* ---------- shared helpers (architecture topics; CSS classes use the ax- prefix) ---------- */
  const esc = Viz.esc;
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const num = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const int = (s, label, min, max) => {
    const n = num(s, label, min, max);
    if (!Number.isInteger(n)) throw new Error(`${label}: use a whole number from ${min} to ${max}.`);
    return n;
  };
  const items = (s, label, min, max) => {
    const a = String(s ?? "").split(/[;\n]+/).map((x) => x.trim()).filter(Boolean);
    if (a.length < min || a.length > max) throw new Error(`${label}: give ${min === max ? min : `${min}–${max}`} items separated by “;”.`);
    return a;
  };
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");

  /* key/value card */
  const kv = (title, rows, o = {}) => `<div class="ax-kv ${o.cls || ""}"><div class="ax-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="ax-kv-r ${c || ""}"><span>${esc(k)}</span><span>${o.html ? v ?? "" : esc(v ?? "")}</span></div>`).join("")
      : `<div class="ax-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  /* big-number stat strip */
  const stats = (list) => `<div class="ax-stats">${list.map(([l, v, c]) => `<div class="ax-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  /* data table built from divs (so .prose table rules never apply). rows: [{c:[...], cls}] */
  const tbl = (title, head, rows, o = {}) => `<div class="ax-tblw ${o.cls || ""}">${title ? `<div class="ax-tbl-t">${o.titleHtml ? title : esc(title)}</div>` : ""}<div class="ax-tbl" style="grid-template-columns:${o.cols || `repeat(${head.length}, auto)`}">` +
    `<div class="ax-tr ax-th">${head.map((h) => `<span>${esc(h)}</span>`).join("")}</div>` +
    (rows.length ? rows.map((r) => `<div class="ax-tr ${r.cls || ""}">${r.c.map((x) => `<span>${o.html ? x : esc(x)}</span>`).join("")}</div>`).join("")
      : `<div class="ax-tr ax-empty"><span style="grid-column:1/-1">${esc(o.empty || "no rows")}</span></div>`) + `</div></div>`;
  const chip = (t, c = "") => `<span class="ax-chip ${c}">${esc(t)}</span>`;
  const col = (...parts) => `<div class="ax-col">${parts.filter(Boolean).join("")}</div>`;

  /* ---------- SVG box diagram: nodes are boxes, edges are clipped to the box border ---------- */
  const tw = (s, px) => String(s ?? "").length * px;
  function diagram(o) {
    const nodes = o.nodes.map((n) => ({ h: 42, ...n, w: n.w || Math.max(84, Math.ceil(Math.max(tw(n.title, 7.4), tw(n.sub, 6.1))) + 22) }));
    const by = new Map(nodes.map((n) => [n.k, n]));
    const bands = o.bands || [];
    let minX, minY, maxX, maxY;
    if (o.view) [minX, minY, maxX, maxY] = [o.view[0], o.view[1], o.view[0] + o.view[2], o.view[1] + o.view[3]];
    else {
      const xs = [...nodes.map((n) => n.x - n.w / 2), ...bands.map((b) => b.x)], xe = [...nodes.map((n) => n.x + n.w / 2), ...bands.map((b) => b.x + b.w)];
      const ys = [...nodes.map((n) => n.y - n.h / 2 - (n.tag ? 16 : 0)), ...bands.map((b) => b.y)], ye = [...nodes.map((n) => n.y + n.h / 2), ...bands.map((b) => b.y + b.h)];
      minX = Math.min(...xs) - 12; maxX = Math.max(...xe) + 12; minY = Math.min(...ys) - 10; maxY = Math.max(...ye) + 12;
    }
    const side = (n, s) => ({ t: { x: n.x, y: n.y - n.h / 2 }, b: { x: n.x, y: n.y + n.h / 2 }, l: { x: n.x - n.w / 2, y: n.y }, r: { x: n.x + n.w / 2, y: n.y } })[s];
    const clip = (a, tx, ty) => {
      const dx = tx - a.x, dy = ty - a.y;
      if (!dx && !dy) return { x: a.x, y: a.y };
      const t = Math.min(dx ? (a.w / 2 + 2) / Math.abs(dx) : Infinity, dy ? (a.h / 2 + 2) / Math.abs(dy) : Infinity);
      return { x: a.x + dx * t, y: a.y + dy * t };
    };
    const bs = bands.map((b) => `<rect class="ax-band ${b.cls || ""}" x="${b.x}" y="${b.y}" width="${b.w}" height="${b.h}" rx="${b.rx ?? 14}"/>` +
      (b.label ? `<text class="ax-bl ${b.cls || ""}" x="${b.lx ?? b.x + 10}" y="${b.ly ?? b.y + 16}" text-anchor="${b.anchor || "start"}">${esc(b.label)}</text>` : "")).join("");
    const es = (o.edges || []).map((e) => {
      const a = by.get(e.u), b = by.get(e.v);
      if (!a || !b) return "";
      let d, fx, fy, tip, mx, my;
      if (e.curve) {
        const cmx = (a.x + b.x) / 2, cmy = (a.y + b.y) / 2, len = Math.hypot(b.x - a.x, b.y - a.y) || 1;
        const cx = cmx + (-(b.y - a.y) / len) * e.curve, cy = cmy + ((b.x - a.x) / len) * e.curve;
        const p1 = e.fs ? side(a, e.fs) : clip(a, cx, cy); tip = e.ts ? side(b, e.ts) : clip(b, cx, cy);
        d = `M${p1.x},${p1.y} Q${cx},${cy} ${tip.x},${tip.y}`; fx = cx; fy = cy; mx = (p1.x + 2 * cx + tip.x) / 4; my = (p1.y + 2 * cy + tip.y) / 4;
      } else {
        let p1 = e.fs ? side(a, e.fs) : null; tip = e.ts ? side(b, e.ts) : null;
        if (!p1 && !tip) { p1 = clip(a, b.x, b.y); tip = clip(b, a.x, a.y); }
        else if (!tip) tip = clip(b, p1.x, p1.y);
        else if (!p1) p1 = clip(a, tip.x, tip.y);
        d = `M${p1.x},${p1.y} L${tip.x},${tip.y}`; fx = p1.x; fy = p1.y; mx = (p1.x + tip.x) / 2; my = (p1.y + tip.y) / 2;
      }
      const vx = tip.x - fx, vy = tip.y - fy, vl = Math.hypot(vx, vy) || 1, ux = vx / vl, uy = vy / vl;
      const head = e.nohead ? "" : `<polygon class="ax-ah ${e.cls || ""}" points="${tip.x},${tip.y} ${tip.x - ux * 10 - uy * 5},${tip.y - uy * 10 + ux * 5} ${tip.x - ux * 10 + uy * 5},${tip.y - uy * 10 - ux * 5}"/>`;
      const lbl = e.label ? `<text class="ax-el ${e.cls || ""}" x="${mx + (e.lx || 0)}" y="${my + (e.ly || 0)}" text-anchor="middle">${esc(e.label)}</text>` : "";
      return `<path class="ax-e ${e.cls || ""} ${e.dash ? "dash" : ""}" d="${d}"/>${head}${lbl}`;
    }).join("");
    const ns = nodes.map((n) => {
      let shape;
      const L = -n.w / 2, T = -n.h / 2;
      if (n.shape === "db") shape = `<path class="ax-nshape" d="M${L},${T + 7} A${n.w / 2},7 0 0 1 ${-L},${T + 7} L${-L},${-T - 7} A${n.w / 2},7 0 0 1 ${L},${-T - 7} Z"/><path class="ax-nline" d="M${L},${T + 7} A${n.w / 2},7 0 0 0 ${-L},${T + 7}"/>`;
      else if (n.shape === "q") shape = `<rect class="ax-nshape" x="${L}" y="${T}" width="${n.w}" height="${n.h}" rx="4"/>` + [0.25, 0.5, 0.75].map((f) => `<line class="ax-nline" x1="${L + n.w * f}" x2="${L + n.w * f}" y1="${T + 3}" y2="${-T - 3}"/>`).join("");
      else if (n.shape === "iface") shape = `<rect class="ax-nshape iface" x="${L}" y="${T}" width="${n.w}" height="${n.h}" rx="${n.h / 2}"/>`;
      else shape = `<rect class="ax-nshape" x="${L}" y="${T}" width="${n.w}" height="${n.h}" rx="8"/>`;
      const hasSub = n.sub !== undefined && n.sub !== "";
      return `<g class="ax-n ${n.cls || ""}" transform="translate(${n.x},${n.y})">${shape}` +
        `<text class="ax-t1" y="${hasSub ? -3 : 4}">${esc(n.title)}</text>${hasSub ? `<text class="ax-t2" y="12">${esc(n.sub)}</text>` : ""}` +
        `${n.tag ? `<text class="ax-t0" y="${T - 6}">${esc(n.tag)}</text>` : ""}${n.badge !== undefined ? `<g class="ax-badge ${n.badgeCls || ""}" transform="translate(${-L - 4},${T + 2})"><circle r="9"/><text y="3.5">${esc(n.badge)}</text></g>` : ""}</g>`;
    }).join("");
    const vw = maxX - minX, vh = maxY - minY;
    return `<svg class="ax-g" viewBox="${minX} ${minY} ${vw} ${vh}" width="${vw}" role="img" aria-label="${esc(o.label || "diagram")}">${bs}${es}${ns}${o.extra || ""}</svg>`;
  }

  /* ---------- SVG sequence diagram: actors with lifelines, one message per row ---------- */
  function seq(o) {
    const A = o.actors, colW = o.colW || 150, rowH = o.rowH || 30, top = 52, left = colW / 2 + 6;
    const xi = new Map(A.map((a, i) => [a.k, left + i * colW]));
    const rows = Math.max(o.rows || 0, o.msgs.length);
    const W = left * 2 + (A.length - 1) * colW, H = top + rows * rowH + 16;
    const heads = A.map((a) => {
      const x = xi.get(a.k), w = Math.min(colW - 14, Math.max(90, tw(a.title, 7.2) + 20));
      return `<line class="ax-life ${a.cls || ""}" x1="${x}" x2="${x}" y1="${top - 8}" y2="${H - 6}"/>` +
        `<g class="ax-n ${a.cls || ""}" transform="translate(${x},22)"><rect class="ax-nshape" x="${-w / 2}" y="-18" width="${w}" height="${a.sub ? 38 : 32}" rx="7"/>` +
        `<text class="ax-t1" y="${a.sub ? -3 : 2}">${esc(a.title)}</text>${a.sub ? `<text class="ax-t2" y="12">${esc(a.sub)}</text>` : ""}</g>`;
    }).join("");
    const ms = o.msgs.map((m, i) => {
      const y = top + i * rowH + rowH / 2 + 4, x1 = xi.get(m.f), x2 = xi.get(m.t);
      if (x1 === undefined || x2 === undefined) return "";
      if (m.f === m.t) {
        const w = Math.max(60, tw(m.label, 6.3) + 16);
        return `<g class="ax-self ${m.cls || ""}"><rect x="${x1 - w / 2}" y="${y - 11}" width="${w}" height="20" rx="5"/><text x="${x1}" y="${y + 3}" text-anchor="middle">${esc(m.label)}</text></g>`;
      }
      const dir = x2 > x1 ? 1 : -1, xs = x1 + dir * 4, xe = m.lost ? (x1 + x2) / 2 : x2 - dir * 5;
      const head = m.lost ? `<path class="ax-x" d="M${xe - 6},${y - 6} L${xe + 6},${y + 6} M${xe - 6},${y + 6} L${xe + 6},${y - 6}"/>`
        : `<polygon class="ax-ah ${m.cls || ""}" points="${xe},${y} ${xe - dir * 9},${y - 4.5} ${xe - dir * 9},${y + 4.5}"/>`;
      return `<path class="ax-e ${m.cls || ""} ${m.dash ? "dash" : ""}" d="M${xs},${y} L${xe},${y}"/>${head}` +
        `<text class="ax-ml ${m.cls || ""}" x="${(xs + (m.lost ? xe : x2)) / 2}" y="${y - 5}" text-anchor="middle">${esc(m.label)}</text>`;
    }).join("");
    return `<svg class="ax-g ax-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">${heads}${ms}</svg>`;
  }

  /* =====================================================================
   * 1. One feature ("place order"), four styles: runtime calls vs source dependencies
   * ===================================================================== */
  const N = (k, title, sub, x, y, ring, o = {}) => ({ k, title, sub, x, y, ring, ...o });
  const RING_BANDS = (labels) => [
    { x: 4, y: 4, w: 932, h: 442, label: labels[0], cls: "r3" },
    { x: 140, y: 34, w: 660, h: 382, label: labels[1], cls: "r2" },
    { x: 276, y: 64, w: 388, h: 322, label: labels[2], cls: "r1" },
    ...(labels[3] ? [{ x: 410, y: 180, w: 120, h: 100, label: labels[3], cls: "r0", lx: 418, ly: 196 }] : []),
  ];
  const STYLES = {
    "layered (n-tier)": {
      kind: "layers", ringNames: ["presentation", "business logic", "data access", "database & SDKs"], libRing: 3, edgeRing: 2,
      bands: ["Presentation", "Business logic", "Data access", "Database & SDKs"].map((label, i) => ({ x: 4, y: 8 + i * 100, w: 932, h: 84, label, cls: i === 1 ? "r1" : "plain" })),
      nodes: [
        N("ctrl", "OrdersController", "MVC controller", 470, 50, 0),
        N("svc", "OrderService", "rules + transaction", 470, 150, 1, { core: true }),
        N("ent", "OrderEntity", "EF entity, public setters", 230, 250, 2),
        N("repo", "OrderRepository", "uses DbContext", 470, 250, 2),
        N("pay", "PaymentClient", "Stripe wrapper", 710, 250, 2),
        N("sql", "SQL Server", "orders table", 470, 350, 3, { infra: true, shape: "db", w: 130, h: 46 }),
        N("stripe", "Stripe API", "HTTP + SDK", 710, 350, 3, { infra: true }),
      ],
      calls: [
        ["ctrl", "svc", "PlaceOrder(dto)", "The controller parses HTTP and hands a DTO to the business layer. So far every style looks the same."],
        ["svc", "ent", "new + set props", "The business layer builds the order by setting properties on <b>OrderEntity</b>, which is the EF class from the <b>data</b> layer. The rules live in the service; the entity is a bag of fields."],
        ["svc", "pay", "Charge(total)", "Charging the card: the service calls the concrete <b>PaymentClient</b> one layer down."],
        ["pay", "stripe", "POST /charges", "The client talks to Stripe over HTTP."],
        ["svc", "repo", "Save(entity)", "Persist: the service calls the concrete repository."],
        ["repo", "sql", "INSERT orders", "The repository issues SQL. The request has travelled straight down and will return straight up."],
      ],
      deps: [
        ["ctrl", "svc", "", "Controller imports OrderService: down one layer. Allowed."],
        ["svc", "ent", "", "OrderService imports <b>OrderEntity</b>, a data-layer type. Down one layer: allowed. But notice what it means: the business logic's vocabulary is the database schema."],
        ["svc", "pay", "", "OrderService imports the concrete PaymentClient: allowed (down one layer)."],
        ["svc", "repo", "", "OrderService imports the concrete OrderRepository: allowed."],
        ["repo", "ent", "", "Repository and entity sit in the same layer: allowed."],
        ["pay", "stripe", "", "The data layer depends on the Stripe SDK: that is its job."],
        ["repo", "sql", "", "The data layer depends on the SQL driver / EF Core: that is its job."],
      ],
      shortcut: ["svc", "sql", "new SqlConnection()", "A developer in a hurry opens a <code>SqlConnection</code> inside OrderService to run one report query. Business → database skips the data layer, so the <b>strict</b> layering rule rejects it."],
    },
    "hexagonal (ports & adapters)": {
      kind: "rings", ringNames: ["application core", "adapters", "outside world"], libRing: 2, edgeRing: 1,
      bands: RING_BANDS(["Outside world", "Adapters", "Application core: domain + use cases + ports"]),
      nodes: [
        N("http", "HTTP client", "browser / app", 72, 228, 2, { w: 120 }),
        N("ctrl", "Controller", "driving adapter", 208, 228, 1, { w: 124 }),
        N("inPort", "IPlaceOrder", "driving port", 344, 228, 0, { shape: "iface", w: 124 }),
        N("svc", "PlaceOrder", "use case", 470, 120, 0, { core: true, w: 124 }),
        N("ord", "Order", "aggregate", 470, 232, 0, { core: true, w: 100 }),
        N("repoPort", "OrderRepo", "driven port", 596, 170, 0, { shape: "iface", w: 116 }),
        N("payPort", "Payments", "driven port", 596, 300, 0, { shape: "iface", w: 116 }),
        N("sqlA", "SqlOrderRepo", "driven adapter", 732, 170, 1, { w: 124 }),
        N("stripeA", "StripeAdapter", "driven adapter", 732, 300, 1, { w: 124 }),
        N("sql", "SQL Server", "", 868, 170, 2, { infra: true, shape: "db", w: 118, h: 46 }),
        N("stripe", "Stripe API", "", 868, 300, 2, { infra: true, w: 118 }),
      ],
      calls: [
        ["http", "ctrl", "POST /orders", "A request arrives at a <b>driving adapter</b>: the thing that drives the application (HTTP here; a CLI, a test or a queue consumer are other driving adapters)."],
        ["ctrl", "svc", "place(cmd)", "The controller calls the use case through the <b>driving port</b> IPlaceOrder. At runtime the call lands on PlaceOrder."],
        ["svc", "ord", "Order.place()", "The use case asks the <b>Order</b> aggregate to apply the business rules. Order has no idea HTTP or SQL exist."],
        ["svc", "stripeA", "charge()", "The use case calls its <b>Payments</b> port. At runtime the object behind that port is the Stripe adapter, which the composition root plugged in.", 60],
        ["stripeA", "stripe", "POST /charges", "The adapter translates the port call into Stripe's API."],
        ["svc", "sqlA", "save(order)", "The use case calls its <b>OrderRepo</b> port; the SQL adapter is behind it at runtime.", -40],
        ["sqlA", "sql", "INSERT", "The adapter speaks SQL. Runtime flow: in from the left, out to the right. <b>Same calls as layered.</b>"],
      ],
      deps: [
        ["ctrl", "inPort", "uses", "The controller's source names only the port. It points <b>inward</b>, into the core."],
        ["svc", "inPort", "implements", "The use case implements the driving port. Same ring: fine."],
        ["svc", "ord", "", "The use case uses the aggregate. Same ring."],
        ["svc", "repoPort", "", "The use case depends on <b>OrderRepo</b>, an interface the core <b>owns</b> and words in its own language (no SQL types)."],
        ["svc", "payPort", "", "Same for Payments: the core declares what it needs."],
        ["sqlA", "repoPort", "implements", "Here is the flip. The SQL adapter imports the core's port to implement it. At runtime the core calls the adapter, but in source the adapter depends on the core: <b>dependency inversion</b>."],
        ["stripeA", "payPort", "implements", "The Stripe adapter also points inward at the port it implements."],
        ["sqlA", "sql", "", "Only adapters touch drivers and SDKs."],
        ["stripeA", "stripe", "", "Only adapters touch drivers and SDKs."],
      ],
      shortcut: ["svc", "sqlA", "new SqlOrderRepo()", "Someone writes <code>new SqlOrderRepo()</code> inside the use case. The runtime path is identical, but the core now <b>imports an adapter</b>: an arrow pointing outward."],
    },
    onion: {
      kind: "rings", ringNames: ["domain model", "domain services", "application services", "infrastructure · UI · tests", "external"], libRing: 4, edgeRing: 3,
      bands: [
        { x: 140, y: 4, w: 660, h: 442, label: "Infrastructure · UI · Tests", cls: "r3" },
        { x: 276, y: 34, w: 388, h: 382, label: "Application services", cls: "r2" },
        { x: 398, y: 150, w: 144, h: 196, label: "Domain services", cls: "r1", lx: 406, ly: 166 },
        { x: 410, y: 176, w: 120, h: 100, label: "Domain model", cls: "r0", lx: 418, ly: 192 },
      ],
      nodes: [
        N("http", "HTTP client", "external", 66, 228, 4, { w: 116 }),
        N("ctrl", "Controller", "UI", 208, 228, 3, { w: 124 }),
        N("app", "OrderAppService", "application service", 470, 90, 2, { core: true }),
        N("ord", "Order", "entity + rules", 470, 232, 0, { core: true, w: 104 }),
        N("repoI", "IOrderRepo", "domain-svc ring", 470, 314, 1, { shape: "iface", w: 128 }),
        N("payI", "IPayments", "app-level port", 602, 232, 2, { shape: "iface", w: 112 }),
        N("efRepo", "EfOrderRepo", "infrastructure", 732, 150, 3, { w: 124 }),
        N("stripeG", "StripeGateway", "infrastructure", 732, 314, 3, { w: 124 }),
        N("sql", "SQL Server", "", 874, 150, 4, { infra: true, shape: "db", w: 112, h: 46 }),
        N("stripe", "Stripe API", "", 874, 314, 4, { infra: true, w: 112 }),
      ],
      calls: [
        ["http", "ctrl", "POST /orders", "The UI sits in the outermost ring of the onion, alongside infrastructure and tests."],
        ["ctrl", "app", "PlaceOrder(cmd)", "The controller calls an <b>application service</b>, which orchestrates one use case."],
        ["app", "ord", "new Order(...)", "The domain model in the centre enforces the rules."],
        ["app", "stripeG", "Charge()", "Charging goes through <b>IPayments</b>; the infrastructure class sits behind it at runtime.", 70],
        ["stripeG", "stripe", "POST /charges", "Infrastructure talks to Stripe."],
        ["app", "efRepo", "Add(order)", "Saving goes through <b>IOrderRepo</b>, declared in the domain-services ring; EF implements it at runtime.", -30],
        ["efRepo", "sql", "INSERT", "Infrastructure talks to SQL. Again: the same runtime path as every other style."],
      ],
      deps: [
        ["ctrl", "app", "", "UI → application services: outer to inner, allowed."],
        ["app", "ord", "", "Application → domain model: inward."],
        ["app", "repoI", "", "Application → repository interface in the domain-services ring: inward. Onion's signature move is that <b>repository interfaces live in the domain</b>.", 150],
        ["app", "payI", "", "Application → its own port: same ring."],
        ["efRepo", "repoI", "implements", "EF repository (outer ring) implements the domain's interface: an arrow pointing inward, against the runtime flow."],
        ["stripeG", "payI", "implements", "The gateway implements the application's port: inward."],
        ["efRepo", "sql", "", "Only the outer ring touches the database driver."],
        ["stripeG", "stripe", "", "Only the outer ring touches the SDK."],
      ],
      shortcut: ["app", "efRepo", "new EfOrderRepo()", "The application service news up <b>EfOrderRepo</b> directly. Application (ring 2) now imports infrastructure (ring 3): an outward arrow."],
    },
    clean: {
      kind: "rings", ringNames: ["entities", "use cases", "interface adapters", "frameworks & drivers"], libRing: 3, edgeRing: 2,
      bands: RING_BANDS(["Frameworks & drivers", "Interface adapters", "Use cases (application business rules)", "Entities"]),
      nodes: [
        N("web", "ASP.NET Core", "web framework", 72, 228, 3, { w: 124 }),
        N("ctrl", "Controller", "OrdersController", 208, 228, 2, { w: 124 }),
        N("inPort", "IPlaceOrder", "input port", 344, 228, 1, { shape: "iface", w: 124 }),
        N("uc", "Interactor", "PlaceOrder", 470, 120, 1, { core: true, w: 124 }),
        N("ord", "Order", "entity", 470, 232, 0, { core: true, w: 100 }),
        N("gw", "IOrderGateway", "output port", 596, 170, 1, { shape: "iface", w: 120 }),
        N("payP", "IPayments", "output port", 596, 300, 1, { shape: "iface", w: 120 }),
        N("sqlG", "SqlGateway", "SqlOrderGateway", 732, 170, 2, { w: 124 }),
        N("stripeA", "StripeAdapter", "IPayments impl", 732, 300, 2, { w: 124 }),
        N("db", "EF Core + SQL", "", 868, 170, 3, { infra: true, shape: "db", w: 120, h: 46 }),
        N("stripe", "Stripe SDK", "", 868, 300, 3, { infra: true, w: 120 }),
      ],
      calls: [
        ["web", "ctrl", "route request", "The framework (outermost ring) routes the request to your controller."],
        ["ctrl", "uc", "Execute(input)", "The controller converts HTTP into a plain <b>input model</b> and calls the interactor through its <b>input port</b>."],
        ["uc", "ord", "Order.Place()", "The interactor (application rules) asks the entity (enterprise rules) to validate and change state."],
        ["uc", "stripeA", "Charge()", "The interactor calls its <b>output port</b> IPayments; the adapter is behind it.", 60],
        ["stripeA", "stripe", "charges.create", "The adapter calls the Stripe SDK."],
        ["uc", "sqlG", "Save(order)", "The interactor calls IOrderGateway; the SQL gateway is behind it.", -40],
        ["sqlG", "db", "SaveChanges", "EF Core writes to SQL. Same runtime path as every other style, again."],
      ],
      deps: [
        ["ctrl", "inPort", "uses", "Controller → input port: inward."],
        ["uc", "inPort", "implements", "The interactor implements its input port (same ring)."],
        ["uc", "ord", "", "Use case → entity: inward."],
        ["uc", "gw", "", "The use case owns <b>IOrderGateway</b>, an output port in its own ring."],
        ["uc", "payP", "", "And owns <b>IPayments</b>."],
        ["sqlG", "gw", "implements", "The gateway (adapters ring) implements the use case's port: <b>inward</b>, against the runtime flow."],
        ["stripeA", "payP", "implements", "Inward again."],
        ["sqlG", "db", "", "Adapters are the only code that names EF Core."],
        ["stripeA", "stripe", "", "Adapters are the only code that names the SDK."],
      ],
      shortcut: ["uc", "sqlG", "new SqlGateway()", "The interactor news up <b>SqlGateway</b>. Use cases (ring 1) now import interface adapters (ring 2): the arrow points outward and the Dependency Rule is broken."],
    },
  };

  function depAllowed(S, ring, u, v) {
    const a = ring.get(u), b = ring.get(v);
    if (S.kind === "layers") return b - a === 0 || b - a === 1 ? [true, b === a ? "same layer" : "one layer down"] : [false, b > a ? `skips ${b - a - 1} layer(s)` : "points up"];
    if (b === S.libRing) return a >= S.edgeRing ? [true, "outer ring uses a library"] : [false, "inner ring touches a driver/SDK"];
    return b <= a ? [true, b === a ? "same ring" : "points inward"] : [false, "points outward"];
  }

  function bfsPath(starts, targets, edges) {
    const adj = new Map();
    edges.forEach(([u, v]) => { if (!adj.has(u)) adj.set(u, []); adj.get(u).push(v); });
    const prev = new Map(starts.map((s) => [s, null])), q = [...starts];
    while (q.length) {
      const u = q.shift();
      if (targets.has(u)) { const p = []; for (let x = u; x !== null; x = prev.get(x)) p.unshift(x); return p; }
      for (const v of adj.get(u) || []) if (!prev.has(v)) { prev.set(v, u); q.push(v); }
    }
    return null;
  }

  function buildStyles({ style, shortcut }) {
    const S = STYLES[style];
    if (!S) throw new Error("Pick one of the four styles.");
    const ring = new Map(S.nodes.map((n) => [n.k, n.ring]));
    const deps = S.deps.concat(shortcut === "none" ? [] : [[S.shortcut[0], S.shortcut[1], S.shortcut[2], S.shortcut[3], 0, true]]);
    const frames = [];
    const name = (k) => S.nodes.find((n) => n.k === k).title;
    const core = S.nodes.filter((n) => n.core).map((n) => n.k), infra = new Set(S.nodes.filter((n) => n.infra).map((n) => n.k));
    let viol = 0, checked = 0;
    frames.push({ S, phase: "intro", edges: [], nc: {}, line: 0,
      note: `<b>${esc(style)}</b>: the same “place order” feature. First we follow what happens at <b>runtime</b>; then we read the <b>source code</b> and draw who imports whom. The two pictures differ, and that difference is the whole point of the style.`,
      vars: { style, phase: "intro", calls: 0, "deps checked": 0, violations: 0 } });
    S.calls.forEach((c, i) => {
      const edges = S.calls.slice(0, i + 1).map(([u, v, label, , curve], j) => ({ u, v, label: j === i ? label : "", cls: j === i ? "active" : "visit", dash: true, curve }));
      const nc = {}; S.calls.slice(0, i).forEach(([u, v]) => { nc[u] = "visit"; nc[v] = "visit"; });
      nc[c[0]] = "visit"; nc[c[1]] = "active";
      frames.push({ S, phase: "runtime", edges, nc, line: 1, note: `<b>Runtime ${i + 1}/${S.calls.length}:</b> ${c[3]}`,
        vars: { style, phase: "runtime calls", call: `${name(c[0])} → ${name(c[1])}`, calls: i + 1, "deps checked": 0, violations: 0 } });
    });
    frames.push({ S, phase: "turn", edges: S.calls.map(([u, v, , , curve]) => ({ u, v, cls: "", dash: true, curve })), nc: {}, line: 2,
      note: `That was the <b>runtime</b> view: control flows from the request out to the database, in every style. Now forget runtime and open the files: which type does each file <b>import</b> (name in its source)? Those arrows decide what you must recompile, retest and understand when something changes.`,
      vars: { style, phase: "switch to source", calls: S.calls.length, "deps checked": 0, violations: 0 } });
    const depEdges = [];
    deps.forEach(([u, v, label, why, curve, isShort]) => {
      const [ok, reason] = depAllowed(S, ring, u, v);
      checked++; if (!ok) viol++;
      depEdges.push({ u, v, label: label || (isShort ? "new" : ""), cls: ok ? "done" : "bad", curve: curve || (isShort ? -50 : 0) });
      const nc = { [u]: ok ? "active" : "bad", [v]: ok ? "visit" : "bad" };
      frames.push({ S, phase: "deps", edges: depEdges.map((e, j) => ({ ...e, label: j === depEdges.length - 1 ? e.label || reason : e.label })), nc, line: [3, 4, 5, 6, 7],
        note: `<b>${esc(name(u))} → ${esc(name(v))}</b> (${S.ringNames[ring.get(u)]} → ${S.ringNames[ring.get(v)]}): <b>${ok ? "allowed" : "VIOLATION"}</b>, ${reason}. ${why}`,
        vars: { style, phase: "source deps", rule: S.kind === "layers" ? "strict: next layer down" : "inward only", "deps checked": checked, violations: viol } });
    });
    const p = bfsPath(core, infra, deps.map(([u, v]) => [u, v]));
    const pe = new Set(); if (p) for (let i = 0; i + 1 < p.length; i++) pe.add(`${p[i]}>${p[i + 1]}`);
    const nc = {}; (p || []).forEach((k) => (nc[k] = "path"));
    if (!p) core.forEach((k) => (nc[k] = "done"));
    frames.push({ S, phase: "verdict", edges: depEdges.map((e) => ({ ...e, label: pe.has(`${e.u}>${e.v}`) ? "reaches" : e.label, cls: pe.has(`${e.u}>${e.v}`) ? "path" : e.cls })), nc, line: [8, 9],
      note: p
        ? `<b>Verdict:</b> the business rules can reach infrastructure through source dependencies: <b>${p.map((k) => esc(name(k))).join(" → ")}</b>. ${S.kind === "layers" && !viol ? "Every arrow is <i>legal</i> for layering, yet the rules still compile against the database: changing the schema or the ORM ripples up into business code, and a unit test of the rules needs a database or heavy mocks." : "The shortcut drags a concrete driver into the core. Tests of the core now need that adapter's dependencies, and swapping the adapter means editing the core."}`
        : `<b>Verdict:</b> no path from the core (${core.map((k) => esc(name(k))).join(", ")}) to any driver or SDK. Every source arrow points inward, while runtime calls still flow outward. The core can be compiled, tested and reasoned about with <b>no database, no HTTP and no Stripe</b>: plug fakes into the ports.`,
      vars: { style, phase: "verdict", "deps checked": checked, violations: viol, "core → infra": p ? "reachable" : "unreachable" } });
    return frames;
  }

  Viz.register("application-architecture-styles", (host) => Viz.player(host, {
    title: "Same feature, four styles: runtime calls vs source dependencies", tag: "STEP THROUGH · DEPENDENCY RULE",
    legend: [["active", "current call / importer"], ["visit", "runtime call (dashed)"], ["done", "allowed source dependency"], ["bad", "violation"], ["path", "core reaches infrastructure"]],
    code: [
      "// the request, at runtime",
      "for (call of runtimeCalls) invoke(call.from, call.to)",
      "// now read the imports instead",
      "for ([src, dst] of sourceDeps) {",
      "  ok = layered ? layer(dst) - layer(src) in {0, 1}",
      "     : isDriver(dst) ? src is outermost code ring",
      "     : ring(dst) <= ring(src)        // inward only",
      "  report(src, dst, ok)",
      "}",
      "path = bfs(coreTypes, driversAndSdks, sourceDeps)",
    ], codeLang: "typescript",
    inputs: [
      { key: "style", label: "style", type: "select", options: Object.keys(STYLES), value: "layered (n-tier)" },
      { key: "shortcut", label: "inject a shortcut", type: "select", options: ["none", "core news up a concrete class"], value: "none" },
    ],
    random: () => ({ style: pick(Object.keys(STYLES)), shortcut: pick(["none", "core news up a concrete class"]) }),
    build: buildStyles,
    speed: 1500,
    render: (f) => {
      const nodes = f.S.nodes.map((n) => ({ ...n, cls: f.nc[n.k] || (f.phase === "intro" ? "" : f.phase === "verdict" && !f.nc[n.k] ? "dim" : "") }));
      return diagram({ nodes, edges: f.edges, bands: f.S.bands, view: [0, 0, 940, 450], label: "architecture style dependency diagram" });
    },
  }));

  /* =====================================================================
   * 2. Architecture rule checker (what ArchUnit / NetArchTest / import-linter do)
   * ===================================================================== */
  const RULES = ["inward only (rings)", "layered strict", "layered relaxed"];
  function parseModules(s) {
    const mods = items(s, "modules", 2, 7).map((t) => {
      const m = t.match(/^([A-Za-z][\w.]*)\s*:\s*(\d)$/);
      if (!m) throw new Error(`modules: “${t}” should look like Name:level, e.g. Domain:0.`);
      return { k: m[1], lvl: Number(m[2]) };
    });
    const seen = new Set();
    mods.forEach((m) => { if (seen.has(m.k)) throw new Error(`modules: “${m.k}” is listed twice.`); seen.add(m.k); if (m.lvl > 4) throw new Error("modules: levels go from 0 to 4."); });
    return mods;
  }
  function parseDeps(s, mods) {
    const names = new Set(mods.map((m) => m.k));
    const out = items(s, "dependencies", 1, 14).map((t) => {
      const m = t.match(/^([\w.]+)\s*->\s*([\w.]+)$/);
      if (!m) throw new Error(`dependencies: “${t}” should look like A->B.`);
      [m[1], m[2]].forEach((x) => { if (!names.has(x)) throw new Error(`dependencies: “${x}” is not in the module list.`); });
      if (m[1] === m[2]) throw new Error(`dependencies: “${t}” points at itself.`);
      return [m[1], m[2]];
    });
    const keys = out.map((d) => d.join(">"));
    if (new Set(keys).size !== keys.length) throw new Error("dependencies: an arrow is listed twice.");
    return out;
  }
  function findCycles(mods, deps) {
    const adj = new Map(mods.map((m) => [m.k, []]));
    deps.forEach(([u, v]) => adj.get(u).push(v));
    const color = new Map(), stack = [], cycles = [], trace = [];
    const dfs = (u) => {
      color.set(u, 1); stack.push(u); trace.push({ at: u, stack: [...stack] });
      for (const v of adj.get(u)) {
        if (color.get(v) === 1) cycles.push(stack.slice(stack.indexOf(v)).concat(v));
        else if (!color.get(v)) dfs(v);
      }
      color.set(u, 2); stack.pop();
    };
    mods.forEach((m) => { if (!color.get(m.k)) dfs(m.k); });
    return { cycles, trace };
  }
  function ruleCheck(rule, a, b) {
    if (rule === RULES[0]) return b <= a ? [true, b === a ? "same ring" : "points inward"] : [false, `points outward (ring ${a} → ${b})`];
    if (b < a) return [false, `points up (layer ${a} → ${b})`];
    if (rule === RULES[1] && b - a > 1) return [false, `skips ${b - a - 1} layer(s)`];
    return [true, b === a ? "same layer" : b - a === 1 ? "next layer down" : "lower layer (relaxed)"];
  }
  function buildRules({ modules, deps, rule }) {
    if (!RULES.includes(rule)) throw new Error("Pick a rule.");
    const mods = parseModules(modules), D = parseDeps(deps, mods);
    const lvl = new Map(mods.map((m) => [m.k, m.lvl]));
    const levels = [...new Set(mods.map((m) => m.lvl))].sort((x, y) => x - y);
    const rowOf = (l) => levels.indexOf(l);
    const pos = new Map();
    levels.forEach((l) => {
      const row = mods.filter((m) => m.lvl === l);
      row.forEach((m, i) => pos.set(m.k, { x: 380 + (i - (row.length - 1) / 2) * 190, y: 46 + rowOf(l) * 92 }));
    });
    const H = 20 + levels.length * 92;
    const ringWord = rule === RULES[0] ? "ring" : "layer";
    const bands = levels.map((l, i) => ({ x: 6, y: 8 + i * 92, w: 748, h: 78, label: `${ringWord} ${l}${rule === RULES[0] ? (l === levels[0] ? " · innermost" : "") : (i === 0 ? " · top" : "")}`, cls: rule === RULES[0] ? `r${Math.min(3, i)}` : "plain" }));
    const twin = new Set(D.map(([u, v]) => `${u}>${v}`));
    const shape = (u, v) => {
      const a = pos.get(u), b = pos.get(v);
      if (a.y === b.y) return 46;
      return twin.has(`${v}>${u}`) ? 22 : 0;
    };
    const frames = [], results = [];
    const base = (extra) => ({ mods, pos, bands, H, ...extra });
    frames.push(base({ edges: D.map(([u, v]) => ({ u, v, curve: shape(u, v) })), nc: {}, line: 0,
      note: `${mods.length} modules and ${D.length} dependency arrows (A->B means “A's code imports B”). Rule: <b>${esc(rule)}</b>. An architecture test walks every arrow and fails the build on the first one that breaks the rule, exactly like a unit test.`,
      vars: { rule, modules: mods.length, arrows: D.length, checked: 0, violations: 0 } }));
    D.forEach(([u, v], i) => {
      const [ok, why] = ruleCheck(rule, lvl.get(u), lvl.get(v));
      results.push({ u, v, ok, why });
      const edges = D.map(([a, b], j) => ({ u: a, v: b, curve: shape(a, b), cls: j < i ? (results[j].ok ? "done" : "bad") : j === i ? (ok ? "active" : "bad") : "", label: j === i ? why : "" }));
      frames.push(base({ edges, nc: { [u]: ok ? "active" : "bad", [v]: ok ? "visit" : "bad" }, line: [1, 2, 3],
        note: `<b>${esc(u)} → ${esc(v)}</b>: ${ok ? "passes" : "<b>fails</b>"}, ${esc(why)}.${ok ? "" : rule === RULES[0] ? " An inner module may not know an outer one; that is how a database or framework leaks into the core." : " Layering only allows calls downward" + (rule === RULES[1] ? ", one step at a time." : ".")}`,
        vars: { rule, arrow: `${u} → ${v}`, checked: i + 1, violations: results.filter((r) => !r.ok).length } }));
    });
    const { cycles } = findCycles(mods, D);
    const cyc = cycles[0];
    const cycEdges = new Set(); if (cyc) for (let i = 0; i + 1 < cyc.length; i++) cycEdges.add(`${cyc[i]}>${cyc[i + 1]}`);
    const fin = D.map(([a, b], j) => ({ u: a, v: b, curve: shape(a, b), cls: cycEdges.has(`${a}>${b}`) ? "path" : results[j].ok ? "done" : "bad" }));
    const nc = {}; (cyc || []).forEach((k) => (nc[k] = "path"));
    frames.push(base({ edges: fin, nc, line: [4, 5],
      note: cyc ? `Depth-first search found a <b>cycle</b>: ${cyc.map(esc).join(" → ")}. Cycles are the worst architecture smell: you cannot build, test, version or understand either module without the other. Most tools have a dedicated “slices should be free of cycles” rule.`
        : "Depth-first search found <b>no cycles</b>: the modules form a DAG, so they can be built and tested bottom-up.",
      vars: { rule, checked: D.length, violations: results.filter((r) => !r.ok).length, cycles: cycles.length } }));
    const bad = results.filter((r) => !r.ok);
    const fix = (r) => rule === RULES[0]
      ? `${r.u} declares an interface it needs; ${r.v} implements it (arrow becomes ${r.v} → ${r.u})`
      : lvl.get(r.v) < lvl.get(r.u) ? `move the shared type down, or have ${r.v} publish an event ${r.u} handles` : `go through the layer in between, or switch to the relaxed rule deliberately`;
    frames.push(base({ edges: fin, nc: Object.fromEntries(bad.flatMap((r) => [[r.u, "bad"], [r.v, "bad"]])), line: 6, summary: bad.map((r) => ({ c: [esc(`${r.u} → ${r.v}`), esc(r.why), `<span class="wrap">${esc(fix(r))}</span>`], cls: "bad" })),
      note: bad.length || cyc ? `<b>Build fails</b>: ${bad.length} rule violation(s)${cyc ? " and a cycle" : ""}. The usual fix for an outward arrow is the one from the styles visualizer: <b>invert it with a port</b>.` : "<b>Build passes.</b> Keep this test in CI and the architecture can no longer rot silently.",
      vars: { rule, violations: bad.length, cycles: cycles.length, result: bad.length || cyc ? "FAIL" : "PASS" } }));
    return frames;
  }
  Viz.register("application-architecture-rule-checker", (host) => Viz.player(host, {
    title: "Architecture test: check every import against the rule", tag: "EDIT · RUN · FAIL THE BUILD",
    legend: [["active", "arrow being checked"], ["done", "passes"], ["bad", "violates the rule"], ["path", "dependency cycle"]],
    code: [
      "for (const [a, b] of imports) {",
      "  const ok = rule.allows(level(a), level(b))",
      "  if (!ok) violations.push({ a, b })",
      "}",
      "const cycles = dfs(modules, imports)",
      "  .filter(backEdge)",
      "assert(violations.length === 0 && !cycles.length)",
    ], codeLang: "typescript",
    inputs: [
      { key: "modules", label: "modules (Name:level)", value: "Api:2; Infrastructure:2; Application:1; Domain:0", width: 330 },
      { key: "deps", label: "imports (A->B)", value: "Api->Application; Application->Domain; Infrastructure->Domain; Application->Infrastructure; Infrastructure->Application", width: 520 },
      { key: "rule", label: "rule", type: "select", options: RULES, value: RULES[0] },
    ],
    random: () => {
      const names = ["Web", "Workers", "Orders", "Billing", "Domain", "Data"].slice(0, 4 + Math.floor(Math.random() * 3));
      const mods = names.map((n, i) => `${n}:${i === names.length - 1 ? 0 : Math.min(2, Math.floor(i / 2) + (i > 3 ? 1 : 0))}`);
      const D = new Set();
      while (D.size < Math.min(9, names.length + 2)) { const a = pick(names), b = pick(names); if (a !== b) D.add(`${a}->${b}`); }
      return { modules: mods.join("; "), deps: [...D].join("; "), rule: pick(RULES) };
    },
    build: buildRules,
    speed: 1300,
    render: (f) => {
      const nodes = f.mods.map((m) => ({ k: m.k, title: m.k, sub: `level ${m.lvl}`, x: f.pos.get(m.k).x, y: f.pos.get(m.k).y, w: 140, cls: f.nc[m.k] || "" }));
      const svg = diagram({ nodes, edges: f.edges, bands: f.bands, view: [0, 0, 760, f.H], label: "module dependency graph" });
      return f.summary ? `<div class="ax-stack">${svg}${tbl("violations and the usual fix", ["arrow", "why", "fix"], f.summary, { empty: "none: build passes", cols: "auto auto minmax(260px, 1fr)", html: true })}</div>` : svg;
    },
  }));

  /* =====================================================================
   * 3. Technical folders vs vertical slices: what one change touches
   * ===================================================================== */
  const TECH = {
    Controllers: ["OrdersController", "CustomersController", "ProductsController"],
    Services: ["IOrderService", "OrderService", "CustomerService", "ProductService"],
    Repositories: ["OrderRepository", "CustomerRepository", "ProductRepository"],
    Models: ["Order", "Customer", "Product"],
    Dtos: ["OrderDtos", "CustomerDtos", "ProductDtos"],
    Validators: ["OrderValidators", "CustomerValidators"],
    Mappers: ["OrderMapper", "ProductMapper"],
  };
  const SLICE = {
    "Features/Orders": ["PlaceOrder", "GetOrder", "CancelOrder*"],
    "Features/Customers": ["RegisterCustomer", "GetCustomer"],
    "Features/Catalog": ["AddProduct", "ListProducts*"],
    Domain: ["Order", "Customer", "Product"],
    Infrastructure: ["AppDbContext"],
  };
  const CHANGES = {
    "add a gift note to PlaceOrder": { tech: ["OrdersController", "OrderDtos", "OrderValidators", "OrderService", "OrderMapper", "Order"], slice: ["PlaceOrder", "Order"] },
    "add a CancelOrder endpoint": { tech: ["OrdersController", "IOrderService", "OrderService", "OrderRepository", "OrderDtos", "Order"], slice: ["CancelOrder*", "Order"] },
    "tighten customer registration rules": { tech: ["CustomerValidators", "CustomerService", "CustomerDtos"], slice: ["RegisterCustomer"] },
    "add a ListProducts query": { tech: ["ProductsController", "ProductService", "ProductRepository", "ProductDtos", "ProductMapper"], slice: ["ListProducts*"] },
    "add a loyalty discount to orders": { tech: ["Order", "OrderService", "OrderDtos", "OrderMapper", "CustomerRepository"], slice: ["Order", "PlaceOrder"] },
  };
  const folderOf = (tree, f) => Object.keys(tree).find((d) => tree[d].includes(f));
  function buildFolders({ a, b }) {
    if (!CHANGES[a] || !CHANGES[b]) throw new Error("Pick two changes.");
    if (a === b) throw new Error("Pick two different changes so you can see whether they collide.");
    const frames = [];
    const st = (layout) => {
      const key = layout === "tech" ? "tech" : "slice", tree = layout === "tech" ? TECH : SLICE;
      const A = CHANGES[a][key], B = CHANGES[b][key], both = A.filter((x) => B.includes(x));
      return { A, B, both, foldersA: new Set(A.map((f) => folderOf(tree, f))), foldersB: new Set(B.map((f) => folderOf(tree, f))) };
    };
    const T = st("tech"), S = st("slice");
    const mk = (show, extra) => ({ show, T, S, ...extra });
    frames.push(mk({}, { line: 0, note: "Same app, two layouts. <b>Left</b>: folders by technical kind (Controllers, Services, Repositories…). <b>Right</b>: folders by feature, one file per use case (endpoint + handler + validator + DTOs together), with a shared Domain. Files marked * do not exist yet.",
      vars: { "change A": a, "change B": b } }));
    frames.push(mk({ tA: true }, { line: 1, note: `Change A, <b>${esc(a)}</b>, in the technical layout: ${T.A.length} files across <b>${T.foldersA.size} folders</b>. One feature is smeared across the tree, so you need to know where all the pieces live.`,
      vars: { layout: "technical", "A files": T.A.length, "A folders": T.foldersA.size } }));
    frames.push(mk({ tA: true, tB: true }, { line: [1, 2], note: `Meanwhile a teammate does change B, <b>${esc(b)}</b>: ${T.B.length} files in ${T.foldersB.size} folders. <b>${T.both.length} file(s) are edited by both</b>${T.both.length ? ` (${T.both.map(esc).join(", ")}): merge conflicts and accidental coupling.` : "."}`,
      vars: { layout: "technical", "A files": T.A.length, "B files": T.B.length, "shared files": T.both.length } }));
    frames.push(mk({ tA: true, tB: true, sA: true }, { line: 3, note: `Change A in the slice layout: <b>${S.A.length} file(s) in ${S.foldersA.size} folder(s)</b>. ${S.A.some((f) => f.endsWith("*")) ? "A new use case is a new file, so nothing existing is edited except, possibly, the domain model." : "The use case file holds everything about this request; only real domain rules go to Domain."}`,
      vars: { layout: "slices", "A files": S.A.length, "A folders": S.foldersA.size } }));
    frames.push(mk({ tA: true, tB: true, sA: true, sB: true }, { line: [3, 4], note: `Change B in the slice layout: ${S.B.length} file(s). Shared with A: <b>${S.both.length}</b>${S.both.length ? ` (${S.both.map(esc).join(", ")}): the domain model, which is exactly the place where two features <i>should</i> meet and be reviewed together.` : ". The two changes cannot conflict."}`,
      vars: { layout: "slices", "A files": S.A.length, "B files": S.B.length, "shared files": S.both.length } }));
    frames.push(mk({ tA: true, tB: true, sA: true, sB: true, sum: true }, { line: 5, note: `Totals for both changes: technical folders touch <b>${new Set([...T.A, ...T.B]).size}</b> files with ${T.both.length} collision(s); slices touch <b>${new Set([...S.A, ...S.B]).size}</b> with ${S.both.length}. Organise around what changes together (the feature), not around what the code <i>is</i>. That is the Common Closure Principle applied to folders.`,
      vars: { "tech files": new Set([...T.A, ...T.B]).size, "slice files": new Set([...S.A, ...S.B]).size, "tech collisions": T.both.length, "slice collisions": S.both.length } }));
    return frames;
  }
  function renderTree(tree, Aset, Bset, title, stat) {
    const hit = (f) => (Aset.includes(f) && Bset.includes(f) ? "bad" : Aset.includes(f) ? "active" : Bset.includes(f) ? "visit" : f.endsWith("*") ? "dim" : "");
    const folders = Object.entries(tree).map(([d, fs]) => `<div class="ax-folder ${fs.some((f) => Aset.includes(f) || Bset.includes(f)) ? "hit" : ""}"><div class="ax-folder-h">${esc(d)}/</div>${fs.map((f) => chip(f.replace("*", "") + (f.endsWith("*") ? " (new)" : ""), hit(f))).join("")}</div>`).join("");
    return `<div class="ax-panel"><div class="ax-panel-h"><span>${esc(title)}</span><span>${esc(stat)}</span></div><div class="ax-folders">${folders}</div></div>`;
  }
  Viz.register("application-architecture-folders", (host) => Viz.player(host, {
    title: "Technical folders vs vertical slices: the blast radius of a change", tag: "PICK TWO CHANGES",
    legend: [["active", "touched by change A"], ["visit", "touched by change B"], ["bad", "touched by both (conflict risk)"]],
    code: [
      "touchedA = filesFor(changeA, layout)",
      "touchedB = filesFor(changeB, layout)",
      "conflicts = touchedA ∩ touchedB",
      "// repeat with the feature-sliced layout",
      "conflicts = sliceA ∩ sliceB   // usually just Domain",
      "compare(filesTouched, foldersTouched, conflicts)",
    ], codeLang: "typescript",
    inputs: [
      { key: "a", label: "change A", type: "select", options: Object.keys(CHANGES), value: Object.keys(CHANGES)[0] },
      { key: "b", label: "change B", type: "select", options: Object.keys(CHANGES), value: Object.keys(CHANGES)[1] },
    ],
    random: () => { const k = Object.keys(CHANGES), a = pick(k); return { a, b: pick(k.filter((x) => x !== a)) }; },
    build: buildFolders,
    speed: 2200,
    render: (f) => {
      const s = f.show, T = f.T, S = f.S;
      const left = renderTree(TECH, s.tA ? T.A : [], s.tB ? T.B : [], "by technical kind", s.tA ? `${new Set([...(s.tA ? T.A : []), ...(s.tB ? T.B : [])]).size} files` : "");
      const right = renderTree(SLICE, s.sA ? S.A : [], s.sB ? S.B : [], "by feature (vertical slices)", s.sA ? `${new Set([...(s.sA ? S.A : []), ...(s.sB ? S.B : [])]).size} files` : "");
      const sum = s.sum ? stats([["technical: files", new Set([...T.A, ...T.B]).size, ""], ["technical: folders", new Set([...T.foldersA, ...T.foldersB]).size, ""], ["technical: collisions", T.both.length, T.both.length ? "bad" : "done"], ["slices: files", new Set([...S.A, ...S.B]).size, ""], ["slices: folders", new Set([...S.foldersA, ...S.foldersB]).size, ""], ["slices: collisions", S.both.length, S.both.length ? "bad" : "done"]]) : "";
      return `<div class="ax-stack"><div class="ax-row">${left}${right}</div>${sum}</div>`;
    },
  }));

  /* =====================================================================
   * 4. CQRS: one model vs light CQRS vs async read model
   * ===================================================================== */
  const CQ_MODES = ["one model", "light CQRS (same DB)", "full CQRS (async read model)"];
  const CUST = { A: "Ada", B: "Bob", C: "Cy", D: "Dee", E: "Eve", F: "Fay" };
  function parseOps(s) {
    return items(s, "script", 2, 16).map((t) => {
      const m = t.match(/^(place)\s+([A-F])\s+(\d)$/i) || t.match(/^(pay|ship|cancel|get)\s+([A-F])$/i) || t.match(/^(list)$/i);
      if (!m) throw new Error(`script: “${t}” is not understood. Use place X n, pay X, ship X, cancel X, get X or list (ids A–F, n 1–9).`);
      const op = m[1].toLowerCase();
      if (op === "place" && (Number(m[3]) < 1)) throw new Error("script: place needs 1–9 items.");
      return { op, id: m[2] ? m[2].toUpperCase() : null, n: m[3] ? Number(m[3]) : 0, text: t };
    });
  }
  function buildCqrs({ mode, script, lag }) {
    if (!CQ_MODES.includes(mode)) throw new Error("Pick a mode.");
    const ops = parseOps(script), L = int(lag, "projector lag", 0, 3);
    const full = mode === CQ_MODES[2], light = mode === CQ_MODES[1];
    const W = new Map(), R = new Map(), pending = [], frames = [];
    let rows = 0, trips = 0, stale = 0, cmds = 0, queries = 0, step = 0;
    const snap = (extra) => ({ mode, full, W: [...W.values()].map((o) => ({ ...o })), R: [...R.values()].map((o) => ({ ...o })), pending: pending.map((e) => ({ ...e })), ...extra,
      vars: { mode: mode.split(" (")[0], commands: cmds, queries, "rows read": rows, "round-trips": trips, "stale reads": stale, ...(full ? { "events pending": pending.length } : {}), ...(extra.vars || {}) } });
    frames.push(snap({ line: 0, note: `${ops.length} operations. Commands (place, pay, ship, cancel) change state through the <b>Order</b> aggregate, which enforces the rules. Queries (get, list) only read. ${full ? `In this mode the read side is a separate table updated by a projector that runs <b>${L} operation(s) behind</b>.` : light ? "In this mode commands and queries share the database but take different code paths: queries skip the domain model and select exactly the columns the screen needs." : "In this mode everything goes through the same repository and the same domain objects."}` }));
    const project = (force) => {
      while (pending.length && (force || step - pending[0].at >= L)) {
        const e = pending.shift();
        const r = R.get(e.id) || { id: e.id, customer: CUST[e.id], items: 0, total: 0, status: "" };
        if (e.type === "OrderPlaced") Object.assign(r, { items: e.items, total: e.items * 25, status: "Placed" });
        else r.status = e.type.replace("Order", "");
        R.set(e.id, r);
        frames.push(snap({ line: 7, hiR: e.id, note: `Projector applies <b>${e.type}(${e.id})</b> to the read table. It denormalises once (customer name, total) so every future query is a single-row read with no joins.` }));
      }
    };
    ops.forEach((o) => {
      step++;
      if (o.op === "get" || o.op === "list") {
        queries++;
        const truth = o.op === "get" ? [W.get(o.id)].filter(Boolean) : [...W.values()];
        let res, readRows, readTrips, how;
        if (full) {
          res = o.op === "get" ? [R.get(o.id)].filter(Boolean) : [...R.values()];
          readRows = res.length; readTrips = 1; how = `SELECT * FROM order_summaries${o.op === "get" ? " WHERE id = @id" : ""}: ${res.length} row(s), no joins, no domain objects.`;
        } else if (light) {
          res = truth.map((w) => ({ id: w.id, customer: CUST[w.id], items: w.items, total: w.items * 25, status: w.status }));
          readRows = res.length; readTrips = 1; how = `One hand-written SQL projection (orders JOIN customers) straight into a DTO: ${res.length} row(s), current data, no aggregate loaded.`;
        } else {
          res = truth.map((w) => ({ id: w.id, customer: CUST[w.id], items: w.items, total: w.items * 25, status: w.status }));
          const lines = truth.reduce((a, w) => a + w.items, 0);
          readRows = truth.length + lines + truth.length; readTrips = 1 + 2 * truth.length;
          how = `Repository loads ${truth.length} aggregate(s) + ${lines} order line(s) + ${truth.length} customer(s) (${readTrips} round-trips if lazy-loaded), then maps entities to DTOs. The write model was built for invariants, not for screens.`;
        }
        rows += readRows; trips += readTrips;
        const isStale = res.length !== truth.length || res.some((r) => { const w = W.get(r.id); return !w || w.status !== r.status; });
        if (isStale) stale++;
        frames.push(snap({ line: full ? 6 : light ? 5 : 4, query: { text: o.text, res, stale: isStale }, note: `<b>${esc(o.text)}</b>: ${how}${isStale ? " <b>Stale:</b> the projector has not caught up, so the user sees an older state. Design the UI for that (show “processing”, or read your own writes from the write side)." : ""}`, vars: { op: o.text } }));
      } else {
        cmds++;
        const cur = W.get(o.id);
        let err = null;
        if (o.op === "place" && cur) err = `order ${o.id} already exists`;
        if (o.op !== "place" && !cur) err = `order ${o.id} does not exist`;
        if (!err && o.op === "pay" && cur.status !== "Placed") err = `cannot pay an order that is ${cur.status}`;
        if (!err && o.op === "ship" && cur.status !== "Paid") err = `cannot ship an order that is ${cur.status}`;
        if (!err && o.op === "cancel" && !["Placed", "Paid"].includes(cur.status)) err = `cannot cancel an order that is ${cur.status}`;
        if (err) {
          frames.push(snap({ line: 2, bad: o.id, note: `<b>${esc(o.text)}</b> rejected by the aggregate: ${esc(err)}. Commands are where business rules live; the query side never needs to re-check them.`, vars: { op: o.text } }));
        } else {
          const status = { place: "Placed", pay: "Paid", ship: "Shipped", cancel: "Cancelled" }[o.op];
          if (o.op === "place") W.set(o.id, { id: o.id, items: o.n, status, version: 1 });
          else Object.assign(cur, { status, version: cur.version + 1 });
          trips += o.op === "place" ? 1 : 2;
          const type = "Order" + status;
          if (full) pending.push({ id: o.id, type, items: o.n, at: step });
          frames.push(snap({ line: [1, 2, 3], hiW: o.id, note: `<b>${esc(o.text)}</b>: load (or create) the aggregate, check the rule, save. ${full ? `In the same transaction an <b>${type}</b> event is written for the projector (an outbox; see the distributed-architecture topic).` : "Done; queries will see it immediately because they read the same rows."}`, vars: { op: o.text } }));
        }
      }
      if (full) project(false);
    });
    if (full && pending.length) project(true);
    frames.push(snap({ line: 8, done: true, note: `Finished: ${cmds} command(s), ${queries} quer${queries === 1 ? "y" : "ies"}, <b>${rows} rows read</b> by queries in ${trips} round-trips, <b>${stale} stale read(s)</b>. ${full ? "Fast, simple reads paid for with eventual consistency and a projector to operate." : light ? "Most of the benefit of CQRS for the price of a second code path, with no consistency trade-off. Start here." : "Simple to start, but every screen pays for loading full aggregates it does not need."}` }));
    return frames;
  }
  Viz.register("application-architecture-cqrs", (host) => Viz.player(host, {
    title: "CQRS: separate the write model from the read model", tag: "SCRIPT · STEP THROUGH",
    legend: [["active", "row just written"], ["done", "row projected"], ["bad", "rejected / stale"]],
    code: [
      "// command side",
      "order = repo.load(id) ?? Order.place(cmd)",
      "order.pay()          // throws if the rule fails",
      "repo.save(order)     // + outbox event (full CQRS)",
      "// query side, one model: load aggregates, map to DTO",
      "// light: SELECT id, name, total ... (same DB)",
      "// full: SELECT * FROM order_summaries",
      "on(OrderPaid e) readDb.update(e.id, 'Paid')",
      "",
    ], codeLang: "typescript",
    inputs: [
      { key: "mode", label: "mode", type: "select", options: CQ_MODES, value: CQ_MODES[2] },
      { key: "script", label: "operations (;)", value: "place A 3; place B 2; pay A; list; get A; ship A; cancel B; list; ship B", width: 520 },
      { key: "lag", label: "projector lag (0–3)", value: "1", width: 70 },
    ],
    random: () => {
      const ids = ["A", "B", "C"], ops = ids.map((i) => `place ${i} ${1 + Math.floor(Math.random() * 5)}`);
      for (let k = 0; k < 6; k++) { const op = pick(["pay", "pay", "ship", "cancel", "get", "list"]); ops.push(op === "list" ? op : `${op} ${pick(ids)}`); }
      return { mode: pick(CQ_MODES), script: ops.join("; "), lag: String(Math.floor(Math.random() * 4)) };
    },
    build: buildCqrs,
    speed: 1500,
    render: (f) => {
      const wRows = f.W.map((o) => ({ c: [o.id, String(o.items), o.status, `v${o.version}`], cls: f.hiW === o.id ? "active" : f.bad === o.id ? "bad" : "" }));
      const write = tbl(f.full ? "write DB · orders (aggregate)" : "orders (shared DB)", ["id", "items", "status", "ver"], wRows, { empty: "no orders yet" });
      const parts = [write];
      if (f.full) {
        parts.push(tbl("outbox · pending events", ["event", "order"], f.pending.map((e) => ({ c: [e.type, e.id] })), { empty: "empty" }));
        parts.push(tbl("read DB · order_summaries", ["id", "customer", "total", "status"], f.R.map((r) => ({ c: [r.id, r.customer, `$${r.total}`, r.status], cls: f.hiR === r.id ? "done" : "" })), { empty: "nothing projected" }));
      }
      if (f.query) parts.push(tbl(`result of “${f.query.text}”${f.query.stale ? " · STALE" : ""}`, ["id", "customer", "total", "status"], f.query.res.map((r) => ({ c: [r.id, r.customer, `$${r.total}`, r.status], cls: f.query.stale ? "bad" : "visit" })), { empty: "no rows", cls: f.query.stale ? "bad" : "" }));
      const st = stats([["rows read by queries", f.vars["rows read"], ""], ["round-trips", f.vars["round-trips"], ""], ["stale reads", f.vars["stale reads"], f.vars["stale reads"] ? "bad" : "done"]]);
      return `<div class="ax-stack"><div class="ax-row">${parts.join("")}</div>${st}</div>`;
    },
  }));

  /* =====================================================================
   * 5. Modular monolith boundary linter
   * ===================================================================== */
  const MOD_TOOLS = ["NetArchTest (.NET)", "ArchUnit (Java)", "import-linter (Python)", "Go internal/ packages", "eslint-plugin-boundaries (TS)"];
  const MOD_POS = { Ordering: [150, 110], Billing: [470, 110], Shipping: [790, 110], Catalog: [310, 300], Identity: [630, 300] };
  function parseRefs(s) {
    return items(s, "references", 1, 12).map((t) => {
      const m = t.match(/^(\w+)\s*->\s*(?:(\w+)\.(Api|Events|Internal)|db:(\w+))$/);
      if (!m) throw new Error(`references: “${t}” should look like Ordering->Billing.Api, Ordering->Billing.Internal or Ordering->db:Billing.`);
      const src = m[1], dst = m[2] || m[4], kind = m[3] || "db";
      [src, dst].forEach((x) => { if (!MOD_POS[x]) throw new Error(`references: unknown module “${x}”. Use ${Object.keys(MOD_POS).join(", ")}.`); });
      if (src === dst) throw new Error(`references: “${t}” stays inside one module, which is always fine; list only cross-module references.`);
      return { src, dst, kind, text: t };
    });
  }
  const toolRule = (tool, r) => ({
    [MOD_TOOLS[0]]: `Types.InAssembly(app).That().ResideInNamespace("${r.src}").ShouldNot().HaveDependencyOn("${r.dst}.Internal")`,
    [MOD_TOOLS[1]]: `noClasses().that().resideInAPackage("..${r.src.toLowerCase()}..").should().dependOnClassesThat().resideInAPackage("..${r.dst.toLowerCase()}.internal..")`,
    [MOD_TOOLS[2]]: `[importlinter:contract:${r.dst.toLowerCase()}-internal] type = forbidden · source_modules = app.${r.src.toLowerCase()} · forbidden_modules = app.${r.dst.toLowerCase()}.internal`,
    [MOD_TOOLS[3]]: `app/${r.dst.toLowerCase()}/internal/… is importable only from app/${r.dst.toLowerCase()}/…; the compiler rejects ${r.src.toLowerCase()} (no test needed)`,
    [MOD_TOOLS[4]]: `boundaries/element-types: { from: "${r.src.toLowerCase()}", disallow: ["${r.dst.toLowerCase()}/internal/**"] }`,
  })[tool];
  function buildModules({ refs, tool }) {
    if (!MOD_TOOLS.includes(tool)) throw new Error("Pick a tool.");
    const R = parseRefs(refs), frames = [], results = [];
    const pairs = new Set(R.map((r) => `${r.src}>${r.dst}`));
    const curve = (r) => (pairs.has(`${r.dst}>${r.src}`) ? 26 : 0);
    const base = (extra) => ({ R, results: results.map((x) => ({ ...x })), tool, ...extra });
    frames.push(base({ line: 0, note: "Five modules in <b>one deployable</b>. Each module exposes a public <b>Api</b> (interfaces and DTOs it promises to keep stable) and <b>Events</b> it publishes; everything else, including its tables, is <b>Internal</b>. Cross-module references are checked one by one.",
      vars: { tool: tool.split(" (")[0], references: R.length, violations: 0 } }));
    R.forEach((r, i) => {
      const ok = r.kind === "Api" || r.kind === "Events";
      const why = r.kind === "Api" ? "calls the published API: allowed" : r.kind === "Events" ? "subscribes to published events: allowed, and the loosest coupling" : r.kind === "Internal" ? "reaches into another module's internals" : `reads ${r.dst}'s tables directly`;
      results.push({ ...r, ok, why, curve: curve(r) });
      frames.push(base({ cur: i, line: ok ? [1, 2] : [1, 3, 4], note: `<b>${esc(r.text)}</b>: ${esc(why)}.${ok ? "" : r.kind === "db" ? " Shared tables are the strongest coupling there is: a schema change in one module silently breaks another, and you can never split them into services." : " Internals change without notice; that is what “internal” means."}${ok ? "" : `<br><span class="mono">${esc(toolRule(tool, r))}</span>`}`,
        vars: { tool: tool.split(" (")[0], reference: r.text, checked: i + 1, violations: results.filter((x) => !x.ok).length } }));
    });
    const adj = new Map(Object.keys(MOD_POS).map((k) => [k, new Set()]));
    R.filter((r) => r.kind !== "Events").forEach((r) => adj.get(r.src).add(r.dst));
    let cyc = null;
    const color = new Map(), st = [];
    const dfs = (u) => { color.set(u, 1); st.push(u); for (const v of adj.get(u)) { if (cyc) break; if (color.get(v) === 1) cyc = st.slice(st.indexOf(v)).concat(v); else if (!color.get(v)) dfs(v); } st.pop(); color.set(u, 2); };
    Object.keys(MOD_POS).forEach((k) => { if (!cyc && !color.get(k)) dfs(k); });
    const bad = results.filter((x) => !x.ok);
    frames.push(base({ cyc, line: 5, note: `${cyc ? `<b>Module cycle</b> through synchronous references: ${cyc.map(esc).join(" → ")}. Break it by replacing one direction with an event (events do not count, because the publisher does not know its subscribers).` : "No module cycle among synchronous references."} ${bad.length ? `<b>${bad.length} boundary violation(s)</b> would fail the build. Fix: add what the caller needs to the target's Api (or publish an event) and keep its tables private.` : "All references go through public contracts: these modules could be extracted into services later with little rework."}`,
      vars: { tool: tool.split(" (")[0], violations: bad.length, cycle: cyc ? "yes" : "no", result: bad.length || cyc ? "FAIL" : "PASS" } }));
    return frames;
  }
  Viz.register("application-architecture-modules", (host) => Viz.player(host, {
    title: "Modular monolith: enforce module boundaries in one deployable", tag: "EDIT REFERENCES · LINT",
    legend: [["done", "through Api / Events"], ["bad", "into Internal or another module's tables"], ["active", "being checked"], ["path", "module cycle"]],
    code: [
      "for (ref of crossModuleReferences) {",
      "  if (ref.target is Api || ref.target is Events)",
      "    continue                       // public contract",
      "  fail(`${ref.src} reaches into ${ref.dst}`)",
      "}  // Internal types and db tables are private",
      "assertNoCycles(syncReferences)    // events excluded",
    ], codeLang: "typescript",
    inputs: [
      { key: "refs", label: "references", value: "Ordering->Billing.Api; Ordering->Catalog.Api; Shipping->Ordering.Events; Billing->Ordering.Internal; Shipping->db:Ordering; Billing->Identity.Api", width: 600 },
      { key: "tool", label: "show the rule in", type: "select", options: MOD_TOOLS, value: MOD_TOOLS[0] },
    ],
    random: () => {
      const ks = Object.keys(MOD_POS), out = new Set();
      while (out.size < 6) { const a = pick(ks), b = pick(ks); if (a !== b) out.add(Math.random() < 0.2 ? `${a}->db:${b}` : `${a}->${b}.${pick(["Api", "Api", "Events", "Internal"])}`); }
      return { refs: [...out].join("; "), tool: pick(MOD_TOOLS) };
    },
    build: buildModules,
    speed: 1700,
    render: (f) => {
      const touched = new Set();
      const bands = Object.entries(MOD_POS).map(([k, [x, y]]) => ({ x: x - 130, y: y - 72, w: 260, h: 132, label: `${k} module`, cls: "plain" }));
      const nodes = [];
      Object.entries(MOD_POS).forEach(([k, [x, y]]) => {
        nodes.push({ k: `${k}.Api`, title: "Api", sub: "public", x: x - 62, y: y - 18, w: 100, h: 38, shape: "iface" });
        nodes.push({ k: `${k}.Events`, title: "Events", sub: "public", x: x + 62, y: y - 18, w: 100, h: 38, shape: "iface" });
        nodes.push({ k: `${k}.Internal`, title: "Internal", sub: "private", x: x - 50, y: y + 32, w: 124, h: 38 });
        nodes.push({ k: `${k}.db`, title: "tables", sub: "", x: x + 72, y: y + 32, w: 84, h: 38, shape: "db" });
        nodes.push({ k: `${k}.src`, title: "", x: x - 100, y: y - 60, w: 1, h: 1, cls: "ax-hidden" });
      });
      const done = f.cur === undefined ? f.results.length : f.cur + 1;
      const cycPairs = new Set(); if (f.cyc) for (let i = 0; i + 1 < f.cyc.length; i++) cycPairs.add(`${f.cyc[i]}>${f.cyc[i + 1]}`);
      const edges = f.R.map((r, i) => {
        const res = f.results[i], tgt = `${r.dst}.${r.kind}`;
        if (i < done) touched.add(tgt);
        const cls = i >= done ? "" : i === f.cur ? (res.ok ? "active" : "bad") : f.cyc && cycPairs.has(`${r.src}>${r.dst}`) && r.kind !== "Events" ? "path" : res.ok ? "done" : "bad";
        return { u: `${r.src}.Internal`, v: tgt, cls, curve: (i % 2 ? 1 : -1) * (18 + 6 * (i % 3)), dash: r.kind === "Events" };
      });
      nodes.forEach((n) => {
        if (n.title === "Internal" || n.title === "tables") { const hit = f.results.slice(0, done).some((x, i) => !x.ok && `${x.dst}.${x.kind}` === n.k); if (hit) n.cls = "bad"; }
        else if (touched.has(n.k)) n.cls = "done";
      });
      return diagram({ nodes: nodes.filter((n) => n.title !== ""), edges, bands, view: [0, 0, 940, 380], label: "modular monolith module map" });
    },
  }));

  /* =====================================================================
   * 6. The cost of over-layering: pass-through layers and mappers
   * ===================================================================== */
  const LK = { map: "maps to its own type", pass: "forwards unchanged", logic: "makes a decision" };
  function buildLayers({ layers, collapse }) {
    const L = items(layers, "layers", 2, 8).map((t) => {
      const m = t.match(/^([A-Za-z][\w<>]*)\s*:\s*(map|pass|logic)$/i);
      if (!m) throw new Error(`layers: “${t}” should look like Name:map, Name:pass or Name:logic.`);
      return { k: m[1], kind: m[2].toLowerCase() };
    });
    if (new Set(L.map((l) => l.k)).size !== L.length) throw new Error("layers: names must be unique.");
    if (!L.some((l) => l.kind === "logic")) throw new Error("layers: at least one layer has to make a decision (logic), or there is no feature.");
    const frames = [], n = L.length;
    const maps = L.filter((l) => l.kind === "map").length, passes = L.filter((l) => l.kind === "pass").length;
    const ifaces = L.filter((l) => /^I[A-Z]/.test(l.k)).length;
    const files = n + maps * 2;
    const edits = maps * 2 + L.filter((l) => l.kind === "logic").length;
    const mocks = n - 1;
    const keep = collapse === "yes" ? [{ k: "Endpoint", kind: "map" }, { k: "Handler", kind: "logic" }, { k: "DbContext", kind: "pass", lib: true }] : null;
    const m = (extra) => ({ L, keep, ...extra });
    let hops = 0;
    frames.push(m({ dir: "", cur: -1, line: 0, note: `${n} layers between the HTTP request and the database. Each one is a file (or two, with its interface) a reader must open and a test must mock. Let's follow one request.`, vars: { layers: n, hops: 0 } }));
    L.forEach((l, i) => {
      hops++;
      frames.push(m({ dir: "down", cur: i, line: l.kind === "pass" ? 2 : l.kind === "map" ? 1 : 3,
        note: `<b>${esc(l.k)}</b> ${LK[l.kind]}.${l.kind === "pass" ? " It adds a stack frame, a file and a mock, and no behaviour. If you deleted it, nothing would change except the line count." : l.kind === "map" ? " Mapping is justified at a real boundary (HTTP contract ↔ domain, domain ↔ table). Between two internal layers it is ceremony." : " This is where the value is: the business rule."}`,
        vars: { layers: n, hops, layer: l.k, kind: l.kind } }));
    });
    L.slice().reverse().forEach((l, j) => {
      if (l.kind !== "map") return;
      hops++;
      frames.push(m({ dir: "up", cur: n - 1 - j, line: 4, note: `On the way back up, <b>${esc(l.k)}</b> maps the result to its own type again.`, vars: { layers: n, hops, layer: l.k } }));
    });
    frames.push(m({ dir: "field", cur: -1, line: 5, note: `Now product asks for a new field, <b>giftNote</b>. Every layer with its own type needs the type <i>and</i> its mapper edited (${maps} × 2), plus the layer that uses it (${L.filter((l) => l.kind === "logic").length}): <b>${edits} edits</b> for one field. Pass-through layers that forward whole objects escape, but they still cost a file each.`,
      vars: { layers: n, "files to read": files, "edits for one field": edits, "mocks in unit tests": mocks, "pass-through": pct(passes, n) } }));
    frames.push(m({ dir: "sum", cur: -1, line: 6, summary: true,
      note: keep ? `Collapsed: an endpoint that maps the HTTP contract, a handler holding the logic, and the ORM used directly (it already <i>is</i> a repository and unit of work). Same behaviour, <b>${3} hops instead of ${hops}</b>. Add layers back only when they earn their place (a second adapter, a real domain model, a test seam you actually use).`
        : `${pct(passes, n)} of the layers are pass-through. Rule of thumb: a layer must <b>decide</b>, <b>translate at a real boundary</b>, or <b>isolate something volatile</b>. Pick “collapse” to see the lean version.`,
      vars: { layers: n, hops, "files to read": files, "edits for one field": edits, "mocks in unit tests": mocks, "pass-through": pct(passes, n) } }));
    return frames;
  }
  Viz.register("application-architecture-layers-cost", (host) => Viz.player(host, {
    title: "Over-layering: what each layer costs a CRUD request", tag: "EDIT THE STACK",
    legend: [["active", "current layer"], ["visit", "pass-through"], ["path", "mapping"], ["done", "business logic"], ["bad", "edited for one new field"]],
    code: [
      "request ->",
      "  map:   toDto(x) / toModel(x)     // new type",
      "  pass:  return next.Do(x)         // forwards",
      "  logic: if (rule(x)) ...          // decides",
      "<- response mapped back by every map layer",
      "newField: edit type + mapper per map layer",
      "lean = endpoint(map) -> handler(logic) -> ORM",
    ], codeLang: "typescript",
    inputs: [
      { key: "layers", label: "layers top→bottom (Name:map|pass|logic)", value: "OrdersController:map; IOrderService:pass; OrderService:logic; IOrderManager:pass; OrderManager:pass; IOrderRepository:pass; OrderRepository:map; OrderDao:map", width: 640 },
      { key: "collapse", label: "show the lean version", type: "select", options: ["no", "yes"], value: "yes" },
    ],
    random: () => {
      const names = ["Controller", "IService", "Service", "Manager", "Facade", "IRepository", "Repository", "Dao"];
      const out = names.filter(() => Math.random() < 0.75).slice(0, 7);
      if (out.length < 3) out.push("Handler");
      const kinds = out.map((x) => (/^I[A-Z]/.test(x) ? "pass" : pick(["map", "pass", "pass", "logic"])));
      if (!kinds.includes("logic")) kinds[Math.floor(kinds.length / 2)] = "logic";
      return { layers: out.map((x, i) => `${x}:${kinds[i]}`).join("; "), collapse: pick(["no", "yes"]) };
    },
    build: buildLayers,
    speed: 1300,
    render: (f) => {
      const n = f.L.length, gap = Math.min(56, 400 / n), top = 72;
      const kindCls = { pass: "visit", map: "path", logic: "done" };
      const nodes = f.L.map((l, i) => ({ k: `L${i}`, title: l.k, sub: LK[l.kind], x: 210, y: top + i * gap, w: 220, h: Math.min(42, gap - 10),
        cls: f.cur === i ? (f.dir === "up" ? "path" : "active") : f.dir === "field" && l.kind !== "pass" ? "bad" : f.dir === "sum" || f.dir === "field" ? kindCls[l.kind] : f.cur > i && f.dir === "down" ? "dim" : "" }));
      nodes.push({ k: "db", title: "database", sub: "", x: 210, y: top + n * gap + 8, w: 140, h: 40, shape: "db" });
      nodes.push({ k: "http", title: "HTTP request", sub: "", x: 210, y: 8, w: 140, h: 26 });
      nodes[nodes.length - 1].y = top - gap / 2 - 10;
      nodes[nodes.length - 1].h = 24;
      const edges = [];
      for (let i = 0; i < n; i++) edges.push({ u: i ? `L${i - 1}` : "http", v: `L${i}`, cls: f.dir === "down" && i <= f.cur ? "active" : "" });
      edges.push({ u: `L${n - 1}`, v: "db" });
      const bands = [{ x: 40, y: top - gap / 2 + 2, w: 380, h: n * gap + 4, label: `${n} layers`, cls: "none", lx: 412, ly: top - gap / 2 + 16, anchor: "end" }];
      if (f.keep && f.dir === "sum") {
        f.keep.forEach((l, i) => nodes.push({ k: `K${i}`, title: l.k, sub: l.lib ? "the ORM: already a repository" : LK[l.kind], x: 610, y: top + 40 + i * 90, w: 240, cls: l.kind === "logic" ? "done" : l.kind === "map" ? "path" : "" }));
        for (let i = 1; i < 3; i++) edges.push({ u: `K${i - 1}`, v: `K${i}`, cls: "done" });
        bands.push({ x: 470, y: top + 2, w: 280, h: 290, label: "lean: 3 pieces", cls: "done" });
      }
      const H = top + n * gap + 36;
      return diagram({ nodes, edges, bands, view: [30, 0, 740, Math.max(H, 340)], label: "layer stack" });
    },
  }));

  /* =====================================================================
   * 7. Decision walker: which architecture does this app need?
   * ===================================================================== */
  const DQ = [
    { key: "domain", q: "How complex are the business rules?", opts: ["mostly CRUD forms", "some real rules", "rich, changing rules"] },
    { key: "team", q: "Who works on it?", opts: ["1–3 developers", "one team", "several teams"] },
    { key: "life", q: "How long will it live?", opts: ["prototype / months", "years"] },
    { key: "io", q: "Do you need to swap or fake external systems?", opts: ["no", "yes (payments, queues, clock, many tests)"] },
    { key: "reads", q: "Do reads look different from writes?", opts: ["about the same", "very different (dashboards, search)"] },
  ];
  function buildDecision(v) {
    DQ.forEach((d) => { if (!d.opts.includes(v[d.key])) throw new Error(`Pick an answer for “${d.q}”.`); });
    const rec = [{ t: "feature folders / vertical slices", why: "Always: code that changes together lives together." }];
    const frames = [], avoid = [];
    const say = (i, txt, add, line) => { frames.push({ i, v, rec: rec.map((r) => ({ ...r })), avoid: [...avoid], add, line, note: txt, vars: { question: i < 0 ? "–" : `${i + 1}/${DQ.length}`, ingredients: rec.length } }); };
    say(-1, "Five questions, each one adds (or deliberately leaves out) one ingredient. There is no single best architecture; there is the cheapest one that handles your forces.", null, 0);
    const d = v.domain;
    if (d === DQ[0].opts[0]) { avoid.push("domain layer, repositories, mappers between internal layers"); say(0, "Mostly CRUD: <b>no domain layer</b>. Each slice reads the request, validates, and uses the ORM directly. Layers here would be pure pass-through.", null, 1); }
    else if (d === DQ[0].opts[1]) { rec.push({ t: "rich entities for the rules", why: "Put each rule on the entity it protects; keep handlers thin." }); say(0, "Some real rules: keep slices, but move the rules into <b>entities with behaviour</b> so they are tested once and not copied between handlers.", rec.length - 1, 1); }
    else { rec.push({ t: "clean / hexagonal core", why: "Domain + use cases with no framework imports; adapters outside." }); rec.push({ t: "DDD tactical patterns", why: "Aggregates, value objects, domain events (see domain-driven-design)." }); say(0, "Rich, changing rules are the case these styles were invented for: a <b>framework-free core</b> where the rules can be read, tested and changed without touching HTTP or SQL.", rec.length - 1, 1); }
    if (v.team === DQ[1].opts[2]) { rec.push({ t: "modular monolith", why: "One module per team with an Api, private tables and architecture tests." }); say(1, "Several teams: give each team a <b>module</b> with a public API and private data, enforced by tests. You get team autonomy without the network (see distributed-architecture before reaching for microservices).", rec.length - 1, 2); }
    else if (v.team === DQ[1].opts[1]) { rec.push({ t: "modules as top-level folders", why: "Cheap now, enforceable later with one architecture test." }); say(1, "One team: group slices into a few <b>modules</b> by business area. Add boundary tests when the codebase gets big.", rec.length - 1, 2); }
    else say(1, "A small team can hold the whole design in their heads; module boundaries can wait.", null, 2);
    if (v.life === DQ[2].opts[0]) { avoid.push("ports for things you will never swap", "architecture tests"); say(2, "A prototype may be thrown away: optimise for speed of change, skip abstractions you are not sure you need. If it survives, refactor (slices make that easy).", null, 3); }
    else { rec.push({ t: "architecture tests in CI", why: "ArchUnit / NetArchTest / import-linter keep the rules from rotting." }); say(2, "Years of life: the rules will be broken by someone in a hurry. <b>Automate</b> them as tests.", rec.length - 1, 3); }
    if (v.io === DQ[3].opts[1]) { rec.push({ t: "ports & adapters at the edges", why: "Interfaces owned by the core for payments, messaging, time, email." }); say(3, "You need to fake or swap external systems: put a <b>port</b> (interface owned by your code) in front of each one. This is hexagonal's real payoff, and you can apply it just at the edges.", rec.length - 1, 4); }
    else { avoid.push("repository interface over the ORM"); say(3, "Nothing to swap: use the ORM and SDKs directly in handlers. Wrapping EF Core or JPA in your own repository “just in case” is a pass-through layer.", null, 4); }
    if (v.reads === DQ[4].opts[1]) { rec.push({ t: "light CQRS", why: "Queries as separate read projections; commands through the model." }); say(4, "Reads differ from writes: split <b>queries</b> from <b>commands</b>. Start light (same DB, separate code paths); add a separate read store only if load or shape demands it.", rec.length - 1, 5); }
    else say(4, "Reads and writes look alike: one model serves both. No CQRS needed.", null, 5);
    frames.push({ i: DQ.length, v, rec, avoid, final: true, line: 6, note: `<b>Recommendation:</b> ${rec.map((r) => esc(r.t)).join(" + ")}.${avoid.length ? ` <b>Leave out:</b> ${avoid.map(esc).join("; ")}.` : ""}`, vars: { ingredients: rec.length, "left out": avoid.length } });
    return frames;
  }
  Viz.register("application-architecture-decision", (host) => Viz.player(host, {
    title: "Which architecture does this app need?", tag: "ANSWER · WALK THE TREE",
    legend: [["active", "current question"], ["done", "ingredient added"], ["bad", "deliberately left out"]],
    code: [
      "recipe = [verticalSlices]",
      "domain: CRUD → no domain layer | rules → rich entities | rich → clean core",
      "teams:  several → modular monolith",
      "life:   years → architecture tests",
      "io:     swappable → ports at the edges",
      "reads:  different → light CQRS",
      "return recipe",
    ], codeLang: "typescript",
    inputs: DQ.map((d, i) => ({ key: d.key, label: d.q.replace("?", ""), type: "select", options: d.opts, value: d.opts[[1, 1, 1, 1, 0][i]] })),
    random: () => Object.fromEntries(DQ.map((d) => [d.key, pick(d.opts)])),
    build: buildDecision,
    speed: 1700,
    render: (f) => {
      const nodes = DQ.map((d, i) => ({ k: `q${i}`, title: d.q, sub: i <= f.i - (f.final ? 0 : 0) && i <= f.i ? `→ ${f.v[d.key]}` : "", x: 230, y: 34 + i * 70, w: 400, h: 44, cls: i === f.i ? "active" : i < f.i ? "done" : "dim" }));
      const edges = DQ.slice(1).map((_, i) => ({ u: `q${i}`, v: `q${i + 1}`, cls: i < f.i ? "done" : "" }));
      const svg = diagram({ nodes, edges, view: [20, 0, 420, 34 + DQ.length * 70 - 14], label: "decision questions" });
      const recCard = kv("recipe so far", f.rec.map((r, i) => [r.t, r.why, i === f.add ? "active" : "done"]), {});
      const avoidCard = f.avoid.length ? kv("left out on purpose", f.avoid.map((a) => [a, "", "bad"]), {}) : "";
      return `<div class="ax-row" style="align-items:center">${svg}<div class="ax-col aa-recipe">${recCard}${avoidCard}</div></div>`;
    },
  }));

})();
