import { enviarResultado, yuiapiQuery, yuiapiRequest } from '../lib/yuiapi-client.js'

export const desc = 'Busca videos de YouTube y descarga audio MP3 o video MP4 con botones'
export const alias = ['ytsearch', 'youtube']
export const categoria = 'api'
export const cooldown = 5

const HELP = (p) => `▶️ *YouTube · YuiAPI*
Uso: ${p}yts <nombre del video o artista>
Ejemplo: ${p}yts musica relajante

Después de buscar, abre el desplegable y elige audio o video.`

export default async function yts({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const action = (args[0] || '').toLowerCase()

  try {
    if (action === 'audio' || action === 'video') {
      const id = args[1]
      if (!id || !/^[\w-]{11}$/.test(id)) throw new Error('Selección de video no válida. Vuelve a buscar con ' + p + 'yts.')
      const url = 'https://www.youtube.com/watch?v=' + id
      const type = action === 'audio' ? 'ytaudio' : 'ytvideo'
      const quality = action === 'video' ? '720' : undefined
      await sock.sendMessage(chatId, { text: '⏳ Preparando ' + (action === 'audio' ? 'audio MP3' : 'video MP4') + '…' }, { quoted: msg })
      const result = await yuiapiRequest(yuiapiQuery('/api/v1/download/' + type, { url, quality }))
      return enviarResultado(sock, chatId, result, action === 'audio' ? '🎵 Audio de YouTube' : '🎬 Video de YouTube', msg)
    }

    const query = args.join(' ').trim()
    if (!query) return sock.sendMessage(chatId, { text: HELP(p) }, { quoted: msg })
    const result = await yuiapiRequest(yuiapiQuery('/api/v1/search/youtube', { q: query, limit: 5 }))
    const items = result.data?.results || []
    if (!items.length) return sock.sendMessage(chatId, { text: '🔎 No encontré videos para: ' + query }, { quoted: msg })

    const rows = []
    for (const item of items.slice(0, 5)) {
      if (!item.id) continue
      const title = String(item.title || 'Video').slice(0, 70)
      const id = String(item.id)
      rows.push({
        title: '🎵 Audio · ' + title.slice(0, 55),
        description: [item.channel, item.duration].filter(Boolean).join(' · ').slice(0, 70) || 'Descargar audio',
        id: p + 'yts audio ' + id,
      })
      rows.push({
        title: '🎬 Video · ' + title.slice(0, 55),
        description: 'MP4 · 720p',
        id: p + 'yts video ' + id,
      })
    }

    const lines = items.slice(0, 5).map((item, i) =>
      (i + 1) + '. *' + String(item.title || 'Video').slice(0, 120) + '*\\n' +
      [item.channel, item.duration, item.views].filter(Boolean).join(' · ') + '\\n' +
      (item.url || ('https://youtu.be/' + item.id))
    )

    return sock.sendMessage(chatId, {
      text: '▶️ *Resultados de YouTube*\\nConsulta: ' + query + '\\n\\n' + lines.join('\\n\\n') +
        '\\n\\nToca el desplegable para descargar el audio o el video.',
      footer: 'YuiAPI · YouTube Search',
      buttons: [{
        text: '⬇️ Elegir descarga',
        sections: [{ title: 'Resultados · Audio / Video', rows }],
      }],
    }, { quoted: msg })
  } catch (error) {
    return sock.sendMessage(chatId, { text: '❌ *YTS:* ' + (error?.message || 'No se pudo completar la solicitud.') }, { quoted: msg })
  }
}
