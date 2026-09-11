(function (root, factory) {
  "use strict";
  if (typeof module === "object" && module.exports) { module.exports = factory(); }
  else { root.SongNotebookContracts = factory(); }
}(typeof globalThis !== "undefined" ? globalThis : this, function () {
  "use strict";
  function freeze(value) {
    Object.keys(value).forEach(function (key) {
      if (value[key] && typeof value[key] === "object") { freeze(value[key]); }
    });
    return Object.freeze(value);
  }
  return freeze({
    revision: 1,
    libraryKey: "cs-shadow.guitar-chordinator.library.v1",
    draftsKey: "cs-shadow.guitar-chordinator.drafts.v1",
    fingeringStyleKey: "cs-shadow.guitar-chordinator.fingering-style.v1",
    legacyKey: "cs-shadow.guitar-chordinator.recent-settings.v1",
    exportFormat: "cs-shadow.guitar-chordinator.song",
    version: 1,
    defaultTuning: [64, 59, 55, 50, 45, 40],
    hosts: {
      compose: { collection: "notebook-collection", sections: "notebook-sections", arrangement: "notebook-arrangement" },
      editor: { root: "notebook-editor" },
      explore: { root: "notebook-explore" },
      reading: { root: "notebook-reading" }
    },
    componentNames: ["Compose", "Editor", "Explore", "Reading"],
    scriptOrder: ["guitar-tuning", "recent-settings", "song-notebook/contracts", "song-notebook/music", "song-notebook/model", "song-notebook/storage", "song-notebook/compose", "song-notebook/editor", "song-notebook/explore", "song-notebook/reading", "guitar-chordinator"],
    exploreDefaults: { tab: "browse", tonicPc: 0, tonicSpelling: "C", scaleId: "major", selectedInterpretation: null, selectedFrets: null, voicingMode: "compact" }
  });
}));
