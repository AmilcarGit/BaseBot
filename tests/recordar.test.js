import test from 'node:test'
import assert from 'node:assert/strict'
import * as yui from 'yui-bails'
import config from '../config.js'
import recordar, { enCuanto, interpretar, leerTiempo } from '../commands/recordar.js'

const CHAT = '120363000000000000@g.us'
const OTRO_CHAT = '51933333333@s.whatsapp.net'
const USUARIO = '51922222222@s.whatsapp.net'

/** Socket mínimo con el programador REAL de Yui-Bails (sin arrancar su temporizador). */
function crearSock() {
  const enviados = []
  const sock = {
    schedule: yui.makeScheduler(async () => {}),
    getSender: async () => ({ jid: USUARIO }),
    sendMessage: async (jid, contenido) => {
      enviados.push({ jid, contenido })
    },
  }
  return { sock, enviados }
}

async function correr(sock, texto, chatId = CHAT) {
  const args = texto.split(/\s+/).filter(Boolean)
  await recordar({ sock, msg: { key: { remoteJid: chatId } }, args, chatId, config })
}

const ultimo = (enviados) => enviados.at(-1).contenido.text

test('leerTiempo entiende s, m, h y d y rechaza lo demás', () => {
  assert.equal(leerTiempo('30s'), 30_000)
  assert.equal(leerTiempo('15M'), 900_000)
  assert.equal(leerTiempo('2h'), 7_200_000)
  assert.equal(leerTiempo('1d'), 86_400_000)
  for (const malo of ['', 'abc', '10', '0m', '-5m', '1.5h']) assert.equal(leerTiempo(malo), undefined, malo)
})

test('enCuanto resume el tiempo que falta', () => {
  assert.equal(enCuanto(10 * 60_000), 'en 10 min')
  assert.equal(enCuanto(1000), 'en 1 min')
  assert.equal(enCuanto(125 * 60_000), 'en 2 h 5 min')
  assert.equal(enCuanto(3 * 86_400_000), 'en 3 días')
})

test('interpretar separa tiempo, texto y subcomandos', () => {
  assert.deepEqual(interpretar(['10m', 'comprar', 'pan']), { accion: 'una', ms: 600_000, tiempo: '10m', texto: 'comprar pan' })
  assert.deepEqual(interpretar(['cada', '2H', 'tomar', 'agua']), { accion: 'cada', ms: 7_200_000, tiempo: '2h', texto: 'tomar agua' })
  assert.deepEqual(interpretar(['lista']), { accion: 'lista' })
  assert.deepEqual(interpretar(['cancelar', 'abc']), { accion: 'cancelar', id: 'abc' })
  for (const mal of [[], ['10m'], ['hola', 'mundo'], ['cada', '10m'], ['cada']]) {
    assert.deepEqual(interpretar(mal), { accion: 'uso' }, mal.join(' '))
  }
})

test('.recordar programa un mensaje que menciona a quien lo pidió', async () => {
  const { sock, enviados } = crearSock()
  await correr(sock, '10m comprar pan')

  const [tarea] = sock.schedule.list()
  assert.equal(tarea.jid, CHAT)
  assert.equal(tarea.kind, 'once')
  assert.deepEqual(tarea.content, { text: '⏰ @51922222222: comprar pan', mentions: [USUARIO] })
  assert.match(ultimo(enviados), /te lo recuerdo en 10 min/)
  assert.ok(ultimo(enviados).includes(tarea.id))
})

test('.recordar cada repite, con mínimo de 1 minuto', async () => {
  const { sock, enviados } = crearSock()
  await correr(sock, 'cada 30s beber')
  assert.equal(sock.schedule.list().length, 0)
  assert.match(ultimo(enviados), /mínimo es 1 minuto/)

  await correr(sock, 'cada 2h beber agua')
  assert.equal(sock.schedule.list()[0].kind, 'every')
  assert.match(ultimo(enviados), /cada 2h/)
})

test('.recordar lista muestra solo los de este chat y cancelar solo borra los suyos', async () => {
  const { sock, enviados } = crearSock()
  await correr(sock, '10m uno')
  await correr(sock, '20m zzqq', OTRO_CHAT)

  await correr(sock, 'lista')
  assert.match(ultimo(enviados), /uno/)
  assert.doesNotMatch(ultimo(enviados), /zzqq/)

  const ajeno = sock.schedule.list().find((t) => t.jid === OTRO_CHAT)
  await correr(sock, `cancelar ${ajeno.id}`)
  assert.match(ultimo(enviados), /No encontré/)
  assert.equal(sock.schedule.list().length, 2)

  const propio = sock.schedule.list().find((t) => t.jid === CHAT)
  await correr(sock, `cancelar ${propio.id}`)
  assert.match(ultimo(enviados), /cancelado/)
  assert.equal(sock.schedule.list().length, 1)

  await correr(sock, 'lista')
  assert.match(ultimo(enviados), /No hay recordatorios/)
})

test('.recordar tiene un tope por chat', async () => {
  const { sock, enviados } = crearSock()
  for (let i = 0; i < 20; i++) await correr(sock, `1h tarea ${i}`)
  await correr(sock, '1h una más')
  assert.equal(sock.schedule.list().length, 20)
  assert.match(ultimo(enviados), /Ya hay 20/)
})

test('.recordar sin argumentos explica cómo se usa, y avisa si la librería es vieja', async () => {
  const { sock, enviados } = crearSock()
  await correr(sock, '')
  assert.match(ultimo(enviados), /\.recordar 10m/)

  const viejo = { sendMessage: async (jid, contenido) => enviados.push({ jid, contenido }) }
  await correr(viejo, '10m algo')
  assert.match(ultimo(enviados), /Yui-Bails 1\.3\.0/)
})
