import i18next from 'i18next'
import {labelsFor, type Labels} from '../labels.ts'

export function labels(): Labels {
  return labelsFor(i18next.resolvedLanguage)
}
