import { describe, expect, it } from 'vitest'

import { checkLinkMismatch } from './link'

describe('checkLinkMismatch', () => {
  it('ignore les libellés descriptifs associés aux liens de suivi légitimes', () => {
    const result = checkLinkMismatch({
      links: [
        {
          displayText: 'Créer avec Canva',
          actualUrl: 'https://click.engage.canva.com/click/campaign',
        },
        {
          displayText: 'Je donne mon avis sur la démarche CVEC',
          actualUrl: 'https://jedonnemonavis.numerique.gouv.fr/',
        },
      ],
    })

    expect(result.triggered).toBe(false)
    expect(result.weight).toBe(0)
  })

  it('accepte un sous-domaine du domaine affiché', () => {
    const result = checkLinkMismatch({
      links: [{ displayText: 'https://ameli.fr', actualUrl: 'https://www.ameli.fr/compte' }],
    })

    expect(result.triggered).toBe(false)
  })

  it('continue de détecter un domaine qui usurpe un lien PayPal', () => {
    const result = checkLinkMismatch({
      links: [{ displayText: 'https://www.paypal.com', actualUrl: 'https://paypal-support-help.com/verify' }],
    })

    expect(result.triggered).toBe(true)
    expect(result.weight).toBeGreaterThan(0)
  })
})
