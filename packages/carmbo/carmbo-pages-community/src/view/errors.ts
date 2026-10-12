import {getFixedT} from 'i18next'
import {z} from 'zod'

const t = getFixedT(null, 'community')

// Turns model validation errors into a readable, localized error for the error banner.
export function localizeError(error: unknown): unknown {
  if (!(error instanceof z.ZodError)) {
    return error
  }

  const messages = error.issues.map((issue) => {
    switch (issue.path[0]) {
      case 'name':
        return t('validation.name')
      case 'description':
        return t('validation.description')
      default:
        return issue.message
    }
  })

  return {message: [...new Set(messages)].join(', ')}
}
