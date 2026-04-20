// https://inspiredlivingdaily.incontrol.co.il/api/academy

import {
  fetchAsBuffer,
  fetchAsJson,
  fetchAsJsonWithJsonBody,
  fetchAsTextWithJsonBody,
} from '@giltayar/http-commons'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

export interface AcademyAccount {
  subdomain: string
  apiKey: string
}

export interface AcademyIntegrationServiceContext {
  accounts: AcademyAccount[]
}

export interface AcademyCourse {
  id: number
  name: string
}

type AcademyIntegrationServiceData = {
  accounts: Map<string, string> // subdomain -> apiKey
}

export function createAcademyIntegrationService(context: AcademyIntegrationServiceContext) {
  const serviceData: AcademyIntegrationServiceData = {
    accounts: new Map(context.accounts.map((a) => [a.subdomain, a.apiKey])),
  }
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, serviceData)

  return {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
    addStudentToCourse: sBind(addStudentToCourse),
    addStudentToCourses: sBind(addStudentToCourses),
    removeStudentFromCourse: sBind(removeStudentFromCourse),
    isStudentEnrolledInCourse: sBind(isStudentEnrolledInCourse),
    updateStudentEmail: sBind(updateStudentEmail),
    fetchMagicLink: sBind(fetchMagicLink),
  }
}

export type AcademyIntegrationService = ReturnType<typeof createAcademyIntegrationService>

/**
 * Remove a contact from all specified academy courses
 */
export async function removeContactFromAccount(
  s: AcademyIntegrationServiceData,
  email: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const courses = await listCourses(s, {accountSubdomain})

  const url = new URL(`https://www.mypages.co.il/tasks/remove/`)

  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  url.searchParams.set('account_id', accountApiKey)
  // This API needs a workshop_id, so we just use the first course's id
  url.searchParams.set('workshop_id', courses[0].id.toString())
  url.searchParams.set('email', email)

  await fetchAsBuffer(url, {method: 'POST'})
}

export async function listCourses(
  s: AcademyIntegrationServiceData,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<AcademyCourse[]> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  const url = new URL(`https://www.mypages.co.il/tasks/${accountApiKey}/workshops.json`)

  const courses = (await fetchAsJson(url)) as {id: number; title: string}[]

  return courses.map((c) => ({id: c.id, name: c.title}))
}

// This will add the student to the course. If the student doesn't exist, it will add the student with
// the given name and phone. Otherwise it will ignore them
export async function addStudentToCourse(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  const url = new URL(`https://www.mypages.co.il/tasks/add/api/${accountApiKey}`)

  await fetchAsTextWithJsonBody(url, {
    workshop_id: courseId.toString(),
    email: student.email,
    name: student.name,
    phone: student.phone,
  })
}

// This will add the student to the course. If the student doesn't exist, it will add the student with
// the given name and phone. Otherwise it will ignore them
export async function addStudentToCourses(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseIds: number[],
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  const url = new URL(`https://www.mypages.co.il/tasks/add/api/${accountApiKey}`)

  await fetchAsTextWithJsonBody(url, {
    workshop_ids: courseIds.map(String).join(','),
    email: student.email,
    name: student.name,
    phone: student.phone,
  })
}

export async function removeStudentFromCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  const url = new URL(`https://www.mypages.co.il/tasks/remove`)

  await fetchAsTextWithJsonBody(url, {
    account_id: accountApiKey,
    workshop_ids: courseId.toString(),
    email: studentEmail,
  })
}

export async function updateStudentEmail(
  s: AcademyIntegrationServiceData,
  oldEmail: string,
  newEmail: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<void> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)
  const url = new URL(`https://www.mypages.co.il/tasks/update_email/${accountApiKey}`)

  await fetchAsTextWithJsonBody(url, {
    email: oldEmail,
    new_email: newEmail,
  })
}

export async function isStudentEnrolledInCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<boolean> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)
  const url = new URL(
    `https://www.mypages.co.il/tasks/${accountApiKey}/${courseId}/student_data.json`,
  )

  url.searchParams.set('email', studentEmail)

  const res = (await fetchAsJson(url)) as {
    student_day_0: string
  }[]

  return res.length === 1 && !!res[0].student_day_0
}

export async function fetchMagicLink(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  {accountSubdomain}: {accountSubdomain: string},
): Promise<{link: string} | undefined> {
  const accountApiKey = getAccountApiKey(s, accountSubdomain)

  const url = new URL(`https://www.mypages.co.il/api/v1/academy/magic_link`)

  const response = (await fetchAsJsonWithJsonBody(
    url,
    {
      email: studentEmail,
    },
    {
      headers: {
        Authorization: `Bearer ${accountApiKey}`,
      },
    },
  )) as {magic_links: Array<{subdomain: string; magic_link: string}>}

  const magicLinkEntry = response.magic_links.find((m) => m.subdomain === accountSubdomain)

  if (!magicLinkEntry) {
    return undefined
  }

  return {link: magicLinkEntry.magic_link}
}

function getAccountApiKey(s: AcademyIntegrationServiceData, accountSubdomain: string): string {
  const ret = s.accounts.get(accountSubdomain)
  if (!ret) {
    throw new Error(`Account with subdomain ${accountSubdomain} not found`)
  }
  return ret
}
