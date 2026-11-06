import { pngDegradado } from '../lib/pruebas.js'
import { normalizarJid } from '../lib/utils.js'

export const desc = 'Publica un estado (historia) de texto o imagen, visible solo para el owner y el bot'
export const alias = ['status', 'story']
export const categoria = 'prueba'
export const soloOwner = true
export const cooldown = 10

export default async function historia({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const modo = (args[0] || '').toLowerCase()

  // Solo ven el estado estos contactos: así la prueba no llega a nadie más.
  const statusJidList = [...new Set([...config.owner.map((n) => `${n.replace(/\D/g, '')}@s.whatsapp.net`), normalizarJid(sock.user.id)])]

  if (modo === 'imagen') {
    await sock.sendMessage(
      'status@broadcast',
      { image: pngDegradado(), caption: `Estado de prueba de ${config.nombreBot}` },
      { statusJidList, broadcast: true }
    )
  } else {
    const texto = (modo === 'texto' ? args.slice(1) : args).join(' ').trim()
    if (!texto) {
      return sock.sendMessage(
        chatId,
        { text: `Uso:\n▢ *${p}historia* <texto> — estado de texto con fondo de color\n▢ *${p}historia imagen* — estado con imagen` },
        { quoted: msg }
      )
    }
    await sock.sendMessage('status@broadcast', { text: texto }, { statusJidList, backgroundColor: '#9d4edd', font: 3, broadcast: true })
  }

  await sock.sendMessage(chatId, { text: '✅ Estado publicado (visible solo para el owner y el bot).' }, { quoted: msg })
}
