import { describe, expect, it } from 'vitest';
import {
  SeparadorLineas,
  codificar,
  decodificarApp,
  decodificarDispositivo,
  ejemplosApp,
  ejemplosDispositivo,
} from '../src';

describe('ejemplos del contrato', () => {
  it.each(Object.values(ejemplosApp))('app → dispositivo: $t ida y vuelta', (mensaje) => {
    const resultado = decodificarApp(codificar(mensaje));
    expect(resultado).toEqual({ ok: true, mensaje });
  });

  it.each(Object.values(ejemplosDispositivo))('dispositivo → app: $t ida y vuelta', (mensaje) => {
    const resultado = decodificarDispositivo(codificar(mensaje));
    expect(resultado).toEqual({ ok: true, mensaje });
  });

  it('cada línea termina en un único salto de línea', () => {
    expect(codificar(ejemplosApp.cell)).toBe('{"t":"cell","id":7,"m":9}\n');
  });
});

describe('líneas inválidas', () => {
  it('ignora el registro de arranque del ESP32 (texto plano)', () => {
    const r = decodificarDispositivo('rst:0x1 (POWERON_RESET),boot:0x13 (SPI_FAST_FLASH_BOOT)');
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('no-json');
  });

  it.each([
    ['máscara fuera de rango', '{"t":"chord","m":64}'],
    ['acorde vacío', '{"t":"chord","m":0}'],
    ['tipo desconocido', '{"t":"servo","id":1}'],
    ['falta el id del ack', '{"t":"ack"}'],
    ['tecla desconocida', '{"t":"key","k":"enter"}'],
  ])('rechaza %s', (_caso, linea) => {
    const r = decodificarDispositivo(linea);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('invalido');
  });

  it('rechaza líneas demasiado largas', () => {
    const r = decodificarDispositivo(`{"t":"boot","fw":"${'x'.repeat(300)}"}`);
    expect(r.ok).toBe(false);
    if (!r.ok) expect(r.motivo).toBe('demasiado-larga');
  });
});

describe('SeparadorLineas', () => {
  it('reconstruye líneas partidas en varios fragmentos', () => {
    const s = new SeparadorLineas();
    expect(s.agregar('{"t":"ch')).toEqual([]);
    expect(s.agregar('ord","m":9}\n{"t":"key",')).toEqual(['{"t":"chord","m":9}']);
    expect(s.agregar('"k":"ok"}\n')).toEqual(['{"t":"key","k":"ok"}']);
  });

  it('acepta finales de línea \\r\\n y omite líneas vacías', () => {
    const s = new SeparadorLineas();
    expect(s.agregar('{"t":"pong","id":1}\r\n\r\n')).toEqual(['{"t":"pong","id":1}']);
  });

  it('descarta basura sin saltos de línea para no crecer sin límite', () => {
    const s = new SeparadorLineas();
    s.agregar('x'.repeat(5_000));
    expect(s.agregar('{"t":"pong","id":2}\n')).toEqual(['{"t":"pong","id":2}']);
  });
});
