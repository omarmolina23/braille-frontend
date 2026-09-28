import { LONGITUD_MAXIMA_LINEA } from './constantes';
import {
  esquemaMensajeApp,
  esquemaMensajeDispositivo,
  type MensajeApp,
  type MensajeDispositivo,
} from './mensajes';

export type ResultadoDecodificacion<T> =
  | { ok: true; mensaje: T }
  | { ok: false; motivo: 'no-json' | 'invalido' | 'demasiado-larga'; detalle: string };

/** Convierte un mensaje en una línea NDJSON (JSON + salto de línea). */
export function codificar(mensaje: MensajeApp | MensajeDispositivo): string {
  return `${JSON.stringify(mensaje)}\n`;
}

function decodificarCon<T>(
  linea: string,
  validar: (dato: unknown) => { success: true; data: T } | { success: false; error: unknown },
): ResultadoDecodificacion<T> {
  const texto = linea.trim();
  if (texto.length > LONGITUD_MAXIMA_LINEA) {
    return { ok: false, motivo: 'demasiado-larga', detalle: `${texto.length} caracteres` };
  }
  let dato: unknown;
  try {
    dato = JSON.parse(texto);
  } catch {
    // Caso normal al reiniciar: el ROM del ESP32 imprime su registro de arranque en texto plano.
    return { ok: false, motivo: 'no-json', detalle: texto.slice(0, 60) };
  }
  const resultado = validar(dato);
  if (!resultado.success) {
    return { ok: false, motivo: 'invalido', detalle: String(resultado.error) };
  }
  return { ok: true, mensaje: resultado.data };
}

/** Decodifica una línea enviada por el dispositivo. Nunca lanza excepciones. */
export function decodificarDispositivo(linea: string): ResultadoDecodificacion<MensajeDispositivo> {
  return decodificarCon(linea, (d) => esquemaMensajeDispositivo.safeParse(d));
}

/** Decodifica una línea enviada por la app (lo usa el firmware falso de las pruebas). */
export function decodificarApp(linea: string): ResultadoDecodificacion<MensajeApp> {
  return decodificarCon(linea, (d) => esquemaMensajeApp.safeParse(d));
}

/**
 * Reúne fragmentos de texto del puerto serie y entrega líneas completas.
 * El puerto entrega trozos arbitrarios: una línea puede llegar partida en varios fragmentos.
 */
export class SeparadorLineas {
  private pendiente = '';

  agregar(fragmento: string): string[] {
    this.pendiente += fragmento;
    const partes = this.pendiente.split('\n');
    this.pendiente = partes.pop() ?? '';
    if (this.pendiente.length > LONGITUD_MAXIMA_LINEA * 4) {
      // Basura sin saltos de línea: se descarta para no crecer sin límite.
      this.pendiente = '';
    }
    return partes.map((p) => p.replace(/\r$/, '')).filter((p) => p.trim().length > 0);
  }
}
