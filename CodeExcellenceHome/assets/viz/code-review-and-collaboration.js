/* Code review and collaboration visualizers. Every registered name is prefixed "code-review-and-collaboration-". */
(() => {
  const P = "code-review-and-collaboration-";
  const esc = Viz.esc;
  const pick = (a) => a[Math.floor(Math.random() * a.length)];
  const rng = (seed) => () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const verdict = (cls, head, sub) => `<div class="cr-verdict ${cls}">${esc(head)}${sub ? `<small>${sub}</small>` : ""}</div>`;
  const stats = (items) => `<div class="cr-stats">${items.map(([l, v, c]) => `<div class="cr-stat ${c || ""}"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join("")}</div>`;
  const fnv = (s) => { let h = 0x811c9dc5; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  const hex7 = (s) => fnv(s).toString(16).padStart(8, "0").slice(0, 7);
  const seedOf = (s) => {
    const n = Number.parseInt(String(s).trim(), 10);
    if (!Number.isFinite(n) || n < 0 || n > 1e9 || !/^\s*\d+\s*$/.test(String(s))) throw new Error("Seed must be a whole number between 0 and 1,000,000,000.");
    return n;
  };
  const fmt1 = (x) => (Math.round(x * 10) / 10).toFixed(1);

  /* =====================================================================
   * 1. Branching workflows: four developers, ten working days, the same
   *    seeded backlog. Each workflow decides when work merges and when it
   *    reaches production. Integration "overlap" = own commits x commits that
   *    landed on the target meanwhile; each overlapping pair conflicts with
   *    probability 3%.
   * ===================================================================== */
  const WF = ["trunk-based", "GitHub flow", "GitFlow"];
  const DEVS = ["Ana", "Ben", "Chen", "Dee"];
  const DAYS = 10;
  const RELEASE_CUT = 5, RELEASE_SHIP = 7, HOTFIX = 8, NEXT_SHIP = 12;
  function wfBacklog(seed) {
    const r = rng(seed);
    return DEVS.map((d, di) => {
      const feats = [];
      let t = 0, n = 1;
      while (t < DAYS) { const size = 1 + Math.floor(r() * 4); feats.push({ dev: di, id: `${d[0]}${n++}`, start: t, size, end: t + size }); t += size; }
      return feats;
    });
  }
  function wfRun(wf, seed) {
    const backlog = wfBacklog(seed);
    const branches = [];
    const deploys = [];
    const released = [];
    const target = wf === "GitFlow" ? "develop" : "main";
    backlog.flat().forEach((f, k) => {
      if (wf === "trunk-based") {
        for (let d = f.start; d < Math.min(f.end, DAYS); d++) {
          branches.push({ lane: f.dev, from: d + 0.05, merge: d + 0.9, commits: 1, target, feat: f.id, alt: k % 2, last: d + 1 === f.end });
        }
        if (f.end <= DAYS) released.push({ id: f.id, lead: f.size - 0.1, at: f.end - 0.1 });
      } else {
        const wait = f.size <= 2 ? 0.5 : 1;
        const merge = f.end - 0.1 + wait;
        branches.push({ lane: f.dev, from: f.start + 0.05, done: f.end - 0.1, merge, commits: f.size, target, feat: f.id, alt: k % 2 });
        if (wf === "GitHub flow" && merge <= DAYS) released.push({ id: f.id, lead: merge - f.start, at: merge });
        if (wf === "GitFlow" && merge <= DAYS) {
          const ship = merge <= RELEASE_CUT ? RELEASE_SHIP : NEXT_SHIP;
          released.push({ id: f.id, lead: ship - f.start, at: ship, projected: ship > DAYS });
        }
      }
    });
    if (wf === "GitFlow") {
      branches.push({ lane: "release", from: RELEASE_CUT, merge: RELEASE_SHIP, commits: 2, target: "main", feat: "release/1.4", alsoTo: "develop" });
      branches.push({ lane: "release", from: HOTFIX, merge: HOTFIX + 0.5, commits: 1, target: "main", feat: "hotfix/1.4.1", alsoTo: "develop", hotfix: true });
      deploys.push(RELEASE_SHIP, HOTFIX + 0.5);
    } else {
      branches.forEach((b) => { if (b.merge <= DAYS) deploys.push(b.merge); });
    }
    const pr = rng(seed * 7 + 3);
    branches.sort((a, b) => a.merge - b.merge);
    branches.forEach((b) => {
      const incoming = branches.filter((o) => o !== b && o.target === b.target && o.merge > b.from && o.merge < b.merge).reduce((s, o) => s + o.commits, 0);
      b.incoming = incoming;
      b.overlap = b.commits * incoming;
      b.conflict = b.merge <= DAYS && pr() < 1 - 0.97 ** b.overlap;
      b.life = Math.min(b.merge, DAYS) - b.from;
    });
    const merged = branches.filter((b) => b.merge <= DAYS);
    const real = released.filter((x) => !x.projected && x.at <= DAYS);
    return {
      wf, backlog, branches, deploys, released,
      summary: {
        inProd: real.length,
        lead: real.length ? real.reduce((s, x) => s + x.lead, 0) / real.length : 0,
        longest: Math.max(...branches.map((b) => b.life)),
        merges: merged.length,
        overlap: merged.reduce((s, b) => s + b.overlap, 0),
        conflicts: merged.filter((b) => b.conflict).length,
        deploys: deploys.filter((d) => d <= DAYS).length,
      },
    };
  }
  const WF_NOTE = {
    "trunk-based": "<b>Trunk-based development</b>: everyone merges small changes to <code>main</code> at least daily. Unfinished features ship dark behind a feature flag, and every merge is deployable.",
    "GitHub flow": "<b>GitHub flow</b>: one short branch per feature, a pull request, review, merge to <code>main</code>, deploy. Bigger PRs wait longer for review (half a day up to 2 days of work, a full day above that).",
    GitFlow: "<b>GitFlow</b>: features merge into <code>develop</code>. A <code>release/*</code> branch is cut on day 5, stabilized for 2 days and merged to <code>main</code> (and back to develop). Hotfixes branch from <code>main</code>.",
  };
  Viz.register(P + "workflows", (el) => Viz.player(el, {
    title: "Branching workflows: same team, same backlog, different integration",
    tag: "SEEDED SIMULATION · 10 DAYS",
    legend: [["active", "branch open (work in progress)"], ["done", "merged cleanly"], ["bad", "merged with a conflict"], ["path", "deploy to production"]],
    inputs: [
      { key: "wf", label: "workflow", type: "select", options: WF, value: WF[0], width: 170 },
      { key: "seed", label: "seed", value: "11", width: 70 },
    ],
    random: () => ({ wf: pick(WF), seed: String(1 + Math.floor(Math.random() * 999)) }),
    build: ({ wf, seed }) => {
      if (!WF.includes(wf)) throw new Error("Pick a workflow.");
      const sd = seedOf(seed);
      const all = WF.map((w) => wfRun(w, sd));
      const me = all.find((x) => x.wf === wf);
      const feats = me.backlog.flat();
      const frames = [{ wf, all, me, day: 0, note: `${WF_NOTE[wf]} The backlog is the same for every workflow: ${feats.length} features of 1–4 days across ${DEVS.length} developers. Integration risk is modelled as <i>overlap</i>: your commits × the commits that landed on the target while your branch was open. Each overlapping pair conflicts with a 3% chance.` }];
      for (let d = 1; d <= DAYS; d++) {
        const today = me.branches.filter((b) => b.merge > d - 1 && b.merge <= d);
        const conf = today.filter((b) => b.conflict);
        const rel = me.released.filter((x) => x.at > d - 1 && x.at <= d && !x.projected);
        let note = `Day ${d}: ${today.length ? `${today.length} merge${today.length > 1 ? "s" : ""}` : "no merges"}${conf.length ? `, <b>${conf.length} with a conflict</b> (${conf.map((b) => `${esc(b.feat)}: ${b.commits} own × ${b.incoming} incoming`).join("; ")})` : ""}. ${rel.length ? `In production today: ${rel.map((x) => esc(x.id)).join(", ")}.` : "Nothing new reaches users today."}`;
        if (wf === "GitFlow" && d === RELEASE_CUT) note += " The release branch is cut: anything merged to develop after today waits for the next release.";
        if (wf === "GitFlow" && d === RELEASE_SHIP) note += " Release 1.4 merges to main and deploys. It also has to merge back into develop.";
        if (wf === "GitFlow" && d === HOTFIX + 1) note += " A production bug: the hotfix branches from main, ships, and must also be merged into develop.";
        if (wf === "trunk-based" && d === 3) note += " Branches live less than a day, so there's almost nothing to conflict with. Unfinished features are merged too, hidden behind flags.";
        if (wf === "GitHub flow" && d === 4) note += " Watch the longer bars: a 4-day branch collects every merge the others made in those 4 days.";
        frames.push({ wf, all, me, day: d, note });
      }
      const rows = all.map((x) => ({ wf: x.wf, ...x.summary }));
      const best = rows.reduce((a, b) => (b.inProd > a.inProd || (b.inProd === a.inProd && b.lead < a.lead) ? b : a));
      frames.push({ wf, all, me, day: DAYS, final: true, rows, best: best.wf, note: `After 10 days with the same backlog: ${rows.map((x) => `${esc(x.wf)} put <b>${x.inProd}</b> features in production (average lead time ${fmt1(x.lead)} days, ${x.conflicts} conflicts)`).join("; ")}. Short-lived branches mean small overlaps and fast feedback. Long-lived branches mean overlap grows with the <i>product</i> of branch length and team activity. GitFlow still fits software with versioned releases that customers install; for a continuously deployed service it mostly adds waiting.` });
      return frames;
    },
    render: (f) => {
      const me = f.me, gf = f.wf === "GitFlow";
      const X0 = 92, DW = 76, xOf = (d) => X0 + Math.min(d, DAYS) * DW;
      const laneY = {};
      let y = 34;
      laneY.main = y; y += 36;
      if (gf) { laneY.release = y; y += 34; laneY.develop = y; y += 40; }
      DEVS.forEach((_, i) => { laneY[i] = y; y += 36; });
      const H = y + 14, W = X0 + DAYS * DW + 20;
      const day = f.day;
      let s = "";
      for (let d = 0; d <= DAYS; d++) s += `<line class="edge dash" x1="${xOf(d)}" y1="18" x2="${xOf(d)}" y2="${H - 22}" opacity="${d <= day ? 0.35 : 0.12}"/>${d < DAYS ? `<text class="small muted" x="${xOf(d) + DW / 2}" y="${H - 8}" text-anchor="middle">day ${d + 1}</text>` : ""}`;
      const lane = (k, label, cls) => `<text class="small" x="8" y="${laneY[k] + 4}" font-weight="700">${esc(label)}</text><line class="edge ${cls}" x1="${X0}" y1="${laneY[k]}" x2="${xOf(Math.max(day, 0.02))}" y2="${laneY[k]}"/>`;
      s += lane("main", "main", "accent");
      if (gf) { s += `<text class="small" x="8" y="${laneY.release + 4}" font-weight="700">release/hotfix</text>`; s += lane("develop", "develop", "accent"); }
      DEVS.forEach((d, i) => { s += `<text class="small" x="8" y="${laneY[i] + 4}">${esc(d)}</text>`; });
      me.branches.forEach((b) => {
        if (b.from >= day) return;
        const ly = laneY[b.lane] + (typeof b.lane === "number" ? (b.alt ? 5 : -5) : 0);
        const end = Math.min(b.merge, day);
        const merged = b.merge <= day;
        const cls = merged ? (b.conflict ? "bad" : "done") : "active";
        const x1 = xOf(b.from), x2 = Math.max(xOf(end), x1 + 3);
        if (b.done !== undefined && b.done < end) {
          s += `<rect class="box ${cls}" x="${x1}" y="${ly - 5}" width="${Math.max(xOf(b.done) - x1, 3)}" height="10" rx="3"/><line class="edge dash" x1="${xOf(b.done)}" y1="${ly}" x2="${x2}" y2="${ly}"/>`;
        } else {
          s += `<rect class="box ${cls}" x="${x1}" y="${ly - 5}" width="${x2 - x1}" height="10" rx="3"/>`;
        }
        if (typeof b.lane === "number" && f.wf !== "trunk-based" && x2 - x1 > 26) s += `<text class="small mono" x="${x1 + 4}" y="${ly + (b.alt ? 17 : -8)}">${esc(b.feat)}</text>`;
        if (typeof b.lane !== "number") s += `<text class="small mono" x="${x1 + 4}" y="${ly - 8}">${esc(b.feat)}</text>`;
        if (b.lane === "release") s += `<line class="edge" x1="${x1}" y1="${b.hotfix ? laneY.main : laneY.develop}" x2="${x1}" y2="${ly}"/>`;
        if (merged) {
          s += `<line class="edge ${b.conflict ? "bad" : "done"}" x1="${xOf(b.merge)}" y1="${ly}" x2="${xOf(b.merge)}" y2="${laneY[b.target]}"/>`;
          if (b.alsoTo) s += `<line class="edge dash ${b.conflict ? "bad" : ""}" x1="${xOf(b.merge) + 4}" y1="${ly}" x2="${xOf(b.merge) + 4}" y2="${laneY[b.alsoTo]}"/>`;
          if (b.conflict) s += `<circle class="fill-bad" cx="${xOf(b.merge)}" cy="${laneY[b.target]}" r="4"/>`;
        }
      });
      me.deploys.forEach((d) => { if (d <= day) s += `<path class="fill-path" d="M${xOf(d) - 5},${laneY.main - 13} L${xOf(d) + 5},${laneY.main - 13} L${xOf(d)},${laneY.main - 5} z"/>`; });
      const svg = `<svg class="dg cr-lanes" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="${esc(f.wf)} branch timeline up to day ${day}">${s}</svg>`;
      const merged = me.branches.filter((b) => b.merge <= day);
      const live = me.released.filter((x) => x.at <= day && !x.projected);
      const st = stats([
        ["day", `${day} / ${DAYS}`, ""],
        ["features in production", live.length, "done"],
        ["merges", merged.length, ""],
        ["overlap so far", merged.reduce((a, b) => a + b.overlap, 0), ""],
        ["conflicts", merged.filter((b) => b.conflict).length, merged.some((b) => b.conflict) ? "bad" : ""],
        ["longest open branch", `${fmt1(Math.max(0, ...me.branches.filter((b) => b.from < day).map((b) => Math.min(b.merge, day) - b.from)))} d`, ""],
      ]);
      const table = f.final ? `<table class="cr-tbl"><tr><th>workflow</th><th>in prod</th><th>avg lead (days)</th><th>longest branch</th><th>overlap</th><th>conflicts</th><th>deploys</th></tr>${f.rows.map((x) => `<tr class="${x.wf === f.best ? "cr-good" : ""} ${x.wf === f.wf ? "cr-cur" : ""}"><td>${esc(x.wf)}</td><td>${x.inProd}</td><td>${fmt1(x.lead)}</td><td>${fmt1(x.longest)} d</td><td>${x.overlap}</td><td>${x.conflicts}</td><td>${x.deploys}</td></tr>`).join("")}</table>${verdict(f.best === f.wf ? "done" : "active", `most delivered: ${f.best}`, "same backlog, same seed, different integration habits")}` : "";
      return `<div class="cr-col">${svg}${st}${table}</div>`;
    },
  }));

  /* =====================================================================
   * 2. Merge vs rebase vs squash: a real commit DAG. Hashes are computed
   *    from parents + message + tree, so rewritten commits get new hashes.
   * ===================================================================== */
  const MG = ["merge commit (--no-ff)", "rebase, then fast-forward", "squash merge", "interactive rebase (fixup), then fast-forward"];
  const MG_CONF = ["no conflict", "C1, C2 and E edit the same line"];
  function mgBuild(strat, conflict) {
    const C = {};
    const mk = (id, msg, parents, changes, x, y) => {
      const tree = [...new Set([...parents.flatMap((p) => C[p].changes), ...changes])].sort();
      const hash = hex7(parents.map((p) => C[p].hash).join(",") + "|" + msg + "|" + tree.join(","));
      C[id] = { id, msg, parents, changes: tree, hash, x, y };
      return C[id];
    };
    const Y = { main: 56, feat: 176, rew: 116 };
    mk("A", "chore: initial commit", [], ["init"], 50, Y.main);
    mk("B", "feat(api): add /orders", ["A"], ["orders"], 130, Y.main);
    const snaps = [];
    const snap = (cmd, note, nodes, refs, extra = {}) => snaps.push({ cmd, note, nodes: nodes.map((n) => ({ ...C[n.id || n], cls: n.cls || "" })), refs, ...extra });
    snap("git log --oneline", "Start: <code>main</code> has two commits. Every commit's hash is computed from its parents, its message and its content, so a commit is identified by its whole history.", ["A", "B"], [["main", "B"]]);
    mk("C1", "feat(parser): add tokenizer", ["B"], ["tokenizer"], 230, Y.feat);
    mk("C2", "fix typo", ["C1"], ["typo"], 310, Y.feat);
    mk("C3", "wip tests", ["C2"], ["tests"], 390, Y.feat);
    const feat3 = ["C1", "C2", "C3"];
    snap("git switch -c feature && (commit × 3)", "You branch from B and make three commits. Typical real-world history: one real change, a typo fix and a work-in-progress commit.", ["A", "B", ...feat3], [["main", "B"], ["feature", "C3"]]);
    mk("D", "chore(deps): bump express", ["B"], ["deps"], 230, Y.main);
    mk("E", "fix(login): handle expired session", ["D"], ["login"], 310, Y.main);
    snap("git fetch && git status", `Meanwhile two commits land on main. Your branch is now <b>3 ahead and 2 behind</b>.${conflict ? " E changed a line in <code>auth.ts</code> that C1 and C2 also changed." : ""} Now integrate, in one of four ways.`, ["A", "B", "D", "E", ...feat3], [["main", "E"], ["feature", "C3"]]);
    const base = ["A", "B", "D", "E"];
    const old = (cls) => feat3.map((id) => ({ id, cls }));
    let resolutions = 0;
    if (strat === MG[0]) {
      mk("M", "Merge branch 'feature'", ["E", "C3"], conflict ? ["resolved"] : [], 470, Y.main);
      resolutions = conflict ? 1 : 0;
      snap("git switch main && git merge --no-ff feature", `A <b>merge commit</b> M with two parents: E and C3. Nothing is rewritten; the feature's three commits keep their hashes.${conflict ? " The conflict is resolved <b>once</b>, inside M." : ""}`, [...base, ...feat3, { id: "M", cls: "new" }], [["main", "M"], ["feature", "C3"]], { log: [`*   ${C.M.hash} (HEAD -> main) Merge branch 'feature'`, "|\\", `| * ${C.C3.hash} (feature) wip tests`, `| * ${C.C2.hash} fix typo`, `| * ${C.C1.hash} feat(parser): add tokenizer`, `* | ${C.E.hash} fix(login): handle expired session`, `* | ${C.D.hash} chore(deps): bump express`, "|/", `* ${C.B.hash} feat(api): add /orders`, `* ${C.A.hash} chore: initial commit`] });
    } else if (strat === MG[1] || strat === MG[3]) {
      const fix = strat === MG[3];
      if (fix) {
        snap("git rebase -i main", "The todo list:<br><code>pick C1 feat(parser): add tokenizer</code><br><code>fixup C2 fix typo</code><br><code>reword C3 test(parser): cover tokenizer edge cases</code><br>Clean up history <i>before</i> others see it.", [...base, ...feat3], [["main", "E"], ["feature", "C3"]]);
        mk("C1r", "feat(parser): add tokenizer", ["E"], ["tokenizer", "typo"], 390, Y.rew);
        if (conflict) resolutions++;
        snap("pick C1 + fixup C2 → C1′", `C1 and C2 are replayed onto E as <b>one</b> commit C1′. New parent, so <b>new hash</b> (${C.C1.hash} → ${C.C1r.hash}).${conflict ? " The conflict with E is resolved once here, because both edits are now one commit." : ""}`, [...base, ...old("ghost"), { id: "C1r", cls: "new" }], [["main", "E"], ["feature", "C1r"]]);
        mk("C3r", "test(parser): cover tokenizer edge cases", ["C1r"], ["tests"], 470, Y.rew);
        snap("reword C3 → C3′", "C3 is replayed with a meaningful message. The originals are now unreachable (the reflog keeps them for about 90 days).", [...base, ...old("ghost"), "C1r", { id: "C3r", cls: "new" }], [["main", "E"], ["feature", "C3r"]]);
        C.C1r.x = 390; C.C1r.y = Y.main; C.C3r.x = 470; C.C3r.y = Y.main;
        snap("git switch main && git merge --ff-only feature", "Fast-forward: <code>main</code> just moves to C3′. A linear history of <b>two meaningful commits</b>, each of which builds and passes tests.", [...base, ...old("ghost"), "C1r", "C3r"], [["main", "C3r"], ["feature", "C3r"]], { log: [`* ${C.C3r.hash} (HEAD -> main, feature) test(parser): cover tokenizer edge cases`, `* ${C.C1r.hash} feat(parser): add tokenizer`, `* ${C.E.hash} fix(login): handle expired session`, `* ${C.D.hash} chore(deps): bump express`, `* ${C.B.hash} feat(api): add /orders`, `* ${C.A.hash} chore: initial commit`] });
      } else {
        const ids = [];
        feat3.forEach((id, i) => {
          const nid = id + "r";
          mk(nid, C[id].msg, [i === 0 ? "E" : feat3[i - 1] + "r"], [C[id].changes.filter((c) => !C[i === 0 ? "B" : feat3[i - 1]].changes.includes(c))[0]], 390 + i * 80, Y.rew);
          ids.push(nid);
          const hit = conflict && i < 2;
          if (hit) resolutions++;
          snap(`git rebase main   (replaying ${id})`, `${id} is replayed on top of ${i === 0 ? "E" : feat3[i - 1] + "′"} as ${id}′. Same change, new parent, so a <b>new hash</b>: ${C[id].hash} → ${C[nid].hash}.${hit ? ` <b>Conflict</b>: ${id} touches the line E changed. Resolve, <code>git add</code>, <code>git rebase --continue</code>.${i === 1 ? " That's the <b>second</b> time you resolve the same conflict, once per commit that touches it (<code>git rerere</code> can remember resolutions)." : ""}` : ""}`, [...base, ...old("ghost"), ...ids.map((n, j) => ({ id: n, cls: j === ids.length - 1 ? "new" : "" }))], [["main", "E"], ["feature", nid]], { stop: hit });
        });
        ids.forEach((n, i) => { C[n].x = 390 + i * 80; C[n].y = Y.main; });
        snap("git switch main && git merge --ff-only feature", "Fast-forward: <code>main</code> moves to C3′. History is <b>linear</b>, but all three commits were rewritten. If <code>feature</code> was already pushed and someone else built on it, you now need <code>git push --force-with-lease</code>, and they need to rebase too.", [...base, ...old("ghost"), ...ids], [["main", "C3r"], ["feature", "C3r"]], { log: [`* ${C.C3r.hash} (HEAD -> main, feature) wip tests`, `* ${C.C2r.hash} fix typo`, `* ${C.C1r.hash} feat(parser): add tokenizer`, `* ${C.E.hash} fix(login): handle expired session`, `* ${C.D.hash} chore(deps): bump express`, `* ${C.B.hash} feat(api): add /orders`, `* ${C.A.hash} chore: initial commit`] });
      }
    } else {
      mk("S", "feat(parser): add tokenizer (#42)", ["E"], ["tokenizer", "typo", "tests"], 390, Y.main);
      resolutions = conflict ? 1 : 0;
      snap("git switch main && git merge --squash feature && git commit", `All three commits' changes become <b>one new commit</b> S on main, with the PR title as its message.${conflict ? " The conflict is resolved once, while creating S." : ""}`, [...base, ...old(""), { id: "S", cls: "new" }], [["main", "S"], ["feature", "C3"]]);
      snap("git branch -D feature   (GitHub does this on merge)", "The branch is deleted. C1–C3 are no longer reachable: main has one tidy commit per PR, but the step-by-step history is gone from main (the PR page still shows it).", [...base, ...old("ghost"), "S"], [["main", "S"]], { log: [`* ${C.S.hash} (HEAD -> main) feat(parser): add tokenizer (#42)`, `* ${C.E.hash} fix(login): handle expired session`, `* ${C.D.hash} chore(deps): bump express`, `* ${C.B.hash} feat(api): add /orders`, `* ${C.A.hash} chore: initial commit`] });
    }
    return { snaps, resolutions };
  }
  const MG_PROPS = [
    ["merge commit (--no-ff)", "no", "3 + merge", "yes", "no", "the merge (whole feature) or any commit"],
    ["rebase, then fast-forward", "yes", "3 (rewritten)", "no", "yes, if already pushed", "each commit, including \"fix typo\""],
    ["squash merge", "yes", "1 per PR", "no", "no", "the whole PR as one commit"],
    ["interactive rebase (fixup), then fast-forward", "yes", "2 meaningful", "no", "yes, if already pushed", "each meaningful commit"],
  ];
  Viz.register(P + "merge", (el) => Viz.player(el, {
    title: "Merge, rebase or squash: what happens to the commit graph",
    tag: "REAL DAG · HASHES FROM CONTENT",
    legend: [["active", "new commit"], ["done", "on main"], ["visit", "on the feature branch"], ["bad", "conflict stop"]],
    inputs: [
      { key: "strat", label: "integrate with", type: "select", options: MG, value: MG[1], width: 330 },
      { key: "conf", label: "conflict", type: "select", options: MG_CONF, value: MG_CONF[0], width: 260 },
    ],
    random: () => ({ strat: pick(MG), conf: pick(MG_CONF) }),
    build: ({ strat, conf }) => {
      if (!MG.includes(strat) || !MG_CONF.includes(conf)) throw new Error("Pick a strategy and a conflict scenario.");
      const { snaps, resolutions } = mgBuild(strat, conf === MG_CONF[1]);
      const frames = snaps.map((s) => ({ ...s, strat }));
      const last = frames[frames.length - 1];
      last.final = true;
      last.resolutions = resolutions;
      last.note += ` Conflict resolutions needed: <b>${resolutions}</b>.`;
      return frames;
    },
    render: (f) => {
      const byId = Object.fromEntries(f.nodes.map((n) => [n.id, n]));
      let s = "";
      s += `<text class="small muted" x="8" y="60">main</text><text class="small muted" x="8" y="180">feature</text>`;
      if (f.nodes.some((n) => n.y === 116)) s += `<text class="small muted" x="8" y="120">rebased</text>`;
      f.nodes.forEach((n) => n.parents.forEach((p) => { const q = byId[p]; if (q) s += `<line class="edge ${n.cls === "ghost" ? "dash" : ""}" x1="${q.x}" y1="${q.y}" x2="${n.x}" y2="${n.y}" opacity="${n.cls === "ghost" ? 0.4 : 1}"/>`; }));
      f.nodes.forEach((n) => {
        const onMain = f.refs.some(([r, at]) => r === "main" && reach(byId, at).has(n.id));
        const cls = n.cls === "new" ? (f.stop ? "bad" : "active") : n.cls === "ghost" ? "" : onMain ? "done" : "visit";
        const lbl = n.id.replace("r", "′");
        s += `<g opacity="${n.cls === "ghost" ? 0.35 : 1}"><circle class="box ${cls}" cx="${n.x}" cy="${n.y}" r="17"/><text class="small mono" x="${n.x}" y="${n.y + 4}" text-anchor="middle" font-weight="700">${esc(lbl)}</text><text class="small mono muted" x="${n.x}" y="${n.y + 31}" text-anchor="middle">${n.hash}</text></g>`;
      });
      const stack = {};
      f.refs.forEach(([r, at]) => {
        const n = byId[at];
        const k = stack[at] = (stack[at] || 0) + 1;
        const yy = n.y - 24 - (k - 1) * 18;
        s += `<rect class="box ${r === "main" ? "accent" : "path"}" x="${n.x - 30}" y="${yy - 13}" width="60" height="16" rx="8"/><text class="small mono" x="${n.x}" y="${yy - 1}" text-anchor="middle">${esc(r)}</text>`;
      });
      const svg = `<svg class="dg cr-dag" viewBox="0 0 600 220" width="600" role="img" aria-label="commit graph">${s}</svg>`;
      const msgs = `<table class="cr-tbl cr-msgs"><tr><th>commit</th><th>hash</th><th>message</th></tr>${f.nodes.filter((n) => n.cls !== "ghost").map((n) => `<tr><td>${esc(n.id.replace("r", "′"))}</td><td>${n.hash}</td><td>${esc(n.msg)}</td></tr>`).join("")}</table>`;
      const cmd = `<div class="cr-cmd"><span>$</span><code>${esc(f.cmd)}</code></div>`;
      const props = f.final ? `<table class="cr-tbl cr-props"><tr><th>strategy</th><th>linear</th><th>commits on main</th><th>keeps hashes</th><th>needs force-push</th><th>revert / bisect unit</th></tr>${MG_PROPS.map((p) => `<tr class="${p[0] === f.strat ? "cr-cur" : ""}">${p.map((c) => `<td>${esc(c)}</td>`).join("")}</tr>`).join("")}</table>` : "";
      const right = f.final ? `<pre class="cr-log">${esc(["$ git log --oneline --graph", ...f.log].join("\n"))}</pre>` : msgs;
      return `<div class="cr-col">${cmd}<div class="cr-split"><div class="cr-split-l">${svg}</div><div class="cr-split-r">${right}</div></div>${props}</div>`;
    },
  }));
  function reach(byId, at) {
    const seen = new Set();
    const st = [at];
    while (st.length) { const id = st.pop(); if (!id || seen.has(id) || !byId[id]) continue; seen.add(id); st.push(...byId[id].parents); }
    return seen;
  }

  /* =====================================================================
   * 3. PR size: the same feature with the same seeded defects (about one
   *    per 100 lines), shipped as one big PR, three sequential PRs, or six
   *    stacked PRs. Detection probability falls above ~200 changed lines
   *    (reviewers skim), and big PRs wait longer before anyone starts.
   * ===================================================================== */
  const PS_TOTAL = ["400 lines", "800 lines", "1600 lines"];
  const PS_SPLIT = ["1 big PR", "3 PRs, one after another", "6 stacked PRs"];
  const CODE_RATE = 100, REVIEW_RATE = 300;
  const pDetect = (L) => (L <= 200 ? 0.8 : 0.8 * (200 / L) ** 0.9);
  const waitH = (L) => 1 + (L / 100) ** 1.5;
  function psRun(total, split, seed) {
    const r = rng(seed);
    const defects = Array.from({ length: Math.round(total / 100) }, () => ({ line: Math.floor(r() * total), u: r() })).sort((a, b) => a.line - b.line);
    defects.forEach((d, i) => { d.id = i + 1; });
    const n = split === PS_SPLIT[0] ? 1 : split === PS_SPLIT[1] ? 3 : 6;
    const stacked = n === 6;
    const prs = [];
    let prevMerge = 0, prevRework = false;
    for (let i = 0; i < n; i++) {
      const lo = Math.round((i * total) / n), hi = Math.round(((i + 1) * total) / n), size = hi - lo;
      const codeStart = stacked ? (lo / CODE_RATE) : (i === 0 ? 0 : prevMerge);
      const codeEnd = codeStart + size / CODE_RATE;
      const wait = waitH(size);
      const revStart = codeEnd + wait, revEnd = revStart + size / REVIEW_RATE;
      const p = pDetect(size);
      const mine = defects.filter((d) => d.line >= lo && d.line < hi);
      mine.forEach((d) => { d.caught = d.u < p; d.pr = i; d.at = revEnd; });
      const caught = mine.filter((d) => d.caught).length;
      const rework = caught ? 0.5 + caught * 0.25 + wait / 2 + size / REVIEW_RATE / 2 : 0;
      const restack = stacked && i > 0 && prevRework ? 0.25 * 1 : 0;
      const fixEnd = revEnd + rework;
      const merge = Math.max(fixEnd + restack, stacked ? prevMerge + 0.1 : 0);
      prs.push({ i, lo, hi, size, codeStart, codeEnd, revStart, revEnd, fixEnd, merge, p, caught, found: mine.length, restack, wait });
      prevMerge = merge;
      prevRework = prevRework || caught > 0;
    }
    const caught = defects.filter((d) => d.caught).length;
    return { split, n, prs, defects, lead: prevMerge, caught, escaped: defects.length - caught, reviewerH: prs.reduce((s, x) => s + x.size / REVIEW_RATE * (x.caught ? 1.5 : 1), 0), size: prs[0].size, p: prs[0].p };
  }
  Viz.register(P + "prsize", (el) => Viz.player(el, {
    title: "PR size: one big PR vs small PRs vs stacked PRs",
    tag: "SEEDED MODEL · DEFECTS ~1 / 100 LINES",
    legend: [["visit", "writing code"], ["active", "in review"], ["bad", "rework after review comments"], ["done", "merged / defect caught"], ["path", "escaped defect"]],
    inputs: [
      { key: "total", label: "feature size", type: "select", options: PS_TOTAL, value: PS_TOTAL[2], width: 130 },
      { key: "split", label: "ship it as", type: "select", options: PS_SPLIT, value: PS_SPLIT[0], width: 230 },
      { key: "seed", label: "seed", value: "15", width: 70 },
    ],
    random: () => ({ total: pick(PS_TOTAL), split: pick(PS_SPLIT), seed: String(1 + Math.floor(Math.random() * 999)) }),
    build: ({ total, split, seed }) => {
      if (!PS_TOTAL.includes(total) || !PS_SPLIT.includes(split)) throw new Error("Pick a feature size and a split.");
      const T = Number.parseInt(total, 10), sd = seedOf(seed);
      const all = PS_SPLIT.map((s) => psRun(T, s, sd));
      const me = all.find((x) => x.split === split);
      const scale = Math.max(...all.map((x) => x.lead));
      const base = { all, me, scale, T };
      const frames = [{ ...base, t: 0, note: `A ${T}-line feature hides <b>${me.defects.length} defects</b> (about one per 100 lines, same positions for every split). A reviewer catches each defect with probability ${Math.round(pDetect(200) * 100)}% when a PR is ≤ 200 lines, falling as PRs grow: at ${me.size} lines it's <b>${Math.round(me.p * 100)}%</b>. Big PRs also wait longer before anyone starts reviewing them.${me.n === 6 ? " <b>Stacked</b>: each PR is based on the previous one, so you keep coding while earlier PRs are in review." : me.n === 3 ? " <b>Sequential</b>: you open the next PR only after the previous one merges." : ""}` }];
      const ev = [];
      me.prs.forEach((p) => {
        ev.push({ t: p.codeEnd, txt: `PR #${p.i + 1} opened: ${p.size} lines (lines ${p.lo + 1}–${p.hi}). Waiting ${fmt1(p.wait)} h for a reviewer.` });
        ev.push({ t: p.revEnd, txt: `PR #${p.i + 1} reviewed in ${fmt1(p.size / REVIEW_RATE)} h: caught <b>${p.caught} of ${p.found}</b> defect${p.found === 1 ? "" : "s"} (detection ${Math.round(p.p * 100)}%).${p.caught ? " The author fixes them and the reviewer looks again." : p.found ? " Everything else ships." : ""}` });
        ev.push({ t: p.merge, txt: `PR #${p.i + 1} merged at hour ${fmt1(p.merge)}.${p.restack ? " (Restacked first: an earlier PR in the stack changed, so this branch was rebased onto it.)" : ""}` });
      });
      ev.sort((a, b) => a.t - b.t).forEach((e) => frames.push({ ...base, t: e.t, note: `Hour ${fmt1(e.t)}. ${e.txt}` }));
      const best = all.reduce((a, b) => (b.escaped < a.escaped || (b.escaped === a.escaped && b.lead < a.lead) ? b : a));
      frames.push({ ...base, t: me.lead, final: true, best: best.split, note: `Same code, same defects. ${all.map((x) => `${esc(x.split)}: <b>${x.escaped}</b> escaped, merged after ${fmt1(x.lead)} h`).join("; ")}. Small PRs get reviewed sooner <i>and</i> more carefully. Stacking removes the waiting between them. The cost is restacking when an earlier PR changes, which tools like Graphite, ghstack, git-branchless or <code>git rebase --update-refs</code> automate.` });
      return frames;
    },
    render: (f) => {
      const me = f.me, t = f.t, W = 660, X0 = 70, sx = (h) => X0 + (Math.min(h, t) / f.scale) * (W - X0 - 16);
      const rowH = 26, top = 70;
      const H = top + me.n * rowH + 26;
      let s = `<text class="small muted" x="8" y="22">defects</text><rect class="box" x="${X0}" y="12" width="${W - X0 - 16}" height="16" rx="3"/>`;
      const lx = (line) => X0 + (line / f.T) * (W - X0 - 16);
      me.prs.forEach((p) => { if (p.i) s += `<line class="edge" x1="${lx(p.lo)}" y1="8" x2="${lx(p.lo)}" y2="32"/>`; s += `<text class="small muted" x="${(lx(p.lo) + lx(p.hi)) / 2}" y="46" text-anchor="middle">#${p.i + 1}</text>`; });
      me.defects.forEach((d) => { const known = d.at <= t; const cls = !known ? "fill-visit" : d.caught ? "fill-done" : "fill-path"; s += `<circle class="${cls}" cx="${lx(d.line)}" cy="20" r="5"/>`; if (known && !d.caught) s += `<text class="small" x="${lx(d.line)}" y="24" text-anchor="middle" font-weight="700">!</text>`; });
      s += `<line class="edge dash" x1="${sx(t)}" y1="${top - 8}" x2="${sx(t)}" y2="${H - 18}"/><text class="small muted" x="${X0}" y="${H - 4}">0 h</text><text class="small muted" x="${W - 16}" y="${H - 4}" text-anchor="end">${fmt1(f.scale)} h</text>`;
      me.prs.forEach((p) => {
        const y = top + p.i * rowH;
        s += `<text class="small" x="8" y="${y + 13}">PR #${p.i + 1}</text>`;
        const seg = (a, b, cls) => (a < t ? `<rect class="box ${cls}" x="${sx(a)}" y="${y + 2}" width="${Math.max(sx(b) - sx(a), 1)}" height="14" rx="3"/>` : "");
        s += seg(p.codeStart, p.codeEnd, "visit");
        if (p.codeEnd < t) s += `<line class="edge dash" x1="${sx(p.codeEnd)}" y1="${y + 9}" x2="${sx(p.revStart)}" y2="${y + 9}"/>`;
        s += seg(p.revStart, p.revEnd, "active");
        if (p.fixEnd > p.revEnd) s += seg(p.revEnd, p.fixEnd, "bad");
        if (p.merge <= t) s += `<circle class="fill-done" cx="${sx(p.merge)}" cy="${y + 9}" r="6"/>`;
      });
      const svg = `<svg class="dg cr-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="PR timeline">${s}</svg>`;
      const known = me.defects.filter((d) => d.at <= t);
      const st = stats([
        ["PR size", `${me.size} lines`, me.size > 400 ? "bad" : me.size <= 200 ? "done" : ""],
        ["detection per defect", `${Math.round(me.p * 100)}%`, ""],
        ["caught", known.filter((d) => d.caught).length, "done"],
        ["escaped", known.filter((d) => !d.caught).length, known.some((d) => !d.caught) ? "bad" : ""],
        ["hour", fmt1(t), ""],
      ]);
      const table = f.final ? `<table class="cr-tbl"><tr><th>ship as</th><th>PR size</th><th>detection</th><th>caught</th><th>escaped</th><th>merged after</th><th>reviewer time</th></tr>${f.all.map((x) => `<tr class="${x.split === f.best ? "cr-good" : ""} ${x.split === me.split ? "cr-cur" : ""}"><td>${esc(x.split)}</td><td>${x.size}</td><td>${Math.round(x.p * 100)}%</td><td>${x.caught}</td><td>${x.escaped}</td><td>${fmt1(x.lead)} h</td><td>${fmt1(x.reviewerH)} h</td></tr>`).join("")}</table>${verdict(me.escaped === 0 ? "done" : me.escaped > 2 ? "bad" : "active", `${me.escaped} defect${me.escaped === 1 ? "" : "s"} escaped to production`, "Smaller is better up to the point where a PR no longer makes sense on its own.")}` : "";
      return `<div class="cr-col">${svg}${st}${table}</div>`;
    },
  }));

  /* =====================================================================
   * 4. Review checklist with an attention budget. Each sample diff has
   *    planted issues; each costs minutes to spot. A reviewer working in
   *    priority order spends attention on what matters first.
   * ===================================================================== */
  const CATS = ["correctness", "design", "security", "tests", "readability", "nits"];
  const CK_DIFFS = {
    "order search endpoint (TypeScript)": {
      file: "src/routes/orders.ts",
      lines: [
        'import { Router } from "express";',
        'import { db } from "../db";',
        'import {log} from "../log"',
        "",
        "export const orders = Router();",
        "",
        'orders.get("/orders/search", async (req, res) => {',
        "  const q = req.query.q as string;",
        "  const page = Number(req.query.page ?? 1);",
        "  const d = await db.query(",
        "    `SELECT * FROM orders WHERE customer LIKE '%${q}%'",
        "     LIMIT 50 OFFSET ${page * 50}`);",
        '  log.info("search " + q);',
        "  res.json(d.rows);",
        "});",
      ],
      issues: [
        { line: 3, cat: "nits", sev: "nit", cost: 1, text: "spacing and the missing semicolon. Prettier would fix this." },
        { line: 9, cat: "nits", sev: "nit", cost: 1, text: "I'd write <code>req.query.page || 1</code> here." },
        { line: 14, cat: "nits", sev: "nit", cost: 1, text: "<code>res.status(200).json(...)</code> is more explicit." },
        { line: 10, cat: "readability", sev: "suggestion", cost: 1, text: "<code>d</code> → <code>result</code>; the name should say what it holds." },
        { line: 12, cat: "readability", sev: "suggestion", cost: 1, text: "magic number 50 appears twice. Extract <code>PAGE_SIZE</code>." },
        { line: 12, cat: "correctness", sev: "blocking", cost: 3, text: "pages start at 1, so <code>OFFSET page * 50</code> skips the first 50 rows. Use <code>(page - 1) * 50</code>." },
        { line: 11, cat: "design", sev: "suggestion", cost: 2, text: "<code>SELECT *</code> returns every column to the client. Select and map to a response DTO." },
        { line: 11, cat: "security", sev: "blocking", cost: 2, text: "<b>SQL injection</b>: <code>q</code> is concatenated into SQL. Use a parameter: <code>LIKE $1</code> with <code>[`%${q}%`]</code>." },
        { line: 7, cat: "security", sev: "blocking", cost: 3, text: "no auth or tenant filter: any caller can search every customer's orders." },
        { line: 13, cat: "security", sev: "question", cost: 1, text: "search terms may contain personal data. Should we log them?" },
        { line: 15, cat: "tests", sev: "blocking", cost: 2, text: "no tests for paging, an empty query, or a query containing <code>'</code>." },
      ],
      praise: "async/await keeps the handler readable.",
    },
    "payment retry (C#)": {
      file: "Payments/PaymentService.cs",
      lines: [
        "public async Task<Receipt> PayAsync(Order order)",
        "{",
        "    for (int i = 0; i < 5; i++)",
        "    {",
        "        try",
        "        {",
        '            _log.LogInformation("Charging card {Card}", order.CardNumber);',
        "            return await _gateway.ChargeAsync(order.Total, order.CardNumber);",
        "        }",
        "        catch (Exception)",
        "        {",
        "            Thread.Sleep(1000);",
        "        }",
        "    }",
        "    return null;",
        "}",
      ],
      issues: [
        { line: 3, cat: "nits", sev: "nit", cost: 1, text: "<code>i</code> → <code>attempt</code>." },
        { line: 5, cat: "nits", sev: "nit", cost: 1, text: "I prefer a blank line before <code>try</code>." },
        { line: 1, cat: "nits", sev: "nit", cost: 1, text: "should this be <code>ValueTask</code>?" },
        { line: 3, cat: "readability", sev: "suggestion", cost: 1, text: "5 and 1000 are magic numbers. Move them to options." },
        { line: 15, cat: "correctness", sev: "blocking", cost: 2, text: "returns <code>null</code> after the last failure. The caller gets a NullReferenceException far from the cause. Throw instead." },
        { line: 8, cat: "correctness", sev: "blocking", cost: 3, text: "retrying a <b>non-idempotent charge</b> without an idempotency key can charge the customer twice." },
        { line: 10, cat: "correctness", sev: "blocking", cost: 2, text: "catches everything: a declined card or a cancellation is retried 5 times. Retry only transient errors." },
        { line: 12, cat: "design", sev: "suggestion", cost: 2, text: "<code>Thread.Sleep</code> blocks a thread in async code. Use a resilience pipeline with exponential backoff and jitter." },
        { line: 7, cat: "security", sev: "blocking", cost: 2, text: "<b>logs the full card number</b> (PCI DSS violation). Log the order id and the last 4 digits at most." },
        { line: 16, cat: "tests", sev: "blocking", cost: 2, text: "no tests for retry behaviour. Use a fake gateway and a fake <code>TimeProvider</code> so they run instantly." },
      ],
      praise: "the async signature is right for an I/O call.",
    },
    "profile cache (Python)": {
      file: "profiles/service.py",
      lines: [
        "_cache = {}",
        "",
        "def get_profile(user_id, fields=[]):",
        "    if user_id in _cache:",
        "        return _cache[user_id]",
        "    profile = repo.load(user_id)",
        '    fields.append("email")',
        "    result = {f: profile[f] for f in fields}",
        "    _cache[user_id] = result",
        "    return result",
        "",
        "def update_profile(user_id, data):",
        "    repo.save(user_id, data)",
      ],
      issues: [
        { line: 1, cat: "nits", sev: "nit", cost: 1, text: "<code>_cache</code> → <code>_profile_cache</code>." },
        { line: 8, cat: "nits", sev: "nit", cost: 1, text: "<code>f</code> → <code>field</code> in the comprehension." },
        { line: 12, cat: "nits", sev: "nit", cost: 1, text: "two blank lines between top-level functions (PEP 8). Ruff would flag it." },
        { line: 3, cat: "readability", sev: "suggestion", cost: 1, text: "add type hints: <code>fields: Sequence[str] | None = None</code>, <code>-&gt; dict[str, Any]</code>." },
        { line: 3, cat: "correctness", sev: "blocking", cost: 2, text: "mutable default <code>fields=[]</code>: line 7 appends to the <i>same</i> list on every call." },
        { line: 4, cat: "correctness", sev: "blocking", cost: 3, text: "the cache key ignores <code>fields</code>: a second caller asking for other fields gets the first caller's dict." },
        { line: 13, cat: "correctness", sev: "blocking", cost: 2, text: "<code>update_profile</code> never invalidates the cache, so reads stay stale forever." },
        { line: 1, cat: "design", sev: "suggestion", cost: 2, text: "an unbounded module-level dict grows forever and isn't shared across workers. Use a TTL/LRU cache or a shared cache." },
        { line: 5, cat: "security", sev: "question", cost: 2, text: "is <code>user_id</code> unique across tenants? If not, this cache can leak one tenant's profile to another." },
        { line: 13, cat: "tests", sev: "blocking", cost: 2, text: "no test for update-then-get, which would have caught the stale cache." },
      ],
      praise: "small functions with clear names.",
    },
  };
  const CK_STYLE = ["priority order (correctness → nits)", "nit-first: style & naming, then top to bottom", "priority order, linter handles nits"];
  const CK_BUDGET = ["15 minutes", "30 minutes", "60 minutes"];
  const LABEL = { blocking: "issue (blocking)", suggestion: "suggestion", nit: "nit (non-blocking)", question: "question", praise: "praise" };
  function ckRun(diff, style, budget) {
    const D = CK_DIFFS[diff];
    const issues = D.issues.map((x, k) => ({ ...x, k }));
    const events = [];
    let t = 0;
    let plan;
    if (style === CK_STYLE[1]) {
      const deep = issues.filter((x) => x.cat !== "nits" && x.cat !== "readability").sort((a, b) => a.line - b.line);
      plan = [...issues.filter((x) => x.cat === "nits"), ...issues.filter((x) => x.cat === "readability"), ...deep].map((x) => ({ ...x, spend: x.cat === "nits" ? 2 : x.cat === "readability" ? x.cost : x.cost * 1.5 }));
    } else {
      events.push({ t: 2, kind: "read", text: "Read the PR description and the tests first: what is this change <i>supposed</i> to do?" });
      t = 2;
      if (style === CK_STYLE[2]) issues.filter((x) => x.cat === "nits").forEach((x) => events.push({ t: 2, kind: "bot", issue: x }));
      plan = CATS.flatMap((c) => issues.filter((x) => x.cat === c && !(style === CK_STYLE[2] && c === "nits")).sort((a, b) => a.line - b.line)).map((x) => ({ ...x, spend: x.cost }));
    }
    let out = false;
    plan.forEach((x) => {
      if (out) return;
      if (t + x.spend > budget) { out = true; events.push({ t, kind: "out" }); return; }
      t += x.spend;
      events.push({ t, kind: "found", issue: x });
    });
    const foundK = new Set(events.filter((e) => e.issue).map((e) => e.issue.k));
    const missed = issues.filter((x) => !foundK.has(x.k));
    return { D, issues, events, missed, used: t, foundK };
  }
  Viz.register(P + "checklist", (el) => Viz.player(el, {
    title: "Review in priority order: where does your attention go?",
    tag: "ATTENTION BUDGET MODEL",
    legend: [["bad", "blocking issue"], ["active", "suggestion / question"], ["visit", "nit"], ["done", "caught"]],
    inputs: [
      { key: "diff", label: "pull request", type: "select", options: Object.keys(CK_DIFFS), value: Object.keys(CK_DIFFS)[0], width: 260 },
      { key: "style", label: "reviewer", type: "select", options: CK_STYLE, value: CK_STYLE[0], width: 320 },
      { key: "budget", label: "attention", type: "select", options: CK_BUDGET, value: CK_BUDGET[0], width: 130 },
    ],
    random: () => ({ diff: pick(Object.keys(CK_DIFFS)), style: pick(CK_STYLE), budget: pick(CK_BUDGET) }),
    build: ({ diff, style, budget }) => {
      if (!CK_DIFFS[diff] || !CK_STYLE.includes(style) || !CK_BUDGET.includes(budget)) throw new Error("Pick a pull request, a reviewer style and a budget.");
      const B = Number.parseInt(budget, 10);
      const run = ckRun(diff, style, B);
      const blocking = run.issues.filter((x) => x.sev === "blocking");
      const base = { run, B, style };
      const frames = [{ ...base, upto: 0, note: `This PR contains <b>${run.issues.length} planted issues</b>, ${blocking.length} of them blocking. Spotting each one costs a few minutes of focused attention. You have <b>${B} minutes</b> before the next meeting, about what a real review gets. ${style === CK_STYLE[1] ? "This reviewer starts with what jumps out: formatting and naming. Nits invite discussion, so each costs about 2 minutes, and deep problems found while reading top to bottom take 1.5× longer to see." : style === CK_STYLE[2] ? "Formatting is enforced by the linter in CI, so a bot posts the nits and the human goes straight to correctness." : "This reviewer goes pass by pass: correctness, design, security, tests, readability, then nits."}` }];
      run.events.forEach((e, i) => {
        let note;
        if (e.kind === "read") note = `Minute ${e.t}. ${e.text} Without that, you can only check that the code looks tidy, not that it's right.`;
        else if (e.kind === "bot") note = `Linter bot: <code>${esc(LABEL.nit)}</code> on line ${e.issue.line}. ${e.issue.text} No human attention spent.`;
        else if (e.kind === "out") note = `Minute ${fmt1(e.t)}. <b>Out of attention.</b> The next item would take longer than the time left. ${run.missed.filter((x) => x.sev === "blocking").length ? `<b>${run.missed.filter((x) => x.sev === "blocking").length} blocking issue${run.missed.filter((x) => x.sev === "blocking").length === 1 ? "" : "s"}</b> never got looked at.` : "Only lower-priority items are left."}`;
        else note = `Minute ${fmt1(e.t)}, ${e.issue.cat} pass: <code>${esc(LABEL[e.issue.sev])}:</code> line ${e.issue.line}: ${e.issue.text}`;
        frames.push({ ...base, upto: i + 1, cur: e, note });
      });
      const missB = run.missed.filter((x) => x.sev === "blocking");
      frames.push({ ...base, upto: run.events.length, final: true, note: `${missB.length ? `The PR gets approved with <b>${missB.length} blocking issue${missB.length === 1 ? "" : "s"}</b> still in it (${missB.map((x) => `line ${x.line}, ${x.cat}`).join("; ")}), while ${run.events.filter((e) => e.issue && e.issue.sev === "nit" && e.kind === "found").length} nits got human attention.` : `All ${blocking.length} blocking issues were caught: <b>request changes</b>.`} The order of the checklist is the point. Correctness and security deserve your freshest attention; formatting deserves none, so automate it. End with one <code>praise:</code> comment: ${esc(run.D.praise)}` });
      return frames;
    },
    render: (f) => {
      const run = f.run;
      const shown = run.events.slice(0, f.upto);
      const found = new Map();
      shown.forEach((e) => { if (e.issue) found.set(e.issue.k, e); });
      const marks = {};
      run.issues.forEach((x) => { (marks[x.line] = marks[x.line] || []).push(x); });
      const curLine = f.cur && f.cur.issue ? f.cur.issue.line : -1;
      const code = run.D.lines.map((ln, i) => {
        const n = i + 1, ms = marks[n] || [];
        const dots = ms.map((x) => { const ok = found.has(x.k); const show = ok || f.final; if (!show) return ""; const cls = ok ? "done" : x.sev === "blocking" ? "bad" : x.sev === "nit" ? "visit" : "active"; return `<i class="cr-dot ${cls}" title="${esc(x.cat)}"></i>`; }).join("");
        return `<div class="cr-ln ${n === curLine ? "cr-ln-cur" : ""}"><span class="cr-no">${n}</span><span class="cr-dots">${dots}</span><code>${esc(ln) || " "}</code></div>`;
      }).join("");
      const passState = CATS.map((c) => {
        const all = run.issues.filter((x) => x.cat === c);
        const got = all.filter((x) => found.has(x.k)).length;
        const cls = got === all.length && all.length ? "done" : f.cur && f.cur.issue && f.cur.issue.cat === c ? "active" : f.final && got < all.length ? "bad" : "";
        return `<span class="cr-chip ${cls}">${esc(c)} ${got}/${all.length}</span>`;
      }).join("");
      const comments = shown.filter((e) => e.issue).map((e) => `<li class="cr-cm ${e === f.cur ? "cr-cm-cur" : ""} ${e.issue.sev === "blocking" ? "cr-cm-block" : ""}"><b>${esc(e.kind === "bot" ? "lint-bot" : "reviewer")}</b> · line ${e.issue.line}<br><code>${esc(LABEL[e.issue.sev])}:</code> ${e.issue.text}</li>`).reverse().join("");
      const used = shown.reduce((m, e) => Math.max(m, e.t || 0), 0);
      const pct = Math.min(100, (used / f.B) * 100);
      const bar = `<div class="cr-budget"><span>attention used</span><div><i style="width:${pct}%"></i></div><b>${fmt1(used)} / ${f.B} min</b></div>`;
      const missB = run.missed.filter((x) => x.sev === "blocking").length;
      const fin = f.final ? verdict(missB ? "bad" : "done", missB ? `approved with ${missB} blocking issue${missB === 1 ? "" : "s"} unseen` : "request changes: every blocking issue caught", `${run.foundK.size} of ${run.issues.length} issues commented on · praise: ${esc(run.D.praise)}`) : "";
      return `<div class="cr-col"><div class="cr-chips">${passState}</div>${bar}<div class="cr-split"><div class="cr-split-l"><div class="cr-code"><div class="cr-file">${esc(run.D.file)}</div>${code}</div></div><div class="cr-split-r"><ul class="cr-thread">${comments || '<li class="cr-cm cr-empty">no comments yet</li>'}</ul></div></div>${fin}</div>`;
    },
  }));

  /* =====================================================================
   * 5. Conventional Commits: parse, lint, and compute the next semantic
   *    version and changelog, like release-please or semantic-release do.
   * ===================================================================== */
  const CC_TYPES = ["feat", "fix", "perf", "refactor", "docs", "test", "build", "ci", "chore", "style", "revert"];
  const CC_PRESETS = {
    "tidy history": ["feat(cart): add coupon codes", "fix(cart): round totals to whole cents", "docs: explain coupon stacking rules", "perf(search): cache tokenized queries", "test(cart): cover expired coupons", "chore(deps): bump express to 4.19.2"],
    "messy history": ["Fixed stuff.", "wip", "feat: Added the new export button", "fix(export) handle empty rows", "update readme", "feat(export): stream the CSV instead of buffering the whole file in memory first"],
    "breaking change": ["feat(api)!: remove v1 order endpoints", "fix(api): return 404 for an unknown order id", "refactor(db): extract order repository", "feat(api): add cursor pagination\n\nBREAKING CHANGE: the page query parameter is replaced by cursor."],
  };
  const CC_RE = /^(\w+)(?:\(([\w\-./ ]+)\))?(!)?: (.+)$/;
  function ccParse(raw) {
    const msg = raw.replace(/\\n/g, "\n");
    const [header, ...rest] = msg.split("\n");
    const body = rest.join("\n");
    const m = header.match(CC_RE);
    const problems = [];
    const footerBreak = /(^|\n)BREAKING[ -]CHANGE: /.test(body);
    if (!m) {
      problems.push(["error", "header must look like <code>type(scope): subject</code>"]);
      return { header, ok: false, problems, bump: "none" };
    }
    const [, type, scope, bang, subject] = m;
    if (!CC_TYPES.includes(type)) problems.push(["error", `unknown type <code>${esc(type)}</code>`]);
    if (header.length > 72) problems.push(["warn", `header is ${header.length} characters (max 72)`]);
    if (/\.$/.test(subject)) problems.push(["warn", "subject ends with a period"]);
    if (/^[A-Z]/.test(subject)) problems.push(["warn", "subject starts with a capital letter"]);
    if (/^(added|fixed|updated|removed|changed|improved|refactored)\b/i.test(subject)) problems.push(["warn", "use the imperative mood: \"add\", not \"added\""]);
    const breaking = !!bang || footerBreak;
    const valid = !problems.some((p) => p[0] === "error");
    const bump = !valid ? "none" : breaking ? "major" : type === "feat" ? "minor" : type === "fix" || type === "perf" ? "patch" : "none";
    return { header, ok: valid, type, scope, breaking, subject, problems, bump, footerBreak };
  }
  const RANK = { none: 0, patch: 1, minor: 2, major: 3 };
  function bumpVersion(v, level) {
    const [maj, min, pat] = v;
    if (level === "major") return maj === 0 ? [0, min + 1, 0] : [maj + 1, 0, 0];
    if (level === "minor") return [maj, min + 1, 0];
    if (level === "patch") return [maj, min, pat + 1];
    return [maj, min, pat];
  }
  Viz.register(P + "commits", (el) => Viz.player(el, {
    title: "Conventional Commits: from messages to the next version",
    tag: "PARSER · LINTER · SEMVER",
    legend: [["done", "valid, in changelog"], ["dim", "valid, no release"], ["active", "warning"], ["bad", "rejected by commitlint"]],
    inputs: [
      { key: "preset", label: "history", type: "select", options: Object.keys(CC_PRESETS), value: Object.keys(CC_PRESETS)[0], width: 170 },
      { key: "version", label: "current version", value: "1.4.2", width: 80 },
      { key: "extra", label: "add your own commit (\\n for new line)", value: "", width: 330 },
    ],
    random: () => ({ preset: pick(Object.keys(CC_PRESETS)), version: pick(["1.4.2", "0.9.3", "2.0.0"]), extra: pick(["", "fix(ui): keep focus after closing the dialog", "Feat: new thing", "feat(auth)!: require MFA for admins"]) }),
    build: ({ preset, version, extra }) => {
      if (!CC_PRESETS[preset]) throw new Error("Pick a history.");
      const vm = String(version).trim().match(/^(\d{1,4})\.(\d{1,4})\.(\d{1,4})$/);
      if (!vm) throw new Error("Version must look like 1.4.2 (MAJOR.MINOR.PATCH).");
      if (String(extra).length > 200) throw new Error("Keep your commit message under 200 characters.");
      const v0 = vm.slice(1).map(Number);
      const msgs = [...CC_PRESETS[preset], ...(String(extra).trim() ? [String(extra).trim()] : [])];
      const parsed = msgs.map(ccParse);
      const frames = [{ parsed, upto: 0, v0, note: `Each commit header is parsed as <code>type(scope)!: subject</code>. <code>feat</code> bumps MINOR, <code>fix</code> and <code>perf</code> bump PATCH, and <code>!</code> or a <code>BREAKING CHANGE:</code> footer bumps MAJOR. Other types (docs, chore, refactor, test…) are recorded but don't trigger a release. Current version: <b>${v0.join(".")}</b>.${v0[0] === 0 ? " In 0.x, a breaking change bumps MINOR (release-please's <code>bump-minor-pre-major</code>): the public API isn't stable yet." : ""}` }];
      let level = "none";
      parsed.forEach((p, i) => {
        if (RANK[p.bump] > RANK[level]) level = p.bump;
        const why = !p.ok ? `<b>rejected</b>: ${p.problems.filter((x) => x[0] === "error").map((x) => x[1]).join("; ")}. A commit-msg hook (commitlint + husky/lefthook) would stop it, and release tooling ignores it, so the change silently misses the changelog.` : `type <code>${esc(p.type)}</code>${p.scope ? `, scope <code>${esc(p.scope)}</code>` : ""}${p.breaking ? `, <b>breaking</b>${p.footerBreak ? " (footer)" : " (!)"}` : ""} → ${p.bump === "none" ? "no release" : `<b>${p.bump}</b>`}.${p.problems.length ? ` Warnings: ${p.problems.map((x) => x[1]).join("; ")}.` : ""}`;
        frames.push({ parsed, upto: i + 1, v0, level, cur: i, note: `<code>${esc(p.header)}</code>: ${why} Highest bump so far: <b>${level}</b>.` });
      });
      const v1 = bumpVersion(v0, level);
      const bad = parsed.filter((p) => !p.ok).length;
      frames.push({ parsed, upto: parsed.length, v0, v1, level, final: true, note: `Next version: <b>${v0.join(".")} → ${v1.join(".")}</b> (${level === "none" ? "nothing to release" : level}${level === "major" && v0[0] === 0 ? ", shown as a minor bump because of 0.x" : ""}). The changelog writes itself from the headers.${bad ? ` <b>${bad} commit${bad === 1 ? "" : "s"}</b> didn't parse, and their changes are missing from it. With squash merges you only need the <i>PR title</i> to follow the convention.` : ""}` });
      return frames;
    },
    render: (f) => {
      const rows = f.parsed.map((p, i) => {
        if (i >= f.upto) return `<tr class="cr-dim"><td>${i + 1}</td><td><code>${esc(p.header)}</code></td><td colspan="4"></td></tr>`;
        const cls = !p.ok ? "cr-bad" : p.problems.length ? "cr-warn" : p.bump !== "none" ? "cr-ok" : "cr-muted";
        return `<tr class="${cls} ${i === f.cur ? "cr-cur" : ""}"><td>${i + 1}</td><td><code>${esc(p.header)}</code></td><td>${p.ok ? esc(p.type) : "—"}${p.ok && p.scope ? `<small>(${esc(p.scope)})</small>` : ""}</td><td>${p.breaking ? "<b>yes</b>" : ""}</td><td>${p.bump === "none" ? "—" : p.bump}</td><td>${p.problems.map((x) => `<span class="cr-lint ${x[0]}">${x[1]}</span>`).join("") || "✓"}</td></tr>`;
      }).join("");
      const tbl = `<table class="cr-tbl cr-cc"><tr><th>#</th><th>header</th><th>type</th><th>breaking</th><th>bump</th><th>lint</th></tr>${rows}</table>`;
      let right = "";
      if (f.final) {
        const sec = [["⚠ BREAKING CHANGES", (p) => p.breaking], ["Features", (p) => p.type === "feat" && !p.breaking], ["Bug Fixes", (p) => p.type === "fix" && !p.breaking], ["Performance", (p) => p.type === "perf" && !p.breaking]];
        const md = [`## ${f.v1.join(".")}`];
        sec.forEach(([h, fn]) => { const xs = f.parsed.filter((p) => p.ok && fn(p)); if (xs.length) { md.push("", `### ${h}`, ...xs.map((p) => `* ${p.scope ? `**${p.scope}:** ` : ""}${p.subject}`)); } });
        if (md.length === 1) md.push("", "_no user-facing changes: no release_");
        right = `<pre class="cr-log">${esc(md.join("\n"))}</pre>`;
      }
      const st = stats([
        ["current", f.v0.join("."), ""],
        ["bump so far", f.level || "none", f.level === "major" ? "bad" : f.level === "minor" ? "active" : f.level === "patch" ? "done" : ""],
        ["next", f.v1 ? f.v1.join(".") : "…", f.v1 ? "done" : ""],
        ["rejected", f.parsed.slice(0, f.upto).filter((p) => !p.ok).length, f.parsed.slice(0, f.upto).some((p) => !p.ok) ? "bad" : ""],
      ]);
      return `<div class="cr-col">${st}${tbl}${right}</div>`;
    },
  }));

  /* =====================================================================
   * 6. CI gates as a job graph: the same change through three pipeline
   *    layouts. Measures time to first feedback and compute minutes.
   * ===================================================================== */
  const CI_JOBS = [
    { id: "secrets", name: "secret scan", dur: 0.3, tool: "gitleaks / GitHub push protection" },
    { id: "lint", name: "format + lint", dur: 0.7, tool: "dotnet format · Spotless · ruff · gofmt · eslint" },
    { id: "build", name: "build / compile", dur: 2, tool: "dotnet build · mvn · go build · tsc" },
    { id: "sca", name: "dependency audit (SCA)", dur: 1, tool: "Dependabot · OWASP DC · pip-audit · govulncheck · npm audit" },
    { id: "unit", name: "unit tests", dur: 3, tool: "xUnit · JUnit · pytest · go test · Vitest" },
    { id: "integ", name: "integration tests", dur: 6, tool: "Testcontainers + real database" },
    { id: "image", name: "container build + scan", dur: 3, tool: "docker build · Trivy / Grype" },
    { id: "cov", name: "coverage gate", dur: 0.3, tool: "diff coverage ≥ 80%" },
  ];
  const CI_CHANGE = {
    "clean change": { fail: null, msg: "" },
    "formatting slip": { fail: "lint", msg: "lint: 3 files are not formatted. Run the formatter locally (or in a pre-commit hook) and push again." },
    "failing unit test": { fail: "unit", msg: "unit tests: <code>OrderTotal_rounds_to_cents</code> expected 10.05 but was 10.0499999." },
    "vulnerable dependency": { fail: "sca", msg: "SCA: a critical CVE in a transitive dependency with a fixed version available. Bump it or add a justified, expiring exception." },
    "coverage drop": { fail: "cov", msg: "coverage gate: only 41% of the <i>changed</i> lines are covered (gate: 80%). Gate on diff coverage, not the global number." },
    "secret committed": { fail: "secrets", msg: "secret scan: an AWS access key in <code>config/dev.json:12</code>. <b>Rotate the key now</b>: deleting the commit doesn't un-leak it." },
  };
  const CI_LAYOUT = ["fail fast: cheap checks first", "everything in parallel", "one big sequential job"];
  const CI_OVERHEAD = 0.5;
  function ciRun(change, layout) {
    const fail = CI_CHANGE[change].fail;
    const deps = layout === CI_LAYOUT[0]
      ? { secrets: [], lint: [], build: ["secrets", "lint"], sca: ["secrets", "lint"], unit: ["build"], integ: ["build"], image: ["build"], cov: ["unit", "integ"] }
      : layout === CI_LAYOUT[1]
        ? { secrets: [], lint: [], build: [], sca: [], unit: ["build"], integ: ["build"], image: ["build"], cov: ["unit", "integ"] }
        : null;
    const res = {};
    if (!deps) {
      const order = ["build", "unit", "integ", "image", "lint", "sca", "secrets", "cov"];
      let t = CI_OVERHEAD, failed = false;
      order.forEach((id) => {
        const j = CI_JOBS.find((x) => x.id === id);
        if (failed) { res[id] = { ...j, state: "skipped" }; return; }
        res[id] = { ...j, start: t, setup: 0, end: t + j.dur, state: id === fail ? "failed" : "passed" };
        if (id === fail) failed = true;
        t += j.dur;
      });
      res.build.setup = CI_OVERHEAD; res.build.start = 0;
    } else {
      const order = ["secrets", "lint", "build", "sca", "unit", "integ", "image", "cov"];
      order.forEach((id) => {
        const j = CI_JOBS.find((x) => x.id === id);
        const ds = deps[id].map((d) => res[d]);
        if (ds.some((d) => d.state !== "passed")) { res[id] = { ...j, state: "skipped" }; return; }
        const start = Math.max(0, ...ds.map((d) => d.end));
        res[id] = { ...j, start, setup: CI_OVERHEAD, end: start + CI_OVERHEAD + j.dur, state: id === fail ? "failed" : "passed" };
      });
    }
    const jobs = CI_JOBS.map((j) => res[j.id]);
    const ran = jobs.filter((j) => j.state !== "skipped");
    const failedJob = jobs.find((j) => j.state === "failed");
    const wall = Math.max(...ran.map((j) => j.end));
    const feedback = failedJob ? failedJob.end : wall;
    const compute = ran.reduce((s, j) => s + (j.end - j.start), 0);
    return { layout, jobs, feedback, wall, compute, failedJob };
  }
  Viz.register(P + "ci", (el) => Viz.player(el, {
    title: "CI quality gates: what fails, and how fast you hear about it",
    tag: "JOB GRAPH SCHEDULER",
    legend: [["visit", "runner setup / checkout"], ["active", "running"], ["done", "passed"], ["bad", "failed"], ["dim", "skipped"]],
    inputs: [
      { key: "change", label: "the push contains", type: "select", options: Object.keys(CI_CHANGE), value: "failing unit test", width: 200 },
      { key: "layout", label: "pipeline", type: "select", options: CI_LAYOUT, value: CI_LAYOUT[0], width: 250 },
    ],
    random: () => ({ change: pick(Object.keys(CI_CHANGE)), layout: pick(CI_LAYOUT) }),
    build: ({ change, layout }) => {
      if (!CI_CHANGE[change] || !CI_LAYOUT.includes(layout)) throw new Error("Pick a change and a pipeline layout.");
      const all = CI_LAYOUT.map((l) => ciRun(change, l));
      const me = all.find((x) => x.layout === layout);
      const scale = Math.max(...all.map((x) => x.wall));
      const base = { all, me, scale, change };
      const frames = [{ ...base, t: 0, note: `A push triggers the pipeline. ${layout === CI_LAYOUT[0] ? "<b>Fail fast</b>: the cheapest, most likely failures (secrets, formatting) run first, and expensive jobs only start once they pass." : layout === CI_LAYOUT[1] ? "<b>All parallel</b>: every independent job starts immediately, each on its own runner (each pays ~30 s of setup)." : "<b>One big job</b>: a single script runs everything in order and stops at the first failure. Setup is paid once, but nothing overlaps."}` }];
      const times = [...new Set(me.jobs.filter((j) => j.state !== "skipped").flatMap((j) => [j.start, j.end]))].filter((x) => x > 0).sort((a, b) => a - b);
      times.forEach((t) => {
        const ended = me.jobs.filter((j) => j.state !== "skipped" && Math.abs(j.end - t) < 1e-9);
        const started = me.jobs.filter((j) => j.state !== "skipped" && Math.abs(j.start - t) < 1e-9);
        const parts = [];
        ended.forEach((j) => parts.push(j.state === "failed" ? `<b>${esc(j.name)} FAILED</b>. ${CI_CHANGE[change].msg}` : `${esc(j.name)} passed (${esc(j.tool)}).`));
        if (started.length) parts.push(`Started: ${started.map((j) => esc(j.name)).join(", ")}.`);
        frames.push({ ...base, t, note: `Minute ${fmt1(t)}. ${parts.join(" ")}` });
      });
      const skipped = me.jobs.filter((j) => j.state === "skipped");
      const best = all.reduce((a, b) => (b.feedback < a.feedback || (b.feedback === a.feedback && b.compute < a.compute) ? b : a));
      frames.push({ ...base, t: me.wall, final: true, best: best.layout, note: `${me.failedJob ? `Feedback after <b>${fmt1(me.feedback)} min</b>: ${esc(me.failedJob.name)} failed.${skipped.length ? ` ${skipped.length} job${skipped.length === 1 ? " was" : "s were"} skipped, saving compute.` : ""}` : `All green after <b>${fmt1(me.wall)} min</b>. The PR is mergeable once a human approves.`} Compute used: ${fmt1(me.compute)} runner-minutes. Order gates by <i>cost ÷ probability of failing</i>, and make each one required in branch protection so “I'll fix it later” isn't an option.` });
      return frames;
    },
    render: (f) => {
      const me = f.me, t = f.t, W = 660, X0 = 170, sx = (m) => X0 + (m / f.scale) * (W - X0 - 14);
      const rowH = 24, top = 10, H = top + CI_JOBS.length * rowH + 24;
      let s = "";
      for (let m = 0; m <= f.scale; m += 1) s += `<line class="edge dash" x1="${sx(m)}" y1="${top}" x2="${sx(m)}" y2="${H - 20}" opacity=".15"/>`;
      me.jobs.forEach((j, i) => {
        const y = top + i * rowH;
        s += `<text class="small" x="8" y="${y + 14}">${esc(j.name)}</text>`;
        if (j.state === "skipped") { s += `<text class="small muted" x="${X0 + 4}" y="${y + 14}">skipped</text>`; return; }
        if (j.start >= t && !f.final) return;
        const e = Math.min(j.end, t), sEnd = Math.min(j.start + j.setup, t);
        if (j.setup && sEnd > j.start) s += `<rect class="box visit" x="${sx(j.start)}" y="${y + 3}" width="${Math.max(sx(sEnd) - sx(j.start), 1)}" height="14" rx="3"/>`;
        if (e > j.start + j.setup) {
          const cls = j.end <= t ? (j.state === "failed" ? "bad" : "done") : "active";
          s += `<rect class="box ${cls}" x="${sx(j.start + j.setup)}" y="${y + 3}" width="${Math.max(sx(e) - sx(j.start + j.setup), 1)}" height="14" rx="3"/>`;
        }
        if (j.end <= t && j.state === "failed") s += `<text class="small" x="${sx(j.end) + 5}" y="${y + 14}" font-weight="700">✗</text>`;
      });
      s += `<line class="edge accent" x1="${sx(t)}" y1="${top}" x2="${sx(t)}" y2="${H - 20}"/><text class="small muted" x="${X0}" y="${H - 6}">0 min</text><text class="small muted" x="${W - 14}" y="${H - 6}" text-anchor="end">${fmt1(f.scale)} min</text>`;
      const svg = `<svg class="dg cr-gantt" viewBox="0 0 ${W} ${H}" width="${W}" role="img" aria-label="CI job timeline">${s}</svg>`;
      const failedNow = me.failedJob && me.failedJob.end <= t;
      const st = stats([
        ["minute", fmt1(t), ""],
        ["first feedback", failedNow || f.final ? `${fmt1(me.feedback)} min` : "…", failedNow ? "bad" : f.final ? "done" : ""],
        ["running now", me.jobs.filter((j) => j.state !== "skipped" && j.start <= t && j.end > t).length, ""],
        ["compute so far", `${fmt1(me.jobs.filter((j) => j.state !== "skipped").reduce((a, j) => a + Math.max(0, Math.min(j.end, t) - j.start), 0))} min`, ""],
      ]);
      const table = f.final ? `<table class="cr-tbl"><tr><th>pipeline</th><th>first feedback</th><th>wall clock</th><th>compute</th><th>jobs skipped</th></tr>${f.all.map((x) => `<tr class="${x.layout === f.best ? "cr-good" : ""} ${x.layout === me.layout ? "cr-cur" : ""}"><td>${esc(x.layout)}</td><td>${fmt1(x.feedback)} min</td><td>${fmt1(x.wall)} min</td><td>${fmt1(x.compute)} min</td><td>${x.jobs.filter((j) => j.state === "skipped").length}</td></tr>`).join("")}</table>${verdict(me.failedJob ? "bad" : "done", me.failedJob ? `blocked by: ${me.failedJob.name}` : "all gates green", `fastest feedback for this change: ${f.best}`)}` : "";
      return `<div class="cr-col">${svg}${st}${table}</div>`;
    },
  }));

  /* =====================================================================
   * 7. Feature flags: deterministic percentage rollout with a hash bucket,
   *    sticky per user, plus an automatic kill switch on an error SLO.
   * ===================================================================== */
  const FL_STEPS = [0, 1, 5, 25, 50, 100];
  const FL_SCEN = ["healthy release", "new version has a bug"];
  const FL_USERS = 1000;
  const bucketOf = (key, user) => fnv(`${key}:${user}`) % 10000;
  Viz.register(P + "flags", (el) => Viz.player(el, {
    title: "Feature flag rollout: sticky buckets and a kill switch",
    tag: "FNV-1a BUCKETING · 1,000 USERS",
    legend: [["done", "user sees the new version"], ["dim", "user sees the old version"], ["bad", "user hit an error"], ["visit", "was exposed, now back on old"], ["path", "user you follow"]],
    inputs: [
      { key: "key", label: "flag key", value: "new-checkout", width: 140 },
      { key: "scen", label: "scenario", type: "select", options: FL_SCEN, value: FL_SCEN[1], width: 200 },
      { key: "follow", label: "follow user", value: "user-42", width: 100 },
    ],
    random: () => ({ key: pick(["new-checkout", "search-v2", "dark-mode", "fast-pricing"]), scen: pick(FL_SCEN), follow: `user-${1 + Math.floor(Math.random() * FL_USERS)}` }),
    build: ({ key, scen, follow }) => {
      key = String(key).trim(); follow = String(follow).trim();
      if (!/^[a-z0-9][a-z0-9._-]{0,39}$/i.test(key)) throw new Error("Flag key: letters, digits, '.', '_' or '-', up to 40 characters.");
      if (!/^user-\d{1,4}$/.test(follow) || Number(follow.slice(5)) < 1 || Number(follow.slice(5)) > FL_USERS) throw new Error(`Follow a user from user-1 to user-${FL_USERS}.`);
      if (!FL_SCEN.includes(scen)) throw new Error("Pick a scenario.");
      const users = Array.from({ length: FL_USERS }, (_, i) => ({ id: `user-${i + 1}`, b: bucketOf(key, `user-${i + 1}`) }));
      const fb = bucketOf(key, follow);
      const errNew = scen === FL_SCEN[1] ? 0.04 : 0.005, errOld = 0.005, SLO = 0.02, REQ = 5, MIN_REQ = 200;
      const r = rng(fnv(key + scen));
      const everNew = new Set();
      const frames = [{ users, pct: 0, fb, follow, key, errs: new Set(), note: `The new checkout is <b>deployed but dark</b>: the code is in production behind the flag <code>${esc(key)}</code>, at 0%. Deploying and releasing are now separate decisions. Each user gets a stable bucket: <code>fnv1a("${esc(key)}:" + userId) % 10000</code>. ${esc(follow)} lands in bucket <b>${fb}</b>, so they get the new version once the rollout passes ${(fb / 100).toFixed(2)}%.` }];
      let killed = false, flips = 0;
      for (let si = 1; si < FL_STEPS.length && !killed; si++) {
        const pct = FL_STEPS[si];
        const on = users.filter((u) => u.b < pct * 100);
        const before = everNew.size;
        on.forEach((u) => everNew.add(u.id));
        flips += users.filter((u) => everNew.has(u.id) && !(u.b < pct * 100)).length;
        const errs = new Set();
        let reqNew = 0, eNew = 0;
        users.forEach((u) => { const isNew = u.b < pct * 100; for (let k = 0; k < REQ; k++) { const bad = r() < (isNew ? errNew : errOld); if (isNew) { reqNew++; if (bad) eNew++; } if (bad) errs.add(u.id); } });
        const rate = reqNew ? eNew / reqNew : 0;
        const naive = 2 * (pct / 100) * (1 - pct / 100);
        let note = `Rollout <b>${pct}%</b>: ${on.length} users on the new version (${on.length - before} newly added; nobody who already had it is switched back). Error rate on the new version: <b>${(rate * 100).toFixed(1)}%</b> over ${reqNew} requests (SLO: ≤ ${SLO * 100}%). With <code>Math.random()</code> per request instead of a hash, ${Math.round(naive * 100)}% of users would flip between versions on consecutive page loads.`;
        if (reqNew < MIN_REQ) note += ` Only ${reqNew} requests so far: too few to judge (the gate needs ≥ ${MIN_REQ}), so the rollout continues.`;
        if (rate > SLO && reqNew >= MIN_REQ) {
          killed = true;
          note += ` <b>SLO breached → kill switch</b>: the flag goes to 0% in seconds, with no redeploy and no rollback build. Blast radius: ${on.length} users (${(on.length / FL_USERS * 100).toFixed(0)}%).`;
          frames.push({ users, pct, fb, follow, key, errs, rate, reqNew, note, alarm: true });
          frames.push({ users, pct: 0, fb, follow, key, errs: new Set(), exposed: new Set(on.map((u) => u.id)), rate: 0, killed: true, final: true, blast: on.length, flips, note: `Flag <code>${esc(key)}</code> is back at 0% while the team fixes the bug. The ${on.length} users who were exposed (blue) are back on the old version. Compare: without a flag, this bug would have shipped to all ${FL_USERS} users and needed an emergency rollback deploy. Kill switches work only if they're tested, fast (the SDK caches flag rules locally and streams updates) and automatic on the SLO.` });
        } else {
          frames.push({ users, pct, fb, follow, key, errs, rate, reqNew, note });
        }
      }
      if (!killed) frames.push({ users, pct: 100, fb, follow, key, errs: new Set(), rate: 0, final: true, flips, note: `100% and healthy. Now <b>remove the flag</b>: delete the old code path and the flag definition. Every flag left in place doubles the states your code can be in. Give each release flag an owner and an expiry date. Permanent flags (kill switches for dependencies, entitlements) are a different kind and belong in configuration.` });
      return frames;
    },
    render: (f) => {
      const cols = 40, cell = 15, rows = FL_USERS / cols;
      let s = "";
      f.users.forEach((u, i) => {
        const x = (i % cols) * cell, y = Math.floor(i / cols) * cell;
        const on = u.b < f.pct * 100;
        const cls = u.id === f.follow ? "path" : f.errs.has(u.id) ? "bad" : on ? "done" : f.exposed && f.exposed.has(u.id) ? "visit" : "";
        s += `<rect class="box ${cls}" x="${x + 1}" y="${y + 1}" width="${cell - 3}" height="${cell - 3}" rx="2" ${cls ? "" : 'opacity=".45"'}/>`;
      });
      const svg = `<svg class="dg cr-grid" viewBox="0 0 ${cols * cell} ${rows * cell}" width="${cols * cell}" role="img" aria-label="${f.pct}% of 1000 users on the new version">${s}</svg>`;
      const on = f.users.filter((u) => u.b < f.pct * 100).length;
      const steps = `<div class="cr-steps">${FL_STEPS.map((p) => `<span class="cr-chip ${p === f.pct && !f.killed ? "active" : p < f.pct ? "done" : ""}">${p}%</span>`).join("→")}${f.killed ? '<span class="cr-chip bad">KILLED → 0%</span>' : ""}</div>`;
      const st = stats([
        ["rollout", `${f.pct}%`, f.killed ? "bad" : f.pct === 100 ? "done" : "active"],
        ["users on new", on, ""],
        ["new-version error rate", f.rate === undefined ? "—" : `${(f.rate * 100).toFixed(1)}%`, f.alarm ? "bad" : f.rate ? "done" : ""],
        [`${f.follow} (bucket ${f.fb})`, f.fb < f.pct * 100 ? "new" : "old", "path"],
      ]);
      const fin = f.final ? verdict(f.killed ? "bad" : "done", f.killed ? `bad release contained: ${f.blast} of ${FL_USERS} users exposed` : "released to everyone: now delete the flag", `users switched back mid-rollout: ${f.flips} (hash buckets are sticky and monotonic)`) : "";
      return `<div class="cr-col">${steps}${st}<div class="cr-gridwrap">${svg}</div>${fin}</div>`;
    },
  }));

  /* =====================================================================
   * 8. git bisect: binary search over history for the first bad commit,
   *    including commits that don't build (git bisect skip).
   * ===================================================================== */
  const BS_WIP = ["every commit builds", "some WIP commits don't build"];
  Viz.register(P + "bisect", (el) => Viz.player(el, {
    title: "git bisect: find the commit that broke it in log₂(n) steps",
    tag: "BINARY SEARCH ON HISTORY",
    legend: [["done", "good"], ["bad", "bad"], ["active", "being tested"], ["dim", "doesn't build (skipped)"], ["visit", "still a suspect"]],
    inputs: [
      { key: "n", label: "commits since last good", value: "200", width: 70 },
      { key: "culprit", label: "culprit (1..n)", value: "137", width: 70 },
      { key: "wip", label: "history", type: "select", options: BS_WIP, value: BS_WIP[0], width: 230 },
    ],
    random: () => { const n = 16 + Math.floor(Math.random() * 400); return { n: String(n), culprit: String(1 + Math.floor(Math.random() * n)), wip: pick(BS_WIP) }; },
    build: ({ n, culprit, wip }) => {
      const N = Number(String(n).trim()), C = Number(String(culprit).trim());
      if (!Number.isInteger(N) || N < 2 || N > 1000) throw new Error("Commits: a whole number from 2 to 1000.");
      if (!Number.isInteger(C) || C < 1 || C > N) throw new Error(`Culprit must be a whole number from 1 to ${N}.`);
      if (!BS_WIP.includes(wip)) throw new Error("Pick a history.");
      const broken = new Set();
      if (wip === BS_WIP[1]) for (let i = 1; i < N; i++) if (fnv("wip" + i) % 6 === 0 && i !== C) broken.add(i);
      let lo = 0, hi = N;
      const state = new Map([[0, "good"], [N, "bad"]]);
      const frames = [{ N, C, lo, hi, state: new Map(state), cur: -1, broken, steps: 0, cmds: ["git bisect start", `git bisect bad HEAD        # commit ${N}`, "git bisect good v1.4.0     # commit 0"], note: `${N} commits since the last known-good release, and one of them broke checkout. Testing them one by one could take ${N} builds. <b>Bisect</b> halves the suspects each step: about <b>${Math.ceil(Math.log2(N))}</b> tests.${broken.size ? ` ${broken.size} WIP commits don't even compile, which is why squashing fixups before merging matters.` : ""}` }];
      let steps = 0;
      const cmds = [...frames[0].cmds];
      let stuck = false;
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        let pickC = mid;
        const tried = [];
        if (broken.has(pickC)) {
          const cand = [];
          for (let d = 1; d < hi - lo; d++) { if (mid + d < hi) cand.push(mid + d); if (mid - d > lo) cand.push(mid - d); }
          pickC = -1;
          if (state.get(mid) !== "skip") tried.push(mid);
          for (const c of cand) { if (!broken.has(c)) { pickC = c; break; } if (state.get(c) !== "skip") tried.push(c); }
        }
        tried.forEach((c) => { state.set(c, "skip"); cmds.push(`git bisect skip            # ${c} doesn't build`); });
        if (pickC < 0) { stuck = true; break; }
        steps++;
        const bad = pickC >= C;
        state.set(pickC, bad ? "bad" : "good");
        if (bad) hi = pickC; else lo = pickC;
        cmds.push(`git bisect ${bad ? "bad " : "good"}            # ${pickC}: ${bad ? "test fails" : "test passes"}`);
        const left = hi - lo - 1;
        frames.push({ N, C, lo, hi, state: new Map(state), cur: pickC, broken, steps, cmds: [...cmds], note: `Step ${steps}: test commit <b>${pickC}</b>${tried.length ? ` (after skipping ${tried.join(", ")}, which ${tried.length === 1 ? "doesn't" : "don't"} build)` : ""}: ${bad ? "<b>bad</b>, so the culprit is at or before it" : "<b>good</b>, so the culprit is after it"}. ${left ? `Suspects left: ${left + 1} (commits ${lo + 1}–${hi}).` : `Only commit ${hi} is left.`}` });
      }
      const found = !stuck;
      if (found) cmds.push(`# ${hi} is the first bad commit`, "git bisect reset");
      else cmds.push("# There are only 'skip'ped commits left to test.", "# The first bad commit could be any of the remaining ones.");
      frames.push({ N, C, lo, hi, state: new Map(state), cur: found ? hi : -1, broken, steps, cmds: [...cmds], final: true, found, note: found ? `Found commit <b>${hi}</b> in <b>${steps}</b> tests (log₂ ${N} ≈ ${fmt1(Math.log2(N))}). Automate it: <code>git bisect run ./test.sh</code> runs the script at each step (exit 0 good, 1–127 bad, 125 skip). Small, single-purpose commits make the answer obvious; a 2,000-line commit leaves you hunting again.` : `Bisect can only narrow it to commits ${lo + 1}–${hi}: the ones between them don't build, so git can't test them. This is the cost of WIP commits on main. Squash or fix them up before merging.` });
      return frames;
    },
    render: (f) => {
      const N = f.N, perRow = N <= 300 ? 25 : 40, cell = N <= 300 ? 14 : 9, rows = Math.ceil((N + 1) / perRow);
      let s = "";
      for (let i = 0; i <= N; i++) {
        const x = (i % perRow) * cell, y = Math.floor(i / perRow) * cell;
        const st = f.state.get(i);
        const suspect = i > f.lo && i <= f.hi && !st;
        const cls = i === f.cur ? (f.final ? "bad" : "active") : st === "good" ? "done" : st === "bad" ? "bad" : st === "skip" ? "" : suspect ? "visit" : "";
        const op = st === "skip" ? ' opacity=".3"' : !suspect && !st ? ' opacity=".18"' : "";
        s += `<rect class="box ${cls}" x="${x + 1}" y="${y + 1}" width="${cell - 2}" height="${cell - 2}" rx="2"${op}/>`;
        if (f.broken.has(i) && st !== "skip") s += `<line class="edge" x1="${x + 3}" y1="${y + 3}" x2="${x + cell - 3}" y2="${y + cell - 3}" opacity=".35"/>`;
      }
      const svg = `<svg class="dg cr-bgrid" viewBox="0 0 ${perRow * cell} ${rows * cell}" width="${perRow * cell}" role="img" aria-label="bisect over ${N} commits">${s}</svg>`;
      const st = stats([
        ["suspects left", f.hi - f.lo, f.hi - f.lo === 1 ? "done" : "active"],
        ["tests run", f.steps, ""],
        ["log₂ n", fmt1(Math.log2(N)), ""],
        ["skipped", [...f.state.values()].filter((v) => v === "skip").length, ""],
      ]);
      const fin = f.final ? verdict(f.found ? "done" : "bad", f.found ? `first bad commit: ${f.hi}` : `ambiguous: commits ${f.lo + 1}–${f.hi}`, f.found ? `${f.steps} tests instead of up to ${N}` : "untestable commits block bisect") : "";
      return `<div class="cr-col">${st}<div class="cr-split"><div class="cr-split-l">${svg}</div><div class="cr-split-r"><pre class="cr-log">${esc(f.cmds.slice(-12).join("\n"))}</pre></div></div>${fin}</div>`;
    },
  }));
})();
