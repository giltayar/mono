import Handlebars from 'handlebars'
import {z} from 'zod'
import {TemplateSchema, type Template} from './schema.ts'

export class TemplateError extends Error {
  readonly code: 'notFound' | 'archived' | 'invalidTemplate' | 'sendFailed'

  constructor(code: TemplateError['code'], options: ErrorOptions | undefined) {
    super(code, options)
    this.name = 'TemplateError'
    this.code = code
  }
}

const handlebars = Handlebars.create()

function render(source: string, values: Record<string, string>, noEscape: boolean): string {
  return handlebars.compile(source, {noEscape})(values, {
    allowProtoMethodsByDefault: false,
    allowProtoPropertiesByDefault: false,
    // Avoid printing preview data through the built-in logging helper.
    helpers: {log: () => ''},
  })
}

// Rendering without values catches syntax errors and errors in the branches that run without data.
export function validateTemplates(template: Template): void {
  try {
    render(template.subject, {}, true)
    render(template.text, {}, true)
    render(template.html, {}, false)
  } catch (cause) {
    throw new TemplateError('invalidTemplate', {cause})
  }
}

export function renderTemplate(input: Template): {subject: string; text: string; html: string} {
  const template = TemplateSchema.parse(input)
  try {
    const result = {
      subject: render(template.subject, template.previewValues, true),
      text: render(template.text, template.previewValues, true),
      html: render(template.html, template.previewValues, false),
    }
    z.string()
      .trim()
      .min(1)
      .max(1000)
      .regex(/^[^\r\n]*$/)
      .parse(result.subject)
    return result
  } catch (cause) {
    throw new TemplateError('invalidTemplate', {cause})
  }
}
