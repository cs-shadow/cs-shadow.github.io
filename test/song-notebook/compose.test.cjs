"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const Compose = require("../../site/assets/js/song-notebook/compose.js");
const Music = require("../../site/assets/js/song-notebook/music.js");
const Model = require("../../site/assets/js/song-notebook/model.js");
const Storage = require("../../site/assets/js/song-notebook/storage.js");
const Controller = require("../../site/assets/js/guitar-chordinator.js");
const { memoryStorage } = require("./fixtures.cjs");

// Minimal injected DOM: actual handlers and keyed child updates run against the
// real controller/model. Browser layout and native keyboard activation remain
// integration checks; no third-party DOM framework is needed for these cases.
class Node {
  constructor(doc, tag, value) {
    this.ownerDocument = doc; this.localName = tag; this.nodeType = tag ? 1 : 3;
    this.nodeValue = value; this.childNodes = []; this.attributes = new Map();
    this.value = ""; this.parentNode = null; this.open = false;
    this.classList = { add: value => this.attributes.set("class", value), remove: () => this.attributes.delete("class") };
  }
  get lastChild() { return this.childNodes.at(-1); }
  get textContent() { return this.nodeType === 3 ? this.nodeValue : this.childNodes.map(child => child.textContent).join(""); }
  get id() { return this.attributes.get("id"); }
  set id(value) { this.attributes.set("id", value); }
  setAttribute(name, value) { this.attributes.set(name, String(value)); }
  getAttribute(name) { return this.attributes.get(name) ?? null; }
  removeAttribute(name) { this.attributes.delete(name); }
  insertBefore(node, anchor) {
    if (node.parentNode) node.parentNode.removeChild(node);
    const at = anchor ? this.childNodes.indexOf(anchor) : this.childNodes.length;
    this.childNodes.splice(at, 0, node); node.parentNode = this; return node;
  }
  removeChild(node) {
    this.childNodes.splice(this.childNodes.indexOf(node), 1); node.parentNode = null;
    if (node.contains(this.ownerDocument.activeElement)) this.ownerDocument.activeElement = null;
    return node;
  }
  contains(node) { return this === node || this.childNodes.some(child => child.contains(node)); }
  focus() { this.ownerDocument.activeElement = this; }
  blur() { this.ownerDocument.activeElement = null; this.fire("blur"); }
  fire(type, extra = {}) {
    let prevented = false;
    const event = { target: this, currentTarget: this, preventDefault() { prevented = true; }, ...extra };
    if (this["on" + type]) this["on" + type](event);
    return prevented;
  }
}
function harness() {
  const doc = { activeElement: null, createElement(tag) { return new Node(this, tag); }, createTextNode(value) { return new Node(this, null, value); } };
  const hosts = Object.fromEntries(["collection", "sections", "arrangement"].map(name => [name, doc.createElement("div")]));
  let id = 0;
  const model = Model.create({ music: Music, id: () => "compose-" + ++id, now: () => "2026-09-08T08:00:00.000Z" });
  const storage = Storage.create({ storage: memoryStorage(), music: Music, model });
  const store = Controller.createStore({ music: Music, model, storage, schedule: () => 1, cancel() {} });
  const actions = [];
  const component = Compose.mount(hosts, { music: Music, dispatch(action) { actions.push(action); return store.dispatch(action); } });
  const unsubscribe = store.subscribe(view => component.render(view));
  component.render(store.snapshot());
  function find(key) {
    let result;
    function walk(node) { if (node._composeKey === key) result = node; node.childNodes.forEach(walk); }
    Object.values(hosts).forEach(walk);
    return result;
  }
  function click(key) { assert.ok(find(key), "Missing " + key); find(key).fire("click"); }
  function input(key, value) { const node = find(key); assert.ok(node, "Missing " + key); node.focus(); node.value = value; return node; }
  function type(text) { input("progression-input", text); find("progression-form").fire("submit"); }
  function dispatch(action) { const result = store.dispatch(action); assert.equal(result.error, null, JSON.stringify(result.error)); }
  function close() { unsubscribe(); component.destroy(); store.destroy(); }
  return { doc, hosts, store, actions, component, find, click, input, type, dispatch, close, get song() { return store.snapshot().song; }, get section() { return store.snapshot().song.sections.find(section => section.id === store.snapshot().activeSectionId); } };
}

test("empty workspace has no setup and all three entry paths; typed symbols preserve identity", () => {
  const h = harness();
  assert.equal(h.section.name, "Section 1"); assert.equal(h.song.chords.length, 0);
  assert.ok(h.find("new-chord")); assert.ok(h.find("explore")); assert.ok(h.find("progression-input"));
  h.type("Am F C G");
  assert.equal(h.section.occurrences.length, 4); assert.ok(h.song.chords.every(chord => chord.frets === null));
  assert.equal(h.find("progression-input").value, "");
  assert.equal(h.doc.activeElement, h.find("progression-input"));
  h.type("C# Db C♯ C/E");
  const [sharp, flat, again, slash] = h.section.occurrences.slice(4);
  assert.equal(sharp.chordId, again.chordId); assert.notEqual(sharp.chordId, flat.chordId);
  assert.equal(Music.formatInterpretation(h.song.chords.find(chord => chord.id === slash.chordId).interpretation), "C/E");
  h.close();
});
test("invalid progression retains input and all state, and a successful bulk insertion is one undo", () => {
  const h = harness(); h.type("C"); const before = JSON.stringify(h.song);
  h.type("Am nonsense G");
  assert.equal(JSON.stringify(h.song), before);
  assert.equal(h.find("progression-input").value, "Am nonsense G");
  assert.match(h.find("error-sections").textContent, /nonsense|Unknown|Invalid/i);
  h.type("Am F G"); assert.equal(h.section.occurrences.length, 4);
  h.dispatch({ type: "history.undo" }); assert.equal(h.section.occurrences.length, 1);
  h.close();
});
test("selection changes insertion location; collection inspect is separate from unconditional append", () => {
  const h = harness(); h.type("C G"); const c = h.song.chords[0], first = h.section.occurrences[0];
  h.click("occurrence-" + first.id + "-select");
  assert.match(h.find("progression-location").textContent, /Insert after C/);
  h.type("F");
  assert.deepEqual(h.section.occurrences.map(o => Music.formatInterpretation(h.song.chords.find(c => c.id === o.chordId).interpretation)), ["C", "F", "G"]);
  h.click("chord-" + c.id + "-inspect"); assert.equal(h.section.occurrences.length, 3);
  assert.equal(h.store.snapshot().panel, "editor");
  h.click("chord-" + c.id + "-append");
  assert.equal(h.section.occurrences.at(-1).chordId, c.id);
  assert.equal(h.actions.at(-1).afterOccurrenceId, null);
  h.close();
});
test("typing never chooses an existing shape and safe text never becomes markup", () => {
  const h = harness();
  h.dispatch({ type: "chord.create", chord: { frets: [0, 1, 0, 2, 3, null], interpretation: Music.parseChordSymbol("C").interpretation, nickname: "<img src=x>", notes: "<script>bad()</script>\nsecond line" } });
  h.type("C"); assert.equal(h.song.chords.length, 2); assert.equal(h.song.chords[1].frets, null);
  const first = h.song.chords[0];
  assert.equal(h.find("chord-" + first.id + "-notes").textContent, first.notes);
  assert.equal(h.find("chord-" + first.id + "-notes").childNodes[0].nodeType, 3);
  h.close();
});
test("unrelated renders preserve active text, selection, disclosure state and uncommitted timing unit", () => {
  const h = harness(); h.type("C"); const occurrence = h.section.occurrences[0];
  h.click("occurrence-" + occurrence.id + "-select");
  const timing = h.find("occurrence-controls-" + occurrence.id + "-duration"); timing.open = true;
  const unit = h.find("duration-unit-" + occurrence.id); unit.value = "bars";
  const input = h.input("progression-input", "Dm G"); input.selectionStart = 2; input.selectionEnd = 2;
  h.dispatch({ type: "song.update", patch: { title: "Changed elsewhere" } });
  assert.equal(h.find("progression-input"), input); assert.equal(h.doc.activeElement, input);
  assert.equal(input.value, "Dm G"); assert.equal(input.selectionStart, 2);
  assert.equal(h.find("duration-unit-" + occurrence.id).value, "bars"); assert.equal(timing.open, true);
  h.close();
});
test("occurrence actions reorder, duplicate, replace and remove with focus intact", () => {
  const h = harness(); h.type("C F G"); const occurrence = h.section.occurrences[1];
  h.click("occurrence-" + occurrence.id + "-select"); const key = "occurrence-controls-" + occurrence.id;
  const move = h.find(key + "-left"); move.focus(); h.click(key + "-left");
  assert.equal(h.section.occurrences[0].id, occurrence.id); assert.equal(h.doc.activeElement, h.find(key + "-right"));
  assert.equal(h.find(key + "-right").getAttribute("disabled"), null);
  h.click(key + "-duplicate"); assert.equal(h.section.occurrences.length, 4);
  assert.equal(h.section.occurrences[1].chordId, occurrence.chordId); assert.notEqual(h.section.occurrences[1].id, occurrence.id);
  const replacement = h.find(key + "-replacement"); replacement.value = h.song.chords[0].id; replacement.fire("change");
  assert.equal(h.section.occurrences[0].chordId, h.song.chords[0].id);
  h.click(key + "-details"); assert.equal(h.store.snapshot().inspectionOrigin.occurrenceId, occurrence.id);
  assert.equal(h.store.snapshot().drafts.length, 0);
  h.click(key + "-remove"); assert.equal(h.section.occurrences.length, 3);
  assert.equal(h.doc.activeElement, h.find("progression-input"));
  h.close();
});
test("fractional duration and multiline annotation stay visible when local controls close", () => {
  const h = harness(); h.type("Am"); const occurrence = h.section.occurrences[0], key = "occurrence-controls-" + occurrence.id;
  h.click("occurrence-" + occurrence.id + "-select");
  for (const invalid of ["0", "-1", "Infinity", ""]) {
    h.input("duration-value-" + occurrence.id, invalid);
    h.find(key + "-duration-form").fire("submit");
    assert.equal(h.section.occurrences[0].duration, null); assert.match(h.find("error-sections").textContent, /positive/);
  }
  h.input("duration-value-" + occurrence.id, "0.5"); h.find("duration-unit-" + occurrence.id).value = "bars";
  h.find(key + "-duration-form").fire("submit");
  h.input(key + "-annotation-input", "Let ring\nthen stop").blur();
  h.click(key + "-close");
  assert.equal(h.find("occurrence-" + occurrence.id + "-duration").textContent, "0.5 bars");
  assert.equal(h.find("occurrence-" + occurrence.id + "-annotation").textContent, "Let ring\nthen stop");
  assert.equal(h.find(key), undefined);
  h.close();
});
test("section tabs support arrow keyboard navigation, notes commit on blur and duplicates share chords", () => {
  const h = harness(); h.type("C F"); const original = h.section;
  h.input("section-name-" + original.id, "Verse").blur();
  h.input("section-notes-input-" + original.id, "First line\nSecond line").blur();
  assert.equal(h.find("section-notes-" + original.id).textContent, "First line\nSecond line");
  h.click("section-duplicate"); assert.equal(h.song.sections.length, 2);
  const copy = h.song.sections[1];
  assert.notEqual(copy.occurrences[0].id, original.occurrences[0].id); assert.equal(copy.occurrences[0].chordId, original.occurrences[0].chordId);
  const tab = h.find("tab-" + original.id); tab.focus(); assert.equal(tab.fire("keydown", { key: "ArrowRight" }), true);
  assert.equal(h.store.snapshot().activeSectionId, copy.id); assert.equal(h.doc.activeElement, h.find("tab-" + copy.id));
  assert.equal(h.find("tab-" + copy.id).getAttribute("aria-selected"), "true");
  h.close();
});
test("referenced chord deletion shows usage before explicit replacement, and undo restores everything", () => {
  const h = harness(); h.type("C C F"); const c = h.song.chords[0], f = h.song.chords[1];
  h.click("chord-" + c.id + "-delete");
  assert.equal(h.song.chords.length, 2); assert.match(h.find("delete-usage").textContent, /Used 2 times.*Section 1 \(2\)/);
  assert.equal(h.doc.activeElement, h.find("delete-cancel"));
  h.find("delete-replacement").value = f.id; h.click("delete-replace");
  assert.equal(h.song.chords.length, 1); assert.ok(h.section.occurrences.every(o => o.chordId === f.id));
  h.dispatch({ type: "history.undo" }); assert.equal(h.song.chords.length, 2); assert.equal(h.section.occurrences[0].chordId, c.id);
  h.close();
});
test("optional song order shows committed summary, supports repeats/moves, and section deletion is reference-safe", () => {
  const h = harness(); const first = h.section.id;
  assert.equal(h.find("arrangement-editor").open, false); assert.equal(h.find("arrangement-summary"), undefined);
  h.click("arrangement-add-" + first); h.click("section-add"); const second = h.section.id;
  h.click("arrangement-add-" + second); const entry = h.song.arrangement[1];
  h.input("arrangement-" + entry.id + "-repeat", "0").blur(); assert.equal(h.song.arrangement[1].repeatCount, 1);
  assert.match(h.find("error-arrangement").textContent, /positive whole number/);
  h.input("arrangement-" + entry.id + "-repeat", "3").blur();
  h.click("arrangement-" + entry.id + "-up"); assert.equal(h.song.arrangement[0].id, entry.id);
  assert.match(h.find("arrangement-summary").textContent, /Section 2 × 3 → Section 1/);
  h.click("section-delete"); assert.match(h.find("delete-usage").textContent, /Used 1 time in song order/);
  h.find("delete-replacement").value = first; h.click("delete-replace");
  assert.equal(h.song.sections.length, 1); assert.ok(h.song.arrangement.every(e => e.sectionId === first));
  h.click("section-delete"); assert.match(h.find("delete-last").textContent, /empty Section 1/); h.click("delete-remove");
  assert.equal(h.song.sections.length, 1); assert.equal(h.section.name, "Section 1"); assert.equal(h.song.arrangement.length, 0);
  h.close();
});
test("home actions use accepted identity; changing songs resets transient text and destroy releases hosts", () => {
  const h = harness(); h.type("Am"); const chord = h.song.chords[0];
  h.click("chord-" + chord.id + "-home"); assert.equal(h.song.context.tonicPc, 9);
  assert.equal(h.find("chord-" + chord.id + "-roman").textContent, "i");
  h.dispatch({ type: "chord.update", chordId: chord.id, patch: { reviewRequired: true, previousInterpretation: chord.interpretation } });
  assert.equal(h.find("chord-" + chord.id + "-home"), undefined); assert.equal(h.find("chord-" + chord.id + "-roman"), undefined);
  h.input("progression-input", "Uncommitted"); h.dispatch({ type: "library.create" });
  assert.equal(h.find("progression-input").value, "");
  h.component.destroy(); assert.ok(Object.values(h.hosts).every(host => host.childNodes.length === 0));
  h.component.render(h.store.snapshot()); assert.ok(Object.values(h.hosts).every(host => host.childNodes.length === 0));
  h.close();
});
