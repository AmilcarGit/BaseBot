/**
 * Configuración global del bot.
 * Modifica estos valores según tu proyecto.
 */
export default {
  // Nombre de tu bot
  nombreBot: 'MI-BOT-MD',

  // Prefijo de comandos (usa '' para que no requiera prefijo)
  prefijo: '.',

  // true = el número vinculado al bot (la cuenta donde escaneaste el QR) también puede usar
  // los comandos, escribiéndolos desde su WhatsApp (por ejemplo en "Mensaje a ti mismo") y
  // se le trata como owner.
  permitirNumeroDelBot: true,

  // Número del owner/dueño del bot (con código de país, sin +, sin espacios)
  owner: ['51910227479', '269715926691844'],

  // Número que se usará para vincular el bot vía código de emparejamiento.
  // Déjalo vacío ('') para que el bot lo pida por consola al iniciar.
  numeroBot: '',

  // Carpeta donde se guardará la sesión
  sessionFolder: './session',

  // Varios números de WhatsApp a la vez. También se activa con `npm start -- --multi`.
  // Cada número guarda su vinculación en ./sesiones/<id>/ y se administra con el comando .sesion
  multisesion: {
    activa: false,
    carpeta: './sesiones',
  },

  // Archivo donde se guarda la base de datos local (usuarios, chats, etc.)
  dbFile: './database.json',

  // Tiempo de vida del caché de metadata de grupos (ms)
  groupCacheTTL: 60 * 1000,

  // Pausa ante error 429 (rate limit) en ms
  rateLimitPause: 90 * 1000,


  // Logs y lectura automática (necesitan Yui-Bails 1.1.0 o más nueva; en una vieja se ignoran)
  logs: {
    bonitos: true, // errores de Yui-Bails en español y sin JSON
    lineaPorMensaje: true, // una línea por mensaje recibido y por cambio de conexión
    leerAutomatico: true, // marca como leídos (✔✔ azules) los mensajes nuevos
    presencia: null, // 'available' = en línea | 'unavailable' = no se ve en línea | null = no tocar
  },

  // Cola anti-ban de Yui-Bails: los mensajes salen uno a uno, con pausas aleatorias,
  // un límite por chat y "escribiendo…" antes de los textos. Pon activa: false para desactivarla.
  antiBan: {
    activa: true,
    pausaMinMs: 600, // pausa aleatoria mínima entre dos mensajes
    pausaMaxMs: 1800, // y máxima
    porChatMs: 1200, // mínimo entre dos mensajes al mismo chat
    maxPorMinuto: 20, // máximo de mensajes por chat cada minuto
    escribiendo: true, // muestra "escribiendo…" antes de enviar textos
  },

  // Respuesta automática con AMILCAR AI (motor local: sin Internet, sin API, sin Python).
  // El owner puede activarla o desactivarla desde WhatsApp con .autoia on / .autoia off
  autoRespuesta: {
    activa: true,
    privados: true, // responde a cualquier texto en chats privados
    grupos: true, // en grupos solo si mencionan al bot o responden a un mensaje suyo
    cooldownSegundos: 4, // pausa por usuario entre respuestas (evita spam)
    maxCaracteres: 500, // ignora mensajes más largos
    responderSiNoSabe: true, // false = se queda en silencio cuando no entiende
    motor: 'auto', // 'auto' = modelo neuronal y, si duda, motor nativo | 'neural' | 'native'
    umbralConfianza: 0.5, // confianza mínima (0 a 1) para aceptar la respuesta del modelo neuronal
  },

  // Bienvenida y despedida automática en grupos.
  // Usa {mention} para etiquetar al usuario y {grupo} para el nombre del grupo.
  bienvenida: {
    activa: true,
    mensajeEntrada: '👋 ¡Bienvenido/a {mention} a *{grupo}*!\nLee las reglas y disfruta tu estadía 🎉',
    mensajeSalida: '😢 {mention} salió de *{grupo}*. ¡Hasta pronto!',
  },
}
