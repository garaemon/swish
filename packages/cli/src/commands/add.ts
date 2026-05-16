import { readConfig } from '../config'
import { postBookmark } from '../http'

export async function addCommand(url: string): Promise<void> {
  const config = await readConfig()
  if (!config) {
    console.error('No CLI config found. Run `swish login` first.')
    process.exit(1)
  }
  try {
    new URL(url)
  } catch {
    console.error(`Not a valid URL: ${url}`)
    process.exit(2)
  }
  const result = await postBookmark(config, { url })
  console.log(`Saved item ${result.id} (status: ${result.status})`)
}
