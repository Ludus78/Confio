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
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')

const URGENCY_PATTERNS = [
  'compte suspendu',
  'verifiez immediatement',
  'vérifiez immédiatement',
  'dernier delai',
  'derniere chance',
  'action requise sous 24h',
  'confirmez votre identite',
  'confirmes votre identite',
  'compte bloque',
  'acces bloque',
  'urgence',
  'immédiatement',
  'immediatement',
]

export function checkUrgencyKeywords(email: Partial<ParsedEmail> | null | undefined): SignalEvaluation {
  if (!email) {
    return {
      signal: 'Urgence de phishing',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const haystack = normalize(`${email.subject ?? ''} ${email.bodyText ?? ''}`)
  let matchCount = 0

  for (const pattern of URGENCY_PATTERNS) {
    const normalizedPattern = normalize(pattern)
    if (haystack.includes(normalizedPattern)) {
      matchCount += 1
    }
  }

  if (matchCount === 0) {
    return {
      signal: 'Urgence de phishing',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const weight = Math.min(matchCount * WEIGHTS.URGENCY, WEIGHTS.URGENCY_CAP)

  return {
    signal: 'Urgence de phishing',
    weight,
    triggered: true,
    explanation: 'Le message insiste sur une urgence ou un délai très court pour pousser à agir sans réfléchir.',
  }
}
