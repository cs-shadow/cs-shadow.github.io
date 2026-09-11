"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Controls = require("../../site/assets/js/music-tool-controls.js");
const {documentFixture} = require("./dom-fixture.cjs");
function setup(midi = false) {
  const document = documentFixture(), badges = document.createElement("div"), picker = document.createElement("div");
  document.body.append(badges, picker);
  const original = midi ? [64,59,55,50,45,40] : [4,11,7,2,9,4], changes = [];
  const control = Controls.mountStringNotes(badges, picker, {id:"tuning-picker", values:original, midi, onChange(value) {changes.push(value); control.update(value);}});
  const key = name => document.querySelector('[data-tuning-key="'+name+'"]');
  return {document, badges, picker, original, changes, control, key};
}
test("pitch-class picker delegates changes without mutating host data and restores focus", () => {
  const {document,picker,original,changes,control,key} = setup();
  key("string-5").click(); assert.equal(document.activeElement,key("note-4"));
  const selectedNode = key("note-2"); selectedNode.focus(); selectedNode.click();
  assert.deepEqual(changes,[[4,11,7,2,9,2]]); assert.equal(original[5],4);
  assert.equal(document.activeElement,selectedNode); assert.equal(selectedNode.getAttribute("aria-pressed"),"true");
  assert.equal(key("octave-up"),null);
  selectedNode.dispatchEvent({type:"keydown",key:"Escape",bubbles:true});
  assert.equal(document.activeElement,key("string-5")); assert.equal(picker.querySelector(".music-note-picker").hidden,true);
  key("string-0").click(); key("picker-done").click(); assert.equal(document.activeElement,key("string-0"));
  control.destroy(); assert.equal(picker.children.length,0);
});
test("MIDI picker preserves register and prevents edits outside MIDI bounds", () => {
  const {control,key,changes} = setup(true);
  key("string-0").click(); key("note-2").click(); assert.equal(changes.at(-1)[0],62);
  assert.equal(key("octave-down"),null); assert.equal(key("octave-up"),null);
  control.update([127,59,55,50,45,40]); assert.equal(key("note-8").disabled,true);
  key("note-8").click(); assert.equal(changes.length,1);
  control.update([0,59,55,50,45,40]);
  assert.equal(key("string-0").getAttribute("aria-label"),"String 1, C-1, edit tuning");
});
test("preset tiles show low-to-high notes and compare exact host values", () => {
  const document = documentFixture(), host = document.createElement("div"), changes=[];
  document.body.appendChild(host);
  const values=[4,11,7,2,9,4];
  const control=Controls.mountPresets(host,{values,presets:[{id:"standard",label:"Standard",values}],onChange:next=>changes.push(next)});
  const tile=host.querySelector("button"); assert.match(tile.textContent,/E · A · D · G · B · E/);
  assert.equal(tile.getAttribute("aria-pressed"),"true"); tile.click(); changes[0][0]=9; assert.equal(values[0],4);
  control.update([4,11,7,2,9,2]); assert.equal(tile.getAttribute("aria-pressed"),"false");
  control.destroy(); tile.click(); assert.equal(changes.length,1); assert.equal(host.children.length,0);
});

function tuningPanel(midi = false) {
  const document = documentFixture(), host = document.createElement("div"), changes = [];
  document.body.appendChild(host);
  const values = midi ? [64,59,55,50,45,40] : [4,11,7,2,9,4];
  const dropD = values.slice(); dropD[5] -= 2;
  const panel = Controls.mountTuning(host, {
    id: "shared-tuning-picker", values, capo: 0, midi,
    presets: [{id:"standard",label:"Standard",values}, {id:"drop-d",label:"Drop D",values:dropD}],
    onChange(next) { changes.push(next); panel.update(next); }
  });
  return {document,host,values,panel,changes,key: name => host.querySelector('[data-tuning-key="'+name+'"]')};
}
test("tuning panel keeps uncapoed host values and combines preset, pitch, and capo updates", () => {
  for (const midi of [false,true]) {
    const {document,host,values,panel,changes,key} = tuningPanel(midi);
    key("capo-2").click();
    assert.deepEqual(changes.at(-1), {values,capo:2});
    assert.match(host.querySelector(".music-sounding-tuning").textContent, midi ? /F#2 · B2 · E3 · A3 · C#4 · F#4/ : /F# · B · E · A · C# · F#/);
    key("preset-drop-d").click(); assert.equal(changes.at(-1).capo,2);
    assert.match(host.querySelector(".music-tuning-name").textContent,/Drop D/);
    key("string-5").click(); const choice=key("note-0"); choice.focus(); choice.click();
    assert.equal(changes.at(-1).values[5], midi ? 36 : 0); assert.equal(changes.at(-1).capo,2);
    assert.equal(document.activeElement,choice); assert.equal(key("octave-up"),null);
    assert.match(host.querySelector(".music-tuning-name").textContent,/Custom/);
    assert.equal(values[5],midi ? 40 : 4);
    panel.closePicker(); assert.equal(document.activeElement,key("string-5"));
    panel.destroy();
  }
});
test("tuning panel capo keyboard uses one tab stop and cleans up all callbacks", () => {
  const {document,host,panel,changes,key}=tuningPanel();
  function press(fret,command) { key("capo-"+fret).dispatchEvent({type:"keydown",key:command,bubbles:true}); }
  assert.equal(key("capo-0").getAttribute("tabindex"),"0");
  press(0,"ArrowRight"); assert.equal(changes.at(-1).capo,1); assert.equal(document.activeElement,key("capo-1"));
  assert.equal(key("capo-0").getAttribute("tabindex"),"-1");
  press(1,"End"); press(12,"ArrowRight"); assert.equal(changes.at(-1).capo,12);
  press(12,"Home"); press(0,"ArrowLeft"); assert.equal(changes.at(-1).capo,0);
  key("string-0").click();
  const event={type:"keydown",key:"Escape",bubbles:true}; key("capo-0").dispatchEvent(event);
  assert.equal(event.defaultPrevented,true); assert.equal(document.activeElement,key("string-0"));
  assert.equal(host.querySelector(".music-note-picker").hidden,true);
  const staleCapo=key("capo-5"),stalePreset=key("preset-drop-d"),count=changes.length;
  panel.destroy(); staleCapo.click(); stalePreset.click();
  assert.equal(changes.length,count); assert.equal(host.children.length,0);
});
