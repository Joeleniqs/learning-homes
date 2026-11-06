/* Caching visualizers. Every registered name is prefixed "caching-". */
(() => {
  const esc = Viz.esc;

  /* ---------- shared helpers ---------- */
  const mulberry = (seed) => () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  const num = (s, label, min, max) => {
    const n = Number(String(s).trim());
    if (String(s).trim() === "" || !Number.isFinite(n) || n < min || n > max) throw new Error(`${label}: use a number from ${min} to ${max}.`);
    return n;
  };
  const int = (s, label, min, max) => {
    const n = num(s, label, min, max);
    if (!Number.isInteger(n)) throw new Error(`${label}: use a whole number.`);
    return n;
  };
  const fmtMs = (ms) => {
    if (!Number.isFinite(ms)) return "∞";
    if (ms >= 1000) return `${(ms / 1000).toFixed(2)} s`;
    if (ms >= 1) return `${+ms.toFixed(ms < 10 ? 2 : 1)} ms`;
    if (ms >= 0.001) return `${+(ms * 1000).toFixed(1)} µs`;
    return `${Math.round(ms * 1e6)} ns`;
  };
  const pct = (x) => `${(x * 100).toFixed(1)}%`;

  /* key/value panel: rows [[key, value, cls]] */
  const kv = (title, rows, o = {}) => `<div class="cx-kv ${o.cls || ""}"><div class="cx-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="cx-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="cx-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  /* stat chips: [[label, value, cls]] */
  const stats = (items) => `<div class="cx-stats">${items.map(([l, v, c]) => `<div class="cx-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;

  /* sequence diagram. lanes [{id,label,sub}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 640, n = lanes.length, lw = W / n, rowH = o.rowH || 27, max = o.max || 12;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, (i + 0.5) * lw]));
    let s = `<svg class="cx-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 12, 150);
      s += `<line class="life" x1="${x}" y1="44" x2="${x}" y2="${H - 2}"/>`;
      s += `<rect class="lane ${l.cls || ""}" x="${x - bw / 2}" y="4" width="${bw}" height="40" rx="8"/>`;
      s += `<text class="lt" x="${x}" y="${l.sub ? 21 : 28}">${esc(l.label)}</text>`;
      if (l.sub) s += `<text class="ls" x="${x}" y="36">${esc(l.sub)}</text>`;
    });
    if (start) s += `<text class="ls" x="${W / 2}" y="64">… ${start} earlier message${start > 1 ? "s" : ""} scrolled off</text>`;
    shown.forEach((m, k) => {
      const y = top + k * rowH + rowH - 7, cur = start + k === msgs.length - 1;
      const c = `msg ${m.cls || ""} ${m.dash ? "dash" : ""} ${cur ? "cur" : "old"}`;
      if (m.from === m.to) {
        const x = X[m.from], bw = Math.min(lw * 1.6, Math.max(120, m.label.length * 6.6 + 16));
        const cx = Math.min(W - bw / 2 - 2, Math.max(bw / 2 + 2, x));
        s += `<g class="${c} note"><rect x="${cx - bw / 2}" y="${y - 15}" width="${bw}" height="20" rx="5"/><text x="${cx}" y="${y - 1}">${esc(m.label)}</text></g>`;
        return;
      }
      const x1 = X[m.from], x2 = X[m.to], d = Math.sign(x2 - x1);
      const a = x2 - d * 3, b = x1 + d * 3;
      s += `<g class="${c}"><line x1="${b}" y1="${y}" x2="${a - d * 8}" y2="${y}"/><polygon points="${a},${y} ${a - d * 9},${y - 4.5} ${a - d * 9},${y + 4.5}"/><text x="${(x1 + x2) / 2}" y="${y - 5}">${esc(m.label)}</text></g>`;
    });
    return s + "</svg>";
  }

  /* =====================================================================
   * 1. Decision tree: should I cache this at all?
   * ===================================================================== */
  const TREE = {
    q1: { x: 350, y: 14, w: 240, t: "Can readers accept stale data?", s: "money, stock, authz → no" },
    q2: { x: 350, y: 78, w: 240, t: "Is a miss ≥ 5× a cache lookup?", s: "else the cache is no faster" },
    q3: { x: 350, y: 142, w: 240, t: "Reads ≥ 2× writes per key?", s: "else it changes before reuse" },
    q4: { x: 350, y: 206, w: 240, t: "Estimated hit rate ≥ 50%?", s: "keys repeat within TTL and fit" },
    q5: { x: 350, y: 270, w: 240, t: "Is the value per-user?", s: "or shared by everyone" },
    q6a: { x: 175, y: 344, w: 210, t: "Need read-your-writes?", s: "shared data" },
    q6b: { x: 525, y: 344, w: 210, t: "Need read-your-writes?", s: "per-user data" },
    n1: { x: 600, y: 14, w: 180, t: "Don't cache this path", s: "cache immutable parts only", leaf: "bad" },
    n2: { x: 600, y: 78, w: 180, t: "Don't cache", s: "the source is already fast", leaf: "bad" },
    n3: { x: 600, y: 142, w: 180, t: "Don't cache", s: "it changes before reuse", leaf: "bad" },
    n4: { x: 600, y: 206, w: 180, t: "Probably not", s: "fix source / cache hot head", leaf: "active" },
    l1: { x: 90, y: 422, w: 166, t: "Shared cache", s: "TTL ≈ tolerance + jitter", leaf: "done" },
    l2: { x: 262, y: 422, w: 166, t: "Shared cache", s: "delete on write + TTL", leaf: "done" },
    l3: { x: 438, y: 422, w: 166, t: "Private cache", s: "short TTL, user in key", leaf: "done" },
    l4: { x: 610, y: 422, w: 166, t: "Private cache", s: "evict on the user's writes", leaf: "done" },
  };
  const TREE_EDGES = [
    ["q1", "q2", "yes"], ["q1", "n1", "no"], ["q2", "q3", "yes"], ["q2", "n2", "no"], ["q3", "q4", "yes"], ["q3", "n3", "no"],
    ["q4", "q5", "yes"], ["q4", "n4", "no"], ["q5", "q6a", "shared"], ["q5", "q6b", "per-user"],
    ["q6a", "l1", "no"], ["q6a", "l2", "yes"], ["q6b", "l3", "no"], ["q6b", "l4", "yes"],
  ];
  const NODE_H = 44;
  function treeSvg(st = {}) {
    const cls = st.cls || {}, sub = st.sub || {}, ecls = st.ecls || {};
    const arrow = (x1, y1, x2, y2, c) => {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const p = `${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}`;
      return `<path class="edge ${c}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${c ? "fill-" + c : "muted"}" points="${p}"/>`;
    };
    let s = '<svg class="dg cx-tree" viewBox="0 0 700 476" width="700" role="img" aria-label="Decision tree: should you cache this data?">';
    for (const [a, b, lab] of TREE_EDGES) {
      const A = TREE[a], B = TREE[b], c = ecls[`${a}-${b}`] || "";
      let x1, y1, x2, y2, lx, ly, anchor = "start";
      if (B.y === A.y) { x1 = A.x + A.w / 2; y1 = A.y + NODE_H / 2; x2 = B.x - B.w / 2; y2 = y1; lx = (x1 + x2) / 2; ly = y1 - 5; anchor = "middle"; }
      else { x1 = A.x; y1 = A.y + NODE_H; x2 = B.x; y2 = B.y; lx = (x1 + x2) / 2 + (x2 < x1 ? -8 : 8); ly = (y1 + y2) / 2 + 4; anchor = x2 < x1 ? "end" : "start"; }
      s += arrow(x1, y1, x2, y2, c);
      s += `<text class="small ${c ? "" : "muted"}" x="${lx}" y="${ly}" text-anchor="${anchor}">${lab}</text>`;
    }
    for (const [id, n] of Object.entries(TREE)) {
      const c = cls[id] !== undefined ? cls[id] : n.leaf ? "" : "";
      s += `<rect class="box ${c}" x="${n.x - n.w / 2}" y="${n.y}" width="${n.w}" height="${NODE_H}" rx="8"/>`;
      s += `<text class="cx-t" x="${n.x}" y="${n.y + 18}" text-anchor="middle">${esc(n.t)}</text>`;
      s += `<text class="cx-s" x="${n.x}" y="${n.y + 34}" text-anchor="middle">${esc(sub[id] || n.s)}</text>`;
    }
    return s + "</svg>";
  }

  const LOOKUPS = { "in-process ~0.0002 ms": 0.0002, "Redis ~0.5 ms": 0.5 };
  Viz.register("caching-decide", (el) => Viz.player(el, {
    title: "Should I cache this? Walk the tree with your own numbers",
    legend: [["active", "question being asked"], ["path", "answered, keep going"], ["bad", "stop: don't cache"], ["done", "cache it, like this"]],
    codeLang: "python",
    code: [
      "def should_cache(x):",
      "    if x.strict: return NO",
      "    if x.miss < 5 * x.lookup: return NO",
      "    if x.reads < 2 * x.writes: return NO",
      "    h = estimate_hit_rate(x)",
      "    if h < 0.5: return PROBABLY_NOT",
      "    scope = private_or_shared(x)",
      "    if x.read_your_writes:",
      "        return CACHE(scope, evict_on_write)",
      "    return CACHE(scope, ttl=x.stale_s)",
    ],
    inputs: [
      { key: "reads", label: "reads/s", value: "2000", width: 80 },
      { key: "writes", label: "writes/s", value: "20", width: 80 },
      { key: "keys", label: "distinct keys", value: "10000", width: 90 },
      { key: "cap", label: "capacity (keys)", value: "10000", width: 90 },
      { key: "stale", label: "stale OK (s)", value: "60", width: 80 },
      { key: "miss", label: "miss cost (ms)", value: "40", width: 80 },
      { key: "lookup", label: "cache lookup", type: "select", options: Object.keys(LOOKUPS), value: "Redis ~0.5 ms" },
      { key: "cons", label: "consistency", type: "select", options: ["eventual is fine", "read-your-writes", "strict (money, stock, authz)"], value: "eventual is fine" },
      { key: "scope", label: "data is", type: "select", options: ["shared by all users", "per-user"], value: "shared by all users" },
    ],
    random: () => {
      const presets = [
        { reads: 5000, writes: 5, keys: 2000, cap: 2000, stale: 300, miss: 80, lookup: "Redis ~0.5 ms", cons: "eventual is fine", scope: "shared by all users" },
        { reads: 300, writes: 250, keys: 50000, cap: 10000, stale: 5, miss: 12, lookup: "Redis ~0.5 ms", cons: "eventual is fine", scope: "shared by all users" },
        { reads: 800, writes: 2, keys: 100000, cap: 20000, stale: 30, miss: 25, lookup: "in-process ~0.0002 ms", cons: "read-your-writes", scope: "per-user" },
        { reads: 4000, writes: 10, keys: 500, cap: 500, stale: 0, miss: 0.4, lookup: "Redis ~0.5 ms", cons: "eventual is fine", scope: "shared by all users" },
        { reads: 1500, writes: 40, keys: 3000, cap: 3000, stale: 10, miss: 30, lookup: "Redis ~0.5 ms", cons: "strict (money, stock, authz)", scope: "shared by all users" },
        { reads: 20000, writes: 1, keys: 1e6, cap: 1e5, stale: 60, miss: 15, lookup: "Redis ~0.5 ms", cons: "eventual is fine", scope: "shared by all users" },
      ];
      const p = presets[Viz.rand(0, presets.length - 1)];
      return Object.fromEntries(Object.entries(p).map(([k, v]) => [k, String(v)]));
    },
    build: (inp) => {
      const reads = num(inp.reads, "reads/s", 0.01, 1e7), writes = num(inp.writes, "writes/s", 0, 1e7);
      const keys = int(inp.keys, "distinct keys", 1, 1e9), cap = int(inp.cap, "capacity", 0, 1e9);
      const stale = num(inp.stale, "stale OK", 0, 1e7), miss = num(inp.miss, "miss cost", 0.0001, 1e6);
      const lookup = LOOKUPS[inp.lookup] ?? 0.5, strict = inp.cons.startsWith("strict"), perUser = inp.scope === "per-user";
      const ryw = inp.cons === "read-your-writes" || stale === 0;
      const rk = reads / keys, wk = writes / keys;
      const life = Math.min(stale > 0 ? stale : Infinity, wk > 0 ? 1 / wk : Infinity);
      const n = rk * life, perKey = n === Infinity ? 1 : n / (n + 1), resid = Math.min(1, cap / keys), h = resid * perKey;
      const withCache = lookup + (1 - h) * miss;
      const fr = [], cls = {}, sub = {}, ecls = {};
      const snap = (extra) => ({ cls: { ...cls }, sub: { ...sub }, ecls: { ...ecls }, h, withCache, miss, lookup, reads, ...extra });
      const vars = { "reads/key/s": +rk.toPrecision(3), "entry life (s)": life === Infinity ? "∞" : +life.toPrecision(3), "est. hit rate": pct(h) };
      fr.push(snap({ line: 0, vars, note: "Caching is a bet: you trade memory, complexity and a second copy of the truth for speed. Each question below can kill the bet, so we ask them cheapest-to-answer first." }));
      const step = (id, ok, line, note, s) => {
        sub[id] = s; cls[id] = "active";
        fr.push(snap({ line, vars, note }));
        cls[id] = "path";
        return ok;
      };
      const leaf = (from, id, line, note, kind) => {
        ecls[`${from}-${id}`] = kind; cls[id] = kind;
        fr.push(snap({ line, vars, note, end: id }));
        return fr;
      };
      const go = (a, b) => { ecls[`${a}-${b}`] = "path"; };
      if (!step("q1", !strict, 1, strict ? "You said the data is <b>strict</b>: a balance, stock count or permission. A cache is a copy that can lag the truth, so any staleness here is a bug, not a trade-off." : "Readers can tolerate some staleness, so a copy is allowed to lag the truth. That is the precondition for every cache.", strict ? "strict → no" : `eventual, up to ${stale ? stale + " s" : "next write"}`))
        return leaf("q1", "n1", 1, "<b>Don't cache this read path.</b> Make the source fast instead (index, projection, read replica with care), or cache only the immutable inputs to the decision, never the decision itself.", "bad");
      go("q1", "q2");
      const ratio = miss / lookup;
      if (!step("q2", ratio >= 5, 2, `A miss costs ${fmtMs(miss)}; a lookup costs ${fmtMs(lookup)}. That is <b>${ratio >= 1000 ? Math.round(ratio).toLocaleString() : ratio.toFixed(1)}×</b>. ${ratio >= 5 ? "Hits save real time." : "Even a 100% hit rate barely helps, and every miss now pays both costs."}`, `${fmtMs(miss)} vs ${fmtMs(lookup)} → ${ratio >= 1000 ? Math.round(ratio).toLocaleString() : ratio.toFixed(1)}×`))
        return leaf("q2", "n2", 2, "<b>Don't cache.</b> A network cache in front of a sub-millisecond source adds a hop, serialization and a staleness bug for no gain. If anything, an in-process cache may still pay; a distributed one won't.", "bad");
      go("q2", "q3");
      const rw = writes ? reads / writes : Infinity;
      if (!step("q3", rw >= 2, 3, `Each write invalidates (or rewrites) the entry. With ${rw === Infinity ? "no writes" : `${+rw.toPrecision(3)} reads per write`}, ${rw >= 2 ? "an entry is reused several times before it changes." : "the typical entry is thrown away before anyone reads it twice."}`, rw === Infinity ? "no writes → ∞" : `${+rw.toPrecision(3)} reads per write`))
        return leaf("q3", "n3", 3, "<b>Don't cache.</b> Write-heavy data turns the cache into a write amplifier: every write also pays an invalidation, and hits are rare. Optimise the write path or batch reads instead.", "bad");
      go("q3", "q4");
      fr.push(snap({ line: 4, vars, note: `Estimate the hit rate (uniform traffic, a pessimistic model): each key is read ${+rk.toPrecision(3)}×/s and lives ${life === Infinity ? "until evicted" : `≈ ${+life.toPrecision(3)} s`} (min of TTL and time-to-next-write), so one miss buys ≈ ${n === Infinity ? "∞" : +n.toPrecision(3)} hits → ${pct(perKey)}. Only ${pct(resid)} of keys fit. h ≈ <b>${pct(h)}</b>. Real traffic is usually skewed (Zipf), which only helps.` }));
      if (!step("q4", h >= 0.5, 5, `Estimated hit rate <b>${pct(h)}</b>. ${h >= 0.5 ? "Most reads will be served from the copy." : "Most reads still go to the source, and you pay the lookup on top of them."}`, `h ≈ ${pct(h)} (fit ${pct(resid)})`))
        return leaf("q4", "n4", 5, `<b>Probably not.</b> Expected latency ${fmtMs(withCache)} vs ${fmtMs(miss)} uncached. Either the keys don't repeat within the staleness window, or they don't fit. Make the source faster, raise the TTL if the business allows, or cache only the hot head of the distribution.`, "active");
      go("q4", "q5");
      step("q5", true, 6, perUser ? "The value is <b>per-user</b>: hit rate per key is lower, memory multiplies by users, and a shared cache key that forgets the user ID leaks one user's data to another." : "The value is <b>shared</b>: one entry serves everyone, which is where caches shine (catalogue, config, reference data).", perUser ? "per-user" : "shared");
      const q6 = perUser ? "q6b" : "q6a";
      go("q5", q6);
      step(q6, true, 7, ryw ? "A user who just wrote must see the write (or staleness tolerance is 0). TTL alone can't promise that: the write path must invalidate." : `Nobody needs to see their own write instantly; ${stale} s of lag is acceptable, so expiry alone keeps it bounded.`, ryw ? "yes" : `no, ${stale} s lag is fine`);
      const leafId = perUser ? (ryw ? "l4" : "l3") : (ryw ? "l2" : "l1");
      const recs = {
        l1: `<b>Cache it, shared.</b> Cache-aside or HybridCache/@Cacheable with TTL ≈ ${stale} s ± 10% jitter and stampede protection. If it is an HTTP GET, also send <code>Cache-Control: public, s-maxage=${Math.round(stale)}</code> so a CDN absorbs it.`,
        l2: "<b>Cache it, shared, invalidated on write.</b> Delete the key after the DB commit and keep a TTL as a safety net for missed deletes. With an in-process L1 in front, add a backplane so other nodes drop their copy.",
        l3: `<b>Cache it privately.</b> Put the user ID in the key (or use the browser: <code>Cache-Control: private, max-age=${Math.round(stale)}</code>). Never let a shared CDN store it. Keep TTLs short; per-user memory adds up.`,
        l4: "<b>Cache it privately, evicting on the user's own writes.</b> Per-user keys, delete them in the same request that writes, or simply bypass the cache for that user for a few seconds after a write.",
      };
      fr.push(snap({ line: ryw ? 8 : 9, vars: { ...vars, "latency now": fmtMs(miss), "latency cached": fmtMs(withCache), "source load": pct(1 - h) }, end: leafId, note: `${recs[leafId]} Expected latency ${fmtMs(miss)} → <b>${fmtMs(withCache)}</b>; source traffic drops to ${pct(1 - h)}.` }));
      ecls[`${q6}-${leafId}`] = "done"; cls[leafId] = "done";
      fr[fr.length - 1] = { ...fr[fr.length - 1], cls: { ...cls }, ecls: { ...ecls } };
      return fr;
    },
    render: (f) => {
      const sh = f.end ? stats([["est. hit rate", pct(f.h), f.h >= 0.5 ? "done" : "bad"], ["latency uncached", fmtMs(f.miss)], ["latency with cache", fmtMs(f.withCache), f.withCache < f.miss ? "done" : "bad"], ["reads reaching source", `${Math.round(f.reads * (1 - f.h)).toLocaleString()}/s`]]) : "";
      return `<div class="cx-fit">${treeSvg(f)}</div>${sh}`;
    },
  }));

  /* =====================================================================
   * 2. Where caches live: one request falling through the layers
   * ===================================================================== */
  Viz.register("caching-layers", (el) => {
    const NAMES = ["Browser cache", "CDN edge", "In-process (L1)", "Redis (L2)", "DB buffer pool", "DB disk"];
    return Viz.player(el, {
      title: "One request falling through the cache layers",
      legend: [["bad", "checked: miss"], ["done", "answered here"], ["path", "filled on the way back"], ["dim", "never reached"]],
      codeLang: "python",
      code: [
        "for layer in LAYERS:  # browser … disk",
        "    cost += layer.reach + layer.lookup",
        "    v = layer.get(key)",
        "    if v is not None:",
        "        break          # hit: stop",
        "for upper in layers_above(layer):",
        "    upper.store(key, v)  # fill",
        "return v",
      ],
      inputs: [
        { key: "at", label: "answered at", type: "select", options: NAMES, value: "Redis (L2)" },
        { key: "edge", label: "user→edge RTT (ms)", value: "20", width: 80 },
        { key: "origin", label: "edge→origin RTT (ms)", value: "80", width: 80 },
        { key: "disk", label: "query from disk (ms)", value: "20", width: 80 },
      ],
      random: () => ({ at: NAMES[Viz.rand(0, 5)], edge: String(Viz.rand(5, 40)), origin: String(Viz.rand(20, 180)), disk: String(Viz.rand(5, 120)) }),
      build: (inp) => {
        const edge = num(inp.edge, "user→edge RTT", 0, 1000), origin = num(inp.origin, "edge→origin RTT", 0, 2000), disk = num(inp.disk, "query from disk", 0.1, 10000);
        const L = [
          { name: NAMES[0], where: "the user's device", reach: 0, look: 1, why: "No network at all: if Cache-Control says the stored copy is still fresh, the browser never sends a request." },
          { name: NAMES[1], where: "PoP near the user", reach: edge, look: 1, why: `One short round trip (${edge} ms) to a nearby point of presence. It only helps responses that are identical for many users.` },
          { name: NAMES[2], where: "app server RAM", reach: origin, look: 0.0002, why: `The expensive hop: crossing from the edge to the origin region (${origin} ms). Once there, the in-process lookup itself is a ~200 ns hash-map read.` },
          { name: NAMES[3], where: "same data centre", reach: 0.45, look: 0.05, why: "A network round trip inside the data centre plus deserialization: ~0.3–1 ms. Fast, but ~2,500× slower than L1." },
          { name: NAMES[4], where: "DB server RAM", reach: 0.5, look: 0.5, why: "The database caches hot pages itself (buffer pool / shared buffers). An indexed query served from RAM is often ~1 ms: close to Redis." },
          { name: NAMES[5], where: "SSD pages + query work", reach: 0, look: disk, why: `The cold path: pages read from storage, plus planning, joins and sorts (${disk} ms). This is what every layer above exists to avoid.` },
        ];
        const at = NAMES.indexOf(inp.at);
        let acc = 0;
        const cum = L.map((l) => (acc += l.reach + l.look));
        const st = L.map(() => "dim"), fr = [];
        const snap = (extra) => ({ L, cum, st: [...st], at, ...extra });
        fr.push(snap({ line: 0, cost: 0, vars: { layer: "-", cost: "0 ms" }, note: "A request for <code>/products/42</code> leaves the browser. It stops at the first layer that has a usable copy." }));
        for (let i = 0; i <= at; i++) {
          st[i] = i === at ? "done" : "bad";
          fr.push(snap({ line: i === at ? [3, 4] : [1, 2], cost: cum[i], cur: i, vars: { layer: L[i].name, cost: fmtMs(cum[i]) }, note: `${i === at ? "<b>Hit</b>" : "Miss"} at ${L[i].name}. ${L[i].why}` }));
        }
        for (let j = at - 1; j >= 0; j--) {
          st[j] = "path";
          fr.push(snap({ line: [5, 6], cost: cum[at], cur: j, vars: { layer: L[j].name, cost: fmtMs(cum[at]) }, note: `On the way back ${L[j].name} stores a copy${j < 2 ? " (only if the response headers allow it)" : j === 2 ? " (app code: L1 set)" : ""}, so the next identical request stops here and costs ${fmtMs(cum[j])} instead of ${fmtMs(cum[at])}.` }));
        }
        const saveCdn = at >= 2 ? cum[at] - cum[1] : 0, saveL2 = at >= 4 ? cum[at] - cum[3] : 0;
        fr.push(snap({ line: 7, cost: cum[at], vars: { answered: L[at].name, cost: fmtMs(cum[at]) }, note: `Total ${fmtMs(cum[at])}. ${at >= 2 ? `From the user's seat, a CDN hit would save ${fmtMs(saveCdn)}${at >= 4 ? `, Redis only ${fmtMs(saveL2)}` : ""}: <b>the network hop you skip matters more than how fast the store is.</b> Server-side caches mostly buy throughput and protect the database.` : "Nothing crossed the WAN: the cheapest request is the one never sent."}` }));
        return fr;
      },
      render: (f) => {
        const max = Math.log10(f.cum[f.cum.length - 1] * 1e4 + 1);
        const rows = f.L.map((l, i) => {
          const w = Math.max(2, (Math.log10(f.cum[i] * 1e4 + 1) / max) * 100);
          return `<div class="cx-layer ${f.st[i]} ${i === f.cur ? "cur" : ""}"><div class="cx-lname"><b>${esc(l.name)}</b><span>${esc(l.where)}</span></div>
            <div class="cx-lbar"><i style="width:${w}%"></i></div><div class="cx-lval">${fmtMs(f.cum[i])}</div></div>`;
        }).join("");
        return `<div class="cx-layers"><div class="cx-layers-h"><span>layer</span><span>time to answer if served here (log scale)</span><span></span></div>${rows}</div>`;
      },
    });
  });

  /* =====================================================================
   * 3. Caching patterns as sequence diagrams
   * ===================================================================== */
  const DB0 = (k) => (k.charCodeAt(0) - 96) * 10;
  function parseOps(s) {
    const toks = String(s).split(",").map((t) => t.trim()).filter(Boolean);
    if (!toks.length || toks.length > 14) throw new Error("Use 1–14 operations, for example: R a, W a=5, wait 3, crash.");
    return toks.map((t) => {
      let m;
      if ((m = t.match(/^r\s+([a-z])$/i))) return { op: "R", k: m[1].toLowerCase() };
      if ((m = t.match(/^w\s+([a-z])\s*=\s*(-?\d{1,4})$/i))) return { op: "W", k: m[1].toLowerCase(), v: +m[2] };
      if ((m = t.match(/^wait\s+(\d{1,2})$/i))) return { op: "wait", n: +m[1] };
      if (/^crash$/i.test(t)) return { op: "crash" };
      throw new Error(`Can't read “${t}”. Use R a, W a=5, wait 3 or crash.`);
    });
  }
  const PATTERNS = {
    aside: {
      title: "Cache-aside (lazy loading): your code talks to both",
      ops: "R a, R a, W a=5, R a, wait 3, R a", ttl: 4, cacheSub: "dumb key-value store",
      code: ["def get(k):", "    v = cache.get(k)", "    if v is not None:", "        return v            # hit", "    v = db.select(k)        # miss", "    cache.set(k, v, ttl=TTL)", "    return v", "def update(k, v):", "    db.update(k, v)", "    cache.delete(k)         # not set!"],
      L: { get: 1, hit: 3, miss: [1, 2], load: 4, loadReply: 4, set: 5, upd: 8, updReply: 8, del: 9 },
    },
    rt: {
      title: "Read-through: the cache loads on a miss",
      ops: "R a, R b, R a, W a=5, R a", ttl: 6, cacheSub: "owns the loader",
      code: ["# app code: v = cache.get(k)", "class ReadThroughCache:", "    def get(self, k):", "        e = self.store.get(k)", "        if e and not e.expired():", "            return e.value      # hit", "        v = self.loader(k)      # miss", "        self.store.set(k, v, self.ttl)", "        return v", "# writes: db.update(k, v)", "#         cache.invalidate(k)"],
      L: { get: [0, 3], hit: [4, 5], miss: 4, load: 6, loadReply: 6, fill: [7, 8], upd: 9, updReply: 9, del: 10 },
    },
    wt: {
      title: "Write-through: writes go through the cache to the DB",
      ops: "R a, W a=5, R a, W b=7, R b", ttl: 6, cacheSub: "writes synchronously",
      code: ["class WriteThroughCache:", "    def get(self, k):", "        e = self.store.get(k)", "        if e.fresh(): return e.value", "        v = self.db.select(k)", "        self.store.set(k, v); return v", "    def put(self, k, v):", "        self.db.update(k, v)  # sync", "        self.store.set(k, v, self.ttl)", "        return 'ok'   # after both"],
      L: { get: 2, hit: 3, miss: 3, load: 4, loadReply: 4, fill: 5, put: 6, putDb: 7, putDbReply: 8, putReply: 9 },
    },
    wb: {
      title: "Write-behind (write-back): ack now, write to the DB later",
      ops: "W a=5, R a, W a=6, W b=7, wait 2, R a, W c=9, crash, R c", ttl: 6, cacheSub: "queues writes",
      code: ["class WriteBehindCache:", "    def get(self, k): ...  # read-through", "    def put(self, k, v):", "        self.store.set(k, v, dirty=True)", "        self.queue.append((k, v))", "        return 'ok'   # DB untouched", "    def flush(self):    # every 3 ticks", "        batch = latest_per_key(self.queue)", "        self.db.update_many(batch)", "        self.queue.clear(); clean(batch)"],
      L: { get: 1, hit: 1, miss: 1, load: 1, loadReply: 1, fill: 1, put: [2, 3], putReply: [4, 5], flush: [6, 7, 8], flushReply: 9, crash: 4 },
    },
    ra: {
      title: "Refresh-ahead: reload hot keys before they expire",
      ops: "R a, R a, wait 1, R a, R a, wait 3, R a", ttl: 4, cacheSub: "refreshes early",
      code: ["class RefreshAheadCache:", "    def get(self, k):", "        e = self.store.get(k)", "        if e is None or e.expired():", "            return self.load(k)  # miss", "        if e.remaining() < self.ttl / 2:", "            spawn(self.load, k)  # async", "        return e.value  # hit", "    def load(self, k):", "        v = self.db.select(k)", "        self.store.set(k, v); return v", "# write: db.update(k, v); cache.delete(k)"],
      L: { get: 2, hit: 7, miss: [3, 4], load: 9, loadReply: 9, fill: 10, refresh: [5, 6], upd: 11, updReply: 11, del: 11 },
    },
  };
  const FLUSH = 3;
  function runPattern(pat, ops, ttl) {
    const P = PATTERNS[pat], L = P.L, cache = new Map(), db = new Map(), seen = new Set(), msgs = [], fr = [];
    let queue = [], t = 0, hits = 0, misses = 0, dbR = 0, dbW = 0;
    const dbGet = (k) => (db.has(k) ? db.get(k) : DB0(k));
    const live = (k) => { const e = cache.get(k); return e && (e.dirty || e.exp > t) ? e : null; };
    const snapC = () => [...cache.entries()].sort().map(([k, e]) => [k, `${e.v} · ${e.dirty ? "dirty" : e.exp > t ? `exp t=${e.exp}` : "expired"}`, e.dirty ? "active" : e.exp > t ? "" : "dim"]);
    const snapD = () => [...seen].sort().map((k) => { const e = live(k); return [k, String(dbGet(k)), e && e.v !== dbGet(k) ? "bad" : ""]; });
    const push = (m, line, note) => {
      if (m) msgs.push(m);
      fr.push({ msgs: [...msgs], cache: snapC(), db: snapD(), queue: queue.map((q) => `${q.k}=${q.v}`), line, note, vars: { t, hits, misses, "db reads": dbR, "db writes": dbW } });
    };
    const A = "app", C = "cache", D = "db";
    const flush = () => {
      const batch = new Map(); queue.forEach((q) => batch.set(q.k, q.v));
      const txt = [...batch].map(([k, v]) => `${k}=${v}`).join(",");
      push({ from: C, to: D, label: `UPDATE batch ${txt}`, cls: "db" }, L.flush, `Flush: ${queue.length} queued write${queue.length > 1 ? "s" : ""} collapse into one batch (${txt}). Coalescing is the payoff of write-behind: many writes, one DB round trip.`);
      batch.forEach((v, k) => { db.set(k, v); const e = cache.get(k); if (e) { e.dirty = false; e.exp = t + ttl; } });
      dbW++; queue = [];
      push({ from: D, to: C, label: "ok", cls: "db" }, L.flushReply, "The DB has finally caught up. Until this moment it was serving old values to anyone reading it directly (reports, other services).");
    };
    push(null, null, `Every operation takes one tick; TTL is ${ttl} ticks. The database starts with a=10, b=20, c=30, …`);
    for (const o of ops) {
      if (pat === "wb" && queue.length && t - queue[0].t >= FLUSH) flush();
      if (o.op === "wait") {
        t += o.n;
        push({ from: A, to: A, label: `… ${o.n} tick${o.n > 1 ? "s" : ""} pass (t=${t})`, cls: "info" }, null, `Time passes. Entries whose expiry is ≤ t=${t} are now dead.`);
        if (pat === "wb" && queue.length && t - queue[0].t >= FLUSH) flush();
        continue;
      }
      if (o.op === "crash") {
        const lost = queue.map((q) => `${q.k}=${q.v}`);
        cache.clear(); queue = [];
        push({ from: C, to: C, label: lost.length ? `CRASH: lost ${lost.join(",")}` : "CRASH: cache emptied", cls: "miss" }, L.crash ?? null,
          lost.length ? `The cache node dies. The queued write${lost.length > 1 ? "s" : ""} ${lost.join(", ")} existed nowhere else: <b>acknowledged writes are gone</b>. This is the price of write-behind without a durable queue.` : "The cache node restarts empty. Nothing is lost (the DB has everything), but the next reads are all misses: a cold start.");
        t++; continue;
      }
      seen.add(o.k);
      if (o.op === "R") {
        push({ from: A, to: C, label: `GET ${o.k}` }, L.get, pat === "aside" ? "Cache-aside: the application asks the cache first. The cache knows nothing about the database." : "The application only ever talks to the cache.");
        const e = live(o.k);
        if (e) {
          hits++;
          push({ from: C, to: A, label: `hit ${o.k}=${e.v}`, cls: "hit" }, L.hit, `<b>Hit.</b> ${e.dirty ? "The value is dirty (not yet in the DB), yet readers through the cache see it: read-your-writes for free." : `Served from memory; the entry lives until t=${e.exp}.`}${e.v !== dbGet(o.k) && !e.dirty ? " Note: it differs from the DB, so this hit is <b>stale</b>." : ""}`);
          if (pat === "ra" && !e.dirty && e.exp - t < ttl / 2) {
            dbR++;
            push({ from: C, to: D, label: `reload ${o.k} (async)`, cls: "db", dash: true }, L.refresh, `Remaining TTL is ${e.exp - t} &lt; ${ttl / 2} (half the TTL), so the cache refreshes in the background. The caller already got its hit and never waits.`);
            e.v = dbGet(o.k); e.exp = t + ttl;
            push({ from: D, to: C, label: `${o.k}=${e.v}, exp t=${e.exp}`, cls: "db", dash: true }, L.fill, "The hot key's expiry moved forward: as long as it keeps being read, it never expires and nobody ever pays a miss.");
          }
        } else {
          misses++;
          const wasExpired = cache.has(o.k);
          if (pat === "aside") {
            push({ from: C, to: A, label: "miss", cls: "miss" }, L.miss, `<b>Miss</b>${wasExpired ? " (the entry expired)" : ""}. Now the application itself must go to the source.`);
            dbR++;
            push({ from: A, to: D, label: `SELECT ${o.k}`, cls: "db" }, L.load, "The app queries the database: this is the slow path the cache exists to avoid.");
            push({ from: D, to: A, label: `${o.k}=${dbGet(o.k)}`, cls: "db" }, L.loadReply, "The source of truth answers.");
            cache.set(o.k, { v: dbGet(o.k), exp: t + ttl });
            push({ from: A, to: C, label: `SET ${o.k}=${dbGet(o.k)} ttl=${ttl}`, cls: "fill" }, L.set, `The app populates the cache, so the next ${ttl} ticks of reads are hits. Two separate calls: a write can sneak in between them (see the race section).`);
          } else {
            dbR++;
            push({ from: C, to: D, label: `load ${o.k}`, cls: "db" }, L.miss, `<b>Miss</b>${wasExpired ? " (expired)" : ""}. The cache calls its configured loader; the application doesn't know or care.`);
            push({ from: D, to: C, label: `${o.k}=${dbGet(o.k)}`, cls: "db" }, L.loadReply, "The loader returns the value from the source of truth.");
            cache.set(o.k, { v: dbGet(o.k), exp: t + ttl });
            push({ from: C, to: A, label: `${o.k}=${dbGet(o.k)} (filled)`, cls: "fill" }, L.fill, "The cache stores it and answers. Concurrent misses for the same key can be coalesced here, inside the cache.");
          }
        }
      } else if (o.op === "W") {
        if (pat === "wt") {
          push({ from: A, to: C, label: `PUT ${o.k}=${o.v}` }, L.put, "Write-through: the application writes to the cache…");
          dbW++; db.set(o.k, o.v);
          push({ from: C, to: D, label: `UPDATE ${o.k}=${o.v}`, cls: "db" }, L.putDb, "…which synchronously writes to the database before acknowledging. The write pays both latencies.");
          push({ from: D, to: C, label: "ok", cls: "db" }, L.putDbReply, "The DB commit succeeded, so the cache stores the new value too.");
          cache.set(o.k, { v: o.v, exp: t + ttl });
          push({ from: C, to: A, label: "ok", cls: "fill" }, L.putReply, `Cache and DB agree, and the next read of ${o.k} is a hit with the new value. Cost: values that are never read again still occupy memory.`);
        } else if (pat === "wb") {
          cache.set(o.k, { v: o.v, exp: t + ttl, dirty: true });
          queue.push({ k: o.k, v: o.v, t });
          push({ from: A, to: C, label: `PUT ${o.k}=${o.v}` }, L.put, "Write-behind: the write lands in cache memory only and is queued.");
          push({ from: C, to: A, label: "ok (queued)", cls: "fill" }, L.putReply, `Acknowledged at memory speed. The DB still says ${o.k}=${dbGet(o.k)}: the cache is now the only copy of this write until the next flush (every ${FLUSH} ticks).`);
        } else {
          dbW++; db.set(o.k, o.v);
          push({ from: A, to: D, label: `UPDATE ${o.k}=${o.v}`, cls: "db" }, L.upd, "Write the source of truth first. If this fails, the cache is untouched and still correct.");
          push({ from: D, to: A, label: "ok", cls: "db" }, L.updReply, `Committed. The cached copy of ${o.k} (if any) is now stale.`);
          cache.delete(o.k);
          push({ from: A, to: C, label: `DEL ${o.k}`, cls: "miss" }, L.del, "Invalidate rather than overwrite: a delete is idempotent and can't race another writer into storing an older value. The next read reloads.");
        }
      }
      t++;
    }
    if (pat === "wb" && queue.length) push(null, L.flush, `End of script with ${queue.length} write(s) still queued: the DB is behind the cache right now.`);
    else {
      const last = fr[fr.length - 1];
      fr.push({ ...last, line: null, note: `Done. ${hits} hit${hits === 1 ? "" : "s"}, ${misses} miss${misses === 1 ? "" : "es"}; the database served ${dbR} read${dbR === 1 ? "" : "s"} and ${dbW} write${dbW === 1 ? "" : "s"}.` });
    }
    return fr;
  }
  for (const [id, P] of Object.entries(PATTERNS)) {
    Viz.register(`caching-pattern-${id}`, (el) => Viz.player(el, {
      title: P.title,
      legend: [["done", "hit"], ["bad", "miss / invalidate"], ["visit", "database call"], ["path", "cache filled"], ["active", "dirty (not yet in DB)"]],
      codeLang: "python", code: P.code,
      inputs: [{ key: "ops", label: "operations", value: P.ops, width: 330 }, { key: "ttl", label: "TTL (ticks)", value: String(P.ttl), width: 70 }],
      random: () => {
        const ks = "abc", n = Viz.rand(5, 9), out = [];
        for (let i = 0; i < n; i++) {
          const r = Math.random(), k = ks[Viz.rand(0, 2)];
          out.push(r < 0.55 ? `R ${k}` : r < 0.8 ? `W ${k}=${Viz.rand(1, 99)}` : r < 0.95 ? `wait ${Viz.rand(1, 4)}` : id === "wb" ? "crash" : `R ${k}`);
        }
        return { ops: out.join(", "), ttl: String(Viz.rand(2, 6)) };
      },
      build: ({ ops, ttl }) => runPattern(id, parseOps(ops), int(ttl, "TTL", 1, 30)),
      render: (f) => {
        const lanes = [{ id: "app", label: "App", sub: "your code" }, { id: "cache", label: "Cache", sub: P.cacheSub }, { id: "db", label: "Database", sub: "source of truth" }];
        const side = [kv("cache", f.cache), kv("database", f.db, { empty: "untouched" })];
        if (id === "wb") side.push(kv("write queue", f.queue.map((q, i) => [`#${i + 1}`, q, "active"]), { empty: "empty" }));
        return `<div class="cx-fit">${seq(lanes, f.msgs, { label: P.title, max: 11 })}</div><div class="cx-panels">${side.join("")}</div>`;
      },
    }));
  }

  /* =====================================================================
   * 4. Eviction: LRU / LFU / FIFO simulator (+ Bélády's OPT for reference)
   * ===================================================================== */
  function parseKeys(s) {
    const ks = String(s).trim().split(/[\s,]+/).filter(Boolean);
    if (ks.length < 2 || ks.length > 30) throw new Error("Use 2–30 keys separated by spaces, e.g. A B C A B D.");
    ks.forEach((k) => { if (!/^[A-Za-z0-9]{1,3}$/.test(k)) throw new Error(`“${k}” isn't a key: use 1–3 letters or digits.`); });
    return ks.map((k) => k.toUpperCase());
  }
  /* simulate a policy; returns per-access records. Each entry: {k, freq, last, born} */
  function simulate(keys, cap, policy) {
    const c = new Map(), out = [];
    keys.forEach((k, t) => {
      let hit = false, victim = null, why = "";
      if (c.has(k)) { hit = true; const e = c.get(k); e.freq++; e.last = t; }
      else {
        if (c.size >= cap) {
          const es = [...c.values()];
          if (policy === "LRU") victim = es.reduce((a, b) => (b.last < a.last ? b : a));
          else if (policy === "FIFO") victim = es.reduce((a, b) => (b.born < a.born ? b : a));
          else if (policy === "LFU") victim = es.reduce((a, b) => (b.freq < a.freq || (b.freq === a.freq && b.last < a.last) ? b : a));
          else {
            const nextUse = (e) => { const j = keys.indexOf(e.k, t + 1); return j < 0 ? Infinity : j; };
            victim = es.reduce((a, b) => (nextUse(b) > nextUse(a) ? b : a));
            const nu = nextUse(victim); why = nu === Infinity ? "never used again" : `next used at #${nu + 1}`;
          }
          c.delete(victim.k); victim = { ...victim };
        }
        c.set(k, { k, freq: 1, last: t, born: t });
      }
      out.push({ k, t, hit, victim, why, entries: [...c.values()].map((e) => ({ ...e })) });
    });
    return out;
  }
  const ORDER = {
    LRU: (a, b) => b.last - a.last,
    FIFO: (a, b) => b.born - a.born,
    LFU: (a, b) => b.freq - a.freq || b.last - a.last,
  };
  Viz.register("caching-evict", (el) => Viz.player(el, {
    title: "Eviction policies: who gets thrown out?",
    legend: [["done", "hit"], ["bad", "miss"], ["active", "current access"], ["visit", "next victim (rightmost)"]],
    code: [
      "def access(key):",
      "    if key in cache:",
      "        touch(key)    # LRU: to front",
      "        return HIT    # LFU: freq += 1",
      "    if len(cache) >= capacity:",
      "        v = victim()  # LRU: least recent",
      "        del cache[v]  # LFU: least used",
      "                      # FIFO: oldest",
      "    cache[key] = load(key)",
      "    return MISS",
    ],
    codeLang: "python",
    inputs: [
      { key: "seq", label: "access sequence", value: "A B C A B D A E A B F A B C G A B", width: 300 },
      { key: "cap", label: "capacity", value: "3", width: 60 },
      { key: "policy", label: "policy", type: "select", options: ["LRU", "LFU", "FIFO"], value: "LRU" },
    ],
    random: () => {
      const presets = [
        ["A B C A B D A E A B F A B C G A B", "LRU"],
        ["H H H H W H X Y Z W H X Y Z H H", "LFU"],
        ["A B A B C D E F G H A B A B", "LRU"],
        ["A B C D A B C D A B C D", "LRU"],
      ];
      if (Math.random() < 0.5) { const p = presets[Viz.rand(0, presets.length - 1)]; return { seq: p[0], cap: "3", policy: p[1] }; }
      const n = Viz.rand(12, 22), hot = "AB", cold = "CDEFGH", out = [];
      for (let i = 0; i < n; i++) out.push(Math.random() < 0.55 ? hot[Viz.rand(0, 1)] : cold[Viz.rand(0, 5)]);
      return { seq: out.join(" "), cap: String(Viz.rand(2, 4)), policy: ["LRU", "LFU", "FIFO"][Viz.rand(0, 2)] };
    },
    build: (inp) => {
      const keys = parseKeys(inp.seq), cap = int(inp.cap, "capacity", 1, 8), pol = inp.policy;
      const run = simulate(keys, cap, pol), fr = [];
      const res = {}; for (const p of ["LRU", "LFU", "FIFO", "OPT"]) res[p] = simulate(keys, cap, p).filter((r) => r.hit).length;
      let hits = 0, ev = 0;
      const base = { keys, cap, pol };
      fr.push({ ...base, t: -1, hist: [], entries: [], line: null, vars: { capacity: cap, hits: 0, misses: 0, evictions: 0 }, note: `An empty ${pol} cache with room for ${cap} entr${cap > 1 ? "ies" : "y"}. The order below always puts the <b>next victim on the right</b>.` });
      run.forEach((r, i) => {
        if (r.hit) hits++; if (r.victim) ev++;
        const desc = pol === "LRU" ? "moves to the front (most recent)" : pol === "LFU" ? `frequency becomes ${r.entries.find((e) => e.k === r.k).freq}` : "doesn't move: FIFO ignores hits";
        let note;
        if (r.hit) note = `<b>${r.k}: hit.</b> It ${desc}.`;
        else if (r.victim) {
          const why = pol === "LRU" ? `least recently used (last touched at #${r.victim.last + 1})` : pol === "LFU" ? `least frequently used (${r.victim.freq} use${r.victim.freq > 1 ? "s" : ""}${run.slice(0, i).length ? ", ties go to the least recent" : ""})` : `oldest insertion (#${r.victim.born + 1})`;
          note = `<b>${r.k}: miss</b>, and the cache is full. Evict <b>${r.victim.k}</b>: ${why}.`;
          const back = keys.indexOf(r.victim.k, i + 1);
          if (back >= 0 && back - i <= cap + 1) note += ` Ouch: ${r.victim.k} is needed again at #${back + 1}.`;
        } else note = `<b>${r.k}: miss.</b> There's still room, so it's simply added.`;
        fr.push({ ...base, t: i, hist: run.slice(0, i + 1).map((x) => x.hit), entries: r.entries, cur: r.k, victim: r.victim && r.victim.k,
          line: r.hit ? [1, 2, 3] : r.victim ? [4, 5, 6, 8, 9] : [8, 9], vars: { key: r.k, capacity: cap, hits, misses: i + 1 - hits, evictions: ev, "hit rate": pct(hits / (i + 1)) }, note });
      });
      const best = Object.entries(res).filter(([p]) => p !== "OPT").sort((a, b) => b[1] - a[1])[0];
      fr.push({ ...fr[fr.length - 1], cmp: res, line: null, note: `${pol} got <b>${hits}/${keys.length}</b> hits (${pct(hits / keys.length)}). On this sequence the best real policy is ${best[0]} (${best[1]}). OPT (Bélády) cheats by looking into the future and evicting the key used furthest ahead: ${res.OPT} hits is the ceiling for capacity ${cap}. Real libraries (Caffeine's W-TinyLFU, Redis's approximated LRU/LFU) aim to get close to it.` });
      return fr;
    },
    render: (f) => {
      const ord = [...f.entries].sort(ORDER[f.pol]);
      const slots = ord.map((e) => e.k);
      while (slots.length < f.cap) slots.push("");
      const meta = (e) => (f.pol === "LFU" ? `f=${e.freq}` : f.pol === "LRU" ? `@${e.last + 1}` : `in #${e.born + 1}`);
      const cacheRow = Viz.array(slots, {
        label: `cache (${f.pol}): ${f.pol === "LRU" ? "most recent → least recent" : f.pol === "LFU" ? "most used → least used" : "newest → oldest"}`,
        fmt: (v, i) => (v ? `${v}  ${meta(ord[i])}` : "—"),
        cls: (i, v) => (!v ? "dim" : v === f.cur ? (f.hist[f.hist.length - 1] ? "done" : "active") : i === ord.length - 1 && ord.length === f.cap ? "visit" : ""),
      });
      const hist = Viz.array(f.keys, {
        label: "access sequence (hit / miss)",
        cls: (i) => (i === f.t ? (f.hist[i] ? "done cx-cur" : "bad cx-cur") : i < f.t ? (f.hist[i] ? "done" : "bad") : "dim"),
        showIdx: false,
      });
      const ev = f.victim ? `<div class="cx-evicted">evicted: <b>${esc(f.victim)}</b></div>` : '<div class="cx-evicted"></div>';
      const cmp = f.cmp ? stats(["LRU", "LFU", "FIFO", "OPT"].map((p) => [`${p}${p === "OPT" ? " (ideal)" : ""}`, `${f.cmp[p]}/${f.keys.length} · ${pct(f.cmp[p] / f.keys.length)}`, p === f.pol ? "active" : p === "OPT" ? "visit" : ""])) : "";
      return `<div class="cx-col">${cacheRow}${ev}<div class="cx-wrap">${hist}</div>${cmp}</div>`;
    },
  }));

  /* =====================================================================
   * 5. TTL and jitter: synchronized expiry vs spread expiry
   * ===================================================================== */
  Viz.register("caching-ttl-jitter", (el) => Viz.player(el, {
    title: "Synchronized expiry: what jitter buys you",
    legend: [["path", "reloads hitting the DB"], ["bad", "over DB capacity"], ["active", "current time slice"]],
    speed: 450,
    codeLang: "python",
    code: [
      "def ttl_for(base, jitter):",
      "    # ±jitter, uniformly spread",
      "    j = random.uniform(-jitter, jitter)",
      "    return base * (1 + j)",
      "",
      "# warm-up loads N keys at t=0",
      "for k in keys:",
      "    cache.set(k, load(k), ttl_for(TTL, J))",
    ],
    inputs: [
      { key: "keys", label: "keys loaded at t=0", value: "1000", width: 90 },
      { key: "ttl", label: "TTL (s)", value: "300", width: 70 },
      { key: "jit", label: "jitter ±%", value: "0", width: 70 },
      { key: "dbcap", label: "DB reloads/s it can take", value: "20", width: 90 },
    ],
    random: () => ({ keys: String(Viz.rand(2, 20) * 100), ttl: String([60, 120, 300, 600][Viz.rand(0, 3)]), jit: String([0, 5, 10, 20, 30][Viz.rand(0, 4)]), dbcap: String(Viz.rand(5, 40)) }),
    build: (inp) => {
      const N = int(inp.keys, "keys", 10, 100000), ttl = num(inp.ttl, "TTL", 1, 86400), J = num(inp.jit, "jitter", 0, 90) / 100, cap = num(inp.dbcap, "DB capacity", 0.1, 1e6);
      const B = 45, H = ttl * 3, bw = H / B, rng = mulberry(42);
      const buckets = new Array(B).fill(0);
      for (let i = 0; i < N; i++) {
        let tt = ttl * (1 + (rng() * 2 - 1) * J);
        while (tt < H) { buckets[Math.min(B - 1, Math.floor(tt / bw))]++; tt += ttl * (1 + (rng() * 2 - 1) * J); }
      }
      const rates = buckets.map((c) => c / bw), peak = Math.max(...rates), over = rates.filter((r) => r > cap).length;
      const fr = [], step = 3;
      fr.push({ rates, cap, upto: -1, bw, ttl, H, line: [5, 6, 7], vars: { keys: N, TTL: `${ttl} s`, jitter: `±${J * 100}%` }, note: `A deploy (or a cache flush) warms ${N.toLocaleString()} keys at t=0, all with ${J ? `a TTL of ${ttl} s ± ${J * 100}%` : `exactly the same ${ttl} s TTL`}. Watch what happens at each multiple of the TTL.` });
      for (let b = step - 1; b < B; b += step) {
        const r = rates.slice(b - step + 1, b + 1), mx = Math.max(...r), t0 = (b - step + 1) * bw;
        const firstWave = t0 <= ttl * (1 + J) && (b + 1) * bw >= ttl * (1 - J);
        fr.push({ rates, cap, upto: b, bw, ttl, H, line: J ? [2, 3] : [7], vars: { "t (s)": `${Math.round(t0)}–${Math.round((b + 1) * bw)}`, "max reloads/s": +mx.toFixed(1), "DB limit": cap },
          note: mx > cap ? `<b>${Math.round(mx)} reloads/s</b> against a DB that handles ${cap}/s. ${J ? "Even with jitter the band is too narrow for this many keys: widen it, or pre-warm gradually." : "Every key expires in the same instant, so every request misses together: a self-inflicted load spike, every TTL, forever."}`
            : firstWave && J ? `Jitter spreads the first wave over ${Math.round(2 * J * ttl)} s, so peak reloads are ≈ ${Math.round(mx)}/s, under the ${cap}/s limit. After each reload, the next TTL is re-jittered, so waves keep smearing out.`
            : mx > 0 ? `${Math.round(mx)} reloads/s: comfortably under capacity.` : "Quiet: every key is fresh, every read is a hit." });
      }
      fr.push({ rates, cap, upto: B - 1, bw, ttl, H, line: null, vars: { "peak reloads/s": +peak.toFixed(1), "slices over limit": over },
        note: over ? `Peak ${Math.round(peak)}/s vs a limit of ${cap}/s in ${over} slice${over > 1 ? "s" : ""}. Try jitter 10–20%: the average load is identical (${(N / ttl).toFixed(1)}/s), only the shape changes.` : `Peak ${Math.round(peak)}/s stays under ${cap}/s. Same average load (${(N / ttl).toFixed(1)}/s), much flatter shape: that is all jitter does, and it's nearly free.` });
      return fr;
    },
    render: (f) => {
      const W = 620, Hh = 220, padL = 44, padB = 26, padT = 12, iw = W - padL - 10, ih = Hh - padB - padT;
      const ymax = Math.max(f.cap * 1.5, ...f.rates) || 1, bw = iw / f.rates.length;
      const Y = (v) => padT + ih - (v / ymax) * ih;
      let s = `<svg class="cx-chart" viewBox="0 0 ${W} ${Hh}" width="${W}" role="img" aria-label="Database reloads per second over time">`;
      for (const g of [0, 0.5, 1]) { const v = ymax * g; s += `<line class="grid" x1="${padL}" x2="${W - 10}" y1="${Y(v)}" y2="${Y(v)}"/><text class="ax" x="${padL - 6}" y="${Y(v) + 4}" text-anchor="end">${v >= 100 ? Math.round(v) : +v.toFixed(1)}</text>`; }
      f.rates.forEach((r, i) => {
        if (!r) return;
        const c = i > f.upto ? "future" : r > f.cap ? "over" : "ok", cur = i <= f.upto && i > f.upto - 3 ? " cur" : "";
        s += `<rect class="bar ${c}${cur}" x="${padL + i * bw + 1}" y="${Y(r)}" width="${bw - 2}" height="${padT + ih - Y(r)}"/>`;
      });
      s += `<line class="cap" x1="${padL}" x2="${W - 10}" y1="${Y(f.cap)}" y2="${Y(f.cap)}"/><text class="capt" x="${W - 12}" y="${Y(f.cap) - 5}" text-anchor="end">DB limit ${f.cap}/s</text>`;
      for (let k = 0; k <= 3; k++) { const x = padL + (k * f.ttl / f.H) * iw; s += `<text class="ax" x="${x}" y="${Hh - 8}" text-anchor="${k === 3 ? "end" : "middle"}">${k ? k + "×TTL" : "0"}</text>`; }
      if (f.upto >= 0) { const x = padL + (f.upto + 1) * bw; s += `<line class="now" x1="${x}" x2="${x}" y1="${padT}" y2="${padT + ih}"/>`; }
      s += `<text class="ax" x="8" y="${padT + 8}" text-anchor="start">/s</text>`;
      return `<div class="cx-fit">${s}</svg></div>`;
    },
  }));

  /* =====================================================================
   * 6. Cache stampede: no protection vs lock vs stale-while-revalidate vs XFetch
   * ===================================================================== */
  const MODES = ["no protection", "lock / coalesce", "serve stale + 1 refresher", "probabilistic early (XFetch)"];
  Viz.register("caching-stampede", (el) => Viz.player(el, {
    title: "Cache stampede: one hot key expires",
    legend: [["done", "H hit"], ["bad", "M miss → recompute"], ["active", "W waits for another's compute"], ["path", "S served stale"], ["visit", "R/E background or early recompute"]],
    speed: 600,
    codeLang: "python",
    code: [
      "def get(k):",
      "    e = cache.get(k)",
      "    if e and now() < e.exp:",
      "        if xfetch and early(e, D, beta):",
      "            return recompute(k)  # E",
      "        return e.value  # H",
      "    if none: return recompute(k)  # M",
      "    if mode == 'lock':",
      "        return single_flight(k)  # M/W",
      "    if mode == 'stale':",
      "        spawn_once(k, recompute)  # R",
      "        return e.value  # S",
    ],
    inputs: [
      { key: "rate", label: "requests/tick", value: "4", width: 70 },
      { key: "d", label: "recompute (ticks)", value: "3", width: 70 },
      { key: "ttl", label: "TTL (ticks)", value: "12", width: 70 },
      { key: "T", label: "ticks shown", value: "22", width: 70 },
      { key: "mode", label: "protection", type: "select", options: MODES, value: MODES[0] },
      { key: "beta", label: "XFetch β", value: "1", width: 60 },
      { key: "seed", label: "seed", value: "7", width: 60 },
    ],
    random: () => ({ rate: String(Viz.rand(2, 6)), d: String(Viz.rand(2, 5)), ttl: String(Viz.rand(9, 15)), T: String(Viz.rand(18, 24)), mode: MODES[Viz.rand(0, 3)], beta: String([0.5, 1, 1, 2][Viz.rand(0, 3)]), seed: String(Viz.rand(1, 999)) }),
    build: (inp) => {
      const R = int(inp.rate, "requests/tick", 1, 8), D = int(inp.d, "recompute", 1, 8), TTL = int(inp.ttl, "TTL", 2, 30);
      const T = int(inp.T, "ticks shown", 8, 24), beta = num(inp.beta, "β", 0.1, 5), mode = MODES.indexOf(inp.mode), rng = mulberry(int(inp.seed, "seed", 0, 1e9));
      if (TTL >= T) throw new Error(`TTL (${TTL}) must be smaller than the ticks shown (${T}) or nothing ever expires.`);
      const cells = Array.from({ length: R }, () => new Array(T).fill(""));
      const db = new Array(T).fill(0), fr = [];
      let exp = TTL, flights = [], computes = 0, waited = 0, stale = 0, worst = 0, early = 0;
      const lat = [];
      const startCompute = (t) => { const f = { done: t + D }; flights.push(f); computes++; for (let k = t; k < Math.min(T, t + D); k++) db[k]++; return f; };
      const base = () => ({ cells: cells.map((r) => [...r]), db: [...db], R, T, D });
      fr.push({ ...base(), t: -1, line: null, vars: { exp: TTL, "in flight": 0, recomputes: 0 }, note: `One hot key is read ${R}× per tick and costs ${D} tick${D > 1 ? "s" : ""} to recompute. It was cached at t=0 with a TTL of ${TTL}, so it expires at t=${TTL}. Mode: <b>${MODES[mode]}</b>.` });
      for (let t = 0; t < T; t++) {
        const fin = flights.filter((f) => f.done <= t);
        if (fin.length) { exp = t + TTL; flights = flights.filter((f) => f.done > t); }
        const lines = new Set(); let ev = "";
        for (let r = 0; r < R; r++) {
          const fresh = t < exp;
          if (fresh) {
            if (mode === 3 && t - D * beta * Math.log(rng()) >= exp) { cells[r][t] = "E"; startCompute(t); early++; lat.push(D); worst = Math.max(worst, D); lines.add(3).add(4); ev = ev || "early"; continue; }
            cells[r][t] = "H"; lat.push(0); lines.add(2).add(5); continue;
          }
          if (mode === 0 || mode === 3) { cells[r][t] = "M"; startCompute(t); lat.push(D); worst = Math.max(worst, D); lines.add(6); ev = "miss"; }
          else if (mode === 1) {
            if (flights.length) { const w = flights[0].done - t; cells[r][t] = "W"; waited++; lat.push(w); worst = Math.max(worst, w); }
            else { cells[r][t] = "M"; startCompute(t); lat.push(D); worst = Math.max(worst, D); }
            lines.add(7).add(8); ev = "miss";
          } else {
            if (!flights.length) { cells[r][t] = "R"; startCompute(t); } else cells[r][t] = "S";
            stale++; lat.push(0); lines.add(9).add(10).add(11); ev = "miss";
          }
        }
        const col = cells.map((row) => row[t]), m = col.filter((c) => c === "M").length, w = col.filter((c) => c === "W").length;
        let note;
        if (fin.length && t > 0) note = `t=${t}: ${fin.length} recompute${fin.length > 1 ? "s" : ""} finished. The entry is fresh again until t=${exp}.${fin.length > 1 ? ` ${fin.length - 1} of them did identical, wasted work.` : ""}`;
        else if (ev === "early") note = `t=${t}: the entry is still fresh (expires t=${exp}), but a request rolled the dice: <code>t − D·β·ln(u) ≥ exp</code>. It recomputes early while everyone else keeps hitting. The closer to expiry, the likelier this gets, so normally exactly one request wins before the key ever expires.`;
        else if (ev && mode === 0) note = `t=${t}: expired. <b>${m} request${m > 1 ? "s" : ""}</b> miss and each starts its own recompute: the DB now has ${db[t]} identical queries in flight. Under real traffic (thousands/s) this is the thundering herd that knocks the database over.`;
        else if (ev && mode === 1) note = m ? `t=${t}: expired. The first request takes the lock and recomputes; ${w ? `the other ${w} wait for its result` : "nobody else is waiting yet"}. One query in the DB, but callers stall for up to ${D} tick${D > 1 ? "s" : ""}.` : `t=${t}: still recomputing. ${w} more request${w !== 1 ? "s" : ""} join the waiters instead of piling on the DB.`;
        else if (ev && mode === 2) note = `t=${t}: expired, but the old value is still in hand. Callers get it immediately (stale by ${t - exp + 1} tick${t - exp ? "s" : ""}); ${col.includes("R") ? "one background refresh starts" : "the single background refresh is still running"}.`;
        else if (ev && mode === 3) note = `t=${t}: expired before anyone refreshed early (unlucky dice or β too small), so it degrades to a stampede for this window.`;
        else note = `t=${t}: fresh (expires t=${exp}). All ${R} reads are hits.`;
        fr.push({ ...base(), t, line: [...lines], vars: { t, exp, "in flight": flights.length, recomputes: computes, waiting: w }, note });
      }
      const avg = lat.reduce((a, b) => a + b, 0) / lat.length;
      const tips = ["Try the other modes with the same inputs.", "One recompute, but callers block: pair the lock with a timeout.", "Nobody waited and the DB did one query. The cost: some callers saw data up to a few ticks stale.", (cells.some((row) => row.includes("M")) ? `The key still expired at least once before an early refresh landed (recompute is long relative to the TTL), so some callers paid a full miss. A larger β refreshes earlier. ` : `Early refresh hid the expiry from callers. `) + `Raise β to refresh earlier, lower it to save work; duplicate early recomputes are rare when TTL ≫ recompute time, and a lock removes them entirely.`][mode];
      fr.push({ ...fr[fr.length - 1], line: null, summary: { computes, maxDb: Math.max(...db), waited, stale, worst, avg, early },
        note: `<b>${MODES[mode]}</b>: ${computes} recompute${computes !== 1 ? "s" : ""} (peak ${Math.max(...db)} concurrent at the DB), ${waited} waited, ${stale} served stale, worst caller latency ${worst} tick${worst !== 1 ? "s" : ""}. ${tips}` });
      return fr;
    },
    render: (f) => {
      const CL = { H: "done", M: "bad", W: "active", S: "path", R: "visit", E: "visit" };
      const head = `<tr><th></th>${Array.from({ length: f.T }, (_, t) => `<th class="${t === f.t ? "cur" : ""}">${t}</th>`).join("")}</tr>`;
      const rows = f.cells.map((row, r) => `<tr><th>req ${r + 1}</th>${row.map((c, t) => `<td class="${t > f.t ? "fut" : CL[c] || ""} ${t === f.t ? "cur" : ""}">${t > f.t ? "" : c}</td>`).join("")}</tr>`).join("");
      const mx = Math.max(1, ...f.db);
      const dbRow = `<tr class="dbrow"><th>DB load</th>${f.db.map((n, t) => `<td class="${t === f.t ? "cur" : ""}">${t <= f.t && n ? `<i class="${n > 1 ? "hot" : ""}" style="height:${Math.round((n / mx) * 100)}%"></i><em>${n}</em>` : ""}</td>`).join("")}</tr>`;
      const s = f.summary;
      const st = s ? stats([["recomputes", s.computes, s.computes > 1 ? "bad" : "done"], ["peak DB concurrency", s.maxDb, s.maxDb > 1 ? "bad" : "done"], ["callers that waited", s.waited, s.waited ? "active" : ""], ["served stale", s.stale, s.stale ? "path" : ""], ["worst latency (ticks)", s.worst]]) : "";
      return `<div class="cx-fit"><table class="cx-tl">${head}${rows}${dbRow}</table></div>${st}`;
    },
  }));

  /* =====================================================================
   * 7. Invalidation races
   * ===================================================================== */
  const RACES = {
    "read vs write: stale set after delete": { lease: false, ops: [
      ["A", "get"], ["A", "read"], ["B", "write", 2], ["B", "del"], ["A", "set"], ["C", "get"]] },
    "read vs write: with leases": { lease: true, ops: [
      ["A", "get"], ["A", "read"], ["B", "write", 2], ["B", "del"], ["A", "set"], ["C", "get"], ["C", "read"], ["C", "set"]] },
    "read vs write: delayed double delete": { lease: false, ops: [
      ["A", "get"], ["A", "read"], ["B", "write", 2], ["B", "del"], ["A", "set"], ["C", "get"], ["B", "wait", "~500 ms later"], ["B", "del"], ["C", "get"], ["C", "read"], ["C", "set"]] },
    "two writers: set on write": { lease: false, ops: [
      ["A", "write", 2], ["B", "write", 3], ["B", "setw"], ["A", "setw"], ["C", "get"]] },
    "two writers: delete on write": { lease: false, ops: [
      ["A", "write", 2], ["B", "write", 3], ["B", "del"], ["A", "del"], ["C", "get"], ["C", "read"], ["C", "set"]] },
    "two writers: versioned set": { lease: false, ver: true, ops: [
      ["A", "write", 2], ["B", "write", 3], ["B", "setw"], ["A", "setw"], ["C", "get"]] },
  };
  Viz.register("caching-race", (el) => Viz.player(el, {
    title: "Invalidation races: the cache ends up older than the DB",
    legend: [["done", "hit / accepted"], ["bad", "stale or rejected"], ["visit", "database"], ["path", "cache write"]],
    speed: 1100,
    codeLang: "python",
    code: [
      "def read(k):",
      "    v = cache.get(k)",
      "    if v is None:",
      "        v = db.select(k)",
      "        cache.set(k, v)   # ← may be stale",
      "    return v",
      "def write(k, new):",
      "    db.update(k, new)",
      "    cache.delete(k)     # or cache.set",
    ],
    inputs: [{ key: "sc", label: "scenario", type: "select", options: Object.keys(RACES), value: Object.keys(RACES)[0] }],
    random: () => ({ sc: Object.keys(RACES)[Viz.rand(0, Object.keys(RACES).length - 1)] }),
    build: ({ sc }) => {
      const S = RACES[sc];
      if (!S) throw new Error("Pick a scenario from the list.");
      const db = { v: 1, ver: 1 }, cache = { has: true, v: 1, ver: 1 }, local = {}, lease = {}, msgs = [], fr = [];
      let nextLease = 7, valid = null, dels = 0;
      cache.has = !sc.startsWith("read"); // readers start from a miss; writers from a warm cache
      const cacheRows = () => (cache.has ? [["x", `${cache.v}${S.ver ? ` (v${cache.ver})` : ""}`, cache.v !== db.v ? "bad" : "done"]] : []);
      const push = (m, line, note) => { if (m) msgs.push(m); fr.push({ msgs: [...msgs], cache: cacheRows(), db: [["x", `${db.v}${S.ver ? ` (v${db.ver})` : ""}`]], local: Object.entries(local).map(([w, l]) => [w, `x=${l.v}${S.ver ? ` v${l.ver}` : ""}${lease[w] ? ` lease#${lease[w]}` : ""}`]), ok: !cache.has || cache.v === db.v, line, note, vars: { "cache x": cache.has ? cache.v : "∅", "db x": db.v, verdict: !cache.has || cache.v === db.v ? "consistent" : "STALE" } }); };
      push(null, null, `${sc.startsWith("read") ? "Client A reads x while client B updates it. The cache starts empty" : "Clients A and B update x at nearly the same time. The cache starts warm"}; the database holds x=1.${S.lease ? " The cache hands out a <b>lease</b> token on every miss." : ""}${S.ver ? " Every DB row carries a version, and the cache only accepts a set with a higher version." : ""}`);
      for (const [w, op, arg] of S.ops) {
        if (op === "get") {
          if (cache.has) push({ from: w, to: "cache", label: `GET x → ${cache.v}`, cls: cache.v === db.v ? "hit" : "miss" }, [1, 5], cache.v === db.v ? `${w} hits and gets the current value.` : `<b>${w} reads x=${cache.v}, but the DB says ${db.v}.</b> And nothing will fix it until the TTL expires (or the next write).`);
          else if (S.lease) { lease[w] = nextLease; valid = nextLease++; local[w] = local[w] || { v: "?", ver: 0 }; push({ from: "cache", to: w, label: `miss, lease #${lease[w]}`, cls: "miss" }, [1, 2], `Miss. The cache remembers it issued lease #${lease[w]} to ${w}; only that holder may fill x, and only if nothing invalidates x first.`); }
          else push({ from: "cache", to: w, label: "GET x → miss", cls: "miss" }, [1, 2], `${w} misses and will load from the database.`);
        } else if (op === "read") {
          local[w] = { v: db.v, ver: db.ver };
          push({ from: w, to: "db", label: `SELECT x → ${db.v}`, cls: "db" }, 3, `${w} reads x=${db.v} from the DB and holds it in memory. ${sc.startsWith("read") && w === "A" ? "Now imagine A pauses here: a GC pause, a slow network packet, a context switch." : ""}`);
        } else if (op === "write") {
          db.v = arg; db.ver++; local[w] = { v: arg, ver: db.ver };
          push({ from: w, to: "db", label: `UPDATE x=${arg}`, cls: "db" }, 7, `${w} commits x=${arg}${S.ver ? ` (version ${db.ver})` : ""}. The DB is now the truth; any cached copy is old.`);
        } else if (op === "del") {
          cache.has = false; if (S.lease) valid = null; dels++;
          push({ from: w, to: "cache", label: "DEL x", cls: "miss" }, 8, `${w} deletes x from the cache${S.lease ? " and that also <b>invalidates every outstanding lease</b> for x" : ""}. ${dels === 2 && sc.includes("double") ? "Second delete: it removes whatever slipped in between." : "Looks correct…"}`);
        } else if (op === "wait") {
          push({ from: w, to: w, label: arg, cls: "info" }, null, `${w} schedules a second delete. Delays are a guess: long enough to cover most slow readers, never all of them.`);
        } else if (op === "set" || op === "setw") {
          const l = local[w];
          if (S.lease && op === "set") {
            if (lease[w] && lease[w] === valid) { cache.has = true; cache.v = l.v; cache.ver = l.ver; valid = null; push({ from: w, to: "cache", label: `SET x=${l.v} lease #${lease[w]} ✓`, cls: "fill" }, 4, `Lease #${lease[w]} is still valid, so the set is accepted.`); }
            else push({ from: w, to: "cache", label: `SET x=${l.v} lease #${lease[w]} ✗`, cls: "miss" }, 4, `<b>Rejected:</b> lease #${lease[w]} was invalidated by the delete. A's stale value never reaches the cache. (This is the mechanism Facebook described for memcache.)`);
            delete lease[w]; continue;
          }
          if (S.ver && cache.has && cache.ver >= l.ver) { push({ from: w, to: "cache", label: `SET x=${l.v} v${l.ver} ✗ (has v${cache.ver})`, cls: "miss" }, 8, `<b>Rejected:</b> the cache already holds v${cache.ver}, newer than ${w}'s v${l.ver}. Compare-and-set on a version turns “last writer wins” into “newest version wins”.`); continue; }
          const wasStale = l.v !== db.v;
          cache.has = true; cache.v = l.v; cache.ver = l.ver;
          push({ from: w, to: "cache", label: `SET x=${l.v}${S.ver ? ` v${l.ver}` : ""}`, cls: wasStale ? "miss" : "fill" }, op === "set" ? 4 : 8,
            wasStale ? `<b>${w} writes its old value x=${l.v} into the cache</b>, after the ${op === "set" ? "delete" : "other writer's set"}. The delete already happened, so nothing removes it: the cache now disagrees with the DB (x=${db.v}).` : `${w} fills the cache with x=${l.v}, which matches the DB.`);
        }
      }
      const last = fr[fr.length - 1];
      fr.push({ ...last, line: null, note: `${last.ok ? "<b>Consistent:</b> " : "<b>Stale until the TTL expires:</b> "}${{
        "read vs write: stale set after delete": "the classic cache-aside race. It needs a read that started before a write to finish after it, which is rare per request and certain at scale. A TTL bounds the damage; leases or versions remove it.",
        "read vs write: with leases": "the delete invalidated A's lease, so the slow reader couldn't write its old value, and the next reader filled the cache correctly.",
        "read vs write: delayed double delete": "the second delete cleaned up the stale value, but readers saw x=1 in between. It narrows the window; it doesn't close it.",
        "two writers: set on write": "writes reached the cache in a different order than the DB. Setting on write is racy; prefer delete.",
        "two writers: delete on write": "deletes are idempotent and order-independent, so the next read loads the latest value. That's why cache-aside writes delete instead of set.",
        "two writers: versioned set": "the stale set carried an older version and was refused.",
      }[sc]}` });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "A", label: "Client A" }, { id: "B", label: "Client B" }, { id: "C", label: "Client C" }, { id: "cache", label: "Cache" }, { id: "db", label: "Database" }];
      return `<div class="cx-fit">${seq(lanes, f.msgs, { label: "invalidation race", max: 11 })}</div><div class="cx-panels">${kv("cache", f.cache, { empty: "x not cached" })}${kv("database", f.db)}${kv("client memory", f.local, { empty: "—" })}<div class="cx-verdict ${f.ok ? "done" : "bad"}">${f.ok ? "cache = DB" : "cache ≠ DB"}</div></div>`;
    },
  }));

  /* =====================================================================
   * 8. Two-level cache (L1 in-process + L2 Redis) with/without a backplane
   * ===================================================================== */
  function parseL12(s) {
    const toks = String(s).split(",").map((x) => x.trim()).filter(Boolean);
    if (!toks.length || toks.length > 12) throw new Error("Use 1–12 operations, e.g. 1:get, 2:get, 1:set 7, wait 40.");
    return toks.map((t) => {
      let m;
      if ((m = t.match(/^([12])\s*:\s*get$/i))) return { n: +m[1], op: "get" };
      if ((m = t.match(/^([12])\s*:\s*set\s+(-?\d{1,5})$/i))) return { n: +m[1], op: "set", v: +m[2] };
      if ((m = t.match(/^wait\s+(\d{1,4})$/i))) return { op: "wait", s: +m[1] };
      throw new Error(`Can't read “${t}”. Use 1:get, 2:set 7 or wait 40.`);
    });
  }
  function l12Svg(f) {
    const W = 640, H = 300, E = f.edges || {};
    const box = (x, y, w, h, c) => `<rect class="box ${c || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
    const tx = (x, y, t, c = "cx-t", a = "middle") => `<text class="${c}" x="${x}" y="${y}" text-anchor="${a}">${esc(t)}</text>`;
    const edge = (id, x1, y1, x2, y2, extra = "") => `<line class="edge ${E[id] || ""} ${extra}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
    let s = `<svg class="dg cx-l12" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Two app nodes with in-process L1 caches, a shared Redis L2 and the database">`;
    s += edge("1-l2", 150, 118, 260, 176) + edge("2-l2", 490, 118, 380, 176) + edge("l2-db", 320, 222, 320, 238);
    s += edge("1-db", 70, 118, 230, 262) + edge("2-db", 570, 118, 410, 262);
    s += edge("bp", 232, 46, 408, 46, `dash ${f.bp ? "" : "off"}`);
    s += tx(320, 38, f.bp ? "backplane: “x changed”" : "no backplane", f.bp ? "small" : "small muted");
    for (const n of [1, 2]) {
      const x = n === 1 ? 20 : 410, L = f.l1[n];
      s += box(x, 12, 210, 106, f.cur === n ? "accent" : "");
      s += tx(x + 105, 32, `App node ${n}`);
      s += box(x + 14, 44, 182, 62, L.cls);
      s += tx(x + 105, 64, "L1 · in-process", "cx-s");
      s += tx(x + 105, 88, L.txt, "mono");
    }
    s += box(230, 176, 180, 46, f.l2.cls) + tx(320, 194, "L2 · Redis (shared)", "cx-s") + tx(320, 212, f.l2.txt, "mono");
    s += box(230, 238, 180, 50, f.dbCls || "") + tx(320, 258, "Database", "cx-s") + tx(320, 278, `x = ${f.db}`, "mono");
    return s + "</svg>";
  }
  Viz.register("caching-l1l2", (el) => Viz.player(el, {
    title: "L1 + L2: fast local copies, and how they go stale",
    legend: [["done", "hit, matches DB"], ["bad", "stale copy"], ["path", "data flowing"], ["accent", "node handling the request"]],
    speed: 1100,
    codeLang: "python",
    code: [
      "def get(k):",
      "    if (v := l1.get(k)): return v",
      "    if (v := l2.get(k)) is not None:",
      "        l1.set(k, v, L1); return v",
      "    v = db.select(k)",
      "    l2.set(k,v,L2); l1.set(k,v,L1)",
      "    return v",
      "def update(k, v):",
      "    db.update(k, v); l2.del(k); l1.del(k)",
      "    backplane.publish('invalidate', k)",
      "# all nodes: on 'invalidate' → l1.del(k)",
    ],
    inputs: [
      { key: "ops", label: "operations", value: "1:get, 2:get, 1:set 7, 1:get, 2:get, wait 30, 2:get", width: 320 },
      { key: "bp", label: "backplane", type: "select", options: ["off", "on"], value: "off" },
      { key: "l1", label: "L1 TTL (s)", value: "30", width: 60 },
      { key: "l2", label: "L2 TTL (s)", value: "300", width: 60 },
    ],
    random: () => {
      const out = [], n = Viz.rand(5, 9);
      for (let i = 0; i < n; i++) { const r = Math.random(); out.push(r < 0.6 ? `${Viz.rand(1, 2)}:get` : r < 0.85 ? `${Viz.rand(1, 2)}:set ${Viz.rand(1, 99)}` : `wait ${Viz.rand(5, 60)}`); }
      return { ops: out.join(", "), bp: Math.random() < 0.5 ? "on" : "off", l1: String([10, 30, 60][Viz.rand(0, 2)]), l2: String([120, 300, 600][Viz.rand(0, 2)]) };
    },
    build: (inp) => {
      const ops = parseL12(inp.ops), bp = inp.bp === "on", T1 = int(inp.l1, "L1 TTL", 1, 3600), T2 = int(inp.l2, "L2 TTL", 1, 86400);
      const l1 = { 1: null, 2: null }; let l2 = null, db = 10, t = 0, staleReads = 0, dbReads = 0;
      const fr = [];
      const show = (e, ttl) => (e && e.exp > t ? { txt: `x=${e.v} · ${e.exp - t}s left`, cls: e.v === db ? "done" : "bad" } : { txt: e ? "expired" : "empty", cls: "" });
      const push = (o) => fr.push({ bp, db, l1: { 1: show(l1[1]), 2: show(l1[2]) }, l2: show(l2), vars: { t: `${t}s`, "db x": db, "stale reads": staleReads, "db reads": dbReads }, ...o });
      push({ line: null, note: `Two app servers, each with a private in-process L1 (TTL ${T1}s) in front of a shared Redis L2 (TTL ${T2}s). The database holds x=10. Backplane: <b>${bp ? "on" : "off"}</b>.` });
      for (const o of ops) {
        if (o.op === "wait") { t += o.s; push({ line: null, note: `${o.s} s pass (t=${t}s). Entries past their TTL are now dead.` }); continue; }
        const n = o.n, other = n === 1 ? 2 : 1, live = (e) => e && e.exp > t;
        if (o.op === "get") {
          if (live(l1[n])) {
            const st = l1[n].v !== db; if (st) staleReads++;
            push({ cur: n, line: 1, edges: {}, note: st ? `<b>Node ${n} returns x=${l1[n].v} from its L1, but the DB says ${db}.</b> Its L1 never heard about the write on node ${other}. It stays wrong for ${l1[n].exp - t} more second${l1[n].exp - t === 1 ? "" : "s"}: this is why L1 TTLs are short.` : `L1 hit on node ${n}: a dictionary lookup, ~100 ns, no network, no deserialization.` });
          } else if (live(l2)) {
            l1[n] = { v: l2.v, exp: t + T1 };
            push({ cur: n, line: [2, 3], edges: { [`${n}-l2`]: "path" }, note: `L1 miss on node ${n}; L2 (Redis) hit: ~0.5 ms and a deserialize. Node ${n} copies it into its L1 for ${T1}s.` });
          } else {
            dbReads++; l2 = { v: db, exp: t + T2 }; l1[n] = { v: db, exp: t + T1 };
            push({ cur: n, line: [4, 5, 6], edges: { [`${n}-db`]: "path", [`${n}-l2`]: "path" }, dbCls: "visit", note: `Both levels miss, so node ${n} reads the database (x=${db}) and fills L2 (TTL ${T2}s) and its own L1 (TTL ${T1}s).` });
          }
        } else {
          db = o.v; l2 = null; l1[n] = null;
          push({ cur: n, line: 8, edges: { [`${n}-db`]: "bad", [`${n}-l2`]: "bad" }, dbCls: "visit", note: `Node ${n} writes x=${o.v} to the DB, then deletes x from L2 and from its own L1. ${live(l1[other]) ? `Node ${other} still holds x=${l1[other].v} in its L1…` : `Node ${other} has nothing cached, so it can't be stale.`}` });
          if (bp) {
            const had = live(l1[other]); l1[other] = null;
            push({ cur: n, line: [9, 10], edges: { bp: "active" }, note: `Node ${n} publishes “x changed” on the backplane (Redis pub/sub). Node ${other} ${had ? "drops its L1 copy" : "has nothing to drop"}. The stale window shrinks to the pub/sub delay (usually ms). Messages can still be lost on a reconnect, so keep the L1 TTL as a safety net.` });
          }
        }
        t += 1;
      }
      const last = fr[fr.length - 1];
      fr.push({ ...last, line: null, edges: {}, cur: 0, note: `Done: ${dbReads} DB read${dbReads === 1 ? "" : "s"}, <b>${staleReads} stale read${staleReads === 1 ? "" : "s"}</b>. ${staleReads ? bp ? "" : "Turn the backplane on and run it again." : "Every read agreed with the database."}` });
      return fr;
    },
    render: (f) => `<div class="cx-fit">${l12Svg(f)}</div>`,
  }));

  /* =====================================================================
   * 9. HTTP caching: browser, CDN and origin
   * ===================================================================== */
  const CCS = ["public, max-age=60", "public, max-age=10, s-maxage=60", "public, max-age=30, stale-while-revalidate=60", "no-cache", "private, max-age=60", "no-store"];
  function parseCC(s) {
    const d = {}; s.split(",").forEach((p) => { const [k, v] = p.trim().split("="); d[k] = v === undefined ? true : +v; });
    return { maxAge: d["max-age"] ?? 0, sMaxAge: d["s-maxage"], noCache: !!d["no-cache"], noStore: !!d["no-store"], priv: !!d.private, swr: d["stale-while-revalidate"] || 0 };
  }
  Viz.register("caching-http", (el) => Viz.player(el, {
    title: "HTTP caching: who answers, and with what?",
    legend: [["done", "served from a cache"], ["bad", "stale content / full re-download"], ["visit", "goes to origin"], ["path", "304: revalidated, no body"]],
    speed: 1100,
    codeLang: "typescript",
    code: [
      "// origin: GET /api/products",
      "const etag = `\"${version}\"`;",
      "if (req.headers['if-none-match'] === etag)",
      "  return res.status(304).end();",
      "res.set('Cache-Control', POLICY);",
      "res.set('ETag', etag);",
      "res.json(products);   // 200 + body",
    ],
    inputs: [
      { key: "cc", label: "Cache-Control", type: "select", options: CCS, value: CCS[0] },
      { key: "etag", label: "ETag", type: "select", options: ["yes", "no"], value: "yes" },
      { key: "reqs", label: "requests (browser@second)", value: "A@0, A@20, B@30, A@75, B@100, A@140", width: 270 },
      { key: "chg", label: "content changes at (s)", value: "90", width: 70 },
    ],
    random: () => {
      let t = 0; const out = [];
      for (let i = 0, n = Viz.rand(4, 7); i < n; i++) { out.push(`${"AB"[Viz.rand(0, 1)]}@${t}`); t += Viz.rand(5, 50); }
      return { cc: CCS[Viz.rand(0, CCS.length - 1)], etag: Math.random() < 0.7 ? "yes" : "no", reqs: out.join(", "), chg: String(Viz.rand(20, t)) };
    },
    build: (inp) => {
      const cc = parseCC(inp.cc), useTag = inp.etag === "yes", chg = int(inp.chg, "change time", 0, 100000);
      const reqs = String(inp.reqs).split(",").map((x) => x.trim()).filter(Boolean).map((x) => {
        const m = x.match(/^([AB])\s*@\s*(\d{1,6})$/i); if (!m) throw new Error(`Can't read “${x}”. Use A@0, B@30, …`);
        return { who: m[1].toUpperCase(), t: +m[2] };
      });
      if (!reqs.length || reqs.length > 10) throw new Error("Use 1–10 requests.");
      reqs.forEach((r, i) => { if (i && r.t < reqs[i - 1].t) throw new Error("Request times must not go backwards."); });
      const ver = (t) => (t < chg ? 1 : 2), BODY = 12, NM = 0.3;
      const cdnStores = !cc.noStore && !cc.priv, brStores = !cc.noStore;
      const cdnLife = cc.noCache ? 0 : cc.sMaxAge ?? cc.maxAge, brLife = cc.noCache ? 0 : cc.maxAge;
      const caches = { A: null, B: null, cdn: null }, msgs = [], fr = [];
      let originHits = 0, originKB = 0, wireKB = 0, cacheAnswers = 0, staleServed = 0, t = 0;
      const desc = (c, life) => (c ? `v${c.v} · age ${t - c.born}s / ${life}s${t - c.born < life ? " fresh" : " stale"}` : brStores ? "empty" : "never stored");
      const push = (m, line, note) => {
        if (m) msgs.push({ ...m, label: `${m.label}` });
        fr.push({ msgs: [...msgs], line, note, panel: [["Browser A", desc(caches.A, brLife), caches.A && caches.A.v !== ver(t) ? "bad" : ""], ["Browser B", desc(caches.B, brLife), caches.B && caches.B.v !== ver(t) ? "bad" : ""], ["CDN edge", cdnStores ? desc(caches.cdn, cdnLife) : "won't store (private/no-store)", caches.cdn && caches.cdn.v !== ver(t) ? "bad" : ""], ["Origin", `v${ver(t)}${useTag ? `, ETag "v${ver(t)}"` : ""}`, ""]],
          vars: { t: `${t}s`, "origin hits": originHits, "KB from origin": +originKB.toFixed(1), "KB over the wire": +wireKB.toFixed(1) } });
      };
      push(null, null, `Every response carries <code>Cache-Control: ${esc(inp.cc)}</code>${useTag ? " and an ETag" : " and no validator"}. The content changes from v1 to v2 at t=${chg}s.`);
      const origin = (inm, bg) => {
        originHits++;
        const cur = ver(t), notMod = useTag && inm === cur;
        push({ from: "cdn", to: "origin", label: `GET${inm ? ` If-None-Match "v${inm}"` : ""}`, cls: "db", dash: bg }, [0, 2], `The edge goes to the origin${inm ? `, asking “has v${inm} changed?”` : ""}${bg ? " in the background" : ""}.`);
        if (notMod) { originKB += NM; push({ from: "origin", to: "cdn", label: "304 Not Modified", cls: "fill", dash: bg }, [2, 3], "The ETag still matches: <b>304</b>, headers only. The edge resets the age of its copy without re-downloading the body."); }
        else { originKB += BODY; push({ from: "origin", to: "cdn", label: `200 v${cur} · ${BODY} KB`, cls: "db", dash: bg }, [4, 5, 6], `${inm ? `The ETag no longer matches (now "v${cur}"): ` : ""}full <b>200</b> with the ${BODY} KB body.`); }
        return notMod ? { status: 304 } : { status: 200, v: cur };
      };
      const fromCdn = (who, inm, bg) => {
        push({ from: who, to: "cdn", label: `GET${inm ? ` If-None-Match "v${inm}"` : ""}`, dash: bg }, null, `Browser ${who} ${bg ? "revalidates in the background" : "sends the request"}${inm ? ` with <code>If-None-Match: "v${inm}"</code>` : ""}.`);
        const c = caches.cdn;
        let res, after = null;
        if (cdnStores && c && t - c.born < cdnLife) { cacheAnswers++; res = { v: c.v, born: c.born, hit: true }; }
        else if (cdnStores && c && t - c.born < cdnLife + cc.swr) {
          cacheAnswers++; res = { v: c.v, born: c.born, hit: true, swr: true };
          after = () => { const r = origin(useTag ? c.v : null, true); if (r.status === 304) c.born = t; else caches.cdn = { v: r.v, born: t }; };
        } else {
          const r = origin(cdnStores ? (useTag && c ? c.v : null) : inm, false);
          if (r.status === 304 && !cdnStores) { wireKB += NM; if (brStores && caches[who]) caches[who].born = t; push({ from: "cdn", to: who, label: "304 Not Modified", cls: "fill" }, 3, `The edge passes the 304 through: browser ${who}'s copy is still good.`); return { status: 304 }; }
          if (cdnStores) { if (r.status === 304) c.born = t; else caches.cdn = { v: r.v, born: t }; res = { v: caches.cdn.v, born: caches.cdn.born }; }
          else res = { v: r.v, born: t };
        }
        const age = t - res.born, stale = res.v !== ver(t);
        if (stale) staleServed++;
        if (useTag && inm === res.v) { wireKB += NM; push({ from: "cdn", to: who, label: `304 Not Modified${res.hit ? " (edge)" : ""}`, cls: stale ? "miss" : "fill" }, 3, `${res.hit ? "The edge answers itself: its copy matches" : "The copy matches"} the browser's ETag, so ${who} gets a 304 and keeps its body.${res.swr ? " (Served stale-while-revalidate.)" : ""}${stale ? ` <b>But the origin is already at v${ver(t)}</b>: the edge validated against its own ${t - res.born}s-old copy, not the origin.` : ""}`); }
        else {
          wireKB += BODY;
          push({ from: "cdn", to: who, label: `200 v${res.v} · Age ${age}${res.hit ? " (edge hit)" : ""}`, cls: stale ? "miss" : res.hit ? "hit" : "fill" }, [4, 6],
            `${res.hit ? `<b>Edge hit</b>${res.swr ? " (stale, but inside the stale-while-revalidate window)" : ""}: the origin isn't touched.` : "The edge relays the fresh response."} <code>Age: ${age}</code> tells the browser how old it already is${brStores ? `, so it will treat it as fresh for only ${Math.max(0, brLife - age)}s more` : ""}.${stale ? ` <b>But the origin is already at v${ver(t)}</b>: this is the price of a ${cdnLife}s shared TTL.` : ""}`);
        }
        if (brStores) { if (!(useTag && inm === res.v)) caches[who] = { v: res.v, born: res.born }; else caches[who].born = res.born; }
        if (after) after();
        return res;
      };
      for (const r of reqs) {
        t = r.t;
        const b = caches[r.who];
        if (brStores && b && t - b.born < brLife) {
          cacheAnswers++; const stale = b.v !== ver(t); if (stale) staleServed++;
          push({ from: r.who, to: r.who, label: `t=${t}: from browser cache v${b.v} (age ${t - b.born})`, cls: stale ? "miss" : "hit" }, null, `<b>No request at all.</b> Browser ${r.who}'s copy is ${t - b.born}s old, under max-age=${brLife}. ${stale ? `It shows v${b.v} although the origin has v${ver(t)}: <b>you cannot recall a response that's already in a browser.</b>` : "Zero latency, zero server cost."}`);
          continue;
        }
        if (brStores && b && t - b.born < brLife + cc.swr) {
          cacheAnswers++; const stale = b.v !== ver(t); if (stale) staleServed++;
          push({ from: r.who, to: r.who, label: `t=${t}: stale copy v${b.v} shown instantly`, cls: stale ? "miss" : "hit" }, null, `The copy is past max-age but inside <code>stale-while-revalidate</code>, so the page renders it immediately and refreshes in the background.`);
          fromCdn(r.who, useTag ? b.v : null, true);
          continue;
        }
        push({ from: r.who, to: r.who, label: `t=${t}: ${b ? (cc.noCache ? "must revalidate (no-cache)" : "copy expired") : "nothing cached"}`, cls: "info" }, null, b ? (cc.noCache ? "<code>no-cache</code> means “store it, but ask before every use”. With an ETag that's cheap: a 304 carries no body." : `Browser ${r.who}'s copy is older than max-age=${brLife}.`) : cc.noStore ? "<code>no-store</code>: nothing is ever kept, so every request is a full round trip." : `Browser ${r.who} has nothing cached.`);
        fromCdn(r.who, useTag && b ? b.v : null, false);
      }
      const last = fr[fr.length - 1];
      fr.push({ ...last, line: null, summary: { originHits, originKB, wireKB, cacheAnswers, staleServed, n: reqs.length },
        note: `${reqs.length} page loads → <b>${originHits} origin request${originHits === 1 ? "" : "s"}</b>, ${+originKB.toFixed(1)} KB out of the origin, ${staleServed} answer${staleServed === 1 ? "" : "s"} showing old content. Try <code>no-cache</code> with ETag on (always correct, cheap 304s) versus <code>max-age=60</code> (fewer requests, visible staleness).` });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "A", label: "Browser A" }, { id: "B", label: "Browser B" }, { id: "cdn", label: "CDN edge", sub: "shared cache" }, { id: "origin", label: "Origin", sub: "your app" }];
      const s = f.summary;
      const st = s ? stats([["page loads", s.n], ["origin requests", s.originHits, s.originHits > s.n / 2 ? "bad" : "done"], ["KB from origin", +s.originKB.toFixed(1)], ["stale answers", s.staleServed, s.staleServed ? "bad" : "done"]]) : "";
      return `<div class="cx-fit">${seq(lanes, f.msgs, { label: "HTTP caching sequence", max: 11 })}</div><div class="cx-panels">${kv("caches right now", f.panel)}</div>${st}`;
    },
  }));
})();
