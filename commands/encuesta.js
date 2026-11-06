import { enviar } from '../lib/pruebas.js'
import { registrarEncuesta } from '../lib/store.js'

export const desc = 'Crea una encuesta y muestra el recuento al votar (descifra los votos)'
export const alias = ['poll']
export const categoria = 'prueba'
export const cooldown = 5

const POR_DEFECTO = {
  pregunta: '¿Qué función de Yui-Bails te gusta más?',
  opciones: ['Botones', 'Listas', 'Encuestas', 'Ediciones'],
}

export default async function encuesta({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  let texto = args.join(' ').trim()

  // ".encuesta multi ..." permite elegir varias opciones
  const multiple = /^multi\b/i.test(texto)
  if (multiple) texto = texto.replace(/^multi\b/i, '').trim()

  let [pregunta, ...opciones] = texto.split('|').map((s) => s.trim()).filter(Boolean)
  if (!pregunta) {
    pregunta = POR_DEFECTO.pregunta
    opciones = POR_DEFECTO.opciones
  }

  if (opciones.length < 2 || opciones.length > 12) {
    return sock.sendMessage(
      chatId,
      {
        text: `Uso: *${p}encuesta* o *${p}encuesta Pregunta | Opción 1 | Opción 2*\nAñade *multi* al inicio para permitir varias respuestas (2 a 12 opciones).`,
      },
      { quoted: msg }
    )
  }

  const enviado = await enviar(
    sock,
    chatId,
    {
      poll: {
        name: pregunta,
        values: opciones,
        selectableCount: multiple ? opciones.length : 1,
      },
    },
    msg
  )

  // Se registra para mostrar el recuento cuando lleguen votos (ver lib/votos.js)
  registrarEncuesta(enviado.key.id, pregunta)
}
