import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import * as yui from 'yui-bails'
import config from '../config.js'
import html, { EJEMPLO } from '../commands/html.js'
import encuestatiempo, { interpretar } from '../commands/encuestatiempo.js'
import respaldo, * as respaldoModulo from '../commands/respaldo.js'
import canal, { textoCanal } from '../commands/canal.js'

const CHAT = '120363000000000000@g.us'
const MSG = { key: { remoteJid: CHAT } }

function crearSock(extra = {}) {
  const enviados = []
  const sock = {
    sendMessage: async (jid, contenido, opciones) => {
      enviados.push({ jid, contenido, opciones })
    },
    ...extra,
  }
  return { sock, enviados }
}

const textos = (enviados) => enviados.map((e) => e.contenido.text)

test('sin Yui-Bails 1.4.2 los comandos avisan en vez de fallar', async () => {
  for (const comando of [html, encuestatiempo, canal]) {
    const { sock, enviados } = crearSock()
    await comando({ sock, chatId: CHAT, msg: MSG, args: ['x'], config })
    assert.match(textos(enviados)[0], /Yui-Bails 1\.4\.2/)
  }
})

test('.html convierte con el sendHtml REAL de Yui-Bails y envía texto normal', async () => {
  const { sock, enviados } = crearSock()
  const extras = yui.makeSendExtras({ sendMessage: (...a) => sock.sendMessage(...a) })
  sock.sendHtml = extras.sendHtml

  await html({ sock, chatId: CHAT, msg: MSG, args: ['<b>Hola</b>', '<i>mundo</i>'], config })
  assert.deepEqual(enviados.at(-1).contenido, { text: '*Hola* _mundo_' })
  assert.equal(enviados.at(-1).opciones.quoted, MSG)
})

test('.html sin texto explica y manda el ejemplo; el ejemplo se convierte bien', async () => {
  const { sock, enviados } = crearSock()
  const extras = yui.makeSendExtras({ sendMessage: (...a) => sock.sendMessage(...a) })
  sock.sendHtml = extras.sendHtml

  await html({ sock, chatId: CHAT, msg: MSG, args: [], config })
  assert.match(enviados[0].contenido.text, /HTML → WhatsApp/)
  const ejemplo = enviados[1].contenido.text
  for (const trozo of ['*Hola*', '*negrita*', '_cursiva_', '~tachado~', '`codigo()`', '- Uno', '1. Primero', '> Una cita', '```\nconst x = 1\n```']) {
    assert.ok(ejemplo.includes(trozo), trozo)
  }
  assert.equal(ejemplo, yui.htmlToWhatsApp(EJEMPLO))
})

test('.html no deja pasar scripts y avisa si no queda texto', async () => {
  const { sock, enviados } = crearSock()
  const extras = yui.makeSendExtras({ sendMessage: (...a) => sock.sendMessage(...a) })
  sock.sendHtml = extras.sendHtml

  await html({ sock, chatId: CHAT, msg: MSG, args: ['<script>alert(1)</script>'], config })
  assert.match(textos(enviados).at(-1), /no tiene texto/)
})

test('encuestatiempo interpreta tiempo, pregunta y opciones', () => {
  assert.deepEqual(interpretar(['10M', '¿Pizza', 'o', 'tacos?', '|', 'Pizza', '|', 'Tacos']), {
    tiempo: '10m',
    ms: 600_000,
    pregunta: '¿Pizza o tacos?',
    opciones: ['Pizza', 'Tacos'],
  })
  assert.equal(interpretar(['10m', 'Pregunta', '|', 'Solo una']), undefined)
  assert.equal(interpretar(['10m', 'Pregunta', '|', 'A', '|', 'A']), undefined)
  assert.equal(interpretar(['xx', 'Pregunta', '|', 'A', '|', 'B']), undefined)
  assert.equal(interpretar(['10m', 'P', ...Array.from({ length: 13 }, (_, i) => `| O${i}`)]), undefined)
})

test('.encuestatiempo envía la encuesta con cierre y avisa cuándo se cierra', async () => {
  const llamadas = []
  const { sock, enviados } = crearSock({
    sendTimedPoll: async (...a) => {
      llamadas.push(a)
      return { closesAt: new Date() }
    },
  })
  await encuestatiempo({ sock, chatId: CHAT, msg: MSG, args: '10m ¿Pizza? | Sí | No'.split(' '), config })

  assert.equal(llamadas.length, 1)
  assert.deepEqual(llamadas[0].slice(0, 4), [CHAT, '¿Pizza?', ['Sí', 'No'], { closeAfter: '10m' }])
  assert.match(textos(enviados).at(-1), /en 10 min/)

  const vacio = crearSock({ sendTimedPoll: async () => assert.fail('no debe enviar') })
  await encuestatiempo({ sock: vacio.sock, chatId: CHAT, msg: MSG, args: [], config })
  assert.match(textos(vacio.enviados)[0], /Encuesta con cierre/)
})

test('.encuestatiempo muestra el error de tiempo fuera de rango de la librería', async () => {
  const { sock, enviados } = crearSock({
    sendTimedPoll: async () => {
      const error = new Error('closeAfter must be between 5 seconds and 24 days')
      error.output = { statusCode: 400 }
      throw error
    },
  })
  await encuestatiempo({ sock, chatId: CHAT, msg: MSG, args: '30d P | A | B'.split(' '), config })
  assert.match(textos(enviados).at(-1), /between 5 seconds and 24 days/)
})

test('.respaldo es solo owner, guarda la copia en disco y NUNCA la manda por el chat', async () => {
  assert.equal(respaldoModulo.soloOwner, true)

  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'basebot-respaldo-'))
  const sesion = path.join(base, 'session')
  fs.mkdirSync(sesion)
  fs.writeFileSync(path.join(sesion, 'creds.json'), '{"secreto":"CLAVE-123"}')
  const cfg = { ...config, sessionFolder: sesion, multisesion: { activa: false }, respaldos: { carpeta: path.join(base, 'out') } }

  const { sock, enviados } = crearSock()
  await respaldo({ sock, chatId: CHAT, msg: MSG, config: cfg })

  assert.equal(enviados.length, 1)
  assert.deepEqual(Object.keys(enviados[0].contenido), ['text'])
  assert.doesNotMatch(enviados[0].contenido.text, /CLAVE-123/)
  assert.match(enviados[0].contenido.text, /Copia creada/)

  const archivos = fs.readdirSync(path.join(base, 'out'))
  assert.equal(archivos.length, 1)
  assert.match(archivos[0], /^sesion-.*\.ysb$/)

  // la copia se puede restaurar
  const destino = path.join(base, 'restaurada')
  await yui.restoreSession(path.join(base, 'out', archivos[0]), destino)
  assert.equal(fs.readFileSync(path.join(destino, 'creds.json'), 'utf8'), '{"secreto":"CLAVE-123"}')
})

test('.respaldo avisa cuando no hay sesión que copiar y copia cada número en multisesión', async () => {
  const base = fs.mkdtempSync(path.join(os.tmpdir(), 'basebot-respaldo-'))
  const vacia = { ...config, sessionFolder: path.join(base, 'no-existe'), multisesion: { activa: false }, respaldos: { carpeta: path.join(base, 'out') } }
  const uno = crearSock()
  await respaldo({ sock: uno.sock, chatId: CHAT, msg: MSG, config: vacia })
  assert.match(textos(uno.enviados)[0], /No se pudo copiar/)

  const carpeta = path.join(base, 'sesiones')
  for (const id of ['a', 'b']) {
    fs.mkdirSync(path.join(carpeta, id), { recursive: true })
    fs.writeFileSync(path.join(carpeta, id, 'creds.json'), '{}')
  }
  const multi = { ...config, multisesion: { activa: true, carpeta }, respaldos: { carpeta: path.join(base, 'out2') } }
  const dos = crearSock()
  await respaldo({ sock: dos.sock, chatId: CHAT, msg: MSG, config: multi })
  assert.deepEqual(fs.readdirSync(path.join(base, 'out2')).map((n) => n.split('-')[0]).sort(), ['a', 'b'])
})

test('nombreRespaldo no deja caracteres raros en el nombre', () => {
  assert.equal(respaldoModulo.nombreRespaldo('sesion', new Date('2026-11-17T22:30:00.123Z')), 'sesion-2026-11-17T22-30-00.ysb')
})

test('.canal usa channelInfo de la librería y da formato a la respuesta', async () => {
  const pedidos = []
  const { sock, enviados } = crearSock({
    channelInfo: async (entrada) => {
      pedidos.push(entrada)
      return { id: '120363012345678901@newsletter', name: 'Yui News', subscribers: 1200, verification: 'VERIFIED', invite: '0029VaABCdef12345', description: 'Novedades' }
    },
  })
  await canal({ sock, chatId: CHAT, msg: MSG, args: ['https://whatsapp.com/channel/0029VaABCdef12345'], config })
  assert.deepEqual(pedidos, ['https://whatsapp.com/channel/0029VaABCdef12345'])
  const texto = textos(enviados)[0]
  for (const trozo of ['*Yui News*', '120363012345678901@newsletter', '1200 seguidores', 'Verificado', '0029VaABCdef12345', 'Novedades']) {
    assert.ok(texto.includes(trozo), trozo)
  }
})

test('.canal maneja canal inexistente, entrada inválida y sin argumentos', async () => {
  const nulo = crearSock({ channelInfo: async () => null })
  await canal({ sock: nulo.sock, chatId: CHAT, msg: MSG, args: ['0029VaABCdef12345'], config })
  assert.match(textos(nulo.enviados)[0], /No encontré/)

  // con el analizador REAL de la librería
  const extras = yui.makeSendExtras({ sendMessage: async () => undefined }, { newsletterMetadata: async () => null })
  const real = crearSock({ channelInfo: extras.channelInfo })
  await canal({ sock: real.sock, chatId: CHAT, msg: MSG, args: ['hola'], config })
  assert.match(textos(real.enviados)[0], /not a WhatsApp channel/)

  await canal({ sock: real.sock, chatId: CHAT, msg: MSG, args: [], config })
  assert.match(textos(real.enviados)[1], /Uso/)
})

test('textoCanal se las arregla con datos incompletos', () => {
  assert.equal(textoCanal({ id: 'x@newsletter' }), '📣 *(sin nombre)*\n🆔 x@newsletter')
  assert.match(textoCanal({ id: 'x', thread_metadata: { name: 'Hilo', description: 'D' } }), /\*Hilo\*[\s\S]*D/)
})
