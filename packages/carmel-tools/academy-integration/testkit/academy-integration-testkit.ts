import {
  type AcademyCourse,
  type AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import {makeError} from '@giltayar/functional-commons'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type AcademyIntegrationServiceData = {
  state: Parameters<typeof createFakeAcademyIntegrationService>[0]
}

export function createFakeAcademyIntegrationService(context: {
  courses: AcademyCourse[]

  enrolledContacts: Map<string, {name: string; phone: string; enrolledInCourses: number[]}>
}) {
  const state: AcademyIntegrationServiceData['state'] = structuredClone(context)
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {state})

  const service: AcademyIntegrationService = {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
    addStudentToCourse: sBind(addStudentToCourse),
    removeStudentFromCourse: sBind(removeStudentFromCourse),
    updateStudentEmail: sBind(updateStudentEmail),
    isStudentEnrolledInCourse: sBind(isStudentEnrolledInCourse),
    fetchMagicLink: sBind(fetchMagicLink),
  }

  return {
    ...service,
    _test_getContact: (email: string) => state.enrolledContacts.get(email),
  }
}

async function removeContactFromAccount(
  s: AcademyIntegrationServiceData,
  email: string,
): Promise<void> {
  s.state.enrolledContacts.delete(email)
}

async function listCourses(s: AcademyIntegrationServiceData): Promise<AcademyCourse[]> {
  return s.state.courses
}

async function addStudentToCourse(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseId: number,
): Promise<void> {
  const hasStudent = s.state.enrolledContacts.has(student.email)

  if (!hasStudent) {
    s.state.enrolledContacts.set(student.email, {
      name: student.name,
      phone: student.phone,
      enrolledInCourses: [],
    })
  }

  s.state.enrolledContacts.get(student.email)!.enrolledInCourses.push(courseId)
}

async function removeStudentFromCourse(
  s: AcademyIntegrationServiceData,
  email: string,
  courseId: number,
): Promise<void> {
  const student = s.state.enrolledContacts.get(email)
  if (!student) {
    throw makeError(`Student with email ${email} not found`, {status: 404})
  }

  const newEnrolledInCourses = student.enrolledInCourses.filter((id) => id !== courseId)

  student.enrolledInCourses = newEnrolledInCourses
}

async function updateStudentEmail(
  s: AcademyIntegrationServiceData,
  oldEmail: string,
  newEmail: string,
): Promise<void> {
  const student = s.state.enrolledContacts.get(oldEmail)
  if (!student) {
    throw makeError(`Student with email ${oldEmail} not found`, {status: 404})
  }

  s.state.enrolledContacts.delete(oldEmail)
  s.state.enrolledContacts.set(newEmail, student)
}

async function isStudentEnrolledInCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
): Promise<boolean> {
  const student = s.state.enrolledContacts.get(studentEmail)

  if (!student) {
    return false
  }

  return student.enrolledInCourses.includes(courseId)
}

async function fetchMagicLink(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
): Promise<{link: string} | undefined> {
  const student = s.state.enrolledContacts.get(studentEmail)
  if (!student) {
    return undefined
  }

  return {link: `https://fake-magic-link.com/login?email=${encodeURIComponent(studentEmail)}`}
}
