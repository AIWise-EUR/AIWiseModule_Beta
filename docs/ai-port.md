# AI Port

Working record for the team's own AI assistants (Claude, ChatGPT, Codex) working with
the WorkSpace. Read [Status](#status) first; add a [Log](#log) line per session.

## Decision

Agreed with the project owner (Seyoon) on 5 October 2026.

1. **Subscriptions, not API keys.** Members connect the AI they already pay for. The
   WorkSpace never calls an AI provider itself and never stores an AI key. Two routes:
   - **AI Port** in the WorkSpace: a brief that a member pastes into their own Claude or
     ChatGPT, and an express inlet that reads the AI's answer back into the Studio draft.
   - **GitHub**: Claude Code and Codex open this repository with the member's subscription
     for system questions and code work. Both read `AGENTS.md` (Codex) and `CLAUDE.md`
     (Claude Code, which points at `AGENTS.md`).
2. **The brief accumulates.** It carries the current screen, the open Studio content and
   a running record of what changed: recent approvals, Beta versions, pending requests
   and releases (as far as the member's role may read them), plus what this member did
   through the port on this browser.
3. **The express inlet applies, saves, and hands over.** A pasted answer that carries an
   `aiwise` block is checked against the open Studio chapter, previewed field by field,
   applied through the normal Studio editing path, saved as the browser draft, and then
   offered to Control Tower with the existing Send button. Approval stays in Control
   Tower; Beta and Published are never written by the port.
4. **A remote MCP port is a later step.** One server that Claude, ChatGPT and Codex can
   all connect to. Decide after the brief has been used; its tool list should follow what
   members actually paste.

## How it is built

- `workspace/ai-port.js` — the right-edge **AI Port** tab and drawer (below My page).
  Exposes `window.AIWiseAIPort = {open, close, brief, parse, plan, apply, attachStudio,
  context}`. Only members can open it; signed-out users get the account dialog.
- `workspace/ai-port.css` — drawer layout, reusing the My page look.
- `workspace/content-studio.js` — one line after the editing tools are mounted:
  `window.AIWiseAIPort?.attachStudio(s, api)`. The port writes through the same `api`
  the box tools use (`remember`, `textChanged`, `update`, `controls`, `save`), so undo,
  format runs, preview and the tab-conflict guard behave as for typed edits. The session
  detaches itself when the Studio is disposed (`s.abort`).
- `workspace/tutorial-content.js`, `workspace/tutorials.js` — the `ai-port` guide.
- `CLAUDE.md` — points Claude Code at `AGENTS.md`.

### The brief

Plain text, English, in this order: what the system is (fixed summary), who and where
(member, role, screen, language, the screen's guide cards), Studio content when a Studio
is open (scope, chapter, locale, draft state, every field of the selected item with its
exact key, titles of the other items; a checkbox includes every item's text), recent
activity (shared tables by role), port history (this browser), optional diagnostics
(connection check, sign-in state, last page errors), and the answer format.

Field keys are flattened from the Studio session: `c2.examples[1].thinking`,
`c2.sat_example.phases[0].steps[2].text`, `c3.techniques.role.bad`, and for Common
`c1.block-3::Heading 1`. The inlet only accepts keys that exist in the open session.

### The answer block

```aiwise
{"aiwise":1,"scope":"psychology","chapter":"c2","locale":"en",
 "fields":{"c2.examples[1].thinking":"...","c2.sat_example_title":"..."}}
```

`parse` finds the block in a full answer (fenced `aiwise` or `json`, or bare JSON).
`plan` compares it with the open session: unknown keys, non-string values, enum fields
(`actor`, `tag`), unchanged fields and a scope/chapter/locale mismatch are reported, not
applied. When no matching Studio is open, the payload waits in `sessionStorage` and the
port offers to open the right chapter; the preview appears once that chapter is ready.
`apply` is refused while the session is blocked by a stale saved draft.

### Member setup for GitHub (Claude Code, Codex)

Each member needs a GitHub account in the `AIWise-EUR` organisation with access to this
repository, and their own Claude (Pro/Max/Team) or ChatGPT subscription. Claude Code on
the web connects through the Claude GitHub App; Codex connects through its own GitHub
integration. Start from `development`, work on a branch, and follow `AGENTS.md`. Content
edits still go through Studio and Control Tower, never through direct commits to
`content/approved/`.

## Status

| # | Item | State | Notes |
|---|---|---|---|
| 1 | AI Port drawer: brief, inlet, history | on `development-q6ets7`, tests pass | front-end only; no SQL or function change |
| 2 | Studio attach and apply path | on `development-q6ets7`, tests pass | one-line change in `content-studio.js` |
| 3 | `CLAUDE.md` for Claude Code | on `development-q6ets7` | |
| 4 | Browser check | local Chromium run passed; Beta site pending | real workspace shell with stubbed sign-in and backend: brief, preview, apply + save, iframe refresh, phone width, diagnostics. Check on the Beta site after merge to `development` |
| 5 | Remote MCP port | not started | decide after use |

## Log

- 2026-10-05 (Claude) Recorded the decision and built items 1–3 on `development-q6ets7`.
  All 37 repository test files pass under Deno (`workspace/tests/ai-port.test.cjs` added).
  Seen working in Chromium against the real workspace shell with a stubbed sign-in and
  backend: brief with Studio fields and shared activity, answer preview, apply + save,
  the preview iframe updating, Send to Control Tower offered, 390px layout, diagnostics.
  Not yet merged into `development`; not yet seen on the Beta site with a real account.
