import { enviarResultado, yuiapiQuery, yuiapiRequest } from '../lib/yuiapi-client.js'

export const desc = 'Busca contenido de Pinterest y descarga imágenes o videos desde enlaces de Pins'
export const alias = ['pin', 'pindl']
export const categoria = 'api'
export const cooldown = 5

const AYUDA = (p) => `📌 *Pinterest · YuiAPI*

*Buscar contenido*
${p}pinterest buscar fondos anime
${p}pinterest buscar wallpapers 4K

*Descargar un Pin*
${p}pinterest https://www.pinterest.com/pin/...
${p}pinterest descargar https://pin.it/...

También puedes pegar directamente el enlace de Pinterest.`

function esUrlPinterest(value) {
  try {
    const url = new URL(value)
    return ['pinterest.com', 'www.pinterest.com', 'es.pinterest.com', 'id.pinterest.com', 'pin.it', 'www.pin.it'].includes(url.hostname)
      && (url.protocol === 'https:' || url.protocol === 'http:')
  } catch {
    return false
  }
}

async function descargar(sock, chatId, msg, url) {
  if (!esUrlPinterest(url)) throw new Error('Enlace no válido. Envía una URL de Pinterest o pin.it.')
  await sock.sendMessage(chatId, { text: '⏳ Procesando el Pin de Pinterest…' }, { quoted: msg })
  const result = await yuiapiRequest(yuiapiQuery('/api/v1/download/pinterest', { url }))
  return enviarResultado(sock, chatId, result, '📌 Descarga de Pinterest', msg)
}

async function buscar(sock, chatId, msg, query) {
  if (!query) throw new Error('Escribe qué quieres buscar. Ejemplo: .pinterest buscar fondos anime')
  const result = await yuiapiRequest(yuiapiQuery('/api/v1/search/pinterest', { q: query, limit: 5 }))
  const items = result.data?.results || []
  if (!items.length) {
    return sock.sendMessage(chatId, { text: '🔎 No encontré Pins públicos para: ' + query }, { quoted: msg })
  }

  const lines = items.slice(0, 5).map((item, index) => {
    const title = String(item.title || item.name || 'Pin ' + (index + 1)).slice(0, 120)
    const details = [item.description, item.creator].filter(Boolean).join(' · ').slice(0, 160)
    const link = item.url || item.page || ''
    return (index + 1) + '. *' + title + '*\n' + (details ? details + '\n' : '') + link
  })

  const first = items[0]
  const pinUrl = first?.url || first?.page
  const buttons = esUrlPinterest(pinUrl) ? [{
    text: '⬇️ Descargar primer Pin',
    id: (msg.prefix || '.') + 'pinterest descargar ' + pinUrl,
  }] : []

  await sock.sendMessage(chatId, {
    text: '📌 *Resultados de Pinterest*\nConsulta: ' + query + '\n\n' + lines.join('\n\n'),
    footer: 'YuiAPI · Pinterest',
    ...(buttons.length ? { buttons } : {}),
  }, { quoted: msg })

  const preview = first?.thumbnail || first?.image
  if (preview) {
    try {
      if (new URL(preview).protocol === 'https:') {
        await sock.sendMessage(chatId, { image: { url: preview }, caption: first.title || 'Vista previa de Pinterest' })
      }
    } catch {}
  }
}

export default async function pinterest({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const [actionRaw = 'ayuda', ...rest] = args
  const action = actionRaw.toLowerCase()
  const value = rest.join(' ').trim()

  try {
    if (['ayuda', 'help', 'menu'].includes(action)) {
      return sock.sendMessage(chatId, { text: AYUDA(p) }, { quoted: msg })
    }

    if (['buscar', 'search'].includes(action)) {
      return buscar(sock, chatId, msg, value)
    }

    if (['descargar', 'download', 'dl'].includes(action)) {
      return descargar(sock, chatId, msg, value)
    }

    const direct = [actionRaw, ...rest].join(' ').trim()
    if (esUrlPinterest(direct)) return descargar(sock, chatId, msg, direct)

    return buscar(sock, chatId, msg, [actionRaw, ...rest].join(' ').trim())
  } catch (error) {
    return sock.sendMessage(chatId, {
      text: '❌ *Pinterest:* ' + (error?.message || 'No se pudo completar la solicitud.'),
    }, { quoted: msg })
  }
}
