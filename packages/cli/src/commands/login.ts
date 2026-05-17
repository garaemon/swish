import { createInterface } from 'node:readline/promises'
import { writeConfig } from '../config'

export type LoginOptions = {
  apiUrl?: string
  pat?: string
}

async function prompt(question: string): Promise<string> {
  const rl = createInterface({ input: process.stdin, output: process.stdout })
  try {
    const answer = await rl.question(question)
    return answer.trim()
  } finally {
    rl.close()
  }
}

export async function loginCommand(options: LoginOptions): Promise<void> {
  const apiUrl =
    options.apiUrl ||
    (await prompt('API URL [http://localhost:3000]: ')) ||
    'http://localhost:3000'
  // Note: the PAT is currently echoed to the terminal during entry. Hiding
  // it would require a custom Writable that filters the keystrokes; for now
  // the convention follows `gh auth login` etc. Pass --pat to bypass the
  // prompt entirely from a script.
  const pat = options.pat || (await prompt('Personal access token: '))
  if (!pat) {
    console.error('Personal access token is required.')
    process.exit(1)
  }
  const file = await writeConfig({ apiUrl, pat })
  console.log(`Saved config to ${file}`)
}
