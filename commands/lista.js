import { enviar } from '../lib/pruebas.js'

export const desc = 'Prueba el mensaje de lista (en grupos usa un desplegable)'
export const alias = ['list']
export const categoria = 'prueba'
export const cooldown = 5

export default async function lista({ sock, chatId, msg, config }) {
  const p = config.prefijo
  const secciones = [
    {
      title: '📤 Mensajes',
      rows: [
        { title: 'Botones', description: 'Botones nativos', id: `${p}botones` },
        { title: 'Encuesta', description: 'Encuesta con recuento de votos', id: `${p}encuesta` },
        { title: 'Ubicación', description: 'Envía una ubicación', id: `${p}ubicacion` },
      ],
    },
    {
      title: '🛠️ Utilidades',
      rows: [
        { title: 'Ping', description: 'Velocidad del bot', id: `${p}ping` },
        { title: 'Menú', description: 'Todos los comandos', id: `${p}menu` },
      ],
    },
  ]

  // Las listas clásicas solo funcionan en chats privados; en grupos se usa el desplegable de los botones.
  if (chatId.endsWith('@g.us')) {
    return enviar(
      sock,
      chatId,
      {
        text: 'Las listas clásicas solo van en privado; en grupos se usa un desplegable.',
        footer: config.nombreBot,
        buttons: [{ text: '📋 Ver opciones', sections: secciones }],
      },
      msg
    )
  }

  return enviar(
    sock,
    chatId,
    {
      text: 'Elige una opción de la lista.',
      title: '📋 Lista de prueba',
      footer: config.nombreBot,
      buttonText: 'Ver opciones',
      sections: secciones,
    },
    msg
  )
}
