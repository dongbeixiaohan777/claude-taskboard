# Claude Taskboard

A sidebar panel for **Claude Code sessions** and **project folders**.

It answers two questions that get harder the longer you use Claude Code:

- **Where did I leave off?** You have 40 sessions and no idea which one had that answer.
- **What's still alive?** Your projects are scattered across folders, some active, some long dead.

Everything is local. No account, no network calls, no telemetry.

![Screenshot](docs/screenshot-board.png)

---

## Features

### Sessions, as a timeline

Every Claude Code conversation in your workspace, newest first. Node size encodes how many
prompts the session had, so the heavy ones stand out.

- **Click a session** → opens a preview: the first prompt plus the last three replies.
- **Click the speech-bubble button** → reopens that conversation inside the Claude Code
  extension. No terminal, no copy-pasting session IDs.

### The work pulse

A strip at the top showing your prompt count for each of the last 8 weeks.

Weeks where you did nothing stay visible as a faint baseline rather than disappearing.
If you only get a few hours a week, that rhythm is the most useful thing on the panel —
and it's invisible everywhere else.

### Projects, as a board or a list

Reads a folder of project directories. Status is encoded in the **folder-name suffix**:

```
my-app-active        → In progress   (orange spine)
my-app-planning      → Planning      (blue spine)
my-app-done          → Shipped       (green spine)
my-app-archived      → Archived      (grey spine)
some-folder          → Unlabeled     (yellow spine)
```

Chinese status words work too — see [Project folders](#project-folders) below.

### Glass, on dark themes

On dark themes the panel uses a translucent "liquid glass" treatment. On light themes it
stays flat and crisp, because glass over a flat pale background just looks muddy.
Override with `taskboard.glassEffect` if you disagree.

---

## Install

**Download the VSIX** from the [latest release](https://github.com/dongbeixiaohan777/claude-taskboard/releases/latest), then:

```bash
code --install-extension claude-taskboard-0.1.0.vsix
```

Or in VS Code: Command Palette → `Extensions: Install from VSIX...` → pick the file.

> Not on the VS Code Marketplace yet — publishing there requires an Azure DevOps
> organization, which is blocked by a Microsoft account tenant issue. Track it in
> [issues](https://github.com/dongbeixiaohan777/claude-taskboard/issues).

**From source:**

```bash
git clone https://github.com/dongbeixiaohan777/claude-taskboard.git
cd claude-taskboard
npx @vscode/vsce package --allow-missing-repository
code --install-extension claude-taskboard-0.1.0.vsix
```

Restart VS Code. The icon appears at the **bottom** of the activity bar.

> **On icon position:** VS Code has no API to pin a contributed view container to the
> bottom. Newly installed extensions land last, which puts the icon above the account and
> settings buttons — the closest to the bottom that's reachable. If another extension with
> an activity-bar icon is installed later, it will land below this one. Drag to reorder;
> VS Code remembers.

---

## Settings

| Setting | Default | Description |
|---|---|---|
| `taskboard.projectsDir` | *(empty)* | Folder containing your project directories. Empty = auto-detect. |
| `taskboard.glassEffect` | `auto` | `auto` (glass on dark themes only) · `on` · `off` |

### Auto-detection of `taskboard.projectsDir`

When the setting is empty, the panel looks for the first of these that exists, relative to
your workspace root:

```
KB/02-项目          projects/          docs/projects/          taskboard/
```

Nothing found? The projects section just shows an empty state — the sessions section still
works. Set the setting explicitly to point anywhere.

---

## How it finds your data

**Sessions** are read from `~/.claude/projects/<encoded-workspace>/`. The panel does *not*
guess the encoding rule — it walks that folder and matches each candidate directory against
the `cwd` field recorded inside its `.jsonl` files. That survives changes to how the folder
name is derived.

**Prompt counts** exclude system-generated noise:

| Record | Counted? |
|---|---|
| A normal typed message | yes |
| `<task-notification>` (background task notices) | no |
| `<command-name>` and friends (slash-command invocations) | no |
| `<ide_opened_file>…</ide_opened_file>fix the bug` | yes — the tag is stripped, `fix the bug` counts |
| Tool results and `isMeta` records | no |

Parsing is streaming, so multi-megabyte session files won't blow up memory.

**Timestamps** are taken as min/max over every timestamped record rather than first/last
line — some files contain out-of-order entries from resumes and queued messages.

---

## Project folders

Point `taskboard.projectsDir` at a folder whose subdirectories are your projects. The panel
reads each one's `README.md` (first non-heading line becomes the card summary) and shows a
document count.

Status comes from the folder name suffix. These words are recognized, case-insensitively:

| Status | Accepted suffixes |
|---|---|
| Planning | `planning`, `plan`, `规划中` |
| In progress | `active`, `in-progress`, `wip`, `开发中` |
| Shipped | `done`, `shipped`, `complete`, `completed`, `已上线`, `已完成` |
| Archived | `archived`, `archive`, `已归档` |

No recognized suffix → **Unlabeled**. The folder is still shown, never dropped.

---

## Requirements

- VS Code **1.85** or newer.
- For **reopening sessions**, the [Claude Code](https://marketplace.visualstudio.com/items?itemName=anthropic.claude-code)
  extension. Without it, previews still work — the panel just hides the reopen button.

---

## Privacy

The extension reads local files and renders them. It makes no network requests, sends no
telemetry, and never writes to your sessions or project files. The only thing it writes is
a scan cache in VS Code's own extension storage.

---

## Known limitations

- **Reopening sessions** uses a command from the Claude Code extension
  (`claude-vscode.editor.open`) plus a public deep link
  (`vscode://anthropic.claude-code/open?session=…`). The deep link is the fallback if the
  command ever changes. If both break, previews still work.
- **Slash commands don't count as prompts.** If you run `/my-command` and then type the
  actual request, counting both would double the same intent.
- **The panel is read-only.** No creating, editing, or reordering from inside it.

---

## Development

```bash
node --test test/*.test.js    # unit tests, zero dependencies, Node's built-in runner
node test/smoke.mjs           # scan your real ~/.claude/projects and print a table
node dev/render-all.mjs       # regenerate the screenshots (headless Chrome, no npm packages)
```

### Regenerating the screenshots

`dev/render-all.mjs` renders every panel variant in one process using your installed
Chrome or Edge in headless mode — no `playwright`, no `puppeteer`, no `npm install`.

```bash
node dev/render-all.mjs                # the three used in this README
node dev/render-all.mjs --set all      # every theme × view × locale combination
node dev/render-all.mjs --out /tmp/x   # somewhere else
```

It renders `dev/shot.html` against **`dev/demo-data.js`** — deliberately fictional
projects (`docs-site`, `api-gateway`, `cli-tool`) rather than anyone's real workspace.
Screenshots of the panel are text baked into pixels, so they can't be redaction-checked
by grepping; keeping the demo data separate from real data is the only reliable guard.

After editing, run `Reload Window` from the command palette.

### Layout

```
src/extension.js       activation, wiring
src/store.js           single source of truth: scan + cache + events
src/panel.js           webview host (CSP, nonce, message protocol)
src/claude.js          Claude Code integration — the one piece tied to another extension
src/watcher.js         file watching, debounce, fallback polling
src/cache.js           on-disk scan cache (atomic writes)
src/i18n.js            strings (extension side)
src/lib/               pure Node, no vscode import, unit-testable
media/                 webview: style.css, glass.css, i18n.js, views.js, main.js
dev/preview.html       design sandbox — open it in a browser to iterate on visuals
dev/shot.html          same, but for screenshots: neutral demo data, no toolbar chrome
dev/render-all.mjs     batch screenshot renderer (headless Chrome, zero dependencies)
docs/                  briefs handed to the coding agent that wrote most of this
```

### Two deliberate deviations

1. **CommonJS, not ESM.** An extension host will throw `require is not defined` on
   `require('vscode')` under ESM.
2. **No build step.** No TypeScript, no bundler. The tradeoff is no type checking; the
   mitigation is that `src/lib/` never imports `vscode`, so it's directly testable.

### Theme tokens must live on `body`, not `:root`

VS Code injects `--vscode-*` variables at runtime on `body`. Deriving tokens like
`--c-bg: var(--vscode-sideBar-background)` on `:root` silently falls back to the hardcoded
default, which looks like "theming is broken" — everything renders in one theme's colors
regardless of what you pick. Cost me an afternoon.

---

## License

MIT — see [LICENSE](LICENSE).

[简体中文](README.zh-CN.md)
