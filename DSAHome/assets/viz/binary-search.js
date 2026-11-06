/* Binary Search visualizers. Every search here is the same first-true boundary loop. */
(() => {
  const half = (lo, hi) => lo + Math.floor((hi - lo) / 2);
  const ensureSorted = (a) => { if (a.some((v, i) => i && v < a[i - 1])) throw new Error("The array must be sorted ascending (duplicates are fine)."); };
  const sortedRand = (n, lo, hi) => Viz.randInts(n, lo, hi).sort((x, y) => x - y);
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const wrap = (cls, html) => `<div class="${cls}">${html}</div>`;

  /* 1. Classic search, written as the boundary template on [lo, hi). */
  Viz.register("binary-search-classic", (el) => Viz.player(el, {
    title: "Find a target with the boundary template: lo, mid, hi on [lo, hi)",
    legend: [["active", "mid (probe)"], ["window", "still possible"], ["dim", "discarded"], ["done", "found"], ["bad", "absent"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, len(a)        # [lo, hi)",
      "while lo < hi:            # not empty",
      "    mid = lo + (hi - lo) // 2",
      "    if a[mid] >= target:  # p(mid) is T",
      "        hi = mid          # answer <= mid",
      "    else:",
      "        lo = mid + 1      # answer > mid",
      "# lo == hi: first i with a[i] >= target",
      "ok = lo < len(a) and a[lo] == target",
      "return lo if ok else -1",
    ],
    inputs: [{ key: "a", label: "sorted nums", value: "2,5,8,12,16,23,38,56,72,91" }, { key: "t", label: "target", value: "23", width: 70 }],
    random: () => {
      const a = sortedRand(Viz.rand(8, 14), 1, 60);
      return { a: a.join(","), t: String(Math.random() < 0.6 ? pick(a) : Viz.rand(0, 62)) };
    },
    build: ({ a, t }) => {
      const arr = Viz.parse.ints(a, { min: 1, max: 18 }); ensureSorted(arr);
      const target = Viz.parse.int(t, { min: -9999, max: 9999 });
      const n = arr.length, fr = [], sizes = [n];
      let lo = 0, hi = n;
      const push = (o) => fr.push({ arr, lo, hi, sizes: [...sizes], ...o });
      push({ line: 0, vars: { lo, hi, target }, note: `The answer is some index in 0…${n} (index ${n} would mean “after everything”). Start with the whole half-open range [0, ${n}): <b>${n}</b> candidates.` });
      while (lo < hi) {
        const mid = half(lo, hi);
        push({ mid, line: [1, 2], vars: { lo, hi, mid, "a[mid]": arr[mid], target }, note: `[${lo}, ${hi}) still holds ${hi - lo} candidate(s). Probe the middle: mid = ${lo} + (${hi} − ${lo}) // 2 = <b>${mid}</b>, a[mid] = ${arr[mid]}.` });
        if (arr[mid] >= target) {
          hi = mid; sizes.push(hi - lo);
          push({ mid, line: [3, 4], vars: { lo, hi, mid, "a[mid]": arr[mid], target }, note: `a[${mid}] = ${arr[mid]} ≥ ${target}: the predicate is <b>true</b> at mid, and (sorted!) at every index after it. The first true is mid or to its left, so keep mid: <b>hi = ${mid}</b>.` });
        } else {
          lo = mid + 1; sizes.push(hi - lo);
          push({ mid, line: [5, 6], vars: { lo, hi, mid, "a[mid]": arr[mid], target }, note: `a[${mid}] = ${arr[mid]} &lt; ${target}: the predicate is <b>false</b> at mid and at everything left of it. Throw them all away: <b>lo = mid + 1 = ${lo}</b>.` });
        }
      }
      push({ final: true, line: 7, vars: { lo, hi, target }, note: `lo == hi == ${lo}: the range is empty, so lo is the boundary — the first index whose value is ≥ ${target}${lo === n ? ` (n itself: every element is smaller)` : ""}. ${sizes.length - 1} probes for ${n} elements.` });
      const found = lo < n && arr[lo] === target;
      push({ final: true, found, line: [8, 9], vars: { lo, result: found ? lo : -1 }, note: found ? `a[${lo}] == ${target}: <b>found at index ${lo}</b>, and it is guaranteed to be the leftmost copy.` : `${lo < n ? `a[${lo}] = ${arr[lo]} ≠ ${target}` : "lo is past the end"}, so <b>${target} is absent</b>: return −1. lo = ${lo} is still useful: it is exactly where ${target} would be inserted.` });
      return fr;
    },
    render: (f) => Viz.row(
      Viz.array(f.arr, {
        ptrs: f.final ? { "lo=hi": f.lo } : { lo: f.lo, mid: f.mid, hi: f.hi },
        window: f.final ? [1, 0] : [f.lo, f.hi - 1],
        cls: (i) => (f.final ? (i === f.lo ? (f.found ? "done" : "bad") : "dim") : i === f.mid ? "active" : i < f.lo || i >= f.hi ? "dim" : ""),
      }),
      Viz.array(f.sizes, { label: "candidates left after each probe", showIdx: false, cls: (i) => (i === f.sizes.length - 1 ? "visit" : "") }),
    ),
  }));

  /* 2. The predicate strip: one first_true, many questions. */
  const MODES = {
    "lower_bound: first a[i] >= t": ["lower"],
    "upper_bound: first a[i] > t": ["upper"],
    "first occurrence of t": ["lower"],
    "last occurrence of t": ["upper"],
    "count of t (upper - lower)": ["lower", "upper"],
    "insert position of t": ["lower"],
  };
  Viz.register("binary-search-predicate", (el) => Viz.player(el, {
    title: "The predicate strip: F…F T…T, and lo / hi as the edges of what we know",
    legend: [["active", "probe"], ["bad", "known F"], ["done", "known T"], ["window", "unknown (?)"], ["path", "answer"]],
    codeLang: "python",
    code: [
      "def first_true(lo, hi, pred):  # F…F T…T",
      "    while lo < hi:",
      "        mid = lo + (hi - lo) // 2",
      "        if pred(mid): hi = mid      # T",
      "        else:         lo = mid + 1  # F",
      "    return lo        # == hi; n means no T",
      "lb = first_true(0, n, lambda i: a[i] >= t)",
      "ub = first_true(0, n, lambda i: a[i] > t)",
      "first = lb if lb < n and a[lb] == t else -1",
      "last = ub-1 if ub and a[ub-1] == t else -1",
      "count = ub - lb;  insert_at = lb",
    ],
    inputs: [
      { key: "a", label: "sorted nums (duplicates welcome)", value: "1,3,3,5,5,5,5,8,9,12", width: 230 },
      { key: "t", label: "t", value: "5", width: 60 },
      { key: "q", label: "question", type: "select", options: Object.keys(MODES), value: "count of t (upper - lower)" },
    ],
    random: () => {
      const a = sortedRand(Viz.rand(8, 13), 1, 12);
      return { a: a.join(","), t: String(Math.random() < 0.7 ? pick(a) : Viz.rand(0, 13)) };
    },
    build: ({ a, t, q }) => {
      const arr = Viz.parse.ints(a, { min: 1, max: 16 }); ensureSorted(arr);
      const target = Viz.parse.int(t, { min: -9999, max: 9999 });
      const n = arr.length, fr = [], res = {};
      for (const pass of MODES[q]) {
        const pred = pass === "lower" ? (i) => arr[i] >= target : (i) => arr[i] > target;
        const sym = pass === "lower" ? "≥" : "&gt;", line = pass === "lower" ? 6 : 7;
        const label = `p(i) = a[i] ${pass === "lower" ? ">=" : ">"} ${target}`;
        let lo = 0, hi = n;
        const push = (o) => fr.push({ arr, pred: arr.map((_, i) => pred(i)), lo, hi, label, res: { ...res }, ...o });
        push({ line, vars: { lo, hi, t: target }, note: `Ask the <b>${pass}</b> question as a predicate: p(i) = a[i] ${sym} ${target}. On a sorted array it reads F…F T…T. Nothing is known yet, so every cell is “?”.` });
        while (lo < hi) {
          const mid = half(lo, hi), p = pred(mid);
          push({ mid, line: 2, vars: { lo, hi, mid, "a[mid]": arr[mid], "p(mid)": p ? "T" : "F" }, note: `Probe mid = ${mid}: a[${mid}] = ${arr[mid]}, so p(mid) is <b>${p ? "T" : "F"}</b>.` });
          if (p) { hi = mid; push({ mid, line: 3, vars: { lo, hi, mid, "p(mid)": "T" }, note: `T at ${mid} means T from ${mid} onward (monotone). Those cells are now <b>known T</b>; the first T is at or left of ${mid}: hi = ${mid}.` }); }
          else { lo = mid + 1; push({ mid, line: 4, vars: { lo, hi, mid, "p(mid)": "F" }, note: `F at ${mid} means F for 0…${mid}. Those cells are now <b>known F</b>; the first T is right of ${mid}: lo = ${lo}.` }); }
        }
        res[pass] = lo;
        push({ done: true, line: 5, vars: { [pass === "lower" ? "lb" : "ub"]: lo }, note: `lo == hi == ${lo}. Invariant: everything left of lo is F, everything from hi on is T. With no “?” left, <b>${pass === "lower" ? "lb" : "ub"} = ${lo}</b>${lo === n ? " (n: no element qualifies)" : ""}.` });
      }
      const L = res.lower, U = res.upper;
      let ans, hl = [], line, note;
      if (q.startsWith("lower")) { ans = L; hl = [L]; line = 6; note = `lower bound lb = <b>${L}</b>: the first element ≥ ${target}.`; }
      else if (q.startsWith("upper")) { ans = U; hl = [U]; line = 7; note = `upper bound ub = <b>${U}</b>: the first element strictly greater than ${target}.`; }
      else if (q.startsWith("first")) { ans = L < n && arr[L] === target ? L : -1; hl = ans >= 0 ? [L] : []; line = 8; note = ans >= 0 ? `a[lb] == ${target}, so the first occurrence is <b>${L}</b>.` : `a[lb] ${L < n ? `= ${arr[L]}` : "is out of range"} ≠ ${target}: <b>−1</b>, ${target} is absent.`; }
      else if (q.startsWith("last")) { ans = U > 0 && arr[U - 1] === target ? U - 1 : -1; hl = ans >= 0 ? [U - 1] : []; line = 9; note = ans >= 0 ? `The last copy sits just before the first “&gt; ${target}”: ub − 1 = <b>${U - 1}</b>.` : `a[ub − 1] ≠ ${target}: <b>−1</b>, ${target} is absent.`; }
      else if (q.startsWith("count")) { ans = U - L; hl = Array.from({ length: U - L }, (_, k) => L + k); line = 10; note = `Copies of ${target} occupy exactly [lb, ub) = [${L}, ${U}): count = <b>${U - L}</b>. Two O(log n) searches, no scanning.`; }
      else { ans = L; hl = [L]; line = 10; note = `Insert at lb = <b>${L}</b>: every element before it is &lt; ${target}, so the array stays sorted (and ${target} lands before any equal copies).`; }
      fr.push({ arr, pred: arr.map((v) => v >= target), lo: L, hi: L, final: true, hl, label: "result", res: { ...res }, line, vars: { ...Object.fromEntries(Object.entries(res).map(([k, v]) => [k === "lower" ? "lb" : "ub", v])), answer: ans }, note });
      return fr;
    },
    render: (f) => {
      if (f.final) return Viz.row(Viz.array(f.arr, { ptrs: Object.fromEntries(Object.entries(f.res).map(([k, v]) => [k === "lower" ? "lb" : "ub", v])), cls: (i) => (f.hl.includes(i) ? "path" : "dim") }));
      return Viz.row(wrap("bs-stack bs-code-cap",
        Viz.array(f.arr, { label: "a", ptrs: { lo: f.lo, mid: f.mid, hi: f.hi }, cls: (i) => (i === f.mid ? "active" : i < f.lo || i >= f.hi ? "dim" : "") }) +
        Viz.array(f.pred.map((p, i) => (i < f.lo ? "F" : i >= f.hi ? "T" : i === f.mid ? (p ? "T" : "F") : "?")), {
          label: f.label, showIdx: false,
          cls: (i) => (i === f.mid && !f.done ? "active" : i < f.lo ? "bad" : i >= f.hi ? "done" : "window"),
        })));
    },
  }));
  /* 3. Rotated sorted array: one half around mid is always sorted. */
  Viz.register("binary-search-rotated", (el) => Viz.player(el, {
    title: "Search a rotated sorted array: find the sorted half, ask if the target lives there",
    legend: [["active", "mid"], ["path", "the sorted half"], ["dim", "discarded"], ["done", "found"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, len(a) - 1",
      "while lo <= hi:",
      "    mid = (lo + hi) // 2",
      "    if a[mid] == t: return mid",
      "    if a[lo] <= a[mid]:      # left sorted",
      "        if a[lo] <= t < a[mid]: hi = mid - 1",
      "        else:                   lo = mid + 1",
      "    else:                    # right sorted",
      "        if a[mid] < t <= a[hi]: lo = mid + 1",
      "        else:                   hi = mid - 1",
      "return -1",
    ],
    inputs: [{ key: "a", label: "rotated sorted, distinct", value: "15,18,22,27,31,3,5,8,10,12", width: 220 }, { key: "t", label: "target", value: "8", width: 60 }],
    random: () => {
      const base = [...new Set(Viz.randInts(14, 1, 60))].sort((x, y) => x - y).slice(0, Viz.rand(7, 12));
      const k = Viz.rand(0, base.length - 1), a = [...base.slice(k), ...base.slice(0, k)];
      return { a: a.join(","), t: String(Math.random() < 0.75 ? pick(a) : Viz.rand(0, 61)) };
    },
    build: ({ a, t }) => {
      const arr = Viz.parse.ints(a, { min: 1, max: 16 }), target = Viz.parse.int(t, { min: -999, max: 999 });
      if (new Set(arr).size !== arr.length) throw new Error("Use distinct values (duplicates break the 'which half is sorted' test).");
      if (arr.some((v) => v < 0 || v > 99)) throw new Error("Use values from 0 to 99 so the bars stay readable.");
      const drops = arr.filter((v, i) => i && v < arr[i - 1]).length;
      if (drops > 1 || (drops === 1 && arr[arr.length - 1] > arr[0])) throw new Error("That is not a rotation of a sorted array.");
      const fr = [];
      let lo = 0, hi = arr.length - 1;
      const push = (o) => fr.push({ arr, lo, hi, ...o });
      push({ line: 0, vars: { lo, hi, t: target }, note: "A rotated array is two ascending runs with one “cliff”. We cannot ask “is a[mid] ≥ t?” directly, because the order wraps, but one side of mid is always a clean sorted run." });
      while (lo <= hi) {
        const mid = (lo + hi) >> 1;
        push({ mid, line: 2, vars: { lo, hi, mid, "a[mid]": arr[mid] }, note: `Probe mid = ${mid}, a[mid] = ${arr[mid]}.` });
        if (arr[mid] === target) { push({ mid, found: true, line: 3, vars: { lo, hi, mid, result: mid }, note: `a[${mid}] == ${target}: <b>found</b>.` }); return fr; }
        if (arr[lo] <= arr[mid]) {
          const inside = arr[lo] <= target && target < arr[mid];
          push({ mid, sorted: [lo, mid], line: 4, vars: { lo, hi, mid, "a[lo]": arr[lo], "a[mid]": arr[mid] }, note: `a[lo] = ${arr[lo]} ≤ a[mid] = ${arr[mid]}: no cliff between lo and mid, so <b>[${lo}..${mid}] is sorted</b>. For a sorted run, “is t inside?” is just a range check.` });
          if (inside) { hi = mid - 1; push({ mid, line: 5, vars: { lo, hi, mid }, note: `${arr[lo]} ≤ ${target} &lt; ${arr[mid]}: the target can only be in the sorted left half. hi = mid − 1 = ${hi}.` }); }
          else { const aLo = arr[lo]; lo = mid + 1; push({ mid, line: 6, vars: { lo, hi, mid }, note: `${target} is outside [${aLo}…${arr[mid]}): not in the sorted left half, so it must be on the right (the side with the cliff). lo = mid + 1 = ${lo}.` }); }
        } else {
          const inside = arr[mid] < target && target <= arr[hi];
          push({ mid, sorted: [mid, hi], line: 7, vars: { lo, hi, mid, "a[mid]": arr[mid], "a[hi]": arr[hi] }, note: `a[lo] = ${arr[lo]} &gt; a[mid] = ${arr[mid]}: the cliff is in the left half, so <b>[${mid}..${hi}] is sorted</b>.` });
          if (inside) { lo = mid + 1; push({ mid, line: 8, vars: { lo, hi, mid }, note: `${arr[mid]} &lt; ${target} ≤ ${arr[hi]}: the target can only be in the sorted right half. lo = mid + 1 = ${lo}.` }); }
          else { const aHi = arr[hi]; hi = mid - 1; push({ mid, line: 9, vars: { lo, hi, mid }, note: `${target} is outside (${arr[mid]}…${aHi}], so it can only be in the left half (the side with the cliff). hi = mid − 1 = ${hi}.` }); }
        }
      }
      push({ line: 10, vars: { lo, hi, result: -1 }, note: `lo &gt; hi: the range is empty, <b>${target} is not in the array</b>.` });
      return fr;
    },
    render: (f) => {
      const cls = (i) => (f.found && i === f.mid ? "done" : i === f.mid ? "active" : i < f.lo || i > f.hi ? "dim" : f.sorted && i >= f.sorted[0] && i <= f.sorted[1] ? "path" : "");
      return wrap("bs-stack bs-center", Viz.bars(f.arr, { cls, height: 120 }) + Viz.array(f.arr, { ptrs: { lo: f.lo, mid: f.mid, hi: f.hi }, cls }));
    },
  }));

  /* 4. Peak element: follow the uphill slope. */
  Viz.register("binary-search-peak", (el) => Viz.player(el, {
    title: "Find a peak: walk toward the uphill side of mid",
    legend: [["active", "mid"], ["visit", "mid + 1"], ["dim", "discarded"], ["done", "peak"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, len(a) - 1",
      "while lo < hi:",
      "    mid = lo + (hi - lo) // 2",
      "    if a[mid] < a[mid + 1]:  # uphill",
      "        lo = mid + 1         # peak right",
      "    else:                    # downhill",
      "        hi = mid             # mid or left",
      "return lo                    # a peak",
    ],
    inputs: [{ key: "a", label: "nums (neighbours differ)", value: "1,3,4,2,5,7,9,6,4,8,3", width: 220 }],
    random: () => {
      const a = [Viz.rand(1, 40)];
      for (let k = 1, n = Viz.rand(8, 14); k < n; k++) { let v; do v = Viz.rand(1, 40); while (v === a[k - 1]); a.push(v); }
      return { a: a.join(",") };
    },
    build: ({ a }) => {
      const arr = Viz.parse.ints(a, { min: 1, max: 16 });
      if (arr.some((v) => v < 0 || v > 99)) throw new Error("Use values from 0 to 99.");
      if (arr.some((v, i) => i && v === arr[i - 1])) throw new Error("Adjacent values must differ (that is the problem's guarantee).");
      const fr = [], slope = arr.map((v, i) => (i === arr.length - 1 || v > arr[i + 1] ? "↘" : "↗"));
      let lo = 0, hi = arr.length - 1;
      const push = (o) => fr.push({ arr, slope, lo, hi, ...o });
      push({ line: 0, vars: { lo, hi }, note: "Pretend a[−1] = a[n] = −∞. Then the slope strip starts ↗ and ends ↘, so somewhere a ↗ is followed by ↘: a peak. The strip is <b>not</b> monotone, yet binary search still works — keep reading." });
      while (lo < hi) {
        const mid = half(lo, hi);
        push({ mid, line: 2, vars: { lo, hi, mid, "a[mid]": arr[mid], "a[mid+1]": arr[mid + 1] }, note: `mid = ${mid}. Compare a[mid] = ${arr[mid]} with its right neighbour a[mid+1] = ${arr[mid + 1]}.` });
        if (arr[mid] < arr[mid + 1]) { lo = mid + 1; push({ mid, line: [3, 4], vars: { lo, hi, mid }, note: `${arr[mid]} &lt; ${arr[mid + 1]}: uphill. Climb right: the values must eventually come down (a[n] = −∞), so <b>a peak exists in [${lo}, ${hi}]</b>. lo = ${lo}.` }); }
        else { hi = mid; push({ mid, line: [5, 6], vars: { lo, hi, mid }, note: `${arr[mid]} &gt; ${arr[mid + 1]}: downhill. Either mid is a peak or the climb to one is on the left, so <b>a peak exists in [${lo}, ${hi}]</b>. hi = ${hi}.` }); }
      }
      push({ done: true, line: 7, vars: { lo, result: lo }, note: `lo == hi == ${lo}. The invariant “a[lo−1] &lt; a[lo] and a[hi] &gt; a[hi+1]” with lo == hi means <b>a[${lo}] = ${arr[lo]} is a peak</b>. Other peaks may exist; we only promised one.` });
      return fr;
    },
    render: (f) => {
      const cls = (i) => (f.done && i === f.lo ? "done" : i === f.mid ? "active" : i === f.mid + 1 ? "visit" : i < f.lo || i > f.hi ? "dim" : "");
      return wrap("bs-stack bs-center", Viz.bars(f.arr, { cls, height: 120 }) + Viz.array(f.arr, { ptrs: { lo: f.lo, mid: f.mid, hi: f.hi }, cls }) +
        Viz.array(f.slope, { label: "slope to the right", showIdx: false, cls: (i) => (i < f.lo || i > f.hi ? "dim" : f.slope[i] === "↗" ? "bad" : "done") }));
    },
  }));
  /* 5. Search on the answer: Koko eating bananas. */
  Viz.register("binary-search-koko", (el) => Viz.player(el, {
    title: "Search on the answer: the smallest speed k that finishes within h hours",
    legend: [["active", "speed being tested / pile being eaten"], ["bad", "known too slow"], ["done", "known feasible"], ["window", "unknown"], ["path", "answer"]],
    codeLang: "python",
    code: [
      "def feasible(k):            # F…F T…T in k",
      "    hours = 0",
      "    for p in piles:",
      "        hours += (p + k - 1) // k  # ceil",
      "    return hours <= h",
      "lo, hi = 1, max(piles)      # max works",
      "while lo < hi:",
      "    k = lo + (hi - lo) // 2",
      "    if feasible(k): hi = k  # k works",
      "    else:           lo = k + 1",
      "return lo",
    ],
    inputs: [{ key: "p", label: "piles", value: "3,6,7,11", width: 160 }, { key: "h", label: "h (hours)", value: "8", width: 70 }],
    random: () => {
      const p = Viz.randInts(Viz.rand(3, 6), 1, 22);
      return { p: p.join(","), h: String(Viz.rand(p.length, p.length * 3)) };
    },
    build: ({ p, h }) => {
      const piles = Viz.parse.ints(p, { min: 1, max: 8 }), H = Viz.parse.int(h, { min: 1, max: 99 });
      if (piles.some((x) => x < 1 || x > 24)) throw new Error("Use pile sizes from 1 to 24 so every speed fits on screen.");
      if (H < piles.length) throw new Error(`h must be at least ${piles.length}: even at top speed each pile takes one hour.`);
      const max = Math.max(...piles), fr = [];
      const known = Array(max + 1).fill(null); known[max] = true;
      let lo = 1, hi = max;
      const push = (o) => fr.push({ piles, H, max, lo, hi, known: [...known], ...o });
      push({ line: 5, vars: { lo, hi, h: H }, note: `The answer is a <b>speed</b>, not an index. Any k ≥ ${max} eats every pile in one hour (${piles.length} ≤ ${H}), so the answer is in [1, ${max}]. feasible(k) only gets “more true” as k grows: F…F T…T.` });
      while (lo < hi) {
        const k = half(lo, hi), hrs = [];
        push({ k, hrs: [], line: [6, 7], vars: { lo, hi, k }, note: `Test the middle speed k = <b>${k}</b> by simulating it.` });
        let total = 0;
        piles.forEach((x, idx) => {
          const c = Math.ceil(x / k); total += c; hrs.push(c);
          push({ k, hrs: [...hrs], cur: idx, total, line: [2, 3], vars: { lo, hi, k, pile: x, "ceil(p/k)": c, hours: total }, note: `Pile ${x} at ${k}/hour takes ⌈${x}/${k}⌉ = ${c} hour(s). Running total: <b>${total}</b>${total > H ? ` &gt; ${H} already` : ""}.` });
        });
        const ok = total <= H;
        if (ok) { for (let s = k; s <= max; s++) known[s] = true; hi = k; }
        else { for (let s = 1; s <= k; s++) known[s] = false; lo = k + 1; }
        push({ k, hrs: [...hrs], total, ok, line: ok ? [4, 8] : [4, 9], vars: { lo, hi, k, hours: total, feasible: ok ? "T" : "F" }, note: ok
          ? `${total} ≤ ${H}: speed ${k} is <b>feasible</b>, and so is every faster speed. Mark ${k}…${max} T; the minimum is ≤ ${k}: hi = ${k}.`
          : `${total} &gt; ${H}: speed ${k} is <b>too slow</b>, and so is every slower speed. Mark 1…${k} F: lo = ${lo}.` });
      }
      push({ final: true, line: 10, vars: { lo, hi, answer: lo }, note: `lo == hi == ${lo}: the boundary between “too slow” and “fast enough”. Koko needs speed <b>${lo}</b>. We simulated only ${fr.filter((x) => x.ok !== undefined).length} speeds instead of all ${max}.` });
      return fr;
    },
    render: (f) => {
      const speeds = Array.from({ length: f.max }, (_, i) => i + 1);
      const state = (s) => (f.final && s === f.lo ? "path" : s === f.k && f.ok === undefined ? "active" : f.known[s] === true ? "done" : f.known[s] === false ? "bad" : s < f.lo || s > f.hi ? "dim" : "window");
      const strip = wrap("bs-compact", Viz.array(speeds, { label: "speed k  (feasible?)", showIdx: false, ptrs: f.final ? {} : { lo: f.lo - 1, k: f.k ? f.k - 1 : null, hi: f.hi - 1 }, cls: (i) => state(i + 1) })
        + Viz.array(speeds.map((s) => (f.known[s] === true ? "T" : f.known[s] === false ? "F" : "?")), { showIdx: false, cls: (i) => state(i + 1) }));
      if (!f.k) return Viz.row(strip);
      const rows = [f.piles, f.piles.map((_, i) => (i < f.hrs.length ? f.hrs[i] : ""))];
      const sim = Viz.grid(rows.map((r, ri) => [...r, ri === 0 ? "" : f.hrs.length ? `${f.total}${f.hrs.length === f.piles.length ? (f.total <= f.H ? " ≤ " : " > ") + f.H : ""}` : ""]), {
        label: `simulate feasible(${f.k})`, rowLabels: ["pile", "hours"], colLabels: [...f.piles.map((_, i) => `#${i}`), "Σ"],
        cls: (r, c) => (c === f.piles.length ? (r === 1 && f.ok !== undefined ? (f.ok ? "done" : "bad") : "") : c === f.cur ? "active" : r === 1 && c < f.hrs.length ? "visit" : ""),
      });
      return Viz.row(strip, sim);
    },
  }));
  /* 6. Median of two sorted arrays: binary search on the cut position i in the shorter array. */
  Viz.register("binary-search-median", (el) => Viz.player(el, {
    title: "Median of two sorted arrays: binary search the partition, not the values",
    tag: "EXPERT · STEP THROUGH",
    legend: [["visit", "left half of the merged order"], ["active", "compared pair"], ["bad", "p(i) = F"], ["done", "p(i) = T / median"], ["window", "cut not yet decided"]],
    codeLang: "python",
    code: [
      "if len(A) > len(B): A, B = B, A   # shorter",
      "m, n = len(A), len(B); half = (m+n+1) // 2",
      "lo, hi = 0, m        # i = A's left count",
      "while lo < hi:",
      "    i = lo + (hi - lo) // 2; j = half - i",
      "    if A[i] >= B[j - 1]: hi = i  # p(i) is T",
      "    else:                lo = i + 1",
      "i = lo; j = half - i",
      "left_max = max(A[i-1] if i else -inf,",
      "               B[j-1] if j else -inf)",
      "right_min = min(A[i] if i < m else inf,",
      "                B[j] if j < n else inf)",
      "if (m + n) % 2: return left_max",
      "return (left_max + right_min) / 2",
    ],
    inputs: [{ key: "a", label: "A (sorted)", value: "1,4,7,9,12", width: 160 }, { key: "b", label: "B (sorted)", value: "2,3,5,8,10,11,15", width: 190 }],
    random: () => ({ a: sortedRand(Viz.rand(2, 6), 1, 40).join(","), b: sortedRand(Viz.rand(3, 9), 1, 40).join(",") }),
    build: ({ a, b }) => {
      const parse = (s) => (String(s).trim() === "" ? [] : Viz.parse.ints(s, { min: 0, max: 12 }));
      let A = parse(a), B = parse(b);
      ensureSorted(A); ensureSorted(B);
      if (!A.length && !B.length) throw new Error("At least one array must be non-empty.");
      const swapped = A.length > B.length;
      if (swapped) [A, B] = [B, A];
      const m = A.length, n = B.length, halfN = (m + n + 1) >> 1, fr = [];
      const merged = [...A, ...B].sort((x, y) => x - y);
      const known = Array(m + 1).fill(null);
      let lo = 0, hi = m;
      const push = (o) => fr.push({ A, B, m, n, halfN, lo, hi, merged, known: [...known], ...o });
      push({ line: [0, 1], vars: { m, n, half: halfN }, note: `${swapped ? "A was longer, so swap: always search the <b>shorter</b> array. " : ""}The left half of the merged order needs exactly <b>half = ${halfN}</b> elements. If i of them come from A, then j = half − i come from B, so choosing <b>i</b> (0…${m}) decides everything.` });
      while (lo < hi) {
        const i = half(lo, hi), j = halfN - i, p = A[i] >= B[j - 1];
        push({ i, j, cmp: true, line: 4, vars: { lo, hi, i, j, "A[i]": A[i], "B[j-1]": B[j - 1] }, note: `Try i = ${i}: take A[0..${i - 1}] and B[0..${j - 1}] as the left half. A valid cut needs every left value ≤ every right value. The test that grows monotonically with i is <b>A[i] ≥ B[j−1]</b>: ${A[i]} vs ${B[j - 1]}.` });
        if (p) { for (let s = i; s <= m; s++) known[s] = true; hi = i; }
        else { for (let s = 0; s <= i; s++) known[s] = false; lo = i + 1; }
        push({ i, j, p, cmp: true, line: p ? 5 : 6, vars: { lo, hi, i, j, "p(i)": p ? "T" : "F" }, note: p
          ? `${A[i]} ≥ ${B[j - 1]}: A's right side is not smaller than B's left side. That stays true for larger i (A[i] grows, B[j−1] shrinks), so the first true cut is ≤ ${i}: hi = ${i}.`
          : `${A[i]} &lt; ${B[j - 1]}: an element of A on the right is smaller than one of B on the left — too few of A on the left. lo = ${lo}.` });
      }
      const i = lo, j = halfN - i;
      const lmax = Math.max(i > 0 ? A[i - 1] : -Infinity, j > 0 ? B[j - 1] : -Infinity);
      const rmin = Math.min(i < m ? A[i] : Infinity, j < n ? B[j] : Infinity);
      const med = (m + n) % 2 ? lmax : (lmax + rmin) / 2;
      push({ i, j, final: true, line: [7, 8, 9, 10, 11], vars: { i, j, left_max: lmax, right_min: rmin }, note: `First true cut: i = ${i}, j = ${j}. Because i−1 was false, A[i−1] &lt; B[j] too, so <b>every left value ≤ every right value</b>. left_max = ${Viz.fmt(lmax)}, right_min = ${Viz.fmt(rmin)}.` });
      push({ i, j, final: true, med: true, line: (m + n) % 2 ? 12 : 13, vars: { i, j, median: med }, note: `${(m + n) % 2 ? `Odd total (${m + n}): the median is left_max = <b>${med}</b>.` : `Even total (${m + n}): median = (${lmax} + ${rmin}) / 2 = <b>${med}</b>.`} O(log min(m, n)) — we never merged anything (the merged row is shown only to check).` });
      return fr;
    },
    render: (f) => {
      const side = (arr, cut, isA) => (k) => {
        const cmpCell = f.cmp && (isA ? k === f.i : k === f.j - 1);
        let c = cmpCell ? (f.p === undefined ? "active" : f.p ? "done" : "bad") : k < cut ? "visit" : "";
        if (k === cut) c += " bs-cut";
        if (cut === arr.length && k === arr.length - 1) c += " bs-cut-after";
        return c.trim();
      };
      const cutA = f.i ?? -1, cutB = f.j ?? -1;
      const parts = [];
      parts.push(f.A.length ? Viz.array(f.A, { label: `A  (i = ${f.i ?? "?"} on the left)`, cls: side(f.A, cutA, true) }) : Viz.labeled("A", '<span class="bs-empty">empty</span>'));
      parts.push(Viz.array(f.B, { label: `B  (j = ${f.j ?? "?"} on the left)`, cls: side(f.B, cutB, false) }));
      const cand = Array.from({ length: f.m + 1 }, (_, k) => k);
      const strip = Viz.array(cand.map((k) => (f.known[k] === true ? "T" : f.known[k] === false ? "F" : "?")), {
        label: "cut i in A:  p(i) = A[i] ≥ B[j−1]", idxLabel: (k) => `i=${k}`,
        ptrs: f.final ? { i: f.i } : { lo: f.lo, hi: f.hi },
        cls: (k) => (f.final && k === f.i ? "path" : k === f.i && f.p === undefined && f.cmp ? "active" : f.known[k] === true ? "done" : f.known[k] === false ? "bad" : "window"),
      });
      const mergedRow = f.final ? Viz.array(f.merged, { label: "merged (for checking only)", showIdx: false, cls: (k) => {
        const L = f.halfN, odd = f.merged.length % 2;
        if (f.med && (k === L - 1 || (!odd && k === L))) return "done";
        return k < L ? "visit" : "";
      } }) : "";
      return wrap("bs-stack bs-center bs-code-cap", parts.join("") + wrap("bs-gap", strip) + mergedRow);
    },
  }));
  /* 7. Real-valued bisection: sqrt(x). */
  const num = (v) => (Number.isInteger(v) ? String(v) : Number(v.toPrecision(9)).toString());
  const n7 = (v) => (Number.isInteger(v) ? String(v) : Number(v.toPrecision(7)).toString());
  function plot(f) {
    const W = 520, H = 230, L = 52, R = 14, T = 12, B = 30, pw = W - L - R, ph = H - T - B;
    const xs = (m) => L + (m / f.R) * pw, ys = (y) => T + ph - (Math.min(y, f.yMax) / f.yMax) * ph;
    const pts = [];
    for (let s = 0; s <= 120; s++) { const m = (f.R * s) / 120; pts.push(`${xs(m).toFixed(1)},${ys(m * m).toFixed(1)}`); if (m * m > f.yMax) break; }
    const band = `<rect class="bs-band" x="${xs(f.lo).toFixed(1)}" y="${T}" width="${Math.max(1.5, xs(f.hi) - xs(f.lo)).toFixed(1)}" height="${ph}"/>`;
    const mid = f.mid !== undefined ? `<line class="bs-mid" x1="${xs(f.mid)}" x2="${xs(f.mid)}" y1="${T}" y2="${T + ph}"/><circle class="bs-pt ${f.mid * f.mid >= f.x ? "hi" : "lo"}" cx="${xs(f.mid)}" cy="${ys(f.mid * f.mid)}" r="5"/>` : "";
    const ticks = [0, f.R / 2, f.R].map((m) => `<text class="bs-tk" x="${xs(m)}" y="${T + ph + 18}" text-anchor="middle">${num(m)}</text>`).join("");
    return `<svg class="bs-plot" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Bisection on m squared">
      ${band}<line class="bs-axis" x1="${L}" y1="${T + ph}" x2="${L + pw}" y2="${T + ph}"/><line class="bs-axis" x1="${L}" y1="${T}" x2="${L}" y2="${T + ph}"/>
      <line class="bs-target" x1="${L}" x2="${L + pw}" y1="${ys(f.x)}" y2="${ys(f.x)}"/><text class="bs-tk" x="${L - 6}" y="${ys(f.x) + 4}" text-anchor="end">x=${num(f.x)}</text>
      <polyline class="bs-curve" points="${pts.join(" ")}"/>${mid}${ticks}
      <text class="bs-tk" x="${L + pw * 0.58}" y="${T + 12}" text-anchor="middle">curve: y = m²</text></svg>`;
  }
  Viz.register("binary-search-sqrt", (el) => Viz.player(el, {
    title: "Real-valued bisection: √x by halving an interval until it is narrower than ε",
    legend: [["visit", "interval [lo, hi] still containing √x"], ["active", "mid"], ["path", "the curve m²"]],
    codeLang: "python",
    code: [
      "lo, hi = 0.0, max(1.0, x)   # √x in [lo, hi]",
      "while hi - lo > eps:        # or 100 rounds",
      "    mid = (lo + hi) / 2",
      "    if mid * mid >= x: hi = mid  # √x <= mid",
      "    else:              lo = mid  # no +1",
      "return (lo + hi) / 2",
    ],
    inputs: [{ key: "x", label: "x", value: "2", width: 80 }, { key: "eps", label: "ε", value: "0.0001", width: 90 }],
    random: () => ({ x: String(pick([2, 3, 5, 10, 0.5, 0.2, 50, 99, 777])), eps: pick(["0.01", "0.001", "0.0001", "0.000001"]) }),
    build: ({ x, eps }) => {
      const X = Number(x), E = Number(eps);
      if (!(X > 0 && X <= 10000)) throw new Error("Use x with 0 < x ≤ 10000.");
      if (!(E >= 1e-9 && E <= 1)) throw new Error("Use ε between 1e-9 and 1.");
      const Rr = Math.max(1, X), base = { x: X, R: Rr, yMax: Math.min(Rr * Rr, 2 * X) }, fr = [], hist = [];
      let lo = 0, hi = Rr;
      fr.push({ ...base, lo, hi, hist: [], line: 0, vars: { lo, hi, x: X, eps: E }, note: `√${num(X)} is somewhere in [0, ${num(Rr)}] (for x &lt; 1, √x &gt; x, which is why hi starts at max(1, x)). The predicate p(m) = m² ≥ x is F then T along the real line.` });
      let it = 0;
      while (hi - lo > E) {
        const mid = (lo + hi) / 2, p = mid * mid >= X; it++;
        hist.push([it, n7(lo), n7(hi), n7(mid), n7(mid * mid), p ? "hi = mid" : "lo = mid"]);
        if (p) hi = mid; else lo = mid;
        fr.push({ ...base, lo, hi, mid, hist: hist.slice(-6), line: [2, p ? 3 : 4], vars: { it, mid: num(mid), "mid²": num(mid * mid), width: num(hi - lo) }, note: `${num(mid)}² = ${num(mid * mid)} ${p ? "≥" : "&lt;"} ${num(X)}: √x is ${p ? "at or left of" : "right of"} mid, so <b>${p ? "hi" : "lo"} = mid</b>. The interval halves to width ${num(hi - lo)}.` });
      }
      const ans = (lo + hi) / 2;
      fr.push({ ...base, lo, hi, hist: hist.slice(-6), done: true, line: 5, vars: { iterations: it, answer: num(ans), "Math.sqrt": num(Math.sqrt(X)) }, note: `Width ≤ ε after <b>${it}</b> halvings (⌈log₂(${num(Rr)}/ε)⌉). Answer ≈ <b>${num(ans)}</b>; true √x = ${num(Math.sqrt(X))}. No off-by-one exists for reals: the loop ends by width (or a fixed iteration count), never by lo == hi.` });
      return fr;
    },
    render: (f) => Viz.row(wrap("bs-plotwrap", plot(f)), Viz.grid(f.hist.length ? f.hist : [["", "", "", "", "", ""]], {
      label: "last iterations", colLabels: ["#", "lo", "hi", "mid", "mid²", "keep"],
      cls: (r, c) => (r === f.hist.length - 1 && !f.done ? (c === 5 ? "active" : "") : ""),
    })),
  }));
})();
