import en from './locale/en.json' with {type: 'json'}
import he from './locale/he.json' with {type: 'json'}

export type Labels = typeof en

export function labelsFor(language: string | undefined): Labels {
  return language?.startsWith('he') ? he : en
}
