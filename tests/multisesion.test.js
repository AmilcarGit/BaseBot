import test from 'node:test'
import assert from 'node:assert/strict'
import { EventEmitter } from 'node:events'
import config from '../config.js'
import { fijarManager, formatearCodigo, modoMultisesion } from '../lib/multisesion.js'
import sesion from '../commands/sesion.js'
import * as sesionMod from '../commands/sesion.js'

const CHAT = '51910227479@s.whatsapp.net'
const PROPIA = '51911111111:7@s.whatsapp.net'

/** Administrador de sesiones falso, con la misma forma que el de Yui-Bails. */
function crearManager(sesiones = []) {
  const emisor = new EventEmitter()
  const llamadas = []
  return {
    emisor,
    llamadas,
    list: () => sesiones,
    start: async (id, opciones) => {
      llamadas.push(['start', id, opciones])
      if (id === 'falla') throw new Error('boom')
    },
    stop: async (id) => void llamadas.push(['stop', id]),
    logout: async (id) => void llamadas.push(['logout', id]),
    on: (evento, fn) => emisor.on(evento, fn),
    off: (evento, fn) => emisor.off(evento, fn),
  }
}

function crearSock() {
  const enviados = []
  return {
    enviados,
    sock: { user: { id: PROPIA }, sendMessage: async (jid, contenido) => void enviados.push(contenido.text) },
  }
}

async function correr(sock, texto) {
  const args = texto.split(/\s+/).filter(Boolean)
  await sesion({ sock, msg: { key: { remoteJid: CHAT } }, args, chatId: CHAT, config })
}

const SESIONES = [
  { id: 'principal', status: 'open', user: { id: PROPIA }, reconnects: 0 },
  { id: 'ventas', status: 'connecting', user: undefined, reconnects: 1 },
]

test('modoMultisesion: config, --multi o MULTI=1', () => {
  assert.equal(modoMultisesion({}, ['node', 'index.js'], {}), false)
  assert.equal(modoMultisesion({ multisesion: { activa: true } }, [], {}), true)
  assert.equal(modoMultisesion({}, ['node', 'index.js', '--multi'], {}), true)
  assert.equal(modoMultisesion({}, [], { MULTI: '1' }), true)
})

test('formatearCodigo separa el código en dos bloques', () => {
  assert.equal(formatearCodigo('ABCD1234'), 'ABCD-1234')
  assert.equal(formatearCodigo('ABCD-1234'), 'ABCD-1234')
  assert.equal(formatearCodigo(''), '')
})

test('.sesion es solo del owner', () => {
  assert.equal(sesionMod.soloOwner, true)
})

test('.sesion explica cómo activar el modo si está apagado', async () => {
  fijarManager(undefined)
  const { sock, enviados } = crearSock()
  await correr(sock, 'lista')
  assert.match(enviados.at(-1), /--multi/)
})

test('.sesion lista las sesiones y marca la actual', async () => {
  fijarManager(crearManager(SESIONES))
  const { sock, enviados } = crearSock()
  await correr(sock, '')
  assert.match(enviados.at(-1), /principal\* \(esta\)/)
  assert.match(enviados.at(-1), /🟢 conectada — \+51911111111/)
  assert.match(enviados.at(-1), /ventas/)
  assert.match(enviados.at(-1), /🟡 conectando/)
})

test('.sesion agregar crea la sesión con el número y envía el código al chat', async () => {
  const manager = crearManager(SESIONES)
  fijarManager(manager)
  const { sock, enviados } = crearSock()

  await correr(sock, 'agregar soporte +51 900 000 001')
  assert.deepEqual(manager.llamadas[0], ['start', 'soporte', { pairingNumber: '51900000001' }])

  manager.emisor.emit('session.pairing-code', { id: 'otra', code: 'ZZZZ9999' }) // de otra sesión: se ignora
  manager.emisor.emit('session.pairing-code', { id: 'soporte', code: 'ABCD1234' })
  assert.match(enviados.at(-1), /Código para \*soporte\*: \*ABCD-1234\*/)
  assert.equal(enviados.some((t) => t.includes('ZZZZ')), false)

  manager.emisor.emit('session.open', { id: 'soporte' })
  assert.match(enviados.at(-1), /Sesión \*soporte\* conectada/)
  // ya no escucha más
  assert.equal(manager.emisor.listenerCount('session.pairing-code'), 0)
})

test('.sesion agregar valida el id, el número y los repetidos', async () => {
  const manager = crearManager(SESIONES)
  fijarManager(manager)
  const { sock, enviados } = crearSock()

  await correr(sock, 'agregar mal/id 51900000001')
  assert.match(enviados.at(-1), /Uso:/)
  await correr(sock, 'agregar nueva 123')
  assert.match(enviados.at(-1), /Uso:/)
  await correr(sock, 'agregar ventas 51900000001')
  assert.match(enviados.at(-1), /Ya existe/)
  assert.equal(manager.llamadas.length, 0)
})

test('.sesion agregar avisa si falla y deja de escuchar', async () => {
  const manager = crearManager(SESIONES)
  fijarManager(manager)
  const { sock, enviados } = crearSock()

  await correr(sock, 'agregar falla 51900000001')
  assert.match(enviados.at(-1), /No se pudo crear la sesión: boom/)
  assert.equal(manager.emisor.listenerCount('session.pairing-code'), 0)
})

test('.sesion parar, iniciar y quitar (con confirmación), sin tocar la sesión propia', async () => {
  const manager = crearManager(SESIONES)
  fijarManager(manager)
  const { sock, enviados } = crearSock()

  await correr(sock, 'parar ventas')
  await correr(sock, 'iniciar ventas')
  assert.deepEqual(manager.llamadas, [['stop', 'ventas'], ['start', 'ventas', undefined]])

  await correr(sock, 'quitar ventas')
  assert.match(enviados.at(-1), /confirmar/)
  assert.equal(manager.llamadas.some((l) => l[0] === 'logout'), false)

  await correr(sock, 'quitar ventas confirmar')
  assert.deepEqual(manager.llamadas.at(-1), ['logout', 'ventas'])
  assert.match(enviados.at(-1), /eliminada/)

  await correr(sock, 'parar principal')
  await correr(sock, 'quitar principal confirmar')
  assert.match(enviados.at(-1), /desde la que escribes/)
  assert.equal(manager.llamadas.filter((l) => l[1] === 'principal').length, 0)

  await correr(sock, 'parar fantasma')
  assert.match(enviados.at(-1), /No existe la sesión \*fantasma\*/)
})
