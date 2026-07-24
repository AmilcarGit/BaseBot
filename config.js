/**
 * Configuración global del bot.
 * Modifica estos valores según tu proyecto.
 */
export default {
  // Nombre de tu bot
  nombreBot: 'MI-BOT-MD',

  // Prefijo de comandos (usa '' para que no requiera prefijo)
  prefijo: '.',

  // Número del owner/dueño del bot (con código de país, sin +, sin espacios)
  owner: ['51910227479'],

  // Número que se usará para vincular el bot vía código de emparejamiento.
  // Déjalo vacío ('') para que el bot lo pida por consola al iniciar.
  numeroBot: '',

  // Carpeta donde se guardará la sesión
  sessionFolder: './session',

  // Archivo donde se guarda la base de datos local (usuarios, chats, etc.)
  dbFile: './database.json',

  // Tiempo de vida del caché de metadata de grupos (ms)
  groupCacheTTL: 60 * 1000,

  // Pausa ante error 429 (rate limit) en ms
  rateLimitPause: 90 * 1000,

  // Reintentos máximos de reconexión y tope de espera
  maxReconnectAttempts: 8,
  maxReconnectDelay: 5 * 60 * 1000,
}
