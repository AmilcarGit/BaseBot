// Restaura una copia hecha con .respaldo. Úsalo con el bot APAGADO:
//   node restaurar.js respaldos/sesion-2026-11-17T22-30-00.ysb [carpeta]
// No reemplaza una sesión que ya exista: borra o mueve la carpeta antes si quieres sustituirla.
import * as Yui from 'yui-bails'
import config from './config.js'

const [archivo, carpeta = config.sessionFolder] = process.argv.slice(2)

if (!archivo) {
  console.log('Uso: node restaurar.js <archivo.ysb> [carpeta]')
  process.exit(1)
}

if (typeof Yui.restoreSession !== 'function') {
  console.error('Necesitas Yui-Bails 1.4.2 o más nueva: npm install yui-bails@npm:@yui-bails/yui-bails@latest')
  process.exit(1)
}

try {
  const resultado = await Yui.restoreSession(archivo, carpeta)
  console.log(`✔ Sesión restaurada en ${carpeta}`, resultado?.files ? `(${resultado.files} archivos)` : '')
} catch (err) {
  console.error(`✖ ${err?.message || err}`)
  process.exit(1)
}
