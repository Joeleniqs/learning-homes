/* Intervals & Sweep Line visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const nums = (s) => (String(s).match(/\d+/g) || []).map(Number);
  const tuples = (s, k, { min = 1, max = 9, hi = 40, what = "intervals", ex = "[1,3],[2,6]" } = {}) => {
    const a = nums(s);
    if (!a.length || a.length % k) throw new Error(`Give ${what} as groups of ${k} whole numbers, e.g. ${ex}.`);
    const r = [];
    for (let i = 0; i < a.length; i += k) r.push(a.slice(i, i + k));
    if (r.length < min || r.length > max) throw new Error(`Give ${min === max ? min : `${min}–${max}`} ${what}.`);
    if (a.some((v) => v > hi)) throw new Error(`Keep every number between 0 and ${hi}.`);
    return r;
  };
  const ivs = (s, o = {}) => {
    const r = tuples(s, 2, o);
    for (const [a, b] of r) if (b < a + (o.minLen ?? 0)) throw new Error(`[${a},${b}] is not valid here: it needs start ${o.minLen ? "<" : "≤"} end.`);
    return r;
  };
  const fmt = (p) => `[${p.join(",")}]`;
  const show = (r) => r.map(fmt).join(",");
  const randIvs = (n, hi, maxLen, minLen = 1) => Array.from({ length: n }, () => {
    const len = Viz.rand(minLen, maxLen), s = Viz.rand(0, hi - len);
    return [s, s + len];
  });
  const randDisjoint = (n, start, maxLen, maxGap, minLen = 0) => {
    const r = [];
    let x = start;
    for (let i = 0; i < n; i++) {
      const len = Viz.rand(minLen, maxLen);
      r.push([x, x + len]);
      x += len + Viz.rand(1, maxGap);
    }
    return r;
  };
  /* Largest number of half-open intervals live at one instant (the peak is always at some start). */
  const maxCover = (list) => Math.max(0, ...list.map(([t]) => list.filter(([s, e]) => s <= t && t < e).length));
  const wrap = (...parts) => `<div class="isl">${parts.filter(Boolean).join("")}</div>`;
  const chips = (label, items, empty = "empty") => Viz.labeled(label, `<div class="isl-chips">${items.length ? items.map(([t, c, sub]) => `<span class="v-item ${c || ""}">${esc(t)}${sub !== undefined ? `<small>${esc(sub)}</small>` : ""}</span>`).join("") : `<span class="isl-empty">${esc(empty)}</span>`}</div>`);
  const panel = (ok, html) => `<div class="isl-panel ${ok === true ? "ok" : ok === false ? "bad" : ""}">${html}</div>`;
  const niceStep = (span, most = 15) => [1, 2, 5, 10, 20, 25, 50].find((s) => span / s <= most) || 100;

  /* Timeline. o: lo, hi, lanes [{label, cls, sep, items [{s, e, cls, text, ends: "closed"|"half"}]}],
     marks [{x, cls, label}], bands [{s, e, cls}], step {pts [[x, count]], max, cap, label, cls(i, count)} */
  const TL = (o) => {
    const W = o.width || 600, padL = o.padL ?? 66, padR = 24, lo = o.lo, hi = Math.max(o.hi, o.lo + 1);
    const k = (W - padL - padR) / (hi - lo), X = (v) => padL + (v - lo) * k;
    const LH = o.laneH || 30, marks = new Map();
    for (const m of o.marks || []) {
      const g = marks.get(m.x);
      if (g) { g.label = [g.label, m.label].filter(Boolean).join("="); g.cls = m.cls; } else marks.set(m.x, { ...m });
    }
    const top = [...marks.values()].some((m) => m.label) ? 24 : 8;
    const axisY = top + o.lanes.length * LH + 6;
    const SH = o.step ? o.stepH || 70 : 0, sTop = axisY + 40, sBase = sTop + SH;
    const bottom = o.step ? sBase : axisY, H = (o.step ? sBase + 8 : axisY + 26);
    const p = [], labels = [];
    for (const b of o.bands || []) if (b.e > b.s) p.push(`<rect class="band ${b.cls || ""}" x="${X(b.s)}" y="${top - 4}" width="${X(b.e) - X(b.s)}" height="${bottom - top + 4}"/>`);
    o.lanes.forEach((ln, r) => {
      const y = top + r * LH, mid = y + LH / 2;
      if (ln.sep) p.push(`<line class="sep" x1="8" x2="${W - 8}" y1="${y}" y2="${y}"/>`);
      p.push(`<text class="ll ${ln.cls || ""}" x="${padL - 10}" y="${mid + 4}" text-anchor="end">${esc(ln.label)}</text>`);
      p.push(`<line class="lane" x1="${padL}" x2="${W - padR}" y1="${mid}" y2="${mid}"/>`);
      for (const it of ln.items) {
        const x1 = X(it.s), x2 = X(it.e), thin = x2 - x1 < 6, x = thin ? (x1 + x2) / 2 - 3 : x1, w = thin ? 6 : x2 - x1;
        const c = it.cls || "";
        p.push(`<rect class="bar ${c}" x="${x}" y="${y + 5}" width="${w}" height="${LH - 10}" rx="6"/>`);
        if (it.ends) {
          p.push(`<circle class="dot ${c}" cx="${x1}" cy="${mid}" r="4.2"/>`);
          p.push(`<circle class="dot ${it.ends === "half" ? "open" : ""} ${c}" cx="${x2}" cy="${mid}" r="4.2"/>`);
        }
        const t = it.text ?? fmt([it.s, it.e]);
        if (t) {
          const tw = t.length * 6.7, pad = it.ends ? 9 : 4, fits = tw + (it.ends ? 20 : 8) <= w;
          let tx = x + w / 2, anchor = "middle";
          if (!fits) {
            const rightEdge = Math.min(W - 2, ...ln.items.filter((o2) => o2 !== it && o2.s >= it.e).map((o2) => X(o2.s) - 4));
            const leftEdge = Math.max(padL - 8, ...ln.items.filter((o2) => o2 !== it && o2.e <= it.s).map((o2) => X(o2.e) + 4));
            const overR = Math.max(0, x + w + pad + tw - rightEdge), overL = Math.max(0, leftEdge - (x - pad - tw));
            if (overR <= overL) { tx = x + w + pad; anchor = "start"; } else { tx = x - pad; anchor = "end"; }
          }
          labels.push(`<text class="bt ${c} ${fits ? "" : "out"}" x="${tx}" y="${mid + 4}" text-anchor="${anchor}">${esc(t)}</text>`);
        }
      }
    });
    p.push(...labels);
    p.push(`<line class="axis" x1="${padL - 4}" x2="${W - padR + 8}" y1="${axisY}" y2="${axisY}"/>`);
    const stp = niceStep(hi - lo);
    for (let v = Math.ceil(lo / stp) * stp; v <= hi; v += stp) p.push(`<line class="tk" x1="${X(v)}" x2="${X(v)}" y1="${axisY}" y2="${axisY + 5}"/><text class="tl" x="${X(v)}" y="${axisY + 17}" text-anchor="middle">${v}</text>`);
    if (o.step) {
      const { pts, cap } = o.step, max = Math.max(1, o.step.max, cap ?? 0);
      const Y = (c) => sBase - (c / max) * SH;
      p.push(`<text class="ll" x="${padL - 10}" y="${sTop + SH / 2 + 4}" text-anchor="end">${esc(o.step.label || "count")}</text>`);
      p.push(`<line class="axis" x1="${padL - 4}" x2="${W - padR + 8}" y1="${sBase}" y2="${sBase}"/>`);
      pts.forEach(([x, c], i) => {
        if (c <= 0) return;
        const xa = X(x), xb = i + 1 < pts.length ? X(pts[i + 1][0]) : xa, cls = o.step.cls ? o.step.cls(i, c) || "" : "";
        if (xb - xa < 1) {
          if (c <= Math.max(i ? pts[i - 1][1] : 0, i + 1 < pts.length ? pts[i + 1][1] : 0)) return;
          p.push(`<line class="spike ${cls}" x1="${xa}" x2="${xa}" y1="${sBase}" y2="${Y(c)}"/><text class="sv spk" x="${xa + 4}" y="${Y(c) - 3}">${c}</text>`);
          return;
        }
        p.push(`<rect class="st ${cls}" x="${xa}" y="${Y(c)}" width="${xb - xa}" height="${sBase - Y(c)}"/>`);
        if (xb - xa >= 10) p.push(`<text class="sv" x="${(xa + xb) / 2}" y="${Y(c) - 4}" text-anchor="middle">${c}</text>`);
      });
      if (cap !== undefined && cap !== null) p.push(`<line class="cap" x1="${padL}" x2="${W - padR}" y1="${Y(cap)}" y2="${Y(cap)}"/><text class="capl" x="${W - padR + 2}" y="${Y(cap) - 4}" text-anchor="end">${esc(o.step.capLabel || `limit ${cap}`)}</text>`);
    }
    for (const m of marks.values()) {
      p.push(`<line class="mk ${m.cls || ""}" x1="${X(m.x)}" x2="${X(m.x)}" y1="${top - 6}" y2="${bottom}"/>`);
      if (m.label) p.push(`<text class="ml ${m.cls || ""}" x="${X(m.x)}" y="${top - 10}" text-anchor="middle">${esc(m.label)}</text>`);
    }
    const svg = `<svg class="isl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "timeline")}">${p.join("")}</svg>`;
    return o.caption ? Viz.labeled(o.caption, svg) : svg;
  };

  /* x/y plane. o: xlo, xhi, ylo, yhi, width, height, square, under(g), over(g), caption */
  const plane = (o) => {
    const pl = 34, pr = 16, pt = 14, pb = 26;
    let W = o.width || 600, H = o.height || 230;
    let kx = (W - pl - pr) / (o.xhi - o.xlo), ky = (H - pt - pb) / (o.yhi - o.ylo);
    if (o.square) { kx = ky = Math.min(kx, ky); W = pl + pr + kx * (o.xhi - o.xlo); H = pt + pb + ky * (o.yhi - o.ylo); }
    const g = { X: (v) => pl + (v - o.xlo) * kx, Y: (v) => H - pb - (v - o.ylo) * ky, W, H, top: pt, base: H - pb, left: pl, right: W - pr };
    const p = [o.under ? o.under(g) : ""];
    p.push(`<line class="axis" x1="${pl}" x2="${W - pr + 6}" y1="${g.base}" y2="${g.base}"/><line class="axis" x1="${pl}" x2="${pl}" y1="${pt - 4}" y2="${g.base}"/>`);
    const sx = niceStep(o.xhi - o.xlo, 16), sy = niceStep(o.yhi - o.ylo, 7);
    for (let v = Math.ceil(o.xlo / sx) * sx; v <= o.xhi; v += sx) p.push(`<line class="tk" x1="${g.X(v)}" x2="${g.X(v)}" y1="${g.base}" y2="${g.base + 5}"/><text class="tl" x="${g.X(v)}" y="${g.base + 17}" text-anchor="middle">${v}</text>`);
    for (let v = Math.ceil(o.ylo / sy) * sy; v <= o.yhi; v += sy) p.push(`<line class="tk" x1="${pl - 5}" x2="${pl}" y1="${g.Y(v)}" y2="${g.Y(v)}"/><text class="tl" x="${pl - 8}" y="${g.Y(v) + 4}" text-anchor="end">${v}</text>`);
    p.push(o.over ? o.over(g) : "");
    const svg = `<svg class="isl-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.caption || "plane")}">${p.join("")}</svg>`;
    return o.caption ? Viz.labeled(o.caption, svg) : svg;
  };

  /* ─────────────────────────── 1. The overlap test ─────────────────────────── */
  Viz.register("intervals-sweep-line-overlap", (el) => Viz.player(el, {
    title: "Do two intervals overlap? Latest start vs earliest end",
    tag: "THE ONE TEST",
    legend: [["visit", "a"], ["path", "b"], ["done", "shared part"], ["bad", "gap"]],
    codeLang: "python",
    code: [
      "def overlaps(a, b):",
      "    lo = max(a[0], b[0])   # latest start",
      "    hi = min(a[1], b[1])   # earliest end",
      "    return lo < hi         # closed: lo <= hi",
      "# same as: a[0] < b[1] and b[0] < a[1]",
      "# apart:   a[1] <= b[0] or b[1] <= a[0]",
    ],
    inputs: [
      { key: "a", label: "a = [start,end]", value: "[2,6]", width: 90 },
      { key: "b", label: "b = [start,end]", value: "[6,9]", width: 90 },
      { key: "sem", label: "meaning", type: "select", options: ["half-open [s, e)", "closed [s, e]"], value: "half-open [s, e)" },
    ],
    random: () => {
      const a = randIvs(1, 12, 6)[0];
      const b = Math.random() < 0.3 ? [a[1], a[1] + Viz.rand(1, 4)] : randIvs(1, 12, 6)[0];
      return Math.random() < 0.5 ? { a: fmt(a), b: fmt(b) } : { a: fmt(b), b: fmt(a) };
    },
    build: ({ a, b, sem }) => {
      const closed = sem.startsWith("closed"), op = closed ? "≤" : "<", nop = closed ? "<" : "≤";
      const A = ivs(a, { min: 1, max: 1, hi: 30, minLen: closed ? 0 : 1, what: "interval for a" })[0];
      const B = ivs(b, { min: 1, max: 1, hi: 30, minLen: closed ? 0 : 1, what: "interval for b" })[0];
      const lo = Math.max(A[0], B[0]), hi = Math.min(A[1], B[1]);
      const yes = closed ? lo <= hi : lo < hi;
      const inI = (t, [s, e]) => (closed ? s <= t && t <= e : s <= t && t < e);
      let brute = false;
      for (let t = Math.min(A[0], B[0]); t <= Math.max(A[1], B[1]); t += 0.5) if (inI(t, A) && inI(t, B)) brute = true;
      const base = { A, B, closed, lo, hi, yes };
      const f = [];
      f.push({ ...base, stage: 0, line: 0, note: closed
        ? `<b>Closed</b> intervals contain both ends: ${fmt(A)} holds ${A[0]} and ${A[1]} (filled dots). Use this when endpoints are real points that can collide, like balloons [1,2] and [2,3], which both cover x = 2.`
        : `<b>Half-open</b> intervals [s, e) contain the start but <b>not</b> the end (hollow dot). This is the right model for time: a meeting 9–10 and a meeting 10–11 do not clash, because the first is over at 10. Most scheduling problems mean this, even when they don't say so.` });
      f.push({ ...base, stage: 1, line: 1, vars: { lo }, note: `Whatever the two share must start after <b>both</b> have started. So the shared part can begin no earlier than lo = max(${A[0]}, ${B[0]}) = <b>${lo}</b>, the latest start.` });
      f.push({ ...base, stage: 2, line: 2, vars: { lo, hi }, note: `It must also stop before <b>either</b> one stops: hi = min(${A[1]}, ${B[1]}) = <b>${hi}</b>, the earliest end. The candidate shared part is [${lo}, ${hi}].` });
      f.push({ ...base, stage: 3, line: 3, vars: { lo, hi, overlap: yes }, note: yes
        ? `${lo} ${op} ${hi}, so [${lo}, ${hi}] is a real piece of the line: <b>they overlap</b>${hi > lo ? `, sharing a length of ${hi - lo}` : `, in exactly one point (${lo})`}. The pair (max of starts, min of ends) <i>is</i> the intersection. Interval-list intersection builds its output with exactly these two lines.`
        : lo === hi ? `lo = hi = ${lo}. They only touch at ${lo}, and with half-open intervals that point belongs to just one of them. <b>No overlap.</b> Switch the meaning to closed and the same input overlaps.`
          : `${lo} > ${hi}: the latest start comes after the earliest end, so one interval is over before the other begins. <b>No overlap</b>, and the gap between them is ${lo - hi} long.` });
      f.push({ ...base, stage: 4, line: [4, 5], ok: yes === brute, vars: { overlap: yes }, note: `Expand max and min and you get the form most code uses: <code>a.start ${op} b.end and b.start ${op} a.end</code>. Its negation reads naturally: they are apart exactly when one <b>ends before the other starts</b>, <code>a.end ${nop} b.start or b.end ${nop} a.start</code>. ${yes === brute ? "A point-by-point brute-force check agrees." : "Brute force disagrees!"}` });
      return f;
    },
    render: (f) => {
      const ends = f.closed ? "closed" : "half";
      const lanes = [
        { label: "a", items: [{ s: f.A[0], e: f.A[1], cls: "visit", ends }] },
        { label: "b", items: [{ s: f.B[0], e: f.B[1], cls: "path", ends }] },
      ];
      if (f.stage >= 3) lanes.push({ label: "a ∩ b", sep: true, items: f.yes ? [{ s: f.lo, e: f.hi, cls: "done", ends }] : [] });
      const marks = [];
      if (f.stage >= 1) marks.push({ x: f.lo, cls: "visit", label: "lo" });
      if (f.stage >= 2) marks.push({ x: f.hi, cls: "path", label: "hi" });
      const bands = f.stage >= 3 ? [{ s: Math.min(f.lo, f.hi), e: Math.max(f.lo, f.hi), cls: f.yes ? "done" : "bad" }] : [];
      return wrap(
        TL({ lo: Math.min(f.A[0], f.B[0]) - 1, hi: Math.max(f.A[1], f.B[1]) + 1, lanes, marks, bands, label: "two intervals on a number line" }),
        f.stage >= 3 ? panel(f.stage === 4 ? f.ok : undefined, f.yes ? `overlap = [${f.lo}, ${f.hi}]` : "no overlap") : "",
      );
    },
  }));

  /* ─────────────────────────── 2. Merge intervals ─────────────────────────── */
  Viz.register("intervals-sweep-line-merge", (el) => Viz.player(el, {
    title: "Merge Intervals: sort by start, compare with the last block only",
    tag: "SORT + ONE PASS",
    legend: [["active", "current interval"], ["visit", "block being built"], ["done", "finished block"]],
    codeLang: "python",
    code: [
      "iv.sort(key=lambda p: p[0])     # by start",
      "out = []",
      "for s, e in iv:",
      "    if out and s <= out[-1][1]:  # half-open: <",
      "        out[-1][1] = max(out[-1][1], e)",
      "    else:",
      "        out.append([s, e])       # new block",
      "return out",
    ],
    inputs: [
      { key: "list", label: "intervals (1–9)", value: "[8,10],[1,3],[15,18],[2,6],[6,7],[16,17]", width: 290 },
      { key: "touch", label: "[1,2] and [2,3]", type: "select", options: ["touching merges (closed)", "touching stays apart (half-open)"], value: "touching merges (closed)" },
    ],
    random: () => ({ list: show(randIvs(Viz.rand(5, 8), 24, 6)) }),
    build: ({ list, touch }) => {
      const closed = touch.startsWith("touching merges");
      const iv = ivs(list, { min: 1, max: 9, hi: 40, minLen: closed ? 0 : 1 }), n = iv.length;
      const ord = iv.map((p, id) => ({ s: p[0], e: p[1], id })).sort((x, y) => x.s - y.s);
      const out = [], f = [];
      const snap = (x) => ({ iv, ord, n, closed, out: out.map((b) => b.slice()), ...x });
      f.push(snap({ sorted: false, k: -1, line: [], note: `${n} intervals in input order. An overlap can hide between any two of them, and checking every pair costs O(n²). Sorting fixes that.` }));
      f.push(snap({ sorted: true, k: -1, line: 0, note: `Sorted by <b>start</b>. Now an interval that overlaps the block we are building must come right after it, because every later interval starts even later. So each interval is compared with the <b>last</b> block only.` }));
      for (let k = 0; k < n; k++) {
        const { s, e } = ord[k], last = out[out.length - 1];
        if (last && (closed ? s <= last[1] : s < last[1])) {
          const before = last[1];
          last[1] = Math.max(before, e);
          f.push(snap({ sorted: true, k, joined: true, line: [3, 4], vars: { "s, e": `${s}, ${e}`, last: fmt(last) }, note: `[${s},${e}] starts at ${s} ${closed ? "≤" : "<"} ${before}, before the last block ends${s === before ? " (they touch, and touching counts here)" : ""}: it belongs to that block. Extend the end to max(${before}, ${e}) = ${last[1]}.${e < before ? ` Note the <b>max</b>: this interval sits fully inside the block, so the end must not shrink to ${e}.` : ""}` }));
        } else {
          out.push([s, e]);
          f.push(snap({ sorted: true, k, joined: false, line: [5, 6], vars: { "s, e": `${s}, ${e}` }, note: last
            ? `[${s},${e}] starts at ${s}, ${s === last[1] ? "exactly where the last block ends, and touching does not count here" : `after the last block ends (${last[1]})`}. Nothing later can reach back into that block, because everything later starts at ${s} or after. The block [${last}] is <b>final</b>. Open a new block.`
            : `The first interval opens the first block.` }));
        }
      }
      const ov = (x, y) => (closed ? x[0] <= y[1] && y[0] <= x[1] : x[0] < y[1] && y[0] < x[1]);
      let bs = iv.map((p) => p.slice()), changed = true;
      while (changed) {
        changed = false;
        outer: for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) if (ov(bs[i], bs[j])) {
          bs[i] = [Math.min(bs[i][0], bs[j][0]), Math.max(bs[i][1], bs[j][1])];
          bs.splice(j, 1);
          changed = true;
          break outer;
        }
      }
      bs.sort((x, y) => x[0] - y[0]);
      const ok = show(bs) === show(out);
      f.push(snap({ sorted: true, k: n, final: true, ok, line: 7, vars: { out: show(out) }, note: `Done: ${n} intervals became ${out.length} block${out.length > 1 ? "s" : ""}. Cost: O(n log n) for the sort, then one O(n) pass. ${ok ? "Brute force (keep merging any overlapping pair until none is left) gives the same blocks." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const ends = f.closed ? "closed" : "half";
      const list = f.sorted ? f.ord : f.iv.map((p, id) => ({ s: p[0], e: p[1], id }));
      const lanes = list.map((p, k) => ({ label: f.sorted ? `#${k}` : `in ${p.id}`, items: [{ s: p.s, e: p.e, ends, cls: !f.sorted ? "" : k === f.k ? "active" : k < f.k ? "ghost" : "" }] }));
      lanes.push({ label: "out", sep: true, items: f.out.map((b, i) => ({ s: b[0], e: b[1], ends, cls: i === f.out.length - 1 && !f.final ? "visit" : "done" })) });
      const last = f.out[f.out.length - 1];
      const marks = last && !f.final ? [{ x: last[1], cls: "visit", label: "last end" }] : [];
      const lo = Math.min(...f.iv.map((p) => p[0])), hi = Math.max(...f.iv.map((p) => p[1]));
      return wrap(TL({ lo: Math.max(0, lo - 1), hi: hi + 1, lanes, marks, label: "intervals and merged blocks" }), f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} ${show(f.out)}`) : "");
    },
  }));

  /* ─────────────────────────── 3. Insert interval ─────────────────────────── */
  Viz.register("intervals-sweep-line-insert", (el) => Viz.player(el, {
    title: "Insert Interval: left run, swallowed run, right run",
    tag: "THREE LOOPS · O(n)",
    legend: [["done", "copied (left)"], ["bad", "swallowed"], ["path", "copied (right)"], ["visit", "new interval"]],
    codeLang: "python",
    code: [
      "out, i, n = [], 0, len(iv)",
      "while i < n and iv[i][1] < new[0]:   # left",
      "    out.append(iv[i]); i += 1",
      "while i < n and iv[i][0] <= new[1]:  # overlap",
      "    new = [min(new[0], iv[i][0]),",
      "           max(new[1], iv[i][1])]",
      "    i += 1",
      "out.append(new)",
      "out += iv[i:]                        # right",
      "return out",
    ],
    inputs: [
      { key: "list", label: "sorted, disjoint intervals", value: "[1,2],[3,5],[6,7],[8,10],[12,16]", width: 250 },
      { key: "add", label: "new", value: "[4,8]", width: 80 },
    ],
    random: () => {
      const iv = randDisjoint(Viz.rand(3, 6), Viz.rand(0, 2), 3, 3, 1), end = iv[iv.length - 1][1];
      const s = Viz.rand(0, end), e = Math.min(end + 2, s + Viz.rand(0, 8));
      return { list: show(iv), add: fmt([s, e]) };
    },
    build: ({ list, add }) => {
      const iv = ivs(list, { min: 1, max: 8, hi: 40 }), n = iv.length;
      for (let k = 1; k < n; k++) if (iv[k][0] <= iv[k - 1][1]) throw new Error("The list must be sorted with gaps between intervals (that is the problem's promise).");
      const orig = ivs(add, { min: 1, max: 1, hi: 40, what: "new interval" })[0];
      let nw = orig.slice(), i = 0, ate = 0;
      const out = [], phase = Array(n).fill(""), f = [];
      const snap = (x) => ({ iv, n, orig, nw: nw.slice(), out: out.map((b) => b.slice()), phase: phase.slice(), ...x });
      f.push(snap({ line: 0, note: `The list is sorted and its intervals do not touch, so it splits into three runs: intervals entirely <b>left</b> of the new one, intervals that <b>overlap</b> it, and intervals entirely <b>right</b> of it. One while loop per run, and no sorting needed: O(n).` }));
      while (i < n && iv[i][1] < nw[0]) {
        phase[i] = "left";
        out.push(iv[i].slice());
        f.push(snap({ cur: i, line: [1, 2], vars: { i, "iv[i]": fmt(iv[i]), new: fmt(nw) }, note: `${fmt(iv[i])} ends at ${iv[i][1]} < ${nw[0]}, where the new interval starts. It lies completely to the left: copy it unchanged.` }));
        i++;
      }
      while (i < n && iv[i][0] <= nw[1]) {
        const before = nw.slice();
        nw = [Math.min(nw[0], iv[i][0]), Math.max(nw[1], iv[i][1])];
        phase[i] = "eat";
        ate++;
        f.push(snap({ cur: i, line: [3, 4, 5, 6], vars: { i, "iv[i]": fmt(iv[i]), new: fmt(nw) }, note: `${fmt(iv[i])} starts at ${iv[i][0]} ≤ ${before[1]} (the new end), and the first loop already proved it does not end before the new start. So they overlap. Swallow it: new = [min(${before[0]}, ${iv[i][0]}), max(${before[1]}, ${iv[i][1]})] = <b>${fmt(nw)}</b>.` }));
        i++;
      }
      out.push(nw.slice());
      f.push(snap({ placed: true, line: 7, vars: { new: fmt(nw) }, note: ate ? `${i < n ? `${fmt(iv[i])} starts at ${iv[i][0]} > ${nw[1]}, so the swallowing stops.` : "The list ran out."} The grown interval ${fmt(nw)} replaces the ${ate} interval${ate > 1 ? "s" : ""} it swallowed, as one block.` : `Nothing overlapped. ${fmt(nw)} simply slots into the gap at position ${out.length - 1}.` }));
      const rest = n - i;
      for (; i < n; i++) { phase[i] = "right"; out.push(iv[i].slice()); }
      const all = [...iv, orig].sort((x, y) => x[0] - y[0]), bm = [];
      for (const [s, e] of all) if (bm.length && s <= bm[bm.length - 1][1]) bm[bm.length - 1][1] = Math.max(bm[bm.length - 1][1], e); else bm.push([s, e]);
      const ok = show(bm) === show(out);
      f.push(snap({ placed: true, final: true, ok, line: [8, 9], vars: { out: show(out) }, note: `${rest ? `The remaining ${rest} interval${rest > 1 ? "s" : ""} start${rest > 1 ? "" : "s"} after ${nw[1]}: copy ${rest > 1 ? "them" : "it"} unchanged.` : "No intervals are left on the right."} Result: ${out.length} intervals. ${ok ? "Re-merging everything from scratch gives the same list." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const cls = { left: "done", eat: "bad", right: "path" };
      const lo = Math.min(f.iv[0][0], f.orig[0]), hi = Math.max(f.iv[f.n - 1][1], f.orig[1]);
      const lanes = [
        { label: "list", items: f.iv.map((p, k) => ({ s: p[0], e: p[1], cls: k === f.cur ? "active" : cls[f.phase[k]] || "" })) },
        { label: "new", items: [{ s: f.orig[0], e: f.orig[1], cls: "ghost", text: "" }, { s: f.nw[0], e: f.nw[1], cls: f.placed ? "done" : "visit" }] },
        { label: "out", sep: true, items: f.out.map((b) => ({ s: b[0], e: b[1], cls: "done" })) },
      ];
      const marks = f.final ? [] : [{ x: f.nw[0], cls: "visit", label: "s" }, { x: f.nw[1], cls: "visit", label: "e" }];
      return wrap(TL({ lo: Math.max(0, lo - 1), hi: hi + 1, lanes, marks, label: "insert an interval" }), f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} ${show(f.out)}`) : "");
    },
  }));

  /* ─────────────────────────── 4. Greedy by end: erase overlaps / arrows ─────────────────────────── */
  Viz.register("intervals-sweep-line-greedy", (el) => Viz.player(el, {
    title: "Sort by END, keep what finishes first",
    tag: "GREEDY · EXCHANGE ARGUMENT",
    legend: [["active", "current"], ["done", "kept / arrow shot here"], ["bad", "erased / already burst"]],
    codeLang: "python",
    code: [
      "iv.sort(key=lambda p: p[1])   # by END",
      "end, keep = -inf, 0",
      "for s, e in iv:",
      "    if s >= end:        # arrows: s > end",
      "        keep += 1       # keep it / new arrow",
      "        end = e         # arrow shot at x = e",
      "    # else: erase it / it is already burst",
      "return len(iv) - keep   # arrows: keep",
    ],
    inputs: [
      { key: "list", label: "intervals (1–9)", value: "[1,11],[2,4],[5,7],[8,10],[3,6]", width: 250 },
      { key: "mode", label: "problem", type: "select", options: ["erase overlaps (LC 435)", "min arrows (LC 452)", "erase, sorted by start (wrong)"], value: "erase overlaps (LC 435)" },
    ],
    random: () => ({ list: show(randIvs(Viz.rand(5, 8), 20, 7)) }),
    build: ({ list, mode }) => {
      const arrows = mode.startsWith("min arrows"), wrong = mode.includes("wrong");
      const iv = ivs(list, { min: 1, max: 9, hi: 40, minLen: arrows ? 0 : 1 }), n = iv.length;
      const ord = iv.map((p, id) => ({ s: p[0], e: p[1], id })).sort(wrong ? (x, y) => x.s - y.s : (x, y) => x.e - y.e);
      let end = -Infinity, keep = 0;
      const st = Array(n).fill(""), shots = [], f = [];
      const snap = (x) => ({ ord, n, arrows, wrong, st: st.slice(), shots: shots.slice(), end, keep, ...x });
      f.push(snap({ k: -1, line: [0, 1], note: wrong
        ? `Sorted by <b>start</b>. It feels natural to take whatever begins first. Watch it fail: one long early interval can block several short ones.`
        : arrows
          ? `Balloons as closed intervals, sorted by <b>end</b>. The balloon that ends first must be hit somewhere inside it. Shooting at its very end is the best choice: that is as far right as possible, so the arrow also hits every later balloon that has already started.`
          : `Sorted by <b>end</b>. Keep the maximum number of non-overlapping intervals; the rest must be erased. The interval that finishes first leaves the most room for everything after it, so keeping it can never hurt. That is the exchange argument from the greedy topic.` }));
      for (let k = 0; k < n; k++) {
        const { s, e } = ord[k], prev = end, pe = prev === -Infinity ? "−∞" : prev;
        if (arrows ? s > end : s >= end) {
          keep++;
          end = e;
          st[k] = "keep";
          if (arrows) shots.push(e);
          f.push(snap({ k, line: [3, 4, 5], vars: { "s, e": `${s}, ${e}`, end, keep }, note: arrows
            ? `${prev === -Infinity ? "No arrow yet." : `Balloon ${fmt([s, e])} starts at ${s} > ${prev}, so the last arrow (x = ${prev}) misses it.`} Shoot arrow ${keep} at x = ${e}, the balloon's end.`
            : `${fmt([s, e])} starts at ${s} ≥ ${pe}, the end of the last kept interval: no clash. Keep it (keep = ${keep}). The new boundary is its end, ${e}.` }));
        } else {
          st[k] = "drop";
          f.push(snap({ k, line: [3, 6], vars: { "s, e": `${s}, ${e}`, end, keep }, note: arrows
            ? `Balloon ${fmt([s, e])} starts at ${s} ≤ ${end}. Because we sorted by end, it also ends at ${e} ≥ ${end}. So it contains x = ${end}: the last arrow already bursts it.`
            : wrong
              ? `${fmt([s, e])} clashes with the last kept interval (it starts at ${s} < ${end}). This strategy erases it${e < end ? `, even though it ends <b>earlier</b> (${e} < ${end}) and would have left more room. That is the mistake.` : "."}`
              : `${fmt([s, e])} starts at ${s} < ${end}: it clashes with the last kept interval. Erase it. Keeping it instead could only be worse: it ends at ${e} ≥ ${end}, so it would block at least as much of the future.` }));
        }
      }
      let best;
      if (arrows) {
        const xs = [...new Set(iv.map((p) => p[1]))];
        best = Infinity;
        for (let m = 1; m < 1 << xs.length; m++) {
          const pts = xs.filter((_, b) => (m >> b) & 1);
          if (pts.length < best && iv.every(([s, e]) => pts.some((x) => s <= x && x <= e))) best = pts.length;
        }
      } else {
        best = 0;
        for (let m = 0; m < 1 << n; m++) {
          const sel = iv.filter((_, b) => (m >> b) & 1).sort((x, y) => x[0] - y[0]);
          if (sel.length > best && sel.every((p, q) => q === 0 || sel[q - 1][1] <= p[0])) best = sel.length;
        }
      }
      const ok = keep === best;
      f.push(snap({ k: n, final: true, ok, expectBad: wrong, best, line: 7, vars: arrows ? { arrows: keep } : { keep, erase: n - keep }, note: arrows
        ? `${keep} arrow${keep > 1 ? "s" : ""} at x = ${shots.join(", ")}. ${ok ? "Trying every set of shooting positions (brute force) cannot do better." : "Brute force found fewer!"} O(n log n).`
        : wrong
          ? ok ? `Kept ${keep}, erase ${n - keep}. Sorting by start happened to work on this input. Try the default input to see it fail.` : `This keeps ${keep}, so it erases ${n - keep}. The best is to keep ${best} and erase only ${n - best}. Switch back to sorting by end to see the right answer.`
          : `Kept ${keep} intervals, so erase <b>${n - keep}</b>. ${ok ? "Trying every subset (brute force) cannot keep more." : "Brute force kept more!"} O(n log n) for the sort plus one pass.` }));
      return f;
    },
    render: (f) => {
      const ends = f.arrows ? "closed" : "half";
      const lanes = f.ord.map((p, k) => ({ label: `#${k}`, items: [{ s: p.s, e: p.e, ends, cls: k === f.k ? "active" : f.st[k] === "keep" ? "done" : f.st[k] === "drop" ? "bad" : "" }] }));
      if (!f.arrows) lanes.push({ label: "kept", sep: true, items: f.ord.filter((_, k) => f.st[k] === "keep").map((p) => ({ s: p.s, e: p.e, ends, cls: "done" })) });
      const marks = f.arrows ? f.shots.map((x, i) => ({ x, cls: "done", label: `↑${i + 1}` })) : f.end > -Infinity && !f.final ? [{ x: f.end, cls: "visit", label: "end" }] : [];
      const lo = Math.min(...f.ord.map((p) => p.s)), hi = Math.max(...f.ord.map((p) => p.e));
      const counts = f.arrows ? `arrows = ${f.keep}` : `keep = ${f.keep} · erase = ${f.st.filter((x) => x === "drop").length}`;
      return wrap(
        TL({ lo: Math.max(0, lo - 1), hi: hi + 1, lanes, marks, label: f.arrows ? "balloons and arrows" : "intervals sorted by end" }),
        panel(f.final ? f.ok : undefined, `${f.final ? (f.ok ? "✓ " : "✗ ") : ""}${counts}${f.final && !f.ok ? ` (best: ${f.arrows ? f.best : `keep ${f.best}`})` : ""}`),
      );
    },
  }));

  /* ─────────────────────────── 5. Meeting rooms: the +1/−1 sweep ─────────────────────────── */
  Viz.register("intervals-sweep-line-rooms-sweep", (el) => Viz.player(el, {
    title: "Meeting Rooms II as a sweep: +1 at a start, −1 at an end",
    tag: "EVENTS · RUNNING COUNT",
    legend: [["active", "event now"], ["visit", "meeting in progress"], ["done", "peak / free time"], ["bad", "fake spike"]],
    codeLang: "python",
    code: [
      "ev = []",
      "for s, e in meetings:",
      "    ev += [(s, +1), (e, -1)]",
      "ev.sort()   # equal t: -1 sorts before +1",
      "cur = best = 0",
      "for t, d in ev:",
      "    cur += d          # rooms busy right now",
      "    best = max(best, cur)",
      "return best",
    ],
    inputs: [
      { key: "list", label: "meetings [start,end) (1–8)", value: "[0,30],[5,10],[10,15],[15,20],[25,35],[40,45]", width: 290 },
      { key: "tie", label: "at equal times", type: "select", options: ["end before start (correct)", "start before end (wrong)"], value: "end before start (correct)" },
    ],
    random: () => {
      const r = randIvs(Viz.rand(4, 7), 40, 14, 2);
      if (Math.random() < 0.7) { const a = r[0]; r[1] = [a[1], Math.min(48, a[1] + Viz.rand(2, 8))]; }
      return { list: show(r) };
    },
    build: ({ list, tie }) => {
      const wrong = tie.includes("wrong");
      const iv = ivs(list, { min: 1, max: 8, hi: 60, minLen: 1, what: "meetings" }), n = iv.length;
      const ev = [];
      iv.forEach(([s, e], id) => { ev.push({ t: s, d: 1, id }); ev.push({ t: e, d: -1, id }); });
      ev.sort((a, b) => a.t - b.t || (wrong ? b.d - a.d : a.d - b.d));
      let cur = 0, best = 0, bestT = null;
      const pts = [], f = [];
      let ymax = 0;
      { let c = 0; for (const x of ev) { c += x.d; ymax = Math.max(ymax, c); } }
      const snap = (x) => ({ iv, ev, n, cur, best, ymax, pts: pts.map((q) => q.slice()), ...x });
      f.push(snap({ k: -1, line: [0, 1, 2, 3], note: `Forget which meeting is which. Each meeting becomes two <b>events</b>: +1 at its start (one more room busy) and −1 at its end (one room frees up). That gives ${2 * n} events, sorted by time. ${wrong ? "<b>This run breaks ties the wrong way</b>: at equal times, starts go first." : "At equal times the −1 goes first: a meeting ending at 10 frees its room for one starting at 10 (half-open intervals)."}` }));
      ev.forEach((x, k) => {
        cur += x.d;
        pts.push([x.t, cur]);
        const peak = cur > best;
        if (peak) { best = cur; bestT = x.t; }
        const fake = wrong && peak && ev.some((y, q) => q > k && y.t === x.t && y.d < 0);
        const free = x.d < 0 && cur === 0 && k + 1 < ev.length && ev[k + 1].t > x.t;
        f.push(snap({ k, fake, line: [5, 6, 7], vars: { t: x.t, d: x.d > 0 ? "+1" : "−1", cur, best }, note: x.d > 0
          ? `t = ${x.t}: meeting ${fmt(iv[x.id])} starts. Busy rooms ${cur - 1} → <b>${cur}</b>.${peak ? ` New peak: ${cur} at once.` : ""}${fake ? " But a meeting ends at this same instant and its −1 has not been applied yet. <b>This peak is fake</b>: those two meetings never overlap." : ""}`
          : `t = ${x.t}: meeting ${fmt(iv[x.id])} ends. Busy rooms ${cur + 1} → <b>${cur}</b>.${free ? ` Nobody is in a meeting until t = ${ev[k + 1].t}: [${x.t}, ${ev[k + 1].t}) is <b>free time</b> for everyone.` : ""}` }));
      });
      const brute = maxCover(iv), ok = best === brute;
      const gaps = [];
      for (let k = 0; k + 1 < pts.length; k++) if (pts[k][1] === 0 && pts[k + 1][0] > pts[k][0]) gaps.push([pts[k][0], pts[k + 1][0]]);
      f.push(snap({ k: ev.length, final: true, ok, expectBad: wrong, gaps, line: 8, vars: { best }, note: wrong
        ? ok ? `Reports ${best}. No meeting ends exactly when another starts in this input, so the tie rule did not matter. Try the default input.` : `Reports <b>${best}</b>, but the true answer is ${brute}. The extra room came from applying a +1 before a −1 at the same instant. Sort ends first.`
        : `The highest point of the count is the answer: <b>${best}</b> room${best > 1 ? "s" : ""}, first needed at t = ${bestT}. ${gaps.length ? `The stretches at 0, ${gaps.map((g) => `[${g[0]}, ${g[1]})`).join(", ")}, are free time for everyone: Employee Free Time is this same sweep. ` : ""}O(n log n) for the sort. ${ok ? "Brute force (count the live meetings at every start time) agrees." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const cur = f.ev[f.k], done = new Set(), started = new Set();
      f.ev.forEach((x, q) => { if (q <= f.k) (x.d > 0 ? started : done).add(x.id); });
      const lanes = f.iv.map((p, id) => ({ label: `m${id}`, items: [{ s: p[0], e: p[1], ends: "half", cls: cur && cur.id === id ? "active" : done.has(id) ? "ghost" : started.has(id) ? "visit" : "" }] }));
      const marks = cur ? [{ x: cur.t, cls: "active", label: `t=${cur.t}` }] : [];
      const lo = Math.min(...f.iv.map((p) => p[0])), hi = Math.max(...f.iv.map((p) => p[1]));
      const evChips = f.ev.map((x, q) => [`${x.t} ${x.d > 0 ? "+1" : "−1"}`, q === f.k ? (f.fake ? "bad" : "active") : q < f.k ? "done" : "", `m${x.id}`]);
      return wrap(
        TL({
          lo, hi, lanes, marks, bands: f.final ? f.gaps.map(([s, e]) => ({ s, e, cls: "done" })) : [], label: "meetings and the busy-room count",
          step: { pts: f.pts, max: f.ymax, label: "busy", cls: (i, c) => (f.final && c === f.best ? (f.ok ? "peak" : "over") : "") },
        }),
        chips("events in sorted order (time, change, meeting)", evChips),
        f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} rooms needed = ${f.best}`) : "",
      );
    },
  }));

  /* ─────────────────────────── 6. Meeting rooms: the min-heap of end times ─────────────────────────── */
  Viz.register("intervals-sweep-line-rooms-heap", (el) => Viz.player(el, {
    title: "Meeting Rooms II with a heap: reuse the room that frees up first",
    tag: "SORT BY START + MIN-HEAP",
    legend: [["active", "next meeting"], ["visit", "heap top (earliest free room)"], ["done", "placed"]],
    codeLang: "python",
    code: [
      "meetings.sort()                # by start",
      "ends = []                      # min-heap",
      "for s, e in meetings:",
      "    if ends and ends[0] <= s:  # top is free",
      "        heapq.heappop(ends)    # reuse it",
      "    heapq.heappush(ends, e)    # room busy to e",
      "return len(ends)               # rooms opened",
    ],
    inputs: [
      { key: "list", label: "meetings [start,end) (1–8)", value: "[0,30],[5,10],[15,20],[10,15],[25,35],[12,19]", width: 290 },
    ],
    random: () => ({ list: show(randIvs(Viz.rand(4, 8), 40, 14, 2)) }),
    build: ({ list }) => {
      const iv = ivs(list, { min: 1, max: 8, hi: 60, minLen: 1, what: "meetings" });
      const ord = iv.map((p, id) => ({ s: p[0], e: p[1], id })).sort((a, b) => a.s - b.s || a.e - b.e);
      const heap = [], placed = [], f = [];
      let rooms = 0;
      const snap = (x) => ({ iv, ord, rooms, heap: heap.map((h) => ({ ...h })), placed: placed.map((p) => ({ ...p })), ...x });
      f.push(snap({ k: -1, line: [0, 1], note: `Sort by start and hand out rooms in that order. The heap holds one entry per room: the time that room becomes free. Its top is the room that frees up <b>earliest</b>, which is the only one worth checking.` }));
      ord.forEach((m, k) => {
        const top = heap[0];
        f.push(snap({ k, look: true, line: [2, 3], vars: { "s, e": `${m.s}, ${m.e}`, "ends[0]": top ? top.e : "none" }, note: `Next meeting by start: ${fmt([m.s, m.e])}. ${top ? `The earliest-free room is room ${top.room}, free at ${top.e}.` : "No rooms exist yet."}` }));
        let room;
        if (top && top.e <= m.s) {
          heap.shift();
          room = top.room;
          heap.push({ e: m.e, room });
          heap.sort((a, b) => a.e - b.e || a.room - b.room);
          placed.push({ ...m, room });
          f.push(snap({ k, line: [3, 4, 5], vars: { room, rooms }, note: `${top.e} ≤ ${m.s}: room ${room} is already free when this meeting starts. Pop it and push ${m.e}, its new free time. No new room is needed.` }));
        } else {
          room = ++rooms;
          heap.push({ e: m.e, room });
          heap.sort((a, b) => a.e - b.e || a.room - b.room);
          placed.push({ ...m, room });
          f.push(snap({ k, line: 5, vars: { room, rooms }, note: top ? `${top.e} > ${m.s}: even the room that frees up first is still busy. If that one is busy, every room is. Open room ${room} (heap size ${rooms}).` : `Open room 1 for the first meeting.` }));
        }
      });
      const brute = maxCover(iv), ok = rooms === brute;
      f.push(snap({ k: ord.length, final: true, ok, line: 6, vars: { rooms }, note: `Heap size = rooms opened = <b>${rooms}</b>. The heap only grows when every room is busy at the same moment, so its size is the peak overlap. That is the same number the +1/−1 sweep finds. Cost: O(n log n). ${ok ? "Brute force agrees." : "Brute force disagrees!"} Bonus: this version also tells you <i>which</i> room each meeting gets.` }));
      return f;
    },
    render: (f) => {
      const cur = f.ord[f.k], n = Math.max(1, f.rooms);
      const lanes = [{ label: "next", items: cur && f.look ? [{ s: cur.s, e: cur.e, cls: "active", ends: "half" }] : [] }];
      for (let r = 1; r <= n; r++) lanes.push({ label: `room ${r}`, sep: r === 1, items: f.placed.filter((p) => p.room === r).map((p) => ({ s: p.s, e: p.e, ends: "half", cls: cur && p.id === cur.id ? "visit" : "done" })) });
      const lo = Math.min(...f.iv.map((p) => p[0])), hi = Math.max(...f.iv.map((p) => p[1]));
      const marks = cur && !f.final ? [{ x: cur.s, cls: "active", label: `s=${cur.s}` }] : [];
      return wrap(
        TL({ lo, hi, lanes, marks, label: "rooms as lanes" }),
        chips("min-heap of free times (top first)", f.heap.map((h, i) => [`${h.e}`, i === 0 && f.look ? "visit" : "", `room ${h.room}`])),
        f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} rooms = ${f.rooms}`) : "",
      );
    },
  }));

  /* ─────────────────────────── 7. Interval list intersections ─────────────────────────── */
  Viz.register("intervals-sweep-line-intersect", (el) => Viz.player(el, {
    title: "Interval List Intersections: two pointers, drop whoever ends first",
    tag: "TWO POINTERS · O(m + n)",
    legend: [["active", "A[i] / B[j]"], ["visit", "A"], ["path", "B"], ["done", "intersection"]],
    codeLang: "python",
    code: [
      "i = j = 0",
      "out = []",
      "while i < len(A) and j < len(B):",
      "    lo = max(A[i][0], B[j][0])",
      "    hi = min(A[i][1], B[j][1])",
      "    if lo <= hi:                 # closed",
      "        out.append([lo, hi])",
      "    if A[i][1] < B[j][1]:        # A ends first",
      "        i += 1",
      "    else:",
      "        j += 1",
      "return out",
    ],
    inputs: [
      { key: "a", label: "A (sorted, disjoint)", value: "[0,2],[5,10],[13,23],[24,25]", width: 220 },
      { key: "b", label: "B (sorted, disjoint)", value: "[1,5],[8,12],[15,24],[25,26]", width: 220 },
    ],
    random: () => ({ a: show(randDisjoint(Viz.rand(2, 5), Viz.rand(0, 3), 6, 4)), b: show(randDisjoint(Viz.rand(2, 5), Viz.rand(0, 3), 6, 4)) }),
    build: ({ a, b }) => {
      const A = ivs(a, { min: 1, max: 7, hi: 50, what: "intervals in A" }), B = ivs(b, { min: 1, max: 7, hi: 50, what: "intervals in B" });
      for (const L of [A, B]) for (let k = 1; k < L.length; k++) if (L[k][0] <= L[k - 1][1]) throw new Error("Each list must be sorted with gaps between its intervals.");
      let i = 0, j = 0;
      const out = [], f = [];
      const snap = (x) => ({ A, B, i, j, out: out.map((p) => p.slice()), ...x });
      f.push(snap({ line: [0, 1], note: `Each list is sorted and has no internal overlaps. One pointer per list. At every step compare A[i] with B[j]: record their overlap (if any), then throw away whichever <b>ends first</b>.` }));
      while (i < A.length && j < B.length) {
        const lo = Math.max(A[i][0], B[j][0]), hi = Math.min(A[i][1], B[j][1]), hit = lo <= hi;
        if (hit) out.push([lo, hi]);
        const aFirst = A[i][1] < B[j][1];
        f.push(snap({ lo, hi, hit, aFirst, line: hit ? [3, 4, 5, 6] : [3, 4, 5], vars: { i, j, lo, hi }, note: `A[${i}] = ${fmt(A[i])}, B[${j}] = ${fmt(B[j])}. lo = max of starts = ${lo}, hi = min of ends = ${hi}. ${hit ? `${lo} ≤ ${hi}: add <b>${fmt([lo, hi])}</b>.` : `${lo} > ${hi}: they do not meet.`}` }));
        const [who, w, other] = aFirst ? ["A", i, B[j]] : ["B", j, A[i]];
        const gone = aFirst ? A[i] : B[j];
        f.push(snap({ lo, hi, hit, aFirst, moving: who, line: aFirst ? [7, 8] : [9, 10], vars: { i, j }, note: `${who}[${w}] = ${fmt(gone)} ends at ${gone[1]}${aFirst ? " <" : " ≤"} ${other[1]}. Everything after the other pointer starts after ${other[1]}, so ${who}[${w}] cannot meet anything else: it is finished. Advance ${aFirst ? "i" : "j"}.` }));
        if (aFirst) i++; else j++;
      }
      const brute = [];
      for (const p of A) for (const q of B) { const lo = Math.max(p[0], q[0]), hi = Math.min(p[1], q[1]); if (lo <= hi) brute.push([lo, hi]); }
      brute.sort((x, y) => x[0] - y[0]);
      const ok = show(brute) === show(out);
      f.push(snap({ final: true, ok, line: 11, vars: { out: show(out) }, note: `${i >= A.length ? "A" : "B"} is used up, so nothing more can intersect. ${out.length} piece${out.length === 1 ? "" : "s"}. Each step advances one pointer, so O(m + n). ${ok ? "Checking all m × n pairs gives the same pieces." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const all = [...f.A, ...f.B], lo = Math.min(...all.map((p) => p[0])), hi = Math.max(...all.map((p) => p[1]));
      const c = (k, p, base) => (k === p && !f.final ? "active" : k < p ? "ghost" : base);
      const lanes = [
        { label: "A", items: f.A.map((p, k) => ({ s: p[0], e: p[1], ends: "closed", cls: c(k, f.i, "visit") })) },
        { label: "B", items: f.B.map((p, k) => ({ s: p[0], e: p[1], ends: "closed", cls: c(k, f.j, "path") })) },
        { label: "A ∩ B", sep: true, items: f.out.map((p) => ({ s: p[0], e: p[1], ends: "closed", cls: "done" })) },
      ];
      const marks = f.lo !== undefined && !f.final ? [{ x: f.lo, cls: "visit", label: "lo" }, { x: f.hi, cls: "path", label: "hi" }] : [];
      return wrap(TL({ lo: Math.max(0, lo - 1), hi: hi + 1, lanes, marks, label: "two interval lists" }), f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} ${show(f.out) || "no overlap"}`) : "");
    },
  }));

  /* ─────────────────────────── 8. Difference array: car pooling / flight bookings ─────────────────────────── */
  Viz.register("intervals-sweep-line-diff", (el) => Viz.player(el, {
    title: "Car Pooling: two writes per trip, one prefix sum at the end",
    tag: "DIFFERENCE ARRAY",
    legend: [["active", "cell written now"], ["visit", "running load"], ["bad", "over capacity"]],
    codeLang: "python",
    code: [
      "diff = [0] * (last + 2)",
      "for num, a, b in trips:",
      "    diff[a] += num",
      "    diff[b] -= num     # flights: diff[b + 1]",
      "load = 0",
      "for x in range(len(diff)):",
      "    load += diff[x]    # prefix sum = live load",
      "    if load > cap:",
      "        return False",
      "return True",
    ],
    inputs: [
      { key: "trips", label: "trips [num,from,to] (1–6)", value: "[2,1,5],[3,3,7],[2,6,9],[1,8,11]", width: 240 },
      { key: "cap", label: "capacity", value: "5", width: 60 },
      { key: "mode", label: "to means", type: "select", options: ["drop-off: [from, to) (car pooling)", "inclusive: [from, to] (flight bookings)"], value: "drop-off: [from, to) (car pooling)" },
    ],
    random: () => ({
      trips: show(Array.from({ length: Viz.rand(3, 5) }, () => { const a = Viz.rand(0, 9), b = Viz.rand(a + 1, Math.min(13, a + 7)); return [Viz.rand(1, 4), a, b]; })),
      cap: String(Viz.rand(3, 7)),
    }),
    build: ({ trips, cap, mode }) => {
      const flights = mode.startsWith("inclusive");
      const T = tuples(trips, 3, { min: 1, max: 6, hi: 13, what: "trips", ex: "[2,1,5],[3,3,7]" });
      for (const [num, a, b] of T) {
        if (num < 1) throw new Error("Each trip needs at least 1 passenger.");
        if (flights ? b < a : b <= a) throw new Error(`Trip [${num},${a},${b}] needs from ${flights ? "≤" : "<"} to.`);
      }
      const C = Number(cap);
      if (!Number.isInteger(C) || C < 1 || C > 99) throw new Error("Capacity must be a whole number from 1 to 99.");
      const len = Math.max(...T.map((t) => t[2])) + (flights ? 2 : 1);
      const brute = Array.from({ length: len }, (_, x) => T.reduce((s, [num, a, b]) => s + (a <= x && (flights ? x <= b : x < b) ? num : 0), 0));
      const peak = Math.max(...brute);
      const diff = Array(len).fill(0), load = Array(len).fill(null), pts = [], f = [];
      const snap = (x) => ({ T, C, flights, len, peak, diff: diff.slice(), load: load.slice(), pts: pts.map((p) => p.slice()), ...x });
      f.push(snap({ line: 0, note: `Adding each trip to every stop it covers costs O(length) per trip. Instead, record only where the load <b>changes</b>: +num where the trip starts, −num where it stops counting. One prefix sum later turns those changes back into the load at every stop.` }));
      T.forEach(([num, a, b], k) => {
        const stop = flights ? b + 1 : b;
        diff[a] += num;
        diff[stop] -= num;
        f.push(snap({ trip: k, cells: [a, stop], line: [1, 2, 3], vars: { num, a, b, [`diff[${a}]`]: diff[a], [`diff[${stop}]`]: diff[stop] }, note: `Trip ${k}: ${num} passenger${num > 1 ? "s" : ""} on ${flights ? `[${a}, ${b}], both ends included` : `[${a}, ${b}), off at stop ${b}`}. Write +${num} at ${a} ("from here on, ${num} more") and −${num} at ${stop} ("from here on, ${num} fewer")${flights ? `. Inclusive end, so the −${num} goes one cell later, at ${b} + 1` : ""}. Two writes, whatever the trip's length.` }));
      });
      let run = 0, over = -1;
      for (let x = 0; x < len; x++) {
        const prev = run;
        run += diff[x];
        load[x] = run;
        pts.push([x, run]);
        if (run > C) over = x;
        f.push(snap({ x, line: over === x ? [6, 7, 8] : [5, 6, 7], vars: { x, "diff[x]": diff[x], load: run }, note: `x = ${x}: load = ${prev} ${diff[x] < 0 ? "−" : "+"} ${Math.abs(diff[x])} = <b>${run}</b>.${diff[x] === 0 ? " Nobody gets on or off here." : ""}${over === x ? ` That is more than the capacity ${C}: return False.` : ""}` }));
        if (over >= 0) break;
      }
      const firstOver = brute.findIndex((v) => v > C);
      const ok = load.every((v, x) => v === null || v === brute[x]) && over === firstOver;
      f.push(snap({ final: true, ok, over, line: over >= 0 ? 8 : 9, vars: { answer: over < 0 }, note: `${over >= 0 ? `Over capacity at x = ${over}: <b>False</b>.` : `The load never exceeds ${C}: <b>True</b>. Peak load: ${peak}.`} Cost: O(trips + range) instead of O(trips × range). ${ok ? "Adding every trip to every stop it covers (brute force) gives the same loads." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const lanes = f.T.map(([num, a, b], k) => ({ label: `+${num}`, items: [{ s: a, e: f.flights ? b + 1 : b, text: fmt([a, b]), ends: f.flights ? undefined : "half", cls: k === f.trip ? "active" : f.trip !== undefined && k < f.trip || f.x !== undefined || f.final ? "path" : "" }] }));
      const marks = f.x !== undefined && !f.final ? [{ x: f.x, cls: f.x === f.over ? "bad" : "visit", label: `x=${f.x}` }] : [];
      return wrap(
        TL({ lo: 0, hi: f.len, lanes, marks, label: "trips and the load", step: { pts: f.pts, max: Math.max(f.C, f.peak), cap: f.C, capLabel: `cap ${f.C}`, label: "load", cls: (i, c) => (c > f.C ? "over" : "") } }),
        Viz.array(f.diff, { label: "diff (where the load changes)", cls: (i, v) => (f.cells && f.cells.includes(i) ? "active" : i === f.x ? "visit" : v === 0 ? "dim" : "") }),
        Viz.array(f.load, { label: "load = prefix sum of diff", cls: (i, v) => (v === null ? "dim" : v > f.C ? "bad" : i === f.x ? "visit" : "done") }),
        f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} ${f.over >= 0 ? `False (over at x = ${f.over})` : "True"}`) : "",
      );
    },
  }));

  /* ─────────────────────────── 9. The skyline problem ─────────────────────────── */
  Viz.register("intervals-sweep-line-skyline", (el) => Viz.player(el, {
    title: "The Skyline Problem: sweep left to right, watch the tallest live building",
    tag: "SWEEP + MAX-HEAP · LAZY DELETE",
    legend: [["active", "event building"], ["path", "live building"], ["done", "skyline and key points"], ["bad", "stale heap entry"]],
    codeLang: "python",
    code: [
      "ev = [(L, -H, R) for L, R, H in B]   # starts",
      "ev += [(R, 0, 0) for _, R, _ in B]  # ends",
      "ev.sort()      # by x; taller start first",
      "heap = [(0, inf)]    # (-height, end); ground",
      "out = []",
      "for x, negH, R in ev:",
      "    if negH:",
      "        heappush(heap, (negH, R))",
      "    while heap[0][1] <= x:   # lazy delete",
      "        heappop(heap)",
      "    h = -heap[0][0]          # tallest live",
      "    if not out or out[-1][1] != h:",
      "        out.append([x, h])   # height changed",
    ],
    inputs: [
      { key: "b", label: "buildings [left,right,height] (1–7)", value: "[2,9,10],[3,7,15],[5,12,12],[15,20,10],[19,24,8]", width: 330 },
    ],
    random: () => ({ b: show(Array.from({ length: Viz.rand(3, 6) }, () => { const l = Viz.rand(0, 20), r = Viz.rand(l + 1, Math.min(28, l + 9)); return [l, r, Viz.rand(2, 15)]; })) }),
    build: ({ b }) => {
      const B = tuples(b, 3, { min: 1, max: 7, hi: 30, what: "buildings", ex: "[2,9,10],[3,7,15]" });
      for (const [L, R, H] of B) {
        if (R <= L) throw new Error(`Building [${L},${R},${H}] needs left < right.`);
        if (H < 1 || H > 20) throw new Error("Heights must be from 1 to 20.");
      }
      const ev = [];
      B.forEach(([L, R, H], id) => { ev.push({ x: L, h: -H, r: R, id }); ev.push({ x: R, h: 0, r: 0, id }); });
      ev.sort((p, q) => p.x - q.x || p.h - q.h || p.r - q.r);
      let heap = [{ h: 0, r: Infinity, id: -1 }];
      const out = [], f = [];
      const order = () => heap.sort((p, q) => q.h - p.h || p.r - q.r);
      const snap = (x) => ({ B, ev, heap: heap.map((e) => ({ ...e })), out: out.map((p) => p.slice()), ...x });
      f.push(snap({ k: -1, line: [0, 1, 2, 3, 4], note: `The outline can only change where a building starts or ends, so those ${ev.length} x positions are the <b>events</b>. Sweep a vertical line across them. At every event, ask one question: <b>how tall is the tallest building the line is touching?</b> A max-heap answers that. The ground (height 0, never ends) sits in the heap so it is never empty.` }));
      ev.forEach((e, k) => {
        const start = e.h < 0, [L, R, H] = B[e.id];
        if (start) { heap.push({ h: -e.h, r: e.r, id: e.id }); order(); }
        const popped = [];
        while (heap[0].r <= e.x) popped.push(heap.shift());
        const h = heap[0].h, prevH = out.length ? out[out.length - 1][1] : 0, add = !out.length || prevH !== h;
        if (add) out.push([e.x, h]);
        const stale = heap.filter((q) => q.r <= e.x).length;
        f.push(snap({ k, x: e.x, popped, add, line: [5, ...(start ? [6, 7] : []), ...(popped.length ? [8, 9] : [8]), 10, ...(add ? [11, 12] : [11])], vars: { x: e.x, h, "heap top": h === 0 ? "ground" : `${h} until ${heap[0].r}` },
          note: `${start ? `x = ${e.x}: building ${e.id} [${L},${R},${H}] <b>starts</b>. Push (height ${H}, ends ${R}).` : `x = ${e.x}: building ${e.id} [${L},${R},${H}] <b>ends</b>. Its heap entry is not removed here: deleting from the middle of a heap is slow, so it stays as a <i>stale</i> entry.`}`
            + `${popped.length ? ` The top ${popped.map((q) => `(height ${q.h}, ended ${q.r})`).join(", then ")} has already ended (end ≤ ${e.x}): pop ${popped.length > 1 ? "them" : "it"}. Stale entries are only removed once they reach the top. That is <b>lazy deletion</b>.` : ""}${stale ? ` ${stale} stale entr${stale > 1 ? "ies sit" : "y sits"} below the top; harmless, because they are not the max.` : ""}`
            + ` Tallest live height: <b>${h === 0 ? "0 (ground)" : h}</b>.${add ? ` It changed from ${prevH}, so emit key point <b>[${e.x}, ${h}]</b>.` : ` Still ${h}: no key point${ev[k - 1] && ev[k - 1].x === e.x ? " (an earlier event at this x already set it)" : ""}.`}` }));
      });
      const xs = [...new Set(B.flatMap(([L, R]) => [L, R]))].sort((p, q) => p - q), bk = [];
      let ph = 0;
      for (const x of xs) {
        const h = Math.max(0, ...B.filter(([L, R]) => L <= x && x < R).map((q) => q[2]));
        if (h !== ph) { bk.push([x, h]); ph = h; }
      }
      const ok = show(bk) === show(out);
      f.push(snap({ k: ev.length, x: Math.max(...B.map((q) => q[1])), final: true, ok, line: 12, vars: { key_points: out.length }, note: `Done: ${out.length} key points. Each building is pushed once and popped at most once, so O(n log n). ${ok ? "Recomputing the height at every critical x from scratch (brute force) gives the same outline." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const xhi = Math.max(...f.B.map((q) => q[1])) + 1, yhi = Math.max(...f.B.map((q) => q[2])) + 2;
      const x = f.x, cur = f.ev[f.k];
      const p = plane({
        xlo: 0, xhi, ylo: 0, yhi, height: 240, caption: "buildings, sweep line and skyline so far",
        under: (g) => f.B.map(([L, R, H], id) => {
          const c = cur && cur.id === id && !f.final ? "active" : x === undefined ? "" : R <= x ? "ghost" : L <= x ? "" : "future";
          return `<rect class="bld ${c}" x="${g.X(L)}" y="${g.Y(H)}" width="${g.X(R) - g.X(L)}" height="${g.base - g.Y(H)}"/><text class="bl ${c}" x="${g.X(L) + 4}" y="${g.Y(H) + 13}">b${id}</text>`;
        }).join(""),
        over: (g) => {
          let d = "";
          f.out.forEach(([kx, kh], i) => {
            const prev = i ? f.out[i - 1][1] : 0;
            d += i ? ` L${g.X(kx)},${g.Y(prev)} L${g.X(kx)},${g.Y(kh)}` : `M${g.X(kx)},${g.base} L${g.X(kx)},${g.Y(kh)}`;
          });
          if (f.out.length && x !== undefined) d += ` L${g.X(Math.max(x, f.out[f.out.length - 1][0]))},${g.Y(f.out[f.out.length - 1][1])}`;
          const dots = f.out.map(([kx, kh], i) => `<circle class="kp" cx="${g.X(kx)}" cy="${g.Y(kh)}" r="4.5"/>${i === f.out.length - 1 && f.add ? `<text class="kl" x="${g.X(kx) + 6}" y="${g.Y(kh) - 7}">[${kx},${kh}]</text>` : ""}`).join("");
          const sweep = x !== undefined && !f.final ? `<line class="mk active" x1="${g.X(x)}" x2="${g.X(x)}" y1="${g.top - 6}" y2="${g.base}"/>` : "";
          return (d ? `<path class="sky" d="${d}"/>` : "") + sweep + dots;
        },
      });
      const heapChips = f.heap.map((q, i) => [q.id < 0 ? "0" : `h ${q.h}`, x !== undefined && q.r <= x ? "bad" : i === 0 ? "visit" : "", q.id < 0 ? "ground" : `${x !== undefined && q.r <= x ? "stale, " : ""}to ${q.r}`]);
      const evChips = f.ev.map((e, i) => [`${e.x} ${e.h < 0 ? `↑${-e.h}` : "↓"}`, i === f.k ? "active" : i < f.k ? "done" : "", `b${e.id}`]);
      return wrap(
        p,
        chips("events (x, start ↑height / end ↓)", evChips),
        Viz.row(chips("max-heap (tallest first)", heapChips), chips("key points", f.out.map((q, i) => [fmt(q), i === f.out.length - 1 && f.add ? "active" : "done"]), "none yet")),
        f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} ${show(f.out)}`) : "",
      );
    },
  }));

  /* ─────────────────────────── 10. My Calendar I / II / III ─────────────────────────── */
  Viz.register("intervals-sweep-line-calendar", (el) => Viz.player(el, {
    title: "My Calendar I, II, III: a sorted map of +1/−1, swept on every booking",
    tag: "ORDERED MAP · BOUNDARY COUNT",
    legend: [["active", "booking now"], ["done", "accepted"], ["bad", "rejected / over the limit"]],
    codeLang: "python",
    code: [
      "delta = SortedDict()         # time -> change",
      "def book(s, e):",
      "    delta[s] = delta.get(s, 0) + 1",
      "    delta[e] = delta.get(e, 0) - 1",
      "    cur = peak = 0",
      "    for t in delta:          # sorted by time",
      "        cur += delta[t]",
      "        peak = max(peak, cur)",
      "    if peak > LIMIT:         # I: 1, II: 2",
      "        delta[s] -= 1; delta[e] += 1   # undo",
      "        return False",
      "    return True              # III: return peak",
    ],
    inputs: [
      { key: "list", label: "bookings in order [start,end) (1–8)", value: "[10,20],[50,60],[10,40],[5,15],[5,10],[25,55]", width: 300 },
      { key: "mode", label: "problem", type: "select", options: ["I: no double booking", "II: no triple booking", "III: report max k-booking"], value: "II: no triple booking" },
    ],
    random: () => ({ list: show(randIvs(Viz.rand(4, 7), 60, 25, 3)) }),
    build: ({ list, mode }) => {
      const III = mode.startsWith("III"), LIMIT = mode.startsWith("I:") ? 1 : 2;
      const bk = ivs(list, { min: 1, max: 8, hi: 99, minLen: 1, what: "bookings" });
      const delta = new Map(), res = [], f = [];
      const keys = () => [...delta.keys()].sort((p, q) => p - q);
      const sweep = () => { let c = 0; return keys().map((t) => [t, (c += delta.get(t))]); };
      const snap = (x) => ({ bk, III, LIMIT, res: res.slice(), delta: keys().map((t) => [t, delta.get(t)]), pts: sweep(), ...x });
      f.push(snap({ k: -1, line: 0, note: `Bookings arrive one at a time. Keep a <b>sorted map</b> from time to "change in the number of overlapping bookings": +1 where a booking starts, −1 where it ends. Walking the keys in order and keeping a running sum gives the exact overlap count everywhere. ${III ? "Calendar III never rejects: it reports the largest count seen so far." : `This is Calendar ${LIMIT === 1 ? "I: reject a booking that would make any moment double-booked (count 2)" : "II: reject a booking that would make any moment triple-booked (count 3)"}.`}` }));
      bk.forEach(([s, e], k) => {
        delta.set(s, (delta.get(s) || 0) + 1);
        delta.set(e, (delta.get(e) || 0) - 1);
        f.push(snap({ k, touched: [s, e], phase: "add", line: [1, 2, 3], vars: { s, e, [`delta[${s}]`]: delta.get(s), [`delta[${e}]`]: delta.get(e) }, note: `Booking ${k}: ${fmt([s, e])}. Tentatively add +1 at ${s} and −1 at ${e}.` }));
        const pts = sweep(), peak = Math.max(0, ...pts.map((q) => q[1]));
        const where = [];
        for (let i = 0; i + 1 < pts.length; i++) if (pts[i][1] === peak && pts[i + 1][0] > pts[i][0]) where.push(`[${pts[i][0]}, ${pts[i + 1][0]})`);
        f.push(snap({ k, touched: [s, e], phase: "sweep", peak, line: [4, 5, 6, 7], vars: { peak }, note: `Sweep the ${pts.length} keys in time order with a running sum. The count peaks at <b>${peak}</b> on ${where.join(", ")}.${!III && peak > LIMIT ? ` That is more than ${LIMIT}.` : ""} Cost: O(number of keys) per booking.` }));
        if (!III && peak > LIMIT) {
          delta.set(s, delta.get(s) - 1);
          delta.set(e, delta.get(e) + 1);
          if (delta.get(s) === 0) delta.delete(s);
          if (delta.get(e) === 0) delta.delete(e);
          res.push(false);
          f.push(snap({ k, phase: "reject", line: [8, 9, 10], vars: { result: false }, note: `Peak ${peak} > ${LIMIT}: <b>reject</b> ${fmt([s, e])}. Undo its two changes so the map describes accepted bookings only.` }));
        } else {
          res.push(III ? peak : true);
          f.push(snap({ k, phase: "accept", line: III ? 11 : [8, 11], vars: { result: III ? peak : true }, note: III ? `Return ${peak}: the largest number of bookings that overlap at one moment so far.` : `Peak ${peak} ≤ ${LIMIT}: <b>accept</b>. The changes stay in the map.` }));
        }
      });
      const acc = [], exp = [];
      for (const b of bk) {
        if (III) { acc.push(b); exp.push(maxCover(acc)); continue; }
        if (maxCover([...acc, b]) <= LIMIT) { acc.push(b); exp.push(true); } else exp.push(false);
      }
      const ok = JSON.stringify(exp) === JSON.stringify(res);
      f.push(snap({ k: bk.length, final: true, ok, line: [], vars: { results: `[${res.join(", ")}]` }, note: `Results: [${res.join(", ")}]. ${ok ? "Re-checking every moment by brute force gives the same answers." : "Brute force disagrees!"} With n bookings this is O(n) per call, O(n²) total. ${III ? "A segment tree over compressed times brings it to O(log n) per call." : LIMIT === 1 ? "Calendar I has a simpler O(log n) check: only the neighbours in a sorted list of bookings can clash." : "Calendar II can also keep a list of double-booked overlaps and test against that."}` }));
      return f;
    },
    render: (f) => {
      const shown = f.bk.slice(0, Math.min(f.bk.length, f.k + 1));
      const lanes = shown.map(([s, e], k) => ({ label: `b${k}`, items: [{ s, e, ends: "half", cls: k === f.k && f.phase !== "reject" && f.phase !== "accept" ? "active" : f.res[k] === false ? "bad" : "done" }] }));
      if (!lanes.length) lanes.push({ label: "", items: [] });
      const lo = Math.min(...f.bk.map((q) => q[0])), hi = Math.max(...f.bk.map((q) => q[1]));
      const limit = f.III ? undefined : f.LIMIT;
      const maxc = Math.max(f.LIMIT + 1, ...f.pts.map((q) => q[1]));
      const marks = f.touched && f.phase === "add" ? [{ x: f.touched[0], cls: "active", label: "+1" }, { x: f.touched[1], cls: "active", label: "−1" }] : [];
      return wrap(
        TL({ lo, hi, lanes, marks, label: "bookings and overlap count", step: { pts: f.pts, max: maxc, cap: limit, capLabel: `limit ${limit}`, label: "overlap", cls: (i, c) => (limit !== undefined && c > limit ? "over" : f.phase === "sweep" && c === f.peak ? "peak" : "") } }),
        chips("sorted map: time → change", f.delta.map(([t, d]) => [`${t}`, f.touched && f.touched.includes(t) && f.phase === "add" ? "active" : "", d > 0 ? `+${d}` : d < 0 ? `−${-d}` : "0"])),
        chips("answers so far", f.res.map((r) => [String(r), r === false ? "bad" : "done"]), "none yet"),
        f.final ? panel(f.ok, `${f.ok ? "✓" : "✗"} [${f.res.join(", ")}]`) : "",
      );
    },
  }));

  /* ─────────────────────────── 11. Coordinate compression: union area ─────────────────────────── */
  Viz.register("intervals-sweep-line-area", (el) => Viz.player(el, {
    title: "Rectangle Area union: compress coordinates, paint cells, sum row by row",
    tag: "COORDINATE COMPRESSION",
    legend: [["active", "rectangle / cells now"], ["done", "covered cell"], ["visit", "row being summed"]],
    codeLang: "python",
    code: [
      "xs = sorted({r[k] for r in R for k in (0, 2)})",
      "ys = sorted({r[k] for r in R for k in (1, 3)})",
      "X = {v: i for i, v in enumerate(xs)}",
      "Y = {v: i for i, v in enumerate(ys)}",
      "cov = [[0] * (len(xs) - 1) for _ in ys[1:]]",
      "for x1, y1, x2, y2 in R:",
      "    for j in range(Y[y1], Y[y2]):",
      "        for i in range(X[x1], X[x2]):",
      "            cov[j][i] += 1",
      "area = 0",
      "for j in range(len(ys) - 1):",
      "    h = ys[j + 1] - ys[j]       # row height",
      "    for i in range(len(xs) - 1):",
      "        if cov[j][i]:",
      "            area += (xs[i + 1] - xs[i]) * h",
    ],
    inputs: [
      { key: "r", label: "rectangles [x1,y1,x2,y2] (1–4)", value: "[0,0,4,3],[2,1,7,5],[5,0,8,2]", width: 280 },
    ],
    random: () => ({ r: show(Array.from({ length: Viz.rand(2, 4) }, () => { const x1 = Viz.rand(0, 7), y1 = Viz.rand(0, 7); return [x1, y1, Viz.rand(x1 + 1, Math.min(10, x1 + 5)), Viz.rand(y1 + 1, Math.min(10, y1 + 5))]; })) }),
    build: ({ r }) => {
      const R = tuples(r, 4, { min: 1, max: 4, hi: 10, what: "rectangles", ex: "[0,0,4,3],[2,1,7,5]" });
      for (const q of R) if (q[2] <= q[0] || q[3] <= q[1]) throw new Error(`Rectangle ${fmt(q)} needs x1 < x2 and y1 < y2.`);
      const xs = [...new Set(R.flatMap((q) => [q[0], q[2]]))].sort((a, b) => a - b);
      const ys = [...new Set(R.flatMap((q) => [q[1], q[3]]))].sort((a, b) => a - b);
      const cov = ys.slice(1).map(() => Array(xs.length - 1).fill(0)), f = [];
      let area = 0;
      const snap = (x) => ({ R, xs, ys, cov: cov.map((row) => row.slice()), area, ...x });
      const naive = R.reduce((s, q) => s + (q[2] - q[0]) * (q[3] - q[1]), 0);
      f.push(snap({ stage: 0, line: [], note: `Adding up the ${R.length} areas gives ${naive}, but overlapping parts get counted more than once. We need the area of the <b>union</b>.` }));
      f.push(snap({ stage: 1, line: [0, 1, 2, 3, 4], vars: { xs: `[${xs.join(", ")}]`, ys: `[${ys.join(", ")}]` }, note: `Draw a line through every rectangle edge: ${xs.length} distinct x values and ${ys.length} distinct y values. They cut the plane into a ${xs.length - 1} × ${ys.length - 1} grid of cells of <b>different sizes</b>. No edge passes through the middle of a cell, so each rectangle covers a cell completely or not at all. That is <b>coordinate compression</b>: only the order of the values matters, and the cell sizes are kept on the side.` }));
      R.forEach((q, k) => {
        const cells = [];
        for (let j = ys.indexOf(q[1]); j < ys.indexOf(q[3]); j++) for (let i = xs.indexOf(q[0]); i < xs.indexOf(q[2]); i++) { cov[j][i]++; cells.push(`${j},${i}`); }
        f.push(snap({ stage: 2, rk: k, cells, line: [5, 6, 7, 8], vars: { rect: fmt(q), cells: cells.length }, note: `Rectangle ${k} ${fmt(q)} spans x-columns ${xs.indexOf(q[0])}..${xs.indexOf(q[2]) - 1} and y-rows ${ys.indexOf(q[1])}..${ys.indexOf(q[3]) - 1}: +1 on those ${cells.length} cells.${cells.some((c) => { const [j, i] = c.split(",").map(Number); return cov[j][i] > 1; }) ? " Some cells reach 2 or more: overlap, but they will still be counted once." : ""}` }));
      });
      for (let j = 0; j < ys.length - 1; j++) {
        const h = ys[j + 1] - ys[j], parts = [];
        let w = 0;
        for (let i = 0; i < xs.length - 1; i++) if (cov[j][i]) { w += xs[i + 1] - xs[i]; parts.push(xs[i + 1] - xs[i]); }
        area += w * h;
        f.push(snap({ stage: 3, row: j, line: [10, 11, 12, 13, 14], vars: { row: j, h, "covered width": w, area }, note: `Row ${j}, y from ${ys[j]} to ${ys[j + 1]}, height ${h}. ${parts.length ? `Covered cell widths: ${parts.join(" + ")} = ${w}. Add ${w} × ${h} = ${w * h}.` : "No covered cells."} Area so far: <b>${area}</b>.` }));
      }
      let brute = 0;
      for (let y = 0; y < 10; y++) for (let x = 0; x < 10; x++) if (R.some((q) => q[0] <= x && x < q[2] && q[1] <= y && y < q[3])) brute++;
      const ok = brute === area;
      f.push(snap({ stage: 4, final: true, ok, line: [], vars: { area }, note: `Union area = <b>${area}</b> (the naive sum was ${naive}). Summing row by row is a sweep line moving up the y axis, and "covered width" is the 1-D union length at that height. With n rectangles this is O(n³). Rectangle Area II (n ≤ 200) keeps the covered width in a segment tree to reach O(n log n). ${ok ? "Counting unit squares one by one (brute force) agrees." : "Brute force disagrees!"}` }));
      return f;
    },
    render: (f) => {
      const cur = new Set(f.cells || []);
      const p = plane({
        xlo: 0, xhi: Math.max(...f.xs) + 1, ylo: 0, yhi: Math.max(...f.ys) + 1, width: 360, height: 300, square: true, caption: "rectangles on the compressed grid",
        under: (g) => {
          let s = "";
          if (f.stage >= 2) f.cov.forEach((row, j) => row.forEach((c, i) => {
            if (!c && f.row !== j) return;
            const cls = cur.has(`${j},${i}`) ? "active" : f.row === j ? (c ? "visit" : "rowband") : c > 1 ? "c2" : "c1";
            s += `<rect class="cell ${cls}" x="${g.X(f.xs[i])}" y="${g.Y(f.ys[j + 1])}" width="${g.X(f.xs[i + 1]) - g.X(f.xs[i])}" height="${g.Y(f.ys[j]) - g.Y(f.ys[j + 1])}"/>`;
          }));
          s += f.R.map((q, k) => `<rect class="rc ${k === f.rk ? "active" : ""} ${f.stage >= 2 ? "outline" : ""}" x="${g.X(q[0])}" y="${g.Y(q[3])}" width="${g.X(q[2]) - g.X(q[0])}" height="${g.Y(q[1]) - g.Y(q[3])}"/><text class="bl" x="${g.X(q[0]) + 4}" y="${g.Y(q[3]) + 13}">r${k}</text>`).join("");
          if (f.stage >= 1) {
            s += f.xs.map((v) => `<line class="gl" x1="${g.X(v)}" x2="${g.X(v)}" y1="${g.top - 4}" y2="${g.base}"/>`).join("");
            s += f.ys.map((v) => `<line class="gl" x1="${g.left}" x2="${g.right}" y1="${g.Y(v)}" y2="${g.Y(v)}"/>`).join("");
          }
          return s;
        },
      });
      const rows = f.cov.map((row, j) => row).reverse();
      const nr = f.cov.length;
      const grid = f.stage >= 1 ? Viz.grid(rows, {
        label: "cov[row][col] (top row = highest y)",
        colLabels: f.xs.slice(1).map((v, i) => `w${v - f.xs[i]}`),
        rowLabels: f.ys.slice(1).map((v, j) => `h${v - f.ys[j]}`).reverse(),
        cls: (r, c, v) => { const j = nr - 1 - r; return cur.has(`${j},${c}`) ? "active" : f.row === j && v ? "visit" : v > 0 ? "done" : "dim"; },
      }) : "";
      return wrap(
        Viz.row(p, grid),
        f.stage >= 1 ? Viz.row(chips("xs (compressed x)", f.xs.map((v, i) => [String(v), "", `#${i}`])), chips("ys (compressed y)", f.ys.map((v, i) => [String(v), "", `#${i}`]))) : "",
        f.stage >= 3 ? panel(f.final ? f.ok : undefined, `${f.final ? (f.ok ? "✓ " : "✗ ") : ""}area = ${f.area}`) : "",
      );
    },
  }));
})();
