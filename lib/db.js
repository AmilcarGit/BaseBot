import { Low } from 'lowdb'
import { JSONFile } from 'lowdb/node'
import config from '../config.js'

const datosPorDefecto = { users: {}, chats: {} }

let instancia = null

/**
 * Devuelve la instancia de la base de datos (singleton).
 * La primera vez la lee de disco; las siguientes reutiliza la misma
 * instancia en memoria, así que llamarla varias veces es barato.
 *
 * Uso típico dentro de un comando:
 *   const db = await getDB()
 *   db.data.users[jid] ??= { mensajes: 0 }
 *   db.data.users[jid].mensajes++
 *   await db.write()
 */
export async function getDB() {
  if (instancia) return instancia

  const adapter = new JSONFile(config.dbFile)
  instancia = new Low(adapter, datosPorDefecto)

  await instancia.read()
  instancia.data ||= datosPorDefecto

  return instancia
}
