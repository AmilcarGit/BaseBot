import { getGroupMetadataCached } from './groupCache.js'
import { normalizarJid } from './utils.js'
import config from '../config.js'

/** true si el jid es administrador (o superadmin) del grupo dado. */
export async function esAdminGrupo(sock, chatId, jid) {
  if (!chatId.endsWith('@g.us')) return false

  const metadata = await getGroupMetadataCached(sock, chatId, config.groupCacheTTL)
  const jidNormalizado = normalizarJid(jid)

  const participante = metadata.participants.find(
    (p) => normalizarJid(p.id) === jidNormalizado
  )

  return participante?.admin === 'admin' || participante?.admin === 'superadmin'
}

/** true si el propio bot es admin del grupo (necesario para expulsar, promover, etc). */
export async function esBotAdminGrupo(sock, chatId) {
  return esAdminGrupo(sock, chatId, sock.user.id)
}
