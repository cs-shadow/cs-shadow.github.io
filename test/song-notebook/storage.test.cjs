"use strict";
const test=require("node:test");
const assert=require("node:assert/strict");
const Model=require("../../site/assets/js/song-notebook/model.js");
const Storage=require("../../site/assets/js/song-notebook/storage.js");
const {dependencies,songFixture,blankDraftFixture,memoryStorage,contracts,clone,interpretation}=require("./fixtures.cjs");
function setup(initial={}) { const deps=dependencies(),model=Model.create(deps),backend=memoryStorage(initial); let writes=0,removals=0; const storage={getItem:key=>backend.getItem(key),setItem:(key,value)=>{writes++;backend.setItem(key,value);},removeItem:key=>{removals++;backend.removeItem(key);}}; return {model,music:deps.music,backend,store:Storage.create({storage,model,music:deps.music}),writes:()=>writes,removals:()=>removals}; }
const library=()=>({version:1,activeSongId:"song-1",songs:[songFixture()]});
const exported=song=>JSON.stringify({format:contracts.exportFormat,version:1,song});
function ids(song) { return [song.id,...song.chords.map(c=>c.id),...song.sections.flatMap(s=>[s.id,...s.occurrences.map(o=>o.id)]),...song.arrangement.map(a=>a.id)]; }

test("absent reads do not write, initialize, migrate, or touch other tool storage",()=>{
  const env=setup({"cs-shadow.song-study.library.v1":"keep this","cs-shadow.scalar-triads.recent-settings.v1":"keep also"});
  assert.deepEqual(env.store.loadLibrary(),{data:null,error:null,raw:null}); assert.deepEqual(env.store.loadDrafts(),{data:null,error:null,raw:null}); assert.deepEqual(env.store.readLegacySettings(),{data:[],error:null,raw:null}); assert.equal(env.writes(),0); assert.equal(env.removals(),0); assert.equal(env.backend.values.size,2);
});

test("library saves validated canonical copies and reloads complete committed content",()=>{
  const env=setup(),value=library(),before=clone(value); value.extra="ignore"; value.songs[0].extra={circular:null}; value.songs[0].extra.circular=value;
  value.songs[0].chords[0].interpretation.extra="ignore"; value.songs[0].sections[0].occurrences[0].duration.extra="ignore";
  assert.deepEqual(env.store.saveLibrary(value),{data:true,error:null}); assert.equal(env.writes(),1);
  const loaded=env.store.loadLibrary(); assert.equal(loaded.error,null); assert.deepEqual(loaded.data,before); assert.equal(typeof loaded.raw,"string"); assert.equal(env.writes(),1);
  loaded.data.songs[0].notes="local"; assert.equal(env.store.loadLibrary().data.songs[0].notes,before.songs[0].notes);
  assert.equal(value.songs[0].extra.circular,value,"input not changed");
});

test("corrupt library/draft JSON preserves exact raw bytes and requires no reset write",()=>{
  for(const [key,read] of [[contracts.libraryKey,"loadLibrary"],[contracts.draftsKey,"loadDrafts"]]) {
    for(const raw of ["", "{broken json\n", "null", "[]", JSON.stringify({version:9,songs:[],drafts:[]})]) {
      const env=setup({[key]:raw}), result=env.store[read](); assert.equal(result.data,null); assert.ok(result.error); assert.equal(result.raw,raw); assert.equal(env.backend.getItem(key),raw); assert.equal(env.writes(),0); assert.equal(env.removals(),0);
    }
  }
});

test("malformed library fields or references block saves without replacing valid data",()=>{
  const env=setup(); env.store.saveLibrary(library()); const raw=env.backend.getItem(contracts.libraryKey),writes=env.writes();
  const mutations=[v=>{v.version=2;},v=>{v.activeSongId="gone";},v=>{v.songs=[];},v=>{v.songs.push(clone(v.songs[0]));},v=>{v.songs.push(null);},v=>{v.songs.length=2;},v=>{v.songs[0].sections[0].occurrences[0].chordId="gone";},v=>{v.songs[0].context.sourceChordId="gone";},v=>{v.songs[0].chords[0].interpretation.bassPc=0;},v=>{v.songs[0].chords[1].frets[0]=25;},v=>{v.songs[0].sections[0].occurrences[0].duration.value=Infinity;}];
  for(const mutate of mutations) { const value=library(); mutate(value); const result=env.store.saveLibrary(value); assert.equal(result.data,null,mutate.toString()); assert.ok(result.error); assert.equal(env.writes(),writes); assert.equal(env.backend.getItem(contracts.libraryKey),raw); }
});

test("unavailable storage and thrown reads/saves return errors while JSON remains usable",()=>{
  const deps=dependencies(),model=Model.create(deps);
  for(const storage of [null,{getItem(){throw Error("blocked");},setItem(){throw Error("quota");},removeItem(){throw Error("blocked");}}]) {
    const store=Storage.create({storage,model,music:deps.music});
    for(const result of [store.loadLibrary(),store.loadDrafts(),store.readLegacySettings(),store.saveLibrary(library()),store.saveDrafts({version:1,drafts:[]})]) { assert.equal(result.data,null); assert.ok(result.error); assert.ok(result.error.message); }
    const output=store.exportSong(songFixture()); assert.equal(output.error,null); assert.equal(store.importSong(output.data).error,null);
  }
  const env=setup(); env.store.saveLibrary(library()); const raw=env.backend.getItem(contracts.libraryKey);
  const store=Storage.create({storage:{getItem:key=>env.backend.getItem(key),setItem(){throw new DOMException("Full","QuotaExceededError");},removeItem(){}},model:env.model,music:env.music});
  const edited=library(); edited.songs[0].title="Still editable in memory"; assert.equal(store.saveLibrary(edited).error.code,"SAVE_FAILED"); assert.equal(env.backend.getItem(contracts.libraryKey),raw); assert.equal(edited.songs[0].title,"Still editable in memory");
});

test("reads observe cross-tab replacements without cached or automatic overwrites",()=>{
  const env=setup(); env.store.saveLibrary(library()); const local=env.store.loadLibrary().data, incoming=library(); incoming.songs[0].title="Other tab edit";
  env.backend.setItem(contracts.libraryKey,JSON.stringify(incoming));
  assert.equal(env.store.loadLibrary().data.songs[0].title,"Other tab edit"); assert.equal(local.songs[0].title,""); assert.equal(env.writes(),1,"controller can suspend writes and retain its in-memory snapshot");
});

test("incomplete and stale drafts round trip separately with original source and origins",()=>{
  const env=setup(),blank=blankDraftFixture();
  const shared={...blankDraftFixture(),chordId:"deleted-chord",sourceFingerprint:"old-version",originSectionId:"deleted-section",originOccurrenceId:"deleted-occurrence",capo:2,tuningMidi:[64,59,55,50,45,38]};
  const otherSong={...blankDraftFixture(),songId:"song-2",candidate:{...blank.candidate,frets:null}};
  const envelope={version:1,drafts:[blank,shared,otherSong]},before=clone(envelope);
  assert.deepEqual(env.store.saveDrafts(envelope),{data:true,error:null}); assert.deepEqual(envelope,before); assert.deepEqual(env.store.loadDrafts().data,envelope);
  assert.equal(env.backend.getItem(contracts.libraryKey),null); assert.equal(env.store.exportSong(songFixture()).data.includes("old-version"),false);
  const loaded=env.store.loadDrafts().data; loaded.drafts[1].tuningMidi[0]=0; assert.equal(env.store.loadDrafts().data.drafts[1].tuningMidi[0],64);
});

test("draft validation permits empty experiments but rejects invalid candidate fields",()=>{
  const env=setup(); const mutations=[
    d=>{d.songId="";},d=>{d.chordId=undefined;},d=>{d.sourceFingerprint="unexpected";},d=>{d.chordId="existing";},d=>{d.originSectionId="section";},d=>{d.originOccurrenceId="occurrence";},
    d=>{d.candidate.nickname=null;},d=>{d.candidate.notes=1;},d=>{d.candidate.reviewRequired=undefined;},d=>{d.candidate.previousInterpretation=undefined;},d=>{d.candidate.frets=undefined;},d=>{d.candidate.frets=new Array(6);},
    d=>{d.candidate.frets=[0];},d=>{d.candidate.frets[0]=1.5;},d=>{d.candidate.frets[0]=-1;},d=>{d.candidate.frets[0]=25;},d=>{d.candidate.frets[0]=24;d.capo=1;},
    d=>{d.candidate.interpretation={...interpretation("C"),rootSpelling:"D"};},d=>{d.candidate.previousInterpretation={...interpretation("C"),formulaId:"unknown"};},d=>{d.tuningMidi=[64];},d=>{d.tuningMidi[0]=128;},d=>{d.capo=13;}
  ];
  for(const mutate of mutations) { const draft=blankDraftFixture(); mutate(draft); const result=env.store.saveDrafts({version:1,drafts:[draft]}); assert.equal(result.data,null,mutate.toString()); assert.ok(result.error); assert.equal(env.writes(),0); }
  const same=blankDraftFixture(); assert.equal(env.store.saveDrafts({version:1,drafts:[same,clone(same)]}).error.code,"DUPLICATE_DRAFT");
  assert.equal(env.store.saveDrafts({version:1,drafts:new Array(1)}).error.code,"INVALID_ARRAY");
  const named=blankDraftFixture(); named.candidate.interpretation=interpretation("C"); named.candidate.extra="removed";
  assert.equal(env.store.saveDrafts({version:1,drafts:[named]}).error,null); const loaded=env.store.loadDrafts().data.drafts[0]; assert.deepEqual(loaded.candidate.frets,Array(6).fill(null)); assert.equal(loaded.candidate.extra,undefined);
});

test("JSON export/import preserves all song content with fresh IDs and home remapping",()=>{
  const env=setup(),song=songFixture(),before=clone(song),result=env.store.exportSong(song);
  assert.equal(result.error,null); assert.ok(result.data.includes("\n  \"format\""));
  assert.deepEqual(JSON.parse(result.data),{format:contracts.exportFormat,version:1,song});
  const imported=env.store.importSong(result.data); assert.equal(imported.error,null); const copy=imported.data;
  const originalIds=new Set(ids(song)); assert.ok(ids(copy).every(id=>!originalIds.has(id))); assert.equal(copy.context.sourceChordId,copy.chords[0].id); assert.equal(copy.sections[0].occurrences[0].chordId,copy.chords[0].id); assert.equal(copy.arrangement[0].sectionId,copy.sections[0].id);
  assert.equal(copy.chords[1].nickname,"Warm shape"); assert.equal(copy.chords[1].interpretation,null); assert.equal(copy.chords[0].frets,null); assert.equal(copy.notes,song.notes); assert.deepEqual(copy.sections[0].occurrences[0].duration,{value:0.5,unit:"bars"}); assert.equal(copy.sections[0].occurrences[0].annotation,"Let ring"); assert.equal(copy.arrangement[0].repeatCount,2);
  assert.deepEqual(song,before); assert.equal(env.writes(),0); assert.equal(env.backend.values.size,0);
});

test("import rejects an entire invalid envelope before allocating IDs or writing storage",()=>{
  const deps=dependencies(); let allocations=0,clock=0; const model=Model.create({...deps,id:()=>{allocations++;return `fresh-${allocations}`;},now:()=>{clock++;return "2026-09-07T12:00:00.000Z";}}),backend=memoryStorage({[contracts.libraryKey]:"original"});
  const store=Storage.create({storage:backend,model,music:deps.music});
  const invalid=["", "{", "null", "[]", "1", JSON.stringify({format:contracts.exportFormat,version:9,song:songFixture()}), JSON.stringify({format:"cs-shadow.song-study.song",version:1,song:songFixture()})];
  for(const change of [s=>{s.sections[0].occurrences[0].chordId="absent";},s=>{s.context.sourceChordId="missing";},s=>{s.chords[0].id=s.id;},s=>{s.chords[1].frets[0]=25;},s=>{s.sections=[];},s=>{s.chords[0].notes=null;}]) { const song=songFixture(); change(song); invalid.push(exported(song)); }
  for(const value of invalid) { const result=store.importSong(value); assert.equal(result.data,null); assert.ok(result.error,value); assert.equal(allocations,0); assert.equal(clock,0); assert.equal(backend.getItem(contracts.libraryKey),"original"); }
});

test("canonical persistence strips unknown fields and normalizes spelling without interpreting names",()=>{
  const env=setup(),song=songFixture(); song.context=null; song.chords[0].interpretation={rootPc:1,rootSpelling:"c♯",formulaId:"",bassPc:8,bassSpelling:"a♭",unknown:"ignore"}; song.chords[0].frets=Array(6).fill(null); song.chords[0].nickname="<script>plain text</script>";
  const result=env.store.exportSong(song); assert.equal(result.error,null); const clean=JSON.parse(result.data).song;
  assert.equal(clean.chords[0].interpretation.rootSpelling,"C#"); assert.equal(clean.chords[0].interpretation.bassSpelling,"Ab"); assert.equal(clean.chords[0].interpretation.unknown,undefined); assert.equal(clean.chords[0].frets,null); assert.equal(clean.chords[0].nickname,song.chords[0].nickname); assert.equal(song.chords[0].interpretation.rootSpelling,"c♯");
});

test("legacy settings match existing serialization and disclose nearest-register assumptions",()=>{
  const payload={version:2,entries:[{tuning:[4,11,7,2,9,4],selection:[0,1,0,2,3,null]},{tuning:[10,5,1,8,3,10],selection:[15,null,0,null,2,null]}]},raw=JSON.stringify(payload),env=setup({[contracts.legacyKey]:raw});
  const result=env.store.readLegacySettings(); assert.equal(result.error,null); assert.equal(result.raw,raw); assert.deepEqual(result.data[0].tuningMidi,[64,59,55,50,45,40]); assert.deepEqual(result.data[0].frets,[0,1,0,2,3,null]);
  assert.deepEqual(result.data[1].tuningMidi,[58,53,49,44,39,34],"tritone ties choose lower pitch");
  assert.match(result.data[0].octaveAssumption,/nearest standard tuning/); assert.match(result.data[0].octaveAssumption,/lower octave/); assert.match(result.data[0].label,/x 3 2 0 1 0/); assert.equal(env.writes(),0); assert.equal(env.removals(),0); assert.equal(env.backend.getItem(contracts.legacyKey),raw);
});

test("malformed legacy data yields a useful error without clearing or partially migrating",()=>{
  for(const raw of ["{",JSON.stringify({version:7,entries:[]}),JSON.stringify({version:2,entries:[{tuning:[4,11,7,2,9,4],selection:[0,1,0,2,3,null]},{tuning:[64,59,55,50,45,40],selection:[0,0,0,0,0,0]}]}),JSON.stringify({version:2,entries:[{tuning:[4,11,7,2,9,4],selection:[16,0,0,0,0,0]}]})]) {
    const env=setup({[contracts.legacyKey]:raw}),result=env.store.readLegacySettings(); assert.equal(result.data,null); assert.ok(result.error.message); assert.equal(result.raw,raw); assert.equal(env.writes(),0); assert.equal(env.backend.getItem(contracts.legacyKey),raw);
  }
});

test("all-muted legacy experiments are valid history but excluded from recoverable chords",()=>{
  const empty={tuning:[4,11,7,2,9,4],selection:Array(6).fill(null)},sounding={tuning:[4,11,7,2,9,4],selection:[0,null,null,null,null,null]};
  for(const entries of [[empty],[empty,sounding]]) {
    const raw=JSON.stringify({version:2,entries}),env=setup({[contracts.legacyKey]:raw}),result=env.store.readLegacySettings();
    assert.equal(result.error,null); assert.equal(result.data.length,entries.length-1); assert.equal(result.raw,raw); assert.equal(env.backend.getItem(contracts.legacyKey),raw); assert.equal(env.writes(),0);
    if(result.data.length) assert.deepEqual(result.data[0].frets,sounding.selection);
  }
});
