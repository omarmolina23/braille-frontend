# firmware

Firmware del ESP32 (PlatformIO, framework Arduino) que cumple `docs/PROTOCOLO.md` versión 1. No
sabe Braille: mueve puntos cuando la app lo pide y reporta los pulsadores.

| Archivo                   | Qué es                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `include/configuracion.h` | Pines, ángulos de los servos y tiempos. **Es lo único que deberían tocar para cablear.**     |
| `src/main.cpp`            | Protocolo, servos escalonados y pulsadores con antirrebote, todo no bloqueante               |
| `platformio.ini`          | Placa `esp32dev`, librerías (ArduinoJson 7, ESP32Servo 3) y monitor listo para escribir JSON |

## 1. Cableado sugerido (ESP32 DevKit de 30 pines)

| Punto | Servo (señal) | Pulsador |
| ----- | ------------- | -------- |
| 1     | GPIO 13       | GPIO 32  |
| 2     | GPIO 14       | GPIO 23  |
| 3     | GPIO 27       | GPIO 22  |
| 4     | GPIO 26       | GPIO 21  |
| 5     | GPIO 25       | GPIO 19  |
| 6     | GPIO 33       | GPIO 18  |

| Tecla de control | GPIO                                |
| ---------------- | ----------------------------------- |
| Espacio          | 17                                  |
| Borrar           | 16                                  |
| Repetir          | 4                                   |
| Confirmar        | sin asignar (ver `configuracion.h`) |

- **Pulsadores:** una pata al GPIO y la otra a GND. No llevan resistencia: el firmware activa la
  pull-up interna. (Los GPIO 34–39 no la tienen; si los usan, pongan 10 kΩ a 3,3 V.)
- **Servos:** señal al GPIO; V+ a una fuente de **5 V externa** y GND de la fuente unido al GND
  del ESP32. Un SG90 tiene picos de corriente altos al arrancar: revisen cuánta corriente entrega
  el regulador de su placa de expansión antes de conectar varios servos a él. El firmware ya
  escalona los movimientos 60 ms para repartir esos picos.
- Los pines se eligieron para evitar los de arranque (0, 2, 5, 12, 15), la flash (6–11) y el puerto
  serie (1 y 3), que usa el USB.

**Montaje de prueba:** no hace falta cablearlo todo. La serie a–j solo usa los puntos 1, 2, 4 y 5:
con cuatro servos y cuatro pulsadores en esos puntos (más "Repetir", si quieren) ya cubren toda la
primera lección de la demo. Los pines sin conectar no generan pulsaciones falsas. Si quieren que `info` no anuncie teclas que no existen,
pongan su pin en `-1`.

## 2. Compilar y cargar

1. Abrir la carpeta `firmware/` en VS Code con PlatformIO.
2. **Build** y luego **Upload** (requiere el driver del CP2102 instalado en Windows).
3. El CI de GitHub compila este firmware en cada PR.

## 3. Probar el protocolo sin la app

Abrir el **monitor serie** de PlatformIO (ya viene configurado a 115200 baudios; cada línea se envía
con Enter). Al abrirlo, la placa se reinicia: primero aparece el registro del ROM y luego `boot`.

| Escriben                        | Deben ver                                                                     |
| ------------------------------- | ----------------------------------------------------------------------------- |
| `{"t":"hello","id":1}`          | `{"t":"info","id":1,"proto":1,"fw":"0.1.0","keys":["space","back","repeat"]}` |
| `{"t":"cell","id":2,"m":9}`     | Suben los puntos 1 y 4 y luego `{"t":"ack","id":2,"ms":…}`                    |
| `{"t":"clear","id":3}`          | Bajan todos los puntos y luego `ack`                                          |
| `{"t":"ping","id":4}`           | `{"t":"pong","id":4}`                                                         |
| Presionar puntos 1 y 4 y soltar | `{"t":"chord","m":9}`                                                         |
| Presionar y soltar "Repetir"    | `{"t":"key","k":"repeat"}`                                                    |

Máscaras útiles: a = 1, b = 3, c = 9, d = 25, e = 17 (bit _i_ − 1 = punto _i_).

**Calibración:** si un pin no sube o no baja del todo, ajusten `ANGULO_ABAJO` y `ANGULO_ARRIBA`
de ese punto en `configuracion.h`. Si el `ack` llega antes de que el servo termine de moverse,
suban `TIEMPO_ASENTAMIENTO_MS`.

## 4. Probar con la app

1. **Cierren el monitor serie**: solo un programa a la vez puede usar el puerto COM.
2. En la raíz del repositorio: `pnpm dev` y abrir http://localhost:5173 en Chrome o Edge.
3. "Conectar dispositivo por USB" → elegir "CP2102 USB to UART Bridge Controller (COMx)".
4. "Mostrar en la celda" mueve los servos; los pulsadores responden al ejercicio.

**Si la app dice que el dispositivo no respondió:** comprueben que el monitor está cerrado, presionen
el botón EN de la placa y vuelvan a conectar.

## Límites conocidos

- El código se verificó compilándolo en un PC contra una simulación del hardware (puerto serie,
  pulsadores y servos simulados). Aún no se ha compilado con el toolchain del ESP32 ni probado en la
  placa real: su primer Build en PlatformIO y el CI de GitHub son esa prueba.
- Con `SOLTAR_SERVOS_TRAS_MOVER = false` los servos se mantienen energizados para que el pin no
  ceda al tocarlo; eso puede producir un leve zumbido. Si molesta, prueben `true` y verifiquen que
  la leva sostiene el pin.
