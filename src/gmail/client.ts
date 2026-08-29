import { getAccessToken, getSignedInEmail, invalidateAccessToken } from '../auth/identity'
import { calculateRiskScore } from '../detection/riskScorer'
import { extractAuthSignals, getHeader, parseFromHeader } from './headers'
import { parseGmailMessage } from './parseGmailMessage'
import type { GmailHeader, InboxMailPreview, InboxPreviewResult } from './types'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'
const INBOX_PAGE_SIZE = 10

type MessageListResponse = {
  messages?: Array<{ id: string; threadId: string }>
}

type MessageGetResponse = {
  id: string
  threadId: string
  snippet?: string
  payload?: {
    mimeType?: string
    headers?: GmailHeader[]
    body?: { data?: string }
    parts?: Array<{ mimeType?: string; body?: { data?: string }; parts?: Array<{ mimeType?: string; body?: { data?: string } }> }>
  }
}

/**
 * 10 derniers mails de l'INBOX, avec en-têtes complets (format=full).
 * Aucune logique de détection : on récupère et on log.
 */
export async function fetchRecentInboxMails(): Promise<InboxPreviewResult> {
  const token = await getAccessToken(false)
  const accountEmail = await getSignedInEmail(token)

  const list = await gmailFetch<MessageListResponse>(
    token,
    `${GMAIL_API}/messages?maxResults=${INBOX_PAGE_SIZE}&labelIds=INBOX`,
  )

  const ids = list.messages ?? []
  const mails = await Promise.all(ids.map((item) => fetchMailPreview(token, item.id)))

  logInboxPreview(accountEmail, mails)

  return { accountEmail, mails }
}

async function fetchMailPreview(token: string, messageId: string): Promise<InboxMailPreview> {
  // format=full = payload.headers = tous les en-têtes MIME (pas seulement From).
  const message = await gmailFetch<MessageGetResponse>(
    token,
    `${GMAIL_API}/messages/${messageId}?format=full`,
  )

  const headers = message.payload?.headers ?? []
  const parsedEmail = parseGmailMessage(message as any)
  const risk = calculateRiskScore(parsedEmail)

  return {
    id: message.id,
    threadId: message.threadId,
    snippet: message.snippet ?? '',
    subject: getHeader(headers, 'Subject'),
    date: getHeader(headers, 'Date'),
    from: parseFromHeader(getHeader(headers, 'From')),
    auth: extractAuthSignals(headers),
    riskScore: risk.score,
    riskLevel: risk.level,
    triggeredSignals: risk.triggeredSignals.map(({ signal, explanation }) => ({ signal, explanation })),
    headers,
  }
}

async function gmailFetch<T>(token: string, url: string, retried = false): Promise<T> {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (response.status === 401 && !retried) {
    await invalidateAccessToken(token)
    const freshToken = await getAccessToken(true)
    return gmailFetch<T>(freshToken, url, true)
  }

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Gmail API ${response.status}: ${body || response.statusText}`)
  }

  return (await response.json()) as T
}

function logInboxPreview(accountEmail: string | null, mails: InboxMailPreview[]): void {
  console.group(`[Confio] ${mails.length} mail(s) INBOX — ${accountEmail ?? 'compte inconnu'}`)

  for (const [index, mail] of mails.entries()) {
    console.group(`${index + 1}. ${mail.subject ?? '(sans objet)'}`)
    console.log('id', mail.id)
    console.log('from.raw', mail.from.raw)
    console.log('from.email', mail.from.emailAddress)
    console.log('from.domain', mail.from.domain)
    console.log('auth.spf', mail.auth.spf)
    console.log('auth.dkim', mail.auth.dkim)
    console.log('auth.dmarc', mail.auth.dmarc)
    console.log('riskScore', mail.riskScore)
    console.log('riskLevel', mail.riskLevel)
    console.log('triggeredSignals', mail.triggeredSignals)
    console.log('Authentication-Results', mail.auth.authenticationResults)
    console.log('Received-SPF', mail.auth.receivedSpf)
    console.log('headers (complets)', mail.headers)
    console.groupEnd()
  }

  console.groupEnd()
}
