/* Resilience visualizers. Every registered name is prefixed "resilience-". */
(() => {
  const esc = Viz.esc;

  /* ---------- shared helpers ---------- */
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const num = (s, label, min, max) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const int = (s, label, min, max) => {
    const n = num(s, label, min, max);
    if (!Number.isInteger(n)) throw new Error(`${label}: use a whole number.`);
    return n;
  };
  const ints = (s, label, count, min, max) => {
    const a = String(s).split(/[\s,]+/).filter(Boolean);
    if (a.length !== count) throw new Error(`${label}: give exactly ${count} numbers separated by commas.`);
    return a.map((x) => int(x, label, min, max));
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const pct = (a, b) => (b ? `${Math.round((100 * a) / b)}%` : "–");
  const ms = (v) => (v >= 10000 ? `${+(v / 1000).toFixed(1)} s` : `${Math.round(v)} ms`);
  const kv = (title, rows, o = {}) => `<div class="rs-kv ${o.cls || ""}"><div class="rs-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="rs-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v ?? "")}</span></div>`).join("")
      : `<div class="rs-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="rs-stats">${items.map(([l, v, c]) => `<div class="rs-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;

  /* stacked bar chart. layers: [[values per bar]...], cls per layer, cut: bars >= cut are not drawn yet */
  function stackChart(o) {
    const W = o.w || 600, H = o.h || 160, pl = 44, pr = 12, pt = 24, pb = 22;
    const yLabW = o.yLabel ? 10 + o.yLabel.length * 5.6 : 0;
    const n = o.layers[0].length, bw = (W - pl - pr) / n, ih = H - pt - pb;
    const raw = Math.max(1e-9, o.ymax), mag = Math.pow(10, Math.floor(Math.log10(raw / 5)));
    const step = [1, 2, 2.5, 5, 10, 20].map((m) => m * mag).find((m) => raw / m <= 5 + 1e-9 && (m % 1 === 0 || raw < 5)) || 20 * mag;
    const ymax = Math.ceil(raw / step - 1e-9) * step;
    const y = (v) => pt + ih - (Math.min(v, ymax) / ymax) * ih;
    const fy = o.fmtY || ((v) => (v >= 1000 ? `${+(v / 1000).toFixed(v >= 10000 ? 0 : 1)}k` : `${+v.toFixed(v < 10 && v % 1 ? 1 : 0)}`));
    let s = `<svg class="rs-chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label)}">`;
    for (let v = 0; v <= ymax + 1e-9; v += step) {
      const yy = y(v);
      s += `<line class="grid" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="ax" x="${pl - 5}" y="${yy + 3.5}" text-anchor="end">${esc(fy(v))}</text>`;
    }
    const cut = o.cut ?? n;
    for (let i = 0; i < Math.min(n, cut); i++) {
      let base = 0;
      o.layers.forEach((L, li) => {
        const v = L[i];
        if (!(v > 0)) return;
        const y1 = y(base + v), y0 = y(base);
        s += `<rect class="bar ${o.cls[li]}" x="${(pl + i * bw + 0.4).toFixed(1)}" y="${y1.toFixed(1)}" width="${Math.max(0.8, bw - 0.8).toFixed(1)}" height="${Math.max(0.6, y0 - y1).toFixed(1)}"/>`;
        base += v;
      });
    }
    (o.lines || []).forEach((ln) => {
      const pts = ln.values.slice(0, Math.min(n, cut)).map((v, i) => `${(pl + (i + 0.5) * bw).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
      if (pts) s += `<polyline class="ln ${ln.cls || ""}" points="${pts}"/>`;
    });
    if (o.cap !== undefined) {
      const yy = y(o.cap);
      s += `<line class="cap" x1="${pl}" x2="${W - pr}" y1="${yy}" y2="${yy}"/><text class="capt" x="${W - pr - 4}" y="${yy - 4}" text-anchor="end">${esc(o.capLabel || "")}</text>`;
    }
    (o.bands || []).forEach((b) => {
      const x0 = pl + b.from * bw, x1 = pl + b.to * bw;
      s += `<rect class="band ${b.cls || ""}" x="${x0.toFixed(1)}" y="${pt}" width="${Math.max(0, x1 - x0).toFixed(1)}" height="${ih}"/>`;
      if (b.label) s += `<text class="bandt" x="${Math.max(x0 + 3, yLabW).toFixed(1)}" y="${pt - 6}">${esc(b.label)}</text>`;
    });
    if (cut < n) { const x = pl + cut * bw; s += `<line class="now" x1="${x}" x2="${x}" y1="${pt}" y2="${pt + ih}"/>`; }
    (o.xTicks || []).forEach(({ i, label }) => { s += `<text class="ax" x="${pl + i * bw}" y="${H - 6}" text-anchor="middle">${esc(label)}</text>`; });
    if (o.yLabel) s += `<text class="ax" x="4" y="${pt - 6}">${esc(o.yLabel)}</text>`;
    return s + "</svg>";
  }

  /* =====================================================================
   * 1. Cascading failure: one slow dependency eats the whole worker pool
   * ===================================================================== */
  const CS_STRAT = ["no timeout, shared pool", "timeout only", "bulkhead only", "timeout + bulkhead"];

  function cascadeSim(o) {
    const si = CS_STRAT.indexOf(o.strategy), useTimeout = si === 1 || si === 3, useBulk = si >= 2;
    const TICK = 100, T = o.dur * 10, lam = o.rps / 10, pB = o.pB / 100;
    let jobs = [], acc = 0;
    const rng = mulberry(7);
    const sec = Array.from({ length: o.dur }, () => ({ okO: 0, rejO: 0, okB: 0, fastB: 0, slowB: 0, rejB: 0, busyB: 0, busyO: 0, n: 0 }));
    const snaps = [], tot = { okO: 0, rejO: 0, okB: 0, fastB: 0, slowB: 0, rejB: 0 };
    const first = {};
    for (let t = 0; t < T; t++) {
      acc += lam;
      const n = Math.floor(acc + 1e-9);
      acc -= n;
      const s = Math.floor(t / 10), S = sec[s];
      const times = Array.from({ length: n }, () => t * TICK + rng() * TICK).sort((x, y) => x - y);
      for (const at of times) {
        jobs = jobs.filter((j) => j.end > at);
        const isB = rng() < pB;
        const inB = jobs.filter((j) => j.kind !== "o").length;
        if (isB && useBulk && inB >= o.bulk) { S.fastB++; tot.fastB++; first.bulk ??= s; continue; }
        if (jobs.length >= o.workers) {
          if (isB) { S.rejB++; tot.rejB++; } else { S.rejO++; tot.rejO++; first.rejO ??= s; }
          first.full ??= s;
          continue;
        }
        if (!isB) { jobs.push({ end: at + 50, kind: "o" }); S.okO++; tot.okO++; continue; }
        const hung = at >= o.from * 1000 && at < o.to * 1000;
        let d = hung ? o.hang * 1000 : 100, outcome = hung ? "slow" : "ok";
        if (useTimeout && d > o.timeout) { d = o.timeout; outcome = "fast"; first.timeout ??= s; }
        jobs.push({ end: at + d, kind: hung ? "h" : "b" });
        if (outcome === "ok") { S.okB++; tot.okB++; } else if (outcome === "fast") { S.fastB++; tot.fastB++; } else { S.slowB++; tot.slowB++; }
      }
      const endMs = (t + 1) * TICK;
      jobs = jobs.filter((j) => j.end > endMs);
      S.busyB += jobs.filter((j) => j.kind !== "o").length; S.busyO += jobs.filter((j) => j.kind === "o").length; S.n++;
      if (t % 10 === 9) snaps.push({ h: jobs.filter((j) => j.kind === "h").length, b: jobs.filter((j) => j.kind === "b").length, o: jobs.filter((j) => j.kind === "o").length, tot: { ...tot } });
    }
    return { o, si, sec, snaps, first, useTimeout, useBulk };
  }

  function cascadeFrames(o) {
    const sim = cascadeSim(o), frames = [], hold = sim.useTimeout ? Math.min(o.hang * 1000, o.timeout) / 1000 : o.hang;
    const lamB = (o.rps * o.pB) / 100, need = lamB * hold;
    const base = sim.si === 0 ? 1 : sim.si === 1 ? 3 : sim.si === 2 ? 5 : [3, 5];
    for (let s = 0; s < o.dur; s++) {
      const S = sim.sec[s], snap = sim.snaps[s], msgs = [];
      let line = base;
      if (s === 0) msgs.push(`${o.rps} req/s arrive; ${o.pB}% of them call dependency B, the rest are local work (50 ms). The pool has <b>${o.workers}</b> workers. B is healthy (100 ms) until t=${o.from} s.`);
      if (s === o.from) { msgs.push(`<b>B starts hanging</b>: each call now takes ${o.hang} s before it errors. Little's law: workers held by B = arrival rate × hold time = ${lamB} /s × ${+hold.toFixed(2)} s = <b>${Math.round(need)}</b>${sim.useBulk ? `, but the bulkhead caps B at ${o.bulk}` : ""}.`); line = 1; }
      if (sim.first.timeout === s) { msgs.push(`The ${o.timeout} ms timeout fires: the worker is released and the caller gets a fast error instead of waiting ${o.hang} s.`); line = 3; }
      if (sim.first.bulk === s) { msgs.push(`The bulkhead is full (${o.bulk} calls to B in flight). New B calls are <b>rejected immediately</b>, so B can never take more than ${o.bulk} of the ${o.workers} workers.`); line = 5; }
      if (sim.first.full === s) { msgs.push(`<b>The pool is exhausted.</b> Every worker is busy, ${snap.h + snap.b} of them waiting on B.`); line = sim.useTimeout ? 3 : 1; }
      if (sim.first.rejO === s) msgs.push(`Requests that <b>never touch B</b> are now rejected too. That is the cascade: a failure in B became an outage of this whole service.`);
      if (s === o.to) msgs.push(`B recovers at t=${o.to} s, but calls that started hanging before then still hold their workers for up to ${o.hang} s.`);
      if (!msgs.length) {
        const oTot = S.okO + S.rejO;
        msgs.push(S.rejO ? `Second ${s}: ${S.rejO} of ${oTot} local requests rejected (${pct(S.rejO, oTot)}) because no worker was free.` :
          S.slowB || S.fastB ? `Second ${s}: local requests are fine (${S.okO} ok). B calls are failing, but the failure is contained.` : `Second ${s}: everything is healthy.`);
        if (S.rejO) line = 7;
      }
      frames.push({ sim, s, snap, note: msgs.join(" "), line,
        vars: { t: `${s + 1} s`, busy: `${snap.h + snap.b + snap.o} / ${o.workers}`, "held by B": snap.h + snap.b, "B hold time": `${+hold.toFixed(2)} s`, "local ok": pct(snap.tot.okO, snap.tot.okO + snap.tot.rejO) } });
    }
    return frames;
  }

  Viz.register("resilience-cascade", (el) => Viz.player(el, {
    title: "Cascading failure: a slow dependency drains the worker pool",
    tag: "SIMULATION · 100 ms TICKS",
    legend: [["bad", "worker waiting on hung B"], ["path", "worker calling healthy B"], ["done", "worker doing local work"], ["visit", "fast failure (timeout or bulkhead)"]],
    code: [
      "// 1. no timeout: a hung call pins a worker",
      "var r = await http.GetAsync(bUrl);",
      "// 2. timeout: give up and free the worker",
      "http.Timeout = TimeSpan.FromSeconds(1);",
      "// 3. bulkhead: B may hold at most 10 workers",
      "pipeline.AddConcurrencyLimiter(10, queueLimit: 0);",
      "// local endpoint: never calls B",
      "app.MapGet(\"/local\", () => LocalWork());",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "strategy", label: "protection", type: "select", value: CS_STRAT[0], options: CS_STRAT },
      { key: "workers", label: "workers", value: "40", width: 56 },
      { key: "rps", label: "req/s", value: "200", width: 56 },
      { key: "pB", label: "% calling B", value: "20", width: 56 },
      { key: "hang", label: "B hangs for s", value: "30", width: 56 },
      { key: "timeout", label: "timeout ms", value: "1000", width: 64 },
      { key: "bulk", label: "bulkhead", value: "10", width: 56 },
      { key: "window", label: "B down from,to s", value: "10,40", width: 70 },
    ],
    random: () => ({ strategy: pick(CS_STRAT), workers: String(pick([20, 40, 60, 100])), rps: String(Viz.rand(5, 30) * 10), pB: String(Viz.rand(1, 6) * 5), hang: pick(["10", "30", "60"]),
      timeout: pick(["250", "500", "1000", "2000"]), bulk: String(Viz.rand(2, 15)), window: pick(["10,40", "5,20", "15,45", "20,30"]) }),
    build: (v) => {
      const [from, to] = ints(v.window, "B down from,to", 2, 0, 60);
      if (to <= from) throw new Error("B down from,to: the end must be after the start.");
      const o = { strategy: v.strategy, workers: int(v.workers, "Workers", 4, 200), rps: int(v.rps, "Req/s", 10, 400), pB: int(v.pB, "% calling B", 1, 100), hang: int(v.hang, "Hang", 1, 120),
        timeout: int(v.timeout, "Timeout", 50, 30000), bulk: int(v.bulk, "Bulkhead", 1, 200), from, to, dur: 60 };
      if (!CS_STRAT.includes(o.strategy)) throw new Error("Pick a protection from the list.");
      if (o.bulk > o.workers) throw new Error("Bulkhead: keep it at or below the pool size, or it protects nothing.");
      return cascadeFrames(o);
    },
    speed: 700,
    render(f) {
      const { sim, s, snap } = f, o = sim.o;
      const cells = [];
      for (let i = 0; i < o.workers; i++) cells.push(i < snap.h ? "bad" : i < snap.h + snap.b ? "path" : i < snap.h + snap.b + snap.o ? "done" : "");
      const pool = `<div class="rs-pool" style="--cols:${Math.min(20, o.workers)}">${cells.map((c) => `<i class="${c}"></i>`).join("")}</div>`;
      const busyB = sim.sec.map((S) => S.busyB / S.n), busyO = sim.sec.map((S) => S.busyO / S.n);
      const xt = [0, 10, 20, 30, 40, 50, 60].map((i) => ({ i, label: `${i}s` }));
      const band = [{ from: o.from, to: Math.min(o.to, o.dur), cls: "down", label: "B hangs" }];
      const c1 = stackChart({ label: "workers in use", w: 560, h: 140, layers: [busyB, busyO], cls: ["bad", "done"], cut: s + 1, ymax: o.workers * 1.15, cap: o.workers, capLabel: `pool = ${o.workers}`, bands: band, xTicks: xt, yLabel: "workers" });
      const okL = [], fastL = [], slowL = [], rejL = [];
      sim.sec.forEach((S) => { const t = S.okO + S.rejO + S.okB + S.fastB + S.slowB + S.rejB || 1; okL.push((100 * (S.okO + S.okB)) / t); fastL.push((100 * S.fastB) / t); slowL.push((100 * S.slowB) / t); rejL.push((100 * (S.rejO + S.rejB)) / t); });
      const c2 = stackChart({ label: "outcomes per second", w: 560, h: 120, layers: [okL, fastL, slowL, rejL], cls: ["done", "visit", "active", "bad"], cut: s + 1, ymax: 100, fmtY: (v) => `${Math.round(v)}%`, bands: band.map((b) => ({ ...b, label: "" })), xTicks: xt, yLabel: "outcome %" });
      const t = snap.tot;
      return `<div class="rs-fit">${c1}</div><div class="rs-fit">${c2}</div>` + Viz.row(Viz.labeled(`worker pool at t=${s + 1} s`, pool), stats([
        ["local ok", pct(t.okO, t.okO + t.rejO), t.rejO ? "bad" : "done"], ["local rejected", t.rejO, t.rejO ? "bad" : ""], ["B ok", t.okB, "done"], ["B failed fast", t.fastB, "visit"], ["B failed slowly", t.slowB, t.slowB ? "active" : ""], ["B rejected", t.rejB, t.rejB ? "bad" : ""]]));
    },
  }));

  /* =====================================================================
   * 2. Deadlines: per-hop timeouts vs one propagated budget
   * ===================================================================== */
  const DL_MODES = ["fixed per-hop timeouts", "propagated deadline"];
  const DL_SVC = ["client", "gateway", "orders", "payments"];

  function deadlineSim(o) {
    const prop = o.mode === DL_MODES[1], D = o.budget, iv = [], ev = [], marks = [];
    const add = (svc, a, b, kind, useless) => {
      if (b <= a) return;
      if (useless < b) { if (useless > a) iv.push({ svc, a, b: useless, kind }); iv.push({ svc, a: Math.max(a, useless), b, kind: "waste" }); }
      else iv.push({ svc, a, b, kind });
    };
    const call = (i, t, cancelAt, useless) => {
      const name = DL_SVC[i];
      if (prop && D - t < o.minB) {
        ev.push({ t, line: 3, text: `<b>${name}</b> receives the request with ${Math.max(0, Math.round(D - t))} ms of budget left, under its ${o.minB} ms minimum. It <b>fails fast</b> with 504 instead of starting work it cannot finish.` });
        marks.push({ svc: i, t, kind: "ff" });
        return { resp: t, ok: false };
      }
      if (i === 3) {
        const end = t + o.work[2];
        if (cancelAt < end) {
          add(i, t, cancelAt, "work", useless);
          ev.push({ t: cancelAt, line: 6, text: `The context is cancelled, so <b>payments stops working</b> at ${Math.round(cancelAt)} ms instead of grinding on until ${Math.round(end)} ms.` });
          marks.push({ svc: i, t: cancelAt, kind: "cancel" });
          return { resp: Infinity, ok: false };
        }
        add(i, t, end, "work", useless);
        ev.push({ t, line: 4, text: `<b>payments</b> starts its ${o.work[2]} ms of work.` });
        ev.push({ t: end, line: 4, text: useless < end ? `<b>payments</b> finishes at ${Math.round(end)} ms and sends a response <b>nobody is waiting for</b>: the result became useless at ${Math.round(useless)} ms, when a caller upstream gave up. All the work after that was wasted.` : `<b>payments</b> finishes and responds.` });
        return { resp: end, ok: true };
      }
      const pre = o.work[i - 1], s = t + pre;
      if (cancelAt < s) { add(i, t, cancelAt, "work", useless); marks.push({ svc: i, t: cancelAt, kind: "cancel" }); return { resp: Infinity, ok: false }; }
      add(i, t, s, "work", useless);
      const hop = o.hop[i - 1], to = prop ? Math.min(hop, D - s) : hop, g = s + to;
      ev.push({ t: s, line: prop ? 5 : 8, text: prop ? `<b>${name}</b> calls ${DL_SVC[i + 1]} with timeout = min(own ${hop} ms, remaining ${Math.round(D - s)} ms) = <b>${Math.round(to)} ms</b>, and passes the deadline along.` : `<b>${name}</b> calls ${DL_SVC[i + 1]} with its own fixed ${hop} ms timeout. It has no idea how long its caller is willing to wait.` });
      const child = call(i + 1, s + o.net, prop ? Math.min(cancelAt, g) : Infinity, Math.min(useless, g));
      const r = child.resp + o.net;
      const stop = Math.min(r, g, cancelAt);
      add(i, s, stop, "wait", useless);
      if (cancelAt <= Math.min(r, g)) {
        ev.push({ t: cancelAt, line: 6, text: `<b>${name}</b> is cancelled with the same context and stops waiting.` });
        marks.push({ svc: i, t: cancelAt, kind: "cancel" });
        return { resp: Infinity, ok: false };
      }
      if (r > g) {
        ev.push({ t: g, line: prop ? 6 : 8, text: `<b>${name}</b> times out after ${Math.round(to)} ms and returns an error.${prop ? ` Cancelling its context <b>also cancels the work downstream</b>.` : ` ${DL_SVC[i + 1]} is <b>not told</b>, and keeps working.`}` });
        marks.push({ svc: i, t: g, kind: "giveup" });
        return { resp: g, ok: false };
      }
      if (!child.ok) { ev.push({ t: r, line: 7, text: `<b>${name}</b> gets an error back and passes it up.` }); return { resp: r, ok: false }; }
      add(i, r, r + 50, "work", useless);
      ev.push({ t: r + 50, line: 7, text: useless < r + 50 ? `<b>${name}</b> finishes its post-processing and responds, again to no one: wasted too.` : `<b>${name}</b> gets its response, does 50 ms of post-processing and responds.` });
      return { resp: r + 50, ok: true };
    };
    const child = call(1, o.net, prop ? D : Infinity, D);
    const r = child.resp + o.net, gaveUp = r > D;
    add(0, 0, Math.min(r, D), "wait", Infinity);
    ev.push({ t: 0, line: prop ? 0 : 8, text: `The client sends the request with a <b>${D} ms</b> budget${prop ? " and puts the deadline on the request (grpc-timeout header, or the context in Go)" : ""}.` });
    if (gaveUp) { ev.push({ t: D, line: prop ? 6 : 8, text: `The <b>client gives up</b> at ${D} ms. The user sees an error.` }); marks.push({ svc: 0, t: D, kind: "giveup" }); }
    else ev.push({ t: r, line: 7, text: child.ok ? `The client gets <b>200 OK</b> after ${Math.round(r)} ms.` : `The client gets a fast error after ${Math.round(r)} ms and can show a fallback right away.` });
    const waste = iv.filter((x) => x.kind === "waste").reduce((a, x) => a + x.b - x.a, 0);
    const end = Math.max(D, ...iv.map((x) => x.b), ...marks.map((m) => m.t));
    return { o, prop, iv, ev, marks, waste, end, result: gaveUp ? "timeout" : child.ok ? "200 OK" : "fast error", rt: gaveUp ? D : r };
  }

  function deadlineFrames(o) {
    const sim = deadlineSim(o), byT = new Map();
    sim.ev.forEach((e) => { const k = Math.round(e.t); if (!byT.has(k)) byT.set(k, []); byT.get(k).push(e); });
    const ts = [...byT.keys()].sort((a, b) => a - b);
    return ts.map((t) => {
      const es = byT.get(t), wasteNow = sim.iv.filter((x) => x.kind === "waste" && x.a < t).reduce((a, x) => a + Math.min(t, x.b) - x.a, 0);
      return { sim, now: t, note: `<b>t = ${t} ms.</b> ` + es.map((e) => e.text).join(" "), line: es[es.length - 1].line,
        vars: { t: `${t} ms`, mode: sim.prop ? "deadline" : "per-hop", "client budget": `${o.budget} ms`, remaining: `${Math.max(0, o.budget - t)} ms`, "wasted so far": `${Math.round(wasteNow)} ms` } };
    });
  }

  function gantt(sim, now) {
    const W = 600, lh = 34, top = 24, left = 78, right = 14, n = DL_SVC.length, H = top + n * lh + 26;
    const end = sim.end * 1.04, x = (t) => left + (Math.min(t, end) / end) * (W - left - right);
    let s = `<svg class="rs-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="timeline of each service">`;
    DL_SVC.forEach((nm, i) => { const y = top + i * lh; s += `<text class="lane" x="${left - 8}" y="${y + lh / 2 + 4}" text-anchor="end">${nm}</text><line class="grid" x1="${left}" x2="${W - right}" y1="${y + lh}" y2="${y + lh}"/>`; });
    const step = end > 8000 ? 2000 : end > 4000 ? 1000 : end > 1600 ? 500 : 200;
    for (let t = 0; t <= end; t += step) s += `<text class="ax" x="${x(t)}" y="${H - 6}" text-anchor="middle">${t >= 1000 ? `${t / 1000}s` : `${t}`}</text>`;
    sim.iv.forEach((v) => {
      if (v.a >= now) return;
      const b = Math.min(v.b, now), y = top + v.svc * lh, h = v.kind === "wait" ? 8 : 18, yy = y + (lh - h) / 2;
      s += `<rect class="iv ${v.kind}" x="${x(v.a).toFixed(1)}" y="${yy}" width="${Math.max(1, x(b) - x(v.a)).toFixed(1)}" height="${h}" rx="3"/>`;
    });
    sim.marks.forEach((m) => {
      if (m.t > now) return;
      const cx = x(m.t), cy = top + m.svc * lh + lh / 2;
      s += m.kind === "giveup" ? `<text class="mk bad" x="${cx}" y="${cy + 5}" text-anchor="middle">✖</text>` : m.kind === "ff" ? `<text class="mk ff" x="${cx + 2}" y="${cy + 5}">504 fast</text>` : `<text class="mk cancel" x="${cx}" y="${cy + 5}" text-anchor="middle">⊘</text>`;
    });
    s += `<line class="dl" x1="${x(sim.o.budget)}" x2="${x(sim.o.budget)}" y1="${top - 6}" y2="${top + n * lh}"/><text class="dlt" x="${x(sim.o.budget) + 4}" y="${top - 9}">client deadline ${sim.o.budget} ms</text>`;
    s += `<line class="now" x1="${x(now)}" x2="${x(now)}" y1="${top}" y2="${top + n * lh}"/>`;
    return s + "</svg>";
  }

  Viz.register("resilience-deadline", (el) => Viz.player(el, {
    title: "Deadline propagation: who is still working after the user gave up?",
    tag: "SIMULATION · EVENT BY EVENT",
    legend: [["done", "doing work"], ["visit", "waiting on a downstream call"], ["bad", "wasted: the caller already gave up"]],
    code: [
      "ctx := r.Context() // has the caller's deadline",
      "dl, ok := ctx.Deadline()",
      "if ok && time.Until(dl) < minBudget {",
      "    return errBudgetSpent // fail fast: 504",
      "}",
      "ctx, cancel := context.WithTimeout(ctx, hop)",
      "defer cancel() // timeout = min(deadline, hop)",
      "resp, err := next.Call(ctx, req) // cancellable",
      "// fixed mode: Call(context.Background(), req)",
    ],
    codeLang: "go",
    inputs: [
      { key: "mode", label: "mode", type: "select", value: DL_MODES[0], options: DL_MODES },
      { key: "budget", label: "client budget ms", value: "2000", width: 64 },
      { key: "hop", label: "hop timeouts gw,orders", value: "3000,3000", width: 90 },
      { key: "work", label: "work ms gw,orders,pay", value: "100,300,2500", width: 110 },
      { key: "net", label: "network ms", value: "20", width: 50 },
      { key: "minB", label: "min budget ms", value: "100", width: 56 },
    ],
    random: () => ({ mode: pick(DL_MODES), budget: String(Viz.rand(8, 30) * 100), hop: `${Viz.rand(5, 40) * 100},${Viz.rand(5, 40) * 100}`, work: `${Viz.rand(1, 5) * 50},${Viz.rand(1, 8) * 50},${Viz.rand(2, 40) * 100}`, net: String(Viz.rand(1, 5) * 10), minB: pick(["50", "100", "200"]) }),
    build: (v) => {
      const o = { mode: v.mode, budget: int(v.budget, "Client budget", 100, 20000), hop: ints(v.hop, "Hop timeouts", 2, 50, 30000), work: ints(v.work, "Work", 3, 0, 20000), net: int(v.net, "Network", 0, 500), minB: int(v.minB, "Min budget", 0, 5000) };
      if (!DL_MODES.includes(o.mode)) throw new Error("Pick a mode from the list.");
      return deadlineFrames(o);
    },
    speed: 1500,
    render(f) {
      const sim = f.sim, w = sim.iv.filter((x) => x.kind === "waste" && x.a < f.now).reduce((a, x) => a + Math.min(f.now, x.b) - x.a, 0);
      const done = f.now >= Math.round(sim.rt);
      return `<div class="rs-fit">${gantt(sim, f.now + 0.5)}</div>` + stats([
        ["client sees", done ? sim.result : "waiting", done ? (sim.result === "200 OK" ? "done" : sim.result === "timeout" ? "bad" : "visit") : ""],
        ["client waited", done ? ms(sim.rt) : "…"], ["wasted work", ms(w), w ? "bad" : "done"], ["mode", sim.prop ? "deadline" : "per-hop", sim.prop ? "path" : ""]]);
    },
  }));

  /* =====================================================================
   * 3. Backoff and jitter: thundering herd vs spread-out retries
   * ===================================================================== */
  const BK = ["immediate retry", "fixed delay", "exponential, no jitter", "exponential + full jitter", "exponential + equal jitter", "decorrelated jitter"];
  const BK_LINE = [1, 2, 3, 4, 5, [6, 7]];

  function backoffSim(o) {
    const rng = mulberry(o.seed), k = BK.indexOf(o.strategy), RTT = 20, TICK = 100;
    const heap = [];
    const push = (e) => { heap.push(e); let i = heap.length - 1; while (i > 0) { const p = (i - 1) >> 1; if (heap[p].t <= heap[i].t) break; [heap[p], heap[i]] = [heap[i], heap[p]]; i = p; } };
    const pop = () => { const top = heap[0], last = heap.pop(); if (heap.length) { heap[0] = last; let i = 0; for (;;) { const l = 2 * i + 1, r = l + 1; let m = i; if (l < heap.length && heap[l].t < heap[m].t) m = l; if (r < heap.length && heap[r].t < heap[m].t) m = r; if (m === i) break; [heap[m], heap[i]] = [heap[i], heap[m]]; i = m; } } return top; };
    for (let c = 0; c < o.clients; c++) push({ t: rng() * o.spread, c, n: 0, prev: o.base });
    const dots = [], served = new Map(), tick = new Map(), done = Array(o.clients).fill(null);
    const tot = { attempts: 0, ok: 0, down: 0, over: 0, gaveUp: 0 };
    const sleepFor = (n, prev) => {
      const exp = Math.min(o.cap, o.base * 2 ** n);
      switch (k) {
        case 0: return 0;
        case 1: return o.base;
        case 2: return exp;
        case 3: return rng() * exp;
        case 4: return exp / 2 + (rng() * exp) / 2;
        default: return Math.min(o.cap, o.base + rng() * (prev * 3 - o.base));
      }
    };
    while (heap.length) {
      const e = pop();
      if (e.t > 60000) break;
      const b = Math.floor(e.t / TICK), T = tick.get(b) || { ok: 0, down: 0, over: 0 };
      tick.set(b, T); tot.attempts++;
      let res;
      if (e.t < o.outage) res = "down";
      else if ((served.get(b) || 0) < o.capacity) { res = "ok"; served.set(b, (served.get(b) || 0) + 1); }
      else res = "over";
      T[res]++; tot[res]++;
      dots.push({ t: e.t, c: e.c, res });
      if (res === "ok") { done[e.c] = e.t; continue; }
      if (e.n + 1 >= o.max) { tot.gaveUp++; done[e.c] = -e.t; continue; }
      const sl = sleepFor(e.n, e.prev);
      push({ t: e.t + RTT + sl, c: e.c, n: e.n + 1, prev: Math.max(o.base, sl) });
    }
    const last = Math.max(0, ...[...tick.keys()]);
    const series = Array.from({ length: last + 1 }, (_, i) => tick.get(i) || { ok: 0, down: 0, over: 0 });
    const finish = Math.max(0, ...done.filter((x) => x !== null).map(Math.abs));
    return { o, k, series, dots, tot, finish, peak: Math.max(...series.map((x) => x.ok + x.down + x.over)) };
  }

  function backoffFrames(o) {
    const sim = backoffSim(o), n = sim.series.length, step = Math.max(1, Math.ceil(n / 90)), frames = [];
    let shownBack = false, shownSettle = false;
    for (let b = 0; b < n; b += step) {
      const end = Math.min(n, b + step), seg = sim.series.slice(b, end);
      const s = seg.reduce((a, x) => ({ ok: a.ok + x.ok, down: a.down + x.down, over: a.over + x.over }), { ok: 0, down: 0, over: 0 });
      const arr = s.ok + s.down + s.over, cum = sim.dots.filter((d) => d.t < end * 100);
      const okSoFar = cum.filter((d) => d.res === "ok").length;
      let note;
      if (b === 0) note = `${o.clients} clients each send a request in the first ${o.spread} ms, and the dependency is <b>down for ${o.outage} ms</b>. Every attempt fails; what happens next depends only on the backoff formula.`;
      else if (!shownBack && b * 100 >= o.outage) {
        shownBack = true;
        note = `The dependency is back, with capacity for <b>${o.capacity} requests per 100 ms</b>. ${arr} attempts land in this window: ${s.ok} succeed, ${s.over} are rejected as overload.` +
          (sim.k <= 2 ? ` Without jitter the clients are <b>synchronised</b>: they failed together, so they come back together.` : ` Jitter has spread the clients out, so arrivals look like a trickle instead of a wall.`);
      } else if (arr === 0) note = `t=${b * 100} ms: nobody is calling. Every remaining client is sleeping${sim.k === 2 ? ", and they will all wake up at the same moment" : ""}.`;
      else note = `t=${b * 100} ms: ${arr} attempt${arr === 1 ? "" : "s"}, ${s.ok} served, ${s.over + s.down} rejected${s.over > o.capacity ? `: <b>${s.over} wasted calls</b> that only made the overload worse` : ""}.`;
      if (!shownSettle && okSoFar + sim.tot.gaveUp >= o.clients && cum.length === sim.dots.length) { shownSettle = true; note += ` <b>Every client has finished</b> after ${ms(sim.finish)}: ${sim.tot.ok} succeeded, <b>${sim.tot.gaveUp} gave up</b> after ${o.max} attempts, ${sim.tot.attempts} attempts in total (${(sim.tot.attempts / o.clients).toFixed(1)} per client).`; }
      frames.push({ sim, cut: end, note, line: b === 0 ? 0 : BK_LINE[sim.k],
        vars: { t: `${b * 100} ms`, "this window": `${arr} sent / ${s.ok} ok`, "succeeded": `${okSoFar} / ${o.clients}`, "attempts so far": cum.length } });
    }
    return frames;
  }

  Viz.register("resilience-backoff", (el) => Viz.player(el, {
    title: "Backoff and jitter: the thundering herd vs a spread-out retry",
    tag: "SIMULATION · EVENT-DRIVEN, 100 ms WINDOWS",
    legend: [["done", "served"], ["bad", "failed: dependency down"], ["visit", "rejected: over capacity"]],
    code: [
      "// n = retries so far; base, cap in ms",
      "immediate:    sleep = 0",
      "fixed:        sleep = base",
      "exponential:  sleep = min(cap, base*2^n)",
      "full jitter:  sleep = rand(0, min(cap, base*2^n))",
      "equal jitter: e=min(cap, base*2^n); e/2+rand(0,e/2)",
      "decorrelated: sleep = min(cap, rand(base, prev*3))",
      "              prev = sleep",
    ],
    codeLang: "typescript",
    inputs: [
      { key: "strategy", label: "backoff", type: "select", value: BK[2], options: BK },
      { key: "clients", label: "clients", value: "200", width: 56 },
      { key: "outage", label: "outage ms", value: "1000", width: 60 },
      { key: "capacity", label: "capacity / 100 ms", value: "20", width: 56 },
      { key: "base", label: "base ms", value: "100", width: 56 },
      { key: "cap", label: "cap ms", value: "10000", width: 64 },
      { key: "max", label: "max attempts", value: "10", width: 50 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ strategy: pick(BK), clients: String(Viz.rand(5, 40) * 10), outage: String(Viz.rand(2, 30) * 100), capacity: String(Viz.rand(5, 40)), base: pick(["50", "100", "200"]), cap: pick(["2000", "5000", "10000", "20000"]), max: String(Viz.rand(4, 12)), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { strategy: v.strategy, clients: int(v.clients, "Clients", 1, 500), outage: int(v.outage, "Outage", 0, 10000), capacity: int(v.capacity, "Capacity", 1, 200), base: int(v.base, "Base", 10, 2000),
        cap: int(v.cap, "Cap", 10, 30000), max: int(v.max, "Max attempts", 1, 20), seed: int(v.seed, "Seed", 0, 1e6), spread: 100 };
      if (!BK.includes(o.strategy)) throw new Error("Pick a backoff from the list.");
      if (o.cap < o.base) throw new Error("Cap: must be at least the base delay.");
      return backoffFrames(o);
    },
    speed: 450,
    render(f) {
      const sim = f.sim, o = sim.o, n = sim.series.length;
      const xt = []; const every = n > 200 ? 50 : n > 80 ? 20 : n > 30 ? 10 : 5;
      for (let i = 0; i <= n; i += every) xt.push({ i, label: `${(i / 10).toFixed(i % 10 ? 1 : 0)}s` });
      const chart = stackChart({ label: "attempts per 100 ms", w: 600, h: 150, layers: [sim.series.map((x) => x.ok), sim.series.map((x) => x.down), sim.series.map((x) => x.over)], cls: ["done", "bad", "visit"], cut: f.cut,
        ymax: Math.max(o.capacity * 1.5, sim.peak * 1.05), cap: o.capacity, capLabel: `capacity ${o.capacity}`, bands: [{ from: 0, to: Math.min(n, o.outage / 100), cls: "down", label: "down" }], xTicks: xt, yLabel: "attempts" });
      const W = 600, H = 150, pl = 44, pr = 12, tEnd = n * 100;
      const X = (t) => pl + (t / tEnd) * (W - pl - pr), Y = (c) => 8 + (c / Math.max(1, o.clients - 1)) * (H - 20);
      let sc = `<svg class="rs-chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="every attempt by every client"><text class="ax" x="4" y="11">clients</text>`;
      sim.dots.forEach((d) => { if (d.t < f.cut * 100) sc += `<circle class="dot ${d.res === "ok" ? "done" : d.res === "down" ? "bad" : "visit"}" cx="${X(d.t).toFixed(1)}" cy="${Y(d.c).toFixed(1)}" r="1.7"/>`; });
      sc += `<line class="now" x1="${X(f.cut * 100)}" x2="${X(f.cut * 100)}" y1="4" y2="${H - 8}"/></svg>`;
      const t = sim.tot, all = f.cut >= n;
      return `<div class="rs-fit">${chart}</div>` + Viz.labeled("each dot is one attempt (one row per client)", `<div class="rs-fit">${sc}</div>`) + stats([
        ["total attempts", all ? t.attempts : "…"], ["per client", all ? (t.attempts / o.clients).toFixed(1) : "…"], ["wasted (rejected)", all ? t.down + t.over : "…", "visit"], ["gave up", all ? t.gaveUp : "…", t.gaveUp && all ? "bad" : ""], ["succeeded", all ? `${t.ok} / ${o.clients}` : "…", "done"], ["all finished after", all ? ms(sim.finish) : "…"], ["peak / 100 ms", sim.peak]]);
    },
  }));

  /* =====================================================================
   * 4. Retry amplification across layers
   * ===================================================================== */
  const AM_MODES = ["every layer retries", "only the edge retries", "only the last hop retries", "every layer + retry budget"];

  function amplifySim(o) {
    const rng = mulberry(o.seed), mi = AM_MODES.indexOf(o.mode), L = o.layers;
    const tries = (k) => (mi === 0 || mi === 3 ? o.attempts : mi === 1 ? (k === 0 ? o.attempts : 1) : k === L - 1 ? o.attempts : 1);
    const MAXT = 10, tokens = Array(L).fill(MAXT);
    const run = (rec) => {
      const calls = Array(L).fill(0);
      const go = (k) => {
        const node = rec ? { k, kids: [] } : null;
        for (let a = 0; a < tries(k); a++) {
          if (a > 0 && mi === 3 && tokens[k] <= MAXT / 2) { if (node) node.throttled = true; break; }
          calls[k]++;
          let ok, child = null;
          if (k === L - 1) ok = rng() >= o.p;
          else { child = go(k + 1); ok = child.ok; }
          if (mi === 3) tokens[k] = ok ? Math.min(MAXT, tokens[k] + 0.1) : Math.max(0, tokens[k] - 1);
          if (node) node.kids.push(child ? child.node : { leaf: true, ok });
          if (ok) return { ok: true, node };
        }
        return { ok: false, node };
      };
      const r = go(0);
      return { ok: r.ok, tree: r.node, calls, tokens: tokens.slice() };
    };
    const samplesAt = new Set([1, 2, 3, 10, 100, 1000]), samples = [];
    const N = 2000, sum = Array(L).fill(0);
    let okN = 0;
    for (let i = 1; i <= N; i++) {
      const r = run(samplesAt.has(i));
      r.calls.forEach((c, k) => { sum[k] += c; });
      if (r.ok) okN++;
      if (samplesAt.has(i)) samples.push({ i, ...r });
    }
    let q = o.p, exact = 1;
    for (let k = L - 1; k >= 0; k--) { const a = tries(k); exact *= q >= 1 ? a : (1 - q ** a) / (1 - q); q = q ** a; }
    return { o, mi, samples, mean: sum.map((x) => x / N), okRate: okN / N, exact: mi === 3 ? null : exact, exactOk: mi === 3 ? null : 1 - q, worst: Array.from({ length: L }, (_, k) => tries(k)).reduce((a, b) => a * b, 1) };
  }

  function amplifyFrames(o) {
    const sim = amplifySim(o), frames = [], L = o.layers, leafName = "database";
    const names = ["edge", "svc A", "svc B", "svc C"].slice(0, L);
    frames.push({ sim, sample: null, line: [0, 6], note: `A request crosses ${L} layer${L > 1 ? "s" : ""} (${names.join(" → ")}) before it reaches the ${leafName}. Each failed call is retried up to ${o.attempts} attempts per layer${sim.mi === 0 || sim.mi === 3 ? "" : sim.mi === 1 ? ", but <b>only at the edge</b>" : ", but <b>only at the last hop</b>"}. Worst case, one user click becomes <b>${sim.worst}</b> calls on the ${leafName}.`,
      vars: { layers: L, "attempts/layer": o.attempts, "leaf failure": `${Math.round(o.p * 100)}%`, "worst case": `${sim.worst}×` } });
    sim.samples.forEach((smp) => {
      const leaf = smp.calls[L - 1];
      let note = `<b>Request #${smp.i}</b>: the ${leafName} received <b>${leaf}</b> call${leaf > 1 ? "s" : ""} for one logical request, and the user saw ${smp.ok ? "<b>success</b>" : "<b>an error</b>"}.`;
      if (sim.mi === 3) note += ` Retry tokens per layer: ${smp.tokens.map((x) => x.toFixed(1)).join(", ")} (retries stop while a layer has ≤ 5 of 10).`;
      else if (leaf === sim.worst && sim.worst > 1) note += ` Every layer exhausted its attempts, and each attempt of an outer layer re-ran all the attempts of the inner one: ${Array(L).fill(o.attempts).join(" × ")}.`;
      frames.push({ sim, sample: smp, line: sim.mi === 3 ? [4, 8] : [3, 4], note, vars: { request: `#${smp.i}`, "leaf calls": leaf, result: smp.ok ? "ok" : "error", ...(sim.mi === 3 ? { tokens: smp.tokens.map((x) => x.toFixed(1)).join(" / ") } : {}) } });
    });
    const amp = sim.mean[L - 1];
    frames.push({ sim, sample: null, summary: true, line: sim.mi === 0 ? 6 : 7,
      note: `<b>2,000 requests later</b>: the ${leafName} saw on average <b>${amp.toFixed(2)}</b> calls per logical request${sim.exact !== null ? ` (exact expectation ${sim.exact.toFixed(2)})` : ""}, and ${(sim.okRate * 100).toFixed(1)}% of users succeeded. ${amp > 3 && o.p > 0.5 ? "When the leaf is sick, retries multiply load on exactly the component that can least afford it." : sim.mi === 3 ? "The budget keeps retries to a small fraction of traffic once failures pile up, so a hard outage costs about 1× load, not the worst case." : "Retrying at one layer bounds the extra load to that layer's attempts."}`,
      vars: { "mean leaf calls": amp.toFixed(2), "exact": sim.exact !== null ? sim.exact.toFixed(2) : "n/a", "success": `${(sim.okRate * 100).toFixed(1)}%`, "worst case": `${sim.worst}×` } });
    return frames;
  }

  function treeHtml(node, L) {
    const rows = Array.from({ length: L }, () => []);
    const walk = (n) => {
      const grp = n.kids.map((c) => (c.leaf ? (c.ok ? "done" : "bad") : (c.kids.some((g) => g.leaf ? g.ok : false) || subOk(c) ? "done" : "bad")));
      rows[n.k].push({ grp, throttled: n.throttled });
      n.kids.forEach((c) => { if (!c.leaf) walk(c); });
    };
    const subOk = (n) => n.kids.some((c) => (c.leaf ? c.ok : subOk(c)));
    walk(node);
    return `<div class="rs-tree">${rows.map((r, k) => `<div class="rs-tree-row"><span class="rs-tree-l">${k === L - 1 ? "→ database" : `→ layer ${k + 2}`}</span><div class="rs-tree-cells">${r.map((g) => `<span class="rs-grp">${g.grp.map((c) => `<i class="${c}"></i>`).join("")}${g.throttled ? '<i class="thr" title="retry refused by budget"></i>' : ""}</span>`).join("")}</div><b>${r.reduce((a, g) => a + g.grp.length, 0)}</b></div>`).join("")}</div>`;
  }

  Viz.register("resilience-amplify", (el) => Viz.player(el, {
    title: "Retry amplification: retries at every layer multiply",
    tag: "MONTE CARLO · 2,000 REQUESTS",
    legend: [["done", "call succeeded"], ["bad", "call failed"], ["visit", "retry refused by the budget"]],
    code: [
      "// edge → A → B → database; each hop runs this",
      "for (var attempt = 1; ; attempt++) {",
      "    try { return await next(); }",
      "    catch when (attempt < maxAttempts",
      "             && budget.TryAcquireRetry()) { }",
      "}",
      "// worst case = maxAttempts ^ layers",
      "// fix: retry at ONE layer, fail fast elsewhere",
      "// or: a retry budget (gRPC retryThrottling)",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "mode", label: "who retries", type: "select", value: AM_MODES[0], options: AM_MODES },
      { key: "layers", label: "layers", value: "3", width: 44 },
      { key: "attempts", label: "attempts / layer", value: "3", width: 44 },
      { key: "p", label: "leaf failure %", value: "100", width: 50 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ mode: pick(AM_MODES), layers: String(Viz.rand(1, 4)), attempts: String(Viz.rand(1, 4)), p: pick(["10", "30", "50", "80", "100"]), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { mode: v.mode, layers: int(v.layers, "Layers", 1, 4), attempts: int(v.attempts, "Attempts", 1, 4), p: int(v.p, "Leaf failure %", 0, 100) / 100, seed: int(v.seed, "Seed", 0, 1e6) };
      if (!AM_MODES.includes(o.mode)) throw new Error("Pick who retries from the list.");
      return amplifyFrames(o);
    },
    speed: 1600,
    render(f) {
      const sim = f.sim, o = sim.o, L = o.layers;
      const names = ["edge", "svc A", "svc B", "svc C"];
      const bars = sim.mean.map((m, k) => {
        const w = Math.max(2, (m / Math.max(1, sim.worst)) * 100);
        return `<div class="rs-amp-row"><span>${names[k]} → ${k === L - 1 ? "database" : names[k + 1]}</span><div class="rs-amp-bar"><i style="width:${w.toFixed(1)}%"></i></div><b>${m.toFixed(2)}</b></div>`;
      }).join("");
      const body = f.sample ? Viz.labeled(`request #${f.sample.i}: calls made at each layer`, treeHtml(f.sample.tree, L)) : Viz.labeled(f.summary ? "average calls per logical request (2,000 requests)" : "average calls per logical request", `<div class="rs-amp">${bars}</div>`);
      return body + stats([["worst case", `${sim.worst}×`, sim.worst > 4 ? "bad" : ""], ["mean on database", `${sim.mean[L - 1].toFixed(2)}×`, sim.mean[L - 1] > 3 ? "bad" : "done"], ["exact expectation", sim.exact !== null ? `${sim.exact.toFixed(2)}×` : "n/a"], ["user success", `${(sim.okRate * 100).toFixed(1)}%`, "done"]]);
    },
  }));

  /* shared: arrow with a hand-drawn head (no <marker> ids, so many instances can share a page) */
  function arrow(x1, y1, x2, y2, cls, head = 7) {
    const a = Math.atan2(y2 - y1, x2 - x1), hx = x2 - head * Math.cos(a), hy = y2 - head * Math.sin(a);
    const px = (head / 2) * Math.sin(a), py = (head / 2) * Math.cos(a);
    return `<g class="arr ${cls || ""}"><line x1="${x1.toFixed(1)}" y1="${y1.toFixed(1)}" x2="${hx.toFixed(1)}" y2="${hy.toFixed(1)}"/><polygon points="${x2.toFixed(1)},${y2.toFixed(1)} ${(hx + px).toFixed(1)},${(hy - py).toFixed(1)} ${(hx - px).toFixed(1)},${(hy + py).toFixed(1)}"/></g>`;
  }

  /* =====================================================================
   * 5. Idempotency keys: a retry must not charge the card twice
   * ===================================================================== */
  const ID_SCN = ["response lost, client retries", "request lost, client retries", "client times out while server still works", "retry sends a different body"];
  const ID_FATES = [["lost-resp", "ok"], ["lost-req", "ok"], ["slow", "ok", "ok"], ["lost-resp", "new-body"]];
  const ID_MODES = ["with Idempotency-Key", "no key"];

  function idemSteps(o) {
    const useKey = o.mode === ID_MODES[0], fates = ID_FATES[ID_SCN.indexOf(o.scenario)];
    const steps = [], C = 0, A = 1, S = 2, Lg = 3;
    let charges = 0, store = null, attempt = 0, pending = null, outcome = "waiting";
    const add = (m) => steps.push({ ...m, charges, outcome, store: store ? { ...store } : null });
    const finishPending = () => {
      if (!pending) return;
      const p = pending; pending = null;
      add({ from: Lg, to: A, label: `ok, charge ch_${p.ch}`, cls: "done", line: 8, note: `The slow charge from attempt ${p.n} finally completes: <b>ch_${p.ch}</b>.` });
      if (useKey) { store = { ...store, state: "done", resp: `201 ch_${p.ch}` }; add({ from: A, to: S, label: `Complete(K1, 201 ch_${p.ch})`, cls: "", line: 9, note: "The stored response is saved under the key, so any later retry gets <b>exactly this answer</b>." }); }
      add({ from: A, to: C, label: "201 Created", cls: "lost", line: 10, note: `The 201 for attempt ${p.n} goes back on a connection the client already abandoned. <b>Nobody reads it.</b>` });
    };
    for (const fate of fates) {
      if (outcome === "success" || outcome === "rejected") break;
      attempt++;
      const amount = fate === "new-body" ? 60 : 50, hash = amount === 50 ? "h(50)" : "h(60)";
      const lbl = `POST /payments #${attempt}${useKey ? " · key K1" : ""} · $${amount}`;
      if (attempt > 1 && steps.length) add({ from: C, to: C, label: fate === "ok" && pending ? "retry at once" : steps[steps.length - 1].label.startsWith("409") || (steps.length > 3 && steps.slice(-4).some((x) => x.label.startsWith("409"))) ? "wait Retry-After: 1 s" : "retry after backoff", cls: "self", line: 0, note: `Attempt ${attempt}. ${steps.slice(-4).some((x) => x.label.startsWith("409")) ? "The client honours <code>Retry-After</code> and asks again. " : ""}${fate === "new-body" ? "The client rebuilt the request and <b>the body changed</b> (a recomputed total, a new timestamp...)." : "The client resends the same request."}` });
      if (fate === "lost-req") {
        add({ from: C, to: A, label: lbl, cls: "lost", line: 0, note: "The request is dropped by the network (a reset connection, a proxy timeout). The server never sees it." });
        add({ from: C, to: C, label: "timeout: no reply", cls: "self bad", line: 0, note: "From the client's side this looks <b>exactly like a lost response</b>: it cannot tell whether the charge happened." });
        continue;
      }
      add({ from: C, to: A, label: lbl, cls: "", line: useKey ? 0 : 8, note: `The API receives attempt ${attempt}.` });
      if (useKey) {
        add({ from: A, to: S, label: `TryInsert(K1, ${hash})`, cls: "", line: 2, note: "Atomically claim the key, together with a hash of the body. Only one request can win this insert." });
        if (store) {
          if (store.hash !== hash) {
            add({ from: S, to: A, label: `exists, hash ${store.hash}`, cls: "bad", line: 4, note: "The key exists but the body is different. That is a client bug, and replaying the old answer would hide it." });
            outcome = "rejected";
            add({ from: A, to: C, label: "422 key reused with another body", cls: "bad", line: 4, note: "The API refuses with <b>422</b> and charges nothing. The client must use a new key for a new payment." });
            continue;
          }
          if (store.state === "progress") {
            add({ from: S, to: A, label: "exists, in progress", cls: "visit", line: 5, note: "The first attempt is still running. Starting a second charge now is exactly what the key exists to prevent." });
            add({ from: A, to: C, label: "409 Conflict · Retry-After: 1", cls: "visit", line: 5, note: "<b>409</b> tells the client \"same request, still working, ask again soon\"." });
            finishPending();
            continue;
          }
          add({ from: S, to: A, label: `exists, done: ${store.resp}`, cls: "done", line: 6, note: "The key is complete, so the API <b>replays the stored response</b> without touching the ledger." });
          outcome = "success";
          add({ from: A, to: C, label: `${store.resp.replace(/ ch_\d+/, " Created")} (replayed)`, cls: "done", line: 6, note: `The client finally gets its answer: one payment, <b>${charges} charge${charges === 1 ? "" : "s"}</b>.` });
          continue;
        }
        store = { key: "K1", hash, state: "progress" };
        add({ from: S, to: A, label: "inserted · in progress", cls: "", line: 2, note: "First time this key is seen: it is now marked <b>in progress</b>." });
      }
      charges++;
      const ch = charges;
      add({ from: A, to: Lg, label: `charge $${amount}`, cls: charges > 1 ? "bad" : "", line: 8, note: charges > 1 ? `<b>Second charge.</b> Without a key the server has no way to know this is the same payment as before.` : `The ledger charges the card.` });
      if (fate === "slow") {
        pending = { n: attempt, ch };
        add({ from: C, to: C, label: "timeout after 2 s", cls: "self bad", line: 8, note: "The ledger is slow today. The client's timeout fires while the server is <b>still working</b> on attempt 1." });
        continue;
      }
      add({ from: Lg, to: A, label: `ok, charge ch_${ch}`, cls: "done", line: 8, note: `Charge <b>ch_${ch}</b> exists. Money has moved.` });
      if (useKey) { store = { ...store, state: "done", resp: `201 ch_${ch}` }; add({ from: A, to: S, label: `Complete(K1, 201 ch_${ch})`, cls: "", line: 9, note: "Store the response under the key before answering." }); }
      if (fate === "lost-resp") {
        add({ from: A, to: C, label: "201 Created", cls: "lost", line: 10, note: "The response is lost on the way back. The payment happened, but the client <b>does not know that</b>." });
        add({ from: C, to: C, label: "timeout: no reply", cls: "self bad", line: 0, note: "The client only sees a timeout, so it has to retry. The question is whether that retry is safe." });
        continue;
      }
      outcome = "success";
      add({ from: A, to: C, label: "201 Created", cls: "done", line: 10, note: `Success. Total charges for this one payment: <b>${charges}</b>${charges > 1 ? ". The customer was charged twice" : ""}.` });
      finishPending();
    }
    finishPending();
    return steps;
  }

  function idemFrames(o) {
    const steps = idemSteps(o), frames = [];
    frames.push({ steps, k: 0, line: [], note: `One payment of $50. Scenario: <b>${o.scenario}</b>, ${o.mode === ID_MODES[0] ? "and the client sends an <code>Idempotency-Key</code> (a UUID it generated once for this payment)" : "and the client sends <b>no idempotency key</b>"}. Step through to count the charges.`, vars: { charges: 0, attempts: 0 } });
    steps.forEach((st, i) => {
      const atts = steps.slice(0, i + 1).filter((x) => x.from === 0 && x.to === 1).length;
      frames.push({ steps, k: i + 1, line: o.mode === ID_MODES[0] ? st.line : [8, 10].includes(st.line) ? st.line : [], note: st.note + (i === steps.length - 1 ? ` <b>Final: ${st.charges} charge${st.charges === 1 ? "" : "s"}</b> for one payment.` : ""),
        vars: { attempts: atts, charges: st.charges, "key record": st.store ? `${st.store.hash} · ${st.store.state === "done" ? st.store.resp : "in progress"}` : "–", client: st.outcome } });
    });
    return frames;
  }

  Viz.register("resilience-idempotency", (el) => Viz.player(el, {
    title: "Idempotency keys: make a retried POST safe",
    tag: "SEQUENCE DIAGRAM",
    legend: [["done", "success / replay"], ["bad", "lost, failed or double charge"], ["visit", "in progress (409)"]],
    code: [
      "var key = Request.Headers[\"Idempotency-Key\"];",
      "var hash = Sha256(body);",
      "var rec = await store.TryInsert(key, hash);",
      "if (rec.Existing is { } e) {",
      "    if (e.Hash != hash) return Status(422);",
      "    if (e.InProgress) return Status(409);",
      "    return e.StoredResponse;      // replay",
      "}",
      "var res = await ledger.Charge(body); // once",
      "await store.Complete(key, res);",
      "return res;",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "scenario", label: "what goes wrong", type: "select", value: ID_SCN[0], options: ID_SCN },
      { key: "mode", label: "client", type: "select", value: ID_MODES[0], options: ID_MODES },
    ],
    random: () => ({ scenario: pick(ID_SCN), mode: pick(ID_MODES) }),
    build: (v) => {
      if (!ID_SCN.includes(v.scenario) || !ID_MODES.includes(v.mode)) throw new Error("Pick a scenario and a client mode from the lists.");
      return idemFrames(v);
    },
    speed: 1400,
    render(f) {
      const W = 600, lanes = ["client", "API", "key store", "ledger"], X = [60, 230, 400, 540], shown = f.steps.slice(0, f.k), rowH = 25, top = 40;
      const H = top + Math.max(f.steps.length, 6) * rowH + 10;
      let s = `<svg class="rs-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="sequence diagram">`;
      lanes.forEach((l, i) => { s += `<rect class="lh" x="${X[i] - 44}" y="6" width="88" height="22" rx="5"/><text class="lht" x="${X[i]}" y="21" text-anchor="middle">${l}</text><line class="life" x1="${X[i]}" x2="${X[i]}" y1="28" y2="${H - 4}"/>`; });
      shown.forEach((m, i) => {
        const y = top + i * rowH + 8, cur = i === f.k - 1 ? " cur" : "";
        if (m.from === m.to) {
          s += `<text class="msg self ${m.cls}${cur}" x="${X[m.from] + 10}" y="${y + 4}" text-anchor="start">${esc(m.label)}</text><circle class="selfdot ${m.cls}" cx="${X[m.from]}" cy="${y}" r="4"/>`;
          return;
        }
        const x1 = X[m.from], x2 = X[m.to], dir = x2 > x1 ? 1 : -1;
        if (m.cls === "lost") {
          const mid = (x1 + x2) / 2;
          s += `<g class="arr lost${cur}"><line x1="${x1}" y1="${y}" x2="${mid}" y2="${y}"/></g><text class="x" x="${mid}" y="${y + 5}" text-anchor="middle">✕</text>`;
        } else s += arrow(x1 + dir * 2, y, x2 - dir * 2, y, `${m.cls}${cur}`);
        s += `<text class="msg ${m.cls === "lost" ? "bad" : m.cls}${cur}" x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle">${esc(m.label)}</text>`;
      });
      s += "</svg>";
      const last = shown[shown.length - 1], ch = last ? last.charges : 0, done = f.k === f.steps.length;
      return `<div class="rs-fit">${s}</div>` + stats([["charges on the card", ch, ch > 1 ? "bad" : ch === 1 ? "done" : ""], ["attempts sent", shown.filter((m) => m.from === 0 && m.to === 1).length], ["client sees", last ? last.outcome : "waiting", last && last.outcome === "success" ? "done" : last && last.outcome === "rejected" ? "bad" : ""], ["verdict", !done ? "…" : ch === 1 ? "exactly once" : ch === 0 ? "no charge" : "DOUBLE CHARGE", !done ? "" : ch === 1 ? "done" : "bad"]]);
    },
  }));

  /* =====================================================================
   * 6. Circuit breaker: closed → open → half-open
   * ===================================================================== */
  const CB_PRESETS = ["hard outage, 4 s to 12 s", "overloaded: heals after 1.5 s of quiet", "flaky: 30% failures", "short blip, 0.6 s"];
  const CB_MODES = ["with circuit breaker", "no breaker"];
  const CB_T = 200;

  function breakerSim(o) {
    const rng = mulberry(o.seed), pi = CB_PRESETS.indexOf(o.preset), useCb = o.mode === CB_MODES[0];
    let state = "closed", win = [], openUntil = 0, probesLeft = 0, probesOk = 0, quiet = 0, healed = false;
    const ticks = [], events = [];
    const tot = { ok: 0, fail: 0, fast: 0, sick: 0 };
    for (let t = 0; t < CB_T; t++) {
      let failP;
      if (pi === 0) failP = t >= 40 && t < 120 ? 1 : 0;
      else if (pi === 1) failP = t >= 40 && !healed ? 1 : 0;
      else if (pi === 2) failP = t >= 40 ? 0.3 : 0;
      else failP = t >= 60 && t < 66 ? 1 : 0;
      let from = state;
      if (useCb && state === "open" && t >= openUntil) { state = "half"; probesLeft = o.probes; probesOk = 0; events.push({ t, from: "open", to: "half", why: `the break of ${o.brk} s is over` }); }
      let out;
      if (useCb && (state === "open" || (state === "half" && probesLeft === 0))) { out = "fast"; tot.fast++; quiet++; }
      else {
        if (state === "half") probesLeft--;
        const fail = rng() < failP;
        out = fail ? "fail" : "ok";
        tot[out]++; if (failP > 0) tot.sick++;
        quiet = 0;
        if (useCb && state === "closed") {
          win.push(fail ? 1 : 0); if (win.length > o.window) win.shift();
          const rate = win.reduce((a, b) => a + b, 0) / win.length;
          if (win.length >= o.min && rate * 100 >= o.threshold) { state = "open"; openUntil = t + 1 + o.brk * 10; events.push({ t, from: "closed", to: "open", why: `failure rate ${Math.round(rate * 100)}% ≥ ${o.threshold}% over ${win.length} calls` }); win = []; }
        } else if (useCb && state === "half") {
          if (fail) { state = "open"; openUntil = t + 1 + o.brk * 10; events.push({ t, from: "half", to: "open", why: "a probe failed" }); }
          else if (++probesOk >= o.probes) { state = "closed"; win = []; events.push({ t, from: "half", to: "closed", why: `${o.probes} probe${o.probes > 1 ? "s" : ""} succeeded` }); }
        }
      }
      if (pi === 1 && !healed && t >= 40 && quiet >= 15) healed = true;
      const rate = win.length ? (win.reduce((a, b) => a + b, 0) / win.length) * 100 : 0;
      ticks.push({ t, failP, state: from === state ? state : state, before: from, out, rate: useCb ? rate : null, healed });
    }
    return { o, useCb, pi, ticks, events, tot };
  }

  function breakerFrames(o) {
    const sim = breakerSim(o), frames = [], evAt = new Map();
    sim.events.forEach((e) => evAt.set(e.t, [...(evAt.get(e.t) || []), e]));
    const stops = new Set([0]);
    for (let t = 9; t < CB_T; t += 10) stops.add(t);
    sim.events.forEach((e) => stops.add(e.t));
    if (sim.pi === 1) { const h = sim.ticks.find((x) => x.healed); if (h) stops.add(h.t); }
    let healedShown = false;
    [...stops].sort((a, b) => a - b).forEach((t) => {
      const tk = sim.ticks[t], evs = evAt.get(t) || [], e = evs[evs.length - 1], seen = sim.ticks.slice(0, t + 1);
      const viaHalf = evs.length > 1 && evs[0].to === "half" ? `The break of ${o.brk} s is over, so the breaker went <b>half-open</b> and let a probe through. ` : "";
      const c = (k) => seen.filter((x) => x.out === k).length;
      let note, line;
      if (t === 0) { note = `10 calls per second for 20 s. Scenario: <b>${o.preset}</b>. ${sim.useCb ? `The breaker opens when at least ${o.threshold}% of the last ${o.window} calls failed (and at least ${o.min} calls were seen), stays open ${o.brk} s, then lets ${o.probes} probe${o.probes > 1 ? "s" : ""} through.` : "There is <b>no breaker</b>: every call goes to the dependency no matter how sick it is."}`; line = sim.useCb ? [2, 3, 4, 5, 6] : []; }
      else if (e && e.to === "open" && e.from === "closed") { note = `<b>Trip!</b> ${e.why}. The breaker opens: for the next ${o.brk} s calls <b>fail immediately</b> without touching the dependency.`; line = [2, 3, 4, 8]; }
      else if (e && e.to === "half") { note = `${e.why[0].toUpperCase() + e.why.slice(1)}. <b>Half-open</b>: ${o.probes} trial call${o.probes > 1 ? "s are" : " is"} allowed through to test the water; everything else still fails fast.`; line = [6, 9]; }
      else if (e && e.to === "closed") { note = viaHalf + `${e.why[0].toUpperCase() + e.why.slice(1)}. <b>Closed</b> again: traffic flows normally and the failure window starts fresh.`; line = 9; }
      else if (e && e.from === "half") { note = viaHalf + `<b>${e.why[0].toUpperCase() + e.why.slice(1)}</b>, so the breaker goes straight back to <b>open</b> for another ${o.brk} s.${sim.pi === 1 ? " Each probe also resets the dependency's quiet time." : ""}`; line = [6, 9]; }
      else if (sim.pi === 1 && tk.healed && !healedShown) { note = `The dependency got 1.5 s without traffic and has <b>recovered</b>. ${sim.useCb ? "The breaker gave it that pause." : ""}`; line = []; }
      else {
        const st = tk.state;
        note = `t=${(t / 10 + 0.1).toFixed(1)} s. ${!sim.useCb ? (tk.failP > 0 && sim.pi !== 2 ? `Still hammering a dead dependency: ${c("fail")} failed calls so far, each one waiting for its timeout.${sim.pi === 1 ? " With no pause, it <b>never recovers</b>." : ""}` : `${c("ok")} ok, ${c("fail")} failed.`) : st === "closed" ? `Closed. Window failure rate <b>${Math.round(tk.rate)}%</b> (threshold ${o.threshold}%).${sim.pi === 2 && t > 60 && !sim.events.length ? " Random 30% failures stay below the threshold: that is a job for retries, not for a breaker." : ""}` : st === "open" ? `Open. ${c("fast")} calls have been short-circuited so far: they failed in microseconds and put <b>zero load</b> on the dependency.` : "Half-open, waiting on the probe."}`;
        line = !sim.useCb ? [] : st === "closed" ? [2, 4] : st === "open" ? 8 : 9;
      }
      if (sim.pi === 1 && tk.healed) healedShown = true;
      frames.push({ sim, t, line, note, vars: { t: `${(t / 10 + 0.1).toFixed(1)} s`, state: sim.useCb ? { closed: "CLOSED", open: "OPEN", half: "HALF-OPEN" }[tk.state] : "–", "window fail %": sim.useCb && tk.state === "closed" ? Math.round(tk.rate) : "–", ok: c("ok"), failed: c("fail"), "short-circuited": c("fast") } });
    });
    return frames;
  }

  function stateMachine(state, lastEv) {
    const W = 600, H = 150, N = { closed: [100, 46], open: [500, 46], half: [300, 118] }, w = 124, h = 34;
    const hot = (a, b) => (lastEv && lastEv.from === a && lastEv.to === b ? "hot" : "");
    let s = `<svg class="rs-sm" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="circuit breaker state machine">`;
    s += arrow(100 + w / 2, 40, 500 - w / 2, 40, hot("closed", "open")) + `<text class="lbl" x="300" y="33" text-anchor="middle">failure rate ≥ threshold</text>`;
    s += arrow(470, 63, 350, 101, hot("open", "half")) + `<text class="lbl" x="440" y="98">break elapsed</text>`;
    s += arrow(330, 101, 452, 63, hot("half", "open")) + `<text class="lbl" x="384" y="74">probe fails</text>`;
    s += arrow(250, 112, 120, 63, hot("half", "closed")) + `<text class="lbl" x="98" y="100">probes succeed</text>`;
    const label = { closed: "CLOSED", open: "OPEN", half: "HALF-OPEN" }, sub = { closed: "calls flow", open: "fail fast", half: "trial calls" };
    Object.entries(N).forEach(([k, [x, y]]) => { s += `<g class="st ${k}${state === k ? " on" : ""}"><rect x="${x - w / 2}" y="${y - h / 2}" width="${w}" height="${h}" rx="17"/><text x="${x}" y="${y - 1}" text-anchor="middle">${label[k]}</text><text class="sub" x="${x}" y="${y + 11}" text-anchor="middle">${sub[k]}</text></g>`; });
    return s + "</svg>";
  }

  Viz.register("resilience-breaker", (el) => Viz.player(el, {
    title: "Circuit breaker: stop calling a dependency that is down",
    tag: "SIMULATION · 10 CALLS / s",
    legend: [["done", "ok / closed"], ["bad", "failed / open"], ["visit", "short-circuited / half-open"]],
    code: [
      "var cb = CircuitBreaker.of(\"payments\",",
      "  CircuitBreakerConfig.custom()",
      "    .slidingWindowSize(20)        // last N",
      "    .minimumNumberOfCalls(10)",
      "    .failureRateThreshold(50)     // percent",
      "    .waitDurationInOpenState(ofSeconds(3))",
      "    .permittedNumberOfCallsInHalfOpenState(1)",
      "    .build());",
      "// OPEN: CallNotPermittedException, no call",
      "// HALF_OPEN: probes decide CLOSED or OPEN",
    ],
    codeLang: "java",
    inputs: [
      { key: "preset", label: "dependency", type: "select", value: CB_PRESETS[0], options: CB_PRESETS },
      { key: "mode", label: "client", type: "select", value: CB_MODES[0], options: CB_MODES },
      { key: "window", label: "window (calls)", value: "20", width: 44 },
      { key: "threshold", label: "threshold %", value: "50", width: 44 },
      { key: "min", label: "min calls", value: "10", width: 44 },
      { key: "brk", label: "open for (s)", value: "3", width: 44 },
      { key: "probes", label: "probes", value: "1", width: 40 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ preset: pick(CB_PRESETS), mode: CB_MODES[Viz.rand(0, 3) ? 0 : 1], window: String(Viz.rand(4, 6) * 5), threshold: pick(["20", "30", "50", "70"]), min: String(Viz.rand(1, 4) * 5), brk: String(Viz.rand(1, 5)), probes: String(Viz.rand(1, 3)), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { preset: v.preset, mode: v.mode, window: int(v.window, "Window", 1, 100), threshold: int(v.threshold, "Threshold", 1, 100), min: int(v.min, "Min calls", 1, 100), brk: num(v.brk, "Open for", 0.1, 10), probes: int(v.probes, "Probes", 1, 10), seed: int(v.seed, "Seed", 0, 1e6) };
      if (!CB_PRESETS.includes(o.preset) || !CB_MODES.includes(o.mode)) throw new Error("Pick a dependency and a client mode from the lists.");
      if (o.min > o.window) throw new Error("Min calls: cannot be larger than the window.");
      return breakerFrames(o);
    },
    speed: 700,
    render(f) {
      const sim = f.sim, t = f.t, seen = sim.ticks.slice(0, t + 1), W = 600, pl = 84, cw = (W - pl - 10) / CB_T;
      const lastEv = [...sim.events].reverse().find((e) => e.t <= t);
      let strip = `<svg class="rs-strip" viewBox="0 0 ${W} 74" width="${W}" role="img" aria-label="timeline">`;
      const rows = [["dependency", (x) => (x.failP >= 1 ? "bad" : x.failP > 0 ? "visit" : "done")], ["breaker", (x) => (!sim.useCb ? "none" : x.state === "closed" ? "done" : x.state === "open" ? "bad" : "visit")], ["call result", (x) => (x.out === "ok" ? "done" : x.out === "fail" ? "bad" : "visit")]];
      rows.forEach(([lbl, fn], r) => {
        const y = 4 + r * 23;
        strip += `<text class="ax" x="${pl - 6}" y="${y + 13}" text-anchor="end">${lbl}</text>`;
        seen.forEach((x) => { strip += `<rect class="c ${fn(x)}" x="${(pl + x.t * cw).toFixed(2)}" y="${y}" width="${(cw + 0.05).toFixed(2)}" height="18"/>`; });
      });
      strip += `<line class="now" x1="${pl + (t + 1) * cw}" x2="${pl + (t + 1) * cw}" y1="2" y2="72"/></svg>`;
      const xt = [0, 50, 100, 150, 200].map((i) => ({ i, label: `${i / 10}s` }));
      const rate = sim.useCb ? stackChart({ label: "window failure rate", w: 600, h: 120, layers: [sim.ticks.map(() => 0)], cls: ["done"], cut: t + 1, ymax: 100, cap: f.sim.o.threshold, capLabel: `threshold ${f.sim.o.threshold}%`, lines: [{ values: sim.ticks.map((x) => (x.state === "closed" ? x.rate : 0)), cls: "bad" }], xTicks: xt, yLabel: "fail % (closed)", fmtY: (v) => `${v}%` }) : "";
      const c = (k) => seen.filter((x) => x.out === k).length;
      return (sim.useCb ? `<div class="rs-fit">${stateMachine(sim.ticks[t].state, lastEv)}</div>` : "") + `<div class="rs-fit">${strip}</div>` + (rate ? `<div class="rs-fit">${rate}</div>` : "") +
        stats([["succeeded", c("ok"), "done"], ["failed slowly", c("fail"), "bad"], ["short-circuited", c("fast"), "visit"], ["calls sent to a sick dependency", seen.filter((x) => x.out !== "fast" && x.failP > 0).length, "bad"]]);
    },
  }));

  /* =====================================================================
   * 7. Rate limiting algorithms side by side
   * ===================================================================== */
  const RL_ALGOS = ["token bucket", "leaky bucket (queue)", "fixed window", "sliding log", "sliding window counter"];
  const RL_ARR = ["steady over the limit", "bursty", "burst at the window boundary", "random"];
  const RL_LINE = [[1, 2], [3, 4], 5, 6, 7];
  const RL_T = 60;

  function rlArrivals(kind, L, W, seed) {
    const rng = mulberry(seed), a = Array(RL_T).fill(0);
    for (let t = 0; t < RL_T; t++) {
      if (kind === 0) a[t] = Math.round((1.5 * L) / W * (t + 1)) - Math.round((1.5 * L) / W * t);
      else if (kind === 1) a[t] = t % 20 < 3 ? Math.ceil(L * 0.8) : t % 20 === 10 ? 1 : 0;
      else if (kind === 2) { const m = t % (2 * W); a[t] = m === W - 1 || m === W ? L : 0; }
      else { let k = 0; const lam = (1.1 * L) / W; let p = Math.exp(-lam), u = rng(), c = p; while (u > c && k < 50) { k++; p *= lam / k; c += p; } a[t] = k; }
    }
    return a;
  }

  function rlSim(o) {
    const ai = RL_ALGOS.indexOf(o.algo), arr = rlArrivals(RL_ARR.indexOf(o.arrivals), o.limit, o.window, o.seed), L = o.limit, W = o.window, rate = L / W;
    let tokens = o.burst, q = 0, drain = 0, log = [];
    const ticks = [];
    const winCount = (t) => { const k = Math.floor(t / W); return ticks.filter((x) => Math.floor(x.t / W) === k).reduce((s, x) => s + x.ok, 0); };
    for (let t = 0; t < RL_T; t++) {
      let ok = 0, rej = 0, state = {};
      if (ai === 0) {
        tokens = Math.min(o.burst, tokens + rate);
        for (let i = 0; i < arr[t]; i++) { if (tokens >= 1) { tokens--; ok++; } else rej++; }
        state = { tokens: tokens.toFixed(1), capacity: o.burst, "refill / tick": rate.toFixed(2) };
      } else if (ai === 1) {
        for (let i = 0; i < arr[t]; i++) { if (q < o.burst) q++; else rej++; }
        drain += rate; const out = Math.min(q, Math.floor(drain)); drain -= out; q -= out; ok = out; if (q === 0) drain = 0;
        state = { queued: q, "queue cap": o.burst, "drain / tick": rate.toFixed(2), "wait now": `${Math.ceil(q / rate) * 100} ms` };
      } else if (ai === 2) {
        let c = winCount(t);
        for (let i = 0; i < arr[t]; i++) { if (c < L) { c++; ok++; } else rej++; }
        state = { window: `[${Math.floor(t / W) * W * 100}, ${(Math.floor(t / W) + 1) * W * 100}) ms`, "count": c, limit: L };
      } else if (ai === 3) {
        log = log.filter((x) => x > t - W);
        for (let i = 0; i < arr[t]; i++) { if (log.length < L) { log.push(t); ok++; } else rej++; }
        state = { "timestamps kept": log.length, "oldest": log.length ? `${log[0] * 100} ms` : "–", limit: L };
      } else {
        const k = Math.floor(t / W), cur = () => ticks.filter((x) => Math.floor(x.t / W) === k).reduce((s, x) => s + x.ok, 0) + ok;
        const prev = ticks.filter((x) => Math.floor(x.t / W) === k - 1).reduce((s, x) => s + x.ok, 0), frac = (t - k * W) / W;
        let est = 0;
        for (let i = 0; i < arr[t]; i++) { est = prev * (1 - frac) + cur(); if (est + 1 <= L) ok++; else rej++; }
        est = prev * (1 - frac) + cur();
        state = { previous: prev, current: cur(), weight: (1 - frac).toFixed(2), estimate: est.toFixed(1), limit: L };
      }
      ticks.push({ t, arr: arr[t], ok, rej, q: ai === 1 ? q : 0, tokens: ai === 0 ? tokens : null, state });
    }
    let worst = 0, worstAt = 0;
    for (let t = 0; t + W <= RL_T; t++) { const v = ticks.slice(t, t + W).reduce((s, x) => s + x.ok, 0); if (v > worst) { worst = v; worstAt = t; } }
    return { o, ai, ticks, worst, worstAt };
  }

  function rlFrames(o) {
    const sim = rlSim(o), frames = [], L = o.limit, W = o.window;
    let warnedBoundary = false;
    for (let t = 0; t < RL_T; t++) {
      const x = sim.ticks[t], upto = sim.ticks.slice(0, t + 1);
      const tot = upto.reduce((a, y) => ({ ok: a.ok + y.ok, rej: a.rej + y.rej, arr: a.arr + y.arr }), { ok: 0, rej: 0, arr: 0 });
      let note = `t=${t * 100} ms: ${x.arr} arrive${x.arr === 1 ? "s" : ""}, <b>${x.ok} admitted</b>, ${x.rej} rejected.`;
      if (t === 0) note = `Limit: <b>${L} requests per ${W * 100} ms</b>, ${sim.ai === 0 ? `with bursts up to ${o.burst} (bucket size)` : sim.ai === 1 ? `with up to ${o.burst} requests queued` : "counted per window"}. Arrivals: <b>${o.arrivals}</b>. ` + note;
      if (sim.ai === 1 && x.q > 0 && x.rej === 0 && x.arr > 0) note += ` The rest wait in the queue: smooth output, but <b>added latency</b> (${x.state["wait now"]}).`;
      if (sim.ai === 0 && x.ok > 1 && x.ok > L / W + 0.5) note += ` Saved-up tokens let a <b>burst</b> through.`;
      const win = sim.ticks.slice(Math.max(0, t - W + 1), t + 1).reduce((s, y) => s + y.ok, 0);
      if (!warnedBoundary && win > L) { warnedBoundary = true; note += ` <b>${win} requests admitted in the last ${W * 100} ms</b>, more than the limit of ${L}. ${sim.ai === 2 ? "Two adjacent windows each allowed their full quota right at the boundary." : sim.ai === 0 ? "The bucket allows bursts above the average rate: that is its design." : ""}`; }
      frames.push({ sim, t, note, line: t === 0 ? 0 : RL_LINE[sim.ai], vars: { ...x.state, "admitted so far": `${tot.ok} / ${tot.arr}` } });
    }
    return frames;
  }

  Viz.register("resilience-ratelimit", (el) => Viz.player(el, {
    title: "Rate limiting: five algorithms, same traffic",
    tag: "SIMULATION · 100 ms TICKS",
    legend: [["done", "admitted"], ["bad", "rejected (429)"], ["visit", "queued"]],
    code: [
      "// allow at most L requests per window W",
      "token bucket:  tokens += L/W each tick (max B)",
      "               allow if tokens >= 1; tokens--",
      "leaky bucket:  enqueue if queue < B, else 429",
      "               serve L/W per tick from the queue",
      "fixed window:  allow if count[t / W] < L",
      "sliding log:   allow if #stamps in (t-W, t] < L",
      "sliding count: prev*(1 - elapsed/W) + cur < L",
    ],
    codeLang: "typescript",
    inputs: [
      { key: "algo", label: "algorithm", type: "select", value: RL_ALGOS[0], options: RL_ALGOS },
      { key: "arrivals", label: "traffic", type: "select", value: RL_ARR[1], options: RL_ARR },
      { key: "limit", label: "L (requests)", value: "10", width: 44 },
      { key: "window", label: "W (ticks)", value: "10", width: 44 },
      { key: "burst", label: "B (bucket / queue)", value: "10", width: 44 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ algo: pick(RL_ALGOS), arrivals: pick(RL_ARR), limit: String(Viz.rand(3, 20)), window: String(Viz.rand(5, 15)), burst: String(Viz.rand(2, 20)), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { algo: v.algo, arrivals: v.arrivals, limit: int(v.limit, "L", 1, 50), window: int(v.window, "W", 2, 30), burst: int(v.burst, "B", 1, 100), seed: int(v.seed, "Seed", 0, 1e6) };
      if (!RL_ALGOS.includes(o.algo) || !RL_ARR.includes(o.arrivals)) throw new Error("Pick an algorithm and traffic from the lists.");
      return rlFrames(o);
    },
    speed: 380,
    render(f) {
      const sim = f.sim, o = sim.o, W = o.window, tk = sim.ticks;
      const ymaxRaw = Math.max(4, ...tk.map((x) => x.arr), ...(sim.ai === 1 ? tk.map((x) => x.q) : sim.ai === 0 ? tk.map((x) => x.tokens) : [0])) * 1.1;
      const ymax = Math.ceil(ymaxRaw / 4) * 4;
      const xt = []; for (let i = 0; i <= RL_T; i += 10) xt.push({ i, label: `${i / 10}s` });
      const bands = [];
      if (sim.ai === 2) for (let k = 1; k * W < RL_T; k += 2) bands.push({ from: k * W, to: Math.min(RL_T, (k + 1) * W), cls: "win" });
      const lines = sim.ai === 1 ? [{ values: tk.map((x) => x.q), cls: "visit" }] : sim.ai === 0 ? [{ values: tk.map((x) => x.tokens), cls: "path" }] : [];
      const chart = stackChart({ label: "admitted and rejected per tick", w: 600, h: 170, layers: [tk.map((x) => x.ok), tk.map((x) => x.rej)], cls: ["done", "bad"], cut: f.t + 1, ymax, lines, bands, xTicks: xt, yLabel: sim.ai === 1 ? "requests · queue" : sim.ai === 0 ? "requests · tokens" : "requests" });
      const win = sim.ticks.slice(Math.max(0, f.t - W + 1), f.t + 1).reduce((s, y) => s + y.ok, 0);
      const meter = `<div class="rs-meter"><span>admitted in the last ${W * 100} ms</span><div class="rs-amp-bar"><i class="${win > o.limit ? "over" : ""}" style="width:${Math.min(100, (win / (o.limit * 2)) * 100).toFixed(1)}%"></i><em style="left:50%"></em></div><b>${win} / ${o.limit}</b></div>`;
      const upto = tk.slice(0, f.t + 1);
      return `<div class="rs-fit">${chart}</div>` + meter + kv(`${o.algo}: state after this tick`, Object.entries(sim.ticks[f.t].state).map(([k, v]) => [k, String(v)])) + stats([["admitted", upto.reduce((s, x) => s + x.ok, 0), "done"], ["rejected", upto.reduce((s, x) => s + x.rej, 0), "bad"], ["worst window (whole run)", `${sim.worst} / ${o.limit}`, sim.worst > o.limit ? "bad" : "done"]]);
    },
  }));

  /* =====================================================================
   * 8. Load shedding: which requests should a busy server drop?
   * ===================================================================== */
  const SH_POL = ["unbounded FIFO queue", "bounded FIFO queue", "LIFO (newest first)", "drop expired before work"];
  const SH_T = 80;

  function shedSim(o) {
    const pi = SH_POL.indexOf(o.policy), rng = mulberry(o.seed), q = [], ticks = [];
    let id = 0;
    const tot = { good: 0, late: 0, rejected: 0, expired: 0 };
    for (let t = 0; t < SH_T; t++) {
      const rate = t >= 20 && t < 20 + o.spikeLen ? o.spike : o.base;
      const n = Math.floor(rate) + (rng() < rate % 1 ? 1 : 0);
      let rejected = 0, good = 0, late = 0, expired = 0;
      for (let i = 0; i < n; i++) {
        if (pi === 1 && q.length >= o.maxQ) { rejected++; continue; }
        q.push({ id: id++, at: t });
      }
      let cap = o.cap;
      while (cap > 0 && q.length) {
        const r = pi === 2 ? q.pop() : q.shift();
        const age = t - r.at;
        if (pi === 3 && age >= o.timeout) { expired++; continue; }
        cap--;
        if (age + 1 <= o.timeout) good++; else late++;
      }
      if (pi === 2) { for (let i = q.length - 1; i >= 0; i--) if (t - q[i].at >= o.timeout * 3) { q.splice(i, 1); expired++; } }
      tot.good += good; tot.late += late; tot.rejected += rejected; tot.expired += expired;
      ticks.push({ t, arr: n, good, late, rejected, expired, q: q.map((r) => t - r.at), cap: o.cap });
    }
    return { o, pi, ticks, tot };
  }

  function shedFrames(o) {
    const sim = shedSim(o), frames = [];
    let saidSpike = false, saidLate = false, saidEnd = false;
    for (let t = 0; t < SH_T; t += 2) {
      const x = sim.ticks[t], upto = sim.ticks.slice(0, t + 1), sum = (k) => upto.reduce((s, y) => s + y[k], 0);
      const oldest = x.q.length ? Math.max(...x.q) : 0;
      let note = `t=${(t / 10).toFixed(1)} s: queue ${x.q.length}, oldest waited ${oldest * 100} ms. This tick: ${x.good} useful, ${x.late} late, ${x.rejected + x.expired} shed.`;
      if (t === 0) note = `The server can do <b>${o.cap} requests per 100 ms</b>. Normal traffic is ${o.base}/tick; at 2 s a spike of ${o.spike}/tick lasts ${o.spikeLen / 10} s. Clients give up after <b>${o.timeout * 100} ms</b>. Policy: <b>${o.policy}</b>.`;
      else if (!saidSpike && t >= 20) { saidSpike = true; note = `<b>The spike arrives.</b> ${o.spike} requests per tick against a capacity of ${o.cap}: the excess has to go somewhere. ` + note; }
      else if (!saidLate && x.late > 0) { saidLate = true; note = `<b>Wasted work begins.</b> The server is now finishing requests whose clients gave up more than ${o.timeout * 100} ms ago. It is 100% busy and ${Math.round((x.late / Math.max(1, x.good + x.late)) * 100)}% of that effort helps nobody. ` + note; }
      else if (!saidEnd && t >= 20 + o.spikeLen + 4) { saidEnd = true; note = `The spike is over. ${x.q.length > o.cap * 3 ? `But the queue still holds ${x.q.length} requests, all of them stale: the server keeps paying for the spike long after it ended.` : "The queue has drained: the server is back to normal almost immediately."} ` + note; }
      frames.push({ sim, t, note, line: sim.pi === 0 ? [2, 5, 8] : sim.pi === 1 ? [1, 2, 5, 8] : sim.pi === 2 ? [2, 4, 8] : [2, 5, 6, 7, 8],
        vars: { t: `${(t / 10).toFixed(1)} s`, queue: x.q.length, "oldest wait": `${oldest * 100} ms`, useful: sum("good"), "wasted (late)": sum("late"), shed: sum("rejected") + sum("expired") } });
    }
    return frames;
  }

  Viz.register("resilience-shed", (el) => Viz.player(el, {
    title: "Load shedding: a queue under a traffic spike",
    tag: "SIMULATION · 100 ms TICKS",
    legend: [["done", "served in time (useful)"], ["visit", "served too late (wasted)"], ["bad", "shed (rejected or dropped)"]],
    code: [
      "// on arrival",
      "if (queue.Count >= maxQueue) return 503;",
      "queue.Add(req);",
      "// whenever a worker is free",
      "var req = lifo ? queue.PopNewest()",
      "               : queue.PopOldest();",
      "if (now - req.Arrived > req.ClientTimeout)",
      "    { Drop(req); continue; } // client is gone",
      "await Serve(req);",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "policy", label: "policy", type: "select", value: SH_POL[0], options: SH_POL },
      { key: "cap", label: "capacity / tick", value: "10", width: 44 },
      { key: "base", label: "normal / tick", value: "8", width: 44 },
      { key: "spike", label: "spike / tick", value: "18", width: 44 },
      { key: "spikeLen", label: "spike ticks", value: "20", width: 44 },
      { key: "timeout", label: "client timeout (ticks)", value: "10", width: 44 },
      { key: "maxQ", label: "max queue", value: "40", width: 44 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ policy: pick(SH_POL), cap: String(Viz.rand(5, 15)), base: String(Viz.rand(3, 9)), spike: String(Viz.rand(15, 30)), spikeLen: String(Viz.rand(5, 30)), timeout: String(Viz.rand(3, 15)), maxQ: String(Viz.rand(10, 80)), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { policy: v.policy, cap: int(v.cap, "Capacity", 1, 50), base: num(v.base, "Normal", 0, 100), spike: num(v.spike, "Spike", 0, 200), spikeLen: int(v.spikeLen, "Spike ticks", 1, 50), timeout: int(v.timeout, "Client timeout", 1, 60), maxQ: int(v.maxQ, "Max queue", 1, 1000), seed: int(v.seed, "Seed", 0, 1e6) };
      if (!SH_POL.includes(o.policy)) throw new Error("Pick a policy from the list.");
      return shedFrames(o);
    },
    speed: 420,
    render(f) {
      const sim = f.sim, o = sim.o, tk = sim.ticks;
      const xt = []; for (let i = 0; i <= SH_T; i += 10) xt.push({ i, label: `${i / 10}s` });
      const chart = stackChart({ label: "work done per tick", w: 600, h: 150, layers: [tk.map((x) => x.good), tk.map((x) => x.late), tk.map((x) => x.rejected + x.expired)], cls: ["done", "visit", "bad"], cut: f.t + 1,
        ymax: Math.max(o.cap, o.spike, ...tk.map((x) => x.good + x.late + x.rejected + x.expired)) * 1.1, cap: o.cap, capLabel: `capacity ${o.cap}`, bands: [{ from: 20, to: Math.min(SH_T, 20 + o.spikeLen), cls: "down", label: "spike" }], xTicks: xt, yLabel: "requests" });
      const x = tk[f.t], cells = x.q.slice(0, 240).map((age) => `<i class="${age >= o.timeout ? "bad" : age >= o.timeout * 0.6 ? "visit" : "done"}" title="waited ${age * 100} ms"></i>`).join("");
      const queue = Viz.labeled(`queue now: ${x.q.length} request${x.q.length === 1 ? "" : "s"} (colour = age: fresh, near timeout, client already gone)`, `<div class="rs-queue">${cells || '<span class="rs-empty">empty</span>'}${x.q.length > 240 ? `<span class="rs-more">+${x.q.length - 240}</span>` : ""}</div>`);
      const up = tk.slice(0, f.t + 1), sum = (k) => up.reduce((s, y) => s + y[k], 0), work = sum("good") + sum("late");
      return `<div class="rs-fit">${chart}</div>` + queue + stats([["useful (in time)", sum("good"), "done"], ["wasted work", sum("late"), "visit"], ["shed early", sum("rejected") + sum("expired"), "bad"], ["useful share of work", work ? `${Math.round((sum("good") / work) * 100)}%` : "–", work && sum("good") / work < 0.7 ? "bad" : "done"]]);
    },
  }));

  /* =====================================================================
   * 9. Hedged requests: cut the tail by sending a backup
   * ===================================================================== */
  const HG_MODES = ["no hedging", "hedge after delay d", "always send 2"];
  const HG_N = 4000;

  function hedgeSim(o) {
    const mi = HG_MODES.indexOf(o.mode), rng = mulberry(o.seed);
    const gauss = () => { let u = 0, v = 0; while (u === 0) u = rng(); v = rng(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };
    const draw = (f) => (rng() < o.slow / 100 ? 150 + rng() * 850 : 20 * Math.exp(0.35 * gauss())) * f;
    const runAll = (m) => {
      let extra = 0;
      const pass = (f) => { const out = []; extra = 0; for (let i = 0; i < HG_N; i++) {
        const l1 = draw(f);
        if (m === 0) out.push({ l1, res: l1 });
        else if (m === 2) { const l2 = draw(f); extra++; out.push({ l1, l2, at: 0, res: Math.min(l1, l2), win: l2 < l1 ? 2 : 1 }); }
        else if (l1 <= o.d) out.push({ l1, res: l1 });
        else { const l2 = draw(f); extra++; out.push({ l1, l2, at: o.d, res: Math.min(l1, o.d + l2), win: o.d + l2 < l1 ? 2 : 1 }); }
      } return out; };
      let reqs = pass(1);
      const f = 1 + o.congestion / 100 * (extra / HG_N);
      if (f > 1.0001) reqs = pass(f);
      return { reqs, extra: extra / HG_N, f };
    };
    const base = runAll(0), cur = mi === 0 ? base : runAll(mi);
    return { o, mi, base, cur };
  }
  const pctl = (arr, p) => { const a = arr.slice().sort((x, y) => x - y); return a[Math.min(a.length - 1, Math.floor((p / 100) * a.length))]; };

  function hedgeFrames(o) {
    const sim = hedgeSim(o), frames = [], R = sim.cur.reqs;
    const slowIdx = R.map((r, i) => [r, i]).filter(([r]) => r.l1 > 120).slice(0, 3).map(([, i]) => i);
    const fastIdx = R.map((r, i) => [r, i]).filter(([r]) => r.l1 <= 40).slice(0, 2).map(([, i]) => i);
    const sample = [...fastIdx.slice(0, 1), slowIdx[0], ...fastIdx.slice(1), ...slowIdx.slice(1)].filter((x) => x !== undefined);
    const lineOf = (r) => (sim.mi === 0 ? [3, 5] : sim.mi === 2 ? [3, 8, 9] : r && r.l2 !== undefined ? [6, 8, 9] : [3, 5]);
    frames.push({ sim, shown: 0, n: 0, line: [], note: `Most calls take about 20 ms, but <b>${o.slow}%</b> hit a slow replica, a GC pause or a cold cache and take 150 to 1000 ms. Mode: <b>${o.mode}</b>${sim.mi === 1 ? `, d = ${o.d} ms` : ""}. First a few individual requests, then 4,000 of them.`, vars: { mode: o.mode } });
    sample.forEach((idx, k) => {
      const r = R[idx];
      let note;
      if (r.l2 === undefined) note = `Request ${k + 1}: answered in <b>${Math.round(r.res)} ms</b>${sim.mi === 1 ? `, before the ${o.d} ms hedge delay, so no second request was sent` : ""}.`;
      else note = `Request ${k + 1}: the first call ${r.l1 > 120 ? `is stuck (it would take ${Math.round(r.l1)} ms)` : `takes ${Math.round(r.l1)} ms`}. ${sim.mi === 1 ? `At ${o.d} ms a <b>hedge</b> goes to another replica` : "A second copy was sent at the same time"} and ${r.win === 2 ? `wins at <b>${Math.round(r.res)} ms</b>. The loser is cancelled.` : `loses; the first call finishes at ${Math.round(r.res)} ms.`}`;
      frames.push({ sim, shown: k + 1, sample, n: 0, line: lineOf(r), note, vars: { request: k + 1, "first call": `${Math.round(r.l1)} ms`, hedge: r.l2 === undefined ? "–" : `${Math.round(r.l2)} ms (sent at ${r.at})`, "user waits": `${Math.round(r.res)} ms` } });
    });
    [250, 1000, 4000].forEach((n) => {
      const res = R.slice(0, n).map((r) => r.res), b = sim.base.reqs.slice(0, n).map((r) => r.res);
      const p99 = pctl(res, 99), b99 = pctl(b, 99), p999 = pctl(res, 99.9), b999 = pctl(b, 99.9);
      let note = `<b>${n.toLocaleString("en-US")} requests.</b> p50 ${Math.round(pctl(res, 50))} ms, p99 <b>${Math.round(p99)} ms</b>, p99.9 ${Math.round(p999)} ms.`;
      if (n === 4000) note += sim.mi === 0 ? ` The median is great, but 1 user in 100 waits ${Math.round(p99)} ms. A page that makes 50 such calls hits the tail on ${Math.round((1 - 0.99 ** 50) * 100)}% of loads.` : ` Without hedging p99 was ${Math.round(b99)} ms and p99.9 ${Math.round(b999)} ms. Cost: <b>${Math.round(sim.cur.extra * 100)}% extra requests</b>${sim.mi === 2 ? `, and that load slows every call by about ${Math.round((sim.cur.f - 1) * 100)}%, so the median got worse` : ""}.`;
      frames.push({ sim, shown: 0, n, line: sim.mi === 0 ? [3, 5] : [6, 8, 9], note, vars: { requests: n, p50: `${Math.round(pctl(res, 50))} ms`, p99: `${Math.round(p99)} ms`, "p99.9": `${Math.round(p999)} ms`, "extra load": `${Math.round(sim.cur.extra * 100)}%` } });
    });
    return frames;
  }

  Viz.register("resilience-hedge", (el) => Viz.player(el, {
    title: "Hedged requests: trade a little load for a much shorter tail",
    tag: "MONTE CARLO · 4,000 REQUESTS",
    legend: [["done", "winning call"], ["bad", "cancelled loser"], ["path", "p50 / p99 / p99.9"]],
    code: [
      "ctx, cancel := context.WithCancel(ctx)",
      "defer cancel()              // stops the loser",
      "res := make(chan result, 2)",
      "go func() { res <- call(ctx, replicaA) }()",
      "select {",
      "case r := <-res: return r   // fast path",
      "case <-time.After(hedgeDelay): // about p95",
      "}",
      "go func() { res <- call(ctx, replicaB) }()",
      "return <-res                // first one wins",
    ],
    codeLang: "go",
    inputs: [
      { key: "mode", label: "mode", type: "select", value: HG_MODES[1], options: HG_MODES },
      { key: "d", label: "d (ms)", value: "50", width: 50 },
      { key: "slow", label: "slow %", value: "3", width: 44 },
      { key: "congestion", label: "load sensitivity %", value: "30", width: 44 },
      { key: "seed", label: "seed", value: "1", width: 44 },
    ],
    random: () => ({ mode: pick(HG_MODES), d: pick(["25", "40", "50", "80", "150"]), slow: String(Viz.rand(1, 10)), congestion: pick(["0", "30", "60"]), seed: String(Viz.rand(1, 999)) }),
    build: (v) => {
      const o = { mode: v.mode, d: int(v.d, "d", 1, 2000), slow: num(v.slow, "Slow %", 0, 50), congestion: num(v.congestion, "Load sensitivity", 0, 200), seed: int(v.seed, "Seed", 0, 1e6) };
      if (!HG_MODES.includes(o.mode)) throw new Error("Pick a mode from the list.");
      return hedgeFrames(o);
    },
    speed: 1500,
    render(f) {
      const sim = f.sim, o = sim.o, W = 600;
      if (f.shown) {
        const rows = f.sample.slice(0, f.shown).map((i) => sim.cur.reqs[i]), maxT = 1000, pl = 70, X = (t) => pl + (Math.min(t, maxT) / maxT) * (W - pl - 14), rh = 26;
        let s = `<svg class="rs-gantt" viewBox="0 0 ${W} ${30 + 5 * rh}" width="${W}" role="img" aria-label="sample requests">`;
        for (let t = 0; t <= maxT; t += 200) s += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="8" y2="${14 + 5 * rh}"/><text class="ax" x="${X(t)}" y="${26 + 5 * rh}" text-anchor="middle">${t} ms</text>`;
        if (sim.mi === 1) s += `<line class="dl" x1="${X(o.d)}" x2="${X(o.d)}" y1="4" y2="${14 + 5 * rh}"/><text class="dlt" x="${X(o.d) + 3}" y="12">d = ${o.d} ms</text>`;
        rows.forEach((r, k) => {
          const y = 16 + k * rh;
          s += `<text class="lane" x="${pl - 6}" y="${y + 12}" text-anchor="end">request ${k + 1}</text>`;
          const one = r.l2 === undefined || r.win === 1, h2 = r.l2 !== undefined;
          s += `<rect class="iv ${one ? "work" : "waste"}" x="${X(0)}" y="${y + (h2 ? 0 : 4)}" width="${Math.max(1.5, X(one ? r.l1 : r.res) - X(0)).toFixed(1)}" height="${h2 ? 9 : 14}"/>`;
          if (h2) s += `<rect class="iv ${r.win === 2 ? "work" : "waste"}" x="${X(r.at)}" y="${y + 11}" width="${Math.max(1.5, X(r.win === 2 ? r.at + r.l2 : r.res) - X(r.at)).toFixed(1)}" height="9"/>`;
          if (r.l1 > maxT && one) s += `<text class="mk bad" x="${W - 12}" y="${y + 12}" text-anchor="end">${Math.round(r.l1)} ms ›</text>`;
          s += `<text class="mk" x="${Math.min(W - 60, X(r.res) + 4)}" y="${y + 12}">${Math.round(r.res)} ms</text>`;
        });
        return `<div class="rs-fit">${s}</div>` + stats([["mode", o.mode], ["hedge delay", sim.mi === 1 ? `${o.d} ms` : sim.mi === 2 ? "0 ms" : "–"]]);
      }
      const bins = 30, lo = Math.log(5), hi = Math.log(1500), bi = (v) => Math.max(0, Math.min(bins - 1, Math.floor(((Math.log(Math.max(5, v)) - lo) / (hi - lo)) * bins)));
      const n = f.n || 0, cur = Array(bins).fill(0), base = Array(bins).fill(0);
      sim.cur.reqs.slice(0, n).forEach((r) => cur[bi(r.res)]++);
      sim.base.reqs.slice(0, n).forEach((r) => base[bi(r.res)]++);
      const H = 202, pl = 44, pr = 12, pt = 38, pb = 24, ih = H - pt - pb, bw = (W - pl - pr) / bins, ymax = Math.sqrt(Math.max(1, ...cur, ...base));
      const Y = (c) => pt + ih - (Math.sqrt(c) / ymax) * ih, Xv = (v) => pl + ((Math.log(Math.max(5, v)) - lo) / (hi - lo)) * (W - pl - pr);
      let s = `<svg class="rs-chart" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="latency histogram"><text class="ax" x="4" y="11">requests (√ scale)</text>`;
      cur.forEach((c, i) => { if (c) s += `<rect class="bar ${i >= bi(o.mi === 1 ? o.d : 1e9) && sim.mi === 1 ? "path" : "done"}" x="${(pl + i * bw + 0.5).toFixed(1)}" y="${Y(c).toFixed(1)}" width="${(bw - 1).toFixed(1)}" height="${(pt + ih - Y(c)).toFixed(1)}"/>`; });
      if (sim.mi !== 0) s += `<polyline class="ln ghost" points="${base.map((c, i) => `${(pl + (i + 0.5) * bw).toFixed(1)},${Y(c).toFixed(1)}`).join(" ")}"/>`;
      [5, 10, 20, 50, 100, 200, 500, 1000].forEach((v) => { s += `<text class="ax" x="${Xv(v).toFixed(1)}" y="${H - 8}" text-anchor="middle">${v}</text>`; });
      s += `<text class="ax" x="${W - pr}" y="${H - 8}" text-anchor="end">ms</text>`;
      if (n) {
        const res = sim.cur.reqs.slice(0, n).map((r) => r.res);
        const ends = [-1e9, -1e9];
        [[50, "p50"], [99, "p99"], [99.9, "p99.9"]].forEach(([p, l]) => {
          const v = pctl(res, p), x = Xv(v), txt = `${l} ${Math.round(v)}`, w = txt.length * 6 + 6;
          const row = x + 3 >= ends[0] ? 0 : 1, ty = row ? pt - 18 : pt - 7;
          ends[row] = x + 3 + w;
          s += `<line class="pmk" x1="${x.toFixed(1)}" x2="${x.toFixed(1)}" y1="${pt - 4}" y2="${pt + ih}"/><text class="pmt" x="${(x + 3).toFixed(1)}" y="${ty}">${txt}</text>`;
        });
      }
      s += "</svg>";
      const res = sim.cur.reqs.slice(0, n).map((r) => r.res), b = sim.base.reqs.slice(0, n).map((r) => r.res);
      return `<div class="rs-fit">${s}</div>` + (sim.mi !== 0 ? `<p class="rs-cap">Dashed line: the same traffic without hedging.</p>` : "") + stats([["p50", n ? `${Math.round(pctl(res, 50))} ms` : "–"], ["p99", n ? `${Math.round(pctl(res, 99))} ms` : "–", "path"], ["p99.9", n ? `${Math.round(pctl(res, 99.9))} ms` : "–", "path"], ["p99 without hedging", n ? `${Math.round(pctl(b, 99))} ms` : "–"], ["extra requests", `${Math.round(sim.cur.extra * 100)}%`, sim.cur.extra > 0.2 ? "bad" : ""]]);
    },
  }));

  /* =====================================================================
   * 10. Strategy order: the same five strategies, nested differently
   * ===================================================================== */
  const PO = [
    ["recommended: F › T › R › B › A", ["F", "T", "R", "B", "A"]],
    ["timeout outside retry: F › A › R › B", ["F", "A", "R", "B"]],
    ["breaker outside retry: F › T › B › R › A", ["F", "T", "B", "R", "A"]],
    ["fallback inside retry: T › R › F › B › A", ["T", "R", "F", "B", "A"]],
    ["no total timeout: F › R › B › A", ["F", "R", "B", "A"]],
  ];
  const PO_SCN = [["first attempt hangs, then 200", ["slow", "200"]], ["two 503s, then 200", ["503", "503", "200"]], ["dependency down: 503 forever", ["503"]], ["dependency hangs forever", ["slow"]]];
  const PO_NAME = { F: "Fallback", T: "Total timeout 3 s", R: "Retry ×3 (4 attempts)", B: "Circuit breaker", A: "Attempt timeout 1 s" };
  const PO_LINE = { F: 1, T: 2, R: 3, B: 4, A: 5 };

  function pipeSim(order, scen) {
    const ev = [], bars = [], br = { fails: 0, open: false };
    let t = 0, ai = 0;
    const log = (i, text, cls) => ev.push({ t, i, text, cls: cls || "", bars: bars.map((b) => ({ ...b })), br: { ...br } });
    const exec = (i, dls) => {
      if (i === order.length) {
        const out = scen[Math.min(ai, scen.length - 1)], dur = out === "slow" ? 5000 : out === "503" ? 50 : 100;
        ai++;
        const dl = dls.reduce((m, d) => (d.at < m.at ? d : m), { at: Infinity, by: -1 });
        const bar = { k: ai, start: t, end: t, out };
        bars.push(bar);
        log(i, `attempt ${ai} sent to the dependency`, "");
        if (t + dur > dl.at) { t = dl.at; bar.end = t; bar.cut = true; log(dl.by, `attempt ${ai} is cancelled at ${t} ms: the ${PO_NAME[order[dl.by]].toLowerCase()} fired`, "bad"); return { ok: false, err: "timeout", by: dl.by }; }
        t += dur; bar.end = t;
        if (out === "200") { log(i, `attempt ${ai} returns 200 OK after ${dur} ms`, "done"); return { ok: true }; }
        log(i, `attempt ${ai} returns 503 after ${dur} ms`, "bad");
        return { ok: false, err: "503" };
      }
      const k = order[i];
      if (k === "A" || k === "T") {
        const d = { by: i, at: t + (k === "A" ? 1000 : 3000) };
        if (k === "T") log(i, `total timeout starts: everything must finish by ${d.at} ms`, "");
        const r = exec(i + 1, [...dls, d]);
        if (!r.ok && r.err === "timeout" && r.by === i) { log(i, `${k === "A" ? "attempt" : "total"} timeout turns that into TimeoutRejectedException`, "bad"); return { ok: false, err: k === "A" ? "attempt timeout" : "total timeout" }; }
        return r;
      }
      if (k === "R") {
        for (let a = 0; a < 4; a++) {
          const r = exec(i + 1, dls);
          if (r.ok) return r;
          if (r.err === "timeout") return r;
          if (a === 3) { log(i, `retry gives up after 4 attempts (last error: ${r.err})`, "bad"); return r; }
          const delay = 200 * 2 ** a, dl = dls.reduce((m, d) => (d.at < m.at ? d : m), { at: Infinity, by: -1 });
          log(i, `retry sees "${r.err}", waits ${delay} ms before attempt ${a + 2}`, "visit");
          if (t + delay >= dl.at) { t = dl.at; log(dl.by, `the ${PO_NAME[order[dl.by]].toLowerCase()} fires during the backoff`, "bad"); return { ok: false, err: "timeout", by: dl.by }; }
          t += delay;
        }
      }
      if (k === "B") {
        if (br.open) { log(i, "breaker is open: BrokenCircuitException in 0 ms, no call made", "visit"); return { ok: false, err: "circuit open" }; }
        const r = exec(i + 1, dls);
        if (r.ok) { br.fails = 0; return r; }
        if (r.err === "timeout") return r;
        br.fails++;
        if (br.fails >= 3) { br.open = true; log(i, `breaker records failure ${br.fails} and <b>opens</b>`, "bad"); }
        else log(i, `breaker records failure ${br.fails} of 3`, "");
        return r;
      }
      if (k === "F") {
        const r = exec(i + 1, dls);
        if (r.ok) return r;
        log(i, `fallback catches "${r.err}" and returns the cached response`, "visit");
        return { ok: true, stale: true };
      }
      return { ok: false, err: "?" };
    };
    const r = exec(0, []);
    log(-1, r.ok ? (r.stale ? `the caller gets <b>stale cached data</b> after ${t} ms` : `the caller gets <b>fresh data</b> after ${t} ms`) : `the caller gets an <b>error</b> (${r.err}) after ${t} ms`, r.ok && !r.stale ? "done" : "bad");
    return { ev, result: r, t, attempts: ai, br };
  }

  function pipeFrames(o) {
    const oi = PO.findIndex((x) => x[0] === o.order), si = PO_SCN.findIndex((x) => x[0] === o.scenario), order = PO[oi][1], sim = pipeSim(order, PO_SCN[si][1]);
    const frames = [{ order, sim, k: -1, active: -1, line: 6, note: `Pipeline (outermost first): <b>${order.map((x) => PO_NAME[x]).join(" › ")}</b>. Scenario: <b>${o.scenario}</b>. The breaker opens after 3 consecutive failures; retry backoff is 200, 400, then 800 ms.`, vars: { order: order.join(" › ") } }];
    sim.ev.forEach((e, k) => {
      let note = `t=${e.t} ms: ${e.text}.`;
      if (k === sim.ev.length - 1) {
        const tips = {
          0: "Each attempt has its own 1 s budget, retries happen inside the 3 s total budget, the breaker counts every attempt, and the fallback catches whatever escapes.",
          1: "The 1 s timeout wraps the whole retry loop, so it acts as a total timeout: a single slow attempt uses up all of it and <b>no retry ever happens</b>.",
          2: "The breaker only sees the result of the whole retry loop, so 4 failed attempts count as <b>1 failure</b>. It needs 4× as many failed calls before it opens.",
          3: "The fallback sits inside the retry, so the first error is turned into a cached \"success\". Retry never sees a failure and <b>never tries again</b>, even when attempt 2 would have worked.",
          4: "Nothing bounds the whole operation: the caller waits for every attempt timeout plus every backoff.",
        };
        note += ` ${tips[oi]}`;
      }
      frames.push({ order, sim, k, active: e.i, line: e.i >= 0 && e.i < order.length ? PO_LINE[order[e.i]] : e.i === order.length ? [] : 6, note,
        vars: { "t (ms)": e.t, attempts: e.bars.length, breaker: e.br.open ? "OPEN" : `closed (${e.br.fails}/3)` } });
    });
    return frames;
  }

  Viz.register("resilience-pipeline", (el) => Viz.player(el, {
    title: "Strategy order: the same strategies, nested differently",
    tag: "STEP-BY-STEP TRACE",
    legend: [["done", "success"], ["bad", "failure / timeout"], ["visit", "retry wait / fallback / short-circuit"]],
    code: [
      "new ResiliencePipelineBuilder<Response>()",
      "  .AddFallback(cachedResponse)  // F: outermost",
      "  .AddTimeout(TimeSpan.FromSeconds(3)) // T",
      "  .AddRetry(new() { MaxRetryAttempts = 3 }) // R",
      "  .AddCircuitBreaker(breakerOptions) // B",
      "  .AddTimeout(TimeSpan.FromSeconds(1)) // A",
      "  .Build();      // first added = outermost",
    ],
    codeLang: "csharp",
    inputs: [
      { key: "order", label: "order (outer › inner)", type: "select", value: PO[0][0], options: PO.map((x) => x[0]) },
      { key: "scenario", label: "dependency", type: "select", value: PO_SCN[0][0], options: PO_SCN.map((x) => x[0]) },
    ],
    random: () => ({ order: pick(PO.map((x) => x[0])), scenario: pick(PO_SCN.map((x) => x[0])) }),
    build: (v) => {
      if (!PO.some((x) => x[0] === v.order) || !PO_SCN.some((x) => x[0] === v.scenario)) throw new Error("Pick an order and a scenario from the lists.");
      return pipeFrames(v);
    },
    speed: 1300,
    render(f) {
      const { order, sim } = f, e = f.k >= 0 ? sim.ev[f.k] : null, bars = e ? e.bars : [];
      let onion = `<div class="rs-onion">`;
      order.forEach((x, i) => { onion += `<div class="rs-layer${f.active === i ? " on" : ""}${e && i === f.active ? ` ${e.cls}` : ""}"><span>${PO_NAME[x]}</span>`; });
      onion += `<div class="rs-core${f.active === order.length ? ` on ${e ? e.cls : ""}` : ""}">dependency</div>` + "</div>".repeat(order.length) + "</div>";
      const W = 600, pl = 70, maxT = Math.max(3600, sim.t + 200), X = (t) => pl + (t / maxT) * (W - pl - 12), rh = 22, n = Math.max(3, sim.attempts), H = 30 + n * rh;
      let g = `<svg class="rs-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="attempt timeline">`;
      for (let t = 0; t <= maxT; t += 1000) g += `<line class="grid" x1="${X(t)}" x2="${X(t)}" y1="6" y2="${H - 18}"/><text class="ax" x="${X(t)}" y="${H - 6}" text-anchor="middle">${t / 1000}s</text>`;
      if (order.includes("T")) g += `<line class="dl" x1="${X(3000)}" x2="${X(3000)}" y1="4" y2="${H - 18}"/><text class="dlt" x="${X(3000) - 3}" y="12" text-anchor="end">total 3 s</text>`;
      bars.forEach((b) => {
        const y = 10 + (b.k - 1) * rh;
        g += `<text class="lane" x="${pl - 6}" y="${y + 12}" text-anchor="end">attempt ${b.k}</text><rect class="iv ${b.out === "200" ? "work" : b.cut ? "waste" : "wait"}" x="${X(b.start)}" y="${y + 3}" width="${Math.max(2, X(b.end) - X(b.start)).toFixed(1)}" height="12"/>`;
        g += `<text class="mk ${b.out === "200" ? "" : "bad"}" x="${(X(b.end) + 4).toFixed(1)}" y="${y + 13}">${b.cut ? "timed out" : b.out}</text>`;
      });
      if (e) g += `<line class="now" x1="${X(e.t)}" x2="${X(e.t)}" y1="4" y2="${H - 18}"/>`;
      g += "</svg>";
      const done = f.k === sim.ev.length - 1, r = sim.result;
      return `<div class="rs-pipe">${onion}<div class="rs-fit">${g}</div></div>` + stats([["caller gets", done ? (r.ok ? (r.stale ? "stale fallback" : "fresh 200") : "error") : "…", done ? (r.ok && !r.stale ? "done" : "bad") : ""], ["waited", done ? `${sim.t} ms` : e ? `${e.t} ms…` : "–"], ["attempts", e ? e.bars.length : 0], ["breaker", e ? (e.br.open ? "OPEN" : `closed ${e.br.fails}/3`) : "closed", e && e.br.open ? "bad" : ""]]);
    },
  }));

})();
