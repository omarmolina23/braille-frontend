// Firmware del dispositivo Braille — protocolo v1 (docs/PROTOCOLO.md).
//
// Principio: el firmware NO sabe Braille. Solo mueve puntos cuando la app se lo pide y
// reporta qué pulsadores se presionaron. Todo es no bloqueante (millis), para que el
// ESP32 siga leyendo pulsadores y respondiendo pings mientras los servos se mueven.

#include <Arduino.h>
#include <ArduinoJson.h>
#include <ESP32Servo.h>

#include "configuracion.h"

// ───────────────────────── Salida (NDJSON) ─────────────────────────

static void enviar(const JsonDocument &doc) {
    serializeJson(doc, Serial);
    Serial.print('\n');
}

static void enviarError(const char *codigo, long id = -1) {
    JsonDocument doc;
    doc["t"] = "err";
    if (id >= 0) doc["id"] = id;
    doc["code"] = codigo;
    enviar(doc);
}

// ───────────────────────── Celda de lectura (servos) ─────────────────────────

static Servo servos[6];
static uint8_t celdaActual = 0;

struct Movimiento {
    bool activo = false;
    long id = 0;
    uint8_t destino = 0;
    unsigned long inicio = 0;
    uint8_t puntos[6] = {0};  // puntos que cambian, en el orden en que se moverán
    uint8_t total = 0;
    uint8_t iniciados = 0;
};
static Movimiento mov;

static bool hayServo(int p) { return PIN_SERVO[p] >= 0; }

static void moverServo(int p, bool arriba) {
    if (!servos[p].attached()) servos[p].attach(PIN_SERVO[p], 500, 2400);
    servos[p].write(arriba ? ANGULO_ARRIBA[p] : ANGULO_ABAJO[p]);
}

static void iniciarMovimiento(long id, uint8_t destino) {
    mov = Movimiento();
    mov.activo = true;
    mov.id = id;
    mov.destino = destino;
    mov.inicio = millis();
    for (int p = 0; p < 6; p++) {
        if (!hayServo(p)) continue;
        const bool antes = celdaActual & (1 << p);
        const bool despues = destino & (1 << p);
        if (antes != despues) mov.puntos[mov.total++] = p;
    }
}

// Arranca los servos escalonados y responde `ack` cuando el último terminó de asentarse.
static void atenderMovimiento() {
    if (!mov.activo) return;
    const unsigned long t = millis() - mov.inicio;

    while (mov.iniciados < mov.total &&
           t >= (unsigned long)mov.iniciados * ESCALON_ENTRE_SERVOS_MS) {
        const int p = mov.puntos[mov.iniciados++];
        moverServo(p, mov.destino & (1 << p));
    }

    const unsigned long fin =
        mov.total == 0 ? 0
                       : (unsigned long)(mov.total - 1) * ESCALON_ENTRE_SERVOS_MS +
                             TIEMPO_ASENTAMIENTO_MS;
    if (mov.iniciados < mov.total || t < fin) return;

    if (SOLTAR_SERVOS_TRAS_MOVER) {
        for (int i = 0; i < mov.total; i++) servos[mov.puntos[i]].detach();
    }
    celdaActual = mov.destino;
    mov.activo = false;

    JsonDocument doc;
    doc["t"] = "ack";
    doc["id"] = mov.id;
    doc["ms"] = t;
    enviar(doc);
}

// ───────────────────────── Celda de escritura (pulsadores) ─────────────────────────

struct Pulsador {
    int pin;
    bool estable = false;  // true = presionado (ya sin rebote)
    bool lectura = false;
    unsigned long cambio = 0;
    Pulsador(int p) : pin(p) {}  // constructor explícito: compila también en C++11
};

static Pulsador puntos[6] = {
    {PIN_PULSADOR_PUNTO[0]}, {PIN_PULSADOR_PUNTO[1]}, {PIN_PULSADOR_PUNTO[2]},
    {PIN_PULSADOR_PUNTO[3]}, {PIN_PULSADOR_PUNTO[4]}, {PIN_PULSADOR_PUNTO[5]},
};
static Pulsador controles[4] = {
    {PIN_TECLA_ESPACIO}, {PIN_TECLA_BORRAR}, {PIN_TECLA_REPETIR}, {PIN_TECLA_CONFIRMAR}};
static const char *NOMBRE_CONTROL[4] = {"space", "back", "repeat", "ok"};
static uint8_t acorde = 0;

static void configurarPulsador(const Pulsador &b) {
    if (b.pin < 0) return;
    // GPIO 34–39 no tienen pull-up interno: necesitan resistencia externa.
    pinMode(b.pin, b.pin >= 34 ? INPUT : INPUT_PULLUP);
}

// Devuelve true cuando el estado estable cambia (presionado ↔ suelto).
static bool actualizar(Pulsador &b) {
    if (b.pin < 0) return false;
    const bool presionado = digitalRead(b.pin) == LOW;
    const unsigned long ahora = millis();
    if (presionado != b.lectura) {
        b.lectura = presionado;
        b.cambio = ahora;
    }
    if (b.estable != b.lectura && ahora - b.cambio >= ANTIRREBOTE_MS) {
        b.estable = b.lectura;
        return true;
    }
    return false;
}

static void leerPulsadores() {
    bool algunoPresionado = false;
    for (int p = 0; p < 6; p++) {
        if (actualizar(puntos[p]) && puntos[p].estable) acorde |= (1 << p);
        algunoPresionado |= puntos[p].estable;
    }
    // El acorde se cierra cuando se sueltan TODAS las teclas de puntos.
    if (!algunoPresionado && acorde != 0) {
        JsonDocument doc;
        doc["t"] = "chord";
        doc["m"] = acorde;
        enviar(doc);
        acorde = 0;
    }
    for (int k = 0; k < 4; k++) {
        if (actualizar(controles[k]) && !controles[k].estable) {  // al soltar
            JsonDocument doc;
            doc["t"] = "key";
            doc["k"] = NOMBRE_CONTROL[k];
            enviar(doc);
        }
    }
}

// ───────────────────────── Entrada (comandos de la app) ─────────────────────────

static void procesarLinea(const char *texto) {
    JsonDocument doc;
    if (deserializeJson(doc, texto)) {
        enviarError("BAD_MESSAGE");
        return;
    }
    const char *t = doc["t"] | "";
    if (!doc["id"].is<long>()) {
        enviarError("BAD_MESSAGE");
        return;
    }
    const long id = doc["id"].as<long>();
    if (id < 0 || id > 65535) {
        enviarError("BAD_MESSAGE");
        return;
    }

    if (strcmp(t, "hello") == 0) {
        JsonDocument r;
        r["t"] = "info";
        r["id"] = id;
        r["proto"] = VERSION_PROTOCOLO;
        r["fw"] = VERSION_FIRMWARE;
        JsonArray teclas = r["keys"].to<JsonArray>();
        for (int k = 0; k < 4; k++) {
            if (controles[k].pin >= 0) teclas.add(NOMBRE_CONTROL[k]);
        }
        enviar(r);
    } else if (strcmp(t, "ping") == 0) {
        JsonDocument r;
        r["t"] = "pong";
        r["id"] = id;
        enviar(r);
    } else if (strcmp(t, "cell") == 0 || strcmp(t, "clear") == 0) {
        if (mov.activo) {
            enviarError("BUSY", id);
            return;
        }
        long m = 0;
        if (strcmp(t, "cell") == 0) {
            if (!doc["m"].is<long>()) {
                enviarError("BAD_MESSAGE", id);
                return;
            }
            m = doc["m"].as<long>();
            if (m < 0 || m > 63) {
                enviarError("BAD_MESSAGE", id);
                return;
            }
        }
        iniciarMovimiento(id, (uint8_t)m);
    } else {
        enviarError("UNKNOWN_TYPE", id);
    }
}

static char linea[LONGITUD_MAXIMA_LINEA + 1];
static size_t largo = 0;
static bool desbordada = false;

static void leerSerie() {
    while (Serial.available() > 0) {
        const char c = (char)Serial.read();
        if (c == '\r') continue;
        if (c == '\n') {
            if (desbordada) {
                enviarError("BAD_MESSAGE");
            } else if (largo > 0) {
                linea[largo] = '\0';
                procesarLinea(linea);
            }
            largo = 0;
            desbordada = false;
            continue;
        }
        if (largo < LONGITUD_MAXIMA_LINEA) {
            linea[largo++] = c;
        } else {
            desbordada = true;
        }
    }
}

// ───────────────────────── Arduino ─────────────────────────

void setup() {
    Serial.begin(BAUDIOS);

    ESP32PWM::allocateTimer(0);
    ESP32PWM::allocateTimer(1);
    ESP32PWM::allocateTimer(2);
    ESP32PWM::allocateTimer(3);
    for (int p = 0; p < 6; p++) {
        if (!hayServo(p)) continue;
        servos[p].setPeriodHertz(50);
        servos[p].attach(PIN_SERVO[p], 500, 2400);
        servos[p].write(ANGULO_ABAJO[p]);
    }

    for (const Pulsador &b : puntos) configurarPulsador(b);
    for (const Pulsador &b : controles) configurarPulsador(b);

    JsonDocument doc;
    doc["t"] = "boot";
    doc["fw"] = VERSION_FIRMWARE;
    enviar(doc);
}

void loop() {
    leerSerie();
    atenderMovimiento();
    leerPulsadores();
}
