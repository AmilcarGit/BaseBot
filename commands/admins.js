export const desc = 'Lista los admins del grupo y dice si tú y el bot lo son (entiende números y LID)'
export const alias = ['administradores']
export const categoria = 'prueba'
export const cooldown = 5

export default async function admins({ sock, chatId, msg }) {
  if (!chatId.endsWith('@g.us')) return sock.reply(msg, '👥 Este comando solo funciona en grupos.')
  if (typeof sock.getAdmins !== 'function') {
    return sock.reply(msg, '⚠️ Tu Yui-Bails es antiguo. Actualiza con: npm install github:AmilcarGit/Yui-Bails')
  }

  const lista = await sock.getAdmins(chatId)
  const tuEresAdmin = await sock.isAdmin(chatId, msg)
  const botEsAdmin = await sock.isBotAdmin(chatId)

  const lineas = lista.map((p) => `▢ @${(p.phoneNumber || p.id).split('@')[0]}${p.admin === 'superadmin' ? ' 👑' : ''}`)
  const menciones = lista.map((p) => p.phoneNumber || p.id)

  await sock.reply(
    msg,
    {
      text: `👮 *Admins del grupo* (${lista.length})\n\n${lineas.join('\n')}\n\n▢ Tú: *${tuEresAdmin ? 'admin' : 'miembro'}*\n▢ El bot: *${botEsAdmin ? 'admin' : 'miembro'}*`,
      mentions: menciones,
    }
  )
}
