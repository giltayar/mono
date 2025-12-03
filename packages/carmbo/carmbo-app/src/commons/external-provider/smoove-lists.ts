import type {SmooveIntegrationService} from '@giltayar/carmel-tools-smoove-integration/service'
import type {SmooveList} from '@giltayar/carmel-tools-smoove-integration/types'

const cachedSmooveLists: {
  groups: SmooveList[] | undefined
  timestamp: number
} = {
  groups: undefined,
  timestamp: 0,
}

export async function listSmooveLists(smooveIntegration: SmooveIntegrationService, now: Date) {
  const nowTime = now.getTime()

  if (nowTime - cachedSmooveLists.timestamp > 1 * 60 * 1000 || !cachedSmooveLists.groups) {
    cachedSmooveLists.groups = await smooveIntegration.fetchLists()
    cachedSmooveLists.timestamp = nowTime
  }

  return cachedSmooveLists.groups
}
