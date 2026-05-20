/**
 * Implements `swish login`. Accepts the API URL and PAT from CLI flags or
 * — when omitted — prompts the user interactively. Writes the values to the
 * persisted config via writeConfig().
 */
import { createInterface, type Interface as ReadlineInterface } from 'node:readline/promises'
import { writeConfig } from '../config'

export type LoginOptions = {
  apiUrl?: string
  pat?: string
}

const DEFAULT_API_URL = 'http://localhost:3000'

async function askLine(rl: ReadlineInterface, question: string): Promise<string> {
  const answer = await rl.question(question)
  return answer.trim()
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  // A single readline interface is shared so pipe / non-TTY inputs don't
  // hit the "stdin is already closed" flake that creating multiple
  // interfaces back-to-back can trigger.
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const apiUrlPrompted =
      options.apiUrl ?? (await askLine(rl, `API URL [${DEFAULT_API_URL}]: `))
    const apiUrl = apiUrlPrompted || DEFAULT_API_URL
    // TODO: hide the PAT during interactive entry. Both gh and npm use
    // `stty -echo` style suppression; we currently echo the token to the
    // terminal, which is fine for `--pat` flag usage but unsafe in
    // screen-shared sessions.
    const pat = options.pat ?? (await askLine(rl, 'Personal access token: '))
    if (!pat) {
      console.error('Personal access token is required.')
      process.exit(1)
    }
    const file = await writeConfig({ apiUrl, pat })
    console.log(`Saved config to ${file}`)
  } finally {
    rl.close()
  }
}
