import { getGroupMetadataCached } from '../lib/groupCache.js'
import { enviar } from '../lib/pruebas.js'

export const desc = 'Menciona a todos los miembros del grupo (admins). Con "nativo" usa mentionAll'
export const alias = ['todos', 'tagall']
export const categoria = 'prueba'
export const soloAdmin = true
export const cooldown = 30

export default async function mencionar({ sock, chatId, msg, args, config }) {
  if (!chatId.endsWith('@g.us')) {
    return sock.sendMessage(chatId, { text: '👥 Este comando solo funciona en grupos.' }, { quoted: msg })
  }

  const metadata = await getGroupMetadataCached(sock, chatId, config.groupCacheTTL)
  const nativo = args[0]?.toLowerCase() === 'nativo'
  const texto = (nativo ? args.slice(1) : args).join(' ').trim() || 'Atención a todos'

  if (nativo) {
    // mentionAll: WhatsApp avisa a todos sin listar a cada uno
    return enviar(sock, chatId, { text: `📢 ${texto}`, mentionAll: true }, msg)
  }

  const jids = metadata.participants.map((p) => p.id)
  const lista = jids.map((jid) => `▢ @${jid.split('@')[0]}`).join('\n')
  await enviar(sock, chatId, { text: `📢 *${texto}*\n\n${lista}`, mentions: jids }, msg)
}
