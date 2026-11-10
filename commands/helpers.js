import { obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'
import { pngDegradado } from '../lib/pruebas.js'
import { guardarMensaje, registrarEncuesta } from '../lib/store.js'

export const desc = 'Prueba los helpers de Yui-Bails: getSender, reply, react, botones, lista, encuesta, descarga y cola anti-ban'
export const alias = ['yo']
export const categoria = 'prueba'
export const cooldown = 3

const AYUDA = (p) => `🧰 *${p}helpers* — helpers integrados de Yui-Bails
▢ *yo* — quién eres: número, ID interno y si eres owner (también *${p}yo*)
▢ *reaccion* — sock.react
▢ *botones* · *lista* — sock.sendButtons / sock.sendList
▢ *encuesta* — sock.sendPoll con recuento de votos
▢ *descarga* — responde a una imagen/video/audio: sock.downloadMedia
▢ *cola* — envía 3 mensajes seguidos y mide la cola anti-ban
▢ *carrusel* — tarjetas deslizables con imagen y botones (sock.sendCarousel)
▢ *unavez* — botones que solo cuentan el primer toque (onButton once)
▢ *preguntar* — el bot te pregunta y espera tu respuesta (awaitReply)
▢ *ia* — mensaje con el icono de IA (ai: true)
▢ *confirmar* — pregunta Sí/No con botones y espera tu respuesta (sock.confirm)
▢ *paginas* — lista larga con botones Anterior / Siguiente (sock.paginate)
▢ *menu* — menú con submenús y botón Volver (sock.menu)
▢ *solo* — botón que solo puede tocar un admin (sock.sendGuardedButtons)
▢ *otra* — frase al azar con botón 🔁 para repetir (sock.sendRepeatable)
▢ *entrega* — manda un mensaje y espera a ver si se entrega y se lee (message.status)`

export default async function helpers({ sock, chatId, msg, args, config, esDueno }) {
  const p = config.prefijo
  // ".yo" entra por el alias: sin subcomando se muestra la identidad
  const texto = msg.message?.extendedTextMessage?.text || msg.message?.conversation || ''
  const comando = texto.slice(p.length).trim().split(/\s+/)[0]?.toLowerCase()
  const accion = (comando === 'yo' ? 'yo' : args[0] || 'yo').toLowerCase()

  if (accion === 'yo') {
    const s = await sock.getSender(msg)
    return sock.reply(
      msg,
      [
        '🪪 *Tu identidad*',
        `▢ Número: *${s.number || 'desconocido'}*`,
        `▢ ID interno (LID): *${s.id || 'desconocido'}*`,
        `▢ JID: ${s.jid}`,
        `▢ Chat: ${s.isGroup ? 'grupo' : 'privado'}`,
        `▢ Owner: *${esDueno ? 'sí' : 'no'}* (${msg.key.fromMe ? 'cuenta vinculada al bot' : s.is(config.owner) ? 'coincide con config.owner' : 'no está en config.owner'})`,
      ].join('\n')
    )
  }

  if (accion === 'reaccion') {
    await sock.react(msg, '🔥')
    return sock.reply(msg, '✅ Reaccioné con 🔥 a tu mensaje.')
  }

  if (accion === 'botones') {
    return sock.sendButtons(
      chatId,
      {
        text: '🔘 Enviado con *sock.sendButtons*',
        footer: config.nombreBot,
        buttons: [
          { id: `${p}yo`, text: 'Mi identidad' },
          { text: 'Yui-Bails', url: 'https://github.com/AmilcarGit/Yui-Bails' },
        ],
      },
      { quoted: msg }
    )
  }

  if (accion === 'lista') {
    return sock.sendList(
      chatId,
      {
        text: '📋 Enviado con *sock.sendList*',
        title: 'Helpers',
        buttonText: 'Ver opciones',
        sections: [
          {
            title: 'Pruebas',
            rows: [
              { id: `${p}helpers yo`, title: 'Mi identidad', description: 'getSender' },
              { id: `${p}helpers cola`, title: 'Cola anti-ban', description: 'sendQueue' },
            ],
          },
        ],
      },
      { quoted: msg }
    )
  }

  if (accion === 'encuesta') {
    const enviado = await sock.sendPoll(chatId, '¿Te sirven los helpers?', ['Sí', 'Mucho', 'Más o menos'], {}, { quoted: msg })
    guardarMensaje(enviado)
    registrarEncuesta(enviado.key.id, '¿Te sirven los helpers?')
    return
  }

  if (accion === 'descarga') {
    // sock.downloadMedia(msg, { quoted: true }) baja directamente el medio al que respondes
    const citado = obtenerMensajeCitado(msg)
    const tipo = citado ? tipoDeMedia(citado) : null
    if (!tipo) return sock.reply(msg, `📌 Responde a una imagen, video, audio o sticker con *${p}helpers descarga*`)

    const buffer = await sock.downloadMedia(msg, { quoted: true })
    return sock.reply(msg, `✅ Descargado con *sock.downloadMedia*: ${tipo.replace('Message', '')} de ${(buffer.length / 1024).toFixed(1)} KB`)
  }

  if (accion === 'cola') {
    const inicio = Date.now()
    const envios = [1, 2, 3].map((n) => sock.sendMessage(chatId, { text: `📨 Mensaje ${n}/3` }))
    const enEspera = sock.queue?.size ?? 0
    await Promise.all(envios)
    const segundos = ((Date.now() - inicio) / 1000).toFixed(1)
    const estado = config.antiBan?.activa
      ? `cola *activa* (había ${enEspera} esperando al inicio)`
      : 'cola *desactivada* (config.antiBan.activa = false)'
    return sock.reply(msg, `⏱️ 3 mensajes en ${segundos}s — ${estado}`)
  }

  if (accion === 'carrusel') {
    const colores = [
      ['Turquesa', [0, 229, 255], [0, 80, 140]],
      ['Rosa', [247, 37, 133], [90, 10, 80]],
      ['Violeta', [157, 78, 221], [30, 20, 90]],
    ]
    return sock.sendCarousel(
      chatId,
      {
        text: '🛍️ Enviado con *sock.sendCarousel*',
        footer: config.nombreBot,
        cards: colores.map(([nombre, desde, hasta]) => ({
          image: pngDegradado(320, 180, desde, hasta),
          title: nombre,
          body: `Tarjeta de color ${nombre.toLowerCase()}`,
          buttons: [{ id: `carrusel_${nombre.toLowerCase()}`, text: `Elegir ${nombre}` }],
        })),
      },
      { quoted: msg }
    )
  }

  if (accion === 'unavez') {
    return sock.sendButtons(
      chatId,
      {
        text: '☝️ Toca el botón: solo el *primer* toque cuenta, los demás reciben un aviso.',
        footer: config.nombreBot,
        buttons: [{ id: 'demo_unavez', text: 'Tocar' }],
      },
      { quoted: msg }
    )
  }

  if (accion === 'preguntar') {
    await sock.reply(msg, '✍️ ¿Cómo te llamas? (tienes 30 segundos)')
    const respuesta = await sock.awaitReply(msg, { timeoutMs: 30_000 })
    if (!respuesta) return sock.reply(msg, '⏱️ Se acabó el tiempo.')

    const nombre = respuesta.message?.conversation || respuesta.message?.extendedTextMessage?.text || 'amigo'
    return sock.reply(respuesta, `👋 Mucho gusto, *${nombre}*.`)
  }

  if (accion === 'entrega') {
    const enviado = await sock.sendMessage(chatId, { text: '📬 Mensaje de prueba de entrega' }, { quoted: msg })
    const vistos = new Set()
    const alEstado = ({ key, status }) => {
      if (key.id !== enviado.key.id || vistos.has(status)) return
      vistos.add(status)
      sock.reply(msg, `📬 Estado del mensaje de prueba: *${status}*`).catch(() => {})
    }
    sock.ev.on('message.status', alEstado)
    setTimeout(() => sock.ev.off('message.status', alEstado), 60_000)
    return
  }

  if (['confirmar', 'paginas', 'menu', 'solo', 'otra'].includes(accion) && typeof sock.confirm !== 'function') {
    return sock.reply(msg, '⚠️ Esta prueba necesita Yui-Bails 1.2.0 o más nueva. Actualiza: `npm install yui-bails@npm:@yui-bails/yui-bails`')
  }

  if (accion === 'confirmar') {
    const ok = await sock.confirm(msg, '¿Seguro que quieres continuar? (30 segundos)')
    return sock.reply(msg, ok ? '✅ Confirmado.' : '❌ Cancelado o sin respuesta.')
  }

  if (accion === 'paginas') {
    const elementos = Array.from({ length: 23 }, (_, i) => `Elemento de prueba ${i + 1}`)
    return sock.paginate(msg, elementos, { perPage: 5, title: '📄 *Lista de prueba*', footer: config.nombreBot })
  }

  if (accion === 'menu') {
    return sock.menu(msg, {
      title: `📋 Menú de ${config.nombreBot}`,
      text: 'Elige una categoría:',
      footer: 'Solo tú puedes tocar estas opciones',
      items: [
        {
          title: '🎮 Juegos',
          description: 'Dado y moneda',
          items: [
            { title: '🎲 Dado', run: ({ msg: toque }) => sock.reply(toque, `🎲 Salió el *${1 + Math.floor(Math.random() * 6)}*`) },
            { title: '🪙 Moneda', run: ({ msg: toque }) => sock.reply(toque, `🪙 Salió *${Math.random() < 0.5 ? 'cara' : 'cruz'}*`) },
          ],
        },
        { title: 'ℹ️ Info', description: 'Sobre el bot', text: `🤖 Soy *${config.nombreBot}*, hecho con Yui-Bails.` },
      ],
    })
  }

  if (accion === 'solo') {
    return sock.sendGuardedButtons(
      msg,
      {
        text: '🔒 Este botón solo lo puede tocar un *admin* del grupo (en privado, solo tú).',
        footer: config.nombreBot,
        buttons: [{ id: 'panel_admin', text: 'Abrir panel' }],
        who: 'admins',
        denied: '🚫 Solo los admins pueden usar este botón.',
      },
      ({ msg: toque }) => sock.reply(toque, '✅ Eres admin: aquí iría tu panel.')
    )
  }

  if (accion === 'otra') {
    const frases = ['Hoy es un buen día para programar.', 'Si funciona, no lo toques. 😄', 'Un bug menos, un café más.', 'Commit pequeño, vida tranquila.']
    return sock.sendRepeatable(msg, () => `💬 ${frases[Math.floor(Math.random() * frases.length)]}`, { buttonText: '🔁 Otra frase' })
  }

  if (accion === 'ia') {
    return sock.sendMessage(chatId, { text: '🤖 Este mensaje lleva el icono de IA (ai: true).', ai: true }, { quoted: msg })
  }

  return sock.reply(msg, AYUDA(p))
}
