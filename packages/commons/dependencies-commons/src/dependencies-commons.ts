import fs from 'fs/promises'
import path from 'path'
import {fileURLToPath} from 'node:url'
import {getDependencies} from './get-dependencies.ts'

export type DependencyInformation = {
  version: string
  cleanName: string
  envName: string
}

export async function getDependencyInformation(
  fileOrDir: URL | string,
): Promise<Record<string, DependencyInformation>> {
  const fsPath = typeof fileOrDir === 'string' ? fileOrDir : fileURLToPath(fileOrDir)
  const dir = path.resolve((await fs.stat(fsPath)).isDirectory() ? fsPath : path.dirname(fsPath))
  try {
    const packageJsonLocation = path.join(dir, 'package.json')
    const packageJsonAsString = await fs.readFile(packageJsonLocation, 'utf-8')

    try {
      const packageJson = JSON.parse(packageJsonAsString)
      return getDependencies(dir, {
        ...packageJson.dependencies,
        ...packageJson.devDependencies,
        ...packageJson.peerDependencies,
      })
    } catch (error: any) {
      if (error instanceof SyntaxError) {
        throw new Error(`package.json at ${packageJsonLocation} is not JSON-parseable`)
      } else {
        throw error
      }
    }
  } catch (error: any) {
    if (error.code === 'ENOENT') {
      return getDependencyInformation(path.dirname(dir))
    } else {
      throw error
    }
  }
}
