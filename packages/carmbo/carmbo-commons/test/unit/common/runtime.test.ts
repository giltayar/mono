import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import fastify from 'fastify'
import {fastifyRequestContext, requestContext} from '@fastify/request-context'
import i18next from 'i18next'
import {initializei18next} from '../../../src/commons/i18next-utils.ts'
import {setVersion, getVersion} from '../../../src/commons/version.ts'
import {getUiConfiguration, setUiConfiguration} from '../../../src/commons/ui-configuration.ts'
import {
  TEST_executeHook,
  resetHooks,
  type TEST_HookFunction,
} from '../../../src/commons/TEST_hooks.ts'
import {MainLayout} from '../../../src/layout/main-view.ts'
import {exceptionToBanner} from '../../../src/layout/banner.ts'
import heLayout from '../../../src/layout/locale/he.json' with {type: 'json'}

describe('application configuration', () => {
  it('requires explicit version and branding configuration', () => {
    assert.throws(() => getVersion(), /Call setVersion/)
    assert.throws(
      () => MainLayout({title: 'Test', children: [], activeNavItem: 'no-nav-bar'}),
      /Call setVersion/,
    )
    assert.throws(() => setVersion('  '), /must not be empty/)
    assert.throws(() => getUiConfiguration(), /Call setUiConfiguration/)
  })

  it('uses the supplied app version for every layout asset', async () => {
    setVersion('10.0.1')
    setUiConfiguration('carmel')
    await initializei18next(undefined)

    const result = MainLayout({title: 'Test', children: ['Content'], activeNavItem: 'students'})
    assert.equal(getVersion(), '10.0.1')
    assert.match(result, /lang="en" dir="ltr"/)
    for (const path of [
      '/dist/10.0.1/bootstrap.min.css',
      '/dist/10.0.1/htmx.min.js',
      '/dist/10.0.1/bootstrap.bundle.min.js',
      '/src/10.0.1/layout/style/style.css',
      '/src/10.0.1/layout/js/scripts.js',
      '/src/10.0.1/layout/style/configurations/carmel/logo.png',
    ]) {
      assert.ok(result.includes(path), path)
    }
    assert.match(result, /Students/)
    assert.match(result, /Content/)
    assert.match(result, /nav-link active/)
  })

  it('supports Hebrew, RTL styling, and the Liraz SVG logo', async () => {
    setUiConfiguration('liraz')
    await initializei18next('he')

    const result = MainLayout({title: 'Test', children: [], activeNavItem: 'sales'})
    assert.match(result, /lang="he" dir="rtl"/)
    assert.match(result, /bootstrap\.rtl\.min\.css/)
    assert.match(result, /configurations\/liraz\/logo\.svg/)
    assert.ok(result.includes(heLayout.nav.students))
    assert.equal(i18next.t('nav.students', {ns: 'layout'}), heLayout.nav.students)
  })

  it('rejects missing logos without replacing the last valid configuration', () => {
    assert.throws(() => setUiConfiguration('missing-brand'), /No valid logo file found/)
    assert.deepEqual(getUiConfiguration(), {name: 'liraz', logoFile: 'logo.svg'})
  })

  it('loads app namespaces from the supplied locale root using the shared i18next instance', async () => {
    await initializei18next('en', {
      root: new URL('../../fixtures/domain/', import.meta.url),
      namespaces: ['student'],
    })

    assert.equal(i18next.t('errors.failed', {ns: 'student'}), 'Student operation failed')
    assert.deepEqual(exceptionToBanner('Error: ', {code: 'failed'}, {errorCodeNs: 'student'}), {
      message: 'Error: Student operation failed',
      type: 'error',
      disappearing: false,
    })
    assert.equal(i18next.t('nav.students', {ns: 'layout'}), 'Students')
  })
})

describe('request-context test hooks', () => {
  it('executes and resets hooks registered by the consuming application', async (t) => {
    const app = fastify()
    t.after(() => app.close())
    const calls: unknown[][] = []
    const hooks: Record<string, TEST_HookFunction> = {
      example: async (...args) => {
        calls.push(args)
      },
    }
    app.register(fastifyRequestContext, {defaultStoreValues: {TEST_hooks: hooks}})
    app.get('/', async () => {
      assert.equal(requestContext.get('TEST_hooks'), hooks)
      await TEST_executeHook('example', 'argument', 42)
      await TEST_executeHook('missing')
      resetHooks()
      await TEST_executeHook('example', 'after reset')
      return {ok: true}
    })

    const response = await app.inject('/')
    assert.equal(response.statusCode, 200, response.body)
    assert.deepEqual(calls, [['argument', 42]])
    assert.deepEqual(hooks, {})
  })

  it('preserves no-op behavior when hooks are not configured', async () => {
    await TEST_executeHook('missing')
    resetHooks()
  })
})
