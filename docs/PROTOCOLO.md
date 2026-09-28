# Contrato de comunicación app ↔ ESP32

**Versión del protocolo:** 1 · **Estado:** borrador para acordar entre firmware y app.
Cuando ambos integrantes lo aprueben, cambien el estado a **congelado** y registren la fecha en el
historial del final.

Este documento es la fuente de verdad del contrato. El código que lo implementa del lado de la app
está en `packages/protocol` (esquemas Zod, codificación y constantes). El firmware debe cumplir lo
mismo; `packages/device/src/pruebas/firmware-falso.ts` es una implementación de referencia
ejecutable de su comportamiento.

## 1. Transporte

| Aspecto                  | Valor                                                                                                              |
| ------------------------ | ------------------------------------------------------------------------------------------------------------------ |
| Enlace                   | USB ↔ UART (puente CP2102 de la placa)                                                                             |
| Velocidad                | 115200 baudios, 8N1                                                                                                |
| Codificación             | UTF-8                                                                                                              |
| Formato                  | NDJSON: un objeto JSON por línea, terminado en `\n` (se tolera `\r\n`)                                             |
| Longitud máxima de línea | 256 caracteres; las más largas se descartan                                                                        |
| Líneas no JSON           | Se ignoran. Al reiniciarse, el ROM del ESP32 imprime su registro de arranque en texto plano a esta misma velocidad |

## 2. Convenciones

- `t`: tipo de mensaje (obligatorio en todos).
- `id`: entero de 0 a 65535 que asigna la app; la respuesta repite el mismo `id`.
- `m`: máscara de la celda, entero de 0 a 63. **El bit (i − 1) representa el punto i.**

  | Punto | 1   | 2   | 3   | 4   | 5   | 6   |
  | ----- | --- | --- | --- | --- | --- | --- |
  | Bit   | 0   | 1   | 2   | 3   | 4   | 5   |
  | Valor | 1   | 2   | 4   | 8   | 16  | 32  |

  Ejemplo: la c (puntos 1 y 4) es 1 + 8 = **9**; la d (puntos 1, 4 y 5) es 1 + 8 + 16 = **25**.

- El firmware **no sabe qué letra es cada máscara**: solo mueve puntos y reporta pulsaciones.
  Toda la lógica Braille vive en `packages/braille-core`.

## 3. Mensajes

### App → dispositivo

| `t`     | Campos    | Ejemplo                     | Qué debe hacer el firmware                                                                             |
| ------- | --------- | --------------------------- | ------------------------------------------------------------------------------------------------------ |
| `hello` | `id`      | `{"t":"hello","id":1}`      | Responder `info` con el mismo `id`                                                                     |
| `cell`  | `id`, `m` | `{"t":"cell","id":7,"m":9}` | Subir los puntos de `m`, bajar los demás y responder `ack` **cuando los servos terminaron de moverse** |
| `clear` | `id`      | `{"t":"clear","id":8}`      | Bajar todos los puntos y responder `ack`                                                               |
| `ping`  | `id`      | `{"t":"ping","id":9}`       | Responder `pong` con el mismo `id`                                                                     |

### Dispositivo → app

| `t`     | Campos                      | Ejemplo                                                                            | Cuándo se envía                                                                                   |
| ------- | --------------------------- | ---------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- |
| `boot`  | `fw`                        | `{"t":"boot","fw":"0.1.0"}`                                                        | Al terminar `setup()`, en cada arranque o reinicio                                                |
| `info`  | `id`, `proto`, `fw`, `keys` | `{"t":"info","id":1,"proto":1,"fw":"0.1.0","keys":["space","back","repeat","ok"]}` | En respuesta a `hello`; `keys` lista las teclas de control que existen físicamente                |
| `ack`   | `id`, `ms` (opcional)       | `{"t":"ack","id":7,"ms":420}`                                                      | Al terminar un `cell` o `clear`; `ms` = duración real de la actuación                             |
| `chord` | `m` (1–63)                  | `{"t":"chord","m":9}`                                                              | Al soltar **todas** las teclas de puntos; `m` = unión de los puntos presionados durante el acorde |
| `key`   | `k`                         | `{"t":"key","k":"space"}`                                                          | Al soltar una tecla de control (`space`, `back`, `repeat`, `ok`)                                  |
| `pong`  | `id`                        | `{"t":"pong","id":9}`                                                              | En respuesta a `ping`                                                                             |
| `err`   | `id` (opcional), `code`     | `{"t":"err","id":7,"code":"SERVO_TIMEOUT"}`                                        | Cuando un comando no se pudo cumplir                                                              |

Códigos de error definidos: `SERVO_TIMEOUT`, `BUSY` (llegó un `cell`/`clear` mientras otro estaba en
curso), `BAD_MESSAGE` (JSON inválido o campos faltantes), `UNKNOWN_TYPE`.

## 4. Secuencias

### Conexión

1. La app abre el puerto a 115200 baudios y fija DTR y RTS en falso (`port.setSignals`).
   Abrir el puerto puede reiniciar el ESP32 igualmente.
2. La app envía `hello` cada 1 s durante un máximo de 3 s. Si llega `boot`, reenvía `hello` de
   inmediato.
3. El dispositivo responde `info`. Si `proto` no es igual a la versión de la app, la app informa
   "firmware incompatible" y no envía más comandos.
4. Con `info` válido, el estado pasa a **listo** y empieza el latido.

### Lectura (mostrar un signo)

1. App → `cell` con la máscara del signo.
2. El firmware mueve los servos (se recomienda escalonarlos para limitar el pico de corriente).
3. Cuando todos llegaron a su posición y se estabilizaron, firmware → `ack`.
4. Solo entonces la app anuncia el signo: la persona toca la celda cuando ya no se mueve.

### Escritura (responder un ejercicio)

1. La persona presiona una o varias teclas de puntos.
2. El firmware acumula los puntos presionados (con antirrebote de ~25 ms por tecla).
3. Cuando **todas** las teclas de puntos están sueltas, firmware → `chord` con la unión.
4. La app evalúa con `braille-core` y da la retroalimentación.

### Latido

La app envía `ping` cada 2 s. Tras 2 `pong` perdidos seguidos, la app considera el dispositivo
desconectado y lo anuncia. El navegador también emite el evento `disconnect` si se retira el cable.

## 5. Tiempos y reglas

| Regla                             | Valor                                                                                    |
| --------------------------------- | ---------------------------------------------------------------------------------------- |
| Espera máxima de `ack`            | 1,5 s; la app reintenta **una vez** y luego informa el error                             |
| Comandos en curso                 | Uno a la vez: la app no envía otro `cell`/`clear` hasta recibir `ack` o agotar el tiempo |
| Meta de tiempo por signo (RNF-03) | ≤ 1 s desde `cell` hasta `ack`                                                           |
| Antirrebote de pulsadores         | ~25 ms (en el firmware)                                                                  |
| Acorde vacío                      | No se envía (`m` siempre ≥ 1)                                                            |

## 6. Versionado

- Agregar un campo **opcional** o un código de error nuevo es compatible: no cambia `proto`.
- Cambiar el significado de un campo, quitarlo o volverlo obligatorio es **incompatible**: sube `proto`
  en `packages/protocol/src/constantes.ts` y en el firmware, en el mismo PR.
- Todo cambio se anota en el historial de abajo.

## 7. Lista de verificación para el firmware

- [ ] Envía `boot` al terminar `setup()`.
- [ ] Responde `hello` con `info` (`proto` = 1) y el mismo `id`.
- [ ] `cell` y `clear` responden `ack` solo después de que los servos se detienen.
- [ ] Responde `err` con `BUSY` si llega un `cell`/`clear` durante otro.
- [ ] Emite `chord` al soltar todas las teclas de puntos, nunca con `m` = 0.
- [ ] Emite `key` al soltar una tecla de control.
- [ ] Responde `ping` con `pong`.
- [ ] Ignora líneas inválidas y responde `err` con `BAD_MESSAGE` si traen un `id` legible.
- [ ] No contiene tablas Braille ni lógica de ejercicios.

## Historial

| Fecha      | Versión      | Cambio            |
| ---------- | ------------ | ----------------- |
| 2026-09-27 | 1 (borrador) | Primera propuesta |
