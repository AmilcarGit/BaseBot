import test from 'node:test'
import assert from 'node:assert/strict'
import config from '../config.js'
import { autoResponder, chatNativo, esParaElBot } from '../lib/autoreply.js'

config.autoRespuesta.cooldownSegundos = 60

const BOT = '51999999999'

function crearSock() {
  const enviados = []
  return {
    enviados,
    user: { id: `${BOT}:3@s.whatsapp.net` },
    sendPresenceUpdate: async () => {},
    sendMessage: async (jid, contenido, opciones) => {
      enviados.push({ jid, contenido, opciones })
    },
  }
}

let contador = 0
function mensaje(texto, extra = {}) {
  contador++
  return {
    key: { id: `3EB0TEST${contador}`, remoteJid: extra.chat || '51911111111@s.whatsapp.net' },
    message: extra.message || { conversation: texto },
  }
}

const privado = (n) => `5191000000${n}@s.whatsapp.net`
const grupo = '120363000000000000@g.us'

test('responde automáticamente en un chat privado, citando el mensaje', async () => {
  const sock = crearSock()
  const msg = mensaje('hola', { chat: privado(1) })
  const respondio = await autoResponder({ sock, msg, chatId: privado(1), jidRemitente: privado(1), activa: true })
  assert.equal(respondio, true)
  assert.equal(sock.enviados.length, 1)
  assert.match(sock.enviados[0].contenido.text, /hola/i)
  assert.equal(sock.enviados[0].opciones.quoted, msg)
})

test('no responde si la respuesta automática está desactivada', async () => {
  const sock = crearSock()
  const msg = mensaje('hola', { chat: privado(2) })
  assert.equal(await autoResponder({ sock, msg, chatId: privado(2), jidRemitente: privado(2), activa: false }), false)
  assert.equal(sock.enviados.length, 0)
})

test('en grupos ignora mensajes normales', async () => {
  const sock = crearSock()
  const msg = mensaje('hola a todos', { chat: grupo })
  assert.equal(await autoResponder({ sock, msg, chatId: grupo, jidRemitente: privado(3), activa: true }), false)
  assert.equal(sock.enviados.length, 0)
})

test('en grupos responde si mencionan al bot y quita la mención del texto', async () => {
  const sock = crearSock()
  const msg = mensaje('', {
    chat: grupo,
    message: {
      extendedTextMessage: {
        text: `@${BOT} ¿quién te creó?`,
        contextInfo: { mentionedJid: [`${BOT}@s.whatsapp.net`] },
      },
    },
  })
  assert.equal(await autoResponder({ sock, msg, chatId: grupo, jidRemitente: privado(4), activa: true }), true)
  assert.match(sock.enviados[0].contenido.text, /Amilcar|AmilcarGit/i)
})

test('en grupos responde si le contestan a un mensaje del bot', async () => {
  const sock = crearSock()
  const msg = mensaje('', {
    chat: grupo,
    message: {
      extendedTextMessage: {
        text: 'gracias',
        contextInfo: { participant: `${BOT}:3@s.whatsapp.net` },
      },
    },
  })
  assert.equal(esParaElBot(sock, msg), true)
  assert.equal(await autoResponder({ sock, msg, chatId: grupo, jidRemitente: privado(5), activa: true }), true)
})

test('aplica una pausa por usuario, pero otro usuario sí recibe respuesta', async () => {
  const sock = crearSock()
  const chat = privado(6)
  assert.equal(await autoResponder({ sock, msg: mensaje('hola', { chat }), chatId: chat, jidRemitente: chat, activa: true }), true)
  assert.equal(await autoResponder({ sock, msg: mensaje('hola otra vez', { chat }), chatId: chat, jidRemitente: chat, activa: true }), false)
  const otro = privado(7)
  assert.equal(await autoResponder({ sock, msg: mensaje('hola', { chat: otro }), chatId: otro, jidRemitente: otro, activa: true }), true)
  assert.equal(sock.enviados.length, 2)
})

test('ignora lo que no es texto, mensajes muy largos, estados y otros bots', async () => {
  const sock = crearSock()
  const casos = [
    { chat: privado(8), msg: mensaje('', { chat: privado(8), message: { stickerMessage: {} } }) },
    { chat: privado(9), msg: mensaje('a'.repeat(600), { chat: privado(9) }) },
    { chat: 'status@broadcast', msg: mensaje('hola', { chat: 'status@broadcast' }) },
    { chat: privado(10), msg: { key: { id: 'BAE5ABCDEF', remoteJid: privado(10) }, message: { conversation: 'hola' } } },
  ]
  for (const { chat, msg } of casos) {
    assert.equal(await autoResponder({ sock, msg, chatId: chat, jidRemitente: chat, activa: true }), false)
  }
  assert.equal(sock.enviados.length, 0)
})

test('con responderSiNoSabe en false se queda callado ante lo desconocido', async () => {
  config.autoRespuesta.responderSiNoSabe = false
  try {
    const sock = crearSock()
    const chat = privado(11)
    const msg = mensaje('Quien descubrio america en mil cuatrocientos noventa y dos', { chat })
    assert.equal(await autoResponder({ sock, msg, chatId: chat, jidRemitente: chat, activa: true }), false)
  } finally {
    config.autoRespuesta.responderSiNoSabe = true
  }
})

test('un fallo del motor no lanza errores hacia el bot', async () => {
  const sock = crearSock()
  sock.sendMessage = async () => {
    throw new Error('sin conexión')
  }
  const chat = privado(12)
  assert.equal(await autoResponder({ sock, msg: mensaje('hola', { chat }), chatId: chat, jidRemitente: chat, activa: true }), false)
})

test('cada chat recuerda su tema reciente', async () => {
  const primera = await chatNativo('chat-memoria', '¿Qué es la gravedad?')
  assert.equal(primera.intent, 'gravedad')
  const seguimiento = await chatNativo('chat-memoria', 'explícame más')
  assert.equal(seguimiento.intent, 'gravedad')
  const otroChat = await chatNativo('chat-nuevo', 'explícame más')
  assert.equal(otroChat.intent, 'unknown')
})

test('funciona aunque config.js no tenga el bloque autoRespuesta (config antiguo)', async () => {
  const guardado = config.autoRespuesta
  delete config.autoRespuesta
  try {
    const sock = crearSock()
    const chat = privado(20)
    assert.equal(await autoResponder({ sock, msg: mensaje('hola', { chat }), chatId: chat, jidRemitente: chat }), true)
    assert.equal(sock.enviados.length, 1)
  } finally {
    config.autoRespuesta = guardado
  }
})

test('lee el texto en chats con mensajes temporales y de una sola vista', async () => {
  for (const [i, message] of [
    { ephemeralMessage: { message: { conversation: 'hola' } } },
    { viewOnceMessage: { message: { extendedTextMessage: { text: 'hola' } } } },
    { ephemeralMessage: { message: { ephemeralMessage: { message: { conversation: 'hola' } } } } },
  ].entries()) {
    const sock = crearSock()
    const chat = privado(30 + i)
    const msg = mensaje('', { chat, message })
    assert.equal(await autoResponder({ sock, msg, chatId: chat, jidRemitente: chat, activa: true }), true, `caso ${i}`)
  }
})

test('el texto envuelto también sirve para detectar menciones en grupos', async () => {
  const sock = crearSock()
  const msg = mensaje('', {
    chat: grupo,
    message: {
      ephemeralMessage: {
        message: {
          extendedTextMessage: { text: `@${BOT} hola`, contextInfo: { mentionedJid: [`${BOT}@s.whatsapp.net`] } },
        },
      },
    },
  })
  assert.equal(esParaElBot(sock, msg), true)
})
