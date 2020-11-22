/**
 *
 * @param {{'some-parameter': string, 'some-option'?: string}} options
 */
export default async function main({'some-parameter': someParameter, 'some-option': someOption}) {
  console.log(`${someParameter}, ${someOption}`)
}
