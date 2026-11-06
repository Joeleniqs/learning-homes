/* API protocol visualizers. Every registered name is prefixed "api-protocols-". */
(() => {
  const esc = Viz.esc;
  const int = (s, label, min, max) => {
    const t = String(s ?? "").trim(), n = Number(t);
    if (t === "" || !Number.isInteger(n) || n < min || n > max) throw new Error(`${label}: use a whole number from ${min} to ${max}.`);
    return n;
  };
  const ints = (s, label, minLen, maxLen, lo, hi) => {
    const parts = String(s ?? "").split(/[\s,]+/).filter(Boolean);
    if (parts.length < minLen || parts.length > maxLen) throw new Error(`${label}: give ${minLen}–${maxLen} numbers separated by commas.`);
    return parts.map((p) => int(p, label, lo, hi));
  };
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rnd = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const hex2 = (b) => b.toString(16).padStart(2, "0");
  const utf8 = (s) => Array.from(new TextEncoder().encode(s));
  const fromUtf8 = (a) => new TextDecoder().decode(new Uint8Array(a));

  /* key/value panel: rows [[key, value, cls]] */
  const kv = (title, rows, o = {}) => `<div class="apx-kv ${o.cls || ""}"><div class="apx-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="apx-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="apx-kv-r empty"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="apx-stats">${items.map(([l, v, c]) => `<div class="apx-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const panels = (...p) => `<div class="apx-panels">${p.filter(Boolean).join("")}</div>`;
  const verdict = (html, c) => `<div class="apx-verdict ${c || ""}">${html}</div>`;
  const col = (...p) => `<div class="apx-col">${p.filter(Boolean).join("")}</div>`;

  /* sequence diagram. lanes [{id,label,sub}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 760, n = lanes.length, lw = W / n, rowH = o.rowH || 28, max = o.max || 12;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, n === 2 ? (i ? W - 104 : 104) : (i + 0.5) * lw]));
    let s = `<svg class="apx-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 12, 190);
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
        const x = X[m.from], bw = Math.min(W - 4, Math.max(120, m.label.length * 7.4 + 18));
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
   * 1. HTTP/1.1 vs HTTP/2 vs HTTP/3: head-of-line blocking simulation
   * ===================================================================== */
  const PROTOS = {
    "HTTP/1.1, 6 connections": "h1x6",
    "HTTP/1.1, 1 connection": "h1x1",
    "HTTP/2 (one TCP connection)": "h2",
    "HTTP/3 (QUIC)": "h3",
  };
  const RTT = 2;
  function simTransport(proto, sizes, loss, rto) {
    const n = sizes.length, setup = proto === "h3" ? RTT : 2 * RTT;
    const h1 = proto.startsWith("h1"), nConn = proto === "h1x6" ? Math.min(6, n) : 1;
    const S = sizes.map((size, i) => ({ i, size, sent: 0, ready: null, reqAt: null, conn: null, done: null, frames: [] }));
    const conns = Array.from({ length: nConn }, (_, c) => ({ c, cur: null }));
    const pending = S.map((s) => s.i);
    const assign = (conn, t) => { // t = tick the request leaves the client
      if (!pending.length) { conn.cur = null; return; }
      const s = S[pending.shift()]; s.conn = conn.c; s.reqAt = t; s.ready = t + RTT; conn.cur = s.i;
    };
    if (h1) conns.forEach((c) => assign(c, setup + 1));
    else S.forEach((s) => { s.conn = 0; s.reqAt = setup + 1; s.ready = setup + 1 + RTT; pending.length = 0; });
    const dom = (s) => (proto === "h3" ? "s" + s.i : "c" + s.conn);
    const seqOf = {}, arrived = {}, nextDeliver = {};
    let rr = 0, lossFrame = null, rtxDue = null, t = 0;
    const events = [];
    while (S.some((s) => s.done === null) && t < 400) {
      t++;
      const ev = { t, tx: null, lost: false, rtx: null, delivered: [], completed: [] };
      if (rtxDue === t) {
        lossFrame.rtx = t; lossFrame.arr = t; arrived[lossFrame.dom].add(lossFrame.seq); ev.rtx = lossFrame;
      } else {
        let chosen = null;
        for (let k = 0; k < n; k++) {
          const s = S[(rr + k) % n];
          if (s.ready !== null && s.ready <= t && s.sent < s.size && (!h1 || conns[s.conn].cur === s.i)) { chosen = s; break; }
        }
        if (chosen) {
          rr = (chosen.i + 1) % n;
          const d = dom(chosen);
          seqOf[d] = seqOf[d] ?? 0; arrived[d] = arrived[d] || new Set(); nextDeliver[d] = nextDeliver[d] ?? 0;
          const f = { s: chosen.i, k: ++chosen.sent, tx: t, dom: d, seq: seqOf[d]++, arr: null, rtx: null, deliv: null, lost: false };
          chosen.frames.push(f); ev.tx = f;
          if (t === loss && !lossFrame) { f.lost = true; lossFrame = f; rtxDue = t + rto; ev.lost = true; }
          else { f.arr = t; arrived[d].add(f.seq); }
        }
      }
      const all = S.flatMap((s) => s.frames);
      for (const d of Object.keys(arrived)) {
        while (arrived[d].has(nextDeliver[d])) {
          const f = all.find((x) => x.dom === d && x.seq === nextDeliver[d]);
          f.deliv = t; ev.delivered.push(f); nextDeliver[d]++;
        }
      }
      for (const s of S) {
        if (s.done === null && s.sent === s.size && s.frames.every((f) => f.deliv !== null)) {
          s.done = t; ev.completed.push(s.i);
          if (h1) assign(conns[s.conn], t + 1);
        }
      }
      events.push(ev);
    }
    return { S, conns, setup, T: t, events, lossFrame, h1, nConn };
  }

  Viz.register("api-protocols-transport", (el) => Viz.player(el, {
    title: "Same page, four transports: who waits for whom when one packet is lost?",
    tag: "SIMULATION · STEP THROUGH",
    legend: [["done", "frame delivered to the app"], ["active", "arrived, but held: an earlier byte is missing"], ["visit", "was held, delivered late"], ["bad", "packet lost"], ["path", "retransmitted"], ["dim", "waiting for a connection"]],
    codeLang: "python",
    code: [
      "setup = 1 RTT if quic else 2 RTT     # TCP + TLS 1.3",
      "every tick:",
      "    send one frame (retransmit first,",
      "                    else round-robin)",
      "    if packet lost: retransmit at t + RTO",
      "    deliver frames in order per domain:",
      "        HTTP/1.1, HTTP/2: the TCP connection",
      "        HTTP/3: each QUIC stream",
      "    HTTP/1.1: next request on a connection",
      "              only after the last response",
    ],
    inputs: [
      { key: "p", label: "transport", type: "select", options: Object.keys(PROTOS), value: "HTTP/2 (one TCP connection)" },
      { key: "sizes", label: "response sizes in frames (≤ 6 requests, 1–4)", value: "3,2,4,1,2", width: 150 },
      { key: "loss", label: "lose the packet sent at tick (0 = none)", value: "9", width: 70 },
      { key: "rto", label: "retransmit after (ticks)", value: "4", width: 70 },
    ],
    random: () => ({ p: pick(Object.keys(PROTOS)), sizes: Array.from({ length: rnd(3, 6) }, () => rnd(1, 4)).join(","), loss: String(rnd(6, 12)), rto: String(rnd(2, 5)) }),
    build: ({ p, sizes, loss, rto }) => {
      const proto = PROTOS[p]; if (!proto) throw new Error("Pick a transport.");
      const sz = ints(sizes, "response sizes", 1, 6, 1, 4);
      const L = int(loss, "lost tick", 0, 40), R = int(rto, "retransmit delay", 1, 8);
      const sim = simTransport(proto, sz, L, R);
      const others = Object.entries(PROTOS).map(([name, pr]) => [name, simTransport(pr, sz, L, R).T, simTransport(pr, sz, 0, R).T]);
      const fr = [];
      const base = { proto, p, sim, others };
      fr.push({ ...base, now: 0, line: 0, vars: { requests: sz.length, frames: sz.reduce((a, b) => a + b, 0), setup: sim.setup + " ticks" },
        note: `The page needs ${sz.length} resources (${sz.join(", ")} frames each). The link carries <b>one frame per tick</b>, a round trip (RTT) is ${RTT} ticks. ${proto === "h3" ? "QUIC folds the transport and TLS 1.3 handshakes into <b>one</b> round trip." : "Before any request, TCP needs a handshake (1 RTT) and TLS 1.3 another (1 RTT)."}${L ? ` The packet sent at tick ${L} will be lost.` : " No packet will be lost."}` });
      for (const ev of sim.events) {
        const bits = [];
        const name = (f) => `r${f.s + 1} frame ${f.k}`;
        if (ev.t <= sim.setup) bits.push(proto === "h3" ? "QUIC handshake in progress (transport + TLS together)." : ev.t <= RTT ? "TCP handshake (SYN, SYN-ACK)." : "TLS 1.3 handshake.");
        if (ev.tx && ev.lost) bits.push(`<b>${name(ev.tx)} is lost.</b> The sender only finds out by timeout, so it will resend at tick ${ev.t + R}.`);
        else if (ev.tx) bits.push(`Sent ${name(ev.tx)}.`);
        if (ev.rtx) bits.push(`Retransmitted <b>${name(ev.rtx)}</b>; the gap is filled.`);
        const late = ev.delivered.filter((f) => f.arr !== ev.t);
        if (late.length) bits.push(`That releases ${late.length} held frame${late.length > 1 ? "s" : ""} (${[...new Set(late.map((f) => "r" + (f.s + 1)))].join(", ")}) to the application at once.`);
        if (sim.lossFrame && !sim.lossFrame.rtx && ev.t > sim.lossFrame.tx && ev.tx && !ev.lost) {
          const held = ev.tx.dom === sim.lossFrame.dom;
          bits.push(held ? `It arrives, but ${proto === "h3" ? "its QUIC stream" : "TCP"} must hand bytes over <b>in order</b>, so it waits behind the lost frame${proto === "h2" && ev.tx.s !== sim.lossFrame.s ? ` even though r${ev.tx.s + 1} has nothing to do with r${sim.lossFrame.s + 1}: <b>head-of-line blocking</b>` : ""}.` : `It is delivered at once: ${proto === "h3" ? "each QUIC stream orders its own bytes, so a loss on another stream doesn't stall it" : "it travels on a different TCP connection"}.`);
        }
        if (ev.completed.length) bits.push(`Response${ev.completed.length > 1 ? "s" : ""} ${ev.completed.map((i) => "r" + (i + 1)).join(", ")} complete.${sim.h1 && ev.completed.length ? " The connection is free, so the browser sends the next queued request (one more RTT before its first byte)." : ""}`);
        if (!bits.length) bits.push(sim.h1 ? "Waiting: requests are in flight (one RTT before the first byte)." : "Requests are in flight; no response bytes yet.");
        const held = sim.S.flatMap((s) => s.frames).filter((f) => f.arr !== null && f.arr <= ev.t && (f.deliv === null || f.deliv > ev.t)).length;
        const line = ev.t <= sim.setup ? 0 : ev.lost ? 4 : ev.rtx ? [2, 5] : late.length ? 5 : ev.completed.length && sim.h1 ? 8 : ev.tx ? 2 : 1;
        fr.push({ ...base, now: ev.t, line, note: `<b>Tick ${ev.t}.</b> ${bits.join(" ")}`,
          vars: { tick: ev.t, "frames held": held, "responses done": sim.S.filter((s) => s.done !== null && s.done <= ev.t).length + "/" + sz.length } });
      }
      const last = sim.S.reduce((a, s) => Math.max(a, s.done), 0);
      fr.push({ ...base, now: sim.T, summary: true, line: [], vars: { "page done at": "tick " + last },
        note: `Everything arrives by tick <b>${last}</b>. Compare all four transports on the same input below. ${L ? "HTTP/2 beats HTTP/1.1 on a clean network (one handshake, no queueing), but a single loss stalls <i>every</i> stream on its one TCP connection. HTTP/3 keeps multiplexing and confines the stall to the stream that lost data." : "Without loss, HTTP/2 and HTTP/3 win through multiplexing; HTTP/3 also saves a handshake round trip."}` });
      return fr;
    },
    render: (f) => {
      const { sim, now } = f, T = sim.T;
      const head = `<tr><th></th>${Array.from({ length: T }, (_, k) => `<th class="${k + 1 === now ? "cur" : ""}">${(k + 1) % 5 === 0 || k === 0 ? k + 1 : ""}</th>`).join("")}<th>done</th></tr>`;
      const connRows = Array.from({ length: f.proto === "h1x6" ? sim.nConn : 1 }, (_, c) => {
        const cells = Array.from({ length: T }, (_, k) => {
          const t = k + 1; if (t > now) return "<td></td>";
          return t <= sim.setup ? `<td class="hs">H</td>` : "<td></td>";
        }).join("");
        return `<tr class="conn"><th>${f.proto === "h3" ? "QUIC" : "conn " + (c + 1)}</th>${cells}<td></td></tr>`;
      }).join("");
      const rows = sim.S.map((s) => {
        const cells = Array.from({ length: T }, (_, k) => {
          const t = k + 1; if (t > now) return "<td></td>";
          const fr = s.frames.find((x) => x.tx === t || x.rtx === t);
          if (fr) {
            if (fr.rtx === t) return `<td class="path">${fr.k}</td>`;
            if (fr.lost) return `<td class="bad">✕</td>`;
            const c = fr.deliv === fr.arr ? "done" : fr.deliv !== null && fr.deliv <= now ? "visit" : "active";
            return `<td class="${c}">${fr.k}</td>`;
          }
          if (s.reqAt === null || t < s.reqAt) return `<td class="dim">·</td>`;
          if (t < s.ready) return `<td class="req">→</td>`;
          return "<td></td>";
        }).join("");
        const done = s.done !== null && s.done <= now;
        return `<tr><th>r${s.i + 1} <small>${s.size}f</small></th>${cells}<td class="fin ${done ? "ok" : ""}">${done ? s.done : ""}</td></tr>`;
      }).join("");
      const out = [`<div class="apx-fit"><table class="apx-tl">${head}${connRows}${rows}</table></div>`];
      if (f.summary) {
        out.push(`<table class="apx-mini"><tr><th>transport</th><th>page done (with this loss)</th><th>without loss</th></tr>${f.others.map(([n, a, b]) => `<tr class="${PROTOS[n] === f.proto ? "me" : ""}"><td>${esc(n)}</td><td>${a}</td><td>${b}</td></tr>`).join("")}</table>`);
      }
      return col(...out);
    },
  }));

  /* =====================================================================
   * 2. Protobuf wire format and schema evolution
   * ===================================================================== */
  const WT = { int32: 0, int64: 0, bool: 0, string: 2 };
  const WRITER = [{ n: 1, name: "id", type: "int64" }, { n: 2, name: "customer", type: "string" }, { n: 3, name: "qty", type: "int32" }, { n: 4, name: "gift", type: "bool" }];
  const READERS = {
    "v1 again (identical schema)": { fields: WRITER, ok: true, why: "Same numbers, same types." },
    "rename customer → buyer (still = 2)": { fields: [WRITER[0], { n: 2, name: "buyer", type: "string" }, WRITER[2], WRITER[3]], ok: true, why: "Names never travel on the wire; only numbers do. Renames are free (but they do break JSON transcoding and reflection-based code)." },
    "add string note = 5": { fields: [...WRITER, { n: 5, name: "note", type: "string" }], ok: true, why: "Old messages simply lack field 5, so the reader sees the default \"\"." },
    "delete qty, reserved 3": { fields: [WRITER[0], WRITER[1], WRITER[3]], reserved: [3], ok: true, why: "The reader skips field 3 as unknown (and keeps it, so re-serializing preserves it). reserved stops anyone from reusing 3." },
    "renumber customer 2 → 6": { fields: [WRITER[0], { n: 6, name: "customer", type: "string" }, WRITER[2], WRITER[3]], ok: false, bad: ["customer"], why: "The reader looks for field 6, finds field 2 instead and treats it as unknown. The customer silently becomes \"\"." },
    "reuse 3 as int64 discount_cents": { fields: [WRITER[0], WRITER[1], { n: 3, name: "discount_cents", type: "int64" }, WRITER[3]], ok: false, bad: ["discount_cents"], why: "Same wire type (varint), so nothing fails: old qty values are read as discounts. Silent corruption; this is exactly what reserved prevents." },
    "reuse 3 as string coupon": { fields: [WRITER[0], WRITER[1], { n: 3, name: "coupon", type: "string" }, WRITER[3]], ok: false, bad: ["coupon"], why: "Wire types differ (varint vs length-delimited). Runtimes treat the field as unknown or fail the parse." },
    "widen qty int32 → int64": { fields: [WRITER[0], WRITER[1], { n: 3, name: "qty", type: "int64" }, WRITER[3]], ok: true, why: "int32, int64, uint32, uint64 and bool share the varint encoding, so widening is compatible (narrowing truncates)." },
    "change id int64 → string": { fields: [{ n: 1, name: "id", type: "string" }, WRITER[1], WRITER[2], WRITER[3]], ok: false, bad: ["id"], why: "Varint on the wire, length-delimited expected: the id is lost. Changing a field's type is a breaking change; add a new field instead." },
  };
  const varint = (v) => { const out = []; let x = BigInt(v); do { let b = Number(x & 0x7fn); x >>= 7n; if (x) b |= 0x80; out.push(b); } while (x); return out; };
  const readVarint = (bytes, pos) => { let x = 0n, shift = 0n, p = pos; for (;;) { const b = bytes[p++]; x |= BigInt(b & 0x7f) << shift; if (!(b & 0x80)) break; shift += 7n; } return [x, p]; };
  function protoField(f, v) { // returns {tag:[...], body:[...]} or null when default
    if (f.type === "string") { if (v === "") return null; const b = utf8(v); return { tag: varint((f.n << 3) | 2), len: varint(b.length), body: b }; }
    if (f.type === "bool") { if (!v) return null; return { tag: varint(f.n << 3), len: [], body: [1] }; }
    if (Number(v) === 0) return null;
    return { tag: varint(f.n << 3), len: [], body: varint(v) };
  }

  Viz.register("api-protocols-proto", (el) => Viz.player(el, {
    title: "Protobuf on the wire: encode with v1, decode with a changed schema",
    legend: [["path", "tag = field number << 3 | wire type"], ["active", "length prefix"], ["visit", "value bytes"], ["done", "decoded into a known field"], ["bad", "unknown or mismatched: skipped"]],
    codeLang: "python",
    code: [
      "for field in schema:                     # writer",
      "    if value == default: continue        # proto3 sends nothing",
      "    out += varint(field.number << 3 | wire_type)",
      "    out += len_prefix + payload          # varint or LEN",
      "while bytes:                             # reader",
      "    number, wt = tag >> 3, tag & 7",
      "    f = reader_schema.get(number)",
      "    if f is None or f.wire_type != wt:",
      "        unknown.append(raw)              # skip, keep",
      "    else: msg[f.name] = decode(f, raw)",
    ],
    inputs: [
      { key: "id", label: "id", value: "150", width: 80 },
      { key: "customer", label: "customer", value: "ana", width: 90 },
      { key: "qty", label: "qty", value: "2", width: 60 },
      { key: "gift", label: "gift", type: "select", options: ["true", "false"], value: "true" },
      { key: "reader", label: "reader's schema", type: "select", options: Object.keys(READERS), value: "reuse 3 as int64 discount_cents" },
    ],
    random: () => ({ id: String(rnd(1, 99999)), customer: pick(["ana", "bo", "chen", "dürer", ""]), qty: String(pick([0, 1, 2, 300])), gift: pick(["true", "false"]), reader: pick(Object.keys(READERS)) }),
    build: ({ id, customer, qty, gift, reader }) => {
      const R = READERS[reader]; if (!R) throw new Error("Pick a reader schema.");
      const vals = { id: int(id, "id", 0, 2 ** 31 - 1), customer: String(customer).slice(0, 12), qty: int(qty, "qty", 0, 1000000), gift: gift === "true" };
      if (String(customer).length > 12) throw new Error("customer: 12 characters at most.");
      const fr = [], groups = [];
      const base = () => ({ vals, R, reader, groups: groups.map((g) => ({ ...g })) });
      fr.push({ ...base(), phase: "enc", line: 0, vars: { bytes: 0 }, note: `The writer uses schema v1: <code>id = 1</code>, <code>customer = 2</code>, <code>qty = 3</code>, <code>gift = 4</code>. Only the <b>numbers</b> and wire types go on the wire. Field names stay in the .proto file.` });
      for (const f of WRITER) {
        const p = protoField(f, vals[f.name]);
        if (!p) { fr.push({ ...base(), phase: "enc", line: 1, cur: f.n, vars: { field: f.name, bytes: groups.reduce((a, g) => a + g.tag.length + g.len.length + g.body.length, 0) }, note: `<code>${f.name}</code> holds the default (${f.type === "string" ? '""' : f.type === "bool" ? "false" : 0}). proto3 writes <b>nothing</b> for defaults, so the reader can't tell "unset" from "zero" unless the field is declared <code>optional</code>.` }); continue; }
        groups.push({ n: f.n, name: f.name, ...p });
        const total = groups.reduce((a, g) => a + g.tag.length + g.len.length + g.body.length, 0);
        fr.push({ ...base(), phase: "enc", line: [2, 3], cur: f.n, vars: { field: f.name, tag: `${f.n}<<3|${WT[f.type]} = 0x${hex2(p.tag[0])}`, bytes: total },
          note: `<code>${f.name}</code> → tag <code>${f.n} &lt;&lt; 3 | ${WT[f.type]} = 0x${hex2(p.tag[0])}</code> (wire type ${WT[f.type]} = ${WT[f.type] ? "LEN: a length prefix follows" : "VARINT"}). ${f.type === "string" ? `${p.body.length} UTF-8 byte${p.body.length === 1 ? "" : "s"} after a length of ${p.body.length}.` : `The value ${vals[f.name] === true ? 1 : vals[f.name]} as a varint: 7 bits per byte, high bit = "more bytes follow" (${p.body.map(hex2).join(" ")}).`}` });
      }
      const bytes = groups.flatMap((g) => [...g.tag, ...g.len, ...g.body]);
      const json = JSON.stringify(Object.fromEntries(WRITER.map((f) => [f.name, vals[f.name]])));
      fr.push({ ...base(), phase: "wire", line: 4, vars: { "protobuf bytes": bytes.length, "same as JSON": utf8(json).length + " bytes" }, note: `The whole message is <b>${bytes.length} bytes</b> (the same data as JSON is ${utf8(json).length}). Now a service compiled against a different schema reads these bytes: <b>${esc(reader)}</b>.` });
      const out = {}, unknown = [];
      const rf = new Map(R.fields.map((f) => [f.n, f]));
      let pos = 0, gi = 0;
      while (pos < bytes.length) {
        const [tag, p1] = readVarint(bytes, pos); const n = Number(tag >> 3n), wt = Number(tag & 7n);
        let p = p1, raw;
        if (wt === 0) { const [v, p2] = readVarint(bytes, p); raw = v; p = p2; } else { const [len, p2] = readVarint(bytes, p); raw = bytes.slice(p2, p2 + Number(len)); p = p2 + Number(len); }
        pos = p;
        const f = rf.get(n), g = groups[gi++];
        if (!f || WT[f.type] !== wt) {
          g.st = "bad"; unknown.push(`#${n} (wt ${wt})`);
          fr.push({ ...base(), phase: "dec", out: { ...out }, unknown: unknown.slice(), line: [5, 6, 7, 8], cur: n, vars: { number: n, "wire type": wt, "reader field": f ? `${f.name}: ${f.type}` : "none" },
            note: !f ? `Field <b>${n}</b> isn't in the reader's schema${R.reserved?.includes(n) ? " (it's <code>reserved</code>)" : ""}. The varint tag says how to skip it, so parsing continues: the bytes are kept as an <b>unknown field</b>.` : `The reader expects <code>${f.name}</code> as ${f.type} (wire type ${WT[f.type]}), but the bytes say wire type ${wt}. The value can't be interpreted; it's treated as unknown (or the parse fails, depending on the runtime).` });
        } else {
          let v;
          if (f.type === "string") v = fromUtf8(raw); else if (f.type === "bool") v = raw !== 0n; else v = Number(raw);
          out[f.name] = v; g.st = "done";
          const writerName = WRITER.find((w) => w.n === n)?.name;
          fr.push({ ...base(), phase: "dec", out: { ...out }, unknown: unknown.slice(), line: [5, 6, 9], cur: n, vars: { number: n, "wire type": wt, "reader field": `${f.name}: ${f.type}` },
            note: `Field ${n}, wire type ${wt} matches <code>${f.name}: ${f.type}</code> → <b>${esc(JSON.stringify(v))}</b>.${writerName !== f.name ? ` The writer called this field <code>${writerName}</code>; the reader has no way to know it means something else now.` : ""}` });
        }
      }
      for (const f of R.fields) if (!(f.name in out)) out[f.name] = f.type === "string" ? "" : f.type === "bool" ? false : 0;
      fr.push({ ...base(), phase: "dec", out: { ...out }, unknown: unknown.slice(), final: true, line: [], vars: { compatible: R.ok ? "yes" : "NO" },
        note: `${R.ok ? "<b>Compatible.</b>" : "<b>Breaking.</b>"} ${esc(R.why)}` });
      return fr;
    },
    render: (f) => {
      const strip = f.groups.map((g) => {
        const st = g.st ? ` ${g.st}` : "", cur = g.n === f.cur ? " cur" : "";
        const b = [...g.tag.map((x) => `<span class="b path">${hex2(x)}</span>`), ...g.len.map((x) => `<span class="b active">${hex2(x)}</span>`), ...g.body.map((x) => `<span class="b visit">${hex2(x)}</span>`)].join("");
        return `<div class="apx-grp${st}${cur}"><div class="bytes">${b}</div><small>#${g.n} ${esc(g.name)}</small></div>`;
      }).join("") || `<span class="apx-muted">no bytes yet</span>`;
      const writer = kv("writer: Order (v1)", WRITER.map((w) => [`${w.n} ${w.name}`, JSON.stringify(f.vals[w.name]), w.n === f.cur && f.phase === "enc" ? "active" : ""]));
      const parts = [panels(writer, f.phase === "dec" ? kv(`reader: ${f.reader}`, f.R.fields.map((r) => [`${r.n} ${r.name}: ${r.type}`, r.name in f.out ? JSON.stringify(f.out[r.name]) : f.final ? "(default)" : "…", r.name in f.out ? (f.final && (f.R.bad || []).includes(r.name) ? "bad" : "done") : ""]).concat((f.R.reserved || []).map((r) => [`reserved ${r}`, "", "dim"]))) : "", f.phase === "dec" ? kv("unknown fields", (f.unknown || []).map((u) => [u, "skipped", "bad"]), { empty: "none" }) : "")];
      parts.unshift(`<div class="apx-strip">${strip}</div>`);
      if (f.final) parts.push(verdict(f.R.ok ? "Compatible change" : "Breaking change", f.R.ok ? "done" : "bad"));
      return col(...parts);
    },
  }));

  /* =====================================================================
   * 3. gRPC's four call types as HTTP/2 frames
   * ===================================================================== */
  const CALLS = {
    "unary": { m: "GetOrder", cs: false, ss: false, line: 1 },
    "server streaming": { m: "WatchOrder", cs: false, ss: true, line: 2 },
    "client streaming": { m: "UploadLines", cs: true, ss: false, line: 3 },
    "bidi streaming": { m: "Chat", cs: true, ss: true, line: 4 },
  };
  const OUTCOMES = ["OK", "server returns NOT_FOUND", "client cancels", "deadline exceeded"];
  function grpcPlan(c, n) {
    const C = (k, end) => ({ who: "c", type: "data", k, end }), S = (k) => ({ who: "s", type: "data", k });
    const p = [];
    if (!c.cs && !c.ss) p.push(C(1, true), { who: "s", type: "hdr" }, S(1));
    else if (!c.cs) { p.push(C(1, true), { who: "s", type: "hdr" }); for (let k = 1; k <= n; k++) p.push(S(k)); }
    else if (!c.ss) { for (let k = 1; k <= n; k++) p.push(C(k, k === n)); p.push({ who: "s", type: "hdr" }, S(1)); }
    else { p.push(C(1, n === 1), { who: "s", type: "hdr" }, S(1)); for (let k = 2; k <= n; k++) p.push(C(k, k === n), S(k)); }
    p.push({ who: "s", type: "trl" });
    return p;
  }
  Viz.register("api-protocols-grpc-calls", (el) => Viz.player(el, {
    title: "gRPC call types: every call is one HTTP/2 stream",
    legend: [["path", "HEADERS (call starts / response headers)"], ["visit", "DATA: one length-prefixed protobuf message"], ["done", "trailers: grpc-status 0"], ["bad", "error status or RST_STREAM"]],
    codeLang: "protobuf",
    code: [
      "service Orders {",
      "  rpc GetOrder(GetOrderRequest) returns (Order);              // unary",
      "  rpc WatchOrder(WatchRequest) returns (stream OrderEvent);   // server streaming",
      "  rpc UploadLines(stream OrderLine) returns (UploadSummary);  // client streaming",
      "  rpc Chat(stream ChatMessage) returns (stream ChatMessage);  // bidirectional",
      "}",
      "// on the wire: HEADERS → DATA* (each 1-byte flag + 4-byte length + bytes) → trailers",
    ],
    inputs: [
      { key: "kind", label: "call type", type: "select", options: Object.keys(CALLS), value: "server streaming" },
      { key: "n", label: "messages", value: "3", width: 60 },
      { key: "outcome", label: "outcome", type: "select", options: OUTCOMES, value: "OK" },
    ],
    random: () => ({ kind: pick(Object.keys(CALLS)), n: String(rnd(1, 5)), outcome: pick(OUTCOMES) }),
    build: ({ kind, n, outcome }) => {
      const c = CALLS[kind]; if (!c) throw new Error("Pick a call type.");
      if (!OUTCOMES.includes(outcome)) throw new Error("Pick an outcome.");
      const N = int(n, "messages", 1, 5);
      const reqT = { GetOrder: "GetOrderRequest", WatchOrder: "WatchRequest", UploadLines: "OrderLine", Chat: "ChatMessage" }[c.m];
      const resT = { GetOrder: "Order", WatchOrder: "OrderEvent", UploadLines: "UploadSummary", Chat: "ChatMessage" }[c.m];
      const fr = [], msgs = [];
      let st = "idle", status = null, cSent = 0, sSent = 0, cDone = false, sDone = false;
      const state = () => (cDone && sDone ? "closed" : cDone ? "half-closed (client finished sending)" : sDone ? "half-closed (server finished sending)" : st);
      const push = (note, line, extra = {}) => fr.push({ msgs: msgs.map((m) => ({ ...m })), kind, outcome, st: state(), status, cSent, sSent, line, note,
        vars: { "stream state": state(), "client msgs": cSent, "server msgs": sSent, "grpc-status": status ? status.code : "(pending)" }, ...extra });
      push(`A <b>${kind}</b> call to <code>Orders/${c.m}</code>: ${c.cs ? "the client sends a stream of" : "the client sends one"} <code>${reqT}</code>, ${c.ss ? "the server answers with a stream of" : "the server answers with one"} <code>${resT}</code>. All four kinds use the same framing on one HTTP/2 stream; only who sends how many messages changes.`, c.line);
      msgs.push({ from: "c", to: "s", label: `HEADERS  POST /shop.Orders/${c.m}  grpc-timeout: 2S`, cls: "path" }); st = "open";
      push(`The stub opens a new HTTP/2 stream with a <b>HEADERS</b> frame. The method is always POST, the path is <code>/package.Service/Method</code>, <code>content-type: application/grpc</code>, and the client's deadline travels as <code>grpc-timeout</code>. Many calls share one TCP connection as separate streams.`, [c.line, 6]);
      let plan = grpcPlan(c, N);
      const cut = Math.max(1, Math.ceil((plan.length - 1) / 2));
      if (outcome !== "OK") plan = plan.slice(0, outcome === "server returns NOT_FOUND" ? 1 : cut);
      for (const e of plan) {
        if (e.who === "c") {
          cSent++; if (e.end) cDone = true;
          msgs.push({ from: "c", to: "s", label: `DATA  ${reqT} #${e.k}${e.end ? "  END_STREAM" : ""}`, cls: "visit" });
          push(`Client message ${e.k}: protobuf bytes behind a <b>5-byte prefix</b> (1 compression flag + 4-byte length), so the receiver knows where each message ends.${e.end ? ` <b>END_STREAM</b> is set: the client has nothing more to send, so its half of the stream closes. ${c.cs ? "In client streaming the server usually waits for this before answering." : ""}` : " No END_STREAM yet: more messages may follow, and the server can already process this one."}`, [c.line, 6]);
        } else if (e.type === "hdr") {
          msgs.push({ from: "s", to: "c", label: "HEADERS  :status 200  content-type: application/grpc", cls: "path" });
          push(`The server sends response headers. <b>HTTP status is 200 even when the call will fail</b>: gRPC reports the real outcome in the trailers at the end, because a stream can fail after sending many good messages.`, [c.line, 6]);
        } else if (e.type === "data") {
          sSent++;
          msgs.push({ from: "s", to: "c", label: `DATA  ${resT} #${e.k}`, cls: "visit" });
          push(c.ss ? `Server message ${e.k}. The client's <code>await foreach</code> / <code>for msg in stream</code> loop yields it immediately: the client doesn't wait for the whole response.${c.cs ? " In bidi, both directions are independent; this exchange is ping-pong only because this handler chose to reply per message." : ""}` : `The single <code>${resT}</code> response message.`, [c.line, 6]);
        } else {
          sDone = true; status = { code: 0, name: "OK" };
          msgs.push({ from: "s", to: "c", label: "HEADERS (trailers)  grpc-status: 0  END_STREAM", cls: "done" });
          push(`<b>Trailers</b> close the stream: <code>grpc-status: 0</code> (OK) plus optional metadata. Only now does the client know the call succeeded. Stream state: closed.`, [c.line, 6]);
        }
      }
      if (outcome === "server returns NOT_FOUND") {
        sDone = true; status = { code: 5, name: "NOT_FOUND" };
        msgs.push({ from: "s", to: "c", label: "HEADERS  :status 200  grpc-status: 5  grpc-message: order 42 not found  END_STREAM", cls: "bad" });
        push(`The handler throws <code>NOT_FOUND</code> after the first message. The server sends a <b>trailers-only response</b>: one HEADERS frame with <code>grpc-status: 5</code>, a <code>grpc-message</code>, and END_STREAM. No DATA at all.`, [c.line, 6]);
        if (!cDone) {
          cDone = true;
          msgs.push({ from: "s", to: "c", label: "RST_STREAM  NO_ERROR", cls: "bad" });
          push(`The client still had messages to send. The server resets the stream with <code>NO_ERROR</code>: "I'm done; stop sending". The client's next write fails and its call ends with status 5.`, 6);
        }
      } else if (outcome !== "OK") {
        const dl = outcome === "deadline exceeded";
        if (dl) { msgs.push({ from: "c", to: "c", label: "2 s pass: the client's deadline timer fires", cls: "bad" }); push(`Time passes. The client set <code>grpc-timeout: 2S</code>, and 2 seconds have elapsed while the call is still open. The server knows the same deadline from the header and cancels its own context at the same moment.`, 6); }
        cDone = sDone = true; status = dl ? { code: 4, name: "DEADLINE_EXCEEDED" } : { code: 1, name: "CANCELLED" };
        msgs.push({ from: "c", to: "s", label: "RST_STREAM  CANCEL", cls: "bad" });
        push(`${dl ? "The client gives up" : "The user navigated away, so the client cancels its token / context"} and sends <b>RST_STREAM(CANCEL)</b>. The client's call ends with <code>${status.name}</code> (${status.code}). On the server, <code>context.Done()</code> / <code>CancellationToken</code> / <code>isCancelled()</code> fires, so a well-written handler stops work and doesn't call its own dependencies any more. No trailers are sent: the stream is simply reset.`, 6);
      }
      fr.push({ ...fr[fr.length - 1], final: true, line: [], note: `${status.code === 0 ? "<b>Call succeeded.</b>" : `<b>Call failed with ${status.name} (${status.code}).</b>`} ${cSent} client message${cSent === 1 ? "" : "s"} and ${sSent} server message${sSent === 1 ? "" : "s"} travelled on one stream${status.code === 0 ? ", closed by trailers" : ""}. Try another call type: the frames are the same, only the counts and who sends END_STREAM first change.` });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "c", label: "Client stub", sub: "channel over HTTP/2" }, { id: "s", label: "Server handler", sub: "stream id 1" }];
      const st = kv("stream", [["state", f.st, f.st === "closed" ? (f.status && f.status.code ? "bad" : "done") : "active"], ["client messages sent", String(f.cSent)], ["server messages sent", String(f.sSent)], ["grpc-status", f.status ? `${f.status.code} ${f.status.name}` : "not yet known", f.status ? (f.status.code ? "bad" : "done") : ""]]);
      return col(seq(lanes, f.msgs, { width: 760, max: 12, label: "gRPC frames between client and server" }), st, f.final ? verdict(f.status.code ? `Failed: ${f.status.name}` : "OK", f.status.code ? "bad" : "done") : "");
    },
  }));

  /* =====================================================================
   * 4. Deadline propagation across a call chain
   * ===================================================================== */
  const DL_MODES = ["propagate the incoming deadline", "fresh timeout per hop", "no timeouts"];
  const HOPS = ["Orders", "Inventory", "Pricing"];
  function simDeadline(mode, D, w) {
    const n = w.length, s = [], started = [];
    let t = 0;
    for (let i = 0; i < n; i++) { s.push(t); started.push(mode !== DL_MODES[0] || t < D); t += w[i]; }
    const total = t;
    const stop = new Array(n), res = new Array(n);
    if (mode === DL_MODES[0]) {
      for (let i = 0; i < n; i++) { stop[i] = started[i] ? Math.min(total, D) : null; res[i] = total <= D ? "OK" : "DEADLINE_EXCEEDED"; }
    } else if (mode === DL_MODES[1]) {
      for (let i = n - 1; i >= 0; i--) {
        if (i === n - 1) { stop[i] = s[i] + w[i]; res[i] = "OK"; continue; }
        const lim = s[i + 1] + D;
        if (stop[i + 1] <= lim) { stop[i] = stop[i + 1]; res[i] = res[i + 1]; } else { stop[i] = lim; res[i] = "DEADLINE_EXCEEDED"; }
      }
    } else { for (let i = 0; i < n; i++) { stop[i] = total; res[i] = "OK"; } }
    const gw = mode === DL_MODES[2] ? total : Math.min(stop[0], D);
    const gwRes = mode === DL_MODES[2] ? "OK" : stop[0] <= D && res[0] === "OK" ? "OK" : "DEADLINE_EXCEEDED";
    const hops = w.map((wi, i) => {
      const workEnd = started[i] ? Math.min(s[i] + wi, stop[i]) : null;
      const busy = started[i] ? stop[i] - s[i] : 0;
      const wasted = started[i] ? Math.max(0, stop[i] - Math.max(s[i], gw)) : 0;
      const header = mode === DL_MODES[0] ? `${Math.max(0, D - s[i])}m` : mode === DL_MODES[1] ? `${D}m` : "(none)";
      return { name: HOPS[i], s: s[i], w: wi, started: started[i], workEnd, stop: stop[i], res: res[i], busy, wasted, header };
    });
    const T = Math.max(gw, D, ...hops.map((h) => h.stop || 0));
    return { D, w, hops, gw, gwRes, total, T, wasted: hops.reduce((a, h) => a + h.wasted, 0) };
  }
  Viz.register("api-protocols-deadline", (el) => Viz.player(el, {
    title: "Deadlines across a call chain: propagate, or waste work",
    legend: [["visit", "doing its own work"], ["path", "waiting on the next service"], ["bad", "work after the caller already gave up (wasted)"], ["done", "finished OK"]],
    codeLang: "go",
    code: [
      "func (s *Orders) Get(ctx context.Context, r *pb.Req) (*pb.Order, error) {",
      "    s.doOwnWork(ctx)                                  // checks ctx.Err()",
      "    // GOOD: pass the incoming ctx; gRPC sends the REMAINING budget",
      "    inv, err := s.inventory.Check(ctx, &pb.CheckReq{...})",
      "    // BAD: a fresh 1s budget that ignores the caller's deadline",
      "    c2, cancel := context.WithTimeout(context.Background(), time.Second)",
      "    defer cancel(); inv, err = s.inventory.Check(c2, &pb.CheckReq{...})",
      "    if status.Code(err) == codes.DeadlineExceeded { return nil, err }",
      "}",
    ],
    inputs: [
      { key: "mode", label: "strategy", type: "select", options: DL_MODES, value: DL_MODES[0] },
      { key: "D", label: "deadline (ms)", value: "1000", width: 80 },
      { key: "w", label: "work per hop: Orders, Inventory, Pricing (ms)", value: "150, 250, 900", width: 130 },
    ],
    random: () => ({ mode: pick(DL_MODES), D: String(pick([500, 800, 1000, 1500, 2000])), w: [rnd(1, 6) * 50, rnd(1, 8) * 50, rnd(2, 30) * 50].join(", ") }),
    build: ({ mode, D, w }) => {
      if (!DL_MODES.includes(mode)) throw new Error("Pick a strategy.");
      const d = int(D, "deadline", 100, 5000), ws = ints(w, "work per hop", 3, 3, 10, 5000);
      const sim = simDeadline(mode, d, ws);
      const lines = mode === DL_MODES[0] ? [2, 3] : mode === DL_MODES[1] ? [4, 5, 6] : [6];
      const times = [...new Set([0, d, sim.gw, ...sim.hops.flatMap((h) => (h.started ? [h.s, h.workEnd, h.stop] : []))])].filter((t) => t <= sim.T).sort((a, b) => a - b);
      const fr = [];
      const base = { sim, mode };
      fr.push({ ...base, now: 0, line: 0, vars: { deadline: d + " ms", "work needed": sim.total + " ms" },
        note: `The gateway calls Orders → Inventory → Pricing. Doing all the work takes <b>${sim.total} ms</b>; the gateway's deadline is <b>${d} ms</b>. The gateway calls Orders with <code>grpc-timeout: ${sim.hops[0].header}</code>. Strategy: <b>${esc(mode)}</b>. ${mode === DL_MODES[0] ? "Each hop passes its incoming context, so the deadline is an absolute instant shared by the whole chain." : mode === DL_MODES[1] ? `Each hop starts a <b>fresh ${d} ms</b> timer for its own outgoing call, ignoring how much of the caller's budget is left.` : "Nobody sets a deadline: callers wait as long as it takes, holding threads, connections and memory."}` });
      for (const t of times.filter((x) => x > 0)) {
        const bits = [];
        sim.hops.forEach((h, i) => {
          if (!h.started) { if (t === d && mode === DL_MODES[0] && h.s >= d) bits.push(`${h.name} is never called: ${HOPS[i - 1]} checks the remaining budget (none) and fails fast.`); return; }
          if (h.s === t) bits.push(`${HOPS[i - 1] || "The gateway"} calls <b>${h.name}</b> with <code>grpc-timeout: ${h.header}</code>${mode === DL_MODES[0] ? " (the budget left, computed automatically)" : ""}.`);
          if (h.workEnd === t && h.workEnd === h.s + h.w && i < sim.hops.length - 1) bits.push(`${h.name} finishes its own ${h.w} ms of work.`);
          if (h.stop === t) {
            const cancelled = h.res !== "OK" && h.workEnd < h.s + h.w;
            bits.push(h.res === "OK" ? `<b>${h.name}</b> returns OK${t > sim.gw && mode !== DL_MODES[2] ? `, but its caller chain already gave up at ${sim.gw} ms: <b>wasted</b>` : ""}.` : cancelled ? `<b>${h.name}</b> is cancelled mid-work (its context fired) and stops at once.` : mode === DL_MODES[0] ? `<b>${h.name}</b>' context fires too: its pending call is cancelled and it returns DEADLINE_EXCEEDED.` : `<b>${h.name}</b>' outgoing call times out; it returns DEADLINE_EXCEEDED${t > sim.gw ? " to a caller that is no longer listening" : ""}.`);
          }
        });
        if (t === d && mode !== DL_MODES[2]) bits.unshift(`<b>${d} ms: the gateway's deadline.</b>`);
        if (t === sim.gw) bits.push(sim.gwRes === "OK" ? `The gateway gets its answer at ${t} ms.` : `The gateway returns <b>DEADLINE_EXCEEDED</b> to the user at ${t} ms.`);
        const active = sim.hops.filter((h) => h.started && h.s <= t && h.stop > t).map((h) => h.name);
        fr.push({ ...base, now: t, line: t === d ? [7] : lines, note: `<b>${t} ms.</b> ${bits.join(" ") || "Work continues."}${active.length && t >= sim.gw && mode !== DL_MODES[2] ? ` Still running for nobody: ${active.join(", ")}.` : ""}`,
          vars: { now: t + " ms", "gateway": t >= sim.gw ? sim.gwRes : "waiting", "wasted so far": sim.hops.reduce((a, h) => a + (h.started ? Math.max(0, Math.min(t, h.stop) - Math.max(h.s, sim.gw)) : 0), 0) + " ms" } });
      }
      fr.push({ ...base, now: sim.T, final: true, line: lines, vars: { "gateway result": `${sim.gwRes} at ${sim.gw} ms`, wasted: sim.wasted + " ms" },
        note: `${sim.gwRes === "OK" ? `The user got an answer after <b>${sim.gw} ms</b>${sim.gw > d ? ` (${sim.gw - d} ms past the deadline they wanted)` : ""}.` : `The user got DEADLINE_EXCEEDED at <b>${sim.gw} ms</b>.`} ${mode === DL_MODES[2] ? "" : `Work done after that point: <b>${sim.wasted} ms</b> across the chain. `}${mode === DL_MODES[0] ? "Propagation makes the whole chain stop together; nothing burns CPU or pool slots for an answer nobody will read." : mode === DL_MODES[1] ? "Fresh per-hop timeouts let downstream services keep working for an abandoned request. Under load this wasted work is what turns a slowdown into an outage." : "Without deadlines, one slow dependency holds a thread at every hop for as long as it takes; under load the pools fill up and everything queues."}` });
      return fr;
    },
    render: (f) => {
      const { sim, now } = f, W = 760, L = 120, R = 70, cw = W - L - R, sx = (t) => L + (Math.min(t, sim.T) / sim.T) * cw;
      const rows = [{ name: "Gateway", gw: true }, ...sim.hops], rh = 34, H = 40 + rows.length * rh + 22;
      let s = `<svg class="apx-dl" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="deadline timeline">`;
      for (let k = 0; k <= 4; k++) { const t = Math.round((sim.T * k) / 4); s += `<line class="grid" x1="${sx(t)}" y1="30" x2="${sx(t)}" y2="${H - 22}"/><text class="ax" x="${sx(t)}" y="${H - 6}">${t} ms</text>`; }
      rows.forEach((r, i) => {
        const y = 36 + i * rh;
        s += `<text class="lbl" x="8" y="${y + 18}">${esc(r.name)}</text>`;
        const bar = (a, b, c) => { const e = Math.min(b, now); if (e > a) s += `<rect class="bar ${c}" x="${sx(a)}" y="${y + 4}" width="${Math.max(1, sx(e) - sx(a))}" height="${rh - 12}" rx="3"/>`; };
        if (r.gw) { bar(0, sim.gw, "path"); if (now >= sim.gw) s += `<text class="st ${sim.gwRes === "OK" ? "ok" : "bad"}" x="${sx(sim.gw) + 4}" y="${y + 18}">${sim.gwRes === "OK" ? "OK" : "DEADLINE"}</text>`; return; }
        if (!r.started) { if (now >= sim.D) s += `<text class="st muted" x="${L + 4}" y="${y + 18}">never called (no budget left)</text>`; return; }
        const cut = f.mode === DL_MODES[2] ? Infinity : sim.gw;
        const seg = (a, b, c) => { if (b <= a) return; if (b <= cut) bar(a, b, c); else if (a >= cut) bar(a, b, "bad"); else { bar(a, cut, c); bar(cut, b, "bad"); } };
        seg(r.s, r.workEnd, "visit");
        if (r.stop > r.workEnd) seg(r.workEnd, r.stop, "path wait");
        if (now >= r.stop) s += `<text class="st ${r.res === "OK" && r.stop <= cut ? "ok" : "bad"}" x="${sx(r.stop) + 4}" y="${y + 18}">${r.res === "OK" ? (r.stop <= cut ? "OK" : "late") : "cancel"}</text>`;
      });
      if (f.mode !== DL_MODES[2]) s += `<line class="dline" x1="${sx(sim.D)}" y1="22" x2="${sx(sim.D)}" y2="${H - 22}"/><text class="dtx" x="${sx(sim.D)}" y="16">deadline ${sim.D} ms</text>`;
      s += `<line class="now" x1="${sx(now)}" y1="30" x2="${sx(now)}" y2="${H - 22}"/>`;
      s += "</svg>";
      const tbl = `<table class="apx-mini"><tr><th>hop</th><th>grpc-timeout sent</th><th>busy</th><th>wasted</th></tr>${sim.hops.map((h) => `<tr><td>${h.name}</td><td>${h.started ? h.header : "-"}</td><td>${h.busy} ms</td><td class="${h.wasted ? "bad" : ""}">${h.wasted} ms</td></tr>`).join("")}</table>`;
      return col(`<div class="apx-fit">${s}</div>`, f.final ? panels(tbl, verdict(`${sim.wasted} ms of wasted work`, sim.wasted ? "bad" : "done")) : "");
    },
  }));

  /* =====================================================================
   * 5. GraphQL resolver tree: N+1 vs DataLoader
   * ===================================================================== */
  const DL_STRATS = ["naive resolvers (one query each)", "DataLoader (batch + per-request cache)"];
  Viz.register("api-protocols-dataloader", (el) => Viz.player(el, {
    title: "GraphQL N+1: naive resolvers vs DataLoader",
    legend: [["active", "resolver running now"], ["path", "key queued in a DataLoader batch"], ["done", "resolved"], ["bad", "a database round trip"]],
    codeLang: "typescript",
    code: [
      "const resolvers = {",
      "  Query: { orders: (_, { first }) => db.orders.findMany({ take: first }) },",
      "  Order: {",
      "    customer: (o, _, ctx) => ctx.loaders.customer.load(o.customerId),",
      "    items:    (o, _, ctx) => ctx.loaders.itemsByOrder.load(o.id) },",
      "  Item: { product: (i, _, ctx) => ctx.loaders.product.load(i.productId) } };",
      "// a loader collects every .load(key) in the same tick, then calls ONCE:",
      "new DataLoader(ids => db.query('... WHERE id = ANY($1)', [ids]))",
    ],
    inputs: [
      { key: "mode", label: "resolvers", type: "select", options: DL_STRATS, value: DL_STRATS[0] },
      { key: "n", label: "orders (first: N)", value: "4", width: 60 },
      { key: "items", label: "items per order", value: "2", width: 60 },
      { key: "cust", label: "distinct customers", value: "2", width: 60 },
      { key: "prod", label: "distinct products", value: "3", width: 60 },
    ],
    random: () => { const n = rnd(1, 6); return { mode: pick(DL_STRATS), n: String(n), items: String(rnd(1, 3)), cust: String(rnd(1, n)), prod: String(rnd(1, 5)) }; },
    build: ({ mode, n, items, cust, prod }) => {
      if (!DL_STRATS.includes(mode)) throw new Error("Pick a resolver strategy.");
      const N = int(n, "orders", 1, 6), I = int(items, "items per order", 1, 3), C = int(cust, "distinct customers", 1, 6), P = int(prod, "distinct products", 1, 5);
      if (C > N) throw new Error("distinct customers can't exceed the number of orders.");
      const loader = mode === DL_STRATS[1];
      const orders = Array.from({ length: N }, (_, i) => ({ id: 101 + i, cust: 1 + (i % C), items: Array.from({ length: I }, (_, j) => ({ id: (101 + i) * 10 + j, prod: 1 + ((i * I + j) % P) })) }));
      const cell = {}; // key -> state
      const sql = [];
      const fr = [];
      const snap = (note, line, extra = {}) => fr.push({ orders, loader, cell: { ...cell }, sql: sql.slice(), note, line, queue: extra.queue || null, cur: extra.cur || null,
        vars: { "SQL queries": sql.length, "rows read": sql.reduce((a, q) => a + q.rows, 0) }, ...extra });
      snap(`The query asks for <code>orders(first: ${N}) { customer { name } items { product { name } } }</code>. GraphQL runs one <b>resolver per field per object</b>, level by level. Each resolver only sees its parent object, so on its own it can only fetch what it needs for that one parent.`, 0);
      sql.push({ q: `SELECT * FROM orders LIMIT ${N}`, rows: N }); orders.forEach((o) => (cell["o" + o.id] = "done"));
      snap(`<code>Query.orders</code> runs once: <b>1 query</b> returns ${N} orders. Now every Order needs <code>customer</code> and <code>items</code>.`, 1, { cur: "orders" });
      const level = (kind, keysOf, table, col, line, label) => {
        const reqs = orders.flatMap((o) => keysOf(o));
        if (!loader) {
          for (const r of reqs) {
            cell[r.cell] = "active"; sql.push({ q: `SELECT * FROM ${table} WHERE ${col} = ${r.key}`, rows: r.rows });
            snap(`${label} resolver for ${r.who}: <b>its own query</b> (<code>${col} = ${r.key}</code>). ${sql.length} queries so far.${reqs.filter((x) => x.key === r.key).length > 1 ? ` Key ${r.key} is fetched more than once: nothing remembers the earlier answer.` : ""}`, line, { cur: r.cell });
            cell[r.cell] = "done";
          }
        } else {
          const queued = [];
          for (const r of reqs) {
            cell[r.cell] = "path"; queued.push(r.key);
            snap(`${label} resolver for ${r.who} calls <code>loader.load(${r.key})</code>. It gets a promise back; <b>no query yet</b>. Queue: [${queued.join(", ")}].`, line, { cur: r.cell, queue: { kind, keys: queued.slice() } });
          }
          const uniq = [...new Set(queued)];
          sql.push({ q: `SELECT * FROM ${table} WHERE ${col} IN (${uniq.join(", ")})`, rows: reqs.reduce((a, r) => (uniq.includes(r.key) && !a.seen.has(r.key) ? (a.seen.add(r.key), { seen: a.seen, n: a.n + r.rows }) : a), { seen: new Set(), n: 0 }).n });
          reqs.forEach((r) => (cell[r.cell] = "done"));
          snap(`The event loop finishes this tick, so the loader <b>dispatches once</b>: ${queued.length} load call${queued.length > 1 ? "s" : ""}, ${uniq.length} distinct key${uniq.length > 1 ? "s" : ""} → <b>one</b> <code>IN (…)</code> query. Results are matched back to each promise by key${queued.length > uniq.length ? `, and duplicates come from the per-request cache` : ""}.`, 7, { queue: { kind, keys: uniq, sent: true } });
        }
      };
      level("customer", (o) => [{ cell: "c" + o.id, key: o.cust, rows: 1, who: `order ${o.id}` }], "customers", "id", 3, "<code>Order.customer</code>");
      level("items", (o) => [{ cell: "i" + o.id, key: o.id, rows: I, who: `order ${o.id}` }], "items", "order_id", 4, "<code>Order.items</code>");
      level("product", (o) => o.items.map((it) => ({ cell: "p" + it.id, key: it.prod, rows: 1, who: `item ${it.id}` })), "products", "id", 5, "<code>Item.product</code>");
      const naive = 1 + 2 * N + N * I;
      fr.push({ ...fr[fr.length - 1], final: true, line: [], cur: null, queue: null,
        note: loader ? `<b>${sql.length} queries</b> regardless of page size: one per <i>level</i> of the tree, not per object. Naive resolvers would have needed 1 + ${N} + ${N} + ${N * I} = <b>${naive}</b>. DataLoader is per request (create loaders in the request context), so its cache never leaks data between users.` : `<b>${sql.length} queries</b> = 1 + N customers + N item lists + N×${I} products. Doubling the page size doubles the round trips. This is the same N+1 you get from ORM lazy loading, made worse because every nested list multiplies it. Switch to DataLoader.` });
      return fr;
    },
    render: (f) => {
      const c = (k) => f.cell[k] || "dim";
      const rows = f.orders.map((o) => `<tr><td class="${c("o" + o.id)}">order ${o.id}</td><td class="${c("c" + o.id)}${f.cur === "c" + o.id ? " cur" : ""}">customer ${o.cust}</td><td class="${c("i" + o.id)}${f.cur === "i" + o.id ? " cur" : ""}">items ×${o.items.length}</td><td class="prods">${o.items.map((it) => `<span class="${c("p" + it.id)}${f.cur === "p" + it.id ? " cur" : ""}">product ${it.prod}</span>`).join("")}</td></tr>`).join("");
      const tree = `<table class="apx-tree"><tr><th>Order</th><th>.customer</th><th>.items</th><th>.items[].product</th></tr>${rows}</table>`;
      const log = `<div class="apx-sql"><div class="apx-kv-h">database round trips: ${f.sql.length}</div>${f.sql.slice(-9).map((q, i, a) => `<div class="q ${i === a.length - 1 ? "cur" : ""}"><code>${esc(q.q)}</code><small>${q.rows} row${q.rows === 1 ? "" : "s"}</small></div>`).join("")}${f.sql.length > 9 ? `<div class="apx-muted">… ${f.sql.length - 9} earlier</div>` : ""}</div>`;
      const q = f.queue ? kv(`${f.queue.kind} loader ${f.queue.sent ? "dispatched" : "queue"}`, f.queue.keys.map((k, i) => [`key ${i + 1}`, String(k), f.queue.sent ? "done" : "path"])) : "";
      return col(panels(`<div class="apx-fit">${tree}</div>`, col(log, q)), f.final ? verdict(`${f.sql.length} queries`, f.loader ? "done" : "bad") : "");
    },
  }));

  /* =====================================================================
   * 6. GraphQL query cost and depth analysis
   * ===================================================================== */
  function parseGql(src) {
    const toks = String(src).match(/[A-Za-z_][A-Za-z0-9_]*|-?\d+|[{}():,]|"[^"]*"|\S/g) || [];
    let p = 0;
    const peek = () => toks[p], next = () => toks[p++], expect = (t) => { if (toks[p] !== t) throw new Error(`Query syntax: expected "${t}" but found "${toks[p] ?? "end of query"}".`); p++; };
    if (peek() === "query") { next(); if (/^[A-Za-z_]/.test(peek() || "")) next(); }
    const sel = (depth) => {
      expect("{"); const fields = [];
      while (peek() && peek() !== "}") {
        const name = next(); if (!/^[A-Za-z_]/.test(name)) throw new Error(`Query syntax: unexpected "${name}".`);
        const args = {};
        if (peek() === "(") { next(); while (peek() && peek() !== ")") { const k = next(); expect(":"); const v = next(); if (v === undefined) throw new Error("Query syntax: unfinished arguments."); args[k] = /^-?\d+$/.test(v) ? Number(v) : v; if (peek() === ",") next(); } expect(")"); }
        const f = { name, args, depth, kids: [] };
        if (peek() === "{") f.kids = sel(depth + 1);
        fields.push(f); if (peek() === ",") next();
      }
      expect("}"); if (!fields.length) throw new Error("Query syntax: an empty selection { }.");
      return fields;
    };
    const root = sel(1);
    if (p < toks.length) throw new Error(`Query syntax: unexpected "${toks[p]}" after the end.`);
    return root;
  }
  const GQL_PRESETS = [
    "{ customers(first: 50) { name orders(first: 20) { total items(first: 10) { product { name } } } } }",
    "{ viewer { name orders(first: 10) { id total } } }",
    "{ product(id: 7) { name reviews(first: 5) { stars author { name } } } }",
    "{ customers(first: 100) { orders(first: 100) { id } } }",
    "{ a { b { c { d { e { f { g } } } } } } }",
    "{ orders(first: 500) { id } }",
  ];
  Viz.register("api-protocols-gql-cost", (el) => Viz.player(el, {
    title: "Query cost analysis: reject expensive queries before running them",
    legend: [["active", "field being scored"], ["visit", "connection (list with first:)"], ["done", "within limits"], ["bad", "over a limit"]],
    codeLang: "python",
    code: [
      "def score(field, multiplier=1, depth=1):",
      "    check(depth <= MAX_DEPTH)",
      "    n = field.args.get('first') or field.args.get('last')",
      "    if n is not None:                       # a connection",
      "        check(n <= MAX_PAGE)",
      "        multiplier *= n",
      "        nodes += multiplier                 # objects it may return",
      "    for child in field.selections: score(child, multiplier, depth + 1)",
    ],
    inputs: [
      { key: "q", label: "query", value: GQL_PRESETS[0], width: 640 },
      { key: "maxDepth", label: "max depth", value: "6", width: 60 },
      { key: "maxNodes", label: "max nodes", value: "5000", width: 80 },
    ],
    random: () => ({ q: pick(GQL_PRESETS), maxDepth: String(rnd(3, 8)), maxNodes: String(pick([500, 1000, 5000, 20000])) }),
    build: ({ q, maxDepth, maxNodes }) => {
      const MD = int(maxDepth, "max depth", 1, 20), MN = int(maxNodes, "max nodes", 1, 1000000), MP = 100;
      if (String(q).length > 400) throw new Error("query: 400 characters at most.");
      const root = parseGql(q);
      const flat = [];
      const walk = (f, mult) => { const n = f.args.first ?? f.args.last; const conn = typeof n === "number"; const m = conn ? mult * n : mult; flat.push({ f, conn, n, m, mult }); f.kids.forEach((k) => walk(k, m)); };
      root.forEach((f) => walk(f, 1));
      const fr = [], errs = [];
      let nodes = 0, depth = 0;
      const show = (k, note, line) => fr.push({ flat, k, nodes, depth, errs: errs.slice(), MD, MN, note, line, vars: { field: k >= 0 ? flat[k].f.name : "-", depth: `${depth}/${MD}`, nodes: `${nodes}/${MN}` } });
      show(-1, `The server parses the query into a tree <b>before executing anything</b>. It walks the tree and multiplies the page sizes (<code>first:</code>) along each path: a list inside a list can return the product of both. Limits: depth ≤ ${MD}, nodes ≤ ${MN}, and no page larger than ${MP}.`, 0);
      flat.forEach((x, k) => {
        depth = Math.max(depth, x.f.depth);
        const bits = [`<code>${esc(x.f.name)}</code> at depth ${x.f.depth}.`];
        if (x.f.depth > MD && !errs.some((e) => e.startsWith("depth"))) { errs.push(`depth ${x.f.depth} > ${MD}`); bits.push(`<b>Too deep</b>: nesting this far is how attackers build cyclic queries (customer → orders → customer → …).`); }
        if (x.conn) {
          if (x.n > MP) { errs.push(`${x.f.name}(first: ${x.n}) > ${MP}`); bits.push(`<b>first: ${x.n}</b> exceeds the maximum page of ${MP}.`); }
          nodes += x.m;
          bits.push(`A connection: up to ${x.n} per parent, and there can be ${x.mult.toLocaleString("en-US")} parent${x.mult === 1 ? "" : "s"}, so it may return <b>${x.m.toLocaleString("en-US")}</b> objects. Running total: ${nodes.toLocaleString("en-US")}.`);
          if (nodes > MN && !errs.some((e) => e.startsWith("nodes"))) { errs.push(`nodes > ${MN}`); bits.push(`<b>Over the node budget.</b>`); }
        } else bits.push(x.f.kids.length ? `An object field: it doesn't multiply anything.` : `A scalar: no extra cost.`);
        show(k, bits.join(" "), x.conn ? [2, 3, 4, 5, 6] : x.f.kids.length ? [7] : [1]);
      });
      fr.push({ ...fr[fr.length - 1], k: -1, final: true, line: [], note: errs.length ? `<b>Rejected</b> without touching the database: ${errs.map(esc).join("; ")}. The client gets an error that explains the cost, so it can ask for smaller pages. This is how GitHub's GraphQL API limits requests (max 100 per page, 500,000 nodes).` : `<b>Accepted</b>: depth ${depth}, at most ${nodes.toLocaleString("en-US")} objects. The same number can also feed a rate limiter: charge clients by cost, not by request count.` });
      return fr;
    },
    render: (f) => {
      const lines = f.flat.map((x, k) => {
        const over = (x.f.depth > f.MD) || (x.conn && x.n > 100);
        const cls = k === f.k ? "active" : over && k <= f.k ? "bad" : x.conn && (k <= f.k || f.final) ? "visit" : k <= f.k || f.final ? "done" : "dim";
        const args = Object.keys(x.f.args).length ? `(${Object.entries(x.f.args).map(([a, v]) => `${a}: ${v}`).join(", ")})` : "";
        return `<div class="apx-ol ${cls}" style="padding-left:${(x.f.depth - 1) * 22 + 8}px"><code>${esc(x.f.name)}${esc(args)}</code><span>${x.conn ? `× ${x.mult.toLocaleString("en-US")} parents = ${x.m.toLocaleString("en-US")}` : ""}</span></div>`;
      }).join("");
      const meter = (label, v, max) => `<div class="apx-meter ${v > max ? "bad" : "done"}"><span>${label}</span><div class="track"><div class="fill" style="width:${Math.min(100, (v / max) * 100).toFixed(1)}%"></div></div><b>${v.toLocaleString("en-US")} / ${max.toLocaleString("en-US")}</b></div>`;
      return col(`<div class="apx-outline">${lines}</div>`, meter("depth", f.depth, f.MD), meter("nodes", f.nodes, f.MN), f.final ? verdict(f.errs.length ? "Rejected before execution" : "Accepted", f.errs.length ? "bad" : "done") : "");
    },
  }));

  /* =====================================================================
   * 7. Real-time delivery: polling, long polling, SSE, WebSocket
   * ===================================================================== */
  const RT = ["short polling", "long polling", "Server-Sent Events", "WebSocket"];
  function simRealtime(tech, events, X, P) {
    const L = 0.5, END = 30, off = (t) => X !== null && t >= X && t < X + 4;
    const ev = events.map((e, i) => ({ i, e, at: null, lost: false, how: "live" }));
    const reqs = [], conns = [], fails = [];
    let bytes = 0;
    if (tech === RT[0]) {
      for (let t = 0; t <= END; t += P) {
        if (off(t)) { fails.push({ t, why: "poll fails: no network" }); continue; }
        const got = ev.filter((x) => x.at === null && x.e <= t + L);
        got.forEach((x) => { x.at = t + 2 * L; x.how = "polled"; });
        reqs.push({ t0: t, ta: t + L, tr: t + L, tb: t + 2 * L, ids: got.map((x) => x.i), empty: !got.length });
        bytes += 700;
      }
    } else if (tech === RT[1]) {
      let cur = 0, guard = 0;
      while (cur < END && guard++ < 200) {
        if (off(cur)) { fails.push({ t: cur, why: "request fails: no network" }); cur = X + 4; continue; }
        const ta = cur + L;
        const ready = ev.filter((x) => x.at === null && x.e <= ta);
        const nx = ev.filter((x) => x.at === null && x.e > ta).map((x) => x.e);
        const tr = ready.length ? ta : Math.min(nx.length ? Math.min(...nx) : Infinity, ta + 20);
        if (X !== null && X >= cur && X < tr + L) { reqs.push({ t0: cur, ta: Math.min(ta, X), tr: X, tb: X, ids: [], broken: true }); bytes += 350; cur = X + 4; continue; }
        const got = ev.filter((x) => x.at === null && x.e <= tr);
        got.forEach((x) => { x.at = tr + L; x.how = ready.length ? "waiting on server" : "held request"; });
        reqs.push({ t0: cur, ta, tr, tb: tr + L, ids: got.map((x) => x.i), empty: !got.length });
        bytes += 700; cur = tr + L;
      }
    } else {
      const sse = tech === RT[2];
      bytes += 500;
      conns.push({ t0: 0, open: L, close: null });
      reqs.push({ t0: 0, ta: L, tr: L, tb: 2 * L, ids: [], hs: sse ? "GET /events → 200 text/event-stream" : "GET Upgrade: websocket → 101" });
      let reopen = null;
      if (X !== null) {
        const tries = sse ? Array.from({ length: 12 }, (_, k) => X + 3 * (k + 1)) : [1, 3, 7, 15, 31].map((d) => X + d);
        const r = tries.find((t) => !off(t));
        tries.filter((t) => t < r).forEach((t) => fails.push({ t, why: sse ? "EventSource retry fails" : "reconnect fails" }));
        conns[0].close = X; conns.push({ t0: r, open: r + L, close: null }); reopen = r + L;
        reqs.push({ t0: r, ta: r + L, tr: r + L, tb: r + 2 * L, ids: [], hs: sse ? "GET /events  Last-Event-ID: " + (ev.filter((x) => x.e + L < X).length || 0) : "GET Upgrade → 101 (new socket)" });
        bytes += 500;
      }
      ev.forEach((x) => {
        bytes += sse ? 30 : 6;
        if (X === null || x.e + L < X || x.e >= reopen) { x.at = x.e + L; return; }
        if (sse) { x.at = reopen + L; x.how = "replayed"; reqs[reqs.length - 1].ids.push(x.i); } else { x.lost = true; x.how = "lost"; }
      });
    }
    return { tech, ev, reqs, conns, fails, bytes, X, P, L };
  }
  Viz.register("api-protocols-realtime", (el) => Viz.player(el, {
    title: "Getting updates to a browser: polling, long polling, SSE, WebSocket",
    legend: [["path", "HTTP request / open connection"], ["visit", "server-side event"], ["done", "event reaches the client"], ["bad", "failure or lost event"]],
    codeLang: "typescript",
    code: [
      "// short polling: ask every P seconds, mostly for nothing",
      "setInterval(() => fetch(`/orders/42/events?after=${cursor}`), 5000);",
      "// long polling: the server holds the request until there is news",
      "for (;;) { const r = await fetch(`/orders/42/events?after=${cursor}&wait=20`); }",
      "// SSE: one GET, server writes 'id: 7\\ndata: {...}\\n\\n' per event",
      "const es = new EventSource('/orders/42/events'); // auto-reconnect + Last-Event-ID",
      "// WebSocket: HTTP Upgrade, then frames in both directions",
      "const ws = new WebSocket('wss://shop/ws');        // reconnect + resume: your job",
    ],
    inputs: [
      { key: "tech", label: "technique", type: "select", options: RT, value: RT[0] },
      { key: "events", label: "server events at (s)", value: "3, 4, 11, 13, 17, 24", width: 150 },
      { key: "X", label: "network drops at (s, or none)", value: "12", width: 60 },
      { key: "P", label: "poll interval (s)", value: "5", width: 50 },
    ],
    random: () => { const n = rnd(2, 6), s = new Set(); while (s.size < n) s.add(rnd(1, 25)); return { tech: pick(RT), events: [...s].sort((a, b) => a - b).join(", "), X: pick(["none", String(rnd(2, 22))]), P: String(rnd(2, 8)) }; },
    build: ({ tech, events, X, P }) => {
      if (!RT.includes(tech)) throw new Error("Pick a technique.");
      const evs = ints(events, "server events", 2, 8, 1, 25).sort((a, b) => a - b);
      if (new Set(evs).size !== evs.length) throw new Error("server events: use different times.");
      const x = String(X).trim().toLowerCase() === "none" || String(X).trim() === "" ? null : int(X, "network drop", 1, 24);
      const p = int(P, "poll interval", 1, 10);
      const sim = simRealtime(tech, evs, x, p);
      const lines = { [RT[0]]: [0, 1], [RT[1]]: [2, 3], [RT[2]]: [4, 5], [RT[3]]: [6, 7] }[tech];
      const times = [...new Set([0, ...evs, ...sim.reqs.flatMap((r) => [r.t0, r.tb]), ...sim.ev.filter((e) => e.at !== null).map((e) => e.at), ...sim.fails.map((f) => f.t), ...(x === null ? [] : [x, x + 4])])].filter((t) => t <= 31).sort((a, b) => a - b);
      const fr = [];
      const stat = (now) => {
        const got = sim.ev.filter((e) => e.at !== null && e.at <= now), lat = got.map((e) => e.at - e.e);
        return { requests: sim.reqs.filter((r) => r.t0 <= now).length + sim.fails.filter((f) => f.t <= now).length, delivered: `${got.length}/${evs.length}`, "avg latency": lat.length ? (lat.reduce((a, b) => a + b, 0) / lat.length).toFixed(1) + " s" : "-", lost: sim.ev.filter((e) => e.lost && e.e <= now).length };
      };
      fr.push({ sim, now: 0, line: lines, vars: stat(0), note: `The server produces events at ${evs.join(", ")} s; one-way network latency is 0.5 s${x === null ? "" : `, and the client's network drops from ${x} s to ${x + 4} s`}. Technique: <b>${tech}</b>. ${tech === RT[0] ? `The client asks "anything new after my cursor?" every ${p} s.` : tech === RT[1] ? "The client asks, and the server doesn't answer until it has news (or 20 s pass)." : tech === RT[2] ? "One long-lived GET; the server writes events into the open response as text lines." : "An HTTP request upgrades to a WebSocket, then either side can send frames at any time."}` });
      for (const t of times.filter((v) => v > 0)) {
        const bits = [];
        if (t === x) bits.push(`<b>Network drops.</b>${sim.conns.length ? " The open connection breaks." : ""}`);
        if (x !== null && t === x + 4) bits.push("Network is back.");
        sim.ev.filter((e) => e.e === t).forEach((e) => bits.push(`Server event <b>e${e.i + 1}</b> happens.${e.lost ? " The socket is down and plain WebSockets keep no history: <b>this event will never arrive</b>." : ""}`));
        sim.fails.filter((f) => f.t === t).forEach((f) => bits.push(`${f.why}.`));
        sim.reqs.filter((r) => r.t0 === t).forEach((r) => bits.push(r.hs ? `Client opens: <code>${esc(r.hs)}</code>.` : `Client sends a request.`));
        sim.reqs.filter((r) => r.tb === t && !r.hs).forEach((r) => bits.push(r.broken ? "The held request breaks with the network." : r.empty ? `Response arrives: <b>empty</b>${tech === RT[1] ? " (20 s hold expired)" : ""}. A full round trip for nothing.` : `Response arrives with ${r.ids.map((i) => "e" + (i + 1)).join(", ")}.`));
        const del = sim.ev.filter((e) => e.at === t);
        if (del.length && sim.reqs.every((r) => r.tb !== t || r.hs)) bits.push(`${del.map((e) => `e${e.i + 1}`).join(", ")} ${del.length > 1 ? "arrive" : "arrives"}${del[0].how === "replayed" ? ": the server <b>replays</b> what the client missed, using <code>Last-Event-ID</code>" : ""} (${del.map((e) => `${(e.at - e.e).toFixed(1)} s after it happened`).join(", ")}).`);
        else if (del.length) bits.push(`Latency: ${del.map((e) => `e${e.i + 1} ${(e.at - e.e).toFixed(1)} s`).join(", ")}.`);
        fr.push({ sim, now: t, line: lines, vars: stat(t), note: `<b>${t} s.</b> ${bits.join(" ") || "Nothing new."}` });
      }
      const st = stat(99);
      fr.push({ sim, now: 31, final: true, line: [], vars: st, note: `<b>${tech}:</b> ${st.requests} HTTP request${st.requests === 1 ? "" : "s"}, ≈${sim.bytes.toLocaleString("en-US")} bytes of protocol overhead, average latency ${st["avg latency"]}, ${st.lost} lost. ${tech === RT[0] ? "Latency is bounded by the interval and most polls come back empty; simple, cacheable and works everywhere." : tech === RT[1] ? "Near-real-time over plain HTTP, but every event costs a full request/response and the server holds one request per client." : tech === RT[2] ? "Push latency with one connection, and the browser's EventSource reconnects and resumes for you. One direction only (server → client)." : "The lowest overhead and both directions, but reconnecting and resuming after a drop is your code's job (SignalR and Socket.IO add it)."}` });
      return fr;
    },
    render: (f) => {
      const { sim, now } = f, W = 760, x0 = 70, x1 = 744, sx = (t) => x0 + (Math.min(t, 31) / 31) * (x1 - x0), yS = 58, yC = 168, H = 210;
      let s = `<svg class="apx-rt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="real-time delivery timeline">`;
      s += `<defs><marker id="apx-rt-ar" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="6" markerHeight="6" orient="auto-start-reverse"><path d="M0,0 L10,5 L0,10 z" class="arh"/></marker></defs>`;
      if (sim.X !== null && now >= sim.X) s += `<rect class="off" x="${sx(sim.X)}" y="${yS - 20}" width="${sx(Math.min(now, sim.X + 4)) - sx(sim.X)}" height="${yC - yS + 40}"/><text class="offt" x="${sx(sim.X) + 4}" y="${yS - 26}">offline</text>`;
      for (let t = 0; t <= 30; t += 5) s += `<line class="grid" x1="${sx(t)}" y1="${yS - 12}" x2="${sx(t)}" y2="${yC + 12}"/><text class="ax" x="${sx(t)}" y="${H - 4}">${t} s</text>`;
      s += `<line class="lane" x1="${x0}" y1="${yS}" x2="${x1}" y2="${yS}"/><line class="lane" x1="${x0}" y1="${yC}" x2="${x1}" y2="${yC}"/><text class="lbl" x="6" y="${yS + 4}">server</text><text class="lbl" x="6" y="${yC + 4}">browser</text>`;
      sim.conns.forEach((c) => { if (now >= c.open) { const e = Math.min(c.close ?? now, now); if (e > c.open) s += `<line class="conn" x1="${sx(c.open)}" y1="${(yS + yC) / 2}" x2="${sx(e)}" y2="${(yS + yC) / 2}"/>`; } });
      if (sim.conns.length && now >= sim.L) s += `<text class="connt" x="${sx(sim.L) + 4}" y="${(yS + yC) / 2 - 6}">one open connection</text>`;
      sim.reqs.forEach((r) => {
        if (r.t0 > now) return;
        s += `<line class="req" x1="${sx(r.t0)}" y1="${yC - 4}" x2="${sx(Math.min(r.ta, now))}" y2="${r.ta <= now ? yS + 4 : yC - 4 - ((now - r.t0) / (r.ta - r.t0)) * (yC - yS - 8)}" marker-end="url(#apx-rt-ar)"/>`;
        if (r.tr > r.ta && now > r.ta) s += `<line class="hold ${r.broken ? "bad" : ""}" x1="${sx(r.ta)}" y1="${yS}" x2="${sx(Math.min(r.tr, now))}" y2="${yS}"/>`;
        if (!r.broken && now >= r.tb) s += `<line class="resp ${r.hs ? "hs" : r.empty ? "empty" : "full"}" x1="${sx(r.tr)}" y1="${yS + 4}" x2="${sx(r.tb)}" y2="${yC - 4}" marker-end="url(#apx-rt-ar)"/>`;
        if (r.broken && now >= r.tr) s += `<text class="x" x="${sx(r.tr)}" y="${yS + 5}">✕</text>`;
      });
      sim.fails.forEach((fl) => { if (fl.t <= now) s += `<text class="x" x="${sx(fl.t)}" y="${yC + 5}">✕</text>`; });
      sim.ev.forEach((e) => {
        if (e.e > now) return;
        s += `<circle class="ev ${e.lost ? "lost" : ""}" cx="${sx(e.e)}" cy="${yS}" r="6"/><text class="evt" x="${sx(e.e)}" y="${yS - 10}">e${e.i + 1}</text>`;
        if (sim.conns.length && e.at !== null && now >= e.at) s += `<line class="push ${e.how}" x1="${sx(e.at - sim.L)}" y1="${yS + 6}" x2="${sx(e.at)}" y2="${yC - 6}" marker-end="url(#apx-rt-ar)"/>`;
        if (e.at !== null && now >= e.at) s += `<circle class="got" cx="${sx(e.at)}" cy="${yC}" r="5"/><text class="evt" x="${sx(e.at)}" y="${yC + 20}">e${e.i + 1}</text>`;
        if (e.lost) s += `<text class="x" x="${sx(e.e)}" y="${yS + 22}">lost</text>`;
      });
      s += `<line class="now" x1="${sx(Math.min(now, 31))}" y1="${yS - 16}" x2="${sx(Math.min(now, 31))}" y2="${yC + 12}"/></svg>`;
      const v = f.vars;
      return col(`<div class="apx-fit">${s}</div>`, stats([["HTTP requests", String(v.requests)], ["overhead", f.final ? `≈${sim.bytes.toLocaleString("en-US")} B` : "at the end"], ["delivered", v.delivered, "done"], ["avg latency", v["avg latency"]], ["lost", String(v.lost), v.lost ? "bad" : ""]]));
    },
  }));

  /* =====================================================================
   * 8. Webhooks: HMAC signatures, retries, idempotency
   * ===================================================================== */
  const SHA_K = [0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5, 0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
    0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da, 0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
    0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85, 0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
    0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3, 0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2];
  function sha256(msg) {
    const m = msg.slice(), bl = msg.length * 8; m.push(0x80);
    while (m.length % 64 !== 56) m.push(0);
    for (let i = 7; i >= 0; i--) m.push(Math.floor(bl / 2 ** (8 * i)) & 0xff);
    const H = [0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a, 0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19], w = new Array(64);
    const r = (x, n) => (x >>> n) | (x << (32 - n));
    for (let o = 0; o < m.length; o += 64) {
      for (let i = 0; i < 16; i++) w[i] = ((m[o + 4 * i] << 24) | (m[o + 4 * i + 1] << 16) | (m[o + 4 * i + 2] << 8) | m[o + 4 * i + 3]) >>> 0;
      for (let i = 16; i < 64; i++) { const a = w[i - 15], b = w[i - 2]; w[i] = (w[i - 16] + (r(a, 7) ^ r(a, 18) ^ (a >>> 3)) + w[i - 7] + (r(b, 17) ^ r(b, 19) ^ (b >>> 10))) >>> 0; }
      let [a, b, c, d, e, f, g, h] = H;
      for (let i = 0; i < 64; i++) {
        const t1 = (h + (r(e, 6) ^ r(e, 11) ^ r(e, 25)) + ((e & f) ^ (~e & g)) + SHA_K[i] + w[i]) >>> 0;
        const t2 = ((r(a, 2) ^ r(a, 13) ^ r(a, 22)) + ((a & b) ^ (a & c) ^ (b & c))) >>> 0;
        h = g; g = f; f = e; e = (d + t1) >>> 0; d = c; c = b; b = a; a = (t1 + t2) >>> 0;
      }
      [a, b, c, d, e, f, g, h].forEach((v, i) => (H[i] = (H[i] + v) >>> 0));
    }
    return H.flatMap((x) => [x >>> 24, (x >>> 16) & 255, (x >>> 8) & 255, x & 255]);
  }
  const hmacHex = (key, msg) => {
    let k = utf8(key); if (k.length > 64) k = sha256(k);
    while (k.length < 64) k.push(0);
    return sha256([...k.map((b) => b ^ 0x5c), ...sha256([...k.map((b) => b ^ 0x36), ...utf8(msg)])]).map(hex2).join("");
  };
  const WH_SCEN = ["delivered first try", "receiver down, then recovers", "slow receiver → timeout → duplicate", "body tampered in transit", "old request replayed by an attacker"];
  Viz.register("api-protocols-webhook", (el) => Viz.player(el, {
    title: "Webhooks: sign, verify, retry, deduplicate",
    legend: [["path", "HTTP request with signature headers"], ["done", "check passed / 2xx"], ["bad", "check failed / error / duplicate side effect"], ["visit", "provider waiting to retry"]],
    codeLang: "python",
    code: [
      "def receive(req):",
      "    t, sig = parse(req.headers['Webhook-Signature'])   # 't=..,v1=..'",
      "    if abs(now() - t) > 300: return 400                # stale: replay?",
      "    expected = hmac_sha256(SECRET, f'{t}.{req.raw_body}')",
      "    if not compare_digest(expected, sig): return 400   # forged/tampered",
      "    if seen(req.headers['Webhook-Id']): return 200     # duplicate delivery",
      "    remember(req.headers['Webhook-Id'])",
      "    queue.enqueue(req.raw_body)                        # do the work later",
      "    return 200                                         # ack fast",
    ],
    inputs: [
      { key: "scen", label: "scenario", type: "select", options: WH_SCEN, value: WH_SCEN[2] },
      { key: "dedupe", label: "receiver dedupes by Webhook-Id", type: "select", options: ["yes", "no"], value: "no" },
      { key: "secret", label: "shared secret", value: "whsec_demo_42", width: 130 },
    ],
    random: () => ({ scen: pick(WH_SCEN), dedupe: pick(["yes", "no"]), secret: pick(["whsec_demo_42", "s3cr3t-key", "another-secret-value"]) }),
    build: ({ scen, dedupe, secret }) => {
      const si = WH_SCEN.indexOf(scen); if (si < 0) throw new Error("Pick a scenario.");
      if (!["yes", "no"].includes(dedupe)) throw new Error("Pick yes or no.");
      const sec = String(secret ?? "");
      if (sec.length < 8 || sec.length > 40 || /[^\x21-\x7e]/.test(sec)) throw new Error("shared secret: 8–40 visible ASCII characters.");
      const dd = dedupe === "yes", T0 = 1700000000;
      const body = '{"id":"evt_123","type":"order.paid","order":42}';
      const msgs = [], fr = [], seen = new Set();
      let shipped = 0, checks = [];
      const short = (h) => h.slice(0, 16) + "…";
      const push = (note, line, extra = {}) => fr.push({ msgs: msgs.map((m) => ({ ...m })), checks: checks.slice(), seen: [...seen], shipped, note, line, vars: { "orders shipped": shipped, "seen ids": seen.size }, ...extra });
      push(`The provider (say, a payment service) must tell your shop that <code>order 42</code> was paid. It POSTs JSON to your URL and signs it with a secret you both know: <code>HMAC-SHA256(secret, "&lt;timestamp&gt;.&lt;raw body&gt;")</code>. Scenario: <b>${esc(scen)}</b>; dedupe ${dd ? "on" : "off"}.`, []);
      const attempt = (k, at, opts = {}) => {
        const t = opts.t ?? at, sig = hmacHex(sec, `${t}.${body}`), recvBody = opts.tamper ? body.replace('"order":42', '"order":43') : body;
        checks = [];
        msgs.push({ from: "p", to: "r", label: `POST /webhooks  #${k}  Webhook-Id: evt_123  t=${t}  v1=${short(sig)}`, cls: "path" });
        push(`${opts.attacker ? `<b>An attacker</b> who captured attempt 1 (from a log, a proxy, a leaked HAR file) sends the exact same bytes again, ${at - T0} s later. The signature is genuine.` : `Attempt ${k} at t=${t}${k > 1 ? " (a retry is <b>re-signed</b> with a fresh timestamp)" : ""}. The signature is <code>${short(sig)}</code>.`}${opts.tamper ? " On the way, something changes the body: <code>\"order\":42</code> becomes <code>\"order\":43</code>." : ""}`, [0]);
        if (opts.down) {
          msgs.push({ from: "r", to: "p", label: "503 Service Unavailable", cls: "bad" });
          push(`Your service is down (deploy, outage). The load balancer answers <b>503</b>. The provider will retry with exponential backoff; it keeps the event, so nothing is lost as long as you come back before it gives up (often ~3 days).`, []);
          return;
        }
        const age = at - t;
        checks.push(["parse Webhook-Signature", `t=${t}, v1=${short(sig)}`, "done"]);
        checks.push(["timestamp age ≤ 300 s", `${age} s`, age <= 300 ? "done" : "bad"]);
        if (age > 300) { push(`The timestamp is <b>${age} s</b> old. Anything outside the 5-minute tolerance is rejected, so a captured request can't be replayed later. (The timestamp is inside the signed string, so the attacker can't refresh it without the secret.)`, [1, 2]); msgs.push({ from: "r", to: "p", label: "400 stale timestamp", cls: "bad" }); push("Rejected before any business logic ran.", [2]); return; }
        push(`Timestamp age ${age} s: within tolerance.`, [1, 2]);
        const exp = hmacHex(sec, `${t}.${recvBody}`);
        checks.push(["HMAC over the raw body", short(exp), exp === sig ? "done" : "bad"]);
        if (exp !== sig) { push(`The receiver recomputes the HMAC over the body <b>it received</b>: <code>${short(exp)}</code> ≠ <code>${short(sig)}</code>. One changed byte changes the whole hash, and without the secret nobody can compute a matching one. Compare with a <b>constant-time</b> function so timing doesn't leak how many characters matched.`, [3, 4]); msgs.push({ from: "r", to: "p", label: "400 bad signature", cls: "bad" }); push("Rejected: the order is not touched.", [4]); return; }
        push(`The receiver recomputes <code>HMAC(secret, "${t}." + raw body)</code> = <code>${short(exp)}</code>. It matches, so the request really came from the provider and the body wasn't modified. Verify the <b>raw bytes</b>: re-serialized JSON may differ in spacing or key order.`, [3, 4]);
        const dup = seen.has("evt_123");
        checks.push(["Webhook-Id already processed?", dd ? (dup ? "yes: skip" : "no") : "not checked", dup ? (dd ? "done" : "bad") : "done"]);
        if (dd && dup) { push(`<code>evt_123</code> is already in the processed-ids store, so this is a duplicate delivery. Return <b>200</b> (so the provider stops retrying) and do nothing.`, [5]); msgs.push({ from: "r", to: "p", label: "200 OK (duplicate ignored)", cls: "done" }); push(`Shipped count stays at ${shipped}. At-least-once delivery + idempotent receiver = effectively once.`, [5]); return; }
        seen.add("evt_123"); shipped++;
        push(dup ? `<b>No dedupe check</b>, so the receiver processes evt_123 again: the order ships a <b>second time</b>. Webhooks are <i>at-least-once</i>; duplicates are normal, not a bug in the provider.` : `New event id: remember it, then process it. Order 42 ships (count ${shipped}).`, dup ? [7] : [6, 7]);
        if (opts.slow) {
          msgs.push({ from: "p", to: "p", label: "10 s timeout: no response, mark attempt failed", cls: "bad" });
          push(`Processing happens <i>inside</i> the request and takes 12 s. The provider's timeout is 10 s, so from its side the attempt <b>failed</b>, and it schedules a retry. Your work still completes, and its 200 goes nowhere.`, [7, 8]);
          return;
        }
        msgs.push({ from: "r", to: "p", label: "200 OK", cls: "done" });
        push("Acknowledged. The provider marks the event delivered.", [8]);
      };
      if (si === 0) attempt(1, T0);
      if (si === 1) { attempt(1, T0, { down: true }); msgs.push({ from: "p", to: "p", label: "back off 30 s", cls: "visit" }); attempt(2, T0 + 30, { down: true }); msgs.push({ from: "p", to: "p", label: "back off 120 s", cls: "visit" }); attempt(3, T0 + 150); }
      if (si === 2) { attempt(1, T0, { slow: true }); msgs.push({ from: "p", to: "p", label: "back off 30 s, then retry the same event", cls: "visit" }); attempt(2, T0 + 40); }
      if (si === 3) attempt(1, T0, { tamper: true });
      if (si === 4) { attempt(1, T0); attempt(2, T0 + 7200, { t: T0, attacker: true }); }
      const good = shipped === 1 || (si === 3 && shipped === 0);
      fr.push({ ...fr[fr.length - 1], final: true, line: [], note: `${good ? "<b>Correct outcome</b>" : "<b>Wrong outcome</b>"}: order 42 shipped <b>${shipped}</b> time${shipped === 1 ? "" : "s"}. ${si === 2 ? (dd ? "Dedupe by event id made the retry harmless. Better still: enqueue and return 200 within a second or two, so the timeout never fires." : "Fix both halves: dedupe by <code>Webhook-Id</code>, and acknowledge quickly then process asynchronously.") : si === 3 ? "The signature check stopped the forged change." : si === 4 ? "The timestamp tolerance stopped the replay; dedupe would have caught it too." : si === 1 ? "Retries with backoff delivered the event once the receiver came back." : "The happy path: verify, remember, enqueue, ack."}` });
      return fr;
    },
    render: (f) => {
      const lanes = [{ id: "p", label: "Provider", sub: "sends + retries" }, { id: "r", label: "Your receiver", sub: "POST /webhooks" }];
      return col(seq(lanes, f.msgs, { width: 760, max: 10, label: "webhook delivery attempts" }), panels(kv("receiver checks (latest attempt)", f.checks, { empty: "no checks yet" }), kv("receiver state", [["processed ids", f.seen.join(", ") || "none"], ["order 42 shipped", `${f.shipped}×`, f.shipped > 1 ? "bad" : f.shipped === 1 ? "done" : ""]])), f.final ? verdict(`shipped ${f.shipped}×`, f.shipped > 1 ? "bad" : "done") : "");
    },
  }));

  /* =====================================================================
   * 9. Serialization formats byte by byte
   * ===================================================================== */
  const zz = (n) => varint(n >= 0 ? 2 * n : -2 * n - 1);
  const mpInt = (n) => (n < 128 ? [n] : n < 256 ? [0xcc, n] : n < 65536 ? [0xcd, n >> 8, n & 255] : [0xce, (n >>> 24) & 255, (n >> 16) & 255, (n >> 8) & 255, n & 255]);
  const mpStr = (s) => { const b = utf8(s); return [...(b.length < 32 ? [0xa0 | b.length] : b.length < 256 ? [0xd9, b.length] : [0xda, b.length >> 8, b.length & 255]), ...b]; };
  function serializeAll(p) {
    const F = [["id", p.id], ["name", p.name], ["tags", p.tags], ["price_cents", p.price], ["active", p.active]];
    const out = { JSON: [], MessagePack: [], Protobuf: [], Avro: [] };
    const seg = (fmt, field, s, v) => out[fmt].push({ field, s, v });
    // JSON
    seg("JSON", null, utf8("{"), []);
    F.forEach(([k, v], i) => seg("JSON", k, utf8(`${i ? "," : ""}"${k}":`), utf8(JSON.stringify(v))));
    seg("JSON", null, utf8("}"), []);
    // MessagePack
    seg("MessagePack", null, [0x80 | F.length], []);
    F.forEach(([k, v]) => {
      const key = mpStr(k);
      if (k === "tags") seg("MessagePack", k, [...key, v.length < 16 ? 0x90 | v.length : 0xdc], v.flatMap(mpStr));
      else if (k === "active") seg("MessagePack", k, key, [v ? 0xc3 : 0xc2]);
      else if (k === "name") { const s = mpStr(v), h = s.length - utf8(v).length; seg("MessagePack", k, [...key, ...s.slice(0, h)], s.slice(h)); }
      else { const b = mpInt(v); seg("MessagePack", k, b.length > 1 ? [...key, b[0]] : key, b.length > 1 ? b.slice(1) : b); }
    });
    // Protobuf
    F.forEach(([k, v], i) => {
      const n = i + 1;
      if (k === "name") { if (v !== "") { const b = utf8(v); seg("Protobuf", k, [...varint((n << 3) | 2), ...varint(b.length)], b); } }
      else if (k === "tags") v.forEach((t) => { const b = utf8(t); seg("Protobuf", k, [...varint((n << 3) | 2), ...varint(b.length)], b); });
      else if (k === "active") { if (v) seg("Protobuf", k, varint(n << 3), [1]); }
      else if (v !== 0) seg("Protobuf", k, varint(n << 3), varint(v));
    });
    // Avro (schema-ordered, no names, no tags)
    seg("Avro", "id", [], zz(p.id));
    { const b = utf8(p.name); seg("Avro", "name", zz(b.length), b); }
    if (p.tags.length) seg("Avro", "tags", zz(p.tags.length), p.tags.flatMap((t) => { const b = utf8(t); return [...zz(b.length), ...b]; }));
    seg("Avro", "tags", [0], []);
    seg("Avro", "price_cents", [], zz(p.price));
    seg("Avro", "active", [], [p.active ? 1 : 0]);
    return out;
  }
  const FMT_NOTE = {
    JSON: "self-describing text: every key name, quote and digit is a byte",
    MessagePack: "binary JSON: same map shape with key names, but compact type prefixes",
    Protobuf: "field numbers instead of names; defaults are omitted",
    Avro: "no names and no tags at all: the reader must have the writer's schema",
  };
  Viz.register("api-protocols-serialize", (el) => Viz.player(el, {
    title: "One object, four encodings: where the bytes go",
    legend: [["path", "structure: names, tags, type and length prefixes, punctuation"], ["visit", "the actual values"], ["active", "field being encoded now"]],
    codeLang: "protobuf",
    code: [
      "message Product {            // Avro record has the same fields, in this order",
      "  int64  id          = 1;",
      "  string name        = 2;",
      "  repeated string tags = 3;",
      "  int32  price_cents = 4;",
      "  bool   active      = 5;",
      "}",
    ],
    inputs: [
      { key: "id", label: "id", value: "42", width: 70 },
      { key: "name", label: "name", value: "Mug", width: 100 },
      { key: "tags", label: "tags", value: "kitchen, gift", width: 120 },
      { key: "price", label: "price_cents", value: "1299", width: 80 },
      { key: "active", label: "active", type: "select", options: ["true", "false"], value: "true" },
    ],
    random: () => ({ id: String(pick([0, 7, 42, 300, 99999])), name: pick(["Mug", "Teapot", "Ceramic travel mug", ""]), tags: pick(["kitchen, gift", "", "a", "kitchen, gift, sale, new"]), price: String(pick([0, 99, 1299, 250000])), active: pick(["true", "false"]) }),
    build: ({ id, name, tags, price, active }) => {
      const p = { id: int(id, "id", 0, 1000000000), name: String(name ?? ""), tags: String(tags ?? "").split(",").map((t) => t.trim()).filter(Boolean), price: int(price, "price_cents", 0, 10000000), active: active === "true" };
      if (p.name.length > 24) throw new Error("name: 24 characters at most.");
      if (p.tags.length > 5 || p.tags.some((t) => t.length > 12)) throw new Error("tags: up to 5 tags of at most 12 characters.");
      const all = serializeAll(p);
      const fields = ["id", "name", "tags", "price_cents", "active"];
      const fr = [];
      const sizeUpTo = (fmt, k) => all[fmt].filter((sg) => sg.field === null ? k >= (sg === all[fmt][0] ? 0 : 5) : fields.indexOf(sg.field) < k).reduce((a, sg) => a + sg.s.length + sg.v.length, 0);
      const mk = (k, note, line) => fr.push({ all, k, p, note, line, vars: Object.fromEntries(Object.keys(all).map((fm) => [fm, sizeUpTo(fm, k) + " B"])) });
      mk(0, `The same <code>Product</code> encoded four ways. Watch how many bytes go to <b>structure</b> (names, tags, lengths, punctuation) versus <b>values</b>. JSON and MessagePack carry key names in every message; Protobuf carries small field numbers; Avro carries nothing but values, in schema order.`, 0);
      fields.forEach((fld, i) => {
        const per = Object.fromEntries(Object.keys(all).map((fm) => [fm, all[fm].filter((sg) => sg.field === fld).reduce((a, sg) => a + sg.s.length + sg.v.length, 0)]));
        const v = fld === "price_cents" ? p.price : p[fld];
        const extra = fld === "id" || fld === "price_cents" ? ` Numbers: JSON spends one byte per digit; the binary formats use varints (Avro zigzag-encodes them, so ${v} becomes ${zz(v).length} byte${zz(v).length > 1 ? "s" : ""}).` : fld === "name" ? " Strings cost their UTF-8 bytes everywhere; the difference is only in the prefix." : fld === "tags" ? ` Protobuf repeats the tag for each element; MessagePack and Avro write a count once${p.tags.length ? "" : ". Empty list: Protobuf writes nothing at all"}.` : " Booleans: a single byte in binary formats, 4–5 characters in JSON." + (p.active ? "" : " Protobuf omits false entirely (it's the default).");
        mk(i + 1, `<code>${fld}</code> = ${esc(JSON.stringify(v))}: JSON +${per.JSON} B, MessagePack +${per.MessagePack} B, Protobuf +${per.Protobuf} B, Avro +${per.Avro} B.${extra}`, i + 1);
      });
      const sizes = Object.fromEntries(Object.keys(all).map((fm) => [fm, all[fm].reduce((a, sg) => a + sg.s.length + sg.v.length, 0)]));
      fr.push({ ...fr[fr.length - 1], k: 6, final: true, sizes, line: [], vars: Object.fromEntries(Object.entries(sizes).map(([a, b]) => [a, b + " B"])), note: `Totals: JSON ${sizes.JSON} B, MessagePack ${sizes.MessagePack} B, Protobuf ${sizes.Protobuf} B, Avro ${sizes.Avro} B. Size is only half the story: binary formats also parse faster (no number-from-text conversion, lengths let the parser skip). JSON wins on debuggability and universality; gzip narrows the size gap for large text payloads.` });
      return fr;
    },
    render: (f) => {
      const fields = ["id", "name", "tags", "price_cents", "active"];
      const cur = f.final ? null : fields[f.k - 1];
      const shown = (sg, fm) => f.final || (sg.field === null ? (sg === f.all[fm][0] || f.k >= 5) : fields.indexOf(sg.field) < f.k);
      const rows = Object.keys(f.all).map((fm) => {
        const segs = f.all[fm].filter((sg) => shown(sg, fm));
        const n = segs.reduce((a, sg) => a + sg.s.length + sg.v.length, 0);
        const cell = (b, c) => (fm === "JSON" ? `<span class="b ${c} ch">${esc(String.fromCharCode(b))}</span>` : `<span class="b ${c}">${hex2(b)}</span>`);
        const body = segs.map((sg) => `<span class="seg ${sg.field && sg.field === cur ? "cur" : ""}">${sg.s.map((b) => cell(b, "path")).join("")}${sg.v.map((b) => cell(b, "visit")).join("")}</span>`).join("");
        return `<div class="apx-fmt"><div class="h"><b>${fm}</b> <span>${n} B</span><small>${esc(FMT_NOTE[fm])}</small></div><div class="bytes">${body || '<span class="apx-muted">nothing yet</span>'}</div></div>`;
      }).join("");
      let bars = "";
      if (f.final) {
        const mx = Math.max(...Object.values(f.sizes));
        bars = `<div class="apx-bars">${Object.entries(f.sizes).map(([fm, n]) => `<div class="r"><span>${fm}</span><div class="track"><div class="fill" style="width:${((n / mx) * 100).toFixed(1)}%"></div></div><b>${n} B</b></div>`).join("")}</div>`;
      }
      return col(rows, bars);
    },
  }));

  /* =====================================================================
   * 10. Which protocol when: elimination + scoring
   * ===================================================================== */
  const CANDS = ["REST", "GraphQL", "gRPC", "WebSockets", "SSE", "Webhooks", "Messaging"];
  const DQ = [
    { key: "who", label: "who calls it", opts: {
      "public / third-party developers": { d: { REST: 3, GraphQL: 1, SSE: 1, Webhooks: 1, gRPC: -2, Messaging: -3 }, why: "Outsiders need something every language and tool speaks, cacheable and easy to try with curl. gRPC needs codegen and HTTP/2 end to end; brokers aren't exposed publicly." },
      "your own web or mobile UI": { d: { REST: 2, GraphQL: 2, WebSockets: 1, SSE: 1, gRPC: -2, Webhooks: "x", Messaging: "x" }, why: "Browsers can't receive webhooks or connect to a broker, and can't speak native gRPC (only grpc-web/Connect through a proxy)." },
      "internal services": { d: { gRPC: 3, REST: 2, Messaging: 2, GraphQL: -1, WebSockets: -1, SSE: -1, Webhooks: -1 }, why: "You control both ends: typed contracts and codegen pay off, and async messaging decouples teams." },
    } },
    { key: "flow", label: "interaction", opts: {
      "request / response": { d: { REST: 2, GraphQL: 2, gRPC: 2, SSE: "x", Webhooks: "x", WebSockets: -3, Messaging: -2 }, why: "Plain request/response: a persistent socket or a broker only adds moving parts." },
      "server pushes updates": { d: { SSE: 4, WebSockets: 2, gRPC: 2, Webhooks: 2, Messaging: 2, GraphQL: 1, REST: -2 }, why: "One-way push: SSE is plain HTTP with built-in resume; gRPC server streaming internally; webhooks for server-to-server; GraphQL has subscriptions." },
      "both sides stream": { d: { WebSockets: 4, gRPC: 4, REST: "x", SSE: "x", Webhooks: "x", GraphQL: -1 }, why: "Both directions at any time: only WebSockets and gRPC bidi streaming do that natively." },
      "react to events later (async)": { d: { Messaging: 4, Webhooks: 3, GraphQL: "x", REST: -1, gRPC: -1, WebSockets: -2, SSE: -2 }, why: "The producer shouldn't wait for, or even know, the consumers: that's a broker (internal) or webhooks (external)." },
    } },
    { key: "data", label: "data shape", opts: {
      "stable resources": { d: { GraphQL: -2, REST: 1, gRPC: 1 }, why: "Stable, resource-shaped data fits REST/gRPC; GraphQL's flexibility would be unused complexity." },
      "many clients need different shapes": { d: { GraphQL: 4, REST: -1 }, why: "Different screens want different fields from a graph of related data: GraphQL lets each ask for exactly that in one round trip." },
    } },
    { key: "perf", label: "performance", opts: {
      "normal": { d: {}, why: "Normal performance needs don't move the needle: any of these is fast enough." },
      "high throughput / low latency": { d: { gRPC: 2, WebSockets: 1, Messaging: 1, REST: -1, GraphQL: -1 }, why: "Binary protobuf over multiplexed HTTP/2 and persistent sockets cut per-call overhead; brokers absorb bursts." },
    } },
  ];
  const WHY_WIN = {
    REST: "Resource-oriented HTTP + JSON: universal, cacheable, debuggable. Design it well (see API design).",
    GraphQL: "One endpoint, client-shaped queries. Budget for DataLoader, cost limits and persisted queries.",
    gRPC: "Typed contracts, codegen, streaming and deadlines. Use grpc-web/Connect or transcoding if a browser needs it.",
    WebSockets: "Full-duplex, low overhead. Plan reconnect, resume and a backplane to scale out (SignalR / Socket.IO help).",
    SSE: "Server push over plain HTTP with automatic reconnect and Last-Event-ID resume.",
    Webhooks: "Push events to other companies' HTTP endpoints. Sign them, retry them, and make receivers idempotent.",
    Messaging: "A broker (Kafka, RabbitMQ, Service Bus) decouples producers from consumers. Document it with AsyncAPI.",
  };
  Viz.register("api-protocols-decide", (el) => Viz.player(el, {
    title: "Which protocol? Answer four questions",
    legend: [["done", "score went up"], ["bad", "eliminated or score went down"], ["active", "current leader"]],
    inputs: DQ.map((q) => ({ key: q.key, label: q.label, type: "select", options: Object.keys(q.opts), value: Object.keys(q.opts)[q.key === "flow" ? 1 : q.key === "who" ? 1 : 0] })),
    random: () => Object.fromEntries(DQ.map((q) => [q.key, pick(Object.keys(q.opts))])),
    build: (vals) => {
      const score = Object.fromEntries(CANDS.map((c) => [c, 0])), out = new Set(), fr = [];
      const lead = () => CANDS.filter((c) => !out.has(c)).sort((a, b) => score[b] - score[a])[0];
      fr.push({ score: { ...score }, out: [], delta: {}, note: "Seven candidates start level. Each answer adds or subtracts points, and some answers rule a candidate out entirely. This encodes rules of thumb, not laws: read the reasons.", vars: { candidates: CANDS.length } });
      for (const q of DQ) {
        const opt = q.opts[vals[q.key]]; if (!opt) throw new Error(`Pick an answer for "${q.label}".`);
        const delta = {};
        for (const [c, v] of Object.entries(opt.d)) { if (out.has(c)) continue; if (v === "x") { out.add(c); delta[c] = "x"; } else { score[c] += v; delta[c] = v; } }
        const gone = Object.keys(delta).filter((c) => delta[c] === "x");
        fr.push({ score: { ...score }, out: [...out], delta, q: q.label, a: vals[q.key], lead: lead(), note: `<b>${esc(q.label)}: ${esc(vals[q.key])}.</b> ${esc(opt.why)}${gone.length ? ` Ruled out: ${gone.join(", ")}.` : ""}`, vars: { left: CANDS.length - out.size, leader: lead() } });
      }
      const ranked = CANDS.filter((c) => !out.has(c)).sort((a, b) => score[b] - score[a]);
      const top = ranked[0], second = ranked[1];
      fr.push({ score: { ...score }, out: [...out], delta: {}, lead: top, final: true, ranked, note: `<b>Pick ${top}</b>${second && score[second] >= score[top] - 2 ? `, with <b>${second}</b> a close second (${score[second]} vs ${score[top]})` : ""}. ${WHY_WIN[top]} Real systems often combine them: REST for the public API, gRPC between services, a broker for events, SSE for the live UI.`, vars: { pick: top } });
      return fr;
    },
    render: (f) => {
      const mx = Math.max(1, ...Object.values(f.score).map(Math.abs));
      const rows = CANDS.map((c) => {
        const o = f.out.includes(c), d = f.delta[c], sc = f.score[c];
        const cls = o ? "bad out" : c === f.lead ? "active" : "";
        const dl = d === undefined ? "" : d === "x" ? `<span class="bad">ruled out</span>` : `<span class="${d > 0 ? "done" : "bad"}">${d > 0 ? "+" : ""}${d}</span>`;
        return `<tr class="${cls}"><td>${c}</td><td class="barc"><div class="bar ${sc < 0 ? "neg" : ""}" style="width:${o ? 0 : ((Math.abs(sc) / mx) * 100).toFixed(1)}%"></div></td><td>${o ? "-" : sc}</td><td>${dl}</td></tr>`;
      }).join("");
      return col(`<table class="apx-mini apx-dec"><tr><th>candidate</th><th colspan="2">score</th><th>${f.q ? esc(f.q) : "change"}</th></tr>${rows}</table>`, f.final ? verdict(`Pick ${f.lead}: ${esc(WHY_WIN[f.lead])}`, "done") : "");
    },
  }));
})();
