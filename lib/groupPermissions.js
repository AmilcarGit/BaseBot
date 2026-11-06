import { getGroupMetadataCached } from './groupCache.js'
import { normalizarJid } from './utils.js'
import config from '../config.js'

/**
 * true si el jid es administrador (o superadmin) del grupo dado.
 * Acepta un jid o una lista: en grupos WhatsApp puede usar el número o el ID interno (@lid).
 */
export async function esAdminGrupo(sock, chatId, jid) {
  if (!chatId.endsWith('@g.us')) return false

  const metadata = await getGroupMetadataCached(sock, chatId, config.groupCacheTTL)
  const buscados = new Set((Array.isArray(jid) ? jid : [jid]).filter(Boolean).map(normalizarJid))

  const participante = metadata.participants.find((p) =>
    [p.id, p.lid, p.phoneNumber].filter(Boolean).some((x) => buscados.has(normalizarJid(x)))
  )

  return participante?.admin === 'admin' || participante?.admin === 'superadmin'
}

/** true si el propio bot es admin del grupo (necesario para expulsar, promover, etc). */
export async function esBotAdminGrupo(sock, chatId) {
  return esAdminGrupo(sock, chatId, [sock.user.id, sock.user.lid])
}
