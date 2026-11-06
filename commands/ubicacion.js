import { enviar } from '../lib/pruebas.js'

export const desc = 'Envía una ubicación (por defecto Lima; o ".ubicacion lat lon nombre")'
export const alias = ['location', 'loc']
export const categoria = 'prueba'
export const cooldown = 5

export default async function ubicacion({ sock, chatId, msg, args }) {
  let lat = -12.0464
  let lon = -77.0428
  let nombre = 'Lima, Perú'

  if (args.length >= 2) {
    const a = Number(args[0])
    const b = Number(args[1])
    if (!Number.isFinite(a) || !Number.isFinite(b) || Math.abs(a) > 90 || Math.abs(b) > 180) {
      return sock.sendMessage(
        chatId,
        { text: 'Uso: *.ubicacion* o *.ubicacion -12.04 -77.03 Nombre del lugar*' },
        { quoted: msg }
      )
    }
    lat = a
    lon = b
    nombre = args.slice(2).join(' ') || 'Ubicación de prueba'
  }

  await enviar(
    sock,
    chatId,
    { location: { degreesLatitude: lat, degreesLongitude: lon, name: nombre, address: `${lat}, ${lon}` } },
    msg
  )
}
