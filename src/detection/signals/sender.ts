import type { ParsedEmail } from '../types'
import { WEIGHTS } from '../types'

export type SignalEvaluation = {
  signal: string
  weight: number
  triggered: boolean
  explanation: string
}

type BrandProfile = {
  name: string
  officialDomains: string[]
}

const KNOWN_BRANDS: BrandProfile[] = [
  { name: 'PayPal', officialDomains: ['paypal.com'] },
  { name: 'Amazon', officialDomains: ['amazon.com', 'amazon.fr'] },
  { name: 'La Poste', officialDomains: ['laposte.fr', 'labanquepostale.fr'] },
  { name: 'Impôts', officialDomains: ['impots.gouv.fr'] },
  { name: 'Impots', officialDomains: ['impots.gouv.fr'] },
  { name: 'Société Générale', officialDomains: ['societegenerale.fr', 'societegenerale.com'] },
  { name: 'SociétéGenerale', officialDomains: ['societegenerale.fr', 'societegenerale.com'] },
  { name: 'Société generale', officialDomains: ['societegenerale.fr', 'societegenerale.com'] },
  { name: 'BNP Paribas', officialDomains: ['bnpparibas.com', 'bnpparibas.fr'] },
  { name: 'Crédit Agricole', officialDomains: ['credit-agricole.fr', 'creditagricole.fr'] },
  { name: 'Orange', officialDomains: ['orange.fr', 'orange.com'] },
  { name: 'Apple', officialDomains: ['apple.com'] },
  { name: 'Microsoft', officialDomains: ['microsoft.com'] },
  { name: 'Google', officialDomains: ['google.com', 'google.fr'] },
  { name: 'Netflix', officialDomains: ['netflix.com'] },
]

const normalize = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const extractDomain = (value?: string | null): string | null => {
  const input = (value ?? '').trim()
  if (!input) return null

  try {
    const candidate = /^https?:\/\//i.test(input) ? input : `https://${input}`
    const url = new URL(candidate)
    return url.hostname.toLowerCase()
  } catch {
    const match = input.match(/(?:[a-z0-9-]+\.)+[a-z]{2,}/i)
    return match ? match[0].toLowerCase() : null
  }
}

const findKnownBrand = (displayName: string): BrandProfile | null => {
  const normalizedDisplayName = normalize(displayName)

  const brand = KNOWN_BRANDS.find(({ name }) => normalizedDisplayName.includes(normalize(name)))
  return brand ?? null
}

export function checkSenderMismatch(email: Partial<ParsedEmail> | null | undefined): SignalEvaluation {
  if (!email) {
    return {
      signal: 'Mismatch de marque',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const senderDisplayName = (email.senderDisplayName ?? '').trim()
  const senderEmail = (email.senderEmail ?? '').trim()

  if (!senderDisplayName || !senderEmail) {
    return {
      signal: 'Mismatch de marque',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const brand = findKnownBrand(senderDisplayName)
  if (!brand) {
    return {
      signal: 'Mismatch de marque',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const senderDomain = extractDomain(senderEmail)
  if (!senderDomain) {
    return {
      signal: 'Mismatch de marque',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const isOfficialDomain = brand.officialDomains.some((officialDomain) => {
    const domain = officialDomain.toLowerCase()
    return senderDomain === domain || senderDomain.endsWith(`.${domain}`)
  })

  if (isOfficialDomain) {
    return {
      signal: 'Mismatch de marque',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  return {
    signal: 'Mismatch de marque',
    weight: WEIGHTS.SENDER_MISMATCH,
    triggered: true,
    explanation: `L'expéditeur prétend être ${brand.name} mais l'adresse réelle vient d'un autre domaine que celui de la marque.`,
  }
}
