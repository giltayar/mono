import type {RavmesserIntegrationService} from '@giltayar/carmel-tools-ravmesser-integration/service'
import type {RavmesserList} from '@giltayar/carmel-tools-ravmesser-integration/types'

const cachedRavmesserLists: {
  groups: RavmesserList[] | undefined
  timestamp: number
} = {
  groups: undefined,
  timestamp: 0,
}

export async function listRavmesserLists(
  ravmesserIntegration: RavmesserIntegrationService,
  now: Date,
) {
  const nowTime = now.getTime()

  if (nowTime - cachedRavmesserLists.timestamp > 1 * 60 * 1000 || !cachedRavmesserLists.groups) {
    cachedRavmesserLists.groups = await ravmesserIntegration.fetchLists()
    cachedRavmesserLists.timestamp = nowTime
  }

  return cachedRavmesserLists.groups
}

export function invalidateRavmesserListsCache() {
  cachedRavmesserLists.groups = undefined
  cachedRavmesserLists.timestamp = 0
}
