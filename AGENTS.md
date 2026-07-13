# AGENTS.md

## Visible UI previews

A major visible UI change changes visible layout, styling, responsive behavior, or
browser interactions. Content-only changes and non-UI work are not major visible
UI changes.

For every major visible UI change:

* Confirm and report the absolute worktree path before implementation.
* Start `script/serve` immediately after plan implementation begins, from that
  worktree, and keep the preview running for the session.
* Include the preview URL printed by `script/serve` in session progress updates.
