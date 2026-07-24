export const desc = 'Envía un anuncio al grupo etiquetando a todos (solo admins)'
export const alias = ['av', 'announce']
export const cooldown = 15
export const soloAdmin = true

export default async function anuncio({ sock, chatId, args }) {
  if (!chatId.endsWith('@g.us')) {
    return sock.sendMessage(chatId, {
      text: '📌 Este comando solo funciona dentro de un grupo.',
    })
  }

  const texto = args.join(' ')
  if (!texto) {
    return sock.sendMessage(chatId, {
      text: '📌 Uso: .anuncio <mensaje>',
    })
  }

  const metadata = await sock.groupMetadata(chatId)
  const menciones = metadata.participants.map((p) => p.id)

  await sock.sendMessage(chatId, {
    text: `📢 *Anuncio*\n\n${texto}`,
    mentions: menciones,
  })
}
