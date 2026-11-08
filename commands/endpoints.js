import { descargarMedia, obtenerMensajeCitado, tipoDeMedia } from '../lib/media.js'
import { enviarResultado, yuiapiQuery, yuiapiRequest } from '../lib/yuiapi-client.js'

export const desc = 'Menú interactivo para probar búsquedas, utilidades, descargas y endpoints de YuiAPI'
export const alias = ['endpoint', 'apis']
export const categoria = 'api'
export const cooldown = 3

const SEARCH_KINDS = [
  'music', 'anime', 'wiki', 'books', 'images', 'shows',
  'characters', 'countries', 'papers', 'ebooks', 'youtube', 'pinterest', 'stickers',
]

const SEARCH_LABELS = {
  music: '🎵 Música',
  anime: '🎌 Anime',
  wiki: '📚 Wikipedia',
  books: '📖 Libros',
  images: '🖼️ Imágenes abiertas',
  shows: '📺 Series',
  characters: '🧬 Personajes',
  countries: '🌎 Países',
  papers: '🔬 Artículos científicos',
  ebooks: '📚 Libros públicos',
  youtube: '▶️ YouTube',
  pinterest: '📌 Pinterest',
  stickers: '🌸 Stickers Giphy',
}

function menuTexto(p) {
  return [
    '🌸 *YuiAPI · Panel de endpoints*',
    'Elige una categoría con los botones o usa los comandos.',
    '',
    '*Búsquedas:* ' + p + 'endpoints search <tipo> <consulta>',
    '*Clima:* ' + p + 'endpoints weather <ciudad>',
    '*Traducir:* ' + p + 'endpoints translate <idioma> <texto>',
    '*Moneda:* ' + p + 'endpoints exchange <origen> <destino> <cantidad>',
    '*Descargar Pinterest:* ' + p + 'endpoints pinterest <URL>',
    '*Sticker:* responde a una imagen/GIF con ' + p + 'endpoints sticker',
    '',
    '*YouTube:* usa ' + p + 'yts <consulta> para buscar y elegir audio o video.',
  ].join('\n')
}

async function enviarMenu(sock, chatId, msg, config, categoria = 'principal') {
  const p = config.prefijo

  if (categoria === 'principal') {
    return sock.sendMessage(chatId, {
      text: menuTexto(p),
      footer: 'BaseBot × YuiAPI',
      buttons: [
        { text: '🔎 Búsquedas', id: p + 'endpoints search' },
        { text: '🧰 Utilidades', id: p + 'endpoints tools' },
        { text: '📦 Multimedia', id: p + 'endpoints media' },
      ],
    }, { quoted: msg })
  }

  if (categoria === 'search' || categoria === 'search2') {
    const kinds = categoria === 'search' ? SEARCH_KINDS.slice(0, 6) : SEARCH_KINDS.slice(6)
    const rows = kinds.map((kind) => ({
      title: SEARCH_LABELS[kind],
      description: 'Prueba el endpoint ' + kind,
      id: p + 'endpoints search ' + kind + ' ' +
        (kind === 'anime' ? 'Naruto' : kind === 'pinterest' ? 'anime' : kind === 'youtube' ? 'musica relajante' : kind === 'stickers' ? 'gatos' : 'Peru'),
    }))
    const buttons = [{
      text: 'Abrir buscadores',
      sections: [{ title: 'Buscadores', rows }],
    }]
    if (categoria === 'search') buttons.push({ text: '➕ Más buscadores', id: p + 'endpoints search2' })
    return sock.sendMessage(chatId, {
      text: '🔎 *Búsquedas disponibles*\nSelecciona una prueba. Para una búsqueda propia usa: ' + p + 'endpoints search <tipo> <texto>',
      footer: 'YuiAPI Search',
      buttons,
    }, { quoted: msg })
  }

  if (categoria === 'tools') {
    return sock.sendMessage(chatId, {
      text: '🧰 *Utilidades YuiAPI*\nPrueba cada endpoint con los botones o escribe tu propio comando.',
      footer: 'YuiAPI Tools',
      buttons: [
        {
          text: 'Herramientas',
          sections: [{
            title: 'Texto y utilidades',
            rows: [
              { title: 'Código QR', description: 'Generar imagen QR', id: p + 'endpoints tool qr BaseBot-YuiAPI' },
              { title: 'Hash SHA-256', description: 'Calcular hash de texto', id: p + 'endpoints tool hash prueba sha256' },
              { title: 'UUID', description: 'Generar identificador', id: p + 'endpoints tool uuid' },
              { title: 'Contraseña', description: 'Generar contraseña segura', id: p + 'endpoints tool password' },
              { title: 'Base64', description: 'Codificar texto', id: p + 'endpoints tool base64 hola' },
              { title: 'JSON', description: 'Validar JSON de ejemplo', id: p + 'endpoints tool json-validate {"ok":true}' },
              { title: 'URL Encode', description: 'Codificar una URL', id: p + 'endpoints tool url-encode hola mundo' },
              { title: 'URL Decode', description: 'Decodificar una URL', id: p + 'endpoints tool url-decode hola%20mundo' },
            ],
          }],
        },
        { text: '🌐 Servicios', id: p + 'endpoints services' },
      ],
    }, { quoted: msg })
  }

  if (categoria === 'services') {
    return sock.sendMessage(chatId, {
      text: '🌐 *Servicios externos*\nClima, traducción y conversión de divisas.',
      footer: 'YuiAPI Utilities',
      buttons: [{
        text: 'Servicios',
        sections: [{
          title: 'Servicios',
          rows: [
            { title: 'Clima · Lima', description: 'Consultar condiciones actuales', id: p + 'endpoints weather Lima' },
            { title: 'Traducir · Hola', description: 'Traducir al inglés', id: p + 'endpoints translate en hola' },
            { title: 'USD a PEN', description: 'Convertir 10 dólares a soles', id: p + 'endpoints exchange USD PEN 10' },
            { title: 'Mi cuenta y cuota', description: 'Consultar plan y solicitudes restantes', id: p + 'endpoints me' },
          ],
        }],
      }],
    }, { quoted: msg })
  }

  return sock.sendMessage(chatId, {
    text: '📦 *Multimedia YuiAPI*\nUsa los botones para iniciar pruebas de búsqueda o descarga.',
    footer: 'YuiAPI Media',
    buttons: [{
      text: 'Pruebas multimedia',
      sections: [{
        title: 'Descargas y stickers',
        rows: [
          { title: 'Buscar YouTube', description: 'Buscar y elegir audio o video', id: p + 'yts musica relajante' },
          { title: 'Buscar Pinterest', description: 'Resultados públicos', id: p + 'endpoints search pinterest fondos anime' },
          { title: 'Buscar stickers', description: 'Buscar stickers en Giphy', id: p + 'endpoints search stickers gatos' },
          { title: 'Descargar Pinterest', description: 'Ver instrucciones para pegar un enlace', id: p + 'endpoints ayuda' },
          { title: 'Convertir imagen a sticker', description: 'Responde a una imagen con el comando', id: p + 'endpoints ayuda' },
          { title: 'Texto a sticker', description: 'Generar un sticker WebP con texto', id: p + 'endpoints sticker-text Hola mundo' },
          { title: 'Quitar fondo', description: 'Responde a una imagen con el comando', id: p + 'endpoints ayuda' },
        ],
      }],
    }],
  }, { quoted: msg })
}

export default async function endpoints({ sock, chatId, msg, args, config }) {
  const [raw = 'menu', ...rest] = args
  const action = raw.toLowerCase()
  const p = config.prefijo
  const text = rest.join(' ').trim()

  try {
    if (['menu', 'ayuda', 'help'].includes(action)) return enviarMenu(sock, chatId, msg, config)
    if (['search', 'busqueda'].includes(action) && !rest.length) return enviarMenu(sock, chatId, msg, config, 'search')
    if (action === 'search2' && !rest.length) return enviarMenu(sock, chatId, msg, config, 'search2')
    if (action === 'tools' && !rest.length) return enviarMenu(sock, chatId, msg, config, 'tools')
    if (action === 'services' && !rest.length) return enviarMenu(sock, chatId, msg, config, 'services')
    if (action === 'media' && !rest.length) return enviarMenu(sock, chatId, msg, config, 'media')

    if (action === 'search' || action === 'buscar') {
      const [kindRaw, ...queryParts] = rest
      const kind = kindRaw?.toLowerCase()
      if (!SEARCH_KINDS.includes(kind)) throw new Error('Tipo no válido. Usa: ' + SEARCH_KINDS.join(', '))
      const query = queryParts.join(' ').trim()
      if (!query) throw new Error('Uso: ' + p + 'endpoints search ' + kind + ' <texto>')
      const route = kind === 'stickers' ? '/api/v1/sticker/search' : '/api/v1/search/' + kind
      const result = await yuiapiRequest(yuiapiQuery(route, { q: query, limit: 5, lang: kind === 'wiki' ? 'es' : undefined }))
      const items = result.data?.results || []
      if (!items.length) return sock.sendMessage(chatId, { text: '🔎 No hay resultados para: ' + query }, { quoted: msg })

      const lines = items.slice(0, 5).map((item, i) => {
        const title = item.title || item.name || item.trackName || 'Resultado ' + (i + 1)
        const details = [item.channel, item.artist, item.creator, item.description, item.year, item.duration].filter(Boolean).join(' · ')
        return (i + 1) + '. *' + String(title).slice(0, 140) + '*\n' +
          String(details).slice(0, 180) + '\n' + (item.url || item.page || '')
      })
      const first = items[0]
      const message = {
        text: '🔎 *YuiAPI · ' + SEARCH_LABELS[kind] + '*\nConsulta: ' + query + '\n\n' + lines.join('\n\n'),
        footer: 'Resultados: ' + items.length,
      }
      if (kind === 'youtube') message.buttons = [
        { text: '▶️ Abrir menú de descargas', id: p + 'yts ' + query },
      ]
      await sock.sendMessage(chatId, message, { quoted: msg })

      const preview = first?.thumbnail || first?.image || first?.cover || first?.webp
      try {
        if (preview && new URL(preview).protocol === 'https:') {
          await sock.sendMessage(chatId, { image: { url: preview }, caption: first.title || 'Vista previa' }).catch(() => {})
        }
      } catch {}
      return
    }

    if (action === 'weather' || action === 'clima') {
      if (!text) throw new Error('Uso: ' + p + 'endpoints weather <ciudad>')
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/weather', { city: text, lang: 'es' }))
      return sock.sendMessage(chatId, {
        text: '🌤️ *Clima · ' + text + '*\n' + JSON.stringify(result.data, null, 2).slice(0, 3000),
      }, { quoted: msg })
    }

    if (action === 'translate' || action === 'traducir') {
      const [to, ...parts] = rest
      const phrase = parts.join(' ').trim()
      if (!to || !phrase) throw new Error('Uso: ' + p + 'endpoints translate <idioma destino> <texto>')
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/translate', { text: phrase, to, from: 'auto' }))
      return sock.sendMessage(chatId, {
        text: '🌐 *Traducción*\n' + JSON.stringify(result.data, null, 2).slice(0, 3000),
      }, { quoted: msg })
    }

    if (action === 'exchange' || action === 'moneda') {
      const [from, to, amount = '1'] = rest
      if (!from || !to) throw new Error('Uso: ' + p + 'endpoints exchange USD PEN 10')
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/exchange', { from, to, amount }))
      return sock.sendMessage(chatId, {
        text: '💱 *Conversión de moneda*\n' + JSON.stringify(result.data, null, 2).slice(0, 2500),
      }, { quoted: msg })
    }

    if (action === 'tool' || action === 'herramienta') {
      const [toolRaw, ...parts] = rest
      const tool = toolRaw?.toLowerCase()
      const value = parts.join(' ')
      if (!tool) throw new Error('Indica la herramienta. Ejemplo: ' + p + 'endpoints tool qr hola')
      const params = tool === 'uuid' ? { count: 2 } :
        tool === 'password' ? { length: 18, symbols: true } :
        tool === 'hash' ? { text: parts.slice(0, -1).join(' '), algo: parts.at(-1) || 'sha256' } :
        tool === 'base64' ? { text: value, mode: 'encode' } : { text: value }
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/tools/' + tool, params))
      return enviarResultado(sock, chatId, result, 'Resultado · ' + tool, msg)
    }

    if (action === 'me') {
      const result = await yuiapiRequest('/api/v1/me')
      return sock.sendMessage(chatId, {
        text: '👤 *Cuenta YuiAPI*\\n' + JSON.stringify(result.data, null, 2).slice(0, 2500),
      }, { quoted: msg })
    }

    if (action === 'sticker-text' || action === 'texto-sticker') {
      if (!text) throw new Error('Uso: ' + p + 'endpoints sticker-text <texto>')
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/sticker/text', {
        text,
        color: 'ff4fa3',
        outline: 'ffffff',
      }))
      return enviarResultado(sock, chatId, result, 'sticker', msg)
    }

    if (action === 'remove-bg' || action === 'quitar-fondo') {
      const quoted = obtenerMensajeCitado(msg)
      if (!quoted) throw new Error('Responde a una imagen con ' + p + 'endpoints remove-bg')
      const type = tipoDeMedia(quoted)
      if (type !== 'imageMessage') throw new Error('Quitar fondo admite imágenes PNG, JPG o WebP.')
      const buffer = await descargarMedia(quoted, sock)
      const result = await yuiapiRequest('/api/v1/sticker/remove-bg?format=webp', {
        method: 'POST',
        headers: { 'content-type': quoted.message[type]?.mimetype || 'image/jpeg' },
        body: buffer,
      })
      return enviarResultado(sock, chatId, result, 'sticker', msg)
    }

    if (action === 'pinterest' || action === 'download') {
      const url = rest.join(' ').trim()
      if (!url) throw new Error('Uso: ' + p + 'endpoints pinterest <URL del Pin>')
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/download/pinterest', { url }))
      return enviarResultado(sock, chatId, result, '📌 Descarga de Pinterest', msg)
    }

    if (action === 'sticker') {
      const quoted = obtenerMensajeCitado(msg)
      if (!quoted) throw new Error('Responde a una imagen o GIF con ' + p + 'endpoints sticker')
      const type = tipoDeMedia(quoted)
      if (!['imageMessage', 'documentMessage'].includes(type)) throw new Error('Responde a una imagen o GIF como archivo.')
      const buffer = await descargarMedia(quoted, sock)
      const result = await yuiapiRequest('/api/v1/sticker', {
        method: 'POST',
        headers: { 'content-type': quoted.message[type]?.mimetype || 'image/jpeg' },
        body: buffer,
      })
      return enviarResultado(sock, chatId, result, 'sticker', msg)
    }

    throw new Error('Subcomando desconocido. Usa ' + p + 'endpoints menu')
  } catch (error) {
    return sock.sendMessage(chatId, {
      text: '❌ *YuiAPI:* ' + (error?.message || 'No se pudo completar la solicitud.'),
    }, { quoted: msg })
  }
}
