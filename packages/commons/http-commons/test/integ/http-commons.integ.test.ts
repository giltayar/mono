import {describe, it, before, after} from 'node:test'
import assert from 'node:assert'
import fastify from 'fastify'

import {
  fetch,
  fetchAsBuffer,
  fetchAsBufferWithJsonBody,
  fetchAsJson,
  fetchAsJsonWithJsonBody,
  fetchAsJsonWithUrlEncodedForm,
  fetchAsText,
  fetchAsTextWithJsonBody,
} from '@giltayar/http-commons'

describe('http-commons', function () {
  let app: ReturnType<typeof createApp> | undefined
  let baseUrl: string | undefined

  before(async () => {
    app = createApp()

    baseUrl = await app.listen({port: 0})
  })

  after(() => app?.close())

  it('should fetch http as buffer', async () => {
    assert.deepStrictEqual(
      await fetchAsBuffer(`${baseUrl!}/buffer`),
      new TextEncoder().encode('GET').buffer,
    )
    assert.deepStrictEqual(
      await fetchAsBuffer(`${baseUrl!}/buffer`, {method: 'POST'}),
      new TextEncoder().encode('POST').buffer,
    )
  })

  it('should fetch http as text', async () => {
    assert.deepStrictEqual(await fetchAsText(`${baseUrl!}/text`), 'GET')
    assert.deepStrictEqual(await fetchAsText(`${baseUrl!}/text`, {method: 'POST'}), 'POST')
  })

  it('should fetch http as json', async () => {
    const getResponse = (await fetchAsJson(`${baseUrl!}/json`)) as any
    assert.deepStrictEqual(getResponse.method, 'GET')
    assert.deepStrictEqual(getResponse.headers.accept, 'application/json')

    const postResponse = (await fetchAsJson(`${baseUrl!}/json`, {
      method: 'POST',
    })) as any
    assert.deepStrictEqual(postResponse.method, 'POST')
    assert.deepStrictEqual(postResponse.headers.accept, 'application/json')
  })

  it('should send json http as json and return text', async () => {
    assert.deepStrictEqual(
      JSON.parse(await fetchAsTextWithJsonBody(`${baseUrl!}/json-echo`, {hello: 'world'})),
      {method: 'POST', hello: 'world'},
    )

    assert.deepStrictEqual(
      JSON.parse(
        await fetchAsTextWithJsonBody(`${baseUrl!}/json-echo`, {hello: 'world'}, {method: 'PUT'}),
      ),
      {method: 'PUT', hello: 'world'},
    )
  })

  it('should send json http as json and return a buffer', async () => {
    assert.deepStrictEqual(
      JSON.parse(
        new TextDecoder().decode(
          await fetchAsBufferWithJsonBody(`${baseUrl!}/json-echo`, {hello: 'world'}),
        ),
      ),
      {method: 'POST', hello: 'world'},
    )

    const buffer = await fetchAsBufferWithJsonBody(
      `${baseUrl!}/json-echo`,
      {hello: 'world'},
      {method: 'PUT'},
    )
    assert.ok(buffer instanceof ArrayBuffer)
    assert.deepStrictEqual(JSON.parse(new TextDecoder().decode(buffer)), {
      method: 'PUT',
      hello: 'world',
    })
  })

  it('should send json http as json and return json', async () => {
    assert.deepStrictEqual(
      await fetchAsJsonWithJsonBody(`${baseUrl!}/json-echo`, {hello: 'world'}),
      {
        method: 'POST',
        hello: 'world',
      },
    )

    assert.deepStrictEqual(
      await fetchAsJsonWithJsonBody(`${baseUrl!}/json-echo`, {hello: 'world'}, {method: 'PUT'}),
      {method: 'PUT', hello: 'world'},
    )
  })

  it('should send a url-encoded form and return json', async () => {
    assert.deepStrictEqual(
      await fetchAsJsonWithUrlEncodedForm(`${baseUrl!}/json-echo`, {
        hello: 'world',
        count: 42,
        when: new Date('2020-01-02T03:04:05.000Z'),
        nested: {a: [1, 2]},
      }),
      {
        method: 'POST',
        hello: 'world',
        count: '42',
        when: '2020-01-02T03:04:05.000Z',
        nested: '{"a":[1,2]}',
      },
    )

    assert.deepStrictEqual(
      await fetchAsJsonWithUrlEncodedForm(
        `${baseUrl!}/json-echo`,
        {hello: 'world'},
        {method: 'PUT'},
      ),
      {method: 'PUT', hello: 'world'},
    )
  })

  it('should send a url-encoded form with the correct content type', async () => {
    assert.partialDeepStrictEqual(
      await fetchAsJsonWithUrlEncodedForm(new URL('/headers-echo', baseUrl!), {hello: 'world'}),
      {'content-type': 'application/x-www-form-urlencoded', accept: 'application/json'},
    )
  })

  it('should send deal with a real url', async () => {
    assert.match(await fetchAsText('http://www.google.com'), /Gmail/)
    assert.match(await fetchAsText('http://www.google.com'), /Gmail/)
  })

  it('should also replace the real fetch', async () => {
    assert.strictEqual((await fetch('http://www.google.com')).ok, true)
    assert.strictEqual((await fetch('http://www.google.com')).status, 200)
  })

  it('should work with https urls', async () => {
    assert.ok(await fetchAsText('https://www.google.com'))
  })

  describe('requestId', () => {
    it('should send a request id', async () => {
      assert.partialDeepStrictEqual(
        await fetchAsJson(new URL('/headers-echo', baseUrl!), {requestId: '123'}),
        {'x-request-id': '123'},
      )
    })

    it('should send a request id along with other headers', async () => {
      assert.partialDeepStrictEqual(
        await fetchAsJson(new URL('/headers-echo', baseUrl!), {
          requestId: '123',
          headers: {'x-other': '456'},
        }),
        {'x-request-id': '123', 'x-other': '456'},
      )
    })
  })
})

function createApp() {
  const app = fastify()

  app.addContentTypeParser(
    'application/x-www-form-urlencoded',
    {parseAs: 'string'},
    (_req, body, done) =>
      done(null, Object.fromEntries(new URLSearchParams(body as string).entries())),
  )

  app.all('/buffer', (req) => Promise.resolve(Buffer.from(req.method)))
  app.all('/text', (req) => Promise.resolve(req.method))
  app.all('/json', (req) => Promise.resolve({method: req.method, headers: req.headers}))

  app.all('/json-echo', (req) => {
    const body: object = req.body as object

    return Promise.resolve({method: req.method, ...body})
  })

  app.all('/headers-echo', (req) => Promise.resolve(req.headers))

  return app
}
