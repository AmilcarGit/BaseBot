# WhatsApp Bot Base

Base para crear tu propio bot de WhatsApp usando [Baileys](https://github.com/WhiskeySockets/Baileys), con vinculación mediante **código de emparejamiento** (no requiere escanear QR).

## Características

- Vinculación por código (pairing code), ideal para VPS sin pantalla.
- Reconexión automática con backoff exponencial (hasta 8 intentos, tope de 5 min).
- Distinción entre cierre de sesión (`loggedOut`) y desconexión recuperable (`401`).
- Caché de `groupMetadata` con TTL para no saturar la API de WhatsApp.
- Manejo básico de rate limit (`429`) con pausa automática.
- Estructura de comandos simple y extensible (`commands/`).
- Módulos ES (`type: module`).

## Instalación

```bash
git clone https://github.com/TU-USUARIO/TU-REPO.git
cd TU-REPO
npm install
npm start
```

Al iniciar por primera vez, la consola te pedirá el número de WhatsApp que usarás para vincular el bot (o puedes definirlo en `config.js` en `numeroBot`). Luego te mostrará un **código de 8 dígitos**: en tu teléfono ve a *WhatsApp > Dispositivos vinculados > Vincular con número de teléfono* e ingrésalo.

## Estructura del proyecto

```
├── index.js           # Conexión a Baileys, vinculación y reconexión
├── handler.js          # Enrutador de mensajes entrantes
├── config.js            # Configuración global (nombre, owner, prefijo, etc.)
├── commands/
│   └── ping.js           # Comando de ejemplo
├── lib/
│   ├── utils.js            # normalizarJid, esOwner, delay, backoff
│   └── groupCache.js        # Caché de metadata de grupos
└── session/                  # Credenciales de la sesión (se genera solo)
```

## Agregar un comando nuevo

Crea un archivo en `commands/`, por ejemplo `commands/hola.js`:

```js
export default async function hola({ sock, chatId }) {
  await sock.sendMessage(chatId, { text: '¡Hola! 👋' })
}
```

Y regístralo en `handler.js`:

```js
import hola from './commands/hola.js'

const comandos = {
  ping,
  hola,
}
```

## Notas importantes

- No uses `sharp` si vas a correr el bot en Termux/Android; usa `jimp` (ya incluido).
- El `owner` en `config.js` debe llevar el número completo con código de país, sin `+` ni espacios.
- La carpeta `session/` contiene tus credenciales: **nunca la subas a un repositorio público**.

## Licencia

MIT — úsalo y modifícalo libremente para tu propio bot.

