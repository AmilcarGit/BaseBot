import { delay } from '../lib/utils.js'

export const desc = 'Envía un mensaje, lo edita dos veces y (con "borrar") lo elimina para todos'
export const alias = ['edit']
export const categoria = 'prueba'
export const cooldown = 10

export default async function editar({ sock, chatId, msg, args }) {
  const enviado = await sock.sendMessage(chatId, { text: '⏳ Mensaje original…' }, { quoted: msg })

  await delay(1500)
  await sock.sendMessage(chatId, { text: '✏️ Primera edición', edit: enviado.key })

  await delay(1500)
  await sock.sendMessage(chatId, { text: '✅ Segunda edición' + (args[0] === 'borrar' ? ' (se borrará en 3 s)' : ''), edit: enviado.key })

  if (args[0] === 'borrar') {
    await delay(3000)
    await sock.sendMessage(chatId, { delete: enviado.key })
  }
}
