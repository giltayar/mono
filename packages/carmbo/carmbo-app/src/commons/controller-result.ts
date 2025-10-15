import {assertNever} from '@giltayar/functional-commons'

export type ControllerResult =
  | {
      status: number
      body: string
    }
  | string
  | {htmxRedirect: string}
  | {htmxTarget: string; body: string}

export function finalHtml(htmlContent: string | string[]): string {
  return Array.isArray(htmlContent) ? htmlContent.flat().join('') : htmlContent
}

export function retarget(result: ControllerResult, target: string): ControllerResult {
  if (typeof result === 'string') {
    return {body: result, htmxTarget: target}
  } else if ('htmxRedirect' in result) {
    return result
  } else if ('htmxTarget' in result) {
    return {...result, htmxTarget: target}
  } else if ('status' in result) {
    return result
  } else {
    assertNever(result)
  }
}
