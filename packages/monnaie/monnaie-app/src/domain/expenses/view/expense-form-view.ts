import {html} from '../../../commons/html-templates.ts'
import {translator} from '../../../commons/i18n.ts'
import {MainLayout} from '../../../layout/main-view.ts'
import {EXPENSE_CATEGORIES} from '../categories.ts'
import {DESCRIPTION_MAX_LENGTH, type ExpenseError, type ExpenseInput} from '../model.ts'

export type ExpenseFormMode = {kind: 'add'} | {kind: 'edit'; id: number}

export type ExpenseFormProps = {
  mode: ExpenseFormMode
  query: string
  values: ExpenseInput
  error: ExpenseError | undefined
}

export const EMPTY_EXPENSE_FORM_VALUES: ExpenseInput = {
  description: '',
  amount: '',
  categoryId: '',
  expenseType: 'day-to-day',
  date: undefined,
}

export function renderExpenseFormPage(props: ExpenseFormProps): string {
  const t = translator('expenses')
  const heading = props.mode.kind === 'add' ? t('form.addTitle') : t('form.editTitle')

  return html`
    <${MainLayout}
      title=${t('page.title')}
      heading=${heading}
      styleSheet="domain/expenses/view/style/style.css"
    >
      ${renderExpenseForm(props)}
    </${MainLayout}>
  ` as string
}

/**
 * Posts to itself and replaces itself, so that an error comes back as this same form with the
 * values still in it. A success never reaches here: it answers with an `HX-Redirect` instead.
 */
export function renderExpenseForm({mode, query, values, error}: ExpenseFormProps): string {
  const t = translator('expenses')
  const postPath = mode.kind === 'add' ? `/expenses${query}` : `/expenses/${mode.id}${query}`

  return html`
    <form id="expense-form" hx-post=${postPath} hx-target="#expense-form" hx-swap="outerHTML">
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
      ${
        mode.kind === 'edit'
          ? html`
              <label for="date">${t('form.date')}</label>
              <input id="date" type="date" name="date" value=${values.date} required />
            `
          : undefined
      }
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
      <fieldset class="expense-type-options">
        <legend>${t('form.expenseType.label')}</legend>
        ${(['day-to-day', 'recurring', 'special'] as const).map(
          (expenseType) => html`
            <label>
              <input
                type="radio"
                name="expenseType"
                value=${expenseType}
                checked=${values.expenseType === expenseType || undefined}
                required
              />
              <span>${t(`form.expenseType.${expenseType}`)}</span>
            </label>
          `,
        )}
      </fieldset>
      ${error && html`<p class="error" role="alert">${t(`errors.${error}`)}</p>`}
      <div class="form-actions">
        <button type="submit">${mode.kind === 'add' ? t('form.add') : t('form.save')}</button>
        <a href=${`/${query}`}>${t('form.cancel')}</a>
      </div>
    </form>
  ` as string
}
