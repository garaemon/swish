export type RunPipelineInput = {
  itemId: string
  userId: string
}

/**
 * Orchestrates the background bookmark pipeline: scrape -> summarize -> persist.
 * Records status transitions in the items row and captures any error.
 */
export async function runPipeline(_input: RunPipelineInput): Promise<void> {
  throw new Error('not implemented')
}
