export const desc = 'Muestra estadísticas del bot'
export const alias = ['estadisticas']
export const cooldown = 5

export default async function stats({ sock, chatId, db, comandos }) {
  const uptimeSeg = process.uptime()
  const horas = Math.floor(uptimeSeg / 3600)
  const minutos = Math.floor((uptimeSeg % 3600) / 60)
  const segundos = Math.floor(uptimeSeg % 60)

  const memoriaMB = (process.memoryUsage().rss / 1024 / 1024).toFixed(1)
  const usuarios = Object.keys(db.data.users || {}).length
  const comandosEjecutados = db.data.stats?.comandosEjecutados || 0

  // Datos medidos por Yui-Bails (si la versión instalada los trae)
  const reales = typeof sock.getStats === 'function' ? sock.getStats() : null
  const salud = typeof sock.health === 'function' ? await sock.health({ ping: false }) : null
  const extra = reales
    ? `
📨 Mensajes recibidos: ${reales.received}
📤 Mensajes enviados: ${reales.sent}${reales.failed ? ` (${reales.failed} con error)` : ''}
🔁 Reconexiones: ${salud?.reconnects ?? 0}
⏳ En cola anti-ban: ${salud?.queueSize ?? 0}`
    : ''

  const texto = `📊 *Estadísticas del bot*

⏱️ Uptime: ${horas}h ${minutos}m ${segundos}s
💾 RAM usada: ${memoriaMB} MB
🧩 Comandos cargados: ${comandos.length}
▶️ Comandos ejecutados: ${comandosEjecutados}
👥 Usuarios registrados: ${usuarios}
🖥️ Node.js: ${process.version}${extra}`

  await sock.sendMessage(chatId, { text: texto })
}
