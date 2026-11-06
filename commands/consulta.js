import { jidObjetivo } from '../lib/pruebas.js'
import { normalizarJid } from '../lib/utils.js'

export const desc = 'Consultas: existe en WhatsApp, estado, foto de perfil, perfil de negocio y presencia'
export const alias = ['query', 'consultar']
export const categoria = 'prueba'
export const cooldown = 6

const AYUDA = (p) => `🔎 *${p}consulta*
▢ *existe* <número> — ¿tiene WhatsApp?
▢ *estado* [@usuario] — su estado ("info")
▢ *foto* [@usuario|grupo] — foto de perfil en alta calidad
▢ *negocio* <número> — perfil de WhatsApp Business
▢ *presencia* @usuario — si está en línea o escribiendo (10 s)`

export default async function consulta({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: msg })
  const [sub = '', ...resto] = args
  const accion = sub.toLowerCase()
  const remitente = normalizarJid(msg.key.participant || msg.key.remoteJid)
  const objetivo = jidObjetivo(msg, resto) || remitente

  if (accion === 'existe') {
    const numero = resto.join('').replace(/\D/g, '')
    if (numero.length < 7) return responder(`Uso: *${p}consulta existe* 51999999999`)
    const [resultado] = (await sock.onWhatsApp(`${numero}@s.whatsapp.net`)) || []
    return responder(resultado?.exists ? `✅ +${numero} tiene WhatsApp\n🆔 ${resultado.jid}` : `❌ +${numero} no tiene WhatsApp`)
  }

  if (accion === 'estado') {
    const resultado = await sock.fetchStatus(objetivo)
    const entrada = Array.isArray(resultado) ? resultado[0] : resultado
    const estado = entrada?.status?.status ?? entrada?.status
    return responder(estado ? `💬 Estado de @${objetivo.split('@')[0]}:\n${estado}` : '🔒 No tiene estado o no es visible.', { mentions: [objetivo] })
  }

  if (accion === 'foto') {
    const jid = resto[0]?.toLowerCase() === 'grupo' && chatId.endsWith('@g.us') ? chatId : objetivo
    let url
    try {
      url = await sock.profilePictureUrl(jid, 'image')
    } catch {
      url = null // sin foto o privada
    }
    if (!url) return responder('🖼️ No tiene foto de perfil o es privada.')
    return sock.sendMessage(chatId, { image: { url }, caption: '🖼️ Foto de perfil' }, { quoted: msg })
  }

  if (accion === 'negocio') {
    const numero = resto.join('').replace(/\D/g, '')
    if (numero.length < 7) return responder(`Uso: *${p}consulta negocio* 51999999999`)
    const perfil = await sock.getBusinessProfile(`${numero}@s.whatsapp.net`)
    if (!perfil) return responder('🏪 No es una cuenta de WhatsApp Business.')
    return responder(
      [
        '🏪 *Perfil de negocio*',
        perfil.description ? `📝 ${perfil.description}` : null,
        perfil.category ? `🏷️ ${perfil.category}` : null,
        perfil.website?.length ? `🌐 ${[].concat(perfil.website).join(', ')}` : null,
        perfil.email ? `✉️ ${perfil.email}` : null,
        perfil.address ? `📍 ${perfil.address}` : null,
      ]
        .filter(Boolean)
        .join('\n')
    )
  }

  if (accion === 'presencia') {
    const jid = jidObjetivo(msg, resto)
    if (!jid) return responder(`Uso: *${p}consulta presencia* @usuario`)

    const eventos = []
    const escuchar = (u) => {
      for (const [quien, datos] of Object.entries(u.presences || {})) {
        if (normalizarJid(quien) === jid) eventos.push(datos.lastKnownPresence)
      }
    }
    sock.ev.on('presence.update', escuchar)
    await sock.presenceSubscribe(jid)
    await new Promise((r) => setTimeout(r, 10000))
    sock.ev.off('presence.update', escuchar)

    return responder(
      eventos.length
        ? `👀 Presencia de @${jid.split('@')[0]}: ${[...new Set(eventos)].join(' → ')}`
        : `👀 Sin cambios de presencia de @${jid.split('@')[0]} en 10 s.`,
      { mentions: [jid] }
    )
  }

  return responder(AYUDA(p))
}
