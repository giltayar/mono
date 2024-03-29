#!/usr/bin/env node
import {getDependencyInformation} from './dependencies-commons.js'

const [pkg, cwd = process.cwd()] = process.argv.slice(2, 4)

if (!pkg) {
  throw new Error('pkg2 must be specified')
}

const dependencyInformation = getDependencyInformation(process.cwd())

const pkgInfo = dependencyInformation[pkg]

if (!pkgInfo) {
  throw new Error(`could not find package ${pkg} in ${cwd}`)
}

process.stdout.write(dependencyInformation[pkg].version)
