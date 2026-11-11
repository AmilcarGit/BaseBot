import { contextoDe } from '../lib/pruebas.js'
import { normalizarJid } from '../lib/utils.js'

export const desc = 'Publica un estado que menciona a las personas que etiquetes o a todo el grupo (experimental)'
export const alias = ['statusmention']
export const categoria = 'prueba'
export const cooldown = 30
export const soloOwner = true

const MAX_MENCIONES = 50

export default async function estadomencion({ sock, chatId, msg, args, config }) {
  const p = config.prefijo

  if (typeof sock.sendStatusMention !== 'function') {
    return sock.sendMessage(chatId, {
      text: '⚠️ Esto necesita Yui-Bails 1.4.0 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails',
    })
  }

  const todos = /^todos$/i.test(args[0] || '')
  const texto = (todos ? args.slice(1) : args).join(' ').replace(/@\d+/g, '').trim()
  let menciones = (contextoDe(msg)?.mentionedJid || []).map(normalizarJid)

  if (todos) {
    if (!chatId.endsWith('@g.us')) {
      return sock.sendMessage(chatId, { text: '📣 "todos" solo funciona dentro de un grupo.' }, { quoted: msg })
    }
    const grupo = await sock.groupMetadata(chatId)
    menciones = grupo.participants.map((m) => normalizarJid(m.id))
  }

  menciones = [...new Set(menciones)].slice(0, MAX_MENCIONES)
  if (!texto || !menciones.length) {
    return sock.sendMessage(
      chatId,
      { text: `📣 *Estado con menciones*\nUso: *${p}estadomencion @persona Texto del estado*\nO en un grupo: *${p}estadomencion todos Texto* (hasta ${MAX_MENCIONES} personas).` },
      { quoted: msg }
    )
  }

  await sock.sendStatusMention({ text: texto }, { mentions: menciones, backgroundColor: '#1b5e20' })
  await sock.sendMessage(chatId, { text: `✅ Estado publicado y ${menciones.length} mención(es) enviada(s).` }, { quoted: msg })
}
