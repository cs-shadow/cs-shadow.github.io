(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookModel = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  var fallbackCounter = 0;
  function defaultId() {
    var crypto = typeof globalThis !== "undefined" && globalThis.crypto;
    if (crypto && crypto.randomUUID) { return crypto.randomUUID(); }
    if (crypto && crypto.getRandomValues) {
      var bytes = new Uint8Array(16);
      crypto.getRandomValues(bytes);
      return Array.from(bytes, function (b) { return b.toString(16).padStart(2, "0"); }).join("");
    }
    // Timestamp, process-local counter and independent random words: the counter
    // guarantees uniqueness within a session even with coarse clocks/RNG mocks.
    return Date.now().toString(36) + "-" + (++fallbackCounter).toString(36) + "-" +
      Array.from({ length: 4 }, function () { return Math.floor(Math.random() * 0x100000000).toString(36); }).join("-");
  }
  function create(options) {
    var music = options.music;
    if (!music) { throw new TypeError("SongNotebookModel requires music"); }
    var id = options.id || defaultId;
    var now = options.now || function () { return new Date().toISOString(); };
    var chordKeys = ["frets", "interpretation", "nickname", "notes", "reviewRequired", "previousInterpretation"];
    function fail(code, message, path, details) { throw { code: code, message: message, path: path || null, details: details || null }; }
    function errorOf(error) { return error && error.code && typeof error.message === "string" ? error : { code: "INVALID_RECORD", message: "Invalid record structure", path: null, details: null }; }
    function object(value, path) { if (!value || typeof value !== "object" || Array.isArray(value)) { fail("INVALID_RECORD", "Expected an object", path); } }
    function array(value, path) { if (!Array.isArray(value)) { fail("INVALID_ARRAY", "Expected an array", path); } for (var index = 0; index < value.length; index += 1) { if (!Object.prototype.hasOwnProperty.call(value, index)) { fail("INVALID_ARRAY", "Array entries cannot be missing", path + "." + index); } } }
    function text(value, path) { if (typeof value !== "string") { fail("INVALID_TEXT", "Expected text", path); } }
    function identifier(value, path) { text(value, path); if (!value.trim()) { fail("INVALID_ID", "ID must be nonempty", path); } }
    function integer(value, min, max, path) { if (!Number.isInteger(value) || value < min || value > max) { fail("INVALID_NUMBER", "Expected an integer from " + min + " to " + max, path); } }
    function spelling(value, pc, path) {
      text(value, path);
      var normalized = value.replace(/♯/g, "#").replace(/♭/g, "b");
      var match = /^([A-Ga-g])((?:#+|b+)?)$/.exec(normalized);
      if (!match) { fail("INVALID_SPELLING", "Expected a note spelling", path); }
      var letter = match[1].toUpperCase(), accidental = match[2];
      var pitch = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[letter];
      pitch += accidental.length * (accidental[0] === "b" ? -1 : 1);
      if (((pitch % 12) + 12) % 12 !== pc) { fail("INVALID_SPELLING", "Note spelling does not match pitch class", path); }
      return letter + accidental;
    }
    function interpretation(value, path) {
      if (value === null) { return null; }
      object(value, path);
      integer(value.rootPc, 0, 11, path + ".rootPc");
      text(value.formulaId, path + ".formulaId");
      if (!music.chords.some(function (c) { return c.id === value.formulaId; })) { fail("UNKNOWN_FORMULA", "Unknown chord formula", path + ".formulaId"); }
      var rootSpelling = spelling(value.rootSpelling, value.rootPc, path + ".rootSpelling");
      var bassSpelling = null;
      if (value.bassPc !== null || value.bassSpelling !== null) {
        integer(value.bassPc, 0, 11, path + ".bassPc");
        bassSpelling = spelling(value.bassSpelling, value.bassPc, path + ".bassSpelling");
      }
      return { rootPc: value.rootPc, rootSpelling: rootSpelling, formulaId: value.formulaId, bassPc: value.bassPc, bassSpelling: bassSpelling };
    }
    function settings(tuning, capo) {
      array(tuning, "tuningMidi");
      if (tuning.length !== 6) { fail("INVALID_TUNING", "Tuning needs six strings", "tuningMidi"); }
      tuning.forEach(function (n, i) { integer(n, 0, 127, "tuningMidi." + i); });
      integer(capo, 0, 12, "capo");
    }
    function chord(value, capo, path) {
      object(value, path);
      identifier(value.id, path + ".id");
      var frets = value.frets;
      if (frets !== null) {
        array(frets, path + ".frets");
        if (frets.length !== 6) { fail("INVALID_FRETS", "Shape needs six strings", path + ".frets"); }
        frets.forEach(function (f, i) { if (f !== null) { integer(f, 0, 24, path + ".frets." + i); if (f + capo > 24) { fail("PHYSICAL_FRET_LIMIT", "Shape exceeds physical fret 24", path + ".frets." + i, { chordIds: [value.id] }); } } });
        frets = frets.some(function (f) { return f !== null; }) ? frets.slice() : null;
      }
      var chosen = interpretation(value.interpretation, path + ".interpretation");
      if (!frets && !chosen) { fail("EMPTY_CHORD", "Keep at least one sounding string or a chord name", path); }
      text(value.nickname, path + ".nickname"); text(value.notes, path + ".notes");
      if (typeof value.reviewRequired !== "boolean") { fail("INVALID_BOOLEAN", "Expected reviewRequired to be true or false", path + ".reviewRequired"); }
      return { id: value.id, frets: frets, interpretation: chosen, nickname: value.nickname, notes: value.notes, reviewRequired: value.reviewRequired, previousInterpretation: interpretation(value.previousInterpretation, path + ".previousInterpretation") };
    }
    function timestamp(value, path) {
      text(value, path);
      if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value) || !Number.isFinite(Date.parse(value))) { fail("INVALID_TIMESTAMP", "Expected an ISO timestamp", path); }
    }
    function canonicalSong(song) {
      object(song, "song"); identifier(song.id, "id"); text(song.title, "title"); text(song.notes, "notes");
      timestamp(song.createdAt, "createdAt"); timestamp(song.updatedAt, "updatedAt"); settings(song.tuningMidi, song.capo);
      array(song.chords, "chords"); array(song.sections, "sections"); array(song.arrangement, "arrangement");
      var ids = new Set([song.id]);
      function unique(value, path) { identifier(value, path); if (ids.has(value)) { fail("DUPLICATE_ID", "Every song entity must have a distinct ID", path); } ids.add(value); }
      var chords = song.chords.map(function (c, i) { var path = "chords." + i; var copy = chord(c, song.capo, path); unique(copy.id, path + ".id"); return copy; });
      var chordIds = new Set(chords.map(function (c) { return c.id; }));
      if (!song.sections.length) { fail("MISSING_SECTION", "A song needs at least one section", "sections"); }
      var sections = song.sections.map(function (s, i) {
        var path = "sections." + i; object(s, path); unique(s.id, path + ".id"); text(s.name, path + ".name"); text(s.notes, path + ".notes"); array(s.occurrences, path + ".occurrences");
        return { id: s.id, name: s.name, notes: s.notes, occurrences: s.occurrences.map(function (o, j) {
          var p = path + ".occurrences." + j; object(o, p); unique(o.id, p + ".id"); identifier(o.chordId, p + ".chordId");
          if (!chordIds.has(o.chordId)) { fail("BROKEN_REFERENCE", "Occurrence references a missing chord", p + ".chordId"); }
          text(o.annotation, p + ".annotation"); var duration = null;
          if (o.duration !== null) {
            object(o.duration, p + ".duration");
            if (typeof o.duration.value !== "number" || !Number.isFinite(o.duration.value) || o.duration.value <= 0 || !["beats", "bars"].includes(o.duration.unit)) { fail("INVALID_DURATION", "Duration needs a positive finite number of beats or bars", p + ".duration"); }
            duration = { value: o.duration.value, unit: o.duration.unit };
          }
          return { id: o.id, chordId: o.chordId, duration: duration, annotation: o.annotation };
        }) };
      });
      var sectionIds = new Set(sections.map(function (s) { return s.id; }));
      var arrangement = song.arrangement.map(function (a, i) {
        var path = "arrangement." + i; object(a, path); unique(a.id, path + ".id"); identifier(a.sectionId, path + ".sectionId");
        if (!sectionIds.has(a.sectionId)) { fail("BROKEN_REFERENCE", "Song order references a missing section", path + ".sectionId"); }
        integer(a.repeatCount, 1, Number.MAX_SAFE_INTEGER, path + ".repeatCount"); return { id: a.id, sectionId: a.sectionId, repeatCount: a.repeatCount };
      });
      var context = null;
      if (song.context !== null) {
        var c = song.context; object(c, "context"); integer(c.tonicPc, 0, 11, "context.tonicPc");
        var tonicSpelling = spelling(c.tonicSpelling, c.tonicPc, "context.tonicSpelling");
        if (c.scaleId !== null && !music.scales.some(function (s) { return s.id === c.scaleId; })) { fail("UNKNOWN_SCALE", "Unknown scale", "context.scaleId"); }
        if (c.sourceChordId !== null) {
          identifier(c.sourceChordId, "context.sourceChordId");
          var source = chords.find(function (ch) { return ch.id === c.sourceChordId; });
          if (!source || !source.interpretation || source.reviewRequired || source.interpretation.rootPc !== c.tonicPc) { fail("INVALID_HOME_SOURCE", "Home source must be an accepted chord with the same tonic", "context.sourceChordId"); }
        }
        context = { tonicPc: c.tonicPc, tonicSpelling: tonicSpelling, sourceChordId: c.sourceChordId, scaleId: c.scaleId };
      }
      return { id: song.id, title: song.title, notes: song.notes, createdAt: song.createdAt, updatedAt: song.updatedAt, tuningMidi: song.tuningMidi.slice(), capo: song.capo, context: context, chords: chords, sections: sections, arrangement: arrangement };
    }
    function validateSong(song) { try { canonicalSong(song); return { valid: true, error: null }; } catch (error) { return { valid: false, error: errorOf(error) }; } }
    function newSection(name) { return { id: id(), name: name === undefined ? "Section 1" : name, notes: "", occurrences: [] }; }
    function createSong(overrides) {
      overrides = overrides || {}; var time = now();
      var song = { id: id(), title: "", notes: "", createdAt: time, updatedAt: time, tuningMidi: music.defaultTuning.slice(), capo: 0, context: null, chords: [], sections: [newSection()], arrangement: [] };
      ["title", "notes", "tuningMidi", "capo", "context"].forEach(function (key) { if (Object.prototype.hasOwnProperty.call(overrides, key)) { song[key] = overrides[key]; } });
      return canonicalSong(song);
    }
    function duplicateSong(song) {
      var copy = canonicalSong(song), remap = new Map();
      function fresh(old) { var value = id(); remap.set(old, value); return value; }
      copy.id = fresh(copy.id); copy.chords.forEach(function (c) { c.id = fresh(c.id); });
      copy.sections.forEach(function (s) { s.id = fresh(s.id); s.occurrences.forEach(function (o) { o.id = fresh(o.id); o.chordId = remap.get(o.chordId); }); });
      copy.arrangement.forEach(function (a) { a.id = fresh(a.id); a.sectionId = remap.get(a.sectionId); });
      if (copy.context && copy.context.sourceChordId !== null) { copy.context.sourceChordId = remap.get(copy.context.sourceChordId); }
      copy.createdAt = copy.updatedAt = now(); return canonicalSong(copy);
    }
    function getUsage(song, query) {
      var occurrences = [], arrangement = [], sectionIds = new Set();
      song.sections.forEach(function (s) { s.occurrences.forEach(function (o) { if ((query.chordId !== undefined || query.sectionId !== undefined) && (query.chordId === undefined || o.chordId === query.chordId) && (query.sectionId === undefined || query.sectionId === s.id)) { occurrences.push({ sectionId: s.id, occurrenceId: o.id }); sectionIds.add(s.id); } }); });
      song.arrangement.forEach(function (a) { if (query.sectionId !== undefined ? a.sectionId === query.sectionId : sectionIds.has(a.sectionId)) { arrangement.push({ arrangementId: a.id, sectionId: a.sectionId }); } });
      return { occurrences: occurrences, arrangement: arrangement };
    }
    function fingerprint(value) { return JSON.stringify(chord(value, 0, "chord")); }
    function applyAction(song, action) {
      try {
        var next = canonicalSong(song); object(action, "action");
        function lookup(items, target, kind) { var found = items.find(function (item) { return item.id === target; }); if (!found) { fail("NOT_FOUND", kind + " no longer exists", kind + "Id"); } return found; }
        function section(target) { return lookup(next.sections, target, "section"); }
        function entry(target) { return lookup(next.chords, target, "chord"); }
        function patch(target, changes, keys) { object(changes, "patch"); keys.forEach(function (key) { if (Object.prototype.hasOwnProperty.call(changes, key)) { target[key] = changes[key]; } }); }
        function occurrence(s, target) { return lookup(s.occurrences, target, "occurrence"); }
        function insert(s, chordId, after) {
          entry(chordId); var position = s.occurrences.length;
          if (after !== undefined && after !== null) { var anchor = occurrence(s, after); position = s.occurrences.indexOf(anchor) + 1; }
          var o = { id: id(), chordId: chordId, duration: null, annotation: "" }; s.occurrences.splice(position, 0, o); return o;
        }
        function addChord(data) { object(data, "chord"); var c = { id: id(), reviewRequired: false, previousInterpretation: null }; patch(c, data, chordKeys); c = chord(c, next.capo, "chord"); next.chords.push(c); return c; }
        function reconcileHome() {
          var context = next.context;
          if (!context || context.sourceChordId === null) { return; }
          var source = next.chords.find(function (c) { return c.id === context.sourceChordId; });
          if (!source || !source.interpretation || source.reviewRequired) { context.sourceChordId = null; }
          else { context.tonicPc = source.interpretation.rootPc; context.tonicSpelling = source.interpretation.rootSpelling; }
        }
        function move(items, item, direction) { if (direction !== -1 && direction !== 1) { fail("INVALID_DIRECTION", "Move direction must be -1 or 1", "direction"); } var at = items.indexOf(item), to = at + direction; if (to >= 0 && to < items.length) { items.splice(at, 1); items.splice(to, 0, item); } }
        function deletionMode(used, replacementId, ownId, items, kind) {
          if (action.referenceMode !== undefined && !["remove", "replace"].includes(action.referenceMode)) { fail("INVALID_REFERENCE_MODE", "Choose remove or replace references", "referenceMode"); }
          if (used && action.referenceMode === undefined) { fail("REFERENCES_REQUIRE_CHOICE", "Choose whether to remove or replace existing references", "referenceMode"); }
          if (action.referenceMode === "replace") { if (replacementId === ownId) { fail("INVALID_REPLACEMENT", "Replacement must be a different " + kind, "replacementId"); } lookup(items, replacementId, kind); }
        }
        var s, c, o, a;
        switch (action.type) {
        case "song.update": patch(next, action.patch, ["title", "notes"]); break;
        case "chord.create":
          c = addChord(action.chord); if (action.sectionId !== undefined && action.sectionId !== null) { insert(section(action.sectionId), c.id); } break;
        case "chord.update":
          c = entry(action.chordId);
          if (action.expectedFingerprint !== undefined && action.expectedFingerprint !== fingerprint(c)) { fail("SOURCE_CONFLICT", "The shared chord changed; reopen it or save a variation", "expectedFingerprint"); }
          patch(c, action.patch, chordKeys); reconcileHome(); break;
        case "chord.variation":
          ["chordId", "originSectionId", "originOccurrenceId"].forEach(function (key) { if (action[key] !== null && action[key] !== undefined) { identifier(action[key], key); } });
          c = addChord(action.chord);
          if ((action.originSectionId == null) !== (action.originOccurrenceId == null)) { fail("INVALID_ORIGIN", "Origin section and occurrence must both be set", "originSectionId"); }
          s = next.sections.find(function (value) { return value.id === action.originSectionId; });
          o = s && s.occurrences.find(function (value) { return value.id === action.originOccurrenceId; });
          if (o && o.chordId === action.chordId) { o.chordId = c.id; } break;
        case "chord.delete":
          c = entry(action.chordId);
          deletionMode(getUsage(next, { chordId: c.id }).occurrences.length > 0, action.replacementChordId, c.id, next.chords, "chord");
          next.sections.forEach(function (value) { value.occurrences = value.occurrences.filter(function (item) { if (item.chordId !== c.id) { return true; } if (action.referenceMode === "replace") { item.chordId = action.replacementChordId; return true; } return false; }); });
          next.chords = next.chords.filter(function (item) { return item.id !== c.id; }); reconcileHome(); break;
        case "progression.insert":
          s = section(action.sectionId); text(action.text, "text");
          var tokens = action.text.trim().split(/[\s,]+/).filter(Boolean);
          if (!tokens.length) { fail("EMPTY_PROGRESSION", "Enter at least one chord symbol", "text"); }
          var parsed = tokens.map(function (token, index) { var result = music.parseChordSymbol(token); if (result.error || !result.interpretation) { fail("INVALID_SYMBOL", "Unknown chord symbol: " + token, "text", { token: token, index: index }); } return interpretation(result.interpretation, "text"); });
          var after = action.afterOccurrenceId;
          parsed.forEach(function (chosen) {
            var key = JSON.stringify(chosen);
            var reused = next.chords.find(function (item) { return item.frets === null && !item.reviewRequired && JSON.stringify(item.interpretation) === key; });
            c = reused || addChord({ frets: null, interpretation: chosen, nickname: "", notes: "" });
            after = insert(s, c.id, after).id;
          }); break;
        case "section.create":
          var nextNumber = next.sections.reduce(function (highest, existing) {
            var numbered = /^Section (\d+)$/.exec(existing.name);
            return numbered ? Math.max(highest, Number(numbered[1])) : highest;
          }, 0) + 1;
          next.sections.push(newSection(action.name === undefined ? "Section " + nextNumber : action.name)); break;
        case "section.update": patch(section(action.sectionId), action.patch, ["name", "notes"]); break;
        case "section.duplicate":
          s = section(action.sectionId); var copied = { id: id(), name: s.name, notes: s.notes, occurrences: s.occurrences.map(function (item) { return { id: id(), chordId: item.chordId, duration: item.duration, annotation: item.annotation }; }) };
          next.sections.splice(next.sections.indexOf(s) + 1, 0, copied); break;
        case "section.delete":
          s = section(action.sectionId); deletionMode(getUsage(next, { sectionId: s.id }).arrangement.length > 0, action.replacementSectionId, s.id, next.sections, "section");
          next.arrangement = next.arrangement.filter(function (item) { if (item.sectionId !== s.id) { return true; } if (action.referenceMode === "replace") { item.sectionId = action.replacementSectionId; return true; } return false; });
          next.sections = next.sections.filter(function (item) { return item.id !== s.id; }); if (!next.sections.length) { next.sections.push(newSection()); } break;
        case "occurrence.create": insert(section(action.sectionId), action.chordId, action.afterOccurrenceId); break;
        case "occurrence.update": patch(occurrence(section(action.sectionId), action.occurrenceId), action.patch, ["chordId", "duration", "annotation"]); break;
        case "occurrence.move": s = section(action.sectionId); move(s.occurrences, occurrence(s, action.occurrenceId), action.direction); break;
        case "occurrence.duplicate":
          s = section(action.sectionId); o = occurrence(s, action.occurrenceId); s.occurrences.splice(s.occurrences.indexOf(o) + 1, 0, { id: id(), chordId: o.chordId, duration: o.duration, annotation: o.annotation }); break;
        case "occurrence.delete": s = section(action.sectionId); o = occurrence(s, action.occurrenceId); s.occurrences.splice(s.occurrences.indexOf(o), 1); break;
        case "arrangement.create": s = section(action.sectionId); next.arrangement.push({ id: id(), sectionId: s.id, repeatCount: 1 }); break;
        case "arrangement.update": patch(lookup(next.arrangement, action.arrangementId, "arrangement"), action.patch, ["sectionId", "repeatCount"]); break;
        case "arrangement.move": a = lookup(next.arrangement, action.arrangementId, "arrangement"); move(next.arrangement, a, action.direction); break;
        case "arrangement.delete": a = lookup(next.arrangement, action.arrangementId, "arrangement"); next.arrangement.splice(next.arrangement.indexOf(a), 1); break;
        case "context.set": next.context = action.context; break;
        case "settings.apply":
          settings(action.tuningMidi, action.capo);
          var affected = next.chords.filter(function (item) { return item.frets && item.frets.some(function (fret) { return fret !== null && fret + action.capo > 24; }); });
          if (affected.length) { fail("PHYSICAL_FRET_LIMIT", "Capo puts saved shapes beyond physical fret 24", "capo", { chordIds: affected.map(function (item) { return item.id; }) }); }
          var retuned = next.tuningMidi.some(function (n, i) { return n !== action.tuningMidi[i]; });
          var delta = action.capo - next.capo;
          next.chords.forEach(function (item) {
            if (!item.frets) { return; }
            if (retuned) { if (!item.reviewRequired) { item.previousInterpretation = item.interpretation; } item.reviewRequired = true; }
            else if (delta && !item.reviewRequired && item.interpretation) { item.interpretation = music.transposeInterpretation(item.interpretation, delta); }
          });
          next.tuningMidi = action.tuningMidi.slice(); next.capo = action.capo; reconcileHome(); break;
        default: fail("UNKNOWN_ACTION", "Unknown song action", "type");
        }
        next.updatedAt = now(); return { song: canonicalSong(next), error: null };
      } catch (error) { return { song: song, error: errorOf(error) }; }
    }
    return { createSong: createSong, validateSong: validateSong, applyAction: applyAction, duplicateSong: duplicateSong, getUsage: getUsage, fingerprint: fingerprint };
  }
  return { create: create };
}));
