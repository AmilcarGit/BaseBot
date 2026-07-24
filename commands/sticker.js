import {
  descargarMedia,
  obtenerMensajeCitado,
  tipoDeMedia,
  enviarSticker,
} from '../lib/media.js'

export const desc = 'Convierte una imagen citada en sticker (requiere .webp)'
export const alias = ['s']
export const cooldown = 8

export default async function sticker({ sock, chatId, msg }) {
  const citado = obtenerMensajeCitado(msg)
  const objetivo = citado || msg
  const tipo = tipoDeMedia(objetivo)

  if (!tipo || !['imageMessage', 'stickerMessage'].includes(tipo)) {
    return sock.sendMessage(chatId, {
      text: '📌 Responde a una imagen (o sticker) con *.sticker*',
    })
  }

  const buffer = await descargarMedia(objetivo)
  await enviarSticker(sock, chatId, buffer)
}
