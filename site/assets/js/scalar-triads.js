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
  var ROOTS = SongNotebookMusic.roots;
  var MAX_FRET = 15;
  var MAX_TRIAD_SPAN = 3;
  var HISTORY_KEY = "cs-shadow.scalar-triads.recent-settings.v1";
  var HISTORY_VERSION = 2;
  var HISTORY_LIMIT = 5;
  var HISTORY_SAVE_DELAY = 1500;
  var SCALE_GROUPS = ["Major Modes", "Pentatonic & Blues", "Minor & Exotic"];

  var SCALES = SongNotebookMusic.scales;

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
  var tuningToggle = document.getElementById("scalar-tuning-toggle");
  var tuningPanel = document.getElementById("scalar-tuning-panel");
  var presetControls;
  var stringControls;
  var tuningDescription = document.getElementById("scale-tuning-description");
  var recentSettingsSelect = document.getElementById("scale-recent-settings");
  var clearHistoryButton = document.getElementById("scale-clear-history");
  var triadTarget = document.getElementById("triad-list");
  var selectedStringSetId = "strings-1-2-3";
  var tuning = GuitarTuning.defaultTuning();
  var history = [];
  var recentSettings;

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
    var stringSets = GuitarTuning.stringSets(tuning);
    return stringSets.filter(function (stringSet) {
      return stringSet.id === selectedStringSetId;
    })[0] || stringSets[0];
  }

  function snapshot() {
    return {
      root: rootSelect.value,
      scaleId: scaleSelect.value,
      stringSetId: selectedStringSetId,
      tuning: GuitarTuning.pitches(tuning)
    };
  }

  function isValidSnapshot(candidate) {
    return candidate &&
      typeof candidate.root === "string" && ROOTS.indexOf(candidate.root) !== -1 &&
      typeof candidate.scaleId === "string" && Boolean(SCALE_BY_ID[candidate.scaleId]) &&
      typeof candidate.stringSetId === "string" && GuitarTuning.stringSets(GuitarTuning.defaultTuning()).some(function (stringSet) {
        return stringSet.id === candidate.stringSetId;
      }) &&
      GuitarTuning.isValidPitches(candidate.tuning);
  }

  function snapshotsMatch(left, right) {
    return left.root === right.root &&
      left.scaleId === right.scaleId &&
      left.stringSetId === right.stringSetId && left.tuning.every(function (pitch, index) {
        return pitch === right.tuning[index];
      });
  }

  function historyLabel(entry) {
    var stringSet = GuitarTuning.stringSets(GuitarTuning.fromPitches(entry.tuning)).filter(function (set) {
      return set.id === entry.stringSetId;
    })[0];
    return entry.root + " " + SCALE_BY_ID[entry.scaleId].name + " · " + stringSet.label + " · " + GuitarTuning.label(GuitarTuning.fromPitches(entry.tuning));
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

  function applySnapshot(entry) {
    rootSelect.value = entry.root;
    scaleSelect.value = entry.scaleId;
    selectedStringSetId = entry.stringSetId;
    tuning = GuitarTuning.fromPitches(entry.tuning);
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

    tuning.forEach(function (string) {
      var row = document.createElement("div");
      row.className = "fretboard-row";

      var label = document.createElement("div");
      label.className = "string-label scalar-triads-string-label";
      label.textContent = string.label;
      label.title = "String " + string.guitarString + ", open " + string.label;
      label.setAttribute("aria-label", label.title);
      row.appendChild(label);

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var cell = document.createElement("div");
        var note = fretNote(string, fret, preferFlats, scaleNoteNames);
        var inScale = scalePitches.indexOf(note.pitch) !== -1;
        cell.className = "fret-cell" + (fret === 0 ? " open" : fret === 1 ? " nut" : "") + (inScale ? " active" : "") + (note.pitch === rootPitch ? " root" : "");
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

  function renderTriadStrip(voicing, strings, rootPitch) {
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
        cell.className = "fret-cell" + (fret === 0 ? " open" : fret === 1 ? " nut" : "");

        if (voicingNote.fret === fret) {
          var marker = document.createElement("span");
          cell.className += " active" + (voicingNote.pitch === rootPitch ? " root" : "");
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
    var stringSets = GuitarTuning.stringSets(tuning);

    Array.prototype.forEach.call(buttons, function (button) {
      var active = button.getAttribute("data-string-set") === selectedStringSetId;
      var stringSet = stringSets.filter(function (set) {
        return set.id === button.getAttribute("data-string-set");
      })[0];
      button.textContent = stringSet.label;
      button.classList.toggle("active", active);
      button.setAttribute("aria-pressed", active ? "true" : "false");
    });
  }

  function renderTuningControls() {
    var pitches = GuitarTuning.pitches(tuning);
    presetControls.update(pitches);
    stringControls.update(pitches);
    tuningToggle.textContent = GuitarTuning.label(tuning) + " tuning · " + tuning.slice().reverse().map(function (string) { return string.label; }).join(" · ");
    tuningDescription.textContent = GuitarTuning.label(tuning) + " tuning, frets 0-15";
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
        strips.appendChild(renderTriadStrip(voicing, stringSet.strings, triad.root.pitch));
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
      renderTuningControls();
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
  recentSettings = RecentSettings.create({
    key: HISTORY_KEY,
    version: HISTORY_VERSION,
    limit: HISTORY_LIMIT,
    delay: HISTORY_SAVE_DELAY,
    snapshot: snapshot,
    normalize: function (candidate) {
      if (candidate && !candidate.tuning) {
        candidate = {
          root: candidate.root,
          scaleId: candidate.scaleId,
          stringSetId: candidate.stringSetId,
          tuning: GuitarTuning.pitches(GuitarTuning.defaultTuning())
        };
      }
      return isValidSnapshot(candidate) ? candidate : null;
    },
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
  rootSelect.addEventListener("change", function () {
    render();
    recentSettings.schedule();
  });
  scaleSelect.addEventListener("change", function () {
    render();
    recentSettings.schedule();
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
  function changeTuning(pitches) {
    tuning = GuitarTuning.fromPitches(pitches);
    render();
    recentSettings.schedule();
  }
  presetControls = MusicToolControls.mountPresets(document.getElementById("scalar-tuning-presets"), {
    presets: Object.keys(GuitarTuning.presets).map(function (key) {
      var preset = GuitarTuning.presets[key];
      return { id: key, label: preset.label, values: preset.pitches };
    }),
    values: GuitarTuning.pitches(tuning),
    onChange: changeTuning
  });
  stringControls = MusicToolControls.mountStringNotes(document.getElementById("scalar-tuning-strings"), document.getElementById("scalar-tuning-picker"), {
    id: "scalar-string-note-picker",
    values: GuitarTuning.pitches(tuning),
    octaves: false,
    onChange: changeTuning
  });
  function closeTuning() {
    stringControls.close();
    tuningPanel.hidden = true;
    tuningToggle.setAttribute("aria-expanded", "false");
    tuningToggle.focus();
  }
  tuningToggle.addEventListener("click", function () {
    if (!tuningPanel.hidden) { closeTuning(); return; }
    tuningPanel.hidden = false;
    tuningToggle.setAttribute("aria-expanded", "true");
  });
  tuningPanel.addEventListener("keydown", function (event) {
    if (event.key === "Escape" && !event.defaultPrevented) {
      event.preventDefault();
      closeTuning();
    }
  });
  form.addEventListener("submit", function (event) { event.preventDefault(); });
  renderHistoryControls();
  render();
}());
