import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yui from 'yui-bails'
import config from '../config.js'
import { obtenerEncuesta } from '../lib/store.js'
import { textoDeMensaje } from '../lib/utils.js'
import { textoResultados } from '../lib/votos.js'
import { duracionEfimera, jidObjetivo, pngDegradado, wavTono } from '../lib/pruebas.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const USUARIO = '51922222222@s.whatsapp.net'
const OTRO = '51933333333@s.whatsapp.net'
const BOT = '51911111111:5@s.whatsapp.net'
const BOT_LIMPIO = '51911111111@s.whatsapp.net'
const PRIVADO = USUARIO
const GRUPO = '120363000000000000@g.us'

// ---------- Utilidades de prueba ----------

const subida = async () => ({ mediaUrl: 'https://mmg.whatsapp.net/v/t62/prueba', directPath: '/v/t62/prueba' })

/** Cambia los medios con URL por una imagen local, para que la validación no necesite red. */
function sanear(contenido) {
  const c = { ...contenido }
  for (const clave of ['image', 'video', 'document', 'audio']) {
    if (c[clave]?.url) c[clave] = clave === 'image' ? pngDegradado(32, 32) : Buffer.from('x')
  }
  return c
}

/** Pasa el contenido por la librería real: lanza si no es un mensaje que WhatsApp aceptaría. */
async function validar(jid, contenido, opciones = {}) {
  const { quoted, statusJidList, backgroundColor, font, broadcast } = opciones || {}
  const m = await yui.generateWAMessage(jid, sanear(contenido), {
    userJid: BOT_LIMPIO,
    upload: subida,
    quoted,
    statusJidList,
    backgroundColor,
    font,
    broadcast,
  })
  assert.ok(m?.key?.id, 'sin id de mensaje')
  assert.ok(m?.message && Object.keys(m.message).length > 0, 'mensaje vacío')
  return m
}

const METADATA = {
  id: GRUPO,
  subject: 'Grupo de prueba',
  desc: 'Descripción de prueba',
  creation: 1700000000,
  announce: false,
  restrict: true,
  memberAddMode: true,
  joinApprovalMode: false,
  ephemeralDuration: 86400,
  participants: [
    { id: USUARIO, admin: 'admin' },
    { id: BOT_LIMPIO, admin: 'admin' },
    { id: OTRO, admin: null },
  ],
}

/** Socket simulado: guarda lo que se envía y las llamadas a la API. */
function crearSock(resultados = {}) {
  const enviados = []
  const llamadas = []
  const oyentes = new Map()
  const base = {
    readMessages: undefined,
    sendPresenceUpdate: undefined,
    presenceSubscribe: undefined,
    chatModify: undefined,
    updateProfileName: undefined,
    updateProfileStatus: undefined,
    updateProfilePicture: undefined,
    removeProfilePicture: undefined,
    updateBlockStatus: undefined,
    groupUpdateSubject: undefined,
    groupUpdateDescription: undefined,
    groupSettingUpdate: undefined,
    groupToggleEphemeral: undefined,
    groupMemberAddMode: undefined,
    groupRequestParticipantsUpdate: undefined,
    groupMetadata: METADATA,
    groupInviteCode: 'ABCD1234',
    groupRevokeInvite: 'NEW5678',
    groupParticipantsUpdate: (jid, jids) => jids.map((j) => ({ status: '200', jid: j })),
    groupRequestParticipantsList: [],
    onWhatsApp: (jid) => [{ exists: true, jid }],
    fetchStatus: [{ id: USUARIO, status: { status: 'Disponible', setAt: new Date() } }],
    profilePictureUrl: 'https://pps.whatsapp.net/foto.jpg',
    getBusinessProfile: { description: 'Tienda', category: 'Retail', website: ['https://tienda.pe'], email: 'a@b.pe', address: 'Lima' },
    fetchPrivacySettings: { readreceipts: 'all', profile: 'contacts', online: 'all' },
    fetchBlocklist: [OTRO],
    ...resultados,
  }

  const sock = {
    user: { id: BOT, name: 'Bot' },
    ev: {
      on: (nombre, fn) => oyentes.set(nombre, [...(oyentes.get(nombre) || []), fn]),
      off: (nombre, fn) => oyentes.set(nombre, (oyentes.get(nombre) || []).filter((f) => f !== fn)),
    },
    async sendMessage(jid, contenido, opciones) {
      enviados.push({ jid, contenido, opciones })
      return { key: { remoteJid: jid, id: `ID${enviados.length}`, fromMe: true }, message: { conversation: 'x' }, messageTimestamp: 1 }
    },
  }
  for (const [nombre, valor] of Object.entries(base)) {
    sock[nombre] = async (...args) => {
      llamadas.push([nombre, ...args])
      const v = typeof valor === 'function' ? valor(...args) : valor
      if (v instanceof Error) throw v
      return v
    }
  }
  return { sock, enviados, llamadas, oyentes }
}

function mensaje(texto, { grupo = false, citado = null, mencionados = [] } = {}) {
  const contextInfo = {}
  if (citado) Object.assign(contextInfo, { stanzaId: 'CITADO1', participant: USUARIO, quotedMessage: citado })
  if (mencionados.length) contextInfo.mentionedJid = mencionados
  return {
    key: { remoteJid: grupo ? GRUPO : PRIVADO, id: 'MSG1', fromMe: false, participant: grupo ? USUARIO : undefined },
    messageTimestamp: 1700000000,
    message: { extendedTextMessage: { text: texto, contextInfo } },
  }
}

const ARCHIVOS = fs.readdirSync(path.join(__dirname, '..', 'commands')).filter((f) => f.endsWith('.js'))
const CATALOGO = await Promise.all(
  ARCHIVOS.map(async (f) => {
    const m = await import(`../commands/${f}`)
    return { nombre: f.replace(/\.js$/, ''), desc: m.desc, alias: m.alias || [], categoria: m.categoria || 'general', soloOwner: !!m.soloOwner, soloAdmin: !!m.soloAdmin }
  })
)

/** Ejecuta un comando con el contexto que le da el handler y valida todo lo que envía. */
async function ejecutar(nombre, texto = '', { grupo = false, citado = null, mencionados = [], resultados = {}, validarEnvios = true } = {}) {
  const mod = await import(`../commands/${nombre}.js`)
  const { sock, enviados, llamadas, oyentes } = crearSock(resultados)
  const msg = mensaje(`.${nombre} ${texto}`.trim(), { grupo, citado, mencionados })
  const args = texto.split(/\s+/).filter(Boolean)

  await mod.default({ sock, msg, args, chatId: msg.key.remoteJid, esDueno: true, comandos: CATALOGO, config, db: {} })

  if (validarEnvios) {
    for (const e of enviados) await validar(e.jid, e.contenido, e.opciones)
  }
  const textos = enviados.map((e) => e.contenido.text || e.contenido.caption || '').join('\n')
  return { enviados, llamadas, oyentes, textos, ultimo: enviados.at(-1)?.contenido, msg }
}

// ---------- Registro de comandos ----------

test('todos los comandos exportan una función y una descripción, sin nombres repetidos', () => {
  const vistos = new Set()
  for (const c of CATALOGO) {
    assert.equal(typeof c.desc, 'string', `${c.nombre}: falta desc`)
    for (const n of [c.nombre, ...c.alias]) {
      assert.ok(!vistos.has(n), `nombre o alias repetido: ${n}`)
      vistos.add(n)
    }
  }
  assert.ok(CATALOGO.filter((c) => c.categoria === 'prueba').length >= 20, 'faltan comandos de prueba')
})

test('los comandos que cambian cosas son solo para owner o admins', () => {
  const peligrosos = ['chat', 'botperfil', 'privacidad', 'historia', 'grupo', 'mencionar']
  for (const nombre of peligrosos) {
    const c = CATALOGO.find((x) => x.nombre === nombre)
    assert.ok(c.soloOwner || c.soloAdmin, `${nombre} debería estar restringido`)
  }
})

// ---------- Utilidades ----------

test('imagen y audio de prueba son archivos válidos', () => {
  const png = pngDegradado()
  assert.deepEqual([...png.subarray(0, 8)], [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  const wav = wavTono(500)
  assert.equal(wav.subarray(0, 4).toString(), 'RIFF')
  assert.equal(wav.subarray(8, 12).toString(), 'WAVE')
})

test('duracionEfimera y jidObjetivo', () => {
  assert.equal(duracionEfimera('24h'), 86400)
  assert.equal(duracionEfimera('OFF'), 0)
  assert.equal(duracionEfimera('1h'), undefined)

  assert.equal(jidObjetivo(mensaje('x', { mencionados: [`${OTRO.split('@')[0]}:3@s.whatsapp.net`] })), OTRO)
  assert.equal(jidObjetivo(mensaje('x'), ['+51', '933333333']), '933333333@s.whatsapp.net') // ignora fragmentos cortos
  assert.equal(jidObjetivo(mensaje('x'), ['51933333333']), OTRO)
  assert.equal(jidObjetivo(mensaje('x', { citado: { conversation: 'hola' } })), USUARIO)
  assert.equal(jidObjetivo(mensaje('x')), null)
})

test('tocar un botón o elegir de una lista llega como texto del comando', () => {
  const envolver = (message) => ({ key: { remoteJid: PRIVADO, id: 'R1' }, message })
  assert.equal(textoDeMensaje(envolver({ buttonsResponseMessage: { selectedButtonId: '.ping' } })), '.ping')
  assert.equal(textoDeMensaje(envolver({ listResponseMessage: { singleSelectReply: { selectedRowId: '.menu' } } })), '.menu')
  assert.equal(
    textoDeMensaje(envolver({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: JSON.stringify({ id: '.id' }) } } })),
    '.id'
  )
  assert.equal(textoDeMensaje(envolver({ interactiveResponseMessage: { nativeFlowResponseMessage: { paramsJson: 'no es json' } } })), '')
  assert.equal(textoDeMensaje(envolver({ conversation: 'hola' })), 'hola')
})

test('el recuento de votos muestra barras y total de votantes', () => {
  const creacion = { pollCreationMessage: { options: [{ optionName: 'A' }, { optionName: 'B' }] } }
  const encuesta = { pregunta: '¿Cuál?', votos: new Map([['u1', ['A']], ['u2', ['A']], ['u3', ['B']]]) }
  const texto = textoResultados(creacion, encuesta)
  assert.match(texto, /Votantes: 3/)
  assert.match(texto, /███████░░░ 2/)
  assert.match(texto, /███░░░░░░░ 1/)
})

// ---------- Mensajes interactivos ----------

test('.pruebas lista los comandos de prueba con un desplegable de máximo 10 filas', async () => {
  const { ultimo, textos } = await ejecutar('pruebas')
  for (const c of CATALOGO.filter((x) => x.categoria === 'prueba')) assert.ok(textos.includes(`.${c.nombre}`), `falta .${c.nombre}`)
  const filas = ultimo.buttons[0].sections[0].rows
  assert.ok(filas.length > 0 && filas.length <= 10)
  assert.ok(filas.every((f) => f.id.startsWith('.') && f.description.length <= 72))
})

test('.botones: nativos, clásico e imagen generan mensajes válidos', async () => {
  const nativos = await ejecutar('botones')
  const tipos = nativos.ultimo.buttons.map((b) => Object.keys(b).filter((k) => k !== 'text')[0])
  assert.deepEqual(tipos, ['id', 'url', 'call', 'copy', 'sections'])

  const clasico = await ejecutar('botones', 'clasico')
  assert.equal(clasico.ultimo.buttonsFormat, 'buttons')

  const imagen = await ejecutar('botones', 'imagen')
  assert.ok(Buffer.isBuffer(imagen.ultimo.image))

  const uso = await ejecutar('botones', 'otra')
  assert.match(uso.textos, /Uso:/)
})

test('.lista: lista clásica en privado y desplegable en grupos', async () => {
  const privado = await ejecutar('lista')
  assert.ok(privado.ultimo.sections.length > 0 && privado.ultimo.buttonText)
  const grupo = await ejecutar('lista', '', { grupo: true })
  assert.ok(grupo.ultimo.buttons[0].sections.length > 0)
})

test('.encuesta: por defecto, personalizada y de varias respuestas', async () => {
  const base = await ejecutar('encuesta')
  assert.equal(base.ultimo.poll.values.length, 4)
  assert.equal(base.ultimo.poll.selectableCount, 1)
  assert.ok(obtenerEncuesta('ID1'), 'la encuesta debe quedar registrada para contar votos')

  const propia = await ejecutar('encuesta', '¿Pizza o hamburguesa? | Pizza | Hamburguesa')
  assert.deepEqual(propia.ultimo.poll.values, ['Pizza', 'Hamburguesa'])

  const multi = await ejecutar('encuesta', 'multi Colores | Rojo | Verde | Azul')
  assert.equal(multi.ultimo.poll.selectableCount, 3)

  const mal = await ejecutar('encuesta', 'Solo una opción | A')
  assert.match(mal.textos, /Uso:/)
})

test('.evento, .ubicacion y .contacto', async () => {
  const evento = await ejecutar('evento', 'Reunión del bot')
  assert.equal(evento.ultimo.event.name, 'Reunión del bot')
  assert.ok(evento.ultimo.event.startDate > new Date())

  const lima = await ejecutar('ubicacion')
  assert.equal(lima.ultimo.location.degreesLatitude, -12.0464)
  const propia = await ejecutar('ubicacion', '40.4168 -3.7038 Madrid')
  assert.equal(propia.ultimo.location.name, 'Madrid')
  const mala = await ejecutar('ubicacion', '999 999')
  assert.match(mala.textos, /Uso:/)

  const contacto = await ejecutar('contacto')
  assert.equal(contacto.ultimo.contacts.contacts.length, 2)
  assert.match(contacto.ultimo.contacts.contacts[1].vcard, /waid=51911111111/)
})

test('.preview envía un enlace', async () => {
  const { ultimo } = await ejecutar('preview', 'https://example.com/pagina')
  assert.match(ultimo.text, /https:\/\/example\.com\/pagina/)
})

// ---------- Reacciones, fijados y reenvíos ----------

test('.reaccion pone y quita reacciones (al mensaje citado si lo hay)', async () => {
  const normal = await ejecutar('reaccion', '🔥')
  assert.equal(normal.ultimo.react.text, '🔥')
  assert.equal(normal.ultimo.react.key.id, 'MSG1')

  const citado = await ejecutar('reaccion', '👍', { citado: { conversation: 'hola' } })
  assert.equal(citado.ultimo.react.key.id, 'CITADO1')

  const quitar = await ejecutar('reaccion', 'quitar')
  assert.equal(quitar.ultimo.react.text, '')
})

test('.fijar fija y desfija mensajes', async () => {
  const dia = await ejecutar('fijar', '24h')
  assert.equal(dia.ultimo.time, 86400)
  assert.equal(dia.ultimo.type, yui.proto.PinInChat.Type.PIN_FOR_ALL)

  const mes = await ejecutar('fijar', '30d', { citado: { conversation: 'hola' } })
  assert.equal(mes.ultimo.pin.id, 'CITADO1')

  const quitar = await ejecutar('fijar', 'quitar')
  assert.equal(quitar.ultimo.type, yui.proto.PinInChat.Type.UNPIN_FOR_ALL)

  const mal = await ejecutar('fijar', '3h')
  assert.match(mal.textos, /Uso:/)
})

test('.reenviar necesita un mensaje citado', async () => {
  const sin = await ejecutar('reenviar')
  assert.match(sin.textos, /Responde a un mensaje/)

  const con = await ejecutar('reenviar', '', { citado: { conversation: 'mensaje original' } })
  assert.equal(con.ultimo.forward.message.conversation, 'mensaje original')
})

// ---------- Medios ----------

test('.medios: imagen, audio y documento; el resto pide un mensaje citado', async () => {
  const imagen = await ejecutar('medios', 'imagen')
  assert.ok(Buffer.isBuffer(imagen.ultimo.image))
  const audio = await ejecutar('medios', 'audio')
  assert.equal(audio.ultimo.mimetype, 'audio/wav')
  const doc = await ejecutar('medios', 'documento')
  assert.equal(doc.ultimo.fileName, 'prueba-yui-bails.txt')

  for (const modo of ['nota', 'gif', 'redondo', 'reenviar']) {
    const r = await ejecutar('medios', modo)
    assert.match(r.textos, /Responde a/, `medios ${modo} sin citado`)
  }
  const uso = await ejecutar('medios')
  assert.match(uso.textos, /Uso de/)
})

test('.vistaunica envía una imagen de una sola vista', async () => {
  const { ultimo } = await ejecutar('vistaunica')
  assert.equal(ultimo.viewOnce, true)
})

// ---------- Grupos ----------

test('.mencionar etiqueta a todos (lista de menciones y mentionAll)', async () => {
  const lista = await ejecutar('mencionar', 'Reunión ya', { grupo: true })
  assert.equal(lista.ultimo.mentions.length, 3)
  const nativo = await ejecutar('mencionar', 'nativo Aviso', { grupo: true })
  assert.equal(nativo.ultimo.mentionAll, true)
  const privado = await ejecutar('mencionar')
  assert.match(privado.textos, /solo funciona en grupos/)
})

test('.grupo: información, enlaces y ajustes', async () => {
  const info = await ejecutar('grupo', 'info', { grupo: true })
  assert.match(info.textos, /Grupo de prueba/)
  assert.match(info.textos, /Miembros: 3 \(admins: 2\)/)

  assert.match((await ejecutar('grupo', 'link', { grupo: true })).textos, /chat\.whatsapp\.com\/ABCD1234/)
  assert.match((await ejecutar('grupo', 'revocar', { grupo: true })).textos, /chat\.whatsapp\.com\/NEW5678/)

  const nombre = await ejecutar('grupo', 'nombre Nuevo nombre', { grupo: true })
  assert.deepEqual(nombre.llamadas.find((l) => l[0] === 'groupUpdateSubject'), ['groupUpdateSubject', GRUPO, 'Nuevo nombre'])
  const desc = await ejecutar('grupo', 'desc Otra descripción', { grupo: true })
  assert.deepEqual(desc.llamadas.find((l) => l[0] === 'groupUpdateDescription'), ['groupUpdateDescription', GRUPO, 'Otra descripción'])

  const ajustes = await ejecutar('grupo', 'ajustes anuncios', { grupo: true })
  assert.deepEqual(ajustes.llamadas.find((l) => l[0] === 'groupSettingUpdate'), ['groupSettingUpdate', GRUPO, 'announcement'])
  const efimero = await ejecutar('grupo', 'efimero 7d', { grupo: true })
  assert.deepEqual(efimero.llamadas.find((l) => l[0] === 'groupToggleEphemeral'), ['groupToggleEphemeral', GRUPO, 604800])
  const modo = await ejecutar('grupo', 'modo todos', { grupo: true })
  assert.deepEqual(modo.llamadas.find((l) => l[0] === 'groupMemberAddMode'), ['groupMemberAddMode', GRUPO, 'all_member_add'])

  assert.match((await ejecutar('grupo', 'ajustes raro', { grupo: true })).textos, /Uso:/)
  assert.match((await ejecutar('grupo', 'ayuda', { grupo: true })).textos, /gestión de grupos/)
  assert.match((await ejecutar('grupo', 'info')).textos, /solo funciona en grupos/)
})

test('.grupo: miembros y solicitudes', async () => {
  const casos = { agregar: 'add', expulsar: 'remove', promover: 'promote', degradar: 'demote' }
  for (const [sub, accion] of Object.entries(casos)) {
    const r = await ejecutar('grupo', `${sub} 51933333333`, { grupo: true })
    assert.deepEqual(r.llamadas.find((l) => l[0] === 'groupParticipantsUpdate'), ['groupParticipantsUpdate', GRUPO, [OTRO], accion])
    assert.deepEqual(r.ultimo.mentions, [OTRO])
  }
  const mencion = await ejecutar('grupo', 'promover', { grupo: true, mencionados: [OTRO] })
  assert.equal(mencion.llamadas.find((l) => l[0] === 'groupParticipantsUpdate')[2][0], OTRO)

  assert.match((await ejecutar('grupo', 'expulsar', { grupo: true })).textos, /Uso:/)
  assert.match((await ejecutar('grupo', 'solicitudes', { grupo: true })).textos, /No hay solicitudes/)
  const pendientes = await ejecutar('grupo', 'solicitudes', { grupo: true, resultados: { groupRequestParticipantsList: [{ jid: OTRO }] } })
  assert.match(pendientes.textos, /Solicitudes pendientes \(1\)/)
  const aprobar = await ejecutar('grupo', 'aprobar 51933333333', { grupo: true })
  assert.deepEqual(aprobar.llamadas.find((l) => l[0] === 'groupRequestParticipantsUpdate'), ['groupRequestParticipantsUpdate', GRUPO, [OTRO], 'approve'])
})

test('.grupo avisa si WhatsApp rechaza la acción (por ejemplo, el bot no es admin)', async () => {
  const r = await ejecutar('grupo', 'ajustes libre', { grupo: true, resultados: { groupSettingUpdate: new Error('forbidden') } })
  assert.match(r.textos, /No se pudo completar \*ajustes\*: forbidden/)
  assert.match(r.textos, /¿El bot es admin/)
})

// ---------- Consultas, chats, perfil y privacidad ----------

test('.consulta: existe, estado, foto y negocio', async () => {
  assert.match((await ejecutar('consulta', 'existe 51999999999')).textos, /\+51999999999 tiene WhatsApp/)
  assert.match((await ejecutar('consulta', 'existe 1')).textos, /Uso:/)
  assert.match((await ejecutar('consulta', 'estado')).textos, /Disponible/)

  const foto = await ejecutar('consulta', 'foto')
  assert.equal(foto.ultimo.image.url, 'https://pps.whatsapp.net/foto.jpg')
  const sinFoto = await ejecutar('consulta', 'foto', { resultados: { profilePictureUrl: new Error('not-authorized') } })
  assert.match(sinFoto.textos, /No tiene foto/)

  const negocio = await ejecutar('consulta', 'negocio 51944444444')
  assert.match(negocio.textos, /Tienda/)
  assert.match(negocio.textos, /Retail/)
  const noNegocio = await ejecutar('consulta', 'negocio 51944444444', { resultados: { getBusinessProfile: undefined } })
  assert.match(noNegocio.textos, /No es una cuenta/)
  assert.match((await ejecutar('consulta')).textos, /consulta/)
})

test('.chat modifica el chat con chatModify', async () => {
  const llamada = async (texto, opts) => (await ejecutar('chat', texto, opts)).llamadas.find((l) => l[0] === 'chatModify')

  assert.deepEqual(await llamada('silenciar 8h'), ['chatModify', { mute: 8 * 60 * 60 * 1000 }, PRIVADO])
  assert.deepEqual(await llamada('silenciar off'), ['chatModify', { mute: null }, PRIVADO])
  assert.deepEqual(await llamada('fijar'), ['chatModify', { pin: true }, PRIVADO])
  assert.deepEqual(await llamada('desfijar'), ['chatModify', { pin: false }, PRIVADO])

  const archivar = await llamada('archivar')
  assert.equal(archivar[1].archive, true)
  assert.equal(archivar[1].lastMessages[0].key.id, 'MSG1')
  assert.equal((await llamada('leido'))[1].markRead, true)
  assert.equal((await llamada('noleido'))[1].markRead, false)

  const estrella = await llamada('estrella', { citado: { conversation: 'hola' } })
  assert.deepEqual(estrella[1].star, { messages: [{ id: 'CITADO1', fromMe: false }], star: true })

  const sinCitar = await ejecutar('chat', 'estrella')
  assert.match(sinCitar.textos, /Responde al mensaje/)
  assert.match((await ejecutar('chat', 'silenciar 3h')).textos, /Uso:/)
  assert.match((await ejecutar('chat')).textos, /modifica este chat/)

  const efimeros = await ejecutar('chat', 'efimeros 7d')
  assert.equal(efimeros.enviados[0].contenido.disappearingMessagesInChat, 604800)
  const apagar = await ejecutar('chat', 'efimeros off')
  assert.equal(apagar.enviados[0].contenido.disappearingMessagesInChat, false)
})

test('.botperfil cambia nombre, estado y foto del bot', async () => {
  const nombre = await ejecutar('botperfil', 'nombre Mi Bot')
  assert.deepEqual(nombre.llamadas.find((l) => l[0] === 'updateProfileName'), ['updateProfileName', 'Mi Bot'])
  const estado = await ejecutar('botperfil', 'estado Hola mundo')
  assert.deepEqual(estado.llamadas.find((l) => l[0] === 'updateProfileStatus'), ['updateProfileStatus', 'Hola mundo'])
  const quitar = await ejecutar('botperfil', 'quitarfoto')
  assert.deepEqual(quitar.llamadas.find((l) => l[0] === 'removeProfilePicture'), ['removeProfilePicture', BOT_LIMPIO])
  assert.match((await ejecutar('botperfil', 'foto')).textos, /Responde a una imagen/)
  assert.match((await ejecutar('botperfil', 'nombre')).textos, /Uso:/)
})

test('.privacidad muestra ajustes y bloquea o desbloquea', async () => {
  assert.match((await ejecutar('privacidad', 'ver')).textos, /readreceipts: \*all\*/)
  assert.match((await ejecutar('privacidad', 'bloqueados')).textos, /Bloqueados: 1/)
  const bloquear = await ejecutar('privacidad', 'bloquear 51933333333')
  assert.deepEqual(bloquear.llamadas.find((l) => l[0] === 'updateBlockStatus'), ['updateBlockStatus', OTRO, 'block'])
  const desbloquear = await ejecutar('privacidad', 'desbloquear 51933333333')
  assert.equal(desbloquear.llamadas.find((l) => l[0] === 'updateBlockStatus')[2], 'unblock')
  assert.match((await ejecutar('privacidad', 'bloquear')).textos, /Uso:/)
})

test('.historia publica estados solo para el owner y el bot', async () => {
  const texto = await ejecutar('historia', 'Hola desde el bot')
  const estado = texto.enviados[0]
  assert.equal(estado.jid, 'status@broadcast')
  assert.equal(estado.opciones.broadcast, true)
  assert.equal(estado.opciones.backgroundColor, '#9d4edd')
  assert.ok(estado.opciones.statusJidList.includes(BOT_LIMPIO))
  assert.ok(estado.opciones.statusJidList.length <= config.owner.length + 1, 'no debe llegar a nadie más')

  const imagen = await ejecutar('historia', 'imagen')
  assert.ok(Buffer.isBuffer(imagen.enviados[0].contenido.image))
  assert.match((await ejecutar('historia')).textos, /Uso:/)
})

// ---------- Comandos con esperas (se ejecutan en paralelo para no alargar la prueba) ----------

test('.editar, .escribiendo, .reaccion ruleta y .consulta presencia', async () => {
  const [editar, escribiendo, ruleta, presencia] = await Promise.all([
    ejecutar('editar', 'borrar'),
    ejecutar('escribiendo'),
    ejecutar('reaccion', 'ruleta'),
    ejecutar('consulta', 'presencia 51933333333'),
  ])

  const [original, ed1, ed2, borrado] = editar.enviados.map((e) => e.contenido)
  assert.match(original.text, /original/)
  assert.equal(ed1.edit.id, 'ID1')
  assert.equal(ed2.edit.id, 'ID1')
  assert.equal(borrado.delete.id, 'ID1')

  assert.deepEqual(
    escribiendo.llamadas.filter((l) => l[0] === 'sendPresenceUpdate').map((l) => l[1]),
    ['composing', 'recording', 'paused']
  )
  assert.equal(escribiendo.llamadas.find((l) => l[0] === 'readMessages')[1][0].id, 'MSG1')

  assert.equal(ruleta.enviados.length, 8)
  assert.equal(ruleta.enviados.at(-1).contenido.react.text, '✅')

  assert.deepEqual(presencia.llamadas.find((l) => l[0] === 'presenceSubscribe'), ['presenceSubscribe', OTRO])
  assert.equal(presencia.oyentes.get('presence.update')?.length ?? 0, 0, 'debe dejar de escuchar al terminar')
  assert.match(presencia.textos, /Sin cambios de presencia/)
})
