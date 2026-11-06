/* Stacks & Queues visualizers. Every frame is produced by running the real algorithm on your input,
 * so the stack / queue you see is exactly what the code holds at that line. */
(() => {
  const esc = Viz.esc;
  const show = (c) => (c === " " ? "␣" : c);
  /* Input as a tape of cells with a cursor above the current one. */
  const tape = (items, cur, cls, label, ptr = "i") =>
    Viz.array(items.map(show), { ptrsTop: cur >= 0 && cur < items.length ? { [ptr]: cur } : {}, cls, label });
  const badge = (text, cls = "") => `<div class="sq-badge ${cls}">${esc(text)}</div>`;
  const chips = (label, items, cls = () => "") =>
    Viz.labeled(label, `<div class="sq-chips">${items.length ? items.map((v, i) => `<span class="v-item ${cls(i, v)}">${esc(v)}</span>`).join("") : '<span class="sq-empty">none yet</span>'}</div>`);
  const col = (...parts) => `<div class="sq-col">${parts.filter(Boolean).join("")}</div>`;
  /* "push 3, pop, getMin" -> [{op, arg}] with validation. spec = {opName: needsArg} */
  const parseOps = (s, spec, max = 16) => {
    const out = String(s).split(/[,;\n]+/).map((t) => t.trim()).filter(Boolean).map((t) => {
      const [op, arg, extra] = t.split(/\s+/);
      const key = Object.keys(spec).find((k) => k.toLowerCase() === String(op).toLowerCase());
      if (!key || extra !== undefined) throw new Error(`Use operations like: ${Object.keys(spec).map((k) => (spec[k] ? `${k} 5` : k)).join(", ")}.`);
      if (spec[key]) {
        const v = Number(arg);
        if (!Number.isInteger(v) || Math.abs(v) > 999) throw new Error(`Use a whole number from -999 to 999 after ${key}.`);
        return { op: key, arg: v };
      }
      if (arg !== undefined) throw new Error(`Use ${key} without a value.`);
      return { op: key };
    });
    if (!out.length || out.length > max) throw new Error(`Use between 1 and ${max} operations.`);
    return out;
  };
  const opStr = (o) => (o.arg === undefined ? `${o.op}()` : `${o.op}(${o.arg})`);

  /* 1 ─ LIFO vs FIFO: the same pushes, opposite pop order. */
  Viz.register("stacks-queues-lifo-fifo", (el) => Viz.player(el, {
    title: "Same pushes, opposite order out: a stack returns the newest, a queue the oldest",
    tag: "LIFO VS FIFO",
    legend: [["active", "just added"], ["bad", "leaving now"], ["done", "already out"]],
    codeLang: "python",
    code: ["stack, queue = [], deque()", "for x in items:", "    stack.append(x)      # on top", "    queue.append(x)      # at the back", "while stack:", "    a = stack.pop()      # newest", "    b = queue.popleft()  # oldest"],
    inputs: [{ key: "items", label: "items (1–8, letters or numbers)", value: "A,B,C,D,E" }],
    random: () => ({ items: Array.from({ length: Viz.rand(3, 7) }, (_, i) => String.fromCharCode(65 + i)).join(",") }),
    build: (inp) => {
      const items = String(inp.items).split(/[\s,]+/).filter(Boolean);
      if (items.length < 1 || items.length > 8 || items.some((x) => x.length > 3)) throw new Error("Use 1–8 short items separated by commas.");
      const fr = [], st = [], q = [], outS = [], outQ = [];
      const S = (x) => fr.push({ st: [...st], q: [...q], outS: [...outS], outQ: [...outQ], ...x });
      S({ line: 0, note: "Both start empty. We push the same items in the same order into both." });
      for (const x of items) {
        st.push(x); q.push(x);
        S({ line: [1, 2, 3], newS: st.length - 1, newQ: q.length - 1, vars: { x }, note: `Add <b>${esc(x)}</b>. The stack puts it on <b>top</b>; the queue puts it at the <b>back</b>.` });
      }
      while (st.length) {
        S({ line: [4, 5, 6], leaveS: st.length - 1, leaveQ: 0, note: `The stack gives up its top (<b>${esc(st[st.length - 1])}</b>, the newest). The queue gives up its front (<b>${esc(q[0])}</b>, the oldest).` });
        outS.push(st.pop()); outQ.push(q.shift());
      }
      S({ line: 4, note: `Stack order out: <b>${esc(outS.join(" "))}</b> (reversed). Queue order out: <b>${esc(outQ.join(" "))}</b> (unchanged). Reach for a stack when the <b>most recent</b> unfinished thing matters, and a queue when <b>first come, first served</b> matters.` });
      return fr;
    },
    render: (f) => Viz.row(
      Viz.stack(f.st, { label: "stack", cls: (i) => (i === f.newS ? "active" : i === f.leaveS ? "bad" : "") }),
      Viz.queue(f.q, { label: "queue", cls: (i) => (i === f.newQ ? "active" : i === f.leaveQ ? "bad" : "") }),
      col(chips("stack popped (LIFO)", f.outS, () => "done"), chips("queue popped (FIFO)", f.outQ, () => "done")),
    ),
  }));

  /* 2 ─ Brackets: valid / minimum remove / longest valid. data-opts {"mode": "valid" | "minRemove" | "longest"} */
  const PAIR = { ")": "(", "]": "[", "}": "{" };
  Viz.register("stacks-queues-brackets", (el, opts) => {
    const mode = opts.mode || "valid";
    const C = {
      valid: {
        title: "Valid parentheses: the stack holds every bracket still waiting for its partner",
        tag: "O(n) · O(n)", label: "brackets ()[]{} (1–24)", value: "{[()()]}(",
        legend: [["active", "current"], ["visit", "open, waiting on the stack"], ["done", "matched pair"], ["bad", "error"]],
        code: ["pairs = {')': '(', ']': '[', '}': '{'}", "stack = []", "for ch in s:", "    if ch in '([{':", "        stack.append(ch)          # still unmatched", "    elif not stack or stack.pop() != pairs[ch]:", "        return False              # nothing to close / wrong type", "return not stack                  # leftovers never closed"],
        re: /^[()[\]{}]+$/,
      },
      minRemove: {
        title: "Minimum removals to make parentheses valid: stack of indices of unmatched '('",
        tag: "LC 1249 · O(n)", label: "string: letters and ( ) (1–24)", value: "a)b(c)d)(e(f",
        legend: [["active", "current"], ["visit", "'(' waiting"], ["done", "matched"], ["bad", "will be removed"]],
        code: ["stack, remove = [], set()", "for i, ch in enumerate(s):", "    if ch == '(':", "        stack.append(i)", "    elif ch == ')':", "        if stack: stack.pop()        # matched", "        else: remove.add(i)          # nothing to match", "remove |= set(stack)                 # '(' never closed", "return ''.join(c for i, c in enumerate(s) if i not in remove)"],
        re: /^[a-z()]+$/,
      },
      longest: {
        title: "Longest valid parentheses: the stack bottom marks where the current valid run can start",
        tag: "HARD · LC 32", label: "parentheses ( ) (1–24)", value: ")()())(()())",
        legend: [["active", "current"], ["done", "current valid run"], ["path", "best run so far"]],
        code: ["stack = [-1]                 # index just before the current run", "best = 0", "for i, ch in enumerate(s):", "    if ch == '(':", "        stack.append(i)", "    else:", "        stack.pop()", "        if not stack:", "            stack.append(i)      # unmatched ')': new base", "        else:", "            best = max(best, i - stack[-1])", "return best"],
        re: /^[()]+$/,
      },
    }[mode];
    const randStr = () => {
      if (mode === "minRemove") return Array.from({ length: Viz.rand(6, 16) }, () => "ab()()c("[Viz.rand(0, 7)]).join("");
      if (mode === "longest") return Array.from({ length: Viz.rand(6, 16) }, () => "()"[Viz.rand(0, 1)]).join("");
      const out = [], st = [], n = Viz.rand(4, 14);
      for (let k = 0; k < n; k++) {
        if (st.length && Math.random() < 0.45) out.push({ "(": ")", "[": "]", "{": "}" }[st.pop()]);
        else { const c = "([{"[Viz.rand(0, 2)]; st.push(c); out.push(c); }
      }
      while (st.length && Math.random() < 0.8) out.push({ "(": ")", "[": "]", "{": "}" }[st.pop()]);
      if (Math.random() < 0.3) { const k = Viz.rand(0, out.length - 1); out[k] = ")]}([{"[Viz.rand(0, 5)]; }
      return out.join("");
    };
    return Viz.player(el, {
      title: C.title, tag: C.tag, legend: C.legend, codeLang: "python", code: C.code,
      inputs: [{ key: "s", label: C.label, value: C.value, width: 220 }],
      random: () => ({ s: randStr() }),
      build: (inp) => {
        const s = String(inp.s).replace(/\s+/g, "");
        if (!s.length || s.length > 24 || !C.re.test(s)) throw new Error(`Use 1–24 characters from: ${mode === "valid" ? "( ) [ ] { }" : mode === "minRemove" ? "lowercase letters, ( )" : "( )"}.`);
        const n = s.length, status = Array(n).fill(""), st = [], fr = [];
        const S = (x) => fr.push({ s, status: [...status], st: st.map((e) => ({ ...e })), i: -1, ...x });
        if (mode === "valid") {
          S({ line: [0, 1], note: "Scan left to right. An open bracket can't be checked yet, so it waits on the stack. A closing bracket must match the <b>most recent</b> unmatched open one, which is always the top." });
          for (let i = 0; i < n; i++) {
            const ch = s[i];
            if ("([{".includes(ch)) {
              status[i] = "visit"; st.push({ ch, i });
              S({ i, line: [2, 3, 4], vars: { ch, depth: st.length }, note: `'${ch}' opens. Push it: it is now the most recent unmatched bracket.` });
              continue;
            }
            if (!st.length) {
              status[i] = "bad";
              S({ i, line: [2, 5, 6], verdict: false, vars: { ch, depth: 0 }, note: `'${ch}' closes, but the stack is empty: nothing is waiting to be closed. <b>Invalid.</b>` });
              return fr;
            }
            const top = st.pop();
            if (top.ch !== PAIR[ch]) {
              status[i] = "bad"; status[top.i] = "bad";
              S({ i, line: [2, 5, 6], verdict: false, vars: { ch, popped: top.ch }, note: `'${ch}' would have to close the most recent open bracket, but that is '${top.ch}' (index ${top.i}). Wrong type, so the nesting is crossed, as in "([)]". <b>Invalid.</b>` });
              return fr;
            }
            status[i] = status[top.i] = "done";
            S({ i, line: [2, 5], vars: { ch, popped: top.ch }, note: `'${ch}' matches the top '${top.ch}' (index ${top.i}). Pop it: that pair is finished and the next older bracket becomes the top.` });
          }
          if (st.length) { st.forEach((e) => { status[e.i] = "bad"; }); S({ line: 7, verdict: false, note: `End of the string, but ${st.length} bracket(s) were never closed: ${st.map((e) => `'${e.ch}' at ${e.i}`).join(", ")}. <b>Invalid.</b>` }); }
          else S({ line: 7, verdict: true, note: "The stack is empty at the end: every bracket was closed, and in the right order. <b>Valid.</b>" });
          return fr;
        }
        if (mode === "minRemove") {
          const remove = new Set();
          S({ line: 0, note: "Letters are ignored. A '(' waits on the stack (we store its <b>index</b> so we can delete it later). A ')' either matches the most recent '(' or has nothing to match and must go." });
          for (let i = 0; i < n; i++) {
            const ch = s[i];
            if (ch === "(") { status[i] = "visit"; st.push({ ch, i }); S({ i, line: [1, 2, 3], vars: { i }, note: `'(' at ${i}: push its index.` }); }
            else if (ch === ")") {
              if (st.length) { const t = st.pop(); status[i] = status[t.i] = "done"; S({ i, line: [1, 4, 5], vars: { i }, note: `')' at ${i} matches '(' at ${t.i}. Pop.` }); }
              else { status[i] = "bad"; remove.add(i); S({ i, line: [1, 4, 6], vars: { i, removed: remove.size }, note: `')' at ${i} has no '(' waiting. It can never be matched, so remove it.` }); }
            } else S({ i, line: 1, vars: { i }, note: `'${ch}' is a letter: keep it, nothing to do.` });
          }
          st.forEach((e) => { status[e.i] = "bad"; remove.add(e.i); });
          const res = [...s].filter((_, k) => !remove.has(k)).join("");
          S({ line: 7, vars: { removed: remove.size }, note: st.length ? `The indices still on the stack (${st.map((e) => e.i).join(", ")}) are '(' that were never closed. Remove them too.` : "No '(' is left on the stack." });
          st.length = 0;
          S({ line: 8, result: res, vars: { removed: remove.size }, note: `Removed ${remove.size} character(s): the minimum, since each removed one is provably unmatchable. Result: <b>"${esc(res)}"</b>.` });
          return fr;
        }
        /* longest */
        let best = 0, bestR = null;
        st.push({ ch: "base", i: -1 });
        S({ line: [0, 1], vars: { best }, note: "The stack holds indices. Its <b>bottom</b> is always the index just before the current valid run: -1 at the start, later the last unmatched ')'." });
        for (let i = 0; i < n; i++) {
          if (s[i] === "(") { st.push({ ch: "(", i }); S({ i, line: [2, 3, 4], best: bestR, vars: { i, best }, note: `'(' at ${i}: push its index. It might be matched later.` }); continue; }
          const p = st.pop();
          if (!st.length) {
            st.push({ ch: "base", i });
            S({ i, line: [5, 6, 7, 8], best: bestR, vars: { i, best }, note: `')' at ${i}: we popped ${p.i === -1 ? "the base -1" : `base ${p.i}`}, so there was no '(' to match. No valid run can cross this ')': it becomes the new base.` });
          } else {
            const lo = st[st.length - 1].i + 1, len = i - st[st.length - 1].i;
            if (len > best) { best = len; bestR = [lo, i]; }
            S({ i, line: [5, 6, 9, 10], run: [lo, i], best: bestR, vars: { i, "stack[-1]": st[st.length - 1].i, len, best }, note: `')' at ${i} matched '(' at ${p.i}. The top is now ${st[st.length - 1].i}, so s[${lo}..${i}] is valid: length ${i} − ${st[st.length - 1].i} = <b>${len}</b>.${len === best && bestR[0] === lo ? " New best." : ""}` });
          }
        }
        S({ line: 11, best: bestR, vars: { best }, note: best ? `Longest valid run: s[${bestR[0]}..${bestR[1]}] = "${s.slice(bestR[0], bestR[1] + 1)}", length <b>${best}</b>.` : "No valid run at all: the answer is 0." });
        return fr;
      },
      render: (f) => {
        const chars = [...f.s];
        let cls;
        if (mode === "longest") cls = (k) => (k === f.i ? "active" : f.run && k >= f.run[0] && k <= f.run[1] ? "done" : f.best && k >= f.best[0] && k <= f.best[1] ? "path" : "");
        else cls = (k) => (f.status[k] === "bad" ? "bad" : k === f.i ? "active" : f.status[k]);
        const stItems = f.st.map((e) => (mode === "longest" ? (e.ch === "base" ? `${e.i} base` : `${e.i}`) : mode === "minRemove" ? `( @${e.i}` : `${e.ch} @${e.i}`));
        const stack = Viz.stack(stItems, { label: mode === "valid" ? "stack" : "stack (indices)", cls: (k) => (mode === "longest" && f.st[k].ch === "base" ? "path" : k === f.st.length - 1 ? "active" : "visit") });
        const parts = [tape(chars, f.i, cls, "s")];
        if (f.result !== undefined) parts.push(Viz.labeled("result", `<div class="sq-chips"><span class="v-item done">"${esc(f.result)}"</span></div>`));
        if (f.verdict !== undefined) parts.push(badge(f.verdict ? "valid" : "invalid", f.verdict ? "done" : "bad"));
        return Viz.row(col(...parts), stack);
      },
    });
  });

  /* ---------- expression helpers ---------- */
  const tokenize = (s, ops) => {
    const out = [];
    for (let k = 0; k < s.length;) {
      const c = s[k];
      if (c === " ") { k++; continue; }
      if (/\d/.test(c)) { let j = k; while (j < s.length && /\d/.test(s[j])) j++; out.push(s.slice(k, j)); k = j; continue; }
      if (!ops.includes(c)) throw new Error(`Use digits, spaces and ${[...ops].join(" ")} only.`);
      out.push(c); k++;
    }
    return out;
  };
  const isNum = (t) => /^-?\d+$/.test(t);
  const applyOp = (t, a, b) => {
    if (t === "+") return a + b;
    if (t === "-") return a - b;
    if (t === "*") return a * b;
    if (t === "^") return Math.pow(a, b);
    if (b === 0) throw new Error("Use a non-zero divisor: this input divides by zero.");
    return Math.trunc(a / b);
  };
  const fmtNum = (v) => (!Number.isFinite(v) || Math.abs(v) > 1e15 ? "too large" : Number.isInteger(v) ? String(v) : String(Number(v.toFixed(4))));

  /* 3 ─ Evaluate Reverse Polish Notation. */
  Viz.register("stacks-queues-rpn", (el) => Viz.player(el, {
    title: "Evaluate RPN: numbers wait on the stack, an operator consumes the top two",
    tag: "LC 150 · O(n)",
    legend: [["active", "current token / new result"], ["bad", "operands being consumed"]],
    codeLang: "python",
    code: ["stack = []", "for t in tokens:", "    if t in {'+', '-', '*', '/'}:", "        b = stack.pop()          # right operand is on top", "        a = stack.pop()", "        stack.append(apply(t, a, b))  # '/' truncates toward 0", "    else:", "        stack.append(int(t))", "return stack.pop()"],
    inputs: [{ key: "t", label: "tokens (space-separated, 1–15)", value: "10 6 9 3 + -11 * / * 17 + 5 +", width: 300 }],
    random: () => {
      const gen = (d) => {
        if (d === 0 || Math.random() < 0.3) { const v = Viz.rand(1, 12); return { p: [String(v)], v }; }
        const L = gen(d - 1), R = gen(d - 1);
        let op = "+-*/"[Viz.rand(0, 3)];
        if (op === "/" && R.v === 0) op = "+";
        return { p: [...L.p, ...R.p, op], v: applyOp(op, L.v, R.v) };
      };
      return { t: gen(3).p.join(" ") };
    },
    build: (inp) => {
      const toks = String(inp.t).trim().split(/\s+/).filter(Boolean);
      if (!toks.length || toks.length > 15) throw new Error("Use 1–15 tokens separated by spaces.");
      if (toks.some((t) => !isNum(t) && !"+-*/".includes(t))) throw new Error("Use integers and + - * / separated by spaces.");
      const st = [], fr = [];
      const S = (x) => fr.push({ toks, st: st.map((e) => ({ ...e })), i: -1, ...x });
      S({ line: 0, note: "In postfix, an operator comes <b>after</b> its operands, so when you meet it both operands are already computed and sitting on top of the stack. No parentheses or precedence needed." });
      toks.forEach((t, i) => {
        if (isNum(t)) { st.push({ v: Number(t), ex: t }); S({ i, line: [1, 6, 7], top: st.length - 1, note: `${t} is a number: push it.` }); return; }
        if (st.length < 2) throw new Error(`Need two numbers on the stack before '${t}' (token ${i + 1}).`);
        S({ i, line: [1, 2, 3, 4], used: [st.length - 2, st.length - 1], note: `'${t}' needs two operands. Pop b = ${st[st.length - 1].v} (top) first, then a = ${st[st.length - 2].v}. Order matters for - and /: it is a ${t} b.` });
        const b = st.pop(), a = st.pop(), v = applyOp(t, a.v, b.v);
        st.push({ v, ex: `(${a.ex} ${t} ${b.ex})` });
        S({ i, line: 5, top: st.length - 1, vars: { a: a.v, b: b.v, result: v }, note: `${a.v} ${t} ${b.v} = <b>${v}</b>${t === "/" && a.v % b.v !== 0 ? " (truncated toward zero)" : ""}. Push the result: it stands for the whole sub-expression ${esc(a.ex)} ${t} ${esc(b.ex)}.` });
      });
      if (st.length !== 1) throw new Error(`Expected exactly one value left at the end, but ${st.length} remain: too few operators.`);
      S({ line: 8, top: 0, vars: { result: st[0].v }, note: `One value is left: the answer, <b>${st[0].v}</b>. Every token was pushed once and popped at most once, so the whole evaluation is O(n).` });
      return fr;
    },
    render: (f) => Viz.row(
      tape(f.toks, f.i, (k) => (k === f.i ? "active" : k < f.i ? "done" : ""), "tokens", "t"),
      Viz.stack(f.st.map((e) => (e.ex === String(e.v) ? String(e.v) : `${e.v}  ≡ ${e.ex}`)), { label: "stack", cls: (k) => (f.used && f.used.includes(k) ? "bad" : k === f.top ? "active" : "") }),
    ),
  }));

  /* 4 ─ Shunting-yard: infix -> postfix with an operator stack. */
  const PREC = { "+": 1, "-": 1, "*": 2, "/": 2, "^": 3 };
  Viz.register("stacks-queues-shunting", (el) => Viz.player(el, {
    title: "Shunting-yard: numbers go straight out, operators wait until nothing stronger is pending",
    tag: "INFIX → POSTFIX",
    legend: [["active", "current token"], ["bad", "popped to output"], ["visit", "waiting operators"], ["done", "output"]],
    codeLang: "python",
    code: ["prec = {'+': 1, '-': 1, '*': 2, '/': 2, '^': 3}", "out, ops = [], []", "for t in tokens:", "    if t.isdigit(): out.append(t)", "    elif t == '(': ops.append(t)", "    elif t == ')':", "        while ops[-1] != '(': out.append(ops.pop())", "        ops.pop()                    # discard '('", "    else:", "        while (ops and ops[-1] != '(' and", "               (prec[ops[-1]] > prec[t] or", "                prec[ops[-1]] == prec[t] and t != '^')):", "            out.append(ops.pop())    # stronger, or equal and left-assoc", "        ops.append(t)", "while ops: out.append(ops.pop())"],
    inputs: [{ key: "e", label: "infix expression (+ - * / ^ and parentheses)", value: "3 + 4 * 2 / ( 1 - 5 ) ^ 2 ^ 3", width: 300 }],
    random: () => {
      const gen = (d) => (d === 0 || Math.random() < 0.3 ? String(Viz.rand(1, 9)) : Math.random() < 0.25 ? `( ${gen(d - 1)} )` : `${gen(d - 1)} ${"+-*/^"[Viz.rand(0, 4)]} ${gen(d - 1)}`);
      let e; do { e = gen(3); } while (e.split(" ").length > 17 || e.split(" ").length < 5);
      return { e };
    },
    build: (inp) => {
      const toks = tokenize(String(inp.e), "+-*/^()");
      if (!toks.length || toks.length > 21) throw new Error("Use 1–21 tokens.");
      let want = true, depth = 0;
      for (const t of toks) {
        if (want) { if (isNum(t)) want = false; else if (t === "(") depth++; else throw new Error("Use binary operators only: an operand or '(' must come here (no unary minus; write 0 - x)."); }
        else if (t === ")") { if (--depth < 0) throw new Error("Use balanced parentheses."); }
        else if (t in PREC) want = true;
        else throw new Error("Use an operator between two operands.");
      }
      if (want || depth) throw new Error("Use a complete expression with balanced parentheses.");
      const out = [], ops = [], fr = [];
      const S = (x) => fr.push({ toks, out: [...out], ops: [...ops], i: -1, ...x });
      S({ line: [0, 1], note: "Numbers keep their order in postfix, so they go straight to the output. An operator must wait: something stronger may follow (in 3 + 4 * 2 the * must run first). The stack holds the operators still waiting." });
      toks.forEach((t, i) => {
        if (isNum(t)) { out.push(t); S({ i, line: [2, 3], newOut: true, note: `${t}: a number goes straight to the output.` }); return; }
        if (t === "(") { ops.push(t); S({ i, line: [2, 4], note: "'(' starts a fresh level: push it as a wall. Nothing below it can be popped until the matching ')'." }); return; }
        if (t === ")") {
          S({ i, line: [2, 5], note: "')' closes the level: everything above the matching '(' is complete and goes to the output." });
          while (ops[ops.length - 1] !== "(") { const o = ops.pop(); out.push(o); S({ i, line: 6, newOut: true, note: `Pop '${o}' to the output.` }); }
          ops.pop(); S({ i, line: 7, note: "Discard the '(' (parentheses never appear in postfix)." });
          return;
        }
        for (;;) {
          const top = ops[ops.length - 1];
          if (!(ops.length && top !== "(" && (PREC[top] > PREC[t] || (PREC[top] === PREC[t] && t !== "^")))) break;
          S({ i, line: [8, 9, 10, 11], popTop: true, note: `'${top}' (prec ${PREC[top]}) is on top and ${PREC[top] > PREC[t] ? "binds tighter than" : "has the same precedence as"} '${t}' (prec ${PREC[t]})${PREC[top] === PREC[t] ? ", and the operators are left-associative, so the earlier one runs first" : ""}. Its operands are complete: pop it to the output.` });
          out.push(ops.pop());
          S({ i, line: 12, newOut: true, note: `'${out[out.length - 1]}' is in the output.` });
        }
        const top = ops[ops.length - 1];
        ops.push(t);
        S({ i, line: [8, 13], note: `Push '${t}'. ${!top ? "The stack was empty." : top === "(" ? "The top is a '(' wall." : t === "^" && top === "^" ? "'^' is right-associative: 2 ^ 2 ^ 3 = 2 ^ (2 ^ 3), so the earlier '^' must <b>wait</b> for the later one." : `'${top}' binds less tightly, so it keeps waiting below '${t}'.`}` });
      });
      while (ops.length) { const o = ops.pop(); out.push(o); S({ line: 14, newOut: true, note: `Input finished: pop the remaining '${o}' to the output.` }); }
      const ev = [];
      for (const t of out) { if (isNum(t)) ev.push(Number(t)); else { const b = ev.pop(), a = ev.pop(); ev.push(t === "/" ? (b === 0 ? NaN : a / b) : applyOp(t, a, b)); } }
      const val = Number.isNaN(ev[0]) ? "division by zero" : fmtNum(ev[0]);
      S({ line: 14, result: val, note: `Postfix: <b>${out.join(" ")}</b>. Evaluate it with the RPN stack above: value <b>${val}</b> (real division here). Each token is pushed and popped at most once: O(n).` });
      return fr;
    },
    render: (f) => Viz.row(
      col(tape(f.toks, f.i, (k) => (k === f.i ? "active" : k < f.i ? "done" : ""), "infix tokens", "t"),
        chips("output (postfix)", f.out, (k) => (f.newOut && k === f.out.length - 1 ? "active" : "done")),
        f.result !== undefined ? badge(`value = ${f.result}`, "done") : ""),
      Viz.stack(f.ops, { label: "operators", cls: (k) => (f.popTop && k === f.ops.length - 1 ? "bad" : "visit") }),
      Viz.labeled("precedence", '<div class="sq-prec"><span>^</span><span>3, right-assoc</span><span>* /</span><span>2, left</span><span>+ -</span><span>1, left</span></div>'),
    ),
  }));

  /* 5 ─ Basic calculator. data-opts {"mode": "ii"} (+ - * /, one stack of terms) or {"mode": "i"} (+ - and parentheses, stack of saved states) */
  const evalCalc = (s, mode) => {
    const t = s.replace(/ /g, "");
    let k = 0;
    const num = () => { if (!/\d/.test(t[k] || "")) throw 0; let j = k; while (/\d/.test(t[j] || "")) j++; const v = Number(t.slice(k, j)); k = j; return v; };
    if (mode === "ii") {
      const term = () => { let v = num(); while (t[k] === "*" || t[k] === "/") { const o = t[k++]; const b = num(); if (o === "/" && b === 0) throw new Error("Use a non-zero divisor: this input divides by zero."); v = o === "*" ? v * b : Math.trunc(v / b); } return v; };
      let v = term();
      while (t[k] === "+" || t[k] === "-") { const o = t[k++]; const b = term(); v = o === "+" ? v + b : v - b; }
      if (k !== t.length) throw 0;
      return v;
    }
    const expr = () => {
      let neg = false;
      if (t[k] === "-") { neg = true; k++; }
      let v = term(); if (neg) v = -v;
      while (t[k] === "+" || t[k] === "-") { const o = t[k++]; const b = term(); v = o === "+" ? v + b : v - b; }
      return v;
    };
    const term = () => { if (t[k] === "(") { k++; const v = expr(); if (t[k] !== ")") throw 0; k++; return v; } return num(); };
    const v = expr();
    if (k !== t.length) throw 0;
    return v;
  };
  Viz.register("stacks-queues-calc", (el, opts) => {
    const two = opts.mode !== "i";
    return Viz.player(el, {
      title: two ? "Basic Calculator II: + and - push a term, * and / rewrite the top term" : "Basic Calculator: '(' saves the outer result and sign, ')' restores them",
      tag: two ? "LC 227 · ONE STACK" : "HARD · LC 224",
      legend: two ? [["active", "current char / changed term"], ["path", "sentinel"]] : [["active", "current char"], ["visit", "saved outer state"]],
      codeLang: "python",
      code: two
        ? ["stack, num, op = [], 0, '+'", "for ch in s + '+':                # sentinel flushes the last number", "    if ch.isdigit():", "        num = num * 10 + int(ch)", "    elif ch in '+-*/':", "        if op == '+': stack.append(num)", "        elif op == '-': stack.append(-num)", "        elif op == '*': stack.append(stack.pop() * num)", "        else: stack.append(int(stack.pop() / num))", "        op, num = ch, 0", "return sum(stack)"]
        : ["res, num, sign, stack = 0, 0, 1, []", "for ch in s:", "    if ch.isdigit():", "        num = num * 10 + int(ch)", "    elif ch in '+-':", "        res += sign * num", "        num, sign = 0, (1 if ch == '+' else -1)", "    elif ch == '(':", "        stack.append((res, sign))   # save the outer state", "        res, sign = 0, 1", "    elif ch == ')':", "        res += sign * num", "        prev_res, prev_sign = stack.pop()", "        res, num = prev_res + prev_sign * res, 0", "return res + sign * num"],
      inputs: [{ key: "s", label: two ? "expression: digits + - * / spaces (≤ 24 chars)" : "expression: digits + - ( ) spaces (≤ 24 chars)", value: two ? "3+2*2 - 8/3*3" : "1 - (4 + 5 - (2 - 3))", width: 230 }],
      random: () => {
        if (two) { let s = String(Viz.rand(1, 20)); const n = Viz.rand(2, 4); for (let k = 0; k < n; k++) s += "+-*/"[Viz.rand(0, 3)] + Viz.rand(1, 9); return { s }; }
        const gen = (d) => (d === 0 || Math.random() < 0.35 ? String(Viz.rand(1, 9)) : `${Math.random() < 0.2 ? "-" : ""}(${gen(d - 1)}${"+-"[Viz.rand(0, 1)]}${gen(d - 1)})`);
        let s; do { s = `${gen(2)}${"+-"[Viz.rand(0, 1)]}${gen(3)}`; } while (s.length > 24);
        return { s };
      },
      build: (inp) => {
        const s = String(inp.s);
        if (!s.trim() || s.length > 24) throw new Error("Use a non-empty expression of at most 24 characters.");
        if (!(two ? /^[\d+\-*/ ]+$/ : /^[\d+\-() ]+$/).test(s)) throw new Error(two ? "Use digits, spaces and + - * / only." : "Use digits, spaces, + - and parentheses only.");
        let expect;
        try { expect = evalCalc(s, two ? "ii" : "i"); } catch (e) { if (e instanceof Error) throw e; throw new Error(two ? "Use a valid expression like 3+2*2 (numbers separated by operators)." : "Use a valid expression like 1-(2+3); '-' may also start an expression or follow '('."); }
        const fr = [];
        if (two) {
          const chars = [...s, "+"], st = [];
          let num = 0, op = "+";
          const S = (x) => fr.push({ chars, st: [...st], i: -1, sentinel: true, ...x });
          S({ line: 0, vars: { num, op }, note: "Think of the expression as a sum of <b>terms</b>: 3 + 2*2 − 8/3*3 = 3 + (4) + (−6). The stack holds finished terms. op is the operator <b>before</b> the number being read, so we only act on it once that number is complete." });
          chars.forEach((ch, i) => {
            if (/\d/.test(ch)) { num = num * 10 + Number(ch); S({ i, line: [1, 2, 3], vars: { num, op }, note: `Digit ${ch}: num = ${num}.` }); return; }
            if (ch === " ") { S({ i, line: 1, vars: { num, op }, note: "A space: skip it." }); return; }
            const last = i === chars.length - 1;
            let note, line;
            if (op === "+") { st.push(num); line = 5; note = `The pending op is '+': push ${num} as a new term.`; }
            else if (op === "-") { st.push(-num); line = 6; note = `The pending op is '−': push −${num} as a new term (subtraction = adding a negative).`; }
            else { const a = st.pop(), v = op === "*" ? a * num : Math.trunc(a / num); st.push(v); line = op === "*" ? 7 : 8; note = `The pending op is '${op}': it binds tighter, so it applies to the <b>top term</b> right now: ${a} ${op} ${num} = ${v}${op === "/" && a % num !== 0 ? " (truncated toward zero)" : ""}.`; }
            S({ i, line: [1, 4, line], changed: st.length - 1, vars: { num, op }, note: `${last ? "The sentinel '+' at the end forces the last number out. " : `'${ch}' ends the number ${num}. `}${note}` });
            op = ch; num = 0;
            if (!last) S({ i, line: 9, vars: { num, op }, note: `Remember '${ch}' as the pending op for the next number; reset num.` });
          });
          S({ line: 10, vars: { result: expect }, note: `Add up the terms: ${st.map((v) => (v < 0 ? `(${v})` : v)).join(" + ")} = <b>${expect}</b>. One pass, O(n) time; the stack holds at most one term per '+' or '−'.` });
          return fr;
        }
        const chars = [...s], st = [];
        let res = 0, num = 0, sign = 1;
        const S = (x) => fr.push({ chars, st: st.map((e) => ({ ...e })), i: -1, ...x, vars: { res, sign: sign > 0 ? "+1" : "-1", num, ...(x.vars || {}) } });
        S({ line: 0, note: "Only + and − here, so the answer is a running sum: res. sign is the sign in front of the number being read. A '(' starts a fresh sub-sum, so we <b>save</b> the outer res and the sign in front of the '(' on the stack." });
        chars.forEach((ch, i) => {
          if (ch === " ") return;
          if (/\d/.test(ch)) { num = num * 10 + Number(ch); S({ i, line: [1, 2, 3], note: `Digit ${ch}: num = ${num}.` }); return; }
          if (ch === "+" || ch === "-") {
            const add = sign * num; res += add; num = 0; sign = ch === "+" ? 1 : -1;
            S({ i, line: [4, 5, 6], note: `'${ch}': add the finished number (${add >= 0 ? "+" : ""}${add}) to res, then the next number gets sign ${sign > 0 ? "+" : "−"}.` });
            return;
          }
          if (ch === "(") {
            st.push({ res, sign });
            S({ i, line: [7, 8], top: true, note: `'(' : push (res=${res}, sign=${sign > 0 ? "+" : "−"}). That is everything we need to resume the outer sum later.` });
            res = 0; sign = 1;
            S({ i, line: 9, note: "Start the inner sum from scratch: res = 0, sign = +." });
            return;
          }
          res += sign * num;
          const p = st.pop(), inner = res;
          S({ i, line: [10, 11, 12], popped: p, note: `')' : the inner sum is complete, res = ${inner}. Pop the saved outer state (res=${p.res}, sign=${p.sign > 0 ? "+" : "−"}).` });
          res = p.res + p.sign * inner; num = 0;
          S({ i, line: 13, note: `Combine: ${p.res} ${p.sign > 0 ? "+" : "−"} ${inner < 0 ? `(${inner})` : inner} = <b>${res}</b>. The whole parenthesised group has collapsed into the outer res.` });
        });
        const out = res + sign * num;
        S({ line: 14, vars: { result: out }, note: `End: res + sign·num = <b>${out}</b>. Each '(' is pushed once and popped once: O(n) time, O(depth) stack.` });
        return fr;
      },
      render: (f) => {
        const t = tape(f.chars, f.i, (k) => (f.sentinel && k === f.chars.length - 1 ? (k === f.i ? "active" : "path") : k === f.i ? "active" : k < f.i ? "done" : ""), two ? "s + '+'" : "s");
        if (two) return Viz.row(t, Viz.stack(f.st.map(String), { label: "terms", cls: (k) => (k === f.changed ? "active" : "") }));
        return Viz.row(t, Viz.stack(f.st.map((e) => `res=${e.res}, sign=${e.sign > 0 ? "+" : "−"}`), { label: "saved states", cls: (k) => (f.top && k === f.st.length - 1 ? "active" : "visit") }),
          f.popped ? Viz.labeled("popped", `<span class="v-item bad">res=${f.popped.res}, sign=${f.popped.sign > 0 ? "+" : "−"}</span>`) : "");
      },
    });
  });

  /* 6 ─ Min stack: a second stack remembers the minimum at every height. */
  Viz.register("stacks-queues-min-stack", (el) => Viz.player(el, {
    title: "Min stack: store 'the minimum so far' next to every value, so getMin is just a peek",
    tag: "LC 155 · O(1) EVERY OP",
    legend: [["active", "pushed / top"], ["bad", "popped"], ["done", "answer"]],
    codeLang: "python",
    code: ["class MinStack:", "    def __init__(self): self.st, self.mins = [], []", "    def push(self, x):", "        self.st.append(x)", "        self.mins.append(min(x, self.mins[-1]) if self.mins else x)", "    def pop(self):", "        self.st.pop(); self.mins.pop()", "    def top(self): return self.st[-1]", "    def getMin(self): return self.mins[-1]"],
    inputs: [{ key: "ops", label: "operations (push x, pop, top, getMin)", value: "push 5, push 3, push 7, getMin, push 2, getMin, pop, getMin, pop, pop, getMin", width: 340 }],
    random: () => {
      const ops = []; let n = 0;
      for (let k = 0; k < 11; k++) {
        const r = Math.random();
        if (n === 0 || r < 0.45) { ops.push(`push ${Viz.rand(1, 20)}`); n++; }
        else if (r < 0.7) { ops.push("pop"); n--; }
        else ops.push(r < 0.8 ? "top" : "getMin");
      }
      return { ops: ops.join(", ") };
    },
    build: (inp) => {
      const ops = parseOps(inp.ops, { push: true, pop: false, top: false, getMin: false }, 16);
      const st = [], mins = [], log = [], fr = [];
      const S = (x) => fr.push({ st: [...st], mins: [...mins], log: [...log], ...x });
      S({ line: [0, 1], note: "Why not one variable 'min'? Because after you pop the minimum you would need the <b>previous</b> minimum, and it is gone. So keep a parallel stack: mins[i] = the minimum of st[0..i]. Popping both keeps them in sync, and the old minimum reappears automatically." });
      ops.forEach((o) => {
        if (o.op === "push") {
          const m = mins.length ? Math.min(o.arg, mins[mins.length - 1]) : o.arg;
          st.push(o.arg); mins.push(m); log.push(`push(${o.arg})`);
          S({ line: [2, 3, 4], top: true, vars: { x: o.arg, "min so far": m }, note: `push(${o.arg}): the minimum of everything up to here is min(${o.arg}, ${mins.length > 1 ? mins[mins.length - 2] : "nothing"}) = <b>${m}</b>. Store it beside ${o.arg}.` });
          return;
        }
        if (!st.length) throw new Error(`Can't ${o.op} from an empty stack: push something first.`);
        if (o.op === "pop") {
          S({ line: [5, 6], leaving: true, note: `pop(): remove ${st[st.length - 1]} <b>and</b> its min entry ${mins[mins.length - 1]} together.` });
          st.pop(); mins.pop(); log.push("pop()");
          S({ line: 6, note: st.length ? `The min for the remaining stack is already stored: <b>${mins[mins.length - 1]}</b>. Nothing to recompute.` : "The stack is empty again." });
          return;
        }
        const v = o.op === "top" ? st[st.length - 1] : mins[mins.length - 1];
        log.push(`${o.op}() = ${v}`);
        S({ line: o.op === "top" ? 7 : 8, answer: o.op, vars: { [o.op]: v }, note: `${o.op}() = <b>${v}</b>: just look at the top of ${o.op === "top" ? "st" : "mins"}. O(1).` });
      });
      S({ line: 8, note: "Every operation touched only the tops: O(1) time each, O(n) extra space. A space-saving variant pushes onto mins only when x ≤ the current min (and pops it when the popped value equals the min). Use ≤, not &lt;, or duplicate minimums break." });
      return fr;
    },
    render: (f) => Viz.row(
      Viz.stack(f.st, { label: "st (values)", cls: (k) => (k === f.st.length - 1 ? (f.leaving ? "bad" : f.top || f.answer === "top" ? "active" : "") : "") }),
      Viz.stack(f.mins, { label: "mins (min so far)", cls: (k) => (k === f.mins.length - 1 ? (f.leaving ? "bad" : f.answer === "getMin" ? "done" : f.top ? "active" : "visit") : "") }),
      chips("calls", f.log, (k) => (k === f.log.length - 1 ? "active" : "")),
    ),
  }));

  /* 7 ─ Decode string: '[' saves (text so far, repeat count), ']' rebuilds. */
  Viz.register("stacks-queues-decode", (el) => Viz.player(el, {
    title: "Decode string: '[' pauses the outer string, ']' repeats the inner one and resumes",
    tag: "LC 394 · NESTING = STACK",
    legend: [["active", "current char"], ["visit", "paused outer contexts"], ["done", "decoded"]],
    codeLang: "python",
    code: ["stack, cur, k = [], '', 0", "for ch in s:", "    if ch.isdigit():", "        k = k * 10 + int(ch)        # multi-digit counts", "    elif ch == '[':", "        stack.append((cur, k))       # pause the outer context", "        cur, k = '', 0", "    elif ch == ']':", "        prev, n = stack.pop()", "        cur = prev + cur * n", "    else:", "        cur += ch", "return cur"],
    inputs: [{ key: "s", label: "encoded string (letters, digits, [ ])", value: "3[a2[c]]xy2[z]", width: 220 }],
    random: () => {
      const gen = (d) => {
        let s = "";
        const n = Viz.rand(1, 2);
        for (let k = 0; k < n; k++) s += d > 0 && Math.random() < 0.6 ? `${Viz.rand(2, 3)}[${gen(d - 1)}]` : "abcxyz"[Viz.rand(0, 5)].repeat(Viz.rand(1, 2));
        return s;
      };
      return { s: gen(2) };
    },
    build: (inp) => {
      const s = String(inp.s).replace(/\s/g, "");
      if (!s || s.length > 24) throw new Error("Use 1–24 characters.");
      if (!/^[a-z0-9[\]]+$/.test(s)) throw new Error("Use lowercase letters, digits and [ ] only.");
      const lens = [[0, 0]]; let kk = 0;
      for (let i = 0; i < s.length; i++) {
        const ch = s[i];
        if (/\d/.test(ch)) { kk = kk * 10 + Number(ch); if (s[i + 1] !== undefined && !/[\d[]/.test(s[i + 1])) throw new Error("Each number must be followed by '['."); if (i === s.length - 1) throw new Error("Each number must be followed by '['."); }
        else if (ch === "[") { if (!/\d/.test(s[i - 1] || "")) throw new Error("Each '[' must come right after a repeat count."); if (kk < 1 || kk > 50) throw new Error("Use repeat counts from 1 to 50."); lens.push([0, kk]); kk = 0; }
        else if (ch === "]") { if (lens.length < 2) throw new Error("Each ']' needs a matching '['."); const [len, n] = lens.pop(); lens[lens.length - 1][0] += len * n; }
        else lens[lens.length - 1][0] += 1;
        if (lens.some(([l]) => l > 200)) throw new Error("At most 200 output characters: use smaller repeat counts.");
      }
      if (lens.length !== 1) throw new Error("Each '[' needs a matching ']'.");
      const chars = [...s], st = [], fr = [];
      let cur = "", k = 0;
      const S = (x) => fr.push({ chars, st: st.map((e) => ({ ...e })), cur, k, i: -1, ...x, vars: { cur: `'${cur}'`, k, ...(x.vars || {}) } });
      S({ line: 0, note: "cur is the text decoded at the <b>current nesting level</b>; k is the repeat count being read. A '[' means 'start a new level', so we park the outer cur and the count on the stack." });
      chars.forEach((ch, i) => {
        if (/\d/.test(ch)) { k = k * 10 + Number(ch); S({ i, line: [1, 2, 3], note: `Digit ${ch}: k = ${k}.` }); return; }
        if (ch === "[") {
          st.push({ prev: cur, n: k });
          S({ i, line: [4, 5], top: true, note: `'[' : park (prev='${esc(cur)}', n=${k}) on the stack. The outer text waits there until the matching ']'.` });
          cur = ""; k = 0;
          S({ i, line: 6, note: "Start the inner level with an empty cur." });
          return;
        }
        if (ch === "]") {
          const { prev, n } = st.pop(), inner = cur;
          cur = prev + inner.repeat(n);
          S({ i, line: [7, 8, 9], popped: { prev, n }, note: `']' : pop (prev='${esc(prev)}', n=${n}). cur = '${esc(prev)}' + '${esc(inner)}' × ${n} = '<b>${esc(cur)}</b>'. The finished inner level is folded into the outer one.` });
          return;
        }
        cur += ch;
        S({ i, line: [10, 11], note: `Letter '${ch}': append to cur.` });
      });
      S({ line: 12, done: true, note: `Result: '<b>${esc(cur)}</b>' (length ${cur.length}). Time is O(length of the output), because every output character is copied a bounded number of times per level.` });
      return fr;
    },
    render: (f) => Viz.row(
      col(tape(f.chars, f.i, (k) => (k === f.i ? "active" : k < f.i ? "done" : "")),
        Viz.labeled("cur (current level)", `<div class="sq-text ${f.done ? "done" : ""}">${f.cur ? esc(f.cur) : '<span class="sq-empty">empty</span>'}</div>`)),
      Viz.stack(f.st.map((e) => `prev='${e.prev}', n=${e.n}`), { label: "paused contexts", cls: (k) => (f.top && k === f.st.length - 1 ? "active" : "visit") }),
      f.popped ? Viz.labeled("popped", `<span class="v-item bad">${esc(`prev='${f.popped.prev}', n=${f.popped.n}`)}</span>`) : "",
    ),
  }));

  /* 8 ─ Asteroid collision: survivors form a stack; a left-mover fights the top. */
  const ast = (v, c = "") => `<span class="v-item sq-ast ${v > 0 ? "r" : "l"} ${c}">${v > 0 ? `${v} →` : `← ${-v}`}</span>`;
  Viz.register("stacks-queues-asteroids", (el) => Viz.player(el, {
    title: "Asteroid collision: only a left-mover hitting a right-mover on the top of the stack can collide",
    tag: "LC 735 · O(n)",
    legend: [["active", "incoming asteroid"], ["bad", "destroyed"], ["done", "survivors (stack)"]],
    codeLang: "python",
    code: ["stack = []", "for a in asteroids:", "    while stack and a < 0 < stack[-1]:   # head-on collision", "        if stack[-1] < -a:", "            stack.pop(); continue        # top explodes, a keeps going", "        if stack[-1] == -a:", "            stack.pop()                  # both explode", "        break                            # a explodes", "    else:", "        stack.append(a)                  # no collision: a survives", "return stack"],
    inputs: [{ key: "a", label: "asteroids (sign = direction, 1–12)", value: "5, 10, -5, 8, -8, 3, 2, -6, -1", width: 260 }],
    random: () => ({ a: Array.from({ length: Viz.rand(6, 10) }, () => Viz.rand(1, 9) * (Math.random() < 0.5 ? -1 : 1)).join(", ") }),
    build: (inp) => {
      const a = Viz.parse.ints(inp.a);
      if (!a.length || a.length > 12 || a.some((v) => v === 0 || Math.abs(v) > 99)) throw new Error("Use 1–12 non-zero integers from -99 to 99.");
      const st = [], fr = [];
      const S = (x) => fr.push({ a, st: [...st], i: -1, ...x });
      S({ line: 0, note: "Positive moves right, negative moves left. Scan left to right; the stack holds the asteroids that have survived so far. Only one situation collides: the incoming one moves <b>left</b> and the top of the stack moves <b>right</b>. (A left-mover on the left and a right-mover on the right drift apart.)" });
      a.forEach((v, i) => {
        S({ i, line: 1, cur: v, note: `Incoming: ${v > 0 ? `${v} →` : `← ${-v}`}.` });
        let alive = true;
        while (st.length && v < 0 && st[st.length - 1] > 0) {
          const t = st[st.length - 1];
          if (t < -v) { S({ i, line: [2, 3, 4], cur: v, fight: true, loser: "top", note: `Collision: top ${t} → vs ← ${-v}. ${t} &lt; ${-v}, so the top explodes and the incoming one keeps flying left.` }); st.pop(); continue; }
          if (t === -v) { S({ i, line: [2, 5, 6], cur: v, fight: true, loser: "both", note: `Collision: equal sizes (${t}). Both explode.` }); st.pop(); alive = false; break; }
          S({ i, line: [2, 7], cur: v, fight: true, loser: "cur", note: `Collision: top ${t} → is bigger than ← ${-v}. The incoming one explodes; the stack is unchanged.` });
          alive = false; break;
        }
        if (alive) { st.push(v); S({ i, line: [8, 9], pushed: true, note: `No (more) collisions possible: ${v > 0 ? "it moves right, away from everything on its left" : st.length === 1 ? "nothing left of it moves right" : "the top moves left too"}. Push it.` }); }
      });
      S({ i: a.length - 1, line: 10, note: `Survivors: <b>[${st.join(", ")}]</b>. Each asteroid is pushed once and popped at most once, so the inner while loop is O(n) in total.` });
      return fr;
    },
    render: (f) => {
      const rest = f.a.slice(f.i + 1);
      const sv = f.st.map((v, k) => ast(v, k === f.st.length - 1 && f.fight && f.loser !== "cur" ? "bad" : k === f.st.length - 1 && f.pushed ? "active" : "done")).join("");
      const curH = f.cur !== undefined && !f.pushed ? ast(f.cur, f.fight && f.loser !== "top" ? "bad" : "active") : "";
      return Viz.row(
        Viz.labeled("survivors (stack, top at right) │ incoming │ not yet seen", `<div class="sq-lane"><div class="sq-seg">${sv || '<span class="sq-empty">empty</span>'}</div><div class="sq-seg ${curH ? "cur" : "idle"}">${curH || '<span class="sq-empty">·</span>'}</div><div class="sq-seg rest">${rest.map((v) => ast(v, "dim")).join("") || '<span class="sq-empty">none</span>'}</div></div>`),
      );
    },
  }));

  /* 9 ─ Queue from two stacks: lazy transfer makes every op amortized O(1). */
  Viz.register("stacks-queues-two-stacks", (el) => Viz.player(el, {
    title: "Queue from two stacks: pour 'in' into 'out' only when 'out' is empty",
    tag: "LC 232 · AMORTIZED O(1)",
    legend: [["active", "just pushed / moved"], ["bad", "leaving"], ["done", "front of the queue"]],
    codeLang: "python",
    code: ["class MyQueue:", "    def __init__(self): self.inb, self.out = [], []", "    def push(self, x): self.inb.append(x)", "    def _move(self):", "        if not self.out:                 # only when out is empty!", "            while self.inb:", "                self.out.append(self.inb.pop())", "    def pop(self):  self._move(); return self.out.pop()", "    def peek(self): self._move(); return self.out[-1]"],
    inputs: [{ key: "ops", label: "operations (push x, pop, peek)", value: "push 1, push 2, push 3, pop, push 4, peek, pop, pop, push 5, pop, pop", width: 330 }],
    random: () => {
      const ops = []; let n = 0, v = 1;
      for (let k = 0; k < 12; k++) { if (n === 0 || Math.random() < 0.55) { ops.push(`push ${v++}`); n++; } else if (Math.random() < 0.8) { ops.push("pop"); n--; } else ops.push("peek"); }
      return { ops: ops.join(", ") };
    },
    build: (inp) => {
      const ops = parseOps(inp.ops, { push: true, pop: false, peek: false }, 16);
      const inb = [], out = [], costs = [], fr = [];
      let bank = 0, total = 0;
      const S = (x) => fr.push({ inb: [...inb], out: [...out], costs: costs.map((c) => ({ ...c })), bank, total, ...x, vars: { "actual cost so far": total, "charged so far": costs.reduce((s, c) => s + c.charge, 0), bank, ...(x.vars || {}) } });
      S({ line: [0, 1], note: "'in' receives pushes. 'out' holds elements in <b>reversed</b> order, so its top is the oldest element: the queue front. Cost model: one stack push or pop = 1 unit." });
      ops.forEach((o, idx) => {
        if (o.op === "push") {
          inb.push(o.arg); total += 1; bank += 2; costs.push({ op: opStr(o), cost: 1, charge: 3 });
          S({ line: 2, newIn: true, note: `push(${o.arg}): append to 'in'. Actual cost 1. Charge it 3: the 2 extra go into the bank to pay for this element's future move (pop from in + push to out).` });
          return;
        }
        if (!inb.length && !out.length) throw new Error(`Can't ${o.op} from an empty queue (operation ${idx + 1}).`);
        let moved = 0;
        if (!out.length) {
          S({ line: [3, 4], note: `${o.op}(): 'out' is empty, so the front is buried at the <b>bottom</b> of 'in'. Pour everything across; reversing puts the oldest on top.` });
          while (inb.length) { out.push(inb.pop()); moved++; total += 2; bank -= 2; S({ line: [5, 6], moved: true, note: `Move ${out[out.length - 1]}: in → out (cost 2, paid from the bank).` }); }
        }
        const v = out[out.length - 1];
        costs.push({ op: opStr(o), cost: 1 + 2 * moved, charge: 1 });
        if (o.op === "pop") {
          S({ line: 7, leaving: true, note: `pop() returns <b>${v}</b>, the top of 'out'.${moved ? ` This call cost ${1 + 2 * moved} in total, but the bank covered the ${2 * moved} for moving.` : " No transfer needed: cost 1."}` });
          out.pop(); total += 1;
        } else { total += 1; S({ line: 8, peek: true, note: `peek() = <b>${v}</b>, the top of 'out'.${moved ? ` The transfer cost ${2 * moved}, prepaid by the bank.` : ""}` }); }
      });
      S({ line: 7, note: `Total actual cost ${total} ≤ total charged ${costs.reduce((s, c) => s + c.charge, 0)}, and the bank (= 2 × |in| = ${bank}) never goes negative. So every operation is <b>amortized O(1)</b>, even though a single pop can cost O(n). Each element is moved at most once in its life.` });
      return fr;
    },
    render: (f) => {
      const max = Math.max(3, ...f.costs.map((c) => c.cost));
      const bars = f.costs.map((c, k) => `<div class="sq-cost-row ${k === f.costs.length - 1 ? "now" : ""}"><span class="sq-cost-op">${esc(c.op)}</span><span class="sq-cost-bar" style="width:${(c.cost / max) * 100}px"></span><span class="sq-cost-n">${c.cost}</span><span class="sq-cost-ch">charged ${c.charge}</span></div>`).join("");
      const logical = [...f.out].reverse().concat(f.inb);
      return Viz.row(
        Viz.stack(f.inb, { label: "in", cls: (k) => (k === f.inb.length - 1 && f.newIn ? "active" : "") }),
        Viz.stack(f.out, { label: "out", cls: (k) => (k === f.out.length - 1 ? (f.leaving ? "bad" : f.moved ? "active" : "done") : "") }),
        col(Viz.queue(logical, { label: "the queue it represents", cls: (k) => (k === 0 ? "done" : "") }),
          Viz.labeled(`actual cost per operation (bank = ${f.bank})`, `<div class="sq-cost">${bars || '<span class="sq-empty">no operations yet</span>'}</div>`)),
      );
    },
  }));

  /* 10 ─ Circular deque on a fixed array: head + size, every index taken mod k. */
  const ringSvg = (a, head, size, hi) => {
    const k = a.length, cx = 130, cy = 122, R = 84;
    const live = new Set(Array.from({ length: size }, (_, j) => (head + j) % k));
    const tail = (head + size) % k;
    const parts = a.map((v, i) => {
      const ang = (-90 + (360 * i) / k) * Math.PI / 180, x = cx + R * Math.cos(ang), y = cy + R * Math.sin(ang);
      const lx = cx + (R + 30) * Math.cos(ang), ly = cy + (R + 30) * Math.sin(ang);
      const c = hi && hi.i === i ? hi.c : live.has(i) ? "live" : "stale";
      const tags = [i === head && size ? "H" : "", i === tail && size < k ? "T" : ""].filter(Boolean).join(" ");
      return `<g class="sq-slot ${c}"><rect x="${x - 19}" y="${y - 14}" width="38" height="28" rx="6"></rect><text x="${x}" y="${y}">${v === null ? "·" : esc(String(v))}</text></g><text class="sq-ridx" x="${cx + (R - 28) * Math.cos(ang)}" y="${cy + (R - 28) * Math.sin(ang)}">${i}</text>${tags ? `<text class="sq-rtag" x="${lx}" y="${ly}">${tags}</text>` : ""}`;
    }).join("");
    return `<svg class="sq-ring" viewBox="0 0 260 244" width="260" height="244" role="img" aria-label="ring buffer"><circle class="sq-ring-track" cx="${cx}" cy="${cy}" r="${R}"></circle>${parts}<text class="sq-rcenter" x="${cx}" y="${cy}">size ${size}/${k}</text></svg>`;
  };
  Viz.register("stacks-queues-ring", (el) => Viz.player(el, {
    title: "Circular deque: a fixed array whose ends wrap around, so both ends push and pop in O(1)",
    tag: "LC 641 · RING BUFFER",
    legend: [["done", "live slots"], ["active", "written now"], ["bad", "removed now"], ["dim", "stale (ignored)"]],
    codeLang: "python",
    code: ["class RingDeque:", "    def __init__(self, k): self.a, self.head, self.size = [None] * k, 0, 0", "    def push_back(self, x):", "        if self.size == len(self.a): return False         # full", "        self.a[(self.head + self.size) % len(self.a)] = x; self.size += 1", "    def push_front(self, x):", "        if self.size == len(self.a): return False", "        self.head = (self.head - 1) % len(self.a)         # step back, wrapping", "        self.a[self.head] = x; self.size += 1", "    def pop_front(self):", "        x = self.a[self.head]; self.head = (self.head + 1) % len(self.a)", "        self.size -= 1; return x", "    def pop_back(self):", "        self.size -= 1; return self.a[(self.head + self.size) % len(self.a)]"],
    inputs: [{ key: "k", label: "capacity (2–10)", value: "5", width: 60 }, { key: "ops", label: "pushBack x, pushFront x, popFront, popBack", value: "pushBack 1, pushBack 2, pushFront 3, popBack, pushBack 4, pushBack 5, pushFront 6, pushBack 7, popFront, popFront, pushBack 8", width: 340 }],
    random: () => {
      const ops = []; let n = 0;
      for (let j = 0; j < 12; j++) { const r = Math.random(); if (n === 0 || r < 0.6) { ops.push(`${Math.random() < 0.6 ? "pushBack" : "pushFront"} ${Viz.rand(1, 9)}`); n++; } else { ops.push(Math.random() < 0.6 ? "popFront" : "popBack"); n--; } }
      return { k: String(Viz.rand(4, 6)), ops: ops.join(", ") };
    },
    build: (inp) => {
      const k = Viz.parse.int(inp.k);
      if (!Number.isInteger(k) || k < 2 || k > 10) throw new Error("Use a capacity from 2 to 10.");
      const ops = parseOps(inp.ops, { pushBack: true, pushFront: true, popFront: false, popBack: false }, 16);
      const a = Array(k).fill(null), fr = [];
      let head = 0, size = 0;
      const S = (x) => fr.push({ a: [...a], head, size, ...x, vars: { head, size, tail: `(head+size)%k = ${(head + size) % k}`, ...(x.vars || {}) } });
      S({ line: [0, 1], note: `A plain array of ${k} slots plus two numbers. head is the index of the front; the live elements are a[head], a[head+1], … size of them, all <b>mod ${k}</b>. Nothing ever shifts, which is why both ends are O(1).` });
      ops.forEach((o) => {
        if (o.op === "pushBack" || o.op === "pushFront") {
          const back = o.op === "pushBack";
          if (size === k) { S({ line: back ? [2, 3] : [5, 6], full: true, vars: { returned: "False" }, note: `${opStr(o)}: the deque is full (size = ${k}). Return False; do not overwrite. (A logging ring buffer would overwrite the oldest instead.)` }); return; }
          let at;
          if (back) { at = (head + size) % k; a[at] = o.arg; size++; }
          else { head = (head - 1 + k) % k; at = head; a[at] = o.arg; size++; }
          S({ line: back ? [2, 4] : [5, 7, 8], hi: { i: at, c: "active" }, note: back ? `${opStr(o)}: write at (head + size) % ${k} = ${at}.${at < head ? " It wrapped past the end of the array to the start." : ""}` : `${opStr(o)}: head steps back to (head − 1) % ${k} = ${head}${head === k - 1 ? " (it wrapped from 0 to the last slot)" : ""}, then write there.` });
          return;
        }
        if (!size) throw new Error(`Can't ${o.op} from an empty deque.`);
        if (o.op === "popFront") {
          const at = head, v = a[at];
          S({ line: [9, 10], hi: { i: at, c: "bad" }, note: `popFront(): take a[head] = a[${at}] = <b>${v}</b>.` });
          head = (head + 1) % k; size--;
          S({ line: [10, 11], hi: { i: at, c: "stale" }, note: `head moves to ${head}${head === 0 && at === k - 1 ? " (wrapped)" : ""}. The old value stays in the array but is now <b>stale</b>: it is outside head..head+size, so it is ignored and will be overwritten later.` });
          return;
        }
        const at = (head + size - 1) % k, v = a[at];
        S({ line: [12, 13], hi: { i: at, c: "bad" }, note: `popBack(): the last live slot is (head + size − 1) % ${k} = ${at}; return <b>${v}</b>.` });
        size--;
        S({ line: 13, hi: { i: at, c: "stale" }, note: "size shrinks by one; that slot is now stale." });
      });
      const items = Array.from({ length: size }, (_, j) => a[(head + j) % k]);
      S({ line: 1, note: `Logical deque, front to back: <b>[${items.join(", ")}]</b>. This is exactly how C#'s Queue&lt;T&gt; works inside (it grows by copying into a bigger ring when full). Python's deque links fixed-size blocks instead, but both ends are O(1) for the same reason: nothing shifts.` });
      return fr;
    },
    render: (f) => {
      const k = f.a.length, live = new Set(Array.from({ length: f.size }, (_, j) => (f.head + j) % k));
      const cls = (i) => (f.hi && f.hi.i === i ? (f.hi.c === "stale" ? "dim" : f.hi.c) : live.has(i) ? "done" : "dim");
      const items = Array.from({ length: f.size }, (_, j) => f.a[(f.head + j) % k]);
      const ptr = {}; if (f.size) ptr.head = f.head; if (f.size < k) ptr.tail = (f.head + f.size) % k;
      return Viz.row(
        Viz.labeled("the same array as a ring (H head, T tail)", ringSvg(f.a, f.head, f.size, f.hi && { i: f.hi.i, c: f.hi.c === "stale" ? "stale" : f.hi.c })),
        col(Viz.array(f.a.map((v) => (v === null ? "·" : v)), { ptrsTop: ptr, cls, label: "array a (what memory holds)" }),
          Viz.queue(items, { label: "logical deque", cls: () => "done" }),
          f.full ? badge("full: returned False", "bad") : ""),
      );
    },
  }));

  /* 11 ─ BFS on a grid: the queue holds the frontier, in order of distance. */
  Viz.register("stacks-queues-bfs", (el) => Viz.player(el, {
    title: "BFS preview: a queue processes cells in order of distance, so the first time you reach T is the shortest path",
    tag: "QUEUE → SHORTEST PATH",
    legend: [["active", "dequeued now"], ["visit", "in the queue (frontier)"], ["done", "finished"], ["path", "shortest path"]],
    codeLang: "python",
    code: ["q = deque([start]); dist = {start: 0}; parent = {start: None}", "while q:", "    r, c = q.popleft()                     # oldest = closest", "    if (r, c) == target: break", "    for nr, nc in ((r+1, c), (r-1, c), (r, c+1), (r, c-1)):", "        if inside(nr, nc) and grid[nr][nc] != '#' and (nr, nc) not in dist:", "            dist[(nr, nc)] = dist[(r, c)] + 1  # mark when ENQUEUED", "            parent[(nr, nc)] = (r, c)", "            q.append((nr, nc))", "# walk parent[] back from target to rebuild the path"],
    inputs: [{ key: "g", label: "grid rows separated by ; (. open, # wall, S start, T target)", value: "S..#....;.#.#.##.;.#...#..;.##.#..#;....#.T.", width: 380 }],
    random: () => {
      const R = Viz.rand(4, 6), C = Viz.rand(6, 9);
      const g = Array.from({ length: R }, () => Array.from({ length: C }, () => (Math.random() < 0.25 ? "#" : ".")));
      g[0][0] = "S"; g[R - 1][C - 1] = "T";
      return { g: g.map((r) => r.join("")).join(";") };
    },
    build: (inp) => {
      const g = String(inp.g).split(/[;\n]+/).map((r) => r.trim()).filter(Boolean).map((r) => [...r]);
      if (!g.length || g.length > 7 || g.some((r) => r.length !== g[0].length) || g[0].length > 10) throw new Error("Use 1–7 rows of equal length (at most 10 cells each), separated by ;.");
      if (g.some((r) => r.some((c) => !".#ST".includes(c)))) throw new Error("Use only . # S T in the grid.");
      const find = (ch) => { const out = []; g.forEach((r, i) => r.forEach((c, j) => { if (c === ch) out.push([i, j]); })); return out; };
      const Ss = find("S"), Ts = find("T");
      if (Ss.length !== 1 || Ts.length !== 1) throw new Error("Use exactly one S and exactly one T.");
      const [sr, sc] = Ss[0], [tr, tc] = Ts[0], R = g.length, C = g[0].length;
      const key = (r, c) => r * C + c;
      const dist = new Map([[key(sr, sc), 0]]), parent = new Map([[key(sr, sc), -1]]), done = new Set(), q = [[sr, sc]], fr = [];
      let cur = null, found = false, path = new Set();
      const S = (x) => fr.push({ g, dist: new Map(dist), done: new Set(done), q: q.map((p) => [...p]), cur, path: new Set(path), ...x });
      S({ line: 0, note: "Start: S is at distance 0 and is the only thing in the queue. Mark cells as seen <b>when they are enqueued</b>, not when they are dequeued; otherwise the same cell can be enqueued many times." });
      while (q.length) {
        cur = q.shift();
        const [r, c] = cur, d = dist.get(key(r, c));
        if (r === tr && c === tc) { found = true; S({ line: [2, 3], note: `Dequeue T at distance ${d}. Because the queue hands out cells in order of distance (all distance-${d - 1} cells left before any distance-${d} cell), this is the shortest distance. Stop.` }); break; }
        S({ line: [1, 2], note: `Dequeue (${r},${c}), distance ${d}. The queue is FIFO, so it is the oldest, i.e. closest, unfinished cell.` });
        const added = [];
        for (const [nr, nc] of [[r + 1, c], [r - 1, c], [r, c + 1], [r, c - 1]]) {
          if (nr < 0 || nc < 0 || nr >= R || nc >= C || g[nr][nc] === "#" || dist.has(key(nr, nc))) continue;
          dist.set(key(nr, nc), d + 1); parent.set(key(nr, nc), key(r, c)); q.push([nr, nc]); added.push(`(${nr},${nc})`);
        }
        done.add(key(r, c));
        S({ line: [4, 5, 6, 7, 8], added: added.length, note: added.length ? `Enqueue its unseen open neighbours ${added.join(" ")} at distance ${d + 1}. They join the <b>back</b> of the queue, behind every distance-${d} cell.` : "No unseen open neighbours (walls, edges or already seen). Nothing added." });
      }
      cur = null;
      if (found) {
        for (let k = key(tr, tc); k !== -1; k = parent.get(k)) path.add(k);
        S({ line: 9, note: `Follow parent pointers back from T: the highlighted path has ${dist.get(key(tr, tc))} steps. BFS visits each cell at most once: O(rows × cols).` });
      } else S({ line: 1, note: "The queue ran dry without reaching T: it is unreachable. Every reachable cell was visited exactly once." });
      return fr;
    },
    render: (f) => {
      const C = f.g[0].length, inQ = new Set(f.q.map(([r, c]) => r * C + c));
      return Viz.row(
        Viz.grid(f.g, {
          label: "grid (numbers = distance from S)",
          cls: (r, c, v) => { const k = r * C + c; return v === "#" ? "wall" : f.path.has(k) ? "path" : f.cur && f.cur[0] === r && f.cur[1] === c ? "active" : inQ.has(k) ? "visit" : f.done.has(k) ? "done" : ""; },
          fmt: (v, r, c) => (v === "#" ? "■" : f.dist.has(r * C + c) ? `${v === "S" || v === "T" ? v : ""}${f.dist.get(r * C + c)}` : v === "." ? "" : v),
        }),
        Viz.queue(f.q.map(([r, c]) => `(${r},${c}) d${f.dist.get(r * C + c)}`), { label: "queue", cls: (k) => (f.added && k >= f.q.length - f.added ? "active" : "visit") }),
      );
    },
  }));
})();
