"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Controller=require("../../site/assets/js/guitar-chordinator.js"),Music=require("../../site/assets/js/song-notebook/music.js"),Model=require("../../site/assets/js/song-notebook/model.js"),Storage=require("../../site/assets/js/song-notebook/storage.js"),Contracts=require("../../site/assets/js/song-notebook/contracts.js");
const {notebookDocument}=require("./dom-fixture.cjs"),{memoryStorage}=require("./fixtures.cjs");
function setup(realComponents=false){const document=notebookDocument(),renders=[],handlers={},memory=memoryStorage();const component={mount:()=>({render:snapshot=>renders.push(snapshot),destroy(){}})};const window={SongNotebookMusic:Music,SongNotebookModel:Model,SongNotebookStorage:Storage,SongNotebookContracts:Contracts,SongNotebookCompose:realComponents?require("../../site/assets/js/song-notebook/compose.js"):component,SongNotebookEditor:realComponents?require("../../site/assets/js/song-notebook/editor.js"):component,localStorage:memory,addEventListener(type,handler){handlers[type]=handler;},removeEventListener(type){delete handlers[type];}};const app=Controller.bootstrap(window,document);return {app,window,document,renders,handlers,memory};}
function byText(root,tag,text){return root.querySelectorAll(tag).find(node=>node.textContent===text);}
test("bootstrap wires actual store into hosts while preserving an empty first song",()=>{const {app,document,renders,memory}=setup();assert.equal(document.getElementById("song-notebook").hidden,false);assert.equal(document.querySelector("main.guitar-chordinator").hidden,true);assert.equal(renders.at(-1).song.chords.length,0);assert.equal(renders.at(-1).song.sections[0].name,"Section 1");assert.ok(memory.getItem(Contracts.libraryKey));assert.equal(document.getElementById("notebook-details").hidden,true);app.destroy();});
test("inline title and optional notes use text and remain visible after committing",()=>{const {app,document}=setup();const header=document.getElementById("notebook-header");let title=header.querySelector('[aria-label="Song title"]');title.value="<script>Song title</script>";title.dispatchEvent({type:"change"});assert.equal(app.store.snapshot().song.title,title.value);byText(header,"button","Add song notes…").click();const notes=header.querySelector("textarea");notes.value="Line one\nLine two";notes.dispatchEvent({type:"change"});byText(header,"button","Done with song notes").click();assert.ok(header.textContent.includes("Line one\nLine two"));assert.equal(header.querySelector("script"),null);app.destroy();});
test("settings changes preview before Apply and storage events expose explicit choices",()=>{const {app,document,handlers}=setup();let header=document.getElementById("notebook-header");byText(header,"button","Standard tuning · No capo").click();const settings=document.getElementById("notebook-settings");const capo=settings.querySelector('[aria-label="Full capo fret"]');capo.value="2";capo.dispatchEvent({type:"input"});assert.equal(app.store.snapshot().song.capo,0);settings.querySelector("form").dispatchEvent({type:"submit"});assert.equal(app.store.snapshot().song.capo,2);handlers.storage({key:Contracts.libraryKey,storageArea:null});const status=document.getElementById("notebook-status");assert.ok(byText(status,"button","Reload saved copy"));assert.ok(byText(status,"button","Keep and save this copy"));assert.equal(app.store.state().suspended,"conflict");app.destroy();});

test("real composer and editor work together through visible controls and bootstrap",()=>{
 const {app,document}=setup(true),root=document.getElementById("song-notebook");
 assert.match(root.textContent,/Start with a few chords/);
 const input=root.querySelector('[placeholder="Am F C G…"]');input.value="Am F C G";input.parentNode.parentNode.dispatchEvent({type:"submit"});
 assert.equal(app.store.snapshot().song.sections[0].occurrences.length,4);
 const newChord=byText(root,"button","+ New chord");newChord.click();
 const editor=document.getElementById("notebook-editor");assert.equal(editor.hidden,false);
 editor.querySelector('[data-editor-key="fret-0-0"]').click();
 byText(editor,"button","Keep & add to Section 1").click();
 assert.equal(app.store.snapshot().song.chords.length,5);assert.equal(app.store.snapshot().song.sections[0].occurrences.length,5);
 assert.equal(app.store.snapshot().song.chords[4].interpretation,null);
 app.destroy();
});

test("header keeps focused uncommitted text and pending buttons across unrelated saves",()=>{
 const {app,document}=setup(true),header=document.getElementById("notebook-header");
 const input=header.querySelector('[aria-label="Song title"]'),songs=byText(header,"button","Songs ▾");
 input.focus();input.value="Uncommitted title";input.selectionStart=5;input.selectionEnd=5;
 app.store.flush();assert.strictEqual(header.querySelector('[aria-label="Song title"]'),input);assert.equal(input.value,"Uncommitted title");
 input.dispatchEvent({type:"change"});assert.strictEqual(byText(header,"button","Songs ▾"),songs);assert.equal(input.selectionStart,5);
 songs.click();assert.match(header.textContent,/New song/);app.destroy();
});
