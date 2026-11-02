import {execFileSync} from 'node:child_process'

export type CommandOptions = {
  cwd: string
  env: NodeJS.ProcessEnv
  captureOutput?: boolean
}

export type CommandRunner = (
  command: string,
  args: readonly string[],
  options: CommandOptions,
) => string | null

export const runCommand: CommandRunner = (command, args, options) =>
  execFileSync(command, args, {
    cwd: options.cwd,
    env: options.env,
    encoding: 'utf8',
    stdio: options.captureOutput ? ['ignore', 'pipe', 'pipe'] : 'inherit',
  })
