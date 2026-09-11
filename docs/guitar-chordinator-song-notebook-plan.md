# Guitar Chordinator song notebook: UX and agent implementation plan

Status: implementation handoff, incorporating the songwriting proposal and the
later UX discussion. Saving this document does not start app implementation.

## 1. Product direction

**Make it as simple as possible to start writing a song, while allowing rich
information to be added when needed.** Hide optional controls until needed, but
keep information the user has entered visible where it matters.

Evolve `/tools/guitar-chordinator/` into a notebook for one evolving song per
document, with a local library of songs. Retain `/tools/scalar-triads/` as a focused
reference, sharing suitable music logic. Do not introduce a third tool.

The workflow is collect chords, explore relationships, write reusable sections,
arrange a song, and export. These are available actions, not mandatory stages:
typing a progression or capturing an unnamed shape must work immediately.

This is a personal composition and journal tool. Unnamed shapes, name-only chords,
unspecified timing, unused chords, and unfinished sections are valid saved work.
There is no requirement to choose a key, name the song, or understand theory.

Out of scope: melody tracks, playback, lyric-to-chord alignment, a timeline or
meter grid, automatic harmonic-function explanations, section-specific tuning or
keys, partial capos, collaboration, a backend, and cloud synchronization.

## 2. Page and interaction specification

### Page structure and first visit

Use two working areas and one expandable detail area:

```text
Songs ▾       Untitled song                     Saved   Read   ⋯
Standard tuning · No capo                     + Home / scale

CHORDS IN THIS SONG              [Section 1] [ + ]

Am                          +   [ Am ] [ F ] [ C ] [ G ]
F                           +   Add chords: [ Am F C G…       ]
C                           +
G                           +   Add section notes…

+ New chord    Explore          Song order ▸

Expandable work area: chord details / shape editor / explore
```

- First visit opens an untitled song, an empty collection, and an empty Section 1.
  Show the chord input and New chord/Explore actions; do not preload a sample
  chord. Brief empty-state copy describes the three entry paths.
- Restore the last open song on return. Creating or renaming a song is inline;
  no onboarding modal or setup wizard. Defaults are standard tuning, no capo,
  no harmonic context, and no durations.
- On desktop, use a narrower collection column and a wider section column. The
  work area spans both below them; it does not replace the composition workspace.
  Song settings open from the tuning/capo summary; library actions open from Songs.
- The song menu contains JSON import/export and Print / Save as PDF. Read switches
  to a dedicated reading presentation; Edit returns to the same section/selection.
- Song notes start as an Add song notes affordance below the header. Entered song
  and section notes remain visible, preserving line breaks.
- Below 800 CSS pixels, stack the section workspace first, the chord collection
  second, and the detail area third. Keep all actions available; use horizontal
  scrolling only inside the fretboard, not the entire page. Reading is optimized
  for phone use, with no editor controls and no horizontal page scrolling.

### Enter known chords quickly

- Submit `Am F C G` with Enter or Add. Parse whitespace/comma-separated symbols,
  including accidental roots, catalog suffixes, and slash basses. Accept ASCII or
  musical sharp/flat characters. Chord symbols describe sounding harmony.
- With no selected occurrence, append. With an occurrence selected, insert after
  it; label the action/location accordingly. Multiple tokens are one undo step.
- Reuse a matching name-only collection entry when available. Otherwise create a
  name-only entry; never silently assign a saved fingering, even if only one shape
  currently matches. Reuse requires the same root, formula, slash bass, and
  normalized root/bass spelling (ASCII and musical accidental glyphs normalize
  together). Thus C# and Db get separate entries; preserve the spelling typed
  without renaming existing references. Typing the same symbol repeatedly produces
  separate occurrences referencing the same name-only entry.
- Unknown tokens remain in the input with an inline explanation. Apply no part
  of a submission until all tokens are valid. Offer New chord for an unnamed shape
  or a nickname; nicknames are not parsed as chord symbols.
- Name-only entries show a subdued “Fingering not set” in their details, without
  blocking composition or presenting an error. Choosing a shape later is explicit.

### Capture, inspect, and vary chords

- Clicking a collection row inspects it. Its separate `+` always appends it to the
  active section; inspection must never insert a chord accidentally.
- New chord opens a blank wide fretboard in the work area, with a switch to
  root/quality entry. Shape capture supports mute, open, and one fret per string.
  At least one sounding string or a structured chord identity is required to Keep.
- Show candidate interpretations with the existing exact/close distinctions and
  missing/extra notes. Accepting a candidate is optional. An unnamed shape gets a
  display fallback such as “Chord 1”; a nickname is separate from musical identity.
- Start details with chosen name and fretboard. Expand alternate interpretations,
  per-note intervals, personal notes, and usage locations individually. Entered
  nickname/notes and review-needed status remain visible in the collapsed summary.
- New-shape actions are **Keep chord** and **Keep & add to Verse** (using the active
  section name). Both save the chord; the second also appends one occurrence.
  Name-only entry has the same actions, without requiring a shape.
- Selecting an occurrence reveals its local controls. Chord details opens the
  shared entry editor and identifies the originating occurrence.
- Saved-shape edits remain a preview until explicitly applied. Display usage
  count and offer **Update shared chord** and **Save as variation**. Updating
  changes every reference. A variation creates a new collection entry; when
  opened from an occurrence, only that occurrence switches to it. From the
  collection, a variation does not modify any occurrence.
- Pending shape and interpretation changes are not automatically committed when
  switching to Explore, another chord, or another section. Keep drafts keyed by
  song and target entry (including one new-chord draft), with a Resume draft
  affordance. Cancel discards that draft explicitly. Changing inspection targets
  must not overwrite another draft.
- Autosave drafts separately from committed song data so reload/song switching
  recovers experiments. Drafts are not part of normal JSON exports or printouts;
  export with a pending draft displays a nonblocking “Unapplied draft not included”
  note. Applying or discarding removes the saved draft. If the underlying chord
  changed, require re-opening the current version or saving the draft as a new
  variation; never overwrite a newer shared entry silently.
- Persist a draft's originating song, section, and occurrence IDs when opened from
  an occurrence. Opening the same chord from another occurrence does not silently
  retarget that draft. Resume shows its original target; an explicit “Use selected
  occurrence for variation” action can change it. Reload preserves that target
  independently of current selection. If the original occurrence or section was
  deleted, Save as variation keeps the new chord in the collection and explains
  that nothing was replaced. Never substitute another occurrence automatically.

### Write sections and arrange the song

- Section tabs show one section at a time. `+` immediately creates and selects
  the next “Section N”; rename inline. A section menu offers duplicate and delete.
- Chord occurrences wrap naturally across rows; wrapping does not imply bars.
  Selecting one shows replace, move left/right, duplicate, remove, chord details,
  optional duration, and annotation. Provide keyboard-operable buttons; drag
  interaction is optional and cannot be the only way to reorder.
- Duration is unspecified by default. If set, use a positive finite number of
  beats or bars; fractional values are allowed. No meter, tempo, totals, timing
  conversion, or grid is implied. Show entered duration and annotation beneath
  the occurrence after controls close.
- A section has multiline freeform notes. Duplicating a section creates fresh
  section and occurrence IDs but retains references to the shared chords.
- Song order starts collapsed and empty, showing Add song order. When populated,
  keep its compact summary visible while controls remain expandable. Append section
  references by clicking section names inside this area; support reorder, remove,
  and a positive integer repeat count, default 1. Repeated entries are also valid.
- Editing a section changes all its appearances in song order. For a differing
  chorus, duplicate its section, edit it, then use the new section in song order.
- Deleting a referenced chord or section first shows its usage and explicit
  replace-reference or remove-reference actions. Do not create dangling IDs.
  Deleting the last section leaves a new empty Section 1. Song deletion requires
  confirmation; do not conflate deleting a song with clearing legacy history.
- Provide undo/redo for discrete song edits, including destructive reference
  changes and bulk input. Coalesce text editing until blur/commit. Undo/redo is
  per-song, session-local, capped at 100 transactions; autosave the resulting state.

### Tuning, capo, and harmonic context

- One tuning and one full capo apply to the whole song, including unused chords.
  Changes are deliberate song-setting edits, never occurrence settings.
- Show Standard, Drop D, Open G, Open D, and DADGAD as preset tiles with notes
  labelled low-to-high. Each string has a tuning-before-capo badge that opens an
  inline chromatic-note and octave picker; highlight the matching preset or
  show Custom tuning. Use actual register to determine bass and inversion.
- Draw a six-string neck with string 1 at the top and clickable capo frets 1–12,
  a visible capo bar, a No capo button, and resulting open-string pitches.
  Preset, string, and capo changes update a draft and affected-chord preview;
  Apply commits the settings, while Cancel leaves the song unchanged.
- Provide labelled buttons, selected states, visible keyboard focus, arrow and
  Home/End capo navigation, and Done/Escape for the string picker. Preserve
  focus and the picker through draft updates. On phones, wrap controls and
  keep string badges beside a scrolling neck with at least 44px touch targets.
- Store frets relative to capo: fret 0 sounds at capo, and physical fret equals
  capo plus relative fret. Support physical frets through 24 and capo 0–12.
- When names differ, show “C shape · sounds D · capo 2”. Primary section/analysis
  names are sounding names. Fingerings and compact diagrams label relative frets.
- Retuning preserves frets, recomputes notes, and marks saved interpretations for
  review, retaining their previous labels. Do not select replacement names.
  Moving capo preserves shapes and transposes accepted sounding interpretations;
  name-only entries retain their sounding identity. If a capo move puts a shape
  beyond physical fret 24, block Apply and list the affected chords; never clamp
  or erase them. Settings previews show affected entries before Apply.
- A setting change also invalidates pending shape drafts for review, preserving
  their old tuning/capo context. Resume lets the user keep the frets under current
  settings or discard; applying a stale draft directly is disallowed.
- Home / scale is optional. An interpreted chord can establish the home root,
  or the user can choose a tonic directly. Scale selection remains optional.
  “Use as song scale” sets that candidate's tonic and scale explicitly. Browsing
  only previews highlighting. Removing context leaves all music intact.
- Show quality-aware Roman labels beneath chord names, retaining extensions and
  slash-bass information. Use a fixed major-scale degree reference: A home gives
  Am = i and C = ♭III. Use degree mapping I, ♭II, II, ♭III, III, IV, ♯IV, V,
  ♭VI, VI, ♭VII, VII for chromatic roots; lowercase minor/diminished roots, mark
  diminished/augmented qualities, and retain sus/power qualifiers. Explain this
  convention in a short legend. Uninterpreted or review-needed chords have no
  Roman label; do not infer function from a nickname.
- Home stores an explicit tonic and optional source chord ID. Editing a home
  source chord previews the resulting tonic change before Apply. Deleting it
  retains the last tonic as explicit context and clears the source reference.
  A scale shares the same tonic; no conflicting independent key fields.

### Explore without losing composition state

- Explore opens **Browse a scale** and **Find scales for my chords**. Preserve
  active section, selection, drafts, and exploration settings when switching.
- Browse uses the complete existing Scalar Triads scale/mode catalog and root
  spellings. Show the existing descriptive scale feel where available. Enumerate
  every recognized Chordinator chord formula whose complete pitch set fits,
  including extensions and alterations, not just triads.
- Group results into triads/power chords, sevenths, suspended/added-note/sixths,
  and extended/altered chords. Select a result to show tones, relationship, and
  on-demand fingerings. Keep chord and Keep & add actions work before choosing a
  fingering. Identical pitch sets with different named formulas remain available.
- Offer compact three-adjacent-string and fuller guitar shapes. Search current
  tuning/capo, require every distinct chord pitch (and requested slash bass),
  exclude other pitches, and rank at most eight distinct shapes per mode. Suggested
  shapes stop at physical fret 14 (`14 - capo` relative); manual and saved shapes
  retain the physical fret 24 limit. Limit fretted-note span to four frets; open
  strings do not increase span. Fuller mode uses at least four consecutive sounding
  strings, muting only at the edges, and requires the actual lowest MIDI pitch to
  be the root unless a slash bass is requested. Compact mode uses exactly three
  adjacent strings and allows inversions unless a slash bass is requested.
- For fuller shapes in standard tuning, prioritise familiar open and upward-
  transposed movable forms: C/A/G/E/D major, A/E/D minor, A/G/E/D dominant seventh,
  C/A/G/E/D major seventh, and A/E/D minor seventh. Transposition moves all sounding
  strings, including open strings, and accounts for capo and sounding root. Every
  template must satisfy the same coverage, bass, continuity, span, and fret limits
  as generated shapes. Deduplicate by fret array before selecting eight. Other
  tunings and qualities use general search. Rank fuller shapes by template match,
  lower highest fret, fewer muted strings, smaller span, lower position, then a
  stable fret-array tie-break. Compact ranking remains smaller span, lower
  position, fewer muted strings, then the same stable fret-array tie-break.
  Prune impossible pitch coverage and search asynchronously in chunks so the UI
  remains usable; cancel stale requests on chord/tuning changes. No complete
  shape is a valid result, especially for formulas with more than six pitch classes.
  Explain it and retain name-only/manual capture actions.
- Find scales analyzes the **whole collection**, including unused entries and
  different fingerings. Use actual sounding pitches for shapes, formula plus
  slash bass for name-only entries, and explicitly list excluded unresolved
  name-only entries. An unnamed sounding shape can still contribute its pitches.
- Search every catalog scale across all 12 tonics. Rank fewer outlier chords,
  then fewer total outside pitch classes counted per chord; exact fits come first.
  Prefer the current tonic on ties, then catalog/root order. Preserve spelling
  choices for display. Duplicate occurrences never weight this analysis.
- Show “Fits 4 of 5 chords”, name the outlier chord, and name its outside notes.
  Details expand chord-by-chord membership. Show compatibility suggestions, not
  asserted key detection; with no analyzable entries, prompt to add a chord.
  Applying a candidate changes analysis only, never chord content or order.

### Reading and export

- Read shows title, tuning/capo, optional harmonic context, song notes, optional
  arrangement, each section once in document order, and a chord dictionary.
  Arrangement references show repeats; do not expand repeated sections into
  duplicated pages. Without arrangement, the section list is the song sheet.
- Include occurrence durations/annotations, section notes, and all collection
  entries, including unused material. Diagrams accompany shapes; name-only and
  unnamed entries remain understandable. Show both shape/sounding labels with capo.
- Print the reading presentation, hide site navigation/editor controls, preserve
  multiline notes, avoid breaking a diagram across pages, and permit long notes
  to wrap and span pages. Use browser Print / Save as PDF; no PDF service.
- Export one complete committed song as versioned JSON, including IDs, unused
  material, and unfinished entries. Import validates the entire file before any
  mutation, then creates a new copy with fresh IDs and remapped references. Reject
  unsupported versions or broken references with actionable errors; keep existing
  data unchanged. Imported notes are text, never injected HTML.

## 3. Data and implementation contracts

### Repository grounding and reuse

The `more-chords` baseline has plain browser JavaScript, Jekyll pages, Ruby tests,
and no JavaScript package manifest. Chordinator already shares preset/custom
pitch-class tuning with Scalar Triads through `guitar-tuning.js`, and both use
`recent-settings.js`. Chordinator currently starts with a C shape and one shape
at a time. Its bass calculation uses string position and must be replaced for
the notebook. The current tuning helper stores pitch classes, not registers.

Inspect the local `feature/full-diatonic-chords` and `feature/song-study` branches
for independently useful spelling, enumeration, validation, and music helpers.
Reuse only reviewed functions with tests. Do not merge either branch wholesale or
import Song Study's timeline, per-section key/meter, melody events, or storage model.

Use dependency-free classic-script modules with CommonJS exports for Node tests,
following the existing style. Keep Jekyll and both public routes. No framework,
bundler, or new package dependency is required. Module naming below is the agreed
boundary; the integration owner freezes exact record/action signatures in wave 0.

### Persistent records

All record collections below are ordered arrays. All IDs are opaque strings;
generate with `crypto.randomUUID()` and a tested collision-resistant fallback.
Timestamps are ISO strings. Null denotes deliberately unset optional structure;
text fields use empty strings. Store user-selected spelling/interpretation, and
derive notes, diagrams, Roman labels, and compatibility results.

| Record | Fields and invariants |
| --- | --- |
| Song | `id`, `title`, `notes`, `createdAt`, `updatedAt`, `tuningMidi[6]`, `capo`, optional `context`, `chords[]`, `sections[]`, `arrangement[]` |
| Context | `tonicPc`, `tonicSpelling`, nullable `sourceChordId`, nullable `scaleId`; one tonic serves home and scale |
| Chord | `id`, nullable `frets[6]`, nullable `interpretation`, `nickname`, `notes`, `reviewRequired`, nullable `previousInterpretation` |
| Interpretation | `rootPc`, `rootSpelling`, `formulaId`, nullable `bassPc`/`bassSpelling`; defines sounding identity, independent of nickname |
| Section | `id`, `name`, `notes`, `occurrences[]` |
| Occurrence | `id`, `chordId`, nullable `duration: {value, unit: 'beats' or 'bars'}`, `annotation` |
| Arrangement entry | `id`, `sectionId`, `repeatCount` |
| Library | `version: 1`, `activeSongId`, `songs[]` |
| Export envelope | `format: 'cs-shadow.guitar-chordinator.song'`, `version: 1`, `song` |
| Draft envelope | `version: 1`, drafts keyed by song/entry, candidate chord data, source-entry fingerprint, source tuning/capo, `songId`, nullable `originSectionId`/`originOccurrenceId`; no derived DOM state |

Use string order 1–6 (high E through low E), matching existing arrays. Standard
MIDI tuning is `[64,59,55,50,45,40]`; Drop D is `[64,59,55,50,45,38]`; Open G is
`[62,59,55,50,43,38]`; Open D is `[62,57,54,50,45,38]`; DADGAD is
`[62,57,55,50,45,38]`. Custom open MIDI pitches are integers 0–127. Frets are null
(muted) or nonnegative integers within `24 - capo`. Formula IDs are the existing
suffix strings, including the empty major suffix; do not collapse add2/add9 or
other enharmonically equivalent formulas.

### Module interfaces and ownership boundaries

All new modules except the boot controller live in
`site/assets/js/song-notebook/`. Tests mirror their module names under
`test/song-notebook/` and run with `node --test test/song-notebook/*.test.cjs`.

| Module / browser export | Responsibility and public contract |
| --- | --- |
| `music.js` / `SongNotebookMusic` | Immutable chord/scale/preset catalogs; `parseChordSymbol(text)` returns structured interpretation or error; `notesForShape(tuningMidi, capo, frets)` returns absolute and pitch-class notes; `identifyChord(notes)` returns exact/close candidates; `romanLabel(interpretation, context)`; `chordsForScale(tonicPc, scaleId)`; `matchScales(chords, settings, context)`; cancellable async `findVoicings(interpretation, settings, options)` |
| `model.js` / `SongNotebookModel` | Pure `createSong`, `validateSong`, `applyAction(song, action)`, `duplicateSong`, `getUsage`; validates references, resolves compound edits atomically, and delegates musical recomputation to injected Music. `applyAction` returns `{song, error}` without mutating input. IDs/time are injectable for tests. |
| `storage.js` / `SongNotebookStorage` | Injected storage API; `loadLibrary`, `saveLibrary`, `loadDrafts`, `saveDrafts`, `exportSong`, `importSong`, `readLegacySettings`. Return data/errors; no DOM, no silent overwrites. |
| `compose.js` / `SongNotebookCompose` | Collection, section tabs, occurrence controls, section notes, arrangement, typed progression. `mount(hosts, api)` returns `render(viewState)` and `destroy()`. Emits actions through `api.dispatch`. |
| `editor.js` / `SongNotebookEditor` | Shared/new chord drafts, wide fretboard, interpretation chooser, variation/update controls. Same mount/render/destroy interface; emits draft actions and explicit apply actions. |
| `explore.js` / `SongNotebookExplore` | Scale browsing/matching, voicing request lifecycle, keep/insert actions. Same component interface; previews stay in view state. |
| `reading.js` / `SongNotebookReading` | Pure reading DOM construction from committed song + derived music; same component interface. Rendering alone never opens print dialogs or changes song state. |
| Existing `guitar-chordinator.js` | Integration-owned boot/controller: module wiring, song library/header/settings/menu, immutable state/store, selection, drafts, undo/redo, autosave scheduling, import/export/download/print actions. |

The shared component API is `{dispatch, music}`. Render receives a read-only
`{song, activeSectionId, selectedOccurrenceId, inspectedChordId, panel, drafts,
exploreState, saveStatus}` snapshot. Components own DOM only inside their assigned
hosts; they do not query sibling DOM, write storage, or change global state.
Integration's action dispatcher is the only state mutation boundary.

Wave 0 must record and freeze action payloads for song/chord/section/occurrence/
arrangement CRUD, context/settings apply, selection/panel changes, drafts,
exploration previews, undo/redo, and library/import/export actions. Compound
operations (typed progression, variation, reference replacement, settings apply)
are single transactions. Freeze by adding a short contract appendix to this file
and shared contract fixtures before worker branches are created. The integration
owner makes any later contract change centrally and restarts dependent workers
from the new baseline; workers must not invent incompatible APIs independently.

### Saving, recovery, and failure behavior

- Store library at `cs-shadow.guitar-chordinator.library.v1` and drafts at
  `cs-shadow.guitar-chordinator.drafts.v1`. Debounce text saves by 500 ms; save
  discrete actions promptly and flush pending saves on document visibility change.
  Display Saving, Saved, or Save failed; show Saved only after successful storage.
- Keep in-memory work usable when local storage is unavailable or full, and expose
  JSON export. A corrupted library is not replaced automatically: preserve raw
  stored data and offer raw backup plus explicit reset while allowing an in-memory
  new song. A second-tab storage change prompts reload or retaining/exporting the
  local copy; suspend overwrites until resolved.
- Keep the old `cs-shadow.guitar-chordinator.recent-settings.v1` key untouched.
  Offer Recover old shape in the library menu when valid entries exist. Recovery
  creates a new song with that tuning and one unnamed shape; do not guess an
  accepted interpretation. Convert legacy pitch classes to the nearest MIDI
  pitches around standard tuning (lower pitch wins ties), disclose that octave
  assumption, and let the user review tuning. Preserve Scalar Triads history.
- Never read or overwrite Song Study's library as if it were this format.
  Duplicating/importing a song remaps every entity/reference ID, including the
  optional home source, and starts a fresh undo history. Library switches retain
  drafts; deleting a song removes its drafts only after confirmation.

## 4. Delegated execution and integration protocol

### Roles, slots, and worktrees

The top-level session **only delegates, monitors, resolves user-facing questions,
and reports**. It does not edit app files, integrate commits, run build/browser
checks, or take over a worker's implementation. Delegate remediation too.

Use at most four active agents: the top-level monitor, one integration owner, and
at most two workers/reviewers. The integration owner remains responsible throughout
for worktree setup, contracts, shared files, integration, conflicts, preview, final
verification, and Git operations. The monitor schedules workers and relays reports.

The current documentation task uses the user's assigned checkout
`/Users/enigma/git/cs-shadow.github.io` on `more-chords`. At implementation kickoff,
the integration owner verifies status and carries this plan into the baseline
without overwriting unrelated work. Each independent implementation task uses a
separate, suitably named feature branch and worktree. Use an integration worktree
on `feature/guitar-song-notebook`, and worker branches named
`feature/guitar-song-notebook-<task>`. Keep every agent in its assigned worktree and
branch. Report absolute paths; do not treat a relative directory or shared cwd as
proof of isolation.

Before any major UI implementation, the integration owner reports its absolute
worktree path, starts `scripts/serve` immediately as implementation begins, and
keeps it running for the session. Include the URL actually printed by the script
in progress reports; do not assume port 4000. A worker making major UI changes must
likewise report its path and start/retain its worktree preview when UI work begins.
Use the integration preview as the main user review target after each integration.

Workers edit only owned files and run their bounded checks in their own worktrees.
Workers return file diffs/test evidence; the integration owner handles branch
commits and serialized integration after the worker stops writing. Do not cherry-
pick from active workers. An alternative agreed at assignment is worker-created
commits on its own branch, with integration still exclusively owner-controlled.
Default to integration-owner Git mutations so the monitor never needs to intervene.

Use meaningful commits with titles/body lines within 72 characters. Correct prior
commits with targeted fixups; keep distinct work separate. Never put “codex” in
commit messages or PR titles. Do not push or open a PR unless requested. If later
requested, squash fixups into their targets before pushing, create a non-draft PR
unless specified, and run `git push`, `gh pr list`, and `gh pr create` outside the
sandbox as required by repository instructions.

### Bounded tasks and dependency waves

Ownership includes each named module's matching test file. Component workers own
their own `compose.css`, `editor.css`, `explore.css`, or `reading.css` inside
`site/assets/css/song-notebook/`; scope selectors beneath their component root.
No worker owns the page template, global stylesheet, script loader, shared helper,
CI, or another worker's file. Those belong to integration alone.

| Wave / task | Agent and owned files | Prerequisite | Deliverable and acceptance |
| --- | --- | --- | --- |
| 0 / contract and baseline | Integration: this plan appendix, contract fixtures, boot/page skeleton, component hosts, shared CSS/load order, CI wiring | Verified implementation worktree | Frozen records/actions/hosts; baseline test results; functioning preview; no unresolved worker API choices |
| 1A / music foundation | Music worker: `music.js`, `music.test.cjs` | Wave 0 baseline | Complete catalogs, absolute pitches, recognition, parsing, Romans, matching, cancellable voicings; music cases below pass |
| 1B / document and saving | Model worker: `model.js`, `storage.js`, matching tests | Same wave 0 baseline and frozen Music contract | Atomic edits, reference integrity, validation, drafts, library/export/import/legacy recovery, deterministic tests using contract fixtures |
| 1 gate / foundation integration | Integration: boot, shared helpers/adapters, existing Scalar Triads JS/page, contract fixtures | Both workers handed off | Integrate 1A then 1B; replace fixture Music with real module; regression-check Scalar Triads; publish tested baseline SHA |
| 2A / composition workspace | Composition worker: `compose.js`, `compose.css`, matching test | Wave 1 integrated SHA | Fast typed entry, collection, sections, occurrence timing/notes, order, reference-safe actions and keyboard flows |
| 2B / chord detail editor | Editor worker: `editor.js`, `editor.css`, matching test | Same wave 1 integrated SHA | Shape/name capture, exact/close names, retained drafts, shared update/variation, guitar details; no state/storage leakage |
| 2 gate / core UX integration | Integration: boot/header/library/settings and page/global files | Both workers handed off | Wire core interactions/undo/autosave; verify no-setup entry paths, drafts, tuning/capo and mobile stacking; publish tested baseline SHA |
| 3A / harmonic exploration | Explore worker: `explore.js`, `explore.css`, matching test | Wave 2 integrated SHA | Both exploration paths, complete formulas, previews, full-collection outliers, responsive voicing requests, keep/insert |
| 3B / reading and printing | Reading worker: `reading.js`, `reading.css`, matching test | Same wave 2 integrated SHA | Phone reading and print layout with all committed content; no duplicate section definitions or clipped diagrams |
| 3 gate / complete integration | Integration: boot import/export/print menus, page/global CSS/CI and shared files | Both workers handed off | Wire and verify full workflow and regression suite; final implementation candidate SHA |
| 4 / independent review | Fresh reviewer: read-only review and report; integration owns fixes | Final candidate SHA and running preview | Review plan conformance, contracts, UX, data safety, browser/print evidence, and tests; report severity and reproduction steps |
| Final gate | Integration then monitor | Review fixes integrated and rechecked | Integration hands off clean status/commits/checks/preview/limitations; monitor reports outcome without implementing |

After every parallel wave, stop worker writes, integrate one handoff at a time,
resolve conflicts centrally, run the wave gate, and record its new baseline SHA.
Create the next wave's branches/worktrees from that SHA, not the original branch
or a sibling worktree. Do not run dependent waves speculatively. If a module needs
a shared-file edit, the worker requests it and integration applies it between
waves; workers must not patch shared files as a shortcut.

Integration may work concurrently on its exclusively owned files only after
contracts are frozen. Record any deviation from this plan in the appendix with
reason and affected acceptance criteria. Scope/UX changes go to the monitor for
user discussion; routine implementation details remain the integration owner's job.

### Worker assignment and handoff format

Every assignment includes task ID, absolute worktree, branch, baseline SHA, owned
files, frozen contracts, prerequisites, acceptance cases, and forbidden shared
edits. Every handoff includes changed paths, commit(s) or patch status, commands
and results, preview URL/screenshots when relevant, unresolved issues, and explicit
confirmation that writes have stopped. “Implemented” without evidence is not a gate.

The reviewer must not review their own implementation. Assign review only after
implementation workers finish, respecting the four-slot limit. Integration routes
findings back to the appropriate worker or fixes integration-owned code itself;
the top-level session continues monitoring. Repeat focused review for fixes.

## 5. Verification and completion checklist

### Required cases

- Immediate start: fresh storage exposes empty Section 1 and all three entry paths;
  capture and keep an unnamed shape without setup; type `Am F C G` with no
  fingering/key/timing; add a scale-discovered name-only chord and insert it.
- Progression parsing: slash chords, enharmonic spellings, all supported suffixes,
  repeated symbols, malformed token atomicity, and several existing fingerings
  for one name. Typing must retain undecided fingering; typing C# then Db in one
  section preserves both spellings without renaming earlier references.
- Chords: different fingerings stay distinct; exact/close interpretations retain
  missing/extra evidence; nickname does not affect analysis; custom tuning with
  nonstandard string register yields the true lowest sounding note.
- Drafts: leave an edited shape for Explore and return; switch songs and reload;
  update a shared chord in three occurrences; save a variation from one occurrence;
  save a collection variation; cancel; handle source/context changes without loss.
  Reload and change selection before resuming a variation draft; it still targets
  its original occurrence. Delete that occurrence/section and verify collection-
  only fallback; explicit retargeting affects only the newly selected occurrence.
- Guitar settings: C shape plus capo 2 sounds D; name-only C stays sounding C;
  retuning preserves frets and flags old labels; invalid high-fret capo move is
  blocked without clipping; pending drafts retain previous context for review.
- Composition: shared chorus updates every use; duplicated chorus can diverge;
  durations accept positive fractions but reject zero/negative/nonfinite input;
  notes/durations remain visible; reordering and reference deletion work with
  keyboard alone; undo reverses bulk input and destructive transactions.
- Harmony: major/minor/modal/chromatic, seventh/extended/altered formulas,
  incomplete shapes, ambiguous pitch sets, scale-less home, and no context. With
  C, F, G, and B♭ in the collection, C major identifies B♭ and its outside B♭ note;
  unused B♭ still contributes. Duplicate occurrences do not alter ranking.
- Voicings: compact and fuller shapes have complete coverage, correct bass,
  allowed physical frets/span, deterministic ranking, cancellation, and meaningful
  no-result states, including chords requiring seven distinct pitch classes.
- Persistence: create/switch/rename/duplicate/delete/reload; missing or full local
  storage; malformed stored JSON; concurrent-tab protection; legacy recovery;
  JSON round trip of unused/unnamed/name-only entries, notes, durations and order;
  malformed/version-mismatched imports; ID remapping including home references.
- Presentation: desktop authoring, narrow-screen editing, phone reading at 375
  CSS pixels, keyboard focus and accessible labels, long titles/notes, no console
  errors, and a multipage printed song with diagrams and all entered content.
- Regression: Scalar Triads root/scale/tuning/string-set/history interactions,
  both preserved tool routes, other site pages, and existing recent settings.

Use Node's built-in test runner for pure music/model/storage behavior. Add meaningful
component/action tests using lightweight injected hosts/fixtures where appropriate;
do not introduce a DOM framework merely to mirror rendering. Verify complete user
flows in the browser, including actual local storage and keyboard interactions.
Follow the browser skill for in-app browser work. Save concise verification evidence
and print screenshots/artifact locations in the final integration handoff.

Integration runs the Node suite and the repository's Ruby tests, then the same
production/preview Jekyll builds and URL/link/noindex checks used by CI:

```sh
node --test test/song-notebook/*.test.cjs
ruby test/serve_test.rb
ruby test/sync_goodreads_test.rb
ruby test/site_render_test.rb
JEKYLL_ENV=production bundle exec jekyll build --source site --destination _site --trace --strict_front_matter
ruby .github/scripts/check_preserved_urls.rb
ruby .github/scripts/check_internal_links.rb
JEKYLL_ENV=preview bundle exec jekyll build --source site --destination _site_preview --trace --strict_front_matter
ruby .github/scripts/check_preview_noindex.rb _site_preview
git diff --check
```

Add Node 22 setup and the Node suite to the existing Jekyll CI workflow. Run checks
from the assigned worktree; keep preview serving its own build destination if a
production build would otherwise collide with its output. Once checks pass, repeat
only for new changes, failures, or unresolved findings.

### Monitor checklist

- [x] Integration owner assigned; worktree/branch/baseline reported.
- [x] Preview started immediately for UI implementation; printed URL reported.
- [x] Wave 0 contracts and file ownership frozen.
- [x] Wave 1 music and document/storage handoffs accepted and integrated.
- [x] Foundation baseline published; Scalar Triads still usable.
- [x] Wave 2 composition and editor handoffs accepted and integrated.
- [x] No-setup entry, draft retention, shared/variation and settings flows verified.
- [x] Wave 3 exploration and reading handoffs accepted and integrated.
- [ ] Whole-collection analysis, export/import and phone/print flows verified.
- [ ] Required automated checks and browser scenarios pass.
- [x] Independent review completed; material findings fixed and rechecked.
- [x] Integration status, commits, evidence and live preview handed off.
- [x] Concrete verification limitations recorded; user explicitly requested a PR.

## 6. Explicit defaults and contract-freeze appendix

The defaults chosen here resolve remaining routine details: two-column composition
plus expandable work area; standard tuning/no capo/no context; name-only typed
input; sounding primary names; optional beat/bar durations; local per-song drafts;
atomic actions; six strings; capo 0–12/physical frets 0–24; full existing formula
and scale catalogs; fixed major-reference Romans; four-fret voicing span; 500 ms
text-save debounce; 100 undo transactions; 800 px stacking; JSON manual transfer.

Do not add optional features to fill blank controls. Keep rich information behind
explicit actions and reveal it in place after entry. The completion criterion is
the working composition flow and its preservation of musical intent, not the
number of controls exposed.

Before parallel implementation, the integration owner appends: verified baseline
SHA and worktree paths; exact action payloads/result and error shapes; DOM host IDs;
script loading order; contract fixture locations; and any repository-driven
adjustments to adapter boundaries. This is the bounded wave 0 deliverable, not a
product redesign delegated independently to each worker.

### Wave 0 contract freeze

The exact revision-1 contracts are recorded in
[`song-notebook-contracts.md`](song-notebook-contracts.md), with shared constants
in `site/assets/js/song-notebook/contracts.js` and independent-worker fixtures
in `test/song-notebook/fixtures.cjs`. This appendix freezes Music result records,
model/storage injection, atomic actions, draft origins and conflicts, component
hosts, and load order. Wave 0 retains the existing working Chordinator while
the hidden notebook hosts await integrated modules; no missing module is loaded.
Preview output uses `_site_live` to avoid production/preview check collisions.

### Integrated candidate status

All four component modules are activated in the frozen load order. The reviewed
candidate has 134 passing Node tests plus Ruby/build/link checks. Independent
review corrections and desktop browser acceptance are recorded in
`song-notebook-verification.md`, including actual draft, settings, cross-tab,
import/export and Scalar Triads flows. Inspection no longer creates a draft;
Edit chord starts explicit editing with a retained occurrence origin.

The user requested implementation and a PR from `more-chords` to `main`.
Checklist items combining completed browser scenarios with phone/print remain
open: the browser viewport override did not apply, and native print inspection
was inaccessible. These are outstanding visual verification limits, not passes.
