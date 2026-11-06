/**
 * Almacén de mensajes en memoria (máx. 500).
 *
 * Yui-Bails lo necesita para dos cosas:
 *  - `getMessage`: reintentar envíos fallidos y descifrar los votos de una encuesta.
 *  - Saber qué encuestas creó el bot, para mostrar los resultados al votar.
 */
const MAX_MENSAJES = 500
const mensajes = new Map() // id -> contenido del mensaje (proto.IMessage)
const encuestas = new Map() // id de la encuesta -> { pregunta, votos: Map<votante, opciones[]> }

/** Guarda un mensaje (recibido o enviado) para poder recuperarlo después. */
export function guardarMensaje(m) {
  if (!m?.key?.id || !m.message) return
  mensajes.set(m.key.id, m.message)
  if (mensajes.size > MAX_MENSAJES) mensajes.delete(mensajes.keys().next().value)
}

/** Para la opción `getMessage` del socket. */
export function obtenerMensaje(key) {
  return mensajes.get(key?.id)
}

/** Marca una encuesta como creada por el bot. */
export function registrarEncuesta(id, pregunta) {
  encuestas.set(id, { pregunta, votos: new Map() })
  if (encuestas.size > 50) encuestas.delete(encuestas.keys().next().value)
}

export function obtenerEncuesta(id) {
  return encuestas.get(id)
}
