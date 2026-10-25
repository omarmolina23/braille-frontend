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
  signoPorMascara,
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
  type EstadoLector,
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

type OrigenAcorde = 'teclado' | 'celda virtual' | 'dispositivo';

interface AcordeEscrito {
  mascara: Mascara;
  origen: OrigenAcorde;
}

const TEXTO_ORIGEN: Record<OrigenAcorde, string> = {
  teclado: 'con el teclado',
  'celda virtual': 'con la celda virtual',
  dispositivo: 'con el dispositivo',
};

const SIN_TECLAS: EstadoLector = { presionados: 0, acorde: 0 };

const mayuscula = (texto: string) => texto.charAt(0).toLocaleUpperCase('es') + texto.slice(1);
const bit = (punto: number) => 1 << (punto - 1);

function describirSigno(signo: Signo): string {
  const figura = signo.figura ? ` Figura: ${signo.figura}.` : '';
  return `${mayuscula(nombreConArticulo(signo))}: ${describirPuntos(signo.mascara)}.${figura}`;
}

type EstadoPunto = 'presionado' | 'soltado' | 'escrito' | 'vacio';

interface PropsVisor {
  teclado: EstadoLector;
  celdaVirtual: Mascara;
  ultimo: AcordeEscrito | null;
}

/**
 * Visor de la celda: muestra los puntos del acorde que se está escribiendo (teclado de seis teclas
 * o celda virtual) y, cuando no hay ninguno en curso, el último acorde escrito desde cualquier
 * entrada. El texto no es región live: los anuncios siguen saliendo por una sola voz.
 */
function VisorCelda({ teclado, celdaVirtual, ultimo }: PropsVisor) {
  const enTeclado = teclado.acorde !== 0;
  const enCurso = enTeclado ? teclado.acorde : celdaVirtual;

  function estadoDe(p: number): EstadoPunto {
    if (enTeclado) {
      if (teclado.presionados & bit(p)) return 'presionado';
      return teclado.acorde & bit(p) ? 'soltado' : 'vacio';
    }
    if (enCurso !== 0) return enCurso & bit(p) ? 'presionado' : 'vacio';
    return ultimo && ultimo.mascara & bit(p) ? 'escrito' : 'vacio';
  }

  let texto: string;
  if (enTeclado) {
    const sueltos = teclado.acorde & ~teclado.presionados;
    texto =
      `Escribiendo con el teclado: ${describirPuntos(teclado.acorde)}.` +
      (sueltos ? ` Ya soltaste ${describirPuntos(sueltos)}, pero sigue en el acorde.` : '');
  } else if (enCurso !== 0) {
    texto = `Marcando en la celda virtual: ${describirPuntos(enCurso)}.`;
  } else if (ultimo) {
    const signo = signoPorMascara(ultimo.mascara);
    texto =
      `Último acorde ${TEXTO_ORIGEN[ultimo.origen]}: ${describirPuntos(ultimo.mascara)}` +
      (signo ? `, ${nombreConArticulo(signo)}.` : ', que no corresponde a ningún signo.');
  } else {
    texto = 'Todavía no has presionado ningún punto.';
  }

  return (
    <section aria-labelledby="t-visor" className="visor">
      <h2 id="t-visor">Visor de la celda</h2>
      <div className="celda celda-visor" aria-hidden="true">
        {PUNTOS.map((p) => (
          <span key={p} className="punto" data-estado={estadoDe(p)}>
            <span className="numero">{p}</span>
          </span>
        ))}
      </div>
      <p>{texto}</p>
    </section>
  );
}

export function App() {
  const simulador = useMemo(() => new SimuladorDispositivo(), []);
  const [dispositivo, setDispositivo] = useState<DispositivoBraille>(simulador);
  const [estado, setEstado] = useState<EstadoConexion>('desconectado');
  const [indice, setIndice] = useState(0);
  const [anuncio, setAnuncio] = useState('');
  const [celdaVirtual, setCeldaVirtual] = useState<Mascara>(0);
  const [celdaMostrada, setCeldaMostrada] = useState<Mascara | null>(null);
  const [teclado, setTeclado] = useState<EstadoLector>(SIN_TECLAS);
  const [ultimoAcorde, setUltimoAcorde] = useState<AcordeEscrito | null>(null);
  /** Entrada de pantalla que originó el próximo acorde; si no hay, vino del dispositivo. */
  const origenRef = useRef<OrigenAcorde | null>(null);
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
      setUltimoAcorde({ mascara, origen: origenRef.current ?? 'dispositivo' });
      origenRef.current = null;
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
    (mascara: Mascara, origen: OrigenAcorde) => {
      origenRef.current = origen;
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
    lectorRef.current ??= crearLectorSeisTeclas(
      (m) => escribirRef.current(m, 'teclado'),
      setTeclado,
    );
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
    escribir(celdaVirtual, 'celda virtual');
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

      <VisorCelda teclado={teclado} celdaVirtual={celdaVirtual} ultimo={ultimoAcorde} />

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
