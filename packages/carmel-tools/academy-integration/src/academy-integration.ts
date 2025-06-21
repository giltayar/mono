// https://inspiredlivingdaily.incontrol.co.il/api/academy

/**
 * Remove a contact from all specified academy courses
 */
export async function removeContactFromAllCourses(
  email: string,
  academyCourses: string[],
): Promise<void> {
  for (const course of academyCourses) {
    console.log('removing', email, 'course', course)

    await removeContactFromChapter(course)
  }

  /**
   * Remove a contact from a specific chapter
   */
  async function removeContactFromChapter(course: string): Promise<void> {
    const chapterIdList = await fetchChapterIds(course)
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
}

/**
 * Fetch chapter IDs for a specific course
 */
async function fetchChapterIds(course: string): Promise<string[]> {
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
