/**
 * Valores acordados en docs/PROTOCOLO.md. Si cambias uno aquí, cámbialo también allí
 * y en el firmware: son parte del contrato.
 */

/** Versión del protocolo. Sube solo con cambios incompatibles (ver PROTOCOLO.md § Versionado). */
export const VERSION_PROTOCOLO = 1;

/** Velocidad del puerto serie (8N1). */
export const BAUDIOS = 115_200;

/** Longitud máxima de una línea; lo que la supere se descarta como ruido. */
export const LONGITUD_MAXIMA_LINEA = 256;

/** Tiempo máximo que la app espera un `ack` antes de reintentar (un solo reintento). */
export const TIMEOUT_ACK_MS = 1_500;

/** Ventana total del saludo inicial (el ESP32 puede estar reiniciándose). */
export const TIEMPO_MAXIMO_SALUDO_MS = 3_000;

/** Cada cuánto se reenvía `hello` mientras no llega `info`. */
export const INTERVALO_SALUDO_MS = 1_000;

/** Latido: la app envía `ping` con esta frecuencia. */
export const INTERVALO_PING_MS = 2_000;

/** Pongs perdidos seguidos antes de dar el dispositivo por desconectado. */
export const PONGS_PERDIDOS_MAXIMOS = 2;

/** Antirrebote recomendado para los pulsadores (lo aplica el firmware). */
export const ANTIRREBOTE_MS = 25;
