import { autoRespuestaActiva, fijarAutoRespuesta } from '../lib/autoreply.js'

export const desc = 'Activa o desactiva la respuesta automática de AMILCAR AI'
export const alias = ['autoai', 'autoresponder']
export const cooldown = 2
export const soloOwner = true

export default async function autoia({ sock, chatId, args, config }) {
  const opcion = (args[0] || '').toLowerCase()

  if (['on', 'activar', 'si', 'sí'].includes(opcion)) {
    await fijarAutoRespuesta(true)
    return sock.sendMessage(chatId, { text: '✅ Respuesta automática *activada*.' })
  }

  if (['off', 'desactivar', 'no'].includes(opcion)) {
    await fijarAutoRespuesta(false)
    return sock.sendMessage(chatId, { text: '⏸️ Respuesta automática *desactivada*.' })
  }

  const activa = await autoRespuestaActiva()
  const cfg = config.autoRespuesta || {}
  await sock.sendMessage(chatId, {
    text: `🤖 *Respuesta automática:* ${activa ? 'activada ✅' : 'desactivada ⏸️'}

👤 Privados: ${cfg.privados ? 'sí' : 'no'}
👥 Grupos: ${cfg.grupos ? 'solo si mencionan al bot o le responden' : 'no'}

Uso: *${config.prefijo}autoia on* · *${config.prefijo}autoia off*`,
  })
}
