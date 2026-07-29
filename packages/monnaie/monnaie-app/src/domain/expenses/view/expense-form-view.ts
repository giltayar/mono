import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {EXPENSE_CATEGORIES} from '../categories.ts'
import {DESCRIPTION_MAX_LENGTH, type ExpenseError, type ExpenseInput} from '../model.ts'

export type ExpenseFormMode = {kind: 'add'} | {kind: 'edit'; id: number}

export type ExpenseFormProps = {
  mode: ExpenseFormMode
  values: ExpenseInput
  error: ExpenseError | undefined
}

export const EMPTY_EXPENSE_FORM_VALUES: ExpenseInput = {
  description: '',
  amount: '',
  categoryId: '',
}

export function renderExpenseFormPage(props: ExpenseFormProps): string {
  const t = translator('expenses')

  return html`
    <${MainLayout} title=${t('page.title')} styleSheet="domain/expenses/view/style/style.css">
      <h1>${props.mode.kind === 'add' ? t('form.addTitle') : t('form.editTitle')}</h1>
      ${renderExpenseForm(props)}
    </${MainLayout}>
  ` as string
}

/**
 * Posts to itself and replaces itself, so that an error comes back as this same form with the
 * values still in it. A success never reaches here: it answers with an `HX-Redirect` instead.
 */
export function renderExpenseForm({mode, values, error}: ExpenseFormProps): string {
  const t = translator('expenses')

  return html`
    <form
      id="expense-form"
      hx-post=${mode.kind === 'add' ? '/expenses' : `/expenses/${mode.id}`}
      hx-target="#expense-form"
      hx-swap="outerHTML"
    >
      <label for="description">${t('form.description')}</label>
      <input
        id="description"
        type="text"
        name="description"
        value=${values.description}
        maxlength=${DESCRIPTION_MAX_LENGTH}
        autocomplete="off"
        autofocus
        required
      />
      <label for="amount">${t('form.amount')}</label>
      <input
        id="amount"
        type="number"
        name="amount"
        value=${values.amount}
        inputmode="decimal"
        step="0.01"
        min="0"
        autocomplete="off"
        required
      />
      <fieldset class="category-options">
        <legend>${t('form.category')}</legend>
        ${EXPENSE_CATEGORIES.map(
          (category) => html`
            <label>
              <input
                type="radio"
                name="categoryId"
                value=${category.id}
                checked=${values.categoryId === String(category.id) || undefined}
                required
              />
              <span>${category.name}</span>
            </label>
          `,
        )}
      </fieldset>
      ${error && html`<p class="error" role="alert">${t(`errors.${error}`)}</p>`}
      <div class="form-actions">
        <button type="submit">${mode.kind === 'add' ? t('form.add') : t('form.save')}</button>
        <a href="/">${t('form.cancel')}</a>
      </div>
    </form>
  ` as string
}
