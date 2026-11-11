import { guardarMensaje, registrarQuiz, ultimoQuiz } from '../lib/store.js'

export const desc = 'Crea un quiz (encuesta con respuesta correcta) y muestra quién acertó (experimental)'
export const alias = ['trivia']
export const categoria = 'prueba'
export const cooldown = 5

const POR_DEFECTO = '¿Cuál es la capital de Perú? | *Lima | Quito | Bogotá | Santiago'

/** Mezcla una copia de la lista (Fisher-Yates). */
function mezclar(lista, azar = Math.random) {
  const copia = [...lista]
  for (let i = copia.length - 1; i > 0; i--) {
    const j = Math.floor(azar() * (i + 1))
    ;[copia[i], copia[j]] = [copia[j], copia[i]]
  }
  return copia
}

/**
 * "Pregunta | *Correcta | Otra | Otra" -> { pregunta, opciones, correcta }.
 * La correcta lleva un * delante; si ninguna lo lleva, la primera es la correcta.
 */
export function leerQuiz(texto) {
  const [pregunta, ...crudas] = String(texto).split('|').map((s) => s.trim()).filter(Boolean)
  if (!pregunta || crudas.length < 2 || crudas.length > 12) return undefined

  const marcada = crudas.findIndex((o) => o.startsWith('*'))
  const opciones = crudas.map((o) => o.replace(/^\*\s*/, '').trim()).filter(Boolean)
  if (opciones.length !== crudas.length || new Set(opciones).size !== opciones.length) return undefined

  return { pregunta, opciones, correcta: opciones[marcada === -1 ? 0 : marcada] }
}

const nombre = (jid) => `@${String(jid).split('@')[0]}`

export default async function quiz({ sock, chatId, msg, args, config }) {
  const p = config.prefijo

  if (typeof sock.sendQuiz !== 'function') {
    return sock.sendMessage(chatId, {
      text: '⚠️ Esto necesita Yui-Bails 1.4.0 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails',
    })
  }

  // ".quiz resultado": quién acertó en el último quiz de este chat
  if (/^(resultado|resultados|result)$/i.test(args[0] || '')) {
    const id = ultimoQuiz(chatId)
    const resultado = id && sock.getQuizResult(id)
    if (!resultado) return sock.sendMessage(chatId, { text: `Todavía no hay un quiz en este chat. Crea uno con *${p}quiz*.` }, { quoted: msg })

    const lista = (jids) => (jids.length ? jids.map(nombre).join(', ') : '—')
    return sock.sendMessage(
      chatId,
      {
        text: `🧠 *${resultado.pollName}*\n✅ Respuesta correcta: *${resultado.correct}*\n\n🏆 Acertaron (${resultado.right.length}): ${lista(resultado.right)}\n❌ Fallaron (${resultado.wrong.length}): ${lista(resultado.wrong)}`,
        mentions: [...resultado.right, ...resultado.wrong],
      },
      { quoted: msg }
    )
  }

  const datos = leerQuiz(args.join(' ').trim() || POR_DEFECTO)
  if (!datos) {
    return sock.sendMessage(
      chatId,
      {
        text: `🧠 *Quiz*\nUso: *${p}quiz Pregunta | *Correcta | Otra | Otra*\nLa respuesta correcta lleva un * delante (2 a 12 opciones; el orden se mezcla solo).\nCuando hayan votado: *${p}quiz resultado*`,
      },
      { quoted: msg }
    )
  }

  const enviado = await sock.sendQuiz(chatId, datos.pregunta, mezclar(datos.opciones), datos.correcta, { quoted: msg })
  guardarMensaje(enviado)
  registrarQuiz(chatId, enviado.key.id)
}
