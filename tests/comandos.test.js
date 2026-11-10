import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import * as yui from 'yui-bails'
import config from '../config.js'
import { obtenerEncuesta } from '../lib/store.js'
import { esOwner, identidadesDe, resolverIdentidades, textoDeMensaje } from '../lib/utils.js'
import { esAdminGrupo } from '../lib/groupPermissions.js'
import { registrarRespuestas } from '../lib/respuestas.js'
import { textoResultados, textoVotos, procesarVotos } from '../lib/votos.js'
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
    // helpers de Yui-Bails: el mismo contrato que los reales, apoyados en sendMessage
    async getSender(m) {
      return yui.getSenderIds(m, sock.user)
    },
    reply: (m, contenido, opciones) =>
      sock.sendMessage(m.key.remoteJid, typeof contenido === 'string' ? { text: contenido } : contenido, { quoted: m, ...opciones }),
    react: (m, emoji) => sock.sendMessage(m.key.remoteJid, { react: { text: emoji, key: m.key } }),
    sendButtons: (jid, { buttons, ...resto }, opciones) => sock.sendMessage(jid, { ...resto, buttons }, opciones),
    sendList: (jid, { sections, ...resto }, opciones) =>
      sock.sendMessage(
        jid,
        {
          buttonText: 'Ver opciones',
          ...resto,
          sections: sections.map((sec) => ({ ...sec, rows: sec.rows.map(({ id, ...fila }) => ({ ...fila, rowId: id ?? fila.title })) })),
        },
        opciones
      ),
    sendPoll: (jid, name, values, poll = {}, opciones) =>
      sock.sendMessage(jid, { poll: { name, values, selectableCount: 1, ...poll } }, opciones),
    sendCarousel: (jid, { cards, ...resto }, opciones) => sock.sendMessage(jid, { ...resto, carousel: cards }, opciones),
    confirm: async (m, texto) => {
      await sock.sendMessage(m.key.remoteJid, { text: texto, buttons: [{ id: 'y', text: '✅ Sí' }, { id: 'n', text: '❌ No' }] }, { quoted: m })
      return true
    },
    paginate: (m, items, { perPage = 5, title = '' } = {}) =>
      sock.sendMessage(m.key.remoteJid, { text: `${title}\n${items.slice(0, perPage).join('\n')}`, footer: `Página 1 de ${Math.ceil(items.length / perPage)}` }, { quoted: m }),
    menu: (m, { items, text }) =>
      sock.sendMessage(m.key.remoteJid, { text, buttons: [{ text: 'Ver opciones', sections: [{ rows: items.map((i) => ({ title: i.title })) }] }] }, { quoted: m }),
    sendGuardedButtons: (m, { who, ...resto }) => sock.sendMessage(m.key.remoteJid, { ...resto, who }, { quoted: m }),
    sendRepeatable: async (m, fuente) => sock.sendMessage(m.key.remoteJid, { text: typeof fuente === 'function' ? await fuente() : fuente }, { quoted: m }),
    awaitReply: async () => ({ key: { remoteJid: GRUPO, id: 'R1' }, message: { conversation: 'Amilcar' } }),
    health: async () => ({ state: 'open', latencyMs: 87, reconnects: 1, queueSize: 0, pingError: undefined }),
    getStats: () => ({ sent: 5, received: 9, failed: 1 }),
    getAdmins: async () => [
      { id: '269715926691844@lid', phoneNumber: '51910227479@s.whatsapp.net', admin: 'superadmin' },
      { id: '999000111@lid', admin: 'admin' },
    ],
    isAdmin: async () => true,
    isBotAdmin: async () => false,
    downloadMedia: async () => Buffer.alloc(2048),
    queue: { size: 0, clear: () => 0 },
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

test('el owner se reconoce por número o por ID interno (@lid)', async () => {
  const LID = '269715926691844@lid'
  const owner = ['51900000000']

  // chat privado: el remitente llega como @lid y su número en remoteJidAlt
  const privado = { key: { remoteJid: LID, remoteJidAlt: '51900000000@s.whatsapp.net', id: 'A1' } }
  assert.deepEqual(identidadesDe(privado), [LID, '51900000000@s.whatsapp.net'])
  assert.equal(esOwner(identidadesDe(privado), owner), true)

  // grupo: participant es el @lid y participantAlt el número (el grupo no cuenta como identidad)
  const grupo = { key: { remoteJid: GRUPO, participant: LID, participantAlt: '51900000000@s.whatsapp.net', id: 'A2' } }
  assert.deepEqual(identidadesDe(grupo), [LID, '51900000000@s.whatsapp.net'])
  assert.equal(esOwner(identidadesDe(grupo), owner), true)

  // sin número disponible: sirve poner el ID interno en config.owner
  const soloLid = { key: { remoteJid: LID, id: 'A3' } }
  assert.equal(esOwner(identidadesDe(soloLid), owner), false)
  assert.equal(esOwner(identidadesDe(soloLid), ['269715926691844']), true)
  assert.equal(esOwner('51900000000:7@s.whatsapp.net', owner), true) // acepta un solo jid, con sufijo de dispositivo
  assert.equal(esOwner(identidadesDe({ key: { remoteJid: OTRO } }), owner), false)

  // si Yui-Bails conoce la equivalencia @lid -> número, también se usa
  const sock = { signalRepository: { lidMapping: { getPNForLID: async () => '51900000000:2@s.whatsapp.net' } } }
  const resueltas = await resolverIdentidades(sock, soloLid)
  assert.equal(esOwner(resueltas, owner), true)
  assert.deepEqual(await resolverIdentidades({}, soloLid), [LID]) // sin mapeo disponible no falla
})

test('los admins de un grupo se reconocen por número o por ID interno', async () => {
  const LID = '269715926691844@lid'
  const { sock } = crearSock({
    groupMetadata: { ...METADATA, participants: [{ id: LID, lid: LID, phoneNumber: USUARIO, admin: 'admin' }, { id: OTRO, admin: null }] },
  })
  const GRUPO_ADMIN = '120363111111111111@g.us' // grupo distinto para no usar el caché de otras pruebas
  assert.equal(await esAdminGrupo(sock, GRUPO_ADMIN, [LID]), true)
  assert.equal(await esAdminGrupo(sock, GRUPO_ADMIN, [USUARIO]), true, 'por su número')
  assert.equal(await esAdminGrupo(sock, GRUPO_ADMIN, [OTRO]), false)
  assert.equal(await esAdminGrupo(sock, PRIVADO, [LID]), false)
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

test('.endpoints: menús de YuiAPI generan botones nativos válidos', async () => {
  const principal = await ejecutar('endpoints')
  assert.equal(principal.ultimo.buttons.length, 3)

  const busquedas = await ejecutar('endpoints', 'search')
  assert.ok(busquedas.ultimo.buttons[0].sections[0].rows.length <= 10)

  const masBusquedas = await ejecutar('endpoints', 'search2')
  assert.ok(masBusquedas.ultimo.buttons[0].sections[0].rows.length <= 10)

  const herramientas = await ejecutar('endpoints', 'tools')
  assert.ok(herramientas.ultimo.buttons.length <= 3)

  const servicios = await ejecutar('endpoints', 'services')
  assert.equal(servicios.ultimo.buttons[0].sections[0].rows.length, 4)

  const multimedia = await ejecutar('endpoints', 'media')
  assert.ok(multimedia.ultimo.buttons[0].sections[0].rows.length >= 5)
})

test('.yts muestra instrucciones antes de realizar una búsqueda', async () => {
  const ayuda = await ejecutar('yts')
  assert.match(ayuda.textos, /YouTube/)
  assert.match(ayuda.textos, /audio o video/)
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

// ---------- Helpers de Yui-Bails ----------

test('.helpers yo: muestra número, ID interno y si es owner', async () => {
  const { textos } = await ejecutar('helpers', 'yo')
  assert.match(textos, /Número: \*51922222222\*/)
  assert.match(textos, /Owner: \*sí\*/) // el arnés de pruebas ejecuta como owner

  const porDefecto = await ejecutar('helpers') // sin subcomando (como `.yo`) muestra la identidad
  assert.match(porDefecto.textos, /Tu identidad/)
})

test('.helpers: reaccion, botones, lista, encuesta y descarga', async () => {
  const r = await ejecutar('helpers', 'reaccion')
  assert.equal(r.enviados[0].contenido.react.text, '🔥')

  const b = await ejecutar('helpers', 'botones')
  assert.equal(b.ultimo.buttons.length, 2)

  const l = await ejecutar('helpers', 'lista')
  assert.equal(l.ultimo.sections[0].rows.length, 2)

  const e = await ejecutar('helpers', 'encuesta')
  assert.equal(e.ultimo.poll.values.length, 3)
  assert.ok(obtenerEncuesta('ID1'))

  const sin = await ejecutar('helpers', 'descarga')
  assert.match(sin.textos, /Responde a una imagen/)

  const con = await ejecutar('helpers', 'descarga', { citado: { imageMessage: { mimetype: 'image/png' } } })
  assert.match(con.textos, /2\.0 KB/)
})

test('.helpers cola y ayuda', async () => {
  const cola = await ejecutar('helpers', 'cola')
  assert.match(cola.textos, /3 mensajes/)
  const ayuda = await ejecutar('helpers', 'zzz')
  assert.match(ayuda.textos, /helpers integrados/)
})

test('el recuento por evento poll.votes cuenta cada votante una vez', async () => {
  const votes = [
    { name: 'A', voters: ['u1', 'u2'] },
    { name: 'B', voters: ['u3'] },
  ]
  const texto = textoVotos('¿Cuál?', votes)
  assert.match(texto, /Votantes: 3/)
  assert.match(texto, /███████░░░ 2/)

  const { sock, enviados } = crearSock()
  await procesarVotos(sock, { pollKey: { remoteJid: GRUPO, id: 'NO_REGISTRADA' }, pollName: 'x', votes })
  assert.equal(enviados.length, 0, 'solo cuenta encuestas creadas por el bot')
})

test('el número vinculado al bot se reconoce con su propia cuenta, no con el chat', async () => {
  const sock = { user: { id: BOT, lid: '999888777:5@lid' } }
  const propio = { key: { remoteJid: OTRO, fromMe: true, id: 'X1' } } // escrito por el bot en el chat de OTRO
  const ids = await resolverIdentidades(sock, propio)
  assert.deepEqual(ids, [BOT_LIMPIO, '999888777@lid'])
  assert.equal(esOwner(ids, ['51911111111']), true)
  assert.equal(esOwner(ids, ['51933333333']), false, 'no hereda la identidad del otro chat')
})

test('.helpers carrusel: tarjetas con imagen y botones que WhatsApp acepta', async () => {
  const { ultimo } = await ejecutar('helpers', 'carrusel')
  assert.equal(ultimo.carousel.length, 3)
  assert.ok(ultimo.carousel.every((c) => c.image && c.buttons.length === 1))
})

test('.helpers unavez, preguntar e ia', async () => {
  const unavez = await ejecutar('helpers', 'unavez')
  assert.equal(unavez.ultimo.buttons[0].id, 'demo_unavez')

  const preguntar = await ejecutar('helpers', 'preguntar')
  assert.match(preguntar.textos, /¿Cómo te llamas\?/)
  assert.match(preguntar.textos, /Mucho gusto, \*Amilcar\*/)

  const ia = await ejecutar('helpers', 'ia')
  assert.equal(ia.ultimo.ai, true)
})

test('.helpers confirmar, paginas, menu, solo y otra', async () => {
  const confirmar = await ejecutar('helpers', 'confirmar')
  assert.match(confirmar.textos, /¿Seguro que quieres continuar\?/)
  assert.match(confirmar.textos, /Confirmado/)

  const paginas = await ejecutar('helpers', 'paginas')
  assert.match(paginas.textos, /Elemento de prueba 1/)
  assert.match(paginas.ultimo.footer, /Página 1 de 5/)

  const menu = await ejecutar('helpers', 'menu')
  assert.deepEqual(menu.ultimo.buttons[0].sections[0].rows.map((r) => r.title), ['🎮 Juegos', 'ℹ️ Info'])

  const solo = await ejecutar('helpers', 'solo')
  assert.equal(solo.ultimo.who, 'admins')
  assert.equal(solo.ultimo.buttons[0].id, 'panel_admin')

  const otra = await ejecutar('helpers', 'otra')
  assert.match(otra.textos, /💬 /)
})

test('registrarRespuestas registra los botones y no falla con una librería vieja', () => {
  const registros = []
  registrarRespuestas({ onButton: (matcher, fn, opciones) => registros.push({ matcher, fn, opciones }), reply: async () => {} })
  assert.equal(registros.length, 2)
  assert.equal(registros[0].matcher, 'demo_unavez')
  assert.equal(registros[0].opciones.once, true)
  assert.ok(registros[1].matcher.test('carrusel_rosa'))

  registrarRespuestas({}) // sin onButton: no hace nada
})

test('.ping muestra la latencia real medida por sock.health, y .admins lista admins con números y LID', async () => {
  const ping = await ejecutar('ping')
  assert.match(ping.textos, /Latencia con WhatsApp: \*87 ms\*/)

  const admins = await ejecutar('admins', '', { grupo: true })
  assert.match(admins.textos, /Admins del grupo\* \(2\)/)
  assert.match(admins.textos, /@51910227479 👑/)
  assert.match(admins.textos, /Tú: \*admin\*/)
  assert.match(admins.textos, /El bot: \*miembro\*/)
  assert.deepEqual(admins.enviados[0].contenido.mentions, ['51910227479@s.whatsapp.net', '999000111@lid'])

  const privado = await ejecutar('admins')
  assert.match(privado.textos, /solo funciona en grupos/)
})

test('.stats agrega los contadores reales de la librería', async () => {
  const { sock, enviados } = crearSock()
  const mod = await import('../commands/stats.js')
  await mod.default({ sock, chatId: GRUPO, db: { data: { users: {}, stats: {} } }, comandos: CATALOGO })
  assert.match(enviados[0].contenido.text, /Mensajes recibidos: 9/)
  assert.match(enviados[0].contenido.text, /Mensajes enviados: 5 \(1 con error\)/)
  assert.match(enviados[0].contenido.text, /Reconexiones: 1/)
})
