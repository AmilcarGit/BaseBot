import test from 'node:test'
import assert from 'node:assert/strict'
import config from '../config.js'
import fs from 'node:fs'
import path from 'node:path'
import { autoResponder, chatNativo, esParaElBot, responder, estadoMotor, fijarNeuralParaPruebas, cargarNeural } from '../lib/autoreply.js'

config.autoRespuesta.cooldownSegundos = 60
fijarNeuralParaPruebas(null) // las pruebas no dependen de que exista el modelo entrenado

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

// ---------------------------------------------------------------- modelo neuronal

function neuralFalso(reply, confidence) {
  const llamadas = []
  return {
    llamadas,
    modelPath: 'falso.amw',
    chat: async (texto) => {
      llamadas.push(texto)
      return { reply, confidence, model: 'AMI-Base-Neural', mode: 'neural' }
    },
  }
}

async function conMotor(valores, fn) {
  const guardado = { ...config.autoRespuesta }
  Object.assign(config.autoRespuesta, valores)
  try {
    return await fn()
  } finally {
    Object.assign(config.autoRespuesta, guardado)
    fijarNeuralParaPruebas(null)
  }
}

test('modo auto: responde el modelo neuronal cuando está seguro', async () => {
  const modelo = neuralFalso('Respuesta generada por la red.', 0.93)
  fijarNeuralParaPruebas(modelo)
  await conMotor({ motor: 'auto', umbralConfianza: 0.5 }, async () => {
    const r = await responder('chat-neural-1', 'hola')
    assert.equal(r.motor, 'neural')
    assert.equal(r.reply, 'Respuesta generada por la red.')
    assert.equal(r.neuralConfianza, 0.93)
    assert.deepEqual(modelo.llamadas, ['hola'])
  })
})

test('modo auto: si el modelo duda, responde el motor nativo y no inventa', async () => {
  fijarNeuralParaPruebas(neuralFalso('texto inventado', 0.12))
  await conMotor({ motor: 'auto', umbralConfianza: 0.5 }, async () => {
    const r = await responder('chat-neural-2', '¿Qué es la gravedad?')
    assert.equal(r.motor, 'native')
    assert.equal(r.intent, 'gravedad')
    assert.equal(r.neuralConfianza, 0.12)
  })
})

test('modo auto: sin modelo neuronal usa el motor nativo sin errores', async () => {
  fijarNeuralParaPruebas(null)
  await conMotor({ motor: 'auto' }, async () => {
    const r = await responder('chat-neural-3', 'hola')
    assert.equal(r.motor, 'native')
    assert.match(r.reply, /hola/i)
  })
})

test('si el modelo neuronal falla o devuelve vacío, se usa el motor nativo', async () => {
  fijarNeuralParaPruebas({ modelPath: 'x', chat: async () => { throw new Error('boom') } })
  await conMotor({ motor: 'auto' }, async () => {
    assert.equal((await responder('chat-neural-4', 'hola')).motor, 'native')
    fijarNeuralParaPruebas(neuralFalso('   ', 0.99))
    assert.equal((await responder('chat-neural-4', 'hola')).motor, 'native')
  })
})

test("modo 'neural' siempre usa el modelo y modo 'native' nunca lo consulta", async () => {
  const modelo = neuralFalso('desde la red', 0.05)
  fijarNeuralParaPruebas(modelo)
  await conMotor({ motor: 'neural', umbralConfianza: 0.9 }, async () => {
    assert.equal((await responder('chat-neural-5', 'hola')).motor, 'neural')
  })
  const antes = modelo.llamadas.length
  fijarNeuralParaPruebas(modelo)
  await conMotor({ motor: 'native' }, async () => {
    assert.equal((await responder('chat-neural-5', 'hola')).motor, 'native')
    assert.equal(modelo.llamadas.length, antes)
  })
})

test('el motor nativo sigue recordando el tema aunque haya respondido el modelo neuronal', async () => {
  fijarNeuralParaPruebas({ modelPath: 'x', chat: async (texto) => (texto.includes('más') ? { reply: '', confidence: 0 } : { reply: 'La gravedad atrae.', confidence: 0.99, model: 'AMI-Base-Neural' }) })
  await conMotor({ motor: 'auto' }, async () => {
    const primera = await responder('chat-neural-6', '¿Qué es la gravedad?')
    assert.equal(primera.motor, 'neural')
    const seguimiento = await responder('chat-neural-6', 'explícame más')
    assert.equal(seguimiento.motor, 'native')
    assert.equal(seguimiento.intent, 'gravedad')
  })
})

test('la respuesta automática usa el modelo neuronal y lo cita en el mensaje', async () => {
  fijarNeuralParaPruebas(neuralFalso('Hola, soy la red neuronal.', 0.97))
  await conMotor({ motor: 'auto' }, async () => {
    const sock = crearSock()
    const chat = privado(40)
    assert.equal(await autoResponder({ sock, msg: mensaje('hola', { chat }), chatId: chat, jidRemitente: chat, activa: true }), true)
    assert.equal(sock.enviados[0].contenido.text, 'Hola, soy la red neuronal.')
  })
})

test('estadoMotor informa si el modelo neuronal está cargado', async () => {
  fijarNeuralParaPruebas(neuralFalso('x', 1))
  await conMotor({ motor: 'auto' }, async () => {
    const e = await estadoMotor()
    assert.equal(e.neuralDisponible, true)
    assert.equal(e.motor, 'auto')
  })
  fijarNeuralParaPruebas(null)
  await conMotor({ motor: 'auto' }, async () => {
    const e = await estadoMotor()
    assert.equal(e.neuralDisponible, false)
    assert.ok(e.motivo)
  })
})

test('carga el modelo neuronal real (modelo diminuto de prueba) y responde sin romper nada', async (t) => {
  const modelo = path.join(process.cwd(), 'node_modules', 'amilcar-ai', 'tests-node', 'fixtures', 'tiny.amw')
  if (!fs.existsSync(modelo)) return t.skip('amilcar-ai instalado sin los archivos de prueba')
  process.env.AMILCAR_AI_NEURAL_MODEL = modelo
  try {
    fijarNeuralParaPruebas(undefined) // fuerza la carga real
    const cargado = await cargarNeural()
    assert.ok(cargado, 'debería cargar el modelo de prueba')
    // Modelo con pesos aleatorios: confianza baja, así que en modo auto debe responder el motor nativo.
    await conMotor({ motor: 'auto', umbralConfianza: 0.9 }, async () => {
      const r = await responder('chat-real', 'hola')
      assert.equal(r.motor, 'native')
      assert.ok(typeof r.neuralConfianza === 'number')
    })
    fijarNeuralParaPruebas(undefined) // conMotor vació el modelo al terminar el bloque anterior
    assert.ok(await cargarNeural())
    await conMotor({ motor: 'neural' }, async () => {
      // Con pesos aleatorios el modelo puede generar texto vacío; entonces el bot usa el motor nativo.
      const r = await responder('chat-real-2', 'hola')
      assert.ok(['neural', 'native'].includes(r.motor))
      assert.ok(typeof r.reply === 'string' && r.reply.trim().length > 0)
      assert.equal(typeof r.neuralConfianza, 'number')
    })
  } finally {
    delete process.env.AMILCAR_AI_NEURAL_MODEL
    fijarNeuralParaPruebas(null)
  }
})

test('las cuentas y la hora siempre las responde el motor exacto, no la red neuronal', async () => {
  const modelo = neuralFalso('texto inventado por la red', 0.99)
  fijarNeuralParaPruebas(modelo)
  await conMotor({ motor: 'auto' }, async () => {
    const cuenta = await responder('chat-exacto', '12 * 12')
    assert.equal(cuenta.motor, 'native')
    assert.match(cuenta.reply, /144/)
    const hora = await responder('chat-exacto', '¿qué hora es?')
    assert.equal(hora.motor, 'native')
    assert.equal(hora.intent, 'local_time')
    assert.equal(modelo.llamadas.length, 0)
  })
})

test("cuando el modelo neuronal dice que no sabe (intent 'unknown') se respeta responderSiNoSabe", async () => {
  const modelo = { modelPath: 'x', chat: async () => ({ reply: 'Todavía no tengo conocimiento suficiente.', confidence: 0.97, model: 'AMI-Base-Neural', intent: 'unknown' }) }
  fijarNeuralParaPruebas(modelo)
  await conMotor({ motor: 'auto', responderSiNoSabe: false }, async () => {
    const sock = crearSock()
    const chat = privado(41)
    const msg = mensaje('cual es la capital de francia', { chat })
    assert.equal(await autoResponder({ sock, msg, chatId: chat, jidRemitente: chat, activa: true }), false)
    assert.equal(sock.enviados.length, 0)
  })
})
