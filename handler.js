import config from './config.js'
import { esOwner } from './lib/utils.js'
import ping from './commands/ping.js'
import menu from './commands/menu.js'

// Registra aquí tus comandos: nombre -> { run, desc }
// 'desc' se usa automáticamente para armar el menú.
const comandos = {
  menu: { run: menu, desc: 'Muestra este menú de comandos' },
  ping: { run: ping, desc: 'Muestra la latencia del bot' },
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

    const entrada = comando && comandos[comando]
    if (!entrada) return

    const esDueno = esOwner(jidRemitente, config.owner)

    await entrada.run({
      sock,
      msg,
      args,
      chatId: msg.key.remoteJid,
      esDueno,
      comandos,
      config,
    })
  } catch (err) {
    console.error('Error en handler:', err)
  }
}
