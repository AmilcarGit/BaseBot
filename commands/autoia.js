import { autoRespuestaActiva, fijarAutoRespuesta, opciones, responder, estadoMotor } from '../lib/autoreply.js'

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

  if (['probar', 'test'].includes(opcion)) {
    const pregunta = args.slice(1).join(' ').trim() || 'hola'
    const r = await responder(`prueba:${chatId}`, pregunta)
    const neuronal = r.neuralConfianza !== undefined ? `\nConfianza del modelo neuronal: ${r.neuralConfianza.toFixed(2)}` : ''
    return sock.sendMessage(chatId, {
      text: `🧪 *Prueba del motor*\n\nPregunta: ${pregunta}\nMotor usado: ${r.motor}\nIntención: ${r.intent}${neuronal}\nRespuesta: ${r.reply}`,
    })
  }

  const activa = await autoRespuestaActiva()
  const cfg = opciones()
  const motor = await estadoMotor()
  const aviso = config.autoRespuesta
    ? ''
    : '\n\n⚠️ Tu config.js no tiene el bloque *autoRespuesta*; se usan valores por defecto.'
  await sock.sendMessage(chatId, {
    text: `🤖 *Respuesta automática:* ${activa ? 'activada ✅' : 'desactivada ⏸️'}

🧠 Motor: ${motor.motor} · modelo neuronal: ${motor.neuralDisponible ? 'cargado ✅' : `no disponible${motor.motivo ? ` (${motor.motivo})` : ''}`}\n👤 Privados: ${cfg.privados ? 'sí' : 'no'}
👥 Grupos: ${cfg.grupos ? 'solo si mencionan al bot o le responden' : 'no'}

Uso: *${config.prefijo}autoia on* · *${config.prefijo}autoia off* · *${config.prefijo}autoia probar hola*${aviso}`,
  })
}
