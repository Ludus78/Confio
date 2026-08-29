import { runInboxRiskCheck } from '../scripts/testOnRealInbox'

(globalThis as any).runInboxRiskCheck = runInboxRiskCheck

import { getAccessToken, getSignedInEmail, signOut } from '../auth/identity'
import { isOAuthClientConfigured } from '../config'
import { fetchRecentInboxMails } from '../gmail/client'
import type { AuthState, ExtensionRequest, ExtensionResponse } from '../messaging'
import type { InboxPreviewResult } from '../gmail/types'

chrome.runtime.onInstalled.addListener(() => {
  console.log('[Confio] Service worker prêt. Configure le client OAuth puis ouvre le popup.')
})

chrome.runtime.onMessage.addListener(
  (message: ExtensionRequest, _sender, sendResponse: (response: ExtensionResponse<unknown>) => void) => {
    void handleMessage(message)
      .then((data) => sendResponse({ ok: true, data }))
      .catch((error: unknown) => {
        const text = error instanceof Error ? error.message : String(error)
        console.error('[Confio]', text)
        sendResponse({ ok: false, error: text })
      })

    // true = réponse asynchrone (obligatoire en MV3 avec Promises).
    return true
  },
)

async function handleMessage(message: ExtensionRequest): Promise<unknown> {
  switch (message.type) {
    case 'GET_AUTH_STATE':
      return getAuthState()
    case 'SIGN_IN':
      return signIn()
    case 'SIGN_OUT':
      await signOut()
      return { signedIn: false, email: null } satisfies AuthState
    case 'FETCH_RECENT_MAILS':
      return fetchRecentInboxMails()
    default:
      throw new Error('Message inconnu')
  }
}

async function getAuthState(): Promise<AuthState> {
  if (!isOAuthClientConfigured()) {
    return { signedIn: false, email: null }
  }

  try {
    const token = await getAccessToken(false)
    const email = await getSignedInEmail(token)
    return { signedIn: true, email }
  } catch {
    return { signedIn: false, email: null }
  }
}

async function signIn(): Promise<InboxPreviewResult> {
  if (!isOAuthClientConfigured()) {
    throw new Error(
      'Client OAuth non configuré. Copie VITE_GOOGLE_OAUTH_CLIENT_ID dans .env (voir .env.example) puis relance Vite.',
    )
  }

  // interactive: true uniquement sur geste utilisateur (bouton du popup).
  await getAccessToken(true)
  return fetchRecentInboxMails()
}
