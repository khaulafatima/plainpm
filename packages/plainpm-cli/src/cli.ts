import process from 'node:process'
import yargs from 'yargs'
import { hideBin } from 'yargs/helpers'

export function createCli(args: string[] = []) {
  return yargs(args)
    .scriptName('plainpm')
    .usage('$0 <command> [options]')
    .help('help')
    .alias('h', 'help')
    .version('1.0.0')
    .alias('v', 'version')
    .strict()
    .demandCommand(1, 'Please specify a command.')
}

export function runCli(argv = hideBin(process.argv)): void {
  createCli(argv).parse()
}
