(function () {
  "use strict";

  var SHARP_NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var FLAT_NOTES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
  var NOTE_LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
  var NATURAL_PITCHES = {
    C: 0,
    D: 2,
    E: 4,
    F: 5,
    G: 7,
    A: 9,
    B: 11
  };
  var ROOTS = ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"];
  var TUNING = [
    { name: "E", pitch: 4 },
    { name: "B", pitch: 11 },
    { name: "G", pitch: 7 },
    { name: "D", pitch: 2 },
    { name: "A", pitch: 9 },
    { name: "E", pitch: 4 }
  ];
  var STRING_SETS = [
    { id: "strings-1-2-3", label: "E-B-G", strings: TUNING.slice(0, 3) },
    { id: "strings-2-3-4", label: "B-G-D", strings: TUNING.slice(1, 4) },
    { id: "strings-3-4-5", label: "G-D-A", strings: TUNING.slice(2, 5) },
    { id: "strings-4-5-6", label: "D-A-E", strings: TUNING.slice(3, 6) }
  ];
  var MAX_FRET = 15;
  var MAX_TRIAD_SPAN = 3;
  var HISTORY_KEY = "cs-shadow.scalar-triads.recent-settings.v1";
  var HISTORY_VERSION = 1;
  var HISTORY_LIMIT = 5;
  var HISTORY_SAVE_DELAY = 1500;
  var SCALE_GROUPS = ["Major Modes", "Pentatonic & Blues", "Minor & Exotic"];

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

  var ROMAN = ["I", "II", "III", "IV", "V", "VI", "VII"];
  var SCALE_BY_ID = {};
  var rootSelect = document.getElementById("scale-root");
  var scaleSelect = document.getElementById("scale-type");
  var form = document.getElementById("scale-form");
  var error = document.getElementById("scale-error");
  var notice = document.getElementById("scale-notice");
  var title = document.getElementById("result-title");
  var notesTarget = document.getElementById("scale-notes");
  var modeFeelTarget = document.getElementById("mode-feel");
  var fretboardTarget = document.getElementById("scale-fretboard");
  var chordSummaryTarget = document.getElementById("chord-summary");
  var stringSetSelector = document.getElementById("string-set-selector");
  var recentSettingsSelect = document.getElementById("scale-recent-settings");
  var clearHistoryButton = document.getElementById("scale-clear-history");
  var triadTarget = document.getElementById("triad-list");
  var selectedStringSetId = "strings-1-2-3";
  var history = [];
  var pendingSaveTimer = null;

  function normalizePitch(pitch) {
    return ((pitch % 12) + 12) % 12;
  }

  function notePitch(note) {
    var normalized = note.replace("♯", "#").replace("♭", "b");
    var index = SHARP_NOTES.indexOf(normalized);

    if (index !== -1) {
      return index;
    }

    return FLAT_NOTES.indexOf(normalized);
  }

  function pitchName(pitch, preferFlats) {
    return (preferFlats ? FLAT_NOTES : SHARP_NOTES)[normalizePitch(pitch)];
  }

  function rootLetter(root) {
    return root.charAt(0).toUpperCase();
  }

  function accidentalForPitch(targetPitch, naturalPitch) {
    var difference = normalizePitch(targetPitch - naturalPitch);

    if (difference === 0) {
      return "";
    }

    if (difference <= 6) {
      return new Array(difference + 1).join("#");
    }

    return new Array(13 - difference).join("b");
  }

  function spelledPitchName(root, scale, pitch, index) {
    var rootIndex = NOTE_LETTERS.indexOf(rootLetter(root));
    var degreeLetters = scale.degreeLetters || scale.intervals.map(function (_, degreeIndex) {
      return degreeIndex;
    });
    var letter = NOTE_LETTERS[(rootIndex + degreeLetters[index]) % NOTE_LETTERS.length];

    return letter + accidentalForPitch(pitch, NATURAL_PITCHES[letter]);
  }

  function buildIndexes() {
    SCALES.forEach(function (scale) {
      SCALE_BY_ID[scale.id] = scale;
    });
  }

  function populateControls() {
    ROOTS.forEach(function (root) {
      var option = document.createElement("option");
      option.value = root;
      option.textContent = root;
      rootSelect.appendChild(option);
    });

    SCALE_GROUPS.forEach(function (groupName) {
      var group = document.createElement("optgroup");
      group.label = groupName;

      SCALES.filter(function (scale) {
        return scale.group === groupName;
      }).forEach(function (scale) {
        var option = document.createElement("option");
        option.value = scale.id;
        option.textContent = scale.name;
        group.appendChild(option);
      });

      scaleSelect.appendChild(group);
    });

    rootSelect.value = "A";
    scaleSelect.value = "major";
  }

  function currentSelection() {
    return {
      root: rootSelect.value,
      scale: SCALE_BY_ID[scaleSelect.value]
    };
  }

  function currentStringSet() {
    return STRING_SETS.filter(function (stringSet) {
      return stringSet.id === selectedStringSetId;
    })[0] || STRING_SETS[0];
  }

  function snapshot() {
    return {
      root: rootSelect.value,
      scaleId: scaleSelect.value,
      stringSetId: selectedStringSetId
    };
  }

  function isValidSnapshot(candidate) {
    return candidate &&
      typeof candidate.root === "string" && ROOTS.indexOf(candidate.root) !== -1 &&
      typeof candidate.scaleId === "string" && Boolean(SCALE_BY_ID[candidate.scaleId]) &&
      typeof candidate.stringSetId === "string" && STRING_SETS.some(function (stringSet) {
        return stringSet.id === candidate.stringSetId;
      });
  }

  function snapshotsMatch(left, right) {
    return left.root === right.root &&
      left.scaleId === right.scaleId &&
      left.stringSetId === right.stringSetId;
  }

  function readHistory() {
    try {
      var stored = window.localStorage.getItem(HISTORY_KEY);
      var payload = stored ? JSON.parse(stored) : null;

      if (!payload || payload.version !== HISTORY_VERSION || !Array.isArray(payload.entries)) {
        return [];
      }

      return payload.entries.reduce(function (entries, candidate) {
        if (isValidSnapshot(candidate) && !entries.some(function (entry) {
          return snapshotsMatch(entry, candidate);
        })) {
          entries.push(candidate);
        }
        return entries;
      }, []).slice(0, HISTORY_LIMIT);
    } catch (err) {
      return [];
    }
  }

  function writeHistory() {
    try {
      window.localStorage.setItem(HISTORY_KEY, JSON.stringify({
        version: HISTORY_VERSION,
        entries: history
      }));
    } catch (err) {
      // Storage is optional, including in private browsing contexts.
    }
  }

  function historyLabel(entry) {
    return entry.root + " " + SCALE_BY_ID[entry.scaleId].name + " · " + STRING_SETS.filter(function (stringSet) {
      return stringSet.id === entry.stringSetId;
    })[0].label;
  }

  function renderHistoryControls() {
    if (!recentSettingsSelect || !clearHistoryButton) {
      return;
    }

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

  function saveSnapshot() {
    var current = snapshot();
    history = [current].concat(history.filter(function (entry) {
      return !snapshotsMatch(entry, current);
    })).slice(0, HISTORY_LIMIT);
    writeHistory();
    renderHistoryControls();
  }

  function scheduleSnapshotSave() {
    if (pendingSaveTimer !== null) {
      window.clearTimeout(pendingSaveTimer);
    }

    pendingSaveTimer = window.setTimeout(function () {
      pendingSaveTimer = null;
      saveSnapshot();
    }, HISTORY_SAVE_DELAY);
  }

  function flushPendingSnapshotSave() {
    if (pendingSaveTimer === null) {
      return;
    }

    window.clearTimeout(pendingSaveTimer);
    pendingSaveTimer = null;
    saveSnapshot();
  }

  function cancelPendingSnapshotSave() {
    if (pendingSaveTimer !== null) {
      window.clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
    }
  }

  function applySnapshot(entry) {
    rootSelect.value = entry.root;
    scaleSelect.value = entry.scaleId;
    selectedStringSetId = entry.stringSetId;
  }

  function scaleNotes(root, scale) {
    var rootPitch = notePitch(root);

    return scale.intervals.map(function (interval, index) {
      var pitch = normalizePitch(rootPitch + interval);

      return {
        degree: index + 1,
        interval: interval,
        pitch: pitch,
        name: spelledPitchName(root, scale, pitch, index),
        isRoot: interval === 0
      };
    });
  }

  function hasDoubleAccidentals(notes) {
    return notes.some(function (note) {
      return note.name.indexOf("bb") !== -1 || note.name.indexOf("##") !== -1;
    });
  }

  function accidentalComplexity(notes) {
    return notes.reduce(function (score, note) {
      var doubleAccidentals = (note.name.match(/bb|##/g) || []).length;
      var singleAccidentals = (note.name.match(/b|#/g) || []).length - (doubleAccidentals * 2);

      return score + (doubleAccidentals * 100) + singleAccidentals;
    }, 0);
  }

  function enharmonicRootOptions(root) {
    var rootPitch = notePitch(root);

    return ROOTS.filter(function (candidate) {
      return notePitch(candidate) === rootPitch;
    });
  }

  function resolvedScaleSelection(selection) {
    var notes = scaleNotes(selection.root, selection.scale);
    var best = {
      root: selection.root,
      scale: selection.scale,
      notes: notes,
      complexity: accidentalComplexity(notes)
    };

    if (!hasDoubleAccidentals(notes)) {
      return best;
    }

    enharmonicRootOptions(selection.root).forEach(function (root) {
      var candidateNotes = scaleNotes(root, selection.scale);
      var candidateComplexity = accidentalComplexity(candidateNotes);

      if (candidateComplexity < best.complexity) {
        best = {
          root: root,
          scale: selection.scale,
          notes: candidateNotes,
          complexity: candidateComplexity,
          originalRoot: selection.root
        };
      }
    });

    if (best.root !== selection.root) {
      best.originalRoot = selection.root;
    }

    return best;
  }

  function chordQuality(intervals) {
    var third = intervals[1];
    var fifth = intervals[2];

    if (third === 4 && fifth === 7) {
      return { name: "major", suffix: "", roman: "upper" };
    }

    if (third === 3 && fifth === 7) {
      return { name: "minor", suffix: "m", roman: "lower" };
    }

    if (third === 3 && fifth === 6) {
      return { name: "diminished", suffix: "dim", roman: "lower-dim" };
    }

    if (third === 4 && fifth === 8) {
      return { name: "augmented", suffix: "aug", roman: "upper-aug" };
    }

    if (third === 5 && fifth === 7) {
      return { name: "sus4", suffix: "sus4", roman: "upper" };
    }

    if (third === 2 && fifth === 7) {
      return { name: "sus2", suffix: "sus2", roman: "upper" };
    }

    return { name: "triad", suffix: "", roman: "upper" };
  }

  function romanNumeral(index, quality) {
    var numeral = ROMAN[index] || String(index + 1);

    if (quality.roman.indexOf("lower") === 0) {
      numeral = numeral.toLowerCase();
    }

    if (quality.roman.indexOf("dim") !== -1) {
      numeral += "°";
    }

    if (quality.roman.indexOf("aug") !== -1) {
      numeral += "+";
    }

    return numeral;
  }

  function buildTriads(notes) {
    return notes.map(function (note, index) {
      var third = notes[(index + 2) % notes.length];
      var fifth = notes[(index + 4) % notes.length];
      var pitches = [note.pitch, third.pitch, fifth.pitch];
      var intervals = pitches.map(function (pitch) {
        return normalizePitch(pitch - note.pitch);
      });
      var quality = chordQuality(intervals);

      return {
        degree: index + 1,
        roman: romanNumeral(index, quality),
        root: note,
        notes: [note, third, fifth],
        pitches: pitches,
        quality: quality,
        name: note.name + quality.suffix
      };
    });
  }

  function noteNamesByPitch(notes) {
    var names = {};

    notes.forEach(function (note) {
      names[note.pitch] = note.name;
    });

    return names;
  }

  function fretNote(string, fret, preferFlats, scaleNoteNames) {
    var pitch = normalizePitch(string.pitch + fret);

    return {
      string: string.name,
      fret: fret,
      pitch: pitch,
      name: scaleNoteNames && scaleNoteNames[pitch] ? scaleNoteNames[pitch] : pitchName(pitch, preferFlats)
    };
  }

  function renderNotes(notes) {
    notesTarget.innerHTML = "";

    notes.forEach(function (note) {
      var item = document.createElement("li");
      item.className = note.isRoot ? "root-note" : "";
      item.textContent = note.name;
      notesTarget.appendChild(item);
    });
  }

  function renderModeFeel(scale) {
    modeFeelTarget.innerHTML = "";

    var label = document.createElement("strong");
    var text = document.createElement("span");

    label.textContent = "Suggested feel";
    text.textContent = scale.feel;

    modeFeelTarget.appendChild(label);
    modeFeelTarget.appendChild(text);
  }

  function renderScaleFretboard(notes, rootPitch, preferFlats) {
    var scalePitches = notes.map(function (note) { return note.pitch; });
    var scaleNoteNames = noteNamesByPitch(notes);

    fretboardTarget.innerHTML = "";
    fretboardTarget.style.setProperty("--fret-count", MAX_FRET + 1);

    TUNING.forEach(function (string) {
      var row = document.createElement("div");
      row.className = "fretboard-row";

      var label = document.createElement("div");
      label.className = "string-label";
      label.textContent = string.name;
      row.appendChild(label);

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var cell = document.createElement("div");
        var note = fretNote(string, fret, preferFlats, scaleNoteNames);
        var inScale = scalePitches.indexOf(note.pitch) !== -1;
        cell.className = "fret-cell" + (inScale ? " active" : "") + (note.pitch === rootPitch ? " root" : "");
        cell.setAttribute("aria-label", string.name + " string fret " + fret + (inScale ? " " + note.name : ""));

        if (inScale) {
          var marker = document.createElement("span");
          marker.textContent = note.name;
          cell.appendChild(marker);
        }

        row.appendChild(cell);
      }

      fretboardTarget.appendChild(row);
    });

    renderFretNumbers(fretboardTarget);
  }

  function renderFretNumbers(target) {
    var row = document.createElement("div");
    row.className = "fret-number-row";
    var spacer = document.createElement("div");
    spacer.className = "string-label";
    row.appendChild(spacer);

    for (var fret = 0; fret <= MAX_FRET; fret += 1) {
      var cell = document.createElement("div");
      cell.className = "fret-number";
      cell.textContent = fret;
      row.appendChild(cell);
    }

    target.appendChild(row);
  }

  function combinationsByString(strings, chordPitches, preferFlats, scaleNoteNames) {
    return strings.map(function (string) {
      var matches = [];

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var note = fretNote(string, fret, preferFlats, scaleNoteNames);

        if (chordPitches.indexOf(note.pitch) !== -1) {
          matches.push(note);
        }
      }

      return matches;
    });
  }

  function triadVoicings(chord, strings, preferFlats, scaleNoteNames) {
    var choices = combinationsByString(strings, chord.pitches, preferFlats, scaleNoteNames);
    var voicings = [];

    choices[0].forEach(function (first) {
      choices[1].forEach(function (second) {
        choices[2].forEach(function (third) {
          var notes = [first, second, third];
          var uniquePitches = [];
          var frets = notes.map(function (note) { return note.fret; });
          var minFret = Math.min.apply(Math, frets);
          var maxFret = Math.max.apply(Math, frets);

          notes.forEach(function (note) {
            if (uniquePitches.indexOf(note.pitch) === -1) {
              uniquePitches.push(note.pitch);
            }
          });

          if (uniquePitches.length === 3 && maxFret - minFret <= MAX_TRIAD_SPAN) {
            voicings.push({
              notes: notes,
              minFret: minFret,
              maxFret: maxFret
            });
          }
        });
      });
    });

    return voicings
      .sort(function (a, b) {
        if (a.minFret !== b.minFret) {
          return a.minFret - b.minFret;
        }

        return a.maxFret - b.maxFret;
      })
      .slice(0, 8);
  }

  function renderTriadStrip(voicing, strings) {
    var strip = document.createElement("div");
    var startFret = voicing.minFret === 0 ? 0 : voicing.minFret;
    var endFret = Math.min(MAX_FRET, Math.max(startFret + 3, voicing.maxFret));
    strip.className = "triad-strip";
    strip.style.setProperty("--fret-count", endFret - startFret + 1);

    strings.forEach(function (string, stringIndex) {
      var row = document.createElement("div");
      row.className = "fretboard-row";

      var label = document.createElement("div");
      label.className = "string-label";
      label.textContent = string.name;
      row.appendChild(label);

      for (var fret = startFret; fret <= endFret; fret += 1) {
        var cell = document.createElement("div");
        var voicingNote = voicing.notes[stringIndex];
        cell.className = "fret-cell";

        if (voicingNote.fret === fret) {
          var marker = document.createElement("span");
          cell.className += " active";
          marker.textContent = voicingNote.name;
          cell.appendChild(marker);
        }

        row.appendChild(cell);
      }

      strip.appendChild(row);
    });

    renderTriadFretNumbers(strip, startFret, endFret);

    return strip;
  }

  function renderTriadFretNumbers(target, startFret, endFret) {
    var row = document.createElement("div");
    row.className = "fret-number-row";
    var spacer = document.createElement("div");
    spacer.className = "string-label";
    row.appendChild(spacer);

    for (var fret = startFret; fret <= endFret; fret += 1) {
      var cell = document.createElement("div");
      cell.className = "fret-number";
      cell.textContent = fret;
      row.appendChild(cell);
    }

    target.appendChild(row);
  }

  function updateStringSetSelector() {
    var buttons = stringSetSelector.querySelectorAll("button[data-string-set]");

    Array.prototype.forEach.call(buttons, function (button) {
      var active = button.getAttribute("data-string-set") === selectedStringSetId;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderTriads(triads, preferFlats, scaleNoteNames) {
    var stringSet = currentStringSet();
    triadTarget.innerHTML = "";
    updateStringSetSelector();

    triads.forEach(function (triad) {
      var item = document.createElement("article");
      var heading = document.createElement("header");
      var voicings = triadVoicings(triad, stringSet.strings, preferFlats, scaleNoteNames);
      item.className = "triad-card";

      heading.className = "triad-card-heading";
      heading.innerHTML = "<h3>" + triad.roman + " " + triad.name + "</h3><p>" + triad.notes.map(function (note) {
        return note.name;
      }).join(" - ") + " · " + triad.quality.name + "</p>";
      item.appendChild(heading);

      var strips = document.createElement("div");
      strips.className = "triad-strips";

      voicings.forEach(function (voicing) {
        strips.appendChild(renderTriadStrip(voicing, stringSet.strings));
      });

      if (!voicings.length) {
        var empty = document.createElement("p");
        empty.className = "empty-state";
        empty.textContent = "No compact " + stringSet.label + " voicings found in frets 0-15.";
        strips.appendChild(empty);
      }

      item.appendChild(strips);
      triadTarget.appendChild(item);
    });
  }

  function renderChordSummary(triads) {
    chordSummaryTarget.innerHTML = "";

    triads.forEach(function (triad) {
      var item = document.createElement("li");
      var degree = document.createElement("span");
      var name = document.createElement("strong");
      var notes = document.createElement("small");

      degree.textContent = triad.roman;
      name.textContent = triad.name;
      notes.textContent = triad.notes.map(function (note) {
        return note.name;
      }).join(" - ");

      item.appendChild(degree);
      item.appendChild(name);
      item.appendChild(notes);
      chordSummaryTarget.appendChild(item);
    });
  }

  function render() {
    try {
      var selection = currentSelection();
      var resolvedSelection = resolvedScaleSelection(selection);
      var preferFlats = resolvedSelection.root.indexOf("b") !== -1;
      var rootPitch = notePitch(resolvedSelection.root);
      var notes = resolvedSelection.notes;
      var triads = buildTriads(notes);
      var scaleNoteNames = noteNamesByPitch(notes);

      error.textContent = "";
      if (notice) {
        notice.textContent = resolvedSelection.originalRoot
          ? "Showing " + resolvedSelection.root + " " + selection.scale.name + " instead of " + resolvedSelection.originalRoot + " " + selection.scale.name + " to avoid double accidentals."
          : "";
      }
      rootSelect.value = resolvedSelection.root;
      scaleSelect.value = selection.scale.id;
      title.textContent = resolvedSelection.root + " " + selection.scale.name;
      renderNotes(notes);
      renderModeFeel(selection.scale);
      renderScaleFretboard(notes, rootPitch, preferFlats);
      renderChordSummary(triads);
      renderTriads(triads, preferFlats, scaleNoteNames);
    } catch (err) {
      error.textContent = err.message;
      if (notice) {
        notice.textContent = "";
      }
    }
  }

  if (!form) {
    return;
  }

  buildIndexes();
  populateControls();
  history = readHistory();
  if (history.length) {
    applySnapshot(history[0]);
  }
  rootSelect.addEventListener("change", function () {
    render();
    scheduleSnapshotSave();
  });
  scaleSelect.addEventListener("change", function () {
    render();
    scheduleSnapshotSave();
  });
  stringSetSelector.addEventListener("click", function (event) {
    var button = event.target.closest("button[data-string-set]");

    if (!button) {
      return;
    }

    if (selectedStringSetId === button.getAttribute("data-string-set")) {
      return;
    }

    selectedStringSetId = button.getAttribute("data-string-set");
    render();
    scheduleSnapshotSave();
  });
  recentSettingsSelect.addEventListener("change", function (event) {
    var entry = history[Number(event.currentTarget.value)];

    if (!entry) {
      return;
    }

    cancelPendingSnapshotSave();
    applySnapshot(entry);
    render();
    saveSnapshot();
  });
  clearHistoryButton.addEventListener("click", function () {
    cancelPendingSnapshotSave();
    history = [];
    try {
      window.localStorage.removeItem(HISTORY_KEY);
    } catch (err) {
      // Storage is optional, including in private browsing contexts.
    }
    renderHistoryControls();
  });
  window.addEventListener("pagehide", flushPendingSnapshotSave);
  document.addEventListener("visibilitychange", function () {
    if (document.visibilityState === "hidden") {
      flushPendingSnapshotSave();
    }
  });
  renderHistoryControls();
  render();
}());
