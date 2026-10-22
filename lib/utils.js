/**
 * Normaliza un JID de WhatsApp, quitando el sufijo ':device'
 * que aparece en cuentas multi-dispositivo.
 * Útil para comparar JIDs al validar owner/permisos.
 */
export function normalizarJid(jid = '') {
  if (!jid) return ''
  return jid
    .replace(/:\d+/, '')
    .replace('@s.whatsapp.net', '@s.whatsapp.net')
}

/**
 * Compara si un JID pertenece a la lista de owners definida en config.js
 */
export function esOwner(jid, ownerList = []) {
  const jidNormalizado = normalizarJid(jid).split('@')[0]
  return ownerList.some((num) => num.replace(/\D/g, '') === jidNormalizado)
}

/** Simple delay/sleep en milisegundos */
export function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

/** Backoff exponencial con tope, para reconexión */
export function backoffDelay(intento, maxDelay) {
  const base = Math.min(1000 * 2 ** intento, maxDelay)
  return base
}

const ENVOLTORIOS = [
  'ephemeralMessage',
  'viewOnceMessage',
  'viewOnceMessageV2',
  'viewOnceMessageV2Extension',
  'documentWithCaptionMessage',
  'editedMessage',
]

/**
 * Devuelve el contenido real de un mensaje. WhatsApp envuelve el texto en
 * chats con mensajes temporales, de una sola vista, editados, etc.
 */
export function contenidoMensaje(msg) {
  let contenido = msg?.message
  for (let i = 0; i < 5 && contenido; i++) {
    const clave = ENVOLTORIOS.find((c) => contenido[c]?.message)
    if (!clave) break
    contenido = contenido[clave].message
  }
  return contenido || null
}

/** Texto escrito o pie de foto/video del mensaje ('' si no hay). */
export function textoDeMensaje(msg) {
  const c = contenidoMensaje(msg)
  return (
    c?.conversation ||
    c?.extendedTextMessage?.text ||
    c?.imageMessage?.caption ||
    c?.videoMessage?.caption ||
    ''
  )
}
