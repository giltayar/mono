import enCommunity from '../locale/en.json'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      community: typeof enCommunity
    }
  }
}
