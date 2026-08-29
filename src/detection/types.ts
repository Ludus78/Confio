export type SpfDkimResult = 'pass' | 'fail' | 'neutral' | 'none'
export type DmarcResult = 'pass' | 'fail' | 'none'

export type ParsedLink = {
  displayText: string
  actualUrl: string
}

/**
 * Données minimales pour scorer un mail.
 * `recipientEmail` sert uniquement à détecter un mail interne (même organisation).
 * Tous les champs sont défensifs côté scorer (vide / undefined = absence de donnée).
 */
export type ParsedEmail = {
  senderDisplayName: string
  senderEmail: string
  spfResult: SpfDkimResult
  dkimResult: SpfDkimResult
  dmarcResult: DmarcResult
  links: ParsedLink[]
  bodyText: string
  subject: string
  recipientEmail?: string
}

export type TriggeredSignal = {
  signal: string
  weight: number
  explanation: string
}

export type RiskLevel = 'safe' | 'caution' | 'suspicious'

export type RiskResult = {
  score: number
  level: RiskLevel
  triggeredSignals: TriggeredSignal[]
}

export const WEIGHTS = {
  AUTH_FAIL: 35,
  AUTH_NONE: 10,
  SENDER_MISMATCH: 30,
  LINK_MISMATCH: 20,
  LINK_MISMATCH_CAP: 40,
  URGENCY: 5,
  URGENCY_CAP: 15,
} as const

export const SCORE_CAP = 100
export const CAUTION_THRESHOLD = 25
export const SUSPICIOUS_THRESHOLD = 55
/** Plafond si mail interne sans signal d’usurpation / lien trompeur / échec d’auth. */
export const INTERNAL_SAFE_CAP = 12
