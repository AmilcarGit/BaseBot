import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { dirname, resolve } from 'node:path'
import { descargarMedia, obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..')
try {
  const env = readFileSync(resolve(root, '.env'), 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) process.env[match[1]] = match[2].replace(/^['\"]|['\"]$/g, '')
  }
} catch {}

export const desc = 'Prueba todos los endpoints de YuiAPI desde WhatsApp: búsquedas, stickers, imágenes, archivos y herramientas'
export const alias = ['api', 'yapi']
export const categoria = 'api'
export const cooldown = 3

const BASE = (process.env.YUIAPI_BASE_URL || 'https://yuiapi.vercel.app').replace(/\/+$/, '')
const KEY = process.env.YUIAPI_KEY

const AYUDA = (p) => `🌸 *YuiAPI · Integración de BaseBot*

*BÚSQUEDAS*
▢ ${p}yuiapi stickers <texto>
▢ ${p}yuiapi musica <texto>
▢ ${p}yuiapi anime <texto>
▢ ${p}yuiapi wiki <texto>
▢ ${p}yuiapi libros <texto>
▢ ${p}yuiapi imagenes <texto>

*STICKERS E IMÁGENES*
▢ Responde a una imagen/GIF: ${p}yuiapi convertir
▢ Responde a una imagen: ${p}yuiapi resize <ancho> <alto>
▢ Responde a una imagen: ${p}yuiapi compress [calidad]
▢ Responde a una imagen: ${p}yuiapi convert <png|jpeg|webp>
▢ Responde a una imagen: ${p}yuiapi blur [intensidad]

*ARCHIVOS*
▢ Responde a un archivo: ${p}yuiapi info
▢ Responde a un archivo: ${p}yuiapi base64file

*GENERADORES Y TEXTO*
▢ ${p}yuiapi qr <texto>
▢ ${p}yuiapi hash <texto> [md5|sha1|sha256|sha512]
▢ ${p}yuiapi uuid [cantidad]
▢ ${p}yuiapi password [largo]
▢ ${p}yuiapi base64 encode|decode <texto>
▢ ${p}yuiapi json-format <json>
▢ ${p}yuiapi json-validate <json>
▢ ${p}yuiapi url-encode <texto>
▢ ${p}yuiapi url-decode <texto>
▢ ${p}yuiapi me

*Ejemplo:* ${p}yuiapi anime Naruto
*Clave:* configura YUIAPI_KEY en tu archivo .env local.`

function textoSeguro(value, max = 3500) {
  const text = typeof value === 'string' ? value : JSON.stringify(value, null, 2)
  return text.length > max ? text.slice(0, max - 30) + '\n… (respuesta recortada)' : text
}

async function pedir(path, options = {}) {
  const response = await fetch(BASE + path, {
    ...options,
    headers: {
      'x-api-key': KEY,
      ...(options.headers || {}),
    },
    signal: AbortSignal.timeout(25000),
  })

  const contentType = response.headers.get('content-type') || ''
  if (!response.ok) {
    let message = 'Error HTTP ' + response.status
    try {
      const data = await response.json()
      message = data.error || data.message || message
    } catch {}
    throw new Error(message)
  }

  const remaining = response.headers.get('x-ratelimit-remaining')
  if (contentType.startsWith('application/json')) {
    return { kind: 'json', data: await response.json(), remaining }
  }
  return {
    kind: 'binary',
    buffer: Buffer.from(await response.arrayBuffer()),
    contentType,
    filename: response.headers.get('x-file-name') || 'resultado',
    remaining,
  }
}

function query(path, values = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && String(value) !== '') params.set(key, String(value))
  }
  const suffix = params.toString()
  return path + (suffix ? '?' + suffix : '')
}

function resumen(data) {
  const { ok, ...rest } = data && typeof data === 'object' ? data : { result: data }
  return textoSeguro(rest)
}

async function enviarBinario(sock, chatId, result, caption = '') {
  const extra = result.remaining !== null ? '\n📊 Solicitudes restantes hoy: ' + result.remaining : ''
  if (result.contentType === 'image/webp' && caption === 'sticker') {
    await sock.sendMessage(chatId, { sticker: result.buffer })
  } else if (result.contentType.startsWith('image/')) {
    await sock.sendMessage(chatId, { image: result.buffer, caption: (caption === 'sticker' ? '🌸 Sticker convertido' : caption) + extra })
  } else {
    await sock.sendMessage(chatId, {
      document: result.buffer,
      mimetype: result.contentType || 'application/octet-stream',
      fileName: result.filename,
      caption: '📦 Resultado de YuiAPI' + extra,
    })
  }
}

async function buscar(sock, chatId, tipo, termino) {
  if (!termino) throw new Error('Escribe qué quieres buscar. Ejemplo: .yuiapi ' + tipo + ' gato')
  const rutas = {
    stickers: '/api/v1/sticker/search',
    musica: '/api/v1/search/music',
    anime: '/api/v1/search/anime',
    wiki: '/api/v1/search/wiki',
    libros: '/api/v1/search/books',
    imagenes: '/api/v1/search/images',
  }
  const result = await pedir(query(rutas[tipo], { q: termino, limit: tipo === 'stickers' ? 5 : 5, lang: tipo === 'wiki' ? 'es' : undefined }))
  const data = result.data
  const lista = Array.isArray(data.results) ? data.results : []
  if (!lista.length) {
    return sock.sendMessage(chatId, { text: '🔎 No encontré resultados para: ' + termino })
  }

  if (tipo === 'stickers') {
    let enviados = 0
    for (const item of lista.slice(0, 5)) {
      if (!item.webp) continue
      try {
        const image = await fetch(item.webp, { signal: AbortSignal.timeout(10000) })
        if (!image.ok) continue
        const buffer = Buffer.from(await image.arrayBuffer())
        if (!buffer.length || buffer.length > 2 * 1024 * 1024) continue
        await sock.sendMessage(chatId, { sticker: buffer })
        enviados++
      } catch {}
    }
    await sock.sendMessage(chatId, {
      text: `🔎 *Stickers: ${termino}*\nEncontrados: ${lista.length} · Enviados: ${enviados}\nPowered by GIPHY${result.remaining !== null ? '\n📊 Restantes hoy: ' + result.remaining : ''}`,
    })
    return
  }

  const lineas = lista.slice(0, 5).map((item, i) => {
    const titulo = item.title || item.trackName || 'Resultado ' + (i + 1)
    const detalle = [item.artist || item.authors?.join(', ') || item.description || item.genre, item.year || item.firstPublishYear, item.score ? '⭐ ' + item.score : null].filter(Boolean).join(' · ')
    const enlace = item.url || item.page
    return `* ${i + 1}. ${titulo}\n${detalle ? detalle + '\n' : ''}${enlace || ''}`
  })
  await sock.sendMessage(chatId, {
    text: `🔎 *YuiAPI · ${tipo}*\nConsulta: ${termino}\n\n${lineas.join('\n\n')}${result.remaining !== null ? '\n\n📊 Solicitudes restantes hoy: ' + result.remaining : ''}`,
  })

  const visual = lista.find((item) => item.thumbnail || item.image || item.cover)
  const imageUrl = visual?.thumbnail || visual?.image || visual?.cover
  if (imageUrl && tipo !== 'musica') {
    try {
      await sock.sendMessage(chatId, { image: { url: imageUrl }, caption: visual.title || 'Vista previa · YuiAPI' })
    } catch {}
  }
}

async function archivoCitado(msg) {
  const target = obtenerMensajeCitado(msg)
  if (!target) throw new Error('Responde al mensaje que contiene el archivo o imagen.')
  const type = tipoDeMedia(target)
  if (!type) throw new Error('El mensaje citado no contiene un archivo compatible.')
  const buffer = await descargarMedia(target)
  const media = target.message[type] || {}
  return {
    buffer,
    type,
    mimetype: media.mimetype || (type === 'stickerMessage' ? 'image/webp' : 'application/octet-stream'),
    filename: media.fileName || media.title || 'archivo',
  }
}

export default async function yuiapi({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const [accionRaw = 'ayuda', ...rest] = args
  const accion = accionRaw.toLowerCase()
  const texto = rest.join(' ').trim()

  if (!KEY) {
    return sock.sendMessage(chatId, {
      text: '🔑 Falta configurar YUIAPI_KEY. Crea un archivo .env en la carpeta BaseBot y agrega tu clave. No la publiques en GitHub.',
    }, { quoted: msg })
  }

  try {
    if (accion === 'ayuda' || accion === 'help') {
      return sock.sendMessage(chatId, { text: AYUDA(p) }, { quoted: msg })
    }

    if (['stickers', 'musica', 'anime', 'wiki', 'libros', 'imagenes'].includes(accion)) {
      return buscar(sock, chatId, accion, texto)
    }

    if (accion === 'me') {
      const r = await pedir('/api/v1/me')
      return sock.sendMessage(chatId, { text: '👤 *Tu cuenta YuiAPI*\n' + resumen(r.data) + (r.remaining !== null ? '\n\n📊 Restantes hoy: ' + r.remaining : '') }, { quoted: msg })
    }

    if (accion === 'qr') {
      if (!texto) throw new Error('Uso: .yuiapi qr <texto o enlace>')
      const r = await pedir(query('/api/v1/tools/qr', { text: texto }))
      return enviarBinario(sock, chatId, r, 'Código QR generado por YuiAPI')
    }

    if (accion === 'hash') {
      if (!texto) throw new Error('Uso: .yuiapi hash <texto> [algoritmo]')
      const algos = ['md5', 'sha1', 'sha256', 'sha512']
      const algo = algos.includes(rest.at(-1)?.toLowerCase()) ? rest.pop().toLowerCase() : 'sha256'
      const value = rest.join(' ')
      const r = await pedir(query('/api/v1/tools/hash', { text: value, algo }))
      return sock.sendMessage(chatId, { text: '🔐 *Hash ' + algo + '*\n' + resumen(r.data) }, { quoted: msg })
    }

    if (accion === 'uuid' || accion === 'password') {
      const n = Number.parseInt(rest[0] || '', 10)
      const r = await pedir(query('/api/v1/tools/' + accion, accion === 'uuid' ? { count: n || 1 } : { length: n || 20, symbols: true }))
      return sock.sendMessage(chatId, { text: (accion === 'uuid' ? '🆔 *UUID generados*\n' : '🔐 *Contraseña generada*\n') + resumen(r.data) }, { quoted: msg })
    }

    if (accion === 'base64') {
      const [mode, ...parts] = rest
      if (!['encode', 'decode'].includes((mode || '').toLowerCase()) || !parts.length) throw new Error('Uso: .yuiapi base64 encode|decode <texto>')
      const r = await pedir(query('/api/v1/tools/base64', { mode: mode.toLowerCase(), text: parts.join(' ') }))
      return sock.sendMessage(chatId, { text: '🔤 *Base64*\n' + resumen(r.data) }, { quoted: msg })
    }

    if (['json-format', 'json-validate', 'url-encode', 'url-decode'].includes(accion)) {
      if (!texto) throw new Error('Falta el texto que quieres procesar.')
      const r = await pedir(query('/api/v1/tools/' + accion, { text: texto }))
      return sock.sendMessage(chatId, { text: '🧰 *' + accion + '*\n' + resumen(r.data) }, { quoted: msg })
    }

    if (['convertir', 'info', 'base64file', 'resize', 'compress', 'convert', 'blur'].includes(accion)) {
      const file = await archivoCitado(msg)
      let endpoint = ''
      const params = {}
      let sticker = false

      if (accion === 'convertir') {
        if (!['imageMessage', 'stickerMessage', 'documentMessage'].includes(file.type) || (file.type === 'documentMessage' && !file.mimetype.includes('gif'))) throw new Error('Responde a una imagen, sticker WebP o GIF (como archivo) para convertirlo en sticker.')
        endpoint = '/api/v1/sticker'
        sticker = true
      } else if (accion === 'info') {
        endpoint = '/api/v1/tools/file-info'
      } else if (accion === 'base64file') {
        endpoint = '/api/v1/tools/file-base64'
      } else if (accion === 'resize') {
        if (file.type !== 'imageMessage') throw new Error('Resize admite imágenes estáticas PNG, JPG o WebP.')
        params.width = rest[0] || 512
        params.height = rest[1] || 512
        endpoint = '/api/v1/tools/image-resize'
      } else if (accion === 'compress') {
        if (file.type !== 'imageMessage') throw new Error('Compress admite imágenes estáticas PNG, JPG o WebP.')
        params.quality = rest[0] || 75
        endpoint = '/api/v1/tools/image-compress'
      } else if (accion === 'convert') {
        if (file.type !== 'imageMessage') throw new Error('Convert admite imágenes estáticas PNG, JPG o WebP.')
        params.format = rest[0] || 'webp'
        endpoint = '/api/v1/tools/image-convert'
      } else if (accion === 'blur') {
        if (file.type !== 'imageMessage') throw new Error('Blur admite imágenes estáticas PNG, JPG o WebP.')
        params.sigma = rest[0] || 5
        endpoint = '/api/v1/tools/image-blur'
      }

      const r = await pedir(query(endpoint, params), {
        method: 'POST',
        headers: {
          'content-type': file.mimetype,
          'x-file-name': file.filename,
        },
        body: file.buffer,
      })

      if (r.kind === 'binary') {
        return enviarBinario(sock, chatId, r, sticker ? 'sticker' : 'Resultado procesado por YuiAPI')
      }
      if (accion === 'base64file' && r.data.base64) {
        return sock.sendMessage(chatId, {
          document: Buffer.from(r.data.base64, 'utf8'),
          mimetype: 'text/plain',
          fileName: file.filename + '.base64.txt',
          caption: '📄 Base64 completo del archivo · ' + r.data.bytes + ' bytes',
        }, { quoted: msg })
      }
      return sock.sendMessage(chatId, { text: '📦 *Resultado del archivo*\n' + resumen(r.data) }, { quoted: msg })
    }

    throw new Error('Subcomando no reconocido. Escribe ' + p + 'yuiapi ayuda')
  } catch (error) {
    return sock.sendMessage(chatId, {
      text: '❌ *YuiAPI:* ' + (error?.message || 'No se pudo completar la solicitud.'),
    }, { quoted: msg })
  }
}
