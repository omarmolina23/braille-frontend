import { describe, expect, it } from 'vitest';
import { describirPresentacion, signoPorId, signosDeSerie } from '../src';

describe('describirPresentacion (RF-06)', () => {
  it('con figura: dice la posición, invita a tocar, nombra la letra y describe su forma', () => {
    const texto = describirPresentacion(signoPorId('d')!, 4, 10);

    expect(texto).toBe(
      'Letra 4 de 10. Toque la celda. Esta es la de. Su forma: codo a la derecha.',
    );
  });

  it('sin figura: solo nombra la letra, sin inventar la forma', () => {
    const texto = describirPresentacion(signoPorId('a')!, 1, 10);

    expect(texto).toBe('Letra 1 de 10. Toque la celda. Esta es la a.');
    expect(texto).not.toMatch(/forma/i);
  });

  it('nunca describe por números de puntos', () => {
    for (const signo of signosDeSerie(1)) {
      const texto = describirPresentacion(signo, 1, 10);
      expect(texto).not.toMatch(/punto/i);
      // El único número del texto es el de la posición.
      expect(texto.replace('Letra 1 de 10.', '')).not.toMatch(/\d/);
    }
  });

  it('usa el artículo que corresponde al tipo de signo', () => {
    expect(describirPresentacion(signoPorId('ñ')!, 1, 1)).toContain('Esta es la eñe.');
    expect(describirPresentacion(signoPorId('mayuscula')!, 1, 1)).toContain(
      'Esta es el signo de mayúscula.',
    );
  });
});
