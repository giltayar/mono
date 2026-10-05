import fastifyStatic from '@fastify/static'
import type {FastifyInstance} from 'fastify'
import {getVersion} from '../commons/version.ts'
import {layoutScriptRoot, layoutStyleRoot} from './asset-roots.ts'

export function layoutAssetRoutes(app: FastifyInstance): void {
  const version = getVersion()

  for (const [directory, root] of [
    ['style', layoutStyleRoot],
    ['js', layoutScriptRoot],
  ] as const) {
    app.register(fastifyStatic, {
      root,
      prefix: `/src/${version}/layout/${directory}/`,
      decorateReply: false,
      immutable: true,
      maxAge: '1y',
      allowedPath: (pathName) =>
        pathName.endsWith('.js') ||
        pathName.endsWith('.css') ||
        pathName.endsWith('.png') ||
        pathName.endsWith('.svg'),
    })
  }
}
