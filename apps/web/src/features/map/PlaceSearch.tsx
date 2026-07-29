import { useEffect, useState } from 'react';
import { usePlaceSearch, type Place } from '../../lib/geocode';

/** Buscador "Buscar en…": localidades y departamentos de Argentina. */
export function PlaceSearch({
  selected,
  onSelect,
  onClear,
}: {
  selected: Place | null;
  onSelect: (place: Place) => void;
  onClear: () => void;
}) {
  const [text, setText] = useState('');
  const [term, setTerm] = useState('');
  const [open, setOpen] = useState(false);

  // debounce: no dispara una consulta por tecla
  useEffect(() => {
    const id = setTimeout(() => setTerm(text), 300);
    return () => clearTimeout(id);
  }, [text]);

  const { data: places, isFetching, isError } = usePlaceSearch(term);
  const showResults = open && term.trim().length >= 3;

  function choose(place: Place) {
    onSelect(place);
    setText('');
    setTerm('');
    setOpen(false);
  }

  return (
    <div className="relative flex-1">
      <label htmlFor="place-search" className="sr-only">
        Buscar en una localidad o región
      </label>
      <div className="flex items-center gap-2 rounded-full bg-white/10 px-3 ring-1 ring-white/10 transition-colors duration-[var(--duracion-rapida)] focus-within:bg-white/15">
        <svg
          aria-hidden="true"
          width="17"
          height="17"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          className="shrink-0 text-white/60"
        >
          <circle cx="10.5" cy="10.5" r="6.5" />
          <path d="m15.5 15.5 4 4" />
        </svg>
        <input
          id="place-search"
          type="search"
          value={text}
          placeholder={selected ? `Buscar en ${selected.name}` : 'Buscar en…'}
          onChange={(e) => {
            setText(e.target.value);
            setOpen(true);
          }}
          onFocus={() => setOpen(true)}
          autoComplete="off"
          className="min-h-11 w-full bg-transparent text-base text-white outline-none placeholder:text-white/55"
        />
        {selected && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setText('');
            }}
            aria-label={`Quitar el filtro de ${selected.name}`}
            className="min-h-11 px-1 text-white/60 hover:text-white"
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <div className="hoja flotante absolute top-full right-0 left-0 z-20 mt-2 overflow-hidden rounded-xl">
          {isFetching && <p className="px-3 py-3 text-sm text-white/60">Buscando…</p>}
          {isError && (
            <p className="px-3 py-3 text-sm text-red-300">
              No se pudo buscar la localidad. Revisá tu conexión.
            </p>
          )}
          {!isFetching && !isError && places?.length === 0 && (
            <p className="px-3 py-3 text-sm text-white/70">
              No encontramos «{term}». Probá con otra localidad o departamento.
            </p>
          )}
          <ul>
            {places?.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="block min-h-11 w-full px-3 py-2 text-left transition-colors duration-[var(--duracion-rapida)] hover:bg-white/12"
                >
                  <span className="block font-medium text-white">{place.name}</span>
                  <span className="block text-xs text-white/60">{place.detail}</span>
                </button>
              </li>
            ))}
          </ul>
          {places && places.length > 0 && (
            <p className="border-t border-white/10 px-3 py-1.5 text-[11px] text-white/45">
              Localidades: Georef · datos.gob.ar
            </p>
          )}
        </div>
      )}
    </div>
  );
}
