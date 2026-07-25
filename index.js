import makeWASocket, {
  useMultiFileAuthState,
  fetchLatestBaileysVersion,
  DisconnectReason,
  makeCacheableSignalKeyStore,
} from '@whiskeysockets/baileys'
import { Boom } from '@hapi/boom'
import pino from 'pino'
import chalk from 'chalk'
import readline from 'readline'
import config from './config.js'
import handler from './handler.js'
import { delay, backoffDelay } from './lib/utils.js'
import { info, warn, error as logError } from './lib/logger.js'

const logger = pino({ level: 'silent' })
let intentosReconexion = 0
let codigoSolicitado = false

const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout,
})
const preguntar = (texto) =>
  new Promise((resolve) => rl.question(texto, resolve))

async function iniciar() {
  const { state, saveCreds } = await useMultiFileAuthState(
    config.sessionFolder
  )
  const { version } = await fetchLatestBaileysVersion()

  // Pedimos el número ANTES de abrir el socket. Si se pide después de
  // 'connecting', la espera por la respuesta del usuario hace que
  // WhatsApp cierre la conexión por timeout (errores 408/428).
  let numero = config.numeroBot
  if (!state.creds.registered && !numero) {
    numero = await preguntar(
      chalk.green(
        'Ingresa el número de WhatsApp del bot (con código de país, sin +): '
      )
    )
  }
  if (numero) numero = numero.replace(/\D/g, '')

  const sock = makeWASocket({
    version,
    logger,
    printQRInTerminal: false,
    auth: {
      creds: state.creds,
      keys: makeCacheableSignalKeyStore(state.keys, logger),
    },
    browser: ['Ubuntu', 'Chrome', '20.0.04'],
  })

  // --- Solicitud del código de vinculación ---
  // Se dispara apenas el socket empieza a conectar, ya con el número
  // en mano, para no perder la ventana de tiempo que da WhatsApp.
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect } = update

    if (
      connection === 'connecting' &&
      !sock.authState.creds.registered &&
      !codigoSolicitado &&
      numero
    ) {
      codigoSolicitado = true
      await delay(1500)

      try {
        const codigo = await sock.requestPairingCode(numero)
        info(
          chalk.yellow('\n============================='),
          chalk.cyan(`\nTu código de vinculación es: ${codigo}`),
          chalk.yellow('\n=============================\n'),
          '\nAbre WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa el código.'
        )
      } catch (err) {
        logError(chalk.red('Error al solicitar el código de vinculación:'), err)
        codigoSolicitado = false
      }
    }

    if (connection === 'open') {
      intentosReconexion = 0
      codigoSolicitado = false
      info(chalk.green(`✔ ${config.nombreBot} conectado correctamente.`))
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut

      if (isLoggedOut) {
        logError(
          chalk.red(
            'Sesión cerrada desde el teléfono. Elimina la carpeta de sesión y vuelve a vincular.'
          )
        )
        return
      }

      // 401 u otros códigos: reintentar con backoff exponencial
      if (intentosReconexion < config.maxReconnectAttempts) {
        const espera = backoffDelay(intentosReconexion, config.maxReconnectDelay)
        intentosReconexion++
        warn(
          chalk.yellow(
            `Conexión cerrada (${statusCode}). Reintentando en ${Math.round(
              espera / 1000
            )}s (intento ${intentosReconexion}/${config.maxReconnectAttempts})...`
          )
        )
        await delay(espera)
        iniciar()
      } else {
        logError(
          chalk.red('Se alcanzó el máximo de reintentos de reconexión. Deteniendo el bot.')
        )
      }
    }
  })

  sock.ev.on('creds.update', saveCreds)

  sock.ev.on('messages.upsert', async (m) => {
    try {
      await handler(sock, m)
    } catch (err) {
      // Manejo básico de rate limit (429): pausa antes de continuar
      if (err?.output?.statusCode === 429 || err?.status === 429) {
        warn(
          chalk.yellow(
            `Rate limit detectado. Pausando ${config.rateLimitPause / 1000}s...`
          )
        )
        await delay(config.rateLimitPause)
      } else {
        logError('Error procesando mensaje:', err)
      }
    }
  })

  // --- Bienvenida / despedida automática de grupos ---
  sock.ev.on('group-participants.update', async (update) => {
    if (!config.bienvenida?.activa) return

    try {
      const { id: chatId, participants, action } = update
      const metadata = await sock.groupMetadata(chatId)
      const nombreGrupo = metadata.subject

      for (const jid of participants) {
        const plantilla =
          action === 'add'
            ? config.bienvenida.mensajeEntrada
            : action === 'remove'
              ? config.bienvenida.mensajeSalida
              : null

        if (!plantilla) continue

        const texto = plantilla
          .replace('{mention}', `@${jid.split('@')[0]}`)
          .replace('{grupo}', nombreGrupo)

        await sock.sendMessage(chatId, { text: texto, mentions: [jid] })
      }
    } catch (err) {
      logError('Error en bienvenida/despedida:', err)
    }
  })

  return sock
}

iniciar()
