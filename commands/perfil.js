import { normalizarJid } from '../lib/utils.js'

export const desc = 'Muestra tu perfil (datos guardados en la base de datos)'
export const alias = ['profile']
export const cooldown = 5

export default async function perfil({ sock, chatId, msg, db }) {
  const jid = normalizarJid(msg.key.participant || msg.key.remoteJid)
  const usuario = db.data.users[jid] || { mensajes: 0 }

  await sock.sendMessage(chatId, {
    text: `👤 *Tu perfil*\n\n📨 Mensajes enviados: ${usuario.mensajes}`,
  })
}
