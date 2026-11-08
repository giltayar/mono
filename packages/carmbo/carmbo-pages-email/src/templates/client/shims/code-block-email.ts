// Replaces @react-email/editor's lazily loaded code-block email renderer in the browser bundle.
// Email HTML is exported on the server, so the browser never renders code blocks to email, and
// skipping it drops react-email's bundled Prism grammars and themes.
export function CodeBlockEmail(): never {
  throw new Error('Email HTML is rendered on the server')
}
