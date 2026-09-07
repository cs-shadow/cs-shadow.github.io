# Song notebook contracts, revision 1

This is the frozen implementation appendix to the product plan. Integration owns
this file and `test/song-notebook/fixtures.cjs`. Workers request changes centrally.
The starting commit is `991a47ea4d3e412b61890e013d547afd162973de`; integration lives
at `/private/tmp/guitar-song-notebook`, branch `feature/guitar-song-notebook`.
Wave 1 worker paths append `-music` and `-model`, with matching branch suffixes.
Their exact tested baseline SHA is recorded in the handoff (a commit cannot
contain its own SHA).

## Common values and results

Records are exactly the persistent-record table in the plan. `Song.context` is
always present, either null or a Context. Arrays use **string 1 first** (high E
in standard tuning): standard MIDI is `[64,59,55,50,45,40]`. MIDI values are
integers 0–127; sounding MIDI may exceed 127 after fret/capo addition. Frets are
null (muted) or integer 0–24, with `fret + capo <= 24`. A committed chord needs
at least one sounding string OR a structured interpretation. All-muted six-string shapes
are normalized to null when keeping a name-only chord. Drafts may have all-muted
frets or both frets and interpretation null; incomplete experiments are valid
drafts, while all documented field types still require validation. Context pitch
classes are integers 0–11. All entity IDs in a song are
distinct nonempty strings. Text may be empty, including song title. Display an
empty title as “Untitled song”. Unknown record fields may be ignored on input;
persist/export only the documented fields. Reject invalid documented fields.

An Error is `{code, message, path: string|null, details: object|null}`. Expected
invalid input/storage failures return errors, never throw. Music parsing returns
`{interpretation, error}`; model edits return `{song, error}` (original song on
failure); validation returns `{valid, error}`. Other fallible APIs return
`{data, error}` with null data on failure. Error codes are stable descriptive
uppercase strings; consumers use message for display. All successful errors are
null. Functions never mutate their arguments. Derived arrays are deterministic.

Interpretations normalize Unicode accidentals to ASCII, capitalize the root
letter, and retain the actual root/bass spelling. Root/bass spelling must agree
with pitch class, including Cb/B# and double accidentals if accepted by parser.
Formula IDs are the 37 existing suffix strings, including `""`; aliases may
parse to canonical suffixes. Name-only reuse compares **all five** interpretation
fields; C# and Db remain distinct. Bass fields are both null or both present.

## Music (`SongNotebookMusic`)

Export immutable `chords`, `scales`, `roots`, `presets`, `defaultTuning` arrays.
Chord formula: `{id, suffix, quality, intervals, group}`; id equals suffix;
group is `triads`, `sevenths`, `added`, or `extended`. Scale:
`{id,name,group,intervals,feel,degreeLetters?}`. Preset: `{id,label,tuningMidi}`.
Roots are existing Scalar Triads spelling strings, in existing order. Preserve
all current catalog formulas and scales, their distinctions and descriptive feel.

| Function | Exact return |
| --- | --- |
| `parseChordSymbol(text)` | `{interpretation,error}`; one trimmed symbol only |
| `normalizePitch(number)` | integer pitch class |
| `pitchName(pc, preferFlats=false)` | ASCII spelling |
| `formatInterpretation(interpretation)` | sounding symbol string, empty for null |
| `interpretationPitches(interpretation)` | sorted distinct PCs, including slash bass |
| `transposeInterpretation(interpretation, semitones)` | new interpretation; preserve sharp/flat preference; null remains null |
| `notesForShape(tuningMidi, capo, frets)` | array `{stringIndex,fret,physicalFret,midi,pc}` in string order, omitting mutes |
| `identifyChord(notes)` | array `{interpretation,label,match:'exact'|'close',missing:number[],extra:number[]}`; missing/extra are sorted distinct absolute pitch classes, not root-relative intervals; inputs are notesForShape records; bass uses minimum MIDI, never array order |
| `romanLabel(interpretation, context)` | string, empty if either null; controller hides it for review-required chords |
| `chordsForScale(tonicPc, scaleId, tonicSpelling?)` | array `{interpretation,label,group,pitches:number[]}`; every complete formula fits; preserve formula aliases |
| `matchScales(chords, settings, context)` | `{candidates,excludedChordIds}`; settings `{tuningMidi,capo}` |
| `findVoicings(interpretation, settings, options)` | Promise of `{shapes,cancelled}`; options `{mode:'compact'|'fuller',signal?:AbortSignal}` |

Scale candidate: `{tonicPc,tonicSpelling,scaleId,fitCount,totalCount,outlierCount,
outsideCount,memberships}`. Membership: `{chordId,pitches,outside}` with sorted PC
arrays. Exclude unresolved name-only chords; shape pitches contribute even when
unnamed or review-required. Rank outlierCount, outsideCount, current tonic, scale
catalog order, chromatic tonic order (0–11). Empty analyzable collection returns
no candidates. Preferred root spelling comes from context when applicable,
otherwise catalog root order. Voicing shape: `{frets,span,position,mutedCount}`.
Return at most eight, rank span/position/mutedCount/fret-array (null sorts -1).
Position is minimum positive fret, or zero for all-open. Complete coverage,
four-fret span excluding open strings, physical limit, and no outside pitches.
When bassPc is present, the minimum sounding MIDI note must have that pitch
class; without an explicit slash bass, any chord pitch may be the lowest note.
Compact uses exactly three adjacent strings; fuller uses at least four sounding
strings. Abort resolves `{shapes:[],cancelled:true}`. Async chunks
yield to the browser event loop; no work continues after a stale request aborts.

## Model (`SongNotebookModel`)

Module exports `create({music, id?, now?})`, returning the following methods.
`id()` returns a fresh opaque string; `now()` returns ISO string. Defaults use
UUID (collision-resistant tested fallback) and the clock. `music` is required;
no module-global Music dependency. Integration injects the real module; fixtures
provide a narrow compatible implementation for independent model tests.

- `createSong(overrides={}) -> Song`: new IDs/time; defaults in plan. Overrides
  limited to title, notes, tuningMidi, capo, context; callers validate imported
  records separately. No sample chord.
- `validateSong(song) -> {valid,error}`: structural and reference validation.
- `applyAction(song, action) -> {song,error}`: validate whole next song before
  returning; update updatedAt only on success. Compound actions are atomic.
- `duplicateSong(song) -> Song`: all IDs fresh and references remapped, including
  home source. Preserve title/content; controller may rename the result.
- `getUsage(song, {chordId?,sectionId?}) -> {occurrences,arrangement}`:
  occurrences `{sectionId,occurrenceId}`, arrangement `{arrangementId,sectionId}`.
- `fingerprint(chord) -> string`: deterministic canonical committed chord JSON;
  used to detect stale draft source, not a security hash.

Actions use `{type, ...payload}`. IDs of created entities are model-generated.
Optional payloads below may be omitted; null means deliberately unset.

| Type | Payload and semantics |
| --- | --- |
| `song.update` | `patch:{title?,notes?}` |
| `chord.create` | `chord:{frets,interpretation,nickname,notes,reviewRequired?,previousInterpretation?}`, optional `sectionId` appends one occurrence |
| `chord.update` | `chordId,patch` (same fields), optional `expectedFingerprint`; atomically updates home tonic if this is its source and interpretation is accepted |
| `chord.variation` | `chordId` nullable, `chord`, `originSectionId` nullable, `originOccurrenceId` nullable; new chord, retarget only original occurrence if still referencing chordId; otherwise collection only |
| `chord.delete` | `chordId,referenceMode:'remove'|'replace',replacementChordId?`; explicit mode required when used; clearing home source retains tonic |
| `progression.insert` | `sectionId,text,afterOccurrenceId:null|string`; validate ALL whitespace/comma tokens first; insert after supplied occurrence or append; reuse name-only interpretation identity only |
| `section.create` | optional `name`; next Section N selected by controller |
| `section.update` | `sectionId,patch:{name?,notes?}` |
| `section.duplicate` | `sectionId`; fresh section/occurrence IDs, shared chord IDs, append after source |
| `section.delete` | `sectionId,referenceMode:'remove'|'replace',replacementSectionId?`; final deletion creates empty Section 1 |
| `occurrence.create` | `sectionId,chordId,afterOccurrenceId?`; null/omitted appends |
| `occurrence.update` | `sectionId,occurrenceId,patch:{chordId?,duration?,annotation?}` |
| `occurrence.move` | `sectionId,occurrenceId,direction:-1|1`; edge move is harmless |
| `occurrence.duplicate` | `sectionId,occurrenceId`; fresh ID immediately after source |
| `occurrence.delete` | `sectionId,occurrenceId` |
| `arrangement.create` | `sectionId`; append repeatCount 1 |
| `arrangement.update` | `arrangementId,patch:{sectionId?,repeatCount?}` |
| `arrangement.move` | `arrangementId,direction:-1|1` |
| `arrangement.delete` | `arrangementId` |
| `context.set` | `context:null|Context`; source must reference accepted interpreted chord and tonic must match |
| `settings.apply` | `tuningMidi,capo`; validate limits before mutation; tuning change marks shapes for review with previous interpretation retained, capo-only transposes accepted shape names; name-only unchanged |

On retuning, keep `interpretation` as previous accepted label, copy it to
`previousInterpretation`, and set `reviewRequired:true`. A simultaneous tuning
and capo change follows retuning rules, with no silent relabel. A reviewed
`chord.update` explicitly clears reviewRequired/previousInterpretation.
Duration is null or `{value:positive finite number,unit:'beats'|'bars'}`.
Home source losing its accepted interpretation clears source but retains tonic.

## Storage (`SongNotebookStorage`)

Export `create({storage,model,music})` returning methods below; storage has
`getItem(key),setItem(key,value),removeItem(key)` (may throw), or null. This layer
performs no automatic writes during reads. All methods synchronous.

| Method | Return data / behavior |
| --- | --- |
| `loadLibrary()` | `{data:Library|null,error,raw:string|null}`; absent returns null data, no error; corrupt preserves raw |
| `saveLibrary(library)` | `{data:true|null,error}` after full validation |
| `loadDrafts()` | `{data:{version:1,drafts:Draft[]}|null,error,raw}` |
| `saveDrafts(envelope)` | `{data:true|null,error}`; validate candidates structurally, permit stale context/source |
| `exportSong(song)` | `{data:string|null,error}`; formatted complete versioned JSON |
| `importSong(text)` | `{data:Song|null,error}`; validate entire envelope then duplicate/remap; no storage writes |
| `readLegacySettings()` | `{data:LegacyRecovery[],error,raw}`; no writes, malformed produces useful error |

Keys and formats are exactly the plan. `LegacyRecovery` is `{label,tuningMidi,
frets,octaveAssumption}`; octaveAssumption is human-readable disclosure. Legacy
shape recovery into a song is controller-owned. Read existing recent-settings
serialization in the baseline before implementing legacy validation.
Legacy all-muted entries contain no committed chord: omit them from recoverable
results without treating them as corrupt, while preserving the raw legacy key.

Draft is `{songId,chordId:null|string,candidate:ChordData,sourceFingerprint:
null|string,tuningMidi,capo,originSectionId:null|string,originOccurrenceId:
null|string}`. ChordData is the chord record without id. Draft array is unique
by `(songId,chordId)`; null chordId is the one new-chord draft. sourceFingerprint
is null iff chordId is null. Origin IDs are both null or both present; deletion
of committed origin is valid for recovery.
Draft's original source settings survive settings changes; detect staleness by
comparison, no extra derived flag. Opening same draft never retargets it.
Controller rejects direct apply when settings/source differs. Explicit review
can replace source settings; source conflict can only reopen or save variation.

## Controller and component boundaries

`mount(hosts, {dispatch,music}) -> {render(viewState),destroy()}`. `dispatch(action)`
returns `{error:null|Error}` synchronously; successful dispatch triggers render.
Views are snapshots, never mutable stores. Components use textContent for user
text. They own only hosts passed to them; all storage and state live in controller.

Hosts: compose `{collection,sections,arrangement}` map to
`notebook-collection`, `notebook-sections`, `notebook-arrangement`; editor
`{root}` -> `notebook-editor`; explore `{root}` -> `notebook-explore`; reading
`{root}` -> `notebook-reading`. Component CSS root classes are
`notebook-compose`, `notebook-editor`, `notebook-explore`, `notebook-reading`.
Integration hosts: `notebook-header`, `notebook-status`, `notebook-settings`,
`notebook-workspace`, `notebook-details`; outer `song-notebook`.

Snapshot fields: `{song,activeSectionId,selectedOccurrenceId,inspectedChordId,
panel:null|'editor'|'explore',drafts:Draft[],exploreState,saveStatus,mode:'edit'|
'read',error:null|Error}`. `saveStatus` is `saving`, `saved`, or `failed`.
Explore defaults `{tab:'browse',tonicPc:0,tonicSpelling:'C',scaleId:'major',
selectedInterpretation:null,selectedFrets:null,voicingMode:'compact'}`; tab enum is
`browse` or `match`. selectedFrets is null or a complete six-string voicing preview.
Controller clears selectedFrets when interpretation, mode or guitar settings
change. Components may retain ephemeral DOM/focus, async request handles and
derived voicing result/loading/error caches keyed by interpretation/settings/mode;
cache loss is harmless. Selected exploration previews stay in view state, never
only the DOM. Components never retain committed edits or drafts.

Controller action families (never passed to model):

- `selection.set {sectionId,occurrenceId:null|string}`; `chord.inspect {chordId,
  sectionId?,occurrenceId?}` opens editor without insertion.
- `panel.set {panel}`; `mode.set {mode}`; `history.undo {}` / `history.redo {}`.
- `draft.open {chordId:null|string,originSectionId?,originOccurrenceId?}` creates
  only if absent; `draft.patch {chordId,patch:ChordData subset}`;
  `draft.discard {chordId}`; `draft.retarget {chordId,sectionId,occurrenceId}`;
  `draft.rebase {chordId}` explicitly keeps candidate frets under new settings;
  `draft.reopen {chordId}` discards preview and opens current committed version;
  `draft.apply {chordId,mode:'keep'|'update'|'variation',addToSectionId?}`.
- `explore.set {patch}` updates only ExploreState; `explore.keep {interpretation,
  frets:null|array,sectionId?}` creates chord, optional append, one transaction.
- `library.create {}`; `library.switch {songId}`; `library.duplicate {songId}`;
  `library.delete {songId,confirmed:true}`; `library.recover {index}`;
  `library.reset {confirmed:true}`; `library.conflict {resolution:'reload'|'keep'}`.
- `file.import {text}`; `file.export {}`; `file.backup {}`; `file.print {}`.

All model actions are available directly to components. Bulk actions, draft apply,
reference replacement, and settings are single undo transactions; cap 100 per
song. Text field editors dispatch on blur/commit to coalesce typing; discrete
actions save promptly and text commits use 500 ms debounce. Draft patches save
separately. Controller reconciles selection after entity deletion and preserves
it on Explore/read transitions. Errors are displayed inline by component or
header. Reference delete controls must show usage and explicit choices first.

Final load order: guitar-tuning, recent-settings, contracts, music, model, storage,
compose, editor, explore, reading, guitar-chordinator. Wave 0 loads only existing
scripts and contracts; the hidden host skeleton is dormant. No absent script or
stylesheet is linked. Integration activates modules at their gates and replaces
the old boot implementation at the core UX gate. This staging preserves the
working reference UI while worker modules are independently implemented.
