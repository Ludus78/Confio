import type { ParsedEmail, RiskResult } from './types'
import { CAUTION_THRESHOLD, INTERNAL_SAFE_CAP, SCORE_CAP, SUSPICIOUS_THRESHOLD, WEIGHTS } from './types'
import { checkAuthFailure } from './signals/auth'
import { checkSenderMismatch } from './signals/sender'
import { checkLinkMismatch } from './signals/link'
import { checkUrgencyKeywords } from './signals/urgency'

const isInternalMail = (email: Partial<ParsedEmail> | null | undefined): boolean => {
  const senderEmail = (email?.senderEmail ?? '').trim().toLowerCase()
  const recipientEmail = (email?.recipientEmail ?? '').trim().toLowerCase()

  if (!senderEmail || !recipientEmail) return false

  const senderDomain = senderEmail.split('@')[1]?.trim()
  const recipientDomain = recipientEmail.split('@')[1]?.trim()

  return !!senderDomain && !!recipientDomain && senderDomain === recipientDomain
}

const getLevelFromScore = (score: number): RiskResult['level'] => {
  if (score <= 24) return 'safe'
  if (score <= 54) return 'caution'
  return 'suspicious'
}

export function calculateRiskScore(email: ParsedEmail): RiskResult {
  const safeEmail = email ?? {}

  const checks = [
    checkAuthFailure(safeEmail),
    checkSenderMismatch(safeEmail),
    checkLinkMismatch(safeEmail),
    checkUrgencyKeywords(safeEmail),
  ]

  const triggeredSignals = checks
    .filter((check) => check.triggered)
    .map(({ signal, weight, explanation }) => ({ signal, weight, explanation }))

  const totalScore = checks.reduce((sum, check) => sum + check.weight, 0)
  let score = Math.min(totalScore, SCORE_CAP)

  if (isInternalMail(safeEmail)) {
    score = Math.min(score, INTERNAL_SAFE_CAP)
  }

  return {
    score,
    level: getLevelFromScore(score),
    triggeredSignals,
  }
}
