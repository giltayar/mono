import {describe, it} from 'node:test'
import assert from 'node:assert/strict'
import {createFakeAcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/testkit'

describe('Academy Integration Testkit', () => {
  const testCourseId = 1
  const anotherCourseId = 2
  const testEmail = 'student@example.com'
  const anotherEmail = 'another@example.com'
  const testSubdomain = 'test'
  const anotherSubdomain = 'other'

  const createTestService = () => {
    return createFakeAcademyIntegrationService({
      accounts: new Map([
        [
          testSubdomain,
          {
            courses: [
              {id: testCourseId, name: 'Test Course'},
              {id: anotherCourseId, name: 'Another Course'},
            ],
            enrolledContacts: new Map([
              [
                testEmail,
                {name: 'Test Student', phone: '123-456-7890', enrolledInCourses: [testCourseId]},
              ],
              [
                anotherEmail,
                {
                  name: 'Another Student',
                  phone: '987-654-3210',
                  enrolledInCourses: [anotherCourseId],
                },
              ],
            ]),
          },
        ],
        [
          anotherSubdomain,
          {
            courses: [{id: 99, name: 'Other Account Course'}],
            enrolledContacts: new Map(),
          },
        ],
      ]),
    })
  }

  describe('removeContactFromAccount', () => {
    it('should remove contact', async () => {
      const service = createTestService()

      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.ok(service._test_getContact(anotherEmail, testSubdomain))

      await service.removeContactFromAccount(testEmail, {accountSubdomain: testSubdomain})

      assert.equal(await service._test_getContact(testEmail, testSubdomain), undefined)
      assert.ok(await service._test_getContact(anotherEmail, testSubdomain))
    })
  })

  describe('listCourses', () => {
    it('should return courses', async () => {
      const service = createTestService()

      const courses = await service.listCourses({accountSubdomain: testSubdomain})

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
      assert.equal(service._test_getContact(newEmail, testSubdomain), undefined)
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )

      await service.addStudentToCourse(newStudent, testCourseId, {accountSubdomain: testSubdomain})

      // Verify student was created and enrolled
      const contact = service._test_getContact(newEmail, testSubdomain)
      assert.ok(contact)
      assert.equal(contact.name, 'New Student')
      assert.equal(contact.phone, '555-123-4567')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
    })

    it('should enroll existing student in additional course', async () => {
      const service = createTestService()
      const existingStudent = {
        email: testEmail,
        name: 'Test Student',
        phone: '123-456-7890',
      }

      // Verify student exists and is enrolled in testCourseId
      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )

      await service.addStudentToCourse(
        {email: existingStudent.email, name: 'another name', phone: 'another phone'},
        anotherCourseId,
        {accountSubdomain: testSubdomain},
      )

      // Verify student is now enrolled in both courses
      const contact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(contact)
      assert.equal(contact.name, 'Test Student')
      assert.equal(contact.phone, '123-456-7890')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, anotherCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
    })

    it('should handle enrolling student in same course multiple times', async () => {
      const service = createTestService()
      const student = {
        email: testEmail,
        name: 'Test Student',
        phone: '123-456-7890',
      }

      // Verify initial state
      const initialContact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(initialContact)
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])

      // Enroll in the same course again
      await service.addStudentToCourse(student, testCourseId, {accountSubdomain: testSubdomain})

      // Verify the course was added again (duplicate enrollment)
      const contact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(contact)
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, testCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
    })
  })

  describe('addStudentToCourses', () => {
    it('should add new student to multiple courses', async () => {
      const service = createTestService()
      const newEmail = 'newstudent@example.com'
      const newStudent = {
        email: newEmail,
        name: 'New Student',
        phone: '555-123-4567',
      }

      // Verify student doesn't exist initially
      assert.equal(service._test_getContact(newEmail, testSubdomain), undefined)

      await service.addStudentToCourses(newStudent, [testCourseId, anotherCourseId], {
        accountSubdomain: testSubdomain,
      })

      // Verify student was created and enrolled in both courses
      const contact = service._test_getContact(newEmail, testSubdomain)
      assert.ok(contact)
      assert.equal(contact.name, 'New Student')
      assert.equal(contact.phone, '555-123-4567')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, anotherCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
    })

    it('should enroll existing student in additional courses', async () => {
      const service = createTestService()
      const existingStudent = {
        email: testEmail,
        name: 'Test Student',
        phone: '123-456-7890',
      }

      // Verify student exists and is enrolled only in testCourseId
      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )

      await service.addStudentToCourses(
        {email: existingStudent.email, name: 'another name', phone: 'another phone'},
        [anotherCourseId],
        {accountSubdomain: testSubdomain},
      )

      // Verify student is now enrolled in both courses, original data preserved
      const contact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(contact)
      assert.equal(contact.name, 'Test Student')
      assert.equal(contact.phone, '123-456-7890')
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, anotherCourseId])
    })

    it('should handle empty courseIds array', async () => {
      const service = createTestService()
      const newEmail = 'newstudent@example.com'
      const newStudent = {
        email: newEmail,
        name: 'New Student',
        phone: '555-123-4567',
      }

      await service.addStudentToCourses(newStudent, [], {accountSubdomain: testSubdomain})

      // Student should be created with no enrollments
      const contact = service._test_getContact(newEmail, testSubdomain)
      assert.ok(contact)
      assert.equal(contact.name, 'New Student')
      assert.deepStrictEqual(contact.enrolledInCourses, [])
    })

    it('should handle duplicate courseIds in the array', async () => {
      const service = createTestService()
      const newEmail = 'newstudent@example.com'
      const newStudent = {
        email: newEmail,
        name: 'New Student',
        phone: '555-123-4567',
      }

      await service.addStudentToCourses(newStudent, [testCourseId, testCourseId], {
        accountSubdomain: testSubdomain,
      })

      // Both instances should be added (matching addStudentToCourse behavior)
      const contact = service._test_getContact(newEmail, testSubdomain)
      assert.ok(contact)
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId, testCourseId])
    })
  })

  describe('removeStudentFromCourse', () => {
    it('should remove student from course', async () => {
      const service = createTestService()

      // Verify initial state
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      const initialContact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(initialContact)
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])

      await service.removeStudentFromCourse(testEmail, testCourseId, {
        accountSubdomain: testSubdomain,
      })

      // Verify student is no longer enrolled in the course
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )
      const updatedContact = service._test_getContact(testEmail, testSubdomain)
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
        {accountSubdomain: testSubdomain},
      )

      // Verify student is enrolled in both courses
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      const beforeRemoval = service._test_getContact(testEmail, testSubdomain)
      assert.ok(beforeRemoval)
      assert.deepStrictEqual(beforeRemoval.enrolledInCourses, [testCourseId, anotherCourseId])

      await service.removeStudentFromCourse(testEmail, testCourseId, {
        accountSubdomain: testSubdomain,
      })

      // Verify student is only enrolled in anotherCourseId now
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      const afterRemoval = service._test_getContact(testEmail, testSubdomain)
      assert.ok(afterRemoval)
      assert.deepStrictEqual(afterRemoval.enrolledInCourses, [anotherCourseId])
    })

    it('should throw error when trying to remove student that does not exist', async () => {
      const service = createTestService()
      const nonExistentEmail = 'nonexistent@example.com'

      // Verify student doesn't exist
      assert.equal(service._test_getContact(nonExistentEmail, testSubdomain), undefined)

      // Attempt to remove non-existent student should throw
      await assert.rejects(
        async () => {
          await service.removeStudentFromCourse(nonExistentEmail, testCourseId, {
            accountSubdomain: testSubdomain,
          })
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
      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )

      // Remove from course they're not enrolled in
      await service.removeStudentFromCourse(testEmail, anotherCourseId, {
        accountSubdomain: testSubdomain,
      })

      // Verify enrollments unchanged
      const contact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(contact)
      assert.deepStrictEqual(contact.enrolledInCourses, [testCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )
    })

    it('should handle removing duplicate enrollments correctly', async () => {
      const service = createTestService()

      // Add student to same course twice (creating duplicate enrollment)
      await service.addStudentToCourse(
        {email: testEmail, name: 'Test Student', phone: '123-456-7890'},
        testCourseId,
        {accountSubdomain: testSubdomain},
      )

      // Verify duplicate enrollments
      const beforeRemoval = service._test_getContact(testEmail, testSubdomain)
      assert.ok(beforeRemoval)
      assert.deepStrictEqual(beforeRemoval.enrolledInCourses, [testCourseId, testCourseId])

      // Remove student from course (should remove all instances)
      await service.removeStudentFromCourse(testEmail, testCourseId, {
        accountSubdomain: testSubdomain,
      })

      // Verify all instances of the course were removed
      const afterRemoval = service._test_getContact(testEmail, testSubdomain)
      assert.ok(afterRemoval)
      assert.deepStrictEqual(afterRemoval.enrolledInCourses, [])
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )
    })
  })

  describe('updateStudentEmail', () => {
    it('should update existing student email', async () => {
      const service = createTestService()
      const newEmail = 'updated@example.com'

      // Verify initial state
      const initialContact = service._test_getContact(testEmail, testSubdomain)
      assert.ok(initialContact)
      assert.equal(initialContact.name, 'Test Student')
      assert.equal(initialContact.phone, '123-456-7890')
      assert.deepStrictEqual(initialContact.enrolledInCourses, [testCourseId])
      assert.equal(service._test_getContact(newEmail, testSubdomain), undefined)

      await service.updateStudentEmail(testEmail, newEmail, {accountSubdomain: testSubdomain})

      // Verify old email no longer exists
      assert.equal(service._test_getContact(testEmail, testSubdomain), undefined)
      assert.equal(
        await service.isStudentEnrolledInCourse(testEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        false,
      )

      // Verify student exists with new email and same data
      const updatedContact = service._test_getContact(newEmail, testSubdomain)
      assert.ok(updatedContact)
      assert.equal(updatedContact.name, 'Test Student')
      assert.equal(updatedContact.phone, '123-456-7890')
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [testCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
    })

    it('should preserve all course enrollments when updating email', async () => {
      const service = createTestService()
      const newEmail = 'multi-course@example.com'

      // First, enroll the student in multiple courses
      await service.addStudentToCourse(
        {email: testEmail, name: 'Test Student', phone: '123-456-7890'},
        anotherCourseId,
        {accountSubdomain: testSubdomain},
      )

      // Verify student is enrolled in both courses
      const beforeUpdate = service._test_getContact(testEmail, testSubdomain)
      assert.ok(beforeUpdate)
      assert.deepStrictEqual(beforeUpdate.enrolledInCourses, [testCourseId, anotherCourseId])

      await service.updateStudentEmail(testEmail, newEmail, {accountSubdomain: testSubdomain})

      // Verify all enrollments are preserved with new email
      const afterUpdate = service._test_getContact(newEmail, testSubdomain)
      assert.ok(afterUpdate)
      assert.deepStrictEqual(afterUpdate.enrolledInCourses, [testCourseId, anotherCourseId])
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, testCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )
      assert.equal(
        await service.isStudentEnrolledInCourse(newEmail, anotherCourseId, {
          accountSubdomain: testSubdomain,
        }),
        true,
      )

      // Verify old email is completely removed
      assert.equal(service._test_getContact(testEmail, testSubdomain), undefined)
    })

    it('should throw error when trying to update non-existent student', async () => {
      const service = createTestService()
      const nonExistentEmail = 'nonexistent@example.com'
      const newEmail = 'new@example.com'

      // Verify student doesn't exist
      assert.equal(service._test_getContact(nonExistentEmail, testSubdomain), undefined)

      // Attempt to update non-existent student should throw
      await assert.rejects(
        async () => {
          await service.updateStudentEmail(nonExistentEmail, newEmail, {
            accountSubdomain: testSubdomain,
          })
        },
        {
          name: 'Error',
          message: `Student with email ${nonExistentEmail} not found`,
          status: 404,
        },
      )

      // Verify no student was created with the new email
      assert.equal(service._test_getContact(newEmail, testSubdomain), undefined)
    })

    it('should handle updating to an email that already exists', async () => {
      const service = createTestService()

      // Verify both students exist initially
      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.ok(service._test_getContact(anotherEmail, testSubdomain))

      // Update testEmail to anotherEmail (which already exists)
      // This should overwrite the existing anotherEmail entry
      await service.updateStudentEmail(testEmail, anotherEmail, {accountSubdomain: testSubdomain})

      // Verify testEmail no longer exists
      assert.equal(service._test_getContact(testEmail, testSubdomain), undefined)

      // Verify anotherEmail now has testEmail's original data
      const updatedContact = service._test_getContact(anotherEmail, testSubdomain)
      assert.ok(updatedContact)
      assert.equal(updatedContact.name, 'Test Student') // Original testEmail data
      assert.equal(updatedContact.phone, '123-456-7890') // Original testEmail data
      assert.deepStrictEqual(updatedContact.enrolledInCourses, [testCourseId]) // Original testEmail data
    })
  })

  describe('fetchMagicLink', () => {
    it('should return a magic link for the student', async () => {
      const service = createTestService()

      const magicLink = await service.fetchMagicLink(testEmail, {accountSubdomain: testSubdomain})

      assert.strictEqual(
        magicLink?.link,
        `https://fake-magic-link.com/login?email=${encodeURIComponent(testEmail)}`,
      )
    })

    it('should return undefined for non-existent student', async () => {
      const service = createTestService()
      const nonExistentEmail = 'foo@sldafhj.com'

      const magicLink = await service.fetchMagicLink(nonExistentEmail, {
        accountSubdomain: testSubdomain,
      })

      assert.strictEqual(magicLink, undefined)
    })
  })

  describe('account isolation', () => {
    it('should return different courses for different accounts', async () => {
      const service = createTestService()

      const testCourses = await service.listCourses({accountSubdomain: testSubdomain})
      const otherCourses = await service.listCourses({accountSubdomain: anotherSubdomain})

      assert.deepStrictEqual(testCourses, [
        {id: testCourseId, name: 'Test Course'},
        {id: anotherCourseId, name: 'Another Course'},
      ])
      assert.deepStrictEqual(otherCourses, [{id: 99, name: 'Other Account Course'}])
    })

    it('should not see contacts from another account', async () => {
      const service = createTestService()

      assert.ok(service._test_getContact(testEmail, testSubdomain))
      assert.equal(service._test_getContact(testEmail, anotherSubdomain), undefined)
    })

    it('should add student to correct account only', async () => {
      const service = createTestService()
      const newEmail = 'new@example.com'

      await service.addStudentToCourse({email: newEmail, name: 'New', phone: '555'}, 99, {
        accountSubdomain: anotherSubdomain,
      })

      assert.ok(service._test_getContact(newEmail, anotherSubdomain))
      assert.equal(service._test_getContact(newEmail, testSubdomain), undefined)
    })

    it('should throw for unknown subdomain', async () => {
      const service = createTestService()

      assert.throws(() => service._test_getContact(testEmail, 'nonexistent'), {
        message: 'Account with subdomain nonexistent not found',
      })
    })
  })
})
