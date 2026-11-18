import { enCuanto, leerTiempo } from './recordar.js'

export const desc = 'Encuesta que se cierra sola y publica el resultado: .encuestatiempo 10m Pregunta | Opción 1 | Opción 2'
export const alias = ['encuestacierre', 'pollcierre']
export const categoria = 'prueba'
export const cooldown = 5

/** "10m ¿Pizza o tacos? | Pizza | Tacos" -> { tiempo, ms, pregunta, opciones }; undefined si no se entiende. */
export function interpretar(args) {
  const [tiempo = '', ...resto] = args
  const ms = leerTiempo(tiempo)
  const [pregunta, ...crudas] = resto.join(' ').split('|').map((t) => t.trim()).filter(Boolean)
  const opciones = [...new Set(crudas)]
  if (!ms || !pregunta || opciones.length < 2 || opciones.length > 12) return undefined
  return { tiempo: tiempo.toLowerCase(), ms, pregunta, opciones }
}

export default async function encuestatiempo({ sock, chatId, msg, args, config }) {
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  if (typeof sock.sendTimedPoll !== 'function') {
    return responder('⚠️ Esta función necesita Yui-Bails 1.4.2 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails@latest')
  }

  const datos = interpretar(args)
  if (!datos) {
    return responder(
      `⏳ *Encuesta con cierre*\nUso: ${config.prefijo}encuestatiempo 10m ¿Pizza o tacos? | Pizza | Tacos\n\nTiempos: de 5s a 24d (30s, 15m, 2h, 1d). De 2 a 12 opciones.`
    )
  }

  try {
    await sock.sendTimedPoll(chatId, datos.pregunta, datos.opciones, { closeAfter: datos.tiempo }, { quoted: msg })
  } catch (err) {
    if (err?.output?.statusCode === 400) return responder(`⏳ ${err.message}`)
    throw err
  }

  await responder(
    `✅ Encuesta abierta. Se cierra ${enCuanto(datos.ms)} y publico el resultado.\n(Si el bot se reinicia antes, no se cierra sola.)`
  )
}
