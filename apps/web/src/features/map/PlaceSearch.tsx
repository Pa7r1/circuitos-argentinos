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
      <div className="flex items-center gap-1 rounded-full bg-stone-100 px-3">
        <span aria-hidden="true" className="text-stone-500">
          ⌕
        </span>
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
          className="min-h-11 w-full bg-transparent text-base outline-none placeholder:text-stone-500"
        />
        {selected && (
          <button
            type="button"
            onClick={() => {
              onClear();
              setText('');
            }}
            aria-label={`Quitar el filtro de ${selected.name}`}
            className="min-h-11 px-1 text-stone-500 hover:text-stone-800"
          >
            ✕
          </button>
        )}
      </div>

      {showResults && (
        <div className="absolute top-full right-0 left-0 z-20 mt-1 overflow-hidden rounded-xl bg-white shadow-xl">
          {isFetching && <p className="px-3 py-3 text-sm text-stone-500">Buscando…</p>}
          {isError && (
            <p className="px-3 py-3 text-sm text-red-700">
              No se pudo buscar la localidad. Revisá tu conexión.
            </p>
          )}
          {!isFetching && !isError && places?.length === 0 && (
            <p className="px-3 py-3 text-sm text-stone-600">
              No encontramos «{term}». Probá con otra localidad o departamento.
            </p>
          )}
          <ul>
            {places?.map((place) => (
              <li key={place.id}>
                <button
                  type="button"
                  onClick={() => choose(place)}
                  className="block min-h-11 w-full px-3 py-2 text-left hover:bg-stone-100"
                >
                  <span className="block font-medium">{place.name}</span>
                  <span className="block text-xs text-stone-500">{place.detail}</span>
                </button>
              </li>
            ))}
          </ul>
          {places && places.length > 0 && (
            <p className="border-t border-stone-100 px-3 py-1.5 text-[11px] text-stone-400">
              Localidades: Georef · datos.gob.ar
            </p>
          )}
        </div>
      )}
    </div>
  );
}
