import path from 'path'
import fs from 'fs'
import { fileURLToPath } from 'url'
import chalk from 'chalk'
import config from './config.js'
import { esOwner, normalizarJid, contenidoMensaje, textoDeMensaje, resolverIdentidades } from './lib/utils.js'
import { esAdminGrupo } from './lib/groupPermissions.js'
import { getDB } from './lib/db.js'
import { fueEnviadoPorElBot } from './lib/store.js'
import { info, error as logError } from './lib/logger.js'
import { autoResponder } from './lib/autoreply.js'

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
 *   export const categoria = 'prueba' // agrupa comandos (.pruebas lista los de categoría 'prueba')
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
      categoria: mod.categoria || 'general',
    }

    comandos[nombre] = entrada
    for (const a of entrada.alias) comandos[a] = entrada
    listaComandos.push(entrada)
  }

  info(chalk.green(`✔ ${listaComandos.length} comandos cargados desde /commands`))
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
  if (!msg?.message) return

  // Mensajes del propio número vinculado: solo se aceptan comandos escritos a mano y recientes
  // (no los que envía el bot, ni los antiguos que llegan al sincronizar).
  const propio = !!msg.key.fromMe
  if (propio) {
    const reciente = Date.now() / 1000 - Number(msg.messageTimestamp || 0) < 60
    // Lo que envía el propio bot llega como 'append' y con ids '3EB0…'; lo escrito en el teléfono, como 'notify'
    const generadoPorLaLibreria = String(msg.key.id || '').startsWith('3EB0')
    if (!config.permitirNumeroDelBot || m.type !== 'notify' || generadoPorLaLibreria) return
    if (fueEnviadoPorElBot(msg.key.id) || !reciente) return
    if (!textoDeMensaje(msg).startsWith(config.prefijo)) return
  }

  const jidRemitente = propio ? sock.user.id : msg.key.participant || msg.key.remoteJid
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
    logError('Error guardando en la base de datos:', err)
  }

  const texto = textoDeMensaje(msg)

  // Log de todo mensaje entrante (aunque no sea comando), útil para depurar.
  const tipoMensaje = Object.keys(contenidoMensaje(msg) || msg.message)[0]
  const esGrupo = chatId.endsWith('@g.us')
  info(
    chalk.cyan(esGrupo ? '👥 Grupo' : '👤 Privado'),
    chalk.gray(`${jidRemitente.split('@')[0]}:`),
    texto || chalk.dim(`[${tipoMensaje}]`)
  )

  if (!texto.startsWith(config.prefijo)) {
    // Mensaje normal (no es comando): AMILCAR AI responde si la respuesta automática está activa.
    await autoResponder({ sock, msg, chatId, jidRemitente })
    return
  }

  const [comandoRaw, ...args] = texto
    .slice(config.prefijo.length)
    .trim()
    .split(/\s+/)
  const comando = comandoRaw?.toLowerCase()

  const entrada = comando && comandos[comando]
  if (!entrada) return

  // WhatsApp puede identificarte con tu número o con un ID interno (@lid): se comparan ambos
  const identidades = await resolverIdentidades(sock, msg)
  const esDueno = propio || esOwner(identidades, config.owner)

  if (entrada.soloOwner && !esDueno) {
    const lid = identidades.find((j) => j.endsWith('@lid'))?.split('@')[0]
    const numero = identidades.find((j) => j.endsWith('@s.whatsapp.net'))?.split('@')[0]
    return sock.sendMessage(chatId, {
      text: `⛔ Este comando es solo para el owner del bot.\n\n🪪 Tu ID: *${lid || numero}*${lid && numero ? `\n📞 Tu número: *${numero}*` : ''}\nSi eres el owner, agrega ${numero ? 'tu número' : 'ese ID'} a \`owner\` en config.js y reinicia el bot.`,
    })
  }

  if (entrada.soloAdmin && !esDueno) {
    const esAdmin = await esAdminGrupo(sock, chatId, identidades)
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

    // Contador global de comandos ejecutados, usado por .stats
    db.data.stats ??= { comandosEjecutados: 0 }
    db.data.stats.comandosEjecutados++
    await db.write()

    info(
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
    logError(`Error en el comando "${entrada.nombre}":`, err)
    await notificarErrorAlOwner(sock, err, entrada.nombre)
    // el owner está probando: que también lo vea en el chat donde ejecutó el comando
    if (esDueno) {
      await sock
        .sendMessage(chatId, {
          text: `⚠️ *${config.prefijo}${entrada.nombre}* falló: ${err?.message || err}`,
        })
        .catch(() => {})
    }
  }
}
