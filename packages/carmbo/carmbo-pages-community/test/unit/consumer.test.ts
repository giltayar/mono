import assert from 'node:assert/strict'
import test from 'node:test'
import * as communityRoutes from '@giltayar/carmbo-pages-community/routes'
import * as communityFormPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/community-form.model'
import * as communityHistoryPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/community-history.model'
import * as communityListPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/community-list-page.model'
import * as newCommunityPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-page.model'
import * as updateCommunityPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/update-community-page.model'
import * as viewCommunityHistoryPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/view-community-history-page.model'
import * as memberPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/community-member.model'
import * as newMemberPageModel from '@giltayar/carmbo-pages-community/testkit/page-model/new-community-member-page.model'

test('publishes the intended package entry points', () => {
  assert.deepEqual(Object.keys(communityRoutes), ['routes'])
  assert.deepEqual(Object.keys(communityFormPageModel), ['communityFormPageModel'])
  assert.deepEqual(Object.keys(communityHistoryPageModel), ['createCommunityHistoryPageModel'])
  assert.deepEqual(Object.keys(communityListPageModel), ['createCommunityListPageModel'])
  assert.deepEqual(Object.keys(newCommunityPageModel), ['createNewCommunityPageModel'])
  assert.deepEqual(Object.keys(updateCommunityPageModel), ['createUpdateCommunityPageModel'])
  assert.deepEqual(Object.keys(viewCommunityHistoryPageModel), [
    'createViewCommunityHistoryPageModel',
  ])
  assert.deepEqual(Object.keys(memberPageModel), [
    'createCommunityMemberPageModel',
    'createCommunityMembersPageModel',
  ])
  assert.deepEqual(Object.keys(newMemberPageModel), ['createNewCommunityMemberPageModel'])
})

test('does not publish internal modules', async () => {
  for (const specifier of [
    '@giltayar/carmbo-pages-community/model',
    '@giltayar/carmbo-pages-community/src/model.ts',
    '@giltayar/carmbo-pages-community/dist/src/controller.js',
  ]) {
    await assert.rejects(import(specifier), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'})
  }
})
