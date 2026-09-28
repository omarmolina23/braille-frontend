/**
 * DEMO DE INTEGRACIÓN (no es la interfaz final).
 * Comprueba que braille-core, el simulador y el adaptador Web Serial encajan en una lección
 * mínima de la serie a–j. El diseño visual llega después de la sesión de ideación; aquí solo
 * importan la semántica y la accesibilidad.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  PUNTOS,
  describirEvaluacion,
  describirPuntos,
  evaluar,
  mascaraAPuntos,
  nombreConArticulo,
  signosDeSerie,
  type Mascara,
  type Signo,
} from '@braille/core';
import {
  DispositivoWebSerial,
  SimuladorDispositivo,
  crearLectorSeisTeclas,
  solicitarPuertoSerie,
  webSerialDisponible,
  type DispositivoBraille,
  type EstadoConexion,
  type LectorSeisTeclas,
} from '@braille/device';

const LETRAS = signosDeSerie(1);

const TEXTO_ESTADO: Record<EstadoConexion, string> = {
  desconectado: 'desconectado',
  conectando: 'conectando…',
  listo: 'listo',
  moviendo: 'moviendo la celda…',
  error: 'error de conexión',
};

const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
const bit = (punto: number) => 1 << (punto - 1);

function describirSigno(signo: Signo): string {
  const figura = signo.figura ? ` Figura: ${signo.figura}.` : '';
  return `${mayuscula(nombreConArticulo(signo))}: ${describirPuntos(signo.mascara)}.${figura}`;
}

export function App() {
  const simulador = useMemo(() => new SimuladorDispositivo(), []);
  const [dispositivo, setDispositivo] = useState<DispositivoBraille>(simulador);
  const [estado, setEstado] = useState<EstadoConexion>('desconectado');
  const [indice, setIndice] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [celdaVirtual, setCeldaVirtual] = useState<Mascara>(0);
  const [celdaMostrada, setCeldaMostrada] = useState<Mascara | null>(null);
  const objetivo = LETRAS[indice % LETRAS.length]!;
  const esFisico = dispositivo !== simulador;

  const objetivoRef = useRef(objetivo);
  useEffect(() => {
    objetivoRef.current = objetivo;
  }, [objetivo]);

  /** Región ARIA live: el lector de pantalla lo lee con la voz que la persona ya configuró. */
  const anunciar = useCallback((texto: string) => {
    setAnuncio(''); // vaciar primero permite repetir un mensaje idéntico
    window.setTimeout(() => setAnuncio(texto), 60);
  }, []);

  const manejarAcorde = useCallback(
    (mascara: Mascara) => {
      const esperado = objetivoRef.current;
      const evaluacion = evaluar(esperado.mascara, mascara);
      const mensaje = describirEvaluacion(evaluacion, esperado);
      if (evaluacion.tipo === 'acierto') {
        const siguiente = LETRAS[(LETRAS.indexOf(esperado) + 1) % LETRAS.length]!;
        setIndice((i) => i + 1);
        setCeldaMostrada(null);
        anunciar(`${mensaje} Ahora escribe ${nombreConArticulo(siguiente)}.`);
      } else {
        anunciar(`${mensaje} Intenta de nuevo ${nombreConArticulo(esperado)}.`);
      }
    },
    [anunciar],
  );

  const repetirInstruccion = useCallback(() => {
    anunciar(`Escribe ${nombreConArticulo(objetivoRef.current)}.`);
  }, [anunciar]);

  // Suscripción a los eventos del dispositivo activo y conexión inicial.
  useEffect(() => {
    const cancelar = [
      dispositivo.onEstado((nuevo) => {
        setEstado(nuevo);
        if (nuevo === 'desconectado' && dispositivo !== simulador) {
          anunciar('Se desconectó el dispositivo. Puedes seguir con la celda virtual.');
        }
      }),
      dispositivo.onAcorde(manejarAcorde),
      dispositivo.onTecla((tecla) => {
        if (tecla === 'repeat') repetirInstruccion();
      }),
    ];
    if (dispositivo.estado === 'desconectado') {
      dispositivo
        .conectar()
        .then((info) =>
          anunciar(
            `${info.firmware === 'simulador' ? 'Simulador' : 'Dispositivo'} listo. ` +
              `Escribe ${nombreConArticulo(objetivoRef.current)}.`,
          ),
        )
        .catch((error: Error) => {
          anunciar(`No se pudo conectar: ${error.message}`);
          setDispositivo(simulador);
        });
    }
    return () => cancelar.forEach((c) => c());
  }, [dispositivo, simulador, manejarAcorde, repetirInstruccion, anunciar]);

  // La escritura de pantalla pasa por el mismo camino que la del dispositivo.
  const escribir = useCallback(
    (mascara: Mascara) => {
      if (dispositivo === simulador) simulador.pulsarAcorde(mascara);
      else manejarAcorde(mascara);
    },
    [dispositivo, simulador, manejarAcorde],
  );
  const escribirRef = useRef(escribir);
  useEffect(() => {
    escribirRef.current = escribir;
  }, [escribir]);
  const lectorRef = useRef<LectorSeisTeclas | null>(null);
  /** Solo se llama desde manejadores de eventos (nunca durante el render). */
  function lector(): LectorSeisTeclas {
    lectorRef.current ??= crearLectorSeisTeclas((m) => escribirRef.current(m));
    return lectorRef.current;
  }

  async function conectarUsb() {
    try {
      const puerto = await solicitarPuertoSerie();
      setDispositivo(new DispositivoWebSerial(puerto));
    } catch (error) {
      anunciar(`No se abrió ningún puerto: ${(error as Error).message}`);
    }
  }

  async function volverAlSimulador() {
    await dispositivo.desconectar();
    setDispositivo(simulador);
  }

  async function mostrarEnCelda() {
    try {
      await dispositivo.mostrarCelda(objetivo.mascara);
      setCeldaMostrada(objetivo.mascara);
      anunciar(`${describirSigno(objetivo)} Tócala y luego escríbela.`);
    } catch (error) {
      anunciar(`La celda no respondió: ${(error as Error).message}`);
    }
  }

  function enviarCeldaVirtual() {
    if (celdaVirtual === 0) {
      anunciar('La celda está vacía: marca al menos un punto.');
      return;
    }
    escribir(celdaVirtual);
    setCeldaVirtual(0);
  }

  return (
    <main>
      <h1>Práctica de la serie a–j</h1>
      <p className="nota">
        Demo de integración: comprueba el núcleo Braille y el dispositivo. No es la interfaz final.
      </p>

      <div role="status" aria-live="polite" aria-atomic="true" className="anuncio">
        {anuncio}
      </div>

      <section aria-labelledby="t-dispositivo">
        <h2 id="t-dispositivo">Dispositivo</h2>
        <p>
          Usando {esFisico ? 'el dispositivo por USB' : 'el simulador'}: {TEXTO_ESTADO[estado]}.
        </p>
        {esFisico ? (
          <button type="button" onClick={volverAlSimulador}>
            Volver al simulador
          </button>
        ) : webSerialDisponible() ? (
          <button type="button" onClick={conectarUsb}>
            Conectar dispositivo por USB
          </button>
        ) : (
          <p>
            Este navegador no permite conectar el dispositivo. Usa Chrome o Edge de escritorio;
            mientras tanto, practica con la celda virtual.
          </p>
        )}
      </section>

      <section aria-labelledby="t-ejercicio">
        <h2 id="t-ejercicio">Ejercicio</h2>
        <p className="consigna">
          Escribe <strong>{nombreConArticulo(objetivo)}</strong>.
        </p>
        <div className="acciones">
          <button type="button" onClick={repetirInstruccion}>
            Repetir instrucción
          </button>
          <button type="button" onClick={mostrarEnCelda} disabled={estado !== 'listo'}>
            Mostrar en la celda
          </button>
        </div>

        {celdaMostrada !== null && (
          <div className="celda-mostrada">
            <div className="celda" aria-hidden="true">
              {PUNTOS.map((p) => (
                <span key={p} className="punto" data-activo={(celdaMostrada & bit(p)) !== 0} />
              ))}
            </div>
            <p>{describirSigno(objetivo)}</p>
          </div>
        )}

        {/*
          role="application" hace que NVDA y JAWS pasen a modo foco y dejen llegar F D S J K L
          (en modo exploración esas letras son atajos de navegación). jsx-a11y lo trata como rol
          no interactivo; la excepción es deliberada y debe validarse con NVDA y JAWS reales.
        */}
        {/* eslint-disable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
        <div
          className="area-escritura"
          role="application"
          tabIndex={0}
          aria-label="Área de escritura. Usa F, D y S para los puntos 1, 2 y 3; J, K y L para los puntos 4, 5 y 6. Suelta todas las teclas para confirmar. Espacio repite la instrucción."
          onKeyDown={(e) => {
            if (lector().teclaAbajo(e.code, e.repeat)) e.preventDefault();
            else if (e.code === 'Space') {
              e.preventDefault();
              repetirInstruccion();
            }
          }}
          onKeyUp={(e) => {
            if (lector().teclaArriba(e.code)) e.preventDefault();
          }}
          onBlur={() => lector().reiniciar()}
        >
          Área de escritura con teclado: F D S · J K L
        </div>
        {/* eslint-enable jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/no-noninteractive-tabindex */}
      </section>

      <section aria-labelledby="t-celda">
        <h2 id="t-celda">Celda virtual</h2>
        <div className="celda celda-virtual" role="group" aria-labelledby="t-celda">
          {PUNTOS.map((p) => (
            <button
              key={p}
              type="button"
              className="punto"
              aria-pressed={(celdaVirtual & bit(p)) !== 0}
              onClick={() => setCeldaVirtual((c) => c ^ bit(p))}
            >
              {p}
            </button>
          ))}
        </div>
        <p>Marcados: {celdaVirtual === 0 ? 'ninguno' : mascaraAPuntos(celdaVirtual).join(', ')}</p>
        <button type="button" onClick={enviarCeldaVirtual}>
          Enviar celda
        </button>
      </section>
    </main>
  );
}
