export const desc = 'Muestra la latencia del bot'
export const alias = ['p']
export const cooldown = 3

export default async function ping({ sock, chatId }) {
  const inicio = Date.now()
  const sent = await sock.sendMessage(chatId, { text: '🏓 Calculando...' })
  const ms = Date.now() - inicio

  await sock.sendMessage(
    chatId,
    { text: `🏓 Pong!\n> Velocidad: ${ms}ms` },
    { quoted: sent }
  )
}
