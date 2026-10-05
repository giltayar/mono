import i18next from 'i18next'
import i18nextFsBackend, {type FsBackendOptions} from 'i18next-fs-backend'
import {fileURLToPath} from 'node:url'

export async function initializei18next(
  lng: string | undefined,
  domainLocales?: {root: URL; namespaces: readonly string[]},
): Promise<void> {
  await i18next.use(i18nextFsBackend).init<FsBackendOptions>({
    lng: lng || 'en',
    ns: ['layout', ...(domainLocales?.namespaces ?? [])],
    backend: {
      loadPath: (lng: string, ns: string): string => {
        if (ns === 'layout') {
          return fileURLToPath(new URL(`../layout/locale/${lng}.json`, import.meta.url))
        }
        if (!domainLocales) {
          throw new Error(`No locale root configured for namespace ${ns}`)
        }
        return fileURLToPath(new URL(`${ns}/locale/${lng}.json`, domainLocales.root))
      },
    },
  })
}
