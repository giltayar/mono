// https://inspiredlivingdaily.incontrol.co.il/api/academy

import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

export interface AcademyIntegrationServiceContext {
  // Add any context needed for the service (API keys, base URLs, etc.)
  baseUrl?: string
}

type AcademyIntegrationServiceData = {
  context: AcademyIntegrationServiceContext
}

export function createAcademyIntegrationService(context: AcademyIntegrationServiceContext) {
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {context})

  return {
    removeContactFromAllCourses: sBind(removeContactFromAllCourses),
    fetchChapterIds: sBind(fetchChapterIds),
  }
}

export type AcademyIntegrationService = ReturnType<typeof createAcademyIntegrationService>

/**
 * Remove a contact from all specified academy courses
 */
export async function removeContactFromAllCourses(
  s: AcademyIntegrationServiceData,
  email: string,
  academyCourses: string[],
): Promise<void> {
  for (const course of academyCourses) {
    console.log('removing', email, 'course', course)

    await removeContactFromChapter(s, course, email)
  }
}

/**
 * Remove a contact from a specific chapter
 */
async function removeContactFromChapter(
  s: AcademyIntegrationServiceData,
  course: string,
  email: string,
): Promise<void> {
  const chapterIdList = await fetchChapterIds(s, course)
  const url = new URL(`https://www.mypages.co.il/tasks/remove/`)

  url.searchParams.set('account_id', course)
  url.searchParams.set('workshop_id', chapterIdList[0])
  url.searchParams.set('email', email)

  const response = await fetch(url, {method: 'POST'})

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url} (for ${email}, ${course}): ${
        response.status
      }, ${await response.text()}`,
    )
  }

  await response.text()
}

/**
 * Fetch chapter IDs for a specific course
 */
export async function fetchChapterIds(
  _s: AcademyIntegrationServiceData,
  course: string,
): Promise<string[]> {
  const url = `https://www.mypages.co.il/tasks/${course}/workshops.json`

  const response = await fetch(url)

  if (!response.ok) {
    throw new Error(
      `Failed to fetch ${url} (for ${course}): ${response.status}, ${await response.text()}`,
    )
  }

  const result = (await response.json()) as {id: string}[]

  return result.map((chapter) => chapter.id)
}
