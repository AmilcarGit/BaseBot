import { enviar, pngDegradado } from '../lib/pruebas.js'

export const desc = 'Prueba los botones nativos: respuesta rápida, URL, llamar, copiar y desplegable'
export const alias = ['btn']
export const categoria = 'prueba'
export const cooldown = 5

const USO = (p) =>
  `Uso:\n▢ *${p}botones* — botones nativos (los 5 tipos)\n▢ *${p}botones clasico* — formato clásico (todos lo ven como texto)\n▢ *${p}botones imagen* — botones con imagen de cabecera`

export default async function botones({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const modo = (args[0] || 'nativos').toLowerCase()
  const dueno = config.owner[0]

  if (modo === 'nativos') {
    return enviar(
      sock,
      chatId,
      {
        text: 'Toca un botón para probar cada tipo.\nLos de respuesta rápida ejecutan un comando.',
        footer: config.nombreBot,
        title: '🔘 Botones nativos',
        buttons: [
          { text: '🏓 Respuesta rápida', id: `${p}ping` },
          { text: '🌐 Abrir web', url: 'https://github.com/AmilcarGit/Yui-Bails' },
          { text: '📞 Llamar al owner', call: dueno },
          { text: '📋 Copiar código', copy: 'YUI-BAILS-2026' },
          {
            text: '📂 Desplegable',
            sections: [
              {
                title: 'Comandos',
                rows: [
                  { title: 'Ping', description: 'Velocidad del bot', id: `${p}ping` },
                  { title: 'Mi ID', description: 'Tu número e ID', id: `${p}id` },
                  { title: 'Menú', description: 'Todos los comandos', id: `${p}menu` },
                ],
              },
            ],
          },
        ],
      },
      msg
    )
  }

  if (modo === 'clasico') {
    return enviar(
      sock,
      chatId,
      {
        text: 'Formato clásico (`buttonsFormat: buttons`).\nSi alguien más toca un botón, su respuesta se ve como texto normal.',
        footer: config.nombreBot,
        buttonsFormat: 'buttons',
        buttons: [
          { text: 'Ping', id: `${p}ping` },
          { text: 'Mi ID', id: `${p}id` },
          { text: 'Stats', id: `${p}stats` },
        ],
      },
      msg
    )
  }

  if (modo === 'imagen') {
    return enviar(
      sock,
      chatId,
      {
        image: pngDegradado(),
        caption: 'Botones con imagen de cabecera (también funciona con video o documento).',
        footer: config.nombreBot,
        buttons: [
          { text: 'Menú', id: `${p}menu` },
          { text: 'Ver el repositorio', url: 'https://github.com/AmilcarGit/Yui-Bails' },
        ],
      },
      msg
    )
  }

  return sock.sendMessage(chatId, { text: USO(p) }, { quoted: msg })
}
