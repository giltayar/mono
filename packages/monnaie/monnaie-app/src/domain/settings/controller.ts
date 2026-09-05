import {authenticatedUser} from '../../commons/auth.ts'
import type {ControllerResult} from '../../commons/controller.ts'
import {renderSettingsPage} from './view/view.ts'

export async function showSettingsPage(): Promise<ControllerResult> {
  return {html: renderSettingsPage(authenticatedUser())}
}
