import i18next from 'i18next'
import i18nextFsBackend from 'i18next-fs-backend'

export async function initializei18next(lng: string | undefined) {
  await i18next.use(i18nextFsBackend).init({
    lng: lng || 'en',
    ns: ['layout', 'student', 'product', 'salesEvent', 'sales', 'job'],
    backend: {
      loadPath: (lng: string, ns: string) => {
        if (ns === 'layout') {
          return `./src/layout/locale/${lng}.json`
        }
        return `./src/domain/${ns}/locale/${lng}.json`
      },
    },
  })
}
