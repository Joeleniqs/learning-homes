/* Error handling: visualizers. Every frame comes from running a small model of the runtime rule being taught. */
(() => {
  const S = "error-handling-";
  const esc = Viz.esc;
  const LANGS = ["C#", "Java", "Python", "Go", "TypeScript"];
  const LID = { "C#": "csharp", Java: "java", Python: "python", Go: "go", TypeScript: "typescript" };
  const pick = (v, opts) => (opts.includes(v) ? v : opts[0]);
  const chip = (k, v, cls = "") => `<span class="eh-chip ${cls}"><b>${esc(k)}</b> ${esc(v)}</span>`;
  const chips = (...c) => `<div class="eh-chips">${c.filter(Boolean).join("")}</div>`;
  /* Code listings carry «label» markers at the end of a line so the model can point at lines by name. */
  function listing(lines) {
    const code = [], at = {};
    lines.forEach((l, k) => {
      const m = l.match(/«([\w,]+)»\s*$/);
      if (m) m[1].split(",").forEach((id) => (at[id] = k));
      code.push(l.replace(/\s*«[\w,]+»\s*$/, ""));
    });
    return { code, at };
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
      cfg.render = (f, ctx) => (f.pending ? '<div class="eh-muted">…</div>' : render(f, ctx));
      Viz.player(inner, cfg);
      inner.querySelector(".viz-inputs")?.addEventListener("change", (e) => { if (e.target.tagName === "SELECT") e.target.form.requestSubmit(); });
    };
    mount(init);
  }
  const stateCls = (s) => (/handled|recovered|ok|success|200|201|logged once/.test(s) ? "done" : /ran|closed|retry|waiting out/.test(s) ? "visit" : /rethrew|re-panicked|not guaranteed|false|lost|crash|fail|replaced/.test(s) ? "bad" : /no match|skipped|nil|not run/.test(s) ? "dim" : /true|match|current/.test(s) ? "active" : "");

  /* ================= 1. unwind: the order try / catch / finally / using / defer really run in ================= */
  const UNW = ["step() succeeds", "step() fails: not found", "step() fails: disk busy (transient)", "step() fails: disk full (not transient)", "step() fails: broken invariant (a bug)"];
  const UEX = [null, { k: "nf", msg: "order 42 not found" }, { k: "io", msg: "disk busy", transient: true }, { k: "io", msg: "disk full", transient: false }, { k: "inv", msg: "cart total is negative" }];
  const EXN = {
    "C#": { nf: "NotFoundException", io: "IOException", inv: "InvalidOperationException" },
    Java: { nf: "NotFoundException", io: "IOException", inv: "IllegalStateException" },
    Python: { nf: "NotFoundError", io: "OSError", inv: "RuntimeError" },
    Go: { nf: "ErrNotFound", io: "ErrIO", inv: "errInvariant" },
    TypeScript: { nf: "NotFoundError", io: "IOError", inv: "Error" },
  };
  const UCODE = {
    "C#": [
      "static void Main() {",
      "    try {",
      "        Handle();«M_call»",
      "        WriteLine(\"main: done\");«M_after»",
      "    }",
      "    catch (IOException e) when (IsTransient(e)) {«Mc_test»",
      "        WriteLine($\"main: retry later ({e.Message})\");«Mc_body»",
      "    }",
      "    finally { WriteLine(\"main: finally\"); }«Mf»",
      "}",
      "static int Handle() {",
      "    using var file = OpenFile();  // disposed at }«H_res»",
      "    try {",
      "        Step();«H_call»",
      "        WriteLine(\"handle: after step\");«H_after»",
      "        return 1;",
      "    }",
      "    catch (NotFoundException) { return 0; }«Hc_test,Hc_body»",
      "    finally { WriteLine(\"handle: finally\"); }«Hf»",
      "}«Hd»",
      "static void Step() => Disk.Read();  // may throw«S»",
    ],
    Java: [
      "static void main(String[] a) throws IOException {",
      "    try {",
      "        handle();«M_call»",
      "        out.println(\"main: done\");«M_after»",
      "    } catch (IOException e) {«Mc_test»",
      "        if (!isTransient(e)) throw e;   // rethrow«Mc_guard»",
      "        out.println(\"main: retry later: \" + e.getMessage());«Mc_body»",
      "    } finally {",
      "        out.println(\"main: finally\");«Mf»",
      "    }",
      "}",
      "static int handle() throws IOException {",
      "    try (var file = openFile()) {«H_res»",
      "        try {",
      "            step();«H_call»",
      "            out.println(\"handle: after step\");«H_after»",
      "            return 1;",
      "        } catch (NotFoundException e) {  // unchecked«Hc_test»",
      "            return 0;«Hc_body»",
      "        } finally {",
      "            out.println(\"handle: finally\");«Hf»",
      "        }",
      "    }   // file.close() runs here«Hd»",
      "}",
      "static void step() throws IOException { disk.read(); }«S»",
    ],
    Python: [
      "def main():",
      "    try:",
      "        handle()«M_call»",
      "        print(\"main: done\")«M_after»",
      "    except OSError as e:«Mc_test»",
      "        if not is_transient(e):",
      "            raise              # re-raise as is«Mc_guard»",
      "        print(f\"main: retry later ({e})\")«Mc_body»",
      "    finally:",
      "        print(\"main: finally\")«Mf»",
      "",
      "def handle():",
      "    with open_file() as file:  # __exit__ on leave«H_res,Hd»",
      "        try:",
      "            step()«H_call»",
      "            print(\"handle: after step\")«H_after»",
      "            return 1",
      "        except NotFoundError:«Hc_test»",
      "            return 0«Hc_body»",
      "        finally:",
      "            print(\"handle: finally\")«Hf»",
      "",
      "def step(): disk.read()   # may raise«S»",
    ],
    Go: [
      "func main() {",
      "    defer fmt.Println(\"main: deferred cleanup\")«Mf»",
      "    defer func() {«Md»",
      "        if r := recover(); r != nil {«Mc_test»",
      "            if !isTransient(r) { panic(r) } // re-panic«Mc_guard»",
      "            fmt.Println(\"main: retry later:\", r)«Mc_body»",
      "        }",
      "    }()",
      "    handle()«M_call»",
      "    fmt.Println(\"main: done\")«M_after»",
      "}",
      "func handle() int {",
      "    file := openFile()«H_res»",
      "    defer file.Close()«Hd»",
      "    defer func() {«Hdef»",
      "        if r := recover(); r != nil {«Hc_test»",
      "            if !isNotFound(r) { panic(r) }«Hc_guard»",
      "            fmt.Println(\"handle: recovered\")«Hc_body»",
      "        }",
      "    }()",
      "    defer fmt.Println(\"handle: deferred\")«Hf»",
      "    step()«H_call»",
      "    fmt.Println(\"handle: after step\")«H_after»",
      "    return 1",
      "}",
      "func step() { disk.MustRead() } // panics on failure«S»",
    ],
    TypeScript: [
      "function main(): void {",
      "  try {",
      "    handle();«M_call»",
      "    console.log(\"main: done\");«M_after»",
      "  } catch (e) {«Mc_test»",
      "    if (!(e instanceof IOError) || !isTransient(e)) throw e;«Mc_guard»",
      "    console.log(`main: retry later (${e.message})`);«Mc_body»",
      "  } finally {",
      "    console.log(\"main: finally\");«Mf»",
      "  }",
      "}",
      "function handle(): number {",
      "  const file = openFile();«H_res»",
      "  try {",
      "    try {",
      "      step();«H_call»",
      "      console.log(\"handle: after step\");«H_after»",
      "      return 1;",
      "    } catch (e) {«Hc_test»",
      "      if (!(e instanceof NotFoundError)) throw e;«Hc_guard»",
      "      return 0;«Hc_body»",
      "    } finally {",
      "      console.log(\"handle: finally\");«Hf»",
      "    }",
      "  } finally {",
      "    file.close();  // or `using file = …` (TS 5.2+)«Hd»",
      "  }",
      "}",
      "function step(): void { disk.read(); } // may throw«S»",
    ],
  };
  function unwChain(lang) {
    const E = EXN[lang];
    if (lang === "Go") return [
      { id: "Hf", fn: "handle", kind: "finally", label: "defer Println(\"handle: deferred\")", print: "handle: deferred" },
      { id: "Hc", fn: "handle", kind: "recover", label: "defer recover() if isNotFound", match: (x) => x.k === "nf", print: () => "handle: recovered" },
      { id: "Hd", fn: "handle", kind: "dispose", label: "defer file.Close()" },
      { id: "ret", fn: "handle", kind: "ret" },
      { id: "Mc", fn: "main", kind: "recover", label: "defer recover() if isTransient", match: (x) => x.k === "io" && x.transient, print: (x) => `main: retry later: ${x.msg}` },
      { id: "Mf", fn: "main", kind: "finally", label: "defer Println(\"main: deferred cleanup\")", print: "main: deferred cleanup" },
    ];
    const ts = lang === "TypeScript";
    const disp = { "C#": "using → file.Dispose()", Java: "try-with-resources → file.close()", Python: "with → file.__exit__()", TypeScript: "finally → file.close()" }[lang];
    return [
      { id: "Hc", fn: "handle", kind: "catch", types: ts ? ["*"] : ["nf"], guard: ts ? (x) => x.k === "nf" : null, label: ts ? "catch (e), rethrow unless NotFoundError" : lang === "Python" ? `except ${E.nf}` : `catch (${E.nf})` },
      { id: "Hf", fn: "handle", kind: "finally", label: "finally (handle)", print: "handle: finally" },
      { id: "Hd", fn: "handle", kind: "dispose", label: disp },
      { id: "ret", fn: "handle", kind: "ret" },
      { id: "Mc", fn: "main", kind: "catch", types: ts ? ["*"] : ["io"], filter: lang === "C#" ? (x) => x.transient : null, guard: lang === "C#" ? null : ts ? (x) => x.k === "io" && x.transient : (x) => x.transient,
        label: lang === "C#" ? "catch (IOException) when IsTransient" : ts ? "catch (e), rethrow unless transient IOError" : lang === "Python" ? "except OSError, re-raise unless transient" : "catch (IOException), rethrow unless transient", print: (x) => `main: retry later${lang === "Java" || lang === "Go" ? ":" : ""} ${lang === "Java" || lang === "Go" ? x.msg : `(${x.msg})`}` },
      { id: "Mf", fn: "main", kind: "finally", label: "finally (main)", print: "main: finally" },
    ];
  }
  function crashText(lang, x) {
    const E = EXN[lang];
    return {
      "C#": [`Unhandled exception. System.${x.k === "io" ? "IO." : x.k === "inv" ? "" : "App."}${E[x.k]}: ${x.msg}`, "   at Program.Step()", "   at Program.Handle()", "   at Program.Main()", "(process terminated, exit code ≠ 0)"],
      Java: [`Exception in thread "main" ${x.k === "io" ? "java.io." : x.k === "inv" ? "java.lang." : ""}${E[x.k]}: ${x.msg}`, "\tat App.step(App.java)", "\tat App.handle(App.java)", "\tat App.main(App.java)"],
      Python: ["Traceback (most recent call last):", "  File \"app.py\", in main …", "  File \"app.py\", in handle …", "  File \"app.py\", in step …", `${E[x.k]}: ${x.msg}`],
      Go: [`panic: ${x.msg} [recovered]`, "", "goroutine 1 [running]:", "main.main()", "exit status 2"],
      TypeScript: [`${E[x.k]}: ${x.msg}`, "    at step (app.js)", "    at handle (app.js)", "    at main (app.js)", "(Node prints this and exits with code 1)"],
    }[lang];
  }
  function simulateUnwind(lang, sc) {
    const { at } = listing(UCODE[lang]);
    const E = EXN[lang], chain = unwChain(lang), go = lang === "Go", two = lang === "C#";
    const x = UEX[Math.max(0, UNW.indexOf(sc))];
    const frames = [], st = { stack: [{ fn: "main", st: "running" }], file: "not opened", out: [], hs: {}, ex: null, phase: "normal" };
    let retVal = 1;
    const word = go ? "panic" : "exception";
    const exName = (e) => (go ? `panic(${E[e.k]}: ${e.msg})` : `${E[e.k]}("${e.msg}")`);
    const snap = (lbl, note) => frames.push({
      lang, stack: Viz.clone(st.stack), file: st.file, out: [...st.out], hs: { ...st.hs }, phase: st.phase, ex: st.ex ? exName(st.ex) : null,
      line: [].concat(lbl).map((l) => at[l]).filter((n) => n !== undefined), note,
      vars: { [word]: st.ex ? E[st.ex.k] : "none", phase: st.phase, file: st.file, stack: st.stack.map((f) => f.fn).join(" → ") },
    });
    const RES = { "C#": "<code>using var</code> registers <code>file.Dispose()</code> to run when Handle's scope ends, on <b>every</b> exit path.", Java: "try-with-resources opens the file; <code>close()</code> runs when that block exits, on every path.", Python: "<code>with</code> calls <code>__enter__</code>; <code>__exit__</code> is guaranteed when the block is left, normally or by an exception.", Go: "The file is open. Nothing closes it yet: Go needs an explicit <code>defer</code>.", TypeScript: "The file is open; the outer <code>finally</code> guarantees <code>close()</code>. (TS 5.2+ can write <code>using file = openFile()</code> instead.)" };
    function run(decided) {
      for (const h of chain) {
        if (h.kind === "ret") {
          st.stack.pop();
          st.stack[0].st = st.ex ? "unwinding" : "running";
          if (!st.ex) { st.out.push("main: done"); snap("M_after", `handle returned <b>${retVal}</b>, so main carries on with the next statement${go ? ". main's own deferred calls wait until main exits" : ""}.`); }
          continue;
        }
        if (h.kind === "finally") {
          st.hs[h.id] = "ran"; st.out.push(h.print);
          snap(h.id, st.ex ? `<b>Unwinding:</b> the ${go ? "deferred call" : "finally block"} runs while the ${word} is still in flight. Afterwards the ${word} keeps travelling outwards.` : `The ${go ? "deferred call" : "finally block"} runs on the normal path too: it runs on <b>every</b> exit.`);
          continue;
        }
        if (h.kind === "dispose") {
          st.hs[h.id] = "ran"; st.file = "closed"; st.out.push("[file closed]");
          snap(h.id, `${st.ex ? "Still unwinding: " : ""}the file is closed${lang === "Go" ? " by the first-registered defer, so it runs last (LIFO)" : ""}. Cleanup does not depend on whether anyone catches the ${word}.`);
          continue;
        }
        if (h.kind === "recover") {
          if (!st.ex) { st.hs[h.id] = "recover() = nil"; snap(`${h.id}_test`, "The deferred function runs, and <code>recover()</code> returns nil because nothing is panicking."); continue; }
          if (h.match(st.ex)) {
            st.hs[h.id] = "recovered"; st.out.push(h.print(st.ex)); st.ex = null; st.phase = "recovered"; if (h.fn === "handle") retVal = 0;
            snap([`${h.id}_test`, `${h.id}_body`], `<code>recover()</code> stops the panic. ${h.fn === "handle" ? "handle now returns normally, with its zero value 0. The rest of its deferred calls still run" : "main returns normally; its last deferred call still runs"}.`);
            continue;
          }
          st.hs[h.id] = "re-panicked";
          snap([`${h.id}_test`, `${h.id}_guard`], "<code>recover()</code> caught the value, but this guard does not handle that kind, so it calls <code>panic(r)</code> again. The remaining deferred calls still run.");
          continue;
        }
        if (!st.ex) { st.hs[h.id] = "skipped"; continue; }
        if (decided && h.id !== decided) continue;
        const typeOk = h.types.includes("*") || h.types.includes(st.ex.k);
        if (!decided && !typeOk) {
          st.hs[h.id] = "no match";
          snap(`${h.id}_test`, `<code>${esc(h.label)}</code> does not match ${E[st.ex.k]}, so it is skipped and unwinding continues.`);
          continue;
        }
        if (!decided && h.guard && !h.guard(st.ex)) {
          st.hs[h.id] = "rethrew";
          snap([`${h.id}_test`, `${h.id}_guard`], `${lang === "TypeScript" ? "<code>catch (e)</code> catches <b>everything</b> (TypeScript has no typed catch), so it" : "The type matches, so the catch is entered. It"} checks the condition, fails, and rethrows. By now every inner finally has <b>already run</b>: whoever inspects the ${word} later sees the state after cleanup.`);
          continue;
        }
        st.hs[h.id] = "handled"; if (h.print) st.out.push(h.print(st.ex));
        st.ex = null; st.phase = "handled"; if (h.fn === "handle") retVal = 0;
        st.stack[st.stack.length - 1].st = "running";
        snap([`${h.id}_test`, `${h.id}_body`], `Handled by <code>${esc(h.label)}</code>. The exception is gone; ${h.fn === "handle" ? "handle will return 0, but its finally and cleanup still run first" : "main's finally still runs next"}.`);
      }
    }
    if (go) snap(["Mf", "Md"], "<code>defer</code> only <b>registers</b> a call. main's two deferred calls run when main exits, newest first, whether it returns or panics.");
    snap("M_call", `main calls <code>handle()</code>${go ? "" : " inside a <code>try</code>"}.`);
    st.stack.push({ fn: "handle", st: "running" }); st.file = "open";
    snap("H_res", RES[lang]);
    if (go) snap(["Hd", "Hdef", "Hf"], "handle registers three deferred calls: Close, the recover guard, then a print. They run LIFO: the print first, Close last.");
    st.stack.push({ fn: "step", st: "running" });
    snap(["H_call", "S"], "handle calls <code>step()</code>.");
    if (!x) {
      st.stack.pop(); st.out.push("handle: after step");
      snap("H_after", "step returned normally, so the next statement runs.");
      run(null);
    } else {
      st.ex = x; st.stack[2].st = "threw"; st.phase = go ? "panicking" : two ? "pass 1: search" : "unwinding";
      snap("S", go ? `step <b>panics</b> with ${E[x.k]}: "${x.msg}". Go now runs this goroutine's deferred calls, newest first, frame by frame.` : two ? `step throws <code>${exName(x)}</code>. .NET unwinds in <b>two passes</b>: pass 1 only <b>searches</b> for a handler (running filters); pass 2 then runs finally blocks and Dispose.` : `step throws <code>${exName(x)}</code>. The runtime walks outwards; each enclosing finally runs as the exception passes it.`);
      if (two) {
        let found = null;
        for (const h of chain) {
          if (h.kind !== "catch") continue;
          if (!h.types.includes(x.k)) { st.hs[h.id] = "no match (pass 1)"; snap(`${h.id}_test`, `<b>Pass 1:</b> <code>${esc(h.label)}</code> does not match. Nothing has run yet: no finally, no Dispose.`); continue; }
          if (h.filter) {
            const ok = h.filter(x); st.hs[h.id] = ok ? "filter: true" : "filter: false";
            snap(`${h.id}_test`, `<b>Pass 1:</b> the type matches, so the filter <code>IsTransient(e)</code> runs <b>now</b>, before any cleanup. handle's finally has not run, the file is still open, and the stack main → handle → step is intact. It returns <b>${ok}</b>${ok ? "" : ", so the search goes on outwards"}.`);
            if (!ok) continue;
          }
          found = h; break;
        }
        if (!found) {
          st.phase = "unhandled"; st.stack.forEach((f) => (f.st = "crashed"));
          chain.forEach((h) => { if (h.kind === "finally" || h.kind === "dispose") st.hs[h.id] = "not guaranteed"; });
          st.out.push(...crashText(lang, x));
          snap("S", "Pass 1 found <b>no handler</b>. .NET raises the unhandled-exception event and terminates the process. Pass 2 never happens, so finally blocks and Dispose are <b>not guaranteed to run</b>. Never rely on finally for anything that must survive a crash.");
          return frames;
        }
        st.phase = "pass 2: unwind"; st.stack.pop(); st.stack[1].st = "unwinding";
        snap(`${found.id}_test`, `<b>Pass 2:</b> a handler was chosen (<code>${esc(found.label)}</code>). Now the runtime unwinds towards it, running every finally and Dispose on the way.`);
        run(found.id);
      } else {
        st.stack.pop(); st.stack[1].st = "unwinding";
        run(null);
      }
    }
    if (st.ex) {
      st.phase = "crashed"; st.stack.forEach((f) => (f.st = "crashed")); st.out.push(...crashText(lang, st.ex));
      snap([], `No handler took it. The runtime prints the ${go ? "panic and goroutine trace" : "stack trace"} and exits with a failure code. Note that every ${go ? "deferred call" : "finally and cleanup"} <b>did</b> run on the way out.`);
    } else {
      st.phase = "done";
      snap([], `main returned: exit code 0. Read the console top to bottom: that is the exact order the blocks ran in.`);
    }
    return frames;
  }
  Viz.register(S + "unwind", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), sc = pick(v.s ?? UNW[2], UNW);
    return {
      sig: lang, title: "Stack unwinding: who runs, in what order", tag: "SIMULATION · THROW + UNWIND",
      legend: [["active", "being checked"], ["visit", "cleanup ran"], ["done", "handled"], ["bad", "rethrown / skipped by a crash"]],
      code: listing(UCODE[lang]).code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "s", label: "what step() does", type: "select", options: UNW, value: sc }],
      build: (i) => simulateUnwind(pick(i.lang, LANGS), pick(i.s, UNW)),
      random: () => ({ lang, s: UNW[Viz.rand(0, UNW.length - 1)] }),
      render: (f) => {
        const chain = unwChain(f.lang).filter((h) => h.kind !== "ret");
        const stack = f.stack.slice().reverse().map((fr) => `<div class="eh-frame ${fr.st}"><code>${esc(fr.fn)}()</code><small>${esc(fr.st)}</small></div>`).join("");
        const hs = chain.map((h) => { const s = f.hs[h.id] || ""; return `<div class="eh-h ${stateCls(s)}"><span class="eh-fn">${esc(h.fn)}</span><code>${esc(h.label)}</code><small>${esc(s || "waiting")}</small></div>`; }).join("");
        return `<div class="eh-row"><div class="eh-col"><div class="eh-caption">call stack</div>${stack}<div class="eh-res ${f.file.replace(" ", "-")}">file: ${esc(f.file)}</div></div>`
          + `<div class="eh-col grow"><div class="eh-caption">handlers, innermost first</div>${hs}</div></div>`
          + `<div class="eh-flight ${f.ex ? "" : "calm"}">${f.ex ? `in flight: <code>${esc(f.ex)}</code>` : "nothing in flight"} <small>${esc(f.phase)}</small></div>`
          + `<div class="eh-console"><div class="eh-caption">console</div><pre class="eh-out">${esc(f.out.join("\n") || " ")}</pre></div>`;
      },
    };
  }, {}));

  /* ================= 2. cleanup: LIFO disposal, and what happens when cleanup itself fails ================= */
  const CSC = ["everything succeeds", "work() fails", "work() fails, then B's close fails", "work() succeeds, A's close fails", "work(), B's close and A's close all fail"];
  const CFAIL = [{}, { work: 1 }, { work: 1, b: 1 }, { a: 1 }, { work: 1, b: 1, a: 1 }];
  const CCODE = {
    "C#": [
      "static void Process() {",
      "    using var a = Open(\"A\");   // a.Dispose() at }«oa»",
      "    using var b = Open(\"B\");   // b.Dispose() at }«ob»",
      "    Work(a, b);«work»",
      "}   // disposes b, then a«cb,ca»",
      "",
      "try { Process(); }«call»",
      "catch (Exception e) { Log(e); }«log»",
    ],
    Java: [
      "static void process() throws Exception {",
      "    try (var a = open(\"A\");«oa»",
      "         var b = open(\"B\")) {«ob»",
      "        work(a, b);«work»",
      "    }   // closes b, then a«cb,ca»",
      "}",
      "try { process(); }«call»",
      "catch (Exception e) { log(e, e.getSuppressed()); }«log»",
    ],
    Python: [
      "def process():",
      "    with open_res(\"A\") as a, open_res(\"B\") as b:«oa,ob»",
      "        work(a, b)«work»",
      "    # b.__exit__ runs, then a.__exit__«cb,ca»",
      "",
      "try:",
      "    process()«call»",
      "except Exception as e:",
      "    log(e, e.__context__)«log»",
    ],
    Go: [
      "func process() (err error) {",
      "    a, err := open(\"A\")«oa»",
      "    if err != nil { return err }",
      "    defer func() { err = errors.Join(err, a.Close()) }()«ca»",
      "    b, err := open(\"B\")«ob»",
      "    if err != nil { return err }",
      "    defer b.Close()   // returned error is ignored!«cb»",
      "    return work(a, b)«work»",
      "}",
      "if err := process(); err != nil { log(err) }«call,log»",
    ],
    TypeScript: [
      "function process(): void {",
      "  using a = open(\"A\");   // TS 5.2+ / ES2026«oa»",
      "  using b = open(\"B\");«ob»",
      "  work(a, b);«work»",
      "}  // b[Symbol.dispose](), then a's«cb,ca»",
      "",
      "try { process(); }«call»",
      "catch (e) { log(e); }   // maybe a SuppressedError«log»",
    ],
  };
  const CRULE = {
    "C#": "If Dispose throws while an exception is already in flight, the new exception <b>replaces</b> the old one. The original is gone.",
    Java: "try-with-resources keeps the <b>first</b> exception and attaches each close failure to it with <code>addSuppressed</code>.",
    Python: "A new exception raised in <code>__exit__</code> propagates, and Python links the previous one as its <code>__context__</code> (\"During handling of the above exception, another exception occurred\").",
    Go: "A plain <code>defer b.Close()</code> throws Close's error away. The <code>errors.Join</code> defer on <code>a</code> keeps both errors.",
    TypeScript: "When a disposer throws while an error is in flight, JavaScript wraps both in a <code>SuppressedError</code>: <code>.error</code> is the new one, <code>.suppressed</code> the old one.",
  };
  const errLine = (e) => (e ? `${e.t}: ${e.m}` : "nil");
  function combine(lang, cur, ne, lost, which) {
    if (!ne) return cur;
    if (lang === "Go") {
      if (which === "b") { lost.push(ne); return cur; }
      return cur ? { t: "errors.Join", m: `${cur.m}\n${ne.m}`, kids: [{ rel: "joined", e: cur }, { rel: "joined", e: ne }] } : ne;
    }
    if (!cur) return ne;
    if (lang === "C#") { lost.push(cur); return ne; }
    if (lang === "Java") { cur.kids.push({ rel: "suppressed", e: ne }); return cur; }
    if (lang === "Python") { ne.kids.push({ rel: "__context__", e: cur }); return ne; }
    return { t: "SuppressedError", m: "An error was suppressed during disposal.", kids: [{ rel: ".error", e: ne }, { rel: ".suppressed", e: cur }] };
  }
  function simulateCleanup(lang, sc) {
    const { at } = listing(CCODE[lang]);
    const F = CFAIL[Math.max(0, CSC.indexOf(sc))], frames = [], lost = [];
    const go = lang === "Go";
    const res = { A: "not opened", B: "not opened" };
    let cur = null;
    const mk = (t, m) => ({ t, m, kids: [] });
    const snap = (lbl, note, o = {}) => frames.push({ lang, res: { ...res }, cur: Viz.clone(cur), lost: Viz.clone(lost), line: [].concat(lbl).map((l) => at[l]).filter((n) => n !== undefined), note, vars: { "in flight": cur ? cur.t : "none", lost: lost.length, A: res.A, B: res.B }, ...o });
    snap("call", "The caller runs <code>process()</code>.");
    res.A = "open"; snap("oa", "A is opened first.");
    res.B = "open"; snap("ob", `B is opened second. Cleanup is registered as a <b>stack</b>: B will be released first, then A.`);
    if (F.work) { cur = go ? { t: "error", m: "work failed", kids: [] } : mk("WorkError", "work failed"); snap("work", `<code>work</code> ${go ? "returns an error" : "throws <code>WorkError</code>"}. Cleanup must still run for B and then A.`); }
    else snap("work", "<code>work</code> succeeds.");
    const close = (which) => {
      const R = which.toUpperCase();
      if (F[which]) {
        const ne = go ? { t: "error", m: `close ${R}: flush failed`, kids: [] } : mk("CloseError", `${R} close failed`);
        const before = lost.length, had = !!cur;
        cur = combine(lang, cur, ne, lost, which); res[R] = "close failed";
        const lostNow = lost.length > before;
        snap(which === "b" ? "cb" : "ca", `${R}'s close fails${had ? " <b>while another error is in flight</b>" : ""}. ${lostNow ? `<b>Lost:</b> ${go ? "nobody reads the error that Close returned" : "the earlier exception is replaced"}. ` : ""}${CRULE[lang]}`, { hot: which });
      } else { res[R] = "closed"; snap(which === "b" ? "cb" : "ca", `${R} is closed${cur ? " even though an error is in flight" : ""}. ${which === "b" ? "Last opened, first closed (LIFO)." : "First opened, last closed."}`, { hot: which }); }
    };
    close("b"); close("a");
    const all = [F.work && "WorkError", F.b && "CloseError(B)", F.a && "CloseError(A)"].filter(Boolean);
    const seen = [];
    const walk = (e) => { if (!e) return; if (e.t === "WorkError" || (go && e.m === "work failed")) seen.push("WorkError"); if (/close B|B close/.test(e.m) && e.t !== "errors.Join") seen.push("CloseError(B)"); if (/close A|A close/.test(e.m) && e.t !== "errors.Join") seen.push("CloseError(A)"); e.kids.forEach((k) => walk(k.e)); };
    walk(cur);
    snap("log", cur ? `The caller receives <b>${esc(cur.t)}</b>. It can see ${seen.length} of the ${all.length} failure${all.length === 1 ? "" : "s"}${seen.length < all.length ? `: <b>${all.filter((n) => !seen.includes(n)).join(", ")}</b> vanished without a trace` : ", nothing was lost"}.` : all.length ? `The caller sees <b>no error at all</b>: ${all.join(", ")} vanished. A failed flush on Close can mean data never reached the disk.` : "No error: both resources were released in reverse order of acquisition.", { final: true, seen, all });
    return frames;
  }
  function errTree(e) {
    if (!e) return '<div class="eh-err none">no error</div>';
    return `<div class="eh-err"><div class="eh-errh"><b>${esc(e.t)}</b> <span>${esc(e.m.split("\n").join(" + "))}</span></div>${e.kids.map((k) => `<div class="eh-kid"><small>${esc(k.rel)}</small>${errTree(k.e)}</div>`).join("")}</div>`;
  }
  Viz.register(S + "cleanup", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), sc = pick(v.s, CSC);
    return {
      sig: lang, title: "Cleanup order, and errors thrown by cleanup", tag: "SIMULATION · LIFO RELEASE",
      legend: [["active", "being released"], ["done", "released / reported"], ["bad", "failed or lost"]],
      code: listing(CCODE[lang]).code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "s", label: "scenario", type: "select", options: CSC, value: sc }],
      build: (i) => simulateCleanup(pick(i.lang, LANGS), pick(i.s, CSC)),
      random: () => ({ lang, s: CSC[Viz.rand(0, CSC.length - 1)] }),
      render: (f) => {
        const r = (n) => `<div class="eh-resbox ${f.hot === n.toLowerCase() ? "active" : ""} ${stateCls(f.res[n])}"><b>${n}</b><small>${esc(f.res[n])}</small></div>`;
        const lostHtml = f.lost.length ? f.lost.map((e) => `<div class="eh-lost">${esc(errLine(e))}</div>`).join("") : '<div class="eh-muted">nothing</div>';
        const fin = f.final ? chips(...f.all.map((n) => chip(f.seen.includes(n) ? "reported" : "lost", n, f.seen.includes(n) ? "done" : "bad"))) : "";
        return `<div class="eh-row center"><div class="eh-stackres"><div class="eh-caption">cleanup stack (top runs first)</div>${r("B")}${r("A")}</div>`
          + `<div class="eh-col grow"><div class="eh-caption">error in flight</div>${errTree(f.cur)}<div class="eh-caption">lost forever</div>${lostHtml}</div></div>${fin}`;
      },
    };
  }, {}));

  /* ================= 3. chain: wrap with context, drop the cause, swallow, or rethrow ================= */
  const CH = ["wrap and keep the cause", "wrap but drop the cause", "log and swallow", "rethrow unchanged"];
  const CHT = {
    "C#": {
      tpl: ["Order Find(int id) =>", "    throw new NotFoundException($\"no row with id {id}\");«repo»", "Order GetOrder(int id) {          // service", "    try { return Find(id); }", "    catch (NotFoundException e) {«svc_catch»", "{SVC}", "    }", "}", "decimal Get(int id) {             // handler", "    try { return GetOrder(id).Total; }«h_try»", "    catch (OrderException e) {«h_catch»", "{H}", "    }", "}", "// boundary middleware", "catch (Exception e) {", "    log.LogError(e, \"request failed\");«b_log»", "    return Has<NotFoundException>(e) ? 404 : 500;«b_map»", "}"],
      svc: [["        throw new OrderException($\"load order {id}\", e);«svc»"], ["        throw new OrderException($\"load order {id}: {e.Message}\");«svc»"], ["        log.LogWarning(e.Message);«svc»", "        return null!;   // \"it's fine\"«svc2»"], ["        throw;   // never `throw e;`: it resets the trace«svc»"]],
      h: [["        throw new ApiException($\"GET /orders/{id}\", e);«h»"], ["        throw new ApiException($\"GET /orders/{id}: {e.Message}\");«h»"], ["        throw new ApiException($\"GET /orders/{id}\", e);«h»"], ["        throw;«h»"]],
      names: { nf: "NotFoundException", svc: "OrderException", h: "ApiException" }, catchAll: false, rootMsg: "no row with id 42",
      symptom: { t: "NullReferenceException", m: "Object reference not set to an instance of an object." },
    },
    Java: {
      tpl: ["Order find(int id) {", "    throw new NotFoundException(\"no row with id \" + id);«repo»", "}", "Order getOrder(int id) {          // service", "    try { return find(id); }", "    catch (NotFoundException e) {«svc_catch»", "{SVC}", "    }", "}", "BigDecimal get(int id) {          // handler", "    try { return getOrder(id).total(); }«h_try»", "    catch (OrderException e) {«h_catch»", "{H}", "    }", "}", "// boundary filter", "catch (Exception e) {", "    log.error(\"request failed\", e);«b_log»", "    return hasCause(e, NotFoundException.class) ? 404 : 500;«b_map»", "}"],
      svc: [["        throw new OrderException(\"load order \" + id, e);«svc»"], ["        throw new OrderException(\"load order \" + id + \": \" + e.getMessage());«svc»"], ["        log.warn(e.getMessage());«svc»", "        return null;   // \"it's fine\"«svc2»"], ["        throw e;   // Java keeps the original trace«svc»"]],
      h: [["        throw new ApiException(\"GET /orders/\" + id, e);«h»"], ["        throw new ApiException(\"GET /orders/\" + id + \": \" + e.getMessage());«h»"], ["        throw new ApiException(\"GET /orders/\" + id, e);«h»"], ["        throw e;«h»"]],
      names: { nf: "NotFoundException", svc: "OrderException", h: "ApiException" }, catchAll: false, rootMsg: "no row with id 42",
      symptom: { t: "NullPointerException", m: "Cannot invoke \"Order.total()\" because the return value of \"getOrder(int)\" is null" },
    },
    Python: {
      tpl: ["def find(id):", "    raise NotFoundError(f\"no row with id {id}\")«repo»", "", "def get_order(id):                # service", "    try:", "        return find(id)", "    except NotFoundError as e:«svc_catch»", "{SVC}", "", "def get(id):                      # handler", "    try:", "        return get_order(id).total«h_try»", "    except OrderError as e:«h_catch»", "{H}", "", "# boundary middleware", "except Exception as e:", "    log.exception(\"request failed\")«b_log»", "    return 404 if has_cause(e, NotFoundError) else 500«b_map»"],
      svc: [["        raise OrderError(f\"load order {id}\") from e«svc»"], ["        raise OrderError(f\"load order {id}: {e}\") from None«svc»"], ["        log.warning(e)«svc»", "        return None   # \"it's fine\"«svc2»"], ["        raise   # bare raise keeps the traceback«svc»"]],
      h: [["        raise ApiError(f\"GET /orders/{id}\") from e«h»"], ["        raise ApiError(f\"GET /orders/{id}: {e}\") from None«h»"], ["        raise ApiError(f\"GET /orders/{id}\") from e«h»"], ["        raise«h»"]],
      names: { nf: "NotFoundError", svc: "OrderError", h: "ApiError" }, catchAll: false, rootMsg: "no row with id 42",
      symptom: { t: "AttributeError", m: "'NoneType' object has no attribute 'total'" },
    },
    Go: {
      tpl: ["func find(id int) (Order, error) {", "    return Order{}, ErrNotFound   // \"not found\"«repo»", "}", "func getOrder(id int) (Order, error) {   // service", "    o, err := find(id)", "    if err != nil {«svc_catch»", "{SVC}", "    }", "    return o, nil", "}", "func get(id int) (float64, error) {      // handler", "    o, err := getOrder(id)«h_try»", "    if err != nil {«h_catch»", "{H}", "    }", "    return o.Total, nil", "}", "// boundary middleware", "slog.Error(\"request failed\", \"err\", err)«b_log»", "if errors.Is(err, ErrNotFound) { return 404 }; return 500«b_map»"],
      svc: [["        return Order{}, fmt.Errorf(\"load order %d: %w\", id, err)«svc»"], ["        return Order{}, fmt.Errorf(\"load order %d: %v\", id, err)«svc»"], ["        slog.Warn(err.Error())«svc»", "        return Order{}, nil   // zero value, \"it's fine\"«svc2»"], ["        return Order{}, err«svc»"]],
      h: [["        return 0, fmt.Errorf(\"GET /orders/%d: %w\", id, err)«h»"], ["        return 0, fmt.Errorf(\"GET /orders/%d: %v\", id, err)«h»"], ["        return 0, fmt.Errorf(\"GET /orders/%d: %w\", id, err)«h»"], ["        return 0, err«h»"]],
      names: { nf: "ErrNotFound", svc: "*fmt.wrapError", h: "*fmt.wrapError" }, catchAll: true, rootMsg: "not found",
    },
    TypeScript: {
      tpl: ["function find(id: number): Order {", "  throw new NotFoundError(`no row with id ${id}`);«repo»", "}", "function getOrder(id: number): Order {   // service", "  try { return find(id); }", "  catch (e) {«svc_catch»", "{SVC}", "  }", "}", "function get(id: number): number {      // handler", "  try { return getOrder(id).total; }«h_try»", "  catch (e) {«h_catch»", "{H}", "  }", "}", "// boundary middleware", "catch (e) {", "  log.error(\"request failed\", e);«b_log»", "  return hasCause(e, NotFoundError) ? 404 : 500;«b_map»", "}"],
      svc: [["    throw new OrderError(`load order ${id}`, { cause: e });«svc»"], ["    throw new OrderError(`load order ${id}: ${(e as Error).message}`);«svc»"], ["    log.warn(e);«svc»", "    return null!;   // \"it's fine\"«svc2»"], ["    throw e;«svc»"]],
      h: [["    throw new ApiError(`GET /orders/${id}`, { cause: e });«h»"], ["    throw new ApiError(`GET /orders/${id}: ${(e as Error).message}`);«h»"], ["    throw new ApiError(`GET /orders/${id}`, { cause: e });«h»"], ["    throw e;«h»"]],
      names: { nf: "NotFoundError", svc: "OrderError", h: "ApiError" }, catchAll: true, rootMsg: "no row with id 42",
      symptom: { t: "TypeError", m: "Cannot read properties of null (reading 'total')" },
    },
  };
  const chainCode = (lang, k) => { const T = CHT[lang]; return T.tpl.flatMap((l) => (l === "{SVC}" ? T.svc[k] : l === "{H}" ? T.h[k] : [l])); };
  function logText(lang, e) {
    const list = []; for (let x = e; x; x = x.cause) list.push(x);
    if (lang === "Go") return [`level=ERROR msg="request failed" err="${e.m}"`];
    if (lang === "C#") return list.map((x, k) => `${k ? " ---> " : "fail: request failed\n"}${x.t}: ${x.m}`).join("\n").split("\n");
    if (lang === "Java") return list.map((x, k) => `${k ? "Caused by: " : "ERROR request failed\n"}${x.t}: ${x.m}`).join("\n").split("\n");
    if (lang === "Python") return ["ERROR request failed", "Traceback (most recent call last):", ...list.slice().reverse().flatMap((x, k) => (k ? ["", "The above exception was the direct cause of the following exception:", "", `${x.t}: ${x.m}`] : [`${x.t}: ${x.m}`]))];
    return ["request failed", ...list.map((x, k) => `${"  ".repeat(k)}${k ? "[cause]: " : ""}${x.t}: ${x.m}`)];
  }
  function simulateChain(lang, strat) {
    const k = Math.max(0, CH.indexOf(strat)), T = CHT[lang], go = lang === "Go";
    const { at } = listing(chainCode(lang, k));
    const frames = [], logs = [];
    let top = null, status = null, body = null;
    const snap = (lbl, note, o = {}) => frames.push({ top: Viz.clone(top), logs: [...logs], status, body, line: [].concat(lbl).map((l) => at[l]).filter((n) => n !== undefined), note, vars: { error: top ? top.t : "none", "message": top ? top.m : "–", status: status ?? "–" }, ...o });
    const root = { t: T.names.nf, m: T.rootMsg, origin: true, cause: null };
    top = root;
    snap("repo", `The repository ${go ? "returns the sentinel <code>ErrNotFound</code>" : `throws <code>${root.t}</code>`}. This is the <b>root cause</b>: the order does not exist, which should become a 404.`, { layer: "repository" });
    if (k === 0) { top = { t: T.names.svc, m: go ? `load order 42: ${root.m}` : "load order 42", cause: root }; snap(["svc_catch", "svc"], `The service adds <b>what it was doing</b> ("load order 42") and keeps the original as the ${go ? "<code>%w</code>-wrapped error" : lang === "Python" ? "<code>__cause__</code>" : lang === "C#" ? "<code>InnerException</code>" : "<code>cause</code>"}.`, { layer: "service" }); }
    if (k === 1) { top = { t: go ? "*errors.errorString" : T.names.svc, m: `load order 42: ${root.m}`, cause: null }; snap(["svc_catch", "svc"], `The service copies the text into a new error but ${go ? "formats it with <code>%v</code>, which keeps only the string" : lang === "Python" ? "uses <code>from None</code>, which hides the cause" : "does not pass the cause"}. The message looks fine; the <b>type information is gone</b>${go ? "" : ", and the stack trace now starts here"}.`, { layer: "service" }); }
    if (k === 2) { logs.push(go ? 'level=WARN msg="not found"' : `WARN ${root.m}`); top = null; snap(["svc_catch", "svc", "svc2"], `The service logs a warning with <b>no context</b> (which request? which user?) and returns ${go ? "a zero-value Order with a nil error" : "null"}. As far as the caller knows, everything worked.`, { layer: "service" }); }
    if (k === 3) snap(["svc_catch", "svc"], `The service rethrows the same ${go ? "error value" : "exception"} untouched. ${lang === "C#" ? "<code>throw;</code> keeps the original stack trace (<code>throw e;</code> would restart it here)." : go ? "Nothing is wrong, but no context was added either." : "The cause survives, but nothing says what the service was doing."}`, { layer: "service" });
    if (k === 2) {
      if (go) { status = 200; body = '{"total": 0}'; snap(["h_try"], "The handler reads <code>o.Total</code> from the zero-value Order: <b>0</b>. No error, no crash, no log at ERROR level. The client gets <b>200 OK</b> with a total of 0. Silent wrong data is the worst failure mode.", { layer: "handler" }); }
      else {
        top = { ...T.symptom, cause: null, origin: false };
        snap("h_try", `The handler dereferences the null: <code>${esc(top.t)}</code>. The real problem (order 42 does not exist) is now a confusing bug report far from its cause.`, { layer: "handler" });
        if (T.catchAll) { top = { t: T.names.h, m: "GET /orders/42", cause: top }; snap(["h_catch", "h"], "TypeScript's <code>catch (e)</code> catches everything, so the TypeError gets wrapped. Context is added, but it describes the symptom.", { layer: "handler" }); }
        else snap("h_catch", `<code>catch (${T.names.svc} e)</code> does not match a ${esc(T.symptom.t)}, so it flies past.`, { layer: "handler" });
      }
    } else {
      const caught = T.catchAll || top.t === T.names.svc;
      if (!caught) snap("h_catch", `The handler's <code>catch (${T.names.svc})</code> does not match <code>${top.t}</code>, so the exception passes straight through.`, { layer: "handler" });
      else if (k === 0) { top = { t: T.names.h, m: go ? `GET /orders/42: ${top.m}` : "GET /orders/42", cause: top }; snap(["h_catch", "h"], "The handler wraps again with the request it was serving. Each layer adds one fact; nobody loses anything.", { layer: "handler" }); }
      else if (k === 1) { top = { t: go ? "*errors.errorString" : T.names.h, m: `GET /orders/42: ${top.m}`, cause: null }; snap(["h_catch", "h"], "The handler again builds a new error from the text alone.", { layer: "handler" }); }
      else snap(["h_catch", "h"], "The handler passes it on unchanged.", { layer: "handler" });
    }
    let nf = false; for (let x = top; x; x = x.cause) if (x.t === T.names.nf) nf = true;
    if (top) {
      logs.push(...logText(lang, top));
      snap("b_log", "The boundary logs the error <b>once</b>, with everything the chain carries.", { layer: "boundary" });
      status = nf ? 404 : 500;
      snap("b_map", `${go ? "<code>errors.Is</code> walks the <code>%w</code> chain" : "The boundary walks the cause chain"} looking for ${T.names.nf}: <b>${nf ? "found" : "not found"}</b>, so the response is <b>${status}</b>${nf ? "" : ". A missing order is reported as a server error, and on-call gets paged for a client mistake"}.`, { layer: "boundary", final: true });
    } else snap([], "Nothing reaches the boundary. The only trace is a WARN line without context.", { layer: "boundary", final: true });
    const fr = frames[frames.length - 1];
    let ctx = false, trace = false;
    for (let x = top; x; x = x.cause) { if (/GET \/orders\/42/.test(x.m)) ctx = true; if (x.origin) trace = true; }
    fr.checks = [["status", status === 404 ? "404 ✓" : `${status} ✗`, status === 404], ["request context", ctx ? "yes" : "no", ctx], ["root cause reachable", nf ? "yes" : "no", nf], ["origin stack trace", go ? "n/a in Go" : trace ? "yes" : "no", !go && trace]].filter((c) => !(go && c[0] === "origin stack trace"));
    return frames;
  }
  Viz.register(S + "chain", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), st = pick(v.s, CH);
    return {
      sig: lang + "|" + st, title: "Error chains: what the boundary can still see", tag: "SIMULATION · WRAP + INSPECT",
      legend: [["done", "useful information kept"], ["bad", "information lost"], ["active", "current layer"]],
      code: listing(chainCode(lang, CH.indexOf(st))).code, codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "s", label: "each layer does", type: "select", options: CH, value: st }],
      build: (i) => simulateChain(pick(i.lang, LANGS), pick(i.s, CH)),
      random: () => ({ lang: LANGS[Viz.rand(0, 4)], s: CH[Viz.rand(0, 3)] }),
      render: (f) => {
        const layers = ["repository", "service", "handler", "boundary"].map((l) => `<span class="eh-layer ${l === f.layer ? "active" : ""}">${l}</span>`).join('<span class="eh-to">→</span>');
        const dolls = []; for (let x = f.top; x; x = x.cause) dolls.push(x);
        const nest = (i) => (i >= dolls.length ? "" : `<div class="eh-doll ${dolls[i].origin ? "root" : ""}"><b>${esc(dolls[i].t)}</b><span>${esc(dolls[i].m)}</span>${nest(i + 1)}</div>`);
        const checks = f.checks ? chips(...f.checks.map(([k, v, ok]) => chip(k, v, ok ? "done" : "bad"))) : "";
        const resp = f.status ? `<div class="eh-resp ${f.status === 404 ? "done" : "bad"}">HTTP ${f.status}${f.body ? ` ${esc(f.body)}` : ""}</div>` : "";
        return `<div class="eh-layers">${layers}</div><div class="eh-caption">error the caller holds</div>${dolls.length ? nest(0) : '<div class="eh-err none">no error (as far as anyone can tell)</div>'}`
          + `${f.logs.length ? `<div class="eh-console"><div class="eh-caption">log</div><pre class="eh-out">${esc(f.logs.join("\n"))}</pre></div>` : ""}${resp}${checks}`;
      },
    };
  }, {}));

  /* ================= 4. decide: throw, return an error, or return a Result? ================= */
  const SIT = [
    { n: "Index out of range in your own loop", bug: 1, why: "The code is wrong. No caller can do anything useful about it." },
    { n: "Caller passed null to a public method", bug: 1, why: "A contract violation by the caller: a bug in their code, reported as early as possible." },
    { n: "Required config value missing at startup", fatal: 1, why: "The process cannot do its job at all. Refuse to start, loudly." },
    { n: "Out of memory or stack overflow", fatal: 1, why: "The runtime itself is in trouble; your handler may not even get to run." },
    { n: "User typed an invalid email address", expected: 1, why: "Users make typos every day. The caller must show them every problem." },
    { n: "Payment declined by the provider", expected: 1, why: "A normal business outcome with a reason (insufficient funds, fraud check)." },
    { n: "Lookup by id finds no customer", expected: 1, absence: 1, why: "Not finding something is a normal answer, and no reason is needed." },
    { n: "Optional settings file does not exist", expected: 1, absence: 1, why: "Missing is fine: fall back to defaults." },
    { n: "Database connection dropped mid-query", why: "Nobody in the call chain expected it, the caller cannot fix it, and it may go away on retry.", transient: 1 },
    { n: "Disk full while writing an export", why: "Environmental and not something this code can fix. Someone up the stack decides what to tell the user." },
  ];
  const QS = [
    { id: "q1", t: "A bug? (broken invariant / contract)", f: (s) => !!s.bug, yes: "bug", no: "q2" },
    { id: "q2", t: "Can the process continue safely?", f: (s) => !s.fatal, yes: "q3", no: "fatal" },
    { id: "q3", t: "Expected outcome callers must handle?", f: (s) => !!s.expected, yes: "q4", no: "env" },
    { id: "q4", t: "Is \"nothing there\" the whole story?", f: (s) => !!s.absence, yes: "absent", no: "result" },
  ];
  const LEAF = {
    bug: { t: ["Fail fast:", "throw / assert / panic"], verdict: "Fail fast. Throw (or panic in Go) right where the bug is detected, and do not catch it below the top-level boundary. The fix is in the code, not in a handler.",
      idioms: { "C#": "ArgumentNullException.ThrowIfNull(x); throw new InvalidOperationException(…)", Java: "Objects.requireNonNull(x); throw new IllegalStateException(…)", Python: "raise ValueError(…)  (assert is stripped by python -O)", Go: "panic(\"unreachable: …\") for impossible states; return an error at package APIs", TypeScript: "throw new TypeError(…); assertNever(x) in exhaustive switches" } },
    fatal: { t: ["Crash or", "refuse to start"], verdict: "Let it crash. Log once at the very top, exit non-zero and let the orchestrator restart or alert. Catching it only hides a broken process.",
      idioms: { "C#": "services.AddOptions<T>().ValidateDataAnnotations().ValidateOnStart()", Java: "never catch Error (OutOfMemoryError, StackOverflowError)", Python: "raise SystemExit(\"missing DB_URL\") at startup; never catch BaseException", Go: "log.Fatal(err) in main only (it skips deferred calls)", TypeScript: "throw at startup; let process exit (code 1)" } },
    env: { t: ["Exception (Go: error),", "handled at a boundary"], verdict: "Exception (an error value in Go). Let it travel to a boundary that can decide: retry if transient, otherwise map it to a response. Add context on the way, log it once.",
      idioms: { "C#": "let DbException propagate; retry with a resilience pipeline at the edge", Java: "wrap checked SQLException: throw new RepositoryException(\"…\", e)", Python: "let it propagate; raise RepoError(\"…\") from e at layer edges", Go: "return fmt.Errorf(\"save export: %w\", err)", TypeScript: "throw / reject; new RepoError(\"…\", { cause: e })" } },
    absent: { t: ["Return \"nothing\":", "null / Option / (T, bool)"], verdict: "Return \"nothing\" in the language's idiom. It is not an error, so do not pay for an exception and do not invent an error type.",
      idioms: { "C#": "Customer? Find(id)  or  bool TryGet(id, out Customer c)", Java: "Optional<Customer> find(id)", Python: "def find(id) -> Customer | None", Go: "func Find(id) (Customer, bool)", TypeScript: "find(id): Customer | undefined" } },
    result: { t: ["Result / error value /", "tagged union"], verdict: "Return a value the type system makes the caller handle: a Result, an error value or a tagged union. The failure is part of the contract, so put it in the signature.",
      idioms: { "C#": "Result<Payment, DeclineReason> or a closed record hierarchy; ValidationProblem for input", Java: "sealed interface PaymentResult permits Approved, Declined", Python: "Approved | Declined dataclasses (EAFP with a ValidationError at the edge is also idiomatic)", Go: "(Payment, error) with var ErrDeclined = errors.New(\"declined\")", TypeScript: "{ ok: true; value } | { ok: false; error } discriminated union" } },
  };
  const DPOS = { q1: [150, 34], q2: [150, 104], q3: [150, 174], q4: [150, 244], bug: [415, 34], fatal: [415, 104], env: [415, 174], absent: [415, 244], result: [150, 314] };
  function simulateDecide(name) {
    const s = SIT.find((x) => x.n === name) || SIT[0], frames = [], path = [];
    let node = "q1";
    frames.push({ s, path: [], cur: null, note: `<b>${esc(s.n)}</b>. ${esc(s.why)} Walk the questions top to bottom.` });
    while (QS.some((q) => q.id === node)) {
      const q = QS.find((x) => x.id === node), ans = q.f(s), nxt = ans ? q.yes : q.no;
      path.push([node, nxt, ans ? "yes" : "no"]);
      frames.push({ s, path: Viz.clone(path), cur: node, note: `${esc(q.t)} <b>${ans ? "Yes" : "No"}</b>.`, vars: { question: q.id.toUpperCase(), answer: ans ? "yes" : "no" } });
      node = nxt;
    }
    frames.push({ s, path: Viz.clone(path), cur: node, leaf: node, note: `${LEAF[node].verdict}${s.transient ? " This one is <b>transient</b>, so the boundary may retry it with backoff." : ""}` });
    return frames;
  }
  function decideSvg(f) {
    const on = new Set(f.path.flatMap(([a, b]) => [a, b])), edgeOn = (a, b) => f.path.some(([x, y]) => x === a && y === b);
    const edge = (a, b, lbl) => {
      const [x1, y1] = DPOS[a], [x2, y2] = DPOS[b], right = y1 === y2;
      const sx = right ? x1 + 125 : x1, sy = right ? y1 : y1 + 17, ex = right ? x2 - 92 : x2, ey = right ? y2 : y2 - 17;
      return `<path class="edge ${edgeOn(a, b) ? "path" : ""}" d="M${sx},${sy} L${ex},${ey}"/><text class="small ${edgeOn(a, b) ? "" : "muted"}" x="${right ? (sx + ex) / 2 : sx + 8}" y="${right ? sy - 6 : (sy + ey) / 2 + 4}" ${right ? 'text-anchor="middle"' : ""}>${lbl}</text>`;
    };
    const qbox = (q) => { const [x, y] = DPOS[q.id]; const cls = f.cur === q.id ? "active" : on.has(q.id) ? "visit" : ""; return `<rect class="box ${cls}" x="${x - 125}" y="${y - 17}" width="250" height="34" rx="8"/><text x="${x}" y="${y + 4}" text-anchor="middle" class="small">${esc(q.t)}</text>`; };
    const lbox = (id) => { const [x, y] = DPOS[id]; const cls = f.leaf === id ? "done" : on.has(id) ? "visit" : ""; const [a, b] = LEAF[id].t; return `<rect class="box ${cls}" x="${x - 92}" y="${y - 22}" width="184" height="44" rx="10"/><text x="${x}" y="${y - 4}" text-anchor="middle" class="small">${esc(a)}</text><text x="${x}" y="${y + 12}" text-anchor="middle" class="small">${esc(b)}</text>`; };
    return `<div class="eh-fit"><svg class="dg" viewBox="0 0 520 345" width="520" role="img" aria-label="Decision tree">`
      + edge("q1", "bug", "yes") + edge("q1", "q2", "no") + edge("q2", "fatal", "no") + edge("q2", "q3", "yes") + edge("q3", "env", "no") + edge("q3", "q4", "yes") + edge("q4", "absent", "yes") + edge("q4", "result", "no")
      + QS.map(qbox).join("") + Object.keys(LEAF).map(lbox).join("") + "</svg></div>";
  }
  Viz.register(S + "decide", (el) => Viz.player(el, {
    title: "Throw, return an error, or return a Result?", tag: "SIMULATION · DECISION TREE",
    legend: [["active", "question being asked"], ["visit", "path taken"], ["done", "answer"]],
    inputs: [{ key: "s", label: "situation", type: "select", options: SIT.map((x) => x.n), value: SIT[4].n }],
    build: (i) => simulateDecide(i.s),
    random: () => ({ s: SIT[Viz.rand(0, SIT.length - 1)].n }),
    render: (f) => {
      const tbl = f.leaf ? `<table class="eh-tbl"><thead><tr><th>language</th><th>idiom</th></tr></thead><tbody>${LANGS.map((l) => `<tr><th>${l}</th><td><code>${esc(LEAF[f.leaf].idioms[l])}</code></td></tr>`).join("")}</tbody></table>` : "";
      return decideSvg(f) + tbl;
    },
  }));

  /* ================= 5. boundary: log at every layer vs log once at the edge ================= */
  const BST = ["log and rethrow in every layer", "add context, log once at the boundary", "swallow in the repository"];
  const BLAYERS = ["Middleware", "Controller", "Service", "Repository", "DbClient"];
  const BCODE = [
    ["// Controller, Service and Repository all do this:", "try { return await inner.GetAsync(id, ct); }", "catch (Exception e)", "{", "    log.LogError(e, \"GetAsync failed\");«log»", "    throw;«rethrow»", "}", "", "// Middleware: app.UseExceptionHandler()", "// logs \"An unhandled exception has occurred\"«mw»", "// and writes the problem details response«resp»"],
    ["// Repository: add what you were doing, keep the cause", "catch (TimeoutException e)", "{", "    throw new RepositoryException(«wrap»", "        $\"load order {id}\", e);", "}", "// Service, Controller: no try/catch at all«pass»", "", "// Middleware: the single place that logs", "builder.Services.AddProblemDetails();", "app.UseExceptionHandler();   // logs once«mw»", "// IProblemDetailsService writes the response«resp»"],
    ["// Repository", "try", "{", "    return await db.QueryAsync<Order>(sql, ct);", "}", "catch (Exception e)", "{", "    log.LogDebug(e, \"query failed\");«log»", "    return [];   // \"no orders, I guess\"«swallow»", "}", "// Service, Controller, Middleware: all happy«pass»", "// 200 OK, []«resp»"],
  ];
  function simulateBoundary(strat, perMin) {
    const k = Math.max(0, BST.indexOf(strat)), frames = [], logs = [];
    const { at } = listing(BCODE[k]);
    let cur = null, err = null, resp = null;
    const st = {};
    const snap = (lbl, note, o = {}) => frames.push({ k, cur, err, st: { ...st }, logs: Viz.clone(logs), resp, line: [].concat(lbl).map((l) => at[l]).filter((n) => n !== undefined), note, vars: { "log entries": logs.filter((l) => l.lv !== "DEBUG").length, "stack traces": logs.filter((l) => l.trace).length, error: err || "none" }, ...o });
    for (const l of BLAYERS) { cur = l; st[l] = "called"; snap([], `GET /orders/42 reaches <b>${l}</b>.`); }
    err = "TimeoutException"; st.DbClient = "threw";
    snap([], "The database does not answer in time: <code>DbClient</code> throws <code>TimeoutException</code>. Now watch the trip back up.");
    for (let i = BLAYERS.length - 2; i >= 0; i--) {
      const l = BLAYERS[i]; cur = l;
      if (k === 0) {
        if (l === "Middleware") { logs.push({ lv: "ERROR", who: l, msg: "An unhandled exception has occurred while executing the request.", trace: true }); st[l] = "logged"; snap("mw", "The exception middleware logs it <b>again</b>. Same exception, same stack trace, fourth time."); }
        else { logs.push({ lv: "ERROR", who: l, msg: "GetAsync failed: TimeoutException", trace: true }); st[l] = "logged + rethrew"; snap(["log", "rethrow"], `<b>${l}</b> logs the exception with its full stack trace, then rethrows. It adds no new information: it does not know more than the layer below.`); }
      } else if (k === 1) {
        if (l === "Repository") { err = "RepositoryException → TimeoutException"; st[l] = "wrapped"; snap("wrap", "The repository knows <b>what it was doing</b>: it wraps with \"load order 42\" and keeps the TimeoutException as the inner exception. No log."); }
        else if (l === "Middleware") { logs.push({ lv: "ERROR", who: l, msg: "GET /orders/42 failed: RepositoryException: load order 42 ---> TimeoutException", trace: true, ctx: true }); st[l] = "logged once"; snap("mw", "The boundary logs <b>once</b>, with the whole chain, the route, the user and the trace id in the log scope."); }
        else { st[l] = "passed through"; snap("pass", `<b>${l}</b> has nothing to add and nothing to decide, so it has no try/catch. The exception passes through.`); }
      } else {
        if (l === "Repository") { logs.push({ lv: "DEBUG", who: l, msg: "query failed (filtered out in production)", trace: true }); err = null; st[l] = "swallowed"; snap(["log", "swallow"], "The repository catches everything, logs at <b>DEBUG</b> (not emitted in production) and returns an empty list. The timeout is now invisible."); }
        else { st[l] = "ok"; snap("pass", `<b>${l}</b> sees an empty list and carries on.`); }
      }
    }
    cur = "client";
    resp = k === 2 ? { code: 200, body: ["HTTP/1.1 200 OK", "Content-Type: application/json", "", "[]"] } : { code: 503, body: ["HTTP/1.1 503 Service Unavailable", "Content-Type: application/problem+json", "", "{", "  \"type\": \"https://errors.example.com/dependency-timeout\",", "  \"title\": \"A dependency timed out.\",", "  \"status\": 503,", "  \"instance\": \"/orders/42\",", "  \"traceId\": \"00-4bf92f3577b34da6a3ce929d0e0e4736-01\"", "}"] };
    const entries = logs.filter((l) => l.lv !== "DEBUG").length, traces = logs.filter((l) => l.lv !== "DEBUG" && l.trace).length;
    snap("resp", k === 2 ? "The client receives <b>200 OK</b> with no orders. The customer thinks their orders were deleted; nobody is alerted; the dashboards are green." : `The client receives a <b>503</b> as RFC 9457 problem details, with a trace id but no stack trace. ${k === 0 ? `Your logs got <b>${entries} ERROR entries</b> for one failure.` : "Your logs got exactly <b>one</b> ERROR entry, with more context than all four in the other strategy."}`,
      { final: true, stats: [["ERROR entries per failure", entries], ["stack traces per failure", traces], [`ERROR entries per minute at ${perMin} failures/min`, entries * perMin], ["alerts if every ERROR pages", entries ? `${entries}× per failure` : "none (silent)"]] });
    return frames;
  }
  Viz.register(S + "boundary", (el) => adaptive(el, (v) => {
    const st = pick(v.s, BST);
    return {
      sig: st, title: "Log once, at the boundary", tag: "SIMULATION · REQUEST + LOG STREAM",
      legend: [["active", "current layer"], ["bad", "duplicate or hidden"], ["done", "handled once, with context"]],
      code: listing(BCODE[BST.indexOf(st)]).code, codeLang: "csharp",
      inputs: [{ key: "s", label: "strategy", type: "select", options: BST, value: st }, { key: "n", label: "failures per minute", value: v.n ?? "120", width: 110 }],
      build: (i) => simulateBoundary(pick(i.s, BST), Viz.parse.int(i.n, { min: 1, max: 100000 })),
      random: () => ({ s: st, n: String(Viz.rand(1, 50) * 10) }),
      render: (f) => {
        const lay = BLAYERS.map((l) => { const s = f.st[l] || ""; return `<div class="eh-tier ${l === f.cur ? "active" : ""} ${/logged \+|swallowed/.test(s) ? "bad" : /logged once|wrapped/.test(s) ? "done" : /threw/.test(s) ? "bad" : ""}"><b>${l}</b><small>${esc(s || "–")}</small></div>`; }).join("");
        const logs = f.logs.length ? f.logs.map((l) => `<div class="eh-logl ${l.lv === "DEBUG" ? "dim" : l.ctx ? "done" : "bad"}"><b>${l.lv}</b> <span>[${esc(l.who)}]</span> ${esc(l.msg)}${l.trace ? ' <i>+ stack trace</i>' : ""}</div>`).join("") : '<div class="eh-muted">no log lines yet</div>';
        const resp = f.resp ? `<pre class="eh-out eh-http ${f.resp.code === 200 ? "bad" : "done"}">${esc(f.resp.body.join("\n"))}</pre>` : "";
        const stats = f.stats ? `<table class="eh-tbl"><tbody>${f.stats.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : "";
        return `<div class="eh-tiers">${lay}</div>${f.err ? `<div class="eh-flight">in flight: <code>${esc(f.err)}</code></div>` : ""}<div class="eh-console"><div class="eh-caption">log stream</div>${logs}</div>${resp}${stats}`;
      },
    };
  }, {}));

  /* ================= 6. retry: transient vs permanent, backoff with jitter, amplification ================= */
  const RCLASS = (o) => (/^(200|201|204)$/.test(o) ? "success" : /^(408|429|500|502|503|504|timeout|reset)$/.test(o) ? "transient" : /^(400|401|403|404|409|422)$/.test(o) ? "permanent" : null);
  const JIT = [0.62, 0.43, 0.87, 0.29, 0.73, 0.18, 0.94, 0.55];
  const RCODE = ["for (var attempt = 1; ; attempt++)«loop»", "{", "    var r = await Send(request, ct);«send»", "    if (r.IsSuccessStatusCode) return r;«ok»", "    if (!IsTransient(r) || attempt == maxAttempts)«check»", "        throw new HttpFailure(r);   // stop now«fail»", "    var delay = r.Headers.RetryAfter?.Delta«delay»", "        ?? FullJitter(baseDelay * 2^(attempt-1));«jit»", "    await Task.Delay(delay, ct);«wait»", "}", "// production: AddStandardResilienceHandler()"];
  function simulateRetry(seq, max, base, layers) {
    const { at } = listing(RCODE);
    const frames = [], bars = [];
    let t = 0;
    const snap = (lbl, note, o = {}) => frames.push({ bars: Viz.clone(bars), t, line: [].concat(lbl).map((l) => at[l]), note, vars: o.vars || {}, ...o });
    for (let n = 1; n <= max; n++) {
      const o = seq[Math.min(n - 1, seq.length - 1)], cls = RCLASS(o), dur = o === "timeout" ? 1000 : 60;
      bars.push({ kind: "call", n, o, cls, t0: t, t1: t + dur }); t += dur;
      const vars = { attempt: `${n} / ${max}`, outcome: o, class: cls, "elapsed ms": t };
      if (cls === "success") { snap(["send", "ok"], `Attempt ${n}: <b>${o}</b>. Done after ${t} ms.`, { vars, result: "success" }); return frames.concat(summary("success", n)); }
      if (cls === "permanent") { snap(["send", "check", "fail"], `Attempt ${n}: <b>${o}</b> is a <b>permanent</b> failure. Asking again gives the same answer, so stop now and report it. Retrying a 4xx only adds load and latency.`, { vars, result: "failed fast" }); return frames.concat(summary("failed fast", n)); }
      if (n === max) { snap(["send", "check", "fail"], `Attempt ${n}: <b>${o}</b> is transient, but the budget of ${max} attempts is spent. Give up and surface the error.`, { vars, result: "gave up" }); return frames.concat(summary("gave up", n)); }
      const exp = Math.min(30000, base * 2 ** (n - 1));
      const ra = o === "429" ? 1000 : null;
      const d = ra ?? Math.round(exp * JIT[(n - 1) % JIT.length]);
      snap(["send", "check"], `Attempt ${n}: <b>${o}</b> is <b>transient</b>${o === "500" ? " (only safe to retry if the request is idempotent)" : ""}. Retry.`, { vars });
      bars.push({ kind: "wait", n, t0: t, t1: t + d, ra: !!ra });
      t += d;
      snap(ra ? ["delay", "wait"] : ["jit", "wait"], ra ? `429 carries <code>Retry-After: 1</code>: the server said when, so wait exactly ${d} ms instead of guessing.` : `Exponential backoff caps this wait at ${exp} ms (${base} × 2<sup>${n - 1}</sup>); full jitter picks a random point in [0, ${exp}]: <b>${d} ms</b>. Jitter stops a thousand clients from retrying in lockstep.`, { vars: { ...vars, "wait ms": d, "elapsed ms": t } });
    }
    return frames;
    function summary(res, n) {
      const worst = max ** layers;
      return [{ bars: Viz.clone(bars), t, line: [], final: true, res, note: `${res === "success" ? "Succeeded" : res === "failed fast" ? "Failed fast" : "Gave up"} after <b>${n}</b> attempt${n > 1 ? "s" : ""} and <b>${t} ms</b>. ${layers > 1 ? `With ${layers} layers each retrying ${max}×, one user click can hit the database up to <b>${max}<sup>${layers}</sup> = ${worst}</b> times during an outage. Retry in <b>one</b> layer only.` : "Retrying in exactly one layer keeps the worst case at " + max + " calls per request."}`, vars: { attempts: n, "total ms": t, result: res, "worst case calls": worst }, stats: [["attempts", n], ["elapsed", `${t} ms`], ["result", res], [`worst case with ${layers} retrying layer${layers > 1 ? "s" : ""}`, `${worst} calls`]] }];
    }
  }
  Viz.register(S + "retry", (el) => Viz.player(el, {
    title: "Retry the transient, fail fast on the permanent", tag: "SIMULATION · BACKOFF TIMELINE",
    legend: [["done", "success"], ["visit", "transient: retry"], ["bad", "permanent / gave up"], ["path", "waiting"]],
    code: listing(RCODE).code, codeLang: "csharp",
    inputs: [{ key: "seq", label: "server answers (last repeats)", value: "503 timeout 429 200", width: 220 }, { key: "max", label: "max attempts", value: "5", width: 80 }, { key: "base", label: "base delay ms", value: "200", width: 90 }, { key: "layers", label: "layers that retry", value: "1", width: 80 }],
    build: (i) => {
      const seq = String(i.seq).toLowerCase().split(/[\s,]+/).filter(Boolean);
      if (!seq.length || seq.length > 10) throw new Error("Give 1–10 outcomes, e.g. 503 timeout 200.");
      const bad = seq.find((o) => !RCLASS(o)); if (bad) throw new Error(`Unknown outcome "${bad}". Use 200 201 204 400 401 403 404 409 422 408 429 500 502 503 504 timeout reset.`);
      return simulateRetry(seq, Viz.parse.int(i.max, { min: 1, max: 8 }), Viz.parse.int(i.base, { min: 10, max: 5000 }), Viz.parse.int(i.layers, { min: 1, max: 4 }));
    },
    random: () => { const pool = ["503", "503", "timeout", "429", "502", "200", "404", "500", "reset"]; return { seq: Array.from({ length: Viz.rand(1, 5) }, () => pool[Viz.rand(0, pool.length - 1)]).concat(Math.random() < 0.6 ? ["200"] : []).join(" "), max: String(Viz.rand(2, 6)), base: String(Viz.rand(1, 5) * 100), layers: String(Viz.rand(1, 3)) }; },
    render: (f) => {
      const W = 500, total = Math.max(f.t, 1), sx = (x) => 10 + (x / total) * (W - 20);
      const lane = (rows) => { const ends = rows.map(() => -1e9); return (x0, len, center) => { const a = center ? x0 - len / 2 : x0; let r = ends.findIndex((e) => a > e + 6); if (r < 0) r = ends.indexOf(Math.min(...ends)); ends[r] = a + len; return rows[r]; }; };
      const top = lane([28, 14]), bottom = lane([86, 98]), cw = 6.6;
      const items = f.bars.map((b) => { if (b.kind === "call") { const lbl = `#${b.n} ${b.o}`, x = Math.min(sx(b.t0) + 2, W - 4 - lbl.length * cw);
        return `<rect class="box ${b.cls === "success" ? "done" : b.cls === "transient" ? "visit" : "bad"}" x="${sx(b.t0).toFixed(1)}" y="36" width="${Math.max(6, sx(b.t1) - sx(b.t0)).toFixed(1)}" height="30" rx="4"/><text class="small mono" x="${x.toFixed(1)}" y="${top(x, lbl.length * cw)}">${esc(lbl)}</text>`; }
        const lbl = `${b.t1 - b.t0} ms${b.ra ? " (Retry-After)" : ""}`, cx = Math.max(10 + lbl.length * 2.8, Math.min((sx(b.t0) + sx(b.t1)) / 2, W - 10 - lbl.length * 2.8));
        return `<line class="edge path dash" x1="${sx(b.t0).toFixed(1)}" y1="51" x2="${sx(b.t1).toFixed(1)}" y2="51"/><text class="small muted" x="${cx.toFixed(1)}" y="${bottom(cx, lbl.length * 5.6, true)}" text-anchor="middle">${lbl}</text>`; }).join("");
      const svg = `<div class="eh-fit"><svg class="dg" viewBox="0 0 ${W} 124" width="${W}" role="img" aria-label="Retry timeline"><line class="edge" x1="10" y1="108" x2="${W - 10}" y2="108"/><text class="small muted" x="10" y="121">0 ms</text><text class="small muted" x="${W - 10}" y="121" text-anchor="end">${f.t} ms</text>${items}</svg></div>`;
      const stats = f.stats ? `<table class="eh-tbl"><tbody>${f.stats.map(([k, v]) => `<tr><th>${esc(k)}</th><td>${esc(v)}</td></tr>`).join("")}</tbody></table>` : "";
      return svg + stats;
    },
  }));

  /* ================= 7. validation: collect every problem vs stop at the first ================= */
  const VSTRAT = ["collect all errors, then 400", "throw on the first error"];
  const VRULES = [
    ["email", "required", (r) => r.email.trim().length > 0, "Email is required."],
    ["email", "looks like name@domain.tld", (r) => !r.email.trim() || /^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(r.email.trim()), "Must look like name@domain.tld."],
    ["age", "whole number", (r) => /^\d+$/.test(r.age.trim()), "Must be a whole number."],
    ["age", "18 or older", (r) => !/^\d+$/.test(r.age.trim()) || Number(r.age) >= 18, "Must be 18 or older."],
    ["password", "at least 12 characters", (r) => r.password.length >= 12, "Use at least 12 characters."],
    ["password", "contains a digit", (r) => /\d/.test(r.password), "Include at least one digit."],
  ];
  const VCODE = [
    ["app.MapPost(\"/signup\", (SignUp req, Users users) =>", "{", "    var errors = new Dictionary<string, string[]>();", "    foreach (var rule in Rules)   // run them ALL«rule»", "        if (!rule.Check(req)) errors.Add(rule.Field, …);«add»", "    if (errors.Count > 0)", "        return Results.ValidationProblem(errors);   // 400«v400»", "    users.Add(req);   // DB down? exception, not 400«save»", "    return Results.Created($\"/users/{req.Email}\", null);«created»", "});", "// app.UseExceptionHandler() turns the DB exception«exh»", "// into a 503 problem details response"],
    ["app.MapPost(\"/signup\", (SignUp req, Users users) =>", "{", "    foreach (var rule in Rules)«rule»", "        if (!rule.Check(req))", "            throw new ValidationException(rule.Message);«add»", "    users.Add(req);   // DB down? exception, not 400«save»", "    return Results.Created($\"/users/{req.Email}\", null);«created»", "});", "// the exception handler maps ValidationException«v400»", "// to a 400 with ONE error; other exceptions to 503«exh»"],
  ];
  function simulateValidation(req, strat, db) {
    const k = Math.max(0, VSTRAT.indexOf(strat)), { at } = listing(VCODE[k]);
    const frames = [], res = [], errors = {};
    const snap = (lbl, note, o = {}) => frames.push({ res: Viz.clone(res), line: [].concat(lbl).map((l) => at[l]), note, vars: { failures: Object.values(errors).flat().length, strategy: k ? "fail-first" : "collect" }, ...o });
    let stopped = false;
    for (const [field, name, ok, msg] of VRULES) {
      if (stopped) { res.push([field, name, null]); continue; }
      const pass = ok(req); res.push([field, name, pass]);
      if (!pass) (errors[field] = errors[field] || []).push(msg);
      snap(pass ? "rule" : ["rule", "add"], `<b>${field}</b>: ${esc(name)}: ${pass ? "pass." : `<b>fail</b> (${esc(msg)})${k ? ". Throw immediately: the remaining rules never run." : ". Record it and keep checking."}`}`, { cur: res.length - 1 });
      if (!pass && k) stopped = true;
    }
    const failing = Object.values(errors).flat();
    const allFail = VRULES.filter(([, , ok]) => !ok(req)).length;
    if (failing.length) {
      const body = { type: "https://tools.ietf.org/html/rfc9110#section-15.5.1", title: "One or more validation errors occurred.", status: 400, errors };
      snap("v400", `The client gets a <b>400</b> listing ${failing.length === 1 ? "one problem" : `all ${failing.length} problems`}. ${k ? `There are actually <b>${allFail}</b> broken rules, so the user discovers them one rejection at a time: <b>${allFail}</b> rejected round trips before the request can succeed.` : "The user sees everything at once and fixes it in one go: <b>1</b> rejected round trip."} This is an <b>expected</b> outcome, not an exception${k ? " (even though this code uses one to get there)" : ""}.`, { final: true, http: ["HTTP/1.1 400 Bad Request", "Content-Type: application/problem+json", "", ...JSON.stringify(body, null, 2).split("\n")], ok: false, trips: k ? allFail : 1 });
      return frames;
    }
    if (db === "down") {
      snap("save", "Input is valid. Saving throws <code>DbException</code>: the database is down. That is <b>not the user's fault</b>, so it must not be reported as a 400.", { cur: -1 });
      const body = { type: "https://errors.example.com/unavailable", title: "The service is temporarily unavailable.", status: 503, traceId: "00-7c1e…-01" };
      snap("exh", "The exception handler maps it to <b>503</b> problem details: no stack trace, no SQL, just a trace id. The full exception is logged once on the server.", { final: true, http: ["HTTP/1.1 503 Service Unavailable", "Content-Type: application/problem+json", "Retry-After: 30", "", ...JSON.stringify(body, null, 2).split("\n")], ok: false, server: true });
      return frames;
    }
    snap(["save", "created"], "Every rule passes and the save works: <b>201 Created</b>.", { final: true, http: ["HTTP/1.1 201 Created", "Location: /users/" + req.email.trim()], ok: true });
    return frames;
  }
  Viz.register(S + "validation", (el) => adaptive(el, (v) => {
    const st = pick(v.s, VSTRAT);
    return {
      sig: st, title: "Validation errors vs exceptional failures", tag: "SIMULATION · RULES → RESPONSE",
      legend: [["done", "pass"], ["bad", "fail"], ["active", "rule being checked"]],
      code: listing(VCODE[VSTRAT.indexOf(st)]).code, codeLang: "csharp",
      inputs: [{ key: "email", label: "email", value: v.email ?? "ada@example", width: 150 }, { key: "age", label: "age", value: v.age ?? "17", width: 60 }, { key: "password", label: "password", value: v.password ?? "hunter2", width: 120 },
        { key: "s", label: "strategy", type: "select", options: VSTRAT, value: st }, { key: "db", label: "database", type: "select", options: ["up", "down"], value: pick(v.db, ["up", "down"]) }],
      build: (i) => simulateValidation({ email: Viz.parse.str(i.email ?? "", { min: 0, max: 60 }), age: Viz.parse.str(i.age ?? "", { min: 0, max: 6 }), password: Viz.parse.str(i.password ?? "", { min: 0, max: 40 }) }, pick(i.s, VSTRAT), pick(i.db, ["up", "down"])),
      random: () => ({ email: ["ada@example", "grace@navy.mil", "", "lin@@x.io", "bob@site.org"][Viz.rand(0, 4)], age: ["17", "42", "x", "18", ""][Viz.rand(0, 4)], password: ["hunter2", "correct horse 9 battery", "short", "longpassword!!"][Viz.rand(0, 3)], s: st, db: Math.random() < 0.3 ? "down" : "up" }),
      render: (f) => {
        const rows = f.res.map(([field, name, pass], k) => `<tr class="${k === f.cur ? "cur" : ""}"><th>${esc(field)}</th><td>${esc(name)}</td><td class="${pass === null ? "dim" : pass ? "done" : "bad"}">${pass === null ? "not checked" : pass ? "✓ pass" : "✗ fail"}</td></tr>`).join("");
        const tbl = `<table class="eh-tbl"><thead><tr><th>field</th><th>rule</th><th>result</th></tr></thead><tbody>${rows}</tbody></table>`;
        const http = f.http ? `<pre class="eh-out eh-http ${f.ok ? "done" : f.server ? "bad" : "warn"}">${esc(f.http.join("\n"))}</pre>` : "";
        const trips = f.trips ? chips(chip("rejected round trips", f.trips, f.trips > 1 ? "bad" : "done")) : "";
        return tbl + http + trips;
      },
    };
  }, {}));

  /* ================= 8. async: where does an exception go when nobody awaits? ================= */
  const AP = {
    "C#": [
      { n: "await the task", code: ["async Task<int> LoadAsync()", "{", "    await Task.Delay(50);", "    throw new IOException(\"disk busy\");«thA»", "}", "try { var n = await LoadAsync(); }«await»", "catch (IOException e) { log.LogError(e, \"load failed\"); }«catch»"],
        ev: [[0, "caller", "start", "calls LoadAsync() and awaits it", "await"], [1, "A", "start", "LoadAsync runs", "thA"], [3, "A", "throw", "throws IOException: stored in the Task", "thA", "A"], [4, "caller", "observe", "await rethrows the original IOException (not wrapped)", "await", ["A"]], [5, "caller", "handle", "catch logs it once", "catch"]], verdict: ["propagated to the caller", "done"] },
      { n: "fire and forget: _ = SaveAsync()", code: ["async Task SaveAsync()", "{", "    await Task.Delay(50);", "    throw new IOException(\"disk busy\");«thA»", "}", "_ = SaveAsync();   // nobody awaits it«fire»", "return Results.Ok();«ret»", "// much later, when the GC finalizes the Task:", "TaskScheduler.UnobservedTaskException += …;«gc»"],
        ev: [[0, "caller", "start", "starts SaveAsync and discards the Task", "fire"], [1, "A", "start", "SaveAsync runs", "thA"], [2, "caller", "ret", "returns 200 OK: the user thinks it saved", "ret"], [4, "A", "throw", "throws IOException: stored in a Task nobody holds", "thA", "A"], [9, "runtime", "log", "GC finalizes the Task and raises UnobservedTaskException; since .NET 4.5 the process does not crash", "gc"]], verdict: ["lost (an event at GC time, if anyone listens)", "bad"] },
      { n: "async void method", code: ["async void OnSave()   // async void!«fire»", "{", "    await Task.Delay(50);", "    throw new IOException(\"disk busy\");«thA»", "}", "try { OnSave(); }   // returns at the first await«call»", "catch (IOException) { /* never runs */ }«catch»"],
        ev: [[0, "caller", "start", "calls OnSave() inside try", "call"], [1, "A", "start", "OnSave runs until its first await", "fire"], [2, "caller", "ret", "OnSave returned at the await: the try block is already over", "catch"], [4, "A", "throw", "throws IOException: there is no Task to store it in", "thA", "A"], [5, "runtime", "crash", "rethrown on the thread pool / SynchronizationContext: unhandled, the process terminates", "thA"]], verdict: ["process crashed", "bad"] },
      { n: "Task.WhenAll with two failures", code: ["var a = LoadAAsync();   // throws TimeoutException«stA»", "var b = LoadBAsync();   // throws IOException«stB»", "var all = Task.WhenAll(a, b);", "try { await all; }«await»", "catch (Exception e)   // just the first one«catch»", "{", "    foreach (var x in all.Exception!.InnerExceptions)«insp»", "        log.LogError(x, \"load failed\");", "}"],
        ev: [[0, "A", "start", "LoadAAsync starts", "stA"], [0.5, "B", "start", "LoadBAsync starts", "stB"], [1, "caller", "start", "awaits WhenAll(a, b)", "await"], [3, "A", "throw", "TimeoutException stored in a", "stA", "A"], [4, "B", "throw", "IOException stored in b", "stB", "B"], [5, "caller", "observe", "await throws only the FIRST inner exception (TimeoutException)", "catch", ["A"]], [6, "caller", "observe", "all.Exception (an AggregateException) holds both", "insp", ["B"]]], verdict: ["all collected, if you read Task.Exception", "warn"] },
    ],
    Java: [
      { n: "future.join()", code: ["var f = CompletableFuture.supplyAsync(() -> load());«stA»", "// load() throws UncheckedIOException(\"disk busy\")«thA»", "try { int n = f.join(); }«await»", "catch (CompletionException e) {«catch»", "    log.error(\"load failed\", e.getCause());   // unwrap«unwrap»", "}"],
        ev: [[0, "caller", "start", "supplyAsync(load) on the common pool", "stA"], [0.5, "A", "start", "load() runs", "stA"], [3, "A", "throw", "throws: the future completes exceptionally", "thA", "A"], [4, "caller", "observe", "join() throws CompletionException wrapping it", "await", ["A"]], [5, "caller", "handle", "getCause() gives back the original exception", "unwrap"]], verdict: ["propagated (wrapped in CompletionException)", "done"] },
      { n: "fire and forget: runAsync, never joined", code: ["CompletableFuture.runAsync(() -> save());«fire»", "// save() throws UncheckedIOException(\"disk busy\")«thA»", "return ResponseEntity.ok().build();«ret»", "// nothing ever calls join(), get(), exceptionally()«never»"],
        ev: [[0, "caller", "start", "runAsync(save) and drops the future", "fire"], [0.5, "A", "start", "save() runs", "thA"], [2, "caller", "ret", "returns 200 OK", "ret"], [4, "A", "throw", "throws: stored in a future nobody holds", "thA", "A"], [9, "runtime", "log", "nothing happens. No log, no event, no crash", "never"]], verdict: ["lost silently", "bad"] },
      { n: "plain Thread throws", code: ["new Thread(() -> {«fire»", "    save();   // throws UncheckedIOException«thA»", "}).start();", "return ResponseEntity.ok().build();«ret»", "// Thread.setDefaultUncaughtExceptionHandler(…)«handler»"],
        ev: [[0, "caller", "start", "starts a thread", "fire"], [0.5, "A", "start", "save() runs on Thread-0", "thA"], [2, "caller", "ret", "returns 200 OK", "ret"], [4, "A", "throw", "throws: the thread dies", "thA", "A"], [5, "runtime", "log", "default handler prints 'Exception in thread \"Thread-0\" …' to stderr; the JVM keeps running", "handler", ["A"]]], verdict: ["printed to stderr, then forgotten", "warn"] },
      { n: "allOf(a, b).join() with two failures", code: ["var a = supplyAsync(() -> loadA());   // times out«stA»", "var b = supplyAsync(() -> loadB());   // I/O error«stB»", "try { CompletableFuture.allOf(a, b).join(); }«await»", "catch (CompletionException e) {   // ONE cause«catch»", "    // ask a and b individually for the rest«insp»", "}"],
        ev: [[0, "A", "start", "loadA starts", "stA"], [0.5, "B", "start", "loadB starts", "stB"], [1, "caller", "start", "joins allOf(a, b)", "await"], [3, "A", "throw", "a completes exceptionally", "stA", "A"], [4, "B", "throw", "b completes exceptionally", "stB", "B"], [5, "caller", "observe", "join() throws a CompletionException with ONE of the causes", "catch", ["A"]]], verdict: ["first only; the other is dropped unless you check b", "warn"] },
    ],
    Python: [
      { n: "await load()", code: ["async def load():", "    await asyncio.sleep(0.05)", "    raise OSError(\"disk busy\")«thA»", "", "try:", "    n = await load()«await»", "except OSError:", "    log.exception(\"load failed\")«catch»"],
        ev: [[0, "caller", "start", "awaits load()", "await"], [1, "A", "start", "load() runs", "thA"], [3, "A", "throw", "raises OSError", "thA", "A"], [4, "caller", "observe", "await re-raises it with the full traceback", "await", ["A"]], [5, "caller", "handle", "except logs it once", "catch"]], verdict: ["propagated to the caller", "done"] },
      { n: "create_task, never awaited", code: ["async def save():", "    await asyncio.sleep(0.05)", "    raise OSError(\"disk busy\")«thA»", "", "asyncio.create_task(save())   # result dropped«fire»", "return Response(status=200)«ret»", "# when the Task is garbage-collected, asyncio logs«gc»", "# \"Task exception was never retrieved\""],
        ev: [[0, "caller", "start", "create_task(save()) and drops the Task", "fire"], [1, "A", "start", "save() runs", "thA"], [2, "caller", "ret", "returns 200", "ret"], [4, "A", "throw", "raises OSError: stored in the Task", "thA", "A"], [9, "runtime", "log", "at GC: 'Task exception was never retrieved' (the Task could even be collected before it finishes)", "gc"]], verdict: ["lost (a log line at GC time)", "bad"] },
      { n: "gather() with two failures", code: ["try:", "    a, b = await asyncio.gather(load_a(), load_b())«await»", "except Exception:   # the first one only«catch»", "    log.exception(\"load failed\")", "# load_b keeps running; its error is dropped«insp»"],
        ev: [[0, "caller", "start", "awaits gather(load_a(), load_b())", "await"], [0.5, "A", "start", "load_a runs", "await"], [0.7, "B", "start", "load_b runs", "await"], [3, "A", "throw", "load_a raises TimeoutError", "await", "A"], [3.5, "caller", "observe", "gather raises the first exception at once; load_b is NOT cancelled", "catch", ["A"]], [5, "B", "throw", "load_b raises OSError: gather marks it retrieved and drops it", "insp", "B"], [6, "runtime", "lost", "OSError is gone: no log, no warning", "insp", ["B"]]], verdict: ["first only; the rest silently dropped", "warn"] },
      { n: "TaskGroup (3.11+)", code: ["try:", "    async with asyncio.TaskGroup() as tg:«tg»", "        tg.create_task(load_a())«stA»", "        tg.create_task(load_b())«stB»", "except* TimeoutError as eg:«catch»", "    log.error(\"timed out: %s\", eg.exceptions)", "except* OSError as eg:", "    log.error(\"io: %s\", eg.exceptions)"],
        ev: [[0, "caller", "start", "enters the TaskGroup", "tg"], [0.5, "A", "start", "load_a runs", "stA"], [0.7, "B", "start", "load_b runs", "stB"], [3, "A", "throw", "load_a raises TimeoutError", "stA", "A"], [3.5, "B", "cancel", "the group cancels its siblings: load_b gets CancelledError", "stB"], [4.5, "caller", "observe", "the block raises ExceptionGroup([TimeoutError]); except* routes it", "catch", ["A"]]], verdict: ["structured: siblings cancelled, every real failure reported", "done"] },
    ],
    Go: [
      { n: "errgroup: g.Go + g.Wait()", code: ["g, ctx := errgroup.WithContext(ctx)«tg»", "g.Go(func() error { return loadA(ctx) })   // fails«stA»", "g.Go(func() error { return loadB(ctx) })«stB»", "if err := g.Wait(); err != nil {   // first error«await»", "    return fmt.Errorf(\"load: %w\", err)«catch»", "}"],
        ev: [[0, "caller", "start", "creates the group with a derived ctx", "tg"], [0.5, "A", "start", "loadA runs", "stA"], [0.7, "B", "start", "loadB runs", "stB"], [3, "A", "throw", "loadA returns an error: the group cancels ctx", "stA", "A"], [3.5, "B", "cancel", "loadB sees ctx.Done() and returns context.Canceled", "stB"], [4.5, "caller", "observe", "Wait() returns the FIRST error", "await", ["A"]], [5, "caller", "handle", "wrapped with %w and returned", "catch"]], verdict: ["propagated; siblings cancelled", "done"] },
      { n: "go func() ignoring its error", code: ["go func() {«fire»", "    _ = save()   // error discarded«thA»", "}()", "w.WriteHeader(http.StatusOK)«ret»"],
        ev: [[0, "caller", "start", "starts a goroutine", "fire"], [0.5, "A", "start", "save() runs", "thA"], [2, "caller", "ret", "writes 200 OK", "ret"], [4, "A", "throw", "save() returns an error", "thA", "A"], [4.5, "runtime", "lost", "assigned to _: gone", "thA", ["A"]]], verdict: ["lost silently", "bad"] },
      { n: "panic inside a goroutine", code: ["defer func() { recover() }()   // protects THIS goroutine only«guard»", "go func() {«fire»", "    var m map[string]int", "    m[\"x\"] = 1   // panic: nil map write«thA»", "}()", "srv.ListenAndServe()«ret»"],
        ev: [[0, "caller", "start", "main defers a recover", "guard"], [1, "caller", "start", "starts a goroutine", "fire"], [1.5, "A", "start", "the goroutine runs", "fire"], [2, "caller", "ret", "main keeps serving requests", "ret"], [4, "A", "throw", "panic: assignment to entry in nil map", "thA", "A"], [5, "runtime", "crash", "no recover in THAT goroutine: the whole program exits (status 2), every in-flight request dies", "thA"]], verdict: ["process crashed", "bad"] },
      { n: "errors.Join over a WaitGroup", code: ["var wg sync.WaitGroup", "errs := make([]error, len(jobs))«stA»", "for i, job := range jobs {", "    wg.Add(1)", "    go func() { defer wg.Done(); errs[i] = job(ctx) }()«stB»", "}", "wg.Wait()«await»", "return errors.Join(errs...)   // nil if all nil«catch»"],
        ev: [[0, "caller", "start", "starts both jobs", "stA"], [0.5, "A", "start", "job 0 runs", "stB"], [0.7, "B", "start", "job 1 runs", "stB"], [3, "A", "throw", "job 0 returns a timeout error into errs[0]", "stB", "A"], [4, "B", "throw", "job 1 returns an I/O error into errs[1]", "stB", "B"], [5, "caller", "observe", "Wait() returns; errors.Join keeps both, errors.Is works on each", "catch", ["A", "B"]]], verdict: ["all collected", "done"] },
    ],
    TypeScript: [
      { n: "await load()", code: ["async function load(): Promise<number> {", "  await sleep(50);", "  throw new IOError(\"disk busy\");«thA»", "}", "try { const n = await load(); }«await»", "catch (e) { log.error(\"load failed\", e); }«catch»"],
        ev: [[0, "caller", "start", "awaits load()", "await"], [1, "A", "start", "load() runs", "thA"], [3, "A", "throw", "throws: the promise rejects", "thA", "A"], [4, "caller", "observe", "await throws the rejection reason", "await", ["A"]], [5, "caller", "handle", "catch logs it once", "catch"]], verdict: ["propagated to the caller", "done"] },
      { n: "floating promise (no await, no .catch)", code: ["async function save(): Promise<void> {", "  await sleep(50);", "  throw new IOError(\"disk busy\");«thA»", "}", "save();   // floating«fire»", "res.status(200).end();«ret»", "// Node 15+: 'unhandledRejection' → exit code 1«gc»"],
        ev: [[0, "caller", "start", "calls save() and ignores the promise", "fire"], [1, "A", "start", "save() runs", "thA"], [2, "caller", "ret", "responds 200", "ret"], [4, "A", "throw", "the promise rejects with no handler attached", "thA", "A"], [5, "runtime", "crash", "Node raises unhandledRejection and (since v15) terminates the process", "gc"]], verdict: ["process crashed", "bad"] },
      { n: "Promise.all with two failures", code: ["try {", "  const [a, b] = await Promise.all([loadA(), loadB()]);«await»", "} catch (e) {   // the first rejection only«catch»", "  log.error(\"load failed\", e);", "}", "// loadB keeps running; its rejection is ignored«insp»"],
        ev: [[0, "caller", "start", "awaits Promise.all([loadA(), loadB()])", "await"], [0.5, "A", "start", "loadA runs", "await"], [0.7, "B", "start", "loadB runs", "await"], [3, "A", "throw", "loadA rejects", "await", "A"], [3.5, "caller", "observe", "Promise.all rejects at once with loadA's reason", "catch", ["A"]], [5, "B", "throw", "loadB rejects later: Promise.all already handled it, so it is ignored", "insp", "B"], [6, "runtime", "lost", "loadB's reason is never seen", "insp", ["B"]]], verdict: ["first only; the rest silently dropped", "warn"] },
      { n: "Promise.allSettled with two failures", code: ["const rs = await Promise.allSettled([loadA(), loadB()]);«await»", "const failed = rs.filter((r) => r.status === \"rejected\");«catch»", "if (failed.length)", "  throw new AggregateError(failed.map((r) => r.reason), \"loads failed\");«insp»"],
        ev: [[0, "caller", "start", "awaits allSettled", "await"], [0.5, "A", "start", "loadA runs", "await"], [0.7, "B", "start", "loadB runs", "await"], [3, "A", "throw", "loadA rejects", "await", "A"], [4, "B", "throw", "loadB rejects", "await", "B"], [5, "caller", "observe", "allSettled waits for both and reports each outcome", "catch", ["A", "B"]], [6, "caller", "handle", "both reasons go into one AggregateError", "insp"]], verdict: ["all collected", "done"] },
    ],
  };
  function simulateAsync(lang, pat) {
    const P = AP[lang].find((p) => p.n === pat) || AP[lang][0], { at } = listing(P.code);
    const lanes = ["caller", ...["A", "B"].filter((l) => P.ev.some((e) => e[1] === l)), ...(P.ev.some((e) => e[1] === "runtime") ? ["runtime"] : [])];
    const frames = [], done = [], stored = new Set(), seen = new Set();
    let crashed = false;
    for (const e of P.ev) {
      const [t, lane, kind, text, lbl, err] = e;
      done.push({ t, lane, kind, text });
      if (kind === "throw") stored.add(err);
      if ((kind === "observe" || kind === "log") && Array.isArray(err)) err.forEach((x) => seen.add(x));
      if (kind === "lost" && Array.isArray(err)) err.forEach((x) => seen.delete(x));
      if (kind === "crash") crashed = true;
      frames.push({ lang, lanes, ev: Viz.clone(done), line: [].concat(lbl).map((l) => at[l]).filter((n) => n !== undefined), note: `<b>${esc(lane === "A" || lane === "B" ? `task ${lane}` : lane)}</b>: ${esc(text)}.`, vars: { "errors raised": stored.size, "errors observed": [...stored].filter((x) => seen.has(x)).length, process: crashed ? "dead" : "alive" } });
    }
    const unseen = [...stored].filter((x) => !seen.has(x)).length;
    frames.push({ lang, lanes, ev: Viz.clone(done), line: [], final: true, verdict: P.verdict, note: `<b>Verdict: ${esc(P.verdict[0])}.</b> ${crashed ? "An exception with nowhere to go took the whole process down." : unseen ? `${unseen} of ${stored.size} error${stored.size > 1 ? "s" : ""} never reached code that could act on ${unseen > 1 ? "them" : "it"}.` : "Every error reached code that could act on it."}`, vars: { "errors raised": stored.size, "errors observed": stored.size - unseen, process: crashed ? "dead" : "alive" } });
    return frames;
  }
  Viz.register(S + "async", (el) => adaptive(el, (v) => {
    const lang = pick(v.lang, LANGS), names = AP[lang].map((p) => p.n), pat = pick(v.p, names);
    return {
      sig: lang + "|" + pat, title: "Async errors: awaited, lost, or fatal?", tag: "SIMULATION · TASK TIMELINE",
      legend: [["done", "observed / handled"], ["bad", "thrown / crashed / lost"], ["path", "waiting on a task"]],
      code: AP[lang].find((p) => p.n === pat).code.map((l) => l.replace(/\s*«[\w,]+»\s*$/, "")), codeLang: LID[lang],
      inputs: [{ key: "lang", label: "language", type: "select", options: LANGS, value: lang }, { key: "p", label: "pattern", type: "select", options: names, value: pat }],
      build: (i) => { const l = pick(i.lang, LANGS); return simulateAsync(l, pick(i.p, AP[l].map((p) => p.n))); },
      random: () => ({ lang, p: names[Viz.rand(0, names.length - 1)] }),
      render: (f) => {
        const W = 500, H = 30 + f.lanes.length * 44, x = (t) => 86 + t * 39, y = (l) => 30 + f.lanes.indexOf(l) * 44;
        const laneName = (l) => (l === "A" || l === "B" ? `task ${l}` : l);
        let s = f.lanes.map((l) => `<text class="small" x="8" y="${y(l) + 4}">${laneName(l)}</text><line class="edge dash" x1="80" y1="${y(l)}" x2="${W - 8}" y2="${y(l)}"/>`).join("");
        const mark = { start: (cx, cy) => `<circle class="box" cx="${cx}" cy="${cy}" r="6"/>`, ret: (cx, cy) => `<rect class="box done" x="${cx - 7}" y="${cy - 7}" width="14" height="14" rx="3"/>`, throw: (cx, cy) => `<circle class="box bad" cx="${cx}" cy="${cy}" r="8"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="small">!</text>`,
          observe: (cx, cy) => `<circle class="box done" cx="${cx}" cy="${cy}" r="8"/>`, handle: (cx, cy) => `<circle class="box done" cx="${cx}" cy="${cy}" r="5"/>`, cancel: (cx, cy) => `<circle class="box visit" cx="${cx}" cy="${cy}" r="7"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="small">×</text>`,
          log: (cx, cy) => `<rect class="box path" x="${cx - 8}" y="${cy - 8}" width="16" height="16" rx="3"/>`, lost: (cx, cy) => `<circle class="box bad" cx="${cx}" cy="${cy}" r="8" stroke-dasharray="3 2"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="small">?</text>`, crash: (cx, cy) => `<rect class="box bad" x="${cx - 10}" y="${cy - 10}" width="20" height="20" rx="4"/><text x="${cx}" y="${cy + 4}" text-anchor="middle" class="small">✖</text>` };
        const ends = {};
        f.ev.forEach((e) => { if (e.lane === "A" || e.lane === "B") { ends[e.lane] = ends[e.lane] || [e.t, e.t]; ends[e.lane][1] = e.t; } });
        s += Object.entries(ends).map(([l, [a, b]]) => `<line class="edge path" x1="${x(a)}" y1="${y(l)}" x2="${x(b)}" y2="${y(l)}" stroke-width="3"/>`).join("");
        s += f.ev.map((e, k) => mark[e.kind](x(e.t), y(e.lane)) + (k === f.ev.length - 1 && !f.final ? `<circle class="box active" cx="${x(e.t)}" cy="${y(e.lane)}" r="13" fill="none"/>` : "")).join("");
        const svg = `<div class="eh-fit"><svg class="dg" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Async timeline">${s}</svg></div>`;
        const log = `<ol class="eh-evlog">${f.ev.map((e) => `<li class="${e.kind === "throw" || e.kind === "crash" || e.kind === "lost" ? "bad" : e.kind === "observe" || e.kind === "handle" ? "done" : ""}"><b>${esc(laneName(e.lane))}</b> ${esc(e.text)}</li>`).join("")}</ol>`;
        return svg + log + (f.final ? chips(chip("verdict", f.verdict[0], f.verdict[1] === "done" ? "done" : f.verdict[1] === "warn" ? "accent" : "bad")) : "");
      },
    };
  }, {}));
})();
