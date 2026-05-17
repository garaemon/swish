import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

// Polite-bot UA so site operators can identify Swish in their logs and
// rate-limit / contact us if needed. Bump the version when scraping
// behavior changes meaningfully.
const USER_AGENT =
  'Mozilla/5.0 (compatible; SwishBot/0.1; +https://github.com/garaemon/swish)'

export type ScrapeResult = {
  title: string | null
  content: string
  excerpt: string | null
}

/**
 * Fetches the URL and runs Mozilla Readability on the response body.
 * Throws if the URL cannot be fetched or no main content can be extracted.
 */
export async function scrapeUrl(url: string): Promise<ScrapeResult> {
  const html = await fetchHtml(url)
  return extractReadable(url, html)
}

/**
 * Extracts the main article from a known HTML string.
 * Separated for testability with fixture inputs.
 */
export function extractReadable(url: string, html: string): ScrapeResult {
  const dom = new JSDOM(html, { url })
  const reader = new Readability(dom.window.document)
  const article = reader.parse()
  if (!article) {
    throw new Error('Readability could not extract an article from the page')
  }
  return {
    title: article.title ?? null,
    content: article.textContent ?? '',
    excerpt: article.excerpt ?? null,
  }
}

async function fetchHtml(url: string): Promise<string> {
  // TODO: SSRF defence. Resolve the host and reject private / link-local /
  // loopback addresses before fetching. In a Vercel deploy the function
  // VM can reach internal services; for a local PoC this is academic.
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }
  const contentType = response.headers.get('content-type') ?? ''
  if (!/text\/html|application\/xhtml\+xml/i.test(contentType)) {
    throw new Error(
      `Unsupported content-type for scraping: ${contentType || '(missing)'}`,
    )
  }
  return await response.text()
}
