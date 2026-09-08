"use strict";
const test = require("node:test");
const assert = require("node:assert/strict");
const fs = require("node:fs");
const vm = require("node:vm");
const Model = require("../../site/assets/js/song-notebook/model.js");
const { dependencies, songFixture, interpretation, clone } = require("./fixtures.cjs");
function setup() { const deps = dependencies(); return { model: Model.create(deps), deps }; }
function apply(model, song, action) { const snapshot = clone(song), payload = clone(action); const result = model.applyAction(song, action); assert.equal(result.error, null, JSON.stringify(result.error)); assert.deepEqual(song, snapshot, "original song unchanged"); assert.deepEqual(action, payload, "action unchanged"); assert.equal(model.validateSong(result.song).valid, true); return result.song; }
const named = name => ({ frets:null, interpretation:interpretation(name), nickname:"", notes:"" });
function allIds(song) { return [song.id, ...song.chords.map(c=>c.id), ...song.sections.flatMap(s=>[s.id,...s.occurrences.map(o=>o.id)]), ...song.arrangement.map(a=>a.id)]; }

test("new songs have no sample material and copy only documented overrides", () => {
  const { model } = setup(), tuning=[64,59,55,50,45,38];
  const song=model.createSong({title:"",notes:"ideas",tuningMidi:tuning,capo:2, ignored:"extra"});
  assert.deepEqual(song.chords,[]); assert.deepEqual(song.arrangement,[]); assert.equal(song.sections[0].name,"Section 1"); assert.equal(song.context,null); assert.equal(song.capo,2); assert.equal(song.ignored,undefined);
  song.tuningMidi[0]=63; assert.equal(tuning[0],64); assert.notEqual(song.id,song.sections[0].id);
  assert.notEqual(model.createSong().id,song.id);
});

test("validation rejects malformed documented fields and broken or duplicate IDs", () => {
  const {model}=setup(); assert.deepEqual(model.validateSong(songFixture()),{valid:true,error:null});
  const corruptions=[
    s=>{s.context=undefined;},s=>{s.id=" ";},s=>{s.title=null;},s=>{s.notes=1;},s=>{s.createdAt="yesterday";},s=>{s.updatedAt=null;},
    s=>{s.tuningMidi[0]=128;},s=>{s.tuningMidi[0]=1.5;},s=>{s.tuningMidi=new Array(6);},s=>{s.capo=13;},s=>{s.capo=-1;},
    s=>{s.sections=[];},s=>{s.sections[0].id=s.id;},s=>{s.chords[1].id=s.chords[0].id;},s=>{s.sections[0].occurrences[0].id=s.chords[0].id;},
    s=>{s.chords[0].reviewRequired="false";},s=>{s.chords[0].previousInterpretation=undefined;},s=>{s.chords[1].frets=[0];},s=>{s.chords[1].frets=new Array(6);},s=>{s.chords[1].frets[0]=-1;},
    s=>{s.chords[0].interpretation.rootSpelling="Db";},s=>{s.chords[0].interpretation.formulaId="not-real";},s=>{s.chords[0].interpretation.bassSpelling="C";},
    s=>{s.sections[0].occurrences[0].chordId="deleted";},s=>{s.arrangement[0].sectionId="deleted";},s=>{s.arrangement[0].repeatCount=0;},s=>{s.arrangement[0].repeatCount=1.2;},
    s=>{s.context.sourceChordId="deleted";},s=>{s.context.sourceChordId="chord-shape";},s=>{s.context.tonicPc=2;},s=>{s.context.scaleId="no-scale";},
    s=>{s.chords[0].reviewRequired=true;},s=>{s.chords[1].frets=[null,null,null,null,null,null];}
  ];
  for(const corrupt of corruptions) { const song=songFixture(); corrupt(song); const result=model.validateSong(song); assert.equal(result.valid,false,corrupt.toString()); assert.equal(typeof result.error.code,"string"); assert.equal(typeof result.error.message,"string"); assert.ok("path" in result.error && "details" in result.error); }
  for(const value of [0,-1,Infinity,NaN,"1"]) { const song=songFixture(); song.sections[0].occurrences[0].duration.value=value; assert.equal(model.validateSong(song).valid,false); }
});

test("typed progressions are atomic, spelling-sensitive and never adopt a saved fingering", () => {
  const {model}=setup(); let song=songFixture();
  song=apply(model,song,{type:"chord.update",chordId:"chord-shape",patch:{interpretation:interpretation("C")}});
  const original=song, failed=model.applyAction(song,{type:"progression.insert",sectionId:"section-1",text:"Am F ??? G",afterOccurrenceId:null});
  assert.strictEqual(failed.song,original); assert.equal(failed.error.code,"INVALID_SYMBOL"); assert.equal(failed.error.details.token,"???");
  song=apply(model,song,{type:"progression.insert",sectionId:"section-1",text:"C C# Db C♯ C/E,Am",afterOccurrenceId:"occurrence-1"});
  const occurrences=song.sections[0].occurrences;
  assert.equal(occurrences.length,7); assert.equal(occurrences[1].chordId,"chord-c");
  assert.equal(occurrences[2].chordId,occurrences[4].chordId); assert.notEqual(occurrences[2].chordId,occurrences[3].chordId);
  assert.equal(song.chords.find(c=>c.id===occurrences[2].chordId).interpretation.rootSpelling,"C#");
  assert.equal(song.chords.find(c=>c.id===occurrences[3].chordId).interpretation.rootSpelling,"Db");
  assert.equal(song.chords.find(c=>c.id===occurrences[5].chordId).interpretation.bassSpelling,"E");
  assert.ok(occurrences.every(o=>o.chordId!=="chord-shape"));
  for(const text of ["",",  ,"]) assert.equal(model.applyAction(song,{type:"progression.insert",sectionId:"section-1",text,afterOccurrenceId:null}).error.code,"EMPTY_PROGRESSION");
  assert.strictEqual(model.applyAction(song,{type:"progression.insert",sectionId:"section-1",text:"F",afterOccurrenceId:"deleted"}).song,song);
});

test("chord Keep normalizes muted name-only shapes and adds one occurrence atomically", () => {
  const {model}=setup(); let song=model.createSong(); const sectionId=song.sections[0].id;
  song=apply(model,song,{type:"chord.create",chord:{...named("Am"),frets:Array(6).fill(null)},sectionId});
  assert.equal(song.chords[0].frets,null); assert.equal(song.sections[0].occurrences.length,1);
  let result=model.applyAction(song,{type:"chord.create",chord:{...named("C"),interpretation:null}}); assert.equal(result.error.code,"EMPTY_CHORD"); assert.strictEqual(result.song,song);
  result=model.applyAction(song,{type:"chord.create",chord:named("C"),sectionId:"missing"}); assert.equal(result.error.code,"NOT_FOUND"); assert.strictEqual(result.song,song);
  song=apply(model,song,{type:"chord.create",chord:{...named("C"),interpretation:null,frets:[0,null,null,null,null,null],nickname:"An idea"}});
  assert.equal(song.chords[1].nickname,"An idea");
});

test("shared updates preserve all references; stale fingerprint rejects without mutation", () => {
  const {model}=setup(); let song=songFixture();
  for(let i=0;i<2;i++) song=apply(model,song,{type:"occurrence.create",sectionId:"section-1",chordId:"chord-c"});
  const source=model.fingerprint(song.chords[0]);
  song=apply(model,song,{type:"chord.update",chordId:"chord-c",patch:{interpretation:interpretation("D"),notes:"changed"},expectedFingerprint:source});
  assert.equal(model.getUsage(song,{chordId:"chord-c"}).occurrences.length,3); assert.equal(song.context.tonicPc,2); assert.equal(song.context.tonicSpelling,"D");
  const conflict=model.applyAction(song,{type:"chord.update",chordId:"chord-c",patch:{nickname:"stale"},expectedFingerprint:source});
  assert.strictEqual(conflict.song,song); assert.equal(conflict.error.code,"SOURCE_CONFLICT");
  const reordered={notes:song.chords[0].notes,...song.chords[0],ignored:"discard"}; assert.equal(model.fingerprint(reordered),model.fingerprint(song.chords[0]));
});

test("variation changes only its original live occurrence and safely recovers deleted origins", () => {
  const {model}=setup(); let song=songFixture(); song=apply(model,song,{type:"occurrence.create",sectionId:"section-1",chordId:"chord-c"});
  song=apply(model,song,{type:"chord.variation",chordId:"chord-c",chord:named("Cm"),originSectionId:"section-1",originOccurrenceId:"occurrence-1"});
  assert.equal(song.sections[0].occurrences[0].chordId,song.chords.at(-1).id); assert.equal(song.sections[0].occurrences[1].chordId,"chord-c");
  for(const origin of [{originSectionId:null,originOccurrenceId:null},{originSectionId:"gone",originOccurrenceId:"gone"},{originSectionId:"section-1",originOccurrenceId:"gone"},{originSectionId:"section-1",originOccurrenceId:"occurrence-1"}]) {
    const before=clone(song.sections); song=apply(model,song,{type:"chord.variation",chordId:"chord-c",chord:named("F"),...origin}); assert.deepEqual(song.sections,before);
  }
  song=apply(model,song,{type:"section.delete",sectionId:"section-1",referenceMode:"remove"}); const sections=clone(song.sections);
  song=apply(model,song,{type:"chord.variation",chordId:"chord-c",chord:named("G"),originSectionId:"section-1",originOccurrenceId:"occurrence-1"}); assert.deepEqual(song.sections,sections);
});

test("deletion requires reference choice, replaces atomically, and retains home tonic", () => {
  const {model}=setup(); let song=songFixture();
  assert.equal(model.applyAction(song,{type:"chord.delete",chordId:"chord-c"}).error.code,"REFERENCES_REQUIRE_CHOICE");
  assert.equal(model.applyAction(song,{type:"chord.delete",chordId:"chord-c",referenceMode:"replace",replacementChordId:"chord-c"}).error.code,"INVALID_REPLACEMENT");
  assert.strictEqual(model.applyAction(song,{type:"chord.delete",chordId:"chord-c",referenceMode:"replace",replacementChordId:"absent"}).song,song);
  song=apply(model,song,{type:"chord.delete",chordId:"chord-c",referenceMode:"replace",replacementChordId:"chord-shape"});
  assert.equal(song.sections[0].occurrences[0].chordId,"chord-shape"); assert.deepEqual(song.context,{tonicPc:0,tonicSpelling:"C",sourceChordId:null,scaleId:null});
  song=apply(model,song,{type:"chord.delete",chordId:"chord-shape",referenceMode:"remove"}); assert.deepEqual(song.sections[0].occurrences,[]);
});

test("section duplication shares chords but owns notes, durations, IDs and order refs", () => {
  const {model}=setup(); let song=songFixture(); song=apply(model,song,{type:"section.duplicate",sectionId:"section-1"});
  const copy=song.sections[1]; assert.notEqual(copy.id,"section-1"); assert.notEqual(copy.occurrences[0].id,"occurrence-1"); assert.equal(copy.occurrences[0].chordId,"chord-c");
  song=apply(model,song,{type:"section.update",sectionId:copy.id,patch:{name:"Verse B",notes:"New\nline"}});
  song=apply(model,song,{type:"occurrence.update",sectionId:copy.id,occurrenceId:copy.occurrences[0].id,patch:{duration:{value:0.25,unit:"beats"},annotation:"Quiet"}});
  assert.equal(song.sections[0].occurrences[0].duration.value,0.5); assert.equal(song.sections[0].name,"Section 1");
  assert.equal(model.applyAction(song,{type:"section.delete",sectionId:"section-1"}).error.code,"REFERENCES_REQUIRE_CHOICE");
  song=apply(model,song,{type:"section.delete",sectionId:"section-1",referenceMode:"replace",replacementSectionId:copy.id}); assert.equal(song.arrangement[0].sectionId,copy.id);
  song=apply(model,song,{type:"section.delete",sectionId:copy.id,referenceMode:"remove"}); assert.equal(song.sections.length,1); assert.equal(song.sections[0].name,"Section 1"); assert.deepEqual(song.sections[0].occurrences,[]); assert.deepEqual(song.arrangement,[]);
});

test("occurrence and arrangement operations enforce values and keep stable identities", () => {
  const {model}=setup(); let song=songFixture();
  song=apply(model,song,{type:"section.create",name:"Verse"}); const sectionId=song.sections[1].id;
  song=apply(model,song,{type:"occurrence.duplicate",sectionId:"section-1",occurrenceId:"occurrence-1"}); const second=song.sections[0].occurrences[1].id;
  song=apply(model,song,{type:"occurrence.move",sectionId:"section-1",occurrenceId:second,direction:-1}); assert.equal(song.sections[0].occurrences[0].id,second);
  const old=clone(song.sections); song=apply(model,song,{type:"occurrence.move",sectionId:"section-1",occurrenceId:second,direction:-1}); assert.deepEqual(song.sections,old);
  song=apply(model,song,{type:"occurrence.update",sectionId:"section-1",occurrenceId:second,patch:{chordId:"chord-shape",duration:null,annotation:"Here"}});
  assert.strictEqual(model.applyAction(song,{type:"occurrence.update",sectionId:"section-1",occurrenceId:second,patch:{duration:{value:NaN,unit:"bars"}}}).song,song);
  song=apply(model,song,{type:"occurrence.delete",sectionId:"section-1",occurrenceId:second});
  song=apply(model,song,{type:"arrangement.create",sectionId}); const orderId=song.arrangement[1].id;
  song=apply(model,song,{type:"arrangement.update",arrangementId:orderId,patch:{repeatCount:3}});
  song=apply(model,song,{type:"arrangement.move",arrangementId:orderId,direction:-1}); assert.equal(song.arrangement[0].id,orderId);
  song=apply(model,song,{type:"arrangement.delete",arrangementId:"order-1"}); assert.equal(song.arrangement.length,1);
  assert.strictEqual(model.applyAction(song,{type:"arrangement.update",arrangementId:orderId,patch:{repeatCount:1.5}}).song,song);
  assert.strictEqual(model.applyAction(song,{type:"occurrence.move",sectionId:"section-1",occurrenceId:"occurrence-1",direction:2}).song,song);
});

test("capo transposes accepted shapes and home only; retuning retains labels for explicit review", () => {
  const {model}=setup(); let song=songFixture();
  song=apply(model,song,{type:"chord.update",chordId:"chord-shape",patch:{interpretation:interpretation("C")}});
  song=apply(model,song,{type:"context.set",context:{tonicPc:0,tonicSpelling:"C",sourceChordId:"chord-shape",scaleId:"major"}});
  song=apply(model,song,{type:"settings.apply",tuningMidi:song.tuningMidi,capo:2});
  assert.equal(song.chords[1].interpretation.rootSpelling,"D"); assert.equal(song.chords[0].interpretation.rootSpelling,"C"); assert.equal(song.context.tonicPc,2); assert.deepEqual(song.chords[1].frets,[0,1,0,2,3,null]);
  song=apply(model,song,{type:"settings.apply",tuningMidi:[64,59,55,50,45,38],capo:3});
  assert.equal(song.chords[1].interpretation.rootSpelling,"D"); assert.equal(song.chords[1].previousInterpretation.rootSpelling,"D"); assert.equal(song.chords[1].reviewRequired,true); assert.equal(song.context.sourceChordId,null); assert.equal(song.context.tonicPc,2); assert.equal(song.chords[0].reviewRequired,false);
  song=apply(model,song,{type:"settings.apply",tuningMidi:[64,59,55,50,45,36],capo:4}); assert.equal(song.chords[1].previousInterpretation.rootSpelling,"D");
  song=apply(model,song,{type:"chord.update",chordId:"chord-shape",patch:{interpretation:interpretation("E"),reviewRequired:false,previousInterpretation:null}}); assert.equal(song.chords[1].reviewRequired,false); assert.equal(song.chords[1].previousInterpretation,null);
  song=apply(model,song,{type:"context.set",context:null}); assert.equal(song.context,null);
});

test("settings fail atomically with every affected chord listed at physical limit", () => {
  const {model}=setup(); let song=songFixture();
  song=apply(model,song,{type:"chord.update",chordId:"chord-shape",patch:{frets:[24,null,null,null,null,null]}});
  song=apply(model,song,{type:"chord.create",chord:{...named("C"),frets:[null,23,null,null,null,null]}});
  const before=clone(song), result=model.applyAction(song,{type:"settings.apply",tuningMidi:[64,59,55,50,45,38],capo:2});
  assert.strictEqual(result.song,song); assert.deepEqual(song,before); assert.equal(result.error.code,"PHYSICAL_FRET_LIMIT"); assert.deepEqual(result.error.details.chordIds,["chord-shape",song.chords[2].id]);
});

test("duplicate remaps every entity and source reference and exports canonical text", () => {
  const {model}=setup(); const original=songFixture(), before=clone(original); original.extra="ignored"; original.chords[0].extra="ignored";
  const song=model.duplicateSong(original), oldIds=new Set(allIds(original));
  assert.ok(allIds(song).every(id=>!oldIds.has(id))); assert.equal(new Set(allIds(song)).size,allIds(song).length);
  assert.equal(song.context.sourceChordId,song.chords[0].id); assert.equal(song.sections[0].occurrences[0].chordId,song.chords[0].id); assert.equal(song.arrangement[0].sectionId,song.sections[0].id); assert.equal(song.notes,original.notes); assert.equal(song.title,original.title);
  assert.equal(song.extra,undefined); assert.equal(song.chords[0].extra,undefined); delete original.extra; delete original.chords[0].extra; assert.deepEqual(original,before);
});

test("ASCII/Unicode/case and extreme enharmonic spelling normalize consistently", () => {
  const {model}=setup(); let song=model.createSong();
  for(const [rootPc,rootSpelling] of [[1,"c♯"],[11,"Cb"],[0,"B#"],[2,"C##"],[9,"Cbbb"]]) {
    song=apply(model,song,{type:"chord.create",chord:{...named("C"),interpretation:{rootPc,rootSpelling,formulaId:"",bassPc:null,bassSpelling:null}}});
  }
  assert.deepEqual(song.chords.map(c=>c.interpretation.rootSpelling),["C#","Cb","B#","C##","Cbbb"]);
});

test("failures retain the original undo snapshot and successful edits stamp time once", () => {
  const deps=dependencies(); let calls=0; const model=Model.create({...deps,now:()=>{calls++;return "2026-09-08T12:00:00.000Z";}}), song=songFixture();
  const failed=model.applyAction(song,{type:"song.update",patch:{title:null}}); assert.strictEqual(failed.song,song);
  const edited=apply(model,song,{type:"song.update",patch:{title:"Song A",notes:"line\nline"}}); assert.equal(edited.updatedAt,"2026-09-08T12:00:00.000Z"); assert.equal(song.title,""); assert.notStrictEqual(edited,song);
  assert.equal(model.applyAction(song,null).error.code,"INVALID_RECORD"); assert.equal(model.applyAction(song,{type:"unknown"}).error.code,"UNKNOWN_ACTION"); assert.ok(calls>=1);
});

test("browser fallback IDs stay unique under coarse clocks and unavailable crypto", () => {
  const source=fs.readFileSync(require.resolve("../../site/assets/js/song-notebook/model.js"),"utf8"), context={Date, Math:Object.assign(Object.create(Math),{random:()=>0.5})};
  vm.createContext(context); vm.runInContext(source,context);
  const model=context.SongNotebookModel.create({music:dependencies().music,now:()=>"2026-09-07T12:00:00.000Z"});
  const ids=[]; for(let i=0;i<1000;i++) ids.push(...allIds(model.createSong())); assert.equal(new Set(ids).size,ids.length);
});

test("all formula IDs stay distinct and slash spelling participates in typed reuse", () => {
  const {model,deps}=setup(); let song=model.createSong(); const sectionId=song.sections[0].id;
  song=apply(model,song,{type:"progression.insert",sectionId,text:deps.music.chords.map(c=>"C"+c.id).join(" "),afterOccurrenceId:null});
  assert.equal(song.chords.length,37); assert.equal(song.sections[0].occurrences.length,37);
  song=apply(model,song,{type:"progression.insert",sectionId,text:"C/C# C/Db C/C♯",afterOccurrenceId:null});
  const endings=song.sections[0].occurrences.slice(-3); assert.equal(endings[0].chordId,endings[2].chordId); assert.notEqual(endings[0].chordId,endings[1].chordId);
});

test("usage records enumerate stable occurrences and all matching arrangement entries", () => {
  const {model}=setup(); let song=songFixture();
  song=apply(model,song,{type:"section.duplicate",sectionId:"section-1"}); const sectionId=song.sections[1].id;
  song=apply(model,song,{type:"arrangement.create",sectionId});
  assert.deepEqual(model.getUsage(song,{chordId:"chord-c"}),{occurrences:[{sectionId:"section-1",occurrenceId:"occurrence-1"},{sectionId,occurrenceId:song.sections[1].occurrences[0].id}],arrangement:song.arrangement.map(a=>({arrangementId:a.id,sectionId:a.sectionId}))});
  assert.deepEqual(model.getUsage(song,{sectionId}),{occurrences:[{sectionId,occurrenceId:song.sections[1].occurrences[0].id}],arrangement:[{arrangementId:song.arrangement[1].id,sectionId}]});
  assert.deepEqual(model.getUsage(song,{chordId:"chord-shape"}),{occurrences:[],arrangement:[]});
});

test("invalid variation IDs and half-set origins reject the whole transaction", () => {
  const {model}=setup(),song=songFixture();
  for(const extra of [{chordId:42},{originSectionId:"",originOccurrenceId:"o"},{originSectionId:"section-1",originOccurrenceId:null}]) {
    const result=model.applyAction(song,{type:"chord.variation",chordId:null,originSectionId:null,originOccurrenceId:null,chord:named("C"),...extra}); assert.ok(result.error); assert.strictEqual(result.song,song);
  }
});

test("new sections receive the next numbered default without renaming prior sections", () => {
  const {model}=setup(); let song=model.createSong();
  song=apply(model,song,{type:"section.create"});
  song=apply(model,song,{type:"section.create",name:"Verse"});
  song=apply(model,song,{type:"section.create"});
  assert.deepEqual(song.sections.map(section=>section.name),["Section 1","Section 2","Verse","Section 3"]);
  song=apply(model,song,{type:"section.delete",sectionId:song.sections[1].id,referenceMode:"remove"});
  song=apply(model,song,{type:"section.create"});assert.equal(song.sections.at(-1).name,"Section 4");
});
