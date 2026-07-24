import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import config from './config.js'
import { esOwner, normalizarJid } from './lib/utils.js'
import { esAdminGrupo } from './lib/groupPermissions.js'
import { getDB } from './lib/db.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const commandsDir = path.join(__dirname, 'commands')

// comandos: lookup por nombre Y alias -> misma entrada (para el enrutador)
// listaComandos: solo entradas únicas, en orden -> para mostrar en .menu
const comandos = {}
const listaComandos = []
const cooldowns = new Map()

/**
 * Carga automáticamente todos los archivos de commands/*.js.
 * Cada comando puede exportar, además del 'export default':
 *   export const desc = 'Descripción corta'
 *   export const alias = ['otronombre']
 *   export const cooldown = 5        // segundos, 0 = sin cooldown
 *   export const soloOwner = true    // solo el owner puede usarlo
 *   export const soloAdmin = true    // solo admins del grupo (o el owner)
 */
async function cargarComandos() {
  const archivos = fs
    .readdirSync(commandsDir)
    .filter((f) => f.endsWith('.js'))

  for (const archivo of archivos) {
    const nombre = archivo.replace(/\.js$/, '')
    const mod = await import(`./commands/${archivo}`)

    const entrada = {
      nombre,
      run: mod.default,
      desc: mod.desc || 'Sin descripción',
      alias: mod.alias || [],
      cooldown: mod.cooldown ?? 3,
      soloOwner: mod.soloOwner || false,
      soloAdmin: mod.soloAdmin || false,
    }

    comandos[nombre] = entrada
    for (const a of entrada.alias) comandos[a] = entrada
    listaComandos.push(entrada)
  }

  console.log(`✔ ${listaComandos.length} comandos cargados desde /commands`)
}

await cargarComandos()

async function notificarErrorAlOwner(sock, err, comando) {
  try {
    const ownerJid = `${config.owner[0]}@s.whatsapp.net`
    await sock.sendMessage(ownerJid, {
      text: `⚠️ Error ejecutando *.${comando}*:\n\n${err?.stack || err?.message || err}`,
    })
  } catch {
    // Si ni siquiera se le puede avisar al owner, lo dejamos solo en consola.
  }
}

export default async function handler(sock, m) {
  const msg = m.messages?.[0]
  if (!msg?.message || msg.key.fromMe) return

  const jidRemitente = msg.key.participant || msg.key.remoteJid
  const chatId = msg.key.remoteJid

  // Tracking simple en base de datos: cuenta mensajes por usuario.
  // Sirve como ejemplo de persistencia (ver commands/perfil.js).
  try {
    const db = await getDB()
    const jidNormalizado = normalizarJid(jidRemitente)
    db.data.users[jidNormalizado] ??= { mensajes: 0 }
    db.data.users[jidNormalizado].mensajes++
    await db.write()
  } catch (err) {
    console.error('Error guardando en la base de datos:', err)
  }

  const texto =
    msg.message.conversation ||
    msg.message.extendedTextMessage?.text ||
    msg.message.imageMessage?.caption ||
    ''

  // Log de todo mensaje entrante (aunque no sea comando), útil para depurar.
  const tipoMensaje = Object.keys(msg.message)[0]
  const esGrupo = chatId.endsWith('@g.us')
  console.log(
    chalk.cyan(esGrupo ? '👥 Grupo' : '👤 Privado'),
    chalk.gray(`${jidRemitente.split('@')[0]}:`),
    texto || chalk.dim(`[${tipoMensaje}]`)
  )

  if (!texto.startsWith(config.prefijo)) return

  const [comandoRaw, ...args] = texto
    .slice(config.prefijo.length)
    .trim()
    .split(/\s+/)
  const comando = comandoRaw?.toLowerCase()

  const entrada = comando && comandos[comando]
  if (!entrada) return

  const esDueno = esOwner(jidRemitente, config.owner)

  if (entrada.soloOwner && !esDueno) {
    return sock.sendMessage(chatId, {
      text: '⛔ Este comando es solo para el owner del bot.',
    })
  }

  if (entrada.soloAdmin && !esDueno) {
    const esAdmin = await esAdminGrupo(sock, chatId, jidRemitente)
    if (!esAdmin) {
      return sock.sendMessage(chatId, {
        text: '⛔ Este comando es solo para administradores del grupo.',
      })
    }
  }

  if (entrada.cooldown > 0 && !esDueno) {
    const clave = `${entrada.nombre}:${jidRemitente}`
    const ahora = Date.now()
    const vencimiento = cooldowns.get(clave)

    if (vencimiento && ahora < vencimiento) {
      const restante = Math.ceil((vencimiento - ahora) / 1000)
      return sock.sendMessage(chatId, {
        text: `⏳ Espera ${restante}s antes de volver a usar *${config.prefijo}${entrada.nombre}*.`,
      })
    }
    cooldowns.set(clave, ahora + entrada.cooldown * 1000)
  }

  try {
    const db = await getDB()
    console.log(
      chalk.green('⚡ Comando:'),
      `${config.prefijo}${entrada.nombre}`,
      chalk.gray(`(${jidRemitente.split('@')[0]})`)
    )
    await entrada.run({
      sock,
      msg,
      args,
      chatId,
      esDueno,
      comandos: listaComandos,
      config,
      db,
    })
  } catch (err) {
    console.error(`Error en el comando "${entrada.nombre}":`, err)
    await notificarErrorAlOwner(sock, err, entrada.nombre)
  }
}
