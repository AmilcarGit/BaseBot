/**
 * Caché en memoria para groupMetadata, evita golpear la API
 * de WhatsApp en cada mensaje de un grupo.
 */
const cache = new Map()

export async function getGroupMetadataCached(sock, jid, ttl) {
  const entry = cache.get(jid)
  const ahora = Date.now()

  if (entry && ahora - entry.timestamp < ttl) {
    return entry.data
  }

  const data = await sock.groupMetadata(jid)
  cache.set(jid, { data, timestamp: ahora })
  return data
}

export function limpiarCacheGrupo(jid) {
  cache.delete(jid)
}
