import {assertNever} from '@giltayar/functional-commons'
import {html} from './html-templates.ts'
import {BannerComponent, type Banner} from '../layout/banner.ts'

export type ControllerResult =
  | {
      status: number
      body: string
    }
  | string
  | {htmxRedirect: string}
  | {redirect: string}
  | {htmxTarget: string; body: string}

export function finalHtml(
  htmlContent: string | string[],
  {banner}: {banner?: Banner} = {},
): string {
  const content = Array.isArray(htmlContent) ? htmlContent.flat().join('') : htmlContent

  if (!banner) return content

  const bannerOob = html`<div id="banner-container" hx-swap-oob="innerHTML">
    <${BannerComponent} banner=${banner} />
  </div>`

  return content + bannerOob
}

export function retarget(result: ControllerResult, target: string): ControllerResult {
  if (typeof result === 'string') {
    return {body: result, htmxTarget: target}
  } else if ('htmxRedirect' in result) {
    return result
  } else if ('redirect' in result) {
    return result
  } else if ('htmxTarget' in result) {
    return {...result, htmxTarget: target}
  } else if ('status' in result) {
    return result
  } else {
    assertNever(result)
  }
}
