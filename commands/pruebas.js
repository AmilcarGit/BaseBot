import { enviar, recortar } from '../lib/pruebas.js'

export const desc = 'Catálogo de comandos para probar todas las funciones de Yui-Bails'
export const alias = ['test', 'funciones']
export const categoria = 'prueba'
export const cooldown = 5

export default async function pruebas({ sock, chatId, msg, comandos, config }) {
  const p = config.prefijo
  const lista = comandos.filter((c) => c.categoria === 'prueba')

  const linea = (c) => {
    const etiqueta = c.soloOwner ? ' 🔒 owner' : c.soloAdmin ? ' 🛡️ admin' : ''
    return `▢ *${p}${c.nombre}*${etiqueta}\n   ${c.desc}`
  }

  const texto = `🧪 *Pruebas de Yui-Bails*\n${lista.length} comandos para ejercitar la librería.\n\n${lista.map(linea).join('\n\n')}\n\n💡 Toca el desplegable para ejecutar los más rápidos.`

  // Desplegable con los comandos abiertos a todos (10 filas como máximo)
  const filas = lista
    .filter((c) => !c.soloOwner && !c.soloAdmin && c.nombre !== 'pruebas')
    .slice(0, 10)
    .map((c) => ({ title: `${p}${c.nombre}`, description: recortar(c.desc, 72), id: `${p}${c.nombre}` }))

  await enviar(
    sock,
    chatId,
    {
      text: texto,
      footer: config.nombreBot,
      buttons: [{ text: '🧪 Ejecutar una prueba', sections: [{ title: 'Pruebas rápidas', rows: filas }] }],
    },
    msg
  )
}
