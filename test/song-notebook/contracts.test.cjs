"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const fs=require("node:fs");
const path=require("node:path");
const vm=require("node:vm");
const {contracts,songFixture,musicFixture,blankDraftFixture}=require("./fixtures.cjs");
const root=path.resolve(__dirname,"../..");

test("browser and CommonJS expose identical immutable contracts",()=>{
  const context={}; vm.runInNewContext(fs.readFileSync(path.join(root,"site/assets/js/song-notebook/contracts.js"),"utf8"),context);
  assert.equal(JSON.stringify(context.SongNotebookContracts),JSON.stringify(contracts));
  assert.ok(Object.isFrozen(contracts.hosts.compose));
});
test("staged page provides unique component hosts and only existing assets",()=>{
  const html=fs.readFileSync(path.join(root,"site/tools/guitar-chordinator/index.html"),"utf8");
  const ids=[...html.matchAll(/id="([^"]+)"/g)].map(match=>match[1]);
  assert.equal(new Set(ids).size,ids.length);
  for(const group of Object.values(contracts.hosts)) for(const id of Object.values(group)) assert.ok(ids.includes(id),id);
  for(const match of html.matchAll(/(?:src|href)="(\/assets\/[^\"]+)"/g)) assert.ok(fs.existsSync(path.join(root,"site",match[1])),match[1]);
  assert.match(html,/id="song-notebook"[^>]+hidden/);
});
test("shared fixture covers spelling distinction, register, unused work and references",()=>{
  const music=musicFixture(),song=songFixture();
  const sharp=music.parseChordSymbol("C♯").interpretation,flat=music.parseChordSymbol("Db").interpretation;
  assert.equal(sharp.rootPc,flat.rootPc); assert.notEqual(sharp.rootSpelling,flat.rootSpelling);
  assert.equal(Math.min(...music.notesForShape(song.tuningMidi,0,song.chords[1].frets).map(n=>n.midi)),48);
  assert.equal(song.context.sourceChordId,song.chords[0].id);
  assert.equal(song.sections[0].occurrences[0].duration.value,0.5);
  assert.equal(song.arrangement[0].sectionId,song.sections[0].id);
  assert.ok(!song.sections[0].occurrences.some(o=>o.chordId===song.chords[1].id));
  const blank=blankDraftFixture();
  assert.equal(blank.chordId,null);
  assert.equal(blank.sourceFingerprint,null);
  assert.equal(blank.candidate.interpretation,null);
  assert.ok(blank.candidate.frets.every(fret=>fret===null));
});
