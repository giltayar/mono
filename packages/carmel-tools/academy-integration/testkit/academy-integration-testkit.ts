import {
  type AcademyCourse,
  type AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'
import {makeError} from '@giltayar/functional-commons'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type AccountData = {
  courses: AcademyCourse[]
  enrolledContacts: Map<string, {name: string; phone: string; enrolledInCourses: number[]}>
}

type AcademyIntegrationServiceData = {
  accounts: Map<string, AccountData>
}

export function createFakeAcademyIntegrationService(context: {accounts: Map<string, AccountData>}) {
  const accounts = new Map<string, AccountData>()
  for (const [subdomain, data] of context.accounts) {
    accounts.set(subdomain, structuredClone(data))
  }
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {accounts})

  const service: AcademyIntegrationService = {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
    addStudentToCourse: sBind(addStudentToCourse),
    addStudentToCourses: sBind(addStudentToCourses),
    removeStudentFromCourse: sBind(removeStudentFromCourse),
    updateStudentEmail: sBind(updateStudentEmail),
    isStudentEnrolledInCourse: sBind(isStudentEnrolledInCourse),
    fetchMagicLink: sBind(fetchMagicLink),
  }

  return {
    ...service,
    _test_getContact: (email: string, accountSubdomain: string) =>
      getAccount(accounts, accountSubdomain).enrolledContacts.get(email),
  }
}

async function removeContactFromAccount(
  s: AcademyIntegrationServiceData,
  email: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  getAccount(s.accounts, accountSubdomain).enrolledContacts.delete(email)
}

async function listCourses(
  s: AcademyIntegrationServiceData,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<AcademyCourse[]> {
  return getAccount(s.accounts, accountSubdomain).courses
}

async function addStudentToCourse(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const account = getAccount(s.accounts, accountSubdomain)
  const hasStudent = account.enrolledContacts.has(student.email)

  if (!hasStudent) {
    account.enrolledContacts.set(student.email, {
      name: student.name,
      phone: student.phone,
      enrolledInCourses: [],
    })
  }

  account.enrolledContacts.get(student.email)!.enrolledInCourses.push(courseId)
}

async function addStudentToCourses(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseIds: number[],
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const account = getAccount(s.accounts, accountSubdomain)
  const hasStudent = account.enrolledContacts.has(student.email)

  if (!hasStudent) {
    account.enrolledContacts.set(student.email, {
      name: student.name,
      phone: student.phone,
      enrolledInCourses: [],
    })
  }

  account.enrolledContacts.get(student.email)!.enrolledInCourses.push(...courseIds)
}

async function removeStudentFromCourse(
  s: AcademyIntegrationServiceData,
  email: string,
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const account = getAccount(s.accounts, accountSubdomain)
  const student = account.enrolledContacts.get(email)
  if (!student) {
    throw makeError(`Student with email ${email} not found`, {status: 404})
  }

  student.enrolledInCourses = student.enrolledInCourses.filter((id) => id !== courseId)
}

async function updateStudentEmail(
  s: AcademyIntegrationServiceData,
  oldEmail: string,
  newEmail: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const account = getAccount(s.accounts, accountSubdomain)
  const student = account.enrolledContacts.get(oldEmail)
  if (!student) {
    throw makeError(`Student with email ${oldEmail} not found`, {status: 404})
  }

  account.enrolledContacts.delete(oldEmail)
  account.enrolledContacts.set(newEmail, student)
}

async function isStudentEnrolledInCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<boolean> {
  const account = getAccount(s.accounts, accountSubdomain)
  const student = account.enrolledContacts.get(studentEmail)

  if (!student) {
    return false
  }

  return student.enrolledInCourses.includes(courseId)
}

async function fetchMagicLink(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<{link: string} | undefined> {
  const account = getAccount(s.accounts, accountSubdomain)
  const student = account.enrolledContacts.get(studentEmail)
  if (!student) {
    return undefined
  }

  return {link: `https://fake-magic-link.com/login?email=${encodeURIComponent(studentEmail)}`}
}

function getAccount(accounts: Map<string, AccountData>, accountSubdomain: string): AccountData {
  const account = accounts.get(accountSubdomain)
  if (!account) {
    throw new Error(`Account with subdomain ${accountSubdomain} not found`)
  }
  return account
}
