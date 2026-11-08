/**
 * Respuestas a botones del bot con onButton (Yui-Bails). Se registran una sola vez al crear el socket.
 * Los comandos .helpers unavez / carrusel envían los botones que se atienden aquí.
 */
export function registrarRespuestas(sock) {
  if (typeof sock.onButton !== 'function') return // Yui-Bails desactualizado: ya se avisa al arrancar

  // Solo cuenta el primer toque de cada menú; los demás reciben un aviso
  sock.onButton(
    'demo_unavez',
    (msg, r) => sock.reply(msg, `✅ Primer toque registrado: *${r.text || r.id}*`),
    { once: true, onUsed: (msg) => sock.reply(msg, '✋ Este menú ya fue usado. Pide otro con *.helpers unavez*.') }
  )

  sock.onButton(/^carrusel_/, (msg, r) =>
    sock.reply(msg, `🛍️ Elegiste *${r.id.replace('carrusel_', '')}* en el carrusel.`)
  )
}
