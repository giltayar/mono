import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {JobForGrid, JobView} from '../model.ts'
import {getFixedT} from 'i18next'

const t = getFixedT(null, 'job')

export function renderJobsPage(
  jobs: JobForGrid[],
  {page, withTrivial}: {page: number; withTrivial: boolean},
) {
  return html`
    <${MainLayout} title=${t('list.jobs')} activeNavItem="jobs">
      <${Layout}>
        <${JobsView} jobs=${jobs} page=${page} withTrivial=${withTrivial} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderJobPage(job: JobView, subjobs: JobForGrid[]) {
  return html`
    <${MainLayout} title=${t('detail.jobDetails')} activeNavItem="jobs">
      <${Layout}>
        <h2>${t('detail.job')} ${job.id} (${job.description}): ${job.error ? html`<span class="error" title=${job.error}>❌ ${job.errorMessage}</span>` : job.finishedAt ? '✔' : '🕐'}</h2>
        <p>${t('detail.created')} ${job.createdAt}</p>
        <p>${t('detail.finished')} ${job.finishedAt ?? t('detail.stillWorking')}</p>
        ${subjobs.length > 0 && html` <${JobsView} jobs=${subjobs} page=${0} /> `}
      </${Layout}>
    </${MainLayout}>
  `
}

function JobsView({
  jobs,
  page,
  withTrivial,
}: {
  jobs: JobForGrid[]
  page: number
  withTrivial?: boolean
}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>${t('list.jobs')}</h2>
        ${withTrivial !== undefined &&
        html`<form
          class="mb-1 ms-auto"
          action="/jobs"
          hx-boost
          hx-trigger="input changed throttle:500ms"
        >
          <fieldset class="row align-items-center me-0">
            <label class="form-check-label form-check col-auto"
              ><input
                type="checkbox"
                class="form-check-input"
                name="with-trivial"
                checked=${withTrivial}
              />
              ${t('list.showTrivial')}</label
            >
          </fieldset>
        </form>`}
      </div>
      <table class="table mt-3">
        <thead>
          <tr>
            <th>${t('list.id')}</th>
            <th>${t('list.description')}</th>
            <th>${t('list.createdAt')}</th>
            <th>${t('list.progress')}</th>
            <th>${t('list.status')}</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map(
            (job, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/jobs?page=${encodeURIComponent(page + 1)}${withTrivial ? '&with-trivial=on' : ''}`,
                      'hx-trigger': 'revealed',
                      'hx-select': '.jobs-view tbody tr',
                      'hx-include': '.jobs-view form',
                      'hx-swap': 'afterend',
                    }
                  : {}}
              >
                <td>
                  <a class="btn btn-light btn-sm" role="button" href="/jobs/${job.id}">${job.id}</a>
                </td>
                <td>${job.description}</td>
                <td>${job.createdAt}</td>
                <td>${job.progressCount}/${job.progressTotal}</td>
                <td>
                  ${job.error
                    ? html`<span class="error" title=${job.error}>❌ ${job.errorMessage}</span>`
                    : job.finishedAt
                      ? '✔'
                      : html`<span
                          title=${job.scheduledAt ? String(job.scheduledAt) : t('list.notStarted')}
                          >🕐</span
                        >`}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `
}
