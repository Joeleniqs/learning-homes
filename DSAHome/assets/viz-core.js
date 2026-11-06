/* Viz: a tiny offline step-through visualizer framework shared by every topic.
 * Keep DSAHome and CodeExcellenceHome copies identical.
 *
 *   Viz.register("name", (host, opts) => Viz.player(host, { ...config }));
 *   Markdown: <div class="viz" data-viz="name" data-opts='{"n":5}'></div>
 *
 * Player config:
 *   title, tag, legend: [["active","current"],...], code: [lines], codeLang,
 *   inputs: [{key,label,value,type:"text"|"number"|"select",options:[...] ,width}],
 *   build(inputs) -> frames   (throw new Error("message") for invalid input)
 *   frames: [...]             (static alternative to build)
 *   render(frame, ctx) -> HTML string (use the Viz.* renderers below)
 *   random() -> inputs object (adds a "Randomize" button), speed (ms per step)
 * Frame fields: note (HTML narration), line (index or [indexes] into code), vars {name: value}, plus your own state.
 */
(() => {
  const registry = new Map();
  const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const clsOf = (spec, ...args) => (typeof spec === "function" ? spec(...args) : spec && spec[args[0]]) || "";
  const fmtVal = (v) => (v === Infinity ? "∞" : v === -Infinity ? "-∞" : v === null || v === undefined ? "·" : Array.isArray(v) ? `[${v.map(fmtVal).join(", ")}]` : typeof v === "object" ? JSON.stringify(v) : String(v));

  /* ---------- Renderers (return HTML strings) ---------- */
  function array(values, o = {}) {
    const ptrs = {}, ptrsTop = {};
    for (const [name, idx] of Object.entries(o.ptrs || {})) if (idx !== null && idx !== undefined && idx >= -1 && idx <= values.length) (ptrs[idx] ||= []).push(name);
    for (const [name, idx] of Object.entries(o.ptrsTop || {})) if (idx !== null && idx !== undefined) (ptrsTop[idx] ||= []).push(name);
    const [wl, wr] = o.window || [1, 0];
    const cols = values.map((v, i) => {
      let c = clsOf(o.cls, i, v);
      if (!c && i >= wl && i <= wr) c = "window";
      return `<div class="v-col" style="display:flex;flex-direction:column;align-items:center;gap:3px">
        ${o.ptrsTop ? `<span class="v-ptr-under">${esc((ptrsTop[i] || []).join(","))}${ptrsTop[i] ? "↓" : ""}</span>` : ""}
        <div class="v-cell ${c}">${esc(o.fmt ? o.fmt(v, i) : fmtVal(v))}</div>
        ${o.showIdx === false ? "" : `<span class="v-idx-1" style="font:10.5px Consolas,monospace;color:var(--muted)">${o.idxLabel ? esc(o.idxLabel(i)) : i}</span>`}
        <span class="v-ptr-under">${ptrs[i] ? "↑" + esc(ptrs[i].join(",")) : ""}</span></div>`;
    }).join("");
    const outside = Object.entries(o.ptrs || {}).filter(([, i]) => i === values.length).map(([n]) => n);
    const tail = outside.length ? `<div class="v-col" style="display:flex;flex-direction:column;align-items:center;gap:3px;opacity:.7"><div class="v-cell dim" style="border-style:dashed">∅</div><span style="font-size:10.5px">${values.length}</span></div>` : "";
    return `<div class="v-array">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<div class="v-cells">${cols}${tail}</div></div>`;
  }

  function grid(matrix, o = {}) {
    const cols = Math.max(0, ...matrix.map((r) => r.length));
    let head = "";
    if (o.colLabels) head = `<tr><th>${esc(o.corner || "")}</th>${o.colLabels.map((l) => `<th>${esc(l)}</th>`).join("")}</tr>`;
    const body = matrix.map((row, r) => {
      const cells = Array.from({ length: cols }, (_, c) => {
        const v = row[c];
        const cl = (typeof o.cls === "function" ? o.cls(r, c, v) : o.cls && o.cls[`${r},${c}`]) || "";
        const text = o.fmt ? o.fmt(v, r, c) : v === undefined || v === null || v === "" ? "" : fmtVal(v);
        return `<td class="v-gcell ${cl} ${text === "" ? "empty" : ""}">${esc(text)}</td>`;
      }).join("");
      return `<tr>${o.rowLabels ? `<th>${esc(o.rowLabels[r] ?? "")}</th>` : o.colLabels ? "<th></th>" : ""}${cells}</tr>`;
    }).join("");
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<table class="v-grid">${head}${body}</table></div>`;
  }

  function bars(values, o = {}) {
    const max = Math.max(1, ...values.map((v) => Math.abs(v)));
    const h = o.height || 170;
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<div class="v-bars" style="height:${h + 4}px;margin-bottom:22px">${values
      .map((v, i) => `<div class="v-bar ${clsOf(o.cls, i, v)}" style="height:${Math.max(4, (Math.abs(v) / max) * h)}px"><span>${esc(v)}</span></div>`)
      .join("")}</div></div>`;
  }

  const itemHtml = (v, i, o) => `<div class="v-item ${clsOf(o.cls, i, v)}">${esc(o.fmt ? o.fmt(v, i) : fmtVal(v))}</div>`;
  function stack(items, o = {}) {
    return `<div class="v-labeled"><span class="v-caption">${esc(o.label || "stack")} ↓top</span><div class="v-stack">${items.map((v, i) => itemHtml(v, i, o)).join("") || '<span class="muted" style="font-size:11px;text-align:center;color:var(--muted)">empty</span>'}</div></div>`;
  }
  function queue(items, o = {}) {
    return `<div class="v-labeled"><span class="v-caption">${esc(o.label || "queue")} (front → back)</span><div class="v-queue">${items.map((v, i) => itemHtml(v, i, o)).join("") || '<span style="font-size:11px;color:var(--muted);padding:8px">empty</span>'}</div></div>`;
  }
  function list(values, o = {}) {
    const ptr = {};
    for (const [n, i] of Object.entries(o.ptrs || {})) if (i !== null && i !== undefined) (ptr[i] ||= []).push(n);
    const parts = values.map((v, i) => `<div style="display:flex;flex-direction:column;align-items:center">${itemHtml(v, i, o)}<span class="v-ptr-under">${ptr[i] ? "↑" + esc(ptr[i].join(",")) : ""}</span></div>${i < values.length - 1 || o.nullEnd !== false ? '<span class="v-arrow">→</span>' : ""}`);
    if (o.nullEnd !== false) parts.push(`<div style="display:flex;flex-direction:column;align-items:center"><div class="v-item dim" style="border-style:dashed">null</div><span class="v-ptr-under">${ptr[values.length] ? "↑" + esc(ptr[values.length].join(",")) : ""}</span></div>`);
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<div class="v-list">${parts.join("")}</div></div>`;
  }

  /* graph: nodes [{id,x,y,label,sub,top}], edges [{u,v,w,directed,cls}] */
  function graph(g, o = {}) {
    const r = o.r || 20;
    const nodes = g.nodes, pos = new Map(nodes.map((n) => [String(n.id), n]));
    const xs = nodes.map((n) => n.x), ys = nodes.map((n) => n.y);
    const pad = r + 22;
    const minX = Math.min(...xs) - pad, minY = Math.min(...ys) - pad - (nodes.some((n) => n.top !== undefined) ? 12 : 0);
    const vw = Math.max(...xs) + pad - minX, vh = Math.max(...ys) + pad - minY + (nodes.some((n) => n.sub !== undefined) ? 12 : 0);
    const directed = !!(o.directed ?? g.directed);
    const ekey = (e) => `${e.u}-${e.v}`;
    const has = new Set(g.edges.map(ekey));
    const edgeCls = (e) => e.cls || clsOf(o.edgeCls, `${e.u}-${e.v}`) || (directed ? "" : clsOf(o.edgeCls, `${e.v}-${e.u}`));
    const edges = g.edges.map((e) => {
      const a = pos.get(String(e.u)), b = pos.get(String(e.v));
      if (!a || !b) return "";
      const c = edgeCls(e);
      const dx = b.x - a.x, dy = b.y - a.y, len = Math.hypot(dx, dy) || 1, ux = dx / len, uy = dy / len;
      const curved = (e.directed ?? directed) && has.has(`${e.v}-${e.u}`);
      const off = curved ? 18 : 0, nx = -uy * off, ny = ux * off;
      const x1 = a.x + ux * r, y1 = a.y + uy * r, x2 = b.x - ux * (r + 2), y2 = b.y - uy * (r + 2);
      const mx = (a.x + b.x) / 2 + nx * 1.4, my = (a.y + b.y) / 2 + ny * 1.4;
      const d = curved ? `M${x1 + nx * .5},${y1 + ny * .5} Q${mx},${my} ${x2 + nx * .5},${y2 + ny * .5}` : `M${x1},${y1} L${x2},${y2}`;
      let head = "";
      if (e.directed ?? directed) {
        const tx = curved ? x2 + nx * .5 : x2, ty = curved ? y2 + ny * .5 : y2;
        const ax = curved ? (tx - mx) : dx, ay = curved ? (ty - my) : dy, al = Math.hypot(ax, ay) || 1, vx = ax / al, vy = ay / al;
        const p1 = `${tx},${ty}`, p2 = `${tx - vx * 11 - vy * 5.5},${ty - vy * 11 + vx * 5.5}`, p3 = `${tx - vx * 11 + vy * 5.5},${ty - vy * 11 - vx * 5.5}`;
        head = `<polygon class="ah ${c}" points="${p1} ${p2} ${p3}"/>`;
      }
      const wt = e.w !== undefined ? `<text class="ew" x="${(a.x + b.x) / 2 + nx * 1.2 - uy * 10}" y="${(a.y + b.y) / 2 + ny * 1.2 + ux * 10}" text-anchor="middle" dominant-baseline="central">${esc(e.w)}</text>` : "";
      return `<path class="e ${c}" d="${d}"/>${head}${wt}`;
    }).join("");
    const ns = nodes.map((n) => {
      const c = clsOf(o.nodeCls, String(n.id)) || n.cls || "";
      return `<g class="n ${c}" transform="translate(${n.x},${n.y})"><circle r="${r}"/><text>${esc(n.label ?? n.id)}</text>${n.sub !== undefined ? `<text class="nl" y="${r + 13}">${esc(fmtVal(n.sub))}</text>` : ""}${n.top !== undefined ? `<text class="nl" y="${-r - 10}">${esc(n.top)}</text>` : ""}</g>`;
    }).join("");
    const scale = o.scale || 1;
    return `<div class="v-labeled">${o.label ? `<span class="v-caption">${esc(o.label)}</span>` : ""}<svg class="v-graph" viewBox="${minX} ${minY} ${vw} ${vh}" width="${vw * scale}" height="${vh * scale}" role="img" aria-label="${esc(o.label || "graph")}">${edges}${ns}</svg></div>`;
  }

  /* Tree from LeetCode level-order array, e.g. [3,9,20,null,null,15,7]. Node id = index in the array. */
  function treeFromArray(arr, o = {}) {
    const nodes = [], edges = [], kids = new Map();
    if (!arr.length || arr[0] === null) return { nodes, edges, children: kids };
    const q = [0]; let i = 1;
    while (q.length && i < arr.length) {
      const p = q.shift(); const ch = [null, null];
      for (let s = 0; s < 2 && i < arr.length; s++, i++) if (arr[i] !== null && arr[i] !== undefined) { ch[s] = i; q.push(i); }
      kids.set(p, ch);
    }
    return layoutTree(0, (id) => kids.get(id) || [null, null], (id) => arr[id], o);
  }
  /* Generic binary/n-ary tree layout. children(id) -> [ids|null], label(id) -> text. */
  function layoutTree(root, children, label = (id) => id, o = {}) {
    const dx = o.dx || 46, dy = o.dy || 64, nodes = [], edges = [];
    let x = 0;
    const walk = (id, depth) => {
      const ch = children(id) || [];
      const binary = ch.length === 2;
      const real = ch.filter((c) => c !== null && c !== undefined);
      if (binary) {
        if (ch[0] !== null && ch[0] !== undefined) walk(ch[0], depth + 1); else if (ch[1] !== null && ch[1] !== undefined) x += 0.5;
        const me = { id, x: x * dx, y: depth * dy, label: label(id) }; nodes.push(me); x += 1;
        if (ch[1] !== null && ch[1] !== undefined) walk(ch[1], depth + 1); else if (ch[0] !== null && ch[0] !== undefined) x += 0.5;
      } else if (!real.length) {
        nodes.push({ id, x: x * dx, y: depth * dy, label: label(id) }); x += 1;
      } else {
        const start = nodes.length; real.forEach((c) => walk(c, depth + 1));
        const kidsN = nodes.slice(start).filter((n) => real.includes(n.id));
        nodes.push({ id, x: (Math.min(...kidsN.map((n) => n.x)) + Math.max(...kidsN.map((n) => n.x))) / 2, y: depth * dy, label: label(id) });
      }
      real.forEach((c) => edges.push({ u: id, v: c }));
    };
    walk(root, 0);
    return { nodes, edges };
  }
  const layout = {
    circle(ids, radius = 120, cx = 0, cy = 0) {
      return ids.map((id, i) => ({ id, x: cx + radius * Math.cos((2 * Math.PI * i) / ids.length - Math.PI / 2), y: cy + radius * Math.sin((2 * Math.PI * i) / ids.length - Math.PI / 2) }));
    },
    gridPoints(rows, cols, gap = 80) {
      const out = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) out.push({ id: `${r},${c}`, x: c * gap, y: r * gap }); return out;
    },
  };
  const row = (...parts) => `<div class="v-row">${parts.filter(Boolean).join("")}</div>`;
  const labeled = (label, inner) => `<div class="v-labeled"><span class="v-caption">${esc(label)}</span>${inner}</div>`;
  const clone = (x) => (typeof structuredClone === "function" ? structuredClone(x) : JSON.parse(JSON.stringify(x)));

  /* ---------- Input parsing helpers ---------- */
  const parse = {
    ints(s, { min = 1, max = 30 } = {}) {
      const a = String(s).split(/[\s,]+/).filter(Boolean).map(Number);
      if (a.some((x) => !Number.isFinite(x))) throw new Error("Use numbers separated by commas.");
      if (a.length < min || a.length > max) throw new Error(`Use between ${min} and ${max} numbers.`);
      return a;
    },
    int(s, { min = -1e9, max = 1e9 } = {}) {
      const n = Number(s);
      if (!Number.isInteger(n) || n < min || n > max) throw new Error(`Use a whole number from ${min} to ${max}.`);
      return n;
    },
    str(s, { min = 1, max = 30 } = {}) {
      s = String(s);
      if (s.length < min || s.length > max) throw new Error(`Use ${min}–${max} characters.`);
      return s;
    },
    matrix(s) { return String(s).split(/;|\n/).map((r) => r.trim()).filter(Boolean).map((r) => r.split(/[\s,]+/).map((x) => (isNaN(Number(x)) ? x : Number(x)))); },
  };
  const rand = (lo, hi) => lo + Math.floor(Math.random() * (hi - lo + 1));
  const randInts = (n, lo, hi) => Array.from({ length: n }, () => rand(lo, hi));

  /* ---------- Player ---------- */
  function player(host, cfg) {
    const hl = (line) => (window.LearningHome && cfg.codeLang ? window.LearningHome.highlight(line, cfg.codeLang) : null) ?? esc(line);
    const legend = cfg.legend || [];
    host.innerHTML = `
      <div class="viz-head"><strong>${esc(cfg.title || "Visualizer")}</strong><span class="viz-tag">${esc(cfg.tag || "INTERACTIVE · STEP THROUGH")}</span></div>
      ${cfg.inputs ? `<form class="viz-inputs">${cfg.inputs.map((inp) => inp.type === "select"
        ? `<label>${esc(inp.label || inp.key)}<select name="${esc(inp.key)}">${inp.options.map((op) => `<option ${op === inp.value ? "selected" : ""}>${esc(op)}</option>`).join("")}</select></label>`
        : `<label>${esc(inp.label || inp.key)}<input name="${esc(inp.key)}" value="${esc(inp.value)}" style="width:${inp.width || Math.max(120, String(inp.value).length * 9 + 24)}px" spellcheck="false"></label>`).join("")}
        <button type="submit">Run</button>${cfg.random ? '<button type="button" class="viz-rand">Randomize</button>' : ""}<span class="viz-error" role="alert"></span></form>` : ""}
      <div class="viz-body ${cfg.code ? "with-code" : ""}"><div class="viz-stage" aria-live="polite"></div>
        ${cfg.code ? `<div class="viz-side"><ol class="viz-code">${cfg.code.map((l) => `<li>${hl(l)}</li>`).join("")}</ol><div class="viz-vars"></div></div>` : ""}</div>
      <div class="viz-note"></div>
      ${legend.length ? `<div class="viz-legend">${legend.map(([c, t]) => `<span class="lg-${esc(c)}">${esc(t)}</span>`).join("")}</div>` : ""}
      <div class="viz-controls"><button type="button" data-a="first" title="First step (Home)">⏮</button><button type="button" data-a="prev" title="Previous (←)">◀</button>
        <button type="button" class="play" data-a="play" title="Play / pause (Space)">▶ Play</button><button type="button" data-a="next" title="Next (→)">▶</button><button type="button" data-a="last" title="Last step (End)">⏭</button>
        <input type="range" min="0" value="0" aria-label="Scrub steps"><select aria-label="Speed"><option value="2">0.5×</option><option value="1" selected>1×</option><option value="0.5">2×</option><option value="0.25">4×</option></select><span class="viz-step"></span></div>`;
    host.tabIndex = 0;
    const $ = (s) => host.querySelector(s);
    const stage = $(".viz-stage"), note = $(".viz-note"), range = $(".viz-controls input"), stepLbl = $(".viz-step"), playBtn = $(".play");
    const codeLis = cfg.code ? [...host.querySelectorAll(".viz-code li")] : [];
    const varsBox = $(".viz-vars"), form = $(".viz-inputs"), err = $(".viz-error");
    let frames = [], i = 0, timer = null, mult = 1;
    const draw = () => {
      const f = frames[i] || {};
      try { stage.innerHTML = cfg.render(f, { index: i, frames }); } catch (e) { stage.innerHTML = `<div class="viz-missing">Render error: ${esc(e.message)}</div>`; console.error(e); }
      note.innerHTML = f.note || "";
      const lines = [].concat(f.line ?? []);
      codeLis.forEach((li, k) => li.classList.toggle("cur", lines.includes(k)));
      if (varsBox) {
        const prev = (frames[i - 1] || {}).vars || {};
        const v = f.vars || {};
        varsBox.innerHTML = Object.keys(v).length ? Object.entries(v).map(([k, val]) => `<span>${esc(k)}</span><span class="${i > 0 && fmtVal(prev[k]) !== fmtVal(val) ? "changed" : ""}">${esc(fmtVal(val))}</span>`).join("") : '<span>vars</span><span>—</span>';
      }
      range.max = Math.max(0, frames.length - 1); range.value = i;
      stepLbl.textContent = `step ${frames.length ? i + 1 : 0} / ${frames.length}`;
    };
    const stop = () => { clearInterval(timer); timer = null; playBtn.textContent = "▶ Play"; };
    const go = (n) => { i = Math.max(0, Math.min(frames.length - 1, n)); draw(); };
    const play = () => {
      if (timer) return stop();
      if (i >= frames.length - 1) i = 0;
      playBtn.textContent = "⏸ Pause";
      timer = setInterval(() => { if (i >= frames.length - 1) return stop(); go(i + 1); }, (cfg.speed || 900) * mult);
    };
    const values = () => (form ? Object.fromEntries(new FormData(form).entries()) : {});
    const rebuild = (vals) => {
      try {
        const out = cfg.build ? cfg.build(vals) : cfg.frames;
        if (!out || !out.length) throw new Error("Nothing to show for this input.");
        frames = out; if (err) err.textContent = ""; stop(); go(0);
      } catch (e) { if (err) err.textContent = e.message; else stage.innerHTML = `<div class="viz-missing">${esc(e.message)}</div>`; console.error(e); }
    };
    host.querySelector(".viz-controls").addEventListener("click", (e) => {
      const a = e.target.closest("button")?.dataset.a; if (!a) return;
      if (a === "play") return play();
      stop();
      ({ first: () => go(0), prev: () => go(i - 1), next: () => go(i + 1), last: () => go(frames.length - 1) })[a]();
    });
    range.addEventListener("input", () => { stop(); go(Number(range.value)); });
    host.querySelector(".viz-controls select").addEventListener("change", (e) => { mult = Number(e.target.value); if (timer) { stop(); play(); } });
    form?.addEventListener("submit", (e) => { e.preventDefault(); rebuild(values()); });
    host.querySelector(".viz-rand")?.addEventListener("click", () => {
      const r = cfg.random();
      for (const [k, v] of Object.entries(r)) { const el = form.elements[k]; if (el) el.value = v; }
      rebuild(values());
    });
    host.addEventListener("keydown", (e) => {
      if (e.target.matches("input, select, textarea")) return;
      const k = { ArrowRight: () => go(i + 1), ArrowLeft: () => go(i - 1), Home: () => go(0), End: () => go(frames.length - 1), " ": play }[e.key];
      if (k) { e.preventDefault(); if (e.key !== " ") stop(); k(); }
    });
    rebuild(values());
    return { go, rebuild, get frames() { return frames; } };
  }

  /* ---------- Bootstrapping ---------- */
  function mount(el) {
    const name = el.dataset.viz;
    const factory = registry.get(name);
    if (!factory) { el.innerHTML = `<div class="viz-missing">Visualizer “${esc(name)}” is not registered. Check the topic's assets/viz script.</div>`; return; }
    let opts = {};
    try { opts = el.dataset.opts ? JSON.parse(el.dataset.opts) : {}; } catch (e) { el.innerHTML = `<div class="viz-missing">Invalid data-opts JSON for “${esc(name)}”.</div>`; return; }
    try { factory(el, opts); } catch (e) { el.innerHTML = `<div class="viz-missing">Visualizer “${esc(name)}” failed: ${esc(e.message)}</div>`; console.error(e); }
    el.dataset.mounted = "1";
  }
  const mountAll = () => document.querySelectorAll(".viz[data-viz]:not([data-mounted])").forEach(mount);
  function register(name, factory) { registry.set(name, factory); if (document.readyState !== "loading") queueMicrotask(mountAll); }
  document.addEventListener("DOMContentLoaded", () => setTimeout(mountAll, 0));
  window.addEventListener("load", mountAll);

  window.Viz = { register, player, array, grid, bars, stack, queue, list, graph, treeFromArray, layoutTree, layout, row, labeled, clone, esc, fmt: fmtVal, parse, rand, randInts };
})();
