"use strict";
const test=require("node:test"),assert=require("node:assert/strict"),fs=require("node:fs"),vm=require("node:vm");
const Reading=require("../../site/assets/js/song-notebook/reading.js");
const Music=require("../../site/assets/js/song-notebook/music.js");
const Model=require("../../site/assets/js/song-notebook/model.js");
const Storage=require("../../site/assets/js/song-notebook/storage.js");
const Controller=require("../../site/assets/js/guitar-chordinator.js");
const {documentFixture}=require("./dom-fixture.cjs");
const {memoryStorage}=require("./fixtures.cjs");
let serial=0;
function harness(){
 const document=documentFixture();document.createElementNS=(namespace,tag)=>{const node=document.createElement(tag);node.namespaceURI=namespace;return node;};
 const root=document.createElement("div"),sibling=document.createElement("div");sibling.textContent="Outside reading ownership";document.body.append(root,sibling);
 const model=Model.create({music:Music,id:()=>`reading-${++serial}`,now:()=>"2026-09-08T22:00:00.000Z"}),storage=Storage.create({storage:memoryStorage(),model,music:Music}),effects=[];
 const store=Controller.createStore({model,storage,music:Music,schedule:()=>1,cancel(){},onEffect:effect=>effects.push(effect)}),actions=[];
 const component=Reading.mount({root},{music:Music,dispatch(action){actions.push(action);return store.dispatch(action);}});const unsubscribe=store.subscribe(snapshot=>component.render(snapshot));store.initialize();component.render(store.snapshot());
 function dispatch(action){const result=store.dispatch(action);assert.equal(result.error,null,JSON.stringify(result.error));return store.snapshot();}
 function progression(text){return dispatch({type:"progression.insert",sectionId:store.snapshot().activeSectionId,text,afterOccurrenceId:null});}
 function read(){dispatch({type:"mode.set",mode:"read"});return root;}
 function keep(frets,symbol=null,extra={}){const state=dispatch({type:"chord.create",chord:{frets,interpretation:symbol?Music.parseChordSymbol(symbol).interpretation:null,nickname:"",notes:"",...extra}});return state.song.chords.at(-1);}
 function close(){unsubscribe();component.destroy();store.destroy();}
 return {root,sibling,document,model,store,storage,effects,actions,component,dispatch,progression,read,keep,close};
}
function descendants(node,className){return node.querySelectorAll("."+className);}
function deepFreeze(value){if(value&&typeof value==="object"){Object.values(value).forEach(deepFreeze);Object.freeze(value);}return value;}

test("empty read view is meaningful without context, timing, arrangement or chords",()=>{
 const e=harness();assert.equal(e.root.hidden,true);e.read();assert.equal(e.root.hidden,false);assert.equal(e.root.querySelector("h1").textContent,"Untitled song");assert.match(e.root.textContent,/Standard tuning · No capo/);assert.match(e.root.textContent,/Tuning, strings 1–6: E4 · B3 · G3 · D3 · A2 · E2/);
 assert.equal(descendants(e.root,"notebook-reading-section").length,1);assert.match(e.root.textContent,/No chords in this section yet/);assert.match(e.root.textContent,/No chords saved yet/);assert.equal(descendants(e.root,"notebook-reading-order").length,0);assert.equal(descendants(e.root,"notebook-reading-context").length,0);assert.equal(e.actions.length,0);e.close();
});

test("song order preserves repeated references while each section is defined exactly once",()=>{
 const e=harness();let state=e.progression("Am F C G"),verse=state.activeSectionId;e.dispatch({type:"section.update",sectionId:verse,patch:{name:"Verse",notes:"Verse note\nSecond line"}});
 state=e.dispatch({type:"section.duplicate",sectionId:verse});const chorus=state.activeSectionId;e.dispatch({type:"section.update",sectionId:chorus,patch:{name:"Chorus",notes:"Chorus definition only"}});
 e.dispatch({type:"arrangement.create",sectionId:chorus});e.dispatch({type:"arrangement.create",sectionId:verse});state=e.dispatch({type:"arrangement.create",sectionId:chorus});e.dispatch({type:"arrangement.update",arrangementId:state.song.arrangement[2].id,patch:{repeatCount:3}});e.read();
 const definitions=descendants(e.root,"notebook-reading-section");assert.deepEqual(definitions.map(n=>n.dataset.sectionId),[verse,chorus]);assert.equal(definitions.length,2);assert.equal(e.root.textContent.split("Chorus definition only").length-1,1);
 const order=descendants(e.root,"notebook-reading-order-list")[0].children;assert.deepEqual(order.map(n=>n.textContent),["Chorus × 1","Verse × 1","Chorus × 3"]);assert.equal(descendants(e.root,"notebook-reading-occurrence").length,8);
 const ids=new Set(e.root.querySelectorAll("[id]").map(n=>n.id));
 // The DOM fixture tracks .id separately; collect every actual target directly.
 definitions.concat(descendants(e.root,"notebook-reading-chord")).forEach(n=>ids.add(n.id));
 e.root.querySelectorAll("a").forEach(link=>assert.ok(ids.has(link.getAttribute("href").slice(1)),link.getAttribute("href")));e.close();
});

test("durations, multiline annotations and notes retain exact committed text",()=>{
 const e=harness();let state=e.progression("C G");e.dispatch({type:"song.update",patch:{title:"Song <title>",notes:"Song first\nSong second"}});e.dispatch({type:"section.update",sectionId:state.activeSectionId,patch:{name:"Section <name>",notes:"Section first\nSection second"}});
 e.dispatch({type:"occurrence.update",sectionId:state.activeSectionId,occurrenceId:state.song.sections[0].occurrences[0].id,patch:{duration:{value:.5,unit:"bars"},annotation:"Hold\nthen release"}});
 e.dispatch({type:"occurrence.update",sectionId:state.activeSectionId,occurrenceId:state.song.sections[0].occurrences[1].id,patch:{duration:{value:1,unit:"beats"},annotation:"<img src=x onerror=alert(1)>"}});e.read();
 assert.equal(e.root.querySelector("h1").textContent,"Song <title>");assert.deepEqual(descendants(e.root,"notebook-reading-duration").map(n=>n.textContent),["0.5 bars","1 beat"]);assert.deepEqual(descendants(e.root,"notebook-reading-annotation").map(n=>n.textContent),["Hold\nthen release","<img src=x onerror=alert(1)>"]);
 assert.equal(descendants(e.root,"notebook-reading-song-notes")[0].textContent,"Song first\nSong second");assert.equal(descendants(e.root,"notebook-reading-section-notes")[0].textContent,"Section first\nSection second");assert.equal(e.root.querySelectorAll("img").length,0);e.close();
});

test("dictionary includes unused, unnamed, name-only and review-required material",()=>{
 const e=harness();const named=e.keep(null,"Dbmaj7/Ab",{nickname:"Cloud",notes:"Name only note"}),unnamed=e.keep([0,null,null,null,null,null],null,{nickname:"An experiment",notes:"Unused shape note"});
 const reviewed=e.keep([0,1,0,2,3,null],"C",{reviewRequired:true,previousInterpretation:Music.parseChordSymbol("C").interpretation,notes:"Retuned and pending review"});
 const sectionId=e.store.snapshot().activeSectionId;e.dispatch({type:"occurrence.create",sectionId,chordId:named.id});e.dispatch({type:"occurrence.create",sectionId,chordId:reviewed.id});e.dispatch({type:"context.set",context:{tonicPc:1,tonicSpelling:"Db",sourceChordId:named.id,scaleId:"major"}});e.read();
 const entries=descendants(e.root,"notebook-reading-chord");assert.deepEqual(entries.map(n=>n.dataset.chordId),[named.id,unnamed.id,reviewed.id]);assert.match(entries[0].textContent,/Dbmaj7\/Ab/);assert.match(entries[0].textContent,/Fingering not set/);assert.match(entries[1].textContent,/Chord 2/);assert.match(entries[1].textContent,/Unnamed shape/);assert.match(entries[1].textContent,/Unused in sections/);assert.match(entries[2].textContent,/Name needs review · previous name: C/);
 assert.equal(descendants(entries[2],"notebook-reading-roman").length,0);assert.ok(descendants(entries[0],"notebook-reading-roman").length);assert.equal(descendants(e.root,"notebook-reading-diagram").length,2);assert.match(e.root.textContent,/Home: Db · Major/);assert.match(e.root.textContent,/Home source: Dbmaj7\/Ab/);e.close();
});

test("compact diagrams preserve conventional string order, mutes, opens and capo-relative frets",()=>{
 const e=harness();e.dispatch({type:"settings.apply",tuningMidi:Music.defaultTuning.slice(),capo:2});e.keep([0,1,0,2,3,null],"D");e.read();const svg=e.root.querySelector("svg");
 assert.equal(svg.namespaceURI,"http://www.w3.org/2000/svg");assert.equal(svg.getAttribute("role"),"img");assert.match(svg.getAttribute("aria-label"),/String 1 open at capo 2/);assert.match(svg.getAttribute("aria-label"),/String 6 muted/);assert.match(svg.getAttribute("aria-label"),/relative fret 3, physical fret 5/);
 const dots=svg.querySelectorAll("circle");assert.deepEqual(dots.map(n=>[n.getAttribute("data-string-index"),n.getAttribute("data-relative-fret"),n.getAttribute("data-physical-fret")]),[["1","1","3"],["3","2","4"],["4","3","5"]]);assert.ok(Number(dots[0].getAttribute("cx"))>Number(dots[2].getAttribute("cx")),"higher string is on the right");
 assert.equal(descendants(e.root,"notebook-reading-fret-values")[0].textContent,"6 → 1: × · 3 · 2 · 0 · 1 · 0");assert.match(e.root.textContent,/C shape · sounds D · capo 2/);e.close();
});

test("extreme and discontinuous fret shapes retain every sounding string without oversized diagrams",()=>{
 const e=harness();e.keep([24,1,null,12,0,7]);e.keep([0,0,0,0,0,0]);e.keep([24,null,null,null,null,null]);e.read();
 const entries=descendants(e.root,"notebook-reading-chord"),wide=entries[0].querySelector("svg");assert.match(entries[0].textContent,/Gaps between labeled frets are compressed/);assert.deepEqual(wide.querySelectorAll("circle").map(n=>Number(n.getAttribute("data-relative-fret"))),[1,7,12,24]);
 assert.ok(Number(wide.getAttribute("height"))<260);assert.equal(wide.querySelectorAll("circle").length,4);assert.equal(entries[1].querySelector("svg").querySelectorAll("circle").length,0);assert.equal(entries[2].querySelector("svg").querySelectorAll("circle")[0].getAttribute("data-relative-fret"),"24");e.close();
});

test("custom register and scale-less context are printed without inferred harmony",()=>{
 const e=harness();e.dispatch({type:"settings.apply",tuningMidi:[40,59,55,50,45,64],capo:1});e.dispatch({type:"context.set",context:{tonicPc:9,tonicSpelling:"A",sourceChordId:null,scaleId:null}});e.keep([0,null,null,null,null,null]);e.read();assert.match(e.root.textContent,/Custom tuning · Capo 1/);assert.match(e.root.textContent,/strings 1–6: E2 · B3 · G3 · D3 · A2 · E4/);assert.equal(descendants(e.root,"notebook-reading-context")[0].textContent,"Home: A");assert.equal(descendants(e.root,"notebook-reading-roman").length,0);assert.equal(descendants(e.root,"notebook-reading-sounding").length,0);e.close();
});

test("read and print snapshots exclude every pending draft and retain edit selection",()=>{
 const e=harness();let state=e.progression("C G"),chordId=state.song.chords[0].id,sectionId=state.activeSectionId,occurrenceId=state.song.sections[0].occurrences[1].id;e.dispatch({type:"selection.set",sectionId,occurrenceId});e.dispatch({type:"draft.open",chordId});e.dispatch({type:"draft.patch",chordId,patch:{nickname:"UNAPPLIED-SECRET",notes:"Draft only text"}});e.read();assert.equal(e.root.textContent.includes("UNAPPLIED-SECRET"),false);assert.equal(e.root.textContent.includes("Draft only text"),false);
 e.dispatch({type:"file.print"});assert.equal(e.effects.length,1);assert.equal(JSON.stringify(e.effects[0].song).includes("UNAPPLIED-SECRET"),false);assert.equal(e.actions.length,0,"reading does not call Print itself");
 e.dispatch({type:"mode.set",mode:"edit"});state=e.store.snapshot();assert.equal(e.root.hidden,true);assert.equal(state.activeSectionId,sectionId);assert.equal(state.selectedOccurrenceId,occurrenceId);assert.equal(state.drafts[0].candidate.nickname,"UNAPPLIED-SECRET");e.close();
});

test("reading is immutable and stable across selection, draft and save-status-only updates",()=>{
 const e=harness();e.progression("Am F C G");e.read();const state=deepFreeze(e.store.snapshot()),before=JSON.stringify(state),heading=e.root.querySelector("h1"),link=e.root.querySelector("a");link.focus();e.component.render(state);assert.strictEqual(e.root.querySelector("h1"),heading);assert.equal(JSON.stringify(state),before);assert.strictEqual(e.document.activeElement,link);
 e.component.render({...state,saveStatus:"saving",drafts:[],selectedOccurrenceId:null});assert.strictEqual(e.root.querySelector("h1"),heading);assert.equal(e.actions.length,0);assert.equal(e.sibling.textContent,"Outside reading ownership");e.close();
});

test("long song, section, chord and occurrence text is complete and uses splittable print blocks",()=>{
 const e=harness(),long="A long line with spaces\n".repeat(400)+"unbroken".repeat(500);let state=e.progression("C");e.dispatch({type:"song.update",patch:{title:"Title ".repeat(80),notes:long}});e.dispatch({type:"section.update",sectionId:state.activeSectionId,patch:{notes:long}});e.dispatch({type:"chord.update",chordId:state.song.chords[0].id,patch:{notes:long,nickname:"Long nickname ".repeat(100)}});e.dispatch({type:"occurrence.update",sectionId:state.activeSectionId,occurrenceId:state.song.sections[0].occurrences[0].id,patch:{annotation:long}});e.read();
 for(const className of ["notebook-reading-song-notes","notebook-reading-section-notes","notebook-reading-chord-notes","notebook-reading-annotation"])assert.equal(descendants(e.root,className)[0].textContent,long);
 const css=fs.readFileSync(require.resolve("../../site/assets/css/song-notebook/reading.css"),"utf8");assert.match(css,/white-space: pre-wrap/);assert.match(css,/overflow-wrap: anywhere/);assert.match(css,/@media print/);assert.match(css,/notebook-reading-notes \{ break-inside: auto; page-break-inside: auto; overflow: visible/);assert.match(css,/notebook-reading-diagram \{ width: 42mm; break-inside: avoid/);assert.doesNotMatch(css,/max-height|overflow:\s*(hidden|clip)|line-clamp/);e.close();
});

test("mobile structure has no editor controls or fixed page width; diagrams fit their own column",()=>{
 const e=harness();e.keep([0,1,0,2,3,null],"C");e.read();for(const tag of ["button","input","textarea","select","details"])assert.equal(e.root.querySelectorAll(tag).length,0);
 const css=fs.readFileSync(require.resolve("../../site/assets/css/song-notebook/reading.css"),"utf8");assert.match(css,/max-width: 799px/);assert.match(css,/grid-template-columns: minmax\(0, 1fr\)/);assert.match(css,/notebook-reading-diagram \{ width: 12.125rem; max-width: 100%/);assert.match(css,/var\(--music-border\)/);assert.match(css,/var\(--music-surface\)/);e.close();
});

test("destroy is confined to the reading host and browser export needs no window effects",()=>{
 const e=harness();e.read();const snapshot=e.store.snapshot();e.component.destroy();e.component.render(snapshot);assert.equal(e.root.textContent,"");assert.equal(e.root.hidden,true);assert.equal(e.sibling.textContent,"Outside reading ownership");assert.equal(e.effects.length,0);
 const context={};vm.createContext(context);vm.runInContext(fs.readFileSync(require.resolve("../../site/assets/js/song-notebook/reading.js"),"utf8"),context);assert.equal(typeof context.SongNotebookReading.mount,"function");e.close();
});
