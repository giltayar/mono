import fs from 'fs'
import path from 'path'
import {getDependencies} from './get-dependencies.js'

/**
 * @param {string} fileOrDir
 * @returns {Record<string, import('./global.js').DependencyInformation>}
 */
export function getDependencyInformation(fileOrDir) {
  const dir = path.resolve(
    fs.statSync(fileOrDir).isDirectory() ? fileOrDir : path.dirname(fileOrDir),
  )
  try {
    const packageJsonLocation = path.join(dir, 'package.json')
    const packageJsonAsString = fs.readFileSync(packageJsonLocation, 'utf-8')

    try {
      const packageJson = JSON.parse(packageJsonAsString)
      return getDependencies(dir, {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      })
    } catch (error) {
      if (error instanceof SyntaxError) {
        throw new Error(`package.json at ${packageJsonLocation} is not JSON-parseable`)
      } else {
        throw error
      }
    }
  } catch (/**@type {any}*/ error) {
    if (error.code === 'ENOENT') {
      return getDependencyInformation(path.dirname(dir))
    } else {
      throw error
    }
  }
}
