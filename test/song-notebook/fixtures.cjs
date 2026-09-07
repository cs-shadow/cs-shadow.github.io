"use strict";
// Integration-owned independent model fixture, NOT production music logic.
const catalogs = require("./catalog-fixture.json");
const contracts = require("../../site/assets/js/song-notebook/contracts.js");
const clone = value => JSON.parse(JSON.stringify(value));
const normalizePitch = n => ((n % 12) + 12) % 12;
const names = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];
const flatNames = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const pitchName = (pc, flats = false) => (flats ? flatNames : names)[normalizePitch(pc)];
const error = message => ({ code: "INVALID_SYMBOL", message, path: null, details: null });
function interpretation(symbol) {
  const text = symbol.replaceAll("♯", "#").replaceAll("♭", "b").trim();
  const match = /^([A-G])([#b]?)([^/]*)(?:\/([A-G])([#b]?))?$/.exec(text);
  if (!match || !catalogs.chords.some(c => c.suffix === match[3])) return null;
  const pc = (letter, accidental) => normalizePitch({ C:0,D:2,E:4,F:5,G:7,A:9,B:11 }[letter] + (accidental === "#" ? 1 : accidental === "b" ? -1 : 0));
  return { rootPc:pc(match[1],match[2]),rootSpelling:match[1]+match[2],formulaId:match[3],bassPc:match[4]?pc(match[4],match[5]):null,bassSpelling:match[4]?match[4]+match[5]:null };
}
function musicFixture() {
  return {
    chords: catalogs.chords.map(c => ({ ...clone(c), id:c.suffix, group:"triads" })),
    scales: clone(catalogs.scales), roots:names.slice(), presets:[], defaultTuning:contracts.defaultTuning.slice(),
    normalizePitch, pitchName,
    parseChordSymbol(text) { const value=interpretation(text); return { interpretation:value,error:value?null:error("Unknown chord symbol") }; },
    formatInterpretation(i) { return i ? i.rootSpelling+i.formulaId+(i.bassSpelling?"/"+i.bassSpelling:"") : ""; },
    interpretationPitches(i) { const formula=catalogs.chords.find(c=>c.suffix===i.formulaId); return [...new Set(formula.intervals.map(n=>normalizePitch(n+i.rootPc)).concat(i.bassPc===null?[]:[i.bassPc]))].sort((a,b)=>a-b); },
    transposeInterpretation(i,n) { if (!i) return null; return {...i,rootPc:normalizePitch(i.rootPc+n),rootSpelling:pitchName(i.rootPc+n,i.rootSpelling.includes("b")),bassPc:i.bassPc===null?null:normalizePitch(i.bassPc+n),bassSpelling:i.bassPc===null?null:pitchName(i.bassPc+n,i.bassSpelling.includes("b"))}; },
    notesForShape(tuning,capo,frets) { return frets.flatMap((fret,stringIndex)=>fret===null?[]:[{stringIndex,fret,physicalFret:fret+capo,midi:tuning[stringIndex]+capo+fret,pc:normalizePitch(tuning[stringIndex]+capo+fret)}]); },
    identifyChord() { return []; }, romanLabel() { return ""; }, chordsForScale() { return []; },
    matchScales() { return {candidates:[],excludedChordIds:[]}; },
    async findVoicings() { return {shapes:[],cancelled:false}; }
  };
}
function dependencies() {
  let counter=0;
  return { music:musicFixture(), id:()=>`fixture-${++counter}`, now:()=>"2026-09-07T12:00:00.000Z" };
}
function songFixture() {
  return {
    id:"song-1",title:"",notes:"First line\nSecond line",createdAt:"2026-09-07T12:00:00.000Z",updatedAt:"2026-09-07T12:00:00.000Z",
    tuningMidi:contracts.defaultTuning.slice(),capo:0,context:{tonicPc:0,tonicSpelling:"C",sourceChordId:"chord-c",scaleId:null},
    chords:[
      {id:"chord-c",frets:null,interpretation:interpretation("C"),nickname:"",notes:"",reviewRequired:false,previousInterpretation:null},
      {id:"chord-shape",frets:[0,1,0,2,3,null],interpretation:null,nickname:"Warm shape",notes:"Unused material",reviewRequired:false,previousInterpretation:null}
    ],
    sections:[{id:"section-1",name:"Section 1",notes:"",occurrences:[{id:"occurrence-1",chordId:"chord-c",duration:{value:0.5,unit:"bars"},annotation:"Let ring"}]}],
    arrangement:[{id:"order-1",sectionId:"section-1",repeatCount:2}]
  };
}
function memoryStorage(initial={}) {
  const values=new Map(Object.entries(initial));
  return {getItem:key=>values.has(key)?values.get(key):null,setItem:(key,value)=>values.set(key,String(value)),removeItem:key=>values.delete(key),values};
}
function blankDraftFixture() {
  return {songId:"song-1",chordId:null,candidate:{frets:[null,null,null,null,null,null],interpretation:null,nickname:"",notes:"",reviewRequired:false,previousInterpretation:null},sourceFingerprint:null,tuningMidi:contracts.defaultTuning.slice(),capo:0,originSectionId:null,originOccurrenceId:null};
}
module.exports={contracts,catalogs,clone,interpretation,musicFixture,dependencies,songFixture,memoryStorage,blankDraftFixture};
