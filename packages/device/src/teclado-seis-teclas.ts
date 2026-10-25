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

/** Lo que el lector lleva del acorde en curso (para dibujarlo mientras se escribe). */
export interface EstadoLector {
  /** Puntos cuyas teclas siguen presionadas ahora mismo. */
  presionados: Mascara;
  /** Puntos del acorde que se emitiría si se soltaran todas las teclas ahora. */
  acorde: Mascara;
}

/**
 * Emite el acorde cuando se sueltan todas las teclas, igual que el firmware con los pulsadores
 * (docs/PROTOCOLO.md § 4, Escritura). El acorde son las teclas que estaban presionadas a la vez
 * justo después de la última que se presionó: soltarlas una por una no las quita, pero una tecla
 * que se soltó antes de presionar otra ya no cuenta (así se corrige una tecla equivocada).
 */
export function crearLectorSeisTeclas(
  onAcorde: (mascara: Mascara) => void,
  onCambio?: (estado: EstadoLector) => void,
): LectorSeisTeclas {
  const presionadas = new Set<string>();
  let acorde = 0;

  function mascaraPresionada(): Mascara {
    let mascara = 0;
    for (const codigo of presionadas) mascara |= 1 << (TECLA_A_PUNTO[codigo]! - 1);
    return mascara;
  }

  function avisar() {
    onCambio?.({ presionados: mascaraPresionada(), acorde });
  }

  return {
    teclaAbajo(codigo, repetida = false) {
      if (TECLA_A_PUNTO[codigo] === undefined) return false;
      if (!repetida) {
        presionadas.add(codigo);
        acorde = mascaraPresionada();
        avisar();
      }
      return true;
    },
    teclaArriba(codigo) {
      if (TECLA_A_PUNTO[codigo] === undefined) return false;
      presionadas.delete(codigo);
      if (presionadas.size === 0 && acorde > 0) {
        const mascara = acorde;
        acorde = 0;
        onAcorde(mascara);
      }
      avisar();
      return true;
    },
    reiniciar() {
      presionadas.clear();
      acorde = 0;
      avisar();
    },
  };
}
