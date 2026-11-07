import { esquemaMascara } from '@braille/protocol';
import { ErrorProtocolo } from './errores';

/**
 * Rechaza una máscara que el dispositivo no entendería, antes de enviarla. Sin esto, el firmware
 * responde `BAD_MESSAGE` sin `id` y la app espera dos timeouts para decir algo equivocado.
 * La regla es la del protocolo (`esquemaMascara`): un entero de 0 a 63.
 */
export function exigirMascaraValida(mascara: number): void {
  if (!esquemaMascara.safeParse(mascara).success) {
    throw new ErrorProtocolo('La máscara debe ser un número entero entre 0 y 63.');
  }
}
