import { nombreConArticulo, type Signo } from './tabla';

/**
 * Lo que se narra cuando se presenta una letra (RF-06), después de que la celda quedó quieta:
 * "Letra 4 de 10. Toque la celda. Esta es la de. Su forma: codo a la derecha."
 *
 * La lectura se describe por la forma, no por los números de puntos (EXP-1). Si el signo no tiene
 * `figura` solo se nombra: la forma la validan los tiflólogos y no se inventa.
 */
export function describirPresentacion(signo: Signo, posicion: number, total: number): string {
  const forma = signo.figura ? ` Su forma: ${signo.figura}.` : '';
  return `Letra ${posicion} de ${total}. Toque la celda. Esta es ${nombreConArticulo(signo)}.${forma}`;
}
