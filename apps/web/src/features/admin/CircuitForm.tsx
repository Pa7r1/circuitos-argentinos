import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminCircuitDetail, ScheduleInput } from '@circuitos/shared';
import {
  ACCESS_TYPES,
  DIFFICULTIES,
  DISCIPLINES,
  PROVINCES,
  resolveExternalMap,
} from '@circuitos/shared';
import { LocationPicker } from './LocationPicker';
import { Button } from '../../components/Button';
import { Field, SelectField } from '../../components/Field';
import { Modal } from '../../components/Modal';
import { useToast } from '../../components/Toast';
import { api, API_URL, RequestError } from '../../lib/api';
import { resizeImage } from '../../lib/image';
import { ACCESS_LABEL, DAY_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { circuitKeys } from '../../lib/queries';
import { GpxPreview, parseGpxCoordinates } from './GpxPreview';
import { parsearPlantilla } from './pegar-datos';

interface Props {
  /** si viene, es edición; si no, alta */
  editing?: AdminCircuitDetail;
  onDone: () => void;
  /** Hay algo cargado: quien monta el formulario deja de cerrarlo por accidente. */
  onSucio?: () => void;
}

/** Los textarea no pasan por `Field`, pero comparten su aspecto. */
const textareaClass =
  'w-full rounded-xl bg-white/8 px-3 py-2.5 text-base text-white ring-1 ring-white/12 transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] focus:bg-white/12 focus:ring-2 focus:ring-brand-400 focus:outline-none placeholder:text-white/40';

export function CircuitForm({ editing, onDone, onSucio = () => {} }: Props) {
  const queryClient = useQueryClient();
  const toast = useToast();

  const [name, setName] = useState(editing?.name ?? '');
  const [description, setDescription] = useState(editing?.description ?? '');
  const [discipline, setDiscipline] = useState(editing?.discipline ?? 'enduro');
  const [province, setProvince] = useState(editing?.province ?? 'la-rioja');
  const [locality, setLocality] = useState(editing?.locality ?? '');
  const [difficulty, setDifficulty] = useState<string>(editing?.difficulty ?? 'intermedio');
  const [accessType, setAccessType] = useState<string>(editing?.accessType ?? 'libre');
  const [accessNotes, setAccessNotes] = useState(editing?.accessNotes ?? '');
  const [schedules, setSchedules] = useState<ScheduleInput[]>(editing?.schedules ?? []);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxCoords, setGpxCoords] = useState<[number, number][] | null>(null);

  // Desde Relive o Strava no se puede exportar el GPX, así que el camino del
  // enlace es el habitual y viene elegido de entrada.
  const [origen, setOrigen] = useState<'enlace' | 'gpx'>(
    editing?.hasTrack ? 'gpx' : 'enlace',
  );
  const [externalMapUrl, setExternalMapUrl] = useState(editing?.externalMapUrl ?? '');
  const [punto, setPunto] = useState<[number, number] | null>(
    editing ? editing.startPoint.coordinates : null,
  );
  const [km, setKm] = useState(
    editing && !editing.hasTrack ? String(editing.distanceM / 1000).replace('.', ',') : '',
  );
  const [desnivel, setDesnivel] = useState(
    editing?.elevationGainM !== null && editing?.elevationGainM !== undefined
      ? String(editing.elevationGainM)
      : '',
  );

  const mapaExterno = resolveExternalMap(externalMapUrl);
  const enlaceInvalido = externalMapUrl.trim() !== '' && mapaExterno === null;
  const metros = Math.round(Number(km.replace(',', '.')) * 1000);
  const [pegando, setPegando] = useState(false);
  const [photos, setPhotos] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);
  const [borradas, setBorradas] = useState<string[]>([]);

  async function handleGpx(file: File) {
    setGpxFile(file);
    onSucio();
    try {
      setGpxCoords(parseGpxCoordinates(await file.text()));
    } catch {
      setGpxCoords([]);
    }
  }

  /** Vuelca en el formulario lo que se entendió del mensaje pegado. */
  function aplicarPegado(texto: string) {
    const { campos, ignoradas } = parsearPlantilla(texto);
    const cuantos = Object.keys(campos).length;

    if (campos.name !== undefined) setName(campos.name);
    if (campos.description !== undefined) setDescription(campos.description);
    if (campos.discipline !== undefined) setDiscipline(campos.discipline);
    if (campos.province !== undefined) setProvince(campos.province);
    if (campos.locality !== undefined) setLocality(campos.locality);
    if (campos.difficulty !== undefined) setDifficulty(campos.difficulty);
    if (campos.accessType !== undefined) setAccessType(campos.accessType);
    if (campos.accessNotes !== undefined) setAccessNotes(campos.accessNotes);
    if (campos.km !== undefined) setKm(campos.km);
    if (campos.desnivel !== undefined) setDesnivel(campos.desnivel);
    if (campos.externalMapUrl !== undefined) {
      setExternalMapUrl(campos.externalMapUrl);
      // si trajo enlace, el camino es por enlace y no por archivo
      setOrigen('enlace');
    }

    setPegando(false);
    onSucio();
    if (cuantos === 0) {
      toast('No reconocí ningún dato. Revisá que cada renglón tenga "Campo: valor".');
      return;
    }
    toast(
      `${cuantos} ${cuantos === 1 ? 'campo completado' : 'campos completados'}` +
        (ignoradas.length ? `. Sin reconocer: ${ignoradas.join(', ')}` : '') +
        '. Falta marcar el punto en el mapa.',
      'success',
    );
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const fields = {
        name,
        description: description || undefined,
        discipline,
        province,
        locality: locality || undefined,
        difficulty: difficulty as AdminCircuitDetail['difficulty'],
        accessType: accessType as AdminCircuitDetail['accessType'],
        accessNotes: accessNotes || undefined,
        schedules,
      };
      // datos que aporta el enlace y que el GPX calcularía solo
      const porEnlace =
        origen === 'enlace'
          ? {
              externalMapUrl: externalMapUrl.trim(),
              startLat: punto![1],
              startLon: punto![0],
              distanceM: metros,
              ...(desnivel ? { elevationGainM: Number(desnivel) } : {}),
            }
          : {};

      let circuitId: string;
      if (editing) {
        await api.admin.update(editing.id, { ...fields, ...porEnlace });
        circuitId = editing.id;
      } else {
        const form = new FormData();
        if (origen === 'gpx') {
          if (!gpxFile) throw new Error('Falta el archivo GPX');
          form.append('gpx', gpxFile);
        }
        for (const [key, value] of Object.entries({ ...fields, ...porEnlace })) {
          if (value === undefined) continue;
          form.append(key, key === 'schedules' ? JSON.stringify(value) : String(value));
        }
        const created = await api.admin.create(form);
        circuitId = created.id;
      }
      for (const photo of photos) {
        await api.admin.uploadMedia(circuitId, await resizeImage(photo));
      }
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: circuitKeys.all });
      void queryClient.invalidateQueries({ queryKey: circuitKeys.adminList });
      toast(editing ? 'Circuito actualizado' : 'Circuito creado como borrador', 'success');
      onDone();
    },
    onError: (error) => {
      toast(error instanceof RequestError ? error.message : 'No se pudo guardar el circuito');
    },
  });

  function updateSchedule(index: number, patch: Partial<ScheduleInput>) {
    setSchedules((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)));
  }

  return (
    <form
      className="space-y-4"
      /*
        Un solo listener para los diecisiete campos: `input` burbujea desde todos
        los controles nativos, así que no hay que tocar cada onChange. Lo que no
        pasa por un control nativo —el punto en el mapa, el GPX soltado en la
        zona, las fotos— avisa desde su propio handler.
      */
      onInput={onSucio}
      onSubmit={(e) => {
        e.preventDefault();
        if (origen === 'gpx') {
          if (!editing && (!gpxCoords || gpxCoords.length < 2)) {
            toast('Cargá un GPX válido antes de guardar');
            return;
          }
        } else {
          if (!mapaExterno) {
            toast('Pegá el enlace del recorrido (tiene que empezar con https://)');
            return;
          }
          if (!punto) {
            toast('Marcá en el mapa dónde arranca el circuito');
            return;
          }
          if (!Number.isFinite(metros) || metros <= 0) {
            toast('Cargá la distancia del circuito en kilómetros');
            return;
          }
        }
        mutation.mutate();
      }}
    >
      {/*
        Los datos llegan por WhatsApp con la planilla de docs/PLANTILLA-CIRCUITO.md,
        en texto o transcritos de un audio. Pegarlos completa el formulario de una
        vez, en vez de tipear campo por campo; nada se guarda sin revisarlo.
      */}
      {!editing && (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setPegando(true)}
            className="min-h-9 text-sm font-medium text-brand-300 underline-offset-4 hover:text-brand-200 hover:underline"
          >
            Pegar datos de un mensaje
          </button>
        </div>
      )}

      {!editing && (
        <div
          className="flex gap-1 rounded-xl bg-white/8 p-1 ring-1 ring-white/10"
          role="group"
          aria-label="De dónde sale el recorrido"
        >
          {(
            [
              ['enlace', 'Tengo el enlace'],
              ['gpx', 'Tengo el archivo GPX'],
            ] as const
          ).map(([valor, texto]) => (
            <button
              key={valor}
              type="button"
              aria-pressed={origen === valor}
              onClick={() => setOrigen(valor)}
              className={`min-h-11 flex-1 rounded-md text-sm font-medium transition-colors ${
                origen === valor ? 'bg-white/15 text-white shadow-card' : 'text-white/60 hover:text-white'
              }`}
            >
              {texto}
            </button>
          ))}
        </div>
      )}

      {origen === 'enlace' && (
        <>
          <Field
            label="Enlace al recorrido *"
            id="externalMapUrl"
            type="url"
            inputMode="url"
            placeholder="https://www.relive.com/view/…"
            value={externalMapUrl}
            onChange={(e) => setExternalMapUrl(e.target.value)}
            error={enlaceInvalido ? 'Tiene que ser un enlace que empiece con https://' : undefined}
            ayuda={
              mapaExterno ? (
                mapaExterno.embedUrl ? (
                  <span className="font-medium text-green-700">
                    Reconocí {mapaExterno.providerName}: el recorrido se va a ver dentro de la ficha.
                  </span>
                ) : (
                  <span className="text-white/65">
                    {mapaExterno.providerName} no permite mostrarlo acá dentro: va a quedar como
                    enlace.
                  </span>
                )
              ) : (
                'Relive, Strava, Wikiloc, Komoot o Google My Maps. Cualquier otro sitio queda como enlace.'
              )
            }
          />

          <LocationPicker
            value={punto}
            onChange={(p) => {
              onSucio();
              setPunto(p);
            }}
          />

          <div className="grid grid-cols-2 gap-3">
            <Field
              label="Distancia (km) *"
              id="km"
              inputMode="decimal"
              placeholder="12,5"
              value={km}
              onChange={(e) => setKm(e.target.value)}
              ayuda="El número que muestra la app del recorrido."
            />
            <Field
              label="Desnivel (m)"
              id="desnivel"
              inputMode="numeric"
              placeholder="340"
              value={desnivel}
              onChange={(e) => setDesnivel(e.target.value.replace(/\D/g, ''))}
            />
          </div>
        </>
      )}

      {origen === 'gpx' && !editing && (
        <div>
          <label htmlFor="gpx" className="mb-1 block text-sm font-medium">
            Archivo GPX *
          </label>
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files[0];
              if (file) void handleGpx(file);
            }}
            className={`rounded-lg border-2 border-dashed p-4 text-center text-sm ${
              dragging ? 'border-brand-400 bg-brand-400/12' : 'border-white/20'
            }`}
          >
            <p className="mb-2">{gpxFile ? gpxFile.name : 'Arrastrá el GPX acá, o'}</p>
            <input
              id="gpx"
              type="file"
              accept=".gpx"
              className="mx-auto block text-sm"
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleGpx(file);
              }}
            />
          </div>
          {gpxCoords && (
            <div className="mt-2">
              <GpxPreview coordinates={gpxCoords} />
            </div>
          )}
        </div>
      )}

      <Field
        label="Nombre *"
        id="name"
        required
        value={name}
        onChange={(e) => setName(e.target.value)}
      />

      <div className="grid grid-cols-2 gap-3">
        <SelectField
          label="Disciplina *"
          id="discipline"
          value={discipline}
          onChange={(e) => setDiscipline(e.target.value)}
        >
          {DISCIPLINES.map((d) => (
            <option key={d.slug} value={d.slug}>
              {d.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Provincia *"
          id="province"
          value={province}
          onChange={(e) => setProvince(e.target.value)}
        >
          {PROVINCES.map((p) => (
            <option key={p.slug} value={p.slug}>
              {p.name}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Dificultad *"
          id="difficulty"
          value={difficulty}
          onChange={(e) => setDifficulty(e.target.value)}
        >
          {DIFFICULTIES.map((d) => (
            <option key={d} value={d}>
              {DIFFICULTY_LABEL[d]}
            </option>
          ))}
        </SelectField>
        <SelectField
          label="Acceso *"
          id="accessType"
          value={accessType}
          onChange={(e) => setAccessType(e.target.value)}
        >
          {ACCESS_TYPES.map((a) => (
            <option key={a} value={a}>
              {ACCESS_LABEL[a]}
            </option>
          ))}
        </SelectField>
      </div>

      <Field
        label="Localidad"
        id="locality"
        value={locality}
        onChange={(e) => setLocality(e.target.value)}
      />

      <div>
        <label htmlFor="accessNotes" className="mb-1.5 block text-sm font-medium text-white/80">
          Notas de acceso
        </label>
        <textarea
          id="accessNotes"
          value={accessNotes}
          onChange={(e) => setAccessNotes(e.target.value)}
          rows={2}
          className={textareaClass}
          placeholder="Ej: pedir permiso en el club, cuota de mantenimiento…"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-white/80">
          Descripción
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={textareaClass}
        />
      </div>

      <fieldset>
        <legend className="mb-1 text-sm font-medium">Horarios</legend>
        {schedules.map((s, i) => (
          <div key={i} className="mb-2 flex flex-wrap items-center gap-2">
            <select
              aria-label="Día"
              value={s.dayOfWeek}
              onChange={(e) => updateSchedule(i, { dayOfWeek: Number(e.target.value) })}
              className="rounded-xl bg-white/8 px-2 py-2 text-white ring-1 ring-white/12"
            >
              {DAY_LABEL.map((d, day) => (
                <option key={day} value={day}>
                  {d}
                </option>
              ))}
            </select>
            <input
              type="time"
              aria-label="Abre"
              value={s.opens ?? ''}
              onChange={(e) => updateSchedule(i, { opens: e.target.value || null })}
              className="rounded-xl bg-white/8 px-2 py-2 text-white ring-1 ring-white/12"
            />
            <input
              type="time"
              aria-label="Cierra"
              value={s.closes ?? ''}
              onChange={(e) => updateSchedule(i, { closes: e.target.value || null })}
              className="rounded-xl bg-white/8 px-2 py-2 text-white ring-1 ring-white/12"
            />
            <Button
              type="button"
              variante="danger"
              tamano="sm"
              aria-label="Quitar horario"
              onClick={() => setSchedules((prev) => prev.filter((_, j) => j !== i))}
            >
              ✕
            </Button>
          </div>
        ))}
        <Button
          type="button"
          variante="secondary"
          tamano="sm"
          onClick={() =>
            setSchedules((prev) => [...prev, { dayOfWeek: 6, opens: null, closes: null }])
          }
        >
          <span aria-hidden="true">+</span> Agregar horario
        </Button>
      </fieldset>

      {editing && editing.media.length > 0 && (
        <div>
          <p className="mb-1 text-sm font-medium">Fotos cargadas</p>
          <div className="flex flex-wrap gap-2">
            {editing.media
              .filter((m) => !borradas.includes(m.url))
              .map((m) => (
                <div key={m.url} className="relative">
                  <img
                    src={`${API_URL}${m.url}`}
                    alt=""
                    className="h-20 w-20 rounded-lg object-cover"
                  />
                  <button
                    type="button"
                    aria-label="Borrar esta foto"
                    onClick={async () => {
                      try {
                        await api.admin.removeMedia(editing.id, m.url);
                        setBorradas((prev) => [...prev, m.url]);
                      } catch {
                        toast('No se pudo borrar la foto');
                      }
                    }}
                    className="absolute -top-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full bg-red-700 text-xs text-white shadow"
                  >
                    ✕
                  </button>
                </div>
              ))}
          </div>
        </div>
      )}

      <div>
        <label htmlFor="photos" className="mb-1 block text-sm font-medium">
          Agregar fotos (JPEG, PNG o WebP)
        </label>
        <input
          id="photos"
          type="file"
          accept="image/jpeg,image/png,image/webp"
          multiple
          onChange={(e) => setPhotos(Array.from(e.target.files ?? []))}
          className="block text-sm"
        />
        {photos.length > 0 && (
          <p className="mt-1 text-sm text-white/65">
            {photos.length} foto(s) para subir. Se redimensionan solas antes de enviarlas.
          </p>
        )}
      </div>

      {/* pegado abajo: en el alta el formulario es largo y el guardar quedaba lejos */}
      <div className="flotante sticky bottom-0 -mx-5 mt-2 flex gap-2 rounded-none px-5 py-3">
        <Button
          type="submit"
          variante="primary"
          tamano="lg"
          className="flex-1"
          disabled={mutation.isPending}
        >
          {mutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear borrador'}
        </Button>
        <Button type="button" variante="secondary" tamano="lg" onClick={onDone}>
          Cancelar
        </Button>
      </div>

      {pegando && <PegarDatosModal onAplicar={aplicarPegado} onClose={() => setPegando(false)} />}
    </form>
  );
}

/** Caja para volcar el mensaje con la planilla llena. */
function PegarDatosModal({
  onAplicar,
  onClose,
}: {
  onAplicar: (texto: string) => void;
  onClose: () => void;
}) {
  const [texto, setTexto] = useState('');

  return (
    <Modal title="Pegar datos de un mensaje" onClose={onClose}>
      <div className="space-y-4">
        <p className="text-sm text-white/70">
          Pegá la respuesta completa, tal como te llegó. Se completa lo que se entienda y el resto
          queda como está. El punto de partida se marca después en el mapa.
        </p>
        <textarea
          value={texto}
          onChange={(e) => setTexto(e.target.value)}
          rows={10}
          autoFocus
          placeholder={'Nombre: Quebrada del Cóndor\nDisciplina: Enduro\nProvincia: La Rioja\n…'}
          className={textareaClass}
          aria-label="Mensaje con los datos del circuito"
        />
        <Button
          type="button"
          variante="primary"
          tamano="lg"
          ancho
          disabled={texto.trim() === ''}
          onClick={() => onAplicar(texto)}
        >
          Completar el formulario
        </Button>
      </div>
    </Modal>
  );
}
