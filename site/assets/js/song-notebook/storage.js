(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(require("./contracts.js")); }
  else { root.SongNotebookStorage = factory(root.SongNotebookContracts); }
}(typeof globalThis !== "undefined" ? globalThis : this, function (contracts) {
  "use strict";
  function create(options) {
    var storage = options.storage, model = options.model, music = options.music;
    function fail(code, message, path) { throw { code: code, message: message, path: path || null, details: null }; }
    function errorOf(error, fallback) { return error && error.code && typeof error.code === "string" && typeof error.message === "string" ? error : { code: fallback || "INVALID_RECORD", message: fallback === "SAVE_FAILED" ? "Could not save this work. Export a backup and try again." : fallback === "READ_FAILED" ? "Could not read local storage." : "Invalid record structure", path: null, details: null }; }
    function object(value, path) { if (!value || typeof value !== "object" || Array.isArray(value)) { fail("INVALID_RECORD", "Expected an object", path); } }
    function array(value, path) { if (!Array.isArray(value)) { fail("INVALID_ARRAY", "Expected an array", path); } for (var index = 0; index < value.length; index += 1) { if (!Object.prototype.hasOwnProperty.call(value, index)) { fail("INVALID_ARRAY", "Array entries cannot be missing", path + "." + index); } } }
    function identifier(value, path) { if (typeof value !== "string" || !value.trim()) { fail("INVALID_ID", "Expected a nonempty ID", path); } }
    function nullableId(value, path) { if (value !== null) { identifier(value, path); } }
    function version(value) { if (value !== contracts.version) { fail("UNSUPPORTED_VERSION", "This file uses an unsupported version", "version"); } }
    function spelling(value) { return value.replace(/♯/g, "#").replace(/♭/g, "b").replace(/^[a-g]/, function (letter) { return letter.toUpperCase(); }); }
    function canonicalSong(song) {
      var validation = model.validateSong(song);
      if (!validation.valid) { throw validation.error; }
      return {
        id: song.id, title: song.title, notes: song.notes, createdAt: song.createdAt, updatedAt: song.updatedAt,
        tuningMidi: song.tuningMidi.slice(), capo: song.capo,
        context: song.context === null ? null : { tonicPc: song.context.tonicPc, tonicSpelling: spelling(song.context.tonicSpelling), sourceChordId: song.context.sourceChordId, scaleId: song.context.scaleId },
        chords: song.chords.map(function (chord) { return JSON.parse(model.fingerprint(chord)); }),
        sections: song.sections.map(function (section) { return { id: section.id, name: section.name, notes: section.notes, occurrences: section.occurrences.map(function (occurrence) { return { id: occurrence.id, chordId: occurrence.chordId, duration: occurrence.duration === null ? null : { value: occurrence.duration.value, unit: occurrence.duration.unit }, annotation: occurrence.annotation }; }) }; }),
        arrangement: song.arrangement.map(function (entry) { return { id: entry.id, sectionId: entry.sectionId, repeatCount: entry.repeatCount }; })
      };
    }
    function canonicalLibrary(library) {
      object(library, "library"); version(library.version); identifier(library.activeSongId, "activeSongId");
      array(library.songs, "songs");
      var seen = new Set();
      var songs = library.songs.map(function (song) { var copy = canonicalSong(song); if (seen.has(copy.id)) { fail("DUPLICATE_ID", "The library contains duplicate song IDs", "songs"); } seen.add(copy.id); return copy; });
      if (!seen.has(library.activeSongId)) { fail("BROKEN_REFERENCE", "The active song does not exist in this library", "activeSongId"); }
      return { version: contracts.version, activeSongId: library.activeSongId, songs: songs };
    }
    function canonicalDraft(draft) {
      object(draft, "draft"); identifier(draft.songId, "songId"); nullableId(draft.chordId, "chordId");
      if (draft.chordId === null ? draft.sourceFingerprint !== null : typeof draft.sourceFingerprint !== "string") { fail("INVALID_FINGERPRINT", "A shared-chord draft needs its original source fingerprint", "sourceFingerprint"); }
      nullableId(draft.originSectionId, "originSectionId"); nullableId(draft.originOccurrenceId, "originOccurrenceId");
      if ((draft.originSectionId === null) !== (draft.originOccurrenceId === null)) { fail("INVALID_ORIGIN", "Origin section and occurrence must both be set", "originSectionId"); }
      object(draft.candidate, "candidate"); var candidate = draft.candidate;
      // Validate every candidate field through the model using a temporary shape
      // only for a genuinely empty experiment. The original frets are retained.
      // No committed source/origin lookup is intentional: deleted sources recover.
      var empty = candidate.interpretation === null && (candidate.frets === null || (Array.isArray(candidate.frets) && candidate.frets.length === 6 && Array.from(candidate.frets).every(function (fret) { return fret === null; })));
      var probeChord = { id: "draft-chord", frets: empty ? [0, null, null, null, null, null] : candidate.frets, interpretation: candidate.interpretation, nickname: candidate.nickname, notes: candidate.notes, reviewRequired: candidate.reviewRequired, previousInterpretation: candidate.previousInterpretation };
      var probe = { id: "draft-song", title: "", notes: "", createdAt: "2026-01-01T00:00:00.000Z", updatedAt: "2026-01-01T00:00:00.000Z", tuningMidi: draft.tuningMidi, capo: draft.capo, context: null, chords: [probeChord], sections: [{ id: "draft-section", name: "", notes: "", occurrences: [] }], arrangement: [] };
      var checked = canonicalSong(probe).chords[0]; delete checked.id;
      checked.frets = candidate.frets === null ? null : candidate.frets.slice();
      return { songId: draft.songId, chordId: draft.chordId, candidate: checked, sourceFingerprint: draft.sourceFingerprint, tuningMidi: draft.tuningMidi.slice(), capo: draft.capo, originSectionId: draft.originSectionId, originOccurrenceId: draft.originOccurrenceId };
    }
    function canonicalDrafts(envelope) {
      object(envelope, "drafts"); version(envelope.version);
      array(envelope.drafts, "drafts");
      var seen = new Set();
      var drafts = envelope.drafts.map(function (draft) { var copy = canonicalDraft(draft), key = JSON.stringify([copy.songId, copy.chordId]); if (seen.has(key)) { fail("DUPLICATE_DRAFT", "Only one draft per song and chord is allowed", "drafts"); } seen.add(key); return copy; });
      return { version: contracts.version, drafts: drafts };
    }
    function read(key, normalize) {
      var raw = null;
      try {
        if (!storage) { fail("STORAGE_UNAVAILABLE", "Local storage is unavailable. You can still work and export JSON."); }
        raw = storage.getItem(key);
        if (raw === null) { return { data: null, error: null, raw: null }; }
        var parsed;
        try { parsed = JSON.parse(raw); } catch (error) { fail("INVALID_JSON", "Saved data is not valid JSON. Download the raw backup before resetting."); }
        return { data: normalize(parsed), error: null, raw: raw };
      } catch (error) { return { data: null, error: errorOf(error, "READ_FAILED"), raw: raw }; }
    }
    function save(key, value, normalize) {
      try {
        var clean = normalize(value);
        if (!storage) { fail("STORAGE_UNAVAILABLE", "Local storage is unavailable. Export JSON to keep this work."); }
        storage.setItem(key, JSON.stringify(clean)); return { data: true, error: null };
      } catch (error) { return { data: null, error: errorOf(error, "SAVE_FAILED") }; }
    }
    function exportSong(song) {
      try { return { data: JSON.stringify({ format: contracts.exportFormat, version: contracts.version, song: canonicalSong(song) }, null, 2), error: null }; }
      catch (error) { return { data: null, error: errorOf(error) }; }
    }
    function importSong(text) {
      try {
        if (typeof text !== "string") { fail("INVALID_JSON", "Choose a JSON song file"); }
        var envelope;
        try { envelope = JSON.parse(text); } catch (error) { fail("INVALID_JSON", "This file is not valid JSON"); }
        object(envelope, "file"); version(envelope.version);
        if (envelope.format !== contracts.exportFormat) { fail("INVALID_FORMAT", "Choose a Guitar Chordinator song export", "format"); }
        // Validation and canonicalization finish before IDs or clock are used.
        var clean = canonicalSong(envelope.song);
        return { data: model.duplicateSong(clean), error: null };
      } catch (error) { return { data: null, error: errorOf(error) }; }
    }
    function legacy(payload) {
      object(payload, "legacy");
      if (payload.version !== 1 && payload.version !== 2) { fail("UNSUPPORTED_VERSION", "Unknown old shape history version", "version"); }
      array(payload.entries, "entries");
      return payload.entries.map(function (entry, index) {
        var path = "entries." + index; object(entry, path);
        if (!Array.isArray(entry.tuning) || entry.tuning.length !== 6 || !Array.from(entry.tuning).every(function (pc) { return Number.isInteger(pc) && pc >= 0 && pc <= 11; })) { fail("INVALID_LEGACY_TUNING", "Old shape tuning needs six pitch classes from 0 to 11", path + ".tuning"); }
        if (!Array.isArray(entry.selection) || entry.selection.length !== 6 || !Array.from(entry.selection).every(function (fret) { return fret === null || (Number.isInteger(fret) && fret >= 0 && fret <= 15); })) { fail("INVALID_LEGACY_SHAPE", "Old shape needs six muted or fretted strings from 0 to 15", path + ".selection"); }
        var tuningMidi = entry.tuning.map(function (pc, stringIndex) {
          var standard = contracts.defaultTuning[stringIndex];
          var lower = standard - ((standard - pc) % 12 + 12) % 12;
          return standard - lower <= lower + 12 - standard ? lower : lower + 12;
        });
        var preset = music.presets.find(function (p) { return p.tuningMidi.every(function (n, i) { return ((n % 12) + 12) % 12 === entry.tuning[i]; }); });
        var shape = entry.selection.slice().reverse().map(function (fret) { return fret === null ? "x" : String(fret); }).join(" ");
        return { label: shape + " · " + (preset ? preset.label : "Custom tuning"), tuningMidi: tuningMidi, frets: entry.selection.slice(), octaveAssumption: "Octaves assumed nearest standard tuning for each string; the lower octave is used for ties. Review tuning before keeping this shape." };
      }).filter(function (recovery) { return recovery.frets.some(function (fret) { return fret !== null; }); });
    }
    return {
      loadFingeringStyle: function () {
        try { var mode = storage && storage.getItem(contracts.fingeringStyleKey); return mode === "compact" || mode === "fuller" ? mode : null; }
        catch (error) { return null; }
      },
      saveFingeringStyle: function (mode) {
        if (mode !== "compact" && mode !== "fuller") { return false; }
        try { if (!storage) { return false; } storage.setItem(contracts.fingeringStyleKey, mode); return true; }
        catch (error) { return false; }
      },
      loadLibrary: function () { return read(contracts.libraryKey, canonicalLibrary); },
      saveLibrary: function (library) { return save(contracts.libraryKey, library, canonicalLibrary); },
      loadDrafts: function () { return read(contracts.draftsKey, canonicalDrafts); },
      saveDrafts: function (envelope) { return save(contracts.draftsKey, envelope, canonicalDrafts); },
      exportSong: exportSong, importSong: importSong,
      readLegacySettings: function () { var result = read(contracts.legacyKey, legacy); if (!result.error && result.data === null) { result.data = []; } return result; }
    };
  }
  return { create: create };
}));
