export type ControllerResult =
  | {
      status?: number
      body: string
    }
  | string
  | {htmxRedirect: string}

export function finalHtml(htmlContent: string | string[]): string {
  return Array.isArray(htmlContent) ? htmlContent.join('') : htmlContent
}
