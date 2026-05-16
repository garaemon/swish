import { Command } from 'commander'
import { addCommand } from './commands/add'
import { loginCommand } from './commands/login'

const program = new Command()

program
  .name('swish')
  .description('Swish CLI — save URLs to your Swish inbox')
  .version('0.0.1')

program
  .command('login')
  .description('Store the API URL + personal access token for this machine')
  .option('--api-url <url>', 'Swish API base URL')
  .option('--pat <token>', 'Personal access token (otherwise prompted)')
  .action(async (opts) => {
    await loginCommand({ apiUrl: opts.apiUrl, pat: opts.pat })
  })

program
  .command('add <url>')
  .description('Save a URL to the Swish inbox')
  .action(async (url: string) => {
    await addCommand(url)
  })

program.parseAsync(process.argv).catch((err) => {
  console.error(err instanceof Error ? err.message : err)
  process.exit(1)
})
