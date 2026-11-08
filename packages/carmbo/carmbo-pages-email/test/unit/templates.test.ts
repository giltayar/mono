import assert from 'node:assert/strict'
import {test} from 'node:test'
import {discoverVariables, newTemplate, TemplateSchema} from '../../src/templates/schema.ts'
import {renderTemplate, validateTemplates} from '../../src/templates/render.ts'
import {protectTemplateTokens} from '../../src/templates/tokens.ts'
import en from '../../src/templates/locale/en.json' with {type: 'json'}
import he from '../../src/templates/locale/he.json' with {type: 'json'}
import postgres from 'postgres'
import {sendPreview} from '../../src/templates/model.ts'

const template = () => ({
  ...newTemplate('en'),
  name: 'Welcome',
  subject: 'Hi {{name}}',
  html: '<p>{{name}}</p>',
  text: '{{name}}',
  previewValues: {name: '<Alice & Bob>'},
})

test('discovers only simple string variables and preserves first occurrence order', () => {
  assert.deepEqual(
    discoverVariables([
      '{{ name }} {{name}} {{user.name}} {{#if value}} {{else}} {{/if}} {{{raw}}}',
      '{{snake_case}} {{_private}} {{ spaced value }} {{constructor}} {{__proto__}}',
      '<a href="{{link}}">{{name}}</a>',
    ]),
    ['name', 'snake_case', '_private', 'link'],
  )
})

test('renders HTML escaped, text and subject unescaped, and raw HTML deliberately', () => {
  assert.deepEqual(renderTemplate({...template(), html: '<p>{{name}}</p>{{{name}}}'}), {
    subject: 'Hi <Alice & Bob>',
    text: '<Alice & Bob>',
    html: '<p>&lt;Alice &amp; Bob&gt;</p><Alice & Bob>',
  })
})

test('supports built-in Handlebars semantics and normal missing values', () => {
  const result = renderTemplate({
    ...template(),
    html:
      '{{#if name}}yes{{else}}no{{/if}} {{#unless missing}}absent{{/unless}}' +
      '{{#each missing}}{{this}}{{/each}}{{#with missing}}{{name}}{{/with}}{{user.name}}',
  })
  assert.equal(result.html, 'yes absent')
})

test('validates by rendering without values', () => {
  for (const html of ['{{#if name}}', '{{> external}}', '{{custom name}}']) {
    assert.throws(() => validateTemplates({...template(), html}), {code: 'invalidTemplate'})
  }
  // Only branches that run without data are checked.
  assert.doesNotThrow(() =>
    validateTemplates({...template(), html: '{{#if name}}{{custom name}}{{/if}}'}),
  )
  assert.equal(renderTemplate({...template(), html: '{{constructor}}{{user.__proto__}}'}).html, '')
  assert.throws(() =>
    TemplateSchema.parse({...template(), previewValues: JSON.parse('{"__proto__":"bad"}')}),
  )
  assert.throws(
    () => renderTemplate({...template(), previewValues: {name: 'a\nBcc: other@example.com'}}),
    {code: 'invalidTemplate'},
  )
})

test('leaves rendered HTML to the email client', () => {
  assert.equal(
    renderTemplate({
      ...template(),
      html: '<a href="{{url}}">{{{raw}}}</a>',
      previewValues: {url: 'https://example.com/a?b=1', raw: '<b>bold</b>'},
    }).html,
    '<a href="https://example.com/a?b&#x3D;1"><b>bold</b></a>',
  )
})

test('protects expressions split by formatting, quoted delimiters, and URL attributes', () => {
  const content = {
    type: 'doc',
    content: [
      {
        type: 'paragraph',
        content: [
          {type: 'text', text: 'Before {{na'},
          {type: 'text', text: 'me}} after', marks: [{type: 'bold'}]},
          {type: 'text', text: '{{lookup this "a}}b"}}'},
        ],
      },
      {type: 'image', attrs: {src: 'https://example.com/{{name}}?a=1&b=2'}},
      {type: 'templateDirective', attrs: {expression: '{{#if name}}'}},
    ],
  }
  const result = protectTemplateTokens(content)
  assert.equal(
    result.restore(result.document.content![0].content!.map((node) => node.text).join('')),
    'Before {{name}} after{{lookup this "a}}b"}}',
  )
  assert.equal(
    result.restore(result.document.content![1].attrs!.src),
    'https://example.com/{{name}}?a=1&b=2',
  )
  assert.equal(result.restore(result.document.content![2].attrs!.expression), '{{#if name}}')
  assert.equal(content.content[0].content![0].text, 'Before {{na')
})

test('rejects unknown editor versions and unsupported nodes, keeps locale keys aligned', () => {
  assert.throws(() => TemplateSchema.parse({...template(), editorDocumentVersion: 2}))
  assert.throws(() =>
    TemplateSchema.parse({
      ...template(),
      editorDocument: {type: 'doc', content: [{type: 'unknown'}]},
    }),
  )
  assert.deepEqual(Object.keys(en).sort(), Object.keys(he).sort())
  assert.deepEqual(Object.keys(en.styles).sort(), Object.keys(he.styles).sort())
})

test('rejects unsafe editor URLs and inline file images before persistence', () => {
  for (const src of [
    'javascript:{{name}}',
    'data:image/png;base64,abc',
    'blob:https://example.com/image',
  ]) {
    assert.throws(() =>
      TemplateSchema.parse({
        ...template(),
        editorDocument: {
          type: 'doc',
          content: [{type: 'image', attrs: {src}}],
        },
      }),
    )
  }
  assert.doesNotThrow(() =>
    TemplateSchema.parse({
      ...template(),
      editorDocument: {
        type: 'doc',
        content: [{type: 'image', attrs: {src: 'https://example.com/{{name}}'}}],
      },
    }),
  )
})

test('direct preview rejects missing provider IDs and never calls the provider for invalid content', async () => {
  const sql = postgres()
  let attempts = 0
  const service = {
    from: 'sender@example.com',
    emailService: {
      async sendEmail() {
        attempts++
        return {id: ''}
      },
    },
  }
  try {
    await assert.rejects(
      sendPreview(
        undefined,
        {
          template: template(),
          to: 'preview@example.com',
          requestId: crypto.randomUUID(),
        },
        sql,
        service,
      ),
      {code: 'sendFailed'},
    )
    assert.equal(attempts, 1)
    await assert.rejects(
      sendPreview(
        undefined,
        {
          template: {...template(), html: '{{#if name}}'},
          to: 'preview@example.com',
          requestId: crypto.randomUUID(),
        },
        sql,
        service,
      ),
      {code: 'invalidTemplate'},
    )
    assert.equal(attempts, 1)
  } finally {
    await sql.end()
  }
})
