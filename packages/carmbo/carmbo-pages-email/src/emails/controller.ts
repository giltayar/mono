import type {Sql} from 'postgres'
import {getFixedT} from 'i18next'
import {finalHtml, type ControllerResult} from '@giltayar/carmbo-commons/commons/controller-result'
import {listEmails, queryEmail} from './model.ts'
import {emailToView} from './view-model-mapping.ts'
import {renderEmailPage, renderEmailsPage} from './view/view.ts'

const t = getFixedT(null, 'email')

export async function showEmails(
  query: {query: string; page: number},
  sql: Sql,
): Promise<ControllerResult> {
  return finalHtml(renderEmailsPage((await listEmails(query, sql)).map(emailToView), query))
}

export async function showEmail(emailNumber: number, sql: Sql): Promise<ControllerResult> {
  const email = await queryEmail(emailNumber, sql)
  return email ? finalHtml(renderEmailPage(emailToView(email))) : {status: 404, body: t('notFound')}
}

export async function showEmailSource(
  emailNumber: number,
  sql: Sql,
): Promise<{status: number; body: string}> {
  const email = await queryEmail(emailNumber, sql)

  return email ? {status: 200, body: email.html} : {status: 404, body: t('notFound')}
}
