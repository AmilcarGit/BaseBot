import { descargarMedia, obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'
import { enviar, pngDegradado } from '../lib/pruebas.js'

export const desc = 'Envía una imagen/video de vista única (o reenvía así el que cites)'
export const alias = ['vo', 'viewonce']
export const categoria = 'prueba'
export const cooldown = 8

export default async function vistaUnica({ sock, chatId, msg, config }) {
  const citado = obtenerMensajeCitado(msg)
  const tipo = citado ? tipoDeMedia(citado) : null

  if (tipo === 'imageMessage' || tipo === 'videoMessage') {
    const buffer = await descargarMedia(citado)
    const clave = tipo === 'imageMessage' ? 'image' : 'video'
    return enviar(sock, chatId, { [clave]: buffer, caption: '👁️ Vista única', viewOnce: true }, msg)
  }

  await enviar(
    sock,
    chatId,
    { image: pngDegradado(), caption: `👁️ Vista única de ${config.nombreBot}\nSolo se puede abrir una vez.`, viewOnce: true },
    msg
  )
}
