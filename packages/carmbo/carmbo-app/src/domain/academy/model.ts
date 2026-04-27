import type {
  AcademyCourse,
  AcademyIntegrationService,
} from '@giltayar/carmel-tools-academy-integration/service'

const cachedCoursesPerSubdomain = new Map<
  string,
  {
    courses: AcademyCourse[]
    timestamp: number
  }
>()

export async function listAcademyCourses(
  academyIntegration: AcademyIntegrationService,
  accountSubdomain: string,
  now: Date,
) {
  const nowTime = now.getTime()
  const cached = cachedCoursesPerSubdomain.get(accountSubdomain)

  if (!cached || nowTime - cached.timestamp > 1 * 60 * 1000) {
    const courses = await academyIntegration.listCourses({accountSubdomain})
    cachedCoursesPerSubdomain.set(accountSubdomain, {courses, timestamp: nowTime})
    return courses
  }

  return cached.courses
}
