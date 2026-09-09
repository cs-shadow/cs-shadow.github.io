(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookMusic = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";

  // Catalogs preserve the existing Chordinator formulas and Scalar Triads scales.
  var SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  var NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  var ROOTS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
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
  var SCALES = [
    { id: "major", name: "Major / Ionian", group: "Major Modes", intervals: [0, 2, 4, 5, 7, 9, 11], feel: "Stable, bright, resolved, and familiar. Good for clear melodies and strong tonal centers." },
    { id: "dorian", name: "Dorian", group: "Major Modes", intervals: [0, 2, 3, 5, 7, 9, 10], feel: "Minor but lifted by the natural 6. Good for soulful, modal, funk, and jazz-rock sounds." },
    { id: "phrygian", name: "Phrygian", group: "Major Modes", intervals: [0, 1, 3, 5, 7, 8, 10], feel: "Dark, tense, and close to the root because of the flat 2. Good for dramatic or Spanish-leaning colors." },
    { id: "lydian", name: "Lydian", group: "Major Modes", intervals: [0, 2, 4, 6, 7, 9, 11], feel: "Bright, floating, and unresolved because of the sharp 4. Good for dreamy or cinematic major sounds." },
    { id: "mixolydian", name: "Mixolydian", group: "Major Modes", intervals: [0, 2, 4, 5, 7, 9, 10], feel: "Major with a relaxed flat 7. Good for blues, rock, country, and dominant-chord grooves." },
    { id: "aeolian", name: "Natural Minor / Aeolian", group: "Major Modes", intervals: [0, 2, 3, 5, 7, 8, 10], feel: "Classic minor: darker, direct, and grounded. Good for melancholy melodies and minor-key progressions." },
    { id: "locrian", name: "Locrian", group: "Major Modes", intervals: [0, 1, 3, 5, 6, 8, 10], feel: "Unstable and tense because of the flat 2 and flat 5. Good for dissonant, unresolved passages." },
    { id: "major-pentatonic", name: "Major Pentatonic", group: "Pentatonic & Blues", intervals: [0, 2, 4, 7, 9], degreeLetters: [0, 1, 2, 4, 5], feel: "Open, simple, and consonant. Good for melodic hooks, country, folk, pop, and major blues phrasing." },
    { id: "minor-pentatonic", name: "Minor Pentatonic", group: "Pentatonic & Blues", intervals: [0, 3, 5, 7, 10], degreeLetters: [0, 2, 3, 4, 6], feel: "Direct, earthy, and flexible. Good for blues, rock, funk, and minor-key soloing." },
    { id: "blues", name: "Blues", group: "Pentatonic & Blues", intervals: [0, 3, 5, 6, 7, 10], degreeLetters: [0, 2, 3, 4, 4, 6], feel: "Gritty and expressive because of the blue note. Good for blues tension, bends, riffs, and call-and-response lines." },
    { id: "harmonic-minor", name: "Harmonic Minor", group: "Minor & Exotic", intervals: [0, 2, 3, 5, 7, 8, 11], feel: "Minor with a strong leading tone and exotic pull. Good for dramatic cadences and neoclassical lines." },
    { id: "melodic-minor", name: "Melodic Minor", group: "Minor & Exotic", intervals: [0, 2, 3, 5, 7, 9, 11], feel: "Minor at the root with a smoother, brighter upper half. Good for jazz minor sounds and altered harmony." },
    { id: "double-harmonic-major", name: "Double Harmonic Major", group: "Minor & Exotic", intervals: [0, 1, 4, 5, 7, 8, 11], feel: "Bright but tense, with two augmented seconds and a strong exotic pull. Good for dramatic, Middle Eastern-leaning colors." },
    { id: "hungarian-minor", name: "Hungarian Minor", group: "Minor & Exotic", intervals: [0, 2, 3, 6, 7, 8, 11], feel: "Dark, angular, and dramatic because of the sharp 4 and major 7. Good for tense minor lines and neoclassical colors." },
    { id: "phrygian-dominant", name: "Phrygian Dominant", group: "Minor & Exotic", intervals: [0, 1, 4, 5, 7, 8, 10], feel: "Dominant and dark, with a flat 2 against a major 3. Good for flamenco, metal, and harmonic-minor V sounds." },
    { id: "neapolitan-minor", name: "Neapolitan Minor", group: "Minor & Exotic", intervals: [0, 1, 3, 5, 7, 8, 11], feel: "Minor, tense, and theatrical, with a flat 2 and major 7. Good for dramatic minor-key movement." }
  ];
  var NATURAL_PITCHES = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
  var DEFAULT_TUNING = [64, 59, 55, 50, 45, 40];
  var PRESETS = [
    { id: "standard", label: "Standard", tuningMidi: [64, 59, 55, 50, 45, 40] },
    { id: "drop-d", label: "Drop D", tuningMidi: [64, 59, 55, 50, 45, 38] },
    { id: "open-g", label: "Open G", tuningMidi: [62, 59, 55, 50, 43, 38] },
    { id: "open-d", label: "Open D", tuningMidi: [62, 57, 54, 50, 45, 38] },
    { id: "dadgad", label: "DADGAD", tuningMidi: [62, 57, 55, 50, 45, 38] }
  ];
  var CHORD_BY_ID = Object.create(null);
  var SCALE_BY_ID = Object.create(null);
  var ROMAN = ["I", "♭II", "II", "♭III", "III", "IV", "♯IV", "V", "♭VI", "VI", "♭VII", "VII"];
  var ALIASES = { maj: "", M: "", min: "m", "-": "m", "+": "aug", "°": "dim", "°7": "dim7", "ø": "m7b5", "ø7": "m7b5", M7: "maj7", "Δ7": "maj7", sus: "sus4", min7: "m7", "-7": "m7", "m(maj7)": "mMaj7" };

  function freeze(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === "object") { freeze(value[key]); }
    });
    return Object.freeze(value);
  }

  CHORDS.forEach(function (chord) {
    chord.id = chord.suffix;
    chord.group = ["", "m", "dim", "aug", "5"].indexOf(chord.id) !== -1 ? "triads" :
      ["7", "maj7", "m7", "mMaj7", "dim7", "m7b5"].indexOf(chord.id) !== -1 ? "sevenths" :
      /^(sus|add|madd|7sus)/.test(chord.id) || chord.id === "6" || chord.id === "m6" ? "added" : "extended";
    CHORD_BY_ID[chord.id] = chord;
  });
  SCALES.forEach(function (scale) { SCALE_BY_ID[scale.id] = scale; });

  function normalizePitch(number) { return ((Math.trunc(number) % 12) + 12) % 12; }
  function pitchName(pc, preferFlats) { return (preferFlats ? FLAT_NOTES : SHARP_NOTES)[normalizePitch(pc)]; }
  function distinct(values) { return Array.from(new Set(values)).sort(function (a, b) { return a - b; }); }
  function difference(left, right) { return left.filter(function (value) { return right.indexOf(value) === -1; }); }
  function notePitch(spelling) {
    return normalizePitch(NATURAL_PITCHES[spelling[0]] + Array.from(spelling.slice(1)).reduce(function (sum, char) { return sum + (char === "#" ? 1 : -1); }, 0));
  }
  function makeInterpretation(pc, spelling, formulaId, bassPc, bassSpelling) {
    return { rootPc: pc, rootSpelling: spelling, formulaId: formulaId, bassPc: bassPc, bassSpelling: bassSpelling };
  }
  function parseChordSymbol(text) {
    function invalid(message) {
      return { interpretation: null, error: { code: "INVALID_SYMBOL", message: message, path: null, details: null } };
    }
    if (typeof text !== "string") { return invalid("Enter one chord symbol, such as Am or C/G."); }
    var symbol = text.trim().replace(/♯/g, "#").replace(/♭/g, "b");
    var match = /^([A-Ga-g])((?:#+|b+)?)([^\s,\/]*)(?:\/([A-Ga-g])((?:#+|b+)?))?$/.exec(symbol);
    if (!match) { return invalid("Enter one chord symbol, such as Am or C/G."); }
    var suffix = match[3];
    if (Object.prototype.hasOwnProperty.call(ALIASES, suffix)) { suffix = ALIASES[suffix]; }
    if (!Object.prototype.hasOwnProperty.call(CHORD_BY_ID, suffix)) {
      return invalid("Unknown chord quality in “" + text.trim() + "”. Use a catalog chord symbol or capture an unnamed shape.");
    }
    var root = match[1].toUpperCase() + match[2];
    var bass = match[4] ? match[4].toUpperCase() + match[5] : null;
    return { interpretation: makeInterpretation(notePitch(root), root, suffix, bass === null ? null : notePitch(bass), bass), error: null };
  }
  function formatInterpretation(interpretation) {
    return interpretation ? interpretation.rootSpelling + interpretation.formulaId +
      (interpretation.bassSpelling === null ? "" : "/" + interpretation.bassSpelling) : "";
  }
  function interpretationPitches(interpretation) {
    if (!interpretation || !CHORD_BY_ID[interpretation.formulaId]) { return []; }
    var pitches = CHORD_BY_ID[interpretation.formulaId].intervals.map(function (n) { return normalizePitch(n + interpretation.rootPc); });
    if (interpretation.bassPc !== null) { pitches.push(interpretation.bassPc); }
    return distinct(pitches);
  }
  function transposeInterpretation(interpretation, semitones) {
    if (!interpretation) { return null; }
    var root = normalizePitch(interpretation.rootPc + semitones);
    var bass = interpretation.bassPc === null ? null : normalizePitch(interpretation.bassPc + semitones);
    // An octave/no-op retains unusual but intentional spellings such as Cb.
    return makeInterpretation(root, normalizePitch(semitones) === 0 ? interpretation.rootSpelling : pitchName(root, interpretation.rootSpelling.indexOf("b") !== -1),
      interpretation.formulaId, bass, bass === null ? null : normalizePitch(semitones) === 0 ? interpretation.bassSpelling : pitchName(bass, interpretation.bassSpelling.indexOf("b") !== -1));
  }
  function notesForShape(tuningMidi, capo, frets) {
    if (!frets) { return []; }
    return frets.reduce(function (notes, fret, stringIndex) {
      if (fret !== null) {
        var midi = tuningMidi[stringIndex] + capo + fret;
        notes.push({ stringIndex: stringIndex, fret: fret, physicalFret: fret + capo, midi: midi, pc: normalizePitch(midi) });
      }
      return notes;
    }, []);
  }
  function identifyChord(notes) {
    var pitches = distinct(notes.map(function (note) { return note.pc; }));
    if (pitches.length < 2) { return []; }
    var bass = notes.reduce(function (lowest, note) { return note.midi < lowest.midi ? note : lowest; }).pc;
    var candidates = [];
    pitches.forEach(function (root) {
      CHORDS.forEach(function (chord) {
        var expected = distinct(chord.intervals.map(function (n) { return normalizePitch(n + root); }));
        var missing = difference(expected, pitches);
        var extra = difference(pitches, expected);
        if (missing.length + extra.length > 1) { return; }
        var interpretation = makeInterpretation(root, pitchName(root, true), chord.id,
          bass === root ? null : bass, bass === root ? null : pitchName(bass, true));
        candidates.push({ interpretation: interpretation, label: formatInterpretation(interpretation),
          match: missing.length + extra.length === 0 ? "exact" : "close", missing: missing, extra: extra });
      });
    });
    candidates.sort(function (a, b) {
      return (a.match === "exact" ? 0 : 1) - (b.match === "exact" ? 0 : 1) ||
        CHORD_BY_ID[a.interpretation.formulaId].intervals.length - CHORD_BY_ID[b.interpretation.formulaId].intervals.length ||
        a.label.length - b.label.length || a.interpretation.rootPc - b.interpretation.rootPc ||
        CHORDS.indexOf(CHORD_BY_ID[a.interpretation.formulaId]) - CHORDS.indexOf(CHORD_BY_ID[b.interpretation.formulaId]);
    });
    var exact = candidates.filter(function (candidate) { return candidate.match === "exact"; });
    return (exact.length ? exact : candidates).slice(0, 8);
  }
  function romanLabel(interpretation, context) {
    if (!interpretation || !context) { return ""; }
    var suffix = interpretation.formulaId;
    var numeral = ROMAN[normalizePitch(interpretation.rootPc - context.tonicPc)];
    if (suffix === "m7b5") { numeral = numeral.toLowerCase(); suffix = "ø7"; }
    else if (suffix.indexOf("dim") === 0) { numeral = numeral.toLowerCase(); suffix = "°" + suffix.slice(3); }
    else if (suffix === "aug") { suffix = "+"; }
    else if (/^m(?!aj)/.test(suffix)) { numeral = numeral.toLowerCase(); suffix = suffix.slice(1).replace(/^Maj/, "maj"); }
    return numeral + suffix + (interpretation.bassPc === null ? "" : "/" + interpretation.bassSpelling);
  }
  // Letter-aware scale spelling is adapted from Scalar Triads' pure helper.
  function scaleSpelling(tonicSpelling, scale, pc, index) {
    var rootIndex = NOTE_LETTERS.indexOf(tonicSpelling[0]);
    var letter = NOTE_LETTERS[(rootIndex + (scale.degreeLetters ? scale.degreeLetters[index] : index)) % 7];
    var alteration = normalizePitch(pc - NATURAL_PITCHES[letter]);
    if (alteration > 6) { alteration -= 12; }
    return letter + (alteration < 0 ? "b" : "#").repeat(Math.abs(alteration));
  }
  function chordsForScale(tonicPc, scaleId, tonicSpelling) {
    var scale = SCALE_BY_ID[scaleId];
    if (!scale) { return []; }
    tonicPc = normalizePitch(tonicPc);
    tonicSpelling = tonicSpelling || pitchName(tonicPc);
    var pitches = scale.intervals.map(function (interval) { return normalizePitch(interval + tonicPc); });
    var results = [];
    pitches.forEach(function (pc, index) {
      var spelling = scaleSpelling(tonicSpelling, scale, pc, index);
      CHORDS.forEach(function (chord) {
        var interpretation = makeInterpretation(pc, spelling, chord.id, null, null);
        var chordPitches = interpretationPitches(interpretation);
        if (!difference(chordPitches, pitches).length) {
          results.push({ interpretation: interpretation, label: formatInterpretation(interpretation), group: chord.group, pitches: chordPitches });
        }
      });
    });
    return results;
  }
  function matchScales(chords, settings, context) {
    var excludedChordIds = [];
    var analyzable = [];
    chords.forEach(function (chord) {
      var notes = notesForShape(settings.tuningMidi, settings.capo, chord.frets);
      var pitches = notes.length ? distinct(notes.map(function (note) { return note.pc; })) :
        chord.reviewRequired ? [] : interpretationPitches(chord.interpretation);
      if (pitches.length) { analyzable.push({ chordId: chord.id, pitches: pitches }); }
      else { excludedChordIds.push(chord.id); }
    });
    if (!analyzable.length) { return { candidates: [], excludedChordIds: excludedChordIds }; }
    var candidates = [];
    SCALES.forEach(function (scale) {
      for (var tonic = 0; tonic < 12; tonic += 1) {
        var scalePitches = scale.intervals.map(function (interval) { return normalizePitch(interval + tonic); });
        var memberships = analyzable.map(function (entry) {
          return { chordId: entry.chordId, pitches: entry.pitches.slice(), outside: difference(entry.pitches, scalePitches) };
        });
        var outlierCount = memberships.filter(function (entry) { return entry.outside.length > 0; }).length;
        candidates.push({ tonicPc: tonic, tonicSpelling: context && context.tonicPc === tonic ? context.tonicSpelling : pitchName(tonic),
          scaleId: scale.id, fitCount: analyzable.length - outlierCount, totalCount: analyzable.length, outlierCount: outlierCount,
          outsideCount: memberships.reduce(function (sum, entry) { return sum + entry.outside.length; }, 0), memberships: memberships });
      }
    });
    candidates.sort(function (a, b) {
      return a.outlierCount - b.outlierCount || a.outsideCount - b.outsideCount ||
        (context && b.tonicPc === context.tonicPc ? 1 : 0) - (context && a.tonicPc === context.tonicPc ? 1 : 0) ||
        SCALES.indexOf(SCALE_BY_ID[a.scaleId]) - SCALES.indexOf(SCALE_BY_ID[b.scaleId]) || a.tonicPc - b.tonicPc;
    });
    return { candidates: candidates, excludedChordIds: excludedChordIds };
  }
  function compareShapes(a, b) {
    var order = a.span - b.span || a.position - b.position || a.mutedCount - b.mutedCount;
    for (var index = 0; !order && index < 6; index += 1) {
      order = (a.frets[index] === null ? -1 : a.frets[index]) - (b.frets[index] === null ? -1 : b.frets[index]);
    }
    return order;
  }
  // Standard-tuning forms, written low E first. Keep this catalogue private:
  // matching search candidates still have to satisfy every voicing constraint.
  var FAMILIAR_FORMS = [
    [0, "", "x32010"], [9, "", "x02220"], [7, "", "320003"], [4, "", "022100"], [2, "", "xx0232"],
    [9, "m", "x02210"], [4, "m", "022000"], [2, "m", "xx0231"],
    [9, "7", "x02020"], [7, "7", "320001"], [4, "7", "020100"], [2, "7", "xx0212"],
    [0, "maj7", "x32000"], [9, "maj7", "x02120"], [7, "maj7", "320002"], [4, "maj7", "021100"], [2, "maj7", "xx0222"],
    [9, "m7", "x02010"], [4, "m7", "020000"], [2, "m7", "xx0211"]
  ];
  function familiarShapes(interpretation, tuning, capo, maxFret) {
    var keys = new Set();
    if (!tuning.every(function (note, index) { return note === DEFAULT_TUNING[index]; })) { return keys; }
    FAMILIAR_FORMS.forEach(function (form) {
      if (form[1] !== interpretation.formulaId) { return; }
      for (var shift = normalizePitch(interpretation.rootPc - capo - form[0]); shift <= maxFret; shift += 12) {
        var frets = form[2].split("").reverse().map(function (fret) { return fret === "x" ? null : Number(fret) + shift; });
        if (frets.every(function (fret) { return fret === null || fret <= maxFret; })) { keys.add(frets.join(",")); }
      }
    });
    return keys;
  }
  function bitCount(mask) {
    var count = 0;
    while (mask) { mask &= mask - 1; count += 1; }
    return count;
  }
  function findVoicings(interpretation, settings, options) {
    options = options || {};
    var signal = options.signal;
    if (signal && signal.aborted) { return Promise.resolve({ shapes: [], cancelled: true }); }
    var target = interpretationPitches(interpretation);
    var compact = options.mode === "compact";
    if (!target.length || target.length > (compact ? 3 : 6)) { return Promise.resolve({ shapes: [], cancelled: false }); }
    // Snapshot settings before yielding: later UI changes cannot modify this request.
    var tuning = settings.tuningMidi.slice();
    var capo = settings.capo;
    var bassPc = interpretation.bassPc === null && !compact ? interpretation.rootPc : interpretation.bassPc;
    var maxFret = 14 - capo;
    var familiar = compact ? new Set() : familiarShapes(interpretation, tuning, capo, maxFret);
    function compare(a, b) {
      if (compact) { return compareShapes(a, b); }
      return Number(familiar.has(b.frets.join(","))) - Number(familiar.has(a.frets.join(","))) ||
        (a.position + a.span) - (b.position + b.span) || a.mutedCount - b.mutedCount || compareShapes(a, b);
    }
    var targetMask = target.reduce(function (mask, pc) { return mask | (1 << pc); }, 0);
    var shapes = [];
    var frets = [null, null, null, null, null, null];

    // Search each four-fret-span window once. Its minimum positive fret must
    // equal the window start; this removes overlap without an unbounded cache.
    function* search() {
      for (var position = 1; position <= maxFret; position += 1) {
        for (var start = 0; start < (compact ? 4 : 1); start += 1) {
          var indexes = compact ? [start, start + 1, start + 2] : [0, 1, 2, 3, 4, 5];
          var choices = indexes.map(function (stringIndex) {
            var values = compact ? [] : [null];
            for (var fret = 0; fret <= Math.min(maxFret, position + 4); fret += 1) {
              if (fret > 0 && fret < position) { continue; }
              var midi = tuning[stringIndex] + capo + fret;
              var pc = normalizePitch(midi);
              if (targetMask & (1 << pc)) { values.push({ fret: fret, midi: midi, mask: 1 << pc }); }
            }
            return values;
          });
          var remainingMasks = new Array(indexes.length + 1).fill(0);
          for (var i = indexes.length - 1; i >= 0; i -= 1) {
            remainingMasks[i] = choices[i].reduce(function (mask, choice) { return mask | (choice ? choice.mask : 0); }, remainingMasks[i + 1]);
          }
          yield* visit(0, 0, 0, Infinity, 0, 0, false);
        }
      }

      function* visit(depth, mask, soundingCount, lowestMidi, minFret, highestFret, ended) {
        yield; // The scheduler bounds synchronous work by visited search nodes.
        var remaining = indexes.length - depth;
        if ((mask | remainingMasks[depth]) !== targetMask || bitCount(targetMask & ~mask) > remaining ||
            soundingCount + remaining < (compact ? 3 : 4)) { return; }
        if (depth === indexes.length) {
          if (mask !== targetMask || (bassPc !== null && normalizePitch(lowestMidi) !== bassPc) ||
              (minFret === 0 ? position !== 1 : minFret !== position)) { return; }
          var shape = { frets: frets.slice(), span: highestFret - minFret, position: minFret, mutedCount: 6 - soundingCount };
          shapes.push(shape);
          // Every template is also enumerated here. Matching by frets gives it
          // priority without a second insertion path or duplicate results.
          shapes.sort(compare);
          if (shapes.length > 8) { shapes.pop(); }
          return;
        }
        var stringIndex = indexes[depth];
        for (var choiceIndex = 0; choiceIndex < choices[depth].length; choiceIndex += 1) {
          var choice = choices[depth][choiceIndex];
          // Once a sounding run ends, only muted strings may follow.
          if (choice && ended) { continue; }
          frets[stringIndex] = choice ? choice.fret : null;
          yield* visit(depth + 1, mask | (choice ? choice.mask : 0), soundingCount + (choice ? 1 : 0),
            choice ? Math.min(lowestMidi, choice.midi) : lowestMidi,
            choice && choice.fret > 0 ? (minFret ? Math.min(minFret, choice.fret) : choice.fret) : minFret,
            choice ? Math.max(highestFret, choice.fret) : highestFret,
            ended || (!choice && soundingCount > 0));
        }
        frets[stringIndex] = null;
      }
    }

    return new Promise(function (resolve) {
      var iterator = search();
      var timer = null;
      var finished = false;
      function finish(cancelled) {
        if (finished) { return; }
        finished = true;
        clearTimeout(timer);
        if (signal) { signal.removeEventListener("abort", abort); }
        iterator.return();
        resolve({ shapes: cancelled ? [] : shapes, cancelled: cancelled });
      }
      function abort() { finish(true); }
      function chunk() {
        if (finished) { return; }
        if (signal && signal.aborted) { finish(true); return; }
        for (var visited = 0; visited < 1024; visited += 1) {
          if (iterator.next().done) { finish(false); return; }
        }
        timer = setTimeout(chunk, 0);
      }
      if (signal) { signal.addEventListener("abort", abort, { once: true }); }
      timer = setTimeout(chunk, 0);
    });
  }

  return freeze({
    chords: CHORDS, scales: SCALES, roots: ROOTS, presets: PRESETS, defaultTuning: DEFAULT_TUNING,
    parseChordSymbol: parseChordSymbol, normalizePitch: normalizePitch, pitchName: pitchName,
    formatInterpretation: formatInterpretation, interpretationPitches: interpretationPitches,
    transposeInterpretation: transposeInterpretation, notesForShape: notesForShape, identifyChord: identifyChord,
    romanLabel: romanLabel, chordsForScale: chordsForScale, matchScales: matchScales, findVoicings: findVoicings
  });
}));
