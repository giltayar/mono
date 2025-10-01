import type {AcademyIntegrationService} from '@giltayar/carmel-tools-academy-integration/service'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type AcademyIntegrationServiceData = {
  state: Parameters<typeof createFakeAcademyIntegrationService>[0]
}

export function createFakeAcademyIntegrationService(context: {
  courses: {
    id: number
    name: string
  }[]

  enrolledContacts: Set<string>
}) {
  const state: AcademyIntegrationServiceData['state'] = structuredClone(context)
  const sBind: ServiceBind<AcademyIntegrationServiceData> = (f) => bind(f, {state})

  const service: AcademyIntegrationService = {
    removeContactFromAccount: sBind(removeContactFromAccount),
    listCourses: sBind(listCourses),
  }

  return {
    ...service,
    _test_isContactEnrolled: async (email: string): Promise<boolean> => {
      return state.enrolledContacts.has(email)
    },
  }
}

async function removeContactFromAccount(
  s: AcademyIntegrationServiceData,
  email: string,
): Promise<void> {
  s.state.enrolledContacts.delete(email)
}

async function listCourses(
  s: AcademyIntegrationServiceData,
): Promise<{id: number; name: string}[]> {
  return s.state.courses
}
