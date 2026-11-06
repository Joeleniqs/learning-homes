/* Language mental models: visualizers. Every frame is produced by running a small simulation of the rule being taught. */
(() => {
  const S = "language-mental-models-";
  const esc = Viz.esc;
  const LANGS = ["C#", "Java", "Python", "Go", "TypeScript"];
  const LID = { "C#": "csharp", Java: "java", Python: "python", Go: "go", TypeScript: "typescript" };
  const pick = (v, opts) => (opts.includes(v) ? v : opts[0]);
  const chip = (k, v, cls = "") => `<span class="lmm-chip ${cls}"><b>${esc(k)}</b> ${esc(v)}</span>`;
  const chips = (...c) => `<div class="lmm-chips">${c.join("")}</div>`;
  const hl = (line, lang) => (window.LearningHome && window.LearningHome.highlight(line, lang)) || esc(line);
  const snippet = (lines, lang, cur = []) => `<ol class="lmm-snip">${lines.map((l, i) => `<li class="${[].concat(cur).includes(i) ? "cur" : ""}">${hl(l, lang)}</li>`).join("")}</ol>`;
  // arrow from (x1,y1) to (x2,y2) with a computed head (no shared marker ids)
  function arrow(x1, y1, x2, y2, cls = "", dash = false) {
    const a = Math.atan2(y2 - y1, x2 - x1), h = 9, w = 4.5;
    const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]].map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" ");
    return `<g class="lmm-arr ${cls}"><line x1="${x1}" y1="${y1}" x2="${bx.toFixed(1)}" y2="${by.toFixed(1)}" ${dash ? 'stroke-dasharray="5 4"' : ""}/><polygon points="${p}"/></g>`;
  }
  function curve(x1, y1, x2, y2, bend, cls = "") {
    const cx = Math.min(x1, x2) - bend, a = Math.atan2(y2 - y1, x2 - cx), h = 9, w = 4.5;
    const bx = x2 - h * Math.cos(a), by = y2 - h * Math.sin(a);
    const p = [[x2, y2], [bx - w * Math.sin(a), by + w * Math.cos(a)], [bx + w * Math.sin(a), by - w * Math.cos(a)]].map((q) => q.map((n) => n.toFixed(1)).join(",")).join(" ");
    return `<g class="lmm-arr ${cls}"><path d="M${x1},${y1} C${cx},${y1} ${cx},${y2} ${bx.toFixed(1)},${by.toFixed(1)}" fill="none" stroke-dasharray="5 4"/><polygon points="${p}"/></g>`;
  }
  /* Re-mounts the player when a select changes something static (code panel, option lists). */
  function adaptive(host, make, init) {
    const mount = (vals) => {
      const cfg = make(vals);
      const sig = cfg.sig;
      const inner = document.createElement("div");
      host.replaceChildren(inner);
      const build = cfg.build, render = cfg.render;
      cfg.build = (v) => {
        if (make(v).sig !== sig) { setTimeout(() => mount(v), 0); return [{ note: "Switching…", pending: true }]; }
        return build(v);
      };
      cfg.render = (f, ctx) => (f.pending ? '<div class="lmm-muted">…</div>' : render(f, ctx));
      Viz.player(inner, cfg);
      inner.querySelector(".viz-inputs")?.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") e.target.form.requestSubmit(); });
    };
    mount(init);
  }

  /* ================= 1. pipeline: source to machine code, then runtime tiers ================= */
  const PIPE = {
    "C#": {
      stages: [["Add.cs", "source"], ["Roslyn (csc)", "type-check + emit IL"], ["Add.dll", "IL + metadata"], ["RyuJIT", "JIT on first call"], ["machine code", "x64 / Arm64, in memory"]],
      tiers: [{ n: "Tier0", d: "fast JIT, few optimizations", at: 0, c: 6 }, { n: "Tier1", d: "optimizing JIT + Dynamic PGO", at: 30, c: 1 }],
      dyn: false, err: "error CS1503: Argument 1: cannot convert from 'double' to 'int'",
      code: ["static int Add(int a, int b) => a + b;", "", "for (int i = 1; i <= calls; i++)", "    total += Add(i, i);"],
    },
    Java: {
      stages: [["Add.java", "source"], ["javac", "type-check + emit bytecode"], ["Add.class", "JVM bytecode"], ["HotSpot", "interpreter + C1/C2 JITs"], ["machine code", "in the code cache"]],
      tiers: [{ n: "Interpreter", d: "tier 0, collects profile", at: 0, c: 25 }, { n: "C1", d: "tier 3, quick JIT + profiling", at: 200, c: 4 }, { n: "C2", d: "tier 4, optimizing JIT", at: 5000, c: 1 }],
      dyn: false, err: "error: incompatible types: possible lossy conversion from double to int",
      code: ["static int add(int a, int b) { return a + b; }", "", "for (int i = 1; i <= calls; i++)", "    total += add(i, i);"],
    },
    Python: {
      stages: [["add.py", "source"], ["compile()", "parse + emit bytecode"], ["add.cpython-313.pyc", "bytecode cache"], ["CPython eval loop", "interprets bytecode"], ["specialized ops", "PEP 659 quickening"]],
      tiers: [{ n: "BINARY_OP", d: "generic: checks types every time", at: 0, c: 40 }, { n: "BINARY_OP_ADD_INT", d: "specialized for int + int", at: 8, c: 25 }],
      dyn: true, code: ["def add(a, b):", "    return a + b", "", "for i in range(1, calls + 1):", "    total += add(i, i)  # later: add(i + 0.5, i)"],
    },
    Go: {
      stages: [["main.go", "source"], ["go build (gc)", "type-check, inline, escape analysis"], ["linker", "static, self-contained"], ["./app", "native machine code"], ["Go runtime", "GC + scheduler linked in"]],
      tiers: [{ n: "native", d: "compiled ahead of time", at: 0, c: 1 }],
      dyn: false, err: "cannot use 1.5 (untyped float constant) as int value in argument to add (truncated)",
      code: ["func add(a, b int) int { return a + b }", "", "for i := 1; i <= calls; i++ {", "    total += add(i, i)", "}"],
    },
    TypeScript: {
      stages: [["add.ts", "source"], ["tsc", "type-check, then erase types"], ["add.js", "plain JavaScript"], ["V8 Ignition", "bytecode interpreter"], ["V8 JIT tiers", "Sparkplug / Maglev / TurboFan"]],
      tiers: [{ n: "Ignition", d: "interpreter, records type feedback", at: 0, c: 25 }, { n: "Sparkplug", d: "baseline compiler, no speculation", at: 8, c: 10 }, { n: "Maglev", d: "mid-tier optimizing JIT", at: 500, c: 3 }, { n: "TurboFan", d: "top-tier optimizing JIT", at: 5000, c: 1 }],
      dyn: true, code: ["function add(a: number, b: number): number {", "  return a + b;", "}", "for (let i = 1; i <= calls; i++)", "  total += add(i, i); // later: add(i + 0.5, i)"],
    },
  };
  function simulatePipeline(lang, calls, floatsFrom) {
    const P = PIPE[lang], frames = [];
    const loopLine = lang === "Python" || lang === "TypeScript" ? [3, 4] : [2, 3];
    P.stages.forEach((s, k) => frames.push({ phase: "build", stage: k, tier: -1, events: [], line: k < 2 ? 0 : loopLine,
      note: k === 0 ? `<b>${esc(lang)}</b>: you write <code>${esc(s[0])}</code>. Nothing has run yet.`
        : k === 1 ? (P.dyn && lang === "Python" ? "CPython compiles source to <b>bytecode</b> when the module is imported. There is no type check: type hints are stored but ignored." : lang === "TypeScript" ? "<b>tsc</b> checks the types and then <b>erases them</b>. The JavaScript it emits has no types at all, so the runtime never sees them." : `<b>${esc(s[0])}</b> type-checks the whole program before anything runs. Type errors stop the build here.`)
        : k === 2 ? (lang === "Go" ? "The Go linker produces <b>one static binary</b> with the runtime inside. No VM or JIT is needed on the target machine." : `The artifact is <b>${esc(s[1])}</b>, portable across CPUs. It is not machine code yet.`)
        : k === 3 ? (lang === "Go" ? "Run <code>./app</code>: the CPU executes the compiled code directly from the first call." : `At run time <b>${esc(s[0])}</b> starts executing. It begins in the cheapest-to-start mode, then promotes hot code.`)
        : (lang === "Go" ? "The Go runtime (GC, goroutine scheduler) is compiled in. Startup is fast and performance is flat: what you build is what runs." : "Hot code is promoted to faster tiers while the program runs. The next steps run the loop to show when."),
      vars: { phase: "build", stage: s[0] } }));
    if (floatsFrom && !P.dyn) frames.push({ phase: "build", stage: 1, tier: -1, events: [], err: true, line: loopLine,
      note: `Passing a float from call ${floatsFrom} is a <b>compile error</b> in ${esc(lang)}: <code>${esc(P.err)}</code>. Static typing moved this failure to build time, so the loop below runs ints only.`,
      vars: { phase: "build", result: "type error" } });
    let tier = 0, since = 0, cost = 0, seenFloat = false, spec = P.tiers.map((t) => t.n);
    const events = [];
    const snap = (call, note, extra = {}) => frames.push({ phase: "run", stage: 4, tier, call, cost, spec: [...spec], events: events.slice(-6), line: loopLine, note,
      vars: { call, tier: spec[tier], "cost so far": cost, "avg / call": (cost / Math.max(1, call)).toFixed(2) }, ...extra });
    for (let call = 1; call <= calls; call++) {
      const isFloat = P.dyn && floatsFrom && call >= floatsFrom;
      let deopt = null;
      if (isFloat && !seenFloat) {
        seenFloat = true;
        if (lang === "Python") {
          spec[1] = "BINARY_OP_ADD_FLOAT";
          if (tier === 1) { deopt = "The specialized <code>BINARY_OP_ADD_INT</code> checks its guess on every call. A float fails the guard, so the instruction falls back to the generic <code>BINARY_OP</code> and re-learns."; tier = 0; since = 0; }
        } else if (tier >= 2) { deopt = `${esc(spec[tier])} compiled <code>a + b</code> assuming small integers (Smis). A double breaks that assumption, so V8 <b>deoptimizes</b>: it throws the machine code away and resumes in Ignition with updated feedback.`; tier = 0; since = 0; }
        if (deopt) { events.push(`call ${call}: deopt`); cost += 30; snap(call, deopt, { deopt: true }); }
        else events.push(`call ${call}: feedback now 'number'`);
      }
      while (tier + 1 < P.tiers.length && since >= P.tiers[tier + 1].at) {
        tier++;
        events.push(`call ${call}: → ${spec[tier]}`);
        snap(call, `After <b>${since}</b> calls ${lang === "Python" ? "the adaptive interpreter specializes the instruction" : "the runtime decides this method is hot and compiles it again"} at <b>${esc(spec[tier])}</b> (${esc(P.tiers[tier].d)}). Cost per call drops from ${P.tiers[tier - 1].c} to ${P.tiers[tier].c} units.${lang === "C#" ? " In real .NET the Tier1 compile happens on a background thread after a short delay." : lang === "TypeScript" ? " V8 really decides with an interrupt budget, not a fixed count; the numbers here are illustrative." : lang === "Python" ? " The warm-up count is illustrative; 3.11+ uses small adaptive counters." : ""}`);
      }
      cost += P.tiers[tier].c;
      since++;
      if (call === 1) snap(call, P.tiers.length === 1 ? "Call 1 already runs native code. AOT pays the compile cost at build time, not at run time." : `Call 1 runs in <b>${esc(spec[0])}</b>: ${esc(P.tiers[0].d)}. Starting cheap keeps startup fast.`);
    }
    const ideal = calls * P.tiers[P.tiers.length - 1].c;
    snap(calls, `Done: ${calls} calls cost <b>${cost}</b> units. Running everything at the top tier would cost ${ideal}, so warm-up added <b>${cost - ideal}</b>. ${P.tiers.length === 1 ? "AOT has no warm-up, but it also cannot re-optimize from what it sees at run time (except with PGO profiles you feed it at build time)." : "Short-lived processes (CLIs, serverless cold starts) live mostly in the slow tiers; long-running services amortize it."}`, { end: true, ideal });
    return frames;
  }
  Viz.register(S + "pipeline", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS);
    return {
      sig: lang, title: "From source to machine code: build pipeline and runtime tiers", tag: "SIMULATION · TIERED COMPILATION",
      legend: [["done", "stage passed / tier left behind"], ["active", "current stage or tier"], ["bad", "deoptimization or type error"]],
      code: PIPE[lang].code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "calls", label: "calls (1–20000)", value: v.calls ?? "6000", width: 110 }, { key: "floats", label: "floats from call # (0 = never)", value: v.floats ?? "0", width: 110 }],
      build: (i) => {
        const calls = Viz.parse.int(i.calls, { min: 1, max: 20000 });
        const fl = Viz.parse.int(i.floats, { min: 0, max: calls });
        return simulatePipeline(pick(i.lang, LANGS), calls, fl);
      },
      random: () => { const c = Viz.rand(50, 12000); return { calls: String(c), floats: String(Math.random() < 0.5 ? 0 : Viz.rand(1, Math.min(c, 3000))) }; },
      render: (f) => {
        const P = PIPE[lang];
        const st = P.stages.map((s, k) => {
          const cls = f.err && k === 1 ? "bad" : f.phase === "build" ? (k < f.stage ? "done" : k === f.stage ? "active" : "") : "done";
          return `<div class="lmm-stage ${cls}"><b>${esc(s[0])}</b><span>${esc(s[1])}</span></div>`;
        }).join('<span class="lmm-sep">→</span>');
        const lad = (f.spec || P.tiers.map((t) => t.n)).map((n, k) => {
          const cls = f.phase !== "run" ? "" : f.deopt && k === 0 ? "bad" : k === f.tier ? "active" : k < f.tier ? "done" : "";
          return `<div class="lmm-tier ${cls}"><b>${esc(n)}</b><span>${esc(P.tiers[k].d)}</span><em>${P.tiers[k].c} unit${P.tiers[k].c > 1 ? "s" : ""}/call${P.tiers[k].at ? ` · after ${P.tiers[k].at} calls` : ""}</em></div>`;
        }).join("");
        const ev = f.phase === "run" && f.events.length ? `<div class="lmm-events">${f.events.map((e) => `<span class="${/deopt/.test(e) ? "bad" : ""}">${esc(e)}</span>`).join("")}</div>` : "";
        const stats = f.phase === "run" ? chips(chip("calls", f.call), chip("cost", f.cost), f.end ? chip("top-tier only", f.ideal, "done") : "", f.end ? chip("warm-up overhead", f.cost - f.ideal, f.cost > f.ideal ? "bad" : "done") : "") : "";
        return `${Viz.labeled("build time", `<div class="lmm-pipe">${st}</div>`)}${Viz.labeled("run time: execution tiers", `<div class="lmm-ladder">${lad}</div>`)}${stats}${ev}`;
      },
    };
  }, { lang: "TypeScript", calls: "6000", floats: "3000" }));

  /* ================= 2. typing: nominal vs structural, checked when ================= */
  const TY = {
    Quacker: { iface: true, m: { quack: 0 } },
    Duck: { m: { quack: 0 } }, Robot: { m: { quak: 0 } }, Toy: { m: { quack: 1 } },
    Celsius: { m: { value: "f" } }, Fahrenheit: { m: { value: "f" } },
  };
  const TSCEN = {
    "Duck has quack() but never says 'implements Quacker'": { arg: "Duck", param: "Quacker", use: "quack", lines: [0, 1, 6] },
    "Robot has quak() (a typo)": { arg: "Robot", param: "Quacker", use: "quack", lines: [0, 2, 6] },
    "Toy has quack(times) (wrong signature)": { arg: "Toy", param: "Quacker", use: "quack", lines: [0, 3, 6] },
    "Fahrenheit passed where Celsius is expected": { arg: "Fahrenheit", param: "Celsius", use: "value", lines: [4, 5, 7] },
  };
  const structural = (a, p) => {
    for (const [k, n] of Object.entries(TY[p].m)) {
      if (!(k in TY[a].m)) return { ok: false, why: "missing", k };
      if (TY[a].m[k] !== n) return { ok: false, why: "signature", k };
    }
    return { ok: true };
  };
  const nominal = (a, p) => (a === p ? { ok: true } : { ok: false, why: "not declared" });
  function judge(lang, sc, mypy) {
    const { arg: a, param: p, use } = sc;
    const decl = p === "Quacker" ? (lang === "C#" ? "IQuacker" : "Quacker") : p;
    if (lang === "C#" || lang === "Java") {
      const r = nominal(a, p);
      return { model: "nominal", when: "compile time", ok: r.ok, msg: r.ok ? "compiles" : lang === "C#" ? `error CS1503: Argument 1: cannot convert from '${a}' to '${decl}'` : `error: incompatible types: ${a} cannot be converted to ${decl}` };
    }
    if (lang === "Go") {
      const r = TY[p].iface ? structural(a, p) : nominal(a, p);
      const model = TY[p].iface ? "structural (interfaces)" : "nominal (named types)";
      const v = a[0].toLowerCase();
      const msg = r.ok ? "compiles: the method set matches, no 'implements' needed"
        : r.why === "missing" ? `cannot use ${v} (variable of type ${a}) as Quacker value in argument to greet: ${a} does not implement Quacker (missing method Quack)`
        : r.why === "signature" ? `cannot use ${v} (variable of type ${a}) as Quacker value in argument to greet: ${a} does not implement Quacker (wrong type for method Quack)`
        : `cannot use ${v} (variable of type ${a}) as Celsius value in argument to warm (fix: Celsius(${v}) converts explicitly)`;
      return { model, when: "compile time", ok: r.ok, msg };
    }
    if (lang === "TypeScript") {
      const r = structural(a, p);
      return { model: "structural", when: "compile time (tsc)", ok: r.ok, silent: r.ok && p === "Celsius",
        msg: r.ok ? (p === "Celsius" ? "compiles silently: same shape means same type, so the unit bug ships" : "compiles: the shape matches")
          : r.why === "missing" ? `TS2345: Argument of type '${a}' is not assignable to parameter of type '${p}'. Property '${r.k}' is missing in type '${a}' but required in type '${p}'.`
          : `TS2345: Argument of type '${a}' is not assignable to parameter of type '${p}'. Types of property '${r.k}' are incompatible. Target signature provides too few arguments.` };
    }
    // Python: the interpreter only looks the attribute up when the line runs (duck typing)
    let run;
    if (!(use in TY[a].m)) run = { ok: false, msg: `AttributeError: '${a}' object has no attribute '${use}'. Did you mean: 'quak'?` };
    else if (TY[a].m[use] === 1) run = { ok: false, msg: `TypeError: ${a}.quack() missing 1 required positional argument: 'times'` };
    else run = { ok: true, msg: p === "Celsius" ? "runs silently: warm() reads .value and gets Fahrenheit degrees" : "runs: Duck has a quack attribute, that is all Python asks" };
    let check = null;
    if (mypy) {
      const r = TY[p].iface ? structural(a, p) : nominal(a, p);
      check = r.ok ? "mypy: Success (Quacker is a Protocol, so matching is structural)" : `mypy: error: Argument 1 to "${p === "Celsius" ? "warm" : "greet"}" has incompatible type "${a}"; expected "${p}"  [arg-type]`;
      return { model: TY[p].iface ? "duck typing + Protocol" : "duck typing + nominal classes", when: "mypy, then run time", ok: r.ok && run.ok, silent: r.ok && run.ok && p === "Celsius", msg: `${check} | run: ${run.msg}`, runFail: !run.ok, checkOk: r.ok };
    }
    return { model: "duck typing", when: "run time only", ok: run.ok, silent: run.ok && p === "Celsius", msg: run.msg, runFail: !run.ok };
  }
  Viz.register(S + "typing", (el) => Viz.player(el, {
    title: "Nominal vs structural typing, and when the check happens", tag: "RULE ENGINE · 5 LANGUAGES",
    legend: [["done", "accepted"], ["bad", "rejected / crashes"], ["path", "accepted silently (a bug that compiles)"]],
    code: ["interface Quacker { quack(): string }", "class Duck  { quack() { return 'Quack' } }  // no 'implements'", "class Robot { quak()  { return 'Beep' } }   // typo", "class Toy   { quack(times: int) { ... } }", "class Celsius    { value: double }", "class Fahrenheit { value: double }", "greet(q: Quacker) { q.quack() }", "warm(c: Celsius)  { c.value + 5 }"],
    codeLang: "typescript",
    inputs: [{ key: "sc", label: "scenario", type: "select", options: Object.keys(TSCEN), value: Object.keys(TSCEN)[0] }, { key: "mypy", label: "Python: run mypy?", type: "select", options: ["no", "yes"], value: "no" }],
    build: (v) => {
      const sc = TSCEN[v.sc] || Object.values(TSCEN)[0], mypy = v.mypy === "yes";
      const rows = [], frames = [];
      frames.push({ rows: [], line: sc.lines, note: `Passing a <b>${sc.arg}</b> where a <b>${sc.param}</b> is expected. Each language asks two questions: <b>is this the same type?</b> (by name = nominal, by shape = structural) and <b>when do we check?</b> (compile time or run time).`, vars: { arg: sc.arg, param: sc.param } });
      for (const lang of LANGS) {
        const r = judge(lang, sc, mypy);
        rows.push({ lang, ...r });
        frames.push({ rows: [...rows], cur: lang, line: sc.lines, vars: { lang, model: r.model, checked: r.when, verdict: r.ok ? (r.silent ? "accepted (bug!)" : "accepted") : "rejected" },
          note: `<b>${lang}</b>: ${r.model}, checked at ${r.when}. ${r.ok ? (r.silent ? "It is <b>accepted</b>, but it is a bug: nothing distinguishes the two units." : "It is <b>accepted</b>.") : r.checkOk === false ? "<b>mypy flags it</b> before running, but only if mypy is part of your build; the interpreter itself never checks hints." : r.runFail ? "It fails <b>only when that line runs</b>, maybe in production." : "It is <b>rejected before the program runs</b>."}` });
      }
      const caught = rows.filter((r) => !r.ok && !/run time only/.test(r.when)).length;
      frames.push({ rows, line: sc.lines, vars: { "caught before run": `${caught}/5` }, note: `Summary: ${caught} of 5 languages catch this before running. ${sc.param === "Celsius" ? "Structural typing (TS) is great for 'anything with a quack()', and weak for <b>same shape, different meaning</b>. Use branded types there (see Types and immutability)." : "Nominal typing makes you <b>declare</b> intent; structural typing lets types fit after the fact, which is why Go and TS interfaces can be defined by the consumer."}` });
      return frames;
    },
    random: () => ({ sc: Object.keys(TSCEN)[Viz.rand(0, 3)], mypy: Math.random() < 0.5 ? "yes" : "no" }),
    render: (f) => {
      const body = LANGS.map((lang) => {
        const r = f.rows.find((x) => x.lang === lang);
        if (!r) return `<tr class="dim"><th>${lang}</th><td></td><td></td><td></td></tr>`;
        const cls = !r.ok ? "bad" : r.silent ? "path" : "done";
        return `<tr class="${lang === f.cur ? "cur" : ""}"><th>${lang}</th><td>${esc(r.model)}</td><td>${esc(r.when)}</td><td class="${cls}"><code>${esc(r.msg)}</code></td></tr>`;
      }).join("");
      return `<table class="lmm-tbl"><thead><tr><th>language</th><th>type identity</th><th>checked</th><th>result</th></tr></thead><tbody>${body}</tbody></table>`;
    },
  }));

  /* ================= 3. passing: what the callee can do to the caller's variable ================= */
  const alloc = (st, o) => { const id = "h" + st.next++; st.heap[id] = o; return id; };
  const slotOf = (st) => (st.p.k === "alias" ? st[st.p.to] : st.p);
  const setN = (st, n) => { const v = slotOf(st); if (v.k === "struct") v.n = n; else if (v.k === "ptr") st[v.to].n = n; else st.heap[v.id].n = n; return v.k === "ptr" ? null : v.id; };
  const rebindObj = (st, n) => { const id = alloc(st, { kind: "obj", n }); if (st.p.k === "alias") st[st.p.to] = { k: "ref", id }; else st.p = { k: "ref", id }; return id; };
  const append = (st, val) => { const s = st.p, a = st.heap[s.id];
    if (s.len < s.cap) { a.items[s.len] = val; st.p = { ...s, len: s.len + 1 }; return { id: s.id, grew: false }; }
    const cap = s.cap * 2, items = a.items.slice(0, s.len).concat([val]); while (items.length < cap) items.push(0);
    const id = alloc(st, { kind: "arr", items }); st.p = { k: "slice", id, len: s.len + 1, cap }; return { id, grew: true }; };
  const PASS = {
    "C# struct (value type)": { lang: "csharp", copy: "a <b>copy of the whole struct</b>", init: (st) => { st.x = { k: "struct", n: 1 }; },
      code: ["struct P { public int N; }", "var x = new P { N = 1 };", "Bump(x);", "void Bump(P p) {", "    p.N = 99;", "    p = new P { N = 5 };", "    p.N = 7;", "}", "Console.WriteLine(x.N);"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => { st.p = { k: "struct", n: 5 }; }], [6, (st) => setN(st, 7)]] },
    "C# class (reference type)": { lang: "csharp", copy: "a <b>copy of the reference</b> (both point to one object)", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "obj", n: 1 }) }; },
      code: ["class P { public int N; }", "var x = new P { N = 1 };", "Bump(x);", "void Bump(P p) {", "    p.N = 99;", "    p = new P { N = 5 };", "    p.N = 7;", "}", "Console.WriteLine(x.N);"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => rebindObj(st, 5)], [6, (st) => setN(st, 7)]] },
    "C# ref parameter": { lang: "csharp", copy: "an <b>alias of the variable itself</b> (<code>ref</code>): p is another name for x", alias: true, init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "obj", n: 1 }) }; },
      code: ["class P { public int N; }", "var x = new P { N = 1 };", "Bump(ref x);", "void Bump(ref P p) {", "    p.N = 99;", "    p = new P { N = 5 };", "    p.N = 7;", "}", "Console.WriteLine(x.N);"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => rebindObj(st, 5)], [6, (st) => setN(st, 7)]] },
    "Java object": { lang: "java", copy: "a <b>copy of the reference</b>. Java is always pass-by-value; for objects the value is a reference", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "obj", n: 1 }) }; },
      code: ["class P { int n; P(int n) { this.n = n; } }", "P x = new P(1);", "bump(x);", "static void bump(P p) {", "    p.n = 99;", "    p = new P(5);", "    p.n = 7;", "}", "System.out.println(x.n);"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => rebindObj(st, 5)], [6, (st) => setN(st, 7)]] },
    "Java int (primitive)": { lang: "java", copy: "a <b>copy of the number</b>", init: (st) => { st.x = { k: "int", v: 1 }; },
      code: ["int x = 1;", "bump(x);", "static void bump(int p) {", "    p++;", "    p = 100;", "}", "System.out.println(x);"],
      ops: [[3, (st) => { st.p.v++; }], [4, (st) => { st.p.v = 100; }]] },
    "Python list": { lang: "python", copy: "a <b>copy of the reference</b> (Python calls it pass-by-assignment: p is bound to the same object)", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "list", items: [1] }) }; },
      code: ["x = [1]", "bump(x)", "def bump(p):", "    p.append(99)", "    p = [5]", "    p.append(7)", "", "print(x)"],
      ops: [[3, (st) => { st.heap[st.p.id].items.push(99); return st.p.id; }], [4, (st) => { st.p = { k: "ref", id: alloc(st, { kind: "list", items: [5] }) }; return st.p.id; }], [5, (st) => { st.heap[st.p.id].items.push(7); return st.p.id; }]] },
    "Python int (immutable)": { lang: "python", copy: "a <b>copy of the reference</b> to an int object. Ints are immutable, so nothing can change that object", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "pyint", v: 1 }) }; },
      code: ["x = 1", "bump(x)", "def bump(p):", "    p += 1     # makes a NEW int object", "    p += 1", "", "print(x)"],
      ops: [[3, (st) => { st.p = { k: "ref", id: alloc(st, { kind: "pyint", v: st.heap[st.p.id].v + 1 }) }; return st.p.id; }], [4, (st) => { st.p = { k: "ref", id: alloc(st, { kind: "pyint", v: st.heap[st.p.id].v + 1 }) }; return st.p.id; }]] },
    "Go struct value": { lang: "go", copy: "a <b>copy of the whole struct</b>", init: (st) => { st.x = { k: "struct", n: 1 }; },
      code: ["type P struct{ N int }", "x := P{N: 1}", "bump(x)", "func bump(p P) {", "    p.N = 99", "    p = P{N: 5}", "    p.N = 7", "}", "fmt.Println(x.N)"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => { st.p = { k: "struct", n: 5 }; }], [6, (st) => setN(st, 7)]] },
    "Go pointer (*P)": { lang: "go", copy: "a <b>copy of the pointer</b> (&amp;x). Go has no reference parameters; the address is passed by value", ptr: true, init: (st) => { st.x = { k: "struct", n: 1 }; },
      code: ["type P struct{ N int }", "x := P{N: 1}", "bump(&x)", "func bump(p *P) {", "    p.N = 99", "    p = &P{N: 5}", "    p.N = 7", "}", "fmt.Println(x.N)"],
      ops: [[4, (st) => setN(st, 99)], [5, (st) => rebindObj(st, 5)], [6, (st) => setN(st, 7)]] },
    "Go slice, len == cap": { lang: "go", copy: "a <b>copy of the slice header</b> (pointer, len, cap); the backing array is shared", init: (st) => { st.x = { k: "slice", id: alloc(st, { kind: "arr", items: [1, 2, 3] }), len: 3, cap: 3 }; },
      code: ["x := []int{1, 2, 3}       // len 3, cap 3", "bump(x)", "func bump(p []int) {", "    p[0] = 99", "    p = append(p, 4)", "    p[1] = 7", "}", "fmt.Println(x)"],
      ops: [[3, (st) => { st.heap[st.p.id].items[0] = 99; return st.p.id; }], [4, (st) => append(st, 4)], [5, (st) => { st.heap[st.p.id].items[1] = 7; return st.p.id; }]] },
    "Go slice, spare capacity": { lang: "go", copy: "a <b>copy of the slice header</b> (pointer, len, cap); the backing array is shared", init: (st) => { st.x = { k: "slice", id: alloc(st, { kind: "arr", items: [1, 2, 3, 0, 0, 0] }), len: 3, cap: 6 }; },
      code: ["x := make([]int, 3, 6)    // len 3, cap 6", "x[0], x[1], x[2] = 1, 2, 3", "bump(x)", "func bump(p []int) {", "    p[0] = 99", "    p = append(p, 4)", "    p[1] = 7", "}", "fmt.Println(x)"],
      ops: [[4, (st) => { st.heap[st.p.id].items[0] = 99; return st.p.id; }], [5, (st) => append(st, 4)], [6, (st) => { st.heap[st.p.id].items[1] = 7; return st.p.id; }]] },
    "Go map": { lang: "go", copy: "a <b>copy of the map header pointer</b>; maps are reference-like", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "map", e: { a: 1 } }) }; },
      code: ["x := map[string]int{\"a\": 1}", "bump(x)", "func bump(p map[string]int) {", "    p[\"a\"] = 99", "    p = map[string]int{\"a\": 5}", "    p[\"a\"] = 7", "}", "fmt.Println(x)"],
      ops: [[3, (st) => { st.heap[st.p.id].e.a = 99; return st.p.id; }], [4, (st) => { st.p = { k: "ref", id: alloc(st, { kind: "map", e: { a: 5 } }) }; return st.p.id; }], [5, (st) => { st.heap[st.p.id].e.a = 7; return st.p.id; }]] },
    "TypeScript object": { lang: "typescript", copy: "a <b>copy of the reference</b> (JS calls this call-by-sharing)", init: (st) => { st.x = { k: "ref", id: alloc(st, { kind: "obj", n: 1 }) }; },
      code: ["const x = { n: 1 };", "bump(x);", "function bump(p: { n: number }) {", "  p.n = 99;", "  p = { n: 5 };", "  p.n = 7;", "}", "console.log(x.n);"],
      ops: [[3, (st) => setN(st, 99)], [4, (st) => rebindObj(st, 5)], [5, (st) => setN(st, 7)]] },
    "TypeScript number": { lang: "typescript", copy: "a <b>copy of the number</b>", init: (st) => { st.x = { k: "int", v: 1 }; },
      code: ["let x = 1;", "bump(x);", "function bump(p: number) {", "  p++;", "  p = 100;", "}", "console.log(x);"],
      ops: [[3, (st) => { st.p.v++; }], [4, (st) => { st.p.v = 100; }]] },
  };
  const showVal = (st, v) => {
    if (!v) return "";
    if (v.k === "int") return String(v.v);
    if (v.k === "struct") return `{N: ${v.n}}`;
    if (v.k === "alias" || v.k === "ptr") return showVal(st, st[v.to]);
    if (v.k === "slice") return `[${st.heap[v.id].items.slice(0, v.len).join(" ")}]`;
    const o = st.heap[v.id];
    return o.kind === "obj" ? `{N: ${o.n}}` : o.kind === "list" ? `[${o.items.join(", ")}]` : o.kind === "pyint" ? String(o.v) : `map[a:${o.e.a}]`;
  };
  function simulatePassing(name) {
    const C = PASS[name], st = { heap: {}, next: 1, x: null, p: null };
    C.init(st);
    const lines = C.code, callLine = lines.findIndex((l) => /^\s*(bump|Bump)\(/.test(l));
    const printLine = lines.length - 1, initLines = [...Array(callLine).keys()];
    const frames = [];
    const snap = (o) => frames.push({ st: Viz.clone(st), ...o, vars: { "x (caller sees)": showVal(st, st.x), p: st.p ? (st.p.k === "alias" ? "alias of x" : st.p.k === "ptr" ? "&x" : showVal(st, st.p)) : "·", ...(o.vars || {}) } });
    snap({ line: initLines, note: "The caller creates <code>x</code>. Watch where the value lives: inline in the stack frame, or on the heap behind a reference." });
    st.p = C.alias ? { k: "alias", to: "x" } : C.ptr ? { k: "ptr", to: "x" } : Viz.clone(st.x);
    snap({ line: callLine, called: true, note: `The call puts ${C.copy} into parameter <code>p</code>.` });
    const defLine = callLine + 1;
    C.ops.forEach(([ln, fn]) => {
      const before = showVal(st, st.x);
      const r = fn(st);
      const after = showVal(st, st.x);
      const vis = before !== after;
      const touched = r && typeof r === "object" ? r.id : r;
      const grew = r && typeof r === "object" && r.grew;
      const rebind = /^\s*p\s*(=|\+=)/.test(lines[ln]) && !/append/.test(lines[ln]);
      let why;
      if (C.alias) why = vis ? "p <b>is</b> x, so every write through p, including reassignment, is a write to x." : "No change.";
      else if (rebind) why = "This <b>rebinds p</b> to something new. p was only a copy, so x still points where it did.";
      else if (/append/.test(lines[ln])) why = grew ? "No spare capacity: append allocates a <b>new array</b>, copies, and p now points there. x still sees the old array." : "There was spare capacity, so append wrote <b>into the shared array</b> and only p's len grew. x's len is still 3, so x does not show the 4, but the array changed under it.";
      else if (vis) why = "p and x point to <b>the same object</b>, so mutating through p is visible through x.";
      else why = st.p.k === "struct" || st.p.k === "int" ? "p is an independent copy, so this only changes the copy." : "p now points to a different object than x, so this mutation does not reach x.";
      snap({ line: ln, called: true, touched, vis, note: `${why} Caller-visible? <b>${vis ? "yes" : "no"}</b>.`, vars: { "visible to caller": vis ? "yes" : "no" } });
    });
    st.p = null;
    const reach = new Set(); const v = st.x; if (v.id) reach.add(v.id);
    snap({ line: printLine, called: false, garbage: true, note: `bump returns, its frame is popped and <code>p</code> disappears. Anything only p referenced is now garbage. The caller prints <b>${esc(showVal(st, st.x))}</b>.` });
    return frames;
  }
  function renderPassing(f) {
    const st = f.st, ids = Object.keys(st.heap), W = 760, rowH = 62;
    const H = Math.max(250, 40 + ids.length * rowH);
    const reach = new Set([st.x, st.p].filter((v) => v && v.id).map((v) => v.id));
    const objY = (id) => 34 + ids.indexOf(id) * rowH;
    const slotText = (v) => (!v ? "" : v.k === "int" ? String(v.v) : v.k === "struct" ? `P { N: ${v.n} }` : v.k === "alias" ? "ref → x" : v.k === "ptr" ? "&x (address)" : v.k === "slice" ? `ptr · len ${v.len} · cap ${v.cap}` : "ref ●");
    let s = `<svg class="dg lmm-svg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="stack frames and heap">`;
    s += `<text x="20" y="18" class="small muted">STACK (one frame per active call)</text><text x="430" y="18" class="small muted">HEAP (objects outlive frames)</text>`;
    const frame = (y, label, slot, val, cls) => `<rect x="16" y="${y}" width="290" height="78" rx="10" class="box ${cls}"/><text x="28" y="${y + 20}" class="small muted">${label}</text><text x="120" y="${y + 51}" text-anchor="end" class="mono title">${slot}</text><rect x="130" y="${y + 30}" width="166" height="34" rx="6" class="box"/><text x="213" y="${y + 52}" text-anchor="middle" class="mono small">${esc(slotText(val))}</text>`;
    s += frame(30, "caller frame", "x", st.x, "accent");
    if (f.called && st.p) s += frame(140, "bump() frame", "p", st.p, "path");
    ids.forEach((id) => {
      const o = st.heap[id], y = objY(id), cls = f.touched === id ? "active" : f.garbage && !reach.has(id) ? "lmm-garb" : "";
      s += `<rect x="430" y="${y}" width="314" height="48" rx="8" class="box ${cls}"/>`;
      if (o.kind === "arr") {
        const slice = [st.x, st.p].filter((v) => v && v.k === "slice" && v.id === id);
        const maxLen = Math.max(0, ...slice.map((v) => v.len));
        o.items.forEach((n, k) => { const cx = 440 + k * 36; s += `<rect x="${cx}" y="${y + 8}" width="32" height="32" rx="4" class="box ${k < maxLen ? "" : "lmm-cap"}"/><text x="${cx + 16}" y="${y + 29}" text-anchor="middle" class="mono small">${k < maxLen || n ? n : ""}</text>`; });
        s += `<text x="736" y="${y + 29}" text-anchor="end" class="small muted">array</text>`;
      } else {
        const t = o.kind === "obj" ? `P { N: ${o.n} }` : o.kind === "list" ? `list [${o.items.join(", ")}]` : o.kind === "pyint" ? `int ${o.v}  (immutable)` : `map[a:${o.e.a}]`;
        s += `<text x="446" y="${y + 29}" class="mono">${esc(t)}</text>${f.garbage && !reach.has(id) ? `<text x="736" y="${y + 29}" text-anchor="end" class="small muted">garbage</text>` : ""}`;
      }
    });
    const pointTo = (v, sy, cls) => {
      if (!v) return "";
      if (v.k === "alias" || v.k === "ptr") return curve(130, sy, 130, 77, 52, cls);
      if (v.id) return arrow(296, sy, 430, objY(v.id) + 24, cls);
      return "";
    };
    s += pointTo(st.x, 77, "x");
    if (f.called) s += pointTo(st.p, 187, "p");
    return `<div class="lmm-fit">${s}</svg></div>${chips(chip("caller sees x =", showVal(st, st.x), "accent"), f.vis === undefined ? "" : chip("visible to caller", f.vis ? "yes" : "no", f.vis ? "bad" : "done"))}`;
  }
  Viz.register(S + "passing", (el) => adaptive(el, (v) => {
    const name = pick(v.c, Object.keys(PASS));
    return {
      sig: name, title: "Argument passing: what can the callee do to the caller's variable?", tag: "SIMULATION · STACK + HEAP",
      legend: [["accent", "caller frame"], ["path", "callee frame"], ["active", "object written this step"], ["dim", "garbage after return"]],
      code: PASS[name].code, codeLang: PASS[name].lang,
      inputs: [{ key: "c", label: "language and type", type: "select", options: Object.keys(PASS), value: name }],
      build: (i) => simulatePassing(pick(i.c, Object.keys(PASS))),
      random: () => ({ c: Object.keys(PASS)[Viz.rand(0, Object.keys(PASS).length - 1)] }),
      render: renderPassing,
    };
  }, { c: "Go slice, spare capacity" }));

  /* ================= 4. equality: identity vs value, per language ================= */
  // [codeLine, result (bool | string | fn(n)), kind: I = identity, V = value/structural, X = other, why]
  const inCache = (lo, hi) => (n) => n >= lo && n <= hi;
  const EQ = {
    "strings built at run time": {
      "C#": { id: "two", code: ['string a = "hello";', 'string b = string.Concat("hel", Suffix()); // "lo"', "a == b", "(object)a == (object)b", "a.Equals(b)", "ReferenceEquals(a, b)"],
        ex: [[2, true, "V", "string overloads == to compare characters"], [3, false, "I", "casting to object picks object's ==, which is reference identity; b was built at run time and is not interned"], [4, true, "V", "Equals is overridden by string to compare characters"], [5, false, "I", "two different string objects"]] },
      Java: { id: "two", code: ['String a = "hello";', 'String b = "hel" + suffix();   // built at run time', "a == b", "a.equals(b)", "a == b.intern()"],
        ex: [[2, false, "I", "== on objects is identity. Literals are interned, run-time strings are not: the classic Java bug"], [3, true, "V", "equals compares characters"], [4, true, "I", "intern() returns the pooled instance, which is the literal a"]] },
      Python: { id: "two", code: ['a = "hello"', 'b = "".join(["hel", "lo"])', "a == b", "a is b"],
        ex: [[2, true, "V", "== calls __eq__, which compares characters"], [3, false, "I", "is checks identity; whether strings are shared is a CPython detail. Never use is for values"]] },
      Go: { id: "val", code: ['a := "hello"', 'b := strings.Join([]string{"hel", "lo"}, "")', "a == b", "// there is no identity operator for strings"],
        ex: [[2, true, "V", "strings are values; == compares bytes"]] },
      TypeScript: { id: "val", code: ['const a = "hello";', 'const b = ["hel", "lo"].join("");', "a === b", "a == b"],
        ex: [[2, true, "V", "string primitives compare by value"], [3, true, "V", "same type, so == behaves like ===; prefer === anyway (no coercion)"]] },
    },
    "two objects with the same fields": {
      "C#": { id: "two", code: ["class Point { public int X, Y; }", "var a = new Point { X = 1, Y = 2 };", "var b = new Point { X = 1, Y = 2 };", "a == b", "a.Equals(b)", "var c = a;  c == a"],
        ex: [[3, false, "I", "classes default to reference equality"], [4, false, "I", "object.Equals defaults to identity unless overridden"], [5, true, "I", "c and a hold the same reference"]] },
      Java: { id: "two", code: ["class Point { int x, y; Point(int x, int y) {...} }", "Point a = new Point(1, 2);", "Point b = new Point(1, 2);", "a == b", "a.equals(b)", "a.hashCode() == b.hashCode()"],
        ex: [[3, false, "I", "== is identity for objects"], [4, false, "I", "Object.equals is identity until you override equals AND hashCode"], [5, false, "I", "identity hash codes differ (almost always)"]] },
      Python: { id: "two", code: ["class Point:", "    def __init__(self, x, y): self.x, self.y = x, y", "a, b = Point(1, 2), Point(1, 2)", "a == b", "a is b", "vars(a) == vars(b)"],
        ex: [[3, false, "I", "default __eq__ falls back to identity"], [4, false, "I", "two objects"], [5, true, "V", "comparing the attribute dicts compares values"]] },
      Go: { id: "val", code: ["type Point struct{ X, Y int }", "a, b := Point{1, 2}, Point{1, 2}", "a == b", "pa, pb := &Point{1, 2}, &Point{1, 2}", "pa == pb", "*pa == *pb"],
        ex: [[2, true, "V", "comparable structs compare field by field"], [4, false, "I", "pointers compare addresses"], [5, true, "V", "dereferenced: field by field again"]] },
      TypeScript: { id: "two", code: ["class Point { constructor(public x: number, public y: number) {} }", "const a = new Point(1, 2), b = new Point(1, 2);", "a === b", "a == b", "JSON.stringify(a) === JSON.stringify(b)"],
        ex: [[2, false, "I", "objects compare by reference"], [3, false, "I", "== does not help for objects"], [4, true, "V", "works here, but depends on key order and drops undefined: write an equals() instead"]] },
    },
    "records / data classes": {
      "C#": { id: "two", code: ["record Point(int X, int Y);", "var a = new Point(1, 2);", "var b = new Point(1, 2);", "a == b", "a.Equals(b)", "ReferenceEquals(a, b)", "a.GetHashCode() == b.GetHashCode()"],
        ex: [[3, true, "V", "records generate == / Equals over all fields"], [4, true, "V", "value equality"], [5, false, "I", "still two heap objects (record class)"], [6, true, "V", "generated GetHashCode is consistent with Equals"]] },
      Java: { id: "two", code: ["record Point(int x, int y) {}", "var a = new Point(1, 2);", "var b = new Point(1, 2);", "a == b", "a.equals(b)", "a.hashCode() == b.hashCode()"],
        ex: [[3, false, "I", "== is ALWAYS identity in Java, even for records"], [4, true, "V", "records generate equals over the components"], [5, true, "V", "and a matching hashCode"]] },
      Python: { id: "two", code: ["@dataclass(frozen=True)", "class Point:", "    x: int", "    y: int", "a, b = Point(1, 2), Point(1, 2)", "a == b", "a is b", "hash(a) == hash(b)"],
        ex: [[5, true, "V", "dataclass generates __eq__ over fields"], [6, false, "I", "two objects"], [7, true, "V", "frozen=True also generates __hash__, so it can be a dict key"]] },
      Go: { id: "val", code: ["type Point struct{ X, Y int }", "a, b := Point{1, 2}, Point{1, 2}", "a == b", 'm := map[Point]string{a: "home"}', "m[b]"],
        ex: [[2, true, "V", "a plain struct already is a value type"], [4, '"home"', "V", "comparable structs work as map keys"]] },
      TypeScript: { id: "two", code: ["type Point = Readonly<{ x: number; y: number }>;", "const a: Point = { x: 1, y: 2 };", "const b: Point = { x: 1, y: 2 };", "a === b", "a.x === b.x && a.y === b.y", "new Set([a, b]).size"],
        ex: [[3, false, "I", "JS has no value objects; === is reference"], [4, true, "V", "compare fields yourself"], [5, "2", "I", "Set and Map use SameValueZero, i.e. reference, for objects"]] },
    },
    "lists with the same items": {
      "C#": { id: "two", code: ["var a = new List<int> { 1, 2 };", "var b = new List<int> { 1, 2 };", "a == b", "a.Equals(b)", "a.SequenceEqual(b)"],
        ex: [[2, false, "I", "List<T> is a class without value equality"], [3, false, "I", "same"], [4, true, "V", "LINQ compares element by element"]] },
      Java: { id: "two", code: ["List<Integer> a = List.of(1, 2);", "List<Integer> b = new ArrayList<>(List.of(1, 2));", "a == b", "a.equals(b)", "Arrays.equals(new int[]{1, 2}, new int[]{1, 2})", "new int[]{1, 2}.equals(new int[]{1, 2})"],
        ex: [[2, false, "I", "identity"], [3, true, "V", "the List contract defines equals by elements, across implementations"], [4, true, "V", "arrays need Arrays.equals"], [5, false, "I", "arrays inherit Object.equals: identity"]] },
      Python: { id: "two", code: ["a = [1, 2]", "b = [1, 2]", "a == b", "a is b", "(1, 2) == (1, 2)"],
        ex: [[2, true, "V", "list __eq__ compares elements"], [3, false, "I", "two lists"], [4, true, "V", "tuples too"]] },
      Go: { id: "two", code: ["a := []int{1, 2}", "b := []int{1, 2}", "a == b", "slices.Equal(a, b)", "[2]int{1, 2} == [2]int{1, 2}"],
        ex: [[2, "compile error: invalid operation: a == b (slice can only be compared to nil)", "X", "slices are not comparable on purpose"], [3, true, "V", "Go 1.21 slices package"], [4, true, "V", "arrays (fixed size) are values and comparable"]] },
      TypeScript: { id: "two", code: ["const a = [1, 2];", "const b = [1, 2];", "a === b", "a.length === b.length && a.every((v, i) => v === b[i])"],
        ex: [[2, false, "I", "arrays are objects: reference comparison"], [3, true, "V", "compare element-wise yourself (or use a library deep-equal)"]] },
    },
    "boxed numbers (uses n)": {
      "C#": { id: "two", code: ["int n = {n};", "object a = n, b = n;   // boxing: two heap boxes", "a == b", "a.Equals(b)", "(int)a == (int)b"],
        ex: [[2, false, "I", "object == is reference equality; each boxing allocates a new box, for every n"], [3, true, "V", "Int32.Equals compares the values"], [4, true, "V", "unboxed ints compare by value"]] },
      Java: { id: "cache:-128:127", code: ["Integer a = {n}, b = {n};   // autoboxing calls Integer.valueOf", "a == b", "a.equals(b)", "a.intValue() == b.intValue()"],
        ex: [[1, inCache(-128, 127), "I", "Integer.valueOf caches -128..127, so small values share one object; outside that range == compares two different boxes"], [2, true, "V", "always compare boxed numbers with equals"], [3, true, "V", "primitives compare by value"]] },
      Python: { id: "cache:-5:256", code: ['a = int("{n}")', 'b = int("{n}")', "a == b", "a is b"],
        ex: [[2, true, "V", "value equality"], [3, inCache(-5, 256), "I", "CPython pre-allocates -5..256; other ints built at run time are separate objects. Implementation detail: never use is for numbers"]] },
      Go: { id: "val", code: ["var a, b any = {n}, {n}   // interface values", "a == b", "a == any(int64({n}))"],
        ex: [[1, true, "V", "interfaces compare dynamic type and value"], [2, false, "V", "same number, different dynamic type (int vs int64)"]] },
      TypeScript: { id: "val", code: ["const a = {n}, b = {n};", "a === b", "new Number({n}) === new Number({n})"],
        ex: [[1, true, "V", "number primitives compare by value"], [2, false, "I", "wrapper objects are objects; never use new Number"]] },
    },
    "NaN (not a number)": {
      "C#": { id: "val", code: ["double a = double.NaN;", "a == a", "a.Equals(a)", "double.IsNaN(a)"],
        ex: [[1, false, "V", "IEEE 754: NaN is not equal to anything, itself included"], [2, true, "V", "Equals treats NaN as equal to NaN so collections and dictionaries work"], [3, true, "V", "the right test"]] },
      Java: { id: "val", code: ["double a = Double.NaN;", "a == a", "Double.valueOf(a).equals(a)", "Double.isNaN(a)"],
        ex: [[1, false, "V", "IEEE 754 rule"], [2, true, "V", "Double.equals compares bit patterns, so NaN equals NaN"], [3, true, "V", "the right test"]] },
      Python: { id: "val", code: ['a = float("nan")', "a == a", "[a] == [a]", '[float("nan")] == [float("nan")]', "math.isnan(a)"],
        ex: [[1, false, "V", "IEEE 754 rule"], [2, true, "I", "list comparison checks identity first (x is y) before ==, and it is the same object"], [3, false, "V", "two different NaN objects, so == is used and fails"], [4, true, "V", "the right test"]] },
      Go: { id: "val", code: ["a := math.NaN()", "a == a", "m := map[float64]int{}; m[a] = 1; m[a] = 2", "len(m)", "math.IsNaN(a)"],
        ex: [[1, false, "V", "IEEE 754 rule"], [3, "2", "X", "a NaN key never matches, so every insert adds an entry you can never read back"], [4, true, "V", "the right test"]] },
      TypeScript: { id: "val", code: ["const a = NaN;", "a === a", "Object.is(a, a)", "[a].includes(a)", "[a].indexOf(a)", "Number.isNaN(a)"],
        ex: [[1, false, "V", "IEEE 754 rule"], [2, true, "V", "Object.is uses SameValue: NaN is NaN"], [3, true, "V", "includes uses SameValueZero"], [4, "-1", "V", "indexOf uses ===, so it cannot find NaN"], [5, true, "V", "the right test"]] },
    },
  };
  const fmtBool = (lang, b) => (typeof b !== "boolean" ? b : lang === "Python" ? (b ? "True" : "False") : String(b));
  Viz.register(S + "equality", (el) => adaptive(el, (v) => {
    const sc = pick(v.sc, Object.keys(EQ)), lang = pick(v.lang, LANGS);
    const D = EQ[sc][lang];
    const n = /^-?\d+$/.test(String(v.n ?? "")) ? Number(v.n) : 127;
    return {
      sig: `${sc}|${lang}|${/\{n\}/.test(D.code.join()) ? n : ""}`, title: "Equality: same object, or same value?", tag: "RULE TABLE · IDENTITY VS VALUE",
      legend: [["done", "true"], ["bad", "false"], ["visit", "other result"]],
      code: D.code.map((l) => l.replaceAll("{n}", n)), codeLang: LID[lang],
      inputs: [{ key: "sc", label: "scenario", type: "select", options: Object.keys(EQ), value: sc }, { key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "n", label: "n (boxed numbers)", value: String(n), width: 90 }],
      build: (i) => {
        const nn = Viz.parse.int(i.n, { min: -100000, max: 100000 });
        const done = [], frames = [];
        const twoObjs = D.id === "two" || (D.id.startsWith("cache") && !(nn >= Number(D.id.split(":")[1]) && nn <= Number(D.id.split(":")[2])));
        const pic = D.id === "val" ? "val" : twoObjs ? "two" : "one";
        frames.push({ pic, rows: [], line: D.ex[0][0] > 0 ? [...Array(D.ex[0][0]).keys()] : 0, note: pic === "val" ? "These are <b>values</b>: the comparison looks at the bits/fields, there is no separate object identity to compare." : pic === "one" ? `Both variables refer to <b>one shared object</b> (n = ${nn} is inside the runtime's cache).` : "Two variables, <b>two separate objects</b> with the same contents. Identity says different; value equality says same.", vars: { scenario: sc } });
        for (const [ln, r, k, why] of D.ex) {
          const res = typeof r === "function" ? r(nn) : r;
          done.push({ expr: D.code[ln].replaceAll("{n}", nn), res: fmtBool(lang, res), cls: res === true ? "done" : res === false ? "bad" : "visit", k });
          frames.push({ pic, rows: [...done], line: ln, note: `<code>${esc(D.code[ln].replaceAll("{n}", nn))}</code> → <b>${esc(fmtBool(lang, res))}</b>: ${esc(why)}.`, vars: { expr: D.code[ln].replaceAll("{n}", nn).slice(0, 40), result: fmtBool(lang, res), compares: k === "I" ? "identity" : k === "V" ? "value" : "n/a" } });
        }
        return frames;
      },
      random: () => ({ n: String([100, 127, 128, 200, 256, 257, 1000, -5, -6, -129][Viz.rand(0, 9)]) }),
      render: (f) => {
        const W = 520, H = 120;
        let s = `<svg class="dg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="variables and objects">`;
        s += `<rect x="10" y="14" width="70" height="34" rx="6" class="box accent"/><text x="45" y="36" text-anchor="middle" class="mono">a</text><rect x="10" y="70" width="70" height="34" rx="6" class="box accent"/><text x="45" y="92" text-anchor="middle" class="mono">b</text>`;
        if (f.pic === "val") s += `<text x="100" y="36" class="small">holds the value itself</text><text x="100" y="92" class="small">holds its own copy of the value</text><text x="320" y="64" class="small muted">no object identity to compare</text>`;
        else if (f.pic === "one") s += `<rect x="300" y="40" width="200" height="40" rx="8" class="box done"/><text x="400" y="65" text-anchor="middle" class="small">one shared object</text>${arrow(80, 31, 300, 54, "x")}${arrow(80, 87, 300, 70, "x")}`;
        else s += `<rect x="300" y="12" width="200" height="38" rx="8" class="box"/><text x="400" y="36" text-anchor="middle" class="small">object #1</text><rect x="300" y="70" width="200" height="38" rx="8" class="box"/><text x="400" y="94" text-anchor="middle" class="small">object #2 (same contents)</text>${arrow(80, 31, 300, 31, "x")}${arrow(80, 87, 300, 89, "x")}`;
        s += "</svg>";
        const rows = f.rows.map((r) => `<tr><td><code>${hl(r.expr, LID[lang])}</code></td><td class="${r.cls}"><b>${esc(r.res)}</b></td><td>${r.k === "I" ? "identity" : r.k === "V" ? "value" : "n/a"}</td></tr>`).join("");
        return `<div class="lmm-fit">${s}</div><table class="lmm-tbl"><thead><tr><th>expression</th><th>result</th><th>compares</th></tr></thead><tbody>${rows || '<tr><td colspan="3" class="lmm-muted">step forward to evaluate</td></tr>'}</tbody></table>`;
      },
    };
  }, { sc: "strings built at run time", lang: "Java", n: "127" }));

  /* ================= 5. closures: captured variables vs captured values ================= */
  const CL = {
    "C#: for loop": { lang: "csharp", mode: "shared", bump: true, code: ["var fs = new List<Func<int>>();", "for (int i = 0; i < n; i++)", "    fs.Add(() => i);", "foreach (var f in fs) Console.Write(f());"], loop: 1, cap: 2, call: 3,
      why: "C# for declares ONE i for the whole loop; every lambda captures that same variable." },
    "C#: foreach": { lang: "csharp", mode: "fresh", code: ["var fs = new List<Func<int>>();", "foreach (var i in Enumerable.Range(0, n))", "    fs.Add(() => i);", "foreach (var f in fs) Console.Write(f());"], loop: 1, cap: 2, call: 3,
      why: "Since C# 5, foreach declares a fresh i per iteration." },
    "C#: copy inside the loop": { lang: "csharp", mode: "fresh", code: ["for (int i = 0; i < n; i++) {", "    int copy = i;", "    fs.Add(() => copy);", "}", "foreach (var f in fs) Console.Write(f());"], loop: 0, cap: 2, call: 4,
      why: "copy is declared inside the body, so each iteration gets its own variable." },
    "Java: for loop": { lang: "java", mode: "error", code: ["List<IntSupplier> fs = new ArrayList<>();", "for (int i = 0; i < n; i++)", "    fs.add(() -> i);", "fs.forEach(f -> System.out.print(f.getAsInt()));"], loop: 1, cap: 2, call: 3,
      why: "error: local variables referenced from a lambda expression must be final or effectively final. Java refuses to capture a variable that changes, so this bug cannot happen." },
    "Java: effectively final copy": { lang: "java", mode: "fresh", code: ["for (int i = 0; i < n; i++) {", "    int copy = i;            // effectively final", "    fs.add(() -> copy);", "}", "fs.forEach(f -> System.out.print(f.getAsInt()));"], loop: 0, cap: 2, call: 4,
      why: "Java lambdas capture values of effectively-final locals: each lambda gets a copy." },
    "Python: lambda in a loop": { lang: "python", mode: "shared", bump: false, code: ["fs = []", "for i in range(n):", "    fs.append(lambda: i)", "print([f() for f in fs])"], loop: 1, cap: 2, call: 3,
      why: "Python closures look names up when called (late binding). All lambdas share the enclosing scope's i, which ends at n-1 (range never goes to n)." },
    "Python: default argument": { lang: "python", mode: "fresh", code: ["fs = []", "for i in range(n):", "    fs.append(lambda i=i: i)", "print([f() for f in fs])"], loop: 1, cap: 2, call: 3,
      why: "Default values are evaluated when the lambda is defined, so each lambda stores the current i. functools.partial does the same." },
    "Go ≤ 1.21 loop": { lang: "go", mode: "shared", bump: true, code: ["var fs []func() int", "for i := 0; i < n; i++ {", "    fs = append(fs, func() int { return i })", "}", "for _, f := range fs { fmt.Print(f()) }"], loop: 1, cap: 2, call: 4,
      why: "Before Go 1.22 the loop variable was one variable for the whole loop; goroutines and closures shared it." },
    "Go 1.22+ loop": { lang: "go", mode: "fresh", code: ["// go.mod: go 1.22", "for i := 0; i < n; i++ {", "    fs = append(fs, func() int { return i })", "}", "for _, f := range fs { fmt.Print(f()) }"], loop: 1, cap: 2, call: 4,
      why: "Go 1.22 changed the semantics: each iteration has its own i (only for modules that declare go 1.22 or later)." },
    "TypeScript: var": { lang: "typescript", mode: "shared", bump: true, code: ["const fs: (() => number)[] = [];", "for (var i = 0; i < n; i++)", "  fs.push(() => i);", "fs.forEach((f) => console.log(f()));"], loop: 1, cap: 2, call: 3,
      why: "var is function-scoped: one i for the whole function." },
    "TypeScript: let": { lang: "typescript", mode: "fresh", code: ["const fs: (() => number)[] = [];", "for (let i = 0; i < n; i++)", "  fs.push(() => i);", "fs.forEach((f) => console.log(f()));"], loop: 1, cap: 2, call: 3,
      why: "let in a for header creates a new binding per iteration, copied forward before the increment." },
  };
  function simulateClosures(name, n) {
    const C = CL[name], cells = [], fns = [], frames = [];
    const snap = (o) => frames.push({ cells: Viz.clone(cells), fns: [...fns], out: o.out || [], ...o });
    if (C.mode === "error") {
      frames.push({ cells: [], fns: [], out: [], err: true, line: C.cap, note: `<b>Compile error.</b> ${esc(C.why)}`, vars: { result: "does not compile" } });
      return frames;
    }
    for (let i = 0; i < n; i++) {
      if (C.mode === "shared") { if (!cells.length) cells.push({ name: "i", v: i }); else cells[0].v = i; }
      else cells.push({ name: C.code.join().includes("copy") ? "copy" : "i", v: i });
      snap({ line: C.loop, cur: cells.length - 1, note: C.mode === "shared" ? `Iteration ${i}: the <b>single</b> variable i is set to ${i}.` : `Iteration ${i}: a <b>new</b> variable is created holding ${i}.`, vars: { iteration: i, "variables alive": cells.length } });
      fns.push(C.mode === "shared" ? 0 : cells.length - 1);
      snap({ line: C.cap, cur: cells.length - 1, newFn: fns.length - 1, note: `Create closure f${i}. It captures the <b>variable</b> ${C.mode === "shared" ? "i (shared)" : "of this iteration"}, not a snapshot of its value${name.includes("default") ? " (here the default argument stores the value)" : ""}.`, vars: { iteration: i, closures: fns.length } });
    }
    if (C.mode === "shared" && C.bump && n > 0) { cells[0].v = n; snap({ line: C.loop, cur: 0, note: `The loop increments i to <b>${n}</b>, the condition i &lt; n fails, the loop exits. The variable still exists because closures reference it.`, vars: { i: n } }); }
    const out = [];
    fns.forEach((c, k) => { out.push(cells[c].v); snap({ line: C.call, cur: c, calling: k, out: [...out], note: `Call f${k}(): it reads the variable it captured, which holds <b>${cells[c].v}</b> now.`, vars: { output: out.join(" ") } }); });
    const expect = [...Array(n).keys()].join(" ");
    snap({ line: C.call, out, done: true, note: `Output <b>${out.join(" ") || "(nothing)"}</b>. ${out.join(" ") === expect ? "Each closure saw its own value." : "Not what most people expect."} ${esc(C.why)}`, vars: { output: out.join(" "), expected: expect } });
    return frames;
  }
  Viz.register(S + "closures", (el) => adaptive(el, (v) => {
    const name = pick(v.c, Object.keys(CL));
    return {
      sig: name, title: "Closures capture variables, not values", tag: "SIMULATION · ENVIRONMENT CELLS",
      legend: [["active", "variable being written / read"], ["path", "closure"], ["bad", "compile error"]],
      code: CL[name].code, codeLang: CL[name].lang,
      inputs: [{ key: "c", label: "language and loop", type: "select", options: Object.keys(CL), value: name }, { key: "n", label: "n (1–6)", value: v.n ?? "3", width: 70 }],
      build: (i) => simulateClosures(pick(i.c, Object.keys(CL)), Viz.parse.int(i.n, { min: 1, max: 6 })),
      random: () => ({ c: Object.keys(CL)[Viz.rand(0, Object.keys(CL).length - 1)], n: String(Viz.rand(2, 5)) }),
      render: (f) => {
        if (f.err) return `<div class="lmm-err">${esc(CL[name].why)}</div>`;
        const W = 680, n = Math.max(f.fns.length, 1), cw = Math.min(100, (W - 40) / Math.max(n, f.cells.length || 1));
        const fx = (k) => 20 + k * cw, cx = (k) => 20 + k * cw;
        let s = `<svg class="dg" viewBox="0 0 ${W} 190" width="${W}" role="img" aria-label="closures and captured variables"><text x="20" y="16" class="small muted">closures</text><text x="20" y="128" class="small muted">captured variables (environment)</text>`;
        f.fns.forEach((c, k) => {
          s += `<rect x="${fx(k)}" y="24" width="${cw - 14}" height="36" rx="8" class="box ${f.calling === k ? "active" : "path"}"/><text x="${fx(k) + (cw - 14) / 2}" y="47" text-anchor="middle" class="mono small">f${k}</text>`;
          s += arrow(fx(k) + (cw - 14) / 2, 60, cx(c) + (cw - 14) / 2, 136, f.calling === k ? "x" : "");
        });
        f.cells.forEach((c, k) => { s += `<rect x="${cx(k)}" y="136" width="${cw - 14}" height="40" rx="6" class="box ${f.cur === k ? "active" : ""}"/><text x="${cx(k) + (cw - 14) / 2}" y="161" text-anchor="middle" class="mono small">${esc(c.name)} = ${c.v}</text>`; });
        s += "</svg>";
        return `<div class="lmm-fit">${s}</div>${f.out.length ? chips(chip("output", f.out.join(" "), f.done ? (f.out.join(" ") === [...Array(f.fns.length).keys()].join(" ") ? "done" : "bad") : "")) : ""}`;
      },
    };
  }, { c: "Python: lambda in a loop", n: "3" }));

  /* ================= 6. generics: one body or many, and what survives at run time ================= */
  const PRIM = { int: 1, long: 1, double: 1, bool: 1, string: 0 };
  const GMAP = {
    "C#": { int: "int", long: "long", double: "double", bool: "bool", string: "string" },
    Java: { int: "Integer", long: "Long", double: "Double", bool: "Boolean", string: "String" },
    Python: { int: "int", long: "int", double: "float", bool: "bool", string: "str" },
    Go: { int: "int", long: "int64", double: "float64", bool: "bool", string: "string" },
    TypeScript: { int: "number", long: "bigint", double: "number", bool: "boolean", string: "string" },
  };
  const GCODE = {
    "C#": ["class Stack<T> {", "    T[] items = new T[16];", "    public void Push(T x) { items[n++] = x; }", "}", "new Stack<T>()   // for each type argument"],
    Java: ["class Stack<T> {", "    private Object[] items = new Object[16];", "    void push(T x) { items[n++] = x; }", "}", "new Stack<T>()   // for each type argument"],
    Python: ["class Stack[T]:            # 3.12 syntax", "    def __init__(self) -> None: self.items: list[T] = []", "    def push(self, x: T) -> None: self.items.append(x)", "", "Stack[T]()        # for each type argument"],
    Go: ["type Stack[T any] struct{ items []T }", "func (s *Stack[T]) Push(x T) {", "    s.items = append(s.items, x)", "}", "Stack[T]{}        // for each type argument"],
    TypeScript: ["class Stack<T> {", "  private items: T[] = [];", "  push(x: T) { this.items.push(x); }", "}", "new Stack<T>()    // for each type argument"],
  };
  const GCAP = {
    "C#": [["Stack<int> stores raw ints (no boxing)", "yes: specialized body per value type"], ["typeof(T) at run time", "yes: generics are reified"], ["new T()", "yes, with where T : new()"], ["static abstract members (T.Zero)", "yes, generic math (C# 11)"]],
    Java: [["Stack<int>", "not allowed: primitives must be boxed (Valhalla aims to fix this)"], ["T.class at run time", "no: erased to the bound (Object)"], ["new T()", "no: pass a Supplier<T> or Class<T>"], ["overload foo(List<String>) and foo(List<Integer>)", "no: same erasure, compile error"]],
    Python: [["type checking", "only by mypy/pyright; the interpreter ignores T"], ["isinstance(x, list[int])", "TypeError: isinstance() argument 2 cannot be a parameterized generic"], ["Stack[int]().push('oops')", "runs fine at run time"], ["what T is good for", "documentation + static analysis"]],
    Go: [["Stack[int] stores raw ints", "yes"], ["how many bodies", "one per GC shape + a dictionary; all pointer types share one shape"], ["methods with their own type params", "no: only functions and types take type params"], ["type switch on T", "only via any(x).(type)"]],
    TypeScript: [["types at run time", "none: erased to plain JS"], ["T in typeof / instanceof", "no: pass a class or a type guard"], ["Stack<number>.push('x')", "tsc error; at run time anything goes (e.g. JSON input)"], ["conditional / mapped types", "yes: very expressive compile-time computation"]],
  };
  function simulateGenerics(lang, names) {
    const bodies = [], assign = [], frames = [];
    const body = (key, desc) => { let b = bodies.find((x) => x.key === key); if (!b) { b = { key, desc, n: 0 }; bodies.push(b); } b.n++; return bodies.indexOf(b); };
    for (const nm of names) {
      const isPrim = nm in PRIM, isVal = isPrim && PRIM[nm] === 1;
      const shown = isPrim ? GMAP[lang][nm] : lang === "Go" ? "*" + nm : nm;
      let k, why;
      if (lang === "C#") {
        if (isVal) { k = body(`Stack<${shown}>`, "machine code specialized for this value type"); why = `${shown} is a value type, so RyuJIT compiles a <b>separate body</b> for Stack&lt;${shown}&gt;: items is a real ${shown}[], no boxing.`; }
        else { k = body("Stack<__Canon>", "one body shared by every reference type"); why = `${shown} is a reference type. All references are the same size, so it <b>shares</b> the __Canon body; the exact type is still known at run time.`; }
      } else if (lang === "Java") {
        k = body("Stack (erased)", "one body; T became Object"); why = isVal ? `<b>Stack&lt;${nm}&gt; is not allowed</b>; you write Stack&lt;${shown}&gt; and every value is <b>boxed</b> into a heap object. T is erased to Object.` : `T is <b>erased</b> to Object. Stack&lt;${shown}&gt; and every other Stack share one class; casts are inserted at call sites.`;
      } else if (lang === "Go") {
        const shape = isPrim ? shown : "pointer";
        k = body(`Stack[${shape === "pointer" ? "go.shape.*uint8" : "go.shape." + shape}]`, shape === "pointer" ? "one stencil for all pointer types + a dictionary" : `stencil for ${shape}-shaped types`);
        why = shape === "pointer" ? `${shown} is a pointer. All pointers have the same <b>GC shape</b>, so they share one instantiation and a dictionary supplies the type-specific details.` : `${shown} has its own GC shape, so the compiler <b>stencils</b> a body for it.`;
      } else {
        k = body(lang === "Python" ? "Stack (one class)" : "Stack (plain JS)", lang === "Python" ? "one class object; T is only a hint" : "one JS class; T erased by tsc");
        why = lang === "Python" ? `Stack[${shown}] is the same class at run time; the subscript only creates an alias for type checkers. Nothing stops pushing a str.` : `tsc checks Stack&lt;${shown}&gt; then <b>erases</b> it. At run time there is just one class and arrays of any values.`;
      }
      assign.push({ t: shown, k });
      frames.push({ bodies: Viz.clone(bodies), assign: [...assign], cur: assign.length - 1, line: 4, note: why, vars: { "type arg": shown, body: bodies[k].key, "bodies so far": bodies.length } });
    }
    frames.push({ bodies, assign, cap: GCAP[lang], line: [0, 1, 2, 3], note: `<b>${names.length}</b> type arguments → <b>${bodies.length}</b> compiled bod${bodies.length === 1 ? "y" : "ies"}. The table shows what that design lets you do at run time.`, vars: { "type args": names.length, bodies: bodies.length } });
    return frames;
  }
  Viz.register(S + "generics", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS);
    return {
      sig: lang, title: "Generics: reified, erased, stenciled, or hints", tag: "SIMULATION · INSTANTIATION",
      legend: [["active", "type argument being instantiated"], ["done", "compiled body"]],
      code: GCODE[lang], codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "types", label: "type args (int long double bool string or ClassName)", value: v.types ?? "int, string, Customer, double, Order", width: 300 }],
      build: (i) => {
        const names = String(i.types).split(/[\s,]+/).filter(Boolean);
        if (!names.length || names.length > 7) throw new Error("Use 1–7 type names.");
        for (const n of names) if (!(n in PRIM) && !/^[A-Z][A-Za-z0-9]{0,15}$/.test(n)) throw new Error(`"${n}": use int, long, double, bool, string, or a Capitalized class name.`);
        return simulateGenerics(pick(i.lang, LANGS), names);
      },
      random: () => ({ types: Array.from({ length: Viz.rand(3, 6) }, () => ["int", "long", "double", "bool", "string", "Customer", "Order", "Money"][Viz.rand(0, 7)]).join(", ") }),
      render: (f) => {
        const W = 700, rows = Math.max(f.assign.length, f.bodies.length), H = 30 + rows * 46;
        let s = `<svg class="dg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="type arguments mapped to compiled bodies"><text x="20" y="16" class="small muted">type argument</text><text x="330" y="16" class="small muted">compiled body at run time</text>`;
        f.bodies.forEach((b, k) => { s += `<rect x="330" y="${26 + k * 46}" width="350" height="36" rx="8" class="box done"/><text x="342" y="${42 + k * 46}" class="mono small">${esc(b.key)}</text><text x="342" y="${56 + k * 46}" class="small muted">${esc(b.desc)}</text>`; });
        f.assign.forEach((a, k) => { s += `<rect x="20" y="${26 + k * 46}" width="160" height="36" rx="8" class="box ${k === f.cur ? "active" : "accent"}"/><text x="100" y="${49 + k * 46}" text-anchor="middle" class="mono small">${esc(a.t)}</text>${arrow(180, 44 + k * 46, 330, 44 + a.k * 46, k === f.cur ? "x" : "")}`; });
        s += "</svg>";
        const cap = f.cap ? `<table class="lmm-tbl"><tbody>${f.cap.map(([q, a]) => `<tr><th>${esc(q)}</th><td>${esc(a)}</td></tr>`).join("")}</tbody></table>` : "";
        return `<div class="lmm-fit">${s}</div>${cap}`;
      },
    };
  }, { lang: "C#", types: "int, string, Customer, double, Order" }));

  /* ================= 7. nullability: who catches the missing value, and when ================= */
  const NUL = {
    "C#": { on: "#nullable enable", off: "#nullable disable", decl: "User? Find(int id) => db.Users.Find(id);", call: "var user = Find(42);", guard: "if (user is null) return NotFound();", use: "Console.WriteLine(user.Name);",
      diag: "warning CS8602: Dereference of a possibly null reference.", diagLvl: "warning (make it an error with <WarningsAsErrors>nullable</WarningsAsErrors>)", crash: "System.NullReferenceException: Object reference not set to an instance of an object.", checker: "Nullable reference types (NRT)" },
    Java: { on: "// @NullMarked + NullAway in the build", off: "// plain javac", decl: "@Nullable User find(int id) { return users.get(id); }", call: "User user = find(42);", guard: "if (user == null) return notFound();", use: "System.out.println(user.getName());",
      diag: "error: [NullAway] dereferenced expression user is @Nullable", diagLvl: "error from an add-on checker (javac itself has no null analysis)", crash: 'java.lang.NullPointerException: Cannot invoke "User.getName()" because "user" is null', checker: "JSpecify annotations + NullAway" },
    Python: { on: "# mypy --strict in CI", off: "# no type checker", decl: "def find(id: int) -> User | None: ...", call: "user = find(42)", guard: "if user is None: return not_found()", use: "print(user.name)",
      diag: 'error: Item "None" of "User | None" has no attribute "name"  [union-attr]', diagLvl: "error, but only if you run mypy/pyright", crash: "AttributeError: 'NoneType' object has no attribute 'name'", checker: "mypy / pyright" },
    Go: { on: "// nilaway ./... in CI", off: "// go vet only", decl: "func find(id int) *User { /* nil if missing */ }", call: "user := find(42)", guard: "if user == nil { return ErrNotFound }", use: "fmt.Println(user.Name)",
      diag: "error: Potential nil panic detected. Observed nil flow from source to dereference point", diagLvl: "error from an add-on analyzer (the compiler does not track nil)", crash: "panic: runtime error: invalid memory address or nil pointer dereference", checker: "nilaway (Uber)" },
    TypeScript: { on: '// tsconfig: "strict": true', off: '// tsconfig: "strictNullChecks": false', decl: "function find(id: number): User | null { ... }", call: "const user = find(42);", guard: "if (user === null) return notFound();", use: "console.log(user.name);",
      diag: "error TS18047: 'user' is possibly 'null'.", diagLvl: "compile error", crash: "TypeError: Cannot read properties of null (reading 'name')", checker: "strictNullChecks" },
  };
  const nulCode = (lang, chk, guard) => { const N = NUL[lang]; return [chk ? N.on : N.off, N.decl, N.call, ...(guard ? [N.guard] : []), N.use]; };
  Viz.register(S + "nullability", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), chk = (v.chk ?? "on") === "on", guard = (v.guard ?? "no") === "yes";
    const N = NUL[lang], code = nulCode(lang, chk, guard), useLine = code.length - 1;
    return {
      sig: `${lang}|${chk}|${guard}`, title: "Nullability: compile-time warning, or run-time crash?", tag: "SIMULATION · FLOW ANALYSIS",
      legend: [["done", "safe"], ["path", "caught early"], ["bad", "crash in production"]],
      code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "chk", label: "null checker", type: "select", options: ["on", "off"], value: chk ? "on" : "off" }, { key: "guard", label: "null guard?", type: "select", options: ["no", "yes"], value: guard ? "yes" : "no" }, { key: "ret", label: "find(42) returns", type: "select", options: ["a user", "null / None / nil"], value: v.ret ?? "null / None / nil" }],
      build: (i) => {
        const missing = i.ret !== "a user";
        const frames = [];
        let state = "unknown";
        frames.push({ lanes: ["active", "", ""], line: [1, 2], note: `The signature says it: <code>${esc(N.decl)}</code>. The <b>type</b> admits "no user". The question is who notices.`, vars: { "user type": lang === "Go" ? "*User (nil-able)" : lang === "Java" ? "User (@Nullable)" : "User or null" } });
        for (let ln = 2; ln < code.length; ln++) {
          if (code[ln] === N.guard) { state = "checked"; frames.push({ lanes: ["done", "active", ""], line: ln, note: "Flow analysis sees the guard: after this line the checker <b>narrows</b> user to non-null, so the dereference below is proven safe.", vars: { "user after guard": "User (non-null)" } }); }
        }
        let diag = null;
        if (chk && state !== "checked") diag = N.diag;
        frames.push({ lanes: ["done", diag ? "path" : "done", ""], line: useLine, diag, note: chk ? (diag ? `<b>${esc(N.checker)}</b> flags the dereference: <code>${esc(diag)}</code> (${esc(N.diagLvl)}). Fix it here and the crash never reaches production.` : `${esc(N.checker)} is happy: every path to <code>user.${lang === "Java" ? "getName()" : lang === "Go" ? "Name" : "name"}</code> is guarded.`) : `No checker: ${lang === "C#" ? "with NRT disabled every reference is silently nullable" : lang === "TypeScript" ? "without strictNullChecks, null is assignable to every type" : lang === "Java" ? "javac does not analyze null" : lang === "Go" ? "the Go compiler does not track nil" : "Python never checks hints at run time"}. <b>Nothing is reported.</b>`, vars: { diagnostic: diag ? "reported" : "none" } });
        let res, cls;
        if (!missing) { res = "prints the user's name"; cls = "done"; }
        else if (guard) { res = "takes the not-found branch: handled"; cls = "done"; }
        else { res = N.crash; cls = "bad"; }
        frames.push({ lanes: ["done", diag ? "path" : "done", cls], line: missing && guard ? 3 : useLine, diag, res, note: missing ? (guard ? "At run time find returns nothing and the guard handles it. The type system pushed you to write that branch." : `At run time find returns nothing and the dereference fails: <code>${esc(N.crash)}</code>.${diag ? " The checker warned you; the warning was ignored." : " Nobody warned you."}`) : `This time find returns a user, so it works${guard ? "" : diag ? ", but the warning is right: the next missing id crashes" : ", which is how null bugs survive testing"}.`, vars: { "find(42)": missing ? "null" : "User", outcome: cls === "bad" ? "crash" : "ok" } });
        return frames;
      },
      random: () => ({ ret: Math.random() < 0.6 ? "null / None / nil" : "a user" }),
      render: (f) => {
        const lanes = ["write code", `check (${N.checker})`, "run"];
        const boxes = lanes.map((l, k) => `<div class="lmm-lane ${f.lanes[k]}"><b>${esc(l)}</b>${k === 1 ? `<span>${f.diag ? esc(f.diag) : f.lanes[1] ? (chk ? "no diagnostics" : "no checker configured") : ""}</span>` : k === 2 ? `<span>${esc(f.res || "")}</span>` : `<span>${esc(N.decl)}</span>`}</div>`).join('<span class="lmm-sep">→</span>');
        return `<div class="lmm-lanes">${boxes}</div>`;
      },
    };
  }, { lang: "C#", chk: "on", guard: "no", ret: "null / None / nil" }));

  /* ================= 8. strings: immutable, so naive += copies ================= */
  const STR = {
    "C#": { naive: "quadratic", fast: "builder", code: ['string s = "";', "for (int i = 0; i < k; i++) s += piece;      // naive", "", "var sb = new StringBuilder();", "for (int i = 0; i < k; i++) sb.Append(piece);", "string t = sb.ToString();"] },
    Java: { naive: "quadratic", fast: "builder", code: ['String s = "";', "for (int i = 0; i < k; i++) s += piece;      // naive", "", "var sb = new StringBuilder();", "for (int i = 0; i < k; i++) sb.append(piece);", "String t = sb.toString();"] },
    Python: { naive: "inplace", fast: "join", code: ['s = ""', "for _ in range(k): s += piece      # naive", "", "parts = []", "for _ in range(k): parts.append(piece)", 't = "".join(parts)'] },
    Go: { naive: "quadratic", fast: "builder", code: ['s := ""', "for i := 0; i < k; i++ { s += piece }     // naive", "", "var b strings.Builder", "for i := 0; i < k; i++ { b.WriteString(piece) }", "t := b.String()"] },
    TypeScript: { naive: "rope", fast: "join", code: ['let s = "";', "for (let i = 0; i < k; i++) s += piece;    // naive", "", "const parts: string[] = [];", "for (let i = 0; i < k; i++) parts.push(piece);", 'const t = parts.join("");'] },
  };
  function stringCosts(lang, k, L) {
    const S2 = STR[lang], naive = [0], fast = [0];
    let len = 0, a = 0, b = 0, cap = 16, capN = 16;
    for (let i = 1; i <= k; i++) {
      if (S2.naive === "quadratic") a += len + L;
      else if (S2.naive === "inplace") { if (len + L > capN) { capN = Math.max(capN * 2, len + L); a += len; } a += L; }
      else { a += L; if (i === k) a += len + L; }
      if (S2.fast === "builder") { if (len + L > cap) { cap = Math.max(cap * 2, len + L); b += len; } b += L; if (i === k) b += len + L; }
      else { b += 0; if (i === k) b += len + L; }
      len += L; naive.push(a); fast.push(b);
    }
    return { naive, fast };
  }
  Viz.register(S + "strings", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS);
    return {
      sig: lang, title: "Strings are immutable: what s += piece really costs", tag: "SIMULATION · CHARACTERS COPIED",
      legend: [["bad", "naive +="], ["done", lang === "Python" || lang === "TypeScript" ? "collect + join" : "builder"]],
      code: STR[lang].code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "k", label: "pieces k (1–5000)", value: v.k ?? "2000", width: 100 }, { key: "L", label: "piece length (1–50)", value: v.L ?? "10", width: 90 }],
      build: (i) => {
        const k = Viz.parse.int(i.k, { min: 1, max: 5000 }), L = Viz.parse.int(i.L, { min: 1, max: 50 });
        const c = stringCosts(lang, k, L), frames = [];
        const marks = []; for (let m = 1; m < k; m *= 4) marks.push(m); marks.push(k);
        const kind = STR[lang].naive;
        marks.forEach((m, idx) => {
          const last = idx === marks.length - 1;
          const ratio = c.fast[m] ? (c.naive[m] / c.fast[m]).toFixed(1) : "∞";
          const note = !last ? `After <b>${m}</b> pieces the string is ${m * L} chars. Naive has copied <b>${c.naive[m].toLocaleString()}</b> chars so far${kind === "quadratic" ? ": each += allocates a new string and copies everything before it" : kind === "rope" ? ": V8 builds a <b>rope</b> (a tree of pieces) instead of copying" : ": CPython resizes in place when nothing else references s"}.`
            : kind === "quadratic" ? `Final: naive copied <b>${c.naive[m].toLocaleString()}</b> chars (≈ L·k²/2, quadratic), the builder <b>${c.fast[m].toLocaleString()}</b> (linear, amortized doubling). ${ratio}× more work, plus ${m} garbage strings for the GC.`
            : kind === "rope" ? `Final: V8 ropes make naive += roughly <b>linear</b> (${c.naive[m].toLocaleString()} chars, one flatten at the end). join is also linear. Both fine in JS; this is an engine optimization, not a language guarantee.`
            : `Final: CPython's in-place resize makes naive += roughly linear here (${c.naive[m].toLocaleString()} chars), but it is a <b>CPython implementation detail</b> that breaks if another name references s, and PyPy does not do it. PEP 8: use "".join().`;
          frames.push({ c, m, k, last, line: last ? [1, 4, 5] : [1, 4], note, vars: { pieces: m, "naive copies": c.naive[m], [lang === "Python" || lang === "TypeScript" ? "join copies" : "builder copies"]: c.fast[m], ratio } });
        });
        return frames;
      },
      random: () => ({ k: String(Viz.rand(100, 5000)), L: String(Viz.rand(1, 30)) }),
      render: (f) => {
        const W = 640, H = 230, px = 60, py = 16, pw = W - 90, ph = H - 50, max = Math.max(1, f.c.naive[f.k], f.c.fast[f.k]);
        const pt = (i, y) => `${(px + (i / f.k) * pw).toFixed(1)},${(py + ph - (y / max) * ph).toFixed(1)}`;
        const step = Math.max(1, Math.floor(f.k / 200));
        const line = (arr) => { const p = []; for (let i = 0; i <= f.m; i += step) p.push(pt(i, arr[i])); p.push(pt(f.m, arr[f.m])); return p.join(" "); };
        let s = `<svg class="dg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="characters copied versus pieces appended">`;
        s += `<line x1="${px}" y1="${py + ph}" x2="${px + pw}" y2="${py + ph}" class="edge"/><line x1="${px}" y1="${py}" x2="${px}" y2="${py + ph}" class="edge"/>`;
        s += `<text x="${px + pw}" y="${H - 14}" text-anchor="end" class="small muted">pieces appended → ${f.k}</text><text x="${px - 6}" y="${py + 10}" text-anchor="end" class="small muted">${max.toLocaleString()}</text><text x="${px - 6}" y="${py + ph}" text-anchor="end" class="small muted">0</text>`;
        s += `<polyline points="${line(f.c.naive)}" class="edge bad" fill="none"/><polyline points="${line(f.c.fast)}" class="edge done" fill="none"/>`;
        s += `<line x1="${pt(f.m, 0).split(",")[0]}" y1="${py}" x2="${pt(f.m, 0).split(",")[0]}" y2="${py + ph}" class="edge dash"/>`;
        s += "</svg>";
        return `<div class="lmm-fit">${s}</div>${chips(chip("naive", f.c.naive[f.m].toLocaleString() + " chars copied", "bad"), chip(lang === "Python" || lang === "TypeScript" ? "join" : "builder", f.c.fast[f.m].toLocaleString() + " chars copied", "done"))}`;
      },
    };
  }, { lang: "Java", k: "2000", L: "10" }));
})();
