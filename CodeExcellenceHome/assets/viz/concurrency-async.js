/* Visualizers for "Concurrency & Async". Every registered name starts with "concurrency-async-". */
(() => {
  const esc = Viz.esc;
  const pick = (a) => a[Viz.rand(0, a.length - 1)];
  const int = (s, name, lo, hi) => {
    const n = Number(String(s).trim());
    if (!Number.isInteger(n) || n < lo || n > hi) throw new Error(`${name}: use a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const stats = (items) => `<div class="ca-stats">${items.map(([k, v, c]) => `<div class="ca-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(k)}</span></div>`).join("")}</div>`;
  const chip = (txt, cls = "") => `<span class="ca-chip ${cls}">${esc(txt)}</span>`;
  const box = (title, sub, body, cls = "") => `<div class="ca-box ${cls}"><div class="ca-box-h"><b>${title}</b>${sub ? `<small>${sub}</small>` : ""}</div><div class="ca-box-b">${body}</div></div>`;
  const empty = (t = "empty") => `<span class="ca-mute">${esc(t)}</span>`;
  const setCode = (host, lines, lang) => {
    host.querySelectorAll(".viz-code li").forEach((li, k) => {
      const src = lines[k] ?? "";
      if (li.dataset.src === src) return;
      li.dataset.src = src;
      li.innerHTML = (window.LearningHome && window.LearningHome.highlight(src, lang)) ?? esc(src);
    });
  };
  const mulberry = (a) => () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const sparks = (vals, o = {}) => {
    const mx = Math.max(1, o.max || 0, ...vals);
    return `<div class="v-labeled"><span class="v-caption">${esc(o.label || "")}</span><div class="ca-spark" style="--n:${Math.max(vals.length, o.len || 0)}">${vals.map((v, i) => `<i class="${o.cls ? o.cls(v, i) : ""}" style="height:${Math.round((v / mx) * 100)}%" title="${esc(v)}"></i>`).join("")}</div></div>`;
  };

  /* =====================================================================
   * 1. Concurrency vs parallelism: the same work under five models
   * ===================================================================== */
  const MODELS = ["sequential, one thread", "one OS thread per task", "Python threads + GIL", "event loop, one thread", "async tasks on a pool"];
  const MKEY = ["seq", "thr", "gil", "loop", "pool"];
  function parseWork(s) {
    const parts = String(s).split(";").map((t) => t.trim()).filter(Boolean);
    if (parts.length < 1 || parts.length > 6) throw new Error("Use 1 to 6 tasks separated by ';', for example: C2 I4 C1; C3; C1 I3 C2");
    let total = 0;
    const tasks = parts.map((t, i) => {
      const segs = [];
      for (const x of t.split(/[\s,]+/).filter(Boolean)) {
        const m = /^([CI])(\d+)$/i.exec(x);
        if (!m) throw new Error(`"${x}" is not a segment. Write C3 for 3 ticks of CPU work and I4 for 4 ticks of waiting on I/O.`);
        const n = Number(m[2]), k = m[1].toUpperCase();
        if (n < 1 || n > 9) throw new Error(`"${x}": each segment is 1 to 9 ticks.`);
        total += n;
        if (segs.length && segs[segs.length - 1].k === k) segs[segs.length - 1].n += n; else segs.push({ k, n });
      }
      if (segs[0].k !== "C") throw new Error(`Task ${i + 1} starts with I/O. Every task starts with some CPU work (C…): code has to run to start the I/O.`);
      return { name: `T${i + 1}`, segs };
    });
    if (total > 48) throw new Error("Keep the total work to 48 ticks or fewer so the timeline stays readable.");
    return tasks;
  }
  function simModels(tasks, cores, model) {
    const n = tasks.length, name = (i) => tasks[i].name;
    const st = tasks.map((t) => ({ seg: 0, kind: "C", left: t.segs[0].n, done: false, fin: 0, last: -1 }));
    const readyQ = tasks.map((_, i) => i), slot = new Array(cores).fill(-1);
    let holder = -1, held = 0, loopCur = -1, cpu = 0;
    const ticks = [];
    for (let t = 0; st.some((s) => !s.done); t++) {
      if (t > 160) throw new Error("The simulation did not finish; use less work.");
      const ev = [];
      const runnable = [];
      st.forEach((s, i) => { if (!s.done && s.kind === "C") runnable.push(i); });
      const fair = (a, b) => st[a].last - st[b].last || a - b;
      let run = [], cur = -1;
      if (model === "seq") { cur = st.findIndex((s) => !s.done); if (st[cur].kind === "C") run = [cur]; }
      else if (model === "thr") run = runnable.slice().sort(fair).slice(0, cores);
      else if (model === "gil") {
        if (holder >= 0 && (st[holder].done || st[holder].kind !== "C")) { holder = -1; held = 0; }
        const others = runnable.filter((i) => i !== holder).sort(fair);
        if (holder >= 0 && held >= 2 && others.length) { ev.push(`the GIL switch interval expired: ${name(holder)} must release the GIL, and ${name(others[0])} takes it`); holder = others[0]; held = 0; }
        else if (holder < 0 && others.length) { holder = others[0]; held = 0; }
        if (holder >= 0) run = [holder];
      } else if (model === "loop") {
        if (loopCur >= 0 && (st[loopCur].done || st[loopCur].kind !== "C")) loopCur = -1;
        if (loopCur < 0 && readyQ.length) loopCur = readyQ.shift();
        if (loopCur >= 0) run = [loopCur];
      } else {
        for (let c = 0; c < cores; c++) if (slot[c] >= 0 && (st[slot[c]].done || st[slot[c]].kind !== "C")) slot[c] = -1;
        for (let c = 0; c < cores; c++) if (slot[c] < 0 && readyQ.length) slot[c] = readyQ.shift();
        run = slot.filter((k) => k >= 0);
      }
      // sticky core numbers for the thread-per-task model, so a thread stays on "its" core when it can
      if (model === "thr") {
        for (let c = 0; c < cores; c++) if (slot[c] >= 0 && !run.includes(slot[c])) slot[c] = -1;
        for (const i of run) if (!slot.includes(i)) slot[slot.indexOf(-1)] = i;
      }
      const coreOf = (i) => (model === "thr" || model === "pool" ? slot.indexOf(i) + 1 : 1);
      const cells = st.map((s, i) => {
        if (s.done) return { c: "fin", t: "" };
        if (run.includes(i)) return { c: "cpu", t: String(coreOf(i)) };
        if (s.kind === "I") return { c: "io", t: model === "thr" || model === "gil" || model === "seq" ? "B" : "" };
        if (model === "seq") return { c: "wait", t: "" };
        return { c: "ready", t: "" };
      });
      const readyNotRunning = runnable.filter((i) => !run.includes(i));
      for (const i of run) { st[i].left--; st[i].last = t; cpu++; }
      if (model === "gil" && holder >= 0) held++;
      for (let i = 0; i < n; i++) if (!st[i].done && st[i].kind === "I") st[i].left--;
      for (let i = 0; i < n; i++) {
        const s = st[i];
        if (s.done || s.left > 0) continue;
        s.seg++;
        if (s.seg >= tasks[i].segs.length) { s.done = true; s.fin = t + 1; ev.push(`${name(i)} finishes at t=${t + 1}`); continue; }
        const g = tasks[i].segs[s.seg];
        s.kind = g.k; s.left = g.n;
        if (g.k === "I") ev.push(`${name(i)} starts waiting on I/O for ${g.n} tick${g.n > 1 ? "s" : ""}`);
        else { ev.push(`${name(i)}'s I/O completes, so it wants a CPU again`); if (model === "loop" || model === "pool") readyQ.push(i); }
      }
      ticks.push({ t, cells, run: [...run], ready: readyNotRunning, io: st.filter((s) => !s.done && s.kind === "I").length, ev, fin: st.filter((s) => s.done).length });
    }
    const threads = model === "seq" || model === "loop" ? 1 : model === "pool" ? Math.min(cores, n) : n;
    return { ticks, makespan: ticks.length, cpu, threads, cores: model === "thr" || model === "pool" ? cores : 1 };
  }
  const WORKS = ["C2 I4 C1; C2 I4 C1; C2 I4 C1", "C3 I2 C2; C4; C1 I5 C1; C2 I2 C2", "C5; C5; C5", "C1 I6 C1; C1 I6 C1; C1 I6 C1; C1 I6 C1", "C2 I3 C3; C6; C1 I2 C1 I2 C1"];
  Viz.register("concurrency-async-models", (host) => Viz.player(host, {
    title: "Same work, five execution models: who gets a CPU each tick?",
    tag: "CONCURRENCY VS PARALLELISM",
    legend: [["active", "running on a core (number = core)"], ["visit", "waiting on I/O (B = a thread is blocked)"], ["path", "ready, but no CPU / GIL / loop for it"], ["dim", "not started (no thread yet)"], ["done", "finished"]],
    speed: 700,
    codeLang: "python",
    code: [
      "for tick in itertools.count():",
      "    wake(tasks whose I/O finished)        # ready again",
      "    chosen = pick_runnable(model, cores)",
      "    #   sequential: only the current task",
      "    #   threads:    any ready thread, up to cores",
      "    #   GIL:        one thread at a time",
      "    #   event loop: current task until it awaits",
      "    #   pool:       up to cores, each until it awaits",
      "    for task in chosen: task.run_one_tick()",
      "    for task in waiting_on_io: task.io_tick()",
    ],
    inputs: [
      { key: "work", label: "tasks (C = CPU ticks, I = I/O ticks, ';' between tasks)", value: WORKS[0], width: 360 },
      { key: "cores", label: "cores", value: "2", width: 60 },
      { key: "model", label: "model", type: "select", options: MODELS, value: MODELS[3] },
    ],
    random: () => ({ work: pick(WORKS), cores: String(Viz.rand(1, 4)), model: pick(MODELS) }),
    build: ({ work, cores, model }) => {
      const tasks = parseWork(work), C = int(cores, "cores", 1, 4), mk = MKEY[MODELS.indexOf(model)];
      if (!mk) throw new Error("Pick a model.");
      const sim = simModels(tasks, C, mk);
      const all = MKEY.map((k) => simModels(tasks, C, k));
      const work0 = tasks.reduce((a, t) => a + t.segs.filter((g) => g.k === "C").reduce((x, g) => x + g.n, 0), 0);
      const base = { tasks, T: sim.makespan, mk, C };
      const fr = [];
      const MODEL_NOTE = {
        seq: "One thread runs the tasks one after another. While a task waits on I/O the only thread is blocked, so nothing else happens.",
        thr: `Each task gets its own OS thread. The OS puts up to ${C} runnable thread${C > 1 ? "s" : ""} on the ${C} core${C > 1 ? "s" : ""} and parks threads that wait on I/O.`,
        gil: "Each task gets an OS thread, but CPython lets only the thread holding the Global Interpreter Lock run Python bytecode. Waiting on I/O releases the GIL.",
        loop: "One thread runs an event loop. A task runs until it reaches an await on I/O, then the loop picks the next ready task. I/O waits cost no thread at all.",
        pool: `A pool of ${Math.min(C, tasks.length)} thread${Math.min(C, tasks.length) > 1 ? "s" : ""} (one per core) runs async tasks. A task runs until it awaits I/O, and its thread immediately picks up the next ready task. This is .NET's ThreadPool, Go's scheduler, Java virtual threads, Kotlin coroutines.`,
      };
      fr.push({ ...base, upto: -1, line: 0, vars: { tick: 0, threads: sim.threads, cores: sim.cores }, note: `${MODEL_NOTE[mk]} Total CPU work: <b>${work0}</b> ticks.` });
      sim.ticks.forEach((tk) => {
        let why = "";
        if (tk.ready.length) {
          const r = tk.ready.map((i) => tasks[i].name).join(", ");
          why = mk === "seq" ? `${r} cannot start: there is one thread and it is busy with the current task.`
            : mk === "gil" ? `${r} ${tk.ready.length > 1 ? "are" : "is"} ready, but only the GIL holder runs Python code, so ${C > 1 ? `${C - 1} core${C > 2 ? "s sit" : " sits"} idle` : "it waits"}.`
            : mk === "loop" ? `${r} ${tk.ready.length > 1 ? "are" : "is"} ready, but the loop runs one callback at a time and never preempts it: CPU work blocks everyone until the next await.`
            : mk === "pool" ? `${r} ${tk.ready.length > 1 ? "wait" : "waits"} in the pool's queue: every pool thread is busy with CPU work. More threads would not help, there are only ${C} cores.`
            : `${tk.run.length + tk.ready.length} threads want ${C} core${C > 1 ? "s" : ""}: the OS time-slices them, paying a context switch each time.`;
        } else if (tk.io && !tk.run.length) why = mk === "loop" || mk === "pool" ? "Every task is waiting on I/O and no thread is blocked: the loop or pool is simply idle, ready for other work." : "Every task is waiting on I/O; their threads are parked by the OS. They cost memory (a stack each) but no CPU.";
        else if (tk.io && (mk === "thr" || mk === "gil")) why = "Threads waiting on I/O are parked by the OS, so the cores serve the others.";
        else if (tk.io && (mk === "loop" || mk === "pool")) why = "The tasks waiting on I/O hold no thread: their continuations are parked until the OS reports completion.";
        const parts = [`t=${tk.t}: ${tk.run.length ? `running ${tk.run.map((i) => tasks[i].name).join(", ")}` : "no task is running"}.`];
        if (tk.ev.length) parts.push(tk.ev.join("; ") + ".");
        if (why) parts.push(why);
        fr.push({ ...base, upto: tk.t, line: tk.ev.some((e) => e.includes("completes")) ? [1, 2, 8] : tk.run.length ? [2, 3 + MKEY.indexOf(mk), 8] : [9], vars: { tick: tk.t, running: tk.run.length, "on I/O": tk.io, "ready, no CPU": tk.ready.length, finished: tk.fin, threads: sim.threads }, note: parts.join(" ") });
      });
      const best = Math.min(...all.map((a) => a.makespan));
      fr.push({ ...base, upto: sim.makespan - 1, all: all.map((a, i) => ({ name: MODELS[i], ms: a.makespan, th: a.threads, util: Math.round((100 * a.cpu) / (a.makespan * a.cores)), me: MKEY[i] === mk, best: a.makespan === best })), line: null,
        vars: { makespan: sim.makespan, "CPU work": work0, threads: sim.threads, "core use": `${Math.round((100 * sim.cpu) / (sim.makespan * sim.cores))}%` },
        note: `Done in <b>${sim.makespan}</b> ticks with ${sim.threads} thread${sim.threads > 1 ? "s" : ""}. The chart compares every model on the same work: I/O-heavy work needs <b>concurrency</b> (overlap the waits), CPU-heavy work needs <b>parallelism</b> (more cores). Async on a pool gets both without a thread per task.` });
      return fr;
    },
    render: (f) => {
      const T = f.T, compact = T > 34;
      const head = `<div class="ca-tl-row ca-tl-head"><span class="ca-tl-lbl">tick</span>${Array.from({ length: T }, (_, t) => `<span class="${t === f.upto ? "cur" : ""}">${!compact || t % 5 === 0 ? t : ""}</span>`).join("")}</div>`;
      const sim = simModels(f.tasks, f.C, f.mk);
      const rows = f.tasks.map((task, i) => `<div class="ca-tl-row"><span class="ca-tl-lbl">${esc(task.name)} <small>${esc(task.segs.map((g) => g.k + g.n).join(" "))}</small></span>${sim.ticks.map((tk, t) => { const c = tk.cells[i]; return t > f.upto ? `<span class="fut"></span>` : `<span class="ca-c-${c.c} ${t === f.upto ? "cur" : ""}">${compact ? "" : esc(c.t)}</span>`; }).join("")}</div>`).join("");
      const busy = `<div class="ca-tl-row ca-tl-foot"><span class="ca-tl-lbl">cores busy</span>${sim.ticks.map((tk, t) => `<span class="${t === f.upto ? "cur" : ""}">${t <= f.upto ? tk.run.length : ""}</span>`).join("")}</div>`;
      const tl = `<div class="ca-fit"><div class="ca-tl ${compact ? "compact" : ""}" style="--cols:${T}">${head}${rows}${busy}</div></div>`;
      if (!f.all) return tl;
      const mx = Math.max(...f.all.map((a) => a.ms));
      const chart = `<div class="ca-hbars">${f.all.map((a) => `<div class="ca-hbar ${a.me ? "me" : ""} ${a.best ? "best" : ""}"><span>${esc(a.name)}</span><i style="width:${Math.round((a.ms / mx) * 100)}%"></i><b>${a.ms} ticks</b><small>${a.th} thread${a.th > 1 ? "s" : ""} · ${a.util}% core use</small></div>`).join("")}</div>`;
      return tl + Viz.labeled("makespan for the same work, by model (shortest in green)", chart);
    },
  }));

  /* =====================================================================
   * 2. Thread pool: local deques and work stealing vs one shared queue
   * ===================================================================== */
  const STRATS = ["work stealing (local deques)", "one shared global queue"];
  Viz.register("concurrency-async-stealing", (host) => Viz.player(host, {
    title: "A fork/join job on a thread pool: work stealing vs one locked queue",
    tag: "THREAD POOL · STEP THROUGH",
    legend: [["active", "running a task"], ["path", "stealing from another worker"], ["bad", "waiting for the queue lock"], ["visit", "global queue operation"], ["dim", "idle"]],
    speed: 650,
    codeLang: "csharp",
    code: [
      "void Sort(int lo, int hi) {                  // one task",
      "    if (hi - lo <= threshold) { Leaf(lo, hi); return; }",
      "    int mid = (lo + hi) / 2;",
      "    Fork(() => Sort(mid, hi));   // push right half",
      "    Sort(lo, mid);               // keep the left half",
      "}",
      "// a worker looking for work:",
      "//   1. pop newest from MY deque (no lock, cache-warm)",
      "//   2. else take oldest from the global queue (lock)",
      "//   3. else steal OLDEST from another worker's deque",
    ],
    inputs: [
      { key: "n", label: "array size", value: "32", width: 60 },
      { key: "th", label: "leaf threshold", value: "4", width: 60 },
      { key: "w", label: "workers", value: "3", width: 60 },
      { key: "mode", label: "queueing", type: "select", options: STRATS, value: STRATS[0] },
    ],
    random: () => ({ n: String(pick([16, 24, 32, 40])), th: String(Viz.rand(2, 6)), w: String(Viz.rand(2, 4)), mode: pick(STRATS) }),
    build: ({ n, th, w, mode }) => {
      const N = int(n, "array size", 4, 48), TH = int(th, "leaf threshold", 1, 12), W = int(w, "workers", 1, 4), steal = mode === STRATS[0];
      const mk = (lo, hi) => ({ lo, hi, split: hi - lo > TH, cost: hi - lo > TH ? 1 : hi - lo, lab: `${lo}–${hi - 1}` });
      let leaves = 0; (function cnt(lo, hi) { if (hi - lo > TH) { const m = (lo + hi) >> 1; cnt(lo, m); cnt(m, hi); } else leaves++; })(0, N);
      const work = (function sum(lo, hi) { if (hi - lo > TH) { const m = (lo + hi) >> 1; return 1 + sum(lo, m) + sum(m, hi); } return hi - lo; })(0, N);
      const global = [mk(0, N)];
      const ws = Array.from({ length: W }, (_, i) => ({ id: i, dq: [], cur: null, left: 0, push: null, hist: [] }));
      let done = 0, t = 0, steals = 0, lockWaits = 0, idle = 0, globalOps = 0;
      const fr = [];
      const snap = (line, note, act) => fr.push({ t, W, steal, global: global.map((x) => x.lab), ws: ws.map((x) => ({ dq: x.dq.map((d) => d.lab), cur: x.cur ? { lab: x.cur.lab, left: x.left, cost: x.cur.cost, split: x.cur.split } : null, hist: [...x.hist], push: x.push ? x.push.lab : null })), act, line, note,
        vars: { tick: t, "leaves done": `${done}/${leaves}`, steals, "lock waits": lockWaits, "idle ticks": idle } });
      snap(null, `An outside thread (say, a request) submits <b>Sort(0, ${N})</b>. External work goes to the <b>global queue</b>. Every split costs 1 tick and pushes the right half; a leaf of k elements costs k ticks. Total work: ${work} ticks on ${W} worker${W > 1 ? "s" : ""}, so the ideal finish is about ${Math.ceil(work / W)} ticks.`, []);
      while (done < leaves) {
        if (t > 240) throw new Error("Too many ticks; use a smaller array or a larger threshold.");
        let lock = false; const act = [], notes = [];
        const order = ws.map((_, i) => (i + t) % W);
        for (const k of order) {
          const x = ws[k];
          if (x.push) {
            if (!lock) { lock = true; globalOps++; global.push(x.push); act[k] = "G"; notes.push(`W${k + 1} takes the lock to push ${x.push.lab}`); x.push = null; }
            else { act[k] = "L"; lockWaits++; notes.push(`W${k + 1} waits for the lock`); }
            continue;
          }
          if (!x.cur) {
            if (steal && x.dq.length) { x.cur = x.dq.pop(); x.left = x.cur.cost; }
            else if (global.length) {
              if (!lock) { lock = true; globalOps++; x.cur = global.shift(); x.left = x.cur.cost; act[k] = "G"; notes.push(`W${k + 1} locks the global queue and takes ${x.cur.lab}`); }
              else { act[k] = "L"; lockWaits++; notes.push(`W${k + 1} wants the global queue but another worker holds the lock`); }
              continue;
            } else if (steal) {
              const v = ws.map((_, j) => (k + 1 + j) % W).find((j) => j !== k && ws[j].dq.length);
              if (v !== undefined) { x.cur = ws[v].dq.shift(); x.left = x.cur.cost; steals++; act[k] = "S"; notes.push(`W${k + 1} is out of work and steals the <b>oldest</b> task ${x.cur.lab} from W${v + 1}'s deque`); continue; }
            }
            if (!x.cur) { act[k] = "I"; idle++; continue; }
          }
          act[k] = "R"; x.left--;
          if (x.left === 0) {
            if (x.cur.split) {
              const m = (x.cur.lo + x.cur.hi) >> 1, L = mk(x.cur.lo, m), R = mk(m, x.cur.hi);
              if (steal) { x.dq.push(R); notes.push(`W${k + 1} splits ${x.cur.lab}: pushes ${R.lab} onto its own deque (no lock) and keeps ${L.lab}`); }
              else { x.push = R; notes.push(`W${k + 1} splits ${x.cur.lab}: ${R.lab} must go to the shared queue, so it needs the lock next tick`); }
              x.cur = L; x.left = L.cost;
            } else { done++; notes.push(`W${k + 1} finishes leaf ${x.cur.lab}`); x.cur = null; }
          }
        }
        ws.forEach((x, k) => x.hist.push(act[k]));
        t++;
        const hasSteal = act.includes("S"), hasLock = act.includes("L");
        snap(hasSteal ? [9] : hasLock ? [8] : act.includes("G") ? [8] : [0, 3, 4], `t=${t}: ${notes.join("; ") || "everyone keeps running"}.${hasSteal ? " Stealing from the <i>old</i> end takes the biggest unsplit piece and does not fight the owner, who works at the <i>new</i> end." : ""}${hasLock ? " Every push and pop goes through one lock: workers serialise on it, and it gets worse with more cores." : ""}`, act);
      }
      const eff = Math.round((100 * work) / (W * t));
      fr.push({ ...fr[fr.length - 1], line: null, summary: { t, eff, steals, lockWaits, idle, globalOps },
        note: `Finished in <b>${t}</b> ticks (ideal ≈ ${Math.ceil(work / W)}), ${eff}% of worker time did useful work. ${steal ? `${steals} steal${steals !== 1 ? "s" : ""} spread the work and only ${globalOps} global-queue operation${globalOps !== 1 ? "s" : ""} needed the lock. That is why .NET's ThreadPool, Java's ForkJoinPool, Go's scheduler and Tokio all use per-worker queues.` : `${globalOps} lock-protected queue operations and ${lockWaits} tick${lockWaits !== 1 ? "s" : ""} lost waiting for the lock. Switch to work stealing with the same inputs and compare.`}` });
      return fr;
    },
    render: (f) => {
      const g = box("Global queue", "FIFO, shared, behind a lock", f.global.length ? f.global.map((x) => chip(x, "visit")).join("") : empty());
      const ACT = { R: ["active", "run"], S: ["path", "steal"], L: ["bad", "lock wait"], G: ["visit", "global op"], I: ["dim", "idle"] };
      const wsHtml = f.ws.map((x, k) => {
        const a = f.act[k];
        const cur = x.cur ? `<div class="ca-task ${x.cur.split ? "split" : ""}"><b>${esc(x.cur.lab)}</b><small>${x.cur.split ? "split" : "leaf"} · ${x.cur.left} left</small><i style="width:${Math.round(((x.cur.cost - x.cur.left) / x.cur.cost) * 100)}%"></i></div>` : empty("no task");
        const dq = f.steal ? `<div class="ca-deque"><small>oldest · steal end</small>${x.dq.length ? x.dq.map((d) => chip(d)).join("") : empty()}<small>newest · owner end</small></div>` : "";
        const hist = `<div class="ca-hist">${x.hist.map((h) => `<i class="${ACT[h][0]}" title="${ACT[h][1]}"></i>`).join("")}</div>`;
        return `<div class="ca-worker ${a ? ACT[a][0] : ""}"><div class="ca-box-h"><b>Worker ${k + 1}</b><small>${a ? ACT[a][1] : "ready"}${x.push ? ` · must push ${esc(x.push)}` : ""}</small></div>${cur}${dq}${hist}</div>`;
      }).join("");
      const s = f.summary;
      return `${g}<div class="ca-workers" style="--w:${f.W}">${wsHtml}</div>${s ? stats([["ticks", s.t], ["useful work", `${s.eff}%`, s.eff >= 80 ? "done" : "bad"], ["steals", s.steals, "path"], ["lock waits", s.lockWaits, s.lockWaits ? "bad" : ""], ["idle ticks", s.idle]]) : ""}`;
    },
  }));

  /* =====================================================================
   * 3. async/await: the state machine, continuations and the deadlock
   * ===================================================================== */
  const CTX = ["none (ASP.NET Core, console, worker)", "UI thread (WPF / WinForms / old ASP.NET)"];
  const CALLER = ["await GetOrderAsync(42)", "GetOrderAsync(42).Result"];
  const CAF = ["plain await", "ConfigureAwait(false)"];
  const SYNC = ["both are real I/O", "the DB call hits a cache", "both hit a cache"];
  Viz.register("concurrency-async-await", (host) => Viz.player(host, {
    title: "What await really does: state machine, continuations, and the sync-over-async deadlock",
    tag: "ASYNC / AWAIT · STEP THROUGH",
    legend: [["active", "thread running code"], ["bad", "thread blocked"], ["dim", "thread free (pool / message loop)"], ["visit", "queued continuation"], ["path", "I/O in flight, no thread"]],
    speed: 1300,
    codeLang: "csharp",
    code: Array(12).fill(""),
    inputs: [
      { key: "ctx", label: "SynchronizationContext", type: "select", options: CTX, value: CTX[1] },
      { key: "caller", label: "caller", type: "select", options: CALLER, value: CALLER[1] },
      { key: "caf", label: "inside the library", type: "select", options: CAF, value: CAF[0] },
      { key: "sync", label: "awaited calls", type: "select", options: SYNC, value: SYNC[0] },
    ],
    random: () => ({ ctx: pick(CTX), caller: pick(CALLER), caf: pick(CAF), sync: pick(SYNC) }),
    build: ({ ctx, caller, caf, sync }) => {
      const ui = ctx === CTX[1], blockCaller = caller === CALLER[1], noCtx = caf === CAF[1], nSync = SYNC.indexOf(sync);
      const C = noCtx ? ".ConfigureAwait(false)" : "";
      const code = [
        "async Task<Order> GetOrderAsync(int id)",
        "{",
        "    Log(\"start\");",
        `    var row = await _db.QueryAsync(id)${C};`,
        `    var price = await _pricing.GetAsync(row.Sku)${C};`,
        "    return new Order(row, price);",
        "}",
        "",
        `// caller: ${ui ? "a button click handler" : "a controller action"}`,
        blockCaller ? "var order = GetOrderAsync(42).Result;  // blocks" : "var order = await GetOrderAsync(42);",
        "Show(order);",
        "",
      ];
      const X = ui ? "UI thread" : "Pool thread 1";
      const threads = ui ? [{ n: X, s: "run", st: ["OnClick"] }, { n: "Pool thread 1", s: "free", st: [] }, { n: "Pool thread 2", s: "free", st: [] }] : [{ n: X, s: "run", st: ["OrdersController.Get"] }, { n: "Pool thread 2", s: "free", st: [] }, { n: "Pool thread 3", s: "free", st: [] }];
      const sm = { state: -1, where: "stack", id: 42, row: "–", price: "–", ctx: "–" };
      const q = { ui: [], pool: [] }, io = [];
      let task = "not started";
      const fr = [];
      const snap = (line, note, extra = {}) => fr.push({ code, ui, threads: threads.map((t) => ({ ...t, st: [...t.st] })), sm: { ...sm }, q: { ui: [...q.ui], pool: [...q.pool] }, io: [...io], task, line, note, vars: { state: sm.state, "Task<Order>": task, captured: sm.ctx }, ...extra });
      const th = (name) => threads.find((t) => t.n === name);
      snap(9, `${ui ? "The user clicks a button. The handler runs on the <b>UI thread</b>, the only thread allowed to touch the window; it owns a SynchronizationContext that posts work back to it." : "A request runs on a <b>thread-pool thread</b>. ASP.NET Core has <b>no SynchronizationContext</b>, so continuations run on any pool thread."} The caller invokes GetOrderAsync(42).`);
      th(X).st.push("GetOrderAsync → MoveNext()"); task = "running";
      snap(2, `An async method <b>starts synchronously</b> on the caller's thread. The compiler rewrote it into a state machine (a struct holding <code>state</code>, <code>id</code>, <code>row</code>, <code>price</code>) and calls its MoveNext(). state = -1 means "not yet suspended".`);
      let cur = X; // thread currently running the method
      const awaitStep = (k, line, what, isSync) => {
        if (isSync) {
          if (k === 0) sm.row = "row#42"; else sm.price = "9.99";
          snap(line, `${what} returned an <b>already-completed</b> task (a cache hit). <code>awaiter.IsCompleted</code> is true, so await does not suspend: no continuation, no allocation, no thread hop. Execution simply continues. This hot path is why <code>ValueTask&lt;T&gt;</code> exists.`);
          return "sync";
        }
        sm.state = k;
        const captured = !noCtx && cur === "UI thread" ? "UI SynchronizationContext" : "none";
        sm.ctx = captured === "none" ? "none" : "UI context";
        const first = sm.where === "stack";
        sm.where = "heap (boxed)";
        io.push(k === 0 ? "DB query" : "pricing call");
        th(cur).st.pop(); task = "pending";
        if (!first) { th(cur).s = "free"; th(cur).st = []; }
        snap(line, `${what} started real I/O and returned an <b>incomplete</b> Task. MoveNext saves <code>state = ${k}</code>, ${first ? "moves the state machine to the heap (only on the first real suspension), " : ""}registers itself as the continuation${captured === "none" ? (noCtx && cur === "UI thread" ? " <b>without</b> capturing the UI context (ConfigureAwait(false))" : " (no context to capture on a pool thread)") : ", <b>capturing the UI SynchronizationContext</b> (plain await)"}, and <b>returns</b>. ${first ? "GetOrderAsync hands an incomplete Task&lt;Order&gt; back to the caller." : `${esc(cur)} is free again.`}`);
        return captured;
      };
      const callerReacts = () => {
        if (blockCaller) { th(X).s = "blocked"; th(X).st = [...th(X).st, "Task.Wait() (inside .Result)"]; snap(9, `<code>.Result</code> <b>blocks</b> ${esc(X)} until the task completes. ${ui ? "The window stops repainting: the UI thread cannot pump messages while it waits." : "This pool thread now does nothing but wait: under load this is how a thread pool starves."}`, { line: 9 }); }
        else { th(X).s = "free"; th(X).st = []; snap(9, `The caller <b>awaits</b> too: it registers its own continuation and returns. ${esc(X)} is free: ${ui ? "it goes back to the message loop, so the window stays responsive." : "it goes back to the pool to serve other requests."} While the database works, <b>no thread is waiting</b> for it.`); }
      };
      const resume = (k, captured, line) => {
        io.shift();
        if (captured !== "none") q.ui.push(`MoveNext (state ${k})`);
        snap(null, `The ${k === 0 ? "database" : "pricing service"} replies. The OS signals completion (an I/O completion port on Windows, epoll/kqueue elsewhere) and the runtime schedules the continuation ${captured === "none" ? "on the <b>thread pool</b>" : "through the captured <b>UI context</b>: it is <b>posted to the UI thread's message queue</b>"}.`, { line: null });
        if (captured !== "none") {
          if (th(X).s === "blocked") {
            snap(line, `<b>Deadlock.</b> The continuation can only run on the UI thread, but the UI thread is blocked in <code>.Result</code> waiting for this very method to finish. Each waits for the other forever: no exception, no CPU, a frozen app. ${nSync === 2 ? "" : "Fix it with async all the way (await in the handler) or, in library code, ConfigureAwait(false)."}`, { dead: true });
            return false;
          }
          q.ui.shift(); th(X).s = "run"; th(X).st = ["message loop", `MoveNext (state ${k})`]; cur = X;
          snap(line, `The UI thread is free, so it picks the continuation from its queue and calls MoveNext(). <code>state == ${k}</code>, so it jumps straight to just after the await and reads the result. You are back on the UI thread, which is what UI code needs.`);
        } else {
          const p = threads.find((t) => t.n !== X && t.s === "free") || threads[threads.length - 1];
          q.pool.push(`MoveNext (state ${k})`); snap(null, "The continuation waits in the thread-pool queue for any free worker.", { line: null });
          q.pool.shift(); p.s = "run"; p.st = [`MoveNext (state ${k})`]; cur = p.n;
          snap(line, `<b>${esc(p.n)}</b> picks it up and calls MoveNext(). <code>state == ${k}</code>, so it resumes right after the await. <b>A different thread</b> runs the second half of the method: thread-local state and locks taken before the await do not come along.`);
        }
        if (k === 0) sm.row = "row#42"; else sm.price = "9.99";
        sm.state = -1;
        return true;
      };
      const r1 = awaitStep(0, 3, "<code>_db.QueryAsync</code>", nSync >= 1);
      if (r1 !== "sync") { callerReacts(); if (!resume(0, r1, 3)) return finish(); }
      const r2 = awaitStep(1, 4, "<code>_pricing.GetAsync</code>", nSync === 2);
      if (r2 !== "sync") { if (r1 === "sync") callerReacts(); if (!resume(1, r2, 4)) return finish(); }
      // completion
      task = "completed"; sm.state = -2;
      snap(5, `<code>return</code> sets the result: <code>state = -2</code> and the Task&lt;Order&gt; completes on <b>${esc(cur)}</b>. Completing a task runs (or schedules) whatever is waiting on it.`);
      if (r1 === "sync" && r2 === "sync") th(X).st.pop();
      else { const ct = th(cur); ct.st = []; if (ct.n !== X || th(X).st.length === 0) ct.s = "free"; }
      if (r1 === "sync" && r2 === "sync") {
        th(X).s = "run"; th(X).st = [ui ? "OnClick" : "OrdersController.Get"];
        snap(10, `Everything completed synchronously, so the method returned a finished task and the caller just continues${blockCaller ? ". <code>.Result</code> did not block" : ""}. ${blockCaller && ui ? "<b>This is why sync-over-async deadlocks are intermittent:</b> they only bite when the awaited work is truly asynchronous. The first cache miss in production freezes the app." : "No thread hop, no allocation."}`);
      } else if (blockCaller) {
        th(X).s = "run"; th(X).st = [ui ? "OnClick" : "OrdersController.Get"];
        snap(10, `${esc(X)} wakes up from <code>.Result</code> and continues. It <b>worked</b>, but only because no continuation needed ${esc(X)}. ${ui ? "The UI was frozen for the whole I/O, and one library without ConfigureAwait(false) turns this into the deadlock." : "That thread sat blocked through every I/O wait. Multiply by a few hundred concurrent requests and the pool starves (next visualizer)."}`);
      } else {
        if (ui) { q.ui.push("caller continuation"); snap(null, "The caller's await captured the UI context (it is UI code and should), so its continuation is posted to the UI queue.", { line: null }); q.ui.shift(); }
        const ct = ui ? th(X) : threads.find((t) => t.s === "free" && t.n !== X) || th(X);
        threads.forEach((t) => { if (t !== ct && t.s === "run") { t.s = "free"; t.st = []; } });
        ct.s = "run"; ct.st = [ui ? "OnClick (resumed)" : "OrdersController.Get (resumed)"];
        snap(10, `The caller resumes on <b>${esc(ct.n)}</b> and shows the order. No thread was ever blocked: during both I/O waits every thread was free to do other work. <b>Async all the way</b> is the whole trick.`);
      }
      return finish();
      function finish() {
        const last = fr[fr.length - 1];
        const verdict = last.dead ? ["bad", "DEADLOCK"] : blockCaller && !(r1 === "sync" && r2 === "sync") ? ["warn", "works, but a thread was blocked"] : ["done", "OK"];
        fr.push({ ...last, verdict, line: null, note: last.note });
        return fr;
      }
    },
    render: (f, ctx) => {
      setCode(host, f.code, "csharp");
      const thr = f.threads.map((t) => `<div class="ca-thread ${t.s === "run" ? "active" : t.s === "blocked" ? "bad" : "dim"} ${f.dead && t.s === "blocked" ? "dead" : ""}"><div class="ca-box-h"><b>${esc(t.n)}</b><small>${t.s === "run" ? "running" : t.s === "blocked" ? "blocked" : "free"}</small></div><div class="ca-stack">${t.st.length ? [...t.st].reverse().map((s) => `<div>${esc(s)}</div>`).join("") : empty(t.n === "UI thread" ? "pumping messages" : "in the pool")}</div></div>`).join("");
      const sm = f.sm;
      const smBox = box("State machine", esc(sm.where), `<div class="ca-kv"><span>state</span><b>${sm.state}</b><span>id</span><b>${sm.id}</b><span>row</span><b>${esc(sm.row)}</b><span>price</span><b>${esc(sm.price)}</b><span>context</span><b>${esc(sm.ctx)}</b></div>`, sm.where !== "stack" ? "path" : "");
      const qs = `${f.ui ? box("UI message queue", "runs only on the UI thread", f.q.ui.length ? f.q.ui.map((x) => chip(x, f.dead ? "bad" : "visit")).join("") : empty()) : ""}${box("Thread-pool queue", "any free worker", f.q.pool.length ? f.q.pool.map((x) => chip(x, "visit")).join("") : empty())}${box("I/O in flight", "no thread waits here", f.io.length ? f.io.map((x) => chip(x, "path")).join("") : empty("none"))}`;
      const v = f.verdict ? `<div class="ca-verdict ${f.verdict[0]}">${esc(f.verdict[1])}</div>` : "";
      return `<div class="ca-threads">${thr}</div><div class="ca-row3">${smBox}${qs}</div>${v}`;
    },
  }));

  /* =====================================================================
   * 4. Thread-pool starvation from sync-over-async
   * ===================================================================== */
  const SMODES = ["async all the way", "sync over async (.Result)"];
  Viz.register("concurrency-async-starvation", (host) => Viz.player(host, {
    title: "Thread-pool starvation: blocking on async code under load",
    tag: "THREAD POOL · SIMULATION",
    legend: [["active", "running request code"], ["visit", "running a continuation"], ["bad", "blocked in .Result"], ["dim", "idle"]],
    speed: 600,
    codeLang: "csharp",
    code: [
      "// each request: 1 tick CPU, I/O, 1 tick CPU",
      "app.MapGet(\"/orders\", async () => {",
      "    var row = await db.QueryAsync();      // async: thread released",
      "    return Results.Ok(row);",
      "});",
      "app.MapGet(\"/orders-blocking\", () => {",
      "    var row = db.QueryAsync().Result;     // thread held while waiting",
      "    return Results.Ok(row);               // and QueryAsync's own",
      "});                                        // continuation needs a pool thread",
      "// the pool adds threads slowly when its queue stops draining",
    ],
    inputs: [
      { key: "mode", label: "code", type: "select", options: SMODES, value: SMODES[1] },
      { key: "rate", label: "requests / tick", value: "1", width: 60 },
      { key: "io", label: "I/O ticks", value: "3", width: 60 },
      { key: "min", label: "starting threads", value: "4", width: 60 },
      { key: "inj", label: "add a thread every k starved ticks", value: "2", width: 60 },
      { key: "T", label: "ticks", value: "30", width: 60 },
    ],
    random: () => ({ mode: pick(SMODES), rate: String(Viz.rand(1, 3)), io: String(Viz.rand(2, 6)), min: String(Viz.rand(2, 6)), inj: String(Viz.rand(1, 4)), T: String(Viz.rand(24, 36)) }),
    build: (inp) => {
      const sync = inp.mode === SMODES[1], R = int(inp.rate, "requests / tick", 1, 4), IO = int(inp.io, "I/O ticks", 1, 8), M = int(inp.min, "starting threads", 1, 12), K = int(inp.inj, "k", 1, 6), T = int(inp.T, "ticks", 10, 40);
      const MAX = 40;
      const threads = Array.from({ length: M }, () => ({ s: "idle", item: null, left: 0 }));
      const queue = [], ioq = [], reqs = [], lat = [], qHist = [], tHist = [], fr = [];
      let nextId = 1, starved = 0, injected = 0, done = 0;
      const snap = (t, note, line) => fr.push({ t, T, threads: threads.map((x) => ({ s: x.s, lab: x.item ? x.item.lab : "" })), queue: queue.map((x) => x.lab), io: ioq.length, qHist: [...qHist], tHist: [...tHist], line, note,
        vars: { tick: t, threads: threads.length, blocked: threads.filter((x) => x.s === "blocked").length, queued: queue.length, done, "avg latency": lat.length ? (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) : "–" } });
      snap(0, `${R} request${R > 1 ? "s" : ""} arrive every tick. Each needs 1 tick of CPU, ${IO} ticks of I/O and 1 more tick of CPU. The pool starts with <b>${M} threads</b> and adds one only after ${K} tick${K > 1 ? "s" : ""} in a row where its queue made no progress (the real .NET pool injects roughly one or two threads per second).`, sync ? [5, 6] : [1, 2]);
      for (let t = 1; t <= T; t++) {
        for (let i = 0; i < R; i++) { const r = { id: nextId++, at: t }; reqs.push(r); queue.push({ kind: "req", r, lab: `R${r.id}` }); }
        for (let i = ioq.length - 1; i >= 0; i--) if (--ioq[i].left <= 0) { const r = ioq[i].r; ioq.splice(i, 1); queue.push({ kind: "cont", r, lab: `C${r.id}` }); }
        for (const x of threads) if (x.s === "blocked" && x.item.r.inner) { x.s = "run"; x.item = { kind: "fin", r: x.item.r, lab: `R${x.item.r.id}` }; x.left = 1; }
        let took = 0;
        for (const x of threads) if (x.s === "idle" && queue.length) { x.item = queue.shift(); x.s = x.item.kind === "cont" ? "cont" : "run"; x.left = 1; took++; }
        for (const x of threads) {
          if (x.s !== "run" && x.s !== "cont") continue;
          if (--x.left > 0) continue;
          const it = x.item;
          if (it.kind === "req") { ioq.push({ r: it.r, left: IO + 1 }); if (sync) x.s = "blocked"; else { x.s = "idle"; x.item = null; } }
          else if (it.kind === "cont") { if (sync) it.r.inner = true; else { done++; lat.push(t - it.r.at + 1); } x.s = "idle"; x.item = null; }
          else { done++; lat.push(t - it.r.at + 1); x.s = "idle"; x.item = null; }
        }
        let note = "";
        if (queue.length && !threads.some((x) => x.s === "idle") && took === 0) starved++; else starved = 0;
        if (starved >= K && threads.length < MAX) { threads.push({ s: "idle", item: null, left: 0 }); injected++; starved = 0; note = " The pool detects starvation and <b>injects one thread</b>."; }
        qHist.push(queue.length); tHist.push(threads.length);
        const blocked = threads.filter((x) => x.s === "blocked").length, conts = queue.filter((x) => x.kind === "cont").length;
        let why;
        if (sync && blocked && conts) why = `${blocked} thread${blocked > 1 ? "s are" : " is"} blocked in .Result. The ${conts} continuation${conts > 1 ? "s" : ""} that would unblock them (C…) sit in the same FIFO queue <b>behind new requests</b>, and every new request that gets a thread blocks it too. The pool feeds the fire.`;
        else if (sync && blocked) why = `${blocked} of ${threads.length} threads are blocked doing nothing while their I/O runs.`;
        else if (queue.length) why = `${queue.length} item${queue.length > 1 ? "s" : ""} queued: every thread is busy this tick.`;
        else why = `All work fits: threads return to the pool during every I/O wait, so ${threads.length} threads serve ${R * (IO + 2)} requests in flight.`;
        snap(t, `t=${t}: ${why}${note}`, sync ? (blocked ? [6, 7, 8] : [5, 6]) : [2, 3]);
      }
      const sorted = [...lat].sort((a, b) => a - b), p = (q) => (sorted.length ? sorted[Math.min(sorted.length - 1, Math.floor(q * sorted.length))] : "–");
      fr.push({ ...fr[fr.length - 1], line: null, summary: { done, arrived: reqs.length, p50: p(0.5), p95: p(0.95), max: sorted.length ? sorted[sorted.length - 1] : "–", injected, threads: threads.length },
        note: sync ? `After ${T} ticks: ${done} of ${reqs.length} requests done, ${done ? `p95 ${p(0.95)} ticks` : "so there is no latency to report yet"} (best possible: ${IO + 2}), and the pool grew to ${threads.length} threads, most of them blocked. CPU is nearly idle while latency explodes: the signature of starvation. Switch to async with the same inputs.` : `After ${T} ticks: ${done} of ${reqs.length} requests done, p95 ${p(0.95)} ticks (best possible: ${IO + 2}) with only ${threads.length} threads. Threads are only held while there is CPU work to do.` });
      return fr;
    },
    render: (f) => {
      const CL = { run: "active", cont: "visit", blocked: "bad", idle: "dim" };
      const th = `<div class="ca-pool">${f.threads.map((x, i) => `<div class="ca-pt ${CL[x.s]}" title="thread ${i + 1}"><small>${i + 1}</small><b>${esc(x.lab || "")}</b></div>`).join("")}</div>`;
      const shown = f.queue.slice(0, 26);
      const q = `<div class="ca-q">${shown.map((x) => chip(x, x[0] === "C" ? "visit" : "")).join("") || empty()}${f.queue.length > shown.length ? `<span class="ca-mute">+${f.queue.length - shown.length} more</span>` : ""}</div>`;
      const s = f.summary;
      return `${Viz.labeled(`thread pool (${f.threads.length} threads)`, th)}${Viz.labeled(`pool queue, FIFO (R = new request, C = continuation)  ·  ${f.io} I/O in flight`, q)}<div class="v-row">${sparks(f.qHist, { label: "queue length per tick", len: f.T, cls: () => "bad" })}${sparks(f.tHist, { label: "threads per tick", len: f.T, max: 1 })}</div>${s ? stats([["requests done", `${s.done}/${s.arrived}`], ["p50 latency", s.p50], ["p95 latency", s.p95, s.p95 > 10 ? "bad" : "done"], ["max latency", s.max], ["threads injected", s.injected, s.injected ? "bad" : ""]]) : ""}`;
    },
  }));

  /* =====================================================================
   * 5. The JavaScript event loop: call stack, microtasks, macrotasks
   * ===================================================================== */
  // op: [kind, line, arg, body]. Kinds: log, timeout(ms), then, micro, busy(ms), call(fn), await
  const EL = {
    "sync, then, queueMicrotask, setTimeout": {
      src: [
        "console.log(\"A\");",
        "setTimeout(() => console.log(\"B\"), 0);",
        "Promise.resolve().then(() => console.log(\"C\"));",
        "queueMicrotask(() => console.log(\"D\"));",
        "console.log(\"E\");",
      ],
      main: [["log", 0, "A"], ["timeout", 1, 0, [["log", 1, "B"]]], ["then", 2, null, [["log", 2, "C"]]], ["micro", 3, null, [["log", 3, "D"]]], ["log", 4, "E"]],
    },
    "async function and await": {
      src: [
        "async function load() {",
        "  console.log(\"2 load starts\");",
        "  await null;",
        "  console.log(\"4 after await\");",
        "}",
        "console.log(\"1 script starts\");",
        "setTimeout(() => console.log(\"6 timeout\"), 0);",
        "load();",
        "Promise.resolve().then(() => console.log(\"5 then\"));",
        "console.log(\"3 script ends\");",
      ],
      fns: { load: [["log", 1, "2 load starts"], ["await", 2], ["log", 3, "4 after await"]] },
      main: [["log", 5, "1 script starts"], ["timeout", 6, 0, [["log", 6, "6 timeout"]]], ["call", 7, "load"], ["then", 8, null, [["log", 8, "5 then"]]], ["log", 9, "3 script ends"]],
    },
    "microtasks run between timers": {
      src: [
        "setTimeout(() => {",
        "  console.log(\"T1\");",
        "  Promise.resolve().then(() => console.log(\"T1 micro\"));",
        "}, 0);",
        "setTimeout(() => console.log(\"T2\"), 0);",
        "Promise.resolve().then(() => {",
        "  console.log(\"M1\");",
        "  setTimeout(() => console.log(\"T3 from M1\"), 0);",
        "});",
      ],
      main: [["timeout", 0, 0, [["log", 1, "T1"], ["then", 2, null, [["log", 2, "T1 micro"]]]]], ["timeout", 4, 0, [["log", 4, "T2"]]], ["then", 5, null, [["log", 6, "M1"], ["timeout", 7, 0, [["log", 7, "T3 from M1"]]]]]],
    },
    "a busy loop delays a timer": {
      src: [
        "setTimeout(() => console.log(\"timer (asked for 10 ms)\"), 10);",
        "const start = Date.now();",
        "while (Date.now() - start < 50) {}   // 50 ms of CPU",
        "console.log(\"busy loop done\");",
      ],
      main: [["timeout", 0, 10, [["log", 0, "timer (asked for 10 ms)"]]], ["busy", 2, 50], ["log", 3, "busy loop done"]],
    },
    "a microtask chain starves timers": {
      src: [
        "setTimeout(() => console.log(\"timer\"), 0);",
        "queueMicrotask(() => {",
        "  console.log(\"micro 1\");",
        "  queueMicrotask(() => {",
        "    console.log(\"micro 2\");",
        "    queueMicrotask(() => console.log(\"micro 3\"));",
        "  });",
        "});",
      ],
      main: [["timeout", 0, 0, [["log", 0, "timer"]]], ["micro", 1, null, [["log", 2, "micro 1"], ["micro", 3, null, [["log", 4, "micro 2"], ["micro", 5, null, [["log", 5, "micro 3"]]]]]]]],
    },
  };
  const EL_NAMES = Object.keys(EL);
  function simEventLoop(sc) {
    const fr = [], out = [], micro = [], macro = [], timers = [];
    let now = 0, seq = 0, stack = [];
    const snap = (line, note) => fr.push({ line, note, stack: [...stack], micro: micro.map((m) => m.lab), macro: macro.map((m) => m.lab), timers: timers.map((t) => `${t.lab} @${t.due}ms`), out: [...out], now,
      vars: { now: `${now} ms`, stack: stack.length, microtasks: micro.length, tasks: macro.length, timers: timers.length } });
    const runOps = (ops, frameLabel) => {
      for (let i = 0; i < ops.length; i++) {
        const [k, line, a, body] = ops[i];
        if (k === "log") { out.push(a); snap(line, `<code>console.log</code> runs synchronously: "${esc(a)}" is printed right now.`); }
        else if (k === "timeout") { const lab = `timer cb (line ${line + 1})`; timers.push({ due: now + a, seq: seq++, body, lab }); snap(line, `<code>setTimeout</code> hands the callback to the host's timer system (due at ${now + a} ms). It will become a <b>task</b> (macrotask) only after the timer fires, and only runs when the stack is empty and all microtasks are done.`); }
        else if (k === "then" || k === "micro") { const lab = `${k === "then" ? "then" : "microtask"} cb (line ${line + 1})`; micro.push({ body, lab }); snap(line, `${k === "then" ? "The promise is already resolved, so <code>.then</code>" : "<code>queueMicrotask</code>"} puts the callback straight onto the <b>microtask queue</b>. Microtasks run as soon as the current task finishes, before any timer or I/O callback.`); }
        else if (k === "busy") { now += a; snap(line, `A synchronous loop burns ${a} ms of CPU. Nothing else can run: not timers, not clicks, not network callbacks. The clock is now ${now} ms.`); }
        else if (k === "call") { stack.push(`${a}()`); snap(line, `Calling the async function <code>${a}()</code> runs its body <b>synchronously</b> up to the first await.`); const r = runOps(EL_FN[a], `${a}()`); if (r !== "awaited") stack.pop(); }
        else if (k === "await") {
          const rest = ops.slice(i + 1); micro.push({ body: rest, lab: `${frameLabel} after await`, resume: frameLabel });
          stack.pop();
          snap(line, `<code>await</code> suspends ${frameLabel}: the rest of the function becomes a <b>microtask</b> (the awaited value is already settled), and control returns to the caller. The stack unwinds; nothing blocks.`);
          return "awaited";
        }
      }
      return "done";
    };
    let EL_FN = sc.fns || {};
    macro.push({ lab: "run script", body: sc.main });
    snap(null, "The host queues one task: run the script. Watch the five areas: call stack, microtask queue, task (macrotask) queue, timers owned by the host, and the console.");
    let guard = 0;
    while ((macro.length || timers.length) && guard++ < 50) {
      if (!macro.length) {
        timers.sort((a, b) => a.due - b.due || a.seq - b.seq);
        const t = timers.shift(); now = Math.max(now, t.due); macro.push({ lab: t.lab, body: t.body });
        snap(null, `The stack and the microtask queue are empty, so the loop waits for the next timer. At ${now} ms it fires and its callback joins the <b>task queue</b>.`);
      }
      const task = macro.shift();
      stack = [task.lab];
      snap(null, `The event loop takes <b>one</b> task from the task queue: <i>${esc(task.lab)}</i>. It runs to completion; nothing can interrupt it.`);
      runOps(task.body, task.lab);
      stack = [];
      snap(null, `The task finished and the stack is empty. Now the loop <b>drains the microtask queue completely</b>${micro.length ? ` (${micro.length} waiting)` : " (it is empty)"} before it looks at any other task.`);
      while (micro.length && guard++ < 80) {
        const m = micro.shift();
        stack = [m.resume ? `${m.resume} (resumed)` : m.lab];
        snap(null, `Run microtask <i>${esc(m.lab)}</i>.${micro.length ? "" : " Microtasks queued while draining run in this same drain."}`);
        runOps(m.body, m.resume || m.lab);
        stack = [];
      }
      const due = timers.filter((t) => t.due <= now).sort((a, b) => a.due - b.due || a.seq - b.seq);
      for (const t of due) { timers.splice(timers.indexOf(t), 1); macro.push({ lab: t.lab, body: t.body }); }
      if (due.length) snap(null, `Microtasks done. ${due.length} timer${due.length > 1 ? "s are" : " is"} already due (now = ${now} ms), so ${due.length > 1 ? "their callbacks join" : "its callback joins"} the task queue. (The browser may also render a frame here.)`);
    }
    snap(null, `Final output: <b>${out.map(esc).join(" → ")}</b>. Rule: synchronous code first, then <i>all</i> microtasks, then one task, then all microtasks again, and so on.`);
    return { fr, out };
  }
  Viz.register("concurrency-async-eventloop", (host) => Viz.player(host, {
    title: "The JavaScript event loop: one stack, two queues",
    tag: "EVENT LOOP · STEP THROUGH",
    legend: [["active", "call stack"], ["path", "microtask queue"], ["visit", "task (macrotask) queue"], ["dim", "timers in the host"], ["done", "console output"]],
    speed: 1000,
    codeLang: "javascript",
    code: Array(10).fill(""),
    inputs: [{ key: "sc", label: "program", type: "select", options: EL_NAMES, value: EL_NAMES[1] }],
    random: () => ({ sc: pick(EL_NAMES) }),
    build: ({ sc }) => {
      const s = EL[sc];
      if (!s) throw new Error("Pick a program.");
      const { fr } = simEventLoop(s);
      return fr.map((f) => ({ ...f, src: s.src }));
    },
    render: (f) => {
      setCode(host, f.src, "javascript");
      const col = (title, sub, items, cls, rev) => box(title, sub, items.length ? (rev ? [...items].reverse() : items).map((x) => chip(x, cls)).join("") : empty(), `ca-el ${cls}`);
      return `<div class="ca-elgrid">${col("Call stack", "top first", f.stack, "active", true)}${col("Microtask queue", "promise callbacks, await resumptions", f.micro, "path")}${col("Task queue", "timers, I/O, events", f.macro, "visit")}${col("Timers (host)", `now = ${f.now} ms`, f.timers, "dim")}</div>${box("Console", "", f.out.length ? f.out.map((x, i) => `<div class="ca-out"><small>${i + 1}</small>${esc(x)}</div>`).join("") : empty("nothing printed yet"), "ca-console")}`;
    },
  }));

  /* =====================================================================
   * 6. Go's scheduler: G (goroutine), M (OS thread), P (processor)
   * ===================================================================== */
  function parseGs(s) {
    const parts = String(s).split(";").map((t) => t.trim()).filter(Boolean);
    if (parts.length < 1 || parts.length > 8) throw new Error("Use 1 to 8 goroutines separated by ';', for example: R3 N2 R1; R4; R1 S3 R2");
    let total = 0;
    return parts.map((t, i) => {
      const segs = t.split(/[\s,]+/).filter(Boolean).map((x) => {
        const m = /^([RNS])(\d+)$/i.exec(x);
        if (!m) throw new Error(`"${x}" is not a segment. R3 = run 3 ticks, N2 = wait 2 ticks on the network, S3 = a 3-tick blocking syscall.`);
        const n = Number(m[2]);
        if (n < 1 || n > 9) throw new Error(`"${x}": each segment is 1 to 9 ticks.`);
        total += n;
        return { k: m[1].toUpperCase(), n };
      });
      if (segs[0].k !== "R") throw new Error(`G${i + 1} must start with R (it has to run to start waiting).`);
      if (total > 64) throw new Error("Keep the total to 64 ticks or fewer.");
      return { name: `G${i + 1}`, segs };
    });
  }
  const GOS = ["R3 N3 R2; R4; R2 S4 R2; R5; R1 N2 R3; R3", "R2 S5 R2; R2 S5 R2; R4; R4", "R6; R6; R6; R6; R6; R6", "R1 N4 R1; R1 N4 R1; R1 N4 R1; R1 N4 R1; R2"];
  Viz.register("concurrency-async-gmp", (host) => Viz.player(host, {
    title: "Go's M:N scheduler: goroutines (G) on OS threads (M) through processors (P)",
    tag: "GO RUNTIME · STEP THROUGH",
    legend: [["active", "running on a P"], ["visit", "runnable, in a queue"], ["path", "parked on the network poller"], ["bad", "in a blocking syscall (holds an M)"], ["done", "finished"]],
    speed: 900,
    codeLang: "go",
    code: [
      "for _, job := range jobs {",
      "    go func() {               // a G: ~2 KB stack, not an OS thread",
      "        compute(job)          // R: runs on whichever P picks it",
      "        conn.Read(buf)        // N: G parks, M and P keep going",
      "        f.Read(buf)           // S: syscall blocks the M; P is handed off",
      "    }()",
      "}",
      "// schedule() on each P, in order:",
      "//   own run queue → global queue → netpoller →",
      "//   steal half of another P's run queue",
    ],
    inputs: [
      { key: "gs", label: "goroutines (R run, N network wait, S blocking syscall)", value: GOS[0], width: 360 },
      { key: "p", label: "GOMAXPROCS", value: "2", width: 60 },
      { key: "ts", label: "time slice (ticks)", value: "3", width: 60 },
    ],
    random: () => ({ gs: pick(GOS), p: String(Viz.rand(1, 4)), ts: String(Viz.rand(2, 4)) }),
    build: ({ gs, p, ts }) => {
      const G = parseGs(gs), NP = int(p, "GOMAXPROCS", 1, 4), TS = int(ts, "time slice", 1, 9);
      const st = G.map((g) => ({ seg: 0, left: g.segs[0].n, s: "q", hist: [] }));
      const P = Array.from({ length: NP }, (_, i) => ({ id: i, m: i === 0 ? 0 : null, cur: -1, slice: 0, runq: [] }));
      P[0].runq = G.map((_, i) => i);
      const global = [], net = [], sys = [], idleM = [];
      let nM = 1, t = 0, fr = [], steals = 0, preempts = 0;
      const nm = (i) => G[i].name;
      const snap = (line, note) => fr.push({ t, G: G.map((g) => g.name), P: P.map((x) => ({ m: x.m, cur: x.cur, left: x.cur >= 0 ? st[x.cur].left : 0, slice: x.slice, runq: [...x.runq] })), global: [...global], net: net.map((x) => ({ ...x })), sys: sys.map((x) => ({ ...x })), idleM: [...idleM], nM, hist: st.map((x) => [...x.hist]), line, note,
        vars: { tick: t, "Ms (threads)": nM, "Ps": NP, steals, preemptions: preempts, runnable: global.length + P.reduce((a, x) => a + x.runq.length, 0) } });
      const anyWork = () => global.length || P.some((x) => x.runq.length);
      snap([0, 1], `main starts ${G.length} goroutines. <code>go f()</code> just allocates a small G and puts it on the <b>current P's local run queue</b> (P0). There are ${NP} P${NP > 1 ? "s" : ""} (GOMAXPROCS): at most ${NP} goroutine${NP > 1 ? "s" : ""} run Go code at once. Only M0 exists so far; the runtime starts more OS threads only when needed.`);
      while (st.some((x) => x.s !== "done")) {
        if (t > 150) throw new Error("Too many ticks; use less work.");
        const notes = [];
        // 1. wake idle Ps if there is work
        for (const x of P) if (x.m === null && x.cur < 0 && anyWork()) { const fresh = !idleM.length; x.m = fresh ? nM++ : idleM.shift(); notes.push(`P${x.id} has work available, so it gets M${x.m}${fresh ? " (a new OS thread)" : " (a sleeping one)"}`); }
        // 2. each P with an M and no G finds one
        for (const x of P) {
          if (x.m === null || x.cur >= 0) continue;
          let g = -1;
          if (x.runq.length) g = x.runq.shift();
          else if (global.length) { g = global.shift(); notes.push(`P${x.id} takes ${nm(g)} from the global queue`); }
          else {
            const v = P.filter((y) => y !== x && y.runq.length).sort((a, b) => b.runq.length - a.runq.length)[0];
            if (v) { const k = Math.ceil(v.runq.length / 2), got = v.runq.splice(0, k); steals++; g = got.shift(); x.runq.push(...got); notes.push(`P${x.id} is out of work and <b>steals ${k}</b> from P${v.id}'s run queue`); }
          }
          if (g >= 0) { x.cur = g; x.slice = 0; st[g].s = "run"; }
          else { notes.push(`P${x.id} finds nothing: M${x.m} goes to sleep and P${x.id} becomes idle`); idleM.push(x.m); x.m = null; }
        }
        // 3. run one tick
        const ran = new Set();
        for (const x of P) {
          if (x.cur < 0) continue;
          const g = x.cur, s = st[g];
          ran.add(g); s.hist.push(`r${x.id}`); s.left--; x.slice++;
          if (s.left > 0) {
            if (x.slice >= TS && (x.runq.length || global.length)) { x.cur = -1; s.s = "q"; global.push(g); preempts++; notes.push(`${nm(g)} used its ${TS}-tick slice while others wait: sysmon <b>preempts</b> it onto the global queue`); }
            continue;
          }
          s.seg++;
          if (s.seg >= G[g].segs.length) { s.s = "done"; x.cur = -1; notes.push(`${nm(g)} returns`); continue; }
          const sg = G[g].segs[s.seg]; s.left = sg.n;
          if (sg.k === "R") continue;
          x.cur = -1;
          if (sg.k === "N") { s.s = "net"; net.push({ g, left: sg.n }); notes.push(`${nm(g)} reads from a socket that has no data: it <b>parks on the netpoller</b> (epoll/kqueue/IOCP). P${x.id} and M${x.m} immediately run something else`); }
          else {
            s.s = "sys"; sys.push({ g, m: x.m, left: sg.n });
            notes.push(`${nm(g)} enters a <b>blocking syscall</b>: M${x.m} is stuck in the kernel with it, so P${x.id} is detached from M${x.m}`);
            x.m = null;
            if (x.runq.length || global.length) { x.m = idleM.length ? idleM.shift() : nM++; notes.push(`P${x.id} has queued work, so it is handed off to M${x.m}`); }
          }
        }
        st.forEach((s, i) => { if (!ran.has(i) && s.s !== "run") s.hist.push(s.s); });
        // 4. netpoller and syscalls progress
        for (let i = net.length - 1; i >= 0; i--) if (--net[i].left <= 0) { const g = net[i].g; net.splice(i, 1); st[g].s = "q"; global.push(g); notes.push(`the netpoller sees ${nm(g)}'s socket is readable: ${nm(g)} becomes runnable (global queue)`); }
        for (let i = sys.length - 1; i >= 0; i--) if (--sys[i].left <= 0) {
          const { g, m } = sys[i]; sys.splice(i, 1);
          const free = P.find((x) => x.m === null && x.cur < 0);
          if (free) { free.m = m; free.cur = g; free.slice = 0; st[g].s = "run"; notes.push(`${nm(g)}'s syscall returns; M${m} grabs idle P${free.id} and continues running it`); }
          else { st[g].s = "q"; global.push(g); idleM.push(m); notes.push(`${nm(g)}'s syscall returns but every P is busy: ${nm(g)} goes to the global queue and M${m} sleeps`); }
        }
        t++;
        const line = notes.some((n) => n.includes("syscall")) ? [4] : notes.some((n) => n.includes("netpoller") || n.includes("socket")) ? [3] : notes.some((n) => n.includes("steal") || n.includes("global")) ? [7, 8, 9] : [2];
        snap(line, `t=${t}: ${notes.length ? notes.join("; ") + "." : "every P keeps running its goroutine."}`);
      }
      fr.push({ ...fr[fr.length - 1], line: null, summary: true, note: `All ${G.length} goroutines finished in <b>${t}</b> ticks on ${NP} P${NP > 1 ? "s" : ""}, using ${nM} OS thread${nM > 1 ? "s" : ""} in total. Network waits cost no thread at all; only blocking syscalls forced extra Ms. ${steals} steal${steals !== 1 ? "s" : ""} and ${preempts} preemption${preempts !== 1 ? "s" : ""} kept the Ps busy and fair.` });
      return fr;
    },
    render: (f) => {
      const ps = f.P.map((x, i) => {
        const cur = x.cur >= 0 ? `<div class="ca-task"><b>${esc(f.G[x.cur])}</b><small>${x.left} tick${x.left !== 1 ? "s" : ""} left in this segment · slice ${x.slice}</small></div>` : empty(x.m === null ? "idle P (no M)" : "looking for work");
        return `<div class="ca-worker ${x.cur >= 0 ? "active" : x.m === null ? "dim" : ""}"><div class="ca-box-h"><b>P${i}</b><small>${x.m === null ? "no M" : `on M${x.m}`}</small></div>${cur}<div class="ca-deque"><small>local run queue</small>${x.runq.length ? x.runq.map((g) => chip(f.G[g], "visit")).join("") : empty()}</div></div>`;
      }).join("");
      const side = `<div class="ca-row3">${box("Global run queue", "shared, locked", f.global.length ? f.global.map((g) => chip(f.G[g], "visit")).join("") : empty())}${box("Netpoller", "parked Gs, no thread", f.net.length ? f.net.map((x) => chip(`${f.G[x.g]} (${x.left})`, "path")).join("") : empty())}${box("Blocking syscalls", "each holds an M", f.sys.length ? f.sys.map((x) => chip(`M${x.m}: ${f.G[x.g]} (${x.left})`, "bad")).join("") : empty())}${box("OS threads", `${f.nM} M${f.nM > 1 ? "s" : ""} created`, f.idleM.length ? f.idleM.map((m) => chip(`M${m} sleeping`)).join("") : empty("none idle"))}</div>`;
      const T = Math.max(1, ...f.hist.map((h) => h.length));
      const CL = { q: "visit", net: "path", sys: "bad", done: "done" };
      const tl = `<div class="ca-fit"><div class="ca-tl ${T > 34 ? "compact" : ""}" style="--cols:${T}">${f.G.map((g, i) => `<div class="ca-tl-row"><span class="ca-tl-lbl">${esc(g)}</span>${Array.from({ length: T }, (_, t) => { const h = f.hist[i][t]; if (h === undefined) return `<span class="fut"></span>`; if (h[0] === "r") return `<span class="ca-c-cpu">${T > 34 ? "" : "P" + h.slice(1)}</span>`; return `<span class="ca-c-${CL[h] === "done" ? "fin" : CL[h] === "visit" ? "ready" : CL[h] === "path" ? "io" : "sys"}"></span>`; }).join("")}</div>`).join("")}</div></div>`;
      return `<div class="ca-workers" style="--w:${f.P.length}">${ps}</div>${side}${Viz.labeled("history (P number = where it ran)", tl)}`;
    },
  }));

  /* =====================================================================
   * 7. Race condition: the lost update, and three ways to fix it
   * ===================================================================== */
  const RMODES = ["count++ (no synchronization)", "lock (Monitor)", "CAS loop (CompareExchange)", "Interlocked.Increment"];
  const RCODE = [
    ["static int count = 0;", "void Worker() {", "    for (int i = 0; i < K; i++) {", "        int r = count;   // load    count++ is really", "        r = r + 1;       // add     these three steps", "        count = r;       // store", "    }", "}", "", ""],
    ["static int count = 0;", "static readonly object gate = new();", "void Worker() {", "    for (int i = 0; i < K; i++) {", "        lock (gate) {        // Monitor.Enter", "            int r = count;", "            r = r + 1;", "            count = r;", "        }                    // Monitor.Exit", "    }"],
    ["static int count = 0;", "void Worker() {", "    for (int i = 0; i < K; i++) {", "        int seen, next;", "        do {", "            seen = Volatile.Read(ref count);", "            next = seen + 1;", "        } while (Interlocked.CompareExchange(", "                     ref count, next, seen) != seen);", "    }"],
    ["static int count = 0;", "void Worker() {", "    for (int i = 0; i < K; i++) {", "        // one indivisible read-modify-write", "        Interlocked.Increment(ref count);", "    }", "}", "", "", ""],
  ];
  Viz.register("concurrency-async-race", (host) => Viz.player(host, {
    title: "Two threads, one counter: the lost update",
    tag: "RACE CONDITION · STEP THROUGH",
    legend: [["active", "thread A"], ["visit", "thread B"], ["bad", "lost update / failed CAS"], ["path", "waiting for the lock"], ["done", "correct result"]],
    speed: 900,
    codeLang: "csharp",
    code: RCODE[0],
    inputs: [
      { key: "mode", label: "increment with", type: "select", options: RMODES, value: RMODES[0] },
      { key: "k", label: "increments per thread", value: "2", width: 60 },
      { key: "sched", label: "scheduler (who runs each step, A or B)", value: "AABBBAAB", width: 220 },
    ],
    random: () => ({ mode: pick(RMODES), k: String(Viz.rand(1, 3)), sched: Array.from({ length: Viz.rand(6, 14) }, () => pick(["A", "B"])).join("") }),
    build: ({ mode, k, sched }) => {
      const mi = RMODES.indexOf(mode), K = int(k, "increments", 1, 4);
      const S = String(sched).toUpperCase().replace(/[\s,]/g, "");
      if (!/^[AB]{0,40}$/.test(S)) throw new Error("The schedule is a string of A and B (up to 40), for example AABBAB. After it runs out, the threads alternate.");
      const prog = [["load", "add", "store"], ["acquire", "load", "add", "store", "release"], ["load", "add", "cas"], ["inc"]][mi];
      const LINE = [{ load: 3, add: 4, store: 5 }, { acquire: 4, load: 5, add: 6, store: 7, release: 8 }, { load: 5, add: 6, cas: [7, 8] }, { inc: 4 }][mi];
      let count = 0, owner = null, lost = 0, casFail = 0;
      const th = { A: { pc: 0, i: 0, r: "–", done: false }, B: { pc: 0, i: 0, r: "–", done: false } };
      const log = [], fr = [];
      const snap = (line, note, who, cls) => fr.push({ mi, count, owner, th: JSON.parse(JSON.stringify(th)), log: [...log], line, note, who, cls, K,
        vars: { count, "A.r": th.A.r, "B.r": th.B.r, "A done": th.A.i, "B done": th.B.i, expected: 2 * K } });
      snap(null, `Two threads each add 1 to a shared <code>count</code> ${K} time${K > 1 ? "s" : ""}, so the answer must be <b>${2 * K}</b>. The scheduler string decides which thread runs each step; real CPUs interleave like this at any instruction.`, null);
      let si = 0, steps = 0, forced = null;
      while (!(th.A.done && th.B.done)) {
        if (steps++ > 200) throw new Error("Too many steps.");
        let w = forced || (si < S.length ? S[si] : (log.length && log[log.length - 1].w === "A" ? "B" : "A"));
        if (!forced) si++;
        forced = null;
        if (th[w].done) w = w === "A" ? "B" : "A";
        const o = w === "A" ? "B" : "A", me = th[w], op = prog[me.pc];
        let note = "", cls = w === "A" ? "active" : "visit";
        if (op === "acquire" && owner && owner !== w) {
          log.push({ w, t: "wait", cls: "path" });
          snap(LINE.acquire, `${w} tries <code>lock (gate)</code> but ${owner} holds it: ${w} <b>blocks</b> (it spins briefly, then sleeps). The scheduler has to run ${owner}.`, w, "path");
          forced = owner;
          continue;
        }
        if (op === "load") { me.r = count; me.seen = count; note = `${w} reads count = ${count} into its register.${th[o].pc > 0 && !["acquire"].includes(prog[th[o].pc]) && mi === 0 && th[o].r !== "–" ? ` ${o} has also read a value and not written it back yet: one of the two writes is about to be lost.` : ""}`; }
        else if (op === "add") { me.r = me.r + 1; note = `${w} adds 1 in its own register: r = ${me.r}. Memory still says ${count}.`; }
        else if (op === "store") { const before = count; count = me.r; if (count <= before || count - 1 !== before) { lost++; cls = "bad"; note = `${w} writes ${me.r}, but count was already ${before}: ${o}'s increment is <b>overwritten</b>. A lost update.`; } else note = `${w} writes ${me.r} back to memory.`; }
        else if (op === "acquire") { owner = w; note = `${w} takes the lock. Until it releases it, the other thread cannot enter the block.`; }
        else if (op === "release") { owner = null; note = `${w} releases the lock. The release also publishes ${w}'s write to other cores (a memory barrier).`; }
        else if (op === "cas") {
          if (count === me.seen) { count = me.r; note = `${w}: CompareExchange sees count is still ${me.seen}, so it atomically writes ${me.r}. Success.`; }
          else { casFail++; cls = "bad"; note = `${w}: CompareExchange expected ${me.seen} but count is ${count} (${o} got there first). Nothing is written; ${w} <b>retries</b> from the load. No update is lost.`; log.push({ w, t: `${op}✗`, cls }); me.pc = 0; me.r = "–"; snap(LINE.cas, note, w, cls); continue; }
        }
        else if (op === "inc") { count++; me.r = count; note = `${w}: Interlocked.Increment reads, adds and writes as <b>one</b> indivisible CPU instruction (lock xadd on x86). There is no gap for ${o} to slip into.`; }
        log.push({ w, t: op, cls });
        me.pc++;
        if (me.pc >= prog.length) { me.pc = 0; me.i++; if (me.i >= K) { me.done = true; note += ` ${w} is finished.`; } if (mi !== 2) me.r = mi === 3 ? me.r : "–"; }
        snap(LINE[op], note, w, cls);
      }
      const ok = count === 2 * K;
      fr.push({ ...fr[fr.length - 1], line: null, final: { ok, lost, casFail }, note: ok ? `count = <b>${count}</b>, correct. ${mi === 0 ? "This schedule happened to be lucky: try AABB…-style interleavings like ABAB. A test that passes 1000 times can still hide this bug." : mi === 1 ? "The lock made load-add-store one unit, at the cost of blocking." : mi === 2 ? `${casFail} failed CAS attempt${casFail !== 1 ? "s" : ""} were retried: lock-free, but contended CAS loops burn CPU.` : "One atomic instruction: the cheapest correct option for a single counter."}` : `count = <b>${count}</b>, expected ${2 * K}. <b>${2 * K - count} update${2 * K - count > 1 ? "s were" : " was"} lost.</b> No exception, no crash: just a wrong number, sometimes.` });
      return fr;
    },
    render: (f) => {
      setCode(host, RCODE[f.mi], "csharp");
      const tcard = (w) => { const x = f.th[w]; return `<div class="ca-thread ${f.who === w ? (f.cls === "path" ? "path" : w === "A" ? "active" : "visit") : "dim"}"><div class="ca-box-h"><b>Thread ${w}</b><small>${x.done ? "finished" : `${x.i} of ${f.K} done`}</small></div><div class="ca-kv"><span>register r</span><b>${esc(x.r)}</b>${f.mi === 2 ? `<span>seen</span><b>${esc(x.seen ?? "–")}</b>` : ""}</div></div>`; };
      const mem = `<div class="ca-mem ${f.cls === "bad" && f.mi === 0 ? "bad" : ""}"><small>shared memory</small><b>count = ${f.count}</b>${f.mi === 1 ? `<small>lock: ${f.owner ? "held by " + f.owner : "free"}</small>` : ""}</div>`;
      const log = `<div class="ca-log">${f.log.map((x) => `<span class="ca-chip ${x.cls}">${x.w}: ${esc(x.t)}</span>`).join("") || empty("no steps yet")}</div>`;
      const fin = f.final ? `<div class="ca-verdict ${f.final.ok ? "done" : "bad"}">${f.final.ok ? `${f.count} = ${2 * f.K}  correct` : `${f.count} ≠ ${2 * f.K}  lost update`}</div>` : "";
      return `<div class="ca-race">${tcard("A")}${mem}${tcard("B")}</div>${Viz.labeled("interleaving so far", log)}${fin}`;
    },
  }));

  /* =====================================================================
   * 8. Deadlock: lock ordering, the wait-for graph, and livelock
   * ===================================================================== */
  const DSTRATS = ["naive: left lock, then right lock", "global order: lower-numbered lock first", "tryLock + random back-off"];
  Viz.register("concurrency-async-deadlock", (host) => Viz.player(host, {
    title: "Deadlock: threads that each hold one lock and wait for the next",
    tag: "DEADLOCK · WAIT-FOR GRAPH",
    legend: [["active", "thread running"], ["visit", "lock held (arrow: lock → owner)"], ["path", "waiting (arrow: thread → lock)"], ["bad", "cycle = deadlock"], ["done", "finished"]],
    speed: 900,
    codeLang: "csharp",
    code: [
      "void Work(Lock first, Lock second) {",
      "    lock (first) {",
      "        lock (second) {",
      "            DoWork();             // e.g. move money a → b",
      "        }",
      "    }",
      "}",
      "// T1: Work(L1, L2)   T2: Work(L2, L3) ...  Tn: Work(Ln, L1)",
      "// fix 1: always lock the lower id first (global order)",
      "// fix 2: TryEnter with timeout, release, back off, retry",
    ],
    inputs: [
      { key: "n", label: "threads (= locks)", value: "3", width: 60 },
      { key: "strat", label: "strategy", type: "select", options: DSTRATS, value: DSTRATS[0] },
      { key: "sched", label: "scheduler (thread numbers in run order)", value: "1 2 3", width: 200 },
    ],
    random: () => { const n = Viz.rand(2, 5); return { n: String(n), strat: pick(DSTRATS), sched: Array.from({ length: n }, (_, i) => i + 1).join(" ") }; },
    build: ({ n, strat, sched }) => {
      const N = int(n, "threads", 2, 5), si = DSTRATS.indexOf(strat);
      const S = String(sched).split(/[\s,]+/).filter(Boolean).map((x) => int(x, "scheduler entry", 1, N) - 1);
      if (S.length > 40) throw new Error("Up to 40 scheduler entries.");
      const rnd = mulberry(7 + N * 31 + S.length);
      const T = Array.from({ length: N }, (_, i) => {
        let a = i, b = (i + 1) % N;
        if (si === 1 && a > b) [a, b] = [b, a];
        return { first: a, second: b, pc: 0, hold: [], wait: null, backoff: 0, done: false, tries: 0 };
      });
      const owner = new Array(N).fill(-1), fr = [];
      const LN = (i) => `L${i + 1}`, TN = (i) => `T${i + 1}`;
      const cycle = () => {
        // follow thread -> lock -> owner
        for (let s = 0; s < N; s++) {
          const seen = [], ids = new Set(); let t = s;
          while (t >= 0 && T[t].wait !== null && !ids.has(t)) { ids.add(t); seen.push(t); t = owner[T[t].wait]; }
          if (t >= 0 && ids.has(t)) return seen.slice(seen.indexOf(t));
        }
        return null;
      };
      const snap = (line, note, act, cyc) => fr.push({ N, owner: [...owner], T: T.map((x) => ({ hold: [...x.hold], wait: x.wait, done: x.done, backoff: x.backoff })), act, cyc, line, note,
        vars: { held: owner.filter((o) => o >= 0).length, waiting: T.filter((x) => x.wait !== null).length, finished: T.filter((x) => x.done).length } });
      snap(null, `${N} threads, ${N} locks. Thread T<i>i</i> needs L<i>i</i> and L<i>i+1</i> (the last one wraps around to L1): ${N === 2 ? "like a transfer a→b running at the same time as b→a" : "the dining philosophers"}. ${si === 0 ? "Each takes its left lock, then its right." : si === 1 ? `Every thread takes the <b>lower-numbered</b> lock first, so ${TN(N - 1)} takes L1 before ${LN(N - 1)}.` : "Each takes its first lock, then only <b>tries</b> the second; on failure it releases everything and backs off."}`, -1, null);
      let k = 0, steps = 0, livelock = 0;
      while (T.some((x) => !x.done)) {
        if (++steps > 90) { fr.push({ ...fr[fr.length - 1], line: [9], final: "livelock", note: `90 steps and ${T.filter((x) => !x.done).length} thread${T.filter((x) => !x.done).length > 1 ? "s are" : " is"} still not done: the threads keep grabbing, failing and backing off in step. That is a <b>livelock</b>: everyone is busy, nobody progresses. Randomised, growing back-off makes it unlikely but not impossible. A global lock order removes it entirely.` }); return fr; }
        const cand = k < S.length ? S[k] : null; k++;
        const ready = T.map((x, i) => i).filter((i) => !T[i].done && (T[i].wait === null || owner[T[i].wait] < 0));
        if (!ready.length) {
          const cyc = cycle();
          fr.push({ ...fr[fr.length - 1], cyc, final: "deadlock", line: [1, 2], note: `<b>Deadlock.</b> Every unfinished thread is waiting for a lock held by another waiting thread: ${cyc ? cyc.map((t) => `${TN(t)} waits for ${LN(T[t].wait)} (held by ${TN(owner[T[t].wait])})`).join(", ") : ""}. The wait-for graph has a <b>cycle</b>. Nobody will ever release anything: no exception, zero CPU, a hung process. Try the global-order strategy with the same scheduler.` });
          return fr;
        }
        const i = cand !== null && ready.includes(cand) ? cand : cand !== null && !T[cand].done ? (() => { return -2; })() : ready[(k - 1) % ready.length];
        if (i === -2) {
          const t = T[cand];
          snap([2], `The scheduler picks ${TN(cand)}, but it is blocked waiting for ${LN(t.wait)} (held by ${TN(owner[t.wait])}). It cannot run.`, cand, cycle());
          continue;
        }
        const x = T[i];
        if (x.backoff > 0) { x.backoff--; snap([9], `${TN(i)} is backing off (${x.backoff} more step${x.backoff !== 1 ? "s" : ""}).`, i, null); continue; }
        if (x.pc === 0) {
          if (owner[x.first] >= 0) { x.wait = x.first; snap([1], `${TN(i)} wants ${LN(x.first)} but ${TN(owner[x.first])} holds it: ${TN(i)} waits.`, i, cycle()); continue; }
          owner[x.first] = i; x.hold.push(x.first); x.wait = null; x.pc = 1;
          snap([1], `${TN(i)} takes ${LN(x.first)}.`, i, null);
        } else if (x.pc === 1) {
          if (owner[x.second] >= 0 && owner[x.second] !== i) {
            if (si === 2) {
              owner[x.first] = -1; x.hold = []; x.pc = 0; x.tries++; x.backoff = 1 + Math.floor(rnd() * 3); livelock++;
              snap([9], `${TN(i)} <b>tries</b> ${LN(x.second)}, fails (held by ${TN(owner[x.second])}), so it releases ${LN(x.first)} and backs off for ${x.backoff} step${x.backoff > 1 ? "s" : ""}. No cycle can form, because nobody waits while holding a lock.`, i, null);
              continue;
            }
            x.wait = x.second;
            const cyc = cycle();
            snap([2], `${TN(i)} holds ${LN(x.first)} and now wants ${LN(x.second)}, which ${TN(owner[x.second])} holds. ${TN(i)} <b>waits while holding</b> ${LN(x.first)}.${cyc ? " That closes a cycle in the wait-for graph." : ""}`, i, cyc);
            continue;
          }
          owner[x.second] = i; x.hold.push(x.second); x.wait = null; x.pc = 2;
          snap([2, 3], `${TN(i)} takes ${LN(x.second)}: it holds both locks and does its work.`, i, null);
        } else {
          for (const l of x.hold) owner[l] = -1;
          x.hold = []; x.done = true;
          snap([4, 5], `${TN(i)} releases both locks and finishes.`, i, null);
        }
      }
      fr.push({ ...fr[fr.length - 1], final: "ok", line: null, note: `All threads finished.${si === 1 ? " With one global lock order a cycle is impossible: the thread holding the highest lock it needs never waits for a lower one." : si === 2 ? ` It took ${livelock} failed attempt${livelock !== 1 ? "s" : ""} and back-offs.` : " This schedule was lucky. Run 1, 2, 3, … so each thread grabs its first lock before anyone grabs a second."}` });
      return fr;
    },
    render: (f) => {
      const N = f.N, R = N === 2 ? 70 : 105;
      const ids = []; for (let i = 0; i < N; i++) { ids.push(`T${i}`); ids.push(`L${(i + 1) % N}`); }
      const pos = Viz.layout.circle(ids, R);
      const inCyc = new Set(f.cyc || []);
      const nodes = pos.map((p) => {
        const isT = p.id[0] === "T", k = Number(p.id.slice(1));
        let cls = "";
        if (isT) { const t = f.T[k]; cls = t.done ? "done" : inCyc.has(k) ? "bad" : t.wait !== null ? "path" : f.act === k ? "active" : ""; }
        else cls = f.owner[k] >= 0 ? (f.cyc && inCyc.has(f.owner[k]) ? "bad" : "visit") : "";
        return { ...p, label: isT ? `T${k + 1}` : `L${k + 1}`, cls, sub: isT ? undefined : f.owner[k] >= 0 ? `held by T${f.owner[k] + 1}` : "free" };
      });
      const edges = [];
      f.owner.forEach((o, l) => { if (o >= 0) edges.push({ u: `L${l}`, v: `T${o}`, cls: f.cyc && inCyc.has(o) ? "bad" : "visit" }); });
      f.T.forEach((t, i) => { if (t.wait !== null) edges.push({ u: `T${i}`, v: `L${t.wait}`, cls: inCyc.has(i) ? "bad" : "path" }); });
      const g = Viz.graph({ nodes, edges }, { directed: true, r: 21, label: "wait-for graph: lock → owner, thread → wanted lock" });
      const v = f.final ? `<div class="ca-verdict ${f.final === "ok" ? "done" : "bad"}">${f.final === "ok" ? "all threads finished" : f.final === "deadlock" ? "DEADLOCK: cycle in the wait-for graph" : "LIVELOCK: busy, no progress"}</div>` : "";
      return `<div class="ca-center">${g}</div>${v}`;
    },
  }));

  /* =====================================================================
   * 9. Bounded channel: backpressure and full-mode policies
   * ===================================================================== */
  const POL = ["Wait", "DropOldest", "DropNewest", "DropWrite", "Unbounded"];
  const chCode = (pol, cap) => [
    pol === "Unbounded" ? "var ch = Channel.CreateUnbounded<Job>();" : `var ch = Channel.CreateBounded<Job>(new BoundedChannelOptions(${cap})`,
    pol === "Unbounded" ? "// no capacity: memory is the only limit" : `    { FullMode = BoundedChannelFullMode.${pol} });`,
    "// producers",
    "while (TryGetNextJob(out var job))",
    pol === "Wait" ? "    await ch.Writer.WriteAsync(job, ct);   // waits while full" : `    await ch.Writer.WriteAsync(job, ct);   // ${pol === "Unbounded" ? "never waits" : "never waits; may drop"}`,
    "ch.Writer.Complete();",
    "// consumers",
    "await foreach (var job in ch.Reader.ReadAllAsync(ct))",
    "    await HandleAsync(job);",
    "",
  ];
  Viz.register("concurrency-async-channel", (host) => Viz.player(host, {
    title: "Producer / consumer through a bounded channel: backpressure or drops",
    tag: "CHANNELS · SIMULATION",
    legend: [["active", "working"], ["bad", "blocked (backpressure) or dropped"], ["visit", "item in the channel"], ["dim", "idle"], ["done", "handled"]],
    speed: 650,
    codeLang: "csharp",
    code: chCode("Wait", 4),
    inputs: [
      { key: "pol", label: "when full", type: "select", options: POL, value: POL[0] },
      { key: "cap", label: "capacity", value: "4", width: 60 },
      { key: "np", label: "producers", value: "2", width: 60 },
      { key: "every", label: "each produces every k ticks", value: "1", width: 60 },
      { key: "nc", label: "consumers", value: "1", width: 60 },
      { key: "work", label: "ticks per item", value: "2", width: 60 },
      { key: "stop", label: "producers stop after tick", value: "16", width: 60 },
      { key: "T", label: "ticks", value: "28", width: 60 },
    ],
    random: () => ({ pol: pick(POL), cap: String(Viz.rand(2, 6)), np: String(Viz.rand(1, 3)), every: String(Viz.rand(1, 3)), nc: String(Viz.rand(1, 3)), work: String(Viz.rand(1, 4)), stop: String(Viz.rand(8, 20)), T: String(Viz.rand(24, 34)) }),
    build: (inp) => {
      const pol = inp.pol, CAP = int(inp.cap, "capacity", 1, 8), NP = int(inp.np, "producers", 1, 3), EV = int(inp.every, "k", 1, 5), NC = int(inp.nc, "consumers", 1, 3), WK = int(inp.work, "ticks per item", 1, 6), STOP = int(inp.stop, "stop", 0, 40), T = int(inp.T, "ticks", 8, 40);
      if (!POL.includes(pol)) throw new Error("Pick a policy.");
      const q = [], prods = Array.from({ length: NP }, (_, i) => ({ name: "abc"[i], n: 0, blocked: null, s: "idle" })), cons = Array.from({ length: NC }, () => ({ item: null, left: 0 }));
      const dropped = [], waits = [], hist = [], fr = [];
      let produced = 0, handled = 0, blockedTicks = 0, maxQ = 0;
      const code = chCode(pol, CAP);
      const snap = (t, line, note) => fr.push({ code, t, T, CAP, pol, q: q.map((x) => x.lab), prods: prods.map((p) => ({ name: p.name, s: p.s, blocked: p.blocked ? p.blocked.lab : null })), cons: cons.map((c) => ({ item: c.item ? c.item.lab : null, left: c.left })), dropped: dropped.slice(-12), nDropped: dropped.length, hist: [...hist], line, note,
        vars: { tick: t, queued: q.length, produced, handled, dropped: dropped.length, "blocked ticks": blockedTicks } });
      snap(0, [0, 1], `${NP} producer${NP > 1 ? "s" : ""} each make an item every ${EV} tick${EV > 1 ? "s" : ""} (${(NP / EV).toFixed(2)} items/tick); ${NC} consumer${NC > 1 ? "s" : ""} each need ${WK} tick${WK > 1 ? "s" : ""} per item (${(NC / WK).toFixed(2)} items/tick). ${NP / EV > NC / WK ? "<b>Producers are faster than consumers</b>, so the channel will fill up and the full-mode policy decides what happens." : "Consumers keep up, so the channel mostly stays short."}`);
      for (let t = 1; t <= T; t++) {
        const ev = [];
        cons.forEach((c, i) => {
          if (c.item && --c.left <= 0) { handled++; c.item = null; }
          if (!c.item && q.length) { c.item = q.shift(); c.left = WK; waits.push(t - c.item.t); }
        });
        prods.forEach((p) => {
          let item = p.blocked;
          if (!item) {
            if (t > STOP || (t - 1) % EV !== 0) { p.s = t > STOP ? "done" : "idle"; return; }
            item = { lab: `${p.name}${++p.n}`, t };
          }
          if (pol === "Unbounded" || q.length < CAP) { q.push(item); produced++; if (p.blocked) ev.push(`${p.name} is unblocked and writes ${item.lab}`); p.blocked = null; p.s = "write"; return; }
          if (pol === "Wait") { if (!p.blocked) ev.push(`the channel is full, so ${p.name}'s WriteAsync for ${item.lab} <b>waits</b> (backpressure)`); p.blocked = item; p.s = "blocked"; blockedTicks++; return; }
          produced++; p.s = "write";
          if (pol === "DropWrite") { dropped.push(item.lab); ev.push(`full: <b>${item.lab} is dropped</b> (DropWrite discards the item being written)`); }
          else if (pol === "DropOldest") { const d = q.shift(); dropped.push(d.lab); q.push(item); ev.push(`full: the oldest item <b>${d.lab} is dropped</b> to make room for ${item.lab}`); }
          else { const d = q.pop(); dropped.push(d.lab); q.push(item); ev.push(`full: the newest queued item <b>${d.lab} is dropped</b> to make room for ${item.lab}`); }
        });
        maxQ = Math.max(maxQ, q.length); hist.push(q.length);
        snap(t, pol === "Wait" && prods.some((p) => p.s === "blocked") ? [4] : ev.length ? [3, 4] : [7, 8], `t=${t}: ${ev.length ? ev.join("; ") + "." : `${q.length} item${q.length !== 1 ? "s" : ""} queued.`}${pol === "Unbounded" && q.length > 8 ? " The queue just keeps growing: in production that is memory growth and ever-rising latency until the process dies." : ""}`);
      }
      const avg = waits.length ? (waits.reduce((a, b) => a + b, 0) / waits.length).toFixed(1) : "–";
      fr.push({ ...fr[fr.length - 1], line: null, summary: { produced, handled, dropped: dropped.length, maxQ, avg, blockedTicks, queued: q.length },
        note: `${produced} written, ${handled} handled, ${dropped.length} dropped, ${q.length} still queued, max depth ${maxQ}, average wait in the channel ${avg} ticks. ${pol === "Wait" ? "Nothing was lost: the producers were slowed down to the consumers' pace. That is <b>backpressure</b>." : pol === "Unbounded" ? "Nothing was dropped and nobody waited, but the queue (memory and latency) grew without limit." : "Producers never waited, and the channel stayed bounded, but data was dropped. Fine for telemetry or 'latest value wins', wrong for orders."}` });
      return fr;
    },
    render: (f) => {
      setCode(host, f.code, "csharp");
      const prods = f.prods.map((p) => `<div class="ca-pt ${p.s === "blocked" ? "bad" : p.s === "write" ? "active" : "dim"}"><small>producer</small><b>${esc(p.name)}</b><small>${p.s === "blocked" ? `blocked: ${esc(p.blocked)}` : p.s === "write" ? "wrote" : p.s === "done" ? "stopped" : "idle"}</small></div>`).join("");
      const slots = f.pol === "Unbounded" ? `<div class="ca-slots unb">${f.q.map((x) => `<span class="ca-slot full">${esc(x)}</span>`).join("") || empty()}</div>` : `<div class="ca-slots">${Array.from({ length: f.CAP }, (_, i) => `<span class="ca-slot ${f.q[i] ? "full" : ""}">${f.q[i] ? esc(f.q[i]) : ""}</span>`).join("")}</div>`;
      const cons = f.cons.map((c, i) => `<div class="ca-pt ${c.item ? "active" : "dim"}"><small>consumer ${i + 1}</small><b>${esc(c.item || "")}</b><small>${c.item ? `${c.left} left` : "idle"}</small></div>`).join("");
      const dropped = f.nDropped ? `<div class="ca-q">${f.dropped.map((x) => chip(x, "bad")).join("")}${f.nDropped > f.dropped.length ? `<span class="ca-mute">(${f.nDropped} total)</span>` : ""}</div>` : empty("nothing dropped");
      const s = f.summary;
      return `<div class="ca-pipe"><div class="ca-col">${prods}</div><span class="ca-arrow">→</span><div>${Viz.labeled(f.pol === "Unbounded" ? "channel (unbounded)" : `channel, capacity ${f.CAP}`, slots)}</div><span class="ca-arrow">→</span><div class="ca-col">${cons}</div></div><div class="v-row">${Viz.labeled("dropped", dropped)}${sparks(f.hist, { label: "queue length per tick", len: f.T, max: f.CAP, cls: (v) => (f.pol !== "Unbounded" && v >= f.CAP ? "bad" : "") })}</div>${s ? stats([["handled", s.handled, "done"], ["dropped", s.dropped, s.dropped ? "bad" : ""], ["max depth", s.maxQ], ["avg wait", s.avg], ["producer blocked ticks", s.blockedTicks]]) : ""}`;
    },
  }));

  /* =====================================================================
   * 10. Fan-out / fan-in with a concurrency limit and cancellation
   * ===================================================================== */
  const FMODES = ["Task.WhenAll, no cancellation", "fail fast: cancel the rest (ForEachAsync / errgroup)"];
  const FCODE = [
    ["var gate = new SemaphoreSlim(limit);", "var tasks = jobs.Select(async job => {", "    await gate.WaitAsync();", "    try { return await CallAsync(job); }   // no token", "    finally { gate.Release(); }", "});", "var results = await Task.WhenAll(tasks);", "// a failure surfaces only after ALL tasks finish", "// a timeout in the caller does not stop the work", ""],
    ["using var cts = CancellationTokenSource.CreateLinkedTokenSource(ct);", "cts.CancelAfter(deadline);", "await Parallel.ForEachAsync(jobs, new ParallelOptions {", "        MaxDegreeOfParallelism = limit,", "        CancellationToken = cts.Token },", "    async (job, token) => {", "        await CallAsync(job, token);       // token flows down", "    });", "// first exception cancels the token for the others", "// Go: errgroup.WithContext + g.SetLimit(limit)"],
  ];
  Viz.register("concurrency-async-fanout", (host) => Viz.player(host, {
    title: "Fan-out / fan-in: concurrency limits, a slow dependency, and cancellation",
    tag: "FAN-OUT · SIMULATION",
    legend: [["visit", "queued (waiting for a slot)"], ["active", "running"], ["path", "running, slowed by the dependency"], ["bad", "failed / cancelled"], ["done", "succeeded"]],
    speed: 600,
    codeLang: "csharp",
    code: FCODE[0],
    inputs: [
      { key: "d", label: "job durations (ticks)", value: "4 6 3 8 5 2 7 4", width: 220 },
      { key: "k", label: "concurrency limit", value: "3", width: 60 },
      { key: "fail", label: "job that fails (0 = none)", value: "4", width: 60 },
      { key: "cap", label: "dependency handles at once", value: "8", width: 60 },
      { key: "dl", label: "deadline tick (0 = none)", value: "0", width: 60 },
      { key: "mode", label: "mode", type: "select", options: FMODES, value: FMODES[0] },
    ],
    random: () => ({ d: Viz.randInts(Viz.rand(4, 9), 2, 9).join(" "), k: String(Viz.rand(2, 6)), fail: String(Viz.rand(0, 4)), cap: String(Viz.rand(2, 8)), dl: pick(["0", "0", "12", "16"]), mode: pick(FMODES) }),
    build: ({ d, k, fail, cap, dl, mode }) => {
      const D = String(d).split(/[\s,]+/).filter(Boolean).map((x) => int(x, "duration", 1, 12));
      if (D.length < 2 || D.length > 12) throw new Error("Use 2 to 12 job durations.");
      const K = int(k, "limit", 1, 12), F = int(fail, "failing job", 0, D.length), CAP = int(cap, "dependency capacity", 1, 12), DL = int(dl, "deadline", 0, 60), mi = FMODES.indexOf(mode), cancel = mi === 1;
      const J = D.map((dur, i) => ({ dur, prog: 0, s: "q", hist: [], start: -1 }));
      const fr = [];
      let t = 0, decided = null, outcome = null, wasted = 0, peak = 0, total = 0;
      const snap = (line, note) => fr.push({ mi, D, K, t, J: J.map((x) => ({ s: x.s, prog: x.prog, hist: [...x.hist] })), line, note, outcome, decided,
        vars: { tick: t, running: J.filter((x) => x.s === "run").length, done: J.filter((x) => x.s === "done").length, "work after outcome known": wasted.toFixed(1) } });
      snap(cancel ? [2, 3] : [0, 1], `${D.length} calls, at most <b>${K}</b> at a time. The downstream service handles ${CAP} concurrent calls at full speed; beyond that everyone slows down proportionally.${F ? ` Job ${F} will fail halfway through.` : ""}${DL ? ` The caller's deadline is tick ${DL}.` : ""}`);
      while (J.some((x) => x.s === "q" || x.s === "run")) {
        if (t > 120) throw new Error("Too many ticks.");
        const ev = [];
        for (const x of J) if (x.s === "q" && J.filter((y) => y.s === "run").length < K) { x.s = "run"; x.start = t; }
        const running = J.filter((x) => x.s === "run"), rate = Math.min(1, CAP / Math.max(1, running.length));
        peak = Math.max(peak, running.length);
        J.forEach((x, i) => {
          if (x.s === "q") { x.hist.push("q"); return; }
          if (x.s !== "run") { x.hist.push(x.s === "done" ? "" : x.s === "fail" ? "" : ""); return; }
          x.prog += rate; total += rate; if (decided !== null && decided <= t) wasted += rate;
          x.hist.push(rate < 1 ? "slow" : "run");
          if (F === i + 1 && x.prog >= x.dur / 2) { x.s = "fail"; x.hist[x.hist.length - 1] = "fail"; ev.push(`job ${i + 1} throws`); if (decided === null) { decided = t + 1; outcome = "failed"; } }
          else if (x.prog >= x.dur - 1e-9) { x.s = "done"; ev.push(`job ${i + 1} completes`); }
        });
        t++;
        if (DL && t >= DL && decided === null && J.some((x) => x.s === "q" || x.s === "run")) { decided = t; outcome = "timed out"; ev.push(`the deadline (tick ${DL}) passes`); }
        if (cancel && decided !== null && J.some((x) => x.s === "q" || x.s === "run")) {
          const c = J.filter((x) => x.s === "q" || x.s === "run").length;
          J.forEach((x) => { if (x.s === "q" || x.s === "run") { x.s = "cancel"; x.hist[x.hist.length - 1] = x.hist[x.hist.length - 1] === "q" ? "cq" : "cancel"; } });
          ev.push(`the token is cancelled: ${c} running or queued job${c > 1 ? "s" : ""} stop now`);
        }
        const note = `t=${t}: ${running.length} running${rate < 1 ? ` but the dependency is overloaded, so each runs at ${Math.round(rate * 100)}% speed` : ""}. ${ev.join("; ")}${ev.length ? "." : ""}${decided !== null && !cancel && J.some((x) => x.s === "q" || x.s === "run") ? ` The outcome (${outcome}) is already decided, but nothing tells the other calls: they keep using the dependency.` : ""}`;
        snap(cancel ? (decided !== null ? [8] : [5, 6]) : decided !== null ? [7, 8] : [2, 3], note);
      }
      if (!outcome) outcome = J.some((x) => x.s === "fail") ? "failed" : "succeeded";
      const ok = outcome === "succeeded";
      fr.push({ ...fr[fr.length - 1], line: null, outcome, summary: { t, peak, wasted: wasted.toFixed(1), total: total.toFixed(1), seen: !cancel && decided ? t : decided || t },
        note: `${ok ? "All calls succeeded" : `The fan-out <b>${outcome}</b>`}. The caller ${outcome === "failed" && !cancel ? `could have known at tick ${decided} but ` : ""}got its answer at tick <b>${!ok && !cancel ? (outcome === "timed out" ? decided : t) : t}</b>; the work finished at tick ${t}. ${wasted > 0 ? `<b>${wasted.toFixed(1)}</b> ticks of work happened after the outcome was known: load on a dependency for results nobody will use.` : "No work was wasted."} Peak concurrency was ${peak}${peak > CAP ? `, above the dependency's ${CAP}: lowering the limit to ${CAP} would make each call faster` : ""}.` });
      return fr;
    },
    render: (f) => {
      setCode(host, FCODE[f.mi], "csharp");
      const T = Math.max(1, ...f.J.map((x) => x.hist.length));
      const CL = { q: "ready", run: "cpu", slow: "slow", fail: "bad", cancel: "cancel", cq: "cancel", "": "fin" };
      const lastState = (x, t) => (t >= x.hist.length ? null : x.hist[t] === "" ? (x.s === "done" ? "fin" : "gone") : CL[x.hist[t]]);
      const rows = f.J.map((x, i) => `<div class="ca-tl-row"><span class="ca-tl-lbl">job ${i + 1} <small>${f.D[i]}t</small></span>${Array.from({ length: T }, (_, t) => { const c = lastState(x, t); return c ? `<span class="ca-c-${c}">${c === "bad" ? "✗" : c === "cancel" ? "–" : ""}</span>` : `<span class="fut"></span>`; }).join("")}<span class="ca-tl-end ${x.s}">${{ done: "ok", fail: "failed", cancel: "cancelled", run: Math.round((x.prog / f.D[i]) * 100) + "%", q: "queued" }[x.s]}</span></div>`).join("");
      const tl = `<div class="ca-fit"><div class="ca-tl ${T > 34 ? "compact" : ""}" style="--cols:${T}">${rows}</div></div>`;
      const s = f.summary;
      return `${tl}${s ? stats([["outcome", f.outcome, f.outcome === "succeeded" ? "done" : "bad"], ["all work ended", `t=${s.t}`], ["peak concurrency", s.peak], ["work after outcome known", s.wasted, Number(s.wasted) > 0 ? "bad" : "done"]]) : ""}`;
    },
  }));
})();
