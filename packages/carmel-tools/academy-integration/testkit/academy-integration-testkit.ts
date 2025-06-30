import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type AcademyIntegrationServiceData = {
  state: Parameters<typeof createFakeAcademyIntegrationService>[0]
}

export function createFakeAcademyIntegrationService(context: {
  courses: Record<
    string,
    {
      id: string
      name?: string
      chapters: string[]
      enrolledContacts: Set<string>
    }
  >
}) {
  const state: AcademyIntegrationServiceData['state'] = {
    courses: Object.fromEntries(
      Object.entries(context.courses).map(([id, course]) => [
        id,
        {
          ...course,
          enrolledContacts: new Set(course.enrolledContacts),
        },
      ]),
    ),
  }
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {state})

  const service: AcademyIntegrationService = {
    removeContactFromAllCourses: sBind(removeContactFromAllCourses),
    fetchChapterIds: sBind(fetchChapterIds),
  }

  return {
    ...service,
    _test_isContactEnrolled: async (courseId: string, email: string): Promise<boolean> => {
      const course = state.courses[courseId]
      if (!course) return false

      return course.enrolledContacts.has(email)
    },
  }
}

async function removeContactFromAllCourses(
  s: AcademyIntegrationServiceData,
  email: string,
  academyCourses: string[],
): Promise<void> {
  for (const courseId of academyCourses) {
    const course = s.state.courses[courseId]
    if (!course) {
      throw new Error(`Course ${courseId} not found`)
    }

    // Remove the contact from the course
    course.enrolledContacts.delete(email)
  }
}

async function fetchChapterIds(
  s: AcademyIntegrationServiceData,
  courseId: string,
): Promise<string[]> {
  const course = s.state.courses[courseId]
  if (!course) {
    throw new Error(`Course ${courseId} not found`)
  }

  return [...course.chapters]
}
