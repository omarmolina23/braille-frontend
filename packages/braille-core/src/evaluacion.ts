import { espejo, mascaraAPuntos, type Mascara, type Punto } from './celda';
import { nombreConArticulo, signoPorMascara, type Signo } from './tabla';

/**
 * - acierto: escribió exactamente lo esperado.
 * - espejo: escribió la celda reflejada (1↔4, 2↔5, 3↔6), p. ej. f en vez de d.
 * - faltante: le faltan puntos y no sobra ninguno.
 * - sobrante: le sobran puntos y no falta ninguno.
 * - mixto: faltan y sobran puntos a la vez.
 */
export type TipoEvaluacion = 'acierto' | 'espejo' | 'faltante' | 'sobrante' | 'mixto';

export interface Evaluacion {
  tipo: TipoEvaluacion;
  esperada: Mascara;
  recibida: Mascara;
  faltantes: Punto[];
  sobrantes: Punto[];
  /** Signo de la tabla que corresponde a lo que escribió, si existe. */
  signoRecibido: Signo | undefined;
}

export function evaluar(esperada: Mascara, recibida: Mascara): Evaluacion {
  const faltantes = mascaraAPuntos(esperada & ~recibida & 0b111111);
  const sobrantes = mascaraAPuntos(recibida & ~esperada & 0b111111);
  const base = {
    esperada,
    recibida,
    faltantes,
    sobrantes,
    signoRecibido: signoPorMascara(recibida),
  };

  if (esperada === recibida) return { ...base, tipo: 'acierto' };
  if (espejo(esperada) === recibida) return { ...base, tipo: 'espejo' };
  if (sobrantes.length === 0) return { ...base, tipo: 'faltante' };
  if (faltantes.length === 0) return { ...base, tipo: 'sobrante' };
  return { ...base, tipo: 'mixto' };
}

function lista(puntos: readonly Punto[]): string {
  if (puntos.length === 1) return `${puntos[0]}`;
  return `${puntos.slice(0, -1).join(', ')} y ${puntos.at(-1)}`;
}

function frasePuntos(verboSingular: string, verboPlural: string, puntos: readonly Punto[]): string {
  return puntos.length === 1
    ? `${verboSingular} el punto ${lista(puntos)}`
    : `${verboPlural} los puntos ${lista(puntos)}`;
}

/**
 * Mensaje breve en español para la retroalimentación por voz o ARIA live.
 * Ejemplo: "Escribiste la efe: es la de en espejo."
 */
export function describirEvaluacion(evaluacion: Evaluacion, esperado: Signo): string {
  const { tipo, faltantes, sobrantes, signoRecibido } = evaluacion;
  const escribiste = signoRecibido ? `Escribiste ${nombreConArticulo(signoRecibido)}. ` : '';

  switch (tipo) {
    case 'acierto':
      return `Correcto: ${nombreConArticulo(esperado)}.`;
    case 'espejo':
      return `${escribiste}Es ${nombreConArticulo(esperado)} en espejo.`;
    case 'faltante':
      return `${escribiste}${frasePuntos('Falta', 'Faltan', faltantes)}.`;
    case 'sobrante':
      return `${escribiste}${frasePuntos('Sobra', 'Sobran', sobrantes)}.`;
    case 'mixto':
      return `${escribiste}${frasePuntos('Falta', 'Faltan', faltantes)} y ${frasePuntos('sobra', 'sobran', sobrantes)}.`;
  }
}
