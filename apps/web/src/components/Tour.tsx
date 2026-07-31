import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { Button } from './Button';

export interface PasoTour {
  /**
   * Valor del `data-tour` del elemento que se resalta. Sin esto, el paso va
   * centrado en la pantalla (sirve para la bienvenida y la despedida).
   *
   * Se ancla por `data-tour` y no por clases de estilo a propósito: las clases
   * cambian cada vez que se retoca el diseño y el tour se rompería en silencio.
   */
  ancla?: string;
  titulo: string;
  texto: string;
}

/** Margen entre el recorte y el elemento, para que no quede pegado. */
const AIRE = 8;
/** Separación entre el recorte y el globo. */
const SEPARACION = 12;
const ANCHO_GLOBO = 300;

interface Recorte {
  top: number;
  left: number;
  width: number;
  height: number;
}

/** ¿Está en el documento y ocupa lugar? Un elemento oculto no se puede señalar. */
const visible = (el: HTMLElement | null): el is HTMLElement => {
  if (!el) return false;
  const r = el.getBoundingClientRect();
  return r.width > 0 && r.height > 0;
};

/**
 * Primera ancla **visible**, no la primera del marcado.
 *
 * Un mismo `data-tour` puede estar repetido a propósito cuando el elemento tiene
 * dos versiones según el ancho: en la ficha, las acciones viven en la tarjeta
 * lateral en escritorio y en una barra fija en teléfono, y solo una está a la vista.
 * Con `querySelector` a secas ganaba siempre la del marcado, así que en teléfono el
 * paso apuntaba a la oculta y se descartaba: el recorrido perdía un paso sin avisar.
 */
const buscar = (ancla?: string): HTMLElement | null => {
  if (!ancla) return null;
  const candidatos = document.querySelectorAll<HTMLElement>(`[data-tour="${ancla}"]`);
  for (const el of candidatos) if (visible(el)) return el;
  return null;
};

/**
 * Recorrido guiado sobre la interfaz real.
 *
 * El resto de la pantalla se oscurece con una sombra enorme proyectada desde el
 * recorte (`box-shadow: 0 0 0 9999px`). Es el truco que evita tener que dibujar
 * cuatro paneles alrededor del elemento o una máscara SVG: el hueco es el propio
 * elemento y la sombra tapa todo lo demás.
 */
export function Tour({
  pasos,
  onCerrar,
  etiqueta,
}: {
  pasos: PasoTour[];
  onCerrar: () => void;
  /** Nombre accesible del recorrido, para los lectores de pantalla. */
  etiqueta: string;
}) {
  /*
   * Los pasos cuyo elemento no está en la pantalla se descartan: el mapa sin
   * circuitos no tiene pines que señalar, y una ficha sin GPX no tiene botón de
   * descarga. Un globo apuntando a la nada es peor que no mostrar el paso.
   *
   * El filtro corre DESPUÉS de montar y no durante el render: si el tour se monta
   * en el mismo commit que los elementos que señala, en ese momento todavía no
   * están en el DOM y se descartarían todos.
   */
  const [utiles, setUtiles] = useState<PasoTour[] | null>(null);
  const [i, setI] = useState(0);
  const [recorte, setRecorte] = useState<Recorte | null>(null);
  const [estilo, setEstilo] = useState<Posicion>(() => posicionarGlobo(null));
  const globoRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    setUtiles(pasos.filter((p) => !p.ancla || visible(buscar(p.ancla))));

  }, []);

  const paso = utiles?.[i];
  const total = utiles?.length ?? 0;
  const ultimo = i === total - 1;

  const cerrar = useCallback(() => onCerrar(), [onCerrar]);

  const medir = useCallback(() => {
    const el = buscar(paso?.ancla);
    if (!visible(el)) {
      setRecorte(null);
      return;
    }
    const r = el.getBoundingClientRect();
    setRecorte({
      top: r.top - AIRE,
      left: r.left - AIRE,
      width: r.width + AIRE * 2,
      height: r.height + AIRE * 2,
    });
  }, [paso?.ancla]);

  // useLayoutEffect: medir antes de pintar evita que el recorte aparezca un cuadro
  // en la posición del paso anterior
  useLayoutEffect(medir, [medir]);

  useLayoutEffect(() => {
    setEstilo(posicionarGlobo(recorte));
  }, [recorte]);

  useEffect(() => {
    // `true` en la captura: si el elemento vive dentro de un contenedor con scroll
    // propio, el evento no burbujea hasta window
    window.addEventListener('resize', medir);
    window.addEventListener('scroll', medir, true);
    return () => {
      window.removeEventListener('resize', medir);
      window.removeEventListener('scroll', medir, true);
    };
  }, [medir]);

  useEffect(() => {
    globoRef.current?.focus();
  }, [i]);

  /*
   * Segunda pasada con el alto REAL del globo.
   *
   * La primera posición se calcula con un alto estimado, porque hasta que no está
   * dibujado no se sabe cuánto ocupa el texto. Con la estimación sola, un paso de
   * texto largo terminaba saliéndose por abajo de la pantalla en un teléfono.
   * El alto no depende de dónde se lo ubique —el ancho es fijo—, así que medir y
   * corregir no puede entrar en un ciclo.
   */
  useLayoutEffect(() => {
    const g = globoRef.current;
    if (!g) return;
    const alto = g.getBoundingClientRect().height;
    if (alto === 0) return;
    setEstilo((previo) => {
      const siguiente = posicionarGlobo(recorte, alto);
      return previo.top === siguiente.top && previo.left === siguiente.left ? previo : siguiente;
    });
  }, [recorte, i]);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') cerrar();
      else if (e.key === 'ArrowRight') setI((n) => Math.min(n + 1, total - 1));
      else if (e.key === 'ArrowLeft') setI((n) => Math.max(n - 1, 0));
    }
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [cerrar, total]);

  if (!paso) return null;

  return (
    <div className="fixed inset-0 z-[2000]" role="dialog" aria-modal="true" aria-label={etiqueta}>
      {/*
        Sin ancla, el fondo se oscurece entero y el globo va centrado. Con ancla, la
        sombra del recorte hace el oscurecido y este panel no debe sumarse, o el
        elemento resaltado quedaría igual de oscuro que el resto.
      */}
      {!recorte && <div className="fondo-modal absolute inset-0 bg-black/70" onClick={cerrar} />}

      {recorte && (
        <div
          aria-hidden="true"
          className="pointer-events-none absolute rounded-xl ring-2 ring-brand-400 transition-[top,left,width,height] duration-[var(--duracion-media)] ease-suave"
          style={{
            top: recorte.top,
            left: recorte.left,
            width: recorte.width,
            height: recorte.height,
            boxShadow: '0 0 0 9999px rgb(0 0 0 / 0.7)',
          }}
        />
      )}

      <div
        ref={globoRef}
        tabIndex={-1}
        className="flotante hoja absolute rounded-2xl p-4 outline-none"
        style={estilo}
      >
        <p className="mb-1 text-xs font-semibold tracking-[0.08em] text-white/55 uppercase">
          Paso {i + 1} de {total}
        </p>
        <h2 className="titulo mb-1.5 text-lg">{paso.titulo}</h2>
        <p className="mb-4 text-sm text-white/75">{paso.texto}</p>

        <div className="flex items-center gap-2">
          {/* los puntos dicen cuánto falta sin ocupar una línea de texto */}
          <div aria-hidden="true" className="flex flex-1 gap-1.5">
            {utiles?.map((p, n) => (
              <span
                key={p.titulo}
                className={`h-1.5 rounded-full transition-[background-color,width] duration-[var(--duracion-rapida)] ${
                  n === i ? 'w-4 bg-brand-400' : 'w-1.5 bg-white/25'
                }`}
              />
            ))}
          </div>

          {i > 0 && (
            <Button variante="ghost" tamano="sm" onClick={() => setI(i - 1)}>
              Atrás
            </Button>
          )}
          <Button
            variante="primary"
            tamano="sm"
            onClick={() => (ultimo ? cerrar() : setI(i + 1))}
          >
            {ultimo ? 'Entendido' : 'Siguiente'}
          </Button>
        </div>

        {!ultimo && (
          <button
            type="button"
            onClick={cerrar}
            className="mt-2 w-full py-1 text-xs font-medium text-white/50 transition-colors hover:text-white/80"
          >
            Saltar la guía
          </button>
        )}
      </div>
    </div>
  );
}

/**
 * Ubica el globo debajo del recorte si entra, y arriba si no. Después lo empuja
 * dentro de la pantalla: sobre un elemento pegado a un borde, el globo centrado se
 * salía y quedaba cortado.
 */
interface Posicion {
  width: number;
  left: number;
  top: number;
}

function posicionarGlobo(recorte: Recorte | null, alto = 200): Posicion {
  const ancho = Math.min(ANCHO_GLOBO, window.innerWidth - 24);
  if (!recorte) {
    return {
      width: ancho,
      left: (window.innerWidth - ancho) / 2,
      top: Math.max(12, (window.innerHeight - alto) / 2),
    };
  }

  const abajo = recorte.top + recorte.height + SEPARACION;
  const cabeAbajo = abajo + alto + 12 <= window.innerHeight;
  // si no entra ni arriba ni abajo (elemento alto en pantalla chica), se lo empuja
  // dentro igual: mejor tapar parte del recorte que dejar el texto fuera de la vista
  const top = cabeAbajo
    ? abajo
    : Math.min(Math.max(12, recorte.top - alto - SEPARACION), window.innerHeight - alto - 12);

  const centrado = recorte.left + recorte.width / 2 - ancho / 2;
  const left = Math.min(Math.max(12, centrado), window.innerWidth - ancho - 12);

  return { width: ancho, left, top };
}
