import { describe, expect, it } from 'vitest';
import {
  convertHtmlToMarkdown,
  extractExcerpt,
  extractTitle,
  stripLeadingFrontmatter,
  type MarkdownConversionResult,
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
function createFakeConverter(result: MarkdownConversionResult): MarkdownConverter {
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

  it('derives the excerpt from the first body paragraph', async () => {
    const converter = createFakeConverter({ format: 'markdown', data: SAMPLE_MARKDOWN });
    const result = await convertHtmlToMarkdown('https://example.com/post', SAMPLE_HTML, converter);
    expect(result.excerpt).toContain('triage process');
    expect(result.excerpt).not.toContain('Second paragraph');
  });

  it('throws when the converter reports a failure', async () => {
    const converter = createFakeConverter({ format: 'error' });
    await expect(
      convertHtmlToMarkdown('https://example.com/empty', '<html></html>', converter),
    ).rejects.toThrow(/conversion/i);
  });

  it('strips leading frontmatter from the content and excerpt', async () => {
    const markdown = `---
description: Why & how we rewrote things
title: Rewriting Bun in Rust
---

The real article body starts here.

A second paragraph.`;
    const converter = createFakeConverter({ format: 'markdown', data: markdown });
    const result = await convertHtmlToMarkdown('https://example.com/post', SAMPLE_HTML, converter);
    expect(result.content).not.toContain('description:');
    expect(result.content.startsWith('The real article body')).toBe(true);
    expect(result.excerpt).toBe('The real article body starts here.');
  });
});

describe('stripLeadingFrontmatter', () => {
  it('removes a leading frontmatter block', () => {
    const input = '---\ntitle: Foo\nimage: bar.png\n---\n\nBody text.';
    expect(stripLeadingFrontmatter(input)).toBe('Body text.');
  });

  it('leaves content without frontmatter untouched', () => {
    const input = '# Heading\n\nBody text.';
    expect(stripLeadingFrontmatter(input)).toBe(input);
  });

  it('does not strip a lone thematic break with no closing fence', () => {
    const input = '---\n\nBody text with a leading rule.';
    expect(stripLeadingFrontmatter(input)).toBe(input);
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

  it('decodes HTML entities in the title tag', () => {
    const html = '<html><head><title>Tips &amp; Tricks &#39;26 &mdash; Done</title></head></html>';
    expect(extractTitle(html, '')).toBe("Tips & Tricks '26 — Done");
  });

  it('leaves an out-of-range numeric entity untouched instead of throwing', () => {
    expect(extractTitle('<html><head><title>&#x110000;</title></head></html>', '')).toBe(
      '&#x110000;',
    );
  });
});

describe('extractExcerpt', () => {
  it('returns only the first paragraph of the markdown', () => {
    const excerpt = extractExcerpt(SAMPLE_MARKDOWN);
    expect(excerpt).toContain('triage process');
    expect(excerpt).not.toContain('Second paragraph');
  });

  it('caps a long paragraph and appends an ellipsis', () => {
    const longParagraph = 'word '.repeat(100).trim();
    const excerpt = extractExcerpt(longParagraph);
    expect(excerpt).not.toBeNull();
    expect(Array.from(excerpt!).length).toBeLessThanOrEqual(201);
    expect(excerpt!.endsWith('…')).toBe(true);
  });

  it('does not split a multi-byte character when capping', () => {
    const emoji = '😀';
    const excerpt = extractExcerpt(emoji.repeat(300));
    expect(excerpt).not.toBeNull();
    const chars = Array.from(excerpt!);
    expect(chars.filter((char) => char === emoji).length).toBe(200);
    expect(chars[chars.length - 1]).toBe('…');
  });
});
