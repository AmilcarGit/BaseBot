import { AmilcarAI, AmilcarAIError } from 'amilcar-ai'

export const desc = 'Chatea con AMILCAR AI'
export const alias = ['amilcar', 'ai']
export const cooldown = 5

const ia = new AmilcarAI({
  mode: process.env.AMILCAR_AI_MODE || 'hybrid',
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
    const aviso = resultado.mode === 'hybrid' || resultado.trained ? '' : '\n\n_Nota: el modelo aún no está entrenado._'
    const respuesta = `🤖 *AMILCAR AI*\n\n${resultado.reply.trim() || 'No se recibió una respuesta con texto.'}${aviso}\n\n_🧠 Modelo: ${resultado.model}_`
    await sock.sendMessage(chatId, { text: respuesta })
  } catch (err) {
    const mensaje = err instanceof AmilcarAIError && err.status === 503
      ? 'El modelo AMI-Base todavía no está entrenado. Entrénalo e inicia nuevamente la API.'
      : err?.code === 'TIMEOUT'
        ? 'La IA tardó demasiado en responder. Inténtalo otra vez.'
        : err?.code === 'MODEL_NOT_FOUND' || err?.code === 'LOCAL_START_FAILED' || err?.code === 'PYTHON_START_FAILED'
        ? 'El motor local no está preparado. AMILCAR AI necesita Python, sus dependencias y un checkpoint AMI entrenado. Revisa la guía del repositorio.'
        : 'No pude iniciar AMILCAR AI en modo local. Comprueba Python, las dependencias y la ruta del modelo. Para usar el servidor opcional, configura AMILCAR_AI_MODE=api y AMILCAR_AI_URL.'

    await sock.sendMessage(chatId, {
      text: `⚠️ *AMILCAR AI no está disponible*\n\n${mensaje}`,
    })
  }
}
