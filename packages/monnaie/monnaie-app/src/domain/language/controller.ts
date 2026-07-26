import type {ControllerResult} from '../../commons/controller.ts'
import {languageCookie, type Language} from '../../commons/i18n.ts'

export async function switchLanguage(language: Language): Promise<ControllerResult> {
  return {
    html: '',
    statusCode: 303,
    headers: {
      // deliberately a fixed path, and never anything taken from the request, so that this
      // cannot be turned into an open redirect
      Location: '/',
      'Set-Cookie': languageCookie(language),
    },
  }
}
