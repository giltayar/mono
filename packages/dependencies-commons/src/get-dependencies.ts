import {mapObject, throw_} from '@giltayar/functional-commons'
import fs from 'fs'
import path from 'path'
import {cleanName, envName} from './names.ts'

import type {DependencyInformation} from './dependencies-commons.ts'

export function getDependencies(
  packageDir: string,
  versionInfo: Record<string, string>,
): Record<string, DependencyInformation> {
  return mapObject(versionInfo, (k, _v) => [
    k,
    {
      version: getVersion(packageDir, k),
      cleanName: cleanName(k),
      envName: envName(k),
    },
  ])
}

function getVersion(basePackageDir: string, packageName: string) {
  const packageDir = path.join(basePackageDir, 'node_modules', packageName)
  const versionFileLocation = path.join(packageDir, '.version-info.json')
  const packageJsonLocation = path.join(packageDir, 'package.json')

  try {
    const versionFile = fs.readFileSync(versionFileLocation, 'utf-8')

    return (
      JSON.parse(versionFile).version ??
      throw_(new Error(`version file at ${versionFileLocation} has no "version" field`))
    )
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`version file at ${versionFileLocation} is not JSON-parseable`)
    } else if (error.code !== 'ENOENT' && error.code !== 'ENOTDIR') {
      throw error
    } else {
    }
  }

  try {
    const packageJsonAsString = fs.readFileSync(packageJsonLocation, 'utf8')

    return (
      JSON.parse(packageJsonAsString).version ??
      `unknown version because package.json at ${packageJsonLocation} has no "version" field`
    )
  } catch (error: any) {
    if (error instanceof SyntaxError) {
      throw new Error(`package.json at ${packageJsonLocation} is not JSON-parseable`)
    } else if (error.code === 'ENOENT' || error.code === 'ENOTDIR') {
      return `unknown version because package.json at ${packageJsonLocation} was not found`
    } else {
      throw error
    }
  }
}
