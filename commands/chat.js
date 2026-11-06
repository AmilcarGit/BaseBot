import { obtenerMensajeCitado } from '../lib/media.js'
import { duracionEfimera } from '../lib/pruebas.js'

export const desc = 'Modifica este chat: silenciar, archivar, fijar, leído, estrella y mensajes temporales'
export const alias = ['chatmod']
export const categoria = 'prueba'
export const soloOwner = true
export const cooldown = 3

const SILENCIOS = { '8h': 8 * 60 * 60 * 1000, '7d': 7 * 24 * 60 * 60 * 1000 }

const AYUDA = (p) => `💬 *${p}chat* — modifica este chat (⚠️ errores aquí pueden cerrar tus sesiones)
▢ *silenciar* 8h|7d|off
▢ *archivar* · *desarchivar*
▢ *fijar* · *desfijar* — fija el chat arriba
▢ *leido* · *noleido*
▢ *estrella* · *quitarestrella* — responde al mensaje
▢ *efimeros* off|24h|7d|90d`

export default async function chat({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })
  const [sub = '', valor = ''] = args
  const accion = sub.toLowerCase()
  const ultimos = [{ key: msg.key, messageTimestamp: msg.messageTimestamp }]

  if (accion === 'silenciar') {
    const v = valor.toLowerCase()
    if (v === 'off') {
      await sock.chatModify({ mute: null }, chatId)
      return responder('🔔 Chat reactivado.')
    }
    if (!SILENCIOS[v]) return responder(`Uso: *${p}chat silenciar* 8h|7d|off`)
    await sock.chatModify({ mute: SILENCIOS[v] }, chatId)
    return responder(`🔕 Chat silenciado por ${v}.`)
  }

  if (accion === 'archivar' || accion === 'desarchivar') {
    await sock.chatModify({ archive: accion === 'archivar', lastMessages: ultimos }, chatId)
    return responder(accion === 'archivar' ? '🗄️ Chat archivado.' : '📤 Chat desarchivado.')
  }

  if (accion === 'fijar' || accion === 'desfijar') {
    await sock.chatModify({ pin: accion === 'fijar' }, chatId)
    return responder(accion === 'fijar' ? '📌 Chat fijado.' : '📍 Chat desfijado.')
  }

  if (accion === 'leido' || accion === 'noleido') {
    await sock.chatModify({ markRead: accion === 'leido', lastMessages: ultimos }, chatId)
    return responder(accion === 'leido' ? '👁️ Marcado como leído.' : '🔵 Marcado como no leído.')
  }

  if (accion === 'estrella' || accion === 'quitarestrella') {
    const citado = obtenerMensajeCitado(msg)
    if (!citado) return responder(`📌 Responde al mensaje con *${p}chat ${accion}*`)
    const { id, participant } = citado.key
    // fromMe = true si el mensaje citado lo envió el propio bot
    const fromMe = !!participant && participant.split('@')[0].split(':')[0] === sock.user.id.split('@')[0].split(':')[0]
    await sock.chatModify({ star: { messages: [{ id, fromMe }], star: accion === 'estrella' } }, chatId)
    return responder(accion === 'estrella' ? '⭐ Mensaje destacado.' : '☆ Estrella quitada.')
  }

  if (accion === 'efimeros') {
    const segundos = duracionEfimera(valor)
    if (segundos === undefined) return responder(`Uso: *${p}chat efimeros* off|24h|7d|90d`)
    await sock.sendMessage(chatId, { disappearingMessagesInChat: segundos || false })
    return responder(segundos ? `⏳ Mensajes temporales: ${valor}` : '✅ Mensajes temporales desactivados.')
  }

  return responder(AYUDA(p))
}
