/* Tries visualizers. Every frame comes from running the real algorithm on the words you type. */
(() => {
  const S = "tries";
  const P = (n) => `${S}-${n}`;
  const esc = Viz.esc;

  /* ---------- input parsing ---------- */
  function toks(text) { return String(text).replace(/[[\]"']/g, " ").split(/[\s,]+/).filter(Boolean); }
  function words(text, { min = 1, max = 8, maxLen = 7, dedupe = true, what = "words" } = {}) {
    let a = toks(text).map((t) => t.toLowerCase());
    for (const w of a) {
      if (!/^[a-z]+$/.test(w)) throw new Error(`"${w}" must use only the letters a–z.`);
      if (w.length > maxLen) throw new Error(`"${w}" is longer than ${maxLen} letters; keep words short so the trie fits.`);
    }
    if (dedupe) a = [...new Set(a)];
    if (a.length < min) throw new Error(`Enter at least ${min} ${what}, separated by commas.`);
    if (a.length > max) throw new Error(`Use at most ${max} ${what} so the picture stays readable (you have ${a.length}).`);
    return a;
  }
  function word(text, what, { maxLen = 7, re = /^[a-z]+$/, hint = "the letters a–z" } = {}) {
    const w = String(text).trim().toLowerCase();
    if (!w) throw new Error(`Enter ${what}.`);
    if (!re.test(w)) throw new Error(`${what} must use only ${hint}.`);
    if (w.length > maxLen) throw new Error(`Keep ${what} at most ${maxLen} characters.`);
    return w;
  }
  const pick = (a) => a[Viz.rand(0, a.length - 1)];
  function shuffle(a) { for (let i = a.length - 1; i > 0; i--) { const j = Viz.rand(0, i); [a[i], a[j]] = [a[j], a[i]]; } return a; }
  const BANK = ["car", "card", "care", "cart", "cat", "cats", "do", "dog", "dot", "dots", "tea", "ten", "tent", "to", "toe", "top", "tops", "in", "inn", "ink", "app", "apple", "ape", "apt", "bat", "bad", "bed", "bee", "beet", "an", "and", "ant"];
  function randWords(n = Viz.rand(5, 7)) {
    const first = pick("cdtiab".split(""));
    const near = shuffle(BANK.filter((w) => w[0] === first));
    const rest = shuffle(BANK.filter((w) => w[0] !== first));
    return [...new Set([...near.slice(0, Math.min(near.length, n - 2)), ...rest])].slice(0, n);
  }

  /* ---------- a trie: node ids index parallel arrays; node 0 is the root ---------- */
  const newTrie = () => ({ ch: [{}], pass: [0], end: [0], chr: [""], par: [-1], dep: [0] });
  function addNode(T, p, c) {
    const id = T.chr.length;
    T.ch.push({}); T.pass.push(0); T.end.push(0); T.chr.push(c); T.par.push(p); T.dep.push(T.dep[p] + 1);
    T.ch[p][c] = id;
    return id;
  }
  function insertPlain(T, w) {
    let u = 0; T.pass[0]++;
    for (const c of w) { if (T.ch[u][c] === undefined) addNode(T, u, c); u = T.ch[u][c]; T.pass[u]++; }
    T.end[u]++;
    return u;
  }
  function trieOf(ws) { const T = newTrie(); ws.forEach((w) => insertPlain(T, w)); return T; }
  const kids = (T, id) => Object.keys(T.ch[id]).sort().map((c) => T.ch[id][c]);
  function pathTo(T, id) { const p = []; for (let u = id; u >= 0; u = T.par[u]) p.unshift(u); return p; }
  const wordAt = (T, id) => pathTo(T, id).slice(1).map((u) => T.chr[u]).join("");
  function subtree(T, u, out = new Set()) { out.add(u); kids(T, u).forEach((v) => subtree(T, v, out)); return out; }
  /* n-ary layout: a two-child list is padded with null so layoutTree does not use its binary placement */
  function layOf(T, { dx = 42, dy = 56, alive } = {}) {
    const ok = alive || (() => true);
    return Viz.layoutTree(0, (id) => { const k = kids(T, id).filter(ok); return k.length === 2 ? [...k, null] : k; }, (id) => T.chr[id], { dx, dy });
  }
  function draw(T, o = {}) {
    const lay = o.lay || layOf(T, o);
    const vis = o.vis || (() => true);
    const nodes = lay.nodes.map((nd) => ({ ...nd, label: nd.id === 0 ? "" : o.lbl ? o.lbl(nd.id) : nd.label, top: nd.id === 0 ? "root" : o.top ? o.top(nd.id) : undefined, sub: o.sub && vis(nd.id) ? o.sub(nd.id) : undefined }));
    const edges = lay.edges.map((e) => ({ ...e, w: o.ew ? o.ew(e.u, e.v) : undefined }));
    return Viz.graph({ nodes, edges }, {
      r: o.r || 16,
      label: o.label,
      nodeCls: (id) => {
        id = Number(id);
        if (!vis(id)) return "tr-hide";
        return `${(o.cls && o.cls(id)) || ""}${o.isEnd && o.isEnd(id) ? " tr-end" : ""}`;
      },
      edgeCls: (k) => {
        const [u, v] = k.split("-").map(Number);
        if (o.parent ? o.parent(v) !== u : T.par[v] !== u) return "";
        if (!vis(v)) return "tr-hide";
        return (o.ecls && o.ecls(u, v)) || "";
      },
    });
  }
  function stackHtml(cards, { label = "call stack (top = running)", max = 6 } = {}) {
    const shown = cards.slice(-max), more = cards.length - shown.length;
    const html = shown.map((c, k) => `<div class="tr-frame ${c.cls || (k === shown.length - 1 ? "active" : "visit")}"><div class="tr-fhead"><b>${esc(c.t)}</b>${c.s ? `<span>${esc(c.s)}</span>` : ""}</div></div>`).reverse().join("");
    return `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="tr-stack">${html || '<div class="tr-more">empty</div>'}${more > 0 ? `<div class="tr-more">+ ${more} older frame${more > 1 ? "s" : ""} below</div>` : ""}<div class="tr-floor">bottom</div></div></div>`;
  }
  const chips = (label, arr, cls) => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="tr-words">${arr.length ? arr.map((w, i) => `<span class="tr-chip ${(cls && cls(w, i)) || ""}">${esc(w)}</span>`).join("") : '<span class="tr-none">none yet</span>'}</div></div>`;
  const letters = (label, s, cls, ptrs) => `<div class="tr-seq">${Viz.array(s.split(""), { label, cls: cls || (() => ""), ptrs })}</div>`;
  const col = (...parts) => `<div class="tr-col">${parts.filter(Boolean).join("")}</div>`;
  const row = (...parts) => `<div class="tr-row">${parts.filter(Boolean).join("")}</div>`;
  const pathEdges = (path) => { const s = new Set(); for (let i = 1; i < path.length; i++) s.add(`${path[i - 1]}-${path[i]}`); return s; };
  const pe = (T) => (id) => `p${T.pass[id]}${T.end[id] ? ` e${T.end[id]}` : ""}`;

  /* ======================================================================
     1. Insert: one node per character, shared prefixes are walked, not copied
     ====================================================================== */
  Viz.register(P("insert"), (el, opts) => Viz.player(el, {
    title: "Insert: walk the shared prefix, then grow a new branch",
    tag: "ONE CHARACTER PER STEP",
    legend: [["active", "current node"], ["visit", "path walked"], ["done", "node created now"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def insert(self, word):",
      "    node = self.root",
      "    node.pass_count += 1                 # root: total words",
      "    for ch in word:",
      "        if ch not in node.children:",
      "            node.children[ch] = TrieNode()   # new branch",
      "        node = node.children[ch]",
      "        node.pass_count += 1             # one more word passes here",
      "    node.end_count += 1                  # a word ends exactly here",
    ],
    inputs: [{ key: "words", label: "words to insert (in order)", value: opts.words || "car,cat,cart,care,dog,do", width: 300 }],
    random: () => ({ words: randWords().join(",") }),
    build: ({ words: text }) => {
      const ws = words(text, { max: 8, maxLen: 7, dedupe: false });
      const F = trieOf(ws), lay = layOf(F);
      const T = newTrie(), fr = [];
      let made = 1, reused = 0, created = 0;
      const snap = (x) => ({ F, lay, T: { pass: [...T.pass], end: [...T.end] }, made, ws, ...x });
      fr.push(snap({ wi: -1, path: [0], line: 0, vars: { words: ws.length }, note: `An empty trie is just a root with no children. We insert ${ws.length} word${ws.length > 1 ? "s" : ""}: <b>${ws.join(", ")}</b>. Each node stands for one character; a word is the path from the root down to a node. The small text under a node is <b>p</b> = how many words pass through it and <b>e</b> = how many end there.` }));
      ws.forEach((w, wi) => {
        let u = 0; T.pass[0]++;
        const path = [0];
        fr.push(snap({ wi, k: -1, cur: 0, path: [0], line: [1, 2], vars: { word: w, node: "root", "root.pass": T.pass[0] }, note: `Insert <b>${esc(w)}</b>. Start at the root and count the word there (root.pass = ${T.pass[0]} words so far).` }));
        [...w].forEach((c, k) => {
          const has = T.ch[u][c] !== undefined;
          if (!has) { addNode(T, u, c); made++; created++; } else reused++;
          const v = T.ch[u][c];
          T.pass[v]++; path.push(v);
          const pre = w.slice(0, k + 1);
          fr.push(snap({ wi, k, cur: v, born: has ? null : v, path: [...path], line: has ? [3, 4, 6, 7] : [3, 4, 5, 6, 7], vars: { word: w, ch: c, prefix: pre, [`pass("${pre}")`]: T.pass[v] }, note: has
            ? `'${c}': the child already exists, so <b>reuse</b> it. Another word already starts with "${esc(pre)}", and we only bump its pass count to ${T.pass[v]}.`
            : `'${c}': no child for '${c}', so <b>create</b> one. From here down, "${esc(w)}" shares nothing with earlier words.` }));
          u = v;
        });
        T.end[u]++;
        fr.push(snap({ wi, k: w.length, cur: u, path: [...path], endAt: u, line: 8, vars: { word: w, "end_count": T.end[u], depth: w.length }, note: `Mark the end: end_count = ${T.end[u]}. ${T.end[u] > 1 ? `"${esc(w)}" was inserted ${T.end[u]} times, and the count records duplicates.` : T.ch[u] && Object.keys(T.ch[u]).length ? `This node has children too, so the end mark is the only thing that says "${esc(w)}" is a word and not just a prefix.` : `Without this mark the trie could not tell the word "${esc(w)}" from a mere prefix.`} Cost: ${w.length} steps, whatever the number of stored words.` }));
      });
      const total = ws.reduce((s, w) => s + w.length, 0);
      fr.push(snap({ wi: ws.length, path: [], line: 8, vars: { "letters typed": total, "nodes (no root)": made - 1, "letters saved": total - (made - 1) }, note: `Done. The words have ${total} letters but the trie needs only <b>${made - 1}</b> nodes: ${reused} steps reused an existing node, ${created} created one. Shared prefixes are stored once. root.pass = ${T.pass[0]} counts every insert.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pE = pathEdges(f.path);
      const T = { ...f.F, pass: f.T.pass, end: f.T.end };
      const w = f.wi >= 0 && f.wi < f.ws.length ? f.ws[f.wi] : null;
      return col(
        draw(f.F, {
          lay: f.lay, vis: (id) => id < f.made, sub: pe(T), isEnd: (id) => f.T.end[id] > 0,
          cls: (id) => (id === f.born ? "done" : id === f.cur ? "active" : path.has(id) ? "visit" : ""),
          ecls: (u, v) => (pE.has(`${u}-${v}`) ? (v === f.born ? "done" : "visit") : ""),
        }),
        w ? letters(`inserting "${w}"`, w, (i) => (i === f.k ? "active" : i < f.k || f.k >= w.length ? "done" : ""), f.k >= 0 && f.k < w.length ? { ch: f.k } : {}) : "",
        chips("words", f.ws, (x, i) => (i < f.wi ? "done" : i === f.wi ? "active" : "dim")),
      );
    },
  }));

  /* ======================================================================
     2. Query: search / startsWith / countPrefix / shortest root share one walk
     ====================================================================== */
  const MODES = ["search(word)", "startsWith(prefix)", "countPrefix(prefix)", "shortest root (replace words)"];
  Viz.register(P("query"), (el, opts) => Viz.player(el, {
    title: "Queries: one walk down, four different questions",
    tag: "PICK A MODE",
    legend: [["active", "current node"], ["visit", "path matched"], ["bad", "fell off: missing child"], ["path", "words below the prefix"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def walk(self, s):",
      "    node = self.root",
      "    for ch in s:",
      "        if ch not in node.children:",
      "            return None                  # fell off: no word has this prefix",
      "        node = node.children[ch]",
      "    return node",
      "search(w):       n = walk(w); return n is not None and n.end_count > 0",
      "startsWith(p):   return walk(p) is not None",
      "countPrefix(p):  n = walk(p); return n.pass_count if n else 0",
      "shortestRoot(w): walk w, but stop at the first node with end_count > 0",
    ],
    inputs: [
      { key: "words", label: "dictionary", value: opts.words || "cat,cats,car,card,do,dog,dot", width: 260 },
      { key: "q", label: "query", value: opts.q || "car", width: 110 },
      { key: "mode", label: "mode", type: "select", options: MODES, value: opts.mode || MODES[0] },
    ],
    random: () => { const ws = randWords(); const w = pick(ws); const q = pick([w, w.slice(0, Math.max(1, w.length - 1)), w + pick(["s", "e", "x"]), pick(ws).slice(0, 2)]); return { words: ws.join(","), q }; },
    build: ({ words: text, q: qt, mode }) => {
      const ws = words(text, { max: 8, maxLen: 7 });
      const q = word(qt, "the query", { maxLen: 9 });
      const T = trieOf(ws), lay = layOf(T), mi = Math.max(0, MODES.indexOf(mode));
      const fr = [];
      const snap = (x) => ({ T, lay, q, mi, ws, ...x });
      const modeLine = 7 + mi;
      const ask = ["is the whole word stored?", "does any word start with it?", "how many words start with it?", "what is the shortest stored word that is a prefix of it?"][mi];
      fr.push(snap({ k: -1, path: [0], cur: 0, line: [modeLine, 1], vars: { mode: MODES[mi], query: q }, note: `<b>${esc(MODES[mi])}</b> with "${esc(q)}": ${ask} Every mode is the same walk from the root, one character per step. Only what we do at the end differs.` }));
      let u = 0; const path = [0];
      for (let k = 0; k < q.length; k++) {
        const c = q[k], v = T.ch[u][c];
        if (v === undefined) {
          const msg = [`so "${esc(q)}" is not stored: return <b>False</b>.`, `so no word starts with "${esc(q)}": return <b>False</b>.`, `so <b>0</b> words start with "${esc(q)}".`, `and no stored word was a prefix of "${esc(q)}", so it stays unchanged.`][mi];
          fr.push(snap({ k, path: [...path], cur: u, fell: true, line: [2, 3, 4], vars: { ch: c, matched: q.slice(0, k), result: ["False", "False", 0, q][mi] }, note: `'${c}': the node for "${esc(q.slice(0, k)) || "root"}" has no child '${c}'. We fell off the trie after ${k} matched character${k === 1 ? "" : "s"}, ${msg} We never look at the other ${ws.length} words: the cost is at most the query length.` }));
          return fr;
        }
        u = v; path.push(v);
        if (mi === 3 && T.end[v]) {
          fr.push(snap({ k, path: [...path], cur: v, hit: true, line: [10, 5], vars: { ch: c, root: q.slice(0, k + 1), result: q.slice(0, k + 1) }, note: `'${c}': this node ends the stored word "<b>${esc(q.slice(0, k + 1))}</b>". It is the shortest root, so stop here (no need to read the rest) and replace "${esc(q)}" with "${esc(q.slice(0, k + 1))}".` }));
          return fr;
        }
        fr.push(snap({ k, path: [...path], cur: v, line: [2, 3, 5], vars: { ch: c, matched: q.slice(0, k + 1), pass: T.pass[v], end: T.end[v] }, note: `'${c}': the child exists, step down. Matched "${esc(q.slice(0, k + 1))}" so far. ${T.pass[v]} word${T.pass[v] === 1 ? "" : "s"} pass${T.pass[v] === 1 ? "es" : ""} through this node.` }));
      }
      const below = [...subtree(T, u)].filter((id) => T.end[id]).map((id) => wordAt(T, id));
      const res = [T.end[u] > 0 ? "True" : "False", "True", T.pass[u], q][mi];
      const note = [
        T.end[u] ? `The walk survived and this node has end_count = ${T.end[u]}: "${esc(q)}" is a stored word, return <b>True</b>.` : `The walk survived, but end_count = 0: "${esc(q)}" is only a prefix of ${below.map((x) => `"${esc(x)}"`).join(", ")}, not a stored word. Return <b>False</b>. This end mark is the whole difference between search and startsWith.`,
        `The walk survived, so at least one word starts with "${esc(q)}": return <b>True</b>. startsWith never checks the end mark.`,
        `pass_count = <b>${T.pass[u]}</b>: the words below this node are ${below.map((x) => `"${esc(x)}"`).join(", ")}. The count was maintained during inserts, so the answer is O(len(prefix)) with no subtree walk.`,
        `We read all of "${esc(q)}" without meeting an end mark, so no stored word is a prefix of it. Keep "${esc(q)}" unchanged.`,
      ][mi];
      fr.push(snap({ k: q.length, path: [...path], cur: u, done: true, below: mi === 2 || (mi === 0 && !T.end[u]) ? subtree(T, u) : null, line: [6, modeLine], vars: { result: res, "words below": below.length }, note }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pE = pathEdges(f.path);
      const last = f.path[f.path.length - 1];
      return col(
        draw(f.T, {
          lay: f.lay, isEnd: (id) => f.T.end[id] > 0, sub: f.mi === 2 ? pe(f.T) : undefined,
          cls: (id) => (f.fell && id === last ? "bad" : f.hit && id === last ? "done" : f.done && id === last ? (f.mi === 0 && !f.T.end[id] ? "bad" : "done") : id === f.cur ? "active" : path.has(id) ? "visit" : f.below && f.below.has(id) ? "path" : ""),
          ecls: (u, v) => (pE.has(`${u}-${v}`) ? "visit" : f.below && f.below.has(v) && f.below.has(u) ? "path" : ""),
        }),
        letters(`query "${f.q}"`, f.q, (i) => (f.fell && i === f.k ? "bad" : i === f.k && !f.done ? (f.hit ? "done" : "active") : i < f.k || f.done ? "done" : ""), f.k >= 0 && f.k < f.q.length ? { ch: f.k } : {}),
      );
    },
  }));

  /* ======================================================================
     3. Wildcard search (LC 211): '.' branches into every child, DFS with backtracking
     ====================================================================== */
  Viz.register(P("wildcard"), (el, opts) => Viz.player(el, {
    title: "Wildcard search: a dot tries every child",
    tag: "DFS + BACKTRACKING",
    legend: [["active", "current call"], ["visit", "on the call stack"], ["bad", "dead end (returned False)"], ["done", "match found"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def search(self, word):",
      "    def dfs(node, i):",
      "        if i == len(word): return node.end_count > 0",
      "        ch = word[i]",
      "        if ch == '.':",
      "            for child in node.children.values():   # try every branch",
      "                if dfs(child, i + 1): return True",
      "            return False",
      "        if ch not in node.children: return False",
      "        return dfs(node.children[ch], i + 1)",
      "    return dfs(self.root, 0)",
    ],
    inputs: [
      { key: "words", label: "dictionary", value: opts.words || "bat,bad,dog,dot,pen,pet", width: 240 },
      { key: "q", label: "pattern (letters and .)", value: opts.q || "..n", width: 110 },
    ],
    random: () => { const ws = randWords(); const w = pick(ws); const q = [...w].map((c) => (Math.random() < 0.5 ? "." : c)).join(""); return { words: ws.join(","), q: Math.random() < 0.3 ? q.slice(0, -1) + "z" : q }; },
    build: ({ words: text, q: qt }) => {
      const ws = words(text, { max: 8, maxLen: 6 });
      const q = word(qt, "the pattern", { maxLen: 7, re: /^[a-z.]+$/, hint: "the letters a–z and '.'" });
      const T = trieOf(ws), lay = layOf(T), fr = [];
      const dead = new Set(), stack = [];
      const snap = (x) => ({ T, lay, q, dead: new Set(dead), stack: stack.map((s) => ({ ...s })), ...x });
      fr.push(snap({ cur: 0, i: -1, line: [0, 10], vars: { pattern: q, words: ws.length }, note: `Search for "<b>${esc(q)}</b>". A letter has at most one child to follow, but a '.' matches <i>any</i> letter, so the search must branch into every child and back out of dead ends. This is a DFS whose call stack is drawn on the right.` }));
      let calls = 0;
      const dfs = (u, i) => {
        calls++;
        if (fr.length > 400) throw new Error("This pattern explores too many branches to animate; use fewer dots or fewer words.");
        stack.push({ t: `dfs(${u === 0 ? "root" : `'${wordAt(T, u)}'`}, i=${i})`, u, i });
        if (i === q.length) {
          const ok = T.end[u] > 0;
          fr.push(snap({ cur: u, i, line: 2, ok, vars: { i, "end_count": T.end[u], returns: ok ? "True" : "False" }, note: ok ? `i == len(pattern) and a word ends at "${esc(wordAt(T, u))}": return <b>True</b>. Every caller returns True immediately, so the rest of the trie is never visited.` : `The whole pattern is consumed but "${esc(wordAt(T, u))}" is only a prefix (end_count = 0): return False.` }));
          if (!ok) dead.add(u);
          stack.pop();
          return ok;
        }
        const c = q[i];
        if (c === ".") {
          const ks = kids(T, u);
          fr.push(snap({ cur: u, i, line: [3, 4, 5], vars: { i, ch: "'.'", children: ks.map((v) => T.chr[v]).join(" ") || "none" }, note: `pattern[${i}] is '.', so try every child of ${u === 0 ? "the root" : `"${esc(wordAt(T, u))}"`} in turn: ${ks.length ? ks.map((v) => `'${T.chr[v]}'`).join(", ") : "there are none"}.` }));
          for (const v of ks) {
            if (dfs(v, i + 1)) { stack.pop(); return true; }
            fr.push(snap({ cur: u, i, line: [5, 6], vars: { i, "tried": `'${T.chr[v]}'`, result: "False" }, note: `Back at ${u === 0 ? "the root" : `"${esc(wordAt(T, u))}"`}: the '${T.chr[v]}' branch failed, so pop it off the stack and try the next child.` }));
          }
          dead.add(u);
          fr.push(snap({ cur: u, i, line: 7, vars: { i, returns: "False" }, note: `Every child failed, so this call returns False to its caller.` }));
          stack.pop();
          return false;
        }
        const v = T.ch[u][c];
        if (v === undefined) {
          dead.add(u);
          fr.push(snap({ cur: u, i, miss: c, line: 8, vars: { i, ch: `'${c}'`, returns: "False" }, note: `pattern[${i}] = '${c}', but ${u === 0 ? "the root" : `"${esc(wordAt(T, u))}"`} has no '${c}' child: return False. Only this branch dies; the caller may still try others.` }));
          stack.pop();
          return false;
        }
        fr.push(snap({ cur: u, i, line: [3, 9], vars: { i, ch: `'${c}'` }, note: `pattern[${i}] = '${c}' is a plain letter, so there is exactly one way on: follow the '${c}' child.` }));
        const ok = dfs(v, i + 1);
        if (!ok) dead.add(u);
        stack.pop();
        return ok;
      };
      const found = dfs(0, 0);
      fr.push(snap({ cur: null, i: q.length, final: true, found, line: 10, vars: { result: found ? "True" : "False", "dfs calls": calls }, note: found ? `Result: <b>True</b> after ${calls} calls. The highlighted path is the first matching word in alphabetical branch order.` : `Result: <b>False</b> after ${calls} calls: every branch died. Worst case a pattern of all dots visits every node of depth ≤ len(pattern), which is why LC 211 caps the number of dots.` }));
      return fr;
    },
    render: (f) => {
      const on = new Set(f.stack.map((s) => s.u));
      const sp = f.stack.map((s) => s.u);
      const pE = pathEdges(sp);
      return row(
        col(
          draw(f.T, {
            lay: f.lay, isEnd: (id) => f.T.end[id] > 0,
            cls: (id) => (f.ok && on.has(id) ? "done" : id === f.cur ? (f.miss ? "bad" : "active") : on.has(id) ? "visit" : f.dead.has(id) ? "bad" : ""),
            ecls: (u, v) => (pE.has(`${u}-${v}`) ? (f.ok ? "done" : "visit") : ""),
          }),
          letters(`pattern "${f.q}"`, f.q, (i) => (i < f.i ? "done" : i === f.i ? (f.miss ? "bad" : "active") : ""), f.i >= 0 && f.i < f.q.length ? { i: f.i } : {}),
        ),
        stackHtml(f.stack.map((s, k) => ({ t: s.t, s: k === f.stack.length - 1 && s.i < f.q.length ? `next '${f.q[s.i]}'` : "", cls: f.ok ? "done" : undefined }))),
      );
    },
  }));

  /* ======================================================================
     4. Delete: decrement counts on the way down, cut the branch where pass hits 0
     ====================================================================== */
  Viz.register(P("delete"), (el, opts) => Viz.player(el, {
    title: "Delete: decrement, and cut the first branch nobody else uses",
    tag: "COUNT-BASED ERASE",
    legend: [["active", "current node"], ["visit", "count decremented"], ["bad", "branch cut off"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def erase(self, word):",
      "    if self.count_words_equal_to(word) == 0: return   # not stored",
      "    node = self.root",
      "    node.pass_count -= 1",
      "    for ch in word:",
      "        child = node.children[ch]",
      "        child.pass_count -= 1",
      "        if child.pass_count == 0:",
      "            del node.children[ch]       # nobody else uses this branch",
      "            return",
      "        node = child",
      "    node.end_count -= 1",
    ],
    inputs: [
      { key: "words", label: "dictionary", value: opts.words || "car,cart,care,cat,dog", width: 220 },
      { key: "erase", label: "erase, in order", value: opts.erase || "cart,car,dog,ca", width: 160 },
    ],
    random: () => { const ws = randWords(6); return { words: ws.join(","), erase: shuffle([...ws]).slice(0, 2).concat(pick(["ca", "do", "zz", "te"])).join(",") }; },
    build: ({ words: text, erase }) => {
      const ws = words(text, { max: 8, maxLen: 7 });
      const es = words(erase, { max: 4, maxLen: 7, dedupe: false, what: "words to erase" });
      const T = trieOf(ws), lay = layOf(T), fr = [];
      const gone = new Set();
      const snap = (x) => ({ T, lay, pass: [...T.pass], end: [...T.end], gone: new Set(gone), es, ...x });
      fr.push(snap({ ei: -1, path: [], line: 0, vars: { stored: ws.length }, note: `The trie holds ${ws.length} words with pass/end counts. Erasing walks the word once, decrementing pass counts. The first node whose pass count drops to 0 is used by no other word, so it is cut together with everything below it.` }));
      es.forEach((w, ei) => {
        let u = 0;
        for (const c of w) { u = u === null || u === undefined ? u : T.ch[u][c]; if (u === undefined) break; }
        const present = u !== undefined && T.end[u] > 0;
        if (!present) {
          fr.push(snap({ ei, path: [], line: 1, vars: { erase: w, stored: "no" }, note: `Erase "<b>${esc(w)}</b>": ${u === undefined ? "the walk falls off the trie" : `the path exists but end_count = 0 (it is only a prefix)`}, so "${esc(w)}" is not stored. Return without touching any count. Skipping this check would corrupt the counts.` }));
          return;
        }
        u = 0; T.pass[0]--;
        const path = [0];
        fr.push(snap({ ei, cur: 0, path: [0], line: [1, 2, 3], vars: { erase: w, "root.pass": T.pass[0] }, note: `Erase "<b>${esc(w)}</b>": it is stored, so start at the root and decrement its pass count to ${T.pass[0]}.` }));
        let cut = false;
        for (const c of w) {
          const v = T.ch[u][c];
          T.pass[v]--; path.push(v);
          if (T.pass[v] === 0) {
            const sub = subtree(T, v);
            fr.push(snap({ ei, cur: v, path: [...path], doomed: sub, line: [5, 6, 7, 8], vars: { erase: w, ch: c, pass: 0, cut: sub.size + " nodes" }, note: `'${c}': pass drops to <b>0</b>. No other word goes through here, so delete the whole branch (${sub.size} node${sub.size > 1 ? "s" : ""}) by removing one pointer from its parent. Garbage collection frees the rest.` }));
            sub.forEach((x) => gone.add(x));
            delete T.ch[u][c];
            cut = true;
            fr.push(snap({ ei, cur: u, path: path.slice(0, -1), line: 9, vars: { erase: w, "nodes left": T.chr.length - gone.size }, note: `Branch removed. Nothing below it needs an end_count update because those nodes are gone.` }));
            break;
          }
          fr.push(snap({ ei, cur: v, path: [...path], line: [5, 6, 10], vars: { erase: w, ch: c, pass: T.pass[v] }, note: `'${c}': pass ${T.pass[v] + 1} becomes ${T.pass[v]}. Still used by ${T.pass[v]} other word${T.pass[v] > 1 ? "s" : ""}, so keep it and step down.` }));
          u = v;
        }
        if (!cut) {
          T.end[u]--;
          fr.push(snap({ ei, cur: u, path: [...path], line: 11, vars: { erase: w, "end_count": T.end[u] }, note: `Reached the last letter with the node still in use (other words continue below it). Just decrement end_count to ${T.end[u]}: "${esc(w)}" is no longer a word, but the prefix stays for the longer words.` }));
        }
      });
      fr.push(snap({ ei: es.length, path: [], line: 0, vars: { "nodes left": T.chr.length - gone.size }, note: `All erases done. Each one cost O(len(word)). Compare with the recursive delete in the article, which cleans up bottom-up when the node has no children and no end mark.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pE = pathEdges(f.path);
      const T = { ...f.T, pass: f.pass, end: f.end };
      const last = f.path[f.path.length - 1];
      return col(
        draw(f.T, {
          lay: f.lay, vis: (id) => !f.gone.has(id), sub: pe(T), isEnd: (id) => f.end[id] > 0,
          cls: (id) => (f.doomed && f.doomed.has(id) ? "bad" : id === f.cur && id === last ? "active" : path.has(id) ? "visit" : ""),
          ecls: (u, v) => (f.doomed && f.doomed.has(v) ? "bad" : pE.has(`${u}-${v}`) ? "visit" : ""),
        }),
        chips("erase queue", f.es, (x, i) => (i < f.ei ? "done" : i === f.ei ? "active" : "dim")),
      );
    },
  }));

  /* ======================================================================
     5. Search suggestions (LC 1268): walk one letter further, DFS for the first 3 words
     ====================================================================== */
  Viz.register(P("autocomplete"), (el, opts) => Viz.player(el, {
    title: "Autocomplete: each keystroke is one step down, then a tiny DFS",
    tag: "LC 1268 · TOP 3 IN ORDER",
    legend: [["active", "prefix node"], ["visit", "prefix path"], ["path", "subtree = all completions"], ["done", "suggested"], ["bad", "fell off: no completions"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def suggested_products(products, search_word):",
      "    trie = Trie(); [trie.insert(p) for p in products]",
      "    node, out, prefix = trie.root, [], ''",
      "    for ch in search_word:",
      "        prefix += ch",
      "        node = node.children.get(ch) if node else None",
      "        if node is None: out.append([]); continue  # nothing below",
      "        found = []",
      "        dfs(node, prefix, found)   # children a..z, stop at 3 words",
      "        out.append(found)",
      "    return out",
    ],
    inputs: [
      { key: "words", label: "products", value: opts.words || "mobile,mouse,moneypot,monitor,mousepad", width: 300 },
      { key: "q", label: "typed word", value: opts.q || "mouse", width: 110 },
    ],
    random: () => { const ws = randWords(Viz.rand(6, 8)); const w = pick(ws); return { words: ws.join(","), q: Math.random() < 0.7 ? w : w.slice(0, 2) + "x" }; },
    build: ({ words: text, q: qt }) => {
      const ws = words(text, { max: 8, maxLen: 8, what: "products" });
      const q = word(qt, "the typed word", { maxLen: 8 });
      const T = trieOf(ws), lay = layOf(T, { dx: 40 }), fr = [];
      const out = [];
      const snap = (x) => ({ T, lay, q, out: out.map((r) => [...r]), ...x });
      fr.push(snap({ k: -1, path: [0], line: [1, 2], vars: { products: ws.length, typed: q }, note: `Put every product in a trie. After each keystroke the prefix grows by one letter, so the prefix node moves <b>one step down</b> from where it was: no re-walk from the root. All completions of a prefix live in the subtree under its node.` }));
      let u = 0; const path = [0];
      for (let k = 0; k < q.length; k++) {
        const pre = q.slice(0, k + 1), c = q[k];
        const v = u === null ? undefined : T.ch[u][c];
        if (v === undefined) {
          const first = u !== null;
          u = null; out.push([]);
          fr.push(snap({ k, path: [...path], fell: first, line: [4, 5, 6], vars: { prefix: pre, node: "None", suggestions: "[]" }, note: first ? `Type '${c}': no child '${c}', so no product starts with "${esc(pre)}". The node becomes None and stays None for every later keystroke: each one appends [] in O(1).` : `Type '${c}': node is already None, so append [] immediately.` }));
          continue;
        }
        u = v; path.push(v);
        const sub = subtree(T, u);
        fr.push(snap({ k, path: [...path], cur: u, sub, line: [3, 4, 5], vars: { prefix: pre, node: `'${c}'`, "words below": T.pass[u] }, note: `Type '${c}': step to the child, prefix "${esc(pre)}". ${T.pass[u]} product${T.pass[u] > 1 ? "s" : ""} live${T.pass[u] > 1 ? "" : "s"} in the highlighted subtree. A preorder DFS that visits children in a..z order meets them in sorted order, so the first 3 it finds are the answer.` }));
        const found = [], foundIds = [];
        const dfs = (x) => {
          if (found.length === 3) return;
          if (T.end[x]) {
            found.push(wordAt(T, x)); foundIds.push(x);
            fr.push(snap({ k, path: [...path], cur: u, sub, hitPath: pathTo(T, x), found: [...foundIds], line: 8, vars: { prefix: pre, found: found.length, word: found[found.length - 1] }, note: `DFS reaches an end mark: "<b>${esc(found[found.length - 1])}</b>" is suggestion ${found.length}.${found.length === 3 ? " That is 3, so the DFS stops right here and skips the rest of the subtree." : ""}` }));
          }
          for (const y of kids(T, x)) { if (found.length === 3) return; dfs(y); }
        };
        dfs(u);
        out.push([...found]);
        fr.push(snap({ k, path: [...path], cur: u, sub, found: [...foundIds], line: 9, vars: { prefix: pre, suggestions: `[${found.join(", ")}]` }, note: `Suggestions for "${esc(pre)}": ${found.map((x) => `"${esc(x)}"`).join(", ")}.${T.pass[u] > 3 ? ` ${T.pass[u] - 3} more product${T.pass[u] - 3 > 1 ? "s" : ""} below were never visited.` : ""}` }));
      }
      fr.push(snap({ k: q.length, path: [...path], cur: u, line: 10, vars: { keystrokes: q.length }, note: `Done: one list per keystroke. For huge catalogs, store the top 3 words <i>at every node</i> during insert, and each keystroke becomes O(1) after the step down.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pE = pathEdges(f.path), hp = pathEdges(f.hitPath || []), fd = new Set(f.found || []);
      const res = f.out.map((r, i) => `<div class="tr-resrow"><span class="tr-pre">${esc(f.q.slice(0, i + 1))}</span>${r.length ? r.map((w) => `<span class="tr-chip done">${esc(w)}</span>`).join("") : '<span class="tr-chip bad">[ ]</span>'}</div>`).join("");
      return col(
        draw(f.T, {
          lay: f.lay, r: 15, isEnd: (id) => f.T.end[id] > 0,
          cls: (id) => (fd.has(id) ? "done" : f.fell && id === f.path[f.path.length - 1] ? "bad" : id === f.cur ? "active" : path.has(id) ? "visit" : f.sub && f.sub.has(id) ? "path" : ""),
          ecls: (u, v) => (pE.has(`${u}-${v}`) ? "visit" : hp.has(`${u}-${v}`) ? "done" : f.sub && f.sub.has(u) && f.sub.has(v) ? "path" : ""),
        }),
        letters(`typed "${f.q}"`, f.q, (i) => (i < f.k ? "done" : i === f.k ? (f.out[i] && !f.out[i].length ? "bad" : "active") : "")),
        `<div class="v-labeled"><span class="v-caption">answer so far (one row per keystroke)</span><div class="tr-res">${res || '<span class="tr-none">nothing typed yet</span>'}</div></div>`,
      );
    },
  }));

  /* ======================================================================
     6. Word Search II (LC 212): one DFS over the grid walks the trie in lock-step
     ====================================================================== */
  function parseBoard(text) {
    const rows = toks(text).map((r) => r.toLowerCase());
    if (!rows.length) throw new Error("Enter the board as rows separated by commas, e.g. oaan,etae,ihkr.");
    if (rows.length > 4) throw new Error("Use at most 4 rows.");
    for (const r of rows) {
      if (!/^[a-z]+$/.test(r)) throw new Error(`Row "${r}" must use only letters a–z.`);
      if (r.length !== rows[0].length) throw new Error("Every row needs the same number of letters.");
    }
    if (rows[0].length > 4) throw new Error("Use at most 4 columns.");
    return rows.map((r) => r.split(""));
  }
  const DIRS = [[-1, 0], [0, 1], [1, 0], [0, -1]];
  Viz.register(P("wordsearch"), (el, opts) => Viz.player(el, {
    title: "Word Search II: the grid DFS and the trie walk move together",
    tag: "LC 212 · TRIE + BACKTRACKING",
    legend: [["active", "current cell / node"], ["visit", "current path (marked #)"], ["done", "word found"], ["bad", "pruned leaf"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def find_words(board, words):",
      "    root = build_trie(words)          # node.word set at word ends",
      "    for r, c in all cells: dfs(r, c, root)",
      "def dfs(r, c, parent):",
      "    ch = board[r][c]",
      "    node = parent.children.get(ch)",
      "    if node is None: return            # no word continues with ch: prune",
      "    if node.word: found.append(node.word); node.word = None",
      "    board[r][c] = '#'                  # on the current path",
      "    for nr, nc in neighbours(r, c): dfs(nr, nc, node)",
      "    board[r][c] = ch                   # restore when backtracking",
      "    if not node.children: del parent.children[ch]   # leaf pruning",
    ],
    inputs: [
      { key: "board", label: "board rows", value: opts.board || "oaan,etae,ihkr,iflv", width: 170 },
      { key: "words", label: "words", value: opts.words || "oath,pea,eat,rain", width: 200 },
    ],
    random: () => {
      const R = Viz.rand(3, 4), C = Viz.rand(3, 4), L = "aeiorstnld";
      const B = Array.from({ length: R }, () => Array.from({ length: C }, () => pick(L.split(""))));
      const ws = new Set();
      for (let t = 0; t < 3; t++) {
        let r = Viz.rand(0, R - 1), c = Viz.rand(0, C - 1); const seen = new Set([`${r},${c}`]); let w = B[r][c];
        const len = Viz.rand(3, 5);
        while (w.length < len) {
          const nb = DIRS.map(([a, b]) => [r + a, c + b]).filter(([x, y]) => x >= 0 && y >= 0 && x < R && y < C && !seen.has(`${x},${y}`));
          if (!nb.length) break;
          [r, c] = pick(nb); seen.add(`${r},${c}`); w += B[r][c];
        }
        ws.add(w);
      }
      ws.add(pick(BANK).slice(0, 5));
      return { board: B.map((r) => r.join("")).join(","), words: [...ws].join(",") };
    },
    build: ({ board, words: text }) => {
      const B = parseBoard(board), R = B.length, C = B[0].length;
      const ws = words(text, { max: 6, maxLen: 7 });
      const T = trieOf(ws), lay = layOf(T, { dx: 40 }), fr = [];
      const gone = new Set(), found = [], foundIds = new Set();
      const cells = [], nodes = [0];
      const snap = (x) => ({ T, lay, end: [...T.end], B: B.map((r) => [...r]), R, C, gone: new Set(gone), found: [...found], foundIds: new Set(foundIds), cells: [...cells], nodes: [...nodes], ...x });
      const guard = () => { if (fr.length > 700) throw new Error("This board and word list need too many steps to animate. Try a smaller board or fewer words."); };
      fr.push(snap({ line: [0, 1], vars: { board: `${R}×${C}`, words: ws.length }, note: `Build one trie of all ${ws.length} words. Then start a DFS from every cell, holding a trie node in hand: a step onto a letter is allowed only if the current trie node has a child for that letter. One DFS searches for <b>every word at once</b>.` }));
      const dfs = (r, c, p) => {
        guard();
        const ch = B[r][c], u = T.ch[p][ch];
        if (u === undefined) return;
        cells.push([r, c]); nodes.push(u);
        const pre = nodes.slice(1).map((x) => T.chr[x]).join("");
        if (T.end[u]) {
          T.end[u] = 0; const w = wordAt(T, u); found.push(w); foundIds.add(u);
          fr.push(snap({ cur: [r, c], hit: true, line: 7, vars: { cell: `(${r},${c})`, path: pre, found: w }, note: `"${esc(pre)}" ends a word: <b>found "${esc(w)}"</b>. Clear node.word so the same word is not reported again from another path.` }));
        } else fr.push(snap({ cur: [r, c], line: [4, 5, 8], vars: { cell: `(${r},${c})`, path: pre, children: Object.keys(T.ch[u]).sort().join(" ") || "none" }, note: `(${r},${c}) = '${ch}' continues the prefix "<b>${esc(pre)}</b>". Mark the cell '#' and look for neighbours whose letter is one of this node's children: ${Object.keys(T.ch[u]).sort().map((x) => `'${x}'`).join(", ") || "none"}. Every other neighbour is cut off at once.` }));
        B[r][c] = "#";
        for (const [a, b] of DIRS) { const nr = r + a, nc = c + b; if (nr >= 0 && nc >= 0 && nr < R && nc < C && B[nr][nc] !== "#") dfs(nr, nc, u); }
        B[r][c] = ch;
        if (!Object.keys(T.ch[u]).length) {
          delete T.ch[p][ch]; gone.add(u);
          fr.push(snap({ cur: [r, c], pruned: u, line: [10, 11], vars: { cell: `(${r},${c})`, removed: `'${wordAt(T, u)}'` }, note: `Backtrack from (${r},${c}) and restore '${ch}'. The trie node "${esc(wordAt(T, u))}" now has no children and no word, so <b>delete it</b> from its parent. Future searches will not even try this branch: the trie shrinks as words are found.` }));
        }
        cells.pop(); nodes.pop();
      };
      for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
        if (T.ch[0][B[r][c]] === undefined) { fr.push(snap({ start: [r, c], line: [2, 5, 6], vars: { start: `(${r},${c})`, letter: B[r][c] }, note: `Start at (${r},${c}) = '${B[r][c]}': no remaining word begins with '${B[r][c]}', so this start dies in O(1).` })); continue; }
        dfs(r, c, 0);
      }
      fr.push(snap({ line: 2, vars: { found: found.length, "of words": ws.length }, note: `Done: found <b>${found.length ? found.join(", ") : "nothing"}</b>. Without the trie we would run a separate grid search per word; with it, branches die as soon as the path stops being a prefix of any remaining word.` }));
      return fr;
    },
    render: (f) => {
      const onPath = new Set(f.cells.map(([r, c]) => `${r},${c}`)), cur = f.cur && `${f.cur[0]},${f.cur[1]}`;
      const nodes = new Set(f.nodes), pE = pathEdges(f.nodes), last = f.nodes[f.nodes.length - 1];
      const grid = Viz.grid(f.B, { label: "board ('#' = on the current path)", rowLabels: f.B.map((_, i) => i), colLabels: f.B[0].map((_, i) => i), cls: (r, c) => (`${r},${c}` === cur ? (f.hit ? "done" : "active") : onPath.has(`${r},${c}`) ? "visit" : f.start && f.start[0] === r && f.start[1] === c ? "bad" : ""), fmt: (v, r, c) => (onPath.has(`${r},${c}`) && `${r},${c}` !== cur ? "#" : v) });
      return row(
        col(grid, chips("found", f.found, () => "done")),
        draw(f.T, {
          lay: f.lay, r: 15, vis: (id) => !f.gone.has(id) || id === f.pruned, isEnd: (id) => f.end[id] > 0,
          cls: (id) => (id === f.pruned ? "bad" : f.hit && id === last ? "done" : id === last && id !== 0 ? "active" : nodes.has(id) && id !== 0 ? "visit" : ""),
          ecls: (u, v) => (v === f.pruned ? "bad" : pE.has(`${u}-${v}`) ? "visit" : ""),
          label: "trie of remaining words",
        }),
      );
    },
  }));

  /* ======================================================================
     7. Maximum XOR (LC 421): a binary trie, greedy from the highest bit
     ====================================================================== */
  const bin = (x, B) => x.toString(2).padStart(B, "0");
  Viz.register(P("xor"), (el, opts) => Viz.player(el, {
    title: "Max XOR: at every bit, try to go the opposite way",
    tag: "LC 421 · BINARY TRIE",
    legend: [["active", "current node / bit"], ["visit", "path taken"], ["done", "opposite bit found (+2^b)"], ["bad", "forced same bit (+0)"], ["path", "x's own path"]],
    codeLang: "python",
    code: [
      "def find_maximum_xor(nums):",
      "    B = max(nums).bit_length()",
      "    root = {}",
      "    for x in nums:                      # insert bits, highest first",
      "        node = root",
      "        for b in range(B - 1, -1, -1):",
      "            node = node.setdefault((x >> b) & 1, {})",
      "    best = 0",
      "    for x in nums:                      # greedy query",
      "        node, cur = root, 0",
      "        for b in range(B - 1, -1, -1):",
      "            bit = (x >> b) & 1",
      "            if 1 - bit in node: cur |= 1 << b; node = node[1 - bit]",
      "            else:               node = node[bit]",
      "        best = max(best, cur)",
      "    return best",
    ],
    inputs: [{ key: "nums", label: "nums (0..63)", value: opts.nums || "3,10,5,25,2,8", width: 200 }],
    random: () => ({ nums: Array.from({ length: Viz.rand(4, 7) }, () => Viz.rand(0, 63)).join(",") }),
    build: ({ nums }) => {
      const a = toks(nums).map((t) => { const v = Number(t); if (!Number.isInteger(v) || v < 0 || v > 63) throw new Error(`"${t}" must be a whole number from 0 to 63.`); return v; });
      if (a.length < 2) throw new Error("Enter at least 2 numbers.");
      if (a.length > 8) throw new Error("Use at most 8 numbers so the trie stays readable.");
      const B = Math.max(1, Math.max(...a).toString(2).length);
      const T = newTrie(); const leafOf = [];
      a.forEach((x) => { let u = 0; for (let b = B - 1; b >= 0; b--) { const c = String((x >> b) & 1); if (T.ch[u][c] === undefined) addNode(T, u, c); u = T.ch[u][c]; } leafOf.push(u); });
      const lay = Viz.layoutTree(0, (id) => [T.ch[id]["0"] ?? null, T.ch[id]["1"] ?? null], (id) => T.chr[id], { dx: 38, dy: 52 });
      const vals = {}; a.forEach((x, i) => { (vals[leafOf[i]] ||= []).includes(x) || vals[leafOf[i]].push(x); });
      const fr = [];
      let made = 1, best = 0, bestPair = null;
      const snap = (x) => ({ T, lay, a, B, made, vals, best, bestPair, ...x });
      fr.push(snap({ phase: 0, line: [0, 1, 2], vars: { B, nums: a.length }, note: `Write every number with B = ${B} bits (the bit length of the max, ${Math.max(...a)}). XOR sets a bit to 1 exactly where two numbers <i>differ</i>. Since 2<sup>b</sup> is larger than all lower bits together (2<sup>b</sup> &gt; 2<sup>b</sup> − 1), winning a higher bit beats any combination of lower bits: decide greedily from the top.` }));
      a.forEach((x, i) => {
        const p = pathTo(T, leafOf[i]);
        made = Math.max(made, ...p.map((u) => u + 1));
        fr.push(snap({ phase: 1, xi: i, path: p, line: [3, 4, 5, 6], vars: { x, bits: bin(x, B) }, note: `Insert ${x} = <b>${bin(x, B)}</b>: from the root take the 0-child or 1-child for each bit, highest first. Left edge = 0, right edge = 1. Numbers sharing high bits share a path.` }));
      });
      a.forEach((x, i) => {
        let u = 0, cur = 0; const path = [0], got = [];
        fr.push(snap({ phase: 2, xi: i, path: [0], own: pathTo(T, leafOf[i]), got: [], cur, line: [8, 9], vars: { x, bits: bin(x, B), cur: 0, best }, note: `Query x = ${x} (${bin(x, B)}). Walk from the root; at every bit we <b>want the opposite</b> bit, because that puts a 1 into the XOR.` }));
        for (let b = B - 1; b >= 0; b--) {
          const bit = (x >> b) & 1, want = String(1 - bit), v = T.ch[u][want];
          if (v !== undefined) { cur |= 1 << b; u = v; got.push(1); } else { u = T.ch[u][String(bit)]; got.push(0); }
          path.push(u);
          fr.push(snap({ phase: 2, xi: i, b, path: [...path], own: pathTo(T, leafOf[i]), got: [...got], cur, line: v !== undefined ? [10, 11, 12] : [10, 11, 13], vars: { x, b, bit, want: Number(want), cur: `${bin(cur, B)} = ${cur}`, best }, note: v !== undefined ? `Bit ${b}: x has ${bit}, we want ${want}, and a ${want}-child exists. Take it: XOR bit ${b} becomes 1 (+${1 << b}). cur = ${cur}.` : `Bit ${b}: x has ${bit}, we want ${want}, but no number with this prefix has a ${want} here. Forced to follow ${bit}: XOR bit ${b} is 0. Greedy is still right, because no choice could have made this bit 1.` }));
        }
        const partner = vals[u][0];
        const up = cur > best;
        if (up) { best = cur; bestPair = [x, partner]; }
        fr.push(snap({ phase: 2, xi: i, path: [...path], own: pathTo(T, leafOf[i]), got: [...got], cur, partner, line: 14, vars: { x, partner, "x ^ partner": cur, best }, note: `The walk ends at the leaf for ${partner} (${bin(partner, B)}): ${x} ^ ${partner} = <b>${cur}</b>, the best partner for ${x}. ${up ? `New best = ${best}.` : `Best stays ${best}.`} Each query costs B = ${B} steps, so the whole run is O(n·B) instead of O(n²).` }));
      });
      fr.push(snap({ phase: 3, path: bestPair ? [] : [], line: 15, vars: { answer: best, pair: bestPair ? `${bestPair[0]} ^ ${bestPair[1]}` : "-" }, note: `Answer: <b>${best}</b>${bestPair ? ` from ${bestPair[0]} ^ ${bestPair[1]} = ${bin(bestPair[0], B)} ^ ${bin(bestPair[1], B)} = ${bin(best, B)}` : ""}.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path || []), pE = pathEdges(f.path || []), own = new Set(f.own || []), oE = pathEdges(f.own || []);
      const last = (f.path || [])[(f.path || []).length - 1];
      const vis = (id) => id < f.made || f.phase >= 2;
      const nodes = f.lay.nodes.map((nd) => ({ ...nd, label: nd.id === 0 ? "" : nd.label, top: nd.id === 0 ? "root" : undefined, sub: f.vals[nd.id] && vis(nd.id) ? f.vals[nd.id].join(",") : undefined }));
      const g = Viz.graph({ nodes, edges: f.lay.edges }, {
        r: 15,
        label: "binary trie (left = 0, right = 1)",
        nodeCls: (id) => {
          id = Number(id); if (!vis(id)) return "tr-hide";
          if (f.phase === 1) return id === last ? "done" : path.has(id) ? "visit" : "";
          if (f.phase === 2) { const d = f.T.dep[id]; return path.has(id) && id !== 0 ? (id === last && f.partner === undefined ? "active" : f.got[d - 1] ? "done" : "bad") : own.has(id) && id !== 0 ? "path" : ""; }
          return "";
        },
        edgeCls: (k) => { const [u, v] = k.split("-").map(Number); if (f.T.par[v] !== u) return ""; if (!vis(v)) return "tr-hide"; if (pE.has(k)) return f.phase === 2 ? (f.got[f.T.dep[v] - 1] ? "done" : "bad") : "visit"; return oE.has(k) ? "path" : ""; },
      });
      const cols = Array.from({ length: f.B }, (_, j) => f.B - 1 - j);
      const grid = Viz.grid(f.a.map((x) => bin(x, f.B).split("")), {
        label: "nums in binary", rowLabels: f.a, colLabels: cols.map((b) => `b${b}`), corner: "x",
        cls: (r, c) => { const b = f.B - 1 - c; if (f.xi === r && f.phase >= 1) return f.b === b ? "active" : "visit"; if (f.partner !== undefined && f.a[r] === f.partner) return "done"; if (f.phase === 3 && f.bestPair && (f.a[r] === f.bestPair[0] || f.a[r] === f.bestPair[1])) return "done"; return ""; },
      });
      const curBits = f.phase === 2 ? letters("x ^ partner, built bit by bit", cols.map((b, j) => (j < f.got.length ? String(f.got[j]) : "?")).join(""), (j) => (j < f.got.length ? (f.got[j] ? "done" : "bad") : "")) : "";
      return row(g, col(grid, curBits));
    },
  }));

  /* ======================================================================
     8. Radix tree: chains of single children collapse into one labelled edge
     ====================================================================== */
  const lcp = (a, b) => { let k = 0; while (k < a.length && k < b.length && a[k] === b[k]) k++; return k; };
  Viz.register(P("radix"), (el, opts) => Viz.player(el, {
    title: "Radix tree: one edge per run of letters, split when words diverge",
    tag: "COMPRESSED TRIE",
    legend: [["active", "current node"], ["visit", "edges followed"], ["done", "new edge or leaf"], ["bad", "edge being split"], ["tr-end", "a word ends here"]],
    codeLang: "python",
    code: [
      "def insert(node, word):",
      "    while word:",
      "        edge = node.edges.get(word[0])      # at most one edge per first letter",
      "        if edge is None:",
      "            node.edges[word[0]] = (word, Node()); node = ...; break  # one new edge",
      "        label, child = edge",
      "        k = common_prefix_len(label, word)",
      "        if k < len(label):                  # diverge inside the edge: split it",
      "            mid = Node(); mid.edges[label[k]] = (label[k:], child)",
      "            node.edges[word[0]] = (label[:k], mid); child = mid",
      "        node, word = child, word[k:]",
      "    node.is_word = True",
    ],
    inputs: [{ key: "words", label: "words (in order)", value: opts.words || "romane,romanus,romulus,rubens,ruber,rubicon", width: 330 }],
    random: () => ({ words: randWords(Viz.rand(5, 7)).join(",") }),
    build: ({ words: text }) => {
      const ws = words(text, { max: 7, maxLen: 8 });
      const R = { ch: [{}], chr: [""], par: [-1], end: [0] };
      const nn = (p, lab) => { R.ch.push({}); R.chr.push(lab); R.par.push(p); R.end.push(0); const id = R.chr.length - 1; if (p >= 0) R.ch[p][lab[0]] = id; return id; };
      const fr = [];
      const snap = (x) => ({ R: { ch: R.ch.map((o) => ({ ...o })), chr: [...R.chr], par: [...R.par], end: [...R.end] }, ws, ...x });
      fr.push(snap({ wi: -1, path: [0], line: 0, vars: { words: ws.length }, note: `A plain trie spends one node per letter, even along long chains where each node has a single child. A <b>radix tree</b> (compressed trie, Patricia trie) stores such a chain as one edge with a string label. Every internal node then branches (or ends a word).` }));
      ws.forEach((w, wi) => {
        let u = 0, rest = w; const path = [0];
        fr.push(snap({ wi, path: [0], cur: 0, rest, line: [0, 1], vars: { word: w, rest } , note: `Insert "<b>${esc(w)}</b>".` }));
        while (rest) {
          let e = R.ch[u][rest[0]];
          if (e === undefined) {
            const v = nn(u, rest); path.push(v); R.end[v] = 1;
            fr.push(snap({ wi, path: [...path], cur: v, born: v, line: [2, 3, 4], vars: { word: w, "new edge": rest }, note: `No edge from here starts with '${rest[0]}', so hang the <b>whole rest "${esc(rest)}" on one new edge</b> to a new leaf. A plain trie would add ${rest.length} node${rest.length > 1 ? "s" : ""} here; the radix tree adds 1.` }));
            rest = ""; u = v; break;
          }
          const lab = R.chr[e], k = lcp(lab, rest);
          if (k < lab.length) {
            fr.push(snap({ wi, path: [...path], cur: u, splitE: e, line: [5, 6, 7], vars: { word: w, edge: lab, rest, k }, note: `Edge "${esc(lab)}" and the rest "${esc(rest)}" agree on only ${k} letter${k > 1 ? "s" : ""} ("${esc(lab.slice(0, k))}"), then differ. The word leaves in the middle of the edge, so the edge must be <b>split</b> there.` }));
            const mid = nn(u, lab.slice(0, k));
            R.chr[e] = lab.slice(k); R.par[e] = mid; R.ch[mid][lab[k]] = e;
            path.push(mid);
            fr.push(snap({ wi, path: [...path], cur: mid, born: mid, line: [8, 9], vars: { word: w, top: lab.slice(0, k), bottom: lab.slice(k) }, note: `Split: a new node sits after "${esc(lab.slice(0, k))}" and the old subtree hangs below it on "${esc(lab.slice(k))}". Nothing else moves.` }));
            u = mid;
          } else {
            path.push(e);
            fr.push(snap({ wi, path: [...path], cur: e, line: [5, 6, 10], vars: { word: w, edge: lab, consumed: k } , note: `The whole edge "${esc(lab)}" matches, so follow it and consume ${k} letter${k > 1 ? "s" : ""} in one step.` }));
            u = e;
          }
          rest = rest.slice(k);
        }
        R.end[u] = 1;
        if (fr[fr.length - 1].born !== u) fr.push(snap({ wi, path: [...path], cur: u, line: 11, vars: { word: w }, note: `The word ends exactly at a node: mark it as a word end.` }));
      });
      const plain = trieOf(ws), pn = plain.chr.length - 1, rn = R.chr.length - 1;
      fr.push(snap({ wi: ws.length, path: [], plain, line: 11, vars: { "trie nodes": pn, "radix nodes": rn, "saved": pn - rn }, note: `Same ${ws.length} words: the plain trie needs <b>${pn}</b> nodes, the radix tree <b>${rn}</b>. A radix tree has at most 2n − 1 nodes for n words, however long the words are. The price: edges hold strings and inserts may split them.` }));
      return fr;
    },
    render: (f) => {
      const R = f.R, path = new Set(f.path), pE = pathEdges(f.path);
      const alive = (id) => R.chr[id] !== undefined;
      const lay = Viz.layoutTree(0, (id) => { const k = Object.keys(R.ch[id]).sort().map((c) => R.ch[id][c]); return k.length === 2 ? [...k, null] : k; }, () => "", { dx: 66, dy: 62 });
      const g = draw(R, {
        lay, r: 9, lbl: () => "", ew: (u, v) => R.chr[v], isEnd: (id) => R.end[id] > 0, parent: (v) => R.par[v], vis: alive,
        cls: (id) => (id === f.born ? "done" : id === f.cur ? "active" : path.has(id) ? "visit" : ""),
        ecls: (u, v) => (v === f.splitE ? "bad" : v === f.born ? "done" : pE.has(`${u}-${v}`) ? "visit" : ""),
        label: "radix tree",
      });
      const plain = f.plain ? draw(f.plain, { r: 11, dx: 26, dy: 40, isEnd: (id) => f.plain.end[id] > 0, label: `plain trie for comparison (${f.plain.chr.length - 1} nodes)` }) : "";
      return col(g, chips("words", f.ws, (x, i) => (i < f.wi ? "done" : i === f.wi ? "active" : "dim")), plain);
    },
  }));

  /* ======================================================================
     9. Stream of characters (LC 1032): a trie of reversed words, read the stream backwards
     ====================================================================== */
  Viz.register(P("stream"), (el, opts) => Viz.player(el, {
    title: "Stream checker: does some word end at the newest letter?",
    tag: "LC 1032 · REVERSED TRIE",
    legend: [["active", "letter / node being checked"], ["visit", "matched so far (backwards)"], ["done", "a word ends here: True"], ["bad", "fell off: False"], ["dim", "too old to matter"]],
    codeLang: "python",
    code: [
      "class StreamChecker:",
      "    def __init__(self, words):",
      "        for w in words: self.insert(w[::-1])   # trie of REVERSED words",
      "        self.buf = deque(maxlen=max(map(len, words)))",
      "    def query(self, letter):",
      "        self.buf.appendleft(letter)            # newest letter first",
      "        node = self.root",
      "        for ch in self.buf:                    # read the stream backwards",
      "            node = node.children.get(ch)",
      "            if node is None: return False      # no word ends with this suffix",
      "            if node.end: return True           # some word ends right now",
      "        return False",
    ],
    inputs: [
      { key: "words", label: "words", value: opts.words || "cd,bcd,f,kl", width: 160 },
      { key: "stream", label: "stream", value: opts.stream || "abcdxfkl", width: 150 },
    ],
    random: () => { const ws = randWords(Viz.rand(3, 4)).map((w) => w.slice(0, 4)); const s = shuffle([...ws]).join("").slice(0, 10); return { words: ws.join(","), stream: s }; },
    build: ({ words: text, stream }) => {
      const ws = words(text, { max: 6, maxLen: 5 });
      const st = word(stream, "the stream", { maxLen: 12 });
      const rev = ws.map((w) => [...w].reverse().join(""));
      const T = trieOf(rev), lay = layOf(T), M = Math.max(...ws.map((w) => w.length));
      const fr = [], ans = [];
      const snap = (x) => ({ T, lay, st, M, ans: [...ans], ws, ...x });
      fr.push(snap({ t: -1, path: [0], line: [1, 2, 3], vars: { words: ws.join(","), reversed: rev.join(","), "buffer size": M }, note: `The question after each letter is "does the stream <i>end</i> with some word?" Suffixes are awkward for a trie, so store every word <b>reversed</b> (${ws.map((w, i) => `${esc(w)} as ${esc(rev[i])}`).join(", ")}). Reading the stream backwards from the newest letter turns "ends with" into "starts with". Only the last ${M} letters can matter.` }));
      for (let t = 0; t < st.length; t++) {
        let u = 0; const path = [0];
        let res = false, j = t;
        fr.push(snap({ t, j: t, path: [0], cur: 0, line: [4, 5, 6], vars: { letter: st[t], query: t }, note: `query('${st[t]}'): add it as the newest letter and start at the root.` }));
        for (; j >= 0 && t - j < M; j--) {
          const v = T.ch[u][st[j]];
          if (v === undefined) { fr.push(snap({ t, j, path: [...path], cur: u, fell: true, line: [7, 8, 9], vars: { letter: st[t], checking: st[j], "suffix tried": st.slice(j, t + 1), result: "False" }, note: `Backwards, the next letter is '${st[j]}', but no reversed word continues with it: no word ends with "${esc(st.slice(j, t + 1))}". Return <b>False</b>.` })); break; }
          u = v; path.push(v);
          if (T.end[v]) { res = true; fr.push(snap({ t, j, path: [...path], cur: v, hit: true, line: [7, 8, 10], vars: { letter: st[t], suffix: st.slice(j, t + 1), result: "True" }, note: `Reached an end mark: the stream ends with the word "<b>${esc(st.slice(j, t + 1))}</b>". Return <b>True</b> immediately.` })); break; }
          fr.push(snap({ t, j, path: [...path], cur: v, line: [7, 8], vars: { letter: st[t], suffix: st.slice(j, t + 1) }, note: `'${st[j]}' matches: the stream ends with "${esc(st.slice(j, t + 1))}", which is the end of some word but not a whole word yet. Keep reading backwards.` }));
        }
        if (!res && (j < 0 || t - j >= M) && !fr[fr.length - 1].fell) fr.push(snap({ t, j: j + 1, path: [...path], cur: u, line: 11, vars: { letter: st[t], result: "False" }, note: `Ran out of ${j < 0 ? "stream" : `buffer (only the last ${M} letters can end a word)`} without an end mark: return <b>False</b>.` }));
        ans.push(res);
      }
      fr.push(snap({ t: st.length, path: [], line: 4, vars: { trues: ans.filter(Boolean).length }, note: `Each query costs O(longest word), no matter how long the stream gets. The forward trie would have to track every possible start position at once.` }));
      return fr;
    },
    render: (f) => {
      const path = new Set(f.path), pE = pathEdges(f.path), last = f.path[f.path.length - 1];
      const strip = Viz.array(f.st.split(""), {
        label: "stream (newest on the right, read backwards)",
        cls: (i) => (f.t < 0 || i > f.t ? "dim" : i === f.j && f.t < f.st.length ? (f.fell ? "bad" : f.hit ? "done" : "active") : f.j !== undefined && i > f.j && i <= f.t && f.t < f.st.length ? "visit" : f.t - i >= f.M ? "dim" : ""),
        ptrs: f.t >= 0 && f.t < f.st.length ? { new: f.t } : {},
      });
      const answers = chips("answers so far", f.ans.map((x, i) => `${f.st[i]}: ${x ? "True" : "False"}`), (x, i) => (f.ans[i] ? "done" : ""));
      return row(
        draw(f.T, {
          lay: f.lay, isEnd: (id) => f.T.end[id] > 0, label: "trie of reversed words",
          cls: (id) => (id === last && f.hit ? "done" : id === last && f.fell ? "bad" : id === f.cur && id !== 0 ? "active" : path.has(id) && id !== 0 ? "visit" : ""),
          ecls: (u, v) => (pE.has(`${u}-${v}`) ? (f.hit && v === last ? "done" : "visit") : ""),
        }),
        col(`<div class="tr-seq">${strip}</div>`, answers),
      );
    },
  }));
})();
