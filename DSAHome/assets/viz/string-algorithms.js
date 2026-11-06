/* String Algorithms visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const show = (c) => (c === " " ? "␣" : c);
  const q = (c) => `'${esc(show(c))}'`;
  const qs = (s) => `"${esc(s)}"`;
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const cellW = (n) => (n > 26 ? 24 : n > 21 ? 27 : n > 16 ? 30 : 34);
  const box = (...p) => `<div class="sa">${p.filter(Boolean).join("")}</div>`;

  /* An aligned character tape: every row shares the same columns, so a pattern drawn at offset `at`
     sits exactly under the text characters it is being compared with. */
  function tape(n, rows, o = {}) {
    const w = o.w || cellW(n);
    const out = [`<div class="sa-tape" style="grid-template-columns:max-content repeat(${Math.max(1, n)},minmax(${Math.min(w, o.min || 18)}px,${w}px))">`];
    let gr = 0;
    for (const row of rows) {
      if (!row) continue;
      gr++;
      const kind = row.kind || "c";
      out.push(`<div class="sa-lab" style="grid-row:${gr};grid-column:1">${esc(row.label || "")}</div>`);
      out.push(`<div class="sa-${kind}" style="grid-row:${gr};grid-column:2;visibility:hidden">0</div>`);
      (row.cells || []).forEach((t, k) => {
        const col = (row.at || 0) + k;
        if (col < 0 || col >= n || t === null || t === undefined || t === "") return;
        const c = (row.cls && row.cls(k, col)) || "";
        out.push(`<div class="sa-${kind} ${c}" style="grid-row:${gr};grid-column:${col + 2}">${esc(kind === "c" ? show(String(t)) : String(t))}</div>`);
      });
    }
    return out.join("") + "</div>";
  }
  const idxRow = (n, label = "i") => ({ label, kind: "i", cells: range(n) });
  const ptrRow = (n, map, label = "") => {
    const a = Array(n).fill("");
    for (const [k, v] of Object.entries(map)) if (Number.isInteger(v) && v >= 0 && v < n) a[v] = a[v] ? `${a[v]},${k}` : k;
    return { label, kind: "p", cells: a.map((x) => (x ? `↑${x}` : "")) };
  };
  const chips = (label, items, sep) => Viz.labeled(label, `<div class="sa-chips">${items.length
    ? items.map(([t, c], k) => `${k && sep ? `<i>${sep}</i>` : ""}<span class="v-item ${c || ""}">${esc(t)}</span>`).join("")
    : '<span class="sa-empty">none yet</span>'}</div>`);
  const tally = (items) => `<div class="sa-tally">${items.map(([l, v, c]) => `<div class="sa-t ${c || ""}"><span>${esc(l)}</span><b>${esc(v)}</b></div>`).join("")}</div>`;
  const math = (html, c = "") => `<div class="sa-math ${c}">${html}</div>`;
  const str = (s, min, max, re = /^[a-z]+$/, what = "lowercase letters a–z") => {
    s = String(s).trim();
    if (s.length < min || s.length > max) throw new Error(`Use ${min}–${max} characters.`);
    if (!re.test(s)) throw new Error(`Use ${what} only.`);
    return s;
  };
  const randStr = (n, alpha) => Array.from({ length: n }, () => alpha[Viz.rand(0, alpha.length - 1)]).join("");
  const prefixFn = (p) => {
    const pi = Array(p.length).fill(0);
    for (let i = 1; i < p.length; i++) {
      let j = pi[i - 1];
      while (j > 0 && p[i] !== p[j]) j = pi[j - 1];
      if (p[i] === p[j]) j++;
      pi[i] = j;
    }
    return pi;
  };
  const naiveComps = (t, p) => {
    let c = 0;
    for (let s = 0; s + p.length <= t.length; s++) for (let j = 0; j < p.length; j++) { c++; if (t[s + j] !== p[j]) break; }
    return c;
  };

  /* 1. Palindromes: expand around each of the 2n − 1 centers. */
  Viz.register("string-algorithms-palindrome", (el) => Viz.player(el, {
    title: "Expand around center: 2n − 1 centers, grow while the two ends match",
    tag: "O(n²) TIME · O(1) SPACE",
    legend: [["window", "palindrome so far"], ["active", "ends match"], ["bad", "mismatch"], ["done", "best palindrome"]],
    codeLang: "python",
    code: [
      "best = (0, 1)                        # [lo, hi) of the best",
      "for c in range(2 * n - 1):           # 2n − 1 centers",
      "    l, r = c // 2, (c + 1) // 2      # odd: l == r; even: r == l + 1",
      "    while l >= 0 and r < n and s[l] == s[r]:",
      "        l, r = l - 1, r + 1          # one ring outward",
      "    if r - l - 1 > best[1] - best[0]:",
      "        best = (l + 1, r)",
      "return s[best[0]:best[1]]",
    ],
    inputs: [{ key: "s", label: "s (1–18 lowercase)", value: "cabbaabac", width: 200 }],
    random: () => ({ s: randStr(Viz.rand(8, 14), "aab") }),
    build: ({ s }) => {
      const t = str(s, 1, 18), n = t.length, fr = [];
      let bl = 0, bh = 1, count = 0;
      const snap = (x) => ({ t, n, bl, bh, count, cl: -9, cr: -9, lo: 1, hi: 0, ...x, vars: { ...(x.vars || {}), "palindromes": count, best: qs(t.slice(bl, bh)) } });
      fr.push(snap({ line: 0, note: `A palindrome mirrors around its <b>center</b>: a character (odd length) or the gap between two characters (even length). There are 2·${n} − 1 = <b>${2 * n - 1}</b> centers. From each one, grow outward while the two new end characters match.` }));
      for (let c = 0; c < 2 * n - 1; c++) {
        let l = c >> 1, r = (c + 1) >> 1, first = true;
        const kind = l === r ? `odd center on index ${l}` : `even center between ${l} and ${r}`;
        for (;;) {
          const head = first ? `<b>Center ${c}</b> (${kind}). ` : "";
          const vars = { c, l, r };
          if (l < 0 || r >= n) {
            fr.push(snap({ lo: l + 1, hi: r - 1, ok: false, line: 3, vars, note: `${head}${l < 0 ? "l fell off the left end" : "r fell off the right end"}, so ${qs(t.slice(l + 1, r))} is the widest palindrome around this center.` }));
            break;
          }
          if (t[l] !== t[r]) {
            fr.push(snap({ lo: l + 1, hi: r - 1, cl: l, cr: r, ok: false, line: 3, vars, note: `${head}s[${l}] = ${q(t[l])} ≠ s[${r}] = ${q(t[r])}. Every wider string around this center contains this mismatched pair, so stop. ${r - l - 1 ? `${qs(t.slice(l + 1, r))} is the widest here.` : "No even palindrome here."}` }));
            break;
          }
          count++;
          fr.push(snap({ lo: l + 1, hi: r - 1, cl: l, cr: r, ok: true, line: [3, 4], vars, note: l === r
            ? `${head}A single character is a palindrome: ${q(t[l])} (palindrome #${count}). Step one ring outward.`
            : `${head}s[${l}] = s[${r}] = ${q(t[l])} and the inside is already a palindrome, so <b>${qs(t.slice(l, r + 1))}</b> is one too (palindrome #${count}). Step one ring outward.` }));
          l--; r++; first = false;
        }
        const len = r - l - 1;
        if (len > bh - bl) {
          bl = l + 1; bh = r;
          fr.push(snap({ lo: l + 1, hi: r - 1, newBest: true, line: [5, 6], vars: { c, len }, note: `Length ${len} beats the previous best, so the best is now <b>${qs(t.slice(bl, bh))}</b>.` }));
        }
      }
      fr.push(snap({ final: true, line: 7, note: `Done: the longest palindrome is <b>${qs(t.slice(bl, bh))}</b> (length ${bh - bl}), and there are <b>${count}</b> palindromic substrings in total: one per successful comparison. Each center costs O(1 + radius), so the worst case (all one letter) is O(n²) with O(1) extra space. Manacher's algorithm, further down, reuses mirror information to get O(n).` }));
      return fr;
    },
    render: (f) => box(
      tape(f.n, [
        idxRow(f.n),
        { label: "s", cells: [...f.t], cls: (k) => (f.final ? (k >= f.bl && k < f.bh ? "done" : "")
          : k === f.cl || k === f.cr ? (f.ok ? "active" : "bad")
            : k >= f.lo && k <= f.hi ? (f.newBest ? "done" : "window") : "") },
        ptrRow(f.n, f.final ? {} : { l: f.cl, r: f.cr }),
        { label: "best so far", cells: [...f.t].map((ch, k) => (k >= f.bl && k < f.bh ? ch : "")), cls: () => "done" },
      ]),
      tally([["centers", 2 * f.n - 1], ["palindromes found", f.count], ["best length", f.bh - f.bl, "ok"]]),
    ),
  }));

  /* 2. Naive matching: every alignment, compare left to right, forget everything on a mismatch. */
  Viz.register("string-algorithms-naive", (el) => Viz.player(el, {
    title: "Naive matching: slide by one, re-read everything",
    tag: "O((n − m + 1)·m)",
    legend: [["window", "current alignment"], ["done", "matched"], ["active", "comparing (equal)"], ["bad", "mismatch"]],
    codeLang: "python",
    code: [
      "for s in range(n - m + 1):          # every alignment",
      "    j = 0",
      "    while j < m and t[s + j] == p[j]:",
      "        j += 1",
      "    if j == m: report(s)",
    ],
    inputs: [{ key: "t", label: "text (≤ 22)", value: "aaaaaaaaab", width: 200 }, { key: "p", label: "pattern (≤ 8)", value: "aaab", width: 110 }],
    random: () => { const t = randStr(Viz.rand(12, 20), "aab"); const s = Viz.rand(0, t.length - 4); return { t, p: t.slice(s, s + Viz.rand(3, 4)) }; },
    build: ({ t, p }) => {
      const T = str(t, 1, 22), P = str(p, 1, 8);
      if (P.length > T.length) throw new Error("The pattern must not be longer than the text.");
      const n = T.length, m = P.length, fr = [], found = [];
      let comps = 0;
      const snap = (x) => ({ T, P, n, m, found: found.slice(), comps, s: -1, j: -1, ...x, vars: { s: x.s ?? "·", j: x.j ?? "·", comparisons: comps } });
      fr.push(snap({ line: 0, note: `Try every alignment s = 0 … ${n - m} of the pattern under the text and compare left to right. Simple, but at each new alignment it forgets everything the previous comparisons proved.` }));
      for (let s = 0; s <= n - m; s++) {
        let j = 0;
        while (j < m) {
          comps++;
          const ok = T[s + j] === P[j];
          fr.push(snap({ s, j, ok, line: 2, note: `${j === 0 ? `<b>Alignment s = ${s}.</b> ` : ""}t[${s + j}] = ${q(T[s + j])} vs p[${j}] = ${q(P[j])}: ${ok ? "equal, keep going." : `mismatch. The ${j} matched character${j === 1 ? "" : "s"} are thrown away and the pattern shifts by just one${j > 1 ? `, so the next alignment re-reads t[${s + 1}..${s + j - 1}], which we have already seen` : ""}.`}` }));
          if (!ok) break;
          j++;
        }
        if (j === m) { found.push(s); fr.push(snap({ s, j: m, hit: true, line: 4, note: `All ${m} characters matched: an occurrence at <b>${s}</b>.` })); }
      }
      const worst = (n - m + 1) * m;
      fr.push(snap({ final: true, line: 4, note: `Done: ${found.length ? `matches at ${found.join(", ")}` : "no match"}. <b>${comps}</b> character comparisons against a worst case of (n − m + 1)·m = ${worst}. On repetitive inputs such as aaaa…ab almost every alignment re-reads characters it has already matched. KMP and Z never move backwards in the text.` }));
      return fr;
    },
    render: (f) => box(
      tape(f.n, [
        idxRow(f.n),
        { label: "text", cells: [...f.T], cls: (k) => {
          if (f.final) return f.found.some((s) => k >= s && k < s + f.m) ? "done" : "";
          if (f.s < 0) return "";
          if (f.hit) return k >= f.s && k < f.s + f.m ? "done" : "";
          if (k === f.s + f.j) return f.ok ? "active" : "bad";
          if (k >= f.s && k < f.s + f.j) return "done";
          return k >= f.s && k < f.s + f.m ? "window" : "";
        } },
        f.s >= 0 && !f.final ? { label: `p at s=${f.s}`, at: f.s, cells: [...f.P], cls: (k) => (f.hit || k < f.j ? "done" : k === f.j ? (f.ok ? "active" : "bad") : "") } : { label: "p", cells: [] },
      ]),
      tally([["comparisons", f.comps], ["worst (n−m+1)·m", (f.n - f.m + 1) * f.m], ["matches", f.found.length, f.found.length ? "ok" : ""]]),
    ),
  }));

  /* 3. KMP part 1: the prefix function (failure table), with the fallback chain made visible. */
  Viz.register("string-algorithms-prefix", (el) => Viz.player(el, {
    title: "Prefix function: extend the best border, or fall back to the next one",
    tag: "O(m) AMORTISED",
    legend: [["active", "new char p[i]"], ["visit", "border (prefix = suffix)"], ["done", "extended"], ["bad", "cannot extend"], ["path", "pi value used to fall back"]],
    codeLang: "python",
    code: [
      "pi = [0] * m                      # pi[i] = longest proper border of p[:i+1]",
      "for i in range(1, m):",
      "    j = pi[i - 1]                 # longest border of p[:i] is the first candidate",
      "    while j > 0 and p[i] != p[j]:",
      "        j = pi[j - 1]             # next shorter border",
      "    if p[i] == p[j]:",
      "        j += 1                    # extend that border by p[i]",
      "    pi[i] = j",
    ],
    inputs: [{ key: "p", label: "pattern (1–20 lowercase)", value: "abacabab", width: 200 }],
    random: () => { const b = randStr(Viz.rand(2, 4), "ab"); return { p: (b + randStr(1, "abc") + b + b).slice(0, Viz.rand(8, 14)) }; },
    build: ({ p }) => {
      const P = str(p, 1, 20), m = P.length, pi = Array(m).fill(null), fr = [];
      pi[0] = 0;
      let comps = 0;
      const snap = (x) => ({ P, m, pi: pi.slice(), comps, chain: [], ...x, vars: { i: x.i, j: x.j ?? "·", comparisons: comps, ...(x.vars || {}) } });
      fr.push(snap({ i: 0, j: null, line: 0, note: "A <b>border</b> of a string is a proper prefix that is also a suffix (\"aba\" is a border of \"abacaba\"). pi[i] is the length of the longest border of p[0..i]. One character has no proper border, so pi[0] = 0." }));
      for (let i = 1; i < m; i++) {
        let j = pi[i - 1];
        const chain = [j];
        fr.push(snap({ i, j, chain: chain.slice(), line: 2, note: `i = ${i}. Any border of p[0..${i}] is a border of p[0..${i - 1}] followed by ${q(P[i])}. Try the longest one first: pi[${i - 1}] = <b>${j}</b>${j ? `, the prefix ${qs(P.slice(0, j))} (blue), which also ends at ${i - 1}` : " (empty), so compare with p[0]"}.` }));
        for (;;) {
          comps++;
          if (P[i] === P[j]) {
            pi[i] = j + 1;
            fr.push(snap({ i, j, cmp: true, ok: true, set: true, chain: chain.slice(), line: [5, 6, 7], vars: { j: j + 1, "pi[i]": j + 1 }, note: `p[${i}] = p[${j}] = ${q(P[i])}: the border ${j ? qs(P.slice(0, j)) : "\"\""} grows to ${qs(P.slice(0, j + 1))}. pi[${i}] = <b>${j + 1}</b>.` }));
            break;
          }
          if (j === 0) {
            pi[i] = 0;
            fr.push(snap({ i, j, cmp: true, ok: false, set: true, chain: chain.slice(), line: [5, 7], vars: { "pi[i]": 0 }, note: `p[${i}] = ${q(P[i])} ≠ p[0] = ${q(P[0])}, and there is no shorter border left to try. pi[${i}] = <b>0</b>.` }));
            break;
          }
          fr.push(snap({ i, j, cmp: true, ok: false, chain: chain.slice(), line: 3, note: `p[${i}] = ${q(P[i])} ≠ p[${j}] = ${q(P[j])}: the border of length ${j} cannot be extended by ${q(P[i])}.` }));
          const nj = pi[j - 1];
          chain.push(nj);
          fr.push(snap({ i, j: nj, fell: j, chain: chain.slice(), line: 4, note: `Fall back. The next-longest border of p[0..${i - 1}] is the longest border <i>of the border</i> ${qs(P.slice(0, j))}, and that is already in the table: pi[${j - 1}] = <b>${nj}</b>. No length strictly between ${nj} and ${j} is a border, so nothing is skipped.` }));
          j = nj;
        }
      }
      fr.push(snap({ i: m, j: null, final: true, line: 7, note: `Done: pi = [${pi.join(", ")}] in ${comps} comparisons. j climbs by at most 1 per step and every fallback lowers it, so the total work is under 2m: O(m). The whole pattern's longest border is ${pi[m - 1]}, so its smallest period is m − pi[m − 1] = ${m - pi[m - 1]}.` }));
      return fr;
    },
    render: (f) => box(
      tape(f.m, [
        idxRow(f.m),
        { label: "p", cells: [...f.P], cls: (k) => {
          if (f.final) return "";
          if (k === f.i) return f.cmp ? (f.ok ? "done" : "bad") : "active";
          if (f.j > 0 && k >= f.i - f.j && k < f.i) return "visit";
          return k > f.i ? "dim" : "";
        } },
        !f.final && f.i >= 1 && f.j !== null
          ? { label: `prefix, j=${f.j}`, at: f.i - f.j, cells: [...f.P.slice(0, f.j + 1)], cls: (k) => (k < f.j ? "visit" : f.cmp ? (f.ok ? "done" : "bad") : "active") }
          : { label: "prefix", cells: [] },
        { label: "pi", kind: "n", cells: f.pi.map((v) => (v === null ? "?" : v)), cls: (k) => (f.final ? "done" : k === f.i && f.set ? "done" : f.fell && k === f.fell - 1 ? "path" : !f.cmp && !f.fell && k === f.i - 1 ? "path" : f.pi[k] === null ? "blank" : "") },
      ]),
      chips("border lengths tried for this i (the fallback chain)", f.final ? [] : f.chain.map((v, k) => [String(v), k === f.chain.length - 1 ? "active" : "dim"]), "→"),
      tally([["comparisons", f.comps], ["bound 2m", 2 * f.m]]),
    ),
  }));

  /* 4. KMP part 2: the search. The text pointer never moves left; the pattern slides by j − pi[j−1]. */
  Viz.register("string-algorithms-kmp", (el) => Viz.player(el, {
    title: "KMP search: on a mismatch, slide the pattern and keep its border",
    tag: "O(n + m)",
    legend: [["done", "matched"], ["active", "comparing (equal)"], ["bad", "mismatch"], ["path", "kept border (not re-compared)"], ["dim", "never read again"]],
    codeLang: "python",
    code: [
      "pi = prefix_function(p); j = 0     # j = chars of p matched",
      "for i, ch in enumerate(t):",
      "    while j > 0 and ch != p[j]:",
      "        j = pi[j - 1]               # slide p, keep its border",
      "    if ch == p[j]:",
      "        j += 1",
      "    if j == m:",
      "        report(i - m + 1)",
      "        j = pi[j - 1]               # allow overlapping matches",
    ],
    inputs: [{ key: "t", label: "text (≤ 22)", value: "abababcabababcab", width: 200 }, { key: "p", label: "pattern (≤ 8)", value: "ababcab", width: 110 }],
    random: () => { const p = randStr(Viz.rand(3, 5), "ab"); let t = ""; while (t.length < 16) t += Math.random() < 0.5 ? p : randStr(Viz.rand(1, 3), "ab"); return { t: t.slice(0, Viz.rand(14, 20)), p }; },
    build: ({ t, p }) => {
      const T = str(t, 1, 22), P = str(p, 1, 8);
      if (P.length > T.length) throw new Error("The pattern must not be longer than the text.");
      const n = T.length, m = P.length, pi = prefixFn(P), naive = naiveComps(T, P), fr = [], found = [];
      let j = 0, comps = 0;
      const snap = (x) => ({ T, P, n, m, pi, naive, found: found.slice(), comps, i: -1, ...x, vars: { i: x.i ?? -1, j: x.vj ?? x.j, comparisons: comps } });
      fr.push(snap({ j: 0, al: 0, line: 0, note: `pi = [${pi.join(", ")}] is computed first (previous visualizer). j counts how many pattern characters currently match the text ending just before i. The text index i only ever moves <b>forward</b>.` }));
      for (let i = 0; i < n; i++) {
        const ch = T[i];
        for (;;) {
          comps++;
          if (ch === P[j]) {
            fr.push(snap({ i, j, al: i - j, cmp: true, ok: true, vj: j + 1, line: [4, 5], note: `t[${i}] = p[${j}] = ${q(ch)}: now ${j + 1} character${j ? "s" : ""} of the pattern match${j ? "" : "es"}.` }));
            j++;
            break;
          }
          if (j === 0) {
            fr.push(snap({ i, j, al: i, cmp: true, ok: false, line: 4, note: `t[${i}] = ${q(ch)} ≠ p[0] = ${q(P[0])}. Nothing is matched, so no occurrence can start at ${i}; move on.` }));
            break;
          }
          fr.push(snap({ i, j, al: i - j, cmp: true, ok: false, line: 2, note: `t[${i}] = ${q(ch)} ≠ p[${j}] = ${q(P[j])}. But we know t[${i - j}..${i - 1}] = ${qs(P.slice(0, j))}. The next alignment that could still work is the one where a <i>border</i> of ${qs(P.slice(0, j))} lines up with the end of that text.` }));
          const nj = pi[j - 1];
          fr.push(snap({ i, j: nj, al: i - nj, kept: true, used: j - 1, line: 3, note: `Slide the pattern right by j − pi[j−1] = ${j} − ${nj} = <b>${j - nj}</b>. ${nj ? `Its first ${nj} character${nj > 1 ? "s" : ""} (${qs(P.slice(0, nj))}, purple) already match the text, so they are not compared again.` : "No border: restart the pattern at i."} Every skipped alignment would have needed a longer border, and there is none.` }));
          j = nj;
        }
        if (j === m) {
          found.push(i - m + 1);
          fr.push(snap({ i, j: m, al: i - m + 1, hit: true, line: [6, 7], note: `j = m: a full match at <b>${i - m + 1}</b>.` }));
          const nj = pi[m - 1];
          fr.push(snap({ i, j: nj, al: i + 1 - nj, kept: true, used: m - 1, line: 8, note: `Do not restart from scratch: overlapping occurrences may exist. j = pi[${m - 1}] = ${nj}, so the pattern slides by ${m - nj} and its border ${nj ? qs(P.slice(0, nj)) : "(empty)"} stays matched.` }));
          j = nj;
        }
      }
      fr.push(snap({ j, al: n, final: true, line: 1, note: `Done: ${found.length ? `matches at ${found.join(", ")}` : "no match"}. KMP used <b>${comps}</b> comparisons; naive matching uses ${naive} on this input. Each comparison either advances i (at most n times) or slides the pattern right (at most n times), so KMP never exceeds 2n comparisons after O(m) preprocessing.` }));
      return fr;
    },
    render: (f) => {
      const ci = f.cmp ? f.i : -9;
      return box(
        tape(f.n, [
          idxRow(f.n),
          { label: "text", cells: [...f.T], cls: (k) => {
            if (f.final) return f.found.some((s) => k >= s && k < s + f.m) ? "done" : "";
            if (f.hit) return k >= f.al && k < f.al + f.m ? "done" : k < f.al ? "dim" : "";
            if (k === ci) return f.ok ? "active" : "bad";
            if (k >= f.al && k < f.al + f.j) return f.kept ? "path" : "done";
            return k < f.al || (k < f.i && !f.kept) ? "dim" : "";
          } },
          ptrRow(f.n, f.final ? {} : { i: f.i }),
          f.final ? { label: "p", cells: [] } : { label: `p at ${f.al}`, at: f.al, cells: [...f.P], cls: (k) => (f.hit ? "done" : k < f.j ? (f.kept ? "path" : "done") : k === f.j && f.cmp ? (f.ok ? "active" : "bad") : "") },
          f.final ? { label: "pi", kind: "n", cells: [] } : { label: "pi", kind: "n", at: f.al, cells: f.pi, cls: (k) => (f.kept && k === f.used ? "path" : "") },
        ]),
        tally([["KMP comparisons", f.comps, "ok"], ["naive on same input", f.naive, "warn"], ["bound 2n", 2 * f.n], ["matches", f.found.length ? f.found.join(", ") : "–"]]),
      );
    },
  }));

  /* 5. Z-algorithm: the Z-box [l, r) is the rightmost window known to equal a prefix of s. */
  Viz.register("string-algorithms-z", (el) => Viz.player(el, {
    title: "Z-algorithm: reuse the Z-box, compare only past its right edge",
    tag: "O(n)",
    legend: [["visit", "Z-box [l, r) = a prefix"], ["path", "copied from the mirror (free)"], ["done", "compared and equal"], ["bad", "mismatch"]],
    codeLang: "python",
    code: [
      "z = [0] * n; l = r = 0                # s[l:r] == s[0:r-l], r is max",
      "for i in range(1, n):",
      "    if i < r:",
      "        z[i] = min(r - i, z[i - l])      # mirror inside the box",
      "    while i + z[i] < n and s[z[i]] == s[i + z[i]]:",
      "        z[i] += 1                        # explicit comparison",
      "    if i + z[i] > r:",
      "        l, r = i, i + z[i]               # push the box right",
    ],
    inputs: [{ key: "s", label: "s (≤ 24; a–z, $ or #)", value: "aabxaabxcaabxaabxay", width: 220 }],
    random: () => { const p = randStr(Viz.rand(2, 4), "ab"); return Math.random() < 0.5 ? { s: `${p}$${randStr(3, "ab")}${p}${randStr(2, "ab")}${p}`.slice(0, 22) } : { s: (p + p + randStr(2, "abc") + p + p).slice(0, 20) }; },
    build: ({ s }) => {
      const S = str(s, 2, 24, /^[a-z$#]+$/, "a–z, $ or #"), n = S.length, z = Array(n).fill(null), fr = [];
      z[0] = "–";
      let l = 0, r = 0, comps = 0;
      const snap = (x) => ({ S, n, z: z.slice(), l, r, comps, ...x, vars: { i: x.i ?? "·", l, r, "z[i]": x.zi ?? "·", comparisons: comps } });
      fr.push(snap({ line: 0, note: `z[i] = length of the longest substring starting at i that is also a prefix of s. z[0] is not defined (shown as –). We keep the <b>Z-box</b> [l, r): the matching window that reaches furthest right. Inside it, s[l..r) is a copy of s[0..r−l), so positions in the box have already been seen at the start of s.` }));
      for (let i = 1; i < n; i++) {
        let zi = 0;
        if (i < r) {
          const k = i - l, mir = z[k];
          zi = Math.min(r - i, mir);
          fr.push(snap({ i, zi, k, copied: zi, line: [2, 3], note: `i = ${i} is inside the box [${l}, ${r}), so s[${i}..${r}) equals s[${k}..${r - l}). The answer at the mirror k = i − l = ${k} is already known: z[${k}] = ${mir}. ${mir < r - i ? `It ends before the box edge, so z[${i}] = <b>${mir}</b> exactly (the comparison below will fail at once).` : mir > r - i ? `It runs past the box edge, so only ${r - i} characters are guaranteed: z[${i}] starts at <b>${r - i}</b>.` : `It ends exactly at the box edge: start at <b>${zi}</b> and compare beyond r.`}` }));
        } else {
          fr.push(snap({ i, zi: 0, line: 2, note: `i = ${i} is outside the box (r = ${r}), so nothing is known. Start from z[${i}] = 0 and compare.` }));
        }
        const copied = zi;
        while (i + zi < n) {
          comps++;
          const ok = S[zi] === S[i + zi];
          fr.push(snap({ i, zi: ok ? zi + 1 : zi, copied, cmp: zi, ok, line: 4, note: `s[${zi}] = ${q(S[zi])} vs s[${i + zi}] = ${q(S[i + zi])}: ${ok ? "equal, z grows." : `mismatch, so z[${i}] = <b>${zi}</b>.`}` }));
          if (!ok) break;
          zi++;
        }
        if (i + zi >= n) {
          fr.push(snap({ i, zi, copied, line: 4, note: `Reached the end of s: z[${i}] = <b>${zi}</b>.` }));
        }
        z[i] = zi;
        if (i + zi > r) {
          l = i; r = i + zi;
          fr.push(snap({ i, zi, copied, moved: true, line: [6, 7], note: `i + z[i] = ${r} reaches further right than the old box, so the box becomes [${l}, ${r}). r never decreases, and each successful comparison pushes it right by one.` }));
        }
      }
      fr.push(snap({ final: true, line: 1, note: `Done: z = [${z.join(", ")}]. <b>${comps}</b> comparisons for n = ${n}. Each equal comparison advances r (at most n times) and each i has at most one mismatch, so the total is under 2n: O(n). <b>Pattern search</b>: build s = p + "$" + t; every i with z[i] = |p| is a match at i − |p| − 1.` }));
      return fr;
    },
    render: (f) => {
      const i = f.final ? -9 : f.i ?? -9;
      return box(
        tape(f.n, [
          idxRow(f.n),
          { label: "s", cells: [...f.S], cls: (k) => {
            if (f.final || i < 0) return k >= f.l && k < f.r ? "visit" : "";
            if (f.cmp !== undefined && k === i + f.cmp) return f.ok ? "done" : "bad";
            if (k >= i && k < i + f.copied) return "path";
            if (k >= i && k < i + f.zi) return "done";
            return k >= f.l && k < f.r ? "visit" : "";
          } },
          ptrRow(f.n, f.final ? {} : { i, l: f.r > f.l ? f.l : -1 }),
          { label: "box = prefix", cells: f.r > f.l ? [...f.S.slice(0, f.r - f.l)] : [], at: f.l, cls: () => "visit" },
          i > 0 ? { label: "prefix at i", at: i, cells: [...f.S.slice(0, Math.min(f.n - i, Math.max(f.zi, f.cmp ?? 0) + 1))], cls: (k) => (f.cmp !== undefined && k === f.cmp ? (f.ok ? "done" : "bad") : k < f.copied ? "path" : k < f.zi ? "done" : "ghost") } : { label: "prefix at i", cells: [] },
          { label: "z", kind: "n", cells: f.z.map((v) => (v === null ? "?" : v)), cls: (k) => (k === i ? "active" : k === f.k ? "path" : f.z[k] === null ? "blank" : "") },
        ]),
        tally([["comparisons", f.comps], ["bound 2n", 2 * f.n], ["box", f.r > f.l ? `[${f.l}, ${f.r})` : "empty"]]),
      );
    },
  }));

  /* 6. Rabin–Karp: a fixed-size window hash that rolls in O(1). Small moduli make collisions visible. */
  Viz.register("string-algorithms-rabin-karp", (el) => Viz.player(el, {
    title: "Rabin–Karp: roll the window hash, verify only when hashes agree",
    tag: "O(n + m) EXPECTED",
    legend: [["window", "current window"], ["bad", "char leaving"], ["active", "char entering"], ["done", "verified match"], ["warn", "spurious hit (collision)"]],
    codeLang: "python",
    code: [
      "v = lambda c: ord(c) - 96             # a=1 … z=26 (never 0)",
      "hp = hash(p); h = hash(t[:m]); top = pow(B, m - 1, M)",
      "for s in range(n - m + 1):",
      "    if h == hp and t[s:s + m] == p:   # hash equal: verify!",
      "        report(s)",
      "    if s + m < n:                     # roll: drop t[s], add t[s+m]",
      "        h = ((h - v(t[s]) * top) * B + v(t[s + m])) % M",
    ],
    inputs: [
      { key: "t", label: "text (≤ 22)", value: "barcabdcab", width: 180 },
      { key: "p", label: "pattern (≤ 6)", value: "cab", width: 80 },
      { key: "B", label: "base B", value: "26", width: 50 },
      { key: "M", label: "mod M", value: "11", width: 50 },
      { key: "M2", label: "2nd mod (0 = off)", value: "0", width: 60 },
    ],
    random: () => { const p = randStr(3, "abcd"), t = randStr(5, "abcd") + p + randStr(6, "abcd"); return { t, p, B: "26", M: String([7, 11, 17, 19][Viz.rand(0, 3)]), M2: "0" }; },
    build: ({ t, p, B, M, M2 }) => {
      const T = str(t, 1, 22), P = str(p, 1, 6);
      if (P.length > T.length) throw new Error("The pattern must not be longer than the text.");
      const b = Viz.parse.int(B, { min: 2, max: 1000 }), md = Viz.parse.int(M, { min: 2, max: 1000003 }), md2 = Viz.parse.int(M2, { min: 0, max: 1000003 });
      if (b < 2 || b > 1000) throw new Error("Use a base between 2 and 1000.");
      if (md < 2 || md > 1000003) throw new Error("Use M between 2 and 1000003.");
      if (md2 !== 0 && (md2 < 2 || md2 > 1000003)) throw new Error("Use 0 or a 2nd mod between 2 and 1000003.");
      const n = T.length, m = P.length, v = (c) => c.charCodeAt(0) - 96, mods = md2 ? [md, md2] : [md];
      const H = (s) => mods.map((M) => [...s].reduce((h, c) => (h * b + v(c)) % M, 0));
      const tops = mods.map((M) => { let x = 1; for (let k = 1; k < m; k++) x = (x * b) % M; return x; });
      const fmt = (h) => h.join("/");
      const hp = H(P), hs = Array(n).fill(""), fr = [], found = [], spurious = [];
      let h = H(T.slice(0, m)), checks = 0;
      const snap = (x) => ({ T, P, n, m, hs: hs.slice(), found: found.slice(), spurious: spurious.slice(), checks, s: -1, ...x, vars: { s: x.s ?? "·", "h(window)": fmt(h), "h(p)": fmt(hp), "char checks": checks } });
      const polyHtml = (s) => `${[...s].map((c, k) => `${v(c)}·${b}<sup>${m - 1 - k}</sup>`).join(" + ")}`;
      fr.push(snap({ line: [0, 1], note: `Treat each string of length ${m} as a base-${b} number with digits a = 1 … z = 26, reduced mod ${mods.join(" and ")}. h(${qs(P)}) = ${polyHtml(P)} mod ${md} = <b>${fmt(hp)}</b>. A digit of 0 would make "a", "aa" and "aaa" all hash to 0, which is why a starts at 1.`, mathHtml: `h(p) = ${polyHtml(P)} ≡ <b>${fmt(hp)}</b> (mod ${mods.join(", ")})` }));
      for (let s = 0; s + m <= n; s++) {
        hs[s] = fmt(h);
        const eq = h.every((x, k) => x === hp[k]);
        if (!eq) {
          fr.push(snap({ s, line: 3, note: `Window s = ${s}, ${qs(T.slice(s, s + m))}: hash ${fmt(h)} ≠ ${fmt(hp)}. Different hashes mean the strings are certainly different, so no characters are compared.`, mathHtml: `h(t[${s}..${s + m - 1}]) = ${fmt(h)} ≠ ${fmt(hp)} → skip` }));
        } else {
          checks += m;
          const real = T.slice(s, s + m) === P;
          (real ? found : spurious).push(s);
          fr.push(snap({ s, verify: true, real, line: real ? [3, 4] : 3, note: real
            ? `Window s = ${s}: hashes agree (${fmt(h)}), and comparing ${m} characters confirms ${qs(T.slice(s, s + m))} = ${qs(P)}. <b>Match at ${s}.</b>`
            : `Window s = ${s}: hashes agree (${fmt(h)}), but the characters ${qs(T.slice(s, s + m))} ≠ ${qs(P)}. A <b>spurious hit</b>: two different strings share a hash mod ${md}. This is why every hash hit must be verified. ${md2 ? "" : "Try a 2nd modulus: both hashes would have to collide at once."}`,
            mathHtml: `h = ${fmt(h)} = h(p) → verify: ${real ? "equal ✓" : "different ✗ (collision)"}`, mcls: real ? "ok" : "warn" }));
        }
        if (s + m < n) {
          const out = T[s], inn = T[s + m], old = h;
          h = h.map((x, k) => { const M = mods[k]; return ((((x - v(out) * tops[k]) % M + M) % M) * b + v(inn)) % M; });
          fr.push(snap({ s, roll: true, line: [5, 6], note: `Roll to s = ${s + 1}: subtract ${q(out)}'s contribution ${v(out)}·${b}<sup>${m - 1}</sup>, shift everything up one place (×${b}) and add ${q(inn)} = ${v(inn)}. O(1) work, whatever m is.`, mathHtml: mods.map((M, k) => `((${old[k]} − ${v(out)}·${tops[k]})·${b} + ${v(inn)}) mod ${M} = <b>${h[k]}</b>`).join("<br>") }));
        }
      }
      fr.push(snap({ final: true, line: 2, note: `Done: ${found.length ? `matches at ${found.join(", ")}` : "no match"}${spurious.length ? `, plus <b>${spurious.length}</b> spurious hit${spurious.length > 1 ? "s" : ""} at ${spurious.join(", ")} that verification rejected` : ""}. ${checks} characters were compared in total. With a real modulus (≈10⁹) or two moduli, spurious hits become vanishingly rare, so the expected time is O(n + m).` }));
      return fr;
    },
    render: (f) => box(
      tape(f.n, [
        idxRow(f.n),
        { label: "text", cells: [...f.T], cls: (k) => {
          if (f.final) return f.found.some((s) => k >= s && k < s + f.m) ? "done" : "";
          if (f.s < 0) return "";
          if (f.roll && k === f.s) return "bad";
          if (f.roll && k === f.s + f.m) return "active";
          if (k >= f.s && k < f.s + f.m) return f.verify ? (f.real ? "done" : "bad") : "window";
          return "";
        } },
        f.s >= 0 && !f.final && !f.roll ? { label: "p", at: f.s, cells: [...f.P], cls: () => (f.verify ? (f.real ? "done" : "bad") : "") } : { label: "p", cells: [] },
        { label: "h(window)", kind: "n", cells: f.hs, cls: (k) => (f.found.includes(k) ? "done" : f.spurious.includes(k) ? "bad" : k === f.s ? "active" : "") },
      ], { w: Math.max(cellW(f.n), f.hs.some((x) => x.length > 3) ? 44 : f.hs.some((x) => x.length > 2) ? 34 : 0), min: f.hs.some((x) => x.length > 3) ? 40 : f.hs.some((x) => x.length > 2) ? 30 : 0 }),
      f.mathHtml ? math(f.mathHtml, f.mcls || "") : "",
      tally([["matches", f.found.length ? f.found.join(", ") : "–", f.found.length ? "ok" : ""], ["spurious hits", f.spurious.length, f.spurious.length ? "warn" : ""], ["chars verified", f.checks]]),
    ),
  }));

  /* 7. Prefix hashes: O(1) substring hash, so LCP and lexicographic order cost O(log n) by binary search. */
  Viz.register("string-algorithms-hash-lcp", (el) => Viz.player(el, {
    title: "Prefix hashes: compare any two substrings in O(log n)",
    tag: "O(n) BUILD · O(log n) PER QUERY",
    legend: [["path", "hash equal"], ["bad", "hash differs"], ["done", "LCP"], ["active", "first differing char"]],
    codeLang: "python",
    code: [
      "H[0] = 0; H[k+1] = (H[k]*B + v(s[k])) % M;  P[k] = B^k % M",
      "def get(a, L): return (H[a+L] - H[a] * P[L]) % M   # hash of s[a:a+L]",
      "lo, hi = 0, min(n - i, n - j)        # LCP is in [lo, hi]",
      "while lo < hi:",
      "    mid = (lo + hi + 1) // 2",
      "    if get(i, mid) == get(j, mid): lo = mid   # first mid chars equal",
      "    else: hi = mid - 1",
      "# then s[i+lo] vs s[j+lo] decides the order",
    ],
    inputs: [{ key: "s", label: "s (≤ 22 lowercase)", value: "abracadabracabra", width: 200 }, { key: "i", label: "i", value: "0", width: 40 }, { key: "j", label: "j", value: "7", width: 40 }],
    random: () => { const u = randStr(Viz.rand(3, 5), "abc"), s = (u + randStr(2, "abc") + u + randStr(3, "abc")).slice(0, 18); return { s, i: "0", j: String(u.length + 2) }; },
    build: ({ s, i, j }) => {
      const S = str(s, 2, 22), n = S.length, a = Viz.parse.int(i, { min: 0, max: 21 }), c = Viz.parse.int(j, { min: 0, max: 21 });
      if (a < 0 || c < 0 || a >= n || c >= n || a === c) throw new Error(`Use two different indices in 0..${n - 1}.`);
      const M = 1000000007n, B = 131n, H = [0n], Pw = [1n];
      for (let k = 0; k < n; k++) { H.push((H[k] * B + BigInt(S.charCodeAt(k) - 96)) % M); Pw.push((Pw[k] * B) % M); }
      const get = (x, L) => (((H[x + L] - H[x] * Pw[L]) % M) + M) % M;
      let lo = 0, hi = Math.min(n - a, n - c), steps = 0;
      const fr = [];
      const snap = (x) => ({ S, n, a, c, lo, hi, steps, ...x, vars: { lo, hi, mid: x.mid ?? "·", steps } });
      fr.push(snap({ line: [0, 1], note: `Precompute H[k] = hash of the prefix s[0..k) and P[k] = B<sup>k</sup> mod M (B = 131, M = 10⁹+7). Then the hash of <i>any</i> substring s[a..a+L) is H[a+L] − H[a]·B<sup>L</sup>: the prefix up to a+L minus the shorter prefix shifted up by L places. One subtraction, O(1).`, mathHtml: `get(a, L) = (H[a+L] − H[a]·P[L]) mod M` }));
      fr.push(snap({ line: 2, note: `Goal: the longest common prefix of s[${a}..] and s[${c}..]. Equal-length prefixes are equal exactly when they hash equal (with high probability), and "first L characters equal" is monotone in L, so binary search the LCP in [0, ${hi}].` }));
      while (lo < hi) {
        const mid = (lo + hi + 1) >> 1, h1 = get(a, mid), h2 = get(c, mid), eq = h1 === h2;
        steps++;
        fr.push(snap({ mid, eq, line: [4, 5, 6], note: `mid = ${mid}: hash(s[${a}..${a + mid})) = ${h1}, hash(s[${c}..${c + mid})) = ${h2}. ${eq ? `Equal, so the first ${mid} characters match: lo = ${mid}.` : `Different, so the LCP is shorter than ${mid}: hi = ${mid - 1}.`}`, mathHtml: `get(${a}, ${mid}) = ${h1}<br>get(${c}, ${mid}) = ${h2} → ${eq ? "equal" : "different"}`, mcls: eq ? "ok" : "bad" }));
        if (eq) lo = mid; else hi = mid - 1;
      }
      const x = S[a + lo], y = S[c + lo];
      const ord = x === undefined ? `s[${a}..] is a prefix of s[${c}..], so it is smaller` : y === undefined ? `s[${c}..] is a prefix of s[${a}..], so it is smaller` : x < y ? `${q(x)} &lt; ${q(y)}, so s[${a}..] &lt; s[${c}..]` : `${q(x)} &gt; ${q(y)}, so s[${a}..] &gt; s[${c}..]`;
      fr.push(snap({ final: true, line: 7, note: `LCP = <b>${lo}</b> after ${steps} hash comparisons instead of ${lo + 1} character comparisons. One more character comparison gives the lexicographic order: ${ord}. This O(log n) comparator lets you sort all suffixes in O(n log² n), and the same get() powers duplicate-substring searches and palindrome checks (compare against the hash of the reversed string).` }));
      return fr;
    },
    render: (f) => {
      const L = f.final ? f.lo : f.mid ?? 0, st = (k) => (f.final ? (k < f.lo ? "done" : k === f.lo ? "active" : "") : k < L ? (f.eq ? "path" : "bad") : "");
      return box(
        tape(f.n, [
          idxRow(f.n),
          { label: "s", cells: [...f.S], cls: (k) => (k >= f.a && k < f.a + L) || (k >= f.c && k < f.c + L) ? (f.final ? "done" : f.eq ? "path" : "bad") : "" },
          { label: `s[${f.a}..]`, cells: [...f.S.slice(f.a)], cls: st },
          { label: `s[${f.c}..]`, cells: [...f.S.slice(f.c)], cls: st },
        ]),
        f.mathHtml ? math(f.mathHtml, f.mcls || "") : "",
        tally([["search range", `[${f.lo}, ${f.hi}]`], ["hash comparisons", f.steps], ["LCP", f.final ? f.lo : "?", f.final ? "ok" : ""]]),
      );
    },
  }));

  /* 8. Manacher: palindromes of every center in O(n) by mirroring inside the rightmost palindrome. */
  Viz.register("string-algorithms-manacher", (el) => Viz.player(el, {
    title: "Manacher: mirror inside the rightmost palindrome, expand only past r",
    tag: "O(n)",
    legend: [["visit", "rightmost palindrome [2c−r, r]"], ["path", "radius copied from mirror"], ["done", "expanded (equal)"], ["bad", "mismatch"]],
    codeLang: "python",
    code: [
      "t = '#' + '#'.join(s) + '#'          # every palindrome now has odd length",
      "P = [0] * N; c = r = 0                # t[c-P[c] .. r] reaches furthest right",
      "for i in range(N):",
      "    if i < r:",
      "        P[i] = min(r - i, P[2*c - i])    # mirror around c",
      "    while i-P[i]-1 >= 0 and i+P[i]+1 < N and t[i-P[i]-1] == t[i+P[i]+1]:",
      "        P[i] += 1",
      "    if i + P[i] > r:",
      "        c, r = i, i + P[i]",
      "# P[i] = length of the palindrome in s centered at t[i]",
    ],
    inputs: [{ key: "s", label: "s (1–12 lowercase)", value: "abacabacd", width: 180 }],
    random: () => { const u = randStr(Viz.rand(2, 3), "ab"); return { s: (u + randStr(1, "abc") + [...u].reverse().join("") + randStr(Viz.rand(1, 4), "ab")).slice(0, 12) }; },
    build: ({ s }) => {
      const S = str(s, 1, 12), T = `#${[...S].join("#")}#`, N = T.length, Pv = Array(N).fill(null), fr = [];
      let c = 0, r = 0, comps = 0, best = 0;
      const snap = (x) => ({ S, T, N, P: Pv.slice(), c, r, comps, best, ...x, vars: { i: x.i ?? "·", c, r, "P[i]": x.pi ?? "·", comparisons: comps } });
      fr.push(snap({ line: 0, note: `Insert # between characters (and at both ends): ${qs(S)} becomes ${qs(T)}, length ${N}. Now every palindrome, odd or even in s, has odd length in t and a single center. P[i] is the radius around t[i]; it also equals the palindrome's length in s.` }));
      for (let i = 0; i < N; i++) {
        let p = 0, kase = "";
        const mir = 2 * c - i;
        if (i < r) {
          const pm = Pv[mir];
          p = Math.min(r - i, pm);
          kase = pm < r - i ? `<b>Case 1</b>: the mirror's palindrome lies strictly inside [${2 * c - r}, ${r}], so P[${i}] = P[${mir}] = ${pm} exactly. The expansion check below is bound to fail.`
            : pm > r - i ? `<b>Case 2</b>: the mirror's palindrome sticks out past the left edge, so only the part up to r is guaranteed: P[${i}] = r − i = ${r - i}. It cannot be longer either, or the palindrome at c would have extended past r.`
              : `<b>Case 3</b>: the mirror's palindrome touches the left edge exactly, so P[${i}] ≥ ${pm}, and we must compare beyond r.`;
          fr.push(snap({ i, mir, pi: p, copied: p, line: [3, 4], note: `i = ${i} is inside the rightmost palindrome (center c = ${c}, right edge r = ${r}). Its mirror is i' = 2c − i = ${mir}, where P[${mir}] = ${pm}. ${kase}` }));
        } else {
          fr.push(snap({ i, mir: -1, pi: 0, copied: 0, line: 3, note: `i = ${i} is at or beyond r = ${r}: nothing to mirror. Start with P[${i}] = 0.` }));
        }
        const copied = p;
        while (i - p - 1 >= 0 && i + p + 1 < N) {
          comps++;
          const ok = T[i - p - 1] === T[i + p + 1];
          fr.push(snap({ i, mir: i < r ? mir : -1, pi: ok ? p + 1 : p, copied, cl: i - p - 1, cr: i + p + 1, ok, line: [5, 6], note: `t[${i - p - 1}] = ${q(T[i - p - 1])} vs t[${i + p + 1}] = ${q(T[i + p + 1])}: ${ok ? "equal, radius grows." : `different, so P[${i}] = <b>${p}</b>.`}` }));
          if (!ok) break;
          p++;
        }
        Pv[i] = p;
        if (p > best) best = p;
        if (i + p > r) {
          c = i; r = i + p;
          fr.push(snap({ i, pi: p, copied, moved: true, line: [7, 8], note: `This palindrome reaches r = ${r}, further right than before, so it becomes the reference: c = ${c}, r = ${r}. r only moves right, which is what makes the total O(n).` }));
        }
      }
      const at = Pv.indexOf(best), lo = (at - best) / 2;
      fr.push(snap({ final: true, at, line: 9, note: `Done: P = [${Pv.join(", ")}]. The largest radius is ${best} at t[${at}], so the longest palindrome is <b>${qs(S.slice(lo, lo + best))}</b> starting at s[${lo}] (s-start = (i − P[i]) / 2). ${comps} comparisons for N = ${N}: each equal comparison pushes r right, so the total is O(N) = O(n). Summing ⌈P[i]/2⌉ over all i counts every palindromic substring.` }));
      return fr;
    },
    render: (f) => {
      const i = f.final ? f.at : f.i ?? -9, P = f.P, R = f.final ? P[f.at] : f.pi ?? 0;
      const sIdx = [...f.T].map((ch, k) => (k % 2 ? (k - 1) / 2 : ""));
      return box(
        tape(f.N, [
          idxRow(f.N),
          { label: "t", cells: [...f.T], cls: (k) => {
            const sep = k % 2 ? "" : "sep ";
            if (k === f.cl || k === f.cr) return sep + (f.ok ? "done" : "bad");
            if (i >= 0 && k >= i - R && k <= i + R) return sep + (f.final ? "done" : Math.abs(k - i) <= f.copied ? "path" : "done");
            if (!f.final && f.r > 0 && k >= 2 * f.c - f.r && k <= f.r) return `${sep}visit`;
            return sep.trim();
          } },
          ptrRow(f.N, f.final ? {} : { i: f.i, c: f.c, r: f.r, "i'": f.mir }),
          { label: "s index", kind: "i", cells: sIdx },
          { label: "P", kind: "n", cells: P.map((v) => (v === null ? "?" : v)), cls: (k) => (k === i ? "active" : k === f.mir && !f.final ? "path" : P[k] === null ? "blank" : "") },
        ]),
        tally([["comparisons", f.comps], ["N = 2n+1", f.N], ["longest", f.best, "ok"]]),
      );
    },
  }));

  /* Shared table helpers for the suffix-array visualizers. */
  const suf = (s, from, cls) => `<div class="sa-suf">${[...s.slice(from)].map((ch, k) => `<div class="sa-c ${cls(k) || ""}">${esc(ch)}</div>`).join("")}</div>`;
  const table = (heads, rows) => `<div class="sa-rows" style="grid-template-columns:repeat(${heads.length},max-content)">${heads.map((h) => `<div class="sa-h">${esc(h)}</div>`).join("")}${rows.map((r) => r.map(([h, c]) => `<div class="sa-k ${c || ""}">${h}</div>`).join("")).join("")}</div>`;
  const keyTxt = (a, b) => `(${a}, ${b < 0 ? "−1" : b})`;

  /* 9. Suffix array by prefix doubling: sort by the first 2k characters using ranks of length-k blocks. */
  Viz.register("string-algorithms-suffix-array", (el) => Viz.player(el, {
    title: "Suffix array by prefix doubling: a rank pair sorts twice as many characters",
    tag: "O(n log² n) · O(n log n) WITH RADIX",
    legend: [["visit", "characters already sorted by"], ["bad", "still tied"], ["done", "position final"], ["active", "rank of the second half"]],
    codeLang: "python",
    code: [
      "rank = [ord(c) for c in s]; k = 1      # rank by first character",
      "while True:",
      "    key = lambda i: (rank[i], rank[i + k] if i + k < n else -1)",
      "    sa = sorted(range(n), key=key)      # sorts by first 2k chars",
      "    new = [0] * n",
      "    for a, b in zip(sa, sa[1:]):",
      "        new[b] = new[a] + (key(a) != key(b))",
      "    rank = new",
      "    if rank[sa[-1]] == n - 1: break     # all distinct: done",
      "    k *= 2",
    ],
    inputs: [{ key: "s", label: "s (2–12 lowercase)", value: "banana", width: 160 }],
    random: () => ({ s: randStr(Viz.rand(6, 10), "aab") }),
    build: ({ s }) => {
      const S = str(s, 2, 12), n = S.length, fr = [];
      let rank = [...S].map((c) => c.charCodeAt(0) - 97), k = 1, sa = range(n).sort((a, b) => rank[a] - rank[b] || a - b), round = 0;
      const snap = (x) => ({ S, n, k, round, rank: rank.slice(), sa: sa.slice(), ...x, vars: { k, round, "distinct ranks": new Set(rank).size } });
      fr.push(snap({ view: "init", sorted: 1, line: 0, note: `The suffix array lists the starting positions of all ${n} suffixes in sorted order. Comparing whole suffixes costs O(n) each, so instead sort in rounds. Round 0: rank each suffix by its first character only (a = 0, b = 1, …). Equal first letters give equal ranks: those suffixes are still tied.` }));
      while (new Set(rank).size < n) {
        round++;
        const key = (i) => [rank[i], i + k < n ? rank[i + k] : -1];
        fr.push(snap({ view: "keys", key, sorted: k, line: 2, note: `Round ${round}, k = ${k}. The ranks already order the first ${k} character${k > 1 ? "s" : ""} of every suffix. The first ${2 * k} characters of suffix i are (first ${k} of i) followed by (first ${k} of i + ${k}), so the pair <b>(rank[i], rank[i+${k}])</b> orders them. A suffix too short to have a second half gets −1: shorter sorts first.` }));
        sa = range(n).sort((a, b) => key(a)[0] - key(b)[0] || key(a)[1] - key(b)[1] || a - b);
        const nr = Array(n).fill(0);
        for (let t = 1; t < n; t++) { const A = key(sa[t - 1]), Bk = key(sa[t]); nr[sa[t]] = nr[sa[t - 1]] + (A[0] !== Bk[0] || A[1] !== Bk[1] ? 1 : 0); }
        const prev = rank;
        rank = nr;
        const tied = new Set(sa.filter((i) => sa.some((j) => j !== i && rank[j] === rank[i])));
        fr.push(snap({ view: "sorted", key: (i) => [prev[i], i + k < n ? prev[i + k] : -1], sorted: 2 * k, tied, line: [3, 4, 5, 6, 7, 8], note: `Sort by the pairs, then give equal pairs equal new ranks. Suffixes are now ordered by their first ${2 * k} characters. ${tied.size ? `<b>${tied.size}</b> suffixes are still tied (red): they share their first ${2 * k} characters. Double k and repeat.` : "Every rank is different, so the order is final."}` }));
        k *= 2;
        if (round > 6) break;
      }
      fr.push(snap({ view: "final", sorted: n, line: 8, note: `Suffix array = [${sa.join(", ")}] after ${round} doubling round${round === 1 ? "" : "s"}. Each round at least doubles the sorted prefix length, so there are at most ⌈log₂ n⌉ rounds. A comparison sort makes the total O(n log² n); two passes of radix/counting sort on the pairs make it O(n log n).` }));
      return fr;
    },
    render: (f) => {
      const S = f.S, n = f.n, upto = Math.min(f.sorted, n);
      if (f.view === "keys") {
        return box(table(["i", "suffix s[i..]", "rank[i]", `rank[i+${f.k}]`, "key"], range(n).map((i) => {
          const [a, b] = f.key(i);
          return [[i], [suf(S, i, (c) => (c < f.k ? "visit" : c < 2 * f.k ? "path" : "")), ""], [a, "visit"], [b < 0 ? "−1" : b, "path"], [keyTxt(a, b), "active"]];
        })));
      }
      return box(table(["sorted pos", "i", `suffix (first ${Math.min(upto, n)} chars sorted)`, f.view === "sorted" ? "key" : "", "rank"], f.sa.map((i, pos) => {
        const tie = f.view === "init" ? f.sa.some((j) => j !== i && f.rank[j] === f.rank[i]) : f.tied ? f.tied.has(i) : false;
        const key = f.view === "sorted" ? keyTxt(...f.key(i)) : "";
        return [[pos], [i, f.view === "final" ? "done" : ""], [suf(S, i, (c) => (c < upto ? (f.view === "final" ? "done" : tie ? "bad" : "visit") : "")), ""], [key, key ? "active" : ""], [f.rank[i], f.view === "final" || !tie ? "done" : "bad"]];
      })), tally([["round", f.round], ["chars sorted", Math.min(upto, n)], ["distinct ranks", `${new Set(f.rank).size} / ${n}`, new Set(f.rank).size === n ? "ok" : ""]]));
    },
  }));

  /* 10. Kasai's LCP array: walk suffixes in text order; the carried h drops by at most one per step. */
  Viz.register("string-algorithms-lcp", (el) => Viz.player(el, {
    title: "Kasai LCP: neighbours in the suffix array, h never restarts from zero",
    tag: "O(n)",
    legend: [["active", "suffix i"], ["visit", "its predecessor in SA order"], ["path", "carried from previous step (free)"], ["done", "newly compared and equal"], ["bad", "first mismatch"]],
    codeLang: "python",
    code: [
      "rank = inverse of sa; lcp = [0] * n; h = 0",
      "for i in range(n):                   # suffixes in TEXT order",
      "    if rank[i] == 0: h = 0; continue  # smallest suffix has no predecessor",
      "    j = sa[rank[i] - 1]               # suffix just before it in sorted order",
      "    while i + h < n and j + h < n and s[i + h] == s[j + h]:",
      "        h += 1",
      "    lcp[rank[i]] = h                  # LCP with the previous suffix",
      "    if h: h -= 1                      # next suffix i+1 keeps ≥ h − 1",
    ],
    inputs: [{ key: "s", label: "s (2–12 lowercase)", value: "banana", width: 160 }],
    random: () => ({ s: randStr(Viz.rand(6, 11), "ab") + (Math.random() < 0.5 ? "c" : "") }),
    build: ({ s }) => {
      const S = str(s, 2, 12), n = S.length, sa = range(n).sort((a, b) => (S.slice(a) < S.slice(b) ? -1 : 1)), rank = Array(n), lcp = Array(n).fill(null), fr = [];
      sa.forEach((i, r) => { rank[i] = r; });
      lcp[0] = "–";
      let h = 0, comps = 0;
      const snap = (x) => ({ S, n, sa, lcp: lcp.slice(), comps, ...x, vars: { i: x.i ?? "·", h: x.h ?? h, comparisons: comps } });
      fr.push(snap({ line: 0, note: `lcp[r] = the longest common prefix of the suffixes at sorted positions r − 1 and r. Comparing every neighbour pair from scratch can cost O(n²). Kasai's trick: visit suffixes in <i>text</i> order i = 0, 1, 2, …, because removing the first character of a suffix (going from i to i+1) can shrink its LCP with its predecessor by at most 1.` }));
      for (let i = 0; i < n; i++) {
        if (rank[i] === 0) {
          h = 0;
          fr.push(snap({ i, ri: 0, h: 0, line: 2, note: `Suffix ${i} (${qs(S.slice(i))}) is the smallest suffix, so it has no predecessor. Reset h = 0.` }));
          continue;
        }
        const j = sa[rank[i] - 1], carried = h;
        fr.push(snap({ i, j, ri: rank[i], carried, h, line: [3], note: `Suffix ${i} = ${qs(S.slice(i))} sits at sorted position ${rank[i]}; its predecessor is suffix ${j} = ${qs(S.slice(j))}. ${carried ? `The first <b>${carried}</b> characters are already known to match (carried over), so comparison starts at offset ${carried}.` : "Nothing carried: compare from offset 0."}` }));
        let mism = false;
        while (i + h < n && j + h < n) { comps++; if (S[i + h] !== S[j + h]) { mism = true; break; } h++; }
        lcp[rank[i]] = h;
        fr.push(snap({ i, j, ri: rank[i], carried, h, mism, set: true, line: [4, 5, 6], note: `Compared ${h - carried + (mism ? 1 : 0)} new character${h - carried + (mism ? 1 : 0) === 1 ? "" : "s"}: lcp[${rank[i]}] = <b>${h}</b>${h ? ` (${qs(S.slice(i, i + h))})` : ""}. ${h ? `Next, suffix ${i + 1} is this suffix minus its first letter, and the suffix ${j + 1} still shares ${h - 1} characters with it and sorts before it, so h − 1 = ${h - 1} is carried.` : ""}` }));
        if (h) h--;
      }
      const sum = lcp.slice(1).reduce((a, b) => a + b, 0), mx = Math.max(0, ...lcp.slice(1)), at = lcp.indexOf(mx);
      fr.push(snap({ final: true, h: 0, sum, mx, at, line: 6, note: `LCP = [${lcp.join(", ")}] with ${comps} comparisons (h rises at most 2n times in total, so O(n)). Applications: <b>distinct substrings</b> = n(n+1)/2 − Σlcp = ${n * (n + 1) / 2} − ${sum} = <b>${n * (n + 1) / 2 - sum}</b>, because each suffix contributes its prefixes minus those shared with the previous suffix. <b>Longest repeated substring</b> = max lcp = ${mx}${mx ? `: ${qs(S.slice(sa[at], sa[at] + mx))}` : ""}.` }));
      return fr;
    },
    render: (f) => box(
      table(["rank", "sa", "suffix", "lcp"], f.sa.map((i, r) => {
        const me = r === f.ri && !f.final, pred = r === f.ri - 1 && !f.final && f.j !== undefined;
        const cls = (k) => {
          if (f.final) return r === f.at && k < f.mx ? "done" : "";
          if (!me && !pred) return "";
          if (k < f.carried) return "path";
          if (f.set && k < f.h) return "done";
          if (f.set && f.mism && k === f.h) return "bad";
          return me ? "active" : "visit";
        };
        return [[r], [i, me ? "active" : pred ? "visit" : ""], [suf(f.S, i, cls), ""], [f.lcp[r] === null ? "?" : f.lcp[r], f.final && r === f.at ? "done" : me && f.set ? "done" : ""]];
      })),
      tally(f.final ? [["Σ lcp", f.sum], ["distinct substrings", f.n * (f.n + 1) / 2 - f.sum, "ok"], ["longest repeat", f.mx, "ok"]] : [["h", f.h], ["comparisons", f.comps], ["bound 2n", 2 * f.n]]),
    ),
  }));

  /* 11. Aho–Corasick: a trie of all patterns plus failure links (longest proper suffix that is also in the trie). */
  Viz.register("string-algorithms-aho", (el) => Viz.player(el, {
    title: "Aho–Corasick: one pass over the text finds every pattern",
    tag: "O(Σ|p| + n + matches)",
    legend: [["active", "current state"], ["visit", "in BFS queue / being built"], ["path", "failure link followed"], ["done", "pattern ends here"], ["bad", "no edge for this char"]],
    codeLang: "python",
    code: [
      "for w in words: insert w into the trie, mark its end node",
      "queue = children of root (their fail = root)",
      "while queue:                          # BFS: shorter strings first",
      "    u = queue.popleft()",
      "    for c, v in u.children:",
      "        f = u.fail",
      "        while f is not root and c not in f.children: f = f.fail",
      "        v.fail = f.children.get(c, root)   # longest proper suffix in trie",
      "        v.out += v.fail.out; queue.append(v)",
      "state = root                          # search",
      "for ch in text:",
      "    while state is not root and ch not in state.children: state = state.fail",
      "    state = state.children.get(ch, root); report state.out",
    ],
    inputs: [{ key: "w", label: "patterns (comma separated)", value: "he,she,his,hers", width: 200 }, { key: "t", label: "text (≤ 18)", value: "ahishers", width: 140 }],
    random: () => { const pool = ["ab", "bab", "bc", "abc", "ca", "cab", "b", "aab"]; const w = [...new Set(Array.from({ length: Viz.rand(3, 4) }, () => pool[Viz.rand(0, pool.length - 1)]))]; return { w: w.join(","), t: randStr(Viz.rand(9, 14), "abc") }; },
    build: ({ w, t }) => {
      const words = [...new Set(String(w).split(",").map((x) => x.trim()).filter(Boolean))];
      if (!words.length || words.length > 6) throw new Error("Use 1–6 patterns.");
      words.forEach((x) => str(x, 1, 6));
      const T = str(t, 1, 18);
      const kids = new Map([["", new Map()]]), fail = new Map([["", ""]]), out = new Map([["", []]]), fr = [];
      const snap = (x) => ({ words, T, kids: new Map([...kids].map(([k, v]) => [k, [...v.values()]])), fail: new Map(fail), out: new Map([...out].map(([k, v]) => [k, v.slice()])), found: [], ...x });
      fr.push(snap({ phase: "trie", line: 0, note: `Patterns: ${words.map(qs).join(", ")}. Step 1 is an ordinary trie (see the Tries topic): each node is the string spelled on the path from the root (ε = empty). A double-ringed node ends a pattern.`, vars: { phase: "build trie" } }));
      for (const x of words) {
        let u = "";
        const made = [];
        for (const ch of x) {
          const v = u + ch;
          if (!kids.get(u).has(ch)) { kids.get(u).set(ch, v); kids.set(v, new Map()); out.set(v, []); made.push(v); }
          u = v;
        }
        out.get(u).push(x);
        if (kids.size > 18) throw new Error("Too many trie nodes to draw; use shorter or fewer patterns (≤ 18 nodes).");
        fr.push(snap({ phase: "trie", hl: new Set(made), cur: u, line: 0, note: `Insert ${qs(x)}: ${made.length ? `${made.length} new node${made.length > 1 ? "s" : ""} (blue)${made.length < x.length ? `, reusing the shared prefix ${qs(x.slice(0, x.length - made.length))}` : ""}` : "every node already exists"}. Mark ${qs(x)} as a pattern end.`, vars: { phase: "build trie", nodes: kids.size } }));
      }
      const queue = [...kids.get("").values()];
      queue.forEach((v) => fail.set(v, ""));
      fr.push(snap({ phase: "fail", queue: queue.slice(), line: 1, note: `Step 2: failure links. fail(v) = the <b>longest proper suffix of v that is also a node</b> of the trie: where to continue when the next character has no edge from v. The root's children are single letters, whose only proper suffix is ε, so they fail to the root. Links to the root are not drawn, to keep the picture clean.`, vars: { phase: "failure links", queue: queue.join(" ") || "∅" } }));
      while (queue.length) {
        const u = queue.shift();
        for (const [c, v] of kids.get(u)) {
          let f = fail.get(u);
          const hops = [f];
          while (f !== "" && !kids.get(f).has(c)) { f = fail.get(f); hops.push(f); }
          const fv = kids.get(f).has(c) && kids.get(f).get(c) !== v ? kids.get(f).get(c) : "";
          fail.set(v, fv);
          out.get(v).push(...out.get(fv));
          queue.push(v);
          fr.push(snap({ phase: "fail", cur: v, hops, edge: [v, fv], queue: queue.slice(), line: [4, 5, 6, 7, 8], note: `${qs(v)} = ${qs(u)} + ${q(c)}. Its longest proper suffix in the trie must be (a suffix of ${qs(u)} that is a node) + ${q(c)}. Try fail(${qs(u) || "ε"}) = ${hops.map((h) => qs(h) || "ε").join(" → ")}${f === "" && !kids.get("").has(c) ? "" : ""}: ${fv ? `${qs(f) || "ε"} has a ${q(c)} edge, so fail(${qs(v)}) = <b>${qs(fv)}</b>.` : `nothing ending in ${q(c)} except the whole string, so fail(${qs(v)}) = <b>root</b>.`}${out.get(fv).length ? ` ${qs(fv)} ends pattern(s) ${out.get(fv).map(qs).join(", ")}, so reaching ${qs(v)} also reports them (output link).` : ""}`, vars: { phase: "failure links", queue: queue.join(" ") || "∅" } }));
        }
      }
      let st = "";
      const found = [];
      fr.push(snap({ phase: "search", cur: "", ti: -1, line: 9, note: `Step 3: scan ${qs(T)} once. The state is always the <b>longest suffix of the text read so far that is a node</b> of the trie. Every pattern ending at the current position is a suffix of that state, so it is found through the state's output list.`, vars: { phase: "search", state: "ε" } }));
      for (let i = 0; i < T.length; i++) {
        const ch = T[i];
        while (st !== "" && !kids.get(st).has(ch)) {
          const f = fail.get(st);
          fr.push(snap({ phase: "search", cur: st, miss: true, edge: [st, f], ti: i, found: found.slice(), line: 11, note: `t[${i}] = ${q(ch)}: no ${q(ch)} edge from ${qs(st)}. Follow its failure link to ${qs(f) || "ε (root)"}, the next-longest suffix that is still in the trie. No text character is re-read.`, vars: { phase: "search", state: st || "ε" } }));
          st = f;
        }
        st = kids.get(st).get(ch) || "";
        const hits = out.get(st);
        hits.forEach((x) => found.push([i - x.length + 1, x]));
        fr.push(snap({ phase: "search", cur: st, ti: i, found: found.slice(), hit: hits.length > 0, line: 12, note: `t[${i}] = ${q(ch)} → state ${qs(st) || "ε (root)"}. ${hits.length ? `Report ${hits.map((x) => `${qs(x)} at ${i - x.length + 1}`).join(", ")}.` : "No pattern ends here."}`, vars: { phase: "search", state: st || "ε" } }));
      }
      fr.push(snap({ phase: "search", cur: st, ti: T.length, found: found.slice(), final: true, line: 10, note: `Done: ${found.length ? found.map(([p, x]) => `${qs(x)}@${p}`).join(", ") : "no matches"}. Each character moves down at most one edge, and each failure hop moves the state's depth up, so total hops ≤ n. Time: O(total pattern length + text length + number of matches), regardless of how many patterns there are.`, vars: { phase: "done", matches: found.length } }));
      return fr;
    },
    render: (f) => {
      const g = Viz.layoutTree("", (id) => [...(f.kids.get(id) || [])].sort(), (id) => (id ? id[id.length - 1] : "ε"), { dx: 52, dy: 70 });
      const showFail = f.phase !== "trie";
      g.nodes.forEach((n) => { n.sub = n.id ? n.id : undefined; });
      const hopSet = new Set(f.hops || []);
      g.edges = g.edges.map((e) => ({ ...e, directed: false, cls: "" }));
      if (showFail) for (const [v, fv] of f.fail) if (v && fv && (f.phase !== "fail" || f.fail.has(v))) g.edges.push({ u: v, v: fv, directed: true, cls: `sa-fail ${f.edge && f.edge[0] === v && f.edge[1] === fv ? "active" : ""}` });
      if (f.edge && f.edge[1] === "" && f.edge[0]) g.edges.push({ u: f.edge[0], v: "", directed: true, cls: "sa-fail active" });
      const html = Viz.graph(g, {
        nodeCls: (id) => {
          const c = [];
          if (f.out.get(id) && f.out.get(id).some((x) => x === id)) c.push("sa-accept");
          if (id === f.cur) c.push(f.miss ? "bad" : f.hit ? "done" : "active");
          else if (f.hl && f.hl.has(id)) c.push("visit");
          else if (hopSet.has(id) && id) c.push("path");
          else if (f.queue && f.queue.includes(id)) c.push("visit");
          return c.join(" ");
        },
      });
      const tapeHtml = f.phase === "search" ? tape(f.T.length, [idxRow(f.T.length), { label: "text", cells: [...f.T], cls: (k) => (k === f.ti ? (f.miss ? "bad" : "active") : k < f.ti ? "dim" : "") }]) : "";
      return box(tapeHtml, html, f.phase === "search" ? chips("matches", f.found.map(([p, x]) => [`${x} @ ${p}`, "done"])) : chips("patterns", f.words.map((x) => [x, ""])));
    },
  }));

  /* 12. A deterministic finite automaton for "valid number": one state per "what have I seen so far". */
  const DFA = { 0: { sign: 1, digit: 2, dot: 3 }, 1: { digit: 2, dot: 3 }, 2: { digit: 2, dot: 4, exp: 5 }, 3: { digit: 4 }, 4: { digit: 4, exp: 5 }, 5: { sign: 6, digit: 7 }, 6: { digit: 7 }, 7: { digit: 7 } };
  const DFA_ACCEPT = new Set([2, 4, 7]);
  const DFA_POS = { 0: [75, 105], 1: [0, 0], 3: [0, 210], 2: [205, 105], 4: [300, 210], 5: [395, 105], 6: [475, 0], 7: [555, 105] };
  const DFA_NAME = { 0: "start", 1: "sign", 2: "integer", 3: "lone dot", 4: "decimal", 5: "e seen", 6: "exp sign", 7: "exponent" };
  const charClass = (c) => (c >= "0" && c <= "9" ? "digit" : c === "+" || c === "-" ? "sign" : c === "." ? "dot" : c === "e" || c === "E" ? "exp" : "other");
  Viz.register("string-algorithms-dfa", (el) => Viz.player(el, {
    title: "Valid Number as a state machine: one table lookup per character",
    tag: "O(n) · O(1) SPACE",
    legend: [["active", "current state"], ["done", "accepting state reached"], ["bad", "dead: no transition"]],
    codeLang: "python",
    code: [
      "T = {0: {'sign': 1, 'digit': 2, 'dot': 3}, 1: {'digit': 2, 'dot': 3},",
      "     2: {'digit': 2, 'dot': 4, 'exp': 5}, 3: {'digit': 4},",
      "     4: {'digit': 4, 'exp': 5}, 5: {'sign': 6, 'digit': 7},",
      "     6: {'digit': 7}, 7: {'digit': 7}}",
      "state = 0",
      "for ch in s:",
      "    state = T[state].get(cls(ch))     # None = dead",
      "    if state is None: return False",
      "return state in (2, 4, 7)            # accepting states",
    ],
    inputs: [{ key: "s", label: "s (≤ 16 chars)", value: "-12.5e+3", width: 160 }],
    random: () => ({ s: ["+.8", "4.", "-90E3", "1e", "e3", ".", "99e2.5", "3.14", "--6", "6e-1", ".e1", "0089", "1.2.3", "-.5e7"][Viz.rand(0, 13)] }),
    build: ({ s }) => {
      const S = String(s);
      if (!S.length || S.length > 16) throw new Error("Use 1–16 characters.");
      const fr = [];
      let st = 0;
      fr.push({ S, st: 0, ti: -1, line: 4, vars: { state: "S0" }, note: `Each state remembers exactly what matters about the prefix read so far (${Object.entries(DFA_NAME).map(([k, v]) => `S${k} = ${v}`).join(", ")}). Accepting states (double ring) are S2, S4 and S7. Characters are grouped into classes: digit, sign (+/−), dot, exp (e/E) and other.` });
      for (let i = 0; i < S.length; i++) {
        const c = charClass(S[i]), nx = DFA[st][c];
        if (nx === undefined) {
          fr.push({ S, st, ti: i, dead: true, line: [6, 7], vars: { state: `S${st}`, class: c }, note: `${q(S[i])} is a <b>${c}</b>, and S${st} (${DFA_NAME[st]}) has no ${c} transition. ${c === "other" ? "That character never appears in a number." : st === 5 || st === 6 ? "An exponent needs at least one digit before anything else." : st === 3 ? "A lone dot must be followed by a digit." : `A ${c} cannot appear here.`} <b>Reject.</b>` });
          return fr;
        }
        fr.push({ S, st: nx, from: st, ti: i, line: 6, vars: { state: `S${nx}`, class: c }, note: `${q(S[i])} is a <b>${c}</b>: S${st} → S${nx} (${DFA_NAME[nx]}).` });
        st = nx;
      }
      const ok = DFA_ACCEPT.has(st);
      fr.push({ S, st, ti: S.length, final: true, ok, line: 8, vars: { state: `S${st}`, valid: ok }, note: `End of input in S${st} (${DFA_NAME[st]}). ${ok ? "It is an accepting state, so the string is a <b>valid number</b>." : `Not accepting: ${st === 0 ? "the string is empty of digits" : st === 1 ? "a sign with no digits" : st === 3 ? "a dot with no digits" : "the exponent has no digits"}. <b>Invalid.</b>`} Same answer as the regex ^[+-]?(\\d+\\.?\\d*|\\.\\d+)([eE][+-]?\\d+)?$, but the table makes every rule explicit and easy to extend.` });
      return fr;
    },
    render: (f) => {
      const nodes = Object.keys(DFA).map((k) => ({ id: k, x: DFA_POS[k][0], y: DFA_POS[k][1], label: `S${k}`, top: DFA_NAME[k], sub: DFA[k].digit === +k ? "↺ digit" : undefined }));
      const edges = [];
      for (const [u, tr] of Object.entries(DFA)) for (const [c, v] of Object.entries(tr)) if (String(v) !== u) edges.push({ u, v: String(v), w: c, cls: f.from !== undefined && String(f.from) === u && String(f.st) === String(v) ? "active" : "" });
      const g = Viz.graph({ nodes, edges }, { directed: true, nodeCls: (id) => `${DFA_ACCEPT.has(+id) ? "sa-accept " : ""}${+id === f.st ? (f.dead ? "bad" : f.final ? (f.ok ? "done" : "bad") : "active") : ""}` });
      const n = Math.max(1, f.S.length);
      return box(
        tape(n, [idxRow(n), { label: "s", cells: [...f.S], cls: (k) => (k === f.ti ? (f.dead ? "bad" : "active") : k < f.ti ? "done" : "") }]),
        g,
        f.final ? math(f.ok ? "valid number ✓" : "not a number ✗", f.ok ? "ok" : "bad") : f.dead ? math("dead state: reject ✗", "bad") : "",
      );
    },
  }));

  /* 13. Lexicographically smallest rotation in O(n): two candidate starts, eliminate a block on every mismatch. */
  Viz.register("string-algorithms-minrot", (el) => Viz.player(el, {
    title: "Minimum rotation: two candidates race, the loser loses a whole block",
    tag: "O(n)",
    legend: [["visit", "candidate i"], ["path", "candidate j"], ["done", "equal so far"], ["bad", "eliminated start"], ["active", "deciding comparison"]],
    codeLang: "python",
    code: [
      "i, j, k = 0, 1, 0                   # candidates i, j; k chars equal",
      "while i < n and j < n and k < n:",
      "    a, b = s[(i + k) % n], s[(j + k) % n]",
      "    if a == b: k += 1; continue",
      "    if a > b: i += k + 1             # starts i..i+k all lose",
      "    else:     j += k + 1             # starts j..j+k all lose",
      "    if i == j: j += 1",
      "    k = 0",
      "return min(i, j)",
    ],
    inputs: [{ key: "s", label: "s (2–12 lowercase)", value: "bcabcabca", width: 160 }],
    random: () => ({ s: randStr(Viz.rand(7, 11), "abb") }),
    build: ({ s }) => {
      const S = str(s, 2, 12), n = S.length, SS = S + S, gone = Array(n).fill(false), fr = [];
      let i = 0, j = 1, k = 0, comps = 0;
      const snap = (x) => ({ S, SS, n, i, j, k, gone: gone.slice(), comps, ...x, vars: { i, j, k, comparisons: comps } });
      fr.push(snap({ line: 0, note: `Rotations of s are the length-${n} windows of s + s. Compare the rotations starting at i and j character by character; k counts how many are equal so far. On a mismatch at offset k, the larger one loses, and so do the k starts right after it.` }));
      while (i < n && j < n && k < n) {
        const a = SS[i + k], b = SS[j + k];
        comps++;
        if (a === b) { fr.push(snap({ cmp: true, eq: true, line: [2, 3], note: `s[${(i + k) % n}] = s[${(j + k) % n}] = ${q(a)}: equal, so k becomes ${k + 1}.` })); k++; continue; }
        fr.push(snap({ cmp: true, line: 2, note: `${q(a)} vs ${q(b)} at offset ${k}: rotation ${a > b ? "i" : "j"} is larger.` }));
        const loser = a > b ? i : j, from = loser, to = loser + k;
        for (let t = from; t <= to && t < n; t++) gone[t] = true;
        if (a > b) i += k + 1; else j += k + 1;
        if (i === j) j++;
        fr.push(snap({ cut: [from, to], line: a > b ? [4, 6, 7] : [5, 6, 7], note: `Eliminate starts ${from}${to > from ? `…${Math.min(to, n - 1)}` : ""}. For each 0 ≤ d ≤ k, the rotation at ${loser}+d shares d…k−1 with the other candidate shifted by d, then hits the same larger character ${q(a > b ? a : b)}, so it can never be the minimum. Candidates are now i = ${i}, j = ${j}; reset k = 0.` }));
        k = 0;
      }
      const ans = Math.min(i, j);
      fr.push(snap({ final: true, ans, line: 8, note: `Done: the smallest rotation starts at <b>${ans}</b>: ${qs(SS.slice(ans, ans + n))}. ${comps} comparisons: each comparison either grows k or eliminates k + 1 starts, and i + j + k stays below 3n, so O(n). Use it as a canonical form: two strings are rotations of each other exactly when their minimum rotations are equal.` }));
      return fr;
    },
    render: (f) => {
      const N = 2 * f.n, ai = f.final ? f.ans : f.i, aj = f.final ? -9 : f.j;
      return box(
        tape(N, [
          idxRow(N),
          { label: "s + s", cells: [...f.SS], cls: (k) => (k < f.n && f.gone[k] && !(f.final && k === f.ans) ? "bad" : "") },
          { label: "starts", kind: "n", cells: range(f.n).map((k) => (f.final && k === f.ans ? "min" : f.gone[k] ? "✗" : "·")), cls: (k) => (f.final && k === f.ans ? "done" : f.cut && k >= f.cut[0] && k <= f.cut[1] ? "bad" : f.gone[k] ? "dim" : "") },
          ai < f.n ? { label: `rot i=${ai}`, at: ai, cells: [...f.SS.slice(ai, ai + f.n)], cls: (k) => (f.final ? "done" : k < f.k ? "done" : k === f.k && f.cmp ? (f.eq ? "done" : "active") : "visit") } : null,
          aj >= 0 && aj < f.n ? { label: `rot j=${aj}`, at: aj, cells: [...f.SS.slice(aj, aj + f.n)], cls: (k) => (k < f.k ? "done" : k === f.k && f.cmp ? (f.eq ? "done" : "active") : "path") } : null,
        ]),
        tally([["comparisons", f.comps], ["starts eliminated", f.gone.filter(Boolean).length], ["bound 3n", 3 * f.n]]),
      );
    },
  }));
})();
