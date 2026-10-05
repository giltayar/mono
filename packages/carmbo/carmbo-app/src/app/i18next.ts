import {initializei18next} from '@giltayar/carmbo-common/commons/i18next-utils'

export async function initializeAppI18next(language: string | undefined): Promise<void> {
  await initializei18next(language, {
    root: new URL('../domain/', import.meta.url),
    namespaces: ['student', 'product', 'sales-event', 'sale'],
  })
}
