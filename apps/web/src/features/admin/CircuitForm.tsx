import { useMutation, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';
import type { AdminCircuitDetail, ScheduleInput } from '@circuitos/shared';
import { ACCESS_TYPES, DIFFICULTIES, DISCIPLINES, PROVINCES } from '@circuitos/shared';
import { useToast } from '../../components/Toast';
import { api, RequestError } from '../../lib/api';
import { ACCESS_LABEL, DAY_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { circuitKeys } from '../../lib/queries';
import { GpxPreview, parseGpxCoordinates } from './GpxPreview';

interface Props {
  /** si viene, es edición; si no, alta */
  editing?: AdminCircuitDetail;
  onDone: () => void;
}

const inputClass =
  'w-full rounded-lg border border-stone-300 px-3 py-2.5 text-base focus:border-brand-600 focus:outline-none';

export function CircuitForm({ editing, onDone }: Props) {
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
  const [photos, setPhotos] = useState<File[]>([]);
  const [dragging, setDragging] = useState(false);

  async function handleGpx(file: File) {
    setGpxFile(file);
    try {
      setGpxCoords(parseGpxCoordinates(await file.text()));
    } catch {
      setGpxCoords([]);
    }
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
      let circuitId: string;
      if (editing) {
        await api.admin.update(editing.id, fields);
        circuitId = editing.id;
      } else {
        if (!gpxFile) throw new Error('Falta el archivo GPX');
        const form = new FormData();
        form.append('gpx', gpxFile);
        for (const [key, value] of Object.entries(fields)) {
          if (value === undefined) continue;
          form.append(key, key === 'schedules' ? JSON.stringify(value) : String(value));
        }
        const created = await api.admin.create(form);
        circuitId = created.id;
      }
      for (const photo of photos) {
        await api.admin.uploadMedia(circuitId, photo);
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
      onSubmit={(e) => {
        e.preventDefault();
        if (!editing && (!gpxCoords || gpxCoords.length < 2)) {
          toast('Cargá un GPX válido antes de guardar');
          return;
        }
        mutation.mutate();
      }}
    >
      {!editing && (
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
              dragging ? 'border-brand-600 bg-brand-50' : 'border-stone-300'
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

      <div>
        <label htmlFor="name" className="mb-1 block text-sm font-medium">
          Nombre *
        </label>
        <input id="name" required value={name} onChange={(e) => setName(e.target.value)} className={inputClass} />
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <label htmlFor="discipline" className="mb-1 block text-sm font-medium">
            Disciplina *
          </label>
          <select id="discipline" value={discipline} onChange={(e) => setDiscipline(e.target.value)} className={inputClass}>
            {DISCIPLINES.map((d) => (
              <option key={d.slug} value={d.slug}>
                {d.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="province" className="mb-1 block text-sm font-medium">
            Provincia *
          </label>
          <select id="province" value={province} onChange={(e) => setProvince(e.target.value)} className={inputClass}>
            {PROVINCES.map((p) => (
              <option key={p.slug} value={p.slug}>
                {p.name}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="difficulty" className="mb-1 block text-sm font-medium">
            Dificultad *
          </label>
          <select id="difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value)} className={inputClass}>
            {DIFFICULTIES.map((d) => (
              <option key={d} value={d}>
                {DIFFICULTY_LABEL[d]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="accessType" className="mb-1 block text-sm font-medium">
            Acceso *
          </label>
          <select id="accessType" value={accessType} onChange={(e) => setAccessType(e.target.value)} className={inputClass}>
            {ACCESS_TYPES.map((a) => (
              <option key={a} value={a}>
                {ACCESS_LABEL[a]}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div>
        <label htmlFor="locality" className="mb-1 block text-sm font-medium">
          Localidad
        </label>
        <input id="locality" value={locality} onChange={(e) => setLocality(e.target.value)} className={inputClass} />
      </div>

      <div>
        <label htmlFor="accessNotes" className="mb-1 block text-sm font-medium">
          Notas de acceso
        </label>
        <textarea
          id="accessNotes"
          value={accessNotes}
          onChange={(e) => setAccessNotes(e.target.value)}
          rows={2}
          className={inputClass}
          placeholder="Ej: pedir permiso en el club, cuota de mantenimiento…"
        />
      </div>

      <div>
        <label htmlFor="description" className="mb-1 block text-sm font-medium">
          Descripción
        </label>
        <textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          rows={4}
          className={inputClass}
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
              className="rounded-lg border border-stone-300 px-2 py-2"
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
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <input
              type="time"
              aria-label="Cierra"
              value={s.closes ?? ''}
              onChange={(e) => updateSchedule(i, { closes: e.target.value || null })}
              className="rounded-lg border border-stone-300 px-2 py-2"
            />
            <button
              type="button"
              aria-label="Quitar horario"
              onClick={() => setSchedules((prev) => prev.filter((_, j) => j !== i))}
              className="min-h-11 min-w-11 rounded-lg text-red-700 hover:bg-red-50"
            >
              ✕
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => setSchedules((prev) => [...prev, { dayOfWeek: 6, opens: null, closes: null }])}
          className="min-h-11 rounded-lg border border-stone-300 px-3 text-sm font-medium hover:bg-stone-50"
        >
          + Agregar horario
        </button>
      </fieldset>

      <div>
        <label htmlFor="photos" className="mb-1 block text-sm font-medium">
          Fotos (JPEG, PNG o WebP)
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
          <p className="mt-1 text-sm text-stone-600">{photos.length} foto(s) para subir</p>
        )}
      </div>

      <div className="flex gap-2">
        <button
          type="submit"
          disabled={mutation.isPending}
          className="min-h-11 flex-1 rounded-lg bg-brand-600 py-3 font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
        >
          {mutation.isPending ? 'Guardando…' : editing ? 'Guardar cambios' : 'Crear borrador'}
        </button>
        <button
          type="button"
          onClick={onDone}
          className="min-h-11 rounded-lg border border-stone-300 px-4 font-medium hover:bg-stone-50"
        >
          Cancelar
        </button>
      </div>
    </form>
  );
}
