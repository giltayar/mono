import type {LayoutResources} from '@giltayar/carmbo-commons/layout/resources'

declare module 'i18next' {
  interface CustomTypeOptions {
    resources: {
      layout: LayoutResources
    }
  }
}
