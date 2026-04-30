import {bind, type ServiceBind} from '@giltayar/service-commons/bind'
import {fetchAsBuffer} from '@giltayar/http-commons'
import {addQueryParamsToUrl} from '@giltayar/url-commons'

export interface SkoolIntegrationServiceContext {
  skoolApiUniqueInviteLinkUrl: URL
}

type SkoolIntegrationServiceData = {
  context: SkoolIntegrationServiceContext
}

export function createSkoolIntegrationService(context: SkoolIntegrationServiceContext) {
  const sBind: ServiceBind<SkoolIntegrationServiceData> = (f) => bind(f, {context})

  return {
    sendUniqueInviteLinkToEmail: sBind(sendUniqueInviteLinkToEmail),
  }
}

export type SkoolIntegrationService = ReturnType<typeof createSkoolIntegrationService>

async function sendUniqueInviteLinkToEmail(
  {context: {skoolApiUniqueInviteLinkUrl}}: SkoolIntegrationServiceData,
  {email}: {email: string},
) {
  await fetchAsBuffer(addQueryParamsToUrl(skoolApiUniqueInviteLinkUrl, {email}), {method: 'POST'})
}
