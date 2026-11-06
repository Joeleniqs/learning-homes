/* Sliding Window visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const box = (...parts) => `<div class="sw">${parts.filter(Boolean).join("")}</div>`;
  const par = (v) => (v < 0 ? `(${v})` : `${v}`);
  const q = (c) => `'${esc(c)}'`;
  const counts = (label, entries, cls) => Viz.labeled(label, `<div class="sw-map">${entries.length
    ? entries.map(([k, v]) => `<div class="sw-kv ${cls ? cls(k, v) : ""}"><span class="sw-k">${esc(k)}</span><span class="sw-v">${esc(v)}</span></div>`).join("")
    : '<span class="sw-empty">empty</span>'}</div>`);
  const inv = (ok, head, html) => `<div class="sw-inv ${ok ? "ok" : "bad"}"><b>${ok ? "✓" : "✗"} ${head}</b><span>${html}</span></div>`;
  const chips = (label, items) => Viz.labeled(label, `<div class="sw-chips">${items.length ? items.map(([t, c]) => `<span class="v-item ${c}">${esc(t)}</span>`).join("") : '<span class="sw-empty">none</span>'}</div>`);
  const checkInts = (arr, lo, hi) => {
    if (arr.some((v) => !Number.isInteger(v) || v < lo || v > hi)) throw new Error(`Values must be whole numbers from ${lo} to ${hi}.`);
    return arr;
  };

  /* 1 ─ Fixed-size window: max sum of k consecutive values. */
  Viz.register("sliding-window-fixed", (el) => Viz.player(el, {
    title: "Fixed window: one value in, one value out",
    tag: "O(1) PER SLIDE",
    legend: [["window", "current window"], ["active", "entering a[r]"], ["bad", "leaving a[r−k]"], ["done", "best window"]],
    codeLang: "python",
    code: [
      "s = sum(a[:k])          # first window",
      "best = s",
      "for r in range(k, len(a)):",
      "    s += a[r] - a[r - k]  # in, out",
      "    best = max(best, s)",
      "return best",
    ],
    inputs: [{ key: "a", label: "nums (1–14, −99..99)", value: "2,1,5,1,3,2,9,-4,6,1" }, { key: "k", label: "k", value: "3", width: 60 }],
    random: () => {
      const n = Viz.rand(7, 12);
      return { a: Viz.randInts(n, -5, 12).join(","), k: String(Viz.rand(2, Math.min(5, n - 1))) };
    },
    build: ({ a, k }) => {
      const arr = checkInts(Viz.parse.ints(a, { min: 1, max: 14 }), -99, 99), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: n });
      const fr = [], sums = [];
      let s = 0;
      for (let i = 0; i < K; i++) s += arr[i];
      let best = s, bl = 0, ops = K, brute = K;
      sums.push(s);
      const snap = (x) => ({ arr, K, sums: sums.slice(), bl, ...x, vars: { k: K, ...(x.vars || {}), s, best, "ops (sliding)": ops, "ops (re-sum each)": brute } });
      fr.push(snap({ l: 0, r: K - 1, line: 0, note: `Pay for the first window once: a[0..${K - 1}] sums to <b>${s}</b>. That costs k = ${K} additions. Every later window will cost exactly <b>2</b> operations.` }));
      fr.push(snap({ l: 0, r: K - 1, line: 1, note: "The only window seen so far is also the best so far." }));
      for (let r = K; r < n; r++) {
        const prev = s;
        s += arr[r] - arr[r - K];
        ops += 2;
        brute += K;
        sums.push(s);
        const better = s > best;
        if (better) { best = s; bl = r - K + 1; }
        fr.push(snap({
          l: r - K + 1, r, enter: r, leave: r - K, line: [3, 4], vars: { r },
          note: `Slide right. Windows [${r - K}..${r - 1}] and [${r - K + 1}..${r}] share ${K - 1} value${K === 2 ? "" : "s"}, so keep them and fix only the edges: s = ${prev} + a[${r}] − a[${r - K}] = ${prev} + ${par(arr[r])} − ${par(arr[r - K])} = <b>${s}</b>. ${better ? "That is a <b>new best</b>." : `Not better than ${best}.`}`,
        }));
      }
      fr.push(snap({ l: bl, r: bl + K - 1, final: true, line: 5, note: `Done. The best window is a[${bl}..${bl + K - 1}] with sum <b>${best}</b>. ${n - K + 1} windows cost ${ops} operations, against ${brute} if each window were summed from scratch: O(n) instead of O(n·k).` }));
      return fr;
    },
    render: (f) => box(
      Viz.array(f.arr, { label: `window of size k = ${f.K}`, window: [f.l, f.r], ptrs: { l: f.l, r: f.r }, cls: (i) => (i === f.enter ? "active" : i === f.leave ? "bad" : f.final && i >= f.l && i <= f.r ? "done" : "") }),
      Viz.array(f.sums, { label: "sum of the window starting at i", cls: (i) => (i === f.bl ? "done" : i === f.sums.length - 1 && !f.final ? "visit" : "") }),
    ),
  }));

  /* 2 ─ Variable window, "longest": longest substring without repeating characters. */
  Viz.register("sliding-window-longest", (el) => Viz.player(el, {
    title: "Longest window: expand r, shrink l only while the invariant is broken",
    tag: "EXPAND / SHRINK",
    legend: [["window", "window s[l..r]"], ["active", "just entered"], ["bad", "duplicate / just evicted"], ["dim", "left behind for good"], ["done", "longest window"]],
    codeLang: "python",
    code: [
      "cnt, l, best = {}, 0, 0",
      "for r, ch in enumerate(s):",
      "    cnt[ch] = cnt.get(ch, 0) + 1",
      "    while cnt[ch] > 1:     # broken",
      "        cnt[s[l]] -= 1",
      "        l += 1",
      "    best = max(best, r - l + 1)",
      "return best",
    ],
    inputs: [{ key: "s", label: "string (1–14 chars)", value: "abcabcbbda", width: 180 }],
    random: () => ({ s: Array.from({ length: Viz.rand(9, 13) }, () => "abcdef"[Viz.rand(0, 5)]).join("") }),
    build: ({ s }) => {
      const cs = [...Viz.parse.str(s.trim(), { min: 1, max: 14 })];
      const cnt = new Map();
      let l = 0, r = -1, best = 0, bl = 0, br = -1;
      const fr = [];
      const snap = (x) => {
        const win = cs.slice(l, r + 1).join("");
        return { cs, l, r, bl, br, cnt: [...cnt.entries()], ...x, vars: { l, r, ...(x.vars || {}), window: `"${win}"`, best, "best window": br < 0 ? "·" : `"${cs.slice(bl, br + 1).join("")}"` } };
      };
      const invOf = (ok, ch) => (ok ? ["every char in s[l..r] appears at most once", `the window ${q(cs.slice(l, r + 1).join(""))} has no repeats`] : ["a char appears twice", `${q(ch)} is in the window ${cnt.get(ch)} times, so shrink from the left`]);
      fr.push(snap({ ok: true, inv: ["every char in s[l..r] appears at most once", "the window is empty"], line: 0, note: "Invariant: <b>the window never contains a repeated character</b>. r walks right and adds one character per step; l only moves right when the invariant breaks." }));
      for (r = 0; r < cs.length; r++) {
        const ch = cs[r];
        cnt.set(ch, (cnt.get(ch) || 0) + 1);
        const ok = cnt.get(ch) <= 1;
        fr.push(snap({ ch, ok, inv: invOf(ok, ch), enter: r, dupOf: ok ? null : ch, line: [1, 2], vars: { ch: `'${ch}'` },
          note: ok ? `Add ${q(ch)}. It was not in the window, so the window is still valid and needs no shrinking.`
            : `Add ${q(ch)}: now it is in the window twice. Every window that contains both copies is invalid, and that includes every <i>longer</i> window starting at l. Starts l, l+1, … are dead until the old ${q(ch)} is gone, so move l right.` }));
        while (cnt.get(ch) > 1) {
          const out = cs[l];
          cnt.set(out, cnt.get(out) - 1);
          l++;
          const fixed = cnt.get(ch) <= 1;
          fr.push(snap({ ch, ok: fixed, inv: invOf(fixed, ch), leave: l - 1, dupOf: fixed ? null : ch, line: [3, 4, 5], vars: { ch: `'${ch}'` },
            note: fixed ? `Evict ${q(out)} at index ${l - 1}. That was the earlier ${q(ch)}, so the invariant holds again. l never moves back: any window starting before ${l} that reaches r would contain both copies.`
              : `Evict ${q(out)} at index ${l - 1}. It is not the duplicate, but it sits left of it, so it must go too.` }));
        }
        const len = r - l + 1, better = len > best;
        if (better) { best = len; bl = l; br = r; }
        fr.push(snap({ ch, ok: true, inv: invOf(true, ch), showBest: better, line: 6, vars: { ch: `'${ch}'`, "r - l + 1": len },
          note: better ? `Valid window [${l}..${r}] of length ${len}: a <b>new best</b>. It is the longest valid window that ends at ${r}, because l is as far left as the invariant allows.`
            : `Valid window [${l}..${r}] of length ${len}. Not longer than ${best}.` }));
      }
      r = cs.length - 1;
      fr.push(snap({ ok: true, inv: ["done", `longest is ${q(cs.slice(bl, br + 1).join(""))}`], final: true, line: 7, note: `Done: <b>${best}</b>. r moved ${cs.length} times and l moved ${l} times, so the work is at most 2n steps: O(n) time and O(alphabet) space for the counts.` }));
      return fr;
    },
    render: (f) => box(
      Viz.array(f.cs, {
        label: "string s", window: [f.l, f.r], ptrs: f.final ? {} : { l: f.l, r: f.r },
        cls: (i) => {
          if (f.final) return i >= f.bl && i <= f.br ? "done" : "";
          if (i === f.leave) return "bad";
          if (f.dupOf !== null && f.dupOf !== undefined && i >= f.l && i <= f.r && f.cs[i] === f.dupOf) return "bad";
          if (i === f.enter) return "active";
          if (f.showBest && i >= f.l && i <= f.r) return "done";
          return i < f.l ? "dim" : "";
        },
      }),
      counts("char counts in the window", f.cnt, (k, v) => (v > 1 ? "bad" : k === f.ch && v === 1 ? "active" : v === 0 ? "dim" : "")),
      inv(f.ok, f.inv[0], f.inv[1]),
    ),
  }));

  /* 3 ─ Variable window, "shortest": minimum window substring with need / have counters. */
  Viz.register("sliding-window-minwin", (el) => Viz.player(el, {
    title: "Minimum window substring: expand until valid, shrink while valid",
    tag: "NEED / HAVE",
    legend: [["window", "window s[l..r]"], ["active", "just entered"], ["bad", "just evicted / below quota"], ["done", "quota met · best window"], ["path", "char of t"]],
    codeLang: "python",
    code: [
      "need = Counter(t); win = Counter()",
      "have, req = 0, len(need)",
      "l, best = 0, (inf, 0, 0)",
      "for r, ch in enumerate(s):",
      "    win[ch] += 1",
      "    if win[ch] == need[ch]: have += 1",
      "    while have == req:        # valid",
      "        best = min(best, (r-l+1, l, r))",
      "        out = s[l]; win[out] -= 1",
      "        if win[out] < need[out]: have -= 1",
      "        l += 1",
      "L, i, j = best",
      "return \"\" if L == inf else s[i:j+1]",
    ],
    inputs: [{ key: "s", label: "s (1–14 chars)", value: "ADOBECODEBANC", width: 170 }, { key: "t", label: "t (1–6 chars)", value: "ABC", width: 90 }],
    random: () => {
      const s = Array.from({ length: Viz.rand(10, 14) }, () => "ABCDE"[Viz.rand(0, 4)]).join("");
      const t = Array.from({ length: Viz.rand(2, 3) }, () => "ABC"[Viz.rand(0, 2)]).join("");
      return { s, t };
    },
    build: ({ s, t }) => {
      const cs = [...Viz.parse.str(s.trim(), { min: 1, max: 14 })], ts = [...Viz.parse.str(t.trim(), { min: 1, max: 6 })];
      const need = new Map();
      ts.forEach((c) => need.set(c, (need.get(c) || 0) + 1));
      const keys = [...need.keys()], req = keys.length, win = new Map();
      const W = (c) => win.get(c) || 0, N = (c) => need.get(c) || 0;
      let have = 0, l = 0, r = -1, best = null;
      const fr = [];
      const bestStr = () => (best ? `"${cs.slice(best[1], best[2] + 1).join("")}" (${best[0]})` : "none yet");
      const snap = (x) => ({ cs, l, r, keys, need: keys.map(N), win: keys.map(W), have, req, best: best && best.slice(), tset: new Set(ts), ...x, vars: { l, r, ...(x.vars || {}), have, req, best: bestStr() } });
      fr.push(snap({ line: [0, 1, 2], note: `need holds the counts of t. A window is <b>valid</b> when every distinct char of t has reached its quota. Instead of comparing whole maps on every step, keep <b>have</b> = how many of the req = ${req} distinct chars are satisfied. Valid ⇔ have == req: an O(1) test.` }));
      for (r = 0; r < cs.length; r++) {
        const ch = cs[r];
        win.set(ch, W(ch) + 1);
        let why;
        if (!need.has(ch)) why = `${q(ch)} is not in t: it only makes the window longer.`;
        else if (W(ch) === N(ch)) { have++; why = `${q(ch)} just reached its quota (${N(ch)}), so <b>have</b> rises to ${have}.`; }
        else if (W(ch) < N(ch)) why = `${q(ch)} is needed ${N(ch)}× and the window has ${W(ch)}: still short, have stays ${have}.`;
        else why = `${q(ch)} was already satisfied: this copy is surplus, have stays ${have}.`;
        fr.push(snap({ ch, enter: r, line: [4, 5], vars: { ch: `'${ch}'` }, note: `Expand: add ${q(ch)}. ${why} ${have === req ? "Now <b>have == req</b>: the window is valid." : `have ${have} &lt; req ${req}: not valid yet, keep expanding.`}` }));
        while (have === req) {
          const len = r - l + 1, better = !best || len < best[0];
          if (better) best = [len, l, r];
          fr.push(snap({ ch, showBest: better, line: 7, vars: { "r - l + 1": len },
            note: `Valid window [${l}..${r}], length ${len}${better ? ": a <b>new shortest</b>" : `, not shorter than ${best[0]}`}. Any valid window ending at r that starts left of l is longer, so the only hope for something shorter is to move l right. Try it.` }));
          const out = cs[l];
          win.set(out, W(out) - 1);
          const broke = need.has(out) && W(out) < N(out);
          if (broke) have--;
          l++;
          fr.push(snap({ ch: out, leave: l - 1, low: broke ? out : null, line: [8, 9, 10], vars: { out: `'${out}'` },
            note: broke ? `Evict ${q(out)}: the window now has ${W(out)} but needs ${N(out)}, so have drops to ${have}. The window is <b>invalid</b>: stop shrinking and expand r again.`
              : need.has(out) ? `Evict ${q(out)}: it was surplus (still ${W(out)} ≥ ${N(out)}), so the window stays valid. Keep shrinking.`
                : `Evict ${q(out)}: not in t, so nothing changes except the length. Still valid, keep shrinking.` }));
        }
      }
      r = cs.length - 1;
      fr.push(snap({ final: true, line: [11, 12], note: best ? `Done: the minimum window is <b>"${esc(cs.slice(best[1], best[2] + 1).join(""))}"</b>. Each index enters once (r) and leaves at most once (l): O(|s| + |t|).` : `Done: no window contains all of t, so the answer is the empty string.` }));
      return fr;
    },
    render: (f) => box(
      Viz.array(f.cs, {
        label: "string s", window: [f.l, f.r], ptrs: f.final ? {} : { l: f.l, r: f.r },
        cls: (i) => {
          if (f.final) return f.best && i >= f.best[1] && i <= f.best[2] ? "done" : "";
          if (i === f.leave) return "bad";
          if (i === f.enter) return "active";
          if (f.showBest && i >= f.l && i <= f.r) return "done";
          if (i >= f.l && i <= f.r) return "";
          return f.tset.has(f.cs[i]) ? "path" : "";
        },
      }),
      Viz.row(
        Viz.grid([f.need, f.win], {
          label: "quota per char of t", rowLabels: ["need", "window"], colLabels: f.keys,
          cls: (r, c) => (r === 0 ? "" : f.keys[c] === f.low ? "bad" : f.win[c] >= f.need[c] ? "done" : f.keys[c] === f.ch ? "active" : ""),
        }),
        Viz.labeled("have / req", `<div class="sw-meter ${f.have === f.req ? "ok" : ""}"><b>${f.have}</b><span>/</span><b>${f.req}</b></div>`),
      ),
      inv(f.have === f.req, f.have === f.req ? "valid: have == req" : "not valid yet", f.have === f.req ? "every char of t is covered, so shrink from the left to look for a shorter one" : `still missing ${f.keys.filter((k, i) => f.win[i] < f.need[i]).map((k) => q(k)).join(", ")}, so expand r`),
    ),
  }));

  /* 4 ─ Counting: exactly K distinct = atMost(K) − atMost(K−1). Both counters run side by side with one shared r. */
  Viz.register("sliding-window-exactk", (el) => Viz.player(el, {
    title: "Exactly K = atMost(K) − atMost(K−1): two left edges, one right edge",
    tag: "COUNTING TRICK",
    legend: [["active", "a[r] just added"], ["bad", "start too far left (> K distinct)"], ["done", "start gives exactly K"], ["visit", "start gives < K (subtracted)"]],
    codeLang: "python",
    code: [
      "def at_most(k):",
      "    cnt, l, total = {}, 0, 0",
      "    for r, x in enumerate(a):",
      "        cnt[x] = cnt.get(x, 0) + 1",
      "        while len(cnt) > k:",
      "            cnt[a[l]] -= 1",
      "            if cnt[a[l]] == 0: del cnt[a[l]]",
      "            l += 1",
      "        total += r - l + 1",
      "    return total",
      "return at_most(K) - at_most(K - 1)",
    ],
    inputs: [{ key: "a", label: "nums (1–12, 0..99)", value: "1,2,1,2,3,3,1,2" }, { key: "k", label: "K", value: "2", width: 60 }],
    random: () => ({ a: Viz.randInts(Viz.rand(7, 11), 1, 4).join(","), k: String(Viz.rand(1, 3)) }),
    build: ({ a, k }) => {
      const arr = checkInts(Viz.parse.ints(a, { min: 1, max: 12 }), 0, 99), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: 6 });
      const c1 = new Map(), c2 = new Map();
      let l1 = 0, l2 = 0, t1 = 0, t2 = 0, r = -1;
      const add = (m, x) => m.set(x, (m.get(x) || 0) + 1);
      const drop = (m, x) => { m.set(x, m.get(x) - 1); if (!m.get(x)) m.delete(x); };
      const fr = [];
      const snap = (x) => {
        const dist = Array.from({ length: n }, (_, i) => (i <= r ? new Set(arr.slice(i, r + 1)).size : null));
        return { arr, K, r, l1, l2, t1, t2, dist, c1: [...c1.entries()], c2: [...c2.entries()], ...x, vars: { r, "l (≤K)": l1, "l (≤K−1)": l2, ...(x.vars || {}), "atMost(K)": t1, "atMost(K−1)": t2, "exactly K": t1 - t2 } };
      };
      fr.push(snap({ line: 10, note: `Counting windows with <i>exactly</i> K distinct values does not fit the shrink rule: when a window has K distinct, shrinking can keep it at K or drop it below, so there is no single "right" l. "At most K" <b>is</b> monotone, so count that twice and subtract.` }));
      for (r = 0; r < n; r++) {
        add(c1, arr[r]);
        add(c2, arr[r]);
        fr.push(snap({ enter: r, line: [2, 3], vars: { x: arr[r] }, note: `Add a[${r}] = ${arr[r]} to both windows. The ≤K window now has ${c1.size} distinct value${c1.size === 1 ? "" : "s"}; the ≤K−1 window has ${c2.size}.` }));
        let m1 = 0, m2 = 0;
        while (c1.size > K) { drop(c1, arr[l1]); l1++; m1++; }
        while (c2.size > K - 1) { drop(c2, arr[l2]); l2++; m2++; }
        t1 += r - l1 + 1;
        t2 += r - l2 + 1;
        const ex = l2 - l1;
        fr.push(snap({ band: true, line: [4, 7, 8], vars: { "+atMost(K)": r - l1 + 1, "+atMost(K−1)": r - l2 + 1 },
          note: `Shrink each window just enough (${m1 ? `l(≤K) moved ${m1}` : "l(≤K) stayed"}, ${m2 ? `l(≤K−1) moved ${m2}` : "l(≤K−1) stayed"}). Starts in [${l1}..${r}] give ≤ K distinct: <b>${r - l1 + 1}</b> subarrays. Starts in [${l2}..${r}] give ≤ K−1: <b>${r - l2 + 1}</b>. The difference, starts in [${l1}..${l2 - 1}], is exactly the <b>${ex}</b> subarr${ex === 1 ? "ay" : "ays"} ending at ${r} with exactly ${K} distinct.` }));
      }
      r = n - 1;
      fr.push(snap({ band: true, final: true, line: 10, note: `Answer: ${t1} − ${t2} = <b>${t1 - t2}</b>. Each left edge only moves right, so the whole thing is O(n). The bottom row (distinct count of a[i..r] for every start i) is for illustration only: it never increases as i moves right, which is exactly why each band is contiguous.` }));
      return fr;
    },
    render: (f) => {
      const band = (i) => (i > f.r ? "sw-ghost" : i < f.l1 ? "bad" : i < f.l2 ? "done" : "visit");
      return box(
        Viz.array(f.arr, { label: "nums", ptrs: { r: f.r }, ptrsTop: { "l≤K": f.l1, "l≤K−1": f.l2 }, cls: (i) => (i === f.enter ? "active" : f.band ? (i > f.r ? "dim" : band(i)) : i > f.r ? "dim" : "") }),
        Viz.array(f.dist, { label: `distinct values in a[i..r], one cell per start i (r = ${f.r})`, showIdx: false, fmt: (v) => (v === null ? "" : v), cls: (i) => (f.dist[i] === null ? "sw-ghost" : f.band ? band(i) : "") }),
        `<div class="sw-tally"><div class="sw-t"><span>atMost(${f.K})</span><b>${f.t1}</b></div><i>−</i><div class="sw-t"><span>atMost(${f.K - 1})</span><b>${f.t2}</b></div><i>=</i><div class="sw-t ok"><span>exactly ${f.K}</span><b>${f.t1 - f.t2}</b></div></div>`,
      );
    },
  }));

  /* 5 ─ Sliding window maximum with a monotonic deque of indices. */
  Viz.register("sliding-window-deque", (el) => Viz.player(el, {
    title: "Sliding window maximum: a deque of candidates, decreasing front to back",
    tag: "MONOTONIC DEQUE",
    legend: [["window", "window"], ["active", "incoming a[r]"], ["path", "index held in the deque"], ["bad", "popped (dominated / expired)"], ["done", "window maximum = front"]],
    codeLang: "python",
    code: [
      "dq, out = deque(), []",
      "for r, x in enumerate(a):",
      "    while dq and a[dq[-1]] <= x:",
      "        dq.pop()           # dominated",
      "    dq.append(r)",
      "    if dq[0] <= r - k:",
      "        dq.popleft()       # expired",
      "    if r >= k - 1:",
      "        out.append(a[dq[0]])",
      "return out",
    ],
    inputs: [{ key: "a", label: "nums (1–12, −99..99)", value: "1,3,-1,-3,5,3,6,7" }, { key: "k", label: "k", value: "3", width: 60 }],
    random: () => {
      const n = Viz.rand(8, 12);
      return { a: Viz.randInts(n, 0, 9).join(","), k: String(Viz.rand(2, 4)) };
    },
    build: ({ a, k }) => {
      const arr = checkInts(Viz.parse.ints(a, { min: 1, max: 12 }), -99, 99), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: n });
      const dq = [], out = [];
      let r = -1, ops = 0;
      const fr = [];
      const snap = (x) => ({ arr, K, r, dq: dq.slice(), out: out.slice(), ...x, vars: { r, ...(x.vars || {}), dq: `[${dq.join(", ")}]`, "values": `[${dq.map((i) => arr[i]).join(", ")}]`, out: `[${out.join(", ")}]`, "deque ops": ops } });
      fr.push(snap({ line: 0, note: "The deque stores <b>indices</b> of values that could still become a window maximum. Their values are kept strictly decreasing from front to back, so the front is always the maximum of the current window." }));
      for (r = 0; r < n; r++) {
        const x = arr[r];
        fr.push(snap({ enter: r, line: 1, vars: { x }, note: `a[${r}] = ${x} arrives. Before storing it, remove every candidate it makes useless.` }));
        while (dq.length && arr[dq[dq.length - 1]] <= x) {
          const j = dq.pop();
          ops++;
          fr.push(snap({ enter: r, popped: j, poppedBack: true, line: [2, 3], vars: { x },
            note: `a[${j}] = ${arr[j]} ≤ ${x}, and index ${j} is older, so it leaves the window <i>before</i> index ${r} does. For as long as ${j} remains in the window, ${x} is there too and is at least as big. Index ${j} can <b>never</b> be a maximum again: pop it from the back.` }));
        }
        dq.push(r);
        ops++;
        fr.push(snap({ line: 4, vars: { x }, note: `Push index ${r}. The deque values [${dq.map((i) => arr[i]).join(", ")}] are strictly decreasing, front to back.` }));
        if (dq[0] <= r - K) {
          const j = dq.shift();
          ops++;
          fr.push(snap({ popped: j, line: [5, 6], vars: { x }, note: `The front index ${j} is outside the window [${r - K + 1}..${r}]: it expired. Pop it from the front. At most one index can expire per step, because the window moves by one.` }));
        }
        if (r >= K - 1) {
          out.push(arr[dq[0]]);
          fr.push(snap({ front: true, line: [7, 8], vars: { x }, note: `The window [${r - K + 1}..${r}] is full. Its maximum is the front: a[${dq[0]}] = <b>${arr[dq[0]]}</b>. No scan needed.` }));
        }
      }
      r = n - 1;
      fr.push(snap({ final: true, line: 9, note: `Done: [${out.join(", ")}]. Each index is pushed once and popped at most once, so there are at most 2n = ${2 * n} deque operations (here ${ops}): O(n) total, O(k) extra space.` }));
      return fr;
    },
    render: (f) => {
      const inDq = new Set(f.dq), lo = f.r - f.K + 1;
      const items = f.dq.map((i) => ({ i, c: f.front && i === f.dq[0] ? "done" : "path" }));
      if (f.popped !== undefined) items[f.poppedBack ? "push" : "unshift"]({ i: f.popped, c: "bad" });
      return box(
        Viz.array(f.arr, {
          label: `nums, window of size k = ${f.K}`, window: f.r >= 0 ? [Math.max(0, lo), f.r] : [1, 0], ptrs: f.r >= 0 && !f.final ? { r: f.r } : {},
          cls: (i) => (i === f.popped ? "bad" : f.front && i === f.dq[0] ? "done" : i === f.enter ? "active" : inDq.has(i) ? "path" : i < lo || i > f.r ? "dim" : ""),
        }),
        Viz.row(
          Viz.labeled("deque: front (max) → back", `<div class="v-queue sw-dq">${items.length ? items.map(({ i, c }) => `<div class="v-item ${c}"><span class="sw-dq-v">${f.arr[i]}</span><span class="sw-dq-i">i=${i}</span></div>`).join("") : '<span class="sw-empty">empty</span>'}</div>`),
          Viz.labeled("output (one max per window)", `<div class="sw-chips">${f.out.length ? f.out.map((v, i) => `<span class="v-item ${i === f.out.length - 1 && f.front ? "done" : ""}">${v}</span>`).join("") : '<span class="sw-empty">none yet</span>'}</div>`),
        ),
      );
    },
  }));

  /* 6 ─ When windows break: negative numbers. Naive window vs prefix sums + hashmap for "count subarrays with sum k". */
  Viz.register("sliding-window-prefix", (el) => Viz.player(el, {
    title: "Negative numbers break the window; prefix sums do not care",
    tag: "WHEN NOT TO SLIDE",
    legend: [["window", "naive window"], ["active", "current element / prefix"], ["done", "subarray with sum k"], ["bad", "subarray the window missed"], ["visit", "matching earlier prefix"]],
    codeLang: "python",
    code: [
      "# naive window (WRONG with negatives)",
      "l = s = cnt = 0",
      "for r, x in enumerate(a):",
      "    s += x",
      "    while s > k and l <= r:",
      "        s -= a[l]; l += 1",
      "    if s == k: cnt += 1",
      "# prefix sums + hashmap (always right)",
      "seen, P, cnt = {0: 1}, 0, 0",
      "for x in a:",
      "    P += x",
      "    cnt += seen.get(P - k, 0)",
      "    seen[P] = seen.get(P, 0) + 1",
      "return cnt",
    ],
    inputs: [{ key: "a", label: "nums (1–10, −20..20)", value: "1,2,-1,3,-2,4,1" }, { key: "k", label: "k (1–30)", value: "3", width: 70 }],
    random: () => {
      for (let tries = 0; tries < 60; tries++) {
        const a = Viz.randInts(Viz.rand(6, 9), -4, 6), k = Viz.rand(2, 7);
        const subs = [];
        for (let i = 0; i < a.length; i++) { let s = 0; for (let j = i; j < a.length; j++) { s += a[j]; if (s === k) subs.push(1); } }
        let l = 0, s = 0, c = 0;
        a.forEach((x, r) => { s += x; while (s > k && l <= r) s -= a[l++]; if (s === k) c++; });
        if (subs.length >= 2 && c !== subs.length) return { a: a.join(","), k: String(k) };
      }
      return { a: "1,2,-1,3,-2,4,1", k: "3" };
    },
    build: ({ a, k }) => {
      const arr = checkInts(Viz.parse.ints(a, { min: 1, max: 10 }), -20, 20), n = arr.length;
      const K = Viz.parse.int(k, { min: 1, max: 30 });
      const truth = [];
      for (let i = 0; i < n; i++) { let s = 0; for (let j = i; j < n; j++) { s += arr[j]; if (s === K) truth.push([i, j]); } }
      const sub = ([i, j]) => `[${i}..${j}]`;
      const fr = [], found = [];
      let l = 0, s = 0, cnt = 0, r = -1;
      const snap1 = (x) => ({ phase: 1, arr, l, r, found: found.slice(), ...x, vars: { k: K, l, r, s, cnt, ...(x.vars || {}) } });
      fr.push(snap1({ line: [0, 1], note: `Phase 1: the positive-numbers recipe. "Sum too big → move l right" is only correct if dropping a value always <i>lowers</i> the sum and adding one always <i>raises</i> it. Watch what happens with negatives.` }));
      for (r = 0; r < n; r++) {
        s += arr[r];
        fr.push(snap1({ enter: r, line: [2, 3], note: `Add a[${r}] = ${arr[r]}: s = ${s}.${arr[r] < 0 ? " A negative value made the window <i>smaller</i> by growing it: monotonicity is already broken." : ""}` }));
        let moved = 0;
        while (s > K && l <= r) { s -= arr[l]; l++; moved++; }
        if (moved) fr.push(snap1({ line: [4, 5], note: `s exceeded ${K}, so the naive rule shrank the window by ${moved}. Now [${l}..${r}], s = ${s}. Those starts are gone for good, even though a later negative value could have brought their sums back to ${K}.` }));
        if (s === K && l <= r) {
          cnt++;
          found.push([l, r]);
          fr.push(snap1({ hit: [l, r], line: 6, note: `s == ${K}: count [${l}..${r}]. The window only ever checks <b>one</b> start per r.` }));
        }
      }
      r = n - 1;
      const key = new Set(found.map(sub)), missed = truth.filter((p) => !key.has(sub(p)));
      fr.push(snap1({ end1: true, missed, line: 6, vars: { "naive count": cnt, "true count": truth.length },
        note: missed.length ? `The naive window counted <b>${cnt}</b> but the true answer is <b>${truth.length}</b>. It missed ${missed.map(sub).join(", ")}. With negatives, a too-big sum can come back down, so "too big" no longer proves a start is dead.`
          : `This input happened to work (${cnt} = ${truth.length}), but only by luck. Try Randomize: most mixed-sign inputs break it.` }));
      const pre = [0], seen = new Map([[0, 1]]);
      let P = 0, c2 = 0;
      const snap2 = (x) => ({ phase: 2, arr, pre: pre.slice(), r, seen: [...seen.entries()], ...x, vars: { k: K, r, P, "P − k": P - K, cnt: c2, ...(x.vars || {}) } });
      r = -1;
      fr.push(snap2({ line: [7, 8], note: "Phase 2: let P<sub>i</sub> be the sum of a[0..i−1]. Then sum(a[i..r]) = P<sub>r+1</sub> − P<sub>i</sub>. A subarray ending at r has sum k exactly when some earlier prefix equals P<sub>r+1</sub> − k. A hashmap counts earlier prefixes, and the signs of the values no longer matter." }));
      for (r = 0; r < n; r++) {
        P += arr[r];
        pre.push(P);
        const m = [];
        for (let i = 0; i <= r; i++) if (pre[i] === P - K) m.push(i);
        const hits = seen.get(P - K) || 0;
        c2 += hits;
        fr.push(snap2({ enter: r, match: m, line: [9, 10, 11], note: `P = ${P}. Look up P − k = ${P - K}: ${hits ? `seen ${hits} time${hits > 1 ? "s" : ""} (prefix index ${m.join(", ")}), so ${m.map((i) => `[${i}..${r}]`).join(", ")} ${hits > 1 ? "each sum" : "sums"} to ${K}` : "never seen, so no subarray ending here sums to " + K}. cnt = ${c2}.` }));
        seen.set(P, (seen.get(P) || 0) + 1);
        fr.push(snap2({ enter: r, rec: P, line: 12, note: `Record P = ${P} (now seen ${seen.get(P)}×) so that later right ends can pair with it.` }));
      }
      r = n - 1;
      fr.push(snap2({ end2: true, line: 13, note: `Done: <b>${c2}</b> subarrays, matching brute force (${truth.length}). O(n) time and O(n) space, for any signs. This is the prefix-sums pattern, not a window.` }));
      return fr;
    },
    render: (f) => {
      if (f.phase === 1) {
        const missedAt = new Set();
        (f.missed || []).slice(0, 1).forEach(([i, j]) => { for (let x = i; x <= j; x++) missedAt.add(x); });
        return box(
          Viz.array(f.arr, {
            label: "phase 1: naive variable window", window: f.end1 ? [1, 0] : [f.l, f.r], ptrs: f.end1 ? {} : { l: f.l, r: f.r },
            cls: (i) => (f.end1 ? (missedAt.has(i) ? "bad" : "") : f.hit && i >= f.hit[0] && i <= f.hit[1] ? "done" : i === f.enter ? "active" : i < f.l ? "dim" : ""),
          }),
          chips("found by the window", f.found.map((p) => [`[${p[0]}..${p[1]}]`, "done"]).concat((f.missed || []).map((p) => [`[${p[0]}..${p[1]}] missed`, "bad"]))),
        );
      }
      const m = new Set(f.match || []);
      return box(
        Viz.array(f.arr, { label: "phase 2: nums", ptrs: f.r >= 0 && !f.end2 ? { r: f.r } : {}, cls: (i) => (i === f.enter ? "active" : f.match && f.match.length && i >= Math.min(...f.match) && i <= f.r ? "done" : "") }),
        Viz.array(f.pre, { label: "prefix P[i] = sum of a[0..i−1]", cls: (i) => (m.has(i) ? "visit" : i === f.pre.length - 1 && f.r >= 0 && !f.end2 ? "active" : "") }),
        counts("seen: prefix value → count", f.seen, (key) => (f.match && f.match.length && key === f.pre[f.match[0]] ? "visit" : key === f.rec ? "active" : "")),
      );
    },
  }));
})();
