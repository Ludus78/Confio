import { isOAuthClientConfigured } from '../config'
import type { AuthState, ExtensionRequest, ExtensionResponse } from '../messaging'
import type { InboxMailPreview, InboxPreviewResult } from '../gmail/types'

const statusEl = document.querySelector('#status') as HTMLParagraphElement
const hintEl = document.querySelector('#hint') as HTMLParagraphElement
const listEl = document.querySelector('#mail-list') as HTMLOListElement
const signInBtn = document.querySelector('#sign-in') as HTMLButtonElement
const fetchBtn = document.querySelector('#fetch-mails') as HTMLButtonElement
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
      renderMails(result.mails)
    })
  })

  fetchBtn.addEventListener('click', () => {
    void run('Lecture de l’inbox…', async () => {
      const result = await sendMessage<InboxPreviewResult>({ type: 'FETCH_RECENT_MAILS' })
      applySignedIn(result.accountEmail)
      renderMails(result.mails)
    })
  })

  signOutBtn.addEventListener('click', () => {
    void run('Déconnexion…', async () => {
      await sendMessage<AuthState>({ type: 'SIGN_OUT' })
      applySignedOut()
    })
  })

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
  signOutBtn.hidden = false
  statusEl.classList.remove('error')
  statusEl.textContent = email ? `Connecté : ${email}` : 'Connecté à Gmail.'
}

function applySignedOut(): void {
  signInBtn.hidden = false
  fetchBtn.hidden = true
  signOutBtn.hidden = true
  listEl.hidden = true
  listEl.replaceChildren()
  statusEl.classList.remove('error')
  statusEl.textContent = 'Non connecté. Le consentement Google s’ouvre au clic.'
}

function renderMails(mails: InboxMailPreview[]): void {
  listEl.hidden = mails.length === 0
  listEl.replaceChildren()

  console.group(`[Confio popup] ${mails.length} mail(s)`)
  console.table(
    mails.map((mail) => ({
      subject: mail.subject,
      from: mail.from.emailAddress,
      domain: mail.from.domain,
      spf: mail.auth.spf,
      dkim: mail.auth.dkim,
      dmarc: mail.auth.dmarc,
      riskScore: mail.riskScore,
      riskLevel: mail.riskLevel,
    })),
  )
  console.log(mails)
  console.groupEnd()

  for (const mail of mails) {
    const item = document.createElement('li')
    item.innerHTML = `
      <div class="subject"></div>
      <div class="meta"></div>
      <div class="auth"></div>
      <div class="risk"></div>
    `
    item.querySelector('.subject')!.textContent = mail.subject || '(sans objet)'
    item.querySelector('.meta')!.textContent =
      `${mail.from.emailAddress ?? 'expéditeur inconnu'} · ${mail.from.domain ?? '—'} `
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

    const riskValue = `Score ${mail.riskScore}`
    riskEl.title = riskValue

    listEl.append(item)
  }

  hintEl.textContent =
    'Aperçu ci-dessous. Le détail des en-têtes est dans la console (popup F12, et service worker).'
}

async function run(pendingLabel: string, task: () => Promise<void>): Promise<void> {
  const buttons = [signInBtn, fetchBtn, signOutBtn]
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
