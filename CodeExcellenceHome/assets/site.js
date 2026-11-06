/* Shared learning-home behaviour. Keep DSAHome and CodeExcellenceHome copies identical. */
(() => {
  const home = document.documentElement.dataset.home || "learning-home";
  const store = {
    get(key) { try { return window.localStorage.getItem(`${home}-${key}`); } catch { return null; } },
    set(key, value) { try { window.localStorage.setItem(`${home}-${key}`, value); return true; } catch { return false; /* file:// may block storage */ } },
  };

  /* ---------- Topic search ---------- */
  const search = document.querySelector("#topic-search");
  const items = [...document.querySelectorAll(".topic-list li")];
  const tracks = [...document.querySelectorAll(".nav-track")];
  const empty = document.querySelector(".no-results");
  const initialOpen = tracks.map((t) => t.open);
  search?.addEventListener("input", () => {
    const q = search.value.trim().toLocaleLowerCase();
    items.forEach((li) => { li.hidden = q && !li.dataset.search.toLocaleLowerCase().includes(q); });
    tracks.forEach((t, i) => {
      const any = [...t.querySelectorAll("li")].some((li) => !li.hidden);
      t.hidden = !any;
      t.open = q ? any : initialOpen[i];
    });
    empty.hidden = items.some((li) => !li.hidden);
  });

  /* ---------- Theme ---------- */
  const button = document.querySelector("#theme-toggle");
  const prefersDark = window.matchMedia("(prefers-color-scheme: dark)");
  const saved = store.get("theme");
  let explicit = saved === "light" || saved === "dark";
  const applyTheme = (dark) => {
    document.documentElement.dataset.theme = dark ? "dark" : "light";
    button?.setAttribute("aria-pressed", String(dark));
    if (button) button.textContent = dark ? "Light appearance" : "Dark appearance";
    document.dispatchEvent(new CustomEvent("themechange"));
  };
  applyTheme(explicit ? saved === "dark" : prefersDark.matches);
  if (button) {
    button.hidden = false;
    button.addEventListener("click", () => {
      explicit = true;
      const dark = document.documentElement.dataset.theme !== "dark";
      applyTheme(dark);
      store.set("theme", dark ? "dark" : "light");
    });
  }
  prefersDark.addEventListener("change", (e) => { if (!explicit) applyTheme(e.matches); });

  /* ---------- Mastery progress ---------- */
  const readMastered = () => {
    try {
      const v = JSON.parse(store.get("mastered") || "[]");
      return new Set(Array.isArray(v) ? v.filter((s) => typeof s === "string") : []);
    } catch { return new Set(); }
  };
  const paintMastery = () => {
    const done = readMastered();
    document.querySelectorAll(".topic-list li[data-slug]").forEach((li) => li.classList.toggle("is-mastered", done.has(li.dataset.slug)));
    document.querySelectorAll(".topic-card[data-slug]").forEach((card) => {
      const on = done.has(card.dataset.slug);
      card.classList.toggle("is-mastered", on);
      const mark = card.querySelector(".mastered-mark");
      if (mark) mark.hidden = !on;
    });
    document.querySelectorAll(".mastery").forEach((b) => {
      const on = done.has(b.dataset.slug);
      b.setAttribute("aria-pressed", String(on));
      b.textContent = on ? "Mastered" : "Mark as mastered";
    });
    const count = document.querySelector(".progress-count");
    if (count) {
      const slugs = new Set([...document.querySelectorAll(".topic-card[data-slug]")].map((c) => c.dataset.slug));
      const n = [...done].filter((s) => slugs.has(s)).length;
      count.textContent = n;
      const total = Number(count.dataset.total) || 1;
      document.querySelector(".progress-bar span").style.width = `${(100 * n) / total}%`;
    }
  };
  document.querySelectorAll(".mastery").forEach((b) => b.addEventListener("click", () => {
    const done = readMastered();
    done.has(b.dataset.slug) ? done.delete(b.dataset.slug) : done.add(b.dataset.slug);
    const saved = store.set("mastered", JSON.stringify([...done]));
    paintMastery();
    let note = b.nextElementSibling?.classList.contains("mastery-note") ? b.nextElementSibling : null;
    if (!saved && !note) {
      note = Object.assign(document.createElement("span"), { className: "mastery-note" });
      note.setAttribute("role", "status");
      b.after(note);
    }
    if (note) note.textContent = saved ? "" : "Couldn't save: this browser is blocking storage for this page.";
  }));
  paintMastery();

  /* ---------- Progress export / import (no backend: a JSON file the reader keeps) ---------- */
  const tools = document.querySelector(".progress-tools");
  if (tools) {
    const status = tools.querySelector(".pt-status");
    const file = tools.querySelector(".pt-file");
    // Clear first so screen readers announce a repeated message too.
    const say = (msg, bad) => {
      status.textContent = "";
      status.classList.toggle("bad", !!bad);
      setTimeout(() => { status.textContent = bad ? `Error: ${msg}` : msg; }, 30);
    };
    const FORMAT = "learning-home-progress", VERSION = 1, MAX_BYTES = 256 * 1024, MAX_SLUGS = 2000;
    const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
    const known = new Set([...document.querySelectorAll(".topic-card[data-slug]")].map((c) => c.dataset.slug));
    const countKnown = (set) => [...set].filter((s) => known.has(s)).length;
    let ls = null;
    try { ls = window.localStorage; ls.setItem(`${home}-probe`, "1"); ls.removeItem(`${home}-probe`); } catch { ls = null; }
    tools.hidden = false;
    status.id ||= `${home}-progress-status`;
    tools.querySelectorAll("button").forEach((b) => b.setAttribute("aria-describedby", status.id));
    if (!ls) {
      tools.querySelectorAll("button").forEach((b) => { b.disabled = true; });
      say("this browser is blocking storage, so progress can't be saved, exported or imported here.", true);
    }
    tools.querySelector(".pt-export").addEventListener("click", () => {
      if (!ls) return;
      // Export everything stored, including topics this build doesn't list, so a backup never loses data.
      const data = { mastered: [...readMastered()] };
      for (const k of ["theme", "lang"]) { const v = store.get(k); if (v !== null) data[k] = v; }
      const payload = { format: FORMAT, version: VERSION, home, exportedAt: new Date().toISOString(), data };
      const url = URL.createObjectURL(new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" }));
      const a = Object.assign(document.createElement("a"), { href: url, download: `${home}-progress-${new Date().toISOString().slice(0, 10)}.json` });
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      const all = readMastered(), listed = countKnown(all), extra = all.size - listed;
      say(`Export started: ${listed} mastered topic(s)${extra ? ` (+${extra} for topics this version doesn't list)` : ""}. Your browser should save the file or ask where to put it.`);
    });
    tools.querySelector(".pt-import").addEventListener("click", () => { if (ls) file.click(); });
    file.addEventListener("change", async () => {
      const f = file.files[0];
      file.value = "";
      if (!f) return;
      if (f.size > MAX_BYTES) return say("that file is too large to be a progress file.", true);
      let payload;
      try { payload = JSON.parse(await f.text()); } catch { return say("that file isn't valid JSON.", true); }
      if (!payload || payload.format !== FORMAT || !payload.data || typeof payload.data !== "object") return say("that isn't a progress file exported from this site.", true);
      const version = payload.version ?? 1;
      if (!Number.isInteger(version) || version < 1) return say("that progress file has an invalid version number.", true);
      if (version > VERSION) return say(`that file comes from a newer version of this site (format ${version}). Reload the page, or update this copy of the site, then try again.`, true);
      if (payload.home !== home) return say(`that file is for ${typeof payload.home === "string" ? `"${payload.home}"` : "another home"}, not this one.`, true);
      // Older format versions would be migrated to the current shape here, oldest first.
      const { mastered, theme, lang } = payload.data;
      let incoming = mastered;
      if (typeof incoming === "string") { try { incoming = JSON.parse(incoming); } catch { incoming = null; } }
      if (!Array.isArray(incoming)) return say("that file's mastered list is unreadable.", true);
      const slugs = incoming.filter((s) => typeof s === "string" && s.length <= 100 && SLUG_RE.test(s));
      const before = readMastered();
      const merged = new Set([...before, ...slugs]);
      if (merged.size > MAX_SLUGS) return say(`that would store more than ${MAX_SLUGS} topics, which is more than any copy of this site has. Nothing was changed.`, true);
      try { ls.setItem(`${home}-mastered`, JSON.stringify([...merged])); } catch {
        return say("this browser refused to save the imported progress (storage full or blocked). Nothing was changed.", true);
      }
      paintMastery();
      const unsaved = [];
      if (theme === "dark" || theme === "light") {
        try { ls.setItem(`${home}-theme`, theme); explicit = true; applyTheme(theme === "dark"); } catch { unsaved.push("theme"); }
      }
      if (typeof lang === "string" && lang.length <= 40) {
        try { ls.setItem(`${home}-lang`, lang); } catch { unsaved.push("language"); }
      }
      const unlisted = new Set(slugs.filter((s) => !known.has(s))).size;
      const invalid = incoming.length - slugs.length;
      say([
        `Imported: ${countKnown(merged) - countKnown(before)} new, ${countKnown(merged)} of ${known.size} topics mastered.`,
        unlisted ? `Kept ${unlisted} for topics this version doesn't list.` : "",
        invalid ? `Ignored ${invalid} invalid entr${invalid === 1 ? "y" : "ies"}.` : "",
        unsaved.length ? `Your ${unsaved.join(" and ")} preference couldn't be saved.` : "",
      ].filter(Boolean).join(" "));
    });
  }

  /* ---------- Syntax highlighting (small, offline, good-enough) ---------- */
  const KW = {
    python: "and as assert async await break class continue def del elif else except False finally for from global if import in is lambda None nonlocal not or pass raise return True try while with yield self cls match case",
    csharp: "abstract as async await base bool break byte case catch char checked class const continue decimal default delegate do double else enum event explicit extern false finally fixed float for foreach goto if implicit in int interface internal is lock long namespace new null object operator out override params private protected public readonly record ref return sbyte sealed short sizeof stackalloc static string struct switch this throw true try typeof uint ulong unchecked unsafe ushort using var virtual void volatile while yield get set init required when where with nameof value let from select",
    java: "abstract assert boolean break byte case catch char class const continue default do double else enum extends final finally float for if implements import instanceof int interface long native new null package private protected public record return short static super switch synchronized this throw throws transient true false try var void volatile while yield sealed permits",
    go: "break case chan const continue default defer else fallthrough for func go goto if import interface map package range return select struct switch type var nil true false iota",
    typescript: "abstract any as async await boolean break case catch class const constructor continue declare default delete do else enum export extends false finally for from function get if implements import in instanceof interface keyof let new null number of private protected public readonly return set static string super switch this throw true try type typeof undefined var void while yield",
    rust: "as async await break const continue crate dyn else enum extern false fn for if impl in let loop match mod move mut pub ref return self Self static struct super trait true type unsafe use where while Some None Ok Err",
    kotlin: "as break class continue do else false for fun if in interface is null object package return super this throw true try typealias val var when while by companion data sealed override open private public internal suspend",
    sql: "select from where join inner left right outer on group by order having insert into values update set delete create table index primary key foreign references as and or not null is in exists limit offset distinct union all case when then else end with begin commit rollback transaction",
    bash: "if then else fi for do done while case esac function return in export local echo",
  };
  KW.cs = KW.csharp; KW.ts = KW.typescript; KW.javascript = KW.js = KW.typescript; KW.py = KW.python;
  KW.powershell = "if else elseif foreach for while function param return try catch finally switch in";
  KW.sh = KW.bash; KW.kt = KW.kotlin; KW.rs = KW.rust;
  const HASH_COMMENT = new Set(["python", "py", "bash", "sh", "powershell", "yaml", "toml"]);
  const SQL_COMMENT = new Set(["sql"]);
  const escapeHtml = (s) => s.replace(/[&<>]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c]));
  const highlight = (code, lang) => {
    const kw = new Set((KW[lang] || "").split(" ").filter(Boolean));
    if (!kw.size) return null;
    const ci = lang === "sql";
    const com = HASH_COMMENT.has(lang) ? String.raw`#[^\n]*` : SQL_COMMENT.has(lang) ? String.raw`--[^\n]*` : String.raw`\/\/[^\n]*|\/\*[\s\S]*?\*\/`;
    const str = String.raw`"""[\s\S]*?"""|'''[\s\S]*?'''|[fbrFBR]?@?\$?"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|` + "`(?:[^`\\\\]|\\\\.)*`";
    const re = new RegExp(`(${com})|(${str})|(\\b0x[0-9a-fA-F_]+\\b|\\b\\d[\\d_]*(?:\\.\\d+)?(?:[eE][+-]?\\d+)?[fFdDmMlLuU]?\\b)|([A-Za-z_][A-Za-z0-9_]*)`, "g");
    let out = "", last = 0, m;
    while ((m = re.exec(code))) {
      out += escapeHtml(code.slice(last, m.index));
      const t = escapeHtml(m[0]);
      if (m[1]) out += `<span class="tok-com">${t}</span>`;
      else if (m[2]) out += `<span class="tok-str">${t}</span>`;
      else if (m[3]) out += `<span class="tok-num">${t}</span>`;
      else {
        const word = ci ? m[0].toLowerCase() : m[0];
        const after = code.slice(re.lastIndex).match(/^\s*(.)/);
        if (kw.has(word)) out += `<span class="tok-kw">${t}</span>`;
        else if (after && after[1] === "(") out += `<span class="tok-fn">${t}</span>`;
        else if (/^[A-Z]/.test(m[0]) && lang !== "sql") out += `<span class="tok-type">${t}</span>`;
        else out += t;
      }
      last = re.lastIndex;
    }
    return out + escapeHtml(code.slice(last));
  };
  window.LearningHome = { highlight, escapeHtml };
  const LABEL = { python: "Python", py: "Python", csharp: "C#", cs: "C#", java: "Java", go: "Go", typescript: "TypeScript", ts: "TypeScript",
    javascript: "JavaScript", js: "JavaScript", rust: "Rust", rs: "Rust", kotlin: "Kotlin", kt: "Kotlin", sql: "SQL", bash: "Bash", sh: "Shell",
    powershell: "PowerShell", json: "JSON", yaml: "YAML", text: "Text", http: "HTTP", cpp: "C++", xml: "XML" };
  const langOf = (code) => ((code.className.match(/language-([\w+-]+)/) || [])[1] || "").toLowerCase();

  document.querySelectorAll(".prose pre > code").forEach((code) => {
    const lang = langOf(code);
    const hl = highlight(code.textContent, lang);
    if (hl !== null) code.innerHTML = hl;
    const pre = code.parentElement;
    const copy = document.createElement("button");
    copy.type = "button"; copy.className = "copy-btn"; copy.textContent = "Copy";
    copy.addEventListener("click", async () => {
      try { await navigator.clipboard.writeText(code.textContent); copy.textContent = "Copied"; }
      catch { copy.textContent = "Select & Ctrl+C"; }
      setTimeout(() => { copy.textContent = "Copy"; }, 1400);
    });
    pre.append(copy);
  });

  /* ---------- Language-synced code tabs ---------- */
  const groups = [];
  document.querySelectorAll(".code-tabs").forEach((box) => {
    const pres = [...box.querySelectorAll(":scope > pre, :scope > div > pre")];
    if (pres.length < 1) return;
    const custom = (box.dataset.labels || "").split(",").map((s) => s.trim()).filter(Boolean);
    const bar = document.createElement("div");
    bar.className = "tab-bar"; bar.setAttribute("role", "tablist");
    const tabs = pres.map((pre, i) => {
      const lang = langOf(pre.querySelector("code") || pre);
      const label = custom[i] || LABEL[lang] || lang || `Tab ${i + 1}`;
      const b = document.createElement("button");
      b.type = "button"; b.setAttribute("role", "tab"); b.textContent = label; b.dataset.label = label;
      b.addEventListener("click", () => { select(label); store.set("lang", label); });
      bar.append(b);
      return { b, pre, label };
    });
    box.prepend(bar);
    const show = (label) => {
      const hit = tabs.find((t) => t.label === label) || null;
      if (!hit) return false;
      tabs.forEach((t) => { const on = t === hit; t.pre.hidden = !on; t.b.setAttribute("aria-selected", String(on)); });
      return true;
    };
    groups.push({ show, first: tabs[0].label });
  });
  const select = (label) => groups.forEach((g) => g.show(label) || null);
  const pref = store.get("lang");
  groups.forEach((g) => { if (!(pref && g.show(pref))) g.show(g.first); });

  /* ---------- Current section in contents ---------- */
  const tocLinks = [...document.querySelectorAll(".on-this-page a")];
  if (tocLinks.length && "IntersectionObserver" in window) {
    const map = new Map(tocLinks.map((a) => [decodeURIComponent(a.hash.slice(1)), a]));
    const obs = new IntersectionObserver((entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting && map.has(e.target.id)) {
          tocLinks.forEach((a) => a.classList.remove("is-current"));
          map.get(e.target.id).classList.add("is-current");
        }
      });
    }, { rootMargin: "0px 0px -75% 0px" });
    document.querySelectorAll(".prose h2[id], .prose h3[id]").forEach((h) => obs.observe(h));
  }
})();
