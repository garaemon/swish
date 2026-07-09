// Polite-bot UA so site operators can identify Swish in their logs and
// rate-limit / contact us if needed. Bump the version when scraping
// behavior changes meaningfully.
const USER_AGENT =
  'Mozilla/5.0 (compatible; SwishBot/0.1; +https://github.com/garaemon/swish)';

export type ScrapeResult = {
  title: string | null
  content: string
  excerpt: string | null
}

/**
 * Result of a Cloudflare Workers AI `toMarkdown` conversion. Only the fields
 * Swish reads are modelled; `data` holds the markdown when `format` is
 * `'markdown'`.
 */
export type MarkdownConversionResult = {
  format: string
  data?: string
}

/**
 * The subset of the Cloudflare Workers AI binding (`env.AI`) that the scrape
 * pipeline depends on. Injected so the pipeline stays testable without a live
 * Worker runtime.
 */
export type MarkdownConverter = {
  toMarkdown(file: { name: string; blob: Blob }): Promise<MarkdownConversionResult>
}

/**
 * Fetches the URL and converts the response body to Markdown via the injected
 * Cloudflare converter. Throws if the URL cannot be fetched or conversion
 * fails.
 */
export async function scrapeUrl(
  url: string,
  converter: MarkdownConverter,
): Promise<ScrapeResult> {
  const html = await fetchHtml(url);
  return convertHtmlToMarkdown(url, html, converter);
}

/**
 * Converts a known HTML string to a ScrapeResult using the Cloudflare
 * converter. Separated from fetching for testability with fixture inputs.
 *
 * Unlike the previous Readability-based extractor, Cloudflare's conversion
 * renders the whole page, so the markdown may include navigation/footer text;
 * the summarization step downstream is responsible for tolerating that noise.
 * If summary quality needs tuning, pass `toMarkdown` HTML conversionOptions
 * with a CSS selector to target the main content region.
 */
export async function convertHtmlToMarkdown(
  url: string,
  html: string,
  converter: MarkdownConverter,
): Promise<ScrapeResult> {
  const conversion = await converter.toMarkdown({
    name: fileNameForUrl(url),
    blob: new Blob([stripScriptAndStyle(html)], { type: 'text/html' }),
  });
  if (conversion.format !== 'markdown' || !conversion.data) {
    throw new Error('Cloudflare Markdown conversion could not extract content from the page');
  }
  const content = stripLeadingFrontmatter(conversion.data.trim());
  return {
    title: extractTitle(html, content),
    content,
    excerpt: extractExcerpt(content),
  };
}

/**
 * Removes `<script>` and `<style>` blocks from HTML before conversion.
 * Cloudflare's `toMarkdown` renders the whole page, and pages commonly embed
 * JSON-LD structured data in a `<script type="application/ld+json">` tag; left
 * in place it surfaces as a trailing ```json code block in the article. This
 * also drops inline scripts/styles that would otherwise become noise.
 *
 * A regex is adequate because the output is fed straight into `toMarkdown`, not
 * re-served as HTML — we only need to blank out tag contents, not produce a
 * security-sanitised document. `<title>` extraction still runs on the raw HTML.
 */
export function stripScriptAndStyle(html: string): string {
  return html
    .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, '')
    .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, '');
}

/**
 * Removes a leading YAML frontmatter block (`---` fence, body, closing `---`
 * fence) when the document opens with one. Cloudflare's whole-page `toMarkdown`
 * conversion sometimes surfaces the page's frontmatter as literal text at the
 * top of the article; left in place it pollutes the stored content, becomes the
 * derived excerpt, and adds noise to the summary input.
 *
 * Only a block at the very start is stripped. A `---` appearing later (a
 * thematic break or table rule) is untouched. The opening fence must be the
 * first line, so it cannot be a setext heading underline. The trade-off: a
 * document that legitimately opens with a thematic break AND contains a later
 * `---` line would have the span between them removed — rare enough to accept
 * for a whole-page conversion whose leading `---` is almost always frontmatter.
 */
export function stripLeadingFrontmatter(markdown: string): string {
  const match = markdown.match(/^---[ \t]*\r?\n[\s\S]*?\r?\n---[ \t]*(?:\r?\n|$)/);
  if (!match) {
    return markdown;
  }
  return markdown.slice(match[0].length).trimStart();
}

const EXCERPT_MAX_LENGTH = 200;

const NAMED_HTML_ENTITIES: Record<string, string> = {
  amp: '&',
  lt: '<',
  gt: '>',
  quot: '"',
  apos: "'",
  nbsp: ' ',
  mdash: '—',
  ndash: '–',
};

// Decodes the named and numeric HTML entities that commonly appear in <title>
// text. The named set is intentionally small (common punctuation only); rare
// entities like &copy; pass through undecoded, which is acceptable for a
// title. The Markdown path does not need this because toMarkdown already
// decodes entities.
function decodeHtmlEntities(text: string): string {
  return text.replace(/&(#x?[0-9a-f]+|[a-z]+);/gi, (match, body: string) => {
    if (body.startsWith('#')) {
      const isHex = body[1] === 'x' || body[1] === 'X';
      const codePoint = isHex ? parseInt(body.slice(2), 16) : parseInt(body.slice(1), 10);
      // <title> is untrusted input; reject anything outside the valid Unicode
      // range so String.fromCodePoint cannot throw RangeError.
      if (Number.isNaN(codePoint) || codePoint < 0 || codePoint > 0x10ffff) {
        return match;
      }
      return String.fromCodePoint(codePoint);
    }
    return NAMED_HTML_ENTITIES[body.toLowerCase()] ?? match;
  });
}

/**
 * Derives a human title, preferring the HTML `<title>` element and falling
 * back to the first Markdown heading. Returns null when neither is present.
 */
export function extractTitle(html: string, markdown: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTitle = titleMatch?.[1].replace(/\s+/g, ' ').trim();
  if (htmlTitle) {
    return decodeHtmlEntities(htmlTitle);
  }
  const headingMatch = markdown.match(/^#{1,6}\s+(.+?)\s*$/m);
  return headingMatch?.[1].trim() ?? null;
}

/**
 * Returns the first non-empty paragraph of the markdown as a short excerpt,
 * skipping leading headings and capping the length so downstream list views
 * get a bounded string. Returns null when no paragraph text exists.
 */
export function extractExcerpt(markdown: string): string | null {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 0 && !block.startsWith('#'));
  const firstParagraph = paragraphs[0];
  if (!firstParagraph) {
    return null;
  }
  // Cap by Unicode code point, not UTF-16 code unit, so a multi-byte character
  // (e.g. an emoji) is never split mid-surrogate at the boundary.
  const codePoints = Array.from(firstParagraph);
  if (codePoints.length <= EXCERPT_MAX_LENGTH) {
    return firstParagraph;
  }
  return `${codePoints.slice(0, EXCERPT_MAX_LENGTH).join('').trimEnd()}…`;
}

function fileNameForUrl(url: string): string {
  try {
    const { hostname } = new URL(url);
    return `${hostname || 'page'}.html`;
  } catch {
    return 'page.html';
  }
}

async function fetchHtml(url: string): Promise<string> {
  // TODO: SSRF defence. Resolve the host and reject private / link-local /
  // loopback addresses before fetching. On Cloudflare Workers there is no
  // VM-local network to pivot into, but the URL is user-supplied, so without
  // this check the Worker can still be used to probe internal hosts reachable
  // from Cloudflare's egress or act as an open fetch proxy. Academic for a
  // local single-user PoC; tighten before multi-user use.
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15_000),
  });
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`);
  }
  const contentType = response.headers.get('content-type') ?? '';
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error(
      `Unsupported content-type for scraping: ${contentType || '(missing)'}`,
    );
  }
  return await response.text();
}
