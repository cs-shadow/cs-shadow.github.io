"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const Controls = require("../../site/assets/js/music-tool-controls.js");
const {documentFixture} = require("./dom-fixture.cjs");
function setup(octaves = false) {
  const document = documentFixture(), badges = document.createElement("div"), picker = document.createElement("div");
  document.body.append(badges, picker);
  const original = octaves ? [64,59,55,50,45,40] : [4,11,7,2,9,4], changes = [];
  const control = Controls.mountStringNotes(badges, picker, {id:"tuning-picker", values:original, octaves, onChange(value) {changes.push(value); control.update(value);}});
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
  key("octave-down").click(); assert.equal(changes.at(-1)[0],50);
  control.update([127,59,55,50,45,40]); assert.equal(key("octave-up").disabled,true); assert.equal(key("note-8").disabled,true);
  key("note-8").click(); assert.equal(changes.length,2);
  control.update([0,59,55,50,45,40]); assert.equal(key("octave-down").disabled,true);
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
