import { obtenerEncuesta, guardarMensaje } from './store.js'
import { error as logError } from './logger.js'

/**
 * Evento `poll.votes` de Yui-Bails: llega con el resultado ya descifrado y acumulado
 * (cada votante cuenta una sola vez, aunque cambie su voto). Se responde con el recuento
 * solo para las encuestas creadas con `.encuesta` / `.helpers encuesta`.
 */
export async function procesarVotos(sock, { pollKey, pollName, votes }) {
  if (!obtenerEncuesta(pollKey.id)) return

  try {
    await sock.sendMessage(pollKey.remoteJid, { text: textoVotos(pollName, votes) })
  } catch (err) {
    logError('Error mostrando el recuento de la encuesta:', err)
  }
}

/** Recuento con barras a partir de `votes` = [{ name, voters: [] }]. */
export function textoVotos(pregunta, votes) {
  const votantes = new Set(votes.flatMap((o) => o.voters))
  const total = Math.max(1, votantes.size)
  const lineas = votes.map(({ name, voters }) => {
    const llenas = Math.round((voters.length / total) * 10)
    return `▢ *${name}*\n   ${'█'.repeat(llenas)}${'░'.repeat(10 - llenas)} ${voters.length}`
  })

  return `📊 *${pregunta}*\n👥 Votantes: ${votantes.size}\n\n${lineas.join('\n\n')}`
}

/** Arma el texto con barras de progreso a partir de los votos acumulados. */
export function textoResultados(creacion, encuesta) {
  const poll =
    creacion.pollCreationMessage || creacion.pollCreationMessageV2 || creacion.pollCreationMessageV3
  const nombres = (poll?.options || []).map((o) => o.optionName)

  const conteo = new Map(nombres.map((n) => [n, 0]))
  for (const elegidas of encuesta.votos.values()) {
    for (const nombre of elegidas) conteo.set(nombre, (conteo.get(nombre) || 0) + 1)
  }

  const total = Math.max(1, encuesta.votos.size)
  const lineas = [...conteo].map(([nombre, n]) => {
    const llenas = Math.round((n / total) * 10)
    return `▢ *${nombre}*\n   ${'█'.repeat(llenas)}${'░'.repeat(10 - llenas)} ${n}`
  })

  return `📊 *${encuesta.pregunta}*\n👥 Votantes: ${encuesta.votos.size}\n\n${lineas.join('\n\n')}`
}

export { guardarMensaje }
