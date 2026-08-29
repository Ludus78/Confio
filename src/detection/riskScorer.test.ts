import { describe, expect, it } from 'vitest'

import { calculateRiskScore } from './riskScorer'
import type { ParsedEmail } from './types'

const buildEmail = (overrides: Partial<ParsedEmail> = {}): ParsedEmail => ({
  senderDisplayName: 'Example',
  senderEmail: 'example@example.com',
  spfResult: 'pass',
  dkimResult: 'pass',
  dmarcResult: 'pass',
  links: [],
  bodyText: 'Bonjour, ceci est un message standard.',
  subject: 'Sujet standard',
  recipientEmail: 'alice@company.com',
  ...overrides,
})

describe('calculateRiskScore', () => {
  it('renvoie un score bas pour un mail clairement légitime', () => {
    const email = buildEmail({
      senderDisplayName: 'Société Générale',
      senderEmail: 'notifications@societegenerale.fr',
      recipientEmail: 'alice@autre-entreprise.com',
      links: [{ displayText: 'https://www.societegenerale.fr', actualUrl: 'https://www.societegenerale.fr/accueil' }],
      bodyText: 'Bonjour, votre relevé est disponible dans votre espace sécurisé.',
      subject: 'Votre relevé bancaire',
    })

    const result = calculateRiskScore(email)

    expect(result.score).toBeLessThanOrEqual(24)
    expect(result.level).toBe('safe')
  })

  it('évalue un mail avec échec SPF/DKIM comme élevé', () => {
    const email = buildEmail({
      senderDisplayName: 'PayPal',
      senderEmail: 'security-paypal@secure-paypal-alert.com',
      spfResult: 'fail',
      dkimResult: 'fail',
      dmarcResult: 'fail',
      bodyText: 'Votre compte PayPal a été suspendu. Vérifiez immédiatement votre identité.',
      subject: 'Compte suspendu - action requise sous 24h',
      links: [{ displayText: 'https://www.paypal.com', actualUrl: 'https://www.paypal.com/verify' }],
    })

    const result = calculateRiskScore(email)

    expect(result.score).toBeGreaterThanOrEqual(55)
    expect(result.level).toBe('suspicious')
    expect(result.triggeredSignals.some((signal) => signal.signal.includes('authentification'))).toBe(true)
  })

  it('détecte un mismatch de marque PayPal usurpé', () => {
    const email = buildEmail({
      senderDisplayName: 'PayPal',
      senderEmail: 'alert@paypal-support-help.com',
      spfResult: 'none',
      dkimResult: 'none',
      dmarcResult: 'none',
      bodyText: 'Votre compte PayPal doit être vérifié. Confirmez votre identité maintenant.',
      subject: 'Notification de sécurité PayPal',
      links: [{ displayText: 'https://www.paypal.com', actualUrl: 'https://paypal-support-help.com/verify' }],
    })

    const result = calculateRiskScore(email)

    expect(result.score).toBeGreaterThanOrEqual(25)
    expect(result.triggeredSignals.some((signal) => signal.signal === 'Mismatch de marque')).toBe(true)
  })

  it('détecte un lien trompeur', () => {
    const email = buildEmail({
      senderDisplayName: 'Amazon',
      senderEmail: 'noreply@amazon.com',
      spfResult: 'pass',
      dkimResult: 'pass',
      dmarcResult: 'pass',
      links: [{ displayText: 'https://www.amazon.com', actualUrl: 'https://amzn-secure-login.site/verify' }],
      bodyText: 'Votre commande est en attente. Vérifiez immédiatement votre accès pour éviter la suspension.',
      subject: 'Amazon : vérification nécessaire',
    })

    const result = calculateRiskScore(email)

    expect(result.score).toBeGreaterThanOrEqual(25)
    expect(result.level).toBe('caution')
    expect(result.triggeredSignals.some((signal) => signal.signal === 'Lien suspect')).toBe(true)
  })

  it('reste neutre pour un mail sans signal particulier', () => {
    const email = buildEmail({
      senderDisplayName: 'Jean Martin',
      senderEmail: 'jean.martin@company.com',
      recipientEmail: 'alice@company.com',
      spfResult: 'none',
      dkimResult: 'none',
      dmarcResult: 'none',
      bodyText: 'Bonjour, merci pour votre message. Je vous répondrai demain.',
      subject: 'Question sur le projet',
      links: [],
    })

    const result = calculateRiskScore(email)

    expect(result.score).toBeLessThanOrEqual(12)
    expect(result.level).toBe('safe')
  })
})
