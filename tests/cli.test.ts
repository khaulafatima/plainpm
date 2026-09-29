import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { createCli } from '../src/packages/plainpm-cli/index.js'

const execFileAsync = promisify(execFile)

describe('yargs CLI command runner', () => {
  it('displays help output containing usage information via programmatic runner', async () => {
    const cli = createCli()
    const output = await new Promise<string>((resolve) => {
      cli.parse('--help', (_err: Error | undefined, _argv: any, output: string) => {
        resolve(output)
      })
    })

    expect(output).toContain('plainpm')
    expect(output).toContain('--help')
    expect(output).toContain('--version')
  })

  it('runs end-to-end via child process with --help and exits with 0', async () => {
    const { stdout } = await execFileAsync('node', ['./dist/cli.js', '--help'])
    expect(stdout).toContain('plainpm')
    expect(stdout).toContain('Show help')
  })

  it('runs end-to-end via child process with --version and returns 1.0.0', async () => {
    const { stdout } = await execFileAsync('node', ['./dist/cli.js', '--version'])
    expect(stdout.trim()).toBe('1.0.0')
  })
})
