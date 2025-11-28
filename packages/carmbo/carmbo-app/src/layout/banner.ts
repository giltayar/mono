import {finalHtml} from '../commons/controller-result.ts'
import {html} from '../commons/html-templates.ts'

export type BannerType = 'error' | 'info'

export type Banner = {
  message: string
  type: BannerType
  disappearing: boolean
}

export function exceptionToBanner(prefix: string, error: any): Banner | undefined {
  if (!error) {
    return undefined
  }

  return {
    message: `${prefix}${error.message ?? JSON.stringify(error)}`,
    type: 'error',
    disappearing: false,
  }
}

export function BannerComponent({banner}: {banner: Banner}) {
  return html`<div class="main-view_banner" role=${banner.type === 'error' ? 'alert' : 'status'}>
    ${banner.message}
  </div>`
}

export function exceptionToBannerHtml(prefix: string, err: unknown) {
  return finalHtml(html`<${BannerComponent} banner=${exceptionToBanner(prefix, err)} />`)
}
