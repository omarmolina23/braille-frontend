# firmware

Firmware del ESP32 (PlatformIO, framework Arduino) que cumple `docs/PROTOCOLO.md` versión 1. No
sabe Braille: mueve puntos cuando la app lo pide y reporta los pulsadores.

| Archivo                   | Qué es                                                                                       |
| ------------------------- | -------------------------------------------------------------------------------------------- |
| `include/configuracion.h` | Pines, ángulos de los servos y tiempos. **Es lo único que deberían tocar para cablear.**     |
| `src/main.cpp`            | Protocolo, servos escalonados y pulsadores con antirrebote, todo no bloqueante               |
| `platformio.ini`          | Placa `esp32dev`, librerías (ArduinoJson 7, ESP32Servo 3) y monitor listo para escribir JSON |

## 1. Cableado sugerido (ESP32 DevKit de 36 pines)

Los servos van en un lado de la placa de expansión (GPIO 32, 33, 25, 26, 27 y 13) y los pulsadores
en el otro (GPIO 23, 22, 21, 19, 18 y 17).

| Punto | Servo (señal) | Pulsador |
| ----- | ------------- | -------- |
| 1     | GPIO 32       | GPIO 23  |
| 2     | GPIO 33       | GPIO 22  |
| 3     | GPIO 25       | GPIO 21  |
| 4     | GPIO 26       | GPIO 19  |
| 5     | GPIO 27       | GPIO 18  |
| 6     | GPIO 13       | GPIO 17  |

| Tecla de control | GPIO                                |
| ---------------- | ----------------------------------- |
| Espacio          | sin asignar (ver `configuracion.h`) |
| Borrar           | sin asignar (ver `configuracion.h`) |
| Repetir          | 4                                   |
| Confirmar        | sin asignar (ver `configuracion.h`) |

- **Pulsadores:** una pata al GPIO y la otra a GND. No llevan resistencia: el firmware activa la
  pull-up interna. (Los GPIO 34–39 no la tienen; si los usan, pongan 10 kΩ a 3,3 V.)
- **Servos:** señal al GPIO; V+ a una fuente de **5 V externa** y GND de la fuente unido al GND
  del ESP32. Un SG90 tiene picos de corriente altos al arrancar: revisen cuánta corriente entrega
  el regulador de su placa de expansión antes de conectar varios servos a él. El firmware ya
  escalona los movimientos 60 ms para repartir esos picos.
- Los pines se eligieron para evitar los de arranque (0, 2, 5, 12, 15), la flash (6–11) y el puerto
  serie (1 y 3), que usa el USB. El servo del punto 6 va en el GPIO 13 y no en el 14: el 14 emite
  pulsos al arrancar y movería ese servo cada vez que la placa se reinicia (por ejemplo, al conectar
  la app).
- **Espacio y Borrar** siguen sin asignar: la app todavía no las usa. Si las necesitan, el GPIO 16
  (lado de los pulsadores) no necesita resistencia; los GPIO 34 y 35 sí: 10 kΩ a 3,3 V, nunca a 5 V.
- **Rotación:** "abajo" es 0° y "arriba" es 180°. Cada movimiento espera 450 ms a que el servo
  llegue antes de responder `ack`.

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

| Escriben                        | Deben ver                                                      |
| ------------------------------- | -------------------------------------------------------------- |
| `{"t":"hello","id":1}`          | `{"t":"info","id":1,"proto":1,"fw":"0.2.2","keys":["repeat"]}` |
| `{"t":"cell","id":2,"m":9}`     | Suben los puntos 1 y 4 y luego `{"t":"ack","id":2,"ms":…}`     |
| `{"t":"clear","id":3}`          | Bajan todos los puntos y luego `ack`                           |
| `{"t":"ping","id":4}`           | `{"t":"pong","id":4}`                                          |
| Presionar puntos 1 y 4 y soltar | `press` en cada cambio y al final `{"t":"chord","m":9}`        |
| Presionar y soltar "Repetir"    | `{"t":"key","k":"repeat"}`                                     |

Máscaras útiles: a = 1, b = 3, c = 9, d = 25, e = 17 (bit _i_ − 1 = punto _i_).

**Calibración:** si un pin no sube o no baja del todo, ajusten `ANGULO_ABAJO` y `ANGULO_ARRIBA`
de ese punto en `configuracion.h`. Si el `ack` llega antes de que el servo termine de moverse,
suban `TIEMPO_ASENTAMIENTO_MS`.

## 4. Probar con la app

1. **Cierren el monitor serie**: solo un programa a la vez puede usar el puerto COM.
2. En la raíz del repositorio: `pnpm dev` y abrir http://localhost:5173 en Chrome o Edge.
3. "Conectar dispositivo por USB" → elegir "CP2102 USB to UART Bridge Controller (COMx)".
4. En "Lectura" pueden levantar cualquier signo (sirve para probar cada servo); en "Escritura",
   "Mostrar en la celda" levanta la letra del ejercicio. Mientras presionan los pulsadores, el
   visor los dibuja; al soltarlos, la app evalúa y la celda levanta lo que escribieron.

**Si los servos no se mueven:** revisen que la app diga "Usando el dispositivo por USB: listo" (con
"el simulador" no se mueve nada físico). Si la app anuncia que el dispositivo se reinició, el ESP32
se está quedando sin energía al arrancar los servos: aliméntenlos con la fuente externa de 5 V y
unan su GND con el del ESP32. Si se oye el servo pero el pin no sube, calibren `ANGULO_ARRIBA`.

**Si la app dice que el dispositivo no respondió:** comprueben que el monitor está cerrado, presionen
el botón EN de la placa y vuelvan a conectar.

## Límites conocidos

- El código se verificó compilándolo en un PC contra una simulación del hardware (puerto serie,
  pulsadores y servos simulados). Aún no se ha compilado con el toolchain del ESP32 ni probado en la
  placa real: su primer Build en PlatformIO y el CI de GitHub son esa prueba.
- Con `SOLTAR_SERVOS_TRAS_MOVER = false` los servos se mantienen energizados para que el pin no
  ceda al tocarlo; eso puede producir un leve zumbido. Si molesta, prueben `true` y verifiquen que
  la leva sostiene el pin.
