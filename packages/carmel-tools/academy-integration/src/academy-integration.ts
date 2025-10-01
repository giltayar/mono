// https://inspiredlivingdaily.incontrol.co.il/api/academy

import {fetchAsBuffer, fetchAsJson} from '@giltayar/http-commons'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

export interface AcademyIntegrationServiceContext {
  accountApiKey: string
}

type AcademyIntegrationServiceData = {
  context: AcademyIntegrationServiceContext
}

export function createAcademyIntegrationService(context: AcademyIntegrationServiceContext) {
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {context})

  return {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
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

export async function listCourses(
  s: AcademyIntegrationServiceData,
): Promise<{id: number; name: string}[]> {
  const url = new URL(`https://www.mypages.co.il/tasks/${s.context.accountApiKey}/workshops.json`)

  const courses = (await fetchAsJson(url)) as {id: number; title: string}[]

  return courses.map((c) => ({id: c.id, name: c.title}))
}
