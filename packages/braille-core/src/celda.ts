/**
 * Una celda Braille tiene seis puntos numerados así (orientación de lectura):
 *
 *   1 ● ● 4
 *   2 ● ● 5
 *   3 ● ● 6
 *
 * Se representa como máscara de 6 bits: el bit (i − 1) es el punto i.
 * Es la misma convención del protocolo con el ESP32 (docs/PROTOCOLO.md).
 */
export type Punto = 1 | 2 | 3 | 4 | 5 | 6;
export type Mascara = number;

export const PUNTOS: readonly Punto[] = [1, 2, 3, 4, 5, 6];
export const CELDA_VACIA: Mascara = 0;

export function esPunto(n: number): n is Punto {
  return Number.isInteger(n) && n >= 1 && n <= 6;
}

export function esMascaraValida(m: number): m is Mascara {
  return Number.isInteger(m) && m >= 0 && m <= 63;
}

export function puntosAMascara(puntos: readonly number[]): Mascara {
  let mascara = 0;
  for (const p of puntos) {
    if (!esPunto(p)) throw new RangeError(`Punto inválido: ${p}. Debe estar entre 1 y 6.`);
    mascara |= 1 << (p - 1);
  }
  return mascara;
}

export function mascaraAPuntos(mascara: Mascara): Punto[] {
  if (!esMascaraValida(mascara)) throw new RangeError(`Máscara inválida: ${mascara}.`);
  return PUNTOS.filter((p) => (mascara & (1 << (p - 1))) !== 0);
}

/** "145" → máscara de los puntos 1, 4 y 5. Notación usada en el oráculo de pruebas. */
export function mascaraDesdeCadena(puntos: string): Mascara {
  return puntosAMascara([...puntos].map(Number));
}

/** Máscara → "145". */
export function mascaraACadena(mascara: Mascara): string {
  return mascaraAPuntos(mascara).join('');
}

/**
 * Refleja la celda de izquierda a derecha (1↔4, 2↔5, 3↔6).
 * Es el error típico al escribir con regleta: se piensa la letra "al derecho" y sale en espejo.
 */
export function espejo(mascara: Mascara): Mascara {
  if (!esMascaraValida(mascara)) throw new RangeError(`Máscara inválida: ${mascara}.`);
  const izquierda = mascara & 0b000111; // puntos 1, 2, 3
  const derecha = mascara & 0b111000; // puntos 4, 5, 6
  return (izquierda << 3) | (derecha >> 3);
}

/** Lista de puntos en español para voz: "punto 1", "puntos 1 y 4", "puntos 1, 4 y 5". */
export function describirPuntos(mascara: Mascara): string {
  const puntos = mascaraAPuntos(mascara);
  if (puntos.length === 0) return 'celda vacía';
  if (puntos.length === 1) return `punto ${puntos[0]}`;
  const ultimos = puntos.slice(-1);
  const primeros = puntos.slice(0, -1);
  return `puntos ${primeros.join(', ')} y ${ultimos[0]}`;
}
