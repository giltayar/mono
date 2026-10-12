import type {Sql} from 'postgres'
import type {FastifyBaseLogger} from 'fastify'
import type {NowService} from '@giltayar/carmbo-commons/commons/now-service'
import {getFixedT} from 'i18next'
import {
  finalHtml,
  retarget,
  type ControllerResult,
} from '@giltayar/carmbo-commons/commons/controller-result'
import {exceptionToBanner} from '@giltayar/carmbo-commons/layout/banner'
import {
  listCommunities,
  queryCommunityByHistoryId,
  queryCommunityByNumber,
  createCommunity as model_createCommunity,
  updateCommunity as model_updateCommunity,
  deleteCommunity as model_deleteCommunity,
  type CommunityHistory,
  type CommunityWithHistoryInfo,
} from './model.ts'
import {communityToView, viewToCommunity, viewToNewCommunity} from './view-model-mapping.ts'
import type {CommunityPageView, CommunityView} from './view/model.ts'
import {renderCommunitiesPage} from './view/list.ts'
import {
  renderCommunityCreatePage,
  renderCommunityUpdatePage,
  renderCommunityViewInHistoryPage,
} from './view/view.ts'
import {localizeError} from './view/errors.ts'

const t = getFixedT(null, 'community')

type CommunityControllerOptions = {
  nowService: NowService
  logger: FastifyBaseLogger
}

type FailedOperation = 'updating' | 'archiving' | 'restoring'

export async function showCommunities(
  {withArchived, query, page}: {withArchived: boolean; query: string | undefined; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  const communities = await listCommunities(sql, {
    withArchived,
    query: query ?? '',
    limit: 50,
    page,
  })

  return finalHtml(
    renderCommunitiesPage(
      communities.map(({communityNumber, ...community}) => ({
        communityNumber,
        community: communityToView(community),
      })),
      {withArchived, query: query ?? '', page},
    ),
  )
}

export function showCommunityCreate(
  community: CommunityView | undefined,
  {error}: {error?: unknown} = {},
): ControllerResult {
  const banner = exceptionToBanner(t('errors.creating'), localizeError(error))

  return finalHtml(renderCommunityCreatePage(community, {banner}))
}

export async function showCommunityUpdate(
  communityNumber: number,
  failure:
    {community: CommunityView | undefined; error: unknown; operation: FailedOperation} | undefined,
  sql: Sql,
): Promise<ControllerResult> {
  const communityWithHistory = await queryCommunityByNumber(communityNumber, sql)

  if (!communityWithHistory) {
    return {status: 404, body: t('errors.notFound')}
  }

  const page = toPageView(communityWithHistory)
  const banner = failure
    ? exceptionToBanner(t(`errors.${failure.operation}`), localizeError(failure.error))
    : undefined

  return finalHtml(
    renderCommunityUpdatePage({...page, community: failure?.community ?? page.community}, {banner}),
  )
}

export async function showCommunityInHistory(
  communityNumber: number,
  operationId: string,
  sql: Sql,
): Promise<ControllerResult> {
  const communityWithHistory = await queryCommunityByHistoryId(communityNumber, operationId, sql)

  if (!communityWithHistory) {
    return {status: 404, body: t('errors.notFound')}
  }

  return finalHtml(renderCommunityViewInHistoryPage(toPageView(communityWithHistory)))
}

export async function createCommunity(
  community: CommunityView,
  sql: Sql,
  {nowService, logger}: CommunityControllerOptions,
): Promise<ControllerResult> {
  try {
    const communityNumber = await model_createCommunity(
      viewToNewCommunity(community),
      undefined,
      nowService(),
      sql,
    )

    return {htmxRedirect: `/communities/${communityNumber}`}
  } catch (error) {
    logger.error({err: error}, 'create-community')
    return showCommunityCreate(community, {error})
  }
}

export async function updateCommunity(
  communityNumber: number,
  community: CommunityView,
  sql: Sql,
  {nowService, logger}: CommunityControllerOptions,
): Promise<ControllerResult> {
  try {
    const updatedCommunityNumber = await model_updateCommunity(
      viewToCommunity(communityNumber, community),
      undefined,
      nowService(),
      sql,
    )

    if (!updatedCommunityNumber) {
      return {status: 404, body: t('errors.notFound')}
    }

    return {htmxRedirect: `/communities/${updatedCommunityNumber}`}
  } catch (error) {
    logger.error({err: error}, 'update-community')
    return showCommunityUpdate(communityNumber, {community, error, operation: 'updating'}, sql)
  }
}

export async function deleteCommunity(
  communityNumber: number,
  deleteOperation: 'delete' | 'restore',
  sql: Sql,
  {nowService, logger}: CommunityControllerOptions,
): Promise<ControllerResult> {
  try {
    const operationId = await model_deleteCommunity(
      communityNumber,
      undefined,
      deleteOperation,
      nowService(),
      sql,
    )

    if (!operationId) {
      return {status: 404, body: t('errors.notFound')}
    }

    return {htmxRedirect: `/communities/${communityNumber}`}
  } catch (error) {
    logger.error({err: error}, `${deleteOperation}-community`)
    return retarget(
      await showCommunityUpdate(
        communityNumber,
        {
          community: undefined,
          error,
          operation: deleteOperation === 'delete' ? 'archiving' : 'restoring',
        },
        sql,
      ),
      'body',
    )
  }
}

function toPageView({
  community: {id, historyOperation, communityNumber, ...community},
  history,
}: {
  community: CommunityWithHistoryInfo
  history: CommunityHistory[]
}): CommunityPageView {
  return {
    communityNumber,
    historyId: id,
    historyOperation,
    community: communityToView(community),
    history,
  }
}
