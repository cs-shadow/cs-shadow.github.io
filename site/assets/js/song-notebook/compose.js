(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookCompose = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  function mount(hosts, api) {
    var doc = hosts.sections.ownerDocument;
    var view = null, destroyed = false, deletion = null, localError = null;
    var lastSongId = null;
    var prefix = (hosts.sections.id || "notebook-sections") + "-compose-";

    function el(tag, key, attrs, children) {
      return { tag: tag, key: key, attrs: attrs || {}, children: (children || []).filter(function (child) { return child !== null && child !== false; }) };
    }
    function text(tag, key, value, className) { return el(tag, key, { class: className || "" }, [String(value)]); }
    function button(key, label, onClick, attrs) {
      return el("button", key, Object.assign({ type: "button", onclick: onClick }, attrs || {}), [label]);
    }
    function actionButton(key, label, action, attrs) { return button(key, label, function () { send(action); }, attrs); }

    // Keyed DOM updates keep focused fields, selection ranges and open disclosure
    // controls intact during synchronous controller renders and autosave updates.
    function patch(parent, children) {
      var previous = Array.from(parent.childNodes);
      children.forEach(function (item, index) {
        var string = typeof item === "string";
        var node = previous.find(function (candidate) {
          return string ? candidate.nodeType === 3 && candidate === previous[index] :
            candidate.nodeType === 1 && candidate._composeKey === item.key && candidate.localName === item.tag;
        });
        if (!node) { node = string ? doc.createTextNode(item) : doc.createElement(item.tag); }
        if (string) { if (node.nodeValue !== item) { node.nodeValue = item; } }
        else {
          node._composeKey = item.key;
          var oldAttrs = node._composeAttrs || {};
          Object.keys(oldAttrs).forEach(function (name) {
            if (!(name in item.attrs)) {
              if (name.slice(0, 2) === "on") { node[name] = null; }
              else { node.removeAttribute(name); }
            }
          });
          Object.keys(item.attrs).forEach(function (name) {
            var value = item.attrs[name];
            if (name.slice(0, 2) === "on") { node[name] = value; }
            else if (name === "value") { /* Apply after children for select elements. */ }
            else if (value === false || value === null) { node.removeAttribute(name); }
            else { node.setAttribute(name, value === true ? "" : String(value)); }
          });
          patch(node, item.children);
          if (Object.prototype.hasOwnProperty.call(item.attrs, "value") &&
              (!Object.prototype.hasOwnProperty.call(oldAttrs, "value") || oldAttrs.value !== item.attrs.value) && doc.activeElement !== node) {
            var value = String(item.attrs.value);
            if (node.value !== value) { node.value = value; }
          }
          node._composeAttrs = item.attrs;
        }
        if (parent.childNodes[index] !== node) { parent.insertBefore(node, parent.childNodes[index] || null); }
      });
      while (parent.childNodes.length > children.length) { parent.removeChild(parent.lastChild); }
    }
    function find(key) {
      var result = null;
      function visit(node) {
        if (node._composeKey === key) { result = node; }
        if (!result) { Array.from(node.childNodes).forEach(visit); }
      }
      Object.keys(hosts).forEach(function (name) { if (!result) { visit(hosts[name]); } });
      return result;
    }
    function focus(key) { var node = find(key); if (node) { node.focus(); } }
    function moveAndFocus(action, key, fallback, area) {
      if (send(action, area)) {
        var node = find(key);
        focus(node && node.getAttribute("disabled") === null ? key : fallback);
      }
    }
    function send(action, area) {
      localError = null;
      var result = api.dispatch(action);
      if (result && result.error) { localError = { area: area || "sections", message: result.error.message }; }
      render(view);
      return !(result && result.error);
    }
    function activeSection() { return view.song.sections.find(function (section) { return section.id === view.activeSectionId; }) || view.song.sections[0]; }
    function chordById(id) { return view.song.chords.find(function (chord) { return chord.id === id; }); }
    function chordLabel(chord) {
      return api.music.formatInterpretation(chord.interpretation) || chord.nickname || ("Chord " + (view.song.chords.indexOf(chord) + 1));
    }
    function sectionLabel(section) { return section.name || "Untitled section"; }
    function chordSummary(chord, key) {
      var label = chordLabel(chord);
      return [text("span", key + "-name", label, "notebook-compose-name"),
        chord.nickname && chord.nickname !== label ? text("span", key + "-nickname", chord.nickname, "notebook-compose-subtitle") : null,
        chord.reviewRequired ? text("span", key + "-review", "Name needs review", "notebook-compose-review") : null,
        !chord.reviewRequired && view.song.context && chord.interpretation ? text("span", key + "-roman", api.music.romanLabel(chord.interpretation, view.song.context), "notebook-compose-roman") : null];
    }
    function error(area) {
      return text("p", "error-" + area, localError && localError.area === area ? localError.message : "", "notebook-compose-error");
    }
    function field(key, label, tag, attrs) {
      var id = prefix + key;
      return el("label", key + "-label", { class: "notebook-compose-field", for: id }, [text("span", key + "-label-text", label), el(tag || "input", key, Object.assign({ id: id }, attrs), [])]);
    }
    function choices(key, label, values, selected, onchange) {
      return el("label", key + "-label", { class: "notebook-compose-field", for: prefix + key }, [text("span", key + "-label-text", label),
        el("select", key, { id: prefix + key, value: selected, onchange: onchange }, values.map(function (value) {
          return el("option", key + "-" + value.id, { value: value.id }, [value.label]);
        }))]);
    }
    function disclosure(key, label, children) {
      return el("details", key, {}, [text("summary", key + "-summary", label)].concat(children));
    }
    function usageForChord(chordId) {
      return view.song.sections.reduce(function (uses, section) {
        var count = section.occurrences.filter(function (occurrence) { return occurrence.chordId === chordId; }).length;
        if (count) { uses.push({ section: section, count: count }); }
        return uses;
      }, []);
    }
    function openDelete(kind, id, area) {
      deletion = { kind: kind, id: id, area: area };
      localError = null;
      render(view);
      focus("delete-cancel");
    }
    function deletePanel(area) {
      if (!deletion || deletion.area !== area) { return null; }
      var isChord = deletion.kind === "chord";
      var item = (isChord ? view.song.chords : view.song.sections).find(function (candidate) { return candidate.id === deletion.id; });
      if (!item) { deletion = null; return null; }
      var alternatives = (isChord ? view.song.chords : view.song.sections).filter(function (candidate) { return candidate.id !== item.id; });
      var usage = isChord ? usageForChord(item.id) : view.song.arrangement.filter(function (entry) { return entry.sectionId === item.id; });
      var count = isChord ? usage.reduce(function (total, entry) { return total + entry.count; }, 0) : usage.length;
      var description = isChord ? "Used " + count + " time" + (count === 1 ? "" : "s") + (count ? " in " + usage.map(function (entry) { return sectionLabel(entry.section) + " (" + entry.count + ")"; }).join(", ") : " in sections") + "." :
        "Used " + count + " time" + (count === 1 ? "" : "s") + " in song order. This section contains " + item.occurrences.length + " chord occurrence" + (item.occurrences.length === 1 ? "" : "s") + ".";
      function remove(mode) {
        var action = { type: deletion.kind + ".delete", referenceMode: mode };
        action[isChord ? "chordId" : "sectionId"] = item.id;
        if (mode === "replace") { action[isChord ? "replacementChordId" : "replacementSectionId"] = find("delete-replacement").value; }
        if (send(action, area)) { deletion = null; render(view); focus(isChord ? "new-chord" : "progression-input"); }
      }
      return el("div", "delete-panel", { class: "notebook-compose-delete", role: "group", "aria-label": "Delete " + (isChord ? chordLabel(item) : sectionLabel(item)) }, [
        text("strong", "delete-title", "Delete “" + (isChord ? chordLabel(item) : sectionLabel(item)) + "”?"),
        text("p", "delete-usage", description),
        !isChord && view.song.sections.length === 1 ? text("p", "delete-last", "An empty Section 1 will remain. Your chord collection is kept.") : null,
        count && alternatives.length ? choices("delete-replacement", "Replace references with", alternatives.map(function (candidate) { return { id: candidate.id, label: isChord ? chordLabel(candidate) : sectionLabel(candidate) }; }), alternatives[0].id) : null,
        count && alternatives.length ? button("delete-replace", "Replace references & delete", function () { remove("replace"); }) : null,
        button("delete-remove", count ? "Remove references & delete" : "Delete " + (isChord ? "chord" : "section"), function () { remove("remove"); }, { class: "notebook-compose-destructive" }),
        button("delete-cancel", "Cancel", function () { deletion = null; render(view); focus(isChord ? "chord-menu-" + item.id + "-summary" : "section-menu-summary"); })
      ]);
    }
    function collection() {
      var section = activeSection();
      var rows = view.song.chords.map(function (chord) {
        var key = "chord-" + chord.id;
        var uses = usageForChord(chord.id).reduce(function (total, entry) { return total + entry.count; }, 0);
        var draft = view.drafts.some(function (candidate) { return candidate.songId === view.song.id && candidate.chordId === chord.id; });
        var home = chord.interpretation && !chord.reviewRequired ? actionButton(key + "-home", "Set as home", { type: "context.set", context: {
          tonicPc: chord.interpretation.rootPc, tonicSpelling: chord.interpretation.rootSpelling,
          sourceChordId: chord.id, scaleId: view.song.context ? view.song.context.scaleId : null
        } }) : null;
        return el("li", key, { class: "notebook-compose-chord" }, [
          el("div", key + "-row", { class: "notebook-compose-chord-row" }, [
            el("button", key + "-inspect", { type: "button", class: "notebook-compose-inspect", "aria-label": "Inspect " + chordLabel(chord), onclick: function () { send({ type: "chord.inspect", chordId: chord.id }, "collection"); } }, chordSummary(chord, key)),
            actionButton(key + "-append", "+", { type: "occurrence.create", sectionId: section.id, chordId: chord.id, afterOccurrenceId: null }, { "aria-label": "Append " + chordLabel(chord) + " to " + sectionLabel(section), class: "notebook-compose-append" })
          ]),
          chord.notes ? text("p", key + "-notes", chord.notes, "notebook-compose-notes notebook-compose-subtitle") : null,
          draft ? actionButton(key + "-resume", "Resume draft", { type: "draft.open", chordId: chord.id }, { class: "notebook-compose-link" }) : null,
          disclosure("chord-menu-" + chord.id, "Chord actions", [text("p", key + "-usage", uses + " section occurrence" + (uses === 1 ? "" : "s"), "notebook-compose-muted"), home,
            button(key + "-delete", "Delete chord…", function () { openDelete("chord", chord.id, "collection"); })])
        ]);
      });
      return [text("h2", "collection-heading", "Chords in this song"),
        rows.length ? el("ul", "chord-list", { class: "notebook-compose-collection" }, rows) : text("p", "collection-empty", "Type chords in your section, capture a shape, or explore a scale.", "notebook-compose-muted"),
        el("div", "collection-entry", { class: "notebook-compose-actions" }, [
          actionButton("new-chord", "+ New chord", { type: "draft.open", chordId: null }),
          actionButton("explore", "Explore", { type: "panel.set", panel: "explore" }, { id: "notebook-explore-opener" })]),
        view.drafts.some(function (draft) { return draft.songId === view.song.id && draft.chordId === null; }) ? actionButton("resume-new", "Resume new chord draft", { type: "draft.open", chordId: null }, { class: "notebook-compose-link" }) : null,
        deletePanel("collection"), el("div", "collection-alert", { role: "alert" }, [error("collection")])];
    }
    function occurrenceControls(section, occurrence) {
      var key = "occurrence-controls-" + occurrence.id;
      var chord = chordById(occurrence.chordId);
      var index = section.occurrences.indexOf(occurrence);
      function act(type, extra) { return Object.assign({ type: "occurrence." + type, sectionId: section.id, occurrenceId: occurrence.id }, extra || {}); }
      function durationSubmit(event) {
        event.preventDefault();
        var raw = find("duration-value-" + occurrence.id).value;
        var value = Number(raw);
        if (!raw.trim() || !Number.isFinite(value) || value <= 0) {
          localError = { area: "sections", message: "Duration must be a positive, finite number of beats or bars." }; render(view); return;
        }
        send(act("update", { patch: { duration: { value: value, unit: find("duration-unit-" + occurrence.id).value } } }));
      }
      return el("div", key, { class: "notebook-compose-occurrence-controls", role: "group", "aria-label": "Selected " + chordLabel(chord) + " occurrence" }, [
        el("div", key + "-actions", { class: "notebook-compose-actions" }, [
          actionButton(key + "-details", "Chord details", { type: "chord.inspect", chordId: chord.id, sectionId: section.id, occurrenceId: occurrence.id }),
          button(key + "-left", "Move left", function () { moveAndFocus(act("move", { direction: -1 }), key + "-left", key + "-right"); }, { disabled: index === 0 }),
          button(key + "-right", "Move right", function () { moveAndFocus(act("move", { direction: 1 }), key + "-right", key + "-left"); }, { disabled: index === section.occurrences.length - 1 }),
          actionButton(key + "-duplicate", "Duplicate", act("duplicate")),
          button(key + "-remove", "Remove", function () { if (send(act("delete"))) { focus("progression-input"); } }),
          actionButton(key + "-close", "Done", { type: "selection.set", sectionId: section.id, occurrenceId: null })]),
        disclosure(key + "-replace", "Replace chord", [choices(key + "-replacement", "Chord for this occurrence", view.song.chords.map(function (candidate) { return { id: candidate.id, label: chordLabel(candidate) }; }), chord.id, function (event) { send(act("update", { patch: { chordId: event.target.value } })); })]),
        disclosure(key + "-duration", occurrence.duration ? "Edit duration" : "Add duration", [
          el("form", key + "-duration-form", { onsubmit: durationSubmit, novalidate: true, class: "notebook-compose-actions" }, [
            field("duration-value-" + occurrence.id, "Duration", "input", { type: "number", min: "0", step: "any", inputmode: "decimal", value: occurrence.duration ? occurrence.duration.value : "", placeholder: "e.g. 0.5" }),
            choices("duration-unit-" + occurrence.id, "Unit", [{ id: "beats", label: "Beats" }, { id: "bars", label: "Bars" }], occurrence.duration ? occurrence.duration.unit : "beats"),
            el("button", key + "-duration-save", { type: "submit" }, ["Save duration"]),
            occurrence.duration ? actionButton(key + "-duration-clear", "Clear duration", act("update", { patch: { duration: null } })) : null])]),
        disclosure(key + "-annotation", occurrence.annotation ? "Edit annotation" : "Add annotation", [field(key + "-annotation-input", "Annotation for this occurrence", "textarea", { rows: 2, value: occurrence.annotation, onblur: function (event) { if (event.target.value !== occurrence.annotation) { send(act("update", { patch: { annotation: event.target.value } })); } } })])
      ]);
    }
    function sections() {
      var section = activeSection();
      var selected = section.occurrences.find(function (occurrence) { return occurrence.id === view.selectedOccurrenceId; });
      var location = selected ? "Insert after " + chordLabel(chordById(selected.chordId)) + " (" + (section.occurrences.indexOf(selected) + 1) + ")" : "Add to " + sectionLabel(section);
      var tabs = view.song.sections.map(function (candidate) {
        return button("tab-" + candidate.id, sectionLabel(candidate), function () { send({ type: "selection.set", sectionId: candidate.id, occurrenceId: null }); }, {
          role: "tab", id: prefix + "tab-" + candidate.id, "aria-selected": candidate.id === section.id ? "true" : "false", "aria-controls": prefix + "section-panel", tabindex: candidate.id === section.id ? "0" : "-1",
          onkeydown: function (event) {
            var index = view.song.sections.indexOf(candidate), next;
            if (event.key === "ArrowRight") { next = (index + 1) % view.song.sections.length; }
            if (event.key === "ArrowLeft") { next = (index + view.song.sections.length - 1) % view.song.sections.length; }
            if (event.key === "Home") { next = 0; }
            if (event.key === "End") { next = view.song.sections.length - 1; }
            if (next !== undefined) { event.preventDefault(); var id = view.song.sections[next].id; send({ type: "selection.set", sectionId: id, occurrenceId: null }); focus("tab-" + id); }
          }
        });
      });
      var chips = section.occurrences.map(function (occurrence) {
        var chord = chordById(occurrence.chordId), key = "occurrence-" + occurrence.id;
        return el("li", key, {}, [el("button", key + "-select", { type: "button", class: "notebook-compose-chip", "aria-pressed": occurrence.id === view.selectedOccurrenceId ? "true" : "false",
          "aria-label": chordLabel(chord) + ", occurrence " + (section.occurrences.indexOf(occurrence) + 1),
          onclick: function () { send({ type: "selection.set", sectionId: section.id, occurrenceId: occurrence.id === view.selectedOccurrenceId ? null : occurrence.id }); }
        }, chordSummary(chord, key).concat([
          occurrence.duration ? text("span", key + "-duration", occurrence.duration.value + " " + (occurrence.duration.value === 1 ? occurrence.duration.unit.slice(0, -1) : occurrence.duration.unit), "notebook-compose-subtitle") : null,
          occurrence.annotation ? text("span", key + "-annotation", occurrence.annotation, "notebook-compose-notes notebook-compose-subtitle") : null
        ]))]);
      });
      function submit(event) {
        event.preventDefault();
        var input = find("progression-input"), value = input.value;
        if (!value.trim()) { focus("progression-input"); return; }
        if (send({ type: "progression.insert", sectionId: section.id, text: value, afterOccurrenceId: selected ? selected.id : null })) { input.value = ""; }
        focus("progression-input");
      }
      return [el("div", "section-header", { class: "notebook-compose-section-header" }, [
        el("div", "section-tabs", { role: "tablist", "aria-label": "Song sections", class: "notebook-compose-tabs" }, tabs),
        actionButton("section-add", "+", { type: "section.create" }, { "aria-label": "Add section" })]),
        el("div", "section-panel", { id: prefix + "section-panel", role: "tabpanel", "aria-labelledby": prefix + "tab-" + section.id }, [
          disclosure("section-menu", "Section actions", [
            field("section-name-" + section.id, "Section name", "input", { type: "text", value: section.name, onblur: function (event) { if (event.target.value !== section.name) { send({ type: "section.update", sectionId: section.id, patch: { name: event.target.value } }); } }, onkeydown: function (event) { if (event.key === "Enter") { event.preventDefault(); event.target.blur(); } } }),
            actionButton("section-duplicate", "Duplicate section", { type: "section.duplicate", sectionId: section.id }),
            button("section-delete", "Delete section…", function () { openDelete("section", section.id, "sections"); })]),
          chips.length ? el("ol", "occurrences-" + section.id, { class: "notebook-compose-occurrences", "aria-label": sectionLabel(section) + " chords" }, chips) : text("p", "section-empty", "Start with a few chords. Timing and fingerings can come later.", "notebook-compose-muted"),
          selected ? occurrenceControls(section, selected) : null,
          el("form", "progression-form", { onsubmit: submit, class: "notebook-compose-progression" }, [
            field("progression-input", "Add chords", "input", { type: "text", placeholder: "Am F C G…", autocomplete: "off", autocapitalize: "off", spellcheck: "false", "aria-describedby": prefix + "progression-location" }),
            el("button", "progression-submit", { type: "submit" }, [selected ? "Insert" : "Add"]),
            text("p", "progression-location", location, "notebook-compose-muted")]),
          el("div", "sections-alert", { role: "alert" }, [error("sections")]),
          section.notes ? text("p", "section-notes-" + section.id, section.notes, "notebook-compose-notes") : null,
          disclosure("section-notes-editor-" + section.id, section.notes ? "Edit section notes" : "Add section notes…", [field("section-notes-input-" + section.id, "Section notes", "textarea", { rows: 4, value: section.notes, onblur: function (event) { if (event.target.value !== section.notes) { send({ type: "section.update", sectionId: section.id, patch: { notes: event.target.value } }); } } })]),
          deletePanel("sections")])];
    }
    function arrangement() {
      var entries = view.song.arrangement;
      var summary = entries.map(function (entry) {
        var section = view.song.sections.find(function (candidate) { return candidate.id === entry.sectionId; });
        return sectionLabel(section) + (entry.repeatCount > 1 ? " × " + entry.repeatCount : "");
      }).join(" → ");
      return [entries.length ? text("p", "arrangement-summary", summary, "notebook-compose-order-summary") : null,
        disclosure("arrangement-editor", entries.length ? "Edit song order" : "Add song order", [
          text("p", "arrangement-help", "Add a section to song order. Editing a section updates every appearance.", "notebook-compose-muted"),
          el("div", "arrangement-add", { class: "notebook-compose-actions" }, view.song.sections.map(function (section) {
            return actionButton("arrangement-add-" + section.id, "+ " + sectionLabel(section), { type: "arrangement.create", sectionId: section.id });
          })),
          el("ol", "arrangement-list", { class: "notebook-compose-order" }, entries.map(function (entry, index) {
            var key = "arrangement-" + entry.id;
            function act(type, extra) { return Object.assign({ type: "arrangement." + type, arrangementId: entry.id }, extra || {}); }
            return el("li", key, {}, [
              choices(key + "-section", "Section " + (index + 1), view.song.sections.map(function (section) { return { id: section.id, label: sectionLabel(section) }; }), entry.sectionId, function (event) { send(act("update", { patch: { sectionId: event.target.value } }), "arrangement"); }),
              field(key + "-repeat", "Repeats", "input", { type: "number", min: "1", step: "1", value: entry.repeatCount, onblur: function (event) {
                var value = Number(event.target.value);
                if (!Number.isInteger(value) || value <= 0) { localError = { area: "arrangement", message: "Repeats must be a positive whole number." }; render(view); return; }
                if (value !== entry.repeatCount) { send(act("update", { patch: { repeatCount: value } }), "arrangement"); }
              } }),
              el("div", key + "-actions", { class: "notebook-compose-actions" }, [
                button(key + "-up", "Move up", function () { moveAndFocus(act("move", { direction: -1 }), key + "-up", key + "-down", "arrangement"); }, { disabled: index === 0, "aria-label": "Move song order entry " + (index + 1) + " up" }),
                button(key + "-down", "Move down", function () { moveAndFocus(act("move", { direction: 1 }), key + "-down", key + "-up", "arrangement"); }, { disabled: index === entries.length - 1, "aria-label": "Move song order entry " + (index + 1) + " down" }),
                button(key + "-remove", "Remove", function () { if (send(act("delete"), "arrangement")) { focus("arrangement-editor-summary"); } }, { "aria-label": "Remove song order entry " + (index + 1) })])
            ]);
          })), el("div", "arrangement-alert", { role: "alert" }, [error("arrangement")])])];
    }
    function render(snapshot) {
      if (destroyed || !snapshot || !snapshot.song) { return; }
      var focused = doc.activeElement;
      view = snapshot;
      if (lastSongId !== view.song.id) {
        Object.keys(hosts).forEach(function (name) { patch(hosts[name], []); });
        deletion = null; localError = null; lastSongId = view.song.id;
      }
      Object.keys(hosts).forEach(function (name) { hosts[name].classList.add("notebook-compose"); });
      patch(hosts.collection, collection().filter(Boolean));
      patch(hosts.sections, sections().filter(Boolean));
      patch(hosts.arrangement, arrangement().filter(Boolean));
      var location = find("progression-location");
      if (location) { location.id = prefix + "progression-location"; }
      if (focused && doc.activeElement !== focused && Object.keys(hosts).some(function (name) { return hosts[name].contains(focused); })) { focused.focus(); }
    }
    function destroy() {
      destroyed = true; view = null; deletion = null; localError = null;
      Object.keys(hosts).forEach(function (name) { patch(hosts[name], []); hosts[name].classList.remove("notebook-compose"); });
    }
    return { render: render, destroy: destroy };
  }
  return Object.freeze({ mount: mount });
}));
