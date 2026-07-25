import fs from 'fs'
import path from 'path'

const logDir = path.join(process.cwd(), 'logs')
if (!fs.existsSync(logDir)) fs.mkdirSync(logDir, { recursive: true })

const logFile = path.join(logDir, 'bot.log')

// Quita los códigos de color ANSI (de chalk) antes de guardar en archivo.
function limpiar(valor) {
  return String(valor).replace(/\x1b\[[0-9;]*m/g, '')
}

function escribirArchivo(nivel, args) {
  const linea = `[${new Date().toISOString()}] [${nivel}] ${args
    .map(limpiar)
    .join(' ')}\n`
  fs.appendFile(logFile, linea, () => {})
}

export function info(...args) {
  console.log(...args)
  escribirArchivo('INFO', args)
}

export function warn(...args) {
  console.log(...args)
  escribirArchivo('WARN', args)
}

export function error(...args) {
  console.error(...args)
  escribirArchivo('ERROR', args)
}
