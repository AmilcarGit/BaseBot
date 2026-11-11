export const desc = 'Programa recordatorios: .recordar 10m comprar pan · .recordar lista · .recordar cancelar <id>'
export const alias = ['recordatorio', 'remind']
export const cooldown = 3

const UNIDADES = { s: 1000, m: 60_000, h: 3_600_000, d: 86_400_000 }
const MAX_POR_CHAT = 20
const MIN_REPETICION_MS = 60_000

/** '10m' -> 600000 (milisegundos). Devuelve undefined si no es un tiempo válido. */
export function leerTiempo(texto) {
  const m = /^(\d+)([smhd])$/i.exec(String(texto || '').trim())
  if (!m) return undefined
  const ms = Number(m[1]) * UNIDADES[m[2].toLowerCase()]
  return ms > 0 ? ms : undefined
}

/** Cuánto falta, en palabras cortas: 'en 2 h 5 min'. */
export function enCuanto(ms) {
  const minutos = Math.max(1, Math.round(ms / 60_000))
  if (minutos < 60) return `en ${minutos} min`
  const horas = Math.floor(minutos / 60)
  if (horas < 48) return `en ${horas} h${minutos % 60 ? ` ${minutos % 60} min` : ''}`
  return `en ${Math.round(horas / 24)} días`
}

/**
 * Interpreta los argumentos de .recordar:
 *   <tiempo> <texto>          -> una vez
 *   cada <tiempo> <texto>     -> repite
 *   lista | cancelar <id>
 */
export function interpretar(args) {
  const [primero = '', ...resto] = args
  const palabra = primero.toLowerCase()

  if (palabra === 'lista' || palabra === 'list') return { accion: 'lista' }
  if (palabra === 'cancelar' || palabra === 'cancel') return { accion: 'cancelar', id: resto[0] }

  const repetir = palabra === 'cada'
  const [tiempoTexto = '', ...palabras] = repetir ? resto : args
  const ms = leerTiempo(tiempoTexto)
  const texto = palabras.join(' ').trim()

  if (!ms || !texto) return { accion: 'uso' }
  return { accion: repetir ? 'cada' : 'una', ms, tiempo: tiempoTexto.toLowerCase(), texto }
}

const USO = `⏰ *Recordatorios*

• *.recordar 10m comprar pan* — una vez, en 10 minutos
• *.recordar cada 2h tomar agua* — se repite
• *.recordar lista* — los que hay en este chat
• *.recordar cancelar <id>* — borra uno

Tiempos: 30s, 15m, 2h, 1d`

export default async function recordar({ sock, msg, args, chatId, config }) {
  if (typeof sock.schedule?.after !== 'function') {
    return sock.sendMessage(chatId, {
      text: '⚠️ Esta función necesita Yui-Bails 1.3.0 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails',
    })
  }

  const orden = interpretar(args)
  const propios = () => sock.schedule.list().filter((t) => t.jid === chatId)

  if (orden.accion === 'uso') return sock.sendMessage(chatId, { text: USO })

  if (orden.accion === 'lista') {
    const lista = propios()
    if (!lista.length) return sock.sendMessage(chatId, { text: '⏰ No hay recordatorios en este chat.' })

    const lineas = lista.map((t) => {
      const cuando = t.kind === 'every' ? `cada ${Math.round(t.everyMs / 60_000)} min` : enCuanto(t.at - Date.now())
      const texto = String(t.content?.text || '').replace(/^⏰ (@\d+: )?/, '')
      return `▢ *${t.id}* — ${cuando}\n   ${texto}`
    })
    return sock.sendMessage(chatId, {
      text: `⏰ *Recordatorios de este chat*\n\n${lineas.join('\n\n')}\n\nBorra uno con ${config.prefijo}recordar cancelar <id>`,
    })
  }

  if (orden.accion === 'cancelar') {
    // solo se pueden cancelar los de este mismo chat
    const existe = orden.id && propios().some((t) => t.id === orden.id)
    if (!existe) return sock.sendMessage(chatId, { text: '⏰ No encontré ese recordatorio. Mira los ids con .recordar lista' })

    sock.schedule.cancel(orden.id)
    return sock.sendMessage(chatId, { text: '✅ Recordatorio cancelado.' })
  }

  if (propios().length >= MAX_POR_CHAT) {
    return sock.sendMessage(chatId, { text: `⏰ Ya hay ${MAX_POR_CHAT} recordatorios en este chat. Cancela alguno primero.` })
  }

  if (orden.accion === 'cada' && orden.ms < MIN_REPETICION_MS) {
    return sock.sendMessage(chatId, { text: '⏰ Para repetir, el mínimo es 1 minuto (1m).' })
  }

  // quién lo pidió: se le menciona cuando llegue la hora
  const quien = typeof sock.getSender === 'function' ? await sock.getSender(msg) : undefined
  const jid = quien?.jid
  const contenido = jid
    ? { text: `⏰ @${jid.split('@')[0]}: ${orden.texto}`, mentions: [jid] }
    : { text: `⏰ ${orden.texto}` }

  const id =
    orden.accion === 'cada'
      ? sock.schedule.every(orden.tiempo, chatId, contenido)
      : sock.schedule.after(orden.tiempo, chatId, contenido)

  const cuando = orden.accion === 'cada' ? `cada ${orden.tiempo}` : enCuanto(orden.ms)
  await sock.sendMessage(chatId, {
    text: `✅ Listo, te lo recuerdo ${cuando}.\n🆔 ${id} (para cancelar: ${config.prefijo}recordar cancelar ${id})`,
  })
}
