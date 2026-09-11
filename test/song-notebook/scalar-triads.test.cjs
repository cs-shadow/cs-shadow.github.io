"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const {documentFixture} = require("./dom-fixture.cjs");
const root = path.resolve(__dirname, "../.."), key = "cs-shadow.scalar-triads.recent-settings.v1";

function setup(payload, storageUnavailable = false, findVoicings) {
  const document = documentFixture(), createElement = document.createElement;
  // Extend the shared event fixture with Scalar's CSS-property and clearing
  // operations. Real layout and accessibility are checked in the browser.
  document.createElement = tag => {
    const element = createElement(tag);
    element.style.setProperty = (name, value) => { element.style[name] = String(value); };
    Object.defineProperty(element, "innerHTML", {set(value) { this.textContent = ""; if (value) this.textContent = value.replace(/<[^>]*>/g, ""); }});
    return element;
  };
  const html = fs.readFileSync(path.join(root, "site/tools/scalar-triads/index.html"), "utf8");
  const stack = [document.body];
  for (const match of html.matchAll(/<\/?([a-z][a-z0-9-]*)([^>]*)>/gi)) {
    const [token, tag, attributes] = match;
    if (token.startsWith("</")) { if (stack.at(-1).localName === tag) stack.pop(); continue; }
    const element = document.createElement(tag);
    for (const attribute of attributes.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) element.setAttribute(attribute[1], attribute[2] || "");
    if (/\bhidden\b/.test(attributes)) element.hidden = true;
    stack.at(-1).appendChild(element);
    if (!["link", "input", "br", "meta", "img"].includes(tag)) stack.push(element);
  }
  const storage = new Map(payload ? [[key, JSON.stringify(payload)]] : []), timers = new Map();
  let timerId = 0;
  const context = {document, console, AbortController, setTimeout: fn => {timers.set(++timerId, fn); return timerId;}, clearTimeout: id => timers.delete(id), addEventListener() {}, localStorage: {
    getItem(name) {if(storageUnavailable) throw new Error("Storage unavailable"); return storage.get(name) || null;},
    setItem(name, value) {if(storageUnavailable) throw new Error("Storage unavailable"); storage.set(name, value);},
    removeItem(name) {if(storageUnavailable) throw new Error("Storage unavailable"); storage.delete(name);}
  }};
  context.window = context;
  for (const script of html.matchAll(/<script src="([^"]+)"/g)) {
    vm.runInNewContext(fs.readFileSync(path.join(root, "site", script[1]), "utf8"), context);
    if (findVoicings && script[1].endsWith("/song-notebook/music.js")) {
      context.SongNotebookMusic = {...context.SongNotebookMusic, findVoicings};
    }
  }
  const byId = id => document.getElementById(id), control = name => document.querySelector('[data-tuning-key="' + name + '"]');
  return {document, byId, control, storage,
    style(name) { return document.querySelector('[data-fingering-style="' + name + '"]'); },
    flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); },
    async settle() {
      for (let pass = 0; pass < 10000; pass += 1) {
        await new Promise(setImmediate);
        this.flush();
        await new Promise(setImmediate);
        if (!timers.size) return;
      }
      assert.fail("Scalar asynchronous work did not settle");
    }
  };
}
const change = (element, value) => { element.value = value; element.dispatchEvent({type:"change", bubbles:true}); };
const saved = env => JSON.parse(env.storage.get(key));

test("Scalar renders the preserved musical results and applies tuning only after confirmation", () => {
  const env = setup(), {byId, control} = env;
  assert.equal(byId("scale-error").textContent, "");
  assert.equal(byId("result-title").textContent, "A Major / Ionian");
  assert.deepEqual(byId("scale-notes").children.map(node => node.textContent), ["A", "B", "C#", "D", "E", "F#", "G#"]);
  assert.deepEqual(byId("chord-summary").children.map(node => node.children[1].textContent), ["A", "Bm", "C#m", "D", "E", "F#m", "G#dim"]);
  assert.equal(byId("scale-fretboard").querySelectorAll("select").length, 0);
  assert.equal(byId("triad-list").children.length, 7);
  byId("scalar-tuning-toggle").click();
  assert.equal(byId("scalar-tuning-panel").hidden, false);
  control("preset-drop-d").click();
  assert.match(byId("scalar-tuning-toggle").textContent, /^Standard tuning/);
  assert.equal(byId("scale-fretboard").children[5].children[0].textContent, "E");
  byId("scalar-tuning-apply").click();
  assert.match(byId("scalar-tuning-toggle").textContent, /^Drop D tuning/);
  assert.equal(byId("scale-fretboard").children[5].children[0].textContent, "D");
  assert.equal(byId("string-set-selector").children[3].textContent, "D-A-D");
  assert.equal(control("preset-drop-d").getAttribute("aria-pressed"), "true");
  assert.equal(env.storage.has(key), false, "render does not wait for history persistence");
  env.flush();
  assert.deepEqual(saved(env).entries[0].tuning, [4, 11, 7, 2, 9, 2]);
});

test("Scalar custom note edits preserve focus, expose custom tuning, and close with Escape", () => {
  const {document, byId, control} = setup();
  byId("scalar-tuning-toggle").click();
  control("string-0").click();
  assert.equal(document.activeElement, control("note-4"));
  control("note-0").focus(); control("note-0").click();
  assert.equal(document.activeElement, control("note-0"));
  assert.equal(control("note-0").getAttribute("aria-pressed"), "true");
  assert.match(byId("scalar-tuning-toggle").textContent, /^Standard tuning/);
  assert.equal(byId("scale-fretboard").children[0].children[0].textContent, "E");
  assert.equal(control("preset-standard").getAttribute("aria-pressed"), "false");
  assert.equal(control("octave-up"), null);
  control("note-0").dispatchEvent({type:"keydown", key:"Escape", bubbles:true});
  assert.equal(document.activeElement, control("string-0"));
  assert.equal(byId("scalar-string-note-picker").hidden, true);
  assert.equal(byId("scalar-tuning-panel").hidden, false, "first Escape closes only the note picker");
  control("string-0").dispatchEvent({type:"keydown", key:"Escape", bubbles:true});
  assert.equal(byId("scalar-tuning-panel").hidden, true);
  assert.equal(byId("scalar-tuning-toggle").getAttribute("aria-expanded"), "false");
  assert.equal(document.activeElement, byId("scalar-tuning-toggle"));
  byId("scalar-tuning-toggle").click(); control("string-5").click(); control("picker-done").click();
  assert.equal(document.activeElement, control("string-5"));
});

test("Scalar restores existing history including custom tunings and clears pending saves", () => {
  const entries = [
    {root:"C", scaleId:"major", stringSetId:"strings-4-5-6", tuning:[4, 11, 7, 2, 9, 2]},
    {root:"D", scaleId:"dorian", stringSetId:"strings-1-2-3", tuning:[0, 11, 7, 2, 9, 4]}
  ];
  const env = setup({version:2, entries}), {byId, control} = env;
  assert.equal(byId("result-title").textContent, "C Major / Ionian");
  byId("scalar-tuning-toggle").click();
  assert.equal(control("preset-drop-d").getAttribute("aria-pressed"), "true");
  assert.equal(byId("string-set-selector").children[3].getAttribute("aria-pressed"), "true");
  change(byId("scale-recent-settings"), "1");
  assert.equal(byId("result-title").textContent, "D Dorian");
  byId("scalar-tuning-toggle").click();
  assert.match(control("string-0").getAttribute("aria-label"), /String 1, C,/);
  assert.deepEqual(saved(env).entries[0], {...entries[1], capo:0, fingeringStyle:"triads"});
  change(byId("scale-root"), "E");
  byId("scale-clear-history").click(); env.flush();
  assert.equal(env.storage.has(key), false);
  assert.equal(byId("scale-recent-settings").disabled, true);
  assert.equal(byId("scale-clear-history").disabled, true);
});

test("legacy history still defaults to standard tuning and unavailable storage remains optional", () => {
  const legacy = setup({version:1, entries:[{root:"C", scaleId:"major", stringSetId:"strings-1-2-3"}]});
  assert.equal(legacy.byId("result-title").textContent, "C Major / Ionian");
  assert.deepEqual(saved(legacy).entries[0].tuning, [4, 11, 7, 2, 9, 4]);
  const env = setup(null, true);
  env.byId("scalar-tuning-toggle").click();
  env.control("preset-open-g").click(); env.byId("scalar-tuning-apply").click(); env.flush();
  assert.equal(env.byId("scale-error").textContent, "");
  assert.match(env.byId("scale-tuning-description").textContent, /^Open G tuning/);
});


test("Scalar capo drafts cancel cleanly and applied capo changes sounding pitches only", () => {
  const env = setup(), {byId, control, document} = env;
  const originalNotes = byId("scale-notes").textContent;
  const originalChords = byId("chord-summary").textContent;
  const originalFingerings = byId("triad-list").textContent;
  byId("scalar-tuning-toggle").click();
  control("capo-2").click(); control("preset-drop-d").click();
  assert.equal(byId("triad-list").textContent, originalFingerings);
  env.flush(); assert.equal(env.storage.has(key), false);
  byId("scalar-tuning-cancel").click();
  assert.equal(document.activeElement, byId("scalar-tuning-toggle"));
  byId("scalar-tuning-toggle").click();
  assert.equal(control("capo-0").getAttribute("aria-pressed"), "true");
  assert.equal(control("preset-standard").getAttribute("aria-pressed"), "true");
  control("capo-2").click(); byId("scalar-tuning-apply").click();
  assert.equal(byId("scale-fretboard").children[0].children[1].textContent, "F#", "open first string sounds two semitones higher");
  assert.equal(byId("scale-notes").textContent, originalNotes);
  assert.equal(byId("chord-summary").textContent, originalChords);
  assert.notEqual(byId("triad-list").textContent, originalFingerings);
  assert.match(byId("scale-tuning-description").textContent, /Capo 2, relative frets 0-15/);
  env.flush(); assert.equal(saved(env).entries[0].capo, 2);

  // Every A-major fingering must still sound A, C#, E after capo offset.
  const pitches = {A:9, "C#":1, E:4}, tuning = [4,11,7];
  const strips = byId("triad-list").children[0].querySelectorAll(".triad-strip");
  assert.ok(strips.length);
  for (const strip of strips) {
    const start = Number(strip.children[3].children[1].textContent);
    const found = [];
    strip.children.slice(0,3).forEach((row, string) => {
      row.children.slice(1).forEach((cell, offset) => {
        if (cell.children.length) {
          assert.equal((tuning[string] + 2 + start + offset) % 12, pitches[cell.textContent]);
          found.push(cell.textContent);
        }
      });
    });
    assert.deepEqual(found.sort(), ["A", "C#", "E"]);
  }
});

test("Scalar capo history remains distinct, restores settings, and rejects invalid capos", () => {
  const base = {root:"A", scaleId:"major", stringSetId:"strings-1-2-3", tuning:[4,11,7,2,9,4]};
  const env = setup({version:3, entries:[{...base, capo:12}, {...base, capo:2}, {...base, capo:13}, {...base, capo:-1}, {...base, capo:1.5}]}), {byId} = env;
  assert.equal(byId("scale-recent-settings").children.length, 2);
  assert.match(byId("scalar-tuning-toggle").textContent, /Capo 12/);
  assert.equal(byId("scale-fretboard").children[6].children.at(-1).textContent, "12", "relative fret 12 is physical fret 24");
  for (const strip of byId("triad-list").querySelectorAll(".triad-strip")) {
    assert.ok(Number(strip.children[3].children.at(-1).textContent) <= 12);
  }
  change(byId("scale-recent-settings"), "1");
  assert.match(byId("scalar-tuning-toggle").textContent, /Capo 2/);
  assert.deepEqual(saved(env).entries.map(entry => entry.capo), [2,12]);
  byId("scalar-tuning-toggle").click(); env.control("capo-5").click();
  env.control("string-0").click();
  byId("scale-recent-settings").focus();
  change(byId("scale-recent-settings"), "1");
  assert.equal(env.document.activeElement, byId("scale-recent-settings"), "history restoration keeps keyboard focus on its select");
  assert.equal(byId("scalar-tuning-panel").hidden, true, "history restore discards pending settings");
  assert.match(byId("scalar-tuning-toggle").textContent, /Capo 12/);
});

const mockShapes = () => Array.from({length:8}, () => ({frets:[0,2,2,2,0,null], position:2, span:0, mutedCount:1}));
const mockResult = () => ({shapes:mockShapes(), cancelled:false});
const deferredVoicings = () => {
  const requests = [];
  return {requests, findVoicings(interpretation, settings, options) {
    return new Promise((resolve, reject) => requests.push({interpretation, settings, options, resolve, reject}));
  }};
};

test("Scalar style switch preserves musical settings and restores the triad string set", async () => {
  const env = setup(null, false, async () => mockResult()), {byId} = env;
  assert.equal(env.style("triads").getAttribute("aria-pressed"), "true");
  change(byId("scale-root"), "D");
  change(byId("scale-type"), "dorian");
  byId("string-set-selector").children[3].click();
  byId("scalar-tuning-toggle").click();
  env.control("preset-drop-d").click(); env.control("capo-2").click();
  byId("scalar-tuning-apply").click();
  const notes = byId("scale-notes").textContent, summary = byId("chord-summary").textContent;
  env.style("fuller").click();
  assert.equal(env.style("fuller").getAttribute("aria-pressed"), "true");
  assert.equal(env.style("triads").getAttribute("aria-pressed"), "false");
  assert.equal(byId("string-set-selector").hidden, true);
  await env.settle();
  assert.equal(byId("result-title").textContent, "D Dorian");
  assert.equal(byId("scale-notes").textContent, notes);
  assert.equal(byId("chord-summary").textContent, summary);
  assert.match(byId("scalar-tuning-toggle").textContent, /Drop D tuning.*Capo 2/);
  assert.equal(saved(env).entries[0].fingeringStyle, "fuller");
  assert.equal(saved(env).entries[0].stringSetId, "strings-4-5-6");
  env.style("triads").click();
  assert.equal(byId("string-set-selector").hidden, false);
  assert.equal(byId("string-set-selector").children[3].getAttribute("aria-pressed"), "true");
  assert.ok(byId("triad-list").querySelectorAll(".triad-strip").length);
  assert.equal(byId("triad-list").querySelectorAll(".fuller-fingering").length, 0);
});

test("Scalar history migrates triad defaults and distinguishes/restores fuller settings", async () => {
  const base = {root:"C", scaleId:"major", stringSetId:"strings-4-5-6", tuning:[4,11,7,2,9,4], capo:2};
  const legacy = setup({version:3, entries:[base]});
  assert.equal(legacy.style("triads").getAttribute("aria-pressed"), "true");
  assert.equal(saved(legacy).version, 4);
  assert.equal(saved(legacy).entries[0].fingeringStyle, "triads");

  const env = setup({version:4, entries:[{...base, fingeringStyle:"fuller"}, {...base, fingeringStyle:"triads"}]}, false, async () => mockResult());
  assert.equal(env.style("fuller").getAttribute("aria-pressed"), "true");
  assert.equal(env.byId("string-set-selector").hidden, true);
  assert.equal(env.byId("scale-recent-settings").children.length, 2);
  await env.settle();
  assert.ok(env.byId("triad-list").querySelectorAll(".fuller-fingering").length);
  change(env.byId("scale-recent-settings"), "1");
  assert.equal(env.style("triads").getAttribute("aria-pressed"), "true");
  assert.equal(env.byId("string-set-selector").hidden, false);
  assert.equal(env.byId("string-set-selector").children[3].getAttribute("aria-pressed"), "true");
  assert.deepEqual(saved(env).entries.map(entry => entry.fingeringStyle), ["triads", "fuller"]);
  change(env.byId("scale-recent-settings"), "1");
  assert.equal(env.style("fuller").getAttribute("aria-pressed"), "true");
});

test("Scalar fuller diagrams reveal four then eight shapes without moving focus", async () => {
  const env = setup(null, false, async () => mockResult());
  env.style("fuller").click();
  assert.match(env.byId("triad-list").querySelector(".fuller-status").textContent, /Finding fuller fingerings/);
  await env.settle();
  const card = env.byId("triad-list").children[0], button = card.querySelector(".fuller-more");
  const visible = () => card.querySelectorAll(".fuller-fingering").filter(node => !node.hidden);
  assert.equal(visible().length, 4);
  const first = visible()[0];
  assert.equal(first.querySelector(".fuller-strip").querySelectorAll(".fretboard-row").length, 6);
  assert.match(first.querySelector(".fuller-strip").getAttribute("aria-label"), /String 1: open, E/);
  assert.match(first.querySelector(".fuller-strip").getAttribute("aria-label"), /String 6: muted/);
  assert.equal(first.querySelector(".fuller-shape-code").textContent, "× · 0 · 2 · 2 · 2 · 0");
  button.focus(); button.click();
  assert.equal(visible().length, 8);
  assert.equal(visible()[0], first);
  assert.equal(button.textContent, "Show fewer");
  assert.equal(button.getAttribute("aria-expanded"), "true");
  assert.equal(env.document.activeElement, button);
  button.click();
  assert.equal(visible().length, 4);
  assert.equal(button.textContent, "Show more");
  assert.equal(button.getAttribute("aria-expanded"), "false");
  assert.equal(env.document.activeElement, button);
});

test("Scalar fuller search keeps exact chord notes across tuning and capo changes", async () => {
  const env = setup(), {byId} = env;
  env.style("fuller").click();
  await env.settle();
  const initialShapes = byId("triad-list").children[0].querySelectorAll(".fuller-fingering");
  assert.ok(initialShapes.some(shape => shape.getAttribute("data-frets") === "[0,2,2,2,0,null]"), "familiar open A appears in the first shapes");

  byId("scalar-tuning-toggle").click(); env.control("preset-drop-d").click(); env.control("capo-12").click();
  byId("scalar-tuning-apply").click();
  await env.settle();
  const tuning = [4,11,7,2,9,2], expected = [[9,1,4], [11,2,6], [1,4,8], [2,6,9], [4,8,11], [6,9,1], [8,11,2]];
  let shapeCount = 0;
  byId("triad-list").children.forEach((card, degree) => {
    const shapes = card.querySelectorAll(".fuller-fingering");
    assert.ok(shapes.length, "each diatonic chord has playable fuller shapes");
    shapes.forEach(shape => {
      shapeCount += 1;
      const frets = JSON.parse(shape.getAttribute("data-frets"));
      assert.equal(frets.length, 6);
      const sounding = frets.flatMap((fret, string) => fret === null ? [] : [(tuning[string] + 12 + fret) % 12]);
      assert.ok(sounding.length >= 4 && sounding.length <= 6);
      assert.ok(frets.every(fret => fret === null || (fret >= 0 && fret <= 12)), "relative frets stay below physical fret 24");
      assert.deepEqual([...new Set(sounding)].sort((a,b) => a-b), expected[degree].slice().sort((a,b) => a-b));
    });
  });
  assert.ok(shapeCount >= 7, "all diatonic chord searches produce results for the playable setup");
});

test("Scalar rejects stale fuller results after changing root or returning to triads", async () => {
  const mock = deferredVoicings(), env = setup(null, false, mock.findVoicings);
  env.style("fuller").click();
  await env.settle();
  const stale = mock.requests.slice();
  assert.equal(stale.length, 7);
  change(env.byId("scale-root"), "C");
  await env.settle();
  const current = mock.requests.slice(7);
  assert.equal(current.length, 7);
  assert.ok(stale.every(request => request.options.signal.aborted));
  current.forEach(request => request.resolve({shapes:[], cancelled:false}));
  await env.settle();
  stale.forEach(request => request.resolve(mockResult()));
  await env.settle();
  assert.equal(env.byId("result-title").textContent, "C Major / Ionian");
  assert.equal(env.byId("triad-list").querySelectorAll(".fuller-fingering").length, 0);
  assert.match(env.byId("triad-list").textContent, /No fuller fingerings found for this guitar setup/);
  change(env.byId("scale-root"), "D");
  await env.settle();
  const abandoned = mock.requests.slice(14);
  env.style("triads").click();
  const triadText = env.byId("triad-list").textContent;
  assert.ok(abandoned.every(request => request.options.signal.aborted));
  abandoned.forEach(request => request.resolve(mockResult()));
  await env.settle();
  assert.equal(env.byId("triad-list").textContent, triadText);
  assert.equal(env.byId("triad-list").querySelectorAll(".fuller-fingering").length, 0);
});

test("Scalar fuller empty and failed searches give useful feedback and allow retry", async () => {
  let fail = true;
  const env = setup(null, false, async interpretation => {
    if (interpretation.rootPc === 9 && fail) throw new Error("Search failed");
    return {shapes:[], cancelled:false};
  });
  env.style("fuller").click();
  await env.settle();
  const first = env.byId("triad-list").children[0], second = env.byId("triad-list").children[1];
  assert.match(first.textContent, /Fuller fingerings could not be loaded/);
  assert.match(second.textContent, /No fuller fingerings found for this guitar setup/);
  assert.equal(first.querySelector(".fuller-more"), null);
  assert.equal(second.querySelector(".fuller-more"), null);
  const retry = first.querySelectorAll("button").find(button => button.textContent === "Try again");
  assert.ok(retry);
  fail = false; retry.click();
  await env.settle();
  assert.doesNotMatch(env.byId("triad-list").textContent, /could not be loaded/);
  assert.match(env.byId("triad-list").children[0].textContent, /No fuller fingerings found for this guitar setup/);
});

test("Scalar fuller pentatonic shapes repeat the displayed three notes without substituting a named chord", async () => {
  const env = setup();
  change(env.byId("scale-type"), "major-pentatonic");
  env.style("fuller").click();
  await env.settle();
  const expected = [[9,1,6], [11,4,9], [1,6,11], [4,9,1], [6,11,4]], tuning = [4,11,7,2,9,4];
  assert.equal(env.byId("triad-list").children.length, 5);
  env.byId("triad-list").children.forEach((card, degree) => {
    const shapes = card.querySelectorAll(".fuller-fingering");
    assert.ok(shapes.length, "each displayed pentatonic triad can be voiced");
    shapes.forEach(shape => {
      const frets = JSON.parse(shape.getAttribute("data-frets"));
      const pitches = frets.flatMap((fret, index) => fret === null ? [] : [(tuning[index] + fret) % 12]);
      assert.ok(pitches.length >= 4);
      assert.deepEqual([...new Set(pitches)].sort((a,b) => a-b), expected[degree].slice().sort((a,b) => a-b));
    });
  });
});
