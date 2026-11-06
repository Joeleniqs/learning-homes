"""Build the public DSA Home and Code Excellence Home into this repo for GitHub Pages.

The homes are authored in sibling folders of this repo (see HOMES). For each one this script runs
the home's own build with `--target public --out <staging>`, so the public copy links only to homes
marked public. It then scans the output and this repo's own files for private references, runs the
headless page check, writes the landing page, and swaps the result into the repo in one step.
Commit and push afterwards.

Private names to scan for are kept out of this public repo, in the gitignored file
`publish.local.json`: {"private_patterns": ["<regex>", ...]}. Publishing stops if it's missing.

    python publish.py            # check each home's index and guide pages
    python publish.py --full     # check every page, in light and dark themes
    python publish.py --no-check # skip the browser check (leak scan still runs)

Run it with a Python that has `playwright` installed; each home's build uses that home's .venv.
"""
import argparse
import html
import json
import os
import re
import shutil
import subprocess
import sys
import hashlib
import tempfile
import urllib.parse
from pathlib import Path

ROOT = Path(__file__).resolve().parent
HOMES = {name: ROOT.parent / name for name in ("DSAHome", "CodeExcellenceHome")}
ENGINE = ["build.py", "assets/site.js", "assets/site.css", "assets/viz-core.js", "tools/check.py"]
PUBLIC_EXTS = {".html", ".css", ".js", ".svg"}
# Local paths in any spelling; names of private homes and accounts come from publish.local.json.
GENERIC_LEAKS = [r"[A-Za-z]:[\\/]+Users\b", r"file:/{2,}[A-Za-z]:", r"OneDrive -\s"]
CARD_SLUG = re.compile(r'<a class="topic-card" data-slug="([a-z0-9-]+)"')
LANDING = ["index.html", ".nojekyll"]
LEAKS: re.Pattern


def load_leaks() -> re.Pattern:
    config = ROOT / "publish.local.json"
    if not config.exists():
        fail(f"{config.name} is missing. Create it with the private names to scan for, e.g. "
             '{"private_patterns": ["my-private-home", "my-username"]}. It is gitignored.')
    patterns = json.loads(config.read_text(encoding="utf-8")).get("private_patterns") or []
    if not patterns:
        fail(f"{config.name} has no private_patterns")
    return re.compile("|".join(f"(?:{p})" for p in [*GENERIC_LEAKS, *patterns]), re.I)


def scan(path: Path, label: str) -> None:
    text = path.read_text(encoding="utf-8", errors="replace")
    leak = LEAKS.search(text) or LEAKS.search(urllib.parse.unquote(text))
    if leak:
        fail(f"private reference {leak.group(0)!r} in {label}")


def preflight() -> None:
    for name, src in HOMES.items():
        if not (src / "curriculum.json").exists():
            fail(f"{name}: source folder not found at {src}")
    for rel in ENGINE:
        digests = {hashlib.sha256((src / rel).read_bytes()).hexdigest() for src in HOMES.values()}
        if len(digests) != 1:
            fail(f"engine file {rel} differs between homes; sync the copies first")
    leftovers = sorted(p.name for p in ROOT.glob(".publish-old-*")) + sorted(p.name for p in ROOT.glob(".publish-failed-*"))
    if leftovers:
        fail("an earlier publish left " + ", ".join(leftovers) + ". It may hold the last good copy: "
             "check it, restore anything missing, then delete it.")
    for stale in ROOT.glob(".publish-stage-*"):
        shutil.rmtree(stale, ignore_errors=True)
    unknown = [p.name for p in ROOT.iterdir() if p.is_dir() and not p.name.startswith((".", "__")) and p.name not in HOMES]
    if unknown:
        fail("the repo has published folders that aren't in HOMES (" + ", ".join(unknown) + "). "
             "Delete them with `git rm -r` if that home should no longer be public.")
    tracked = subprocess.run(["git", "ls-files", "--cached", "--others", "--exclude-standard"], cwd=ROOT, capture_output=True, text=True, check=True)
    for rel in tracked.stdout.splitlines():
        if rel.split("/")[0] not in HOMES and rel not in LANDING and (ROOT / rel).is_file():
            scan(ROOT / rel, f"repo file {rel}")


def fail(msg: str) -> None:
    raise SystemExit(f"publish failed: {msg}\nNothing in the repo was changed.")


def build_home(name: str, src: Path, dst: Path) -> dict:
    python = src / ".venv" / "Scripts" / "python.exe"
    if not python.exists():
        fail(f"{name}: no build environment at {python}")
    run = subprocess.run([str(python), "build.py", "--target", "public", "--out", str(dst)], cwd=src, capture_output=True, text=True)
    if run.returncode:
        fail(f"{name}: build exited {run.returncode}\n{run.stdout}{run.stderr}")
    if "warning:" in run.stdout:
        print(run.stdout.strip())
    for item in dst.rglob("*"):
        if not item.is_file():
            continue
        if item.suffix.lower() not in PUBLIC_EXTS:
            fail(f"{name}: unexpected file type in build output: {item.relative_to(dst)}")
        scan(item, f"{name}/{item.relative_to(dst).as_posix()}")
    index = (dst / "index.html").read_text(encoding="utf-8")
    found = re.search(r'data-home="([^"]+)"', index)
    if not found:
        fail(f"{name}: index.html has no data-home attribute, so progress keys can't be matched")
    meta = json.loads((src / "curriculum.json").read_text(encoding="utf-8"))["home"]
    if meta["key"] != found.group(1):
        fail(f"{name}: curriculum key {meta['key']!r} != data-home {found.group(1)!r}")
    slugs = CARD_SLUG.findall(index)
    if not slugs:
        fail(f"{name}: no published topic cards found in index.html")
    return {"dir": name, "id": found.group(1), "title": meta["title"], "heading": meta["heading"], "accent": meta["accent"], "slugs": slugs}


def check(stage: Path, full: bool) -> None:
    checker = next(iter(HOMES.values())) / "tools" / "check.py"
    pages = []
    for name in HOMES:
        pages += [stage / name / "index.html", stage / name / "guide.html"]
        if full:
            pages += sorted((stage / name / "topics").glob("*.html"))
    for extra in ([[], ["--dark"]] if full else [[]]):
        run = subprocess.run([sys.executable, str(checker), *map(str, pages), *extra], capture_output=True, text=True)
        bad = [line for line in run.stdout.splitlines() if not line.startswith("OK ")]
        if run.returncode or bad:
            fail("page check found problems" + (" (dark theme)" if extra else "") + ":\n" + "\n".join(bad or [run.stderr]))
    print(f"Checked {len(pages)} page(s){' in light and dark' if full else ''}: all OK")


def landing(homes: list[dict]) -> str:
    q = lambda v: html.escape(str(v), quote=True)
    cards = "".join(
        f'<a class="card" href="{q(h["dir"])}/index.html" style="--a:{q(h["accent"])}" data-home="{q(h["id"])}" data-slugs="{q(" ".join(h["slugs"]))}">'
        f'<h2>{html.escape(h["title"])}</h2><p>{html.escape(h["heading"])}</p>'
        f'<div class="bar"><span></span></div><small><b class="done">&ndash;</b> of {len(h["slugs"])} topics mastered</small></a>'
        for h in homes
    )
    return f"""<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>Learning Homes</title>
<style>
:root {{ color-scheme: light dark; --bg: #f7f7f9; --surface: #fff; --text: #1d1d24; --muted: #5d5d6b; --line: #e3e3ea; }}
@media (prefers-color-scheme: dark) {{ :root {{ --bg: #0f1218; --surface: #171b23; --text: #e8e8ee; --muted: #a0a3ad; --line: #2a2f3a; }} }}
* {{ box-sizing: border-box; }}
body {{ margin: 0; font: 16px/1.55 system-ui, -apple-system, "Segoe UI", sans-serif; background: var(--bg); color: var(--text); }}
main {{ max-width: 980px; margin: 0 auto; padding: 64px 24px; }}
h1 {{ font-size: 40px; margin: 0 0 8px; letter-spacing: -.02em; }}
.lede {{ color: var(--muted); max-width: 640px; margin: 0 0 36px; }}
.grid {{ display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 20px; }}
.card {{ display: grid; gap: 12px; padding: 26px; border-radius: 16px; background: var(--surface); border: 1px solid var(--line); border-top: 5px solid var(--a); color: inherit; text-decoration: none; transition: transform .15s, box-shadow .15s; }}
.card:hover {{ transform: translateY(-2px); box-shadow: 0 10px 30px rgba(0,0,0,.12); }}
.card h2 {{ margin: 0; color: var(--a); font-size: 24px; }}
.card p {{ margin: 0; color: var(--muted); }}
.bar {{ height: 8px; border-radius: 8px; background: var(--line); overflow: hidden; }}
.bar span {{ display: block; height: 100%; width: 0; background: var(--a); }}
small {{ color: var(--muted); }}
footer {{ margin-top: 40px; color: var(--muted); font-size: 14px; }}
</style>
</head>
<body>
<main>
<h1>Learning Homes</h1>
<p class="lede">Visual, interactive guides for data structures and algorithms and for cross-language engineering craft. Your progress is saved in this browser, for this site only. Use <b>Export progress</b> on a home page to back it up or move it to another device.</p>
<div class="grid">{cards}</div>
<footer>Static site, no account and no tracking. Progress lives in your browser's local storage.</footer>
</main>
<script>
for (const card of document.querySelectorAll(".card")) {{
  const slugs = new Set(card.dataset.slugs.split(" ").filter(Boolean));
  let n = 0;
  try {{ const v = JSON.parse(localStorage.getItem(card.dataset.home + "-mastered") || "[]"); if (Array.isArray(v)) n = new Set(v.filter((s) => slugs.has(s))).size; }} catch {{}}
  card.querySelector(".done").textContent = n;
  card.querySelector(".bar span").style.width = (slugs.size ? 100 * n / slugs.size : 0) + "%";
}}
</script>
</body>
</html>
"""


def swap_in(stage: Path, names: list[str]) -> None:
    """Replace the published entries with the staged ones; on any error put the old ones back."""
    old = Path(tempfile.mkdtemp(prefix=".publish-old-", dir=ROOT))
    moved_out, moved_in = [], []
    try:
        for n in names:
            if (ROOT / n).exists():
                os.replace(ROOT / n, old / n)
                moved_out.append(n)
        for n in names:
            os.replace(stage / n, ROOT / n)
            moved_in.append(n)
    except BaseException as err:
        # Move new entries aside (not delete) before restoring, and keep going past individual failures.
        aside = Path(tempfile.mkdtemp(prefix=".publish-failed-", dir=ROOT))
        problems = []
        for n in reversed(moved_in):
            try:
                os.replace(ROOT / n, aside / n)
            except OSError as e:
                problems.append(f"couldn't move new {n} aside: {e}")
        for n in reversed(moved_out):
            try:
                os.replace(old / n, ROOT / n)
            except OSError as e:
                problems.append(f"couldn't restore {n}: {e}")
        if problems:
            raise SystemExit(
                f"publish failed during the swap ({err}) and couldn't fully restore the previous output:\n  "
                + "\n  ".join(problems)
                + f"\nThe previous output is in {old}. Move it back by hand before you commit anything."
            ) from err
        shutil.rmtree(aside, ignore_errors=True)
        shutil.rmtree(old, ignore_errors=True)
        raise
    shutil.rmtree(old, ignore_errors=True)
    if old.exists():
        print(f"note: couldn't delete {old.name} (a file may be open); delete it by hand.")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    parser.add_argument("--full", action="store_true", help="check every page in light and dark themes")
    parser.add_argument("--no-check", action="store_true", help="skip the headless browser check")
    args = parser.parse_args()
    global LEAKS
    LEAKS = load_leaks()
    preflight()
    # Stage inside the repo so the final swap is a same-volume rename.
    with tempfile.TemporaryDirectory(prefix=".publish-stage-", dir=ROOT) as tmp:
        stage = Path(tmp)
        homes = [build_home(name, src, stage / name) for name, src in HOMES.items()]
        (stage / "index.html").write_text(landing(homes), encoding="utf-8", newline="")
        (stage / ".nojekyll").write_text("", encoding="utf-8")
        if not args.no_check:
            check(stage, args.full)
        swap_in(stage, [*HOMES, *LANDING])
    for h in homes:
        print(f'{h["dir"]}: {len(h["slugs"])} topics, id={h["id"]}')
    print("Published into the repo. Review with `git status`, then commit and push.")


if __name__ == "__main__":
    main()
