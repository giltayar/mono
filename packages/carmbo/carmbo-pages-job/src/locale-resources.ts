import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function registerJobLocaleResources(): void {
  i18next.addResourceBundle('en', 'job', en, true, true)
  i18next.addResourceBundle('he', 'job', he, true, true)
}
