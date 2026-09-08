"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Music=require("../../site/assets/js/song-notebook/music.js");
const Model=require("../../site/assets/js/song-notebook/model.js");
const Storage=require("../../site/assets/js/song-notebook/storage.js");
const Controller=require("../../site/assets/js/guitar-chordinator.js");
const {memoryStorage}=require("./fixtures.cjs");
function setup(memory=memoryStorage()) {
  let id=0; const model=Model.create({music:Music,id:()=>`integration-${++id}`,now:()=>"2026-09-08T08:00:00.000Z"});
  const storage=Storage.create({storage:memory,model,music:Music});
  const effects=[];const store=Controller.createStore({music:Music,model,storage,onEffect:effect=>effects.push(effect)});store.initialize();
  function dispatch(action){const result=store.dispatch(action);assert.equal(result.error,null,JSON.stringify(result.error));return store.snapshot();}
  return {model,storage,store,memory,effects,dispatch};
}
test("real modules support immediate progression, spelling identity and one-step undo",()=>{
  const {store,dispatch}=setup();let view=store.snapshot();assert.equal(view.song.chords.length,0);assert.equal(view.song.sections[0].name,"Section 1");
  const sectionId=view.activeSectionId;
  view=dispatch({type:"progression.insert",sectionId,text:"Am F C G",afterOccurrenceId:null});assert.equal(view.song.chords.length,4);assert.ok(view.song.chords.every(chord=>chord.frets===null));
  const before=JSON.stringify(view.song);const failed=store.dispatch({type:"progression.insert",sectionId,text:"Dm nonsense",afterOccurrenceId:null});assert.ok(failed.error);assert.equal(JSON.stringify(store.snapshot().song),before);
  view=dispatch({type:"progression.insert",sectionId,text:"C# Db C♯",afterOccurrenceId:null});assert.equal(view.song.chords.length,6);assert.equal(view.song.sections[0].occurrences[4].chordId,view.song.sections[0].occurrences[6].chordId);
  view=dispatch({type:"history.undo"});assert.equal(view.song.sections[0].occurrences.length,4);store.destroy();
});
test("draft origin survives storage reload and variation only replaces its original occurrence",()=>{
  const first=setup();let view=first.dispatch({type:"progression.insert",sectionId:first.store.snapshot().activeSectionId,text:"C C C",afterOccurrenceId:null});
  const chordId=view.song.chords[0].id,sectionId=view.activeSectionId,origin=view.song.sections[0].occurrences[0].id;
  first.dispatch({type:"chord.inspect",chordId,sectionId,occurrenceId:origin});first.dispatch({type:"draft.patch",chordId,patch:{nickname:"Variation draft"}});first.store.flush();
  // New controller with same model avoids test-injected ID collisions on reload.
  const second=Controller.createStore({music:Music,model:first.model,storage:first.storage});
  const later=view.song.sections[0].occurrences[2].id;second.dispatch({type:"selection.set",sectionId,occurrenceId:later});second.dispatch({type:"chord.inspect",chordId,sectionId,occurrenceId:later});
  assert.equal(second.snapshot().drafts[0].originOccurrenceId,origin);
  assert.equal(second.dispatch({type:"draft.apply",chordId,mode:"variation"}).error,null);
  const result=second.snapshot().song;assert.notEqual(result.sections[0].occurrences[0].chordId,chordId);assert.equal(result.sections[0].occurrences[2].chordId,chordId);
  assert.equal(second.snapshot().drafts.length,0);first.store.destroy();second.destroy();
});
test("stale source cannot update silently; deleted draft origin yields collection-only variation",()=>{
  const {store,dispatch}=setup();let view=dispatch({type:"progression.insert",sectionId:store.snapshot().activeSectionId,text:"C C",afterOccurrenceId:null});
  const chordId=view.song.chords[0].id,sectionId=view.activeSectionId,occurrenceId=view.song.sections[0].occurrences[0].id;
  dispatch({type:"chord.inspect",chordId,sectionId,occurrenceId});dispatch({type:"draft.patch",chordId,patch:{nickname:"Experiment"}});
  dispatch({type:"chord.update",chordId,patch:{notes:"A newer committed note"}});
  assert.equal(store.dispatch({type:"draft.apply",chordId,mode:"update"}).error.code,"STALE_CHORD");
  dispatch({type:"occurrence.delete",sectionId,occurrenceId});view=dispatch({type:"draft.apply",chordId,mode:"variation"});
  assert.equal(view.song.chords.length,2);assert.equal(view.song.sections[0].occurrences[0].chordId,chordId);assert.match(store.state().notice,/nothing was replaced/);store.destroy();
});
test("real settings changes transpose shapes, retain name-only harmony and invalidate drafts",()=>{
  const {store,dispatch}=setup();const C=Music.parseChordSymbol("C").interpretation;
  let view=dispatch({type:"chord.create",chord:{frets:[0,1,0,2,3,null],interpretation:C,nickname:"",notes:"",reviewRequired:false,previousInterpretation:null}});
  const shaped=view.song.chords[0].id;dispatch({type:"progression.insert",sectionId:view.activeSectionId,text:"C",afterOccurrenceId:null});dispatch({type:"chord.inspect",chordId:shaped});
  view=dispatch({type:"settings.apply",tuningMidi:Music.defaultTuning.slice(),capo:2});assert.equal(Music.formatInterpretation(view.song.chords[0].interpretation),"D");assert.equal(Music.formatInterpretation(view.song.chords[1].interpretation),"C");
  assert.equal(store.dispatch({type:"draft.apply",chordId:shaped,mode:"update"}).error.code,"STALE_SETTINGS");
  assert.equal(store.snapshot().drafts[0].capo,0);
  view=dispatch({type:"settings.apply",tuningMidi:Music.presets[1].tuningMidi.slice(),capo:2});assert.equal(view.song.chords[0].reviewRequired,true);assert.deepEqual(view.song.chords[0].frets,[0,1,0,2,3,null]);store.destroy();
});
test("committed JSON round-trip preserves unused material and remaps every home/reference ID",()=>{
  const {store,dispatch,storage}=setup();let view=dispatch({type:"progression.insert",sectionId:store.snapshot().activeSectionId,text:"C F G Bb",afterOccurrenceId:null});
  const c=view.song.chords[0];view=dispatch({type:"context.set",context:{tonicPc:0,tonicSpelling:"C",sourceChordId:c.id,scaleId:"major"}});
  dispatch({type:"draft.open",chordId:null});dispatch({type:"draft.patch",chordId:null,patch:{frets:[0,null,null,null,null,null],nickname:"Unapplied"}});
  const exported=storage.exportSong(store.snapshot().song);assert.equal(exported.error,null);assert.ok(!exported.data.includes("Unapplied"));
  const imported=storage.importSong(exported.data);assert.equal(imported.error,null);assert.notEqual(imported.data.id,view.song.id);assert.notEqual(imported.data.context.sourceChordId,c.id);assert.equal(imported.data.context.sourceChordId,imported.data.chords[0].id);
  const major=Music.matchScales(view.song.chords,view.song,view.song.context).candidates.find(item=>item.tonicPc===0&&item.scaleId==="major");assert.equal(major.fitCount,3);assert.deepEqual(major.memberships.find(item=>item.chordId===view.song.chords[3].id).outside,[10]);store.destroy();
});

test("failed library write preserves the durable applied draft until retry succeeds",()=>{
 const memory=memoryStorage(),e=setup(memory);e.dispatch({type:"draft.open",chordId:null});e.dispatch({type:"draft.patch",chordId:null,patch:{frets:[0,null,null,null,null,null],nickname:"Recover me"}});e.store.flush();
 const set=memory.setItem.bind(memory);let failing=true;memory.setItem=(key,value)=>{if(failing&&key.includes("library"))throw Error("quota");set(key,value);};
 e.dispatch({type:"draft.apply",chordId:null,mode:"keep"});assert.equal(e.store.snapshot().saveStatus,"failed");
 const recovered=setup(memory);assert.equal(recovered.store.snapshot().song.chords.length,0);assert.equal(recovered.store.snapshot().drafts[0].candidate.nickname,"Recover me");recovered.store.destroy();
 failing=false;e.store.flush();const saved=setup(memory);assert.equal(saved.store.snapshot().song.chords[0].nickname,"Recover me");assert.equal(saved.store.snapshot().drafts.length,0);saved.store.destroy();e.store.destroy();
});
test("settings undo and redo invalidate selected exploration fingerings",()=>{
 const e=setup(),select=()=>e.dispatch({type:"explore.set",patch:{selectedInterpretation:Music.parseChordSymbol("C").interpretation,selectedFrets:[0,1,0,2,3,null]}});
 select();e.dispatch({type:"settings.apply",tuningMidi:[64,59,55,50,45,40],capo:2});assert.equal(e.store.snapshot().exploreState.selectedFrets,null);
 select();e.dispatch({type:"history.undo"});assert.equal(e.store.snapshot().exploreState.selectedFrets,null);
 select();e.dispatch({type:"history.redo"});assert.equal(e.store.snapshot().exploreState.selectedFrets,null);e.store.destroy();
});
