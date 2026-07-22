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
  // Se dispara cuando Baileys emite el evento con el QR pendiente,
  // que es el momento en que el socket ya está listo para generar el código.
  sock.ev.on('connection.update', async (update) => {
    const { connection, lastDisconnect, qr } = update

    if (qr && !sock.authState.creds.registered && !codigoSolicitado) {
      codigoSolicitado = true
      await delay(1500)

      let numero = config.numeroBot
      if (!numero) {
        numero = await preguntar(
          chalk.green(
            'Ingresa el número de WhatsApp del bot (con código de país, sin +): '
          )
        )
      }
      numero = numero.replace(/\D/g, '')

      try {
        const codigo = await sock.requestPairingCode(numero)
        console.log(
          chalk.yellow('\n============================='),
          chalk.cyan(`\nTu código de vinculación es: ${codigo}`),
          chalk.yellow('\n=============================\n'),
          '\nAbre WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa el código.'
        )
      } catch (err) {
        console.error(chalk.red('Error al solicitar el código de vinculación:'), err)
        codigoSolicitado = false
      }
    }

    if (connection === 'open') {
      intentosReconexion = 0
      codigoSolicitado = false
      console.log(chalk.green(`✔ ${config.nombreBot} conectado correctamente.`))
    }

    if (connection === 'close') {
      const statusCode = new Boom(lastDisconnect?.error)?.output?.statusCode
      const isLoggedOut = statusCode === DisconnectReason.loggedOut

      if (isLoggedOut) {
        console.log(
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
        console.log(
          chalk.yellow(
            `Conexión cerrada (${statusCode}). Reintentando en ${Math.round(
              espera / 1000
            )}s (intento ${intentosReconexion}/${config.maxReconnectAttempts})...`
          )
        )
        await delay(espera)
        iniciar()
      } else {
        console.log(
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
        console.log(
          chalk.yellow(
            `Rate limit detectado. Pausando ${config.rateLimitPause / 1000}s...`
          )
        )
        await delay(config.rateLimitPause)
      } else {
        console.error('Error procesando mensaje:', err)
      }
    }
  })

  return sock
}

iniciar()