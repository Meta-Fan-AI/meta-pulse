# AGENTS.md — meta-pulse

Unofficial fan project, not affiliated with Meta. Keep that line in the README and in generated drafts.

## What this repo is
A zero-dependency Node.js (ESM, Node 20+) CLI that reads the Meta Newsroom RSS feed and writes markdown post drafts.

## Layout
- `bin/meta-pulse.js` — entry point, only calls `run`.
- `src/cli.js` — option parsing, file writing (`run` is exported and injectable for tests).
- `src/feed.js` — one polite fetch, RSS parsing, entity/HTML cleanup.
- `src/draft.js` — slug, filename, and draft template.
- `test/` — `node --test`; fixtures in `test/fixtures/`.

## Commands
- `npm test` — must pass before any change is considered done.
- `node bin/meta-pulse.js --file test/fixtures/sample-feed.xml --stdout` — offline smoke test.

## Rules
- No runtime dependencies. If you must add one, say why in the PR.
- Tests never touch the network. Inject `fetchImpl`, or use `--file` with a fixture.
- Never auto-publish and never overwrite existing drafts without `--force`.
- Do not invent facts in drafts. Only use data present in the feed.
- Keep the User-Agent identifying this as an unofficial fan project, and keep to one request per run.
- Plain text fields (title, category) are not HTML; do not pass them through `htmlToText`.
