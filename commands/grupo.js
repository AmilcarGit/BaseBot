import { limpiarCacheGrupo } from '../lib/groupCache.js'
import { duracionEfimera, jidObjetivo } from '../lib/pruebas.js'

export const desc = 'Prueba la gestión de grupos: info, link, nombre, descripción, ajustes, efímeros y miembros'
export const alias = ['g', 'group']
export const categoria = 'prueba'
export const soloAdmin = true
export const cooldown = 3

const AJUSTES = { anuncios: 'announcement', abierto: 'not_announcement', bloqueado: 'locked', libre: 'unlocked' }
const MIEMBROS = { agregar: 'add', expulsar: 'remove', promover: 'promote', degradar: 'demote' }
const SOLICITUDES = { aprobar: 'approve', rechazar: 'reject' }

const AYUDA = (p) => `🛠️ *${p}grupo* — gestión de grupos (el bot debe ser admin para cambiar cosas)
▢ *info* — datos del grupo
▢ *link* / *revocar* — enlace de invitación
▢ *nombre* <texto> · *desc* <texto>
▢ *ajustes* anuncios|abierto|bloqueado|libre
▢ *efimero* off|24h|7d|90d
▢ *modo* admins|todos — quién agrega miembros
▢ *agregar* | *expulsar* | *promover* | *degradar* @usuario
▢ *solicitudes* — pendientes · *aprobar* | *rechazar* @usuario`

export default async function grupo({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text, extra = {}) => sock.sendMessage(chatId, { text, ...extra }, { quoted: msg })

  if (!chatId.endsWith('@g.us')) return responder('👥 Este comando solo funciona en grupos.')

  const [sub = 'info', ...resto] = args
  const accion = sub.toLowerCase()
  const texto = resto.join(' ').trim()

  try {
    if (accion === 'info') {
      const m = await sock.groupMetadata(chatId)
      const admins = m.participants.filter((x) => x.admin).length
      const efimero = m.ephemeralDuration ? `${Math.round(m.ephemeralDuration / 86400)} día(s)` : 'no'
      return responder(
        [
          `👥 *${m.subject}*`,
          `🆔 ${m.id}`,
          `📝 ${m.desc || 'Sin descripción'}`,
          `👤 Miembros: ${m.participants.length} (admins: ${admins})`,
          m.creation ? `📅 Creado: ${new Date(m.creation * 1000).toLocaleDateString('es-PE')}` : null,
          `🔒 Solo admins escriben: ${m.announce ? 'sí' : 'no'}`,
          `⚙️ Solo admins editan el grupo: ${m.restrict ? 'sí' : 'no'}`,
          `⏳ Mensajes temporales: ${efimero}`,
          `➕ Agregan miembros: ${m.memberAddMode ? 'todos' : 'solo admins'}`,
          `🚪 Aprobación para unirse: ${m.joinApprovalMode ? 'sí' : 'no'}`,
        ]
          .filter(Boolean)
          .join('\n')
      )
    }

    if (accion === 'link' || accion === 'revocar') {
      const codigo = accion === 'link' ? await sock.groupInviteCode(chatId) : await sock.groupRevokeInvite(chatId)
      return responder(`${accion === 'link' ? '🔗' : '♻️ Nuevo enlace:'} https://chat.whatsapp.com/${codigo}`)
    }

    if (accion === 'nombre' || accion === 'desc') {
      if (!texto) return responder(`Uso: *${p}grupo ${accion}* <texto>`)
      if (accion === 'nombre') await sock.groupUpdateSubject(chatId, texto)
      else await sock.groupUpdateDescription(chatId, texto)
      limpiarCacheGrupo(chatId)
      return responder(`✅ ${accion === 'nombre' ? 'Nombre' : 'Descripción'} actualizado.`)
    }

    if (accion === 'ajustes') {
      const ajuste = AJUSTES[texto.toLowerCase()]
      if (!ajuste) return responder(`Uso: *${p}grupo ajustes* ${Object.keys(AJUSTES).join('|')}`)
      await sock.groupSettingUpdate(chatId, ajuste)
      limpiarCacheGrupo(chatId)
      return responder(`✅ Ajuste aplicado: *${texto.toLowerCase()}*`)
    }

    if (accion === 'efimero') {
      const segundos = duracionEfimera(texto)
      if (segundos === undefined) return responder(`Uso: *${p}grupo efimero* off|24h|7d|90d`)
      await sock.groupToggleEphemeral(chatId, segundos)
      return responder(segundos ? `✅ Mensajes temporales: ${texto}` : '✅ Mensajes temporales desactivados.')
    }

    if (accion === 'modo') {
      const modo = { admins: 'admin_add', todos: 'all_member_add' }[texto.toLowerCase()]
      if (!modo) return responder(`Uso: *${p}grupo modo* admins|todos`)
      await sock.groupMemberAddMode(chatId, modo)
      limpiarCacheGrupo(chatId)
      return responder(`✅ Ahora agregan miembros: *${texto.toLowerCase()}*`)
    }

    if (MIEMBROS[accion]) {
      const objetivo = jidObjetivo(msg, resto)
      if (!objetivo) return responder(`Uso: *${p}grupo ${accion}* @usuario (o el número)`)
      const resultado = await sock.groupParticipantsUpdate(chatId, [objetivo], MIEMBROS[accion])
      limpiarCacheGrupo(chatId)
      const lineas = resultado.map((r) => `${String(r.status) === '200' ? '✅' : '❌'} @${r.jid.split('@')[0]} (código ${r.status})`)
      return responder(lineas.join('\n') || '✅ Hecho.', { mentions: resultado.map((r) => r.jid) })
    }

    if (accion === 'solicitudes') {
      const pendientes = await sock.groupRequestParticipantsList(chatId)
      if (!pendientes.length) return responder('📭 No hay solicitudes pendientes.')
      const jids = pendientes.map((s) => s.jid)
      return responder(`📬 Solicitudes pendientes (${jids.length}):\n${jids.map((j) => `▢ @${j.split('@')[0]}`).join('\n')}`, { mentions: jids })
    }

    if (SOLICITUDES[accion]) {
      const objetivo = jidObjetivo(msg, resto)
      if (!objetivo) return responder(`Uso: *${p}grupo ${accion}* @usuario (o el número)`)
      await sock.groupRequestParticipantsUpdate(chatId, [objetivo], SOLICITUDES[accion])
      return responder(`✅ Solicitud ${accion === 'aprobar' ? 'aprobada' : 'rechazada'}.`)
    }

    return responder(AYUDA(p))
  } catch (err) {
    return responder(`⚠️ No se pudo completar *${accion}*: ${err?.message || err}\n¿El bot es admin del grupo?`)
  }
}
