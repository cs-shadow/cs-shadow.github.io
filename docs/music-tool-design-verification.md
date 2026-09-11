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
Existing song, draft, and export formats are unchanged. Scalar history retains
its storage key and pitch-class tuning arrays; version 3 adds capo, with older
entries normalized to capo 0.

## Automated checks

- Node suite: 178 tests passed, including shared control lifecycle, MIDI bounds,
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

- Scalar: the shared tuning/capo panel uses the same preset tiles, six string
  badges, inline note picker, capo neck and sounding summary as Chordinator.
  Apply commits tuning and capo; Cancel discards edits. Done/Escape return focus
  to the string badge. Applied Drop D with capo 2 survives reload, sounds F# on
  the first open string, and preserves the selected A major scale and chords.
  Restoring history restores root, scale, tuning, capo, and string-set labels.
  History selection retains focus even when it closes an open string picker.
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

## Shared capo follow-up

A subagent extracted the complete shared tuning/capo panel and migrated the
notebook; the primary agent integrated Scalar drafts, capo calculations and
history. A fresh reviewer identified the history-focus issue above; its fix and
regression test were verified. No remaining review findings.

Both expanded panels were rechecked at 375, 800 and 1280px without page overflow.
String controls are 44px high and capo targets at least 44px wide. Keyboard End
selects capo 12 and scrolls its fret into view while string badges remain visible.
Capo 12 limits Scalar diagrams to relative fret 12 (physical fret 24). Behavioral
tests check every note in the rendered A-major fingerings against the applied
capo, along with draft isolation, old history defaults and invalid capo rejection.
No octave adjustment controls are present in either tool.

## Print limitation

Automated print lifecycle/content tests pass, and the independent review checked
that print CSS overrides the shared hidden rules and colors. The in-app browser
did not expose a native print preview after invoking Print / Save as PDF, and no
other browser surface was available. Native pagination and PDF output therefore
remain visually unverified; screen reading checks are not a print visual pass.
