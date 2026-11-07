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
import * as emailRoutes from '@giltayar/carmbo-pages-community/email/routes'
import * as emailService from '../../src/email/email-service.ts'
import * as emailTestkit from '../../testkit/fake-email-service.ts'
import * as emailPageModels from '@giltayar/carmbo-pages-community/testkit/page-model/email.model'

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
  assert.deepEqual(Object.keys(emailRoutes), ['routes'])
  assert.deepEqual(Object.keys(emailService), ['EmailSendingError', 'createResendEmailService'])
  assert.deepEqual(Object.keys(emailTestkit), ['createFakeEmailService'])
  assert.deepEqual(Object.keys(emailPageModels), [
    'createEmailListPageModel',
    'createEmailPageModel',
  ])
})

test('does not publish internal modules', async () => {
  for (const specifier of [
    '@giltayar/carmbo-pages-community/model',
    '@giltayar/carmbo-pages-community/src/model.ts',
    '@giltayar/carmbo-pages-community/dist/src/controller.js',
    '@giltayar/carmbo-pages-community/email/model',
    '@giltayar/carmbo-pages-community/email/testkit',
  ]) {
    await assert.rejects(import(specifier), {code: 'ERR_PACKAGE_PATH_NOT_EXPORTED'})
  }
})
