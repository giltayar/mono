import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'

const cachedCourses: {
  courses: AcademyCourse[] | undefined
  timestamp: number
} = {
  courses: undefined,
  timestamp: 0,
}

export async function listAcademyCourses(academyIntegration: AcademyIntegrationService, now: Date) {
  const nowTime = now.getTime()

  if (nowTime - cachedCourses.timestamp > 1 * 60 * 1000 || !cachedCourses.courses) {
    cachedCourses.courses = await academyIntegration.listCourses()
    cachedCourses.timestamp = nowTime
  }

  return cachedCourses.courses
}
