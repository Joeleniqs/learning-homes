/* Visualizers for Greedy Algorithms. Every registered name starts with "greedy-".
 * Frames are recorded while the real algorithm runs; comparisons use exact DP or brute force. */
(() => {
  const esc = Viz.esc;
  const hlPy = (line) => (window.LearningHome ? window.LearningHome.highlight(line, "python") : null) ?? esc(line);
  const setCode = (el, code) => el.querySelectorAll(".viz-code li").forEach((li, k) => { li.innerHTML = hlPy(code[k] || ""); li.style.visibility = k < code.length ? "" : "hidden"; });
  const fmtN = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2).replace(/\.?0+$/, ""));
  const list = (a) => `[${a.join(", ")}]`;
  const LET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  const STATES = ["visit", "done", "path", "active"];
  const intsIn = (s, what, cnt, lo, hi) => {
    const a = Viz.parse.ints(s, { min: cnt[0], max: cnt[1] });
    if (a.some((x) => !Number.isInteger(x) || x < lo || x > hi)) throw new Error(`${what}: use whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const pairsIn = (s, what, cnt, lo, hi) => {
    const parts = String(s).split(/[\s,]+/).filter(Boolean);
    if (parts.length < cnt[0] || parts.length > cnt[1]) throw new Error(`${what}: use ${cnt[0]} to ${cnt[1]} pairs like 10:60.`);
    return parts.map((p) => {
      const m = p.match(/^(\d+):(\d+)$/);
      if (!m) throw new Error(`${what}: "${p}" is not a pair like 10:60.`);
      const a = Number(m[1]), b = Number(m[2]);
      if (a < lo || a > hi || b < lo || b > hi) throw new Error(`${what}: numbers must be from ${lo} to ${hi}.`);
      return [a, b];
    });
  };
  const stats = (rows) => `<div class="gr-stats">${rows.map(([k, v, c]) => `<div><span>${esc(k)}</span><b class="${c || ""}">${v}</b></div>`).join("")}</div>`;

  /* A player with a "problem" select; each mode has its own inputs, code, frames and renderer. */
  function modePlayer(el, opts, cfg) {
    const names = Object.keys(cfg.modes);
    const start = names.includes(opts && opts.mode) ? opts.mode : names[0];
    const maxLines = Math.max(...names.map((n) => cfg.modes[n].code.length));
    const curMode = () => (el.querySelector('select[name="mode"]') || {}).value || start;
    const relabel = (M) => {
      for (const inp of cfg.inputs) {
        const box = el.querySelector(`input[name="${inp.key}"]`);
        if (box && box.parentElement && M.labels && M.labels[inp.key]) box.parentElement.firstChild.textContent = M.labels[inp.key];
      }
    };
    const p = Viz.player(el, {
      title: cfg.title, tag: cfg.tag, legend: cfg.legend, codeLang: "python",
      code: Array(maxLines).fill(""),
      inputs: [
        { key: "mode", label: cfg.modeLabel || "problem", type: "select", value: start, options: names },
        ...cfg.inputs.map((inp) => ({ ...inp, label: (cfg.modes[start].labels || {})[inp.key] || inp.label, value: (opts && opts[inp.key]) ?? cfg.modes[start].defaults[inp.key] ?? "" })),
      ],
      random: () => cfg.modes[curMode()].random(),
      build: (vals) => {
        const name = cfg.modes[vals.mode] ? vals.mode : start, M = cfg.modes[name];
        setCode(el, M.code); relabel(M);
        return M.build(vals).map((f) => ({ ...f, mode: name }));
      },
      render: (f, ctx) => cfg.modes[f.mode].render(f, ctx),
    });
    const sel = el.querySelector('select[name="mode"]');
    if (sel) sel.addEventListener("change", () => {
      const M = cfg.modes[sel.value], form = el.querySelector(".viz-inputs");
      for (const inp of cfg.inputs) if (form.elements[inp.key]) form.elements[inp.key].value = M.defaults[inp.key] ?? "";
      p.rebuild(Object.fromEntries(new FormData(form).entries()));
    });
    return p;
  }

  /* ================= 1. Exchange argument: shortest job first ================= */
  function ganttSvg(jobs, o = {}) {
    const W = 720, total = jobs.reduce((s, j) => s + j.t, 0), n = jobs.length, k = (W - 44 * n) / total;
    let x = 0, out = "", time = 0;
    jobs.forEach((j, idx) => {
      const w = 44 + j.t * k, c = (o.cls && o.cls(j, idx)) || "";
      time += j.t;
      out += `<g class="gr-seg ${c}"><rect x="${x + 1}" y="22" width="${w - 2}" height="34" rx="6"/>`;
      out += `<text class="gr-st" x="${x + w / 2}" y="40">${esc(j.id)}=${j.t}</text>`;
      out += `<text class="gr-sm" x="${x + w / 2}" y="14">×${n - idx}</text>`;
      out += `<line class="gr-tick" x1="${x + w}" y1="56" x2="${x + w}" y2="66"/><text class="gr-sm" x="${x + w}" y="78">${time}</text></g>`;
      x += w;
    });
    return `<div class="v-labeled"><span class="v-caption">${esc(o.label || "")}</span><svg class="gr-svg" viewBox="-14 0 ${W + 28} 86" width="${W + 28}" height="86" role="img" aria-label="${esc(o.label || "schedule")}">${out}<text class="gr-sm gr-l" x="-12" y="78">0</text></svg></div>`;
  }
  const sumC = (jobs) => { let t = 0, s = 0; for (const j of jobs) { t += j.t; s += t; } return s; };
  Viz.register("greedy-exchange", (el, opts) => Viz.player(el, {
    title: "Exchange argument: why shortest-job-first minimises total waiting",
    tag: "PROOF BY SWAPS",
    legend: [["bad", "adjacent inversion (longer job first)"], ["done", "just swapped"], ["visit", "other jobs: unaffected"]],
    codeLang: "python",
    code: ["def min_total_completion(t):", "    time = total = 0", "    for d in sorted(t):            # shortest job first", "        time += d                  # this job finishes now", "        total += time", "    return total", "# proof: take ANY order with an adjacent inversion a > b", "#   swap them: only these two finish times change,", "#   total changes by b - a < 0, so the order was not optimal"],
    inputs: [{ key: "t", label: "job durations", value: (opts && opts.t) || "6,2,8,3,5", width: 170 }],
    random: () => ({ t: Viz.randInts(Viz.rand(3, 6), 1, 9).join(",") }),
    build({ t }) {
      const d = intsIn(t, "durations", [2, 7], 1, 20);
      const jobs = d.map((x, i) => ({ id: LET[i], t: x }));
      const frames = [], snap = (f) => frames.push({ jobs: jobs.map((j) => ({ ...j })), ...f });
      snap({ note: `Jobs run one after another. A job's <b>completion time</b> is when it ends; we minimise their <b>sum</b> (the total waiting of all customers). The labels on top (×k) show how many completion times include each job: the first job delays everyone. Total now: <b>${sumC(jobs)}</b>.`, line: 0, vars: { order: jobs.map((j) => j.id).join(""), total: sumC(jobs) } });
      let swaps = 0;
      for (let pass = 0; pass < jobs.length; pass++) {
        let any = false;
        for (let i = 0; i + 1 < jobs.length; i++) {
          const a = jobs[i], b = jobs[i + 1];
          if (a.t <= b.t) continue;
          any = true;
          const before = sumC(jobs);
          snap({ pair: [i, i + 1], phase: "inv", note: `<b>Inversion</b>: ${a.id} (${a.t}) runs right before the shorter ${b.id} (${b.t}). Everything before them starts at the same time and everything after them still ends at the same time. Only these two completion times can change.`, line: 6, vars: { a: a.t, b: b.t, total: before } });
          const prev = jobs.map((j) => ({ ...j }));
          [jobs[i], jobs[i + 1]] = [jobs[i + 1], jobs[i]];
          swaps++;
          snap({ pair: [i, i + 1], phase: "swap", prev, note: `<b>Swap</b>. ${b.id} now finishes ${a.t} earlier and ${a.id} finishes ${b.t} later, so the total changes by ${b.t} − ${a.t} = <b>${b.t - a.t}</b>: from ${before} to ${sumC(jobs)}. Any order with an inversion can be improved, so no such order is optimal.`, line: [7, 8], vars: { a: a.t, b: b.t, total: sumC(jobs), swaps } });
        }
        if (!any) break;
      }
      snap({ final: true, note: `No inversions remain: the jobs are sorted by duration, and the total is <b>${sumC(jobs)}</b>. This is the exchange argument: start from any optimal order, swap toward the greedy order without making it worse, and you reach the greedy order. So greedy is optimal${swaps ? ` (here ${swaps} swap${swaps > 1 ? "s" : ""} improved the input order)` : ""}.`, line: [1, 2, 3, 4, 5], vars: { order: jobs.map((j) => j.id).join(""), total: sumC(jobs), swaps } });
      return frames;
    },
    render(f) {
      const pr = f.pair || [];
      const cls = (j, k) => (f.final ? "done" : pr.includes(k) ? (f.phase === "inv" ? "bad" : "done") : "visit");
      const rows = f.phase === "swap"
        ? [ganttSvg(f.prev, { label: `before the swap: total ${sumC(f.prev)}`, cls: (j, k) => (pr.includes(k) ? "bad" : "visit") }), ganttSvg(f.jobs, { label: `after the swap: total ${sumC(f.jobs)}`, cls })]
        : [ganttSvg(f.jobs, { label: `order ${f.jobs.map((j) => j.id).join(" ")}: total completion ${sumC(f.jobs)}`, cls })];
      return `<div class="gr-col">${rows.join("")}</div>`;
    },
  }));

  /* ================= 2. When greedy fails ================= */
  const capBar = (label, segs, cap, extra = "") => `<div class="v-labeled gr-capwrap"><span class="v-caption">${esc(label)}</span><div class="gr-cap">${segs.map((s) => `<div class="gr-capseg ${s.c}${s.frac ? " gr-frac" : ""}" style="width:${(100 * s.w) / cap}%" title="${esc(s.t)}"><span>${esc(s.t)}</span></div>`).join("")}</div>${extra}</div>`;
  Viz.register("greedy-fails", (el, opts) => modePlayer(el, opts, {
    title: "When the greedy choice is not safe",
    tag: "COUNTEREXAMPLES",
    legend: [["active", "greedy's current choice"], ["done", "optimal (DP / brute force)"], ["bad", "greedy is stuck or worse"], ["visit", "DP cell it depends on"]],
    inputs: [{ key: "a", label: "coins", width: 170 }, { key: "b", label: "amount", width: 70 }],
    modes: {
      "coin change": {
        labels: { a: "coins", b: "amount" },
        defaults: { a: "1,3,4", b: "6" },
        random: () => ({ a: [[1, 3, 4], [1, 5, 6, 9], [1, 7, 10], [1, 5, 10, 25], [3, 5], [1, 4, 6], [2, 5]][Viz.rand(0, 6)].join(","), b: String(Viz.rand(6, 24)) }),
        code: ["def greedy_coins(coins, amount):     # NOT always right", "    count = 0", "    for c in sorted(coins, reverse=True):", "        take = amount // c              # as many big coins as fit", "        count += take; amount -= take * c", "    return count if amount == 0 else -1", "def min_coins(coins, amount):        # DP: always right", "    dp = [0] + [inf] * amount", "    for x in range(1, amount + 1):", "        dp[x] = min(dp[x - c] + 1 for c in coins if c <= x)"],
        build({ a, b }) {
          const coins = [...new Set(intsIn(a, "coins", [1, 6], 1, 50))].sort((x, y) => x - y);
          const amount = Viz.parse.int(b, { min: 1, max: 40 });
          const frames = [], gl = [];
          let rem = amount;
          frames.push({ ph: "g", gl: [], rem, note: `Greedy: always take the <b>largest coin that fits</b>. It never reconsiders a coin it has taken.`, line: [0, 1], vars: { amount: rem } });
          for (const c of [...coins].reverse()) {
            while (c <= rem) {
              rem -= c; gl.push(c);
              frames.push({ ph: "g", gl: gl.slice(), rem, cur: c, note: `Take <b>${c}</b>: the largest coin ≤ ${rem + c}. Remaining ${rem}.`, line: [3, 4], vars: { coin: c, amount: rem, count: gl.length } });
            }
          }
          const gOk = rem === 0;
          frames.push({ ph: "g", gl: gl.slice(), rem, stuck: !gOk, note: gOk ? `Greedy finishes with <b>${gl.length}</b> coins: ${gl.join(" + ")}. Is that the fewest? Only an exhaustive method can tell.` : `Greedy is <b>stuck</b> with ${rem} left: no coin fits, and it cannot undo its choices. Yet change may exist.`, line: 5, vars: { greedy: gOk ? gl.length : -1 } });
          const dp = Array(amount + 1).fill(Infinity), from = Array(amount + 1).fill(-1);
          dp[0] = 0;
          for (let x = 1; x <= amount; x++) {
            for (const c of coins) if (c <= x && dp[x - c] + 1 < dp[x]) { dp[x] = dp[x - c] + 1; from[x] = c; }
            frames.push({ ph: "d", gl, rem, dp: dp.slice(), x, dep: from[x] > 0 ? x - from[x] : -1, note: dp[x] === Infinity ? `dp[${x}] = ∞: no coin leads to a reachable smaller amount.` : `dp[${x}] = dp[${x - from[x]}] + 1 = <b>${dp[x]}</b>: the best last coin is ${from[x]}. The DP tries <b>every</b> last coin, not only the biggest.`, line: [8, 9], vars: { x, "dp[x]": dp[x], "last coin": from[x] > 0 ? from[x] : "·" } });
          }
          const opt = [];
          if (dp[amount] < Infinity) for (let x = amount; x > 0; x -= from[x]) opt.push(from[x]);
          const pathSet = new Set(); for (let x = amount; x > 0 && from[x] > 0; x -= from[x]) pathSet.add(x); pathSet.add(0);
          const verdict = dp[amount] === Infinity ? "No combination makes this amount, so greedy's failure is correct here." : !gOk ? `Greedy said impossible, but <b>${opt.join(" + ")}</b> works (${opt.length} coins).` : gl.length > opt.length ? `Greedy used <b>${gl.length}</b> coins, the optimum is <b>${opt.length}</b>: ${opt.join(" + ")}. Taking the biggest coin first was not a safe choice.` : `Here greedy matches the optimum (${opt.length} coins). Try amount 6 with coins 1,3,4: greedy 4+1+1, optimum 3+3.`;
          frames.push({ ph: "d", gl, rem, dp: dp.slice(), x: amount, opt, pathSet, done: true, note: verdict, line: 9, vars: { greedy: gOk ? gl.length : -1, optimal: dp[amount] === Infinity ? -1 : dp[amount] } });
          return frames;
        },
        render(f) {
          const coinsRow = (lab, cs, cls) => Viz.labeled(lab, `<div class="gr-coins">${cs.length ? cs.map((c, i) => `<span class="gr-coin ${typeof cls === "function" ? cls(i) : cls}">${c}</span>`).join("") : '<span class="gr-none">none yet</span>'}</div>`);
          const g = coinsRow(`greedy: ${f.gl.length} coin${f.gl.length === 1 ? "" : "s"}${f.stuck ? `, stuck at ${f.rem}` : ""}`, f.gl, (i) => (f.stuck ? "bad" : f.ph === "g" && i === f.gl.length - 1 && f.cur ? "active" : f.done && f.opt && f.gl.length > f.opt.length ? "bad" : ""));
          if (f.ph === "g") return `<div class="gr-col">${g}</div>`;
          const arr = Viz.array(f.dp.slice(0, f.x + 1).concat(Array(f.dp.length - f.x - 1).fill(null)), { label: "dp[x] = fewest coins for amount x", cls: (i) => (f.done ? (f.pathSet.has(i) ? "done" : "") : i === f.x ? "active" : i === f.dep ? "visit" : i > f.x ? "dim" : "") });
          return `<div class="gr-col">${g}${arr}${f.done && f.opt ? coinsRow(`optimal: ${f.opt.length} coins`, f.opt, "done") : ""}</div>`;
        },
      },
      "0/1 vs fractional knapsack": {
        labels: { a: "items weight:value", b: "capacity" },
        defaults: { a: "10:60,20:100,30:120", b: "50" },
        random: () => ({ a: Array.from({ length: Viz.rand(3, 5) }, () => `${Viz.rand(2, 12) * 5}:${Viz.rand(2, 30) * 5}`).join(","), b: String(Viz.rand(6, 16) * 5) }),
        code: ["def fractional_knapsack(items, cap):   # greedy IS optimal", "    items.sort(key=lambda it: it[1] / it[0], reverse=True)", "    value = 0", "    for w, v in items:", "        take = min(w, cap)          # a fraction is allowed", "        value += v * take / w; cap -= take", "    return value", "# 0/1: the same rule takes whole items only", "#   -> it can strand capacity: use DP (dp-knapsack)"],
        build({ a, b }) {
          const raw = pairsIn(a, "items", [2, 7], 1, 200);
          const cap = Viz.parse.int(b, { min: 1, max: 400 });
          const items = raw.map(([w, v], i) => ({ id: LET[i], w, v, r: v / w })).sort((x, y) => y.r - x.r || x.w - y.w);
          const frames = [], frac = [], zo = [];
          const S = () => ({ items, cap, frac: frac.slice(), zo: zo.slice() });
          frames.push({ ...S(), note: `Sort by <b>value per unit of weight</b>: ${items.map((it) => `${it.id} ${fmtN(it.r)}`).join(", ")}. The densest item is the most value we can buy with one unit of capacity.`, line: 1, vars: { cap } });
          let left = cap, fv = 0;
          for (const it of items) {
            if (left <= 0) break;
            const take = Math.min(it.w, left);
            fv += (it.v * take) / it.w; left -= take;
            frac.push({ id: it.id, w: take, v: (it.v * take) / it.w, part: take < it.w, k: items.indexOf(it) });
            frames.push({ ...S(), cur: it.id, note: take < it.w ? `Fractional: only ${take} of ${it.id}'s ${it.w} fits, so take <b>that fraction</b> (value ${fmtN((it.v * take) / it.w)}). The knapsack is exactly full of the densest material available.` : `Fractional: take all of ${it.id} (${it.w} for ${it.v}). Nothing denser is left out.`, line: [4, 5], vars: { item: it.id, take, value: fmtN(fv), cap: left } });
          }
          left = cap; let zv = 0;
          for (const it of items) {
            const fits = it.w <= left;
            if (fits) { left -= it.w; zv += it.v; zo.push({ id: it.id, w: it.w, v: it.v, k: items.indexOf(it) }); }
            frames.push({ ...S(), cur: it.id, zoPhase: true, note: fits ? `0/1 with the same rule: ${it.id} fits whole, take it. Capacity left ${left}.` : `0/1: ${it.id} (${it.w}) does not fit in the ${left} left, and it cannot be cut. Skip it, and that capacity may be wasted.`, line: [7, 8], vars: { item: it.id, value: zv, cap: left } });
          }
          let best = -1, bestMask = 0;
          for (let m = 0; m < 1 << items.length; m++) {
            let w = 0, v = 0;
            items.forEach((it, i) => { if (m >> i & 1) { w += it.w; v += it.v; } });
            if (w <= cap && v > best) { best = v; bestMask = m; }
          }
          const opt = items.filter((_, i) => bestMask >> i & 1).map((it) => ({ id: it.id, w: it.w, v: it.v, k: items.indexOf(it) }));
          frames.push({ ...S(), opt, zoPhase: true, note: zv < best ? `Exhaustive search over all ${1 << items.length} subsets: the best 0/1 load is <b>${best}</b> (${opt.map((o) => o.id).join(" + ")}), greedy got <b>${zv}</b>. Density-first is safe only when items can be split: the exchange argument needs to swap a sliver of one item for a sliver of another.` : `The best 0/1 load is ${best}, the same as greedy this time. Try 10:60,20:100,30:120 with capacity 50: greedy 160, optimum 220.`, line: 8, vars: { fractional: fmtN(fv), "0/1 greedy": zv, "0/1 optimal": best } });
          return frames;
        },
        render(f) {
          const seg = (s) => ({ w: s.w, c: STATES[s.k % 4], frac: s.part, t: `${s.id} ${s.part ? s.w + "/" + f.items[s.k].w : s.w}` });
          const val = (a) => fmtN(a.reduce((x, s) => x + s.v, 0));
          const arr = Viz.array(f.items.map((it) => `${it.id} ${it.w}:${it.v}`), { label: "items by value per weight (densest first)", idxLabel: (i) => `${fmtN(f.items[i].r)}/u`, cls: (i) => (f.items[i].id === f.cur ? "active" : "") });
          const rows = [arr, capBar(`fractional greedy: value ${val(f.frac)}`, f.frac.map(seg), f.cap)];
          if (f.zoPhase) rows.push(capBar(`0/1 greedy: value ${val(f.zo)}`, f.zo.map(seg), f.cap));
          if (f.opt) rows.push(capBar(`0/1 optimal: value ${val(f.opt)}`, f.opt.map(seg), f.cap));
          return `<div class="gr-col">${rows.join("")}</div>`;
        },
      },
    },
  }));

  /* ================= 3. Jump Game I and II ================= */
  function jumpSvg(nums, f) {
    const n = nums.length, CW = 44, X = (i) => 10 + i * CW + CW / 2, top = 96;
    let arcs = "", cells = "", marks = "";
    (f.arcs || []).forEach(([i, j, c]) => {
      if (j <= i) return;
      const x1 = X(i), x2 = X(j), h = Math.min(86, 16 + (j - i) * 12);
      arcs += `<path class="gr-arc ${c || ""}" d="M${x1},${top} Q${(x1 + x2) / 2},${top - h * 2 + 10} ${x2},${top}"/><circle class="gr-arcend ${c || ""}" cx="${x2}" cy="${top}" r="3.5"/>`;
    });
    nums.forEach((v, i) => {
      const c = f.cellCls(i);
      cells += `<g class="gr-cell ${c}"><rect x="${10 + i * CW + 2}" y="${top}" width="${CW - 4}" height="34" rx="6"/><text x="${X(i)}" y="${top + 18}">${v}</text></g><text class="gr-sm" x="${X(i)}" y="${top + 48}">${i}</text>`;
      if (f.under && f.under(i)) marks += `<text class="gr-sm gr-lv" x="${X(i)}" y="${top + 64}">${esc(f.under(i))}</text>`;
    });
    (f.ptrs || []).forEach(([name, i, row]) => { if (i >= 0 && i < n) marks += `<text class="gr-ptr" x="${X(i)}" y="${top + 66 + (row || 0) * 15}">↑${esc(name)}</text>`; });
    const W = 20 + n * CW;
    return `<svg class="gr-svg" viewBox="0 0 ${W} ${top + 100}" width="${W}" height="${top + 100}" role="img" aria-label="jump game">${arcs}${cells}${marks}</svg>`;
  }
  const jumpNums = (s) => intsIn(s, "nums", [1, 16], 0, 9);
  Viz.register("greedy-jump", (el, opts) => modePlayer(el, opts, {
    title: "Jump Game: the reachable frontier, then BFS levels",
    tag: "FRONTIER",
    legend: [["active", "current index"], ["done", "I: scanned · II: even level"], ["visit", "I: reachable, not scanned · II: odd level"], ["path", "II: next level being built"], ["bad", "unreachable"]],
    inputs: [{ key: "a", label: "nums", width: 220 }],
    modes: {
      "jump game I: farthest reach": {
        defaults: { a: "2,3,1,1,0,2,4" },
        random: () => ({ a: Viz.randInts(Viz.rand(6, 11), 0, 4).join(",") }),
        code: ["def can_jump(nums):", "    reach = 0                      # farthest index reachable so far", "    for i, step in enumerate(nums):", "        if i > reach:", "            return False           # i lies beyond the frontier: stuck", "        reach = max(reach, i + step)", "        if reach >= len(nums) - 1:", "            return True", "    return True"],
        build({ a }) {
          const nums = jumpNums(a), n = nums.length, frames = [], arcs = [];
          let reach = 0, ans = null;
          frames.push({ nums, i: -1, reach, arcs: [], note: `Keep one number: <b>reach</b>, the farthest index any jump sequence can land on so far. Every index ≤ reach is reachable, because you can always jump <b>shorter</b> than the maximum.`, line: 1, vars: { reach } });
          for (let i = 0; i < n; i++) {
            if (i > reach) { ans = false; frames.push({ nums, i, reach, arcs: arcs.slice(), stuck: true, note: `i = ${i} &gt; reach = ${reach}. No earlier index can get here, so nothing beyond can be reached either. Answer: <b>False</b>.`, line: [3, 4], vars: { i, reach } }); break; }
            const old = reach;
            reach = Math.max(reach, i + nums[i]);
            arcs.forEach((x) => (x[2] = ""));
            arcs.push([i, Math.min(n - 1, i + nums[i]), "active"]);
            frames.push({ nums, i, reach, arcs: arcs.map((x) => x.slice()), note: reach > old ? `From i = ${i} we can jump up to ${i + nums[i]}: the frontier grows from ${old} to <b>${reach}</b>.` : `From i = ${i} the best landing is ${i + nums[i]}, not past ${old}. The frontier stays at ${reach}; this index adds nothing.`, line: 5, vars: { i, step: nums[i], reach } });
            if (reach >= n - 1) { ans = true; frames.push({ nums, i, reach, arcs: arcs.map((x) => x.slice()), win: true, note: `reach = ${reach} ≥ last index ${n - 1}: the end is reachable. Answer: <b>True</b>. One pass, O(n), and no search tree.`, line: [6, 7], vars: { i, reach } }); break; }
          }
          if (ans === null) frames.push({ nums, i: n - 1, reach, arcs, win: true, note: `Single element: already at the end. <b>True</b>.`, line: 8, vars: { reach } });
          return frames;
        },
        render(f) {
          const n = f.nums.length;
          return `<div class="gr-col">${jumpSvg(f.nums, {
            arcs: f.arcs,
            cellCls: (i) => (f.stuck && i >= f.i ? "bad" : i === f.i ? "active" : i < f.i ? "done" : i <= f.reach ? (f.win && i === n - 1 ? "done" : "visit") : "dim"),
            ptrs: [["i", f.i, 0], ["reach", Math.min(f.reach, n - 1), f.reach === f.i ? 1 : 0]],
          })}</div>`;
        },
      },
      "jump game II: BFS levels": {
        defaults: { a: "2,3,1,1,4,1,1,2,1" },
        random: () => { let a; do { a = Viz.randInts(Viz.rand(6, 11), 1, 4); } while (!a.length); return { a: a.join(",") }; },
        code: ["def jump(nums):", "    jumps, end, far = 0, 0, 0     # end: last index of this level", "    for i in range(len(nums) - 1):", "        far = max(far, i + nums[i])  # best landing from this level", "        if i == end:                 # this level is fully scanned", "            jumps += 1", "            end = far                # next level = (old end, far]", "    return jumps"],
        build({ a }) {
          const nums = jumpNums(a), n = nums.length, frames = [], arcs = [];
          let r = 0; for (let i = 0; i < n && i <= r; i++) r = Math.max(r, i + nums[i]);
          if (r < n - 1) throw new Error("The last index is unreachable for this input; Jump Game II assumes it is reachable.");
          const level = Array(n).fill(-1); level[0] = 0;
          let jumps = 0, end = 0, far = 0;
          const S = (extra) => ({ nums, level: level.slice(), end, far, jumps, arcs: arcs.map((x) => x.slice()), ...extra });
          frames.push(S({ i: -1, note: `Think BFS without a queue. Level 0 is index 0. Level k + 1 is every index reachable in one jump from level k but not before. The levels are <b>contiguous ranges</b>, so two numbers describe the next level: <b>end</b> of the current one and <b>far</b>.`, line: 1, vars: { jumps, end, far } }));
          for (let i = 0; i < n - 1; i++) {
            far = Math.max(far, i + nums[i]);
            arcs.forEach((x) => (x[2] = ""));
            arcs.push([i, Math.min(n - 1, i + nums[i]), "active"]);
            frames.push(S({ i, note: `Scan i = ${i} (level ${level[i]}): it can land as far as ${i + nums[i]}. Best landing from this level so far: <b>far = ${far}</b>.`, line: 3, vars: { i, jumps, end, far } }));
            if (i === end) {
              const lo = end + 1;
              jumps++; end = far;
              for (let k = lo; k <= Math.min(end, n - 1); k++) level[k] = jumps;
              frames.push(S({ i, newLevel: jumps, note: `i reached <b>end</b>: level ${jumps - 1} is fully scanned. One more jump covers indices ${lo}…${Math.min(end, n - 1)}: that is level ${jumps}. ${end >= n - 1 ? "It contains the last index." : ""}`, line: [4, 5, 6], vars: { i, jumps, end, far } }));
              if (end >= n - 1) break;
            }
          }
          frames.push(S({ i: -1, done: true, note: `The last index is in level <b>${level[n - 1]}</b>, so the minimum number of jumps is ${jumps}. Each index is scanned once: O(n). Taking "the jump that lands farthest" is wrong; taking "the level that reaches farthest" is BFS, and BFS levels are shortest paths.`, line: 7, vars: { jumps } }));
          return frames;
        },
        render(f) {
          const n = f.nums.length;
          const cls = (i) => (i === f.i ? "active" : f.level[i] < 0 ? (i <= f.far ? "path" : "dim") : f.level[i] % 2 ? "visit" : "done");
          return `<div class="gr-col">${jumpSvg(f.nums, { arcs: f.arcs, cellCls: cls, under: (i) => (f.level[i] >= 0 ? `L${f.level[i]}` : i <= f.far ? "next" : ""), ptrs: f.done ? [] : [["end", Math.min(f.end, n - 1), 1], ["far", Math.min(f.far, n - 1), f.far === f.end ? 2 : 1]] })}</div>`;
        },
      },
    },
  }));

  /* ================= 4. Gas Station ================= */
  function gasSvg(f) {
    const n = f.diff.length, CW = 64, L = 64, W = L + n * CW + 24;
    const maxAbs = Math.max(1, ...f.diff.map(Math.abs));
    const bx = (i) => L + i * CW + CW / 2, px = (k) => L + (k + 1) * CW;
    const y0 = 64, bs = 44 / maxAbs;
    let s = `<text class="gr-sm gr-l" x="4" y="${y0 - 40}">gas − cost</text><line class="gr-zero" x1="${L}" y1="${y0}" x2="${L + n * CW}" y2="${y0}"/>`;
    f.diff.forEach((d, i) => {
      const h = Math.max(2, Math.abs(d) * bs), c = i > f.i ? "dim" : i === f.i ? "active" : d >= 0 ? "done" : "bad";
      s += `<rect class="gr-bar ${c}" x="${bx(i) - 16}" y="${d >= 0 ? y0 - h : y0}" width="32" height="${h}" rx="3"/>`;
      s += `<text class="gr-sm" x="${bx(i)}" y="${d >= 0 ? y0 - h - 5 : y0 + h + 12}">${d > 0 ? "+" : ""}${d}</text>`;
    });
    const vals = [0, ...f.pre, ...f.tankPts.map((p) => p.v)];
    const lo = Math.min(...vals), hi = Math.max(...vals), top = 140, H = 150;
    const Y = (v) => top + ((hi - v) / Math.max(1, hi - lo)) * H;
    s += `<text class="gr-sm gr-l" x="4" y="${top - 14}">running sums</text><line class="gr-zero" x1="${L}" y1="${Y(0)}" x2="${L + n * CW}" y2="${Y(0)}"/><text class="gr-sm gr-r" x="${L - 6}" y="${Y(0) + 4}">0</text>`;
    for (let i = 0; i <= n; i++) s += `<line class="gr-grid" x1="${L + i * CW}" y1="${top - 6}" x2="${L + i * CW}" y2="${top + H + 6}"/>`;
    const shown = f.pre.slice(0, f.i + 1);
    if (shown.length) s += `<polyline class="gr-pline" points="${[[L, 0], ...shown.map((v, k) => [px(k), v])].map(([x, v]) => `${x},${Y(v)}`).join(" ")}"/>`;
    shown.forEach((v, k) => { s += `<circle class="gr-pdot${f.minK === k && f.final ? " gr-min" : ""}" cx="${px(k)}" cy="${Y(v)}" r="${f.minK === k && f.final ? 6 : 3}"/>`; });
    let prev = { x: L, v: 0 };
    f.tankPts.forEach((p) => {
      s += `<line class="gr-tline${p.reset ? " bad" : ""}" x1="${prev.x}" y1="${Y(prev.v)}" x2="${p.x}" y2="${Y(p.v)}"/><circle class="gr-tdot${p.reset ? " bad" : ""}" cx="${p.x}" cy="${Y(p.v)}" r="4"/>`;
      if (p.reset) s += `<line class="gr-reset" x1="${p.x}" y1="${Y(p.v)}" x2="${p.x}" y2="${Y(0)}"/><circle class="gr-tdot" cx="${p.x}" cy="${Y(0)}" r="4"/>`;
      prev = { x: p.x, v: p.reset ? 0 : p.v };
    });
    f.diff.forEach((_, i) => {
      s += `<text class="gr-sm${i === f.start ? " gr-startlab" : ""}" x="${bx(i)}" y="${top + H + 24}">${i === f.start ? "▲ start " : ""}${i}</text>`;
      s += `<text class="gr-sm gr-muted" x="${bx(i)}" y="${top + H + 38}">${f.gas[i]}/${f.cost[i]}</text>`;
    });
    s += `<text class="gr-sm gr-r" x="${L - 6}" y="${top + H + 38}">gas/cost</text>`;
    const h = top + H + 46;
    return `<svg class="gr-svg" viewBox="0 0 ${W} ${h}" width="${W}" height="${h}" role="img" aria-label="gas station running sums">${s}</svg>`;
  }
  Viz.register("greedy-gas", (el, opts) => Viz.player(el, {
    title: "Gas Station: the running tank, and why the start jumps forward",
    tag: "PREFIX SUM GREEDY",
    legend: [["done", "net gain"], ["bad", "net loss / tank went negative"], ["active", "current station"], ["visit", "tank since the current start"]],
    codeLang: "python",
    code: ["def can_complete_circuit(gas, cost):", "    total = tank = start = 0", "    for i in range(len(gas)):", "        diff = gas[i] - cost[i]", "        total += diff                # the whole loop's balance", "        tank += diff                 # fuel since 'start'", "        if tank < 0:                 # cannot reach i + 1 from start", "            start, tank = i + 1, 0   # nor from anything in start..i", "    return start if total >= 0 else -1"],
    inputs: [{ key: "gas", label: "gas", value: (opts && opts.gas) || "1,2,3,4,5", width: 170 }, { key: "cost", label: "cost", value: (opts && opts.cost) || "3,4,5,1,2", width: 170 }],
    random: () => { const n = Viz.rand(4, 9); return { gas: Viz.randInts(n, 0, 8).join(","), cost: Viz.randInts(n, 0, 8).join(",") }; },
    build({ gas, cost }) {
      const g = intsIn(gas, "gas", [1, 12], 0, 99), c = intsIn(cost, "cost", [1, 12], 0, 99);
      if (g.length !== c.length) throw new Error("gas and cost need the same number of stations.");
      const n = g.length, diff = g.map((x, i) => x - c[i]), pre = [];
      diff.reduce((s, d) => (pre.push(s + d), s + d), 0);
      let minK = 0; pre.forEach((v, k) => { if (v < pre[minK]) minK = k; });
      const frames = [], tankPts = [];
      let total = 0, tank = 0, start = 0;
      const S = (x) => ({ gas: g, cost: c, diff, pre, minK, tankPts: tankPts.map((p) => ({ ...p })), start, ...x });
      frames.push(S({ i: -1, note: `Each station adds gas[i] and the trip to the next costs cost[i]: only the <b>net</b> gas − cost matters (top bars). Below, the dashed line is the running sum from station 0; the solid line is the tank since the current <b>start</b>.`, line: [0, 1], vars: { total, tank, start } }));
      for (let i = 0; i < n; i++) {
        total += diff[i]; tank += diff[i];
        if (tank < 0) {
          tankPts.push({ x: 64 + (i + 1) * 64, v: tank, reset: true });
          frames.push(S({ i, note: `Tank = ${tank} &lt; 0 after station ${i}: starting at ${start} we cannot reach ${i + 1}. Every station between ${start} and ${i} fails too: each was reached with tank ≥ 0, so starting there means arriving with <b>less</b> fuel. Jump the start to <b>${i + 1}</b> and empty the tank.`, line: [6, 7], vars: { i, diff: diff[i], total, tank, start } }));
          start = i + 1; tank = 0;
          const last = frames[frames.length - 1]; last.start = start;
        } else {
          tankPts.push({ x: 64 + (i + 1) * 64, v: tank });
          frames.push(S({ i, note: `Station ${i}: net ${diff[i] >= 0 ? "+" : ""}${diff[i]}. Tank since start ${start} = ${tank} ≥ 0, so we can drive on.`, line: [3, 4, 5], vars: { i, diff: diff[i], total, tank, start } }));
        }
      }
      const ok = total >= 0;
      frames.push(S({ i: n - 1, final: true, note: ok ? `total = ${total} ≥ 0, so a valid start exists, and it is <b>${start}</b>: the station right after the <b>lowest point</b> of the running sum (circled at ${minK}). Starting just after the deepest deficit means the tank never dips below that level again. One pass, O(n).` : `total = ${total} &lt; 0: the whole loop burns more gas than it gives, so <b>no</b> start works. Answer −1.`, line: 8, vars: { total, start: ok ? start : -1 } }));
      return frames;
    },
    render: (f) => `<div class="gr-col">${gasSvg(f)}</div>`,
  }));

  /* ================= 5. Candy: two passes ================= */
  Viz.register("greedy-candy", (el, opts) => Viz.player(el, {
    title: "Candy: satisfy the left rule, then the right rule, then take the max",
    tag: "TWO PASSES",
    legend: [["active", "child being set"], ["visit", "neighbour compared"], ["done", "value kept (the larger side)"], ["path", "raised by the second pass"]],
    codeLang: "python",
    code: ["def candy(ratings):", "    n = len(ratings)", "    left = [1] * n                  # left neighbour rule only", "    for i in range(1, n):", "        if ratings[i] > ratings[i - 1]:", "            left[i] = left[i - 1] + 1", "    right = [1] * n                 # right neighbour rule only", "    for i in range(n - 2, -1, -1):", "        if ratings[i] > ratings[i + 1]:", "            right[i] = right[i + 1] + 1", "    return sum(max(l, r) for l, r in zip(left, right))"],
    inputs: [{ key: "r", label: "ratings", value: (opts && opts.r) || "1,3,4,5,2,1,1,2", width: 220 }],
    random: () => ({ r: Viz.randInts(Viz.rand(5, 11), 0, 6).join(",") }),
    build({ r }) {
      const a = intsIn(r, "ratings", [1, 14], 0, 20), n = a.length, frames = [];
      const left = Array(n).fill(null), right = Array(n).fill(null);
      const S = (x) => ({ a, left: left.slice(), right: right.slice(), ...x });
      left[0] = 1;
      frames.push(S({ ph: 1, i: 0, note: `Two rules: everyone gets ≥ 1, and a child rated higher than a <b>neighbour</b> gets more than that neighbour. Each neighbour gives one rule. Pass 1 handles only the <b>left</b> neighbour: the first child gets 1.`, line: [2], vars: { i: 0, "left[i]": 1 } }));
      for (let i = 1; i < n; i++) {
        left[i] = a[i] > a[i - 1] ? left[i - 1] + 1 : 1;
        frames.push(S({ ph: 1, i, j: i - 1, note: a[i] > a[i - 1] ? `${a[i]} &gt; ${a[i - 1]}: child ${i} must beat its left neighbour, so left[${i}] = ${left[i - 1]} + 1 = <b>${left[i]}</b>. A rising run counts 1, 2, 3, …` : `${a[i]} ≤ ${a[i - 1]}: no left-side constraint, so the minimum <b>1</b> is enough for now.`, line: a[i] > a[i - 1] ? [4, 5] : [3, 4], vars: { i, "left[i]": left[i] } }));
      }
      right[n - 1] = 1;
      frames.push(S({ ph: 2, i: n - 1, note: `Pass 2 goes right to left and handles only the <b>right</b> neighbour. It must run backwards so that right[i + 1] is final before right[i] uses it.`, line: [6], vars: { i: n - 1, "right[i]": 1 } }));
      for (let i = n - 2; i >= 0; i--) {
        right[i] = a[i] > a[i + 1] ? right[i + 1] + 1 : 1;
        frames.push(S({ ph: 2, i, j: i + 1, note: a[i] > a[i + 1] ? `${a[i]} &gt; ${a[i + 1]}: child ${i} must beat its right neighbour, so right[${i}] = ${right[i + 1]} + 1 = <b>${right[i]}</b>.` : `${a[i]} ≤ ${a[i + 1]}: no right-side constraint, right[${i}] = 1.`, line: a[i] > a[i + 1] ? [8, 9] : [7, 8], vars: { i, "right[i]": right[i] } }));
      }
      const fin = a.map((_, i) => Math.max(left[i], right[i])), sum = fin.reduce((x, y) => x + y, 0);
      frames.push(S({ ph: 3, fin, note: `Each child takes <b>max(left, right)</b>: that satisfies both rules, and nothing smaller can, because each array is the least amount that satisfies its own rule. Total: <b>${sum}</b> candies. Highlighted counts are the ones the second pass raised: the peak of a slope is set by its longer side.`, line: 10, vars: { total: sum } }));
      return frames;
    },
    render(f) {
      const bars = Viz.bars(f.a, { label: "ratings", height: 80, cls: (i) => (i === f.i ? "active" : i === f.j ? "visit" : "") });
      const L = Viz.array(f.left, { label: "pass 1: left[i] (left rule)", cls: (i) => (f.ph === 1 && i === f.i ? "active" : f.ph === 1 && i === f.j ? "visit" : f.ph === 3 && f.fin[i] === f.left[i] ? "done" : f.left[i] == null ? "dim" : "") });
      const R = Viz.array(f.right, { label: "pass 2: right[i] (right rule)", cls: (i) => (f.ph === 2 && i === f.i ? "active" : f.ph === 2 && i === f.j ? "visit" : f.ph === 3 && f.fin[i] === f.right[i] ? "done" : f.right[i] == null ? "dim" : "") });
      const F = f.fin ? Viz.array(f.fin, { label: "candies = max(left, right)", cls: (i) => (f.fin[i] > f.left[i] ? "path" : "done") }) : "";
      return `<div class="gr-col">${bars}${L}${R}${F}</div>`;
    },
  }));

  /* ================= 6. Task Scheduler: the frame diagram ================= */
  Viz.register("greedy-tasks", (el, opts) => Viz.player(el, {
    title: "Task Scheduler: frames built from the most frequent task",
    tag: "COUNTING GREEDY",
    legend: [["path", "most frequent task(s): frame anchors"], ["active", "task being placed"], ["done", "other tasks"], ["bad", "idle slot"], ["dim", "not needed"]],
    codeLang: "python",
    code: ["from collections import Counter", "def least_interval(tasks, n):", "    freq = Counter(tasks).values()", "    maxc = max(freq)                       # rows of the diagram", "    cnt_max = sum(f == maxc for f in freq) # cells in the last row", "    frames = (maxc - 1) * (n + 1) + cnt_max", "    return max(len(tasks), frames)         # overflow: no idle at all"],
    inputs: [{ key: "tasks", label: "tasks", value: (opts && opts.tasks) || "AAABBBCCD", width: 200 }, { key: "n", label: "cooldown n", value: (opts && opts.n) ?? "3", width: 70 }],
    random: () => ({ tasks: Array.from({ length: Viz.rand(6, 14) }, () => "AAABBCCDEF"[Viz.rand(0, 9)]).sort().join(""), n: String(Viz.rand(1, 4)) }),
    build({ tasks, n }) {
      const t = String(tasks).trim().toUpperCase();
      if (!/^[A-Z]{1,30}$/.test(t)) throw new Error("tasks: use 1 to 30 letters A–Z.");
      const cd = Viz.parse.int(n, { min: 0, max: 6 });
      const cnt = {}; for (const ch of t) cnt[ch] = (cnt[ch] || 0) + 1;
      const letters = Object.keys(cnt).sort((x, y) => cnt[y] - cnt[x] || x.localeCompare(y));
      const maxc = cnt[letters[0]], cntMax = letters.filter((l) => cnt[l] === maxc).length;
      const rest = t.length - maxc * cntMax, R = maxc;
      const W = maxc === 1 ? Math.max(cd + 1, t.length) : Math.max(cd + 1, cntMax + Math.ceil(rest / (maxc - 1)));
      const grid = Array.from({ length: R }, () => Array(W).fill(""));
      const frames = [], formula = (maxc - 1) * (cd + 1) + cntMax, ans = Math.max(t.length, formula);
      const S = (x) => ({ grid: grid.map((r) => r.slice()), maxL: letters.slice(0, cntMax), W, R, cd, ...x });
      frames.push(S({ note: `Counts: ${letters.map((l) => `${l}×${cnt[l]}`).join(", ")}. The most frequent task needs ${maxc} runs, and between two runs at least ${cd} other slots. So draw <b>${maxc} rows</b> of width n + 1 = ${cd + 1}: each row is one <b>frame</b> that starts with it.`, line: [2, 3], vars: { maxc, cnt_max: cntMax, n: cd } }));
      let col = 0, row = 0;
      letters.forEach((l, k) => {
        if (k < cntMax) {
          for (let r = 0; r < R; r++) grid[r][k] = l;
          frames.push(S({ cur: l, note: `${l} occurs ${maxc} times (the maximum): it takes a whole column, one copy per row, so its copies are exactly n + 1 = ${cd + 1} apart${k ? `. Every task tied for the maximum also reaches the <b>last row</b>` : ""}.`, line: k ? 4 : 3, vars: { task: l, count: cnt[l] } }));
          col = k + 1;
          return;
        }
        for (let c = 0; c < cnt[l]; c++) {
          grid[row][col] = l;
          row++; if (row >= R - 1) { row = 0; col++; }
        }
        frames.push(S({ cur: l, note: `${l} (×${cnt[l]}) fills free cells <b>column by column</b> in the first ${R - 1} row${R - 1 > 1 ? "s" : ""}. Its copies land in different rows, so each pair is at least n apart. It never needs the last row: only tasks with the maximum count do.`, line: 5, vars: { task: l, count: cnt[l] } }));
      });
      const idle = W === cd + 1;
      frames.push(S({ final: true, idle, note: idle ? `Read the rows left to right, top to bottom. Empty cells in the full rows are <b>idle</b> slots; the last row stops after its ${cntMax} task${cntMax > 1 ? "s" : ""}. Length = (maxc − 1)·(n + 1) + cnt_max = ${maxc - 1}·${cd + 1} + ${cntMax} = <b>${formula}</b>.` : `The other tasks overflow the frames: the rows grow wider than n + 1 and no slot has to stay idle. The answer is simply the number of tasks, <b>${t.length}</b> (the formula would give ${formula}).`, line: 6, vars: { frames: formula, tasks: t.length, answer: ans } }));
      return frames;
    },
    render(f) {
      const g = f.grid.map((r, ri) => r.map((v, ci) => (v ? v : !f.final ? "" : ri === f.R - 1 ? "" : f.idle ? "idle" : "")));
      return `<div class="gr-col">${Viz.grid(g, {
        label: "rows = frames, read left to right, top to bottom",
        rowLabels: g.map((_, i) => (i === f.R - 1 ? "last" : `frame ${i + 1}`)),
        colLabels: Array.from({ length: f.W }, (_, i) => String(i)),
        cls: (r, c, v) => (v === "idle" ? "bad" : !v ? (f.final ? "dim" : "") : v === f.cur ? "active" : f.maxL.includes(v) ? "path" : "done"),
      })}</div>`;
    },
  }));

  /* ================= 7. Partition Labels ================= */
  Viz.register("greedy-partition", (el, opts) => Viz.player(el, {
    title: "Partition Labels: stretch the part to the last occurrence",
    tag: "EXTEND THE END",
    legend: [["active", "scanning i"], ["window", "current part start…end"], ["done", "finished parts (two shades alternate)"]],
    codeLang: "python",
    code: ["def partition_labels(s):", "    last = {c: i for i, c in enumerate(s)}  # last index of each letter", "    sizes, start, end = [], 0, 0", "    for i, c in enumerate(s):", "        end = max(end, last[c])     # this part must reach last[c]", "        if i == end:                # nothing inside reaches further", "            sizes.append(end - start + 1)", "            start = i + 1", "    return sizes"],
    inputs: [{ key: "s", label: "s", value: (opts && opts.s) || "ababcbacadefegdehijhklij", width: 260 }],
    random: () => ({ s: Array.from({ length: Viz.rand(10, 20) }, () => "abcdefgh"[Viz.rand(0, 7)]).join("") }),
    build({ s }) {
      s = String(s).trim().toLowerCase();
      if (!/^[a-z]{1,26}$/.test(s)) throw new Error("Use 1 to 26 lowercase letters.");
      const last = {}; [...s].forEach((c, i) => (last[c] = i));
      const frames = [], parts = [];
      let start = 0, end = 0;
      const S = (x) => ({ s, last, parts: parts.map((p) => p.slice()), start, end, ...x });
      frames.push(S({ i: -1, note: `First record where each letter appears <b>last</b> (bottom row). A letter can belong to one part only, so a part that contains c must stretch at least to last[c].`, line: 1, vars: { start, end } }));
      for (let i = 0; i < s.length; i++) {
        const old = end;
        end = Math.max(end, last[s[i]]);
        frames.push(S({ i, note: end > old ? `'${s[i]}' appears again at ${last[s[i]]}: the part must stretch from ${old} to <b>${end}</b>.` : `'${s[i]}' last appears at ${last[s[i]]} ≤ end = ${end}: already inside the part.`, line: 4, vars: { i, c: s[i], "last[c]": last[s[i]], end } }));
        if (i === end) {
          parts.push([start, end]);
          frames.push(S({ i, cut: true, note: `i = end = ${end}: no letter in ${start}…${end} occurs later. Cut here. The part has size <b>${end - start + 1}</b>, and cutting as early as possible leaves the most room for more parts.`, line: [5, 6, 7], vars: { i, size: end - start + 1, sizes: list(parts.map(([x, y]) => y - x + 1)) } }));
          start = i + 1;
        }
      }
      frames.push(S({ i: -1, done: true, note: `Sizes: <b>${list(parts.map(([x, y]) => y - x + 1))}</b>: ${parts.length} parts, the most possible. Every cut was forced to be no earlier, and each was made as early as allowed. O(n) time, O(alphabet) space.`, line: 8, vars: { sizes: list(parts.map(([x, y]) => y - x + 1)) } }));
      return frames;
    },
    render(f) {
      const partOf = (i) => f.parts.findIndex(([a, b]) => i >= a && i <= b);
      const cls = (i) => { const p = partOf(i); return p >= 0 ? (p % 2 ? "path" : "done") : i === f.i ? "active" : i >= f.start && i <= f.end && f.i >= 0 ? "window" : ""; };
      const top = Viz.array([...f.s], { label: "s", cls, ptrs: f.i < 0 ? {} : f.end === f.i ? { "i=end": f.i } : { i: f.i, end: f.end } });
      const bot = Viz.array([...f.s].map((c) => f.last[c]), { label: "last[s[i]]", cls: (i) => (i === f.i ? "active" : "") });
      return `<div class="gr-col gr-part">${top}${bot}</div>`;
    },
  }));

  /* ================= 8. Course Schedule III ================= */
  function courseLine(f) {
    const W = 720, L = 10, maxT = Math.max(f.maxLast, f.peak, 1), u = (W - 40) / maxT;
    let s = "", x = L;
    f.taken.forEach((c) => {
      const w = c.d * u, cls = c.id === f.cur ? "active" : c.id === f.drop ? "bad" : "done";
      s += `<g class="gr-seg ${cls}"><rect x="${x}" y="20" width="${Math.max(2, w - 1)}" height="30" rx="4"/>${w > 34 ? `<text class="gr-st" x="${x + w / 2}" y="39">${c.d}</text>` : ""}</g>`;
      x += c.d * u;
    });
    if (f.deadline != null) {
      const dx = L + f.deadline * u;
      if (f.time > f.deadline) s += `<rect class="gr-over" x="${dx}" y="14" width="${(f.time - f.deadline) * u}" height="42"/>`;
      s += `<line class="gr-dead" x1="${dx}" y1="8" x2="${dx}" y2="62"/><text class="gr-sm" x="${dx}" y="74">deadline ${f.deadline}</text>`;
    }
    s += `<line class="gr-zero" x1="${L}" y1="56" x2="${W - 20}" y2="56"/><text class="gr-sm gr-l" x="${L}" y="74">0</text>`;
    s += `<text class="gr-sm gr-l" x="${L}" y="10">finish time = ${f.time}</text>`;
    return `<svg class="gr-svg" viewBox="0 0 ${W} 80" width="${W}" height="80" role="img" aria-label="courses on a timeline">${s}</svg>`;
  }
  Viz.register("greedy-courses", (el, opts) => Viz.player(el, {
    title: "Course Schedule III: sort by deadline, regret the longest course",
    tag: "GREEDY + MAX-HEAP",
    legend: [["active", "course just added"], ["done", "kept"], ["bad", "dropped (longest so far)"], ["dim", "not reached yet"]],
    codeLang: "python",
    code: ["import heapq", "def schedule_course(courses):", "    heap, time = [], 0                    # max-heap of kept durations", "    for d, last in sorted(courses, key=lambda c: c[1]):", "        time += d                         # take it tentatively", "        heapq.heappush(heap, -d)", "        if time > last:                   # too late: drop the longest", "            time += heapq.heappop(heap)   # adds -longest", "    return len(heap)"],
    inputs: [{ key: "c", label: "duration:lastDay", value: (opts && opts.c) || "100:200,1000:1250,200:1300,300:1400,2000:3200", width: 330 }],
    random: () => ({ c: Array.from({ length: Viz.rand(4, 7) }, () => { const d = Viz.rand(1, 9); return `${d}:${d + Viz.rand(0, 14)}`; }).join(",") }),
    build({ c }) {
      const raw = pairsIn(c, "courses", [1, 10], 1, 9999);
      const cs = raw.map(([d, last], id) => ({ id, d, last })).sort((x, y) => x.last - y.last || x.id - y.id);
      const maxLast = Math.max(...cs.map((x) => x.last));
      let time = 0, peak = 0;
      const kept = [], status = {}, frames = [];
      const S = (x) => ({ cs, status: { ...status }, heap: kept.map((k) => k.d).sort((a, b) => b - a), taken: kept.slice(), time, peak, maxLast, ...x });
      frames.push(S({ note: `Sort by <b>deadline</b> (lastDay). Doing kept courses in deadline order is always the best order for a fixed set (an exchange argument), so the only question is <b>which</b> courses to keep.`, line: 3, vars: { time, kept: 0 } }));
      cs.forEach((co, k) => {
        time += co.d; peak = Math.max(peak, time); kept.push(co); status[co.id] = "done";
        frames.push(S({ k, cur: co.id, deadline: co.last, note: `Take course ${co.d}:${co.last} tentatively: finish time ${time - co.d} + ${co.d} = <b>${time}</b>${time <= co.last ? ` ≤ ${co.last}. It fits; keep it.` : ` &gt; ${co.last}. Too late.`}`, line: time <= co.last ? [4, 5] : [4, 5, 6], vars: { d: co.d, last: co.last, time, kept: kept.length } }));
        if (time > co.last) {
          let bi = 0; kept.forEach((x, j) => { if (x.d > kept[bi].d || (x.d === kept[bi].d && x.id > kept[bi].id)) bi = j; });
          const big = kept[bi];
          frames.push(S({ k, drop: big.id, deadline: co.last, note: `We must drop one course (the count stays the same either way), so drop the <b>longest</b>, ${big.d}. That frees the most time for later courses. Every kept course still meets its deadline: the ones before ended no later than before, and the new finish time ${time - big.d} ≤ ${co.last} because the longest is at least ${co.d}.`, line: [6, 7], vars: { dropped: big.d, time: time - big.d } }));
          kept.splice(bi, 1); time -= big.d; status[big.id] = "bad";
        }
      });
      frames.push(S({ final: true, note: `Answer: <b>${kept.length}</b> courses (${kept.map((x) => `${x.d}:${x.last}`).join(", ")}). Each step keeps the largest count possible with the <b>smallest</b> total time, which is the "greedy stays ahead" invariant. O(n log n).`, line: 8, vars: { answer: kept.length, time } }));
      return frames;
    },
    render(f) {
      const arr = Viz.array(f.cs.map((c) => `${c.d}:${c.last}`), { label: "courses sorted by lastDay", ptrs: f.k != null && !f.final ? { k: f.k } : {}, cls: (i) => { const c = f.cs[i]; return c.id === f.drop ? "bad" : c.id === f.cur ? "active" : f.status[c.id] || "dim"; } });
      const heap = Viz.array(f.heap.length ? f.heap : ["·"], { label: "max-heap of kept durations (largest first)", cls: (i) => (f.drop != null && i === 0 ? "bad" : "visit") });
      return `<div class="gr-col">${arr}${courseLine(f)}${heap}</div>`;
    },
  }));

  /* ================= 9. IPO ================= */
  function capLine(f) {
    const W = 720, L = 20, top = Math.max(f.w, ...f.ps.map((p) => p.c), 1), u = (W - 60) / top;
    let s = `<rect class="gr-reach" x="${L}" y="30" width="${Math.max(2, Math.min(f.w, top) * u)}" height="14" rx="7"/><line class="gr-zero" x1="${L}" y1="37" x2="${W - 30}" y2="37"/>`;
    f.ps.forEach((p, i) => {
      const x = L + p.c * u, st = f.status[i] || (p.c <= f.w ? "visit" : "dim");
      s += `<circle class="gr-proj ${st}" cx="${x}" cy="${37}" r="6"/><text class="gr-sm" x="${x}" y="${(i % 2) ? 64 : 20}">${p.c}→${p.p}</text>`;
    });
    s += `<text class="gr-sm gr-l" x="${L}" y="78">capital w = ${f.w}: every project left of it is affordable</text>`;
    return `<svg class="gr-svg" viewBox="0 0 ${W} 84" width="${W}" height="84" role="img" aria-label="capital line">${s}</svg>`;
  }
  Viz.register("greedy-ipo", (el, opts) => Viz.player(el, {
    title: "IPO: unlock by capital, pick by profit",
    tag: "TWO ORDERS: SORT + HEAP",
    legend: [["dim", "locked (capital too high)"], ["visit", "unlocked, waiting in the heap"], ["active", "chosen this round"], ["done", "finished"]],
    codeLang: "python",
    code: ["import heapq", "def find_maximized_capital(k, w, profits, capital):", "    projects = sorted(zip(capital, profits))  # unlock order", "    heap, i = [], 0                           # max-heap of profits", "    for _ in range(k):", "        while i < len(projects) and projects[i][0] <= w:", "            heapq.heappush(heap, -projects[i][1]); i += 1", "        if not heap: break                    # nothing affordable", "        w -= heapq.heappop(heap)              # best unlocked profit", "    return w"],
    inputs: [{ key: "p", label: "capital:profit", value: (opts && opts.p) || "0:1,1:2,1:3,2:5,5:4,4:6,9:9", width: 260 }, { key: "k", label: "k", value: (opts && opts.k) ?? "3", width: 50 }, { key: "w", label: "w", value: (opts && opts.w) ?? "0", width: 50 }],
    random: () => ({ p: Array.from({ length: Viz.rand(4, 8) }, () => `${Viz.rand(0, 8)}:${Viz.rand(1, 9)}`).join(","), k: String(Viz.rand(1, 4)), w: String(Viz.rand(0, 2)) }),
    build({ p, k, w }) {
      const ps = pairsIn(p, "projects", [1, 10], 0, 999).map(([c, pr]) => ({ c, p: pr })).sort((a, b) => a.c - b.c || a.p - b.p);
      const K = Viz.parse.int(k, { min: 1, max: 10 });
      let W = Viz.parse.int(w, { min: 0, max: 999 });
      const status = {}, heap = [], frames = [];
      let i = 0;
      const S = (x) => ({ ps, status: { ...status }, w: W, heap: heap.map((h) => ps[h].p).sort((a, b) => b - a), i, ...x });
      frames.push(S({ note: `Two different orders matter: <b>capital</b> decides what you <i>may</i> start, <b>profit</b> decides what you <i>should</i> start. Sort by capital so a pointer can unlock projects as w grows; keep unlocked profits in a max-heap.`, line: 2, vars: { w: W, k: K } }));
      for (let r = 1; r <= K; r++) {
        const un = [];
        while (i < ps.length && ps[i].c <= W) { heap.push(i); status[i] = "visit"; un.push(i); i++; }
        frames.push(S({ r, note: `Round ${r}: with w = ${W}, ${un.length ? `unlock ${un.map((j) => `${ps[j].c}→${ps[j].p}`).join(", ")}` : "nothing new unlocks"}. Unlocked projects stay unlocked because w never shrinks, so each is pushed once.`, line: [5, 6], vars: { round: r, w: W, heap: list(heap.map((h) => ps[h].p).sort((a, b) => b - a)) } }));
        if (!heap.length) { frames.push(S({ r, note: `The heap is empty: nothing is affordable, and more rounds cannot change that. Stop early.`, line: 7, vars: { w: W } })); break; }
        let b = 0; heap.forEach((h, j) => { if (ps[h].p > ps[heap[b]].p) b = j; });
        const best = heap.splice(b, 1)[0]; status[best] = "active";
        W += ps[best].p;
        frames.push(S({ r, note: `Take the most profitable unlocked project, <b>${ps[best].c}→${ps[best].p}</b>. w becomes <b>${W}</b>. Exchange argument: swapping it for any other unlocked project gives less capital now and unlocks a subset of what this unlocks.`, line: 8, vars: { round: r, w: W } }));
        status[best] = "done";
      }
      frames.push(S({ final: true, note: `Final capital <b>${W}</b>. Sorting is O(n log n) and each project enters and leaves the heap at most once, so the total is O((n + k) log n).`, line: 9, vars: { w: W } }));
      return frames;
    },
    render(f) {
      const arr = Viz.array(f.ps.map((q) => `${q.c}→${q.p}`), { label: "projects sorted by capital (capital→profit)", ptrs: f.final ? {} : { i: f.i }, cls: (j) => f.status[j] || "dim" });
      const heap = Viz.array(f.heap.length ? f.heap : ["·"], { label: "max-heap of unlocked profits", cls: () => "visit" });
      return `<div class="gr-col">${capLine(f)}${arr}${heap}</div>`;
    },
  }));

  /* ================= 10. Huffman coding ================= */
  function huffSvg(roots, hl, fresh) {
    const SP = 58, LV = 56, pos = new Map();
    let cnt = 0, maxD = 0;
    const lay = (t, d) => {
      maxD = Math.max(maxD, d);
      if (!t.l) { pos.set(t.id, { x: 30 + cnt++ * SP, y: 26 + d * LV }); return; }
      lay(t.l, d + 1); lay(t.r, d + 1);
      pos.set(t.id, { x: (pos.get(t.l.id).x + pos.get(t.r.id).x) / 2, y: 26 + d * LV });
    };
    roots.forEach((r) => { lay(r, 0); cnt += 0.35; });
    let e = "", n = "";
    const draw = (t) => {
      const p = pos.get(t.id);
      if (t.l) [[t.l, "0"], [t.r, "1"]].forEach(([c, b]) => {
        const q = pos.get(c.id);
        e += `<line class="gr-hedge" x1="${p.x}" y1="${p.y}" x2="${q.x}" y2="${q.y}"/><text class="gr-bit" x="${(p.x + q.x) / 2 + (b === "0" ? -9 : 9)}" y="${(p.y + q.y) / 2}">${b}</text>`;
        draw(c);
      });
      const c = t.id === fresh ? "active" : hl.includes(t.id) ? "visit" : !t.l ? "done" : "";
      n += `<g class="gr-hnode ${c}"><circle cx="${p.x}" cy="${p.y}" r="17"/><text class="gr-st" x="${p.x}" y="${p.y + 4}">${t.w}</text>${t.l ? "" : `<text class="gr-sym" x="${p.x}" y="${p.y + 32}">${esc(t.sym)}</text>`}</g>`;
    };
    roots.forEach(draw);
    const W = Math.max(300, 30 + cnt * SP), H = 26 + maxD * LV + 44;
    return `<svg class="gr-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="Huffman forest">${e}${n}</svg>`;
  }
  Viz.register("greedy-huffman", (el, opts) => Viz.player(el, {
    title: "Huffman coding: always merge the two lightest trees",
    tag: "GREEDY + MIN-HEAP",
    legend: [["done", "symbol (leaf)"], ["visit", "two lightest roots"], ["active", "new merged node"]],
    codeLang: "python",
    code: ["import heapq", "def huffman(freq):                      # {symbol: weight}", "    heap = [(w, i, s) for i, (s, w) in enumerate(freq.items())]", "    heapq.heapify(heap); nxt = len(heap)  # i breaks ties", "    while len(heap) > 1:", "        w1, _, a = heapq.heappop(heap)    # two lightest trees", "        w2, _, b = heapq.heappop(heap)", "        heapq.heappush(heap, (w1 + w2, nxt, (a, b))); nxt += 1", "    codes = {}", "    def walk(t, code):                  # left = 0, right = 1", "        if isinstance(t, str): codes[t] = code or '0'; return", "        walk(t[0], code + '0'); walk(t[1], code + '1')", "    walk(heap[0][2], ''); return codes"],
    inputs: [{ key: "f", label: "symbol:weight", value: (opts && opts.f) || "a:5,b:9,c:12,d:13,e:16,f:45", width: 300 }],
    random: () => { const n = Viz.rand(3, 7); return { f: Array.from({ length: n }, (_, i) => `${"abcdefgh"[i]}:${Viz.rand(1, 30)}`).join(",") }; },
    build({ f }) {
      const parts = String(f).split(/[\s,]+/).filter(Boolean);
      if (parts.length < 2 || parts.length > 8) throw new Error("Use 2 to 8 pairs like a:5.");
      const seen = new Set();
      let id = 0;
      const roots = parts.map((p) => {
        const m = p.match(/^([A-Za-z0-9])\s*:\s*(\d+)$/);
        if (!m) throw new Error(`"${p}" is not a pair like a:5 (one-character symbol).`);
        if (seen.has(m[1])) throw new Error(`Symbol "${m[1]}" appears twice.`);
        const w = Number(m[2]); if (w < 1 || w > 999) throw new Error("Weights must be 1 to 999.");
        seen.add(m[1]);
        return { id: id++, w, sym: m[1] };
      });
      const leaves = roots.slice(), ord = (a, b) => a.w - b.w || a.id - b.id, frames = [];
      let forest = roots.slice().sort(ord);
      const S = (x) => ({ forest: forest.slice(), ...x });
      frames.push(S({ hl: [], note: `Start with one single-node tree per symbol, ordered by weight (a min-heap does this). A symbol's code length will equal its <b>depth</b>, so heavy symbols should end up shallow.`, line: [2, 3], vars: { trees: forest.length } }));
      while (forest.length > 1) {
        const [a, b] = forest;
        frames.push(S({ hl: [a.id, b.id], note: `The two lightest roots are <b>${a.w}</b> and <b>${b.w}</b>. Exchange argument: in some optimal tree the two rarest symbols are siblings at the deepest level (swapping a deeper heavier symbol up never costs more), so we may join them.`, line: [5, 6], vars: { w1: a.w, w2: b.w } }));
        const t = { id: id++, w: a.w + b.w, l: a, r: b };
        forest = [...forest.slice(2), t].sort(ord);
        frames.push(S({ hl: [], fresh: t.id, note: `Merge them under a new node of weight ${a.w} + ${b.w} = <b>${t.w}</b> (left edge 0, right edge 1). This merge adds ${t.w} bits to the total: every symbol below gets one bit longer.`, line: 7, vars: { merged: t.w, trees: forest.length } }));
      }
      const codes = {};
      const walk = (t, c) => { if (!t.l) { codes[t.sym] = c || "0"; return; } walk(t.l, c + "0"); walk(t.r, c + "1"); };
      walk(forest[0], "");
      const bits = leaves.reduce((s, l) => s + l.w * codes[l.sym].length, 0);
      const fixedLen = Math.max(1, Math.ceil(Math.log2(leaves.length))), fixed = leaves.reduce((s, l) => s + l.w, 0) * fixedLen;
      frames.push(S({ hl: [], codes, leaves, bits, fixed, fixedLen, note: `Codes are root-to-leaf paths. No code is a prefix of another (symbols sit only at leaves), so decoding is unambiguous. Total = Σ weight × length = <b>${bits}</b> bits, versus ${fixed} with fixed ${fixedLen}-bit codes. It also equals the sum of all merged weights.`, line: [9, 10, 11, 12], vars: { bits, fixed } }));
      return frames;
    },
    render(f) {
      const tab = f.codes ? `<div class="gr-codes">${f.leaves.map((l) => `<div><b>${esc(l.sym)}</b><span>${l.w}</span><code>${f.codes[l.sym]}</code></div>`).join("")}</div>${stats([["Huffman bits", f.bits, "done"], [`fixed ${f.fixedLen}-bit`, f.fixed, "bad"]])}` : "";
      return `<div class="gr-col">${huffSvg(f.forest, f.hl, f.fresh)}${tab}</div>`;
    },
  }));

  /* ================= 11. Patching Array ================= */
  function patchSvg(rows, n) {
    const W = 720, L = 104, R = 70, u = (W - L - R) / n, RH = 30;
    let s = `<text class="gr-sm gr-l" x="${L}" y="14">1</text><text class="gr-sm" x="${L + n * u}" y="14">n = ${n}</text><line class="gr-dead" x1="${L + n * u}" y1="18" x2="${L + n * u}" y2="${24 + rows.length * RH}"/>`;
    rows.forEach((r, k) => {
      const y = 24 + k * RH, oldW = Math.min(r.from - 1, n) * u, newW = Math.min(r.to - 1, n) * u - oldW;
      s += `<text class="gr-sm gr-r" x="${L - 8}" y="${y + 15}">${r.label}</text>`;
      s += `<rect class="gr-covold" x="${L}" y="${y + 3}" width="${Math.max(0, oldW)}" height="16" rx="3"/>`;
      if (newW > 0) s += `<rect class="gr-cov ${r.patch ? "path" : "done"}${r.cur ? " cur" : ""}" x="${L + oldW}" y="${y + 3}" width="${Math.max(2, newW)}" height="16" rx="3"/>`;
      s += `<text class="gr-sm gr-l" x="${L + Math.min(r.to - 1, n) * u + 6}" y="${y + 15}">[1, ${r.to - 1}]</text>`;
    });
    const H = 30 + rows.length * RH;
    return `<svg class="gr-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="covered range per step">${s}</svg>`;
  }
  Viz.register("greedy-patch", (el, opts) => Viz.player(el, {
    title: "Patching Array: the reachable range doubles with each patch",
    tag: "STAYS AHEAD (HARD)",
    legend: [["done", "extended by a number from nums"], ["path", "extended by a patch"], ["visit", "range already buildable"]],
    codeLang: "python",
    code: ["def min_patches(nums, n):", "    miss, i, patches = 1, 0, 0       # sums 1..miss-1 are buildable", "    while miss <= n:", "        if i < len(nums) and nums[i] <= miss:", "            miss += nums[i]; i += 1  # extend with a given number", "        else:", "            miss += miss             # patch with miss: doubles reach", "            patches += 1", "    return patches"],
    inputs: [{ key: "nums", label: "nums (sorted)", value: (opts && opts.nums) || "1,5,10", width: 180 }, { key: "n", label: "n", value: (opts && opts.n) ?? "20", width: 70 }],
    random: () => ({ nums: Viz.randInts(Viz.rand(1, 5), 1, 30).sort((a, b) => a - b).join(","), n: String(Viz.rand(10, 80)) }),
    build({ nums, n }) {
      const a = intsIn(nums, "nums", [0, 12], 1, 9999).sort((x, y) => x - y), N = Viz.parse.int(n, { min: 1, max: 5000 });
      let miss = 1, i = 0, patches = 0;
      const rows = [], frames = [], added = [];
      const S = (x) => ({ a, rows: rows.map((r, k) => ({ ...r, cur: k === rows.length - 1 })), N, i, ...x });
      frames.push(S({ note: `Invariant: every total in <b>[1, miss − 1]</b> can be built from what we have so far. Start with miss = 1, the empty range. "miss" is the smallest total we cannot build yet.`, line: 1, vars: { miss, patches } }));
      while (miss <= N) {
        if (i < a.length && a[i] <= miss) {
          const from = miss; miss += a[i];
          rows.push({ label: `use ${a[i]}`, from, to: miss });
          frames.push(S({ note: `nums[${i}] = ${a[i]} ≤ miss = ${from}. Adding ${a[i]} to each buildable total 0…${from - 1} gives ${a[i]}…${from - 1 + a[i]}, which touches the old range, so the range grows to [1, <b>${miss - 1}</b>].`, line: [3, 4], vars: { "nums[i]": a[i], miss, patches } }));
          i++;
        } else {
          const from = miss; miss += miss; patches++; added.push(from);
          rows.push({ label: `patch ${from}`, from, to: miss, patch: true });
          frames.push(S({ note: `${i < a.length ? `nums[${i}] = ${a[i]} &gt; miss = ${from}, so nothing given can make ${from}` : `No numbers left, and ${from} is still unbuildable`}. We must add some x ≤ ${from}; the <b>largest</b> allowed choice, x = ${from}, reaches furthest: range [1, <b>${miss - 1}</b>]. Any smaller patch leaves us behind (greedy stays ahead).`, line: [6, 7], vars: { patch: from, miss, patches } }));
        }
      }
      frames.push(S({ final: true, note: `miss = ${miss} &gt; n = ${N}: every total 1…${N} is buildable. <b>${patches}</b> patch${patches === 1 ? "" : "es"}${added.length ? ` (${added.join(", ")})` : ""}. Each patch at least doubles miss, so there are O(log n) patches: O(len(nums) + log n) time.`, line: 8, vars: { patches, added: list(added) } }));
      return frames;
    },
    render(f) {
      const nums = f.a.length ? Viz.array(f.a, { label: "nums", ptrs: f.final ? {} : { i: f.i }, cls: (j) => (j < f.i ? "done" : "") }) : "";
      return `<div class="gr-col">${nums}${patchSvg(f.rows.length ? f.rows : [], f.N)}</div>`;
    },
  }));
})();
