import assert from 'node:assert/strict'
import {describe, it} from 'node:test'
import {CommunitySchema, NewCommunitySchema} from '../../src/model.ts'
import {CommunityViewSchema} from '../../src/view/model.ts'
import {communityToView, viewToCommunity, viewToNewCommunity} from '../../src/view-model-mapping.ts'

describe('view schema', () => {
  it('accepts any strings and has no id', () => {
    assert.deepEqual(CommunityViewSchema.parse({name: '', description: ''}), {
      name: '',
      description: '',
    })
    assert.deepEqual(
      CommunityViewSchema.parse({communityNumber: '3', name: ' x ', description: '  '}),
      {name: ' x ', description: '  '},
    )
  })

  it('rejects non-string fields', () => {
    assert.throws(() => CommunityViewSchema.parse({name: 3, description: ''}))
    assert.throws(() => CommunityViewSchema.parse({description: ''}))
  })
})

describe('model schema', () => {
  it('trims and requires a non-empty name', () => {
    assert.deepEqual(NewCommunitySchema.parse({name: '  Yoga  ', description: ' Calm '}), {
      name: 'Yoga',
      description: 'Calm',
    })
    assert.throws(() => NewCommunitySchema.parse({name: '   '}), /name/)
    assert.throws(() => NewCommunitySchema.parse({name: ''}), /name/)
  })

  it('makes the description optional', () => {
    assert.deepEqual(NewCommunitySchema.parse({name: 'Yoga'}), {name: 'Yoga'})
  })

  it('requires a positive integer community number', () => {
    assert.deepEqual(CommunitySchema.parse({communityNumber: 4, name: 'Yoga'}), {
      communityNumber: 4,
      name: 'Yoga',
    })
    assert.throws(() => CommunitySchema.parse({communityNumber: 0, name: 'Yoga'}))
    assert.throws(() => CommunitySchema.parse({communityNumber: '4', name: 'Yoga'}))
  })
})

describe('view to model mapping', () => {
  it('converts view strings to a new community without validating', () => {
    assert.deepEqual(viewToNewCommunity({name: 'Yoga', description: 'Calm'}), {
      name: 'Yoga',
      description: 'Calm',
    })
    assert.deepEqual(viewToNewCommunity({name: '  ', description: ''}), {
      name: '  ',
      description: undefined,
    })
    assert.deepEqual(viewToNewCommunity({name: 'Yoga', description: '   '}), {
      name: 'Yoga',
      description: undefined,
    })
  })

  it('takes the community number from outside the view', () => {
    assert.deepEqual(viewToCommunity(7, {name: 'Yoga', description: ''}), {
      communityNumber: 7,
      name: 'Yoga',
      description: undefined,
    })
  })
})

describe('model to view mapping', () => {
  it('converts a community to view strings', () => {
    assert.deepEqual(communityToView({name: 'Yoga', description: 'Calm'}), {
      name: 'Yoga',
      description: 'Calm',
    })
    assert.deepEqual(communityToView({name: 'Yoga', description: undefined}), {
      name: 'Yoga',
      description: '',
    })
  })
})
