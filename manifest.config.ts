import { defineManifest } from '@crxjs/vite-plugin'
import { loadEnv } from 'vite'
import { EXTENSION_PUBLIC_KEY } from './src/extension-identity.ts'

const PLACEHOLDER_CLIENT_ID = 'YOUR_CLIENT_ID.apps.googleusercontent.com'

export default defineManifest((env) => {
  // loadEnv lit `.env` / `.env.[mode]` — le client_id doit être dans le
  // manifest compilé, chrome.identity ne lit pas import.meta.env.
  const viteEnv = loadEnv(env.mode, process.cwd(), '')
  const oauthClientId =
    viteEnv.VITE_GOOGLE_OAUTH_CLIENT_ID?.trim() || PLACEHOLDER_CLIENT_ID

  return {
    manifest_version: 3,
    name: env.mode === 'development' ? 'Confio (dev)' : 'Confio',
    description:
      'Détecte les e-mails suspects dans Gmail et explique pourquoi, en langage simple.',
    version: '0.1.0',
    minimum_chrome_version: '116',

    // Figé l'ID (gogajdnjlmcocjhdplegfnegbioankim) pour l'OAuth Google.
    key: EXTENSION_PUBLIC_KEY,

    icons: {
      16: 'public/icons/icon16.png',
      48: 'public/icons/icon48.png',
      128: 'public/icons/icon128.png',
    },

    action: {
      default_title: 'Confio',
      default_popup: 'src/popup/index.html',
      default_icon: {
        16: 'public/icons/icon16.png',
        48: 'public/icons/icon48.png',
        128: 'public/icons/icon128.png',
      },
    },

    background: {
      service_worker: 'src/background/index.ts',
      type: 'module',
    },

    // identity = chrome.identity.getAuthToken (flux Google intégré à Chrome).
    permissions: ['identity'],

    // Appels REST depuis le service worker (MV3 n'autorise pas ça via "permissions").
    host_permissions: [
      'https://gmail.googleapis.com/*',
      'https://www.googleapis.com/*',
      'https://oauth2.googleapis.com/*',
    ],

    oauth2: {
      client_id: oauthClientId,
      scopes: ['https://www.googleapis.com/auth/gmail.readonly'],
    },
  }
})
