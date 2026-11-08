import {expect, test, type APIRequestContext, type Locator} from '@playwright/test'
import {setup} from './common/setup.ts'
import {newTemplate} from '../../src/templates/schema.ts'
import type {JSONContent} from '@tiptap/core'
import {
  createTemplateListPageModel,
  createTemplatePageModel,
} from '../../testkit/page-model/template.model.ts'

const ctx = setup(import.meta.url)

function templateForm(data: Record<string, unknown>): Record<string, string> {
  const {
    editorDocument,
    previewValues,
    html: _html,
    editorDocumentVersion: _version,
    ...fields
  } = data
  return {
    ...Object.fromEntries(Object.entries(fields).map(([name, value]) => [name, String(value)])),
    editorDocument:
      typeof editorDocument === 'string' ? editorDocument : JSON.stringify(editorDocument),
    ...Object.fromEntries(
      Object.entries((previewValues ?? {}) as Record<string, string>).map(([name, value]) => [
        `previewValues[${name}]`,
        value,
      ]),
    ),
  }
}

async function createTemplate(request: APIRequestContext, data: Record<string, unknown>) {
  const response = await request.post(new URL('/emails/templates/', ctx.url()).href, {
    form: templateForm(data),
  })
  expect(response.headers()['hx-redirect']).toMatch(/^\/emails\/templates\/\d+$/)
}
const input = () => ({
  ...newTemplate('en'),
  name: 'Welcome',
  description: 'First template',
  subject: 'Hello {{name}}',
  text: 'Hello {{name}}',
  html: '<p>Hello {{name}}</p>',
  editorDocument: {
    type: 'doc',
    content: [
      {
        type: 'container',
        content: [
          {
            type: 'paragraph',
            content: [{type: 'text', text: 'Hello {{name}}'}],
          },
        ],
      },
    ],
  },
  previewValues: {name: 'Alice'},
})

test('lists templates with numbered columns, search and an add action', async ({page}) => {
  const list = createTemplateListPageModel(page)
  await page.goto(new URL('/emails/templates', ctx.url()).href)
  await expect(list.headers().locator).toHaveText(['ID', 'Name', 'Description'])
  await expect(list.activeTab().locator).toHaveText('Email templates')
  await expect(list.search().locator).toHaveAttribute('placeholder', 'Name or description')
  await expect(list.new().locator).toHaveAccessibleName('New email template')
})

test('shows the template fields, editor and actions', async ({page}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await expect(editor.action('Save template').locator).toBeEnabled()
  await expect(editor.floatingLabels().locator).toHaveText([
    'Name',
    'Description',
    'Content language',
    'Subject template',
    'Plain-text template',
  ])
  await expect(editor.toolbar().locator).toBeVisible()
  await expect(editor.content().locator).toBeEditable()
  await expect(editor.inspector().mode().locator).toHaveText('Content container')
})

test('custom inspector targets selected spans, paragraphs and the content container', async ({
  page,
}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.name().locator.fill('Inspector')
  await editor.subject().locator.fill('Subject')
  await expect(editor.inspector().sections().locator).toHaveText([
    'Padding',
    'Margin',
    'Border',
    'Background',
  ])
  await expect(editor.inspector().section('Padding').locator).toContainText('Top')
  await expect(editor.inspector().section('Margin').locator).toContainText('Top')
  await expect(editor.inspector().section('Border').locator).toContainText('Radius')
  await expect(editor.inspector().section('Background').locator).toContainText('Color')
  await expect(editor.inspector().labels().locator).toHaveText([
    'Left',
    'Right',
    'Top',
    'Left',
    'Right',
    'Top',
    'Color',
    'Width',
    'Radius',
    'Color',
  ])
  await editor.content().locator.fill('Styled text and untouched text')
  await editor.contentBlocks().locator.first().click()
  await expect(editor.inspector().mode().locator).toHaveText('Paragraph')
  await expect(editor.inspector().sections().locator).toHaveText([
    'Text',
    'Padding',
    'Margin',
    'Border',
    'Background',
  ])
  await expect(editor.inspector().labels().locator).toHaveText([
    'Color',
    'Size',
    'Left',
    'Right',
    'Left',
    'Right',
    'Color',
    'Width',
    'Radius',
    'Color',
  ])
  await editor.inspector().field('Font size').locator.fill('24')
  await editor.inspector().field('Font size').locator.press('ArrowUp')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('font-size', '25px')
  await editor.inspector().field('Text color').locator.fill('#123456')
  await editor.inspector().field('Background color').locator.fill('#eeeeee')
  await editor.inspector().field('Border color').locator.fill('#abcdef')
  await editor.inspector().field('Border width').locator.fill('2')
  await editor.inspector().field('Corner radius').locator.fill('6')
  await editor.inspector().field('Left padding').locator.fill('10')
  await editor.inspector().field('Right padding').locator.fill('12')
  await editor.inspector().field('Left margin').locator.fill('14')
  await editor.inspector().field('Right margin').locator.fill('16')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('border-top-style', 'solid')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS(
    'border-top-color',
    'rgb(171, 205, 239)',
  )
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('padding-left', '10px')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('margin-right', '16px')
  await editor
    .contentBlocks()
    .locator.first()
    .evaluate((element) => {
      const range = document.createRange()
      range.setStart(element.firstChild!, 0)
      range.setEnd(element.firstChild!, 6)
      element.closest<HTMLElement>('[contenteditable]')!.focus()
      window.getSelection()!.removeAllRanges()
      window.getSelection()!.addRange(range)
      document.dispatchEvent(new Event('selectionchange'))
    })
  await expect(editor.inspector().mode().locator).toHaveText('Selected text')
  await expect(editor.inspector().sections().locator).toHaveText(['Text', 'Background'])
  await expect(editor.inspector().labels().locator).toHaveText(['Color', 'Size', 'Color'])
  await expect(editor.inspector().field('Text color').locator).toHaveAttribute('type', 'color')
  await expect(editor.inspector().field('Font size').locator).toHaveAttribute('type', 'number')
  await editor.inspector().field('Text color').locator.fill('#ff0000')
  await editor.inspector().field('Font size').locator.fill('30')
  await editor.inspector().field('Background color').locator.fill('#ffff00')
  await expect(editor.editorSpans().locator).toHaveText('Styled')
  await expect(editor.editorSpans().locator).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(editor.editorSpans().locator).toHaveCSS('font-size', '30px')
  await expect(editor.editorSpans().locator).toHaveCSS('background-color', 'rgb(255, 255, 0)')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('color', 'rgb(18, 52, 86)')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS(
    'background-color',
    'rgb(238, 238, 238)',
  )
  await editor.content().locator.click({position: {x: 4, y: 200}})
  await expect(editor.inspector().mode().locator).toHaveText('Content container')
  await editor.inspector().field('Left padding').locator.fill('18')
  await editor.inspector().field('Right padding').locator.fill('20')
  await editor.inspector().field('Top padding').locator.fill('22')
  await editor.inspector().field('Left margin').locator.fill('24')
  await editor.inspector().field('Right margin').locator.fill('26')
  await editor.inspector().field('Top margin').locator.fill('28')
  await editor.inspector().field('Background color').locator.fill('#aabbcc')
  await editor.inspector().field('Border color').locator.fill('#112233')
  await editor.inspector().field('Border width').locator.fill('3')
  await editor.inspector().field('Corner radius').locator.fill('8')
  await expect(editor.contentContainer().locator).toHaveCSS('padding-top', '22px')
  await expect(editor.contentContainer().locator).toHaveCSS('margin-left', '24px')
  await expect(editor.contentContainer().locator).toHaveCSS('border-top-width', '3px')
  await editor.action('Save template').locator.click()
  await expect(page).toHaveURL(/\/emails\/templates\/1$/)
  await expect(editor.editorSpans().locator).toHaveCSS('font-size', '30px')
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('font-size', '25px')
  await expect(editor.contentContainer().locator).toHaveCSS('padding-top', '22px')
  await editor.action('Preview').locator.click()
  const html = await editor.preview().iframe().locator.getAttribute('srcdoc')
  expect(html).toContain('data-template-content=""')
  const exported = await editor
    .preview()
    .frame()
    .locator.evaluate((body) => {
      const container = body.querySelector<HTMLElement>('[data-template-content]')!
      const paragraph = container.querySelector('p')!
      const span = paragraph.querySelector('span')!
      return {
        bodyStyle: body.getAttribute('style'),
        container: Object.fromEntries(
          [
            'paddingLeft',
            'paddingRight',
            'paddingTop',
            'marginLeft',
            'marginRight',
            'marginTop',
            'backgroundColor',
            'borderTopColor',
            'borderTopWidth',
            'borderTopStyle',
            'borderTopLeftRadius',
          ].map((property) => [
            property,
            getComputedStyle(container).getPropertyValue(
              property.replace(/[A-Z]/g, (letter) => `-${letter.toLowerCase()}`),
            ),
          ]),
        ),
        paragraph: paragraph.getAttribute('style'),
        span: span.getAttribute('style'),
        selected: span.textContent,
      }
    })
  expect(exported.selected).toBe('Styled')
  expect(exported.span).toContain('font-size:30px')
  expect(exported.paragraph).toContain('font-size:25px')
  expect(exported.container).toEqual({
    paddingLeft: '18px',
    paddingRight: '20px',
    paddingTop: '22px',
    marginLeft: '24px',
    marginRight: '26px',
    marginTop: '28px',
    backgroundColor: 'rgb(170, 187, 204)',
    borderTopColor: 'rgb(17, 34, 51)',
    borderTopWidth: '3px',
    borderTopStyle: 'solid',
    borderTopLeftRadius: '8px',
  })
  expect(exported.bodyStyle).not.toContain('margin-left:24px')
  expect(exported.bodyStyle).not.toContain('#aabbcc')
})

test('span styling preserves mixed formatting and links, supports select-all and undo', async ({
  page,
  request,
}) => {
  const document: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'container',
        content: [
          {
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text: 'Red',
                marks: [{type: 'preservedStyle', attrs: {style: 'color: #ff0000'}}, {type: 'bold'}],
              },
              {
                type: 'text',
                text: 'Green',
                marks: [
                  {type: 'preservedStyle', attrs: {style: 'color: #008000'}},
                  {type: 'link', attrs: {href: 'https://example.com'}},
                ],
              },
            ],
          },
          {type: 'paragraph', content: [{type: 'text', text: 'Other paragraph'}]},
        ],
      },
    ],
  }
  await createTemplate(request, {...input(), editorDocument: document})
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.contentBlocks().locator.first().selectText()
  await expect(editor.inspector().mode().locator).toHaveText('Selected text')
  await editor.inspector().field('Font size').locator.fill('32')
  await expect(editor.editorSpans().locator).toHaveCount(2)
  for (const span of await editor.editorSpans().locator.all())
    await expect(span).toHaveCSS('font-size', '32px')
  await expect(editor.editorSpans().locator.first()).toHaveCSS('color', 'rgb(255, 0, 0)')
  await expect(editor.editorSpans().locator.last()).toHaveCSS('color', 'rgb(0, 128, 0)')
  await expect(editor.editorBold().locator).toHaveText('Red')
  await expect(editor.editorLinks().locator).toHaveAttribute('href', 'https://example.com')
  await expect(editor.contentBlocks().locator.last()).not.toHaveCSS('font-size', '32px')
  await editor.action('Undo').locator.click()
  await expect(editor.editorSpans().locator.first()).not.toHaveCSS('font-size', '32px')
  await editor.action('Redo').locator.click()
  await expect(editor.editorSpans().locator.first()).toHaveCSS('font-size', '32px')
  await editor.contentBlocks().locator.last().click()
  await expect(editor.inspector().mode().locator).toHaveText('Paragraph')
  await editor.content().locator.press('ControlOrMeta+a')
  await expect(editor.inspector().mode().locator).toHaveText('Selected text')
  await editor.inspector().field('Background color').locator.fill('#ffff00')
  await expect(editor.editorSpans().locator.last()).toHaveText('Other paragraph')
  await editor.name().locator.click()
  await expect(editor.inspector().mode().locator).toHaveText('Content container')
  await editor.contentBlocks().locator.last().click()
  await expect(editor.inspector().mode().locator).toHaveText('Paragraph')
})

test('toolbar preserves selection, shows formatting state and supports keyboard menus', async ({
  page,
}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.content().locator.fill('Format me')
  await editor.content().locator.press('ControlOrMeta+a')
  await editor.action('Bold').locator.click()
  await expect(editor.editorBold().locator).toHaveText('Format me')
  await expect(editor.action('Bold').locator).toHaveAttribute('aria-pressed', 'true')
  await expect(editor.content().locator).toBeFocused()
  await editor.action('Text style').locator.click()
  await editor.menuItem('Heading 2').locator.click()
  await expect(editor.editorHeadings().locator).toHaveText('Format me')
  await expect(editor.content().locator).toBeFocused()
  await editor.editorHeadings().locator.click()
  await expect(editor.action('Text style').locator).toHaveText('Heading 2')
  await expect(editor.content().locator).toBeFocused()
  await editor.action('Alignment').locator.click()
  await editor.menuItem('Align center').locator.click()
  await expect(editor.editorHeadings().locator).toHaveCSS('text-align', 'center')
  await editor.action('More formatting').locator.click()
  await editor.menuCheckbox('Superscript').locator.click()
  await editor.action('More formatting').locator.click()
  await expect(editor.menuCheckbox('Superscript').locator).toBeChecked()
  await editor.menuCheckbox('Superscript').locator.press('Escape')
  await expect(editor.action('More formatting').locator).toBeFocused()
  await editor.action('Text style').locator.focus()
  await editor.action('Text style').locator.press('ArrowDown')
  await expect(editor.menuItem('Paragraph').locator).toBeFocused()
  await editor.menuItem('Paragraph').locator.press('Enter')
  await expect(editor.editorHeadings().locator).toHaveCount(0)
  await expect(editor.content().locator).toBeFocused()
  await editor.action('Bold').locator.focus()
  await editor.action('Bold').locator.press('ArrowRight')
  await expect(editor.action('Italic').locator).toBeFocused()
})

test('toolbar insert and table menus retain structure editing and undo/redo', async ({page}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.action('Table actions').locator.click()
  await expect(editor.menuItem('Add table row').locator).toBeDisabled()
  await editor.menuItem('Add table row').locator.press('Escape')
  await editor.action('Insert').locator.click()
  await editor.menuItem('Table').locator.click()
  await expect(editor.editorTableRows().locator).toHaveCount(2)
  await editor.editorTableCells().locator.first().click()
  await editor.action('Table actions').locator.click()
  await editor.menuItem('Add table row').locator.click()
  await expect(editor.editorTableRows().locator).toHaveCount(3)
  await editor.action('Undo').locator.click()
  await expect.poll(() => editor.editorTableRows().locator.count()).toBeLessThan(3)
  await editor.action('Redo').locator.click()
  await expect(editor.editorTableRows().locator).toHaveCount(3)
})

test('link and expression popovers preserve selection', async ({page}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.content().locator.fill('Visit')
  await editor.content().locator.press('ControlOrMeta+a')
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toBeFocused()
  await editor.url().locator.fill('https://example.com')
  await editor.action('Apply link').locator.click()
  await expect(editor.editorLinks().locator).toHaveText('Visit')
  await expect(editor.editorLinks().locator).toHaveAttribute('href', 'https://example.com')
  await expect(editor.content().locator).toBeFocused()
  await editor.content().locator.press('ControlOrMeta+End')
  await editor.action('Handlebars expression').locator.click()
  await editor.expression().locator.fill('{{name}}')
  await editor.action('Insert expression').locator.click()
  await expect(editor.content().locator).toContainText('{{name}}')
  await expect(editor.sample('name').locator).toBeVisible()
  await editor.action('Image').locator.click()
  await editor.url().locator.fill('javascript:alert(1)')
  await editor.action('Insert image').locator.click()
  await expect(editor.alert().locator).toContainText('unsafe HTML')
  await expect(editor.editorImages().locator).toHaveCount(0)
})

test('link popover loads the selected link or button URL instead of previous input', async ({
  page,
  request,
}) => {
  const document: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'container',
        content: [
          ...['First', 'Second'].map((text) => ({
            type: 'paragraph',
            content: [
              {
                type: 'text',
                text,
                marks: [{type: 'link', attrs: {href: `https://example.com/${text}`}}],
              },
            ],
          })),
          {
            type: 'button',
            attrs: {href: 'https://example.com/button'},
            content: [{type: 'text', text: 'Call to action'}],
          },
          {type: 'paragraph', content: [{type: 'text', text: 'Unlinked text'}]},
        ],
      },
    ],
  }
  await createTemplate(request, {...input(), editorDocument: document})
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.editorText('First').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/First')
  await editor.url().locator.fill('https://example.com/discarded')
  await editor.url().locator.press('Escape')
  await expect(editor.editorText('First').locator).toHaveAttribute(
    'href',
    'https://example.com/First',
  )
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/First')
  await editor.url().locator.fill('javascript:alert(1)')
  await editor.action('Apply link').locator.click()
  await expect(editor.alert().locator).toContainText('unsafe HTML')
  await editor.url().locator.fill('https://example.com/changed')
  await editor.action('Apply link').locator.click()
  await expect(editor.editorText('First').locator).toHaveAttribute(
    'href',
    'https://example.com/changed',
  )
  await expect(editor.editorText('Second').locator).toHaveAttribute(
    'href',
    'https://example.com/Second',
  )
  await editor.action('Image').locator.click()
  await editor.url().locator.fill('https://example.com/image.png')
  await editor.url().locator.press('Escape')
  await editor.editorText('Second').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/Second')
  await editor.url().locator.press('Escape')
  await editor.editorText('Call to action').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/button')
  await editor.url().locator.fill('https://example.com/new-button')
  await editor.action('Apply link').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/new-button')
  await editor.url().locator.press('Escape')
  await editor.editorText('Unlinked text').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('')
  await editor.url().locator.press('Escape')
  await editor.action('Image').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/image.png')
  await editor.url().locator.press('Escape')
  await editor.editorText('First').locator.click()
  await editor.action('Link').locator.click()
  await editor.action('Remove link').locator.click()
  await expect(editor.editorText('First').locator).not.toHaveAttribute('href')
  await expect(editor.editorText('Second').locator).toHaveAttribute(
    'href',
    'https://example.com/Second',
  )
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await editor.editorText('Call to action').locator.click()
  await editor.action('Link').locator.click()
  await expect(editor.url().locator).toHaveValue('https://example.com/new-button')
})

test('raw HTML shows current unsaved source safely without saving or substituting samples', async ({
  page,
}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.content().locator.fill('Draft {{name}} <script>alert("source")</script>')
  await editor.sample('name').locator.fill('Alice')
  await editor.action('View raw HTML').locator.click()
  await expect(editor.dialog().locator).toHaveAccessibleName('View raw HTML')
  expect(await editor.dialog().locator.evaluate((dialog) => dialog.matches(':modal'))).toBe(true)
  await expect(editor.rawHtml().locator).toHaveAttribute('readonly')
  await expect(editor.rawHtml().locator).toHaveAttribute('dir', 'ltr')
  await expect(editor.rawHtml().locator).toHaveValue(/<html[\s>]/)
  await expect(editor.rawHtml().locator).toHaveValue(/Draft \{\{name\}\} &lt;script&gt;/)
  await expect(editor.rawHtml().locator).not.toHaveValue(/Alice/)
  await editor.action('Close').locator.press('Escape')
  await expect(editor.dialog().locator).toHaveCount(0)
  await expect(editor.action('View raw HTML').locator).toBeFocused()
  await editor.content().locator.fill('Changed {{name}}')
  await editor.action('View raw HTML').locator.click()
  await expect(editor.rawHtml().locator).toHaveValue(/Changed \{\{name\}\}/)
  await expect(editor.rawHtml().locator).not.toHaveValue(/Draft/)
  await editor.action('Close').locator.click()
  expect(ctx.emailService().attempts).toHaveLength(0)
  expect(await ctx.sql()`SELECT 1 FROM email_template`).toHaveLength(0)
})

test('raw HTML exposes the stored source of archived and historical revisions', async ({
  page,
  request,
}) => {
  const original = input()
  await createTemplate(request, original)
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.content().locator.fill('Updated content')
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await editor.action('View raw HTML').locator.click()
  await expect(editor.rawHtml().locator).toHaveValue(/Updated content/)
  const updatedHtml = await editor.rawHtml().locator.inputValue()
  await editor.action('Close').locator.click()
  await editor.history().operation('Created').locator.click()
  await editor.action('View raw HTML').locator.click()
  // Stored HTML is exported by the server from the editor document, never taken from the browser.
  await expect(editor.rawHtml().locator).toHaveValue(/<p[^>]*>Hello \{\{name\}\}<\/p>/)
  expect(await editor.rawHtml().locator.inputValue()).not.toBe(updatedHtml)
  await editor.action('Close').locator.click()
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.action('Archive').locator.click()
  await expect(editor.action('Restore').locator).toBeVisible()
  await editor.action('View raw HTML').locator.click()
  await expect(editor.rawHtml().locator).toHaveValue(updatedHtml)
  await editor.action('Close').locator.click()
  await expect(editor.content().locator).toHaveAttribute('contenteditable', 'false')
  await expect(editor.action('Send preview email').locator).toHaveCount(0)
})

test('creates, edits, keeps history, archives and restores through the browser', async ({page}) => {
  test.setTimeout(30000)
  const editor = createTemplatePageModel(page)
  const list = createTemplateListPageModel(page)
  await page.goto(new URL('/emails/templates', ctx.url()).href)
  await list.new().locator.click()
  await editor.name().locator.fill('Welcome')
  await editor.description().locator.fill('First template')
  await editor.subject().locator.fill('Hello {{name}}')
  await editor.text().locator.fill('Plain {{name}}')
  await editor.content().locator.fill('HTML {{name}}')
  await editor.sample('name').locator.fill('Alice')
  await editor.action('Save template').locator.click()
  await expect(page).toHaveURL(/\/emails\/templates\/1$/)
  await expect(editor.content().locator).toContainText('HTML {{name}}')
  await expect(editor.sample('name').locator).toHaveValue('Alice')
  await editor.name().locator.fill('Updated welcome')
  await editor.sample('name').locator.fill('Bob')
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await expect(editor.history().entries().locator).toHaveCount(2)
  await expect(editor.history().current().locator).toHaveText('Updated')
  await editor.history().operation('Created').locator.click()
  await expect(editor.heading().locator).toContainText('Historical version (read-only)')
  await expect(editor.history().current().locator).toHaveText('Created')
  await expect(editor.name().locator).toHaveValue('Welcome')
  await expect(editor.sample('name').locator).toHaveValue('Alice')
  await expect(editor.action('Save template').locator).toHaveCount(0)
  await expect(editor.inspector().locator).toHaveCount(0)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.action('Archive').locator.click()
  await expect(editor.action('Restore').locator).toBeVisible()
  await expect(editor.heading().locator).toContainText('Archived')
  await expect(editor.name().locator).toBeDisabled()
  await expect(editor.inspector().locator).toHaveCount(0)
  await page.goto(new URL('/emails/templates', ctx.url()).href)
  await expect(list.template('Updated welcome').locator).toHaveCount(0)
  await list.archived().locator.check()
  await list.template('Updated welcome').locator.click()
  await editor.action('Restore').locator.click()
  await expect(editor.action('Save template').locator).toBeVisible()
  await expect(editor.sample('name').locator).toHaveValue('Bob')
})

test('failed saves re-render the form with an error banner and keep every edit', async ({
  page,
  request,
}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.name().locator.fill('Draft')
  await editor.subject().locator.fill('Broken {{#if name}}')
  await editor.content().locator.fill('Unsaved {{name}}')
  await editor.sample('name').locator.fill('Alice')
  await editor.action('Save template').locator.click()
  await expect(editor.alert().locator).toContainText('Invalid template')
  await expect(page).toHaveURL(/\/emails\/templates\/new$/)
  await expect(editor.name().locator).toHaveValue('Draft')
  await expect(editor.subject().locator).toHaveValue('Broken {{#if name}}')
  await expect(editor.content().locator).toHaveText('Unsaved {{name}}')
  await expect(editor.sample('name').locator).toHaveValue('Alice')
  expect(await ctx.sql()`SELECT 1 FROM email_template`).toHaveLength(0)

  await createTemplate(request, input())
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.text().locator.fill('Changed text')
  await editor.subject().locator.fill('{{/if}}')
  await editor.content().locator.fill('Edited content')
  await editor.action('Save template').locator.click()
  await expect(editor.alert().locator).toContainText('Invalid template')
  await expect(editor.text().locator).toHaveValue('Changed text')
  await expect(editor.content().locator).toHaveText('Edited content')
  await expect(editor.history().entries().locator).toHaveCount(1)
  await editor.subject().locator.fill('Fixed {{name}}')
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await expect(editor.content().locator).toHaveText('Edited content')
  await expect(editor.text().locator).toHaveValue('Changed text')
})

test('sample values follow the subject, text and editor content while keeping entered values', async ({
  page,
}) => {
  const editor = createTemplatePageModel(page)
  const samples = editor.samples().locator
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await expect(samples).toHaveCount(0)
  await editor.subject().locator.fill('Hi {{first}}')
  await expect(editor.sample('first').locator).toBeVisible()
  await editor.sample('first').locator.fill('Ada')
  await editor.text().locator.fill('{{second}}')
  await editor.content().locator.fill('{{third}}')
  await expect(samples).toHaveCount(3)
  await expect(editor.sample('first').locator).toHaveValue('Ada')
  await editor.subject().locator.fill('Hi')
  // Variables with values stay until they are emptied; empty ones disappear with their reference.
  await editor.text().locator.fill('')
  await expect(samples).toHaveCount(2)
  await expect(editor.sample('second').locator).toHaveCount(0)
  await expect(editor.sample('first').locator).toHaveValue('Ada')
})

test('preview is a modal with the subject, both bodies and a sandboxed frame', async ({
  page,
  request,
}) => {
  await createTemplate(request, input())
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.action('Preview').locator.click()
  await expect(editor.preview().locator).toBeVisible()
  expect(await editor.preview().locator.evaluate((dialog) => dialog.matches(':modal'))).toBe(true)
  await expect(editor.preview().subject().locator).toHaveText('Hello Alice')
  await expect(editor.preview().frame().locator).toContainText('Hello Alice')
  await expect(editor.preview().iframe().locator).toHaveAttribute('sandbox', '')
  await expect(editor.preview().iframe().locator).toHaveAttribute('referrerpolicy', 'no-referrer')
  await editor.preview().textToggle().locator.click()
  await expect(editor.preview().text().locator).toHaveText('Hello Alice')
  await editor.action('Close').locator.click()
  await expect(editor.preview().locator).toHaveCount(0)
  await expect(editor.action('Preview').locator).toBeFocused()
  await editor.sample('name').locator.fill('Bob')
  await editor.action('Preview').locator.click()
  await expect(editor.preview().frame().locator).toContainText('Hello Bob')
  await editor.action('Close').locator.press('Escape')
  await expect(editor.preview().locator).toHaveCount(0)
  await expect(editor.action('Preview').locator).toBeFocused()
})

test('send dialog focuses the recipient, validates it and cancels without sending', async ({
  page,
}) => {
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await expect(editor.recipient().locator).toHaveCount(0)
  await editor.action('Send preview email').locator.click()
  await expect(editor.sendDialog().locator).toBeVisible()
  expect(await editor.sendDialog().locator.evaluate((dialog) => dialog.matches(':modal'))).toBe(
    true,
  )
  await expect(editor.recipient().locator).toBeFocused()
  await editor.action('Send').locator.click()
  await expect(editor.sendDialog().locator).toBeVisible()
  expect(ctx.emailService().attempts).toHaveLength(0)
  await editor.recipient().locator.fill('invalid-address')
  await editor.action('Send').locator.click()
  expect(ctx.emailService().attempts).toHaveLength(0)
  await editor.recipient().locator.fill('preview@example.com')
  await editor.action('Cancel').locator.click()
  await expect(editor.sendDialog().locator).toHaveCount(0)
  await expect(editor.action('Send preview email').locator).toBeFocused()
  expect(ctx.emailService().attempts).toHaveLength(0)
  await editor.action('Send preview email').locator.click()
  await expect(editor.recipient().locator).toHaveValue('preview@example.com')
  await editor.recipient().locator.press('Escape')
  await expect(editor.sendDialog().locator).toHaveCount(0)
  expect(ctx.emailService().attempts).toHaveLength(0)
})

test('remembers the preview recipient across reloads, templates and restored browser storage', async ({
  page,
  request,
  browser,
}) => {
  await createTemplate(request, input())
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.action('Send preview email').locator.click()
  await editor.recipient().locator.fill('preview@example.com')
  await editor.action('Cancel').locator.click()
  await page.reload()
  await editor.action('Send preview email').locator.click()
  await expect(editor.recipient().locator).toHaveValue('preview@example.com')
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.action('Send preview email').locator.click()
  await expect(editor.recipient().locator).toHaveValue('preview@example.com')
  const restored = await browser.newContext({
    locale: 'en-US',
    storageState: await page.context().storageState(),
  })
  try {
    const restoredPage = await restored.newPage()
    const restoredEditor = createTemplatePageModel(restoredPage)
    await restoredPage.goto(new URL('/emails/templates/1', ctx.url()).href)
    await restoredEditor.action('Send preview email').locator.click()
    await expect(restoredEditor.recipient().locator).toHaveValue('preview@example.com')
    await restoredEditor.recipient().locator.fill('')
    await restoredPage.reload()
    await restoredEditor.action('Send preview email').locator.click()
    await expect(restoredEditor.recipient().locator).toHaveValue('')
    const storage = await restored.storageState()
    expect(
      storage.origins.flatMap((origin) => origin.localStorage.map((item) => item.name)),
    ).not.toContain('carmbo.email-template.preview-recipient')
  } finally {
    await restored.close()
  }
  expect(ctx.emailService().attempts).toHaveLength(0)
})

test('send dialog prevents duplicate submission and dismissal while sending', async ({page}) => {
  const editor = createTemplatePageModel(page)
  const received = Promise.withResolvers<void>()
  const release = Promise.withResolvers<void>()
  await page.route('**/send-preview', async (route) => {
    if (route.request().method() !== 'POST') return route.continue()
    received.resolve()
    await release.promise
    await route.continue()
  })
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.name().locator.fill('Draft')
  await editor.subject().locator.fill('Subject')
  await editor.content().locator.fill('Body')
  await editor.action('Send preview email').locator.click()
  await editor.recipient().locator.fill('preview@example.com')
  try {
    await editor.action('Send').locator.click()
    await received.promise
    await expect(editor.action('Send').locator).toBeDisabled()
    await expect(editor.action('Cancel').locator).toBeDisabled()
    await expect(editor.recipient().locator).toBeDisabled()
    await page.keyboard.press('Escape')
    await expect(editor.sendDialog().locator).toBeVisible()
    await expect(editor.status().locator).toHaveText('Working...')
  } finally {
    release.resolve()
  }
  await expect(editor.sendDialog().locator).toHaveCount(0)
  await expect(editor.status().locator).toContainText('accepted')
  expect(ctx.emailService().attempts).toHaveLength(1)
})

test('preview sends unsaved content directly, with no email/job rows or template writes', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)
  await createTemplate(request, input())
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.content().locator.fill('Unsaved {{name}}')
  await editor.text().locator.fill('Independent text {{name}}')
  await editor.sample('name').locator.fill('Bob & Carol')
  await editor.action('Preview').locator.click()
  await expect(editor.preview().frame().locator).toContainText('Unsaved Bob & Carol')
  await editor.action('Close').locator.click()
  await editor.action('Send preview email').locator.click()
  await editor.recipient().locator.fill('preview@example.com')
  await editor.action('Send').locator.evaluate((button) => {
    if (!(button instanceof HTMLButtonElement)) throw new Error('Expected a button')
    button.click()
    button.click()
  })
  await expect(editor.status().locator).toHaveText('Preview accepted by the email provider.')
  await expect(editor.sendDialog().locator).toHaveCount(0)
  await expect(editor.action('Send preview email').locator).toBeFocused()
  expect(ctx.emailService().sentEmails).toHaveLength(1)
  const message = ctx.emailService().sentEmails[0].message
  expect(message).toMatchObject({
    from: 'Sender <sender@example.com>',
    to: 'preview@example.com',
    subject: 'Hello Bob & Carol',
    text: 'Independent text Bob & Carol',
  })
  expect(message.html).toContain('Unsaved Bob &amp; Carol')
  const [counts] = await ctx.sql()`SELECT
    (SELECT count(*)::int FROM email) AS emails, (SELECT count(*)::int FROM job) AS jobs,
    (SELECT count(*)::int FROM email_template_history) AS revisions`
  expect(counts).toEqual({emails: 0, jobs: 0, revisions: 1})
  await page.reload()
  await expect(editor.sample('name').locator).toHaveValue('Alice')
})

test('send failures stay visible without losing edits; retry reuses the same idempotency key', async ({
  page,
}) => {
  test.setTimeout(30000)
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.name().locator.fill('Draft')
  await editor.subject().locator.fill('Subject')
  await editor.content().locator.fill('Body')
  await editor.action('Send preview email').locator.click()
  await editor.recipient().locator.fill('preview@example.com')
  ctx.emailService().failNextSend(new Error('Provider failed'), {afterAcceptance: true})
  await editor.action('Send').locator.click()
  await expect(editor.alert().locator).toContainText('could not be sent')
  await expect(editor.sendDialog().locator).toContainText('could not be sent')
  await expect(editor.recipient().locator).toHaveValue('preview@example.com')
  await editor.action('Send').locator.click()
  await expect(editor.status().locator).toContainText('accepted')
  await expect(editor.name().locator).toHaveValue('Draft')
  await expect(editor.content().locator).toHaveText('Body')
  expect(ctx.emailService().attempts).toHaveLength(2)
  expect(ctx.emailService().attempts[0].options.idempotencyKey).toBe(
    ctx.emailService().attempts[1].options.idempotencyKey,
  )
  expect(ctx.emailService().sentEmails).toHaveLength(1)
})

test('rejects invalid input, archived writes and sends, and cross-template history', async ({
  request,
}) => {
  const url = (path: string) => new URL(`/emails/templates${path}`, ctx.url()).href
  await createTemplate(request, input())
  await createTemplate(request, {...input(), name: 'Other'})
  const [row] =
    await ctx.sql()`SELECT last_history_id FROM email_template WHERE email_template_number = 1`
  expect((await request.get(url(`/2/by-history/${row.lastHistoryId}`))).status()).toBe(404)
  expect((await request.get(url('/999'))).status()).toBe(404)
  for (const invalid of [
    {...input(), subject: '{{#if name}}'},
    {...input(), name: ' '},
    {...input(), editorDocument: {type: 'doc', content: [{type: 'unknown'}]}},
    {...input(), editorDocument: 'not json'},
  ]) {
    const response = await request.post(url('/'), {form: templateForm(invalid)})
    expect(response.headers()['hx-redirect']).toBeUndefined()
    expect(await response.text()).toContain('Invalid template.')
  }
  const archived = await request.delete(url('/1?delete-operation=delete'))
  expect(archived.headers()['hx-redirect']).toBe('/emails/templates/1')
  const update = await request.put(url('/1'), {form: templateForm(input())})
  expect(update.headers()['hx-redirect']).toBeUndefined()
  expect(await update.text()).toContain('Restore this template before editing or sending it.')
  const send = await request.post(url('/1/send-preview'), {
    form: {...templateForm(input()), to: 'preview@example.com', requestId: crypto.randomUUID()},
  })
  expect(await send.text()).toContain('Restore this template before editing or sending it.')
  const [counts] = await ctx.sql()`SELECT
    (SELECT count(*)::int FROM email_template) AS templates,
    (SELECT count(*)::int FROM email_template_history) AS revisions`
  expect(counts).toEqual({templates: 2, revisions: 3})
  expect(ctx.emailService().attempts).toHaveLength(0)
})

test('exports effective Hebrew direction in previews and inboxes while preserving block overrides', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)
  await createTemplate(request, {
    ...input(),
    editorDocument: {
      type: 'doc',
      content: [
        {
          type: 'container',
          content: ['שלום {{name}}!', 'English paragraph', 'טקסט ממורכז'].map((text, index) => ({
            type: 'paragraph',
            attrs: {alignment: index === 2 ? 'center' : null},
            content: [{type: 'text', text}],
          })),
        },
      ],
    },
  })
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.language().locator.selectOption('he')
  await editor.contentBlocks().locator.nth(1).click()
  await editor.action('Left to right').locator.click()

  async function expectDirections(paragraphs: Locator): Promise<void> {
    await expect(paragraphs.nth(0)).toHaveCSS('direction', 'rtl')
    await expect(paragraphs.nth(1)).toHaveCSS('direction', 'ltr')
    await expect(paragraphs.nth(2)).toHaveCSS('direction', 'rtl')
    await expect(paragraphs.nth(2)).toHaveCSS('text-align', 'center')
  }

  await expectDirections(editor.contentBlocks().locator)
  await editor.action('Preview').locator.click()
  await expect(editor.preview().frame().locator).toContainText('שלום Alice!')
  await expectDirections(editor.preview().frame().paragraphs().locator)
  await editor.action('Close').locator.click()
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await expect(editor.language().locator).toHaveValue('he')
  await editor.action('Preview').locator.click()
  await expectDirections(editor.preview().frame().paragraphs().locator)
  await editor.action('Close').locator.click()
  await editor.action('Send preview email').locator.click()
  await editor.recipient().locator.fill('preview@example.com')
  await editor.action('Send').locator.click()
  await expect(editor.status().locator).toContainText('accepted')
  const sentHtml = ctx.emailService().sentEmails[0].message.html

  await editor.language().locator.selectOption('en')
  await editor.action('Preview').locator.click()
  await expect(editor.preview().frame().paragraphs().locator.nth(0)).toHaveCSS('direction', 'ltr')
  await editor.action('Close').locator.click()

  await page.setContent('<main data-received-email style="direction:ltr;text-align:left"></main>')
  await editor.receivedEmail().locator.evaluate((host, html) => {
    const email = new DOMParser().parseFromString(html, 'text/html')
    host.innerHTML = email.body.innerHTML
  }, sentHtml)
  await expectDirections(editor.receivedEmail().paragraphs().locator)
})

test('preserves RTL, formatted expressions, URL images and independent text after save/reopen', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)
  const initial = input()
  initial.editorDocument.content[0].content[0].content = [
    {type: 'text', text: 'שלום {{name}} English'},
  ]
  await createTemplate(request, {...initial, language: 'he'})
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await editor.content().locator.click()
  await editor.action('Right to left').locator.click()
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await expect(editor.contentBlocks().locator.first()).toHaveCSS('direction', 'rtl')
  const [row] =
    await ctx.sql()`SELECT d.html FROM email_template t JOIN email_template_data d ON d.data_id = t.last_data_id`
  expect(row.html).toContain('dir="rtl"')
  expect(row.html).toContain('lang="he"')
  expect(row.html).toContain('direction:rtl')
  expect(row.html).toContain('{{name}}')
  await expect(editor.text().locator).toHaveValue('Hello {{name}}')
  await editor.content().locator.press('ControlOrMeta+End')
  await editor.action('Image').locator.click()
  await editor.url().locator.fill('https://example.com/{{picture}}')
  await editor.alt().locator.fill('Example image')
  await editor.action('Insert image').locator.click()
  await expect(editor.editorImages().locator).toHaveCount(1)
  await editor.sample('picture').locator.fill('image.png')
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(2)
  await expect(editor.editorImages().locator).toHaveAttribute(
    'src',
    'https://example.com/{{picture}}',
  )
})
test('exports structured layouts and complete Handlebars blocks without damaging expressions', async ({
  page,
  request,
}) => {
  test.setTimeout(30000)
  const paragraph = (text: string): JSONContent => ({
    type: 'paragraph',
    content: [{type: 'text', text}],
  })
  const directive = (expression: string): JSONContent => ({
    type: 'templateDirective',
    attrs: {expression},
  })
  const document: JSONContent = {
    type: 'doc',
    content: [
      {
        type: 'container',
        content: [
          {type: 'heading', attrs: {level: 2}, content: [{type: 'text', text: 'Title'}]},
          directive('{{#if name}}'),
          {
            type: 'twoColumns',
            content: [
              {
                type: 'columnsColumn',
                content: [
                  {
                    type: 'paragraph',
                    content: [
                      {type: 'text', text: '{{na'},
                      {type: 'text', text: 'me}}', marks: [{type: 'bold'}]},
                    ],
                  },
                ],
              },
              {type: 'columnsColumn', content: [paragraph('{{lookup this "name"}}')]},
            ],
          },
          directive('{{else}}'),
          paragraph('Nobody'),
          directive('{{/if}}'),
          directive('{{#each missing}}'),
          paragraph('{{this}}'),
          directive('{{/each}}'),
          paragraph('{{{raw}}}'),
          {
            type: 'table',
            content: [
              {
                type: 'tableRow',
                content: [{type: 'tableCell', content: [paragraph('Table content')]}],
              },
            ],
          },
          {type: 'bulletList', content: [{type: 'listItem', content: [paragraph('List content')]}]},
        ],
      },
    ],
  }
  await createTemplate(request, {
    ...input(),
    editorDocument: document,
    previewValues: {name: 'Alice', raw: '<b>Raw value</b>'},
  })
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await expect(editor.editorHeadings().locator).toHaveText('Title')
  await expect(editor.editorTables().locator).toHaveCount(1)
  await editor.inspector().theme().locator.selectOption('minimal')
  await editor.action('Save template').locator.click()
  await expect(editor.history().operation('Updated').locator).toHaveCount(1)
  await expect(editor.editorTables().locator).toHaveCount(1)
  await editor.action('Preview').locator.click()
  await expect(editor.preview().frame().locator).toContainText('Alice')
  await expect(editor.preview().frame().locator).toContainText('Raw value')
  await expect(editor.preview().frame().locator).toContainText('Table content')
  await expect(editor.preview().frame().locator).not.toContainText('Nobody')
  const [saved] = await ctx.sql()`SELECT d.html, d.editor_document FROM email_template t
          JOIN email_template_data d ON d.data_id = t.last_data_id`
  expect(saved.html).toContain('{{lookup this "name"}}')
  expect(saved.html).toContain('{{#each missing}}')
  expect(saved.html).toContain('{{{raw}}}')
  expect(JSON.stringify(saved.editorDocument)).toContain('"minimal"')
})

test('highlights code blocks in the editor and exports them on the server', async ({
  page,
  request,
}) => {
  await createTemplate(request, {
    ...input(),
    editorDocument: {
      type: 'doc',
      content: [
        {
          type: 'container',
          content: [{type: 'codeBlock', content: [{type: 'text', text: 'const answer = 42'}]}],
        },
      ],
    },
  })
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/1', ctx.url()).href)
  await expect(editor.editorCodeToken('keyword').locator).toHaveText('const')
  await expect(editor.editorCodeToken('number').locator).toHaveText('42')
  await editor.action('Preview').locator.click()
  const code = editor.preview().frame().code().locator
  // react-email's code-block renderer keeps spaces with zero-width joiners.
  await expect
    .poll(() => code.evaluate((pre) => pre.textContent!.replace(/[\u200b\u200d]/g, '')))
    .toMatch(/const\s+answer\s+=\s+42/)
})

test('lists in pages, searches names/descriptions, and keeps template content out of search', async ({
  request,
  page,
}) => {
  test.setTimeout(30000)
  const endpoint = new URL('/emails/templates/', ctx.url()).href
  for (let index = 0; index < 51; index++) {
    await createTemplate(request, {
      ...input(),
      name: `Template ${index}`,
      description: index === 0 ? 'Special description' : '',
    })
  }
  const list = createTemplateListPageModel(page)
  await page.goto(endpoint)
  await expect(list.rows().locator).toHaveCount(50)
  await list.rows().locator.last().scrollIntoViewIfNeeded()
  await expect(list.rows().locator).toHaveCount(51)
  await list.search().locator.fill('Special description')
  await expect(list.template('Template 0').locator).toBeVisible()
  await expect(list.rows().locator).toHaveCount(1)
  await list.search().locator.fill('Hello')
  await expect(list.rows().locator).toHaveText('No templates found')
})

test('rejects file drops, sandboxes previews, and survives repeated mounting', async ({page}) => {
  test.setTimeout(30000)
  const editor = createTemplatePageModel(page)
  await page.goto(new URL('/emails/templates/new', ctx.url()).href)
  await editor.name().locator.fill('Preview safety')
  await editor.subject().locator.fill('Subject')
  await editor.content().locator.fill('{{{raw}}}')
  // Complex expressions are intentionally not discovered: use a simple reference to supply raw.
  await editor.text().locator.fill('{{raw}}')
  await editor
    .sample('raw')
    .locator.fill('<img src="https://example.com/image.png" onerror="alert(1)">')
  const dialogs: string[] = []
  page.on('dialog', (dialog) => {
    dialogs.push(dialog.message())
    void dialog.dismiss()
  })
  await editor.action('Preview').locator.click()
  // Raw values reach the preview unchanged; the sandboxed iframe keeps them from running.
  await expect(editor.preview().iframe().locator).toHaveAttribute('sandbox', '')
  await expect(editor.preview().frame().images().locator).toHaveAttribute('onerror', 'alert(1)')
  await expect(editor.alert().locator).toHaveCount(0)
  expect(dialogs).toEqual([])
  await editor.action('Close').locator.click()
  await editor.content().locator.evaluate((element) => {
    const dataTransfer = new DataTransfer()
    dataTransfer.items.add(new File(['image'], 'image.png', {type: 'image/png'}))
    element.dispatchEvent(new DragEvent('drop', {bubbles: true, cancelable: true, dataTransfer}))
  })
  await expect(editor.alert().locator).toContainText('cannot be uploaded')
  await expect(editor.editorImages().locator).toHaveCount(0)
  await page.evaluate(() => {
    document.dispatchEvent(new Event('htmx:load'))
    document.dispatchEvent(new Event('htmx:load'))
  })
  await expect(editor.content().locator).toHaveCount(1)
  await expect(editor.content().locator).toHaveText('{{{raw}}}')
  await editor.content().locator.evaluate((element) => {
    const root = element.closest('[data-template-editor]')!
    root.dispatchEvent(new Event('htmx:beforeCleanupElement', {bubbles: true}))
    document.dispatchEvent(new Event('htmx:load'))
  })
  await expect(editor.content().locator).toHaveCount(1)
  await expect(editor.content().locator).toHaveText('')
  // Only the editor is client-rendered; the rest of the form is untouched by remounting it.
  await expect(editor.name().locator).toHaveValue('Preview safety')
})
