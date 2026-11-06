/* Visualizers for 1D & Grid DP. Every name is prefixed "dp-linear-grid-". Frames are produced by running the real algorithms. */
(() => {
  const esc = Viz.esc;
  const hl = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  /* The engine's code panel is static; rewrite its lines when the program changes (placeholder lines keep the count). */
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hl(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const INF = Infinity;
  const fmtN = (v) => (v === INF ? "∞" : v === -INF ? "-∞" : v === null || v === undefined ? "" : v === true ? "T" : v === false ? "F" : String(v));

  /* ---------- SVG table with dependency arrows (cells use the svg.dg box classes) ---------- */
  function dgrid(M, o = {}) {
    const R = M.length, C = o.cols || Math.max(1, ...M.map((r) => r.length));
    const cs = o.size || 46, gap = o.gap ?? 8;
    const padL = o.rowLabels ? (o.rowLabelW || 50) : 4;
    const up = o.arcUp || 0, down = o.arcDown || 0;
    const padT = (o.colLabels ? 20 : 4) + up;
    const off = (r) => (o.rowOffset ? o.rowOffset(r) : 0);
    const X = (r, c) => padL + (c + off(r)) * (cs + gap), Y = (r) => padT + r * (cs + gap);
    const W = padL + C * (cs + gap) - gap + 6, H = Y(R) - gap + 6 + down;
    let s = "";
    if (o.colLabels) o.colLabels.forEach((l, c) => { s += `<text class="dlg-lab" x="${X(0, c) + cs / 2}" y="${13}" text-anchor="middle">${esc(l)}</text>`; });
    if (o.rowLabels) o.rowLabels.forEach((l, r) => { s += `<text class="dlg-lab" x="${padL - 8}" y="${Y(r) + cs / 2}" text-anchor="end" dominant-baseline="central">${esc(l)}</text>`; });
    M.forEach((row, r) => row.forEach((v, c) => {
      if (v === undefined) return;
      const cl = (o.cls ? o.cls(r, c, v) : "") || "";
      const x = X(r, c), y = Y(r);
      s += `<rect class="box ${cl}" x="${x}" y="${y}" width="${cs}" height="${cs}" rx="7"/>`;
      const t = o.fmt ? o.fmt(v, r, c) : fmtN(v);
      s += `<text class="dlg-v ${cl}" x="${x + cs / 2}" y="${y + cs / 2 + (o.sub ? 4 : 0)}" text-anchor="middle" dominant-baseline="central">${esc(t)}</text>`;
      const sb = o.sub ? o.sub(r, c, v) : "";
      if (sb !== "" && sb !== null && sb !== undefined) s += `<text class="dlg-sub" x="${x + 5}" y="${y + 12}">${esc(sb)}</text>`;
      const tg = o.tag ? o.tag(r, c, v) : "";
      if (tg) s += `<text class="dlg-sub" x="${x + cs - 5}" y="${y + 12}" text-anchor="end">${esc(tg)}</text>`;
    }));
    const head = (x2, y2, vx, vy, cl) => `<polygon class="dlg-ah ${cl}" points="${x2},${y2} ${x2 - vx * 9 - vy * 4.5},${y2 - vy * 9 + vx * 4.5} ${x2 - vx * 9 + vy * 4.5},${y2 - vy * 9 - vx * 4.5}"/>`;
    let labels = "";
    for (const a of o.arrows || []) {
      const [r1, c1] = a.from, [r2, c2] = a.to, cl = a.cls || "active";
      if (a.arc) {
        const dir = a.arc === "down" ? 1 : -1;
        const x1 = X(r1, c1) + cs / 2 + (c2 > c1 ? 6 : -6), x2 = X(r2, c2) + cs / 2 + (c2 > c1 ? -6 : 6);
        const y1 = dir < 0 ? Y(r1) - 1 : Y(r1) + cs + 1, y2 = dir < 0 ? Y(r2) - 2 : Y(r2) + cs + 2;
        const span = Math.abs(c2 - c1) + Math.abs(off(r2) - off(r1));
        const h = Math.min((dir < 0 ? up : down) - 6, 10 + 9 * span);
        const mx = (x1 + x2) / 2, my = Math.min(y1, y2) + dir * h * 2;
        const ex = x2 - mx, ey = y2 - my, el = Math.hypot(ex, ey) || 1;
        s += `<path class="dlg-halo" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/><path class="dlg-e ${cl}" d="M${x1},${y1} Q${mx},${my} ${x2},${y2}"/>${head(x2, y2, ex / el, ey / el, cl)}`;
        if (a.label !== undefined) labels += `<text class="dlg-el ${cl}" x="${mx}" y="${(Math.min(y1, y2) + my) / 2 + dir * 2}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
        continue;
      }
      const cx1 = X(r1, c1) + cs / 2, cy1 = Y(r1) + cs / 2, cx2 = X(r2, c2) + cs / 2, cy2 = Y(r2) + cs / 2;
      const dx = cx2 - cx1, dy = cy2 - cy1, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const m = Math.max(Math.abs(ux), Math.abs(uy));
      const k1 = (cs / 2 / m) * 0.35, k2 = cs / 2 / m + 1;
      const x1 = cx1 + ux * k1, y1 = cy1 + uy * k1, x2 = cx2 - ux * k2, y2 = cy2 - uy * k2;
      s += `<path class="dlg-halo" d="M${x1},${y1} L${x2},${y2}"/><path class="dlg-e ${cl}" d="M${x1},${y1} L${x2},${y2}"/>${head(x2, y2, ux, uy, cl)}`;
      if (a.label !== undefined) labels += `<text class="dlg-el ${cl}" x="${(x1 + x2) / 2 - uy * 9}" y="${(y1 + y2) / 2 + ux * 9}" text-anchor="middle" dominant-baseline="central">${esc(a.label)}</text>`;
    }
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="dg dlg-g" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(o.label || "DP table")}">${s}${labels}</svg></div>`;
  }
  const parseGrid = (s, { maxR = 6, maxC = 7, min = -99, max = 99 } = {}) => {
    const g = Viz.parse.matrix(s);
    if (!g.length || g.length > maxR) throw new Error(`Use 1 to ${maxR} rows separated by ";".`);
    if (g.some((r) => r.length !== g[0].length)) throw new Error("Every row needs the same number of values.");
    if (g[0].length > maxC) throw new Error(`Use at most ${maxC} columns.`);
    if (g.flat().some((v) => typeof v !== "number" || !Number.isInteger(v) || v < min || v > max)) throw new Error(`Cells must be whole numbers from ${min} to ${max}.`);
    return g;
  };
  const nums = (s, { min = 1, max = 10, lo = 0, hi = 99, what = "Values" } = {}) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what} must be whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const randGrid = (R, C, lo, hi) => Array.from({ length: R }, () => Viz.randInts(C, lo, hi).join(",")).join("; ");
  const idxLabels = (n, p = "i=") => Array.from({ length: n }, (_, i) => `${p}${i}`);

  /* ================= 1. House Robber: line and circle ================= */
  const ROB = ["line: House Robber (198)", "circle: House Robber II (213)"];
  const ROB_CODE = {
    line: ["def rob(nums):", "    dp = [0] * (n + 1)     # dp[i] = best loot from the first i houses", "    dp[1] = nums[0]", "    for i in range(2, n + 1):", "        dp[i] = max(dp[i-1],                # skip house i-1", "                    dp[i-2] + nums[i-1])    # rob house i-1", "    return dp[n]", "# walk back: dp[i] == dp[i-1] means house i-1 was skipped"],
    circle: ["def rob_circle(nums):", "    if len(nums) == 1: return nums[0]", "    a = rob(nums[:-1])    # house 0 and house n-1 are neighbours,", "    b = rob(nums[1:])     # so drop one of them; try both ways", "    return max(a, b)", "# rob() is the line version:", "#   dp[i] = max(dp[i-1], dp[i-2] + house)", ""],
  };
  Viz.register("dp-linear-grid-robber", (el, opts) => Viz.player(el, {
    title: "House Robber: rob or skip, one house at a time",
    tag: "TAKE / SKIP",
    legend: [["active", "cell being computed"], ["done", "winning option"], ["visit", "losing option"], ["path", "houses robbed"], ["bad", "the extra neighbour in a circle"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "street", type: "select", value: opts && ROB.includes(opts.mode) ? opts.mode : ROB[0], options: ROB },
      { key: "nums", label: "cash per house (1 to 10)", value: (opts && opts.nums) || "2,7,9,3,1,5", width: 190 },
    ],
    random: () => ({ nums: Viz.randInts(Viz.rand(3, 9), 0, 20).join(",") }),
    build: ({ mode, nums: ns }) => {
      const circle = mode === ROB[1];
      setCode(el, circle ? ROB_CODE.circle : ROB_CODE.line);
      const a = nums(ns, { min: 1, max: 10, lo: 0, hi: 400, what: "Cash amounts" });
      const n = a.length, fr = [];
      const passes = circle ? (n === 1 ? [] : [{ lo: 0, hi: n - 2, name: "skip the last house" }, { lo: 1, hi: n - 1, name: "skip the first house" }]) : [{ lo: 0, hi: n - 1, name: "" }];
      const M = passes.map((p) => Array(p.hi - p.lo + 2).fill(null));
      let houseCls = {}, arrows = [], cur = null;
      const snap = (note, line, vars = {}) => fr.push({ M: Viz.clone(M), cur, arrows: arrows.slice(), houseCls: { ...houseCls }, note, line, vars });
      const results = [];
      if (circle && n === 1) {
        houseCls = { 0: "path" };
        snap(`Only one house: no neighbours at all, so rob it. Answer <b>${a[0]}</b>.`, 1, { answer: a[0] });
        fr[fr.length - 1].ans = a[0]; fr[fr.length - 1].taken = [0];
        return fr.map((f) => ({ ...f, a, circle, passes }));
      }
      passes.forEach((p, r) => {
        const v = a.slice(p.lo, p.hi + 1), L = v.length, row = M[r];
        const lineA = circle ? (r === 0 ? 2 : 3) : 1;
        houseCls = {}; if (circle) houseCls[r === 0 ? n - 1 : 0] = "dim";
        row[0] = 0; cur = [r, 0]; arrows = [];
        snap(circle ? `Pass ${r + 1}: <b>${p.name}</b> (house ${r === 0 ? n - 1 : 0} is out), which turns the circle into a line of houses ${p.lo}…${p.hi}. dp[0] = 0: no houses, no cash.` : "dp[0] = 0: from zero houses you steal nothing. That is the base case the recurrence needs.", lineA, { i: 0, "dp[i]": 0 });
        row[1] = v[0]; cur = [r, 1]; houseCls[p.lo] = "active";
        snap(`dp[1] = ${v[0]}: with one house available, rob it.`, circle ? lineA : 2, { i: 1, "dp[i]": v[0] });
        for (let i = 2; i <= L; i++) {
          const skip = row[i - 1], take = row[i - 2] + v[i - 1], best = Math.max(skip, take);
          row[i] = best; cur = [r, i];
          houseCls = circle ? { [r === 0 ? n - 1 : 0]: "dim" } : {}; houseCls[p.lo + i - 1] = "active";
          const tw = take > skip;
          arrows = [{ from: [r, i - 1], to: [r, i], arc: "up", cls: tw ? "visit" : "done", label: "skip" }, { from: [r, i - 2], to: [r, i], arc: "up", cls: tw ? "done" : "visit", label: `+${v[i - 1]}` }];
          snap(`House ${p.lo + i - 1} (cash ${v[i - 1]}). <b>Skip</b> it: keep dp[${i - 1}] = ${skip}. <b>Rob</b> it: house ${p.lo + i - 2} must be skipped, so dp[${i - 2}] + ${v[i - 1]} = ${take}. dp[${i}] = max = <b>${best}</b>${take === skip ? " (tie)" : tw ? " by robbing" : " by skipping"}.`, circle ? lineA : [4, 5], { i, skip, rob: take, "dp[i]": best });
        }
        /* walk back */
        const taken = []; let i = L; arrows = [];
        while (i >= 1) {
          if (row[i] === row[i - 1]) { i -= 1; continue; }
          taken.push(p.lo + i - 1); arrows.push({ from: [r, Math.max(0, i - 2)], to: [r, i], arc: "up", cls: "path", label: `+${v[i - 1]}` }); i -= 2;
        }
        taken.reverse(); cur = null;
        houseCls = circle ? { [r === 0 ? n - 1 : 0]: "dim" } : {}; taken.forEach((h) => { houseCls[h] = "path"; });
        results.push({ val: row[L], taken });
        snap(`${circle ? `Pass ${r + 1} best = <b>${row[L]}</b>. ` : ""}Walk back from dp[${L}]: wherever dp[i] differs from dp[i−1], house i−1 was robbed and we jump two cells left. Robbed: houses ${taken.length ? taken.join(", ") : "none"}${taken.length ? ` (${taken.map((h) => a[h]).join(" + ")} = ${row[L]})` : ""}.`, circle ? lineA : 7, { best: row[L] });
      });
      const win = results.length === 2 && results[1].val > results[0].val ? 1 : 0, ans = results[win].val;
      houseCls = {}; results[win].taken.forEach((h) => { houseCls[h] = "path"; }); arrows = []; cur = null;
      snap(circle ? `Answer = max(${results[0].val}, ${results[1].val}) = <b>${ans}</b>. Every valid plan leaves house 0 or house ${n - 1} unrobbed (they are neighbours), so one of the two passes saw it.` : `Answer dp[${n}] = <b>${ans}</b>. O(n) time; only dp[i−1] and dp[i−2] are read, so two variables would do.`, circle ? 4 : 6, { answer: ans });
      fr[fr.length - 1].ans = ans; fr[fr.length - 1].taken = results[win].taken;
      return fr.map((f) => ({ ...f, a, circle, passes }));
    },
    render: (f) => {
      const n = f.a.length;
      let street;
      if (f.circle) {
        const R = n <= 4 ? 70 : 95, nodes = f.a.map((v, i) => ({ id: String(i), x: R + R * Math.sin((2 * Math.PI * i) / n), y: R - R * Math.cos((2 * Math.PI * i) / n), label: String(v), sub: `h${i}` }));
        const edges = n > 1 ? f.a.map((_, i) => ({ u: String(i), v: String((i + 1) % n) })).filter((e, k, arr) => n > 2 || k === 0) : [];
        street = Viz.graph({ nodes, edges }, { r: 19, label: "houses in a circle (label = cash, under = index)", nodeCls: (id) => f.houseCls[id] || "", edgeCls: (k) => (n > 2 && (k === `${n - 1}-0`) ? "bad" : "") });
      } else street = Viz.array(f.a, { label: "houses (cash)", cls: (i) => f.houseCls[i] || "" });
      const cls = (r, c) => {
        if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
        const ar = f.arrows.find((x) => x.from[0] === r && x.from[1] === c);
        if (ar) return `${ar.cls} dep`;
        return f.M[r][c] !== null ? "done" : "";
      };
      const g = f.passes.length ? dgrid(f.M, { label: "dp[i] = best loot using the first i houses of the line", cls, arrows: f.arrows, arcUp: 46, size: 44, colLabels: idxLabels(f.M[0].length), rowLabels: f.circle ? ["no last", "no first"] : undefined, rowLabelW: 66 }) : "";
      return `<div class="dlg-col">${street}${g}</div>`;
    },
  }));

  /* ================= 2. Decode Ways ================= */
  const DEC_CODE = ["def num_decodings(s):", "    dp = [0] * (n + 1)     # dp[i] = ways to decode s[:i]", "    dp[0] = 1              # the empty prefix: one way", "    for i in range(1, n + 1):", "        if s[i-1] != '0':                # last piece: one digit", "            dp[i] += dp[i-1]", "        if '10' <= s[i-2:i] <= '26':     # last piece: two digits", "            dp[i] += dp[i-2]", "    return dp[n]"];
  const letter = (k) => String.fromCharCode(64 + k);
  Viz.register("dp-linear-grid-decode", (el) => Viz.player(el, {
    title: "Decode Ways: the last piece is one digit or two",
    tag: "COUNTING DP",
    legend: [["active", "cell being computed"], ["done", "valid last piece: add its ways"], ["bad", "invalid piece: contributes 0"], ["visit", "digits of the last piece"]],
    codeLang: "python",
    code: DEC_CODE,
    inputs: [{ key: "s", label: "digits (1 to 12)", value: "226102", width: 150 }],
    random: () => ({ s: Array.from({ length: Viz.rand(3, 9) }, () => (Math.random() < 0.2 ? "0" : String(Viz.rand(1, Math.random() < 0.6 ? 2 : 9)))).join("") }),
    build: ({ s }) => {
      s = String(s).trim();
      if (!/^\d{1,12}$/.test(s)) throw new Error("Type 1 to 12 digits, for example 226.");
      const n = s.length, dp = Array(n + 1).fill(null), fr = [];
      dp[0] = 1;
      fr.push({ dp: dp.slice(), cur: [0, 0], arrows: [], chars: {}, note: "dp[0] = 1: the empty prefix has exactly one decoding (decode nothing). Without it, every count would come out 0.", line: 2, vars: { i: 0, "dp[i]": 1 } });
      for (let i = 1; i <= n; i++) {
        const one = s[i - 1] !== "0", two = i >= 2 && s[i - 2] !== "0" && +s.slice(i - 2, i) <= 26;
        let v = 0; const arrows = [], parts = [];
        if (one) v += dp[i - 1];
        arrows.push({ from: [0, i - 1], to: [0, i], arc: "up", cls: one ? "done" : "bad", label: one ? `${s[i - 1]}→${letter(+s[i - 1])}` : "0 ✗" });
        parts.push(one ? `one digit "${s[i - 1]}" = ${letter(+s[i - 1])} is valid: + dp[${i - 1}] = ${dp[i - 1]}` : `one digit "0" maps to no letter: + 0`);
        if (i >= 2) {
          const t = s.slice(i - 2, i);
          if (two) v += dp[i - 2];
          arrows.push({ from: [0, i - 2], to: [0, i], arc: "down", cls: two ? "done" : "bad", label: two ? `${t}→${letter(+t)}` : `${t} ✗` });
          parts.push(two ? `two digits "${t}" = ${letter(+t)} is valid: + dp[${i - 2}] = ${dp[i - 2]}` : `two digits "${t}" is ${t[0] === "0" ? "a leading zero" : "above 26"}: + 0`);
        }
        dp[i] = v;
        const chars = { [i - 1]: "visit" }; if (i >= 2) chars[i - 2] = two ? "visit" : chars[i - 2];
        fr.push({ dp: dp.slice(), cur: [0, i], arrows, chars, note: `dp[${i}] (prefix "${s.slice(0, i)}"): ${parts.join("; ")}. Total <b>${v}</b>.${v === 0 ? " Zero ways: this prefix cannot be decoded, and every longer prefix that ends a piece here inherits that." : ""}`, line: two ? [4, 5, 6, 7] : [4, 5], vars: { i, "dp[i-1]": dp[i - 1], "dp[i-2]": i >= 2 ? dp[i - 2] : "—", "dp[i]": v } });
      }
      const all = []; const go = (k, acc) => { if (all.length > 6) return; if (k === n) { all.push(acc.join("")); return; } if (s[k] !== "0") go(k + 1, [...acc, letter(+s[k])]); if (k + 1 < n && s[k] !== "0" && +s.slice(k, k + 2) <= 26) go(k + 2, [...acc, letter(+s.slice(k, k + 2))]); };
      go(0, []);
      const ans = dp[n];
      fr.push({ dp: dp.slice(), cur: null, arrows: [], chars: {}, note: ans ? `<b>${ans}</b> decoding${ans > 1 ? "s" : ""}: ${all.slice(0, 6).join(", ")}${ans > 6 ? ", …" : ""}. Each one is a path of valid arrows from dp[0] to dp[${n}]; the DP counts paths without listing them.` : `<b>0</b> decodings: some "0" cannot attach to the digit before it.`, line: 8, vars: { answer: ans }, ans });
      return fr.map((f) => ({ ...f, s }));
    },
    render: (f) => {
      const n = f.s.length;
      const chars = Viz.array(f.s.split(""), { label: "s (index under each digit; dp[i] covers s[:i])", cls: (i) => f.chars[i] || "" });
      const g = dgrid([f.dp], { label: "dp[i] = ways to decode the first i digits (top arcs: 1 digit, bottom arcs: 2 digits)", size: 44, arcUp: 40, arcDown: 40, colLabels: idxLabels(n + 1), arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[1] === c ? "active" : f.arrows.some((a) => a.from[1] === c) ? `${f.arrows.find((a) => a.from[1] === c).cls} dep` : f.dp[c] !== null ? "done" : "") });
      return `<div class="dlg-col">${chars}${g}</div>`;
    },
  }));

  /* ================= 3. Word Break ================= */
  const WB_CODE = ["def word_break(s, words):", "    dp = [False] * (n + 1)   # dp[i]: s[:i] splits into words", "    dp[0] = True", "    for i in range(1, n + 1):", "        for j in range(i):", "            if dp[j] and s[j:i] in words:   # a good prefix + one word", "                dp[i] = True; parent[i] = j", "                break", "    return dp[n]"];
  Viz.register("dp-linear-grid-wordbreak", (el) => Viz.player(el, {
    title: "Word Break: a good prefix plus one dictionary word",
    tag: "FEASIBILITY DP",
    legend: [["active", "cell being decided"], ["done", "s[j:i] is a word"], ["bad", "s[j:i] is not a word"], ["visit", "the substring being tested"], ["path", "one valid split"]],
    codeLang: "python",
    code: WB_CODE,
    inputs: [
      { key: "s", label: "s (lowercase, 1 to 14)", value: "catsanddog", width: 150 },
      { key: "words", label: "dictionary (comma separated)", value: "cat,cats,and,sand,dog", width: 220 },
    ],
    random: () => {
      const pool = ["a", "ab", "abc", "b", "bc", "ca", "cab", "c", "ba"];
      const words = [...new Set(Array.from({ length: Viz.rand(2, 4) }, () => pool[Viz.rand(0, pool.length - 1)]))];
      let s = ""; while (s.length < Viz.rand(5, 10)) s += Math.random() < 0.85 ? words[Viz.rand(0, words.length - 1)] : "c";
      return { s: s.slice(0, 14), words: words.join(",") };
    },
    build: ({ s, words: ws }) => {
      s = String(s).trim();
      if (!/^[a-z]{1,14}$/.test(s)) throw new Error("s must be 1 to 14 lowercase letters.");
      const words = [...new Set(String(ws).split(/[\s,]+/).filter(Boolean))];
      if (!words.length || words.length > 8 || words.some((w) => !/^[a-z]{1,8}$/.test(w))) throw new Error("Give 1 to 8 lowercase words of up to 8 letters, separated by commas.");
      const D = new Set(words), n = s.length, dp = Array(n + 1).fill(null), par = Array(n + 1).fill(-1), fr = [];
      dp[0] = true;
      const snap = (cur, arrows, span, note, line, vars) => fr.push({ dp: dp.slice(), cur, arrows, span, note, line, vars, par: par.slice() });
      snap([0, 0], [], null, "dp[0] = True: the empty prefix is trivially split into zero words.", 2, { i: 0 });
      let tests = 0;
      for (let i = 1; i <= n; i++) {
        let found = false; const skipped = [];
        for (let j = 0; j < i; j++) {
          if (!dp[j]) { skipped.push(j); continue; }
          tests++;
          const w = s.slice(j, i), ok = D.has(w);
          if (ok) { dp[i] = true; par[i] = j; found = true; }
          snap([0, i], [{ from: [0, j], to: [0, i], arc: "up", cls: ok ? "done" : "bad", label: w.length <= 6 ? w : `${w.slice(0, 5)}…` }], [j, i - 1],
            `dp[${i}]: try the last word s[${j}:${i}] = "${w}". dp[${j}] is True (a good prefix)${skipped.length ? `; j = ${skipped.join(", ")} were skipped because dp[j] is False` : ""}. "${w}" is ${ok ? "<b>in</b> the dictionary, so dp[" + i + "] = True. Stop looking." : "<b>not</b> a word."}`, ok ? [5, 6, 7] : [4, 5], { i, j, tested: tests });
          skipped.length = 0;
          if (ok) break;
        }
        if (!found) { dp[i] = false; snap([0, i], [], null, `dp[${i}] = False: no good prefix s[:j] is followed by a dictionary word ending at position ${i}.`, 4, { i, tested: tests }); }
      }
      const path = [];
      if (dp[n]) { let i = n; while (i > 0) { path.push([par[i], i]); i = par[i]; } path.reverse(); }
      const ans = dp[n];
      fr.push({ dp: dp.slice(), cur: null, arrows: path.map(([j, i]) => ({ from: [0, j], to: [0, i], arc: "up", cls: "path", label: s.slice(j, i).length <= 6 ? s.slice(j, i) : `${s.slice(j, i).slice(0, 5)}…` })), span: null, par: par.slice(), path,
        note: ans ? `dp[${n}] = <b>True</b>. Following parent pointers back from ${n} gives one split: <b>${path.map(([j, i]) => s.slice(j, i)).join(" · ")}</b>. ${tests} substring tests in total; the worst case is O(n²) tests (O(n³) with string slicing).` : `dp[${n}] = <b>False</b>: no split exists. ${tests} substring tests.`, line: 8, vars: { answer: ans ? "True" : "False" }, ans });
      return fr.map((f) => ({ ...f, s }));
    },
    render: (f) => {
      const n = f.s.length;
      const inPath = (k) => f.path && f.path.length && k < n;
      const chars = Viz.array(f.s.split(""), { label: "s", cls: (k) => (f.span && k >= f.span[0] && k <= f.span[1] ? "visit" : inPath(k) ? "path" : "") });
      const g = dgrid([f.dp], { label: "dp[i] = can s[:i] be split into dictionary words?", size: 40, arcUp: 74, colLabels: idxLabels(n + 1, ""), arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[1] === c ? "active" : f.arrows.some((a) => a.from[1] === c) ? `${f.arrows.find((a) => a.from[1] === c).cls} dep` : f.dp[c] === true ? "done" : f.dp[c] === false ? "dim" : "") });
      return `<div class="dlg-col">${chars}${g}</div>`;
    },
  }));

  /* ================= 4. Kadane: max sum / max product ================= */
  const KAD = ["max sum: Maximum Subarray (53)", "max product: Maximum Product Subarray (152)"];
  const KAD_CODE = {
    sum: ["def max_subarray(nums):", "    cur = best = nums[0]   # cur = best sum of a subarray ENDING here", "    for x in nums[1:]:", "        cur = max(cur + x,     # extend the run that ends at i-1", "                  x)           # or restart at i", "        best = max(best, cur)", "    return best", ""],
    prod: ["def max_product(nums):", "    hi = lo = best = nums[0]   # largest / smallest product ending here", "    for x in nums[1:]:", "        cands = (x, hi * x, lo * x)    # restart, extend hi, extend lo", "        hi, lo = max(cands), min(cands)", "        best = max(best, hi)", "    return best", "# a negative x turns the smallest product into the largest"],
  };
  Viz.register("dp-linear-grid-kadane", (el, opts) => Viz.player(el, {
    title: "Kadane: the best run ending at each index",
    tag: "1D DP",
    legend: [["active", "cell being computed"], ["done", "winning option"], ["visit", "losing option"], ["path", "best subarray"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "problem", type: "select", value: opts && KAD.includes(opts.mode) ? opts.mode : KAD[0], options: KAD },
      { key: "nums", label: "nums (1 to 10 values, -20 to 20)", value: (opts && opts.nums) || "-2,1,-3,4,-1,2,1,-5,4", width: 210 },
    ],
    random: () => ({ nums: Array.from({ length: Viz.rand(2, 9) }, () => Viz.rand(-6, 6)).join(",") }),
    build: ({ mode, nums: ns }) => {
      const prod = mode === KAD[1];
      setCode(el, prod ? KAD_CODE.prod : KAD_CODE.sum);
      const a = nums(ns, { min: 1, max: 10, lo: prod ? -9 : -20, hi: prod ? 9 : 20, what: prod ? "For products, values" : "Values" });
      const n = a.length, fr = [];
      const rows = prod ? 4 : 3, M = Array.from({ length: rows }, (_, r) => (r === 0 ? a.slice() : Array(n).fill(null)));
      const st = Array.from({ length: rows }, () => Array(n).fill(0));
      const bestRow = rows - 1;
      let bestAt = 0;
      const snap = (cur, arrows, note, line, vars, span) => fr.push({ M: Viz.clone(M), cur, arrows, note, line, vars, span });
      for (let r = 1; r < rows - 1; r++) { M[r][0] = a[0]; st[r][0] = 0; }
      M[bestRow][0] = a[0];
      snap([1, 0], [], `Start: the only subarray ending at index 0 is [${a[0]}], so ${prod ? "hi = lo" : "cur"} = ${a[0]} and best = ${a[0]}.`, 1, prod ? { i: 0, hi: a[0], lo: a[0], best: a[0] } : { i: 0, cur: a[0], best: a[0] }, [0, 0]);
      for (let i = 1; i < n; i++) {
        const x = a[i];
        if (!prod) {
          const ext = M[1][i - 1] + x, win = ext >= x ? "ext" : "new";
          M[1][i] = Math.max(ext, x); st[1][i] = win === "ext" ? st[1][i - 1] : i;
          snap([1, i], [{ from: [1, i - 1], to: [1, i], cls: win === "ext" ? "done" : "visit", label: `+${x}`.replace("+-", "−") }, { from: [0, i], to: [1, i], cls: win === "new" ? "done" : "visit", label: "restart" }],
            `cur[${i}]: extend the best run ending at ${i - 1} (${M[1][i - 1]} + ${x} = ${ext}) or start fresh at ${i} (${x}). ${win === "ext" ? `<b>Extend</b>: ${ext}.` : `<b>Restart</b>: the old run is a liability (${M[1][i - 1]} &lt; 0).`}`, [3, 4], { i, x, extend: ext, cur: M[1][i] }, [st[1][i], i]);
        } else {
          const hiE = M[1][i - 1] * x, loE = M[2][i - 1] * x;
          const c = [[x, "x"], [hiE, "hi"], [loE, "lo"]];
          const mx = c.reduce((p, q) => (q[0] > p[0] ? q : p)), mn = c.reduce((p, q) => (q[0] < p[0] ? q : p));
          const srcStart = (w) => (w === "x" ? i : w === "hi" ? st[1][i - 1] : st[2][i - 1]);
          M[1][i] = mx[0]; st[1][i] = srcStart(mx[1]);
          const ar = (w, row) => [{ from: [1, i - 1], to: [row, i], cls: w === "hi" ? "done" : "visit", label: `×${x}` }, { from: [2, i - 1], to: [row, i], cls: w === "lo" ? "done" : "visit", label: `×${x}` }, { from: [0, i], to: [row, i], cls: w === "x" ? "done" : "visit", label: "" }];
          snap([1, i], ar(mx[1], 1), `hi[${i}] = max of restart ${x}, hi×x = ${M[1][i - 1]}×${x} = ${hiE}, lo×x = ${M[2][i - 1]}×${x} = ${loE} → <b>${mx[0]}</b>${mx[1] === "lo" && x < 0 ? ". A negative times the most negative product wins: that is why lo is tracked." : "."}`, [3, 4], { i, x, "hi·x": hiE, "lo·x": loE, hi: mx[0] }, [st[1][i], i]);
          M[2][i] = mn[0]; st[2][i] = srcStart(mn[1]);
          snap([2, i], ar(mn[1], 2), `lo[${i}] = min of the same three candidates = <b>${mn[0]}</b>. Keep it: a later negative number could flip it into the largest product.`, 4, { i, x, lo: mn[0] }, [st[2][i], i]);
        }
        const prev = M[bestRow][i - 1], c1 = M[1][i];
        M[bestRow][i] = Math.max(prev, c1); if (c1 > prev) bestAt = i;
        snap([bestRow, i], [{ from: [bestRow, i - 1], to: [bestRow, i], cls: c1 > prev ? "visit" : "done", label: "" }, { from: [1, i], to: [bestRow, i], cls: c1 > prev ? "done" : "visit", label: "" }],
          `best = max(best so far ${prev}, ${prod ? "hi" : "cur"}[${i}] = ${c1}) = <b>${M[bestRow][i]}</b>.`, 5, { i, best: M[bestRow][i] }, null);
      }
      const ans = M[bestRow][n - 1], s0 = st[1][bestAt], route = [s0, bestAt];
      snap(null, [], `Answer <b>${ans}</b> = ${prod ? "product" : "sum"} of nums[${s0}..${bestAt}] = [${a.slice(s0, bestAt + 1).join(", ")}]. The table only stored "best ending here"; the answer is the best of those because every subarray ends somewhere.`, 6, { answer: ans }, route);
      fr[fr.length - 1].ans = ans; fr[fr.length - 1].route = route;
      return fr.map((f) => ({ ...f, prod, n }));
    },
    render: (f) => {
      const labs = f.prod ? ["nums", "hi", "lo", "best"] : ["nums", "cur", "best"];
      const src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: f.prod ? "hi/lo = largest/smallest product of a subarray ending at i" : "cur = best sum of a subarray ending at i", size: 44, gap: 14, rowLabels: labs, rowLabelW: 48, colLabels: idxLabels(f.n), arrows: f.arrows,
        cls: (r, c) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (src.has(`${r},${c}`)) return `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls} dep`;
          if (r === 0) return f.span && c >= f.span[0] && c <= f.span[1] ? "path" : "";
          return f.M[r][c] !== null ? "done" : "";
        } });
      return `<div class="dlg-col">${g}</div>`;
    },
  }));

  /* ================= 5. LIS: O(n^2) table and patience sorting ================= */
  const LIS = ["O(n²): dp over previous smaller values", "O(n log n): patience sorting piles"];
  const LIS_CODE = {
    quad: ["def lis(nums):", "    dp = [1] * n            # dp[i] = longest increasing run ENDING at i", "    for i in range(n):", "        for j in range(i):", "            if nums[j] < nums[i] and dp[j] + 1 > dp[i]:", "                dp[i] = dp[j] + 1; parent[i] = j", "    return max(dp)", ""],
    pat: ["def lis(nums):", "    tails = []    # tails[k] = smallest top of pile k", "    for i, x in enumerate(nums):", "        k = bisect_left(tails, x)     # leftmost pile with top >= x", "        if k == len(tails): tails.append(x)   # new pile", "        else: tails[k] = x                    # cover that top", "        prev[i] = top index of pile k-1      # back pointer", "    return len(tails)"],
  };
  Viz.register("dp-linear-grid-lis", (el, opts) => Viz.player(el, {
    title: "Longest Increasing Subsequence two ways",
    tag: "LIS",
    legend: [["active", "current element"], ["done", "best predecessor / placed card"], ["visit", "other candidates / search range"], ["path", "one longest subsequence"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "method", type: "select", value: opts && LIS.includes(opts.mode) ? opts.mode : LIS[0], options: LIS },
      { key: "nums", label: "nums (1 to 10 values, 0 to 99)", value: (opts && opts.nums) || "10,9,2,5,3,7,99,18", width: 200 },
    ],
    random: () => ({ nums: Viz.randInts(Viz.rand(3, 10), 0, 20).join(",") }),
    build: ({ mode, nums: ns }) => {
      const pat = mode === LIS[1];
      setCode(el, pat ? LIS_CODE.pat : LIS_CODE.quad);
      const a = nums(ns, { min: 1, max: 10, lo: 0, hi: 99 });
      const n = a.length, fr = [];
      if (!pat) {
        const dp = Array(n).fill(null), par = Array(n).fill(-1);
        for (let i = 0; i < n; i++) {
          dp[i] = 1;
          const cands = [];
          for (let j = 0; j < i; j++) if (a[j] < a[i]) { cands.push(j); if (dp[j] + 1 > dp[i]) { dp[i] = dp[j] + 1; par[i] = j; } }
          const arrows = cands.map((j) => ({ from: [0, j], to: [0, i], arc: "up", cls: j === par[i] ? "done" : "visit", label: j === par[i] ? `+1` : undefined }));
          fr.push({ dp: dp.slice(), cur: i, arrows, cand: cands, pick: par[i], note: cands.length ? `dp[${i}] (nums[${i}] = ${a[i]}): it can extend any run ending at a smaller value: j = ${cands.join(", ")} (dp = ${cands.map((j) => dp[j]).join(", ")}). Best is j = ${par[i]}: dp[${i}] = ${dp[par[i]]} + 1 = <b>${dp[i]}</b>.` : `dp[${i}] = <b>1</b>: no earlier value is smaller than ${a[i]}, so the best run ending here is just [${a[i]}].`, line: cands.length ? [3, 4, 5] : 1, vars: { i, "nums[i]": a[i], "dp[i]": dp[i], parent: par[i] } });
        }
        const ans = Math.max(...dp); let k = dp.indexOf(ans); const seq = [];
        while (k >= 0) { seq.push(k); k = par[k]; }
        seq.reverse();
        const arrows = seq.slice(1).map((i, t) => ({ from: [0, seq[t]], to: [0, i], arc: "up", cls: "path" }));
        fr.push({ dp: dp.slice(), cur: null, arrows, seq, note: `LIS length = max(dp) = <b>${ans}</b> (it can end anywhere). Follow parents back from index ${seq[seq.length - 1]}: [${seq.map((i) => a[i]).join(", ")}]. O(n²) pairs checked.`, line: 6, vars: { answer: ans }, ans, route: seq });
        return fr.map((f) => ({ ...f, a, pat }));
      }
      const piles = [], tails = [], prev = Array(n).fill(-1), at = [];
      const snap = (o) => fr.push({ piles: Viz.clone(piles), tails: tails.slice(), ...o });
      for (let i = 0; i < n; i++) {
        const x = a[i];
        let lo = 0, hi = tails.length;
        const steps = [];
        while (lo < hi) { const mid = (lo + hi) >> 1; steps.push([lo, hi, mid, a[tails[mid]] >= x]); if (a[tails[mid]] >= x) hi = mid; else lo = mid + 1; }
        for (const [l, h, m, go] of steps) snap({ cur: i, range: [l, h], mid: m, note: `Card ${x}: binary search the pile tops for the leftmost top ≥ ${x}. Range [${l}, ${h}), mid = ${m}: top ${a[tails[m]]} ${go ? `≥ ${x}, so look left (hi = ${m})` : `&lt; ${x}, so look right (lo = ${m + 1})`}.`, line: 3, vars: { x, lo: l, hi: h, mid: m } });
        const k = lo;
        prev[i] = k > 0 ? tails[k - 1] : -1;
        if (k === tails.length) { tails.push(i); piles.push([i]); } else { tails[k] = i; piles[k].push(i); }
        at[i] = [piles[k].length - 1, k];
        snap({ cur: i, placed: i, prevOf: prev[i], note: `${k === tails.length - 1 && piles[k].length === 1 ? `Every top is smaller than ${x}: start <b>pile ${k + 1}</b>. One more pile = the LIS grows by one.` : `Put ${x} on <b>pile ${k + 1}</b> (covering ${a[piles[k][piles[k].length - 2]]}). A smaller top keeps that pile easier to extend later.`}${prev[i] >= 0 ? ` Back pointer → ${a[prev[i]]}, the top of pile ${k} right now.` : ""}`, line: k === tails.length - 1 && piles[k].length === 1 ? [4, 6] : [5, 6], vars: { x, pile: k + 1, piles: tails.length } });
      }
      const seq = []; let k = tails[tails.length - 1];
      while (k >= 0) { seq.push(k); k = prev[k]; }
      seq.reverse();
      const ans = tails.length;
      snap({ cur: null, seq, note: `<b>${ans}</b> piles = LIS length. Pile tops [${tails.map((t) => a[t]).join(", ")}] are NOT the subsequence in general; follow back pointers from the last pile's top instead: [${seq.map((t) => a[t]).join(", ")}].`, line: 7, vars: { answer: ans }, ans, route: seq });
      fr.forEach((f) => { f.at = at; });
      return fr.map((f) => ({ ...f, a, pat }));
    },
    render: (f) => {
      const n = f.a.length;
      if (!f.pat) {
        const inSeq = new Set(f.seq || []);
        const arr = Viz.array(f.a, { label: "nums", cls: (i) => (i === f.cur ? "active" : inSeq.has(i) ? "path" : i === f.pick && f.cur !== null ? "done" : f.cand && f.cand.includes(i) && f.cur !== null ? "visit" : "") });
        const g = dgrid([f.dp], { label: "dp[i] = length of the longest increasing subsequence ending at i", size: 42, arcUp: 64, colLabels: idxLabels(n), arrows: f.arrows,
          cls: (r, c) => (c === f.cur ? "active" : inSeq.has(c) ? "path" : f.arrows.some((x) => x.from[1] === c) ? `${f.arrows.find((x) => x.from[1] === c).cls} dep` : f.dp[c] !== null ? "done" : "") });
        return `<div class="dlg-col">${arr}${g}</div>`;
      }
      const inSeq = new Set(f.seq || []);
      const arr = Viz.array(f.a, { label: "nums (cards dealt left to right)", cls: (i) => (i === f.cur ? "active" : inSeq.has(i) ? "path" : f.at[i] && f.piles.some((p) => p.includes(i)) ? "dim" : "") });
      let body = "";
      if (f.piles.length) {
        const H = Math.max(...f.piles.map((p) => p.length));
        const M = Array.from({ length: H }, (_, r) => f.piles.map((p) => (r < p.length ? p[r] : undefined)));
        const arrows = [];
        if (f.placed !== undefined && f.prevOf >= 0) { const [r1, c1] = f.at[f.prevOf], [r2, c2] = f.at[f.placed]; arrows.push({ from: [r2, c2], to: [r1, c1], cls: "visit", label: "prev" }); }
        if (f.seq) for (let t = f.seq.length - 1; t > 0; t--) arrows.push({ from: f.at[f.seq[t]], to: f.at[f.seq[t - 1]], cls: "path" });
        const tops = new Set(f.tails);
        body = dgrid(M, { label: "piles (each new card covers the previous top; arrows = back pointers)", size: 42, gap: 26, colLabels: f.piles.map((_, k) => `pile ${k + 1}`), arrows, fmt: (v) => String(f.a[v]), sub: (r, c, v) => `i${v}`,
          cls: (r, c, v) => (v === f.placed ? "done" : inSeq.has(v) ? "path" : f.range && c >= f.range[0] && c < f.range[1] && tops.has(v) ? (c === f.mid ? "active" : "visit") : tops.has(v) ? "" : "dim") });
      } else body = `<div class="v-labeled"><span class="v-caption">piles</span><span class="muted">no piles yet</span></div>`;
      const tl = f.tails.length ? Viz.array(f.tails.map((t) => f.a[t]), { label: "tails = pile tops (always sorted, so binary search works)", cls: (k) => (f.range && k === f.mid ? "active" : f.range && k >= f.range[0] && k < f.range[1] ? "visit" : ""), idxLabel: (k) => `pile ${k + 1}` }) : "";
      return `<div class="dlg-col">${arr}${tl}${body}</div>`;
    },
  }));

  /* ================= 6. Stock trading as a state machine ================= */
  const STK = ["unlimited trades (122)", "cooldown after selling (309)", "fee per trade (714)", "at most 2 trades (123)"];
  const STK_DEF = {
    [STK[0]]: { states: ["hold", "cash"], init: (p) => [[-p, "buy"], [0, null]], ans: [1],
      tr: [[{ keep: 1 }, { from: 1, act: "buy", f: (v, p) => v - p, w: "buy −p" }], [{ keep: 1 }, { from: 0, act: "sell", f: (v, p) => v + p, w: "sell +p" }]],
      pos: [[170, 0], [0, 0]], subs: ["own 1 share", "own nothing"],
      code: ["def max_profit(prices):", "    hold, cash = -prices[0], 0      # own a share / own nothing", "    for p in prices[1:]:", "        hold, cash = (max(hold, cash - p),   # keep, or buy today", "                      max(cash, hold + p))   # keep, or sell today", "    return cash", "", ""] },
    [STK[1]]: { states: ["hold", "sold", "rest"], init: (p) => [[-p, "buy"], [-INF, null], [0, null]], ans: [1, 2],
      tr: [[{ keep: 1 }, { from: 2, act: "buy", f: (v, p) => v - p, w: "buy −p" }], [{ from: 0, act: "sell", f: (v, p) => v + p, w: "sell +p" }], [{ keep: 1 }, { from: 1, act: "cool", f: (v) => v, w: "cool down" }]],
      pos: [[260, 0], [130, 150], [0, 0]], subs: ["own 1 share", "sold today", "free to buy"],
      code: ["def max_profit(prices):", "    hold, sold, rest = -prices[0], float('-inf'), 0", "    for p in prices[1:]:", "        hold, sold, rest = (max(hold, rest - p),   # buy only from rest", "                            hold + p,              # sell today", "                            max(rest, sold))       # day after a sale", "    return max(sold, rest)", ""] },
    [STK[2]]: { states: ["hold", "cash"], init: (p) => [[-p, "buy"], [0, null]], ans: [1], fee: true,
      tr: [[{ keep: 1 }, { from: 1, act: "buy", f: (v, p) => v - p, w: "buy −p" }], [{ keep: 1 }, { from: 0, act: "sell", f: (v, p, fee) => v + p - fee, w: "sell +p −fee" }]],
      pos: [[170, 0], [0, 0]], subs: ["own 1 share", "own nothing"],
      code: ["def max_profit(prices, fee):", "    hold, cash = -prices[0], 0", "    for p in prices[1:]:", "        hold, cash = (max(hold, cash - p),", "                      max(cash, hold + p - fee))   # pay the fee once per sale", "    return cash", "", ""] },
    [STK[3]]: { states: ["buy1", "sell1", "buy2", "sell2"], init: (p) => [[-p, "buy"], [0, null], [-p, "buy"], [0, null]], ans: [1, 3],
      tr: [[{ keep: 1 }, { from: null, act: "buy", f: (v, p) => -p, w: "" }], [{ keep: 1 }, { from: 0, act: "sell", f: (v, p) => v + p, w: "sell +p" }], [{ keep: 1 }, { from: 1, act: "buy", f: (v, p) => v - p, w: "buy −p" }], [{ keep: 1 }, { from: 2, act: "sell", f: (v, p) => v + p, w: "sell +p" }]],
      pos: [[0, 0], [125, 0], [250, 0], [375, 0]], subs: ["after 1st buy", "after 1st sale", "after 2nd buy", "after 2nd sale"],
      code: ["def max_profit(prices):", "    b1, s1, b2, s2 = -prices[0], 0, -prices[0], 0", "    for p in prices[1:]:", "        b1, s1, b2, s2 = (max(b1, -p),        # 1st buy", "                          max(s1, b1 + p),    # 1st sale", "                          max(b2, s1 - p),    # 2nd buy uses 1st profit", "                          max(s2, b2 + p))    # 2nd sale", "    return max(s1, s2)"] },
  };
  Viz.register("dp-linear-grid-stock", (el, opts) => Viz.player(el, {
    title: "Stock trading: one DP row per state of the machine",
    tag: "STATE MACHINE DP",
    legend: [["active", "cell being computed"], ["done", "winning move"], ["visit", "losing move"], ["path", "trades of an optimal plan"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "rules", type: "select", value: opts && STK.includes(opts.mode) ? opts.mode : STK[0], options: STK },
      { key: "prices", label: "prices (2 to 10 days)", value: (opts && opts.prices) || "3,3,5,0,0,3,1,4", width: 180 },
      { key: "fee", label: "fee (714 only)", value: "2", width: 50 },
    ],
    random: () => ({ prices: Viz.randInts(Viz.rand(3, 9), 0, 9).join(","), fee: String(Viz.rand(0, 3)) }),
    build: ({ mode, prices: ps, fee: fs }) => {
      const D = STK_DEF[mode] || STK_DEF[STK[0]];
      setCode(el, D.code);
      const p = nums(ps, { min: 2, max: 10, lo: 0, hi: 99, what: "Prices" });
      const fee = D.fee ? Viz.parse.int(fs, { min: 0, max: 50 }) : 0;
      const n = p.length, S = D.states.length, M = Array.from({ length: S }, () => Array(n).fill(null)), src = Array.from({ length: S }, () => Array(n).fill(null));
      const fr = [], snap = (o) => fr.push({ M: Viz.clone(M), ...o });
      D.init(p[0]).forEach(([v, act], r) => { M[r][0] = v; src[r][0] = { init: act }; });
      snap({ cur: null, day: 0, arrows: [], edges: {}, note: `Day 0 (price ${p[0]}): ${D.states.map((s, r) => `${s} = ${fmtN(M[r][0])}`).join(", ")}. Each row is the best <b>cash balance</b> if you end the day in that state; buying spends money, so holding starts at −${p[0]}.${mode === STK[1] ? " You cannot have sold on day 0, so sold = −∞." : ""}`, line: 1, vars: { day: 0, price: p[0] } });
      for (let i = 1; i < n; i++) {
        for (let r = 0; r < S; r++) {
          let best = -INF, pick = null; const arrows = [], edges = {}, parts = [];
          D.tr[r].forEach((t) => {
            const v = t.keep ? M[r][i - 1] : t.f(t.from === null ? 0 : M[t.from][i - 1], p[i], fee);
            if (v > best || (v === best && pick && !pick.keep && t.keep)) { best = v; pick = t; }
            parts.push(t.keep ? `stay: ${fmtN(M[r][i - 1])}` : t.from === null ? `buy first share: −${p[i]}` : `${t.act === "cool" ? "cool down" : t.act} from ${D.states[t.from]}: ${fmtN(M[t.from][i - 1])} ${t.act === "sell" ? `+ ${p[i]}${fee ? ` − ${fee}` : ""}` : t.act === "buy" ? `− ${p[i]}` : ""} = ${fmtN(v)}`);
          });
          M[r][i] = best; src[r][i] = pick;
          D.tr[r].forEach((t) => {
            const win = t === pick ? "done" : "visit";
            if (t.keep) arrows.push({ from: [r, i - 1], to: [r, i], cls: win, label: "stay" });
            else if (t.from !== null) { arrows.push({ from: [t.from, i - 1], to: [r, i], cls: win, label: t.act === "sell" ? `+${p[i]}` : t.act === "buy" ? `−${p[i]}` : "" }); edges[`${D.states[t.from]}-${D.states[r]}`] = win; }
          });
          snap({ cur: [r, i], day: i, arrows, edges, node: D.states[r], note: `Day ${i} (price ${p[i]}), state <b>${D.states[r]}</b>: ${parts.join("; ")}. Best: <b>${fmtN(best)}</b>${pick.keep ? " (stay)" : ` (${pick.act === "cool" ? "cool down" : pick.act})`}.`, line: 3 + Math.min(r, D.code.filter(Boolean).length - 5), vars: { day: i, price: p[i], [D.states[r]]: fmtN(best) } });
        }
      }
      let fin = D.ans[0]; for (const r of D.ans) if (M[r][n - 1] > M[fin][n - 1]) fin = r;
      const ans = Math.max(0, M[fin][n - 1]);
      /* walk the choices back to recover the trades */
      const acts = [], arrows = []; let r = fin, i = n - 1;
      while (i >= 0) {
        const t = src[r][i];
        if (t.init !== undefined) { if (t.init === "buy") acts.push(["buy", 0]); break; }
        if (t.keep) { arrows.push({ from: [r, i - 1], to: [r, i], cls: "path" }); i--; continue; }
        if (t.act === "buy" || t.act === "sell") acts.push([t.act, i]);
        if (t.from === null) break;
        arrows.push({ from: [t.from, i - 1], to: [r, i], cls: "path" });
        r = t.from; i--;
      }
      acts.reverse();
      const trades = []; for (let k = 0; k + 1 < acts.length; k += 2) trades.push([acts[k][1], acts[k + 1][1]]);
      const desc = trades.length ? trades.map(([b, s]) => `buy day ${b} @${p[b]} → sell day ${s} @${p[s]}`).join("; ") : "no trade (prices never rise enough)";
      snap({ cur: null, day: null, arrows, edges: {}, trades, fin, note: `Answer = ${D.ans.length > 1 ? `max(${D.ans.map((q) => D.states[q]).join(", ")})` : D.states[fin]} on the last day = <b>${ans}</b>. Walking the winning arrows back: ${desc}.`, line: D.code.filter(Boolean).length - 1, vars: { answer: ans, trades: trades.length } });
      fr[fr.length - 1].ans = ans; fr[fr.length - 1].route = trades; fr[fr.length - 1].fee = fee;
      return fr.map((f) => ({ ...f, p, D, n }));
    },
    render: (f) => {
      const D = f.D, buys = new Set((f.trades || []).map((t) => t[0])), sells = new Set((f.trades || []).map((t) => t[1]));
      const price = Viz.array(f.p, { label: "prices by day", cls: (i) => (i === f.day ? "active" : buys.has(i) || sells.has(i) ? "path" : ""), idxLabel: (i) => (buys.has(i) ? `${i} buy` : sells.has(i) ? `${i} sell` : `${i}`) });
      const nodes = D.states.map((s, r) => ({ id: s, x: D.pos[r][0], y: D.pos[r][1], label: s, sub: D.subs[r] }));
      const edges = [];
      D.tr.forEach((ts, r) => ts.forEach((t) => { if (!t.keep && t.from !== null) edges.push({ u: D.states[t.from], v: D.states[r], w: t.w, cls: f.edges[`${D.states[t.from]}-${D.states[r]}`] || "" }); }));
      const machine = Viz.graph({ nodes, edges }, { directed: true, r: 27, label: "the machine (every state may also stay put overnight)", nodeCls: (id) => (id === f.node ? "active" : f.fin !== undefined && id === D.states[f.fin] ? "path" : "") });
      const src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: "best cash balance when ending day i in each state", size: 46, gap: 22, rowLabels: D.states, rowLabelW: 52, colLabels: f.p.map((_, i) => `d${i}`), arrows: f.arrows,
        cls: (r, c) => (f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : src.has(`${r},${c}`) ? `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls}${f.day === null ? "" : " dep"}` : f.M[r][c] === null ? "" : f.M[r][c] === -INF ? "dim" : "done") });
      return `<div class="dlg-col">${price}${machine}${g}</div>`;
    },
  }));

  /* ================= 7. Grid paths: count paths / min path sum ================= */
  const GP = ["count paths around rocks (62/63)", "min path sum (64)"];
  const GP_CODE = {
    count: ["def unique_paths(grid):          # 'x' = rock", "    dp = [[0] * C for _ in range(R)]", "    for r in range(R):", "        for c in range(C):", "            if grid[r][c] == 'x': dp[r][c] = 0; continue", "            if r == c == 0: dp[r][c] = 1; continue", "            dp[r][c] = (dp[r-1][c] if r else 0) + (dp[r][c-1] if c else 0)", "    return dp[R-1][C-1]"],
    min: ["def min_path_sum(grid):", "    dp = [[INF] * C for _ in range(R)]", "    for r in range(R):", "        for c in range(C):", "            if grid[r][c] == 'x': continue      # rock: stays INF", "            if r == c == 0: dp[0][0] = grid[0][0]; continue", "            dp[r][c] = grid[r][c] + min(dp[r-1][c] if r else INF, dp[r][c-1] if c else INF)", "    return dp[R-1][C-1]"],
  };
  const parseRockGrid = (s) => {
    const g = Viz.parse.matrix(String(s).toLowerCase());
    if (!g.length || g.length > 6) throw new Error('Use 1 to 6 rows separated by ";".');
    if (g.some((r) => r.length !== g[0].length) || g[0].length > 7) throw new Error("Every row needs the same number of cells (at most 7).");
    if (g.flat().some((v) => !(v === "x" || (Number.isInteger(v) && v >= 0 && v <= 9)))) throw new Error('Cells are costs 0 to 9, or "x" for a rock.');
    return g;
  };
  Viz.register("dp-linear-grid-paths", (el, opts) => Viz.player(el, {
    title: "Grid paths: every cell reads the cell above and the cell to the left",
    tag: "2D GRID DP",
    legend: [["active", "cell being computed"], ["done", "used / winning neighbour"], ["visit", "losing neighbour"], ["wall", "rock"], ["path", "answer path"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "question", type: "select", value: opts && GP.includes(opts.mode) ? opts.mode : GP[0], options: GP },
      { key: "grid", label: 'grid (costs 0 to 9, "x" = rock, rows split by ";")', value: (opts && opts.grid) || "1,3,1,2; 1,x,1,4; 4,2,1,x; 2,1,5,1", width: 280 },
    ],
    random: () => { const C = Viz.rand(2, 5); return { grid: Array.from({ length: Viz.rand(2, 5) }, () => Array.from({ length: C }, () => (Math.random() < 0.15 ? "x" : Viz.rand(0, 9))).join(",")).join("; ") }; },
    build: ({ mode, grid }) => {
      const cnt = mode !== GP[1];
      setCode(el, cnt ? GP_CODE.count : GP_CODE.min);
      const g = parseRockGrid(grid), R = g.length, C = g[0].length;
      const M = Array.from({ length: R }, () => Array(C).fill(null)), fr = [];
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        const rock = g[r][c] === "x";
        if (rock) { M[r][c] = cnt ? 0 : INF; fr.push({ M: Viz.clone(M), cur: [r, c], arrows: [], note: `(${r},${c}) is a rock: ${cnt ? "no path may pass through it, so 0 paths" : "unreachable, cost ∞"}.`, line: 4, vars: { r, c, "dp[r][c]": fmtN(M[r][c]) } }); continue; }
        if (r === 0 && c === 0) { M[0][0] = cnt ? 1 : g[0][0]; fr.push({ M: Viz.clone(M), cur: [0, 0], arrows: [], note: cnt ? "Base case: exactly 1 way to stand on the start." : `Base case: reaching the start costs its own value, ${g[0][0]}.`, line: 5, vars: { r, c, "dp[r][c]": M[0][0] } }); continue; }
        const up = r ? M[r - 1][c] : null, left = c ? M[r][c - 1] : null, arrows = [];
        if (cnt) {
          M[r][c] = (up || 0) + (left || 0);
          if (up !== null) arrows.push({ from: [r - 1, c], to: [r, c], cls: up ? "done" : "visit", label: `${up}` });
          if (left !== null) arrows.push({ from: [r, c - 1], to: [r, c], cls: left ? "done" : "visit", label: `${left}` });
          fr.push({ M: Viz.clone(M), cur: [r, c], arrows, note: `Every path into (${r},${c}) arrives from above or from the left, and those two groups never overlap, so <b>add</b>: ${up !== null ? `${up} from above` : "nothing above"} + ${left !== null ? `${left} from the left` : "nothing on the left"} = <b>${M[r][c]}</b>.`, line: 6, vars: { r, c, up: up ?? "—", left: left ?? "—", "dp[r][c]": M[r][c] } });
        } else {
          const u = up ?? INF, l = left ?? INF, m = Math.min(u, l);
          M[r][c] = m === INF ? INF : g[r][c] + m;
          const win = u <= l ? "up" : "left";
          if (up !== null) arrows.push({ from: [r - 1, c], to: [r, c], cls: m < INF && win === "up" ? "done" : "visit", label: fmtN(up) });
          if (left !== null) arrows.push({ from: [r, c - 1], to: [r, c], cls: m < INF && win === "left" ? "done" : "visit", label: fmtN(left) });
          fr.push({ M: Viz.clone(M), cur: [r, c], arrows, note: m === INF ? `(${r},${c}): both neighbours are unreachable, so this cell is ∞ too.` : `(${r},${c}) costs ${g[r][c]}. Cheapest way in: min(${fmtN(u)} from above, ${fmtN(l)} from the left) = ${m}. dp = ${g[r][c]} + ${m} = <b>${M[r][c]}</b>.`, line: 6, vars: { r, c, up: fmtN(u), left: fmtN(l), "dp[r][c]": fmtN(M[r][c]) } });
        }
      }
      const ans = M[R - 1][C - 1], path = [], arrows = [];
      let onPath = new Set();
      if (cnt) {
        /* cells on at least one start-to-end path: reachable from start AND able to reach the end */
        const back = Array.from({ length: R }, () => Array(C).fill(false));
        for (let r = R - 1; r >= 0; r--) for (let c = C - 1; c >= 0; c--) back[r][c] = g[r][c] !== "x" && ((r === R - 1 && c === C - 1) || (r + 1 < R && back[r + 1][c]) || (c + 1 < C && back[r][c + 1]));
        for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) if (M[r][c] > 0 && back[r][c]) onPath.add(`${r},${c}`);
      } else if (ans < INF) {
        let r = R - 1, c = C - 1; path.push([r, c]);
        while (r || c) { const u = r ? M[r - 1][c] : INF, l = c ? M[r][c - 1] : INF; const [nr, nc] = u <= l ? [r - 1, c] : [r, c - 1]; arrows.push({ from: [nr, nc], to: [r, c], cls: "path" }); r = nr; c = nc; path.push([r, c]); }
        path.reverse(); onPath = new Set(path.map(([a, b]) => `${a},${b}`));
      }
      fr.push({ M: Viz.clone(M), cur: null, arrows, onPath: [...onPath], note: cnt ? `<b>${ans}</b> path${ans === 1 ? "" : "s"} from top-left to bottom-right. Highlighted: every cell that lies on at least one of them.` : ans === INF ? "The end is unreachable: answer ∞ (LeetCode 64 has no rocks, so this cannot happen there)." : `Minimum cost <b>${ans}</b>. Walk back from the end, always stepping to the cheaper of up/left, to recover the route: ${path.map(([a, b]) => g[a][b]).join(" + ")} = ${ans}.`, line: 7, vars: { answer: fmtN(ans) }, ans, route: path });
      return fr.map((f) => ({ ...f, g, cnt }));
    },
    render: (f) => {
      const on = new Set(f.onPath || []), src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: f.cnt ? "dp[r][c] = number of paths from the start to (r,c)" : "dp[r][c] = cheapest cost from the start to (r,c) (small number = the cell's own cost)", size: 50, gap: 22, rowLabels: f.g.map((_, r) => `r${r}`), rowLabelW: 30, colLabels: f.g[0].map((_, c) => `c${c}`), arrows: f.arrows,
        sub: (r, c) => (f.cnt || f.g[r][c] === "x" ? "" : f.g[r][c]),
        fmt: (v, r, c) => (f.g[r][c] === "x" ? "x" : fmtN(v)),
        cls: (r, c) => {
          if (f.g[r][c] === "x") return "wall";
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (on.has(`${r},${c}`)) return "path";
          if (src.has(`${r},${c}`)) return `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls} dep`;
          return f.M[r][c] === null ? "" : "done";
        } });
      return `<div class="dlg-col">${g}</div>`;
    },
  }));

  /* ================= 8. Maximal Square ================= */
  const SQ_CODE = ["def maximal_square(m):", "    dp = [[0] * C for _ in range(R)]   # side of the largest all-1 square", "    for r in range(R):                  # whose bottom-right corner is (r, c)", "        for c in range(C):", "            if m[r][c] == 1:", "                dp[r][c] = 1 + min(dp[r-1][c], dp[r][c-1], dp[r-1][c-1])  # 0 off-grid", "                best = max(best, dp[r][c])", "    return best * best"];
  Viz.register("dp-linear-grid-square", (el) => Viz.player(el, {
    title: "Maximal Square: a square is limited by its weakest neighbour",
    tag: "2D GRID DP",
    legend: [["active", "cell being computed"], ["done", "the limiting (smallest) neighbour"], ["visit", "other neighbours"], ["accent", "square ending here"], ["path", "largest square"], ["dim", "a 0 in the matrix"]],
    codeLang: "python",
    code: SQ_CODE,
    inputs: [{ key: "grid", label: 'matrix of 0/1 (rows split by ";")', value: "1,0,1,0,0; 1,0,1,1,1; 1,1,1,1,1; 1,0,1,1,1", width: 250 }],
    random: () => ({ grid: Array.from({ length: Viz.rand(3, 5) }, () => Array.from({ length: 5 }, () => (Math.random() < 0.72 ? 1 : 0)).join(",")).join("; ") }),
    build: ({ grid }) => {
      const m = parseGrid(grid, { maxR: 6, maxC: 7, min: 0, max: 1 }), R = m.length, C = m[0].length;
      const M = Array.from({ length: R }, () => Array(C).fill(null)), fr = [];
      let best = 0, bestAt = null;
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (!m[r][c]) { M[r][c] = 0; fr.push({ M: Viz.clone(M), cur: [r, c], arrows: [], note: `(${r},${c}) holds 0: no square can end here. dp = 0.`, line: 4, vars: { r, c, "dp[r][c]": 0, best } }); continue; }
        const nb = [[r - 1, c, "up"], [r, c - 1, "left"], [r - 1, c - 1, "diag"]].map(([a, b, nm]) => [a, b, nm, a >= 0 && b >= 0 ? M[a][b] : 0]);
        const mn = Math.min(...nb.map((x) => x[3]));
        M[r][c] = 1 + mn;
        const winIdx = nb.findIndex((x) => x[3] === mn);
        const arrows = nb.filter((x) => x[0] >= 0 && x[1] >= 0).map((x) => ({ from: [x[0], x[1]], to: [r, c], cls: nb.indexOf(x) === winIdx ? "done" : "visit", label: String(x[3]) }));
        if (M[r][c] > best) { best = M[r][c]; bestAt = [r, c]; }
        fr.push({ M: Viz.clone(M), cur: [r, c], arrows, sq: [r, c, M[r][c]], note: `(${r},${c}) = 1. Neighbours: up ${nb[0][3]}, left ${nb[1][3]}, diagonal ${nb[2][3]}${r === 0 || c === 0 ? " (off-grid counts as 0)" : ""}. A k×k square here needs a (k−1) square ending at all three, so dp = 1 + min = <b>${M[r][c]}</b>.`, line: [5, 6], vars: { r, c, up: nb[0][3], left: nb[1][3], diag: nb[2][3], "dp[r][c]": M[r][c], best } });
      }
      const ans = best * best;
      fr.push({ M: Viz.clone(M), cur: null, arrows: [], best: bestAt ? [bestAt[0], bestAt[1], best] : null, note: best ? `Largest side = <b>${best}</b>, ending at (${bestAt[0]},${bestAt[1]}). Area = ${best}² = <b>${ans}</b>.` : "No 1 anywhere: area <b>0</b>.", line: 7, vars: { side: best, area: ans }, ans, route: bestAt ? [bestAt[0], bestAt[1], best] : null });
      return fr.map((f) => ({ ...f, m }));
    },
    render: (f) => {
      const inSq = (s, r, c) => s && r <= s[0] && c <= s[1] && r > s[0] - s[2] && c > s[1] - s[2];
      const src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: "dp[r][c] = side of the largest all-1 square whose bottom-right corner is (r,c)", size: 48, gap: 22, colLabels: f.m[0].map((_, c) => `c${c}`), rowLabels: f.m.map((_, r) => `r${r}`), rowLabelW: 30, arrows: f.arrows,
        fmt: (v, r, c) => (v === null ? String(f.m[r][c]) : String(v)),
        cls: (r, c) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (src.has(`${r},${c}`)) return `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls} dep`;
          if (inSq(f.best, r, c)) return "path";
          if (inSq(f.sq, r, c)) return "accent";
          if (!f.m[r][c]) return "dim";
          return f.M[r][c] === null ? "" : "done";
        } });
      return `<div class="dlg-col">${g}</div>`;
    },
  }));

  /* ================= 9. Dungeon Game: fill backwards ================= */
  const DG_CODE = ["def calculate_minimum_hp(d):", "    need = [[INF] * (C + 1) for _ in range(R + 1)]   # min HP when ENTERING (r,c)", "    need[R][C-1] = need[R-1][C] = 1                # after the princess: 1 HP is enough", "    for r in range(R - 1, -1, -1):", "        for c in range(C - 1, -1, -1):", "            nxt = min(need[r+1][c], need[r][c+1])     # the easier way onward", "            need[r][c] = max(1, nxt - d[r][c])         # never below 1 HP", "    return need[0][0]"];
  Viz.register("dp-linear-grid-dungeon", (el) => Viz.player(el, {
    title: "Dungeon Game: answer the question from the princess backwards",
    tag: "BACKWARD GRID DP",
    legend: [["active", "cell being computed"], ["done", "easier way onward"], ["visit", "harder way onward"], ["dim", "outside the dungeon"], ["path", "the knight's route"]],
    codeLang: "python",
    code: DG_CODE,
    inputs: [{ key: "grid", label: 'dungeon (-50 to 50, rows split by ";")', value: "-2,-3,3; -5,-10,1; 10,30,-5", width: 250 }],
    random: () => { const C = Viz.rand(2, 4); return { grid: Array.from({ length: Viz.rand(2, 4) }, () => Viz.randInts(C, -12, 8).join(",")).join("; ") }; },
    build: ({ grid }) => {
      const d = parseGrid(grid, { maxR: 5, maxC: 5, min: -50, max: 50 }), R = d.length, C = d[0].length;
      const M = Array.from({ length: R + 1 }, () => Array(C + 1).fill(null)), fr = [];
      for (let r = 0; r <= R; r++) M[r][C] = INF; for (let c = 0; c <= C; c++) M[R][c] = INF;
      M[R][C - 1] = 1; M[R - 1][C] = 1;
      fr.push({ M: Viz.clone(M), cur: null, arrows: [], note: "need[r][c] = the minimum health the knight must have when he <b>steps into</b> (r,c) to survive the rest of the trip. Sentinel cells outside the grid are ∞ (never go there), except the two touching the princess, which are 1: once she is reached, any living knight is fine.", line: [1, 2], vars: {} });
      for (let r = R - 1; r >= 0; r--) for (let c = C - 1; c >= 0; c--) {
        const dn = M[r + 1][c], rt = M[r][c + 1], nxt = Math.min(dn, rt), v = Math.max(1, nxt - d[r][c]);
        M[r][c] = v;
        const winD = dn <= rt;
        fr.push({ M: Viz.clone(M), cur: [r, c], arrows: [{ from: [r + 1, c], to: [r, c], cls: winD ? "done" : "visit", label: fmtN(dn) }, { from: [r, c + 1], to: [r, c], cls: winD ? "visit" : "done", label: fmtN(rt) }],
          note: `(${r},${c}) holds ${d[r][c]}. Leaving it, the knight needs min(down ${fmtN(dn)}, right ${fmtN(rt)}) = ${nxt}. Entering, he needs ${nxt} − (${d[r][c]}) = ${nxt - d[r][c]}${nxt - d[r][c] < 1 ? `, but health can never be below 1, so <b>1</b>` : `, so <b>${v}</b>`}.${d[r][c] > 0 && nxt - d[r][c] < 1 ? " A big potion here cannot be 'banked' for earlier rooms, which is exactly why a forward DP fails." : ""}`, line: [5, 6], vars: { r, c, "d[r][c]": d[r][c], down: fmtN(dn), right: fmtN(rt), need: v } });
      }
      const route = [[0, 0]], hp = [M[0][0] + d[0][0]]; let r = 0, c = 0;
      const arrows = [];
      while (r !== R - 1 || c !== C - 1) { const [nr, nc] = M[r + 1][c] <= M[r][c + 1] ? [r + 1, c] : [r, c + 1]; arrows.push({ from: [r, c], to: [nr, nc], cls: "path" }); r = nr; c = nc; route.push([r, c]); hp.push(hp[hp.length - 1] + d[r][c]); }
      const ans = M[0][0];
      fr.push({ M: Viz.clone(M), cur: null, arrows, route, hp, note: `Start with <b>${ans}</b> HP. Following the easier neighbour each time, health after each room: ${hp.join(" → ")} (never below 1). One HP less and some room on every route would kill him.`, line: 7, vars: { answer: ans }, ans });
      return fr.map((f) => ({ ...f, d, R, C }));
    },
    render: (f) => {
      const on = new Map((f.route || []).map(([a, b], k) => [`${a},${b}`, k]));
      const src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: "need[r][c] = min HP when entering (r,c); small number = the room's effect", size: 52, gap: 22, colLabels: [...f.d[0].map((_, c) => `c${c}`), "out"], rowLabels: [...f.d.map((_, r) => `r${r}`), "out"], rowLabelW: 34, arrows: f.arrows,
        sub: (r, c) => (r < f.R && c < f.C ? (f.d[r][c] > 0 ? `+${f.d[r][c]}` : String(f.d[r][c])) : ""),
        tag: (r, c) => (on.has(`${r},${c}`) ? `hp ${f.hp[on.get(`${r},${c}`)]}` : ""),
        cls: (r, c) => {
          if (r === f.R && c === f.C) return "dim";
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (on.has(`${r},${c}`)) return "path";
          if (src.has(`${r},${c}`)) return `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls} dep`;
          if (r === f.R || c === f.C) return "dim";
          return f.M[r][c] === null ? "" : "done";
        },
        fmt: (v, r, c) => (r === f.R && c === f.C ? "" : fmtN(v)) });
      return `<div class="dlg-col">${g}</div>`;
    },
  }));

  /* ================= 10. Jump Game I and II ================= */
  const JMP = ["can reach the end? (55)", "fewest jumps (45)"];
  const JMP_CODE = {
    can: ["def can_jump(nums):", "    last_good = n - 1                # leftmost index known to reach the end", "    for i in range(n - 2, -1, -1):", "        if i + nums[i] >= last_good:  # i can land on a good index", "            last_good = i", "    return last_good == 0", "# full DP: good[i] = any(good[j] for j in i+1 .. i+nums[i])", ""],
    min: ["def jump(nums):", "    jumps, end, far = 0, 0, 0    # BFS over indices, one layer per jump", "    for i in range(n - 1):", "        far = max(far, i + nums[i])  # best reach from the current layer", "        if i == end:                 # current layer finished", "            jumps += 1; end = far    # next layer = (end, far]", "    return jumps", "# dp[i] = fewest jumps to reach i = the layer number of i"],
  };
  Viz.register("dp-linear-grid-jump", (el, opts) => Viz.player(el, {
    title: "Jump Game: a DP that collapses into a greedy sweep",
    tag: "DP → GREEDY",
    legend: [["active", "index being decided"], ["visit", "cells it can land on"], ["done", "good index / best jumper"], ["bad", "cannot reach the end"], ["path", "a fewest-jumps route"]],
    codeLang: "python",
    code: Array(8).fill(""),
    inputs: [
      { key: "mode", label: "question", type: "select", value: opts && JMP.includes(opts.mode) ? opts.mode : JMP[0], options: JMP },
      { key: "nums", label: "nums (2 to 12 values, 0 to 6)", value: (opts && opts.nums) || "2,3,1,1,0,4", width: 190 },
    ],
    random: () => ({ nums: Array.from({ length: Viz.rand(3, 10) }, () => (Math.random() < 0.25 ? 0 : Viz.rand(1, 3))).join(",") }),
    build: ({ mode, nums: ns }) => {
      const can = mode !== JMP[1];
      setCode(el, can ? JMP_CODE.can : JMP_CODE.min);
      const a = nums(ns, { min: 2, max: 12, lo: 0, hi: 6 }), n = a.length, fr = [];
      if (can) {
        const good = Array(n).fill(null); good[n - 1] = true; let last = n - 1;
        fr.push({ M: [good.slice()], cur: n - 1, arrows: [], range: null, note: "good[i] = 'from i you can reach the end'. The last index is good by definition. Fill right to left, because good[i] depends on cells to its right.", line: 1, vars: { last_good: last } });
        for (let i = n - 2; i >= 0; i--) {
          const reach = i + a[i], ok = reach >= last; good[i] = ok;
          fr.push({ M: [good.slice()], cur: i, arrows: [{ from: [0, last], to: [0, i], arc: "up", cls: ok ? "done" : "bad", label: ok ? "reads" : "too far" }], range: [i + 1, Math.min(n - 1, reach)],
            note: `From ${i} you can land on ${a[i] ? `${i + 1}…${Math.min(n - 1, reach)}` : "nothing (nums = 0)"}. The full DP asks "is any of those good?". It is enough to check the <b>leftmost</b> good index, ${last}: every good index further right is reachable only if ${last} is. ${reach} ${ok ? "≥" : "&lt;"} ${last}, so good[${i}] = <b>${ok ? "True" : "False"}</b>.`, line: ok ? [3, 4] : 3, vars: { i, "i+nums[i]": reach, last_good: last } });
          if (ok) last = i;
        }
        const ans = good[0];
        fr.push({ M: [good.slice()], cur: null, arrows: [], range: null, note: `good[0] = <b>${ans ? "True" : "False"}</b>. The DP table shrank to one number (last_good), the classic DP-to-greedy collapse.`, line: 5, vars: { answer: ans ? "True" : "False" }, ans });
        return fr.map((f) => ({ ...f, a, can }));
      }
      const layer = Array(n).fill(null); layer[0] = 0;
      let l = 0, r = 0, k = 0, ans = -1;
      const from = Array(n).fill(-1);
      fr.push({ M: [layer.slice()], cur: null, arrows: [], range: [0, 0], note: "dp[i] = fewest jumps to reach i. Index 0 costs 0 jumps: that is layer 0 of a breadth-first search over indices.", line: 1, vars: { jumps: 0, end: 0, far: 0 } });
      while (r < n - 1) {
        let far = r, who = -1;
        for (let i = l; i <= r; i++) if (i + a[i] > far) { far = i + a[i]; who = i; }
        far = Math.min(far, n - 1);
        const arrows = [];
        for (let i = l; i <= r; i++) if (a[i]) arrows.push({ from: [0, i], to: [0, Math.min(n - 1, i + a[i])], arc: "up", cls: i === who ? "done" : "visit", label: i === who ? `far ${far}` : undefined });
        if (who < 0) { fr.push({ M: [layer.slice()], cur: null, arrows, range: [l, r], stuck: true, note: `Layer ${k} is [${l}, ${r}] and nobody in it can jump past ${r}. The end is unreachable: answer <b>−1</b> (LeetCode 45 promises this never happens).`, line: 3, vars: { jumps: k, end: r, far: r } }); break; }
        for (let i = r + 1; i <= far; i++) { layer[i] = k + 1; from[i] = who; }
        fr.push({ M: [layer.slice()], cur: null, arrows, range: [l, r], next: [r + 1, far], note: `Layer ${k} = indices ${l}…${r}. Scan them for the farthest landing spot: index ${who} reaches ${far}. So every index in ${r + 1}…${far} needs exactly <b>${k + 1}</b> jump${k ? "s" : ""}, and nothing closer than that is possible.`, line: [3, 4, 5], vars: { jumps: k + 1, end: far, far } });
        l = r + 1; r = far; k++;
      }
      if (r >= n - 1) {
        ans = layer[n - 1];
        const route = [n - 1]; while (route[0] !== 0) { const t = route[0]; route.unshift(from[t] >= 0 ? from[t] : 0); }
        const arrows = route.slice(1).map((t, q) => ({ from: [0, route[q]], to: [0, t], arc: "up", cls: "path" }));
        fr.push({ M: [layer.slice()], cur: null, arrows, range: null, route, note: `The last index sits in layer <b>${ans}</b>, so ${ans} jumps. One route: ${route.join(" → ")}. Each layer was scanned once: O(n) instead of the O(n²) "try every jump" DP.`, line: 6, vars: { answer: ans }, ans });
      } else fr[fr.length - 1].ans = -1;
      return fr.map((f) => ({ ...f, a, can }));
    },
    render: (f) => {
      const n = f.a.length, inR = (x, rg) => rg && x >= rg[0] && x <= rg[1], rt = new Set(f.route || []);
      const arr = Viz.array(f.a, { label: "nums (max jump length)", cls: (i) => (i === f.cur ? "active" : rt.has(i) ? "path" : f.can && inR(i, f.range) ? "visit" : !f.can && inR(i, f.range) ? "active" : !f.can && inR(i, f.next) ? "visit" : "") });
      const src = new Set(f.arrows.map((x) => x.from[1]));
      const g = dgrid(f.M, { label: f.can ? "good[i]: can index i reach the end?" : "dp[i] = fewest jumps to reach i (filled one BFS layer at a time)", size: 42, arcUp: 64, colLabels: idxLabels(n, ""), arrows: f.arrows,
        cls: (r, c) => {
          const v = f.M[0][c];
          if (c === f.cur) return "active";
          if (rt.has(c)) return "path";
          if (f.can && src.has(c)) return `${f.arrows[0].cls} dep`;
          if (f.can) return v === true ? "done" : v === false ? "bad" : inR(c, f.range) ? "visit" : "";
          if (inR(c, f.next)) return "visit";
          if (inR(c, f.range)) return "active";
          return v === null ? "" : "done";
        } });
      return `<div class="dlg-col">${arr}${g}</div>`;
    },
  }));

  /* ================= 11. Cherry Pickup: two walkers at once ================= */
  const CH_CODE = ["def cherry_pickup(g):    # go there and back = two walkers going there", "    dp[0][0][0] = g[0][0]   # dp[t][r1][r2]: both walkers have taken t steps", "    for t in range(1, 2*n - 1):", "        for r1, r2 in rows valid at step t:     # c = t - r", "            if a rock is under either walker: dp = -INF; continue", "            gain = g[r1][c1] + (g[r2][c2] if r1 != r2 else 0)  # share a cell once", "            dp[t][r1][r2] = gain + max(dp[t-1][r1-a][r2-b] for a, b in 0/1)", "    return max(0, dp[2n-2][n-1][n-1])"];
  Viz.register("dp-linear-grid-cherry", (el) => Viz.player(el, {
    title: "Cherry Pickup: one state for two walkers moving together",
    tag: "MULTI-AGENT DP",
    legend: [["active", "walker A / cell being shown"], ["accent", "walker B"], ["done", "best predecessor state"], ["visit", "other predecessors"], ["path", "walker A's route"], ["wall", "thorn (-1)"]],
    codeLang: "python",
    code: CH_CODE,
    inputs: [{ key: "grid", label: 'n×n grid: 1 cherry, 0 empty, -1 thorn (rows split by ";")', value: "0,1,1,0; 1,-1,0,1; 1,0,-1,1; 0,1,1,1", width: 270 }],
    random: () => { const n = Viz.rand(2, 4); return { grid: Array.from({ length: n }, () => Array.from({ length: n }, () => { const x = Math.random(); return x < 0.15 ? -1 : x < 0.6 ? 1 : 0; }).join(",")).join("; ") }; },
    build: ({ grid }) => {
      const g = parseGrid(grid, { maxR: 5, maxC: 5, min: -1, max: 1 }), n = g.length;
      if (g[0].length !== n) throw new Error("Cherry Pickup needs a square grid (n rows of n cells).");
      const T = 2 * n - 2, ok = (r, t) => r >= 0 && r < n && t - r >= 0 && t - r < n;
      const dp = Array.from({ length: T + 1 }, () => Array.from({ length: n }, () => Array(n).fill(undefined)));
      const fr = [];
      for (let t = 0; t <= T; t++) for (let r1 = 0; r1 < n; r1++) for (let r2 = 0; r2 < n; r2++) {
        if (!ok(r1, t) || !ok(r2, t)) continue;
        const c1 = t - r1, c2 = t - r2;
        if (g[r1][c1] < 0 || g[r2][c2] < 0) { dp[t][r1][r2] = -INF; continue; }
        const gain = g[r1][c1] + (r1 !== r2 ? g[r2][c2] : 0);
        if (t === 0) { dp[0][0][0] = gain; continue; }
        let best = -INF;
        for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const v = dp[t - 1][r1 - a] ? dp[t - 1][r1 - a][r2 - b] : undefined; if (v !== undefined && v > best) best = v; }
        dp[t][r1][r2] = best === -INF ? -INF : gain + best;
      }
      /* backtrack the optimal pair of routes */
      const ans = Math.max(0, dp[T][n - 1][n - 1]);
      let routeA = [], routeB = [];
      if (dp[T][n - 1][n - 1] > -INF) {
        let r1 = n - 1, r2 = n - 1;
        for (let t = T; t >= 0; t--) {
          routeA.push([r1, t - r1]); routeB.push([r2, t - r2]);
          if (t === 0) break;
          const gain = g[r1][t - r1] + (r1 !== r2 ? g[r2][t - r2] : 0);
          for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const row = dp[t - 1][r1 - a], v = row ? row[r2 - b] : undefined; if (v !== undefined && v > -INF && v + gain === dp[t][r1][r2]) { r1 -= a; r2 -= b; break; } }
        }
        routeA.reverse(); routeB.reverse();
      }
      const shown = (t) => dp[t].map((row, r1) => row.map((v, r2) => (ok(r1, t) && ok(r2, t) ? v : undefined)));
      fr.push({ t: 0, L: shown(0), P: null, focus: [0, 0], preds: [], note: `Walking to the corner and back equals <b>two walkers</b> going from (0,0) to (n−1,n−1) together. After t steps each walker is on the diagonal r + c = t, so a state only needs (t, r1, r2). Start: dp[0][0][0] = ${dp[0][0][0] === -INF ? "−∞ (thorn on the start)" : g[0][0]}.`, line: [0, 1], vars: { t: 0, states: 1 } });
      for (let t = 1; t <= T; t++) {
        let focus = null, fv = -INF;
        for (let r1 = 0; r1 < n; r1++) for (let r2 = r1; r2 < n; r2++) { const v = dp[t][r1][r2]; if (v !== undefined && (focus === null || v > fv)) { fv = v; focus = [r1, r2]; } }
        const preds = [];
        if (focus && fv > -INF) {
          let bestP = null, bv = -INF;
          for (const [a, b] of [[0, 0], [1, 0], [0, 1], [1, 1]]) { const p1 = focus[0] - a, p2 = focus[1] - b; const v = dp[t - 1][p1] ? dp[t - 1][p1][p2] : undefined; if (v !== undefined) { preds.push([p1, p2]); if (v > bv) { bv = v; bestP = [p1, p2]; } } }
          preds.forEach((p) => { p.win = bestP && p[0] === bestP[0] && p[1] === bestP[1]; });
        }
        const [r1, r2] = focus || [0, 0];
        const gain = focus && fv > -INF ? g[r1][t - r1] + (r1 !== r2 ? g[r2][t - r2] : 0) : 0;
        fr.push({ t, L: shown(t), P: shown(t - 1), focus, preds, note: focus && fv > -INF ? `Step ${t}: walker A at (${r1},${t - r1}), B at (${r2},${t - r2}) is the best state of this layer: ${fv}. It picks up ${gain}${r1 === r2 ? " (same cell, counted once)" : ""} plus the best of its ${preds.length} predecessor states in layer ${t - 1} (each walker came from above or from the left). Only r1 ≤ r2 is needed: the walkers are interchangeable.` : `Step ${t}: every state is blocked by thorns (−∞). No route exists.`, line: [3, 4, 5, 6], vars: { t, focus: focus ? `(${r1},${r2})` : "—", value: fmtN(fv) } });
      }
      fr.push({ t: T, L: shown(T), P: null, focus: [n - 1, n - 1], preds: [], routeA, routeB, note: ans ? `Answer <b>${ans}</b> cherries. Walk the best predecessors back: walker A's route is the trip there; walker B's route, reversed, is the trip back. Cells both walk through are counted once.` : "Answer <b>0</b>: either no route exists or there are no reachable cherries.", line: 7, vars: { answer: ans }, ans, route: [routeA, routeB] });
      return fr.map((f) => ({ ...f, g, n }));
    },
    render: (f) => {
      const n = f.n, onA = new Set((f.routeA || []).map((p) => p.join())), onB = new Set((f.routeB || []).map((p) => p.join()));
      const A = f.focus ? [f.focus[0], f.t - f.focus[0]] : null, B = f.focus ? [f.focus[1], f.t - f.focus[1]] : null;
      const field = dgrid(f.g, { label: f.routeA ? "routes (A = there, B = back)" : `the grid at step ${f.t} (diagonal r+c = ${f.t})`, size: 38, gap: 6, fmt: (v) => (v === 1 ? "1" : v === -1 ? "#" : "·"),
        cls: (r, c, v) => {
          if (v === -1) return "wall";
          const k = `${r},${c}`;
          if (f.routeA) return onA.has(k) && onB.has(k) ? "path" : onA.has(k) ? "path" : onB.has(k) ? "accent" : "dim";
          if (A && A[0] === r && A[1] === c) return "active";
          if (B && B[0] === r && B[1] === c) return "accent";
          return r + c === f.t ? "" : "dim";
        }, tag: (r, c) => { if (f.routeA) return ""; const a = A && A[0] === r && A[1] === c, b = B && B[0] === r && B[1] === c; return a && b ? "AB" : a ? "A" : b ? "B" : ""; } });
      const layer = (L, t, cur) => dgrid(L, { label: `layer t=${t}: dp[r1][r2]`, size: 34, gap: 5, rowLabels: L.map((_, r) => `r1=${r}`), rowLabelW: 38, colLabels: L.map((_, r) => `r2=${r}`), fmt: (v) => (v === -INF ? "✗" : String(v)),
        cls: (r1, r2, v) => {
          if (cur && f.focus && r1 === f.focus[0] && r2 === f.focus[1]) return "active";
          if (!cur) { const p = f.preds.find((q) => q[0] === r1 && q[1] === r2); if (p) return `${p.win ? "done" : "visit"} dep`; }
          return v === -INF || r1 > r2 ? "dim" : "done";
        } });
      const parts = [field];
      if (f.P) parts.push(layer(f.P, f.t - 1, false));
      parts.push(layer(f.L, f.t, !f.routeA));
      return `<div class="dlg-col">${Viz.row(...parts)}</div>`;
    },
  }));

  /* ================= 12. Triangle: bottom-up ================= */
  const TRI_CODE = ["def minimum_total(tri):", "    dp = tri[-1][:]                       # bottom row: the path ends here", "    for r in range(len(tri) - 2, -1, -1):  # climb upwards", "        for c in range(r + 1):", "            dp[c] = tri[r][c] + min(dp[c], dp[c+1])   # below or below-right", "    return dp[0]", "# one row of memory: dp[c] is overwritten after both readers used it", ""];
  Viz.register("dp-linear-grid-triangle", (el) => Viz.player(el, {
    title: "Triangle: bottom-up, every cell picks the cheaper child",
    tag: "GRID DP",
    legend: [["active", "cell being computed"], ["done", "cheaper child"], ["visit", "other child"], ["path", "minimum path"]],
    codeLang: "python",
    code: TRI_CODE,
    inputs: [{ key: "tri", label: 'triangle rows (row r has r+1 values, rows split by ";")', value: "2; 3,4; 6,5,7; 4,1,8,3", width: 270 }],
    random: () => ({ tri: Array.from({ length: Viz.rand(2, 5) }, (_, r) => Viz.randInts(r + 1, -3, 9).join(",")).join("; ") }),
    build: ({ tri }) => {
      const t = Viz.parse.matrix(tri);
      if (!t.length || t.length > 7) throw new Error("Use 1 to 7 rows.");
      t.forEach((row, r) => { if (row.length !== r + 1) throw new Error(`Row ${r} needs exactly ${r + 1} value${r ? "s" : ""}.`); if (row.some((v) => !Number.isInteger(v) || v < -99 || v > 99)) throw new Error("Values must be whole numbers from -99 to 99."); });
      const R = t.length, M = t.map((row) => row.map(() => null)), fr = [];
      M[R - 1] = t[R - 1].slice();
      fr.push({ M: Viz.clone(M), cur: null, arrows: [], note: "dp[r][c] = cheapest path from (r,c) down to the bottom. The bottom row is its own answer, so start there and climb: every cell then has both children ready.", line: 1, vars: { r: R - 1 } });
      for (let r = R - 2; r >= 0; r--) for (let c = 0; c <= r; c++) {
        const L = M[r + 1][c], Rr = M[r + 1][c + 1], m = Math.min(L, Rr);
        M[r][c] = t[r][c] + m;
        fr.push({ M: Viz.clone(M), cur: [r, c], arrows: [{ from: [r + 1, c], to: [r, c], cls: L <= Rr ? "done" : "visit", label: String(L) }, { from: [r + 1, c + 1], to: [r, c], cls: L <= Rr ? "visit" : "done", label: String(Rr) }], note: `(${r},${c}) = ${t[r][c]}. Children below: ${L} and ${Rr}. dp = ${t[r][c]} + ${m} = <b>${M[r][c]}</b>.`, line: [3, 4], vars: { r, c, below: L, "below-right": Rr, dp: M[r][c] } });
      }
      const route = [0]; const arrows = [];
      for (let r = 0; r + 1 < R; r++) { const c = route[r], nc = M[r + 1][c] <= M[r + 1][c + 1] ? c : c + 1; route.push(nc); arrows.push({ from: [r, c], to: [r + 1, nc], cls: "path" }); }
      const ans = M[0][0];
      fr.push({ M: Viz.clone(M), cur: null, arrows, route, note: `Answer dp[0][0] = <b>${ans}</b>: ${route.map((c, r) => t[r][c]).join(" + ")}. Top-down from the apex you only follow the cheaper child, no search needed.`, line: 5, vars: { answer: ans }, ans });
      return fr.map((f) => ({ ...f, t, R }));
    },
    render: (f) => {
      const on = new Set((f.route || []).map((c, r) => `${r},${c}`)), src = new Set(f.arrows.map((x) => `${x.from[0]},${x.from[1]}`));
      const g = dgrid(f.M, { label: "dp[r][c] = cheapest path from (r,c) to the bottom (small number = the cell's own value)", cols: f.R, size: 48, gap: 16, rowOffset: (r) => (f.R - 1 - r) / 2, arrows: f.arrows,
        sub: (r, c) => f.t[r][c],
        fmt: (v, r, c) => (v === null ? "" : String(v)),
        cls: (r, c) => {
          if (f.cur && f.cur[0] === r && f.cur[1] === c) return "active";
          if (on.has(`${r},${c}`)) return "path";
          if (src.has(`${r},${c}`)) return `${f.arrows.find((x) => x.from[0] === r && x.from[1] === c).cls} dep`;
          return f.M[r][c] === null ? "" : "done";
        } });
      return `<div class="dlg-col">${g}</div>`;
    },
  }));
})();
