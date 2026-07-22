export default async function menu({ sock, chatId, comandos, config }) {
  const fecha = new Date().toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const lista = Object.entries(comandos)
    .map(([nombre, { desc }]) => `▢ ${config.prefijo}${nombre} — ${desc}`)
    .join('\n')

  const texto = `╔══〔 ${config.nombreBot} 〕══╗
║ 🕐 ${fecha}
║ 
${lista
  .split('\n')
  .map((linea) => `║ ${linea}`)
  .join('\n')}
║ 
╚══════════════════╝`

  await sock.sendMessage(chatId, { text: texto })
}
