import { describe, expect, it } from 'vitest'
import { buildPrompt } from '@/lib/pipeline/prompt'

describe('buildPrompt', () => {
  it('mentions the configured output language', () => {
    const result = buildPrompt({
      content: 'Article body',
      language: 'English',
      customPrompt: null,
    })
    expect(result).toContain('Write the summaries in English.')
  })

  it('includes the user custom prompt when set', () => {
    const result = buildPrompt({
      content: 'Article body',
      language: 'Japanese',
      customPrompt: 'Focus on action items.',
    })
    expect(result).toContain('Focus on action items.')
  })

  it('omits the custom prompt block when blank or null', () => {
    expect(buildPrompt({ content: 'x', language: 'Japanese', customPrompt: null })).not.toContain(
      'User custom instructions',
    )
    expect(
      buildPrompt({ content: 'x', language: 'Japanese', customPrompt: '   ' }),
    ).not.toContain('User custom instructions')
  })

  it('truncates very long content', () => {
    const big = 'a'.repeat(30_000)
    const result = buildPrompt({ content: big, language: 'Japanese', customPrompt: null })
    expect(result).toContain('[truncated]')
    expect(result.length).toBeLessThan(big.length + 1000)
  })

  it('includes the JSON contract in the system instruction', () => {
    const result = buildPrompt({ content: 'x', language: 'Japanese', customPrompt: null })
    expect(result).toContain('summary_short')
    expect(result).toContain('summary_long')
  })
})
