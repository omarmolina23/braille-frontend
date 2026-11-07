interface PropsPresentacion {
  /** El dispositivo acepta órdenes a la celda. */
  habilitada: boolean;
  onPresentar: () => void;
  onSiguiente: () => void;
}

/**
 * Presentación de letras (RF-06): se levanta una letra y la persona la reconoce al tacto por su
 * forma. Solo se presenta: no se evalúa ni genera intentos. Lo que se narra lo decide `App`.
 */
export function PresentacionLetras({ habilitada, onPresentar, onSiguiente }: PropsPresentacion) {
  return (
    <section aria-labelledby="t-presentacion" className="panel">
      <h2 id="t-presentacion">Presentación de letras</h2>
      <p className="nota">
        Se levanta una letra en la celda para que la reconozcas al tacto por su forma.
      </p>
      <div className="acciones">
        <button type="button" className="principal" onClick={onPresentar} disabled={!habilitada}>
          Presentar la letra
        </button>
        <button type="button" onClick={onSiguiente}>
          Siguiente letra
        </button>
      </div>
    </section>
  );
}
