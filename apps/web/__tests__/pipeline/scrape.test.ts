import { describe, expect, it } from 'vitest';
import {
  convertHtmlToMarkdown,
  extractExcerpt,
  extractTitle,
  type MarkdownConverter,
} from '@/lib/pipeline/scrape';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>How to Optimize Your Inbox</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <article>
      <h1>How to Optimize Your Inbox</h1>
      <p>Email overload is the death of focus.</p>
    </article>
  </body>
</html>`;

const SAMPLE_MARKDOWN = `# How to Optimize Your Inbox

Email overload is the death of focus. A robust triage process beats any clever
folder hierarchy.

Second paragraph that should not appear in the excerpt.`;

// Returns a fixed conversion result regardless of input. Lets the pipeline
// be tested without a live Cloudflare Workers AI binding.
function createFakeConverter(
  result: { format: string; data?: string },
): MarkdownConverter {
  return {
    toMarkdown: async () => result,
  };
}

describe('convertHtmlToMarkdown', () => {
  it('returns the markdown content from the converter', async () => {
    const converter = createFakeConverter({ format: 'markdown', data: SAMPLE_MARKDOWN });
    const result = await convertHtmlToMarkdown('https://example.com/post', SAMPLE_HTML, converter);
    expect(result.content).toContain('triage process');
  });

  it('derives the title from the HTML title tag', async () => {
    const converter = createFakeConverter({ format: 'markdown', data: SAMPLE_MARKDOWN });
    const result = await convertHtmlToMarkdown('https://example.com/post', SAMPLE_HTML, converter);
    expect(result.title).toContain('Inbox');
  });

  it('throws when the converter reports a failure', async () => {
    const converter = createFakeConverter({ format: 'error' });
    await expect(
      convertHtmlToMarkdown('https://example.com/empty', '<html></html>', converter),
    ).rejects.toThrow(/conversion/i);
  });
});

describe('extractTitle', () => {
  it('prefers the HTML title tag', () => {
    expect(extractTitle(SAMPLE_HTML, SAMPLE_MARKDOWN)).toContain('Inbox');
  });

  it('falls back to the first markdown heading when no title tag exists', () => {
    expect(extractTitle('<html></html>', '# Fallback Heading\n\nBody')).toBe('Fallback Heading');
  });

  it('returns null when neither a title tag nor a heading is present', () => {
    expect(extractTitle('<html></html>', 'Body without heading')).toBeNull();
  });
});

describe('extractExcerpt', () => {
  it('returns only the first paragraph of the markdown', () => {
    const excerpt = extractExcerpt(SAMPLE_MARKDOWN);
    expect(excerpt).toContain('triage process');
    expect(excerpt).not.toContain('Second paragraph');
  });
});
