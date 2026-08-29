import type { ParsedEmail } from '../types'
import { WEIGHTS } from '../types'

export type SignalEvaluation = {
  signal: string
  weight: number
  triggered: boolean
  explanation: string
}

const normalizeAuthResult = (value?: string | null): string => (value ?? '').trim().toLowerCase()

export function checkAuthFailure(email: Partial<ParsedEmail> | null | undefined): SignalEvaluation {
  if (!email) {
    return {
      signal: 'Échec d\'authentification',
      weight: 0,
      triggered: false,
      explanation: '',
    }
  }

  const spfResult = normalizeAuthResult(email.spfResult)
  const dkimResult = normalizeAuthResult(email.dkimResult)

  const strongFail = spfResult === 'fail' || dkimResult === 'fail'
  const bothMissing = spfResult === 'none' && dkimResult === 'none'

  if (strongFail) {
    return {
      signal: 'Échec d\'authentification',
      weight: WEIGHTS.AUTH_FAIL,
      triggered: true,
      explanation: 'L\'expéditeur n\'a pas réussi les vérifications d\'authentification, ce qui est un signe de tentative de fraude.',
    }
  }

  if (bothMissing) {
    return {
      signal: 'Authentification non vérifiée',
      weight: WEIGHTS.AUTH_NONE,
      triggered: true,
      explanation: 'Le message n\'a pas de preuve claire d\'authentification, donc il faut rester prudent.',
    }
  }

  return {
    signal: 'Échec d\'authentification',
    weight: 0,
    triggered: false,
    explanation: '',
  }
}
