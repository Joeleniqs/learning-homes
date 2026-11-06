/* Visualizers for Math, Number Theory & Combinatorics. Every name is prefixed "math-number-theory-".
 * Frames come from running the real algorithm; each build() cross-checks its answer against a slower reference. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when a mode changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const pad = (code, n) => code.concat(Array(Math.max(0, n - code.length)).fill(""));
  const assert = (c, m) => { if (!c) throw new Error("Internal check failed: " + m); };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const int = (s, lo, hi, what) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const nums = (s, { min = 1, max = 10, lo = 0, hi = 255, what = "Values" } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what} must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const gcdN = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  const mulmod = (a, b, m) => Number((BigInt(a) * BigInt(b)) % BigInt(m));
  const powmod = (a, e, m) => { let r = 1n, x = BigInt(a) % BigInt(m), M = BigInt(m), k = BigInt(e); while (k > 0n) { if (k & 1n) r = (r * x) % M; x = (x * x) % M; k >>= 1n; } return Number(r % M); };
  /* Seeded PRNG (mulberry32): the same seed replays the same random choices. */
  const rng = (seed) => { let s = seed >>> 0; return () => { s = (s + 0x6d2b79f5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const randInt = (R, lo, hi) => lo + Math.floor(R() * (hi - lo + 1));

  const col = (...parts) => `<div class="mn-col">${parts.filter(Boolean).join("")}</div>`;
  const row = (...parts) => `<div class="mn-row">${parts.filter(Boolean).join("")}</div>`;
  const box = (cap, inner) => `<div class="mn-box"><span class="mn-cap">${esc(cap)}</span>${inner}</div>`;
  const chips = (items, cls = () => "") => `<div class="mn-chips">${items.map((t, i) => `<span class="mn-chip ${cls(i, t)}">${esc(t)}</span>`).join("")}</div>`;
  const eq = (html, cls = "") => `<div class="mn-eq ${cls}">${html}</div>`;
  const svg = (w, h, body, label) => `<svg class="dg mn-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const numGrid = (cells, cols, small) => `<div class="mn-grid ${small ? "small" : ""}" style="--cols:${cols}">${cells.map((c) => `<div class="mn-c ${c.cls || ""}">${c.html}</div>`).join("")}</div>`;
  const hist = (vals, labels, o = {}) => {
    const mx = Math.max(o.fair || 0, ...vals) * 1.12 || 1, H = 120;
    const bars = vals.map((v, i) => `<div class="bar ${o.cls ? o.cls(i, v) : ""}" style="height:${Math.max(2, (v / mx) * H).toFixed(1)}px"><span>${esc(o.fmt ? o.fmt(v) : v)}</span></div>`).join("");
    const fair = o.fair ? `<div class="fair" style="bottom:${((o.fair / mx) * H).toFixed(1)}px"></div>` : "";
    return `<div class="mn-box"><span class="mn-cap">${esc(o.label || "")}</span><div class="mn-hist">${fair}${bars}</div><div class="mn-hlbl">${labels.map((l) => `<span>${esc(l)}</span>`).join("")}</div></div>`;
  };

  /* ================= 1. Euclid's algorithm as rectangle tiling ================= */
  const GCD_CODE = [
    "def gcd(a, b):",
    "    while b:",
    "        a, b = b, a % b      # cut a // b squares of side b; keep the a % b strip",
    "    return a                 # the last square side tiles everything",
  ];
  Viz.register("math-number-theory-gcd", (el) => Viz.player(el, {
    title: "Euclid's algorithm: cut the biggest squares that fit, then recurse on the strip",
    tag: "GCD · O(log min(a, b))",
    legend: [["active", "squares cut this step"], ["done", "squares cut earlier"], ["path", "strip still to tile"], ["visit", "the gcd tile"]],
    codeLang: "python",
    code: GCD_CODE,
    speed: 1300,
    inputs: [
      { key: "a", label: "a (1 … 999)", value: "105", width: 90 },
      { key: "b", label: "b (1 … 999)", value: "40", width: 90 },
    ],
    random: () => { const g = Viz.rand(1, 12), x = Viz.rand(2, 40), y = Viz.rand(1, x); return Math.random() < 0.5 ? { a: String(g * x), b: String(g * y) } : { a: String(g * y), b: String(g * x) }; },
    build: ({ a: as, b: bs }) => {
      const a = int(as, 1, 999, "a"), b = int(bs, 1, 999, "b");
      if (Math.max(a, b) / Math.min(a, b) > 60) throw new Error("Keep max(a, b) / min(a, b) at most 60 so every square stays visible.");
      const W = a, H = b, sc = Math.min(600 / W, 280 / H);
      const tiles = [], fr = [], eqs = [];
      let A = a, B = b, horiz = true, rect = { x: 0, y: 0, w: W, h: H }, step = 0;
      const snap = (extra) => ({ W, H, sc, tiles: tiles.map((t) => ({ ...t })), rect: rect ? { ...rect } : null, eqs: eqs.slice(), ...extra });
      fr.push(snap({ line: 0, cur: -1, note: `Find gcd(${a}, ${b}). A number d divides both a and b exactly when d×d squares tile the ${a}×${b} rectangle with no gaps. Euclid finds the <b>largest</b> such square by repeatedly cutting off the biggest squares that fit.`, vars: { a, b } }));
      while (B) {
        const q = Math.floor(A / B), r = A % B;
        step++;
        if (q === 0) {
          eqs.push(`${A} = 0·${B} + ${A}`);
          fr.push(snap({ line: [1, 2], cur: step, note: `a = ${A} is smaller than b = ${B}, so no b×b square fits: q = 0 and the first round just swaps them (a, b = ${B}, ${A}). No extra work is needed for the "wrong" order.`, vars: { a: A, b: B, "a // b": 0, "a % b": A } }));
          [A, B] = [B, A]; horiz = !horiz;
          continue;
        }
        for (let i = 0; i < q; i++) tiles.push(horiz ? { x: rect.x + i * B, y: rect.y, s: B, step } : { x: rect.x, y: rect.y + i * B, s: B, step });
        rect = r === 0 ? null : horiz ? { x: rect.x + q * B, y: rect.y, w: r, h: B } : { x: rect.x, y: rect.y + q * B, w: B, h: r };
        eqs.push(`${A} = ${q}·${B} + ${r}`);
        const why = r === 0
          ? `The ${B}×${B} squares fit exactly: nothing is left over. b becomes 0 and the loop ends.`
          : `A ${horiz ? `${r}×${B}` : `${B}×${r}`} strip is left. Any square that tiles the whole rectangle also tiles the cut squares, so it must tile the strip too, and the converse holds: <b>gcd(${A}, ${B}) = gcd(${B}, ${r})</b>.`;
        fr.push(snap({ line: [1, 2], cur: step, note: `${A} = ${q} · ${B} + ${r}: cut ${q} square${q === 1 ? "" : "s"} of side ${B}. ${why}`, vars: { a: A, b: B, "a // b": q, "a % b": r } }));
        [A, B] = [B, r]; horiz = !horiz;
      }
      let ref = Math.min(a, b); while (a % ref || b % ref) ref--;
      assert(A === ref, "gcd matches the largest common divisor");
      const g = A, cells = (a / g) * (b / g);
      fr.push(snap({ line: 3, cur: -1, g, grid: cells <= 900, note: `gcd(${a}, ${b}) = <b>${g}</b>. ${cells <= 900 ? `The dashed ${g}×${g} grid tiles the whole rectangle: ${a / g} × ${b / g} tiles.` : ""} It took ${eqs.length} division${eqs.length === 1 ? "" : "s"}: the remainder at least halves every two steps, so Euclid needs O(log min(a, b)) of them (consecutive Fibonacci numbers are the worst case). lcm(${a}, ${b}) = ${a} / ${g} · ${b} = ${(a / g) * b}.`, vars: { gcd: g, lcm: (a / g) * b, divisions: eqs.length } }));
      return fr;
    },
    render: (f) => {
      const s = f.sc, ox = 10, oy = 10, w = f.W * s, h = f.H * s;
      let body = `<rect class="box" x="${ox}" y="${oy}" width="${w.toFixed(1)}" height="${h.toFixed(1)}"/>`;
      for (const t of f.tiles) {
        const cls = t.step === f.cur ? "box active" : "box done";
        body += `<rect class="${cls} mn-tile" x="${(ox + t.x * s).toFixed(1)}" y="${(oy + t.y * s).toFixed(1)}" width="${(t.s * s).toFixed(1)}" height="${(t.s * s).toFixed(1)}"/>`;
        if (t.s * s >= 26) body += `<text class="mono small mn-lbl" x="${(ox + (t.x + t.s / 2) * s).toFixed(1)}" y="${(oy + (t.y + t.s / 2) * s + 4).toFixed(1)}" text-anchor="middle">${t.s}</text>`;
      }
      if (f.rect) body += `<rect class="box path" x="${(ox + f.rect.x * s).toFixed(1)}" y="${(oy + f.rect.y * s).toFixed(1)}" width="${(f.rect.w * s).toFixed(1)}" height="${(f.rect.h * s).toFixed(1)}" stroke-dasharray="5 3"/>`;
      if (f.grid) {
        for (let x = f.g; x < f.W; x += f.g) body += `<line class="edge dash" x1="${(ox + x * s).toFixed(1)}" y1="${oy}" x2="${(ox + x * s).toFixed(1)}" y2="${(oy + h).toFixed(1)}" stroke-width="1"/>`;
        for (let y = f.g; y < f.H; y += f.g) body += `<line class="edge dash" x1="${ox}" y1="${(oy + y * s).toFixed(1)}" x2="${(ox + w).toFixed(1)}" y2="${(oy + y * s).toFixed(1)}" stroke-width="1"/>`;
        body += `<rect class="box visit" x="${ox}" y="${oy}" width="${(f.g * s).toFixed(1)}" height="${(f.g * s).toFixed(1)}"/>`;
      }
      body += `<text class="small muted" x="${ox + w / 2}" y="${oy + h + 18}" text-anchor="middle">${f.W}</text><text class="small muted" x="${ox + w + 8}" y="${oy + h / 2 + 4}">${f.H}</text>`;
      return col(svg(Math.ceil(w + 50), Math.ceil(h + 34), body, `${f.W} by ${f.H} rectangle tiled by squares`), f.eqs.length ? chips(f.eqs, (i) => (i === f.eqs.length - 1 && f.cur > 0 ? "active" : f.g && i === f.eqs.length - 1 ? "done" : "")) : "");
    },
  }));

  /* ================= 2. Extended Euclid: every row keeps r = a·s + b·t ================= */
  const EXT_CODE = [
    "def ext_gcd(a, b):",
    "    r0, r1, s0, s1, t0, t1 = a, b, 1, 0, 0, 1   # each row: r = a*s + b*t",
    "    while r1:",
    "        q = r0 // r1",
    "        r0, r1 = r1, r0 - q * r1               # new row = older row - q * newer row",
    "        s0, s1 = s1, s0 - q * s1",
    "        t0, t1 = t1, t0 - q * t1",
    "    return r0, s0, t0                          # g = a*x + b*y",
  ];
  const INV_CODE = EXT_CODE.slice(0, 7).concat(["    return s0 % b if r0 == 1 else None         # a*s0 ≡ 1 (mod b)"]);
  const EXT_MODES = ["Bézout: a·x + b·y = gcd", "inverse of a mod m (b = m)"];
  Viz.register("math-number-theory-extgcd", (el) => Viz.player(el, {
    title: "Extended Euclid: the same divisions, but each row also remembers how it was made",
    tag: "BÉZOUT · MODULAR INVERSE",
    legend: [["active", "row just computed"], ["dep", "the two rows it came from"], ["done", "the answer row"]],
    codeLang: "python",
    code: EXT_CODE,
    speed: 1300,
    inputs: [
      { key: "a", label: "a", value: "240", width: 90 },
      { key: "b", label: "b (or m)", value: "46", width: 90 },
      { key: "mode", label: "goal", type: "select", value: EXT_MODES[0], options: EXT_MODES },
    ],
    random: () => (Math.random() < 0.5 ? { a: String(Viz.rand(2, 500)), b: String(Viz.rand(2, 500)) } : { a: String(Viz.rand(2, 60)), b: String([7, 11, 13, 26, 97, 101][Viz.rand(0, 5)]), mode: EXT_MODES[1] }),
    build: ({ a: as, b: bs, mode }) => {
      const a = int(as, 1, 99999, "a"), b = int(bs, mode === EXT_MODES[1] ? 2 : 1, 99999, mode === EXT_MODES[1] ? "m" : "b");
      const inv = mode === EXT_MODES[1];
      setCode(el, inv ? INV_CODE : EXT_CODE);
      const rows = [[a, "", 1, 0], [b, "", 0, 1]], fr = [];
      const snap = (extra) => ({ rows: rows.map((r) => r.slice()), a, b, ...extra });
      fr.push(snap({ line: 1, act: [0, 1], note: `Start with two rows that are true for trivial reasons: ${a} = a·1 + b·0 and ${b} = a·0 + b·1. Every row will keep the form <b>r = a·s + b·t</b>.`, vars: { a, b } }));
      while (rows[rows.length - 1][0] !== 0) {
        const k = rows.length, [r0, , s0, t0] = rows[k - 2], [r1, , s1, t1] = rows[k - 1], q = Math.floor(r0 / r1);
        const nr = [r0 - q * r1, q, s0 - q * s1, t0 - q * t1];
        rows.push(nr);
        assert(a * nr[2] + b * nr[3] === nr[0], "row invariant");
        const pz = (v) => (v < 0 ? `(−${-v})` : String(v));
        fr.push(snap({ line: [3, 4, 5, 6], act: [k], dep: [k - 2, k - 1], note: `q = ${r0} // ${r1} = ${q}. New row = row ${k - 2} − ${q} × row ${k - 1}, column by column: r = ${r0} − ${q}·${r1} = ${nr[0]}, s = ${s0} − ${q}·${pz(s1)} = ${nr[2]}, t = ${t0} − ${q}·${pz(t1)} = ${nr[3]}. The r column is plain Euclid; subtracting rows keeps r = a·s + b·t true because the rule is linear. Check: ${a}·${pz(nr[2])} + ${b}·${pz(nr[3])} = ${nr[0]}.${nr[0] === 0 ? " r = 0: the row above holds the gcd." : ""}`, vars: { q, r: nr[0], s: nr[2], t: nr[3] } }));
      }
      const gi = rows.length - 2, [g, , x, y] = rows[gi];
      assert(g === gcdN(a, b), "gcd");
      if (!inv) {
        fr.push(snap({ line: 7, done: [gi], note: `g = gcd(${a}, ${b}) = <b>${g}</b>, and the same row says how to build it: <b>${a}·(${x}) + ${b}·(${y}) = ${g}</b>. Every other solution is x + k·${b / g}, y − k·${a / g}. So a·x + b·y = c is solvable in integers exactly when g divides c (scale this one by c / g).`, vars: { g, x, y } }));
      } else if (g === 1) {
        const xi = ((x % b) + b) % b;
        assert((a * xi) % b === 1, "inverse");
        fr.push(snap({ line: 7, done: [gi], note: `gcd = 1, so ${a}·(${x}) + ${b}·(${y}) = 1. Read it mod ${b}: the b·y term vanishes, leaving ${a}·(${x}) ≡ 1. The inverse is ${x} mod ${b} = <b>${xi}</b>. Check: ${a}·${xi} = ${a * xi} = ${Math.floor((a * xi) / b)}·${b} + 1. This works for <b>any</b> modulus, prime or not, as long as gcd(a, m) = 1.`, vars: { g, x, "inverse": xi } }));
      } else {
        fr.push(snap({ line: 7, done: [gi], note: `gcd(${a}, ${b}) = ${g} ≠ 1: <b>no inverse exists</b>. Every a·x + m·y is a multiple of ${g}, so it can never equal 1. (In mod ${b}, ${a} is a zero divisor: ${a}·${b / g} ≡ 0.)`, vars: { g, inverse: "none" } }));
      }
      return fr;
    },
    render: (f) => {
      const m = f.rows.map((r) => [r[0], r[1], r[2], r[3], `${f.a}·${r[2] < 0 ? `(${r[2]})` : r[2]} + ${f.b}·${r[3] < 0 ? `(${r[3]})` : r[3]}`]);
      return col(Viz.grid(m, {
        colLabels: ["r", "q", "s (x)", "t (y)", "a·s + b·t = r"], rowLabels: f.rows.map((_, i) => `row ${i}`), corner: "",
        cls: (r) => ((f.done || []).includes(r) ? "done" : (f.act || []).includes(r) ? "active" : (f.dep || []).includes(r) ? "dep" : ""),
      }));
    },
  }));

  /* ================= 3. Sieve of Eratosthenes ================= */
  const SIEVE_CODE = [
    "def sieve(n):",
    "    is_p = [True] * (n + 1); is_p[0] = is_p[1] = False",
    "    for p in range(2, isqrt(n) + 1):",
    "        if is_p[p]:                          # p survived: it is prime",
    "            for m in range(p * p, n + 1, p): # smaller multiples are already crossed",
    "                is_p[m] = False",
    "    return [i for i in range(n + 1) if is_p[i]]",
  ];
  Viz.register("math-number-theory-sieve", (el) => Viz.player(el, {
    title: "Sieve of Eratosthenes: every prime crosses out its multiples, starting at p²",
    tag: "O(n log log n)",
    legend: [["active", "current prime p"], ["visit", "p², where crossing starts"], ["bad", "crossed by p now"], ["path", "multiples a smaller prime already crossed"], ["done", "prime"]],
    codeLang: "python",
    code: SIEVE_CODE,
    speed: 1300,
    inputs: [
      { key: "n", label: "n (2 … 120)", value: "100", width: 90 },
      { key: "cols", label: "row width", type: "select", value: "10", options: ["10", "6"] },
    ],
    random: () => ({ n: String(Viz.rand(20, 120)), cols: Math.random() < 0.7 ? "10" : "6" }),
    build: ({ n: ns, cols }) => {
      const n = int(ns, 2, 120, "n"), C = Number(cols);
      if (C === 6 && n > 96) throw new Error("With row width 6, keep n at most 96 so the grid stays on screen.");
      const isP = Array(n + 1).fill(true); isP[0] = isP[1] = false;
      const by = Array(n + 1).fill(0), fr = [];
      let work = 0;
      const snap = (extra) => ({ n, C, isP: isP.slice(), by: by.slice(), ...extra });
      fr.push(snap({ line: 1, note: `Write down 2 … ${n}; assume every number is prime until proven otherwise. 1 is not prime (it would break unique factorisation).${C === 6 ? " Row width 6 makes a pattern visible: watch which columns survive." : ""}`, vars: { n } }));
      for (let p = 2; p * p <= n; p++) {
        if (!isP[p]) { fr.push(snap({ line: [2, 3], p, skip: true, note: `${p} is already crossed out (by ${by[p]}), so it is composite. Its multiples are multiples of ${by[p]} too and are already handled: skip it.`, vars: { p, "is_p[p]": "False" } })); continue; }
        const old = []; for (let m = 2 * p; m < p * p && m <= n; m += p) old.push(m);
        fr.push(snap({ line: [2, 3], p, old, note: `${p} survived every smaller prime, so it is <b>prime</b>. Its multiples ${old.length ? old.slice(0, 6).join(", ") + (old.length > 6 ? ", …" : "") + " (below " + p * p + ") have a smaller prime factor and are already crossed" : "start right at " + p * p}. So crossing starts at <b>p² = ${p * p}</b>. That is also why p only needs to go up to √${n} ≈ ${Math.sqrt(n).toFixed(2)}.`, vars: { p, "p * p": p * p } }));
        const now = [];
        for (let m = p * p; m <= n; m += p) { work++; if (isP[m]) { isP[m] = false; by[m] = p; now.push(m); } else now.push(m); }
        fr.push(snap({ line: [4, 5], p, now, note: `Cross out ${p * p}, ${p * p + p}, ${p * p + 2 * p}, … in steps of ${p}: ${now.length} crossing${now.length === 1 ? "" : "s"} (some numbers get crossed again by a later prime; that is the small waste the linear sieve removes).`, vars: { p, crossed: now.length, "total work": work } }));
      }
      const primes = range(n + 1).filter((i) => isP[i]);
      const ref = range(n + 1).filter((i) => i >= 2 && range(i).every((d) => d < 2 || i % d !== 0));
      assert(primes.join() === ref.join(), "sieve matches trial division");
      const six = C === 6 ? " Every prime above 3 sits in the 1 or 5 column: all primes > 3 are 6k ± 1 (the other columns are multiples of 2 or 3)." : "";
      fr.push(snap({ line: 6, fin: true, note: `Every survivor is prime: <b>π(${n}) = ${primes.length}</b>. Total crossings: ${work}, close to n · ln ln n. The loop stops at √n because a composite m ≤ n always has a prime factor ≤ √m.${six}`, vars: { primes: primes.length, work } }));
      return fr;
    },
    render: (f) => {
      const cells = [];
      for (let i = 1; i <= f.n; i++) {
        let cls = "";
        if (f.fin) cls = f.isP[i] ? "done" : "x";
        else if (i === f.p) cls = f.skip ? "x active" : "active";
        else if (f.now && f.now.includes(i)) cls = "bad x";
        else if (f.old && f.old.includes(i)) cls = "path x";
        else if (f.old && i === f.p * f.p) cls = "visit";
        else if (!f.isP[i]) cls = "x";
        else if (f.p && i < f.p) cls = "done";
        cells.push({ cls, html: `${i}` });
      }
      return col(numGrid(cells, f.C));
    },
  }));

  /* ================= 4. Linear sieve: smallest prime factor table + factorisation ================= */
  const SPF_CODE = [
    "def linear_sieve(n):",
    "    spf, primes = [0] * (n + 1), []",
    "    for i in range(2, n + 1):",
    "        if spf[i] == 0:",
    "            spf[i] = i; primes.append(i)       # nobody crossed i: prime",
    "        for p in primes:",
    "            if p > spf[i] or i * p > n: break",
    "            spf[i * p] = p                     # i*p is written once, by its smallest prime",
    "    return spf, primes",
    "",
    "def factorize(x, spf):                         # O(log x) divisions",
    "    while x > 1: yield spf[x]; x //= spf[x]",
  ];
  Viz.register("math-number-theory-spf", (el) => Viz.player(el, {
    title: "Linear sieve: each composite is written exactly once, by its smallest prime factor",
    tag: "O(n) · SPF TABLE",
    legend: [["active", "current i"], ["visit", "written now: spf[i·p] = p"], ["done", "prime"], ["path", "factorisation chain"]],
    codeLang: "python",
    code: SPF_CODE,
    speed: 700,
    inputs: [
      { key: "n", label: "n (2 … 80)", value: "60", width: 90 },
      { key: "x", label: "factorise x (2 … n)", value: "60", width: 90 },
    ],
    random: () => { const n = Viz.rand(20, 80); return { n: String(n), x: String(Viz.rand(2, n)) }; },
    build: ({ n: ns, x: xs }) => {
      const n = int(ns, 2, 80, "n"), x = int(xs, 2, n, "x");
      const spf = Array(n + 1).fill(0), primes = [], fr = [];
      let writes = 0;
      const snap = (extra) => ({ n, spf: spf.slice(), ...extra });
      fr.push(snap({ line: 1, note: `spf[m] will hold the <b>smallest prime factor</b> of m. 0 means "not written yet". Unlike Eratosthenes, every composite will be written exactly once.`, vars: { n } }));
      for (let i = 2; i <= n; i++) {
        let prime = false;
        if (spf[i] === 0) { spf[i] = i; primes.push(i); prime = true; }
        const wrote = []; let stop = "";
        for (const p of primes) {
          if (p > spf[i]) { stop = `stop at p = ${p} > spf[${i}] = ${spf[i]}: ${i}·${p} has the smaller factor ${spf[i]}, and it will be written later, from ${(i * p) / spf[i]}·${spf[i]}.`; break; }
          if (i * p > n) { stop = `stop: ${i}·${p} = ${i * p} > n.`; break; }
          spf[i * p] = p; wrote.push(i * p); writes++;
        }
        const head = prime ? `spf[${i}] was 0, so no smaller prime divides ${i}: it is <b>prime</b>.` : `spf[${i}] = ${spf[i]}, so ${i} is composite.`;
        const w = wrote.length ? ` Multiply by primes up to spf[${i}]: write ${wrote.map((m) => `spf[${m}] = ${m / i}`).join(", ")}.` : "";
        fr.push(snap({ line: prime ? [3, 4, 5, 6, 7] : [3, 5, 6, 7], i, wrote, primes: primes.slice(), note: `i = ${i}. ${head}${w} Then ${stop || "no prime is small enough."}`, vars: { i, "spf[i]": spf[i], written: wrote.length, "total writes": writes } }));
      }
      const np = primes.length;
      assert(writes === n - 1 - np, "each composite written once");
      for (let m = 2; m <= n; m++) { let d = 2; while (m % d) d++; assert(spf[m] === d, "spf correct"); }
      fr.push(snap({ line: 8, primes: primes.slice(), note: `Done: ${n - 1 - np} composites, ${writes} writes: exactly one each, so the sieve is O(n). The rule "stop once p > spf[i]" is what guarantees that m is only written from i = m / spf[m].`, vars: { primes: np, writes } }));
      let v = x; const chain = [x], fac = [];
      while (v > 1) {
        const p = spf[v];
        fac.push(p); v /= p; chain.push(v);
        fr.push(snap({ line: [10, 11], chain: chain.slice(), fac: fac.slice(), note: `spf[${chain[chain.length - 2]}] = ${p}: divide it out. ${v === 1 ? "Reached 1." : `${v} is left; look up spf[${v}] next.`} Each step at least halves x, so factorising is O(log x) lookups.`, vars: { x: chain[chain.length - 2], "spf[x]": p, factors: fac.join(" · ") } }));
      }
      assert(fac.reduce((p, q) => p * q, 1) === x, "factorisation");
      const grp = {}; fac.forEach((p) => (grp[p] = (grp[p] || 0) + 1));
      const form = Object.entries(grp).map(([p, e]) => (e > 1 ? `${p}^${e}` : p)).join(" · ");
      const ndiv = Object.values(grp).reduce((s, e) => s * (e + 1), 1);
      fr.push(snap({ line: 11, chain, fac, fin: true, note: `${x} = <b>${form}</b>. From the exponents: number of divisors = ${Object.values(grp).map((e) => `(${e}+1)`).join("·")} = ${ndiv}. (Each divisor picks an exponent 0 … e for every prime.)`, vars: { x, factors: form, divisors: ndiv } }));
      return fr;
    },
    render: (f) => {
      const cells = [];
      for (let m = 2; m <= f.n; m++) {
        let cls = "";
        if (f.chain) cls = f.chain.includes(m) ? "path" : f.spf[m] === m ? "done" : "";
        else if (m === f.i) cls = "active";
        else if (f.wrote && f.wrote.includes(m)) cls = "visit";
        else if (f.spf[m] === m) cls = "done";
        else if (!f.spf[m]) cls = "ghost";
        cells.push({ cls, html: `${m}<small>${f.spf[m] ? (f.spf[m] === m ? "prime" : "spf " + f.spf[m]) : "·"}</small>` });
      }
      const parts = [numGrid(cells, 10)];
      if (f.chain) parts.push(chips(f.chain.map((c, k) => (k < f.fac.length ? `${c} ÷ ${f.fac[k]}` : `${c}`)), (k) => (k === f.chain.length - 1 && !f.fin ? "active" : "path")));
      else if (f.primes) parts.push(box("primes so far", chips(f.primes.map(String), () => "done")));
      return col(...parts);
    },
  }));

  /* ================= 5. Fast power: one square per bit, one multiply per 1-bit ================= */
  const POW_CODE = [
    "def power(a, e, m):",
    "    result, base = 1, a % m",
    "    while e:",
    "        if e & 1:                      # this bit is 1: a^(2^k) is part of a^e",
    "            result = result * base % m",
    "        base = base * base % m         # a^(2^k) -> a^(2^(k+1))",
    "        e >>= 1",
    "    return result                      # Python: pow(a, e, m)",
  ];
  Viz.register("math-number-theory-fastpow", (el) => Viz.player(el, {
    title: "Binary exponentiation: write e in binary, multiply in the squares that sit under 1-bits",
    tag: "O(log e) MULTIPLIES",
    legend: [["active", "current bit k"], ["done", "multiplied into result"], ["dim", "0-bit: skipped"]],
    codeLang: "python",
    code: POW_CODE,
    speed: 1300,
    inputs: [
      { key: "a", label: "a", value: "3", width: 80 },
      { key: "e", label: "e (0 … 2^40)", value: "13", width: 120 },
      { key: "m", label: "m (2 … 2·10⁹)", value: "1000000007", width: 120 },
    ],
    random: () => ({ a: String(Viz.rand(2, 99)), e: String(Viz.rand(1, 3000)), m: String([1000000007, 998244353, 97, 1000][Viz.rand(0, 3)]) }),
    build: ({ a: as, e: es, m: ms }) => {
      const a = int(as, 0, 2e9, "a"), e = int(es, 0, 2 ** 40, "e"), m = int(ms, 2, 2e9, "m");
      const bits = e.toString(2).split("").reverse().map(Number), K = e === 0 ? 0 : bits.length;
      const rows = [], fr = [];
      let res = 1n, base = BigInt(a) % BigInt(m), E = e, k = 0, mults = 0;
      const M = BigInt(m);
      const snap = (extra) => ({ bits, rows: rows.map((r) => r.slice()), e, ...extra });
      fr.push(snap({ line: 1, note: `${e} in binary is <b>${e.toString(2)}</b> (${K} bit${K === 1 ? "" : "s"}). So a^${e} = ${e === 0 ? "a^0 = 1" : bits.map((b, i) => (b ? `a^${2 ** i}` : null)).filter(Boolean).reverse().join(" · ")}: a product of the squares a^1, a^2, a^4, a^8, … that sit under the 1-bits. Naive multiplying would take ${e} steps; this takes about ${2 * K}.`, vars: { a, e, m, result: 1 } }));
      while (E) {
        const bit = E & 1, b0 = base;
        if (bit) { res = (res * base) % M; mults++; }
        rows.push([k, bit, `a^${2 ** k}`, Number(b0), bit ? Number(res) : "·"]);
        fr.push(snap({ line: bit ? [3, 4] : [3], k, note: bit ? `Bit ${k} is 1: multiply result by base = a^${2 ** k} mod m = ${b0}. result = ${Number(res)}.` : `Bit ${k} is 0: a^${2 ** k} is not part of a^${e}; leave result alone.`, vars: { k, "e & 1": bit, base: Number(b0), result: Number(res) } }));
        base = (base * base) % M; mults++; E = Math.floor(E / 2); k++;
        if (E) fr.push(snap({ line: [5, 6], k: k - 1, sq: true, note: `Square the base: (a^${2 ** (k - 1)})² = a^${2 ** k} ≡ ${Number(base)} (mod ${m}). Shift e right: ${E.toString(2)} remains.`, vars: { k, base: Number(base), "e left": E.toString(2) } }));
      }
      /* independent check: left-to-right exponentiation on BigInt */
      let chk = 1n; for (const b of e.toString(2)) { chk = (chk * chk) % M; if (b === "1") chk = (chk * (BigInt(a) % M)) % M; }
      if (e === 0) chk = 1n % M;
      assert(Number(res % M) === Number(chk) && powmod(a, e, m) === Number(chk), "fast power");
      if (e <= 3000) { let n = 1n % M; for (let i = 0; i < e; i++) n = (n * BigInt(a)) % M; assert(n === res % M, "naive power"); }
      fr.push(snap({ line: 7, fin: true, note: `a^${e} mod ${m} = <b>${Number(res % M)}</b> after ${mults} modular multiplications (≈ 2·log₂ e) instead of ${e}. Every intermediate stays below m² ${m > 3037000499 ? "(over 2⁶³ here: C# needs UInt128 or BigInteger)" : "< 2⁶³, so C# long is safe"}.`, vars: { result: Number(res % M), multiplications: mults } }));
      return fr;
    },
    render: (f) => {
      const bitChips = f.bits.length && f.e ? chips(f.bits.map((b, i) => `2^${i}: ${b}`).reverse(), (i) => { const k = f.bits.length - 1 - i; return k === f.k && !f.fin ? "active" : f.bits[k] ? (f.k !== undefined && k <= f.k) || f.fin ? "done" : "" : "dim"; }) : "";
      const grid = f.rows.length ? Viz.grid(f.rows, { colLabels: ["k", "bit", "square", "a^(2^k) mod m", "result"], cls: (r, c) => (r === f.rows.length - 1 && !f.fin && !f.sq ? "active" : f.rows[r][1] ? (c === 4 || c === 3 ? "done" : "") : "dim") }) : "";
      return col(box(`e = ${f.e} = ${f.e.toString(2)}₂ (bits, high to low)`, bitChips || eq("e = 0: the answer is 1")), grid);
    },
  }));

  /* ================= 6. Pascal's triangle: C(n, k) = C(n-1, k-1) + C(n-1, k) ================= */
  const PASCAL_CODE = [
    "def pascal(n, p=None):",
    "    C = [[1] * (r + 1) for r in range(n + 1)]     # edges are 1",
    "    for r in range(2, n + 1):",
    "        for k in range(1, r):",
    "            C[r][k] = C[r-1][k-1] + C[r-1][k]     # left parent + right parent",
    "            if p: C[r][k] %= p                     # only + needed: works for ANY modulus",
    "    return C",
  ];
  const PMODES = ["exact", "mod 2", "mod 3", "mod 5"];
  Viz.register("math-number-theory-pascal", (el) => Viz.player(el, {
    title: "Pascal's triangle: every entry is the sum of the two above it",
    tag: "O(n²) TABLE · ANY MODULUS",
    legend: [["active", "C(r, k) being filled"], ["visit", "its two parents"], ["done", "filled"], ["dim", "≡ 0 (mod p)"]],
    codeLang: "python",
    code: PASCAL_CODE,
    speed: 500,
    inputs: [
      { key: "n", label: "rows n (1 … 15)", value: "8", width: 90 },
      { key: "mode", label: "values", type: "select", value: "exact", options: PMODES },
    ],
    random: () => ({ n: String(Viz.rand(4, 12)), mode: PMODES[Viz.rand(0, 3)] }),
    build: ({ n: ns, mode }) => {
      const n = int(ns, 1, 15, "n"), p = mode === "exact" ? 0 : Number(mode.split(" ")[1]);
      const C = range(n + 1).map((r) => Array(r + 1).fill(null)), fr = [];
      const snap = (extra) => ({ n, p, C: C.map((r) => r.slice()), ...extra });
      for (let r = 0; r <= n; r++) { C[r][0] = 1; C[r][r] = 1; }
      fr.push(snap({ line: 1, note: `C(r, k) = number of ways to choose k items from r. Choosing 0 or all r items can be done one way, so both edges are 1.${p ? ` Values are kept mod ${p}; cells that are 0 mod ${p} fade out.` : ""}`, vars: { n } }));
      const fact = [1n]; for (let i = 1; i <= n; i++) fact.push(fact[i - 1] * BigInt(i));
      for (let r = 2; r <= n; r++) for (let k = 1; k < r; k++) {
        const L = C[r - 1][k - 1], R = C[r - 1][k];
        C[r][k] = p ? (L + R) % p : L + R;
        const exact = fact[r] / (fact[k] * fact[r - k]);
        assert(BigInt(C[r][k]) === (p ? exact % BigInt(p) : exact), "pascal entry");
        if (r <= 6 || k === 1 || n <= 9) fr.push(snap({ line: p ? [4, 5] : [4], at: [r, k], note: `C(${r}, ${k}) = C(${r - 1}, ${k - 1}) + C(${r - 1}, ${k}) = ${L} + ${R}${p ? ` ≡ ${C[r][k]} (mod ${p})` : ` = ${C[r][k]}`}. Why: item #${r} is either chosen (choose ${k - 1} more from the other ${r - 1}) or not (choose all ${k} from them).`, vars: { r, k, value: C[r][k] } }));
        else if (k === r - 1) fr.push(snap({ line: [3, 4], row: r, note: `Row ${r} filled the same way, two parents per entry.`, vars: { r } }));
      }
      const tail = p === 2 ? " Mod 2 the odd entries draw Sierpinski's triangle. Lucas's theorem explains it: C(n, k) is odd exactly when every bit of k is also set in n (k & n == k)." : p ? ` Lucas's theorem: C(n, k) mod ${p} is the product of C(nᵢ, kᵢ) over the base-${p} digits.` : ` Row sums are 2^r (each item in or out), and the entries grow like 2^r / √r, so for big r you must work mod p.`;
      fr.push(snap({ line: 6, fin: true, note: `Done: ${((n + 1) * (n + 2)) / 2} entries with only additions. Because no division is needed, this table works <b>mod any number</b>, even a non-prime one.${tail}`, vars: { rows: n + 1, "row n sum": p ? "-" : 2 ** n } }));
      return fr;
    },
    render: (f) => {
      const par = f.at ? [[f.at[0] - 1, f.at[1] - 1], [f.at[0] - 1, f.at[1]]] : [];
      const rows = f.C.map((rowv, r) => `<div class="r">${rowv.map((v, k) => {
        let cls = v === null ? "ghost" : "done";
        if (f.at && f.at[0] === r && f.at[1] === k) cls = "active";
        else if (par.some(([a, b]) => a === r && b === k)) cls = "visit";
        else if (f.row === r) cls = "active";
        if (f.p && v === 0 && !cls.includes("active") && cls !== "visit") cls = "zero";
        return `<div class="mn-c ${cls}">${v === null ? "?" : v}</div>`;
      }).join("")}</div>`).join("");
      return col(`<div class="mn-tri">${rows}</div>`);
    },
  }));

  /* ================= 7. Factorial + inverse factorial tables mod a prime ================= */
  const FI_CODE = [
    "def build(n, p):                         # p prime, n < p",
    "    fact = [1] * (n + 1)",
    "    for i in range(1, n + 1): fact[i] = fact[i-1] * i % p",
    "    inv = [1] * (n + 1)",
    "    inv[n] = pow(fact[n], p - 2, p)        # Fermat: x^(p-2) = x^-1 (mod p)",
    "    for i in range(n, 0, -1): inv[i-1] = inv[i] * i % p   # 1/(i-1)! = i/i!",
    "    return fact, inv",
    "",
    "def nCr(n, r): return fact[n] * inv[r] % p * inv[n-r] % p if 0 <= r <= n else 0",
  ];
  Viz.register("math-number-theory-factinv", (el) => Viz.player(el, {
    title: "nCr mod p in O(1): factorials forward, one Fermat inverse, inverse factorials backward",
    tag: "O(n) PRECOMPUTE · O(1) QUERY",
    legend: [["active", "entry being computed"], ["visit", "entry it reads"], ["done", "filled"]],
    codeLang: "python",
    code: FI_CODE,
    speed: 1000,
    inputs: [
      { key: "n", label: "n (1 … 12)", value: "8", width: 80 },
      { key: "p", label: "prime p (> n)", value: "13", width: 120 },
      { key: "r", label: "query r", value: "3", width: 70 },
    ],
    random: () => { const n = Viz.rand(4, 12), ps = [13, 17, 19, 23, 101, 1000000007]; return { n: String(n), p: String(ps[Viz.rand(0, ps.length - 1)]), r: String(Viz.rand(0, n)) }; },
    build: ({ n: ns, p: ps, r: rs }) => {
      const n = int(ns, 1, 12, "n"), p = int(ps, 2, 2e9, "p"), r = int(rs, 0, n, "r");
      for (let d = 2; d * d <= p; d++) if (p % d === 0) throw new Error(`p = ${p} is not prime (${d} divides it): Fermat's little theorem needs a prime modulus.`);
      if (p <= n) throw new Error(`p must be greater than n: otherwise n! contains the factor p and is 0 mod p, so it has no inverse.`);
      const fact = Array(n + 1).fill(null), inv = Array(n + 1).fill(null), fr = [];
      const snap = (extra) => ({ n, p, fact: fact.slice(), inv: inv.slice(), ...extra });
      fact[0] = 1;
      fr.push(snap({ line: 1, at: ["f", 0], note: `Goal: C(n, r) = n! / (r! (n−r)!) mod ${p}. Division is not allowed mod p, but multiplying by an <b>inverse</b> is. Build every k! and every 1/k! once; then each query is three multiplications.`, vars: { n, p } }));
      for (let i = 1; i <= n; i++) {
        fact[i] = mulmod(fact[i - 1], i, p);
        fr.push(snap({ line: 2, at: ["f", i], rd: [["f", i - 1]], note: `fact[${i}] = fact[${i - 1}] · ${i} mod ${p} = ${fact[i - 1]} · ${i} mod ${p} = ${fact[i]}.`, vars: { i, "fact[i]": fact[i] } }));
      }
      inv[n] = powmod(fact[n], p - 2, p);
      assert(mulmod(inv[n], fact[n], p) === 1, "fermat inverse");
      fr.push(snap({ line: 4, at: ["i", n], rd: [["f", n]], note: `One expensive step: inv[${n}] = fact[${n}]^(p−2) mod p = ${fact[n]}^${p - 2} mod ${p} = ${inv[n]} (fast power, O(log p)). Fermat: x^(p−1) ≡ 1 for prime p and x ≢ 0, so x · x^(p−2) ≡ 1. Check: ${fact[n]} · ${inv[n]} mod ${p} = 1.`, vars: { "fact[n]": fact[n], "inv[n]": inv[n] } }));
      for (let i = n; i >= 1; i--) {
        inv[i - 1] = mulmod(inv[i], i, p);
        assert(mulmod(inv[i - 1], fact[i - 1], p) === 1, "inverse factorial");
        fr.push(snap({ line: 5, at: ["i", i - 1], rd: [["i", i]], note: `inv[${i - 1}] = inv[${i}] · ${i} mod ${p} = ${inv[i]} · ${i} mod ${p} = ${inv[i - 1]}. Why: 1/(${i - 1})! = ${i} / ${i}!. Check: fact[${i - 1}] · inv[${i - 1}] mod ${p} = 1.`, vars: { i: i - 1, "inv[i]": inv[i - 1] } }));
      }
      const ans = mulmod(mulmod(fact[n], inv[r], p), inv[n - r], p);
      let ex = 1n; for (let i = 0; i < r; i++) ex = (ex * BigInt(n - i)) / BigInt(i + 1);
      assert(BigInt(ans) === ex % BigInt(p), "nCr");
      fr.push(snap({ line: 8, at: ["f", n], rd: [["i", r], ["i", n - r]], fin: true, note: `Query C(${n}, ${r}) = fact[${n}] · inv[${r}] · inv[${n - r}] mod ${p} = ${fact[n]} · ${inv[r]} · ${inv[n - r]} mod ${p} = <b>${ans}</b> (exact value ${ex}${ex >= BigInt(p) ? `, and ${ex} mod ${p} = ${ex % BigInt(p)}` : ""}). Precompute is O(n + log p); every query after that is O(1).`, vars: { "C(n, r)": ans } }));
      return fr;
    },
    render: (f) => {
      const m = [range(f.n + 1).map((i) => f.fact[i] ?? ""), range(f.n + 1).map((i) => f.inv[i] ?? ""), range(f.n + 1).map((i) => (f.fact[i] !== null && f.inv[i] !== null ? mulmod(f.fact[i], f.inv[i], f.p) : ""))];
      const key = (r) => (r === 0 ? "f" : r === 1 ? "i" : "c");
      const g = Viz.grid(m, {
        colLabels: range(f.n + 1).map(String), rowLabels: ["fact[k] = k!", "inv[k] = 1/k!", "product mod p"], corner: "k",
        cls: (r, c, v) => { const k = key(r); if (f.at && f.at[0] === k && f.at[1] === c) return "active"; if ((f.rd || []).some(([a, b]) => a === k && b === c)) return "visit"; return v === "" ? "" : r === 2 ? "done" : "done"; },
      });
      return col(g, f.fin ? eq(`C(${f.n}, r) for every r: ${range(f.n + 1).map((r) => mulmod(mulmod(f.fact[f.n], f.inv[r], f.p), f.inv[f.n - r], f.p)).join(", ")}`, "done") : "");
    },
  }));

  /* ================= 8. Catalan numbers: split every Dyck path at its first return ================= */
  const CAT_CODE = [
    "def catalan(n):",
    "    C = [1] + [0] * n",
    "    for m in range(1, n + 1):",
    "        for i in range(m):                 # first ( matches the ) at position 2i+1",
    "            C[m] += C[i] * C[m - 1 - i]    # inside: i pairs, after: m-1-i pairs",
    "    return C[n]                            # = comb(2n, n) // (n + 1)",
  ];
  const dyck = (n) => { const out = []; const go = (s, o, c) => { if (s.length === 2 * n) { out.push(s); return; } if (o < n) go(s + "(", o + 1, c); if (c < o) go(s + ")", o, c + 1); }; go("", 0, 0); return out; };
  const firstReturn = (s) => { let h = 0; for (let i = 0; i < s.length; i++) { h += s[i] === "(" ? 1 : -1; if (h === 0) return i; } return -1; };
  Viz.register("math-number-theory-catalan", (el) => Viz.player(el, {
    title: "Catalan numbers: group balanced strings by where the first '(' closes",
    tag: "C(n) = Σ C(i)·C(n−1−i)",
    legend: [["active", "group with first return at 2i+2"], ["visit", "inside part: i pairs"], ["path", "after part: n−1−i pairs"]],
    codeLang: "python",
    code: CAT_CODE,
    speed: 1700,
    inputs: [{ key: "n", label: "pairs n (1 … 4)", value: "4", width: 90 }],
    random: () => ({ n: String(Viz.rand(2, 4)) }),
    build: ({ n: ns }) => {
      const n = int(ns, 1, 4, "n"), all = dyck(n), Cn = [1, 1, 2, 5, 14, 42], fr = [];
      assert(all.length === Cn[n], "count of Dyck strings");
      let ex = 1; for (let i = 0; i < n; i++) ex = (ex * (2 * n - i)) / (i + 1);
      assert(ex / (n + 1) === Cn[n], "closed form");
      const snap = (extra) => ({ n, all, ...extra });
      fr.push(snap({ line: 0, note: `There are ${all.length} balanced strings with ${n} pairs, drawn as mountains: "(" steps up, ")" steps down, and the path never dips below the ground. The same count C(${n}) = ${Cn[n]} shows up for BST shapes with ${n} nodes, triangulations of a ${n + 2}-gon, full binary trees with ${n + 1} leaves, … because they all split the same way.`, vars: { n, "C(n)": Cn[n] } }));
      let sum = 0;
      for (let i = 0; i < n; i++) {
        const grp = all.filter((s) => firstReturn(s) === 2 * i + 1);
        assert(grp.length === Cn[i] * Cn[n - 1 - i], "split count");
        sum += grp.length;
        fr.push(snap({ line: [3, 4], i, note: `First "(" closes at position ${2 * i + 1}: the string is <b>( A ) B</b> with A balanced on ${i} pair${i === 1 ? "" : "s"} and B balanced on ${n - 1 - i}. A and B are chosen independently: C(${i}) · C(${n - 1 - i}) = ${Cn[i]} · ${Cn[n - 1 - i]} = ${grp.length} strings. Running total ${sum}.`, vars: { i, "C(i)": Cn[i], "C(n-1-i)": Cn[n - 1 - i], total: sum } }));
      }
      fr.push(snap({ line: 5, fin: true, note: `Every string has exactly one first return, so the groups cover everything once: C(${n}) = ${range(n).map((i) => `C${i}·C${n - 1 - i}`).join(" + ")} = <b>${Cn[n]}</b>. Closed form: C(2n, n) / (n + 1) = ${ex} / ${n + 1} = ${Cn[n]}. Sequence: 1, 1, 2, 5, 14, 42, 132, 429, …`, vars: { "C(n)": Cn[n] } }));
      return fr;
    },
    render: (f) => {
      const n = f.n, st = n <= 3 ? 20 : 14, W = 2 * n * st + 16, H = n * st + 30;
      const card = (s) => {
        const fr0 = firstReturn(s), inG = f.i !== undefined && fr0 === 2 * f.i + 1;
        let x = 8, y = H - 22, pts = [[x, y]];
        for (const ch of s) { x += st; y += ch === "(" ? -st : st; pts.push([x, y]); }
        const seg = (a, b, cls) => `<polyline class="edge ${cls}" fill="none" points="${pts.slice(a, b + 1).map((p) => p.join(",")).join(" ")}"/>`;
        let body = `<line class="mn-grid-line" x1="4" y1="${H - 22}" x2="${W - 4}" y2="${H - 22}"/>`;
        if (inG) body += seg(0, 1, "active") + seg(1, fr0, "visit") + seg(fr0, fr0 + 1, "active") + seg(fr0 + 1, 2 * n, "path");
        else body += seg(0, 2 * n, f.fin ? "done" : "faint");
        if (inG || f.fin) body += `<circle class="mn-pt ${inG ? "active" : "done"}" cx="${pts[fr0 + 1][0]}" cy="${pts[fr0 + 1][1]}" r="3.5"/>`;
        body += `<text class="mono small" x="${W / 2}" y="${H - 6}" text-anchor="middle">${s}</text>`;
        return `<div class="mn-box ${inG || f.fin ? "" : "mn-faded"}">${svg(W, H, body, `Dyck path ${s}`)}</div>`;
      };
      return col(`<div class="mn-row">${f.all.map(card).join("")}</div>`);
    },
  }));

  /* ================= 9. Inclusion–exclusion: watch every number's net count become 1 ================= */
  const IE_CODE = [
    "def count_divisible(N, ds):              # how many of 1..N are divisible by some d in ds?",
    "    total = 0",
    "    for size in range(1, len(ds) + 1):",
    "        for S in combinations(ds, size):",
    "            L = lcm(*S)                       # divisible by all of S <=> divisible by lcm",
    "            total += (-1) ** (size + 1) * (N // L)   # + odd sizes, - even sizes",
    "    return total",
  ];
  Viz.register("math-number-theory-inclexcl", (el) => Viz.player(el, {
    title: "Inclusion–exclusion: add singles, subtract pairs, add triples … until every covered number counts once",
    tag: "|A ∪ B ∪ C| = Σ|A| − Σ|A∩B| + |A∩B∩C|",
    legend: [["visit", "+ term: multiples of L"], ["bad", "− term: multiples of L"], ["done", "net count 1 (correct)"], ["path", "counted too often"]],
    codeLang: "python",
    code: IE_CODE,
    speed: 1700,
    inputs: [
      { key: "N", label: "N (10 … 90)", value: "60", width: 80 },
      { key: "ds", label: "divisors (2–4 values)", value: "2 3 5", width: 140 },
    ],
    random: () => { const pool = [2, 3, 4, 5, 6, 7], k = Viz.rand(2, 3), s = new Set(); while (s.size < k) s.add(pool[Viz.rand(0, 5)]); return { N: String(Viz.rand(30, 90)), ds: [...s].sort((a, b) => a - b).join(" ") }; },
    build: ({ N: Ns, ds: dss }) => {
      const N = int(Ns, 10, 90, "N"), ds = nums(dss, { min: 2, max: 4, lo: 2, hi: 30, what: "Divisors" });
      if (new Set(ds).size !== ds.length) throw new Error("Use distinct divisors.");
      const cnt = Array(N + 1).fill(0), fr = [];
      const covered = range(N + 1).map((x) => x >= 1 && ds.some((d) => x % d === 0));
      const terms = [];
      let total = 0;
      const snap = (extra) => ({ N, cnt: cnt.slice(), covered, terms: terms.slice(), total, ...extra });
      fr.push(snap({ line: 1, note: `Count the numbers in 1 … ${N} divisible by at least one of ${ds.join(", ")}. Each cell shows how many times the formula has counted it so far. Goal: every covered cell ends at exactly 1, every other cell at 0.`, vars: { N, sets: ds.length } }));
      const lcm = (a, b) => (a / gcdN(a, b)) * b;
      for (let size = 1; size <= ds.length; size++) {
        const subs = [];
        const go = (start, cur) => { if (cur.length === size) { subs.push(cur.slice()); return; } for (let i = start; i < ds.length; i++) { cur.push(ds[i]); go(i + 1, cur); cur.pop(); } };
        go(0, []);
        for (const S of subs) {
          const L = S.reduce(lcm, 1), sign = size % 2 ? 1 : -1, c = Math.floor(N / L);
          for (let x = L; x <= N; x += L) cnt[x] += sign;
          total += sign * c;
          terms.push(`${sign > 0 ? "+" : "−"} ⌊${N}/${L}⌋`);
          const over = range(N + 1).filter((x) => covered[x] && cnt[x] > 1).length, under = range(N + 1).filter((x) => covered[x] && cnt[x] < 1).length;
          fr.push(snap({ line: [4, 5], L, sign, note: `${sign > 0 ? "Add" : "Subtract"} the multiples of ${S.length > 1 ? `lcm(${S.join(", ")}) = ` : ""}${L}: ${sign > 0 ? "+" : "−"}${c}. Running total ${total}. ${over ? `${over} cell${over === 1 ? " is" : "s are"} still over-counted` : ""}${over && under ? "; " : ""}${under ? `${under} under-counted` : ""}${over || under ? " (the next layer fixes them)." : "Every covered cell is now exactly 1."}`, vars: { S: S.join("·"), lcm: L, term: sign * c, total } }));
        }
      }
      const brute = covered.filter(Boolean).length;
      assert(total === brute, "inclusion-exclusion total");
      for (let x = 1; x <= N; x++) assert(cnt[x] === (covered[x] ? 1 : 0), "net count");
      fr.push(snap({ line: 6, fin: true, note: `<b>${total}</b> numbers, and the brute-force count agrees. A number divisible by exactly j of the divisors was counted C(j,1) − C(j,2) + C(j,3) − … = 1 time, which is the binomial identity behind the method. ${ds.length} sets need 2^${ds.length} − 1 = ${2 ** ds.length - 1} terms.`, vars: { answer: total, terms: 2 ** ds.length - 1 } }));
      return fr;
    },
    render: (f) => {
      const cells = [];
      for (let x = 1; x <= f.N; x++) {
        let cls = "";
        if (f.L && x % f.L === 0) cls = f.sign > 0 ? "visit" : "bad";
        else if (f.covered[x]) cls = f.cnt[x] === 1 ? "done" : f.cnt[x] > 1 ? "path" : f.cnt[x] < 0 || f.terms.length ? "ghost" : "";
        cells.push({ cls, html: `${x}<small>${f.covered[x] || f.cnt[x] ? (f.cnt[x] > 0 ? "×" + f.cnt[x] : f.cnt[x] < 0 ? "−" + -f.cnt[x] : "×0") : ""}</small>` });
      }
      return col(numGrid(cells, 10, true), f.terms.length ? eq(`${f.terms.join(" ")} = ${f.total}`, f.fin ? "done" : "") : "");
    },
  }));

  /* ================= 10. Convex hull: Andrew's monotone chain ================= */
  const HULL_CODE = [
    "def cross(o, a, b):                    # > 0: o->a->b turns left (counter-clockwise)",
    "    return (a[0]-o[0])*(b[1]-o[1]) - (a[1]-o[1])*(b[0]-o[0])",
    "def hull(pts):",
    "    pts = sorted(set(pts))",
    "    def chain(seq):",
    "        h = []",
    "        for p in seq:",
    "            while len(h) >= 2 and cross(h[-2], h[-1], p) <= 0:   # not a left turn",
    "                h.pop()",
    "            h.append(p)",
    "        return h",
    "    lower, upper = chain(pts), chain(pts[::-1])",
    "    return lower[:-1] + upper[:-1]         # counter-clockwise, no repeats",
  ];
  const HULL_FENCE = HULL_CODE.slice();
  HULL_FENCE[7] = "            while len(h) >= 2 and cross(h[-2], h[-1], p) < 0:    # keep collinear (LC 587)";
  HULL_FENCE[12] = "    return set(lower + upper)              # boundary points, collinear ones included";
  const HMODES = ["vertices only (pop on ≤ 0)", "keep collinear (pop on < 0)"];
  Viz.register("math-number-theory-hull", (el) => Viz.player(el, {
    title: "Monotone chain: sweep left to right, pop while the last turn is not a left turn",
    tag: "O(n log n) · INTEGER CROSS PRODUCTS",
    legend: [["active", "new point p"], ["path", "chain so far"], ["bad", "popped (turn is wrong)"], ["done", "final hull"]],
    codeLang: "python",
    code: HULL_CODE,
    speed: 1100,
    inputs: [
      { key: "n", label: "points (4 … 22)", value: "14", width: 80 },
      { key: "seed", label: "seed", value: "7", width: 70 },
      { key: "mode", label: "mode", type: "select", value: HMODES[0], options: HMODES },
    ],
    random: () => ({ n: String(Viz.rand(6, 20)), seed: String(Viz.rand(1, 999)), mode: HMODES[Math.random() < 0.7 ? 0 : 1] }),
    build: ({ n: ns, seed: ss, mode }) => {
      const n = int(ns, 4, 22, "Points"), seed = int(ss, 0, 99999, "Seed"), fence = mode === HMODES[1];
      setCode(el, fence ? HULL_FENCE : HULL_CODE);
      const R = rng(seed * 7919 + n), seen = new Set(), pts = [];
      while (pts.length < n) { const p = [randInt(R, 0, 12), randInt(R, 0, 8)]; const k = p.join(); if (!seen.has(k)) { seen.add(k); pts.push(p); } }
      const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]);
      const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
      const fr = [], bad = (c) => (fence ? c < 0 : c <= 0);
      const snap = (extra) => ({ P, ...extra });
      fr.push(snap({ line: [2, 3], note: `${n} integer points, sorted by x (then y). The leftmost and rightmost points are surely on the hull. Build the <b>lower</b> chain left to right, then the <b>upper</b> chain right to left; on each, every turn must be a left (counter-clockwise) turn.`, vars: { n } }));
      const chains = {};
      for (const side of ["lower", "upper"]) {
        const seq = side === "lower" ? P : P.slice().reverse(), h = [];
        const other = side === "upper" ? chains.lower : null;
        for (const p of seq) {
          while (h.length >= 2) {
            const c = cross(h[h.length - 2], h[h.length - 1], p);
            if (!bad(c)) {
              fr.push(snap({ line: [7], side, h: h.slice(), p, tri: [h[h.length - 2], h[h.length - 1], p], ok: true, other, note: `${side}: cross(${h[h.length - 2]}, ${h[h.length - 1]}, ${p}) = ${c} ${c > 0 ? "> 0: a left turn" : "= 0: collinear, kept in this mode"}. The chain stays convex; append (${p}).`, vars: { side, cross: c, chain: h.length } }));
              break;
            }
            const q = h.pop();
            fr.push(snap({ line: [7, 8], side, h: h.slice(), p, popped: q, tri: [h[h.length - 1], q, p], other, note: `${side}: cross(${h[h.length - 1]}, ${q}, ${p}) = ${c} ${c < 0 ? "< 0: a right turn" : "= 0: collinear"}. (${q}) is ${c < 0 ? "inside the hull" : "in the middle of a straight edge"}, so pop it.`, vars: { side, cross: c, popped: `(${q})` } }));
          }
          h.push(p);
        }
        chains[side] = h.slice();
        fr.push(snap({ line: [10, 11], side, h: h.slice(), other, note: `The ${side} chain is done: ${h.map((q) => `(${q})`).join(" → ")}. Each point was pushed once and popped at most once, so after sorting the sweep is O(n).`, vars: { side, size: h.length } }));
      }
      let hull;
      if (fence) { const s = new Map(); [...chains.lower, ...chains.upper].forEach((q) => s.set(q.join(), q)); hull = [...s.values()]; }
      else hull = chains.lower.slice(0, -1).concat(chains.upper.slice(0, -1));
      /* brute force: q is on the boundary iff some line through two points has every point on one side (≥ 0) and q on it */
      const onB = P.filter((q) => P.some((a) => P.some((b) => (a !== b) && P.every((r) => cross(a, b, r) >= 0) && cross(a, b, q) === 0)));
      const key = (arr) => arr.map((q) => q.join()).sort().join("|");
      if (fence) assert(key(hull) === key(onB), "fence hull = boundary points");
      else {
        assert(hull.every((q) => onB.includes(q)), "vertices on boundary");
        if (hull.length >= 3) for (let i = 0; i < hull.length; i++) assert(cross(hull[i], hull[(i + 1) % hull.length], hull[(i + 2) % hull.length]) > 0, "strictly convex");
      }
      let area2 = 0; const ring = fence ? chains.lower.slice(0, -1).concat(chains.upper.slice(0, -1)) : hull;
      for (let i = 0; i < ring.length; i++) { const a = ring[i], b = ring[(i + 1) % ring.length]; area2 += a[0] * b[1] - a[1] * b[0]; }
      fr.push(snap({ line: 12, fin: true, hull, ring, note: `Hull: <b>${hull.length}</b> points${fence ? " (collinear boundary points included, as Erect the Fence wants)" : " (corners only)"}. Twice the area by the shoelace formula = ${area2}, all in exact integers: no floating point, no angles, no division.`, vars: { hull: hull.length, "2 × area": area2 } }));
      return fr;
    },
    render: (f) => {
      const S = 44, ox = 26, oy = 16, X = (x) => ox + x * S, Y = (y) => oy + (8 - y) * S;
      let body = "";
      for (let x = 0; x <= 12; x++) body += `<line class="mn-grid-line" x1="${X(x)}" y1="${Y(0)}" x2="${X(x)}" y2="${Y(8)}"/>`;
      for (let y = 0; y <= 8; y++) body += `<line class="mn-grid-line" x1="${X(0)}" y1="${Y(y)}" x2="${X(12)}" y2="${Y(y)}"/>`;
      const poly = (arr, cls, close) => (arr.length >= 2 ? `<poly${close ? "gon" : "line"} class="edge ${cls}" fill="none" points="${arr.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ")}"/>` : "");
      if (f.fin) body += `<polygon class="mn-fill-path" points="${f.ring.map((q) => `${X(q[0])},${Y(q[1])}`).join(" ")}"/>` + poly(f.ring, "done", true);
      else {
        if (f.other) body += poly(f.other, "done");
        if (f.h) body += poly(f.h, "path");
        if (f.tri) body += poly(f.tri, f.ok ? "visit" : "bad") ;
      }
      const inH = (q) => (f.fin ? f.hull : f.h || []).some((r) => r === q);
      for (const q of f.P) {
        const cls = f.fin ? (inH(q) ? "done" : "") : q === f.p ? "active" : q === f.popped ? "bad" : inH(q) ? "visit" : "";
        body += `<circle class="mn-pt ${cls}" cx="${X(q[0])}" cy="${Y(q[1])}" r="${cls === "active" ? 7 : 5.5}"/>`;
      }
      body += `<text class="small muted" x="${X(0)}" y="${Y(0) + 18}" text-anchor="middle">0</text><text class="small muted" x="${X(12)}" y="${Y(0) + 18}" text-anchor="middle">12</text><text class="small muted" x="${X(0) - 14}" y="${Y(8) + 4}" text-anchor="middle">8</text>`;
      return col(svg(X(12) + 20, Y(0) + 26, body, "points and convex hull"));
    },
  }));

  /* ================= 11. Reservoir sampling ================= */
  const RES_CODE = [
    "def reservoir(stream, k):",
    "    res = []",
    "    for i, x in enumerate(stream):        # length unknown in advance",
    "        if i < k: res.append(x)            # first k fill the reservoir",
    "        else:",
    "            j = random.randint(0, i)       # i+1 equally likely slots",
    "            if j < k: res[j] = x           # keep x with probability k/(i+1)",
    "    return res",
  ];
  Viz.register("math-number-theory-reservoir", (el) => Viz.player(el, {
    title: "Reservoir sampling: keep item i with probability k/(i+1) and it all evens out",
    tag: "ONE PASS · O(k) MEMORY",
    legend: [["active", "arriving item"], ["done", "in the reservoir"], ["bad", "evicted"], ["dim", "rejected"]],
    codeLang: "python",
    code: RES_CODE,
    speed: 1200,
    inputs: [
      { key: "n", label: "stream length (4 … 12)", value: "8", width: 80 },
      { key: "k", label: "k (1 … 3)", value: "2", width: 70 },
      { key: "seed", label: "seed", value: "3", width: 70 },
    ],
    random: () => ({ n: String(Viz.rand(5, 12)), k: String(Viz.rand(1, 3)), seed: String(Viz.rand(1, 999)) }),
    build: ({ n: ns, k: ks, seed: ss }) => {
      const n = int(ns, 4, 12, "Stream length"), k = int(ks, 1, 3, "k"), seed = int(ss, 0, 99999, "Seed");
      if (k >= n) throw new Error("k must be smaller than the stream length.");
      const items = range(n).map((i) => String.fromCharCode(65 + i)), R = rng(seed + 101), res = [], fr = [];
      const status = Array(n).fill("");
      const snap = (extra) => ({ items, res: res.slice(), status: status.slice(), k, ...extra });
      fr.push(snap({ line: 1, note: `Pick ${k} of the ${n} items uniformly at random while they stream past, without knowing ${n} in advance and storing only ${k}. Rule: the i-th item (0-based) gets in with probability k/(i+1).`, vars: { k } }));
      for (let i = 0; i < n; i++) {
        if (i < k) { res.push(i); status[i] = "done"; fr.push(snap({ line: 3, i, note: `Item ${items[i]} (i = ${i}) fills slot ${i}: the first k items always go in.`, vars: { i, x: items[i] } })); continue; }
        const j = randInt(R, 0, i);
        if (j < k) {
          const out = res[j]; res[j] = i; status[out] = "bad"; status[i] = "done";
          fr.push(snap({ line: [5, 6], i, j, out, note: `Item ${items[i]} (i = ${i}): j = randint(0, ${i}) = ${j} < ${k}, so it replaces ${items[out]} in slot ${j}. That happens with probability ${k}/${i + 1}.`, vars: { i, j, "P(keep)": `${k}/${i + 1}` } }));
        } else {
          status[i] = "dim";
          fr.push(snap({ line: [5, 6], i, j, note: `Item ${items[i]} (i = ${i}): j = ${j} ≥ ${k}, so it is skipped (probability ${i + 1 - k}/${i + 1}).`, vars: { i, j, "P(keep)": `${k}/${i + 1}` } }));
        }
      }
      const runs = 6000, cnt = Array(n).fill(0), R2 = rng(seed * 31 + 7);
      for (let t = 0; t < runs; t++) { const r = []; for (let i = 0; i < n; i++) { if (i < k) r.push(i); else { const j = randInt(R2, 0, i); if (j < k) r[j] = i; } } r.forEach((x) => cnt[x]++); }
      const fair = (runs * k) / n, sd = Math.sqrt(runs * (k / n) * (1 - k / n));
      cnt.forEach((c) => assert(Math.abs(c - fair) < 7 * sd, "reservoir is uniform"));
      fr.push(snap({ line: 7, fin: true, cnt, fair, note: `This run kept {${res.map((x) => items[x]).join(", ")}}. Across ${runs} seeded runs, every item lands in the sample about ${fair.toFixed(0)} times (dashed line). Why: item i gets in with k/(i+1); it then survives item m with probability 1 − 1/(m+1) = m/(m+1). The product telescopes: k/(i+1) · (i+1)/(i+2) · … · (n−1)/n = <b>k/n</b> for every item.`, vars: { runs, "expected each": fair.toFixed(0) } }));
      return fr;
    },
    render: (f) => {
      const stream = chips(f.items.map((x, i) => x), (i) => (i === f.i ? "active" : f.status[i] === "bad" ? "bad" : f.status[i] === "dim" ? "dim" : f.status[i] === "done" ? "done" : f.i !== undefined && i > f.i ? "" : f.status[i]));
      const slots = chips(range(f.k).map((s) => (f.res[s] !== undefined ? `slot ${s}: ${f.items[f.res[s]]}` : `slot ${s}: -`)), (s) => (s === f.j && f.out !== undefined ? "active" : f.res[s] !== undefined ? "done" : "dim"));
      const parts = [box("stream", stream), box("reservoir", slots)];
      if (f.fin) parts.push(hist(f.cnt, f.items, { fair: f.fair, label: "times each item was sampled" }));
      return col(...parts);
    },
  }));

  /* ================= 12. Fisher–Yates vs the naive shuffle ================= */
  const FY_CODE = [
    "def shuffle(a):                        # Fisher-Yates (Knuth)",
    "    for i in range(len(a) - 1, 0, -1):",
    "        j = random.randint(0, i)       # pick from the UNFIXED part a[0..i]",
    "        a[i], a[j] = a[j], a[i]        # a[i] is now final",
  ];
  const NAIVE_CODE = [
    "def bad_shuffle(a):                    # looks fine, is biased",
    "    for i in range(len(a)):",
    "        j = random.randint(0, len(a) - 1)   # n choices every step: n^n paths",
    "        a[i], a[j] = a[j], a[i]",
  ];
  const FMODES = ["Fisher–Yates", "naive (biased)"];
  const perms3 = ["ABC", "ACB", "BAC", "BCA", "CAB", "CBA"];
  Viz.register("math-number-theory-shuffle", (el) => Viz.player(el, {
    title: "Fisher–Yates: shrink the unfixed part by one; the naive swap-anywhere shuffle is biased",
    tag: "O(n) · EVERY PERMUTATION 1/n!",
    legend: [["active", "position i"], ["visit", "random pick j"], ["done", "fixed for good"], ["bad", "over-represented"]],
    codeLang: "python",
    code: FY_CODE,
    speed: 1200,
    inputs: [
      { key: "n", label: "n (3 … 8)", value: "6", width: 70 },
      { key: "seed", label: "seed", value: "5", width: 70 },
      { key: "mode", label: "algorithm", type: "select", value: FMODES[0], options: FMODES },
    ],
    random: () => ({ n: String(Viz.rand(3, 8)), seed: String(Viz.rand(1, 999)), mode: FMODES[Math.random() < 0.7 ? 0 : 1] }),
    build: ({ n: ns, seed: ss, mode }) => {
      const n = int(ns, 3, 8, "n"), seed = int(ss, 0, 99999, "Seed"), naive = mode === FMODES[1];
      setCode(el, naive ? NAIVE_CODE : FY_CODE);
      const a = range(n).map((i) => String.fromCharCode(65 + i)), R = rng(seed + 55), fr = [];
      const snap = (extra) => ({ a: a.slice(), naive, ...extra });
      fr.push(snap({ line: 0, note: naive ? `The naive shuffle swaps every position with a uniformly random position. It makes n^n = ${n ** n} equally likely choice sequences, but there are n! = ${range(n).reduce((p, i) => p * (i + 1), 1)} permutations, and n^n is not a multiple of n! (for n ≥ 3), so some permutations must come up more often.` : `Walk i from the end. a[i+1 …] is already final; pick a uniformly random element of the unfixed part a[0 … i] to be the next final one. Choices: n · (n−1) · … · 2 = n! sequences, one per permutation.`, vars: { n } }));
      if (naive) {
        for (let i = 0; i < n; i++) { const j = randInt(R, 0, n - 1); [a[i], a[j]] = [a[j], a[i]]; fr.push(snap({ line: [2, 3], i, j, note: `i = ${i}: j = randint(0, ${n - 1}) = ${j}; swap a[${i}] and a[${j}]. ${n} choices at every step, even though earlier slots may be disturbed again.`, vars: { i, j } })); }
      } else {
        for (let i = n - 1; i >= 1; i--) { const j = randInt(R, 0, i); [a[i], a[j]] = [a[j], a[i]]; fr.push(snap({ line: [2, 3], i, j, fixedFrom: i, note: `i = ${i}: j = randint(0, ${i}) = ${j}; swap, and a[${i}] = ${a[i]} is final. Any element of the unfixed ${i + 1} lands here with probability 1/${i + 1}.`, vars: { i, j, "P(this pick)": `1/${i + 1}` } })); }
      }
      assert(a.slice().sort().join("") === range(n).map((i) => String.fromCharCode(65 + i)).join(""), "still a permutation");
      const runs = 6000, good = Array(6).fill(0), bad = Array(6).fill(0), R2 = rng(seed * 13 + 1);
      for (let t = 0; t < runs; t++) {
        const g = ["A", "B", "C"]; for (let i = 2; i >= 1; i--) { const j = randInt(R2, 0, i); [g[i], g[j]] = [g[j], g[i]]; } good[perms3.indexOf(g.join(""))]++;
        const b = ["A", "B", "C"]; for (let i = 0; i < 3; i++) { const j = randInt(R2, 0, 2); [b[i], b[j]] = [b[j], b[i]]; } bad[perms3.indexOf(b.join(""))]++;
      }
      /* exact naive distribution over all 27 choice sequences */
      const exact = Array(6).fill(0);
      for (let s = 0; s < 27; s++) { const b = ["A", "B", "C"]; [s % 3, Math.floor(s / 3) % 3, Math.floor(s / 9)].forEach((j, i) => { [b[i], b[j]] = [b[j], b[i]]; }); exact[perms3.indexOf(b.join(""))]++; }
      assert(exact.join() === "4,5,5,5,4,4", "naive exact counts");
      const sd = Math.sqrt(runs / 6 * (5 / 6));
      good.forEach((c) => assert(Math.abs(c - runs / 6) < 7 * sd, "fisher-yates uniform"));
      fr.push(snap({ line: naive ? 3 : 3, fin: true, good, bad, exact, note: `Result: ${a.join(" ")}. Below, ${runs} seeded shuffles of A B C each. Fisher–Yates bars sit on the fair line (${runs / 6}). The naive shuffle's 27 equally likely choice sequences split <b>4, 5, 5, 5, 4, 4</b> over the 6 permutations: ACB, BAC and BCA come up 5/27 ≈ 18.5% of the time instead of 1/6 ≈ 16.7%.`, vars: { runs, fair: runs / 6 } }));
      return fr;
    },
    render: (f) => {
      const n = f.a.length;
      const arr = Viz.array(f.a, { cls: (i) => (f.fin ? "done" : i === f.i ? "active" : i === f.j ? "visit" : f.fixedFrom !== undefined && i > f.fixedFrom ? "done" : f.fixedFrom !== undefined && i === f.fixedFrom ? "active" : ""), label: f.naive ? "array" : "array (right part is final)", ptrs: f.fin ? {} : f.i === f.j ? { "i=j": f.i } : { i: f.i, j: f.j } });
      const parts = [arr];
      if (f.fin) parts.push(row(hist(f.good, perms3, { fair: 1000, label: "Fisher–Yates", cls: () => "done" }), hist(f.bad, perms3, { fair: 1000, label: "naive", cls: (i) => (f.exact[i] === 5 ? "bad" : "") })));
      return col(...parts);
    },
  }));

  /* ================= 13. rand10 from rand7: rejection sampling ================= */
  const R10_CODE = [
    "def rand10():",
    "    while True:",
    "        idx = (rand7() - 1) * 7 + rand7()     # uniform on 1..49",
    "        if idx <= 40:                         # 40 = 4 full copies of 1..10",
    "            return 1 + (idx - 1) % 10",
    "        # 41..49: reject and roll again (only 9/49 of the time)",
  ];
  Viz.register("math-number-theory-rand10", (el) => Viz.player(el, {
    title: "rand10() from rand7(): two rolls give 49 equal cells; keep 40, reject 9",
    tag: "REJECTION SAMPLING",
    legend: [["active", "this roll"], ["done", "accepted cells (4 per output)"], ["bad", "rejected cells: roll again"]],
    codeLang: "python",
    code: R10_CODE,
    speed: 1000,
    inputs: [
      { key: "draws", label: "outputs to draw (1 … 12)", value: "8", width: 80 },
      { key: "seed", label: "seed", value: "9", width: 70 },
    ],
    random: () => ({ draws: String(Viz.rand(4, 12)), seed: String(Viz.rand(1, 999)) }),
    build: ({ draws: ds, seed: ss }) => {
      const draws = int(ds, 1, 12, "Outputs"), seed = int(ss, 0, 99999, "Seed"), R = rng(seed + 17), rand7 = () => randInt(R, 1, 7);
      const outs = [], fr = [];
      let calls = 0;
      const snap = (extra) => ({ outs: outs.slice(), ...extra });
      fr.push(snap({ line: 0, note: `rand7() gives 1 … 7. Two calls pick one of 7 × 7 = <b>49 equally likely cells</b>. 49 is not a multiple of 10, so use the first 40 (four copies of 1 … 10) and throw the last 9 away. Rejection keeps the kept cells equally likely: conditioned on landing in 1 … 40, each cell has probability 1/40.`, vars: {} }));
      while (outs.length < draws) {
        const r1 = rand7(), r2 = rand7(), idx = (r1 - 1) * 7 + r2; calls += 2;
        if (idx <= 40) { const v = 1 + ((idx - 1) % 10); outs.push(v); fr.push(snap({ line: [2, 3, 4], r1, r2, idx, ok: true, note: `rand7() = ${r1}, rand7() = ${r2} → cell ${idx} ≤ 40: output <b>${v}</b>.`, vars: { r1, r2, idx, out: v, "rand7 calls": calls } })); }
        else fr.push(snap({ line: [2, 5], r1, r2, idx, ok: false, note: `rand7() = ${r1}, rand7() = ${r2} → cell ${idx} > 40: rejected, roll again.`, vars: { r1, r2, idx, "rand7 calls": calls } }));
      }
      const runs = 7000, cnt = Array(10).fill(0), R2 = rng(seed * 3 + 5); let tot = 0;
      for (let t = 0; t < runs; t++) { for (;;) { const idx = (randInt(R2, 1, 7) - 1) * 7 + randInt(R2, 1, 7); tot += 2; if (idx <= 40) { cnt[(idx - 1) % 10]++; break; } } }
      const sd = Math.sqrt(runs * 0.1 * 0.9);
      cnt.forEach((c) => assert(Math.abs(c - runs / 10) < 7 * sd, "rand10 uniform"));
      fr.push(snap({ line: 4, fin: true, cnt, note: `Over ${runs} seeded calls every output appears about ${runs / 10} times. The expected number of rand7() calls per output is 2 · 49/40 = <b>2.45</b> (measured ${(tot / runs).toFixed(2)}): each attempt succeeds with probability 40/49, so on average 49/40 attempts.`, vars: { runs, "calls per output": (tot / runs).toFixed(2) } }));
      return fr;
    },
    render: (f) => {
      const cells = [];
      for (let r = 1; r <= 7; r++) for (let c = 1; c <= 7; c++) {
        const idx = (r - 1) * 7 + c, hit = f.r1 === r && f.r2 === c;
        cells.push({ cls: hit ? "active" : idx <= 40 ? "done" : "bad", html: `${idx <= 40 ? 1 + ((idx - 1) % 10) : "✕"}<small>${idx}</small>` });
      }
      const grid = `<div class="mn-box"><span class="mn-cap">rows: 1st rand7 · columns: 2nd rand7</span>${numGrid(cells, 7)}</div>`;
      const parts = [row(grid, f.outs.length ? box("outputs", chips(f.outs.map(String), (i) => (i === f.outs.length - 1 && f.ok && !f.fin ? "active" : "done"))) : "")];
      if (f.fin) parts.push(hist(f.cnt, range(10).map((i) => String(i + 1)), { fair: 700, label: "counts per output (7000 calls)" }));
      return col(...parts);
    },
  }));
})();
