import type {SkoolIntegrationService} from '../src/skool-integration.ts'
import {bind, type ServiceBind} from '@giltayar/service-commons/bind'

type SkoolIntegrationServiceData = {
  state: {
    invites: Set<string>
  }
}

export function createFakeSkoolIntegrationService() {
  const state: SkoolIntegrationServiceData['state'] = {
    invites: new Set(),
  }
  const sBind: ServiceBind<SkoolIntegrationServiceData> = (f) => bind(f, {state})

  const service: SkoolIntegrationService = {
    sendUniqueInviteLinkToEmail: sBind(sendUniqueInviteLinkToEmail),
  }

  return {
    ...service,
    _test_isInviteSentForEmail: (email: string) => state.invites.has(email),
    _test_reset: () => {
      state.invites = new Set()
    },
  }
}

async function sendUniqueInviteLinkToEmail(
  {state}: SkoolIntegrationServiceData,
  {email}: {email: string},
) {
  state.invites.add(email)
}
