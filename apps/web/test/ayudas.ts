// Ayudas compartidas por las pruebas de interfaz del dispositivo (RF-01, RF-02).
import { vi } from 'vitest';
import { FirmwareFalso } from '@braille/device/pruebas';

export const NOMBRE_BOTON_CONECTAR = 'Conectar dispositivo por USB';
export const NOMBRE_BOTON_RECONECTAR = 'Reconectar';

/** Instala un `navigator.serial` falso y devuelve sus espías. */
export function simularSerial(
  requestPort: () => Promise<unknown>,
  puertosAutorizados: readonly unknown[] = [],
) {
  const solicitar = vi.fn(requestPort);
  const autorizados = vi.fn(() => Promise.resolve([...puertosAutorizados]));
  vi.stubGlobal('navigator', { serial: { requestPort: solicitar, getPorts: autorizados } });
  return { solicitar, autorizados };
}

/** Puerto de un ESP32 falso, con su espía de `open`. */
export function puertoFalso(opciones: ConstructorParameters<typeof FirmwareFalso>[0] = {}) {
  const falso = new FirmwareFalso(opciones);
  const puerto = falso.crearPuerto();
  const abrir = vi.spyOn(puerto, 'open');
  return { falso, puerto, abrir };
}

/** Todos los textos no vacíos que toma la región `role="status"`, en orden. */
export function registrarAnuncios(region: HTMLElement): string[] {
  const textos: string[] = [];
  new MutationObserver(() => {
    const texto = region.textContent ?? '';
    if (texto !== '' && textos.at(-1) !== texto) textos.push(texto);
  }).observe(region, { childList: true, characterData: true, subtree: true });
  return textos;
}
