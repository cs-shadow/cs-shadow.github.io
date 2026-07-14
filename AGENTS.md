# AGENTS.md

## Git workflow

For each independent change, use an appropriately named Git worktree and
feature branch. Create the worktree and switch to its feature branch before
making changes. Work only from that worktree while the change is in progress;
switch to the worktree assigned to another change before working on it. This
keeps parallel changes isolated from one another.

Unless instructed otherwise, continue working in the worktree and feature
branch assigned to the current session.

## Visible UI previews

A major visible UI change changes visible layout, styling, responsive behavior, or
browser interactions. Content-only changes and non-UI work are not major visible
UI changes.

For every major visible UI change:

* Confirm and report the absolute worktree path before implementation.
* Start `scripts/serve` immediately after plan implementation begins, from that
  worktree, and keep the preview running for the session.
* Include the preview URL printed by `scripts/serve` in session progress updates.
