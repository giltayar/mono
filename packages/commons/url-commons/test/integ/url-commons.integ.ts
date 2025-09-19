import {describe, it} from 'node:test'
import assert from 'node:assert/strict'

import * as m from '@giltayar/url-commons'

describe('url-commons (integ)', function () {
  it('should be able to load', async () => {
    assert.ok(m)
  })
})
