#pragma once
// ─────────────────────────────────────────────────────────────────────────────
// CONFIGURACIÓN DEL HARDWARE. Es el único archivo que deberían tocar para cablear.
// Un pin en -1 significa "no conectado": sirve para el montaje de prueba con
// pocos servos y pulsadores.
// ─────────────────────────────────────────────────────────────────────────────

#define VERSION_FIRMWARE "0.1.0"
#define VERSION_PROTOCOLO 1
#define BAUDIOS 115200

// Servos de la celda de lectura, en orden de punto 1 a 6.
// Pines seguros del ESP32 DevKit para salida PWM (evitan los pines de arranque 0, 2, 5,
// 12 y 15, la flash 6–11 y el puerto serie 1/3, que usa el USB).
static const int PIN_SERVO[6] = {
    13, // punto 1
    14, // punto 2
    27, // punto 3
    26, // punto 4
    25, // punto 5
    33, // punto 6
};

// Ángulos de cada servo: con la leva, "abajo" deja el pin hundido y "arriba" lo levanta.
// Se calibran uno por uno con el montaje real.
static const int ANGULO_ABAJO[6] = {0, 0, 0, 0, 0, 0};
static const int ANGULO_ARRIBA[6] = {90, 90, 90, 90, 90, 90};

// Tiempo que se deja a cada servo para llegar y asentarse (SG90 ≈ 0,1 s por 60°).
#define TIEMPO_ASENTAMIENTO_MS 300
// Retardo entre el arranque de un servo y el siguiente: reparte el pico de corriente.
#define ESCALON_ENTRE_SERVOS_MS 60
// true: se suelta el servo tras moverlo (menos ruido y consumo, pero el pin puede ceder
// al presionarlo). Con leva y pin conviene mantenerlos sujetos: false.
#define SOLTAR_SERVOS_TRAS_MOVER false

// Pulsadores de la celda de escritura (puntos 1 a 6). Van entre el pin y GND;
// se usa la resistencia pull-up interna, así que no hace falta resistencia externa.
static const int PIN_PULSADOR_PUNTO[6] = {
    32, // punto 1
    23, // punto 2
    22, // punto 3
    21, // punto 4
    19, // punto 5
    18, // punto 6
};

// Teclas de control. GPIO 34–39 solo sirven como entrada y NO tienen pull-up interno:
// si se usan, necesitan una resistencia de 10 kΩ a 3,3 V.
#define PIN_TECLA_ESPACIO 17
#define PIN_TECLA_BORRAR 16
#define PIN_TECLA_REPETIR 4
#define PIN_TECLA_CONFIRMAR -1

#define ANTIRREBOTE_MS 25
#define LONGITUD_MAXIMA_LINEA 256
