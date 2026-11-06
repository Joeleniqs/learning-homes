/* Hashing visualizers. Every frame is produced by running the real algorithm on the inputs. */
(() => {
  const esc = Viz.esc;
  const ints = (s, min, max, lo, hi) => {
    const a = Viz.parse.ints(s, { min, max });
    if (a.some((v) => !Number.isInteger(v) || v < lo || v > hi)) throw new Error(`Use whole numbers from ${lo} to ${hi}.`);
    return a;
  };
  const int = (s, lo, hi, what) => {
    const t = String(s).trim(), n = Number(t);
    if (t === "" || !Number.isInteger(n) || n < lo || n > hi) throw new Error(`${what}: use a whole number from ${lo} to ${hi}.`);
    return n;
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const fmtR = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2));
  const col = (...p) => `<div class="ha-col">${p.filter(Boolean).join("")}</div>`;
  const stats = (o) => `<div class="ha-stats">${Object.entries(o).map(([k, v]) => `<div class="ha-stat"><span>${esc(k)}</span><b>${esc(Viz.fmt(v))}</b></div>`).join("")}</div>`;
  const calc = (html) => (html ? `<div class="ha-calc">${html}</div>` : "");
  const chip = (t, c = "") => `<span class="ha-chip ${c}">${esc(t)}</span>`;
  const mapView = (label, entries, cls = () => "", empty = "empty") => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="ha-map">${entries.length
    ? entries.map(([k, v]) => `<span class="ha-kv ${cls(k)}"><b>${esc(Viz.fmt(k))}</b><i>${esc(Viz.fmt(v))}</i></span>`).join("")
    : `<span class="ha-empty">${esc(empty)}</span>`}</div></div>`;

  /* Operation strings: "42" insert, "?42" lookup, "-42" delete, "r" random pick (where allowed). */
  const parseOps = (s, maxN, allowRand = false) => {
    const toks = String(s).split(/[\s,]+/).filter(Boolean);
    if (!toks.length || toks.length > maxN) throw new Error(`Use 1–${maxN} operations, for example 12, 25, ?25, -12.`);
    return toks.map((t) => {
      if (allowRand && /^r$/i.test(t)) return { op: "rand" };
      const m = /^([?+-]?)(\d{1,3})$/.exec(t);
      if (!m) throw new Error(`"${t}" is not an operation. Write 42 to insert, ?42 to look up, -42 to delete${allowRand ? ", r for a random pick" : ""} (keys 0–999).`);
      return { op: m[1] === "?" ? "find" : m[1] === "-" ? "del" : "add", k: Number(m[2]) };
    });
  };
  const randOps = (n, lo, hi, pFind = 0.2, pDel = 0.15, pRand = 0) => {
    const keys = [], out = [];
    for (let i = 0; i < n; i++) {
      const r = Math.random();
      if (keys.length && r < pFind) out.push("?" + (Math.random() < 0.6 ? pick(keys) : Viz.rand(lo, hi)));
      else if (keys.length && r < pFind + pDel) out.push("-" + pick(keys));
      else if (keys.length && r < pFind + pDel + pRand) out.push("r");
      else { const k = Viz.rand(lo, hi); keys.push(k); out.push(String(k)); }
    }
    return out.join(", ");
  };
  const opWord = { add: "insert", find: "lookup", del: "delete" };

  /* ───────── 1: separate chaining ───────── */
  const chainTable = (f) => `<div class="v-labeled"><span class="v-caption">table: bucket → chain</span><div class="ha-table">${f.table.map((chain, b) => {
    const on = b === f.bkt;
    const items = chain.map((k, j) => chip(k, !on ? "" : j === f.cur ? (f.hit ? "done" : "active") : f.cur !== undefined && j < f.cur ? "seen" : "")).join('<span class="ha-arr">→</span>');
    return `<div class="ha-bkt ${on ? (f.miss ? "bad" : "visit") : ""}"><span class="ha-bi">${b}</span><span class="ha-chain">${items}${chain.length ? '<span class="ha-arr">→</span>' : ""}<span class="ha-null">∅</span></span></div>`;
  }).join("")}</div></div>`;

  Viz.register("hashing-chaining", (el) => Viz.player(el, {
    title: "Separate chaining: hash to a bucket, then walk that bucket's short list",
    tag: "HASH SET · CHAINING",
    legend: [["visit", "bucket hash(k) % m"], ["active", "key being compared"], ["done", "inserted / found"], ["bad", "not found"]],
    codeLang: "python",
    code: [
      "def add(k):",
      "    b = table[hash(k) % m]  # pick bucket",
      "    for key in b:  # walk the chain",
      "        if key == k: return  # already in",
      "    b.append(k); n += 1",
      "def contains(k):",
      "    for key in table[hash(k) % m]:",
      "        if key == k: return True",
      "    return False  # chain exhausted",
      "def remove(k):",
      "    b = table[hash(k) % m]",
      "    if k in b: b.remove(k); n -= 1",
    ],
    inputs: [
      { key: "ops", label: "operations: 42 insert · ?42 find · -42 delete", value: "12, 25, 7, 18, 31, 44, 9, ?31, ?20, -25, ?18", width: 330 },
      { key: "m", label: "buckets m", type: "select", options: ["5", "7", "8", "10", "11", "13"], value: "7" },
    ],
    random: () => ({ ops: randOps(Viz.rand(8, 12), 0, 60), m: pick(["5", "7", "8", "10", "11"]) }),
    build: ({ ops, m }) => {
      const list = parseOps(ops, 16), M = Number(m), table = Array.from({ length: M }, () => []), fr = [];
      let n = 0, cmps = 0;
      const snap = (x) => ({ table: table.map((b) => b.slice()), M, n, cmps, longest: Math.max(...table.map((b) => b.length)), ...x });
      fr.push(snap({ line: [], vars: { m: M, n: 0 }, note: `An array of ${M} buckets, each holding a short list (a <b>chain</b>). A key's bucket is hash(k) % m; for small integers Python's hash(k) is k itself, so the bucket is just k mod ${M}. Everything depends on keys spreading evenly: then every chain holds about n/m keys and each operation is O(1 + n/m).` }));
      list.forEach((o) => {
        const b = o.k % M, chain = table[b];
        const L0 = o.op === "add" ? 1 : o.op === "find" ? 6 : 10;
        fr.push(snap({ bkt: b, calc: `${opWord[o.op]}(${o.k}): bucket = ${o.k} mod ${M} = ${b}`, line: L0, vars: { k: o.k, bucket: b, chain: chain.length },
          note: `${opWord[o.op]} ${o.k}: hash(${o.k}) % ${M} = <b>${b}</b>. One arithmetic step jumps straight to bucket ${b}; the other ${M - 1} buckets are never touched. ${chain.length ? `Its chain holds ${chain.length} key(s), so at most ${chain.length} comparison(s).` : "Its chain is empty."}` }));
        let found = -1;
        for (let j = 0; j < chain.length; j++) {
          cmps++;
          if (chain[j] === o.k) { found = j; break; }
          fr.push(snap({ bkt: b, cur: j, calc: `${chain[j]} == ${o.k}? no`, line: o.op === "add" ? [2, 3] : o.op === "find" ? [6, 7] : 11, vars: { k: o.k, bucket: b, key: chain[j], comparisons: cmps },
            note: `${chain[j]} ≠ ${o.k}. Same bucket because ${chain[j]} mod ${M} = ${b} too: a <b>collision</b>. Colliding keys are fine; they just share the chain. Keep walking.` }));
        }
        if (o.op === "add") {
          if (found >= 0) fr.push(snap({ bkt: b, cur: found, hit: true, res: { op: "add", k: o.k, r: "dup" }, calc: `${o.k} == ${o.k}? yes`, line: 3, vars: { k: o.k, bucket: b, comparisons: cmps }, note: `${o.k} is already in the chain. A set stores each key once, so nothing changes. (A dict would overwrite the value here.)` }));
          else {
            chain.push(o.k); n++;
            fr.push(snap({ bkt: b, cur: chain.length - 1, hit: true, res: { op: "add", k: o.k, r: "added" }, calc: `append ${o.k} to bucket ${b}`, line: 4, vars: { k: o.k, bucket: b, n, "n/m": fmtR(n / M) },
              note: `Not in the chain, so append it. n = ${n}, load factor α = n/m = ${fmtR(n / M)}.${n > M ? " α is above 1 now: chains are getting longer than one key on average. A real table would have resized long before this (see the next visualizer)." : ""}` }));
          }
        } else if (o.op === "find") {
          if (found >= 0) fr.push(snap({ bkt: b, cur: found, hit: true, res: { op: "find", k: o.k, r: true }, calc: `${o.k} == ${o.k}? yes`, line: 7, vars: { k: o.k, bucket: b, comparisons: cmps }, note: `Found ${o.k} in bucket ${b} after ${found + 1} comparison(s). Lookup cost is the chain length, not n.` }));
          else fr.push(snap({ bkt: b, miss: true, res: { op: "find", k: o.k, r: false }, calc: `${o.k} not in bucket ${b}`, line: 8, vars: { k: o.k, bucket: b, comparisons: cmps }, note: `Walked the whole chain of bucket ${b} (${chain.length} key(s)) without a match. Because ${o.k} could only ever live in bucket ${b}, it is definitely absent: no other bucket needs checking.` }));
        } else if (found >= 0) {
          chain.splice(found, 1); n--;
          fr.push(snap({ bkt: b, res: { op: "del", k: o.k, r: true }, calc: `unlink ${o.k} from bucket ${b}`, line: 11, vars: { k: o.k, bucket: b, n }, note: `Found ${o.k} and unlinked it; the chain simply closes up. Deleting is this easy only with chaining. Open addressing needs tombstones (next visualizer).` }));
        } else fr.push(snap({ bkt: b, miss: true, res: { op: "del", k: o.k, r: false }, calc: `${o.k} not in bucket ${b}`, line: 11, vars: { k: o.k, bucket: b }, note: `${o.k} is not in bucket ${b}, so there is nothing to remove.` }));
      });
      const L = Math.max(...table.map((c) => c.length));
      fr.push(snap({ line: [], vars: { n, m: M, "α": fmtR(n / M), longest: L }, note: `Done. ${n} keys in ${M} buckets: α = ${fmtR(n / M)}, longest chain ${L}, ${cmps} key comparison(s) in total. Try m = 10 with keys 10, 20, 30, 40: they all land in bucket 0. A modulus that shares factors with patterns in your keys clusters them, which is why tables use primes or scramble the hash bits first.` }));
      return fr;
    },
    render: (f) => col(calc(f.calc ? esc(f.calc) : ""), chainTable(f), stats({ n: f.n, m: f.M, "load α": fmtR(f.n / f.M), "longest chain": f.longest, comparisons: f.cmps })),
  }));

  /* ───────── 2: open addressing (linear / quadratic / double hashing, tombstones) ───────── */
  const DEL = "DEL";
  Viz.register("hashing-probing", (el) => Viz.player(el, {
    title: "Open addressing: keys live in the array itself; a collision probes for another slot",
    tag: "LINEAR · QUADRATIC · DOUBLE HASHING",
    legend: [["active", "slot being probed"], ["visit", "already probed for this key"], ["done", "placed / found"], ["path", "tombstone (DEL)"], ["bad", "miss / gave up"]],
    codeLang: "python",
    code: [
      "def slot(k, i):  # i-th probe for key k",
      "    return (h(k) + step(k, i)) % m",
      "def add(k):",
      "    tb = None",
      "    for i in range(m):",
      "        s = slot(k, i)",
      "        if t[s] is EMPTY: break  # k is absent",
      "        if t[s] is DEL and tb is None: tb = s",
      "        elif t[s] == k: return  # already in",
      "    else:  # m probes and no EMPTY",
      "        if tb is None: raise Full  # grow!",
      "    t[s if tb is None else tb] = k",
      "def find(k):  # skip DEL, stop at EMPTY",
      "    for i in range(m):",
      "        s = slot(k, i)",
      "        if t[s] is EMPTY: return -1",
      "        if t[s] == k: return s",
      "    return -1",
      "def remove(k):",
      "    s = find(k)",
      "    if s >= 0: t[s] = DEL  # tombstone",
    ],
    inputs: [
      { key: "ops", label: "operations: 42 insert · ?42 find · -42 delete", value: "22, 33, 44, 9, 20, 31, -33, ?44, 55, ?31", width: 320 },
      { key: "m", label: "slots m", type: "select", options: ["7", "8", "11", "13"], value: "11" },
      { key: "probe", label: "probe sequence", type: "select", options: ["linear", "quadratic", "double hashing"], value: "linear" },
    ],
    random: () => {
      const m = pick(["7", "8", "11", "13"]);
      return { ops: randOps(Viz.rand(7, Math.min(11, Number(m) + 2)), 0, 80, 0.2, 0.18), m, probe: pick(["linear", "quadratic", "double hashing"]) };
    },
    build: ({ ops, m, probe }) => {
      const list = parseOps(ops, 14), M = Number(m), t = Array(M).fill(null), fr = [];
      if (!["linear", "quadratic", "double hashing"].includes(probe)) throw new Error("Pick a probe sequence.");
      let n = 0, tombs = 0, total = 0;
      const h2 = (k) => 1 + (k % (M - 1));
      const stepOf = (k, i) => (probe === "linear" ? i : probe === "quadratic" ? i * i : i * h2(k));
      const stepTxt = probe === "linear" ? "i" : probe === "quadratic" ? "i²" : "i·h2(k)";
      const snap = (x) => ({ t: t.slice(), n, tombs, total, M, ...x });
      fr.push(snap({ line: [0, 1], vars: { m: M, step: stepTxt }, note: `No lists: one array of ${M} slots. Key k starts at its home slot h(k) = k mod ${M}; if that is taken, it tries home + step(k, i) for i = 1, 2, … where step(k, i) = <b>${stepTxt}</b>${probe === "double hashing" ? ` and h2(k) = 1 + k mod ${M - 1} (never 0, so the probe always moves)` : ""}. Lookups replay the same sequence, so a key is always found along its own probe path.` }));
      for (const o of list) {
        const h = o.k % M, seq = [], hTxt = `h(${o.k}) = ${o.k} mod ${M} = ${h}${probe === "double hashing" ? `, h2 = ${h2(o.k)}` : ""}`;
        const base = { k: o.k };
        fr.push(snap({ home: h, seq: [], calc: `${opWord[o.op]}(${o.k}): ${hTxt}`, line: o.op === "add" ? 2 : o.op === "find" ? 12 : 18, vars: { k: o.k, home: h }, note: `${opWord[o.op]} ${o.k}. ${hTxt}. Probe from slot ${h}.` }));
        let tomb = null, done = false, foundAt = -1;
        for (let i = 0; i < M && !done; i++) {
          const s = (h + stepOf(o.k, i)) % M, v = t[s];
          seq.push(s); total++;
          const sv = { home: h, cur: s, seq: seq.slice(), calc: `probe ${i}: (${h} + ${probe === "linear" ? i : probe === "quadratic" ? `${i}²` : `${i}·${h2(o.k)}`}) mod ${M} = ${s}   path: ${seq.join(" → ")}` };
          const vars = { k: o.k, i, s, "t[s]": v === null ? "EMPTY" : v, probes: seq.length };
          if (o.op === "add") {
            if (v === null) {
              done = true;
              fr.push(snap({ ...sv, line: 6, vars, note: `Slot ${s} is EMPTY. If ${o.k} were in the table, this probe path would have reached it before any empty slot, so ${o.k} is absent and we can stop.` }));
              const at = tomb === null ? s : tomb;
              if (tomb !== null) tombs--;
              t[at] = o.k; n++;
              fr.push(snap({ ...sv, cur: at, placed: at, res: { op: "add", k: o.k, r: "added" }, line: 11, vars: { ...vars, placed: at, n }, note: `Place ${o.k} in slot ${at}${tomb !== null ? ` (the first tombstone we passed, recycled)` : ""}. It took ${seq.length} probe(s). ${seq.length > 2 && probe === "linear" ? "Long runs of occupied slots grow and merge: that is <b>primary clustering</b>, linear probing's weakness." : ""}` }));
            } else if (v === DEL) {
              if (tomb === null) tomb = s;
              fr.push(snap({ ...sv, line: 7, vars: { ...vars, tb: tomb }, note: `Slot ${s} is a tombstone (a deleted key). Remember it as a reusable slot${tomb !== s ? " (we already have an earlier one)" : ""}, but keep probing: ${o.k} might still be further along this path, and inserting a duplicate would corrupt the set.` }));
            } else if (v === o.k) {
              done = true;
              fr.push(snap({ ...sv, placed: s, res: { op: "add", k: o.k, r: "dup" }, line: 8, vars, note: `${o.k} is already in slot ${s}: nothing to insert.` }));
            } else fr.push(snap({ ...sv, line: 5, vars, note: `Slot ${s} holds ${v} ≠ ${o.k}: a collision. Take the next probe.` }));
          } else {
            if (v === null) {
              done = true;
              fr.push(snap({ ...sv, miss: true, line: 15, vars, note: `EMPTY slot: ${o.k} is not in the table. Stopping at EMPTY is what makes lookups fast, and it is exactly why delete may not simply blank a slot.` }));
            } else if (v === DEL) fr.push(snap({ ...sv, line: 14, vars, note: `Tombstone at slot ${s}. <b>Do not stop here</b>: the slot was occupied when later keys were inserted, so their probe paths continue past it.` }));
            else if (v === o.k) { done = true; foundAt = s; fr.push(snap({ ...sv, placed: s, line: 16, vars, note: `Found ${o.k} at slot ${s} after ${seq.length} probe(s).` })); }
            else fr.push(snap({ ...sv, line: 14, vars, note: `Slot ${s} holds ${v} ≠ ${o.k}. Keep probing.` }));
          }
        }
        const distinct = new Set(seq).size;
        if (!done) {
          if (o.op === "add" && tomb !== null) {
            t[tomb] = o.k; tombs--; n++;
            fr.push(snap({ home: h, cur: tomb, placed: tomb, seq, res: { op: "add", k: o.k, r: "added" }, line: 11, vars: { k: o.k, placed: tomb, n }, note: `${M} probes without an EMPTY slot, but we passed a tombstone at ${tomb}: reuse it.` }));
          } else if (o.op === "add") fr.push(snap({ home: h, seq, miss: true, res: { op: "add", k: o.k, r: "full" }, line: 10, vars: { k: o.k, probes: seq.length, "distinct slots": distinct }, note: `Gave up after ${M} probes. ${distinct < M ? `The probe sequence only ever reached <b>${distinct} of ${M}</b> slots (${[...new Set(seq)].join(", ")}), so free slots elsewhere were invisible to it. ${probe === "quadratic" ? "Quadratic probing is only guaranteed to find a slot when m is prime and the table is at most half full." : "With double hashing the step must be coprime with m, which is why m is usually prime."}` : "Every slot is taken."} Real tables resize long before this.` }));
          else if (o.op === "find") fr.push(snap({ home: h, seq, miss: true, line: 17, vars: { k: o.k, probes: seq.length }, note: `${M} probes, no match and no EMPTY slot: ${o.k} is absent. Tables full of tombstones degrade into this slow scan, which is why they rebuild when used + deleted slots get too many.` }));
        }
        if (o.op === "find") fr[fr.length - 1].res = { op: "find", k: o.k, r: foundAt >= 0 };
        if (o.op === "del") {
          if (foundAt >= 0) {
            t[foundAt] = DEL; n--; tombs++;
            fr.push(snap({ home: h, cur: foundAt, seq, res: { op: "del", k: o.k, r: true }, line: 20, vars: { k: o.k, s: foundAt, n, tombstones: tombs }, note: `Mark slot ${foundAt} as DEL instead of EMPTY. If we blanked it, a later lookup for a key that probed <i>past</i> this slot when it was inserted would stop here and wrongly report "absent".` }));
          } else fr.push(snap({ home: h, seq, miss: true, res: { op: "del", k: o.k, r: false }, line: 19, vars: { k: o.k }, note: `${o.k} is not present, so there is nothing to delete.` }));
        }
      }
      fr.push(snap({ line: [], vars: { n, tombstones: tombs, probes: total }, note: `Done: ${n} key(s) and ${tombs} tombstone(s) in ${M} slots, ${total} probes in total. Open addressing is cache friendly (one flat array, no pointers) but needs a lower load factor than chaining. CPython's dict uses it with a perturbed probe sequence and resizes at 2/3 full.` }));
      return fr;
    },
    render: (f) => col(
      calc(f.calc ? esc(f.calc) : ""),
      Viz.array(f.t, {
        label: "slots t[0..m-1]", ptrs: { home: f.home, s: f.cur },
        fmt: (v) => (v === null ? "·" : v),
        cls: (i, v) => (i === f.placed ? "done" : i === f.cur ? (f.miss ? "bad" : "active") : f.seq && f.seq.includes(i) ? (f.miss ? "bad" : "visit") : v === DEL ? "path" : ""),
      }),
      stats({ keys: f.n, tombstones: f.tombs, "used / m": fmtR((f.n + f.tombs) / f.M), "probes (total)": f.total }),
    ),
  }));

  /* ───────── 3: load factor and resize / rehash ───────── */
  const bgrid = (label, tb, hi = {}) => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span><div class="ha-bgrid">${tb.map((b, i) => {
    const c = hi.cell === i ? hi.cellCls : hi.from === i ? "visit" : "";
    return `<div class="ha-bcell ${c}"><span class="ha-bi">${i}</span><span class="ha-bkeys">${b.map((k) => chip(k, k === hi.key ? hi.keyCls || "active" : "")).join("") || '<span class="ha-null">·</span>'}</span></div>`;
  }).join("")}</div></div>`;

  Viz.register("hashing-resize", (el) => Viz.player(el, {
    title: "Load factor and resizing: why a table that sometimes does O(n) work is still O(1) per insert",
    tag: "AMORTIZED O(1)",
    legend: [["active", "key being placed"], ["visit", "bucket it leaves"], ["done", "bucket it lands in"]],
    codeLang: "python",
    code: [
      "def add(k):",
      "    if (n + 1) / m > MAX_LOAD:  # too full?",
      "        resize(grow(m))",
      "    table[k % m].append(k)",
      "    n += 1",
      "def resize(new_m):",
      "    old = table",
      "    table = [[] for _ in range(new_m)]",
      "    for chain in old:  # rehash every key",
      "        for key in chain:",
      "            table[key % new_m].append(key)",
      "    m = new_m",
    ],
    inputs: [
      { key: "keys", label: "distinct keys to insert (0–99)", value: "5, 17, 9, 30, 12, 41, 23, 8, 27, 14, 36, 2, 19", width: 300 },
      { key: "load", label: "max load factor", type: "select", options: ["0.75", "1.0", "0.5"], value: "0.75" },
      { key: "grow", label: "growth", type: "select", options: ["double (m × 2)", "add 4 (m + 4)"], value: "double (m × 2)" },
    ],
    random: () => {
      const s = new Set(); const n = Viz.rand(6, 15);
      while (s.size < n) s.add(Viz.rand(0, 99));
      return { keys: [...s].join(", "), load: pick(["0.75", "1.0", "0.5"]), grow: pick(["double (m × 2)", "add 4 (m + 4)"]) };
    },
    build: ({ keys, load, grow }) => {
      const a = ints(keys, 1, 16, 0, 99);
      if (new Set(a).size !== a.length) throw new Error("Keys must be distinct for this demo.");
      const ML = Number(load), dbl = grow.startsWith("double");
      let m = 4, table = Array.from({ length: m }, () => []), n = 0, work = 0, resizes = 0;
      const fr = [], perInsert = [];
      const snap = (x) => ({ table: table.map((b) => b.slice()), m, n, work, resizes, ML, perInsert: perInsert.slice(), ...x });
      fr.push(snap({ line: [], vars: { m, MAX_LOAD: ML }, note: `Start with m = 4 buckets. The <b>load factor</b> α = n/m is the average chain length. Keep α ≤ ${ML} and chains stay short; let it grow and lookups slide toward O(n). The fix: when the next insert would push α over ${ML}, allocate a bigger table and re-insert everything.` }));
      a.forEach((k) => {
        let cost = 1;
        const over = (n + 1) / m > ML;
        fr.push(snap({ key: k, line: 1, calc: `(${n} + 1) / ${m} = ${fmtR((n + 1) / m)} ${over ? ">" : "≤"} ${ML}`, vars: { k, n, m, "α after": fmtR((n + 1) / m) },
          note: `Insert ${k}. After it, α would be ${n + 1}/${m} = ${fmtR((n + 1) / m)}, ${over ? `over the limit ${ML}: <b>resize first</b>.` : `within the limit ${ML}, so no resize.`}` }));
        if (over) {
          const nm = dbl ? m * 2 : m + 4, old = table;
          table = Array.from({ length: nm }, () => []);
          resizes++;
          fr.push(snap({ old, oldM: m, key: null, line: [6, 7], calc: `new table: ${nm} empty buckets`, vars: { "old m": m, "new m": nm }, note: `Allocate ${nm} empty buckets. Every key must move, because its bucket is key % m and m just changed: the old positions mean nothing in the new table.` }));
          old.forEach((chain, ob) => chain.forEach((key) => {
            const nb = key % nm;
            table[nb].push(key); work++; cost++;
            fr.push(snap({ old, oldM: m, key, from: ob, cell: nb, cellCls: "done", line: [9, 10], calc: `${key}: bucket ${ob} (= ${key} % ${m}) → bucket ${nb} (= ${key} % ${nm})`, vars: { key, "old bucket": ob, "new bucket": nb, moved: work },
              note: `Rehash ${key}: ${key} % ${nm} = ${nb}.${ob !== nb ? "" : " Same index as before, but only by luck: it still had to be recomputed."}` }));
          }));
          const om = m; m = nm;
          fr.push(snap({ line: 11, calc: `m: ${om} → ${m}`, vars: { m, n, "α": fmtR(n / m) }, note: `Resize done: m = ${m}, α = ${fmtR(n / m)}. That cost ${n} moves. ${dbl ? `Doubling means the next resize will not happen until n is about twice as big, so the ${n} moves are "paid back" by the ${n}-ish cheap inserts that follow.` : `Growing by a constant means resizes keep coming every few inserts, and each costs more than the last: total work becomes O(n²). Compare with "double".`}` }));
        }
        table[k % m].push(k); n++; work++;
        perInsert.push(cost);
        fr.push(snap({ key: k, cell: k % m, cellCls: "done", keyCls: "done", res: true, line: [3, 4], calc: `${k} % ${m} = ${k % m}`, vars: { k, bucket: k % m, n, "α": fmtR(n / m), "this insert": cost },
          note: `Append ${k} to bucket ${k % m}. This insert cost ${cost} unit(s) of work; total so far ${work} for ${n} insert(s) = <b>${fmtR(work / n)}</b> per insert on average.` }));
      });
      fr.push(snap({ line: [], vars: { n, m, resizes, "work / n": fmtR(work / n) }, note: `Done: ${n} keys, ${resizes} resize(s), ${work} units of work, <b>${fmtR(work / n)} per insert</b>. ${dbl ? "With doubling the moves sum to at most 1 + 2 + 4 + … < 2n, so the average stays below 3 no matter how many keys you add: amortized O(1)." : "Switch growth to doubling and compare the average: constant-step growth makes the average climb as n grows."}` }));
      return fr;
    },
    render: (f) => {
      const hist = f.perInsert.length ? `<div class="v-labeled"><span class="v-caption">work per insert (resize spikes)</span><div class="ha-spark">${f.perInsert.map((c) => `<span class="ha-sbar ${c > 1 ? "bad" : ""}" style="height:${Math.min(64, 6 + c * 4)}px" title="${c}"><i>${c}</i></span>`).join("")}</div></div>` : "";
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        f.old ? bgrid(`old table (m = ${f.oldM})`, f.old, { from: f.from, key: f.key, keyCls: "visit" }) : "",
        bgrid(f.old ? `new table (m = ${f.table.length})` : `table (m = ${f.m})`, f.table, { cell: f.cell, cellCls: f.cellCls, key: f.key, keyCls: f.keyCls || "active" }),
        hist,
        stats({ n: f.n, m: f.m, "load α": fmtR(f.n / f.m), "max α": f.ML, resizes: f.resizes, "work / n": f.n ? fmtR(f.work / f.n) : "–" }),
      );
    },
  }));

  /* ───────── 4: two sum (complement lookup) ───────── */
  Viz.register("hashing-two-sum", (el) => Viz.player(el, {
    title: "Two Sum: for each x, ask the map whether its partner target − x was already seen",
    tag: "COMPLEMENT LOOKUP · O(n)",
    legend: [["active", "current x"], ["visit", "stored in seen"], ["done", "the pair"]],
    codeLang: "python",
    code: [
      "def two_sum(nums, target):",
      "    seen = {}  # value -> index",
      "    for i, x in enumerate(nums):",
      "        need = target - x",
      "        if need in seen:  # O(1) lookup",
      "            return [seen[need], i]",
      "        seen[x] = i  # store AFTER the lookup",
      "    return []",
    ],
    inputs: [
      { key: "nums", label: "nums", value: "3, 8, 11, 4, 7, 2, 15", width: 230 },
      { key: "target", label: "target", value: "9", width: 70 },
    ],
    random: () => {
      const a = Viz.randInts(Viz.rand(5, 10), -9, 20);
      return { nums: a.join(", "), target: String(Math.random() < 0.8 ? pick(a) + pick(a) : Viz.rand(-5, 30)) };
    },
    build: ({ nums, target }) => {
      const a = ints(nums, 2, 12, -99, 99), T = int(target, -999, 999, "target"), seen = new Map(), fr = [];
      const snap = (x) => ({ a, seen: [...seen.entries()], ...x });
      fr.push(snap({ line: [0, 1], vars: { target: T }, note: `Brute force checks every pair: O(n²). Instead, walk once and keep a map <b>value → index</b> of everything to the left. For each x the only partner that works is <b>target − x</b>, and "is it on my left?" is one O(1) map lookup.` }));
      for (let i = 0; i < a.length; i++) {
        const x = a[i], need = T - x;
        fr.push(snap({ i, need, line: 3, calc: `need = ${T} − ${x} = ${need}`, vars: { i, x, need }, note: `x = ${x}. Its partner must be ${T} − ${x} = <b>${need}</b>.` }));
        if (seen.has(need)) {
          const j = seen.get(need);
          fr.push(snap({ i, need, pair: [j, i], hit: true, res: [j, i], line: [4, 5], calc: `${need} in seen → index ${j};  ${a[j]} + ${x} = ${T}`, vars: { i, x, need, "seen[need]": j }, note: `${need} is in the map at index ${j}. Answer <b>[${j}, ${i}]</b>: ${a[j]} + ${x} = ${T}. One pass, O(n) time, O(n) extra space.` }));
          return fr;
        }
        fr.push(snap({ i, need, miss: true, line: 4, calc: `${need} in seen? no`, vars: { i, x, need }, note: `${need} has not appeared to the left of i = ${i}. ${seen.size ? "" : "(The map is still empty.)"}` }));
        seen.set(x, i);
        fr.push(snap({ i, line: 6, calc: `seen[${x}] = ${i}`, vars: { i, x, size: seen.size }, note: `Record x = ${x} at index ${i} so a later element can pair with it. Storing <i>after</i> the lookup stops x pairing with itself (try target = 2·x with x appearing once).` }));
      }
      fr.push(snap({ line: 7, res: [], vars: { size: seen.size }, note: `No pair sums to ${T}. Every element was looked up exactly once.` }));
      return fr;
    },
    render: (f) => {
      const inSeen = new Set(f.seen.map(([, j]) => j));
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        Viz.array(f.a, { label: "nums", ptrs: { i: f.i }, cls: (j) => (f.pair && f.pair.includes(j) ? "done" : j === f.i ? "active" : inSeen.has(j) ? "visit" : f.i !== undefined && j > f.i ? "dim" : "") }),
        mapView("seen: value → index", f.seen, (k) => (k === f.need ? (f.hit ? "done" : "bad") : ""), "empty"),
      );
    },
  }));

  /* ───────── 5: top-k frequent (Counter + bucket by frequency) ───────── */
  Viz.register("hashing-topk", (el) => Viz.player(el, {
    title: "Top K Frequent: count with a map, then bucket by count so no sort is needed",
    tag: "FREQUENCY MAP · BUCKETS · O(n)",
    legend: [["active", "current element"], ["visit", "bucket being scanned"], ["done", "chosen"]],
    codeLang: "python",
    code: [
      "def top_k(nums, k):",
      "    cnt = Counter(nums)  # x -> count",
      "    bucket = [[] for _ in range(len(nums)+1)]",
      "    for x, c in cnt.items():",
      "        bucket[c].append(x)  # index = count",
      "    out = []",
      "    for c in range(len(nums), 0, -1):",
      "        for x in bucket[c]:",
      "            out.append(x)",
      "            if len(out) == k: return out",
      "    return out",
    ],
    inputs: [
      { key: "nums", label: "nums", value: "4, 1, 4, 2, 1, 4, 3, 2, 4, 5, 1", width: 250 },
      { key: "k", label: "k", value: "2", width: 50 },
    ],
    random: () => {
      const a = Viz.randInts(Viz.rand(6, 14), 1, 6);
      return { nums: a.join(", "), k: String(Viz.rand(1, Math.min(3, new Set(a).size))) };
    },
    build: ({ nums, k }) => {
      const a = ints(nums, 1, 14, -99, 99), K = int(k, 1, new Set(a).size, "k (at most the number of distinct values)");
      const cnt = new Map(), fr = [], n = a.length;
      let buckets = null, out = [];
      const snap = (x) => ({ a, cnt: [...cnt.entries()], buckets: buckets && buckets.map((b) => b.slice()), out: out.slice(), ...x });
      fr.push(snap({ line: 0, vars: { n, k: K }, note: `Sorting the distinct values by count would cost O(d log d). The trick: a count is an integer between 1 and n, so use it as an <b>array index</b> (bucket sort on frequency).` }));
      a.forEach((x, i) => {
        cnt.set(x, (cnt.get(x) || 0) + 1);
        fr.push(snap({ i, hk: x, line: 1, calc: `cnt[${x}] = ${cnt.get(x)}`, vars: { i, x, "cnt[x]": cnt.get(x) }, note: `Count ${x}: now ${cnt.get(x)}. This is what Counter(nums) does in one line: a single pass with an O(1) map update per element.` }));
      });
      const maxC = Math.max(...cnt.values());
      buckets = Array.from({ length: maxC + 1 }, () => []);
      fr.push(snap({ line: 2, vars: { distinct: cnt.size, "max count": maxC }, note: `Make buckets indexed by count. (The real code allocates n + 1 = ${n + 1}; only counts 1..${maxC} can be non-empty, so only those are drawn.)` }));
      for (const [x, c] of cnt) {
        buckets[c].push(x);
        fr.push(snap({ hk: x, bc: c, line: [3, 4], calc: `bucket[${c}].append(${x})`, vars: { x, c }, note: `${x} appears ${c} time(s), so it goes in bucket ${c}.` }));
      }
      for (let c = maxC; c >= 1; c--) {
        if (!buckets[c].length) { fr.push(snap({ bc: c, line: 6, vars: { c }, note: `Bucket ${c} is empty: no value appears exactly ${c} times.` })); continue; }
        for (const x of buckets[c]) {
          out.push(x);
          const done = out.length === K;
          fr.push(snap({ bc: c, hk: x, line: done ? [8, 9] : 8, res: done ? out.slice() : undefined, calc: `out = [${out.join(", ")}]`, vars: { c, x, "len(out)": out.length, k: K }, note: `Take ${x} (count ${c}).${done ? ` That is k = ${K} values: return [${out.join(", ")}]. Total O(n): one counting pass, one bucket pass, one scan.` : ""}` }));
          if (done) return fr;
        }
      }
      return fr;
    },
    render: (f) => {
      const chosen = new Set(f.out);
      const bk = f.buckets ? `<div class="v-labeled"><span class="v-caption">bucket[count] (highest count first)</span><div class="ha-table">${f.buckets.map((b, c) => c).slice(1).reverse().map((c) => `<div class="ha-bkt ${c === f.bc ? "visit" : ""}"><span class="ha-bi">${c}×</span><span class="ha-chain">${f.buckets[c].map((x) => chip(x, chosen.has(x) ? "done" : x === f.hk ? "active" : "")).join("") || '<span class="ha-null">∅</span>'}</span></div>`).join("")}</div></div>` : "";
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        Viz.array(f.a, { label: "nums", ptrs: { i: f.i }, cls: (j, v) => (chosen.has(v) ? "done" : j === f.i ? "active" : v === f.hk ? "visit" : "") }),
        mapView("cnt: value → count", f.cnt, (k) => (chosen.has(k) ? "done" : k === f.hk ? "active" : "")),
        bk,
        f.out.length ? `<div class="v-labeled"><span class="v-caption">out</span><div class="ha-map">${f.out.map((x) => chip(x, "done")).join("")}</div></div>` : "",
      );
    },
  }));

  /* ───────── 6: group anagrams (canonical key) ───────── */
  const countKey = (w) => {
    const c = Array(26).fill(0);
    for (const ch of w) c[ch.charCodeAt(0) - 97]++;
    return c.map((v, i) => (v ? String.fromCharCode(97 + i) + v : "")).join("");
  };
  Viz.register("hashing-group", (el) => Viz.player(el, {
    title: "Group Anagrams: map every word to a canonical key; equal keys means same group",
    tag: "CANONICAL KEY · GROUPING",
    legend: [["active", "current word"], ["done", "group it joins"], ["visit", "new group created"]],
    codeLang: "python",
    code: [
      "def group_anagrams(words):",
      "    groups = defaultdict(list)",
      "    for w in words:",
      "        if by_sort: key = ''.join(sorted(w))",
      "        else: key = count_key(w)  # 26 counts",
      "        groups[key].append(w)",
      "    return list(groups.values())",
    ],
    inputs: [
      { key: "words", label: "words (lowercase)", value: "eat, tea, tan, ate, nat, bat", width: 280 },
      { key: "mode", label: "canonical key", type: "select", options: ["sorted letters", "letter counts"], value: "sorted letters" },
    ],
    random: () => {
      const bases = ["eat", "tan", "bat", "listen", "stop", "abc", "dusty", "night"];
      const shuf = (w) => w.split("").sort(() => Math.random() - 0.5).join("");
      const ws = Array.from({ length: Viz.rand(5, 10) }, () => shuf(pick(bases.slice(0, Viz.rand(2, 5)))));
      return { words: ws.join(", "), mode: pick(["sorted letters", "letter counts"]) };
    },
    build: ({ words, mode }) => {
      const ws = String(words).split(/[\s,]+/).filter(Boolean);
      if (!ws.length || ws.length > 12 || ws.some((w) => !/^[a-z]{1,10}$/.test(w))) throw new Error("Use 1–12 words of 1–10 lowercase letters.");
      const bySort = mode === "sorted letters", groups = new Map(), fr = [];
      const snap = (x) => ({ ws, groups: [...groups.entries()].map(([k, v]) => [k, v.slice()]), ...x });
      fr.push(snap({ line: [0, 1], vars: { words: ws.length }, note: `Anagrams are the same multiset of letters in a different order. Pick a <b>canonical key</b> that is identical for all anagrams and different otherwise; then a dict from key → list does the grouping in one pass. Key used here: <b>${bySort ? "the letters sorted" : "the 26 letter counts"}</b>.` }));
      ws.forEach((w, i) => {
        const key = bySort ? w.split("").sort().join("") : countKey(w);
        const how = bySort ? `sorted("${w}") → "${key}"` : `counts("${w}") → ${key}`;
        fr.push(snap({ i, key, line: bySort ? 3 : 4, calc: how, vars: { w, key }, note: `"${w}" → key <b>${key}</b>. ${bySort ? `Sorting costs O(L log L) for a word of length L.` : `Counting costs O(L) and the key is a fixed 26-slot tuple (shown compactly: only non-zero letters).`}` }));
        const isNew = !groups.has(key);
        if (isNew) groups.set(key, []);
        groups.get(key).push(w);
        fr.push(snap({ i, key, isNew, line: 5, calc: `groups["${key}"] = [${groups.get(key).join(", ")}]`, vars: { w, key, groups: groups.size }, note: isNew ? `No group has key ${key} yet, so defaultdict creates an empty list and "${w}" starts a new group.` : `Key ${key} already exists: "${w}" joins ${groups.get(key).slice(0, -1).map((x) => `"${x}"`).join(", ")}.` }));
      });
      fr.push(snap({ line: 6, res: [...groups.values()], vars: { groups: groups.size }, note: `${groups.size} group(s). Total cost O(n · L log L) with sorted keys, O(n · L) with count keys. The same idea solves "group shifted strings", "isomorphic strings", "find duplicate files": design the right canonical key.` }));
      return fr;
    },
    render: (f) => col(
      calc(f.calc ? esc(f.calc) : ""),
      Viz.array(f.ws, { label: "words", ptrs: { w: f.i }, cls: (j) => (j === f.i ? "active" : f.i !== undefined && j < f.i ? "visit" : "") }),
      `<div class="v-labeled"><span class="v-caption">groups: key → words</span><div class="ha-groups">${f.groups.length ? f.groups.map(([k, v]) => `<div class="ha-group ${k === f.key ? (f.isNew ? "visit" : "done") : ""}"><b>${esc(k)}</b><span>${v.map((w, j) => chip(w, k === f.key && j === v.length - 1 && f.isNew !== undefined ? "active" : "")).join("")}</span></div>`).join("") : '<span class="ha-empty">empty</span>'}</div></div>`,
    ),
  }));

  /* ───────── 7 + 8: prefix sum + hash map ───────── */
  const prefixViz = (name, longest) => Viz.register(name, (el) => Viz.player(el, {
    title: longest
      ? "Longest subarray with sum k: remember the FIRST index of each prefix sum"
      : "Subarray Sum Equals K: count earlier prefixes equal to P − k",
    tag: longest ? "PREFIX SUM + FIRST-INDEX MAP" : "PREFIX SUM + COUNT MAP",
    legend: [["active", "current prefix P[i+1]"], ["done", "matching earlier prefix / subarray"], ["visit", "subarray just found"]],
    codeLang: "python",
    code: longest ? [
      "def longest_k(nums, k):",
      "    first = {0: -1}  # prefix -> first index",
      "    p = best = 0",
      "    for i, x in enumerate(nums):",
      "        p += x",
      "        if p - k in first:  # sum(j+1..i) = k",
      "            best = max(best, i - first[p - k])",
      "        if p not in first: first[p] = i",
      "    return best",
    ] : [
      "def count_k(nums, k):",
      "    seen = {0: 1}  # prefix -> times seen",
      "    p = ans = 0",
      "    for x in nums:",
      "        p += x",
      "        ans += seen.get(p - k, 0)",
      "        seen[p] = seen.get(p, 0) + 1",
      "    return ans",
    ],
    inputs: [
      { key: "nums", label: "nums (negatives allowed)", value: longest ? "1, -1, 5, -2, 3" : "1, 2, -1, 3, -2, 2, 1", width: 240 },
      { key: "k", label: "k", value: "3", width: 60 },
    ],
    random: () => ({ nums: Viz.randInts(Viz.rand(5, 10), -3, 5).join(", "), k: String(Viz.rand(-2, 6)) }),
    build: ({ nums, k }) => {
      const a = ints(nums, 1, 12, -99, 99), K = int(k, -999, 999, "k"), n = a.length, fr = [];
      const P = [0], mp = new Map([[0, longest ? -1 : 1]]);
      let p = 0, ans = 0, best = 0, bestW = null;
      const snap = (x) => ({ a, P: P.concat(Array(n + 1 - P.length).fill(null)), mp: [...mp.entries()], ans, best, longest, ...x });
      fr.push(snap({ line: [1, 2], vars: { k: K }, note: `P[i] = sum of the first i numbers, so sum(nums[j..i]) = P[i+1] − P[j]. A subarray ending at i sums to k exactly when some <b>earlier prefix equals P − k</b>. The map answers "how many / which earlier prefixes equal P − k?" in O(1). It starts with prefix 0 (the empty prefix) so subarrays that start at index 0 are counted. ${longest ? "Here we store the <b>first</b> index each prefix occurs at, giving the longest subarray." : "Here we store <b>how many times</b> each prefix occurred."} Negative numbers are fine: no sliding window needed.` }));
      for (let i = 0; i < n; i++) {
        p += a[i]; P.push(p);
        const need = p - K;
        fr.push(snap({ i, cur: i + 1, line: 4, calc: `P[${i + 1}] = P[${i}] + ${a[i]} = ${p}`, vars: { i, x: a[i], p }, note: `Add ${a[i]}: running prefix p = ${p}.` }));
        const matches = [];
        for (let j = 0; j <= i; j++) if (P[j] === need) matches.push(j);
        if (longest) {
          if (mp.has(need)) {
            const j0 = mp.get(need) + 1, len = i - mp.get(need);
            const better = len > best;
            if (better) { best = len; bestW = [j0, i]; }
            fr.push(snap({ i, cur: i + 1, need, hitP: [j0], win: [j0, i], line: [5, 6], calc: `p − k = ${need} first seen at index ${mp.get(need)} → nums[${j0}..${i}], length ${len}`, vars: { i, p, "p-k": need, len, best }, note: `${need} is in the map: the earliest prefix with that value ends at index ${mp.get(need)}, so nums[${j0}..${i}] sums to ${K} with length ${len}. ${better ? "New best." : `Not longer than the best (${best}).`} Using the <i>first</i> occurrence makes this the longest such subarray ending at i.` }));
          } else fr.push(snap({ i, cur: i + 1, need, miss: true, line: 5, calc: `p − k = ${need} not in map`, vars: { i, p, "p-k": need, best }, note: `No earlier prefix equals ${need}, so no subarray ending at ${i} sums to ${K}.` }));
          if (!mp.has(p)) { mp.set(p, i); fr.push(snap({ i, cur: i + 1, hk: p, line: 7, calc: `first[${p}] = ${i}`, vars: { i, p }, note: `First time prefix ${p} appears: record index ${i}.` })); }
          else fr.push(snap({ i, cur: i + 1, hk: p, line: 7, calc: `${p} already in first (index ${mp.get(p)}): keep it`, vars: { i, p }, note: `Prefix ${p} was already seen at index ${mp.get(p)}. Keep the older index: an earlier start gives a longer subarray later.` }));
        } else {
          const c = mp.get(need) || 0;
          ans += c;
          fr.push(snap({ i, cur: i + 1, need, hitP: matches, win: matches.length ? [matches[matches.length - 1], i] : null, miss: !c, line: 5, calc: `seen[${p} − ${K}] = seen[${need}] = ${c}  →  ans = ${ans}`, vars: { i, p, "p-k": need, found: c, ans },
            note: c ? `Prefix ${need} occurred ${c} time(s) before, so ${c} subarray(s) ending at index ${i} sum to ${K}: ${matches.map((j) => `nums[${j}..${i}]`).join(", ")}. The map gives the count without listing them.` : `No earlier prefix equals ${need}: no subarray ending at ${i} sums to ${K}.` }));
          mp.set(p, (mp.get(p) || 0) + 1);
          fr.push(snap({ i, cur: i + 1, hk: p, line: 6, calc: `seen[${p}] = ${mp.get(p)}`, vars: { i, p, "seen[p]": mp.get(p) }, note: `Record prefix ${p} (now seen ${mp.get(p)} time(s)) for subarrays that end later. Update <i>after</i> the lookup so the empty subarray is never counted when k = 0.` }));
        }
      }
      fr.push(snap({ line: longest ? 8 : 7, res: longest ? best : ans, win: longest ? bestW : null, vars: longest ? { best } : { ans }, note: longest ? `Longest subarray with sum ${K}: <b>${best}</b>${bestW ? ` (nums[${bestW[0]}..${bestW[1]}])` : ""}. O(n) time, O(n) space.` : `<b>${ans}</b> subarray(s) sum to ${K}. O(n) time instead of O(n²) for all pairs (i, j).` }));
      return fr;
    },
    render: (f) => {
      const hit = new Set(f.hitP || []);
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        Viz.array(f.a, { label: "nums", ptrs: { i: f.i }, window: f.win || undefined, cls: (j) => (f.win && j >= f.win[0] && j <= f.win[1] ? "window" : j === f.i ? "active" : "") }),
        Viz.array(f.P, { label: "prefix P (P[j] = sum of nums[0..j-1])", idxLabel: (j) => `P${j}`, fmt: (v) => (v === null ? "·" : v), cls: (j, v) => (hit.has(j) ? "done" : j === f.cur ? "active" : v === null ? "dim" : "") }),
        mapView(f.longest ? "first: prefix → first index" : "seen: prefix → count", f.mp, (k) => (k === f.need ? (f.miss ? "bad" : "done") : k === f.hk ? "active" : "")),
        stats(f.longest ? { "best length": f.best } : { "subarrays found": f.ans }),
      );
    },
  }));
  prefixViz("hashing-prefix", false);
  prefixViz("hashing-prefix-longest", true);

  /* ───────── 9: longest consecutive sequence ───────── */
  Viz.register("hashing-consecutive", (el) => Viz.player(el, {
    title: "Longest Consecutive Sequence: only start counting at x when x − 1 is missing",
    tag: "HASH SET · O(n)",
    legend: [["active", "x being tested"], ["visit", "walked as part of the run"], ["done", "best run"], ["dim", "skipped (not a start)"]],
    codeLang: "python",
    code: [
      "def longest_consecutive(nums):",
      "    s = set(nums)",
      "    best = 0",
      "    for x in s:",
      "        if x - 1 in s: continue  # not a start",
      "        y = x",
      "        while y + 1 in s: y += 1  # walk run",
      "        best = max(best, y - x + 1)",
      "    return best",
    ],
    inputs: [{ key: "nums", label: "nums", value: "100, 4, 200, 1, 3, 2, 101, 7, 102, 8", width: 300 }],
    random: () => ({ nums: Viz.randInts(Viz.rand(6, 13), 0, 25).join(", ") }),
    build: ({ nums }) => {
      const a = ints(nums, 1, 16, -999, 999), fr = [];
      const order = [...new Set(a)], s = new Set(order), sorted = order.slice().sort((x, y) => x - y);
      const runs = [];
      sorted.forEach((v) => { if (runs.length && runs[runs.length - 1].at(-1) === v - 1) runs[runs.length - 1].push(v); else runs.push([v]); });
      let best = 0, bestRun = null, lookups = 0;
      const skipped = new Set();
      const snap = (x) => ({ a, runs, best, bestRun, lookups, skipped: new Set(skipped), ...x });
      fr.push(snap({ line: [1, 2], vars: { n: a.length, distinct: s.size }, note: `Put everything in a set (duplicates vanish; below, the set's values are laid out sorted only so you can <i>see</i> the runs; the algorithm never sorts). Sorting would be O(n log n). The O(n) idea: a run is only counted from its <b>smallest</b> element, the one whose x − 1 is missing.` }));
      for (const x of order) {
        lookups++;
        if (s.has(x - 1)) {
          skipped.add(x);
          fr.push(snap({ x, line: 4, calc: `${x - 1} in s? yes → skip ${x}`, vars: { x, best }, note: `${x - 1} is in the set, so ${x} is in the middle of a run. Whoever starts that run will count it; skip.` }));
          continue;
        }
        fr.push(snap({ x, walk: [x], line: 4, calc: `${x - 1} in s? no → ${x} starts a run`, vars: { x, best }, note: `${x - 1} is missing: ${x} is the start of a run. Walk upward.` }));
        let y = x;
        const walk = [x];
        while (true) {
          lookups++;
          if (!s.has(y + 1)) break;
          y++; walk.push(y);
          fr.push(snap({ x, walk: walk.slice(), line: 6, calc: `${y} in s? yes`, vars: { x, y, len: y - x + 1 }, note: `${y} is present; the run grows to length ${y - x + 1}.` }));
        }
        const len = y - x + 1, better = len > best;
        if (better) { best = len; bestRun = [x, y]; }
        fr.push(snap({ x, walk, line: 7, calc: `${y + 1} in s? no → run ${x}..${y}, length ${len}`, vars: { x, y, len, best }, note: `${y + 1} is missing, so the run is ${x}..${y} (length ${len}). ${better ? "New best." : `Best stays ${best}.`}` }));
      }
      fr.push(snap({ line: 8, res: best, vars: { best, lookups }, note: `Answer <b>${best}</b>. Each element is walked at most once (only from its run's start) and tested once as a start: ${lookups} set lookups for ${a.length} numbers, so O(n) total, even though there is a loop inside a loop.` }));
      return fr;
    },
    render: (f) => {
      const walk = new Set(f.walk || []);
      const inBest = (v) => f.bestRun && v >= f.bestRun[0] && v <= f.bestRun[1];
      const c = (v) => (v === f.x ? "active" : walk.has(v) ? "visit" : inBest(v) ? "done" : f.skipped.has(v) ? "dim" : "");
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        Viz.array(f.a, { label: "nums (iteration order)", cls: (j, v) => c(v) }),
        `<div class="v-labeled"><span class="v-caption">the set, drawn on a number line (gaps = missing values)</span><div class="ha-runs">${f.runs.map((r) => `<span class="ha-run">${r.map((v) => chip(v, c(v))).join("")}</span>`).join('<span class="ha-gap">⋯</span>')}</div></div>`,
        stats({ best: f.best, "set lookups": f.lookups }),
      );
    },
  }));

  /* ───────── 10: rolling hash / Rabin–Karp ───────── */
  Viz.register("hashing-rolling", (el) => Viz.player(el, {
    title: "Rolling hash (Rabin–Karp): update a window's hash in O(1) as it slides",
    tag: "POLYNOMIAL HASH · SPURIOUS HITS",
    legend: [["visit", "current window"], ["done", "verified match"], ["bad", "hash equal, text different"], ["active", "char entering / leaving"]],
    codeLang: "python",
    code: [
      "def rabin_karp(text, pat):",
      "    n, L = len(text), len(pat)",
      "    hp, hw = h(pat), h(text[:L])",
      "    BL = pow(B, L - 1, M)  # weight of 1st char",
      "    for i in range(n - L + 1):",
      "        if hw == hp and text[i:i+L] == pat:",
      "            yield i  # verified match",
      "        if i + L < n:  # roll the window",
      "            hw = (hw - v(text[i]) * BL) % M",
      "            hw = (hw * B + v(text[i+L])) % M",
    ],
    inputs: [
      { key: "text", label: "text (a–z)", value: "abracadabra", width: 220 },
      { key: "pat", label: "pattern", value: "abra", width: 100 },
      { key: "mod", label: "modulus M", type: "select", options: ["101", "1000000007"], value: "101" },
    ],
    random: () => {
      const al = pick(["ab", "abc", "abcd"]);
      const s = Array.from({ length: Viz.rand(8, 18) }, () => pick(al.split(""))).join("");
      const L = Viz.rand(2, 4), st = Viz.rand(0, s.length - L);
      return { text: s, pat: Math.random() < 0.7 ? s.slice(st, st + L) : Array.from({ length: L }, () => pick(al.split(""))).join(""), mod: pick(["101", "101", "1000000007"]) };
    },
    build: ({ text, pat, mod }) => {
      const T = String(text).trim(), Pt = String(pat).trim();
      if (!/^[a-z]{1,24}$/.test(T)) throw new Error("text: 1–24 lowercase letters.");
      if (!/^[a-z]{1,8}$/.test(Pt) || Pt.length > T.length) throw new Error("pattern: 1–8 lowercase letters, not longer than the text.");
      const M = BigInt(mod), B = 31n, n = T.length, L = Pt.length, fr = [];
      const v = (ch) => BigInt(ch.charCodeAt(0) - 96);
      const md = (x) => ((x % M) + M) % M;
      const h = (s) => { let r = 0n; for (const ch of s) r = md(r * B + v(ch)); return r; };
      let BL = 1n; for (let i = 0; i < L - 1; i++) BL = md(BL * B);
      const hp = h(Pt);
      let hw = h(T.slice(0, L));
      const matches = [], spur = [];
      const snap = (x) => ({ T: T.split(""), Pt, hp: String(hp), hw: String(hw), matches: matches.slice(), spur: spur.slice(), L, ...x });
      const poly = (s) => s.split("").map((ch, j) => `${ch.charCodeAt(0) - 96}·31^${s.length - 1 - j}`).join(" + ");
      fr.push(snap({ line: [1, 2, 3], calc: `h("${Pt}") = (${poly(Pt)}) mod ${mod} = ${hp}`, vars: { B: 31, M: mod, hp: String(hp), BL: String(BL) }, note: `Treat a string as a number in base B = 31 with a = 1 … z = 26, reduced mod M. Comparing two numbers is O(1), but recomputing a window's hash from scratch is O(L). The rolling trick: remove the leaving char's contribution (its value × B^(L−1)), shift everything one place (× B), add the entering char. O(1) per step.` }));
      for (let i = 0; i + L <= n; i++) {
        const w = [i, i + L - 1];
        if (hw === hp) {
          const real = T.slice(i, i + L) === Pt;
          (real ? matches : spur).push(i);
          fr.push(snap({ w, cmp: real ? "done" : "bad", line: real ? [5, 6] : 5, calc: `hw = ${hw} == hp = ${hp} → compare "${T.slice(i, i + L)}" with "${Pt}": ${real ? "equal" : "DIFFERENT"}`, vars: { i, hw: String(hw), hp: String(hp) },
            note: real ? `Hashes equal and the characters match: a real occurrence at index ${i}.` : `<b>Spurious hit</b>: "${T.slice(i, i + L)}" ≠ "${Pt}" but both hash to ${hw} mod ${mod}. Different strings can share a hash (only ${mod} possible values here), so a match must always be verified, or M must be huge (and better, two moduli).` }));
        } else fr.push(snap({ w, line: 5, calc: `hw = ${hw} ≠ hp = ${hp}`, vars: { i, hw: String(hw), hp: String(hp) }, note: `Window "${T.slice(i, i + L)}" hashes to ${hw} ≠ ${hp}: definitely not a match, no character comparison needed.` }));
        if (i + L < n) {
          const out = T[i], inn = T[i + L], old = hw;
          const mid = md(hw - v(out) * BL);
          hw = md(mid * B + v(inn));
          fr.push(snap({ w: [i + 1, i + L], out: i, inn: i + L, line: [8, 9], calc: `(${old} − ${v(out)}·${BL}) mod ${mod} = ${mid};  (${mid}·31 + ${v(inn)}) mod ${mod} = ${hw}`, vars: { i: i + 1, "leaving": out, "entering": inn, hw: String(hw) }, note: `Slide: drop '${out}' (value ${v(out)}, weight B^${L - 1}), shift by B, add '${inn}' (value ${v(inn)}). New hash ${hw} in O(1).` }));
        }
      }
      fr.push(snap({ line: [], res: matches.slice(), vars: { matches: matches.length, spurious: spur.length }, note: `Matches at [${matches.join(", ")}]${spur.length ? `; ${spur.length} spurious hit(s) at [${spur.join(", ")}] were caught by verifying` : ""}. Expected O(n + L) time. ${mod === "101" ? "Switch M to 1 000 000 007 and the spurious hits almost surely disappear." : ""}` }));
      return fr;
    },
    render: (f) => {
      const m = new Set(), s = new Set();
      f.matches.forEach((i) => { for (let j = i; j < i + f.L; j++) m.add(j); });
      f.spur.forEach((i) => { for (let j = i; j < i + f.L; j++) s.add(j); });
      return col(
        calc(f.calc ? esc(f.calc) : ""),
        Viz.array(f.T, { label: "text", window: f.w, ptrs: f.out !== undefined ? { out: f.out, in: f.inn } : {}, cls: (j) => (j === f.out || j === f.inn ? "active" : f.w && j >= f.w[0] && j <= f.w[1] && f.cmp ? f.cmp : m.has(j) ? "done" : s.has(j) ? "bad" : f.w && j >= f.w[0] && j <= f.w[1] ? "window" : "") }),
        Viz.array(f.Pt.split(""), { label: "pattern" }),
        stats({ "hash(pattern)": f.hp, "hash(window)": f.hw, matches: f.matches.length, spurious: f.spur.length }),
      );
    },
  }));

  /* ───────── 11: coordinate compression ───────── */
  Viz.register("hashing-compress", (el) => Viz.player(el, {
    title: "Coordinate compression: replace huge values by their rank 0..d−1, keeping order",
    tag: "SORTED SET + RANK MAP",
    legend: [["active", "current value"], ["done", "rank assigned"], ["visit", "looked up"]],
    codeLang: "python",
    code: [
      "def compress(a):",
      "    vals = sorted(set(a))  # distinct, ordered",
      "    rank = {v: i for i, v in enumerate(vals)}",
      "    return [rank[x] for x in a]",
    ],
    inputs: [{ key: "nums", label: "values (any size)", value: "900, -40, 70000, 900, 5, -40, 3000000", width: 300 }],
    random: () => ({ nums: Array.from({ length: Viz.rand(5, 9) }, () => pick([Viz.rand(-50, 50), Viz.rand(100, 999) * 100, Viz.rand(1, 9) * 1000000])).join(", ") }),
    build: ({ nums }) => {
      const a = ints(nums, 1, 10, -1e9, 1e9), fr = [];
      const vals = [...new Set(a)].sort((x, y) => x - y), rank = new Map(), out = [];
      const snap = (x) => ({ a, vals: x.showVals ? vals : null, rank: [...rank.entries()], out: out.slice(), ...x });
      fr.push(snap({ line: 0, vars: { n: a.length }, note: `Values up to ${Math.max(...a.map(Math.abs))} cannot index an array (a Fenwick tree, a counting array, a grid). But many algorithms only care about <b>relative order</b>. Map each value to its rank among the distinct values: order is preserved, and the range shrinks to 0..d−1.` }));
      fr.push(snap({ showVals: true, line: 1, calc: `set → ${vals.length} distinct; sorted: [${vals.join(", ")}]`, vars: { distinct: vals.length }, note: `Deduplicate with a set (equal values must get equal ranks), then sort: O(n log n).` }));
      vals.forEach((v, i) => {
        rank.set(v, i);
        fr.push(snap({ showVals: true, vi: i, hk: v, line: 2, calc: `rank[${v}] = ${i}`, vars: { v, rank: i }, note: `${v} is the ${i === 0 ? "smallest" : `#${i + 1} smallest`} distinct value → rank ${i}.` }));
      });
      a.forEach((x, i) => {
        out.push(rank.get(x));
        fr.push(snap({ showVals: true, i, hk: x, line: 3, calc: `a[${i}] = ${x} → rank[${x}] = ${rank.get(x)}`, vars: { i, x, rank: rank.get(x) }, note: `Replace ${x} by its rank ${rank.get(x)} with one O(1) dict lookup.${out.length === a.length ? ` Done: [${out.join(", ")}]. Every comparison a < b gives the same answer on the ranks, so order-based algorithms (inversions, range counting, sweeps) run unchanged on small indices.` : ""}`, res: out.length === a.length ? out.slice() : undefined }));
      });
      return fr;
    },
    render: (f) => col(
      calc(f.calc ? esc(f.calc) : ""),
      Viz.array(f.a, { label: "a", ptrs: { i: f.i }, cls: (j, v) => (j === f.i ? "active" : v === f.hk ? "visit" : "") }),
      f.vals ? Viz.array(f.vals, { label: "vals = sorted(set(a))  (index = rank)", cls: (j, v) => (j === f.vi || v === f.hk ? "active" : j < f.rank.length ? "done" : "") }) : "",
      mapView("rank: value → rank", f.rank, (k) => (k === f.hk ? "active" : "")),
      f.out.length ? Viz.array(f.out, { label: "compressed", cls: (j) => (j === f.i ? "done" : "") }) : "",
    ),
  }));

  /* ───────── 12: Insert Delete GetRandom O(1) ───────── */
  Viz.register("hashing-randomset", (el) => Viz.player(el, {
    title: "Insert / Delete / GetRandom in O(1): an array for random access + a map value → index",
    tag: "ARRAY + HASH MAP",
    legend: [["active", "slot being written"], ["visit", "last element moved into the hole"], ["done", "random pick / found"], ["bad", "removed or absent"]],
    codeLang: "python",
    code: [
      "class RandomizedSet:",
      "    def __init__(self):",
      "        self.vals, self.pos = [], {}",
      "    def insert(self, x):",
      "        if x in self.pos: return False",
      "        self.pos[x] = len(self.vals)",
      "        self.vals.append(x)",
      "        return True",
      "    def remove(self, x):",
      "        if x not in self.pos: return False",
      "        i, last = self.pos[x], self.vals[-1]",
      "        self.vals[i] = last  # fill the hole",
      "        self.pos[last] = i",
      "        self.vals.pop(); del self.pos[x]",
      "        return True",
      "    def get_random(self):",
      "        return random.choice(self.vals)",
    ],
    inputs: [{ key: "ops", label: "ops: 5 insert · -5 remove · ?5 contains · r random", value: "5, 9, 2, 7, -9, r, 9, -5, -4, r", width: 330 }],
    random: () => ({ ops: randOps(Viz.rand(8, 12), 0, 30, 0.1, 0.25, 0.15) }),
    build: ({ ops }) => {
      const list = parseOps(ops, 16, true), vals = [], pos = new Map(), fr = [];
      const snap = (x) => ({ vals: vals.slice(), pos: [...pos.entries()], ...x });
      fr.push(snap({ line: [0, 1, 2], vars: { size: 0 }, note: `A hash set alone cannot pick a uniformly random element in O(1) (it has empty buckets and no index). An array alone cannot delete in O(1). Combine them: <b>vals</b> holds the elements densely; <b>pos</b> maps each value to its index in vals.` }));
      for (const o of list) {
        if (o.op === "rand") {
          if (!vals.length) { fr.push(snap({ line: 16, res: { op: "rand", r: null }, vars: { size: 0 }, note: `get_random on an empty set: random.choice would raise. (LeetCode guarantees it is never called empty.)` })); continue; }
          const idx = Math.floor(Math.random() * vals.length);
          fr.push(snap({ pick: idx, hk: vals[idx], res: { op: "rand", r: vals[idx] }, line: [15, 16], calc: `random index ${idx} of 0..${vals.length - 1} → ${vals[idx]}`, vars: { size: vals.length, pick: vals[idx] }, note: `Pick a random index in 0..${vals.length - 1}; each element has probability 1/${vals.length}. Possible only because vals has no holes.` }));
        } else if (o.op === "add") {
          if (pos.has(o.k)) { fr.push(snap({ hk: o.k, hit: pos.get(o.k), res: { op: "add", k: o.k, r: false }, line: 4, calc: `${o.k} in pos → False`, vars: { x: o.k }, note: `${o.k} is already present (pos[${o.k}] = ${pos.get(o.k)}). Return False.` })); continue; }
          pos.set(o.k, vals.length); vals.push(o.k);
          fr.push(snap({ w: vals.length - 1, hk: o.k, res: { op: "add", k: o.k, r: true }, line: [5, 6, 7], calc: `pos[${o.k}] = ${vals.length - 1}; vals.append(${o.k})`, vars: { x: o.k, size: vals.length }, note: `Append ${o.k} at the end (amortized O(1)) and record its index ${vals.length - 1}.` }));
        } else if (o.op === "find") {
          fr.push(snap({ hk: o.k, hit: pos.has(o.k) ? pos.get(o.k) : undefined, miss: !pos.has(o.k), res: { op: "find", k: o.k, r: pos.has(o.k) }, line: 4, calc: `${o.k} in pos? ${pos.has(o.k) ? "yes" : "no"}`, vars: { x: o.k }, note: `Membership is a single map lookup: ${pos.has(o.k) ? `${o.k} is at index ${pos.get(o.k)}` : `${o.k} is absent`}.` }));
        } else {
          if (!pos.has(o.k)) { fr.push(snap({ hk: o.k, miss: true, res: { op: "del", k: o.k, r: false }, line: 9, calc: `${o.k} not in pos → False`, vars: { x: o.k }, note: `${o.k} is not in the set. Return False.` })); continue; }
          const i = pos.get(o.k), last = vals[vals.length - 1];
          fr.push(snap({ hole: i, hk: o.k, mv: vals.length - 1, line: 10, calc: `i = pos[${o.k}] = ${i}; last = vals[-1] = ${last}`, vars: { x: o.k, i, last }, note: `Deleting from the middle of an array would shift everything: O(n). Instead, move the <b>last</b> element into ${o.k}'s slot, then pop the end.` }));
          vals[i] = last; pos.set(last, i);
          fr.push(snap({ w: i, hk: last, mv: vals.length - 1, line: [11, 12], calc: `vals[${i}] = ${last}; pos[${last}] = ${i}`, vars: { i, last }, note: last === o.k ? `${o.k} was itself the last element, so it "moves" onto itself. Harmless, but note the order: update pos[last] <i>before</i> deleting pos[x], or this case breaks.` : `${last} now lives at index ${i}; its pos entry is updated to match.` }));
          vals.pop(); pos.delete(o.k);
          fr.push(snap({ hk: o.k, res: { op: "del", k: o.k, r: true }, line: [13, 14], calc: `vals.pop(); del pos[${o.k}]`, vars: { size: vals.length }, note: `Pop the duplicate tail and delete ${o.k} from the map. Every step was O(1).` }));
        }
      }
      fr.push(snap({ line: [], vars: { size: vals.length }, note: `Final set {${vals.join(", ")}}. The invariant held after every operation: vals[pos[x]] == x for all x, and vals has no holes.` }));
      return fr;
    },
    render: (f) => col(
      calc(f.calc ? esc(f.calc) : ""),
      Viz.array(f.vals, { label: "vals (dense array)", ptrs: f.hole !== undefined ? { hole: f.hole, last: f.mv } : f.pick !== undefined ? { pick: f.pick } : {}, cls: (j) => (j === f.pick || j === f.hit ? "done" : j === f.hole ? "bad" : j === f.w ? "active" : j === f.mv ? "visit" : "") }),
      mapView("pos: value → index", f.pos, (k) => (k === f.hk ? (f.miss ? "bad" : "active") : "")),
    ),
  }));
})();
