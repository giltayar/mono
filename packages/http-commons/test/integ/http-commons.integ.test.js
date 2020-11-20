import mocha from 'mocha'
const {describe, it, before, after} = mocha
import chai from 'chai'
const {expect} = chai
import express from 'express'
import bodyParser from 'body-parser'
const {raw: rawBodyParser, json: jsonBodyParser} = bodyParser

import {
  fetch,
  fetchAsBuffer,
  fetchAsBufferWithJsonBody,
  fetchAsJson,
  fetchAsJsonWithJsonBody,
  fetchAsText,
  fetchAsTextWithJsonBody,
} from '../../src/http-commons.js'

describe('http-commons', function () {
  /**@type {import('http').Server} */
  let server
  before((done) => (server = createApp().listen(0, done)))
  after((done) => server.close(done))

  // @ts-expect-error
  const baseUrl = () => `http://localhost:${server.address().port}`

  it('should fetch http as buffer', async () => {
    expect(await fetchAsBuffer(`${baseUrl()}/buffer`)).to.eql(Buffer.from('GET'))
    expect(await fetchAsBuffer(`${baseUrl()}/buffer`, {method: 'POST'})).to.eql(Buffer.from('POST'))
  })

  it('should fetch http as text', async () => {
    expect(await fetchAsText(`${baseUrl()}/text`)).to.eql('GET')
    expect(await fetchAsText(`${baseUrl()}/text`, {method: 'POST'})).to.eql('POST')
  })

  it('should fetch http as json', async () => {
    const getResponse = /**@type {any} */ (await fetchAsJson(`${baseUrl()}/json`))
    expect(getResponse.method).to.eql('GET')
    expect(getResponse.headers.accept).to.eql('application/json')

    const postResponse = /**@type {any} */ (await fetchAsJson(`${baseUrl()}/json`, {
      method: 'POST',
    }))
    expect(postResponse.method).to.eql('POST')
    expect(postResponse.headers.accept).to.eql('application/json')
  })

  it('should send json http as json and return text', async () => {
    expect(
      JSON.parse(await fetchAsTextWithJsonBody(`${baseUrl()}/json-echo`, {hello: 'world'})),
    ).to.eql({method: 'POST', hello: 'world'})

    expect(
      JSON.parse(
        await fetchAsTextWithJsonBody(`${baseUrl()}/json-echo`, {hello: 'world'}, {method: 'PUT'}),
      ),
    ).to.eql({method: 'PUT', hello: 'world'})
  })

  it('should send json http as json and return a buffer', async () => {
    expect(
      JSON.parse(
        String(await fetchAsBufferWithJsonBody(`${baseUrl()}/json-echo`, {hello: 'world'})),
      ),
    ).to.eql({method: 'POST', hello: 'world'})

    const buffer = await fetchAsBufferWithJsonBody(
      `${baseUrl()}/json-echo`,
      {hello: 'world'},
      {method: 'PUT'},
    )
    expect(buffer).to.be.instanceof(Buffer)
    expect(JSON.parse(String(buffer))).to.eql({method: 'PUT', hello: 'world'})
  })

  it('should send json http as json and return json', async () => {
    expect(await fetchAsJsonWithJsonBody(`${baseUrl()}/json-echo`, {hello: 'world'})).to.eql({
      method: 'POST',
      hello: 'world',
    })

    expect(
      await fetchAsJsonWithJsonBody(`${baseUrl()}/json-echo`, {hello: 'world'}, {method: 'PUT'}),
    ).to.eql({method: 'PUT', hello: 'world'})
  })

  it('should send deal with a real url', async () => {
    expect(await fetchAsText('http://example.com')).to.include('Example Domain')
    expect(await fetchAsText('http://example.com')).to.include('Example Domain')
  })

  it('should also replace the real fetch', async () => {
    expect(await fetch('http://example.com')).to.satisfy(
      /**@param {import('node-fetch').Response} response */ (response) => response.ok,
    )
    expect(await fetch('http://example.com')).to.satisfy(
      /**@param {import('node-fetch').Response} response */ (response) => response.ok,
    )
  })

  it('should work with https urls', async () => {
    expect(await fetchAsText('https://www.google.com')).to.not.be.empty
  })
})

function createApp() {
  const app = express()

  app.all('/buffer', rawBodyParser({type: () => true}), (req, res) =>
    res.send(Buffer.from(req.method)),
  )
  app.all('/text', (req, res) => res.send(req.method))
  app.all('/json', (req, res) => res.json({method: req.method, headers: req.headers}))
  app.all('/json-echo', jsonBodyParser(), (req, res) =>
    res.json(Object.assign({}, {method: req.method}, req.body)),
  )

  return app
}
