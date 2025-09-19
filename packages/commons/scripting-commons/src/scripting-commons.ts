import fs from 'fs'
import os from 'os'
import path from 'path'
import {pipeline} from 'stream/promises'
import {makeError} from '@giltayar/functional-commons'

export function pathComponents(pathOrFile: string): {
  dirname: string
  basename: string
  extname: string
  filename: string
} {
  const dirname = path.dirname(pathOrFile)
  const basename = path.basename(pathOrFile)
  const extname = path.extname(basename)
  const filename = path.basename(basename, extname)
  return {dirname, basename, extname, filename}
}

export async function writeFile(
  file: string | string[],
  content: Buffer | string | object,
  {cwd}: {cwd: string},
): Promise<void> {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file as string)

  await fs.promises.mkdir(path.dirname(file), {recursive: true})
  await fs.promises.writeFile(
    file,
    typeof content === 'object' ? JSON.stringify(content) : (content as any),
  )
}

export async function readFileAsString(
  file: string | string[],
  {cwd}: {cwd: string},
): Promise<string> {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  file = path.join(cwd, file as string)

  return await fs.promises.readFile(file as string, 'utf-8')
}

export async function readFileAsJson<T = any>(
  file: string | string[],
  {cwd}: {cwd: string},
): Promise<T> {
  if (Array.isArray(file)) {
    file = file.reduce((fileUpTillNow, segment) => path.join(fileUpTillNow, segment))
  }
  return JSON.parse(await fs.promises.readFile(path.join(cwd, file as string), 'utf-8')) as T
}

export async function makeTemporaryDirectory(
  dirToCopy?: string,
  stringSubstitutions?: Record<string, string>,
): Promise<string> {
  const ret = await fs.promises.mkdtemp(os.tmpdir() + '/')

  if (dirToCopy != null) {
    await copyDirectory(dirToCopy, ret, stringSubstitutions)
  }

  return ret
}

export async function replaceInFile(
  file: string | string[],
  sourceString: string,
  targetString: string,
  {cwd}: {cwd: string},
): Promise<string> {
  const content = await readFileAsString(file, {cwd})

  const transformedContent = content.replaceAll(sourceString, targetString)

  await writeFile(file, transformedContent, {cwd})

  return transformedContent
}

export async function findFileThatMatches(dir: string, regex: RegExp): Promise<string | undefined> {
  const result = (await fs.promises.readdir(dir)).filter((s) => regex.test(s))

  if (result.length === 0) {
    return undefined
  } else if (result.length === 1) {
    return path.join(dir, result[0])
  } else {
    throw makeError(`more than one file matches ${regex}: ${result}`, {
      code: 'ERR_MORE_THAN_ONE_FILE_MATCH',
    })
  }
}

export async function copyDirectory(
  sourceDirectory: string,
  targetDirectory: string,
  stringSubstitutions?: Record<string, string> | undefined,
): Promise<void> {
  await fs.promises.mkdir(targetDirectory, {recursive: true})

  const filesAndDirs = await fs.promises.readdir(sourceDirectory, {withFileTypes: true})

  await Promise.all(
    filesAndDirs.map((f) =>
      f.isDirectory()
        ? copyDirectory(path.join(sourceDirectory, f.name), path.join(targetDirectory, f.name))
        : copyFile(
            path.join(sourceDirectory, f.name),
            path.join(targetDirectory, f.name),
            stringSubstitutions,
          ),
    ),
  )
}

async function copyFile(
  sourceFile: string,
  targetFile: string,
  stringSubstitutions: Record<string, string> | undefined,
): Promise<void> {
  if (!stringSubstitutions || Object.keys(stringSubstitutions).length === 0) {
    await pipeline(fs.createReadStream(sourceFile), fs.createWriteStream(targetFile))
  } else {
    const source = await fs.promises.readFile(sourceFile, 'utf8')

    const transformed = Object.entries(stringSubstitutions).reduce(
      (acc, [from, to]) => acc.replaceAll(from, to),
      source,
    )

    await fs.promises.writeFile(targetFile, transformed)
  }
}
