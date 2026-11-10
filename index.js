import * as Yui from 'yui-bails'
import pino from 'pino'
import chalk from 'chalk'
import fs from 'fs'
import path from 'path'
import readline from 'readline'
import config from './config.js'
import handler from './handler.js'
import { delay } from './lib/utils.js'
import { info, warn, error as logError } from './lib/logger.js'
import { registrarRespuestas } from './lib/respuestas.js'
import { guardarMensaje, marcarEnviado, obtenerMensaje } from './lib/store.js'
import { procesarVotos } from './lib/votos.js'

const logger = pino({ level: process.env.LOG_LEVEL || 'warn' })

/** Logger de Yui-Bails: legible y en español si la versión instalada lo trae (y config.logs.bonitos lo permite). */
const loggerYui =
  config.logs?.bonitos !== false && typeof Yui.makePrettyLogger === 'function'
    ? Yui.makePrettyLogger({ level: process.env.LOG_LEVEL || 'warn' })
    : logger

/** Opciones de la cola anti-ban a partir de config.antiBan (false = sin cola). */
function colaAntiBan() {
  const a = config.antiBan
  if (!a?.activa) return false
  return {
    minDelayMs: a.pausaMinMs,
    maxDelayMs: a.pausaMaxMs,
    perChatIntervalMs: a.porChatMs,
    perChatLimit: { max: a.maxPorMinuto, windowMs: 60_000 },
    typing: a.escribiendo,
  }
}
/** ¿Esta carpeta de sesión ya tiene un número vinculado? */
function estaVinculado() {
  try {
    const creds = JSON.parse(fs.readFileSync(path.join(config.sessionFolder, 'creds.json'), 'utf8'))
    return creds.registered === true
  } catch {
    return false
  }
}

/** Pregunta el número ANTES de conectar: preguntar con el socket abierto hace que WhatsApp cierre por timeout. */
async function pedirNumero() {
  if (estaVinculado()) return undefined
  if (config.numeroBot) return config.numeroBot

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout })
  const respuesta = await new Promise((resolve) =>
    rl.question(chalk.green('Ingresa el número de WhatsApp del bot (con código de país, sin +): '), resolve)
  )
  rl.close()
  return respuesta
}

/** Conecta el bot: Yui-Bails se encarga de la sesión, del código de vinculación y de reconectar. */
async function iniciar() {
  if (typeof Yui.connectBot !== 'function') {
    logError(
      chalk.red(
        'Este bot necesita Yui-Bails 1.3.0 o más nueva. Actualiza con:\n  npm install yui-bails@npm:@yui-bails/yui-bails'
      )
    )
    process.exit(1)
  }

  const numero = await pedirNumero()

  try {
    await Yui.connectBot({
      authDir: config.sessionFolder,
      number: numero,
      // Yui-Bails consulta sola la versión vigente de WhatsApp Web en cada conexión
      config: {
        logger: loggerYui,
        printQRInTerminal: false,
        browser: ['Ubuntu', 'Chrome', '20.0.04'],
        // necesario para reintentos de envío y para descifrar los votos de las encuestas
        getMessage: async (key) => obtenerMensaje(key),
        // cola anti-ban: envíos en serie con pausas, límite por chat y "escribiendo…" automático
        sendQueue: colaAntiBan(),
        // una línea por mensaje y por cambio de conexión
        prettyLogs: config.logs?.lineaPorMensaje !== false,
        // marca los mensajes nuevos como leídos
        autoRead: config.logs?.leerAutomatico ?? false,
        ...(config.logs?.presencia ? { autoPresence: config.logs.presencia } : {}),
      },
      onCode: ({ formatted }) =>
        info(
          chalk.yellow('\n============================='),
          chalk.cyan(`\nTu código de vinculación es: ${formatted}`),
          chalk.yellow('\n=============================\n'),
          '\nAbre WhatsApp > Dispositivos vinculados > Vincular con número de teléfono, e ingresa el código.'
        ),
      onOpen: () => info(chalk.green(`✔ ${config.nombreBot} conectado correctamente.`)),
      onClose: ({ reason, willReconnect, message }) => {
        if (reason === Yui.DisconnectReason.loggedOut) {
          logError(chalk.red(`${message}\nVuelve a iniciar el bot para vincular de nuevo.`))
          process.exit(1)
        }
        if (willReconnect) warn(chalk.yellow(`Conexión cerrada (${reason}). ${message}`))
      },
      onError: (err, message) => logError(chalk.red(message), err),
      setup: configurarSocket,
    })
  } catch (err) {
    // número mal escrito, carpeta de sesión insegura…
    logError(chalk.red(err?.message || err))
    process.exit(1)
  }
}

/** Se ejecuta con cada socket nuevo (también al reconectar): engancha los comandos y eventos. */
function configurarSocket(sock) {
  // Recuerda los ids de lo que envía el bot, para no confundirlo con comandos del número vinculado
  const enviarOriginal = sock.sendMessage
  sock.sendMessage = async (...args) => {
    const enviado = await enviarOriginal(...args)
    marcarEnviado(enviado?.key?.id)
    return enviado
  }

  // respuestas a botones con onButton (ver lib/respuestas.js)
  registrarRespuestas(sock)

  sock.ev.on('messages.upsert', async (m) => {
    for (const mensaje of m.messages || []) guardarMensaje(mensaje)
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

  // --- Votos de las encuestas creadas con .encuesta ---
  // Yui-Bails entrega el resultado ya descifrado y acumulado en el evento `poll.votes`
  sock.ev.on('poll.votes', async (votos) => {
    await procesarVotos(sock, votos)
  })

  // --- Bienvenida / despedida automática de grupos ---
  sock.ev.on('group-participants.update', async (update) => {
    if (!config.bienvenida?.activa) return

    try {
      const { id: chatId, participants, action } = update
      const metadata = await sock.groupMetadata(chatId)
      const nombreGrupo = metadata.subject

      for (const participante of participants) {
        // las versiones nuevas de Yui-Bails entregan objetos { id, lid, ... }; las viejas, textos
        const jid = typeof participante === 'string' ? participante : participante?.id
        if (!jid) continue

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

  // Los comandos nuevos usan helpers de Yui-Bails: si la versión instalada es vieja, avisa cómo actualizar
  if (typeof sock.getSender !== 'function' || typeof sock.sendPoll !== 'function') {
    warn(
      chalk.yellow(
        'Tu Yui-Bails instalado es antiguo (faltan sock.getSender / sock.sendPoll). Actualiza con:\n  npm install github:AmilcarGit/Yui-Bails'
      )
    )
  }

}

iniciar()
