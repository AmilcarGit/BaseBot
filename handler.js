import config from './config.js'
import { esOwner } from './lib/utils.js'
import ping from './commands/ping.js'

// Registra aquí tus comandos: nombre -> función
const comandos = {
  ping,
}

export default async function handler(sock, m) {
  try {
    const msg = m.messages?.[0]
    if (!msg?.message || msg.key.fromMe) return

    const jidRemitente = msg.key.participant || msg.key.remoteJid
    const texto =
      msg.message.conversation ||
      msg.message.extendedTextMessage?.text ||
      msg.message.imageMessage?.caption ||
      ''

    if (!texto.startsWith(config.prefijo)) return

    const [comandoRaw, ...args] = texto
      .slice(config.prefijo.length)
      .trim()
      .split(/\s+/)
    const comando = comandoRaw?.toLowerCase()

    if (!comando || !comandos[comando]) return

    const esDueno = esOwner(jidRemitente, config.owner)

    await comandos[comando]({
      sock,
      msg,
      args,
      chatId: msg.key.remoteJid,
      esDueno,
    })
  } catch (err) {
    console.error('Error en handler:', err)
  }
}
