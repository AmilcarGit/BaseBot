import { enviar } from '../lib/pruebas.js'
import { normalizarJid } from '../lib/utils.js'

export const desc = 'Envía las tarjetas de contacto del owner y del bot'
export const alias = ['contact', 'vcard']
export const categoria = 'prueba'
export const cooldown = 5

function vcard(nombre, numero) {
  return [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `FN:${nombre}`,
    `TEL;type=CELL;type=VOICE;waid=${numero}:+${numero}`,
    'END:VCARD',
  ].join('\n')
}

export default async function contacto({ sock, chatId, msg, config }) {
  const owner = config.owner[0].replace(/\D/g, '')
  const bot = normalizarJid(sock.user?.id || '').split('@')[0]

  const contactos = [{ displayName: 'Owner', vcard: vcard('Owner', owner) }]
  if (bot) contactos.push({ displayName: config.nombreBot, vcard: vcard(config.nombreBot, bot) })

  await enviar(
    sock,
    chatId,
    { contacts: { displayName: `${config.nombreBot} y su owner`, contacts: contactos } },
    msg
  )
}
