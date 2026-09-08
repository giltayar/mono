import {randomUUID} from 'node:crypto'

export function expenseTransitionName(createdAt: Date | string): string {
  const isoDate = new Date(createdAt).toISOString()
  const baseName = `expense-${isoDate.replaceAll(/[:.]/g, '-')}`

  return isoDate.endsWith('T00:00:00.000Z') ? `${baseName}-${randomUUID()}` : baseName
}
