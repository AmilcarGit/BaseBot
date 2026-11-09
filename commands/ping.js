export const desc = 'Muestra la latencia real del bot con WhatsApp'
export const alias = ['p']
export const cooldown = 3

export default async function ping({ sock, chatId, msg }) {
  // Con sock.health() la latencia se mide con un ping real a los servidores de WhatsApp.
  // (Medir el tiempo de envío incluiría las pausas de la cola anti-ban y saldría inflado.)
  if (typeof sock.health !== 'function') {
    const inicio = Date.now()
    const enviado = await sock.sendMessage(chatId, { text: '🏓 Calculando...' })
    return sock.sendMessage(chatId, { text: `🏓 Pong!\n> Envío: ${Date.now() - inicio}ms` }, { quoted: enviado })
  }

  const salud = await sock.health()
  const latencia = salud.latencyMs !== undefined ? `${salud.latencyMs} ms` : `no medida (${salud.pingError})`
  await sock.reply(msg, `🏓 Pong!\n> Latencia con WhatsApp: *${latencia}*\n> Conexión: ${salud.state}`)
}
