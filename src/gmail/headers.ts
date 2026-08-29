import type {
  AuthProtocolResult,
  GmailHeader,
  MailAuthSignals,
  ParsedFrom,
} from './types'

export function getHeader(headers: GmailHeader[], name: string): string | null {
  const needle = name.toLowerCase()
  const match = headers.find((header) => header.name.toLowerCase() === needle)
  return match?.value ?? null
}

export function parseFromHeader(raw: string | null): ParsedFrom {
  if (!raw) {
    return { raw: null, displayName: null, emailAddress: null, domain: null }
  }

  const decoded = decodeMimeHeader(raw)
  const angle = decoded.match(/^(.*?)\s*<([^>]+)>/)
  const candidate = angle ? angle[2] : decoded
  const emailMatch = candidate.match(/[A-Z0-9._%+\-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  const emailAddress = (emailMatch ? emailMatch[0] : candidate).trim().replace(/^mailto:/i, '')
  const displayName = angle ? unquote(angle[1].trim()) : null
  const domain = emailAddress.includes('@')
    ? emailAddress.split('@').pop()?.toLowerCase() ?? null
    : null

  return {
    raw: decoded,
    displayName: displayName ? decodeMimeHeader(displayName) : null,
    emailAddress: emailAddress || null,
    domain,
  }
}

/**
 * Extrait SPF / DKIM / DMARC des en-têtes — lecture seule, pas de score.
 * Gmail agrège ça dans Authentication-Results (et parfois Received-SPF).
 */
export function extractAuthSignals(headers: GmailHeader[]): MailAuthSignals {
  const authenticationResults = getHeader(headers, 'Authentication-Results')
  const receivedSpf = getHeader(headers, 'Received-SPF')
  const source = `${authenticationResults ?? ''} ${receivedSpf ?? ''}`

  return {
    spf: readAuthResult(source, 'spf'),
    dkim: readAuthResult(source, 'dkim'),
    dmarc: readAuthResult(source, 'dmarc'),
    authenticationResults,
    receivedSpf,
  }
}

function readAuthResult(source: string, mechanism: 'spf' | 'dkim' | 'dmarc'): AuthProtocolResult {
  const pattern = new RegExp(`\\b${mechanism}\\s*(?:=|:)\\s*([a-z]+)`, 'gi')
  const values = Array.from(source.matchAll(pattern), (match) => match[1]?.toLowerCase())
  const value = values.find(Boolean)

  if (!value) {
    return 'none'
  }

  if (value === 'pass') return 'pass'
  if (value === 'neutral') return 'neutral'
  if (value === 'none') return 'none'
  if (value === 'fail' || value === 'softfail' || value === 'temperror' || value === 'permerror') return 'fail'

  return 'unknown'
}

function unquote(value: string): string {
  return value.replace(/^['"]|['"]$/g, '').trim()
}

export function decodeMimeHeader(value: string): string {
  return value.replace(/=\?([^?]+)\?([bBqQ])\?([^?]*)\?=/g, (_, _charset, encoding, encoded) => {
    const raw = encoding.toLowerCase() === 'b' ? decodeBase64Word(encoded) : decodeQWord(encoded)
    return raw
  })
}

function decodeBase64Word(value: string): string {
  const normalized = value.replace(/\s+/g, '').replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)

  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }
    return atob(padded)
  } catch {
    return value
  }
}

function decodeQWord(value: string): string {
  return value
    .replace(/=([A-Fa-f0-9]{2})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16)))
    .replace(/_/g, ' ')
}
