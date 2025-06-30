import {describe, it} from 'node:test'
import assert from 'node:assert'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'

describe('Academy Integration Testkit', () => {
  const testCourseId = 'course-123'
  const anotherCourseId = 'course-456'
  const testEmail = 'student@example.com'
  const anotherEmail = 'another@example.com'

  const createTestService = () => {
    return createFakeAcademyIntegrationService({
      courses: {
        [testCourseId]: {
          id: testCourseId,
          name: 'Test Course',
          chapters: ['chapter-1', 'chapter-2', 'chapter-3'],
          enrolledContacts: new Set([testEmail, anotherEmail]),
        },
        [anotherCourseId]: {
          id: anotherCourseId,
          name: 'Another Course',
          chapters: ['chapter-a', 'chapter-b'],
          enrolledContacts: new Set([testEmail]),
        },
        'empty-course': {
          id: 'empty-course',
          name: 'Empty Course',
          chapters: ['chapter-empty'],
          enrolledContacts: new Set(),
        },
      },
    })
  }

  describe('removeContactFromAllCourses', () => {
    it('should remove contact from all specified courses', async () => {
      const service = createTestService()

      await service.removeContactFromAllCourses(testEmail, [testCourseId, anotherCourseId])

      const isEnrolledInTestCourse = await service._test_isContactEnrolled(testCourseId, testEmail)
      const isEnrolledInAnotherCourse = await service._test_isContactEnrolled(
        anotherCourseId,
        testEmail,
      )

      assert.strictEqual(isEnrolledInTestCourse, false)
      assert.strictEqual(isEnrolledInAnotherCourse, false)
    })

    it('should only remove specified contact, not others', async () => {
      const service = createTestService()

      await service.removeContactFromAllCourses(testEmail, [testCourseId])

      const isTestEmailEnrolled = await service._test_isContactEnrolled(testCourseId, testEmail)
      const isAnotherEmailEnrolled = await service._test_isContactEnrolled(
        testCourseId,
        anotherEmail,
      )

      assert.strictEqual(isTestEmailEnrolled, false)
      assert.strictEqual(isAnotherEmailEnrolled, true)
    })

    it('should handle removing contact from courses they are not enrolled in', async () => {
      const service = createTestService()
      const notEnrolledEmail = 'not-enrolled@example.com'

      // This should not throw an error
      await service.removeContactFromAllCourses(notEnrolledEmail, [testCourseId])

      // Other contacts should still be enrolled
      const isTestEmailEnrolled = await service._test_isContactEnrolled(testCourseId, testEmail)
      assert.strictEqual(isTestEmailEnrolled, true)
    })

    it('should throw error for non-existent course', async () => {
      const service = createTestService()

      await assert.rejects(
        () => service.removeContactFromAllCourses(testEmail, ['non-existent-course']),
        /Course non-existent-course not found/,
      )
    })

    it('should handle empty course list', async () => {
      const service = createTestService()

      // Should not throw an error
      await service.removeContactFromAllCourses(testEmail, [])

      // Contact should still be enrolled
      const isEnrolled = await service._test_isContactEnrolled(testCourseId, testEmail)
      assert.strictEqual(isEnrolled, true)
    })
  })

  describe('fetchChapterIds', () => {
    it('should return chapter IDs for existing course', async () => {
      const service = createTestService()

      const chapterIds = await service.fetchChapterIds(testCourseId)

      assert.deepStrictEqual(chapterIds, ['chapter-1', 'chapter-2', 'chapter-3'])
    })

    it('should return chapter IDs for another course', async () => {
      const service = createTestService()

      const chapterIds = await service.fetchChapterIds(anotherCourseId)

      assert.deepStrictEqual(chapterIds, ['chapter-a', 'chapter-b'])
    })

    it('should throw error for non-existent course', async () => {
      const service = createTestService()

      await assert.rejects(
        () => service.fetchChapterIds('non-existent-course'),
        /Course non-existent-course not found/,
      )
    })

    it('should return single chapter for course with one chapter', async () => {
      const service = createTestService()

      const chapterIds = await service.fetchChapterIds('empty-course')

      assert.deepStrictEqual(chapterIds, ['chapter-empty'])
    })
  })
})
