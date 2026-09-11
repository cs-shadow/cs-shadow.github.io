(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookExplore = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function mount(hosts, api) {
    var root = hosts.root, doc = root.ownerDocument, music = api.music;
    var view = null, destroyed = false, request = null, voicings = null;
    var matchCache = null, browseCache = null, visibleMatches = 8, error = "", notice = "", songId = null;
    var prefix = (root.id || "notebook-explore") + "-";
    var groups = [{ id: "triads", label: "Triads & power chords" }, { id: "sevenths", label: "Sevenths" },
      { id: "added", label: "Suspended, added-note & sixth chords" }, { id: "extended", label: "Extended & altered chords" }];
    function el(tag, key, attrs, children) { return { tag: tag, key: key, attrs: attrs || {}, children: (children || []).filter(function (child) { return child !== null && child !== false; }) }; }
    function text(tag, key, value, className) { return el(tag, key, { class: className || "" }, [String(value)]); }
    function button(key, label, handler, attrs) { return el("button", key, Object.assign({ type: "button", onclick: function () { if (!destroyed) { handler(); } }, "data-explore-key": key }, attrs || {}), [label]); }
    function action(key, label, value, attrs) { return button(key, label, function () { send(value); }, attrs); }
    function detail(key, label, children, initiallyOpen) { return el("details", key, initiallyOpen ? { defaultOpen: true } : {}, [text("summary", key + "-summary", label)].concat(children)); }
    // Stable keys preserve native focus and disclosure state during store saves
    // and async search completion, without keeping a second copy of song data.
    function patch(parent, children) {
      var oldNodes = Array.from(parent.childNodes);
      children.forEach(function (item, index) {
        var isText = typeof item === "string";
        var node = oldNodes.find(function (candidate) { return isText ? candidate.nodeType === 3 && candidate === oldNodes[index] : candidate.nodeType === 1 && candidate._exploreKey === item.key && candidate.localName === item.tag; });
        if (!node) { node = isText ? doc.createTextNode(item) : doc.createElement(item.tag); }
        if (isText) { if (node.nodeValue !== item) { node.nodeValue = item; } }
        else {
          node._exploreKey = item.key;
          var oldAttrs = node._exploreAttrs || {};
          Object.keys(oldAttrs).forEach(function (name) { if (!(name in item.attrs)) { if (name.slice(0, 2) === "on") { node[name] = null; } else { node.removeAttribute(name); } } });
          Object.keys(item.attrs).forEach(function (name) {
            var value = item.attrs[name];
            if (name.slice(0, 2) === "on") { node[name] = value; }
            else if (name === "value") { /* Select values follow their options. */ }
            else if (name === "defaultOpen") { if (!("defaultOpen" in oldAttrs)) { node.open = true; } }
            else if (value === false || value === null) { node.removeAttribute(name); }
            else { node.setAttribute(name, value === true ? "" : String(value)); }
          });
          patch(node, item.children);
          if (Object.prototype.hasOwnProperty.call(item.attrs, "value") && node.value !== String(item.attrs.value)) { node.value = String(item.attrs.value); }
          node._exploreAttrs = item.attrs;
        }
        if (parent.childNodes[index] !== node) { parent.insertBefore(node, parent.childNodes[index] || null); }
      });
      while (parent.childNodes.length > children.length) { parent.removeChild(parent.lastChild); }
    }
    function focus(key) { var node = root.querySelector('[data-explore-key="' + key + '"]'); if (node) { node.focus(); } }
    function send(value) {
      if (destroyed) { return false; }
      error = ""; notice = "";
      var result = api.dispatch(value);
      if (result && result.error) { error = result.error.message; }
      render(view);
      return !(result && result.error);
    }
    function set(patchValue) { return send({ type: "explore.set", patch: patchValue }); }
    function revealPreview() {
      var window = doc.defaultView;
      if (!window || !window.matchMedia("(max-width: 799px)").matches) { return; }
      var preview = root.querySelector('[data-explore-key="chord-preview"]');
      var heading = preview && preview.querySelector("h3");
      if (!heading) { return; }
      var bounds = heading.getBoundingClientRect();
      if (bounds.top < 0 || bounds.bottom > window.innerHeight) {
        heading.scrollIntoView({ behavior: "instant", block: "start", inline: "nearest" });
      }
    }
    function scale(id) { return music.scales.find(function (entry) { return entry.id === id; }); }
    function chordLabel(chord) {
      var identity = music.formatInterpretation(chord.interpretation);
      var label = identity || chord.nickname || "Chord " + (view.song.chords.indexOf(chord) + 1);
      if (identity && chord.nickname) { label += " · " + chord.nickname; }
      return label + (chord.reviewRequired ? " (name needs review)" : "");
    }
    function pitches(values, interpretation, spelling) {
      return values.map(function (pc) {
        if (interpretation && pc === interpretation.rootPc) { return interpretation.rootSpelling; }
        if (interpretation && pc === interpretation.bassPc) { return interpretation.bassSpelling; }
        return music.pitchName(pc, (spelling || "").includes("b"));
      }).join(" · ");
    }
    function controls(key, label, values, selected, onchange) {
      return el("label", key + "-label", { class: "notebook-explore-field", for: prefix + key }, [text("span", key + "-label-text", label),
        el("select", key, { id: prefix + key, "data-explore-key": key, value: selected, onchange: onchange }, values.map(function (value) {
          return el("option", key + "-" + value.id, { value: value.id }, [value.label]);
        }))]);
    }
    function useScale(tonicPc, tonicSpelling, scaleId) {
      if (send({ type: "context.set", context: { tonicPc: tonicPc, tonicSpelling: tonicSpelling, scaleId: scaleId, sourceChordId: null } })) {
        notice = "Song home and scale set to " + tonicSpelling + " " + scale(scaleId).name + "."; render(view);
      }
    }
    function searchKey(snapshot) {
      var state = snapshot.exploreState;
      return JSON.stringify([snapshot.song.id, state.selectedInterpretation, snapshot.song.tuningMidi, snapshot.song.capo, state.voicingMode]);
    }
    function searchVisible(snapshot) { return snapshot.panel === "explore" && snapshot.mode !== "read" && snapshot.exploreState.tab === "browse" && !!snapshot.exploreState.selectedInterpretation; }
    function abort() { if (request) { request.controller.abort(); request = null; } }
    function search() {
      if (!searchVisible(view)) { return; }
      abort();
      var key = searchKey(view), controller = new AbortController();
      var pending = { key: key, controller: controller };
      var interpretation = view.exploreState.selectedInterpretation;
      var settings = { tuningMidi: view.song.tuningMidi.slice(), capo: view.song.capo }, mode = view.exploreState.voicingMode;
      request = pending; voicings = null; error = "";
      Promise.resolve().then(function () {
        if (controller.signal.aborted) { return { shapes: [], cancelled: true }; }
        return music.findVoicings(interpretation, settings, { mode: mode, signal: controller.signal });
      }).then(function (result) {
        if (destroyed || request !== pending || controller.signal.aborted || !searchVisible(view) || searchKey(view) !== key) { return; }
        request = null;
        voicings = { key: key, shapes: result.cancelled ? [] : result.shapes, error: result.cancelled ? "Fingering search stopped. Try again, or keep the chord without a fingering." : "" };
        render(view);
      }).catch(function () {
        if (destroyed || request !== pending || controller.signal.aborted) { return; }
        request = null; voicings = { key: key, shapes: [], error: "Fingerings could not be searched. Try again, or keep the chord without a fingering." }; render(view);
      });
    }
    function shapeText(frets) { return frets.slice().reverse().map(function (fret) { return fret === null ? "×" : String(fret); }).join(" · "); }
    function shapePreview(frets) {
      var notes = music.notesForShape(view.song.tuningMidi, view.song.capo, frets);
      var stringOrder = frets.map(function (_, index) { return index; }).reverse();
      return el("table", "selected-shape", { class: "notebook-explore-shape" }, [
        text("caption", "selected-shape-caption", "Selected fingering · frets relative to capo " + view.song.capo),
        el("thead", "selected-shape-head", {}, [el("tr", "selected-shape-head-row", {}, [text("th", "selected-shape-label", "String")].concat(stringOrder.map(function (index) { return el("th", "shape-string-" + index, { scope: "col" }, [String(index + 1)]); })))]),
        el("tbody", "selected-shape-body", {}, [
          el("tr", "selected-shape-frets", {}, [el("th", "shape-frets-label", { scope: "row" }, ["Fret"])].concat(stringOrder.map(function (index) { return text("td", "shape-fret-" + index, frets[index] === null ? "Mute" : frets[index]); }))),
          el("tr", "selected-shape-tones", {}, [el("th", "shape-tones-label", { scope: "row" }, ["Sounds"])].concat(stringOrder.map(function (index) { var note = notes.find(function (item) { return item.stringIndex === index; }); return text("td", "shape-tone-" + index, note ? music.pitchName(note.pc, view.exploreState.tonicSpelling.includes("b")) + (Math.floor(note.midi / 12) - 1) : "—"); })))])]);
    }
    function preview() {
      var state = view.exploreState, interpretation = state.selectedInterpretation;
      if (!interpretation) { return text("p", "select-help", "Select a chord to see its tones, keep it, or find a fingering.", "notebook-explore-hint"); }
      var symbol = music.formatInterpretation(interpretation), currentScale = scale(state.scaleId);
      var section = view.song.sections.find(function (entry) { return entry.id === view.activeSectionId; }) || view.song.sections[0];
      var cache = voicings && voicings.key === searchKey(view) ? voicings : null;
      function keep(add) {
        var payload = { type: "explore.keep", interpretation: interpretation, frets: state.selectedFrets ? state.selectedFrets.slice() : null };
        if (add) { payload.sectionId = section.id; }
        if (send(payload)) { notice = symbol + (add ? " kept and added to " + (section.name || "Untitled section") : " kept in your chord collection") + "."; render(view); }
      }
      var relation = music.romanLabel(interpretation, { tonicPc: state.tonicPc, tonicSpelling: state.tonicSpelling, scaleId: state.scaleId, sourceChordId: null });
      return el("section", "chord-preview", { class: "notebook-explore-preview", "aria-label": "Selected chord", "data-explore-key": "chord-preview" }, [
        text("h3", "preview-name", symbol),
        text("p", "preview-tones", "Tones: " + pitches(music.interpretationPitches(interpretation), interpretation, interpretation.rootSpelling)),
        text("p", "preview-relation", relation + " relative to " + state.tonicSpelling + " home · browsing " + currentScale.name, "notebook-explore-hint"),
        view.song.context ? text("p", "preview-song-relation", "Song home: " + music.romanLabel(interpretation, view.song.context) + " relative to " + view.song.context.tonicSpelling, "notebook-explore-hint") : null,
        detail("roman-legend", "About Roman labels", [text("p", "roman-legend-text", "Degrees use a fixed major-scale reference, with lowercase for minor and diminished chords. For example, with A home, Am is i and C is ♭III. These labels describe relationships, not a required chord function.")]),
        state.selectedFrets ? shapePreview(state.selectedFrets) : text("p", "no-fingering", "Fingering not set. You can keep this chord by name.", "notebook-explore-hint"),
        el("div", "keep-actions", { class: "notebook-explore-actions" }, [button("keep", "Keep chord", function () { keep(false); }), button("keep-add", "Keep & add to " + (section.name || "Untitled section"), function () { keep(true); })]),
        el("section", "fingerings", { class: "notebook-explore-fingerings", "aria-label": "Find a guitar fingering", "aria-busy": request ? "true" : "false" }, [
          text("h4", "fingerings-heading", "Find a guitar fingering"),
          controls("voicing-mode", "Fingering style", [{ id: "compact", label: "Compact · three adjacent strings" }, { id: "fuller", label: "Fuller · four or more strings" }], state.voicingMode, function (event) { set({ voicingMode: event.target.value }); }),
          el("div", "search-actions", { class: "notebook-explore-actions" }, [
            cache && cache.error ? button("retry-voicings", "Try again", function () { search(); render(view); }) : null,
            state.selectedFrets ? button("clear-fingering", "Use name only", function () { set({ selectedFrets: null }); }) : null]),
          el("p", "voicing-status", { role: "status", class: "notebook-explore-hint" }, [request ? "Searching for complete fingerings…" : cache && cache.error ? cache.error : cache ? cache.shapes.length ? cache.shapes.length + " fingerings found. Choose one to preview." : "No complete fingering fits this style and guitar setup. Try the other style, keep the name, or capture a shape manually." : ""]),
          cache && cache.shapes.length ? el("ul", "voicing-results", { class: "notebook-explore-voicings", "aria-label": "Fingerings, strings 6 through 1" }, cache.shapes.map(function (shape, index) {
            return el("li", "voicing-" + index, {}, [button("voicing-" + index, shapeText(shape.frets), function () { set({ selectedFrets: shape.frets.slice() }); }, { "aria-label": "Fingering " + (index + 1) + ", strings 6 through 1: " + shape.frets.slice().reverse().map(function (fret) { return fret === null ? "mute" : fret; }).join(", "), "aria-pressed": JSON.stringify(state.selectedFrets) === JSON.stringify(shape.frets) ? "true" : "false" }), text("span", "voicing-position-" + index, "Position " + shape.position, "notebook-explore-hint")]);
          })) : null,
          el("div", "manual-actions", { class: "notebook-explore-actions" }, [
            action("manual-shape", "Capture a shape manually", { type: "explore.capture", interpretation: interpretation }),
            view.drafts.some(function (draft) { return draft.chordId === null; }) ? action("resume-manual-draft", "Resume existing chord draft", { type: "draft.open", chordId: null }) : null])])]);
    }
    function browse() {
      var state = view.exploreState, currentScale = scale(state.scaleId);
      var key = JSON.stringify([state.tonicPc, state.tonicSpelling, state.scaleId]);
      if (!browseCache || browseCache.key !== key) { browseCache = { key: key, chords: music.chordsForScale(state.tonicPc, state.scaleId, state.tonicSpelling) }; }
      var results = browseCache.chords;
      var roots = music.roots.map(function (spelling) { return { id: spelling, label: spelling }; });
      if (!roots.some(function (entry) { return entry.id === state.tonicSpelling; })) { roots.push({ id: state.tonicSpelling, label: state.tonicSpelling }); }
      return [el("div", "browse-controls", { class: "notebook-explore-controls" }, [
        controls("browse-root", "Home note to explore", roots, state.tonicSpelling, function (event) {
          var interpretation = music.parseChordSymbol(event.target.value).interpretation;
          set({ tonicPc: interpretation.rootPc, tonicSpelling: interpretation.rootSpelling, selectedInterpretation: null });
        }),
        controls("browse-scale", "Scale or mode", music.scales.map(function (entry) { return { id: entry.id, label: entry.name }; }), state.scaleId, function (event) { set({ scaleId: event.target.value, selectedInterpretation: null }); })]),
        text("p", "scale-feel", currentScale.feel || "", "notebook-explore-hint"),
        text("p", "scale-tones", "Scale tones: " + pitches(currentScale.intervals.map(function (interval) { return music.normalizePitch(state.tonicPc + interval); }), { rootPc: state.tonicPc, rootSpelling: state.tonicSpelling }, state.tonicSpelling), "notebook-explore-hint"),
        button("use-browse-scale", "Use as song scale", function () { useScale(state.tonicPc, state.tonicSpelling, state.scaleId); }),
        text("p", "browse-help", "Browsing previews relationships. Your song’s home and scale change only when you choose Use as song scale.", "notebook-explore-hint"),
        el("div", "browse-columns", { class: "notebook-explore-columns" }, [
          el("div", "browse-groups", {}, groups.map(function (group) {
            var chords = results.filter(function (chord) { return chord.group === group.id; });
            return chords.length ? detail("group-" + group.id, group.label + " (" + chords.length + ")", [el("ul", "group-list-" + group.id, { class: "notebook-explore-chords" }, chords.map(function (chord, index) {
              return el("li", "result-" + group.id + "-" + index, {}, [button("result-" + group.id + "-" + index, chord.label, function () { if (set({ selectedInterpretation: chord.interpretation })) { revealPreview(); } }, { "aria-pressed": JSON.stringify(state.selectedInterpretation) === JSON.stringify(chord.interpretation) ? "true" : "false" })]);
            }))], group.id === "triads") : null;
          })), preview()])];
    }
    function matching() {
      var key = JSON.stringify([view.song.chords, view.song.tuningMidi, view.song.capo, view.song.context]);
      if (!matchCache || matchCache.key !== key) {
        matchCache = { key: key, result: music.matchScales(view.song.chords, { tuningMidi: view.song.tuningMidi, capo: view.song.capo }, view.song.context) };
        visibleMatches = 8;
      }
      var result = matchCache.result;
      function membershipText(member, flats) {
        var chord = view.song.chords.find(function (entry) { return entry.id === member.chordId; });
        var identity = chord.reviewRequired ? null : chord.interpretation;
        var spelling = identity ? identity.rootSpelling : flats;
        return chordLabel(chord) + (member.outside.length ? " · outside notes: " + pitches(member.outside, identity, spelling) : " · all tones fit") + " · tones: " + pitches(member.pitches, identity, spelling);
      }
      return [text("p", "match-help", "Compatibility across your whole chord collection, including unused chords and distinct fingerings. Repeated section occurrences do not add weight. These are suggestions, not a detected key.", "notebook-explore-hint"),
        result.excludedChordIds.length ? el("div", "excluded", { class: "notebook-explore-evidence" }, [text("h3", "excluded-heading", "Not included in matching"), text("p", "excluded-reason", "These entries have no accepted harmony or sounding shape to analyze."), el("ul", "excluded-list", {}, result.excludedChordIds.map(function (id) {
          var chord = view.song.chords.find(function (entry) { return entry.id === id; }); return text("li", "excluded-" + id, chordLabel(chord));
        }))]) : null,
        result.candidates.length ? text("p", "match-count", "Showing " + Math.min(visibleMatches, result.candidates.length) + " of " + result.candidates.length + " scale suggestions.", "notebook-explore-hint") : text("p", "match-empty", "Add a sounding shape or a named chord to find compatible scales."),
        !result.candidates.length ? action("match-new-chord", "New chord", { type: "draft.open", chordId: null }) : null,
        el("ol", "match-results", { class: "notebook-explore-matches" }, result.candidates.slice(0, visibleMatches).map(function (candidate) {
          var id = candidate.tonicPc + "-" + candidate.scaleId, label = candidate.tonicSpelling + " " + scale(candidate.scaleId).name;
          var outliers = candidate.memberships.filter(function (member) { return member.outside.length; });
          return el("li", "candidate-" + id, { class: "notebook-explore-candidate" }, [text("h3", "candidate-name-" + id, label),
            text("p", "candidate-fit-" + id, "Fits " + candidate.fitCount + " of " + candidate.totalCount + " chords"),
            outliers.length ? el("ul", "candidate-outliers-" + id, { class: "notebook-explore-outliers" }, outliers.map(function (member) { return text("li", "outlier-" + id + "-" + member.chordId, membershipText(member, candidate.tonicSpelling)); })) : text("p", "candidate-exact-" + id, "All analyzed chord tones fit.", "notebook-explore-hint"),
            el("div", "candidate-actions-" + id, { class: "notebook-explore-actions" }, [button("use-candidate-" + id, "Use as song scale", function () { useScale(candidate.tonicPc, candidate.tonicSpelling, candidate.scaleId); }, { "aria-label": "Use " + label + " as song scale" }),
              button("browse-candidate-" + id, "Browse chords", function () { set({ tab: "browse", tonicPc: candidate.tonicPc, tonicSpelling: candidate.tonicSpelling, scaleId: candidate.scaleId, selectedInterpretation: null }); focus("browse-root"); }, { "aria-label": "Browse chords in " + label })]),
            detail("candidate-memberships-" + id, "Chord-by-chord evidence", [el("ul", "candidate-membership-list-" + id, {}, candidate.memberships.map(function (member) { return text("li", "member-" + id + "-" + member.chordId, membershipText(member, candidate.tonicSpelling)); }))])]);
        })),
        visibleMatches < result.candidates.length ? button("more-matches", "Show more scale suggestions", function () { visibleMatches += 20; render(view); }) : null];
    }
    function render(snapshot) {
      if (destroyed || !snapshot || !snapshot.song) { return; }
      view = snapshot;
      if (songId !== view.song.id) { abort(); voicings = null; matchCache = null; notice = ""; error = ""; patch(root, []); songId = view.song.id; }
      if (request && (!searchVisible(view) || request.key !== searchKey(view))) { abort(); }
      if (searchVisible(view) && !request && (!voicings || voicings.key !== searchKey(view))) { search(); }
      root.classList.add("notebook-explore");
      root.hidden = view.panel !== "explore" || view.mode === "read";
      var focused = doc.activeElement;
      var tab = view.exploreState.tab;
      patch(root, [el("div", "heading", { class: "notebook-explore-header" }, [text("h2", "title", "Explore harmony"), action("close", "Close exploration", { type: "explore.close" })]),
        el("div", "tabs", { role: "tablist", "aria-label": "Exploration tools", class: "notebook-explore-actions" }, ["browse", "match"].map(function (name) {
          return button("tab-" + name, name === "browse" ? "Browse a scale" : "Find scales for my chords", function () { set({ tab: name }); }, { role: "tab", id: prefix + "tab-" + name, "aria-selected": name === tab ? "true" : "false", "aria-controls": prefix + "panel", tabindex: name === tab ? "0" : "-1", onkeydown: function (event) {
            if (["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) { event.preventDefault(); var next = event.key === "Home" ? "browse" : event.key === "End" ? "match" : tab === "browse" ? "match" : "browse"; set({ tab: next }); focus("tab-" + next); }
          } });
        })), el("p", "error", { role: "alert", class: "notebook-explore-error" }, [error]), el("p", "notice", { role: "status", class: "notebook-explore-hint" }, [notice]),
        el("div", "panel-" + tab, { id: prefix + "panel", role: "tabpanel", "aria-labelledby": prefix + "tab-" + tab }, tab === "browse" ? browse() : matching())]);
      if (focused && root.contains(focused) && doc.activeElement !== focused) { focused.focus(); }
      else if (focused && focused._exploreKey === "retry-voicings" && !root.contains(focused) && !root.hidden) { focus("voicing-mode"); }
    }
    function destroy() { if (destroyed) { return; } destroyed = true; abort(); view = null; voicings = null; matchCache = null; browseCache = null; patch(root, []); root.classList.remove("notebook-explore"); }
    return { render: render, destroy: destroy };
  }
  return Object.freeze({ mount: mount });
}));
