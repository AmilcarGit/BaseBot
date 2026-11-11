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

const enviadosPorElBot = new Set() // ids de los mensajes que envió este proceso

/** Recuerda un mensaje enviado por el bot, para no tomarlo como comando del número vinculado. */
export function marcarEnviado(id) {
  if (!id) return
  enviadosPorElBot.add(id)
  if (enviadosPorElBot.size > 1000) enviadosPorElBot.delete(enviadosPorElBot.values().next().value)
}

export function fueEnviadoPorElBot(id) {
  return enviadosPorElBot.has(id)
}

/** Marca una encuesta como creada por el bot. */
export function registrarEncuesta(id, pregunta) {
  encuestas.set(id, { pregunta, votos: new Map() })
  if (encuestas.size > 50) encuestas.delete(encuestas.keys().next().value)
}

export function obtenerEncuesta(id) {
  return encuestas.get(id)
}

const quizzes = new Map() // chatId -> id del último quiz de ese chat

/** Guarda el último quiz de un chat, para `.quiz resultado`. */
export function registrarQuiz(chatId, id) {
  quizzes.set(chatId, id)
  if (quizzes.size > 100) quizzes.delete(quizzes.keys().next().value)
}

export function ultimoQuiz(chatId) {
  return quizzes.get(chatId)
}
