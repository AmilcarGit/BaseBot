import { jidObjetivo } from '../lib/pruebas.js'

export const desc = 'Privacidad del bot: ver ajustes, lista de bloqueados, bloquear y desbloquear'
export const alias = ['privacy']
export const categoria = 'prueba'
export const soloOwner = true
export const cooldown = 5

const AYUDA = (p) => `🔐 *${p}privacidad*
▢ *ver* — ajustes de privacidad del bot
▢ *bloqueados* — lista de bloqueados
▢ *bloquear* @usuario · *desbloquear* @usuario`

export default async function privacidad({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: msg })
  const [sub = '', ...resto] = args
  const accion = sub.toLowerCase()

  if (accion === 'ver') {
    const ajustes = await sock.fetchPrivacySettings(true)
    const lineas = Object.entries(ajustes || {}).map(([clave, valor]) => `▢ ${clave}: *${valor}*`)
    return responder(`🔐 *Privacidad del bot*\n\n${lineas.join('\n') || 'Sin datos.'}`)
  }

  if (accion === 'bloqueados') {
    const lista = (await sock.fetchBlocklist()) || []
    if (!lista.length) return responder('✅ No hay usuarios bloqueados.')
    const primeros = lista.slice(0, 20)
    return responder(`🚫 Bloqueados: ${lista.length}\n${primeros.map((j) => `▢ ${String(j).split('@')[0]}`).join('\n')}${lista.length > 20 ? '\n…' : ''}`)
  }

  if (accion === 'bloquear' || accion === 'desbloquear') {
    const objetivo = jidObjetivo(msg, resto)
    if (!objetivo) return responder(`Uso: *${p}privacidad ${accion}* @usuario (o el número)`)
    await sock.updateBlockStatus(objetivo, accion === 'bloquear' ? 'block' : 'unblock')
    return responder(`${accion === 'bloquear' ? '🚫 Bloqueado' : '✅ Desbloqueado'}: @${objetivo.split('@')[0]}`, { mentions: [objetivo] })
  }

  return responder(AYUDA(p))
}
