import { normalizarJid, resolverIdentidades } from '../lib/utils.js'

export const desc = 'Muestra tu ID de WhatsApp (para configurar el owner)'
export const alias = ['miid']
export const cooldown = 3

export default async function id({ sock, msg, chatId, esDueno, config }) {
  const jid = msg.key.participant || msg.key.remoteJid
  const miId = normalizarJid(jid).split('@')[0]
  const tipo = jid.endsWith('@lid') ? 'ID interno (LID)' : 'número de teléfono'
  const identidades = await resolverIdentidades(sock, msg)
  const numero = identidades.find((j) => j.endsWith('@s.whatsapp.net'))?.split('@')[0]
  // Lo recomendable es poner el número; si WhatsApp no lo entrega, sirve el ID interno
  const paraOwner = numero || miId

  await sock.sendMessage(chatId, {
    text: `🪪 *Tu ID:* ${miId}
Tipo: ${tipo}${numero && numero !== miId ? `\nTu número: ${numero}` : ''}
Owner: ${esDueno ? 'sí ✅' : 'no ❌'}

${esDueno ? '' : `Para ser owner, agrega *${paraOwner}* a \`owner\` en config.js (por ejemplo: owner: ['${paraOwner}']) y reinicia el bot.`}`.trim(),
  })
}
