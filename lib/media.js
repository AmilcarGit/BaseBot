import { downloadMediaMessage } from '@whiskeysockets/baileys'

/** Descarga el buffer de un mensaje con multimedia (imagen, video, audio, sticker, documento). */
export async function descargarMedia(msg, logger) {
  return downloadMediaMessage(msg, 'buffer', {}, { logger })
}

/**
 * Si el mensaje citado en un reply tiene multimedia, reconstruye un
 * objeto de mensaje "descargable" a partir del contextInfo.
 * Devuelve null si no hay nada citado.
 */
export function obtenerMensajeCitado(msg) {
  const contexto = msg.message?.extendedTextMessage?.contextInfo
  const citado = contexto?.quotedMessage
  if (!citado) return null

  return {
    key: {
      remoteJid: msg.key.remoteJid,
      id: contexto.stanzaId,
      participant: contexto.participant,
    },
    message: citado,
  }
}

/** Identifica el tipo de multimedia de un mensaje ('imageMessage', 'videoMessage', etc). */
export function tipoDeMedia(msg) {
  const tipo = Object.keys(msg?.message || {})[0]
  const tipos = [
    'imageMessage',
    'videoMessage',
    'audioMessage',
    'stickerMessage',
    'documentMessage',
  ]
  return tipos.includes(tipo) ? tipo : null
}

export async function enviarImagen(sock, chatId, buffer, caption = '') {
  await sock.sendMessage(chatId, { image: buffer, caption })
}

export async function enviarVideo(sock, chatId, buffer, caption = '') {
  await sock.sendMessage(chatId, { video: buffer, caption })
}

/** ptt = true para nota de voz, false para audio normal */
export async function enviarAudio(sock, chatId, buffer, ptt = false) {
  await sock.sendMessage(chatId, { audio: buffer, mimetype: 'audio/mp4', ptt })
}

/**
 * Envía un sticker a partir de un buffer.
 * NOTA: WhatsApp espera el sticker en formato .webp. Si el buffer viene
 * de una imagen normal (jpg/png), esta base NO lo convierte —evitamos
 * 'sharp' a propósito por compatibilidad con Termux. Si necesitas
 * conversión automática de imagen a sticker, instala 'sharp' o
 * 'wa-sticker-formatter' (no compatibles con Termux/Android) o usa un
 * binario externo como 'cwebp'.
 */
export async function enviarSticker(sock, chatId, buffer) {
  await sock.sendMessage(chatId, { sticker: buffer })
}
