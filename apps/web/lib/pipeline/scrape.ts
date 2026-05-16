export type ScrapeResult = {
  title: string | null
  content: string
}

/**
 * Fetches the URL and runs Mozilla Readability to extract the main article.
 */
export async function scrapeUrl(_url: string): Promise<ScrapeResult> {
  throw new Error('not implemented')
}
