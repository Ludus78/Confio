/**
 * OAuth via chrome.identity (pas de PKCE / pas de launchWebAuthFlow).
 *
 * Chrome ouvre le consentement Google, stocke le token, et le rafraîchit.
 * On ne persiste JAMAIS le token nous-mêmes (storage interdit pour ça).
 *
 * interactive: true  → clic utilisateur (popup de connexion autorisée)
 * interactive: false → sonde silencieuse (déjà connecté ou non)
 */

export async function getAccessToken(interactive: boolean): Promise<string> {
  const result = await chrome.identity.getAuthToken({ interactive })
  const token = typeof result === 'string' ? result : result?.token

  if (!token) {
    const hint = chrome.runtime.lastError?.message
    throw new Error(
      hint ||
        'Impossible d’obtenir un jeton Google. Vérifie le client OAuth (type Chrome Extension) et l’ID d’extension.',
    )
  }

  return token
}

/** Email du compte Gmail autorisé (scope readonly, pas besoin de userinfo.email). */
export async function getSignedInEmail(accessToken: string): Promise<string | null> {
  const response = await fetch('https://gmail.googleapis.com/gmail/v1/users/me/profile', {
    headers: { Authorization: `Bearer ${accessToken}` },
  })

  if (!response.ok) {
    return null
  }

  const profile = (await response.json()) as { emailAddress?: string }
  return profile.emailAddress ?? null
}

/**
 * En cas de 401, le cache Chrome a un token périmé : on l’évince puis on réessaie.
 */
export async function invalidateAccessToken(token: string): Promise<void> {
  await chrome.identity.removeCachedAuthToken({ token })
}

export async function signOut(): Promise<void> {
  let token: string | undefined

  try {
    token = await getAccessToken(false)
  } catch {
    token = undefined
  }

  if (token) {
    try {
      await fetch('https://oauth2.googleapis.com/revoke', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({ token }),
      })
    } catch {
      // Révocation réseau optionnelle : on vide quand même le cache local.
    }

    await chrome.identity.removeCachedAuthToken({ token })
  }

  await chrome.identity.clearAllCachedAuthTokens()
}
