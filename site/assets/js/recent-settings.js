(function (window, document) {
  "use strict";

  function create(options) {
    var entries = [];
    var pendingSaveTimer = null;

    function persist() {
      try {
        window.localStorage.setItem(options.key, JSON.stringify({ version: options.version, entries: entries }));
      } catch (err) {
        // Storage is optional, including in private browsing contexts.
      }
    }

    function normalizeAll(payload) {
      if (!payload || !Array.isArray(payload.entries)) {
        return [];
      }
      return payload.entries.reduce(function (validEntries, candidate) {
        var normalized = options.normalize(candidate, payload.version);
        if (normalized && !validEntries.some(function (entry) { return options.matches(entry, normalized); })) {
          validEntries.push(normalized);
        }
        return validEntries;
      }, []).slice(0, options.limit);
    }

    function render() {
      if (options.onChange) {
        options.onChange(entries);
      }
    }

    function save(snapshot) {
      entries = [snapshot].concat(entries.filter(function (entry) {
        return !options.matches(entry, snapshot);
      })).slice(0, options.limit);
      persist();
      render();
    }

    function flush() {
      if (pendingSaveTimer === null) {
        return;
      }
      window.clearTimeout(pendingSaveTimer);
      pendingSaveTimer = null;
      save(options.snapshot());
    }

    function schedule() {
      if (pendingSaveTimer !== null) {
        window.clearTimeout(pendingSaveTimer);
      }
      pendingSaveTimer = window.setTimeout(function () {
        pendingSaveTimer = null;
        save(options.snapshot());
      }, options.delay);
    }

    function cancel() {
      if (pendingSaveTimer !== null) {
        window.clearTimeout(pendingSaveTimer);
        pendingSaveTimer = null;
      }
    }

    function load() {
      try {
        var stored = window.localStorage.getItem(options.key);
        var payload = stored ? JSON.parse(stored) : null;
        entries = normalizeAll(payload);
        if (payload && Array.isArray(payload.entries) && payload.version !== options.version) {
          persist();
        }
      } catch (err) {
        entries = [];
      }
      render();
      return entries;
    }

    function clear() {
      cancel();
      entries = [];
      try {
        window.localStorage.removeItem(options.key);
      } catch (err) {
        // Storage is optional, including in private browsing contexts.
      }
      render();
    }

    window.addEventListener("pagehide", flush);
    document.addEventListener("visibilitychange", function () {
      if (document.visibilityState === "hidden") {
        flush();
      }
    });

    return {
      load: load,
      save: function () { save(options.snapshot()); },
      schedule: schedule,
      flush: flush,
      cancel: cancel,
      clear: clear,
      entries: function () { return entries; }
    };
  }

  window.RecentSettings = { create: create };
}(window, document));
