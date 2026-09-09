# Song notebook verification log

## Wave 0 — contract and staged baseline

Integration: `/private/tmp/guitar-song-notebook`, branch
`feature/guitar-song-notebook`. Original plan baseline: `991a47e`.

- Node: 3 contract/fixture/asset tests passed (local Node 26.8.1; CI uses Node 22).
- Ruby serve: 4 tests, 15 assertions; Goodreads: 10 tests, 28 assertions;
  site rendering: 3 tests, 32 assertions; all passed.
- Production and preview Jekyll builds passed; 48 preserved URLs, internal local
  links, preview noindex and whitespace checks passed. External links are outside
  the repository link check, as before.
- Existing Chordinator remains active; notebook hosts stay hidden and all linked
  assets exist. No worker module or new dependency is loaded prematurely.
- `scripts/serve` printed `http://127.0.0.1:4000/`; live output is `_site_live`.
- In-app browser setup failed with `Browser is not available: iab`; documented
  discovery returned an empty browser list. Browser interaction QA is pending a
  browser connection, not claimed as passed.
- Independently reviewed contracts clarify incomplete draft persistence, absolute
  PC interpretation evidence, slash bass/span rules, and Explore preview state.

The installed system Ruby is too old for locked Bundler. Existing Homebrew
portable Ruby and a temporary gem directory run the unchanged lockfile:

```sh
export PATH=/private/tmp/guitar-notebook-gems/bin:/opt/homebrew/Library/Homebrew/vendor/portable-ruby/3.4.4/bin:$PATH
export GEM_HOME=/private/tmp/guitar-notebook-gems
export GEM_PATH=/private/tmp/guitar-notebook-gems
JEKYLL_PREVIEW_COMMAND='bundle exec jekyll serve --source "$PREVIEW_WORKTREE/site" --destination "$PREVIEW_WORKTREE/_site_live" --host 127.0.0.1 --port "$PREVIEW_PORT"' scripts/serve
```

Preview launch and serve tests require access to localhost sockets outside this
session's sandbox. Start worker previews from their assigned worktree using the
same environment; scripts/serve chooses the available port. No global Ruby,
Gemfile or lockfile changes were made.

## Wave 1 — integrated foundation

- Music and model/storage handoffs were reviewed, committed in their own
  worktrees, and integrated serially. Model review corrected default section
  numbering before its commit, with a dedicated regression case.
- 62 Node tests pass, including real Music/model/storage/controller scenarios:
  no-setup progression, Unicode/enharmonic identity, atomic failed input and undo,
  draft origins after reload, variation retargeting, stale-source rejection,
  deleted-origin fallback, capo/retuning and versioned JSON ID remapping.
- Voicing tests independently enumerate allowed shapes and compare the globally
  ranked top eight; cancellation clears pending work. All 37 chord formulas,
  16 scales, 17 root spellings and five tuning presets are retained.
- Scalar Triads consumes the same root/scale data with its existing controller.
  Catalog equality, script order, rendered controls, production build, preserved
  URLs and internal local links pass.
- Chordinator now loads the foundation modules in order. Notebook activation
  waits for compose/editor; the existing tool remains active.
- Legacy all-muted history entries are omitted from recoverable chords without
  altering stored raw history. No musical identity is invented.
- Browser interaction verification remains pending browser availability.

Wave 2 glue remaining with integration: mount compose/editor into the prepared
hosts; activate the new boot/header/store; wire visibility/storage lifecycle and
download/print effects; add shared header styles; exercise complete authoring,
draft, settings, and responsive flows. Workers implement only their component
module, scoped stylesheet, and matching tests against the frozen action API.

## Wave 2 — activated composition and editor

- Automated core gate: 96 Node tests pass; Ruby serve 4 tests/15 assertions,
  Goodreads 10/28, site rendering 3/32 all pass. Production/preview builds,
  48 preserved URLs, internal local links, preview noindex and whitespace pass.

- Compose and editor stopped-write handoffs were reviewed, committed, and
  integrated serially (`5b6eedf`, `b168e36`). Their styles and scripts are linked;
  the notebook now activates instead of the legacy tool.
- Integrated event-DOM checks exercise the actual composer and editor through
  bootstrap: fresh empty Section 1, typed progression, unnamed shape Keep & add,
  and unchanged focused header fields/buttons across saves. Header rendering was
  corrected to preserve uncommitted text and the button receiving a blur click.
- Component/controller tests cover atomic invalid input, enharmonic identity,
  shared updates, reload-stable variation origins, explicit retargeting, deleted
  origins, stale source/settings review, fractional durations, multiline notes,
  reference-safe deletion, ordering, undo, quota/corrupt/conflict behavior.
- Actual browser checks completed earlier for Scalar Triads: C Dorian, Drop D,
  alternate D-A-D string set, history restoration after reload, and no logged
  errors. These checks do not establish notebook browser acceptance.
- CUA was available briefly, then disappeared from both integration and monitor
  tool exposure before core notebook checks. The user explicitly authorized
  carrying that environment-only browser gate to final verification while the
  remaining implementation proceeds. Core mobile, native-keyboard, actual local
  storage, read/print and full browser-console checks remain pending.
- Integration preview remains `http://127.0.0.1:4000/`; composer/editor previews
  use their separate worktrees on 4001/4002. Live output remains `_site_live`.

Wave 3 integration owns loading Explore/Reading, enabling Read/Print, printing
visibility and shared page styles, complete browser/phone/print verification once
tools are available, and final independent review. Explore/Reading workers own
only their named component JS, scoped CSS and matching tests.

## Core design remediation after supplied screenshot

The supplied 2026-09-08 20:31 screenshot showed legacy Chord names/Selected notes
above the notebook, excess vertical whitespace, mismatched content widths,
separated Undo/Redo, and touching Home/Scale fields. Inspection found the site's
`main { display: block }` overrode the native hidden rule; the notebook also
inherited the 640px article width instead of the 1040px tool width.

The shared stylesheet now explicitly hides the inactive legacy main, aligns the
notebook to the site's tool width, supplies its own visible page heading, groups
song actions, and lays out context labels with gaps and mobile wrapping. Common
control dimensions and visual rules are frozen in the contract appendix. A
regression verifies the hidden cascade guard and actual grouped action/context
markup; all 97 Node tests pass. This is source/DOM and build evidence against the
supplied before screenshot, not a claimed after screenshot or browser layout pass.

## Wave 3 — complete automated review candidate

Reading (`6832e7b`) and Explore (`096b331`) were reviewed and integrated from
stopped worker handoffs. All four components are now linked in frozen order.
Read/Edit and menu/native print are wired; Explore keeps its preview in view
state and its request cache locally, with cancellation on context changes.
Shared design token propagation (`6092696`) and print lifecycle (`0c888db`)
remain integrated. The test DOM now supports SVG namespaces for actual Reading.

- 125 Node tests pass, including all 37 formulas/16 scales/17 root spellings,
  globally ranked compact/full voicings, race cancellation, all collection scale
  evidence, real Read/Edit/Print bootstrap with SVG and retained drafts.
- JSON validation/remapping/atomic failures and pending-draft export exclusion
  pass; controller export displays the nonblocking unapplied-draft notice.
- Ruby serve 4/15, Goodreads 10/28, site rendering 3/32 pass; production/preview
  builds, 48 preserved URLs, internal local links, noindex and whitespace pass.
- Integration preview printed `http://127.0.0.1:4000/`; outputs stay isolated.
- Remaining acceptance: independent review and browser desktop/mobile375px,
  native keyboard/focus, real cross-tab/storage/download, multipage print and
  console checks. No notebook visual or browser pass is claimed. The supplied
  screenshot established the before defects; source/DOM checks establish the
  implemented correction, pending rendered verification.

## Independent review corrections

Four actionable findings at `0de5611` were corrected in targeted fixups:

- `8204987`: dependent draft writes wait until the committed library is saved;
  a partial-write/reload/retry regression preserves the previously durable draft.
  Settings changes through any song replacement, including undo/redo, invalidate
  selected exploration frets before another accepted shape can be kept.
- `d640989`: temporary print renders only Reading and changes host visibility,
  preserving live unblurred authoring nodes/values and restoring prior focus.
- `8bf776d`: Read offers only Edit and Print controls; authoring title/history,
  tuning/context/notes/settings return on Edit.

The full suite now passes 129 Node tests, including all four regressions. Site
rendering (3/32), production build and whitespace checks pass. The retained preview
still prints port 4000. Focused independent recheck is requested against `8bf776d`;
browser acceptance remains pending and is not established by these DOM tests.

## PR preparation — 2026-09-09

Follow-up implementation uses `/private/tmp/guitar-song-notebook-pr`, branch
`codex/song-notebook-pr`, for integration into the requested `more-chords` PR
against `main`. Its retained preview is
`http://127.0.0.1:4010/tools/guitar-chordinator/`.

The independent review found three header defects: stale settings previews,
accepted tonic spellings missing from the home selector, and a renamed library
entry replacing the button receiving the next click. Targeted regressions now
cover all three. Saved-chord inspection is read-only; explicitly choosing Edit
chord starts a durable draft and retains the inspected occurrence as its origin.
An existing draft retains its original target when another occurrence is selected.

Final automated gate passes: 134 Node tests; Ruby serve 4 tests/15 assertions,
Goodreads 10/28, site rendering 3/32; production and preview Jekyll builds;
48 preserved URLs, internal local links, preview noindex and whitespace checks.
The link checker does not check external URLs. Corrupt/quota storage, request
cancellation, stale drafts and exhaustive voicing ranking have automated evidence.

Actual in-app browser checks on port 4010 passed:

- Empty-song entry; keyboard progression submission and atomic invalid input;
  enharmonic input; read-only inspection without a draft; explicit editing.
- Reload-retained draft origins after selection changes; Save as variation
  affects only its original occurrence; Update shared changes shared occurrences.
- Native title typing followed immediately by New song; E# home preservation;
  fret-24/capo-1 rejection with the affected chord shown before Apply.
- Capo changes transpose shaped names while preserving name-only names; retuning
  marks shaped interpretations for review.
- Real file-chooser import and downloaded JSON export preserve unused, unnamed,
  name-only and slash chords, home references, multiline notes, fractional
  durations, annotations, arrangement order and repetition counts. Imported IDs
  are remapped. Unsupported-version import leaves the current song untouched.
- Real cross-tab changes suspend writes, retain the other tab's durable title,
  and resolve with Reload saved copy.
- Compact and fuller searches each return eight fingerings; scale analysis
  includes the unused B-flat chord and reports its outside notes.
- Reading shows the full 65-line section note, literal HTML-like notes, and
  accessible visible fingering SVGs; repeated arrangement sections are listed
  once in the section reference. Desktop has no horizontal page overflow.
- Scalar Triads C Dorian, Drop D and D-A-D string-set controls restore after
  reload. Notebook browser console checks recorded no warnings or errors.

Local QA fixtures and the actual exported JSON are retained in
`/private/tmp/song-notebook-qa/` (`acceptance.json`, `unsupported.json`,
`broken-reference.json`, `exported.json`). The broken-reference fixture is covered
by automated validation; it was not separately submitted through the browser.

Two visual acceptance checks remain unverified. The viewport capability accepted
375-by-812 dimensions but the page and screenshot remained 1280 pixels wide even
after reload; the override was reset. Print was invoked, but native print/PDF
inspection was unavailable in the in-app browser and native Firefox access was
denied. No 375-pixel layout or multipage printed-output pass is claimed. Print
lifecycle/content preservation and responsive CSS have automated coverage, which
does not replace those visual checks. These limits must remain visible in the PR.
