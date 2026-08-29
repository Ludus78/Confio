/**
 * Identité cryptographique de l'extension.
 *
 * Chrome calcule l'ID à partir de cette clé publique. Sans champ `key` dans le
 * manifest, l'ID change dès que le dossier est déplacé — et l'OAuth Google
 * (client de type "Chrome Extension") est lié à UN ID précis.
 *
 * La clé privée correspondante est `extension-key.pem` (gitignorée).
 * Ne régénère cette paire que si tu acceptes de recréer le client OAuth.
 */
export const EXTENSION_ID = 'gogajdnjlmcocjhdplegfnegbioankim'

export const EXTENSION_PUBLIC_KEY =
  'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAqZLIe88D00T09h/FnHEud/fHFuAkxa0iuDrc6YAihYO2fFDs8aaBfmfoxwpGQtRyYS996tGmxpMx1FP6gUXQSs4xWkEVApYiqbQkM5rn2/LV8k8Eas/TK8CpAsFBfbOkIAbPcYd21TbykhfOY+A/D/4XiMIbJB8J8cMeEoAExWyLGC3Q44h2fxnT8zpMmQMlGSEswSHtEn4XU5uO1Jbwa2IdHc5vvdIkkokpTTugRBt8AbKWOmE9NsQXjMOmD5JnsUed50gj42exw7//vwJMu8nafssZ20izBehe7mvVvGkEZeWnOq7IwIODusU/EflGKPX80hbIlLiF5n40AiP5mwIDAQAB'
