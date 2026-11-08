import type {JSONContent} from '@tiptap/core'
import {z} from 'zod'
import {isTemplateUrl} from './urls.ts'

export const TEMPLATE_DOCUMENT_VERSION = 1
export const TEMPLATE_PAGE_SIZE = 50
export const templateNumberSchema = z.number().int().positive()
export const previewValuesSchema = z
  .unknown()
  .superRefine((value, context) => {
    if (
      value &&
      typeof value === 'object' &&
      Object.keys(value).some((key) => ['__proto__', 'prototype', 'constructor'].includes(key))
    ) {
      context.addIssue({code: 'custom', message: 'Invalid variable name'})
    }
  })
  .pipe(
    z.record(
      z
        .string()
        .regex(/^[A-Za-z_][A-Za-z0-9_]*$/)
        .refine((key) => !['__proto__', 'prototype', 'constructor'].includes(key)),
      z.string().max(10000),
    ),
  )

const nodeNames = new Set([
  'doc',
  'body',
  'container',
  'section',
  'div',
  'paragraph',
  'text',
  'heading',
  'blockquote',
  'bulletList',
  'orderedList',
  'listItem',
  'hardBreak',
  'horizontalRule',
  'codeBlock',
  'twoColumns',
  'threeColumns',
  'fourColumns',
  'columnsColumn',
  'table',
  'tableRow',
  'tableCell',
  'tableHeader',
  'button',
  'image',
  'globalContent',
  'previewText',
  'templateDirective',
])
const markNames = new Set([
  'bold',
  'italic',
  'underline',
  'strike',
  'code',
  'sup',
  'superscript',
  'uppercase',
  'link',
  'preservedStyle',
])

function isDocument(value: unknown): value is JSONContent {
  function attributes(value: unknown): boolean {
    if (value === undefined) return true
    const parsed = z.record(z.string(), z.json()).safeParse(value)
    if (!parsed.success) return false
    return Object.entries(parsed.data).every(
      ([key, item]) =>
        !key.toLowerCase().startsWith('on') &&
        (!['src', 'href', 'background'].includes(key) ||
          item === null ||
          (typeof item === 'string' && isTemplateUrl(item, key !== 'href'))),
    )
  }
  function node(value: unknown, depth: number): boolean {
    if (depth > 40 || !value || typeof value !== 'object' || Array.isArray(value)) return false
    const item = value as Record<string, unknown>
    return (
      typeof item.type === 'string' &&
      nodeNames.has(item.type) &&
      (item.text === undefined || typeof item.text === 'string') &&
      attributes(item.attrs) &&
      (item.content === undefined ||
        (Array.isArray(item.content) && item.content.every((child) => node(child, depth + 1)))) &&
      (item.marks === undefined ||
        (Array.isArray(item.marks) &&
          item.marks.every(
            (mark) =>
              mark &&
              typeof mark === 'object' &&
              markNames.has(mark.type) &&
              attributes(mark.attrs),
          )))
    )
  }
  return node(value, 0) && (value as JSONContent).type === 'doc'
}

export const TemplateSchema = z.object({
  name: z.string().trim().min(1).max(200),
  description: z.string().max(10000),
  subject: z
    .string()
    .trim()
    .min(1)
    .max(1000)
    .regex(/^[^\r\n]*$/),
  text: z.string().max(1000000),
  html: z.string().max(1000000),
  language: z.enum(['en', 'he']),
  editorDocument: z.custom<JSONContent>(isDocument),
  editorDocumentVersion: z.literal(TEMPLATE_DOCUMENT_VERSION),
  previewValues: previewValuesSchema,
})

export type Template = z.infer<typeof TemplateSchema>

// Editable fields only: the server exports `html` from the editor document and sets the version.
export const TemplateDraftSchema = TemplateSchema.omit({html: true, editorDocumentVersion: true})
export type TemplateDraft = z.infer<typeof TemplateDraftSchema>

// The qs-parsed form body. Lenient, so invalid input re-renders the page with an error banner.
export const TemplateFormInputSchema = z.object({
  name: z.string().default(''),
  description: z.string().default(''),
  language: z.string().default(''),
  subject: z.string().default(''),
  text: z.string().default(''),
  editorDocument: z.string().default(''),
  previewValues: z.record(z.string(), z.unknown()).default({}),
})
export type TemplateFormInput = z.infer<typeof TemplateFormInputSchema>

export const SendPreviewFormInputSchema = TemplateFormInputSchema.extend({
  to: z.string().default(''),
  requestId: z.string().default(''),
})
export type SendPreviewFormInput = z.infer<typeof SendPreviewFormInputSchema>
export type TemplateLanguage = Template['language']
export type TemplateOperation = 'create' | 'update' | 'delete' | 'restore'
export type TemplateRevision = {
  template: Template
  number: number
  historyId: string
  operation: TemplateOperation
}
export type TemplateHistory = {
  id: string
  timestamp: Date
  operation: TemplateOperation
}

export function newTemplate(language: TemplateLanguage): Template {
  return {
    name: '',
    description: '',
    subject: '',
    text: '',
    html: '',
    language,
    editorDocument: {type: 'doc', content: [{type: 'container', content: [{type: 'paragraph'}]}]},
    editorDocumentVersion: TEMPLATE_DOCUMENT_VERSION,
    previewValues: {},
  }
}

export function discoverVariables(sources: string[]): string[] {
  const names = sources.flatMap((source) =>
    [...source.matchAll(/(?<!\{)\{\{\s*([A-Za-z_][A-Za-z0-9_]*)\s*\}\}(?!\})/g)].map(
      (match) => match[1],
    ),
  )
  return [...new Set(names)].filter(
    (name) => !['else', '__proto__', 'prototype', 'constructor'].includes(name),
  )
}

export function parseTemplateForm(input: TemplateFormInput): TemplateDraft {
  return TemplateDraftSchema.parse({
    ...input,
    editorDocument: parseJson(input.editorDocument),
    previewValues: filledPreviewValues(input.previewValues),
  })
}

// Keeps whatever can be shown again, so a failed save never loses the user's edits.
export function draftFromForm(input: TemplateFormInput): TemplateDraft {
  const language = input.language === 'he' ? 'he' : 'en'
  const editorDocument = parseJson(input.editorDocument)
  return {
    name: input.name,
    description: input.description,
    subject: input.subject,
    text: input.text,
    language,
    editorDocument: isDocument(editorDocument)
      ? editorDocument
      : newTemplate(language).editorDocument,
    previewValues: Object.fromEntries(
      Object.entries(filledPreviewValues(input.previewValues)).filter(
        ([name, value]) => previewValuesSchema.safeParse({[name]: value}).success,
      ),
    ),
  }
}

// Variables of the current content, plus any that already have a value.
export function previewVariables(draft: {
  subject: string
  text: string
  editorDocument: unknown
  previewValues: Record<string, string>
}): string[] {
  return [
    ...new Set([
      ...discoverVariables([draft.subject, draft.text, JSON.stringify(draft.editorDocument)]),
      ...Object.keys(draft.previewValues),
    ]),
  ]
}

function filledPreviewValues(values: Record<string, unknown>): Record<string, string> {
  return Object.fromEntries(
    Object.entries(values).filter(
      (entry): entry is [string, string] => typeof entry[1] === 'string' && entry[1] !== '',
    ),
  )
}

function parseJson(value: string): unknown {
  try {
    return JSON.parse(value)
  } catch {
    return undefined
  }
}
