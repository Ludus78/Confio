import type { gmail_v1 } from 'googleapis'

import type { ParsedEmail } from '../detection/types'
import type { GmailHeader } from './types'
import { decodeMimeHeader, getHeader } from './headers'

export function parseGmailMessage(rawMessage: gmail_v1.Schema$Message): ParsedEmail {
  const payload = rawMessage?.payload
  const headers: GmailHeader[] = (payload?.headers ?? []).map((header) => ({
    name: header.name ?? '',
    value: header.value ?? '',
  }))

  const fromHeader = getHeader(headers, 'From') ?? getHeader(headers, 'Sender') ?? ''
  const sender = parseSender(fromHeader)

  const authSource = `${getHeader(headers, 'Authentication-Results') ?? ''} ${getHeader(headers, 'Received-SPF') ?? ''}`.trim()
  const spfResult = parseSpfDkimResult(authSource, 'spf')
  const dkimResult = parseSpfDkimResult(authSource, 'dkim')
  const dmarcResult = parseDmarcResult(authSource)

  const subject = getHeader(headers, 'Subject') ?? ''
  const bodyText = extractTextBody(payload)
  const links = extractLinks(payload, bodyText)
  const recipientEmail = extractFirstEmail(getHeader(headers, 'Delivered-To') ?? getHeader(headers, 'To') ?? '')

  return {
    senderDisplayName: sender.displayName || sender.email || 'Expéditeur inconnu',
    senderEmail: sender.email || '',
    spfResult,
    dkimResult,
    dmarcResult,
    links,
    bodyText,
    subject,
    recipientEmail: recipientEmail || undefined,
  }
}

function parseSender(fromHeader: string): { displayName: string; email: string } {
  if (!fromHeader) {
    return { displayName: '', email: '' }
  }

  try {
    const decodedHeader = decodeMimeHeader(fromHeader)
    const angleMatch = decodedHeader.match(/^(.*?)(?:\s*<([^>]+)>)$/)

    if (angleMatch) {
      const displayName = decodeMimeHeader((angleMatch[1] ?? '').replace(/^["']|["']$/g, '').trim())
      const email = extractFirstEmail(angleMatch[2] ?? '')
      return {
        displayName: displayName || '',
        email,
      }
    }

    const fallbackEmail = extractFirstEmail(decodedHeader)
    return {
      displayName: fallbackEmail ? '' : decodeMimeHeader(decodedHeader).trim(),
      email: fallbackEmail,
    }
  } catch {
    const fallbackEmail = extractFirstEmail(fromHeader)
    return {
      displayName: fallbackEmail ? '' : fromHeader.trim(),
      email: fallbackEmail,
    }
  }
}

function parseSpfDkimResult(source: string, mechanism: 'spf' | 'dkim'): 'pass' | 'fail' | 'neutral' | 'none' {
  const haystack = (source ?? '').toLowerCase()
  const pattern = new RegExp(`\\b${mechanism}\\s*(?:=|:)\\s*([a-z]+)`, 'gi')
  const matches = Array.from(haystack.matchAll(pattern)).map((match) => match[1]?.toLowerCase())

  for (const value of matches) {
    if (!value) continue
    if (value === 'pass') return 'pass'
    if (value === 'fail' || value === 'softfail' || value === 'temperror' || value === 'permerror') return 'fail'
    if (value === 'neutral') return 'neutral'
    if (value === 'none') return 'none'
  }

  return 'none'
}

function parseDmarcResult(source: string): 'pass' | 'fail' | 'none' {
  const haystack = (source ?? '').toLowerCase()
  const pattern = new RegExp(`\\bdmarc\\s*(?:=|:)\\s*([a-z]+)`, 'gi')
  const matches = Array.from(haystack.matchAll(pattern)).map((match) => match[1]?.toLowerCase())

  for (const value of matches) {
    if (!value) continue
    if (value === 'pass') return 'pass'
    if (value === 'fail' || value === 'softfail' || value === 'temperror' || value === 'permerror') return 'fail'
    if (value === 'none') return 'none'
  }

  return 'none'
}

function extractTextBody(payload: gmail_v1.Schema$MessagePart | undefined): string {
  if (!payload) return ''

  const collection: string[] = []
  const seen = new Set<string>()

  function walk(part: gmail_v1.Schema$MessagePart | undefined): void {
    if (!part) return

    const mimeType = part.mimeType ?? ''
    const bodyData = part.body?.data

    if (bodyData && (mimeType === 'text/plain' || mimeType === 'text/html')) {
      const decoded = decodeBase64Url(bodyData)
      const normalized = mimeType === 'text/html' ? stripHtml(decoded) : decoded
      const text = normalizeWhitespace(normalized)
      if (text && !seen.has(text)) {
        collection.push(text)
        seen.add(text)
      }
    }

    for (const child of part.parts ?? []) {
      walk(child)
    }
  }

  walk(payload)

  const plainText = collection.find((part) => part && part.length > 0) ?? ''
  return plainText
}

function extractLinks(payload: gmail_v1.Schema$MessagePart | undefined, bodyText: string): Array<{ displayText: string; actualUrl: string }> {
  const links = new Map<string, { displayText: string; actualUrl: string }>()
  const htmlCandidates = collectHtmlLinks(payload)

  for (const link of htmlCandidates) {
    const actualUrl = normalizeUrl(link.actualUrl)
    if (!actualUrl) continue
    links.set(actualUrl, { displayText: link.displayText || actualUrl, actualUrl })
  }

  for (const url of extractUrlCandidates(bodyText)) {
    const actualUrl = normalizeUrl(url)
    if (!actualUrl) continue
    if (!links.has(actualUrl)) {
      links.set(actualUrl, { displayText: actualUrl, actualUrl })
    }
  }

  return [...links.values()]
}

function collectHtmlLinks(payload: gmail_v1.Schema$MessagePart | undefined): Array<{ displayText: string; actualUrl: string }> {
  const extracted: Array<{ displayText: string; actualUrl: string }> = []

  function walk(part: gmail_v1.Schema$MessagePart | undefined): void {
    if (!part) return

    const bodyData = part.body?.data
    if (bodyData && (part.mimeType ?? '').includes('text/html')) {
      const html = decodeBase64Url(bodyData)
      const regex = /<a\b[^>]*href\s*=\s*(?:"([^"]+)"|'([^']+)'|([^\s>]+))[^>]*>([\s\S]*?)<\/a>/gi
      for (const match of html.matchAll(regex)) {
        const actualUrl = normalizeUrl((match[1] ?? match[2] ?? match[3] ?? '').trim())
        const displayText = normalizeWhitespace(stripHtml(match[4] ?? ''))
        if (actualUrl) {
          extracted.push({
            displayText: displayText || actualUrl,
            actualUrl,
          })
        }
      }
    }

    for (const child of part.parts ?? []) {
      walk(child)
    }
  }

  walk(payload)
  return extracted
}

function extractUrlCandidates(rawText: string): string[] {
  const text = rawText || ''
  const matches = text.match(/https?:\/\/[^\s<>'")]+|www\.[^\s<>'")]+/gi) ?? []
  return matches.map((match) => match.replace(/[),.;]+$/, '')).filter(Boolean)
}

function normalizeUrl(value: string): string {
  const trimmed = (value ?? '').trim()
  if (!trimmed) return ''
  const cleaned = trimmed.replace(/^mailto:/i, '').replace(/[),.;]+$/, '')
  try {
    const url = /^https?:\/\//i.test(cleaned) ? cleaned : `https://${cleaned}`
    return new URL(url).toString()
  } catch {
    return cleaned.startsWith('http') ? cleaned : ''
  }
}

function extractFirstEmail(value: string): string {
  if (!value) return ''
  const match = value.match(/[A-Z0-9._%+\-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i)
  return match ? match[0].trim() : ''
}

function decodeBase64Url(data: string): string {
  const cleaned = (data ?? '').replace(/\s+/g, '')
  if (!cleaned) return ''

  const normalized = cleaned.replace(/-/g, '+').replace(/_/g, '/')
  const padded = normalized + '='.repeat((4 - (normalized.length % 4)) % 4)

  try {
    if (typeof Buffer !== 'undefined') {
      return Buffer.from(padded, 'base64').toString('utf8')
    }

    const binary = atob(padded)
    return decodeURIComponent(escape(binary))
  } catch {
    return ''
  }
}

function stripHtml(html: string): string {
  const withoutScripts = html.replace(/<script[\s\S]*?<\/script>/gi, ' ')
  const withoutStyles = withoutScripts.replace(/<style[\s\S]*?<\/style>/gi, ' ')
  const withLineBreaks = withoutStyles
    .replace(/<br\s*\/?>/gi, '\n')
    .replace(/<\/p>|<\/div>|<\/li>|<\/tr>|<\/h[1-6]>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')

  return decodeHtmlEntities(withLineBreaks)
}

function decodeHtmlEntities(value: string): string {
  return value
    .replace(/&nbsp;/gi, ' ')
    .replace(/&amp;/gi, '&')
    .replace(/&lt;/gi, '<')
    .replace(/&gt;/gi, '>')
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&#x27;/gi, "'")
    .replace(/&#x2F;/gi, '/')
    .replace(/&#([0-9]{1,3});/g, (_, code) => String.fromCharCode(Number(code)))
}

function normalizeWhitespace(value: string): string {
  return value.replace(/\s+/g, ' ').trim()
}

