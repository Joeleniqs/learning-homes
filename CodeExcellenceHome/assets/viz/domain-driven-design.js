/* Visualizers for "Domain-Driven Design Essentials". Every registered name is prefixed "domain-driven-design-". */
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
   * 1. Context map: how an upstream change reaches a downstream context
   * ===================================================================== */
  const CM_PATTERNS = ["Conformist", "Anticorruption layer (ACL)", "Shared kernel", "Open host service + published language", "Customer / supplier", "Separate ways"];
  const CM_CHANGES = ["add an optional field (Product.badge)", "rename a field (price → listPrice)", "split a concept (Product → Product + Offer)"];
  const CM = {
    "Conformist": {
      short: "Conformist", files: [0, 9, 23], risk: ["low", "high", "high"], coord: "none: upstream won't wait", cost: "none, until it hurts", line: 4,
      cross: "Catalog's own <b>Product</b> type flows straight into Sales. Sales code, tests and even its table columns use Catalog's names and shapes.",
      effect: ["Nothing breaks: Sales ignores a field it does not read.",
        "Every Sales file that reads <code>product.price</code> breaks (9 of them), and it breaks on <b>Catalog's</b> release day, not yours.",
        "Sales' cart, pricing and order code was shaped like Catalog's Product. 23 files must be reworked around Product + Offer."],
    },
    "Anticorruption layer (ACL)": {
      short: "ACL", files: [0, 1, 2], risk: ["low", "low", "medium"], coord: "none: you adapt on your side", cost: "a translator and its tests", line: 5,
      cross: "Catalog's model stops at a <b>translator</b> owned by Sales. Inside Sales there is only Sales' own <b>SellableItem</b>.",
      effect: ["The translator ignores the field until Sales decides it wants it.",
        "One line in the translator changes: <code>listPrice</code> now maps to <code>SellableItem.Price</code>. Sales' model never notices.",
        "The translator now combines Product + Offer into Sales' own SellableItem: 2 files (translator and its test). The core of Sales is untouched."],
    },
    "Shared kernel": {
      short: "Shared kernel", files: [1, 10, 24], risk: ["low", "medium", "high"], coord: "joint decision + joint release", cost: "two teams own one model", line: 6,
      cross: "Both contexts compile against one shared <b>Product</b> library. A change to it is a change to both, so both teams must agree.",
      effect: ["The shared library gets the field; both contexts upgrade the package together (1 shared file, 2 rebuilds).",
        "The shared Product changes, so both teams change code and release together: 1 shared + 9 Sales files and a coordinated release.",
        "A shared-model redesign: both teams meet, agree, change and release together. 1 shared + 23 Sales files."],
    },
    "Open host service + published language": {
      short: "OHS / PL", files: [0, 0, 0], risk: ["low", "low", "low"], coord: "none now; v1 deprecation later", cost: "upstream maintains a versioned contract", line: 7,
      cross: "Catalog serves a documented, versioned <b>published language</b> (Products API v1 / ProductPublished v1). Its internal model is free to change behind it.",
      effect: ["v1 gains an optional field: backward compatible, nobody downstream has to act.",
        "An internal rename only. Catalog keeps emitting <code>price</code> in v1 (one mapping line on Catalog's side). Sales: 0 files.",
        "Catalog keeps serving v1 (projecting Product + Offer into the old shape) and publishes v2 alongside. Sales migrates when it chooses."],
    },
    "Customer / supplier": {
      short: "Customer / supplier", files: [0, 9, 23], risk: ["low", "low", "medium"], coord: "planning + contract tests", cost: "upstream plans around downstream needs", line: 8,
      cross: "Sales is a <b>customer</b> whose needs are in Catalog's planning. Sales' consumer-driven contract tests run in Catalog's CI.",
      effect: ["Planned in Catalog's backlog with Sales consulted; the contract tests stay green.",
        "Sales' contract test fails in <b>Catalog's</b> CI before release. The teams agree a migration window: 9 Sales files changed on a schedule, not as a surprise.",
        "Negotiated: Catalog keeps a compatibility field during the migration, and Sales reworks 23 files over a planned release."],
    },
    "Separate ways": {
      short: "Separate ways", files: [0, 0, 0], risk: ["none", "none", "none"], coord: "none", cost: "duplicated data, manual re-keying", line: 9,
      cross: "No integration at all. Sales keeps its own product list, and staff re-key prices from Catalog's admin screen.",
      effect: ["Nothing propagates.", "Nothing propagates, but Sales' copy is now named differently from Catalog's. Drift is the price of independence.",
        "Nothing propagates. Sales' list may now be wrong until someone re-keys it."],
    },
  };
  const CM_NODES = [
    { k: "cat", x: 150, y: 90, title: "Catalog", sub: "supporting subdomain", w: 170 },
    { k: "sales", x: 470, y: 225, title: "Sales", sub: "CORE subdomain", w: 170, base: "accent" },
    { k: "bill", x: 790, y: 90, title: "Billing", sub: "supporting", w: 150 },
    { k: "ship", x: 790, y: 360, title: "Shipping", sub: "supporting", w: 150 },
    { k: "id", x: 150, y: 360, title: "Identity", sub: "generic (buy: Entra ID)", w: 190 },
    { k: "psp", x: 990, y: 225, title: "Payment provider", sub: "external system", w: 160 },
  ];
  function buildContextMap({ pattern, change }) {
    const P = CM[pattern];
    if (!P) throw new Error("Pick a relationship pattern.");
    const sev = CM_CHANGES.indexOf(change);
    if (sev < 0) throw new Error("Pick a change.");
    const frames = [];
    const files = P.files[sev], risk = P.risk[sev];
    const outcomeCls = pattern === "Separate ways" ? "visit" : files === 0 ? "done" : risk === "high" ? "bad" : pattern === "Shared kernel" || pattern === "Customer / supplier" ? "path" : "active";
    const base = { pattern, sev, vars: { relationship: P.short, change: change.split(" (")[0] } };
    frames.push({ ...base, stage: 0, line: 3, note: `A <b>context map</b> shows every bounded context and how the models meet. Each line is a relationship with a direction: the <b>upstream (U)</b> context's decisions flow to the <b>downstream (D)</b> one. Sales is the <b>core</b> subdomain (why the business exists), so its model is the one most worth protecting. The highlighted line, Catalog → Sales, uses <b>${esc(pattern)}</b>.` });
    frames.push({ ...base, stage: 1, line: 1, note: `Catalog's team makes a change for its own reasons: <b>${esc(change)}</b>. The question a context map answers: what does this cost Sales?` });
    frames.push({ ...base, stage: 2, line: P.line, note: `<b>${esc(pattern)}:</b> ${P.cross}` });
    frames.push({ ...base, stage: 3, line: P.line, outcomeCls, note: `${P.effect[sev]} <b>Sales files changed: ${files}</b> · coordination: ${esc(P.coord)} · surprise risk: <b>${risk}</b>.`, vars: { ...base.vars, "Sales files": files, risk } });
    frames.push({ ...base, stage: 4, line: 10, outcomeCls, table: true, note: `The same change under every pattern. Notice the trade: the patterns that protect Sales (ACL, OHS/PL) <b>cost someone a translator or a versioned contract</b>. Conformist is cheapest until the upstream changes. Pick per relationship, based on how stable the upstream model is and how much you care about your own (core: protect it; generic: conform happily).`, vars: { ...base.vars, "Sales files": files, risk } });
    return frames;
  }
  function renderContextMap(f) {
    const P = CM[f.pattern], st = f.stage;
    const nodes = CM_NODES.map((n) => ({ ...n, cls: n.base || "" }));
    const by = (k) => nodes.find((n) => n.k === k);
    if (st >= 1) by("cat").cls = "active";
    if (st >= 3) { by("sales").cls = f.outcomeCls; by("sales").badge = String(P.files[f.sev]); by("sales").badgeCls = f.outcomeCls; }
    by("cat").tag = "UPSTREAM (U)"; by("sales").tag = "DOWNSTREAM (D)";
    const hot = st >= 2 ? "active" : "visit";
    const edges = [
      { u: "id", v: "sales", label: "OHS / PL (OIDC tokens)", cls: "muted", lx: -40, ly: -32 },
      { u: "sales", v: "bill", label: "customer / supplier (events)", cls: "muted", lx: 10, ly: -8 },
      { u: "sales", v: "ship", label: "PL: OrderPlaced v1", cls: "muted", lx: -30, ly: 34 },
      { u: "psp", v: "bill", label: "ACL in Billing", cls: "muted", lx: 40, ly: 0 },
    ];
    if (P.short === "ACL") {
      nodes.push({ k: "acl", x: 330, y: 168, title: "ACL", sub: "translator", w: 92, h: 38, shape: "iface", cls: st >= 2 ? "done" : "" });
      edges.push({ u: "cat", v: "acl", cls: hot }, { u: "acl", v: "sales", cls: hot });
    } else if (P.short === "Shared kernel") {
      nodes.push({ k: "sk", x: 300, y: 168, title: "Shared kernel", sub: "Product (shared lib)", w: 150, h: 38, cls: st >= 2 ? "path" : "" });
      edges.push({ u: "cat", v: "sk", cls: hot, nohead: true }, { u: "sales", v: "sk", cls: hot, nohead: true });
    } else if (P.short === "OHS / PL") {
      nodes.push({ k: "ohs", x: 335, y: 120, title: "Products API v1", sub: "published language", w: 150, h: 38, shape: "iface", cls: st >= 2 ? "done" : "" });
      edges.push({ u: "cat", v: "ohs", cls: hot }, { u: "ohs", v: "sales", cls: hot });
    } else if (P.short === "Separate ways") {
      edges.push({ u: "cat", v: "sales", cls: "muted", dash: true, nohead: true, label: "separate ways (no link)", lx: -40, ly: 4 });
    } else {
      edges.push({ u: "cat", v: "sales", cls: hot, label: P.short, lx: -42, ly: 2 });
    }
    const svg = diagram({ nodes, edges, view: [40, 30, 1050, 360], label: "context map" });
    let below;
    if (f.table) {
      const rows = CM_PATTERNS.map((p) => {
        const q = CM[p];
        const w = (s) => `<span class="wrap">${esc(s)}</span>`;
        return { c: [esc(p), String(q.files[f.sev]), w(q.coord), esc(q.risk[f.sev]), w(q.cost)], cls: p === f.pattern ? "active" : "" };
      });
      below = tbl(`Change: ${CM_CHANGES[f.sev]}`, ["relationship", "Sales files", "coordination", "surprise risk", "ongoing cost"], rows, { html: true, cols: "auto auto minmax(140px, 1fr) auto minmax(150px, 1.3fr)" });
    } else {
      below = stats([["relationship", P.short, "visit"], ["Sales files changed", st >= 3 ? String(P.files[f.sev]) : "?", st >= 3 ? f.outcomeCls : ""], ["surprise risk", st >= 3 ? P.risk[f.sev] : "?", st >= 3 && P.risk[f.sev] === "high" ? "bad" : ""]]);
    }
    return `<div class="ax-stack">${svg}${below}</div>`;
  }
  Viz.register("domain-driven-design-context-map", (host) => Viz.player(host, {
    title: "Context map: what an upstream change costs downstream", tag: "PICK A RELATIONSHIP",
    legend: [["accent", "core subdomain"], ["active", "changing now"], ["bad", "breaks: must change"], ["path", "coordinated change"], ["done", "shielded"]],
    code: [
      "// Catalog (upstream) changes its own model",
      "catalog.change(kind)",
      "// what reaches Sales (downstream) depends on the relationship",
      "switch (relationship) {",
      "  case Conformist:   Sales uses Catalog.Product as-is",
      "  case ACL:          translator maps Product -> SellableItem",
      "  case SharedKernel: both compile against one Product",
      "  case OpenHost:     Catalog serves published language v1",
      "  case CustSupplier: Sales' contract tests run in Catalog CI",
      "  case SeparateWays: no integration, duplicate the data",
      "}",
    ],
    inputs: [
      { key: "pattern", label: "Catalog → Sales relationship", type: "select", options: CM_PATTERNS, value: CM_PATTERNS[1] },
      { key: "change", label: "upstream change", type: "select", options: CM_CHANGES, value: CM_CHANGES[1] },
    ],
    random: () => ({ pattern: pick(CM_PATTERNS), change: pick(CM_CHANGES) }),
    build: buildContextMap,
    speed: 1700,
    render: renderContextMap,
  }));

  /* =====================================================================
   * 2. Anticorruption layer: translate a legacy record into the domain
   * ===================================================================== */
  const ACL_STATUS = { A: "Active", S: "Suspended", C: "Closed" };
  const ACL_SHIP = { STD: "Standard", EXP: "Express", NXT: "NextDay" };
  const ACL_CCY = { USD: 2, EUR: 2, GBP: 2, JPY: 0 };
  function buildAcl({ record }) {
    const pairs = items(record, "legacy record", 1, 10).map((p) => {
      const m = p.match(/^([A-Za-z_]+)\s*=(.*)$/);
      if (!m) throw new Error(`legacy record: “${p}” should look like FIELD=value.`);
      return [m[1].toUpperCase(), m[2]];
    });
    const rec = Object.fromEntries(pairs);
    const rows = [], frames = [], errors = [], out = {};
    const snap = (extra) => ({ rows: rows.map((r) => ({ ...r })), out: { ...out }, errors: [...errors], ...extra });
    frames.push(snap({ line: 0, note: `A record arrives from the legacy order system: ${pairs.length} field(s) in its own vocabulary (status codes, money as an integer with a separate currency, zero-padded ids). The <b>anticorruption layer</b> is the only code in Sales that is allowed to know this vocabulary. Each field is translated, validated or rejected before anything reaches the domain.` }));
    const step = (field, line, fn) => {
      const raw = rec[field];
      const r = fn(raw);
      rows.push({ field, raw: raw === undefined ? "(missing)" : JSON.stringify(raw), to: r.to, value: r.value ?? "", leak: r.leak, cls: r.err ? "bad" : r.note ? "visit" : "done" });
      if (r.err) errors.push(`${field}: ${r.err}`);
      else if (r.prop) out[r.prop] = r.value;
      frames.push(snap({ line, hi: field, note: r.err ? `<b>${field}</b>: ${esc(r.err)} The ACL <b>rejects</b> instead of guessing, so a bad value never becomes a domain object.` : `<b>${field}</b> → <b>${esc(r.to)}</b> = <code>${esc(r.value)}</code>. ${r.note || ""}`, vars: { field, ok: rows.filter((x) => x.cls !== "bad").length, rejected: errors.length } }));
    };
    step("CUST_NO", 2, (v) => {
      if (v === undefined) return { to: "CustomerId", err: "required field is missing.", leak: "null checks everywhere" };
      const t = v.trim();
      if (!/^\d{1,10}$/.test(t)) return { to: "CustomerId", err: `“${t}” is not a legacy customer number (digits only).`, leak: "string ids of any shape" };
      return { to: "CustomerId", prop: "customerId", value: `C-${Number(t)}`, leak: `cust.CUST_NO == "${t}"` };
    });
    step("STAT", 3, (v) => {
      const t = (v ?? "").trim().toUpperCase();
      if (!ACL_STATUS[t]) return { to: "CustomerStatus", err: `status code “${t || "(empty)"}” is not one of A, S, C.`, leak: `if (STAT == "${t}") …` };
      return { to: "CustomerStatus", prop: "status", value: `CustomerStatus.${ACL_STATUS[t]}`, leak: `if (STAT == "${t}") …` };
    });
    step("AMT", 4, (v) => {
      const ccy = (rec.CCY ?? "").trim().toUpperCase();
      if (v === undefined || !/^-?\d+$/.test(v.trim())) return { to: "Money", err: `amount “${v ?? "(missing)"}” must be an integer in minor units.`, leak: "AMT / 100 sprinkled around" };
      if (!(ccy in ACL_CCY)) return { to: "Money", err: `currency “${ccy || "(missing)"}” is not supported (USD, EUR, GBP, JPY).`, leak: "AMT without a currency" };
      const n = Number(v.trim()), d = ACL_CCY[ccy];
      if (n < 0) return { to: "Money", err: "an order total cannot be negative.", leak: "negative totals" };
      const shown = d ? `${Math.floor(n / 10 ** d)}.${String(n % 10 ** d).padStart(d, "0")}` : String(n);
      return { to: "Money", prop: "total", value: `Money(${shown} ${ccy})`, leak: `AMT / 100 (wrong for JPY)`, note: d === 0 ? "JPY has no minor unit, so 1999 means ¥1999. A naive “divide by 100” would be wrong by 100×." : `Minor units ÷ 10<sup>${d}</sup>, combined with CCY into one value object.` };
    });
    step("SHIP_CD", 5, (v) => {
      if (v === undefined || v.trim() === "") return { to: "DeliverySpeed", prop: "delivery", value: "DeliverySpeed.Standard", leak: "null ship codes", note: "Missing → the documented default. The rule lives here, once." };
      const t = v.trim().toUpperCase();
      if (!ACL_SHIP[t]) return { to: "DeliverySpeed", err: `ship code “${t}” is unknown.`, leak: `switch (SHIP_CD) …` };
      return { to: "DeliverySpeed", prop: "delivery", value: `DeliverySpeed.${ACL_SHIP[t]}`, leak: `switch (SHIP_CD) …` };
    });
    step("NOTE", 6, (v) => {
      const t = (v ?? "").trim();
      return t ? { to: "DeliveryNote", prop: "note", value: `"${t.slice(0, 40)}"`, leak: "untrimmed padded strings" } : { to: "DeliveryNote", prop: "note", value: "none", leak: "\"   \" vs null", note: "Blank padding becomes “no note”." };
    });
    const known = new Set(["CUST_NO", "STAT", "AMT", "CCY", "SHIP_CD", "NOTE"]);
    const ignored = pairs.map((p) => p[0]).filter((k) => !known.has(k));
    frames.push(snap({ line: 7, final: true, ignored, note: errors.length ? `<b>Rejected</b> with ${errors.length} error(s). The ACL returns a translation failure (or puts the message on a dead-letter queue) and the Sales domain never sees a half-valid order.${ignored.length ? ` Ignored unknown field(s): ${ignored.map(esc).join(", ")}.` : ""}` : `<b>Translated.</b> Sales receives <code>ImportedOrder</code> built only from Sales types: CustomerId, CustomerStatus, Money, DeliverySpeed. The right-hand column is what the domain would have to understand <b>without</b> the ACL, in every place that touches the data.${ignored.length ? ` Ignored unknown field(s): ${ignored.map(esc).join(", ")}.` : ""}`, vars: { translated: Object.keys(out).length, rejected: errors.length, result: errors.length ? "REJECTED" : "ImportedOrder" } }));
    return frames;
  }
  Viz.register("domain-driven-design-acl", (host) => Viz.player(host, {
    title: "Anticorruption layer: keep a foreign model out of your domain", tag: "EDIT THE RECORD",
    legend: [["done", "translated"], ["visit", "defaulted / converted"], ["bad", "rejected"], ["active", "field being read"]],
    code: [
      "ImportedOrder translate(LegacyRecord r) {",
      "  // only this class knows the legacy vocabulary",
      "  var id     = CustomerId.fromLegacy(r.CUST_NO);",
      "  var status = STATUS[r.STAT] ?? reject(\"STAT\");",
      "  var total  = Money.ofMinor(r.AMT, Currency.of(r.CCY));",
      "  var speed  = SHIP[r.SHIP_CD] ?? DeliverySpeed.Standard;",
      "  var note   = DeliveryNote.ofBlankable(r.NOTE);",
      "  return new ImportedOrder(id, status, total, speed, note);",
      "}",
    ],
    inputs: [{ key: "record", label: "legacy record (FIELD=value; …)", value: "CUST_NO=00042; STAT=A; AMT=1999; CCY=JPY; SHIP_CD=EXP; NOTE=   ring twice   ; FAX=555-0101", width: 640 }],
    random: () => {
      const r = [`CUST_NO=${String(Math.floor(Math.random() * 900) + 1).padStart(5, "0")}`, `STAT=${pick(["A", "A", "S", "C", "X"])}`, `AMT=${Math.floor(Math.random() * 50000)}`, `CCY=${pick(["USD", "EUR", "JPY", "GBP", "CHF"])}`];
      if (Math.random() < 0.7) r.push(`SHIP_CD=${pick(["STD", "EXP", "NXT", "ZZZ"])}`);
      if (Math.random() < 0.6) r.push(`NOTE=${pick(["  leave at door ", "   ", "call first"])}`);
      return { record: r.join("; ") };
    },
    build: buildAcl,
    speed: 1300,
    render: (f) => {
      const rows = f.rows.map((r) => ({ c: [r.field, r.raw, r.to, r.value, r.leak], cls: r.field === f.hi ? (r.cls === "bad" ? "bad" : "active") : r.cls }));
      const t = tbl("legacy field → Sales domain", ["legacy", "raw", "domain type", "translated", "without an ACL the domain sees"], rows, { empty: "nothing read yet" });
      const card = f.final ? (f.errors.length ? kv("translation failed", f.errors.map((e) => [e, "", "bad"]))
        : kv("ImportedOrder (Sales types only)", Object.entries(f.out).map(([k, v]) => [k, v, "done"]))) : "";
      return `<div class="ax-stack">${t}${card}</div>`;
    },
  }));

  /* =====================================================================
   * 3. Value object vs mutable class vs entity: equality and aliasing
   * ===================================================================== */
  const VE_KINDS = ["value object (immutable)", "mutable class", "entity (identity)"];
  function parseMoney(s, label) {
    const m = String(s ?? "").trim().match(/^(?:([A-Za-z]\d{1,3})\s*:\s*)?(\d{1,6}(?:\.\d{1,2})?)\s+([A-Za-z]{3})$/);
    if (!m) throw new Error(`${label}: write an amount and a currency, like “10 EUR”, optionally with an id for entities: “P1: 10 EUR”.`);
    return { id: m[1] ? m[1].toUpperCase() : null, amt: Number(m[2]), ccy: m[3].toUpperCase() };
  }
  const fmtAmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2));
  function buildValueEntity({ kind, a, b, discount }) {
    const K = VE_KINDS.indexOf(kind);
    if (K < 0) throw new Error("Pick a kind.");
    const A = parseMoney(a, "a"), B = parseMoney(b, "b"), d = num(discount, "discount", 0, 1000000);
    const vo = K === 0, mut = K === 1, ent = K === 2;
    const cls = ent ? "Payment" : "Money";
    let nextId = 1;
    const heap = [], vars = {};
    const ids = ent ? [A.id || "P1", B.id || (A.id === "P2" ? "P3" : "P2")] : [null, null];
    const alloc = (v, pid) => { const o = { n: nextId++, amt: v.amt, ccy: v.ccy, pid }; heap.push(o); return o.n; };
    const frames = [];
    const snap = (extra) => ({ kind: K, cls, heap: heap.map((o) => ({ ...o })), refs: { ...vars }, ...extra });
    const eq = () => {
      const x = heap.find((o) => o.n === vars.a), y = heap.find((o) => o.n === vars.b);
      if (vo) return { r: x.amt === y.amt && x.ccy === y.ccy, why: "compares every field (amount and currency)" };
      if (mut) return { r: x.n === y.n, why: "default equality compares <b>references</b>: are a and b the same object in memory?" };
      return { r: x.pid === y.pid, why: `compares the <b>identity</b> only: ${esc(x.pid)} vs ${esc(y.pid)}; amounts are irrelevant` };
    };
    const show = (n) => { const o = heap.find((h) => h.n === n); return `${fmtAmt(o.amt)} ${o.ccy}`; };
    vars.a = alloc(A, ids[0]);
    frames.push(snap({ line: 0, hiObj: vars.a, hiVar: "a", note: `<b>a</b> = new ${cls}(${ent ? `${esc(ids[0])}, ` : ""}${fmtAmt(A.amt)} ${A.ccy}). ${vo ? "A value object is defined entirely by its attributes, and it is immutable: once built, it never changes." : mut ? "A plain class with settable properties and default (reference) equality: the way most code is written by accident." : "An entity has a <b>thread of identity</b>: the same payment over its whole life, even as its attributes change."}`, vars2: { a: show(vars.a) } }));
    vars.b = alloc(B, ids[1]);
    frames.push(snap({ line: 1, hiObj: vars.b, hiVar: "b", note: `<b>b</b> = new ${cls}(${ent ? `${esc(ids[1])}, ` : ""}${fmtAmt(B.amt)} ${B.ccy}). Two separate objects now exist in memory.`, vars2: { a: show(vars.a), b: show(vars.b) } }));
    const e1 = eq();
    const sameFields = A.amt === B.amt && A.ccy === B.ccy;
    frames.push(snap({ line: 2, eq: e1.r, note: `<b>a == b</b> → <b>${e1.r}</b>: ${e1.why}. ${mut && sameFields ? "Surprise: two identical amounts are “not equal”, so they also break as dictionary keys and in de-duplication." : vo && sameFields ? "Ten euros is ten euros, whichever object holds it." : ent && sameFields && !e1.r ? "Two payments of the same amount are still two different payments." : ent && !sameFields && e1.r ? "Same id, different amounts: this is the same payment observed at two moments (for example before and after a refund)." : ""}`, vars2: { "a == b": String(e1.r) } }));
    vars.c = vars.a;
    frames.push(snap({ line: 3, hiVar: "c", hiObj: vars.a, eq: e1.r, note: `<b>c = a</b>. No copy is made: c and a now point at the <b>same object</b> #${vars.a}. Imagine a is the order total and c is the amount a discount service is handed.`, vars2: { a: show(vars.a), c: show(vars.c) } }));
    const o = heap.find((h) => h.n === vars.a), after = +(o.amt - d).toFixed(2);
    let bad = false, note;
    if (vo) {
      if (after < 0) { bad = true; note = `<b>c.Minus(${fmtAmt(d)})</b> would give ${fmtAmt(after)} ${o.ccy}. The value object <b>validates itself</b> and throws: a negative Money can never exist. c still refers to #${vars.c}.`; }
      else { vars.c = alloc({ amt: after, ccy: o.ccy }, null); note = `<b>c = c.Minus(${fmtAmt(d)})</b> returns a <b>new</b> Money #${vars.c} (${fmtAmt(after)} ${o.ccy}). Object #${vars.a} is untouched, so <b>a</b> is still ${show(vars.a)}. Immutability makes sharing safe.`; }
      frames.push(snap({ line: 4, hiObj: vars.c, hiVar: "c", bad, note, vars2: { a: show(vars.a), c: show(vars.c) } }));
    } else if (mut) {
      o.amt = after; bad = true;
      note = `<b>c.Amount -= ${fmtAmt(d)}</b> mutates object #${vars.a} in place. Because a points at the same object, <b>a silently changed to ${show(vars.a)}</b> as well: the order total was discounted by code that only meant to compute a price.${after < 0 ? " It is even negative now, and nothing stopped it." : ""}`;
      frames.push(snap({ line: 5, hiObj: vars.a, hiVar: "a", bad, note, vars2: { a: show(vars.a), c: show(vars.c) } }));
    } else {
      if (after < 0) { bad = true; note = `<b>c.Refund(${fmtAmt(d)})</b> is rejected by the entity: you cannot refund more than was paid (${show(vars.a)}). The rule lives on the entity, so no caller can skip it.`; }
      else { o.amt = after; note = `<b>c.Refund(${fmtAmt(d)})</b> changes the payment's state through a method. a sees ${show(vars.a)} too, and that is <b>correct</b>: a and c are the same payment ${esc(o.pid)}, and its history now includes a refund. Entities are meant to change; their identity is what stays.`; }
      frames.push(snap({ line: 6, hiObj: vars.a, hiVar: "c", bad, note, vars2: { a: show(vars.a), c: show(vars.c) } }));
    }
    const e2 = eq();
    const aChanged = heap.find((h) => h.n === vars.a).amt !== A.amt;
    frames.push(snap({ line: 7, eq: e2.r, final: true, bad: mut && d > 0, note: `Afterwards: <b>a</b> is ${show(vars.a)} (${aChanged ? (ent ? "changed, as intended for an entity" : "changed by someone else: an aliasing bug") : "unchanged"}), and <b>a == b</b> is now <b>${e2.r}</b>. ${vo ? "Value objects: equal when their values are equal, never changed in place, safe to share and to use as keys." : mut ? "Mutable classes with reference equality give you the worst of both: they compare like entities and change behind your back." : "Entities: equal when their ids are equal; they change through methods that guard their rules."}`, vars2: { a: show(vars.a), b: show(vars.b), "a == b": String(e2.r) } }));
    return frames.map((f) => ({ ...f, vars: f.vars2 }));
  }
  function renderValueEntity(f) {
    const nodes = [], edges = [];
    const vk = ["a", "b", "c"].filter((k) => f.refs[k] !== undefined);
    vk.forEach((k, i) => nodes.push({ k: "v" + k, x: 80, y: 60 + i * 80, title: k, sub: "variable", w: 80, cls: f.hiVar === k ? "active" : "" }));
    f.heap.forEach((o, i) => {
      const live = vk.some((k) => f.refs[k] === o.n);
      nodes.push({ k: "o" + o.n, x: 420, y: 60 + i * 80, w: 200, title: `${f.cls} #${o.n}${o.pid ? ` · id ${o.pid}` : ""}`, sub: `${fmtAmt(o.amt)} ${o.ccy}${f.kind === 0 ? " · immutable" : ""}`,
        cls: f.hiObj === o.n ? (f.bad ? "bad" : "active") : live ? "" : "dim", shape: f.kind === 0 ? "iface" : undefined });
    });
    vk.forEach((k) => edges.push({ u: "v" + k, v: "o" + f.refs[k], cls: f.hiVar === k ? (f.bad ? "bad" : "active") : "muted" }));
    const H = 40 + Math.max(vk.length, f.heap.length) * 80;
    const svg = diagram({ nodes, edges, bands: [{ x: 20, y: 18, w: 130, h: H - 10, label: "stack", cls: "plain" }, { x: 290, y: 18, w: 260, h: H - 10, label: "heap", cls: "plain" }], view: [10, 0, 560, H + 14], label: "variables and objects" });
    const eqChip = f.eq === undefined ? "" : chip(`a == b → ${f.eq}`, f.eq ? "done" : "bad");
    const rules = f.final ? tbl("equality and change, side by side", ["kind", "a == b compares", "change", "safe to share?"], [
      { c: ["value object", "all fields", "returns a new object", "yes"], cls: f.kind === 0 ? "active" : "" },
      { c: ["mutable class", "references", "in place, by anyone", "no: aliasing bugs"], cls: f.kind === 1 ? "active" : "" },
      { c: ["entity", "id only", "through guarded methods", "yes: same thing over time"], cls: f.kind === 2 ? "active" : "" },
    ]) : "";
    return `<div class="ax-stack">${svg}<div>${eqChip}</div>${rules}</div>`;
  }
  Viz.register("domain-driven-design-value-vs-entity", (host) => Viz.player(host, {
    title: "Value object vs entity: equality, identity and aliasing", tag: "PICK A KIND",
    legend: [["active", "just changed / pointed at"], ["bad", "aliasing bug or rejected"], ["done", "equal"], ["dim", "no longer referenced"]],
    code: [
      "var a = new Money(10, EUR);",
      "var b = new Money(10, EUR);",
      "bool same = a == b;          // what does == compare?",
      "var c = a;                   // share the reference",
      "c = c.Minus(discount);       // value object: returns a NEW Money",
      "// mutable: c.Amount -= discount   (a changes too!)",
      "// entity:  c.Refund(discount)     (same payment, new state)",
      "Print(a, a == b);            // is a still what we think?",
    ],
    inputs: [
      { key: "kind", label: "kind", type: "select", options: VE_KINDS, value: VE_KINDS[1] },
      { key: "a", label: "a", value: "10 EUR", width: 120 },
      { key: "b", label: "b", value: "10 EUR", width: 120 },
      { key: "discount", label: "discount", value: "3", width: 80 },
    ],
    random: () => {
      const k = pick(VE_KINDS), amt = pick([10, 10, 25, 4]), ccy = pick(["EUR", "EUR", "USD"]);
      const ent = k === VE_KINDS[2];
      return { kind: k, a: `${ent ? "P1: " : ""}${amt} ${ccy}`, b: `${ent ? pick(["P1: ", "P2: "]) : ""}${pick([amt, amt, 12])} ${pick([ccy, ccy, "USD"])}`, discount: String(pick([3, 5, 30])) };
    },
    build: (vals) => {
      const frames = buildValueEntity(vals);
      return frames;
    },
    speed: 1500,
    render: renderValueEntity,
  }));

  /* =====================================================================
   * 4. Aggregate: invariants through the root vs anemic setters
   * ===================================================================== */
  const AG_MODES = ["rich: every change through the root", "anemic: services set fields directly"];
  const AG_INV = [
    ["I1", "quantity per line is 1–99"],
    ["I2", "order total ≤ credit limit"],
    ["I3", "no changes after submit"],
    ["I4", "a submitted order has a line"],
    ["I5", "one line per SKU"],
  ];
  function parseAgOps(s) {
    return items(s, "operations", 1, 12).map((t) => {
      let m;
      if ((m = t.match(/^add\s+([A-Za-z]{1,8})\s+(-?\d{1,4})\s+(\d{1,6})$/i))) return { op: "add", sku: m[1].toUpperCase(), qty: Number(m[2]), price: Number(m[3]), text: t };
      if ((m = t.match(/^qty\s+([A-Za-z]{1,8})\s+(-?\d{1,4})$/i))) return { op: "qty", sku: m[1].toUpperCase(), qty: Number(m[2]), text: t };
      if ((m = t.match(/^remove\s+([A-Za-z]{1,8})$/i))) return { op: "remove", sku: m[1].toUpperCase(), text: t };
      if (/^submit$/i.test(t)) return { op: "submit", text: t };
      throw new Error(`operations: “${t}” is not understood. Use add SKU qty price, qty SKU n, remove SKU or submit.`);
    });
  }
  function buildAggregate({ mode, limit, ops }) {
    const M = AG_MODES.indexOf(mode);
    if (M < 0) throw new Error("Pick a mode.");
    const rich = M === 0, L = int(limit, "credit limit", 1, 1000000), list = parseAgOps(ops);
    const st = { lines: [], status: "Draft", touchedAfterSubmit: false };
    const log = [], frames = [];
    const total = (s) => s.lines.reduce((a, l) => a + l.qty * l.price, 0);
    const broken = (s) => {
      const b = [];
      if (s.lines.some((l) => l.qty < 1 || l.qty > 99)) b.push("I1");
      if (total(s) > L) b.push("I2");
      if (s.touchedAfterSubmit) b.push("I3");
      if (s.status === "Submitted" && !s.lines.length) b.push("I4");
      if (new Set(s.lines.map((l) => l.sku)).size !== s.lines.length) b.push("I5");
      return b;
    };
    const snap = (extra) => ({ rich, L, lines: st.lines.map((l) => ({ ...l })), status: st.status, total: total(st), log: log.map((x) => ({ ...x })), broken: broken(st), ...extra,
      vars: { status: st.status, total: total(st), lines: st.lines.length, rejected: log.filter((x) => x.res === "rejected").length, "invalid states": log.filter((x) => x.res === "invalid").length, ...(extra.vars || {}) } });
    frames.push(snap({ line: 0, note: `The <b>Order</b> aggregate: the root Order plus its OrderLines, saved and loaded as one unit, with five invariants that must hold <b>after every change</b>. Credit limit: <b>${L}</b>. ${rich ? "In the rich model, outside code can only call methods on the root, and the root refuses changes that would break a rule." : "In the anemic model, Order and OrderLine are property bags. Each service is supposed to remember the rules, and here they don't."}` }));
    list.forEach((o) => {
      const before = JSON.stringify(st);
      let reason = null, line = 1;
      const find = () => st.lines.find((l) => l.sku === o.sku);
      if (rich) {
        const sim = JSON.parse(before);
        if (st.status === "Submitted") reason = ["I3", "the order is already submitted"];
        else if (o.op === "add") {
          line = 1;
          const ex = sim.lines.find((l) => l.sku === o.sku);
          const q = (ex ? ex.qty : 0) + o.qty;
          if (o.qty < 1 || q > 99) reason = ["I1", `quantity ${ex ? `${ex.qty} + ${o.qty}` : o.qty} is outside 1–99`];
          else { if (ex) ex.qty = q; else sim.lines.push({ sku: o.sku, qty: o.qty, price: o.price }); if (total(sim) > L) reason = ["I2", `total would be ${total(sim)} > limit ${L}`]; }
        } else if (o.op === "qty") {
          line = 2;
          const ex = sim.lines.find((l) => l.sku === o.sku);
          if (!ex) reason = ["–", `there is no ${o.sku} line`];
          else if (o.qty < 1 || o.qty > 99) reason = ["I1", `quantity ${o.qty} is outside 1–99 (use remove to drop a line)`];
          else { ex.qty = o.qty; if (total(sim) > L) reason = ["I2", `total would be ${total(sim)} > limit ${L}`]; }
        } else if (o.op === "remove") {
          line = 3;
          if (!sim.lines.some((l) => l.sku === o.sku)) reason = ["–", `there is no ${o.sku} line`];
          else sim.lines = sim.lines.filter((l) => l.sku !== o.sku);
        } else {
          line = 4;
          if (!sim.lines.length) reason = ["I4", "an empty order cannot be submitted"];
          else sim.status = "Submitted";
        }
        if (reason) {
          log.push({ text: o.text, res: "rejected", why: `${reason[0]}: ${reason[1]}` });
          frames.push(snap({ line, hiOp: log.length - 1, rejected: true, note: `<b>${esc(o.text)}</b> → the root <b>refuses</b> (${esc(reason[0])}: ${esc(reason[1])}). It throws a domain error, nothing is changed, and the aggregate is still valid. The caller gets a clear reason it can show the user.` }));
        } else {
          st.lines = sim.lines; st.status = sim.status;
          log.push({ text: o.text, res: "ok", why: "" });
          frames.push(snap({ line, hiOp: log.length - 1, hiSku: o.sku, note: `<b>${esc(o.text)}</b> → accepted. The root checked every rule that this change could affect before changing anything. Total is now ${total(st)}.` }));
        }
      } else {
        line = 6;
        if (st.status === "Submitted") st.touchedAfterSubmit = o.op !== "submit" || st.touchedAfterSubmit;
        if (o.op === "add") st.lines.push({ sku: o.sku, qty: o.qty, price: o.price });
        else if (o.op === "qty") { const ex = find(); if (ex) ex.qty = o.qty; }
        else if (o.op === "remove") st.lines = st.lines.filter((l) => l.sku !== o.sku);
        else st.status = "Submitted";
        const b = broken(st);
        log.push({ text: o.text, res: b.length ? "invalid" : "ok", why: b.join(", ") });
        frames.push(snap({ line, hiOp: log.length - 1, hiSku: o.sku, invalid: b.length > 0, note: `<b>${esc(o.text)}</b> → applied directly${o.op === "add" ? " with <code>order.Lines.Add(...)</code>" : o.op === "qty" ? " with <code>line.Qty = …</code>" : o.op === "submit" ? " with <code>order.Status = Submitted</code>" : ""}. ${b.length ? `The aggregate is now <b>invalid</b> (${b.join(", ")}), and nothing stopped it. This state will be saved and someone will find it in production.` : "Still valid, but only because this caller happened to do the right thing."}` }));
      }
    });
    const rej = log.filter((x) => x.res === "rejected").length, inv = log.filter((x) => x.res === "invalid").length;
    frames.push(snap({ line: rich ? 5 : 7, final: true, note: rich ? `Done: ${rej} change(s) rejected, <b>0 invalid states</b>. The rules exist in exactly one place, the aggregate root, and every path into the aggregate goes through it. That is what “an aggregate is a consistency boundary” means.` : `Done: <b>${inv} invalid state(s)</b> reached the database. Each service had to re-implement the rules, and the ones that forgot won. This is the <b>anemic domain model</b>: objects with data but no behaviour, rules scattered across services.` }));
    return frames;
  }
  function renderAggregate(f) {
    const n = f.lines.length, bw = Math.max(300, n * 150 + 20), bx = 190, cx = bx + bw / 2, W = bx + bw + 16;
    const nodes = [{ k: "caller", x: 80, y: 120, title: "service", sub: f.rich ? "calls root methods" : "sets any field", w: 130, cls: "" },
      { k: "root", x: cx, y: 70, title: `Order (root) · ${f.status}`, sub: `total ${f.total} / limit ${f.L}`, w: 230, cls: f.broken.length ? "bad" : f.rejected ? "active" : "accent" }];
    const edges = [];
    f.lines.forEach((l, i) => {
      const x = bx + 10 + 75 + i * 150;
      const bad = l.qty < 1 || l.qty > 99 || f.lines.filter((m) => m.sku === l.sku).length > 1;
      nodes.push({ k: "l" + i, x, y: 175, w: 136, title: `OrderLine ${l.sku}`, sub: `${l.qty} × ${l.price} = ${l.qty * l.price}`, cls: bad ? "bad" : f.hiSku === l.sku ? "active" : "" });
      edges.push({ u: "root", v: "l" + i, cls: "muted", nohead: true });
      if (!f.rich) edges.push({ u: "caller", v: "l" + i, cls: "bad", dash: true, curve: 18 });
    });
    edges.push({ u: "caller", v: "root", cls: f.rich ? "done" : "bad", label: f.rich ? "order.AddLine(…)" : "order.Status = …", ly: -10, lx: -20 });
    const bands = [{ x: bx, y: 22, w: bw, h: 190, label: "aggregate boundary · one transaction", cls: f.broken.length ? "bad" : "done" }];
    const svg = diagram({ nodes, edges, bands, view: [0, 0, W, 226], label: "order aggregate" });
    const log = tbl("operations", ["op", "result", "why"], f.log.map((x, i) => ({ c: [x.text, x.res, x.why], cls: i === f.hiOp ? (x.res === "ok" ? "active" : "bad") : x.res === "ok" ? "" : "bad" })), { empty: "no operations yet" });
    const inv = kv("invariants", AG_INV.map(([k, t]) => [`${k} ${t}`, f.broken.includes(k) ? "BROKEN" : "holds", f.broken.includes(k) ? "bad" : "done"]));
    return `<div class="ax-stack">${svg}<div class="ax-row">${log}${inv}</div></div>`;
  }
  Viz.register("domain-driven-design-aggregate", (host) => Viz.player(host, {
    title: "Aggregate: a consistency boundary guarded by its root", tag: "SCRIPT · COMPARE MODELS",
    legend: [["accent", "aggregate root"], ["active", "just changed"], ["bad", "rule broken / bypass"], ["done", "allowed path"]],
    code: [
      "class Order {                        // aggregate root",
      "  AddLine(sku, qty, price)  { Draft(); Qty(qty); MergeOrAdd(); Limit(); }",
      "  ChangeQty(sku, qty)       { Draft(); Qty(qty); Limit(); }",
      "  RemoveLine(sku)           { Draft(); lines.Remove(sku); }",
      "  Submit()                  { Draft(); NotEmpty(); status = Submitted; }",
      "}  // lines are private: no other way in",
      "// anemic: order.Lines.Add(...); line.Qty = 0; order.Status = Submitted;",
      "repository.Save(order);   // whatever state it is in",
    ],
    inputs: [
      { key: "mode", label: "model", type: "select", options: AG_MODES, value: AG_MODES[0] },
      { key: "limit", label: "credit limit", value: "500", width: 90 },
      { key: "ops", label: "operations (;)", value: "add BOOK 2 120; add PEN 10 3; add BOOK 1 120; qty PEN 0; add LAMP 1 250; submit; add MUG 1 15", width: 560 },
    ],
    random: () => {
      const skus = ["BOOK", "PEN", "LAMP", "MUG"], ops = [];
      for (let i = 0; i < 6; i++) {
        const r = Math.random();
        ops.push(r < 0.5 ? `add ${pick(skus)} ${pick([1, 2, 3, 0, 120])} ${pick([15, 40, 120, 250])}` : r < 0.7 ? `qty ${pick(skus)} ${pick([0, 2, 5])}` : r < 0.85 ? `remove ${pick(skus)}` : "submit");
      }
      ops.push(pick(["submit", `add MUG 1 15`]));
      return { mode: pick(AG_MODES), limit: String(pick([300, 500, 800])), ops: ops.join("; ") };
    },
    build: buildAggregate,
    speed: 1500,
    render: renderAggregate,
  }));

  /* =====================================================================
   * 5. Aggregate sizing: one big Conference vs one aggregate per Session
   * ===================================================================== */
  const SZ_MODES = ["one big Conference aggregate", "one small aggregate per Session"];
  const SZ_RETRIES = 3;
  function buildSizing({ mode, sessions, users, ticks, venue, seed }) {
    const M = SZ_MODES.indexOf(mode);
    if (M < 0) throw new Error("Pick a sizing.");
    const big = M === 0;
    const S = int(sessions, "sessions", 2, 8), U = int(users, "concurrent requests", 1, 30), T = int(ticks, "seconds", 1, 10), V = int(venue, "venue capacity", 1, 500);
    const rnd = mulberry(int(seed, "seed", 0, 99999));
    const reg = Array(S).fill(0);
    const totals = { commits: 0, conflicts: 0, gaveUp: 0, rejected: 0, waitlisted: 0, rows: 0, cmds: 0, maxOver: 0 };
    const hist = [], frames = [];
    let readModelTotal = 0;
    const snap = (extra) => ({ big, S, V, reg: [...reg], hist: hist.map((h) => ({ ...h })), totals: { ...totals }, ...extra,
      vars: { second: hist.length, registered: reg.reduce((a, b) => a + b, 0), commits: totals.commits, conflicts: totals.conflicts, "gave up": totals.gaveUp, "avg rows loaded": totals.cmds ? Math.round(totals.rows / totals.cmds) : 0 } });
    frames.push(snap({ line: 0, note: big
      ? `Every registration loads and saves the <b>whole Conference</b>: ${S} sessions and all their registrations, protected by one version number. The venue rule (≤ ${V} people) is easy to enforce because everything is in one place. ${U} requests arrive at the same moment each second.`
      : `Each <b>Session</b> is its own aggregate with its own version number. A registration loads one session only. The venue-wide rule (≤ ${V} people) now spans ${S} aggregates, so it can no longer be checked inside one transaction. ${U} requests arrive at the same moment each second.` }));
    for (let t = 1; t <= T; t++) {
      const want = Array.from({ length: U }, () => Math.floor(rnd() * S));
      const heat = Array(S).fill(0);
      let commits = 0, conflicts = 0, gaveUp = 0, rejected = 0;
      let pending = want.map((s) => ({ s, tries: 0 }));
      const startTotal = reg.reduce((a, b) => a + b, 0);
      for (let round = 0; round < SZ_RETRIES && pending.length; round++) {
        const next = [];
        const groups = new Map();
        pending.forEach((p) => { const key = big ? 0 : p.s; if (!groups.has(key)) groups.set(key, []); groups.get(key).push(p); });
        groups.forEach((list) => {
          list.forEach((p) => { totals.cmds++; totals.rows += big ? 1 + S + reg.reduce((a, b) => a + b, 0) : 1 + reg[p.s]; });
          const now = reg.reduce((a, b) => a + b, 0);
          if ((big && now >= V) || (!big && readModelTotal >= V)) { rejected += list.length; return; }
          const winner = list[Math.floor(rnd() * list.length)];
          reg[winner.s]++; commits++;
          list.forEach((p) => {
            if (p === winner) return;
            conflicts++; heat[p.s]++;
            p.tries++;
            if (p.tries >= SZ_RETRIES) gaveUp++; else next.push(p);
          });
        });
        pending = next;
      }
      gaveUp += pending.length;
      let waitlisted = 0;
      const after = reg.reduce((a, b) => a + b, 0);
      const over = Math.max(0, after - V);
      if (!big && over) {
        totals.maxOver = Math.max(totals.maxOver, over);
        for (let k = 0; k < over; k++) { const i = reg.indexOf(Math.max(...reg)); reg[i]--; waitlisted++; }
      }
      readModelTotal = reg.reduce((a, b) => a + b, 0);
      totals.commits += commits; totals.conflicts += conflicts; totals.gaveUp += gaveUp; totals.rejected += rejected; totals.waitlisted += waitlisted;
      hist.push({ t, commits, conflicts, gaveUp, rejected, over, waitlisted });
      const note = big
        ? `Second ${t}: ${U} requests all hit the same aggregate. Optimistic concurrency lets <b>one</b> save per round win; the rest get a version conflict and retry (up to ${SZ_RETRIES} rounds). Result: ${commits} registered, <b>${conflicts} conflicts</b>, ${gaveUp} gave up${rejected ? `, ${rejected} rejected because the venue is full` : ""}. Each attempt loaded about ${1 + S + startTotal} rows.`
        : `Second ${t}: requests spread over ${S} sessions, so most land on different aggregates and commit in parallel: ${commits} registered, ${conflicts} conflicts, ${gaveUp} gave up${rejected ? `, ${rejected} turned away because the venue read model shows it full` : ""}.${over ? ` But the sessions could not see each other's registrations: the venue reached <b>${after}/${V}</b>. An <b>eventual</b> policy reacts to the “registered” events and moves ${waitlisted} person(s) to the wait-list.` : " The venue rule held this second, checked against a read model of the total."}`;
      frames.push(snap({ line: big ? 2 : 4, heat, tick: t, over, note }));
    }
    const reqs = U * T;
    frames.push(snap({ line: big ? 3 : 5, final: true, note: big
      ? `Done: ${totals.commits} of ${reqs} requests registered${totals.rejected ? ` (${totals.rejected} turned away: venue full)` : ""}, <b>${totals.gaveUp} users saw an error</b> after ${SZ_RETRIES} conflicts, and every command loaded the whole conference. The venue rule was never broken: big aggregates buy strict consistency with contention and load cost.`
      : `Done: ${totals.commits} of ${reqs} requests registered${totals.rejected ? ` (${totals.rejected} turned away: venue full)` : ""} with only ${totals.conflicts} conflicts, and each command loaded one session. The price: the venue rule is <b>eventually</b> consistent (peak overbooking ${totals.maxOver}, ${totals.waitlisted} wait-listed by a policy). Ask the business whether “briefly over, then fixed” is acceptable. It usually is.` }));
    return frames;
  }
  function renderSizing(f) {
    const nodes = [], bands = [], W = 140 + f.S * 120;
    const heat = f.heat || Array(f.S).fill(0);
    f.reg.forEach((r, i) => {
      const x = 90 + i * 120;
      nodes.push({ k: "s" + i, x, y: f.big ? 92 : 80, w: 108, title: `Session ${String.fromCharCode(65 + i)}`, sub: `${r} registered`, cls: heat[i] > 2 ? "bad" : heat[i] ? "active" : "", badge: heat[i] ? String(heat[i]) : undefined, badgeCls: "bad" });
      if (!f.big) bands.push({ x: x - 60, y: 32, w: 120, h: 84, label: "v" + (r + 1), cls: heat[i] ? "active" : "plain" });
    });
    if (f.big) bands.push({ x: 24, y: 22, w: f.S * 120 + 12, h: 104, label: "Conference aggregate: one version, one lock", cls: (f.hist.at(-1)?.conflicts || 0) > 0 && !f.final ? "bad" : "done" });
    const total = f.reg.reduce((a, b) => a + b, 0);
    nodes.push({ k: "venue", x: W / 2, y: 172, w: 260, title: `venue ${total} / ${f.V}`, sub: f.big ? "checked inside the aggregate" : "checked by a policy, eventually", cls: f.over ? "bad" : f.big ? "done" : "visit" });
    const edges = f.big ? [] : f.reg.map((_, i) => ({ u: "s" + i, v: "venue", cls: "muted", dash: true, nohead: true }));
    const svg = diagram({ nodes, edges, bands, view: [10, 6, W, 196], label: "aggregate sizing" });
    const t = tbl("per second", ["s", "commits", "conflicts", "gave up", "venue over by", "wait-listed"], f.hist.map((h) => ({ c: [h.t, h.commits, h.conflicts, h.gaveUp, h.over, h.waitlisted], cls: h.t === f.tick ? "active" : h.gaveUp ? "bad" : "" })), { empty: "no traffic yet" });
    const s = stats([["conflicts", f.totals.conflicts, f.totals.conflicts ? "bad" : "done"], ["users who gave up", f.totals.gaveUp, f.totals.gaveUp ? "bad" : "done"], ["avg rows per command", f.totals.cmds ? Math.round(f.totals.rows / f.totals.cmds) : 0, ""], ["peak overbooking", f.totals.maxOver, f.totals.maxOver ? "bad" : "done"]]);
    return `<div class="ax-stack">${svg}${s}${t}</div>`;
  }
  Viz.register("domain-driven-design-sizing", (host) => Viz.player(host, {
    title: "Aggregate size: contention vs consistency", tag: "SIMULATION",
    legend: [["active", "conflict this second"], ["bad", "many conflicts / rule broken"], ["done", "rule enforced in one transaction"], ["visit", "rule enforced eventually"]],
    code: [
      "// big: Conference { Sessions[], Registrations[] }   one version number",
      "var conf = repo.Load(conferenceId);          // loads everything",
      "conf.Register(sessionId, attendee);          // checks venue capacity",
      "repo.Save(conf, expectedVersion);            // conflict => retry",
      "// small: Session is the aggregate; venue rule moves to a policy",
      "on SeatRegistered: if (total > venue) waitlist.Add(latest);",
    ],
    inputs: [
      { key: "mode", label: "sizing", type: "select", options: SZ_MODES, value: SZ_MODES[0] },
      { key: "sessions", label: "sessions", value: "5", width: 70 },
      { key: "users", label: "requests / second", value: "8", width: 70 },
      { key: "ticks", label: "seconds", value: "6", width: 70 },
      { key: "venue", label: "venue capacity", value: "30", width: 80 },
      { key: "seed", label: "seed", value: "7", width: 70 },
    ],
    random: () => ({ mode: pick(SZ_MODES), sessions: String(pick([3, 4, 5, 6, 8])), users: String(pick([2, 5, 8, 12, 20])), ticks: String(pick([4, 6, 8])), venue: String(pick([20, 30, 60])), seed: String(Math.floor(Math.random() * 1000)) }),
    build: buildSizing,
    speed: 1700,
    render: renderSizing,
  }));

  /* =====================================================================
   * 6. Domain events vs integration events, and when to publish
   * ===================================================================== */
  const EV_PUB = ["publish to broker, then commit", "commit, then publish to broker", "outbox: commit order + event row together"];
  const EV_FAIL = ["no failure", "broker is down", "process crashes right after the commit", "the transaction rolls back"];
  function buildEvents({ pub, fail }) {
    const P = EV_PUB.indexOf(pub), F = EV_FAIL.indexOf(fail);
    if (P < 0 || F < 0) throw new Error("Pick a publishing strategy and a failure.");
    const msgs = [], frames = [];
    const st = { order: "–", points: "–", outbox: "–", broker: 0, shipping: 0, dupes: 0 };
    let verdict = null;
    const push = (m, line, note, extra = {}) => { if (m) msgs.push(m); frames.push({ msgs: msgs.map((x) => ({ ...x })), st: { ...st }, P, line, note, ...extra, vars: { order: st.order, outbox: st.outbox, "broker msgs": st.broker, "shipping saw": st.shipping } }); };
    push({ f: "api", t: "agg", label: "order.Place()" }, 0, `The <b>Ordering</b> application service calls <code>order.Place()</code>. The aggregate records a <b>domain event</b> <code>OrderPlaced</code> in its own list. Nothing has been sent anywhere yet.`);
    push({ f: "agg", t: "agg", label: "+ OrderPlaced (domain)", cls: "accent" }, 1, `A <b>domain event</b> is an in-process fact, written in the bounded context's own language, with rich internal types. Handlers in the same context run before the commit, in the same transaction.`);
    push({ f: "api", t: "loy", label: "dispatch OrderPlaced", cls: "accent" }, 2, `The unit of work dispatches domain events to in-process handlers: <b>Loyalty</b> (same context, same database) adds points. If it fails, everything rolls back together: one consistent change.`);
    st.points = "pending";
    const rollback = F === 3, brokerDown = F === 1, crash = F === 2;
    const commit = (withOutbox) => {
      if (rollback) {
        st.order = "–"; st.points = "–"; if (withOutbox) st.outbox = "–";
        push({ f: "api", t: "db", label: "COMMIT ✗ rollback", cls: "bad" }, 3, `The commit <b>fails</b> (for example a unique-key clash or a deadlock), so the order and the loyalty points are rolled back${withOutbox ? ", and so is the outbox row: they were in the same transaction" : ""}.`, { bad: true });
        return false;
      }
      st.order = "saved"; st.points = "saved"; if (withOutbox) st.outbox = "pending";
      push({ f: "api", t: "db", label: withOutbox ? "COMMIT order + points + outbox row" : "COMMIT order + points", cls: "done" }, 3, withOutbox
        ? `One local transaction saves the order, the points, <b>and</b> an <code>outbox</code> row holding the integration event <code>OrderPlacedV1</code>. Either all three exist or none do.`
        : `The order and points are committed. The broker knows nothing about it yet.`);
      return true;
    };
    const publish = (from, label) => {
      if (brokerDown) { push({ f: from, t: "bus", label: `${label} ✗ broker down`, cls: "bad", lost: true }, 4, `The broker is unreachable.`, { bad: true }); return false; }
      st.broker++;
      push({ f: from, t: "bus", label, cls: "visit" }, 4, `The <b>integration event</b> <code>OrderPlacedV1</code> is published. Unlike the domain event, it is a public, versioned contract with plain types (ids, amounts, timestamps) that other services depend on.`);
      return true;
    };
    const deliver = () => { st.shipping++; push({ f: "bus", t: "ship", label: "OrderPlacedV1", cls: "visit" }, 5, `<b>Shipping</b> (another service with its own database) receives the event and creates a shipment.`); };
    if (P === 0) {
      const ok = publish("api", "publish OrderPlacedV1");
      if (!ok) { st.order = "–"; st.points = "–"; push({ f: "api", t: "db", label: "ROLLBACK (exception)", cls: "bad" }, 3, `The publish threw, so the handler never commits. The <b>customer's order fails</b> because a broker is down: the broker has become part of your availability.`, { bad: true }); verdict = ["bad", "Order lost to a broker outage: no data corruption, but the broker's downtime is now your downtime."]; }
      else {
        deliver();
        const c = commit(false);
        if (!c) verdict = ["bad", "Ghost event: Shipping is preparing a shipment for an order that does not exist. Publishing before the commit announces something that may never happen."];
        else if (crash) { push(null, 6, `The process crashes after the commit, but the event was already sent, so nothing is lost in this run.`); verdict = ["warn", "Survived this time, but the order of operations is still wrong: a rollback would have produced a ghost event."]; }
        else verdict = ["warn", "Works on the happy path. Any failure between the publish and the commit leaves a ghost event behind."];
      }
    } else if (P === 1) {
      const c = commit(false);
      if (!c) verdict = ["done", "Consistent: no order and no event. The commit-then-publish order handles rollbacks correctly."];
      else if (crash) { push({ f: "api", t: "api", label: "✗ crash", cls: "bad" }, 6, `The process dies <b>after the commit, before the publish</b>. The in-memory event is gone with it.`, { bad: true }); verdict = ["bad", "Lost event: the order exists but Shipping will never hear about it. Nobody notices until a customer asks where the parcel is."]; }
      else if (!publish("api", "publish OrderPlacedV1")) { push(null, 6, `The order is already committed, so the handler cannot undo it. A retry in memory is lost on the next deploy or crash.`, { bad: true }); verdict = ["bad", "Lost event (dual write): the database and the broker disagree. Two systems cannot be updated atomically without help."]; }
      else { deliver(); verdict = ["warn", "Works on the happy path, but it is a dual write: a crash or broker outage between the two steps loses the event."]; }
    } else {
      const c = commit(true);
      if (!c) verdict = ["done", "Consistent: the order, the points and the outbox row rolled back together. No ghost event is possible."];
      else {
        if (crash) push({ f: "api", t: "api", label: "✗ crash (doesn't matter)", cls: "bad" }, 6, `The web process crashes after the commit. That is fine: the event is safely in the outbox table, not in memory.`);
        if (brokerDown) {
          push({ f: "relay", t: "db", label: "poll outbox: 1 pending" }, 7, `The <b>outbox relay</b> (a background worker or CDC) reads pending rows.`);
          publish("relay", "publish (attempt 1)");
          push({ f: "relay", t: "relay", label: "back off, retry later" }, 7, `The row stays <b>pending</b>. The customer's order already succeeded: the broker outage only delays the event.`);
        } else push({ f: "relay", t: "db", label: "poll outbox: 1 pending" }, 7, `The <b>outbox relay</b> (a background worker or CDC) reads pending rows.`);
        const realBrokerDown = brokerDown;
        if (realBrokerDown) { push(null, 7, `…the broker comes back…`); }
        st.broker++;
        push({ f: "relay", t: "bus", label: realBrokerDown ? "publish (attempt 2)" : "publish OrderPlacedV1", cls: "visit" }, 7, `The relay publishes the <b>integration event</b> <code>OrderPlacedV1</code>: a public, versioned contract with plain types.`);
        if (crash) {
          push({ f: "relay", t: "relay", label: "✗ crash before marking sent", cls: "bad" }, 8, `Worst case for the outbox: the relay crashes after publishing but <b>before</b> marking the row as sent. On restart it publishes the same event again.`);
          st.broker++;
          push({ f: "relay", t: "bus", label: "publish again (same event id)", cls: "visit" }, 7, `At-least-once delivery: the event goes out twice, with the <b>same event id</b>.`);
        }
        st.outbox = "sent";
        push({ f: "relay", t: "db", label: "mark outbox row sent", cls: "done" }, 8, `The row is marked as sent.`);
        deliver();
        if (crash) { st.dupes++; push({ f: "bus", t: "ship", label: "OrderPlacedV1 (duplicate)", cls: "visit" }, 9, `Shipping receives the duplicate, finds the event id in its <b>inbox / processed-ids</b> table, and ignores it. That is why consumers must be idempotent.`); }
        verdict = ["done", crash ? "Consistent: at-least-once delivery produced a duplicate, and the idempotent consumer absorbed it. The outbox trades “exactly once” for “at least once + dedupe”." : brokerDown ? "Consistent: the broker outage only delayed the event. The customer never noticed." : "Consistent: the event is published if and only if the order was committed."];
      }
    }
    push(null, P === 2 ? 9 : 6, `<b>Result:</b> ${verdict[1]}`, { final: true, verdict });
    return frames;
  }
  function renderEvents(f) {
    const actors = [
      { k: "api", title: "Ordering", sub: "app service" },
      { k: "agg", title: "Order", sub: "aggregate", cls: "accent" },
      { k: "loy", title: "Loyalty", sub: "same context" },
      { k: "db", title: "Orders DB", sub: f.P === 2 ? "+ outbox table" : "" },
    ];
    if (f.P === 2) actors.push({ k: "relay", title: "Outbox relay", sub: "worker / CDC" });
    actors.push({ k: "bus", title: "Broker", sub: "topic" }, { k: "ship", title: "Shipping", sub: "other service" });
    const svg = seq({ actors, msgs: f.msgs, colW: 116, rowH: 28, rows: f.P === 2 ? 15 : 10, label: "event publishing sequence" });
    const st = f.st;
    const k = kv("state", [["order row", st.order, st.order === "saved" ? "done" : ""], ["loyalty points", st.points, st.points === "saved" ? "done" : ""],
      ...(f.P === 2 ? [["outbox row", st.outbox, st.outbox === "sent" ? "done" : st.outbox === "pending" ? "active" : ""]] : []),
      ["messages on broker", st.broker, ""], ["Shipping processed", st.shipping - st.dupes + (st.dupes ? " (+1 duplicate ignored)" : ""), st.shipping && st.order !== "saved" ? "bad" : st.shipping ? "done" : ""]]);
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}<div class="ax-row">${k}${v}</div></div>`;
  }
  Viz.register("domain-driven-design-events", (host) => Viz.player(host, {
    title: "Domain events, integration events and the dual-write trap", tag: "PICK A STRATEGY · BREAK IT",
    legend: [["accent", "domain event (in-process)"], ["visit", "integration event (public)"], ["done", "committed"], ["bad", "failure"]],
    code: [
      "order.Place();                       // records OrderPlaced",
      "events = order.DomainEvents;         // in-memory, rich types",
      "await mediator.Publish(events);      // same-context handlers, same tx",
      "await uow.CommitAsync();             // the one local transaction",
      "await bus.Publish(new OrderPlacedV1(order.Id, total));  // where?",
      "// Shipping: on OrderPlacedV1 → create shipment",
      "// ...",
      "// relay: foreach pending outbox row → publish → mark sent",
      "// relay crash between publish and mark-sent → duplicate",
      "// consumer: if (inbox.Seen(eventId)) return;",
    ],
    inputs: [
      { key: "pub", label: "publish", type: "select", options: EV_PUB, value: EV_PUB[1] },
      { key: "fail", label: "failure", type: "select", options: EV_FAIL, value: EV_FAIL[2] },
    ],
    random: () => ({ pub: pick(EV_PUB), fail: pick(EV_FAIL) }),
    build: buildEvents,
    speed: 1500,
    render: renderEvents,
  }));

  /* =====================================================================
   * 7. Event storming: build the board from a script of stickies
   * ===================================================================== */
  function parseStorm(s) {
    const out = [];
    items(s, "board", 2, 14).forEach((raw) => {
      const t = raw.trim();
      let m;
      if (t.startsWith("!")) { const q = t.slice(1).trim(); if (!q) throw new Error("board: a hot spot needs text after the “!”."); out.push({ kind: "hot", text: q }); return; }
      if ((m = t.match(/^policy\s*:\s*(.+?)\s*=>\s*(.+)$/i))) { out.push({ kind: "pol", ev: m[1].trim(), cmd: m[2].trim() }); return; }
      if ((m = t.match(/^(.+?)\s*:\s*(.+?)\s*->\s*(.+?)\s*\[\s*(.+?)\s*\]\s*@\s*(.+)$/))) {
        out.push({ kind: "cmd", actor: m[1].trim(), cmd: m[2].trim(), ev: m[3].trim(), agg: m[4].trim(), ctx: m[5].trim() }); return;
      }
      throw new Error(`board: “${t}” is not understood. Use “Actor: Command -> Event [Aggregate] @Context”, “policy: Event => Command” or “! question”.`);
    });
    const evs = new Set(out.filter((x) => x.kind === "cmd").map((x) => x.ev.toLowerCase()));
    out.forEach((x) => { if (x.kind === "pol" && !evs.has(x.ev.toLowerCase())) throw new Error(`board: the policy “${x.ev} => ${x.cmd}” reacts to an event that is not on the board.`); });
    if (!out.some((x) => x.kind === "cmd")) throw new Error("board: add at least one “Actor: Command -> Event [Aggregate] @Context” line.");
    return out;
  }
  const ES_PHASES = ["chaotic exploration: events", "timeline + hot spots", "commands + actors", "aggregates", "policies", "bounded contexts"];
  function buildStorm({ board }) {
    const list = parseStorm(board);
    const notes = [
      `<b>1. Chaotic exploration.</b> Everyone writes <b>domain events</b> on orange stickies: things that happened, in the past tense, that a domain expert cares about. No tech words (“row inserted”) allowed. Here: ${list.filter((x) => x.kind === "cmd").length} events.`,
      `<b>2. Enforce the timeline.</b> Order the events left to right and mark disagreements and unknowns as pink <b>hot spots</b>${list.some((x) => x.kind === "hot") ? `: “${esc(list.find((x) => x.kind === "hot").text)}”` : ""}. Hot spots are the most valuable output: they are where the real complexity hides.`,
      `<b>3. Commands and actors.</b> For each event, ask “what caused it?”. A blue <b>command</b> (an intention, in the imperative) issued by a yellow <b>actor</b> (a person, role or external system).`,
      `<b>4. Aggregates.</b> Ask “who decides whether this command is allowed?”. The pale-yellow sticky is the <b>aggregate</b> that receives the command, checks its rules and emits the event.`,
      `<b>5. Policies.</b> Lilac <b>policies</b> are reactions: “<i>whenever</i> event X happens, <i>then</i> do command Y”. They chain the flow together, and each one is a candidate event handler, saga step or process manager.`,
      `<b>6. Bounded contexts.</b> Draw boundaries where the language changes and the aggregates cluster. Policies that cross a boundary become <b>integration events</b> between contexts (or services). The board is now a first draft of your context map.`,
    ];
    return ES_PHASES.map((p, i) => ({ list, phase: i, line: i, note: notes[i], final: i === 5,
      vars: { phase: p, events: list.filter((x) => x.kind === "cmd").length, policies: list.filter((x) => x.kind === "pol").length, "hot spots": list.filter((x) => x.kind === "hot").length } }));
  }
  function wrap2(s, n) {
    const words = String(s).split(/\s+/), lines = [""];
    words.forEach((w) => { const cur = lines[lines.length - 1]; if ((cur + " " + w).trim().length > n && cur) lines.push(w); else lines[lines.length - 1] = (cur + " " + w).trim(); });
    if (lines.length > 2) { lines.length = 2; lines[1] = lines[1].slice(0, n - 1) + "…"; }
    return lines;
  }
  function sticky(cls, x, y, w, h, text, extra = "") {
    const lines = wrap2(text, Math.floor(w / 6.6));
    const ty = y + h / 2 - (lines.length - 1) * 6.5 + 4;
    return `<g class="es-s ${cls}" ${extra}><rect x="${x}" y="${y}" width="${w}" height="${h}" rx="3"/>` +
      lines.map((l, i) => `<text x="${x + w / 2}" y="${ty + i * 13}" text-anchor="middle">${esc(l)}</text>`).join("") + "</g>";
  }
  function renderStorm(f) {
    const L = f.list, P = f.phase, CW = 128, SW = 112, x0 = 18;
    const rows = { act: 56, cmd: 98, agg: 146, ev: 194, mid: 146 };
    const cols = L.map((_, i) => x0 + i * CW);
    const W = x0 * 2 + L.length * CW - (CW - SW), H = 266;
    let g = "";
    if (P >= 5) {
      const groups = [];
      L.forEach((it, i) => {
        if (it.kind !== "cmd") return;
        const last = groups[groups.length - 1];
        if (last && last.ctx.toLowerCase() === it.ctx.toLowerCase() && L.slice(last.to + 1, i).every((x) => x.kind !== "cmd")) last.to = i;
        else groups.push({ ctx: it.ctx, from: i, to: i });
      });
      groups.forEach((gr, k) => {
        const x = cols[gr.from] - 8, w = cols[gr.to] + SW + 8 - x;
        g += `<rect class="es-ctx c${k % 4}" x="${x}" y="8" width="${w}" height="${H - 16}" rx="12"/><text class="es-ctxl" x="${x + 10}" y="24">${esc(gr.ctx)}</text>`;
      });
    }
    g += `<line class="es-time" x1="${x0}" x2="${W - 6}" y1="${H - 22}" y2="${H - 22}"/><text class="es-timel" x="${W - 10}" y="${H - 8}" text-anchor="end">time →</text>`;
    const evIndex = new Map(), cmdIndex = new Map();
    L.forEach((it, i) => { if (it.kind === "cmd") { evIndex.set(it.ev.toLowerCase(), i); cmdIndex.set(it.cmd.toLowerCase(), cmdIndex.get(it.cmd.toLowerCase()) ?? i); } });
    let arrows = "";
    const arrow = (x1, y1, x2, y2) => `<path class="es-arrow" d="M${x1},${y1} C${(x1 + x2) / 2},${y1} ${(x1 + x2) / 2},${y2} ${x2},${y2}" marker-end="url(#domain-driven-design-es-ah)"/>`;
    L.forEach((it, i) => {
      const x = cols[i];
      if (it.kind === "cmd") {
        if (P >= 2) g += sticky("es-act", x + 18, rows.act - 22, SW - 36, 28, it.actor);
        if (P >= 2) g += sticky("es-cmd", x, rows.cmd - 20, SW, 40, it.cmd);
        if (P >= 3) g += sticky("es-agg", x + 8, rows.agg - 18, SW - 16, 34, it.agg);
        g += sticky("es-ev", x, rows.ev - 20, SW, 40, it.ev);
      } else if (it.kind === "hot" && P >= 1) {
        g += sticky("es-hot", x + 6, rows.mid - 24, SW - 12, 48, it.text, `transform="rotate(-4 ${x + SW / 2} ${rows.mid})"`);
      } else if (it.kind === "pol" && P >= 4) {
        g += sticky("es-pol", x + 4, rows.mid - 20, SW - 8, 40, `whenever ${it.ev}`);
        const e = evIndex.get(it.ev.toLowerCase());
        if (e !== undefined) arrows += arrow(cols[e] + SW, rows.ev, x + 4, rows.mid + 6);
        const c = [...L.keys()].find((j) => j > i && L[j].kind === "cmd" && L[j].cmd.toLowerCase() === it.cmd.toLowerCase());
        if (c !== undefined) arrows += arrow(x + SW - 4, rows.mid - 6, cols[c], rows.cmd);
      }
    });
    const defs = `<defs><marker id="domain-driven-design-es-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path class="es-ahp" d="M0,0 L10,5 L0,10 z"/></marker></defs>`;
    const svg = `<svg class="ax-g es-board" viewBox="0 0 ${W} ${H}" width="${W}" style="width:100%;height:auto;max-width:${W}px;min-width:${Math.min(W, 760)}px" role="img" aria-label="event storming board">${defs}${g}${arrows}</svg>`;
    const legend = `<div class="es-legend">${[["es-ev", "domain event"], ["es-cmd", "command"], ["es-act", "actor"], ["es-agg", "aggregate"], ["es-pol", "policy"], ["es-hot", "hot spot"]].map(([c, t], k) => `<span class="${c} ${k === 0 || (k === 5 && P >= 1) || ((k === 1 || k === 2) && P >= 2) || (k === 3 && P >= 3) || (k === 4 && P >= 4) ? "" : "off"}">${t}</span>`).join("")}</div>`;
    let summary = "";
    if (f.final) {
      const ctx = new Map();
      L.forEach((it) => { if (it.kind !== "cmd") return; const k = it.ctx; if (!ctx.has(k)) ctx.set(k, { aggs: new Set(), evs: [], cmds: [], out: new Set() }); const c = ctx.get(k); c.aggs.add(it.agg); c.evs.push(it.ev); c.cmds.push(it.cmd); });
      const ctxOfEv = new Map(), ctxOfCmd = new Map();
      L.forEach((it) => { if (it.kind === "cmd") { ctxOfEv.set(it.ev.toLowerCase(), it.ctx); ctxOfCmd.set(it.cmd.toLowerCase(), it.ctx); } });
      L.forEach((it) => { if (it.kind !== "pol") return; const a = ctxOfEv.get(it.ev.toLowerCase()), b = ctxOfCmd.get(it.cmd.toLowerCase()); if (a && b && a !== b) ctx.get(a).out.add(`${it.ev} → ${b}`); });
      summary = tbl("first-draft context map", ["context", "aggregates", "commands", "publishes to others"], [...ctx.entries()].map(([k, c]) => ({ c: [k, [...c.aggs].join(", "), c.cmds.join(", "), [...c.out].join("; ") || "–"], cls: c.out.size ? "active" : "" })), { html: false });
    }
    return `<div class="ax-stack">${legend}<div class="es-wrap">${svg}</div>${summary}</div>`;
  }
  Viz.register("domain-driven-design-event-storming", (host) => Viz.player(host, {
    title: "Event storming, one phase at a time", tag: "WRITE THE BOARD",
    legend: [["active", "context that publishes integration events"]],
    code: [
      "1  storm domain events (orange), past tense",
      "2  sort into a timeline; mark hot spots (pink)",
      "3  add commands (blue) and actors (yellow)",
      "4  add aggregates (pale yellow) that decide",
      "5  add policies (lilac): whenever X then Y",
      "6  draw bounded-context boundaries",
    ],
    inputs: [
      { key: "board", label: "board (;)", width: 760,
        value: "Customer: Place order -> Order placed [Order] @Sales; policy: Order placed => Capture payment; Payment provider: Capture payment -> Payment captured [Payment] @Billing; ! What if stock runs out after payment?; policy: Payment captured => Reserve stock; Warehouse: Reserve stock -> Stock reserved [Stock] @Inventory; Courier: Ship parcel -> Parcel shipped [Shipment] @Shipping" },
    ],
    random: () => pick([
      { board: "Patient: Request appointment -> Appointment requested [Appointment] @Scheduling; policy: Appointment requested => Confirm slot; Receptionist: Confirm slot -> Appointment confirmed [Appointment] @Scheduling; ! Double-booked doctors?; Doctor: Record visit -> Visit recorded [Visit] @Clinical; policy: Visit recorded => Issue invoice; Billing clerk: Issue invoice -> Invoice issued [Invoice] @Billing" },
      { board: "Driver: Request ride -> Ride requested [Ride] @Dispatch; policy: Ride requested => Assign driver; Dispatcher: Assign driver -> Driver assigned [Ride] @Dispatch; Driver: Complete ride -> Ride completed [Ride] @Dispatch; policy: Ride completed => Charge rider; Payment gateway: Charge rider -> Rider charged [Charge] @Payments; ! Who pays for a cancelled ride?" },
      { board: "Author: Submit article -> Article submitted [Article] @Editorial; ! Can an editor review their own article?; Editor: Approve article -> Article approved [Article] @Editorial; policy: Article approved => Schedule publication; Scheduler: Schedule publication -> Publication scheduled [Issue] @Publishing; policy: Publication scheduled => Notify subscribers; Mailer: Notify subscribers -> Subscribers notified [Campaign] @Marketing" },
    ]),
    build: buildStorm,
    speed: 2200,
    render: renderStorm,
  }));

  /* =====================================================================
   * 8. Is DDD worth it here? A decision walk-through
   * ===================================================================== */
  const FIT_Q = [
    { key: "rules", q: "How complex are the business rules?", opts: ["forms over data (CRUD)", "some rules and workflows", "many interacting rules that change often"], w: [0, 2, 4] },
    { key: "core", q: "Is this what makes the business different?", opts: ["generic: everyone has one", "supporting: needed, not special", "core: our competitive edge"], w: [-2, 0, 3] },
    { key: "experts", q: "Can you talk to domain experts regularly?", opts: ["no", "now and then", "yes, they are part of the team"], w: [-1, 1, 2] },
    { key: "life", q: "How long will this code live and change?", opts: ["months (a prototype)", "1–3 years", "5+ years"], w: [-2, 0, 2] },
    { key: "teams", q: "How many teams work on the system?", opts: ["one small team", "a few teams", "many teams"], w: [0, 1, 2] },
  ];
  function buildFit(vals) {
    const frames = [];
    let score = 0, strategic = 0;
    const answers = [];
    FIT_Q.forEach((q, i) => {
      const a = q.opts.indexOf(vals[q.key]);
      if (a < 0) throw new Error(`Pick an answer for “${q.q}”.`);
      score += q.w[a];
      if (q.key === "teams" || q.key === "core") strategic += a;
      answers.push({ q: q.q, a: q.opts[a], w: q.w[a] });
      const why = {
        rules: ["CRUD has no invariants worth modelling: an aggregate would just wrap setters.", "Some rules: value objects and a few rich entities already pay off.", "Interacting, changing rules are exactly what a rich model is for."],
        core: ["Generic subdomains should be bought or kept simple (an off-the-shelf identity provider, an invoicing SaaS).", "Supporting subdomains deserve clean code, not the full toolkit.", "Spend your modelling effort where the business competes."],
        experts: ["Without experts, “ubiquitous language” turns into developers guessing.", "Occasional access: run an event-storming session and keep a glossary.", "Experts in the loop: the model can evolve with the business."],
        life: ["A throw-away prototype will not repay the modelling effort.", "Medium lifetime: invest where change is likely.", "Long-lived code pays back every hour spent on a clear model."],
        teams: ["One team: strategic design is mostly a whiteboard exercise.", "A few teams: bounded contexts and a context map prevent a shared-model tangle.", "Many teams: bounded contexts are how you split the work at all."],
      }[q.key][a];
      frames.push({ answers: answers.map((x) => ({ ...x })), score, cur: i, line: i, note: `<b>${esc(q.q)}</b> “${esc(q.opts[a])}” → ${q.w[a] >= 0 ? "+" : ""}${q.w[a]}. ${why}`, vars: { score } });
    });
    let rec;
    if (score <= 1) rec = { cls: "bad", title: "Skip DDD here: keep it simple", use: ["CRUD controllers or a transaction script", "validation attributes / schemas", "a few value objects (Money, Email) if you like"], skip: ["aggregates, repositories per aggregate, domain events", "a domain layer that only forwards calls"] };
    else if (score <= 6) rec = { cls: "warn", title: "DDD-lite: borrow the cheap, high-value tools", use: ["value objects everywhere a primitive has rules", "rich entities that guard their own invariants", "a glossary of the ubiquitous language"], skip: ["event sourcing, sagas, a mediator for everything", "separate read models unless queries hurt"] };
    else rec = { cls: "done", title: "Full DDD in this core subdomain", use: ["event storming with domain experts", "bounded contexts + a context map", "aggregates sized by invariants, domain events, ACLs at the edges"], skip: ["applying the same depth to generic and supporting parts"] };
    if (strategic >= 3 && score <= 6) rec.use.push("strategic design anyway: bounded contexts and a context map between teams");
    frames.push({ answers, score, rec, final: true, line: 5, note: `<b>Score ${score}.</b> ${esc(rec.title)}. DDD is not all-or-nothing: the strategic half (language, contexts) is cheap and almost always useful, while the tactical half (aggregates, events) is for complex core domains.`, vars: { score } });
    return frames;
  }
  function renderFit(f) {
    const min = -5, max = 13, pctOf = (v) => Math.round(((Math.max(min, Math.min(max, v)) - min) / (max - min)) * 100);
    const meter = `<div class="ddd-meter"><div class="ddd-zones"><span>keep it simple</span><span>DDD-lite</span><span>full DDD</span></div><div class="ddd-bar"><i style="left:${pctOf(f.score)}%"></i></div></div>`;
    const t = tbl("answers", ["question", "answer", "weight"], f.answers.map((a, i) => ({ c: [a.q, a.a, (a.w >= 0 ? "+" : "") + a.w], cls: i === f.cur ? "active" : a.w < 0 ? "bad" : "" })), { empty: "" });
    const r = f.rec ? `<div class="ax-verdict ${f.rec.cls}"><b>${esc(f.rec.title)}</b><br><b>Use:</b> ${f.rec.use.map(esc).join(" · ")}<br><b>Skip:</b> ${f.rec.skip.map(esc).join(" · ")}</div>` : "";
    return `<div class="ax-stack">${meter}${t}${r}</div>`;
  }
  Viz.register("domain-driven-design-fit", (host) => Viz.player(host, {
    title: "Is DDD worth it for this part of the system?", tag: "ANSWER 5 QUESTIONS",
    legend: [["active", "current question"], ["bad", "argues against DDD"]],
    code: [...FIT_Q.map((q) => q.q), "=> recommendation"],
    inputs: FIT_Q.map((q, i) => ({ key: q.key, label: ["rules", "core?", "experts", "lifetime", "teams"][i], type: "select", options: q.opts, value: q.opts[[1, 2, 1, 2, 1][i]] })),
    random: () => Object.fromEntries(FIT_Q.map((q) => [q.key, pick(q.opts)])),
    build: buildFit,
    speed: 1400,
    render: renderFit,
  }));

})();
