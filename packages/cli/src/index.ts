/**
 * Entry point for the `swish` CLI. Each subcommand reads
 * ~/.config/swish/config.json (set up by `swish login`) for the Swish API
 * base URL and the personal access token.
 */
import { Command } from 'commander';
import pkg from '../package.json' with { type: 'json' };
import { addCommand } from './commands/add';
import { loginCommand } from './commands/login';

const program = new Command();

program
  .name('swish')
  .description('Swish CLI — save URLs to your Swish inbox')
  .version(pkg.version);

program
  .command('login')
  .description('Store the API URL + personal access token for this machine')
  .option('--api-url <url>', 'Swish API base URL')
  .option('--pat <token>', 'Personal access token (otherwise prompted)')
  .action(async (opts: { apiUrl?: string; pat?: string }) => {
    await loginCommand({ apiUrl: opts.apiUrl, pat: opts.pat });
  });

program
  .command('add <url>')
  .description('Save a URL to the Swish inbox')
  .action(async (url: string) => {
    await addCommand(url);
  });

program.parseAsync(process.argv).catch((err: unknown) => {
  console.error(err instanceof Error ? err.message : err);
  process.exit(1);
});
