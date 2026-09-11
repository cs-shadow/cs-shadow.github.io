(function (root, factory) {
  "use strict";
  var api = factory();
  if (typeof module === "object" && module.exports) { module.exports = api; }
  else { root.MusicToolControls = api; }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  function pc(value) { return ((value % 12) + 12) % 12; }
  function node(document, tag, text, attributes) {
    var element = document.createElement(tag);
    if (text !== null) { element.textContent = text; }
    Object.keys(attributes || {}).forEach(function (key) { element.setAttribute(key, attributes[key]); });
    return element;
  }
  function button(document, options, key, text, className, action) {
    var attributes = { type: "button", class: className };
    attributes[options.keyAttribute || "data-tuning-key"] = key;
    var element = node(document, "button", text, attributes);
    element.addEventListener("click", action);
    return element;
  }
  function pressed(element, value) { element.setAttribute("aria-pressed", String(value)); }

  // Values are ordered string 1 through 6. Hosts own state and call update
  // synchronously from onChange; these controls never write to storage.
  // Presets: [{id, label, values: number[]}]. Values may be PCs or MIDI notes.
  function mountPresets(host, options) {
    var document = host.ownerDocument, buttons = [], active = true;
    var group = node(document, "div", null, { class: "music-tuning-presets", role: "group", "aria-label": "Tuning presets" });
    var name = options.noteName || function (value) { return NOTES[pc(value)]; };
    options.presets.forEach(function (preset) {
      var tile = button(document, options, "preset-" + preset.id, null, "music-tuning-preset", function () {
        if (active) { options.onChange(preset.values.slice(), preset.id); }
      });
      tile.setAttribute("aria-label", preset.label + " tuning");
      tile.appendChild(node(document, "strong", preset.label));
      tile.appendChild(node(document, "span", preset.values.slice().reverse().map(name).join(" · "), { class: "music-preset-notes" }));
      group.appendChild(tile); buttons.push(tile);
    });
    host.appendChild(group);
    function update(values) {
      if (!active) { return; }
      options.presets.forEach(function (preset, index) {
        pressed(buttons[index], preset.values.length === values.length && preset.values.every(function (value, i) { return value === values[i]; }));
      });
    }
    update(options.values);
    return { update: update, destroy: function () { active = false; group.remove(); } };
  }

  // Separate hosts allow badges to sit beside a neck and the picker below it.
  // options: {id, values, midi?, noteName?, keyAttribute?, onChange(values)}.
  // MIDI note changes preserve the host's register; only pitch is editable.
  // update preserves mounted nodes, selected string, and keyboard focus.
  function mountStringNotes(badgeHost, pickerHost, options) {
    var document = badgeHost.ownerDocument, values = options.values.slice();
    var selected = null, active = true, badges = [], pitches = [], notes = [];
    var name = options.noteName || function (value) { return NOTES[pc(value)]; };
    function pitch(value) { return name(value) + (options.midi ? Math.floor(value / 12) - 1 : ""); }
    var badgeGroup = node(document, "div", null, { class: "music-string-badges", role: "group", "aria-label": "String tuning" });
    var picker = node(document, "div", null, { id: options.id, class: "music-note-picker", role: "region", "aria-labelledby": options.id + "-title" });
    var title = node(document, "h3", "", { id: options.id + "-title" }); picker.appendChild(title);
    function change(value) {
      if (!active || selected === null || value < 0 || value > (options.midi ? 127 : 11)) { return; }
      var next = values.slice(); next[selected] = value; options.onChange(next);
    }
    values.forEach(function (_, index) {
      var badge = button(document, options, "string-" + index, null, "music-string-badge", function () {
        if (!active) { return; }
        selected = index; refresh(); notes[pc(values[index])].focus();
      });
      badge.setAttribute("aria-controls", options.id);
      badge.appendChild(node(document, "span", String(index + 1), { class: "music-string-number" }));
      var label = node(document, "strong", "", { class: "music-string-pitch" });
      badge.appendChild(label); badgeGroup.appendChild(badge); badges.push(badge); pitches.push(label);
    });
    var noteGroup = node(document, "div", null, { class: "music-note-options", role: "group", "aria-label": "String note" });
    NOTES.forEach(function (_, notePc) {
      var choice = button(document, options, "note-" + notePc, name(notePc), "music-note-option", function () {
        if (selected !== null) { change(options.midi ? Math.floor(values[selected] / 12) * 12 + notePc : notePc); }
      });
      notes.push(choice); noteGroup.appendChild(choice);
    });
    picker.appendChild(noteGroup);
    function close() {
      if (!active || selected === null) { return; }
      var previous = selected; selected = null; refresh(); badges[previous].focus();
    }
    picker.appendChild(button(document, options, "picker-done", "Done", "", close));
    function keyboard(event) { if (event.key === "Escape" && selected !== null) { event.preventDefault(); close(); } }
    picker.addEventListener("keydown", keyboard);
    badgeHost.appendChild(badgeGroup); pickerHost.appendChild(picker);
    function refresh() {
      values.forEach(function (value, index) {
        pitches[index].textContent = pitch(value);
        badges[index].setAttribute("aria-label", "String " + (index + 1) + ", " + pitch(value) + ", edit tuning");
        badges[index].setAttribute("aria-expanded", String(selected === index));
      });
      picker.hidden = selected === null;
      if (selected === null) { return; }
      var value = values[selected];
      title.textContent = "String " + (selected + 1) + " · " + pitch(value);
      picker.setAttribute("aria-label", "Edit string " + (selected + 1) + " tuning");
      notes.forEach(function (choice, notePc) {
        pressed(choice, pc(value) === notePc);
        choice.disabled = !!options.midi && Math.floor(value / 12) * 12 + notePc > 127;
      });
    }
    refresh();
    return {
      update: function (next) { if (active) { values = next.slice(); refresh(); } },
      close: close,
      destroy: function () { active = false; picker.removeEventListener("keydown", keyboard); badgeGroup.remove(); picker.remove(); }
    };
  }
  return { mountPresets: mountPresets, mountStringNotes: mountStringNotes };
}));
