# braille-app

Software de la **Solución basada en tecnología para promover la lectoescritura del sistema Braille en
estudiantes con discapacidad visual de Norte de Santander** (proyecto de grado, Ingeniería de
Sistemas, UFPS). Las decisiones de arquitectura están justificadas en el _Informe de selección
justificada de la solución basada en tecnología_.

Un aplicativo web (PWA) controla por USB un dispositivo Braille basado en ESP32 mediante la Web
Serial API. El dispositivo solo mueve puntos y reporta pulsaciones; toda la lógica Braille vive en
el software.

## Estructura

```text
braille-app/
├─ apps/
│  ├─ web/                  PWA (Vite + React). Hoy: demo de integración de la serie a–j
│  └─ api/                  Backend NestJS (se crea al final del MVP; ver su README)
├─ packages/
│  ├─ braille-core/         Celda, tabla de signos, traducción y evaluación de errores
│  ├─ protocol/             Contrato app ↔ ESP32: esquemas Zod, NDJSON y tiempos
│  └─ device/               Puerto DispositivoBraille + adaptadores (simulador, Web Serial)
├─ firmware/                Firmware PlatformIO del ESP32: cableado y pruebas en su README
├─ docs/PROTOCOLO.md        Contrato de comunicación: la fuente de verdad
├─ docs/PRUEBAS-JAWS.md     Protocolo de pruebas manuales con JAWS y su registro
└─ .github/workflows/ci.yml Lint, tipos, pruebas y build en cada PR
```

Dependencias entre paquetes: `web → device → protocol` y `web → braille-core`. Ni `protocol` ni
`braille-core` dependen de la interfaz ni del hardware.

## Requisitos

- Node.js 22 LTS (22.13 o superior) y pnpm 10.
- Para el dispositivo real: Chrome o Edge de escritorio (Firefox 151+ también soporta Web Serial).
- Para el firmware: VS Code con PlatformIO.
- Para accesibilidad: NVDA (gratuito) y, si es posible, JAWS.

## Primera vez en Windows

1. Instalar Node.js 22 LTS desde nodejs.org.
2. En PowerShell como administrador: `corepack enable` (activa pnpm). Comprobar con `pnpm -v`.
3. Descomprimir el repositorio en una ruta corta, por ejemplo `C:\dev\braille-app`.
4. En esa carpeta: `pnpm install`, luego `pnpm test` (todo debe pasar) y `pnpm dev`.

## Comandos

| Comando          | Qué hace                                                        |
| ---------------- | --------------------------------------------------------------- |
| `pnpm install`   | Instala todo el monorepo                                        |
| `pnpm dev`       | Abre la demo en http://localhost:5173                           |
| `pnpm test`      | Pruebas de todos los paquetes (con cobertura en `braille-core`) |
| `pnpm lint`      | ESLint, incluidas las reglas de accesibilidad de `jsx-a11y`     |
| `pnpm typecheck` | TypeScript en modo estricto                                     |
| `pnpm build`     | Build de producción de la web                                   |
| `pnpm format`    | Formatea con Prettier                                           |

Para un solo paquete: `pnpm --filter @braille/core test`.

## Probar la demo

1. `pnpm dev` y abrir http://localhost:5173 en Chrome o Edge.
2. **Sin dispositivo:** enfocar el área de escritura y escribir con F, D, S (puntos 1, 2, 3) y
   J, K, L (puntos 4, 5, 6); el acorde se confirma al soltar todas las teclas. También sirve la
   celda virtual.
3. **Con dispositivo:** cargar el firmware (`firmware/README.md`), **cerrar el monitor serie** de
   PlatformIO y usar "Conectar dispositivo por USB".
4. **Con lector de pantalla:** seguir `docs/PRUEBAS-JAWS.md`.

La región de anuncios es ARIA _live_: con NVDA o JAWS activos, los mensajes se leen con la voz del
lector de pantalla.

## Estado de la tabla Braille

`pnpm --filter @braille/core test` muestra los signos pendientes como **todo**. Hoy 17 signos están
verificados contra una fuente independiente (lo que dictaron los tiflólogos en la Entrevista #1) y
28 están pendientes.

Para validar un signo:

1. Transcribirlo de la signografía oficial en `packages/braille-core/test/referencia.ts`, con su
   fuente. Idealmente lo hace el integrante que no escribió `src/tabla.ts`.
2. Validarlo con los tiflólogos en sesión táctil (en la celda física o en macrotipo).
3. Si la prueba falla, se corrige la tabla o la referencia, según cuál tenga el error.

## Cómo trabajamos

- Ramas cortas desde `main`, mensajes con _Conventional Commits_ (`feat:`, `fix:`, `test:`…).
- Todo cambio entra por PR revisado por el otro integrante y con el CI en verde.
- Un cambio al protocolo toca en el mismo PR: `docs/PROTOCOLO.md`, `packages/protocol` y el
  firmware. `packages/device/src/pruebas/firmware-falso.ts` es la referencia ejecutable de lo que
  debe hacer el firmware.

## Próximos pasos

- [x] Firmware PlatformIO que cumple la lista de verificación de `docs/PROTOCOLO.md`.
- [ ] Primera carga del firmware en la placa y calibración de los servos.
- [ ] Ejecutar `docs/PRUEBAS-JAWS.md` con JAWS y NVDA, y registrar los resultados.
- [ ] Completar y validar la tabla de signos con los tiflólogos.
- [ ] Pruebas de interfaz con Testing Library y Playwright + axe en CI.
- [ ] Interfaz final con React Aria y la identidad visual definida en la ideación.
- [ ] Backend NestJS (identidad, contenidos, progreso) y sincronización sin conexión.
