import { describe, expect, it } from 'vitest'

import { calculateRiskScore } from './riskScorer'
import type { ParsedEmail, RiskLevel } from './types'

type Scenario = {
  name: string
  email: Partial<ParsedEmail>
  expectedLevel: RiskLevel
  expectedSignals: string[]
}

const buildEmail = (overrides: Partial<ParsedEmail> = {}): ParsedEmail => ({
  senderDisplayName: 'Service de documents',
  senderEmail: 'notifications@documents.example',
  spfResult: 'pass',
  dkimResult: 'pass',
  dmarcResult: 'pass',
  links: [],
  bodyText: 'Bonjour, voici les informations demandées.',
  subject: 'Votre document est disponible',
  recipientEmail: 'alice@company.example',
  ...overrides,
})

const scenarios: Scenario[] = [
  {
    name: 'usurpation PayPal avec un lien de connexion contrefait',
    email: {
      senderDisplayName: 'PayPal',
      senderEmail: 'alerte@paypal-support-help.example',
      links: [{ displayText: 'https://www.paypal.com', actualUrl: 'https://paypal-support-help.example/login' }],
    },
    expectedLevel: 'caution',
    expectedSignals: ['Mismatch de marque', 'Lien suspect'],
  },
  {
    name: 'usurpation combinant échec SPF, lien trompeur et urgence',
    email: {
      senderDisplayName: 'Amazon',
      senderEmail: 'security@amazon-account-check.example',
      spfResult: 'fail',
      dkimResult: 'fail',
      dmarcResult: 'fail',
      subject: 'Compte suspendu — action requise sous 24h',
      bodyText: 'Vérifiez immédiatement votre identité.',
      links: [{ displayText: 'https://www.amazon.com', actualUrl: 'https://amazon-account-check.example/verify' }],
    },
    expectedLevel: 'suspicious',
    expectedSignals: [
      "Échec d'authentification",
      'Mismatch de marque',
      'Lien suspect',
      'Urgence de phishing',
    ],
  },
  {
    name: 'échec SPF/DKIM avec un message urgent',
    email: {
      spfResult: 'fail',
      dkimResult: 'fail',
      dmarcResult: 'fail',
      subject: 'Votre compte est suspendu',
      bodyText: 'Vérifiez immédiatement votre identité pour éviter le blocage.',
    },
    expectedLevel: 'caution',
    expectedSignals: ["Échec d'authentification", 'Urgence de phishing'],
  },
  {
    name: 'lien PayPal contrefait comme seul signal',
    email: {
      links: [{ displayText: 'https://www.paypal.com', actualUrl: 'https://login-secure.example/verify' }],
    },
    expectedLevel: 'safe',
    expectedSignals: ['Lien suspect'],
  },
  {
    name: 'hameçonnage générique avec texte de lien neutre',
    email: {
      links: [{ displayText: 'Consulter le document', actualUrl: 'https://document-login.example/verify' }],
    },
    expectedLevel: 'safe',
    expectedSignals: [],
  },
  {
    name: 'courriel marketing Canva avec un lien de suivi',
    email: {
      senderDisplayName: 'Canva',
      senderEmail: 'news@engage.canva.com',
      links: [{ displayText: 'Créer avec Canva', actualUrl: 'https://click.engage.canva.com/campaign' }],
    },
    expectedLevel: 'safe',
    expectedSignals: [],
  },
  {
    name: 'lien légitime vers un sous-domaine officiel',
    email: {
      senderDisplayName: 'PayPal',
      senderEmail: 'notifications@paypal.com',
      links: [{ displayText: 'https://paypal.com', actualUrl: 'https://www.paypal.com/account' }],
    },
    expectedLevel: 'safe',
    expectedSignals: [],
  },
]

describe('batterie de scénarios synthétiques de phishing', () => {
  it.each(scenarios)('$name', ({ email, expectedLevel, expectedSignals }) => {
    const result = calculateRiskScore(buildEmail(email))

    expect(result.level).toBe(expectedLevel)
    expect(result.triggeredSignals.map(({ signal }) => signal)).toEqual(expectedSignals)
  })
})
