# context-recap

English | [简体中文](README.zh-CN.md)

## Abstract

`context-recap` is a lightweight skill for DSH (DeepSeek Harness). At the end of every substantive answer
it writes a structured **card** for that turn — objective, progress, next action — to
`.context-recap/<session-id>.md` in the workspace. The card is the board's data source and is **not shown
separately**: no sidebar pop-up, and no recap text or receipt line in the answer body. Open the right-hand
"Board" tab when you want to look.

The card's frontmatter makes recaps aggregatable: run `scripts/board.mjs` on demand and every card from
every **unarchived** session is merged into `.context-recap/BOARD.md`, ordered
blocked → in progress → done → missing, so the user can see at a glance what is actually in flight. Cards
and boards live on disk and consume no model context.

## How It Works

At the end of every substantive answer:

1. **Read the session id** — `DSH_SESSION_ID` (e.g. `session-85a54419-3338-…`). Read it once per
   session and remember it; fall back to `_unknown.md` when it cannot be obtained.
2. **Write the card** — `.context-recap/<session-id>.md` under the workspace root: frontmatter first,
   then three sections in 10 lines or fewer. When the card already exists, update only the changed
   fields and sections instead of rewriting the whole file. The path is fixed per session, so parallel
   agents in one workspace never overwrite each other.

**Do not show it**: no `sidebar_open`, no recap paste, no receipt line — writing the card already
puts it on the board.

## Card Format

````markdown
---
session: session-85a54419-3338-4ce4-a218-49af2136486f
title: Add a global board to context-recap
status: doing
updated: 2026-11-19 12:30
next: Reinstall the skill and verify
blocked_on:
---

## Objective
What must be achieved, and what counts as done.

## Progress
- Done: key conclusions, with numbers, paths, file names.
- Open / blocked: what is stuck, what is missing.

## Next step
One or two concrete actions.
````

| Field | Required | Meaning |
|---|---|---|
| `session` | yes | session id, matching the file name |
| `title` | yes | one-line title, ≤ 30 characters |
| `status` | yes | `doing` / `blocked` / `done` (finished but session not archived) |
| `updated` | yes | local time `YYYY-MM-DD HH:mm`; the board sorts by it |
| `next` | no | one-line next action |
| `blocked_on` | no | what blocks the work when `status: blocked` |

Constraints:

1. Body in Chinese in this project's default usage; 10 lines or fewer (frontmatter excluded);
   add one `## Why` line only when the motivation is not obvious.
2. State facts — numbers, paths, verbatim error text; no adjectives.
3. The objective must be verifiable ("make X emit Y"), not vague ("do X well").
4. Update incrementally when the card exists; write once — do not read the file back to verify.

## Board

Cards sit in their own workspaces; the board flattens them. Command:

```powershell
node "$env:USERPROFILE\.dsh\skills\context-recap\scripts\board.mjs"
```

The script does four things, with no LLM calls:

1. reads `~/.dsh/storages/workspace.json` and takes the set of **unarchived** sessions
   (everything outside `archivedSessionIds`);
2. looks for `<workspace.path>\.context-recap\<session-id>.md` in each workspace;
3. groups and sorts: `blocked → in progress (by updated, tagged "N days idle" past 3 days) → done (not archived) → missing card`;
4. writes `<cwd>\.context-recap\BOARD.md`, prints it, and the caller opens it with `sidebar_open`.

Options: `--all` (expand folded Sessions — older than 14 days without a card, empty Sessions, and
one-message Sessions are folded into a summary line by default), `--json`, `--no-write`, `--days N`,
`--missing-days N`, `--home PATH`, `--out PATH`.

Sessions without a card get no invented summary: the board falls back to the session log's mtime for
activity and flags them as "go write one there".

### Optional: persistent board in the right sidebar

A companion plugin, `context-recap-board`, renders the same cards as a persistent tab in the right
sidebar (guide page → "Board"). It ships in this repository under `plugin/`; install it with
`plugin_manager` → `install_bundle` pointing at that directory, then refresh the page.

- Same data source as `board.mjs`: `.context-recap/<session-id>.md` cards plus the archived set in
  `~/.dsh/storages/workspace.json`; no file writes, no LLM calls.
- The script produces a `BOARD.md` snapshot (committable, consumable by other tools); the plugin is a
  live view that recomputes on open.

## Trigger Conditions

- **Card**: updated by default at the end of every substantive answer — no sidebar pop-up, no recap text
  in the body. Skipped without comment for greetings, single-step confirmations, and intermediate turns
  of an unfinished task. The user opens the sidebar "Board" to inspect it mid-task.
- **Board**: the plugin tab is live and reads on open; generate the `BOARD.md` snapshot on demand only —
  when the user asks "what am I working on / all sessions / global / board", or when several parallel
  sessions need summarising. It is not a daemon and is not run every turn.

## Installation

### Option 1: install script (recommended)

```powershell
# Windows
git clone https://github.com/856tangbin/context-recap.git
cd context-recap
powershell -NoProfile -ExecutionPolicy Bypass -File install.ps1 -GlobalInstruction
```

```sh
# macOS / Linux
git clone https://github.com/856tangbin/context-recap.git
cd context-recap
sh install.sh --global-instruction
```

The scripts install `SKILL.md`, `references/` and `scripts/`, then merge the global instruction block
into `~/.dsh/AGENTS.md`. The merge is idempotent and safe to re-run.

### Option 2: manual installation

1. Copy `SKILL.md`, `references/` and `scripts/` to `~/.dsh/skills/context-recap/`.
2. Append the contents of `AGENTS.md.template` to `~/.dsh/AGENTS.md`.

### Verification

Start a new session, submit a substantive task, and check that a card with frontmatter appears at
`.context-recap/<session-id>.md`, that no sidebar pops up, and that the answer body contains no recap
text. Then ask for the global view and check that `.context-recap/BOARD.md` is produced with the right
grouping; if the plugin is installed, refresh the page and the right sidebar guide should list "Board".

## How It Is Wired

The behaviour is implemented by two components with distinct responsibilities:

| Component | Location | Responsibility |
|---|---|---|
| Skill | `~/.dsh/skills/context-recap/SKILL.md` | Defines the steps, the card format, the board command and the boundaries |
| Global instruction | Marked block in `~/.dsh/AGENTS.md` | Declares the behaviour as default and guarantees per-turn activation |

Installing the skill alone is insufficient. On every turn DSH injects only the skill's identifier and
description into the system prompt; whether the skill is loaded is decided by the model. Measured result:
in a new session `context-recap` was present in the skill catalogue, yet two consecutive turns produced
zero tool calls and no recap. The global instruction therefore carries the "must run" constraint, and
DSH injects it into the system prompt of every session.

The block is delimited by `<!-- context-recap:begin -->` and `<!-- context-recap:end -->`. The install
scripts replace the block rather than appending to it, so they are safe to re-run. Removing the block
disables the behaviour globally.

## Dependencies and Fallbacks

The card itself never calls `sidebar_open`; that tool is used only when generating the on-demand
`BOARD.md` snapshot (a DSH built-in tool — no third-party sidebar plugin — that also requires the
"model may open files in the sidebar" setting).
- The board needs Node.js (`node` on `PATH`). Without it, run the script with DSH's bundled Electron:
  `$env:ELECTRON_RUN_AS_NODE='1'; & $env:DSH_NODE_EXECUTABLE <path to board.mjs>`.
- The board reads `~/.dsh/storages/workspace.json` (an internal DSH format; the script tolerates both
  `tables.workspaces` and `global.workspaces` layouts). Outside DSH, or when the file is unreadable, the
  board is unavailable and only cards work.
- If the workspace is not writable (read-only, or the sandbox rejects `write`): note it briefly in the
  answer; do not retry in a loop.
- If the shell is unavailable and `DSH_SESSION_ID` cannot be read: use `.context-recap/_unknown.md` and
  do not retry.

## Scope and Constraints

- The card is a working artifact, not a deliverable: do not `present` it and do not build a directory
  structure around it.
- `.context-recap/BOARD.md` is generated: never hand-edit it, re-run the script after changing cards.
- Archiving is not deleting: archived sessions keep their cards on disk and simply drop out of the board.
- If the workspace is a git repository, suggest adding `.context-recap/` to `.gitignore` the first time
  the file is created (say it once).
- Requires a DSH version that supports `AGENTS.md` global instructions and a skill directory.
- Project-level use: copy `AGENTS.md.template` to `AGENTS.md` at the project root to scope the behaviour
  to a single project. The `.template` extension exists for this reason: were the file named `AGENTS.md`,
  DSH would treat it as a directory-level instruction and inject it automatically as soon as the
  repository is cloned into a workspace.

## Cost

- Per substantive answer: no recap output in the body, one `write` (incremental), no sidebar pop-up,
  plus a single shell call per session to read `DSH_SESSION_ID`.
- The board tab reads cards and JSON only when opened — no network requests, no LLM calls; `BOARD.md`
  is generated on demand.
- Card and board text stay on disk and consume no prompt tokens.

## Repository Layout

```
SKILL.md                    Skill body: steps, card format, board command, boundaries
AGENTS.md.template          Global instruction fragment: default behaviour and board trigger
references/recap-format.md  Card template, worked examples, legacy-card notes
scripts/board.mjs           Aggregator: unarchived sessions → cards → BOARD.md
plugin/                     Optional plugin: persistent "Board" tab in the right sidebar
install.ps1                 Windows installer
install.sh                  macOS / Linux installer
README.md                   English documentation (default)
README.zh-CN.md             Simplified Chinese documentation
```

## Maintenance Notes

- `SKILL.md`, `AGENTS.md.template`, `references/*.md` and `scripts/*.mjs` must be UTF-8 without BOM.
- `install.ps1` contains Chinese text and must be saved as UTF-8 with BOM. Windows PowerShell 5.1
  decodes BOM-less UTF-8 as ANSI; paired GBK byte sequences then consume trailing quotes and newlines,
  merging adjacent statements into a string literal.
- `install.sh` must keep LF line endings (pinned by `.gitattributes`).
- The install scripts are unsigned; invoke them with `powershell -NoProfile -ExecutionPolicy Bypass -File`.
- The backup directory must live outside `skills/`: every subdirectory of `skills/` is registered as a skill.

## Changelog

- `v0.1.0`: introduced the skill plus global instruction; recaps were written to a workspace file and
  displayed in the sidebar (plugin-style layout).
- `v0.2.0`: the repository was collapsed into a single skill directory, removing the plugin-style layout;
  the recap path was fixed at `.context-recap/<DSH_SESSION_ID>.md`.
- `v0.3.0`: recaps moved to an inline blockquote at the end of the answer; sidebar, file writes and all
  external dependencies removed.
- `v0.4.0`: sidebar mechanism restored — write `.context-recap/<session-id>.md` and show it with
  `sidebar_open`, leaving the answer body untouched; the sidebar is served by DSH's built-in tool
  rather than a third-party plugin; shell, sidebar and read-only-workspace fallbacks documented.
- `v0.5.0`: cards gained frontmatter (`title` / `status` / `updated` / `next` / `blocked_on`) and
  incremental updates; `scripts/board.mjs` aggregates every unarchived session into `BOARD.md`
  (blocked / doing / done / missing groups, legacy cards parsed on the fly); the installers now copy
  `scripts/` too.
- `v0.6.0`: the board became the only surface — cards no longer pop the sidebar and the body no longer
  restates the recap; bodies shrank to objective / progress / next step in 10 lines; empty and
  one-message sessions are folded by default (`--all` expands them); the persistent right-sidebar
  board plugin now ships in `plugin/`.
- `v0.6.1`: board visuals and interaction finalized — dot-and-rail list, green doing / gray done
  gradient rows, spinner for running sessions, double-click to open, current-session highlight;
  the done section collapses by default with its toggle above the group and keeps its state across
  session switches and reloads; sessions without a card are no longer shown.

## License

MIT
