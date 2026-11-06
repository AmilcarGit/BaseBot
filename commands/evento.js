import { enviar } from '../lib/pruebas.js'

export const desc = 'Envía un evento de calendario (nombre, fecha y lugar)'
export const alias = ['event']
export const categoria = 'prueba'
export const cooldown = 5

export default async function evento({ sock, chatId, msg, args, config }) {
  const nombre = args.join(' ').trim() || `Prueba de ${config.nombreBot}`
  const inicio = new Date(Date.now() + 60 * 60 * 1000) // en 1 hora

  await enviar(
    sock,
    chatId,
    {
      event: {
        name: nombre,
        description: 'Evento de prueba creado con Yui-Bails.',
        startDate: inicio,
        endDate: new Date(inicio.getTime() + 60 * 60 * 1000),
        location: { degreesLatitude: -12.0464, degreesLongitude: -77.0428, name: 'Lima, Perú' },
        extraGuestsAllowed: true,
      },
    },
    msg
  )
}
