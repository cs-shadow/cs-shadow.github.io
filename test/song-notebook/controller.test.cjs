"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Controller=require("../../site/assets/js/guitar-chordinator.js");
const {clone,songFixture,blankDraftFixture,musicFixture}=require("./fixtures.cjs");
function harness(options={}) {
  const writes=[],scheduled=new Map(); let timerId=0;
  const initial=songFixture();
  const model={createSong:()=>clone(initial),fingerprint:chord=>JSON.stringify(chord),applyAction(song,action) { if(action.type!=="song.update") throw Error("Unexpected test action"); return {song:{...clone(song),...action.patch},error:null}; }};
  const storage={
    loadLibrary:()=>({data:options.corrupt?null:{version:1,activeSongId:initial.id,songs:[clone(initial)]},raw:options.corrupt?"not json":null,error:options.corrupt?{code:"CORRUPT",message:"Invalid stored JSON",path:null,details:null}:null}),
    loadDrafts:()=>({data:{version:1,drafts:options.drafts||[]},error:null,raw:null}),
    saveLibrary(value){writes.push({type:"library",value:clone(value)});return {data:options.full?null:true,error:options.full?{code:"FULL",message:"Storage full",path:null,details:null}:null};},
    saveDrafts(value){writes.push({type:"drafts",value:clone(value)});return {data:true,error:null};},
    exportSong: song=>({data:JSON.stringify(song),error:null})
  };
  const effects=[];
  const store=Controller.createStore({model,storage,music:musicFixture(),schedule(fn){scheduled.set(++timerId,fn);return timerId;},cancel(id){scheduled.delete(id);},onEffect:effect=>effects.push(effect)});
  store.initialize();
  return {store,writes,scheduled,effects};
}
test("text edits debounce storage and undo restores the prior committed song",()=>{
  const {store,writes,scheduled}=harness();
  store.dispatch({type:"song.update",patch:{title:"Verse idea"}});
  assert.equal(store.snapshot().saveStatus,"saving");assert.equal(writes.length,0);assert.equal(scheduled.size,1);
  store.flush();assert.equal(writes[0].value.songs[0].title,"Verse idea");assert.equal(store.snapshot().saveStatus,"saved");
  store.dispatch({type:"history.undo"});assert.equal(store.snapshot().song.title,"");
  store.dispatch({type:"history.redo"});assert.equal(store.snapshot().song.title,"Verse idea");
});
test("cross-tab change suspends both pending and future overwrites until explicit resolution",()=>{
  const {store,writes,scheduled}=harness();
  store.dispatch({type:"song.update",patch:{title:"Local copy"}});
  store.storageChanged("cs-shadow.guitar-chordinator.library.v1");
  assert.equal(scheduled.size,0);store.flush();assert.equal(writes.length,0);
  store.dispatch({type:"draft.open",chordId:null});assert.equal(writes.length,0);
  assert.equal(store.snapshot().song.title,"Local copy");assert.equal(store.state().suspended,"conflict");
  store.dispatch({type:"panel.set",panel:"explore"});assert.equal(store.snapshot().error.code,"STORAGE_CONFLICT");
  store.dispatch({type:"library.conflict",resolution:"keep"});assert.equal(writes.length,2);assert.equal(store.snapshot().saveStatus,"saved");
});
test("corrupted raw storage survives in-memory editing and is available for backup",()=>{
  const {store,writes,effects}=harness({corrupt:true});
  store.dispatch({type:"song.update",patch:{title:"Recoverable work"}});store.flush();
  assert.equal(writes.length,0);assert.equal(store.snapshot().saveStatus,"failed");
  store.dispatch({type:"file.backup"});assert.equal(JSON.parse(effects[0].text).library,"not json");
  store.dispatch({type:"file.export"});assert.equal(JSON.parse(effects[1].text).title,"Recoverable work");
});
test("full storage never reports Saved, while in-memory work remains available",()=>{
  const {store}=harness({full:true});store.dispatch({type:"song.update",patch:{title:"Still here"}});store.flush();
  assert.equal(store.snapshot().saveStatus,"failed");assert.equal(store.snapshot().error.code,"FULL");assert.equal(store.snapshot().song.title,"Still here");
});
test("opening an existing draft from another occurrence preserves its original target",()=>{
  const initial=songFixture(); const draft={...blankDraftFixture(),chordId:"chord-c",candidate:clone(initial.chords[0]),sourceFingerprint:JSON.stringify(initial.chords[0]),originSectionId:"section-old",originOccurrenceId:"occurrence-old"};delete draft.candidate.id;
  const {store}=harness({drafts:[draft]});
  store.dispatch({type:"draft.open",chordId:"chord-c",originSectionId:"section-1",originOccurrenceId:"occurrence-1"});
  assert.equal(store.snapshot().drafts[0].originOccurrenceId,"occurrence-old");
  store.dispatch({type:"draft.retarget",chordId:"chord-c",sectionId:"section-1",occurrenceId:"occurrence-1"});
  assert.equal(store.snapshot().drafts[0].originOccurrenceId,"occurrence-1");
});
test("incomplete new chord drafts save separately and never leak into committed export",()=>{
  const {store,writes,effects}=harness();store.dispatch({type:"draft.open",chordId:null});
  assert.equal(writes[0].type,"drafts");assert.ok(writes[0].value.drafts[0].candidate.frets.every(fret=>fret===null));
  store.dispatch({type:"file.export"});assert.equal(JSON.parse(effects[0].text).chords.length,2);assert.match(store.state().notice,/Unapplied draft/);
});
