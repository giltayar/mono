import {currentUser} from '../../commons/auth.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import type {Db} from '../../commons/db.ts'
import {languageCookie, type Language} from '../../commons/i18n.ts'
import {updateUserSettings} from '../user/model.ts'

export async function switchLanguage(db: Db, language: Language): Promise<ControllerResult> {
  const user = currentUser()

  // remembered on the account as well as in the cookie, so that the choice survives a new browser.
  // Anonymous visitors — on the login and registration pages — only get the cookie.
  if (user !== undefined) {
    await updateUserSettings(db, user.uid, {language})
  }

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
