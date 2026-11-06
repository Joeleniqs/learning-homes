/* Functional patterns visualizers. Every registered name is prefixed "functional-patterns-". */
(() => {
  const esc = Viz.esc;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) ?? esc(line);
  const STATES = new Set(["active", "visit", "done", "bad", "path", "accent"]);

  /* ---------- shared drawing helpers (inline SVG using the svg.dg vocabulary) ---------- */
  const svg = (w, h, body, label, cls = "") => `<svg class="dg fp-svg ${cls}" viewBox="0 0 ${w} ${h}" width="${w}" role="img" aria-label="${esc(label)}">${body}</svg>`;
  const box = (x, y, w, h, cls, title, sub, o = {}) => {
    let s = `<rect class="box ${cls || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="${o.rx ?? 8}"${o.dash ? ' stroke-dasharray="5 4"' : ""}/>`;
    const cx = x + w / 2;
    if (sub) {
      s += `<text class="fp-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 - 3}" text-anchor="middle">${esc(title)}</text>`;
      s += `<text class="fp-s" x="${cx}" y="${y + h / 2 + 12}" text-anchor="middle">${esc(sub)}</text>`;
    } else s += `<text class="fp-t ${o.mono ? "mono" : ""}" x="${cx}" y="${y + h / 2 + 4.5}" text-anchor="middle">${esc(title)}</text>`;
    return s;
  };
  const arrow = (x1, y1, x2, y2, cls = "", label = "", o = {}) => {
    const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
    const first = String(cls).split(" ")[0];
    const fill = STATES.has(first) ? "fill-" + first : "muted";
    const p = `${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`;
    let s = `<path class="edge ${cls}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${fill}" points="${p}"/>`;
    if (label) {
      const lx = o.lx ?? (x1 + x2) / 2, ly = o.ly ?? (y1 + y2) / 2 - 6;
      s += `<text class="small fp-lbl" x="${lx}" y="${ly}" text-anchor="${o.anchor || "middle"}">${esc(label)}</text>`;
    }
    return s;
  };
  const txt = (x, y, t, cls = "small", anchor = "start") => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${esc(t)}</text>`;
  const kv = (title, rows, o = {}) => `<div class="fp-kv ${o.cls || ""}"><div class="fp-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="fp-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="fp-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="fp-stats">${items.map(([l, v, c]) => `<div class="fp-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const codePanel = (lines, lang, cur = [], title = "") => `<div class="fp-codebox">${title ? `<div class="fp-kv-h">${esc(title)}</div>` : ""}<ol class="fp-code">${lines
    .map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""}">${hl(l, lang) || "&nbsp;"}</li>`).join("")}</ol></div>`;
  const col = (...parts) => `<div class="fp-col">${parts.join("")}</div>`;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const words = (s) => String(s).split(/[,;\n]+/).map((x) => x.trim()).filter(Boolean);
  const nums = (s, max = 14) => {
    const out = words(s).map((t) => { if (!/^-?\d{1,6}$/.test(t)) throw new Error(`"${t}" is not a whole number.`); return Number(t); });
    if (!out.length) throw new Error("Give at least one number.");
    if (out.length > max) throw new Error(`Use at most ${max} numbers.`);
    return out;
  };

  /* Tiny, safe expression language for lambdas: x, integers, + - * / %, comparisons, && ||, !, parentheses. */
  function parseLambda(src) {
    const s = String(src).trim();
    if (!s) throw new Error("Empty lambda.");
    if (s.length > 40) throw new Error("Keep each lambda under 40 characters.");
    const toks = s.match(/\s*(\d+|x|&&|\|\||[<>=!]=|[-+*/%()<>!])\s*/gy);
    if (!toks || toks.join("").length !== s.length) throw new Error(`Can't read "${s}". Use x, numbers, + - * / %, < > <= >= == !=, && || !, and ( ).`);
    const t = toks.map((x) => x.trim());
    let i = 0;
    const peek = () => t[i], eat = (v) => { if (t[i] !== v) throw new Error(`Expected "${v}" in "${s}".`); i++; };
    const prec = { "||": 1, "&&": 2, "==": 3, "!=": 3, "<": 4, ">": 4, "<=": 4, ">=": 4, "+": 5, "-": 5, "*": 6, "/": 6, "%": 6 };
    const atom = () => {
      const k = t[i++];
      if (k === undefined) throw new Error(`"${s}" ends too early.`);
      if (k === "(") { const e = expr(0); eat(")"); return e; }
      if (k === "-") { const a = atom(); return (x) => -a(x); }
      if (k === "!") { const a = atom(); return (x) => (a(x) ? 0 : 1); }
      if (k === "x") return (x) => x;
      if (/^\d+$/.test(k)) { const n = Number(k); return () => n; }
      throw new Error(`Unexpected "${k}" in "${s}".`);
    };
    const expr = (min) => {
      let l = atom();
      while (peek() in prec && prec[peek()] > min) {
        const op = t[i++], r = expr(prec[op]), a = l;
        l = {
          "+": (x) => a(x) + r(x), "-": (x) => a(x) - r(x), "*": (x) => a(x) * r(x),
          "/": (x) => { const d = r(x); if (d === 0) throw new Error("Division by zero inside a lambda."); return Math.trunc(a(x) / d); },
          "%": (x) => { const d = r(x); if (d === 0) throw new Error("Modulo by zero inside a lambda."); return a(x) % d; },
          "<": (x) => +(a(x) < r(x)), ">": (x) => +(a(x) > r(x)), "<=": (x) => +(a(x) <= r(x)), ">=": (x) => +(a(x) >= r(x)),
          "==": (x) => +(a(x) === r(x)), "!=": (x) => +(a(x) !== r(x)),
          "&&": (x) => +(a(x) && r(x)), "||": (x) => +(a(x) || r(x)),
        }[op];
      }
      return l;
    };
    const f = expr(0);
    if (i !== t.length) throw new Error(`Unexpected "${t[i]}" in "${s}".`);
    return (x) => { const v = f(x); if (!Number.isFinite(v) || Math.abs(v) > 1e12) throw new Error("A value grew too large."); return v; };
  }

  /* =====================================================================
   * 1. Purity: same input, same output? Memoize and see what breaks.
   * ===================================================================== */
  const PURE_FNS = {
    "pure: price(q) = q × 2.5": { pure: true, code: ["static decimal Price(int q) => q * 2.5m;", "", "// output depends only on q", "// no reads or writes outside"], hidden: [] },
    "reads a global: price(q) = q × Rate": { code: ["static decimal Rate = 2.5m;   // mutable global", "static decimal Price(int q) => q * Rate;", "", "// rate=4 elsewhere changes every answer"], hidden: ["reads Rate"] },
    "hidden state: ticket(q) = q × 10 + ++issued": { code: ["static int issued;", "static int Ticket(int q) => q * 10 + ++issued;", "", "// reads AND writes hidden state"], hidden: ["reads issued", "writes issued"] },
    "refactored: price(q, rate) = q × rate": { pure: true, explicit: true, code: ["static decimal Price(int q, decimal rate)", "    => q * rate;", "", "// the caller passes the rate in:", "Price(q, config.Rate);   // now a pure function"], hidden: [] },
  };
  Viz.register("functional-patterns-purity", (el) => Viz.player(el, {
    title: "Purity: can you replace a call with its result?",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "same as the memoized answer"], ["bad", "memo would return a wrong answer"], ["active", "current call"], ["path", "hidden input or output"]],
    inputs: [
      { key: "fn", label: "function", type: "select", options: Object.keys(PURE_FNS), value: "reads a global: price(q) = q × Rate" },
      { key: "calls", label: "calls (rate=N changes the global)", value: "2, 3, 2, rate=4, 2, 3", width: 300 },
    ],
    random: () => ({ fn: pick(Object.keys(PURE_FNS)), calls: pick(["2, 2, 2", "1, 2, rate=3, 1, 2", "5, rate=2, 5, rate=1, 5", "4, 4, rate=6, 4"]) }),
    build: ({ fn, calls }) => {
      const F = PURE_FNS[fn];
      const ops = words(calls);
      if (!ops.length || ops.length > 10) throw new Error("Use 1 to 10 calls.");
      let rate = 2.5, issued = 0;
      const memo = new Map(), log = [], fr = [];
      const snap = (o) => ({ fn, log: log.map((r) => ({ ...r })), rate, issued, memo: [...memo], ...o });
      fr.push(snap({ line: [1], note: F.pure ? "A pure function: its result depends only on its arguments, and it changes nothing else. Watch the memo column: caching a pure function is always safe." : `This function has <b>hidden inputs or outputs</b> (${F.hidden.join(", ")}). Its signature lies: <code>Price(int)</code> doesn't say it also depends on a global.` }));
      for (const op of ops) {
        const m = op.match(/^rate\s*=\s*(\d{1,3}(?:\.\d{1,2})?)$/i);
        if (m) {
          rate = Number(m[1]);
          fr.push(snap({ line: [0], hiddenHot: true, note: `Somewhere else in the program: <code>Rate = ${rate}</code>. ${F.pure ? (F.explicit ? "The pure version doesn't read it; the <i>caller</i> will pass the new rate as an argument, so it becomes part of the memo key." : "The pure function doesn't read it, so nothing changes.") : fn.startsWith("reads") ? "Every future call to Price now answers differently for the same q." : "Ticket doesn't read the rate, but it has its own hidden state."}` }));
          continue;
        }
        if (!/^\d{1,3}$/.test(op)) throw new Error(`"${op}": use a quantity (0–999) or rate=N.`);
        const q = Number(op);
        let out, key = String(q);
        if (fn.startsWith("pure")) out = q * 2.5;
        else if (fn.startsWith("reads")) out = q * rate;
        else if (fn.startsWith("hidden")) out = q * 10 + ++issued;
        else { out = q * rate; key = `${q}, ${rate}`; }
        const call = F.explicit ? `price(${q}, ${rate})` : `${fn.startsWith("hidden") ? "ticket" : "price"}(${q})`;
        const had = memo.has(key), cached = memo.get(key);
        if (!had) memo.set(key, out);
        const ok = !had || cached === out;
        log.push({ call, out, memo: had ? cached : "(miss)", cls: ok ? "done" : "bad" });
        fr.push(snap({ cur: log.length - 1, line: [1], hiddenHot: !F.pure, note: had
          ? (ok ? `<code>${call}</code> = ${out}. The memo already holds ${cached} for key (${esc(key)}): <b>identical</b>, so the call could be replaced by its value.` : `<code>${call}</code> = ${out}, but the memo holds <b>${cached}</b> for the same arguments. A cache, a compiler optimisation, a retry or a test that assumed "same input, same output" would all be <b>wrong</b>.`)
          : `<code>${call}</code> = ${out}. First time with key (${esc(key)}): store it in the memo.` }));
      }
      const bad = log.filter((r) => r.cls === "bad").length;
      fr.push(snap({ end: true, line: [], note: bad ? `<b>${bad} call(s)</b> returned something different from an earlier call with the same arguments: the function is <b>not referentially transparent</b>. Fix it by making the hidden input a parameter (try the "refactored" option).` : `Every repeated call matched the memo. ${F.pure ? "Pure functions can be cached, reordered, run in parallel and tested without setup." : "This run happened to be consistent, but nothing guarantees it: the hidden state could change at any time."}` }));
      return fr;
    },
    render: (f) => {
      const F = PURE_FNS[f.fn];
      let b = box(250, 70, 200, 56, f.cur !== undefined ? "active" : "accent", f.fn.split(":")[1].trim().split(" =")[0], F.pure ? "pure" : "impure", { mono: true });
      b += arrow(70, 98, 246, 98, "", F.explicit ? "q, rate" : "q", { ly: 90 });
      b += arrow(454, 98, 630, 98, "", "result", { ly: 90 });
      b += txt(20, 102, "args", "small muted");
      b += txt(640, 102, "out", "small muted");
      if (F.hidden.some((h) => h.startsWith("reads"))) {
        b += box(110, 160, 130, 40, f.hiddenHot ? "path" : "", f.fn.startsWith("hidden") ? `issued = ${f.issued}` : `Rate = ${f.rate}`, "", { mono: true, dash: true });
        b += arrow(220, 160, 280, 130, "path", "hidden input", { lx: 268, ly: 156, anchor: "start" });
      } else if (F.explicit) b += txt(250, 150, `caller passes rate = ${f.rate}`, "small muted");
      if (F.hidden.some((h) => h.startsWith("writes"))) {
        b += box(470, 160, 130, 40, "path", "issued++", "", { mono: true, dash: true });
        b += arrow(420, 130, 480, 160, "path", "side effect", { lx: 482, ly: 148, anchor: "start" });
      }
      const rows = f.log.map((r, i) => `<tr class="${i === f.cur ? "cur" : ""}"><td>${esc(r.call)}</td><td>${esc(Viz.fmt(r.out))}</td><td class="${r.memo === "(miss)" ? "" : r.cls === "bad" ? "no" : "ok"}">${esc(Viz.fmt(r.memo))}</td></tr>`).join("");
      const tbl = `<table class="fp-tbl"><tr><th>call</th><th>actual</th><th>memo says</th></tr>${rows || '<tr><td colspan="3">no calls yet</td></tr>'}</table>`;
      return col(svg(690, 215, b, "Function with its inputs and outputs"), `<div class="fp-scroll">${tbl}</div>`, codePanel(F.code, "csharp", f.line, "C#"));
    },
  }));

  /* =====================================================================
   * 2. map / filter / reduce: data flowing through a pipeline
   * ===================================================================== */
  function parseStages(src) {
    const parts = String(src).split("|").map((x) => x.trim()).filter(Boolean);
    if (!parts.length || parts.length > 5) throw new Error("Use 1 to 5 stages separated by |.");
    return parts.map((p, i) => {
      let m;
      if ((m = p.match(/^(filter|where)\s+(.+)$/i))) return { k: "filter", label: `filter ${m[2]}`, f: parseLambda(m[2]) };
      if ((m = p.match(/^(map|select)\s+(.+)$/i))) return { k: "map", label: `map ${m[2]}`, f: parseLambda(m[2]) };
      if ((m = p.match(/^(take|limit)\s+(\d{1,2})$/i))) return { k: "take", label: `take ${m[2]}`, n: Number(m[2]) };
      if ((m = p.match(/^(reduce|fold)\s+(\+|\*|max|min|count)$/i))) {
        if (i !== parts.length - 1) throw new Error("reduce must be the last stage.");
        const op = m[2].toLowerCase();
        const seed = { "+": 0, "*": 1, max: null, min: null, count: 0 }[op];
        const f = { "+": (a, x) => a + x, "*": (a, x) => a * x, max: (a, x) => (a === null ? x : Math.max(a, x)), min: (a, x) => (a === null ? x : Math.min(a, x)), count: (a) => a + 1 }[op];
        return { k: "reduce", label: `reduce ${op}`, seed, f };
      }
      throw new Error(`"${p}": use filter <expr>, map <expr>, take N or reduce +|*|max|min|count.`);
    });
  }
  Viz.register("functional-patterns-pipeline", (el) => Viz.player(el, {
    title: "map, filter, reduce: one value at a time, or one stage at a time",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "being processed"], ["done", "passed this stage"], ["bad", "filtered out"], ["dim", "never computed"]],
    inputs: [
      { key: "data", label: "source", value: "3, 8, 1, 6, 9, 4, 7, 2", width: 200 },
      { key: "stages", label: "stages (separated by |)", value: "filter x % 2 == 0 | map x * x | take 2 | reduce +", width: 360 },
      { key: "mode", label: "evaluation", type: "select", options: ["eager: stage by stage (arrays)", "lazy: element by element (fused)"], value: "eager: stage by stage (arrays)" },
    ],
    random: () => ({ data: Viz.randInts(Viz.rand(5, 9), 1, 12).join(", "), stages: pick(["filter x % 2 == 0 | map x * x | take 2 | reduce +", "map x * 3 | filter x > 10 | reduce count", "filter x > 4 | map x - 4 | reduce max", "map x * x | filter x % 3 == 0 | take 1", "filter x % 2 == 1 | map x + 1 | reduce *"]) }),
    build: ({ data, stages, mode }) => {
      const src = nums(data, 12), st = parseStages(stages), lazy = mode.startsWith("lazy");
      const cols = st.map(() => []), fr = [];
      let calls = 0, arrays = 0, pulled = 0, acc = null, accSet = false;
      const red = st[st.length - 1].k === "reduce" ? st[st.length - 1] : null;
      if (red) { acc = red.seed; accSet = true; }
      const snap = (o) => ({ src, st: st.map((s) => s.label), cols: cols.map((c) => c.map((x) => ({ ...x }))), calls, arrays, pulled, acc: accSet ? acc : undefined, lazy, ...o });
      fr.push(snap({ note: lazy ? "Lazy (LINQ, Java Streams, generators): nothing runs until the end of the pipeline asks for a value. Then <b>one element travels through every stage</b> before the next is read." : "Eager (JavaScript arrays, Python lists): <b>each stage runs over the whole input</b> and allocates a new array before the next stage starts." }));
      if (!lazy) {
        let cur = src.slice();
        pulled = src.length;
        for (let s = 0; s < st.length; s++) {
          const S = st[s], next = [];
          for (let i = 0; i < cur.length; i++) {
            const x = cur[i];
            if (S.k === "take") { if (next.length >= S.n) { cols[s].push({ v: x, c: "dim" }); continue; } next.push(x); cols[s].push({ v: x, c: "done" }); fr.push(snap({ s, i, note: `take ${S.n}: keep ${x} (${next.length} of ${S.n}).` })); continue; }
            if (S.k === "reduce") { const before = acc; acc = S.f(acc, x); calls++; cols[s].push({ v: acc, c: "done" }); fr.push(snap({ s, i, note: `reduce: acc = f(${Viz.fmt(before)}, ${x}) = <b>${Viz.fmt(acc)}</b>.` })); continue; }
            calls++;
            const r = S.f(x);
            if (S.k === "filter") { if (r) next.push(x); cols[s].push({ v: x, c: r ? "done" : "bad" }); fr.push(snap({ s, i, note: `${esc(S.label)}: ${x} → ${r ? "keep" : "<b>drop</b>"}.` })); }
            else { next.push(r); cols[s].push({ v: r, c: "done", from: x }); fr.push(snap({ s, i, note: `${esc(S.label)}: ${x} → <b>${r}</b>.` })); }
          }
          if (S.k === "take" && cur.length > S.n) fr.push(snap({ s, note: `take ${S.n} stopped keeping values, but every earlier stage <b>already processed all ${cur.length}</b> inputs. Eager pipelines can't stop early.` }));
          if (S.k !== "reduce") { arrays++; cur = next; fr.push(snap({ s, note: `Stage done: a new array of ${next.length} is allocated (${arrays} intermediate array${arrays > 1 ? "s" : ""} so far).` })); }
        }
        pulled = src.length;
      } else {
        const taken = st.map(() => 0);
        let stop = false;
        for (let i = 0; i < src.length && !stop; i++) {
          let x = src[i]; pulled++;
          fr.push(snap({ s: -1, i, note: `Pull element ${i + 1} from the source: <b>${x}</b>.` }));
          let alive = true;
          for (let s = 0; s < st.length && alive; s++) {
            const S = st[s];
            if (S.k === "take") { taken[s]++; cols[s].push({ v: x, c: "done" }); fr.push(snap({ s, i, note: `take ${S.n}: ${taken[s]} of ${S.n}.` })); if (taken[s] >= S.n) stop = true; continue; }
            if (S.k === "reduce") { const before = acc; acc = S.f(acc, x); calls++; cols[s].push({ v: acc, c: "done" }); fr.push(snap({ s, i, note: `reduce: acc = f(${Viz.fmt(before)}, ${x}) = <b>${Viz.fmt(acc)}</b>.` })); continue; }
            calls++;
            const r = S.f(x);
            if (S.k === "filter") { cols[s].push({ v: x, c: r ? "done" : "bad" }); fr.push(snap({ s, i, note: `${esc(S.label)}: ${x} → ${r ? "keep, pass it on" : "<b>drop</b>; go back and pull the next one"}.` })); if (!r) alive = false; }
            else { cols[s].push({ v: r, c: "done", from: x }); fr.push(snap({ s, i, note: `${esc(S.label)}: ${x} → <b>${r}</b>.` })); x = r; }
          }
          if (stop && i < src.length - 1) fr.push(snap({ note: `take is satisfied, so <b>the source is never asked again</b>: ${src.length - pulled} element(s) are never read or computed.` }));
        }
      }
      const last = st[st.length - 1];
      const result = red ? Viz.fmt(acc) : `[${(cols[st.length - 1] || []).filter((c) => c.c === "done").map((c) => c.v).join(", ")}]`;
      fr.push(snap({ end: true, note: `Result: <b>${esc(result)}</b>. ${calls} lambda calls, ${arrays} intermediate array(s), ${pulled} of ${src.length} source elements read. ${lazy ? "Same answer as eager, less work when something downstream stops early." : last.k === "reduce" || st.some((s) => s.k === "take") ? "Switch to lazy and compare the work." : ""}` }));
      return fr;
    },
    render: (f) => {
      const head = (t, on) => `<div class="fp-pcol-h ${on ? "on" : ""}">${esc(t)}</div>`;
      const cell = (x, cls, on) => `<div class="fp-cell ${cls} ${on ? "cur" : ""}">${esc(Viz.fmt(x.v ?? x))}${x.from !== undefined ? `<small>${esc(x.from)}→</small>` : ""}</div>`;
      const srcCol = `<div class="fp-pcol">${head("source", f.s === -1)}${f.src.map((v, i) => cell({ v }, f.lazy && i >= f.pulled ? "dim" : "", f.i === i && (f.s === -1 || f.s === 0))).join("")}</div>`;
      const cols = f.st.map((t, s) => `<div class="fp-pcol">${head(t, f.s === s)}${f.cols[s].map((x, k) => cell(x, x.c, f.s === s && k === f.cols[s].length - 1)).join("") || '<div class="fp-cell empty">·</div>'}</div>`);
      const flow = `<div class="fp-pipe">${[srcCol, ...cols].join('<div class="fp-pipe-arrow">→</div>')}</div>`;
      return col(flow, stats([["lambda calls", f.calls], ["intermediate arrays", f.arrays, f.arrays ? "warn" : ""], ["source reads", `${f.pulled}/${f.src.length}`], ...(f.acc !== undefined ? [["accumulator", Viz.fmt(f.acc), "ok"]] : [])]));
    },
  }));

  /* =====================================================================
   * 3. Persistent data structures: path copying keeps old versions alive
   * ===================================================================== */
  Viz.register("functional-patterns-sharing", (el) => Viz.player(el, {
    title: "Immutable updates without copying everything: structural sharing",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "new node"], ["path", "copied on the path"], ["done", "shared with the old version"], ["dim", "old version's path (still valid)"]],
    inputs: [
      { key: "keys", label: "initial tree", value: "50, 30, 70, 20, 40, 60, 80, 35", width: 240 },
      { key: "ins", label: "then insert", value: "45, 65", width: 120 },
    ],
    random: () => { const k = [...new Set(Viz.randInts(8, 1, 99))]; return { keys: k.join(", "), ins: [...new Set(Viz.randInts(2, 1, 99))].filter((x) => !k.includes(x)).join(", ") || "42" }; },
    build: ({ keys, ins }) => {
      const K = nums(keys, 15), I = nums(ins, 4);
      if (new Set(K).size !== K.length) throw new Error("Initial keys must be distinct.");
      const nodes = new Map(); let nid = 0;
      const mk = (k, l, r, ver) => { const n = { id: `n${nid++}`, k, l, r, ver }; nodes.set(n.id, n); return n.id; };
      const insertMut = (rootId, k) => { if (!rootId) return mk(k, null, null, 0); let n = nodes.get(rootId); for (;;) { const side = k < n.k ? "l" : "r"; if (!n[side]) { n[side] = mk(k, null, null, 0); return rootId; } n = nodes.get(n[side]); } };
      let root = null;
      K.forEach((k) => { root = insertMut(root, k); });
      const size = (id) => (id ? 1 + size(nodes.get(id).l) + size(nodes.get(id).r) : 0);
      const fr = [];
      const snapNodes = () => new Map([...nodes].map(([k, v]) => [k, { ...v }]));
      fr.push({ nodes: snapNodes(), root, hl: {}, ver: 0, alloc: 0, total: size(root), note: `Version 0: an immutable binary search tree of ${size(root)} nodes. Nobody may change a node once it exists. So how do you insert?` });
      let ver = 0;
      for (const k of I) {
        if (K.includes(k)) throw new Error(`${k} is already in the tree; insert new keys.`);
        ver++;
        const path = []; let id = root;
        while (id) { path.push(id); const n = nodes.get(id); id = k < n.k ? n.l : n.r; }
        const hl = {};
        path.forEach((p, d) => {
          hl[p] = "visit";
          const n = nodes.get(p), dir = k < n.k ? "left" : "right", other = k < n.k ? n.r : n.l;
          fr.push({ nodes: snapNodes(), root, hl: { ...hl, [p]: "active" }, ver: ver - 1, alloc: d, total: size(root), note: `Insert ${k}: ${k} ${k < n.k ? "<" : ">"} ${n.k}, go ${dir}. Node ${n.k} must change (one child pointer), so it will be <b>copied</b>. ${other ? `Its other subtree (rooted at ${nodes.get(other).k}) will be <b>shared</b>, not copied.` : ""}` });
        });
        const leaf = mk(k, null, null, ver);
        let child = leaf;
        const copies = [];
        for (let d = path.length - 1; d >= 0; d--) {
          const o = nodes.get(path[d]);
          child = k < o.k ? mk(o.k, child, o.r, ver) : mk(o.k, o.l, child, ver);
          copies.push(child);
        }
        const oldRoot = root; root = child;
        const nh = { [leaf]: "active" }; copies.forEach((c) => { nh[c] = "path"; });
        const walk = (x) => { if (!x) return; if (!nh[x]) nh[x] = "done"; walk(nodes.get(x).l); walk(nodes.get(x).r); };
        walk(root);
        const alloc = copies.length + 1, tot = size(root);
        fr.push({ nodes: snapNodes(), root, hl: nh, old: { root: oldRoot, path }, ver, alloc, total: tot, note: `Version ${ver}: <b>${alloc} new nodes</b> (the copied path plus the new leaf). The other ${tot - alloc} nodes are <b>shared</b> with version ${ver - 1}. Version ${ver - 1}'s root (left, dashed) is untouched and still valid: any thread holding it sees the old tree, with no locks.` });
      }
      const n = size(root);
      fr.push({ nodes: snapNodes(), root, hl: {}, ver, alloc: 0, total: n, end: true, note: `Each insert copied about log₂(n) nodes instead of all n. This is how ImmutableList / ImmutableDictionary (.NET), Clojure and Scala collections, Immer (JS) and pyrsistent work. The trade: more allocation and pointer chasing than a mutable array, in exchange for free snapshots, undo and thread safety.` });
      return fr;
    },
    render: (f) => {
      const N = f.nodes;
      const t = Viz.layoutTree(f.root, (id) => { const n = N.get(id); return [n.l, n.r]; }, (id) => String(N.get(id).k), { dx: 44, dy: 58 });
      const nodes = t.nodes.map((n) => ({ ...n })), edges = t.edges.map((e) => ({ ...e, cls: f.hl[e.v] === "path" || f.hl[e.v] === "active" ? "path" : "" }));
      if (f.old) {
        const minX = Math.min(...nodes.map((n) => n.x));
        f.old.path.forEach((p, d) => {
          nodes.push({ id: p, x: minX - 70, y: d * 58, label: String(N.get(p).k), top: d === 0 ? `v${f.ver - 1}` : undefined });
          const n = N.get(p), next = f.old.path[d + 1];
          [n.l, n.r].forEach((c) => { if (c && c !== next) edges.push({ u: p, v: c, cls: "dash" }); });
          if (next) edges.push({ u: p, v: next, cls: "dash" });
        });
        const r = nodes.find((n) => n.id === f.root); if (r) r.top = `v${f.ver}`;
      }
      const g = Viz.graph({ nodes, edges }, { r: 17, nodeCls: (id) => (f.old && f.old.path.includes(id) ? "dim" : f.hl[id] || ""), label: f.old ? `versions ${f.ver - 1} and ${f.ver}, sharing nodes` : `version ${f.ver}` });
      return col(g, stats([["nodes in this version", f.total], ["allocated by this insert", f.alloc, f.alloc ? "warn" : ""], ["a full copy would allocate", f.alloc ? f.total : "–"]]));
    },
  }));

  /* =====================================================================
   * 4. Closures: the loop-variable capture bug, per language
   * ===================================================================== */
  const CLOS = {
    "C# for (int i…)": { lang: "csharp", shared: true, end: (n) => n, code: ["var fs = new List<Func<int>>();", "for (int i = 0; i < 3; i++)", "    fs.Add(() => i);      // captures THE i", "foreach (var f in fs) Console.Write(f());"], why: "A C# <code>for</code> loop declares <b>one</b> <code>i</code> for the whole loop. Every lambda captures that same variable (not its value), and after the loop it holds the exit value." },
    "C# foreach (C# 5+)": { lang: "csharp", shared: false, code: ["var fs = new List<Func<int>>();", "foreach (var i in Enumerable.Range(0, 3))", "    fs.Add(() => i);      // fresh i per pass", "foreach (var f in fs) Console.Write(f());"], why: "Since C# 5, the <code>foreach</code> variable is a <b>fresh variable per iteration</b>. The same code with <code>for</code> still shares one variable." },
    "Java (effectively final)": { lang: "java", shared: false, java: true, code: ["List<Supplier<Integer>> fs = new ArrayList<>();", "for (int i = 0; i < 3; i++) {", "    int j = i;   // copy: effectively final", "    fs.add(() -> j); }", "fs.forEach(f -> System.out.print(f.get()));"], why: "Java refuses to compile <code>() -> i</code> here: lambdas may only capture <b>effectively final</b> locals. You are forced to copy into <code>j</code>, so each lambda gets its own value. Java turned the bug into a compile error." },
    "Python (late binding)": { lang: "python", shared: true, end: (n) => n - 1, code: ["fs = []", "for i in range(3):", "    fs.append(lambda: i)  # looks i up LATER", "print([f() for f in fs])"], why: "Python closures look names up <b>when they run</b>, not when they're created. The loop has one <code>i</code> in the enclosing scope, and after <code>range(3)</code> finishes it is 2." },
    "Python (i=i default)": { lang: "python", shared: false, code: ["fs = []", "for i in range(3):", "    fs.append(lambda i=i: i)  # bound now", "print([f() for f in fs])"], why: "Default arguments are evaluated <b>when the lambda is defined</b>, so <code>i=i</code> snapshots the current value. <code>functools.partial</code> does the same thing more readably." },
    "Go before 1.22": { lang: "go", shared: true, end: (n) => n, code: ["var fs []func() int", "for i := 0; i < 3; i++ {", "    fs = append(fs, func() int { return i })", "}", "for _, f := range fs { fmt.Print(f()) }"], why: "Before Go 1.22 the loop variable was <b>one variable per loop</b>. This bit goroutines constantly: <code>go func(){ use(i) }()</code> inside a loop saw whatever i was when the goroutine got scheduled." },
    "Go 1.22+": { lang: "go", shared: false, code: ["var fs []func() int", "for i := 0; i < 3; i++ {  // go.mod: go 1.22", "    fs = append(fs, func() int { return i })", "}", "for _, f := range fs { fmt.Print(f()) }"], why: "Go 1.22 changed the language: each iteration now gets <b>its own</b> <code>i</code> (in modules declaring go ≥ 1.22). Old code that relied on <code>i := i</code> keeps working." },
    "JavaScript var": { lang: "typescript", shared: true, end: (n) => n, code: ["var fs = [];", "for (var i = 0; i < 3; i++)", "  fs.push(() => i);       // var: function-scoped", "console.log(fs.map(f => f()));"], why: "<code>var</code> is function-scoped: there is <b>one</b> <code>i</code> for the whole function. The classic <code>setTimeout</code>-in-a-loop interview question." },
    "JavaScript let": { lang: "typescript", shared: false, code: ["const fs = [];", "for (let i = 0; i < 3; i++)", "  fs.push(() => i);       // let: per iteration", "console.log(fs.map(f => f()));"], why: "<code>let</code> in a <code>for</code> header creates a <b>new binding per iteration</b>, copied forward before the increment. This is why linters ban <code>var</code>." },
  };
  Viz.register("functional-patterns-closure", (el) => Viz.player(el, {
    title: "Closures capture variables, not values: the loop bug",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["accent", "variable (a storage cell)"], ["active", "closure being created or called"], ["bad", "surprising output"], ["done", "expected output"]],
    inputs: [
      { key: "lang", label: "language and loop", type: "select", options: Object.keys(CLOS), value: "C# for (int i…)" },
      { key: "n", label: "iterations", type: "select", options: ["2", "3", "4"], value: "3" },
    ],
    random: () => ({ lang: pick(Object.keys(CLOS)) }),
    build: ({ lang, n }) => {
      const L = CLOS[lang], N = Number(n), fr = [];
      const cells = [], clos = [], out = [];
      const snap = (o) => ({ lang, N, cells: cells.map((c) => ({ ...c })), clos: clos.map((c) => ({ ...c })), out: out.slice(), ...o });
      const loopLine = L.code.findIndex((l) => /for\s*\(|for i|for i :=|foreach \(var i/.test(l));
      const addLine = L.code.findIndex((l) => /fs\.(Add|add|push|append)\(|append\(fs/.test(l));
      if (L.java) fr.push(snap({ line: [], err: true, note: "First attempt, <code>fs.add(() -> i)</code>: <b>compile error</b> — <i>local variables referenced from a lambda expression must be final or effectively final</i>. The fix the compiler forces on you:" }));
      if (L.shared) cells.push({ name: "i", v: 0 });
      for (let k = 0; k < N; k++) {
        if (L.shared) cells[0].v = k;
        else cells.push({ name: L.java ? `j (pass ${k})` : `i (pass ${k})`, v: k });
        fr.push(snap({ line: [loopLine], hot: L.shared ? 0 : k, note: L.shared ? `Iteration ${k}: the single variable <code>i</code> now holds ${k}.` : `Iteration ${k}: a <b>new</b> variable is created holding ${k}.` }));
        clos.push({ to: L.shared ? 0 : k });
        fr.push(snap({ line: [addLine], hot: L.shared ? 0 : k, newC: k, note: `Create closure f${k}. It stores a <b>reference to the variable</b>${L.shared ? " <code>i</code> (the same one every time)" : ` of pass ${k}`}, not a copy of the number ${k}.` }));
      }
      if (L.shared) {
        cells[0].v = L.end(N);
        fr.push(snap({ line: [loopLine], hot: 0, note: `The loop ends. ${lang.startsWith("Python") ? `Python leaves <code>i</code> at the last value it was given: ${cells[0].v}.` : `The condition failed when <code>i</code> reached ${cells[0].v}, and that is the value left in the shared variable.`}` }));
      }
      const callLine = L.code.length - 1;
      for (let k = 0; k < N; k++) {
        const v = L.shared ? cells[0].v : cells[k].v;
        out.push({ v, ok: v === k });
        fr.push(snap({ line: [callLine], call: k, hot: L.shared ? 0 : k, note: `Call f${k}(): read the variable it captured → <b>${v}</b>${v === k ? "" : ` (you probably wanted ${k})`}.` }));
      }
      fr.push(snap({ end: true, line: [], note: L.why }));
      return fr;
    },
    render: (f) => {
      const L = CLOS[f.lang], W = Math.max(520, 150 * f.N + 80), shared = L.shared;
      let b = txt(10, 22, "variables (storage cells)", "small muted") + txt(10, 152, "closures", "small muted");
      f.cells.forEach((c, i) => {
        const x = shared ? W / 2 - 60 : 30 + i * 150;
        b += box(x, 34, 120, 52, f.hot === i ? "accent" : "", `${c.name} = ${c.v}`, shared ? "one shared cell" : "own cell", { mono: true });
      });
      f.clos.forEach((c, k) => {
        const x = 30 + k * 150, cx = x + 60, tx = shared ? W / 2 : 30 + c.to * 150 + 60;
        const st = f.call === k ? "active" : f.newC === k ? "active" : f.out[k] ? (f.out[k].ok ? "done" : "bad") : "";
        b += box(x, 164, 120, 46, st, `f${k}`, f.out[k] ? `→ ${f.out[k].v}` : "() => i", { mono: true });
        b += arrow(cx, 164, tx + (shared ? (k - (f.N - 1) / 2) * 18 : 0), 90, f.call === k ? "active" : "", "");
      });
      const outs = f.out.length ? `output: ${f.out.map((o) => `<b class="${o.ok ? "fp-ok" : "fp-no"}">${o.v}</b>`).join(" ")}` : "output: (nothing yet)";
      const errBox = f.err ? `<div class="fp-err">error: local variables referenced from a lambda expression must be final or effectively final</div>` : "";
      return col(svg(W, 222, b, "Variables and the closures that capture them"), `<div class="fp-out">${outs}</div>`, errBox, codePanel(L.code, L.lang, f.line, f.lang));
    },
  }));

  /* =====================================================================
   * 5. Currying, partial application, compose vs pipe
   * ===================================================================== */
  const parseFns = (src) => {
    const parts = words(src);
    if (!parts.length || parts.length > 5) throw new Error("Use 1 to 5 functions separated by commas.");
    return parts.map((p) => {
      let m;
      if ((m = p.match(/^(add|sub|mul|div)\s+(-?\d{1,3})$/i))) {
        const op = m[1].toLowerCase(), a = Number(m[2]);
        if (op === "div" && a === 0) throw new Error("div 0 would divide by zero.");
        const f = { add: (x) => x + a, sub: (x) => x - a, mul: (x) => x * a, div: (x) => Math.trunc(x / a) }[op];
        const sym = { add: "+", sub: "−", mul: "×", div: "÷" }[op];
        return { name: `${op}(${a})`, f, env: `${op === "sub" || op === "div" ? "b" : "a"} = ${a}`, show: (x) => `${x} ${sym} ${a}`, curried: true };
      }
      if (/^square$/i.test(p)) return { name: "square", f: (x) => x * x, show: (x) => `${x}²` };
      if (/^neg(ate)?$/i.test(p)) return { name: "negate", f: (x) => -x, show: (x) => `−(${x})` };
      if (/^abs$/i.test(p)) return { name: "abs", f: (x) => Math.abs(x), show: (x) => `|${x}|` };
      throw new Error(`"${p}": use add N, sub N, mul N, div N, square, negate or abs.`);
    });
  };
  Viz.register("functional-patterns-compose", (el) => Viz.player(el, {
    title: "Partial application and composition: building functions from functions",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["accent", "function value (closure)"], ["active", "running now"], ["done", "already applied"]],
    inputs: [
      { key: "fns", label: "functions (as written)", value: "add 3, mul 2, square", width: 220 },
      { key: "x", label: "x", value: "4", width: 60 },
      { key: "mode", label: "combine with", type: "select", options: ["pipe (left → right)", "compose (right → left)"], value: "pipe (left → right)" },
    ],
    random: () => ({ fns: pick(["add 3, mul 2, square", "square, sub 1, mul 10", "negate, add 7, abs", "mul 3, div 2, add 1"]), x: String(Viz.rand(-5, 9)), mode: pick(["pipe (left → right)", "compose (right → left)"]) }),
    build: ({ fns, x, mode }) => {
      const F = parseFns(fns), pipe = mode.startsWith("pipe");
      if (!/^-?\d{1,4}$/.test(String(x).trim())) throw new Error("x must be a whole number.");
      const order = pipe ? F.map((_, i) => i) : F.map((_, i) => F.length - 1 - i);
      const fr = [], vals = [];
      const nm = F.map((g) => g.name);
      const expr = pipe ? `pipe(${nm.join(", ")})` : `compose(${nm.join(", ")})`;
      const nested = order.reduce((acc, i) => `${nm[i]}(${acc})`, "x");
      const snap = (o) => ({ F: F.map((g) => ({ name: g.name, env: g.env })), order, vals: vals.slice(), pipe, expr, nested, x0: Number(x), ...o });
      const cur = F.filter((g) => g.curried);
      fr.push(snap({ stage: "curry", note: cur.length ? `Each <code>${cur[0].name}</code> is <b>partial application</b>: <code>const add = a => b => a + b</code>, so <code>add(3)</code> returns a <i>new function</i> that remembers <code>a = 3</code> in its closure and waits for <code>b</code>. No numbers have flowed yet; we only built function values.` : "Each name is already a one-argument function. Nothing has run yet: we only have function values." }));
      fr.push(snap({ stage: "build", note: `<code>${esc(expr)}</code> returns <b>one new function</b>. ${pipe ? "pipe applies them in reading order: left to right, like a Unix pipe, F#'s <code>|></code> or a LINQ chain." : "compose follows maths: <code>(f ∘ g)(x) = f(g(x))</code>, so the <b>rightmost</b> function runs first. Same functions, opposite order."} It's equivalent to <code>${esc(nested)}</code>.` }));
      let v = Number(x);
      vals.push(v);
      fr.push(snap({ stage: "run", step: -1, note: `Call the composed function with x = ${v}.` }));
      order.forEach((i, k) => {
        const before = v; v = F[i].f(v);
        if (!Number.isFinite(v) || Math.abs(v) > 1e12) throw new Error("The value grew too large.");
        vals.push(v);
        fr.push(snap({ stage: "run", step: k, note: `${k + 1}. <code>${F[i].name}</code>: ${esc(F[i].show(before))} = <b>${v}</b>.` }));
      });
      let other = Number(x); [...order].reverse().forEach((i) => { other = F[i].f(other); });
      fr.push(snap({ stage: "run", end: true, step: order.length - 1, note: `Result <b>${v}</b>. With ${pipe ? "compose" : "pipe"} the same list would give <b>${other}</b>${other === v ? " (the same here, but only by coincidence: composition is not commutative)" : ""}. Order is part of the meaning.` }));
      return fr;
    },
    render: (f) => {
      const n = f.order.length, W = 100 + n * 150 + 60;
      let b = "";
      const xs = (k) => 90 + k * 150;
      b += box(10, 60, 60, 44, f.stage === "run" ? "done" : "", "x", f.stage === "run" ? String(f.x0) : "?", { mono: true });
      f.order.forEach((i, k) => {
        const g = f.F[i], st = f.stage !== "run" ? "accent" : k === f.step ? "active" : k < f.step || f.end ? "done" : "";
        b += box(xs(k) + 20, 56, 110, 52, st, g.name, g.env ? `closure: ${g.env}` : "pure fn", { mono: true });
        b += arrow(k === 0 ? 70 : xs(k) - 20, 82, xs(k) + 18, 82, st === "done" || st === "active" ? "active" : "", f.vals[k] !== undefined && f.stage === "run" && k <= f.step + 1 ? String(f.vals[k]) : "", { ly: 74 });
      });
      const last = xs(n) - 20;
      b += arrow(last, 82, last + 40, 82, f.end ? "active" : "", f.end ? String(f.vals[n]) : "", { ly: 74 });
      b += txt(W / 2, 138, f.stage === "curry" ? "function values, not yet combined" : f.expr, "small mono", "middle");
      b += txt(W / 2, 30, f.pipe ? "data flows left → right (pipe)" : "written f, g, h  ⇒  runs h, then g, then f (compose)", "small muted", "middle");
      return col(svg(W, 150, b, "Composed functions"));
    },
  }));

  /* =====================================================================
   * 6. Railway-oriented programming: Result and bind
   * ===================================================================== */
  const PRICE = 12;
  Viz.register("functional-patterns-railway", (el) => Viz.player(el, {
    title: "Railway-oriented programming: Result, bind and the error track",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "Ok track"], ["bad", "Error track"], ["active", "running"], ["dim", "bypassed"]],
    inputs: [
      { key: "email", label: "email", value: "joel@example.com", width: 150 },
      { key: "qty", label: "qty", value: "3", width: 50 },
      { key: "stock", label: "stock", value: "5", width: 50 },
      { key: "bal", label: "balance", value: "100", width: 60 },
      { key: "mode", label: "mode", type: "select", options: ["bind: fail fast", "validate all, then bind"], value: "bind: fail fast" },
    ],
    random: () => ({ email: pick(["joel@example.com", "joel.example.com", "a@b.io", "@nope"]), qty: pick(["3", "0", "two", "7", "1"]), stock: pick(["5", "2", "10"]), bal: pick(["100", "20", "50"]), mode: pick(["bind: fail fast", "validate all, then bind"]) }),
    build: ({ email, qty, stock, bal, mode }) => {
      const acc = mode.startsWith("validate");
      if (!/^\d{1,4}$/.test(String(stock).trim()) || !/^\d{1,6}$/.test(String(bal).trim())) throw new Error("stock and balance must be whole numbers.");
      const S = Number(stock), B = Number(bal);
      const steps = [
        { name: "validateEmail", indep: true, run: () => (/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/i.test(email.trim()) ? { ok: email.trim() } : { err: `email: "${email}" is not an address` }) },
        { name: "parseQty", indep: true, run: () => { const t = String(qty).trim(); if (!/^\d{1,3}$/.test(t)) return { err: `qty: "${t}" is not a number` }; const q = Number(t); return q < 1 || q > 99 ? { err: "qty: must be 1–99" } : { ok: q }; } },
        { name: "reserveStock", run: (q) => (q <= S ? { ok: `${q} reserved` } : { err: `stock: only ${S} left` }) },
        { name: "charge", run: (q) => (q * PRICE <= B ? { ok: `paid ${q * PRICE}` } : { err: `payment: needs ${q * PRICE}, balance ${B}` }) },
        { name: "toReceipt", map: true, run: (q) => ({ ok: `receipt: ${q} × ${PRICE} = ${q * PRICE}` }) },
      ];
      const st = steps.map(() => "idle"), vals = steps.map(() => ""), fr = [];
      let errors = [];
      const snap = (o) => ({ names: steps.map((s) => s.name), maps: steps.map((s) => !!s.map), st: st.slice(), vals: vals.slice(), errors: errors.slice(), acc, ...o });
      fr.push(snap({ note: acc ? "Independent checks (email, qty) don't need each other's output, so run them <b>all</b> and collect every error (an <i>applicative</i> validation). Steps that depend on earlier output still chain with bind." : "Each step returns <code>Result&lt;T, Error&gt;</code>. <code>bind</code> (a.k.a. flatMap, then, <code>and_then</code>) runs the next step only on the Ok track; once on the Error track, everything after is <b>bypassed</b>. No ifs, no try/catch in the happy path." }));
      let q = null, failed = false;
      for (let i = 0; i < steps.length; i++) {
        const s = steps[i];
        if (failed && !(acc && s.indep)) { st[i] = "dim"; fr.push(snap({ cur: i, note: `<code>${s.name}</code> is <b>bypassed</b>: we're on the Error track, so bind just passes the error along.` })); continue; }
        st[i] = "active"; fr.push(snap({ cur: i, note: `Run <code>${s.name}</code>${s.map ? " (a plain function lifted with <code>map</code>: it can't fail)" : ""}.` }));
        const r = s.run(q);
        if (r.err) { st[i] = "bad"; vals[i] = r.err; errors.push(r.err); failed = true; fr.push(snap({ cur: i, note: `<code>${s.name}</code> returns <b>Error</b>("${esc(r.err)}"). Switch to the error track.${acc && s.indep ? " In validate-all mode we keep checking the other independent inputs." : ""}` })); }
        else { st[i] = "done"; vals[i] = String(r.ok); if (i === 1) q = r.ok; fr.push(snap({ cur: i, note: `<code>${s.name}</code> returns <b>Ok</b>(${esc(String(r.ok))}).` })); }
        if (acc && i === 1 && failed) {
          fr.push(snap({ cur: i, note: `Validation finished with <b>${errors.length} error(s)</b>; the user sees them all at once in one form round-trip. The dependent steps can't run without a valid qty, so they're bypassed.` }));
        }
      }
      fr.push(snap({ end: true, note: failed ? `Final value: <b>Error</b>${errors.length > 1 ? `s [${errors.map(esc).join("; ")}]` : `("${esc(errors[0])}")`}. The caller handles failure <b>once</b>, at the end of the track.${!acc && errors.length === 1 ? " Fail-fast reports only the first problem: try 'validate all' with a bad email and a bad qty." : ""}` : `Final value: <b>Ok</b>(${esc(vals[4])}). Every step stayed on the happy track.` }));
      return fr;
    },
    render: (f) => {
      const n = f.names.length, W = 40 + n * 148, yOk = 70, yErr = 190;
      let b = `<path class="edge done" d="M10,${yOk} L${W - 10},${yOk}"/><path class="edge bad" d="M10,${yErr} L${W - 10},${yErr}"/>`;
      b += txt(12, yOk - 34, "Ok track", "small fill-done") + txt(12, yErr + 24, "Error track", "small fill-bad");
      f.names.forEach((nm, i) => {
        const x = 30 + i * 148, cls = f.st[i] === "idle" ? "" : f.st[i];
        b += box(x, yOk - 24, 124, 48, cls, nm, f.maps[i] ? "map (can't fail)" : "bind", { mono: true });
        if (f.vals[i]) {
          const lines = f.vals[i].length > 22 ? [f.vals[i].slice(0, 22), f.vals[i].slice(22, 44)] : [f.vals[i]];
          lines.forEach((ln, k) => { b += txt(x + 62, (f.st[i] === "bad" ? yErr + 22 : yOk + 42) + k * 13, ln, `small ${f.st[i] === "bad" ? "fill-bad" : "muted"}`, "middle"); });
        }
        if (f.st[i] === "bad") b += arrow(x + 62, yOk + 24, x + 62, yErr - 4, "bad", "");
        if (f.st[i] === "dim") b += txt(x + 62, yErr - 8, "bypassed", "small muted", "middle");
      });
      return col(svg(W, 240, b, "Two-track railway"), f.errors.length ? kv("errors collected", f.errors.map((e, i) => [String(i + 1), e, "no"])) : "");
    },
  }));

  /* =====================================================================
   * 7. Pattern matching over a discriminated union: order and exhaustiveness
   * ===================================================================== */
  const PAY_VALUES = {
    "Card(amount: 20)": { kind: "Card", amount: 20 },
    "Card(amount: 5000)": { kind: "Card", amount: 5000 },
    "PayPal(email)": { kind: "PayPal" },
    "BankTransfer(iban)": { kind: "BankTransfer" },
    "Crypto(wallet)": { kind: "Crypto" },
  };
  const ARMS = {
    big: { pat: "Card c when c.Amount > 1000", test: (v) => v.kind === "Card" && v.amount > 1000, out: "manual review" },
    card: { pat: "Card c", test: (v) => v.kind === "Card", out: "charge card" },
    paypal: { pat: "PayPal p", test: (v) => v.kind === "PayPal", out: "redirect to PayPal" },
    bank: { pat: "BankTransfer b", test: (v) => v.kind === "BankTransfer", out: "show IBAN" },
    crypto: { pat: "Crypto w", test: (v) => v.kind === "Crypto", out: "open wallet" },
  };
  Viz.register("functional-patterns-match", (el) => Viz.player(el, {
    title: "Pattern matching: arms run in order, and the compiler checks the cases",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "testing this arm"], ["done", "matched"], ["dim", "didn't match"], ["bad", "unreachable or missing"]],
    inputs: [
      { key: "val", label: "value", type: "select", options: Object.keys(PAY_VALUES), value: "Card(amount: 5000)" },
      { key: "order", label: "arm order", type: "select", options: ["specific first (guarded Card before Card)", "general first (Card before guarded Card)"], value: "general first (Card before guarded Card)" },
      { key: "crypto", label: "handle Crypto?", type: "select", options: ["yes", "no (case forgotten)"], value: "yes" },
    ],
    random: () => ({ val: pick(Object.keys(PAY_VALUES)), order: pick(["specific first (guarded Card before Card)", "general first (Card before guarded Card)"]), crypto: pick(["yes", "no (case forgotten)"]) }),
    build: ({ val, order, crypto }) => {
      const v = PAY_VALUES[val], spec = order.startsWith("specific"), hasC = crypto === "yes";
      const keys = [...(spec ? ["big", "card"] : ["card", "big"]), "paypal", "bank", ...(hasC ? ["crypto"] : [])];
      const unreachable = spec ? -1 : 1;
      const st = keys.map(() => ""), fr = [];
      const diag = [];
      if (!spec) diag.push(["unreachable", "the guarded Card arm can never match: Card c already caught every Card"]);
      if (!hasC) diag.push(["missing", "Crypto is a valid PaymentMethod with no arm"]);
      const snap = (o) => ({ keys, st: st.slice(), val, unreachable, hasC, spec, diag, ...o });
      fr.push(snap({ note: `<code>PaymentMethod</code> is a closed set: Card | PayPal | BankTransfer | Crypto. The switch tests arms <b>top to bottom</b> and runs the first that matches. Value: <code>${esc(val)}</code>.` }));
      let hit = -1;
      for (let i = 0; i < keys.length; i++) {
        st[i] = "active";
        const ok = ARMS[keys[i]].test(v);
        fr.push(snap({ cur: i, note: `Arm ${i + 1}: does <code>${esc(ARMS[keys[i]].pat)}</code> match? ${ok ? "<b>Yes.</b>" : "No."}${!spec && i === 0 && ok && v.amount > 1000 ? " The big payment is caught here, so it is charged <b>without the review</b> the next arm was meant to force." : ""}` }));
        st[i] = ok ? "done" : "dim";
        if (ok) { hit = i; break; }
      }
      fr.push(snap({ end: true, hit, note: hit >= 0 ? `Result: <b>${ARMS[keys[hit]].out}</b>.${!spec && v.kind === "Card" && v.amount > 1000 ? " Wrong: a 5000 payment skipped review. Put specific arms before general ones, and let the compiler flag dominated arms." : ""}` : `<b>No arm matched.</b> What happens now depends on the language: see the table. ${v.kind === "Crypto" ? "This is the bug exhaustiveness checking exists to prevent." : ""}` }));
      return fr;
    },
    render: (f) => {
      const rows = f.keys.map((k, i) => {
        const bad = i === f.unreachable;
        return `<div class="fp-arm ${f.st[i]} ${bad ? "unreach" : ""}"><code>${esc(ARMS[k].pat)}</code><span>⇒ ${esc(ARMS[k].out)}</span>${bad ? '<em>unreachable</em>' : ""}</div>`;
      });
      if (!f.hasC) rows.push(`<div class="fp-arm missing"><code>Crypto w</code><span>(no arm)</span><em>missing</em></div>`);
      const arms = `<div class="fp-arms"><div class="fp-kv-h">switch (payment) — value: ${esc(f.val)}</div>${rows.join("")}</div>`;
      const un = !f.spec, miss = !f.hasC;
      const L = [
        ["C# switch expr", un ? "error CS8510: pattern already handled" : "ok", miss ? "warning CS8509 not exhaustive*; throws SwitchExpressionException" : "ok*"],
        ["Java 21 sealed", un ? "error: label is dominated by a preceding case" : "ok", miss ? "error: switch does not cover all input values" : "ok"],
        ["TypeScript", un ? "no error (guards are just ifs)" : "ok", miss ? "error with assertNever: Crypto not assignable to never" : "ok"],
        ["Python match", un ? "no error; pyright may hint" : "ok", miss ? "silently returns None; pyright errors with assert_never" : "ok"],
        ["Go type switch", un ? "n/a: guard is an if inside case Card" : "ok", miss ? "falls to default (or does nothing); linters only check enums" : "ok"],
      ];
      const tbl = `<table class="fp-tbl"><tr><th>language</th><th>dominated arm</th><th>missing case</th></tr>${L.map(([l, a, b]) => `<tr><td>${l}</td><td class="${a === "ok" ? "ok" : a.startsWith("error") || a.startsWith("n/a") ? "ok" : "no"}">${esc(a)}</td><td class="${b.startsWith("ok") ? "ok" : b.startsWith("error") ? "ok" : "no"}">${esc(b)}</td></tr>`).join("")}</table>`;
      const note = '<div class="fp-foot">Green = the mistake is caught (or there is none). Red = it reaches production. *C# cannot prove a class hierarchy is closed, so it warns (CS8509) whenever there is no <code>_ =&gt;</code> discard arm. Teams add one, and that discard then hides a genuinely missing case.</div>';
      return col(arms, `<div class="fp-scroll">${tbl}${note}</div>`);
    },
  }));

  /* =====================================================================
   * 8. Lazy sequences: enumerate twice, per language
   * ===================================================================== */
  const LAZY = {
    "C# IEnumerable (LINQ)": { lang: "csharp", beh: "rerun", lazy: ["var active = db.Users().Where(u => u.Active);", "if (active.Any())               // query #1", "    foreach (var u in active)   // query #2!", "        Send(u);"], eager: ["var active = db.Users().Where(u => u.Active)", "                .ToList();       // runs once", "if (active.Count > 0)", "    foreach (var u in active) Send(u);"] },
    "Java Stream": { lang: "java", beh: "throw", lazy: ["var active = users().filter(User::active);", "if (active.findAny().isPresent())", "    active.forEach(this::send);  // throws!", ""], eager: ["var active = users().filter(User::active)", "                   .toList();    // Java 16+", "if (!active.isEmpty())", "    active.forEach(this::send);"] },
    "Python generator": { lang: "python", beh: "empty", lazy: ["active = (u for u in users() if u.active)", "if any(active):            # consumes items", "    for u in active:       # resumes or empty", "        send(u)"], eager: ["active = [u for u in users() if u.active]", "# a list: iterate as often as you like", "if active:", "    for u in active: send(u)"] },
    "TypeScript generator": { lang: "typescript", beh: "empty", lazy: ["const active = filter(users(), u => u.active);", "if (!active.next().done)   // consumes one", "  for (const u of active)   // the rest only", "    send(u);"], eager: ["const active = [...users()]", "  .filter(u => u.active);   // an array", "if (active.length > 0)", "  for (const u of active) send(u);"] },
    "Go iter.Seq (1.23)": { lang: "go", beh: "rerun", lazy: ["active := Filter(Users(db), ok)  // iter.Seq", "for range active { found = true; break }", "for u := range active {      // query #2", "    send(u) }"], eager: ["active := slices.Collect(Filter(Users(db), ok))", "if len(active) > 0 {", "    for _, u := range active { send(u) }", "}"] },
  };
  Viz.register("functional-patterns-lazy", (el) => Viz.player(el, {
    title: "Lazy sequences: what happens when you enumerate twice?",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["active", "pulled from the source now"], ["done", "delivered to the consumer"], ["bad", "lost, repeated or exception"], ["accent", "materialized list"]],
    inputs: [
      { key: "lang", label: "language", type: "select", options: Object.keys(LAZY), value: "C# IEnumerable (LINQ)" },
      { key: "rows", label: "users (1 = active)", value: "1, 0, 1, 1, 0", width: 150 },
      { key: "mode", label: "strategy", type: "select", options: ["reuse the lazy query", "materialize once"], value: "reuse the lazy query" },
    ],
    random: () => ({ lang: pick(Object.keys(LAZY)), rows: Viz.randInts(Viz.rand(3, 6), 0, 1).join(", "), mode: pick(["reuse the lazy query", "materialize once"]) }),
    build: ({ lang, rows, mode }) => {
      const L = LAZY[lang], R = nums(rows, 8), eager = mode.startsWith("materialize");
      if (R.some((r) => r !== 0 && r !== 1)) throw new Error("Use 1 (active) or 0 (inactive) for each user.");
      const reads = R.map(() => 0), fr = [];
      let queries = 0, sent = [], list = null, pos = 0, ex = false;
      const snap = (o) => ({ lang, R, reads: reads.slice(), queries, sent: sent.slice(), list: list && list.slice(), eager, ex, beh: L.beh, ...o });
      const code = eager ? L.eager : L.lazy;
      fr.push(snap({ code, line: [0], note: eager ? "Materialize: run the query <b>once</b> and keep the results in a list." : "Line 1 builds a <b>description</b> of a query. Nothing is read yet: lazy sequences do no work until someone iterates them." }));
      const pull = (from, phase) => {
        for (let i = from; i < R.length; i++) {
          reads[i]++;
          if (R[i] === 1) return i;
          fr.push(snap({ code, line: phase, cur: i, note: `Read user ${i}: inactive, skip.` }));
        }
        return -1;
      };
      if (eager) {
        queries++; list = [];
        for (let i = 0; i < R.length; i++) { reads[i]++; if (R[i]) list.push(i); fr.push(snap({ code, line: [0, 1], cur: i, note: `Read user ${i}: ${R[i] ? "active, keep" : "inactive, skip"}.` })); }
        fr.push(snap({ code, line: [2], note: `The list holds ${list.length} user(s). The check reads the <b>list</b>, not the database.` }));
        for (const u of list) { sent.push(u); fr.push(snap({ code, line: [3], sentNow: u, note: `Send to user ${u} from the list.` })); }
        fr.push(snap({ code, end: true, line: [], note: `1 query, each source row read once, ${sent.length} sends. Cost: memory for the list. ToList / toList() / list() / [...] / slices.Collect are the "make it concrete" switch.` }));
        return fr;
      }
      queries++;
      const first = pull(0, [1]);
      if (first >= 0) fr.push(snap({ code, line: [1], cur: first, note: `Read user ${first}: active, so the "any?" check is satisfied and <b>stops</b>. Rows after it are not read.` }));
      else fr.push(snap({ code, line: [1], note: "No active users; the check is false, so the loop never runs." }));
      if (first < 0) { fr.push(snap({ code, end: true, line: [], note: "Nothing to send. The double-enumeration bug only shows up when there's data, which is why tests with empty fixtures miss it." })); return fr; }
      if (L.beh === "throw") {
        ex = true;
        fr.push(snap({ code, line: [2], note: "Second use of the same Stream: <b>IllegalStateException: stream has already been operated upon or closed</b>. Java streams are single-use by design, so the bug is loud." }));
      } else if (L.beh === "rerun") {
        queries++;
        fr.push(snap({ code, line: [2], note: "The foreach asks the query for a <b>new</b> enumerator, which <b>runs the whole query again</b> from the source (a second database round-trip; Rider/ReSharper flag this as 'possible multiple enumeration', .NET analyzer CA1851)." }));
        let i = 0;
        for (;;) { const k = pull(i, [2]); if (k < 0) break; sent.push(k); fr.push(snap({ code, line: [3], cur: k, sentNow: k, note: `Query #2 reads user ${k}: active, send.` })); i = k + 1; }
      } else {
        pos = first + 1;
        const note = lang.startsWith("Python") ? "<code>any()</code> consumed the generator up to the first match. The <code>for</code> loop <b>resumes from there</b>: user " + first + " is never sent, and no error is raised." : "<code>next()</code> consumed the first active user. <code>for…of</code> continues from the same iterator, so that user is <b>silently skipped</b>.";
        fr.push(snap({ code, line: [2], lost: first, note }));
        let i = pos;
        for (;;) { const k = pull(i, [2]); if (k < 0) break; sent.push(k); fr.push(snap({ code, line: [3], cur: k, sentNow: k, lost: first, note: `Generator yields user ${k}: send.` })); i = k + 1; }
      }
      const active = R.map((r, i) => (r ? i : -1)).filter((i) => i >= 0);
      fr.push(snap({ code, end: true, line: [], lost: L.beh === "empty" ? first : undefined, note: L.beh === "throw" ? "0 sends; the exception is the good outcome. Fix: collect to a List, or use a Supplier&lt;Stream&gt; to make a fresh stream each time." : L.beh === "rerun" ? `${queries} queries for one job, and if the data changed in between, the check and the loop saw <b>different data</b>. Fix: materialize once (switch strategy).` : `Sent ${sent.length} of ${active.length} active users, with no error. The silent version of this bug is the worst one. Fix: materialize (list(...) / [...]) or make a fresh generator per use.` }));
      return fr;
    },
    render: (f) => {
      const L = LAZY[f.lang];
      const src = `<div class="fp-pcol"><div class="fp-pcol-h">source rows</div>${f.R.map((r, i) => `<div class="fp-cell ${f.cur === i ? "active" : f.lost === i ? "bad" : f.reads[i] ? "" : "dim"}">u${i} ${r ? "✓" : "·"}<small>read ×${f.reads[i]}</small></div>`).join("")}</div>`;
      const lst = f.list ? `<div class="fp-pcol"><div class="fp-pcol-h">List (materialized)</div>${f.list.map((u) => `<div class="fp-cell accent">u${u}</div>`).join("") || '<div class="fp-cell empty">empty</div>'}</div>` : "";
      const sent = `<div class="fp-pcol"><div class="fp-pcol-h">sent</div>${f.sent.map((u) => `<div class="fp-cell ${f.sentNow === u ? "active" : "done"}">u${u}</div>`).join("") || '<div class="fp-cell empty">none</div>'}${f.ex ? '<div class="fp-cell bad">IllegalStateException</div>' : ""}</div>`;
      const flow = `<div class="fp-pipe">${[src, lst, sent].filter(Boolean).join('<div class="fp-pipe-arrow">→</div>')}</div>`;
      return col(flow, stats([["queries run", f.queries, f.queries > 1 ? "warn" : ""], ["rows read", f.reads.reduce((a, b) => a + b, 0)], ["sends", f.sent.length]]), codePanel(f.code, L.lang, f.line, f.lang));
    },
  }));

  /* =====================================================================
   * 9. Functional core, imperative shell
   * ===================================================================== */
  Viz.register("functional-patterns-core-shell", (el) => Viz.player(el, {
    title: "Functional core, imperative shell: decisions as data",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["path", "I/O (database, clock, payments, email)"], ["accent", "pure decision"], ["active", "now"], ["done", "command executed"]],
    inputs: [
      { key: "accts", label: "accounts (name days-left balance)", value: "ana 9 40, bo 2 40, cy 0 40, di -1 5", width: 300 },
      { key: "mode", label: "design", type: "select", options: ["functional core + imperative shell", "mixed: logic calls I/O directly"], value: "functional core + imperative shell" },
    ],
    random: () => ({ accts: ["ana", "bo", "cy", "di"].slice(0, Viz.rand(2, 4)).map((n) => `${n} ${Viz.rand(-2, 6)} ${pick([5, 20, 40])}`).join(", "), mode: pick(["functional core + imperative shell", "mixed: logic calls I/O directly"]) }),
    build: ({ accts, mode }) => {
      const PRICE_R = 10;
      const A = words(accts).map((t) => {
        const m = t.match(/^([a-z]{1,8})\s+(-?\d{1,3})\s+(\d{1,4})$/i);
        if (!m) throw new Error(`"${t}": write name days-left balance, e.g. "ana 3 40".`);
        return { name: m[1], days: Number(m[2]), bal: Number(m[3]) };
      });
      if (!A.length || A.length > 5) throw new Error("Use 1 to 5 accounts.");
      const core = mode.startsWith("functional");
      const decide = (a) => a.days > 3 ? [] : a.days > 0 ? [`Remind(${a.name}, ${a.days}d)`] : a.bal >= PRICE_R ? [`Charge(${a.name}, ${PRICE_R})`, `Extend(${a.name}, 30d)`] : [`Suspend(${a.name})`, `EmailFailed(${a.name})`];
      const io = [], cmds = [], log = [], fr = [];
      let ioInLogic = 0;
      const snap = (o) => ({ core, A, io: io.slice(), cmds: cmds.slice(), log: log.slice(), ioInLogic, ...o });
      if (core) {
        io.push("db.LoadDue()"); io.push("clock.Now()");
        fr.push(snap({ phase: 0, note: "<b>Shell (read):</b> gather everything the decision needs: one query for the accounts, one read of the clock. Then call the core with plain data." }));
        A.forEach((a, i) => {
          const c = decide(a); cmds.push(...c);
          fr.push(snap({ phase: 1, cur: i, note: `<b>Core:</b> <code>Decide(now, ${a.name})</code> → ${c.length ? c.map((x) => `<code>${esc(x)}</code>`).join(", ") : "nothing"}. Pure: no database, no clock, no email. It only <b>returns commands as data</b>.` }));
        });
        cmds.forEach((c, i) => {
          io.push(c.replace(/^(\w+)/, (m) => ({ Remind: "email.Send", Charge: "payments.Charge", Extend: "db.Extend", Suspend: "db.Suspend", EmailFailed: "email.Send" }[m] || m)));
          fr.push(snap({ phase: 2, done: i, note: `<b>Shell (act):</b> execute <code>${esc(c)}</code>. The shell has no if-statements about business rules; it just interprets commands.` }));
        });
        fr.push(snap({ phase: 3, end: true, note: `I/O calls inside the business logic: <b>0</b>. To test every rule: <code>Assert.Equal(expected, Decide(now, accounts))</code>, with no mocks, no database and no fake clock. The shell is thin enough to cover with one integration test.` }));
      } else {
        A.forEach((a) => {
          ioInLogic += 2; log.push({ t: `db.Get(${a.name}); clock.Now()`, io: true });
          fr.push(snap({ cur: A.indexOf(a), note: `Mixed: the renewal method loads ${a.name} and reads the clock <b>itself</b>.` }));
          const c = decide(a);
          c.forEach((x) => { ioInLogic++; log.push({ t: `${x} → called directly`, io: true }); });
          if (!c.length) log.push({ t: `${a.name}: nothing to do`, io: false });
          fr.push(snap({ cur: A.indexOf(a), note: c.length ? `…then decides and <b>immediately</b> calls ${c.map((x) => `<code>${esc(x.split("(")[0])}</code>`).join(" and ")} in the middle of the rules.` : `${a.name}: nothing to do, but it still needed the database and the clock to find out.` }));
        });
        fr.push(snap({ end: true, note: `I/O calls tangled in the logic: <b>${ioInLogic}</b>. Testing the rule "charge when due and the balance is enough" now needs mocks for the database, clock, payment gateway and email: <b>4 mocks</b>, and tests that verify calls instead of outcomes.` }));
      }
      return fr;
    },
    render: (f) => {
      if (f.core) {
        const c1 = `<div class="fp-zone shell ${f.phase === 0 ? "on" : ""}"><div class="fp-kv-h">imperative shell: read</div>${f.io.slice(0, 2).map((x) => `<div class="fp-io">${esc(x)}</div>`).join("")}</div>`;
        const c2 = `<div class="fp-zone core ${f.phase === 1 ? "on" : ""}"><div class="fp-kv-h">functional core: Decide(now, accounts)</div>${f.A.map((a, i) => `<div class="fp-acct ${f.cur === i ? "cur" : ""}">${esc(a.name)} · ${a.days}d · $${a.bal}</div>`).join("")}<div class="fp-kv-h">returns</div>${f.cmds.map((c) => `<div class="fp-cmd">${esc(c)}</div>`).join("") || '<div class="fp-cmd empty">[ ]</div>'}</div>`;
        const acts = f.io.slice(2);
        const c3 = `<div class="fp-zone shell ${f.phase === 2 ? "on" : ""}"><div class="fp-kv-h">imperative shell: act</div>${acts.map((x, i) => `<div class="fp-io ${i === f.done ? "cur" : "ok"}">${esc(x)}</div>`).join("") || '<div class="fp-io empty">…</div>'}</div>`;
        return col(`<div class="fp-zones">${c1}<div class="fp-pipe-arrow">→</div>${c2}<div class="fp-pipe-arrow">→</div>${c3}</div>`, stats([["I/O inside logic", 0, "ok"], ["mocks to test rules", 0, "ok"], ["total I/O calls", f.io.length]]));
      }
      const lg = `<div class="fp-zone mixed on"><div class="fp-kv-h">RenewAll(): rules and I/O interleaved</div>${f.log.map((l) => `<div class="fp-io ${l.io ? "" : "plain"}">${esc(l.t)}</div>`).join("") || '<div class="fp-io empty">…</div>'}</div>`;
      return col(`<div class="fp-zones">${lg}</div>`, stats([["I/O inside logic", f.ioInLogic, f.ioInLogic ? "warn" : ""], ["mocks to test rules", 4, "warn"]]));
    },
  }));
})();
