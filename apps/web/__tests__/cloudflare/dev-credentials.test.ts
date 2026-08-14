import { describe, expect, it } from 'vitest';
import { hasResolvedCloudflareCredentials } from '@/lib/cloudflare/dev-credentials';

describe('hasResolvedCloudflareCredentials', () => {
  it('should_return_true_when_both_credentials_are_plain_values', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: 'real-token-value',
      CLOUDFLARE_ACCOUNT_ID: '0c4a9a18e351eff8cc2594d60d003928',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(true);
  });

  it('should_return_false_when_api_token_is_missing', () => {
    const env = {
      CLOUDFLARE_ACCOUNT_ID: '0c4a9a18e351eff8cc2594d60d003928',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(false);
  });

  it('should_return_false_when_account_id_is_missing', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: 'real-token-value',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(false);
  });

  it('should_return_false_when_api_token_is_unresolved_op_reference', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: 'op://Private/swish Cloudflare Token/credential',
      CLOUDFLARE_ACCOUNT_ID: '0c4a9a18e351eff8cc2594d60d003928',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(false);
  });

  it('should_return_false_when_account_id_is_unresolved_op_reference', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: 'real-token-value',
      CLOUDFLARE_ACCOUNT_ID: 'op://Private/swish Cloudflare Token/username',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(false);
  });

  it('should_return_false_when_api_token_is_empty', () => {
    const env = {
      CLOUDFLARE_API_TOKEN: '',
      CLOUDFLARE_ACCOUNT_ID: '0c4a9a18e351eff8cc2594d60d003928',
    };

    expect(hasResolvedCloudflareCredentials(env)).toBe(false);
  });
});
