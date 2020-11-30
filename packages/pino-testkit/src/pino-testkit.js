/**
 * This is for testing purposes only
 * @returns {{
 *  record: () => void,
 *  playback: () => import('type-fest').JsonObject[],
 *  loggerOptionsForRecorder: import('pino').LoggerOptions
 * }}
 */
export function makeRecorder() {
  /**@type {any[]} */
  let logs = []

  return {
    record() {
      logs = []
    },
    playback() {
      return logs
    },
    loggerOptionsForRecorder: {
      prettifier: () => /** @param {import('type-fest').JsonObject} log */ (log) => {
        logs.push(log)

        return JSON.stringify(log) + '\n'
      },
      prettyPrint: true,
    },
  }
}
