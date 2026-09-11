# Shared music-tool design verification

Verified on 2026-09-11 in
`/Users/enigma/.codex/worktrees/6bab/cs-shadow.github.io`.
The session preview runs at `http://127.0.0.1:4006/` via `scripts/serve`.

## Implementation

The primary agent established the scoped design tokens and shared tuning-control
API, then three subagents independently implemented Scalar Triads, notebook
integration, and shared styles with exclusive file ownership. The primary agent
integrated and verified the result. A fresh read-only reviewer found no actionable
issues in control lifecycle, state ownership, history compatibility, style scope,
legacy fallback visibility, or print CSS precedence.

Both pages load `music-tool.css` before their component styles and load
`music-tool-controls.js` before their controllers. Shared controls receive host
values and report changes; persistence and draft semantics remain in each tool.
Existing song, draft, history, and export formats are unchanged.

## Automated checks

- Node suite: 174 tests passed, including shared control lifecycle, MIDI bounds,
  focus restoration, notebook Apply/Cancel isolation, Scalar history restoration,
  legacy history, and unavailable storage.
- Ruby site rendering: 3 tests / 52 assertions passed, including rendered shared
  assets and script/style dependency order.
- Ruby Goodreads synchronization: 10 tests / 28 assertions passed.
- Ruby preview-server management: 4 tests / 15 assertions passed.
- Strict production and preview Jekyll builds passed.
- All 48 preserved URLs, internal local links, and preview noindex checks passed.
- `git diff --check` passed.

The machine's configured Ruby environment for these checks was:

```sh
export PATH=/private/tmp/guitar-notebook-gems/bin:/opt/homebrew/Library/Homebrew/vendor/portable-ruby/3.4.4/bin:$PATH
export GEM_HOME=/private/tmp/guitar-notebook-gems
export GEM_PATH=/private/tmp/guitar-notebook-gems
```

## Browser checks

Checked the actual local pages in the in-app browser at 375, 800, and 1280 CSS
pixels. Desktop pages use a 1040px container and 32px titles. Document width stays
within the viewport on the tested pages and expanded panels. Browser checks found
and corrected the fixed site logo overlapping tool headers at narrow and tablet
widths.

- Scalar: preset and custom string edits immediately update the tuning summary,
  fretboard, and string-set labels. Done/Escape return focus to the string badge.
  Custom tuning survives reload. Restoring an existing history entry restores
  root, scale, tuning, and string-set labels.
- Scalar: long scale/history labels fit on phones. Six strings tuned to C produce
  the existing empty-fingering message without page overflow. Root markers and
  pale tone markers are distinct on the scale map and compact triad diagrams.
- Notebook: shared presets and the string-note picker remain drafts until Apply;
  Cancel preserves standard tuning. Applying Drop D and capo 2 updates the song,
  and Undo restores the previous settings. Escape restores string-badge focus.
- Notebook: typing `Am F C G`, opening Explore, selecting C, manually capturing
  open C, accepting its name, and keeping the chord all work. Interactive frets
  measure 44 by 44 pixels; accepted roots are dark green and labelled as roots.
- Notebook: reading includes the composed section and the saved chord diagram.
  A long song title wraps without overflowing at 375px. Only one main workspace
  is displayed, and the 800px composition view retains its two-column layout.

## Print limitation

Automated print lifecycle/content tests pass, and the independent review checked
that print CSS overrides the shared hidden rules and colors. The in-app browser
did not expose a native print preview after invoking Print / Save as PDF, and no
other browser surface was available. Native pagination and PDF output therefore
remain visually unverified; screen reading checks are not a print visual pass.
