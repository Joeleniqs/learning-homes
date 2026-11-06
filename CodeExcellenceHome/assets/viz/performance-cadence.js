/* Visualizers for "The Performance Cadence". Every frame is computed by running a seeded simulation. */
(() => {
  const esc = (s) => Viz.esc(s);

  /* ---------- small numeric helpers ---------- */
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
  const gauss = (r) => {
    const u = Math.max(r(), 1e-12), v = r();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  };
  const sum = (a) => a.reduce((s, x) => s + x, 0);
  const mean = (a) => (a.length ? sum(a) / a.length : 0);
  const sd = (a) => {
    if (a.length < 2) return 0;
    const m = mean(a);
    return Math.sqrt(sum(a.map((x) => (x - m) ** 2)) / (a.length - 1));
  };
  /* Nearest-rank percentile on a sorted array (what most latency tools report). */
  const pct = (sorted, p) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.max(0, Math.ceil((p / 100) * sorted.length) - 1))] : 0);
  const median = (a) => pct([...a].sort((x, y) => x - y), 50);
  const T975 = [0, 12.71, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.16, 2.145, 2.131, 2.12, 2.11, 2.101, 2.093, 2.086, 2.08, 2.074, 2.069, 2.064, 2.06, 2.056, 2.052, 2.048, 2.045, 2.042];
  const tcrit = (df) => (df < 1 ? Infinity : df <= 30 ? T975[Math.floor(df)] : df <= 60 ? 2.0 : 1.98);
  const ci = (a) => {
    const m = mean(a), s = sd(a), n = a.length;
    return { m, s, n, half: n > 1 ? (tcrit(n - 1) * s) / Math.sqrt(n) : Infinity };
  };
  const welch = (A, B) => {
    const va = A.s ** 2 / A.n, vb = B.s ** 2 / B.n;
    const t = (A.m - B.m) / Math.sqrt(va + vb || 1e-12);
    const df = (va + vb) ** 2 / ((va ** 2) / (A.n - 1) + (vb ** 2) / (B.n - 1) || 1e-12);
    return { t, df, crit: tcrit(df), sig: Math.abs(t) > tcrit(df) };
  };
  const f1 = (x) => (Math.abs(x) >= 100 ? x.toFixed(0) : Math.abs(x) >= 10 ? x.toFixed(1) : x.toFixed(2));
  const ms = (x) => `${f1(x)} ms`;
  const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x));
  const num = (s, label, lo, hi, int = false) => {
    const n = Number(s);
    if (!Number.isFinite(n) || n < lo || n > hi || (int && !Number.isInteger(n))) throw new Error(`${label} must be ${int ? "a whole number" : "a number"} from ${lo} to ${hi}.`);
    return n;
  };

  /* =====================================================================
   * 1. Latency distribution: percentiles, averages, fan-out, coordinated omission
   * ===================================================================== */
  const genLatency = (n, tailPct, seed, tailMult = 1) => {
    const r = rng(seed), xs = [];
    for (let i = 0; i < n; i++) {
      const slow = r() < tailPct / 100, g = gauss(r);
      xs.push(slow ? 320 * tailMult * Math.exp(0.45 * g) : 40 * Math.exp(0.3 * g));
    }
    return xs;
  };
  const HX0 = 5, HX1 = 5000, NB = 42;
  const binOf = (x) => clamp(Math.floor((Math.log10(clamp(x, HX0, HX1 - 1e-6) / HX0) / 3) * NB), 0, NB - 1);
  const histo = (xs) => {
    const b = Array(NB).fill(0);
    for (const x of xs) b[binOf(x)]++;
    return b;
  };

  const histSvg = (f) => {
    const W = 560, H = 236, L = 34, R = 10, T = 66, B = 30, pw = W - L - R, ph = H - T - B;
    const X = (v) => L + (Math.log10(clamp(v, HX0, HX1) / HX0) / 3) * pw;
    const max = Math.max(1, ...f.bins, ...(f.over || [0]));
    const Y = (c) => (Math.sqrt(c) / Math.sqrt(max)) * ph;
    const bw = pw / NB;
    let s = `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Latency histogram">`;
    s += `<line class="ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;
    for (const t of [5, 10, 20, 50, 100, 200, 500, 1000, 2000, 5000]) {
      s += `<line class="grid" x1="${X(t)}" y1="${T}" x2="${X(t)}" y2="${T + ph}"/><text class="lbl" x="${X(t)}" y="${T + ph + 14}" text-anchor="middle">${t >= 1000 ? t / 1000 + "s" : t}</text>`;
    }
    s += `<text class="lbl" x="${L + pw}" y="${H - 2}" text-anchor="end">latency (ms, log scale) · bar height = √count</text>`;
    f.bins.forEach((c, i) => {
      if (!c) return;
      const lo = HX0 * 10 ** ((3 * i) / NB);
      const cls = f.shade && lo >= f.shade ? "pc-f-bad" : "pc-f-visit";
      s += `<rect class="${cls}" x="${L + i * bw + 0.5}" y="${T + ph - Y(c)}" width="${bw - 1}" height="${Y(c)}"><title>${c} requests ≥ ${f1(lo)} ms</title></rect>`;
    });
    if (f.over) {
      let d = "";
      f.over.forEach((c, i) => { const y = T + ph - Y(c); d += `${i ? "L" : "M"}${L + i * bw},${y} L${L + (i + 1) * bw},${y} `; });
      s += `<path class="pc-s-path thick" d="${d}"/>`;
    }
    (f.marks || []).forEach((m, k) => {
      const x = X(m.v), ty = 14 + k * 13;
      const anchor = x > W - 90 ? "end" : x < L + 50 ? "start" : "middle";
      s += `<line class="pc-s-${m.c} mk" x1="${x}" y1="${ty + 3}" x2="${x}" y2="${T + ph}"/><text class="pc-t-${m.c} b" x="${x + (anchor === "end" ? -4 : anchor === "start" ? 4 : 0)}" y="${ty}" text-anchor="${anchor}">${esc(m.label)} ${ms(m.v)}</text>`;
    });
    return s + "</svg>";
  };

  const coSim = (stall, seed) => {
    const r = rng(seed), N = 1000, gap = 10, st = 3000, se = 3000 + stall;
    let prevDone = 0;
    const rec = [], cor = [], pts = [];
    for (let k = 0; k < N; k++) {
      const sched = k * gap;
      const start = Math.max(sched, prevDone);            /* closed loop: wait for the previous reply */
      let begin = start;
      const svc = 3 * Math.exp(0.25 * gauss(r));
      let done;
      if (begin >= st && begin < se) begin = se;
      if (begin < st && begin + svc > st) done = begin + svc + stall;
      else done = begin + svc;
      prevDone = done;
      rec.push(done - start);
      cor.push(done - sched);
      pts.push({ sched, rec: done - start, cor: done - sched });
    }
    return { rec, cor, pts, st, se };
  };
  const coSvg = (f) => {
    const W = 560, H = 230, L = 40, R = 10, T = 18, B = 34, pw = W - L - R, ph = H - T - B;
    const top = Math.max(10, ...f.co.cor) * 1.15;
    const Y = (v) => T + ph - (Math.log10(clamp(v, 1, top)) / Math.log10(top)) * ph;
    const X = (t) => L + (t / 10000) * pw;
    let s = `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Coordinated omission timeline">`;
    s += `<rect class="pc-f-active soft" x="${X(f.co.st)}" y="${T}" width="${Math.max(2, X(f.co.se) - X(f.co.st))}" height="${ph}"/><text class="pc-t-active b" x="${X(f.co.st)}" y="${T - 5}">server stall</text>`;
    for (const v of [1, 10, 100, 1000, 10000]) if (v <= top) s += `<line class="grid" x1="${L}" y1="${Y(v)}" x2="${L + pw}" y2="${Y(v)}"/><text class="lbl" x="${L - 4}" y="${Y(v) + 4}" text-anchor="end">${v >= 1000 ? v / 1000 + "s" : v}</text>`;
    s += `<line class="ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;
    for (let t = 0; t <= 10000; t += 2000) s += `<text class="lbl" x="${X(t)}" y="${T + ph + 14}" text-anchor="middle">${t / 1000}s</text>`;
    s += `<text class="lbl" x="${L + pw}" y="${H - 2}" text-anchor="end">intended send time → · y = latency (ms, log)</text>`;
    if (f.showCor) s += `<polyline class="pc-s-bad thick" points="${f.co.pts.map((p) => `${X(p.sched).toFixed(1)},${Y(p.cor).toFixed(1)}`).join(" ")}"/>`;
    for (const p of f.co.pts) s += `<circle class="pc-dot-visit" cx="${X(p.sched)}" cy="${Y(p.rec)}" r="1.6"/>`;
    return s + "</svg>";
  };
  const pTable = (rows) => `<table class="pc-table"><tr><th></th><th>p50</th><th>p90</th><th>p99</th><th>p99.9</th><th>max</th></tr>${rows.map(([name, xs, cls]) => {
    const s = [...xs].sort((a, b) => a - b);
    return `<tr class="${cls}"><th>${esc(name)}</th>${[50, 90, 99, 99.9, 100].map((p) => `<td>${ms(pct(s, p))}</td>`).join("")}</tr>`;
  }).join("")}</table>`;

  Viz.register("performance-cadence-latency", (el) => Viz.player(el, {
    title: "Why averages lie: a latency distribution, its percentiles, and coordinated omission",
    legend: [["visit", "requests (histogram)"], ["done", "p50"], ["path", "mean"], ["active", "p95"], ["bad", "p99 / tail"]],
    codeLang: "python",
    code: [
      "xs = sorted(latencies)",
      "p = lambda q: xs[ceil(q/100*len(xs)) - 1]",
      "p50, p95, p99 = p(50), p(95), p(99)",
      "mean = sum(xs) / len(xs)",
      "page = max(call() for _ in range(fan_out))",
      "measured = done - actual_send  # closed",
      "corrected = done - intended_send  # open",
    ],
    inputs: [
      { key: "n", label: "requests", value: "4000", width: 80 },
      { key: "tail", label: "slow path %", value: "3", width: 80 },
      { key: "fan", label: "fan-out N", value: "10", width: 80 },
      { key: "stall", label: "stall (ms)", value: "1000", width: 80 },
      { key: "seed", label: "seed", value: "7", width: 60 },
    ],
    random: () => ({ n: String(Viz.rand(10, 60) * 100), tail: String(Viz.rand(1, 8)), fan: String(Viz.rand(3, 30)), stall: String(Viz.rand(3, 20) * 100), seed: String(Viz.rand(1, 999)) }),
    build: ({ n, tail, fan, stall, seed }) => {
      const N = num(n, "requests", 200, 20000, true), tp = num(tail, "slow path %", 0, 30), F = num(fan, "fan-out N", 1, 100, true);
      const S = num(stall, "stall", 50, 5000, true), sd0 = num(seed, "seed", 0, 1e9, true);
      const xs = genLatency(N, tp, sd0), sorted = [...xs].sort((a, b) => a - b);
      const p50 = pct(sorted, 50), p95 = pct(sorted, 95), p99 = pct(sorted, 99), p999 = pct(sorted, 99.9), m = mean(xs);
      const fr = [];
      const part = xs.slice(0, Math.max(20, Math.round(N / 10)));
      fr.push({ view: "h", bins: histo(part), line: 0, vars: { requests: part.length }, note: `The first ${part.length} requests land. Each bar counts requests in a latency bucket. Already you can see <b>two humps</b>: a fast path and a slow path (cache miss, GC pause, retry, cold connection).` });
      fr.push({ view: "h", bins: histo(xs), line: 0, vars: { requests: N, "slow %": tp }, note: `All ${N} requests. Real latency is <b>right-skewed with a long tail</b>, never a bell curve: it is bounded below by the speed of the fast path but unbounded above. That is why one number cannot describe it.` });
      fr.push({ view: "h", bins: histo(xs), line: [1, 2], marks: [{ v: p50, c: "done", label: "p50" }], vars: { p50: ms(p50) }, note: `<b>p50 (median)</b> = ${ms(p50)}: half of the requests were faster. It describes the typical request, and it is blind to everything in the tail.` });
      fr.push({ view: "h", bins: histo(xs), line: 2, marks: [{ v: p50, c: "done", label: "p50" }, { v: p95, c: "active", label: "p95" }], vars: { p50: ms(p50), p95: ms(p95) }, note: `<b>p95</b> = ${ms(p95)}: 1 request in 20 is slower than this. SLOs are usually written on p95 or p99 because that is what a busy user hits several times per session.` });
      fr.push({ view: "h", bins: histo(xs), line: 2, shade: p99, marks: [{ v: p50, c: "done", label: "p50" }, { v: p95, c: "active", label: "p95" }, { v: p99, c: "bad", label: "p99" }], vars: { p50: ms(p50), p95: ms(p95), p99: ms(p99), "p99.9": ms(p999) }, note: `<b>p99</b> = ${ms(p99)}, which is ${f1(p99 / p50)}× the median. The red bars are the slowest 1%. At 1,000 requests per second that is <b>10 unhappy users every second</b>, often your heaviest customers with the biggest carts.` });
      const below = xs.filter((x) => x < m).length / N;
      fr.push({ view: "h", bins: histo(xs), line: 3, shade: p99, marks: [{ v: p50, c: "done", label: "p50" }, { v: m, c: "path", label: "mean" }, { v: p95, c: "active", label: "p95" }, { v: p99, c: "bad", label: "p99" }], vars: { mean: ms(m), p50: ms(p50), p99: ms(p99), "below mean": `${(below * 100).toFixed(0)}%` }, note: `The <b>mean</b> is ${ms(m)}. ${(below * 100).toFixed(0)}% of requests are faster than it, and it sits nowhere near the tail. The mean mixes two populations into a number that <b>no request actually experienced</b>.` });
      const xs2 = genLatency(N, tp, sd0, 2), s2 = [...xs2].sort((a, b) => a - b), m2 = mean(xs2), p99b = pct(s2, 99), p50b = pct(s2, 50);
      const dm = ((m2 - m) / m) * 100, d99 = ((p99b - p99) / p99) * 100;
      fr.push({ view: "h", bins: histo(xs2), over: histo(xs), line: [2, 3], shade: pct(s2, 99), marks: [{ v: p50b, c: "done", label: "p50" }, { v: m2, c: "path", label: "mean" }, { v: p99b, c: "bad", label: "p99" }], vars: { "mean Δ": `${dm >= 0 ? "+" : ""}${dm.toFixed(0)}%`, "p50 Δ": `${(((p50b - p50) / p50) * 100).toFixed(0)}%`, "p99 Δ": `${d99 >= 0 ? "+" : ""}${d99.toFixed(0)}%` }, note: `A regression ships: the slow path becomes <b>2× slower</b> (outline = before). The mean moves ${dm.toFixed(0)}%, the median ${(((p50b - p50) / p50) * 100).toFixed(0)}%, but <b>p99 moves ${d99.toFixed(0)}%</b>. A dashboard of averages would call this noise. ${tp === 0 ? "(With 0% slow path nothing changes: try a non-zero slow path.)" : ""}` });
      const r2 = rng(sd0 + 1), pages = [];
      let hit = 0;
      for (let i = 0; i < 1500; i++) {
        let mx = 0, any = false;
        for (let k = 0; k < F; k++) {
          const slow = r2() < tp / 100, g = gauss(r2);
          const x = slow ? 320 * Math.exp(0.45 * g) : 40 * Math.exp(0.3 * g);
          mx = Math.max(mx, x); if (x > p99) any = true;
        }
        pages.push(mx); if (any) hit++;
      }
      const ps = [...pages].sort((a, b) => a - b);
      fr.push({ view: "h", bins: histo(pages), over: histo(xs), line: 4, marks: [{ v: p50, c: "done", label: "call p50" }, { v: pct(ps, 50), c: "bad", label: "page p50" }], vars: { "fan-out": F, "pages > call p99": `${((hit / pages.length) * 100).toFixed(1)}%`, "1 − 0.99^N": `${((1 - 0.99 ** F) * 100).toFixed(1)}%` }, note: `Now a page calls <b>${F}</b> backends in parallel and waits for the slowest. Page latency is the <b>max</b> of ${F} draws, so ${((hit / pages.length) * 100).toFixed(1)}% of pages include at least one backend call slower than the backend's p99 (theory: 1 − 0.99<sup>${F}</sup> = ${((1 - 0.99 ** F) * 100).toFixed(1)}%). <b>The backend's tail is the page's median</b> once fan-out is large.` });
      const co = coSim(S, sd0 + 2);
      fr.push({ view: "co", co, showCor: false, line: 5, vars: { "intended rate": "100 req/s", stall: `${S} ms` }, note: `<b>Coordinated omission.</b> A closed-loop load tester (one connection, waits for each reply) aims for 1 request every 10 ms. The server stalls for ${S} ms at t = 3 s. The tester is stuck waiting, so it <b>never sends</b> the ~${Math.round(S / 10)} requests that real users would have sent. It records <b>one</b> slow sample, and everything looks fine.` });
      fr.push({ view: "co", co, showCor: true, line: [5, 6], vars: { "measured p99": ms(pct([...co.rec].sort((a, b) => a - b), 99)), "corrected p99": ms(pct([...co.cor].sort((a, b) => a - b), 99)) }, note: `Measure from the <b>intended</b> send time instead (red). Every request scheduled during the stall waited for it. Measured p99 is ${ms(pct([...co.rec].sort((a, b) => a - b), 99))}; the truth is ${ms(pct([...co.cor].sort((a, b) => a - b), 99))}. Fix it with open-model tools (wrk2 <code>-R</code>, k6 arrival-rate executors, Gatling open injection) or HdrHistogram's correction.` });
      return fr;
    },
    render: (f) => (f.view === "h" ? histSvg(f) : `<div class="pc-col">${coSvg(f)}${pTable([["measured", f.co.rec, "visit"], ...(f.showCor ? [["corrected", f.co.cor, "bad"]] : [])])}</div>`),
  }));

  /* =====================================================================
   * 2. Amdahl's law: speeding up a 10% part vs a 60% part
   * ===================================================================== */
  const amdahl = (p, s) => 1 / ((1 - p) + p / s);
  Viz.register("performance-cadence-amdahl", (el) => Viz.player(el, {
    title: "Amdahl's law: the part you speed up caps the whole",
    legend: [["visit", "untouched time"], ["active", "small part being optimised"], ["path", "big part being optimised"], ["done", "time saved"]],
    codeLang: "python",
    code: [
      "def overall(p, s):",
      "    # p: share of time, s: local speed-up",
      "    return 1 / ((1 - p) + p / s)",
      "limit = 1 / (1 - p)   # s -> infinity",
    ],
    inputs: [
      { key: "a", label: "small part %", value: "10", width: 80 },
      { key: "b", label: "big part %", value: "60", width: 80 },
      { key: "base", label: "request (ms)", value: "200", width: 90 },
      { key: "smax", label: "max speed-up", value: "20", width: 90 },
    ],
    random: () => ({ a: String(Viz.rand(3, 25)), b: String(Viz.rand(40, 90)), base: String(Viz.rand(5, 50) * 10), smax: String([5, 10, 20, 50][Viz.rand(0, 3)]) }),
    build: ({ a, b, base, smax }) => {
      const pa = num(a, "small part %", 1, 95) / 100, pb = num(b, "big part %", 1, 95) / 100, T = num(base, "request", 1, 100000), sm = num(smax, "max speed-up", 2, 1000);
      const steps = [1, 1.5, 2, 3, 5, 10, 20, 50, 100, 1000].filter((s) => s <= sm);
      if (steps[steps.length - 1] !== sm) steps.push(sm);
      steps.push(Infinity);
      return steps.map((s, i) => {
        const oa = amdahl(pa, s), ob = amdahl(pb, s);
        const note = i === 0
          ? `Baseline ${ms(T)}. Option A speeds up a part that takes <b>${(pa * 100).toFixed(0)}%</b> of the time, option B a part that takes <b>${(pb * 100).toFixed(0)}%</b>. Both teams promise the same local speed-up. Which matters?`
          : s === Infinity
            ? `Make each part <b>infinitely fast</b> (delete it). A can never beat <b>${oa.toFixed(2)}×</b> and B caps at <b>${ob.toFixed(2)}×</b>. The untouched ${((1 - pa) * 100).toFixed(0)}% still runs. This is why you <b>profile first</b>: the size of the slice bounds the prize.`
            : `Local speed-up <b>${s}×</b>. A saves ${ms(T * pa * (1 - 1 / s))} → overall <b>${oa.toFixed(2)}×</b>. B saves ${ms(T * pb * (1 - 1 / s))} → overall <b>${ob.toFixed(2)}×</b>. ${s >= 5 ? "Notice the curves flattening: each extra × buys less, because the other part now dominates." : ""}`;
        return { pa, pb, T, s, sm, oa, ob, line: s === Infinity ? 3 : 2, vars: { s: s === Infinity ? "∞" : s, "A overall": `${oa.toFixed(2)}×`, "B overall": `${ob.toFixed(2)}×`, "A limit": `${(1 / (1 - pa)).toFixed(2)}×`, "B limit": `${(1 / (1 - pb)).toFixed(2)}×` }, note };
      });
    },
    render: (f) => {
      const W = 560, bar = (p, cls, label, o) => {
        const pw = 440, rest = pw * (1 - p), part = (pw * p) / (f.s === Infinity ? Infinity : f.s), saved = pw * p - part;
        return `<div class="pc-amd-row"><div class="pc-amd-lbl"><b>${label}</b><span>${ms(f.T / o)} · ${o.toFixed(2)}×</span></div><div class="pc-amd-bar" style="width:${pw}px"><span class="pc-seg visit" style="width:${rest}px">${rest > 70 ? `other ${((1 - p) * 100).toFixed(0)}%` : ""}</span><span class="pc-seg ${cls}" style="width:${part}px">${part > 40 ? `${((p * 100) / (f.s === Infinity ? Infinity : f.s)).toFixed(1)}%` : ""}</span><span class="pc-seg done ghost" style="width:${saved}px">${saved > 60 ? "saved" : ""}</span></div></div>`;
      };
      const cw = 560, ch = 200, L = 44, R = 70, T = 12, B = 30, pw = cw - L - R, ph = ch - T - B;
      const xmax = Math.log10(Math.max(f.sm, 10) * 1.0001), ymax = Math.max(1 / (1 - f.pb), 2) * 1.08;
      const X = (s) => L + (Math.log10(s) / xmax) * pw, Y = (o) => T + ph - ((o - 1) / (ymax - 1)) * ph;
      const curve = (p) => { let d = ""; for (let k = 0; k <= 60; k++) { const s = 10 ** ((xmax * k) / 60); d += `${k ? "L" : "M"}${X(s).toFixed(1)},${Y(amdahl(p, s)).toFixed(1)} `; } return d; };
      let svg = `<svg class="pc-svg" viewBox="0 0 ${cw} ${ch}" width="${cw}" role="img" aria-label="Overall speed-up curves">`;
      for (let y = 1; y <= ymax; y += ymax > 6 ? 1 : 0.5) svg += `<line class="grid" x1="${L}" y1="${Y(y)}" x2="${L + pw}" y2="${Y(y)}"/><text class="lbl" x="${L - 5}" y="${Y(y) + 4}" text-anchor="end">${y}×</text>`;
      for (const s of [1, 2, 5, 10, 20, 50, 100, 1000]) if (Math.log10(s) <= xmax) svg += `<text class="lbl" x="${X(s)}" y="${T + ph + 14}" text-anchor="middle">${s}×</text>`;
      svg += `<text class="lbl" x="${L + pw}" y="${ch - 2}" text-anchor="end">local speed-up of the part (log)</text>`;
      for (const [p, c, n] of [[f.pa, "active", "A"], [f.pb, "path", "B"]]) {
        const lim = 1 / (1 - p);
        svg += `<line class="pc-s-${c} dash" x1="${L}" y1="${Y(lim)}" x2="${L + pw}" y2="${Y(lim)}"/><text class="pc-t-${c} b" x="${L + pw + 4}" y="${Y(lim) + 4}">${n} max ${lim.toFixed(2)}×</text>`;
        svg += `<path class="pc-s-${c} thick" d="${curve(p)}"/>`;
        const sx = f.s === Infinity ? 10 ** xmax : f.s;
        svg += `<circle class="pc-dot-${c}" cx="${X(sx)}" cy="${Y(f.s === Infinity ? lim : amdahl(p, f.s))}" r="5"/>`;
      }
      svg += `<line class="ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/></svg>`;
      return `<div class="pc-col" style="width:${W}px">${bar(f.pa, "active", "A · optimise the small part", f.oa)}${bar(f.pb, "path", "B · optimise the big part", f.ob)}${svg}</div>`;
    },
  }));

  /* =====================================================================
   * 3. Flame graph explainer: fold stack samples, find the widest plateau
   * ===================================================================== */
  const DEFAULT_STACKS = "main;Server.Handle;Auth.Jwt;Crypto.Verify 4 | main;Server.Handle;Log.Write;Regex.Match 3 | main;Server.Handle;Orders.Get;Db.ReadRows 6 | main;Server.Handle;Orders.Get;ToDto;Regex.Match 3 | main;Server.Handle;Orders.Get;Json.Serialize 4 | main;Server.Handle;Validate;Regex.Match 1 | main;GC.Collect 2";
  const parseStacks = (s) => {
    const lines = String(s).split("|").map((x) => x.trim()).filter(Boolean);
    if (!lines.length) throw new Error("Give at least one stack, e.g. main;work 3");
    if (lines.length > 12) throw new Error("Use at most 12 stacks so the graph stays readable.");
    return lines.map((ln) => {
      const m = ln.match(/^(.+?)\s+(\d+)$/);
      if (!m) throw new Error(`"${ln}" should look like "main;a;b 3" (frames joined by ';', then a count).`);
      const frames = m[1].split(";").map((x) => x.trim()).filter(Boolean), count = Number(m[2]);
      if (frames.length > 8) throw new Error("Keep stacks at most 8 frames deep.");
      if (count < 1 || count > 60) throw new Error("Counts must be 1 to 60.");
      return { frames, count };
    });
  };
  const fold = (stacks) => {
    const root = { name: "all", total: 0, self: 0, kids: new Map(), path: "" };
    for (const { frames, count } of stacks) {
      let node = root; root.total += count;
      for (const fr of frames) {
        if (!node.kids.has(fr)) node.kids.set(fr, { name: fr, total: 0, self: 0, kids: new Map(), path: node.path + "/" + fr });
        node = node.kids.get(fr); node.total += count;
      }
      node.self += count;
    }
    return root;
  };
  const flat = (root) => { const out = []; const go = (n, d) => { out.push({ n, d }); for (const k of n.kids.values()) go(k, d + 1); }; go(root, 0); return out; };
  const flameSvg = (root, f) => {
    const W = 560, RH = 21, all = flat(root), depth = Math.max(...all.map((x) => x.d)) + 1, H = depth * RH + 8;
    let s = `<svg class="pc-svg pc-flame" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Flame graph">`;
    const draw = (n, x, d, w) => {
      const y = H - 4 - (d + 1) * RH;
      let cls = "pc-fr";
      if (f.newPaths && f.newPaths.has(n.path)) cls += " new";
      if (f.hotPath && n.path === f.hotPath) cls += " hot";
      if (f.hotName && n.name === f.hotName && n.self > 0) cls += " hidden";
      if (f.showSelf && n.self > 0 && !cls.includes("hot") && !cls.includes("hidden")) cls += " self";
      const label = n.name, chars = Math.floor((w - 6) / 6.6);
      const text = chars >= label.length ? label : chars > 3 ? label.slice(0, chars - 1) + "…" : "";
      s += `<g class="${cls}"><rect x="${x + 0.5}" y="${y}" width="${Math.max(0.5, w - 1)}" height="${RH - 2}" rx="2"/><text x="${x + 4}" y="${y + 14}">${esc(text)}</text><title>${esc(n.name)} · total ${n.total} · self ${n.self} samples</title></g>`;
      let cx = x;
      for (const k of [...n.kids.values()].sort((a, b) => a.name.localeCompare(b.name))) { const kw = (k.total / n.total) * w; draw(k, cx, d + 1, kw); cx += kw; }
    };
    if (root.total) draw(root, 0, 0, W);
    return s + "</svg>";
  };
  const selfByName = (root) => {
    const m = new Map();
    for (const { n } of flat(root)) if (n.self) m.set(n.name, (m.get(n.name) || 0) + n.self);
    return [...m.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  };
  const rankHtml = (rank, total, hot) => `<div class="pc-rank"><span class="v-caption">self samples by function (bottom-up view)</span>${rank.slice(0, 6).map(([n, c]) => `<div class="pc-rank-row ${n === hot ? "hot" : ""}"><span>${esc(n)}</span><i style="width:${(c / rank[0][1]) * 150}px"></i><b>${c} · ${((c / total) * 100).toFixed(0)}%</b></div>`).join("")}</div>`;

  Viz.register("performance-cadence-flame", (el) => Viz.player(el, {
    title: "Build a flame graph from stack samples, then find what actually burns CPU",
    legend: [["visit", "stack just added"], ["active", "frame with self time"], ["bad", "widest single plateau"], ["path", "hot function split across towers"]],
    codeLang: "python",
    code: [
      "for stack, count in samples:  # 'a;b 3'",
      "    node = root",
      "    for frame in stack.split(';'):",
      "        node = node.child(frame)  # merge",
      "        node.total += count",
      "    node.self += count  # top was on-CPU",
      "draw(root)  # width ∝ total, a-z siblings",
      "hot = max(self time summed per name)",
    ],
    inputs: [{ key: "stacks", label: "folded stacks (frames;joined;by;semicolons count | next …)", value: DEFAULT_STACKS, width: 860 }],
    random: () => {
      const pool = ["Parse", "Hash", "Regex.Match", "Alloc", "Json.Write", "Db.Read", "Sort", "Compress", "Lock.Wait", "String.Concat"];
      const mids = ["Handle", "Import", "Report", "Sync"];
      const lines = [];
      for (let i = 0; i < Viz.rand(4, 8); i++) {
        const fr = ["main", mids[Viz.rand(0, 3)]];
        for (let d = 0; d < Viz.rand(0, 2); d++) fr.push(["Step" + Viz.rand(1, 3), "Load", "Transform"][Viz.rand(0, 2)]);
        fr.push(pool[Viz.rand(0, pool.length - 1)]);
        lines.push(`${fr.join(";")} ${Viz.rand(1, 9)}`);
      }
      return { stacks: lines.join(" | ") };
    },
    build: ({ stacks }) => {
      const st = parseStacks(stacks), fr = [];
      const total = sum(st.map((x) => x.count));
      fr.push({ root: fold([]), st, k: 0, line: 0, vars: { samples: 0 }, note: `A sampling profiler interrupts the program about 100 times a second (perf uses 99 Hz so it does not beat in lockstep with timers) and records the <b>call stack</b> of each thread. Identical stacks are counted: these ${st.length} lines are ${total} samples in "folded" format.` });
      for (let k = 1; k <= st.length; k++) {
        const root = fold(st.slice(0, k)), cur = st[k - 1];
        const newPaths = new Set(); let p = ""; for (const x of cur.frames) { p += "/" + x; newPaths.add(p); }
        const shared = k > 1 ? cur.frames.findIndex((x, i) => !st.slice(0, k - 1).some((o) => o.frames.slice(0, i + 1).join(";") === cur.frames.slice(0, i + 1).join(";"))) : 0;
        fr.push({ root, st, k, newPaths, line: [2, 3, 4, 5], vars: { stack: cur.frames[cur.frames.length - 1], count: cur.count, samples: root.total }, note: `Add <code>${esc(cur.frames.join(";"))}</code> × ${cur.count}. ${k > 1 && shared !== 0 ? `It shares the prefix <b>${esc(cur.frames.slice(0, shared === -1 ? cur.frames.length : shared).join(" → "))}</b> with earlier samples, so those frames just get <b>wider</b>; only the new suffix grows a new tower.` : "Each frame becomes a box sitting on its caller."} The top frame <b>${esc(cur.frames[cur.frames.length - 1])}</b> was on-CPU, so it gains self time.` });
      }
      const root = fold(st), all = flat(root).filter((x) => x.n !== root);
      fr.push({ root, st, k: st.length, line: 6, vars: { samples: total, frames: all.length }, note: `Read it correctly: <b>the x-axis is not time</b>. Siblings are sorted alphabetically so identical stacks merge. Width = share of samples; y = stack depth. A wide box at the bottom just means "lots of work happens <i>under</i> me".` });
      fr.push({ root, st, k: st.length, showSelf: true, line: 5, vars: { "frames with self time": all.filter((x) => x.n.self).length }, note: `Highlighted boxes have <b>self time</b>: a part of their top edge is exposed, with nothing called above it. That is where instructions actually execute. Wide boxes that are fully covered (main, Server.Handle) cost nothing themselves.` });
      const widest = all.filter((x) => x.n.self).sort((a, b) => b.n.self - a.n.self || a.n.name.localeCompare(b.n.name))[0].n;
      fr.push({ root, st, k: st.length, showSelf: true, hotPath: widest.path, line: 6, vars: { "widest plateau": widest.name, self: `${widest.self} (${((widest.self / total) * 100).toFixed(0)}%)` }, note: `The <b>widest plateau</b> is <b>${esc(widest.name)}</b>: ${widest.self} of ${total} samples (${((widest.self / total) * 100).toFixed(0)}%). This is what most people optimise next. But check one more view first.` });
      const rank = selfByName(root), hot = rank[0][0], split = all.filter((x) => x.n.name === hot && x.n.self).length;
      fr.push({ root, st, k: st.length, hotName: hot, hotPath: widest.name === hot ? null : widest.path, rank, total, line: 7, vars: { "hottest function": hot, "self total": `${rank[0][1]} (${((rank[0][1] / total) * 100).toFixed(0)}%)`, towers: split }, note: split > 1 && hot !== widest.name
        ? `Sum self time <b>by function name</b> (the "bottom-up", "callers" or "butterfly" view). <b>${esc(hot)}</b> appears in ${split} different towers. Each looks thin, yet together it is ${((rank[0][1] / total) * 100).toFixed(0)}% of CPU, more than ${esc(widest.name)}. One fix (for example, compile or cache the regex) speeds up every caller.`
        : `Summing self time by function name confirms <b>${esc(hot)}</b> is the hottest function (${((rank[0][1] / total) * 100).toFixed(0)}%). ${split > 1 ? `It appears in ${split} towers.` : "It appears in a single tower, so the flame graph already showed it."} Now form a hypothesis about <i>why</i> it is expensive.` });
      return fr;
    },
    render: (f) => {
      const parts = [flameSvg(f.root, f)];
      if (f.rank) parts.push(rankHtml(f.rank, f.total, f.hotName));
      else parts.push(`<div class="pc-samples">${f.st.map((x, i) => `<div class="${i < f.k ? (i === f.k - 1 ? "cur" : "used") : ""}"><code>${esc(x.frames.join(";"))}</code> <b>${x.count}</b></div>`).join("")}</div>`);
      return `<div class="pc-col">${parts.join("")}</div>`;
    },
  }));

  /* =====================================================================
   * 4. Benchmark pitfalls: warmup tiers, noise, outliers, CIs, too few runs, DCE
   * ===================================================================== */
  const benchRun = (seed, n, noise, base) => {
    const r = rng(seed), xs = [];
    for (let i = 0; i < n; i++) {
      const tier = i === 0 ? 16 : i < 10 ? 1.9 : i < 14 ? 1.3 : 1;      /* first call JIT-compiles; tier-0 code; then optimised tier-1 */
      let x = base * tier * (1 + (noise / 100) * gauss(r));
      if (i > 0 && r() < 0.06) x *= 1.5 + r() * 0.9;                   /* noisy neighbour, GC, interrupt */
      xs.push(Math.max(1, x));
    }
    return xs;
  };
  const warmEnd = (xs, noise) => {
    const tail = xs.slice(Math.floor(xs.length / 2)), m = median(tail), tol = Math.max(0.1, (2.5 * noise) / 100);
    for (let i = 0; i + 5 <= xs.length; i++) if (median(xs.slice(i, i + 5)) <= m * (1 + tol)) return i;
    return Math.floor(xs.length / 2);
  };
  const tukey = (xs) => {
    const s = [...xs].sort((a, b) => a - b), q1 = pct(s, 25), q3 = pct(s, 75);
    return q3 + 1.5 * (q3 - q1);
  };
  const benchSvg = (f) => {
    const W = 560, H = 246, L = 46, T = 30, B = 30, pw = 390, ph = H - T - B, cx0 = L + pw + 20, cw = W - cx0 - 6;
    const cap = f.base * 2.6;
    const Y = (v) => T + ph - (Math.min(v, cap) / cap) * ph;
    const n = f.A.length, X = (i) => L + ((i + 0.5) / n) * pw;
    let s = `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Benchmark iterations">`;
    if (f.showWarm) s += `<rect class="pc-f-active soft" x="${L}" y="${T}" width="${(f.we / n) * pw}" height="${ph}"/><text class="pc-t-active b" x="${L + 4}" y="${T + ph - 8}">warm-up</text>`;
    if (f.naive) s += `<rect class="pc-f-bad soft" x="${L}" y="${T}" width="${(10 / n) * pw}" height="${ph}"/><text class="pc-t-bad b" x="${L + 4}" y="${T + ph - 22}">naive: first 10</text>`;
    for (let v = 0; v <= cap; v += f.base / 2) s += `<line class="grid" x1="${L}" y1="${Y(v)}" x2="${L + pw}" y2="${Y(v)}"/><text class="lbl" x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${v.toFixed(0)}</text>`;
    s += `<line class="ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/><text class="lbl" x="${L + pw}" y="${H - 4}" text-anchor="end">iteration →</text><text class="lbl" x="${L - 5}" y="${T - 14}" text-anchor="end">ns/op</text>`;
    const dot = (i, v, cls) => {
      const y = Y(v);
      return v > cap ? `<path class="pc-dot-${cls}" d="M${X(i) - 5},${y + 8} L${X(i)},${y} L${X(i) + 5},${y + 8} z"/>${i === 0 ? `<text class="pc-t-${cls} b" x="${X(0) + 8}" y="${T - 5}">${v.toFixed(0)} ns (1st call: JIT)</text>` : ""}` : `<circle class="pc-dot-${cls}" cx="${X(i)}" cy="${y}" r="3"/>`;
    };
    f.A.forEach((v, i) => {
      let c = "visit";
      if (f.showWarm && i < f.we) c = "active";
      if (f.showOut && i >= f.we && v > f.fence) c = "bad";
      if (f.few && i >= f.we + 5) c = "dim";
      s += dot(i, v, c);
    });
    if (f.Bs) f.Bs.forEach((v, i) => { if (i >= f.we && !(f.few && i >= f.we + 5) && v <= f.fenceB) s += `<circle class="pc-dot-done" cx="${X(i) + 2}" cy="${Y(v)}" r="2.6"/>`; });
    if (f.showOut) s += `<line class="pc-s-bad dash" x1="${L + (f.we / n) * pw}" y1="${Y(f.fence)}" x2="${L + pw}" y2="${Y(f.fence)}"/><text class="pc-t-bad" x="${L + pw - 2}" y="${Y(f.fence) - 4}" text-anchor="end">Tukey fence</text>`;
    if (f.ciA) {
      const cis = [[f.ciA, "visit", "A"], ...(f.ciB ? [[f.ciB, "done", "B"]] : [])];
      const lo = Math.min(...cis.map(([c]) => c.m - c.half)), hi = Math.max(...cis.map(([c]) => c.m + c.half)), pad = (hi - lo) * 0.25 + 0.5;
      const Z = (v) => T + 18 + ph - 18 - ((v - (lo - pad)) / (hi - lo + 2 * pad)) * (ph - 18);
      s += `<rect class="pc-panel" x="${cx0 - 8}" y="${T}" width="${cw + 10}" height="${ph}" rx="6"/><text class="lbl" x="${cx0 + cw / 2}" y="${T + 12}" text-anchor="middle">mean ± 95% CI (zoomed)</text>`;
      cis.forEach(([c, cls, name], k) => {
        const x = cx0 + 22 + k * 50;
        s += `<line class="pc-s-${cls} thick" x1="${x}" y1="${Z(c.m - c.half)}" x2="${x}" y2="${Z(c.m + c.half)}"/><line class="pc-s-${cls} thick" x1="${x - 7}" y1="${Z(c.m - c.half)}" x2="${x + 7}" y2="${Z(c.m - c.half)}"/><line class="pc-s-${cls} thick" x1="${x - 7}" y1="${Z(c.m + c.half)}" x2="${x + 7}" y2="${Z(c.m + c.half)}"/><circle class="pc-dot-${cls}" cx="${x}" cy="${Z(c.m)}" r="4"/><text class="pc-t-${cls} b" x="${x}" y="${T + ph - 4}" text-anchor="middle">${name}</text><text class="lbl" x="${x + 9}" y="${Z(c.m) + 4}">${c.m.toFixed(1)}</text>`;
      });
    }
    return s + "</svg>";
  };
  Viz.register("performance-cadence-bench", (el) => Viz.player(el, {
    title: "Benchmark pitfalls: warm-up, noise, outliers, confidence intervals and dead code",
    legend: [["active", "warm-up (JIT tiers)"], ["visit", "A: steady state"], ["bad", "outlier / wrong"], ["done", "B: candidate"]],
    codeLang: "python",
    code: [
      "for _ in range(warmup): run()  # JIT",
      "xs = [timed(run) for _ in range(n)]",
      "xs = [x for x in xs if x <= q3+1.5*iqr]",
      "m, half = mean(xs), t*stdev(xs)/sqrt(n)",
      "welch(A, B)  # or Mann-Whitney U",
      "sink(result)  # keep the result alive",
    ],
    inputs: [
      { key: "n", label: "iterations", value: "70", width: 80 },
      { key: "noise", label: "noise %", value: "4", width: 70 },
      { key: "gain", label: "B faster by %", value: "4", width: 90 },
      { key: "seed", label: "seed", value: "11", width: 60 },
    ],
    random: () => ({ n: String(Viz.rand(40, 120)), noise: String(Viz.rand(1, 10)), gain: String(Viz.rand(0, 12)), seed: String(Viz.rand(1, 999)) }),
    build: ({ n, noise, gain, seed }) => {
      const N = num(n, "iterations", 30, 150, true), nz = num(noise, "noise %", 0, 25), g = num(gain, "B faster by %", -50, 80), sd0 = num(seed, "seed", 0, 1e9, true);
      const base = 120, A = benchRun(sd0, N, nz, base), Bs = benchRun(sd0 + 101, N, nz, base * (1 - g / 100));
      const we = warmEnd(A, nz), weB = warmEnd(Bs, nz);
      const W0 = Math.max(we, weB);
      const steadyA = A.slice(W0), fence = tukey(steadyA), keptA = steadyA.filter((x) => x <= fence);
      const steadyB = Bs.slice(W0), fenceB = tukey(steadyB), keptB = steadyB.filter((x) => x <= fenceB);
      const naive = mean(A.slice(0, 10)), cA = ci(keptA), cB = ci(keptB), w = welch(cA, cB);
      const few = [ci(steadyA.slice(0, 5)), ci(steadyB.slice(0, 5))], wf = welch(few[0], few[1]);
      const outs = steadyA.length - keptA.length;
      const common = { A, base, we: W0, fence, fenceB };
      const verdict = (W, a, b) => (W.sig ? `<b>significant</b>: B is ${(((a.m - b.m) / a.m) * 100).toFixed(1)}% ${a.m > b.m ? "faster" : "slower"} (|t| = ${Math.abs(W.t).toFixed(2)} &gt; ${W.crit.toFixed(2)})` : `<b>not significant</b>: |t| = ${Math.abs(W.t).toFixed(2)} ≤ ${W.crit.toFixed(2)}, the difference is inside the noise`);
      return [
        { ...common, line: 1, vars: { iterations: N, "noise %": nz }, note: `Each dot is one timed iteration of method A (true steady cost about ${base} ns). Iteration 0 includes <b>JIT compilation</b>; the next ones run unoptimised <b>tier-0</b> code; then the runtime swaps in <b>optimised tier-1</b> code (on-stack replacement). The scattered high dots are other processes, GC and interrupts.` },
        { ...common, naive: true, line: 1, vars: { "naive mean (first 10)": `${naive.toFixed(0)} ns`, "steady median": `${median(steadyA).toFixed(0)} ns` }, note: `The classic mistake: <code>Stopwatch</code> around the first 10 calls. It reports <b>${naive.toFixed(0)} ns</b>, ${(naive / median(steadyA)).toFixed(1)}× the real steady-state cost, because it measured the compiler and cold caches, not your code.` },
        { ...common, showWarm: true, line: 0, vars: { "warm-up iterations": W0, "steady median": `${median(steadyA).toFixed(0)} ns` }, note: `Discard the warm-up. A harness (BenchmarkDotNet, JMH) runs <b>warm-up iterations until the numbers stabilise</b> (here, the first ${W0}) and only then starts measuring. Go and Python have no JIT tiers (PyPy does), but still need warm caches and a hot CPU.` },
        { ...common, showWarm: true, showOut: true, line: 2, vars: { fence: `${fence.toFixed(0)} ns`, outliers: outs, "mean (all)": `${mean(steadyA).toFixed(1)}`, "mean (kept)": `${mean(keptA).toFixed(1)}` }, note: `Noise is not symmetric: other work can only make you <b>slower</b>. ${outs} upper outlier${outs === 1 ? "" : "s"} above the Tukey fence (Q3 + 1.5·IQR) ${outs === 1 ? "is" : "are"} removed, as BenchmarkDotNet does by default. Report the median too; it barely moves.` },
        { ...common, showWarm: true, showOut: true, ciA: cA, line: 3, vars: { mean: `${cA.m.toFixed(1)} ns`, stdev: cA.s.toFixed(1), n: cA.n, "95% CI": `± ${cA.half.toFixed(1)} ns` }, note: `One number is never the result. The <b>95% confidence interval</b> mean ± t·s/√n = ${cA.m.toFixed(1)} ± ${cA.half.toFixed(1)} ns says where the true mean probably is. More iterations shrink it with √n; less noise shrinks it linearly.` },
        { ...common, showWarm: true, showOut: true, Bs, ciA: cA, ciB: cB, line: 4, vars: { A: `${cA.m.toFixed(1)} ± ${cA.half.toFixed(1)}`, B: `${cB.m.toFixed(1)} ± ${cB.half.toFixed(1)}`, t: w.t.toFixed(2), verdict: w.sig ? "significant" : "noise" }, note: `Now the candidate B (configured ${g}% faster). Compare <b>distributions</b>, not two numbers: Welch's t-test says the difference is ${verdict(w, cA, cB)}.` },
        { ...common, showWarm: true, few: true, Bs, ciA: few[0], ciB: few[1], line: 4, vars: { "n each": 5, A: `${few[0].m.toFixed(1)} ± ${few[0].half.toFixed(1)}`, B: `${few[1].m.toFixed(1)} ± ${few[1].half.toFixed(1)}`, verdict: wf.sig ? "significant" : "inconclusive" }, note: `Same code, only <b>5 iterations each</b> (greyed dots ignored). The intervals are ${(few[0].half / cA.half).toFixed(1)}× wider: ${verdict(wf, few[0], few[1])}. This is how teams "prove" changes that do nothing, and miss changes that matter. Run <code>-count=10</code>, several forks, and interleave A and B.` },
        { ...common, dce: true, line: 5, vars: { "real work": `${base} ns`, "result unused": "0.3 ns" }, note: `Last trap: <b>dead-code elimination</b>. If the benchmark ignores the result, the optimiser may delete the work and you time an empty loop. Anything below ~1 ns/op (one clock cycle is ~0.3 ns at 3 GHz) is a red flag. Return the value (BenchmarkDotNet), use <code>Blackhole</code> (JMH), or assign it to a package-level sink (Go).` },
      ];
    },
    render: (f) => {
      if (f.dce) {
        const bar = (label, v, cls, max) => `<div class="pc-amd-row"><div class="pc-amd-lbl"><b>${label}</b><span>${v} ns/op</span></div><div class="pc-amd-bar" style="width:400px"><span class="pc-seg ${cls}" style="width:${Math.max(3, (v / max) * 400)}px"></span></div></div>`;
        return `<div class="pc-col" style="width:560px">${bar("sum += f(x); return sum", f.base, "visit", f.base)}${bar("f(x);   // result discarded", 0.3, "bad", f.base)}<div class="pc-dce"><code>[Benchmark] public int Good() =&gt; Compute(x);</code><code>@Benchmark void good(Blackhole bh) { bh.consume(compute(x)); }</code><code>sink = compute(x) // package-level var in Go</code></div></div>`;
      }
      return benchSvg(f);
    },
  }));

  /* =====================================================================
   * 5. The cadence loop, end to end, on a simulated slow endpoint
   * ===================================================================== */
  const STATIONS = ["Goal", "Measure", "Profile", "Hypothesis", "Change one", "Verify", "Guard", "Repeat"];
  const ringSvg = (active, iter) => {
    const W = 260, H = 260, cx = 130, cy = 130, R = 94;
    let s = `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Cadence loop">`;
    s += `<circle class="pc-ring" cx="${cx}" cy="${cy}" r="${R}"/>`;
    STATIONS.forEach((name, i) => {
      const a = (2 * Math.PI * i) / STATIONS.length - Math.PI / 2, x = cx + R * Math.cos(a), y = cy + R * Math.sin(a);
      const on = i === active;
      s += `<g class="pc-st ${on ? "on" : ""}"><circle cx="${x}" cy="${y}" r="${on ? 30 : 27}"/><text x="${x}" y="${y - 2}" text-anchor="middle">${i + 1}</text><text class="nm" x="${x}" y="${y + 9}" text-anchor="middle">${name}</text></g>`;
    });
    s += `<text class="lbl" x="${cx}" y="${cy - 4}" text-anchor="middle">iteration</text><text class="pc-t-accent big" x="${cx}" y="${cy + 18}" text-anchor="middle">${iter}</text>`;
    return s + "</svg>";
  };
  const BASE = [
    { k: "db", name: "DB (N+1: 31 queries)", ms: 155, hyp: "Batch the 31 queries into one JOIN / IN query", to: 38 },
    { k: "json", name: "JSON serialisation", ms: 48, hyp: "Switch to a source-generated serializer", to: 47, guess: 30 },
    { k: "log", name: "Logging (sync, verbose)", ms: 38, hyp: "Async sink; drop per-row Debug logs", to: 9 },
    { k: "auth", name: "Auth (JWKS fetched per call)", ms: 32, hyp: "Cache signing keys for 10 min", to: 6 },
    { k: "biz", name: "Business rules", ms: 27, hyp: null, to: 27 },
  ];
  Viz.register("performance-cadence-loop", (el) => Viz.player(el, {
    title: "The cadence, run end to end on a slow endpoint",
    legend: [["active", "current station / widest component"], ["done", "kept change"], ["bad", "reverted change"]],
    codeLang: "python",
    code: [
      "goal = p95 <= target",
      "while measure_p95() > target:",
      "    hot = profile().widest()",
      "    h = hypothesis_for(hot)",
      "    apply(h)                 # ONE change",
      "    if not significant(): revert(h)",
      "    else: add_regression_guard(h)",
      "stop  # goal met: more speed has no value",
    ],
    inputs: [{ key: "target", label: "p95 target (ms)", value: "140", width: 100 }, { key: "noise", label: "run-to-run noise %", value: "3", width: 120 }, { key: "seed", label: "seed", value: "5", width: 60 }],
    random: () => ({ target: String(Viz.rand(10, 32) * 10), noise: String(Viz.rand(1, 8)), seed: String(Viz.rand(1, 999)) }),
    build: ({ target, noise, seed }) => {
      const T = num(target, "p95 target", 50, 1000), nz = num(noise, "noise %", 0, 20), r = rng(num(seed, "seed", 0, 1e9, true));
      const comp = BASE.map((c) => ({ ...c, cur: c.ms, tried: false, state: "" }));
      const truth = () => sum(comp.map((c) => c.cur));
      const measure = () => Array.from({ length: 20 }, () => truth() * (1 + (nz / 100) * gauss(r)));
      const fr = [], hist = [];
      let iter = 1;
      const snap = (station, line, note, vars, extra = {}) => fr.push({ station, iter, line, note, vars, comp: comp.map((c) => ({ ...c })), T, hist: [...hist], ...extra });
      snap(0, 0, `Start from a <b>goal</b>, not from a hunch: "GET /orders must have <b>p95 ≤ ${T} ms</b> at 200 req/s". Without a target you cannot know when to stop.`, { target: `${T} ms` });
      let before = measure();
      for (;;) {
        const cb = ci(before);
        snap(1, 1, `<b>Measure the baseline</b> under realistic load: 20 runs give p95 ≈ <b>${cb.m.toFixed(0)} ± ${cb.half.toFixed(0)} ms</b> against a target of ${T} ms.`, { "p95": `${cb.m.toFixed(0)} ± ${cb.half.toFixed(1)} ms`, target: `${T} ms` }, { p95: cb.m });
        if (cb.m <= T) {
          snap(7, 7, `<b>Goal met (${cb.m.toFixed(0)} ≤ ${T} ms). Stop.</b> Remaining ideas go in the backlog. Further speed costs engineering time and code clarity, and buys nothing users or the budget can feel.`, { p95: `${cb.m.toFixed(0)} ms`, target: `${T} ms`, iterations: iter }, { p95: cb.m, done: true });
          break;
        }
        const cands = comp.filter((c) => !c.tried && c.hyp).sort((a, b) => b.cur - a.cur);
        const widest = [...comp].sort((a, b) => b.cur - a.cur)[0];
        if (!cands.length) {
          snap(7, 1, `<b>Out of credible hypotheses</b> and still at ${cb.m.toFixed(0)} ms > ${T} ms. The rest is real work. Change the problem instead: cache the whole response, precompute, paginate, or renegotiate the budget with data.`, { p95: `${cb.m.toFixed(0)} ms`, target: `${T} ms` }, { p95: cb.m, done: true });
          break;
        }
        const hot = cands[0];
        snap(2, 2, `<b>Profile</b> (flame graph plus a trace span per dependency). Widest ${hot === widest ? "component" : "component with an untried idea"}: <b>${esc(hot.name)}</b> at ${hot.cur} ms of ${truth()} ms.`, { hot: hot.name, share: `${((hot.cur / truth()) * 100).toFixed(0)}%` }, { hot: hot.k });
        snap(3, 3, `<b>Hypothesis</b>, written down before coding: "${esc(hot.hyp)}" should cut ${esc(hot.name.split(" (")[0])} from ${hot.cur} to about ${hot.guess || hot.to} ms, because the profile shows ${hot.k === "db" ? "31 sequential round trips" : hot.k === "log" ? "threads blocked on the log file" : hot.k === "auth" ? "an HTTPS call on every request" : "time in reflection-based property access"}.`, { hypothesis: hot.hyp }, { hot: hot.k });
        const old = hot.cur;
        hot.cur = hot.to; hot.tried = true;
        snap(4, 4, `<b>Change exactly one thing</b> on a branch. If you also bump a library and tweak a pool size, you will never know which one moved the number (or hid a regression).`, { change: hot.hyp }, { hot: hot.k });
        const after = measure(), ca = ci(after), w = welch(cb, ca);
        const keep = w.sig && ca.m < cb.m;
        if (!keep) { hot.cur = old; hot.state = "bad"; } else hot.state = "done";
        hist.push({ name: hot.hyp, keep, from: cb.m, to: ca.m });
        snap(5, 5, keep
          ? `<b>Verify</b> with the same load and 20 runs: ${cb.m.toFixed(0)} → <b>${ca.m.toFixed(0)} ± ${ca.half.toFixed(0)} ms</b>, |t| = ${Math.abs(w.t).toFixed(1)}. The improvement is real, and it matches the hypothesis, so we understood the cause.`
          : `<b>Verify</b>: ${cb.m.toFixed(0)} → ${ca.m.toFixed(0)} ± ${ca.half.toFixed(0)} ms, |t| = ${Math.abs(w.t).toFixed(1)} ≤ ${w.crit.toFixed(2)}. <b>Not significant. Revert it.</b> The hypothesis was wrong (source generation mostly helps start-up, not steady state). Keeping it would add complexity for nothing.`,
          { before: `${cb.m.toFixed(0)} ms`, after: `${ca.m.toFixed(0)} ms`, t: w.t.toFixed(2), kept: keep ? "yes" : "reverted" }, { hot: hot.k, p95: keep ? ca.m : cb.m });
        if (keep) {
          snap(6, 6, `<b>Guard</b> it: ${hot.k === "db" ? "a test that asserts the endpoint issues ≤ 2 queries" : hot.k === "log" ? "a benchmark with an allocation budget for the logging path" : "a metric alert on JWKS fetches per minute"}, plus the load test's p95 gate in CI. Without a guard, the next refactor quietly undoes the win.`, { guard: "added" }, { p95: ca.m });
          before = after;
        } else before = measure();
        iter++;
        snap(7, 1, `<b>Repeat</b>: the profile has changed, so the old ranking is stale. Measure again and re-profile before choosing the next target.`, { iteration: iter });
      }
      return fr;
    },
    render: (f) => {
      const tot = sum(f.comp.map((c) => c.cur)), mx = Math.max(...BASE.map((c) => c.ms));
      const rows = f.comp.map((c) => `<div class="pc-comp ${c.k === f.hot ? "hot" : c.state}"><span>${esc(c.name)}</span><i style="width:${(c.cur / mx) * 200}px"></i><b>${c.cur} ms</b></div>`).join("");
      const p = f.p95 === undefined ? null : f.p95;
      const gauge = p === null ? "" : `<div class="pc-gauge ${p <= f.T ? "ok" : "over"}"><span>measured p95</span><b>${p.toFixed(0)} ms</b><span>target ${f.T} ms</span></div>`;
      const hist = f.hist.length ? `<div class="pc-hist">${f.hist.map((h) => `<div class="${h.keep ? "done" : "bad"}">${h.keep ? "✔" : "↺"} ${esc(h.name)}</div>`).join("")}</div>` : "";
      return Viz.row(ringSvg(f.station, f.iter), `<div class="pc-col" style="width:470px;align-items:stretch"><span class="v-caption">where the ${tot} ms go</span>${rows}${gauge}${hist}</div>`);
    },
  }));

  /* =====================================================================
   * 6. Load testing: the latency knee (M/M/c queue, Erlang C)
   * ===================================================================== */
  const erlangC = (c, a) => {
    let term = 1, s = 1;
    for (let k = 1; k < c; k++) { term *= a / k; s += term; }
    const last = (term * a) / c, rho = a / c;
    const top = last / (1 - rho);
    return top / (s + top);
  };
  const queueStats = (c, S, rho) => {
    const mu = 1 / S, lam = rho * c * mu, C = erlangC(c, lam / mu), rate = c * mu - lam;
    const Wq = C / rate, p99q = C > 0.01 ? Math.log(C / 0.01) / rate : 0;
    return { lam, C, W: S + Wq, p99: S + p99q, L: lam * (S + Wq) };
  };
  Viz.register("performance-cadence-knee", (el) => Viz.player(el, {
    title: "Load testing finds the knee: latency explodes as utilisation approaches 100%",
    legend: [["visit", "mean response time"], ["bad", "≈ p99 response time"], ["active", "current load"]],
    codeLang: "python",
    code: [
      "lam = rho * c / S        # arrivals/ms",
      "C = erlang_c(c, lam * S) # P(must queue)",
      "W = S + C / (c/S - lam)  # mean response",
      "p99 ≈ S + ln(C/0.01) / (c/S - lam)",
      "L = lam * W              # Little's law",
    ],
    inputs: [{ key: "S", label: "service time (ms)", value: "20", width: 100 }, { key: "c", label: "workers", value: "4", width: 70 }],
    random: () => ({ S: String(Viz.rand(2, 60)), c: String([1, 2, 4, 8, 16, 32][Viz.rand(0, 5)]) }),
    build: ({ S, c }) => {
      const s = num(S, "service time", 0.1, 10000), k = num(c, "workers", 1, 256, true);
      return [0.1, 0.3, 0.5, 0.6, 0.7, 0.8, 0.85, 0.9, 0.95, 0.98].map((rho, i) => {
        const q = queueStats(k, s, rho);
        const note = i === 0 ? `${k} worker${k > 1 ? "s" : ""}, each request needs ${s} ms of work. At 10% utilisation almost nobody waits: response ≈ service time. Capacity is ${((k / s) * 1000).toFixed(0)} req/s.`
          : rho < 0.75 ? `At ${(rho * 100).toFixed(0)}% busy, ${(q.C * 100).toFixed(0)}% of requests find every worker busy and queue. The mean barely moves, the <b>p99 starts to lift</b> first.`
            : rho < 0.92 ? `<b>The knee.</b> At ${(rho * 100).toFixed(0)}% utilisation the p99 is ${(q.p99 / s).toFixed(1)}× the service time. Waiting time grows like 1/(1 − ρ): each extra percent of load costs more than the last. Plan capacity to stay left of here (often 60 to 75%).`
              : `At ${(rho * 100).toFixed(0)}%, p99 ≈ ${ms(q.p99)} and ${q.L.toFixed(1)} requests are in flight (Little's law L = λW). A small burst now causes timeouts and retries, which add load: the classic collapse. Load tests exist to find this point <b>before</b> production does.`;
        return { k, s, rho, q, line: i === 0 ? [0, 1, 2] : rho >= 0.9 ? [3, 4] : [2, 3], vars: { utilisation: `${(rho * 100).toFixed(0)}%`, "req/s": (q.lam * 1000).toFixed(0), "P(wait)": `${(q.C * 100).toFixed(1)}%`, mean: ms(q.W), "p99≈": ms(q.p99), "in flight": q.L.toFixed(1) }, note };
      });
    },
    render: (f) => {
      const W = 560, H = 240, L = 50, R = 14, T = 14, B = 34, pw = W - L - R, ph = H - T - B;
      const ymax = Math.max(queueStats(f.k, f.s, 0.98).p99, f.s * 3) * 1.05;
      const X = (r) => L + r * pw, Y = (v) => T + ph - (Math.min(v, ymax) / ymax) * ph;
      const path = (key) => { let d = ""; for (let k = 1; k <= 98; k++) { const q = queueStats(f.k, f.s, k / 100); d += `${k > 1 ? "L" : "M"}${X(k / 100).toFixed(1)},${Y(q[key]).toFixed(1)} `; } return d; };
      let s = `<svg class="pc-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Latency versus utilisation">`;
      s += `<rect class="pc-f-done soft" x="${X(0)}" y="${T}" width="${X(0.7) - X(0)}" height="${ph}"/><text class="pc-t-done b" x="${X(0.02)}" y="${T + 14}">comfortable</text>`;
      s += `<rect class="pc-f-bad soft" x="${X(0.9)}" y="${T}" width="${X(1) - X(0.9)}" height="${ph}"/><text class="pc-t-bad b" x="${X(0.9) - 5}" y="${T + 14}" text-anchor="end">danger →</text>`;
      const step = ymax > 2000 ? 500 : ymax > 800 ? 200 : ymax > 300 ? 100 : ymax > 120 ? 50 : ymax > 40 ? 10 : ymax > 10 ? 5 : 1;
      for (let v = 0; v <= ymax; v += step) s += `<line class="grid" x1="${L}" y1="${Y(v)}" x2="${L + pw}" y2="${Y(v)}"/><text class="lbl" x="${L - 5}" y="${Y(v) + 4}" text-anchor="end">${v}</text>`;
      for (let r = 0; r <= 1.0001; r += 0.1) s += `<text class="lbl" x="${X(r)}" y="${T + ph + 14}" text-anchor="middle">${Math.round(r * 100)}%</text>`;
      s += `<text class="lbl" x="${L + pw}" y="${H - 2}" text-anchor="end">utilisation ρ = arrival rate / capacity</text><text class="lbl" x="4" y="${T + 4}">ms</text>`;
      s += `<path class="pc-s-visit thick" d="${path("W")}"/><path class="pc-s-bad thick" d="${path("p99")}"/>`;
      s += `<line class="pc-s-active dash" x1="${X(f.rho)}" y1="${T}" x2="${X(f.rho)}" y2="${T + ph}"/><circle class="pc-dot-visit" cx="${X(f.rho)}" cy="${Y(f.q.W)}" r="5"/><circle class="pc-dot-bad" cx="${X(f.rho)}" cy="${Y(f.q.p99)}" r="5"/>`;
      s += `<line class="ax" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/>`;
      return s + "</svg>";
    },
  }));
})();
