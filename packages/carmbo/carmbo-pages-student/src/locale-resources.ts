import i18next from 'i18next'
import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export function registerStudentLocaleResources(): void {
  i18next.addResourceBundle('en', 'student', en, true, true)
  i18next.addResourceBundle('he', 'student', he, true, true)
}
