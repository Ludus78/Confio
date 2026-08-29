/** Messages popup ↔ service worker. */

export type AuthState = {
  signedIn: boolean
  email: string | null
}

export type SignInRequest = { type: 'SIGN_IN' }
export type SignOutRequest = { type: 'SIGN_OUT' }
export type GetAuthStateRequest = { type: 'GET_AUTH_STATE' }
export type FetchRecentMailsRequest = { type: 'FETCH_RECENT_MAILS' }

export type ExtensionRequest =
  | SignInRequest
  | SignOutRequest
  | GetAuthStateRequest
  | FetchRecentMailsRequest

export type ExtensionResponse<T> =
  | { ok: true; data: T }
  | { ok: false; error: string }
