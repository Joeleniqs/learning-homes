/* Visualizers for "Services, Messaging & Events". Every registered name is prefixed "distributed-architecture-". */
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

  /* ================= distributed-architecture: network fallacies, in numbers ================= */
  const FA_MODES = ["synchronous chain (each waits for the next)", "parallel fan-out (wait for all)", "async: a broker between hops"];
  const FALLACIES = [
    ["The network is reliable", "every hop can fail on its own, and they multiply"],
    ["Latency is zero", "each hop adds milliseconds and a slow tail"],
    ["Bandwidth is infinite", "chatty calls and big payloads queue up under load"],
    ["The network is secure", "every hop needs TLS, authentication and authorization"],
    ["Topology doesn't change", "instances move and scale; you need service discovery"],
    ["There is one administrator", "teams, clouds and proxies all change config independently"],
    ["Transport cost is zero", "serialisation, TLS and egress cost CPU, time and money"],
    ["The network is homogeneous", "versions, protocols and runtimes differ at every hop"],
  ];
  function faSample(N, mode, median, seed) {
    // lognormal per-hop latency: median m, p99 ≈ 5 × m
    const rnd = mulberry(seed), sigma = Math.log(5) / 2.326, S = 2000, user = [], e2e = [];
    const one = () => {
      const u1 = Math.max(rnd(), 1e-9), u2 = rnd();
      return median * Math.exp(sigma * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2));
    };
    for (let s = 0; s < S; s++) {
      const hops = Array.from({ length: N }, one);
      const sum = hops.reduce((x, y) => x + y, 0), max = Math.max(...hops);
      if (mode === 0) { user.push(sum); e2e.push(sum); }
      else if (mode === 1) { user.push(max); e2e.push(max); }
      else { user.push(hops[0]); e2e.push(sum + 5 * (N - 1)); }   // async: caller waits for hop 1; the rest happens later
    }
    const q = (a, p) => { const b = [...a].sort((x, y) => x - y); return b[Math.min(b.length - 1, Math.floor(p * b.length))]; };
    return { p50: q(user, 0.5), p99: q(user, 0.99), e2e50: q(e2e, 0.5) };
  }
  function faCalc(k, mode, a, median) {
    const A = mode === 2 ? a * 0.9999 : Math.pow(a, k);          // async: front service × broker (99.99%)
    const slow = mode === 2 ? 0.01 : 1 - Math.pow(0.99, k);       // share of requests that hit ≥1 hop's p99
    return { A, down: (1 - A) * 43200, slow, ...faSample(k, mode, median, 1000 + k) };
  }
  const fmtA = (A) => `${(A * 100).toFixed(A > 0.9999 ? 4 : A > 0.99 ? 3 : 2)}%`;
  const fmtMs = (ms) => (ms >= 1000 ? `${(ms / 1000).toFixed(2)} s` : `${Math.round(ms)} ms`);
  const fmtMin = (m) => (m >= 120 ? `${(m / 60).toFixed(1)} h` : `${m.toFixed(m < 10 ? 1 : 0)} min`);
  function buildFallacies({ hops, avail, median, mode }) {
    const N = int(hops, "services", 1, 12), a = num(avail, "availability per service %", 90, 99.999) / 100, m = num(median, "median latency per hop (ms)", 1, 2000);
    const M = FA_MODES.indexOf(mode);
    if (M < 0) throw new Error("Pick a call style.");
    const frames = [];
    for (let k = 1; k <= N; k++) {
      const c = faCalc(k, M, a, m), [fname, fwhy] = FALLACIES[(k - 1) % FALLACIES.length];
      const how = M === 0 ? `A request now crosses <b>${k}</b> service${k > 1 ? "s" : ""} in a row, so all of them must be up: availability = ${(a * 100).toFixed(3)}%<sup>${k}</sup> = <b>${fmtA(c.A)}</b>, and the latencies add up.`
        : M === 1 ? `The gateway calls <b>${k}</b> service${k > 1 ? "s" : ""} in parallel and waits for all of them: availability is still ${(a * 100).toFixed(3)}%<sup>${k}</sup> = <b>${fmtA(c.A)}</b>, and latency is set by the slowest one.`
          : `The caller only waits for the first service and the broker. The other ${k - 1} hop${k === 2 ? "" : "s"} happen later, so user-facing availability stays at <b>${fmtA(c.A)}</b>. The work still takes about ${fmtMs(c.e2e50)} end to end.`;
      frames.push({ k, M, a, m, c, line: M === 2 ? 4 : M === 0 ? [0, 1] : [0, 2],
        note: `Fallacy ${((k - 1) % 8) + 1}: <b>“${fname}”</b>. In reality ${fwhy}. ${how} Downtime: about <b>${fmtMin(c.down)} a month</b>. ${M === 2 ? "" : `<b>${Math.round(c.slow * 100)}%</b> of requests hit at least one hop's slowest 1%.`}`,
        vars: { services: k, availability: fmtA(c.A), "downtime/month": fmtMin(c.down), "user p50": fmtMs(c.p50), "user p99": fmtMs(c.p99) } });
    }
    const all = FA_MODES.map((_, j) => faCalc(N, j, a, m));
    const last = frames[frames.length - 1];
    frames.push({ ...last, final: true, all, line: [3, 5],
      note: `Same ${N} services, three call styles. Each synchronous hop <b>multiplies</b> the failure probability and widens the latency tail. Asynchronous messaging cuts the dependency for the caller, at the price of eventual consistency and a broker to run. That is the real cost behind “just split it into services”.` });
    return frames;
  }
  function renderFallacies(f) {
    const nodes = [{ k: "c", x: 60, y: 120, title: "client", w: 80 }], edges = [];
    const svcCls = (i) => (i === f.k - 1 && !f.final ? "active" : "done");
    const sub = `${(f.a * 100).toFixed(f.a > 0.999 ? 3 : 2)}% · ${Math.round(f.m)}ms`;
    if (f.M === 0) {
      for (let i = 0; i < f.k; i++) {
        const row = Math.floor(i / 6), colI = row % 2 === 0 ? i % 6 : 5 - (i % 6);
        nodes.push({ k: `s${i}`, x: 190 + colI * 125, y: 70 + row * 100, title: `service ${i + 1}`, sub, w: 108, cls: svcCls(i) });
        edges.push({ u: i ? `s${i - 1}` : "c", v: `s${i}`, cls: i === f.k - 1 && !f.final ? "active" : "muted" });
      }
    } else if (f.M === 1) {
      nodes.push({ k: "g", x: 200, y: 120, title: "gateway", sub: "waits for all", w: 110, cls: "accent" });
      edges.push({ u: "c", v: "g", cls: "muted" });
      for (let i = 0; i < f.k; i++) {
        nodes.push({ k: `s${i}`, x: 380 + Math.floor(i / 4) * 140, y: 45 + (i % 4) * 52, title: `service ${i + 1}`, sub, w: 112, cls: svcCls(i) });
        edges.push({ u: "g", v: `s${i}`, cls: i === f.k - 1 && !f.final ? "active" : "muted" });
      }
    } else {
      nodes.push({ k: "s0", x: 200, y: 120, title: "service 1", sub: "accepts, returns", w: 120, cls: "done" });
      edges.push({ u: "c", v: "s0", cls: "done" });
      if (f.k > 1) {
        nodes.push({ k: "b", x: 350, y: 120, title: "broker", w: 90, shape: "q", cls: "visit" });
        edges.push({ u: "s0", v: "b", cls: "visit" });
        for (let i = 1; i < f.k; i++) {
          nodes.push({ k: `s${i}`, x: 500 + Math.floor((i - 1) / 4) * 140, y: 45 + ((i - 1) % 4) * 52, title: `service ${i + 1}`, sub: "later", w: 112, cls: i === f.k - 1 && !f.final ? "active" : "" });
          edges.push({ u: "b", v: `s${i}`, cls: "visit", dash: true });
        }
      }
    }
    const svg = diagram({ nodes, edges, label: "call topology" });
    const c = f.c;
    const st = stats([["user-facing availability", fmtA(c.A), c.A < 0.99 ? "bad" : c.A < 0.999 ? "active" : "done"], ["downtime / month", fmtMin(c.down), c.down > 300 ? "bad" : ""],
      ["user p50", fmtMs(c.p50), ""], ["user p99", fmtMs(c.p99), c.p99 > 5 * f.m * 2 ? "bad" : ""], ...(f.M === 2 ? [["done end-to-end (p50)", fmtMs(c.e2e50), "visit"]] : [["hit a slow hop", `${Math.round(c.slow * 100)}%`, c.slow > 0.05 ? "active" : ""]])]);
    let below = "";
    if (f.final) {
      below = tbl(`${f.k} services, ${(f.a * 100).toFixed(3)}% each, median ${Math.round(f.m)} ms per hop`, ["call style", "availability", "downtime/month", "user p50", "user p99"],
        FA_MODES.map((name, j) => ({ c: [name.split(" (")[0], fmtA(f.all[j].A), fmtMin(f.all[j].down), fmtMs(f.all[j].p50), fmtMs(f.all[j].p99)], cls: j === f.M ? "active" : "" })));
    }
    return `<div class="ax-stack">${svg}${st}${below}</div>`;
  }
  Viz.register("distributed-architecture-fallacies", (host) => Viz.player(host, {
    title: "The network fallacies, in numbers", tag: "ADD HOPS · WATCH THE MATH",
    legend: [["active", "hop just added"], ["done", "must be up for this request"], ["visit", "decoupled by a broker"], ["bad", "below 99% / long tail"]],
    code: [
      "A_total = a ^ N                    // N services, all must be up",
      "latency ≈ Σ hops                   // chain: the delays add up",
      "latency ≈ max(hops)                // fan-out: the slowest one decides",
      "P(slow) = 1 − 0.99 ^ N             // chance to hit some hop's p99",
      "A_user = a_front × a_broker        // async: caller depends on 2 things",
      "// fewer synchronous hops = fewer ways to fail",
    ],
    inputs: [
      { key: "hops", label: "services in the path", value: "6", width: 90 },
      { key: "avail", label: "availability each (%)", value: "99.9", width: 110 },
      { key: "median", label: "median ms per hop", value: "40", width: 110 },
      { key: "mode", label: "call style", type: "select", options: FA_MODES, value: FA_MODES[0] },
    ],
    random: () => ({ hops: String(2 + Math.floor(Math.random() * 9)), avail: pick(["99", "99.5", "99.9", "99.95", "99.99"]), median: pick(["10", "25", "40", "80"]), mode: pick(FA_MODES) }),
    build: buildFallacies,
    render: renderFallacies,
  }));

  /* ================= distributed-architecture: sync vs async communication ================= */
  const SA_STYLES = ["synchronous HTTP calls", "async messages through a broker"];
  const SA_FAILS = ["nothing fails", "Email service is down", "Inventory is slow (3 s)", "Payment service is down"];
  function buildSyncAsync({ style, fail }) {
    const S = SA_STYLES.indexOf(style), F = SA_FAILS.indexOf(fail);
    if (S < 0 || F < 0) throw new Error("Pick a style and a failure.");
    const steps = [];
    const add = (m, note, line, extra = {}) => steps.push({ m, note, line, ...extra });
    let outcome;
    if (S === 0) {
      add({ f: "client", t: "orders", label: "POST /orders" }, "The client calls Orders and <b>waits</b>. Orders will call three other services before it can answer.", 1);
      if (F === 3) {
        add({ f: "orders", t: "pay", label: "charge()", cls: "bad", lost: true }, "Payment is down. The TCP connect or the request hangs until the timeout.", 2);
        add({ f: "orders", t: "orders", label: "timeout after 2 s", cls: "bad" }, "Orders waited 2 s for nothing. Its threads, connections and the client were all blocked meanwhile.", 2);
        add({ f: "orders", t: "client", label: "503 after 2.0 s", cls: "bad" }, "The user can't place an order at all while Payment is down: <b>temporal coupling</b>. Every synchronous dependency's downtime becomes your downtime.", 2);
        outcome = { ms: 2000, user: "503 error", side: "none (clean failure)", up: 4, cls: "bad", verdict: "Clean, but unavailable: no order can be placed while any one of the three services is down." };
      } else {
        add({ f: "orders", t: "pay", label: "charge()" }, "First call: charge the card.", 1);
        add({ f: "pay", t: "orders", label: "200 charged (120 ms)", cls: "done" }, "The card is charged. That is a real-world side effect that can't simply be rolled back.", 1);
        add({ f: "orders", t: "inv", label: "reserve()" }, "Second call: reserve the stock.", 1);
        if (F === 2) {
          add({ f: "orders", t: "orders", label: "timeout after 2 s", cls: "bad" }, "Inventory is slow today. Orders gives up after its 2 s timeout…", 2);
          add({ f: "orders", t: "client", label: "504 after 2.1 s", cls: "bad" }, "…and tells the user it failed. But the card is already charged.", 2);
          add({ f: "inv", t: "inv", label: "reserved anyway (3.1 s)", cls: "active" }, "Inventory finishes the work nobody is waiting for: an <b>orphan reservation</b>. The user, told it failed, presses “Buy” again: a second charge.", 2);
          outcome = { ms: 2100, user: "504 error", side: "charged + reserved, user told “failed”", up: 4, cls: "bad", verdict: "Inconsistent: the card is charged and the stock reserved, but the user saw an error and will probably retry. Now you need refunds and idempotency keys." };
        } else {
          add({ f: "inv", t: "orders", label: "200 reserved (80 ms)", cls: "done" }, "Stock reserved.", 1);
          add({ f: "orders", t: "email", label: "send()", cls: F === 1 ? "bad" : "", lost: F === 1 }, F === 1 ? "Email is down. The confirmation email is “just a notification”, but it is on the critical path…" : "Third call: send the confirmation email.", F === 1 ? 2 : 1);
          if (F === 1) {
            add({ f: "orders", t: "orders", label: "timeout after 2 s", cls: "bad" }, "…so the whole request waits 2 s for it.", 2);
            add({ f: "orders", t: "client", label: "500 after 2.2 s", cls: "bad" }, "The order fails because of an email, after the card was charged and stock reserved. Swallowing the error instead means the email is silently lost.", 2);
            outcome = { ms: 2200, user: "500 error", side: "charged + reserved, user told “failed”", up: 4, cls: "bad", verdict: "A non-essential service broke an essential flow. Anything that doesn't have to happen before the response shouldn't be a synchronous call." };
          } else {
            add({ f: "email", t: "orders", label: "200 sent (200 ms)", cls: "done" }, "Email sent.", 1);
            add({ f: "orders", t: "client", label: "201 Created (≈ 0.4 s)", cls: "done" }, "Success, in the sum of all latencies. Simple to write, read and debug, and the answer is <b>final</b>: the user knows immediately.", 1);
            outcome = { ms: 420, user: "201 Created (final)", side: "consistent", up: 4, cls: "done", verdict: "Works well when everything is up. Simple, immediately consistent, easy to debug, but four services must all be healthy for every order." };
          }
        }
      }
    } else {
      add({ f: "client", t: "orders", label: "POST /orders" }, "The client calls Orders, which now only talks to its own database and the broker.", 4);
      add({ f: "orders", t: "orders", label: "save Pending + outbox (1 tx)", cls: "done" }, "Orders saves the order as <b>Pending</b> and the <code>OrderPlaced</code> event in an outbox table, in one local transaction.", 4);
      add({ f: "orders", t: "client", label: "202 Accepted (≈ 40 ms)", cls: "done" }, "The user gets an answer straight away: “we've got your order”. The answer is <b>not final</b> yet. The UI must show a pending state.", 4);
      add({ f: "orders", t: "bus", label: "OrderPlaced", cls: "path" }, "The outbox relay publishes <code>OrderPlaced</code> to the broker. From here on, nobody waits for anybody.", 5);
      if (F === 3) {
        add({ f: "bus", t: "pay", label: "OrderPlaced (Payment down)", cls: "bad", lost: true }, "Payment is down. The broker keeps the message in Payment's queue; nothing is lost and Orders doesn't even notice.", 6);
        add({ f: "bus", t: "bus", label: "queue depth grows", cls: "active" }, "Messages pile up while Payment is down. That is the broker doing its job as a <b>buffer</b>.", 6);
        add({ f: "bus", t: "pay", label: "redelivered when back", cls: "path" }, "Payment recovers and works through its backlog.", 6);
      } else add({ f: "bus", t: "pay", label: "OrderPlaced", cls: "path" }, "Payment consumes the event and charges the card.", 5);
      add({ f: "pay", t: "bus", label: "PaymentCaptured", cls: "path" }, "Payment publishes its own fact.", 5);
      add({ f: "bus", t: "inv", label: F === 2 ? "OrderPlaced (3 s to process)" : "OrderPlaced", cls: F === 2 ? "active" : "path" }, F === 2 ? "Inventory is slow, but nobody has a timeout on it: it just takes 3 s." : "Inventory reserves stock, in parallel with Payment.", 5);
      add({ f: "inv", t: "bus", label: "StockReserved", cls: "path" }, "Inventory publishes its fact.", 5);
      if (F === 1) {
        add({ f: "bus", t: "email", label: "OrderPlaced (Email down)", cls: "bad", lost: true }, "Email is down. Its message waits in its queue and will be retried. The order is unaffected.", 6);
      } else add({ f: "bus", t: "email", label: "OrderPlaced", cls: "path" }, "Email sends the confirmation.", 5);
      add({ f: "bus", t: "orders", label: "PaymentCaptured + StockReserved", cls: "path" }, "Orders listens for both facts…", 5);
      add({ f: "orders", t: "orders", label: "status = Confirmed", cls: "done" }, "…and marks the order Confirmed. If one of them never arrives, a deadline (a saga timeout) cancels and compensates.", 5);
      add({ f: "client", t: "orders", label: "GET /orders/42 → Confirmed", cls: "done", dash: true }, "The client polls (or gets a push via WebSocket/SSE) and sees the final state.", 5);
      const conf = F === 0 ? "≈ 0.5 s" : F === 2 ? "≈ 3.2 s" : F === 3 ? "when Payment recovers" : "≈ 0.5 s";
      outcome = { ms: 40, user: `202 Accepted; confirmed ${conf}`, side: F === 1 ? "consistent; email sent when Email recovers" : "consistent (eventually)", up: 1, cls: F === 3 ? "warn" : "done",
        verdict: F === 3 ? "Orders keeps accepting while Payment is down. Confirmation is delayed until it recovers. That is better than an outage, but the UX must explain “pending”, and you need a deadline that cancels stale orders." : F === 2 ? "A slow consumer only slows its own part. Nothing times out, nothing is half-done." : F === 1 ? "A failure in a non-essential service is invisible to the user. The email goes out later." : "Fast and decoupled, but there are more moving parts: a broker, an outbox, idempotent consumers, eventual consistency and harder debugging (you need tracing)." };
    }
    const frames = steps.map((s, i) => ({ S, F, msgs: steps.slice(0, i + 1).map((x) => x.m), note: s.note, line: s.line, out: i === steps.length - 1 ? outcome : null,
      vars: { style: S ? "async" : "sync", failure: SA_FAILS[F], step: `${i + 1}/${steps.length}` } }));
    const last = frames[frames.length - 1];
    last.vars = { ...last.vars, "user waits": fmtMs(outcome.ms), "must be up": `${outcome.up} service${outcome.up > 1 ? "s" : ""}` };
    return frames;
  }
  function renderSyncAsync(f) {
    const actors = [{ k: "client", title: "Client" }, { k: "orders", title: "Orders", cls: "accent" }];
    if (f.S === 1) actors.push({ k: "bus", title: "Broker", sub: "topic + queues", cls: "visit" });
    actors.push({ k: "pay", title: "Payment", cls: f.F === 3 ? "bad" : "" }, { k: "inv", title: "Inventory", cls: f.F === 2 ? "active" : "" }, { k: "email", title: "Email", cls: f.F === 1 ? "bad" : "" });
    const svg = seq({ actors, msgs: f.msgs, colW: f.S ? 138 : 160, rowH: 27, rows: f.S ? 14 : 10, label: "order placement sequence" });
    let below = "";
    if (f.out) {
      const o = f.out;
      below = `<div class="ax-row">${stats([["user waits", fmtMs(o.ms), o.ms > 1000 ? "bad" : "done"], ["user sees", o.user, o.cls === "bad" ? "bad" : ""], ["services that must be up", String(o.up), o.up > 1 ? "active" : "done"]])}</div>` +
        `<div class="ax-verdict ${o.cls}"><b>Side effects:</b> ${esc(o.side)}<br>${esc(o.verdict)}</div>`;
    }
    return `<div class="ax-stack">${svg}${below}</div>`;
  }
  Viz.register("distributed-architecture-sync-async", (host) => Viz.player(host, {
    title: "Synchronous calls vs asynchronous messages", tag: "PICK A STYLE · BREAK A SERVICE",
    legend: [["done", "success / committed"], ["path", "message via broker"], ["active", "slow / buffered"], ["bad", "failure"]],
    code: [
      "// synchronous: the caller waits for every callee",
      "POST /orders → charge() → reserve() → sendEmail() → 201",
      "// all callees must be up *now*; latencies and failures add up",
      "// asynchronous: tell, don't ask",
      "save order (Pending) + outbox OrderPlaced; return 202 Accepted",
      "Payment, Inventory, Email consume OrderPlaced at their own pace",
      "// the broker buffers while a consumer is down or slow",
    ],
    inputs: [
      { key: "style", label: "style", type: "select", options: SA_STYLES, value: SA_STYLES[0] },
      { key: "fail", label: "what goes wrong", type: "select", options: SA_FAILS, value: SA_FAILS[1] },
    ],
    random: () => ({ style: pick(SA_STYLES), fail: pick(SA_FAILS) }),
    build: buildSyncAsync,
    speed: 1500,
    render: renderSyncAsync,
  }));

  /* ================= distributed-architecture: broker — queue, partitions, fan-out ================= */
  const BR_MODES = ["queue · competing consumers", "topic · partitions + consumer group", "topic · fan-out to subscriptions"];
  const BR_FAILS = ["nothing fails", "consumer 2 is slow (3× longer)", "consumer 1 crashes before ack"];
  const SUBS = ["Billing", "Shipping", "Email", "Analytics", "Search", "Audit"];
  const brHash = (k, P) => [...k].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % P;
  function buildBroker({ mode, msgs, consumers, partitions, fail }) {
    const M = BR_MODES.indexOf(mode), F = BR_FAILS.indexOf(fail);
    if (M < 0 || F < 0) throw new Error("Pick a mode and a failure.");
    const C = int(consumers, "consumers", 1, M === 2 ? 4 : 6), P = M === 1 ? int(partitions, "partitions", 1, 6) : M === 2 ? C : 1;
    const seqOf = {};
    const list = items(msgs, "messages", 2, 10).map((s, i) => {
      const [key, ev] = s.includes(":") ? s.split(":").map((x) => x.trim()) : [s, "event"];
      if (!key) throw new Error(`messages: “${s}” needs a key, like o1:created.`);
      seqOf[key] = (seqOf[key] || 0) + 1;
      return { id: `m${i + 1}`, key, ev: ev || "event", seq: seqOf[key], label: `${key}:${ev || "event"}` };
    });
    const lanes = Array.from({ length: P }, () => []);
    if (M === 0) lanes[0].push(...list.map((m) => ({ ...m })));
    else if (M === 1) list.forEach((m) => lanes[brHash(m.key, P)].push({ ...m }));
    else lanes.forEach((l) => l.push(...list.map((m) => ({ ...m }))));
    const total = lanes.reduce((s, l) => s + l.length, 0);
    const cons = Array.from({ length: C }, (_, i) => ({ name: M === 2 ? SUBS[i] : `consumer ${i + 1}`, lanes: M === 0 ? [0] : M === 2 ? [i] : lanes.map((_, j) => j).filter((j) => j % C === i),
      busy: null, down: -1, dur: F === 1 && i === 1 ? 3 : 1, crashed: false, n: 0 }));
    const locked = new Set(), done = new Map(), maxSeq = new Map(), log = [];
    const frames = [];
    let dups = 0, ooo = 0, processed = 0;
    const snap = (t, note, line) => frames.push({ M, F, P, C, t, note, line,
      lanes: lanes.map((l) => l.map((m) => m.label)), cons: cons.map((c) => ({ name: c.name, lanes: c.lanes, busy: c.busy && c.busy.m.label, lane: c.busy && c.busy.lane, down: c.down > t, dur: c.dur })),
      log: log.slice(-7), dups, ooo, processed, total,
      vars: { tick: t, processed: `${processed}/${total}`, duplicates: dups, "out of order": ooo } });
    const intro = M === 0 ? `One queue, ${C} competing consumer${C > 1 ? "s" : ""}. Each message goes to <b>one</b> consumer, whichever is free. Great for spreading work; no ordering promise across consumers.`
      : M === 1 ? `Messages are routed to one of ${P} partition${P > 1 ? "s" : ""} by <code>hash(key) % ${P}</code>, so all messages for one key land in the same partition. Each partition is read by exactly one consumer in the group, <b>in order</b>.${C > P ? ` ${C - P} consumer${C - P > 1 ? "s" : ""} will sit idle: you can't have more active consumers than partitions.` : ""}`
        : `A topic with ${C} subscriptions. Every subscription gets its <b>own copy</b> of every message, so ${C} independent services react to the same event.`;
    snap(0, intro, M === 0 ? 0 : M === 1 ? 2 : 5);
    for (let t = 1; t <= 40; t++) {
      const ev = [];
      cons.forEach((c, ci) => {
        if (!c.busy || c.busy.end !== t) return;
        const { m, lane } = c.busy, gk = M === 2 ? `${ci}|` : "", dk = gk + m.id, kk = gk + m.key;
        const dup = done.has(dk), late = !dup && (maxSeq.get(kk) || 0) > m.seq;
        processed += dup ? 0 : 1; if (dup) dups++; if (late) ooo++;
        done.set(dk, true); maxSeq.set(kk, Math.max(maxSeq.get(kk) || 0, m.seq));
        c.busy = null; c.n++;
        if (F === 2 && ci === 0 && !c.crashed) {
          c.crashed = true; c.down = t + 2; lanes[lane].unshift(m); locked.delete(lane);
          log.push({ c: [t, c.name, m.label, "side effect done, then CRASH: no ack"], cls: "bad" });
          ev.push(`<b>${esc(c.name)}</b> processed <code>${esc(m.label)}</code> but crashed before acknowledging it. The broker never got the ack, so the message goes back ${M === 0 ? "on the queue" : "(the offset wasn't committed)"} and <b>will be delivered again</b>.`);
          return;
        }
        locked.delete(lane);
        log.push({ c: [t, c.name, m.label, dup ? "DUPLICATE: processed twice" : late ? `OUT OF ORDER: ${m.key} #${m.seq} after a later one` : "ok, acked"], cls: dup || late ? "bad" : "done" });
        ev.push(dup ? `<b>${esc(c.name)}</b> processed <code>${esc(m.label)}</code> <b>a second time</b>. At-least-once delivery means duplicates are normal: the consumer must be idempotent.`
          : late ? `<b>${esc(c.name)}</b> finished <code>${esc(m.label)}</code> <b>after</b> a later event for ${esc(m.key)}. Competing consumers broke the per-key order${F === 1 ? " because one of them is slow" : ""}.`
            : `<b>${esc(c.name)}</b> finished <code>${esc(m.label)}</code> and acked it.`);
      });
      cons.forEach((c, ci) => {
        if (c.busy || c.down > t) return;
        if (c.down === t) ev.push(`<b>${esc(c.name)}</b> restarts.`);
        const lane = c.lanes.find((j) => lanes[j].length && (M === 0 || !locked.has(j)));
        if (lane === undefined) return;
        const m = lanes[lane].shift();
        if (M !== 0) locked.add(lane);
        c.busy = { m, lane, end: t + c.dur };
        ev.push(`${esc(c.name)} takes <code>${esc(m.label)}</code>${M === 1 ? ` from P${lane}` : ""}${c.dur > 1 ? " (slow)" : ""}.`);
      });
      if (!ev.length) continue;
      snap(t, ev.join(" "), ev.some((x) => /CRASH|crashed|second time/.test(x)) ? [6, 7] : ev.some((x) => /order/.test(x) && /after/.test(x)) ? 1 : M === 1 ? 3 : M === 2 ? 5 : 0);
      if (lanes.every((l) => !l.length) && cons.every((c) => !c.busy)) break;
    }
    const idle = M === 1 ? cons.filter((c) => !c.lanes.length).length : 0;
    const v = ooo ? ["bad", `${ooo} message${ooo > 1 ? "s" : ""} processed out of order. If order per key matters, route by key to partitions (or use sessions / message groups) instead of competing consumers.`]
      : dups ? ["warn", `${dups} duplicate${dups > 1 ? "s" : ""}. Nothing was lost (at-least-once), but your handler ran twice. Make consumers idempotent (an inbox table or naturally idempotent writes).`]
        : ["done", M === 1 ? `Per-key order held: each key lives in one partition and each partition has one reader.${idle ? ` ${idle} consumer${idle > 1 ? "s" : ""} stayed idle: more consumers than partitions doesn't add throughput.` : ""}` : M === 2 ? "Every subscription received every message, independently of the others." : "All messages processed once. Order across consumers was luck, not a guarantee."];
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, line: v[0] === "bad" ? 1 : v[0] === "warn" ? 7 : idle ? 4 : 3, note: `<b>Result:</b> ${v[1]}` });
    return frames;
  }
  function renderBroker(f) {
    const nodes = [{ k: "p", x: 70, y: 40 + Math.max(f.P, f.C) * 28, title: "producer", w: 92 }], edges = [];
    const H = Math.max(f.P, f.C) * 56;
    f.lanes.forEach((l, j) => {
      const y = 40 + (H / f.P) * (j + 0.5);
      nodes.push({ k: `l${j}`, x: 270, y, w: 190, h: 40, shape: "q", title: f.M === 0 ? "queue" : f.M === 1 ? `partition ${j}` : `sub: ${SUBS[j]}`, sub: l.length ? l.slice(0, 3).join(" · ") + (l.length > 3 ? ` +${l.length - 3}` : "") : "empty", cls: l.length ? "visit" : "" });
      edges.push({ u: "p", v: `l${j}`, cls: "muted" });
    });
    f.cons.forEach((c, i) => {
      const y = 40 + (H / f.C) * (i + 0.5);
      nodes.push({ k: `c${i}`, x: 500, y, w: 150, title: c.name, sub: c.down ? "DOWN" : c.busy ? `▶ ${c.busy}` : f.M === 1 && !c.lanes.length ? "idle: no partition" : "idle",
        cls: c.down ? "bad" : c.busy ? (c.dur > 1 ? "active" : "path") : f.M === 1 && !c.lanes.length ? "dim" : "" });
      c.lanes.forEach((j) => edges.push({ u: `l${j}`, v: `c${i}`, cls: c.busy && c.lane === j ? "path" : "muted", dash: !(c.busy && c.lane === j) }));
    });
    const svg = diagram({ nodes, edges, label: "broker topology" });
    const st = stats([["processed", `${f.processed}/${f.total}`, f.processed === f.total ? "done" : ""], ["duplicates", String(f.dups), f.dups ? "active" : ""], ["out of order", String(f.ooo), f.ooo ? "bad" : ""]]);
    const log = tbl("processing log (latest)", ["tick", "consumer", "message", "result"], f.log, { empty: "nothing processed yet" });
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}<div class="ax-row">${st}</div>${log}${v}</div>`;
  }
  Viz.register("distributed-architecture-broker", (host) => Viz.player(host, {
    title: "Queues, partitions and fan-out", tag: "ROUTE · CONSUME · BREAK",
    legend: [["visit", "messages waiting"], ["path", "being processed"], ["active", "slow consumer"], ["bad", "crash / duplicate / out of order"]],
    code: [
      "queue: each message → ONE of the competing consumers",
      "// no ordering across consumers; a slow one reorders work",
      "partition = hash(key) % partitions",
      "each partition → exactly one consumer in the group, in order",
      "// consumers > partitions ⇒ the extras sit idle",
      "topic → every subscription gets its own copy",
      "// delivery is at-least-once: ack after processing",
      "// crash before ack ⇒ redelivery ⇒ duplicate",
    ],
    inputs: [
      { key: "mode", label: "broker shape", type: "select", options: BR_MODES, value: BR_MODES[0] },
      { key: "msgs", label: "messages (key:event; …)", value: "o1:created; o1:paid; o2:created; o1:shipped; o2:paid; o3:created", width: 330 },
      { key: "consumers", label: "consumers", value: "2", width: 70 },
      { key: "partitions", label: "partitions", value: "3", width: 70 },
      { key: "fail", label: "what goes wrong", type: "select", options: BR_FAILS, value: BR_FAILS[1] },
    ],
    random: () => {
      const keys = ["o1", "o2", "o3", "o4"], evs = ["created", "paid", "shipped"], cnt = {};
      const msgs = Array.from({ length: 5 + Math.floor(Math.random() * 4) }, () => { const k = pick(keys); cnt[k] = (cnt[k] || 0) + 1; return `${k}:${evs[Math.min(2, cnt[k] - 1)]}`; }).join("; ");
      return { mode: pick(BR_MODES), msgs, consumers: String(1 + Math.floor(Math.random() * 4)), partitions: String(1 + Math.floor(Math.random() * 4)), fail: pick(BR_FAILS) };
    },
    build: buildBroker,
    speed: 1300,
    render: renderBroker,
  }));

  /* ================= distributed-architecture: transactional outbox ================= */
  const OB_MODES = ["dual write: save to DB, then publish", "dual write: publish, then save to DB", "transactional outbox + relay"];
  const OB_FAILS = ["nothing fails", "process crashes between the two writes", "broker is down for a while", "relay crashes after publish, before marking sent"];
  function buildOutbox({ mode, fail }) {
    const M = OB_MODES.indexOf(mode), F = OB_FAILS.indexOf(fail);
    if (M < 0 || F < 0) throw new Error("Pick a mode and a failure.");
    const st = { order: "–", outbox: [], broker: [], shipped: 0, user: "waiting…" };
    const frames = [], msgs = [];
    const push = (m, note, line, ch = {}) => { if (m) msgs.push(m); Object.assign(st, ch); frames.push({ M, F, msgs: [...msgs], st: { ...st, outbox: st.outbox.map((r) => ({ ...r })), broker: [...st.broker] }, note, line, vars: { order: st.order, outbox: st.outbox.map((r) => r.s).join(",") || "–", "on broker": st.broker.length, "Shipping runs": st.shipped } }); };
    const ship = (note) => { push({ f: "bus", t: "ship", label: "OrderPlaced", cls: "path" }, note || "Shipping consumes <code>OrderPlaced</code> and creates a shipment.", M === 2 ? 9 : M === 1 ? 3 : 1, { shipped: st.shipped + 1 }); };
    let v;
    if (M < 2 && F === 3) push(null, "There is no relay in a dual write, so this failure doesn't apply: here is the happy path instead.", M ? 3 : 0);
    if (M === 0) {
      push({ f: "h", t: "db", label: "INSERT order; COMMIT", cls: "done" }, "Write 1: the order is committed to the Orders database.", 0, { order: "saved" });
      if (F === 1) {
        push({ f: "h", t: "h", label: "💥 process killed", cls: "bad" }, "The pod is killed (deploy, OOM, node drain) right after the commit, before the publish line runs.", 1);
        push(null, "Nobody will ever publish <code>OrderPlaced</code>. The order exists, but Shipping will never hear about it. <b>Silent, permanent inconsistency.</b>", 1, { user: "connection reset" });
        v = ["bad", "Lost event: the order is in the database but no message was ever sent. No retry can fix this, because nothing remembers that a publish was owed."];
      } else if (F === 2) {
        push({ f: "h", t: "bus", label: "publish OrderPlaced", cls: "bad", lost: true }, "Write 2: the broker is down, so the publish throws.", 1);
        push({ f: "h", t: "client", label: "500 (but order saved!)", cls: "bad" }, "The DB transaction has already committed. You can't roll it back. Retrying in-process only helps until the pod restarts.", 1, { user: "500 error" });
        v = ["bad", "Lost event again: committed data, no message. Return 500 and the user retries, creating a second order; swallow the error and Shipping never knows."];
      } else {
        push({ f: "h", t: "bus", label: "publish OrderPlaced", cls: "path" }, "Write 2: publish to the broker. Works…", 1, { broker: ["OrderPlaced"] });
        push({ f: "h", t: "client", label: "201 Created", cls: "done" }, "…this time. The two writes are not atomic; it only looks safe because nothing failed.", 1, { user: "201" });
        ship();
        v = ["warn", "Happy path only. Two separate resources (DB and broker) can't be committed atomically without 2PC, so some failure will eventually leave them disagreeing."];
      }
    } else if (M === 1) {
      if (F === 2) {
        push({ f: "h", t: "bus", label: "publish OrderPlaced", cls: "bad", lost: true }, "The broker is down, so the publish throws before anything is saved.", 3);
        push({ f: "h", t: "client", label: "503", cls: "bad" }, "Consistent, but the service can't take orders while the broker is down: you've coupled your availability to it.", 3, { user: "503 error" });
        v = ["warn", "Consistent but unavailable: every broker outage is now an Orders outage."];
      } else {
        push({ f: "h", t: "bus", label: "publish OrderPlaced", cls: "path" }, "Write 1: publish first, “so we never lose the event”…", 3, { broker: ["OrderPlaced"] });
        ship("Shipping reacts immediately: it creates a shipment for order 42.");
        if (F === 1) {
          push({ f: "h", t: "h", label: "💥 process killed", cls: "bad" }, "The pod dies before writing the order.", [3, 4]);
          push(null, "Shipping is preparing a parcel for an order that <b>does not exist</b>. A phantom event is worse than a lost one: other services have already acted on it.", 3, { order: "missing", user: "connection reset" });
          v = ["bad", "Phantom event: the world was told about an order that was never stored. You can't “unpublish” a message."];
        } else {
          push({ f: "h", t: "db", label: "INSERT order; COMMIT", cls: "done" }, "Write 2: save the order. If this failed on a constraint or deadlock, the event would already be out.", 4, { order: "saved" });
          push({ f: "h", t: "client", label: "201 Created", cls: "done" }, "Fine this time, but the event raced ahead of the data: Shipping may query Orders and get a 404.", 4, { user: "201" });
          v = ["warn", "Happy path only, and still racy: consumers can see the event before the data is committed."];
        }
      }
    } else {
      push({ f: "h", t: "db", label: "BEGIN; INSERT order; INSERT outbox; COMMIT", cls: "done" }, "One <b>local</b> transaction writes the order <b>and</b> the event into an <code>outbox</code> table in the same database. Both are stored, or neither is.", 6,
        { order: "saved", outbox: [{ id: "evt-7f3", s: "pending" }] });
      if (F === 1) push({ f: "h", t: "h", label: "💥 process killed", cls: "bad" }, "The pod dies right after the commit. That doesn't matter: the event is safely in the outbox table.", 6, { user: "connection reset" });
      else push({ f: "h", t: "client", label: "201 Created", cls: "done" }, "The user gets an answer. The handler never talked to the broker.", 6, { user: "201" });
      push({ f: "relay", t: "db", label: "SELECT … WHERE status='pending'", cls: "visit" }, "The relay (a background worker, or CDC such as Debezium tailing the DB log) reads pending outbox rows.", 7);
      if (F === 2) {
        push({ f: "relay", t: "bus", label: "publish (broker down)", cls: "bad", lost: true }, "The broker is down. The relay fails, leaves the row <b>pending</b> and backs off.", 7);
        push({ f: "relay", t: "relay", label: "retry with backoff…", cls: "active" }, "Orders keeps accepting new orders the whole time; they all queue up in the outbox table.", 7);
      }
      push({ f: "relay", t: "bus", label: "publish evt-7f3", cls: "path" }, "The relay publishes the event, with its outbox id as the message id.", 7, { broker: ["evt-7f3"] });
      if (F === 3) {
        push({ f: "relay", t: "relay", label: "💥 relay killed", cls: "bad" }, "The relay crashes after the publish but before marking the row sent.", 8);
        push({ f: "relay", t: "db", label: "restart: row still pending", cls: "visit" }, "On restart, the row is still <b>pending</b>…", 8);
        push({ f: "relay", t: "bus", label: "publish evt-7f3 (again)", cls: "active" }, "…so it is published <b>again</b>. The outbox guarantees <b>at-least-once</b>, never exactly-once.", 8, { broker: ["evt-7f3", "evt-7f3"] });
      }
      push({ f: "relay", t: "db", label: "UPDATE outbox SET status='sent'", cls: "done" }, "The relay marks the row sent (or deletes it).", 7, { outbox: [{ id: "evt-7f3", s: "sent" }] });
      ship();
      if (F === 3) {
        push({ f: "bus", t: "ship", label: "evt-7f3 (duplicate)", cls: "active" }, "Shipping receives the same message id again. Its <b>inbox</b> table already has <code>evt-7f3</code>, so it acks and skips.", 9);
        v = ["done", "No lost or phantom events. The relay crash caused a duplicate, which the idempotent consumer dropped. Outbox (producer side) + inbox (consumer side) = effectively-once."];
      } else v = ["done", F === 2 ? "The broker outage only delayed the event. Orders stayed available and nothing was lost." : F === 1 ? "The crash didn't matter: the event was committed with the order, and the relay delivered it later." : "Reliable: the order and its event are committed atomically; the relay delivers at-least-once."];
    }
    push(null, `<b>Result:</b> ${v[1]}`, M === 2 ? 9 : M === 1 ? 3 : 1, {});
    frames[frames.length - 1].verdict = v;
    return frames;
  }
  function renderOutbox(f) {
    const actors = [{ k: "client", title: "Client" }, { k: "h", title: "Orders handler", cls: "accent" }, { k: "db", title: "Orders DB", sub: f.M === 2 ? "orders + outbox" : "orders" }];
    if (f.M === 2) actors.push({ k: "relay", title: "Outbox relay", sub: "poller / CDC", cls: "visit" });
    actors.push({ k: "bus", title: "Broker" }, { k: "ship", title: "Shipping" });
    const svg = seq({ actors, msgs: f.msgs, colW: f.M === 2 ? 132 : 150, rowH: 27, rows: f.M === 2 ? 12 : 6, label: "outbox sequence" });
    const st = f.st;
    const a = kv("Orders DB", [["orders row #42", st.order, st.order === "saved" ? "done" : st.order === "missing" ? "bad" : ""],
      ...(f.M === 2 ? (st.outbox.length ? st.outbox.map((r) => [`outbox ${r.id}`, r.s, r.s === "sent" ? "done" : "active"]) : [["outbox", "empty", ""]]) : [])]);
    const b = kv("broker", st.broker.length ? st.broker.map((m, i) => [`message ${i + 1}`, m, i ? "active" : "visit"]) : [], { empty: "no messages" });
    const c = kv("outcome", [["user saw", st.user, /error|reset/.test(st.user) ? "bad" : st.user === "201" ? "done" : ""],
      ["Shipping ran", String(st.shipped), st.shipped && st.order !== "saved" ? "bad" : st.shipped ? "done" : ""]]);
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}<div class="ax-row">${a}${b}${c}</div>${v}</div>`;
  }
  Viz.register("distributed-architecture-outbox", (host) => Viz.player(host, {
    title: "Dual writes vs the transactional outbox", tag: "PICK A STRATEGY · CRASH IT",
    legend: [["done", "committed"], ["visit", "outbox relay"], ["path", "message delivered"], ["active", "retry / duplicate"], ["bad", "crash / lost / phantom"]],
    code: [
      "db.Save(order); db.Commit();              // write 1",
      "broker.Publish(new OrderPlaced(order.Id)); // write 2: crash here = lost event",
      "",
      "broker.Publish(new OrderPlaced(order.Id)); // crash after = phantom",
      "db.Save(order); db.Commit();",
      "",
      "BEGIN; INSERT order; INSERT outbox(evt); COMMIT;   // one local tx",
      "relay: SELECT pending → Publish(evt, id) → UPDATE sent",
      "// crash between Publish and UPDATE ⇒ duplicate (at-least-once)",
      "consumer: if inbox has evt.id → skip, else handle + record (one tx)",
    ],
    inputs: [
      { key: "mode", label: "strategy", type: "select", options: OB_MODES, value: OB_MODES[0] },
      { key: "fail", label: "what goes wrong", type: "select", options: OB_FAILS, value: OB_FAILS[1] },
    ],
    random: () => ({ mode: pick(OB_MODES), fail: pick(OB_FAILS) }),
    build: buildOutbox,
    speed: 1500,
    render: renderOutbox,
  }));

  /* ================= distributed-architecture: inbox / idempotent consumer ================= */
  const IN_STRATS = ["no dedup (naive handler)", "inbox table in the same transaction", "check inbox, act, record (separate commits)", "naturally idempotent write (upsert by key)"];
  const IN_OPS = ["add 10 loyalty points per order", "set order status = Paid"];
  const IN_CRASH = ["no crash", "crash after the handler's write, before the inbox write"];
  function buildInbox({ strat, deliveries, op, crash }) {
    const S = IN_STRATS.indexOf(strat), O = IN_OPS.indexOf(op), K = IN_CRASH.indexOf(crash);
    if (S < 0 || O < 0 || K < 0) throw new Error("Pick a strategy, an operation and a crash option.");
    const ds = items(deliveries, "deliveries", 1, 10).map((x) => { if (!/^m\d{1,2}$/.test(x)) throw new Error(`deliveries: “${x}” should be a message id like m1.`); return x; });
    const queue = [...ds], inbox = new Set(), applied = new Map(), status = new Map(), log = [], frames = [];
    let points = 0, crashed = K === 0, n = 0;
    const unique = new Set(ds);
    const snap = (note, line, extra = {}) => frames.push({ S, O, note, line, points, expected: O === 0 ? unique.size * 10 : null, inbox: [...inbox], status: [...status], log: log.slice(-8),
      queue: [...queue], applied: [...applied], vars: { delivered: n, inbox: inbox.size, [O ? "orders Paid" : "points"]: O ? status.size : points }, ...extra });
    snap(`The broker delivers <b>at least once</b>: ${ds.length} deliveries for ${unique.size} distinct message${unique.size > 1 ? "s" : ""}. ${O === 0 ? `The right answer is ${unique.size * 10} points.` : "Each order should end up Paid."}`, 1);
    while (queue.length && n < 14) {
      const id = queue.shift(); n++;
      const order = `order ${id.slice(1)}`;
      const doWrite = () => {
        if (O === 0) {
          if (S === 3) { if (!applied.has(order)) { applied.set(order, 10); points += 10; return "INSERT points(order) ON CONFLICT DO NOTHING → 1 row"; } return "INSERT … ON CONFLICT DO NOTHING → 0 rows (already there)"; }
          points += 10; applied.set(order, (applied.get(order) || 0) + 10); return "points += 10";
        }
        const was = status.get(order); status.set(order, "Paid"); return was ? "status = Paid (already Paid: no change)" : "status = Paid";
      };
      const willCrash = !crashed;
      if (S === 1 && inbox.has(id) || S === 2 && inbox.has(id)) {
        log.push({ c: [n, id, "found in inbox", "ack + skip"], cls: "done" });
        snap(`Delivery ${n}: <code>${id}</code> is already in the inbox, so the handler <b>skips</b> it and acks. The duplicate costs one indexed lookup.`, S === 1 ? 3 : 6);
        continue;
      }
      if (S === 1) {
        if (willCrash) {
          crashed = true; queue.unshift(id);
          log.push({ c: [n, id, "BEGIN; write; 💥 crash", "rolled back, redelivered"], cls: "active" });
          snap(`Delivery ${n}: the handler wrote its change and was about to insert <code>${id}</code> into the inbox when it crashed. Both writes were in <b>one transaction</b> that never committed, so the database rolls both back and the broker redelivers.`, 4);
          continue;
        }
        const w = doWrite(); inbox.add(id);
        log.push({ c: [n, id, `BEGIN; ${w}; INSERT inbox; COMMIT`, "applied once"], cls: "done" });
        snap(`Delivery ${n}: <code>${id}</code> is new. The handler's write and the inbox insert commit <b>together</b>. A redelivery will hit the inbox's primary key.`, 4);
        continue;
      }
      if (S === 2) {
        const w = doWrite();
        if (willCrash) {
          crashed = true; queue.unshift(id);
          log.push({ c: [n, id, `${w}; COMMIT; 💥 crash`, "inbox never written"], cls: "bad" });
          snap(`Delivery ${n}: the handler's write <b>committed on its own</b>, then the process crashed before recording <code>${id}</code> in the inbox. The broker will redeliver, and the inbox doesn't know.`, 7);
          continue;
        }
        inbox.add(id);
        const twice = O === 0 && applied.get(order) > 10;
        log.push({ c: [n, id, `${w}; COMMIT; INSERT inbox; COMMIT`, twice ? "APPLIED TWICE" : "applied"], cls: twice ? "bad" : "done" });
        snap(twice ? `Delivery ${n}: <code>${id}</code> isn't in the inbox (the crash lost that write), so it is <b>applied a second time</b>. Check-then-act across two commits has a gap.` : `Delivery ${n}: <code>${id}</code> is new: write, commit, then record it in the inbox in a second commit.`, 7);
        continue;
      }
      const w = doWrite();
      if (willCrash) { crashed = true; queue.unshift(id); }
      const twice = O === 0 && S === 0 && applied.get(order) > 10;
      log.push({ c: [n, id, w + (willCrash ? "; 💥 crash before ack" : ""), twice ? "APPLIED TWICE" : willCrash ? "will be redelivered" : S === 3 && /0 rows|no change/.test(w) ? "no-op (idempotent)" : "applied"], cls: twice ? "bad" : willCrash ? "active" : "done" });
      snap(S === 0 ? (twice ? `Delivery ${n}: <code>${id}</code> again, and the naive handler <b>adds the points again</b>. The customer now has ${applied.get(order)} points for one order.`
        : O === 1 && status.size && /no change/.test(w) ? `Delivery ${n}: <code>${id}</code> again. Setting Paid twice gives the same result: this operation happens to be <b>naturally idempotent</b>, so the naive handler gets lucky.` : `Delivery ${n}: <code>${id}</code>: ${w}.${willCrash ? " Then the process crashes before acking, so the broker will redeliver it." : ""}`)
        : `Delivery ${n}: <code>${id}</code>: <code>${esc(w)}</code>. The write itself is keyed by the order id, so repeating it changes nothing.${willCrash ? " A crash before the ack leads to a redelivery, which is harmless." : ""}`, S === 0 ? 0 : 9);
    }
    const wrong = O === 0 ? points !== unique.size * 10 : false;
    const v = wrong ? ["bad", `Wrong: ${points} points instead of ${unique.size * 10}. ${S === 2 ? "The inbox and the side effect must commit in the same transaction." : "Retries plus at-least-once delivery turned into double-counting."}`]
      : S === 0 && O === 1 ? ["warn", "Correct, but only by luck: “set status” is idempotent by nature. Change it to “add points” and duplicates corrupt data."]
        : ["done", S === 1 ? "Correct: every message applied exactly once, because the inbox row and the change commit atomically." : S === 3 ? "Correct without an inbox: the write is keyed by business id, so it can safely repeat." : "Correct this time, but there is a window between the two commits."];
    if (S === 2 && !wrong && K === 0) v[1] = "Correct this time: there was no crash in the gap between the two commits. Try it with the crash.";
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Result:</b> ${v[1]}`, line: wrong ? 7 : S === 1 ? 4 : 9 });
    return frames;
  }
  function renderInbox(f) {
    const q = `<div class="ax-panel"><div class="ax-panel-h"><span>still to deliver</span><span>${f.queue.length}</span></div>${f.queue.length ? f.queue.map((x) => chip(x, "visit")).join("") : chip("none", "dim")}</div>`;
    const ib = `<div class="ax-panel"><div class="ax-panel-h"><span>inbox (processed message ids)</span><span>${f.S === 1 || f.S === 2 ? f.inbox.length : "n/a"}</span></div>${f.S === 1 || f.S === 2 ? (f.inbox.length ? f.inbox.map((x) => chip(x, "done")).join("") : chip("empty", "dim")) : chip(f.S === 0 ? "no inbox" : "not needed", "dim")}</div>`;
    const st = f.O === 0 ? stats([["points awarded", String(f.points), f.points > f.expected ? "bad" : f.points === f.expected ? "done" : ""], ["correct total", String(f.expected), ""]])
      : stats([["orders Paid", String(f.status.length), "done"], ["duplicate side effects", "0", "done"]]);
    const log = tbl("delivery log", ["#", "msg", "what the handler did", "result"], f.log, { empty: "nothing delivered yet" });
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack"><div class="ax-row">${q}${ib}</div><div class="ax-row">${st}</div>${log}${v}</div>`;
  }
  Viz.register("distributed-architecture-inbox", (host) => Viz.player(host, {
    title: "Idempotent consumers: surviving duplicates", tag: "REDELIVER · DEDUPLICATE",
    legend: [["visit", "pending delivery"], ["done", "applied once / skipped"], ["active", "crash, will retry"], ["bad", "applied twice"]],
    code: [
      "handle(msg): points += 10                       // naive",
      "// at-least-once ⇒ the same msg.Id can arrive again",
      "BEGIN",
      "  if exists(inbox where id = msg.Id) → COMMIT; ack; return",
      "  apply change;  INSERT inbox(msg.Id)           // same tx",
      "COMMIT; ack",
      "if inbox.Has(id) return                          // check…",
      "apply; COMMIT;  inbox.Add(id); COMMIT            // …gap here",
      "",
      "INSERT points(order_id, 10) ON CONFLICT DO NOTHING  // natural",
    ],
    inputs: [
      { key: "strat", label: "consumer strategy", type: "select", options: IN_STRATS, value: IN_STRATS[0] },
      { key: "deliveries", label: "deliveries (ids; …)", value: "m1; m2; m1; m3; m2", width: 200 },
      { key: "op", label: "operation", type: "select", options: IN_OPS, value: IN_OPS[0] },
      { key: "crash", label: "crash", type: "select", options: IN_CRASH, value: IN_CRASH[0] },
    ],
    random: () => ({ strat: pick(IN_STRATS), deliveries: Array.from({ length: 3 + Math.floor(Math.random() * 5) }, () => `m${1 + Math.floor(Math.random() * 4)}`).join("; "), op: pick(IN_OPS), crash: pick(IN_CRASH) }),
    build: buildInbox,
    speed: 1400,
    render: renderInbox,
  }));

  /* ================= distributed-architecture: sagas — choreography vs orchestration ================= */
  const SG_STYLES = ["orchestration (a coordinator sends commands)", "choreography (services react to events)"];
  const SG_FAILS = ["everything succeeds", "payment declined", "out of stock", "no courier available", "out of stock, and the refund API is down"];
  const SG_STEPS = [
    { k: "ord", svc: "Orders", act: "create order (Pending)", comp: "cancel order", ev: "OrderCreated", cmd: "CreateOrder" },
    { k: "pay", svc: "Payment", act: "charge card", comp: "refund card", ev: "PaymentCaptured", cmd: "ChargePayment", fail: "PaymentDeclined" },
    { k: "inv", svc: "Inventory", act: "reserve stock", comp: "release stock", ev: "StockReserved", cmd: "ReserveStock", fail: "OutOfStock" },
    { k: "shp", svc: "Shipping", act: "book courier", comp: "cancel booking", ev: "CourierBooked", cmd: "BookCourier", fail: "NoCourier" },
  ];
  function buildSaga({ style, fail }) {
    const O = SG_STYLES.indexOf(style) === 0, F = SG_FAILS.indexOf(fail);
    if (SG_STYLES.indexOf(style) < 0 || F < 0) throw new Error("Pick a style and a failure.");
    const failAt = F === 0 ? -1 : F === 1 ? 1 : F === 2 || F === 4 ? 2 : 3, refundDown = F === 4;
    const status = SG_STEPS.map(() => "pending"), msgs = [], frames = [];
    let state = "Started";
    const push = (m, note, line, ch) => { if (m) msgs.push(m); if (ch) ch(); frames.push({ O, msgs: [...msgs], status: [...status], state, note, line, vars: { saga: state, done: status.filter((s) => s === "done").length, compensated: status.filter((s) => s === "compensated").length } }); };
    const hub = O ? "orc" : "bus";
    push({ f: "client", t: "ord", label: "POST /orders" }, O ? "An <b>orchestrator</b> (a state machine with its own persisted state) will drive the steps by sending commands and waiting for replies." : "No coordinator: each service <b>reacts to events</b> and publishes its own. The flow exists only as the sum of the subscriptions.", O ? 1 : 7);
    for (let i = 0; i < SG_STEPS.length; i++) {
      const s = SG_STEPS[i];
      if (i === 0) {
        push({ f: "ord", t: "ord", label: "order 42 = Pending", cls: "done" }, "Step 1 (local transaction): Orders saves the order as <b>Pending</b>. Other services can't see a half-finished order as confirmed.", O ? 1 : 7, () => { status[0] = "done"; });
        push({ f: "ord", t: hub, label: O ? "start saga" : "OrderCreated", cls: "path" }, O ? "Orders starts the saga instance for order 42." : "Orders publishes <code>OrderCreated</code>.", O ? 1 : 7, () => { state = O ? "AwaitingPayment" : state; });
        continue;
      }
      push({ f: hub, t: s.k, label: O ? s.cmd : SG_STEPS[i - 1].ev, cls: "path" }, O ? `The orchestrator sends <code>${s.cmd}</code> to ${s.svc}.` : `${s.svc} is subscribed to <code>${SG_STEPS[i - 1].ev}</code>, so it reacts.`, O ? 2 : 8);
      if (i === failAt) {
        push({ f: s.k, t: hub, label: s.fail, cls: "bad" }, `${s.svc} <b>can't ${s.act}</b>: it replies or publishes <code>${s.fail}</code>. Its own local transaction made no change.`, O ? 3 : 9, () => { status[i] = "failed"; state = O ? "Compensating" : state; });
        break;
      }
      push({ f: s.k, t: hub, label: s.ev, cls: "done" }, `${s.svc} commits its local transaction (${s.act}) and ${O ? "replies" : "publishes"} <code>${s.ev}</code>. Each step commits on its own: there is no global transaction to roll back.`, O ? 2 : 8,
        () => { status[i] = "done"; state = O ? (i < 3 ? `Awaiting${SG_STEPS[i + 1].svc}` : "Completing") : state; });
    }
    if (failAt < 0) {
      push({ f: hub, t: "ord", label: O ? "ConfirmOrder" : "CourierBooked", cls: "path" }, O ? "All steps succeeded: the orchestrator tells Orders to confirm." : "Orders listens for <code>CourierBooked</code>…", O ? 2 : 8);
      push({ f: "ord", t: "ord", label: "order 42 = Confirmed", cls: "done" }, "The order is <b>Confirmed</b>. The saga is complete.", O ? 2 : 8, () => { state = "Completed"; });
    } else {
      for (let j = failAt - 1; j >= 0; j--) {
        const s = SG_STEPS[j];
        if (O) push({ f: "orc", t: s.k, label: j === 0 ? "CancelOrder" : `${s.comp.replace(/ (\w)/g, (_, c) => c.toUpperCase()).replace(/^\w/, (c) => c.toUpperCase())}`, cls: "active" }, `<b>Compensate</b> step ${j + 1} in reverse order: the orchestrator sends “${s.comp}” to ${s.svc}.`, 3);
        else push({ f: "bus", t: s.k, label: j === failAt - 1 ? SG_STEPS[failAt].fail : `${SG_STEPS[j + 1].svc}Compensated`, cls: "active" }, `${s.svc} also subscribes to <code>${j === failAt - 1 ? SG_STEPS[failAt].fail : SG_STEPS[j + 1].svc + "Compensated"}</code> and runs its compensation: <b>${s.comp}</b>.`, 9);
        if (j === 1 && refundDown) {
          push({ f: s.k, t: s.k, label: "refund API down: retry 1, 2, 3…", cls: "bad" }, "The refund call fails. Compensations <b>must eventually succeed</b>, so they are retried with backoff. They can't be skipped.", O ? 4 : 9, () => { status[j] = "retrying"; });
          push({ f: s.k, t: s.k, label: "→ dead-letter + alert a human", cls: "bad" }, "Retries are exhausted. The message goes to a dead-letter queue and an operator is alerted. The saga is <b>stuck</b> until someone acts. Design for this case: it will happen.", O ? 5 : 9, () => { status[j] = "stuck"; state = "NeedsAttention"; });
          break;
        }
        push({ f: s.k, t: hub, label: j === 0 ? "OrderCancelled" : `${s.svc}Compensated`, cls: "done" }, `${s.svc} commits the compensation (${s.comp}). ${j === 1 ? "A refund isn't an undo: the customer sees a charge and a refund on their statement. Compensation is a <b>semantic</b> undo." : ""}`, O ? 3 : 9, () => { status[j] = "compensated"; });
      }
      if (!refundDown) push(null, `Every completed step has been compensated. The order ends <b>Cancelled</b>. The system was briefly inconsistent (a charged card, a pending order) and that was visible: that is the deal with sagas.`, O ? 3 : 9, () => { state = "Compensated"; });
    }
    const v = failAt < 0 ? ["done", O ? "Completed. The whole flow is visible in one class: easy to read, monitor and change, but the orchestrator is one more component that knows every step." : "Completed with no coordinator. Loosely coupled, but nobody owns the flow: to know what happens after OrderCreated you must read four services."]
      : refundDown ? ["bad", "Stuck: a compensation failed after retries. Real sagas need dead-letter handling, an alert and a runbook (or a manual-repair UI)."]
        : ["warn", `Rolled back by compensation. Steps after the failure never ran; ${failAt - 1} step${failAt > 2 ? "s were" : " was"} semantically undone in reverse order.`];
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Result:</b> ${v[1]}`, line: refundDown ? 5 : failAt < 0 ? 2 : 3 });
    return frames;
  }
  function renderSaga(f) {
    const actors = [{ k: "client", title: "Client" }, { k: "ord", title: "Orders" }, { k: f.O ? "orc" : "bus", title: f.O ? "Orchestrator" : "Broker", sub: f.O ? `state: ${f.state}` : "events", cls: f.O ? "accent" : "visit" },
      { k: "pay", title: "Payment" }, { k: "inv", title: "Inventory" }, { k: "shp", title: "Shipping" }];
    const svg = seq({ actors, msgs: f.msgs, colW: 140, rowH: 26, rows: 14, label: "saga sequence" });
    const cls = { done: "done", failed: "bad", compensated: "active", retrying: "bad", stuck: "bad", pending: "dim" };
    const t = tbl("saga steps", ["#", "service", "action", "compensation", "status"], SG_STEPS.map((s, i) => ({ c: [i + 1, s.svc, s.act, s.comp, f.status[i]], cls: cls[f.status[i]] })));
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}${t}${v}</div>`;
  }
  Viz.register("distributed-architecture-saga", (host) => Viz.player(host, {
    title: "Sagas: local transactions + compensations", tag: "PICK A STYLE · FAIL A STEP",
    legend: [["path", "command / event"], ["done", "local commit"], ["active", "compensation"], ["bad", "failure"]],
    code: [
      "// orchestration: one state machine drives the flow",
      "Started → send CreateOrder, ChargePayment, ReserveStock, BookCourier",
      "on reply ok → next step;  on failure → Compensating",
      "Compensating: for done steps in REVERSE → send compensation",
      "compensations: idempotent, retried until they succeed",
      "// on exhausted retries → dead-letter, alert a human",
      "// choreography: no coordinator",
      "Orders: publish OrderCreated",
      "Payment: on OrderCreated → charge → publish PaymentCaptured",
      "each service: on <failure event> → run my compensation",
    ],
    inputs: [
      { key: "style", label: "style", type: "select", options: SG_STYLES, value: SG_STYLES[0] },
      { key: "fail", label: "what goes wrong", type: "select", options: SG_FAILS, value: SG_FAILS[3] },
    ],
    random: () => ({ style: pick(SG_STYLES), fail: pick(SG_FAILS) }),
    build: buildSaga,
    speed: 1400,
    render: renderSaga,
  }));

  /* ================= distributed-architecture: event sourcing ================= */
  const ES_CONFLICT = ["no concurrent writer", "another writer appends before command 3"];
  function esDecide(st, cmd) {
    const [verb, arg] = cmd.split(/\s+/), x = Number(arg);
    if (!["open", "deposit", "withdraw", "close"].includes(verb)) throw new Error(`commands: “${cmd}” — use open, deposit N, withdraw N or close.`);
    if ((verb === "deposit" || verb === "withdraw") && !(Number.isFinite(x) && x > 0 && x <= 1e6)) throw new Error(`commands: “${cmd}” needs a positive amount.`);
    if (verb === "open") return st.status === "none" ? { ev: "AccountOpened" } : { no: "already open" };
    if (st.status !== "open") return { no: st.status === "closed" ? "account is closed" : "account not opened yet" };
    if (verb === "deposit") return { ev: `Deposited ${x}` };
    if (verb === "withdraw") return x > st.balance ? { no: `insufficient funds (balance ${st.balance})` } : { ev: `Withdrew ${x}` };
    return st.balance ? { no: `balance must be 0 to close (is ${st.balance})` } : { ev: "AccountClosed" };
  }
  function esEvolve(st, e) {
    const [k, a] = e.split(" "), x = Number(a) || 0;
    return { status: k === "AccountOpened" ? "open" : k === "AccountClosed" ? "closed" : st.status, balance: st.balance + (k === "Deposited" ? x : k === "Withdrew" ? -x : 0), version: st.version + 1 };
  }
  function buildES({ cmds, snapEvery, conflict }) {
    const list = items(cmds, "commands", 1, 9), N = int(snapEvery, "snapshot every (0 = off)", 0, 9), C = ES_CONFLICT.indexOf(conflict);
    if (C < 0) throw new Error("Pick a concurrency option.");
    const stream = [], snaps = [], results = [], frames = [];
    let st = { status: "none", balance: 0, version: 0 }, proj = { balance: 0, txns: 0, largest: 0, version: 0 };
    const project = (e) => { const [k, a] = e.split(" "), x = Number(a) || 0; proj = { balance: proj.balance + (k === "Deposited" ? x : k === "Withdrew" ? -x : 0), txns: proj.txns + (k === "Deposited" || k === "Withdrew" ? 1 : 0), largest: k === "Withdrew" ? Math.max(proj.largest, x) : proj.largest, version: proj.version + 1 }; };
    const snap = (note, line, ex = {}) => frames.push({ stream: [...stream], snaps: [...snaps], st: { ...st }, proj: { ...proj }, results: [...results], note, line, ...ex,
      vars: { version: st.version, balance: st.balance, events: stream.length, snapshots: snaps.length } });
    snap("An event-sourced aggregate stores <b>what happened</b>, not the current state. State is a left fold over the events: <code>state = events.reduce(evolve, initial)</code>.", 0);
    const append = (e, by) => {
      stream.push({ v: stream.length + 1, e, by }); st = esEvolve(st, e); project(e);
      if (N && stream.length % N === 0) snaps.push({ v: stream.length, balance: st.balance, status: st.status });
    };
    list.forEach((cmd, i) => {
      const c = cmd.toLowerCase();
      const loaded = st.version;
      if (C === 1 && i === 2 && st.status === "open") {
        snap(`Command “${esc(cmd)}”: load the stream (version ${loaded}) and decide…`, 1, { hl: "load" });
        append("Deposited 10", "interest job");
        snap(`…meanwhile an <b>interest job</b> appends <code>Deposited 10</code>. The stream is now at version ${st.version}, but this handler decided based on version ${loaded}.`, 3, { hl: "race" });
        const d0 = esDecide({ ...st, version: loaded, balance: st.balance - 10 }, c);
        if (d0.ev) {
          results.push({ c: [cmd, `append(expected v${loaded}) → CONFLICT`, "reload + retry"], cls: "active" });
          snap(`Our append says <code>expectedVersion: ${loaded}</code> but the stream is at ${st.version}: the store rejects it with a <b>concurrency conflict</b>. No lost update. The handler reloads (${st.version} events) and decides again.`, 3, { hl: "conflict" });
        }
      }
      const d = esDecide(st, c);
      if (d.no) {
        results.push({ c: [cmd, `rejected: ${d.no}`, "no event stored"], cls: "bad" });
        snap(`Command “${esc(cmd)}” is <b>rejected</b> (${esc(d.no)}). Nothing is appended: the stream only holds facts that actually happened.`, 2);
        return;
      }
      const v0 = st.version;
      append(d.ev, "handler");
      results.push({ c: [cmd, `${d.ev}`, `append(expected v${v0}) → v${st.version}`], cls: "done" });
      const sn = N && stream.length % N === 0;
      snap(`“${esc(cmd)}” → decide → <code>${esc(d.ev)}</code>, appended at version ${st.version}. The aggregate folds it (balance ${st.balance}); the projection updates its read model.${sn ? ` A <b>snapshot</b> of the state at v${st.version} is saved, so future loads can skip replaying the first ${st.version} events.` : ""}`, sn ? 5 : [2, 3, 4]);
    });
    const last = snaps[snaps.length - 1];
    const replay = last ? stream.length - last.v : stream.length;
    snap(`<b>Rebuild:</b> loading this account ${last ? `starts from the snapshot at v${last.v} and replays ${replay} event${replay === 1 ? "" : "s"}` : `replays all ${stream.length} events`}. Because the events are the source of truth, you can also build a <b>new</b> read model later (the “largest withdrawal” column) by replaying history from v1.`, [0, 5, 6], { final: true, replay });
    return frames;
  }
  function renderES(f) {
    const evs = f.stream.length ? f.stream.map((x, i) => {
      const isSnap = f.snaps.some((s) => s.v === x.v);
      const cls = x.by !== "handler" ? "active" : i === f.stream.length - 1 && !f.final ? "path" : /Withdrew/.test(x.e) ? "visit" : "done";
      return chip(`v${x.v} ${x.e}${x.by !== "handler" ? " (interest job)" : ""}`, cls) + (isSnap ? chip(`📸 snapshot v${x.v}`, "accent") : "");
    }).join(" ") : chip("empty stream", "dim");
    const store = `<div class="ax-panel" style="flex-basis:100%"><div class="ax-panel-h"><span>event store · stream account-7 (append-only)</span><span>${f.stream.length} events</span></div>${evs}</div>`;
    const agg = kv("aggregate state (folded)", [["status", f.st.status], ["balance", f.st.balance, ""], ["version", f.st.version, f.hl === "conflict" ? "bad" : ""]]);
    const pr = kv("read model (projection)", [["balance", f.proj.balance], ["transactions", f.proj.txns], ["largest withdrawal", f.proj.largest, f.final ? "active" : ""], ["at version", f.proj.version, ""]]);
    const t = tbl("commands", ["command", "decision", "append"], f.results, { empty: "no commands handled yet" });
    const extra = f.final ? stats([["events replayed on load", String(f.replay), "done"], ["without snapshots", String(f.stream.length), ""], ["snapshots", String(f.snaps.length), f.snaps.length ? "visit" : ""]]) : "";
    return `<div class="ax-stack"><div class="ax-row">${store}</div><div class="ax-row">${agg}${pr}</div>${t}${extra}</div>`;
  }
  Viz.register("distributed-architecture-event-sourcing", (host) => Viz.player(host, {
    title: "Event sourcing: decide, append, fold, project", tag: "TYPE COMMANDS · WATCH THE STREAM",
    legend: [["done", "event stored"], ["path", "just appended"], ["active", "concurrent writer"], ["bad", "rejected / conflict"], ["accent", "snapshot"]],
    code: [
      "state = snapshot ?? initial; state = events.Aggregate(state, Evolve)",
      "events = Load(stream)                       // version = events.Count",
      "newEvents = Decide(state, command)          // may reject: no event",
      "Append(stream, newEvents, expectedVersion)  // conflict if someone else wrote",
      "state = newEvents.Aggregate(state, Evolve)",
      "if (version % N == 0) SaveSnapshot(state, version)",
      "projection: on each event → update read model (async, rebuildable)",
    ],
    inputs: [
      { key: "cmds", label: "commands (open; deposit N; withdraw N; close)", value: "open; deposit 100; withdraw 30; deposit 50; withdraw 200; withdraw 20", width: 380 },
      { key: "snapEvery", label: "snapshot every N (0 = off)", value: "3", width: 70 },
      { key: "conflict", label: "concurrency", type: "select", options: ES_CONFLICT, value: ES_CONFLICT[1] },
    ],
    random: () => ({ cmds: ["open", ...Array.from({ length: 3 + Math.floor(Math.random() * 4) }, () => pick(["deposit", "deposit", "withdraw"]) + " " + pick([20, 50, 80, 120, 200]))].join("; "), snapEvery: pick(["0", "2", "3", "4"]), conflict: pick(ES_CONFLICT) }),
    build: buildES,
    speed: 1500,
    render: renderES,
  }));

  /* ================= distributed-architecture: CAP / PACELC ================= */
  const CAP_MODE = ["CP: quorum (majority) reads and writes", "AP: write and read the local replica"];
  const CAP_SCEN = ["network partition between regions", "no partition: latency vs consistency"];
  const CAP_MERGE = ["last-writer-wins (timestamp)", "keep both versions, merge in the app"];
  function buildCap({ mode, scen, merge }) {
    const M = CAP_MODE.indexOf(mode), S = CAP_SCEN.indexOf(scen), R = CAP_MERGE.indexOf(merge);
    if (M < 0 || S < 0 || R < 0) throw new Error("Pick the options.");
    const val = { n1: "[book]", n2: "[book]", n3: "[book]" }, log = [], frames = [];
    let part = false, err = 0, stale = 0, lost = 0;
    const snap = (note, line, hl = {}) => frames.push({ M, S, part, val: { ...val }, log: log.slice(-7), hl, note, line, err, stale, lost,
      vars: { partition: part ? "yes" : "no", N1: val.n1, N3: val.n3, errors: err, "stale reads": stale } });
    snap("Three replicas of Alice's cart: <b>N1</b> and <b>N2</b> in East, <b>N3</b> in West (70 ms away). Everyone agrees: <code>[book]</code>.", 0);
    if (S === 0) {
      part = true;
      snap("The link between the regions fails. N3 can't reach N1 or N2. This is the P in CAP: in a real network, partitions <b>will</b> happen, so the real choice is between C and A <b>while</b> it lasts.", 1, { cut: true });
      if (M === 0) {
        val.n1 = val.n2 = "[book, pen]"; log.push({ c: ["Alice → N1", "add pen", "N1+N2 = majority ✓", "OK (2 ms)"], cls: "done" });
        snap("Alice (East) adds a pen through N1. N1 and N2 are 2 of 3, a <b>majority</b>, so the write commits.", 2, { a: "n1" });
        err++; log.push({ c: ["Bob → N3", "add lamp", "N3 alone = 1 of 3 ✗", "ERROR: unavailable"], cls: "bad" });
        snap("Bob shares the cart from West and adds a lamp through N3. N3 can't reach a majority, so it <b>refuses</b> the write. Consistent, but <b>not available</b> on that side.", 2, { a: "n3", bad: "n3" });
        err++; log.push({ c: ["Bob → N3", "read cart", "no quorum", "ERROR (or 'maybe stale')"], cls: "bad" });
        snap("Bob's read also fails: N3 can't prove its copy is current. (Some systems offer an explicit “stale read OK” option instead.)", 2, { a: "n3", bad: "n3" });
        part = false; val.n3 = "[book, pen]";
        snap("The partition heals. N3 catches up from the majority. There was never a conflict to resolve, because the minority side never accepted writes.", 4, { a: "n3" });
      } else {
        val.n1 = val.n2 = "[book, pen]"; log.push({ c: ["Alice → N1", "add pen", "local write", "OK (1 ms)"], cls: "done" });
        snap("Alice adds a pen through N1. It is accepted locally and replicated to N2.", 3, { a: "n1" });
        val.n3 = "[book, lamp]"; log.push({ c: ["Bob → N3", "add lamp", "local write", "OK (1 ms)"], cls: "done" });
        snap("Bob adds a lamp through N3. AP says “always answer”, so N3 accepts it too. The replicas have now <b>diverged</b>.", 3, { a: "n3" });
        stale++; log.push({ c: ["Alice → N1", "read cart", "local", "[book, pen]: misses lamp"], cls: "active" });
        snap("Alice reads her cart and doesn't see Bob's lamp. Both sides stay available, but they disagree.", 3, { a: "n1" });
        part = false;
        if (R === 0) {
          lost++; val.n1 = val.n2 = val.n3 = "[book, lamp]"; log.push({ c: ["heal", "merge", "LWW: Bob's ts is later", "pen silently LOST"], cls: "bad" });
          snap("The partition heals and the replicas reconcile with <b>last-writer-wins</b>. Bob's write has the later timestamp, so the whole value <code>[book, lamp]</code> wins and Alice's pen <b>silently disappears</b>. (Clock skew can even make the earlier write win.)", 4, { bad: "n1" });
        } else {
          val.n1 = val.n2 = val.n3 = "[book, pen, lamp]"; log.push({ c: ["heal", "merge", "siblings → app merges (union)", "nothing lost"], cls: "done" });
          snap("The partition heals. The store notices two concurrent versions (via version vectors) and keeps both as <b>siblings</b>. The app merges them, here as a set union: <code>[book, pen, lamp]</code>. CRDTs do this automatically for counters, sets and maps.", 4);
        }
      }
    } else {
      if (M === 0) {
        val.n1 = val.n2 = val.n3 = "[book, pen]"; log.push({ c: ["Alice → N1", "add pen", "wait for majority", "OK (2 ms in East)"], cls: "done" });
        snap("No partition. Alice writes through N1 and waits for a majority (N1 + N2, both in East).", 5, { a: "n1" });
        log.push({ c: ["Bob → N3", "read cart", "quorum read (N3 + an East node)", "[book, pen] in 70 ms"], cls: "done" });
        snap("Bob reads in West. A quorum read must include an East node, so he pays <b>70 ms</b> but always sees Alice's pen. PACELC: <b>E</b>lse (no partition), you trade <b>L</b>atency for <b>C</b>onsistency.", 5, { a: "n3" });
      } else {
        val.n1 = val.n2 = "[book, pen]"; log.push({ c: ["Alice → N1", "add pen", "local, async replication", "OK (1 ms)"], cls: "done" });
        snap("No partition. Alice writes to N1; replication to the other region is asynchronous.", 6, { a: "n1" });
        stale++; log.push({ c: ["Bob → N3", "read cart", "local replica", "[book] in 1 ms: STALE"], cls: "active" });
        snap("Bob reads N3 a few milliseconds later: fast (1 ms) but <b>stale</b>, because replication hasn't arrived yet. This is eventual consistency even with a healthy network.", 6, { a: "n3", bad: "n3" });
        val.n3 = "[book, pen]"; log.push({ c: ["replication", "N1 → N3", "lag ≈ 80 ms", "converged"], cls: "done" });
        snap("About 80 ms later the replica catches up. If Alice herself had been routed to N3 she wouldn't see her own write: use <b>read-your-writes</b> (sticky sessions or a version token) where that matters.", 6, { a: "n3" });
      }
    }
    const v = S === 0 ? (M === 0 ? ["warn", "CP: no divergence, but the minority side was down for writes and reads. Right for money, inventory counts, uniqueness."]
      : R === 0 ? ["bad", "AP + last-writer-wins: always available, but a concurrent write was silently lost. Only acceptable when overwrites are harmless."] : ["done", "AP + merge: always available and nothing lost, because the data type can be merged (a set). Right for carts, likes, presence."])
      : M === 0 ? ["warn", "No partition, consistent reads, paid for with cross-region latency on every quorum operation."] : ["warn", "No partition, fast local reads, paid for with staleness. Fine for feeds and catalogues; add read-your-writes for the author."];
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Result:</b> ${v[1]}`, line: S === 0 ? (M === 0 ? 2 : 4) : M === 0 ? 5 : 6 });
    return frames;
  }
  function renderCap(f) {
    const n = (k, x, y, title) => ({ k, x, y, w: 150, title, sub: f.val[k], cls: f.hl.bad === k ? "bad" : f.hl.a === k ? "active" : "done", tag: k === "n3" ? "region West" : k === "n1" ? "region East" : undefined });
    const nodes = [n("n1", 90, 70, "N1"), n("n2", 90, 170, "N2"), n("n3", 430, 120, "N3"),
      { k: "a", x: -90, y: 70, title: "Alice", w: 80, cls: "accent" }, { k: "b", x: 610, y: 120, title: "Bob", w: 80, cls: "accent" }];
    const edges = [{ u: "n1", v: "n2", cls: "muted", nohead: true }, { u: "n1", v: "n3", cls: f.part ? "bad" : "muted", dash: f.part, nohead: true, label: f.part ? "✂ partition" : "70 ms", ly: -6 },
      { u: "n2", v: "n3", cls: f.part ? "bad" : "muted", dash: f.part, nohead: true }, { u: "a", v: "n1", cls: f.hl.a === "n1" ? "active" : "muted" }, { u: "b", v: "n3", cls: f.hl.a === "n3" ? "active" : "muted" }];
    const svg = diagram({ nodes, edges, label: "three replicas across two regions" });
    const st = stats([["errors (unavailable)", String(f.err), f.err ? "bad" : ""], ["stale reads", String(f.stale), f.stale ? "active" : ""], ["writes lost", String(f.lost), f.lost ? "bad" : ""]]);
    const t = tbl("operations", ["who", "op", "how", "result"], f.log, { empty: "no operations yet" });
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}${st}${t}${v}</div>`;
  }
  Viz.register("distributed-architecture-cap", (host) => Viz.player(host, {
    title: "CAP and PACELC with three replicas", tag: "PARTITION THE NETWORK · CHOOSE",
    legend: [["done", "replica value"], ["active", "being used"], ["bad", "refused / lost"], ["accent", "client"]],
    code: [
      "// replicas N1, N2 (East) and N3 (West); quorum = 2 of 3",
      "if (Partition)  choose: Consistency or Availability",
      "  CP: write/read needs a majority → minority side errors",
      "  AP: accept locally → replicas diverge",
      "  heal: reconcile (last-writer-wins, or merge siblings / CRDT)",
      "else            choose: Latency or Consistency     // PACELC",
      "  async replication: fast, stale reads possible",
    ],
    inputs: [
      { key: "mode", label: "system", type: "select", options: CAP_MODE, value: CAP_MODE[1] },
      { key: "scen", label: "scenario", type: "select", options: CAP_SCEN, value: CAP_SCEN[0] },
      { key: "merge", label: "AP reconciliation", type: "select", options: CAP_MERGE, value: CAP_MERGE[0] },
    ],
    random: () => ({ mode: pick(CAP_MODE), scen: pick(CAP_SCEN), merge: pick(CAP_MERGE) }),
    build: buildCap,
    speed: 1600,
    render: renderCap,
  }));

  /* ================= distributed-architecture: two-phase commit ================= */
  const TP_FAILS = ["nothing fails", "Inventory votes NO", "coordinator crashes after the YES votes", "Payments is slow to vote (5 s)"];
  function buildTwoPC({ fail }) {
    const F = TP_FAILS.indexOf(fail);
    if (F < 0) throw new Error("Pick a failure.");
    const P = [{ k: "ord", name: "Orders DB" }, { k: "pay", name: "Payments DB" }, { k: "inv", name: "Inventory DB" }];
    const st = Object.fromEntries(P.map((p) => [p.k, "idle"]));
    const msgs = [], frames = [];
    let blocked = 0, t = 0, coord = "working";
    const push = (m, note, line, ch) => { if (m) [].concat(m).forEach((x) => msgs.push(x)); if (ch) ch(); frames.push({ msgs: [...msgs], st: { ...st }, blocked, t, coord, note, line, vars: { coordinator: coord, "locks held (s)": t, "blocked requests": blocked } }); };
    push(null, "One business transaction touches three databases. 2PC tries to make them commit <b>atomically</b> using a coordinator (the transaction manager).", 0);
    push(P.map((p) => ({ f: "co", t: p.k, label: "PREPARE", cls: "path" })), "Phase 1: the coordinator asks every participant to <b>prepare</b>: do the work, write it durably, take the locks, and promise to commit if asked.", 1,
      () => { P.forEach((p) => (st[p.k] = "prepared, locked")); });
    push(null, "All three rows are now <b>locked</b> until phase 2 finishes. Any other transaction that touches them must wait.", 1, () => { t = 0.1; });
    push({ f: "ord", t: "co", label: "YES", cls: "done" }, "Orders votes YES.", 2);
    if (F === 3) push({ f: "pay", t: "pay", label: "…busy (GC pause, slow disk)…", cls: "active" }, "Payments is slow. Everyone waits for the slowest participant, still holding their locks.", 2, () => { t = 5; blocked += 40; });
    push({ f: "pay", t: "co", label: "YES", cls: "done" }, "Payments votes YES.", 2, () => { if (F === 3) t = 5.1; });
    if (F === 1) {
      push({ f: "inv", t: "co", label: "NO (out of stock)", cls: "bad" }, "Inventory votes <b>NO</b>.", 2, () => { st.inv = "aborted"; });
      push([{ f: "co", t: "ord", label: "ROLLBACK", cls: "active" }, { f: "co", t: "pay", label: "ROLLBACK", cls: "active" }], "A single NO aborts everyone: the coordinator tells the others to roll back and release their locks. Clean, which is 2PC's selling point.", 3,
        () => { st.ord = st.pay = "rolled back"; coord = "aborted"; });
    } else {
      push({ f: "inv", t: "co", label: "YES", cls: "done" }, "Inventory votes YES. The coordinator writes “COMMIT” to its own log: the decision is made.", 2, () => { coord = "decided: commit"; });
      if (F === 2) {
        push({ f: "co", t: "co", label: "💥 coordinator crashes", cls: "bad" }, "The coordinator crashes before sending COMMIT.", 4, () => { coord = "DOWN"; });
        push(null, "Each participant voted YES, so it <b>may not</b> roll back on its own (the decision might be COMMIT), and it <b>may not</b> commit on its own (it might be ABORT). They are <b>in doubt</b> and keep holding their locks.", 4,
          () => { P.forEach((p) => (st[p.k] = "IN DOUBT, locked")); t = 30; blocked += 120; });
        push(null, "Meanwhile every checkout, refund and stock check that touches those rows queues up behind the locks. The coordinator is a <b>blocking</b> single point of failure.", 4, () => { t = 300; blocked += 900; });
        push(P.map((p) => ({ f: "co", t: p.k, label: "COMMIT (after recovery)", cls: "done" })), "Five minutes later the coordinator restarts, reads its log and finally sends COMMIT. The locks are released.", 5,
          () => { coord = "committed"; P.forEach((p) => (st[p.k] = "committed")); });
      } else {
        push(P.map((p) => ({ f: "co", t: p.k, label: "COMMIT", cls: "done" })), "Phase 2: COMMIT to everyone. Each participant commits and releases its locks.", 3, () => { coord = "committed"; P.forEach((p) => (st[p.k] = "committed")); if (!t || t < 0.2) t = 0.2; });
      }
    }
    const v = F === 2 ? ["bad", `Blocked for ${t} s: in-doubt participants can't decide without the coordinator. ${blocked} other requests waited on locks.`]
      : F === 3 ? ["warn", "Committed, but the locks were held for 5 s because of one slow participant. Throughput and latency are tied to the slowest service."]
        : F === 1 ? ["done", "Atomic abort. This is what 2PC is good at: inside one trust and failure domain (e.g. two databases on one app server)."]
          : ["done", "Atomic commit, at the cost of 2 round-trips and locks held across the network."];
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Result:</b> ${v[1]} Across services, prefer local transactions + outbox + sagas: they never hold locks across a network.`, line: 6 });
    return frames;
  }
  function renderTwoPC(f) {
    const actors = [{ k: "co", title: "Coordinator", sub: f.coord, cls: f.coord === "DOWN" ? "bad" : "accent" }, { k: "ord", title: "Orders DB" }, { k: "pay", title: "Payments DB", cls: f.msgs.some((m) => m.cls === "active" && m.f === "pay") ? "active" : "" }, { k: "inv", title: "Inventory DB" }];
    const svg = seq({ actors, msgs: f.msgs, colW: 170, rowH: 26, rows: 14, label: "two-phase commit sequence" });
    const cls = (s) => (/IN DOUBT|aborted/.test(s) ? "bad" : /locked/.test(s) ? "active" : /committed|rolled/.test(s) ? "done" : "");
    const k = kv("participants", [["Orders DB", f.st.ord, cls(f.st.ord)], ["Payments DB", f.st.pay, cls(f.st.pay)], ["Inventory DB", f.st.inv, cls(f.st.inv)]]);
    const st = stats([["locks held", `${f.t} s`, f.t >= 5 ? "bad" : f.t ? "active" : ""], ["requests blocked on locks", String(f.blocked), f.blocked ? "bad" : ""]]);
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}<div class="ax-row">${k}${st}</div>${v}</div>`;
  }
  Viz.register("distributed-architecture-2pc", (host) => Viz.player(host, {
    title: "Two-phase commit, and why it blocks", tag: "VOTE · DECIDE · CRASH",
    legend: [["path", "prepare"], ["done", "yes / commit"], ["active", "locks held / slow"], ["bad", "no / in doubt / crash"]],
    code: [
      "// one business tx spans several resource managers",
      "phase 1: coordinator → all: PREPARE   (do the work, lock, persist)",
      "         each → coordinator: YES | NO",
      "phase 2: all YES ⇒ COMMIT; any NO ⇒ ROLLBACK",
      "coordinator dies after YES ⇒ participants IN DOUBT, locks held",
      "recovery: coordinator reads its log, resends the decision",
      "// across services: local tx + outbox + saga instead",
    ],
    inputs: [{ key: "fail", label: "what goes wrong", type: "select", options: TP_FAILS, value: TP_FAILS[2] }],
    random: () => ({ fail: pick(TP_FAILS) }),
    build: buildTwoPC,
    speed: 1600,
    render: renderTwoPC,
  }));

  /* ================= distributed-architecture: strangler fig ================= */
  const SF_MODULES = ["catalog", "cart", "orders", "payments", "accounts", "search"];
  const SF_ROLL = ["canary 0 → 5% → 50% → 100%", "big bang 0 → 100%"];
  const SF_INC = ["no incident", "the 2nd extracted service fails at its first shift"];
  function buildStrangler({ order, roll, inc }) {
    const ex = items(order, "modules to extract", 1, 4).map((m) => { const x = m.toLowerCase(); if (!SF_MODULES.includes(x)) throw new Error(`modules: “${m}” — pick from ${SF_MODULES.join(", ")}.`); return x; });
    if (new Set(ex).size !== ex.length) throw new Error("modules: list each module once.");
    const R = SF_ROLL.indexOf(roll), I = SF_INC.indexOf(inc);
    if (R < 0 || I < 0) throw new Error("Pick the options.");
    const pct = Object.fromEntries(SF_MODULES.map((m) => [m, 0])), built = new Set(), removed = new Set(), frames = [];
    let facade = false, incidents = 0;
    const push = (note, line, hl, bad) => frames.push({ pct: { ...pct }, built: [...built], removed: [...removed], facade, hl, bad, note, line, incidents,
      vars: { facade: facade ? "yes" : "no", extracted: removed.size, "in monolith": SF_MODULES.length - removed.size, incidents } });
    push("A working monolith with six modules. A rewrite from scratch (“big bang”) stops feature work for months and usually fails. Instead we'll <b>strangle</b> it: replace it piece by piece while it keeps running.", 0);
    facade = true;
    push("Step 1: put a <b>routing facade</b> (reverse proxy / API gateway, e.g. YARP, Envoy, Spring Cloud Gateway) in front. It sends 100% of traffic to the monolith, so nothing changes for users yet, but you now control every route.", 1);
    const steps = R === 0 ? [5, 50, 100] : [100];
    ex.forEach((m, i) => {
      built.add(m);
      push(`Extract <b>${m}</b>: build the new service with its <b>own data</b>. Sync data from the monolith (CDC or events, through an anti-corruption layer) so both sides agree while traffic shifts.`, 2, m);
      for (const p of steps) {
        if (I === 1 && i === 1 && p === steps[0]) {
          pct[m] = p; push(`Shift <b>${p}%</b> of <code>/${m}</code> to the new service…`, 3, m);
          incidents++; pct[m] = 0;
          push(`…its error rate jumps (a missed edge case in the old code). The facade <b>routes everything back</b> to the monolith in seconds: a config change, not a redeploy. ${R === 0 ? "Only 5% of requests saw errors." : "With big bang, 100% of requests saw errors."}`, 4, m, m);
          push(`Fix, re-test (replay or shadow traffic helps), then try again.`, 4, m);
        }
        pct[m] = p;
        push(p < 100 ? `Shift <b>${p}%</b> of <code>/${m}</code> to the new service and compare error rates and latency with the monolith.` : `<b>100%</b> of <code>/${m}</code> goes to the new service.`, 3, m);
      }
      removed.add(m);
      push(`Delete the <b>${m}</b> code and tables from the monolith. Strangling only pays off when the old code is actually removed.`, 5, m);
    });
    const left = SF_MODULES.filter((m) => !removed.has(m));
    const v = ["done", `${ex.length} module${ex.length > 1 ? "s" : ""} extracted with zero downtime${incidents ? ` and ${incidents} contained incident (${R === 0 ? "5% blast radius" : "100% blast radius"})` : ""}. ${left.length} still live happily in the monolith; you don't have to finish. Stop when the remaining modules don't need independent deployment or scaling.`];
    if (I === 1 && R === 1 && ex.length > 1) v[0] = "warn";
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Result:</b> ${v[1]}`, line: 6 });
    return frames;
  }
  function renderStrangler(f) {
    const nodes = [{ k: "u", x: 50, y: 130, title: "users", w: 74 }], edges = [];
    if (f.facade) { nodes.push({ k: "fa", x: 190, y: 130, title: "facade", sub: "routes by path", w: 120, cls: "accent" }); edges.push({ u: "u", v: "fa", cls: "muted" }); }
    const left = SF_MODULES.filter((m) => !f.removed.includes(m));
    const mh = 48 + left.length * 18, my = 205 + mh / 2;
    nodes.push({ k: "mono", x: 420, y: my, w: 170, h: mh, title: "", sub: "" });
    edges.push({ u: f.facade ? "fa" : "u", v: "mono", cls: "muted", label: f.facade ? "rest" : "" });
    const extra = `<text class="ax-t1" x="420" y="225" text-anchor="middle">monolith</text><text class="ax-t2" x="420" y="240" text-anchor="middle">${left.length} module${left.length === 1 ? "" : "s"}</text>` +
      left.map((m, i) => `<text class="ax-el" x="420" y="${262 + i * 18}" text-anchor="middle">${esc(m)}${f.pct[m] && f.pct[m] < 100 ? ` (${100 - f.pct[m]}%)` : ""}</text>`).join("");
    f.built.forEach((m, i) => {
      const p = f.pct[m];
      nodes.push({ k: `s-${m}`, x: 640, y: 40 + i * 70, w: 150, title: `${m} service`, sub: f.removed.includes(m) ? "100% · old code gone" : `${p}% of /${m}`, cls: f.bad === m ? "bad" : f.removed.includes(m) ? "done" : f.hl === m ? "active" : "path" });
      edges.push({ u: "fa", v: `s-${m}`, cls: f.bad === m ? "bad" : p ? "path" : "muted", dash: !p, label: `/${m}`, ly: -4 });
      if (!f.removed.includes(m)) edges.push({ u: "mono", v: `s-${m}`, cls: "muted", dash: true, label: "data sync", nohead: false, lx: 10, ly: 12 });
    });
    const svg = diagram({ nodes, edges, extra, label: "strangler fig migration" });
    const t = tbl("routes at the facade", ["path", "monolith", "new service"], SF_MODULES.map((m) => ({ c: [`/${m}`, `${100 - f.pct[m]}%`, f.built.includes(m) ? `${f.pct[m]}%` : "–"], cls: f.bad === m ? "bad" : f.removed.includes(m) ? "done" : f.pct[m] ? "active" : "" })));
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}${t}${v}</div>`;
  }
  Viz.register("distributed-architecture-strangler", (host) => Viz.player(host, {
    title: "Strangler fig: migrate a monolith route by route", tag: "PICK MODULES · SHIFT TRAFFIC",
    legend: [["accent", "routing facade"], ["path", "taking some traffic"], ["active", "being extracted"], ["done", "fully migrated"], ["bad", "rolled back"]],
    code: [
      "// keep the monolith running; never stop shipping features",
      "1. facade in front: 100% → monolith",
      "2. build service + own data; sync via CDC/events + ACL",
      "3. shift traffic by route: 5% → 50% → 100%, watch metrics",
      "4. errors? flip the route back (config, not deploy)",
      "5. delete the old module code and tables",
      "repeat for the next module, or stop when it's not worth it",
    ],
    inputs: [
      { key: "order", label: "modules to extract, in order", value: "search; orders; payments", width: 260 },
      { key: "roll", label: "rollout", type: "select", options: SF_ROLL, value: SF_ROLL[0] },
      { key: "inc", label: "incident", type: "select", options: SF_INC, value: SF_INC[1] },
    ],
    random: () => { const a = [...SF_MODULES].sort(() => Math.random() - 0.5).slice(0, 1 + Math.floor(Math.random() * 3)); return { order: a.join("; "), roll: pick(SF_ROLL), inc: pick(SF_INC) }; },
    build: buildStrangler,
    speed: 1300,
    render: renderStrangler,
  }));

  /* ================= distributed-architecture: do you need microservices? ================= */
  const DN_F = [
    { key: "devs", label: "developers on this system", type: "num" },
    { key: "domain", label: "domain boundaries", opts: [["new domain, boundaries still moving", -2], ["known domain, boundaries fairly stable", 0], ["well-understood, stable bounded contexts", 1]] },
    { key: "scale", label: "load profile", opts: [["roughly uniform", -1], ["one hot spot (e.g. search, media)", 1], ["very different per area", 2]] },
    { key: "deploy", label: "release friction", opts: [["teams can release together", -1], ["teams block each other's releases", 1], ["parts need independent release or isolation (compliance)", 2]] },
    { key: "ops", label: "ops maturity", opts: [["manual deploys, little monitoring", -3], ["CI/CD + logs and metrics", 0], ["platform team: CI/CD, tracing, IaC, on-call", 1]] },
    { key: "tx", label: "cross-area transactions", opts: [["many operations span several areas", -2], ["some", 0], ["areas rarely share a transaction", 1]] },
  ];
  const DN_SPECTRUM = [
    { k: "m", title: "monolith", sub: "well-structured" },
    { k: "mm", title: "modular monolith", sub: "enforced modules" },
    { k: "mx", title: "modular monolith", sub: "+ 1–2 extracted services" },
    { k: "ms", title: "microservices", sub: "one per bounded context" },
  ];
  const devPts = (n) => (n <= 8 ? -2 : n <= 25 ? 0 : n <= 60 ? 1 : 2);
  function buildNeed(vals) {
    const n = int(vals.devs, "developers", 1, 2000);
    const rows = [], frames = [];
    let score = 0;
    const where = (s, capped) => { const i = s <= -2 ? 0 : s <= 1 ? 1 : s <= 4 ? 2 : 3; return capped ? Math.min(i, 1) : i; };
    const why = {
      devs: (p) => p < 0 ? "One team can coordinate in a stand-up; the network buys you nothing." : p === 0 ? "A few teams: module ownership inside one deployable usually suffices." : "Many teams: independent deployables start to cut coordination cost (Conway's law).",
      domain: (p) => p < 0 ? "Wrong service boundaries are very expensive to move. Find them inside a monolith first." : p === 0 ? "Boundaries look stable; validate them as modules before you add a network." : "Stable bounded contexts are natural service candidates.",
      scale: (p) => p < 0 ? "Scale the whole thing horizontally; it's cheaper." : p === 1 ? "Extract the hot spot only; leave the rest together." : "Areas with very different resource needs benefit from separate scaling.",
      deploy: (p) => p < 0 ? "A shared release train works fine." : p === 1 ? "Try modules + trunk-based development + feature flags before splitting." : "Independent release or isolation is a genuine reason to split.",
      ops: (p) => p < -1 ? "Microservices without automation and observability is a distributed outage. This caps the answer at a modular monolith." : p === 0 ? "Enough for a few services; tracing will be needed." : "You can afford to operate many services.",
      tx: (p) => p < 0 ? "Splitting these turns each transaction into a saga. Keep them together." : p === 0 ? "Some sagas will be needed; keep tightly coupled areas together." : "Little shared transactional data: easy to give each area its own database.",
    };
    let capped = false;
    const push = (note, line, hl) => frames.push({ rows: [...rows], score, at: where(score, capped), capped, hl, note, line, vars: { score, suggestion: DN_SPECTRUM[where(score, capped)].title + (where(score, capped) === 2 ? " + extracted" : "") } });
    push("Six questions. Each answer moves the needle towards one end of the spectrum. Start in the middle: a modular monolith is the default.", 0);
    DN_F.forEach((q, i) => {
      let ans, p;
      if (q.type === "num") { ans = `${n} developers`; p = devPts(n); }
      else { const o = q.opts.find((x) => x[0] === vals[q.key]); if (!o) throw new Error(`Pick an answer for “${q.label}”.`); [ans, p] = o; }
      score += p;
      if (q.key === "ops" && p <= -3) capped = true;
      rows.push({ c: [q.label, `<span class="wrap">${esc(ans)}</span>`, p > 0 ? `+${p}` : String(p), `<span class="wrap">${esc(why[q.key](p))}</span>`], cls: p > 0 ? "path" : p < 0 ? "visit" : "" });
      push(`<b>${esc(q.label)}:</b> ${esc(ans)} → <b>${p > 0 ? "+" : ""}${p}</b>. ${esc(why[q.key](p))}`, i + 1, i);
    });
    const at = where(score, capped);
    const v = [["done", "A well-structured monolith. One deployable, one database, in-process calls. Keep modules clean so you can split later if it's ever needed."],
      ["done", "A modular monolith: enforced module boundaries, one deployable, one database (schema per module). You get most of the organisational benefit at a fraction of the cost."],
      ["warn", "A modular monolith, plus extracting the one or two areas that really need independent scaling or release. Extract them with the strangler fig pattern."],
      ["warn", "Microservices can pay off here, one per bounded context, each owning its data. Budget for the platform: CI/CD per service, tracing, contract tests, on-call."]][at];
    if (capped && where(score, false) > 1) v[1] += " (Your answers lean further right, but the current ops maturity can't support it yet.)";
    frames.push({ ...frames[frames.length - 1], final: true, verdict: v, note: `<b>Suggestion:</b> ${v[1]}`, line: 7 });
    return frames;
  }
  function renderNeed(f) {
    const nodes = DN_SPECTRUM.map((s, i) => ({ k: s.k, x: 90 + i * 190, y: 60, w: 168, title: s.title, sub: s.sub, cls: i === f.at ? "active" : "", tag: i === f.at ? "you are here" : undefined }));
    const edges = DN_SPECTRUM.slice(1).map((s, i) => ({ u: DN_SPECTRUM[i].k, v: s.k, cls: "muted" }));
    const extra = `<text class="ax-el" x="90" y="112" text-anchor="middle">cheapest to run</text><text class="ax-el" x="660" y="112" text-anchor="middle">most independence, most cost</text>`;
    const svg = diagram({ nodes, edges, extra, label: "architecture spectrum", view: [-6, 10, 762, 112] });
    const t = tbl("your answers", ["question", "answer", "pts", "why"], f.rows, { html: true, cols: "auto minmax(160px, 1.2fr) auto minmax(220px, 2fr)", empty: "no answers yet" });
    const st = stats([["score", String(f.score), f.score > 4 ? "path" : f.score < -1 ? "visit" : ""], ["capped by ops", f.capped ? "yes" : "no", f.capped ? "bad" : ""]]);
    const v = f.verdict ? `<div class="ax-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
    return `<div class="ax-stack">${svg}${st}${t}${v}</div>`;
  }
  Viz.register("distributed-architecture-need", (host) => Viz.player(host, {
    title: "Do you need microservices?", tag: "ANSWER · SEE WHERE YOU LAND",
    legend: [["active", "suggested"], ["path", "pushes towards services"], ["visit", "pushes towards one deployable"], ["bad", "blocker"]],
    code: [
      "score = 0                                   // start at modular monolith",
      "score += teamSize(devs)                     // Conway's law",
      "score += boundaryStability                  // wrong cuts are expensive",
      "score += scalingDifferences",
      "score += releaseFriction",
      "score += opsMaturity                        // blocker if missing",
      "score += transactionalIndependence",
      "→ monolith | modular monolith | + extract 1–2 | microservices",
    ],
    inputs: [
      { key: "devs", label: "developers", value: "12", width: 70 },
      ...DN_F.slice(1).map((q, i) => ({ key: q.key, label: q.label, type: "select", options: q.opts.map((o) => o[0]), value: q.opts[[1, 0, 1, 1, 1][i]][0] })),
    ],
    random: () => ({ devs: pick(["4", "12", "30", "80", "250"]), ...Object.fromEntries(DN_F.slice(1).map((q) => [q.key, pick(q.opts)[0]])) }),
    build: buildNeed,
    speed: 1500,
    render: renderNeed,
  }));

})();
