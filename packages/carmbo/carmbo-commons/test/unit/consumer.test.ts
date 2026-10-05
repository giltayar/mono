import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {mkdtemp, readdir, readFile, rm, writeFile} from 'node:fs/promises'
import {tmpdir} from 'node:os'
import {join} from 'node:path'
import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import {fastifyRequestContext} from '@fastify/request-context'
import i18next from 'i18next'
import {normalizePhoneNumber} from '@giltayar/carmbo-commons/commons/normalize-input'
import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'
import {setVersion} from '@giltayar/carmbo-commons/commons/version'
import {setUiConfiguration} from '@giltayar/carmbo-commons/commons/ui-configuration'
import {TEST_executeHook, type TEST_HookFunction} from '@giltayar/carmbo-commons/commons/TEST_hooks'
import {layoutAssetRoutes} from '@giltayar/carmbo-commons/layout/assets'
import type {LayoutResources} from '@giltayar/carmbo-commons/layout/resources'
import {MainLayout} from '@giltayar/carmbo-commons/layout/main-view'
import {migrate, migrationsRoot} from '@giltayar/carmbo-commons/sql/migration'
import {createAllPagesPageModel} from '@giltayar/carmbo-commons/testkit/page-model/all-pages.model'

describe('compiled package consumer', () => {
  it('exports the shared page model through the testkit', () => {
    assert.equal(typeof createAllPagesPageModel, 'function')
  })

  it('exposes asset routes without exposing internal asset roots', async () => {
    const assets = await import('@giltayar/carmbo-commons/layout/assets')
    assert.deepEqual(Object.keys(assets), ['layoutAssetRoutes'])
    assert.throws(() => import.meta.resolve('@giltayar/carmbo-commons/layout/asset-roots'), {
      code: 'ERR_PACKAGE_PATH_NOT_EXPORTED',
    })
  })

  it('includes all SQL migrations, compiled data migration, and maintenance SQL', async () => {
    assert.ok(import.meta.resolve('@giltayar/carmbo-commons/sql/migration').endsWith('.js'))
    assert.equal(typeof migrate, 'function')
    const files = await readdir(migrationsRoot)
    const migrations = files.filter((name) => /^\d{5}_.*\.(sql|js)$/.test(name)).sort()
    assert.equal(migrations.length, 44)
    assert.deepEqual(
      migrations.map((name) => Number(name.slice(0, 5))),
      Array.from({length: 44}, (_, index) => index + 1),
    )
    assert.ok(migrations.includes('00027_add_connected_and_active_statuses.js'))
    assert.equal(
      typeof (
        await import(new URL('00027_add_connected_and_active_statuses.js', migrationsRoot).href)
      ).default,
      'function',
    )
    assert.ok(
      (await readFile(new URL('maintenance/maintaining-production.sql', migrationsRoot))).length,
    )
  })

  it('loads all helper exports from compiled JavaScript', async () => {
    const helpers = [
      'TEST_hooks',
      'controller-result',
      'external-provider/ravmesser-lists',
      'external-provider/smoove-lists',
      'external-provider/whatsapp-groups',
      'hebrew',
      'html-templates',
      'i18next-utils',
      'normalize-input',
      'now-service',
      'operation-type',
      'routes-commons',
      'schema-commons',
      'sql-commons',
      'ui-configuration',
      'validity-error',
      'version',
      'view-commons',
    ]
    for (const helper of helpers) {
      const specifier = `@giltayar/carmbo-commons/commons/${helper}`
      assert.ok(import.meta.resolve(specifier).endsWith(`/dist/src/commons/${helper}.js`))
      await import(specifier)
    }
    assert.equal(normalizePhoneNumber('+972501234567'), '0501234567')
  })

  it('renders and serves installed assets at the app-version URLs', async (t) => {
    setVersion('10.0.1')
    setUiConfiguration('carmel')
    await initializei18next('en')
    const translated: LayoutResources['nav']['students'] = i18next.t('nav.students', {
      ns: 'layout',
    })
    assert.equal(translated, 'Students')

    const app = fastify()
    t.after(() => app.close())
    const appAssetRoot = await mkdtemp(join(tmpdir(), 'carmbo-consumer-assets-'))
    t.after(() => rm(appAssetRoot, {recursive: true, force: true}))
    const appScript = 'console.log("app-owned asset")'
    await writeFile(join(appAssetRoot, 'app.js'), appScript)
    const calls: unknown[][] = []
    const hooks: Record<string, TEST_HookFunction> = {
      render: async (...args) => {
        calls.push(args)
      },
    }
    app.register(fastifyRequestContext, {defaultStoreValues: {TEST_hooks: hooks}})
    app.register(fastifyStatic, {
      root: appAssetRoot,
      prefix: '/src/10.0.1/',
      decorateReply: false,
    })
    app.register(layoutAssetRoutes)
    app.get('/', async () => {
      await TEST_executeHook('render', 'consumer')
      return MainLayout({title: 'Consumer', children: [], activeNavItem: 'students'})
    })

    const page = await app.inject('/')
    assert.equal(page.statusCode, 200, page.body)
    assert.match(page.body, /Students/)
    assert.match(page.body, /\/src\/10\.0\.1\/layout\/style\/configurations\/carmel\/logo\.png/)
    assert.deepEqual(calls, [['consumer']])
    const appAsset = await app.inject('/src/10.0.1/app.js')
    assert.equal(appAsset.statusCode, 200)
    assert.equal(appAsset.body, appScript)
    assert.equal((await app.inject('/src/other-version/layout/js/scripts.js')).statusCode, 404)

    for (const [path, contentType] of [
      ['style/style.css', 'text/css'],
      ['js/scripts.js', 'application/javascript'],
      ['style/link.svg', 'image/svg+xml'],
      ['style/external-link.svg', 'image/svg+xml'],
      ['style/plus-circle.svg', 'image/svg+xml'],
      ['style/minus-circle.svg', 'image/svg+xml'],
      ['style/configurations/carmel/logo.png', 'image/png'],
      ['style/configurations/liraz/logo.svg', 'image/svg+xml'],
    ] as const) {
      const response = await app.inject(`/src/10.0.1/layout/${path}`)
      assert.equal(response.statusCode, 200, path)
      assert.ok(response.headers['content-type']?.startsWith(contentType), path)
      assert.match(response.headers['cache-control'] ?? '', /max-age=31536000, immutable/)
      if (contentType === 'image/png') {
        assert.deepEqual(
          response.rawPayload.subarray(0, 8),
          Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
          path,
        )
      } else if (contentType === 'image/svg+xml') {
        assert.match(response.body, /<svg\b/, path)
      } else if (contentType === 'text/css') {
        assert.match(response.body, /\.feather\s*\{/, path)
      }
    }
    for (const path of [
      'main-view.js',
      'assets.js',
      'asset-roots.js',
      'style/../main-view.js',
      'locale/en.json',
      'js/scripts.d.ts',
      'js/scripts.js.map',
    ]) {
      assert.equal((await app.inject(`/src/10.0.1/layout/${path}`)).statusCode, 404, path)
    }
    const head = await app.inject({method: 'HEAD', url: '/src/10.0.1/layout/js/scripts.js'})
    assert.equal(head.statusCode, 200)
    assert.equal(head.body, '')
    assert.match(head.headers['cache-control'] ?? '', /max-age=31536000, immutable/)

    setUiConfiguration('liraz')
    await initializei18next('he')
    const hebrewPage = await app.inject('/')
    assert.equal(hebrewPage.statusCode, 200, hebrewPage.body)
    assert.match(hebrewPage.body, /lang="he" dir="rtl"/)
    assert.match(hebrewPage.body, /bootstrap\.rtl\.min\.css/)
    assert.match(hebrewPage.body, /configurations\/liraz\/logo\.svg/)
  })
})
