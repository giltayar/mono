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
})
