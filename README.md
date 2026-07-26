<div align="center">

![GitHub stars](https://img.shields.io/github/stars/AmilcarGit/BaseBot?style=social)
![GitHub forks](https://img.shields.io/github/forks/AmilcarGit/BaseBot?style=social)

# 🤖 WhatsApp Bot Base

<a href='https://postimg.cc/CBKpRN5t' target='_blank'><img src='https://i.postimg.cc/HxwYPvgp/file-00000000e520820e93edc45acabd1530.png' border='0' alt='file-00000000e520820e93edc45acabd1530'></a>

**Plantilla base para crear tu propio bot de WhatsApp**, construida sobre [Baileys](https://github.com/WhiskeySockets/Baileys), con vinculación mediante **código de emparejamiento** (sin escanear QR).

![Node.js](https://img.shields.io/badge/Node.js-%3E%3D20-339933?logo=node.js&logoColor=white)
![npm](https://img.shields.io/badge/npm-%3E%3D10-CB3837?logo=npm&logoColor=white)
![Baileys](https://img.shields.io/badge/Baileys-6.7.x-25D366?logo=whatsapp&logoColor=white)
![License](https://img.shields.io/badge/license-MIT-blue)

</div>

---

## 📋 Índice

- [Características](#-características)
- [¿Por qué esta base?](#-por-qué-esta-base)
- [Requisitos](#-requisitos)
- [Instalación rápida](#-instalación-rápida)
- [Estructura del proyecto](#-estructura-del-proyecto)
- [Configuración](#-configuración)
- [Comandos incluidos](#-comandos-incluidos)
- [Cómo agregar un comando nuevo](#-cómo-agregar-un-comando-nuevo)
- [Ejemplos prácticos](#-ejemplos-prácticos)
- [Buenas prácticas para tus comandos](#-buenas-prácticas-para-tus-comandos)
- [Despliegue](#-despliegue)
- [Problemas comunes](#-problemas-comunes)
- [Soporte](#-soporte)
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

## 🎯 ¿Por qué esta base?

Hay muchas plantillas de bots de WhatsApp, pero **BaseBot** destaca por:

✅ **Sin dependencias pesadas innecesarias** — solo Baileys y lo esencial  
✅ **Estructura clara y escalable** — agregar comandos es literal copiar-pegar  
✅ **Listo para producción** — incluye manejo de errores, reconexión y caché  
✅ **Funciona en cualquier lugar** — VPS, Termux, computadora local  
✅ **Documentación completa** — cada sección está bien explicada  
✅ **Mantenido activamente** — recibe actualizaciones junto con Baileys

---

## ✅ Requisitos

- Node.js **20 o superior**
- npm **10 o superior**
- Un número de WhatsApp para vincular el bot (puede ser distinto al tuyo personal)

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
├── handler.js            # Enrutador de mensajes → despacha al comando correcto
├── config.js             # Configuración global del bot
├── package.json
├── commands/
│   ├── menu.js           # Menú que lista los comandos automáticamente
│   └── ping.js           # Comando de ejemplo (latencia)
├── lib/
│   ├── utils.js          # normalizarJid, esOwner, delay, backoff
│   └── groupCache.js     # Caché de metadata de grupos con TTL
└── session/              # Credenciales de sesión (se genera solo, no subir a git)
```

---

## ⚙️ Configuración

Todo se controla desde `config.js`:

| Clave | Descripción | Ejemplo |
|---|---|---|
| `nombreBot` | Nombre mostrado en el menú y logs | `"Mi Bot"` |
| `prefijo` | Prefijo de comandos | `.`, `!`, o `''` |
| `owner` | Array de números con permisos de dueño | `['5491234567890']` |
| `numeroBot` | Número para vincular. Vacío = se pide por consola | `''` |
| `sessionFolder` | Carpeta donde se guarda la sesión | `'./session'` |
| `groupCacheTTL` | TTL del caché de grupos (ms) | `300000` |
| `rateLimitPause` | Pausa ante error `429` (ms) | `3000` |
| `maxReconnectAttempts` | Intentos máximos de reconexión | `8` |
| `maxReconnectDelay` | Tope de espera entre reintentos (ms) | `300000` |

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
| `sock` | `WASocket` | La instancia activa de Baileys |
| `msg` | `object` | El mensaje original completo |
| `args` | `string[]` | Palabras después del comando |
| `chatId` | `string` | JID del chat donde responder |
| `esDueno` | `boolean` | `true` si es un owner |
| `comandos` | `object` | Registro completo de comandos |
| `config` | `object` | Configuración global del bot |

**Paso 2 — Regístralo en `handler.js`**, con una descripción:

```js
import hola from './commands/hola.js'

const comandos = {
  menu: { run: menu, desc: 'Muestra este menú de comandos' },
  ping: { run: ping, desc: 'Muestra la latencia del bot' },
  hola: { run: hola, desc: 'Saluda al usuario' },
}
```

Eso es todo — `.menu` se actualiza automáticamente.

---

## 📚 Ejemplos prácticos

### Ejemplo 1: Comando con argumentos y validación de owner

```js
export default async function ban({ sock, chatId, args, esDueno }) {
  if (!esDueno) {
    return sock.sendMessage(chatId, { text: '⛔ Solo el owner puede usar esto.' })
  }

  const numero = args[0]
  if (!numero) {
    return sock.sendMessage(chatId, { text: '📌 Uso: .ban 519XXXXXXXX' })
  }

  await sock.sendMessage(chatId, { text: `✅ ${numero} procesado.` })
}
```

### Ejemplo 2: Comando que consume una API

```js
export default async function clima({ sock, chatId, args }) {
  const ciudad = args.join(' ')
  
  if (!ciudad) {
    return sock.sendMessage(chatId, { text: '🌍 Uso: .clima Buenos Aires' })
  }

  try {
    const res = await fetch(`https://api.ejemplo.com/clima?q=${ciudad}`)
    const data = await res.json()
    
    await sock.sendMessage(chatId, { 
      text: `🌤️ ${data.ciudad}\n📊 Temp: ${data.temp}°C` 
    })
  } catch (error) {
    await sock.sendMessage(chatId, { text: '❌ Error al obtener datos.' })
  }
}
```

### Ejemplo 3: Comando que envía una imagen

```js
export default async function foto({ sock, chatId }) {
  try {
    await sock.sendMessage(chatId, {
      image: { url: 'https://ejemplo.com/imagen.jpg' },
      caption: '📸 Aquí está tu imagen'
    })
  } catch (err) {
    await sock.sendMessage(chatId, { text: '❌ Error al enviar imagen.' })
  }
}
```

---

## 🧠 Buenas prácticas para tus comandos

- Mantén cada comando en su **propio archivo** — facilita el mantenimiento.
- Valida `esDueno` para acciones sensibles (ban, apagar, etc).
- Usa `try/catch` en comandos que llamen APIs externas.
- Para datos de grupo, usa `getGroupMetadataCached` de `lib/groupCache.js` en lugar de `sock.groupMetadata()`.
- Evita `sharp` en Termux/Android — usa `jimp` en su lugar.
- Siempre retorna tras enviar un mensaje de error.
- Sanitiza inputs de usuarios antes de usarlos.

---

## ☁️ Despliegue

### VPS (Ubuntu/Debian)

Con `pm2` para mantener el proceso vivo:

```bash
npm install -g pm2
pm2 start index.js --name BaseBot
pm2 save
pm2 startup
```

Ver logs:
```bash
pm2 logs BaseBot
```

### Termux (Android)

Funciona directo:

```bash
npm start
```

Con `termux-wake-lock` para mantener activo:
```bash
termux-wake-lock
npm start
```

---

## 🛠️ Problemas comunes

| Problema | Causa | Solución |
|---|---|---|
| `useMultiFileAuthState is not a function` | Import mal en Baileys | Usa `import makeWASocket, { useMultiFileAuthState } from '@whiskeysockets/baileys'` |
| Error `408`/`428` | Timeout al pedir código | Define `numeroBot` en `config.js` |
| `ERESOLVE` con `jimp` | Versión desactualizada | Usa `jimp@^1.6.0` |
| Bot no se reconecta | Event handler no configurado | Revisa `index.js` |
| Mensajes no se envían a grupos | Sin permisos o removido del grupo | Verifica que esté en el grupo |
| "Rate limit exceeded" | Demasiados mensajes rápido | Aumenta `rateLimitPause` o usa delays |

---

## 💬 Soporte

¿Problemas o dudas?

- 🐛 **[Abre un issue](https://github.com/AmilcarGit/BaseBot/issues)** con detalles del problema
- 💡 **[Sugerencias](https://github.com/AmilcarGit/BaseBot/discussions)** — usa Discussions
- ⭐ Si te fue útil, **dale una estrella** al repo
- 📖 Consulta la [documentación de Baileys](https://github.com/WhiskeySockets/Baileys)

---

## 📄 Licencia

MIT — úsalo, modifícalo y publica tu propio bot libremente.

Hecho con ❤️ por [AmilcarGit](https://github.com/AmilcarGit)
