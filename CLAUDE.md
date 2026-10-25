# braille-frontend

Aplicativo web (PWA), paquetes compartidos y firmware del ESP32 del proyecto de grado **Solución
basada en tecnología para promover la lectoescritura del sistema Braille en estudiantes con
discapacidad visual de Norte de Santander** (Ingeniería de Sistemas, UFPS; Omar Jaimes y Bryan
Vera). La API vive en el repositorio hermano `braille-backend` (normalmente en `../braille-backend`).

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
- La justificación completa está en el _Informe de selección justificada de la solución_ (fuera
  del repositorio). Metas clave: WCAG 2.2 AA (RNF-01), sonido de acierto o error ≤ 100 ms tras soltar
  el acorde (RNF-02), celda posicionada ≤ 1 s (RNF-03), desconexión detectada ≤ 2 s (RNF-04),
  cobertura ≥ 80 % en `braille-core` (RNF-10).

## Etapa actual: versión de prueba

- Lo que hay hoy (la web de `apps/web`, el firmware y los paquetes) es una **versión de prueba**:
  faltan las entidades de la base de datos, el funcionamiento del backend y el diseño final del
  frontend. No se presenta como versión final.
- Los PR de esta etapa llevan la etiqueta **`prototipo`** en GitHub (también en `braille-backend`) y
  sus ramas empiezan por `prototipo/`. Los de la versión final no la llevan.
- La interfaz muestra la etiqueta "Versión de prueba" junto al título; se quita al pasar a la
  versión final.

## Arquitectura (no romper)

- **El dispositivo es un periférico sin lógica de dominio:** mueve puntos y reporta acordes. Toda
  la lógica Braille vive en `packages/braille-core`.
- **Dependencias permitidas:** `apps/web → packages/device → packages/protocol` y
  `apps/web → packages/braille-core`. `braille-core` y `protocol` no importan React, el DOM ni nada
  del hardware.
- **Puertos y adaptadores:** la lógica de ejercicios solo conoce el puerto `DispositivoBraille`
  (`packages/device/src/puerto.ts`). Adaptadores: `SimuladorDispositivo` y `DispositivoWebSerial`;
  a futuro, Bluetooth.
- **Sin red en el ciclo de práctica:** acorde → evaluación → retroalimentación ocurre en el
  navegador. El backend solo recibe el progreso ya registrado.
- **Funciona sin dispositivo:** celda virtual y entrada de seis teclas (F D S = puntos 1 2 3;
  J K L = puntos 4 5 6).

## Comandos (PowerShell, en la raíz)

| Comando                             | Qué hace                                        |
| ----------------------------------- | ----------------------------------------------- |
| `pnpm install`                      | Instala el monorepo (usar pnpm, nunca npm)      |
| `pnpm dev`                          | Demo en http://localhost:5173                   |
| `pnpm test`                         | Pruebas de todos los paquetes                   |
| `pnpm --filter @braille/core test`  | Un solo paquete (con cobertura en braille-core) |
| `pnpm lint` / `pnpm typecheck`      | ESLint (con jsx-a11y estricto) / TypeScript     |
| `pnpm format` / `pnpm format:check` | Prettier                                        |
| `pnpm build`                        | Build de producción de la web                   |
| `pio run` (en `firmware/`)          | Compila el firmware (requiere PlatformIO Core)  |

Antes de dar un cambio por terminado, correr en este orden (el mismo del CI):
`pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` y `pnpm build`.

## Accesibilidad (requisito, no adorno)

- Meta WCAG 2.2 AA; la Resolución 1519 de 2020 exige como mínimo WCAG 2.1 AA.
- **Una sola voz:** todo anuncio va a la región ARIA _live_ de la app. No usar `speechSynthesis`
  mientras haya lector de pantalla; la voz propia es solo para el modo autónomo.
- Las teclas F D S J K L solo se capturan dentro del área con `role="application"`; fuera de ella
  pertenecen a la navegación rápida de NVDA y JAWS. El bloque `eslint-disable` de `jsx-a11y`
  alrededor de esa área es intencional: no quitarlo ni ampliarlo.
- Celda virtual: cada punto es un botón conmutador (`aria-pressed`) llamado "Punto 1"…"Punto 6".
- Nada solo visual: acierto y error se comunican con relieve, sonido y texto.
- Textos en español claro, escritos para ser escuchados; nunca mostrar mensajes técnicos en inglés
  (traducir los errores del navegador antes de anunciarlos).
- Contraste ≥ 4,5:1 en texto y ≥ 3:1 en componentes; controles ≥ 24 × 24 px (meta 44 × 44); respetar
  `prefers-reduced-motion`, `prefers-contrast` y `forced-colors`.
- No relajar reglas de `eslint-plugin-jsx-a11y`.
- Claude no puede probar con NVDA ni con el hardware. Al terminar un cambio de interacción, decir
  qué casos de `docs/PRUEBAS-NVDA.md` hay que repetir a mano.

## braille-core

- Máscara de 6 bits: el bit _i_ − 1 es el punto _i_ (c = puntos 1 y 4 = 9).
- `src/tabla.ts` tiene 45 signos. Solo 17 están verificados contra una fuente independiente (a–n,
  v, x y el signo de mayúscula, dictados en la Entrevista #1); los demás aparecen como `todo`.
- Las pruebas comparan la tabla contra un oráculo independiente (`test/referencia.ts`) que cita su
  fuente. Nunca cambiar `tabla.ts` y `referencia.ts` a la vez para que una prueba pase, y nunca
  inventar un signo: sin fuente, se queda en `todo`.
- La cobertura mínima de 80 % bloquea el CI.

## Protocolo app ↔ ESP32

- La fuente de verdad es `docs/PROTOCOLO.md`: leerlo antes de tocar `packages/protocol`,
  `packages/device` o `firmware/`.
- NDJSON a 115200 baudios (8N1). Mensajes: `hello`/`info`, `cell`/`ack`, `clear`, `chord`, `key`,
  `ping`/`pong`, `err` y `boot`.
- `proto` es la versión del protocolo y solo sube con cambios incompatibles; `fw` es la versión del
  firmware.
- Tiempos y límites en `packages/protocol/src/constantes.ts`; no duplicar esos números en otro lado.
- Un cambio al protocolo toca en el mismo PR: `docs/PROTOCOLO.md`, `packages/protocol`,
  `packages/device/src/pruebas/firmware-falso.ts` (la especificación ejecutable del firmware) y
  `firmware/`.

## Firmware (`firmware/`)

- PlatformIO, placa `esp32dev`, framework Arduino, ArduinoJson 7 y ESP32Servo 3.
- No bloqueante: todo con `millis()`, nunca `delay()` en el lazo principal.
- Pines, ángulos y tiempos solo en `include/configuracion.h`.
- No traduce Braille ni decide aciertos.
- Servos escalonados y alimentados con fuente externa de 5 V. Evitar los GPIO de arranque (0, 2, 5,
  12, 15), los de la flash (6–11) y los del puerto serie (1 y 3).
- Cargar la placa, usar el monitor serie y calibrar los servos lo hace una persona con la placa
  conectada. Solo un programa a la vez puede abrir el puerto COM: el monitor serie debe estar
  cerrado para que la app se conecte.

## Convenciones de código

- Español en identificadores, comentarios, textos de interfaz, documentación y commits; inglés solo
  donde lo exige una API o librería.
- TypeScript estricto con `noUncheckedIndexedAccess` y `verbatimModuleSyntax` (usar `import type`);
  sin `any`.
- Pruebas con Vitest en `packages/*/test/*.test.ts`. En la web, probar por rol accesible (Testing
  Library) cuando lleguen las pruebas de interfaz.
- No cambiar versiones mayores de dependencias salvo en un PR dedicado.

## Entorno del equipo

- Windows 11 con PowerShell, Node.js 22.13+ y pnpm 10.28 (corepack). Finales de línea LF
  (`.gitattributes`).
- Los dos repositorios se clonan uno al lado del otro en `tesis-braille/`.
- Si turbo reporta `recursive_turbo_invocations`, falta `pnpm-workspace.yaml` o `turbo.json`.

## Git

- Ramas cortas desde `main`; _Conventional Commits_ en español (`feat:`, `fix:`, `docs:`, `test:`,
  `refactor:`, `chore:`; ámbito opcional, p. ej. `feat(firmware): …`).
- Todo cambio entra por PR revisado por el otro integrante y con el CI en verde.
- No incluir enlaces de sesión en commits ni en PRs.

## Relación con el backend

- El contrato es `openapi.json` de `braille-backend`. El cliente de la API generará sus tipos desde
  ese archivo con `openapi-typescript` (pendiente).
- Cada intento lleva un UUID generado en el cliente y el backend hace _upsert_: reenviar tras perder
  la red no duplica datos.
- Si el backend necesita `braille-core`, se publica como paquete privado en GitHub Packages; no se
  copia.
