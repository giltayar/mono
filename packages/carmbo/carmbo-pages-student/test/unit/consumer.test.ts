import assert from 'node:assert/strict'
import test from 'node:test'
import * as studentRoutes from '@giltayar/carmbo-pages-student/routes'
import * as students from '@giltayar/carmbo-pages-student/students'
import * as newStudentPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/new-student-page.model'
import * as studentFormPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/student-form.model'
import * as studentHistoryPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/student-history.model'
import * as studentListPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/student-list-page.model'
import * as studentSalesPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/student-sales-page.model'
import * as updateStudentPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/update-student-page.model'
import * as viewStudentHistoryPageModel from '@giltayar/carmbo-pages-student/testkit/page-model/view-student-history-page.model'

test('publishes the intended package entry points', () => {
  assert.deepEqual(Object.keys(studentRoutes), ['routes'])
  assert.deepEqual(Object.keys(students), ['createStudent'])
  assert.deepEqual(Object.keys(newStudentPageModel), ['createNewStudentPageModel'])
  assert.deepEqual(Object.keys(studentFormPageModel), ['studentFormPageModel'])
  assert.deepEqual(Object.keys(studentHistoryPageModel), ['createStudentHistoryPageModel'])
  assert.deepEqual(Object.keys(studentListPageModel), ['createStudentListPageModel'])
  assert.deepEqual(Object.keys(studentSalesPageModel), ['createStudentSalesPageModel'])
  assert.deepEqual(Object.keys(updateStudentPageModel), ['createUpdateStudentPageModel'])
  assert.deepEqual(Object.keys(viewStudentHistoryPageModel), ['createViewStudentHistoryPageModel'])
})
