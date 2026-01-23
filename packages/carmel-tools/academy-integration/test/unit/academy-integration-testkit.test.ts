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
      assert.equal(await service.isStudentEnrolledInCourse(newEmail, testCourseId), false)

      await service.addStudentToCourse(newStudent, testCourseId)

      // Verify student was created and enrolled
      const contact = service._test_getContact(newEmail)
      assert.ok(contact)
      assert.equal(contact.name, 'New Student')
      assert.equal(contact.phone, '555-123-4567')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId])
      assert.equal(await service.isStudentEnrolledInCourse(newEmail, testCourseId), true)
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
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), false)

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
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), true)
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
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
    })
  })

  describe('removeStudentFromCourse', () => {
    it('should remove student from course', async () => {
      const service = createTestService()

      // Verify initial state
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      const initialContact = service._test_getContact(testEmail)
      assert.ok(initialContact)
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])

      await service.removeStudentFromCourse(testEmail, testCourseId)

      // Verify student is no longer enrolled in the course
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), false)
      const updatedContact = service._test_getContact(testEmail)
      assert.ok(updatedContact)
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [])

      // Verify student still exists
      assert.equal(updatedContact.name, 'Test Student')
      assert.equal(updatedContact.phone, '123-456-7890')
    })

    it('should remove student from one course while preserving other enrollments', async () => {
      const service = createTestService()

      // Enroll student in multiple courses
      await service.addStudentToCourse(
        {email: testEmail, name: 'Test Student', phone: '123-456-7890'},
        anotherCourseId,
      )

      // Verify student is enrolled in both courses
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), true)
      const beforeRemoval = service._test_getContact(testEmail)
      assert.ok(beforeRemoval)
      assert.deepStrictEqual(beforeRemoval.enrolledInCourses, [testCourseId, anotherCourseId])

      await service.removeStudentFromCourse(testEmail, testCourseId)

      // Verify student is only enrolled in anotherCourseId now
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), false)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), true)
      const afterRemoval = service._test_getContact(testEmail)
      assert.ok(afterRemoval)
      assert.deepStrictEqual(afterRemoval.enrolledInCourses, [anotherCourseId])
    })

    it('should throw error when trying to remove student that does not exist', async () => {
      const service = createTestService()
      const nonExistentEmail = 'nonexistent@example.com'

      // Verify student doesn't exist
      assert.equal(service._test_getContact(nonExistentEmail), undefined)

      // Attempt to remove non-existent student should throw
      await assert.rejects(
        async () => {
          await service.removeStudentFromCourse(nonExistentEmail, testCourseId)
        },
        {
          name: 'Error',
          message: `Student with email ${nonExistentEmail} not found`,
          status: 404,
        },
      )
    })

    it('should handle removing student from course they are not enrolled in', async () => {
      const service = createTestService()

      // Verify student exists but is not enrolled in anotherCourseId
      assert.ok(service._test_getContact(testEmail))
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), false)

      // Remove from course they're not enrolled in
      await service.removeStudentFromCourse(testEmail, anotherCourseId)

      // Verify enrollments unchanged
      const contact = service._test_getContact(testEmail)
      assert.ok(contact)
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId])
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, anotherCourseId), false)
    })

    it('should handle removing duplicate enrollments correctly', async () => {
      const service = createTestService()

      // Add student to same course twice (creating duplicate enrollment)
      await service.addStudentToCourse(
        {email: testEmail, name: 'Test Student', phone: '123-456-7890'},
        testCourseId,
      )

      // Verify duplicate enrollments
      const beforeRemoval = service._test_getContact(testEmail)
      assert.ok(beforeRemoval)
      assert.deepStrictEqual(beforeRemoval.enrolledInCourses, [testCourseId, testCourseId])

      // Remove student from course (should remove all instances)
      await service.removeStudentFromCourse(testEmail, testCourseId)

      // Verify all instances of the course were removed
      const afterRemoval = service._test_getContact(testEmail)
      assert.ok(afterRemoval)
      assert.deepStrictEqual(afterRemoval.enrolledInCourses, [])
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), false)
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
      assert.equal(await service.isStudentEnrolledInCourse(testEmail, testCourseId), false)

      // Verify student exists with new email and same data
      const updatedContact = service._test_getContact(newEmail)
      assert.ok(updatedContact)
      assert.equal(updatedContact.name, 'Test Student')
      assert.equal(updatedContact.phone, '123-456-7890')
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [testCourseId])
      assert.equal(await service.isStudentEnrolledInCourse(newEmail, testCourseId), true)
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
      assert.equal(await service.isStudentEnrolledInCourse(newEmail, testCourseId), true)
      assert.equal(await service.isStudentEnrolledInCourse(newEmail, anotherCourseId), true)

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

  describe('fetchMagicLink', () => {
    it('should return a magic link for the student', async () => {
      const service = createTestService()

      const magicLink = await service.fetchMagicLink(testEmail)

      assert.strictEqual(
        magicLink?.link,
        `https://fake-magic-link.com/login?email=${encodeURIComponent(testEmail)}`,
      )
    })

    it('should return undefined for non-existent student', async () => {
      const service = createTestService()
      const nonExistentEmail = 'foo@sldafhj.com'

      const magicLink = await service.fetchMagicLink(nonExistentEmail)

      assert.strictEqual(magicLink, undefined)
    })
  })
})
