"use strict";
const test = require("node:test"), assert = require("node:assert/strict");
const fs = require("node:fs"), path = require("node:path"), vm = require("node:vm");
const {documentFixture} = require("./dom-fixture.cjs");
const root = path.resolve(__dirname, "../.."), key = "cs-shadow.scalar-triads.recent-settings.v1";

function setup(payload, storageUnavailable = false) {
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
  const context = {document, console, setTimeout: fn => {timers.set(++timerId, fn); return timerId;}, clearTimeout: id => timers.delete(id), addEventListener() {}, localStorage: {
    getItem(name) {if(storageUnavailable) throw new Error("Storage unavailable"); return storage.get(name) || null;},
    setItem(name, value) {if(storageUnavailable) throw new Error("Storage unavailable"); storage.set(name, value);},
    removeItem(name) {if(storageUnavailable) throw new Error("Storage unavailable"); storage.delete(name);}
  }};
  context.window = context;
  for (const script of html.matchAll(/<script src="([^"]+)"/g)) vm.runInNewContext(fs.readFileSync(path.join(root, "site", script[1]), "utf8"), context);
  const byId = id => document.getElementById(id), control = name => document.querySelector('[data-tuning-key="' + name + '"]');
  return {document, byId, control, storage, flush() { const pending = [...timers.values()]; timers.clear(); pending.forEach(fn => fn()); }};
}
const change = (element, value) => { element.value = value; element.dispatchEvent({type:"change", bubbles:true}); };
const saved = env => JSON.parse(env.storage.get(key));

test("Scalar renders the preserved musical results and changes tuning immediately", () => {
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
  assert.match(byId("scalar-tuning-toggle").textContent, /^Custom tuning/);
  assert.equal(byId("scale-fretboard").children[0].children[0].textContent, "C");
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
  assert.equal(control("preset-drop-d").getAttribute("aria-pressed"), "true");
  assert.equal(byId("string-set-selector").children[3].getAttribute("aria-pressed"), "true");
  change(byId("scale-recent-settings"), "1");
  assert.equal(byId("result-title").textContent, "D Dorian");
  assert.match(control("string-0").getAttribute("aria-label"), /String 1, C,/);
  assert.deepEqual(saved(env).entries[0], entries[1]);
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
  env.control("preset-open-g").click(); env.flush();
  assert.equal(env.byId("scale-error").textContent, "");
  assert.match(env.byId("scale-tuning-description").textContent, /^Open G tuning/);
});
