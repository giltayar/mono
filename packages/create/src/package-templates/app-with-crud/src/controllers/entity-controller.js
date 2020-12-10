import {entitySchema} from '../models/entity-model.js'
import {makeError} from '@seasquared/functional-commons'

/**
 * @param {ReturnType<typeof import('../models/entity-model').makeMammothDb>} db
 *
 */
export function listEntitiesRoute(db) {
  return (
    /**
     * @returns {Promise<import('../models/entity-model').Entity[]>}
     */
    async function () {
      const result = await db
        .select(
          db.entityTable.id,
          db.entityTable.lastModified,
          db.entityTable.name,
          db.entityTable.value,
          db.entityTable.data,
        )
        .from(db.entityTable)

      return result.map(entitySelectedToEntity)
    }
  )
}

/**
 * @param {ReturnType<typeof import('../models/entity-model').makeMammothDb>} db
 *
 */
export function getEntityRoute(db) {
  return (
    /**
     * @param {import('fastify').FastifyRequest<{Params: {id: string}}>} req
     * @returns {Promise<import('../models/entity-model').Entity|null>}
     */
    async function (req) {
      const id = req.params.id

      const result = await db
        .select(
          db.entityTable.id,
          db.entityTable.lastModified,
          db.entityTable.name,
          db.entityTable.value,
          db.entityTable.data,
        )
        .from(db.entityTable)
        .where(db.entityTable.id.eq(id))

      if (result[0]) {
        return entitySelectedToEntity(result[0])
      } else {
        throw makeError('entity not found', {statusCode: 404})
      }
    }
  )
}

/**
 * @param {ReturnType<typeof import('../models/entity-model').makeMammothDb>} db
 */
export function addEntityRoute(db) {
  return /**@param {import('fastify').FastifyRequest} req */ async (req) => {
    const entity = entitySchema.parse(req.body)

    const result = await db
      .insertInto(db.entityTable)
      .values({name: entity.name, value: entity.value, lastModified: new Date(), data: entity.data})
      .returning('id')

    if (result.length !== 1)
      throw makeError(`insert returned wrong number of rows (${result.length})`, {statusCode: 500})

    return {id: result[0].id}
  }
}

/**
 * @param {ReturnType<typeof import('../models/entity-model').makeMammothDb>} db
 */
export function updateEntityRoute(db) {
  return /**@param {import('fastify').FastifyRequest<{Params: {id: string}}>} req */ async (
    req,
  ) => {
    const entity = entitySchema.parse(req.body)
    const id = req.params.id

    const updateCount = await db
      .update(db.entityTable)
      .set({name: entity.name, value: entity.value, lastModified: new Date(), data: entity.data})
      .where(db.entityTable.id.eq(id))

    if (updateCount === 0) {
      throw makeError('entity not found', {statusCode: 404})
    } else if (updateCount > 1) {
      throw makeError(`update returned wrong number of rows (${updateCount})`, {statusCode: 500})
    }

    return {}
  }
}

/**
 * @param {ReturnType<typeof import('../models/entity-model').makeMammothDb>} db
 */
export function deleteEntityRoute(db) {
  return /**@param {import('fastify').FastifyRequest<{Params: {id: string}}>} req */ async (
    req,
  ) => {
    const id = req.params.id

    const deleteCount = await db.deleteFrom(db.entityTable).where(db.entityTable.id.eq(id))

    if (deleteCount === 0) {
      throw makeError('entity not found', {statusCode: 404})
    } else if (deleteCount > 1) {
      throw makeError(`delete returned wrong number of rows (${deleteCount})`, {statusCode: 500})
    }

    return {}
  }
}

/**
 * @returns {import('../models/entity-model').EntityWithMetadata}
 * @param {{
 *  id: string
 *  lastModified: Date
 *  name: string
 *  value: number
 *  data: unknown
 * }} e
 */
function entitySelectedToEntity(e) {
  return {
    id: e.id,
    lastModified: new Date(e.lastModified),
    name: e.name,
    value: e.value,
    data: {
      more: /**@type {import('../models/entity-model').EntityData}*/ (e.data).more,
      stuff: /**@type {import('../models/entity-model').EntityData}*/ (e.data).stuff,
    },
  }
}
