import { proto } from 'yui-bails'
import { obtenerMensajeCitado } from '../lib/media.js'

export const desc = 'Fija un mensaje en el chat (24h, 7d o 30d) o lo desfija con "quitar"'
export const alias = ['pin']
export const categoria = 'prueba'
export const cooldown = 8

const DURACIONES = { '24h': 86400, '7d': 604800, '30d': 2592000 }

export default async function fijar({ sock, chatId, msg, args, config }) {
  const arg = (args[0] || '24h').toLowerCase()
  // Si respondes a un mensaje, fija ese; si no, el del comando.
  const key = obtenerMensajeCitado(msg)?.key ?? msg.key

  if (arg === 'quitar') {
    return sock.sendMessage(chatId, { pin: key, type: proto.PinInChat.Type.UNPIN_FOR_ALL })
  }

  const time = DURACIONES[arg]
  if (!time) {
    return sock.sendMessage(
      chatId,
      { text: `Uso: *${config.prefijo}fijar 24h|7d|30d* o *${config.prefijo}fijar quitar* (responde al mensaje a fijar)` },
      { quoted: msg }
    )
  }

  await sock.sendMessage(chatId, { pin: key, type: proto.PinInChat.Type.PIN_FOR_ALL, time })
}
