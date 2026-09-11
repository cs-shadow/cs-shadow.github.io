"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Explore = require("../../site/assets/js/song-notebook/explore.js");
const Music = require("../../site/assets/js/song-notebook/music.js");
const Model = require("../../site/assets/js/song-notebook/model.js");
const Storage = require("../../site/assets/js/song-notebook/storage.js");
const Controller = require("../../site/assets/js/guitar-chordinator.js");
const { documentFixture } = require("./dom-fixture.cjs");
const { memoryStorage } = require("./fixtures.cjs");
function harness(options = {}) {
  const doc = documentFixture(), root = doc.createElement("section"), sibling = doc.createElement("aside");
  const scrolls = [];
  if (options.layout) {
    doc.defaultView = { innerWidth: options.layout.width, innerHeight: 700, matchMedia: () => ({ matches: options.layout.width < 800 }) };
    const createElement = doc.createElement;
    doc.createElement = tag => {
      const node = createElement(tag);
      node.getBoundingClientRect = () => options.layout.rect;
      node.scrollIntoView = value => scrolls.push({ node, value });
      return node;
    };
  }
  root.id = "explore-test"; sibling.textContent = "Outside ownership"; doc.body.append(root, sibling);
  let id = 0;
  const model = Model.create({ music: Music, id: () => "explore-" + ++id, now: () => "2026-09-08T10:00:00Z" });
  const storage = Storage.create({ storage: options.backend || memoryStorage(), model, music: Music });
  const store = Controller.createStore({ model, storage, music: Music, schedule: () => 1, cancel() {} });
  const actions = [], music = options.music || Music;
  const component = Explore.mount({ root }, { music, dispatch(action) { actions.push(action); return options.reject && options.reject(action) || store.dispatch(action); } });
  const unsubscribe = store.subscribe(snapshot => component.render(snapshot)); component.render(store.snapshot());
  function find(key) { let result; function walk(node) { if (node._exploreKey === key) result = node; node.childNodes.forEach(walk); } walk(root); return result; }
  function node(key) { const result = root.querySelector('[data-explore-key="' + key + '"]'); assert.ok(result, "Missing " + key); return result; }
  function click(key) { node(key).click(); }
  function change(key, value) { const input = node(key); input.value = value; input.dispatchEvent({ type: "change" }); }
  function dispatch(action) { const result = store.dispatch(action); assert.equal(result.error, null, JSON.stringify(result.error)); return store.snapshot(); }
  function select(symbol) { dispatch({ type: "explore.set", patch: { selectedInterpretation: Music.parseChordSymbol(symbol).interpretation } }); }
  function progression(text) { dispatch({ type: "progression.insert", sectionId: store.snapshot().activeSectionId, text, afterOccurrenceId: null }); }
  function close() { unsubscribe(); component.destroy(); store.destroy(); }
  dispatch({ type: "panel.set", panel: "explore" });
  return { doc, root, sibling, store, component, actions, scrolls, find, node, click, change, dispatch, select, progression, close, get song() { return store.snapshot().song; } };
}
function controlledSearch() { const requests = []; return { requests, music: { ...Music, findVoicings(interpretation, settings, options) { return new Promise((resolve, reject) => requests.push({ interpretation, settings, options, resolve, reject })); } } }; }
async function settle() { await new Promise(resolve => setImmediate(resolve)); }
async function completed(env) { for (let index = 0; index < 200 && env.find("fingerings").getAttribute("aria-busy") === "true"; index++) await new Promise(resolve => setTimeout(resolve, 5)); assert.equal(env.find("fingerings").getAttribute("aria-busy"), "false"); }

test("browse exposes the complete catalog, every fitting formula and distinct aliases without changing the song", () => {
  const e = harness(), before = JSON.stringify(e.song);
  assert.equal(e.node("browse-root").childNodes.length, Music.roots.length);
  assert.equal(e.node("browse-scale").childNodes.length, Music.scales.length);
  assert.equal(e.find("group-triads").open, true);
  for (const scale of Music.scales) {
    e.change("browse-scale", scale.id);
    const expected = Music.chordsForScale(0, scale.id, "C");
    const actual = e.root.querySelectorAll("button").filter(node => (node.dataset.exploreKey || "").startsWith("result-"));
    assert.equal(actual.length, expected.length, scale.id);
    assert.deepEqual(actual.map(node => node.textContent).sort(), expected.map(chord => chord.label).sort());
    assert.equal(e.find("scale-feel").textContent, scale.feel || "");
  }
  for (const root of Music.roots) { e.change("browse-root", root); assert.equal(e.store.snapshot().exploreState.tonicSpelling, root); }
  assert.equal(JSON.stringify(e.song), before); assert.equal(e.song.context, null); e.close();
});
test("name-only Keep and Keep & add work immediately and each insertion is one undo transaction", () => {
  const e = harness(); e.click("result-triads-0");
  const selected = e.store.snapshot().exploreState.selectedInterpretation;
  assert.ok(selected); assert.match(e.find("no-fingering").textContent, /keep this chord by name/);
  e.click("keep"); assert.equal(e.song.chords.length, 1); assert.equal(e.song.chords[0].frets, null); assert.equal(e.song.sections[0].occurrences.length, 0);
  e.click("keep-add"); assert.equal(e.song.chords.length, 2); assert.equal(e.song.sections[0].occurrences.length, 1);
  e.dispatch({ type: "history.undo" }); assert.equal(e.song.chords.length, 1); assert.equal(e.song.sections[0].occurrences.length, 0);
  assert.deepEqual(e.store.snapshot().exploreState.selectedInterpretation, selected); e.close();
});
test("scale application is explicit; browse state, section selection and pending drafts survive tabs and panels", () => {
  const e = harness(); e.progression("C F");
  const sectionId = e.song.sections[0].id, occurrenceId = e.song.sections[0].occurrences[1].id;
  e.dispatch({ type: "selection.set", sectionId, occurrenceId }); e.dispatch({ type: "draft.open", chordId: null });
  e.dispatch({ type: "draft.patch", chordId: null, patch: { nickname: "Pending experiment" } }); e.dispatch({ type: "panel.set", panel: "explore" });
  e.change("browse-root", "Db"); e.change("browse-scale", "dorian"); e.select("Ebm7");
  const before = e.store.snapshot(); e.click("tab-match"); e.click("tab-browse");
  assert.deepEqual(e.store.snapshot().exploreState, before.exploreState); assert.equal(e.song.context, null);
  e.click("use-browse-scale"); assert.deepEqual(e.song.context, { tonicPc: 1, tonicSpelling: "Db", scaleId: "dorian", sourceChordId: null });
  e.click("close"); assert.equal(e.root.hidden, true); e.dispatch({ type: "panel.set", panel: "explore" });
  assert.equal(e.root.hidden, false); assert.equal(e.store.snapshot().activeSectionId, sectionId); assert.equal(e.store.snapshot().selectedOccurrenceId, occurrenceId);
  assert.deepEqual(e.store.snapshot().drafts, before.drafts); e.close();
});
test("matching analyzes unused chords, names Bb outlier notes, and does not weight duplicate occurrences", () => {
  const e = harness(); e.progression("C F G Bb");
  const section = e.song.sections[0]; e.dispatch({ type: "occurrence.delete", sectionId: section.id, occurrenceId: section.occurrences[3].id });
  e.click("tab-match"); while (!e.find("candidate-0-major")) e.click("more-matches");
  assert.equal(e.find("candidate-fit-0-major").textContent, "Fits 3 of 4 chords");
  assert.match(e.find("candidate-outliers-0-major").textContent, /Bb.*outside notes: Bb/);
  const before = Music.matchScales(e.song.chords, e.song, e.song.context);
  e.progression("C C C"); assert.deepEqual(Music.matchScales(e.song.chords, e.song, e.song.context), before);
  const chordsBefore = JSON.stringify(e.song.chords), sectionsBefore = JSON.stringify(e.song.sections);
  e.click("use-candidate-0-major"); assert.equal(e.song.context.scaleId, "major");
  assert.equal(JSON.stringify(e.song.chords), chordsBefore); assert.equal(JSON.stringify(e.song.sections), sectionsBefore);
  e.click("browse-candidate-0-major"); assert.equal(e.store.snapshot().exploreState.tab, "browse"); assert.equal(e.doc.activeElement, e.node("browse-root")); e.close();
});
test("matching lists excluded review-only names and includes unnamed shapes using actual pitches", () => {
  const e = harness();
  e.dispatch({ type: "chord.create", chord: { frets: null, interpretation: Music.parseChordSymbol("C").interpretation, nickname: "Unresolved name", notes: "", reviewRequired: true, previousInterpretation: Music.parseChordSymbol("C").interpretation } });
  e.click("tab-match"); assert.match(e.find("excluded-list").textContent, /Unresolved name/); assert.ok(e.find("match-empty"));
  e.dispatch({ type: "chord.create", chord: { frets: [0, null, null, null, null, null], interpretation: null, nickname: "<img src=x>", notes: "" } });
  assert.equal(e.find("match-empty"), undefined);
  const firstCandidate = Music.matchScales(e.song.chords, e.song, e.song.context).candidates[0];
  const evidence = e.find("candidate-membership-list-" + firstCandidate.tonicPc + "-" + firstCandidate.scaleId);
  assert.match(evidence.textContent, /<img src=x>.*tones: E/); assert.equal(evidence.childNodes[0].childNodes[0].nodeType, 3); e.close();
});
test("matching exposes every ranked candidate through bounded expansion", () => {
  const e = harness(); e.progression("C F"); e.click("tab-match");
  const candidates = Music.matchScales(e.song.chords, e.song, e.song.context).candidates;
  assert.equal(e.find("match-results").childNodes.length, 8);
  while (e.find("more-matches")) e.click("more-matches");
  assert.equal(e.find("match-results").childNodes.length, candidates.length);
  assert.deepEqual(e.find("match-results").childNodes.map(node => node._exploreKey), candidates.map(c => "candidate-" + c.tonicPc + "-" + c.scaleId)); e.close();
});
test("fingerings appear automatically without a disclosure or search form and preserve focus", async () => {
  const e = harness(); const selected = e.node("result-triads-0"); selected.focus(); selected.click();
  assert.equal(e.find("fingerings").localName, "section");
  assert.equal(e.find("fingerings").querySelector("summary"), null);
  assert.equal(e.find("fingerings").querySelector("form"), null);
  assert.equal(e.find("find-voicings"), undefined); assert.equal(e.find("cancel-voicings"), undefined);
  assert.equal(e.find("fingerings").getAttribute("aria-busy"), "true");
  await completed(e); assert.equal(e.doc.activeElement, selected);
  assert.ok(e.find("voicing-results").childNodes.length > 0); assert.ok(e.find("voicing-results").childNodes.length <= 8);
  assert.equal(e.store.snapshot().exploreState.selectedFrets, null); assert.equal(e.song.chords.length, 0);
  e.click("voicing-0"); const shape = e.store.snapshot().exploreState.selectedFrets;
  const notes = Music.notesForShape(e.song.tuningMidi, e.song.capo, shape);
  assert.equal(notes.length, 3); assert.deepEqual([...new Set(notes.map(note => note.pc))].sort((a, b) => a - b), [0, 4, 7]);
  assert.match(e.find("selected-shape-caption").textContent, /relative to capo 0/);
  e.click("keep-add"); assert.deepEqual(e.song.chords[0].frets, shape); assert.equal(e.song.sections[0].occurrences.length, 1);
  e.click("clear-fingering"); e.click("keep"); assert.equal(e.song.chords[1].frets, null); e.close();
});
test("no complete seven-tone fingering retains name-only and manual capture actions", async () => {
  const e = harness(); e.select("C13"); e.change("voicing-mode", "fuller"); await completed(e);
  assert.match(e.find("voicing-status").textContent, /No complete fingering/); assert.ok(e.node("manual-shape"));
  e.click("keep"); assert.equal(e.song.chords[0].frets, null); assert.equal(e.song.chords[0].interpretation.formulaId, "13"); e.close();
});
test("explicit mobile chord selection reveals an offscreen preview without moving focus or scrolling on renders", async () => {
  for (const rect of [{ top: 900, bottom: 930 }, { top: -40, bottom: -10 }]) {
    const controlled = controlledSearch(), e = harness({ ...controlled, layout: { width: 375, rect } });
    const selected = e.node("result-triads-0"); selected.focus(); selected.click();
    assert.equal(e.scrolls.length, 1);
    assert.equal(e.scrolls[0].node, e.find("preview-name"));
    assert.equal(e.scrolls[0].value.block, "start");
    assert.equal(e.doc.activeElement, selected);
    await settle(); controlled.requests[0].resolve({ shapes: [], cancelled: false }); await settle();
    e.dispatch({ type: "song.update", patch: { title: "Background render" } });
    e.change("voicing-mode", "fuller"); await settle();
    assert.equal(e.scrolls.length, 1); assert.equal(e.doc.activeElement, selected);
    e.close();
  }
});
test("desktop, visible mobile previews and programmatic selections do not scroll", () => {
  for (const layout of [{ width: 1200, rect: { top: 900, bottom: 930 } }, { width: 375, rect: { top: 200, bottom: 230 } }]) {
    const e = harness({ ...controlledSearch(), layout }); e.click("result-triads-0");
    assert.equal(e.scrolls.length, 0); e.close();
  }
  const e = harness({ ...controlledSearch(), layout: { width: 375, rect: { top: 900, bottom: 930 } } });
  e.select("C"); assert.equal(e.scrolls.length, 0); e.close();
});
test("manual capture carries the selected extended chord and offers safe resumption of an existing draft", async () => {
  const e = harness(); e.select("C13"); e.change("voicing-mode", "fuller"); await completed(e);
  const before = e.song; e.click("manual-shape");
  assert.equal(e.actions.at(-1).type, "explore.capture");
  assert.equal(e.store.snapshot().panel, "editor");
  assert.equal(Music.formatInterpretation(e.store.snapshot().drafts[0].candidate.interpretation), "C13");
  assert.deepEqual(e.song, before);
  e.dispatch({ type: "draft.patch", chordId: null, patch: { nickname: "Unfinished idea", frets: [0, null, null, null, null, null] } });
  e.dispatch({ type: "panel.set", panel: "explore" }); e.select("Dm");
  const draft = e.store.snapshot().drafts[0];
  e.click("manual-shape");
  assert.equal(e.store.snapshot().panel, "explore");
  assert.deepEqual(e.store.snapshot().drafts[0], draft);
  assert.match(e.find("error").textContent, /draft/i);
  assert.equal(e.node("resume-manual-draft").textContent, "Resume existing chord draft");
  e.click("resume-manual-draft");
  assert.equal(e.store.snapshot().panel, "editor");
  assert.deepEqual(e.store.snapshot().drafts[0], draft); assert.deepEqual(e.song, before); e.close();
});
test("new interpretation, mode and tuning abort stale work and ignore late results", async () => {
  const controlled = controlledSearch(), e = harness(controlled);
  e.select("C"); await settle(); const first = controlled.requests[0];
  e.select("D"); assert.equal(first.options.signal.aborted, true);
  await settle(); const second = controlled.requests[1];
  first.resolve({ shapes: [{ frets: [0, 1, 0, null, null, null], position: 1 }], cancelled: false }); await settle();
  assert.equal(e.find("voicing-results"), undefined); assert.equal(e.find("fingerings").getAttribute("aria-busy"), "true");
  e.change("voicing-mode", "fuller"); assert.equal(second.options.signal.aborted, true);
  await settle(); const third = controlled.requests[2];
  assert.equal(third.options.mode, "fuller");
  e.dispatch({ type: "settings.apply", tuningMidi: e.song.tuningMidi, capo: 1 }); assert.equal(third.options.signal.aborted, true);
  await settle(); const fourth = controlled.requests[3]; assert.equal(fourth.settings.capo, 1);
  fourth.resolve({ shapes: [], cancelled: false }); await settle(); assert.match(e.find("voicing-status").textContent, /No complete/);
  second.resolve({ shapes: [], cancelled: false }); third.resolve({ shapes: [], cancelled: false }); e.close();
});
test("closing, tab changes and destroy abort automatic requests without late writes", async () => {
  const controlled = controlledSearch(), e = harness(controlled); e.select("C");
  await settle(); e.click("tab-match"); assert.equal(controlled.requests[0].options.signal.aborted, true);
  e.click("tab-browse"); await settle(); e.click("close"); assert.equal(controlled.requests[1].options.signal.aborted, true);
  e.dispatch({ type: "panel.set", panel: "explore" }); await settle();
  e.component.destroy(); assert.equal(controlled.requests[2].options.signal.aborted, true);
  for (const request of controlled.requests) request.resolve({ shapes: [], cancelled: false }); await settle();
  assert.equal(e.root.childNodes.length, 0); assert.equal(e.sibling.textContent, "Outside ownership"); e.component.render(e.store.snapshot()); assert.equal(e.root.childNodes.length, 0); e.close();
});
test("failed search can retry, and API failures remain visible without losing selected preview", async () => {
  const controlled = controlledSearch();
  const e = harness({ ...controlled, reject: action => action.type === "explore.keep" ? { error: { code: "TEST", message: "Cannot keep this preview" } } : null });
  e.select("C"); await settle(); controlled.requests[0].reject(Error("worker failed")); await settle();
  assert.match(e.find("voicing-status").textContent, /could not be searched/); assert.equal(e.find("fingerings").getAttribute("aria-busy"), "false");
  e.click("retry-voicings"); await settle(); controlled.requests[1].resolve({ shapes: [], cancelled: false }); await settle();
  e.click("keep"); assert.match(e.find("error").textContent, /Cannot keep/); assert.equal(e.song.chords.length, 0); assert.equal(e.find("preview-name").textContent, "C"); e.close();
});
test("keyboard tabs, selected states, focus and open disclosures survive unrelated renders", () => {
  const e = harness(); e.select("C"); const rootSelect = e.node("browse-root"), disclosure = e.find("group-triads"); disclosure.open = true; rootSelect.focus();
  e.dispatch({ type: "song.update", patch: { title: "Unrelated save" } });
  assert.equal(e.node("browse-root"), rootSelect); assert.equal(e.doc.activeElement, rootSelect); assert.equal(disclosure.open, true);
  e.node("tab-browse").dispatchEvent({ type: "keydown", key: "ArrowRight" }); assert.equal(e.store.snapshot().exploreState.tab, "match"); assert.equal(e.doc.activeElement, e.node("tab-match"));
  assert.equal(e.node("tab-match").getAttribute("aria-selected"), "true");
  e.node("tab-match").dispatchEvent({ type: "keydown", key: "Home" }); assert.equal(e.doc.activeElement, e.node("tab-browse")); e.close();
});
test("real fuller voicings respect capo and slash bass, and mode changes clear the selected shape", async () => {
  const e = harness(); e.dispatch({ type: "settings.apply", tuningMidi: e.song.tuningMidi, capo: 2 });
  e.select("C/E"); e.change("voicing-mode", "fuller"); await completed(e);
  assert.ok(e.find("voicing-results").childNodes.length > 0); e.click("voicing-0");
  const notes = Music.notesForShape(e.song.tuningMidi, e.song.capo, e.store.snapshot().exploreState.selectedFrets);
  assert.ok(notes.length >= 4); assert.equal(notes.reduce((lowest, note) => note.midi < lowest.midi ? note : lowest).pc, 4);
  assert.deepEqual([...new Set(notes.map(note => note.pc))].sort((a, b) => a - b), [0, 4, 7]);
  assert.match(e.find("selected-shape-caption").textContent, /capo 2/);
  e.click("keep"); assert.equal(Music.formatInterpretation(e.song.chords[0].interpretation), "C/E");
  e.change("voicing-mode", "compact"); assert.equal(e.store.snapshot().exploreState.selectedFrets, null); assert.equal(e.find("selected-shape"), undefined); e.close();
});
test("Explore keeps the first fuller C as the familiar open shape", async () => {
  const e = harness(); e.select("C"); e.change("voicing-mode", "fuller");
  await completed(e); e.click("voicing-0");
  assert.deepEqual(e.store.snapshot().exploreState.selectedFrets, [0,1,0,2,3,null]);
  e.click("keep"); assert.deepEqual(e.song.chords[0].frets, [0,1,0,2,3,null]);
  assert.equal(Music.formatInterpretation(e.song.chords[0].interpretation), "C"); e.close();
});
test("Explore displays Em from string 6 to 1 while keeping the internal string order", async () => {
  const e = harness(); e.select("Em"); e.change("voicing-mode", "fuller"); await completed(e);
  assert.equal(e.node("voicing-0").textContent, "0 · 2 · 2 · 0 · 0 · 0");
  assert.equal(e.find("voicing-results").getAttribute("aria-label"), "Fingerings, strings 6 through 1");
  assert.equal(e.node("voicing-0").getAttribute("aria-label"), "Fingering 1, strings 6 through 1: 0, 2, 2, 0, 0, 0");
  e.click("voicing-0");
  assert.deepEqual(e.find("selected-shape-head-row").childNodes.map(node => node.textContent), ["String", "6", "5", "4", "3", "2", "1"]);
  assert.deepEqual(e.find("selected-shape-frets").childNodes.map(node => node.textContent), ["Fret", "0", "2", "2", "0", "0", "0"]);
  assert.deepEqual(e.find("selected-shape-tones").childNodes.map(node => node.textContent), ["Sounds", "E2", "B2", "E3", "G3", "B3", "E4"]);
  assert.deepEqual(e.store.snapshot().exploreState.selectedFrets, [0, 0, 0, 2, 2, 0]);
  e.click("keep"); assert.deepEqual(e.song.chords[0].frets, [0, 0, 0, 2, 2, 0]); e.close();
});
test("song switches abort old searches and never populate the new song with stale results", async () => {
  const controlled = controlledSearch(), e = harness(controlled); e.select("C"); await settle();
  const pending = controlled.requests[0], originalId = e.song.id;
  e.dispatch({ type: "library.create" }); assert.notEqual(e.song.id, originalId); assert.equal(pending.options.signal.aborted, true);
  pending.resolve({ shapes: [{ frets: [0, 1, 0, null, null, null], position: 1 }], cancelled: false }); await settle();
  e.dispatch({ type: "panel.set", panel: "explore" }); assert.equal(e.song.chords.length, 0); assert.equal(e.find("chord-preview"), undefined);
  e.dispatch({ type: "library.switch", songId: originalId }); assert.equal(e.store.snapshot().exploreState.selectedInterpretation.rootSpelling, "C");
  assert.equal(e.find("voicing-results"), undefined); e.close();
});

test("changing style immediately replaces results and keeps dropdown focus", async () => {
  const e = harness(); e.select("C"); await completed(e); e.click("voicing-0");
  const input = e.node("voicing-mode"); input.focus(); e.change("voicing-mode", "fuller");
  assert.equal(e.find("voicing-results"), undefined);
  assert.equal(e.store.snapshot().exploreState.selectedFrets, null);
  await completed(e);
  assert.equal(e.doc.activeElement, input); assert.equal(e.node("voicing-mode"), input);
  assert.equal(e.node("voicing-0").textContent, "× · 3 · 2 · 0 · 1 · 0");
  e.close();
});

test("unrelated renders and reopening completed results never repeat the search", async () => {
  const controlled = controlledSearch(), e = harness(controlled); e.select("C"); await settle();
  e.dispatch({ type:"song.update", patch:{ title:"While searching" } }); await settle();
  assert.equal(controlled.requests.length, 1);
  controlled.requests[0].resolve({shapes:[],cancelled:false}); await settle();
  e.dispatch({ type:"song.update", patch:{ title:"After searching" } });
  e.click("tab-match"); e.click("tab-browse"); e.click("close"); e.dispatch({type:"panel.set",panel:"explore"}); await settle();
  assert.equal(controlled.requests.length, 1); assert.match(e.find("voicing-status").textContent, /No complete/); e.close();
});

test("failed and cancelled results do not cause automatic retry loops", async () => {
  for (const cancelled of [false,true]) {
    const controlled = controlledSearch(), e = harness(controlled); e.select("C"); await settle();
    if (cancelled) controlled.requests[0].resolve({shapes:[],cancelled:true});
    else controlled.requests[0].reject(Error("failed"));
    await settle(); e.component.render(e.store.snapshot()); await settle();
    assert.equal(controlled.requests.length, 1); assert.ok(e.node("retry-voicings")); e.close();
  }
});

test("last-used style follows new and existing songs and survives reload without changing song data", () => {
  const backend = memoryStorage(), e = harness({backend}); const original = e.song.id, before = JSON.stringify(e.song);
  e.select("C"); e.change("voicing-mode", "fuller");
  assert.equal(JSON.stringify(e.song), before);
  e.dispatch({type:"library.create"}); assert.equal(e.store.snapshot().exploreState.voicingMode, "fuller");
  e.dispatch({type:"panel.set",panel:"explore"}); e.select("C"); e.change("voicing-mode", "compact");
  e.dispatch({type:"library.switch",songId:original}); assert.equal(e.store.snapshot().exploreState.voicingMode, "compact");
  e.select("C"); e.change("voicing-mode", "fuller"); e.close();
  const reloaded = harness({backend}); assert.equal(reloaded.store.snapshot().exploreState.voicingMode, "fuller"); reloaded.close();
});

test("invalid or unavailable style storage falls back safely and never blocks changing style", () => {
  const key = require("../../site/assets/js/song-notebook/contracts.js").fingeringStyleKey;
  for (const backend of [memoryStorage({[key]:"unsupported"}), {getItem(){throw Error("unavailable");},setItem(){throw Error("unavailable");}}]) {
    const e = harness({backend}); assert.equal(e.store.snapshot().exploreState.voicingMode, "compact");
    e.select("C"); e.change("voicing-mode", "fuller"); assert.equal(e.store.snapshot().exploreState.voicingMode, "fuller");
    assert.equal(e.store.dispatch({type:"explore.set",patch:{voicingMode:"unknown"}}).error.code, "INVALID_FINGERING_STYLE");
    assert.equal(e.store.snapshot().exploreState.voicingMode, "fuller"); e.close();
  }
});
