import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function registerCommunityLocaleResources(): void {
  i18next.addResourceBundle('en', 'community', en, true, true)
  i18next.addResourceBundle('he', 'community', he, true, true)
}
