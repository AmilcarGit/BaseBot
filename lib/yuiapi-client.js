import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'

try {
  const env = readFileSync(resolve(process.cwd(), '.env'), 'utf8')
  for (const line of env.split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Z0-9_]+)\s*=\s*(.*?)\s*$/)
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2].replace(/^['"]|['"]$/g, '')
    }
  }
} catch {}

const BASE = (process.env.YUIAPI_BASE_URL || 'https://yuiapi.vercel.app').replace(/\/+$/, '')
const MAX_MEDIA_BYTES = 45 * 1024 * 1024

export async function yuiapiRequest(path, options = {}) {
  const key = process.env.YUIAPI_KEY
  if (!key || key === 'PEGA_AQUI_TU_CLAVE') {
    throw new Error('Falta YUIAPI_KEY en el archivo .env de BaseBot.')
  }

  const response = await fetch(BASE + path, {
    ...options,
    headers: { 'x-api-key': key, ...(options.headers || {}) },
    signal: AbortSignal.timeout(60_000),
  })

  const contentType = response.headers.get('content-type') || 'application/octet-stream'
  if (!response.ok) {
    let message = 'Error HTTP ' + response.status
    try {
      const data = await response.json()
      message = data.error || data.message || message
    } catch {}
    throw new Error(message)
  }

  const remaining = response.headers.get('x-ratelimit-remaining')
  if (contentType.includes('application/json')) {
    return { kind: 'json', data: await response.json(), remaining }
  }

  const declared = Number(response.headers.get('content-length') || 0)
  if (declared > MAX_MEDIA_BYTES) {
    throw new Error('El archivo supera el límite seguro de 45 MB para enviarlo por WhatsApp.')
  }
  const buffer = Buffer.from(await response.arrayBuffer())
  if (!buffer.length) throw new Error('YuiAPI devolvió un archivo vacío.')
  if (buffer.length > MAX_MEDIA_BYTES) {
    throw new Error('El archivo supera el límite seguro de 45 MB para enviarlo por WhatsApp.')
  }

  return {
    kind: 'binary',
    buffer,
    contentType: contentType.split(';')[0].toLowerCase(),
    filename: response.headers.get('x-file-name') || 'resultado',
    remaining,
  }
}

export function yuiapiQuery(path, values = {}) {
  const params = new URLSearchParams()
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== null && String(value) !== '') {
      params.set(key, String(value))
    }
  }
  const suffix = params.toString()
  return path + (suffix ? '?' + suffix : '')
}

export async function enviarResultado(sock, chatId, result, caption = 'Resultado de YuiAPI', quoted) {
  const extra = result.remaining !== null
    ? '\\n📊 Solicitudes restantes: ' + result.remaining
    : ''

  if (result.kind !== 'binary') {
    return sock.sendMessage(chatId, {
      text: '🌸 *YuiAPI*\\n' + JSON.stringify(result.data, null, 2).slice(0, 3500) + extra,
    }, quoted ? { quoted } : undefined)
  }

  const type = result.contentType
  const options = quoted ? { quoted } : undefined
  if (type === 'image/webp' && /sticker/i.test(caption)) {
    return sock.sendMessage(chatId, { sticker: result.buffer }, options)
  }
  if (type.startsWith('image/')) {
    return sock.sendMessage(chatId, { image: result.buffer, caption: caption + extra }, options)
  }
  if (type.startsWith('audio/')) {
    return sock.sendMessage(chatId, {
      audio: result.buffer,
      mimetype: type,
      fileName: result.filename,
      ptt: false,
    }, options)
  }
  if (type.startsWith('video/')) {
    return sock.sendMessage(chatId, {
      video: result.buffer,
      mimetype: type,
      caption: caption + extra,
    }, options)
  }
  return sock.sendMessage(chatId, {
    document: result.buffer,
    mimetype: type,
    fileName: result.filename,
    caption: caption + extra,
  }, options)
}
