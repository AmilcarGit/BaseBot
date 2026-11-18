import * as Yui from 'yui-bails'

export const desc = 'Muestra la info de un canal de WhatsApp: .canal <enlace | código | id@newsletter>'
export const alias = ['channel', 'infocanal']
export const categoria = 'prueba'
export const cooldown = 5

/** Texto con lo que se sabe de un canal (WhatsApp no siempre manda todos los datos). */
export function textoCanal(canal) {
  const nombre = canal.name || canal.thread_metadata?.name || '(sin nombre)'
  const descripcion = canal.description || canal.thread_metadata?.description
  const lineas = [`📣 *${nombre}*`, `🆔 ${canal.id}`]
  if (canal.subscribers !== undefined) lineas.push(`👥 ${canal.subscribers} seguidores`)
  if (canal.verification === 'VERIFIED') lineas.push('✔️ Verificado')
  if (canal.invite) lineas.push(`🔗 https://whatsapp.com/channel/${canal.invite}`)
  if (descripcion) lineas.push('', String(descripcion).slice(0, 500))
  return lineas.join('\n')
}

export default async function canal({ sock, chatId, msg, args, config }) {
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  if (typeof sock.channelInfo !== 'function') {
    return responder('⚠️ Esta función necesita Yui-Bails 1.4.2 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails@latest')
  }

  const entrada = args.join(' ').trim()
  if (!entrada) return responder(`📣 Uso: ${config.prefijo}canal https://whatsapp.com/channel/…`)

  try {
    const info = await sock.channelInfo(entrada)
    if (!info) return responder('📣 No encontré ese canal.')
    await responder(textoCanal(info))
  } catch (err) {
    if (err?.output?.statusCode === 400) return responder(`📣 ${err.message}`)
    throw err
  }
}
