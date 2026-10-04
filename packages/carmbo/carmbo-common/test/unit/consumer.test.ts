import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {readdir, readFile} from 'node:fs/promises'
import fastify from 'fastify'
import fastifyStatic from '@fastify/static'
import {fastifyRequestContext} from '@fastify/request-context'
import i18next from 'i18next'
import {normalizePhoneNumber} from '@giltayar/carmbo-common/commons/normalize-input'
import {initializei18next} from '@giltayar/carmbo-common/commons/i18next-utils'
import {setVersion} from '@giltayar/carmbo-common/commons/version'
import {setUiConfiguration} from '@giltayar/carmbo-common/commons/ui-configuration'
import {TEST_executeHook, type TEST_HookFunction} from '@giltayar/carmbo-common/commons/TEST_hooks'
import {layoutScriptRoot, layoutStyleRoot} from '@giltayar/carmbo-common/layout/assets'
import type {LayoutResources} from '@giltayar/carmbo-common/layout/resources'
import {MainLayout} from '@giltayar/carmbo-common/layout/main-view'
import {migrate, migrationsRoot} from '@giltayar/carmbo-common/sql/migration'

describe('compiled package consumer', () => {
  it('includes all SQL migrations, compiled data migration, and maintenance SQL', async () => {
    assert.ok(import.meta.resolve('@giltayar/carmbo-common/sql/migration').endsWith('.js'))
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
      const specifier = `@giltayar/carmbo-common/commons/${helper}`
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
    const calls: unknown[][] = []
    const hooks: Record<string, TEST_HookFunction> = {
      render: async (...args) => {
        calls.push(args)
      },
    }
    app.register(fastifyRequestContext, {defaultStoreValues: {TEST_hooks: hooks}})
    for (const [directory, root] of [
      ['style', layoutStyleRoot],
      ['js', layoutScriptRoot],
    ] as const) {
      app.register(fastifyStatic, {
        root,
        prefix: `/src/10.0.1/layout/${directory}/`,
        decorateReply: false,
        immutable: true,
        maxAge: '1y',
        allowedPath: (path) => /\.(js|css|png|svg)$/.test(path),
      })
    }
    app.get('/', async () => {
      await TEST_executeHook('render', 'consumer')
      return MainLayout({title: 'Consumer', children: [], activeNavItem: 'students'})
    })

    const page = await app.inject('/')
    assert.equal(page.statusCode, 200, page.body)
    assert.match(page.body, /Students/)
    assert.match(page.body, /\/src\/10\.0\.1\/layout\/style\/configurations\/carmel\/logo\.png/)
    assert.deepEqual(calls, [['consumer']])

    for (const [path, root, file, contentType] of [
      ['style/style.css', layoutStyleRoot, 'style.css', 'text/css'],
      ['js/scripts.js', layoutScriptRoot, 'scripts.js', 'application/javascript'],
      ['style/link.svg', layoutStyleRoot, 'link.svg', 'image/svg+xml'],
      ['style/external-link.svg', layoutStyleRoot, 'external-link.svg', 'image/svg+xml'],
      ['style/plus-circle.svg', layoutStyleRoot, 'plus-circle.svg', 'image/svg+xml'],
      ['style/minus-circle.svg', layoutStyleRoot, 'minus-circle.svg', 'image/svg+xml'],
      [
        'style/configurations/carmel/logo.png',
        layoutStyleRoot,
        'configurations/carmel/logo.png',
        'image/png',
      ],
      [
        'style/configurations/liraz/logo.svg',
        layoutStyleRoot,
        'configurations/liraz/logo.svg',
        'image/svg+xml',
      ],
    ] as const) {
      const response = await app.inject(`/src/10.0.1/layout/${path}`)
      assert.equal(response.statusCode, 200, path)
      assert.ok(response.headers['content-type']?.startsWith(contentType), path)
      assert.match(response.headers['cache-control'] ?? '', /max-age=31536000, immutable/)
      assert.deepEqual(response.rawPayload, await readFile(new URL(file, root)))
    }
    for (const path of [
      'main-view.js',
      'assets.js',
      'locale/en.json',
      'js/scripts.d.ts',
      'js/scripts.js.map',
    ]) {
      assert.equal((await app.inject(`/src/10.0.1/layout/${path}`)).statusCode, 404, path)
    }
    assert.ok((await readdir(layoutScriptRoot)).includes('scripts.js'))

    setUiConfiguration('liraz')
    await initializei18next('he')
    const hebrewPage = await app.inject('/')
    assert.equal(hebrewPage.statusCode, 200, hebrewPage.body)
    assert.match(hebrewPage.body, /lang="he" dir="rtl"/)
    assert.match(hebrewPage.body, /bootstrap\.rtl\.min\.css/)
    assert.match(hebrewPage.body, /configurations\/liraz\/logo\.svg/)
  })
})
