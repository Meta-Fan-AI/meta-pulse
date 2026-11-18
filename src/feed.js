// Fetching and parsing the Meta Newsroom RSS feed. No dependencies.

export const DEFAULT_FEED = 'https://about.fb.com/news/feed/';
export const USER_AGENT = 'meta-pulse/0.1 (unofficial fan project)';

const ENTITIES = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'", nbsp: ' ' };

export function decodeEntities(text) {
  return text.replace(/&(#x?[0-9a-fA-F]+|[a-zA-Z]+);/g, (match, entity) => {
    if (entity[0] === '#') {
      const hex = entity[1] === 'x' || entity[1] === 'X';
      const code = parseInt(entity.slice(hex ? 2 : 1), hex ? 16 : 10);
      return Number.isFinite(code) && code > 0 && code <= 0x10ffff
        ? String.fromCodePoint(code)
        : match;
    }
    return ENTITIES[entity] ?? match;
  });
}

export function htmlToText(html) {
  return decodeEntities(html.replace(/<[^>]*>/g, ' ')).replace(/\s+/g, ' ').trim();
}

// Returns the raw inner text of a tag, with CDATA unwrapped (CDATA stays raw, plain text is entity-decoded).
function unwrap(raw) {
  const cdata = raw.match(/^\s*<!\[CDATA\[([\s\S]*?)\]\]>\s*$/);
  return cdata ? cdata[1] : decodeEntities(raw.trim());
}

function firstTag(block, name) {
  const match = block.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`));
  return match ? unwrap(match[1]) : '';
}

// Titles and categories are plain text, not HTML: only collapse whitespace.
// (Running them through htmlToText would strip escaped text like "&lt;Here&gt;".)
function plainText(text) {
  return text.replace(/\s+/g, ' ').trim();
}

function allTags(block, name) {
  return [...block.matchAll(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'g'))].map(
    (m) => plainText(unwrap(m[1])),
  );
}

function summarize(descriptionHtml) {
  const paragraphs = [...descriptionHtml.matchAll(/<p>([\s\S]*?)<\/p>/g)]
    .map((m) => htmlToText(m[1]))
    .filter((p) => p && !/appeared first on/i.test(p));
  return paragraphs[0] ?? htmlToText(descriptionHtml);
}

export function parseRss(xml) {
  const items = [];
  for (const match of xml.matchAll(/<item>([\s\S]*?)<\/item>/g)) {
    const block = match[1];
    const title = plainText(firstTag(block, 'title'));
    const link = firstTag(block, 'link').trim();
    if (!title || !link) continue;
    const published = new Date(firstTag(block, 'pubDate'));
    items.push({
      title,
      link,
      published: Number.isNaN(published.getTime()) ? null : published,
      categories: allTags(block, 'category'),
      summary: summarize(firstTag(block, 'description')),
    });
  }
  return items;
}

export async function fetchFeed(url = DEFAULT_FEED, { fetchImpl = fetch, timeoutMs = 15000 } = {}) {
  // One polite request, identified as a fan project.
  const response = await fetchImpl(url, {
    headers: { 'User-Agent': USER_AGENT, Accept: 'application/rss+xml, application/xml' },
    signal: AbortSignal.timeout(timeoutMs),
  });
  if (!response.ok) throw new Error(`Feed request failed: HTTP ${response.status}`);
  return response.text();
}
