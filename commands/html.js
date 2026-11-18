export const desc = 'Envía HTML convertido al formato de WhatsApp: .html <b>Hola</b> <i>mundo</i> (sin texto = ejemplo)'
export const alias = ['htmltexto']
export const categoria = 'prueba'
export const cooldown = 3

/** Lo que se envía con .html sin texto: muestra casi todo lo que se convierte. */
export const EJEMPLO =
  '<h1>Hola</h1><p>Esto es <b>negrita</b>, <i>cursiva</i>, <s>tachado</s> y <code>codigo()</code>.</p>' +
  '<ul><li>Uno</li><li>Dos</li></ul><ol><li>Primero</li><li>Segundo</li></ol>' +
  '<blockquote>Una cita</blockquote><pre>const x = 1</pre>' +
  '<table><tr><th>Cmd</th><th>Uso</th></tr><tr><td>.ping</td><td>Latencia</td></tr></table>' +
  '<a href="https://github.com/AmilcarGit/Yui-Bails">Yui-Bails</a>'

export default async function html({ sock, chatId, msg, args, config }) {
  const responder = (text) => sock.sendMessage(chatId, { text }, { quoted: msg })

  if (typeof sock.sendHtml !== 'function') {
    return responder('⚠️ Esta función necesita Yui-Bails 1.4.2 o más nueva:\nnpm install yui-bails@npm:@yui-bails/yui-bails@latest')
  }

  const codigo = args.join(' ').trim()
  if (!codigo) {
    await responder(
      `🧩 *HTML → WhatsApp*\nWhatsApp no tiene HTML: se convierte a su formato (negrita, cursiva, listas, citas, código).\nUso: ${config.prefijo}html <b>Hola</b> <i>mundo</i>\n\nEjemplo:`
    )
  }

  try {
    await sock.sendHtml(chatId, codigo || EJEMPLO, { quoted: msg })
  } catch (err) {
    if (err?.output?.statusCode === 400) return responder('🧩 Ese HTML no tiene texto para enviar.')
    throw err
  }
}
