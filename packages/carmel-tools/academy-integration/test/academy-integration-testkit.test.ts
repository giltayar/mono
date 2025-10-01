import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'

describe('Academy Integration Testkit', () => {
  const testCourseId = 1
  const anotherCourseId = 2
  const testEmail = 'student@example.com'
  const anotherEmail = 'another@example.com'

  const createTestService = () => {
    return createFakeAcademyIntegrationService({
      courses: [
        {id: testCourseId, name: 'Test Course'},
        {id: anotherCourseId, name: 'Another Course'},
      ],
      enrolledContacts: new Set([testEmail, anotherEmail]),
    })
  }

  describe('removeContactFromAccount', () => {
    it('should remove contact', async () => {
      const service = createTestService()

      assert.equal(await service._test_isContactEnrolled(testEmail), true)
      assert.equal(await service._test_isContactEnrolled(anotherEmail), true)

      await service.removeContactFromAccount(testEmail)

      assert.equal(await service._test_isContactEnrolled(testEmail), false)
      assert.equal(await service._test_isContactEnrolled(anotherEmail), true)
    })
  })

  describe('listCourses', () => {
    it('should return courses', async () => {
      const service = createTestService()

      const courses = await service.listCourses()

      assert.deepStrictEqual(courses, [
        {id: testCourseId, name: 'Test Course'},
        {id: anotherCourseId, name: 'Another Course'},
      ])
    })
  })
})
