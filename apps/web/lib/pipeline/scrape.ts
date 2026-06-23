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
 */
export async function convertHtmlToMarkdown(
  url: string,
  html: string,
  converter: MarkdownConverter,
): Promise<ScrapeResult> {
  const conversion = await converter.toMarkdown({
    name: fileNameForUrl(url),
    blob: new Blob([html], { type: 'text/html' }),
  });
  if (conversion.format !== 'markdown' || !conversion.data) {
    throw new Error('Cloudflare Markdown conversion could not extract content from the page');
  }
  const content = conversion.data.trim();
  return {
    title: extractTitle(html, content),
    content,
    excerpt: extractExcerpt(content),
  };
}

/**
 * Derives a human title, preferring the HTML `<title>` element and falling
 * back to the first Markdown heading. Returns null when neither is present.
 */
export function extractTitle(html: string, markdown: string): string | null {
  const titleMatch = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  const htmlTitle = titleMatch?.[1].replace(/\s+/g, ' ').trim();
  if (htmlTitle) {
    return htmlTitle;
  }
  const headingMatch = markdown.match(/^#{1,6}\s+(.+?)\s*$/m);
  return headingMatch?.[1].trim() ?? null;
}

/**
 * Returns the first non-empty paragraph of the markdown as a short excerpt,
 * skipping leading headings. Returns null when no paragraph text exists.
 */
export function extractExcerpt(markdown: string): string | null {
  const paragraphs = markdown
    .split(/\n\s*\n/)
    .map((block) => block.replace(/\s+/g, ' ').trim())
    .filter((block) => block.length > 0 && !block.startsWith('#'));
  return paragraphs[0] ?? null;
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
  // loopback addresses before fetching. In a Vercel deploy the function
  // VM can reach internal services; for a local PoC this is academic.
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
