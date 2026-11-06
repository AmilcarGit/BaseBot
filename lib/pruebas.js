import zlib from 'node:zlib'
import { contenidoMensaje, normalizarJid } from './utils.js'
import { guardarMensaje } from './store.js'

// ---------- Generadores de archivos de prueba (sin dependencias) ----------

const TABLA_CRC = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = TABLA_CRC[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunkPng(tipo, datos) {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'ascii'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** PNG con un degradado diagonal. Sirve como imagen de prueba sin archivos externos. */
export function pngDegradado(ancho = 640, alto = 360, desde = [0, 229, 255], hasta = [247, 37, 133]) {
  const bytesFila = 1 + ancho * 3
  const crudo = Buffer.alloc(bytesFila * alto)
  for (let y = 0; y < alto; y++) {
    const o = y * bytesFila // el primer byte de cada fila es el filtro (0 = ninguno)
    for (let x = 0; x < ancho; x++) {
      const t = (x / (ancho - 1) + y / (alto - 1)) / 2
      for (let c = 0; c < 3; c++) {
        crudo[o + 1 + x * 3 + c] = Math.round(desde[c] + (hasta[c] - desde[c]) * t)
      }
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(ancho, 0)
  ihdr.writeUInt32BE(alto, 4)
  ihdr[8] = 8 // 8 bits por canal
  ihdr[9] = 2 // RGB
  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunkPng('IHDR', ihdr),
    chunkPng('IDAT', zlib.deflateSync(crudo)),
    chunkPng('IEND', Buffer.alloc(0)),
  ])
}

/** WAV (PCM 16 bits, mono) con un tono. Sirve como audio de prueba. */
export function wavTono(ms = 1500, hz = 440, tasa = 16000) {
  const muestras = Math.floor((tasa * ms) / 1000)
  const datos = Buffer.alloc(muestras * 2)
  for (let i = 0; i < muestras; i++) {
    const envolvente = Math.min(1, i / 800, (muestras - i) / 800) // evita el "clic" al inicio y al final
    const valor = Math.sin((2 * Math.PI * hz * i) / tasa) * 0.4 * 32767 * envolvente
    datos.writeInt16LE(Math.round(valor), i * 2)
  }
  const cabecera = Buffer.alloc(44)
  cabecera.write('RIFF', 0)
  cabecera.writeUInt32LE(36 + datos.length, 4)
  cabecera.write('WAVEfmt ', 8)
  cabecera.writeUInt32LE(16, 16)
  cabecera.writeUInt16LE(1, 20) // PCM
  cabecera.writeUInt16LE(1, 22) // mono
  cabecera.writeUInt32LE(tasa, 24)
  cabecera.writeUInt32LE(tasa * 2, 28)
  cabecera.writeUInt16LE(2, 32)
  cabecera.writeUInt16LE(16, 34)
  cabecera.write('data', 36)
  cabecera.writeUInt32LE(datos.length, 40)
  return Buffer.concat([cabecera, datos])
}

// ---------- Utilidades para los comandos ----------

/** contextInfo del mensaje (menciones, mensaje citado), o null. */
export function contextoDe(msg) {
  return contenidoMensaje(msg)?.extendedTextMessage?.contextInfo || null
}

/** Devuelve el JID al que apunta el comando: mención, número escrito o autor del mensaje citado. */
export function jidObjetivo(msg, args = []) {
  const ctx = contextoDe(msg)
  const mencionado = ctx?.mentionedJid?.[0]
  if (mencionado) return normalizarJid(mencionado)

  const numero = args.map((a) => String(a).replace(/\D/g, '')).find((n) => n.length >= 7)
  if (numero) return `${numero}@s.whatsapp.net`

  if (ctx?.participant) return normalizarJid(ctx.participant)
  return null
}

/** Envía citando el mensaje del usuario y guarda lo enviado en el almacén. */
export async function enviar(sock, chatId, contenido, msg) {
  const enviado = await sock.sendMessage(chatId, contenido, msg ? { quoted: msg } : undefined)
  guardarMensaje(enviado)
  return enviado
}

export function recortar(texto = '', max = 72) {
  const t = String(texto)
  return t.length > max ? `${t.slice(0, max - 1)}…` : t
}

/** "24h" | "7d" | "90d" | "off" -> segundos (0 = desactivar). undefined si no es válido. */
export function duracionEfimera(valor = '') {
  const mapa = { off: 0, no: 0, '24h': 86400, '7d': 604800, '90d': 7776000 }
  return mapa[String(valor).toLowerCase()]
}
