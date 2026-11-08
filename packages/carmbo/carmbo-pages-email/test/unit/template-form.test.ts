import assert from 'node:assert/strict'
import {test} from 'node:test'
import postgres from 'postgres'
import {ZodError} from 'zod'
import {
  TEMPLATE_DOCUMENT_VERSION,
  draftFromForm,
  newTemplate,
  parseTemplateForm,
  previewVariables,
  type TemplateFormInput,
} from '../../src/templates/schema.ts'
import {inlineStyle} from '../../src/templates/editor-extensions.ts'
import {exportEmail, templateFromDraft} from '../../src/templates/export.ts'
import {sendPreview} from '../../src/templates/model.ts'

const document = {
  type: 'doc',
  content: [
    {
      type: 'container',
      attrs: {contentStyle: 'padding-top: 22px; background: url("a;b.png"); color: red !important'},
      content: [
        {type: 'paragraph', content: [{type: 'text', text: 'Hello {{name}} & <friends>'}]},
        {type: 'templateDirective', attrs: {expression: '{{#if name}}'}},
        {
          type: 'image',
          attrs: {src: 'https://example.com/{{picture}}?a=1&b=2', style: 'border-radius: 4px'},
        },
        {type: 'templateDirective', attrs: {expression: '{{/if}}'}},
      ],
    },
  ],
}

const form = (overrides: Partial<TemplateFormInput> = {}): TemplateFormInput => ({
  name: 'Welcome',
  description: '',
  language: 'en',
  subject: 'Hi {{name}}',
  text: 'Text {{name}}',
  editorDocument: JSON.stringify(document),
  previewValues: {name: 'Alice', empty: ''},
  ...overrides,
})

test('parses the form, drops empty sample values and rejects invalid documents', () => {
  const draft = parseTemplateForm(form())
  assert.deepEqual(draft.editorDocument, document)
  assert.deepEqual(draft.previewValues, {name: 'Alice'})
  assert.equal('html' in draft, false)
  for (const invalid of [
    form({editorDocument: 'not json'}),
    form({editorDocument: JSON.stringify({type: 'doc', content: [{type: 'unknown'}]})}),
    form({language: 'fr'}),
    form({name: ' '}),
    form({previewValues: {'bad-name': 'x'}}),
  ]) {
    assert.throws(() => parseTemplateForm(invalid), ZodError)
  }
})

test('keeps re-renderable drafts from invalid forms without trusting invalid values', () => {
  const draft = draftFromForm(
    form({
      language: 'fr',
      editorDocument: '{',
      previewValues: {name: 'Alice', 'bad-name': 'x', other: ''},
    }),
  )
  assert.equal(draft.language, 'en')
  assert.deepEqual(draft.editorDocument, newTemplate('en').editorDocument)
  assert.deepEqual(draft.previewValues, {name: 'Alice'})
  assert.equal(draft.subject, 'Hi {{name}}')
})

test('discovers sample variables in all sources and keeps those that have values', () => {
  assert.deepEqual(
    previewVariables({
      subject: '{{first}}',
      text: '{{second}} {{first}}',
      editorDocument: {type: 'doc', content: [{type: 'text', text: '{{third}}'}]},
      previewValues: {kept: 'value'},
    }),
    ['first', 'second', 'third', 'kept'],
  )
})

test('parses inline styles without a DOM', () => {
  assert.deepEqual(
    inlineStyle(
      'padding-top: 22px; background: url("a;b.png"); color: red !important; --x: 1; -webkit-text-size-adjust: none; bad; :1',
    ),
    {
      paddingTop: '22px',
      background: 'url("a;b.png")',
      color: 'red',
      '--x': '1',
      WebkitTextSizeAdjust: 'none',
    },
  )
  assert.deepEqual(inlineStyle(undefined), {})
})

test('exports email HTML on the server with direction, styles and intact template tokens', async () => {
  const english = await exportEmail(document, 'en')
  assert.match(english, /<html[\s>]/)
  assert.match(english, /<div lang="en" dir="ltr" style="direction:ltr;text-align:start">/)
  assert.match(
    english,
    /<div data-template-content="" style="padding-top:22px;background:url\(&quot;a;b.png&quot;\);color:red">/,
  )
  assert.match(english, /Hello \{\{name\}\} &amp; &lt;friends&gt;/)
  assert.match(english, /\{\{#if name\}\}/)
  assert.match(english, /src="https:\/\/example.com\/\{\{picture\}\}\?a=1&amp;b=2"/)
  assert.match(english, /style="max-width:100%;border-radius:4px"/)
  const hebrew = await exportEmail(document, 'he')
  assert.match(hebrew, /<div lang="he" dir="rtl" style="direction:rtl;text-align:start">/)
})

test('builds a storable template from a draft', async () => {
  const template = await templateFromDraft(parseTemplateForm(form()))
  assert.equal(template.editorDocumentVersion, TEMPLATE_DOCUMENT_VERSION)
  assert.equal(template.html, await exportEmail(document, 'en'))
})

test('preview idempotency keys are stable for retries and change with the content or recipient', async () => {
  const sql = postgres()
  const keys: string[] = []
  const service = {
    from: 'sender@example.com',
    emailService: {
      async sendEmail(_message: unknown, options: {idempotencyKey: string}) {
        keys.push(options.idempotencyKey)
        return {id: 'sent'}
      },
    },
  }
  const template = await templateFromDraft(parseTemplateForm(form()))
  const requestId = crypto.randomUUID()
  try {
    for (const input of [
      {template, to: 'a@example.com', requestId},
      {template, to: 'a@example.com', requestId},
      {template, to: 'b@example.com', requestId},
      {template: {...template, subject: 'Other'}, to: 'a@example.com', requestId},
    ]) {
      await sendPreview(undefined, input, sql, service)
    }
  } finally {
    await sql.end()
  }
  assert.equal(keys[0], keys[1])
  assert.equal(new Set(keys).size, 3)
  assert.ok(keys.every((key) => key.startsWith(`template-preview/${requestId}/`)))
})
