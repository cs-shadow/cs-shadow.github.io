(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookEditor = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function mount(hosts, api) {
    var root = hosts.root, document = root.ownerDocument, music = api.music;
    var view = null, destroyed = false, renderKey = null, editingMode = {}, expanded = {}, showAll = {};
    var errorNode = null, localError = "";
    root.classList.add("notebook-editor");
    function element(tag, className, text) {
      var node = document.createElement(tag);
      if (className) { node.className = className; }
      if (text !== undefined) { node.textContent = text; }
      return node;
    }
    function append(parent, tag, className, text) { var node = element(tag, className, text); parent.appendChild(node); return node; }
    function button(parent, label, key, handler, options) {
      options = options || {};
      var node = append(parent, "button", options.primary ? "notebook-editor-primary" : "", label);
      node.type = "button"; node.dataset.editorKey = key; node.disabled = !!options.disabled;
      node.addEventListener("click", function () { if (!destroyed && !node.disabled) { handler(); } }); return node;
    }
    function message(text) { localError = text || ""; if (errorNode) { errorNode.textContent = localError || (view.error && view.error.message) || ""; errorNode.hidden = !errorNode.textContent; } }
    function send(action) { if (destroyed) { return { error: null }; } localError = ""; var result = api.dispatch(action); if (result && result.error) { message(result.error.message); } return result; }
    function draftFor(chordId) { return view.drafts.find(function (draft) { return draft.songId === view.song.id && draft.chordId === chordId; }); }
    function patch(chordId, changes) { send({ type: "draft.patch", chordId: chordId, patch: changes }); }
    function acceptedPatch(chosen) { return { interpretation: chosen, reviewRequired: false, previousInterpretation: null }; }
    function name(chord, fallback) { return music.formatInterpretation(chord && chord.interpretation) || (chord && chord.nickname) || fallback || "Unnamed shape"; }
    function sourceFor(chordId) { return view.song.chords.find(function (chord) { return chord.id === chordId; }); }
    function hasShape(candidate) { return candidate.frets && candidate.frets.some(function (fret) { return fret !== null; }); }
    function changedSettings(draft) { return draft.capo !== view.song.capo || JSON.stringify(draft.tuningMidi) !== JSON.stringify(view.song.tuningMidi); }
    function canonicalChord(chord) {
      function chosen(value) { return value === null ? null : { rootPc: value.rootPc, rootSpelling: value.rootSpelling, formulaId: value.formulaId, bassPc: value.bassPc, bassSpelling: value.bassSpelling }; }
      return { id: chord.id, frets: chord.frets, interpretation: chosen(chord.interpretation), nickname: chord.nickname, notes: chord.notes, reviewRequired: chord.reviewRequired, previousInterpretation: chosen(chord.previousInterpretation) };
    }
    function changedSource(draft, source) {
      if (draft.chordId === null) { return false; }
      if (!source) { return true; }
      try { return JSON.stringify(canonicalChord(JSON.parse(draft.sourceFingerprint))) !== JSON.stringify(canonicalChord(source)); }
      catch (error) { return true; }
    }
    function refresh() { renderKey = null; render(view); }
    function details(parent, label, key, initiallyOpen) {
      var node = append(parent, "details", "notebook-editor-disclosure");
      node.open = Object.prototype.hasOwnProperty.call(expanded, key) ? expanded[key] : !!initiallyOpen;
      append(node, "summary", "", label);
      node.addEventListener("toggle", function () { expanded[key] = node.open; }); return node;
    }
    function textField(parent, label, value, key, multiline, commit) {
      var wrapper = append(parent, "label", "notebook-editor-field"); append(wrapper, "span", "", label);
      var input = append(wrapper, multiline ? "textarea" : "input"); if (!multiline) { input.type = "text"; } else { input.rows = 3; }
      input.value = value; input.dataset.editorKey = key;
      input.addEventListener("change", function () { if (!destroyed) { commit(input.value); } }); return input;
    }
    function selectField(parent, label, values, selected, key) {
      var wrapper = append(parent, "label", "notebook-editor-field"); append(wrapper, "span", "", label); var select = append(wrapper, "select"); select.dataset.editorKey = key;
      values.forEach(function (value) { var option = append(select, "option", "", value.label); option.value = value.value; }); select.value = selected; return select;
    }
    function pitchLabel(midi) { return music.pitchName(music.normalizePitch(midi)) + (Math.floor(midi / 12) - 1); }
    function usage(song, chordId) {
      var records = [];
      song.sections.forEach(function (section) { section.occurrences.forEach(function (occurrence, index) { if (occurrence.chordId === chordId) { records.push({ section: section, occurrence: occurrence, index: index }); } }); }); return records;
    }
    function originInfo(draft) {
      var section = view.song.sections.find(function (item) { return item.id === draft.originSectionId; });
      var index = section ? section.occurrences.findIndex(function (item) { return item.id === draft.originOccurrenceId && item.chordId === draft.chordId; }) : -1;
      return { section: section, index: index, valid: index !== -1 };
    }
    function renderShelf(parent, currentId, showCurrent) {
      var drafts = view.drafts.filter(function (draft) { return draft.songId === view.song.id && (showCurrent || draft.chordId !== currentId); });
      if (!drafts.length) { return; }
      var shelf = append(parent, "div", "notebook-editor-resume"); append(shelf, "span", "", "Unapplied drafts");
      drafts.forEach(function (draft, index) {
        button(shelf, "Resume " + name(draft.candidate, draft.chordId === null ? "new chord" : "chord draft"), "resume-" + index, function () { send({ type: "draft.open", chordId: draft.chordId }); });
      });
    }
    function renderFrets(parent, candidate, settings, editable, chordId, key) {
      var maxFret = 24 - settings.capo, frets = candidate.frets || [null,null,null,null,null,null];
      var scroll = append(parent, "div", "notebook-editor-neck-scroll");
      scroll.setAttribute("aria-label", "Guitar fretboard; scroll horizontally for higher frets");
      var table = append(scroll, "table", "notebook-editor-neck"); table.setAttribute("role", "grid"); table.setAttribute("aria-label", "Six-string guitar fretboard");
      var header = append(append(table, "thead"), "tr"); append(header, "th", "notebook-editor-string", "String"); append(header, "th", "", "Mute");
      for (var fret = 0; fret <= maxFret; fret += 1) { append(header, "th", "", fret === 0 ? "Open" : String(fret)); }
      var body = append(table, "tbody");
      for (var index = 0; index < 6; index += 1) {
        var row = append(body, "tr"), heading = append(row, "th", "notebook-editor-string", (index + 1) + " · " + pitchLabel(settings.tuningMidi[index])); heading.scope = "row";
        for (var position = -1; position <= maxFret; position += 1) {
          (function (stringIndex, selectedFret) {
            var muted = selectedFret === -1, value = muted ? null : selectedFret, selected = frets[stringIndex] === value;
            var cell = append(row, "td", muted ? "notebook-editor-mute" : "notebook-editor-fret" + (selectedFret === 0 ? " notebook-editor-open" : ""));
            var note = muted ? "Mute" : pitchLabel(settings.tuningMidi[stringIndex] + settings.capo + selectedFret);
            var control = button(cell, muted ? "×" : selected ? music.pitchName(music.normalizePitch(settings.tuningMidi[stringIndex] + settings.capo + selectedFret)) : "·", "fret-" + stringIndex + "-" + selectedFret, function () {
              var current = draftFor(chordId); if (!current) { return; }
              var changed = (current.candidate.frets || [null,null,null,null,null,null]).slice(); changed[stringIndex] = value;
              var changes = { frets: changed };
              if (current.candidate.interpretation && JSON.stringify(changed) !== JSON.stringify(current.candidate.frets)) { changes.reviewRequired = true; changes.previousInterpretation = current.candidate.previousInterpretation || current.candidate.interpretation; }
              patch(chordId, changes);
            }, { disabled: !editable });
            control.className = "notebook-editor-note"; control.setAttribute("aria-pressed", String(selected));
            control.setAttribute("aria-label", "String " + (stringIndex + 1) + ", " + (muted ? "mute" : selectedFret === 0 ? "open, " + note : "fret " + selectedFret + ", " + note + (settings.capo ? ", physical fret " + (selectedFret + settings.capo) : "")));
            control.tabIndex = editable && stringIndex === 0 && selected ? 0 : -1;
            control.addEventListener("keydown", function (event) {
              var nextString = stringIndex, nextFret = selectedFret;
              if (event.key === "ArrowLeft") { nextFret -= 1; } else if (event.key === "ArrowRight") { nextFret += 1; }
              else if (event.key === "ArrowUp") { nextString -= 1; } else if (event.key === "ArrowDown") { nextString += 1; }
              else if (event.key === "Home") { nextFret = -1; } else if (event.key === "End") { nextFret = maxFret; } else { return; }
              event.preventDefault(); nextString = Math.max(0, Math.min(5, nextString)); nextFret = Math.max(-1, Math.min(maxFret, nextFret));
              var target = root.querySelector('[data-editor-key="fret-' + nextString + '-' + nextFret + '"]');
              if (target) { root.querySelectorAll(".notebook-editor-note").forEach(function (node) { node.tabIndex = -1; }); target.tabIndex = 0; target.focus(); }
            });
          }(index, position));
        }
      }
      append(parent, "p", "notebook-editor-hint", "Frets are relative to the capo. Arrow keys move between strings and frets; Enter or Space selects. " + (settings.capo ? "Capo " + settings.capo + " · physical frets through 24." : "No capo · frets 0–24."));
      if (editable && hasShape(candidate)) { button(parent, "Remove fingering", "remove-fingering", function () { patch(chordId, { frets: null }); }); }
    }
    function renderNameEntry(parent, draft, key) {
      var chosen = draft.candidate.interpretation, form = append(parent, "form", "notebook-editor-name-entry");
      var symbol = textField(form, "Sounding chord name", music.formatInterpretation(chosen), "symbol", false, function () {}); symbol.placeholder = "Am, Cmaj7, D/F#…";
      var submit = append(form, "button", "", "Use chord name"); submit.type = "submit"; submit.dataset.editorKey = "use-symbol";
      form.addEventListener("submit", function (event) { event.preventDefault(); var parsed = music.parseChordSymbol(symbol.value); if (parsed.error) { message(parsed.error.message); } else { patch(draft.chordId, acceptedPatch(parsed.interpretation)); } });
      var controls = append(parent, "div", "notebook-editor-name-controls");
      var roots = music.roots.slice(); if (chosen && !roots.includes(chosen.rootSpelling)) { roots.push(chosen.rootSpelling); }
      var rootSelect = selectField(controls, "Root", roots.map(function (value) { return { value: value, label: value }; }), chosen ? chosen.rootSpelling : "C", "root");
      var quality = selectField(controls, "Quality", music.chords.map(function (formula) { return { value: formula.id, label: formula.suffix || "major" }; }), chosen ? chosen.formulaId : "", "quality");
      var bassRoots = roots.slice(); if (chosen && chosen.bassSpelling && !bassRoots.includes(chosen.bassSpelling)) { bassRoots.push(chosen.bassSpelling); }
      var bass = selectField(controls, "Slash bass (optional)", [{ value: "", label: "No slash bass" }].concat(bassRoots.map(function (value) { return { value: value, label: value }; })), chosen && chosen.bassSpelling || "", "bass");
      function choose() { var parsed = music.parseChordSymbol(rootSelect.value + quality.value + (bass.value ? "/" + bass.value : "")); if (parsed.error) { message(parsed.error.message); } else { patch(draft.chordId, acceptedPatch(parsed.interpretation)); } }
      [rootSelect, quality, bass].forEach(function (select) { select.addEventListener("change", choose); });
      button(controls, "Use root & quality", "use-root-quality", choose);
      append(parent, "p", "notebook-editor-hint", "Chord names describe sounding harmony. A fingering is optional.");
    }
    function renderInterpretations(parent, draft, settings, key) {
      var candidate = draft.candidate;
      if (!hasShape(candidate)) { return; }
      var notes = music.notesForShape(settings.tuningMidi, settings.capo, candidate.frets), matches = music.identifyChord(notes);
      var box = details(parent, "Interpretations" + (matches.length ? " (" + matches.length + ")" : ""), key + ":interpretations", !candidate.interpretation);
      append(box, "p", "notebook-editor-hint", "Choosing a name is optional. Exact matches contain the same notes; close matches show what is missing or extra.");
      if (!matches.length) { append(box, "p", "", "No catalog match. You can keep this shape unnamed."); }
      var list = append(box, "ul", "notebook-editor-candidates");
      (showAll[key] ? matches : matches.slice(0, 12)).forEach(function (match, index) {
        var item = append(list, "li"); button(item, "Use " + match.label, "candidate-" + index, function () { patch(draft.chordId, acceptedPatch(match.interpretation)); });
        append(item, "span", "notebook-editor-match", match.match === "exact" ? "Exact" : "Close");
        if (match.missing.length) { append(item, "span", "notebook-editor-evidence", "Missing: " + match.missing.map(function (pc) { return music.pitchName(pc); }).join(", ")); }
        if (match.extra.length) { append(item, "span", "notebook-editor-evidence", "Extra: " + match.extra.map(function (pc) { return music.pitchName(pc); }).join(", ")); }
      });
      if (matches.length > 12 && !showAll[key]) { button(box, "Show all " + matches.length + " interpretations", "all-interpretations", function () { showAll[key] = true; refresh(); }); }
      button(box, "Keep shape unnamed", "unnamed", function () { patch(draft.chordId, acceptedPatch(null)); });
    }
    function renderNotes(parent, candidate, settings, key) {
      if (!hasShape(candidate)) { return; }
      var notes = music.notesForShape(settings.tuningMidi, settings.capo, candidate.frets), lowest = Math.min.apply(null, notes.map(function (note) { return note.midi; }));
      var box = details(parent, "Sounding notes & intervals", key + ":notes", false);
      append(box, "p", "", "Lowest sounding note: " + pitchLabel(lowest) + ". Bass follows pitch register, including custom tuning.");
      var table = append(box, "table", "notebook-editor-notes-table"), head = append(append(table, "thead"), "tr");
      ["String", "Relative fret", "Physical fret", "Sounding note", "Interval"].forEach(function (label) { append(head, "th", "", label); });
      var body = append(table, "tbody"), intervals = ["1","b2","2","b3","3","4","b5","5","b6","6","b7","7"];
      notes.forEach(function (note) { var row = append(body, "tr"); [String(note.stringIndex + 1), String(note.fret), String(note.physicalFret), pitchLabel(note.midi) + (note.midi === lowest ? " · bass" : ""), candidate.interpretation && !candidate.reviewRequired ? intervals[music.normalizePitch(note.pc - candidate.interpretation.rootPc)] : "—"].forEach(function (value) { append(row, "td", "", value); }); });
    }
    function renderUsage(parent, chordId, key) {
      var locations = usage(view.song, chordId), box = details(parent, "Usage (" + locations.length + " " + (locations.length === 1 ? "occurrence" : "occurrences") + ")", key + ":usage", false);
      if (!locations.length) { append(box, "p", "", "This chord is kept in the collection and is not used in a section yet."); }
      locations.forEach(function (location, index) { button(box, (location.section.name || "Untitled section") + " · chord " + (location.index + 1), "usage-" + index, function () { send({ type: "selection.set", sectionId: location.section.id, occurrenceId: location.occurrence.id }); }); });
    }
    function renderText(parent, candidate, draft, key) {
      var nickname = append(parent, "p", "notebook-editor-nickname", candidate.nickname); nickname.dataset.editorSummary = "nickname"; nickname.hidden = !candidate.nickname;
      var notes = append(parent, "p", "notebook-editor-personal-notes", candidate.notes); notes.dataset.editorSummary = "notes"; notes.hidden = !candidate.notes;
      if (!draft) { return; }
      var box = details(parent, "Nickname & personal notes", key + ":personal", false);
      textField(box, "Nickname", candidate.nickname, "nickname", false, function (value) { if (draftFor(draft.chordId).candidate.nickname !== value) { patch(draft.chordId, { nickname: value }); } });
      textField(box, "Chord notes", candidate.notes, "notes", true, function (value) { if (draftFor(draft.chordId).candidate.notes !== value) { patch(draft.chordId, { notes: value }); } });
    }
    function renderDraftActions(parent, draft, source, key) {
      var settingsStale = changedSettings(draft), sourceStale = changedSource(draft, source), candidate = draft.candidate;
      var highFrets = candidate.frets && candidate.frets.some(function (fret) { return fret !== null && fret + view.song.capo > 24; });
      if (settingsStale) {
        var settingsWarning = append(parent, "div", "notebook-editor-warning");
        append(settingsWarning, "p", "", "This draft uses its original tuning and capo " + draft.capo + ". Song settings have changed. Review it before applying.");
        append(settingsWarning, "p", "", "Draft tuning: " + draft.tuningMidi.map(pitchLabel).join(" · ") + ". Current tuning: " + view.song.tuningMidi.map(pitchLabel).join(" · ") + " · capo " + view.song.capo + ".");
        if (highFrets) { append(settingsWarning, "p", "", "Some draft frets would exceed physical fret 24. Adjust those frets before reviewing the new settings."); }
        button(settingsWarning, "Review with current tuning & capo", "review-settings", function () { send({ type: "draft.rebase", chordId: draft.chordId }); }, { disabled: highFrets });
      }
      if (sourceStale) {
        var sourceWarning = append(parent, "div", "notebook-editor-warning");
        append(sourceWarning, "p", "", source ? "The shared chord changed after this draft was opened. Reopen the current version or save this draft as a variation." : "The original chord was deleted. You can save this draft as a new variation in the collection.");
        if (source) { button(sourceWarning, "Reopen current chord", "reopen-source", function () { send({ type: "draft.reopen", chordId: draft.chordId }); }); }
      }
      var locations = draft.chordId === null ? [] : usage(view.song, draft.chordId);
      if (draft.chordId !== null) {
        append(parent, "p", "notebook-editor-hint", "Updating this shared chord changes " + locations.length + " " + (locations.length === 1 ? "occurrence" : "occurrences") + ". Your preview is unapplied until you choose.");
        var origin = originInfo(draft);
        append(parent, "p", "notebook-editor-origin", draft.originOccurrenceId === null ? "A variation will stay in the collection; no occurrence will be changed." : origin.valid ? "Variation target: " + (origin.section.name || "Untitled section") + ", chord " + (origin.index + 1) + ". Only this occurrence will change." : "The original occurrence is no longer available. A variation will stay in the collection; nothing will be replaced.");
        var selectedSection = view.song.sections.find(function (section) { return section.id === view.activeSectionId; });
        var selected = selectedSection && selectedSection.occurrences.find(function (occurrence) { return occurrence.id === view.selectedOccurrenceId && occurrence.chordId === draft.chordId; });
        if (selected && (draft.originSectionId !== selectedSection.id || draft.originOccurrenceId !== selected.id)) { button(parent, "Use selected occurrence for variation", "retarget", function () { send({ type: "draft.retarget", chordId: draft.chordId, sectionId: selectedSection.id, occurrenceId: selected.id }); }); }
      }
      if (view.song.context && view.song.context.sourceChordId === draft.chordId && candidate.interpretation && !candidate.reviewRequired && (view.song.context.tonicPc !== candidate.interpretation.rootPc || view.song.context.tonicSpelling !== candidate.interpretation.rootSpelling)) { append(parent, "p", "notebook-editor-warning", "Updating this home chord will change the song home from " + view.song.context.tonicSpelling + " to " + candidate.interpretation.rootSpelling + "."); }
      var actions = append(parent, "div", "notebook-editor-actions"), empty = !hasShape(candidate) && !candidate.interpretation;
      var disabled = empty || settingsStale;
      if (draft.chordId === null) {
        button(actions, "Keep chord", "keep", function () { send({ type: "draft.apply", chordId: null, mode: "keep" }); }, { primary: true, disabled: disabled });
        var active = view.song.sections.find(function (section) { return section.id === view.activeSectionId; });
        if (active) { button(actions, "Keep & add to " + (active.name || "Untitled section"), "keep-add", function () { send({ type: "draft.apply", chordId: null, mode: "keep", addToSectionId: active.id }); }, { disabled: disabled }); }
      } else {
        button(actions, "Update shared chord", "update", function () { send({ type: "draft.apply", chordId: draft.chordId, mode: "update" }); }, { primary: true, disabled: disabled || sourceStale });
        button(actions, "Save as variation", "variation", function () { send({ type: "draft.apply", chordId: draft.chordId, mode: "variation" }); }, { disabled: disabled });
      }
      button(actions, "Cancel draft", "discard", function () { send({ type: "draft.discard", chordId: draft.chordId }); });
      if (empty) { append(parent, "p", "notebook-editor-hint", "Choose a sounding string or a chord name to Keep. This unfinished draft is saved separately."); }
    }
    function updateTextOnly(draft) {
      if (!draft) { return; }
      var heading = root.querySelector(".notebook-editor-chord-name"); if (heading) { heading.textContent = name(draft.candidate, draft.chordId === null ? "Unnamed shape" : "Chord " + (view.song.chords.findIndex(function (chord) { return chord.id === draft.chordId; }) + 1)); }
      ["nickname", "notes"].forEach(function (key) {
        var summary = root.querySelector('[data-editor-summary="' + key + '"]'); if (summary) { summary.textContent = draft.candidate[key]; summary.hidden = !draft.candidate[key]; }
        var field = root.querySelector('[data-editor-key="' + key + '"]'); if (field && field !== document.activeElement) { field.value = draft.candidate[key]; }
      });
    }
    function render(snapshot) {
      if (destroyed) { return; }
      view = snapshot;
      // A completed or discarded draft must not choose the input mode for the
      // next new chord. Resuming an existing draft keeps its chosen mode.
      if (!view.drafts.some(function (item) { return item.chordId === null && item.songId === view.song.id; })) { delete editingMode[view.song.id + ":new"]; }
      var draft = draftFor(view.inspectedChordId), source = sourceFor(view.inspectedChordId);
      // Text commits and save-status renders preserve the live form nodes, so a
      // blur commit cannot remove the button the user is about to click.
      var structuralDrafts = view.drafts.map(function (value) { return Object.assign({}, value, { candidate: value.chordId === view.inspectedChordId ? Object.assign({}, value.candidate, { nickname: "", notes: "" }) : value.candidate }); });
      var nextKey = JSON.stringify([view.song, view.activeSectionId, view.selectedOccurrenceId, view.inspectedChordId, view.inspectionOrigin, view.panel, view.mode, structuralDrafts]);
      if (nextKey === renderKey) { updateTextOnly(draft); message(localError); return; }
      renderKey = nextKey;
      var focused = document.activeElement, focusKey = focused && root.contains(focused) && focused.dataset.editorKey;
      var scroll = root.querySelector(".notebook-editor-neck-scroll"), scrollLeft = scroll ? scroll.scrollLeft : 0;
      root.textContent = ""; errorNode = null;
      root.hidden = view.mode === "read" || (view.panel !== "editor" && !view.drafts.some(function (item) { return item.songId === view.song.id; }));
      if (root.hidden) { return; }
      if (view.panel !== "editor") { renderShelf(root, null, true); return; }
      var key = view.song.id + ":" + (view.inspectedChordId === null ? "new" : view.inspectedChordId);
      var header = append(root, "div", "notebook-editor-header");
      append(header, "h2", "", draft ? (draft.chordId === null ? "New chord" : "Chord details · draft") : "Chord details");
      button(header, "Close details", "close", function () { send({ type: "panel.set", panel: null }); });
      renderShelf(root, view.inspectedChordId, false);
      errorNode = append(root, "p", "notebook-editor-error"); errorNode.setAttribute("role", "alert"); message(localError);
      if (!draft && !source) {
        append(root, "p", "", "Capture a shape or choose a chord name. No setup needed."); button(root, "New chord", "new", function () { send({ type: "draft.open", chordId: null }); }); return;
      }
      var candidate = draft ? draft.candidate : source, settings = draft || view.song;
      append(root, "h3", "notebook-editor-chord-name", name(candidate, source ? "Chord " + (view.song.chords.indexOf(source) + 1) : "Unnamed shape"));
      if (candidate.interpretation && !candidate.reviewRequired && hasShape(candidate) && settings.capo) { append(root, "p", "notebook-editor-sounding", music.formatInterpretation(music.transposeInterpretation(candidate.interpretation, -settings.capo)) + " shape · sounds " + music.formatInterpretation(candidate.interpretation) + " · capo " + settings.capo); }
      if (candidate.reviewRequired) {
        append(root, "p", "notebook-editor-warning", "Name needs review" + (candidate.previousInterpretation ? ": previously " + music.formatInterpretation(candidate.previousInterpretation) : "") + ". Accept a current interpretation or keep the shape unnamed.");
        if (draft && candidate.interpretation) { button(root, "Accept " + music.formatInterpretation(candidate.interpretation) + " as sounding name", "accept-previous", function () { patch(draft.chordId, acceptedPatch(candidate.interpretation)); }); }
      }
      renderText(root, candidate, draft, key);
      if (draft) {
        var mode = editingMode[key] || (candidate.frets === null ? "name" : "shape"), switcher = append(root, "div", "notebook-editor-mode");
        ["shape", "name"].forEach(function (value) { var control = button(switcher, value === "shape" ? "Shape" : "Chord name", "mode-" + value, function () { editingMode[key] = value; refresh(); }); control.setAttribute("aria-pressed", String(mode === value)); });
        if (mode === "shape") { renderFrets(root, candidate, settings, true, draft.chordId, key); } else { renderNameEntry(root, draft, key); }
        renderInterpretations(root, draft, settings, key);
      } else {
        if (hasShape(candidate)) { renderFrets(root, candidate, settings, false, source.id, key); }
        var origin = view.inspectionOrigin;
        if (origin) {
          var location = usage(view.song, source.id).find(function (item) { return item.section.id === origin.sectionId && item.occurrence.id === origin.occurrenceId; });
          if (location) { append(root, "p", "notebook-editor-origin", "Opened from " + (location.section.name || "Untitled section") + ", chord " + (location.index + 1) + "."); }
        }
        button(root, "Edit chord", "edit", function () { send({ type: "draft.open", chordId: source.id, originSectionId: origin ? origin.sectionId : null, originOccurrenceId: origin ? origin.occurrenceId : null }); });
      }
      if (!hasShape(candidate)) { append(root, "p", "notebook-editor-hint", "Fingering not set"); }
      renderNotes(root, candidate, settings, key);
      if (view.inspectedChordId !== null) { renderUsage(root, view.inspectedChordId, key); }
      if (draft) { renderDraftActions(root, draft, source, key); }
      if (source && source.interpretation && !source.reviewRequired) { button(root, "Use committed chord as home", "home", function () { send({ type: "context.set", context: { tonicPc: source.interpretation.rootPc, tonicSpelling: source.interpretation.rootSpelling, sourceChordId: source.id, scaleId: view.song.context ? view.song.context.scaleId : null } }); }); }
      var nextScroll = root.querySelector(".notebook-editor-neck-scroll"); if (nextScroll) { nextScroll.scrollLeft = scrollLeft; }
      if (focusKey) { var replacement = Array.from(root.querySelectorAll("[data-editor-key]")).find(function (node) { return node.dataset.editorKey === focusKey; }); if (replacement && !replacement.disabled) { if (replacement.classList.contains("notebook-editor-note")) { root.querySelectorAll(".notebook-editor-note").forEach(function (node) { node.tabIndex = -1; }); replacement.tabIndex = 0; } replacement.focus({ preventScroll: true }); } }
    }
    function destroy() { destroyed = true; view = null; root.textContent = ""; root.hidden = true; root.classList.remove("notebook-editor"); editingMode = {}; expanded = {}; showAll = {}; }
    return { render: render, destroy: destroy };
  }
  return { mount: mount };
}));
