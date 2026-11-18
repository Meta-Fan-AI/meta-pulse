import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile, readdir, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { decodeEntities, fetchFeed, parseRss } from '../src/feed.js';
import { draftFilename, renderDraft, slugify } from '../src/draft.js';
import { run } from '../src/cli.js';

const here = dirname(fileURLToPath(import.meta.url));
const fixture = join(here, 'fixtures', 'sample-feed.xml');
const NOW = new Date('2026-11-18T12:00:00Z');

async function loadItems() {
  return parseRss(await readFile(fixture, 'utf8'));
}

test('decodeEntities handles named and numeric entities', () => {
  assert.equal(decodeEntities('a &amp; b &#8217;s &#x41;'), 'a & b ’s A');
  assert.equal(decodeEntities('&unknown;'), '&unknown;');
});

test('parseRss reads title, link, date, categories and summary; skips items without a title', async () => {
  const items = await loadItems();
  assert.equal(items.length, 3);
  const [first, second] = items;
  assert.match(first.title, /^Muse Is Now Available in Australia/);
  assert.equal(first.link, 'https://about.fb.com/news/2026/11/muse-is-now-available-in-australia/');
  assert.equal(first.published.toISOString(), '2026-11-17T18:00:31.000Z');
  assert.deepEqual(first.categories, ['APAC Newsroom', 'AI']);
  assert.equal(
    first.summary,
    'Muse is available in Australia from today, with local connector experiences rolling out progressively.',
  );
  assert.equal(second.title, 'Sample Item & Entities: “Quotes” <Here>');
  assert.equal(second.summary, 'Synthetic test item with markup and & entities.');
});

test('slugify makes safe short filenames', () => {
  assert.equal(slugify('Muse Is Now Available in Australia: The World’s First…'), 'muse-is-now-available-in-australia-the-world-s-fir');
  assert.equal(slugify('Short title'), 'short-title');
  assert.equal(slugify('Café déjà vu'), 'cafe-deja-vu');
  assert.equal(slugify('!!!'), 'untitled');
  assert.ok(slugify('x'.repeat(200)).length <= 50);
});

test('renderDraft includes source, date, placeholders, and the disclaimer', async () => {
  const [item] = await loadItems();
  const draft = renderDraft(item, { number: 3, day: '2026-11-18' });
  assert.match(draft, /^# Post 03 — Muse Is Now Available/);
  assert.match(draft, /Day: 2026-11-18 · Type: Meta news \+ opinion · Status: draft/);
  assert.match(draft, /Source: https:\/\/about\.fb\.com\/news\/2026\/11\/muse-is-now-available-in-australia\/ \(Meta Newsroom, published 2026-11-17\)/);
  assert.match(draft, /What happened: Muse is available in Australia/);
  assert.match(draft, /<TODO/);
  assert.match(draft, /Unofficial fan project, not affiliated with Meta\./);
  assert.equal(draftFilename(item, 3).slice(0, 14), '03-muse-is-now');
});

test('run writes numbered drafts and never overwrites existing files without --force', async () => {
  const out = await mkdtemp(join(tmpdir(), 'meta-pulse-'));
  const logs = [];
  const log = (m) => logs.push(m);
  await run(['--file', fixture, '--out', out, '--limit', '2', '--start', '4'], { now: NOW, log });
  const files = (await readdir(out)).sort();
  assert.equal(files.length, 2);
  assert.match(files[0], /^04-muse-is-now-available/);
  assert.match(files[1], /^05-sample-item-entities/);

  // Hand-edit a draft, run again: the edit must survive.
  const edited = join(out, files[0]);
  await writeFile(edited, 'MY EDITS');
  await run(['--file', fixture, '--out', out, '--limit', '2', '--start', '4'], { now: NOW, log });
  assert.equal(await readFile(edited, 'utf8'), 'MY EDITS');
  assert.ok(logs.some((l) => l.startsWith('skipped')));

  await run(['--file', fixture, '--out', out, '--limit', '2', '--start', '4', '--force'], { now: NOW, log });
  assert.match(await readFile(edited, 'utf8'), /^# Post 04/);
});

test('run filters with --since and prints with --stdout', async () => {
  const out = [];
  await run(['--file', fixture, '--since', '2026-11-10', '--stdout'], { now: NOW, log: (m) => out.push(m) });
  assert.equal(out.length, 1);
  assert.match(out[0], /Muse Is Now Available/);
  assert.doesNotMatch(out[0], /Old Sample Item/);
});

test('run rejects bad options', async () => {
  await assert.rejects(run(['--file', fixture, '--limit', '0']), /--limit/);
  await assert.rejects(run(['--file', fixture, '--since', 'yesterday']), /--since/);
});

test('fetchFeed sends an identifying User-Agent and fails on HTTP errors', async () => {
  let seen;
  const ok = async (url, options) => {
    seen = { url, options };
    return { ok: true, status: 200, text: async () => '<rss/>' };
  };
  assert.equal(await fetchFeed('https://example.test/feed', { fetchImpl: ok }), '<rss/>');
  assert.match(seen.options.headers['User-Agent'], /unofficial fan project/);
  const bad = async () => ({ ok: false, status: 503, text: async () => '' });
  await assert.rejects(fetchFeed('https://example.test/feed', { fetchImpl: bad }), /HTTP 503/);
});
