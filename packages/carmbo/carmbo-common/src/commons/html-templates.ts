import htm from 'htm'
import vhtml from 'vhtml'

export const html: (strings: TemplateStringsArray, ...values: any[]) => string | string[] =
  //@ts-expect-error bind
  htm.bind<string>(vhtml)
