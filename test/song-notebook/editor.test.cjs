"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Editor=require("../../site/assets/js/song-notebook/editor.js");
const Music=require("../../site/assets/js/song-notebook/music.js");
const Model=require("../../site/assets/js/song-notebook/model.js");
const Storage=require("../../site/assets/js/song-notebook/storage.js");
const Controller=require("../../site/assets/js/guitar-chordinator.js");
const {memoryStorage}=require("./fixtures.cjs");
// Small DOM surface for component behavior. Native keyboard activation and layout
// still need browser verification; state changes below use the real controller.
class Node {
  constructor(tag,doc){this.tagName=tag.toUpperCase();this.ownerDocument=doc;this.children=[];this.dataset={};this.attrs={};this.listeners={};this.className="";this.hidden=false;this.disabled=false;this.value="";this._text="";this.scrollLeft=0;this.classList={add:(name)=>{this.className=[...new Set(this.className.split(/\s+/).filter(Boolean).concat(name))].join(" ");},remove:(name)=>{this.className=this.className.split(/\s+/).filter(x=>x!==name).join(" ");},contains:(name)=>this.className.split(/\s+/).includes(name)};}
  appendChild(node){node.parentNode=this;this.children.push(node);return node;}
  set textContent(value){this._text=String(value);this.children.forEach(child=>{child.parentNode=null;});this.children=[];}
  get textContent(){return this._text+this.children.map(child=>child.textContent).join("");}
  setAttribute(key,value){this.attrs[key]=String(value);}
  getAttribute(key){return this.attrs[key]??null;}
  addEventListener(type,callback){(this.listeners[type]??=[]).push(callback);}
  emit(type,extra={}){const event={target:this,defaultPrevented:false,preventDefault(){this.defaultPrevented=true;},...extra};for(const listener of this.listeners[type]||[])listener(event);return event;}
  click(){if(!this.disabled)this.emit("click");}
  focus(){this.ownerDocument.activeElement=this;}
  contains(node){return node===this||this.children.some(child=>child.contains(node));}
  matches(selector){if(selector.startsWith("."))return this.classList.contains(selector.slice(1));const attr=/^\[data-editor-(key|summary)(?:="([^"]*)")?\]$/.exec(selector);if(attr)return attr[2]===undefined?this.dataset["editor"+attr[1][0].toUpperCase()+attr[1].slice(1)]!==undefined:this.dataset["editor"+attr[1][0].toUpperCase()+attr[1].slice(1)]===attr[2];return this.tagName===selector.toUpperCase();}
  querySelectorAll(selector){return this.children.flatMap(child=>[...(child.matches(selector)?[child]:[]),...child.querySelectorAll(selector)]);}
  querySelector(selector){return this.querySelectorAll(selector)[0]||null;}
}
function documentFixture(){const doc={activeElement:null,createElement:tag=>new Node(tag,doc)};return doc;}
let serial=0;
function harness(options={}){
  const model=options.model||Model.create({music:Music,id:()=>`editor-${++serial}`,now:()=>"2026-09-08T12:00:00.000Z"}),memory=options.memory||memoryStorage(),storage=Storage.create({storage:memory,model,music:Music});
  const store=Controller.createStore({model,music:Music,storage,schedule:()=>1,cancel:()=>{}}),doc=documentFixture(),root=doc.createElement("section"),sibling=doc.createElement("aside"),actions=[];
  sibling.textContent="Outside ownership";
  const editor=Editor.mount({root},{music:Music,dispatch(action){actions.push(action);return store.dispatch(action);}});
  const unsubscribe=store.subscribe(snapshot=>editor.render(snapshot));store.initialize();editor.render(store.snapshot());
  function dispatch(action){const result=store.dispatch(action);assert.equal(result.error,null,JSON.stringify(result.error));return store.snapshot();}
  function node(key){const result=root.querySelector(`[data-editor-key="${key}"]`);assert.ok(result,`Missing control ${key}`);return result;}
  function click(key){node(key).click();}
  function change(key,value){const input=node(key);input.value=value;input.emit("change");}
  function symbol(value){click("mode-name");node("symbol").value=value;node("symbol").parentNode.parentNode.emit("submit");}
  function close(){unsubscribe();editor.destroy();store.destroy();}
  return {model,memory,storage,store,doc,root,sibling,editor,actions,dispatch,node,click,change,symbol,close};
}
function progression(env,text="C C C"){let state=env.store.snapshot();return env.dispatch({type:"progression.insert",sectionId:state.activeSectionId,text,afterOccurrenceId:null});}
function openShared(env,text="C C C"){const state=progression(env,text),chordId=state.song.chords[0].id,sectionId=state.activeSectionId,occurrenceId=state.song.sections[0].occurrences[0].id;env.dispatch({type:"chord.inspect",chordId,sectionId,occurrenceId});return {chordId,sectionId,occurrenceId};}

test("blank capture keeps an unnamed shape and adds exactly one occurrence",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});assert.equal(e.node("keep").disabled,true);assert.equal(e.root.querySelectorAll(".notebook-editor-note").length,156);
 e.node("fret-0-0").focus();e.click("fret-0-0");assert.equal(e.store.snapshot().song.chords.length,0);assert.equal(e.store.snapshot().drafts[0].candidate.frets[0],0);assert.equal(e.doc.activeElement.dataset.editorKey,"fret-0-0");
 e.click("keep-add");let state=e.store.snapshot();assert.equal(state.song.chords.length,1);assert.equal(state.song.chords[0].interpretation,null);assert.equal(state.song.sections[0].occurrences.length,1);assert.equal(state.drafts.length,0);assert.match(e.root.textContent,/Edit chord/);assert.equal(e.sibling.textContent,"Outside ownership");e.close();
});

test("name entry preserves spelling/slash identity, rejects invalid symbols and needs no fingering",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.symbol("Dbmaj7/Ab");assert.equal(e.store.snapshot().drafts[0].candidate.interpretation.bassSpelling,"Ab");
 const before=JSON.stringify(e.store.snapshot().drafts);e.node("symbol").value="not-a-chord";e.node("symbol").parentNode.parentNode.emit("submit");assert.equal(JSON.stringify(e.store.snapshot().drafts),before);assert.ok(e.root.querySelector(".notebook-editor-error").textContent);
 e.click("keep");assert.equal(e.store.snapshot().song.chords[0].frets,null);assert.equal(Music.formatInterpretation(e.store.snapshot().song.chords[0].interpretation),"Dbmaj7/Ab");assert.match(e.root.textContent,/Fingering not set/);e.close();
});

test("root, quality and optional bass selectors create a structured sounding identity",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.click("mode-name");e.change("root","A");e.change("quality","m7");e.change("bass","E");assert.equal(Music.formatInterpretation(e.store.snapshot().drafts[0].candidate.interpretation),"Am7/E");e.close();
});

test("nickname and notes blur commits retain form nodes, caret and the pending Keep button",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.click("fret-0-0");const input=e.node("nickname"),keep=e.node("keep"),notes=e.node("notes");input.focus();input.selectionStart=3;input.selectionEnd=3;
 e.change("nickname","<b>soft</b>");assert.strictEqual(e.node("nickname"),input);assert.strictEqual(e.node("keep"),keep);assert.strictEqual(e.doc.activeElement,input);assert.equal(input.selectionStart,3);assert.match(e.root.querySelector(".notebook-editor-chord-name").textContent,/<b>soft<\/b>/);
 notes.focus();e.change("notes","Line one\nLine two");assert.strictEqual(e.node("notes"),notes);assert.equal(e.root.querySelector(".notebook-editor-personal-notes").textContent,"Line one\nLine two");
 e.store.flush();assert.strictEqual(e.node("keep"),keep);keep.click();assert.equal(e.store.snapshot().song.chords[0].nickname,"<b>soft</b>");assert.equal(e.store.snapshot().song.chords[0].notes,"Line one\nLine two");e.close();
});

test("fretboard arrow navigation and focus survive discrete patches without extra tab stops",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.node("fret-0--1").focus();assert.equal(e.node("fret-0--1").emit("keydown",{key:"ArrowRight"}).defaultPrevented,true);assert.equal(e.doc.activeElement.dataset.editorKey,"fret-0-0");
 e.doc.activeElement.emit("keydown",{key:"ArrowDown"});assert.equal(e.doc.activeElement.dataset.editorKey,"fret-1-0");e.doc.activeElement.click();assert.equal(e.doc.activeElement.dataset.editorKey,"fret-1-0");assert.equal(e.root.querySelectorAll(".notebook-editor-note").filter(n=>n.tabIndex===0).length,1);
 e.doc.activeElement.emit("keydown",{key:"End"});assert.equal(e.doc.activeElement.dataset.editorKey,"fret-1-24");e.doc.activeElement.emit("keydown",{key:"Home"});assert.equal(e.doc.activeElement.dataset.editorKey,"fret-1--1");assert.equal(e.node("fret-1--1").tagName,"BUTTON");assert.match(e.node("fret-1--1").getAttribute("aria-label"),/String 2, mute/);e.close();
});

test("shared edits stay preview-only, then update every use and preview the home change",()=>{
 const e=harness(),{chordId}=openShared(e);e.dispatch({type:"context.set",context:{tonicPc:0,tonicSpelling:"C",sourceChordId:chordId,scaleId:null}});e.symbol("D");
 assert.equal(Music.formatInterpretation(e.store.snapshot().song.chords[0].interpretation),"C");assert.match(e.root.textContent,/changes 3 occurrences/);assert.match(e.root.textContent,/home from C to D/);e.click("update");
 const state=e.store.snapshot();assert.equal(state.song.context.tonicPc,2);assert.equal(state.song.sections[0].occurrences.filter(o=>o.chordId===chordId).length,3);assert.equal(Music.formatInterpretation(state.song.chords[0].interpretation),"D");assert.equal(state.drafts.length,0);e.close();
});

test("reload and changed selection preserve the variation's original occurrence",()=>{
 const first=harness(),{chordId,sectionId,occurrenceId}=openShared(first);first.change("nickname","Original target draft");first.store.flush();const state=first.store.snapshot(),last=state.song.sections[0].occurrences[2].id;
 const e=harness({memory:first.memory,model:first.model});e.dispatch({type:"selection.set",sectionId,occurrenceId:last});e.dispatch({type:"chord.inspect",chordId,sectionId,occurrenceId:last});
 assert.equal(e.store.snapshot().drafts[0].originOccurrenceId,occurrenceId);assert.match(e.root.textContent,/Variation target: Section 1, chord 1/);assert.ok(e.node("retarget"));e.click("variation");
 const song=e.store.snapshot().song;assert.notEqual(song.sections[0].occurrences[0].chordId,chordId);assert.equal(song.sections[0].occurrences[2].chordId,chordId);assert.equal(song.chords[1].nickname,"Original target draft");first.close();e.close();
});

test("explicit retarget affects only the selected occurrence",()=>{
 const e=harness(),{chordId,sectionId}=openShared(e);const selected=e.store.snapshot().song.sections[0].occurrences[1].id;e.dispatch({type:"selection.set",sectionId,occurrenceId:selected});e.click("retarget");assert.equal(e.store.snapshot().drafts[0].originOccurrenceId,selected);e.click("variation");
 const song=e.store.snapshot().song;assert.equal(song.sections[0].occurrences[0].chordId,chordId);assert.notEqual(song.sections[0].occurrences[1].chordId,chordId);e.close();
});

test("deleted original section gives a collection-only variation and an explicit explanation",()=>{
 const e=harness(),{chordId,sectionId}=openShared(e);e.dispatch({type:"section.delete",sectionId,referenceMode:"remove"});assert.match(e.root.textContent,/original occurrence is no longer available/);assert.match(e.root.textContent,/nothing will be replaced/);e.click("variation");assert.equal(e.store.snapshot().song.chords.length,2);assert.equal(e.store.snapshot().song.sections[0].occurrences.length,0);assert.match(e.store.state().notice,/nothing was replaced/);e.close();
});

test("collection drafts never borrow the current selected occurrence without retargeting",()=>{
 const e=harness(),state=progression(e,"C C"),chordId=state.song.chords[0].id;e.dispatch({type:"chord.inspect",chordId});e.dispatch({type:"selection.set",sectionId:state.activeSectionId,occurrenceId:state.song.sections[0].occurrences[1].id});assert.match(e.root.textContent,/variation will stay in the collection/i);e.click("variation");assert.ok(e.store.snapshot().song.sections[0].occurrences.every(o=>o.chordId===chordId));e.close();
});

test("source conflict disables shared overwrite but permits reopen or variation",()=>{
 const e=harness(),{chordId}=openShared(e);e.change("nickname","Draft");e.dispatch({type:"chord.update",chordId,patch:{notes:"Newer saved notes"}});assert.equal(e.node("update").disabled,true);assert.equal(e.node("variation").disabled,false);assert.match(e.root.textContent,/shared chord changed/);
 e.click("reopen-source");assert.equal(e.store.snapshot().drafts[0].candidate.notes,"Newer saved notes");assert.equal(e.store.snapshot().drafts[0].candidate.nickname,"");assert.equal(e.node("update").disabled,false);e.close();
});

test("stale settings block Keep until explicit review and preserve original tuning on reload",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.click("fret-0-0");e.dispatch({type:"settings.apply",tuningMidi:[62,59,55,50,45,40],capo:2});assert.equal(e.node("keep").disabled,true);assert.equal(e.store.snapshot().drafts[0].tuningMidi[0],64);assert.equal(e.store.snapshot().drafts[0].capo,0);assert.match(e.root.textContent,/Draft tuning: E4/);assert.match(e.root.textContent,/Current tuning: D4/);
 e.store.flush();const reloaded=harness({memory:e.memory,model:e.model});reloaded.dispatch({type:"draft.open",chordId:null});assert.equal(reloaded.node("keep").disabled,true);reloaded.click("review-settings");assert.equal(reloaded.store.snapshot().drafts[0].capo,2);assert.equal(reloaded.node("keep").disabled,false);reloaded.click("keep");assert.deepEqual(reloaded.store.snapshot().song.chords[0].frets,[0,null,null,null,null,null]);e.close();reloaded.close();
});

test("reviewing current settings is blocked when draft frets exceed physical fret 24",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.click("fret-0-24");e.dispatch({type:"settings.apply",tuningMidi:Music.defaultTuning.slice(),capo:2});assert.equal(e.node("review-settings").disabled,true);assert.match(e.root.textContent,/exceed physical fret 24/);e.click("fret-0-22");assert.equal(e.node("review-settings").disabled,false);e.click("review-settings");assert.equal(e.root.querySelector('[data-editor-key="fret-0-23"]'),null);assert.match(e.node("fret-0-22").getAttribute("aria-label"),/physical fret 24/);e.close();
});

test("draft resume shelf survives Explore, song switches and explicit cancel",()=>{
 const e=harness();const songId=e.store.snapshot().song.id;e.dispatch({type:"draft.open",chordId:null});e.click("fret-0-0");e.dispatch({type:"panel.set",panel:"explore"});assert.equal(e.root.hidden,false);assert.match(e.root.textContent,/Resume/);e.dispatch({type:"library.create"});assert.equal(e.root.hidden,true);e.dispatch({type:"library.switch",songId});e.click("resume-0");assert.equal(e.store.snapshot().drafts[0].candidate.frets[0],0);e.click("discard");assert.equal(e.store.snapshot().drafts.length,0);assert.equal(e.store.snapshot().song.chords.length,0);e.close();
});

test("actual MIDI bass, capo shape names and candidate evidence remain visible",()=>{
 const e=harness();e.dispatch({type:"settings.apply",tuningMidi:[40,59,55,50,45,64],capo:2});e.dispatch({type:"draft.open",chordId:null});e.dispatch({type:"draft.patch",chordId:null,patch:{frets:[0,1,0,2,3,null],interpretation:Music.parseChordSymbol("D").interpretation}});
 assert.match(e.root.textContent,/C shape · sounds D · capo 2/);assert.match(e.root.textContent,/Lowest sounding note: F#2/);assert.match(e.root.textContent,/Exact/);
 e.click("candidate-0");assert.equal(e.store.snapshot().drafts[0].candidate.reviewRequired,false);e.click("fret-0-1");assert.equal(e.store.snapshot().drafts[0].candidate.reviewRequired,true);assert.match(e.root.textContent,/Name needs review: previously/);e.click("unnamed");assert.equal(e.store.snapshot().drafts[0].candidate.interpretation,null);assert.equal(e.store.snapshot().drafts[0].candidate.reviewRequired,false);e.close();
});

test("rendering immutable snapshots is read-only and destroy releases its owned host",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});const snapshot=e.store.snapshot();function freeze(value){Object.values(value).forEach(v=>{if(v&&typeof v==="object")freeze(v);});Object.freeze(value);}freeze(snapshot);const before=JSON.stringify(snapshot),old=e.node("fret-0-0"),actions=e.actions.length;e.editor.render(snapshot);assert.equal(JSON.stringify(snapshot),before);assert.equal(e.actions.length,actions);e.editor.destroy();old.click();assert.equal(e.actions.length,actions);assert.equal(e.root.textContent,"");assert.equal(e.sibling.textContent,"Outside ownership");e.close();
});


test("close interpretations show their absolute missing or extra note evidence",()=>{
 const e=harness();e.dispatch({type:"draft.open",chordId:null});e.dispatch({type:"draft.patch",chordId:null,patch:{frets:[0,1,2,3,4,5]}});assert.match(e.root.textContent,/Close/);assert.match(e.root.textContent,/Extra: C#/);e.click("candidate-0");assert.equal(Music.formatInterpretation(e.store.snapshot().drafts[0].candidate.interpretation),"Fmaj7/A");e.close();
});

test("deleted shared source remains recoverable via its explicit resume action",()=>{
 const e=harness(),{chordId}=openShared(e);e.change("nickname","Saved experiment");e.dispatch({type:"chord.delete",chordId,referenceMode:"remove"});e.click("resume-0");assert.match(e.root.textContent,/original chord was deleted/);assert.equal(e.node("update").disabled,true);e.click("variation");assert.equal(e.store.snapshot().song.chords.length,1);assert.equal(e.store.snapshot().song.chords[0].nickname,"Saved experiment");e.close();
});
