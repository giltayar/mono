import {requestContext} from '@fastify/request-context'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {listWhatsAppGroups} from '../../commons/external-provider/whatsapp-groups.ts'
import {renderWhatsappGroupOptions} from './view/list-searches.ts'
import {generateItemTitle} from '../../commons/view-commons.ts'

export async function showWhatsappGroupDatalist(q: string | undefined): Promise<ControllerResult> {
  const whatsappIntegration = requestContext.get('whatsappIntegration')!
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  if (!q) {
    return finalHtml('')
  }

  const allGroups = await listWhatsAppGroups(whatsappIntegration, now)
  const lowerQ = q.toLowerCase()
  const filtered = allGroups.filter(
    (group) =>
      group.name.toLowerCase().includes(lowerQ) ||
      generateItemTitle(group.id, group.name).toLowerCase().includes(lowerQ),
  )

  return finalHtml(renderWhatsappGroupOptions(filtered))
}
