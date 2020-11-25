/**
 *
 * @param {{'some-parameter': string, 'some-option'?: string}} options
 */
export default async function main({'some-parameter': someParameter, 'some-option': someOption}) {
  await 1
  console.log(`${someParameter}, ${someOption}`)
}
