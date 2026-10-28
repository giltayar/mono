import {getFixedT} from 'i18next'

const t = getFixedT(null, 'community')

export const roles = ['poster', 'liveStreamer', 'moderator', 'userBlocker', 'userApprover'] as const

// Persisted lifecycle codes are translated by their literal key, including hyphens.
export function memberText(
  group: 'roles' | 'statuses' | 'reasons' | 'actions' | 'operations' | 'fields',
  value: string,
): string {
  const texts = t(`members.${group}`, {returnObjects: true})
  const entry = Object.entries(texts).find(([key]) => key === value)
  if (!entry) throw new Error(`Unknown membership ${group}: ${value}`)
  return entry[1]
}
