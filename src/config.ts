/**
 * Configuration runtime (côté pages / service worker).
 *
 * ── Google Cloud Console (à faire une fois) ──────────────────────────────
 * 1. Crée un projet : https://console.cloud.google.com/
 * 2. Active l'API Gmail : APIs & Services → Library → "Gmail API" → Enable.
 *    Sans ça tu auras un 403 même avec un token valide.
 * 3. Écran de consentement OAuth :
 *    - User type : External
 *    - Statut : Testing (pas besoin de vérification Google en V1)
 *    - Ajoute TON Gmail dans "Test users" (scope Gmail = sensible)
 *    - Scopes : https://www.googleapis.com/auth/gmail.readonly
 * 4. Credentials → Create credentials → OAuth client ID
 *    - Type : **Chrome Extension** (pas Web, pas Desktop)
 *    - Application ID : l'ID d'extension figé ci-dessous
 *      → gogajdnjlmcocjhdplegfnegbioankim
 * 5. Copie le Client ID dans `.env` (voir `.env.example`) puis relance `npm run dev`.
 *
 * Pièges fréquents :
 * - Mauvais type de client → getAuthToken échoue silencieusement / "bad client".
 * - ID d'extension ≠ Application ID du client → "OAuth2 request invalid".
 * - Compte pas dans Test users → écran "Access blocked".
 * - API Gmail non activée → 403 accessNotConfigured.
 */

export { EXTENSION_ID } from './extension-identity'

export const GMAIL_READONLY_SCOPE =
  'https://www.googleapis.com/auth/gmail.readonly'

const PLACEHOLDER_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'

export const GOOGLE_OAUTH_CLIENT_ID =
  import.meta.env.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || PLACEHOLDER_CLIENT_ID

export function isOAuthClientConfigured(): boolean {
  const id = GOOGLE_OAUTH_CLIENT_ID
  return Boolean(id) && id !== PLACEHOLDER_CLIENT_ID && id.includes('.apps.googleusercontent.com')
}
