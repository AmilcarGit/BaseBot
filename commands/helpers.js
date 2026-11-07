import { registrarEncuesta, guardarMensaje } from '../lib/store.js'
import { obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'

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
▢ *cola* — envía 3 mensajes seguidos y mide la cola anti-ban`

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
        `▢ Owner: *${esDueno ? 'sí' : 'no'}* (${s.is(config.owner) ? 'coincide con config.owner' : 'no está en config.owner'})`,
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

  return sock.reply(msg, AYUDA(p))
}
