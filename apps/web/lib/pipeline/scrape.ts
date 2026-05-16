import { Readability } from '@mozilla/readability'
import { JSDOM } from 'jsdom'

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
  const parsed = reader.parse()
  if (!parsed) {
    throw new Error('Readability could not extract an article from the page')
  }
  return {
    title: parsed.title ?? null,
    content: parsed.textContent ?? '',
    excerpt: parsed.excerpt ?? null,
  }
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: { 'user-agent': USER_AGENT, accept: 'text/html,application/xhtml+xml' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: HTTP ${response.status}`)
  }
  return await response.text()
}
