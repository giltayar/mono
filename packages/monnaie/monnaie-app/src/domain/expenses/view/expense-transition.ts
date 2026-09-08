export function expenseTransitionName(createdAt: Date | string): string {
  return `expense-${new Date(createdAt).toISOString().replaceAll(/[:.]/g, '-')}`
}
