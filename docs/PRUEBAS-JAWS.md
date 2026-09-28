# Protocolo de pruebas con JAWS

Guía para verificar la demo (`pnpm dev`) con el lector de pantalla JAWS. Cada caso tiene un resultado
esperado concreto; lo que JAWS dijo de verdad se copia del **historial de voz** y se anota en el
registro del final. Ese registro es evidencia para el entregable "pruebas internas documentadas".

## 1. Preparación

1. **JAWS sin licencia** funciona en modo de demostración de 40 minutos; para otra sesión hay que
   reiniciar Windows. Planeen cada sesión de prueba dentro de ese tiempo.
2. **Tecla JAWS:** en la distribución de escritorio es `Insert`; en la de portátil, `Bloq Mayús`.
   Abajo se escribe como **JAWS**.
3. **Orden de arranque:** primero JAWS y después el navegador. Si el navegador ya estaba abierto,
   ciérrenlo y ábranlo de nuevo.
4. Probar en **Chrome y Edge** (los navegadores con Web Serial más usados con lectores de pantalla).
5. `pnpm dev` y abrir http://localhost:5173.
6. Para probar como lo haría una persona ciega, apaguen o cubran el monitor durante los casos.

## 2. Comandos de JAWS que se usan

| Acción                                    | Teclas                                |
| ----------------------------------------- | ------------------------------------- |
| Callar la voz                             | `Ctrl`                                |
| Leer todo desde aquí                      | JAWS + `Flecha abajo`                 |
| Leer el título de la ventana              | JAWS + `T`                            |
| Siguiente encabezado / botón              | `H` / `B`                             |
| Lista de encabezados                      | JAWS + `F6`                           |
| Lista de campos de formulario             | JAWS + `F5`                           |
| Activar o desactivar el cursor virtual    | JAWS + `Z`                            |
| Salir del modo formularios                | `Esc` o `+` del teclado numérico      |
| **Historial de voz** (copiar lo que dijo) | JAWS + `Barra espaciadora`, luego `H` |

## 3. Casos de prueba

| ID   | Qué se prueba                      | Pasos                                                                                     | Resultado esperado                                                                                                                                                                                                                                                                                  |
| ---- | ---------------------------------- | ----------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| J-01 | Título y estructura                | Cargar la página; JAWS + `T`; luego JAWS + `F6`                                           | Título "Práctica serie a–j · Demo de integración". Encabezados: "Práctica de la serie a–j" (nivel 1); "Dispositivo", "Ejercicio" y "Celda virtual" (nivel 2)                                                                                                                                        |
| J-02 | Anuncio sin mover el foco          | Recargar la página y esperar                                                              | JAWS dice "Simulador listo. Escribe la a." sin que ustedes muevan el foco                                                                                                                                                                                                                           |
| J-03 | Orden del tabulador                | Recorrer con `Tab`                                                                        | Conectar dispositivo por USB → Repetir instrucción → Mostrar en la celda → área de escritura → puntos 1 a 6 → Enviar celda. Cada control dice su nombre y su tipo                                                                                                                                   |
| J-04 | **Área de escritura en modo foco** | `Tab` hasta el área; presionar y soltar `F`                                               | JAWS anuncia el área y sus instrucciones. Al soltar `F`: "Correcto: la a. Ahora escribe la be." **Si en cambio JAWS salta a otro campo** (en modo exploración `F` = siguiente campo de formulario), el cursor virtual no se desactivó: anoten Falla, presionen JAWS + `Z` y repitan (ver sección 4) |
| J-05 | Acorde de varias teclas            | Con la consigna "la be": presionar `F` y `D` a la vez y soltar                            | "Correcto: la be. Ahora escribe la ce."                                                                                                                                                                                                                                                             |
| J-06 | Retroalimentación de error         | Con "la ce": presionar solo `F` y soltar                                                  | "Escribiste la a. Falta el punto 4. Intenta de nuevo la ce."                                                                                                                                                                                                                                        |
| J-07 | Repetir instrucción                | En el área, presionar `Espacio`                                                           | "Escribe la ce."                                                                                                                                                                                                                                                                                    |
| J-08 | Celda virtual                      | Activar los botones 1 y 4 con `Espacio`; luego "Enviar celda"                             | Cada punto dice "presionado" o "no presionado". Al enviar: retroalimentación del ejercicio                                                                                                                                                                                                          |
| J-09 | Mostrar en la celda (simulador)    | Activar "Mostrar en la celda"                                                             | "La ce: puntos 1 y 4. Tócala y luego escríbela."                                                                                                                                                                                                                                                    |
| J-10 | Selector de puerto del navegador   | Con el ESP32 conectado y el monitor serie cerrado: activar "Conectar dispositivo por USB" | Se puede recorrer la lista de puertos con flechas, JAWS lee "CP2102…" y `Enter` conecta. Luego: "Dispositivo listo. Escribe…"                                                                                                                                                                       |
| J-11 | Dispositivo físico: lectura        | "Mostrar en la celda"                                                                     | Los servos se mueven y **después** JAWS lee el signo (nunca mientras se mueven)                                                                                                                                                                                                                     |
| J-12 | Dispositivo físico: escritura      | Presionar los pulsadores del signo pedido y soltar                                        | La misma retroalimentación de J-05 y J-06                                                                                                                                                                                                                                                           |
| J-13 | Desconexión                        | Retirar el cable USB                                                                      | "Se desconectó el dispositivo. Puedes seguir con la celda virtual."                                                                                                                                                                                                                                 |
| J-14 | Una sola voz                       | Durante todos los casos                                                                   | Nunca hablan dos voces a la vez; ningún anuncio se corta a la mitad                                                                                                                                                                                                                                 |

## 4. Si falla J-04

Hay un problema conocido en el que JAWS no desactiva el cursor virtual al llegar a un elemento con
`role="application"`
([FreedomScientific/standards-support#640](https://github.com/FreedomScientific/standards-support/issues/640)).
Si ocurre:

1. Anoten la versión de JAWS y del navegador.
2. Prueben si funciona tras JAWS + `Z`. Si funciona, es ese problema.
3. La corrección prevista es cambiar el área por un campo de edición (`<textarea>`), que activa el
   modo formularios de forma confiable, y volver a probar J-04 a J-07.

## 5. Registro de resultados

Copien esta tabla por sesión. En "Lo que dijo JAWS" peguen el texto del historial de voz.

| ID   | Fecha | Navegador y versión | JAWS versión | Resultado (Pasa / Falla / Parcial) | Lo que dijo JAWS | Observaciones |
| ---- | ----- | ------------------- | ------------ | ---------------------------------- | ---------------- | ------------- |
| J-01 |       |                     |              |                                    |                  |               |
| J-02 |       |                     |              |                                    |                  |               |
| J-03 |       |                     |              |                                    |                  |               |
| J-04 |       |                     |              |                                    |                  |               |
| J-05 |       |                     |              |                                    |                  |               |
| J-06 |       |                     |              |                                    |                  |               |
| J-07 |       |                     |              |                                    |                  |               |
| J-08 |       |                     |              |                                    |                  |               |
| J-09 |       |                     |              |                                    |                  |               |
| J-10 |       |                     |              |                                    |                  |               |
| J-11 |       |                     |              |                                    |                  |               |
| J-12 |       |                     |              |                                    |                  |               |
| J-13 |       |                     |              |                                    |                  |               |
| J-14 |       |                     |              |                                    |                  |               |
