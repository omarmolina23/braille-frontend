import type { Mascara } from './puerto';

/**
 * Entrada de seis teclas estilo Perkins: F, D, S = puntos 1, 2, 3; J, K, L = puntos 4, 5, 6.
 * Se usa `KeyboardEvent.code` (posición física), así funciona igual con teclado español o inglés.
 */
export const TECLA_A_PUNTO: Readonly<Record<string, number>> = {
  KeyF: 1,
  KeyD: 2,
  KeyS: 3,
  KeyJ: 4,
  KeyK: 5,
  KeyL: 6,
};

export interface LectorSeisTeclas {
  /** Devuelve true si la tecla es de puntos (para que la interfaz llame a preventDefault). */
  teclaAbajo(codigo: string, repetida?: boolean): boolean;
  teclaArriba(codigo: string): boolean;
  reiniciar(): void;
}

/**
 * Acumula los puntos mientras haya teclas presionadas y emite el acorde cuando se sueltan todas,
 * igual que el firmware con los pulsadores (docs/PROTOCOLO.md § 4, Escritura).
 */
export function crearLectorSeisTeclas(onAcorde: (mascara: Mascara) => void): LectorSeisTeclas {
  const presionadas = new Set<string>();
  let acumulado = 0;

  return {
    teclaAbajo(codigo, repetida = false) {
      const punto = TECLA_A_PUNTO[codigo];
      if (punto === undefined) return false;
      if (!repetida) {
        presionadas.add(codigo);
        acumulado |= 1 << (punto - 1);
      }
      return true;
    },
    teclaArriba(codigo) {
      if (TECLA_A_PUNTO[codigo] === undefined) return false;
      presionadas.delete(codigo);
      if (presionadas.size === 0 && acumulado > 0) {
        const mascara = acumulado;
        acumulado = 0;
        onAcorde(mascara);
      }
      return true;
    },
    reiniciar() {
      presionadas.clear();
      acumulado = 0;
    },
  };
}
