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
      enrolledContacts: new Map<string, {name: string; phone: string; enrolledInCourses: number[]}>(
        [
          [
            testEmail,
            {name: 'Test Student', phone: '123-456-7890', enrolledInCourses: [testCourseId]},
          ],
          [
            anotherEmail,
            {name: 'Another Student', phone: '987-654-3210', enrolledInCourses: [anotherCourseId]},
          ],
        ],
      ),
    })
  }

  describe('removeContactFromAccount', () => {
    it('should remove contact', async () => {
      const service = createTestService()

      assert.ok(service._test_getContact(testEmail))
      assert.ok(service._test_getContact(anotherEmail))

      await service.removeContactFromAccount(testEmail)

      assert.equal(await service._test_getContact(testEmail), undefined)
      assert.ok(await service._test_getContact(anotherEmail))
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

  describe('addStudentToCourse', () => {
    it('should add new student to course', async () => {
      const service = createTestService()
      const newEmail = 'newstudent@example.com'
      const newStudent = {
        email: newEmail,
        name: 'New Student',
        phone: '555-123-4567',
      }

      // Verify student doesn't exist initially
      assert.equal(service._test_getContact(newEmail), undefined)
      assert.equal(service._test_isContactEnrolledInCourse(newEmail, testCourseId), false)

      await service.addStudentToCourse(newStudent, testCourseId)

      // Verify student was created and enrolled
      const contact = service._test_getContact(newEmail)
      assert.ok(contact)
      assert.equal(contact.name, 'New Student')
      assert.equal(contact.phone, '555-123-4567')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId])
      assert.equal(service._test_isContactEnrolledInCourse(newEmail, testCourseId), true)
    })

    it('should enroll existing student in additional course', async () => {
      const service = createTestService()
      const existingStudent = {
        email: testEmail,
        name: 'Test Student',
        phone: '123-456-7890',
      }

      // Verify student exists and is enrolled in testCourseId
      assert.ok(service._test_getContact(testEmail))
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, anotherCourseId), false)

      await service.addStudentToCourse(
        {email: existingStudent.email, name: 'another name', phone: 'another phone'},
        anotherCourseId,
      )

      // Verify student is now enrolled in both courses
      const contact = service._test_getContact(testEmail)
      assert.ok(contact)
      assert.equal(contact.name, 'Test Student')
      assert.equal(contact.phone, '123-456-7890')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, anotherCourseId])
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, anotherCourseId), true)
    })

    it('should handle enrolling student in same course multiple times', async () => {
      const service = createTestService()
      const student = {
        email: testEmail,
        name: 'Test Student',
        phone: '123-456-7890',
      }

      // Verify initial state
      const initialContact = service._test_getContact(testEmail)
      assert.ok(initialContact)
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])

      // Enroll in the same course again
      await service.addStudentToCourse(student, testCourseId)

      // Verify the course was added again (duplicate enrollment)
      const contact = service._test_getContact(testEmail)
      assert.ok(contact)
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, testCourseId])
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, testCourseId), true)
    })
  })

  describe('updateStudentEmail', () => {
    it('should update existing student email', async () => {
      const service = createTestService()
      const newEmail = 'updated@example.com'

      // Verify initial state
      const initialContact = service._test_getContact(testEmail)
      assert.ok(initialContact)
      assert.equal(initialContact.name, 'Test Student')
      assert.equal(initialContact.phone, '123-456-7890')
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])
      assert.equal(service._test_getContact(newEmail), undefined)

      await service.updateStudentEmail(testEmail, newEmail)

      // Verify old email no longer exists
      assert.equal(service._test_getContact(testEmail), undefined)
      assert.equal(service._test_isContactEnrolledInCourse(testEmail, testCourseId), false)

      // Verify student exists with new email and same data
      const updatedContact = service._test_getContact(newEmail)
      assert.ok(updatedContact)
      assert.equal(updatedContact.name, 'Test Student')
      assert.equal(updatedContact.phone, '123-456-7890')
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [testCourseId])
      assert.equal(service._test_isContactEnrolledInCourse(newEmail, testCourseId), true)
    })

    it('should preserve all course enrollments when updating email', async () => {
      const service = createTestService()
      const newEmail = 'multi-course@example.com'

      // First, enroll the student in multiple courses
      await service.addStudentToCourse(
        {email: testEmail, name: 'Test Student', phone: '123-456-7890'},
        anotherCourseId,
      )

      // Verify student is enrolled in both courses
      const beforeUpdate = service._test_getContact(testEmail)
      assert.ok(beforeUpdate)
      assert.deepStrictEqual(beforeUpdate.enrolledInCourses, [testCourseId, anotherCourseId])

      await service.updateStudentEmail(testEmail, newEmail)

      // Verify all enrollments are preserved with new email
      const afterUpdate = service._test_getContact(newEmail)
      assert.ok(afterUpdate)
      assert.deepStrictEqual(afterUpdate.enrolledInCourses, [testCourseId, anotherCourseId])
      assert.equal(service._test_isContactEnrolledInCourse(newEmail, testCourseId), true)
      assert.equal(service._test_isContactEnrolledInCourse(newEmail, anotherCourseId), true)

      // Verify old email is completely removed
      assert.equal(service._test_getContact(testEmail), undefined)
    })

    it('should throw error when trying to update non-existent student', async () => {
      const service = createTestService()
      const nonExistentEmail = 'nonexistent@example.com'
      const newEmail = 'new@example.com'

      // Verify student doesn't exist
      assert.equal(service._test_getContact(nonExistentEmail), undefined)

      // Attempt to update non-existent student should throw
      await assert.rejects(
        async () => {
          await service.updateStudentEmail(nonExistentEmail, newEmail)
        },
        {
          name: 'Error',
          message: `Student with email ${nonExistentEmail} not found`,
          status: 404,
        },
      )

      // Verify no student was created with the new email
      assert.equal(service._test_getContact(newEmail), undefined)
    })

    it('should handle updating to an email that already exists', async () => {
      const service = createTestService()

      // Verify both students exist initially
      assert.ok(service._test_getContact(testEmail))
      assert.ok(service._test_getContact(anotherEmail))

      // Update testEmail to anotherEmail (which already exists)
      // This should overwrite the existing anotherEmail entry
      await service.updateStudentEmail(testEmail, anotherEmail)

      // Verify testEmail no longer exists
      assert.equal(service._test_getContact(testEmail), undefined)

      // Verify anotherEmail now has testEmail's original data
      const updatedContact = service._test_getContact(anotherEmail)
      assert.ok(updatedContact)
      assert.equal(updatedContact.name, 'Test Student') // Original testEmail data
      assert.equal(updatedContact.phone, '123-456-7890') // Original testEmail data
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [testCourseId]) // Original testEmail data
    })
  })
})
