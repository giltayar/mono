'use strict'
import {promisify} from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import stream from 'stream/promises'
import {once} from 'events'
import {spawn, exec, execFile} from 'child_process'
import {makeError} from '@seasquared/functional-commons'

/**
 * @param {string|string[]} command
 * @param {{
 * cwd?: string|undefined
 * env?: Record<string, string|undefined>|undefined
 * }} options
 */
export async function sh(command, {cwd, env} = {}) {
  /**@type {import('child_process').SpawnOptions}*/
  const spawnOptions = {
    cwd,
    stdio: 'inherit',
    shell: true,
    env,
  }
  const childProcess = Array.isArray(command)
    ? spawn(command[0], command.slice(1), spawnOptions)
    : spawn(command, spawnOptions)

  const [result] = await Promise.race([once(childProcess, 'error'), once(childProcess, 'exit')])
  if (typeof result === 'number') {
    if (result !== 0) {
      throw makeError(`Command failed: ${command} ${result === 127 ? '(not found)' : ''}\n`, {
        code: result,
      })
    } else {
      return
    }
  } else {
    throw result
  }
}

/**
 * @param {string|string[]} command
 * @param {{
 * cwd?: string|undefined
 * env?: Record<string, string|undefined> | undefined
 * }} options
 */
export async function shWithOutput(command, {cwd, env} = {}) {
  /**@type {import('child_process').ExecOptions}*/
  // @ts-expect-error (bad definition of ExecOptions)
  const execOptions = {cwd, env, shell: true}

  const {stdout} = Array.isArray(command)
    ? await promisify(execFile)(command[0], command.slice(1), execOptions)
    : await promisify(exec)(command, execOptions)

  return stdout
}

/**
 * @param {string | string[]} file
 * @param {Buffer|string|object} content
 * @param {{cwd: string}} options
 * @returns {Promise<void>}
 */
export async function writeFile(file, content, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  await fs.promises.mkdir(path.dirname(file), {recursive: true})
  await fs.promises.writeFile(file, typeof content === 'object' ? JSON.stringify(content) : content)
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<string>}
 */
export async function readFileAsString(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file)

  return await fs.promises.readFile(file, 'utf-8')
}

/**
 * @param {string | string[]} file
 * @param {{cwd: string}} options
 * @returns {Promise<object>}
 */
export async function readFileAsJson(file, {cwd}) {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  return JSON.parse(await fs.promises.readFile(path.join(cwd, file), 'utf-8'))
}

/**
 * @param {string | undefined} [dirToCopy]
 * @returns {Promise<string>}
 */
export async function makeTemporaryDirectory(dirToCopy) {
  const ret = await fs.promises.mkdtemp(os.tmpdir() + '/')

  if (dirToCopy != null) {
    await copyDirectory(dirToCopy, ret)
  }

  return ret
}

/**
 * @param {string} sourceDirectory
 * @param {string} targetDirectory
 */
async function copyDirectory(sourceDirectory, targetDirectory) {
  await fs.promises.mkdir(targetDirectory, {recursive: true})

  const filesAndDirs = await fs.promises.readdir(sourceDirectory, {withFileTypes: true})

  await Promise.all(
    filesAndDirs.map((f) =>
      f.isDirectory()
        ? copyDirectory(path.join(sourceDirectory, f.name), path.join(targetDirectory, f.name))
        : copyFile(path.join(sourceDirectory, f.name), path.join(targetDirectory, f.name)),
    ),
  )
}

/**
 * @param {string} sourceFile
 * @param {string} targetFile
 */
async function copyFile(sourceFile, targetFile) {
  await stream.pipeline(fs.createReadStream(sourceFile), fs.createWriteStream(targetFile))
}
