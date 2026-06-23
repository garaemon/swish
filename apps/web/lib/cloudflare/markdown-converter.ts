import { getCloudflareContext } from '@opennextjs/cloudflare';
import type { MarkdownConverter } from '@/lib/pipeline/scrape';

/**
 * Resolves the Cloudflare Workers AI binding (`env.AI`) as a MarkdownConverter.
 *
 * The binding only exists inside the Worker runtime (and, for `next dev`, via
 * the miniflare proxy wired by `initOpenNextCloudflareForDev`). The binding is
 * read through an `unknown` cast so this module does not depend on the large
 * generated `cloudflare-env.d.ts`, which is gitignored and regenerated.
 */
export async function getMarkdownConverter(): Promise<MarkdownConverter> {
  const { env } = await getCloudflareContext({ async: true });
  const ai = (env as unknown as Record<string, unknown>).AI as MarkdownConverter | undefined;
  if (!ai) {
    throw new Error('Cloudflare AI binding (AI) is not configured');
  }
  return ai;
}
