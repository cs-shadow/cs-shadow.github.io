(function (window) {
  "use strict";

  var NOTES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
  var DEFAULT_TUNING = [
    { label: "E", pitch: 4, guitarString: 1 },
    { label: "B", pitch: 11, guitarString: 2 },
    { label: "G", pitch: 7, guitarString: 3 },
    { label: "D", pitch: 2, guitarString: 4 },
    { label: "A", pitch: 9, guitarString: 5 },
    { label: "E", pitch: 4, guitarString: 6 }
  ];
  var PRESETS = {
    standard: { label: "Standard", pitches: [4, 11, 7, 2, 9, 4] },
    "drop-d": { label: "Drop D", pitches: [4, 11, 7, 2, 9, 2] },
    "open-g": { label: "Open G", pitches: [2, 11, 7, 2, 7, 2] },
    "open-d": { label: "Open D", pitches: [2, 9, 6, 2, 9, 2] },
    dadgad: { label: "DADGAD", pitches: [2, 9, 7, 2, 9, 2] }
  };

  function normalizePitch(pitch) {
    return ((pitch % 12) + 12) % 12;
  }

  function pitchName(pitch) {
    return NOTES[normalizePitch(pitch)];
  }

  function cloneTuning(tuning) {
    return tuning.map(function (string, index) {
      var pitch = normalizePitch(string.pitch);
      return {
        label: pitchName(pitch),
        name: pitchName(pitch),
        pitch: pitch,
        guitarString: string.guitarString || index + 1
      };
    });
  }

  function tuningFromPitches(pitches) {
    if (!Array.isArray(pitches) || pitches.length !== DEFAULT_TUNING.length || !pitches.every(Number.isInteger)) {
      return cloneTuning(DEFAULT_TUNING);
    }
    return cloneTuning(DEFAULT_TUNING.map(function (string, index) {
      return { pitch: pitches[index], guitarString: string.guitarString };
    }));
  }

  function tuningPitches(tuning) {
    return tuning.map(function (string) { return string.pitch; });
  }

  function presetKey(tuning) {
    var pitches = tuningPitches(tuning);
    return Object.keys(PRESETS).filter(function (key) {
      return PRESETS[key].pitches.every(function (pitch, index) { return pitches[index] === pitch; });
    })[0] || "custom";
  }

  function tuningLabel(tuning) {
    var key = presetKey(tuning);
    return key === "custom" ? "Custom" : PRESETS[key].label;
  }

  function stringSets(tuning) {
    return [0, 1, 2, 3].map(function (start) {
      var strings = tuning.slice(start, start + 3);
      return {
        id: "strings-" + (start + 1) + "-" + (start + 2) + "-" + (start + 3),
        label: strings.map(function (string) { return string.label; }).join("-"),
        strings: strings
      };
    });
  }

  window.GuitarTuning = {
    notes: NOTES,
    presets: PRESETS,
    defaultTuning: function () { return cloneTuning(DEFAULT_TUNING); },
    clone: cloneTuning,
    fromPitches: tuningFromPitches,
    pitches: tuningPitches,
    isValidPitches: function (pitches) {
      return Array.isArray(pitches) && pitches.length === DEFAULT_TUNING.length && pitches.every(function (pitch) {
        return Number.isInteger(pitch) && pitch >= 0 && pitch < NOTES.length;
      });
    },
    normalizePitch: normalizePitch,
    pitchName: pitchName,
    presetKey: presetKey,
    label: tuningLabel,
    stringSets: stringSets
  };
}(window));
