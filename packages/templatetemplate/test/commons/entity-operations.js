import {fetchAsJson, fetchAsJsonWithJsonBody} from '@seasquared/http-commons'

/**
 * @param {string} baseUrl
 */
export async function listEntities(baseUrl) {
  return await fetchAsJson(new URL(`/entity`, baseUrl))
}
/**
 * @param {string} id1
 * @param {string} baseUrl
 */
export async function getEntity(id1, baseUrl) {
  return await fetchAsJson(new URL(`/entity/${id1}`, baseUrl))
}
/**
 * @param {string} baseUrl
 * @param {import('../../src/models/entity-model').Entity} entity
 */
export async function addEntity(baseUrl, entity) {
  return /**@type {{id: string}}*/ (await fetchAsJsonWithJsonBody(
    new URL('/entity', baseUrl),
    entity,
  ))
}
/**
 * @param {string} baseUrl
 * @param {string} id
 * @param {import('../../src/models/entity-model').Entity} entity
 */
export async function updateEntity(baseUrl, id, entity) {
  await fetchAsJsonWithJsonBody(new URL(`/entity/${id}`, baseUrl), entity, {method: 'PUT'})
}
/**
 * @param {string} baseUrl
 * @param {string} id
 */
export async function deleteEntity(baseUrl, id) {
  await fetchAsJson(new URL(`/entity/${id}`, baseUrl), {method: 'DELETE'})
}
