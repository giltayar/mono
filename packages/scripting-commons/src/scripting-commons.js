'use strict'
import {promisify} from 'util'
import fs from 'fs'
import os from 'os'
import path from 'path'
import {once} from 'events'
import {spawn, exec} from 'child_process'
import {makeError} from '@seasquared/functional-commons'

/**
 * @param {string} command
 * @param {{
 * cwd?: string|undefined
 * env?: object|undefined
 * }} [options]
 */
export async function sh(command, {cwd, env} = {}) {
  const childProcess = spawn(
    command,
    /**@type {import('child_process').SpawnOptions}*/ ({cwd, stdio: 'inherit', shell: true, env}),
  )
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
 * @param {string} command
 * @param {{
 * cwd?: string|undefined
 * env?: object|undefined
 * }} [options]
 */
export async function shWithOutput(command, {cwd, env} = {}) {
  const {stdout} = await promisify(exec)(
    command,
    /**@type {import('child_process').ExecOptions}*/ ({cwd, env}),
  )

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
 * @returns {Promise<string>}
 */
export async function makeTemporaryDirectory() {
  return await fs.promises.mkdtemp(os.tmpdir() + '/')
}
