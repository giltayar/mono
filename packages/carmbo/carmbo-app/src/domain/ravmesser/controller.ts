import {requestContext} from '@fastify/request-context'
import {finalHtml, type ControllerResult} from '../../commons/controller-result.ts'
import {
  listRavmesserLists,
  invalidateRavmesserListsCache,
} from '../../commons/external-provider/ravmesser-lists.ts'
import {renderRavmesserListOptions} from './view/list-searches.ts'
import {
  renderRavmesserListCreateDialog,
  renderRavmesserListCreateResult,
  renderRavmesserListCreateError,
} from './view/ravmesser-list-dialog.ts'
import {generateItemTitle} from '../../commons/view-commons.ts'

export async function showRavmesserListDatalist(q: string | undefined): Promise<ControllerResult> {
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const nowService = requestContext.get('nowService')!
  const now = nowService()

  if (!ravmesserIntegration || !q) {
    return finalHtml('')
  }

  const allLists = await listRavmesserLists(ravmesserIntegration, now)
  const lowerQ = q.toLowerCase()
  const filtered = allLists.filter(
    (list) =>
      list.name.toLowerCase().includes(lowerQ) ||
      generateItemTitle(list.id, list.name).toLowerCase().includes(lowerQ),
  )

  return finalHtml(renderRavmesserListOptions(filtered))
}

export async function showRavmesserListCreateDialog(
  targetFieldId: string,
): Promise<ControllerResult> {
  return finalHtml(renderRavmesserListCreateDialog(targetFieldId))
}

export async function createRavmesserList(listName: string): Promise<ControllerResult> {
  const ravmesserIntegration = requestContext.get('ravmesserIntegration')
  const logger = requestContext.get('logger')!

  try {
    if (!ravmesserIntegration) {
      throw new Error('Ravmesser integration is not configured')
    }
    const listId = await ravmesserIntegration.createList(listName)
    invalidateRavmesserListsCache()

    return finalHtml(renderRavmesserListCreateResult(listId, listName))
  } catch (error) {
    logger.error({err: error}, 'create-ravmesser-list')
    return finalHtml(renderRavmesserListCreateError(String(error)))
  }
}
