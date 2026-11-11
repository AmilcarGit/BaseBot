/** Guarda el administrador de sesiones (modo multisesión) para que los comandos puedan usarlo. */
let manager

export function fijarManager(nuevo) {
  manager = nuevo
}

export function obtenerManager() {
  return manager
}

/** ¿Hay que arrancar en modo multisesión? (`npm start -- --multi`, MULTI=1 o config.multisesion.activa) */
export function modoMultisesion(config, argv = process.argv, env = process.env) {
  return Boolean(config.multisesion?.activa) || argv.includes('--multi') || env.MULTI === '1'
}

/** "ABCD1234" -> "ABCD-1234" */
export function formatearCodigo(codigo = '') {
  return String(codigo).replace(/\W/g, '').replace(/(.{4})(?=.)/g, '$1-')
}
