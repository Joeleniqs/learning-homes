/* Visualizers for Bit Manipulation. Every name is prefixed "bit-manipulation-".
 * Frames come from running the real operations; each build() cross-checks its answer against a slower reference. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when a mode changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const pad = (code, n) => code.concat(Array(Math.max(0, n - code.length)).fill(""));
  const assert = (c, m) => { if (!c) throw new Error("Internal check failed: " + m); };
  const range = (n) => Array.from({ length: n }, (_, i) => i);

  /* ---------- numbers are kept as unsigned w-bit values (0 ≤ u < 2^w, w ≤ 32) ---------- */
  const U = (x, w) => (((x % 2 ** w) + 2 ** w) % 2 ** w);
  const S = (u, w) => (u >= 2 ** (w - 1) ? u - 2 ** w : u);
  const bit = (u, p) => Math.floor(u / 2 ** p) % 2;
  const bin = (u, w) => u.toString(2).padStart(w, "0");
  const nib = (s) => s.replace(/\B(?=(.{4})+$)/g, " ");
  const hex = (u, w) => "0x" + u.toString(16).toUpperCase().padStart(Math.ceil(w / 4), "0");
  const lowP = (u) => { let p = 0; while (u > 0 && bit(u, p) === 0) p++; return p; };
  const pop = (u) => { let c = 0; for (let p = 0; p < 32; p++) c += bit(u, p); return c; };
  const AND = (a, b) => (a & b) >>> 0, OR = (a, b) => (a | b) >>> 0, XOR = (a, b) => (a ^ b) >>> 0;
  const parseNum = (s, w, what, { signed = true } = {}) => {
    const t = String(s).trim().replace(/_/g, "");
    let v;
    if (/^-?0b[01]+$/i.test(t)) v = (t[0] === "-" ? -1 : 1) * parseInt(t.replace(/^-?0b/i, ""), 2);
    else if (/^-?0x[0-9a-f]+$/i.test(t)) v = (t[0] === "-" ? -1 : 1) * parseInt(t.replace(/^-?0x/i, ""), 16);
    else if (/^-?\d+$/.test(t)) v = Number(t);
    else throw new Error(`${what}: use a whole number like 45, -6, 0b101101 or 0x2D.`);
    const lo = signed ? -(2 ** (w - 1)) : 0, hi = 2 ** w - 1;
    if (v < lo || v > hi) throw new Error(`${what} must fit in ${w} bits: from ${lo} to ${hi}.`);
    return U(v, w);
  };
  const int = (s, lo, hi, what) => {
    const n = Number(String(s).trim());
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what} must be a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const nums = (s, { min = 1, max = 10, lo = 0, hi = 255, what = "Values" } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what} must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };

  /* ---------- register rendering ---------- */
  const cellsHtml = (u, w, o = {}) => range(w).map((k) => {
    const p = w - 1 - k, b = u === null ? 0 : bit(u, p);
    const blank = u === null || (o.blank && o.blank(p));
    const c = (o.cls && o.cls(p, b)) || "";
    return `<span class="bm-b ${b && !blank ? "on" : ""} ${blank ? "blank" : ""} ${c} ${p % 4 === 3 && k ? "nib" : ""}">${blank ? "·" : b}</span>`;
  }).join("");
  const reg = (label, u, w, o = {}) => `<div class="bm-reg ${o.row || ""}"><span class="bm-lbl">${o.html ? label : esc(label)}</span><span class="bm-cells">${cellsHtml(u, w, o)}</span><span class="bm-val">${o.val !== undefined ? o.val : u === null ? "" : valTxt(u, w, o.signed)}</span></div>`;
  const head = (w, act = () => false) => `<div class="bm-reg bm-head"><span class="bm-lbl">bit</span><span class="bm-cells">${range(w).map((k) => { const p = w - 1 - k; return `<span class="bm-b ${act(p) ? "active" : ""} ${p % 4 === 3 && k ? "nib" : ""}">${p}</span>`; }).join("")}</span><span class="bm-val"></span></div>`;
  const valTxt = (u, w, signed) => (signed && S(u, w) !== u ? `${S(u, w)} <span class="muted">(unsigned ${u})</span>` : `${u}${signed === false && u >= 2 ** (w - 1) ? ` <span class="muted">(signed ${S(u, w)})</span>` : ""}`);
  const regs = (w, body, act) => `<div class="bm-regs ${w > 16 ? "bm-w32" : ""}">${head(w, act)}${body.join("")}</div>`;
  const col = (...parts) => `<div class="bm-col">${parts.filter(Boolean).join("")}</div>`;
  const chips = (items, cls = () => "") => `<div class="bm-chips">${items.map((t, i) => `<span class="bm-chip ${cls(i, t)}">${esc(t)}</span>`).join("")}</div>`;
  const box = (cap, inner) => `<div class="bm-box"><span class="bm-cap">${esc(cap)}</span>${inner}</div>`;

  /* ================= 1. Playground: every operator on w-bit two's complement ================= */
  const PG_OPS = ["a & b", "a | b", "a ^ b", "~a", "a << k", "a >> k (arithmetic)", "a >>> k (logical)"];
  const PG_CODE = {
    "a & b": ["mask = (1 << w) - 1                 # keep exactly w bits", "a, b = a & mask, b & mask             # two's complement patterns", "r = a & b                           # column rule: 1 only if both are 1", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "a | b": ["mask = (1 << w) - 1                 # keep exactly w bits", "a, b = a & mask, b & mask             # two's complement patterns", "r = a | b                           # column rule: 1 if either is 1", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "a ^ b": ["mask = (1 << w) - 1                 # keep exactly w bits", "a, b = a & mask, b & mask             # two's complement patterns", "r = a ^ b                           # column rule: 1 if the bits differ", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "~a": ["mask = (1 << w) - 1                 # keep exactly w bits", "a = a & mask", "r = ~a & mask                       # flip every bit (Python's ~a is -a - 1)", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "a << k": ["mask = (1 << w) - 1                 # keep exactly w bits", "a = a & mask", "r = (a << k) & mask                 # bits pushed past bit w-1 are lost", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "a >> k (arithmetic)": ["mask = (1 << w) - 1                 # keep exactly w bits", "sa = a - (1 << w) if a >> (w - 1) else a   # signed value", "r = (sa >> k) & mask                # copies of the sign bit come in", "signed = r - (1 << w) if r >> (w - 1) else r"],
    "a >>> k (logical)": ["mask = (1 << w) - 1                 # keep exactly w bits", "a = a & mask                        # read the pattern as unsigned", "r = a >> k                          # zeros come in (C#: a >>> k, or (uint)a >> k)", "signed = r - (1 << w) if r >> (w - 1) else r"],
  };
  Viz.register("bit-manipulation-playground", (el) => Viz.player(el, {
    title: "Bit playground: one operator, every column, signed and unsigned readings",
    tag: "OPERATORS · TWO'S COMPLEMENT",
    legend: [["accent", "a 1 bit"], ["active", "column being computed"], ["visit", "bit that survives a shift"], ["bad", "bit pushed out"], ["done", "result bit"]],
    codeLang: "python",
    code: PG_CODE["a & b"],
    speed: 900,
    inputs: [
      { key: "a", label: "a", value: "-6", width: 90 },
      { key: "b", label: "b", value: "13", width: 90 },
      { key: "op", label: "operator", type: "select", value: "a & b", options: PG_OPS },
      { key: "k", label: "shift k", value: "2", width: 60 },
      { key: "w", label: "width w", type: "select", value: "8", options: ["8", "16", "32"] },
    ],
    random: () => { const w = [8, 8, 16, 32][Viz.rand(0, 3)], r = () => Viz.rand(-(2 ** (w - 1)), 2 ** (w - 1) - 1); return { a: String(r()), b: String(r()), op: PG_OPS[Viz.rand(0, PG_OPS.length - 1)], k: String(Viz.rand(1, Math.min(6, w - 1))), w: String(w) }; },
    build: ({ a: as, b: bs, op, k: ks, w: ws }) => {
      const w = Number(ws), a = parseNum(as, w, "a"), b = parseNum(bs, w, "b"), k = int(ks, 0, w - 1, "Shift k");
      setCode(el, PG_CODE[op]);
      const fr = [], binary = op.length === 5 && op[0] === "a" && op[4] === "b";
      const vA = { a: `${S(a, w)}`, "a bits": nib(bin(a, w)) };
      if (binary) {
        const r = op === "a & b" ? AND(a, b) : op === "a | b" ? OR(a, b) : XOR(a, b);
        const rule = op === "a & b" ? "1 only where both are 1 (AND keeps the common bits: a mask that selects)" : op === "a | b" ? "1 where either is 1 (OR switches bits on)" : "1 where the bits differ (XOR is addition without carry, and a toggle)";
        const g = w === 8 ? 1 : 4;
        fr.push({ kind: "bin", w, a, b, r, done: w, line: [0, 1], note: `Both numbers are stored as ${w}-bit patterns. Negative numbers use two's complement: ${S(a, w) < 0 ? `a = ${S(a, w)} is stored as 2<sup>${w}</sup> − ${-S(a, w)} = ${a}.` : `a = ${a} is just its binary digits.`} The rule for <code>${op}</code>: ${rule}. Each column is computed on its own; no column looks at its neighbours.`, vars: { ...vA, b: `${S(b, w)}`, "b bits": nib(bin(b, w)) } });
        for (let hi = w - 1; hi >= 0; hi -= g) {
          const lo = hi - g + 1, sa = bin(a, w).slice(w - 1 - hi, w - lo), sb = bin(b, w).slice(w - 1 - hi, w - lo), sr = bin(r, w).slice(w - 1 - hi, w - lo);
          fr.push({ kind: "bin", w, a, b, r, done: lo, hi, lo, line: 2, note: g === 1 ? `Bit ${hi}: a has ${sa}, b has ${sb}, so ${sa} ${op[2]} ${sb} = <b>${sr}</b>.` : `Bits ${hi}…${lo}: a = ${sa}, b = ${sb}, column by column → <b>${sr}</b>.`, vars: { column: g === 1 ? hi : `${hi}..${lo}`, "a bits": sa, "b bits": sb, "r bits": sr } });
        }
        fr.push({ kind: "bin", w, a, b, r, done: 0, line: 3, final: true, note: `Result pattern ${nib(bin(r, w))} = ${hex(r, w)}. Read as unsigned it is ${r}; read as signed (the top bit counts −2<sup>${w - 1}</sup>) it is <b>${S(r, w)}</b>. The bits are the same: only the reading changes.`, vars: { r: S(r, w), unsigned: r, hex: hex(r, w) } });
        return fr;
      }
      if (op === "~a") {
        const r = U(~a, w);
        assert(S(r, w) === -S(a, w) - 1, "~a == -a - 1");
        fr.push({ kind: "un", w, a, r: null, line: 1, note: `a = ${S(a, w)} as ${w} bits. NOT flips every bit.`, vars: vA });
        fr.push({ kind: "un", w, a, r, line: 2, flip: true, note: `Every 0 became 1 and every 1 became 0. Adding a and ~a gives all ones, which is −1 in two's complement, so <b>~a = −a − 1</b>: ~${S(a, w)} = ${S(r, w)}.`, vars: { r: S(r, w), "r bits": nib(bin(r, w)) } });
        fr.push({ kind: "un", w, a, r, line: 3, flip: true, note: `That identity is why <code>−a = ~a + 1</code> (the two's complement negation rule) and why Python prints <code>~${S(a, w)}</code> as ${S(r, w)}: Python has no fixed width, but it keeps the same identity.`, vars: { r: S(r, w), unsigned: r, hex: hex(r, w) } });
        return fr;
      }
      let r, ins, rule;
      if (op === "a << k") { r = U(a * 2 ** k, w); ins = 0; rule = `shift left by ${k}: each bit moves ${k} places up, ${k} zero${k === 1 ? "" : "s"} come in at the bottom, and the top ${k} bit${k === 1 ? "" : "s"} fall off`; }
      else if (op.startsWith("a >> k")) { r = U(Math.floor(S(a, w) / 2 ** k), w); ins = bit(a, w - 1); rule = `arithmetic shift right by ${k}: bits move down, the bottom ${k} fall off, and ${k} copies of the <b>sign bit</b> (${ins}) come in at the top`; }
      else { r = Math.floor(a / 2 ** k); ins = 0; rule = `logical shift right by ${k}: bits move down, the bottom ${k} fall off, and zeros come in at the top`; }
      const left = op === "a << k", logical = op.startsWith("a >>>");
      fr.push({ kind: "sh", w, a, r: null, k, left, logical, line: [0, 1], note: `a = ${S(a, w)} = ${nib(bin(a, w))}. Operation: ${rule}.`, vars: { ...vA, k } });
      fr.push({ kind: "sh", w, a, r, k, left, logical, ins, line: 2, note: `Red bits were pushed out; blue bits survived and moved ${k} place${k === 1 ? "" : "s"}; ${left ? "the new low bits are 0" : `the new high bits are ${ins}`}.`, vars: { r: nib(bin(r, w)) } });
      let meaning;
      if (left) { const exact = S(a, w) * 2 ** k; meaning = exact === S(r, w) ? `Multiply by 2<sup>${k}</sup>: ${S(a, w)} · ${2 ** k} = <b>${S(r, w)}</b>, which still fits.` : `Multiply by 2<sup>${k}</sup> would give ${exact}, which does not fit in ${w} signed bits: the result <b>overflowed</b> to ${S(r, w)}. C# int does exactly this silently (unless <code>checked</code>); Python never overflows because its ints grow.`; }
      else if (op.startsWith("a >> k")) { assert(S(r, w) === Math.floor(S(a, w) / 2 ** k), "arith shift = floor div"); meaning = `Divide by 2<sup>${k}</sup> rounding toward −∞: ⌊${S(a, w)} / ${2 ** k}⌋ = <b>${S(r, w)}</b>. Python's <code>&gt;&gt;</code> and C#'s <code>&gt;&gt;</code> on int/long both work this way. Note −7 &gt;&gt; 1 is −4, but −7 / 2 in C# is −3.`; }
      else { meaning = `Reading the pattern as unsigned (${a}) and dividing by 2<sup>${k}</sup>: <b>${r}</b>. For negative inputs this is a huge positive number. C#: <code>x &gt;&gt;&gt; k</code> (C# 11+) or <code>(uint)x &gt;&gt; k</code>. Python has no &gt;&gt;&gt;: mask first, <code>(x &amp; 0xFFFFFFFF) &gt;&gt; k</code>.`; }
      fr.push({ kind: "sh", w, a, r, k, left, logical, ins, line: 3, note: meaning, vars: { r: S(r, w), unsigned: r, hex: hex(r, w) } });
      return fr;
    },
    render: (f) => {
      const w = f.w, rows = [];
      if (f.kind === "bin") {
        const act = (p) => f.hi !== undefined && p <= f.hi && p >= f.lo;
        const hid = (p) => p < f.done;
        rows.push(reg("a", f.a, w, { signed: true, cls: (p) => (act(p) ? "active" : "") }));
        rows.push(reg("b", f.b, w, { signed: true, cls: (p) => (act(p) ? "active" : "") }));
        rows.push(reg("r", f.r, w, { row: "res", signed: true, blank: hid, cls: (p) => (act(p) ? "active" : !hid(p) ? "done" : ""), val: f.final ? undefined : "" }));
        return col(regs(w, rows, act));
      }
      if (f.kind === "un") {
        rows.push(reg("a", f.a, w, { signed: true }));
        rows.push(reg("~a", f.r, w, { row: "res", signed: true, cls: () => (f.flip ? "done" : "") }));
        return col(regs(w, rows));
      }
      const k = f.k;
      const lost = (p) => (f.left ? p >= w - k : p < k);
      rows.push(reg("a", f.a, w, { signed: true, cls: (p) => (f.r === null ? "" : lost(p) ? "bad" : "visit") }));
      const fresh = (p) => (f.left ? p < k : p >= w - k);
      rows.push(reg(f.left ? `a << ${k}` : f.logical ? `a >>> ${k}` : `a >> ${k}`, f.r, w, { row: "res", signed: true, cls: (p) => (fresh(p) ? "active" : "visit") }));
      return col(regs(w, rows), f.r === null ? "" : `<div class="bm-eq">${f.left ? `${S(f.a, w)} · 2<sup>${k}</sup>` : `⌊${S(f.a, w)} / 2<sup>${k}</sup>⌋`} → ${S(f.r, w)}${S(f.r, w) !== f.r ? ` <span class="muted">(unsigned ${f.r})</span>` : ""}</div>`);
    },
  }));

  /* ================= 2. Single-bit and lowest-bit tricks ================= */
  const TR_OPS = ["x & (x - 1): drop the lowest 1", "x & -x: keep only the lowest 1", "x | (x + 1): set the lowest 0", "x | (1 << i): set bit i", "x & ~(1 << i): clear bit i", "x ^ (1 << i): toggle bit i", "(x >> i) & 1: test bit i"];
  const TR_CODE = {
    0: ["y = x - 1        # borrow: trailing 0s become 1s, the lowest 1 becomes 0", "r = x & y        # keeps only the bits above the lowest 1", "# r == 0  <=>  x had at most one 1 bit (power of two test)"],
    1: ["nx = ~x          # flip everything", "neg = nx + 1     # -x: the +1 carries through to the lowest 1 of x", "r = x & neg      # only the lowest 1 bit is common"],
    2: ["y = x + 1        # carry: trailing 1s become 0s, the lowest 0 becomes 1", "r = x | y        # turn on the lowest 0 bit"],
    3: ["m = 1 << i       # a single 1 at position i", "r = x | m        # OR with 1 sets; OR with 0 keeps"],
    4: ["m = ~(1 << i)    # all ones except position i", "r = x & m        # AND with 0 clears; AND with 1 keeps"],
    5: ["m = 1 << i       # a single 1 at position i", "r = x ^ m        # XOR with 1 flips; XOR with 0 keeps"],
    6: ["y = x >> i       # bring bit i down to position 0", "r = y & 1        # keep only that bit"],
  };
  Viz.register("bit-manipulation-tricks", (el) => Viz.player(el, {
    title: "Bit tricks: why x & (x−1), x & −x and the single-bit masks work",
    tag: "MASKS · BORROW AND CARRY",
    legend: [["accent", "a 1 bit"], ["active", "the lowest 1 / bit i"], ["visit", "bits changed by the borrow or carry"], ["done", "result"], ["bad", "bit cleared"]],
    codeLang: "python",
    code: TR_CODE[0],
    speed: 1000,
    inputs: [
      { key: "x", label: "x", value: "44", width: 90 },
      { key: "op", label: "trick", type: "select", value: TR_OPS[0], options: TR_OPS },
      { key: "i", label: "bit i", value: "4", width: 60 },
      { key: "w", label: "width w", type: "select", value: "8", options: ["8", "16"] },
    ],
    random: () => { const w = [8, 16][Viz.rand(0, 1)]; return { x: String(Viz.rand(0, 2 ** w - 1)), op: TR_OPS[Viz.rand(0, TR_OPS.length - 1)], i: String(Viz.rand(0, w - 1)), w: String(w) }; },
    build: ({ x: xs, op, i: is, w: ws }) => {
      const w = Number(ws), x = parseNum(xs, w, "x"), i = int(is, 0, w - 1, "Bit i"), o = TR_OPS.indexOf(op);
      setCode(el, TR_CODE[o]);
      const fr = [], t = lowP(x), ones = (u) => { let p = 0; while (bit(u, p)) p++; return p; };
      const R = (rows, extra = "") => ({ rows, extra });
      const base = { name: "x", u: x, cls: () => "" };
      if (o === 0) {
        const y = U(x - 1, w), r = AND(x, y);
        let ref = x; if (x) ref -= 2 ** t; assert(r === ref, "drop lowest");
        fr.push({ w, ...R([{ ...base, cls: (p) => (x && p === t ? "active" : x && p < t ? "visit" : "") }]), line: [], note: x ? `x = ${x}. Its lowest 1 is at bit ${t}${t ? `, with ${t} zero${t > 1 ? "s" : ""} below it` : ""}. The trick deletes exactly that bit.` : "x = 0 has no 1 bits; x − 1 wraps around to all ones, and x &amp; (x − 1) is still 0.", vars: { x, "lowest 1 at": x ? t : "none" } });
        fr.push({ w, ...R([{ ...base, cls: (p) => (x && p === t ? "active" : x && p < t ? "visit" : "") }, { name: "x − 1", u: y, cls: (p) => (!x || p <= t ? "visit" : "") }]), line: 0, note: x ? `Subtracting 1 must <b>borrow</b>: the ${t} trailing 0${t === 1 ? "" : "s"} become 1${t === 1 ? "" : "s"}, the lowest 1 becomes 0, and every bit above bit ${t} is untouched.` : "0 − 1 borrows through every bit: all ones.", vars: { "x - 1": y } });
        fr.push({ w, ...R([{ ...base }, { name: "x − 1", u: y }, { name: "x & (x−1)", u: r, res: true, cls: (p) => (x && p === t ? "bad" : bit(r, p) ? "done" : "") }]), line: [1, 2], note: `Below and at bit ${t} the two rows disagree in every column, so AND gives 0 there. Above bit ${t} they are identical, so AND keeps them. Result ${r}: ${r === 0 ? "<b>zero</b>, so x had at most one 1 bit. That is the power-of-two test <code>x &gt; 0 and x &amp; (x−1) == 0</code>." : "x with its lowest 1 removed. Repeat until 0 and you have counted the 1 bits (Kernighan)."}`, vars: { r, "power of two?": x > 0 && r === 0 } });
      } else if (o === 1) {
        const nx = U(~x, w), neg = U(nx + 1, w), r = AND(x, neg);
        assert(r === (x ? 2 ** t : 0), "lowbit");
        fr.push({ w, ...R([{ ...base, cls: (p) => (x && p === t ? "active" : x && p < t ? "visit" : "") }]), line: [], note: x ? `x = ${x}; its lowest 1 is bit ${t}. We want a number with only that bit: 2<sup>${t}</sup> = ${2 ** t}.` : "x = 0: there is no lowest 1, and the result will be 0.", vars: { x } });
        fr.push({ w, ...R([{ ...base }, { name: "~x", u: nx, cls: () => "visit" }]), line: 0, note: `~x flips every bit, so x and ~x disagree everywhere. The trailing 0s of x are now trailing 1s, and the lowest 1 of x is now a 0.`, vars: { "~x": nx } });
        fr.push({ w, ...R([{ ...base, cls: (p) => (x && p === t ? "active" : "") }, { name: "−x = ~x + 1", u: neg, cls: (p) => (x && p <= t ? "visit" : "") }]), line: 1, note: `Adding 1 to ~x carries through its trailing 1s and stops at bit ${t}. So <b>−x</b> agrees with x at bit ${t} and below, and is the opposite of x above it.`, vars: { "-x": neg, "as signed": S(neg, w) } });
        fr.push({ w, ...R([{ ...base }, { name: "−x", u: neg }, { name: "x & −x", u: r, res: true, cls: (p) => (bit(r, p) ? "done" : "") }]), line: 2, note: `The only column where both are 1 is bit ${t}: x &amp; −x = <b>${r}</b>. Fenwick trees use exactly this to jump: <code>i += i &amp; −i</code>.`, vars: { "x & -x": r } });
      } else if (o === 2) {
        const y = U(x + 1, w), r = OR(x, y), z = ones(x);
        assert(r === (z >= w ? x : x + 2 ** z), "set lowest 0");
        fr.push({ w, ...R([{ ...base, cls: (p) => (p === z ? "active" : p < z ? "visit" : "") }]), line: [], note: z >= w ? "x is all ones: there is no 0 bit to set." : `x = ${x}; its lowest 0 is bit ${z}${z ? `, under it ${z} trailing 1${z > 1 ? "s" : ""}` : ""}.`, vars: { x, "lowest 0 at": z >= w ? "none" : z } });
        fr.push({ w, ...R([{ ...base }, { name: "x + 1", u: y, cls: (p) => (p <= z ? "visit" : "") }]), line: 0, note: `Adding 1 carries: trailing 1s become 0s and the lowest 0 becomes 1 (the mirror of the borrow in x − 1).`, vars: { "x + 1": y } });
        fr.push({ w, ...R([{ ...base }, { name: "x + 1", u: y }, { name: "x | (x+1)", u: r, res: true, cls: (p) => (p === z ? "active" : bit(r, p) ? "done" : "") }]), line: 1, note: `OR keeps every 1 of x and adds the new 1 at bit ${z}: result <b>${r}</b>.`, vars: { r } });
      } else if (o >= 3 && o <= 5) {
        const m = o === 4 ? U(~(2 ** i), w) : 2 ** i, r = o === 3 ? OR(x, m) : o === 4 ? AND(x, m) : XOR(x, m);
        const ref = o === 3 ? (bit(x, i) ? x : x + 2 ** i) : o === 4 ? (bit(x, i) ? x - 2 ** i : x) : (bit(x, i) ? x - 2 ** i : x + 2 ** i);
        assert(r === ref, "single bit op");
        const verb = ["set", "clear", "toggle"][o - 3];
        fr.push({ w, ...R([{ ...base, cls: (p) => (p === i ? "active" : "") }]), line: [], note: `x = ${x}; bit ${i} is currently ${bit(x, i)}. We want to ${verb} it and leave every other bit alone.`, vars: { x, i, [`bit ${i}`]: bit(x, i) } });
        fr.push({ w, ...R([{ ...base, cls: (p) => (p === i ? "active" : "") }, { name: o === 4 ? "~(1 << i)" : "1 << i", u: m, cls: (p) => (p === i ? "active" : "") }]), line: 0, note: o === 4 ? `The mask is all ones except a 0 at bit ${i}. AND with 1 keeps a bit; AND with 0 forces it to 0.` : `The mask has a single 1 at bit ${i}. ${o === 3 ? "OR with 0 keeps a bit; OR with 1 forces it to 1." : "XOR with 0 keeps a bit; XOR with 1 flips it."}`, vars: { mask: m } });
        fr.push({ w, ...R([{ ...base }, { name: o === 4 ? "mask" : "1 << i", u: m }, { name: "result", u: r, res: true, cls: (p) => (p === i ? (bit(r, i) ? "done" : "bad") : "") }]), line: 1, note: `Only bit ${i} could change: it is now ${bit(r, i)}. Result <b>${r}</b>. ${o === 5 ? "Toggling twice gives x back, because XOR is its own inverse." : ""}`, vars: { r } });
      } else {
        const y = Math.floor(x / 2 ** i), r = y % 2;
        assert(r === bit(x, i), "test bit");
        fr.push({ w, ...R([{ ...base, cls: (p) => (p === i ? "active" : "") }]), line: [], note: `Is bit ${i} of x = ${x} set?`, vars: { x, i } });
        fr.push({ w, ...R([{ ...base, cls: (p) => (p === i ? "active" : p < i ? "bad" : "") }, { name: "x >> i", u: y, cls: (p) => (p === 0 ? "active" : "") }]), line: 0, note: `Shifting right by ${i} drops the ${i} low bits (red) and brings bit ${i} down to position 0.`, vars: { "x >> i": y } });
        fr.push({ w, ...R([{ ...base }, { name: "x >> i", u: y }, { name: "& 1", u: r, res: true, cls: (p) => (p === 0 ? "done" : "") }]), line: 1, note: `AND with 1 keeps only position 0: the answer is <b>${r}</b>. Equivalent test: <code>x &amp; (1 &lt;&lt; i) != 0</code> (compare with 0, not with 1).`, vars: { [`bit ${i}`]: r } });
      }
      return fr;
    },
    render: (f) => col(regs(f.w, f.rows.map((r) => reg(r.name, r.u, f.w, { row: r.res ? "res" : "", cls: r.cls, signed: false }))), f.extra),
  }));

  /* ================= 3. Kernighan popcount ================= */
  const PC_CODE = ["count = 0", "while x:", "    x &= x - 1      # clear the lowest set bit", "    count += 1", "return count        # one loop per 1 bit, not per bit"];
  Viz.register("bit-manipulation-popcount", (el) => Viz.player(el, {
    title: "Kernighan's popcount: one iteration per 1 bit",
    tag: "POPCOUNT · O(number of 1s)",
    legend: [["accent", "a 1 bit"], ["active", "lowest 1 (about to go)"], ["bad", "already removed"], ["done", "count"]],
    codeLang: "python",
    code: PC_CODE,
    speed: 900,
    inputs: [{ key: "x", label: "x (0 … 65535)", value: "0b1011000010100000", width: 170 }],
    random: () => ({ x: String(Viz.rand(0, 65535)) }),
    build: ({ x: xs }) => {
      const w = 16, x0 = parseNum(xs, w, "x", { signed: false }), fr = [], gone = [];
      let x = x0, count = 0;
      fr.push({ x, x0, y: null, gone: [], count, line: 0, note: `x = ${x0}. A naive loop checks all 16 bits (or bit_length(x) = ${x0.toString(2).replace(/^0+/, "").length || 0} of them). Kernighan's loop runs once per <b>1 bit</b>.`, vars: { x, count } });
      while (x) {
        const t = lowP(x), y = U(x - 1, w), nx = AND(x, y);
        fr.push({ x, x0, y, gone: gone.slice(), t, count, line: [1, 2], note: `x − 1 flips bit ${t} (the lowest 1) and the zeros under it. AND with x wipes all of those: only bit ${t} actually changes.`, vars: { x, "x - 1": y, count } });
        gone.push(t); x = nx; count++;
        fr.push({ x, x0, y: null, gone: gone.slice(), count, line: 3, note: `Bit ${t} removed; count = ${count}. ${x ? `x = ${x} still has ${pop(x)} one${pop(x) === 1 ? "" : "s"}.` : "x is 0: done."}`, vars: { x, count } });
      }
      assert(count === pop(x0), "popcount");
      fr.push({ x, x0, y: null, gone: gone.slice(), count, line: 4, final: true, note: `popcount(${x0}) = <b>${count}</b> after ${count} iteration${count === 1 ? "" : "s"}. Built-ins do this in one CPU instruction: Python <code>x.bit_count()</code> (3.10+), C# <code>BitOperations.PopCount((uint)x)</code> or <code>int.PopCount(x)</code>.`, vars: { count } });
      return fr;
    },
    render: (f) => {
      const rows = [reg("original x", f.x0, 16, { signed: false, cls: (p) => (f.gone.includes(p) ? "bad" : "") }), reg("x", f.x, 16, { signed: false, cls: (p) => (p === f.t ? "active" : "") })];
      if (f.y !== null) rows.push(reg("x − 1", f.y, 16, { signed: false, cls: (p) => (p <= f.t ? "visit" : "") }), reg("x & (x − 1)", AND(f.x, f.y), 16, { row: "res", signed: false }));
      return col(regs(16, rows), `<div class="bm-eq">count = ${f.count}${f.gone.length ? ` <span class="muted">removed bits ${f.gone.join(", ")}</span>` : ""}</div>`);
    },
  }));

  /* ================= 4. Counting bits DP ================= */
  const CB_RULES = ["dp[i >> 1] + (i & 1)", "dp[i & (i - 1)] + 1", "dp[i - msb] + 1"];
  const CB_CODE = {
    0: ["dp = [0] * (n + 1)", "for i in range(1, n + 1):", "    dp[i] = dp[i >> 1] + (i & 1)   # i without its last bit, plus that bit", "return dp"],
    1: ["dp = [0] * (n + 1)", "for i in range(1, n + 1):", "    dp[i] = dp[i & (i - 1)] + 1    # i without its lowest 1, plus one", "return dp"],
    2: ["dp, msb = [0] * (n + 1), 1", "for i in range(1, n + 1):", "    if i == msb * 2: msb *= 2       # new highest power of two", "    dp[i] = dp[i - msb] + 1         # i without its top bit, plus one", "return dp"],
  };
  Viz.register("bit-manipulation-counting-bits", (el) => Viz.player(el, {
    title: "Counting bits for 0…n: every answer reuses a smaller one",
    tag: "DP ON BITS · O(n)",
    legend: [["active", "i"], ["visit", "the smaller number it reuses"], ["done", "filled"], ["accent", "a 1 bit"]],
    codeLang: "python",
    code: pad(CB_CODE[2], 5),
    speed: 800,
    inputs: [
      { key: "n", label: "n (1 … 32)", value: "13", width: 70 },
      { key: "rule", label: "recurrence", type: "select", value: CB_RULES[0], options: CB_RULES },
    ],
    random: () => ({ n: String(Viz.rand(5, 32)), rule: CB_RULES[Viz.rand(0, 2)] }),
    build: ({ n: ns, rule }) => {
      const n = int(ns, 1, 32, "n"), o = CB_RULES.indexOf(rule), fr = [], dp = Array(n + 1).fill(null);
      setCode(el, CB_CODE[o]);
      dp[0] = 0;
      fr.push({ dp: dp.slice(), i: null, src: null, line: 0, note: `dp[i] = number of 1 bits in i. dp[0] = 0. Every i &gt; 0 is a <b>smaller</b> number with one bit added, so its answer is that number's answer plus 0 or 1: a DP whose "subproblem" is a bit operation.`, vars: { n } });
      let msb = 1;
      for (let i = 1; i <= n; i++) {
        let src, add, why;
        if (o === 0) { src = i >> 1; add = i & 1; why = `i &gt;&gt; 1 = ${src} is i without its last bit; the last bit is ${add}`; }
        else if (o === 1) { src = i & (i - 1); add = 1; why = `i &amp; (i − 1) = ${src} is i with its lowest 1 removed`; }
        else { if (i === msb * 2) msb *= 2; src = i - msb; add = 1; why = `msb = ${msb} is the highest power of two ≤ i, and i − msb = ${src} is i without its top bit`; }
        dp[i] = dp[src] + add;
        assert(dp[i] === pop(i), "counting bits");
        fr.push({ dp: dp.slice(), i, src, msb, add, line: o === 2 ? [2, 3] : 2, note: `i = ${i} = ${bin(i, 6)}: ${why}. dp[${i}] = dp[${src}] + ${add} = ${dp[src]} + ${add} = <b>${dp[i]}</b>.`, vars: { i, source: src, "dp[i]": dp[i] } });
      }
      fr.push({ dp: dp.slice(), i: null, src: null, line: o === 2 ? 4 : 3, note: `All n + 1 answers in O(n), with no per-number loop. The source is always smaller than i, so filling left to right works. Each recurrence is a different way to name "a smaller number that differs by one bit".`, vars: { "dp[n]": dp[n] } });
      return fr;
    },
    render: (f) => {
      const arr = Viz.array(f.dp, { label: "dp[i] = popcount(i)", cls: (j, v) => (j === f.i ? "active" : j === f.src ? "visit" : v === null ? "dim" : "done") });
      if (f.i === null) return col(arr);
      return col(arr, regs(6, [reg("i", f.i, 6, { signed: false }), reg("source", f.src, 6, { signed: false, cls: (p) => (bit(f.i, p) !== bit(f.src, p) ? "active" : "") })]));
    },
  }));

  /* ================= 5. Single Number I, II, III ================= */
  const SN_MODES = ["I: the rest appear twice", "II: the rest appear three times", "III: two singles, the rest twice"];
  const SN_CODE = {
    0: ["acc = 0", "for x in nums:", "    acc ^= x            # a ^ a = 0, a ^ 0 = a: pairs cancel", "return acc"],
    1: ["res = 0", "for b in range(32):", "    c = sum((x >> b) & 1 for x in nums)   # ones in column b", "    if c % 3: res |= 1 << b              # triples leave 0", "return res   # (signed fix-up for negatives: see below)"],
    2: ["x = 0", "for v in nums: x ^= v       # x = a ^ b (pairs cancel)", "d = x & -x                   # a bit where a and b differ", "a = b = 0", "for v in nums:", "    if v & d: a ^= v         # group with the bit", "    else:     b ^= v         # group without it", "return [a, b]"],
  };
  const SN_SAMPLES = ["5,9,12,9,5", "6,3,6,9,3,6,3", "5,9,12,9,5,7"];
  Viz.register("bit-manipulation-single", (el) => Viz.player(el, {
    title: "Single Number I, II, III: XOR cancels pairs, counting mod 3 cancels triples",
    tag: "XOR · BIT COUNTING",
    legend: [["active", "current number / column"], ["accent", "a 1 bit"], ["visit", "group with bit d"], ["path", "group without bit d"], ["done", "answer bits"]],
    codeLang: "python",
    code: pad(SN_CODE[2], 8),
    speed: 900,
    inputs: [
      { key: "nums", label: "nums (0 … 255)", value: "5,9,12,9,5", width: 220 },
      { key: "mode", label: "problem", type: "select", value: SN_MODES[0], options: SN_MODES },
    ],
    random: () => {
      const m = Viz.rand(0, 2), pool = [...new Set(Viz.randInts(8, 0, 63))], rep = m === 1 ? 3 : 2;
      const singles = m === 2 ? 2 : 1, kinds = Math.min(pool.length - singles, Viz.rand(1, m === 1 ? 3 : 4));
      let a = [];
      for (let k = 0; k < kinds; k++) for (let r = 0; r < rep; r++) a.push(pool[k]);
      for (let k = 0; k < singles; k++) a.push(pool[kinds + k]);
      a = a.sort(() => Math.random() - 0.5);
      return { nums: a.join(","), mode: SN_MODES[m] };
    },
    build: ({ nums: s, mode }) => {
      const o = SN_MODES.indexOf(mode), w = 8, fr = [];
      if (SN_SAMPLES.includes(String(s).replace(/\s/g, ""))) s = SN_SAMPLES[o];   /* switching problems swaps in a matching sample */
      const a = nums(s, { min: 1, max: 13, what: "Numbers" });
      setCode(el, SN_CODE[o]);
      const cnt = new Map(); a.forEach((x) => cnt.set(x, (cnt.get(x) || 0) + 1));
      const rep = o === 1 ? 3 : 2, single = [...cnt].filter(([, c]) => c === 1).map(([x]) => x);
      const okShape = [...cnt.values()].every((c) => c === 1 || c === rep) && single.length === (o === 2 ? 2 : 1);
      if (!okShape) throw new Error(o === 0 ? "Every number must appear twice except exactly one." : o === 1 ? "Every number must appear three times except exactly one." : "Exactly two numbers must appear once; every other number twice.");
      const base = { a, mode: o };
      if (o === 0) {
        let acc = 0;
        fr.push({ ...base, cur: -1, acc, line: 0, note: `XOR is addition without carry, column by column. A number XOR itself is 0, XOR 0 changes nothing, and the order does not matter. So the pairs cancel, wherever they are.`, vars: { acc } });
        a.forEach((x, k) => {
          acc ^= x;
          fr.push({ ...base, cur: k, acc, line: [1, 2], note: `acc ^= ${x}: every column where ${x} has a 1 flips. ${cnt.get(x) === 2 ? (a.indexOf(x) === k ? `${x} appears again later and will flip the same columns back.` : `This is the second ${x}: it undoes the first one.`) : `${x} appears once: its bits stay.`}`, vars: { x, acc } });
        });
        assert(acc === single[0], "single I");
        fr.push({ ...base, cur: -1, acc, final: true, line: 3, note: `Every pair cancelled; what remains is the single number <b>${acc}</b>. O(n) time, O(1) space.`, vars: { answer: acc } });
      } else if (o === 1) {
        let res = 0;
        fr.push({ ...base, colP: null, res, upto: -1, line: 0, note: `XOR cannot cancel triples (x ^ x ^ x = x). Count instead: in each column, the tripled numbers contribute a multiple of 3 ones. Whatever is left after <b>mod 3</b> belongs to the single number.`, vars: { res } });
        for (let p = 0; p < w; p++) {
          const c = a.reduce((t, x) => t + bit(x, p), 0);
          if (c % 3) res += 2 ** p;
          fr.push({ ...base, colP: p, c, res, upto: p, line: [2, 3], note: `Column ${p}: ${c} one${c === 1 ? "" : "s"}. ${c} mod 3 = ${c % 3}, so bit ${p} of the answer is <b>${c % 3}</b>.`, vars: { b: p, ones: c, "c % 3": c % 3, res } });
        }
        assert(res === single[0], "single II");
        fr.push({ ...base, colP: null, res, upto: w - 1, final: true, line: 4, note: `Answer <b>${res}</b>. With 32-bit inputs the column count is 32 · n. A constant-space automaton (<code>ones</code>/<code>twos</code>) does the same counting mod 3 for all columns at once; see the code below the visualizer. In Python, if bit 31 ends up set, subtract 2<sup>32</sup> to get the negative answer.`, vars: { answer: res } });
      } else {
        let x = 0;
        fr.push({ ...base, stage: 0, cur: -1, x, line: 0, note: `Two singles a and b. XOR of everything gives a ^ b, which is not enough by itself. But a ≠ b, so a ^ b has at least one 1 bit: a column where <b>a and b differ</b>.`, vars: { x } });
        a.forEach((v, k) => { x ^= v; fr.push({ ...base, stage: 0, cur: k, x, line: 1, note: `x ^= ${v} → ${x}.`, vars: { v, x } }); });
        const d = x & -x, dp = lowP(d);
        fr.push({ ...base, stage: 1, x, d, dp, line: 2, note: `x = a ^ b = ${x}. Its lowest 1 is bit ${dp}: d = x &amp; −x = ${d}. One single has bit ${dp} set, the other does not.`, vars: { x, d } });
        let ga = 0, gb = 0;
        fr.push({ ...base, stage: 2, x, d, dp, ga, gb, line: [4, 5, 6], note: `Split all numbers by bit ${dp}. The two singles land in different groups. Both copies of every pair land in the <b>same</b> group (same number, same bit), so each group is a Single Number I problem.`, vars: { d } });
        a.forEach((v, k) => { if (v & d) ga ^= v; else gb ^= v; fr.push({ ...base, stage: 2, cur: k, x, d, dp, ga, gb, line: v & d ? 5 : 6, note: `${v} has bit ${dp} = ${bit(v, dp)}: XOR it into ${v & d ? "a" : "b"}.`, vars: { v, a: ga, b: gb } }); });
        assert([ga, gb].sort((p, q) => p - q).join() === single.sort((p, q) => p - q).join(), "single III");
        fr.push({ ...base, stage: 2, x, d, dp, ga, gb, final: true, line: 7, note: `The groups give <b>a = ${ga}</b> and <b>b = ${gb}</b>. Two passes, O(1) space. In C#, <code>x &amp; -x</code> overflows nothing even for int.MinValue (it returns int.MinValue itself).`, vars: { a: ga, b: gb } });
      }
      return fr;
    },
    render: (f) => {
      const w = 8, rows = [];
      if (f.mode === 0) {
        f.a.forEach((x, k) => rows.push(reg(`nums[${k}]`, x, w, { signed: false, row: k > f.cur && !f.final ? "faded" : "", cls: () => (k === f.cur ? "active" : "") })));
        rows.push(reg("acc", f.acc, w, { row: "res", signed: false, cls: (p) => (f.final && bit(f.acc, p) ? "done" : "") }));
        return col(regs(w, rows));
      }
      if (f.mode === 1) {
        f.a.forEach((x, k) => rows.push(reg(`nums[${k}]`, x, w, { signed: false, cls: (p) => (p === f.colP ? "active" : "") })));
        const counts = range(w).map((k) => { const p = w - 1 - k; return a2c(f.a, p); });
        rows.push(`<div class="bm-reg res"><span class="bm-lbl">ones in column</span><span class="bm-cells">${counts.map((c, k) => { const p = w - 1 - k; return `<span class="bm-b ${p === f.colP ? "active" : p <= f.upto ? "visit" : ""} ${p % 4 === 3 && k ? "nib" : ""}">${c}</span>`; }).join("")}</span><span class="bm-val muted">mod 3 ↓</span></div>`);
        rows.push(reg("res", f.res, w, { signed: false, blank: (p) => p > f.upto, cls: (p) => (p === f.colP ? "active" : bit(f.res, p) ? "done" : ""), val: f.final ? undefined : "" }));
        return col(regs(w, rows, (p) => p === f.colP));
      }
      f.a.forEach((v, k) => rows.push(reg(`nums[${k}]`, v, w, { signed: false, row: f.stage === 2 ? (v & f.d ? "grp-a" : "grp-b") : "", cls: (p) => (k === f.cur ? "active" : f.stage >= 1 && p === f.dp ? (f.stage === 2 ? (v & f.d ? "visit" : "path") : "active") : "") })));
      rows.push(reg("x = a ^ b", f.x, w, { row: "res", signed: false, cls: (p) => (f.stage >= 1 && p === f.dp ? "active" : "") }));
      if (f.stage >= 1) rows.push(reg("d = x & −x", f.d, w, { signed: false, cls: (p) => (p === f.dp ? "active" : "") }));
      if (f.stage === 2) rows.push(reg("a (bit d = 1)", f.ga, w, { signed: false, row: "grp-a", cls: () => (f.final ? "done" : "") }), reg("b (bit d = 0)", f.gb, w, { signed: false, row: "grp-b", cls: () => (f.final ? "done" : "") }));
      return col(regs(w, rows, (p) => f.stage >= 1 && p === f.dp));
    },
  }));
  const a2c = (a, p) => a.reduce((t, x) => t + bit(x, p), 0);

  /* ================= 6. Reverse bits ================= */
  const RB_METHODS = ["loop: move one bit per step", "divide & conquer: swap halves, then quarters …"];
  const RB_CODE = {
    0: ["res = 0", "for _ in range(w):", "    res = (res << 1) | (n & 1)   # push n's lowest bit into res", "    n >>= 1                       # and drop it from n", "return res"],
    1: ["# masks of alternating blocks of s ones, e.g. s = 2: ...00110011", "for s in (w // 2, w // 4, ..., 1):", "    m = block_mask(w, s)", "    n = ((n >> s) & m) | ((n & m) << s)   # swap neighbouring blocks", "return n"],
  };
  const blockMask = (w, s) => { let m = 0; for (let p = 0; p < w; p++) if (Math.floor(p / s) % 2 === 0) m += 2 ** p; return m; };
  Viz.register("bit-manipulation-reverse", (el) => Viz.player(el, {
    title: "Reverse bits: one bit at a time, or log w block swaps",
    tag: "REVERSE · O(w) OR O(log w)",
    legend: [["active", "bit being moved"], ["visit", "left block of a pair"], ["path", "right block of a pair"], ["done", "placed"]],
    codeLang: "python",
    code: RB_CODE[0],
    speed: 800,
    inputs: [
      { key: "n", label: "n", value: "0b10110010", width: 150 },
      { key: "w", label: "width w", type: "select", value: "8", options: ["8", "16", "32"] },
      { key: "method", label: "method", type: "select", value: RB_METHODS[0], options: RB_METHODS },
    ],
    random: () => { const w = [8, 16, 32][Viz.rand(0, 2)]; return { n: String(Math.floor(Math.random() * 2 ** w)), w: String(w), method: RB_METHODS[Viz.rand(0, 1)] }; },
    build: ({ n: ns, w: ws, method }) => {
      const w = Number(ws), n0 = parseNum(ns, w, "n", { signed: false }), o = RB_METHODS.indexOf(method), fr = [];
      setCode(el, RB_CODE[o]);
      const want = parseInt(bin(n0, w).split("").reverse().join(""), 2);
      if (o === 0) {
        let n = n0, res = 0;
        fr.push({ w, n, res, n0, k: 0, line: 0, note: `Reverse the ${w}-bit pattern of n = ${n0}. Bit 0 must end up at bit ${w - 1}, bit 1 at bit ${w - 2}, and so on. Popping bits off the bottom of n and pushing them onto the bottom of res does exactly that, like reversing a stack.`, vars: { n, res } });
        for (let k = 0; k < w; k++) {
          const b = n % 2;
          res = res * 2 + b; n = Math.floor(n / 2);
          fr.push({ w, n, res, n0, k: k + 1, b, line: [2, 3], note: `Step ${k + 1}: n's lowest bit is ${b}. Shift res left and put it in res's bit 0. After all ${w} steps this bit will have moved up to bit ${w - 1 - k}.`, vars: { step: k + 1, bit: b, n, res } });
        }
        assert(res === want, "reverse loop");
        fr.push({ w, n, res, n0, k: w, final: true, line: 4, note: `Result <b>${res}</b> = ${nib(bin(res, w))}. O(w) steps. Run it on many numbers and cache answers per byte (256-entry table) to cut it to w/8 lookups.`, vars: { res } });
      } else {
        let n = n0;
        fr.push({ w, n, n0, s: null, line: 0, note: `Reversing = swapping the two halves, then swapping the two halves inside each half, and so on down to single bits. Each level is two masks, two shifts and an OR, so ${Math.log2(w)} levels reverse ${w} bits.`, vars: { n } });
        for (let s = w / 2; s >= 1; s /= 2) {
          const m = blockMask(w, s), next = OR(Math.floor(AND(n, U(m * 2 ** s, w)) / 2 ** s), U(AND(n, m) * 2 ** s, w));
          fr.push({ w, n, n0, s, m, next: null, line: [1, 2], note: `Level s = ${s}: pair up neighbouring blocks of ${s} bit${s > 1 ? "s" : ""}. m = ${hex(m, w)} selects the right block of each pair.`, vars: { s, m: hex(m, w) } });
          fr.push({ w, n, n0, s, m, next, line: 3, note: `(n &gt;&gt; ${s}) &amp; m moves every left block right; (n &amp; m) &lt;&lt; ${s} moves every right block left. OR combines them: every pair is swapped at once.`, vars: { s, n: hex(next, w) } });
          n = next;
        }
        assert(n === want, "reverse d&c");
        fr.push({ w, n, n0, s: null, final: true, line: 4, note: `Result <b>${n}</b> = ${nib(bin(n, w))}, the same as the loop, in ${Math.log2(w)} steps. Compilers and the CPU's own bit-reverse instructions use this trick.`, vars: { res: n } });
      }
      return fr;
    },
    render: (f) => {
      const w = f.w, rows = [];
      if (f.k !== undefined) {
        rows.push(reg("original", f.n0, w, { signed: false, cls: (p) => (p < f.k ? "dim" : "") }));
        rows.push(reg("n", f.n, w, { signed: false, blank: (p) => p >= w - f.k, cls: (p) => (p === 0 && !f.final ? "active" : "") }));
        rows.push(reg("res", f.res, w, { row: "res", signed: false, blank: (p) => p >= f.k, cls: (p) => (p === 0 && f.k && !f.final ? "active" : p < f.k ? "done" : "") }));
        return col(regs(w, rows));
      }
      const blockCls = (p) => (f.s ? (Math.floor(p / f.s) % 2 ? "visit" : "path") : "");
      rows.push(reg("n", f.n, w, { signed: false, cls: blockCls }));
      if (f.s) rows.push(reg("m", f.m, w, { signed: false, cls: (p) => (bit(f.m, p) ? "path" : "") }));
      if (f.next !== null && f.next !== undefined) rows.push(reg("swapped", f.next, w, { row: "res", signed: false, cls: (p) => (Math.floor(p / f.s) % 2 ? "path" : "visit") }));
      if (f.final) rows.push(reg("original", f.n0, w, { row: "faded", signed: false }));
      return col(regs(w, rows));
    },
  }));

  /* ================= 7. Add without + : the carry loop ================= */
  const AD_CODE = ["mask = (1 << w) - 1", "while b:", "    carry = ((a & b) << 1) & mask   # both 1: a carry into the next column", "    a = (a ^ b) & mask              # add every column, ignoring carries", "    b = carry                       # now add the carries", "return a - (1 << w) if a >> (w - 1) else a   # back to signed"];
  Viz.register("bit-manipulation-add", (el) => Viz.player(el, {
    title: "Sum of two integers without +: XOR adds, AND finds the carries",
    tag: "CARRY LOOP · ≤ w + 1 ROUNDS",
    legend: [["accent", "a 1 bit"], ["active", "columns that carry"], ["visit", "carries, moved one column left"], ["done", "final sum"]],
    codeLang: "python",
    code: AD_CODE,
    speed: 1000,
    inputs: [
      { key: "a", label: "a", value: "23", width: 90 },
      { key: "b", label: "b", value: "-9", width: 90 },
      { key: "w", label: "width w", type: "select", value: "8", options: ["8", "16", "32"] },
    ],
    random: () => { const w = [8, 8, 16, 32][Viz.rand(0, 3)], r = () => Viz.rand(-(2 ** (w - 2)), 2 ** (w - 2)); return { a: String(r()), b: String(r()), w: String(w) }; },
    build: ({ a: as, b: bs, w: ws }) => {
      const w = Number(ws);
      let a = parseNum(as, w, "a"), b = parseNum(bs, w, "b");
      const a0 = a, b0 = b, fr = [];
      fr.push({ w, a, b, x: null, c: null, it: 0, line: 0, note: `a = ${S(a, w)}, b = ${S(b, w)} as ${w}-bit two's complement. Binary addition per column is 0+0 = 0, 1+0 = 1, 1+1 = 0 carry 1. The "0 carry 1" part is <b>XOR</b> for the digit and <b>AND</b> for the carry.`, vars: { a: S(a, w), b: S(b, w) } });
      let it = 0;
      while (b) {
        it++;
        const c = U(AND(a, b) * 2, w), x = XOR(a, b);
        fr.push({ w, a, b, x, c, it, line: [2, 3], note: `Round ${it}: a ^ b = ${S(x, w)} adds every column without carrying. a &amp; b marks the ${pop(AND(a, b))} column${pop(AND(a, b)) === 1 ? "" : "s"} with 1 + 1; each sends a carry one column left: (a &amp; b) &lt;&lt; 1 = ${c}.${AND(a, b) && bit(AND(a, b), w - 1) ? ` The carry out of bit ${w - 1} falls off the end, exactly like hardware overflow.` : ""}`, vars: { round: it, "a ^ b": S(x, w), carry: c } });
        a = x; b = c;
        fr.push({ w, a, b, x: null, c: null, it, line: 4, note: b ? `The true sum is now (a ^ b) + carry, so repeat with a = ${S(a, w)}, b = ${b}. Each round the carries move at least one column left, so it ends after at most ${w} rounds.` : `No carries left: the sum is complete.`, vars: { a: S(a, w), b } });
      }
      assert(a === U(S(a0, w) + S(b0, w), w), "carry add");
      fr.push({ w, a, b: 0, x: null, c: null, it, final: true, line: 5, note: `${S(a0, w)} + ${S(b0, w)} = <b>${S(a, w)}</b> after ${it} round${it === 1 ? "" : "s"}${S(a0, w) + S(b0, w) !== S(a, w) ? ` (the true sum ${S(a0, w) + S(b0, w)} overflowed ${w} bits and wrapped)` : ""}. In Python the mask is essential: with unbounded ints, a negative b would carry forever.`, vars: { sum: S(a, w) } });
      return fr;
    },
    render: (f) => {
      const w = f.w, rows = [reg("a", f.a, w, { signed: true, cls: (p) => (f.x !== null && bit(f.a, p) && bit(f.b, p) ? "active" : f.final && bit(f.a, p) ? "done" : "") })];
      if (!f.final) rows.push(reg("b", f.b, w, { signed: true, cls: (p) => (f.x !== null && bit(f.a, p) && bit(f.b, p) ? "active" : "") }));
      if (f.x !== null) rows.push(reg("a ^ b", f.x, w, { row: "res", signed: true }), reg("(a & b) << 1", f.c, w, { signed: true, cls: (p) => (bit(f.c, p) ? "visit" : "") }));
      return col(regs(w, rows), `<div class="bm-eq">round ${f.it}${f.final ? ` · sum = ${S(f.a, w)}` : ""}</div>`);
    },
  }));

  /* ================= 8. Gray code: reflect-and-prefix, and the walk on the hypercube ================= */
  const GC_METHODS = ["reflect and prefix", "g = i ^ (i >> 1)"];
  const GC_CODE = {
    0: ["codes = [0]", "for k in range(n):", "    top = 1 << k", "    codes += [top | c for c in reversed(codes)]   # mirror, then set bit k", "return codes"],
    1: ["codes = []", "for i in range(1 << n):", "    g = i ^ (i >> 1)     # bit j of g: do bits j and j+1 of i differ?", "    codes.append(g)", "return codes"],
  };
  const cubePos = (v) => {
    const x = 30 + (v & 1 ? 120 : 0) + (v & 4 ? 62 : 0) + (v & 8 ? 270 : 0);
    const y = 120 + (v & 2 ? 120 : 0) - (v & 4 ? 62 : 0);
    return { x, y };
  };
  Viz.register("bit-manipulation-gray", (el) => Viz.player(el, {
    title: "Gray code: neighbours differ in exactly one bit, a walk on the hypercube",
    tag: "GRAY CODE · 2ⁿ CODES",
    legend: [["visit", "copied half"], ["path", "mirrored half with the new top bit"], ["active", "current code / the bit that flips"], ["done", "visited corner"]],
    codeLang: "python",
    code: GC_CODE[0],
    speed: 800,
    inputs: [
      { key: "n", label: "bits n (1 … 4)", value: "3", width: 70 },
      { key: "method", label: "method", type: "select", value: GC_METHODS[0], options: GC_METHODS },
    ],
    random: () => ({ n: String(Viz.rand(1, 4)), method: GC_METHODS[Viz.rand(0, 1)] }),
    build: ({ n: ns, method }) => {
      const n = int(ns, 1, 4, "n"), o = GC_METHODS.indexOf(method), fr = [];
      setCode(el, GC_CODE[o]);
      let codes = [0];
      const ref = range(2 ** n).map((i) => i ^ (i >> 1));
      if (o === 0) {
        fr.push({ n, codes: codes.slice(), k: -1, walk: 0, line: 0, note: `Start with the 0-bit Gray code: one empty code, written 0. Each round doubles the list while keeping the one-bit-change property.`, vars: { codes: "[0]" } });
        for (let k = 0; k < n; k++) {
          const half = codes.length;
          codes = codes.concat(codes.slice().reverse().map((c) => c | (1 << k)));
          fr.push({ n, codes: codes.slice(), k, half, walk: 0, line: [2, 3], note: `Round ${k + 1}: copy the list (blue), then append it <b>reversed</b> with bit ${k} set (green). Inside each half, neighbours still differ in one bit. At the seam the two codes are the same code except bit ${k}, because the mirror puts equal codes next to each other.`, vars: { k, size: codes.length } });
        }
      } else {
        codes = [];
        for (let i = 0; i < 2 ** n; i++) {
          const g = i ^ (i >> 1);
          codes.push(g);
          fr.push({ n, codes: codes.slice(), i, g, walk: 0, line: [2, 3], note: `i = ${i} = ${bin(i, n)}, i &gt;&gt; 1 = ${bin(i >> 1, n)}, XOR = <b>${bin(g, n)}</b>. Bit j of g says whether bits j and j+1 of i differ. Counting i → i+1 flips a run of trailing bits, but only one adjacent pair changes its "differ" status.`, vars: { i, "i >> 1": i >> 1, g } });
        }
      }
      assert(codes.join() === ref.join(), "gray code");
      for (let j = 1; j < codes.length; j++) assert(pop(codes[j] ^ codes[j - 1]) === 1, "one-bit steps");
      for (let t = 1; t <= codes.length; t++) {
        const flip = t < codes.length ? lowP(codes[t] ^ codes[t - 1]) : null;
        fr.push({ n, codes: codes.slice(), walk: t, flip, line: 4, note: t < codes.length ? `Step ${t}: ${bin(codes[t - 1], n)} → ${bin(codes[t], n)} flips bit ${flip}: one edge of the ${n}-cube.` : `All ${codes.length} corners visited, each once: a Hamiltonian path on the ${n}-dimensional cube.${n > 1 ? ` The last code ${bin(codes[codes.length - 1], n)} differs from the first in one bit too, so it closes into a cycle.` : ""}`, vars: { step: t, code: t < codes.length ? bin(codes[t], n) : "done" } });
      }
      return fr;
    },
    render: (f) => {
      const n = f.n, N = f.codes.length, cur = f.walk ? f.codes[Math.min(f.walk, N - 1)] : f.g;
      const rows = f.codes.map((c, j) => reg(`codes[${j}]`, c, n, { signed: false, val: "", cls: (p) => (f.walk ? (j === f.walk && p === f.flip ? "active" : j < f.walk + 1 && j <= f.walk ? "done" : "") : f.k !== undefined && f.k >= 0 ? (p === f.k && j >= f.half ? "active" : p > f.k ? "dim" : j >= f.half ? "path" : "visit") : j === N - 1 && f.g !== undefined ? "active" : "") }));
      const list = `<div class="bm-regs">${rows.join("")}</div>`;
      const V = 2 ** n, seen = new Set(f.walk ? f.codes.slice(0, f.walk + 1) : f.codes);
      const used = new Set(); const upto = f.walk ? f.walk + 1 : N;
      for (let j = 1; j < Math.min(upto, N); j++) used.add(Math.min(f.codes[j], f.codes[j - 1]) + "-" + Math.max(f.codes[j], f.codes[j - 1]));
      const nodes = range(V).map((v) => ({ id: v, ...cubePos(v), label: bin(v, n) }));
      const edges = [];
      for (let v = 0; v < V; v++) for (let b = 0; b < n; b++) { const u = v ^ (1 << b); if (v < u) edges.push({ u: v, v: u, cls: used.has(v + "-" + u) ? "path" : "" }); }
      const g = Viz.graph({ nodes, edges }, { r: 22, nodeCls: (id) => (Number(id) === cur && (f.walk || f.g !== undefined) ? "active" : seen.has(Number(id)) ? "done" : "") , label: `${n}-cube: corners are codes, edges flip one bit` });
      return `<div class="v-row">${list}${g}</div>`;
    },
  }));

  /* ================= 9. Subsets as masks, submasks, Gosper's hack ================= */
  const SS_MODES = ["all subsets: mask = 0 … 2ⁿ − 1", "submasks: sub = (sub − 1) & mask", "k-subsets: Gosper's hack"];
  const SS_CODE = {
    0: ["for mask in range(1 << n):", "    subset = [items[i] for i in range(n) if mask >> i & 1]", "    visit(subset)"],
    1: ["sub = mask", "while True:", "    visit(sub)", "    if sub == 0: break", "    sub = (sub - 1) & mask   # next smaller submask"],
    2: ["x = (1 << k) - 1                # the smallest mask with k ones", "while x < (1 << n):", "    visit(x)", "    c = x & -x                  # lowest 1", "    r = x + c                   # carry moves the lowest block up", "    x = (((r ^ x) >> 2) // c) | r   # refill the rest at the bottom"],
  };
  const setTxt = (items, m) => `{${items.filter((_, i) => (m >> i) & 1).join(",")}}`;
  Viz.register("bit-manipulation-subsets", (el) => Viz.player(el, {
    title: "Subsets as numbers: masks, submasks and Gosper's hack",
    tag: "ENUMERATION · 2ⁿ, 2^popcount, C(n,k)",
    legend: [["accent", "item chosen (bit = 1)"], ["active", "bits that change"], ["done", "subsets produced"], ["dim", "outside the mask"]],
    codeLang: "python",
    code: pad(SS_CODE[2], 6),
    speed: 700,
    inputs: [
      { key: "items", label: "items (bit 0 first)", value: "a,b,c,d", width: 150 },
      { key: "mode", label: "enumerate", type: "select", value: SS_MODES[0], options: SS_MODES },
      { key: "mask", label: "mask (submasks)", value: "0b1101", width: 100 },
      { key: "k", label: "k (Gosper)", value: "2", width: 60 },
    ],
    random: () => { const n = Viz.rand(2, 5); return { items: "abcde".slice(0, n).split("").join(","), mode: SS_MODES[Viz.rand(0, 2)], mask: String(Viz.rand(1, 2 ** n - 1)), k: String(Viz.rand(1, n)) }; },
    build: ({ items: is, mode, mask: ms, k: ks }) => {
      const items = String(is).split(/[\s,]+/).filter(Boolean);
      if (items.length < 1 || items.length > 5) throw new Error("Use 1 to 5 items.");
      if (items.some((t) => !/^\w{1,3}$/.test(t))) throw new Error("Use short names: 1 to 3 letters or digits each.");
      const n = items.length, o = SS_MODES.indexOf(mode), fr = [], out = [];
      setCode(el, SS_CODE[o]);
      const base = { n, items };
      if (o === 0) {
        fr.push({ ...base, m: null, out: [], line: 0, note: `Item i ↔ bit i. Every number from 0 to 2<sup>${n}</sup> − 1 = ${2 ** n - 1} is a different on/off pattern, so counting is enumerating: ${2 ** n} subsets, no recursion.`, vars: { n } });
        for (let m = 0; m < 2 ** n; m++) {
          out.push(m);
          const ch = m ? lowP(m) : null;
          fr.push({ ...base, m, prev: m ? m - 1 : null, out: out.slice(), line: [1, 2], note: `mask = ${m} = ${bin(m, n)} → ${setTxt(items, m)}.${m ? ` From ${m - 1}, the +1 flipped bit${ch ? `s 0…${ch}` : " 0"}: binary counting.` : " The empty set."}`, vars: { mask: m, subset: setTxt(items, m) } });
        }
        assert(new Set(out).size === 2 ** n, "all subsets");
      } else if (o === 1) {
        const mask = parseNum(ms, n, "mask", { signed: false });
        let sub = mask;
        fr.push({ ...base, m: null, mask, out: [], line: 0, note: `mask = ${bin(mask, n)} = ${setTxt(items, mask)}. We want every subset of <b>that</b> set, ${2 ** pop(mask)} of them, without looping over all ${2 ** n}.`, vars: { mask } });
        for (;;) {
          out.push(sub);
          fr.push({ ...base, m: sub, mask, out: out.slice(), line: [2, 3], note: `Visit sub = ${bin(sub, n)} = ${setTxt(items, sub)}.`, vars: { sub } });
          if (sub === 0) break;
          const y = sub - 1, nx = y & mask;
          fr.push({ ...base, m: sub, mask, y, nx, out: out.slice(), line: 4, note: `sub − 1 = ${bin(y, n)}: the lowest 1 of sub turns off and the bits below it turn on. &amp; mask throws away the bits outside the mask, so we get the <b>next smaller</b> submask ${bin(nx, n)}. It is binary counting down, restricted to the mask's positions.`, vars: { "sub - 1": y, next: nx } });
          sub = nx;
        }
        const ref = range(2 ** n).filter((s) => (s & mask) === s).sort((p, q) => q - p);
        assert(out.join() === ref.join(), "submasks");
      } else {
        const k = int(ks, 0, n, "k");
        if (k === 0) throw new Error("Use k ≥ 1 (k = 0 has only the empty set).");
        let x = (1 << k) - 1;
        fr.push({ ...base, m: null, out: [], line: 0, note: `All subsets with exactly k = ${k} items, in increasing order of the mask: the smallest is the ${k} lowest bits, ${bin(x, n)}. There are C(${n}, ${k}) of them.`, vars: { k } });
        while (x < 2 ** n) {
          out.push(x);
          fr.push({ ...base, m: x, out: out.slice(), line: [1, 2], note: `Visit ${bin(x, n)} = ${setTxt(items, x)}.`, vars: { x } });
          const c = x & -x, r = x + c, nx = (((r ^ x) >> 2) / c) | r;
          if (r < 2 ** n) fr.push({ ...base, m: x, c, r, nx, out: out.slice(), line: [3, 4, 5], note: `c = x &amp; −x = ${bin(c, n)} (lowest 1). r = x + c = ${bin(r, n)}: the carry moves the lowest block of 1s up by one place, leaving one 1 there. (r ^ x) marks the changed bits; shifting by 2 and dividing by c drops them to the bottom as the fewest-needed 1s. OR gives ${bin(nx, n)}, the next mask with ${k} ones.`, vars: { c, r, next: nx } });
          x = nx;
        }
        const ref = range(2 ** n).filter((s) => pop(s) === k);
        assert(out.join() === ref.join(), "gosper");
      }
      fr.push({ ...base, m: null, mask: fr[fr.length - 1].mask, out: out.slice(), final: true, line: o === 0 ? 0 : 1, note: `${out.length} subsets: ${o === 0 ? `2<sup>${n}</sup>` : o === 1 ? `2<sup>popcount(mask)</sup>` : `C(${n}, ${fr[0].vars.k})`}. ${o === 1 ? "Over all masks, the submask loops cost 3ⁿ in total (each item is outside, in the mask only, or in the submask), which is what bitmask DP over subsets pays." : o === 2 ? "Gosper's hack is how you iterate fixed-size subsets without generating the others." : "This order is what iterative subset DP uses: every proper subset of a mask is a smaller number."}`, vars: { count: out.length } });
      return fr;
    },
    render: (f) => {
      const n = f.n, rows = [];
      const headCells = range(n).map((k) => `<span class="bm-b">${esc(f.items[n - 1 - k])}</span>`).join("");
      const hd = `<div class="bm-reg bm-head"><span class="bm-lbl">item</span><span class="bm-cells">${headCells}</span><span class="bm-val"></span></div>`;
      const inMask = (p) => f.mask === undefined || f.mask === null || (f.mask >> p) & 1;
      if (f.mask !== undefined && f.mask !== null) rows.push(reg("mask", f.mask, n, { signed: false, val: setTxt(f.items, f.mask) }));
      if (f.m !== null && f.m !== undefined) rows.push(reg(f.c !== undefined ? "x" : f.mask !== undefined && f.mask !== null ? "sub" : "mask", f.m, n, { signed: false, val: setTxt(f.items, f.m), cls: (p) => (!inMask(p) ? "dim" : f.prev !== undefined && f.prev !== null && bit(f.prev, p) !== bit(f.m, p) ? "active" : "") }));
      if (f.y !== undefined) rows.push(reg("sub − 1", f.y, n, { signed: false, val: "", cls: (p) => (!inMask(p) ? "dim" : "") }), reg("(sub−1) & mask", f.nx, n, { row: "res", signed: false, val: setTxt(f.items, f.nx), cls: (p) => (bit(f.nx, p) !== bit(f.y, p) ? "bad" : "") }));
      if (f.c !== undefined) rows.push(reg("c = x & −x", f.c, n, { signed: false, val: "" }), reg("r = x + c", f.r, n, { signed: false, val: "" }), reg("next", f.nx, n, { row: "res", signed: false, val: setTxt(f.items, f.nx), cls: (p) => (bit(f.nx, p) !== bit(f.m, p) ? "active" : "") }));
      const list = chips(f.out.map((m) => setTxt(f.items, m)), (i) => (i === f.out.length - 1 && !f.final ? "active" : "done"));
      return col(`<div class="bm-regs">${hd}${rows.join("")}</div>`, box(`produced (${f.out.length})`, list));
    },
  }));

  /* ================= 10. Maximum XOR of two numbers: greedy over prefixes ================= */
  const MX_CODE = ["ans = mask = 0", "for b in reversed(range(W)):", "    mask |= 1 << b", "    prefixes = {x & mask for x in nums}   # top bits of every number", "    cand = ans | 1 << b                    # try to make bit b a 1", "    if any(p ^ cand in prefixes for p in prefixes):", "        ans = cand                         # some pair reaches it", "return ans"];
  Viz.register("bit-manipulation-maxxor", (el) => Viz.player(el, {
    title: "Maximum XOR of two numbers: decide the answer one bit at a time",
    tag: "GREEDY ON BITS · O(n · W)",
    legend: [["accent", "a 1 bit"], ["active", "bit b being decided"], ["visit", "the pair that proves it"], ["dim", "bits not looked at yet"], ["done", "answer bits fixed"]],
    codeLang: "python",
    code: MX_CODE,
    speed: 1000,
    inputs: [{ key: "nums", label: "nums (0 … 63)", value: "3,10,5,25,2,8", width: 200 }],
    random: () => ({ nums: Viz.randInts(Viz.rand(2, 7), 0, 63).join(",") }),
    build: ({ nums: s }) => {
      const a = nums(s, { min: 2, max: 8, lo: 0, hi: 63, what: "Numbers" }), W = 6, fr = [];
      let ans = 0, mask = 0;
      fr.push({ a, W, b: W, ans, mask, line: 0, note: `A 1 in bit b is worth more than all lower bits together (2<sup>b</sup> &gt; 2<sup>b</sup> − 1). So decide the answer from the top bit down, and at each bit ask: can <b>some pair</b> agree with the bits fixed so far <b>and</b> have a 1 here?`, vars: { ans } });
      for (let b = W - 1; b >= 0; b--) {
        mask |= 1 << b;
        const pre = [...new Set(a.map((x) => x & mask))].sort((p, q) => p - q), cand = ans | (1 << b), set = new Set(pre);
        const p = pre.find((v) => set.has(v ^ cand));
        fr.push({ a, W, b, ans, mask, pre, cand, line: [2, 3, 4], note: `Bit ${b}: keep the top ${W - b} bits of every number (prefixes ${pre.map((v) => bin(v >> b, W - b)).join(", ")}). Candidate answer ${bin(cand >> b, W - b)}${"·".repeat(b)}. Two prefixes p, q reach it exactly when q = p ^ cand, a set lookup.`, vars: { b, cand: bin(cand, W), prefixes: pre.length } });
        if (p !== undefined) {
          const q = p ^ cand, i = a.findIndex((x) => (x & mask) === p), j = a.findIndex((x) => (x & mask) === q);
          ans = cand;
          fr.push({ a, W, b, ans, mask, pre, cand, pi: i, pj: j, ok: true, line: [5, 6], note: `Found: ${a[i]} and ${a[j]} have prefixes ${bin(p >> b, W - b)} and ${bin(q >> b, W - b)}, which XOR to the candidate. Bit ${b} of the answer is <b>1</b>.`, vars: { b, ans: bin(ans, W) } });
        } else fr.push({ a, W, b, ans, mask, pre, cand, ok: false, line: 5, note: `No prefix p has p ^ cand in the set: no pair can keep the bits above <b>and</b> get a 1 here. Bit ${b} of the answer stays <b>0</b>.`, vars: { b, ans: bin(ans, W) } });
      }
      let best = 0, bi = 0, bj = 0;
      for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if ((a[i] ^ a[j]) > best) { best = a[i] ^ a[j]; bi = i; bj = j; }
      assert(ans === best, "max xor");
      fr.push({ a, W, b: -1, ans, mask, pi: bi, pj: bj, ok: true, final: true, line: 7, note: `Maximum XOR = <b>${ans}</b> (${a[bi]} ^ ${a[bj]}), the same as checking all ${a.length * (a.length - 1) / 2} pairs. O(n · W) with a hash set; the <a href="tries.html">binary trie</a> answers the same question per number with one walk.`, vars: { answer: ans } });
      return fr;
    },
    render: (f) => {
      const W = f.W, rows = f.a.map((x, k) => reg(`nums[${k}]`, x, W, { signed: false, cls: (p) => (p < f.b ? "dim" : k === f.pi || k === f.pj ? "visit" : p === f.b ? "active" : "") }));
      if (f.cand !== undefined && !f.final) rows.push(reg("candidate", f.cand, W, { row: "res", signed: false, blank: (p) => p < f.b, val: "", cls: (p) => (p === f.b ? "active" : "") }));
      rows.push(reg("ans", f.ans, W, { row: f.cand === undefined || f.final ? "res" : "", signed: false, blank: (p) => p < f.b, cls: (p) => (p >= f.b && p < W ? "done" : "") }));
      const pre = f.pre ? box("prefixes (top bits)", chips(f.pre.map((v) => bin(v >> f.b, W - f.b)), (i) => { const v = f.pre[i]; return f.ok && f.pi !== undefined && ((f.a[f.pi] & f.mask) === v || (f.a[f.pj] & f.mask) === v) ? "visit" : ""; })) : "";
      return col(regs(W, rows, (p) => p === f.b), pre);
    },
  }));

  /* ================= 11. Bitset subset sum: one shift-OR per item ================= */
  const BS_CODE = ["reach = 1                    # bit s = 1  <=>  some subset sums to s", "for x in nums:", "    reach |= reach << x      # every old sum s also gives s + x", "return reach >> target & 1"];
  Viz.register("bit-manipulation-bitset", (el) => Viz.player(el, {
    title: "Bitsets: a whole DP row updated with one shift and one OR",
    tag: "BITSET DP · O(n · S / 64)",
    legend: [["accent", "reachable sum"], ["visit", "sums made new by this item"], ["active", "target"]],
    codeLang: "python",
    code: BS_CODE,
    speed: 1000,
    inputs: [
      { key: "nums", label: "nums (sum ≤ 40)", value: "3,5,9,4,7", width: 170 },
      { key: "target", label: "target", value: "14", width: 70 },
    ],
    random: () => { const a = Viz.randInts(Viz.rand(2, 6), 1, 9); const s = a.reduce((p, q) => p + q, 0); return { nums: a.join(","), target: String(Viz.rand(1, s)) }; },
    build: ({ nums: s, target: ts }) => {
      const a = nums(s, { min: 1, max: 8, lo: 1, hi: 20, what: "Numbers" }), S0 = a.reduce((p, q) => p + q, 0);
      if (S0 > 40) throw new Error("Keep the total at most 40 so the bitset fits on screen.");
      const T0 = int(ts, 0, S0, "target"), w = S0 + 1, fr = [];
      let reach = [1, ...Array(S0).fill(0)];
      fr.push({ w, reach: reach.slice(), T0, line: 0, note: `Bit s of <code>reach</code> answers "can some subset sum to s?". Before any item only s = 0 is possible. The ordinary DP loops over every s for every item; a bitset does all ${w} positions in one machine operation per 64 bits.`, vars: { reach: "1" } });
      a.forEach((x, k) => {
        const sh = reach.map((_, i) => (i >= x ? reach[i - x] : 0)), nx = reach.map((v, i) => v | sh[i]);
        fr.push({ w, reach: reach.slice(), sh, x, k, T0, line: [1, 2], note: `Item ${x}: shifting left by ${x} moves every reachable sum s to s + ${x}. That is the "take it" branch for all sums at once.`, vars: { x } });
        fr.push({ w, reach: nx.slice(), sh, old: reach.slice(), x, k, T0, line: 2, note: `OR with the old row is the "skip it" branch. New sums: ${nx.map((v, i) => (v && !reach[i] ? i : null)).filter((v) => v !== null).join(", ") || "none"}. Python ints are bitsets of any length; C# uses <code>ulong[]</code> or <code>BitArray</code>.`, vars: { x, reachable: nx.reduce((p, q) => p + q, 0) } });
        reach = nx;
      });
      const sums = new Set([0]); for (const x of a) for (const v of [...sums]) sums.add(v + x);
      range(w).forEach((i) => assert(!!reach[i] === sums.has(i), "bitset subset sum"));
      fr.push({ w, reach: reach.slice(), T0, final: true, line: 3, note: `Target ${T0}: bit ${T0} is <b>${reach[T0]}</b>, so ${reach[T0] ? "some subset sums to it" : "no subset sums to it"}. Cost O(n · S / 64) word operations instead of O(n · S) cell updates: a 64× speed-up for Partition Equal Subset Sum and its relatives.`, vars: { [`reach[${T0}]`]: reach[T0] } });
      return fr;
    },
    render: (f) => {
      const w = f.w, row = (lbl, bits, cls) => `<div class="bm-reg"><span class="bm-lbl">${esc(lbl)}</span><span class="bm-set">${range(w).map((k) => { const i = w - 1 - k; return `<span class="bm-b ${bits[i] ? "on" : ""} ${cls(i)}">${bits[i]}</span>`; }).join("")}</span><span class="bm-val"></span></div>`;
      const idx = `<div class="bm-reg"><span class="bm-lbl">sum s</span><span class="bm-idx">${range(w).map((k) => `<span>${w - 1 - k}</span>`).join("")}</span><span class="bm-val"></span></div>`;
      const rows = [idx];
      if (f.old) rows.push(row("old reach", f.old, () => ""));
      else rows.push(row("reach", f.reach, (i) => (f.final && i === f.T0 ? "active" : "")));
      if (f.sh) rows.push(row(`reach << ${f.x}`, f.sh, (i) => (f.sh[i] ? "visit" : "")));
      if (f.old) rows.push(`<div class="bm-reg res"><span class="bm-lbl">reach | shifted</span><span class="bm-set">${range(w).map((k) => { const i = w - 1 - k; return `<span class="bm-b ${f.reach[i] ? "on" : ""} ${f.reach[i] && !f.old[i] ? "visit" : ""}">${f.reach[i]}</span>`; }).join("")}</span><span class="bm-val"></span></div>`);
      return col(`<div class="bm-regs">${rows.join("")}</div>`, `<div class="bm-eq">target ${f.T0}: ${f.reach[f.T0] ? "reachable" : "not reachable (yet)"}</div>`);
    },
  }));
})();
