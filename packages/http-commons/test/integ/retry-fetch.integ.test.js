import {makeError, throw_} from '@seasquared/functional-commons'
import {presult} from '@seasquared/promise-commons'
import chai from 'chai'
import http from 'http'
import mocha from 'mocha'
import {fetchAsText, retryFetch} from '../../src/http-commons.js'
const {describe, it, before, after} = mocha
const {expect} = chai

describe('retryFetch', function () {
  describe('real live server', () => {
    /** @type {http.Server} */
    let server
    before((done) => {
      server = http
        .createServer((req, res) => {
          if (req.url === '/404') {
            res.statusCode = 404
            res.end('')
          } else if (req.url === '/500') {
            res.statusCode = 500
            res.end('bodybody')
          } else if (req.url === '/socketkill') {
            const socket = /**@type {import('net').Socket}*/ (res.socket)
            socket.destroy()
          } else {
            res.end('')
          }
        })
        .listen(0, done)
    })
    after((done) => server && server.close(done))

    it('should not retry on 404', async () => {
      // @ts-expect-error
      const url = `http://localhost:${server.address().port}`
      let count = 0
      /** @param {Parameters<fetchAsText>} args */
      const f = (...args) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/404`), {retries: 4, sleepTime: 0}))

      expect(err.status).to.equal(404)
      expect(count).to.equal(1)
    })

    it('should retry on 500', async () => {
      // @ts-expect-error
      const url = `http://localhost:${server.address().port}`
      let count = 0
      /** @param {Parameters<fetchAsText>} args */
      const f = (...args) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/500`), {retries: 1, sleepTime: 0}))

      expect(err.status).to.equal(500)
      expect(err.statusText).to.equal('Internal Server Error')
      expect(err.headers).to.have.deep.property('connection', ['keep-alive'])
      expect(count).to.equal(2)
      expect(err.body).to.equal('bodybody')
    })

    it('should retry on ECONNREFUSED', async () => {
      // @ts-expect-error
      const url = `http://localhost:${server.address().port + ((Math.random() * 100) | 0) + 1}`
      let count = 0
      /** @param {Parameters<fetchAsText>} args */
      const f = (...args) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(`${url}/500`), {retries: 1, sleepTime: 0}))

      expect(err.code).to.equal('ECONNREFUSED')
      expect(count).to.equal(2)
    })

    it('should retry on ENOTFOUND', async () => {
      const url = `http://this-does-not-exist.really}`
      let count = 0
      /** @param {Parameters<fetchAsText>} args */
      const f = (...args) => (++count, fetchAsText(...args))

      const [err] = await presult(retryFetch(() => f(url), {retries: 1, sleepTime: 0}))

      expect(err.code).to.equal('ENOTFOUND')
      expect(count).to.equal(2)
    })
  })

  describe('retries', () => {
    it('should not retry if retries === 0 and no exception', async () => {
      let count = 0
      const f = () => ++count

      const result = await retryFetch(f, {retries: 0, sleepTime: 0})

      expect(result).to.equal(1)
      expect(count).to.equal(1)
    })

    it('should not retry if retries === 0 and exception', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 0, sleepTime: 0}))

      expect(err).to.equal(expectedError)
      expect(count).to.equal(1)
    })

    it('should retry n times if function always throws', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 4, sleepTime: 0}))

      expect(err).to.equal(expectedError)
      expect(count).to.equal(5)
    })

    it('should retry n times if function throws n times', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count <= 3 ? throw_(expectedError) : count)

      const res = await retryFetch(f, {retries: 3, sleepTime: 0})

      expect(res).to.equal(4)
      expect(count).to.equal(4)
    })
  })

  describe('sleepTime and backOff', () => {
    it('should wait the sleepTime time between retries', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const start = Date.now()
      await presult(retryFetch(f, {retries: 1, sleepTime: 500}))

      expect(count).to.equal(2)
      expect(Date.now() - start).to.be.within(450, 550)
    })

    it('should backoff sleep time between retries', async () => {
      let count = 0
      const expectedError = new Error()
      const f = () => (++count, throw_(expectedError))

      const start = Date.now()
      await presult(retryFetch(f, {retries: 3, sleepTime: 100, backoff: 2}))

      expect(count).to.equal(4)
      expect(Date.now() - start).to.be.within(650, 800)
    })
  })

  describe('retry on specific errors', () => {
    it('should retry on unknown error if idempotent', async () => {
      let count = 0

      const expectedError = makeError('ooh', {code: 'UNKNOWN'})
      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 1, idempotent: true, sleepTime: 0}))

      expect(err).to.equal(expectedError)
      expect(count).to.equal(2)
    })

    it('should not retry on unknown error if !idempotent', async () => {
      let count = 0
      const expectedError = makeError('ooh', {code: 'UNKNOWN'})

      const f = () => (++count, throw_(expectedError))

      const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

      expect(err).to.equal(expectedError)
      expect(count).to.equal(1)
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

        expect(err).to.equal(expectedError)
        expect(count).to.equal(2)
      })

      it(`should retry on ${errCode} if idempotent`, async () => {
        let count = 0
        const expectedError = makeError('ooh', {code: errCode, idempotent: true})

        const f = () => (++count, throw_(expectedError))

        const [err] = await presult(retryFetch(f, {retries: 1, idempotent: false, sleepTime: 0}))

        expect(err).to.equal(expectedError)
        expect(count).to.equal(2)
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

          expect(err).to.equal(expectedError)
          expect(count).to.equal(1)
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

          expect(err).to.equal(expectedError)
          expect(count).to.equal(1)
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

          expect(err).to.equal(expectedError)
          expect(count).to.equal(2)
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

          expect(err).to.equal(expectedError)
          expect(count).to.equal(2)
        })
      }
    }
  })
})
