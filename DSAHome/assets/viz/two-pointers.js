/* Two Pointers visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const isSorted = (a) => a.every((v, i) => !i || a[i - 1] <= v);

  /* Bar chart as SVG: bars, optional water blocks, a container rectangle, dashed level lines and pointer labels. */
  function barsSvg(h, o = {}) {
    const W = 32, G = 6, H = 150, top = 26, n = h.length;
    const maxH = Math.max(1, ...h);
    const unit = H / maxH;
    const width = n * (W + G) + G, height = top + H + 44;
    const X = (i) => G + i * (W + G), Y = (v) => top + H - v * unit;
    let s = `<svg class="tp-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(o.label || "bars")}">`;
    if (o.area) {
      const [l, r, lv] = o.area;
      if (lv > 0) s += `<rect class="tp-area" x="${X(l) + W / 2}" y="${Y(lv)}" width="${X(r) - X(l)}" height="${lv * unit}"/>`;
    }
    h.forEach((v, i) => {
      s += `<rect class="tp-bar ${o.cls ? o.cls(i, v) : ""}" x="${X(i)}" y="${Y(v)}" width="${W}" height="${Math.max(1.5, v * unit)}" rx="3"/>`;
      const w = o.water ? o.water[i] : 0;
      if (w > 0) s += `<rect class="tp-water" x="${X(i)}" y="${Y(v + w)}" width="${W}" height="${w * unit}"/><text class="tp-wl" x="${X(i) + W / 2}" y="${Y(v + w / 2) + 4}">${w}</text>`;
    });
    if (o.best) {
      const [l, r, lv] = o.best;
      if (lv > 0) s += `<rect class="tp-best" x="${X(l) + W / 2}" y="${Y(lv)}" width="${X(r) - X(l)}" height="${lv * unit}"/>`;
    }
    (o.levels || []).forEach(({ from, to, v, label }) => {
      if (to < from) return;
      s += `<line class="tp-lvl" x1="${X(from) - 2}" x2="${X(to) + W + 2}" y1="${Y(v)}" y2="${Y(v)}"/><text class="tp-lvl-t" x="${(X(from) + X(to) + W) / 2}" y="${Y(v) - 5}">${esc(label)}</text>`;
    });
    s += `<line class="tp-base" x1="0" x2="${width}" y1="${top + H}" y2="${top + H}"/>`;
    const ptr = {};
    for (const [k, i] of Object.entries(o.ptrs || {})) if (i !== null && i !== undefined && i >= 0 && i < n) (ptr[i] ||= []).push(k);
    h.forEach((v, i) => {
      s += `<text class="tp-val" x="${X(i) + W / 2}" y="${top + H + 15}">${v}</text>`;
      if (ptr[i]) s += `<text class="tp-ptr" x="${X(i) + W / 2}" y="${top + H + 33}">↑${esc(ptr[i].join(","))}</text>`;
    });
    return `<div class="v-labeled">${o.caption ? `<span class="v-caption">${esc(o.caption)}</span>` : ""}${s}</svg></div>`;
  }
  const chips = (label, items, cls = "done") => Viz.labeled(label, `<div class="tp-chips">${items.length ? items.map((t) => `<span class="v-item ${cls}">${esc(t)}</span>`).join("") : '<span class="tp-empty">none yet</span>'}</div>`);

  /* 1 ─ Pair-sum on sorted input, drawn as the n×n pair matrix so you SEE rows and columns die. */
  Viz.register("two-pointers-matrix", (el) => Viz.player(el, {
    title: "Pair sum: every move kills a whole row or column of the pair matrix",
    tag: "WHY DISCARDING IS SAFE",
    legend: [["active", "pair being tested"], ["bad", "row / column just eliminated"], ["visit", "pairs actually tested (the staircase)"], ["dim", "eliminated without testing"], ["done", "answer"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, len(a) - 1",
      "while lo < hi:",
      "    s = a[lo] + a[hi]",
      "    if s == target: return lo, hi",
      "    if s < target: lo += 1  # row dead",
      "    else:          hi -= 1  # col dead",
      "return None",
    ],
    inputs: [{ key: "a", label: "sorted nums (2–10)", value: "1,3,4,6,8,11,15" }, { key: "t", label: "target", value: "10", width: 70 }],
    random: () => {
      const a = Viz.randInts(Viz.rand(5, 9), 1, 25).sort((x, y) => x - y);
      const ok = Math.random() < 0.7;
      const i = Viz.rand(0, a.length - 2), j = Viz.rand(i + 1, a.length - 1);
      return { a: a.join(","), t: String(ok ? a[i] + a[j] : Viz.rand(2, 50)) };
    },
    build: ({ a, t }) => {
      const arr = Viz.parse.ints(a, { min: 2, max: 10 }), target = Viz.parse.int(t, { min: -999, max: 999 });
      if (!isSorted(arr)) throw new Error("The array must be sorted ascending: that is what makes discarding safe.");
      const n = arr.length, total = (n * (n - 1)) / 2, fr = [], tested = [];
      let lo = 0, hi = n - 1;
      const dead = (l, h) => { let c = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) if (i < l || j > h) c++; return c; };
      const snap = (x) => ({ arr, lo, hi, tested: tested.slice(), ...x, vars: { lo, hi, target, ...(x.vars || {}), tested: tested.length, "pairs total": total, eliminated: dead(lo, hi) } });
      fr.push(snap({ line: 0, note: `Cell (i, j) of the matrix is the pair a[i] + a[j]. Brute force tests all <b>${total}</b> cells. Rows grow to the right and columns grow downward because the array is sorted, so we start at the top-right corner: smallest + largest.` }));
      while (lo < hi) {
        const s = arr[lo] + arr[hi];
        tested.push([lo, hi]);
        fr.push(snap({ cur: [lo, hi], line: 2, vars: { s }, note: `Test a[${lo}] + a[${hi}] = ${arr[lo]} + ${arr[hi]} = <b>${s}</b> against target ${target}.` }));
        if (s === target) {
          fr.push(snap({ cur: [lo, hi], found: true, line: 3, vars: { s }, note: `<b>Found</b> (${lo}, ${hi}). We tested only ${tested.length} of ${total} pairs; every other pair was ruled out by a proof, not by a test.` }));
          return fr;
        }
        if (s < target) {
          lo++;
          fr.push(snap({ killRow: lo - 1, line: 4, vars: { s }, note: `${s} &lt; ${target}. Every other pair in row ${lo - 1} pairs a[${lo - 1}] with something <i>smaller</i> than a[${hi}] (it lies to the left), so its sum is ≤ ${s} &lt; ${target}. The <b>whole row</b> is impossible: lo++.` }));
        } else {
          hi--;
          fr.push(snap({ killCol: hi + 1, line: 5, vars: { s }, note: `${s} &gt; ${target}. Every other pair in column ${hi + 1} pairs a[${hi + 1}] with something <i>larger</i> than a[${lo}] (it lies below), so its sum is ≥ ${s} &gt; ${target}. The <b>whole column</b> is impossible: hi--.` }));
        }
      }
      fr.push(snap({ line: 6, note: `lo met hi: every row and column is eliminated, so <b>no pair</b> sums to ${target}. We proved it with ${tested.length} tests instead of ${total}.` }));
      return fr;
    },
    render: (f) => {
      const n = f.arr.length;
      const m = Array.from({ length: n - 1 }, (_, i) => Array.from({ length: n - 1 }, (_, c) => (c + 1 > i ? f.arr[i] + f.arr[c + 1] : "")));
      const was = new Set(f.tested.map(([i, j]) => `${i},${j}`));
      return Viz.row(
        Viz.array(f.arr, { label: "sorted array", ptrs: { lo: f.lo, hi: f.hi }, cls: (i) => (f.found && (i === f.lo || i === f.hi) ? "done" : i === f.lo || i === f.hi ? "active" : i < f.lo || i > f.hi ? "dim" : "") }),
        Viz.grid(m, {
          label: "pair matrix: row i, column j",
          rowLabels: f.arr.slice(0, -1).map((v, i) => `i${i}=${v}`), colLabels: f.arr.slice(1).map((v, j) => `j${j + 1}=${v}`),
          cls: (r, c) => {
            const i = r, j = c + 1;
            if (j <= i) return "tp-void";
            if (f.cur && f.cur[0] === i && f.cur[1] === j) return f.found ? "done" : "active";
            if (f.killRow === i && j <= f.hi + 0) return "bad";
            if (f.killRow === i && j > f.hi) return was.has(`${i},${j}`) ? "visit" : "dim";
            if (f.killCol === j && i >= f.lo) return "bad";
            if (was.has(`${i},${j}`)) return "visit";
            if (i < f.lo || j > f.hi) return "dim";
            return "";
          },
        }),
      );
    },
  }));

  /* 2 ─ Container with most water. */
  Viz.register("two-pointers-container", (el) => Viz.player(el, {
    title: "Container with most water: always move the shorter wall",
    legend: [["active", "current walls"], ["visit", "water held by (lo, hi)"], ["done", "best so far (dashed)"], ["dim", "walls already ruled out"]],
    codeLang: "python",
    code: [
      "lo, hi, best = 0, len(h) - 1, 0",
      "while lo < hi:",
      "    area = (hi - lo) * min(h[lo], h[hi])",
      "    best = max(best, area)",
      "    if h[lo] < h[hi]: lo += 1",
      "    else:             hi -= 1",
      "return best",
    ],
    inputs: [{ key: "h", label: "heights (2–14, 0–12)", value: "1,8,6,2,5,4,8,3,7" }],
    random: () => ({ h: Viz.randInts(Viz.rand(7, 12), 1, 12).join(",") }),
    build: ({ h }) => {
      const a = Viz.parse.ints(h, { min: 2, max: 14 });
      if (a.some((v) => v < 0 || v > 12 || !Number.isInteger(v))) throw new Error("Heights must be whole numbers from 0 to 12.");
      let lo = 0, hi = a.length - 1, best = 0, bl = -1, bh = -1, tested = 0;
      const fr = [];
      const snap = (x) => ({ a, lo, hi, best, bl, bh, ...x, vars: { lo, hi, ...(x.vars || {}), best, "pairs tested": tested, "pairs total": (a.length * (a.length - 1)) / 2 } });
      fr.push(snap({ line: 0, note: "Start with the widest container. Width can only shrink from here, so a move is worth it only if it might raise the <i>shorter</i> wall." }));
      while (lo < hi) {
        const lv = Math.min(a[lo], a[hi]), area = (hi - lo) * lv;
        tested++;
        fr.push(snap({ area: [lo, hi, lv], line: 2, vars: { area }, note: `Width ${hi - lo} × min(${a[lo]}, ${a[hi]}) = <b>${area}</b>. The shorter wall caps the water level.` }));
        if (area > best) { best = area; bl = lo; bh = hi; fr.push(snap({ area: [lo, hi, lv], line: 3, vars: { area }, note: `New best: <b>${best}</b>.` })); }
        if (a[lo] < a[hi]) {
          lo++;
          fr.push(snap({ line: 4, vars: { area }, note: `h[${lo - 1}] = ${a[lo - 1]} is the shorter wall. Any other partner for it is <i>closer</i> (less width) and the level can never exceed ${a[lo - 1]}, so every remaining pair using wall ${lo - 1} holds less than ${area}. Discard it: lo++.` }));
        } else {
          hi--;
          fr.push(snap({ line: 5, vars: { area }, note: `h[${hi + 1}] = ${a[hi + 1]} is the shorter (or equal) wall. Every other pair using it is narrower and no taller, so none can beat ${area}. Discard it: hi--. (On a tie, either side may move.)` }));
        }
      }
      fr.push(snap({ done: true, line: 6, note: `Pointers met after ${tested} tests. Best container: walls ${bl} and ${bh}, holding <b>${best}</b>.` }));
      return fr;
    },
    render: (f) => barsSvg(f.a, {
      label: "container heights", caption: "walls (heights) and water",
      ptrs: f.done ? {} : { lo: f.lo, hi: f.hi },
      area: f.area, best: f.best > 0 ? [f.bl, f.bh, Math.min(f.a[f.bl], f.a[f.bh])] : null,
      cls: (i) => (f.done && (i === f.bl || i === f.bh) ? "done" : !f.done && (i === f.lo || i === f.hi) ? "active" : i < f.lo || i > f.hi ? "dim" : ""),
    }),
  }));

  /* 3 ─ 3Sum with duplicate skipping. */
  Viz.register("two-pointers-3sum", (el) => Viz.player(el, {
    title: "3Sum: fix an anchor, two-pointer the rest, skip equal values",
    legend: [["path", "anchor i"], ["active", "lo / hi"], ["bad", "skipped duplicate"], ["done", "triplet found"], ["dim", "already used as anchor"]],
    codeLang: "python",
    code: [
      "a.sort()",
      "for i in range(n - 2):",
      "    if i > 0 and a[i] == a[i-1]: continue",
      "    lo, hi = i + 1, n - 1",
      "    while lo < hi:",
      "        s = a[i] + a[lo] + a[hi]",
      "        if s < target: lo += 1; continue",
      "        if s > target: hi -= 1; continue",
      "        out.append((a[i], a[lo], a[hi]))",
      "        lo += 1; hi -= 1",
      "        while lo < hi and a[lo] == a[lo-1]:",
      "            lo += 1",
      "        while lo < hi and a[hi] == a[hi+1]:",
      "            hi -= 1",
    ],
    inputs: [{ key: "a", label: "nums (3–14)", value: "-1,0,1,2,-1,-4,-1,2" }, { key: "t", label: "target", value: "0", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(8, 12), -5, 5).join(","), t: "0" }),
    build: ({ a, t }) => {
      const raw = Viz.parse.ints(a, { min: 3, max: 14 }), target = Viz.parse.int(t, { min: -99, max: 99 });
      const s0 = raw.slice().sort((x, y) => x - y), n = s0.length, out = [], fr = [];
      let i = -1, lo = null, hi = null;
      const snap = (x) => ({ a: s0, i, lo, hi, out: out.slice(), ...x, vars: { i, lo, hi, target, ...(x.vars || {}), found: out.length } });
      fr.push(snap({ line: 0, note: `Sort first: [${s0.join(", ")}]. Sorting makes equal values adjacent (so duplicates are easy to skip) and lets the inner loop be a sorted two-sum.` }));
      for (i = 0; i < n - 2; i++) {
        lo = null; hi = null;
        if (i > 0 && s0[i] === s0[i - 1]) {
          fr.push(snap({ skip: [i], line: 2, note: `a[${i}] = ${s0[i]} equals the previous anchor. Every triplet it could start was already found with anchor ${i - 1}, so skip it.` }));
          continue;
        }
        lo = i + 1; hi = n - 1;
        fr.push(snap({ line: 3, note: `Anchor a[${i}] = <b>${s0[i]}</b>. Now find pairs in a[${lo}..${hi}] summing to ${target} − (${s0[i]}) = <b>${target - s0[i]}</b>: a sorted two-sum.` }));
        while (lo < hi) {
          const s = s0[i] + s0[lo] + s0[hi];
          if (s < target) { lo++; fr.push(snap({ line: 6, vars: { s }, note: `${s0[i]} + ${s0[lo - 1]} + ${s0[hi]} = ${s} &lt; ${target}: a[${lo - 1}] is too small with anyone left of hi. lo++.` })); }
          else if (s > target) { hi--; fr.push(snap({ line: 7, vars: { s }, note: `${s0[i]} + ${s0[lo]} + ${s0[hi + 1]} = ${s} &gt; ${target}: a[${hi + 1}] is too big with anyone right of lo. hi--.` })); }
          else {
            out.push(`(${s0[i]}, ${s0[lo]}, ${s0[hi]})`);
            fr.push(snap({ hit: [i, lo, hi], line: 8, vars: { s }, note: `${s0[i]} + ${s0[lo]} + ${s0[hi]} = ${target}. <b>Record it.</b> Both lo and hi must move: keeping either value would only find the same triplet again.` }));
            lo++; hi--;
            fr.push(snap({ line: 9, vars: { s }, note: "Move both pointers inward." }));
            const sk = [];
            while (lo < hi && s0[lo] === s0[lo - 1]) { sk.push(lo); lo++; }
            if (sk.length) fr.push(snap({ skip: sk, line: [10, 11], vars: { s }, note: `Skip lo past ${sk.length} more copy(ies) of ${s0[sk[0]]}: with the anchor fixed, the same lo value forces the same hi value, a duplicate triplet.` }));
            const sk2 = [];
            while (lo < hi && s0[hi] === s0[hi + 1]) { sk2.push(hi); hi--; }
            if (sk2.length) fr.push(snap({ skip: sk2, line: [12, 13], vars: { s }, note: `Skip hi past ${sk2.length} more copy(ies) of ${s0[sk2[0]]} for the same reason.` }));
          }
        }
        fr.push(snap({ line: 4, note: `lo met hi: anchor ${s0[i]} is exhausted.` }));
      }
      i = n; lo = null; hi = null;
      fr.push(snap({ line: 1, note: `Done. <b>${out.length}</b> unique triplet(s), in O(n²) time and no hash set needed for de-duplication.` }));
      return fr;
    },
    render: (f) => Viz.row(
      Viz.array(f.a, {
        label: "sorted", ptrs: { i: f.i < f.a.length ? f.i : null, lo: f.lo, hi: f.hi },
        cls: (k) => (f.hit && f.hit.includes(k) ? "done" : f.skip && f.skip.includes(k) ? "bad" : k === f.i ? "path" : k === f.lo || k === f.hi ? "active" : k < f.i ? "dim" : f.lo !== null && (k < f.lo || k > f.hi) ? "dim" : ""),
      }),
      chips("triplets found", f.out),
    ),
  }));

  /* 4 ─ Same-direction read/write pointers. */
  const RW = {
    "remove duplicates (sorted)": { keep: (a, r, w) => w < 1 || a[r] !== a[w - 1], why: (a, r, w, k) => (k ? (w < 1 ? "the first element is always new" : `${a[r]} ≠ last kept ${a[w - 1]}, so it is new`) : `${a[r]} = last kept ${a[w - 1]}: a duplicate`), def: "0,0,1,1,1,2,2,3,3,4", sorted: true },
    "keep at most 2 copies (sorted)": { keep: (a, r, w) => w < 2 || a[r] !== a[w - 2], why: (a, r, w, k) => (k ? (w < 2 ? "fewer than 2 kept so far" : `${a[r]} ≠ a[w-2] = ${a[w - 2]}, so fewer than 2 copies are kept`) : `${a[r]} = a[w-2]: two copies are already kept`), def: "1,1,1,2,2,3,3,3,3,4", sorted: true },
    "move zeroes (stable, swap)": { keep: (a, r) => a[r] !== 0, why: (a, r, w, k) => (k ? `${a[r]} is non-zero` : "a zero: leave it for the reader to pass"), def: "0,1,0,3,12,0,5", swap: true },
  };
  Viz.register("two-pointers-readwrite", (el) => Viz.player(el, {
    title: "Read / write pointers: compact in place, one pass",
    legend: [["done", "a[0..w): the answer so far"], ["dim", "a[w..r): free to overwrite"], ["active", "reader r"], ["visit", "just written"]],
    codeLang: "python",
    code: [
      "w = 0                    # write slot",
      "for r in range(len(a)):  # read all",
      "    if keep(a, r, w):",
      "        a[w] = a[r]      # zeroes: swap",
      "        w += 1",
      "return w                 # a[:w] = answer",
    ],
    inputs: [{ key: "mode", label: "rule", type: "select", options: Object.keys(RW), value: "remove duplicates (sorted)" }, { key: "a", label: "nums (1–16)", value: "0,0,1,1,1,2,2,3,3,4" }],
    random: () => {
      const mode = Object.keys(RW)[Viz.rand(0, 2)];
      const a = mode.includes("zero") ? Viz.randInts(Viz.rand(7, 12), 0, 6).map((v) => (Math.random() < 0.4 ? 0 : v)) : Viz.randInts(Viz.rand(8, 13), 1, 5).sort((x, y) => x - y);
      return { mode, a: a.join(",") };
    },
    build: ({ mode, a }) => {
      const M = RW[mode] || RW["remove duplicates (sorted)"];
      const arr = Viz.parse.ints(a && a.trim() ? a : M.def, { min: 1, max: 16 });
      if (M.sorted && !isSorted(arr)) throw new Error("This rule needs sorted input (duplicates must be adjacent).");
      const fr = [];
      let w = 0;
      const snap = (x) => ({ arr: arr.slice(), w, ...x, vars: { w, ...(x.vars || {}) } });
      fr.push(snap({ r: -1, line: 0, note: "Invariant: a[0..w) holds exactly the elements we keep, in order. The reader r never falls behind w, so writing at w never clobbers anything unread." }));
      for (let r = 0; r < arr.length; r++) {
        const k = M.keep(arr, r, w);
        fr.push(snap({ r, line: 2, vars: { r, "a[r]": arr[r], keep: k ? "yes" : "no" }, note: `r = ${r}: ${M.why(arr, r, w, k)}. ${k ? "Keep it." : "Skip it; r moves on and w stays."}` }));
        if (k) {
          if (M.swap) [arr[w], arr[r]] = [arr[r], arr[w]]; else arr[w] = arr[r];
          fr.push(snap({ r, wrote: w, line: 3, vars: { r, "a[r]": arr[r] }, note: M.swap ? `Swap a[${w}] ↔ a[${r}]: the non-zero joins the kept prefix and the zero slides into the free gap.` : `Write a[${w}] = ${arr[w]}. ${w === r ? "(w = r, so it is written onto itself.)" : "The old value at w was already read or is garbage."}` }));
          w++;
          fr.push(snap({ r, line: 4, vars: { r }, note: `w = ${w}.` }));
        }
      }
      fr.push(snap({ r: arr.length, fin: true, line: 5, note: `Reader done. The answer is a[0..${w}) = [${arr.slice(0, w).join(", ")}]${M.swap ? "; the zeroes have collected at the end" : "; what lies beyond w is leftover garbage"}. O(n) time, O(1) space.` }));
      return fr;
    },
    render: (f) => Viz.array(f.arr, {
      ptrs: { w: f.w, r: f.r >= 0 && f.r < f.arr.length ? f.r : null },
      cls: (i) => (i === f.wrote ? "visit" : i === f.r ? "active" : i < f.w ? "done" : !f.fin && i < f.r ? "dim" : f.fin && i >= f.w ? "dim" : ""),
    }),
  }));

  /* 5 ─ Dutch national flag. */
  Viz.register("two-pointers-dutch", (el) => Viz.player(el, {
    title: "Dutch national flag: 3-way partition in one pass",
    legend: [["visit", "< pivot: a[0..lo)"], ["done", "= pivot: a[lo..mid)"], ["active", "mid: examining"], ["path", "> pivot: a(hi..n-1]"]],
    codeLang: "python",
    code: [
      "lo, mid, hi = 0, 0, len(a) - 1",
      "while mid <= hi:",
      "    if a[mid] < p:",
      "        swap(lo, mid); lo += 1; mid += 1",
      "    elif a[mid] > p:",
      "        swap(mid, hi); hi -= 1  # no mid++",
      "    else:",
      "        mid += 1",
    ],
    inputs: [{ key: "a", label: "nums (1–16)", value: "2,0,2,1,1,0,2,1,0" }, { key: "p", label: "pivot", value: "1", width: 60 }],
    random: () => (Math.random() < 0.5 ? { a: Viz.randInts(Viz.rand(8, 13), 0, 2).join(","), p: "1" } : { a: Viz.randInts(Viz.rand(8, 13), 1, 9).join(","), p: String(Viz.rand(3, 7)) }),
    build: ({ a, p }) => {
      const arr = Viz.parse.ints(a, { min: 1, max: 16 }), piv = Viz.parse.int(p, { min: -99, max: 99 });
      let lo = 0, mid = 0, hi = arr.length - 1;
      const fr = [];
      const snap = (x) => ({ arr: arr.slice(), lo, mid, hi, piv, ...x, vars: { lo, mid, hi, pivot: piv, ...(x.vars || {}) } });
      fr.push(snap({ line: 0, note: "Four regions: less | equal | <b>unknown</b> | greater. Each step classifies a[mid] and shrinks the unknown region by exactly one, so the loop runs n times." }));
      while (mid <= hi) {
        const v = arr[mid];
        if (v < piv) {
          [arr[lo], arr[mid]] = [arr[mid], arr[lo]];
          lo++; mid++;
          fr.push(snap({ sw: [lo - 1, mid - 1], line: 3, vars: { "a[mid] was": v }, note: `${v} &lt; ${piv}: swap it to the end of the "less" region. What comes back from lo is ${lo - 1 === mid - 1 ? "itself" : "an already-seen <i>equal</i> value"}, so mid can advance too.` }));
        } else if (v > piv) {
          [arr[mid], arr[hi]] = [arr[hi], arr[mid]];
          hi--;
          fr.push(snap({ sw: [mid, hi + 1], line: 5, vars: { "a[mid] was": v }, note: `${v} &gt; ${piv}: swap it to the front of the "greater" region. The value that came back from hi is <b>unexamined</b>, so mid must stay put. (Advancing here is the classic bug.)` }));
        } else {
          mid++;
          fr.push(snap({ line: 7, vars: { "a[mid] was": v }, note: `${v} = ${piv}: it already sits at the end of the "equal" region. mid++.` }));
        }
      }
      fr.push(snap({ fin: true, line: 1, note: `mid passed hi: no unknowns remain. [${arr.join(", ")}] is partitioned into &lt; ${piv}, = ${piv}, &gt; ${piv} with at most n swaps.` }));
      return fr;
    },
    render: (f) => Viz.array(f.arr, {
      ptrs: { lo: f.lo, mid: f.fin ? null : f.mid, hi: f.hi >= 0 ? f.hi : null },
      cls: (i) => (i < f.lo ? "visit" : i < f.mid ? "done" : i > f.hi ? "path" : i === f.mid ? "active" : ""),
    }),
  }));

  /* 6 ─ Fast/slow pointers on an array: find the duplicate number (Floyd). */
  function rhoLayout(nums) {
    const n = nums.length, seen = new Map(), seq = [];
    let x = 0;
    while (!seen.has(x)) { seen.set(x, seq.length); seq.push(x); x = nums[x]; }
    const mu = seen.get(x), tail = seq.slice(0, mu), cyc = seq.slice(mu), L = cyc.length;
    const pos = {}, gap = 74, R = Math.max(58, (L * 70) / (2 * Math.PI));
    tail.forEach((id, k) => (pos[id] = [k * gap, 0]));
    const cx = mu * gap + R;
    cyc.forEach((id, k) => { const ang = Math.PI + (k * 2 * Math.PI) / L; pos[id] = [cx + R * Math.cos(ang), R * Math.sin(ang)]; });
    const rest = [...Array(n).keys()].filter((i) => !seen.has(i));
    const span = cx + R;
    rest.forEach((id, k) => (pos[id] = [rest.length === 1 ? span / 2 : (k * span) / (rest.length - 1), R + 70]));
    return { pos, onPath: new Set(seq), cyc: new Set(cyc), entry: x };
  }
  Viz.register("two-pointers-cycle", (el) => Viz.player(el, {
    title: "Find the duplicate: the array is a linked list i → nums[i]",
    tag: "FAST / SLOW · FLOYD",
    legend: [["active", "slow"], ["visit", "fast"], ["path", "meeting point / slow2"], ["done", "cycle entrance = duplicate"], ["dim", "unreachable from index 0"]],
    codeLang: "python",
    code: [
      "slow = fast = 0  # nothing points to 0",
      "while True:",
      "    slow = nums[slow]        # 1 hop",
      "    fast = nums[nums[fast]]  # 2 hops",
      "    if slow == fast: break   # in cycle",
      "slow2 = 0",
      "while slow != slow2:         # 1 hop each",
      "    slow, slow2 = nums[slow], nums[slow2]",
      "return slow                  # entrance",
    ],
    inputs: [{ key: "a", label: "nums: n+1 values in 1..n (2–10)", value: "1,3,4,2,2" }],
    random: () => {
      const n = Viz.rand(4, 8), a = Viz.randInts(n + 1, 1, n);
      return { a: a.join(",") };
    },
    build: ({ a }) => {
      const nums = Viz.parse.ints(a, { min: 2, max: 10 }), n = nums.length - 1;
      if (nums.some((v) => !Number.isInteger(v) || v < 1 || v > n)) throw new Error(`With ${nums.length} numbers every value must be in 1..${n}.`);
      const lay = rhoLayout(nums), fr = [];
      let slow = 0, fast = 0, slow2 = null, steps = 0;
      const snap = (x) => ({ nums, lay, slow, fast, slow2, ...x, vars: { slow, fast, ...(slow2 !== null ? { slow2 } : {}), ...(x.vars || {}), hops: steps } });
      fr.push(snap({ phase: 1, line: 0, note: `Read nums as edges i → nums[i]. There are ${nums.length} indices but only ${n} possible values, so two edges must enter the same node: the <b>duplicate value</b> is a node with in-degree 2, which is exactly where the walk from 0 enters a cycle.` }));
      do {
        slow = nums[slow]; fast = nums[nums[fast]]; steps++;
        fr.push(snap({ phase: 1, line: [2, 3], note: `slow hops once to ${slow}; fast hops twice to ${fast}. Inside the cycle, fast gains one node per round, so it must catch slow.` }));
      } while (slow !== fast);
      fr.push(snap({ phase: 1, meet: true, line: 4, note: `They meet at node <b>${slow}</b>. If the tail has length μ and the cycle length λ, the meeting point is exactly μ steps (mod λ) <i>before</i> the entrance.` }));
      slow2 = 0;
      fr.push(snap({ phase: 2, line: 5, note: "Phase 2: start slow2 at index 0. Both now take single steps. After μ steps slow2 reaches the entrance, and so does slow (μ more steps from the meeting point)." }));
      while (slow !== slow2) {
        slow = nums[slow]; slow2 = nums[slow2]; steps++;
        fr.push(snap({ phase: 2, line: 7, note: `slow → ${slow}, slow2 → ${slow2}.${slow === slow2 ? " Same node!" : ""}` }));
      }
      fr.push(snap({ phase: 2, fin: true, line: 8, note: `Both arrive at <b>${slow}</b>, the cycle entrance. Two different indices point to it, so <b>${slow}</b> is the duplicate. O(n) time, O(1) space, array untouched.` }));
      return fr;
    },
    render: (f) => {
      const { pos, onPath, cyc } = f.lay;
      const nodes = f.nums.map((v, i) => ({ id: i, x: pos[i][0], y: pos[i][1], sub: v === i ? "↺" : undefined }));
      const edges = f.nums.map((v, i) => ({ u: i, v })).filter((e) => e.u !== e.v);
      const nodeCls = (id) => {
        id = Number(id);
        if (f.fin && id === f.slow) return "done";
        if (f.slow2 !== null && id === f.slow2 && id !== f.slow) return "path";
        if (id === f.slow && id === f.fast && f.phase === 1) return "path";
        if (id === f.slow) return "active";
        if (f.phase === 1 && id === f.fast) return "visit";
        return onPath.has(id) ? "" : "dim";
      };
      const edgeCls = (k) => { const [u] = k.split("-").map(Number); return !onPath.has(u) ? "dim" : cyc.has(u) && cyc.has(f.nums[u]) ? "visit" : ""; };
      const ptrs = f.phase === 1 ? { slow: f.slow, fast: f.fast } : { slow: f.slow, slow2: f.slow2 };
      return Viz.row(
        Viz.array(f.nums, { label: "nums (index → value)", ptrs, cls: (i) => (f.fin && i === f.slow ? "done" : "") }),
        Viz.graph({ nodes, edges }, { directed: true, nodeCls, edgeCls, r: 18, label: "functional graph: node i → node nums[i]" }),
      );
    },
  }));

  /* 7 ─ Merge two sorted arrays from the back. */
  Viz.register("two-pointers-merge", (el) => Viz.player(el, {
    title: "Merge sorted arrays in place: fill from the back",
    legend: [["active", "write slot w"], ["visit", "compared heads"], ["done", "final position"], ["dim", "consumed"]],
    codeLang: "python",
    code: [
      "i, j, w = m - 1, n - 1, m + n - 1",
      "while j >= 0:  # nums2 values left",
      "    if i >= 0 and nums1[i] > nums2[j]:",
      "        nums1[w] = nums1[i]; i -= 1",
      "    else:",
      "        nums1[w] = nums2[j]; j -= 1",
      "    w -= 1",
    ],
    inputs: [{ key: "a", label: "nums1 values (sorted)", value: "1,2,3,7" }, { key: "b", label: "nums2 (sorted)", value: "2,5,6,8" }],
    random: () => ({ a: Viz.randInts(Viz.rand(2, 6), 0, 15).sort((x, y) => x - y).join(","), b: Viz.randInts(Viz.rand(1, 5), 0, 15).sort((x, y) => x - y).join(",") }),
    build: ({ a, b }) => {
      const A = String(a).trim() ? Viz.parse.ints(a, { min: 1, max: 7 }) : [];
      const B = Viz.parse.ints(b, { min: 1, max: 7 });
      if (!isSorted(A) || !isSorted(B)) throw new Error("Both inputs must be sorted ascending.");
      const m = A.length, n = B.length, nums1 = [...A, ...Array(n).fill(null)], fr = [];
      let i = m - 1, j = n - 1, w = m + n - 1;
      const snap = (x) => ({ nums1: nums1.slice(), B, i, j, w, ...x, vars: { i, j, w, ...(x.vars || {}) } });
      fr.push(snap({ line: 0, note: `nums1 has ${n} empty slots at the back. Writing from the front would overwrite unread nums1 values; writing from the back fills slots that are <b>already free</b>. The largest remaining value always goes to w.` }));
      while (j >= 0) {
        const takeA = i >= 0 && nums1[i] > B[j];
        fr.push(snap({ cmp: true, line: 2, vars: { "nums1[i]": i >= 0 ? nums1[i] : "—", "nums2[j]": B[j] }, note: i >= 0 ? `Compare nums1[${i}] = ${nums1[i]} with nums2[${j}] = ${B[j]}: the larger is the largest remaining value overall.` : "nums1's own values are all placed; only nums2 remains." }));
        if (takeA) { nums1[w] = nums1[i]; i--; fr.push(snap({ wrote: w, line: 3, note: `Write ${nums1[w]} to slot ${w}. The old copy at ${i + 1} is now free space.` })); }
        else { nums1[w] = B[j]; j--; fr.push(snap({ wrote: w, line: 5, note: `Write ${nums1[w]} to slot ${w}${i >= 0 && nums1[i] === B[j + 1] ? " (ties take nums2, keeping nums1's equal value in front: stable)" : ""}.` })); }
        w--;
        fr.push(snap({ line: 6, note: `w = ${w}. Note w − i = j + 1 ≥ 0 at all times: the writer can never overtake an unread nums1 value.` }));
      }
      fr.push(snap({ fin: true, line: 1, note: `nums2 is exhausted. Whatever is left of nums1 is already in place, so there is nothing to copy. Result: [${nums1.join(", ")}]. O(m + n), O(1) extra.` }));
      return fr;
    },
    render: (f) => Viz.row(
      Viz.array(f.nums1, { label: "nums1 (m values + n free slots)", ptrs: { i: f.i >= 0 ? f.i : null, w: f.w >= 0 ? f.w : null }, cls: (k) => (k === f.wrote ? "active" : f.fin || k > f.w ? "done" : k === f.w ? "active" : f.cmp && k === f.i ? "visit" : "") }),
      Viz.array(f.B, { label: "nums2", ptrs: { j: f.j >= 0 ? f.j : null }, cls: (k) => (k > f.j ? "dim" : f.cmp && k === f.j ? "visit" : "") }),
    ),
  }));

  /* 8 ─ Trapping rain water with two pointers. */
  Viz.register("two-pointers-trap", (el) => Viz.player(el, {
    title: "Trapping rain water: the lower side is already decided",
    legend: [["active", "pointer being settled"], ["visit", "water"], ["path", "leftMax / rightMax (dashed)"], ["done", "settled bars"]],
    codeLang: "python",
    code: [
      "lo, hi, lmax, rmax, water = 0, n-1, 0, 0, 0",
      "while lo < hi:",
      "    if h[lo] < h[hi]:  # left is lower",
      "        lmax = max(lmax, h[lo])",
      "        water += lmax - h[lo]; lo += 1",
      "    else:              # right lower/tied",
      "        rmax = max(rmax, h[hi])",
      "        water += rmax - h[hi]; hi -= 1",
      "return water",
    ],
    inputs: [{ key: "h", label: "heights (2–16, 0–9)", value: "0,1,0,2,1,0,1,3,2,1,2,1" }],
    random: () => ({ h: Viz.randInts(Viz.rand(9, 14), 0, 7).join(",") }),
    build: ({ h }) => {
      const a = Viz.parse.ints(h, { min: 2, max: 16 });
      if (a.some((v) => !Number.isInteger(v) || v < 0 || v > 9)) throw new Error("Heights must be whole numbers from 0 to 9.");
      let lo = 0, hi = a.length - 1, lmax = 0, rmax = 0, water = 0;
      const wat = Array(a.length).fill(0), fr = [];
      const snap = (x) => ({ a, lo, hi, lmax, rmax, wat: wat.slice(), ...x, vars: { lo, hi, lmax, rmax, ...(x.vars || {}), water } });
      fr.push(snap({ line: 0, note: "Water above bar i = min(tallest on its left, tallest on its right) − h[i]. We do not need both maxima exactly: we only need to know <b>which one is smaller</b>." }));
      while (lo < hi) {
        if (a[lo] < a[hi]) {
          fr.push(snap({ cur: lo, line: 2, note: `h[${lo}] = ${a[lo]} &lt; h[${hi}] = ${a[hi]}. The taller pointer always holds the tallest bar seen so far, so some wall on lo's right is ≥ ${a[hi]} ≥ lmax. The left maximum is the binding limit for bar ${lo}.` }));
          lmax = Math.max(lmax, a[lo]); wat[lo] = lmax - a[lo]; water += wat[lo];
          fr.push(snap({ cur: lo, line: [3, 4], vars: { "+water": wat[lo] }, note: wat[lo] ? `Bar ${lo} holds lmax − h = ${lmax} − ${a[lo]} = <b>${wat[lo]}</b>. Settled forever.` : `Bar ${lo} is ${a[lo] === lmax ? "a new left maximum" : "level with lmax"}: it holds nothing. Settled.` }));
          lo++;
        } else {
          fr.push(snap({ cur: hi, line: 5, note: `h[${lo}] = ${a[lo]} ≥ h[${hi}] = ${a[hi]}. Symmetric: some wall on hi's left is ≥ ${a[lo]} ≥ rmax, so the right maximum decides bar ${hi}.` }));
          rmax = Math.max(rmax, a[hi]); wat[hi] = rmax - a[hi]; water += wat[hi];
          fr.push(snap({ cur: hi, line: [6, 7], vars: { "+water": wat[hi] }, note: wat[hi] ? `Bar ${hi} holds rmax − h = ${rmax} − ${a[hi]} = <b>${wat[hi]}</b>. Settled forever.` : `Bar ${hi} is ${a[hi] === rmax ? "a new right maximum" : "level with rmax"}: it holds nothing. Settled.` }));
          hi--;
        }
      }
      fr.push(snap({ fin: true, line: 8, note: `Pointers met on the tallest bar (it never holds water). Total trapped: <b>${water}</b>. One pass, O(1) extra space, versus O(n) for the two prefix-max arrays.` }));
      return fr;
    },
    render: (f) => {
      const n = f.a.length;
      const levels = [];
      if (f.lo > 0) levels.push({ from: 0, to: f.lo - 1, v: f.lmax, label: `lmax ${f.lmax}` });
      if (f.hi < n - 1) levels.push({ from: f.hi + 1, to: n - 1, v: f.rmax, label: `rmax ${f.rmax}` });
      return barsSvg(f.a, {
        label: "elevation map", caption: "elevation map and settled water",
        ptrs: f.fin ? { "lo=hi": f.lo } : { lo: f.lo, hi: f.hi }, water: f.wat, levels: levels.filter((l) => l.v > 0),
        cls: (i) => (i === f.cur ? "active" : i < f.lo || i > f.hi ? "done" : ""),
      });
    },
  }));
})();
