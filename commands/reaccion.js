import { obtenerMensajeCitado } from '../lib/media.js'
import { delay } from '../lib/utils.js'

export const desc = 'Reacciona a un mensaje con un emoji (o "ruleta" y "quitar")'
export const alias = ['react']
export const categoria = 'prueba'
export const cooldown = 5

const RULETA = ['👍', '❤️', '😂', '😮', '😢', '🔥', '🎉']

export default async function reaccion({ sock, chatId, msg, args, config }) {
  const arg = (args[0] || '❤️').trim()
  // Si respondes a un mensaje, reacciona a ese; si no, al mensaje del comando.
  const objetivo = obtenerMensajeCitado(msg)?.key ?? msg.key

  if (arg.toLowerCase() === 'ruleta') {
    for (const emoji of RULETA) {
      await sock.sendMessage(chatId, { react: { text: emoji, key: objetivo } })
      await delay(700)
    }
    return sock.sendMessage(chatId, { react: { text: '✅', key: objetivo } })
  }

  // un texto vacío quita la reacción
  const texto = arg.toLowerCase() === 'quitar' ? '' : arg
  await sock.sendMessage(chatId, { react: { text: texto, key: objetivo } })
}
