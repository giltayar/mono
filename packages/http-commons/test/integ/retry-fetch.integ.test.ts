import {makeError, throw_} from '@giltayar/functional-commons'
import {describe, it, before, after} from 'node:test'
import assert from 'node:assert'
import {presult} from '@giltayar/promise-commons'
import http from 'http'
import {fetchAsText, retryFetch} from '@giltayar/http-commons'

describe('retryFetch', function () {
  describe('real live server', () => {
    let server: http.Server

    before(async () => {
      server = await new Promise((resolve) => {
        const server = http
          .createServer((req, res) => {
            if (req.url === '/404') {
              res.statusCode = 404
              res.end('')
            } else if (req.url === '/500') {
              res.statusCode = 500
              res.end('bodybody')
            } else if (req.url === '/socketkill') {
              const socket = res.socket
              socket!.destroy()
            } else {
              res.end('')
            }
          })
          .listen(0, () => resolve(server))
      })
    })
    after(() =>
      server ? new Promise((resolve) => server.close(resolve)) : Promise.resolve(undefined),
    )

    it('should not retry on 404', async () => {
      //@ts-expect-error this is OK
      const url = `http://localhost:${server!.address().port}`
      let count = 0
      const f = (...args: Parameters<typeof fetchAsText>) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/404`), {retries: 4, sleepTime: 0}))

      assert.strictEqual((err as any).status, 404)
      assert.strictEqual(count, 1)
    })

    it('should retry on 500', async () => {
      //@ts-expect-error this is OK
      const url = `http://localhost:${server.address().port}`
      let count = 0
      const f = (...args: Parameters<typeof fetchAsText>) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/500`), {retries: 1, sleepTime: 0}))

      assert.strictEqual((err as any).status, 500)
      assert.strictEqual((err as any).statusText, 'Internal Server Error')
      assert.strictEqual((err as any).headers.connection, 'keep-alive')
      assert.strictEqual(count, 2)
      assert.strictEqual((err as any).body, 'bodybody')
    })

    it('should retry on ECONNREFUSED', async () => {
      //@ts-expect-error this is OK () => {
      const url = `http://localhost:${server.address().port + ((Math.random() * 100) | 0) + 1}`
      let count = 0
      const f = (...args: Parameters<typeof fetchAsText>) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/500`), {retries: 1, sleepTime: 0}))

      assert.strictEqual((err as any).code, 'ECONNREFUSED')
      assert.strictEqual(count, 2)
    })

    it('should retry on ENOTFOUND', async () => {
      const url = `http://this-does-not-exist.really}`
      let count = 0
      const f = (...args: Parameters<typeof fetchAsText>) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(url), {retries: 1, sleepTime: 0}))

      assert.strictEqual((err as any).code, 'ENOTFOUND')
      assert.strictEqual(count, 2)
    })
  })

  describe('retries', () => {
    it('should not retry if retries === 0 and no exception', async () => {
      let count = 0
      const f = () => ++count

      const result = await retryFetch(f, {retries: 0, sleepTime: 0})

      assert.strictEqual(result, 1)
      assert.strictEqual(count, 1)
    })

    it('should not retry if retries === 0 and exception', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 0, sleepTime: 0}))

      assert.deepStrictEqual(err, expectedError)
      assert.strictEqual(count, 1)
    })

    it('should retry n times if function always throws', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 4, sleepTime: 0}))

      assert.deepStrictEqual(err, expectedError)
      assert.strictEqual(count, 5)
    })

    it('should retry n times if function throws n times', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count <= 3 ? throw_(expectedError) : count)

      const res = await retryFetch(f, {retries: 3, sleepTime: 0})

      assert.strictEqual(res, 4)
      assert.strictEqual(count, 4)
    })
  })

  describe('sleepTime and backOff', () => {
    it('should wait the sleepTime time between retries', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const start = Date.now()
      await presult(retryFetch(f, {retries: 1, sleepTime: 500}))
      const duration = Date.now() - start

      assert.strictEqual(count, 2)
      assert(duration < 550 && duration > 450, `${duration} should be between 450 and 550`)
    })

    it('should backoff sleep time between retries', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const start = Date.now()
      await presult(retryFetch(f, {retries: 3, sleepTime: 100, backoff: 2}))
      const duration = Date.now() - start

      assert.strictEqual(count, 4)
      assert(duration < 800 && duration > 650, `${duration} should be between 650 and 800`)
    })
  })

  describe('retry on specific errors', () => {
    it('should retry on unknown error if idempotent', async () => {
      let count = 0

      const expectedError = makeError('ooh', {code: 'UNKNOWN'})
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 1, idempotent: true, sleepTime: 0}))

      assert.deepStrictEqual(err, expectedError)
      assert.strictEqual(count, 2)
    })

    it('should not retry on unknown error if !idempotent', async () => {
      let count = 0
      const expectedError = makeError('ooh', {code: 'UNKNOWN'})

      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

      assert.deepStrictEqual(err, expectedError)
      assert.strictEqual(count, 1)
    })

    for (const errCode of ['ECONNREFUSED', 'ENOTFOUND', 'ETIMEDOUT', 'request-timeout']) {
      it(`should retry on ${errCode} even if not idempotent`, async () => {
        let count = 0
        const expectedError = makeError('ooh', {
          code: errCode === 'request-timeout' ? undefined : errCode,
          type: errCode === 'request-timeout' ? errCode : undefined,
          idempotent: false,
        })

        const f = () => (++count, throw_(expectedError))

        const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

        assert.deepStrictEqual(err, expectedError)
        assert.strictEqual(count, 2)
      })

      it(`should retry on ${errCode} if idempotent`, async () => {
        let count = 0
        const expectedError = makeError('ooh', {code: errCode, idempotent: true})

        const f = () => (++count, throw_(expectedError))

        const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

        assert.deepStrictEqual(err, expectedError)
        assert.strictEqual(count, 2)
      })

      for (const status of [300, 301, 400, 401]) {
        it(`should not retry on HTTP ${status} even if not idempotent`, async () => {
          let count = 0
          const expectedError = makeError('ooh', {
            code: 'ERR_X_STATUS_CODE_NOT_OK',
            status,
            idempotent: false,
          })

          const f = () => (++count, throw_(expectedError))

          const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

          assert.deepStrictEqual(err, expectedError)
          assert.strictEqual(count, 1)
        })

        it(`should not retry on HTTP status ${status} if idempotent`, async () => {
          let count = 0
          const expectedError = makeError('ooh', {
            code: 'ERR_X_STATUS_CODE_NOT_OK',
            status,
            idempotent: true,
          })

          const f = () => (++count, throw_(expectedError))

          const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

          assert.deepStrictEqual(err, expectedError)
          assert.strictEqual(count, 1)
        })
      }

      for (const status of [500, 501]) {
        it(`should retry on ${status} even if not idempotent`, async () => {
          let count = 0
          const expectedError = makeError('ooh', {
            code: 'ERR_X_STATUS_CODE_NOT_OK',
            status,
            idempotent: false,
          })

          const f = () => (++count, throw_(expectedError))

          const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

          assert.deepStrictEqual(err, expectedError)
          assert.strictEqual(count, 2)
        })

        it(`should retry on HTTP status ${status} if idempotent`, async () => {
          let count = 0
          const expectedError = makeError('ooh', {
            code: 'ERR_X_STATUS_CODE_NOT_OK',
            status,
            idempotent: true,
          })

          const f = () => (++count, throw_(expectedError))

          const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

          assert.deepStrictEqual(err, expectedError)
          assert.strictEqual(count, 2)
        })
      }
    }
  })
})
