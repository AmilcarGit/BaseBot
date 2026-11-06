import { enviar } from '../lib/pruebas.js'

export const desc = 'Envía un enlace con vista previa (título, descripción e imagen)'
export const alias = ['link', 'enlace']
export const categoria = 'prueba'
export const cooldown = 5

export default async function preview({ sock, chatId, msg, args }) {
  const url = args.find((a) => /^https?:\/\//i.test(a)) || 'https://github.com/AmilcarGit/Yui-Bails'
  await enviar(sock, chatId, { text: `🔗 Vista previa de enlace:\n${url}` }, msg)
}
