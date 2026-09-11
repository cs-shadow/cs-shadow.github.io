(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; }
  else { root.SongNotebookController = api; }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function clone(value) { return JSON.parse(JSON.stringify(value)); }
  function failure(code, message) { return { code: code, message: message, path: null, details: null }; }
  function blankChord() { return { frets: [null,null,null,null,null,null], interpretation: null, nickname: "", notes: "", reviewRequired: false, previousInterpretation: null }; }
  function createStore(options) {
    var model = options.model, storage = options.storage, music = options.music;
    var later = options.schedule || function (fn, ms) { return setTimeout(fn, ms); };
    var cancel = options.cancel || function (timer) { clearTimeout(timer); };
    var effect = options.onEffect || function () {};
    var loaded = storage.loadLibrary(), loadedDrafts = storage.loadDrafts();
    var lastVoicingMode = storage.loadFingeringStyle ? storage.loadFingeringStyle() : null;
    if (lastVoicingMode !== "compact" && lastVoicingMode !== "fuller") { lastVoicingMode = "compact"; }
    var firstSong = loaded.data ? null : model.createSong();
    var library = loaded.data || { version: 1, activeSongId: firstSong.id, songs: [firstSong] };
    var drafts = loadedDrafts.data ? loadedDrafts.data.drafts : [];
    var suspended = loaded.error ? (loaded.raw === null ? "unavailable" : "corrupt") : null;
    var draftsSuspended = !!loadedDrafts.error;
    var rawLibrary = loaded.raw, rawDrafts = loadedDrafts.raw;
    var saveStatus = loaded.error || loadedDrafts.error ? "failed" : loaded.data ? "saved" : "saving";
    var error = loaded.error || loadedDrafts.error || null, notice = "";
    var histories = {}, views = {}, listeners = [], timer = null;
    var dirtyLibrary = !loaded.data, dirtyDrafts = false;
    function song() { return library.songs.find(function (item) { return item.id === library.activeSongId; }); }
    function view() {
      var current = song();
      if (!views[current.id]) {
        views[current.id] = { activeSectionId: current.sections[0].id, selectedOccurrenceId: null, inspectedChordId: null, inspectionOrigin: null, panel: null, mode: "edit", exploreState: { tab: "browse", tonicPc: 0, tonicSpelling: "C", scaleId: "major", selectedInterpretation: null, selectedFrets: null, voicingMode: lastVoicingMode } };
      }
      if (views[current.id].exploreState.voicingMode !== lastVoicingMode) {
        views[current.id].exploreState.voicingMode = lastVoicingMode; views[current.id].exploreState.selectedFrets = null;
      }
      return views[current.id];
    }
    function history() { return histories[song().id] || (histories[song().id] = { past: [], future: [] }); }
    function blockedError() { return suspended === "conflict" ? failure("STORAGE_CONFLICT", "Another tab changed the saved notebook. Reload its copy, or keep and save this copy. Export is available before deciding.") : loaded.error || loadedDrafts.error || null; }
    function snapshot() { return clone(Object.assign({ song: song(), drafts: drafts.filter(function (d) { return d.songId === song().id; }), saveStatus: saveStatus, error: error || ((suspended || draftsSuspended) ? blockedError() : null) }, view())); }
    function state() { return clone({ library: library, suspended: suspended, draftsSuspended: draftsSuspended, draftsCorrupt: draftsSuspended && rawDrafts !== null, notice: notice, canUndo: history().past.length > 0, canRedo: history().future.length > 0 }); }
    function emit() { listeners.slice().forEach(function (fn) { fn(snapshot(), state()); }); }
    function flush() {
      if (timer !== null) { cancel(timer); timer = null; }
      var failed = false;
      if (dirtyLibrary) {
        if (suspended) { failed = true; }
        else { var saved = storage.saveLibrary(library); if (saved.error) { error = saved.error; failed = true; } else { dirtyLibrary = false; } }
      }
      if (dirtyDrafts) {
        if (dirtyLibrary || draftsSuspended || suspended === "conflict") { failed = true; }
        else { var savedDrafts = storage.saveDrafts({ version: 1, drafts: drafts }); if (savedDrafts.error) { error = savedDrafts.error; failed = true; } else { dirtyDrafts = false; } }
      }
      saveStatus = failed || suspended || draftsSuspended ? "failed" : "saved";
      emit();
      return { error: failed ? error || failure("SAVE_SUSPENDED", "Saving is paused until the stored copy is resolved.") : null };
    }
    function save(isText) {
      saveStatus = suspended || draftsSuspended ? "failed" : "saving";
      if (timer !== null) { cancel(timer); timer = null; }
      if (isText) { timer = later(flush, 500); emit(); } else { flush(); }
    }
    function reconcile() {
      var current = song(), selected = view();
      var section = current.sections.find(function (item) { return item.id === selected.activeSectionId; });
      if (!section) { section = current.sections[0]; selected.activeSectionId = section.id; selected.selectedOccurrenceId = null; }
      if (!section.occurrences.some(function (item) { return item.id === selected.selectedOccurrenceId; })) { selected.selectedOccurrenceId = null; }
      if (!current.chords.some(function (item) { return item.id === selected.inspectedChordId; })) { selected.inspectedChordId = null; selected.inspectionOrigin = null; }
    }
    function setSong(next) { if (song().capo !== next.capo || JSON.stringify(song().tuningMidi) !== JSON.stringify(next.tuningMidi)) { view().exploreState.selectedFrets = null; } library.songs = library.songs.map(function (item) { return item.id === next.id ? next : item; }); dirtyLibrary = true; reconcile(); }
    function transact(action) {
      var before = song(), result = model.applyAction(before, action);
      if (result.error) { return result.error; }
      var h = history(); h.past.push(clone(before)); if (h.past.length > 100) { h.past.shift(); } h.future = [];
      setSong(result.song);
      if (action.type === "section.create" || action.type === "section.duplicate") {
        var added = result.song.sections.find(function (section) { return !before.sections.some(function (old) { return old.id === section.id; }); });
        if (added) { view().activeSectionId = added.id; view().selectedOccurrenceId = null; }
      }
      if (action.type === "settings.apply") { view().exploreState.selectedFrets = null; }
      return null;
    }
    function findDraft(chordId) { return drafts.find(function (item) { return item.songId === song().id && item.chordId === chordId; }); }
    function discardDraft(chordId) { drafts = drafts.filter(function (item) { return !(item.songId === song().id && item.chordId === chordId); }); dirtyDrafts = true; }
    function openDraft(action, initialCandidate) {
      var existing = findDraft(action.chordId);
      if (!existing) {
        var source = song().chords.find(function (item) { return item.id === action.chordId; });
        if (action.chordId !== null && !source) { return failure("NOT_FOUND", "That chord is no longer in this song."); }
        var candidate = source ? clone(source) : initialCandidate || blankChord(); delete candidate.id;
        drafts.push({ songId: song().id, chordId: action.chordId, candidate: candidate, sourceFingerprint: source ? model.fingerprint(source) : null, tuningMidi: song().tuningMidi.slice(), capo: song().capo, originSectionId: action.originSectionId || null, originOccurrenceId: action.originOccurrenceId || null }); dirtyDrafts = true;
      }
      var opened = findDraft(action.chordId);
      view().inspectedChordId = action.chordId; view().panel = "editor";
      view().inspectionOrigin = opened.originOccurrenceId ? { sectionId: opened.originSectionId, occurrenceId: opened.originOccurrenceId } : null;
      return null;
    }
    function captureExploreChord(action) {
      if (findDraft(null)) { return failure("EXISTING_NEW_CHORD_DRAFT", "You already have an unfinished new chord. Resume that draft and keep or cancel it before capturing this chord."); }
      var candidate = blankChord();
      try {
        // fingerprint validates and canonicalises a chord without changing the
        // song. Only take its accepted name; manual capture starts with no notes.
        candidate.interpretation = JSON.parse(model.fingerprint(Object.assign({ id: "explore-draft" }, candidate, { interpretation: action.interpretation }))).interpretation;
      } catch (err) { return failure("INVALID_INTERPRETATION", "Choose a valid chord before capturing its shape."); }
      return openDraft({ chordId: null }, candidate);
    }
    function changedSettings(draft) { return draft.capo !== song().capo || JSON.stringify(draft.tuningMidi) !== JSON.stringify(song().tuningMidi); }
    function applyDraft(action) {
      var draft = findDraft(action.chordId);
      if (!draft) { return failure("NO_DRAFT", "Open a chord draft first."); }
      if (changedSettings(draft)) { return failure("STALE_SETTINGS", "Review this draft under the current tuning and capo before applying it."); }
      var source = song().chords.find(function (item) { return item.id === action.chordId; });
      if (action.mode !== "variation" && action.chordId !== null && (!source || model.fingerprint(source) !== draft.sourceFingerprint)) { return failure("STALE_CHORD", "This shared chord changed. Reopen it or save your draft as a variation."); }
      var payload;
      if (action.mode === "variation") { payload = { type: "chord.variation", chordId: draft.chordId, chord: draft.candidate, originSectionId: draft.originSectionId, originOccurrenceId: draft.originOccurrenceId }; }
      else if (action.mode === "update") { payload = { type: "chord.update", chordId: draft.chordId, patch: draft.candidate, expectedFingerprint: draft.sourceFingerprint }; }
      else { payload = { type: "chord.create", chord: draft.candidate, sectionId: action.addToSectionId }; }
      var before = song(), problem = transact(payload);
      if (problem) { return problem; }
      if (action.mode === "variation" && draft.originOccurrenceId) {
        var originalSection = before.sections.find(function (item) { return item.id === draft.originSectionId; });
        if (!originalSection || !originalSection.occurrences.some(function (item) { return item.id === draft.originOccurrenceId && item.chordId === draft.chordId; })) { notice = "Variation kept in the collection. The original occurrence is no longer available, so nothing was replaced."; }
      }
      var added = song().chords.find(function (item) { return !before.chords.some(function (old) { return item.id === old.id; }); });
      discardDraft(action.chordId); view().inspectedChordId = added ? added.id : action.chordId;
      view().inspectionOrigin = null;
      return null;
    }
    function addSong(next) { library.songs.push(next); library.activeSongId = next.id; dirtyLibrary = true; reconcile(); }
    function exportSong() {
      var result = storage.exportSong(song());
      if (result.error) { return result.error; }
      if (drafts.some(function (draft) { return draft.songId === song().id; })) { notice = "Unapplied draft not included."; }
      effect({ type: "download", text: result.data, filename: (song().title || "Untitled song") + ".json" }); return null;
    }
    function dispatch(action) {
      error = null; notice = "";
      var problem = null, saveText = false, shouldSave = false;
      try {
        var current = view(), draft, source, section;
        switch (action.type) {
        case "selection.set":
          section = song().sections.find(function (item) { return item.id === action.sectionId; });
          if (!section || (action.occurrenceId && !section.occurrences.some(function (item) { return item.id === action.occurrenceId; }))) { problem = failure("NOT_FOUND", "That section or occurrence is no longer available."); break; }
          current.activeSectionId = action.sectionId; current.selectedOccurrenceId = action.occurrenceId || null; break;
        case "chord.inspect":
          source = song().chords.find(function (item) { return item.id === action.chordId; });
          if (!source) { problem = failure("NOT_FOUND", "That chord is no longer in this song."); break; }
          if (action.sectionId || action.occurrenceId) {
            section = song().sections.find(function (item) { return item.id === action.sectionId; });
            if (!section || !section.occurrences.some(function (item) { return item.id === action.occurrenceId && item.chordId === action.chordId; })) { problem = failure("INVALID_TARGET", "That occurrence is no longer available."); break; }
          }
          current.inspectedChordId = action.chordId; current.panel = "editor";
          current.inspectionOrigin = action.occurrenceId ? { sectionId: action.sectionId, occurrenceId: action.occurrenceId } : null;
          break;
        case "panel.set": current.panel = action.panel; break;
        case "explore.close": current.panel = null; break;
        case "mode.set": current.mode = action.mode; break;
        case "history.undo": case "history.redo": {
          var h = history(), undo = action.type === "history.undo", from = undo ? h.past : h.future, to = undo ? h.future : h.past;
          if (from.length) { to.push(clone(song())); setSong(from.pop()); shouldSave = true; } break;
        }
        case "draft.open": problem = openDraft(action); shouldSave = true; break;
        case "draft.patch":
          draft = findDraft(action.chordId); if (!draft) { problem = failure("NO_DRAFT", "Open a chord draft first."); break; }
          Object.assign(draft.candidate, clone(action.patch)); dirtyDrafts = true; shouldSave = true; saveText = true; break;
        case "draft.discard": discardDraft(action.chordId); shouldSave = true; break;
        case "draft.retarget":
          draft = findDraft(action.chordId); section = song().sections.find(function (item) { return item.id === action.sectionId; });
          if (!draft || !section || !section.occurrences.some(function (item) { return item.id === action.occurrenceId && item.chordId === action.chordId; })) { problem = failure("INVALID_TARGET", "Select an occurrence of this chord to use for the variation."); break; }
          draft.originSectionId = action.sectionId; draft.originOccurrenceId = action.occurrenceId; dirtyDrafts = true; shouldSave = true; break;
        case "draft.rebase":
          draft = findDraft(action.chordId); if (!draft) { problem = failure("NO_DRAFT", "Open a chord draft first."); break; }
          draft.tuningMidi = song().tuningMidi.slice(); draft.capo = song().capo;
          if (draft.candidate.frets && draft.candidate.interpretation) { draft.candidate.previousInterpretation = clone(draft.candidate.interpretation); draft.candidate.reviewRequired = true; }
          dirtyDrafts = true; shouldSave = true; break;
        case "draft.reopen":
          draft = findDraft(action.chordId); var origin = draft ? { originSectionId: draft.originSectionId, originOccurrenceId: draft.originOccurrenceId } : {};
          discardDraft(action.chordId); problem = openDraft(Object.assign({ chordId: action.chordId }, origin)); shouldSave = true; break;
        case "draft.apply": problem = applyDraft(action); shouldSave = true; break;
        case "explore.set":
          if (action.patch.voicingMode !== undefined) {
            if (action.patch.voicingMode !== "compact" && action.patch.voicingMode !== "fuller") { problem = failure("INVALID_FINGERING_STYLE", "Choose compact or fuller fingerings."); break; }
            lastVoicingMode = action.patch.voicingMode;
            if (storage.saveFingeringStyle) { storage.saveFingeringStyle(lastVoicingMode); }
          }
          if (action.patch.selectedInterpretation !== undefined || action.patch.voicingMode !== undefined) { current.exploreState.selectedFrets = null; }
          Object.assign(current.exploreState, clone(action.patch)); break;
        case "explore.capture": problem = captureExploreChord(action); shouldSave = true; break;
        case "explore.keep": problem = transact({ type: "chord.create", chord: { frets: action.frets, interpretation: action.interpretation, nickname: "", notes: "", reviewRequired: false, previousInterpretation: null }, sectionId: action.sectionId }); shouldSave = true; break;
        case "library.create": addSong(model.createSong()); shouldSave = true; break;
        case "library.switch":
          if (!library.songs.some(function (item) { return item.id === action.songId; })) { problem = failure("NOT_FOUND", "That song is no longer available."); break; }
          library.activeSongId = action.songId; dirtyLibrary = true; reconcile(); shouldSave = true; break;
        case "library.duplicate":
          source = library.songs.find(function (item) { return item.id === action.songId; });
          if (!source) { problem = failure("NOT_FOUND", "That song is no longer available."); break; }
          var copy = model.duplicateSong(source); copy.title = (source.title || "Untitled song") + " copy"; addSong(copy); shouldSave = true; break;
        case "library.delete":
          if (action.confirmed !== true) { problem = failure("CONFIRM_REQUIRED", "Confirm song deletion first."); break; }
          library.songs = library.songs.filter(function (item) { return item.id !== action.songId; }); drafts = drafts.filter(function (item) { return item.songId !== action.songId; }); delete histories[action.songId]; delete views[action.songId];
          if (!library.songs.length) { library.songs.push(model.createSong()); }
          if (library.activeSongId === action.songId) { library.activeSongId = library.songs[0].id; }
          dirtyLibrary = true; dirtyDrafts = true; reconcile(); shouldSave = true; break;
        case "library.recover": {
          var legacy = storage.readLegacySettings(); if (legacy.error) { problem = legacy.error; break; }
          var recovery = legacy.data[action.index]; if (!recovery) { problem = failure("NOT_FOUND", "That old shape is unavailable."); break; }
          var recovered = model.createSong({ title: "Recovered shape", tuningMidi: recovery.tuningMidi });
          var kept = model.applyAction(recovered, { type: "chord.create", chord: { frets: recovery.frets, interpretation: null, nickname: "", notes: "", reviewRequired: false, previousInterpretation: null } });
          if (kept.error) { problem = kept.error; break; } addSong(kept.song); notice = recovery.octaveAssumption; shouldSave = true; break;
        }
        case "library.reset":
          if (action.confirmed !== true) { problem = failure("CONFIRM_REQUIRED", "Confirm resetting the saved library first."); break; }
          suspended = null; draftsSuspended = false; dirtyLibrary = true; dirtyDrafts = true; shouldSave = true; break;
        case "library.conflict":
          if (action.resolution === "reload") {
            var latest = storage.loadLibrary(), latestDrafts = storage.loadDrafts();
            if (latest.error || latestDrafts.error || !latest.data) { problem = latest.error || latestDrafts.error || failure("MISSING_LIBRARY", "The other saved copy is unavailable. Keep or export this copy."); break; }
            library = latest.data; drafts = latestDrafts.data ? latestDrafts.data.drafts : []; dirtyLibrary = false; dirtyDrafts = false; histories = {}; views = {}; suspended = null; draftsSuspended = false; saveStatus = "saved";
          } else if (action.resolution === "keep") { suspended = null; dirtyLibrary = true; dirtyDrafts = true; shouldSave = true; }
          break;
        case "file.import": {
          var imported = storage.importSong(action.text); if (imported.error) { problem = imported.error; break; } addSong(imported.data); shouldSave = true; break;
        }
        case "file.export": problem = exportSong(); break;
        case "file.backup": effect({ type: "download", text: JSON.stringify({ library: rawLibrary, drafts: rawDrafts }, null, 2), filename: "song-notebook-raw-backup.json" }); break;
        case "file.print": effect({ type: "print", song: clone(song()) }); break;
        default:
          problem = transact(action); shouldSave = true;
          saveText = ["song.update", "section.update", "occurrence.update"].indexOf(action.type) !== -1;
        }
      } catch (err) { problem = failure("ACTION_FAILED", err.message || "The change could not be applied."); }
      error = problem;
      if (!problem && shouldSave) { save(saveText); } else { emit(); }
      return { error: problem };
    }
    function storageChanged(key) {
      if (key !== "cs-shadow.guitar-chordinator.library.v1" && key !== "cs-shadow.guitar-chordinator.drafts.v1" && key !== null) { return; }
      if (timer !== null) { cancel(timer); timer = null; }
      suspended = "conflict"; saveStatus = "failed"; error = failure("STORAGE_CONFLICT", "Another tab changed the saved notebook. Reload its copy, or keep and save this copy. Export is available before deciding."); emit();
    }
    return { snapshot: snapshot, state: state, dispatch: dispatch, flush: flush, storageChanged: storageChanged, subscribe: function (fn) { listeners.push(fn); return function () { listeners = listeners.filter(function (item) { return item !== fn; }); }; }, destroy: function () { flush(); listeners = []; }, initialize: function () { if (dirtyLibrary && !suspended) { flush(); } else { emit(); } } };
  }
  function mountComponents(document, modules, api, contracts) {
    if (!contracts || ["Compose", "Editor"].some(function (name) { return !modules[name] || typeof modules[name].mount !== "function"; })) { return null; }
    var components = contracts.componentNames.filter(function (name) { return modules[name] && typeof modules[name].mount === "function"; }).map(function (name) {
      var ids = contracts.hosts[name.toLowerCase()], hosts = {};
      Object.keys(ids).forEach(function (key) { hosts[key] = document.getElementById(ids[key]); });
      return { name: name, component: modules[name].mount(hosts, api) };
    });
    return { render: function (viewState, readingOnly) { components.forEach(function (entry) { if (!readingOnly || entry.name === "Reading") { entry.component.render(viewState); } }); }, destroy: function () { components.forEach(function (entry) { entry.component.destroy(); }); } };
  }
  function mountHeader(hosts, store, options) {
    var document = hosts.header.ownerDocument, music = options.music, model = options.model, controls = options.controls;
    var libraryOpen = false, menuOpen = false, settingsOpen = false, contextOpen = false, songNotesOpen = false;
    var settingsDraft = null, settingsView = null, deleteSongId = null, renderedSongId = null, bodySignature = null;
    function el(tag, text, attributes) {
      var node = document.createElement(tag); if (text !== null && text !== undefined) { node.textContent = text; }
      Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); }); return node;
    }
    function button(text, run, attributes) { var node = el("button", text, Object.assign({ type: "button" }, attributes || {})); node.addEventListener("click", run); return node; }
    function dispatch(action) { return store.dispatch(action); }
    function option(select, value, text, selected) { var node = el("option", text, { value: String(value) }); node.selected = selected; select.appendChild(node); }
    function label(text, control) { var node = el("label", text); node.appendChild(control); return node; }
    function chordName(chord, index) { return (music.formatInterpretation(chord.interpretation) || "Chord " + (index + 1)) + (chord.nickname ? " · " + chord.nickname : ""); }
    function rerender() { render(store.snapshot(), store.state()); }
    function renderSettings(snapshot) {
      hosts.settings.hidden = !settingsOpen;
      if (!settingsOpen) { if (settingsView) { settingsView.destroy(); } hosts.settings.replaceChildren(); settingsView = null; return; }
      if (!settingsDraft) { settingsDraft = { tuningMidi: snapshot.song.tuningMidi.slice(), capo: snapshot.song.capo }; }
      // Keep the controls mounted while this draft is open, including across
      // unrelated header renders, so focus and the active string picker survive.
      if (settingsView && settingsView.draft === settingsDraft) { settingsView.refresh(); return; }
      if (settingsView) { settingsView.destroy(); }
      hosts.settings.replaceChildren();
      var form = el("form", null, { class: "notebook-settings-form" });
      form.appendChild(el("h2", "Song tuning and capo"));
      var capoButtons = [];
      function control(key, text, run, attributes) {
        return button(text, run, Object.assign({ "data-settings-key": key }, attributes || {}));
      }
      function pitch(midi) { return music.pitchName(music.normalizePitch(midi)) + (Math.floor(midi / 12) - 1); }
      function pressed(node, selected) { node.setAttribute("aria-pressed", String(selected)); }
      function chooseCapo(fret, focus) {
        settingsDraft.capo = fret; refresh();
        if (focus) { capoButtons[fret].focus(); }
      }
      function capoKey(event, fret) {
        var next = { ArrowLeft: Math.max(0, fret - 1), ArrowRight: Math.min(12, fret + 1), Home: 0, End: 12 }[event.key];
        if (next !== undefined) { event.preventDefault(); chooseCapo(next, true); }
      }
      function capoControl(fret, text, className) {
        var node = control("capo-" + fret, text, function () { chooseCapo(fret, false); }, {
          class: className, "aria-label": fret ? "Capo at fret " + fret : "No capo"
        });
        node.addEventListener("keydown", function (event) { capoKey(event, fret); });
        capoButtons[fret] = node; return node;
      }
      form.appendChild(el("p", "Choose a tuning, or tap a string note to customise it. Preset notes run low to high.", { class: "notebook-settings-hint" }));
      var presets = el("div"); form.appendChild(presets);
      var presetControls = controls.mountPresets(presets, {
        presets: music.presets.map(function (item) { return { id: item.id, label: item.label, values: item.tuningMidi }; }),
        values: settingsDraft.tuningMidi, keyAttribute: "data-settings-key",
        noteName: function (value) { return music.pitchName(music.normalizePitch(value)); },
        onChange: function (values) { settingsDraft.tuningMidi = values; refresh(); }
      });
      var tuningName = el("p", null, { class: "notebook-tuning-name" }); form.appendChild(tuningName);
      var toolbar = el("div", null, { class: "notebook-capo-toolbar" });
      toolbar.appendChild(capoControl(0, "No capo", "notebook-no-capo"));
      var capoLabel = el("strong", null, { class: "notebook-capo-label" }); toolbar.appendChild(capoLabel); form.appendChild(toolbar);
      form.appendChild(el("p", "Tuning before capo · string 1 is at the top. Tap a fret to place the capo across all six strings.", { class: "notebook-settings-hint" }));
      var diagram = el("div", null, { class: "notebook-tuning-diagram" });
      var badges = el("div", null, { class: "notebook-string-badges" }); badges.appendChild(el("span", "String"));
      diagram.appendChild(badges);
      var scroll = el("div", null, { class: "notebook-neck-scroll", role: "region", "aria-label": "Guitar neck; scroll horizontally for capo frets" });
      var neck = el("div", null, { class: "notebook-tuning-neck" });
      var wires = el("div", null, { class: "notebook-neck-strings", "aria-hidden": "true" });
      for (var string = 1; string <= 6; string += 1) { wires.appendChild(el("span", null, { class: "notebook-tuning-wire", "data-string": string })); }
      neck.appendChild(wires);
      var frets = el("div", null, { class: "notebook-capo-frets", role: "group", "aria-label": "Capo fret" });
      for (var fret = 1; fret <= 12; fret += 1) {
        var fretButton = capoControl(fret, null, "notebook-capo-fret");
        fretButton.appendChild(el("span", String(fret), { class: "notebook-fret-number" }));
        fretButton.appendChild(el("span", fret === 12 ? "••" : [3, 5, 7, 9].includes(fret) ? "•" : "", { class: "notebook-fret-marker", "aria-hidden": "true" }));
        frets.appendChild(fretButton);
      }
      neck.appendChild(frets); scroll.appendChild(neck); diagram.appendChild(scroll); form.appendChild(diagram);
      var pickerHost = el("div"); form.appendChild(pickerHost);
      var stringControls = controls.mountStringNotes(badges, pickerHost, {
        id: "notebook-string-picker", values: settingsDraft.tuningMidi, octaves: true,
        keyAttribute: "data-settings-key",
        noteName: function (value) { return music.pitchName(music.normalizePitch(value)); },
        onChange: function (values) { settingsDraft.tuningMidi = values; refresh(); }
      });
      form.addEventListener("keydown", function (event) { if (event.key === "Escape") { stringControls.close(); } });
      var sounding = el("p", null, { class: "notebook-sounding-tuning" }); form.appendChild(sounding);
      form.appendChild(el("p", "Chord frets are relative to the capo. Changes affect the whole song after Apply.", { class: "notebook-settings-hint" }));
      var result = el("div", null, { class: "notebook-settings-preview", "aria-live": "polite" }); form.appendChild(result);
      var actions = el("div", null, { class: "notebook-settings-actions" });
      var apply = el("button", "Apply settings", { type: "submit", class: "music-primary", "data-settings-key": "apply" }); actions.appendChild(apply);
      actions.appendChild(control("cancel", "Cancel", function () { settingsOpen = false; settingsDraft = null; rerender(); })); form.appendChild(actions);
      function refresh() {
        presetControls.update(settingsDraft.tuningMidi);
        stringControls.update(settingsDraft.tuningMidi);
        var matched = music.presets.find(function (item) {
          return item.tuningMidi.every(function (midi, i) { return midi === settingsDraft.tuningMidi[i]; });
        });
        tuningName.textContent = matched ? matched.label + " tuning" : "Custom tuning";
        capoLabel.textContent = settingsDraft.capo ? "Capo at fret " + settingsDraft.capo : "Open strings · no capo";
        capoButtons.forEach(function (node, index) { pressed(node, settingsDraft.capo === index); node.setAttribute("tabindex", settingsDraft.capo === index ? "0" : "-1"); });
        sounding.textContent = (settingsDraft.capo ? "With capo " + settingsDraft.capo : "Open strings") + " · low to high: " +
          settingsDraft.tuningMidi.slice().reverse().map(function (midi) { return pitch(midi + settingsDraft.capo); }).join(" · ");
        preview();
      }
      function preview() {
        var snapshot = store.snapshot();
        result.replaceChildren();
        var next = model.applyAction(snapshot.song, Object.assign({ type: "settings.apply" }, settingsDraft));
        apply.disabled = !!next.error;
        if (next.error) {
          result.appendChild(el("p", next.error.message, { class: "notebook-error" }));
          var blocked = next.error.details && next.error.details.chordIds;
          if (blocked) { blocked.forEach(function (id) { var chord = snapshot.song.chords.find(function (item) { return item.id === id; }); if (chord) { result.appendChild(el("p", chordName(chord, snapshot.song.chords.indexOf(chord)) + " would exceed physical fret 24.")); } }); }
          return;
        }
        var retuned = JSON.stringify(snapshot.song.tuningMidi) !== JSON.stringify(settingsDraft.tuningMidi), moved = snapshot.song.capo !== settingsDraft.capo;
        if (retuned || moved) {
          var affected = snapshot.song.chords.filter(function (chord) { return chord.frets !== null; });
          result.appendChild(el("p", retuned ? "Fingerings stay in place. Saved names will need review." : "Fingerings stay in place. Accepted sounding names transpose; name-only chords retain their names."));
          affected.forEach(function (chord) {
            var changed = next.error ? null : next.song.chords.find(function (item) { return item.id === chord.id; });
            result.appendChild(el("p", chordName(chord, snapshot.song.chords.indexOf(chord)) + (changed && !retuned ? " → " + chordName(changed, snapshot.song.chords.indexOf(chord)) : " · review required")));
          });
          if (snapshot.drafts.length) { result.appendChild(el("p", "Your unapplied drafts will keep their old settings and require review.")); }
        }
      }
      form.addEventListener("submit", function (event) { event.preventDefault(); var outcome = dispatch(Object.assign({ type: "settings.apply" }, settingsDraft)); if (!outcome.error) { settingsOpen = false; settingsDraft = null; rerender(); } });
      hosts.settings.appendChild(form); settingsView = { draft: settingsDraft, refresh: refresh, destroy: function () { presetControls.destroy(); stringControls.destroy(); } }; refresh();
    }
    function renderStatus(snapshot, state) {
      hosts.status.replaceChildren(); hosts.status.appendChild(el("span", snapshot.saveStatus === "saved" ? "Saved" : snapshot.saveStatus === "saving" ? "Saving…" : "Save failed"));
      if (snapshot.error) { hosts.status.appendChild(el("span", " · " + snapshot.error.message, { class: "notebook-error" })); }
      if (state.notice) { hosts.status.appendChild(el("span", " · " + state.notice)); }
      if (state.suspended === "conflict") {
        hosts.status.appendChild(button("Reload saved copy", function () { dispatch({ type: "library.conflict", resolution: "reload" }); }));
        hosts.status.appendChild(button("Keep and save this copy", function () { dispatch({ type: "library.conflict", resolution: "keep" }); }));
        hosts.status.appendChild(button("Export local song", function () { dispatch({ type: "file.export" }); }));
      } else if (state.suspended === "corrupt" || state.draftsCorrupt) {
        hosts.status.appendChild(button("Download raw backup", function () { dispatch({ type: "file.backup" }); }));
        var reset = el("details"); reset.appendChild(el("summary", "Reset saved data…")); reset.appendChild(el("p", "Replace the unreadable saved data with the songs and drafts currently open here? Download a raw backup first if you want to keep it."));
        reset.appendChild(button("Replace saved data", function () { dispatch({ type: "library.reset", confirmed: true }); })); hosts.status.appendChild(reset);
      }
    }
    function render(snapshot, state) {
      var current = snapshot.song;
      if (snapshot.mode === "read") {
        if (bodySignature !== "read") {
          hosts.header.replaceChildren();
          var readActions = el("div", null, { class: "notebook-header-actions", "aria-label": "Reading actions" });
          readActions.appendChild(button("Edit", function () { dispatch({ type: "mode.set", mode: "edit" }); }));
          readActions.appendChild(button("Print / Save as PDF", function () { dispatch({ type: "file.print" }); }));
          hosts.header.appendChild(readActions); bodySignature = "read";
        }
        hosts.settings.hidden = true; renderStatus(snapshot, state); return;
      }
      if (renderedSongId !== current.id) { settingsDraft = null; deleteSongId = null; songNotesOpen = false; renderedSongId = current.id; }
      var signature = JSON.stringify({ id: current.id, mode: snapshot.mode, tuningMidi: current.tuningMidi, capo: current.capo, context: current.context, notes: songNotesOpen ? null : current.notes, library: libraryOpen ? state.library.songs.map(function (song) { return song.id; }) : null, libraryOpen: libraryOpen, menuOpen: menuOpen, settingsOpen: settingsOpen, contextOpen: contextOpen, songNotesOpen: songNotesOpen, deleteSongId: deleteSongId, settingsChords: settingsOpen ? current.chords : null, settingsDraftCount: settingsOpen ? snapshot.drafts.length : null });
      if (signature === bodySignature) {
        var titleField = hosts.header.querySelector('[aria-label="Song title"]');
        if (titleField && document.activeElement !== titleField) { titleField.value = current.title; }
        var notesField = hosts.header.querySelector('[aria-label="Song notes"]');
        if (notesField && document.activeElement !== notesField) { notesField.value = current.notes; }
        var undoControl = hosts.header.querySelector('[data-notebook-action="undo"]'), redoControl = hosts.header.querySelector('[data-notebook-action="redo"]');
        if (undoControl) { undoControl.disabled = !state.canUndo; }
        if (redoControl) { redoControl.disabled = !state.canRedo; }
        // A title's blur must not replace the library button receiving the click.
        hosts.header.querySelectorAll("[data-library-song]").forEach(function (control) {
          var item = state.library.songs.find(function (song) { return song.id === control.getAttribute("data-library-song"); });
          if (item) { control.textContent = item.title || "Untitled song"; }
        });
        hosts.header.querySelectorAll("[data-library-delete]").forEach(function (control) {
          var item = state.library.songs.find(function (song) { return song.id === control.getAttribute("data-library-delete"); });
          if (item) { control.setAttribute("aria-label", "Delete " + (item.title || "Untitled song")); }
        });
        renderStatus(snapshot, state); return;
      }
      bodySignature = signature;
      hosts.header.replaceChildren();
      var row = el("div", null, { class: "notebook-header-row" });
      row.appendChild(button("Songs ▾", function () { libraryOpen = !libraryOpen; rerender(); }, { "aria-expanded": String(libraryOpen) }));
      var title = el("input", null, { type: "text", placeholder: "Untitled song", "aria-label": "Song title", class: "notebook-title" }); title.value = current.title;
      title.addEventListener("change", function () { dispatch({ type: "song.update", patch: { title: title.value } }); }); row.appendChild(title);
      var actions = el("div", null, { class: "notebook-header-actions", "aria-label": "Song actions" });
      var readButton = button(snapshot.mode === "read" ? "Edit" : "Read", function () { dispatch({ type: "mode.set", mode: snapshot.mode === "read" ? "edit" : "read" }); }); readButton.disabled = !options.readingAvailable; actions.appendChild(readButton);
      actions.appendChild(button("Song menu ⋯", function () { menuOpen = !menuOpen; rerender(); }, { "aria-expanded": String(menuOpen) }));
      var undo = button("Undo", function () { dispatch({ type: "history.undo" }); }, { "data-notebook-action": "undo" }); undo.disabled = !state.canUndo; actions.appendChild(undo);
      var redo = button("Redo", function () { dispatch({ type: "history.redo" }); }, { "data-notebook-action": "redo" }); redo.disabled = !state.canRedo; actions.appendChild(redo); row.appendChild(actions); hosts.header.appendChild(row);
      if (libraryOpen) {
        var library = el("div", null, { class: "notebook-menu", "aria-label": "Song library" });
        state.library.songs.forEach(function (item) {
          var itemRow = el("div"); itemRow.appendChild(button(item.title || "Untitled song", function () { libraryOpen = false; settingsDraft = null; dispatch({ type: "library.switch", songId: item.id }); }, { "data-library-song": item.id }));
          itemRow.appendChild(button("Duplicate", function () { dispatch({ type: "library.duplicate", songId: item.id }); }));
          itemRow.appendChild(button("Delete", function () { deleteSongId = item.id; rerender(); }, { "aria-label": "Delete " + (item.title || "Untitled song"), "data-library-delete": item.id }));
          if (deleteSongId === item.id) { itemRow.appendChild(el("span", "Delete this song and its drafts? ")); itemRow.appendChild(button("Delete song", function () { deleteSongId = null; dispatch({ type: "library.delete", songId: item.id, confirmed: true }); })); itemRow.appendChild(button("Cancel", function () { deleteSongId = null; rerender(); })); }
          library.appendChild(itemRow);
        });
        library.appendChild(button("New song", function () { libraryOpen = false; settingsDraft = null; dispatch({ type: "library.create" }); }));
        var legacy = options.storage.readLegacySettings();
        if (legacy.data && legacy.data.length) {
          var recover = el("details"); recover.appendChild(el("summary", "Recover old shape"));
          legacy.data.forEach(function (item, index) { recover.appendChild(el("p", item.octaveAssumption)); recover.appendChild(button(item.label, function () { libraryOpen = false; dispatch({ type: "library.recover", index: index }); })); }); library.appendChild(recover);
        }
        hosts.header.appendChild(library);
      }
      if (menuOpen) {
        var menu = el("div", null, { class: "notebook-menu" });
        menu.appendChild(button("Export song JSON", function () { dispatch({ type: "file.export" }); }));
        var input = el("input", null, { type: "file", accept: ".json,application/json", "aria-label": "Import song JSON" });
        input.addEventListener("change", function () { if (input.files[0]) { input.files[0].text().then(function (text) { dispatch({ type: "file.import", text: text }); }).catch(function () { hosts.status.textContent = "The selected file could not be read."; }); } }); menu.appendChild(label("Import song JSON ", input));
        var printButton = button("Print / Save as PDF", function () { dispatch({ type: "file.print" }); }); printButton.disabled = !options.readingAvailable; menu.appendChild(printButton); hosts.header.appendChild(menu);
      }
      var summary = el("div", null, { class: "notebook-song-summary" });
      var tuning = music.presets.find(function (item) { return JSON.stringify(item.tuningMidi) === JSON.stringify(current.tuningMidi); });
      summary.appendChild(button((tuning ? tuning.label : "Custom") + " tuning · " + (current.capo ? "Capo " + current.capo : "No capo"), function () { settingsOpen = !settingsOpen; settingsDraft = null; rerender(); }));
      summary.appendChild(button(current.context ? "Home " + current.context.tonicSpelling + (current.context.scaleId ? " · " + music.scales.find(function (item) { return item.id === current.context.scaleId; }).name : "") : "+ Home / scale", function () { contextOpen = !contextOpen; rerender(); })); hosts.header.appendChild(summary);
      if (contextOpen) {
        var context = el("form", null, { class: "notebook-context-form" }), tonic = el("select", null, { "aria-label": "Home tonic" }), scale = el("select", null, { "aria-label": "Song scale" });
        var tonicSpelling = current.context ? current.context.tonicSpelling : "C", tonicOptions = music.roots.slice();
        if (!tonicOptions.includes(tonicSpelling)) { tonicOptions.push(tonicSpelling); }
        tonicOptions.forEach(function (root) { option(tonic, root, root, root === tonicSpelling); });
        option(scale, "", "No scale", !current.context || !current.context.scaleId); music.scales.forEach(function (item) { option(scale, item.id, item.name, current.context && current.context.scaleId === item.id); });
        context.appendChild(label("Home ", tonic)); context.appendChild(label("Scale ", scale)); context.appendChild(el("button", "Apply home / scale", { type: "submit" }));
        context.appendChild(button("Remove context", function () { dispatch({ type: "context.set", context: null }); }));
        context.appendChild(el("p", "Roman labels use a fixed major-scale reference: with A as home, Am is i and C is ♭III."));
        context.addEventListener("submit", function (event) { event.preventDefault(); var parsed = music.parseChordSymbol(tonic.value); dispatch({ type: "context.set", context: { tonicPc: parsed.interpretation.rootPc, tonicSpelling: tonic.value, sourceChordId: null, scaleId: scale.value || null } }); }); hosts.header.appendChild(context);
      }
      if (songNotesOpen) {
        var notes = el("textarea", null, { "aria-label": "Song notes", rows: "3" }); notes.value = current.notes;
        notes.addEventListener("change", function () { dispatch({ type: "song.update", patch: { notes: notes.value } }); }); hosts.header.appendChild(notes);
        hosts.header.appendChild(button("Done with song notes", function () { songNotesOpen = false; rerender(); }));
      } else {
        if (current.notes) { hosts.header.appendChild(el("p", current.notes, { class: "notebook-notes" })); }
        hosts.header.appendChild(button(current.notes ? "Edit song notes" : "Add song notes…", function () { songNotesOpen = true; rerender(); }));
      }
      renderStatus(snapshot, state);
      renderSettings(snapshot);
    }
    return { render: render, destroy: function () { if (settingsView) { settingsView.destroy(); } hosts.header.replaceChildren(); hosts.status.replaceChildren(); hosts.settings.replaceChildren(); } };
  }

  function bootstrap(window, document) {
    var root = document.getElementById("song-notebook");
    if (!root || !window.MusicToolControls || !window.SongNotebookCompose || !window.SongNotebookEditor) { return null; }
    var music = window.SongNotebookMusic, model = window.SongNotebookModel.create({ music: music });
    var localStorage = null;
    try { localStorage = window.localStorage; } catch (error) { /* In-memory composition and JSON remain available. */ }
    var storage = window.SongNotebookStorage.create({ storage: localStorage, model: model, music: music });
    var printing = false, printFocus = null, exploreOpener = null;
    var modules = { Compose: window.SongNotebookCompose, Editor: window.SongNotebookEditor, Explore: window.SongNotebookExplore, Reading: window.SongNotebookReading };
    var store = createStore({ music: music, model: model, storage: storage, onEffect: function (effect) {
      if (effect.type === "download") {
        var url = window.URL.createObjectURL(new window.Blob([effect.text], { type: "application/json" }));
        var link = document.createElement("a"); link.href = url; link.download = effect.filename.replace(/[\\/:*?"<>|\u0000-\u001f]/g, "_");
        document.body.appendChild(link); link.click(); link.remove(); window.setTimeout(function () { window.URL.revokeObjectURL(url); }, 0);
      } else if (effect.type === "print" && modules.Reading) {
        beginPrint();
        try { window.print(); } finally { endPrint(); }
      }
    } });
    function visibleControl(control) {
      if (!control || !document.body.contains(control) || control.disabled) { return false; }
      for (var node = control; node; node = node.parentNode) { if (node.hidden) { return false; } }
      return true;
    }
    function dispatchComponent(action) {
      var opening = action.type === "panel.set" && action.panel === "explore", closing = action.type === "explore.close";
      var before = opening || closing ? store.snapshot() : null;
      if (opening && before.panel !== "explore") {
        exploreOpener = document.getElementById("notebook-explore-opener");
      }
      var result = store.dispatch(action);
      if (!result.error && closing && before.panel === "explore" && before.mode === "edit") {
        var opener = visibleControl(exploreOpener) ? exploreOpener : document.getElementById("notebook-explore-opener");
        if (visibleControl(opener)) { opener.focus(); }
        exploreOpener = null;
      }
      return result;
    }
    var components = mountComponents(document, modules, { dispatch: dispatchComponent, music: music }, window.SongNotebookContracts);
    var header = mountHeader({ header: document.getElementById("notebook-header"), status: document.getElementById("notebook-status"), settings: document.getElementById("notebook-settings") }, store, { music: music, model: model, storage: storage, readingAvailable: !!modules.Reading, controls: window.MusicToolControls });
    var legacy = document.querySelector("main.guitar-chordinator"); if (legacy) { legacy.hidden = true; }
    root.hidden = false; if (modules.Reading) { document.body.classList.add("song-notebook-active"); }
    function beginPrint() { if (modules.Reading) { if (!printing) { printFocus = document.activeElement; } printing = true; root.classList.add("notebook-printing"); render(); } }
    function endPrint() { printing = false; root.classList.remove("notebook-printing"); var snapshot = store.snapshot(); components.render(snapshot, true); visibility(snapshot); if (printFocus && document.body.contains(printFocus)) { printFocus.focus(); } printFocus = null; }
    function render() {
      var snapshot = store.snapshot();
      if (printing) { snapshot.mode = "read"; }
      if (!printing) { header.render(snapshot, store.state()); } components.render(snapshot, printing);
      visibility(snapshot);
    }
    function visibility(snapshot) {
      document.getElementById("notebook-workspace").hidden = snapshot.mode === "read";
      document.getElementById("notebook-details").hidden = snapshot.mode === "read" || snapshot.panel === null;
      document.getElementById("notebook-editor").hidden = snapshot.mode === "read" || snapshot.panel !== "editor";
      document.getElementById("notebook-explore").hidden = snapshot.mode === "read" || snapshot.panel !== "explore";
      document.getElementById("notebook-reading").hidden = snapshot.mode !== "read";
      root.classList.toggle("notebook-read-mode", snapshot.mode === "read");
    }
    var unsubscribe = store.subscribe(render);
    function flushWhenHidden() { if (document.visibilityState === "hidden") { store.flush(); } }
    function storageEvent(event) { if (event.storageArea === localStorage || event.storageArea === null) { store.storageChanged(event.key); } }
    function keyboard(event) {
      if (!(event.ctrlKey || event.metaKey) || event.altKey || String(event.key).toLowerCase() !== "z") { return; }
      var tag = event.target && event.target.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || (event.target && event.target.isContentEditable)) { return; }
      event.preventDefault(); store.dispatch({ type: event.shiftKey ? "history.redo" : "history.undo" });
    }
    window.addEventListener("beforeprint", beginPrint); window.addEventListener("afterprint", endPrint);
    document.addEventListener("visibilitychange", flushWhenHidden); window.addEventListener("pagehide", store.flush); window.addEventListener("storage", storageEvent); root.addEventListener("keydown", keyboard);
    store.initialize(); render();
    return { store: store, render: render, destroy: function () { unsubscribe(); window.removeEventListener("beforeprint", beginPrint); window.removeEventListener("afterprint", endPrint); document.body.classList.remove("song-notebook-active"); document.removeEventListener("visibilitychange", flushWhenHidden); window.removeEventListener("pagehide", store.flush); window.removeEventListener("storage", storageEvent); root.removeEventListener("keydown", keyboard); store.destroy(); components.destroy(); header.destroy(); } };
  }

  return { createStore: createStore, mountComponents: mountComponents, mountHeader: mountHeader, bootstrap: bootstrap };
}));

(function () {
  "use strict";
  if (typeof document === "undefined") { return; }
  if (window.SongNotebookController.bootstrap(window, document)) { return; }

  var NOTES = GuitarTuning.notes;
  var FLAT_EQUIVALENTS = {
    1: "Db",
    3: "Eb",
    6: "Gb",
    8: "Ab",
    10: "Bb"
  };
  var PRESETS = GuitarTuning.presets;
  var MAX_FRET = 15;
  var SAMPLE_SHAPE = [0, 1, 0, 2, 3, null];
  var HISTORY_KEY = "cs-shadow.guitar-chordinator.recent-settings.v1";
  var HISTORY_VERSION = 2;
  var HISTORY_LIMIT = 5;
  var HISTORY_SAVE_DELAY = 1500;

  var CHORDS = [
    { suffix: "", quality: "major", intervals: [0, 4, 7] },
    { suffix: "m", quality: "minor", intervals: [0, 3, 7] },
    { suffix: "dim", quality: "diminished", intervals: [0, 3, 6] },
    { suffix: "aug", quality: "augmented", intervals: [0, 4, 8] },
    { suffix: "sus2", quality: "sus2", intervals: [0, 2, 7] },
    { suffix: "sus4", quality: "sus4", intervals: [0, 5, 7] },
    { suffix: "7sus4", quality: "dominant 7 sus4", intervals: [0, 5, 7, 10] },
    { suffix: "5", quality: "power chord", intervals: [0, 7] },
    { suffix: "6", quality: "major 6", intervals: [0, 4, 7, 9] },
    { suffix: "m6", quality: "minor 6", intervals: [0, 3, 7, 9] },
    { suffix: "7", quality: "dominant 7", intervals: [0, 4, 7, 10] },
    { suffix: "maj7", quality: "major 7", intervals: [0, 4, 7, 11] },
    { suffix: "m7", quality: "minor 7", intervals: [0, 3, 7, 10] },
    { suffix: "mMaj7", quality: "minor major 7", intervals: [0, 3, 7, 11] },
    { suffix: "dim7", quality: "diminished 7", intervals: [0, 3, 6, 9] },
    { suffix: "m7b5", quality: "half-diminished", intervals: [0, 3, 6, 10] },
    { suffix: "add2", quality: "add 2", intervals: [0, 2, 4, 7] },
    { suffix: "add9", quality: "add 9", intervals: [0, 4, 7, 14] },
    { suffix: "madd9", quality: "minor add 9", intervals: [0, 3, 7, 14] },
    { suffix: "add4", quality: "add 4", intervals: [0, 4, 5, 7] },
    { suffix: "add11", quality: "add 11", intervals: [0, 4, 7, 17] },
    { suffix: "add6", quality: "add 6", intervals: [0, 4, 7, 9] },
    { suffix: "9", quality: "dominant 9", intervals: [0, 4, 7, 10, 14] },
    { suffix: "maj9", quality: "major 9", intervals: [0, 4, 7, 11, 14] },
    { suffix: "m9", quality: "minor 9", intervals: [0, 3, 7, 10, 14] },
    { suffix: "11", quality: "dominant 11", intervals: [0, 4, 7, 10, 14, 17] },
    { suffix: "13", quality: "dominant 13", intervals: [0, 4, 7, 10, 14, 17, 21] },
    { suffix: "7b5", quality: "dominant 7 flat 5", intervals: [0, 4, 6, 10] },
    { suffix: "7#5", quality: "dominant 7 sharp 5", intervals: [0, 4, 8, 10] },
    { suffix: "7b9", quality: "dominant 7 flat 9", intervals: [0, 4, 7, 10, 13] },
    { suffix: "7#9", quality: "dominant 7 sharp 9", intervals: [0, 4, 7, 10, 15] },
    { suffix: "9b5", quality: "dominant 9 flat 5", intervals: [0, 4, 6, 10, 14] },
    { suffix: "9#5", quality: "dominant 9 sharp 5", intervals: [0, 4, 8, 10, 14] },
    { suffix: "7b5b9", quality: "dominant 7 flat 5 flat 9", intervals: [0, 4, 6, 10, 13] },
    { suffix: "7#5b9", quality: "dominant 7 sharp 5 flat 9", intervals: [0, 4, 8, 10, 13] },
    { suffix: "7b5#9", quality: "dominant 7 flat 5 sharp 9", intervals: [0, 4, 6, 10, 15] },
    { suffix: "7#5#9", quality: "dominant 7 sharp 5 sharp 9", intervals: [0, 4, 8, 10, 15] }
  ];

  var fretboard = document.getElementById("chordinator-fretboard");
  var selectedNotesTarget = document.getElementById("selected-notes");
  var matchesTarget = document.getElementById("chord-matches");
  var shapeTarget = document.getElementById("chordinator-shape");
  var clearButton = document.getElementById("chordinator-clear");
  var sampleButton = document.getElementById("chordinator-sample");
  var tuningDescription = document.getElementById("chordinator-tuning-description");
  var presetSelect = document.getElementById("chordinator-preset");
  var recentSettingsSelect = document.getElementById("chordinator-recent-settings");
  var clearHistoryButton = document.getElementById("chordinator-clear-history");
  var selection = SAMPLE_SHAPE.slice();
  var tuning = GuitarTuning.defaultTuning();
  var history = [];
  var recentSettings;

  function normalizePitch(pitch) {
    return GuitarTuning.normalizePitch(pitch);
  }

  function pitchName(pitch) {
    return GuitarTuning.pitchName(pitch);
  }

  function friendlyPitchName(pitch) {
    var normalized = normalizePitch(pitch);
    return FLAT_EQUIVALENTS[normalized] || NOTES[normalized];
  }

  function uniquePitches(notes) {
    var seen = {};
    return notes.reduce(function (pitches, note) {
      if (!seen[note.pitch]) {
        seen[note.pitch] = true;
        pitches.push(note.pitch);
      }
      return pitches;
    }, []);
  }

  function intervalSet(intervals) {
    var seen = {};
    intervals.forEach(function (interval) {
      seen[normalizePitch(interval)] = true;
    });
    return Object.keys(seen).map(function (pitch) {
      return Number(pitch);
    }).sort(function (a, b) {
      return a - b;
    });
  }

  function setDifference(left, right) {
    return left.filter(function (value) {
      return right.indexOf(value) === -1;
    });
  }

  function setsEqual(left, right) {
    return left.length === right.length && setDifference(left, right).length === 0;
  }

  function selectedNotes() {
    return selection.reduce(function (notes, fret, index) {
      if (fret === null) {
        return notes;
      }

      var string = tuning[index];
      var pitch = normalizePitch(string.pitch + fret);
      notes.push({
        stringIndex: index,
        stringNumber: string.guitarString,
        fret: fret,
        pitch: pitch,
        name: pitchName(pitch)
      });
      return notes;
    }, []);
  }

  function bassPitch(notes) {
    var bass = notes.slice().sort(function (a, b) {
      return b.stringIndex - a.stringIndex;
    })[0];
    return bass ? bass.pitch : null;
  }

  function intervalLabel(interval) {
    var labels = {
      0: "1",
      1: "b2",
      2: "2/9",
      3: "b3/#9",
      4: "3",
      5: "4/11",
      6: "b5/#11",
      7: "5",
      8: "#5/b13",
      9: "6/13",
      10: "b7",
      11: "7"
    };
    return labels[normalizePitch(interval)];
  }

  function chordName(root, chord, bass) {
    var name = friendlyPitchName(root) + chord.suffix;
    if (bass !== null && bass !== root) {
      name += "/" + friendlyPitchName(bass);
    }
    return name;
  }

  function candidateFor(root, chord, playedPitches, bass) {
    var chordSet = intervalSet(chord.intervals);
    var playedSet = playedPitches.map(function (pitch) {
      return normalizePitch(pitch - root);
    }).sort(function (a, b) {
      return a - b;
    });
    var missing = setDifference(chordSet, playedSet);
    var extra = setDifference(playedSet, chordSet);
    var exact = setsEqual(chordSet, playedSet);

    if (!exact && (missing.length + extra.length > 1 || missing.indexOf(0) !== -1)) {
      return null;
    }

    return {
      name: chordName(root, chord, bass),
      root: friendlyPitchName(root),
      quality: chord.quality,
      intervals: playedSet.map(intervalLabel),
      missing: missing.map(intervalLabel),
      extra: extra.map(intervalLabel),
      exact: exact,
      score: (exact ? 0 : 10) + missing.length + extra.length + chordSet.length / 10
    };
  }

  function findMatches(notes) {
    var pitches = uniquePitches(notes);
    var bass = bassPitch(notes);
    var candidates = [];

    if (pitches.length < 2) {
      return [];
    }

    pitches.forEach(function (root) {
      CHORDS.forEach(function (chord) {
        var candidate = candidateFor(root, chord, pitches, bass);
        if (candidate) {
          candidates.push(candidate);
        }
      });
    });

    candidates.sort(function (a, b) {
      if (a.exact !== b.exact) {
        return a.exact ? -1 : 1;
      }
      return a.score - b.score || a.name.length - b.name.length;
    });

    if (candidates.some(function (candidate) { return candidate.exact; })) {
      return candidates.filter(function (candidate) {
        return candidate.exact;
      }).slice(0, 8);
    }

    return candidates.slice(0, 8);
  }

  function shapeText() {
    return selection.slice().reverse().map(function (fret) {
      return fret === null ? "x" : String(fret);
    }).join("");
  }

  function tuningPresetKey() {
    return GuitarTuning.presetKey(tuning);
  }

  function tuningDescriptionText() {
    var key = tuningPresetKey();
    return GuitarTuning.label(tuning) + " tuning, frets 0-15";
  }

  function snapshot() {
    return {
      tuning: GuitarTuning.pitches(tuning),
      selection: selection.slice()
    };
  }

  function isValidSnapshot(candidate) {
    return candidate && GuitarTuning.isValidPitches(candidate.tuning) && Array.isArray(candidate.selection) && candidate.selection.length === 6 &&
      candidate.selection.every(function (fret) {
        return fret === null || (Number.isInteger(fret) && fret >= 0 && fret <= MAX_FRET);
      });
  }

  function snapshotsMatch(left, right) {
    return left.tuning.every(function (pitch, index) {
      return pitch === right.tuning[index];
    }) && left.selection.every(function (fret, index) {
      return fret === right.selection[index];
    });
  }

  function historyLabel(entry) {
    var tuningLabel = GuitarTuning.label(GuitarTuning.fromPitches(entry.tuning));
    var shape = entry.selection.slice().reverse().map(function (fret) {
      return fret === null ? "x" : String(fret);
    }).join("");

    return shape + " · " + tuningLabel;
  }

  function renderHistoryControls() {
    recentSettingsSelect.textContent = "";
    if (!history.length) {
      var emptyOption = document.createElement("option");
      emptyOption.textContent = "No saved settings";
      emptyOption.value = "";
      recentSettingsSelect.appendChild(emptyOption);
      recentSettingsSelect.disabled = true;
      clearHistoryButton.disabled = true;
      return;
    }

    history.forEach(function (entry, index) {
      var option = document.createElement("option");
      option.value = String(index);
      option.textContent = historyLabel(entry);
      recentSettingsSelect.appendChild(option);
    });
    recentSettingsSelect.disabled = false;
    clearHistoryButton.disabled = false;
  }

  function applySnapshot(entry) {
    tuning = GuitarTuning.fromPitches(entry.tuning);
    selection = entry.selection.slice();
  }

  function renderTuningControls() {
    presetSelect.value = tuningPresetKey();
    tuningDescription.textContent = tuningDescriptionText();
  }

  function renderFretboard() {
    fretboard.textContent = "";
    fretboard.style.setProperty("--fret-count", MAX_FRET + 1);

    var numberRow = document.createElement("div");
    numberRow.className = "fret-number-row";
    numberRow.appendChild(document.createElement("span"));

    for (var fret = 0; fret <= MAX_FRET; fret += 1) {
      var number = document.createElement("span");
      number.className = "fret-number";
      number.textContent = fret;
      numberRow.appendChild(number);
    }
    fretboard.appendChild(numberRow);

    tuning.forEach(function (string, stringIndex) {
      var row = document.createElement("div");
      row.className = "fretboard-row";

      var label = document.createElement("div");
      label.className = "string-label chordinator-string-label";
      var name = document.createElement("span");
      name.className = "chordinator-string-name";
      name.textContent = string.label;
      name.title = "String " + string.guitarString + ", open " + string.label;
      var tuningSelect = document.createElement("select");
      tuningSelect.id = "chordinator-string-" + string.guitarString;
      tuningSelect.setAttribute("aria-label", "String " + string.guitarString + " tuning, currently " + string.label);
      NOTES.forEach(function (note, pitch) {
        var option = document.createElement("option");
        option.value = pitch;
        option.textContent = note;
        tuningSelect.appendChild(option);
      });
      tuningSelect.value = string.pitch;
      tuningSelect.addEventListener("change", function (event) {
        tuning[stringIndex].pitch = Number(event.currentTarget.value);
        tuning[stringIndex].label = pitchName(tuning[stringIndex].pitch);
        render();
        recentSettings.schedule();
      });
      var mute = document.createElement("button");
      mute.type = "button";
      mute.className = "string-mute";
      mute.textContent = "x";
      mute.setAttribute("aria-label", "Mute string " + string.guitarString);
      mute.setAttribute("aria-pressed", selection[stringIndex] === null ? "true" : "false");
      mute.addEventListener("click", function () {
        if (selection[stringIndex] === null) {
          return;
        }

        selection[stringIndex] = null;
        render();
        recentSettings.schedule();
      });
      label.appendChild(name);
      label.appendChild(tuningSelect);
      label.appendChild(mute);
      row.appendChild(label);

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "fret-cell chordinator-fret";
        cell.dataset.stringIndex = stringIndex;
        cell.dataset.fret = fret;
        cell.setAttribute("aria-label", string.label + " string " + string.guitarString + " fret " + fret);

        if (selection[stringIndex] === fret) {
          cell.className += fret === 0 ? " selected open" : " selected";
        }

        var note = document.createElement("span");
        note.textContent = pitchName(string.pitch + fret);
        cell.appendChild(note);
        cell.addEventListener("click", function (event) {
          var nextStringIndex = Number(event.currentTarget.dataset.stringIndex);
          var nextFret = Number(event.currentTarget.dataset.fret);
          selection[nextStringIndex] = selection[nextStringIndex] === nextFret ? null : nextFret;
          render();
          recentSettings.schedule();
        });

        row.appendChild(cell);
      }

      fretboard.appendChild(row);
    });
  }

  function renderSelectedNotes(notes) {
    selectedNotesTarget.textContent = "";

    if (!notes.length) {
      var empty = document.createElement("li");
      empty.className = "empty-note";
      empty.textContent = "No strings selected";
      selectedNotesTarget.appendChild(empty);
      return;
    }

    notes.forEach(function (note) {
      var item = document.createElement("li");
      item.className = "root-note";
      item.textContent = note.name;
      item.title = "String " + note.stringNumber + ", fret " + note.fret;
      selectedNotesTarget.appendChild(item);
    });
  }

  function renderMatches(matches) {
    matchesTarget.textContent = "";

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Select at least two notes to identify a chord.";
      matchesTarget.appendChild(empty);
      return;
    }

    matches.forEach(function (match) {
      var card = document.createElement("article");
      card.className = "chord-match" + (match.exact ? " exact-match" : " close-match");

      var heading = document.createElement("div");
      heading.className = "chord-match-heading";

      var title = document.createElement("h3");
      title.textContent = match.name;
      var badge = document.createElement("span");
      badge.textContent = match.exact ? "Exact match" : "Close match";

      heading.appendChild(title);
      heading.appendChild(badge);

      var details = document.createElement("p");
      details.textContent = "Root " + match.root + "; " + match.quality + "; intervals " + match.intervals.join(", ");

      card.appendChild(heading);
      card.appendChild(details);

      if (!match.exact) {
        var close = document.createElement("p");
        close.className = "match-difference";
        close.textContent = [
          match.missing.length ? "missing " + match.missing.join(", ") : "",
          match.extra.length ? "extra " + match.extra.join(", ") : ""
        ].filter(Boolean).join("; ");
        card.appendChild(close);
      }

      matchesTarget.appendChild(card);
    });
  }

  function render() {
    var notes = selectedNotes();
    shapeTarget.textContent = shapeText();
    renderFretboard();
    renderTuningControls();
    renderSelectedNotes(notes);
    renderMatches(findMatches(notes));
  }

  clearButton.addEventListener("click", function () {
    selection = tuning.map(function () {
      return null;
    });
    render();
    recentSettings.schedule();
  });

  sampleButton.addEventListener("click", function () {
    selection = SAMPLE_SHAPE.slice();
    render();
    recentSettings.schedule();
  });

  presetSelect.addEventListener("change", function (event) {
    var preset = PRESETS[event.currentTarget.value];
    if (!preset) {
      return;
    }
    tuning = GuitarTuning.fromPitches(preset.pitches);
    render();
    recentSettings.schedule();
  });

  recentSettingsSelect.addEventListener("change", function (event) {
    var entry = history[Number(event.currentTarget.value)];

    if (!entry) {
      return;
    }

    recentSettings.cancel();
    applySnapshot(entry);
    render();
    recentSettings.save();
  });

  clearHistoryButton.addEventListener("click", function () {
    recentSettings.clear();
  });

  recentSettings = RecentSettings.create({
    key: HISTORY_KEY,
    version: HISTORY_VERSION,
    limit: HISTORY_LIMIT,
    delay: HISTORY_SAVE_DELAY,
    snapshot: snapshot,
    normalize: function (candidate) { return isValidSnapshot(candidate) ? candidate : null; },
    matches: snapshotsMatch,
    onChange: function (entries) {
      history = entries;
      renderHistoryControls();
    }
  });
  history = recentSettings.load();
  if (history.length) {
    applySnapshot(history[0]);
  }
  renderHistoryControls();
  render();
}());
