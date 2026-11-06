/* Monotonic Stack & Queue visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const ints = (s, { min = 1, max = 14, lo = 0, hi = 99 } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((v) => !Number.isInteger(v) || v < lo || v > hi)) throw new Error(`Values must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const wrap = (...parts) => `<div class="msq">${parts.filter(Boolean).join("")}</div>`;
  const chips = (label, items, empty = "empty") => Viz.labeled(label, `<div class="msq-chips">${items.length ? items.map(([t, c, sub]) => `<span class="v-item ${c || ""}">${esc(t)}${sub !== undefined ? `<small>${esc(sub)}</small>` : ""}</span>`).join("") : `<span class="msq-empty">${esc(empty)}</span>`}</div>`);
  const panel = (ok, html) => `<div class="msq-panel ${ok === true ? "ok" : ok === false ? "bad" : ""}">${html}</div>`;

  /* Curved arrow from (x1,y1) to (x2,y2), bulging upwards. */
  const arc = (x1, y1, x2, y2, cls = "", label = "") => {
    const cx = (x1 + x2) / 2, cy = Math.min(y1, y2) - 14 - Math.min(44, Math.abs(x2 - x1) * 0.16);
    const dx = x2 - cx, dy = y2 - cy, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const pts = `${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`;
    const ly = 0.25 * y1 + 0.5 * cy + 0.25 * y2 - 5;
    return `<path class="arc ${cls}" d="M${x1},${y1} Q${cx},${cy} ${x2},${y2}"/><polygon class="ah ${cls}" points="${pts}"/>${label ? `<text class="al ${cls}" x="${cx}" y="${ly}" text-anchor="middle">${esc(label)}</text>` : ""}`;
  };

  /* Bar chart as SVG. o.cls(i,v), o.idx(i), o.under(g), o.over(g), o.max, o.h, o.width. */
  const chart = (vals, o = {}) => {
    const n = vals.length, H = o.h || 150, top = o.top ?? 62, foot = 26;
    const avail = o.width || 600;
    const bw = Math.max(18, Math.min(46, Math.floor(avail / Math.max(1, n)) - 8));
    const gap = Math.max(4, Math.round(bw / 5));
    const max = Math.max(1, o.max ?? 0, ...vals.map((v) => Math.max(0, v)));
    const g = { n, H, top, bw, gap, max, base: top + H };
    g.X = (i) => gap + i * (bw + gap);
    g.CX = (i) => g.X(i) + bw / 2;
    g.Y = (v) => top + H - (Math.max(0, v) / max) * H;
    g.W = g.X(n);
    const under = o.under ? o.under(g) : "", over = o.over ? o.over(g) : "";
    const bars = vals.map((v, i) => {
      const c = o.cls ? o.cls(i, v) || "" : "";
      const hgt = Math.max(2, g.base - g.Y(v));
      return `<rect class="b ${c}" x="${g.X(i)}" y="${g.base - hgt}" width="${bw}" height="${hgt}" rx="3"/>` +
        `<text class="bv ${c}" x="${g.CX(i)}" y="${g.base - hgt - 5}" text-anchor="middle">${esc(o.fmt ? o.fmt(v, i) : v)}</text>` +
        `<text class="bi ${c}" x="${g.CX(i)}" y="${g.base + 16}" text-anchor="middle">${esc(o.idx ? o.idx(i) : i)}</text>`;
    }).join("");
    const h = top + H + foot;
    const svg = `<svg class="msq-svg" viewBox="0 0 ${g.W} ${h}" width="${g.W}" height="${h}" role="img" aria-label="${esc(o.label || "bar chart")}">${under}<line class="axis" x1="0" x2="${g.W}" y1="${g.base}" y2="${g.base}"/>${bars}${over}</svg>`;
    return o.label ? Viz.labeled(o.label, svg) : svg;
  };
  const rectOn = (g, l, r, h, cls, label) => {
    if (r < l) return "";
    const x = g.X(l) - g.gap / 2 + 1, w = g.X(r) + g.bw + g.gap / 2 - 1 - x, y = g.Y(h);
    return `<rect class="ov ${cls}" x="${x}" y="${y}" width="${w}" height="${Math.max(0, g.base - y)}" rx="2"/>${label ? `<text class="ol ${cls}" x="${x + w / 2}" y="${y - 6}" text-anchor="middle">${esc(label)}</text>` : ""}`;
  };
  const stackBox = (arr, st, cls, label = "stack (indices)") => Viz.stack(st, { label, fmt: (j) => `${arr[j]} · i${j}`, cls: (k, j) => cls(k, j) });

  /* ─────────────────────────── 1. One template, four answers ─────────────────────────── */
  Viz.register("monotonic-stack-queue-nge", (el) => Viz.player(el, {
    title: "Next and previous greater/smaller: pop means answer",
    tag: "ONE TEMPLATE · FOUR VARIANTS",
    legend: [["active", "current i"], ["path", "on the stack (waiting)"], ["bad", "popped now"], ["done", "has its next answer"]],
    codeLang: "python",
    code: [
      "nxt, prv = [-1] * n, [-1] * n",
      "st = []                # indices still waiting",
      "for i in range(n):     # circular: 2n, a[i % n]",
      "    while st and beats(a[i], a[st[-1]]):",
      "        nxt[st.pop()] = i    # pop = answer found",
      "    prv[i] = st[-1] if st else -1",
      "    st.append(i)             # i starts waiting",
      "# left on the stack: no next answer",
    ],
    inputs: [
      { key: "a", label: "nums (1–14 values, 0..99)", value: "2,1,5,6,2,3,6,1,4", width: 230 },
      { key: "fam", label: "family", type: "select", options: ["greater", "smaller"], value: "greater" },
      { key: "ties", label: "pop when", type: "select", options: ["strictly beaten", "beaten or tied"], value: "strictly beaten" },
      { key: "mode", label: "array", type: "select", options: ["linear", "circular"], value: "linear" },
    ],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 9), 1, 9).join(",") }),
    build: ({ a, fam, ties, mode }) => {
      const circ = mode === "circular";
      const arr = ints(a, { min: 1, max: circ ? 9 : 14 }), n = arr.length;
      const greater = fam === "greater", strict = ties === "strictly beaten";
      const sym = greater ? (strict ? ">" : ">=") : (strict ? "<" : "<=");
      const beats = (x, y) => (greater ? (strict ? x > y : x >= y) : (strict ? x < y : x <= y));
      const word = greater ? "greater" : "smaller";
      const nxtName = `next ${strict ? "strictly " : ""}${word}${strict ? "" : "-or-equal"}`;
      const prvName = `previous ${strict ? "" : "strictly "}${word}${strict ? "-or-equal" : ""}`;
      const nxt = Array(n).fill(-1), prv = Array(n).fill(circ ? null : -1), st = [], arcs = [];
      const fr = [];
      const vals = circ ? arr.concat(arr) : arr;
      const snap = (x) => ({ arr, vals, n, circ, nxt: nxt.slice(), prv: prv.slice(), st: st.slice(), arcs: arcs.slice(), nxtName, prvName, ...x,
        vars: { ...(x.vars || {}), "beats(x, y)": `x ${sym} y`, st: `[${st.join(", ")}]` } });
      fr.push(snap({ line: [0, 1], note: `The stack holds indices that are <b>still waiting</b> for their ${nxtName}. Here <code>beats(x, y)</code> means <code>x ${esc(sym)} y</code>. Because a waiting index is popped the moment something beats it, the values on the stack can never contain a "beaten" pair: they stay ${greater ? "decreasing" : "increasing"} from bottom to top. That ordering is the <i>monotonic</i> in the name.` }));
      const laps = circ ? 2 * n : n;
      for (let t = 0; t < laps; t++) {
        const i = t % n, x = arr[i];
        fr.push(snap({ t, i, line: 2, vars: { i, "a[i]": x },
          note: t >= n ? `Second lap, i = ${i} (drawn as position ${t}). Nobody new is pushed in this lap. It only exists so that indices near the end can find an answer that sits <b>earlier</b> in the array, after wrapping around.`
            : st.length ? `a[${i}] = ${x} arrives. Compare it with the top of the stack, a[${st[st.length - 1]}] = ${arr[st[st.length - 1]]}. Only the top can be beaten first: everything below it is ${greater ? "larger" : "smaller"}${strict ? " or equal" : ""}.` : `a[${i}] = ${x} arrives to an empty stack, so nobody is waiting yet.` }));
        while (st.length && st[st.length - 1] !== i && beats(x, arr[st[st.length - 1]])) {
          const j = st.pop();
          nxt[j] = i;
          arcs.push({ from: j, to: t, kind: "next" });
          fr.push(snap({ t, i, popped: j, line: [3, 4], vars: { i, "a[i]": x, j, [`nxt[${j}]`]: i },
            note: `${x} ${esc(sym)} ${arr[j]}, so i = ${i} is the <b>first</b> index after ${j} that beats it. It is the first because everything between ${j} and ${i} was checked against ${j} and lost (or ${j} would have been popped earlier). Record nxt[${j}] = ${i}${greater ? ` (wait = ${(i - j + n) % n || n})` : ""} and pop: index ${j} is <b>finished</b> and is never looked at again.` }));
        }
        if (t < n) {
          const below = st.length ? st[st.length - 1] : -1;
          if (!circ) {
            prv[i] = below;
            if (below >= 0) arcs.push({ from: i, to: below, kind: "prev" });
          }
          st.push(i);
          fr.push(snap({ t, i, prevArc: !circ && below >= 0, line: circ ? 6 : [5, 6], vars: { i, "a[i]": x, ...(circ ? {} : { [`prv[${i}]`]: below }) },
            note: circ ? `Push ${i}: it now waits for something that beats ${x}.`
              : below >= 0 ? `Free bonus: whoever survives below is index ${i}'s <b>${prvName}</b>. a[${below}] = ${arr[below]} was not beaten by ${x}, and everything popped between them was. So prv[${i}] = ${below}. Push ${i}: it now waits for its own answer.`
                : `The stack is empty, so nothing to the left survives: prv[${i}] = −1. Push ${i}: it now waits for its own answer.` }));
        }
      }
      const brute = arr.map((v, j) => {
        for (let d = 1; d < (circ ? n : n - j); d++) { const k = (j + d) % n; if (beats(arr[k], v)) return k; }
        return -1;
      });
      const ok = brute.every((v, j) => v === nxt[j]);
      fr.push(snap({ final: true, ok, line: 7, vars: { "nxt": `[${nxt.join(", ")}]` },
        note: `Done. ${st.length ? `Indices ${st.join(", ")} are still waiting: nothing ${circ ? "anywhere in the circle" : "to their right"} beats them, so their answer stays −1.` : "The stack is empty: every index found an answer."} Each index was pushed once and popped at most once, so the whole scan is O(n). ${ok ? "A brute-force O(n²) check agrees with every answer." : "Mismatch with brute force!"}` }));
      return fr;
    },
    render: (f) => {
      const inSt = new Set(f.st);
      const chartHtml = chart(f.vals, {
        label: f.circ ? "a, unrolled twice (second lap is faded)" : "a",
        idx: (p) => (p >= f.n ? `${p - f.n}′` : p),
        cls: (p) => {
          const j = p % f.n, ghost = p >= f.n ? " ghost" : "";
          if (p === f.t) return "active";
          if (p >= f.n) return "ghost";
          if (j === f.popped) return "bad";
          if (inSt.has(j)) return "path";
          if (f.nxt[j] !== -1) return "done" + ghost;
          return ghost.trim();
        },
        over: (g) => f.arcs.map((a, k) => {
          const last = k === f.arcs.length - 1;
          if (a.kind === "prev") return last && f.prevArc ? arc(g.CX(a.from), g.Y(f.vals[a.from]) - 18, g.CX(a.to), g.Y(f.vals[a.to]) - 18, "prev", "prv") : "";
          const cur = last && f.popped !== undefined;
          return arc(g.CX(a.from), g.Y(f.vals[a.from]) - 18, g.CX(a.to), g.Y(f.vals[a.to]) - 18, cur ? "cur" : "old", cur ? "nxt" : "");
        }).join(""),
      });
      return wrap(
        Viz.row(chartHtml, stackBox(f.arr, f.st, (k, j) => (k === f.st.length - 1 && f.t !== undefined && !f.final ? "visit" : "path"))),
        Viz.row(
          Viz.array(f.nxt, { label: `nxt[i]: ${f.nxtName}`, cls: (j, v) => (j === f.popped ? "done" : v === -1 && f.final ? "dim" : v !== -1 ? "done" : "") }),
          f.circ ? "" : Viz.array(f.prv, { label: `prv[i]: ${f.prvName}`, cls: (j) => (j === f.i && f.prevArc !== undefined && f.popped === undefined ? "visit" : "") }),
        ),
        f.final ? panel(f.ok, f.ok ? "✓ matches brute force" : "✗ differs from brute force") : "",
      );
    },
  }));

  /* ─────────────────────────── 2. Stock span: compress what you pop ─────────────────────────── */
  Viz.register("monotonic-stack-queue-span", (el) => Viz.player(el, {
    title: "Online Stock Span: each stack entry stands for a block of days",
    tag: "COMPRESSING POPS",
    legend: [["active", "today"], ["path", "stack entry (its block)"], ["bad", "absorbed now"], ["done", "today's span"]],
    codeLang: "python",
    code: [
      "st = []  # (price, span); prices decreasing",
      "def next(price):",
      "    span = 1                   # today itself",
      "    while st and st[-1][0] <= price:",
      "        span += st.pop()[1]    # absorb a block",
      "    st.append((price, span))",
      "    return span",
    ],
    inputs: [{ key: "a", label: "prices (1–14, 1..99)", value: "100,80,60,70,60,75,85", width: 230 }],
    random: () => ({ a: Viz.randInts(Viz.rand(8, 12), 10, 90).join(",") }),
    build: ({ a }) => {
      const arr = ints(a, { min: 1, max: 14, lo: 1, hi: 999 }), n = arr.length;
      const st = [], out = [], fr = [];
      const snap = (x) => ({ arr, st: st.map((e) => ({ ...e })), out: out.slice(), ...x, vars: { ...(x.vars || {}), stack: st.map((e) => `(${e.p},${e.s})`).join(" ") || "·" } });
      fr.push(snap({ line: 0, note: "The span of day d is the number of consecutive days ending at d with price ≤ today's. It is d − (previous strictly greater day). The stack stores only days that could still be someone's previous greater, and each entry also remembers <b>how many days it swallowed</b>, so we never need the original indices." }));
      for (let d = 0; d < n; d++) {
        const p = arr[d];
        let span = 1;
        fr.push(snap({ d, line: [1, 2], vars: { day: d, price: p, span }, note: `Day ${d}: price ${p}. Start with span = 1 (today).` }));
        while (st.length && st[st.length - 1].p <= p) {
          const e = st.pop();
          span += e.s;
          fr.push(snap({ d, absorbed: e, line: [3, 4], vars: { day: d, price: p, span },
            note: `Top (${e.p}, span ${e.s}) has price ${e.p} ≤ ${p}. Every day in its block was ≤ ${e.p}, so they are all ≤ ${p} too. Absorb the whole block at once: span += ${e.s} → <b>${span}</b>. Those days never need to be looked at again.` }));
        }
        st.push({ p, s: span, d });
        out.push(span);
        fr.push(snap({ d, line: [5, 6], vars: { day: d, price: p, span },
          note: st.length > 1 ? `Stop: ${st[st.length - 2].p} &gt; ${p} is a wall. Push (${p}, ${span}). Its block covers days ${d - span + 1}..${d}. Answer: <b>${span}</b>.` : `Nothing higher remains to the left. Push (${p}, ${span}), covering days 0..${d}. Answer: <b>${span}</b>.` }));
      }
      const brute = arr.map((p, d) => { let k = d; while (k >= 0 && arr[k] <= p) k--; return d - k; });
      const ok = brute.every((v, i) => v === out[i]);
      fr.push(snap({ final: true, ok, line: 6, note: `Spans: [${out.join(", ")}]. Each day is pushed once and absorbed at most once: amortised O(1) per call. ${ok ? "Matches the brute-force scan." : "Mismatch!"}` }));
      return fr;
    },
    render: (f) => {
      const blocks = f.st.map((e) => ({ l: e.d - e.s + 1, r: e.d }));
      return wrap(
        chart(f.arr, {
          label: "prices; shaded bands = the block each stack entry stands for",
          cls: (i) => (i === f.d && !f.final ? "active" : f.absorbed && i > f.absorbed.d - f.absorbed.s && i <= f.absorbed.d ? "bad" : f.st.some((e) => e.d === i) ? "path" : f.d !== undefined && i > f.d ? "ghost" : ""),
          under: (g) => blocks.map((b, k) => {
            const x = g.X(b.l) - g.gap / 2 + 1, w = g.X(b.r) + g.bw + g.gap / 2 - 1 - x;
            return `<rect class="band ${k % 2 ? "alt" : ""}" x="${x}" y="${g.top - 8}" width="${w}" height="${g.H + 8}" rx="4"/>`;
          }).join("") + (f.d !== undefined && !f.final ? (() => {
            const sp = f.out.length > f.d ? f.out[f.d] : null;
            if (!sp) return "";
            const x = g.X(f.d - sp + 1) - g.gap / 2 + 1, w = g.X(f.d) + g.bw + g.gap / 2 - 1 - x;
            return `<rect class="band cur" x="${x}" y="${g.base + 20}" width="${w}" height="6" rx="3"/>`;
          })() : ""),
        }),
        Viz.row(
          Viz.stack(f.st, { label: "stack (price, span)", fmt: (e) => `${e.p} ×${e.s}`, cls: () => "path" }),
          Viz.array(f.out, { label: "span answers", cls: (i) => (i === f.d && !f.final ? "done" : "") }),
        ),
        f.final ? panel(f.ok, f.ok ? "✓ matches brute force" : "✗ mismatch") : "",
      );
    },
  }));

  /* ─────────────────────────── 3. Largest rectangle in histogram ─────────────────────────── */
  const histogramFrames = (H, fr, base = {}) => {
    const n = H.length, st = [];
    let best = 0, bestRect = null;
    const snap = (x) => ({ H, st: st.slice(), best, bestRect, ...base, ...x, vars: { ...(x.vars || {}), best, st: `[${st.join(", ")}]` } });
    fr.push(snap({ line: 0, note: "Every rectangle's height is set by its <b>shortest</b> bar. So ask, for each bar: how wide can a rectangle of exactly this height be? It spreads until it hits a shorter bar on each side. The stack keeps bar indices with <b>increasing</b> heights, so each bar's left wall is the one beneath it, and its right wall is whoever pops it." }));
    for (let i = 0; i <= n; i++) {
      const h = i < n ? H[i] : 0;
      fr.push(snap({ i, line: [1, 2], vars: { i, h }, note: i < n ? `Bar ${i}, height ${h}. Every stacked bar taller than or equal to ${h} has just found its right wall.` : "Sentinel: an imaginary bar of height 0 at index n. It is shorter than everything, so it flushes the stack and every remaining bar gets its rectangle measured." }));
      while (st.length && H[st[st.length - 1]] >= h) {
        const top = st.pop(), left = st.length ? st[st.length - 1] : -1, width = i - left - 1, area = H[top] * width;
        const tie = H[top] === h && i < n;
        const better = area > best;
        if (better) { best = area; bestRect = { l: left + 1, r: i - 1, h: H[top] }; }
        fr.push(snap({ i, top, left, cand: { l: left + 1, r: i - 1, h: H[top] }, line: [3, 4, 5, 6, 7],
          vars: { i, h, top, left, width, area: `${H[top]} × ${width} = ${area}` },
          note: `Pop bar ${top} (height ${H[top]}). Right wall: i = ${i}${i < n ? ` (height ${h} ≤ ${H[top]})` : " (sentinel)"}. Left wall: ${left >= 0 ? `bar ${left}, the one now on top (height ${H[left]} &lt; ${H[top]}, because heights on the stack increase)` : "none, the stack is empty, so it reaches index 0"}. Width = ${i} − (${left}) − 1 = <b>${width}</b>. Area = ${H[top]} × ${width} = <b>${area}</b>${better ? ", a new best" : ""}.${tie ? ` (Equal heights: this width is too short, but bar ${i} has the same height and will measure the full width later.)` : ""}` }));
      }
      if (i < n) {
        st.push(i);
        fr.push(snap({ i, line: 8, vars: { i, h }, note: `Push bar ${i}. It waits for a shorter bar to its right. Its left wall is already fixed: bar ${st.length > 1 ? st[st.length - 2] : "−1 (none)"}.` }));
      }
    }
    return best;
  };
  const histBrute = (H) => { let b = 0; for (let l = 0; l < H.length; l++) { let m = Infinity; for (let r = l; r < H.length; r++) { m = Math.min(m, H[r]); b = Math.max(b, m * (r - l + 1)); } } return b; };

  Viz.register("monotonic-stack-queue-histogram", (el) => Viz.player(el, {
    title: "Largest rectangle in a histogram: every pop measures one rectangle",
    tag: "THE CLASSIC HARD ONE",
    legend: [["active", "popped bar: its rectangle"], ["visit", "left wall (new top)"], ["bad", "right wall (i)"], ["path", "on the stack"], ["done", "best so far"]],
    codeLang: "python",
    code: [
      "st, best = [], 0             # heights increasing",
      "for i in range(n + 1):",
      "    h = heights[i] if i < n else 0   # sentinel",
      "    while st and heights[st[-1]] >= h:",
      "        top = st.pop()         # right wall: i",
      "        left = st[-1] if st else -1  # left wall",
      "        width = i - left - 1",
      "        best = max(best, heights[top] * width)",
      "    st.append(i)",
    ],
    inputs: [{ key: "a", label: "heights (1–12, 0..20)", value: "2,1,5,6,2,3", width: 220 }],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 10), 1, 9).join(",") }),
    build: ({ a }) => {
      const H = ints(a, { min: 1, max: 12, lo: 0, hi: 20 }), fr = [];
      const best = histogramFrames(H, fr);
      const ok = best === histBrute(H);
      const last = fr[fr.length - 1];
      fr.push({ ...last, i: undefined, top: undefined, left: undefined, cand: null, final: true, ok, line: 0,
        note: `Largest rectangle: <b>${best}</b>. Each bar was pushed once and popped once, and each pop measured the widest rectangle of that bar's height: n candidates in O(n) total instead of O(n²) ranges. ${ok ? "Brute force agrees." : "Brute force disagrees!"}` });
      return fr;
    },
    render: (f) => {
      const n = f.H.length, inSt = new Set(f.st), vals = f.H.concat([0]);
      return wrap(
        Viz.row(chart(vals, {
          label: "heights (the last slot is the 0 sentinel)",
          idx: (i) => (i === n ? "n" : i),
          cls: (i) => (i === n ? (f.i === n ? "bad" : "ghost") : i === f.top ? "active" : f.cand && i === f.left ? "visit" : f.cand && i === f.i ? "bad" : i === f.i && !f.cand ? "active" : inSt.has(i) ? "path" : ""),
          under: (g) => (f.bestRect && !(f.cand && f.cand.l === f.bestRect.l && f.cand.r === f.bestRect.r && f.cand.h === f.bestRect.h && !f.final) ? rectOn(g, f.bestRect.l, f.bestRect.r, f.bestRect.h, "best", f.final ? `best ${f.best}` : "") : ""),
          over: (g) => (f.cand ? rectOn(g, f.cand.l, f.cand.r, f.cand.h, "cand", `${f.cand.h} × ${f.cand.r - f.cand.l + 1} = ${f.cand.h * (f.cand.r - f.cand.l + 1)}`) : ""),
        }), stackBox(f.H, f.st, (k) => (f.cand && k === f.st.length - 1 ? "visit" : "path"))),
        f.final ? panel(f.ok, f.ok ? `✓ best = ${f.best}, matches brute force` : "✗ mismatch") : "",
      );
    },
  }));

  /* ─────────────────────────── 4. Maximal rectangle: one histogram per row ─────────────────────────── */
  Viz.register("monotonic-stack-queue-maxrect", (el) => Viz.player(el, {
    title: "Maximal rectangle: every row is the floor of a histogram",
    tag: "2D → 1D",
    legend: [["active", "candidate rectangle"], ["done", "best rectangle"], ["visit", "current row (floor)"], ["wall", "0 cell"]],
    codeLang: "python",
    code: [
      "hs, best = [0] * cols, 0",
      "for row in matrix:",
      "    for c in range(cols):",
      "        hs[c] = hs[c] + 1 if row[c] == '1' else 0",
      "    st = []",
      "    for i in range(cols + 1):",
      "        h = hs[i] if i < cols else 0",
      "        while st and hs[st[-1]] >= h:",
      "            t = st.pop(); l = st[-1] if st else -1",
      "            best = max(best, hs[t] * (i - l - 1))",
      "        st.append(i)",
      "return best",
    ],
    inputs: [{ key: "m", label: "rows of 0/1 separated by ; (≤ 6 × 8)", value: "10100;10111;11111;10010", width: 260 }],
    random: () => ({ m: Array.from({ length: Viz.rand(3, 5) }, () => Array.from({ length: 6 }, () => (Math.random() < 0.7 ? "1" : "0")).join("")).join(";") }),
    build: ({ m }) => {
      const rows = String(m).split(/[;\n]/).map((r) => r.replace(/[\s,]/g, "")).filter(Boolean);
      if (!rows.length || rows.length > 6) throw new Error("Use 1–6 rows separated by ';'.");
      const C = rows[0].length;
      if (C < 1 || C > 8 || rows.some((r) => r.length !== C || /[^01]/.test(r))) throw new Error("Every row needs the same 1–8 characters, each 0 or 1.");
      const M = rows.map((r) => [...r].map(Number)), R = M.length;
      const heights = Array(C).fill(0), fr = [];
      let best = 0, bestRect = null;
      const snap = (x) => ({ M, heights: heights.slice(), best, bestRect, ...x, vars: { ...(x.vars || {}), heights: `[${heights.join(", ")}]`, best } });
      fr.push(snap({ line: 0, note: "Any all-ones rectangle has a bottom row. Stand on each row in turn and look <b>up</b>: heights[c] counts consecutive 1s ending at this row in column c. A rectangle whose bottom is this row is exactly a rectangle in that histogram. Run the histogram algorithm once per row." }));
      for (let r = 0; r < R; r++) {
        for (let c = 0; c < C; c++) heights[c] = M[r][c] ? heights[c] + 1 : 0;
        fr.push(snap({ r, line: [1, 2, 3], vars: { row: r }, note: `Row ${r} becomes the floor. A 1 extends the column's tower by one; a 0 knocks it down to 0, because a rectangle cannot stand on a 0. heights = [${heights.join(", ")}].` }));
        const st = [];
        for (let i = 0; i <= C; i++) {
          const h = i < C ? heights[i] : 0;
          while (st.length && heights[st[st.length - 1]] >= h) {
            const top = st.pop(), left = st.length ? st[st.length - 1] : -1, area = heights[top] * (i - left - 1);
            const cand = { r0: r - heights[top] + 1, r1: r, c0: left + 1, c1: i - 1, h: heights[top] };
            const better = area > best;
            if (better) { best = area; bestRect = cand; }
            if (heights[top] > 0) fr.push(snap({ r, st: st.slice(), cand, line: [7, 8, 9], vars: { row: r, top, left, area },
              note: `Pop column ${top} (height ${heights[top]}): it spans columns ${left + 1}..${i - 1}, so the rectangle is rows ${cand.r0}..${r} × columns ${cand.c0}..${cand.c1}, area ${heights[top]} × ${i - left - 1} = <b>${area}</b>${better ? ", a new best" : ""}.` }));
          }
          if (i < C) st.push(i);
        }
      }
      let brute = 0;
      for (let r0 = 0; r0 < R; r0++) for (let r1 = r0; r1 < R; r1++) for (let c0 = 0; c0 < C; c0++) for (let c1 = c0; c1 < C; c1++) {
        let all = true;
        for (let r = r0; r <= r1 && all; r++) for (let c = c0; c <= c1; c++) if (!M[r][c]) { all = false; break; }
        if (all) brute = Math.max(brute, (r1 - r0 + 1) * (c1 - c0 + 1));
      }
      const ok = brute === best;
      fr.push(snap({ final: true, ok, line: 11, note: `Best: <b>${best}</b>. ${R} rows × O(cols) per histogram = O(rows · cols). ${ok ? "Brute force over every rectangle agrees." : "Brute force disagrees!"}` }));
      return fr;
    },
    render: (f) => {
      const inRect = (rc, r, c) => rc && r >= rc.r0 && r <= rc.r1 && c >= rc.c0 && c <= rc.c1;
      return wrap(Viz.row(
        Viz.grid(f.M, {
          label: "matrix", rowLabels: f.M.map((_, i) => `r${i}`), colLabels: f.M[0].map((_, j) => `c${j}`),
          cls: (r, c, v) => (inRect(f.cand, r, c) ? "active" : inRect(f.bestRect, r, c) && (f.final || f.cand) ? "done" : !v ? "wall" : r === f.r ? "visit" : r > (f.r ?? -1) ? "dim" : ""),
        }),
        f.r !== undefined ? chart(f.heights, {
          label: `heights with row ${f.r} as the floor`, h: 110, top: 40, width: 360, max: f.M.length,
          idx: (i) => `c${i}`,
          cls: (i) => (f.cand && i >= f.cand.c0 && i <= f.cand.c1 ? "active" : ""),
          over: (g) => (f.cand ? rectOn(g, f.cand.c0, f.cand.c1, f.cand.h, "cand", `${f.cand.h}×${f.cand.c1 - f.cand.c0 + 1}`) : ""),
        }) : "",
      ), f.final ? panel(f.ok, f.ok ? `✓ best = ${f.best}` : "✗ mismatch") : "");
    },
  }));

  /* ─────────────────────────── 5. Trapping rain water, one layer per pop ─────────────────────────── */
  Viz.register("monotonic-stack-queue-trap", (el) => Viz.player(el, {
    title: "Trapping rain water with a stack: fill horizontal layers",
    tag: "LAYER BY LAYER",
    legend: [["bad", "popped floor"], ["visit", "left wall"], ["active", "right wall (i)"], ["path", "on the stack"]],
    codeLang: "python",
    code: [
      "st, water = [], 0        # hs[st] decreasing",
      "for i, h in enumerate(hs):",
      "    while st and hs[st[-1]] < h:",
      "        bottom = st.pop()    # a floor",
      "        if not st: break     # no left wall",
      "        left = st[-1]",
      "        width = i - left - 1",
      "        depth = min(hs[left], h) - hs[bottom]",
      "        water += width * depth   # one layer",
      "    st.append(i)",
      "return water",
    ],
    inputs: [{ key: "a", label: "heights (2–14, 0..12)", value: "0,1,0,2,1,0,1,3,2,1,2,1", width: 240 }],
    random: () => ({ a: Viz.randInts(Viz.rand(8, 13), 0, 6).join(",") }),
    build: ({ a }) => {
      const H = ints(a, { min: 2, max: 14, lo: 0, hi: 12 }), n = H.length;
      const st = [], layers = [], fr = [];
      let water = 0;
      const snap = (x) => ({ H, st: st.slice(), layers: layers.slice(), water, ...x, vars: { ...(x.vars || {}), water, st: `[${st.join(", ")}]` } });
      fr.push(snap({ line: 0, note: "The two-pointer solution fills water <b>column by column</b>. The stack fills it <b>layer by layer</b>: a bar that is lower than both a bar on its left and a later bar on its right is the floor of a pool. The stack keeps decreasing heights, so the bar beneath a popped floor is its left wall, and i is its right wall." }));
      for (let i = 0; i < n; i++) {
        const h = H[i];
        fr.push(snap({ i, line: 1, vars: { i, h }, note: `Bar ${i}, height ${h}.${st.length && H[st[st.length - 1]] < h ? " It is taller than the top of the stack, so it can be a right wall." : " It is not taller than the top, so no pool closes here."}` }));
        while (st.length && H[st[st.length - 1]] < h) {
          const bottom = st.pop();
          if (!st.length) {
            fr.push(snap({ i, bottom, line: [3, 4], vars: { i, h, bottom }, note: `Pop floor ${bottom}, but nothing is left on the stack: there is no wall to its left, so any water here would run off the left edge. Stop.` }));
            break;
          }
          const left = st[st.length - 1], width = i - left - 1, depth = Math.min(H[left], h) - H[bottom];
          water += width * depth;
          const layer = { l: left + 1, r: i - 1, y0: H[bottom], y1: H[bottom] + depth };
          if (depth > 0) layers.push(layer);
          fr.push(snap({ i, bottom, left, cur: depth > 0 ? layer : null, line: [3, 5, 6, 7, 8], vars: { i, h, bottom, left, width, depth, "+": width * depth },
            note: `Pop floor ${bottom} (height ${H[bottom]}). Left wall: bar ${left} (height ${H[left]}); right wall: bar ${i} (height ${h}). The water rises to the lower wall, min(${H[left]}, ${h}) = ${Math.min(H[left], h)}, which is ${depth} above the floor. The layer is ${width} wide (columns ${left + 1}..${i - 1}), so add ${width} × ${depth} = <b>${width * depth}</b>.${depth === 0 ? " (Depth 0: the floor is as high as a wall, nothing to add.)" : ""}` }));
        }
        st.push(i);
      }
      let brute = 0;
      for (let i = 0; i < n; i++) brute += Math.max(0, Math.min(Math.max(...H.slice(0, i + 1)), Math.max(...H.slice(i))) - H[i]);
      const ok = brute === water;
      fr.push(snap({ final: true, ok, line: 10, note: `Total water: <b>${water}</b>, built from ${layers.length} horizontal layer${layers.length === 1 ? "" : "s"}. ${ok ? "The column-by-column formula min(maxLeft, maxRight) − h agrees." : "Mismatch!"}` }));
      return fr;
    },
    render: (f) => {
      const inSt = new Set(f.st), mx = Math.max(1, ...f.H);
      return wrap(Viz.row(chart(f.H, {
        label: "elevation map; blue = water layers so far",
        max: mx,
        cls: (i) => (i === f.bottom ? "bad" : i === f.left && f.cur !== undefined ? "visit" : i === f.i ? "active" : inSt.has(i) ? "path" : f.i !== undefined && i > f.i ? "ghost" : ""),
        over: (g) => f.layers.map((L) => {
          const cur = f.cur && L === f.cur;
          const x = g.X(L.l) - g.gap / 2, w = g.X(L.r) + g.bw + g.gap / 2 - x, y = g.Y(L.y1), y2 = g.Y(L.y0);
          return `<rect class="water ${cur ? "cur" : ""}" x="${x}" y="${y}" width="${w}" height="${y2 - y}"/>${cur ? `<text class="ol cur" x="${x + w / 2}" y="${(y + y2) / 2 + 4}" text-anchor="middle">${L.r - L.l + 1}×${L.y1 - L.y0}</text>` : ""}`;
        }).join(""),
      }), stackBox(f.H, f.st, () => "path")),
      f.final ? panel(f.ok, f.ok ? `✓ water = ${f.water}` : "✗ mismatch") : "");
    },
  }));

  /* ─────────────────────────── 6. Contribution technique with tie rules ─────────────────────────── */
  const RULES = {
    "left <, right <= (correct)": ["<", "<="],
    "both strict <": ["<", "<"],
    "both non-strict <=": ["<=", "<="],
  };
  Viz.register("monotonic-stack-queue-contrib", (el) => Viz.player(el, {
    title: "Sum of subarray minimums: who owns each subarray?",
    tag: "CONTRIBUTION TECHNIQUE",
    legend: [["active", "a[j], the minimum"], ["visit", "walls: first smaller on each side"], ["window", "its kingdom"], ["bad", "double-counted / missed subarray"]],
    codeLang: "python",
    code: [
      "left  = prev index with a[k] (rule) a[j], else -1",
      "right = next index with a[k] (rule) a[j], else n",
      "total = 0",
      "for j in range(n):",
      "    L = j - left[j]          # choices of start",
      "    R = right[j] - j         # choices of end",
      "    total += a[j] * L * R    # a[j] is their min",
      "return total",
    ],
    inputs: [
      { key: "a", label: "arr (1–10, values 1..9)", value: "3,1,2,4,1,3", width: 200 },
      { key: "rule", label: "tie rule", type: "select", options: Object.keys(RULES), value: "left <, right <= (correct)" },
    ],
    random: () => ({ a: Viz.randInts(Viz.rand(5, 8), 1, 4).join(",") }),
    build: ({ a, rule }) => {
      const arr = ints(a, { min: 1, max: 10, lo: 1, hi: 9 }), n = arr.length;
      const [lr, rr] = RULES[rule] || RULES["left <, right <= (correct)"];
      const cmp = (op, x, y) => (op === "<" ? x < y : x <= y);
      const left = arr.map((v, j) => { let k = j - 1; while (k >= 0 && !cmp(lr, arr[k], v)) k--; return k; });
      const right = arr.map((v, j) => { let k = j + 1; while (k < n && !cmp(rr, arr[k], v)) k++; return k; });
      let total = 0;
      const fr = [], parts = [];
      const snap = (x) => ({ arr, left, right, rule: [lr, rr], total, parts: parts.slice(), ...x, vars: { ...(x.vars || {}), total } });
      fr.push(snap({ line: [0, 1, 2], vars: { "left uses": `a[k] ${lr} a[j]`, "right uses": `a[k] ${rr} a[j]` },
        note: `Summing min over all ${n * (n + 1) / 2} subarrays directly is O(n²). Flip it: for each j, count the subarrays in which a[j] <b>is</b> the minimum, and add a[j] times that count. Both walls come from the monotonic stack (one pass, see the visualizer above). The tie rule decides who owns a subarray whose minimum appears twice: ${lr === rr ? "<b>here both sides use the same rule, watch what happens with duplicates</b>" : "here exactly one copy, the <b>rightmost</b>, owns it"}.` }));
      for (let j = 0; j < n; j++) {
        const L = j - left[j], R = right[j] - j, c = arr[j] * L * R;
        total += c;
        parts.push(c);
        fr.push(snap({ j, line: [3, 4, 5, 6], vars: { j, "a[j]": arr[j], "left[j]": left[j], "right[j]": right[j], L, R, "+": `${arr[j]}×${L}×${R} = ${c}` },
          note: `a[${j}] = ${arr[j]}. Walls: ${left[j] >= 0 ? `a[${left[j]}] = ${arr[left[j]]}` : "the left edge"} and ${right[j] < n ? `a[${right[j]}] = ${arr[right[j]]}` : "the right edge"}. A subarray has a[${j}] as its min exactly when it starts in ${left[j] + 1}..${j} (<b>${L}</b> choices) and ends in ${j}..${right[j] - 1} (<b>${R}</b> choices). That is ${L} × ${R} = ${L * R} subarrays, contributing ${arr[j]} × ${L * R} = <b>${c}</b>.` }));
      }
      let brute = 0;
      const owners = [];
      for (let l = 0; l < n; l++) { let m = Infinity; for (let r = l; r < n; r++) { m = Math.min(m, arr[r]); brute += m; } }
      for (let l = 0; l < n && owners.length < 1; l++) for (let r = l; r < n; r++) {
        const who = [];
        for (let j = l; j <= r; j++) if (left[j] < l && right[j] > r) who.push(j);
        if (who.length !== 1) { owners.push({ l, r, who }); break; }
      }
      const ok = brute === total;
      const bad = owners[0];
      fr.push(snap({ final: true, ok, bad, line: 7, vars: { total, brute },
        note: ok ? `Total = <b>${total}</b>, matching the brute-force O(n²) sum. Every subarray was counted exactly once: by its <b>rightmost</b> minimum (the left wall is the previous <i>strictly</i> smaller value, so an equal value to the left does not stop it; the right wall is the next smaller <i>or equal</i> value, so an equal value to the right does).`
          : bad ? `Total = ${total}, but the true sum is <b>${brute}</b>. Look at subarray [${bad.l}..${bad.r}] = [${arr.slice(bad.l, bad.r + 1).join(", ")}]: it is claimed by ${bad.who.length === 0 ? "<b>nobody</b> (every copy of the minimum stopped at the other copy)" : `<b>${bad.who.length}</b> indices (${bad.who.join(", ")}), because neither copy of the minimum treats the other as a wall`}. Exactly one side must be strict.` : `Mismatch: ${total} vs ${brute}.` }));
      return fr;
    },
    render: (f) => {
      const n = f.arr.length, j = f.j;
      const pieces = [chart(f.arr, {
        label: "arr", max: 9, h: 120, top: 34,
        cls: (i) => (f.bad ? (i >= f.bad.l && i <= f.bad.r ? (f.bad.who.includes(i) ? "active" : "bad") : "ghost") : j === undefined ? "" : i === j ? "active" : i === f.left[j] || i === f.right[j] ? "visit" : i > f.left[j] && i < f.right[j] ? "" : "ghost"),
        under: (g) => {
          if (f.bad) return rectOn(g, f.bad.l, f.bad.r, 9, "badspan", "");
          if (j === undefined) return "";
          return rectOn(g, f.left[j] + 1, f.right[j] - 1, 9, "span", "");
        },
      })];
      if (j !== undefined && !f.final) {
        const L = j - f.left[j], R = f.right[j] - j;
        const m = Array.from({ length: L }, (_, a) => Array.from({ length: R }, (_, b) => `[${f.left[j] + 1 + a}..${j + b}]`));
        pieces.push(Viz.grid(m, { label: `${L} starts × ${R} ends = ${L * R} subarrays with min a[${j}] = ${f.arr[j]}`, rowLabels: m.map((_, a) => `s${f.left[j] + 1 + a}`), colLabels: m[0].map((_, b) => `e${j + b}`), cls: () => "done" }));
      }
      return wrap(Viz.row(...pieces), Viz.array(f.parts, { label: "contribution of each j", idxLabel: (i) => `j${i}`, cls: (i) => (i === j && !f.final ? "done" : "") }),
        f.final ? panel(f.ok, f.ok ? `✓ total = ${f.total}` : `✗ total = ${f.total}, expected ${f.vars.brute}`) : "");
    },
  }));

  /* ─────────────────────────── 7. Remove K digits (greedy + stack) ─────────────────────────── */
  Viz.register("monotonic-stack-queue-removek", (el) => Viz.player(el, {
    title: "Remove K digits: a bigger digit earlier is the worst thing in the number",
    tag: "GREEDY + MONOTONIC STACK",
    legend: [["active", "current digit"], ["path", "kept (stack)"], ["bad", "removed"]],
    codeLang: "python",
    code: [
      "st = []",
      "for d in num:",
      "    while k and st and st[-1] > d:",
      "        st.pop(); k -= 1   # drop the bigger digit",
      "    st.append(d)",
      "st = st[:len(st) - k]     # leftover k: cut tail",
      "res = ''.join(st).lstrip('0')",
      "return res or '0'",
    ],
    inputs: [{ key: "num", label: "num (1–16 digits)", value: "1432219", width: 170 }, { key: "k", label: "k", value: "3", width: 60 }],
    random: () => {
      const n = Viz.rand(7, 12);
      return { num: Array.from({ length: n }, () => Viz.rand(0, 9)).join("").replace(/^0+/, "1"), k: String(Viz.rand(1, 4)) };
    },
    build: ({ num, k }) => {
      const s = String(num).trim();
      if (!/^\d{1,16}$/.test(s)) throw new Error("num must be 1–16 digits.");
      let K = Viz.parse.int(k, { min: 0, max: s.length });
      const K0 = K, ds = [...s], st = [], removed = new Set(), fr = [];
      const snap = (x) => ({ ds, st: st.slice(), removed: new Set(removed), ...x, vars: { ...(x.vars || {}), k: K, stack: st.map((i) => ds[i]).join("") || "·" } });
      fr.push(snap({ line: 0, note: `Compare two numbers of equal length: the first differing digit decides. So scan left to right and keep the kept digits <b>non-decreasing</b> whenever we can afford it. A digit followed by a smaller one is a "peak": deleting it moves the smaller digit one place to the left, which is always better. We may delete ${K0} digits.` }));
      for (let i = 0; i < ds.length; i++) {
        const d = ds[i];
        fr.push(snap({ i, line: 1, vars: { d } , note: `Digit ${d}.${K && st.length && ds[st[st.length - 1]] > d ? ` It is smaller than the top (${ds[st[st.length - 1]]}), so the top is a peak.` : K ? " No peak in front of it." : " No deletions left, so everything from here is kept."}` }));
        while (K && st.length && ds[st[st.length - 1]] > d) {
          const j = st.pop();
          removed.add(j);
          K--;
          fr.push(snap({ i, popped: j, line: [2, 3], vars: { d }, note: `Delete ${ds[j]} (index ${j}): ${ds[j]} &gt; ${d}, so putting ${d} in its place makes the number smaller at an earlier position, and no later choice can undo that. ${K} deletion${K === 1 ? "" : "s"} left.` }));
        }
        st.push(i);
        fr.push(snap({ i, line: 4, vars: { d }, note: `Keep ${d}. The kept digits stay ${K ? "non-decreasing" : "as they are"}: ${st.map((x) => ds[x]).join("")}.` }));
      }
      if (K) {
        const cut = st.splice(st.length - K, K);
        cut.forEach((j) => removed.add(j));
        fr.push(snap({ line: 5, cut, note: `${K} deletion${K === 1 ? "" : "s"} left, and the kept digits are non-decreasing, so the largest ones are at the end. Cut the last ${K}.` }));
        K = 0;
      }
      const res = st.map((i) => ds[i]).join("").replace(/^0+/, "") || "0";
      let brute = null;
      if (s.length <= 16) {
        const pick = (pos, left, acc) => {
          if (left === 0) return [acc];
          if (pos >= s.length || s.length - pos < left) return [];
          return pick(pos + 1, left - 1, acc + s[pos]).concat(pick(pos + 1, left, acc));
        };
        const keep = s.length - K0;
        const all = keep === 0 ? [""] : (s.length <= 14 ? pick(0, keep, "") : null);
        if (all) brute = all.map((t) => t.replace(/^0+/, "") || "0").sort((x, y) => x.length - y.length || (x < y ? -1 : x > y ? 1 : 0))[0];
      }
      const ok = brute === null || brute === res;
      fr.push(snap({ final: true, ok, line: [6, 7], vars: { result: res }, note: `Strip leading zeros: the result is <b>${res}</b>. O(n): each digit is pushed and popped at most once. ${brute !== null ? (ok ? "Trying every subsequence of the right length agrees." : `Brute force says ${brute}!`) : ""}` }));
      return fr;
    },
    render: (f) => wrap(
      Viz.array(f.ds, { label: "num", cls: (i) => (i === f.popped || (f.cut && f.cut.includes(i)) ? "bad" : f.removed.has(i) ? "bad dim" : i === f.i ? "active" : f.st.includes(i) ? "path" : f.i !== undefined && i > f.i ? "" : f.final ? "path" : "") }),
      Viz.array(f.st.map((i) => f.ds[i]), { label: "stack = the answer so far (bottom on the left)", showIdx: false, cls: (k) => (k === f.st.length - 1 && !f.final ? "visit" : "path") }),
      f.final ? panel(f.ok, f.ok ? `✓ ${f.vars.result}` : "✗ mismatch") : "",
    ),
  }));

  /* ─────────────────────────── 8. Smallest subsequence of distinct characters ─────────────────────────── */
  Viz.register("monotonic-stack-queue-distinct", (el) => Viz.player(el, {
    title: "Smallest subsequence of distinct characters: pop only what comes back",
    tag: "GREEDY + LAST OCCURRENCE",
    legend: [["active", "current char"], ["path", "kept (stack)"], ["bad", "popped (appears again later)"], ["dim", "skipped (already kept)"]],
    codeLang: "python",
    code: [
      "last = {c: i for i, c in enumerate(s)}",
      "st, seen = [], set()",
      "for i, c in enumerate(s):",
      "    if c in seen: continue",
      "    while st and st[-1] > c and last[st[-1]] > i:",
      "        seen.remove(st.pop())  # comes back later",
      "    st.append(c); seen.add(c)",
      "return ''.join(st)",
    ],
    inputs: [{ key: "s", label: "s (lowercase, 1–16)", value: "cbacdcbc", width: 170 }],
    random: () => ({ s: Array.from({ length: Viz.rand(8, 13) }, () => "abcde"[Viz.rand(0, 4)]).join("") }),
    build: ({ s }) => {
      s = String(s).trim();
      if (!/^[a-z]{1,16}$/.test(s)) throw new Error("Use 1–16 lowercase letters.");
      const cs = [...s], last = {};
      cs.forEach((c, i) => { last[c] = i; });
      const st = [], seen = new Set(), fr = [], skipped = new Set(), popped = new Set();
      const snap = (x) => ({ cs, last, st: st.slice(), skipped: new Set(skipped), poppedAll: new Set(popped), ...x, vars: { ...(x.vars || {}), stack: st.map((i) => cs[i]).join("") || "·" } });
      fr.push(snap({ line: [0, 1], note: "Each letter must appear exactly once, and the result must be lexicographically smallest. Same greedy as Remove K Digits (a bigger letter before a smaller one should go), with a new safety condition: only pop a letter if it <b>appears again later</b>, otherwise we would lose it for good. <code>last</code> records each letter's final position." }));
      for (let i = 0; i < cs.length; i++) {
        const c = cs[i];
        if (seen.has(c)) {
          skipped.add(i);
          fr.push(snap({ i, line: 3, vars: { i, c }, note: `'${c}' is already in the stack, at the best position the greedy could find for it. A second copy could only replace it with a later, worse slot. Skip.` }));
          continue;
        }
        fr.push(snap({ i, line: 2, vars: { i, c }, note: `'${c}' at index ${i}.` }));
        while (st.length) {
          const top = cs[st[st.length - 1]];
          if (!(top > c)) break;
          if (last[top] <= i) {
            fr.push(snap({ i, blocked: st[st.length - 1], line: 4, vars: { i, c, [`last['${top}']`]: last[top] }, note: `'${top}' &gt; '${c}', so we would like to drop it, but its last occurrence is index ${last[top]} ≤ ${i}. Dropping it would lose '${top}' entirely. It stays, and it protects everything below it.` }));
            break;
          }
          const j = st.pop();
          seen.delete(top);
          popped.add(j);
          fr.push(snap({ i, popped: j, line: [4, 5], vars: { i, c, [`last['${top}']`]: last[top] }, note: `'${top}' &gt; '${c}', and '${top}' appears again at index ${last[top]} &gt; ${i}. Pop it: '${c}' takes the earlier position, and '${top}' will be picked up again later.` }));
        }
        st.push(i);
        seen.add(c);
        fr.push(snap({ i, line: 6, vars: { i, c }, note: `Keep '${c}'. Stack: "${st.map((x) => cs[x]).join("")}".` }));
      }
      const res = st.map((i) => cs[i]).join("");
      const letters = [...new Set(cs)];
      let brute = null;
      if (cs.length <= 16) {
        const memo = [];
        for (let mask = 1; mask < 1 << cs.length; mask++) {
          let t = "", used = new Set(), okm = true;
          for (let b = 0; b < cs.length; b++) if (mask & (1 << b)) { if (used.has(cs[b])) { okm = false; break; } used.add(cs[b]); t += cs[b]; }
          if (okm && used.size === letters.length) memo.push(t);
        }
        brute = memo.sort()[0];
      }
      const ok = brute === null || brute === res;
      fr.push(snap({ final: true, ok, line: 7, vars: { result: res }, note: `Result: <b>"${res}"</b>. O(n) time, O(alphabet) space. ${brute !== null ? (ok ? "Checking every distinct-letter subsequence agrees." : `Brute force says "${brute}"!`) : ""}` }));
      return fr;
    },
    render: (f) => wrap(
      Viz.array(f.cs, { label: "s (under each letter: index → index of its last copy)", idxLabel: (i) => `${i} → ${f.last[f.cs[i]]}`,
        cls: (i) => (i === f.popped ? "bad" : i === f.i ? "active" : i === f.blocked ? "visit" : f.st.includes(i) ? "path" : f.skipped.has(i) ? "dim" : f.poppedAll.has(i) ? "bad dim" : "") }),
      Viz.array(f.st.map((i) => f.cs[i]), { label: "stack = answer so far", showIdx: false, cls: (k) => (f.st[k] === f.blocked ? "visit" : "path") }),
      f.final ? panel(f.ok, f.ok ? `✓ "${f.vars.result}"` : "✗ mismatch") : "",
    ),
  }));

  /* ─────────────────────────── 9. Shortest subarray with sum ≥ K: deque on prefix sums ─────────────────────────── */
  Viz.register("monotonic-stack-queue-shortest", (el) => Viz.player(el, {
    title: "Shortest subarray with sum ≥ K: a monotonic queue over prefix sums",
    tag: "DEQUE ON PREFIX SUMS",
    legend: [["active", "current j"], ["path", "candidate starts (deque)"], ["done", "front used up: answer"], ["bad", "dropped from the back"]],
    codeLang: "python",
    code: [
      "P = [0] + prefix sums of nums",
      "dq, best = deque(), inf   # starts, P increasing",
      "for j in range(n + 1):",
      "    while dq and P[j] - P[dq[0]] >= k:",
      "        best = min(best, j - dq.popleft())",
      "    while dq and P[dq[-1]] >= P[j]:",
      "        dq.pop()           # j: later AND lower",
      "    dq.append(j)",
      "return best if best <= n else -1",
    ],
    inputs: [{ key: "a", label: "nums (1–12, −20..20)", value: "2,-1,2,-3,4,1,-2,3", width: 220 }, { key: "k", label: "k", value: "4", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 11), -6, 8).join(","), k: String(Viz.rand(3, 10)) }),
    build: ({ a, k }) => {
      const arr = ints(a, { min: 1, max: 12, lo: -20, hi: 20 }), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: 200 });
      const P = [0];
      arr.forEach((x) => P.push(P[P.length - 1] + x));
      const dq = [], fr = [], used = new Set(), dropped = new Set();
      let best = Infinity, bestPair = null;
      const snap = (x) => ({ arr, P, K, dq: dq.slice(), used: new Set(used), dropped: new Set(dropped), best, bestPair, ...x, vars: { ...(x.vars || {}), best: best === Infinity ? "∞" : best, dq: `[${dq.join(", ")}]` } });
      fr.push(snap({ line: [0, 1], note: `sum(nums[i..j−1]) = P[j] − P[i]. We want the closest i before j with P[j] − P[i] ≥ ${K}, i.e. a <b>low</b> point P[i] not too far back. Negative numbers break the sliding window (the sum is not monotone in the window length), but two dominance rules still hold, and they keep the candidate starts <b>increasing</b> in P.` }));
      for (let j = 0; j <= n; j++) {
        fr.push(snap({ j, line: 2, vars: { j, "P[j]": P[j] }, note: `j = ${j}, P[${j}] = ${P[j]}.` }));
        while (dq.length && P[j] - P[dq[0]] >= K) {
          const i = dq.shift();
          used.add(i);
          const better = j - i < best;
          if (better) { best = j - i; bestPair = [i, j]; }
          fr.push(snap({ j, pair: [i, j], line: [3, 4], vars: { j, i, "P[j]−P[i]": P[j] - P[i], len: j - i },
            note: `Front start i = ${i}: P[${j}] − P[${i}] = ${P[j]} − ${P[i]} = ${P[j] - P[i]} ≥ ${K}. Subarray [${i}..${j - 1}] has length ${j - i}${better ? ", a new best" : ""}. Pop i from the <b>front</b>: any later j would give it a longer subarray, so this is the best i will ever do.` }));
        }
        while (dq.length && P[dq[dq.length - 1]] >= P[j]) {
          const i = dq.pop();
          dropped.add(i);
          fr.push(snap({ j, droppedNow: i, line: [5, 6], vars: { j, "P[j]": P[j], [`P[${i}]`]: P[i] },
            note: `Back start ${i} has P = ${P[i]} ≥ P[${j}] = ${P[j]}. Start ${j} is both <b>later</b> (shorter subarrays) and <b>lower</b> (bigger sums), so ${i} can never beat it. Drop ${i} from the back.` }));
        }
        dq.push(j);
        fr.push(snap({ j, line: 7, vars: { j }, note: `Append ${j} as a candidate start. Deque P values: [${dq.map((i) => P[i]).join(", ")}], increasing.` }));
      }
      let brute = Infinity;
      for (let i = 0; i < n; i++) { let s = 0; for (let r = i; r < n; r++) { s += arr[r]; if (s >= K) { brute = Math.min(brute, r - i + 1); break; } } }
      const ok = brute === best;
      fr.push(snap({ final: true, ok, pair: bestPair, line: 8, note: best === Infinity ? `No subarray reaches ${K}: answer −1. ${ok ? "Brute force agrees." : ""}` : `Shortest length: <b>${best}</b>, subarray [${bestPair[0]}..${bestPair[1] - 1}]. O(n): every index enters and leaves the deque once. ${ok ? "Brute force agrees." : "Brute force disagrees!"}` }));
      return fr;
    },
    render: (f) => {
      const n1 = f.P.length, lo = Math.min(0, ...f.P), hi = Math.max(1, ...f.P);
      const W = Math.min(600, 60 * n1 + 40), H = 170, padL = 34, padT = 26;
      const X = (i) => padL + (i * (W - padL - 20)) / Math.max(1, n1 - 1), Y = (v) => padT + ((hi - v) * H) / (hi - lo || 1);
      const inDq = new Set(f.dq);
      let s = `<line class="axis" x1="${padL - 6}" x2="${W - 8}" y1="${Y(0)}" y2="${Y(0)}"/><text class="bi" x="${padL - 10}" y="${Y(0) + 4}" text-anchor="end">0</text>`;
      s += `<polyline class="pline" points="${f.P.map((v, i) => `${X(i)},${Y(v)}`).join(" ")}"/>`;
      if (f.pair) {
        const [i, j] = f.pair;
        s += `<line class="need" x1="${X(i)}" x2="${X(j)}" y1="${Y(f.P[i])}" y2="${Y(f.P[i])}"/><line class="need" x1="${X(j)}" x2="${X(j)}" y1="${Y(f.P[i])}" y2="${Y(f.P[j])}"/>`;
        s += `<text class="ol cur" x="${(X(i) + X(j)) / 2}" y="${Math.max(Y(f.P[i]), Y(f.P[j])) + 18}" text-anchor="middle">len ${j - i}</text>`;
      }
      if (f.j !== undefined && f.dq.length) {
        const thr = f.P[f.j] - f.K;
        if (thr >= lo - 5) s += `<line class="thr" x1="${padL - 6}" x2="${W - 8}" y1="${Y(Math.max(lo, thr))}" y2="${Y(Math.max(lo, thr))}"/><text class="bi" x="${W - 8}" y="${Y(Math.max(lo, thr)) - 4}" text-anchor="end">P[j] − k = ${thr}</text>`;
      }
      f.P.forEach((v, i) => {
        const c = f.pair && (i === f.pair[0]) ? "done" : i === f.j ? "active" : i === f.droppedNow ? "bad" : inDq.has(i) ? "path" : f.j !== undefined && i > f.j ? "ghost" : "old";
        s += `<circle class="pt ${c}" cx="${X(i)}" cy="${Y(v)}" r="9"/><text class="pv" x="${X(i)}" y="${Y(v) + 4}" text-anchor="middle">${v}</text><text class="bi" x="${X(i)}" y="${padT + H + 22}" text-anchor="middle">${i}</text>`;
      });
      const svg = `<svg class="msq-svg" viewBox="0 0 ${W} ${padT + H + 30}" width="${W}" height="${padT + H + 30}" role="img" aria-label="prefix sums">${s}</svg>`;
      return wrap(
        Viz.array(f.arr, { label: "nums", window: f.pair ? [f.pair[0], f.pair[1] - 1] : [1, 0] }),
        Viz.labeled("prefix sums P[0..n] (dashed line: the threshold a start must be at or below)", svg),
        chips("deque of starts (front → back), P increasing", f.dq.map((i) => [`P${i}=${f.P[i]}`, i === f.droppedNow ? "bad" : "path"])),
        f.final ? panel(f.ok, f.ok ? `✓ ${f.best === Infinity ? "−1" : f.best}` : "✗ mismatch") : "",
      );
    },
  }));

  /* ─────────────────────────── 10. Constrained subsequence sum: deque-optimised DP ─────────────────────────── */
  Viz.register("monotonic-stack-queue-constrained", (el) => Viz.player(el, {
    title: "Constrained subsequence sum: DP whose transition is a sliding-window max",
    tag: "DEQUE-OPTIMISED DP",
    legend: [["window", "reachable predecessors i−k..i−1"], ["active", "dp[i] being computed"], ["done", "front = best predecessor"], ["bad", "popped"]],
    codeLang: "python",
    code: [
      "dp, dq = [0] * n, deque()  # dp[dq] decreasing",
      "for i, x in enumerate(nums):",
      "    if dq and dq[0] < i - k:",
      "        dq.popleft()            # too far back",
      "    dp[i] = x + max(0, dp[dq[0]] if dq else 0)",
      "    while dq and dp[dq[-1]] <= dp[i]:",
      "        dq.pop()                # dominated",
      "    dq.append(i)",
      "return max(dp)",
    ],
    inputs: [{ key: "a", label: "nums (1–12, −20..20)", value: "10,-2,-10,-5,20", width: 200 }, { key: "k", label: "k", value: "2", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 11), -9, 9).join(","), k: String(Viz.rand(1, 3)) }),
    build: ({ a, k }) => {
      const arr = ints(a, { min: 1, max: 12, lo: -20, hi: 20 }), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: n });
      const dp = Array(n).fill(null), dq = [], fr = [];
      const snap = (x) => ({ arr, K, dp: dp.slice(), dq: dq.slice(), ...x, vars: { ...(x.vars || {}), dq: `[${dq.join(", ")}]` } });
      fr.push(snap({ line: 0, note: `dp[i] = best sum of a valid subsequence that <b>ends</b> at i. Its previous element must be within k = ${K} steps, so dp[i] = nums[i] + max(0, max(dp[i−${K}..i−1])). The "max over the last k dp values" is exactly a sliding-window maximum, so a monotonic deque turns O(n·k) into O(n).` }));
      for (let i = 0; i < n; i++) {
        let expired;
        if (dq.length && dq[0] < i - K) expired = dq.shift();
        if (expired !== undefined) fr.push(snap({ i, popped: expired, line: [2, 3], vars: { i }, note: `Index ${expired} is more than ${K} steps behind i = ${i}: it can no longer be a predecessor. Pop it from the front.` }));
        const bestPrev = dq.length ? dp[dq[0]] : 0;
        dp[i] = arr[i] + Math.max(0, bestPrev);
        fr.push(snap({ i, front: dq.length ? dq[0] : undefined, line: 4, vars: { i, "nums[i]": arr[i], "best prev": dq.length ? bestPrev : "none", "dp[i]": dp[i] },
          note: dq.length ? `The front holds the best reachable dp: dp[${dq[0]}] = ${bestPrev}. ${bestPrev > 0 ? `Extending it helps: dp[${i}] = ${arr[i]} + ${bestPrev} = <b>${dp[i]}</b>.` : `It is not positive, so starting fresh at ${i} is better: dp[${i}] = <b>${arr[i]}</b>.`}` : `No predecessor: dp[${i}] = nums[${i}] = <b>${arr[i]}</b>.` }));
        while (dq.length && dp[dq[dq.length - 1]] <= dp[i]) {
          const j = dq.pop();
          fr.push(snap({ i, popped: j, line: [5, 6], vars: { i, "dp[i]": dp[i] }, note: `dp[${j}] = ${dp[j]} ≤ dp[${i}] = ${dp[i]}, and ${i} stays reachable longer. ${j} can never be the best predecessor again: pop it.` }));
        }
        dq.push(i);
        fr.push(snap({ i, line: 7, vars: { i }, note: `Push ${i}. Deque dp values: [${dq.map((j) => dp[j]).join(", ")}], decreasing.` }));
      }
      const ans = Math.max(...dp);
      const bdp = arr.map(() => 0);
      for (let i = 0; i < n; i++) { let m = 0; for (let j = Math.max(0, i - K); j < i; j++) m = Math.max(m, bdp[j]); bdp[i] = arr[i] + m; }
      const ok = Math.max(...bdp) === ans;
      fr.push(snap({ final: true, ok, line: 8, vars: { answer: ans }, note: `Answer: max(dp) = <b>${ans}</b>. ${ok ? "The plain O(n·k) DP agrees." : "Mismatch with the O(n·k) DP!"}` }));
      return fr;
    },
    render: (f) => {
      const lo = f.i !== undefined ? Math.max(0, f.i - f.K) : 1, hi = f.i !== undefined ? f.i - 1 : 0;
      return wrap(
        Viz.array(f.arr, { label: "nums", ptrs: f.i !== undefined && !f.final ? { i: f.i } : {}, cls: (i) => (i === f.i && !f.final ? "active" : "") }),
        Viz.array(f.dp, { label: "dp[i] = best sum ending at i", window: [lo, hi], cls: (i) => (i === f.popped ? "bad" : i === f.front ? "done" : i === f.i && !f.final ? "active" : f.final && f.dp[i] === Math.max(...f.dp) ? "done" : "") }),
        chips("deque (front → back), dp decreasing", f.dq.map((j) => [`dp${j}=${f.dp[j]}`, j === f.front ? "done" : "path"])),
        f.final ? panel(f.ok, f.ok ? `✓ ${f.vars.answer}` : "✗ mismatch") : "",
      );
    },
  }));
})();
