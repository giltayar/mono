import htm from 'htm'
import vhtml from 'vhtml'

export const html: (strings: TemplateStringsArray, ...values: any[]) => string | string[] =
  //@ts-expect-error - htm.bind<string>(vhtml) is not typed correctly
  htm.bind<string>(vhtml)
