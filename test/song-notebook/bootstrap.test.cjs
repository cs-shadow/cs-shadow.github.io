"use strict";
const test=require("node:test"),assert=require("node:assert/strict");
const Controller=require("../../site/assets/js/guitar-chordinator.js"),Music=require("../../site/assets/js/song-notebook/music.js"),Model=require("../../site/assets/js/song-notebook/model.js"),Storage=require("../../site/assets/js/song-notebook/storage.js"),Contracts=require("../../site/assets/js/song-notebook/contracts.js");
const {notebookDocument}=require("./dom-fixture.cjs"),{memoryStorage}=require("./fixtures.cjs");
function setup(realComponents=false,reading=false){const document=notebookDocument(),renders=[],handlers={},memory=memoryStorage();const component={mount:()=>({render:snapshot=>renders.push(snapshot),destroy(){}})};const window={MusicToolControls:require("../../site/assets/js/music-tool-controls.js"),SongNotebookMusic:Music,SongNotebookModel:Model,SongNotebookStorage:Storage,SongNotebookContracts:Contracts,SongNotebookCompose:realComponents?require("../../site/assets/js/song-notebook/compose.js"):component,SongNotebookExplore:realComponents?require("../../site/assets/js/song-notebook/explore.js"):undefined,SongNotebookReading:reading==="real"?require("../../site/assets/js/song-notebook/reading.js"):reading?component:undefined,print(){},SongNotebookEditor:realComponents?require("../../site/assets/js/song-notebook/editor.js"):component,localStorage:memory,addEventListener(type,handler){handlers[type]=handler;},removeEventListener(type){delete handlers[type];}};const app=Controller.bootstrap(window,document);return {app,window,document,renders,handlers,memory};}
function byText(root,tag,text){return root.querySelectorAll(tag).find(node=>node.textContent===text);}
function settingsControl(settings,key){return settings.querySelector('[data-settings-key="'+key+'"]');}
function openSettings(document){byText(document.getElementById("notebook-header"),"button","Standard tuning · No capo").click();return document.getElementById("notebook-settings");}
function applySettings(settings){settings.querySelector("form").dispatchEvent({type:"submit"});}
test("bootstrap wires actual store into hosts while preserving an empty first song",()=>{const {app,document,renders,memory}=setup();assert.equal(document.getElementById("song-notebook").hidden,false);assert.equal(document.querySelector("main.guitar-chordinator").hidden,true);assert.equal(renders.at(-1).song.chords.length,0);assert.equal(renders.at(-1).song.sections[0].name,"Section 1");assert.ok(memory.getItem(Contracts.libraryKey));assert.equal(document.getElementById("notebook-details").hidden,true);app.destroy();});
test("inline title and optional notes use text and remain visible after committing",()=>{const {app,document}=setup();const header=document.getElementById("notebook-header");let title=header.querySelector('[aria-label="Song title"]');title.value="<script>Song title</script>";title.dispatchEvent({type:"change"});assert.equal(app.store.snapshot().song.title,title.value);byText(header,"button","Add song notes…").click();const notes=header.querySelector("textarea");notes.value="Line one\nLine two";notes.dispatchEvent({type:"change"});byText(header,"button","Done with song notes").click();assert.ok(header.textContent.includes("Line one\nLine two"));assert.equal(header.querySelector("script"),null);app.destroy();});
test("settings changes preview before Apply and storage events expose explicit choices",()=>{const {app,document,handlers}=setup();let header=document.getElementById("notebook-header");byText(header,"button","Standard tuning · No capo").click();const settings=document.getElementById("notebook-settings");settings.querySelector('[data-settings-key="capo-2"]').click();assert.equal(app.store.snapshot().song.capo,0);settings.querySelector("form").dispatchEvent({type:"submit"});assert.equal(app.store.snapshot().song.capo,2);handlers.storage({key:Contracts.libraryKey,storageArea:null});const status=document.getElementById("notebook-status");assert.ok(byText(status,"button","Reload saved copy"));assert.ok(byText(status,"button","Keep and save this copy"));assert.equal(app.store.state().suspended,"conflict");app.destroy();});

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

test("closing Explore restores its opener through the real component and bootstrap wiring",()=>{
 const {app,document}=setup(true),root=document.getElementById("song-notebook");
 const opener=byText(root,"button","Explore");opener.focus();opener.click();
 const explore=document.getElementById("notebook-explore"),close=byText(explore,"button","Close exploration");
 assert.equal(explore.hidden,false);close.focus();close.click();
 assert.equal(explore.hidden,true);assert.strictEqual(document.activeElement,opener);
 opener.click();const select=explore.querySelector('[data-explore-key="browse-root"]');select.focus();
 app.store.dispatch({type:"song.update",patch:{title:"An unrelated save"}});
 assert.strictEqual(document.activeElement,select);
 app.store.dispatch({type:"panel.set",panel:null});
 assert.notStrictEqual(document.activeElement,opener);
 app.destroy();
});

test("manual capture opens the selected identity in the real editor without returning focus to Explore",()=>{
 const {app,document}=setup(true),root=document.getElementById("song-notebook");
 const opener=byText(root,"button","Explore");opener.focus();opener.click();
 const interpretation=Music.parseChordSymbol("C13").interpretation;
 app.store.dispatch({type:"explore.set",patch:{selectedInterpretation:interpretation}});
 const explore=document.getElementById("notebook-explore"),capture=byText(explore,"button","Capture a shape manually");
 capture.focus();capture.click();
 const editor=document.getElementById("notebook-editor");
 assert.equal(explore.hidden,true);assert.equal(editor.hidden,false);
 assert.deepEqual(app.store.snapshot().drafts[0].candidate.interpretation,interpretation);
 assert.match(editor.textContent,/C13/);assert.notStrictEqual(document.activeElement,opener);
 assert.equal(app.store.snapshot().song.chords.length,0);app.destroy();
});

test("Explore close uses the current opener when a song switch replaces the original control",()=>{
 const {app,document}=setup(true),root=document.getElementById("song-notebook");
 const originalSong=app.store.snapshot().song.id,original=byText(root,"button","Explore");
 original.focus();original.click();app.store.dispatch({type:"library.create"});
 app.store.dispatch({type:"library.switch",songId:originalSong});
 const current=byText(root,"button","Explore");
 assert.ok(current!==original);assert.equal(document.body.contains(original),false);
 const close=byText(document.getElementById("notebook-explore"),"button","Close exploration");
 close.focus();close.click();assert.ok(document.activeElement===current);app.destroy();
});

test("new manual capture starts in Shape after a prior name draft ends, while Resume retains its mode",()=>{
 for(const finish of ["keep","discard"]){
  const {app,document}=setup(true),root=document.getElementById("song-notebook"),editor=document.getElementById("notebook-editor");
  byText(root,"button","+ New chord").click();
  app.store.dispatch({type:"draft.patch",chordId:null,patch:{frets:null,interpretation:Music.parseChordSymbol("Am").interpretation}});
  byText(editor,"button","Chord name").click();
  byText(root,"button","Explore").click();
  app.store.dispatch({type:"explore.set",patch:{selectedInterpretation:Music.parseChordSymbol("C13").interpretation}});
  byText(root,"button","Resume existing chord draft").click();
  assert.equal(byText(editor,"button","Chord name").getAttribute("aria-pressed"),"true");
  const action=finish==="keep"?{type:"draft.apply",chordId:null,mode:"keep"}:{type:"draft.discard",chordId:null};
  assert.equal(app.store.dispatch(action).error,null);
  byText(root,"button","Explore").click();
  byText(root,"button","Capture a shape manually").click();
  assert.equal(byText(editor,"button","Shape").getAttribute("aria-pressed"),"true");
  assert.equal(app.store.snapshot().drafts[0].candidate.interpretation.formulaId,"13");
  app.destroy();
 }
});

test("header keeps focused uncommitted text and pending buttons across unrelated saves",()=>{
 const {app,document}=setup(true),header=document.getElementById("notebook-header");
 const input=header.querySelector('[aria-label="Song title"]'),songs=byText(header,"button","Songs ▾");
 input.focus();input.value="Uncommitted title";input.selectionStart=5;input.selectionEnd=5;
 app.store.flush();assert.strictEqual(header.querySelector('[aria-label="Song title"]'),input);assert.equal(input.value,"Uncommitted title");
 input.dispatchEvent({type:"change"});assert.strictEqual(byText(header,"button","Songs ▾"),songs);assert.equal(input.selectionStart,5);
 songs.click();assert.match(header.textContent,/New song/);app.destroy();
});

// The site sets main { display: block }, which defeats the native hidden rule.
test("activated layout suppresses legacy content and groups responsive song actions",()=>{
 const fs=require("node:fs"),path=require("node:path");
 const css=fs.readFileSync(path.join(__dirname,"../../site/assets/css/song-notebook/notebook.css"),"utf8");
 assert.match(css,/main\.guitar-chordinator\[hidden\]\s*\{\s*display:\s*none\s*!important/);
 const {app,document}=setup(true),header=document.getElementById("notebook-header");
 const actions=header.querySelector('[aria-label="Song actions"]');
 assert.deepEqual(actions.querySelectorAll("button").map(x=>x.textContent),["Read","Song menu ⋯","Undo","Redo"]);
 byText(header,"button","+ Home / scale").click();
 const form=header.querySelector("form");assert.equal(form.getAttribute("class"),"notebook-context-form");
 assert.equal(form.querySelectorAll("label").length,2);app.destroy();
});

test("print temporarily presents committed reading content and restores edit selection",()=>{
 const {app,document,window,handlers,renders}=setup(true,true);
 app.store.dispatch({type:"draft.open",chordId:null});
 const before=app.store.snapshot();
 window.print=()=>{assert.equal(document.getElementById("notebook-reading").hidden,false);assert.equal(document.getElementById("notebook-workspace").hidden,true);assert.equal(renders.at(-1).mode,"read");};
 assert.equal(app.store.dispatch({type:"file.print"}).error,null);
 assert.deepEqual(app.store.snapshot().drafts,before.drafts);assert.equal(app.store.snapshot().mode,"edit");
 assert.equal(document.getElementById("notebook-editor").hidden,false);
 handlers.beforeprint();assert.equal(document.getElementById("notebook-reading").hidden,false);
 handlers.afterprint();assert.equal(document.getElementById("notebook-reading").hidden,true);
 app.destroy();assert.equal(handlers.beforeprint,undefined);assert.equal(handlers.afterprint,undefined);
});

test("actual reading component integrates with menu print and preserves the shared draft",()=>{
 const {app,document,window}=setup(true,"real"),root=document.getElementById("song-notebook"),header=document.getElementById("notebook-header");
 const sectionId=app.store.snapshot().activeSectionId;
 app.store.dispatch({type:"progression.insert",sectionId,text:"Am F C G",afterOccurrenceId:null});
 byText(root,"button","+ New chord").click();document.getElementById("notebook-editor").querySelector('[data-editor-key="fret-0-0"]').click();
 byText(root,"button","Keep & add to Section 1").click();
 app.store.dispatch({type:"draft.open",chordId:app.store.snapshot().song.chords[0].id});
 const draft=app.store.snapshot().drafts;
 byText(header,"button","Read").click();const reading=document.getElementById("notebook-reading");
 assert.equal(reading.hidden,false);assert.equal(reading.querySelectorAll("svg").length,1);assert.match(reading.textContent,/Chord dictionary/);
 byText(header,"button","Edit").click();
 window.print=()=>{assert.equal(reading.hidden,false);assert.equal(reading.querySelectorAll("svg").length,1);};
 assert.equal(app.store.dispatch({type:"file.print"}).error,null);assert.deepEqual(app.store.snapshot().drafts,draft);
 assert.equal(document.getElementById("notebook-editor").hidden,false);app.destroy();
});

test("native print preserves unblurred title and editor input nodes and text",()=>{
 const {app,document,handlers}=setup(true,"real"),header=document.getElementById("notebook-header");
 byText(document.getElementById("song-notebook"),"button","+ New chord").click();
 const title=header.querySelector('[aria-label="Song title"]'),editor=document.getElementById("notebook-editor"),field=editor.querySelector("input");
 title.value="Unblurred title";field.value="Unblurred editor value";field.focus();field.selectionStart=5;
 handlers.beforeprint();handlers.afterprint();
 assert.strictEqual(header.querySelector('[aria-label="Song title"]'),title);assert.equal(title.value,"Unblurred title");
 assert.strictEqual(editor.querySelector("input"),field);assert.equal(field.value,"Unblurred editor value");assert.equal(field.selectionStart,5);assert.strictEqual(document.activeElement,field);app.destroy();
});

test("Read shows only reading actions and restores authoring controls on Edit",()=>{
 const {app,document}=setup(true,"real"),header=document.getElementById("notebook-header"),settings=document.getElementById("notebook-settings");
 byText(header,"button","Standard tuning · No capo").click();byText(header,"button","+ Home / scale").click();byText(header,"button","Add song notes…").click();
 assert.equal(settings.hidden,false);byText(header,"button","Read").click();
 assert.deepEqual(header.querySelectorAll("button").map(n=>n.textContent),["Edit","Print / Save as PDF"]);assert.equal(header.querySelectorAll("input").length,0);assert.equal(header.querySelectorAll("select").length,0);assert.equal(header.querySelectorAll("textarea").length,0);assert.equal(settings.hidden,true);
 byText(header,"button","Edit").click();assert.ok(header.querySelector('[aria-label="Song title"]'));assert.ok(header.querySelector('[aria-label="Song notes"]'));assert.ok(header.querySelector('[aria-label="Home tonic"]'));assert.equal(settings.hidden,false);app.destroy();
});

test("settings preview includes shapes saved since the header was rendered",()=>{
 const {app,document}=setup(true),header=document.getElementById("notebook-header");
 const tuningButton=byText(header,"button","Standard tuning · No capo");
 app.store.dispatch({type:"chord.create",chord:{frets:[24,null,null,null,null,null],interpretation:null,nickname:"High shape",notes:""}});
 assert.strictEqual(byText(header,"button","Standard tuning · No capo"),tuningButton);
 tuningButton.click();
 const settings=document.getElementById("notebook-settings");
 settings.querySelector('[data-settings-key="capo-1"]').click();
 assert.equal(byText(settings,"button","Apply settings").disabled,true);
 assert.match(settings.textContent,/High shape would exceed physical fret 24/);
 assert.equal(app.store.snapshot().song.capo,0);
 app.destroy();
});

test("home controls preserve accepted spellings outside the common root menu",()=>{
 for(const spelling of ["E#","Cb","F##"]){
  const {app,document}=setup(),header=document.getElementById("notebook-header");
  const parsed=Music.parseChordSymbol(spelling).interpretation;
  app.store.dispatch({type:"context.set",context:{tonicPc:parsed.rootPc,tonicSpelling:spelling,sourceChordId:null,scaleId:null}});
  byText(header,"button","Home "+spelling).click();
  const tonic=header.querySelector('[aria-label="Home tonic"]'),selected=tonic.querySelectorAll("option").filter(node=>node.selected);
  assert.equal(selected.length,1);assert.equal(selected[0].textContent,spelling);
  tonic.value=selected[0].getAttribute("value");
  header.querySelector('[aria-label="Song scale"]').value="dorian";
  header.querySelector("form").dispatchEvent({type:"submit"});
  assert.equal(app.store.snapshot().song.context.tonicSpelling,spelling);
  assert.equal(app.store.snapshot().song.context.tonicPc,parsed.rootPc);
  app.destroy();
 }
});

test("renaming with Songs open preserves the next library action and its labels",()=>{
 const {app,document}=setup(),header=document.getElementById("notebook-header"),songId=app.store.snapshot().song.id;
 byText(header,"button","Songs ▾").click();
 const title=header.querySelector('[aria-label="Song title"]'),create=byText(header,"button","New song");
 title.focus();title.value="Renamed song";title.dispatchEvent({type:"change"});
 assert.strictEqual(byText(header,"button","New song"),create);
 assert.equal(header.querySelector("[data-library-song]").textContent,"Renamed song");
 assert.equal(header.querySelector("[data-library-delete]").getAttribute("aria-label"),"Delete Renamed song");
 create.click();
 assert.equal(app.store.state().library.songs.length,2);
 assert.notEqual(app.store.snapshot().song.id,songId);
 assert.equal(app.store.state().library.songs.find(song=>song.id===songId).title,"Renamed song");
 app.destroy();
});

test("visual tuning presets preserve the draft capo and cancel without saving",()=>{
 const {app,document}=setup(),before=app.store.snapshot().song,settings=openSettings(document);
 assert.equal(settings.querySelectorAll("select").length,0);
 assert.equal(settings.querySelectorAll("input").length,0);
 assert.equal(settingsControl(settings,"preset-standard").getAttribute("aria-pressed"),"true");
 settingsControl(settings,"capo-2").click();
 for(const preset of Music.presets){
  settingsControl(settings,"preset-"+preset.id).click();
  assert.equal(settingsControl(settings,"preset-"+preset.id).getAttribute("aria-pressed"),"true");
  assert.equal(settingsControl(settings,"capo-2").getAttribute("aria-pressed"),"true");
  assert.match(settings.querySelector(".notebook-tuning-name").textContent,new RegExp(preset.label));
 }
 assert.deepEqual(app.store.snapshot().song,before);
 settingsControl(settings,"cancel").click();assert.equal(settings.hidden,true);
 assert.deepEqual(app.store.snapshot().song,before);
 openSettings(document);
 assert.equal(settingsControl(settings,"preset-standard").getAttribute("aria-pressed"),"true");
 assert.equal(settingsControl(settings,"capo-0").getAttribute("aria-pressed"),"true");
 app.destroy();
});

test("string notes preserve octave, identify matching presets, and preview sounding pitches",()=>{
 const {app,document}=setup(),settings=openSettings(document);
 settingsControl(settings,"string-5").click();
 const picker=settings.querySelector(".music-note-picker");
 assert.equal(picker.hidden,false);assert.equal(picker.getAttribute("aria-label"),"Edit string 6 tuning");
 assert.match(picker.textContent,/Octave 2/);
 settingsControl(settings,"note-2").click();
 assert.equal(settingsControl(settings,"preset-drop-d").getAttribute("aria-pressed"),"true");
 assert.equal(settingsControl(settings,"note-2").getAttribute("aria-pressed"),"true");
 assert.match(settingsControl(settings,"string-5").textContent,/D2/);
 settingsControl(settings,"note-3").click();
 assert.match(settings.querySelector(".notebook-tuning-name").textContent,/Custom tuning/);
 assert.equal(Music.presets.some(preset=>settingsControl(settings,"preset-"+preset.id).getAttribute("aria-pressed")==="true"),false);
 assert.match(picker.textContent,/Octave 2/);
 settingsControl(settings,"octave-up").click();assert.match(picker.textContent,/Octave 3/);
 assert.match(settingsControl(settings,"string-5").textContent,/D#3/);
 settingsControl(settings,"capo-2").click();
 assert.match(settings.querySelector(".notebook-sounding-tuning").textContent,/F3/);
 assert.deepEqual(app.store.snapshot().song.tuningMidi,Music.defaultTuning);
 applySettings(settings);
 assert.deepEqual(app.store.snapshot().song.tuningMidi,[64,59,55,50,45,51]);
 assert.equal(app.store.snapshot().song.capo,2);
 app.destroy();
});

test("note and octave controls enforce the complete MIDI range",()=>{
 const {app,document}=setup();
 app.store.dispatch({type:"settings.apply",tuningMidi:[0,127,55,50,45,40],capo:0});
 const header=document.getElementById("notebook-header");
 byText(header,"button","Custom tuning · No capo").click();
 const settings=document.getElementById("notebook-settings");
 settingsControl(settings,"string-0").click();
 assert.match(settings.querySelector(".music-note-picker").textContent,/Octave -1/);
 assert.equal(settingsControl(settings,"octave-down").disabled,true);
 assert.equal(settingsControl(settings,"octave-up").disabled,false);
 settingsControl(settings,"octave-down").click();
 assert.match(settingsControl(settings,"string-0").textContent,/C-1/);
 settingsControl(settings,"string-1").click();
 assert.match(settings.querySelector(".music-note-picker").textContent,/Octave 9/);
 assert.equal(settingsControl(settings,"octave-up").disabled,true);
 assert.equal(settingsControl(settings,"note-7").disabled,false);
 assert.equal(settingsControl(settings,"note-8").disabled,true);
 assert.equal(settingsControl(settings,"note-11").disabled,true);
 settingsControl(settings,"note-8").click();
 assert.match(settingsControl(settings,"string-1").textContent,/G9/);
 settingsControl(settings,"octave-down").click();
 assert.equal(settingsControl(settings,"note-11").disabled,false);
 settingsControl(settings,"note-11").click();
 assert.equal(settingsControl(settings,"octave-up").disabled,true);
 applySettings(settings);assert.deepEqual(app.store.snapshot().song.tuningMidi,[0,119,55,50,45,40]);
 app.destroy();
});

test("capo keyboard navigation selects and focuses positions including both bounds",()=>{
 const {app,document}=setup(),settings=openSettings(document);
 function key(from,key,to){
  const control=settingsControl(settings,"capo-"+from);control.focus();
  const event={type:"keydown",key,bubbles:true};control.dispatchEvent(event);
  assert.equal(event.defaultPrevented,true);
  assert.strictEqual(document.activeElement,settingsControl(settings,"capo-"+to));
  assert.equal(document.activeElement.getAttribute("aria-pressed"),"true");
 }
 key(0,"ArrowLeft",0);key(0,"ArrowRight",1);key(1,"End",12);
 key(12,"ArrowRight",12);key(12,"ArrowLeft",11);key(11,"Home",0);
 settingsControl(settings,"capo-12").click();settingsControl(settings,"capo-12").click();
 assert.equal(settingsControl(settings,"capo-12").getAttribute("aria-pressed"),"true");
 assert.equal(app.store.snapshot().song.capo,0);
 applySettings(settings);assert.equal(app.store.snapshot().song.capo,12);
 app.destroy();
});

test("settings keep focused nodes and the active picker through draft updates and saves",()=>{
 const {app,document}=setup(),settings=openSettings(document),string=settingsControl(settings,"string-0");
 string.click();assert.equal(string.getAttribute("aria-expanded"),"true");
 const note=settingsControl(settings,"note-5"),picker=settings.querySelector(".music-note-picker");
 note.focus();note.click();
 assert.strictEqual(settingsControl(settings,"note-5"),note);assert.strictEqual(document.activeElement,note);
 app.store.flush();app.store.dispatch({type:"song.update",patch:{title:"Another title"}});
 assert.strictEqual(settingsControl(settings,"note-5"),note);assert.strictEqual(document.activeElement,note);
 assert.strictEqual(settings.querySelector(".music-note-picker"),picker);assert.equal(picker.hidden,false);
 settingsControl(settings,"picker-done").click();
 assert.equal(picker.hidden,true);assert.strictEqual(document.activeElement,string);assert.equal(string.getAttribute("aria-expanded"),"false");
 string.click();note.focus();note.dispatchEvent({type:"keydown",key:"Escape",bubbles:true});
 assert.equal(picker.hidden,true);assert.strictEqual(document.activeElement,string);
 app.destroy();
});

test("settings draft and picker survive Read but reset when changing songs",()=>{
 const {app,document}=setup(true,"real"),settings=openSettings(document),header=document.getElementById("notebook-header");
 settingsControl(settings,"capo-2").click();settingsControl(settings,"string-5").click();settingsControl(settings,"note-2").click();
 byText(header,"button","Read").click();assert.equal(settings.hidden,true);
 byText(header,"button","Edit").click();assert.equal(settings.hidden,false);
 assert.equal(settingsControl(settings,"capo-2").getAttribute("aria-pressed"),"true");
 assert.equal(settingsControl(settings,"preset-drop-d").getAttribute("aria-pressed"),"true");
 assert.equal(settings.querySelector(".music-note-picker").hidden,false);
 assert.equal(settings.querySelector(".music-note-picker").getAttribute("aria-label"),"Edit string 6 tuning");
 const original=app.store.snapshot().song.id;
 app.store.dispatch({type:"library.create"});
 if(settings.hidden)openSettings(document);
 assert.equal(settingsControl(settings,"capo-0").getAttribute("aria-pressed"),"true");
 assert.equal(settingsControl(settings,"preset-standard").getAttribute("aria-pressed"),"true");
 assert.equal(settings.querySelector(".music-note-picker").hidden,true);
 app.store.dispatch({type:"library.switch",songId:original});
 assert.deepEqual(app.store.snapshot().song.tuningMidi,Music.defaultTuning);assert.equal(app.store.snapshot().song.capo,0);
 app.destroy();
});

test("applying visual tuning and capo creates one undoable settings change",()=>{
 const {app,document}=setup(),settings=openSettings(document);
 settingsControl(settings,"preset-open-d").click();settingsControl(settings,"capo-2").click();
 assert.equal(app.store.state().canUndo,false);
 applySettings(settings);assert.equal(settings.hidden,true);
 assert.deepEqual(app.store.snapshot().song.tuningMidi,[62,57,54,50,45,38]);assert.equal(app.store.snapshot().song.capo,2);
 app.store.dispatch({type:"history.undo"});
 assert.deepEqual(app.store.snapshot().song.tuningMidi,Music.defaultTuning);assert.equal(app.store.snapshot().song.capo,0);
 assert.equal(app.store.state().canUndo,false);
 app.store.dispatch({type:"history.redo"});
 assert.deepEqual(app.store.snapshot().song.tuningMidi,[62,57,54,50,45,38]);assert.equal(app.store.snapshot().song.capo,2);
 app.destroy();
});

test("an open settings preview revalidates shapes added and removed afterward",()=>{
 const {app,document}=setup(),settings=openSettings(document),capo=settingsControl(settings,"capo-2");
 capo.click();assert.equal(settingsControl(settings,"apply").disabled,false);
 app.store.dispatch({type:"chord.create",chord:{frets:[24,null,null,null,null,null],interpretation:null,nickname:"Later high shape",notes:""}});
 const chord=app.store.snapshot().song.chords.at(-1);
 assert.strictEqual(settingsControl(settings,"capo-2"),capo);
 assert.equal(settingsControl(settings,"apply").disabled,true);
 assert.match(settings.textContent,/Later high shape would exceed physical fret 24/);
 assert.equal(app.store.snapshot().song.capo,0);
 app.store.dispatch({type:"chord.delete",chordId:chord.id});
 assert.equal(settingsControl(settings,"apply").disabled,false);
 applySettings(settings);assert.equal(app.store.snapshot().song.capo,2);
 app.destroy();
});

test("an open settings preview updates its warning when editor drafts appear or disappear",()=>{
 const {app,document}=setup(),settings=openSettings(document);
 settingsControl(settings,"capo-2").click();
 assert.doesNotMatch(settings.textContent,/Your unapplied drafts/);
 app.store.dispatch({type:"draft.open",chordId:null});
 assert.match(settings.textContent,/Your unapplied drafts will keep their old settings and require review/);
 app.store.dispatch({type:"draft.discard",chordId:null});
 assert.doesNotMatch(settings.textContent,/Your unapplied drafts/);
 app.destroy();
});

test("missing shared controls leaves the legacy fallback available",()=>{
 const document=notebookDocument(),legacy=document.querySelector("main.guitar-chordinator");
 legacy.hidden=false;
 assert.equal(Controller.bootstrap({SongNotebookCompose:{},SongNotebookEditor:{}},document),null);
 assert.equal(legacy.hidden,false);
});
