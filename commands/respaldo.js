import fs from 'node:fs'
import path from 'node:path'
import * as Yui from 'yui-bails'

export const desc = 'Guarda una copia de la sesión en ./respaldos (solo owner). La copia nunca se envía por el chat'
export const alias = ['backup', 'respaldosesion']
export const categoria = 'prueba'
export const cooldown = 30
export const soloOwner = true

/** 'sesion-2026-11-17T22-30-00.ysb' */
export function nombreRespaldo(id = 'sesion', fecha = new Date()) {
  return `${id}-${fecha.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.ysb`
}

/** Carpetas de sesión a copiar: la principal o, en modo multisesión, una por número. */
export function carpetasDeSesion(config) {
  if (!config.multisesion?.activa) return [{ id: 'sesion', dir: config.sessionFolder }]
  const base = config.multisesion.carpeta || './sesiones'
  if (!fs.existsSync(base)) return []
  return fs
    .readdirSync(base, { withFileTypes: true })
    .filter((e) => e.isDirectory())
    .map((e) => ({ id: e.name, dir: path.join(base, e.name) }))
}

const kb = (bytes) => `${Math.max(1, Math.round(bytes / 1024))} KB`

export default async function respaldo({ sock, chatId, msg, config }) {
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  if (typeof Yui.backupSession !== 'function') {
    return responder('⚠️ Esta función necesita Yui-Bails 1.4.2 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails@latest')
  }

  const carpetas = carpetasDeSesion(config)
  if (!carpetas.length) return responder('💾 No encontré ninguna sesión para copiar.')

  const salida = config.respaldos?.carpeta || './respaldos'
  const hechos = []
  const fallos = []
  for (const { id, dir } of carpetas) {
    try {
      const archivo = path.join(salida, nombreRespaldo(id))
      await Yui.backupSession(dir, archivo)
      hechos.push(`▢ ${archivo} (${kb(fs.statSync(archivo).size)})`)
    } catch (err) {
      fallos.push(`▢ ${id}: ${err?.message || err}`)
    }
  }

  const partes = []
  if (hechos.length) partes.push(`💾 *Copia creada*\n${hechos.join('\n')}`)
  if (fallos.length) partes.push(`⚠️ No se pudo copiar:\n${fallos.join('\n')}`)
  if (hechos.length) {
    partes.push(
      '🔐 Contiene las claves de tu cuenta: quien la tenga puede usar tu WhatsApp. No la compartas ni la subas a GitHub.\n' +
        'Para restaurar, con el bot apagado: node restaurar.js <archivo> [carpeta]'
    )
  }
  await responder(partes.join('\n\n'))
}
