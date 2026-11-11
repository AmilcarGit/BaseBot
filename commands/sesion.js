import { formatearCodigo, obtenerManager } from '../lib/multisesion.js'

export const desc = 'Administra varios números de WhatsApp a la vez (modo multisesión): lista, agregar, parar, iniciar, quitar'
export const alias = ['sesiones', 'session']
export const categoria = 'prueba'
export const cooldown = 3
export const soloOwner = true

const ID_VALIDO = /^[A-Za-z0-9][\w.-]{0,63}$/
const ESPERA_CODIGO_MS = 3 * 60_000
const ESTADOS = { open: '🟢 conectada', connecting: '🟡 conectando', closed: '⚪ cerrada', 'logged-out': '🔴 sesión cerrada' }

const solo = (jid = '') => String(jid).split('@')[0].split(':')[0]

export default async function sesion({ sock, chatId, msg, args, config }) {
  const p = config.prefijo
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })
  const manager = obtenerManager()

  if (!manager) {
    return responder(
      `📱 El modo multisesión está apagado.\nInicia el bot con *npm start -- --multi* (o pon \`multisesion.activa: true\` en config.js) para manejar varios números.`
    )
  }

  const [accion = 'lista', id, numero, extra] = args
  const lista = manager.list()
  // la sesión desde la que se escribe este comando: cerrarla cortaría la conversación
  const propia = lista.find((s) => solo(s.user?.id) === solo(sock.user?.id))?.id

  if (accion === 'lista') {
    if (!lista.length) return responder('📱 No hay sesiones.')
    const filas = lista.map((s) => {
      const cuenta = s.user?.id ? ` — +${solo(s.user.id)}` : ''
      return `▢ *${s.id}*${s.id === propia ? ' (esta)' : ''}\n   ${ESTADOS[s.status] || s.status}${cuenta}`
    })
    return responder(
      `📱 *Sesiones* (${lista.length})\n\n${filas.join('\n\n')}\n\n• ${p}sesion agregar <id> <número>\n• ${p}sesion parar|iniciar <id>\n• ${p}sesion quitar <id> confirmar`
    )
  }

  if (accion === 'agregar') {
    // el número puede venir con espacios: +51 900 000 001
    const digitos = args.slice(2).join('').replace(/\D/g, '')
    if (!ID_VALIDO.test(id || '') || digitos.length < 8) {
      return responder(`Uso: *${p}sesion agregar <id> <número con código de país>*\nEl id lleva solo letras, números, _ - . (ejemplo: ventas)`)
    }
    if (lista.some((s) => s.id === id)) return responder(`Ya existe una sesión llamada *${id}*.`)

    // el código llega por evento: se envía a este chat y se deja de escuchar al conectar o a los 3 minutos
    const alCodigo = ({ id: quien, code }) => {
      if (quien !== id) return
      sock
        .sendMessage(chatId, {
          text: `🔑 Código para *${id}*: *${formatearCodigo(code)}*\nAbre WhatsApp en ese número > Dispositivos vinculados > Vincular con número de teléfono, y escríbelo.`,
        })
        .catch(() => {})
    }
    const dejarDeEscuchar = () => {
      clearTimeout(temporizador)
      manager.off('session.pairing-code', alCodigo)
      manager.off('session.open', alAbrir)
    }
    const alAbrir = ({ id: quien }) => {
      if (quien !== id) return
      dejarDeEscuchar()
      sock.sendMessage(chatId, { text: `✅ Sesión *${id}* conectada.` }).catch(() => {})
    }
    const temporizador = setTimeout(dejarDeEscuchar, ESPERA_CODIGO_MS)
    temporizador.unref?.()

    manager.on('session.pairing-code', alCodigo)
    manager.on('session.open', alAbrir)
    await responder(`⏳ Creando la sesión *${id}*… en unos segundos te llega el código.`)

    try {
      await manager.start(id, { pairingNumber: digitos })
    } catch (err) {
      dejarDeEscuchar()
      return responder(`❌ No se pudo crear la sesión: ${err?.message || err}`)
    }
    return
  }

  if (!['parar', 'iniciar', 'quitar'].includes(accion)) {
    return responder(`Uso: *${p}sesion* [lista | agregar | parar | iniciar | quitar]`)
  }

  if (!lista.some((s) => s.id === id) && accion !== 'iniciar') return responder(`No existe la sesión *${id || ''}*. Mira la lista con *${p}sesion*.`)
  if (id && id === propia && accion !== 'iniciar') {
    return responder('⚠️ Esa es la sesión desde la que escribes. Hazlo desde otra sesión o desde la terminal.')
  }

  if (accion === 'parar') {
    await manager.stop(id)
    return responder(`⏹️ Sesión *${id}* detenida (conserva su vinculación).`)
  }

  if (accion === 'iniciar') {
    if (!ID_VALIDO.test(id || '')) return responder(`Uso: *${p}sesion iniciar <id>*`)
    await manager.start(id)
    return responder(`▶️ Iniciando la sesión *${id}*…`)
  }

  // quitar: cierra sesión en WhatsApp y borra la vinculación, así que pide confirmación
  if (numero !== 'confirmar' && extra !== 'confirmar') {
    return responder(`⚠️ Esto cierra la sesión *${id}* en WhatsApp y borra su vinculación.\nSi estás seguro: *${p}sesion quitar ${id} confirmar*`)
  }
  await manager.logout(id)
  return responder(`🗑️ Sesión *${id}* eliminada.`)
}
