# Protocolo de pruebas con NVDA

Guía para verificar la demo (`pnpm dev`) con el lector de pantalla NVDA. Cada caso tiene un resultado
esperado concreto; lo que NVDA dijo de verdad se copia del **Visor de voz** y se anota en el
registro del final. Ese registro es evidencia para el entregable "pruebas internas documentadas".

## 1. Preparación

1. **Instalar NVDA** desde [nvaccess.org](https://www.nvaccess.org/). Es gratuito y no tiene límite
   de tiempo.
2. **Tecla NVDA:** por defecto es `Insert` (o `0` del teclado numérico con Bloq Num desactivado).
   Puede cambiarse a `Bloq Mayús` en NVDA + `N` → Preferencias → Opciones → Teclado, donde también
   se elige la distribución de sobremesa o de portátil. Abajo se escribe como **NVDA**.
3. **Visor de voz:** NVDA + `N` → Herramientas → Visor de voz. Déjenlo abierto durante toda la
   sesión: muestra por escrito todo lo que NVDA dice, y de ahí se copia al registro.
4. **Sonido de cambio de modo:** en Opciones → Modo exploración, activen la indicación de audio de
   los modos foco y exploración. Así se oye cuándo NVDA deja pasar las teclas a la app (caso N-04).
5. Abran NVDA antes que el navegador y prueben en **Chrome y Edge**.
6. `pnpm dev` y abrir http://localhost:5173.
7. Para probar como lo haría una persona ciega, activen la **cortina de pantalla** (Opciones →
   Visión), que deja el monitor en negro mientras NVDA sigue funcionando.

## 2. Comandos de NVDA que se usan

| Acción                                                     | Teclas                                                    |
| ---------------------------------------------------------- | --------------------------------------------------------- |
| Callar la voz                                              | `Ctrl`                                                    |
| Leer todo desde aquí                                       | NVDA + `Flecha abajo` (sobremesa) · NVDA + `A` (portátil) |
| Leer el título de la ventana                               | NVDA + `T`                                                |
| Leer el elemento con foco                                  | NVDA + `Tab`                                              |
| Siguiente encabezado / botón                               | `H` / `B`                                                 |
| Lista de elementos (encabezados, enlaces, campos, botones) | NVDA + `F7`                                               |
| Alternar entre modo exploración y modo foco                | NVDA + `Barra espaciadora`                                |
| Menú de NVDA (Visor de voz, opciones)                      | NVDA + `N`                                                |

**Modo exploración y modo foco:** en modo exploración las letras sirven para navegar (`H`
encabezado, `B` botón, `F` campo de formulario, `K` enlace, `L` lista). En modo foco las teclas
llegan a la página. El área de escritura necesita modo foco para recibir F D S J K L.

## 3. Casos de prueba

| ID   | Qué se prueba                        | Pasos                                                                                     | Resultado esperado                                                                                                                                                                                                                                                                                       |
| ---- | ------------------------------------ | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| N-01 | Título y estructura                  | Cargar la página; NVDA + `T`; luego NVDA + `F7` → Encabezados                             | Título "Práctica serie a–j · Demo de integración". Encabezados: "Práctica de la serie a–j" (nivel 1); "Dispositivo", "Ejercicio", "Visor de la celda" y "Celda virtual" (nivel 2)                                                                                                                        |
| N-02 | Anuncio sin mover el foco            | Recargar la página y esperar                                                              | NVDA dice "Simulador listo. Escribe la a." sin que ustedes muevan el foco                                                                                                                                                                                                                                |
| N-03 | Orden del tabulador                  | Recorrer con `Tab`                                                                        | Conectar dispositivo por USB → Repetir instrucción → Mostrar en la celda → área de escritura → puntos 1 a 6 → Enviar celda. Cada control dice su nombre y su tipo                                                                                                                                        |
| N-04 | **Área de escritura en modo foco**   | `Tab` hasta el área; presionar y soltar `F`                                               | Al llegar, NVDA cambia solo a modo foco (se oye el sonido) y lee "Área de escritura…" con el rol "aplicación". Al soltar `F`: "Correcto: la a. Ahora escribe la be." **Si NVDA salta a otro campo** (en modo exploración `F` = siguiente campo de formulario), el cambio automático falló: ver sección 4 |
| N-05 | Acorde de varias teclas              | Con la consigna "la be": presionar `F` y `D` a la vez y soltar                            | "Correcto: la be. Ahora escribe la ce."                                                                                                                                                                                                                                                                  |
| N-06 | Retroalimentación de error           | Con "la ce": presionar solo `F` y soltar                                                  | "Escribiste la a. Falta el punto 4. Intenta de nuevo la ce."                                                                                                                                                                                                                                             |
| N-07 | Repetir instrucción                  | En el área, presionar `Espacio`                                                           | "Escribe la ce."                                                                                                                                                                                                                                                                                         |
| N-08 | Celda virtual                        | Activar los botones 1 y 4 con `Espacio`; luego "Enviar celda"                             | Cada punto dice "presionado" o "no presionado" (botón de alternancia). Al enviar: la retroalimentación del ejercicio                                                                                                                                                                                     |
| N-09 | Mostrar en la celda (simulador)      | Activar "Mostrar en la celda"                                                             | "La ce: puntos 1 y 4. Tócala y luego escríbela."                                                                                                                                                                                                                                                         |
| N-10 | Selector de puerto del navegador     | Con el ESP32 conectado y el monitor serie cerrado: activar "Conectar dispositivo por USB" | Se puede recorrer la lista de puertos con flechas, NVDA lee "CP2102…" y se puede activar "Conectar". Luego: "Dispositivo listo. Escribe…"                                                                                                                                                                |
| N-11 | Dispositivo físico: lectura          | "Mostrar en la celda"                                                                     | Los servos se mueven y **después** NVDA lee el signo (nunca mientras se mueven)                                                                                                                                                                                                                          |
| N-12 | Dispositivo físico: escritura        | Presionar los pulsadores del signo pedido y soltar                                        | La misma retroalimentación de N-05 y N-06                                                                                                                                                                                                                                                                |
| N-13 | Desconexión                          | Retirar el cable USB                                                                      | "Se desconectó el dispositivo. Puedes seguir con la celda virtual."                                                                                                                                                                                                                                      |
| N-14 | Una sola voz                         | Durante todos los casos                                                                   | Nunca hablan dos voces a la vez; ningún anuncio se corta a la mitad                                                                                                                                                                                                                                      |
| N-15 | Corregir una tecla dentro del acorde | Con la consigna "la e": mantener `F`, presionar y soltar `D`, presionar `K` y soltar todo | "Correcto: la e. Ahora escribe la efe." El punto 2 no cuenta porque se soltó antes de presionar `K`. Mientras se escribe, NVDA no lee el texto del visor                                                                                                                                                 |

## 4. Si falla N-04

1. Anoten la versión de NVDA y del navegador.
2. Vuelvan al área, presionen NVDA + `Barra espaciadora` para forzar el modo foco y repitan.
3. Si así funciona, el problema es que NVDA no cambió de modo solo. La corrección prevista es
   cambiar el área por un campo de edición (`<textarea>`), que activa el modo foco de forma
   confiable, y repetir N-04 a N-07.

## 5. Antes de las pruebas con usuarios: una pasada con JAWS

Los tiflólogos entrevistados usan JAWS, así que antes de la evaluación con usuarios (objetivo 4)
conviene repetir al menos N-02 a N-07 con JAWS. Sin licencia, JAWS funciona 40 minutos por
sesión; para otra sesión hay que reiniciar Windows. Equivalencias:

| NVDA                       | JAWS                                                           |
| -------------------------- | -------------------------------------------------------------- |
| Visor de voz               | Historial de voz: JAWS + `Barra espaciadora`, luego `H`        |
| NVDA + `Barra espaciadora` | JAWS + `Z` (activa o desactiva el cursor virtual)              |
| NVDA + `F7`                | JAWS + `F6` (encabezados) · JAWS + `F5` (campos de formulario) |
| NVDA + `T`                 | JAWS + `T`                                                     |

JAWS tiene un problema conocido: a veces no desactiva el cursor virtual en elementos con
`role="application"`
([FreedomScientific/standards-support#640](https://github.com/FreedomScientific/standards-support/issues/640)).
Si N-04 pasa con NVDA pero falla con JAWS, aplica la misma corrección de la sección 4.

## 6. Registro de resultados

Copien esta tabla por sesión. En "Lo que dijo NVDA" peguen el texto del Visor de voz.

| ID   | Fecha | Navegador y versión | NVDA versión | Resultado (Pasa / Falla / Parcial) | Lo que dijo NVDA | Observaciones |
| ---- | ----- | ------------------- | ------------ | ---------------------------------- | ---------------- | ------------- |
| N-01 |       |                     |              |                                    |                  |               |
| N-02 |       |                     |              |                                    |                  |               |
| N-03 |       |                     |              |                                    |                  |               |
| N-04 |       |                     |              |                                    |                  |               |
| N-05 |       |                     |              |                                    |                  |               |
| N-06 |       |                     |              |                                    |                  |               |
| N-07 |       |                     |              |                                    |                  |               |
| N-08 |       |                     |              |                                    |                  |               |
| N-09 |       |                     |              |                                    |                  |               |
| N-10 |       |                     |              |                                    |                  |               |
| N-11 |       |                     |              |                                    |                  |               |
| N-12 |       |                     |              |                                    |                  |               |
| N-13 |       |                     |              |                                    |                  |               |
| N-14 |       |                     |              |                                    |                  |               |
