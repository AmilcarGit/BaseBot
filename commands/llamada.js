import { enviar } from '../lib/pruebas.js'
import { leerTiempo } from './recordar.js'

export const desc = 'Envía una invitación de llamada programada (experimental): .llamada 30m video Reunión'
export const alias = ['callplan']
export const categoria = 'prueba'
export const cooldown = 5

export default async function llamada({ sock, chatId, msg, args, config }) {
  if (typeof sock.sendScheduledCall !== 'function') {
    return sock.sendMessage(chatId, {
      text: '⚠️ Esto necesita Yui-Bails 1.4.0 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails',
    })
  }

  const resto = [...args]
  const espera = leerTiempo(resto[0])
  if (espera) resto.shift()
  const video = /^video$/i.test(resto[0] || '')
  if (video) resto.shift()

  const titulo = resto.join(' ').trim() || `Llamada de ${config.nombreBot}`
  const inicio = new Date(Date.now() + (espera || 60 * 60 * 1000))

  await enviar(sock, chatId, { scheduledCall: { title: titulo, startDate: inicio, type: video ? 'video' : 'voice' } }, msg)
}
