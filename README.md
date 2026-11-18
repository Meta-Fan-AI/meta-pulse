# meta-pulse

Turn Meta Newsroom articles into sourced post drafts. One command, zero dependencies.

> Unofficial fan project, not affiliated with Meta.

- **Date**: 2026-11-18 (Meta-Fan-AI product #1)
- **Who it helps**: anyone who writes about Meta news and wants fast, source-checked drafts
- **How it works**: reads the public Meta Newsroom RSS feed (`https://about.fb.com/news/feed/`, allowed by the site's robots.txt), and writes one markdown draft per article with the headline, date, source link, tags and the article's own summary. You write the opinion.

## Run it

Requires Node.js 20 or newer. No install step.

```bash
node bin/meta-pulse.js --limit 3
```

Drafts are written to `./drafts/<today>/`. Examples:

```bash
node bin/meta-pulse.js --since 2026-11-10 --out ../../posts/2026-11-19 --start 11
node bin/meta-pulse.js --limit 1 --stdout
node bin/meta-pulse.js --file test/fixtures/sample-feed.xml --stdout   # offline
```

Options: `--limit`, `--since YYYY-MM-DD`, `--out`, `--start`, `--stdout`, `--force`, `--feed`, `--file`, `--help`.

## What a draft looks like

```
# Post 01 — <headline>

Day: 2026-11-18 · Type: Meta news + opinion · Status: draft · Best on: LinkedIn, X, Threads

Source: <article link> (Meta Newsroom, published 2026-11-17)
Tags: AI, Muse

## Text
<HOOK ...>
What happened: <the article's own summary>
Why it matters: <TODO>
My take: <TODO>
<QUESTION for readers>
```

## Design choices

- **Drafts only.** It never posts anything. Placeholders (`<TODO>`) force a human to add the take.
- **No invented facts.** Only the headline, date, tags and the feed's summary are used.
- **Never overwrites your edits.** Existing files are skipped unless you pass `--force`.
- **Polite.** One request per run, identified with a `meta-pulse (unofficial fan project)` User-Agent, 15s timeout.

## Test

```bash
npm test
```

## Next steps

- Fetch the full article text to propose a better summary.
- Support Meta Engineering and developer changelog feeds.
- Add a `--lang` option for the regional Newsroom feeds.

## License

MIT — see [LICENSE](LICENSE).
