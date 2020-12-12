import {mapObject, throw_} from '@seasquared/functional-commons'
import fs from 'fs'
import path from 'path'
import {cleanName, envName} from './names.js'

/**
 * @param {string} packageDir
 * @param {Record<string, string>} versionInfo
 * @returns {Record<string, import('./global.js').DependencyInformation>}
 */
export function getDependencies(packageDir, versionInfo) {
  return mapObject(versionInfo, (k, _v) => [
    k,
    {
      version: getVersion(packageDir, k),
      cleanName: cleanName(k),
      envName: envName(k),
    },
  ])
}

/**
 * @param {string} basePackageDir
 * @param {string} packageName
 */
function getVersion(basePackageDir, packageName) {
  const packageDir = path.join(basePackageDir, 'node_modules', packageName)
  const versionFileLocation = path.join(packageDir, '.version-info.json')
  const packageJsonLocation = path.join(packageDir, 'package.json')

  try {
    const versionFile = fs.readFileSync(versionFileLocation, 'utf-8')

    return (
      JSON.parse(versionFile).version ??
      throw_(new Error(`version file at ${versionFileLocation} has no "version" field`))
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`version file at ${versionFileLocation} is not JSON-parseable`)
    } else if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
      throw error
    } else {
      // continue to package.json
    }
  }

  try {
    const packageJsonAsString = fs.readFileSync(packageJsonLocation, 'utf8')

    return (
      JSON.parse(packageJsonAsString).version ??
      `unknown version because package.json at ${packageJsonLocation} has no "version" field`
    )
  } catch (error) {
    if (error instanceof SyntaxError) {
      throw new Error(`package.json at ${packageJsonLocation} is not JSON-parseable`)
    } else if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return `unknown version because package.json at ${packageJsonLocation} was not found`
    } else {
      throw error
    }
  }
}
