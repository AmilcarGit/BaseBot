import { delay } from '../lib/utils.js'

export const desc = 'Marca como leído y simula "escribiendo…" y "grabando audio…"'
export const alias = ['presence', 'typing']
export const categoria = 'prueba'
export const cooldown = 15

export default async function escribiendo({ sock, chatId, msg }) {
  await sock.readMessages([msg.key]) // marca el mensaje como leído (doble check azul)

  await sock.sendPresenceUpdate('composing', chatId)
  await delay(3000)
  await sock.sendPresenceUpdate('recording', chatId)
  await delay(3000)
  await sock.sendPresenceUpdate('paused', chatId)

  await sock.sendMessage(
    chatId,
    { text: '✅ Listo: leído → escribiendo → grabando audio → en pausa.' },
    { quoted: msg }
  )
}
