import {initializei18next} from '@giltayar/carmbo-commons/commons/i18next-utils'

export async function initializeAppI18next(language: string | undefined): Promise<void> {
  await initializei18next(language)
}
