import { spawn } from 'child_process'

export const desc = 'Reinicia el bot'
export const cooldown = 0
export const soloOwner = true

/**
 * Si corres el bot con 'node index.js' directo, este comando relanza
 * el proceso automáticamente. Si usas pm2, es mejor usar 'pm2 restart'
 * desde fuera —evita levantar el proceso dos veces a la vez.
 */
export default async function restart({ sock, chatId }) {
  await sock.sendMessage(chatId, { text: '🔄 Reiniciando el bot...' })

  spawn(process.argv[0], process.argv.slice(1), {
    cwd: process.cwd(),
    detached: true,
    stdio: 'inherit',
  }).unref()

  process.exit(0)
}
