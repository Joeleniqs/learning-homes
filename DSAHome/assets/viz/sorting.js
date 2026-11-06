/* Sorting visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const ints = (s, min, max, lo, hi) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((v) => !Number.isInteger(v) || v < lo || v > hi)) throw new Error(`Use whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const randArr = (n, lo, hi) => {
    const r = Math.random(), a = Viz.randInts(n, lo, hi);
    if (r < 0.12) return a.sort((x, y) => x - y);
    if (r < 0.22) return a.sort((x, y) => y - x);
    if (r < 0.35) { a.sort((x, y) => x - y); const i = Viz.rand(0, n - 2); [a[i], a[i + 1]] = [a[i + 1], a[i]]; return a; }
    return a;
  };
  const countInv = (a) => { let c = 0; for (let i = 0; i < a.length; i++) for (let j = i + 1; j < a.length; j++) if (a[i] > a[j]) c++; return c; };

  /* Bars as SVG with pointer labels (two label rows so neighbours never collide), range boxes and a pivot line. */
  function bars(a, o = {}) {
    const W = o.w || 34, G = 6, H = o.h || 130, top = 14, n = a.length;
    const mx = Math.max(1, ...a.map((v) => Math.abs(v)));
    const hasPl = o.pivotLine !== undefined && o.pivotLine !== null;
    const barsW = n * (W + G) + G, width = barsW + (hasPl ? 62 : 0), height = top + H + 60;
    const X = (i) => G + i * (W + G), Y = (v) => top + H - Math.max(3, (Math.abs(v) / mx) * H);
    let s = `<svg class="so-svg" viewBox="0 0 ${width} ${height}" width="${width}" height="${height}" role="img" aria-label="${esc(o.label || "bars")}">`;
    for (const [l, r, c] of o.ranges || []) if (l <= r) s += `<rect class="so-range ${c || ""}" x="${X(l) - 3}" y="2" width="${X(r) - X(l) + W + 6}" height="${top + H + 22}" rx="6"/>`;
    a.forEach((v, i) => {
      s += `<rect class="so-bar ${o.cls ? o.cls(i, v) : ""}" x="${X(i)}" y="${Y(v)}" width="${W}" height="${top + H - Y(v)}" rx="3"/>`;
      s += `<text class="so-v" x="${X(i) + W / 2}" y="${top + H + 15}">${esc(v)}</text>`;
    });
    if (hasPl) {
      const y = Y(o.pivotLine);
      s += `<line class="so-pl" x1="0" x2="${barsW + 2}" y1="${y}" y2="${y}"/><text class="so-pl-t" x="${barsW + 6}" y="${y + 4}">pivot ${esc(o.pivotLine)}</text>`;
    }
    const ptr = {};
    for (const [k, i] of Object.entries(o.ptrs || {})) if (i !== null && i !== undefined && i >= 0 && i < n) (ptr[i] ||= []).push(k);
    let prevIdx = -9, prevRow = 1;
    Object.keys(ptr).map(Number).sort((x, y) => x - y).forEach((i) => {
      const row = i === prevIdx + 1 && prevRow === 0 ? 1 : 0;
      s += `<text class="so-ptr" x="${X(i) + W / 2}" y="${top + H + 33 + row * 14}">↑${esc(ptr[i].join(","))}</text>`;
      prevIdx = i; prevRow = row;
    });
    return `<div class="v-labeled">${o.caption ? `<span class="v-caption">${esc(o.caption)}</span>` : ""}${s}</svg></div>`;
  }
  const stats = (o) => `<div class="so-stats">${Object.entries(o).map(([k, v]) => `<div class="so-stat"><span>${esc(k)}</span><b>${esc(Viz.fmt(v))}</b></div>`).join("")}</div>`;
  const col = (...parts) => `<div class="so-col">${parts.filter(Boolean).join("")}</div>`;

  /* ───────── 1–3: bubble, selection, insertion ───────── */
  const ELEM = {
    bubble: {
      title: "Bubble sort: each pass floats the largest unsorted value to the end",
      legend: [["active", "comparing a[j], a[j+1]"], ["bad", "just swapped"], ["done", "final position"]],
      code: [
        "for i in range(n - 1):",
        "    swapped = False",
        "    for j in range(n - 1 - i):",
        "        if a[j] > a[j + 1]:",
        "            a[j], a[j + 1] = a[j + 1], a[j]",
        "            swapped = True",
        "    if not swapped: break  # sorted already",
      ],
      run(a, push, C) {
        const n = a.length;
        C.doneFrom = n;
        push({ line: 0, note: "Bubble sort only ever compares <b>neighbours</b> and swaps a pair that is out of order. Each pass carries the largest unsorted value all the way to the right, like a bubble rising." });
        for (let i = 0; i < n - 1; i++) {
          let swapped = false;
          push({ line: [0, 1], vars: { i }, note: `Pass ${i + 1}: scan a[0..${n - 1 - i}]. Everything to the right of index ${n - 1 - i} is already final.` });
          for (let j = 0; j < n - 1 - i; j++) {
            C.cmp++;
            const out = a[j] > a[j + 1];
            push({ pair: [j, j + 1], ptrs: { j }, line: 3, vars: { i, j, swapped }, note: out ? `a[${j}] = ${a[j]} &gt; a[${j + 1}] = ${a[j + 1]}: this neighbour pair is an <b>inversion</b>.` : `${a[j]} ≤ ${a[j + 1]}: in order. Equal values are never swapped, which is why bubble sort is <b>stable</b>.` });
            if (out) {
              [a[j], a[j + 1]] = [a[j + 1], a[j]]; C.sw++; swapped = true;
              push({ swapped: [j, j + 1], ptrs: { j }, line: [4, 5], vars: { i, j, swapped }, note: `Swap. That removes exactly one inversion. The larger value ${a[j + 1]} keeps travelling right.` });
            }
          }
          if (!swapped) { C.doneFrom = 0; push({ line: 6, vars: { i, swapped }, note: "A whole pass with <b>no swaps</b>: every neighbour pair is in order, so the array is sorted. Stopping here makes bubble sort O(n) on already-sorted input." }); break; }
          C.doneFrom = n - 1 - i;
          push({ line: 2, vars: { i, swapped }, note: `End of pass ${i + 1}: ${a[n - 1 - i]} was the largest unsorted value, so it now sits in its final slot ${n - 1 - i}.` });
        }
        C.doneFrom = 0;
      },
      cls: (f, k) => (f.swapped && f.swapped.includes(k) ? "bad" : f.pair && f.pair.includes(k) ? "active" : k >= f.doneFrom ? "done" : ""),
      end: (C, n, inv) => `Sorted with <b>${C.cmp}</b> comparisons and <b>${C.sw}</b> swaps. Every swap fixes exactly one adjacent inversion, so swaps = inversions in the input = ${inv}. Worst case: n(n−1)/2 = ${(n * (n - 1)) / 2} of each.`,
    },
    selection: {
      title: "Selection sort: find the minimum of the rest, swap it to the front",
      legend: [["active", "scanning a[j]"], ["path", "minimum so far (m)"], ["bad", "the one long swap"], ["done", "final prefix"]],
      code: [
        "for i in range(n - 1):",
        "    m = i  # min so far",
        "    for j in range(i + 1, n):",
        "        if a[j] < a[m]:",
        "            m = j",
        "    a[i], a[m] = a[m], a[i]  # 1 swap per pass",
      ],
      run(a, push, C) {
        const n = a.length;
        C.doneTo = 0;
        push({ line: 0, note: "Selection sort grows a <b>final</b> prefix from the left. Pass i scans the whole unsorted suffix for its minimum, then does a single swap. Comparisons never depend on the input order: always n(n−1)/2." });
        for (let i = 0; i < n - 1; i++) {
          let m = i;
          push({ m, ptrs: { i, m }, line: 1, vars: { i, m }, note: `Pass ${i + 1}: assume a[${i}] = ${a[i]} is the minimum of a[${i}..${n - 1}].` });
          for (let j = i + 1; j < n; j++) {
            C.cmp++;
            const less = a[j] < a[m];
            push({ m, j, ptrs: { i, m, j }, line: 3, vars: { i, m, j }, note: less ? `a[${j}] = ${a[j]} &lt; a[m] = ${a[m]}: a new minimum.` : `a[${j}] = ${a[j]} ≥ a[m] = ${a[m]}: keep m.` });
            if (less) { m = j; push({ m, j, ptrs: { i, m, j }, line: 4, vars: { i, m, j }, note: `m = ${j}.` }); }
          }
          [a[i], a[m]] = [a[m], a[i]];
          if (m !== i) C.sw++;
          C.doneTo = i + 1;
          push({ swapped: m !== i ? [i, m] : null, ptrs: { i, m }, line: 5, vars: { i, m }, note: m !== i ? `Swap a[${i}] ↔ a[${m}]. ${a[i]} is final. This long-distance swap can carry ${a[m]} past an equal value, which is why selection sort is <b>not stable</b>.` : `The minimum was already at ${i}: no swap. ${a[i]} is final.` });
        }
        C.doneTo = n;
      },
      cls: (f, k) => (f.swapped && f.swapped.includes(k) ? "bad" : k === f.j ? "active" : k === f.m ? "path" : k < f.doneTo ? "done" : ""),
      end: (C, n) => `Sorted with <b>${C.cmp}</b> comparisons (always n(n−1)/2 = ${(n * (n - 1)) / 2}, even for sorted input) but only <b>${C.sw}</b> swaps (at most n − 1). Choose it only when writes are very expensive.`,
    },
    insertion: {
      title: "Insertion sort: lift the next card, slide it left into the sorted hand",
      legend: [["active", "key (lifted, sliding left)"], ["visit", "compared with key"], ["window", "sorted prefix"], ["done", "finished"]],
      code: [
        "for i in range(1, n):",
        "    key, j = a[i], i - 1  # lift key out",
        "    while j >= 0 and a[j] > key:",
        "        a[j + 1] = a[j]  # shift right",
        "        j -= 1",
        "    a[j + 1] = key  # drop into hole",
      ],
      run(a, push, C) {
        const n = a.length;
        C.sortedTo = 0;
        push({ line: 0, note: "Like sorting a hand of cards: a[0..i) is always sorted. Take the next card, slide it left past every larger card, and drop it in the gap. Nearly-sorted input means very little sliding." });
        for (let i = 1; i < n; i++) {
          const key = a[i];
          let j = i - 1, hole = i;
          push({ hole, ptrs: { i }, line: [0, 1], vars: { i, key, j }, note: `a[0..${i - 1}] is sorted. Lift key = <b>${key}</b> out of slot ${i}; that slot becomes a hole that will move left.` });
          for (;;) {
            if (j < 0) { push({ hole, ptrs: { i }, line: 2, vars: { i, key, j }, note: `j = −1: ${key} is smaller than everything in the prefix, so it goes to the very front.` }); break; }
            C.cmp++;
            if (a[j] > key) {
              push({ hole, cmpIdx: j, ptrs: { i, j }, line: 2, vars: { i, key, j }, note: `a[${j}] = ${a[j]} &gt; ${key}: it must move one slot right to make room.` });
              a[hole] = a[j]; a[j] = key; hole = j; C.sw++; j--;
              push({ hole, moved: hole + 1, ptrs: { i, j: j >= 0 ? j : null }, line: [3, 4], vars: { i, key, j }, note: `Shift ${a[hole + 1]} right; the hole is now at ${hole}.` });
            } else {
              push({ hole, cmpIdx: j, ptrs: { i, j }, line: 2, vars: { i, key, j }, note: `a[${j}] = ${a[j]} ≤ ${key}: stop. ${a[j] === key ? "Stopping on <i>equal</i> keeps equal values in their original order: insertion sort is stable." : "Everything further left is even smaller (the prefix is sorted)."}` });
              break;
            }
          }
          C.sortedTo = i;
          push({ hole, placed: true, ptrs: { i }, line: 5, vars: { i, key, j }, note: `Drop ${key} into slot ${hole}. a[0..${i}] is sorted. It moved ${i - hole} place(s): one per larger value in front of it, i.e. one per inversion it was part of.` });
        }
        C.sortedTo = n;
      },
      cls: (f, k) => (f.fin ? "done" : k === f.hole ? (f.placed ? "done" : "active") : k === f.cmpIdx ? "visit" : k <= f.sortedTo ? "window" : ""),
      end: (C, n, inv) => `Sorted with ${C.cmp} comparisons and <b>${C.sw}</b> shifts. Shifts = inversions = ${inv}, so the cost is O(n + inversions): linear on nearly-sorted data. That is why Timsort and introsort finish small runs with insertion sort.`,
    },
  };
  for (const [name, M] of Object.entries(ELEM)) {
    Viz.register(`sorting-${name}`, (el) => Viz.player(el, {
      title: M.title, legend: M.legend, codeLang: "python", code: M.code,
      inputs: [{ key: "a", label: "values (2–14, 1–99)", value: name === "insertion" ? "5,2,4,6,1,3,8,7" : "6,3,8,2,9,1,5" }],
      random: () => ({ a: randArr(Viz.rand(6, 11), 1, 40).join(",") }),
      build: ({ a }) => {
        const arr = ints(a, 2, 14, 1, 99), inv = countInv(arr), n = arr.length, fr = [];
        const C = { cmp: 0, sw: 0 };
        const push = (x) => fr.push({ a: arr.slice(), ...C, ...x, vars: { ...(x.vars || {}), comparisons: C.cmp, [name === "insertion" ? "shifts" : "swaps"]: C.sw } });
        M.run(arr, push, C);
        push({ fin: true, line: [], note: M.end(C, n, inv) });
        return fr;
      },
      render: (f) => col(
        bars(f.a, { caption: "array", ptrs: f.ptrs || {}, cls: (k) => (f.fin ? "done" : M.cls(f, k)) }),
        stats({ comparisons: f.cmp, [name === "insertion" ? "shifts" : "swaps"]: f.sw }),
      ),
    }));
  }

  /* ───────── 4–5: merge sort tree, and inversion counting ───────── */
  const mergeViz = (count) => (el) => Viz.player(el, {
    title: count ? "Count inversions while merging: a right-half win jumps every remaining left value" : "Merge sort: split to singletons, then merge sorted halves back up the tree",
    tag: count ? "MERGE SORT · INVERSIONS" : "DIVIDE AND CONQUER",
    legend: count
      ? [["active", "heads being compared"], ["bad", "left values jumped (each is one inversion)"], ["visit", "written to the merged output"], ["dim", "already consumed"], ["done", "sorted node"]]
      : [["active", "heads being compared"], ["visit", "written to the merged output"], ["dim", "already consumed"], ["done", "sorted node"], ["path", "being split"]],
    codeLang: "python",
    code: [
      "def merge_sort(lo, hi):",
      "    if lo >= hi: return  # size 1: sorted",
      "    mid = (lo + hi) // 2",
      "    merge_sort(lo, mid); merge_sort(mid + 1, hi)",
      "    i, j, out = lo, mid + 1, []",
      "    while i <= mid and j <= hi:",
      "        if a[i] <= a[j]: out += [a[i]]; i += 1",
      count ? "        else: inv += mid-i+1; out += [a[j]]; j+=1" : "        else: out += [a[j]]; j += 1",
      "    out += a[i:mid + 1] + a[j:hi + 1]",
      "    a[lo:hi + 1] = out",
    ],
    inputs: [{ key: "a", label: "values (2–12, 0–99)", value: count ? "8,4,2,1,7,3" : "38,27,43,3,9,82,10,15" }],
    random: () => ({ a: Viz.randInts(Viz.rand(5, count ? 8 : 10), 1, count ? 20 : 99).join(",") }),
    build: ({ a }) => {
      const arr = ints(a, 2, 12, 0, 99), n = arr.length, work = arr.slice(), fr = [];
      const nodes = new Map();
      let depth = 0;
      const mk = (lo, hi, d) => {
        nodes.set(`${lo}-${hi}`, { lo, hi, d, vals: arr.slice(lo, hi + 1), st: "idle" }); depth = Math.max(depth, d + 1);
        if (lo < hi) { const mid = (lo + hi) >> 1; mk(lo, mid, d + 1); mk(mid + 1, hi, d + 1); }
      };
      mk(0, n - 1, 0);
      let inv = 0, cmp = 0;
      const snap = (x) => ({ n, depth, nodes: [...nodes.values()].map((o) => ({ ...o, vals: o.vals.slice() })), inv, cmp, ...x, vars: { ...(x.vars || {}), ...(count ? { inv } : { comparisons: cmp }) } });
      fr.push(snap({ line: 0, note: count ? `An <b>inversion</b> is a pair i &lt; j with a[i] &gt; a[j]. Brute force checks all ${(n * (n - 1)) / 2} pairs. Merge sort finds them in batches: every inversion is either inside a half (counted by recursion) or <b>crosses</b> the halves (counted during the merge).` : "Each row is one level of the recursion. Going down, we only split; nothing is compared. Coming back up, each node merges two already-sorted children. log₂ n levels × n work per level = O(n log n)." }));
      const sort = (lo, hi) => {
        const key = `${lo}-${hi}`, N = nodes.get(key);
        if (lo >= hi) { N.st = "sorted"; fr.push(snap({ cur: key, line: 1, vars: { lo, hi }, note: `[${work[lo]}] has one element, so it is sorted. This base case is what stops the recursion.` })); return; }
        const mid = (lo + hi) >> 1;
        N.st = "split";
        fr.push(snap({ cur: key, line: [2, 3], vars: { lo, mid, hi }, note: `Split a[${lo}..${hi}] at mid = ${mid}. Nothing is compared yet: we trust the recursion to sort each half.` }));
        sort(lo, mid); sort(mid + 1, hi);
        const Lk = `${lo}-${mid}`, Rk = `${mid + 1}-${hi}`;
        N.st = "merging"; N.vals = Array(hi - lo + 1).fill(null);
        let i = lo, j = mid + 1, k = 0;
        const base = { cur: key, Lk, Rk };
        fr.push(snap({ ...base, pi: 0, pj: 0, line: 4, vars: { lo, mid, hi, i, j }, note: `Both halves are sorted: [${work.slice(lo, mid + 1).join(", ")}] and [${work.slice(mid + 1, hi + 1).join(", ")}]. The smallest remaining value must be one of the two <b>heads</b>, so one comparison picks it.` }));
        while (i <= mid && j <= hi) {
          cmp++;
          if (work[i] <= work[j]) {
            N.vals[k++] = work[i]; i++;
            fr.push(snap({ ...base, pi: i - lo, pj: j - mid - 1, wrote: k - 1, line: 6, vars: { lo, mid, hi, i, j }, note: `${work[i - 1]} ≤ ${work[j]}: take the left head.${work[i - 1] === work[j] ? " On a tie we take <b>left</b>, so equal values keep their order: merge sort is stable." : ""}${count ? " Taking from the left creates no new cross inversion." : ""}` }));
          } else {
            const jumped = mid - i + 1;
            if (count) inv += jumped;
            N.vals[k++] = work[j]; j++;
            fr.push(snap({ ...base, pi: i - lo, pj: j - mid - 1, wrote: k - 1, jumped: count ? [i - lo, mid - lo] : null, line: 7, vars: { lo, mid, hi, i, j }, note: count ? `${work[j - 1]} &lt; ${work[i]}: the right head wins. Because the left half is sorted, <b>every</b> remaining left value (${work.slice(i, mid + 1).join(", ")}) is larger than ${work[j - 1]} and sits before it: ${jumped} inversion(s) counted in one step. inv = ${inv}.` : `${work[j - 1]} &lt; ${work[i]}: take the right head.` }));
          }
        }
        const rest = [...work.slice(i, mid + 1), ...work.slice(j, hi + 1)];
        if (rest.length) {
          for (const v of rest) N.vals[k++] = v;
          fr.push(snap({ ...base, pi: mid - lo + 1, pj: hi - mid, line: 8, vars: { lo, mid, hi }, note: `One half is exhausted. The leftovers [${rest.join(", ")}] are already sorted and larger than everything written, so they are copied as a block.${count && i <= mid ? " (Left leftovers jumped over nothing new: they were already counted.)" : ""}` }));
        }
        for (let t = 0; t < N.vals.length; t++) work[lo + t] = N.vals[t];
        N.st = "sorted";
        fr.push(snap({ cur: key, line: 9, vars: { lo, mid, hi }, note: `a[${lo}..${hi}] = [${N.vals.join(", ")}] is sorted. ${hi - lo + 1} values written at this node: each level of the tree writes n values in total.` }));
      };
      sort(0, n - 1);
      fr.push(snap({ fin: true, line: [], note: count ? `Total inversions: <b>${inv}</b>. Brute force over all pairs agrees: ${countInv(arr)}. O(n log n) instead of O(n²), and the array is sorted as a bonus.` : `Sorted: [${work.join(", ")}] with ${cmp} comparisons. ${depth} levels; at most n − 1 comparisons per level, so O(n log n) in every case. The price: O(n) extra space for <code>out</code>.` }));
      return fr;
    },
    render: (f) => {
      const rows = [];
      for (let d = 0; d < f.depth; d++) {
        const segs = f.nodes.filter((nd) => nd.d === d).map((nd) => {
          const key = `${nd.lo}-${nd.hi}`;
          const role = key === f.cur ? "cur" : key === f.Lk ? "L" : key === f.Rk ? "R" : "";
          const cells = nd.vals.map((v, t) => {
            let c = "";
            if (role === "L") c = t < f.pi ? "dim" : f.jumped && t >= f.jumped[0] && t <= f.jumped[1] ? "bad" : t === f.pi ? "active" : "";
            if (role === "R") c = t < f.pj ? "dim" : t === f.pj ? "active" : "";
            if (role === "cur" && nd.st === "merging") c = v === null ? "empty" : t === f.wrote ? "visit new" : "visit";
            if (f.fin && d === 0) c = "done";
            return `<span class="so-c ${c}">${v === null ? "" : esc(v)}</span>`;
          }).join("");
          const st = role === "cur" ? `${nd.st} cur` : role ? `${nd.st} kid` : nd.st;
          return `<div class="so-seg ${st}" style="grid-column:${nd.lo + 1} / ${nd.hi + 2}">${cells}</div>`;
        }).join("");
        rows.push(`<div class="so-lvl"><span class="so-depth">depth ${d}</span><div class="so-lgrid" style="grid-template-columns:repeat(${f.n}, 44px)">${segs}</div></div>`);
      }
      const tree = `<div class="so-tree">${rows.join("")}</div>`;
      return col(tree, count ? stats({ "inversions counted": f.inv, "cross pairs this step": f.jumped ? f.jumped[1] - f.jumped[0] + 1 : 0 }) : stats({ comparisons: f.cmp }));
    },
  });
  Viz.register("sorting-merge", mergeViz(false));
  Viz.register("sorting-inversions", mergeViz(true));

  /* ───────── pivot helpers ───────── */
  const PIVOTS = ["last", "first", "middle", "median of 3", "random"];
  const choose = (a, lo, hi, mode) => {
    const mid = (lo + hi) >> 1;
    if (mode === "first") return lo;
    if (mode === "middle") return mid;
    if (mode === "random") return Viz.rand(lo, hi);
    if (mode === "median of 3") return [lo, mid, hi].sort((x, y) => a[x] - a[y] || x - y)[1];
    return hi;
  };

  /* ───────── 6: Lomuto partition ───────── */
  Viz.register("sorting-lomuto", (el) => Viz.player(el, {
    title: "Lomuto partition: one scanner, a growing \"smaller than pivot\" prefix",
    legend: [["path", "pivot"], ["visit", "a[lo..i): < pivot"], ["window", "a[i..j): ≥ pivot"], ["active", "j (scanning)"], ["done", "pivot's final slot"]],
    codeLang: "python",
    code: [
      "p = choose_pivot(lo, hi); swap(a, p, hi)",
      "pivot, i = a[hi], lo  # a[lo:i] < pivot",
      "for j in range(lo, hi):",
      "    if a[j] < pivot:",
      "        swap(a, i, j); i += 1  # grow <",
      "swap(a, i, hi)  # pivot lands at i",
      "return i",
    ],
    inputs: [{ key: "a", label: "values (2–14, 1–99)", value: "7,2,9,4,1,8,3,6,5" }, { key: "piv", label: "pivot rule", type: "select", options: PIVOTS, value: "last" }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 12), 1, 30).join(","), piv: PIVOTS[Viz.rand(0, 4)] }),
    build: ({ a, piv }) => {
      const arr = ints(a, 2, 14, 1, 99), n = arr.length, lo = 0, hi = n - 1, fr = [];
      let i = lo, cmp = 0, sw = 0;
      const snap = (x) => ({ a: arr.slice(), lo, hi, i, ...x, vars: { i, ...(x.vars || {}), comparisons: cmp, swaps: sw } });
      const p = choose(arr, lo, hi, piv);
      fr.push(snap({ pv: p, stage: "pick", line: 0, note: `Pivot rule "<b>${piv}</b>" picks a[${p}] = ${arr[p]}.${p !== hi ? " Lomuto expects the pivot at the end, so swap it there first." : " It is already at the end, where Lomuto expects it."}` }));
      if (p !== hi) { [arr[p], arr[hi]] = [arr[hi], arr[p]]; sw++; }
      const pivot = arr[hi];
      fr.push(snap({ pv: hi, j: lo, line: 1, vars: { pivot }, note: `pivot = ${pivot}. Invariant: a[lo..i) &lt; pivot and a[i..j) ≥ pivot. Both regions start empty.` }));
      for (let j = lo; j < hi; j++) {
        cmp++;
        if (arr[j] < pivot) {
          fr.push(snap({ pv: hi, j, line: 3, vars: { j, pivot }, note: `a[${j}] = ${arr[j]} &lt; ${pivot}: it belongs in the left region.` }));
          [arr[i], arr[j]] = [arr[j], arr[i]]; if (i !== j) sw++; i++;
          fr.push(snap({ pv: hi, j: j + 1, sw2: [i - 1, j], line: 4, vars: { j, pivot }, note: i - 1 === j ? `i = j, so the "swap" is with itself; i grows to ${i}.` : `Swap it with a[${i - 1}], the first ≥ value, which moves to the back of the ≥ region. i = ${i}.` }));
        } else {
          fr.push(snap({ pv: hi, j: j + 1, cur: j, line: 3, vars: { j, pivot }, note: `a[${j}] = ${arr[j]} ≥ ${pivot}: it already sits at the end of the ≥ region. Just advance j.` }));
        }
      }
      [arr[i], arr[hi]] = [arr[hi], arr[i]]; if (i !== hi) sw++;
      fr.push(snap({ placed: i, j: hi, line: [5, 6], vars: { pivot }, note: `Swap the pivot into slot ${i}, between the regions. <b>${pivot} is now in its final sorted position</b>: ${i - lo} smaller value(s) to its left, ${hi - i} to its right. ${cmp} comparisons, ${sw} swaps.` }));
      return fr;
    },
    render: (f) => {
      const j = f.j === undefined ? null : f.j;
      return bars(f.a, {
        caption: "partition a[lo..hi]",
        ptrs: { i: f.stage === "pick" ? null : f.i, j: j !== null && j < f.hi ? j : null, hi: f.hi },
        pivotLine: f.stage === "pick" ? null : f.a[f.placed !== undefined ? f.placed : f.hi],
        cls: (k) => {
          if (f.placed !== undefined) return k === f.placed ? "done" : k < f.placed ? "visit" : "window";
          if (k === f.pv) return "path";
          if (f.stage === "pick") return "";
          if (f.cur === k) return "active";
          if (j !== null && k === j && j < f.hi) return "active";
          if (k < f.i) return "visit";
          if (j !== null && k < j) return "window";
          return "";
        },
      });
    },
  }));

  /* ───────── 7: Hoare partition ───────── */
  Viz.register("sorting-hoare", (el) => Viz.player(el, {
    title: "Hoare partition: two scanners meet in the middle, swapping misfits",
    legend: [["path", "pivot value's current cell"], ["visit", "a[lo..i): ≤ pivot"], ["window", "a(j..hi]: ≥ pivot"], ["active", "i / j stopped on a misfit"], ["bad", "just swapped"], ["done", "split point"]],
    codeLang: "python",
    code: [
      "p = choose_pivot(lo, hi); swap(a, p, lo)",
      "pivot, i, j = a[lo], lo - 1, hi + 1",
      "while True:",
      "    i += 1",
      "    while a[i] < pivot: i += 1  # stop at ≥",
      "    j -= 1",
      "    while a[j] > pivot: j -= 1  # stop at ≤",
      "    if i >= j: return j  # split after j",
      "    a[i], a[j] = a[j], a[i]",
    ],
    inputs: [{ key: "a", label: "values (2–14, 1–99)", value: "7,2,9,4,1,8,3,6,5" }, { key: "piv", label: "pivot rule", type: "select", options: PIVOTS, value: "middle" }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 12), 1, 30).join(","), piv: PIVOTS[Viz.rand(0, 4)] }),
    build: ({ a, piv }) => {
      const arr = ints(a, 2, 14, 1, 99), n = arr.length, lo = 0, hi = n - 1, fr = [];
      let cmp = 0, sw = 0, i = lo - 1, j = hi + 1;
      const snap = (x) => ({ a: arr.slice(), lo, hi, i, j, ...x, vars: { i, j, ...(x.vars || {}), comparisons: cmp, swaps: sw } });
      const p = choose(arr, lo, hi, piv);
      fr.push(snap({ pv: p, stage: "pick", line: 0, note: `Pivot rule "<b>${piv}</b>" picks a[${p}] = ${arr[p]}. This version keeps the pivot value at the front${p !== lo ? ", so swap it there" : ""}. (With the pivot at the <i>end</i>, a pivot that is the unique maximum would make Hoare return j = hi and quicksort would recurse forever.)` }));
      if (p !== lo) { [arr[p], arr[lo]] = [arr[lo], arr[p]]; sw++; }
      const pivot = arr[lo];
      let pvIdx = lo;
      fr.push(snap({ pv: pvIdx, line: 1, vars: { pivot }, note: `pivot = ${pivot}. i starts left of the range and j right of it. i hunts for a value that belongs on the right (≥ pivot); j hunts for one that belongs on the left (≤ pivot).` }));
      for (;;) {
        i++; cmp++;
        while (arr[i] < pivot) { fr.push(snap({ pv: pvIdx, scan: "i", line: [3, 4], vars: { pivot }, note: `a[${i}] = ${arr[i]} &lt; ${pivot}: already on the correct side. i moves on.` })); i++; cmp++; }
        fr.push(snap({ pv: pvIdx, stopI: true, line: [3, 4], vars: { pivot }, note: `i stops at a[${i}] = ${arr[i]} ≥ ${pivot}: it ${arr[i] === pivot ? "equals the pivot. Stopping on equal values (not skipping them) is what keeps Hoare balanced when there are many duplicates" : "belongs on the right"}.` }));
        j--; cmp++;
        while (arr[j] > pivot) { fr.push(snap({ pv: pvIdx, stopI: true, scan: "j", line: [5, 6], vars: { pivot }, note: `a[${j}] = ${arr[j]} &gt; ${pivot}: already on the correct side. j moves on.` })); j--; cmp++; }
        fr.push(snap({ pv: pvIdx, stopI: true, stopJ: true, line: [5, 6], vars: { pivot }, note: `j stops at a[${j}] = ${arr[j]} ≤ ${pivot}.` }));
        if (i >= j) {
          fr.push(snap({ split: j, line: 7, vars: { pivot }, note: `i (${i}) ≥ j (${j}): the scanners crossed. Return <b>j = ${j}</b>: a[${lo}..${j}] ≤ ${pivot} ≤ a[${j + 1}..${hi}]. Unlike Lomuto, the pivot is <i>not</i> necessarily in its final slot, so quicksort recurses on [lo..j] and [j+1..hi]. ${sw} swaps versus Lomuto's typical ~n/2.` }));
          return fr;
        }
        [arr[i], arr[j]] = [arr[j], arr[i]]; sw++;
        if (pvIdx === i) pvIdx = j; else if (pvIdx === j) pvIdx = i;
        fr.push(snap({ pv: pvIdx, swp: [i, j], line: 8, vars: { pivot }, note: `Both are misfits, so one swap fixes two values at once: ${arr[i]} goes left, ${arr[j]} goes right.` }));
      }
    },
    render: (f) => bars(f.a, {
      caption: "partition a[lo..hi]",
      ptrs: f.stage === "pick" ? {} : { i: f.i >= 0 ? f.i : null, j: f.j < f.a.length ? f.j : null },
      pivotLine: f.stage === "pick" ? null : f.a[f.pv !== undefined ? f.pv : 0] ,
      cls: (k) => {
        if (f.split !== undefined) return k <= f.split ? "visit" : "window";
        if (f.swp && f.swp.includes(k)) return "bad";
        if (f.stage === "pick") return k === f.pv ? "path" : "";
        if ((f.stopI && k === f.i) || (f.stopJ && k === f.j) || (f.scan === "i" && k === f.i) || (f.scan === "j" && k === f.j)) return "active";
        if (k === f.pv) return "path";
        if (k < f.i) return "visit";
        if (k > f.j) return "window";
        return "";
      },
    }),
  }));

  /* ───────── 8: full quicksort ───────── */
  Viz.register("sorting-quick", (el) => Viz.player(el, {
    title: "Quicksort: partition, then recurse on both sides (Lomuto)",
    legend: [["path", "pivot"], ["visit", "< pivot so far"], ["window", "≥ pivot so far"], ["active", "j / just placed"], ["done", "final position"], ["dim", "outside the current call"]],
    codeLang: "python",
    code: [
      "def quicksort(lo, hi):",
      "    if lo >= hi: return",
      "    p = choose_pivot(lo, hi); swap(a, p, hi)",
      "    i = lo",
      "    for j in range(lo, hi):",
      "        if a[j] < a[hi]: swap(a, i, j); i += 1",
      "    swap(a, i, hi)  # pivot is final",
      "    quicksort(lo, i - 1); quicksort(i + 1, hi)",
    ],
    inputs: [
      { key: "a", label: "values (2–14, 1–99)", value: "5,8,1,9,3,7,2,6,4" },
      { key: "piv", label: "pivot rule", type: "select", options: PIVOTS, value: "last" },
      { key: "detail", label: "steps", type: "select", options: ["every comparison", "partitions only"], value: "partitions only" },
    ],
    random: () => {
      const r = Math.random(), n = Viz.rand(8, 13);
      const a = r < 0.3 ? Array.from({ length: n }, (_, i) => i + 1) : Viz.randInts(n, 1, 40);
      return { a: a.join(","), piv: PIVOTS[Viz.rand(0, 4)], detail: "partitions only" };
    },
    build: ({ a, piv, detail }) => {
      const work = ints(a, 2, 14, 1, 99), n = work.length, fr = [], final = new Set(), stack = [];
      const every = detail === "every comparison";
      let cmp = 0, depth = 0, maxDepth = 0, calls = 0;
      const swap = (x, y) => { [work[x], work[y]] = [work[y], work[x]]; };
      const snap = (x) => ({ a: work.slice(), final: [...final], stack: stack.slice(), ...x, vars: { ...(x.vars || {}), depth, comparisons: cmp } });
      fr.push(snap({ line: 0, note: `Quicksort does its work <b>before</b> recursing: one partition puts the pivot in its final slot with smaller values left and larger right. Then the two sides are independent problems. Pivot rule: <b>${piv}</b>. Try "last" on already-sorted input to see the O(n²) worst case.` }));
      const qs = (lo, hi, d) => {
        depth = d; maxDepth = Math.max(maxDepth, d); calls++;
        stack.push(`qs(${lo}, ${hi})`);
        if (lo >= hi) {
          if (lo === hi) final.add(lo);
          if (every) fr.push(snap({ lo, hi, line: 1, vars: { lo, hi }, note: lo === hi ? `qs(${lo}, ${hi}): one element, already final.` : `qs(${lo}, ${hi}): empty range, return.` }));
          stack.pop(); return;
        }
        const p = choose(work, lo, hi, piv);
        fr.push(snap({ lo, hi, pv: p, line: 2, vars: { lo, hi, pivot: work[p] }, note: `Call qs(${lo}, ${hi}) at depth ${d}. Rule "${piv}" picks a[${p}] = <b>${work[p]}</b>${p !== hi ? "; swap it to the end" : ""}.` }));
        swap(p, hi);
        let i = lo;
        for (let j = lo; j < hi; j++) {
          cmp++;
          const lt = work[j] < work[hi];
          if (lt) { swap(i, j); i++; }
          if (every) fr.push(snap({ lo, hi, pv: hi, i, j, line: lt ? 5 : 4, vars: { lo, hi, i, j, pivot: work[hi] }, note: lt ? `${work[i - 1]} &lt; ${work[hi]}: move it into the left region (i = ${i}).` : `${work[j]} ≥ ${work[hi]}: leave it in the right region.` }));
        }
        swap(i, hi); final.add(i);
        const lop = hi - lo >= 2 && (i === lo || i === hi);
        fr.push(snap({ lo, hi, placed: i, line: 6, vars: { lo, hi, i, pivot: work[i] }, note: `${hi - lo} comparisons put pivot ${work[i]} at index <b>${i}</b> for good: ${i - lo} smaller value(s) left, ${hi - i} right.${lop ? " <b>Lopsided split</b>: one side is empty, so this whole pass only finished one element." : ""}` }));
        qs(lo, i - 1, d + 1); qs(i + 1, hi, d + 1);
        depth = d;
        stack.pop();
      };
      qs(0, n - 1, 0);
      const nlogn = Math.round(n * Math.log2(n));
      fr.push(snap({ fin: true, line: [], vars: { "max depth": maxDepth, calls }, note: `Sorted with <b>${cmp}</b> comparisons and maximum recursion depth <b>${maxDepth}</b>. For n = ${n}: n·log₂n ≈ ${nlogn} (balanced splits), n(n−1)/2 = ${(n * (n - 1)) / 2} (every split lopsided). ${cmp > 0.75 * (n * (n - 1)) / 2 ? "This run was close to the <b>worst case</b>: the pivot was nearly always an extreme value." : "Splits were reasonably balanced."}` }));
      return fr;
    },
    render: (f) => {
      const fin = new Set(f.final);
      return col(
        Viz.row(
          bars(f.a, {
            caption: "array",
            ranges: f.lo !== undefined && !f.fin ? [[f.lo, f.hi]] : [],
            ptrs: f.i !== undefined && f.j !== undefined ? { i: f.i, j: f.j } : {},
            pivotLine: f.pv !== undefined ? f.a[f.pv] : f.placed !== undefined ? f.a[f.placed] : null,
            cls: (k) => {
              if (f.fin) return "done";
              if (k === f.placed) return "active";
              if (fin.has(k)) return "done";
              if (f.lo === undefined || k < f.lo || k > f.hi) return "dim";
              if (k === f.pv) return "path";
              if (f.placed !== undefined) return k < f.placed ? "visit" : "window";
              if (f.i !== undefined) return k === f.j ? "active" : k < f.i ? "visit" : k <= f.j ? "window" : "";
              return "";
            },
          }),
          Viz.stack(f.stack.slice().reverse(), { label: "call stack", cls: (i) => (i === 0 ? "active" : "") }),
        ),
        stats({ comparisons: f.vars.comparisons, depth: f.vars.depth ?? f.vars["max depth"] }),
      );
    },
  }));

  /* ───────── 9: heapsort ───────── */
  const heapPos = (n) => {
    const D = Math.floor(Math.log2(Math.max(1, n))) + 1, Wd = Math.pow(2, D - 1) * 58;
    return Array.from({ length: n }, (_, i) => {
      const d = Math.floor(Math.log2(i + 1)), p = i - (Math.pow(2, d) - 1), cnt = Math.pow(2, d);
      return { x: ((p + 0.5) * Wd) / cnt, y: d * 72 };
    });
  };
  Viz.register("sorting-heap", (el) => Viz.player(el, {
    title: "Heapsort: build a max-heap in place, then repeatedly move the max to the end",
    legend: [["active", "sifting node i"], ["visit", "child c being compared"], ["bad", "just swapped"], ["done", "sorted tail (outside the heap)"]],
    codeLang: "python",
    code: [
      "def sift_down(a, i, size):",
      "    while (c := 2 * i + 1) < size:",
      "        if c + 1 < size and a[c + 1] > a[c]: c += 1",
      "        if a[i] >= a[c]: return  # heap ok",
      "        a[i], a[c] = a[c], a[i]; i = c",
      "for i in range(n//2 - 1, -1, -1):  # heapify",
      "    sift_down(a, i, n)",
      "for end in range(n - 1, 0, -1):",
      "    a[0], a[end] = a[end], a[0]  # max home",
      "    sift_down(a, 0, end)",
    ],
    inputs: [{ key: "a", label: "values (2–15, 1–99)", value: "4,10,3,5,1,8,7,2,9" }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 13), 1, 50).join(",") }),
    build: ({ a }) => {
      const arr = ints(a, 2, 15, 1, 99), n = arr.length, pos = heapPos(n), fr = [];
      let size = n, cmp = 0, sw = 0, phase = "heapify";
      const snap = (x) => ({ a: arr.slice(), size, pos, phase, ...x, vars: { size, ...(x.vars || {}), comparisons: cmp, swaps: sw } });
      fr.push(snap({ line: 5, note: "The array <i>is</i> a complete binary tree: children of i live at 2i+1 and 2i+2, the parent at (i−1)//2. No pointers needed. Step 1 turns it into a <b>max-heap</b> (every parent ≥ its children) by sifting down every internal node, bottom-up." }));
      const sift = (i, why) => {
        for (;;) {
          let c = 2 * i + 1;
          if (c >= size) { fr.push(snap({ i, line: 1, vars: { i }, note: `Node ${i} has no children inside the heap: sifting stops.` })); return; }
          if (c + 1 < size) { cmp++; if (arr[c + 1] > arr[c]) c++; }
          fr.push(snap({ i, c, line: [1, 2], vars: { i, c }, note: `Children of ${i}: ${2 * i + 1 < size ? arr[2 * i + 1] : "–"}${2 * i + 2 < size ? ` and ${arr[2 * i + 2]}` : ""}. The bigger one, a[${c}] = ${arr[c]}, is the only candidate to become the parent.` }));
          cmp++;
          if (arr[i] >= arr[c]) { fr.push(snap({ i, c, line: 3, vars: { i, c }, note: `${arr[i]} ≥ ${arr[c]}: the heap property holds here, and below is already a heap. Done${why ? ` ${why}` : ""}.` })); return; }
          [arr[i], arr[c]] = [arr[c], arr[i]]; sw++;
          fr.push(snap({ swp: [i, c], line: 4, vars: { i, c }, note: `${arr[c]} &lt; ${arr[i]}: swap so the bigger value rises. Keep sifting ${arr[c]} down from index ${c}.` }));
          i = c;
        }
      };
      for (let i = (n >> 1) - 1; i >= 0; i--) {
        fr.push(snap({ i, line: [5, 6], vars: { i }, note: `Heapify: sift down node ${i}. Both of its subtrees are already heaps (we go bottom-up), so one sift fixes this whole subtree. Leaves (index ≥ ${n >> 1}) are trivially heaps.` }));
        sift(i);
      }
      fr.push(snap({ line: 7, note: `Max-heap built with ${sw} swaps: the largest value ${arr[0]} is at the root. Heapify costs O(n), not O(n log n): most nodes are near the bottom and sift only a short way.` }));
      phase = "sort";
      for (let end = n - 1; end > 0; end--) {
        [arr[0], arr[end]] = [arr[end], arr[0]]; sw++; size = end;
        fr.push(snap({ swp: [0, end], line: 8, vars: { end }, note: `Swap the max ${arr[end]} into slot ${end}: final. The heap shrinks to size ${end}; the new root ${arr[0]} probably breaks the heap property.` }));
        sift(0, "with this extraction");
      }
      size = 0;
      fr.push(snap({ fin: true, line: [], note: `Sorted in place: O(n log n) worst case, O(1) extra space. The long jumps (root ↔ end) make heapsort <b>unstable</b>, and its scattered memory access makes it slower in practice than quicksort or merge sort.` }));
      return fr;
    },
    render: (f) => {
      const n = f.a.length;
      const nodes = f.a.map((v, i) => ({ id: i, x: f.pos[i].x, y: f.pos[i].y, label: v, sub: i }));
      const edges = [];
      for (let i = 1; i < n; i++) edges.push({ u: (i - 1) >> 1, v: i });
      const cl = (i) => (f.fin || i >= f.size ? "done" : f.swp && f.swp.includes(i) ? "bad" : i === f.i ? "active" : i === f.c ? "visit" : "");
      return Viz.row(
        Viz.graph({ nodes, edges }, { r: 18, label: "heap view (index under each node)", nodeCls: (id) => cl(Number(id)), edgeCls: (k) => { const v = Number(k.split("-")[1]); return v >= f.size ? "dim" : ""; } }),
        col(
          Viz.array(f.a, { label: "array view", ptrs: { i: f.i, c: f.c, end: f.phase === "sort" && f.size > 0 && f.size < n ? f.size : null }, cls: (i) => cl(i) }),
          stats({ "heap size": f.size, comparisons: f.vars.comparisons, swaps: f.vars.swaps }),
        ),
      );
    },
  }));

  /* ───────── 10: stability ───────── */
  const recLab = (x) => `${x.k}${x.t}`;
  const STAB = ["selection (unstable)", "heapsort (unstable)", "quicksort (unstable)", "insertion (stable)", "merge (stable)"];
  Viz.register("sorting-stability", (el) => Viz.player(el, {
    title: "Stability: do equal keys keep their input order?",
    tag: "STABLE VS UNSTABLE",
    legend: [["active", "records that just moved"], ["done", "equal keys in input order"], ["bad", "equal keys out of input order"]],
    codeLang: "python",
    code: [
      "out = sort(records, key=lambda r: r.key)",
      "# stable  ⇔  equal keys keep their input order",
      "for x, y in zip(out, out[1:]):",
      "    if x.key == y.key and x.tag > y.tag:",
      "        return 'UNSTABLE'",
      "return 'stable for this input'",
    ],
    inputs: [{ key: "a", label: "keys (2–12, 0–9)", value: "3,1,3,2,1,3,2" }, { key: "alg", label: "algorithm", type: "select", options: STAB, value: STAB[0] }],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 10), 1, 4).join(","), alg: STAB[Viz.rand(0, 4)] }),
    build: ({ a, alg }) => {
      const keys = ints(a, 2, 12, 0, 9), seen = {};
      const recs = keys.map((k) => { seen[k] = (seen[k] || 0) + 1; return { k, t: "abcdefghijkl"[seen[k] - 1] }; });
      const input = recs.slice(), r = recs.slice(), n = r.length, fr = [];
      const lab = (x) => `${x.k}${x.t}`;
      const push = (moved, note) => fr.push({ input, r: r.slice(), moved, line: 0, note, vars: { algorithm: alg.split(" ")[0] } });
      push([], "Each record is <b>key + tag</b>. The tag (a, b, c…) records the input order among equal keys. We sort by key only; the tag is just along for the ride, like the rest of a database row.");
      const sw = (x, y, why) => { [r[x], r[y]] = [r[y], r[x]]; if (x !== y) push([x, y], why(r[y], r[x])); };
      if (alg.startsWith("selection")) {
        for (let i = 0; i < n - 1; i++) { let m = i; for (let j = i + 1; j < n; j++) if (r[j].k < r[m].k) m = j; if (m !== i) sw(i, m, (big, small) => `Swap the minimum ${lab(small)} to slot ${i}; ${lab(big)} is flung to slot ${m}, possibly <b>over</b> an equal key in between.`); }
      } else if (alg.startsWith("heap")) {
        const sift = (i, size) => { for (;;) { let c = 2 * i + 1; if (c >= size) return; if (c + 1 < size && r[c + 1].k > r[c].k) c++; if (r[i].k >= r[c].k) return; sw(i, c, (x, y) => `Sift: swap ${lab(x)} and ${lab(y)} (parent ↔ child).`); i = c; } };
        for (let i = (n >> 1) - 1; i >= 0; i--) sift(i, n);
        for (let end = n - 1; end > 0; end--) { sw(0, end, (x, y) => `Move the root ${lab(y)} to slot ${end}. This jump ignores where equal keys were.`); sift(0, end); }
      } else if (alg.startsWith("quick")) {
        const qs = (lo, hi) => { if (lo >= hi) return; let i = lo; for (let j = lo; j < hi; j++) if (r[j].k < r[hi].k) { if (i !== j) sw(i, j, (x, y) => `Partition swap: ${lab(y)} &lt; pivot moves left, ${lab(x)} jumps right.`); i++; } if (i !== hi) sw(i, hi, (x, y) => `Pivot ${lab(y)} drops into slot ${i}.`); qs(lo, i - 1); qs(i + 1, hi); };
        qs(0, n - 1);
      } else if (alg.startsWith("insertion")) {
        for (let i = 1; i < n; i++) for (let j = i; j > 0 && r[j - 1].k > r[j].k; j--) sw(j - 1, j, (x, y) => `${lab(y)} slides left past the strictly larger ${lab(x)}. It stops at an <i>equal</i> key, so equal keys never cross.`);
      } else {
        const ms = (lo, hi) => {
          if (lo >= hi) return; const mid = (lo + hi) >> 1; ms(lo, mid); ms(mid + 1, hi);
          const out = []; let i = lo, j = mid + 1;
          while (i <= mid && j <= hi) out.push(r[i].k <= r[j].k ? r[i++] : r[j++]);
          while (i <= mid) out.push(r[i++]); while (j <= hi) out.push(r[j++]);
          const before = r.slice(lo, hi + 1).map(lab).join(" ");
          for (let t = 0; t < out.length; t++) r[lo + t] = out[t];
          push(Array.from({ length: hi - lo + 1 }, (_, t) => lo + t), `Merge [${lo}..${hi}]: ${before} → ${out.map(lab).join(" ")}. On equal keys the merge takes the <b>left</b> one first, and left items came earlier in the input.`);
        };
        ms(0, n - 1);
      }
      const badSet = new Set();
      for (let i = 0; i + 1 < n; i++) for (let j = i + 1; j < n && r[j].k === r[i].k; j++) if (r[i].t > r[j].t) { badSet.add(i); badSet.add(j); }
      const stable = !badSet.size;
      fr.push({ input, r: r.slice(), moved: [], check: true, bad: [...badSet], line: [2, 3, stable ? 5 : 4], vars: { algorithm: alg.split(" ")[0], verdict: stable ? "order kept" : "UNSTABLE" }, note: stable ? (alg.includes("unstable") ? "Every group of equal keys kept its a, b, c order <i>for this input</i>. Unstable means <b>no guarantee</b>, not \"always scrambles\": press Randomize until you catch it." : "Every group of equal keys still reads a, b, c…: guaranteed for this algorithm, for every input.") : `Equal keys came out of order (red). If the tags were "earlier timestamp" from a previous sort by a different field, that order is now lost. That is why multi-key sorting needs a <b>stable</b> sort.` });
      return fr;
    },
    render: (f) => {
      const bad = new Set(f.bad || []);
      return col(
        Viz.array(f.input, { label: "input (tag = order among equal keys)", fmt: recLab, showIdx: false }),
        Viz.array(f.r, { label: f.check ? "result" : "working array", fmt: recLab, cls: (i) => (f.check ? (bad.has(i) ? "bad" : "done") : f.moved.includes(i) ? "active" : "") }),
      );
    },
  }));

  /* ───────── 11: counting sort ───────── */
  Viz.register("sorting-counting", (el) => Viz.player(el, {
    title: "Counting sort: histogram → prefix sums → place from the back",
    tag: "NON-COMPARISON · O(n + k)",
    legend: [["active", "current value"], ["visit", "its count / slot"], ["done", "placed"]],
    codeLang: "python",
    code: [
      "count = [0] * (k + 1)",
      "for v in a: count[v] += 1  # histogram",
      "for v in range(1, k + 1):",
      "    count[v] += count[v - 1]  # #items ≤ v",
      "out = [None] * n",
      "for v in reversed(a):  # back to front",
      "    count[v] -= 1; out[count[v]] = v",
    ],
    inputs: [{ key: "a", label: "values (1–14, 0–9)", value: "4,1,3,4,2,1,0,3,4" }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 12), 0, Viz.rand(4, 9)).join(",") }),
    build: ({ a }) => {
      const arr = ints(a, 1, 14, 0, 9), n = arr.length, k = Math.max(...arr), count = Array(k + 1).fill(0), out = Array(n).fill(null), fr = [];
      const snap = (x) => ({ arr, count: count.slice(), out: out.slice(), ...x });
      fr.push(snap({ line: 0, vars: { n, k }, note: `No comparisons at all: the values themselves are used as array indices. Values lie in 0..${k}, so we need ${k + 1} counters. Cost O(n + k), which beats n log n when k is small.` }));
      arr.forEach((v, i) => { count[v]++; fr.push(snap({ ai: i, ci: v, line: 1, vars: { i, v, [`count[${v}]`]: count[v] }, note: `a[${i}] = ${v}: count[${v}]++ → ${count[v]}.` })); });
      fr.push(snap({ line: 2, vars: { n, k }, note: "The histogram says how many of each value. A prefix sum turns it into <b>positions</b>: after it, count[v] = number of items ≤ v = one past the last slot that v occupies." }));
      for (let v = 1; v <= k; v++) { count[v] += count[v - 1]; fr.push(snap({ ci: v, cprev: v - 1, line: 3, vars: { v, [`count[${v}]`]: count[v] }, note: `count[${v}] += count[${v - 1}] → ${count[v]}: values ≤ ${v} fill slots 0..${count[v] - 1}.` })); }
      for (let i = n - 1; i >= 0; i--) {
        const v = arr[i]; count[v]--; out[count[v]] = v;
        fr.push(snap({ ai: i, ci: v, oi: count[v], line: [5, 6], vars: { i, v, slot: count[v] }, note: `a[${i}] = ${v} goes to the last free slot for ${v}: out[${count[v]}]. Walking the input <b>backwards</b> and filling each value's slots from the right keeps equal values in input order, so counting sort is stable. That stability is what radix sort relies on.` }));
      }
      fr.push(snap({ fin: true, line: [], vars: { n, k }, note: `Sorted: [${out.join(", ")}] in O(n + k) time and O(n + k) space. With k = 10⁹ the count array would be absurd: then sort by digits (radix) or compress coordinates first.` }));
      return fr;
    },
    render: (f) => col(
      Viz.array(f.arr, { label: "input a", ptrs: { i: f.ai }, cls: (i) => (i === f.ai ? "active" : "") }),
      Viz.array(f.count, { label: "count[v] (index = value v)", cls: (i) => (i === f.ci ? "visit" : i === f.cprev ? "path" : "") }),
      Viz.array(f.out, { label: "output", cls: (i) => (i === f.oi ? "active" : f.out[i] !== null ? "done" : "") }),
    ),
  }));

  /* ───────── 12: LSD radix sort ───────── */
  const digitCells = (a, exp, width, cls) => `<div class="so-nums">${a.map((v, i) => {
    const s = String(v).padStart(width, "0"), pos = width - 1 - Math.round(Math.log10(exp));
    return `<span class="so-num ${cls ? cls(i) : ""}">${[...s].map((ch, t) => `<i class="${t === pos ? "on" : t < width - String(v).length ? "pad" : ""}">${ch}</i>`).join("")}</span>`;
  }).join("")}</div>`;
  Viz.register("sorting-radix", (el) => Viz.player(el, {
    title: "LSD radix sort: stable bucket passes, least significant digit first",
    tag: "NON-COMPARISON · O(d·(n + b))",
    legend: [["active", "value being distributed (its current digit is bold)"], ["visit", "target bucket"], ["done", "pass complete"]],
    codeLang: "python",
    code: [
      "exp = 1",
      "while max(a) // exp > 0:  # one pass per digit",
      "    buckets = [[] for _ in range(10)]",
      "    for v in a:",
      "        buckets[(v // exp) % 10].append(v)",
      "    a = [v for b in buckets for v in b]",
      "    exp *= 10",
    ],
    inputs: [{ key: "a", label: "values (2–12, 0–999)", value: "170,45,75,90,802,24,2,66" }],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 10), 0, 999).join(",") }),
    build: ({ a }) => {
      let arr = ints(a, 2, 12, 0, 999);
      const width = String(Math.max(...arr)).length, fr = [];
      let exp = 1, pass = 0;
      const snap = (x) => ({ arr: arr.slice(), exp, width, ...x });
      fr.push(snap({ buckets: Array.from({ length: 10 }, () => []), line: 0, vars: { exp, passes: width }, note: `Sort by the ones digit, then the tens, then the hundreds: ${width} pass(es). It looks backwards, but each pass is <b>stable</b>, so ties on the current digit keep the order from the previous (less significant) passes. After the last pass, numbers are ordered by all digits.` }));
      while (Math.floor(Math.max(...arr) / exp) > 0) {
        pass++;
        const buckets = Array.from({ length: 10 }, () => []);
        const place = exp === 1 ? "ones" : exp === 10 ? "tens" : "hundreds";
        fr.push(snap({ buckets: buckets.map((b) => b.slice()), line: [1, 2], vars: { exp, pass }, note: `Pass ${pass}: distribute by the <b>${place}</b> digit into 10 buckets.` }));
        arr.forEach((v, i) => {
          const d = Math.floor(v / exp) % 10;
          buckets[d].push(v);
          fr.push(snap({ buckets: buckets.map((b) => b.slice()), ai: i, bi: d, line: [3, 4], vars: { exp, v, digit: d }, note: `${v}: ${place} digit is ${d}, so append to bucket ${d}. Appending (FIFO) keeps earlier items first: that is the stability radix needs.` }));
        });
        arr = buckets.flat();
        fr.push(snap({ buckets: buckets.map((b) => b.slice()), collected: true, line: 5, vars: { exp, pass }, note: `Collect buckets 0 → 9: [${arr.join(", ")}]. Now sorted by the last ${pass} digit(s).` }));
        exp *= 10;
      }
      fr.push(snap({ buckets: Array.from({ length: 10 }, () => []), fin: true, exp: exp / 10, line: 1, vars: { passes: pass }, note: `Sorted in ${pass} passes of O(n + 10). For w-bit integers in base 2⁸ that is 4 passes for 32-bit values: linear time without a single comparison.` }));
      return fr;
    },
    render: (f) => col(
      Viz.labeled(f.collected ? "collected (next pass input)" : "array", digitCells(f.arr, f.exp, f.width, (i) => (f.fin || f.collected ? "done" : i === f.ai ? "active" : ""))),
      Viz.labeled("buckets by current digit", `<div class="so-bkts">${f.buckets.map((b, d) => `<div class="so-bkt ${d === f.bi ? "visit" : ""}"><b>${d}</b>${b.map((v, t) => `<span class="${d === f.bi && t === b.length - 1 ? "active" : ""}">${v}</span>`).join("")}</div>`).join("")}</div>`),
    ),
  }));

  /* ───────── 13: quickselect ───────── */
  Viz.register("sorting-quickselect", (el) => Viz.player(el, {
    title: "Quickselect: partition, then keep only the side that contains index k",
    tag: "K-TH SMALLEST · EXPECTED O(n)",
    legend: [["path", "pivot"], ["visit", "< pivot"], ["window", "≥ pivot"], ["done", "pivot's final slot / answer"], ["dim", "discarded forever"]],
    codeLang: "python",
    code: [
      "lo, hi = 0, n - 1  # k is a 0-based index",
      "while True:",
      "    p = partition(a, lo, hi)  # Lomuto",
      "    if p == k: return a[k]",
      "    if p < k: lo = p + 1  # go right",
      "    else:     hi = p - 1  # go left",
    ],
    inputs: [{ key: "a", label: "values (2–14, 1–99)", value: "7,10,4,3,20,15,8,1,12" }, { key: "k", label: "k (1 = smallest)", value: "4", width: 60 }, { key: "piv", label: "pivot rule", type: "select", options: PIVOTS, value: "random" }],
    random: () => { const n = Viz.rand(8, 13); return { a: Viz.randInts(n, 1, 50).join(","), k: String(Viz.rand(1, n)), piv: "random" }; },
    build: ({ a, k, piv }) => {
      const arr = ints(a, 2, 14, 1, 99), n = arr.length, K = Viz.parse.int(k, { min: 1, max: n }) - 1, fr = [];
      const sorted = arr.slice().sort((x, y) => x - y);
      let lo = 0, hi = n - 1, work = 0, rounds = 0;
      const dead = new Set();
      const snap = (x) => ({ a: arr.slice(), lo, hi, K, dead: [...dead], ...x, vars: { lo, hi, k: K, ...(x.vars || {}), "elements touched": work } });
      fr.push(snap({ line: 0, note: `We want the ${K + 1}${["st", "nd", "rd"][K] || "th"} smallest, i.e. the value that would sit at index k = ${K} after sorting. Sorting everything is O(n log n); quickselect partitions like quicksort but recurses into <b>one</b> side only.` }));
      for (;;) {
        rounds++;
        const p0 = choose(arr, lo, hi, piv);
        fr.push(snap({ pv: p0, line: 2, note: `Round ${rounds}: range [${lo}..${hi}] (${hi - lo + 1} elements). Pivot rule "${piv}" picks ${arr[p0]}.` }));
        [arr[p0], arr[hi]] = [arr[hi], arr[p0]];
        let i = lo;
        for (let j = lo; j < hi; j++) if (arr[j] < arr[hi]) { [arr[i], arr[j]] = [arr[j], arr[i]]; i++; }
        [arr[i], arr[hi]] = [arr[hi], arr[i]];
        work += hi - lo + 1;
        const p = i;
        fr.push(snap({ placed: p, line: 2, vars: { p }, note: `After partitioning, pivot ${arr[p]} is at its final index <b>${p}</b>. Everything left is smaller; everything right is ≥.` }));
        if (p === K) { fr.push(snap({ placed: p, found: true, line: 3, vars: { p }, note: `p = k = ${K}: <b>${arr[p]}</b> is the answer (sorted order agrees: ${sorted[K]}). We touched ${work} elements in ${rounds} round(s); a full sort would cost about n·log₂n ≈ ${Math.round(n * Math.log2(n))} comparisons. The array is now partitioned around k, which is exactly what "top-k" problems want.` })); return fr; }
        if (p < K) { for (let t = lo; t <= p; t++) dead.add(t); lo = p + 1; fr.push(snap({ line: 4, vars: { p }, note: `p = ${p} &lt; k = ${K}: the answer is to the right. Indices ${p} and below are discarded <b>without being sorted</b>.` })); }
        else { for (let t = p; t <= hi; t++) dead.add(t); hi = p - 1; fr.push(snap({ line: 5, vars: { p }, note: `p = ${p} &gt; k = ${K}: the answer is to the left. Indices ${p} and above are discarded.` })); }
        if (lo === hi) { fr.push(snap({ found: true, placed: lo, line: 3, note: `One element left at index ${lo} = k: <b>${arr[lo]}</b> is the answer (sorted order agrees: ${sorted[K]}). ${work} elements touched in ${rounds} round(s). Expected total: n + n/2 + n/4 + … ≈ 2n.` })); return fr; }
      }
    },
    render: (f) => {
      const dead = new Set(f.dead);
      return bars(f.a, {
        caption: "array",
        ranges: f.found ? [] : [[f.lo, f.hi]],
        ptrs: { k: f.K, ...(f.placed !== undefined && f.placed !== f.K ? { p: f.placed } : {}) },
        pivotLine: f.pv !== undefined ? f.a[f.pv] : null,
        cls: (i) => {
          if (f.found) return i === f.placed ? "done" : "dim";
          if (dead.has(i) || i < f.lo || i > f.hi) return "dim";
          if (i === f.pv) return "path";
          if (f.placed !== undefined) return i === f.placed ? "done" : i < f.placed ? "visit" : "window";
          return "";
        },
      });
    },
  }));

  /* ───────── 14: cyclic sort ───────── */
  Viz.register("sorting-cyclic", (el) => Viz.player(el, {
    title: "Cyclic sort: value v belongs at index v − 1, so send it home",
    tag: "INDEX PLACEMENT · O(n), O(1) SPACE",
    legend: [["active", "a[i] being placed"], ["visit", "its home slot"], ["done", "value at home"], ["bad", "cannot be placed (out of range or duplicate)"]],
    codeLang: "python",
    code: [
      "i = 0",
      "while i < n:",
      "    v = a[i]  # wants slot v - 1",
      "    if 1 <= v <= n and a[v - 1] != v:",
      "        a[i], a[v - 1] = a[v - 1], v  # home",
      "    else:",
      "        i += 1  # home, out of range, or dup",
      "missing = [k+1 for k in range(n) if a[k] != k+1]",
    ],
    inputs: [{ key: "a", label: "values (1–12, −5..20)", value: "4,3,2,7,8,2,3,1" }],
    random: () => { const n = Viz.rand(6, 10); return { a: (Math.random() < 0.5 ? Viz.randInts(n, 1, n) : Viz.randInts(n, -3, n + 3)).join(",") }; },
    build: ({ a }) => {
      const arr = ints(a, 1, 12, -5, 20), n = arr.length, fr = [];
      let i = 0, swaps = 0;
      const snap = (x) => ({ a: arr.slice(), i, ...x, vars: { i, ...(x.vars || {}), swaps } });
      fr.push(snap({ line: 0, note: `n = ${n}. If the array held exactly 1..${n}, value v would sit at index v − 1. Every swap below puts one value <b>permanently</b> home, so there are at most n swaps: O(n) total, even with the inner "stay on i" loop.` }));
      while (i < n) {
        const v = arr[i];
        const ok = v >= 1 && v <= n && arr[v - 1] !== v;
        fr.push(snap({ home: v >= 1 && v <= n ? v - 1 : null, line: [2, 3], vars: { v }, note: v < 1 || v > n ? `a[${i}] = ${v} is outside 1..${n}: it has no home. Leave it; it marks a slot whose value is missing.` : ok ? `a[${i}] = ${v} wants slot ${v - 1}, which holds ${arr[v - 1]} ≠ ${v}. Swap.` : v - 1 === i ? `a[${i}] = ${v} is already home.` : `a[${i}] = ${v} wants slot ${v - 1}, but that slot already holds a ${v}: this one is a <b>duplicate</b>. Leave it.` }));
        if (ok) {
          arr[i] = arr[v - 1]; arr[v - 1] = v; swaps++;
          fr.push(snap({ sent: v - 1, line: 4, vars: { v }, note: `${v} is home at ${v - 1}. The value that came back (${arr[i]}) is unexamined, so <b>i stays</b> and we look at it next.` }));
        } else {
          i++;
          fr.push(snap({ line: 6, vars: { v }, note: `Advance i to ${i}.` }));
        }
      }
      const miss = [], extra = [];
      for (let k = 0; k < n; k++) if (arr[k] !== k + 1) { miss.push(k + 1); extra.push(arr[k]); }
      fr.push(snap({ fin: true, i: null, line: 7, vars: { missing: miss.length ? miss : "none" }, note: miss.length ? `Scan: slot k holds k + 1 unless k + 1 is missing. Missing: <b>${miss.join(", ")}</b>. The values sitting in those slots (${extra.join(", ")}) are the duplicates or out-of-range values. First missing positive = <b>${miss[0]}</b>.` : `Every slot holds its own value: the array is exactly 1..${n}, and the first missing positive is ${n + 1}.` }));
      return fr;
    },
    render: (f) => Viz.array(f.a, {
      label: "a (index label = the value that belongs there)",
      idxLabel: (i) => `${i}:${i + 1}`,
      ptrs: { i: f.i },
      cls: (k) => (f.fin ? (f.a[k] === k + 1 ? "done" : "bad") : k === f.sent ? "done" : k === f.i ? "active" : k === f.home ? "visit" : f.a[k] === k + 1 ? "done" : ""),
    }),
  }));

  /* ───────── 15: sort then sweep (merge intervals) ───────── */
  Viz.register("sorting-sweep", (el) => Viz.player(el, {
    title: "Sort, then sweep: merge overlapping intervals",
    tag: "SORT TO UNLOCK",
    legend: [["active", "current interval"], ["visit", "absorbed into the last merged block"], ["done", "merged output"], ["path", "reach of the last block"]],
    codeLang: "python",
    code: [
      "iv.sort(key=lambda x: x[0])  # by start",
      "out = [iv[0]]",
      "for s, e in iv[1:]:",
      "    if s <= out[-1][1]:  # overlaps last block",
      "        out[-1][1] = max(out[-1][1], e)",
      "    else:",
      "        out.append([s, e])  # gap: new block",
    ],
    inputs: [{ key: "iv", label: "intervals start,end; …", value: "8,10; 1,3; 15,18; 2,6; 9,12; 17,20" }],
    random: () => { const n = Viz.rand(4, 7); return { iv: Array.from({ length: n }, () => { const s = Viz.rand(0, 24); return `${s},${s + Viz.rand(0, 6)}`; }).join("; ") }; },
    build: ({ iv }) => {
      const rows = Viz.parse.matrix(iv);
      if (rows.length < 1 || rows.length > 8) throw new Error("Use 1 to 8 intervals like 1,3; 2,6.");
      for (const r of rows) if (r.length !== 2 || !r.every((x) => Number.isInteger(x) && x >= 0 && x <= 30) || r[0] > r[1]) throw new Error("Each interval is start,end with 0 ≤ start ≤ end ≤ 30.");
      const orig = rows.map(([s, e], id) => ({ s, e, id }));
      const sorted = orig.slice().sort((x, y) => x.s - y.s);
      const fr = [], out = [], absorbed = new Set();
      const max = Math.max(...rows.map((r) => r[1]));
      const snap = (x) => ({ max, out: out.map((b) => ({ ...b })), absorbed: [...absorbed], ...x });
      fr.push(snap({ list: orig, raw: true, line: [], note: "Unsorted, an interval can overlap anything, anywhere in the list: comparing all pairs is O(n²). Watch what sorting by start does." }));
      fr.push(snap({ list: sorted, line: 0, note: "Sorted by start. Now an interval can only overlap the block <b>immediately before it</b>: every earlier block ends before that block began. One left-to-right sweep is enough." }));
      out.push({ s: sorted[0].s, e: sorted[0].e, ids: [sorted[0].id] });
      fr.push(snap({ list: sorted, cur: 0, line: 1, vars: { "out[-1]": [out[0].s, out[0].e] }, note: `Start the first block with [${sorted[0].s}, ${sorted[0].e}].` }));
      for (let t = 1; t < sorted.length; t++) {
        const { s, e, id } = sorted[t], last = out[out.length - 1];
        if (s <= last.e) {
          const grow = e > last.e, reach = last.e;
          last.e = Math.max(last.e, e); last.ids.push(id); absorbed.add(id);
          fr.push(snap({ list: sorted, cur: t, line: [3, 4], vars: { s, e, "out[-1]": [last.s, last.e] }, note: `[${s}, ${e}] starts at ${s} ≤ reach ${reach}: it overlaps the last block. ${grow ? `Extend the reach to ${last.e}.` : `It is fully inside; the reach stays ${last.e}. (Forgetting the max() here is the classic bug.)`}` }));
        } else {
          out.push({ s, e, ids: [id] });
          fr.push(snap({ list: sorted, cur: t, line: [5, 6], vars: { s, e, "out[-1]": [s, e] }, note: `[${s}, ${e}] starts after the reach ${last.e}: a gap. Because later intervals start even later, the previous block is <b>closed forever</b>. Open a new block.` }));
        }
      }
      fr.push(snap({ list: sorted, fin: true, line: [], vars: { blocks: out.length }, note: `${out.length} merged block(s): ${out.map((b) => `[${b.s}, ${b.e}]`).join(", ")}. O(n log n) for the sort + O(n) sweep. The sort did the hard part.` }));
      return fr;
    },
    render: (f) => {
      const L = 40, unit = Math.min(26, 620 / Math.max(1, f.max)), lane = 24, top = 16, n = f.list.length;
      const X = (v) => L + v * unit;
      const H = top + (n + 1) * lane + 46, Wd = X(f.max) + 30;
      let s = `<svg class="so-svg so-iv" viewBox="0 0 ${Wd} ${H}" width="${Wd}" height="${H}" role="img" aria-label="intervals on a number line">`;
      const absorbed = new Set(f.absorbed);
      const lastBlock = f.out[f.out.length - 1];
      if (lastBlock && !f.fin) s += `<line class="so-reach" x1="${X(lastBlock.e)}" x2="${X(lastBlock.e)}" y1="${top - 6}" y2="${top + n * lane}"/><text class="so-reach-t" x="${X(lastBlock.e) + 4}" y="${top - 2}">reach ${lastBlock.e}</text>`;
      f.list.forEach((iv, r) => {
        const y = top + r * lane + 4;
        const c = f.cur === r ? "active" : f.cur !== undefined && r < f.cur ? (absorbed.has(iv.id) ? "visit" : "seen") : "";
        s += `<rect class="so-ivr ${c}" x="${X(iv.s)}" y="${y}" width="${Math.max(4, (iv.e - iv.s) * unit)}" height="16" rx="4"/><text class="so-ivt" x="${X(iv.s) - 4}" y="${y + 12}">[${iv.s},${iv.e}]</text>`;
      });
      const yo = top + n * lane + 14;
      s += `<text class="so-ivt" x="${L - 4}" y="${yo + 12}">out</text>`;
      f.out.forEach((b) => { s += `<rect class="so-ivr done" x="${X(b.s)}" y="${yo}" width="${Math.max(4, (b.e - b.s) * unit)}" height="18" rx="4"/>`; });
      const ya = yo + 34;
      s += `<line class="so-axis" x1="${L}" x2="${X(f.max)}" y1="${ya - 8}" y2="${ya - 8}"/>`;
      const step = f.max <= 15 ? 1 : f.max <= 30 ? 2 : 5;
      for (let v = 0; v <= f.max; v += step) s += `<text class="so-tick" x="${X(v)}" y="${ya + 4}">${v}</text>`;
      return `<div class="v-labeled"><span class="v-caption">${f.raw ? "input order" : "sorted by start"}</span>${s}</svg></div>`;
    },
  }));
})();
