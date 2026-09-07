# Song notebook verification log

## Wave 0 — contract and staged baseline

Integration: `/private/tmp/guitar-song-notebook`, branch
`feature/guitar-song-notebook`. Original plan baseline: `991a47e`.

- Node: 3 contract/fixture/asset tests passed (local Node 26.8.1; CI uses Node 22).
- Ruby serve: 4 tests, 15 assertions; Goodreads: 10 tests, 28 assertions;
  site rendering: 3 tests, 32 assertions; all passed.
- Production and preview Jekyll builds passed; 48 preserved URLs, internal local
  links, preview noindex and whitespace checks passed. External links are outside
  the repository link check, as before.
- Existing Chordinator remains active; notebook hosts stay hidden and all linked
  assets exist. No worker module or new dependency is loaded prematurely.
- `scripts/serve` printed `http://127.0.0.1:4000/`; live output is `_site_live`.
- In-app browser setup failed with `Browser is not available: iab`; documented
  discovery returned an empty browser list. Browser interaction QA is pending a
  browser connection, not claimed as passed.
- Independently reviewed contracts clarify incomplete draft persistence, absolute
  PC interpretation evidence, slash bass/span rules, and Explore preview state.

The installed system Ruby is too old for locked Bundler. Existing Homebrew
portable Ruby and a temporary gem directory run the unchanged lockfile:

```sh
export PATH=/private/tmp/guitar-notebook-gems/bin:/opt/homebrew/Library/Homebrew/vendor/portable-ruby/3.4.4/bin:$PATH
export GEM_HOME=/private/tmp/guitar-notebook-gems
export GEM_PATH=/private/tmp/guitar-notebook-gems
JEKYLL_PREVIEW_COMMAND='bundle exec jekyll serve --source "$PREVIEW_WORKTREE/site" --destination "$PREVIEW_WORKTREE/_site_live" --host 127.0.0.1 --port "$PREVIEW_PORT"' scripts/serve
```

Preview launch and serve tests require access to localhost sockets outside this
session's sandbox. Start worker previews from their assigned worktree using the
same environment; scripts/serve chooses the available port. No global Ruby,
Gemfile or lockfile changes were made.
