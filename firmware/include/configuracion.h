#pragma once
// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL HARDWARE. Es el único archivo que deberían tocar para cablear.
// Un pin en -1 significa "no conectado": sirve para el montaje de prueba con
// pocos servos y pulsadores.
// ─────────────────────────────────────────────────────────────────────────────

#define VERSION_FIRMWARE "0.2.2"
#define VERSION_PROTOCOLO 1
#define BAUDIOS 115200

// Placa: ESP32 DevKit de 36 pines. Los servos van en un lado de la placa de expansión y los
// pulsadores en el otro. Pines seguros para salida PWM: evitan los de arranque (0, 2, 5, 12 y
// 15), la flash (6–11) y el puerto serie (1 y 3), que usa el USB.

// Servos de la celda de lectura, en orden de punto 1 a 6.
// El punto 6 va en el GPIO 13 y no en el 14 (que está antes en la fila): el 14 emite pulsos
// al arrancar y movería ese servo cada vez que se reinicia la placa, por ejemplo al conectar la
// app. El 12 tampoco sirve: es de arranque.
static const int PIN_SERVO[6] = {
    32, // punto 1
    33, // punto 2
    25, // punto 3
    26, // punto 4
    27, // punto 5
    13, // punto 6
};

// Ángulos de cada servo: con la leva, "abajo" deja el pin hundido y "arriba" lo levanta.
// Se calibran uno por uno con el montaje real.
static const int ANGULO_ABAJO[6] = {0, 0, 0, 0, 0, 0};
static const int ANGULO_ARRIBA[6] = {180, 180, 180, 180, 180, 180};

// Tiempo que se deja a cada servo para llegar y asentarse. Un SG90 tarda ≈ 0,1 s por 60°, así
// que recorrer 180° toma ≈ 0,3 s sin carga. Peor caso con seis servos: 5 × 60 + 450 = 750 ms,
// dentro de la meta de 1 s (RNF-03).
#define TIEMPO_ASENTAMIENTO_MS 450
// Retardo entre el arranque de un servo y el siguiente: reparte el pico de corriente.
#define ESCALON_ENTRE_SERVOS_MS 60
// true: se suelta el servo tras moverlo (menos ruido y consumo, pero el pin puede ceder
// al presionarlo). Con leva y pin conviene mantenerlos sujetos: false.
#define SOLTAR_SERVOS_TRAS_MOVER false

// Pulsadores de la celda de escritura (puntos 1 a 6). Van entre el pin y GND;
// se usa la resistencia pull-up interna, así que no hace falta resistencia externa.
static const int PIN_PULSADOR_PUNTO[6] = {
    23, // punto 1
    22, // punto 2
    21, // punto 3
    19, // punto 4
    18, // punto 5
    17, // punto 6
};

// Teclas de control. GPIO 34–39 solo sirven como entrada y NO tienen pull-up interno:
// si se usan, necesitan una resistencia de 10 kΩ a 3,3 V (nunca a 5 V).
// Espacio y Borrar siguen sin asignar: la app todavía no las usa. Para conectarlas, el GPIO 16
// (lado de los pulsadores) tiene pull-up interno y no necesita resistencia; los GPIO 34 y 35 sí.
// Sin esa resistencia, un pin de 34–39 queda al aire y genera pulsaciones falsas.
#define PIN_TECLA_ESPACIO -1
#define PIN_TECLA_BORRAR -1
#define PIN_TECLA_REPETIR 4
#define PIN_TECLA_CONFIRMAR -1

#define ANTIRREBOTE_MS 25
#define LONGITUD_MAXIMA_LINEA 256
