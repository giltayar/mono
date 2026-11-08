import type {Page} from '@playwright/test'

export function createTemplatePageModel(page: Page) {
  return {
    heading: () => ({locator: page.locator('.template-heading')}),
    floatingLabels: () => ({locator: page.locator('.template-fields .form-floating > label')}),
    name: () => ({locator: page.getByRole('textbox', {name: 'Name', exact: true})}),
    description: () => ({locator: page.getByRole('textbox', {name: 'Description', exact: true})}),
    subject: () => ({locator: page.getByRole('textbox', {name: 'Subject template', exact: true})}),
    text: () => ({locator: page.getByRole('textbox', {name: 'Plain-text template', exact: true})}),
    content: () => ({locator: page.getByRole('textbox', {name: 'Email content', exact: true})}),
    language: () => ({
      locator: page.getByRole('combobox', {name: 'Content language', exact: true}),
    }),
    samples: () => ({
      locator: page.getByRole('region', {name: 'Sample values', exact: true}).getByRole('textbox'),
    }),
    sample: (name: string) => ({
      locator: page
        .getByRole('region', {name: 'Sample values', exact: true})
        .getByRole('textbox', {name, exact: true}),
    }),
    action: (name: string) => ({
      locator: page
        .getByRole('button', {name, exact: true})
        .and(page.locator(':not(.template-inspector *)')),
    }),
    toolbar: () => ({locator: page.getByRole('toolbar')}),
    menuItem: (name: string) => ({locator: page.getByRole('menuitem', {name, exact: true})}),
    menuCheckbox: (name: string) => ({
      locator: page.getByRole('menuitemcheckbox', {name, exact: true}),
    }),
    dialog: () => ({locator: page.getByRole('dialog')}),
    rawHtml: () => ({
      locator: page.getByRole('dialog').getByRole('textbox'),
    }),
    recipient: () => ({
      locator: page.getByRole('textbox', {name: 'Preview recipient', exact: true}),
    }),
    alert: () => ({locator: page.getByRole('alert')}),
    status: () => ({locator: page.getByRole('status')}),
    history: () => ({
      locator: page.getByRole('region', {name: 'History', exact: true}),
      entries: () => ({locator: page.locator('.template-history .list-group-item')}),
      current: () => ({locator: page.locator('.template-history [aria-current="page"]')}),
      operation: (name: string) => ({
        locator: page
          .getByRole('region', {name: 'History', exact: true})
          .getByRole('link', {name, exact: true}),
      }),
    }),
    preview: () => ({
      locator: page.getByRole('dialog', {name: 'Preview', exact: true}),
      frame: () => ({
        locator: page.frameLocator('iframe[title="Preview"]').locator('body'),
        paragraphs: () => ({locator: page.frameLocator('iframe[title="Preview"]').locator('p')}),
        code: () => ({locator: page.frameLocator('iframe[title="Preview"]').locator('pre')}),
        images: () => ({locator: page.frameLocator('iframe[title="Preview"]').locator('img')}),
      }),
      iframe: () => ({locator: page.locator('iframe[title="Preview"]')}),
      text: () => ({locator: page.locator('.template-preview-dialog pre')}),
      textToggle: () => ({locator: page.locator('.template-preview-dialog summary')}),
      subject: () => ({locator: page.locator('.template-preview-subject')}),
    }),
    sendDialog: () => ({
      locator: page.getByRole('dialog', {name: 'Send preview email', exact: true}),
    }),
    receivedEmail: () => ({
      locator: page.locator('[data-received-email]'),
      paragraphs: () => ({locator: page.locator('[data-received-email] p')}),
    }),
    url: () => ({
      locator: page
        .getByRole('textbox', {name: 'URL or Handlebars expression', exact: true})
        .first(),
    }),
    alt: () => ({
      locator: page.getByRole('textbox', {name: 'Alternative text', exact: true}).first(),
    }),
    expression: () => ({
      locator: page.getByRole('textbox', {name: 'Handlebars expression', exact: true}).first(),
    }),
    editorImages: () => ({locator: page.locator('.tiptap img')}),
    editorTables: () => ({locator: page.locator('.tiptap table')}),
    editorTableRows: () => ({locator: page.locator('.tiptap table tr')}),
    editorTableCells: () => ({locator: page.locator('.tiptap table td')}),
    editorLinks: () => ({locator: page.locator('.tiptap a')}),
    editorText: (text: string) => ({
      locator: page.locator('.tiptap').getByText(text, {exact: true}),
    }),
    editorHeadings: () => ({locator: page.locator('.tiptap h2')}),
    editorCodeToken: (kind: string) => ({locator: page.locator(`.tiptap pre .token.${kind}`)}),
    editorBold: () => ({locator: page.locator('.tiptap strong')}),
    editorSpans: () => ({locator: page.locator('.tiptap span[style]')}),
    contentContainer: () => ({locator: page.locator('.tiptap .node-container').first()}),
    editorColumns: () => ({locator: page.locator('.tiptap .node-twoColumns')}),
    inspector: () => ({
      locator: page.locator('.template-inspector'),
      theme: () => ({locator: page.getByRole('combobox', {name: 'Theme', exact: true})}),
      mode: () => ({locator: page.locator('[data-inspector-mode]')}),
      sections: () => ({locator: page.locator('.template-style-section > legend')}),
      section: (name: string) => ({
        locator: page.locator('.template-inspector').getByRole('group', {name, exact: true}),
      }),
      labels: () => ({locator: page.locator('.template-style-field > span')}),
      field: (name: string) => ({
        locator: page.locator('.template-inspector').getByLabel(name, {exact: true}),
      }),
    }),
    contentBlocks: () => ({locator: page.locator('.tiptap p')}),
    languagePage: () => ({locator: page.locator('html')}),
    hebrewContent: () => ({locator: page.getByRole('textbox', {name: 'תוכן ההודעה', exact: true})}),
    hebrewField: (name: string) => ({locator: page.getByRole('textbox', {name, exact: true})}),
    hebrewSamples: () => ({locator: page.getByRole('region', {name: 'ערכים לדוגמה', exact: true})}),
  }
}

export function createTemplateListPageModel(page: Page) {
  return {
    search: () => ({locator: page.getByRole('searchbox', {name: 'Search templates', exact: true})}),
    archived: () => ({
      locator: page.getByRole('checkbox', {name: 'Include archived', exact: true}),
    }),
    rows: () => ({locator: page.locator('#templates-table tbody tr')}),
    template: (name: string) => ({
      locator: page
        .locator('#templates-table tbody tr')
        .filter({has: page.getByText(name, {exact: true})})
        .getByRole('button'),
    }),
    new: () => ({locator: page.locator('.email-templates-view .add-new a')}),
    headers: () => ({locator: page.locator('#templates-table th')}),
    activeTab: () => ({locator: page.locator('nav.nav-tabs [aria-current="page"]')}),
  }
}
