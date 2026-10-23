import nativo from 'amilcar-ai/native'
import config from '../config.js'
import { info, error as logError } from './logger.js'
import { contenidoMensaje } from './utils.js'

// Motor 100 % local: funciona sin Internet, sin API y sin Python (ideal para Termux).
const { NativeAmilcarAI } = nativo

// Valores por defecto: así funciona aunque tu config.js sea antiguo y no tenga el bloque autoRespuesta.
const POR_DEFECTO = {
  activa: true,
  privados: true,
  grupos: true,
  cooldownSegundos: 4,
  maxCaracteres: 500,
  responderSiNoSabe: true,
  // 'auto'  = responde el modelo neuronal (AMI-Base) y, si duda, el motor nativo.
  // 'neural' = siempre el modelo neuronal; 'native' = solo el motor de reglas.
  motor: 'auto',
  // Confianza mínima (0 a 1) para aceptar la respuesta del modelo neuronal en modo 'auto'.
  umbralConfianza: 0.5,
}

export function opciones() {
  return { ...POR_DEFECTO, ...(config.autoRespuesta || {}) }
}

// AUTOIA_DEBUG=1 muestra en consola por qué se omite un mensaje.
const DEBUG = ['1', 'true', 'si'].includes(String(process.env.AUTOIA_DEBUG || '').toLowerCase())

function omitir(razon) {
  if (DEBUG) info(`🔎 Auto-respuesta omitida: ${razon}`)
  return false
}

const MAX_CHATS = 200
const motores = new Map()
const ultimaRespuesta = new Map()

/** Un motor por chat, para que recuerde el tema reciente ("explícame más"). */
export function obtenerMotor(chatId) {
  let motor = motores.get(chatId)
  if (motor) {
    motores.delete(chatId) // lo mueve al final: los chats inactivos se descartan primero
    motores.set(chatId, motor)
    return motor
  }
  motor = new NativeAmilcarAI({ maxHistory: 6, maxMessageLength: 2000 })
  motores.set(chatId, motor)
  if (motores.size > MAX_CHATS) motores.delete(motores.keys().next().value)
  return motor
}

export async function chatNativo(chatId, texto) {
  return obtenerMotor(chatId).chat(texto)
}

// ---- Modelo neuronal (AMI-Base en JavaScript puro, sin Python) ----
let neural // undefined = sin cargar todavía, null = no disponible
let errorNeural = ''

/** Carga el modelo una sola vez. Devuelve null si falta amilcar-ai/neural o el archivo del modelo. */
export async function cargarNeural() {
  if (neural !== undefined) return neural
  try {
    const modulo = await import('amilcar-ai/neural')
    const { NeuralAmilcarAI } = modulo.default || modulo
    const candidato = new NeuralAmilcarAI({ maxNewTokens: 160 })
    if (!candidato.isAvailable()) throw new Error(`no existe el modelo en ${candidato.modelPath}`)
    candidato.load() // falla aquí (una vez) si el archivo está dañado
    neural = candidato
  } catch (err) {
    neural = null
    errorNeural = err?.code === 'ERR_PACKAGE_PATH_NOT_EXPORTED' ? 'amilcar-ai desactualizado (npm install github:AmilcarGit/AMILCAR-AI)' : err?.message || String(err)
    info(`ℹ️ Modelo neuronal no disponible (${errorNeural}); se usa el motor nativo.`)
  }
  return neural
}

/** Solo para pruebas: inyecta un modelo falso (o null) y evita cargar el real. */
export function fijarNeuralParaPruebas(modelo) {
  neural = modelo
  errorNeural = modelo ? '' : 'desactivado en pruebas'
}

export async function estadoMotor() {
  const cfg = opciones()
  const modelo = cfg.motor === 'native' ? null : await cargarNeural()
  return {
    motor: cfg.motor,
    neuralDisponible: Boolean(modelo),
    umbral: cfg.umbralConfianza,
    modelPath: modelo?.modelPath || '',
    motivo: modelo || cfg.motor === 'native' ? '' : errorNeural,
  }
}

// Cálculos y hora: el motor exacto siempre acierta; una red neuronal pequeña no sabe sumar.
const HABILIDADES_EXACTAS = new Set(['math_calculation', 'local_time'])

/**
 * Genera la respuesta para un mensaje. Siempre pasa por el motor nativo para que cada chat recuerde su
 * tema ("explícame más"); en modo 'auto' el modelo neuronal responde si está seguro de lo que dice.
 * Devuelve { reply, model, intent, confidence, motor, neuralConfianza }.
 */
export async function responder(chatId, texto) {
  const cfg = opciones()
  const nativoResultado = await chatNativo(chatId, texto)
  const comoNativo = (extra = {}) => ({ ...nativoResultado, motor: 'native', ...extra })
  if (cfg.motor === 'native' || HABILIDADES_EXACTAS.has(nativoResultado.intent)) return comoNativo()

  const modelo = await cargarNeural()
  if (!modelo) return comoNativo()
  let resultado
  try {
    resultado = await modelo.chat(texto)
  } catch (err) {
    logError('Error en el modelo neuronal; se usa el motor nativo:', err)
    return comoNativo()
  }
  const confianza = Number(resultado.confidence) || 0
  const aceptada = Boolean(resultado.reply?.trim()) && (cfg.motor === 'neural' || confianza >= cfg.umbralConfianza)
  if (!aceptada) return comoNativo({ neuralConfianza: confianza })
  return {
    reply: resultado.reply.trim(),
    model: resultado.model,
    intent: resultado.intent === 'unknown' ? 'unknown' : 'neural',
    confidence: confianza,
    motor: 'neural',
    neuralConfianza: confianza,
  }
}

/** Solo texto escrito: se ignoran stickers, audios, imágenes, etc. */
export function textoPlano(msg) {
  const contenido = contenidoMensaje(msg)
  return contenido?.conversation || contenido?.extendedTextMessage?.text || ''
}

function numero(jid = '') {
  return String(jid).split('@')[0].split(':')[0]
}

/** ¿Mencionaron al bot o respondieron a un mensaje suyo? */
export function esParaElBot(sock, msg) {
  const ids = [sock?.user?.id, sock?.user?.lid].filter(Boolean).map(numero)
  if (!ids.length) return false
  const contexto = contenidoMensaje(msg)?.extendedTextMessage?.contextInfo
  const mencionados = (contexto?.mentionedJid || []).map(numero)
  if (mencionados.some((n) => ids.includes(n))) return true
  return Boolean(contexto?.participant) && ids.includes(numero(contexto.participant))
}

export async function autoRespuestaActiva() {
  const { getDB } = await import('./db.js')
  const db = await getDB()
  const guardado = db.data.settings?.autoRespuesta
  return typeof guardado === 'boolean' ? guardado : Boolean(opciones().activa)
}

export async function fijarAutoRespuesta(valor) {
  const { getDB } = await import('./db.js')
  const db = await getDB()
  db.data.settings ??= {}
  db.data.settings.autoRespuesta = Boolean(valor)
  await db.write()
}

/**
 * Responde automáticamente a un mensaje que no es comando.
 * Devuelve true si envió una respuesta. Nunca lanza errores: un fallo aquí no debe tumbar al bot.
 *
 * - Chats privados: responde a todo texto.
 * - Grupos: solo si mencionan al bot o responden a un mensaje suyo.
 */
export async function autoResponder({ sock, msg, chatId, jidRemitente, activa }) {
  try {
    const cfg = opciones()
    const habilitada = activa === undefined ? await autoRespuestaActiva() : activa
    if (!habilitada) return omitir('está desactivada (.autoia on para activarla)')
    if (!chatId || chatId.endsWith('@broadcast') || chatId.endsWith('@newsletter')) return omitir('chat de estados o canales')
    if (msg?.key?.id?.startsWith('BAE5')) return omitir('mensaje de otro bot')

    const esGrupo = chatId.endsWith('@g.us')
    if (esGrupo ? !cfg.grupos : !cfg.privados) return omitir(esGrupo ? 'grupos desactivados en config' : 'privados desactivados en config')

    let texto = textoPlano(msg).trim()
    if (!texto) return omitir('el mensaje no es texto')
    if (esGrupo && !esParaElBot(sock, msg)) return omitir('en grupos solo responde si mencionan al bot o le responden')

    texto = texto.replace(/@\d{5,}/g, '').replace(/\s+/g, ' ').trim() || 'hola'
    if (texto.length > cfg.maxCaracteres) return omitir(`mensaje de más de ${cfg.maxCaracteres} caracteres`)

    const clave = `${chatId}:${numero(jidRemitente)}`
    const ahora = Date.now()
    if (ahora < (ultimaRespuesta.get(clave) || 0)) return omitir('pausa anti-spam activa para este usuario')
    ultimaRespuesta.set(clave, ahora + cfg.cooldownSegundos * 1000)
    if (ultimaRespuesta.size > 5000) ultimaRespuesta.clear()

    const resultado = await responder(chatId, texto)
    if (resultado.intent === 'unknown' && cfg.responderSiNoSabe === false) return omitir('no sabe la respuesta y responderSiNoSabe está en false')

    try {
      await sock.sendPresenceUpdate('composing', chatId)
    } catch {
      // El indicador "escribiendo..." es opcional.
    }
    await sock.sendMessage(chatId, { text: resultado.reply }, { quoted: msg })
    info(`🤖 Auto-respuesta (${resultado.motor}, ${resultado.intent}${resultado.neuralConfianza !== undefined ? `, confianza ${resultado.neuralConfianza.toFixed(2)}` : ''}) en ${esGrupo ? 'grupo' : 'privado'}`)
    return true
  } catch (err) {
    logError('Error en la respuesta automática:', err)
    return false
  }
}
