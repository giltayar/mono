import {readFile} from 'node:fs/promises'
import {readFileSync} from 'node:fs'
import {createHash} from 'node:crypto'
import {z} from 'zod'

// A static JSON import makes tsc copy package.json into dist, introducing a second package scope.
const packageUrl = new URL(import.meta.resolve('@giltayar/carmbo-pages-email/package.json'))
export const assetVersion = z
  .object({version: z.string()})
  .parse(JSON.parse(readFileSync(packageUrl, 'utf8'))).version
export const assetPrefix = `/emails/templates/assets/${assetVersion}`
const root = new URL('./dist/browser/email-template/', packageUrl)

export async function readEditorAsset(name: 'editor.js' | 'editor.css'): Promise<Buffer> {
  return readFile(new URL(name, root))
}

export async function editorAssetUrl(name: 'editor.js' | 'editor.css'): Promise<string> {
  const hash = createHash('sha256')
    .update(await readEditorAsset(name))
    .digest('hex')
  return `${assetPrefix}/${name}?v=${hash}`
}

export const templateListStyles = `.email-templates-view {
  padding-block-end: 5rem;

  table {
    table-layout: fixed;
  }

  th:first-child, td:first-child {
    width: 4rem;
    text-align: end;
  }

  td {
    overflow-wrap: anywhere;
  }

  .add-new {
    position: fixed;
    inset-block-end: 1rem;
    inset-inline-end: 1rem;
  }

  @media (max-width: 575px) {
    .title-and-search form {
      width: 100%;
    }

    fieldset {
      display: grid;
      grid-template-columns: auto minmax(0, 1fr);
      gap: 0.5rem;
      margin-inline: 0;
    }

    .form-check {
      grid-column: 1 / -1;
      padding-inline-start: 1.5rem;
      margin-block-end: 0;
    }

    .form-input-label {
      padding-inline: 0;
    }
  }
}
`
