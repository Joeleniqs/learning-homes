/* Data access visualizers. Every registered name is prefixed "data-access-". */
(() => {
  const esc = Viz.esc;
  const int = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: use a whole number from ${min} to ${max}.`);
    return n;
  };
  const num = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const ints = (s, label, minLen, maxLen, lo, hi) => {
    const parts = String(s ?? "").split(/[\s,]+/).filter(Boolean);
    if (parts.length < minLen || parts.length > maxLen) throw new Error(`${label}: give ${minLen}–${maxLen} numbers separated by commas.`);
    return parts.map((p) => int(p, label, lo, hi));
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const fmt = (n) => Number(n).toLocaleString("en-US");
  const ms = (x) => (x >= 1000 ? `${(x / 1000).toFixed(x >= 10000 ? 1 : 2)} s` : x >= 10 ? `${Math.round(x)} ms` : `${x.toFixed(x >= 1 ? 1 : 2)} ms`);

  const kv = (title, rows, o = {}) => `<div class="dax-kv ${o.cls || ""}"><div class="dax-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="dax-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="dax-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="dax-stats">${items.map(([l, v, c]) => `<div class="dax-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const panels = (...p) => `<div class="dax-panels">${p.filter(Boolean).join("")}</div>`;
  const verdict = (html, c) => `<div class="dax-verdict ${c || ""}">${html}</div>`;
  const col = (...p) => `<div class="dax-col">${p.filter(Boolean).join("")}</div>`;
  const fit = (html) => `<div class="dax-fit">${html}</div>`;
  /* random inputs that must pass validation: generate until test() doesn't throw */
  const retry = (gen, test, fallback) => {
    for (let i = 0; i < 60; i++) { const c = gen(); try { test(c); return c; } catch (e) { /* draw again */ } }
    return fallback;
  };
  /* small table: head [..], rows [{cells:[...], cls}] (cells are already-escaped HTML) */
  const mini = (title, head, rows, o = {}) => `<div class="dax-tbl ${o.cls || ""}">${title ? `<div class="dax-kv-h">${esc(title)}</div>` : ""}<table class="dax-mini"><tr>${head.map((h) => `<th>${esc(h)}</th>`).join("")}</tr>${
    rows.length ? rows.map((r) => `<tr class="${r.cls || ""}">${r.cells.map((c) => `<td>${c}</td>`).join("")}</tr>`).join("") : `<tr class="dim"><td colspan="${head.length}">${esc(o.empty || "empty")}</td></tr>`}</table></div>`;
  const sqlList = (title, list, o = {}) => `<div class="dax-sql">${title ? `<div class="dax-kv-h">${esc(title)}</div>` : ""}${
    list.length ? list.slice(-(o.max || 9)).map((q) => `<div class="dax-sql-r ${q.cls || ""}"><code>${esc(q.sql)}</code>${q.meta ? `<span>${esc(q.meta)}</span>` : ""}</div>`).join("")
      : `<div class="dax-sql-r dim"><code>${esc(o.empty || "nothing sent yet")}</code></div>`}</div>`;

  /* =====================================================================
   * 1. Unit of work: identity map, snapshots, DetectChanges, SaveChanges
   * ===================================================================== */
  const SEED = { 1: { name: "Mug", price: 10 }, 2: { name: "Pen", price: 2 }, 3: { name: "Cup", price: 7 } };
  function parseOps(text) {
    const raw = String(text || "").split(/[,;\n]+/).map((s) => s.trim()).filter(Boolean);
    if (!raw.length) throw new Error("operations: give at least one, e.g. find 1, set 1 price 12, save.");
    if (raw.length > 14) throw new Error("operations: 14 at most.");
    return raw.map((r) => {
      const w = r.split(/\s+/), op = w[0].toLowerCase();
      const id = () => int(w[1], `"${r}": id`, 1, 99);
      if ((op === "find" || op === "get" || op === "remove" || op === "update") && w.length === 2) return { op, id: id(), src: r };
      if (op === "set" && w.length === 4 && (w[2] === "price" || w[2] === "name")) {
        if (w[2] === "price") return { op, id: id(), field: "price", value: int(w[3], `"${r}": price`, 0, 9999), src: r };
        if (!/^[A-Za-z][\w-]{0,11}$/.test(w[3])) throw new Error(`"${r}": a name is one word of letters, up to 12 characters.`);
        return { op, id: id(), field: "name", value: w[3], src: r };
      }
      if (op === "add" && w.length === 3) {
        if (!/^[A-Za-z][\w-]{0,11}$/.test(w[1])) throw new Error(`"${r}": add NAME PRICE, NAME one word.`);
        return { op, name: w[1], price: int(w[2], `"${r}": price`, 0, 9999), src: r };
      }
      if (op === "save" && w.length === 1) return { op, src: r };
      throw new Error(`Can't read "${r}". Use: find N, get N, set N price V, set N name V, add NAME PRICE, remove N, update N, save.`);
    });
  }
  function simUow(ops, tracking) {
    const db = JSON.parse(JSON.stringify(SEED)); let nextId = 4, tmp = -1, objSeq = 0, trips = 0;
    const tracked = []; // {key, state, cur:{name,price}, snap, obj, all}
    const loose = []; // untracked objects {obj, id, cur}
    const sql = [], fr = [];
    const view = (extra) => ({ db: JSON.parse(JSON.stringify(db)), tracked: tracked.map((e) => ({ ...e, cur: { ...e.cur }, snap: e.snap && { ...e.snap }, dirty: dirtyOf(e) })), loose: loose.map((o) => ({ ...o, cur: { ...o.cur } })), sql: sql.map((q) => ({ ...q })), trips, ...extra });
    const dirtyOf = (e) => (e.state === "Added" || e.state === "Deleted" ? [] : e.all ? ["name", "price"] : ["name", "price"].filter((f) => e.snap && e.cur[f] !== e.snap[f]));
    const stateOf = (e) => (e.state === "Added" || e.state === "Deleted" ? e.state : dirtyOf(e).length ? "Modified" : "Unchanged");
    const byKey = (k) => tracked.find((e) => e.key === k);
    const select = (id) => { trips++; const row = db[id]; sql.push({ sql: `SELECT id, name, price FROM products WHERE id = ${id}`, meta: row ? "1 row" : "0 rows", cls: "cur" }); return row; };
    const target = (id) => byKey(id) || [...loose].reverse().find((o) => o.id === id);
    const code = { find: 0, get: 1, set: 2, add: 3, remove: 4, update: 5, save: 6 };
    fr.push(view({ line: [], note: `Three rows in the database. ${tracking ? "Queries are <b>tracked</b> (the EF Core / Hibernate / SQLAlchemy default): the context remembers every entity it hands you, plus a snapshot of its original values." : "Queries use <b>AsNoTracking()</b>: you get plain objects that nobody is watching. Fast for reads; nothing to save."} Step through the operations.`, vars: { tracked: 0, "round trips": 0 } }));
    sql.forEach((q) => (q.cls = ""));
    for (const o of ops) {
      sql.forEach((q) => (q.cls = ""));
      let note = "", bad = false;
      if (o.op === "find") {
        const e = byKey(o.id);
        if (e && e.state === "Deleted") throw new Error(`"${o.src}": product ${o.id} is marked Deleted; save first.`);
        if (e) note = `<code>Find(${o.id})</code> checks the <b>identity map</b> first: product ${o.id} is already tracked, so it returns the <b>same object</b> and sends <b>no SQL</b>.`;
        else {
          const row = select(o.id);
          if (!row) { note = `<code>Find(${o.id})</code>: not tracked, so it queries. No such row: you get <code>null</code>.`; bad = true; }
          else { tracked.push({ key: o.id, state: "Unchanged", cur: { ...row }, snap: { ...row }, obj: ++objSeq }); note = `<code>Find(${o.id})</code>: not in the identity map, so one SELECT. The context ${tracking ? "" : "still "}tracks the result${tracking ? "" : " (Find always tracks; AsNoTracking only changes LINQ queries)"} and keeps a <b>snapshot</b> of the original values.`; }
        }
      } else if (o.op === "get") {
        const row = select(o.id);
        if (!row) { note = `A query for id ${o.id} returns no rows.`; bad = true; }
        else if (tracking) {
          const e = byKey(o.id);
          if (e) note = `A LINQ query <b>always</b> goes to the database: one more round trip. The row comes back, but product ${o.id} is already tracked, so you get the <b>same object</b> and the fresh values are <b>ignored</b>${dirtyOf(e).length ? `: your unsaved edit (${dirtyOf(e).map((f) => `${f} = ${e.cur[f]}`).join(", ")}) survives` : ""}. That's identity resolution: one object per row per context.`;
          else { tracked.push({ key: o.id, state: "Unchanged", cur: { ...row }, snap: { ...row }, obj: ++objSeq }); note = `The query runs and the context starts tracking product ${o.id}, with a snapshot of its original values.`; }
        } else {
          const n = loose.filter((x) => x.id === o.id).length;
          loose.push({ id: o.id, obj: ++objSeq, cur: { ...row } });
          note = `AsNoTracking: one SELECT, and a <b>new, untracked</b> object (#${objSeq}).${n ? ` That's ${n + 1} separate objects for the same row: no identity map.` : ""} No snapshot is kept, so it's cheaper to materialize.`;
        }
      } else if (o.op === "set") {
        const t = target(o.id);
        if (!t) throw new Error(`"${o.src}": there's no object for id ${o.id} yet. find or get it first.`);
        if (t.state === "Deleted") throw new Error(`"${o.src}": product ${o.id} is marked Deleted.`);
        const old = t.cur[o.field]; t.cur[o.field] = o.value;
        if (t.key !== undefined) {
          const e = t; const back = e.snap && e.snap[o.field] === o.value && old !== o.value;
          note = `<code>product.${o.field[0].toUpperCase() + o.field.slice(1)} = ${o.field === "price" ? o.value : `"${esc(o.value)}"`}</code> is a plain property set: <b>no SQL</b>. ${e.state === "Added" ? "It's a new entity; the value goes into the INSERT." : back ? "It's back to its original value, so DetectChanges will find <b>nothing to update</b> for this column." : o.value === old ? "Same value as before: nothing changes." : `At SaveChanges, DetectChanges compares it with the snapshot (${esc(String(e.snap[o.field]))}) and marks it Modified.`}`;
        } else { note = `<code>${o.field} = ${esc(String(o.value))}</code> on untracked object #${t.obj}. <b>Nobody is watching it</b>: SaveChanges won't see this change unless you attach it (<code>Update()</code>).`; bad = true; }
      } else if (o.op === "add") {
        tracked.push({ key: tmp--, state: "Added", cur: { name: o.name, price: o.price }, snap: null, obj: ++objSeq });
        note = `<code>Add()</code> starts tracking a new entity in the <b>Added</b> state with a temporary key. No SQL until SaveChanges.`;
      } else if (o.op === "remove") {
        const e = byKey(o.id);
        if (e) {
          if (e.state === "Added") { tracked.splice(tracked.indexOf(e), 1); note = `It was never saved, so <code>Remove()</code> just stops tracking it. No SQL will be needed.`; }
          else { e.state = "Deleted"; note = `<code>Remove()</code> marks product ${o.id} <b>Deleted</b>. The DELETE is sent at SaveChanges.`; }
        } else {
          const l = [...loose].reverse().find((x) => x.id === o.id);
          if (!l) throw new Error(`"${o.src}": product ${o.id} isn't loaded. find or get it first.`);
          loose.splice(loose.indexOf(l), 1);
          tracked.push({ key: o.id, state: "Deleted", cur: { ...l.cur }, snap: { ...l.cur }, obj: l.obj });
          note = `<code>Remove()</code> on an untracked object <b>attaches</b> it in the Deleted state.`;
        }
      } else if (o.op === "update") {
        const e = byKey(o.id);
        if (e) { if (e.state !== "Added" && e.state !== "Deleted") e.all = true; note = `<code>Update()</code> on an already-tracked entity marks <b>every</b> column Modified, so the UPDATE writes all of them. With tracking you never need it.`; }
        else {
          const l = [...loose].reverse().find((x) => x.id === o.id);
          if (!l) throw new Error(`"${o.src}": product ${o.id} isn't loaded. get it first.`);
          loose.splice(loose.indexOf(l), 1);
          tracked.push({ key: o.id, state: "Unchanged", cur: { ...l.cur }, snap: { ...l.cur }, obj: l.obj, all: true });
          note = `<code>Update()</code> attaches the detached object and marks <b>every column</b> Modified: there's no snapshot to compare with, so it can't know what changed. The UPDATE will overwrite all columns (and anyone else's concurrent edits to them).`;
        }
      } else if (o.op === "save") {
        const stmts = [];
        const plan = tracked.map((e) => ({ e, st: stateOf(e), d: dirtyOf(e) }));
        for (const p of plan) {
          if (p.st === "Added") { const id = nextId++; stmts.push({ sql: `INSERT INTO products (name, price) VALUES ('${p.e.cur.name}', ${p.e.cur.price}) RETURNING id`, meta: `id ${id}` }); db[id] = { ...p.e.cur }; p.newId = id; }
          else if (p.st === "Modified") stmts.push({ sql: `UPDATE products SET ${p.d.map((f) => `${f} = ${f === "name" ? `'${p.e.cur[f]}'` : p.e.cur[f]}`).join(", ")} WHERE id = ${p.e.key}`, meta: "1 row" }) && (db[p.e.key] = { ...p.e.cur });
          else if (p.st === "Deleted") { stmts.push({ sql: `DELETE FROM products WHERE id = ${p.e.key}`, meta: "1 row" }); delete db[p.e.key]; }
        }
        if (!stmts.length) note = `<code>SaveChanges()</code> runs DetectChanges: every tracked entity matches its snapshot. <b>No SQL, no round trip.</b>`;
        else {
          trips++;
          sql.push({ sql: "BEGIN", cls: "cur" }); stmts.forEach((s) => sql.push({ ...s, cls: "cur" })); sql.push({ sql: "COMMIT", cls: "cur" });
          const skipped = plan.filter((p) => p.st === "Unchanged").length;
          note = `<code>SaveChanges()</code>: DetectChanges compares each entity with its snapshot, then sends <b>${stmts.length} statement${stmts.length > 1 ? "s" : ""} in one transaction</b> (batched into one round trip). UPDATEs list <b>only the changed columns</b>${skipped ? `; ${skipped} unchanged entit${skipped > 1 ? "ies are" : "y is"} skipped` : ""}. All or nothing: that's the <b>unit of work</b>.`;
          for (const p of plan) {
            if (p.st === "Deleted") tracked.splice(tracked.indexOf(p.e), 1);
            else { if (p.newId) p.e.key = p.newId; p.e.state = "Unchanged"; p.e.snap = { ...p.e.cur }; p.e.all = false; }
          }
        }
        if (loose.some((l) => db[l.id] && (l.cur.name !== db[l.id].name || l.cur.price !== db[l.id].price))) { note += " Edits made to <b>untracked</b> objects were not saved."; bad = true; }
      }
      fr.push(view({ line: code[o.op], op: o, bad, note: `<b>${esc(o.src)}</b>: ${note}`, vars: { op: o.src, tracked: tracked.length, "round trips": trips } }));
    }
    const last = fr[fr.length - 1];
    fr.push({ ...last, final: true, line: [], op: null, note: `Done: <b>${trips} round trip${trips === 1 ? "" : "s"}</b>. The context was your <b>unit of work</b>: it collected changes in memory and wrote them atomically. Keep a context short-lived (one per request or per job); a long-lived one grows its identity map, serves stale data and makes SaveChanges slower.` });
    return fr;
  }
  Viz.register("data-access-uow", (el) => Viz.player(el, {
    title: "Change tracking: identity map, snapshots and one SaveChanges",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["active", "changed since the snapshot"], ["done", "Added / saved"], ["bad", "Deleted, or a change nobody will save"], ["path", "SQL in the current step"]],
    codeLang: "csharp",
    code: [
      "var p = await db.Products.FindAsync(1);           // identity map first",
      "var q = await db.Products.FirstAsync(x => x.Id == 2); // always SQL",
      "p.Price = 12;                                    // no SQL, just a property",
      "db.Products.Add(new Product { Name = \"Bowl\", Price = 9 });",
      "db.Products.Remove(q);",
      "db.Products.Update(detached);  // attach + mark EVERY column modified",
      "await db.SaveChangesAsync();   // DetectChanges, then 1 transaction",
    ],
    inputs: [
      { key: "mode", label: "queries", type: "select", options: ["tracking (default)", "AsNoTracking()"], value: "tracking (default)" },
      { key: "ops", label: "operations (find/get/set/add/remove/update/save)", value: "find 1, find 1, set 1 price 12, get 2, set 2 price 2, find 3, remove 3, add Bowl 9, save", width: 560 },
    ],
    random: () => retry(() => {
      const tr = Math.random() < 0.6, ops = [], loaded = new Set();
      for (let k = 0, n = rnd(4, 9); k < n; k++) {
        const id = rnd(1, 3), r = Math.random();
        if (!loaded.size || r < 0.3) { ops.push(`${pick(["find", "get"])} ${id}`); loaded.add(id); }
        else if (r < 0.65) ops.push(`set ${pick([...loaded])} price ${pick([2, 7, 10, 12, 15])}`);
        else if (r < 0.75) ops.push(`add ${pick(["Bowl", "Plate", "Jar"])} ${rnd(1, 20)}`);
        else if (r < 0.85) { const v = pick([...loaded]); ops.push(`remove ${v}`); loaded.delete(v); }
        else if (r < 0.9 && !tr) ops.push(`update ${pick([...loaded])}`);
        else ops.push("save");
      }
      ops.push("save");
      return { mode: tr ? "tracking (default)" : "AsNoTracking()", ops: ops.join(", ") };
    }, (c) => simUow(parseOps(c.ops), c.mode.startsWith("tracking")), { mode: "tracking (default)", ops: "find 1, set 1 price 12, save" }),
    build: ({ mode, ops }) => simUow(parseOps(ops), mode.startsWith("tracking")),
    render: (f) => {
      const dbRows = Object.keys(f.db).map(Number).sort((a, b) => a - b).map((id) => ({ cells: [id, esc(f.db[id].name), f.db[id].price] }));
      const tr = f.tracked.map((e) => {
        const st = e.state === "Added" || e.state === "Deleted" ? e.state : e.dirty.length ? "Modified" : "Unchanged";
        const cell = (fl) => (e.dirty.includes(fl) && e.snap && e.cur[fl] !== e.snap[fl] ? `<b>${esc(e.cur[fl])}</b> <span class="dax-was">was ${esc(e.snap[fl])}</span>` : e.dirty.includes(fl) ? `<b>${esc(e.cur[fl])}</b> <span class="dax-was">forced</span>` : esc(e.cur[fl]));
        return { cls: st === "Modified" ? "active" : st === "Added" ? "done" : st === "Deleted" ? "bad" : "", cells: [e.key < 0 ? `tmp ${e.key}` : e.key, `obj #${e.obj}`, `<b>${st}</b>`, cell("name"), cell("price")] };
      });
      const lo = f.loose.map((o) => ({ cls: f.db[o.id] && (o.cur.name !== f.db[o.id].name || o.cur.price !== f.db[o.id].price) ? "bad" : "", cells: [o.id, `obj #${o.obj}`, esc(o.cur.name), esc(o.cur.price)] }));
      return col(panels(mini("database: products", ["id", "name", "price"], dbRows), mini("change tracker (identity map)", ["key", "object", "state", "name", "price"], tr, { empty: "nothing tracked" }), lo.length ? mini("untracked objects", ["id", "object", "name", "price"], lo) : ""), sqlList(`SQL sent · ${f.trips} round trip${f.trips === 1 ? "" : "s"}`, f.sql.map((q) => ({ ...q, cls: q.cls === "cur" ? "path" : "" }))));
    },
  }));

  /* =====================================================================
   * 2. Connection pool: borrow, return, wait, timeout, leak
   * ===================================================================== */
  function parseReqs(s) {
    const parts = String(s || "").split(/[,;\s]+/).filter(Boolean);
    if (parts.length < 1 || parts.length > 10) throw new Error("requests: give 1–10 items like 0:4 (arrives at tick 0, runs 4 ticks).");
    return parts.map((p, i) => {
      const m = /^(\d+):(\d+)$/.exec(p);
      if (!m) throw new Error(`requests: "${p}" should look like arrive:duration, e.g. 2:5.`);
      return { i, arrive: int(m[1], "arrival tick", 0, 30), dur: int(m[2], "duration", 1, 12) };
    });
  }
  function simPool(reqs, max, open, timeout, leak) {
    const R = reqs.map((r) => ({ ...r, conn: null, wait: 0, openAt: null, start: null, end: null, fail: null, reused: false }));
    const conns = []; const queue = []; const evs = [];
    let opened = 0, reused = 0;
    const T_END = Math.max(...R.map((r) => r.arrive)) + timeout + 12 * R.length + open + 2;
    for (let t = 0; t <= T_END; t++) {
      const log = [];
      for (const r of R) if (r.end === t && r.conn !== null) {
        const c = conns[r.conn];
        if (leak === r.i + 1) { c.state = "leaked"; c.owner = r.i; log.push({ k: "leak", r: r.i, c: c.id }); continue; }
        if (queue.length) { const w = R[queue.shift()]; c.owner = w.i; w.conn = c.id; w.start = t; w.end = t + w.dur; w.wait = t - w.arrive; w.reused = true; reused++; log.push({ k: "handoff", r: r.i, to: w.i, c: c.id }); }
        else { c.state = "idle"; c.owner = null; log.push({ k: "return", r: r.i, c: c.id }); }
      }
      for (const c of conns) if (c.state === "opening" && c.readyAt === t) { c.state = "busy"; const r = R[c.owner]; r.start = t; r.end = t + r.dur; log.push({ k: "opened", r: r.i, c: c.id }); }
      for (const r of R) if (r.arrive === t) {
        const idle = conns.find((c) => c.state === "idle");
        if (idle && !queue.length) { idle.state = "busy"; idle.owner = r.i; r.conn = idle.id; r.start = t; r.end = t + r.dur; r.reused = true; reused++; log.push({ k: "borrow", r: r.i, c: idle.id }); }
        else if (conns.length < max && !queue.length) {
          const c = { id: conns.length, state: open ? "opening" : "busy", owner: r.i, readyAt: t + open }; conns.push(c); opened++; r.conn = c.id; r.openAt = t;
          if (!open) { r.start = t; r.end = t + r.dur; }
          log.push({ k: "open", r: r.i, c: c.id });
        } else { queue.push(r.i); log.push({ k: "queue", r: r.i, pos: queue.length }); }
      }
      for (const i of [...queue]) { const r = R[i]; if (t - r.arrive >= timeout) { queue.splice(queue.indexOf(i), 1); r.fail = t; r.wait = t - r.arrive; log.push({ k: "timeout", r: i }); } }
      if (log.length) evs.push({ t, log, conns: conns.map((c) => ({ ...c })), queue: queue.slice() });
      if (R.every((r) => r.fail !== null || (r.end !== null && r.end <= t))) break;
    }
    return { R, evs, opened, reused, conns, T: Math.max(...R.map((r) => r.fail ?? r.end ?? 0), 1) };
  }
  function poolGantt(sim, now, max) {
    const R = sim.R, T = Math.max(sim.T, 8), W = 660, x0 = 70, sx = (W - x0 - 14) / T, rh = 24, H = 34 + R.length * rh;
    let s = `<svg class="dax-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Request timeline: waiting, opening a connection, running, timed out">`;
    for (let t = 0; t <= T; t += T > 24 ? 5 : 2) s += `<line class="grid" x1="${x0 + t * sx}" y1="18" x2="${x0 + t * sx}" y2="${H - 4}"/><text class="ax" x="${x0 + t * sx}" y="12">${t}</text>`;
    s += `<line class="now" x1="${x0 + now * sx}" y1="16" x2="${x0 + now * sx}" y2="${H - 2}"/>`;
    R.forEach((r, k) => {
      const y = 24 + k * rh, clip = (a, b) => [Math.min(a, now), Math.min(b, now)];
      s += `<text class="lab" x="${x0 - 8}" y="${y + 13}">r${r.i + 1}${r.conn !== null && ((r.start !== null && r.start <= now) || (r.openAt !== null && r.openAt <= now)) ? ` c${r.conn + 1}` : ""}</text>`;
      if (r.arrive > now) return;
      const waitEnd = r.fail ?? r.start ?? (r.openAt !== null ? r.openAt : null) ?? now;
      if (r.openAt === null && waitEnd > r.arrive) { const [a, b] = clip(r.arrive, waitEnd); if (b > a) s += `<rect class="seg wait" x="${x0 + a * sx}" y="${y + 3}" width="${(b - a) * sx}" height="${rh - 8}" rx="3"/>`; }
      if (r.openAt !== null && r.start !== null && r.start > r.openAt) { const [a, b] = clip(r.openAt, r.start); if (b > a) s += `<rect class="seg open" x="${x0 + a * sx}" y="${y + 3}" width="${(b - a) * sx}" height="${rh - 8}" rx="3"/>`; }
      if (r.start !== null && r.start <= now) { const [a, b] = clip(r.start, r.end); s += `<rect class="seg run ${r.reused ? "reuse" : ""}" x="${x0 + a * sx}" y="${y + 3}" width="${Math.max(2, (b - a) * sx)}" height="${rh - 8}" rx="3"/>`; }
      if (r.fail !== null && r.fail <= now) s += `<text class="x" x="${x0 + r.fail * sx + 4}" y="${y + 14}">✕ timeout</text>`;
    });
    return s + "</svg>";
  }
  Viz.register("data-access-pool", (el) => Viz.player(el, {
    title: "Connection pool: borrow, return, wait, time out, leak",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "running on a reused connection"], ["path", "running on a new connection"], ["visit", "opening a physical connection (TCP + TLS + auth)"], ["active", "waiting for a free connection"], ["bad", "timed out / leaked"]],
    codeLang: "csharp",
    code: [
      "// Npgsql defaults: Maximum Pool Size=100; Timeout=15 (seconds)",
      "await using var conn = new NpgsqlConnection(cs);",
      "await conn.OpenAsync();   // borrow: idle one, or open new, or WAIT",
      "await RunQueriesAsync(conn);",
      "// end of 'using': Dispose() returns it to the pool (not closed!)",
      "// forget Dispose -> connection leaks -> pool drains -> timeouts",
    ],
    inputs: [
      { key: "max", label: "max pool size", value: "3", width: 70 },
      { key: "open", label: "cost to open (ticks)", value: "3", width: 70 },
      { key: "timeout", label: "acquire timeout (ticks)", value: "6", width: 70 },
      { key: "reqs", label: "requests arrive:duration", value: "0:4, 0:3, 1:5, 2:2, 3:4, 4:3, 9:2, 10:3", width: 280 },
      { key: "leak", label: "request that forgets Dispose (0 = none)", value: "0", width: 70 },
    ],
    random: () => {
      const n = rnd(5, 10); let t = 0; const rs = [];
      for (let k = 0; k < n; k++) { rs.push(`${t}:${rnd(1, 6)}`); t += rnd(0, 2); }
      return { max: String(rnd(1, 4)), open: String(rnd(0, 4)), timeout: String(rnd(3, 10)), reqs: rs.join(", "), leak: String(Math.random() < 0.35 ? rnd(1, 3) : 0) };
    },
    build: ({ max, open, timeout, reqs, leak }) => {
      const M = int(max, "max pool size", 1, 6), O = int(open, "open cost", 0, 6), TO = int(timeout, "acquire timeout", 1, 30);
      const R = parseReqs(reqs), L = int(leak, "leaking request", 0, R.length);
      const sim = simPool(R, M, O, TO, L), fr = [];
      const fails = () => sim.R.filter((r) => r.fail !== null);
      fr.push({ sim, now: 0, conns: [], queue: [], max: M, line: [0], vars: { "pool size": `0 / ${M}`, waiting: 0 }, note: `The pool starts empty. Opening a physical connection costs <b>${O} tick${O === 1 ? "" : "s"}</b> (TCP, TLS, authentication, session setup); borrowing an idle one costs nothing. At most <b>${M}</b> connections; a request waits up to <b>${TO}</b> ticks for one.` });
      for (const ev of sim.evs) {
        const bits = []; let line = [2];
        for (const g of ev.log) {
          const r = `r${g.r + 1}`, c = `c${g.c + 1}`;
          if (g.k === "borrow") bits.push(`${r} borrows idle <b>${c}</b>: no handshake, starts at once.`);
          else if (g.k === "open") bits.push(`${r}: no idle connection and the pool has room, so it <b>opens ${c}</b>${O ? ` (${O} ticks)` : ""}.`);
          else if (g.k === "opened") bits.push(`${c} is open; ${r} starts its queries.`), (line = [3]);
          else if (g.k === "queue") bits.push(`${r}: all ${M} connections are busy, so it <b>waits</b> (position ${g.pos} in the queue).`);
          else if (g.k === "return") bits.push(`${r} finishes; <code>Dispose()</code> <b>returns ${c}</b> to the pool, still open.`), (line = [4]);
          else if (g.k === "handoff") bits.push(`${r} returns ${c}, and the pool hands it straight to waiting <b>r${g.to + 1}</b>.`), (line = [4]);
          else if (g.k === "leak") bits.push(`${r} finishes but <b>never disposes ${c}</b>. The pool still counts it as in use, so it's gone for good (until the GC finalizer, if ever).`), (line = [5]);
          else if (g.k === "timeout") bits.push(`<b>${r} times out</b> after waiting ${ev.t - sim.R[g.r].arrive} ticks: "timeout obtaining a connection from the pool". The request fails even though the database itself may be idle.`), (line = [2]);
        }
        const inUse = ev.conns.filter((c) => c.state !== "idle").length;
        fr.push({ sim, now: ev.t, conns: ev.conns, queue: ev.queue, max: M, line, note: `<b>Tick ${ev.t}.</b> ${bits.join(" ")}`, vars: { "pool size": `${ev.conns.length} / ${M}`, "in use": inUse, waiting: ev.queue.length, timeouts: fails().filter((r) => r.fail <= ev.t).length } });
      }
      const last = fr[fr.length - 1], F = fails().length, maxWait = Math.max(0, ...sim.R.map((r) => r.wait));
      fr.push({ ...last, final: true, now: sim.T, line: [], note: `Done at tick ${sim.T}. <b>${sim.opened}</b> physical connection${sim.opened === 1 ? "" : "s"} opened for ${sim.R.length} requests (${sim.reused} reused). Without a pool every request would pay the ${O}-tick open cost: ${sim.R.length * O} ticks of handshakes instead of ${sim.opened * O}. ${F ? `<b>${F} request${F > 1 ? "s" : ""} timed out.</b> ${L ? "The leak shrank the pool permanently; fix it with <code>using</code> / <code>try-with-resources</code> / <code>with</code> / <code>defer</code>." : "The pool is too small for this burst, or the queries hold connections too long. Make them shorter before making the pool bigger: the database has its own connection limit."}` : `Longest wait: ${maxWait} tick${maxWait === 1 ? "" : "s"}.`}` });
      return fr;
    },
    render: (f) => {
      const slots = Array.from({ length: f.max }, (_, k) => {
        const c = f.conns[k];
        if (!c) return `<div class="dax-slot empty"><b>c${k + 1}</b><span>not open</span></div>`;
        const cls = c.state === "idle" ? "idle" : c.state === "opening" ? "visit" : c.state === "leaked" ? "bad" : "path";
        return `<div class="dax-slot ${cls}"><b>c${k + 1}</b><span>${c.state === "idle" ? "idle" : c.state === "opening" ? `opening for r${c.owner + 1}` : c.state === "leaked" ? `leaked by r${c.owner + 1}` : `in use by r${c.owner + 1}`}</span></div>`;
      }).join("");
      const q = f.queue.length ? f.queue.map((i) => `<span class="dax-chip active">r${i + 1}</span>`).join("") : `<span class="dax-muted">nobody waiting</span>`;
      return col(`<div class="dax-pool"><div class="dax-pool-h">POOL</div><div class="dax-slots">${slots}</div><div class="dax-pool-h">WAIT QUEUE</div><div class="dax-queue">${q}</div></div>`, fit(poolGantt(f.sim, f.now, f.max)),
        f.final ? stats([["physical opens", String(f.sim.opened), "path"], ["reused", String(f.sim.reused), "done"], ["timeouts", String(f.sim.R.filter((r) => r.fail !== null).length), f.sim.R.some((r) => r.fail !== null) ? "bad" : ""], ["max wait", `${Math.max(0, ...f.sim.R.map((r) => r.wait))} ticks`]]) : "");
    },
  }));


  /* =====================================================================
   * 3. Isolation levels: two interleaved transactions
   * ===================================================================== */
  const LEVELS = {
    "READ UNCOMMITTED": "ru",
    "READ COMMITTED (MVCC)": "rc",
    "REPEATABLE READ (locking)": "rr",
    "SNAPSHOT": "si",
    "SERIALIZABLE (SSI)": "ssi",
  };
  const LV_SHORT = { ru: "READ UNCOMMITTED", rc: "READ COMMITTED", rr: "REPEATABLE READ", si: "SNAPSHOT", ssi: "SERIALIZABLE" };
  const acct = (k) => `accounts WHERE id = '${k}'`;
  const SCEN = {
    "dirty read": {
      table: "accounts", init: { A: 500 },
      steps: [
        { t: 1, k: "write", key: "A", delta: -100, sql: `UPDATE ${acct("A").replace("WHERE", "SET balance = balance - 100 WHERE")}` },
        { t: 2, k: "read", key: "A", as: "r2", sql: `SELECT balance FROM ${acct("A")}` },
        { t: 1, k: "rollback", sql: "ROLLBACK" },
        { t: 2, k: "commit", sql: "COMMIT" },
      ],
      story: "T1 withdraws 100 but will roll back. T2 reads the balance in between.",
      check: (o) => (o.reads.r2 === undefined ? { bad: false, why: "T2 never got a value." } : o.reads.r2 !== 500 ? { bad: true, why: `T2 read <b>${o.reads.r2}</b>, a value that was rolled back and never existed: a <b>dirty read</b>.` } : { bad: false, why: "T2 read 500, the committed value. No dirty read." }),
    },
    "non-repeatable read": {
      table: "accounts", init: { A: 500 },
      steps: [
        { t: 1, k: "read", key: "A", as: "r1", sql: `SELECT balance FROM ${acct("A")}` },
        { t: 2, k: "write", key: "A", set: 400, sql: `UPDATE accounts SET balance = 400 WHERE id = 'A'` },
        { t: 2, k: "commit", sql: "COMMIT" },
        { t: 1, k: "read", key: "A", as: "r1b", sql: `SELECT balance FROM ${acct("A")}` },
        { t: 1, k: "commit", sql: "COMMIT" },
      ],
      story: "T1 reads the same row twice. T2 changes it in between and commits.",
      check: (o) => (o.reads.r1 !== o.reads.r1b ? { bad: true, why: `T1 read <b>${o.reads.r1}</b>, then <b>${o.reads.r1b}</b> inside one transaction: a <b>non-repeatable read</b>.` } : { bad: false, why: `T1 read ${o.reads.r1} both times.` }),
    },
    "phantom": {
      table: "doctors", init: { alice: 1, bob: 1 },
      steps: [
        { t: 1, k: "count", as: "c1", sql: "SELECT COUNT(*) FROM doctors WHERE on_call" },
        { t: 2, k: "insert", key: "carol", set: 1, sql: "INSERT INTO doctors VALUES ('carol', true)" },
        { t: 2, k: "commit", sql: "COMMIT" },
        { t: 1, k: "count", as: "c1b", sql: "SELECT COUNT(*) FROM doctors WHERE on_call" },
        { t: 1, k: "commit", sql: "COMMIT" },
      ],
      story: "T1 runs the same range query twice. T2 inserts a matching row in between.",
      check: (o) => (o.reads.c1 !== o.reads.c1b ? { bad: true, why: `The same query returned <b>${o.reads.c1}</b> rows, then <b>${o.reads.c1b}</b>: a <b>phantom</b> row appeared. Row locks can't stop it: the new row didn't exist to be locked.` } : { bad: false, why: `T1 counted ${o.reads.c1} both times.` }),
    },
    "lost update": {
      table: "accounts", init: { A: 500 },
      steps: [
        { t: 1, k: "read", key: "A", as: "r1", sql: `SELECT balance FROM ${acct("A")}` },
        { t: 2, k: "read", key: "A", as: "r2", sql: `SELECT balance FROM ${acct("A")}` },
        { t: 1, k: "write", key: "A", from: "r1", add: 100 },
        { t: 2, k: "write", key: "A", from: "r2", add: -50 },
        { t: 1, k: "commit", sql: "COMMIT" },
        { t: 2, k: "commit", sql: "COMMIT" },
      ],
      story: "Both read the balance, compute a new one in application code (T1 deposits 100, T2 withdraws 50), and write it back.",
      intent: { 1: 100, 2: -50 },
      check: (o) => {
        const exp = 500 + [1, 2].filter((t) => o.status[t] === "committed").reduce((s, t) => s + (t === 1 ? 100 : -50), 0);
        return o.data.A !== exp ? { bad: true, why: `Final balance <b>${o.data.A}</b>, but the committed work adds up to ${exp}. One update overwrote the other: a <b>lost update</b>.` } : { bad: false, why: `Final balance ${o.data.A} matches the committed work.` };
      },
    },
    "write skew": {
      table: "doctors", init: { alice: 1, bob: 1 },
      steps: [
        { t: 1, k: "count", as: "c1", sql: "SELECT COUNT(*) FROM doctors WHERE on_call" },
        { t: 2, k: "count", as: "c2", sql: "SELECT COUNT(*) FROM doctors WHERE on_call" },
        { t: 1, k: "write", key: "alice", set: 0, sql: "UPDATE doctors SET on_call = false WHERE name = 'alice'" },
        { t: 2, k: "write", key: "bob", set: 0, sql: "UPDATE doctors SET on_call = false WHERE name = 'bob'" },
        { t: 1, k: "commit", sql: "COMMIT" },
        { t: 2, k: "commit", sql: "COMMIT" },
      ],
      story: "Rule: at least one doctor stays on call. Alice and Bob each check the count (2, fine) and go off call. They update different rows.",
      check: (o) => {
        const n = Object.values(o.data).filter((v) => v === 1).length;
        return n === 0 ? { bad: true, why: "<b>Nobody is on call.</b> Each transaction was valid on its own snapshot, they touched different rows, so no write conflict fired: <b>write skew</b>." } : { bad: false, why: `${n} doctor${n > 1 ? "s" : ""} still on call. The rule holds.` };
      },
    },
  };
  function simIso(scName, lv) {
    const sc = SCEN[scName];
    const db = { data: { ...sc.init }, ver: Object.fromEntries(Object.keys(sc.init).map((k) => [k, 0])), ts: 0 };
    const S = {}, X = {};
    const T = { 1: null, 2: null };
    for (const t of [1, 2]) T[t] = { id: t, status: "active", snap: null, writes: {}, reads: {}, readKeys: new Set(), pred: false, waitFor: null, pending: [], rwOut: new Set(), rwIn: new Set(), why: "" };
    sc.steps.forEach((st, i) => T[st.t].pending.push(i));
    const other = (t) => (t === 1 ? 2 : 1);
    const ev = [];
    const holdsS = (k, t) => (S[k] || new Set()).has(t);
    const release = (t) => { for (const k in S) S[k].delete(t); for (const k in X) if (X[k] === t) delete X[k]; };
    const snapOf = (t) => { if ((lv === "si" || lv === "ssi") && !T[t].snap) T[t].snap = { data: { ...db.data }, ts: db.ts }; };
    const valOf = (t, k) => {
      const me = T[t];
      if (k in me.writes) return me.writes[k];
      if (lv === "ru") { const o = T[other(t)]; if (o.status === "active" || o.status === "blocked") if (k in o.writes) return o.writes[k]; }
      if (lv === "si" || lv === "ssi") return me.snap.data[k];
      return db.data[k];
    };
    const visibleKeys = (t) => {
      const ks = new Set(lv === "si" || lv === "ssi" ? Object.keys(T[t].snap.data) : Object.keys(db.data));
      Object.keys(T[t].writes).forEach((k) => ks.add(k));
      if (lv === "ru") { const o = T[other(t)]; if (o.status === "active" || o.status === "blocked") Object.keys(o.writes).forEach((k) => ks.add(k)); }
      return [...ks];
    };
    const conflict = (t, st) => {
      const o = other(t);
      if (st.k === "read" && lv === "rr" && X[st.key] === o) return { key: st.key, mode: "S", holder: o, holds: "X" };
      if (st.k === "count" && lv === "rr") { const k = Object.keys(db.data).find((k) => X[k] === o); if (k) return { key: k, mode: "S", holder: o, holds: "X" }; }
      if (st.k === "write" || st.k === "insert") {
        if (X[st.key] === o) return { key: st.key, mode: "X", holder: o, holds: "X" };
        if (lv === "rr" && holdsS(st.key, o)) return { key: st.key, mode: "X", holder: o, holds: "S" };
      }
      return null;
    };
    const ssiEdges = (t, st) => {
      if (lv !== "ssi") return;
      const o = other(t), U = T[o];
      if (U.status === "aborted") return;
      if (st.k === "read" || st.k === "count") {
        const keys = st.k === "read" ? [st.key] : Object.keys(U.writes);
        if (keys.some((k) => k in U.writes || db.ver[k] > T[t].snap.ts)) { T[t].rwOut.add(o); U.rwIn.add(t); }
      } else if (st.k === "write" || st.k === "insert") {
        if (U.readKeys.has(st.key) || U.pred) { U.rwOut.add(t); T[t].rwIn.add(o); }
      }
    };
    const exec = (t, i, resumed) => {
      const st = sc.steps[i], me = T[t], o = other(t);
      const res = { t, i, st, resumed, sql: st.sql };
      if (st.k === "commit" || st.k === "rollback") {
        if (st.k === "commit" && lv === "ssi" && me.rwOut.has(o) && me.rwIn.has(o) && T[o].status === "committed") {
          me.status = "aborted"; me.why = "serialization failure"; me.writes = {}; release(t); me.pending = [];
          return { ...res, out: "abort", msg: `ERROR: could not serialize access due to read/write dependencies among transactions. SSI found T${t} and T${o} each read what the other wrote, and T${o} already committed. T${t} is rolled back and must retry.` };
        }
        if (st.k === "commit") {
          db.ts++; for (const [k, v] of Object.entries(me.writes)) { db.data[k] = v; db.ver[k] = db.ts; }
          me.status = "committed";
        } else { me.status = "aborted"; me.why = "rolled back"; me.writes = {}; }
        release(t); me.pending.shift();
        return { ...res, out: "ok", msg: st.k === "commit" ? `T${t} commits${Object.keys(me.writes).length ? `: ${Object.entries(me.writes).map(([k, v]) => `${k} = ${v}`).join(", ")} becomes visible to others` : ""}. Its locks are released.` : `T${t} rolls back: its changes vanish and its locks are released.` };
      }
      snapOf(t);
      const c = conflict(t, st);
      if (c) {
        if (T[o].status === "blocked" && T[o].waitFor === t) {
          me.status = "aborted"; me.why = "deadlock victim"; me.writes = {}; release(t); me.pending = []; me.waitFor = null;
          return { ...res, out: "abort", msg: `<b>Deadlock.</b> T${t} needs a${c.mode === "X" ? "n X (write)" : " S (read)"} lock on ${c.key}, held by T${o}, while T${o} is waiting for T${t}. The engine kills one: <b>T${t} is the victim</b> and is rolled back. The application must retry it.` };
        }
        me.status = "blocked"; me.waitFor = o;
        return { ...res, out: "wait", msg: `T${t} needs a${c.mode === "X" ? "n <b>X</b> (exclusive)" : " <b>S</b> (shared)"} lock on ${c.key}, but T${o} holds ${c.holds === "X" ? "an X" : "an S"} lock on it. <b>T${t} waits.</b>` };
      }
      me.status = "active"; me.waitFor = null;
      if (st.k === "read") {
        const v = valOf(t, st.key); me.reads[st.as] = v; me.readKeys.add(st.key);
        if (lv === "rr") (S[st.key] ||= new Set()).add(t);
        ssiEdges(t, st); me.pending.shift();
        const unc = lv === "ru" && !(st.key in me.writes) && st.key in T[o].writes && T[o].status !== "committed" && T[o].status !== "aborted";
        return { ...res, out: "ok", val: v, msg: `T${t} reads ${st.key} = <b>${v}</b>${unc ? `: T${o}'s <b>uncommitted</b> value` : lv === "si" || lv === "ssi" ? " from its snapshot (taken at its first statement)" : lv === "rr" ? " and keeps an S lock on it until commit" : lv === "rc" ? ", the latest committed version as of this statement" : ""}.` };
      }
      if (st.k === "count") {
        const ks = visibleKeys(t).filter((k) => valOf(t, k) === 1), n = ks.length;
        me.reads[st.as] = n; me.pred = true; Object.keys(db.data).forEach((k) => me.readKeys.add(k));
        if (lv === "rr") Object.keys(db.data).forEach((k) => (S[k] ||= new Set()).add(t));
        ssiEdges(t, st); me.pending.shift();
        return { ...res, out: "ok", val: n, msg: `T${t} counts on-call doctors: <b>${n}</b> (${ks.join(", ")})${lv === "rr" ? ". It S-locks the rows it read, but <b>not the gaps</b> between them" : lv === "si" || lv === "ssi" ? ", from its snapshot" : ""}.` };
      }
      if (lv === "si" || lv === "ssi") {
        if ((db.ver[st.key] || 0) > me.snap.ts) {
          me.status = "aborted"; me.why = "update conflict"; me.writes = {}; release(t); me.pending = [];
          return { ...res, out: "abort", msg: `ERROR: could not serialize access due to concurrent update. ${st.key} was changed and committed by T${o} after T${t}'s snapshot was taken. <b>First updater wins</b>; T${t} is rolled back and must retry.` };
        }
      }
      let v;
      if (st.delta !== undefined) v = valOf(t, st.key) + st.delta;
      else if (st.from) v = me.reads[st.from] + st.add;
      else v = st.set;
      me.writes[st.key] = v; X[st.key] = t;
      ssiEdges(t, st); me.pending.shift();
      res.sql = st.sql || `UPDATE accounts SET balance = ${v} WHERE id = '${st.key}'`;
      return { ...res, out: "ok", val: v, msg: `T${t} ${st.k === "insert" ? "inserts" : "writes"} ${st.key} = <b>${v}</b>${st.from ? ` (computed in the app from the ${me.reads[st.from]} it read earlier)` : ""} and takes an <b>X lock</b> on it, held until commit. The new version is uncommitted: ${lv === "ru" ? "others at READ UNCOMMITTED can see it" : "other transactions can't see it yet"}.` };
    };
    let guard = 0;
    while ((T[1].pending.length || T[2].pending.length) && guard++ < 40) {
      let did = false;
      for (const t of [1, 2]) {
        const me = T[t];
        if (me.status === "blocked" && !conflict(t, sc.steps[me.pending[0]])) { ev.push(exec(t, me.pending[0], true)); did = true; break; }
      }
      if (did) { ev[ev.length - 1].snap = snapshotState(); continue; }
      const next = sc.steps.map((_, i) => i).find((i) => T[sc.steps[i].t].pending[0] === i && T[sc.steps[i].t].status === "active");
      if (next === undefined) break;
      ev.push(exec(sc.steps[next].t, next, false)); ev[ev.length - 1].snap = snapshotState();
    }
    function snapshotState() {
      return { data: { ...db.data }, S: Object.fromEntries(Object.entries(S).map(([k, s]) => [k, [...s]]).filter(([, s]) => s.length)), X: { ...X },
        tx: [1, 2].map((t) => ({ id: t, status: T[t].status, writes: { ...T[t].writes }, snap: T[t].snap ? { ...T[t].snap.data } : null, why: T[t].why, waitFor: T[t].waitFor })) };
    }
    const reads = { ...T[1].reads, ...T[2].reads }, status = { 1: T[1].status, 2: T[2].status };
    const verdictObj = sc.check({ reads, data: db.data, status });
    return { ev, reads, data: db.data, status, verdict: verdictObj, aborted: [1, 2].filter((t) => T[t].status === "aborted" && T[t].why !== "rolled back").map((t) => ({ t, why: T[t].why })) };
  }
  const ISO_MATRIX = (() => {
    const m = {};
    for (const s of Object.keys(SCEN)) for (const l of Object.values(LEVELS)) m[s + "|" + l] = simIso(s, l);
    return m;
  })();
  Viz.register("data-access-isolation", (el) => Viz.player(el, {
    title: "Isolation levels: two transactions, one interleaving, five rule sets",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["path", "T1"], ["visit", "T2"], ["active", "waiting for a lock"], ["bad", "anomaly / aborted"], ["done", "committed, correct"]],
    codeLang: "sql",
    code: [
      "SET TRANSACTION ISOLATION LEVEL ...;",
      "BEGIN;",
      "SELECT ...;      -- locks? which version? depends on the level",
      "UPDATE ...;      -- writes always lock the row until COMMIT",
      "COMMIT;          -- or ROLLBACK",
      "-- 40001 serialization failure / 1205 deadlock: ROLLBACK, then RETRY",
    ],
    inputs: [
      { key: "sc", label: "scenario", type: "select", options: Object.keys(SCEN), value: "lost update" },
      { key: "lv", label: "isolation level", type: "select", options: Object.keys(LEVELS), value: "READ COMMITTED (MVCC)" },
    ],
    random: () => ({ sc: pick(Object.keys(SCEN)), lv: pick(Object.keys(LEVELS)) }),
    build: ({ sc, lv }) => {
      const L = LEVELS[lv], s = SCEN[sc]; if (!L || !s) throw new Error("Pick a scenario and a level.");
      const sim = simIso(sc, L), fr = [], rows = [];
      const init = { data: { ...s.init }, S: {}, X: {}, tx: [1, 2].map((t) => ({ id: t, status: "active", writes: {}, snap: null, why: "" })) };
      const lvTxt = { ru: "No read locks, and reads see other transactions' <b>uncommitted</b> writes.", rc: "Each <b>statement</b> sees the latest committed data (PostgreSQL's default; SQL Server with READ_COMMITTED_SNAPSHOT). Reads never block.", rr: "Lock-based (SQL Server): reads take <b>S locks held until commit</b>; writers wait for readers and vice versa.", si: "Each <b>transaction</b> sees a snapshot from its first statement. Writing a row someone else changed after that snapshot fails (first updater wins). PostgreSQL calls this REPEATABLE READ.", ssi: "Snapshot isolation plus tracking of read/write dependencies (PostgreSQL SERIALIZABLE). A dangerous cycle aborts a transaction at commit." }[L];
      fr.push({ rows: [], st: init, sc, L, line: [0, 1], note: `<b>${esc(sc)}.</b> ${s.story} Level: <b>${esc(lv)}</b>. ${lvTxt}`, vars: { level: LV_SHORT[L] } });
      for (const e of sim.ev) {
        rows.push({ t: e.t, sql: e.sql, out: e.out, val: e.val, resumed: e.resumed });
        const k = e.st.k, line = e.out === "abort" ? [5] : k === "read" || k === "count" ? [2] : k === "write" || k === "insert" ? [3] : [4];
        fr.push({ rows: rows.map((r) => ({ ...r })), st: e.snap, sc, L, line, cur: rows.length - 1, note: `${e.resumed ? "<b>Unblocked.</b> " : ""}${e.msg}`, vars: { level: LV_SHORT[L], T1: e.snap.tx[0].status, T2: e.snap.tx[1].status } });
      }
      const last = fr[fr.length - 1], v = sim.verdict;
      const ab = sim.aborted.map((a) => `T${a.t} was aborted (${a.why}) and must be <b>retried</b> by your code`).join("; ");
      fr.push({ ...last, final: true, sim, line: [], cur: -1, note: `${v.why}${ab ? ` ${ab}.` : ""} ${v.bad ? "Raise the level, or use explicit locking (<code>SELECT … FOR UPDATE</code>), an atomic <code>UPDATE … SET x = x + 1</code>, or a version check." : "Correct, " + (ab ? "at the price of a retry." : "with no retry needed.")} The grid shows all 25 combinations.` });
      return fr;
    },
    render: (f) => {
      const cell = (r, t) => {
        if (r.t !== t) return `<td></td>`;
        const cls = r.out === "wait" ? "active" : r.out === "abort" ? "bad" : t === 1 ? "path" : "visit";
        const tail = r.out === "wait" ? "⏳ waits for a lock" : r.out === "abort" ? "✕ aborted" : r.val !== undefined ? `→ ${r.val}` : "";
        return `<td class="${cls}"><code>${esc(r.sql)}</code>${tail ? `<span class="dax-res">${r.resumed ? "resumed " : ""}${esc(tail)}</span>` : ""}</td>`;
      };
      const tl = `<table class="dax-iso"><tr><th>#</th><th>T1</th><th>T2</th></tr>${f.rows.length ? f.rows.map((r, i) => `<tr class="${i === f.cur ? "cur" : ""}"><td class="n">${i + 1}</td>${cell(r, 1)}${cell(r, 2)}</tr>`).join("") : `<tr><td class="n">·</td><td class="dim">BEGIN</td><td class="dim">BEGIN</td></tr>`}</table>`;
      const st = f.st;
      const dataRows = Object.keys(st.data).map((k) => [k, String(st.data[k])]);
      const unc = st.tx.filter((t) => t.status !== "committed" && t.status !== "aborted").flatMap((t) => Object.entries(t.writes).map(([k, v]) => [`T${t.id}: ${k}`, `${v} (uncommitted)`, t.id === 1 ? "path" : "visit"]));
      const locks = [...Object.entries(st.X).map(([k, t]) => [`X ${k}`, `T${t}`, "bad"]), ...Object.entries(st.S).map(([k, ts]) => [`S ${k}`, ts.map((t) => `T${t}`).join(", "), ""])];
      const snaps = st.tx.filter((t) => t.snap).map((t) => [`T${t.id} sees`, Object.entries(t.snap).map(([k, v]) => `${k}=${v}`).join(" "), t.id === 1 ? "path" : "visit"]);
      const txs = st.tx.map((t) => [`T${t.id}`, t.status === "aborted" ? t.why : t.status === "blocked" ? `waiting for T${t.waitFor}` : t.status, t.status === "aborted" && t.why !== "rolled back" ? "bad" : t.status === "blocked" ? "active" : t.status === "committed" ? "done" : ""]);
      let grid = "";
      if (f.final) {
        const sc = Object.keys(SCEN), lv = Object.values(LEVELS);
        grid = `<table class="dax-grid"><tr><th></th>${lv.map((l) => `<th>${LV_SHORT[l]}</th>`).join("")}</tr>${sc.map((s) => `<tr><th>${esc(s)}</th>${lv.map((l) => { const r = ISO_MATRIX[s + "|" + l]; const me = s === f.sc && l === f.L; return `<td class="${r.verdict.bad ? "bad" : "done"} ${me ? "me" : ""}">${r.verdict.bad ? "anomaly" : r.aborted.length ? "retry" : "safe"}</td>`; }).join("")}</tr>`).join("")}</table>`;
      }
      return col(fit(tl), panels(kv(`committed ${SCEN[f.sc].table}`, dataRows), kv("uncommitted versions", unc, { empty: "none" }), kv("locks held", locks, { empty: "none" }), snaps.length ? kv("snapshots", snaps) : "", kv("transactions", txs)),
        f.final ? verdict(f.sim.verdict.bad ? `Anomaly at ${LV_SHORT[f.L]}` : f.sim.aborted.length ? `Prevented: T${f.sim.aborted[0].t} aborted (${f.sim.aborted[0].why}), retry it` : `No anomaly at ${LV_SHORT[f.L]}`, f.sim.verdict.bad ? "bad" : "done") : "", grid ? fit(grid) : "");
    },
  }));

  /* =====================================================================
   * 4. Optimistic (version check) vs pessimistic (FOR UPDATE) vs nothing
   * ===================================================================== */
  const OCC = ["last write wins (no check)", "optimistic: WHERE version = @v", "pessimistic: SELECT … FOR UPDATE"];
  function simOcc(strat, bobAt, aliceFor, bobFor, lockTimeout) {
    const row = { stock: 10, version: 1, lock: null };
    const ev = [], sql = [];
    const users = { Alice: { qty: 3, start: 0, think: aliceFor }, Bob: { qty: 2, start: bobAt, think: bobFor } };
    const seg = { Alice: [], Bob: [] }; // {a,b,kind}
    const push = (t, who, msg, kind, extra = {}) => ev.push({ t, who, msg, kind, row: { ...row }, sql: sql.slice(), seg: JSON.parse(JSON.stringify(seg)), ...extra });
    if (strat === 0 || strat === 1) {
      const q = [];
      for (const [n, u] of Object.entries(users)) { q.push({ t: u.start, n, k: "load" }); q.push({ t: u.start + u.think, n, k: "save" }); }
      q.sort((a, b) => a.t - b.t || (a.k === "save" ? -1 : 1) || (a.n === "Alice" ? -1 : 1));
      while (q.length) {
        const e = q.shift(), u = users[e.n];
        if (e.k === "load") {
          u.seen = row.stock; u.ver = row.version;
          sql.push({ sql: `SELECT stock${strat ? ", version" : ""} FROM products WHERE id = 7`, meta: `${e.n}: ${row.stock}${strat ? ` v${row.version}` : ""}` });
          seg[e.n].push({ a: e.t, b: e.t + u.think, kind: "edit" });
          push(e.t, e.n, `${e.n} opens the edit form and reads stock <b>${row.stock}</b>${strat ? ` (version ${row.version})` : ""}. They will sell ${u.qty}, so they will save <b>${row.stock - u.qty}</b>.`, "load");
        } else if (e.k === "save" || e.k === "retry") {
          const val = u.seen - u.qty;
          if (strat === 0) {
            const before = row.stock; row.stock = val; row.version++;
            sql.push({ sql: `UPDATE products SET stock = ${val} WHERE id = 7`, meta: "1 row" });
            const lost = before !== u.seen;
            push(e.t, e.n, `${e.n} saves stock = ${val}. ${lost ? `<b>It silently overwrites</b> the ${before} someone else saved: their sale is <b>lost</b>.` : "Nothing changed since they read it, so this is fine."}`, lost ? "bad" : "ok");
          } else {
            if (row.version === u.ver) {
              row.stock = val; row.version++;
              sql.push({ sql: `UPDATE products SET stock = ${val}, version = ${row.version} WHERE id = 7 AND version = ${u.ver}`, meta: "1 row" });
              push(e.t, e.n, `${e.n}'s UPDATE includes <code>AND version = ${u.ver}</code>. The version still matches: <b>1 row updated</b>, version becomes ${row.version}.`, "ok");
            } else {
              sql.push({ sql: `UPDATE products SET stock = ${val}, version = ${u.ver + 1} WHERE id = 7 AND version = ${u.ver}`, meta: "0 rows", cls: "bad" });
              push(e.t, e.n, `${e.n}'s UPDATE says <code>AND version = ${u.ver}</code>, but the row is at version ${row.version}: <b>0 rows affected</b>. EF Core throws <code>DbUpdateConcurrencyException</code>, JPA <code>OptimisticLockException</code>; the API returns <b>409 Conflict</b> (or 412 with ETags). No data was lost.`, "bad");
              u.seen = row.stock; u.ver = row.version;
              sql.push({ sql: "SELECT stock, version FROM products WHERE id = 7", meta: `${e.n}: ${row.stock} v${row.version}` });
              seg[e.n].push({ a: e.t, b: e.t + 1, kind: "retry" });
              q.unshift({ t: e.t + 1, n: e.n, k: "retry" });
              push(e.t, e.n, `${e.n} reloads (stock ${row.stock}, version ${row.version}) and re-applies the <b>intent</b> "sell ${u.qty}", not the stale number.`, "load");
            }
          }
        }
      }
    } else {
      const A = users.Alice, B = users.Bob;
      sql.push({ sql: "BEGIN; SELECT stock FROM products WHERE id = 7 FOR UPDATE", meta: `Alice: ${row.stock}` });
      row.lock = "Alice"; A.seen = row.stock; seg.Alice.push({ a: 0, b: A.think, kind: "edit" }, { a: 0, b: A.think, kind: "lock" });
      push(0, "Alice", `Alice opens the form. The app runs <code>SELECT … FOR UPDATE</code> in a transaction: the row is <b>locked</b> while she thinks, and so are a connection and an open transaction.`, "lock");
      let bGot;
      if (B.start >= A.think) bGot = B.start;
      else {
        sql.push({ sql: "BEGIN; SELECT stock FROM products WHERE id = 7 FOR UPDATE", meta: "Bob: blocked", cls: "active" });
        push(B.start, "Bob", `Bob opens the form at ${B.start} s. His <code>FOR UPDATE</code> <b>blocks</b>: Alice holds the lock.`, "wait");
        if (A.think - B.start > lockTimeout) {
          seg.Bob.push({ a: B.start, b: B.start + lockTimeout, kind: "wait" });
          sql.push({ sql: "-- lock wait timeout", meta: "Bob: error", cls: "bad" });
          push(B.start + lockTimeout, "Bob", `After ${lockTimeout} s Bob gets a <b>lock timeout</b> error and sees "try again later", while Alice is still just looking at a form.`, "bad", { timeout: true });
        } else { seg.Bob.push({ a: B.start, b: A.think, kind: "wait" }); bGot = A.think; }
      }
      row.stock = A.seen - A.qty; row.version++; row.lock = null;
      sql.push({ sql: `UPDATE products SET stock = ${row.stock} WHERE id = 7; COMMIT`, meta: "1 row" });
      push(A.think, "Alice", `Alice saves ${row.stock} and commits. The lock is released after being held for <b>${A.think} s</b> of human think time.`, "ok");
      if (bGot !== undefined) {
        row.lock = "Bob"; B.seen = row.stock;
        if (bGot !== B.start) sql.push({ sql: "(Bob's SELECT … FOR UPDATE returns)", meta: `Bob: ${row.stock}` });
        else sql.push({ sql: "BEGIN; SELECT stock FROM products WHERE id = 7 FOR UPDATE", meta: `Bob: ${row.stock}` });
        seg.Bob.push({ a: bGot, b: bGot + B.think, kind: "edit" }, { a: bGot, b: bGot + B.think, kind: "lock" });
        push(bGot, "Bob", `Bob's lock is granted at ${bGot} s and he reads the <b>fresh</b> stock ${row.stock}.`, "lock");
        row.stock = B.seen - B.qty; row.version++; row.lock = null;
        sql.push({ sql: `UPDATE products SET stock = ${row.stock} WHERE id = 7; COMMIT`, meta: "1 row" });
        push(bGot + B.think, "Bob", `Bob saves ${row.stock} and commits.`, "ok");
      }
    }
    return { ev, row, seg };
  }
  function occTimeline(seg, now, T) {
    const W = 640, x0 = 70, sx = (W - x0 - 16) / T, H = 104;
    let s = `<svg class="dax-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Alice and Bob timeline: editing, waiting for a lock, holding a lock">`;
    for (let t = 0; t <= T; t += T > 20 ? 5 : T > 10 ? 2 : 1) s += `<line class="grid" x1="${x0 + t * sx}" y1="16" x2="${x0 + t * sx}" y2="${H - 6}"/><text class="ax" x="${x0 + t * sx}" y="11">${t}s</text>`;
    ["Alice", "Bob"].forEach((n, k) => {
      const y = 22 + k * 40;
      s += `<text class="lab" x="${x0 - 8}" y="${y + 18}">${n}</text>`;
      for (const g of seg[n]) {
        const a = Math.min(g.a, now), b = Math.min(g.b, now); if (b <= a && !(g.a === g.b)) continue;
        if (g.kind === "lock") s += `<rect class="seg lockbar" x="${x0 + a * sx}" y="${y + 28}" width="${Math.max(1, (b - a) * sx)}" height="5" rx="2"/>`;
        else s += `<rect class="seg ${g.kind === "edit" ? "run reuse" : g.kind === "wait" ? "wait" : "bad"}" x="${x0 + a * sx}" y="${y + 4}" width="${Math.max(2, (b - a) * sx)}" height="22" rx="4"/>`;
      }
    });
    s += `<line class="now" x1="${x0 + now * sx}" y1="14" x2="${x0 + now * sx}" y2="${H - 2}"/>`;
    return s + "</svg>";
  }
  Viz.register("data-access-occ", (el) => Viz.player(el, {
    title: "Two people edit the same row: no check vs optimistic vs pessimistic",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["done", "editing (form open)"], ["active", "blocked waiting for a lock"], ["bad", "lost update / conflict / timeout"], ["path", "holding a database lock"]],
    codeLang: "csharp",
    code: [
      "[ConcurrencyCheck] public int Version { get; set; } // or [Timestamp] rowversion",
      "var p = await db.Products.FindAsync(7);       // reads stock AND version",
      "p.Stock -= qty;",
      "try { await db.SaveChangesAsync(); }  // UPDATE … WHERE id = 7 AND version = @v",
      "catch (DbUpdateConcurrencyException) { /* reload, re-apply intent, or 409 */ }",
      "// pessimistic: SELECT … FOR UPDATE (Postgres) / WITH (UPDLOCK) (SQL Server)",
    ],
    inputs: [
      { key: "s", label: "strategy", type: "select", options: OCC, value: OCC[1] },
      { key: "bob", label: "Bob opens at (s)", value: "2", width: 70 },
      { key: "af", label: "Alice edits for (s)", value: "6", width: 70 },
      { key: "bf", label: "Bob edits for (s)", value: "2", width: 70 },
      { key: "lt", label: "lock timeout (s)", value: "5", width: 70 },
    ],
    random: () => ({ s: pick(OCC), bob: String(rnd(0, 8)), af: String(rnd(1, 9)), bf: String(rnd(1, 6)), lt: String(rnd(2, 10)) }),
    build: ({ s, bob, af, bf, lt }) => {
      const k = OCC.indexOf(s); if (k < 0) throw new Error("Pick a strategy.");
      const B = int(bob, "Bob opens at", 0, 15), A = int(af, "Alice edits for", 1, 15), BF = int(bf, "Bob edits for", 1, 15), LT = int(lt, "lock timeout", 1, 30);
      const sim = simOcc(k, B, A, BF, LT), fr = [];
      const T = Math.max(8, ...sim.ev.map((e) => e.t), ...Object.values(sim.seg).flat().map((g) => g.b)) + 1;
      fr.push({ T, now: 0, row: { stock: 10, version: 1, lock: null }, sql: [], seg: { Alice: [], Bob: [] }, line: [0], note: `Product 7 has <b>10</b> in stock. Alice will sell 3 and Bob will sell 2, so the right answer is <b>5</b>. Strategy: <b>${esc(s)}</b>.`, vars: { stock: 10, version: 1 } });
      for (const e of sim.ev) fr.push({ T, now: e.t, row: e.row, sql: e.sql, seg: e.seg, kind: e.kind, line: k === 2 ? [5] : e.kind === "load" ? [1] : e.kind === "bad" ? [k === 1 ? 4 : 3] : [3], note: `<b>${e.t} s.</b> ${e.msg}`, vars: { stock: e.row.stock, version: e.row.version, lock: e.row.lock || "none" } });
      const last = fr[fr.length - 1], ok = sim.row.stock === 5, to = sim.ev.some((e) => e.timeout);
      const msg = k === 0 ? (ok ? "No overlap this time, so no harm. Make Bob open the form before Alice saves and watch a sale disappear." : `Final stock <b>${sim.row.stock}</b> instead of 5: a <b>lost update</b>, with no error anywhere. This is the default behaviour of "load, change, save" without a version column.`)
        : k === 1 ? `Final stock <b>${sim.row.stock}</b>. ${ok ? "Correct. " : ""}Optimistic concurrency costs nothing until a conflict happens, holds no locks while people think, and works across stateless HTTP requests (send the version as an ETag, check it with If-Match).`
        : to ? `Final stock <b>${sim.row.stock}</b>: Bob's sale <b>never happened</b>. He timed out while Alice held a lock for her whole think time. Pessimistic locks belong in short server-side transactions, not around user think time.` : `Final stock <b>${sim.row.stock}</b>. Correct, but a database lock, a transaction and a pooled connection were held for ${sim.ev.find((e) => e.who === "Alice" && e.kind === "ok").t} s of human think time. Fine for a 5 ms read-modify-write inside one request, terrible across a form.`;
      fr.push({ ...last, final: true, line: [], note: msg, vars: { ...last.vars, correct: ok ? "yes" : "no" } });
      return fr;
    },
    render: (f) => col(fit(occTimeline(f.seg, f.now, f.T)), panels(kv("row: products id 7", [["stock", String(f.row.stock), f.final ? (f.row.stock === 5 ? "done" : "bad") : ""], ["version", String(f.row.version)], ["locked by", f.row.lock || "nobody", f.row.lock ? "path" : ""]]), sqlList("SQL", f.sql.map((q, i) => ({ ...q, cls: q.cls || (i === f.sql.length - 1 && !f.final ? "path" : "") })), { max: 7 }))),
  }));


  /* =====================================================================
   * 5. Loading related data: lazy vs JOIN vs split vs projection
   * ===================================================================== */
  const LOADS = ["lazy loading", "eager: one JOIN (Include + Include)", "split queries (AsSplitQuery)", "projection to a DTO"];
  const COLS = { o: 4, l: 4, p: 3 };
  function planLoad(k, N, L, P) {
    const ids = Array.from({ length: N }, (_, i) => 101 + i), qs = [];
    if (k === 0) {
      qs.push({ sql: `SELECT * FROM orders ORDER BY id LIMIT ${N}`, rows: ids.map((id) => ({ o: id })), cols: COLS.o, why: "The query you wrote: just the orders." });
      for (const id of ids) {
        qs.push({ sql: `SELECT * FROM order_lines WHERE order_id = ${id}`, rows: Array.from({ length: L }, (_, j) => ({ l: `${id}.L${j + 1}` })), cols: COLS.l, why: `The loop touches <code>order.Lines</code> for order ${id}: a lazy-loading proxy fires a query.` });
        qs.push({ sql: `SELECT * FROM payments WHERE order_id = ${id}`, rows: Array.from({ length: P }, (_, j) => ({ p: `${id}.P${j + 1}` })), cols: COLS.p, why: `Then <code>order.Payments</code>: another query.` });
      }
    } else if (k === 1) {
      const rows = [];
      for (const id of ids) for (let a = 0; a < Math.max(1, L); a++) for (let b = 0; b < Math.max(1, P); b++) rows.push({ o: id, l: L ? `${id}.L${a + 1}` : null, p: P ? `${id}.P${b + 1}` : null, dupO: a + b > 0, dupL: b > 0, dupP: a > 0 });
      qs.push({ sql: "SELECT o.*, l.*, p.* FROM orders o LEFT JOIN order_lines l ON l.order_id = o.id LEFT JOIN payments p ON p.order_id = o.id", rows, cols: COLS.o + COLS.l + COLS.p, why: `One round trip, but two collections joined side by side multiply: each order comes back <b>${Math.max(1, L)} × ${Math.max(1, P)} = ${Math.max(1, L) * Math.max(1, P)}</b> times. That's the <b>cartesian explosion</b>.` });
    } else if (k === 2) {
      const list = ids.join(", ");
      qs.push({ sql: `SELECT * FROM orders ORDER BY id LIMIT ${N}`, rows: ids.map((id) => ({ o: id })), cols: COLS.o, why: "Query 1: the orders." });
      qs.push({ sql: `SELECT l.* FROM order_lines l WHERE l.order_id IN (${list})`, rows: ids.flatMap((id) => Array.from({ length: L }, (_, j) => ({ l: `${id}.L${j + 1}` }))), cols: COLS.l, why: "Query 2: all lines for those orders at once." });
      qs.push({ sql: `SELECT p.* FROM payments p WHERE p.order_id IN (${list})`, rows: ids.flatMap((id) => Array.from({ length: P }, (_, j) => ({ p: `${id}.P${j + 1}` }))), cols: COLS.p, why: "Query 3: all payments. The ORM stitches the three results together in memory." });
    } else {
      qs.push({ sql: "SELECT o.id, o.customer, (SELECT SUM(l.qty * l.price) FROM order_lines l WHERE l.order_id = o.id) AS total, (SELECT COUNT(*) FROM payments p WHERE p.order_id = o.id) AS payments FROM orders o", rows: ids.map((id) => ({ o: id, dto: true })), cols: 4, why: "Ask for what the screen shows: the database aggregates, and only those columns travel. Nothing is tracked." });
    }
    return qs;
  }
  const loadCost = (qs) => ({ trips: qs.length, rows: qs.reduce((s, q) => s + q.rows.length, 0), cells: qs.reduce((s, q) => s + q.rows.length * q.cols, 0) });
  Viz.register("data-access-loading", (el) => Viz.player(el, {
    title: "Loading related data: lazy, one JOIN, split queries, projection",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["path", "order columns"], ["visit", "line columns"], ["done", "payment columns"], ["bad", "duplicated data (sent again)"]],
    codeLang: "csharp",
    code: [
      "var orders = await db.Orders.Take(n).ToListAsync();",
      "foreach (var o in orders) Use(o.Lines, o.Payments); // lazy: 2 queries per order",
      "db.Orders.Include(o => o.Lines).Include(o => o.Payments)        // one JOIN",
      "db.Orders.Include(o => o.Lines).Include(o => o.Payments).AsSplitQuery()",
      "db.Orders.Select(o => new OrderRow(o.Id, o.Customer,",
      "    o.Lines.Sum(l => l.Qty * l.Price), o.Payments.Count()))   // projection",
    ],
    inputs: [
      { key: "k", label: "strategy", type: "select", options: LOADS, value: LOADS[0] },
      { key: "n", label: "orders", value: "3", width: 70 },
      { key: "l", label: "lines per order", value: "3", width: 70 },
      { key: "p", label: "payments per order", value: "2", width: 70 },
    ],
    random: () => ({ k: pick(LOADS), n: String(rnd(1, 6)), l: String(rnd(0, 5)), p: String(rnd(0, 3)) }),
    build: ({ k, n, l, p }) => {
      const K = LOADS.indexOf(k); if (K < 0) throw new Error("Pick a strategy.");
      const N = int(n, "orders", 1, 8), L = int(l, "lines per order", 0, 6), P = int(p, "payments per order", 0, 4);
      const qs = planLoad(K, N, L, P), fr = [], all = LOADS.map((_, i) => loadCost(planLoad(i, N, L, P)));
      const line = [[0, 1], [2], [3], [4, 5]][K];
      fr.push({ qs, shown: 0, K, all, line: [], note: `Show ${N} orders, each with ${L} line${L === 1 ? "" : "s"} and ${P} payment${P === 1 ? "" : "s"}. Strategy: <b>${esc(k)}</b>.`, vars: { "round trips": 0, rows: 0 } });
      qs.forEach((q, i) => {
        const c = loadCost(qs.slice(0, i + 1));
        fr.push({ qs, shown: i + 1, K, all, line: K === 0 ? [i ? 1 : 0] : line, note: `<b>Query ${i + 1}.</b> ${q.why} ${q.rows.length} row${q.rows.length === 1 ? "" : "s"} × ${q.cols} columns.`, vars: { "round trips": c.trips, rows: c.rows, cells: c.cells } });
      });
      const c = all[K];
      const tail = K === 0 ? `<b>${c.trips} round trips</b> for ${N} orders: the <b>N+1</b> problem (here 2N+1). At 1 ms per round trip that's latency you pay serially, and it grows with the page size.` : K === 1 ? `One round trip, but <b>${fmt(c.rows)} rows / ${fmt(c.cells)} cells</b> where split queries need ${fmt(all[2].cells)}. Every extra collection multiplies. EF Core warns about this; use AsSplitQuery or a projection.` : K === 2 ? `<b>${c.trips} round trips</b> and no duplication. The cost: separate queries aren't one consistent snapshot unless you wrap them in a transaction, and an ORDER BY + LIMIT must be repeated correctly.` : `<b>1 round trip, ${c.rows} narrow rows.</b> When you only need to <i>show</i> data, a projection beats loading entities: no tracking, no over-fetching, and the database does the aggregation.`;
      fr.push({ ...fr[fr.length - 1], final: true, line: [], note: tail });
      return fr;
    },
    render: (f) => {
      const blocks = f.qs.slice(0, f.shown).map((q, i) => {
        const cap = 36, rows = q.rows.slice(0, cap).map((r) => {
          if (r.dto) return `<div class="dax-rw"><span class="c path">${r.o}</span><span class="c dto">customer · total · payments</span></div>`;
          const seg = (v, cls, dup) => (v === undefined ? "" : v === null ? `<span class="c nul">NULL</span>` : `<span class="c ${dup ? "bad" : cls}">${v}</span>`);
          return `<div class="dax-rw">${seg(r.o, "path", r.dupO)}${seg(r.l, "visit", r.dupL)}${seg(r.p, "done", r.dupP)}</div>`;
        }).join("");
        return `<div class="dax-qb ${i === f.shown - 1 && !f.final ? "cur" : ""}"><div class="dax-qh"><b>Q${i + 1}</b> <code>${esc(q.sql.length > 92 ? q.sql.slice(0, 90) + "…" : q.sql)}</code><span>${q.rows.length} row${q.rows.length === 1 ? "" : "s"}</span></div><div class="dax-rows">${rows || `<span class="dax-muted">0 rows</span>`}${q.rows.length > cap ? `<span class="dax-muted">+${q.rows.length - cap} more rows</span>` : ""}</div></div>`;
      }).join("");
      const cmp = f.final ? mini("all four strategies, same data", ["strategy", "round trips", "rows", "cells"], LOADS.map((n, i) => ({ cls: i === f.K ? "me" : "", cells: [esc(n), f.all[i].trips, fmt(f.all[i].rows), fmt(f.all[i].cells)] }))) : "";
      return col(`<div class="dax-qs">${blocks || `<span class="dax-muted">no queries yet</span>`}</div>`, cmp);
    },
  }));

  /* =====================================================================
   * 6. Pagination: OFFSET vs keyset (seek)
   * ===================================================================== */
  const PAGERS = ["OFFSET / LIMIT", "keyset (WHERE id < last)"];
  Viz.register("data-access-paging", (el) => Viz.player(el, {
    title: "Pagination: OFFSET reads and throws away; keyset seeks",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["active", "read by the database, then discarded"], ["done", "returned on this page"], ["bad", "returned again (duplicate)"], ["path", "inserted while the user was paging"]],
    codeLang: "sql",
    code: [
      "-- OFFSET: the database walks past every skipped row",
      "SELECT * FROM posts ORDER BY id DESC LIMIT @size OFFSET (@page - 1) * @size;",
      "-- keyset: the cursor is the last id the client saw",
      "SELECT * FROM posts WHERE id < @last_id ORDER BY id DESC LIMIT @size;",
      "-- needs an index on the ORDER BY columns (id here; (created_at, id) in general)",
    ],
    inputs: [
      { key: "m", label: "method", type: "select", options: PAGERS, value: PAGERS[0] },
      { key: "rows", label: "rows in table", value: "30", width: 70 },
      { key: "size", label: "page size", value: "5", width: 70 },
      { key: "pages", label: "pages to read", value: "4", width: 70 },
      { key: "ins", label: "new rows inserted after page 1", value: "2", width: 70 },
    ],
    random: () => ({ m: pick(PAGERS), rows: String(rnd(15, 50)), size: String(rnd(3, 7)), pages: String(rnd(2, 6)), ins: String(rnd(0, 4)) }),
    build: ({ m, rows, size, pages, ins }) => {
      const K = PAGERS.indexOf(m); if (K < 0) throw new Error("Pick a method.");
      const N = int(rows, "rows", 5, 60), S = int(size, "page size", 1, 10), PG = int(pages, "pages", 1, 8), I = int(ins, "inserted rows", 0, 6);
      let table = Array.from({ length: N }, (_, i) => N - i); // ids, newest first
      const seen = new Set(); let last = null, read = 0, dups = 0; const fr = [];
      fr.push({ table: table.slice(), marks: {}, line: [K ? 2 : 0], note: `${N} posts, newest first (ORDER BY id DESC). Page size ${S}. ${I ? `After page 1, <b>${I} new post${I > 1 ? "s" : ""}</b> arrive at the top, as they do on any live feed.` : ""}`, vars: { page: 0, "rows read": 0, duplicates: 0 } });
      for (let p = 1; p <= PG; p++) {
        if (p === 2 && I) {
          const add = Array.from({ length: I }, (_, i) => N + I - i);
          table = add.concat(table);
          fr.push({ table: table.slice(), marks: Object.fromEntries(add.map((id) => [id, "path"])), line: [], note: `${I} new post${I > 1 ? "s are" : " is"} inserted (ids ${add[add.length - 1]}–${add[0]}). Everything below shifts down by ${I} position${I > 1 ? "s" : ""}.`, vars: { page: 1, "rows read": read, duplicates: dups } });
        }
        const marks = {}, prev = last; let got = [], scanned = 0;
        if (K === 0) {
          const off = (p - 1) * S;
          table.slice(0, off).forEach((id) => (marks[id] = "active"));
          got = table.slice(off, off + S); scanned = Math.min(table.length, off + S);
        } else {
          const start = last === null ? 0 : table.findIndex((id) => id < last);
          got = start < 0 ? [] : table.slice(start, start + S); scanned = got.length;
        }
        let d = 0;
        got.forEach((id) => { if (seen.has(id)) { marks[id] = "bad"; d++; } else marks[id] = "done"; });
        got.forEach((id) => seen.add(id)); read += scanned; dups += d;
        if (got.length) last = got[got.length - 1];
        const sqlTxt = `LIMIT ${S} OFFSET ${(p - 1) * S}`;
        const note = K === 0
          ? `<b>Page ${p}</b> (<code>${sqlTxt}</code>): the database reads <b>${scanned}</b> rows from the index and throws away the first ${(p - 1) * S}. ${d ? `<b>${d} duplicate${d > 1 ? "s" : ""}</b>: the inserted rows pushed post${d > 1 ? "s" : ""} the user already saw onto this page.` : got.length ? "" : "Past the end: an empty page."}`
          : `<b>Page ${p}</b>${p > 1 ? ` (<code>WHERE id &lt; ${prev}</code>)` : ""}: an index <b>seek</b> straight to the cursor, then ${got.length} rows. Cost doesn't grow with the page number. ${p === 2 && I ? "The new rows are newer than the cursor, so they don't disturb the pages: no duplicates, no skips." : got.length ? "" : "Past the end: empty page, nothing scanned."}`;
        fr.push({ table: table.slice(), marks, page: p, line: [K ? 3 : 1], note, vars: { page: p, "rows read": read, duplicates: dups, cursor: K ? (last ?? "none") : "n/a" } });
      }
      const deep = 1000 * S;
      fr.push({ ...fr[fr.length - 1], final: true, line: [4], note: `${PG} pages: <b>${read} rows read</b> to return ${PG * S > 0 ? Math.min(PG * S, read) : 0}${dups ? `, <b>${dups} shown twice</b>` : ""}. ${K === 0 ? `Page 1,000 would read ${fmt(deep)} rows to return ${S}. OFFSET is fine for small, stable tables and "jump to page 7" UIs.` : `Page 1,000 still reads ${S} rows. The trade-off: no "jump to page 7", only next/previous, and the sort key must be unique (add id as a tiebreaker).`}`, vars: { ...fr[fr.length - 1].vars, "page 1,000 reads": K ? S : fmt(deep) } });
      return fr;
    },
    render: (f) => {
      const cells = f.table.map((id) => `<span class="dax-cell ${f.marks[id] || ""}">${id}</span>`).join("");
      return col(`<div class="dax-strip-h">posts, ORDER BY id DESC →</div><div class="dax-strip">${cells}</div>`);
    },
  }));

  /* =====================================================================
   * 7. B+tree index seek vs full table scan
   * ===================================================================== */
  const SEEK = ["index seek (B+tree)", "full table scan (no index)"];
  const split = (a, max) => { const g = Math.ceil(a.length / max), base = Math.floor(a.length / g), extra = a.length % g, out = []; let i = 0; for (let k = 0; k < g; k++) { const n = base + (k < extra ? 1 : 0); out.push(a.slice(i, i + n)); i += n; } return out; };
  function buildTree(keys, c) {
    let level = split(keys, c).map((ks) => ({ keys: ks, leaf: true }));
    level.forEach((n, i) => { n.id = `L${i}`; n.min = n.keys[0]; n.next = level[i + 1] || null; });
    const levels = [level];
    while (level.length > 1) {
      const up = split(level, c + 1).map((ch) => ({ ch, keys: ch.slice(1).map((x) => x.min), min: ch[0].min }));
      up.forEach((n, i) => (n.id = `N${levels.length}.${i}`));
      levels.push(up); level = up;
    }
    return levels.reverse();
  }
  function heapOrder(keys) { // deterministic shuffle: rows land in pages in insertion order
    const a = keys.slice(); let s = 7;
    for (let i = a.length - 1; i > 0; i--) { s = (s * 1103515245 + 12345) % 2147483648; const j = s % (i + 1); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  function treeSvg(levels, hl) {
    const KW = 26, PAD = 6, GAP = 12, LH = 64;
    const leaves = levels[levels.length - 1];
    const nodeW = (n) => n.keys.length * KW + PAD * 2 || 30;
    let x = 10; const pos = new Map();
    leaves.forEach((n) => { pos.set(n, { x, y: 10 + (levels.length - 1) * LH, w: nodeW(n) }); x += nodeW(n) + GAP; });
    for (let li = levels.length - 2; li >= 0; li--) levels[li].forEach((n) => {
      const a = pos.get(n.ch[0]), b = pos.get(n.ch[n.ch.length - 1]), w = Math.max(30, nodeW(n));
      pos.set(n, { x: (a.x + b.x + b.w) / 2 - w / 2, y: 10 + li * LH, w });
    });
    const W = x, H = 10 + levels.length * LH - 24;
    let s = `<svg class="dax-tree" viewBox="0 0 ${W} ${H}" width="${Math.min(W, 860)}" role="img" aria-label="B+tree: root, internal pages and linked leaf pages">`;
    for (let li = 0; li < levels.length - 1; li++) levels[li].forEach((n) => { const p = pos.get(n); n.ch.forEach((c, j) => { const q = pos.get(c); s += `<line class="tl ${hl.edges.has(n.id + ">" + c.id) ? "on" : ""}" x1="${p.x + PAD + j * KW}" y1="${p.y + 26}" x2="${q.x + q.w / 2}" y2="${q.y}"/>`; }); });
    leaves.forEach((n) => { if (n.next) { const p = pos.get(n), q = pos.get(n.next); s += `<line class="tl sib ${hl.sib.has(n.id) ? "on" : ""}" x1="${p.x + p.w}" y1="${p.y + 13}" x2="${q.x}" y2="${q.y + 13}"/>`; } });
    for (const lv of levels) for (const n of lv) {
      const p = pos.get(n), cls = hl.nodes.get(n.id) || "";
      s += `<rect class="tn ${cls}" x="${p.x}" y="${p.y}" width="${p.w}" height="26" rx="4"/>`;
      n.keys.forEach((k, j) => { const kc = hl.keys.get(n.id + ":" + k) || ""; s += `<text class="tk ${kc}" x="${p.x + PAD + j * KW + KW / 2}" y="${p.y + 17}">${k}</text>`; });
      if (!n.keys.length) s += `<text class="tk" x="${p.x + p.w / 2}" y="${p.y + 17}">·</text>`;
    }
    return s + "</svg>";
  }
  Viz.register("data-access-btree", (el) => Viz.player(el, {
    title: "How an index finds a row: B+tree seek vs full scan",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["active", "page being read now"], ["visit", "page already read"], ["done", "matching key"], ["path", "path through the tree / leaf chain"]],
    codeLang: "python",
    code: [
      "page = root                                # 1 page read",
      "while not page.is_leaf:",
      "    page = page.child_for(key)             # 1 page read per level",
      "find key in leaf; for a range, follow leaf.next",
      "# no index: read EVERY page of the table, test every row",
      "# depth ~ log_fanout(rows): fanout ~ 200-500 -> 3-4 levels for 100M rows",
    ],
    inputs: [
      { key: "m", label: "access path", type: "select", options: SEEK, value: SEEK[0] },
      { key: "n", label: "rows", value: "24", width: 70 },
      { key: "c", label: "keys per page", value: "3", width: 70 },
      { key: "q", label: "find key, or range lo-hi", value: "41", width: 110 },
    ],
    random: () => { const n = rnd(10, 40); const lo = 3 * rnd(1, n - 2); return { m: pick(SEEK), n: String(n), c: String(rnd(3, 5)), q: Math.random() < 0.6 ? String(lo + rnd(0, 2)) : `${lo}-${lo + rnd(4, 15)}` }; },
    build: ({ m, n, c, q }) => {
      const K = SEEK.indexOf(m); if (K < 0) throw new Error("Pick an access path.");
      const N = int(n, "rows", 4, 48), C = int(c, "keys per page", 2, 6);
      const mq = /^\s*(\d+)\s*(?:-\s*(\d+))?\s*$/.exec(q || ""); if (!mq) throw new Error("find: a key like 41, or a range like 20-35.");
      const lo = int(mq[1], "key", 0, 999), hi = mq[2] !== undefined ? int(mq[2], "range end", lo, 999) : lo;
      const keys = Array.from({ length: N }, (_, i) => 3 * (i + 1) + (i % 3 === 2 ? 1 : 0));
      const levels = buildTree(keys, C), fr = [], heap = heapOrder(keys);
      const pages = []; for (let i = 0; i < heap.length; i += C) pages.push(heap.slice(i, i + C));
      const empty = () => ({ nodes: new Map(), keys: new Map(), edges: new Set(), sib: new Set() });
      const found = keys.filter((k) => k >= lo && k <= hi);
      const what = lo === hi ? `key ${lo}` : `keys ${lo}–${hi}`;
      fr.push({ K, levels, pages, hl: empty(), hp: {}, line: [], note: `${N} rows, ${C} keys per page. ${K === 0 ? `The index is a B+tree ${levels.length} level${levels.length > 1 ? "s" : ""} deep: sorted keys in leaf pages linked left to right, with internal pages that route the search.` : "Without an index the table is a <b>heap</b>: rows sit in pages in insertion order, so the only way to find a value is to look at everything."} Looking for ${what}.`, vars: { "pages read": 0 } });
      let reads = 0;
      if (K === 0) {
        const hl = empty(); let node = levels[0][0], depth = 0;
        while (true) {
          reads++; hl.nodes.set(node.id, "active");
          if (node.leaf) break;
          let j = 0; while (j < node.keys.length && lo >= node.keys[j]) j++;
          const child = node.ch[j];
          fr.push({ K, levels, pages, hl: cloneHl(hl), line: [depth ? 2 : 0], note: `Read ${depth ? "internal" : "root"} page [${node.keys.join(", ")}]: ${lo} ${j === 0 ? `&lt; ${node.keys[0]}` : j === node.keys.length ? `≥ ${node.keys[j - 1]}` : `is between ${node.keys[j - 1]} and ${node.keys[j]}`}, so follow child ${j + 1}.`, vars: { "pages read": reads, level: depth + 1 } });
          hl.nodes.set(node.id, "visit"); hl.edges.add(node.id + ">" + child.id); node = child; depth++;
        }
        let leaf = node, hits = 0;
        while (leaf) {
          const inLeaf = leaf.keys.filter((k) => k >= lo && k <= hi); hits += inLeaf.length;
          inLeaf.forEach((k) => hl.keys.set(leaf.id + ":" + k, "done"));
          const more = leaf.keys.length && leaf.keys[leaf.keys.length - 1] < hi && leaf.next;
          fr.push({ K, levels, pages, hl: cloneHl(hl), line: [3], note: `Leaf page [${leaf.keys.join(", ")}]: ${inLeaf.length ? `<b>${inLeaf.join(", ")}</b> match${inLeaf.length === 1 ? "es" : ""}.` : "no match here."} ${more ? "The range continues, so follow the <b>next-leaf link</b>: no need to go back up the tree." : ""}`, vars: { "pages read": reads, matches: hits } });
          if (!more) break;
          hl.nodes.set(leaf.id, "visit"); hl.sib.add(leaf.id); leaf = leaf.next; reads++; hl.nodes.set(leaf.id, "active");
        }
      } else {
        const hp = {};
        pages.forEach((pg, i) => {
          reads++; Object.keys(hp).forEach((k) => hp[k] === "active" && (hp[k] = "visit")); hp[i] = "active";
          const m = pg.filter((k) => k >= lo && k <= hi);
          fr.push({ K, levels, pages, hl: empty(), hp: { ...hp }, hits: new Set(found.filter((k) => pages.slice(0, i + 1).flat().includes(k))), line: [4], note: `Heap page ${i + 1} of ${pages.length}: [${pg.join(", ")}]${m.length ? ` → <b>${m.join(", ")}</b>` : ""}.${m.length && i < pages.length - 1 ? " Can it stop now? No: without an index it can't know there isn't another match later." : ""}`, vars: { "pages read": reads, matches: found.filter((k) => pages.slice(0, i + 1).flat().includes(k)).length } });
        });
      }
      const idxReads = (() => { let r = levels.length; let leaf = levels[0][0]; while (!leaf.leaf) { let j = 0; while (j < leaf.keys.length && lo >= leaf.keys[j]) j++; leaf = leaf.ch[j]; } while (leaf.keys.length && leaf.keys[leaf.keys.length - 1] < hi && leaf.next) { leaf = leaf.next; r++; } return r; })();
      const last = fr[fr.length - 1];
      fr.push({ ...last, final: true, line: [5], note: `${found.length ? `Found ${found.join(", ")}` : `No row has ${what}`}. <b>${reads} page read${reads === 1 ? "" : "s"}</b> ${K === 0 ? `versus ${pages.length} for a full scan` : `versus ${idxReads} with the index`}. Real pages hold hundreds of keys, so a 100-million-row table is only 3–4 levels deep: 4 reads instead of ~1 million pages.`, vars: { "pages read": reads, "seek would read": idxReads, "scan would read": pages.length } });
      return fr;
      function cloneHl(h) { return { nodes: new Map(h.nodes), keys: new Map(h.keys), edges: new Set(h.edges), sib: new Set(h.sib) }; }
    },
    render: (f) => {
      if (f.K === 0) return fit(treeSvg(f.levels, f.hl));
      const pg = f.pages.map((p, i) => `<div class="dax-page ${f.hp[i] || ""}"><span class="h">page ${i + 1}</span>${p.map((k) => `<span class="k ${f.hits && f.hits.has(k) && f.hp[i] ? "done" : ""}">${k}</span>`).join("")}</div>`).join("");
      return col(`<div class="dax-strip-h">heap (table) pages, in insertion order</div><div class="dax-pages">${pg}</div>`);
    },
  }));


  /* =====================================================================
   * 8. Composite indexes: leftmost prefix, residual filters, key lookups,
   *    covering INCLUDE, ORDER BY ... LIMIT without a sort
   * ===================================================================== */
  const ORD = Array.from({ length: 36 }, (_, k) => { const i = k + 1; return { id: i, customer_id: ((i * 5) % 6) + 1, status: ["open", "paid", "shipped"][(i + Math.floor(i / 6)) % 3], created_at: i, total: 10 + ((i * 37) % 90), note: "…" }; });
  const IDX = [
    { label: "none: only the primary key (id)", cols: [], inc: [] },
    { label: "(customer_id)", cols: ["customer_id"], inc: [] },
    { label: "(customer_id, status)", cols: ["customer_id", "status"], inc: [] },
    { label: "(status, customer_id)", cols: ["status", "customer_id"], inc: [] },
    { label: "(customer_id, created_at)", cols: ["customer_id", "created_at"], inc: [] },
    { label: "(customer_id, created_at) INCLUDE (status, total)", cols: ["customer_id", "created_at"], inc: ["status", "total"] },
  ];
  const PRED = [
    { label: "WHERE customer_id = 4", eq: { customer_id: 4 } },
    { label: "WHERE customer_id = 4 AND status = 'paid'", eq: { customer_id: 4, status: "paid" } },
    { label: "WHERE status = 'paid'", eq: { status: "paid" } },
    { label: "WHERE customer_id = 4 AND created_at > 15", eq: { customer_id: 4 }, range: { col: "created_at", gt: 15 } },
    { label: "WHERE customer_id = 4 ORDER BY created_at DESC LIMIT 2", eq: { customer_id: 4 }, order: { col: "created_at", desc: true }, limit: 2 },
    { label: "WHERE status = 'paid' ORDER BY created_at DESC LIMIT 2", eq: { status: "paid" }, order: { col: "created_at", desc: true }, limit: 2 },
  ];
  const SELS = ["SELECT id", "SELECT id, status, total", "SELECT *"];
  const ALLC = ["id", "customer_id", "status", "created_at", "total", "note"];
  const cv = (c, v) => (c === "customer_id" ? `c${v}` : c === "created_at" ? `d${v}` : c === "total" ? `$${v}` : c === "id" ? `#${v}` : String(v));
  const condLab = (c) => (c.eq !== undefined ? `${c.col} = ${typeof c.eq === "string" ? `'${c.eq}'` : c.eq}` : `${c.col} > ${c.gt}`);
  const condTest = (r, c) => (c.eq !== undefined ? r[c.col] === c.eq : r[c.col] > c.gt);
  function planIdx(ix, pr, sel) {
    const selCols = sel === "SELECT *" ? ALLC : sel.replace("SELECT ", "").split(", ");
    const need = new Set([...selCols, ...Object.keys(pr.eq), ...(pr.range ? [pr.range.col] : []), ...(pr.order ? [pr.order.col] : [])]);
    const has = new Set(["id", ...ix.cols, ...ix.inc]);
    const seek = []; let k = 0;
    for (; k < ix.cols.length; k++) { const c = ix.cols[k]; if (c in pr.eq) seek.push({ col: c, eq: pr.eq[c] }); else break; }
    if (k < ix.cols.length && pr.range && ix.cols[k] === pr.range.col) seek.push({ col: pr.range.col, gt: pr.range.gt });
    const useIdx = seek.length > 0;
    const covering = useIdx && [...need].every((c) => has.has(c));
    const ordered = !!pr.order && useIdx && ix.cols[k] === pr.order.col;
    const conds = [...Object.entries(pr.eq).map(([col, eq]) => ({ col, eq })), ...(pr.range ? [{ col: pr.range.col, gt: pr.range.gt }] : [])];
    const resid = conds.filter((c) => !seek.some((s) => s.col === c.col));
    const residIdx = useIdx ? resid.filter((c) => has.has(c.col)) : [], residRow = useIdx ? resid.filter((c) => !has.has(c.col)) : resid;
    const entries = useIdx ? ORD.slice().sort((a, b) => { for (const c of ix.cols) { if (a[c] < b[c]) return -1; if (a[c] > b[c]) return 1; } return a.id - b.id; }) : ORD.slice();
    let first = 0, last = entries.length - 1;
    if (useIdx) {
      const inR = (r) => seek.every((s) => condTest(r, s));
      first = entries.findIndex(inR); last = -1;
      for (let i = entries.length - 1; i >= 0; i--) if (inR(entries[i])) { last = i; break; }
    }
    const order = []; if (first >= 0) for (let i = first; i <= last; i++) order.push(i);
    if (ordered && pr.order.desc) order.reverse();
    const steps = []; let out = [], lookups = 0;
    for (const i of order) {
      const r = entries[i], st = { i, lookup: false, res: "out" };
      if (!residIdx.every((c) => condTest(r, c))) st.res = "rejIdx";
      else {
        if (useIdx && !covering) { st.lookup = true; lookups++; }
        if (!residRow.every((c) => condTest(r, c))) st.res = "rejRow";
      }
      steps.push(st); if (st.res === "out") out.push(r);
      if (ordered && pr.limit && out.length === pr.limit) break;
    }
    const sorted = !!pr.order && !ordered;
    if (pr.order) out = out.slice().sort((a, b) => (pr.order.desc ? b[pr.order.col] - a[pr.order.col] : a[pr.order.col] - b[pr.order.col]));
    if (pr.limit) out = out.slice(0, pr.limit);
    const plan = []; let d = 0;
    if (pr.limit) plan.push([d++, `Top (${pr.limit})`]);
    if (sorted) plan.push([d++, `Sort (${pr.order.col} DESC)   ← must read every match first`]);
    if (!useIdx) plan.push([d, `Clustered Index Scan (PK_orders)   ${ORD.length} rows   Predicate: ${conds.map(condLab).join(" AND ")}`]);
    else {
      if (!covering) plan.push([d++, "Nested Loops"]);
      plan.push([d, `Index Seek (IX_${ix.cols.join("_")})${ordered && pr.order.desc ? " BACKWARD" : ""}   Seek: ${seek.map(condLab).join(" AND ")}${residIdx.length ? `   Residual: ${residIdx.map(condLab).join(" AND ")}` : ""}`]);
      if (!covering) plan.push([d, `Key Lookup (PK_orders) × ${lookups}${residRow.length ? `   Predicate: ${residRow.map(condLab).join(" AND ")}` : ""}`]);
    }
    return { ix, pr, sel, entries, first, last, steps, seek, k, useIdx, covering, ordered, sorted, residIdx, residRow, out, lookups, read: steps.length, plan, need };
  }
  Viz.register("data-access-composite", (el) => Viz.player(el, {
    title: "Composite indexes: which predicates can seek, and what each read costs",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["path", "inside the seek range"], ["active", "entry being read"], ["done", "row returned"], ["bad", "read, then rejected"], ["visit", "needed a key lookup (↗)"]],
    codeLang: "sql",
    code: [
      "CREATE INDEX IX_orders ON orders (customer_id, status); -- customer, then status",
      "-- seek uses the LEFTMOST columns that have = , then at most one range",
      "-- columns after a range, or after a gap, are only residual filters",
      "-- columns not in the index need a key lookup per entry",
      "CREATE INDEX IX_cover ON orders (customer_id, created_at) INCLUDE (status, total);",
      "-- ORDER BY on the next index column + LIMIT = read just LIMIT entries, no sort",
    ],
    inputs: [
      { key: "ix", label: "index", type: "select", options: IDX.map((x) => x.label), value: IDX[2].label },
      { key: "pr", label: "query", type: "select", options: PRED.map((x) => x.label), value: PRED[1].label },
      { key: "sel", label: "columns", type: "select", options: SELS, value: SELS[2] },
    ],
    random: () => ({ ix: pick(IDX).label, pr: pick(PRED).label, sel: pick(SELS) }),
    build: ({ ix, pr, sel }) => {
      const I = IDX.find((x) => x.label === ix), P = PRED.find((x) => x.label === pr);
      if (!I || !P || !SELS.includes(sel)) throw new Error("Pick an index, a query and the columns.");
      const p = planIdx(I, P, sel), fr = [], all = IDX.map((x) => planIdx(x, P, sel));
      const base = { p, all, marks: {} }, sq = `${sel} FROM orders ${P.label}`;
      const rangeMarks = () => { const m = {}; if (p.useIdx && p.first >= 0) for (let i = p.first; i <= p.last; i++) m[i] = "path"; return m; };
      fr.push({ ...base, line: [0], note: `<code>${esc(sq)}</code> against 36 orders. ${p.useIdx ? `The index <b>${esc(I.label)}</b> keeps a copy of its columns, <b>sorted</b>, each entry pointing back to the row by id.` : I.cols.length ? `The index <b>${esc(I.label)}</b> is sorted by <b>${I.cols[0]}</b> first, and this query doesn't constrain ${I.cols[0]}. Like a phone book sorted by surname when you know only the first name: the matches are scattered. <b>Leftmost-prefix rule</b>: no seek.` : "No secondary index: the table itself, ordered by id, is all there is."}`, vars: { "entries read": 0, "key lookups": 0 } });
      if (p.useIdx) fr.push({ ...base, marks: rangeMarks(), line: [1], note: `<b>Seek</b> on <code>${esc(p.seek.map(condLab).join(" AND "))}</code>: walk the B+tree to the first matching entry (a handful of page reads), and the matches are one <b>contiguous range</b> of ${p.first < 0 ? 0 : p.last - p.first + 1} entr${p.first >= 0 && p.last === p.first ? "y" : "ies"}.${p.residIdx.length ? ` <code>${esc(p.residIdx.map(condLab).join(" AND "))}</code> can't narrow the seek (it isn't next in the key), but it's in the index, so it's checked on each entry: a <b>residual</b> filter.` : ""}${p.residRow.length ? ` <code>${esc(p.residRow.map(condLab).join(" AND "))}</code> isn't in the index at all: each entry needs a <b>key lookup</b> before it can be tested.` : ""}`, vars: { "range size": p.first < 0 ? 0 : p.last - p.first + 1 } });
      else fr.push({ ...base, line: [], note: `<b>Full scan</b>: read all ${ORD.length} rows and test <code>${esc(p.residRow.map(condLab).join(" AND "))}</code> on each. ${I.cols.length ? "(An optimizer might scan the narrower index instead, but it still reads every entry.)" : ""}`, vars: {} });
      const chunk = Math.max(1, Math.ceil(p.steps.length / 14)); let marks = p.useIdx ? rangeMarks() : {}, lk = {}, outN = 0, rej = 0, lkN = 0;
      for (let s = 0; s < p.steps.length; s += chunk) {
        const part = p.steps.slice(s, s + chunk), cur = {};
        for (const st of part) { marks[st.i] = st.res === "out" ? "done" : "bad"; if (st.lookup) { lk[st.i] = 1; lkN++; } if (st.res === "out") outN++; else rej++; cur[st.i] = 1; }
        const st = part[part.length - 1], r = p.entries[st.i];
        const why = st.res === "rejIdx" ? `rejected by the residual filter, without touching the table` : st.res === "rejRow" ? `${st.lookup ? "key lookup, then " : ""}rejected` : `${st.lookup ? "key lookup to fetch the other columns, then " : ""}returned`;
        fr.push({ ...base, marks: { ...marks }, cur, lk: { ...lk }, line: [st.lookup ? 3 : p.useIdx ? 2 : 1], note: chunk > 1 ? `Read entries ${s + 1}–${s + part.length}: ${part.filter((x) => x.res === "out").length} returned, ${part.filter((x) => x.res !== "out").length} rejected.` : `Entry ${s + 1}: order #${r.id} (${p.useIdx ? p.ix.cols.map((c) => cv(c, r[c])).join(", ") : `${cv("customer_id", r.customer_id)}, ${r.status}, ${cv("created_at", r.created_at)}`}): ${why}.${p.ordered && p.pr.limit && outN === p.pr.limit ? ` That's ${p.pr.limit} rows <b>already in ${p.pr.order.col} DESC order</b>, so it <b>stops</b>.` : ""}`, vars: { "entries read": s + part.length, "key lookups": lkN, returned: outN, rejected: rej } });
      }
      if (p.sorted) fr.push({ ...fr[fr.length - 1], cur: {}, line: [], note: `The index isn't ordered by <code>${p.pr.order.col}</code> within this range, so every match is collected and <b>sorted</b> before LIMIT ${p.pr.limit} can apply. On a big table that's a sort of thousands of rows to return ${p.pr.limit}.` });
      const best = all.reduce((m, x) => Math.min(m, x.read + x.lookups * 3), Infinity), mine = p.read + p.lookups * 3;
      fr.push({ ...fr[fr.length - 1], cur: {}, final: true, line: [p.covering ? 4 : p.ordered ? 5 : 0], note: `<b>${p.out.length} row${p.out.length === 1 ? "" : "s"}</b> (${p.out.map((r) => "#" + r.id).join(", ") || "none"}) for <b>${p.read} entries read</b> and <b>${p.lookups} key lookups</b>${p.sorted ? " plus a sort" : ""}. ${p.covering ? "The index <b>covers</b> the query: every column it needs is in the index, so the table is never touched." : p.useIdx && p.lookups ? `Each key lookup is a random read of another page; ${p.sel === "SELECT *" ? "SELECT * guarantees them" : "INCLUDE the missing columns to remove them"}.` : ""} ${mine <= best ? "This is the best index here for this query." : "Compare the table: another index does this with less work."}`, vars: { ...fr[fr.length - 1].vars, sort: p.sorted ? "yes" : "no", covering: p.covering ? "yes" : "no" } });
      return fr;
    },
    render: (f) => {
      const p = f.p, ix = p.ix;
      const chips = p.entries.map((r, i) => {
        const txt = p.useIdx ? `${ix.cols.map((c) => cv(c, r[c])).join("·")}${ix.inc.length ? ` <i>${ix.inc.map((c) => cv(c, r[c])).join(" ")}</i>` : ""} <span class="id">→#${r.id}</span>` : `#${r.id} ${cv("customer_id", r.customer_id)} ${r.status} ${cv("created_at", r.created_at)}`;
        return `<span class="dax-ent ${(f.cur && f.cur[i]) ? "active" : f.marks[i] || ""}">${txt}${f.lk && f.lk[i] ? `<span class="lk">↗</span>` : ""}</span>`;
      }).join("");
      const head = p.useIdx ? `index entries, sorted by (${ix.cols.join(", ")})${ix.inc.length ? `, carrying ${ix.inc.join(", ")}` : ""}` : "table rows, ordered by id (clustered)";
      const plan = `<div class="dax-plan"><div class="dax-kv-h">execution plan</div><pre>${p.plan.map(([d, t]) => esc((d ? "   ".repeat(d - 1) + "└─ " : "") + t)).join("\n")}</pre></div>`;
      const cmp = f.final ? mini("same query, every index", ["index", "read", "lookups", "sort", "covers"], f.all.map((x) => ({ cls: x.ix === ix ? "me" : "", cells: [esc(x.ix.label), x.read, x.lookups, x.sorted ? "yes" : "", x.covering ? "yes" : ""] }))) : "";
      return col(`<div class="dax-strip-h">${esc(head)}</div><div class="dax-ents">${chips}</div>`, plan, cmp);
    },
  }));


  /* =====================================================================
   * 9. Zero-downtime migration: expand / contract vs big bang
   * ===================================================================== */
  const MIGS = ["expand / contract", "expand / contract, but skip the backfill", "big bang: rename column, then deploy", "big bang: deploy, then rename column"];
  const VER = {
    v1: { reads: "name", writes: ["name"], txt: "reads name · writes name" },
    v2: { reads: "name", writes: ["name", "full_name"], txt: "reads name · writes both" },
    v3: { reads: "full_name", writes: ["name", "full_name"], txt: "reads full_name · writes both" },
    v4: { reads: "full_name", writes: ["full_name"], txt: "reads full_name · writes full_name" },
  };
  const PEOPLE = ["Ada Lovelace", "Alan Turing", "Grace Hopper", "Edsger Dijkstra", "Barbara Liskov", "Donald Knuth", "Ken Thompson", "Margaret Hamilton", "Tony Hoare", "Frances Allen", "John Backus", "Niklaus Wirth", "Leslie Lamport", "Radia Perlman", "Linus Torvalds", "Anders Hejlsberg"];
  function simMig(K, n) {
    let schema = ["id", "name"], nullable = false;
    const inst = Array.from({ length: n }, () => "v1");
    const rows = [{ id: 1, name: "Ada Lovelace" }, { id: 2, name: "Alan Turing" }, { id: 3, name: "Grace Hopper" }];
    const fr = []; let errors = 0, wrong = 0, phase = 0, who = 0;
    const PH = K < 2 ? ["v1 live", "expand: add column", "deploy v2 (dual write)", "backfill", "deploy v3 (read new)", "deploy v4 (write new only)", "contract: drop old column"] : ["v1 live", K === 2 ? "rename column" : "deploy new code", K === 2 ? "deploy new code" : "rename column"];
    const tick = (title, note, line, mig) => {
      const per = inst.map((v) => {
        const ver = v === "new" ? VER.v4 : VER[v];
        const ok = schema.includes(ver.reads) && ver.writes.every((c) => schema.includes(c)) && (nullable || ver.writes.includes("name") || !schema.includes("name"));
        const blanks = ok && ver.reads === "full_name" ? rows.filter((r) => r.full_name == null).length : 0;
        return { v, ver, ok, blanks };
      });
      // each healthy-looking instance serves a read; one instance takes a write
      per.forEach((p) => { if (!p.ok) errors++; else if (p.blanks) wrong++; });
      const w = per[who % n]; who++;
      let ins = null;
      if (w.ok && fr.length) { const id = rows.length + 1; const nm = PEOPLE[(id - 1) % PEOPLE.length]; ins = { id }; if (w.ver.writes.includes("name") && schema.includes("name")) ins.name = nm; if (w.ver.writes.includes("full_name") && schema.includes("full_name")) ins.full_name = nm; rows.push(ins); }
      fr.push({ PH, phase, schema: schema.slice(), nullable, per, rows: rows.map((r) => ({ ...r })), ins: ins && ins.id, writer: (who - 1) % n, mig, title, line, note: note + (ins ? ` Meanwhile instance ${((who - 1) % n) + 1} (${w.v === "new" ? "new" : w.v}) inserts row ${ins.id}${ins.full_name == null && schema.includes("full_name") ? `, with <b>full_name NULL</b>` : ""}.` : !w.ok && fr.length ? ` Instance ${((who - 1) % n) + 1}'s insert <b>fails</b>.` : ""), vars: { phase: PH[phase], "failed requests": errors, "wrong answers": wrong, "rows with NULL full_name": schema.includes("full_name") ? rows.filter((r) => r.full_name == null).length : "n/a" } });
    };
    const roll = (to, line, why) => { for (let i = 0; i < n; i++) { inst[i] = to; tick("", `Rolling deploy: instance ${i + 1} of ${n} now runs <b>${to === "new" ? "the new code" : to}</b> (${to === "new" ? VER.v4.txt : VER[to].txt}). ${i < n - 1 ? "The others still run the old version: <b>both versions serve traffic at once</b>." : why}`, line); } };
    tick("", `${n} instances of v1 serve traffic. The column is <code>name</code>; you want it to be <code>full_name</code>. A rolling deploy replaces instances one at a time, so <b>old and new code always overlap</b>.`, 0);
    if (K < 2) {
      phase = 1; schema.push("full_name"); nullable = true;
      tick("", `<b>Expand.</b> <code>ALTER TABLE people ADD full_name text NULL</code> and make <code>name</code> nullable. Adding a nullable column is a metadata-only change on modern engines. v1 doesn't know the column exists, so nothing breaks.`, 1, "ALTER TABLE people ADD full_name text NULL; ALTER TABLE people ALTER name DROP NOT NULL;");
      phase = 2; roll("v2", 2, "Every instance now writes <b>both</b> columns. Old rows still have full_name NULL.");
      if (K === 0) {
        phase = 3; rows.forEach((r) => { if (r.full_name == null) r.full_name = r.name; });
        tick("", `<b>Backfill</b> in small batches: <code>UPDATE people SET full_name = name WHERE full_name IS NULL</code> (e.g. 1,000 rows per transaction, to keep locks short). It runs <i>after</i> every instance dual-writes, so no new NULLs can appear behind it.`, 3, "UPDATE people SET full_name = name WHERE full_name IS NULL AND id BETWEEN @lo AND @hi;");
      } else {
        phase = 3; tick("", `The backfill is <b>skipped</b>. Old rows still have <code>full_name</code> NULL, and nobody notices yet because everyone still reads <code>name</code>.`, 3);
      }
      phase = 4; roll("v3", 4, K === 0 ? "Reads now come from full_name. Because both columns are still written, you can <b>roll back</b> to v2 at any point." : "Instances on v3 read full_name and get <b>NULL for every old row</b>: blank names in the UI.");
      phase = 5; roll("v4", 5, "Nothing writes <code>name</code> any more.");
      phase = 6; schema = schema.filter((c) => c !== "name"); rows.forEach((r) => delete r.name);
      tick("", `<b>Contract.</b> <code>ALTER TABLE people DROP COLUMN name</code>, once v4 has run long enough that you won't roll back past it.${K === 0 ? " Zero errors, at the cost of 6 steps and 3 deploys." : ""}`, 6, "ALTER TABLE people DROP COLUMN name;");
    } else {
      const ren = () => { phase = K === 2 ? 1 : 2; schema = ["id", "full_name"]; rows.forEach((r) => { r.full_name = r.name; delete r.name; }); };
      if (K === 2) {
        ren(); tick("", `<code>ALTER TABLE people RENAME COLUMN name TO full_name</code>. It's instant, and <b>every running instance breaks at once</b>: v1 still asks for <code>name</code>.`, 1, "ALTER TABLE people RENAME COLUMN name TO full_name;");
        phase = 2; roll("new", 2, "Fully deployed: the errors stop. But every request between the rename and this moment failed, and rolling back the code would break again.");
      } else {
        phase = 1; roll("new", 2, "All instances run code that expects full_name, which doesn't exist yet. 100% errors.");
        ren(); tick("", `Now the rename runs and the new code starts working. Every request from the first new instance until now failed, and old instances couldn't take over.`, 1, "ALTER TABLE people RENAME COLUMN name TO full_name;");
      }
    }
    return fr;
  }
  Viz.register("data-access-migrate", (el) => Viz.player(el, {
    title: "Renaming a column without downtime: expand / contract vs big bang",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["done", "healthy instance"], ["bad", "failing instance"], ["active", "wrong data (NULL)"], ["path", "row written this step"]],
    codeLang: "sql",
    code: [
      "-- 0. v1 reads/writes name",
      "-- 1. EXPAND:   ADD full_name NULL      (old code ignores it)",
      "-- 2. deploy v2: write name AND full_name",
      "-- 3. BACKFILL: UPDATE … SET full_name = name WHERE full_name IS NULL (batches)",
      "-- 4. deploy v3: read full_name, still write both   (rollback-safe)",
      "-- 5. deploy v4: write full_name only",
      "-- 6. CONTRACT: DROP COLUMN name",
    ],
    inputs: [
      { key: "k", label: "strategy", type: "select", options: MIGS, value: MIGS[0] },
      { key: "n", label: "instances", value: "3", width: 60 },
    ],
    random: () => ({ k: pick(MIGS), n: String(rnd(2, 4)) }),
    build: ({ k, n }) => {
      const K = MIGS.indexOf(k); if (K < 0) throw new Error("Pick a strategy.");
      const fr = simMig(K, int(n, "instances", 2, 4)), last = fr[fr.length - 1], v = last.vars;
      fr.push({ ...last, ins: null, final: true, line: [], note: `${v["failed requests"] ? `<b>${v["failed requests"]} failed requests.</b> ` : "<b>No failed requests.</b> "}${v["wrong answers"] ? `<b>${v["wrong answers"]} wrong answers</b> (blank names). ` : ""}${K === 0 ? "Every step is backward compatible with the code running next to it, so each deploy can be rolled back. That's the whole trick: <b>never make a change the currently running code can't handle</b>." : K === 1 ? "The backfill isn't optional: it's what makes the read switch safe. The data is now fixable with a late UPDATE, but users already saw blanks." : "One-step renames are only safe if you can stop all traffic. Tools like EF Core migrations or Flyway will happily generate them; it's on you to split them."}` });
      return fr;
    },
    render: (f) => {
      const ph = `<div class="dax-phases">${f.PH.map((p, i) => `<span class="${i === f.phase ? "active" : i < f.phase ? "done" : ""}">${i}. ${esc(p)}</span>`).join("")}</div>`;
      const sch = `<div class="dax-schema"><b>people</b>${f.schema.map((c) => `<span class="${c === "full_name" ? "path" : ""}">${c}${c === "name" && f.nullable ? " NULL" : ""}</span>`).join("")}</div>`;
      const inst = `<div class="dax-insts">${f.per.map((p, i) => `<div class="dax-inst ${p.ok ? (p.blanks ? "active" : "done") : "bad"} ${f.writer === i && !f.final ? "w" : ""}"><b>instance ${i + 1}</b><span>${p.v === "new" ? "new code" : p.v}</span><small>${esc(p.v === "new" ? "reads/writes full_name" : p.ver.txt)}</small><em>${p.ok ? (p.blanks ? `${p.blanks} blank names` : "200 OK") : "500: column missing"}</em></div>`).join("")}</div>`;
      const cols = ["id", "name", "full_name"].filter((c) => f.schema.includes(c));
      const rows = mini("", cols, f.rows.slice(-7).map((r) => ({ cls: r.id === f.ins ? "path" : "", cells: cols.map((c) => (r[c] == null ? `<span class="dax-was">NULL</span>` : esc(String(r[c])))) })));
      return col(ph, panels(sch, f.mig ? `<div class="dax-sql"><div class="dax-sql-r active"><code>${esc(f.mig)}</code></div></div>` : ""), inst, rows);
    },
  }));

  /* =====================================================================
   * 10. Batching and bulk operations: where the time goes
   * ===================================================================== */
  const BATCH = ["row by row, autocommit", "row by row, one transaction", "batched multi-row INSERT", "bulk copy (COPY / SqlBulkCopy)"];
  function batchCost(k, n, rtt, b) {
    const stmt = 0.05, row = 0.01, flush = 1;
    if (k === 0) return { net: n * rtt, srv: n * (stmt + row), commit: n * flush, trips: n, commits: n };
    if (k === 1) return { net: (n + 2) * rtt, srv: n * (stmt + row), commit: flush, trips: n + 2, commits: 1 };
    if (k === 2) { const t = Math.ceil(n / b); return { net: (t + 2) * rtt, srv: t * stmt + n * row, commit: flush, trips: t + 2, commits: 1 }; }
    return { net: 2 * rtt + n * 0.0008, srv: n * row * 0.4, commit: flush, trips: 2, commits: 1 };
  }
  const tot = (c) => c.net + c.srv + c.commit;
  Viz.register("data-access-batch", (el) => Viz.player(el, {
    title: "Inserting many rows: round trips, commits and bulk paths",
    tag: "INTERACTIVE · CALCULATOR",
    legend: [["active", "network round trips"], ["path", "server work"], ["bad", "commit (log flush)"]],
    codeLang: "csharp",
    code: [
      "foreach (var r in rows) { db.Add(r); await db.SaveChangesAsync(); } // N commits",
      "await using var tx = await db.Database.BeginTransactionAsync(); // 1 commit",
      "db.AddRange(rows); await db.SaveChangesAsync(); // EF: ~42 statements per trip",
      "using var bulk = new SqlBulkCopy(conn) { DestinationTableName = \"events\" };",
      "await bulk.WriteToServerAsync(reader); // Postgres: COPY events FROM STDIN",
    ],
    inputs: [
      { key: "k", label: "method", type: "select", options: BATCH, value: BATCH[0] },
      { key: "n", label: "rows", value: "10000", width: 80 },
      { key: "rtt", label: "round trip (ms)", value: "0.5", width: 70 },
      { key: "b", label: "rows per batch", value: "500", width: 70 },
    ],
    random: () => ({ k: pick(BATCH), n: String(pick([100, 1000, 10000, 50000])), rtt: String(pick([0.2, 0.5, 1, 5, 20])), b: String(pick([50, 100, 500, 1000])) }),
    build: ({ k, n, rtt, b }) => {
      const K = BATCH.indexOf(k); if (K < 0) throw new Error("Pick a method.");
      const N = int(n, "rows", 1, 1000000), R = num(rtt, "round trip", 0.05, 200), B = int(b, "rows per batch", 1, 10000);
      const all = BATCH.map((_, i) => batchCost(i, N, R, B)), c = all[K], fr = [];
      const stmts = [];
      const show = Math.min(3, K === 0 || K === 1 ? N : K === 2 ? Math.ceil(N / B) : 1);
      fr.push({ all, K, stmts: [], line: [], note: `Insert <b>${fmt(N)} rows</b> over a network with a <b>${ms(R)}</b> round trip (same rack ≈ 0.2–0.5 ms, cross-region 20–80 ms). The model: ${ms(R)} per round trip, ~0.05 ms to parse/plan a statement, ~0.01 ms per row, ~1 ms to flush the log on each commit.`, vars: { rows: fmt(N) } });
      if (K === 1) stmts.push({ sql: "BEGIN", meta: ms(R) });
      for (let i = 0; i < show; i++) {
        if (K === 3) stmts.push({ sql: `COPY events FROM STDIN (BINARY)  -- streams ${fmt(N)} rows`, meta: "1 stream" });
        else if (K === 2) { const lo = i * B + 1, hi = Math.min(N, (i + 1) * B); stmts.push({ sql: `INSERT INTO events VALUES (@p0,@p1),(…) -- rows ${lo}–${hi}`, meta: `${ms(R)} + ${hi - lo + 1} rows` }); }
        else stmts.push({ sql: `INSERT INTO events VALUES (@p0, @p1)  -- row ${i + 1}`, meta: K === 0 ? `${ms(R)} + commit 1 ms` : ms(R) });
        stmts.forEach((s, j) => (s.cls = j === stmts.length - 1 ? "active" : ""));
        fr.push({ all, K, stmts: stmts.map((s) => ({ ...s })), line: [K === 3 ? 4 : K], note: K === 0 ? `Statement ${i + 1}: one round trip <b>and</b> one commit. Autocommit means every INSERT is its own transaction, so the log is flushed to disk ${fmt(N)} times.` : K === 1 ? `Statement ${i + 1}: still a round trip per row, but the commit happens once at the end.` : K === 2 ? `Batch ${i + 1}: ${fmt(Math.min(B, N - i * B))} rows in one statement. Watch the limits: SQL Server allows 2,100 parameters per command, Postgres 65,535.` : `One COPY stream. Rows flow without per-statement parsing, and many engines log bulk loads minimally.`, vars: { "round trips so far": stmts.length } });
        if (K === 3) break;
      }
      const more = c.trips - stmts.length - (K === 0 ? 0 : 1);
      if (more > 0) stmts.push({ sql: `… ${fmt(more)} more round trip${more > 1 ? "s" : ""}`, meta: "", cls: "dim" });
      if (K > 0) stmts.push({ sql: "COMMIT", meta: `${ms(R)} + flush 1 ms`, cls: "bad" });
      const slow = Math.max(...all.map(tot)), fast = Math.min(...all.map(tot));
      fr.push({ all, K, stmts, final: true, line: [], note: `<b>${ms(tot(c))}</b> in total: ${ms(c.net)} on the network, ${ms(c.srv)} of server work, ${ms(c.commit)} of commits. ${K === 0 ? `Almost nothing is spent inserting: it's all <b>waiting</b>. ` : ""}The slowest method here is <b>${Math.round(slow / fast)}×</b> the fastest. Raise the round trip to 20 ms (another region) and watch row-by-row explode.`, vars: { "round trips": fmt(c.trips), commits: fmt(c.commits), total: ms(tot(c)) } });
      return fr;
    },
    render: (f) => {
      const max = Math.max(...f.all.map(tot));
      const bars = f.final ? `<div class="dax-bars">${f.all.map((c, i) => { const w = (x) => (100 * x) / max; return `<div class="dax-bar ${i === f.K ? "me" : ""}"><span class="l">${esc(BATCH[i])}</span><span class="t"><i class="net" style="width:${w(c.net)}%"></i><i class="srv" style="width:${w(c.srv)}%"></i><i class="cmt" style="width:${w(c.commit)}%"></i></span><span class="v">${ms(tot(c))}</span></div>`; }).join("")}</div>` : "";
      return col(sqlList("sent to the database", f.stmts, { max: 8 }), bars);
    },
  }));


  /* =====================================================================
   * 11. Read replicas: replication lag and read-your-writes
   * ===================================================================== */
  const ROUTES = ["all reads → replica", "sticky: primary for a window after a write", "replica, but wait for my write's LSN", "all reads → primary"];
  function parseScript(s) {
    const parts = String(s || "").split(/[\s,]+/).filter(Boolean);
    if (!parts.length || parts.length > 10) throw new Error("events: 1–10 items like w@0, r@120.");
    const ev = parts.map((p) => { const m = /^([wr])@(\d+)$/i.exec(p); if (!m) throw new Error(`events: can't read "${p}". Use w@TIME or r@TIME (ms).`); return { k: m[1].toLowerCase(), t: int(m[2], `"${p}" time`, 0, 10000) }; });
    return ev.map((e, i) => ({ ...e, i })).sort((a, b) => a.t - b.t || a.i - b.i);
  }
  function tlSvg(f) {
    const W = 760, x0 = 86, x1 = W - 20, yP = 40, yR = 110, H = 150, sx = (x1 - x0) / f.T, X = (t) => x0 + t * sx;
    let s = `<svg class="dax-tl" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Primary and replica timeline: writes, replication and reads">`;
    s += `<text class="lab" x="${x0 - 10}" y="${yP + 4}">primary</text><text class="lab" x="${x0 - 10}" y="${yR + 4}">replica</text>`;
    s += `<line class="lane" x1="${x0}" y1="${yP}" x2="${x1}" y2="${yP}"/><line class="lane" x1="${x0}" y1="${yR}" x2="${x1}" y2="${yR}"/>`;
    for (let t = 0; t <= f.T; t += f.step) s += `<line class="tick" x1="${X(t)}" y1="${yR + 14}" x2="${X(t)}" y2="${yR + 18}"/><text class="tt" x="${X(t)}" y="${yR + 30}">${t}</text>`;
    for (const e of f.done) {
      if (e.k === "w") {
        s += `<line class="rep" x1="${X(e.t)}" y1="${yP}" x2="${X(e.apply)}" y2="${yR}"/><circle class="wr" cx="${X(e.t)}" cy="${yP}" r="7"/><text class="vl" x="${X(e.t)}" y="${yP - 12}">v${e.v}</text>`;
        if (e.apply <= f.now) s += `<circle class="ap" cx="${X(e.apply)}" cy="${yR}" r="4"/>`;
      } else {
        const y = e.on === "primary" ? yP : yR, cls = e.stale ? "stale" : e.wait ? "wait" : "ok";
        if (e.wait) s += `<line class="wt" x1="${X(e.t)}" y1="${y}" x2="${X(e.t + e.wait)}" y2="${y}"/>`;
        const xr = X(e.t + (e.wait || 0));
        s += `<rect class="rd ${cls}" x="${xr - 6}" y="${y - 6}" width="12" height="12" rx="2"/><text class="vl ${cls}" x="${xr}" y="${y + (e.on === "primary" ? 22 : -12)}">v${e.got}${e.stale ? " ✗" : ""}</text>`;
      }
    }
    if (f.now !== null) s += `<line class="now" x1="${X(f.now)}" y1="18" x2="${X(f.now)}" y2="${yR + 14}"/>`;
    return s + "</svg>";
  }
  Viz.register("data-access-replica", (el) => Viz.player(el, {
    title: "Read replicas: lag, stale reads and read-your-writes",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["path", "write on the primary"], ["visit", "replication (applied after the lag)"], ["done", "fresh read"], ["bad", "stale read"], ["active", "read that waited"]],
    codeLang: "text",
    code: [
      "write  → primary, returns its LSN (log position) to the client",
      "read   → replica  (fast, scales out, but may be behind)",
      "sticky → primary if this user wrote in the last N ms",
      "LSN    → replica waits until replay_lsn >= the client's last write LSN",
      "read   → primary  (always fresh, primary does all the work)",
    ],
    inputs: [
      { key: "r", label: "routing", type: "select", options: ROUTES, value: ROUTES[0] },
      { key: "lag", label: "replica lag (ms)", value: "400", width: 70 },
      { key: "win", label: "sticky window (ms)", value: "1000", width: 70 },
      { key: "ev", label: "events (w@ms, r@ms)", value: "w@0, r@100, r@600, w@1000, r@1050, r@1800", width: 260 },
    ],
    random: () => { let t = 0; const ev = []; for (let i = 0; i < rnd(4, 8); i++) { t += rnd(30, 600); ev.push(`${i === 0 || Math.random() < 0.3 ? "w" : "r"}@${t}`); } return { r: pick(ROUTES), lag: String(pick([0, 100, 300, 500, 1200])), win: String(pick([200, 1000, 2000])), ev: ev.join(", ") }; },
    build: ({ r, lag, win, ev }) => {
      const K = ROUTES.indexOf(r); if (K < 0) throw new Error("Pick a routing rule.");
      const L = int(lag, "lag", 0, 5000), Wn = int(win, "sticky window", 0, 10000), E = parseScript(ev);
      const writes = [], done = [], fr = []; let v = 0, stale = 0, onP = 0, onR = 0, waited = 0, lastW = null;
      const T0 = Math.max(...E.map((e) => e.t + (e.k === "w" ? L : 0)), 1);
      const T = Math.ceil((Math.max(T0, ...E.map((e) => e.t + L)) * 1.06) / 100) * 100 || 100, step = T <= 1000 ? 100 : T <= 3000 ? 500 : 1000;
      const base = () => ({ T, step, done: done.map((d) => ({ ...d })) });
      fr.push({ ...base(), now: null, line: [], note: `One primary takes every write; a replica replays the primary's log about <b>${L} ms</b> behind. One user does: ${E.map((e) => `${e.k === "w" ? "write" : "read"} at ${e.t} ms`).join(", ")}. Routing: <b>${esc(r)}</b>.`, vars: { lag: `${L} ms` } });
      for (const e of E) {
        let note, line;
        if (e.k === "w") {
          v++; lastW = e.t; const w = { k: "w", t: e.t, v, apply: e.t + L }; writes.push(w); done.push(w); line = 0;
          note = `<b>Write v${v}</b> at ${e.t} ms commits on the primary. The replica will have it at ${e.t + L} ms.`;
        } else {
          const latest = writes.length, onRep = writes.filter((w) => w.apply <= e.t).length;
          let on = "replica", got = onRep, wait = 0;
          if (K === 3) { on = "primary"; got = latest; line = 4; }
          else if (K === 1 && lastW !== null && e.t - lastW < Wn) { on = "primary"; got = latest; line = 2; }
          else if (K === 2 && onRep < latest) { wait = writes[latest - 1].apply - e.t; got = latest; waited += wait; line = 3; }
          else line = K === 1 ? 2 : K === 2 ? 3 : 1;
          const st = got < latest; if (st) stale++; if (on === "primary") onP++; else onR++;
          done.push({ k: "r", t: e.t, on, got, wait, stale: st });
          note = latest === 0 ? `Read at ${e.t} ms from the <b>${on}</b>: nothing written yet, nothing to be stale about.`
            : st ? `Read at ${e.t} ms goes to the <b>replica</b>, which only has v${got}: the user wrote v${latest} ${e.t - lastW} ms ago and <b>doesn't see their own change</b>. ${K === 1 ? `The sticky window (${Wn} ms) is shorter than the lag.` : ""}`
            : wait ? `Read at ${e.t} ms: the client sends the LSN of its last write; the replica is behind, so it <b>waits ${wait} ms</b> until it has replayed v${latest}, then answers. Fresh, at the cost of latency.`
            : `Read at ${e.t} ms from the <b>${on}</b>: gets v${got}, which is current.${on === "primary" && K === 1 ? " (inside the sticky window)" : ""}`;
        }
        fr.push({ ...base(), now: e.t, line: [line], note, vars: { "stale reads": stale, "reads on primary": onP, "reads on replica": onR, "time spent waiting": `${waited} ms` } });
      }
      const reads = onP + onR;
      fr.push({ ...fr[fr.length - 1], now: null, final: true, line: [], note: `${reads} read${reads === 1 ? "" : "s"}: <b>${stale} stale</b>, ${onP} on the primary, ${onR} on the replica${waited ? `, ${waited} ms spent waiting` : ""}. ${K === 0 ? "Fine for a product catalogue; wrong for \"I just changed my address and it's still the old one\"." : K === 1 ? "Cheap and usually enough, as long as the window is longer than your worst lag (and the user doesn't switch devices)." : K === 2 ? "The most precise fix: only reads that would actually be stale pay, and they pay only the remaining lag." : "Always correct, but the replica is idle and the primary does all the reads. That defeats the point of a replica."}` });
      return fr;
    },
    render: (f) => fit(tlSvg(f)),
  }));

  /* =====================================================================
   * 12. SQL injection: concatenation vs parameters, tokenized and run
   * ===================================================================== */
  const INJ = ["string concatenation", "parameterized (@name)"];
  const SAMPLES = ["bob", "' OR '1'='1", "x' OR 1=1 --", "'; DROP TABLE users; --", "O'Brien", "eve' --"];
  const USERS = [{ id: 1, name: "ada", role: "admin", active: 1 }, { id: 2, name: "bob", role: "user", active: 1 }, { id: 3, name: "eve", role: "user", active: 0 }, { id: 4, name: "O'Brien", role: "user", active: 1 }];
  const PRE = "SELECT id, name, role FROM users WHERE name = '", POST = "' AND active = 1";
  function sqlTokens(s) {
    const t = []; let i = 0;
    while (i < s.length) {
      const c = s[i], st = i;
      if (/\s/.test(c)) { i++; continue; }
      if (c === "-" && s[i + 1] === "-") { t.push({ k: "comment", v: s.slice(i), a: i, b: s.length }); break; }
      if (c === "'") { i++; let v = ""; let closed = false; while (i < s.length) { if (s[i] === "'" && s[i + 1] === "'") { v += "'"; i += 2; continue; } if (s[i] === "'") { i++; closed = true; break; } v += s[i++]; } t.push({ k: closed ? "str" : "bad", v, a: st, b: i, un: !closed }); continue; }
      if (/\d/.test(c)) { while (i < s.length && /\d/.test(s[i])) i++; t.push({ k: "num", v: Number(s.slice(st, i)), a: st, b: i }); continue; }
      if (/[A-Za-z_@]/.test(c)) { while (i < s.length && /[\w@]/.test(s[i])) i++; const w = s.slice(st, i); t.push({ k: /^(SELECT|FROM|WHERE|AND|OR|DROP|TABLE|DELETE|UPDATE|SET|INSERT|INTO|VALUES)$/i.test(w) ? "kw" : "id", v: w, a: st, b: i }); continue; }
      if (c === "<" && s[i + 1] === ">") { t.push({ k: "op", v: "<>", a: i, b: i + 2 }); i += 2; continue; }
      if ("=,;()*".includes(c)) { t.push({ k: c === ";" ? "semi" : "op", v: c, a: i, b: i + 1 }); i++; continue; }
      t.push({ k: "bad", v: c, a: i, b: i + 1 }); i++;
    }
    return t;
  }
  function parseWhere(tk, params) {
    let p = 0;
    const peek = () => tk[p], kw = (w) => tk[p] && tk[p].k === "kw" && tk[p].v.toUpperCase() === w;
    const atom = () => {
      const t = tk[p++]; if (!t) throw new Error("unexpected end of statement");
      if (t.k === "op" && t.v === "(") { const e = orE(); if (!(tk[p] && tk[p].v === ")")) throw new Error("missing )"); p++; return e; }
      if (t.k === "str" || t.k === "num") return () => t.v;
      if (t.k === "id" && t.v.startsWith("@")) { if (!(t.v in params)) throw new Error(`unknown parameter ${t.v}`); return () => params[t.v]; }
      if (t.k === "id" && ["id", "name", "role", "active"].includes(t.v.toLowerCase())) return (r) => r[t.v.toLowerCase()];
      if (t.k === "bad") throw new Error(t.un ? "unclosed quotation mark" : `unexpected character ${JSON.stringify(t.v)}`);
      throw new Error(`syntax error near ${JSON.stringify(String(t.v))}`);
    };
    const cmp = () => { const a = atom(); const t = peek(); if (t && t.k === "op" && (t.v === "=" || t.v === "<>")) { p++; const b = atom(); return t.v === "=" ? (r) => String(a(r)) === String(b(r)) : (r) => String(a(r)) !== String(b(r)); } return (r) => { const x = a(r); return x !== 0 && x !== "" && x !== "0"; }; };
    const andE = () => { let a = cmp(); while (kw("AND")) { p++; const l = a, b = cmp(); a = (r) => l(r) && b(r); } return a; };
    const orE = () => { let a = andE(); while (kw("OR")) { p++; const l = a, b = andE(); a = (r) => l(r) || b(r); } return a; };
    const e = orE(); if (p < tk.length) throw new Error(`syntax error near ${JSON.stringify(String(tk[p].v))}`);
    return e;
  }
  Viz.register("data-access-injection", (el) => Viz.player(el, {
    title: "SQL injection: when data becomes code",
    tag: "INTERACTIVE · STEP THROUGH",
    legend: [["path", "SQL the developer wrote"], ["done", "user input, safely inside a value"], ["bad", "user input that became SQL syntax"], ["dim", "commented out"]],
    codeLang: "csharp",
    code: [
      "var sql = \"SELECT … FROM users WHERE name = '\" + name + \"' AND active = 1\";",
      "conn.Query(sql);       // the input is spliced into the SQL text",
      "conn.Query(\"SELECT … FROM users WHERE name = @name AND active = 1\",",
      "           new { name }); // the input travels separately, as a value",
    ],
    inputs: [
      { key: "m", label: "how the query is built", type: "select", options: INJ, value: INJ[0] },
      { key: "s", label: "name typed into the login box", value: SAMPLES[1], width: 220 },
    ],
    random: () => ({ m: pick(INJ), s: pick(SAMPLES) }),
    build: ({ m, s }) => {
      const K = INJ.indexOf(m); if (K < 0) throw new Error("Pick how the query is built.");
      const input = String(s ?? ""); if (input.length > 60 || /[\r\n]/.test(input)) throw new Error("name: one line, 60 characters at most.");
      const sql = K === 0 ? PRE + input + POST : "SELECT id, name, role FROM users WHERE name = @name AND active = 1";
      const uA = K === 0 ? PRE.length : -1, uB = K === 0 ? PRE.length + input.length : -1;
      const tk = sqlTokens(sql), fr = [];
      tk.forEach((t) => {
        const user = K === 0 && t.a < uB && t.b > uA;
        t.cls = t.k === "comment" ? "dim" : !user ? "path" : t.k === "str" && t.a <= uA - 1 && t.b >= uB + 1 ? "done" : "bad";
      });
      const base = { K, sql, uA, uB, tk, input };
      fr.push({ ...base, stage: 0, line: [K ? 2 : 0], note: K === 0 ? `The code glues the typed name between two pieces of SQL. Whatever the user types becomes part of the <b>SQL text</b> the database parses.` : `The SQL text is fixed: <code>@name</code> is a placeholder. The typed name is sent <b>separately</b>, as a value, in the protocol's parameter slot.`, vars: { input: input || "(empty)" } });
      const intruders = tk.filter((t) => t.cls === "bad");
      fr.push({ ...base, stage: 1, line: [K ? 2 : 0], note: K === 0 ? (intruders.length ? `The database <b>tokenizes</b> the text. The user's input produced <b>${intruders.length} token${intruders.length > 1 ? "s" : ""} of SQL syntax</b> (${intruders.slice(0, 5).map((t) => `<code>${esc(String(t.k === "str" ? `'${t.v}'` : t.v))}</code>`).join(" ")}): the quote in the input <b>ended the string early</b>.` : `The database tokenizes the text. This input stays inside the string literal, so it's harmless <i>this time</i>. Safety depends on what users type.`) : `Tokenized: the developer's SQL only. There is no way for the value to change the shape of the statement.`, vars: { tokens: tk.length, "tokens from input": intruders.length } });
      const stmts = []; let cur = [];
      for (const t of tk) { if (t.k === "comment") continue; if (t.k === "semi") { if (cur.length) stmts.push(cur); cur = []; } else cur.push(t); }
      if (cur.length) stmts.push(cur);
      const params = K ? { "@name": input } : {};
      let rows = null, err = null, dropped = false;
      try {
        const st = stmts[0] || [], w = st.findIndex((t) => t.k === "kw" && t.v.toUpperCase() === "WHERE");
        if (w < 0) throw new Error("syntax error");
        const pred = parseWhere(st.slice(w + 1), params);
        rows = USERS.filter(pred);
      } catch (e) { err = e.message; }
      const extra = stmts.slice(1).map((st) => st.map((t) => (t.k === "str" ? `'${t.v}'` : t.v)).join(" "));
      if (!err) dropped = extra.some((x) => /^DROP\s+TABLE\s+users\b/i.test(x));
      const comm = tk.find((t) => t.k === "comment");
      fr.push({ ...base, stage: 2, rows, err, line: [K ? 3 : 1], note: err ? `The parser fails: <b>${esc(err)}</b>. ${input.includes("'") && !/OR|DROP|--/i.test(input) ? `A perfectly legitimate name (<code>${esc(input)}</code>) <b>breaks the query</b>: concatenation is a correctness bug before it's a security bug.` : "The attacker learns from the error message what the SQL looks like, and tries again."}` : `Evaluate <code>WHERE</code> over the users table${comm ? `; the <code>--</code> turned <code>${esc(comm.v.slice(2).trim() || "the rest")}</code> into a comment` : ""}. ${K === 0 && /OR/i.test(input) ? "AND binds tighter than OR, so the injected <code>OR</code> makes the whole condition true." : ""} <b>${rows.length} row${rows.length === 1 ? "" : "s"}</b> returned.`, vars: { "rows returned": err ? "error" : rows.length } });
      if (!err && extra.length) fr.push({ ...base, stage: 3, rows, err, extra, dropped, line: [1], note: `There's a <b>second statement</b>: <code>${esc(extra.join("; "))}</code>. Drivers that allow batched statements (SQL Server by default; MySQL with multiStatements) run it with the app's permissions. ${dropped ? "<b>The users table is gone.</b>" : ""}`, vars: { "statements run": 1 + extra.length } });
      const L = fr[fr.length - 1];
      const leaked = !err && rows && rows.length > (USERS.some((u) => u.name === input && u.active) ? 1 : 0);
      fr.push({ ...L, final: true, line: [], note: K === 0 ? (leaked || dropped ? `<b>Injected.</b> ${dropped ? "A second statement ran." : `The query returned ${rows.length} users for a login that should match at most one${rows.some((u) => !u.active) ? ", including an inactive account" : ""}.`} Escaping quotes by hand is not the fix (encodings, numeric contexts and identifiers all have their own escape rules). <b>Parameters are.</b>` : err ? "No data leaked this time, but the query broke and the error leaked its shape." : "Nothing went wrong with this input. Concatenation is still wrong: it's only safe until someone types a quote.") : `<b>Safe.</b> The name is compared as a plain value: ${rows ? `${rows.length} row${rows.length === 1 ? "" : "s"}` : "no rows"}. Parameters also let the database reuse the plan. Note: parameters can't stand in for <b>identifiers</b> (table or column names, ORDER BY direction); allow-list those.` });
      return fr;
    },
    render: (f) => {
      const txt = f.K === 0 ? `<code class="dax-inj">${esc(f.sql.slice(0, f.uA))}<mark>${esc(f.sql.slice(f.uA, f.uB))}</mark>${esc(f.sql.slice(f.uB))}</code>` : `<code class="dax-inj">${esc(f.sql)}</code><div class="dax-param">@name = <b>${esc(JSON.stringify(f.input))}</b> <span class="dax-muted">(sent as a typed value, never parsed as SQL)</span></div>`;
      const toks = f.stage >= 1 ? `<div class="dax-toks">${f.tk.map((t) => `<span class="${t.cls}" title="${t.k}">${esc(t.k === "str" ? `'${t.v.replace(/'/g, "''")}'` : t.un ? `'${t.v}` : String(t.v))}</span>`).join("")}</div>` : "";
      let res = "";
      if (f.stage >= 2) {
        res = f.err ? verdict(`<b>Error:</b> ${esc(f.err)}`, "bad") : mini("users matched", ["id", "name", "role", "active"], USERS.map((u) => ({ cls: f.rows.includes(u) ? (f.K === 0 && (f.rows.length > 1 || !u.active) ? "bad" : "done") : "dim", cells: [u.id, esc(u.name), u.role, u.active] })));
        if (f.stage >= 3 && f.extra) res += sqlList("then also executed", f.extra.map((x) => ({ sql: x, cls: "bad", meta: f.dropped ? "table dropped" : "" })));
      }
      return col(`<div class="dax-strip-h">SQL text sent to the database</div>${txt}`, toks, res);
    },
  }));
})();
