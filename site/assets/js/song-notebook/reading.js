(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookReading = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var instance = 0;
  function mount(hosts, api) {
    var root = hosts.root, document = root.ownerDocument, music = api.music;
    var prefix = "notebook-reading-" + (++instance), previousSong = null, destroyed = false;
    root.classList.add("notebook-reading");
    function element(parent, tag, className, text) {
      var node = document.createElement(tag);
      if (className) { node.className = className; }
      if (text !== undefined) { node.textContent = text; }
      parent.appendChild(node); return node;
    }
    function svgNode(parent, tag, attributes, text) {
      var node = document.createElementNS("http://www.w3.org/2000/svg", tag);
      Object.keys(attributes || {}).forEach(function (key) { node.setAttribute(key, attributes[key]); });
      if (text !== undefined) { node.textContent = text; }
      parent.appendChild(node); return node;
    }
    function noteName(midi) { return music.pitchName(music.normalizePitch(midi)) + (Math.floor(midi / 12) - 1); }
    function chordName(chord, index) { return music.formatInterpretation(chord.interpretation) || "Chord " + (index + 1); }
    function sectionName(section, index) { return section.name || "Section " + (index + 1); }
    function multiline(parent, className, text) { if (text) { return element(parent, "p", "notebook-reading-notes " + className, text); } return null; }
    function shape(chord) { return chord.frets && chord.frets.some(function (fret) { return fret !== null; }); }
    function status(parent, chord) {
      if (chord.reviewRequired) { element(parent, "p", "notebook-reading-review", "Name needs review" + (chord.previousInterpretation ? " · previous name: " + music.formatInterpretation(chord.previousInterpretation) : "")); }
      else if (!chord.interpretation) { element(parent, "p", "notebook-reading-muted", "Unnamed shape"); }
    }
    function roman(parent, chord, context) {
      if (chord.interpretation && !chord.reviewRequired && context) {
        var label = music.romanLabel(chord.interpretation, context);
        if (label) { element(parent, "p", "notebook-reading-roman", label); }
      }
    }
    function diagram(parent, chord, song, label) {
      var positive = [...new Set(chord.frets.filter(function (fret) { return fret !== null && fret > 0; }))].sort(function (a, b) { return a - b; });
      var first = positive.length && positive[0] > 4 ? positive[0] : 1;
      var last = positive.length ? positive[positive.length - 1] : 0;
      var compressed = last - first > 5;
      var rows = compressed ? positive : Array.from({ length: Math.min(Math.max(4, last - first + 1), 24 - song.capo - first + 1) }, function (_, index) { return first + index; });
      var rowTop = [], cursor = 42, gaps = [];
      rows.forEach(function (fret, index) {
        if (index > 0 && fret > rows[index - 1] + 1) { gaps.push(cursor); cursor += 10; }
        rowTop.push(cursor); cursor += 23;
      });
      var figure = element(parent, "figure", "notebook-reading-diagram");
      var svg = svgNode(figure, "svg", { viewBox: "0 0 194 " + (cursor + 29), width: "194", height: String(cursor + 29), role: "img", "aria-label": "Fingering for " + label + ". " + chord.frets.map(function (fret, index) { return "String " + (index + 1) + (fret === null ? " muted" : fret === 0 ? " open at capo " + song.capo : ": relative fret " + fret + ", physical fret " + (fret + song.capo)); }).join("; ") });
      svgNode(svg, "text", { x: "104", y: "12", "text-anchor": "middle", class: "notebook-reading-diagram-label" }, "Strings 6 → 1");
      // Conventional diagram order is low string 6 at left, high string 1 right.
      for (var column = 0; column < 6; column += 1) {
        var stringIndex = 5 - column, x = 44 + column * 24, fret = chord.frets[stringIndex];
        svgNode(svg, "line", { x1: String(x), x2: String(x), y1: "42", y2: String(cursor), class: "notebook-reading-string", "stroke-width": column < 3 ? "1.4" : "1" });
        if (fret === null || fret === 0) { svgNode(svg, "text", { x: String(x), y: "32", "text-anchor": "middle", class: "notebook-reading-open-mark" }, fret === null ? "×" : "○"); }
        svgNode(svg, "text", { x: String(x), y: String(cursor + 18), "text-anchor": "middle", class: "notebook-reading-diagram-label" }, String(stringIndex + 1));
      }
      rows.forEach(function (fret, index) {
        var y = rowTop[index];
        svgNode(svg, "line", { x1: "44", x2: "164", y1: String(y), y2: String(y), class: "notebook-reading-fret", "stroke-width": fret === 1 && index === 0 ? "3" : "1" });
        svgNode(svg, "line", { x1: "44", x2: "164", y1: String(y + 23), y2: String(y + 23), class: "notebook-reading-fret", "stroke-width": "1" });
        svgNode(svg, "text", { x: "32", y: String(y + 16), "text-anchor": "end", class: "notebook-reading-diagram-label" }, String(fret));
        chord.frets.forEach(function (selected, stringIndex) {
          if (selected === fret) {
            var x = 44 + (5 - stringIndex) * 24;
            svgNode(svg, "circle", { cx: String(x), cy: String(y + 12), r: "8", class: "notebook-reading-dot", "data-string-index": String(stringIndex), "data-relative-fret": String(fret), "data-physical-fret": String(fret + song.capo) });
          }
        });
      });
      gaps.forEach(function (y) {
        svgNode(svg, "rect", { x: "42", y: String(y + 1), width: "124", height: "8", class: "notebook-reading-gap" });
        svgNode(svg, "path", { d: "M 42 " + (y + 7) + " l 30 -4 l 32 4 l 30 -4 l 32 4", class: "notebook-reading-gap-mark" });
      });
      var caption = element(figure, "figcaption");
      element(caption, "span", "notebook-reading-fret-caption", "Relative frets · " + (song.capo ? "capo " + song.capo : "no capo"));
      element(caption, "span", "notebook-reading-fret-values", "6 → 1: " + chord.frets.slice().reverse().map(function (fret) { return fret === null ? "×" : String(fret); }).join(" · "));
      if (compressed) { element(caption, "span", "notebook-reading-gap-caption", "Gaps between labeled frets are compressed."); }
    }
    function render(view) {
      if (destroyed) { return; }
      root.hidden = view.mode !== "read";
      if (root.hidden) { return; }
      var song = view.song, key = JSON.stringify(song);
      if (key === previousSong) { return; }
      previousSong = key; root.textContent = "";
      var sections = new Map(), chords = new Map(), used = new Set();
      song.sections.forEach(function (section, index) { sections.set(section.id, { record: section, index: index, anchor: prefix + "-section-" + index }); section.occurrences.forEach(function (occurrence) { used.add(occurrence.chordId); }); });
      song.chords.forEach(function (chord, index) { chords.set(chord.id, { record: chord, index: index, anchor: prefix + "-chord-" + index }); });
      var header = element(root, "header", "notebook-reading-header");
      element(header, "h1", "notebook-reading-title", song.title || "Untitled song");
      var preset = music.presets.find(function (item) { return item.tuningMidi.every(function (midi, index) { return midi === song.tuningMidi[index]; }); });
      element(header, "p", "notebook-reading-settings", (preset ? preset.label : "Custom") + " tuning · " + (song.capo ? "Capo " + song.capo : "No capo"));
      element(header, "p", "notebook-reading-tuning", "Tuning, strings 1–6: " + song.tuningMidi.map(noteName).join(" · "));
      if (song.context) {
        var scale = music.scales.find(function (item) { return item.id === song.context.scaleId; });
        element(header, "p", "notebook-reading-context", "Home: " + song.context.tonicSpelling + (scale ? " · " + scale.name : ""));
        if (song.context.sourceChordId) {
          var home = chords.get(song.context.sourceChordId), source = element(header, "p", "notebook-reading-home-source", "Home source: ");
          var link = element(source, "a", "", chordName(home.record, home.index)); link.setAttribute("href", "#" + home.anchor);
        }
      }
      multiline(header, "notebook-reading-song-notes", song.notes);
      if (song.arrangement.length) {
        var order = element(root, "section", "notebook-reading-order"); element(order, "h2", "", "Song order");
        var list = element(order, "ol", "notebook-reading-order-list");
        song.arrangement.forEach(function (entry) {
          var target = sections.get(entry.sectionId), item = element(list, "li");
          var link = element(item, "a", "", sectionName(target.record, target.index)); link.setAttribute("href", "#" + target.anchor);
          element(item, "span", "notebook-reading-repeat", " × " + entry.repeatCount);
        });
      }
      var definitions = element(root, "div", "notebook-reading-sections");
      song.sections.forEach(function (section, index) {
        var block = element(definitions, "section", "notebook-reading-section"); block.id = sections.get(section.id).anchor; block.dataset.sectionId = section.id;
        element(block, "h2", "", sectionName(section, index)); multiline(block, "notebook-reading-section-notes", section.notes);
        if (!section.occurrences.length) { element(block, "p", "notebook-reading-muted", "No chords in this section yet."); return; }
        var list = element(block, "ol", "notebook-reading-occurrences");
        section.occurrences.forEach(function (occurrence) {
          var entry = chords.get(occurrence.chordId), chord = entry.record, item = element(list, "li", "notebook-reading-occurrence"); item.dataset.occurrenceId = occurrence.id;
          var link = element(item, "a", "notebook-reading-chord-link", chordName(chord, entry.index)); link.setAttribute("href", "#" + entry.anchor);
          multiline(item, "notebook-reading-nickname", chord.nickname); roman(item, chord, song.context);
          if (chord.reviewRequired) { element(item, "p", "notebook-reading-review", "Name needs review"); }
          if (occurrence.duration) { element(item, "p", "notebook-reading-duration", String(occurrence.duration.value) + " " + (occurrence.duration.value === 1 ? occurrence.duration.unit.slice(0, -1) : occurrence.duration.unit)); }
          multiline(item, "notebook-reading-annotation", occurrence.annotation);
        });
      });
      var dictionary = element(root, "section", "notebook-reading-dictionary"); element(dictionary, "h2", "", "Chord dictionary");
      if (!song.chords.length) { element(dictionary, "p", "notebook-reading-muted", "No chords saved yet."); }
      var entries = element(dictionary, "div", "notebook-reading-chords");
      song.chords.forEach(function (chord, index) {
        var block = element(entries, "article", "notebook-reading-chord"); block.id = chords.get(chord.id).anchor; block.dataset.chordId = chord.id;
        var label = chordName(chord, index); element(block, "h3", "", label); multiline(block, "notebook-reading-nickname", chord.nickname); status(block, chord); roman(block, chord, song.context);
        if (!used.has(chord.id)) { element(block, "p", "notebook-reading-unused", "Unused in sections"); }
        if (shape(chord)) {
          if (chord.interpretation && !chord.reviewRequired && song.capo) { element(block, "p", "notebook-reading-sounding", music.formatInterpretation(music.transposeInterpretation(chord.interpretation, -song.capo)) + " shape · sounds " + label + " · capo " + song.capo); }
          diagram(block, chord, song, label);
        } else { element(block, "p", "notebook-reading-muted", "Fingering not set"); }
        multiline(block, "notebook-reading-chord-notes", chord.notes);
      });
    }
    function destroy() { destroyed = true; previousSong = null; root.textContent = ""; root.hidden = true; root.classList.remove("notebook-reading"); }
    return { render: render, destroy: destroy };
  }
  return { mount: mount };
}));
