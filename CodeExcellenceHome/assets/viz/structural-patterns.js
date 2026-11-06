/* Structural patterns visualizers. Every registered name is prefixed "structural-patterns-". */
(() => {
  const esc = Viz.esc;
  const P = "structural-patterns-";

  /* ---------- shared helpers ---------- */
  const list = (s, label, { min = 1, max = 8, re = /^[a-z][a-z0-9]{0,11}$/ } = {}) => {
    const a = String(s).split(/[\s,]+/).map((x) => x.trim().toLowerCase()).filter(Boolean);
    if (a.length < min || a.length > max) throw new Error(`${label}: use ${min} to ${max} items separated by commas.`);
    for (const x of a) if (!re.test(x)) throw new Error(`${label}: "${x}" is not a valid name (letters and digits, up to 12).`);
    return a;
  };
  const cap = (s) => s[0].toUpperCase() + s.slice(1);
  const kv = (title, rows, o = {}) => `<div class="pt-kv ${o.cls || ""}"><div class="pt-kv-h">${esc(title)}</div>${
    rows.length ? rows.map(([k, v, c]) => `<div class="pt-kv-r ${c || ""}"><span>${esc(k)}</span><span>${esc(v)}</span></div>`).join("")
      : `<div class="pt-kv-r dim"><span>${esc(o.empty || "empty")}</span><span></span></div>`}</div>`;
  const stats = (items) => `<div class="pt-stats">${items.map(([l, v, c]) => `<div class="pt-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const verdict = (text, cls) => `<div class="pt-verdict ${cls || ""}">${esc(text)}</div>`;
  const col = (...p) => `<div class="pt-col">${p.filter(Boolean).join("")}</div>`;
  const panels = (...p) => `<div class="pt-panels">${p.filter(Boolean).join("")}</div>`;

  /* sequence diagram. lanes [{id,label,sub,cls}], msgs [{from,to,label,cls,dash}] (from===to draws a note) */
  function seq(lanes, msgs, o = {}) {
    const W = o.width || 640, n = lanes.length, lw = W / n, rowH = o.rowH || 27, max = o.max || 10;
    const start = Math.max(0, msgs.length - max), shown = msgs.slice(start);
    const top = 56 + (start ? 16 : 0), H = top + Math.max(1, shown.length) * rowH + 8;
    const X = Object.fromEntries(lanes.map((l, i) => [l.id, (i + 0.5) * lw]));
    let s = `<svg class="pt-seq" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(o.label || "sequence diagram")}">`;
    lanes.forEach((l) => {
      const x = X[l.id], bw = Math.min(lw - 12, 170);
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
        const x = X[m.from], bw = Math.min(W - 8, Math.max(120, m.label.length * 6.6 + 18));
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

  /* box graph: nodes [{id,x,y,w,title,sub,rows:[[text,cls]],cls}], edges [{from,row,to,label,cls,loop}] */
  function boxGraph(nodes, edges, o = {}) {
    const RH = 17, HH = 24;
    const byId = {};
    for (const n of nodes) { n.h = HH + (n.rows || []).length * RH + ((n.rows || []).length ? 6 : 0); byId[n.id] = n; }
    const pad = o.pad ?? 10;
    const maxX = Math.max(...nodes.map((n) => n.x + n.w)) + pad + (o.extraW || 0), maxY = Math.max(...nodes.map((n) => n.y + n.h)) + pad + (o.extraH || 0);
    const minY = Math.min(...nodes.map((n) => n.y)) - pad - (o.topPad || 0);
    let s = `<svg class="pt-bg" viewBox="${-pad} ${minY} ${maxX + pad} ${maxY - minY}" width="${maxX + pad}" role="img" aria-label="${esc(o.label || "object graph")}">`;
    const head = (x2, y2, ux, uy, c) => `<polygon class="ah ${c}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
    let es = "", labels = "";
    for (const e of edges) {
      const a = byId[e.from], b = byId[e.to];
      if (!a || !b) continue;
      const c = e.cls || "";
      if (e.loop) {
        const x = a.x + a.w / 2, y = a.y;
        es += `<path class="e ${c}" d="M${x - 26},${y} C${x - 40},${y - 42} ${x + 40},${y - 42} ${x + 28},${y - 6}"/>` + head(x + 26, y - 1, -0.3, 0.95, c);
        labels += `<text class="el ${c}" x="${x}" y="${y - 36}">${esc(e.label || "")}</text>`;
        continue;
      }
      const y1 = e.row !== undefined ? a.y + HH + 6 + e.row * RH + RH / 2 - 3 : a.y + a.h / 2;
      const fwd = b.x >= a.x + a.w - 1;
      const x1 = fwd ? a.x + a.w : a.x;
      const tx = fwd ? b.x : b.x + b.w, ty = Math.max(b.y + 8, Math.min(b.y + b.h - 8, e.toY !== undefined ? b.y + e.toY : y1 + (b.y + b.h / 2 - y1) * 0.85));
      const dx = tx - x1, dy = ty - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      const mx = x1 + dx * 0.5, my = y1 + dy * 0.5;
      es += `<path class="e ${c}" d="M${x1},${y1} C${x1 + dx * 0.45},${y1} ${tx - dx * 0.45},${ty} ${tx - ux * 6},${ty - uy * 6}"/>` + head(tx, ty, 1 * Math.sign(dx || 1), 0, c);
      if (e.label) labels += `<text class="el ${c}" x="${mx}" y="${my - 4}">${esc(e.label)}</text>`;
    }
    let ns = "";
    for (const n of nodes) {
      ns += `<g class="bn ${n.cls || ""}"><rect x="${n.x}" y="${n.y}" width="${n.w}" height="${n.h}" rx="7"/>`;
      ns += `<text class="bt" x="${n.x + n.w / 2}" y="${n.y + 16}">${esc(n.title)}</text>`;
      if (n.tag) ns += `<text class="btag" x="${n.x + n.w - 6}" y="${n.y - 4}">${esc(n.tag)}</text>`;
      (n.rows || []).forEach(([t, rc], i) => {
        const y = n.y + HH + 6 + i * RH;
        if (rc) ns += `<rect class="br ${rc}" x="${n.x + 3}" y="${y - 2}" width="${n.w - 6}" height="${RH - 1}" rx="3"/>`;
        ns += `<text class="bf" x="${n.x + 8}" y="${y + 11}">${esc(t)}</text>`;
      });
      if ((n.rows || []).length) ns += `<line class="bs" x1="${n.x}" y1="${n.y + HH}" x2="${n.x + n.w}" y2="${n.y + HH}"/>`;
      ns += "</g>";
    }
    return s + es + ns + labels + "</svg>";
  }

  /* =====================================================================
   * 1. Adapter: translate one interface into another
   * ===================================================================== */
  const AD_VENDORS = ["LegacyWeather SOAP (°F, city names, status codes)", "OpenMeteo REST (°C, lat/lon, HTTP status)"];
  const AD_MODES = ["one adapter implements IWeather", "every caller talks to the vendor"];
  const AD_ZIP = { "98101": ["Seattle", 47.61, -122.33, 50], "10001": ["New York", 40.75, -73.99, 68], "60601": ["Chicago", 41.88, -87.62, 41], "94103": ["San Francisco", 37.77, -122.41, 59], "02108": ["Boston", 42.36, -71.06, null] };
  Viz.register(P + "adapter", (el) => Viz.player(el, {
    title: "Adapter: your code keeps its interface, the adapter speaks the vendor's",
    legend: [["active", "translation inside the adapter"], ["done", "result in the client's terms"], ["bad", "error, mapped to your exception"], ["path", "vendor-specific call"]],
    codeLang: "csharp",
    code: [
      "public sealed class LegacyWeatherAdapter(LegacyWeatherClient vendor) : IWeather",
      "{",
      "    public async Task<double> GetTempCAsync(string zip)",
      "    {",
      "        var city = ZipDirectory.CityFor(zip)            // translate the input",
      "            ?? throw new LocationNotFoundException(zip);",
      "        var r = await vendor.GetForecastAsync(city);     // call the adaptee",
      "        if (r.Status != 0)                               // translate errors",
      "            throw new WeatherUnavailableException(zip);",
      "        return Math.Round((r.TempF - 32) * 5 / 9, 1);    // translate the output",
      "    }",
      "}",
    ],
    inputs: [
      { key: "zips", label: "client asks for ZIP codes", value: "98101, 02108, 99999, 60601", width: 230 },
      { key: "vendor", label: "vendor behind the adapter", type: "select", options: AD_VENDORS, value: AD_VENDORS[0] },
      { key: "mode", label: "who translates", type: "select", options: AD_MODES, value: AD_MODES[0] },
    ],
    random: () => {
      const pool = [...Object.keys(AD_ZIP), "99999", "12345"];
      return { zips: Array.from({ length: Viz.rand(2, 4) }, () => pool[Viz.rand(0, pool.length - 1)]).join(", "), vendor: AD_VENDORS[Viz.rand(0, 1)], mode: AD_MODES[Math.random() < 0.75 ? 0 : 1] };
    },
    build: ({ zips, vendor, mode }) => {
      const zs = String(zips).split(/[\s,]+/).filter(Boolean);
      if (zs.length < 1 || zs.length > 5) throw new Error("ZIP codes: use 1 to 5 ZIP codes separated by commas.");
      for (const z of zs) if (!/^\d{5}$/.test(z)) throw new Error(`ZIP codes: "${z}" is not a 5-digit ZIP code.`);
      const legacy = vendor === AD_VENDORS[0], direct = mode === AD_MODES[1];
      const lanes = direct
        ? [{ id: "c", label: "Callers", sub: "Checkout, Dashboard, Alerts" }, { id: "v", label: legacy ? "LegacyWeather" : "OpenMeteo", sub: legacy ? "SOAP · °F · city" : "REST · °C · lat/lon", cls: "accent" }]
        : [{ id: "c", label: "Client", sub: "knows only IWeather" }, { id: "a", label: "Adapter", sub: "implements IWeather", cls: "accent" }, { id: "v", label: legacy ? "LegacyWeather" : "OpenMeteo", sub: legacy ? "SOAP · °F · city" : "REST · °C · lat/lon" }];
      const A = direct ? "c" : "a";
      const msgs = [], log = [], fr = [];
      let ok = 0, mapped = 0;
      const snap = (o) => fr.push({ lanes, msgs: msgs.slice(), log: log.slice(), ok, mapped, direct, legacy, ...o });
      snap({ line: 2, note: direct ? `No adapter: <b>every caller</b> talks to the vendor's API directly. Each one has to know about city names, ${legacy ? "Fahrenheit and numeric status codes" : "coordinates and HTTP status codes"}, and repeat the same conversions.` : `The client depends on <b>your</b> interface, <code>IWeather.GetTempCAsync(zip)</code>, which takes a ZIP code and returns °C. The vendor speaks a different language. The adapter is the only class that knows both.`, vars: { requests: zs.length, vendor: legacy ? "Legacy" : "OpenMeteo" } });
      for (const z of zs) {
        const info = AD_ZIP[z];
        msgs.push({ from: "c", to: A, label: direct ? `need °C for ${z}` : `GetTempCAsync("${z}")`, cls: "" });
        if (direct) msgs[msgs.length - 1] = { from: "c", to: "c", label: `need °C for ${z}`, cls: "" };
        snap({ line: 2, zip: z, note: `${direct ? "A caller" : "The client"} needs the temperature for <code>${z}</code> in °C.`, vars: { zip: z } });
        if (!info) {
          msgs.push({ from: A, to: A, label: `${z}: no ${legacy ? "city" : "coordinates"} → LocationNotFound`, cls: "bad" });
          if (!direct) msgs.push({ from: "a", to: "c", label: "LocationNotFoundException", cls: "bad", dash: true });
          log.push([z, "LocationNotFound", "bad"]); mapped++;
          snap({ line: 5, zip: z, bad: true, note: `<b>Input translation fails</b>: <code>${z}</code> isn't in the ZIP directory, so there's nothing to send the vendor. ${direct ? "Each caller handles this its own way (or doesn't)." : "The adapter throws <i>your</i> exception type, so callers never see a vendor error for bad input."}`, vars: { zip: z, error: "LocationNotFound" } });
          continue;
        }
        const [city, lat, lon, tf] = info;
        msgs.push({ from: A, to: A, label: legacy ? `${z} → "${city}"` : `${z} → (${lat}, ${lon})`, cls: "active" });
        snap({ line: 4, zip: z, note: `<b>Translate the input.</b> The vendor doesn't understand ZIP codes; it wants ${legacy ? `a city name, <code>"${city}"</code>` : `coordinates, <code>${lat}, ${lon}</code>`}.${direct ? " This lookup is now copied into every caller." : ""}`, vars: { zip: z, [legacy ? "city" : "latlon"]: legacy ? city : `${lat},${lon}` } });
        msgs.push({ from: A, to: "v", label: legacy ? `GetForecast("${city}")` : `GET /forecast?lat=${lat}&lon=${lon}`, cls: "path" });
        snap({ line: 6, zip: z, note: `Call the <b>adaptee</b> in its own terms: ${legacy ? "a SOAP call that takes a city" : "an HTTP GET with query parameters"}.`, vars: { zip: z } });
        if (tf === null) {
          msgs.push({ from: "v", to: A, label: legacy ? "{ TempF: 0, Status: 17 }" : "503 Service Unavailable", cls: "bad", dash: true });
          snap({ line: 7, zip: z, bad: true, note: `The vendor fails in <b>its</b> way: ${legacy ? "status code 17 (STATION_OFFLINE) with a meaningless <code>TempF: 0</code>. Without a check, 0 °F becomes −17.8 °C and goes on the dashboard as real data." : "HTTP 503."}`, vars: { zip: z, vendorError: legacy ? 17 : 503 } });
          msgs.push({ from: A, to: A, label: `${legacy ? "Status 17" : "503"} → WeatherUnavailable`, cls: "bad" });
          if (!direct) msgs.push({ from: "a", to: "c", label: "WeatherUnavailableException", cls: "bad", dash: true });
          log.push([z, "WeatherUnavailable", "bad"]); mapped++;
          snap({ line: 8, zip: z, bad: true, note: `<b>Translate the error.</b> ${direct ? "Each caller must know that 17 means offline. One of them will forget." : "The adapter maps the vendor's failure to <i>your</i> exception. Callers catch <code>WeatherUnavailableException</code> whichever vendor is behind it."}`, vars: { zip: z, error: "WeatherUnavailable" } });
          continue;
        }
        const c = Math.round(((tf - 32) * 5) / 9 * 10) / 10;
        msgs.push({ from: "v", to: A, label: legacy ? `{ TempF: ${tf}, Status: 0 }` : `200 {"temperature_2m": ${c.toFixed(1)}}`, cls: "path", dash: true });
        snap({ line: 6, zip: z, note: `The vendor answers in its own shape: ${legacy ? `<b>Fahrenheit</b>, inside a response object with a status field` : `a JSON document with a vendor-specific field name`}.`, vars: { zip: z, [legacy ? "tempF" : "temperature_2m"]: legacy ? tf : c } });
        msgs.push({ from: A, to: A, label: legacy ? `(${tf} − 32) × 5/9 = ${c.toFixed(1)} °C` : `temperature_2m → ${c.toFixed(1)} °C`, cls: "active" });
        snap({ line: 9, zip: z, note: `<b>Translate the output</b> into the client's units and types${legacy ? ": Fahrenheit to Celsius" : ": pick the field, parse it, round it"}.${direct ? " Copied into every caller, and the Dashboard's copy rounds differently." : ""}`, vars: { zip: z, tempC: c } });
        if (!direct) msgs.push({ from: "a", to: "c", label: `${c.toFixed(1)}`, cls: "ret", dash: true });
        log.push([z, `${c.toFixed(1)} °C`, "done"]); ok++;
        snap({ line: 9, zip: z, done: true, note: direct ? `The caller finally has <code>${c.toFixed(1)}</code> °C, after doing the adapter's job inline.` : `The client receives <code>${c.toFixed(1)}</code>: a plain <code>double</code> in °C. It has no idea ${legacy ? "SOAP or Fahrenheit" : "HTTP or coordinates"} was involved.`, vars: { zip: z, result: c } });
      }
      snap({ line: 11, final: true, note: direct ? `<b>Without an adapter</b>, vendor concepts leak into every caller. Switching vendors means editing all of them. Switch <i>who translates</i> to compare.` : `Switch the <i>vendor</i> select: the <b>client's messages don't change at all</b>. Only the adapter's translations do. Swapping vendors means writing one new adapter.`, vars: { ok, mappedErrors: mapped } });
      return fr;
    },
    render: (f) => {
      const vendorTypes = f.direct ? (f.legacy ? 3 : 2) : 0;
      return col(
        `<div class="pt-fit">${seq(f.lanes, f.msgs, { width: f.direct ? 520 : 680, max: 9, label: "adapter sequence" })}</div>`,
        panels(kv("results the client saw", f.log, { empty: "none yet" })),
        stats([["converted", f.ok, "done"], ["errors mapped", f.mapped, f.mapped ? "bad" : ""], ["vendor types in caller code", vendorTypes, vendorTypes ? "bad" : "done"], ["places with translation logic", f.direct ? 3 : 1, f.direct ? "bad" : "done"]]),
      );
    },
  }));

  /* =====================================================================
   * 2. Facade: one simple call over a subsystem
   * ===================================================================== */
  const FC_FAIL = ["nothing fails", "payment declined", "shipping unavailable", "email server down"];
  const FC_MODES = ["client calls CheckoutFacade", "client calls each subsystem"];
  Viz.register(P + "facade", (el) => Viz.player(el, {
    title: "Facade: one PlaceOrder() in front of four subsystems",
    legend: [["active", "subsystem call"], ["done", "success"], ["bad", "failure"], ["visit", "compensation (undo)"]],
    codeLang: "csharp",
    code: [
      "public async Task<OrderResult> PlaceOrderAsync(Cart cart) {",
      "  var r = await inventory.ReserveAsync(cart.Items);",
      "  var c = await payments.ChargeAsync(cart.Total);",
      "  if (!c.Ok) { await inventory.ReleaseAsync(r); return Declined(); }",
      "  var s = await shipping.BookAsync(cart.Address);",
      "  if (!s.Ok) { await payments.RefundAsync(c); await inventory.ReleaseAsync(r);",
      "              return Unavailable(); }",
      "  await inventory.CommitAsync(r);",
      "  await outbox.EnqueueAsync(new SendConfirmation(cart));  // email is not critical",
      "  return Placed(r.OrderId, s.Label);",
      "}",
    ],
    inputs: [
      { key: "fail", label: "what fails", type: "select", options: FC_FAIL, value: FC_FAIL[2] },
      { key: "mode", label: "who orchestrates", type: "select", options: FC_MODES, value: FC_MODES[0] },
    ],
    random: () => ({ fail: FC_FAIL[Viz.rand(0, 3)], mode: FC_MODES[Math.random() < 0.7 ? 0 : 1] }),
    build: ({ fail, mode }) => {
      const direct = mode === FC_MODES[1], k = FC_FAIL.indexOf(fail);
      const lanes = [{ id: "c", label: direct ? "Web client" : "Client", sub: direct ? "+ Mobile API, Admin" : "one call" }];
      if (!direct) lanes.push({ id: "f", label: "CheckoutFacade", sub: "orchestrates", cls: "accent" });
      lanes.push({ id: "i", label: "Inventory" }, { id: "p", label: "Payments" }, { id: "s", label: "Shipping" }, { id: "e", label: "Email" });
      const O = direct ? "c" : "f";
      const msgs = [], fr = [], known = new Set();
      let clientCalls = 0, result = null;
      const call = (to, label, cls = "active") => { msgs.push({ from: O, to, label, cls }); known.add(to); if (direct) clientCalls++; };
      const ret = (to, label, cls = "ret") => msgs.push({ from: to, to: O, label, cls, dash: true });
      const snap = (o) => fr.push({ lanes, msgs: msgs.slice(), known: [...known], clientCalls: direct ? clientCalls : Math.min(1, clientCalls), result, direct, ...o });
      if (!direct) { msgs.push({ from: "c", to: "f", label: "PlaceOrderAsync(cart)", cls: "path" }); clientCalls = 1; }
      snap({ line: 0, note: direct ? `No facade: the web client calls <b>four subsystems</b> itself, in the right order, with the right undo steps. The mobile API and the admin tool contain the same sequence.` : `The client makes <b>one call</b>. The facade knows the order of operations, which steps are critical and how to undo them.`, vars: { mode: direct ? "direct" : "facade" } });
      call("i", "Reserve(items)"); ret("i", "reservation r1");
      snap({ line: 1, note: `Reserve stock first, so nobody else can buy the last unit while payment runs.`, vars: { reservation: "r1" } });
      call("p", "Charge(€42.00)");
      if (k === 1) {
        ret("p", "Declined (insufficient funds)", "bad");
        snap({ line: 2, bad: true, note: `Payment is <b>declined</b>. The reservation is still holding stock.`, vars: { charge: "declined" } });
        call("i", "Release(r1)", "reuse");
        result = ["PaymentDeclined", "bad"];
        if (!direct) msgs.push({ from: "f", to: "c", label: "PaymentDeclined", cls: "bad", dash: true });
        snap({ line: 3, bad: true, final: true, note: `<b>Compensate</b>: release the reservation. ${direct ? "Every client must remember this. The admin tool forgot, so declined orders there leak reserved stock until a nightly job cleans up." : "The facade does it in one place, and the client gets a single, meaningful result."}`, vars: { result: "PaymentDeclined" } });
        return fr;
      }
      ret("p", "charge c1");
      snap({ line: 2, note: `Charged. From here on, a failure means <b>money must be returned</b>.`, vars: { charge: "c1" } });
      call("s", "Book(address)");
      if (k === 2) {
        ret("s", "Unavailable", "bad");
        snap({ line: 4, bad: true, note: `Shipping can't deliver to that address. Two earlier steps already succeeded and must be undone, in reverse order.`, vars: { shipping: "unavailable" } });
        call("p", "Refund(c1)", "reuse"); call("i", "Release(r1)", "reuse");
        result = ["ShippingUnavailable", "bad"];
        if (!direct) msgs.push({ from: "f", to: "c", label: "ShippingUnavailable", cls: "bad", dash: true });
        snap({ line: 5, bad: true, final: true, note: `<b>Compensate in reverse</b>: refund, then release. ${direct ? "Three copies of this undo logic, in three codebases, drift apart. This is the kind of bug that charges customers for orders that never ship." : "This is the real value of the facade: the business rules about <i>order</i> and <i>undo</i> live in one tested place, not in every UI."}`, vars: { result: "ShippingUnavailable" } });
        return fr;
      }
      ret("s", "label L-77");
      call("i", "Commit(r1)"); ret("i", "order #1001");
      snap({ line: 7, note: `Shipping booked; turn the reservation into a real order.`, vars: { order: "#1001" } });
      call("e", "SendConfirmation()");
      if (k === 3) {
        ret("e", "SMTP 421 try later", "bad");
        msgs.push({ from: O, to: O, label: "not critical: retry via outbox", cls: "path" });
        snap({ line: 8, note: `Email fails, but the order is valid: <b>don't roll back a paid, shipped order because an email bounced</b>. ${direct ? "Will every client make the same call? The mobile API throws here and shows the user an error for an order that went through." : "The facade decides what's critical. Here it queues a retry (an outbox) and carries on."}`, vars: { email: "queued for retry" } });
      } else { ret("e", "queued"); snap({ line: 8, note: `Confirmation email queued.`, vars: { email: "queued" } }); }
      result = ["OrderPlaced #1001", "done"];
      if (!direct) msgs.push({ from: "f", to: "c", label: "OrderPlaced #1001", cls: "ret", dash: true });
      snap({ line: 9, done: true, final: true, note: direct ? `Done, after <b>${clientCalls} calls</b> from the client and knowledge of 4 subsystem APIs. Multiply by every client that places orders.` : `The client made <b>1 call</b> and knows <b>1 type</b>. The subsystems are still there and still usable directly. A facade <i>simplifies</i>; it doesn't hide or replace.`, vars: { result: "OrderPlaced" } });
      return fr;
    },
    render: (f) => col(
      `<div class="pt-fit">${seq(f.lanes, f.msgs, { width: f.direct ? 620 : 720, max: 11, label: "checkout sequence" })}</div>`,
      f.result ? verdict(f.result[0], f.result[1]) : "",
      stats([["calls the client makes", f.direct ? f.clientCalls : 1, f.direct ? "bad" : "done"], ["subsystems the client knows", f.direct ? f.known.length : 1, f.direct ? "bad" : "done"], ["copies of the undo logic", f.direct ? 3 : 1, f.direct ? "bad" : "done"]]),
    ),
  }));

  /* =====================================================================
   * 3. Decorator: the onion, one request at a time
   * ===================================================================== */
  const DC_ALL = ["logging", "metrics", "retry", "cache"];
  const DC_NAME = { logging: "LoggingProducts", metrics: "MetricsProducts", retry: "RetryProducts", cache: "CachingProducts" };
  function onion(layers, cls, tags, core) {
    const n = layers.length, D = 26, DX = 30, W = 600, H = 2 * n * D + 60;
    let s = `<svg class="pt-onion" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Decorators wrapped around the real service, outermost first">`;
    layers.forEach((l, i) => {
      const x = i * DX + 1, y = i * D + 1, w = W - 2 * i * DX - 2, h = H - 2 * i * D - 2;
      s += `<rect class="ring ${cls[i] || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="12"/>`;
      s += `<text class="rl" x="${x + 12}" y="${y + 18}">${esc(DC_NAME[l])}</text>`;
      if (tags[i]) s += `<text class="rt ${cls[i] || ""}" x="${x + w - 12}" y="${y + 18}">${esc(tags[i])}</text>`;
    });
    const x = n * DX + 1, y = n * D + 1, w = W - 2 * n * DX - 2, h = H - 2 * n * D - 2;
    s += `<rect class="ring core ${core.cls || ""}" x="${x}" y="${y}" width="${w}" height="${h}" rx="10"/>`;
    s += `<text class="rc" x="${W / 2}" y="${y + h / 2 - 2}">ProductService (the real one)</text>`;
    s += `<text class="rt mid ${core.cls || ""}" x="${W / 2}" y="${y + h / 2 + 15}">${esc(core.tag || "SELECT … FROM products")}</text>`;
    return s + "</svg>";
  }
  Viz.register(P + "decorator", (el) => Viz.player(el, {
    title: "Decorator: same interface, wrapped in layers. Order matters",
    legend: [["path", "call passing through"], ["active", "layer running now"], ["done", "success"], ["visit", "cache hit / retry"], ["bad", "failure"]],
    codeLang: "csharp",
    code: [
      "public sealed class CachingProducts(IProductService inner, IMemoryCache cache)",
      "    : IProductService                        // same interface it wraps",
      "{",
      "    public async Task<Product> GetAsync(int id)",
      "    {",
      "        if (cache.TryGetValue(id, out Product? p)) return p!;  // short-circuit",
      "        p = await inner.GetAsync(id);         // delegate inward",
      "        cache.Set(id, p, TimeSpan.FromMinutes(5)); // after: success only",
      "        return p;",
      "    }",
      "}",
      "// Logging, Metrics, Retry have the same shape: before → inner → after",
    ],
    inputs: [
      { key: "layers", label: "layers, outermost first", value: "metrics, cache, logging, retry", width: 250 },
      { key: "reqs", label: "requests (id, ! = fails once)", value: "1, 2, 1, 3!", width: 170 },
    ],
    random: () => {
      const l = [...DC_ALL].sort(() => Math.random() - 0.5).slice(0, Viz.rand(2, 4));
      return { layers: l.join(", "), reqs: Array.from({ length: Viz.rand(3, 5) }, () => `${Viz.rand(1, 3)}${Math.random() < 0.2 ? "!" : ""}`).join(", ") };
    },
    build: ({ layers, reqs }) => {
      const L = list(layers, "Layers", { min: 1, max: 4 });
      for (const x of L) if (!DC_ALL.includes(x)) throw new Error(`Layers: "${x}" is not one of logging, metrics, retry, cache.`);
      if (new Set(L).size !== L.length) throw new Error("Layers: use each layer at most once.");
      const R = String(reqs).split(/[\s,]+/).filter(Boolean);
      if (R.length < 1 || R.length > 6) throw new Error("Requests: use 1 to 6 product ids separated by commas.");
      for (const r of R) if (!/^\d!?$/.test(r)) throw new Error(`Requests: "${r}" is not a one-digit id (add ! to make it fail once).`);
      const n = L.length, fr = [], log = [], cache = new Set();
      const st = { reqs: 0, core: 0, hits: 0, retries: 0, metric: 0, errors: 0 };
      let cls = [], tags = [], core = {};
      const snap = (o) => fr.push({ L, cls: cls.slice(), tags: tags.slice(), core: { ...core }, log: log.slice(-7), st: { ...st }, ...o });
      const lineOf = { logging: 6, metrics: 6, retry: 6, cache: 5 };
      snap({ line: 0, note: `The client holds an <code>IProductService</code>. It can't tell that it's really <b>${n} wrapper${n > 1 ? "s" : ""}</b> around the real service: <code>${L.map((x) => `new ${DC_NAME[x]}(`).join("")}new ProductService(db)${")".repeat(n)}</code>.`, vars: { layers: n } });
      const run = (i, id, req) => {
        if (i === n) {
          st.core++; req.coreCalls++;
          core = { cls: "active", tag: `SELECT … WHERE id = ${id}` };
          cls = cls.map((c, k) => (k < n ? "path" : c));
          if (req.flaky && req.coreCalls === 1) {
            core = { cls: "bad", tag: "timeout (transient)" };
            snap({ line: 6, note: `The call reaches the <b>real</b> service, which times out. This is a transient failure: trying again would work.`, vars: { id, core: "timeout" } });
            core = {};
            return { ok: false };
          }
          core = { cls: "done", tag: `Product ${id} loaded` };
          snap({ line: 6, note: `The call reaches the <b>real</b> service, which queries the database. Everything outside it is extra behaviour added by wrapping.`, vars: { id, coreCalls: st.core } });
          core = {};
          return { ok: true, src: "db" };
        }
        const k = L[i];
        cls[i] = "active"; tags[i] = `→ GetAsync(${id})`;
        if (k === "cache" && cache.has(id)) {
          st.hits++; cls[i] = "visit"; tags[i] = "hit: return early";
          snap({ line: 5, note: `<b>Cache hit.</b> CachingProducts returns immediately and <b>never calls inward</b>. ${i < n - 1 ? `The ${L.slice(i + 1).join(" and ")} layer${n - i - 1 > 1 ? "s" : ""} inside it won't see this request.` : ""}`, vars: { id, hit: true } });
          tags[i] = ""; cls[i] = "path";
          return { ok: true, src: "cache" };
        }
        if (k === "logging") log.push([`→ GET product ${id}`, "", ""]);
        snap({ line: lineOf[k], note: { logging: `LoggingProducts writes the <b>before</b> line, then delegates inward.`, metrics: `MetricsProducts starts a stopwatch and delegates inward.`, retry: `RetryProducts delegates inward inside a retry loop (2 attempts).`, cache: `Cache miss for <code>${id}</code>: CachingProducts delegates inward.` }[k], vars: { layer: DC_NAME[k], id } });
        cls[i] = "path"; tags[i] = "waiting…";
        let r = run(i + 1, id, req);
        if (k === "retry" && !r.ok) {
          st.retries++; cls[i] = "visit"; tags[i] = "attempt 2";
          for (let j = i + 1; j < n; j++) { cls[j] = ""; tags[j] = ""; }
          snap({ line: 6, note: `RetryProducts sees a transient failure and <b>calls inward again</b>. ${i < n - 1 ? `Every layer inside it (${L.slice(i + 1).join(", ")}) runs a second time.` : ""}`, vars: { id, retries: st.retries } });
          cls[i] = "path"; tags[i] = "waiting…";
          r = run(i + 1, id, req);
        }
        cls[i] = "active";
        if (k === "cache") { if (r.ok) cache.add(id); tags[i] = r.ok ? `stored ${id}` : "error: not cached"; }
        if (k === "logging") { log.push([`← ${r.ok ? `200 (${r.src})` : "503 timeout"}`, "", r.ok ? "done" : "bad"]); tags[i] = r.ok ? "← logged OK" : "← logged error"; }
        if (k === "metrics") { st.metric++; tags[i] = `count = ${st.metric}`; }
        if (k === "retry") tags[i] = r.ok ? "← OK" : "← gave up";
        snap({ line: k === "cache" ? 7 : 11, note: { logging: `On the way <b>out</b>, LoggingProducts writes the after line.`, metrics: `On the way <b>out</b>, MetricsProducts records the latency and increments its counter (${st.metric}).`, retry: r.ok ? `RetryProducts passes the result outward.` : `RetryProducts ran out of attempts and rethrows.`, cache: r.ok ? `On the way out, CachingProducts stores product ${id}.` : `The inner call failed, so CachingProducts <b>doesn't cache the error</b>.` }[k], vars: { layer: DC_NAME[k], ok: r.ok } });
        cls[i] = r.ok ? "done" : "bad"; tags[i] = "";
        return r;
      };
      for (const tok of R) {
        const id = +tok[0], req = { flaky: tok.endsWith("!"), coreCalls: 0 };
        st.reqs++; cls = L.map(() => ""); tags = L.map(() => ""); core = {};
        const r = run(0, id, req);
        if (!r.ok) st.errors++;
        cls = L.map(() => (r.ok ? "done" : "bad")); tags = L.map(() => ""); core = {};
        snap({ line: 8, done: r.ok, bad: !r.ok, note: r.ok ? `Request ${st.reqs} returns product ${id} to the client (served from <b>${r.src === "cache" ? "the cache" : "the database"}</b>).` : `Request ${st.reqs} fails: the client gets the exception. ${L.includes("retry") ? "" : "There's no retry layer to absorb the transient error."}`, vars: { request: st.reqs, result: r.ok ? `Product ${id}` : "error" } });
      }
      const idx = (x) => L.indexOf(x), has = (x) => idx(x) >= 0;
      const facts = [];
      if (has("cache") && has("logging") && idx("logging") > idx("cache") && st.hits) facts.push(`Logging is <i>inside</i> the cache, so ${st.hits} cache hit${st.hits > 1 ? "s were" : " was"} never logged.`);
      if (has("cache") && has("metrics") && idx("metrics") > idx("cache") && st.hits) facts.push(`Metrics is inside the cache: it counted ${st.metric} of ${st.reqs} requests.`);
      if (has("retry") && has("logging") && idx("logging") > idx("retry") && st.retries) facts.push(`Logging is inside retry, so each attempt was logged separately.`);
      if (has("retry") && has("cache") && idx("cache") > idx("retry") && st.retries) facts.push(`Cache is inside retry, so the retry went through the cache check again.`);
      cls = L.map(() => ""); tags = L.map(() => "");
      snap({ line: 11, final: true, note: `${st.reqs} requests, ${st.core} reached the database. ${facts.join(" ") || "Try reordering the layers, e.g. put <code>cache</code> first, or <code>logging</code> last."} <b>Each layer is one small class; the order is decided in one place</b> (the composition root).`, vars: { requests: st.reqs, dbCalls: st.core } });
      return fr;
    },
    render: (f) => col(
      `<div class="pt-fit">${onion(f.L, f.cls, f.tags, f.core)}</div>`,
      panels(kv("log output", f.log, { empty: f.L.includes("logging") ? "nothing logged yet" : "no logging layer" })),
      stats([["requests", f.st.reqs], ["reached the DB", f.st.core, "path"], ["cache hits", f.st.hits, "visit"], ["retries", f.st.retries, f.st.retries ? "visit" : ""], ["metric count", f.st.metric], ["errors to client", f.st.errors, f.st.errors ? "bad" : ""]]),
    ),
  }));

  /* =====================================================================
   * 4. Proxy: same interface, controls access to the real object
   * ===================================================================== */
  const PX_KINDS = ["virtual (create on first use)", "protection (check permissions)", "caching (remember results)", "remote (call over the network)"];
  const PX_ROLE = { alice: "admin", bob: "viewer", carol: "viewer" };
  Viz.register(P + "proxy", (el) => Viz.player(el, {
    title: "Proxy: a stand-in with the same interface that decides how, when or whether to reach the real object",
    legend: [["path", "call to the real subject"], ["active", "proxy logic"], ["visit", "answered by the proxy"], ["bad", "denied / failed"]],
    codeLang: "csharp",
    code: [
      "public sealed class ReportsProxy(Func<IReports> create, ICurrentUser user,",
      "                                 IMemoryCache cache) : IReports",
      "{",
      "    private IReports? real;                          // virtual: not created yet",
      "    public Report Get(int id)",
      "    {",
      "        if (!user.CanRead(id)) throw new ForbiddenException(); // protection",
      "        if (cache.TryGetValue(id, out Report? r)) return r!;    // caching",
      "        real ??= create();                           // virtual: first use",
      "        r = real.Get(id);                            // remote: this crosses the wire",
      "        cache.Set(id, r);",
      "        return r;",
      "    }",
      "}",
    ],
    inputs: [
      { key: "kind", label: "proxy kind", type: "select", options: PX_KINDS, value: PX_KINDS[1] },
      { key: "ops", label: "calls (user:get(id))", value: "alice:get(1), bob:get(3), bob:get(1), alice:get(1)", width: 330 },
    ],
    random: () => ({ kind: PX_KINDS[Viz.rand(0, 3)], ops: Array.from({ length: Viz.rand(3, 5) }, () => `${["alice", "bob", "carol"][Viz.rand(0, 2)]}:get(${Viz.rand(1, 4)})`).join(", ") }),
    build: ({ kind, ops }) => {
      const K = PX_KINDS.indexOf(kind);
      if (K < 0) throw new Error("Pick one of the listed proxy kinds.");
      const O = String(ops).split(/[\s,]+/).filter(Boolean);
      if (O.length < 1 || O.length > 6) throw new Error("Calls: use 1 to 6 calls like alice:get(1).");
      const calls = O.map((t) => {
        const m = /^([a-z]+):get\((\d)\)$/.exec(t);
        if (!m) throw new Error(`Calls: "${t}" is not in the form user:get(id), e.g. bob:get(2).`);
        if (!PX_ROLE[m[1]]) throw new Error(`Calls: "${m[1]}" is not a known user (use alice, bob or carol).`);
        return { u: m[1], id: +m[2] };
      });
      const remote = K === 3;
      const lanes = [{ id: "c", label: "Client", sub: "holds an IReports" }, { id: "p", label: ["LazyReports", "SecureReports", "CachedReports", "ReportsClient"][K], sub: remote ? "proxy (client stub)" : "proxy", cls: "accent" }];
      if (remote) lanes.push({ id: "n", label: "Network", sub: "HTTP / gRPC" });
      lanes.push({ id: "r", label: remote ? "ReportService" : "Reports", sub: remote ? "on another machine" : "real subject" });
      const msgs = [], fr = [], cache = new Map();
      const st = { calls: 0, real: 0, created: 0, denied: 0, hits: 0, ms: 0 };
      let realAlive = false;
      const snap = (o) => fr.push({ lanes, msgs: msgs.slice(), st: { ...st }, realAlive, K, cache: [...cache.keys()], ...o });
      snap({ line: 0, note: [
        `<b>Virtual proxy.</b> The real <code>Reports</code> object is expensive to create (it loads a 400 MB template set, about 1.8 s). The proxy has the same interface and creates it only when someone actually calls it.`,
        `<b>Protection proxy.</b> The proxy checks the caller's permissions before forwarding. alice is an admin; bob and carol are viewers, who may read reports 1 and 2 only.`,
        `<b>Caching proxy.</b> Reports are expensive to compute (about 900 ms). The proxy remembers results by id. (A caching <i>decorator</i> has the same shape; the name says the intent.)`,
        `<b>Remote proxy.</b> The client calls <code>reports.Get(1)</code> as if it were local. The proxy serializes the call, sends it over the network and deserializes the result. gRPC stubs, WCF and Java RMI all generate this class for you.`,
      ][K], vars: { kind: ["virtual", "protection", "caching", "remote"][K] } });
      for (const { u, id } of calls) {
        st.calls++;
        msgs.push({ from: "c", to: "p", label: `${u}: Get(${id})`, cls: "" });
        snap({ line: 4, note: `${u} calls <code>Get(${id})</code> on what looks like the real thing.`, vars: { user: u, role: PX_ROLE[u], id } });
        if (K === 1 && PX_ROLE[u] !== "admin" && id >= 3) {
          st.denied++;
          msgs.push({ from: "p", to: "p", label: `${u} is a viewer; report ${id} needs admin`, cls: "bad" });
          msgs.push({ from: "p", to: "c", label: "ForbiddenException", cls: "bad", dash: true });
          snap({ line: 6, bad: true, note: `<b>Denied.</b> The real object is never touched, so it doesn't need any security code itself.`, vars: { user: u, allowed: false } });
          continue;
        }
        if (K === 1) { msgs.push({ from: "p", to: "p", label: `${u} (${PX_ROLE[u]}) may read ${id}`, cls: "done" }); snap({ line: 6, note: `Permission check passes.`, vars: { user: u, allowed: true } }); }
        if (K === 2 && cache.has(id)) {
          st.hits++; st.ms += 1;
          msgs.push({ from: "p", to: "c", label: `${cache.get(id)} (cached, 1 ms)`, cls: "reuse", dash: true });
          snap({ line: 7, note: `<b>Cache hit.</b> The proxy answers itself; the real subject isn't called.`, vars: { id, hit: true } });
          continue;
        }
        if (K === 0 && !realAlive) {
          realAlive = true; st.created++; st.ms += 1800;
          msgs.push({ from: "p", to: "r", label: "new Reports()  1800 ms", cls: "make" });
          snap({ line: 8, note: `<b>First real use</b>: only now does the proxy create the expensive object. If no request had needed a report, those 1.8 s and 400 MB would never have been spent.`, vars: { created: true } });
        }
        if (remote) {
          msgs.push({ from: "p", to: "n", label: `POST {"op":"Get","id":${id}}`, cls: "path" });
          snap({ line: 9, note: `The proxy <b>serializes</b> the call. The client's code said <code>Get(${id})</code>; what actually happens is an HTTP request.`, vars: { payload: `{"op":"Get","id":${id}}` } });
          msgs.push({ from: "n", to: "r", label: `Get(${id})`, cls: "path" });
        } else msgs.push({ from: "p", to: "r", label: `Get(${id})`, cls: "path" });
        st.real++;
        const rep = `Report#${id}`;
        if (remote && id === 4) {
          st.ms += 3000;
          msgs.push({ from: "n", to: "p", label: "timeout after 3000 ms", cls: "bad", dash: true });
          msgs.push({ from: "p", to: "c", label: "RpcException: DeadlineExceeded", cls: "bad", dash: true });
          snap({ line: 9, bad: true, note: `<b>The network fails.</b> A local call can't time out halfway; a remote one can. This is why remote proxies should <i>not</i> hide that they're remote: callers need timeouts, retries and an async API.`, vars: { error: "DeadlineExceeded" } });
          continue;
        }
        const cost = remote ? 40 : K === 2 ? 900 : 5;
        st.ms += cost;
        if (remote) msgs.push({ from: "r", to: "n", label: `${rep}`, cls: "ret", dash: true });
        msgs.push({ from: remote ? "n" : "r", to: "p", label: remote ? `200 {…} ${cost} ms` : `${rep}  ${cost} ms`, cls: "ret", dash: true });
        if (K === 2) cache.set(id, rep);
        msgs.push({ from: "p", to: "c", label: rep, cls: "ret", dash: true });
        snap({ line: K === 2 ? 10 : 11, done: true, note: [`The proxy forwards to the real object it now holds.`, `Allowed calls are forwarded unchanged.`, `Miss: the proxy calls the real subject (900 ms) and remembers the result.`, `The response is deserialized into a <code>Report</code>. Round trip: ${cost} ms, compared with nanoseconds for an in-process call.`][K], vars: { id, ms: cost } });
      }
      snap({ line: 13, final: true, note: [
        realAlive ? `The real object was created <b>once</b>, on first use. The client never knew.` : `No call reached the real object, so it was <b>never created</b>.`,
        `${st.denied} call${st.denied === 1 ? " was" : "s were"} denied without touching the real object. In ASP.NET Core or Spring you'd more often put this check in middleware or an <code>[Authorize]</code> attribute, which is a proxy built by the framework.`,
        `${st.hits} of ${st.calls} calls were answered from the cache.`,
        `Every call crossed the network. Design remote interfaces to be <b>coarse-grained</b> (one call that returns a lot) and make latency visible (async, timeouts).`,
      ][K], vars: { calls: st.calls, realCalls: st.real } });
      return fr;
    },
    render: (f) => col(
      `<div class="pt-fit">${seq(f.lanes, f.msgs, { width: f.lanes.length > 3 ? 700 : 600, max: 10, label: "proxy sequence" })}</div>`,
      stats([["client calls", f.st.calls], ["reached the real object", f.st.real, "path"],
        f.K === 0 ? ["real object created", f.realAlive ? "yes" : "not yet", f.realAlive ? "active" : "done"] : f.K === 1 ? ["denied", f.st.denied, f.st.denied ? "bad" : ""] : f.K === 2 ? ["cache hits", f.st.hits, "visit"] : ["network round trips", f.st.real, "bad"],
        ["time spent", `${f.st.ms} ms`]]),
    ),
  }));

  /* =====================================================================
   * 5. Composite: one recursive call over a part-whole tree
   * ===================================================================== */
  const CO_OPS = ["total size (sum)", "count files", "largest file (max)"];
  function coParse(src) {
    const toks = String(src).match(/[()]|[^\s()]+/g) || [];
    let i = 0, count = 0;
    const items = (depth) => {
      const out = [];
      while (i < toks.length && toks[i] !== ")") {
        const t = toks[i++];
        if (t === "(") throw new Error("Tree: a folder name must come right before ( — e.g. src(a.cs:3).");
        if (++count > 14) throw new Error("Tree: Too many nodes (use at most 14).");
        if (toks[i] === "(") {
          if (!/^[\w.-]{1,12}$/.test(t)) throw new Error(`Tree: "${t}" is not a valid folder name (letters, digits, . - _ up to 12).`);
          if (depth >= 3) throw new Error("Tree: Keep folders at most 3 levels deep.");
          i++;
          const kids = items(depth + 1);
          if (toks[i++] !== ")") throw new Error(`Tree: folder "${t}" is not closed with ).`);
          out.push({ name: t, kids });
        } else {
          const m = /^([\w.-]{1,12}):(\d{1,4})$/.exec(t);
          if (!m) throw new Error(`Tree: "${t}" is not a file like name.ext:size (size in KB, up to 4 digits).`);
          out.push({ name: m[1], size: +m[2] });
        }
      }
      return out;
    };
    const kids = items(0);
    if (i < toks.length) throw new Error("Tree: there is a ) that doesn't close any folder; use matching parentheses.");
    if (!kids.length) throw new Error("Tree: use at least one file, e.g. a.txt:3.");
    return { name: "/", kids };
  }
  function coLayout(root) {
    const nodes = [];
    let leaf = 0, maxD = 0;
    const walk = (n, d, parent) => {
      n.id = nodes.length; n.d = d; n.parent = parent; nodes.push(n); maxD = Math.max(maxD, d);
      if (n.kids) {
        if (!n.kids.length) n.x = leaf++;
        else { n.kids.forEach((k) => walk(k, d + 1, n.id)); n.x = (n.kids[0].x + n.kids[n.kids.length - 1].x) / 2; }
      } else n.x = leaf++;
    };
    walk(root, 0, -1);
    return { nodes, leaves: leaf, depth: maxD };
  }
  function coSvg(T, cls, val) {
    const NW = 84, NH = 40, GX = 92, GY = 70;
    const W = Math.max(T.leaves * GX + 10, 300), H = (T.depth + 1) * GY - GY + NH + 30;
    const X = (n) => 5 + n.x * GX + (GX - NW) / 2 + (W - 10 - T.leaves * GX) / 2, Y = (n) => 6 + n.d * GY;
    let s = `<svg class="pt-bg pt-ctree" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="Folder tree; each node answers the same call">`;
    for (const n of T.nodes) if (n.parent >= 0) {
      const p = T.nodes[n.parent], c = cls[n.id] && cls[n.id] !== "dim" ? cls[n.id] : "";
      s += `<path class="e ${c === "active" || c === "path" ? "path" : c === "done" ? "done" : ""}" d="M${X(p) + NW / 2},${Y(p) + NH} C${X(p) + NW / 2},${Y(p) + NH + 18} ${X(n) + NW / 2},${Y(n) - 18} ${X(n) + NW / 2},${Y(n)}"/>`;
    }
    for (const n of T.nodes) {
      const x = X(n), y = Y(n), folder = !!n.kids;
      s += `<g class="bn ${cls[n.id] || ""}"><rect x="${x}" y="${y}" width="${NW}" height="${NH}" rx="${folder ? 4 : 10}"/>`;
      s += `<text class="bt" x="${x + NW / 2}" y="${y + 16}">${esc((folder ? "▸ " : "") + n.name)}</text>`;
      s += `<text class="cv" x="${x + NW / 2}" y="${y + 32}">${esc(val[n.id] !== undefined ? val[n.id] : folder ? "?" : `${n.size} KB`)}</text></g>`;
    }
    return s + "</svg>";
  }
  Viz.register(P + "composite", (el) => Viz.player(el, {
    title: "Composite: call Size() on the root; every node answers the same way",
    legend: [["active", "node computing now"], ["path", "waiting on the call stack"], ["done", "returned its answer"]],
    codeLang: "csharp",
    code: [
      "public interface INode { long Size(); }",
      "",
      "public sealed record FileNode(string Name, long Kb) : INode",
      "{",
      "    public long Size() => Kb;                    // leaf: answer directly",
      "}",
      "public sealed class Folder(string name, params INode[] children) : INode",
      "{",
      "    public long Size()",
      "    {",
      "        long total = 0;",
      "        foreach (var c in children) total += c.Size(); // no type checks",
      "        return total;",
      "    }",
      "}",
    ],
    inputs: [
      { key: "tree", label: "tree: file:KB, folder( … )", value: "src(app.cs:12 lib(util.cs:4 io.cs:7) readme.md:2) test(t.cs:5)", width: 420 },
      { key: "op", label: "operation", type: "select", options: CO_OPS, value: CO_OPS[0] },
    ],
    random: () => {
      const f = () => `${["a", "b", "c", "d", "e", "f"][Viz.rand(0, 5)]}${Viz.rand(1, 9)}.cs:${Viz.rand(1, 40)}`;
      return { tree: `src(${f()} ${f()} lib(${f()} ${f()})) ${f()} docs(${f()})`, op: CO_OPS[Viz.rand(0, 2)] };
    },
    build: ({ tree, op }) => {
      const k = CO_OPS.indexOf(op);
      if (k < 0) throw new Error("Pick one of the listed operations.");
      const T = coLayout(coParse(tree));
      const leafVal = (n) => (k === 1 ? 1 : n.size), comb = (a, b) => (k === 2 ? Math.max(a, b) : a + b), unit = (v) => (k === 1 ? `${v} file${v === 1 ? "" : "s"}` : `${v} KB`);
      const fname = ["Size()", "CountFiles()", "Largest()"][k];
      const cls = {}, val = {}, stack = [], fr = [];
      let calls = 0;
      const snap = (o) => fr.push({ T, cls: { ...cls }, val: { ...val }, stack: stack.slice(), calls, ...o });
      snap({ line: 0, note: `The client calls <code>root.${fname}</code> once. It doesn't know (or care) how deep the tree is or which nodes are files. Every node implements the same <code>INode</code>.`, vars: { nodes: T.nodes.length } });
      const visit = (n) => {
        calls++; stack.push(n); cls[n.id] = "active";
        if (!n.kids) {
          val[n.id] = unit(leafVal(n));
          snap({ line: 4, note: `<b>${esc(n.name)}</b> is a leaf: it answers directly${k === 1 ? " with 1" : ` with its own size, ${n.size} KB`}.`, vars: { node: n.name, returns: leafVal(n) } });
          cls[n.id] = "done"; stack.pop();
          return leafVal(n);
        }
        let acc = 0;
        val[n.id] = unit(acc);
        snap({ line: 10, note: `<b>${esc(n.name)}</b> is a folder with ${n.kids.length} child${n.kids.length === 1 ? "" : "ren"}. It calls the <b>same method</b> on each one, without checking whether it's a file or a folder.`, vars: { node: n.name, children: n.kids.length, depth: stack.length } });
        for (const c of n.kids) {
          cls[n.id] = "path";
          const v = visit(c);
          acc = comb(acc, v); cls[n.id] = "active"; val[n.id] = unit(acc);
          snap({ line: 11, note: `${esc(c.name)} returned ${unit(v)}. <b>${esc(n.name)}</b>'s running ${k === 2 ? "maximum" : "total"} is now <b>${unit(acc)}</b>.`, vars: { node: n.name, child: c.name, partial: acc } });
        }
        cls[n.id] = "done"; stack.pop();
        if (n.id) snap({ line: 12, note: `<b>${esc(n.name)}</b> returns ${unit(acc)} to its parent, which treats it exactly like a file's answer.`, vars: { node: n.name, returns: acc } });
        return acc;
      };
      const total = visit(T.nodes[0]);
      snap({ line: 12, final: true, note: `Done: <b>${unit(total)}</b> after ${calls} calls, one per node. Adding a new node type (a symlink, a zip archive) means writing one more class that implements <code>INode</code>; the client and the folder code don't change.`, vars: { result: total, calls } });
      return fr;
    },
    render: (f) => col(
      `<div class="pt-fit">${coSvg(f.T, f.cls, f.val)}</div>`,
      panels(kv("call stack (top first)", f.stack.slice().reverse().map((n, i) => [`${n.kids ? "Folder" : "File"} ${n.name}`, f.val[n.id] || "", i === 0 ? "active" : "path"]), { empty: "empty" })),
      stats([["calls so far", f.calls], ["nodes", f.T.nodes.length], ["depth", f.T.depth]]),
    ),
  }));

  /* =====================================================================
   * 6. Bridge: m + n classes instead of m × n
   * ===================================================================== */
  const BR_MODES = ["bridge: Message has-a IChannel", "inheritance: one subclass per combination"];
  Viz.register(P + "bridge", (el) => Viz.player(el, {
    title: "Bridge: two things vary independently. Count the classes",
    legend: [["active", "class being written now"], ["done", "class exists"], ["bad", "class you must add for one new channel"]],
    codeLang: "csharp",
    code: [
      "public interface IChannel { Task SendAsync(string to, string text); }  // implementor",
      "public sealed class EmailChannel : IChannel { /* SMTP */ }",
      "public sealed class SmsChannel   : IChannel { /* Twilio */ }",
      "",
      "public abstract class Notification(IChannel channel)                    // abstraction",
      "{",
      "    protected abstract string Render();",
      "    public Task SendTo(string to) => channel.SendAsync(to, Render());  // the bridge",
      "}",
      "public sealed class Alert(IChannel ch, string issue) : Notification(ch)",
      "{",
      "    protected override string Render() => $\"ALERT: {issue}\";",
      "}",
      "",
      "new Alert(new SmsChannel(), \"disk full\").SendTo(\"+15550100\");",
    ],
    inputs: [
      { key: "abs", label: "messages (abstraction)", value: "alert, report, reminder", width: 200 },
      { key: "imp", label: "channels (implementation)", value: "email, sms, slack", width: 190 },
      { key: "mode", label: "design", type: "select", options: BR_MODES, value: BR_MODES[1] },
    ],
    random: () => {
      const a = ["alert", "report", "reminder", "invoice", "digest"].sort(() => Math.random() - 0.5).slice(0, Viz.rand(2, 4));
      const i = ["email", "sms", "slack", "teams", "webhook"].sort(() => Math.random() - 0.5).slice(0, Viz.rand(2, 4));
      return { abs: a.join(", "), imp: i.join(", "), mode: BR_MODES[Viz.rand(0, 1)] };
    },
    build: ({ abs, imp, mode }) => {
      const A = list(abs, "Messages", { min: 1, max: 5 }), I = list(imp, "Channels", { min: 1, max: 5 });
      if (new Set(A).size !== A.length || new Set(I).size !== I.length) throw new Error("Messages and channels: use each name once.");
      const NEW = ["push", "whatsapp", "pager", "fax"].find((x) => !I.includes(x));
      const inh = mode === BR_MODES[1], fr = [];
      const m = A.length, n = I.length;
      if (inh) {
        const M = A.map(() => I.map(() => "")), cl = {};
        let made = 0;
        const snap = (o) => fr.push({ inh, M: M.map((r) => r.slice()), cl: { ...cl }, cols: I.map(cap), rows: A.map(cap), made, m, n, ...o });
        snap({ line: 4, note: `<b>Inheritance only:</b> every message × channel combination becomes its own subclass. Rendering logic is copied across a row; sending logic is copied down a column.`, vars: { messages: m, channels: n } });
        A.forEach((a, r) => I.forEach((c, k) => {
          M[r][k] = cap(a) + cap(c); made++; cl[`${r},${k}`] = "active";
          if (made <= 3 || (r === m - 1 && k === n - 1)) snap({ line: 9, note: `Write <code>${cap(a)}${cap(c)}Message</code>: ${cap(a)}'s text, sent the ${cap(c)} way.${made === 3 ? " The pattern is clear; skipping ahead…" : ""}`, vars: { classes: made } });
          cl[`${r},${k}`] = "done";
        }));
        snap({ line: 9, note: `${m} messages × ${n} channels = <b>${m * n} classes</b>. A bug in the SMS code exists in ${m} copies.`, vars: { classes: made } });
        I.push(NEW); A.forEach((a, r) => { M[r].push(cap(a) + cap(NEW)); cl[`${r},${n}`] = "bad"; });
        snap({ line: 1, final: true, bad: true, note: `Product asks for <b>${cap(NEW)}</b>. With inheritance that's <b>${m} new classes</b> (a whole new column), and adding a message type later costs ${n + 1} more. This is the "class explosion" that Bridge removes. Switch the design to compare.`, vars: { classes: made + m, added: m } });
        return fr;
      }
      const absRows = [["Message (abstract)", ""]], impRows = [["IChannel", ""]];
      let made = 0;
      const nodes = () => [
        { id: "a", x: 0, y: 0, w: 230, title: "abstraction: what to say", rows: absRows.map((r) => r.slice()) },
        { id: "i", x: 380, y: 0, w: 230, title: "implementor: how to send", rows: impRows.map((r) => r.slice()) },
      ];
      const snap = (o) => fr.push({ inh, nodes: nodes(), made, m, n, ...o });
      snap({ line: 4, note: `<b>Bridge:</b> split the two dimensions into two hierarchies. <code>Message</code> <i>has an</i> <code>IChannel</code> field (that reference is the "bridge") instead of <i>being</i> one.`, vars: { messages: m, channels: n } });
      I.forEach((c) => { impRows.push([`  ${cap(c)}Channel`, "active"]); made++; snap({ line: 1, note: `Write <code>${cap(c)}Channel</code> once. It knows how to send; it knows nothing about alerts or reports.`, vars: { classes: made } }); impRows[impRows.length - 1][1] = "done"; });
      A.forEach((a) => { absRows.push([`  ${cap(a)}`, "active"]); made++; snap({ line: 9, note: `Write <code>${cap(a)}</code> once. It knows what to say; it delegates sending to whatever channel it's given.`, vars: { classes: made } }); absRows[absRows.length - 1][1] = "done"; });
      snap({ line: 7, note: `${m} + ${n} = <b>${m + n} classes</b> cover all ${m * n} combinations, chosen at runtime: <code>new ${cap(A[0])}(new ${cap(I[I.length - 1])}Channel(), …)</code>.`, vars: { classes: made, combinations: m * n } });
      impRows.push([`  ${cap(NEW)}Channel`, "bad"]);
      snap({ line: 1, final: true, done: true, note: `Product asks for <b>${cap(NEW)}</b>: <b>one new class</b>. Every existing message can use it immediately. (Compare: ${m} classes with inheritance.)`, vars: { classes: made + 1, added: 1 } });
      return fr;
    },
    render: (f) => {
      const total = f.inh ? f.made + (f.final ? f.m : 0) : f.made + (f.final ? 1 : 0);
      const body = f.inh
        ? Viz.grid(f.M, { rowLabels: f.rows, colLabels: f.cols, corner: "message ╲ channel", cls: f.cl })
        : boxGraph(f.nodes, [{ from: "a", row: 0, to: "i", toY: 33, label: "channel (has-a)", cls: "path" }], { label: "bridge: two hierarchies" });
      return col(`<div class="pt-fit">${body}</div>`,
        stats([["classes written", total, f.final ? (f.inh ? "bad" : "done") : ""], ["combinations covered", f.final ? f.m * (f.n + 1) : f.m * f.n], ["formula", f.inh ? "m × n" : "m + n", f.inh ? "bad" : "done"]]));
    },
  }));

  /* =====================================================================
   * 7. Flyweight: share the heavy, intrinsic part
   * ===================================================================== */
  const FW_MODES = ["shared glyphs (flyweight)", "one full object per character"];
  const FW_GLYPH = 1200, FW_EXT = 16, FW_REF = 8;
  Viz.register(P + "flyweight", (el) => Viz.player(el, {
    title: "Flyweight: the same 'e' a thousand times is one object",
    legend: [["active", "new glyph object created"], ["visit", "existing glyph reused"], ["done", "placed"]],
    codeLang: "csharp",
    code: [
      "public sealed record Glyph(char Ch, byte[] Outline);   // intrinsic: shared, immutable",
      "",
      "public sealed class GlyphFactory",
      "{",
      "    private readonly Dictionary<char, Glyph> pool = new();",
      "    public Glyph Get(char ch) =>",
      "        pool.TryGetValue(ch, out var g) ? g                 // reuse",
      "            : pool[ch] = new Glyph(ch, Font.LoadOutline(ch)); // create once",
      "}",
      "",
      "// extrinsic state lives outside, per placement: 16 bytes",
      "public readonly record struct Placed(Glyph Glyph, float X, float Y, Color Color);",
    ],
    inputs: [
      { key: "text", label: "text to lay out (≤ 32 chars)", value: "seventeen sleepy sheep", width: 240 },
      { key: "mode", label: "design", type: "select", options: FW_MODES, value: FW_MODES[0] },
    ],
    random: () => ({ text: ["banana bandana", "mississippi", "hello, hello, hello", "abracadabra", "tree three free"][Viz.rand(0, 4)], mode: FW_MODES[Math.random() < 0.7 ? 0 : 1] }),
    build: ({ text, mode }) => {
      const t = String(text);
      if (t.length < 1 || t.length > 32) throw new Error("Text: use 1 to 32 characters.");
      const fly = mode === FW_MODES[0], chars = [...t], fr = [], cls = {}, pool = new Map();
      let objs = 0;
      const mem = () => fly ? { heavy: pool.size * FW_GLYPH, light: placed * (FW_EXT + FW_REF) } : { heavy: objs * FW_GLYPH, light: placed * FW_EXT };
      let placed = 0;
      const snap = (o) => fr.push({ chars, cls: { ...cls }, pool: [...pool.entries()], fly, objs, placed, mem: mem(), naive: chars.length * (FW_GLYPH + FW_EXT), ...o });
      snap({ line: 0, note: `Each glyph's <b>intrinsic</b> state (the character's vector outline, about ${FW_GLYPH} bytes) is the same wherever it appears. Its <b>extrinsic</b> state (x, y, colour: ${FW_EXT} bytes) differs per placement. ${fly ? "Flyweight stores the first once and passes the second in." : "The naive design stores both in every object."}`, vars: { length: chars.length } });
      chars.forEach((ch, i) => {
        const show = ch === " " ? "␠" : ch;
        if (fly) {
          if (pool.has(ch)) { pool.get(ch).n++; cls[i] = "visit"; placed++; snap({ line: 6, note: `<code>${esc(show)}</code> at position ${i}: the factory already has that glyph, so <b>reuse</b> it. Only a ${FW_EXT}-byte placement plus an ${FW_REF}-byte reference is added.`, vars: { i, ch: show, pool: pool.size } }); }
          else { pool.set(ch, { n: 1, id: pool.size + 1 }); objs++; cls[i] = "active"; placed++; snap({ line: 7, note: `<code>${esc(show)}</code> at position ${i}: first time seen, so the factory <b>creates</b> glyph #${pool.size} and keeps it.`, vars: { i, ch: show, pool: pool.size } }); }
        } else { objs++; placed++; cls[i] = "active"; snap({ line: 11, note: `<code>${esc(show)}</code> at position ${i}: a <b>whole new object</b>, outline included${chars.indexOf(ch) < i ? `, even though an identical <code>${esc(show)}</code> already exists at position ${chars.indexOf(ch)}` : ""}.`, vars: { i, ch: show, objects: objs } }); }
        cls[i] = "done";
      });
      const m = mem(), naive = chars.length * (FW_GLYPH + FW_EXT), tot = m.heavy + m.light;
      snap({ line: 4, final: true, note: fly ? `${chars.length} characters, <b>${pool.size} glyph objects</b>. Memory: ${tot.toLocaleString("en-US")} bytes vs ${naive.toLocaleString("en-US")} naive (<b>${Math.round((1 - tot / naive) * 100)}% less</b>). A real document has millions of characters and about 100 distinct glyphs, so the saving approaches 99%. The price: glyphs must be <b>immutable</b>, and callers pass the extrinsic state in.` : `${chars.length} characters, <b>${objs} full objects</b>, ${naive.toLocaleString("en-US")} bytes. Only ${new Set(chars).size} of them are actually different. Switch to the flyweight design to compare.`, vars: { objects: fly ? pool.size : objs, bytes: tot } });
      return fr;
    },
    render: (f) => {
      const tot = f.mem.heavy + f.mem.light, pct = (v) => Math.max(0.5, (v / f.naive) * 100).toFixed(1);
      const bars = `<div class="pt-mem"><div class="pt-mem-row"><span>naive</span><div class="pt-mem-track"><div class="pt-mem-bar bad" style="width:100%"></div></div><b>${f.naive.toLocaleString("en-US")} B</b></div>`
        + `<div class="pt-mem-row"><span>${f.fly ? "flyweight" : "this design"}</span><div class="pt-mem-track"><div class="pt-mem-bar heavy" style="width:${pct(f.mem.heavy)}%" title="glyph outlines"></div><div class="pt-mem-bar light" style="width:${pct(f.mem.light)}%" title="placements"></div></div><b>${tot.toLocaleString("en-US")} B</b></div>`
        + `<div class="pt-mem-key"><i class="heavy"></i>outlines (intrinsic) <i class="light"></i>placements (extrinsic)</div></div>`;
      return col(
        Viz.array(f.chars.map((c) => (c === " " ? "␠" : c)), { label: "text, one placement per character", cls: (i) => f.cls[i] || "" }),
        panels(f.fly ? kv("glyph pool (intrinsic, shared)", f.pool.map(([c, g]) => [`'${c === " " ? "␠" : c}' glyph #${g.id}`, `used ×${g.n}`, g.n > 1 ? "visit" : ""]), { empty: "empty" }) : ""),
        bars,
        stats([["characters placed", f.placed], ["glyph objects", f.fly ? f.pool.length : f.objs, f.fly ? "done" : "bad"], ["distinct characters", new Set(f.chars.slice(0, f.placed)).size]]),
      );
    },
  }));

  /* =====================================================================
   * 8. Which structural pattern? decision chain
   * ===================================================================== */
  const SQ = [
    ["wrong", "Existing class has the wrong interface?", "vendor SDK, legacy API, old version", "ad", "Adapter", "wrap it and translate"],
    ["many", "Callers repeat a multi-step subsystem dance?", "same 5 calls in 3 places", "fa", "Facade", "one simple entry point"],
    ["add", "Add behaviour, keep the same interface?", "logging, retry, caching, metrics", "de", "Decorator", "stackable wrappers"],
    ["ctrl", "Control access, creation or location?", "lazy, permissions, remote", "px", "Proxy", "stand-in, same interface"],
    ["tree", "Part-whole tree, treated uniformly?", "folders, UI trees, rule groups", "co", "Composite", "leaf and group share a type"],
    ["dims", "Two dimensions vary independently?", "m × n subclasses appearing", "br", "Bridge", "has-a instead of is-a"],
    ["mem", "Many similar objects, memory measured?", "profiler shows duplicates", "fw", "Flyweight", "share immutable state"],
  ];
  const SN = {};
  SQ.forEach(([k, t, s, leaf, lt, ls], i) => {
    SN["q" + i] = { x: 230, y: 10 + i * 58, w: 360, t, s };
    SN[leaf] = { x: 620, y: 10 + i * 58, w: 230, t: lt, s: ls, leaf: 1 };
  });
  SN.pc = { x: 230, y: 10 + 7 * 58, w: 360, t: "Plain composition", s: "a field and a method call is enough", leaf: 1 };
  const SE = [];
  SQ.forEach(([, , , leaf], i) => { SE.push(["q" + i, leaf, "yes"]); SE.push(["q" + i, i < SQ.length - 1 ? "q" + (i + 1) : "pc", "no"]); });
  function sdSvg(cls, ecls) {
    const arrow = (x1, y1, x2, y2, c) => {
      const dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1, ux = dx / L, uy = dy / L;
      return `<path class="edge ${c}" d="M${x1},${y1} L${x2 - ux * 7},${y2 - uy * 7}"/><polygon class="${c ? "fill-" + c : "pt-mk"}" points="${x2},${y2} ${x2 - ux * 9 - uy * 4.5},${y2 - uy * 9 + ux * 4.5} ${x2 - ux * 9 + uy * 4.5},${y2 - uy * 9 - ux * 4.5}"/>`;
    };
    let s = '<svg class="dg pt-tree" viewBox="0 0 750 470" width="750" role="img" aria-label="Decision chain: which structural pattern?">';
    for (const [a, b, lab] of SE) {
      const A = SN[a], B = SN[b], c = ecls[`${a}-${b}`] || "";
      if (B.y === A.y) { const x1 = A.x + A.w / 2, x2 = B.x - B.w / 2, y = A.y + DH / 2; s += arrow(x1, y, x2, y, c) + `<text class="small ${c ? "" : "muted"}" x="${(x1 + x2) / 2}" y="${y - 5}" text-anchor="middle">${lab}</text>`; }
      else { const y1 = A.y + DH, y2 = B.y; s += arrow(A.x, y1, A.x, y2, c) + `<text class="small ${c ? "" : "muted"}" x="${A.x + 7}" y="${(y1 + y2) / 2 + 4}" text-anchor="start">${lab}</text>`; }
    }
    for (const [id, n] of Object.entries(SN)) {
      s += `<rect class="box ${cls[id] || ""}" x="${n.x - n.w / 2}" y="${n.y}" width="${n.w}" height="${DH}" rx="8"/>`;
      s += `<text class="pt-t" x="${n.x}" y="${n.y + 18}" text-anchor="middle">${esc(n.t)}</text><text class="pt-s" x="${n.x}" y="${n.y + 34}" text-anchor="middle">${esc(n.s)}</text>`;
    }
    return s + "</svg>";
  }
  const DH = 44;
  const SCEN = [
    ["Swap the SMS vendor without touching 40 callers", "wrong"],
    ["Web, mobile and admin all repeat the checkout steps", "many"],
    ["Time and retry every repository call", "add"],
    ["Load a 300 MB ML model only if a request needs it", "ctrl"],
    ["Price a bundle that contains items and other bundles", "tree"],
    ["Shapes × renderers (SVG, PDF, Canvas) keep multiplying", "dims"],
    ["Map editor: 2 million tiles of 12 kinds, OutOfMemory", "mem"],
    ["OrderService needs a clock and a repository", ""],
    ["custom: use my answers below", null],
  ];
  const YN = ["no", "yes"];
  const S_NOTE = {
    ad: "<b>Adapter.</b> Define the interface <i>you</i> want, then write one class that implements it by calling the vendor. Vendor types, units and errors stop at that class. In DDD this is an <i>anti-corruption layer</i>.",
    fa: "<b>Facade.</b> Put the sequence (and its undo rules) behind one method such as <code>PlaceOrderAsync</code>. Keep the subsystems public for the rare caller that needs them.",
    de: "<b>Decorator.</b> One small class per concern, each implementing the same interface and wrapping the next. In ASP.NET Core and HttpClient this is middleware and <code>DelegatingHandler</code>; in Python it's a function decorator.",
    px: "<b>Proxy.</b> Same interface, but the stand-in decides <i>whether, when or where</i> the real object runs: lazy creation (<code>Lazy&lt;T&gt;</code>), permission checks, remote stubs (gRPC), ORM lazy loading.",
    co: "<b>Composite.</b> Give leaves and groups one interface; groups forward the call to their children and combine the answers. Recursion replaces type checks.",
    br: "<b>Bridge.</b> Split the two dimensions into two hierarchies and connect them with a field. m + n classes instead of m × n.",
    fw: "<b>Flyweight.</b> Intern the immutable, repeated part in a factory or cache and pass the per-use state in. Only after a memory profile shows the duplicates.",
    pc: "<b>No named pattern needed.</b> Hold the dependency in a field (injected through the constructor) and call it. Most structure in good code is exactly this.",
  };
  Viz.register(P + "decide", (el) => Viz.player(el, {
    title: "Which structural pattern? Ask the questions in order",
    legend: [["active", "question being asked"], ["path", "answered no, keep going"], ["done", "use this"]],
    codeLang: "python",
    code: [
      "if wrong_interface:            return ADAPTER",
      "if callers_repeat_many_calls:  return FACADE",
      "if add_behaviour_same_iface:   return DECORATOR",
      "if control_access_or_location: return PROXY",
      "if part_whole_tree:            return COMPOSITE",
      "if two_independent_dimensions: return BRIDGE",
      "if many_objects_and_measured:  return FLYWEIGHT",
      "return PLAIN_COMPOSITION       # a field + a call",
    ],
    inputs: [
      { key: "scen", label: "scenario", type: "select", options: SCEN.map((x) => x[0]), value: SCEN[3][0] },
      ...SQ.map(([k, t]) => ({ key: k, label: { wrong: "wrong interface", many: "many calls", add: "add behaviour", ctrl: "control access", tree: "part-whole", dims: "2 dimensions", mem: "memory" }[k], type: "select", options: YN, value: "no" })),
    ],
    random: () => ({ scen: SCEN[Viz.rand(0, SCEN.length - 1)][0], ...Object.fromEntries(SQ.map(([k]) => [k, YN[Math.random() < 0.25 ? 1 : 0]])) }),
    build: (inp) => {
      const sc = SCEN.find((x) => x[0] === inp.scen);
      if (!sc) throw new Error("Pick one of the listed scenarios.");
      for (const [k] of SQ) if (!YN.includes(inp[k])) throw new Error(`Pick yes or no for "${k}".`);
      const custom = sc[1] === null;
      const yes = (k) => (custom ? inp[k] === "yes" : sc[1] === k);
      const fr = [], cls = {}, ecls = {};
      const snap = (o) => fr.push({ cls: { ...cls }, ecls: { ...ecls }, ...o });
      for (let i = 0; i < SQ.length; i++) {
        const [k, t, s, leaf] = SQ[i], q = "q" + i, y = yes(k);
        cls[q] = "active";
        snap({ line: i, note: `${i === 0 ? (custom ? "Using your answers. " : `Scenario: <i>${esc(sc[0])}</i>. `) : ""}<b>${esc(t)}</b> (${esc(s)}) → <b>${y ? "yes" : "no"}</b>.`, vars: { question: i + 1, answer: y ? "yes" : "no" } });
        cls[q] = "path";
        if (y) { ecls[`${q}-${leaf}`] = "done"; cls[leaf] = "done"; snap({ line: i, final: true, leaf, note: S_NOTE[leaf], vars: { answer: SN[leaf].t } }); return fr; }
        const nx = i < SQ.length - 1 ? "q" + (i + 1) : "pc";
        ecls[`${q}-${nx}`] = "path";
      }
      cls.pc = "done";
      snap({ line: 7, final: true, leaf: "pc", note: S_NOTE.pc, vars: { answer: "plain composition" } });
      return fr;
    },
    render: (f) => `<div class="pt-fit">${sdSvg(f.cls, f.ecls)}</div>${f.final ? verdict("→ " + SN[f.leaf].t, "done") : ""}`,
  }));
})();
