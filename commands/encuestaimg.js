import { pngDegradado } from '../lib/pruebas.js'
import { guardarMensaje, registrarEncuesta } from '../lib/store.js'

export const desc = 'Encuesta con imágenes: manda las fotos numeradas y luego la encuesta'
export const alias = ['pollimg']
export const categoria = 'prueba'
export const cooldown = 10

const COLORES = [
  [[0, 229, 255], [247, 37, 133]],
  [[255, 183, 77], [233, 30, 99]],
  [[102, 187, 106], [0, 121, 107]],
  [[149, 117, 205], [63, 81, 181]],
]

/** "Gato https://x/gato.jpg" -> { texto: 'Gato', imagen: { url } }. Sin enlace, usa una imagen de colores. */
export function leerOpcion(crudo, posicion) {
  const partes = crudo.trim().split(/\s+/)
  const ultimo = partes.at(-1) || ''
  if (partes.length > 1 && /^https?:\/\/\S+$/i.test(ultimo)) {
    return { texto: partes.slice(0, -1).join(' '), imagen: { url: ultimo } }
  }

  const [desde, hasta] = COLORES[posicion % COLORES.length]
  return { texto: crudo.trim(), imagen: pngDegradado(480, 480, desde, hasta) }
}

export default async function encuestaimg({ sock, chatId, msg, args, config }) {
  const p = config.prefijo

  if (typeof sock.sendImagePoll !== 'function') {
    return sock.sendMessage(chatId, {
      text: '⚠️ Esto necesita Yui-Bails 1.4.0 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails',
    })
  }

  const [pregunta, ...crudas] = args.join(' ').split('|').map((s) => s.trim()).filter(Boolean)
  if (!pregunta || crudas.length < 2 || crudas.length > 10) {
    return sock.sendMessage(
      chatId,
      {
        text: `🖼️ *Encuesta con imágenes*\nUso: *${p}encuestaimg Pregunta | Gato https://…/gato.jpg | Perro https://…/perro.jpg*\nCada opción puede llevar el enlace de su imagen al final (2 a 10 opciones). Sin enlace se usa una imagen de colores.`,
      },
      { quoted: msg }
    )
  }

  const opciones = crudas.map(leerOpcion).map(({ texto, imagen }) => ({ text: texto, image: imagen }))
  const { poll } = await sock.sendImagePoll(chatId, { name: pregunta, options: opciones }, { quoted: msg })
  if (poll) {
    guardarMensaje(poll)
    registrarEncuesta(poll.key.id, pregunta) // el recuento sale solo al votar (ver lib/votos.js)
  }
}
