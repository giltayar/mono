// https://inspiredlivingdaily.incontrol.co.il/api/academy

import {
  fetchAsBuffer,
  fetchAsJson,
  fetchAsJsonWithJsonBody,
  fetchAsTextWithJsonBody,
} from '@giltayar/http-commons'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

export interface AcademyIntegrationServiceContext {
  accountApiKey: string
  accountSubdomain: string
}

export interface AcademyCourse {
  id: number
  name: string
}

type AcademyIntegrationServiceData = {
  context: AcademyIntegrationServiceContext
}

export function createAcademyIntegrationService(context: AcademyIntegrationServiceContext) {
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {context})

  return {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
    addStudentToCourse: sBind(addStudentToCourse),
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
): Promise<void> {
  const courses = await listCourses(s)
  const url = new URL(`https://www.mypages.co.il/tasks/remove/`)

  url.searchParams.set('account_id', s.context.accountApiKey)
  // This API needs a workshop_id, so we just use the first course's id
  url.searchParams.set('workshop_id', courses[0].id.toString())
  url.searchParams.set('email', email)

  await fetchAsBuffer(url, {method: 'POST'})
}

export async function listCourses(s: AcademyIntegrationServiceData): Promise<AcademyCourse[]> {
  const url = new URL(`https://www.mypages.co.il/tasks/${s.context.accountApiKey}/workshops.json`)

  const courses = (await fetchAsJson(url)) as {id: number; title: string}[]

  return courses.map((c) => ({id: c.id, name: c.title}))
}

// This will add the student to the course. If the student doesn't exist, it will add the student with
// the given name and phone. Otherwise it will ignore them
export async function addStudentToCourse(
  s: AcademyIntegrationServiceData,
  student: {email: string; name: string; phone: string},
  courseId: number,
): Promise<void> {
  const url = new URL(`https://www.mypages.co.il/tasks/add/api/${s.context.accountApiKey}`)

  await fetchAsTextWithJsonBody(url, {
    workshop_ids: courseId.toString(),
    email: student.email,
    name: student.name,
    phone: student.phone,
  })
}

export async function removeStudentFromCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
): Promise<void> {
  const url = new URL(`https://www.mypages.co.il/tasks/remove`)

  await fetchAsTextWithJsonBody(url, {
    account_id: s.context.accountApiKey,
    workshop_ids: courseId.toString(),
    email: studentEmail,
  })
}

export async function updateStudentEmail(
  s: AcademyIntegrationServiceData,
  oldEmail: string,
  newEmail: string,
): Promise<void> {
  const url = new URL(`https://www.mypages.co.il/tasks/update_email/${s.context.accountApiKey}`)

  await fetchAsTextWithJsonBody(url, {
    email: oldEmail,
    new_email: newEmail,
  })
}

export async function isStudentEnrolledInCourse(
  s: AcademyIntegrationServiceData,
  studentEmail: string,
  courseId: number,
): Promise<boolean> {
  const url = new URL(
    `https://www.mypages.co.il/tasks/${s.context.accountApiKey}/${courseId}/student_data.json`,
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
): Promise<{link: string} | undefined> {
  const url = new URL(`https://www.mypages.co.il/api/v1/academy/magic_link`)

  const response = (await fetchAsJsonWithJsonBody(
    url,
    {
      email: studentEmail,
    },
    {
      headers: {
        Authorization: `Bearer ${s.context.accountApiKey}`,
      },
    },
  )) as {magic_links: Array<{subdomain: string; magic_link: string}>}

  const magicLinkEntry = response.magic_links.find(
    (m) => m.subdomain === s.context.accountSubdomain,
  )

  if (!magicLinkEntry) {
    return undefined
  }

  return {link: magicLinkEntry.magic_link}
}
