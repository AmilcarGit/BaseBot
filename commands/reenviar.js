import { obtenerMensajeCitado } from '../lib/media.js'
import { guardarMensaje } from '../lib/store.js'

export const desc = 'Reenvía el mensaje que cites (con la etiqueta "Reenviado")'
export const alias = ['forward', 'fwd']
export const categoria = 'prueba'
export const cooldown = 8

export default async function reenviar({ sock, chatId, msg, config }) {
  const citado = obtenerMensajeCitado(msg)
  if (!citado) {
    return sock.sendMessage(
      chatId,
      { text: `📌 Responde a un mensaje con *${config.prefijo}reenviar*` },
      { quoted: msg }
    )
  }

  const enviado = await sock.sendMessage(chatId, { forward: citado })
  guardarMensaje(enviado)
}
