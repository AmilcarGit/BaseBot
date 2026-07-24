export const desc = 'Muestra este menú de comandos'
export const alias = ['help', 'ayuda']
export const cooldown = 5

export default async function menu({ sock, chatId, comandos, config }) {
  const fecha = new Date().toLocaleString('es-PE', {
    dateStyle: 'short',
    timeStyle: 'short',
  })

  const lista = comandos
    .map((c) => {
      const alias = c.alias.length
        ? ` (${c.alias.map((a) => config.prefijo + a).join(', ')})`
        : ''
      return `▢ ${config.prefijo}${c.nombre}${alias} — ${c.desc}`
    })
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
