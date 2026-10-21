import { AmilcarAI, AmilcarAIError } from 'amilcar-ai'

export const desc = 'Chatea con AMILCAR AI'
export const alias = ['amilcar', 'ai']
export const cooldown = 5

const ia = new AmilcarAI({
  baseURL: process.env.AMILCAR_AI_URL || 'http://127.0.0.1:8000',
  timeout: 45000,
  maxMessageLength: 2000,
})

export default async function amilcarAI({ sock, chatId, args }) {
  const pregunta = args.join(' ').trim()

  if (!pregunta) {
    return sock.sendMessage(chatId, {
      text: '🤖 *AMILCAR AI*\n\nEscribe tu pregunta después del comando.\n\nEjemplo: *.ia Hola, ¿quién eres?*',
    })
  }

  await sock.sendMessage(chatId, {
    text: '🧠 AMILCAR AI está pensando...',
  })

  try {
    const resultado = await ia.chat(pregunta)
    const aviso = resultado.trained ? '' : '\n\n_Nota: el modelo aún no está entrenado._'
    const respuesta = `🤖 *AMILCAR AI*\n\n${resultado.reply.trim() || 'No se recibió una respuesta con texto.'}${aviso}\n\n_🧠 Modelo: ${resultado.model}_`
    await sock.sendMessage(chatId, { text: respuesta })
  } catch (err) {
    const mensaje = err instanceof AmilcarAIError && err.status === 503
      ? 'El modelo AMI-Base todavía no está entrenado. Entrénalo e inicia nuevamente la API.'
      : err?.code === 'TIMEOUT'
        ? 'La IA tardó demasiado en responder. Inténtalo otra vez.'
        : 'No pude conectar con AMILCAR AI. Comprueba que la API esté encendida y que AMILCAR_AI_URL apunte a su dirección.'

    await sock.sendMessage(chatId, {
      text: `⚠️ *AMILCAR AI no está disponible*\n\n${mensaje}`,
    })
  }
}
