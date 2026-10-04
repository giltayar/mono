import {requestContext} from '@fastify/request-context'
import {finalHtml, type ControllerResult} from '@giltayar/carmbo-common/commons/controller-result'
import {listWhatsAppGroups} from '@giltayar/carmbo-common/commons/external-provider/whatsapp-groups'
import {renderWhatsappGroupOptions} from './view/list-searches.ts'
import {generateItemTitle} from '@giltayar/carmbo-common/commons/view-commons'

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
