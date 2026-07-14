(function () {
  "use strict";

  var NOTES = GuitarTuning.notes;
  var FLAT_EQUIVALENTS = {
    1: "Db",
    3: "Eb",
    6: "Gb",
    8: "Ab",
    10: "Bb"
  };
  var PRESETS = GuitarTuning.presets;
  var MAX_FRET = 15;
  var SAMPLE_SHAPE = [0, 1, 0, 2, 3, null];
  var HISTORY_KEY = "cs-shadow.guitar-chordinator.recent-settings.v1";
  var HISTORY_VERSION = 2;
  var HISTORY_LIMIT = 5;
  var HISTORY_SAVE_DELAY = 1500;

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

  var fretboard = document.getElementById("chordinator-fretboard");
  var selectedNotesTarget = document.getElementById("selected-notes");
  var matchesTarget = document.getElementById("chord-matches");
  var shapeTarget = document.getElementById("chordinator-shape");
  var clearButton = document.getElementById("chordinator-clear");
  var sampleButton = document.getElementById("chordinator-sample");
  var tuningDescription = document.getElementById("chordinator-tuning-description");
  var presetSelect = document.getElementById("chordinator-preset");
  var recentSettingsSelect = document.getElementById("chordinator-recent-settings");
  var clearHistoryButton = document.getElementById("chordinator-clear-history");
  var selection = SAMPLE_SHAPE.slice();
  var tuning = GuitarTuning.defaultTuning();
  var history = [];
  var recentSettings;

  function normalizePitch(pitch) {
    return GuitarTuning.normalizePitch(pitch);
  }

  function pitchName(pitch) {
    return GuitarTuning.pitchName(pitch);
  }

  function friendlyPitchName(pitch) {
    var normalized = normalizePitch(pitch);
    return FLAT_EQUIVALENTS[normalized] || NOTES[normalized];
  }

  function uniquePitches(notes) {
    var seen = {};
    return notes.reduce(function (pitches, note) {
      if (!seen[note.pitch]) {
        seen[note.pitch] = true;
        pitches.push(note.pitch);
      }
      return pitches;
    }, []);
  }

  function intervalSet(intervals) {
    var seen = {};
    intervals.forEach(function (interval) {
      seen[normalizePitch(interval)] = true;
    });
    return Object.keys(seen).map(function (pitch) {
      return Number(pitch);
    }).sort(function (a, b) {
      return a - b;
    });
  }

  function setDifference(left, right) {
    return left.filter(function (value) {
      return right.indexOf(value) === -1;
    });
  }

  function setsEqual(left, right) {
    return left.length === right.length && setDifference(left, right).length === 0;
  }

  function selectedNotes() {
    return selection.reduce(function (notes, fret, index) {
      if (fret === null) {
        return notes;
      }

      var string = tuning[index];
      var pitch = normalizePitch(string.pitch + fret);
      notes.push({
        stringIndex: index,
        stringNumber: string.guitarString,
        fret: fret,
        pitch: pitch,
        name: pitchName(pitch)
      });
      return notes;
    }, []);
  }

  function bassPitch(notes) {
    var bass = notes.slice().sort(function (a, b) {
      return b.stringIndex - a.stringIndex;
    })[0];
    return bass ? bass.pitch : null;
  }

  function intervalLabel(interval) {
    var labels = {
      0: "1",
      1: "b2",
      2: "2/9",
      3: "b3/#9",
      4: "3",
      5: "4/11",
      6: "b5/#11",
      7: "5",
      8: "#5/b13",
      9: "6/13",
      10: "b7",
      11: "7"
    };
    return labels[normalizePitch(interval)];
  }

  function chordName(root, chord, bass) {
    var name = friendlyPitchName(root) + chord.suffix;
    if (bass !== null && bass !== root) {
      name += "/" + friendlyPitchName(bass);
    }
    return name;
  }

  function candidateFor(root, chord, playedPitches, bass) {
    var chordSet = intervalSet(chord.intervals);
    var playedSet = playedPitches.map(function (pitch) {
      return normalizePitch(pitch - root);
    }).sort(function (a, b) {
      return a - b;
    });
    var missing = setDifference(chordSet, playedSet);
    var extra = setDifference(playedSet, chordSet);
    var exact = setsEqual(chordSet, playedSet);

    if (!exact && (missing.length + extra.length > 1 || missing.indexOf(0) !== -1)) {
      return null;
    }

    return {
      name: chordName(root, chord, bass),
      root: friendlyPitchName(root),
      quality: chord.quality,
      intervals: playedSet.map(intervalLabel),
      missing: missing.map(intervalLabel),
      extra: extra.map(intervalLabel),
      exact: exact,
      score: (exact ? 0 : 10) + missing.length + extra.length + chordSet.length / 10
    };
  }

  function findMatches(notes) {
    var pitches = uniquePitches(notes);
    var bass = bassPitch(notes);
    var candidates = [];

    if (pitches.length < 2) {
      return [];
    }

    pitches.forEach(function (root) {
      CHORDS.forEach(function (chord) {
        var candidate = candidateFor(root, chord, pitches, bass);
        if (candidate) {
          candidates.push(candidate);
        }
      });
    });

    candidates.sort(function (a, b) {
      if (a.exact !== b.exact) {
        return a.exact ? -1 : 1;
      }
      return a.score - b.score || a.name.length - b.name.length;
    });

    if (candidates.some(function (candidate) { return candidate.exact; })) {
      return candidates.filter(function (candidate) {
        return candidate.exact;
      }).slice(0, 8);
    }

    return candidates.slice(0, 8);
  }

  function shapeText() {
    return selection.slice().reverse().map(function (fret) {
      return fret === null ? "x" : String(fret);
    }).join("");
  }

  function tuningPresetKey() {
    return GuitarTuning.presetKey(tuning);
  }

  function tuningDescriptionText() {
    var key = tuningPresetKey();
    return GuitarTuning.label(tuning) + " tuning, frets 0-15";
  }

  function snapshot() {
    return {
      tuning: GuitarTuning.pitches(tuning),
      selection: selection.slice()
    };
  }

  function isValidSnapshot(candidate) {
    return candidate && GuitarTuning.isValidPitches(candidate.tuning) && Array.isArray(candidate.selection) && candidate.selection.length === 6 &&
      candidate.selection.every(function (fret) {
        return fret === null || (Number.isInteger(fret) && fret >= 0 && fret <= MAX_FRET);
      });
  }

  function snapshotsMatch(left, right) {
    return left.tuning.every(function (pitch, index) {
      return pitch === right.tuning[index];
    }) && left.selection.every(function (fret, index) {
      return fret === right.selection[index];
    });
  }

  function historyLabel(entry) {
    var tuningLabel = GuitarTuning.label(GuitarTuning.fromPitches(entry.tuning));
    var shape = entry.selection.slice().reverse().map(function (fret) {
      return fret === null ? "x" : String(fret);
    }).join("");

    return shape + " · " + tuningLabel;
  }

  function renderHistoryControls() {
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
    tuning = GuitarTuning.fromPitches(entry.tuning);
    selection = entry.selection.slice();
  }

  function renderTuningControls() {
    presetSelect.value = tuningPresetKey();
    tuningDescription.textContent = tuningDescriptionText();
  }

  function renderFretboard() {
    fretboard.textContent = "";
    fretboard.style.setProperty("--fret-count", MAX_FRET + 1);

    var numberRow = document.createElement("div");
    numberRow.className = "fret-number-row";
    numberRow.appendChild(document.createElement("span"));

    for (var fret = 0; fret <= MAX_FRET; fret += 1) {
      var number = document.createElement("span");
      number.className = "fret-number";
      number.textContent = fret;
      numberRow.appendChild(number);
    }
    fretboard.appendChild(numberRow);

    tuning.forEach(function (string, stringIndex) {
      var row = document.createElement("div");
      row.className = "fretboard-row";

      var label = document.createElement("div");
      label.className = "string-label chordinator-string-label";
      var name = document.createElement("span");
      name.className = "chordinator-string-name";
      name.textContent = string.label;
      name.title = "String " + string.guitarString + ", open " + string.label;
      var tuningSelect = document.createElement("select");
      tuningSelect.id = "chordinator-string-" + string.guitarString;
      tuningSelect.setAttribute("aria-label", "String " + string.guitarString + " tuning, currently " + string.label);
      NOTES.forEach(function (note, pitch) {
        var option = document.createElement("option");
        option.value = pitch;
        option.textContent = note;
        tuningSelect.appendChild(option);
      });
      tuningSelect.value = string.pitch;
      tuningSelect.addEventListener("change", function (event) {
        tuning[stringIndex].pitch = Number(event.currentTarget.value);
        tuning[stringIndex].label = pitchName(tuning[stringIndex].pitch);
        render();
        recentSettings.schedule();
      });
      var mute = document.createElement("button");
      mute.type = "button";
      mute.className = "string-mute";
      mute.textContent = "x";
      mute.setAttribute("aria-label", "Mute string " + string.guitarString);
      mute.setAttribute("aria-pressed", selection[stringIndex] === null ? "true" : "false");
      mute.addEventListener("click", function () {
        if (selection[stringIndex] === null) {
          return;
        }

        selection[stringIndex] = null;
        render();
        recentSettings.schedule();
      });
      label.appendChild(name);
      label.appendChild(tuningSelect);
      label.appendChild(mute);
      row.appendChild(label);

      for (var fret = 0; fret <= MAX_FRET; fret += 1) {
        var cell = document.createElement("button");
        cell.type = "button";
        cell.className = "fret-cell chordinator-fret";
        cell.dataset.stringIndex = stringIndex;
        cell.dataset.fret = fret;
        cell.setAttribute("aria-label", string.label + " string " + string.guitarString + " fret " + fret);

        if (selection[stringIndex] === fret) {
          cell.className += fret === 0 ? " selected open" : " selected";
        }

        var note = document.createElement("span");
        note.textContent = pitchName(string.pitch + fret);
        cell.appendChild(note);
        cell.addEventListener("click", function (event) {
          var nextStringIndex = Number(event.currentTarget.dataset.stringIndex);
          var nextFret = Number(event.currentTarget.dataset.fret);
          selection[nextStringIndex] = selection[nextStringIndex] === nextFret ? null : nextFret;
          render();
          recentSettings.schedule();
        });

        row.appendChild(cell);
      }

      fretboard.appendChild(row);
    });
  }

  function renderSelectedNotes(notes) {
    selectedNotesTarget.textContent = "";

    if (!notes.length) {
      var empty = document.createElement("li");
      empty.className = "empty-note";
      empty.textContent = "No strings selected";
      selectedNotesTarget.appendChild(empty);
      return;
    }

    notes.forEach(function (note) {
      var item = document.createElement("li");
      item.className = "root-note";
      item.textContent = note.name;
      item.title = "String " + note.stringNumber + ", fret " + note.fret;
      selectedNotesTarget.appendChild(item);
    });
  }

  function renderMatches(matches) {
    matchesTarget.textContent = "";

    if (!matches.length) {
      var empty = document.createElement("div");
      empty.className = "empty-state";
      empty.textContent = "Select at least two notes to identify a chord.";
      matchesTarget.appendChild(empty);
      return;
    }

    matches.forEach(function (match) {
      var card = document.createElement("article");
      card.className = "chord-match" + (match.exact ? " exact-match" : " close-match");

      var heading = document.createElement("div");
      heading.className = "chord-match-heading";

      var title = document.createElement("h3");
      title.textContent = match.name;
      var badge = document.createElement("span");
      badge.textContent = match.exact ? "Exact match" : "Close match";

      heading.appendChild(title);
      heading.appendChild(badge);

      var details = document.createElement("p");
      details.textContent = "Root " + match.root + "; " + match.quality + "; intervals " + match.intervals.join(", ");

      card.appendChild(heading);
      card.appendChild(details);

      if (!match.exact) {
        var close = document.createElement("p");
        close.className = "match-difference";
        close.textContent = [
          match.missing.length ? "missing " + match.missing.join(", ") : "",
          match.extra.length ? "extra " + match.extra.join(", ") : ""
        ].filter(Boolean).join("; ");
        card.appendChild(close);
      }

      matchesTarget.appendChild(card);
    });
  }

  function render() {
    var notes = selectedNotes();
    shapeTarget.textContent = shapeText();
    renderFretboard();
    renderTuningControls();
    renderSelectedNotes(notes);
    renderMatches(findMatches(notes));
  }

  clearButton.addEventListener("click", function () {
    selection = tuning.map(function () {
      return null;
    });
    render();
    recentSettings.schedule();
  });

  sampleButton.addEventListener("click", function () {
    selection = SAMPLE_SHAPE.slice();
    render();
    recentSettings.schedule();
  });

  presetSelect.addEventListener("change", function (event) {
    var preset = PRESETS[event.currentTarget.value];
    if (!preset) {
      return;
    }
    tuning = GuitarTuning.fromPitches(preset.pitches);
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

  recentSettings = RecentSettings.create({
    key: HISTORY_KEY,
    version: HISTORY_VERSION,
    limit: HISTORY_LIMIT,
    delay: HISTORY_SAVE_DELAY,
    snapshot: snapshot,
    normalize: function (candidate) { return isValidSnapshot(candidate) ? candidate : null; },
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
  renderHistoryControls();
  render();
}());
