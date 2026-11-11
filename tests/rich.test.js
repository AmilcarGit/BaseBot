import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import * as yui from 'yui-bails'
import config from '../config.js'
import quiz, { leerQuiz } from '../commands/quiz.js'
import encuestaimg, { leerOpcion } from '../commands/encuestaimg.js'
import llamada from '../commands/llamada.js'
import estadomencion, * as estadoMod from '../commands/estadomencion.js'
import { pngDegradado } from '../lib/pruebas.js'

const BOT = '51911111111:5@s.whatsapp.net'
const BOT_LIMPIO = '51911111111@s.whatsapp.net'
const GRUPO = '120363000000000000@g.us'
const A = '51922222222@s.whatsapp.net'
const B = '51933333333@s.whatsapp.net'

const subida = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/v/t62/prueba', directPath: '/v/t62/prueba' })

/** Cambia los medios con URL por una imagen local, para que la validación no necesite red. */
function sanear(contenido) {
  const c = { ...contenido }
  for (const clave of ['image', 'video']) if (c[clave]?.url) c[clave] = pngDegradado(32, 32)
  return c
}

/**
 * Socket con las funciones REALES de Yui-Bails (helpers y envíos extra) sobre un sendMessage que
 * pasa todo por la librería: si algo no es un mensaje que WhatsApp aceptaría, lanza.
 */
function crearSock() {
  const enviados = []
  const relays = []
  const ev = new EventEmitter()
  const base = { user: { id: BOT }, ev, updateMediaMessage: async (m) => m }

  base.sendMessage = async (jid, contenido, opciones = {}) => {
    const { quoted, statusJidList, backgroundColor, font } = opciones
    const mensaje = await yui.generateWAMessage(jid, sanear(contenido), {
      userJid: BOT_LIMPIO,
      upload: subida,
      quoted,
      statusJidList,
      backgroundColor,
      font,
    })
    enviados.push({ jid, contenido, opciones, mensaje })
    return mensaje
  }

  const helpers = yui.makeHelpers(base)
  const extras = yui.makeSendExtras(
    {
      sendMessage: base.sendMessage,
      relayMessage: async (jid, mensaje, opciones) => {
        relays.push({ jid, mensaje, opciones })
        return 'ID'
      },
    },
    { sendPoll: helpers.sendPoll }
  )

  return { sock: Object.assign(base, helpers, extras), enviados, relays, ev }
}

let contador = 0
function mensaje(texto, { chat = GRUPO, mencionados = [] } = {}) {
  return {
    key: { remoteJid: chat, id: `CMD${++contador}`, participant: A },
    message: { extendedTextMessage: { text: texto, contextInfo: { mentionedJid: mencionados } } },
    messageTimestamp: 1700000000,
  }
}

async function correr(comando, sock, texto, opciones) {
  const msg = mensaje(`.x ${texto}`, opciones)
  const args = texto.split(/\s+/).filter(Boolean)
  await comando({ sock, msg, args, chatId: msg.key.remoteJid, esDueno: true, config })
}

const textos = (enviados) => enviados.map((e) => e.contenido.text || '').join('\n')

test('leerQuiz: la correcta lleva *, o es la primera', () => {
  assert.deepEqual(leerQuiz('¿2+2? | 3 | *4 | 5'), { pregunta: '¿2+2?', opciones: ['3', '4', '5'], correcta: '4' })
  assert.equal(leerQuiz('¿2+2? | 4 | 5').correcta, '4')
  for (const mal of ['', 'solo pregunta', 'P | una', 'P | a | a', 'P | * | b']) assert.equal(leerQuiz(mal), undefined, mal)
})

test('.quiz crea un quiz real y .quiz resultado dice quién acertó', async () => {
  const { sock, enviados, ev } = crearSock()
  await correr(quiz, sock, '¿Capital de Perú? | *Lima | Quito | Bogotá', {})

  const poll = enviados[0].mensaje.message.pollCreationMessageV3
  assert.equal(poll.pollType, 1)
  assert.equal(poll.correctAnswer.optionName, 'Lima')
  assert.deepEqual(poll.options.map((o) => o.optionName).sort(), ['Bogotá', 'Lima', 'Quito'])

  const clave = enviados[0].mensaje.key
  const voto = (votante, opcion) => ({
    pollUpdateMessageKey: { remoteJid: GRUPO, participant: votante, id: `V-${votante}` },
    vote: { selectedOptions: [yui.sha256(Buffer.from(opcion))] },
  })
  ev.emit('messages.update', [{ key: clave, update: { pollUpdates: [voto(A, 'Lima'), voto(B, 'Quito')] } }])
  await new Promise((r) => setImmediate(r))

  await correr(quiz, sock, 'resultado', {})
  const resultado = enviados.at(-1).contenido
  assert.match(resultado.text, /Respuesta correcta: \*Lima\*/)
  assert.match(resultado.text, /Acertaron \(1\): @51922222222/)
  assert.match(resultado.text, /Fallaron \(1\): @51933333333/)
  assert.deepEqual(resultado.mentions.sort(), [A, B])
})

test('.quiz sin quiz previo, con mal formato o con una librería vieja', async () => {
  const { sock, enviados } = crearSock()
  await correr(quiz, sock, 'resultado', { chat: '120363111111111111@g.us' })
  assert.match(textos(enviados), /Todavía no hay un quiz/)

  await correr(quiz, sock, 'Pregunta | una', {})
  assert.match(textos(enviados), /Uso:/)

  const viejo = { sendMessage: async (jid, contenido) => enviados.push({ jid, contenido }) }
  await correr(quiz, viejo, '', {})
  assert.match(textos(enviados), /Yui-Bails 1\.4\.0/)
})

test('leerOpcion separa el texto del enlace de la imagen', () => {
  const con = leerOpcion('Gato grande https://x.test/gato.jpg', 0)
  assert.equal(con.texto, 'Gato grande')
  assert.deepEqual(con.imagen, { url: 'https://x.test/gato.jpg' })

  const sin = leerOpcion('Perro', 1)
  assert.equal(sin.texto, 'Perro')
  assert.ok(Buffer.isBuffer(sin.imagen))
})

test('.encuestaimg manda las fotos numeradas como álbum y luego la encuesta', async () => {
  const { sock, enviados } = crearSock()
  await correr(encuestaimg, sock, '¿Cuál prefieres? | Gato https://x.test/gato.jpg | Perro', {})

  const contenidos = enviados.map((e) => e.contenido)
  assert.deepEqual(contenidos[0].album, { expectedImageCount: 2, expectedVideoCount: 0 })
  assert.equal(contenidos[1].caption, '1️⃣ Gato')
  assert.equal(contenidos[2].caption, '2️⃣ Perro')
  assert.ok(contenidos[1].albumParentKey)
  assert.deepEqual(contenidos[3].poll.values, ['Gato', 'Perro'])
  assert.equal(enviados.length, 4)
})

test('.llamada programa la llamada con su hora y tipo', async () => {
  const { sock, enviados } = crearSock()
  const antes = Date.now()
  await correr(llamada, sock, '30m video Reunión de equipo', {})

  const llamadaMsg = enviados[0].mensaje.message.scheduledCallCreationMessage
  assert.equal(llamadaMsg.title, 'Reunión de equipo')
  assert.equal(llamadaMsg.callType, 2)
  const cuando = Number(llamadaMsg.scheduledTimestampMs)
  assert.ok(cuando >= antes + 29 * 60_000 && cuando <= Date.now() + 31 * 60_000)

  await correr(llamada, sock, '', {})
  assert.equal(enviados.at(-1).mensaje.message.scheduledCallCreationMessage.callType, 1)
})

test('.estadomencion es solo del owner, publica el estado y avisa a cada mencionado', async () => {
  assert.equal(estadoMod.soloOwner, true)

  const { sock, enviados, relays } = crearSock()
  await correr(estadomencion, sock, '@51922222222 @51933333333 ¡Feliz año!', { mencionados: [A, B] })

  assert.equal(enviados[0].jid, 'status@broadcast')
  assert.equal(enviados[0].contenido.text, '¡Feliz año!')
  assert.deepEqual(enviados[0].opciones.statusJidList, [A, B])
  assert.equal(relays.length, 2)
  assert.deepEqual(relays.map((r) => r.jid), [A, B])
  assert.equal(relays[0].mensaje.statusMentionMessage.message.protocolMessage.type, 25)
  assert.match(textos(enviados), /2 mención/)
})

test('.estadomencion pide texto y menciones', async () => {
  const { sock, enviados } = crearSock()
  await correr(estadomencion, sock, 'solo texto', {})
  assert.match(textos(enviados), /Uso:/)
  assert.equal(enviados.some((e) => e.jid === 'status@broadcast'), false)
})
