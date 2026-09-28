import { CELDA_VACIA, type Mascara } from './celda';
import {
  DIGITO_A_LETRA,
  LETRA_A_DIGITO,
  MAYUSCULA,
  NUMERO,
  signoPorCaracter,
  signoPorId,
  signoPorMascara,
} from './tabla';

export interface CaracterNoSoportado {
  indice: number;
  caracter: string;
  /**
   * - desconocido: no está en la tabla.
   * - letra-tras-numero: una letra a–j justo después de un número se confundiría con un dígito;
   *   su separador debe definirse con los tiflólogos antes de soportarla.
   */
  motivo: 'desconocido' | 'letra-tras-numero';
}

export interface ResultadoCeldas {
  celdas: Mascara[];
  noSoportados: CaracterNoSoportado[];
}

export interface ResultadoTexto {
  texto: string;
  /** Posiciones de celdas que no corresponden a ningún signo de la tabla. */
  desconocidas: { indice: number; mascara: Mascara }[];
}

/** Carácter que se escribe en el texto cuando una celda no se reconoce. */
export const CARACTER_DESCONOCIDO = '�';

const esDigito = (c: string) => c >= '0' && c <= '9';

/** Texto en tinta → secuencia de celdas en braille integral (sin estenografía). */
export function textoACeldas(texto: string): ResultadoCeldas {
  const celdas: Mascara[] = [];
  const noSoportados: CaracterNoSoportado[] = [];
  let modoNumero = false;

  [...texto.normalize('NFC')].forEach((caracter, indice) => {
    if (caracter === ' ') {
      celdas.push(CELDA_VACIA);
      modoNumero = false;
      return;
    }

    if (esDigito(caracter)) {
      if (!modoNumero) celdas.push(NUMERO);
      modoNumero = true;
      celdas.push(signoPorId(DIGITO_A_LETRA[caracter]!)!.mascara);
      return;
    }

    const minuscula = caracter.toLocaleLowerCase('es');
    const esMayuscula = minuscula !== caracter;
    const signo = signoPorCaracter(minuscula);

    if (!signo) {
      noSoportados.push({ indice, caracter, motivo: 'desconocido' });
      modoNumero = false;
      return;
    }

    if (modoNumero && signo.serie === 1) {
      noSoportados.push({ indice, caracter, motivo: 'letra-tras-numero' });
      modoNumero = false;
      return;
    }

    modoNumero = false;
    if (esMayuscula) celdas.push(MAYUSCULA);
    celdas.push(signo.mascara);
  });

  return { celdas, noSoportados };
}

/** Secuencia de celdas → texto en tinta. Es la retrotraducción que usa el modo escritura. */
export function celdasATexto(celdas: readonly Mascara[]): ResultadoTexto {
  let texto = '';
  const desconocidas: ResultadoTexto['desconocidas'] = [];
  let mayuscula = false;
  let modoNumero = false;

  celdas.forEach((mascara, indice) => {
    if (mascara === CELDA_VACIA) {
      texto += ' ';
      mayuscula = false;
      modoNumero = false;
      return;
    }
    if (mascara === NUMERO) {
      modoNumero = true;
      return;
    }
    if (mascara === MAYUSCULA) {
      mayuscula = true;
      return;
    }

    const signo = signoPorMascara(mascara);

    if (modoNumero && signo?.serie === 1) {
      texto += LETRA_A_DIGITO[signo.id];
      return;
    }
    modoNumero = false;

    if (!signo) {
      desconocidas.push({ indice, mascara });
      texto += CARACTER_DESCONOCIDO;
      mayuscula = false;
      return;
    }

    let caracter: string;
    if (signo.par) {
      // Se escribe igual al abrir y al cerrar: abre al inicio o tras espacio/paréntesis.
      const anterior = texto.at(-1);
      const abre = anterior === undefined || anterior === ' ' || anterior === '(';
      caracter = abre ? signo.par.apertura : signo.par.cierre;
    } else {
      caracter = signo.caracteres[0] ?? '';
    }

    if (mayuscula) {
      caracter = caracter.toLocaleUpperCase('es');
      mayuscula = false;
    }
    texto += caracter;
  });

  return { texto, desconocidas };
}
