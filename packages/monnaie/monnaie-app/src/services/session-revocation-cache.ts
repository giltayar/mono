import crypto from 'node:crypto'

export class SessionRevocationCache {
  readonly #checkedAtBySession = new Map<string, number>()
  readonly #maxAgeMs: number
  readonly #maxEntries: number
  readonly #now: () => number

  constructor(maxAgeMs: number, maxEntries: number, now: () => number) {
    this.#maxAgeMs = maxAgeMs
    this.#maxEntries = maxEntries
    this.#now = now
  }

  has(sessionCookie: string): boolean {
    const key = sessionKey(sessionCookie)
    const checkedAt = this.#checkedAtBySession.get(key)

    if (checkedAt === undefined || this.#now() - checkedAt >= this.#maxAgeMs) {
      this.#checkedAtBySession.delete(key)
      return false
    }

    // Keep recently used sessions at the end so the size bound evicts the least recent one.
    this.#checkedAtBySession.delete(key)
    this.#checkedAtBySession.set(key, checkedAt)
    return true
  }

  add(sessionCookie: string): void {
    const key = sessionKey(sessionCookie)

    this.#checkedAtBySession.delete(key)
    this.#checkedAtBySession.set(key, this.#now())

    if (this.#checkedAtBySession.size > this.#maxEntries) {
      const oldestKey = this.#checkedAtBySession.keys().next().value as string
      this.#checkedAtBySession.delete(oldestKey)
    }
  }
}

function sessionKey(sessionCookie: string): string {
  return crypto.createHash('sha256').update(sessionCookie).digest('base64url')
}
