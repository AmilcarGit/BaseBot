import { getAggregateVotesInPollMessage } from 'yui-bails'
import { obtenerEncuesta, obtenerMensaje, guardarMensaje } from './store.js'
import { normalizarJid } from './utils.js'
import { error as logError } from './logger.js'

/**
 * Procesa el evento `messages.update`: cuando alguien vota en una encuesta creada
 * con `.encuesta`, Yui-Bails entrega el voto cifrado y aquí se descifra con
 * `getAggregateVotesInPollMessage`. Luego se responde con el recuento acumulado.
 */
export async function procesarVotos(sock, actualizaciones) {
  for (const { key, update } of actualizaciones) {
    if (!update?.pollUpdates?.length) continue
    const encuesta = obtenerEncuesta(key.id)
    const creacion = obtenerMensaje(key)
    if (!encuesta || !creacion) continue

    try {
      for (const voto of update.pollUpdates) {
        const k = voto.pollUpdateMessageKey || {}
        const votante = normalizarJid(k.participant || k.remoteJid || key.remoteJid)

        const opciones = getAggregateVotesInPollMessage(
          { message: creacion, pollUpdates: [voto] },
          sock.user?.id
        )
        const elegidas = opciones.filter((o) => o.voters.length > 0).map((o) => o.name)

        if (elegidas.length) encuesta.votos.set(votante, elegidas)
        else encuesta.votos.delete(votante) // quitó su voto
      }

      await sock.sendMessage(key.remoteJid, { text: textoResultados(creacion, encuesta) })
    } catch (err) {
      logError('Error descifrando votos de la encuesta:', err)
    }
  }
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
