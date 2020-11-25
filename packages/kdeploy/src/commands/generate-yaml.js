import fs from 'fs'
import handlebars from 'handlebars'
import yaml from 'js-yaml'
import set_ from 'lodash.set'
import module from 'module'
import path from 'path'
import pkgDir from 'pkg-dir'
const {create: createHandlebars} = handlebars
/**
 *
 * @param {{
 *  name: string
 *  cluster?: string
 *  package?: string[]
 *  values?: string[]
 *  override?: string[]
 *  output?: string
 *  input?: string
 * }} options
 */
export default async function main({
  name,
  cluster,
  package: packageFolders = [],
  values: valueFiles = [],
  override = [],
  output: outputDirectory = path.resolve('dist'),
  input: baseInputDirectory = process.cwd(),
}) {
  const templateFolders = [
    path.resolve(baseInputDirectory, 'deploy/templates'),
    ...(cluster ? [path.resolve(baseInputDirectory, 'deploy/templates', cluster)] : []),
  ]

  const {partialFolders, valueFiles: finalValueFiles} = determineAdditionalFolders(
    baseInputDirectory,
    packageFolders,
    valueFiles.map((f) => path.resolve(baseInputDirectory, 'deploy', f)),
    cluster,
  )
  const partialFiles = determinePartialFiles(partialFolders)

  const handlebars = createHandlebars()
  registerHelpersInHandlerbars(handlebars, partialFiles, cluster)

  const allTemplates = templateFolders.flatMap((templateFolder) => readTemplates(templateFolder))
  const values = {
    name,
    cluster,
    ...generateValues(finalValueFiles, override),
  }

  await writeOutput(outputDirectory, allTemplates, handlebars, values, baseInputDirectory)
}

/**
 * @param {string} outputDirectory
 * @param {{ content: string; name: string; path: string; }[]} allTemplates
 * @param {Handlebars} handlebars
 * @param {Record<string, any>} values
 * @param {string} baseInputDirectory
 */
async function writeOutput(outputDirectory, allTemplates, handlebars, values, baseInputDirectory) {
  await fs.promises.mkdir(outputDirectory, {recursive: true})
  for (const template of allTemplates) {
    try {
      const compiledTemplate = handlebars.compile(template.content, {
        noEscape: true,
      })
      const output = compiledTemplate(values)
      const relativeOutputPath = path.relative(
        path.join(baseInputDirectory, 'deploy/templates'),
        template.path,
      )
      const templateOutputPath = path.resolve(outputDirectory, relativeOutputPath)
      await fs.promises.mkdir(path.dirname(templateOutputPath), {recursive: true})

      await fs.promises.writeFile(templateOutputPath, output, 'utf-8')
    } catch (err) {
      throw new Error(
        `Error writeing output of template ${template.path}: ${err.message || String(err)}`,
      )
    }
  }
}

/**
 * @param {string} baseInputDirectory
 * @param {string[]} packageFolders
 * @param {string[]} valueFiles
 * @param {string | undefined} cluster
 */
function determineAdditionalFolders(baseInputDirectory, packageFolders, valueFiles, cluster) {
  let finalValueFiles = [...valueFiles]
  let partialFolders = /**@type {string[]} */ ([])

  packageFolders.concat(baseInputDirectory).forEach((p) => {
    const pkg = resolvePackagePath(baseInputDirectory, p)
    if (!pkg) throw new Error(`could not find package ${p}`)

    partialFolders = [
      path.resolve(pkg, `deploy/partials}`),
      ...(cluster ? [path.resolve(pkg, `deploy/partials/${cluster}`)] : []),
      ...partialFolders,
    ]

    finalValueFiles = [
      path.resolve(pkg, `deploy/values.yaml`),
      ...(cluster ? [path.resolve(pkg, `deploy/clusters/${cluster}.yaml`)] : []),
      ...finalValueFiles,
    ]
  })

  return {partialFolders, valueFiles: finalValueFiles}
}

/**
 * @param {typeof Handlebars} handlebars
 * @param {string[]} partialFiles
 * @param {string | undefined} cluster
 */
function registerHelpersInHandlerbars(handlebars, partialFiles, cluster) {
  for (let partialFile of partialFiles) {
    const partialContent = fs.readFileSync(partialFile, {
      encoding: 'utf8',
    })

    handlebars.registerPartial(normalizeKdeployFileNames(partialFile), partialContent)
  }

  handlebars.registerHelper('helperMissing', function (context) {
    throw new Error('Template defines {{' + context.name + '}}, but not provided in context')
  })

  handlebars.registerHelper('json', function (context) {
    return JSON.stringify(context)
  })

  handlebars.registerPartial('json', function (context) {
    return `${JSON.stringify(context, null, 2)}\n`
  })

  handlebars.registerHelper('isForCluster', function (clusterName) {
    return cluster === clusterName
  })
  return handlebars
}

/**
 * @param {string[]} partialFolders
 */
function determinePartialFiles(partialFolders) {
  const partialFiles = /**@type {string[]}*/ ([])
  const hasPartialFileName = /**@type {Map<string, boolean>}*/ (new Map())

  for (const partialFolder of partialFolders) {
    if (fs.existsSync(partialFolder)) {
      const files = fs.readdirSync(partialFolder)
      files.forEach((f) => {
        const filePath = path.join(partialFolder, f)
        const name = normalizeKdeployFileNames(filePath)

        if (!hasPartialFileName.has(name)) {
          hasPartialFileName.set(name, true)
          partialFiles.push(filePath)
        }
      })
    }
  }
  return partialFiles
}

/**
 * @param {string[]} valueFiles
 * @param {string[]} overrides
 * @returns {Record<string, string>}
 */
function generateValues(valueFiles, overrides) {
  /**@type {Record<string, string>} */
  const ret = {}

  valueFiles
    .filter((file) => fs.existsSync(file))
    .map((file) => yaml.safeLoad(fs.readFileSync(file).toString()))
    .forEach((jsobj) => Object.assign(ret, jsobj))

  overrides.forEach((o) => {
    const [key, value] = o.split('=')
    if (key && value) {
      set_(ret, key, value)
    } else {
      throw new Error(`Bad format for override "${o}". Should be key=value`)
    }
  })

  return ret
}

/**
 * @param {string} baseInputDirectory
 * @param {string} filePath
 * @returns {string | undefined}
 */
function resolvePackagePath(baseInputDirectory, filePath) {
  return /^(\.|\/)/.test(filePath)
    ? filePath
    : pkgDir.sync(
        module.createRequire(path.join(baseInputDirectory, 'node_modules')).resolve(filePath),
      )
}

/**
 *
 * @param {string} templatesFolder
 */
function readTemplates(templatesFolder) {
  if (!fs.existsSync(templatesFolder)) return []
  return fs
    .readdirSync(templatesFolder)
    .sort()
    .map((t) => {
      return {
        content: fs.readFileSync(path.join(templatesFolder, t), {
          encoding: 'utf8',
        }),
        name: path.parse(t).name.toLowerCase(),
        path: path.join(templatesFolder, t),
      }
    })
}

/**
 * @param {string} filePath
 * @returns {string}
 */
function normalizeKdeployFileNames(filePath) {
  const basename = path.basename(filePath).toLowerCase()

  return basename.substr(0, basename.indexOf('.'))
}
