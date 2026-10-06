import type { ParsedEmail } from '../types'
import { WEIGHTS } from '../types'

export type SignalEvaluation = {
  signal: string
  weight: number
  triggered: boolean
  explanation: string
}

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const extractDomain = (value?: string | null): string | null => {
  const input = (value ?? '').trim()
  if (!input || /\s/.test(input)) return null

  try {
    const normalized = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const hostname = new URL(normalized).hostname.toLowerCase()
    return hostname.includes('.') ? hostname : null
  } catch {
    return null
  }
}

const isSameBrandDomain = (actualHost: string, displayHost: string): boolean => {
  if (!actualHost || !displayHost) return false
  return actualHost === displayHost || actualHost.endsWith(`.${displayHost}`)
}

export function checkLinkMismatch(email: Partial<ParsedEmail> | null | undefined): SignalEvaluation {
  if (!email || !Array.isArray(email.links) || email.links.length === 0) {
    return {
      signal: 'Lien suspect',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  let suspiciousCount = 0

  for (const link of email.links) {
    const actualHost = extractDomain(link?.actualUrl)
    const displayText = (link?.displayText ?? '').trim()
    const displayHost = extractDomain(displayText)

    if (!actualHost) {
      continue
    }

    if (displayHost && !isSameBrandDomain(actualHost, displayHost)) {
      suspiciousCount += 1
      continue
    }

    const normalizedDisplay = normalize(displayText)
    const isBrandText = /paypal|amazon|la poste|impots|société générale|bnp|credit agricole|orange|apple|microsoft|google|netflix/.test(
      normalizedDisplay,
    )

    if (isBrandText) {
      const brandDomain = [
        'paypal.com',
        'amazon.com',
        'laposte.fr',
        'impots.gouv.fr',
        'societegenerale.fr',
        'bnpparibas.fr',
        'credit-agricole.fr',
        'orange.fr',
        'apple.com',
        'microsoft.com',
        'google.com',
        'netflix.com',
      ].find((domain) => normalizedDisplay.includes(domain.replace(/\./g, '')) || normalizedDisplay.includes(domain.replace(/\./g, '').replace(/-/g, '')))

      if (brandDomain && !isSameBrandDomain(actualHost, brandDomain)) {
        suspiciousCount += 1
      }
    }
  }

  if (suspiciousCount === 0) {
    return {
      signal: 'Lien suspect',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const weight = Math.min(suspiciousCount * WEIGHTS.LINK_MISMATCH, WEIGHTS.LINK_MISMATCH_CAP)

  return {
    signal: 'Lien suspect',
    weight,
    triggered: true,
    explanation: 'Un ou plusieurs liens semblent masquer un autre site, ce qui est fréquent dans les tentatives de phishing.',
  }
}
