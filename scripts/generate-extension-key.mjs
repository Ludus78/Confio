/**
 * Régénère une paire RSA et affiche l'ID Chrome correspondant.
 * Ne l'utilise que si tu acceptes de recréer le client OAuth Google.
 *
 *   node scripts/generate-extension-key.mjs
 */
import { createHash, generateKeyPairSync } from 'node:crypto'
import { writeFileSync } from 'node:fs'

const { publicKey, privateKey } = generateKeyPairSync('rsa', {
  modulusLength: 2048,
  publicKeyEncoding: { type: 'spki', format: 'der' },
  privateKeyEncoding: { type: 'pkcs8', format: 'pem' },
})

const publicKeyBase64 = publicKey.toString('base64')
const hash = createHash('sha256').update(publicKey).digest()
const extensionId = [...hash.subarray(0, 16)]
  .map((byte) => byte.toString(16).padStart(2, '0'))
  .join('')
  .split('')
  .map((nibble) => String.fromCharCode('a'.charCodeAt(0) + Number.parseInt(nibble, 16)))
  .join('')

writeFileSync('extension-key.pem', privateKey)

console.log('EXTENSION_ID=', extensionId)
console.log('PUBLIC_KEY=', publicKeyBase64)
console.log('Private key written to extension-key.pem (gitignored).')
console.log('Copy these values into src/extension-identity.ts and update Google Cloud Application ID.')
