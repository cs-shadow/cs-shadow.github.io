"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const music = require("../../site/assets/js/song-notebook/music.js");
const { catalogs } = require("./fixtures.cjs");
const settings = { tuningMidi: music.defaultTuning, capo: 0 };
const parse = symbol => {
  const result = music.parseChordSymbol(symbol);
  assert.equal(result.error, null, symbol);
  return result.interpretation;
};
const pcs = values => [...new Set(values.map(n => ((n % 12) + 12) % 12))].sort((a, b) => a - b);
const notes = midis => midis.map((midi, stringIndex) => ({ stringIndex, fret: 0, physicalFret: 0, midi, pc: midi % 12 }));
const chord = (id, symbol, extra = {}) => ({ id, frets: null, interpretation: symbol ? parse(symbol) : null, reviewRequired: false, ...extra });
const lowToHigh = frets => frets.slice().reverse();
const form = text => lowToHigh([...text].map(fret => fret === "x" ? null : Number(fret)));
const familiarForms = {
  C:"x32010", A:"x02220", G:"320003", E:"022100", D:"xx0232", Am:"x02210", Em:"022000", Dm:"xx0231",
  A7:"x02020", G7:"320001", E7:"020100", D7:"xx0212", Cmaj7:"x32000", Amaj7:"x02120", Gmaj7:"320002",
  Emaj7:"021100", Dmaj7:"xx0222", Am7:"x02010", Em7:"020000", Dm7:"xx0211"
};
// Enumerate all translations, independently of the production root/capo shift
// calculation. The exhaustive oracle below validates their sounding pitches.
function familiarKeys(interpretation, tuningSettings) {
  const keys = new Set();
  if (JSON.stringify(tuningSettings.tuningMidi) !== JSON.stringify(music.defaultTuning)) return keys;
  for (const [symbol, text] of Object.entries(familiarForms)) {
    if (parse(symbol).formulaId !== interpretation.formulaId) continue;
    for (let shift = 0; shift <= 14; shift++) keys.add(JSON.stringify(form(text).map(fret => fret === null ? null : fret + shift)));
  }
  return keys;
}
function deepFreeze(value) {
  if (value && typeof value === "object") { Object.values(value).forEach(deepFreeze); Object.freeze(value); }
  return value;
}
function compareShapes(a, b) {
  return a.span - b.span || a.position - b.position || a.mutedCount - b.mutedCount ||
    a.frets.reduce((order, fret, i) => order || (fret === null ? -1 : fret) - (b.frets[i] === null ? -1 : b.frets[i]), 0);
}
function checkShape(shape, interpretation, tuningSettings, mode) {
  assert.deepEqual(Object.keys(shape).sort(), ["frets", "mutedCount", "position", "span"]);
  assert.equal(shape.frets.length, 6);
  const played = music.notesForShape(tuningSettings.tuningMidi, tuningSettings.capo, shape.frets);
  assert.deepEqual(pcs(played.map(note => note.midi)), music.interpretationPitches(interpretation));
  assert.ok(played.every(note => note.physicalFret <= 14));
  const bass = interpretation.bassPc ?? (mode === "compact" ? null : interpretation.rootPc);
  if (bass !== null) { assert.equal(Math.min(...played.map(note => note.midi)) % 12, bass); }
  const fretted = shape.frets.filter(fret => fret > 0);
  assert.equal(shape.position, fretted.length ? Math.min(...fretted) : 0);
  assert.equal(shape.span, fretted.length ? Math.max(...fretted) - Math.min(...fretted) : 0);
  assert.ok(shape.span <= 4);
  assert.equal(shape.mutedCount, 6 - played.length);
  if (mode === "compact") {
    assert.equal(played.length, 3);
    assert.equal(played[2].stringIndex - played[0].stringIndex, 2);
  } else { assert.ok(played.length >= 4); }
  assert.equal(played.at(-1).stringIndex - played[0].stringIndex + 1, played.length);
}

// Deliberately independent exhaustive search: enumerate every allowed fret on
// each string, then apply all constraints at the leaf. This verifies global
// ranking and window boundaries, not just the implementation's returned shapes.
function bruteVoicings(interpretation, tuningSettings, mode) {
  const expected = music.interpretationPitches(interpretation);
  const familiar = familiarKeys(interpretation, tuningSettings);
  const choices = tuningSettings.tuningMidi.map(open => [null, ...Array.from({ length: 15 - tuningSettings.capo }, (_, fret) => fret)
    .filter(fret => expected.includes((open + tuningSettings.capo + fret) % 12))]);
  const shapes = [];
  const frets = [];
  function visit(index) {
    if (index < 6) { for (const fret of choices[index]) { frets[index] = fret; visit(index + 1); } return; }
    const sounding = frets.flatMap((fret, i) => fret === null ? [] : [{ midi: tuningSettings.tuningMidi[i] + tuningSettings.capo + fret, index: i }]);
    if (mode === "compact" ? sounding.length !== 3 || sounding[2].index - sounding[0].index !== 2 : sounding.length < 4) { return; }
    if (sounding.at(-1).index - sounding[0].index + 1 !== sounding.length) { return; }
    const bass = interpretation.bassPc ?? (mode === "compact" ? null : interpretation.rootPc);
    if (bass !== null && Math.min(...sounding.map(n => n.midi)) % 12 !== bass) { return; }
    if (JSON.stringify(pcs(sounding.map(n => n.midi))) !== JSON.stringify(expected)) { return; }
    const positive = frets.filter(fret => fret > 0);
    const position = positive.length ? Math.min(...positive) : 0;
    const span = positive.length ? Math.max(...positive) - position : 0;
    if (span <= 4) { shapes.push({ frets: frets.slice(), position, span, mutedCount: 6 - sounding.length }); }
  }
  visit(0);
  return shapes.sort((a, b) => {
    if (mode === "compact") return compareShapes(a, b);
    return Number(familiar.has(JSON.stringify(b.frets))) - Number(familiar.has(JSON.stringify(a.frets))) ||
      Math.max(0, ...a.frets) - Math.max(0, ...b.frets) || a.mutedCount - b.mutedCount || compareShapes(a, b);
  }).slice(0, 8);
}

test("all existing catalogs, distinctions, descriptions and string registers are retained immutably", () => {
  assert.equal(music.chords.length, 37);
  assert.deepEqual(music.chords.map(({ suffix, quality, intervals }) => ({ suffix, quality, intervals })), catalogs.chords);
  assert.deepEqual(music.scales, catalogs.scales);
  assert.deepEqual(music.roots, ["C", "C#", "Db", "D", "D#", "Eb", "E", "F", "F#", "Gb", "G", "G#", "Ab", "A", "A#", "Bb", "B"]);
  assert.deepEqual(music.presets.map(p => p.tuningMidi), [[64,59,55,50,45,40],[64,59,55,50,45,38],[62,59,55,50,43,38],[62,57,54,50,45,38],[62,57,55,50,45,38]]);
  assert.deepEqual(music.defaultTuning, music.presets[0].tuningMidi);
  for (const formula of music.chords) {
    assert.equal(formula.id, formula.suffix);
    assert.ok(["triads", "sevenths", "added", "extended"].includes(formula.group));
    assert.ok(Object.isFrozen(formula));
    assert.ok(Object.isFrozen(formula.intervals));
  }
  for (const catalog of [music.chords, music.scales, music.roots, music.presets, music.defaultTuning]) { assert.ok(Object.isFrozen(catalog)); }
  assert.throws(() => music.scales[0].intervals.push(1), TypeError);
  assert.throws(() => music.presets[0].tuningMidi[0] = 0, TypeError);
  assert.equal(music.chords.find(c => c.id === "sus2").group, "added");
  assert.equal(music.chords.find(c => c.id === "7sus4").group, "added");
  assert.equal(music.chords.find(c => c.id === "7b5").group, "extended");
});

test("classic browser script exposes the same API without CommonJS or DOM dependencies", () => {
  const context = vm.createContext({});
  vm.runInContext(fs.readFileSync(require.resolve("../../site/assets/js/song-notebook/music.js"), "utf8"), context);
  assert.equal(context.SongNotebookMusic.formatInterpretation(context.SongNotebookMusic.parseChordSymbol("Am").interpretation), "Am");
  assert.deepEqual(Object.keys(context.SongNotebookMusic).sort(), Object.keys(music).sort());
});

test("parse every catalog suffix and preserve enharmonic identity, case and slash spelling", () => {
  for (const formula of music.chords) {
    for (const root of ["C", "C#", "Db", "Cb", "B#", "F##", "Ebb"]) {
      const symbol = root + formula.id + "/Gb";
      assert.equal(music.formatInterpretation(parse(symbol)), symbol);
      assert.equal(parse(symbol).formulaId, formula.id);
    }
  }
  assert.deepEqual(parse("  d♭m7/a♭  "), { rootPc: 1, rootSpelling: "Db", formulaId: "m7", bassPc: 8, bassSpelling: "Ab" });
  assert.equal(parse("Cb").rootPc, 11);
  assert.equal(parse("B#").rootPc, 0);
  assert.equal(parse("Ebb").rootPc, 2);
  assert.equal(parse("F##").rootPc, 7);
  assert.equal(parse("Cbbb").rootPc, 9);
  assert.notDeepEqual(parse("C#"), parse("Db"));
  assert.notDeepEqual(parse("C#/E#"), parse("C#/F"));
  assert.deepEqual(parse("c♯/e♯"), parse("C#/E#"));
  assert.equal(music.formatInterpretation(null), "");
  for (const [alias, canonical] of [["CM7", "Cmaj7"], ["Cmin", "Cm"], ["Cø7", "Cm7b5"], ["C+", "Caug"], ["C°7", "Cdim7"]]) {
    assert.deepEqual(parse(alias), parse(canonical));
  }
});

test("invalid symbols return stable errors without partially accepting input", () => {
  for (const value of [null, 42, {}, "", " ", "Am F", "C,G", "C /G", "C//G", "C/G7", "H", "Cwhatever", "C#b", "C/G#b", "C\nG"]) {
    const result = music.parseChordSymbol(value);
    assert.equal(result.interpretation, null, String(value));
    assert.equal(result.error.code, "INVALID_SYMBOL");
    assert.equal(typeof result.error.message, "string");
    assert.equal(result.error.path, null);
    assert.equal(result.error.details, null);
  }
});

test("pitch helpers transpose sounding names and preserve accidental preferences", () => {
  assert.equal(music.normalizePitch(-25), 11);
  assert.equal(music.normalizePitch(132), 0);
  assert.equal(music.pitchName(-1), "B");
  assert.equal(music.pitchName(13, true), "Db");
  const input = deepFreeze(parse("Dbmaj7/Ab"));
  assert.deepEqual(music.transposeInterpretation(input, 2), parse("Ebmaj7/Bb"));
  assert.deepEqual(music.transposeInterpretation(parse("C#maj7/G#"), 2), parse("D#maj7/A#"));
  assert.deepEqual(music.transposeInterpretation(parse("Cb/B#"), 12), parse("Cb/B#"));
  assert.deepEqual(music.transposeInterpretation(parse("C"), -2), parse("A#"));
  assert.equal(music.transposeInterpretation(null, 2), null);
  assert.deepEqual(music.interpretationPitches(parse("Cadd2")), music.interpretationPitches(parse("Cadd9")));
  assert.deepEqual(music.interpretationPitches(parse("C/D")), [0,2,4,7]);
  assert.deepEqual(music.interpretationPitches(null), []);
});

test("shape notes use capo-relative frets, actual MIDI registers, and string 1 first", () => {
  const tuning = deepFreeze([127, 0, 67, 50, 45, 40]);
  const frets = deepFreeze([12, 0, null, 1, null, 5]);
  assert.deepEqual(music.notesForShape(tuning, 12, frets), [
    { stringIndex:0, fret:12, physicalFret:24, midi:151, pc:7 },
    { stringIndex:1, fret:0, physicalFret:12, midi:12, pc:0 },
    { stringIndex:3, fret:1, physicalFret:13, midi:63, pc:3 },
    { stringIndex:5, fret:5, physicalFret:17, midi:57, pc:9 }
  ]);
  assert.deepEqual(music.notesForShape(music.defaultTuning, 0, [null,null,null,null,null,null]), []);
  assert.deepEqual(music.notesForShape(music.defaultTuning, 0, null), []);
});

test("chord identification uses true lowest MIDI and absolute missing/extra PCs", () => {
  const reentrant = deepFreeze(music.notesForShape([40,60,67,50,45,40], 0, [0,0,0,null,null,null]));
  const exact = music.identifyChord(reentrant).find(c => c.interpretation.formulaId === "");
  assert.equal(exact.label, "C/E");
  assert.equal(exact.match, "exact");
  assert.deepEqual(exact.missing, []);
  assert.deepEqual(exact.extra, []);
  const incomplete = music.identifyChord(notes([52,56])).find(c => c.label === "E");
  assert.equal(incomplete.match, "close");
  assert.deepEqual(incomplete.missing, [11]);
  assert.deepEqual(incomplete.extra, []);
  const added = music.identifyChord(notes([48,52,56,59])).find(c => c.label === "Caug");
  assert.equal(added.match, "close");
  assert.deepEqual(added.extra, [11]);
  assert.deepEqual(music.identifyChord([]), []);
  assert.deepEqual(music.identifyChord(notes([48,60])), []);
  assert.deepEqual(music.identifyChord(reentrant.slice().reverse()), music.identifyChord(reentrant));
});

test("Roman labels use fixed major degrees, quality, extensions and slash bass", () => {
  const home = { tonicPc: 9, tonicSpelling: "A", scaleId: "aeolian" };
  for (const [symbol, expected] of [["Am","i"],["C","♭III"],["Bdim","ii°"],["Bm7b5","iiø7"],["Eaug","V+"],["E7/G#","V7/G#"],["Asus2","Isus2"],["A5","I5"],["AmMaj7","imaj7"],["Amadd9","iadd9"],["Amaj9","Imaj9"]]) {
    assert.equal(music.romanLabel(parse(symbol), home), expected, symbol);
  }
  assert.deepEqual(Array.from({ length: 12 }, (_, rootPc) => music.romanLabel({ ...parse("C"), rootPc }, { tonicPc: 0 })), ["I","♭II","II","♭III","III","IV","♯IV","V","♭VI","VI","♭VII","VII"]);
  assert.equal(music.romanLabel(null, home), "");
  assert.equal(music.romanLabel(parse("Am"), null), "");
});

test("scale enumeration includes every complete formula and keeps aliases and degree spellings", () => {
  for (const scale of music.scales) {
    for (let tonic = 0; tonic < 12; tonic++) {
      const result = music.chordsForScale(tonic, scale.id);
      const expected = [];
      const allowed = pcs(scale.intervals.map(n => n + tonic));
      for (const rootPc of allowed) {
        for (const formula of music.chords) {
          if (formula.intervals.every(n => allowed.includes((n + rootPc) % 12))) { expected.push(rootPc + ":" + formula.id); }
        }
      }
      assert.deepEqual(result.map(c => c.interpretation.rootPc + ":" + c.interpretation.formulaId).sort(), expected.sort());
      for (const entry of result) {
        assert.deepEqual(parse(entry.label), entry.interpretation);
        assert.deepEqual(entry.pitches, music.interpretationPitches(entry.interpretation));
      }
    }
  }
  const cMajor = music.chordsForScale(0, "major");
  for (const name of ["Cadd2", "Cadd9", "Cadd4", "Cadd11", "C6", "Cadd6", "G13"]) { assert.ok(cMajor.some(c => c.label === name), name); }
  assert.ok(music.chordsForScale(1, "major", "Db").some(c => c.label === "Ebm"));
  assert.ok(music.chordsForScale(6, "major", "F#").some(c => c.label === "E#dim"));
  assert.ok(music.chordsForScale(11, "major", "Cb").some(c => c.label === "Fb"));
  assert.deepEqual(music.chordsForScale(0, "unknown"), []);
});

test("scale matching analyzes the whole collection using shapes over stale names and lists exclusions", () => {
  const collection = deepFreeze([
    chord("name", "C"), chord("unused", "F#"), chord("slash", "C/Db"),
    chord("shape", "F#", { frets:[0,1,0,2,3,null], reviewRequired:true }),
    chord("unnamed", null, { frets:[null,null,null,0,null,null] }),
    chord("unresolved", null), chord("review-name", "D", { reviewRequired:true })
  ]);
  const result = music.matchScales(collection, settings, null);
  assert.equal(result.candidates.length, 16 * 12);
  assert.deepEqual(result.excludedChordIds, ["unresolved", "review-name"]);
  const cMajor = result.candidates.find(c => c.tonicPc === 0 && c.scaleId === "major");
  assert.equal(cMajor.totalCount, 5);
  assert.equal(cMajor.fitCount, 3);
  assert.equal(cMajor.outlierCount, 2);
  assert.equal(cMajor.outsideCount, 4);
  assert.deepEqual(cMajor.memberships.map(m => [m.chordId,m.pitches,m.outside]), [
    ["name",[0,4,7],[]], ["unused",[1,6,10],[1,6,10]], ["slash",[0,1,4,7],[1]], ["shape",[0,4,7],[]], ["unnamed",[2],[]]
  ]);
  for (let i = 1; i < result.candidates.length; i++) {
    const a = result.candidates[i - 1], b = result.candidates[i];
    assert.ok(a.outlierCount < b.outlierCount || a.outlierCount === b.outlierCount && a.outsideCount <= b.outsideCount);
  }
  assert.deepEqual(music.matchScales([chord("empty", null)], settings, null), { candidates:[], excludedChordIds:["empty"] });
  const preferred = music.matchScales([chord("minor", "Am")], settings, { tonicPc:9,tonicSpelling:"A" }).candidates[0];
  assert.equal(preferred.tonicPc, 9);
  assert.equal(preferred.scaleId, "dorian");
  const db = music.matchScales([chord("db", "Db")], settings, { tonicPc:1,tonicSpelling:"Db" }).candidates[0];
  assert.equal(db.tonicSpelling, "Db");
  assert.equal(db.scaleId, "major");
});

test("compact and fuller voicings are the globally ranked exhaustive top eight", async () => {
  for (const [symbol, tuningSettings] of [
    ["C", settings], ["Am", settings], ["G7", settings], ["Dmaj7", settings], ["Bm7", settings],
    ["D", { tuningMidi:music.defaultTuning,capo:2 }], ["C/E", { tuningMidi:[40,60,67,50,45,40],capo:12 }],
    ["C/D", { tuningMidi:music.defaultTuning,capo:12 }], ["G7", { tuningMidi:music.defaultTuning,capo:12 }],
    ["D", { tuningMidi:music.presets[3].tuningMidi,capo:0 }]
  ]) {
    const interpretation = deepFreeze(parse(symbol));
    for (const mode of ["compact", "fuller"]) {
      const result = await music.findVoicings(interpretation, deepFreeze(tuningSettings), { mode });
      assert.equal(result.cancelled, false);
      assert.deepEqual(result.shapes, bruteVoicings(interpretation, tuningSettings, mode), symbol + " " + mode);
      result.shapes.forEach(shape => checkShape(shape, interpretation, tuningSettings, mode));
      assert.equal(new Set(result.shapes.map(s => JSON.stringify(s.frets))).size, result.shapes.length);
    }
  }
});

test("fuller C starts with open C and all five CAGED forms before generated alternatives", async () => {
  const result = await music.findVoicings(parse("C"), settings, { mode:"fuller" });
  const expected = [form("x32010"), form("x35553"), form("875558"),
    lowToHigh([8,10,10,9,8,8]), lowToHigh([null,null,10,12,13,12])];
  assert.deepEqual(result.shapes.slice(0, 5).map(shape => shape.frets), expected);
  assert.equal(result.shapes.length, 8);
  result.shapes.forEach(shape => checkShape(shape, parse("C"), settings, "fuller"));
});

test("every familiar open form remains available and preferred over general candidates", async () => {
  for (const [symbol, text] of Object.entries(familiarForms)) {
    const interpretation = parse(symbol);
    const { shapes } = await music.findVoicings(interpretation, settings, { mode:"fuller" });
    assert.ok(shapes.some(shape => JSON.stringify(shape.frets) === JSON.stringify(form(text))), symbol);
    assert.ok(familiarKeys(interpretation, settings).has(JSON.stringify(shapes[0].frets)), symbol);
    shapes.forEach(shape => checkShape(shape, interpretation, settings, "fuller"));
  }
});

test("capo-aware templates move open strings and reject unsuitable tuning and slash bass", async () => {
  const capoSettings = { tuningMidi:music.defaultTuning, capo:2 };
  const d = await music.findVoicings(parse("D"), capoSettings, { mode:"fuller" });
  assert.deepEqual(d.shapes[0].frets, form("x32010"), "C form sounds D at capo 2");
  const b = await music.findVoicings(parse("B"), capoSettings, { mode:"fuller" });
  assert.ok(b.shapes.some(shape => JSON.stringify(shape.frets) === JSON.stringify(form("542225"))), "G form transposes every open string");
  for (const [symbol, tuningSettings] of [
    ["C/E", settings], ["C", { tuningMidi:[40,59,55,50,45,64], capo:0 }],
    ["C", { tuningMidi:music.presets[1].tuningMidi, capo:0 }]
  ]) {
    const interpretation = parse(symbol);
    const { shapes } = await music.findVoicings(interpretation, tuningSettings, { mode:"fuller" });
    assert.ok(shapes.length > 0, symbol);
    assert.deepEqual(shapes, bruteVoicings(interpretation, tuningSettings, "fuller"));
    shapes.forEach(shape => checkShape(shape, interpretation, tuningSettings, "fuller"));
  }
});

test("physical fret 14 is inclusive in both modes with and without a capo", async () => {
  for (const capo of [0, 2, 12]) {
    for (const mode of ["compact", "fuller"]) {
      const tuningSettings = { tuningMidi:music.defaultTuning, capo };
      const { shapes } = await music.findVoicings(parse("A"), tuningSettings, { mode });
      assert.ok(shapes.some(shape => shape.frets.some(fret => fret !== null && fret + capo === 14)), mode + " capo " + capo);
      shapes.forEach(shape => checkShape(shape, parse("A"), tuningSettings, mode));
      assert.deepEqual(shapes, bruteVoicings(parse("A"), tuningSettings, mode));
    }
  }
  const { shapes } = await music.findVoicings(parse("C"), settings, { mode:"fuller" });
  assert.ok(!shapes.some(shape => JSON.stringify(shape.frets) === JSON.stringify(lowToHigh([null,15,14,12,13,12]))), "C form at physical fret 15 is excluded");
});

test("compact triads still include inversions, while explicit bass requests are enforced", async () => {
  const { shapes } = await music.findVoicings(parse("C"), settings, { mode:"compact" });
  assert.ok(shapes.some(shape => Math.min(...music.notesForShape(settings.tuningMidi, 0, shape.frets).map(note => note.midi)) % 12 !== 0));
  const slash = await music.findVoicings(parse("C/E"), settings, { mode:"compact" });
  assert.ok(slash.shapes.length > 0);
  slash.shapes.forEach(shape => checkShape(shape, parse("C/E"), settings, "compact"));
});

test("voicing search supports extended complete coverage, register extremes, open strings and empty results", async () => {
  for (const [symbol, tuningSettings, mode] of [
    ["C11",settings,"fuller"], ["Cmaj9",settings,"fuller"],
    ["C/G",{tuningMidi:[127,0,60,67,52,43],capo:7},"fuller"],
    ["D",{tuningMidi:music.presets[3].tuningMidi,capo:0},"fuller"]
  ]) {
    const interpretation = parse(symbol);
    const result = await music.findVoicings(interpretation, tuningSettings, { mode });
    assert.ok(result.shapes.length > 0, symbol);
    result.shapes.forEach(shape => checkShape(shape, interpretation, tuningSettings, mode));
    if (symbol === "D") { assert.deepEqual(result.shapes[0].frets, [0,0,0,0,0,0]); }
  }
  for (const [symbol, mode] of [["C13","fuller"],["C7","compact"],["C/D","compact"]]) {
    assert.deepEqual(await music.findVoicings(parse(symbol), settings, { mode }), { shapes:[],cancelled:false });
  }
});

test("search yields to timers, aborts before and during work, and drops cancelled results", async () => {
  const preAborted = new AbortController();
  preAborted.abort();
  assert.deepEqual(await music.findVoicings(parse("C"), settings, { mode:"fuller",signal:preAborted.signal }), { shapes:[],cancelled:true });
  const controller = new AbortController();
  let timerRan = false;
  const pending = music.findVoicings(parse("C11"), settings, { mode:"fuller",signal:controller.signal });
  const cancel = new Promise(resolve => setTimeout(() => { timerRan = true; controller.abort(); resolve(); }, 0));
  assert.deepEqual(await pending, { shapes:[],cancelled:true });
  await cancel;
  assert.equal(timerRan, true);
  assert.ok((await music.findVoicings(parse("C"), settings, { mode:"compact" })).shapes.length);
});

test("abort cleans pending timers and listeners so stale work cannot continue", async () => {
  const timers = new Map();
  let timerId = 0;
  const context = vm.createContext({ setTimeout(callback) { timers.set(++timerId, callback); return timerId; }, clearTimeout(id) { timers.delete(id); } });
  vm.runInContext(fs.readFileSync(require.resolve("../../site/assets/js/song-notebook/music.js"), "utf8"), context);
  const local = context.SongNotebookMusic;
  let callback;
  let removed = false;
  const signal = { aborted:false, addEventListener(name, fn) { assert.equal(name,"abort"); callback=fn; }, removeEventListener(name, fn) { assert.equal(fn,callback); removed=true; } };
  const pending = local.findVoicings(local.parseChordSymbol("C11").interpretation, settings, { mode:"fuller",signal });
  assert.equal(timers.size, 1);
  const [id, firstChunk] = timers.entries().next().value;
  timers.delete(id);
  firstChunk();
  assert.equal(timers.size, 1);
  signal.aborted = true;
  callback();
  assert.equal(timers.size, 0);
  assert.equal(removed, true);
  assert.equal((await pending).cancelled, true);
});
