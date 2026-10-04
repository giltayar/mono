import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function registerAuthLocaleResources(): void {
  i18next.addResourceBundle('en', 'auth', en, true, true)
  i18next.addResourceBundle('he', 'auth', he, true, true)
}
