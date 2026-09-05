import {fileURLToPath} from 'node:url'
import type {FastifyRequest} from 'fastify'
import {requestContext} from '@fastify/request-context'
import i18next, {getFixedT, type Namespace, type TFunction} from 'i18next'
import i18nextFsBackend from 'i18next-fs-backend'

declare module '@fastify/request-context' {
  interface RequestContextData {
    language: Language
  }
}

export const SUPPORTED_LANGUAGES = ['en', 'he'] as const

export type Language = (typeof SUPPORTED_LANGUAGES)[number]

export const LANGUAGE_COOKIE_NAME = 'lang'

const LAYOUT_NAMESPACE = 'layout'
const NAMESPACES = [LAYOUT_NAMESPACE, 'expenses', 'login', 'settings']
const ONE_YEAR_IN_SECONDS = 60 * 60 * 24 * 365

let defaultLanguage: Language = 'en'

/**
 * Loads all the translations of all the supported languages. Must be awaited before the app starts
 * serving requests.
 */
export async function initializeI18n(language: Language): Promise<void> {
  defaultLanguage = language

  await i18next.use(i18nextFsBackend).init({
    lng: language,
    fallbackLng: 'en',
    supportedLngs: SUPPORTED_LANGUAGES,
    // the language is per-request, so every language must be resident in memory
    preload: SUPPORTED_LANGUAGES,
    ns: NAMESPACES,
    defaultNS: LAYOUT_NAMESPACE,
    // vhtml escapes interpolated values already, so escaping here too would double-escape them
    interpolation: {escapeValue: false},
    backend: {
      loadPath: (language: string, namespace: string) =>
        namespace === LAYOUT_NAMESPACE
          ? localeFile(`../layout/locale/${language}.json`)
          : localeFile(`../domain/${namespace}/locale/${language}.json`),
    },
  })
}

/** The language of the request being handled, falling back to the default outside of a request */
export function currentLanguage(): Language {
  return requestContext.get('language') ?? defaultLanguage
}

export function currentDirection(): 'ltr' | 'rtl' {
  return i18next.dir(currentLanguage())
}

/**
 * The translation function of `namespace`, for the language of the request being handled. Never
 * hold on to the result across requests — it is bound to a single language.
 */
export function translator<const N extends Namespace>(namespace: N): TFunction<N> {
  return getFixedT(currentLanguage(), namespace)
}

/** The language of a request: an explicit cookie wins over the browser's `Accept-Language` */
export function resolveLanguage(request: FastifyRequest): Language {
  const cookieLanguage = SUPPORTED_LANGUAGES.find(
    (language) => language === request.cookies[LANGUAGE_COOKIE_NAME],
  )

  return cookieLanguage ?? negotiateLanguage(request.headers['accept-language']) ?? defaultLanguage
}

/** The most preferred supported language of an `Accept-Language` header, if any */
export function negotiateLanguage(acceptLanguage: string | undefined): Language | undefined {
  if (!acceptLanguage) {
    return undefined
  }

  const candidates = acceptLanguage
    .split(',')
    .map(parseAcceptLanguage)
    .filter((candidate) => candidate !== undefined)
    // `sort` is stable, so equal qualities keep the order the header listed them in
    .sort((l, r) => r.quality - l.quality)

  for (const {language, quality} of candidates) {
    if (quality === 0) {
      continue
    }

    if (language === '*') {
      return defaultLanguage
    }

    const supportedLanguage = SUPPORTED_LANGUAGES.find((supported) => supported === language)

    if (supportedLanguage !== undefined) {
      return supportedLanguage
    }
  }

  return undefined
}

export function languageCookie(language: Language): string {
  return `${LANGUAGE_COOKIE_NAME}=${language}; Path=/; Max-Age=${ONE_YEAR_IN_SECONDS}; SameSite=Lax; HttpOnly`
}

function parseAcceptLanguage(
  acceptLanguage: string,
): {language: string; quality: number} | undefined {
  const [languageRange = '', ...parameters] = acceptLanguage.split(';')
  // `he-IL` and `he` are both requests for Hebrew
  const [language = ''] = languageRange.trim().toLowerCase().split('-')

  if (language === '') {
    return undefined
  }

  const qualityParameter = parameters
    .map((parameter) => parameter.trim())
    .find((parameter) => parameter.startsWith('q='))

  const quality = qualityParameter === undefined ? 1 : Number(qualityParameter.slice('q='.length))

  return {language, quality: Number.isFinite(quality) ? quality : 0}
}

function localeFile(pathRelativeToThisFile: string): string {
  // resolved relative to this file, and not to the CWD, so that the app can be started from anywhere
  return fileURLToPath(new URL(pathRelativeToThisFile, import.meta.url))
}
