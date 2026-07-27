import {cert, initializeApp} from 'firebase-admin/app'
import {getAuth} from 'firebase-admin/auth'
import * as z from 'zod'
import type {Auth} from './auth.ts'

const ServiceAccountSchema = z.object({
  project_id: z.string(),
  client_email: z.string(),
  private_key: z.string(),
})

export function createFirebaseAuth({
  serviceAccountJson,
  apiKey,
}: {
  serviceAccountJson: string
  apiKey: string
}): Auth {
  const serviceAccount = ServiceAccountSchema.parse(JSON.parse(serviceAccountJson))

  const auth = getAuth(
    initializeApp({
      credential: cert({
        projectId: serviceAccount.project_id,
        clientEmail: serviceAccount.client_email,
        // an environment variable cannot hold real newlines, so the key arrives with them escaped
        privateKey: serviceAccount.private_key.replaceAll('\\n', '\n'),
      }),
    }),
  )

  return {
    clientConfig: {
      apiKey,
      authDomain: `${serviceAccount.project_id}.firebaseapp.com`,
      projectId: serviceAccount.project_id,
    },

    async createSessionCookie(idToken, expiresInMs) {
      // checking for revocation here, and only here, means a revoked account cannot be turned into
      // a days-long session, without paying for that check on every single request
      await auth.verifyIdToken(idToken, true)

      return await auth.createSessionCookie(idToken, {expiresIn: expiresInMs})
    },

    async verifySessionCookie(sessionCookie) {
      try {
        const claims = await auth.verifySessionCookie(sessionCookie)

        return {uid: claims.uid, email: claims.email}
      } catch {
        // an expired, malformed, or forged cookie is just an anonymous request
        return undefined
      }
    },
  }
}
