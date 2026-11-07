# braille-frontend

Aplicativo web, paquetes compartidos y firmware del ESP32 del proyecto de grado **Solución basada en
tecnología para promover la lectoescritura del sistema Braille en estudiantes con discapacidad
visual de Norte de Santander** (Ingeniería de Sistemas, UFPS; Omar Jaimes y Bryan Vera). La API vive
en el repositorio hermano `braille-backend` (normalmente en `../braille-backend`).

<!-- Mantener por debajo de ~200 líneas. Si cambia una decisión descrita aquí, actualizar este
archivo en el mismo PR. Lo personal va en CLAUDE.local.md (no versionado). -->

## Contexto que el código no muestra

- **Usuarios:** estudiantes con discapacidad visual (la mayoría con baja visión; pocos ciegos) y
  docentes tiflólogos. También personas videntes: docentes, familias y compañeros.
- **Qué se enseña:** braille integral en español por series del código generador: a–j, k–t (+
  punto 3), u–z (+ puntos 3 y 6). La estenografía está fuera del alcance.
- **Errores que importan:** espejo (1↔4, 2↔5, 3↔6), punto faltante y punto sobrante.
- **Validación pedagógica:** los signos y el contenido los validan los tiflólogos. No se decide
  nada sobre signos o pedagogía solo desde el código; ante la duda, preguntar.
- Metas clave: WCAG 2.2 AA (RNF-01), sonido de acierto o error ≤ 100 ms tras soltar el acorde
  (RNF-02), celda posicionada ≤ 1 s (RNF-03), desconexión detectada (RNF-09: cable retirado al instante; dispositivo que calla, ~5,5 s por el latido), cobertura ≥ 80 %
  en `braille-core` (RNF-10).

## Etapa actual: versión de prueba

- Lo que hay hoy es una **versión de prueba**: una sola pantalla (`apps/web/src/App.tsx`) con
  lectura (levantar un signo en la celda), escritura por acordes de las series a–j, k–t y u–z,
  visor de la celda y conexión al simulador o al ESP32. No hay rutas, ni cliente de la API, ni
  registro de progreso, ni PWA todavía.
- Los PR de esta etapa llevan la etiqueta **`prototipo`** (también en `braille-backend`) y sus
  ramas empiezan por `prototipo/`. La interfaz muestra "Versión de prueba" junto al título.

## Stack (versiones exactas en cada `package.json`)

Monorepo pnpm 10.28 + Turborepo 2 · Node.js ≥ 22.13 · TypeScript 6 estricto · React 19 · Vite 8 ·
Zod 4 (en `protocol`) · Vitest 5 (+ cobertura v8 en `braille-core`) · ESLint 10 con
`typescript-eslint`, `jsx-a11y` (estricto) y `react-hooks` · Prettier · Firmware: PlatformIO,
Arduino, ArduinoJson 7 y ESP32Servo 3.

## Estructura actual

```text
apps/web/                 @braille/web: Vite + React; App.tsx (pantalla única), estilos.css, main.tsx
packages/
├── braille-core/         @braille/core: celda.ts, tabla.ts (45 signos), traduccion.ts, evaluacion.ts
│   └── test/             Pruebas, oráculo independiente (referencia.ts) y umbral de cobertura 80 %
├── protocol/             @braille/protocol: mensajes.ts (Zod), codec.ts (NDJSON), constantes.ts, ejemplos.ts
└── device/               @braille/device: puerto.ts (DispositivoBraille), simulador.ts, web-serial.ts,
    │                     teclado-seis-teclas.ts
    └── src/pruebas/      firmware-falso.ts, exportado como `@braille/device/pruebas`
firmware/                 PlatformIO: src/main.cpp, include/configuracion.h, platformio.ini
docs/                     PROTOCOLO.md (contrato con el ESP32) y PRUEBAS-NVDA.md (pruebas manuales)
```

Los paquetes exportan su `src/index.ts` directamente (sin paso de compilación).

## Arquitectura (no romper)

- **El dispositivo es un periférico sin lógica de dominio:** mueve puntos y reporta acordes. Toda
  la lógica Braille vive en `packages/braille-core`.
- **Dependencias permitidas:** `apps/web → packages/device → packages/protocol` y
  `apps/web → packages/braille-core`. `braille-core` y `protocol` no importan React, el DOM ni nada
  del hardware.
- **Puertos y adaptadores:** la interfaz solo conoce el puerto `DispositivoBraille`
  (`packages/device/src/puerto.ts`). Adaptadores: `SimuladorDispositivo` y `DispositivoWebSerial`;
  a futuro, Bluetooth.
- **Sin red en el ciclo de práctica:** acorde → evaluación → retroalimentación ocurre en el
  navegador. El backend solo recibirá el progreso ya registrado.
- **Funciona sin dispositivo:** celda virtual y entrada de seis teclas (F D S = puntos 1 2 3;
  J K L = puntos 4 5 6).

## Comandos (PowerShell, en la raíz)

| Comando                              | Qué hace                                          |
| ------------------------------------ | ------------------------------------------------- |
| `pnpm install`                       | Instala el monorepo (usar pnpm, nunca npm)        |
| `pnpm dev`                           | Web en http://localhost:5173                      |
| `pnpm build`                         | Build de producción de la web (turbo)             |
| `pnpm --filter @braille/web preview` | Previsualiza el build                             |
| `pnpm test`                          | Pruebas de los paquetes y de la web (jsdom + axe) |
| `pnpm --filter @braille/core test`   | Un solo paquete (con cobertura en braille-core)   |
| `pnpm lint` / `pnpm typecheck`       | ESLint / TypeScript en cada paquete (turbo)       |
| `pnpm format` / `pnpm format:check`  | Prettier                                          |
| `pio run` (en `firmware/`)           | Compila el firmware (requiere PlatformIO Core)    |

No hay `test:watch` en la raíz: usar `pnpm --filter <paquete> exec vitest`. El CI corre
`format:check`, `lint`, `typecheck`, `test` y `build`, y en otro trabajo `pio run`. Antes de dar un
cambio por terminado, correr esos cinco en ese orden.

## Accesibilidad (requisito, no adorno)

- Meta WCAG 2.2 AA; la Resolución 1519 de 2020 exige como mínimo WCAG 2.1 AA.
- **Una sola voz:** todo anuncio va a la región `role="status"` `aria-live="polite"` de la app. No
  usar `speechSynthesis` mientras haya lector de pantalla; la voz propia es solo para un futuro
  modo autónomo (hoy no existe).
- Las teclas F D S J K L solo se capturan dentro del área con `role="application"`; fuera de ella
  pertenecen a la navegación rápida de NVDA y JAWS. El bloque `eslint-disable` de `jsx-a11y`
  alrededor de esa área es intencional: no quitarlo ni ampliarlo.
- Celda virtual: cada punto es un botón conmutador (`aria-pressed`) llamado "Punto 1"…"Punto 6".
- Nada solo visual: acierto y error se comunican con relieve, sonido y texto (el sonido aún no
  está implementado: hoy hay texto anunciado y eco en la celda). Textos en español
  claro, escritos para ser escuchados; traducir los errores del navegador antes de anunciarlos.
- Contraste ≥ 4,5:1 en texto y ≥ 3:1 en componentes; controles ≥ 24 × 24 px (meta 44 × 44); respetar
  `prefers-reduced-motion`, `prefers-contrast` y `forced-colors`. No relajar reglas de `jsx-a11y`.
- Claude no puede probar con NVDA ni con el hardware. Al terminar un cambio de interacción, decir
  qué casos de `docs/PRUEBAS-NVDA.md` hay que repetir a mano.

## braille-core

- Máscara de 6 bits: el bit _i_ − 1 es el punto _i_ (c = puntos 1 y 4 = 9).
- `src/tabla.ts` tiene 45 signos. Solo 17 están verificados contra una fuente independiente (a–n,
  v, x y el signo de mayúscula, dictados en la Entrevista #1); los demás aparecen como `todo`.
- Las pruebas comparan la tabla contra un oráculo independiente (`test/referencia.ts`) que cita su
  fuente. Nunca cambiar `tabla.ts` y `referencia.ts` a la vez para que una prueba pase, y nunca
  inventar un signo: sin fuente, se queda en `todo`.
- La cobertura mínima de 80 % (`vitest.config.ts`) bloquea el CI.

## Protocolo app ↔ ESP32

- La fuente de verdad es `docs/PROTOCOLO.md` (versión 1): leerlo antes de tocar
  `packages/protocol`, `packages/device` o `firmware/`.
- NDJSON a 115200 baudios (8N1). App → dispositivo: `hello`, `cell`, `clear`, `ping`. Dispositivo →
  app: `boot`, `info`, `ack`, `chord`, `press` (acorde en curso), `key`, `pong` y `err`.
- `proto` es la versión del protocolo y solo sube con cambios incompatibles; `fw` es la versión del
  firmware (hoy `0.2.2`).
- Tiempos y límites en `packages/protocol/src/constantes.ts`; no duplicar esos números en otro lado.
- Un cambio al protocolo toca en el mismo PR: `docs/PROTOCOLO.md`, `packages/protocol`,
  `packages/device/src/pruebas/firmware-falso.ts` (especificación ejecutable del firmware) y
  `firmware/`.

## Firmware (`firmware/`)

- PlatformIO, placa `esp32dev`, framework Arduino. No bloqueante: todo con `millis()`, nunca
  `delay()` en el lazo principal. No traduce Braille ni decide aciertos.
- Pines, ángulos y tiempos solo en `include/configuracion.h`. Hoy solo la tecla "repetir" tiene pin
  (GPIO 4); espacio, borrar y confirmar están sin asignar (`-1`).
- Servos escalonados y alimentados con fuente externa de 5 V. Evitar los GPIO de arranque (0, 2, 5,
  12, 15), los de la flash (6–11) y los del puerto serie (1 y 3).
- Cargar la placa, el monitor serie y la calibración los hace una persona con la placa conectada.
  Solo un programa a la vez abre el puerto COM: cerrar el monitor serie para que la app se conecte.

## Convenciones de código

- Español en identificadores, comentarios, textos de interfaz, documentación y commits; inglés solo
  donde lo exige una API o librería.
- TypeScript estricto con `noUncheckedIndexedAccess` y `verbatimModuleSyntax` (usar `import type`);
  sin `any`. Pruebas con Vitest en `packages/*/test/*.test.ts`.
- No cambiar versiones mayores de dependencias salvo en un PR dedicado.
- Ramas cortas desde `main`; _Conventional Commits_ en español; todo cambio entra por PR revisado
  por el otro integrante y con el CI en verde. Sin enlaces de sesión en commits ni PRs.
- Entorno: Windows con PowerShell, finales de línea LF. Si turbo reporta
  `recursive_turbo_invocations`, falta `pnpm-workspace.yaml` o `turbo.json`.

## Relación con el backend

- El contrato es `openapi.json` de `braille-backend`. Aún no hay cliente de la API ni
  `openapi-typescript`; se agregará cuando exista un endpoint que consumir.
- Cada intento llevará un UUID generado en el cliente y el backend hará _upsert_.
- Si el backend necesita `braille-core`, se publica como paquete privado en GitHub Packages; no se
  copia.

## Diferencias con la propuesta (`../braille-web/CLAUDE.md`)

Registrarlas aquí no cambia ni el código ni la propuesta. Las que tocan arquitectura o el contrato
con el dispositivo exigen un ADR para resolverse.

| Tema                     | Propuesta (`braille-web` y docs del espacio de trabajo)                 | Código actual                                                                 |
| ------------------------ | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Forma del repositorio    | Una app Vite con `src/app`, `features/*`, `shared/*`                    | Monorepo pnpm + turbo: `apps/web` + 3 paquetes                                |
| Gestor de paquetes       | npm (`npm run …`)                                                       | pnpm (`npm` no se usa)                                                        |
| Interfaz del dispositivo | `BrailleDevice` en `features/device`                                    | `DispositivoBraille` en `packages/device`                                     |
| Dominio Braille          | `shared/braille`; datos canónicos desde la API (ADR-0006)               | `packages/braille-core` con tabla propia de 45 signos                         |
| Protocolo serial         | `docs/arquitectura/protocolo-serial.md`: `{"tipo":…}`, `servos_listos`  | `docs/PROTOCOLO.md`: NDJSON `{"t":…}`, `cell`/`ack`, `press`                  |
| Firmware                 | Carpeta `hardware/` o repo propio (ADR-0007 propuesto)                  | `firmware/` dentro de este repositorio                                        |
| Narración                | Guion por claves en `features/narration` + Web Speech API + `aria-live` | Textos en `App.tsx`; solo `aria-live`, sin Web Speech                         |
| Escritura                | Modos formación/simultáneo y orientación pizarra/Perkins (ADR-0005)     | Solo acorde simultáneo; sin modos ni orientaciones                            |
| Cliente de la API        | `shared/api` con tipos de `npm run api:types`                           | No existe                                                                     |
| Pruebas de interfaz      | Testing Library + axe; dispositivo falso en `src/test/`                 | Testing Library + axe en `apps/web/test/`; doble en `@braille/device/pruebas` |
| Comandos                 | `test:watch`, `api:types`, `preview` en la raíz                         | No existen en la raíz                                                         |
| Identificadores          | En inglés (CLAUDE.md raíz)                                              | En español                                                                    |
| Ramas                    | `feature/RF-xx-…`, commits con `(RF-xx)`                                | `prototipo/…`, commits sin RF                                                 |

## Problemas conocidos

- `.vscode/` en la raíz no está versionado ni ignorado (aparece en `git status`).
