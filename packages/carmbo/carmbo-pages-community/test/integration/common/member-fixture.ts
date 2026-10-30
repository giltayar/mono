import {createStudent} from '@giltayar/carmbo-pages-student/students'
import type {Sql} from 'postgres'
import {createCommunity} from '../../../src/model.ts'

export async function createMemberFixture(
  sql: Sql,
  now: Date,
  name: string,
  email: string,
): Promise<{communityNumber: number; studentNumber: number; base: string}> {
  const communityNumber = await createCommunity({name: 'Community'}, undefined, now, sql)
  const studentNumber = await createStudent(
    {
      names: [{firstName: name, lastName: 'Student'}],
      emails: [email],
    },
    undefined,
    undefined,
    undefined,
    now,
    sql,
  )
  return {
    communityNumber,
    studentNumber,
    base: `/communities/${communityNumber}/members/${studentNumber}`,
  }
}
