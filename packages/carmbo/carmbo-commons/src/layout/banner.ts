import {finalHtml} from '../commons/controller-result.ts'
import {html} from '../commons/html-templates.ts'
import {getFixedT} from 'i18next'
import type {Namespace} from 'i18next'

export type BannerType = 'error' | 'info'

export type Banner = {
  message: string
  type: BannerType
  disappearing: boolean
}

export function exceptionToBanner(
  prefix: string,
  error: any,
  {
    errorCodeNs,
    errorScope,
    defaultErrorCode,
  }: {errorCodeNs?: Namespace; errorScope?: string; defaultErrorCode?: string} = {},
): Banner | undefined {
  if (!error) {
    return undefined
  }

  let message = error.message ?? JSON.stringify(error)
  if (errorCodeNs && error.code) {
    const t = getFixedT(null, errorCodeNs)

    const finalErrorScope = errorScope ?? 'errors'

    message = t([`${finalErrorScope}.${error.code}`, `${finalErrorScope}.${defaultErrorCode}`], {
      defaultValue: message,
    })
  }

  return {
    message: `${prefix}${message}`,
    type: 'error',
    disappearing: false,
  }
}

export function BannerComponent({banner}: {banner: Banner}) {
  return html`<div class="main-view_banner" role=${banner.type === 'error' ? 'alert' : 'status'}>
    ${banner.message}
  </div>`
}

export function exceptionToBannerHtml(prefix: string, err: unknown, errorNs?: Namespace) {
  return finalHtml(
    html`<${BannerComponent} banner=${exceptionToBanner(prefix, err, {errorCodeNs: errorNs})} />`,
  )
}
