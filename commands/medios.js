import { descargarMedia, obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'
import { enviar, pngDegradado, wavTono } from '../lib/pruebas.js'

export const desc = 'Prueba los tipos de medios: imagen, audio, nota de voz, documento, gif, video redondo y reenvío'
export const alias = ['media']
export const categoria = 'prueba'
export const cooldown = 8

const USO = (p) => `Uso de *${p}medios*:
▢ *imagen* — imagen generada con pie de foto
▢ *audio* — tono de prueba (WAV; puede no reproducirse en todos los teléfonos)
▢ *documento* — archivo de texto
Respondiendo a un mensaje:
▢ *nota* — audio citado como nota de voz
▢ *gif* — video citado como GIF
▢ *redondo* — video citado como video redondo
▢ *reenviar* — vuelve a enviar la imagen/video/audio citado`

export default async function medios({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const modo = (args[0] || '').toLowerCase()

  if (modo === 'imagen') {
    return enviar(sock, chatId, { image: pngDegradado(), caption: '🖼️ Imagen generada por el bot' }, msg)
  }

  if (modo === 'audio') {
    return enviar(sock, chatId, { audio: wavTono(), mimetype: 'audio/wav' }, msg)
  }

  if (modo === 'documento') {
    return enviar(
      sock,
      chatId,
      {
        document: Buffer.from(`Archivo de prueba de ${config.nombreBot}\nGenerado con Yui-Bails.\n`, 'utf-8'),
        mimetype: 'text/plain',
        fileName: 'prueba-yui-bails.txt',
        caption: '📄 Documento de prueba',
      },
      msg
    )
  }

  if (['nota', 'gif', 'redondo', 'reenviar'].includes(modo)) {
    const citado = obtenerMensajeCitado(msg)
    const tipo = citado ? tipoDeMedia(citado) : null
    const necesita = { nota: 'audioMessage', gif: 'videoMessage', redondo: 'videoMessage' }[modo]

    if (!citado || !tipo || (necesita && tipo !== necesita) || tipo === 'stickerMessage' || tipo === 'documentMessage') {
      const que = { nota: 'un audio', gif: 'un video', redondo: 'un video', reenviar: 'una imagen, video o audio' }[modo]
      return sock.sendMessage(chatId, { text: `📌 Responde a ${que} con *${p}medios ${modo}*` }, { quoted: msg })
    }

    const buffer = await descargarMedia(citado)
    if (modo === 'nota') return enviar(sock, chatId, { audio: buffer, mimetype: 'audio/ogg; codecs=opus', ptt: true }, msg)
    if (modo === 'gif') return enviar(sock, chatId, { video: buffer, gifPlayback: true, caption: '🎞️ GIF' }, msg)
    if (modo === 'redondo') return enviar(sock, chatId, { video: buffer, ptv: true }, msg)

    // reenviar
    const contenido =
      tipo === 'imageMessage'
        ? { image: buffer, caption: '♻️ Reenviado' }
        : tipo === 'videoMessage'
          ? { video: buffer, caption: '♻️ Reenviado' }
          : { audio: buffer, mimetype: citado.message.audioMessage.mimetype || 'audio/mp4' }
    return enviar(sock, chatId, contenido, msg)
  }

  return sock.sendMessage(chatId, { text: USO(p) }, { quoted: msg })
}
