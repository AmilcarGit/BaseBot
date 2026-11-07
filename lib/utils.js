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
 * Compara si un JID (o varios) pertenece a la lista de owners definida en config.js.
 * Acepta el número de teléfono o el ID interno (@lid) que WhatsApp usa en muchos chats.
 */
export function esOwner(jid, ownerList = []) {
  const ids = (Array.isArray(jid) ? jid : [jid])
    .filter(Boolean)
    .map((j) => normalizarJid(j).split('@')[0])
  return ownerList.some((num) => ids.includes(String(num).replace(/\D/g, '')))
}

/**
 * Todos los JIDs que identifican a quien escribió: WhatsApp puede mostrarlo como número
 * (@s.whatsapp.net) o como ID interno (@lid), y Yui-Bails entrega ambos en la clave del mensaje.
 */
export function identidadesDe(msg) {
  const k = msg?.key || {}
  const ids = [k.participant, k.participantAlt, k.remoteJid, k.remoteJidAlt]
    .filter((j) => j && !j.endsWith('@g.us') && !j.endsWith('@broadcast'))
    .map(normalizarJid)
  return [...new Set(ids)]
}

/** Igual que identidadesDe, pero si solo hay un @lid intenta averiguar su número con Yui-Bails. */
export async function resolverIdentidades(sock, msg) {
  // Mensaje escrito desde el propio número del bot: en un privado remoteJid es el OTRO chat,
  // así que la identidad es la cuenta vinculada (número e ID interno).
  if (msg?.key?.fromMe && sock?.user) {
    return [...new Set([sock.user.id, sock.user.lid].filter(Boolean).map(normalizarJid))]
  }

  const ids = identidadesDe(msg)

  // Yui-Bails resuelve número + ID interno por su cuenta con sock.getSender
  if (typeof sock?.getSender === 'function') {
    try {
      const s = await sock.getSender(msg)
      for (const j of [s.pn, s.lid]) if (j) ids.push(normalizarJid(j))
      return [...new Set(ids)]
    } catch {
      // si falla, se sigue con el método manual de abajo
    }
  }
  for (const lid of ids.filter((j) => j.endsWith('@lid'))) {
    try {
      const pn = await sock?.signalRepository?.lidMapping?.getPNForLID?.(lid)
      if (pn) ids.push(normalizarJid(pn))
    } catch {
      // sin equivalencia conocida: se queda con el ID interno
    }
  }
  return [...new Set(ids)]
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

/** id elegido en un botón native flow o desplegable (viene como JSON en paramsJson). */
function idNativeFlow(c) {
  const json = c?.interactiveResponseMessage?.nativeFlowResponseMessage?.paramsJson
  if (!json) return ''
  try {
    return JSON.parse(json)?.id || ''
  } catch {
    return ''
  }
}

/**
 * Texto escrito, pie de foto/video, o el id del botón/lista que tocó el usuario
 * ('' si no hay). Así tocar un botón con id ".ping" ejecuta el comando .ping.
 */
export function textoDeMensaje(msg) {
  const c = contenidoMensaje(msg)
  return (
    c?.conversation ||
    c?.extendedTextMessage?.text ||
    c?.imageMessage?.caption ||
    c?.videoMessage?.caption ||
    c?.buttonsResponseMessage?.selectedButtonId ||
    c?.listResponseMessage?.singleSelectReply?.selectedRowId ||
    idNativeFlow(c) ||
    ''
  )
}
