console.log('Début du script')

import { getAccessToken, getSignedInEmail } from '../auth/identity'
import { calculateRiskScore } from '../detection/riskScorer'
import { parseGmailMessage } from '../gmail/parseGmailMessage'

const GMAIL_API = 'https://gmail.googleapis.com/gmail/v1/users/me'

type GmailMessageListResponse = {
  messages?: Array<{ id: string }>
}

type GmailMessageDetailResponse = {
  id?: string
  payload?: {
    headers?: Array<{ name: string; value: string }>
  }
}

export async function runInboxRiskCheck(): Promise<void> {
  if (typeof chrome === 'undefined' || !chrome.identity) {
    console.warn('[Confio] Ce script doit être exécuté depuis le contexte Chrome Extension (pas depuis Node brut).')
    return
  }

  const token = await getAccessToken(false)
  const accountEmail = await getSignedInEmail(token)

  const listResponse = await fetch(`${GMAIL_API}/messages?maxResults=10&labelIds=INBOX`, {
    headers: { Authorization: `Bearer ${token}` },
  })

  if (!listResponse.ok) {
    throw new Error(`Impossible de récupérer les messages Gmail (${listResponse.status})`)
  }

  const listData = (await listResponse.json()) as GmailMessageListResponse
  const messageIds = listData.messages ?? []

  if (messageIds.length === 0) {
    console.log(`[Confio] Aucune donnée à analyser pour ${accountEmail ?? 'ce compte'}.`)
    return
  }

  const details = await Promise.all(
    messageIds.map(async (message) => {
      const detailResponse = await fetch(`${GMAIL_API}/messages/${message.id}?format=full`, {
        headers: { Authorization: `Bearer ${token}` },
      })

      if (!detailResponse.ok) {
        throw new Error(`Impossible de récupérer le message ${message.id} (${detailResponse.status})`)
      }

      return (await detailResponse.json()) as GmailMessageDetailResponse
    }),
  )

  for (const message of details) {
    const parsedEmail = parseGmailMessage(message as any)
    const result = calculateRiskScore(parsedEmail)

    const senderDomain = parsedEmail.senderEmail.includes('@') ? parsedEmail.senderEmail.split('@')[1]?.trim() || 'inconnu' : 'inconnu'

    console.log('---')
    console.log('Sujet:', parsedEmail.subject || '(sans objet)')
    console.log('From:', `${parsedEmail.senderDisplayName} <${parsedEmail.senderEmail}>`)
    console.log('Domain:', senderDomain)
    console.log('SPF:', parsedEmail.spfResult, '| DKIM:', parsedEmail.dkimResult, '| DMARC:', parsedEmail.dmarcResult)
    console.log('Score:', result.score, '| Niveau:', result.level)
    console.log('Signaux déclenchés:')

    if (result.triggeredSignals.length === 0) {
      console.log('  - Aucun signal particulier')
    } else {
      for (const signal of result.triggeredSignals) {
        console.log(`  - ${signal.signal} (${signal.weight} pts): ${signal.explanation}`)
      }
    }
  }
}

if (
  typeof process !== 'undefined' &&
  process.argv[1] &&
  decodeURIComponent(import.meta.url).endsWith(process.argv[1].replaceAll('\\', '/'))
) {
  runInboxRiskCheck().catch((error) => {
    console.error('[Confio] Erreur pendant l’analyse de la boîte mail :', error)
    process.exitCode = 1
  })
}
