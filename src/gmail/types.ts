/** En-tête MIME tel que renvoyé par l'API Gmail. */
export type GmailHeader = {
  name: string
  value: string
}

export type AuthProtocolResult = 'pass' | 'fail' | 'softfail' | 'neutral' | 'none' | 'temperror' | 'permerror' | 'unknown'

export type MailAuthSignals = {
  spf: AuthProtocolResult
  dkim: AuthProtocolResult
  dmarc: AuthProtocolResult
  authenticationResults: string | null
  receivedSpf: string | null
}

export type ParsedFrom = {
  raw: string | null
  displayName: string | null
  emailAddress: string | null
  domain: string | null
}

export type TriggeredSignalSummary = {
  signal: string
  explanation: string
}

export type LinkDomainSummary = {
  displayHost: string | null
  actualHost: string | null
}

export type RiskLevel = 'safe' | 'caution' | 'suspicious'

export type InboxMailPreview = {
  id: string
  threadId: string
  snippet: string
  subject: string | null
  date: string | null
  from: ParsedFrom
  auth: MailAuthSignals
  riskScore: number
  riskLevel: RiskLevel
  triggeredSignals: TriggeredSignalSummary[]
  links: LinkDomainSummary[]
  /** Tous les en-têtes, pour inspecter en console. */
  headers: GmailHeader[]
}

export type InboxPreviewResult = {
  accountEmail: string | null
  mails: InboxMailPreview[]
}
