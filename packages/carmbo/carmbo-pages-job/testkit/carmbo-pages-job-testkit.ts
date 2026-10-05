import {jobHandlers} from '../src/job-state.ts'

export function TEST_resetJobHandlers(): void {
  jobHandlers.clear()
}
