import { describe, expect, it } from 'vitest';
import { extractReadable } from '@/lib/pipeline/scrape';

const SAMPLE_HTML = `<!doctype html>
<html lang="en">
  <head>
    <title>How to Optimize Your Inbox</title>
    <meta charset="utf-8" />
  </head>
  <body>
    <header>
      <nav>Home | Blog | About</nav>
    </header>
    <article>
      <h1>How to Optimize Your Inbox</h1>
      <p>
        Email overload is the death of focus. A robust triage process beats any
        clever folder hierarchy. Read what you must, archive the rest.
      </p>
      <p>
        First, batch your reading into three windows. Second, use one keyboard
        shortcut to archive. Third, never sort messages manually.
      </p>
    </article>
    <footer>
      <p>Subscribe to the newsletter.</p>
    </footer>
  </body>
</html>`;

describe('extractReadable', () => {
  it('returns the article title', () => {
    const result = extractReadable('https://example.com/post', SAMPLE_HTML);
    expect(result.title).toContain('Inbox');
  });

  it('returns body text without navigation cruft', () => {
    const result = extractReadable('https://example.com/post', SAMPLE_HTML);
    expect(result.content).toContain('triage process');
    expect(result.content).not.toContain('Home | Blog | About');
  });

  it('throws when no article can be extracted', () => {
    expect(() => extractReadable('https://example.com/empty', '<html></html>')).toThrow(
      /Readability/i,
    );
  });
});
