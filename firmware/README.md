# firmware

Proyecto PlatformIO del ESP32. **Aún sin código**: aquí va el firmware que cumpla
`docs/PROTOCOLO.md`. En cuanto exista `platformio.ini`, el CI empieza a compilarlo solo.

## Punto de partida sugerido

```ini
; platformio.ini
[env:esp32dev]
platform = espressif32
board = esp32dev
framework = arduino
monitor_speed = 115200
lib_deps =
    bblanchon/ArduinoJson
    madhephaestus/ESP32Servo
```

## Qué debe hacer (y qué no)

- Hablar el protocolo: leer líneas JSON por `Serial`, responder `info`, `ack`, `pong` y emitir
  `chord` y `key`. La lista de verificación completa está en `docs/PROTOCOLO.md` § 7.
- Responder `ack` solo cuando los servos terminaron de moverse; escalonar el movimiento de los seis
  servos para limitar el pico de corriente.
- Alimentar los servos desde la fuente externa (jack DC), con tierra común con el ESP32.
- **No** guardar tablas Braille ni lógica de ejercicios: eso vive en `packages/braille-core`.

## Cómo probarlo sin la app

Abrir el monitor serie de PlatformIO a 115200 baudios y escribir líneas a mano:

```text
{"t":"hello","id":1}
{"t":"cell","id":2,"m":25}
{"t":"ping","id":3}
```

La respuesta esperada para cada una está en `docs/PROTOCOLO.md` y, en código,
en `packages/device/src/pruebas/firmware-falso.ts`.
