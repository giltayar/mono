import {html} from '../../../commons/html-templates.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {Layout} from './layout.ts'
import type {JobForGrid, JobView} from '../model.ts'

export function renderJobsPage(jobs: JobForGrid[], {page}: {page: number}) {
  return html`
    <${MainLayout} title="Jobs" activeNavItem="jobs">
      <${Layout}>
        <${JobsView} jobs=${jobs} page=${page} />
      </${Layout}>
    </${MainLayout}>
  `
}

export function renderJobPage(job: JobView, subjobs: JobForGrid[]) {
  return html`
    <${MainLayout} title="Job details" activeNavItem="jobs">
      <${Layout}>
        <h2>Job ${job.id} (${job.description}): ${job.error ? html`<span class="error" title=${job.error}>❌ ${job.errorMessage}</span>` : '✔'}</h2>
        <p>Created: ${job.createdAt}</p>
        <p>Finished: ${job.finishedAt ?? 'still working...'}</p>
        ${subjobs.length > 0 && html` <${JobsView} jobs=${subjobs} page=${0} /> `}
      </${Layout}>
    </${MainLayout}>
  `
}

function JobsView({jobs, page}: {jobs: JobForGrid[]; page: number}) {
  return html`
    <div class="mt-3">
      <div class="title-and-search d-flex flex-row border-bottom align-items-baseline">
        <h2>Jobs</h2>
      </div>
      <table class="table mt-3">
        <thead>
          <tr>
            <th>ID</th>
            <th>Description</th>
            <th>Created At</th>
            <th>Progress</th>
            <th>Status</th>
          </tr>
        </thead>
        <tbody>
          ${jobs.map(
            (job, i, l) => html`
              <tr
                ...${i === l.length - 1
                  ? {
                      'hx-get': `/jobs?page=${encodeURIComponent(page + 1)}`,
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
                    : '✔'}
                </td>
              </tr>
            `,
          )}
        </tbody>
      </table>
    </div>
  `
}
