import {throw_} from '@giltayar/functional-commons'
import fs from 'fs/promises'
import path from 'path'
import {cleanName, envName} from './names.ts'

import type {DependencyInformation} from './dependencies-commons.ts'

export async function getDependencies(
  packageDir: string,
  versionInfo: Record<string, string>,
): Promise<Record<string, DependencyInformation>> {
  return await mapObjectAsync(versionInfo, async (k, _v) => [
    k,
    {
      version: await getVersion(packageDir, k),
      cleanName: cleanName(k),
      envName: envName(k),
    },
  ])
}

async function mapObjectAsync<T, U>(
  object: Record<string, T>,
  mapFunction: (key: string, value: T) => Promise<[string, U]>,
): Promise<Record<string, U>> {
  const entries = await Promise.all(
    Object.entries(object).map(([key, value]) => mapFunction(key, value)),
  )
  return Object.fromEntries(entries)
}

async function getVersion(basePackageDir: string, packageName: string) {
  const packageDir = path.join(basePackageDir, 'node_modules', packageName)
  const versionFileLocation = path.join(packageDir, '.version-info.json')
  const packageJsonLocation = path.join(packageDir, 'package.json')

  try {
    const versionFile = await fs.readFile(versionFileLocation, 'utf-8')

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
    const packageJsonAsString = await fs.readFile(packageJsonLocation, 'utf8')

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
