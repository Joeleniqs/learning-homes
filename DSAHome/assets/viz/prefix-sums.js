/* Prefix Sums & Difference Arrays visualizers. */
(() => {
  const wrap = (cls, html) => `<div class="${cls}">${html}</div>`;
  const sgn = (v) => (v > 0 ? `+${v}` : String(v));
  const neg = (v) => (v < 0 ? `(${v})` : String(v));
  const rangeOf = (lo, hi) => Array.from({ length: hi - lo + 1 }, (_, k) => lo + k);
  const parseTriples = (s, size, what) => String(s).split(";").map((t) => t.trim()).filter(Boolean).map((t) => {
    const p = t.split(/[\s,]+/).filter(Boolean).map(Number);
    if (p.length !== size || p.some((x) => !Number.isInteger(x))) throw new Error(`Each ${what} needs ${size} whole numbers, separated by “;”.`);
    return p;
  });
  const parseMatrix = (s, maxR, maxC) => {
    const a = Viz.parse.matrix(s);
    if (!a.length || a.length > maxR) throw new Error(`Use 1–${maxR} rows separated by “;”.`);
    if (a.some((r) => r.length !== a[0].length)) throw new Error("Every row needs the same number of values.");
    if (a[0].length > maxC) throw new Error(`Use at most ${maxC} columns.`);
    if (a.flat().some((v) => !Number.isInteger(v) || Math.abs(v) > 99)) throw new Error("Use whole numbers from −99 to 99.");
    return a;
  };

  /* 1. Build P, then answer range queries with one subtraction each. */
  Viz.register("prefix-sums-build", (el) => Viz.player(el, {
    title: "Build P once, then every range sum is one subtraction",
    legend: [["active", "current"], ["visit", "read"], ["done", "P[r+1] (+)"], ["bad", "P[l] (−)"], ["path", "range l…r"]],
    codeLang: "python",
    code: [
      "P = [0] * (len(nums) + 1)  # P[0] = 0",
      "for i, x in enumerate(nums):",
      "    P[i + 1] = P[i] + x    # nums[0..i]",
      "",
      "def range_sum(l, r):       # inclusive l..r",
      "    return P[r + 1] - P[l]",
    ],
    inputs: [
      { key: "a", label: "nums", value: "3,-1,4,1,5,-9,2,6", width: 200 },
      { key: "q", label: "queries l-r; l-r", value: "2-5; 0-3; 4-4", width: 150 },
    ],
    random: () => {
      const n = Viz.rand(5, 10), qs = [];
      for (let k = 0; k < 3; k++) { const l = Viz.rand(0, n - 1); qs.push(`${l}-${Viz.rand(l, n - 1)}`); }
      return { a: Viz.randInts(n, -9, 9).join(","), q: qs.join("; ") };
    },
    build: ({ a, q }) => {
      const nums = Viz.parse.ints(a, { min: 1, max: 10 });
      if (nums.some((v) => !Number.isInteger(v) || Math.abs(v) > 99)) throw new Error("Use whole numbers from −99 to 99.");
      const n = nums.length;
      const qs = String(q).split(";").map((t) => t.trim()).filter(Boolean).map((t) => {
        const m = t.match(/^(\d+)\s*-\s*(\d+)$/);
        if (!m) throw new Error("Write each query as l-r, for example 2-5.");
        const l = Number(m[1]), r = Number(m[2]);
        if (l > r || r >= n) throw new Error(`Each query needs 0 ≤ l ≤ r ≤ ${n - 1}.`);
        return [l, r];
      });
      if (qs.length > 5) throw new Error("Use at most 5 queries.");
      const P = Array(n + 1).fill(null); P[0] = 0;
      const fr = [];
      const push = (o) => fr.push({ nums, P: [...P], ...o });
      push({ line: 0, vars: { n }, note: `P has <b>n + 1 = ${n + 1}</b> slots. P[k] will hold the sum of the first k numbers, so P[0] = 0 is the sum of <i>nothing</i>. That extra slot is what makes every query one formula with no special case for l = 0.` });
      for (let i = 0; i < n; i++) {
        P[i + 1] = P[i] + nums[i];
        push({ i, phase: "build", line: [1, 2], vars: { i, x: nums[i], "P[i]": P[i], "P[i+1]": P[i + 1] }, note: `P[${i + 1}] = P[${i}] + nums[${i}] = ${P[i]} + ${neg(nums[i])} = <b>${P[i + 1]}</b>: the total of nums[0…${i}]. Each slot reuses the previous one, so building costs O(n) once.` });
      }
      for (const [l, r] of qs) {
        const brute = nums.slice(l, r + 1).reduce((s, v) => s + v, 0);
        push({ l, r, phase: "query", step: 1, line: 4, vars: { l, r }, note: `Query sum(nums[${l}…${r}]). The brute-force answer adds ${r - l + 1} number(s). With P it is one subtraction, whatever the length.` });
        push({ l, r, phase: "query", step: 2, line: 5, vars: { l, r, "P[r+1]": P[r + 1], "P[l]": P[l], sum: P[r + 1] - P[l] }, note: `P[${r + 1}] = ${P[r + 1]} is everything up to index ${r}; P[${l}] = ${P[l]} is everything <i>before</i> ${l}. Subtracting removes the shared head: ${P[r + 1]} − ${neg(P[l])} = <b>${P[r + 1] - P[l]}</b> (check: ${nums.slice(l, r + 1).map(neg).join(" + ")} = ${brute}).` });
      }
      return fr;
    },
    render: (f) => {
      const q = f.phase === "query";
      return wrap("ps-stack",
        Viz.array(f.nums, {
          label: "nums",
          ptrs: f.phase === "build" ? { i: f.i } : q ? (f.l === f.r ? { "l=r": f.l } : { l: f.l, r: f.r }) : {},
          cls: (i) => (f.phase === "build" ? (i === f.i ? "active" : i < f.i ? "visit" : "dim") : q ? (i >= f.l && i <= f.r ? "path" : "dim") : "dim"),
        }) +
        Viz.array(f.P, {
          label: "P  (P[k] = sum of the first k numbers)",
          ptrs: q && f.step === 2 ? (f.l === f.r + 1 ? {} : { l: f.l, "r+1": f.r + 1 }) : {},
          cls: (k) => {
            if (f.phase === "build") return k === f.i + 1 ? "active" : k === f.i ? "visit" : "";
            if (q && f.step === 2) return k === f.r + 1 ? "done" : k === f.l ? "bad" : "dim";
            return f.P[k] === null ? "dim" : "";
          },
        }));
    },
  }));

  /* 2. Subarray sum equals k: prefix + hash map of counts. */
  Viz.register("prefix-sums-subarray-k", (el) => Viz.player(el, {
    title: "Subarray sum = k: look up the earlier prefix you need, then record yours",
    legend: [["active", "current"], ["done", "matching earlier prefix"], ["path", "a subarray that sums to k"], ["bad", "needed, not seen"]],
    codeLang: "python",
    code: [
      "count, run = 0, 0",
      "seen = {0: 1}       # the empty prefix",
      "for x in nums:",
      "    run += x        # run = P[i + 1]",
      "    need = run - k  # P[j] we would subtract",
      "    count += seen.get(need, 0)",
      "    seen[run] = seen.get(run, 0) + 1",
      "return count",
    ],
    inputs: [{ key: "a", label: "nums", value: "1,2,1,-1,3,0,2,-2", width: 200 }, { key: "k", label: "k", value: "3", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 10), -3, 4).join(","), k: String(Viz.rand(0, 5)) }),
    build: ({ a, k }) => {
      const nums = Viz.parse.ints(a, { min: 1, max: 10 });
      if (nums.some((v) => !Number.isInteger(v) || Math.abs(v) > 99)) throw new Error("Use whole numbers from −99 to 99.");
      const K = Viz.parse.int(k, { min: -999, max: 999 });
      const seen = new Map([[0, 1]]), P = [0], fr = [];
      let count = 0, run = 0;
      const push = (o) => fr.push({ nums, P: [...P], seen: [...seen.entries()], count, run, ...o });
      push({ line: [0, 1], i: -1, vars: { k: K, count }, note: `A subarray nums[j…i] sums to k exactly when <b>P[i+1] − P[j] = k</b>, i.e. when an earlier prefix equals <b>P[i+1] − k</b>. So walk once, and for each new prefix ask “how many earlier prefixes equal run − k?”. seen starts with {0: 1}: the empty prefix, which lets a subarray start at index 0.` });
      nums.forEach((x, i) => {
        run += x; P.push(run);
        const need = run - K, hits = seen.get(need) || 0;
        const matches = P.slice(0, -1).map((v, j) => (v === need ? j : -1)).filter((j) => j >= 0);
        push({ i, phase: "look", need, hits, matches, line: [3, 4], vars: { i, x, run, need, count }, note: `run = P[${i + 1}] = <b>${run}</b>. A subarray ending at ${i} sums to ${K} iff it starts right after a prefix equal to ${run} − ${neg(K)} = <b>${need}</b>.` });
        count += hits;
        const list = matches.map((j) => `nums[${j}…${i}]`).join(", ");
        push({ i, phase: "look", need, hits, matches, line: 5, vars: { i, run, need, "seen[need]": hits, count }, note: hits ? `seen[${need}] = ${hits}: <b>${hits}</b> subarray(s) end here: ${list}. count = <b>${count}</b>. We never enumerate them; the map already counted the starts.` : `${need} has not been seen, so no subarray ending at ${i} sums to ${K}. count stays ${count}.` });
        seen.set(run, (seen.get(run) || 0) + 1);
        push({ i, phase: "add", line: 6, vars: { i, run, [`seen[${run}]`]: seen.get(run), count }, note: `Record this prefix: seen[${run}] = ${seen.get(run)}. Order matters: look up <i>before</i> inserting, or with k = 0 the empty subarray nums[${i + 1}…${i}] would count itself.` });
      });
      push({ final: true, i: nums.length, line: 7, vars: { count }, note: `Done in one pass: <b>${count}</b> subarray(s) sum to ${K}. O(n) time and O(n) space, and it works with negative numbers, where a sliding window cannot.` });
      return fr;
    },
    render: (f) => {
      const ends = f.phase === "look" && f.hits ? Math.max(...f.matches) + 1 : -1;
      const keys = f.seen.map(([kk]) => kk), cnts = f.seen.map(([, v]) => v);
      return wrap("ps-stack ps-center",
        Viz.array(f.nums, {
          label: "nums",
          ptrs: f.i >= 0 && f.i < f.nums.length ? { i: f.i } : {},
          cls: (j) => (f.final ? "" : ends >= 0 && j >= ends && j <= f.i ? "path" : j === f.i ? "active" : j > f.i ? "dim" : ""),
        }) +
        Viz.array(f.P, {
          label: "prefix sums so far: P[0] … P[i+1]",
          cls: (j) => (f.final ? "" : f.phase === "look" && f.matches.includes(j) ? "done" : j === f.P.length - 1 && f.i >= 0 ? "active" : ""),
        }) +
        Viz.grid([keys, cnts], {
          label: "seen: prefix value → how many times",
          rowLabels: ["prefix", "count"],
          cls: (r, c) => (f.phase === "look" && keys[c] === f.need ? "done" : f.phase === "add" && keys[c] === f.run ? "active" : ""),
        }) +
        (f.phase === "look" && !f.hits ? `<div class="ps-miss">need ${f.need}: not in seen</div>` : ""));
    },
  }));

  /* 3. 2D prefix sums: build with inclusion–exclusion, query with four corners. */
  Viz.register("prefix-sums-2d", (el) => Viz.player(el, {
    title: "2D prefix sums: add up and left, subtract the double-counted corner",
    legend: [["active", "current"], ["visit", "added (+)"], ["bad", "subtracted (−)"], ["dep", "subtracted twice"], ["done", "query rectangle"]],
    codeLang: "python",
    code: [
      "P = [[0] * (n + 1) for _ in range(m + 1)]",
      "for r in range(m):",
      "    for c in range(n):",
      "        P[r+1][c+1] = (a[r][c] + P[r][c+1]",
      "                       + P[r+1][c] - P[r][c])",
      "",
      "def region(r1, c1, r2, c2):",
      "    return (P[r2+1][c2+1] - P[r1][c2+1]",
      "            - P[r2+1][c1] + P[r1][c1])",
    ],
    inputs: [
      { key: "m", label: "matrix (rows split by ;)", value: "3,0,1,4; 5,6,3,2; 1,2,0,1; 4,1,0,5", width: 230 },
      { key: "q", label: "query r1,c1,r2,c2", value: "1,1,2,3", width: 120 },
    ],
    random: () => {
      const R = Viz.rand(3, 4), C = Viz.rand(3, 5);
      const r1 = Viz.rand(0, R - 1), c1 = Viz.rand(0, C - 1);
      return { m: Array.from({ length: R }, () => Viz.randInts(C, 0, 9).join(",")).join("; "), q: [r1, c1, Viz.rand(r1, R - 1), Viz.rand(c1, C - 1)].join(",") };
    },
    build: ({ m, q }) => {
      const a = parseMatrix(m, 4, 5), R = a.length, C = a[0].length;
      const qq = String(q).split(/[\s,]+/).filter(Boolean).map(Number);
      if (qq.length !== 4 || qq.some((v) => !Number.isInteger(v))) throw new Error("Write the query as r1,c1,r2,c2.");
      const [r1, c1, r2, c2] = qq;
      if (r1 < 0 || c1 < 0 || r1 > r2 || c1 > c2 || r2 >= R || c2 >= C) throw new Error(`Need 0 ≤ r1 ≤ r2 ≤ ${R - 1} and 0 ≤ c1 ≤ c2 ≤ ${C - 1}.`);
      const P = Array.from({ length: R + 1 }, (_, r) => Array.from({ length: C + 1 }, (_, c) => (r === 0 || c === 0 ? 0 : "")));
      const fr = [];
      const push = (o) => fr.push({ a, P: P.map((row) => [...row]), ...o });
      push({ line: 0, vars: { m: R, n: C }, note: `P is (m+1) × (n+1). P[r][c] = sum of the block of rows 0…r−1 and columns 0…c−1, so row 0 and column 0 are empty blocks: <b>0</b>. Same trick as 1D: the padding removes every edge case.` });
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const up = P[r][c + 1], left = P[r + 1][c], diag = P[r][c];
        P[r + 1][c + 1] = a[r][c] + up + left - diag;
        const why = r === 0 && c === 0 ? "The first cell has nothing above or to the left." : r === 0 ? "In the top row, “up” and the corner are the zero padding: this is just a 1D prefix along the row." : c === 0 ? "In the first column, “left” and the corner are the zero padding." : `“Up” covers rows 0…${r - 1} × columns 0…${c}; “left” covers rows 0…${r} × columns 0…${c - 1}. Both contain the block rows 0…${r - 1} × columns 0…${c - 1} (= P[${r}][${c}]), so it was added twice and is removed once.`;
        push({ cur: [r, c], line: [3, 4], vars: { r, c, "a[r][c]": a[r][c], up, left, diag, "P[r+1][c+1]": P[r + 1][c + 1] }, note: `P[${r + 1}][${c + 1}] = ${a[r][c]} + ${neg(up)} + ${neg(left)} − ${neg(diag)} = <b>${P[r + 1][c + 1]}</b>. ${why}` });
      }
      const big = P[r2 + 1][c2 + 1], top = P[r1][c2 + 1], lft = P[r2 + 1][c1], corner = P[r1][c1];
      const qv = { r1, c1, r2, c2 };
      push({ stage: 1, qr: qq, line: 6, vars: { ...qv, total: big }, note: `Query rows ${r1}…${r2}, columns ${c1}…${c2}. Start from P[${r2 + 1}][${c2 + 1}] = <b>${big}</b>: the whole block from (0, 0) to (${r2}, ${c2}). It contains our rectangle plus some extra on top and on the left.` });
      push({ stage: 2, qr: qq, line: 7, vars: { ...qv, total: big - top }, note: `Remove the strip above (rows 0…${r1 - 1}): − P[${r1}][${c2 + 1}] = − ${neg(top)} → <b>${big - top}</b>.${r1 === 0 ? " r1 = 0, so the strip is empty and P[0][…] is 0." : ""}` });
      push({ stage: 3, qr: qq, line: 8, vars: { ...qv, total: big - top - lft }, note: `Remove the strip on the left (columns 0…${c1 - 1}): − P[${r2 + 1}][${c1}] = − ${neg(lft)} → <b>${big - top - lft}</b>.${r1 > 0 && c1 > 0 ? ` The top-left corner block was inside <i>both</i> strips, so it has now been subtracted twice.` : c1 === 0 ? " c1 = 0, so the strip is empty." : ""}` });
      const ans = big - top - lft + corner;
      push({ stage: 4, qr: qq, line: 8, vars: { ...qv, sum: ans }, note: `Add the corner back once: + P[${r1}][${c1}] = + ${neg(corner)} → <b>${ans}</b>. Inclusion–exclusion, four lookups, O(1) per query however big the rectangle.` });
      return fr;
    },
    render: (f) => {
      const R = f.a.length, C = f.a[0].length;
      let acls = () => "", pcls = () => "";
      if (f.cur) {
        const [r, c] = f.cur;
        acls = (i, j) => (i === r && j === c ? "active" : i <= r && j <= c ? "visit" : "");
        pcls = (i, j) => (i === r + 1 && j === c + 1 ? "active" : (i === r && j === c + 1) || (i === r + 1 && j === c) ? "visit" : i === r && j === c ? "bad" : "");
      } else if (f.stage) {
        const [r1, c1, r2, c2] = f.qr, s = f.stage;
        acls = (i, j) => {
          if (i > r2 || j > c2) return "dim";
          const inTop = i < r1, inLeft = j < c1;
          if (s === 4) return inTop || inLeft ? "dim" : "done";
          if (s >= 3 && inTop && inLeft) return "dep";
          if ((s >= 2 && inTop) || (s >= 3 && inLeft)) return "bad";
          return "visit";
        };
        pcls = (i, j) => {
          if (i === r2 + 1 && j === c2 + 1) return "visit";
          if (s >= 2 && i === r1 && j === c2 + 1) return "bad";
          if (s >= 3 && i === r2 + 1 && j === c1) return "bad";
          if (s >= 4 && i === r1 && j === c1) return "visit";
          return "dim";
        };
      }
      return Viz.row(
        Viz.grid(f.a, { label: "a  (m × n)", rowLabels: rangeOf(0, R - 1), colLabels: rangeOf(0, C - 1), cls: acls }),
        Viz.grid(f.P, { label: "P  ((m+1) × (n+1))", rowLabels: rangeOf(0, R), colLabels: rangeOf(0, C), cls: pcls }),
      );
    },
  }));

  /* 4. Difference array: O(1) per range update, one prefix pass to materialise. */
  Viz.register("prefix-sums-diff", (el) => Viz.player(el, {
    title: "Difference array: mark where each update starts and stops, then sweep once",
    legend: [["done", "+v (start)"], ["bad", "−v (stop)"], ["active", "sweep position"], ["visit", "materialised"], ["path", "range of this update"]],
    codeLang: "python",
    code: [
      "D = [0] * (n + 1)  # one spare slot",
      "for l, r, v in updates:",
      "    D[l] += v      # start adding v at l",
      "    D[r + 1] -= v  # stop after r",
      "out, run = [0] * n, 0",
      "for i in range(n):",
      "    run += D[i]    # prefix sum of D",
      "    out[i] = run",
    ],
    inputs: [
      { key: "n", label: "n", value: "8", width: 60 },
      { key: "u", label: "updates l r v; …", value: "1 4 3; 3 6 2; 0 2 -1", width: 200 },
    ],
    random: () => {
      const n = Viz.rand(6, 10), us = [];
      for (let k = 0; k < Viz.rand(2, 4); k++) { const l = Viz.rand(0, n - 1); us.push(`${l} ${Viz.rand(l, n - 1)} ${Viz.rand(-3, 5) || 1}`); }
      return { n: String(n), u: us.join("; ") };
    },
    build: ({ n, u }) => {
      const N = Viz.parse.int(n, { min: 1, max: 10 });
      const ups = parseTriples(u, 3, "update");
      if (!ups.length || ups.length > 5) throw new Error("Use 1–5 updates.");
      for (const [l, r, v] of ups) {
        if (l < 0 || l > r || r >= N) throw new Error(`Each update needs 0 ≤ l ≤ r ≤ ${N - 1}.`);
        if (Math.abs(v) > 99) throw new Error("Keep v between −99 and 99.");
      }
      const D = Array(N + 1).fill(0), naive = Array(N).fill(0), out = Array(N).fill(null), fr = [];
      const push = (o) => fr.push({ D: [...D], naive: [...naive], out: [...out], N, ...o });
      push({ line: 0, vars: { n: N, updates: ups.length }, note: `Each update “add v to every index in l…r” would cost r − l + 1 writes. Instead, record only <b>where the change starts and where it stops</b>. D has n + 1 slots so that r + 1 = n is still a valid place to write the stop.` });
      ups.forEach(([l, r, v], k) => {
        D[l] += v; D[r + 1] -= v;
        for (let i = l; i <= r; i++) naive[i] += v;
        push({ up: [l, r, v], line: [1, 2, 3], vars: { update: k + 1, l, r, v, [`D[${l}]`]: D[l], [`D[${r + 1}]`]: D[r + 1] }, note: `Update ${k + 1}: add ${v} to ${l}…${r}. Two writes: D[${l}] ${sgn(v)} (from here on, everything is ${v} higher) and D[${r + 1}] ${sgn(-v)} (from here on, cancel it).${r + 1 === N ? " r + 1 = n is the spare slot: the cancel falls off the end." : ""} The grey row shows what ${r - l + 1} naive writes would have produced.` });
      });
      let run = 0;
      for (let i = 0; i < N; i++) {
        run += D[i]; out[i] = run;
        push({ i, line: [5, 6, 7], vars: { i, "D[i]": D[i], run, "out[i]": run }, note: `run += D[${i}] (${sgn(D[i])}) → <b>${run}</b>. The running sum of D adds every start at or before ${i} and subtracts every stop at or before ${i}: exactly the updates that cover index ${i}.` });
      }
      push({ final: true, line: 7, vars: { out: `[${out.join(", ")}]` }, note: `Materialised: out matches the naive result cell for cell. Cost: O(1) per update plus one O(n) sweep, instead of O(n) per update. Difference and prefix sum are inverses of each other.` });
      return fr;
    },
    render: (f) => wrap("ps-stack ps-center",
      Viz.array(f.naive, { label: "naive result (for comparison)", cls: (i) => (f.up && i >= f.up[0] && i <= f.up[1] ? "path" : "dim") }) +
      Viz.array(f.D, {
        label: "D  (difference array, n + 1 slots)",
        ptrs: f.up ? (f.up[0] === f.up[1] + 1 ? {} : { l: f.up[0], "r+1": f.up[1] + 1 }) : f.i !== undefined ? { i: f.i } : {},
        cls: (i, v) => (f.up ? (i === f.up[0] ? "done" : i === f.up[1] + 1 ? "bad" : "") : f.i !== undefined ? (i === f.i ? "active" : i < f.i ? "visit" : "") : i === f.N ? "dim" : ""),
        fmt: (v) => (v > 0 ? `+${v}` : String(v)),
      }) +
      Viz.array(f.out, { label: "out = prefix sums of D", cls: (i) => (f.out[i] === null ? "dim" : i === f.i ? "active" : "visit") }),
    ),
  }));

  /* 5. Prefix modulo: subarray sums divisible by k (LC 974). */
  Viz.register("prefix-sums-mod", (el) => Viz.player(el, {
    title: "Divisible by k: equal prefix remainders bracket a divisible subarray",
    legend: [["active", "current remainder"], ["done", "same remainder seen before"], ["path", "subarrays ending here"]],
    codeLang: "python",
    code: [
      "buckets = [0] * k",
      "buckets[0] = 1             # empty prefix",
      "count = run = 0",
      "for x in nums:",
      "    run = (run + x) % k    # always 0..k-1",
      "    count += buckets[run]  # earlier pairs",
      "    buckets[run] += 1",
      "return count",
    ],
    inputs: [{ key: "a", label: "nums", value: "4,5,0,-2,-3,1", width: 200 }, { key: "k", label: "k", value: "5", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(6, 10), -6, 9).join(","), k: String(Viz.rand(2, 7)) }),
    build: ({ a, k }) => {
      const nums = Viz.parse.ints(a, { min: 1, max: 10 });
      if (nums.some((v) => !Number.isInteger(v) || Math.abs(v) > 99)) throw new Error("Use whole numbers from −99 to 99.");
      const K = Viz.parse.int(k, { min: 2, max: 10 });
      const buckets = Array(K).fill(0); buckets[0] = 1;
      const rem = [0], fr = [];
      let count = 0, run = 0;
      const push = (o) => fr.push({ nums, K, buckets: [...buckets], rem: [...rem], count, ...o });
      push({ line: [0, 1, 2], i: -1, vars: { k: K, count }, note: `sum(nums[j…i]) = P[i+1] − P[j] is divisible by ${K} exactly when <b>P[i+1] and P[j] leave the same remainder</b>. So only remainders matter: k buckets, and each new prefix pairs with every earlier prefix in its bucket. The empty prefix (remainder 0) starts in bucket 0.` });
      nums.forEach((x, i) => {
        const raw = run + x;
        run = ((raw % K) + K) % K; rem.push(run);
        const hits = buckets[run];
        const starts = rem.slice(0, -1).map((v, j) => (v === run ? j : -1)).filter((j) => j >= 0);
        const negNote = raw < 0 ? ` (${raw} is negative: Python’s % already gives ${run}; in C#/Java ${raw} % ${K} = ${raw % K}, so add k and take % again)` : "";
        push({ i, starts, line: 4, vars: { i, x, run, count }, note: `run = (${neg(rem[i])} + ${neg(x)}) mod ${K} = <b>${run}</b>${negNote}.` });
        count += hits;
        push({ i, starts, line: 5, vars: { i, run, [`buckets[${run}]`]: hits, count }, note: hits ? `Bucket ${run} already holds ${hits} earlier prefix(es), at P index ${starts.join(", ")}. Each one starts a subarray ending at ${i} whose sum is divisible by ${K}: ${starts.map((j) => `nums[${j}…${i}]`).join(", ")}. count = <b>${count}</b>.` : `Bucket ${run} is empty: no earlier prefix has remainder ${run}, so no divisible subarray ends at ${i}.` });
        buckets[run]++;
        push({ i, line: 6, vars: { i, run, [`buckets[${run}]`]: buckets[run], count }, note: `Drop this prefix into bucket ${run} (now ${buckets[run]}), so later indices can pair with it.` });
      });
      push({ final: true, i: nums.length, line: 7, vars: { count }, note: `<b>${count}</b> subarray(s) have a sum divisible by ${K}. Equivalently Σ C(bucket, 2) over the final buckets: ${buckets.map((b) => `C(${b},2)`).join(" + ")} = ${buckets.reduce((s, b) => s + (b * (b - 1)) / 2, 0)}.` });
      return fr;
    },
    render: (f) => wrap("ps-stack ps-center",
      Viz.array(f.nums, { label: "nums", ptrs: f.i >= 0 && f.i < f.nums.length ? { i: f.i } : {}, cls: (j) => (f.final ? "" : f.starts && f.starts.length && j >= Math.max(...f.starts) && j <= f.i ? "path" : j === f.i ? "active" : j > f.i ? "dim" : "") }) +
      Viz.array(f.rem, { label: `prefix remainders  P[j] mod ${f.K}`, cls: (j) => (f.final ? "" : f.starts && f.starts.includes(j) ? "done" : j === f.rem.length - 1 && f.i >= 0 ? "active" : "") }) +
      wrap("ps-code-cap", Viz.array(f.buckets, { label: "buckets[r] = prefixes with remainder r", idxLabel: (r) => `r=${r}`, cls: (r) => (f.final ? (f.buckets[r] > 1 ? "done" : "") : f.i >= 0 && r === f.rem[f.rem.length - 1] ? "active" : "") })),
    ),
  }));

  /* 6. Product of array except self: prefix products, then a suffix sweep. */
  Viz.register("prefix-sums-product", (el) => Viz.player(el, {
    title: "Product except self: left products in, then right products on the way back",
    legend: [["active", "i"], ["visit", "multiplied into prefix"], ["done", "multiplied into suffix"], ["path", "final answer"]],
    codeLang: "python",
    code: [
      "out = [1] * n",
      "for i in range(1, n):",
      "    out[i] = out[i-1] * nums[i-1]  # left",
      "suffix = 1                         # right",
      "for i in range(n - 1, -1, -1):",
      "    out[i] *= suffix",
      "    suffix *= nums[i]",
    ],
    inputs: [{ key: "a", label: "nums", value: "2,3,1,4,5", width: 180 }],
    random: () => ({ a: Viz.randInts(Viz.rand(4, 7), -3, 5).join(",") }),
    build: ({ a }) => {
      const nums = Viz.parse.ints(a, { min: 2, max: 8 });
      if (nums.some((v) => !Number.isInteger(v) || Math.abs(v) > 9)) throw new Error("Use whole numbers from −9 to 9 (products grow fast).");
      const n = nums.length, out = Array(n).fill(1), fr = [];
      let suffix = 1;
      const push = (o) => fr.push({ nums, out: [...out], suffix, ...o });
      push({ line: 0, vars: { n }, note: `answer[i] = (product of everything left of i) × (product of everything right of i). No division, so zeros are fine. Pass 1 stores the left products in out; pass 2 multiplies in the right products with a single running variable: O(1) extra space.` });
      for (let i = 1; i < n; i++) {
        out[i] = out[i - 1] * nums[i - 1];
        push({ i, pass: 1, line: [1, 2], vars: { i, "out[i-1]": out[i - 1], "nums[i-1]": nums[i - 1], "out[i]": out[i] }, note: `out[${i}] = out[${i - 1}] × nums[${i - 1}] = ${neg(out[i - 1])} × ${neg(nums[i - 1])} = <b>${out[i]}</b>: the product of nums[0…${i - 1}]. out[0] stays 1: nothing is left of index 0.` });
      }
      for (let i = n - 1; i >= 0; i--) {
        const before = out[i];
        out[i] *= suffix;
        push({ i, pass: 2, line: [4, 5], vars: { i, suffix, "out[i]": out[i] }, note: `suffix = ${suffix} is the product of nums[${i + 1}…${n - 1}]${i === n - 1 ? " (empty: 1)" : ""}. out[${i}] = ${neg(before)} × ${neg(suffix)} = <b>${out[i]}</b>: left × right is complete for index ${i}.` });
        suffix *= nums[i];
        push({ i, pass: 2, after: true, line: 6, vars: { i, suffix }, note: `Fold nums[${i}] into suffix → ${suffix}, ready for index ${i - 1}${i === 0 ? " (none left)" : ""}.` });
      }
      push({ final: true, line: 6, vars: { out: `[${out.join(", ")}]` }, note: `Every out[i] is the product of all elements but nums[i], in two O(n) passes and O(1) extra space (out itself is the answer).` });
      return fr;
    },
    render: (f) => wrap("ps-stack ps-center",
      Viz.array(f.nums, {
        label: "nums",
        ptrs: f.i !== undefined ? { i: f.i } : {},
        cls: (j) => (f.final ? "" : f.pass === 1 ? (j < f.i ? "visit" : j === f.i ? "active" : "dim") : f.pass === 2 ? (f.after && j === f.i ? "done" : j === f.i ? "active" : j > f.i ? "done" : "visit") : ""),
      }) +
      Viz.array(f.out, {
        label: "out",
        cls: (j) => (f.final ? "path" : f.pass === 1 ? (j === f.i ? "active" : j < f.i ? "visit" : "dim") : f.pass === 2 ? (j === f.i ? "active" : j > f.i ? "path" : "visit") : ""),
      }) +
      Viz.array([f.suffix], { label: "suffix", showIdx: false, cls: () => (f.pass === 2 ? "done" : "dim") }),
    ),
  }));

  /* 7. 2D difference array: four corner marks per rectangle, then a 2D prefix sum. */
  Viz.register("prefix-sums-2d-diff", (el) => Viz.player(el, {
    title: "2D difference array: four corner marks per rectangle, one 2D prefix pass",
    legend: [["done", "+v corner"], ["bad", "−v corner"], ["path", "rectangle"], ["active", "current"], ["visit", "read"]],
    codeLang: "python",
    code: [
      "D = [[0] * (n + 1) for _ in range(m + 1)]",
      "for r1, c1, r2, c2, v in updates:",
      "    D[r1][c1] += v;      D[r1][c2+1] -= v",
      "    D[r2+1][c1] -= v;    D[r2+1][c2+1] += v",
      "for r in range(m):",
      "    for c in range(n):  # 2D prefix in place",
      "        D[r][c] += (D[r-1][c] + D[r][c-1]",
      "                    - D[r-1][c-1])",
    ],
    inputs: [
      { key: "s", label: "size m×n", value: "4x5", width: 70 },
      { key: "u", label: "updates r1 c1 r2 c2 v; …", value: "0 1 2 3 1; 1 0 3 2 2", width: 220 },
    ],
    random: () => {
      const m = Viz.rand(3, 5), n = Viz.rand(3, 5), us = [];
      for (let k = 0; k < Viz.rand(1, 3); k++) {
        const r1 = Viz.rand(0, m - 1), c1 = Viz.rand(0, n - 1);
        us.push(`${r1} ${c1} ${Viz.rand(r1, m - 1)} ${Viz.rand(c1, n - 1)} ${Viz.rand(1, 3)}`);
      }
      return { s: `${m}x${n}`, u: us.join("; ") };
    },
    build: ({ s, u }) => {
      const mm = String(s).trim().match(/^(\d+)\s*[x×,]\s*(\d+)$/i);
      if (!mm) throw new Error("Write the size as m×n, for example 4x5.");
      const M = Number(mm[1]), N = Number(mm[2]);
      if (M < 1 || N < 1 || M > 5 || N > 5) throw new Error("Use a size from 1x1 to 5x5.");
      const ups = parseTriples(u, 5, "update");
      if (!ups.length || ups.length > 4) throw new Error("Use 1–4 updates.");
      for (const [r1, c1, r2, c2, v] of ups) {
        if (r1 < 0 || c1 < 0 || r1 > r2 || c1 > c2 || r2 >= M || c2 >= N) throw new Error(`Each update needs 0 ≤ r1 ≤ r2 ≤ ${M - 1} and 0 ≤ c1 ≤ c2 ≤ ${N - 1}.`);
        if (Math.abs(v) > 9) throw new Error("Keep v between −9 and 9.");
      }
      const D = Array.from({ length: M + 1 }, () => Array(N + 1).fill(0)), fr = [];
      const push = (o) => fr.push({ D: D.map((r) => [...r]), M, N, ...o });
      push({ line: 0, vars: { m: M, n: N }, note: `The 2D version of the same idea: a mark at (r, c) means “add this to every cell at or below-right of (r, c)”, because the 2D prefix sum will spread it there. One spare row and column hold the cancelling marks.` });
      ups.forEach(([r1, c1, r2, c2, v], k) => {
        D[r1][c1] += v; D[r1][c2 + 1] -= v; D[r2 + 1][c1] -= v; D[r2 + 1][c2 + 1] += v;
        push({ up: [r1, c1, r2, c2, v], line: [1, 2, 3], vars: { update: k + 1, r1, c1, r2, c2, v }, note: `Rectangle (${r1},${c1})…(${r2},${c2}) gets ${sgn(v)}. Mark ${sgn(v)} at its top-left (spreads down-right forever), ${sgn(-v)} just right of it at (${r1},${c2 + 1}) and just below it at (${r2 + 1},${c1}) to stop the spread, and ${sgn(v)} at (${r2 + 1},${c2 + 1}) because that region was cancelled twice. Four writes, whatever the area.` });
      });
      for (let r = 0; r < M; r++) for (let c = 0; c < N; c++) {
        const up = r ? D[r - 1][c] : 0, left = c ? D[r][c - 1] : 0, diag = r && c ? D[r - 1][c - 1] : 0, mark = D[r][c];
        D[r][c] = mark + up + left - diag;
        push({ cur: [r, c], line: [4, 5, 6, 7], vars: { r, c, mark, up, left, diag, value: D[r][c] }, note: `D[${r}][${c}] = mark ${neg(mark)} + up ${neg(up)} + left ${neg(left)} − diag ${neg(diag)} = <b>${D[r][c]}</b>. Exactly the 2D prefix-sum rule, applied to the marks.` });
      }
      push({ final: true, line: 7, vars: { updates: ups.length }, note: `The top-left m × n block now holds every cell’s total. O(1) per rectangle update + O(mn) once, instead of O(area) per update. The spare row and column are scratch and are ignored.` });
      return fr;
    },
    render: (f) => {
      const swept = (r, c) => f.cur && (r < f.cur[0] || (r === f.cur[0] && c <= f.cur[1]));
      return Viz.row(Viz.grid(f.D, {
        label: f.final ? "D after the 2D prefix pass (top-left m × n)" : f.cur ? "D during the pass: swept cells hold totals" : "D: corner marks",
        rowLabels: rangeOf(0, f.M), colLabels: rangeOf(0, f.N),
        fmt: (v, r, c) => ((f.final && r < f.M && c < f.N) || swept(r, c) ? String(v) : v > 0 ? `+${v}` : String(v)),
        cls: (r, c) => {
          const v = f.D[r][c];
          if (f.up) {
            const [r1, c1, r2, c2] = f.up;
            if (r === r1 && c === c1) return "done";
            if ((r === r1 && c === c2 + 1) || (r === r2 + 1 && c === c1)) return "bad";
            if (r === r2 + 1 && c === c2 + 1) return "done";
            if (r >= r1 && r <= r2 && c >= c1 && c <= c2) return "path";
            return "";
          }
          if (r === f.M || c === f.N) return "dim";
          if (f.final) return v ? "path" : "";
          if (f.cur) {
            const [cr, cc] = f.cur;
            if (r === cr && c === cc) return "active";
            if ((r === cr - 1 && c === cc) || (r === cr && c === cc - 1) || (r === cr - 1 && c === cc - 1)) return "visit";
            return swept(r, c) ? "" : v > 0 ? "done" : v < 0 ? "bad" : "dim";
          }
          return v > 0 ? "done" : v < 0 ? "bad" : "";
        },
      }));
    },
  }));
})();
