import { isOAuthClientConfigured } from '../config'
import type { AuthState, ExtensionRequest, ExtensionResponse } from '../messaging'
import type { InboxMailPreview, InboxPreviewResult } from '../gmail/types'

const REPORT_STORAGE_KEY = 'confio:last-risk-report'

type RiskReportMail = Pick<
  InboxMailPreview,
  'subject' | 'date' | 'auth' | 'riskScore' | 'riskLevel' | 'triggeredSignals' | 'links'
> & {
  senderDomain: string | null
}

type RiskReport = {
  generatedAt: string
  folder?: 'INBOX' | 'SPAM'
  mails: RiskReportMail[]
}

const statusEl = document.querySelector('#status') as HTMLParagraphElement
const hintEl = document.querySelector('#hint') as HTMLParagraphElement
const listEl = document.querySelector('#mail-list') as HTMLOListElement
const signInBtn = document.querySelector('#sign-in') as HTMLButtonElement
const fetchBtn = document.querySelector('#fetch-mails') as HTMLButtonElement
const fetchSpamBtn = document.querySelector('#fetch-spam-mails') as HTMLButtonElement
const downloadReportBtn = document.querySelector('#download-report') as HTMLButtonElement
const signOutBtn = document.querySelector('#sign-out') as HTMLButtonElement

boot()

function boot(): void {
  if (!isOAuthClientConfigured()) {
    statusEl.textContent =
      'OAuth non configuré : copie ton Client ID dans .env puis relance npm run dev.'
    statusEl.classList.add('error')
    signInBtn.disabled = true
    return
  }

  signInBtn.addEventListener('click', () => {
    void run('Connexion Google…', async () => {
      const result = await sendMessage<InboxPreviewResult>({ type: 'SIGN_IN' })
      applySignedIn(result.accountEmail)
      saveAndRenderReport(result.mails, 'INBOX')
    })
  })

  fetchBtn.addEventListener('click', () => {
    void run('Lecture de l’inbox…', async () => {
      const result = await sendMessage<InboxPreviewResult>({ type: 'FETCH_RECENT_MAILS' })
      applySignedIn(result.accountEmail)
      saveAndRenderReport(result.mails, 'INBOX')
    })
  })

  fetchSpamBtn.addEventListener('click', () => {
    void run('Lecture du dossier Spam…', async () => {
      const result = await sendMessage<InboxPreviewResult>({ type: 'FETCH_RECENT_SPAM_MAILS' })
      applySignedIn(result.accountEmail)
      saveAndRenderReport(result.mails, 'SPAM')
    })
  })

  signOutBtn.addEventListener('click', () => {
    void run('Déconnexion…', async () => {
      await sendMessage<AuthState>({ type: 'SIGN_OUT' })
      applySignedOut()
    })
  })

  downloadReportBtn.addEventListener('click', downloadRiskReport)
  restoreRiskReport()

  void run('Vérification de la session…', async () => {
    const state = await sendMessage<AuthState>({ type: 'GET_AUTH_STATE' })
    if (state.signedIn) {
      applySignedIn(state.email)
      statusEl.textContent = state.email
        ? `Connecté : ${state.email}`
        : 'Connecté. Charge les mails pour vérifier l’API.'
    } else {
      applySignedOut()
    }
  })
}

function applySignedIn(email: string | null): void {
  signInBtn.hidden = true
  fetchBtn.hidden = false
  fetchSpamBtn.hidden = false
  signOutBtn.hidden = false
  statusEl.classList.remove('error')
  statusEl.textContent = email ? `Connecté : ${email}` : 'Connecté à Gmail.'
}

function applySignedOut(): void {
  signInBtn.hidden = false
  fetchBtn.hidden = true
  fetchSpamBtn.hidden = true
  signOutBtn.hidden = true
  listEl.hidden = true
  listEl.replaceChildren()
  statusEl.classList.remove('error')
  statusEl.textContent = 'Non connecté. Le consentement Google s’ouvre au clic.'
}

function saveAndRenderReport(mails: InboxMailPreview[], folder: 'INBOX' | 'SPAM'): void {
  const report: RiskReport = {
    generatedAt: new Date().toISOString(),
    folder,
    mails: mails.map((mail) => ({
      subject: mail.subject,
      date: mail.date,
      senderDomain: mail.from.domain,
      auth: mail.auth,
      riskScore: mail.riskScore,
      riskLevel: mail.riskLevel,
      triggeredSignals: mail.triggeredSignals,
      links: mail.links,
    })),
  }

  localStorage.setItem(REPORT_STORAGE_KEY, JSON.stringify(report))
  renderMails(report.mails)
  downloadReportBtn.hidden = report.mails.length === 0
  const folderLabel = folder === 'SPAM' ? 'Spam' : 'boîte de réception'
  statusEl.textContent = `${report.mails.length} mail(s) analysé(s) dans ${folderLabel}. Rapport conservé dans ce navigateur.`
}

function restoreRiskReport(): void {
  const storedReport = localStorage.getItem(REPORT_STORAGE_KEY)
  if (!storedReport) return

  try {
    const report = JSON.parse(storedReport) as RiskReport
    if (!report || typeof report.generatedAt !== 'string' || !Array.isArray(report.mails)) {
      throw new Error('Le rapport Confio sauvegardé est invalide.')
    }

    renderMails(report.mails)
    downloadReportBtn.hidden = report.mails.length === 0
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    statusEl.textContent = `Impossible de restaurer le rapport : ${text}`
    statusEl.classList.add('error')
  }
}

function downloadRiskReport(): void {
  const storedReport = localStorage.getItem(REPORT_STORAGE_KEY)
  if (!storedReport) {
    statusEl.textContent = 'Aucun rapport sauvegardé à télécharger.'
    statusEl.classList.add('error')
    return
  }

  const blob = new Blob([storedReport], { type: 'application/json' })
  const downloadUrl = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = downloadUrl
  anchor.download = `confio-rapport-${new Date().toISOString().replace(/[:.]/g, '-')}.json`
  document.body.append(anchor)
  anchor.click()
  anchor.remove()
  window.setTimeout(() => URL.revokeObjectURL(downloadUrl), 1000)
}

function renderMails(mails: RiskReportMail[]): void {
  listEl.hidden = mails.length === 0
  listEl.replaceChildren()

  console.group(`[Confio popup] ${mails.length} mail(s)`)
  console.table(
    mails.map((mail) => ({
      subject: mail.subject,
      domain: mail.senderDomain,
      spf: mail.auth.spf,
      dkim: mail.auth.dkim,
      dmarc: mail.auth.dmarc,
      riskScore: mail.riskScore,
      riskLevel: mail.riskLevel,
      signals: mail.triggeredSignals.map(({ signal }) => signal).join(', '),
    })),
  )
  console.log('Rapport résumé', mails)
  console.groupEnd()

  for (const mail of mails) {
    const item = document.createElement('li')
    item.innerHTML = `
      <div class="subject"></div>
      <div class="meta"></div>
      <div class="auth"></div>
      <div class="risk"></div>
      <div class="signals"></div>
    `
    item.querySelector('.subject')!.textContent = mail.subject || '(sans objet)'
    item.querySelector('.meta')!.textContent =
      `${mail.senderDomain ?? 'domaine inconnu'}${mail.date ? ` · ${mail.date}` : ''}`
    item.querySelector('.auth')!.textContent =
      `SPF ${mail.auth.spf} · DKIM ${mail.auth.dkim} · DMARC ${mail.auth.dmarc}`

    const riskEl = item.querySelector('.risk') as HTMLDivElement
    riskEl.textContent = `Niveau : ${mail.riskLevel}`
    const colors: Record<string, string> = {
      safe: '#22c55e',
      caution: '#f59e0b',
      suspicious: '#ef4444',
    }
    riskEl.style.color = colors[mail.riskLevel] ?? '#94a3b8'
    riskEl.style.fontWeight = '600'

    riskEl.textContent += ` · Score ${mail.riskScore}`
    const signalsEl = item.querySelector('.signals') as HTMLDivElement
    signalsEl.textContent = mail.triggeredSignals.length
      ? `Signaux : ${mail.triggeredSignals.map(({ signal }) => signal).join(', ')}`
      : 'Signaux : aucun'

    listEl.append(item)
  }

  hintEl.textContent =
    'Les résultats restent disponibles après fermeture du popup. Télécharge le rapport JSON pour l’ouvrir dans VS Code ; il ne contient ni le corps des mails ni les en-têtes complets.'
}

async function run(pendingLabel: string, task: () => Promise<void>): Promise<void> {
  const buttons = [signInBtn, fetchBtn, fetchSpamBtn, signOutBtn]
  buttons.forEach((button) => {
    button.disabled = true
  })
  statusEl.classList.remove('error')
  statusEl.textContent = pendingLabel

  try {
    await task()
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error)
    statusEl.textContent = text
    statusEl.classList.add('error')
  } finally {
    buttons.forEach((button) => {
      button.disabled = false
    })
  }
}

async function sendMessage<T>(request: ExtensionRequest): Promise<T> {
  const response = (await chrome.runtime.sendMessage(request)) as ExtensionResponse<T>
  if (!response?.ok) {
    throw new Error(response?.error || 'Pas de réponse du service worker.')
  }
  return response.data
}
