import { descargarMedia, obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'
import { normalizarJid } from '../lib/utils.js'

export const desc = 'Cambia el perfil del bot: nombre, estado y foto (también la foto del grupo)'
export const alias = ['botprofile']
export const categoria = 'prueba'
export const soloOwner = true
export const cooldown = 5

const AYUDA = (p) => `🤖 *${p}botperfil*
▢ *nombre* <texto> — nombre del bot
▢ *estado* <texto> — su "info"
▢ *foto* — responde a una imagen para ponerla de foto
▢ *quitarfoto* — elimina la foto del bot
▢ *fotogrupo* — responde a una imagen para ponerla de foto del grupo (el bot debe ser admin)`

export default async function botPerfil({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })
  const [sub = '', ...resto] = args
  const accion = sub.toLowerCase()
  const texto = resto.join(' ').trim()
  const yo = normalizarJid(sock.user.id)

  if (accion === 'nombre' || accion === 'estado') {
    if (!texto) return responder(`Uso: *${p}botperfil ${accion}* <texto>`)
    if (accion === 'nombre') await sock.updateProfileName(texto)
    else await sock.updateProfileStatus(texto)
    return responder(`✅ ${accion === 'nombre' ? 'Nombre' : 'Estado'} actualizado.`)
  }

  if (accion === 'foto' || accion === 'fotogrupo') {
    const citado = obtenerMensajeCitado(msg)
    if (!citado || tipoDeMedia(citado) !== 'imageMessage') return responder(`📌 Responde a una imagen con *${p}botperfil ${accion}*`)
    if (accion === 'fotogrupo' && !chatId.endsWith('@g.us')) return responder('👥 Esto solo funciona en grupos.')

    const buffer = await descargarMedia(citado, sock)
    await sock.updateProfilePicture(accion === 'foto' ? yo : chatId, buffer)
    return responder('✅ Foto actualizada.')
  }

  if (accion === 'quitarfoto') {
    await sock.removeProfilePicture(yo)
    return responder('✅ Foto eliminada.')
  }

  return responder(AYUDA(p))
}
