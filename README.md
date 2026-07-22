<div align="center">

# 🤖 WhatsApp Bot Base

**Plantilla base para crear tu propio bot de WhatsApp**, construida sobre [Baileys](https://github.com/WhiskeySockets/Baileys), con vinculación mediante **código de emparejamiento** (sin escanear QR).

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-6.7.x-25D366?logo=whatsapp&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## 📋 Índice

- [Características](#-características)
- [Requisitos](#-requisitos)
- [Instalación rápida](#-instalación-rápida)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)
- [Comandos incluidos](#-comandos-incluidos)
- [Cómo agregar un comando nuevo](#-cómo-agregar-un-comando-nuevo)
- [Buenas prácticas para tus comandos](#-buenas-prácticas-para-tus-comandos)
- [Despliegue](#-despliegue)
- [Problemas comunes](#-problemas-comunes)
- [Licencia](#-licencia)

---

## ✨ Características

| Característica | Descripción |
|---|---|
| 🔗 Vinculación por código | No requiere escanear QR, ideal para VPS/Termux sin pantalla |
| 🔁 Reconexión automática | Backoff exponencial, hasta 8 intentos, tope de 5 min |
| 🚪 Manejo de sesión | Distingue cierre de sesión (`loggedOut`) de desconexión recuperable (`401`) |
| ⚡ Caché de grupos | `groupMetadata` con TTL para no saturar la API de WhatsApp |
| 🐢 Anti rate-limit | Pausa automática ante errores `429` |
| 🧩 Comandos extensibles | Cada comando es un archivo independiente en `commands/` |
| 📜 Menú automático | `.menu` lista todos los comandos registrados, sin mantenimiento manual |
| 📦 ES Modules | Proyecto 100% `type: module`, sin `require()` |

---

## ✅ Requisitos

- Node.js **20 o superior**
- Un número de WhatsApp para vincular el bot (puede ser distinto al tuyo personal)
- npm

---

## 🚀 Instalación rápida

```bash
git clone https://github.com/AmilcarGit/BaseBot.git
cd BaseBot
git pull
npm install
npm start
```

Al iniciar por primera vez, la consola te pedirá el número de WhatsApp del bot (con código de país, sin `+`). Te devolverá un **código de 8 dígitos**:

1. Abre WhatsApp en tu teléfono
2. Ve a **Dispositivos vinculados → Vincular con número de teléfono**
3. Ingresa el código mostrado en consola

Una vez vinculado, la sesión queda guardada en `session/` y no se te volverá a pedir el código.

---

## 📁 Estructura del proyecto

```
.
├── index.js              # Conexión a Baileys: vinculación, reconexión, eventos
├── handler.js             # Enrutador de mensajes → despacha al comando correcto
├── config.js               # Configuración global del bot
├── package.json
├── commands/
│   ├── menu.js               # Menú que lista los comandos automáticamente
│   └── ping.js                # Comando de ejemplo (latencia)
├── lib/
│   ├── utils.js                 # normalizarJid, esOwner, delay, backoff
│   └── groupCache.js             # Caché de metadata de grupos con TTL
└── session/                        # Credenciales de sesión (se genera solo, no subir a git)
```

---

## ⚙️ Configuración

Todo se controla desde `config.js`:

| Clave | Descripción |
|---|---|
| `nombreBot` | Nombre mostrado en el menú y logs |
| `prefijo` | Prefijo de comandos (ej. `.`, `!`, o `''` para ninguno) |
| `owner` | Array de números con permisos de dueño (código de país, sin `+`) |
| `numeroBot` | Número para vincular el bot. Vacío = se pide por consola al iniciar |
| `sessionFolder` | Carpeta donde se guarda la sesión |
| `groupCacheTTL` | Tiempo de vida del caché de metadata de grupos (ms) |
| `rateLimitPause` | Pausa aplicada cuando WhatsApp responde `429` (ms) |
| `maxReconnectAttempts` | Intentos máximos de reconexión |
| `maxReconnectDelay` | Tope de espera entre reintentos (ms) |

---

## 🧾 Comandos incluidos

| Comando | Descripción |
|---|---|
| `.menu` | Muestra la lista de comandos disponibles |
| `.ping` | Muestra la latencia del bot |

---

## 🧩 Cómo agregar un comando nuevo

**Paso 1 — Crea el archivo del comando** en `commands/`, por ejemplo `commands/hola.js`:

```js
export default async function hola({ sock, chatId, args, esDueno }) {
  await sock.sendMessage(chatId, { text: `¡Hola! 👋` })
}
```

Cada comando recibe un solo objeto con:

| Propiedad | Tipo | Descripción |
|---|---|---|
| `sock` | `WASocket` | La instancia activa de Baileys, para enviar mensajes, medios, etc. |
| `msg` | `object` | El mensaje original completo |
| `args` | `string[]` | Palabras después del comando (`.hola juan mario` → `['juan', 'mario']`) |
| `chatId` | `string` | JID del chat donde responder |
| `esDueno` | `boolean` | `true` si quien escribió es un owner definido en `config.js` |
| `comandos` | `object` | El registro completo de comandos (útil para `.menu` o ayuda dinámica) |
| `config` | `object` | La configuración global del bot |

**Paso 2 — Regístralo en `handler.js`**, con una descripción corta que se usará automáticamente en `.menu`:

```js
import hola from './commands/hola.js'

const comandos = {
  menu: { run: menu, desc: 'Muestra este menú de comandos' },
  ping: { run: ping, desc: 'Muestra la latencia del bot' },
  hola: { run: hola, desc: 'Saluda al usuario' },
}
```

Eso es todo — no necesitas tocar `commands/menu.js`: recorre el objeto `comandos` y arma la lista solo.

### Ejemplo con argumentos y validación de owner

```js
export default async function ban({ sock, chatId, args, esDueno }) {
  if (!esDueno) {
    return sock.sendMessage(chatId, { text: '⛔ Solo el owner puede usar este comando.' })
  }

  const numero = args[0]
  if (!numero) {
    return sock.sendMessage(chatId, { text: '📌 Uso: .ban 519XXXXXXXX' })
  }

  // tu lógica aquí...
  await sock.sendMessage(chatId, { text: `✅ ${numero} procesado.` })
}
```

---

## 🧠 Buenas prácticas para tus comandos

- Mantén cada comando en su **propio archivo** — facilita el mantenimiento y evita conflictos al fusionar cambios de Git.
- Valida `esDueno` para cualquier acción sensible (banear, apagar el bot, configurar cosas globales).
- Usa `try/catch` dentro de comandos que llamen APIs externas, para que un error no tumbe el proceso.
- Si tu comando necesita datos de grupo, usa `getGroupMetadataCached` de `lib/groupCache.js` en vez de `sock.groupMetadata()` directo, para no saturar la API.
- Evita `sharp` si vas a correr el bot en Termux/Android — usa `jimp` (ya incluido en las dependencias).

---

## ☁️ Despliegue

Esta base funciona igual en:

- **VPS** (Ubuntu/Debian) — recomendado `pm2` para mantener el proceso vivo:
  ```bash
  npm install -g pm2
  pm2 start index.js --name mi-bot
  pm2 save
  ```
- **Termux (Android)** — funciona directo con `npm start`; considera `termux-wake-lock` para evitar que el sistema mate el proceso.

---

## 🛠️ Problemas comunes

| Problema | Causa probable | Solución |
|---|---|---|
| `useMultiFileAuthState is not a function` | Import mal formado tras actualizar Baileys | Usa `import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'` |
| Error `408`/`428` al pedir el código | El número se pidió después de abrir la conexión y WhatsApp cerró por timeout | Define `numeroBot` en `config.js` para no depender de la entrada por consola |
| `ERESOLVE` con `jimp` | Versión de `jimp` desactualizada frente a la que pide Baileys | Usa `jimp@^1.6.0` en `package.json` |

---

## 📄 Licencia

MIT — úsalo, modifícalo y publica tu propio bot libremente.
