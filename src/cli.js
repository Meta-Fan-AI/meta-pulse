import { parseArgs } from 'node:util';
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { DEFAULT_FEED, fetchFeed, parseRss } from './feed.js';
import { draftFilename, isoDay, renderDraft } from './draft.js';

export const HELP = `meta-pulse — turn Meta Newsroom articles into sourced post drafts.
Unofficial fan project, not affiliated with Meta. Drafts only; nothing is published.

Usage: meta-pulse [options]

Options:
  --limit <n>     Number of newest articles to draft (default 5)
  --since <date>  Only articles published on or after YYYY-MM-DD
  --out <dir>     Output folder (default ./drafts/<today>)
  --start <n>     Number for the first draft (default 1)
  --stdout        Print drafts instead of writing files
  --force         Overwrite existing draft files (default: skip them)
  --feed <url>    RSS feed URL (default ${DEFAULT_FEED})
  --file <path>   Read the RSS feed from a local file instead of the network
  -h, --help      Show this help
`;

export async function run(argv, { now = new Date(), fetchImpl = fetch, log = console.log, warn = console.error } = {}) {
  const { values } = parseArgs({
    args: argv,
    options: {
      limit: { type: 'string', default: '5' },
      since: { type: 'string' },
      out: { type: 'string' },
      start: { type: 'string', default: '1' },
      stdout: { type: 'boolean', default: false },
      force: { type: 'boolean', default: false },
      feed: { type: 'string', default: DEFAULT_FEED },
      file: { type: 'string' },
      help: { type: 'boolean', short: 'h', default: false },
    },
  });

  if (values.help) {
    log(HELP);
    return 0;
  }

  const limit = Number.parseInt(values.limit, 10);
  const start = Number.parseInt(values.start, 10);
  if (!Number.isInteger(limit) || limit < 1) throw new Error('--limit must be a positive integer');
  if (!Number.isInteger(start) || start < 1) throw new Error('--start must be a positive integer');
  if (values.since && !/^\d{4}-\d{2}-\d{2}$/.test(values.since)) throw new Error('--since must look like YYYY-MM-DD');

  const xml = values.file ? await readFile(values.file, 'utf8') : await fetchFeed(values.feed, { fetchImpl });
  let items = parseRss(xml);
  if (values.since) items = items.filter((i) => i.published && isoDay(i.published) >= values.since);
  items = items.slice(0, limit);

  if (items.length === 0) {
    warn('No articles matched.');
    return 0;
  }

  const day = isoDay(now);
  const drafts = items.map((item, index) => {
    const number = start + index;
    return { name: draftFilename(item, number), body: renderDraft(item, { number, day }) };
  });

  if (values.stdout) {
    log(drafts.map((d) => d.body).join('\n---\n\n'));
    return 0;
  }

  const outDir = values.out ?? join('drafts', day);
  await mkdir(outDir, { recursive: true });
  let written = 0;
  for (const draft of drafts) {
    try {
      await writeFile(join(outDir, draft.name), draft.body, { flag: values.force ? 'w' : 'wx' });
      written += 1;
      log(`wrote ${join(outDir, draft.name)}`);
    } catch (error) {
      if (error.code !== 'EEXIST') throw error;
      log(`skipped ${join(outDir, draft.name)} (exists; use --force to overwrite)`);
    }
  }
  log(`${written} draft(s) written to ${outDir}. Review and edit before posting.`);
  return 0;
}
