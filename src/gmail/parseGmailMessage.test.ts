import { describe, expect, it } from 'vitest'

import type { gmail_v1 } from 'googleapis'

import { parseGmailMessage } from './parseGmailMessage'

function buildMessage(headers: Array<{ name: string; value: string }>, payload: gmail_v1.Schema$MessagePart): gmail_v1.Schema$Message {
  return {
    id: 'msg-1',
    payload: {
      mimeType: payload.mimeType ?? 'text/plain',
      headers,
      body: payload.body,
      parts: payload.parts,
    },
  } as gmail_v1.Schema$Message
}

describe('parseGmailMessage', () => {
  it('parse un mail simple text/plain', () => {
    const encoded = Buffer.from('Bonjour, consultez votre compte sur https://www.paypal.com/secure').toString('base64')
    const message = buildMessage(
      [
        { name: 'From', value: 'PayPal <noreply@paypal.com>' },
        { name: 'Subject', value: 'Votre compte a été vérifié' },
      ],
      { mimeType: 'text/plain', body: { data: encoded } },
    )

    const parsed = parseGmailMessage(message)

    expect(parsed.senderDisplayName).toBe('PayPal')
    expect(parsed.senderEmail).toBe('noreply@paypal.com')
    expect(parsed.subject).toBe('Votre compte a été vérifié')
    expect(parsed.bodyText).toContain('https://www.paypal.com/secure')
    expect(parsed.links).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ actualUrl: expect.stringContaining('paypal.com') }),
      ]),
    )
  })

  it('parse un mail multipart avec HTML et liens', () => {
    const htmlPayload = Buffer.from(
      '<p>Bonjour, cliquez <a href="https://paypal-support.help/verify">ici</a> pour confirmer.</p>',
    ).toString('base64')
    const plainPayload = Buffer.from('Bonjour, cliquez ici pour confirmer.').toString('base64')

    const message = buildMessage(
      [
        { name: 'From', value: 'Alertes Sécurité <security@paypal.com>' },
        { name: 'Authentication-Results', value: 'mx.google.com; spf=pass; dkim=pass; dmarc=pass' },
        { name: 'Subject', value: 'Action requise' },
      ],
      {
        mimeType: 'multipart/alternative',
        parts: [
          { mimeType: 'text/plain', body: { data: plainPayload } },
          { mimeType: 'text/html', body: { data: htmlPayload } },
        ],
      },
    )

    const parsed = parseGmailMessage(message)

    expect(parsed.spfResult).toBe('pass')
    expect(parsed.dkimResult).toBe('pass')
    expect(parsed.dmarcResult).toBe('pass')
    expect(parsed.links.some((link) => link.actualUrl.includes('paypal-support.help'))).toBe(true)
    expect(parsed.bodyText).toContain('confirmer')
  })

  it('décode un nom encodé UTF-8 dans le From', () => {
    const encoded = Buffer.from('Bonjour').toString('base64')
    const message = buildMessage(
      [
        { name: 'From', value: '=?UTF-8?B?QWxpY2UgTWFydGlu?= <alice@company.com>' },
        { name: 'Subject', value: 'Question rapide' },
      ],
      { mimeType: 'text/plain', body: { data: encoded } },
    )

    const parsed = parseGmailMessage(message)

    expect(parsed.senderDisplayName).toBe('Alice Martin')
    expect(parsed.senderEmail).toBe('alice@company.com')
    expect(parsed.bodyText).toBe('Bonjour')
  })
})
