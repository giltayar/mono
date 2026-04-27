import {requestContext} from '@fastify/request-context'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {
  listSmooveLists,
  invalidateSmooveListsCache,
} from '../../commons/external-provider/smoove-lists.ts'
import {renderSmooveListOptions} from './view/list-searches.ts'
import {
  renderSmooveListCreateDialog,
  renderSmooveListCreateResult,
  renderSmooveListCreateError,
} from './view/smoove-list-dialog.ts'
import {generateItemTitle} from '../../commons/view-commons.ts'

export async function showSmooveListDatalist(q: string | undefined): Promise<ControllerResult> {
  const smooveIntegration = requestContext.get('smooveIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  if (!smooveIntegration || !q) {
    return finalHtml('')
  }

  const allLists = await listSmooveLists(smooveIntegration, now)
  const lowerQ = q.toLowerCase()
  const filtered = allLists.filter(
    (list) =>
      list.name.toLowerCase().includes(lowerQ) ||
      generateItemTitle(list.id, list.name).toLowerCase().includes(lowerQ),
  )

  return finalHtml(renderSmooveListOptions(filtered))
}

export async function showSmooveListCreateDialog(targetFieldId: string): Promise<ControllerResult> {
  return finalHtml(renderSmooveListCreateDialog(targetFieldId))
}

export async function createSmooveList(listName: string): Promise<ControllerResult> {
  const smooveIntegration = requestContext.get('smooveIntegration')
  const logger = requestContext.get('logger')!

  try {
    if (!smooveIntegration) {
      throw new Error('Smoove integration is not configured')
    }
    const listId = await smooveIntegration.createList(listName)
    invalidateSmooveListsCache()

    return finalHtml(renderSmooveListCreateResult(listId, listName))
  } catch (error) {
    logger.error({err: error}, 'create-smoove-list')
    return finalHtml(renderSmooveListCreateError(String(error)))
  }
}
