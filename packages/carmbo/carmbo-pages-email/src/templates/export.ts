import {Editor, type JSONContent} from '@tiptap/core'
import {composeReactEmail} from '@react-email/editor/core'
import {editorExtensions} from './editor-extensions.ts'
import {protectTemplateTokens} from './tokens.ts'
import {
  TEMPLATE_DOCUMENT_VERSION,
  type Template,
  type TemplateDraft,
  type TemplateLanguage,
} from './schema.ts'

export async function exportEmail(
  content: JSONContent,
  language: TemplateLanguage,
): Promise<string> {
  const protectedContent = protectTemplateTokens(content)
  const editor = new Editor({
    element: null,
    extensions: editorExtensions(language),
    content: protectedContent.document,
    editable: false,
  })
  try {
    const {html} = await composeReactEmail({editor, pretty: false})
    return protectedContent.restore(html)
  } finally {
    editor.destroy()
  }
}

export async function templateFromDraft(draft: TemplateDraft): Promise<Template> {
  return {
    ...draft,
    html: await exportEmail(draft.editorDocument, draft.language),
    editorDocumentVersion: TEMPLATE_DOCUMENT_VERSION,
  }
}
