import { normalizarJid } from '../lib/utils.js'

export const desc = 'Muestra tu ID de WhatsApp (para configurar el owner)'
export const alias = ['miid']
export const cooldown = 3

export default async function id({ sock, msg, chatId, esDueno, config }) {
  const jid = msg.key.participant || msg.key.remoteJid
  const miId = normalizarJid(jid).split('@')[0]
  const tipo = jid.endsWith('@lid') ? 'ID interno (LID)' : 'número de teléfono'

  await sock.sendMessage(chatId, {
    text: `🪪 *Tu ID:* ${miId}
Tipo: ${tipo}
Owner: ${esDueno ? 'sí ✅' : 'no ❌'}

${esDueno ? '' : `Para ser owner, agrega *${miId}* a \`owner\` en config.js (por ejemplo: owner: ['${miId}']) y reinicia el bot.`}`.trim(),
  })
}
