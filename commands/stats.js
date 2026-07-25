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

  const texto = `📊 *Estadísticas del bot*

⏱️ Uptime: ${horas}h ${minutos}m ${segundos}s
💾 RAM usada: ${memoriaMB} MB
🧩 Comandos cargados: ${comandos.length}
▶️ Comandos ejecutados: ${comandosEjecutados}
👥 Usuarios registrados: ${usuarios}
🖥️ Node.js: ${process.version}`

  await sock.sendMessage(chatId, { text: texto })
}
