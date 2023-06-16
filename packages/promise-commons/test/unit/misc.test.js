import mocha from 'mocha'
const {describe, it} = mocha
import chai from 'chai'
const {expect} = chai

import {
  failAfter,
  presult,
  unwrapPresult,
  delay,
  makeResolveablePromise,
  resolveResolveablePromise,
  rejectResolveablePromise,
} from '../../src/promise-commons.js'

describe('functional-commons', function () {
  describe('failAfter', () => {
    it('should work', async () => {
      const start = Date.now()
      let end = Date.now()

      await failAfter(40, () => new Error('lalala')).catch((err) => {
        expect(err.message).to.equal('lalala')
        end = Date.now()
      })

      expect(end).to.not.be.undefined
      expect(end - start).to.be.greaterThan(39)
    })
  })

  describe('presult', () => {
    it('should return an error when the promise is rejected', async () => {
      const err = new Error('hi there')
      expect(await presult(Promise.reject(err))).to.eql([err, undefined])

      const [err2, value] = await presult(Promise.resolve(42))

      if (err2) {
        value
      }
    })

    it('should return the value as second array item when the promise is resolved', async () => {
      expect(await presult(Promise.resolve(42))).to.eql([undefined, 42])
    })
  })
  describe('unwrapPresult', () => {
    it('should unwrap a resolved presult to the original value', async () => {
      expect(await unwrapPresult(presult(delay(1).then(() => 42)))).to.equal(42)
    })

    it('should unwrap a rejected presult to the original value', async () => {
      expect(
        await unwrapPresult(presult(delay(1).then(() => Promise.reject(new Error('Ouch'))))).catch(
          (err) => err,
        ),
      ).to.be.instanceOf(Error)
    })
  })

  describe('delay', () => {
    it('should delay execution', async () => {
      const start = Date.now()

      expect(await delay(100)).to.be.undefined

      expect(Date.now() - start).to.be.gte(100)
    })
  })

  describe('makeResolveablePromise', () => {
    it('should resolve a promise externally', async () => {
      const promise = makeResolveablePromise()

      delay(10).then(() => resolveResolveablePromise(promise, 42))

      expect(await promise).to.equal(42)
    })

    it('should reject a promise externally', async () => {
      const promise = makeResolveablePromise()

      delay(10).then(() => rejectResolveablePromise(promise, new Error('oh')))

      expect(await presult(promise)).to.satisfy(
        /**@param{[Error]} err*/ ([err]) => expect(err.message).to.equal('oh'),
      )
    })
  })
})
