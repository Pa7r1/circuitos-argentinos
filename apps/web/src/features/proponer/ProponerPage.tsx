import { useMutation } from '@tanstack/react-query';
import { useState } from 'react';
import { Link } from 'react-router-dom';
import {
  ACCESS_TYPES,
  DIFFICULTIES,
  DISCIPLINES,
  PROVINCES,
  resolveExternalMap,
} from '@circuitos/shared';
import { Button, ButtonLink } from '../../components/Button';
import { ExternalMapEmbed } from '../../components/ExternalMapEmbed';
import { Field, SelectField } from '../../components/Field';
import { PieSitio } from '../../components/PieSitio';
import { useToast } from '../../components/Toast';
import { api, RequestError } from '../../lib/api';
import { ACCESS_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { resizeImage } from '../../lib/image';
import { puntosAGpx, type PuntoLonLat } from '../../lib/puntos-a-gpx';
import { useSession } from '../../lib/use-session';
import { AuthModal } from '../auth/AuthModal';
import { GpxPreview, parseGpxCoordinates } from '../admin/GpxPreview';
import { LocationPicker } from '../admin/LocationPicker';
import { DibujarRecorrido } from './DibujarRecorrido';
import { Opciones, PASOS, Paso, Progreso } from './pasos';

const MAX_FOTOS = 3;

const textareaClass =
  'w-full rounded-xl bg-white/8 px-3 py-2.5 text-base text-white ring-1 ring-white/12 transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] focus:bg-white/12 focus:ring-2 focus:ring-brand-400 focus:outline-none placeholder:text-white/40';

/** De dónde sale el recorrido. Las tres terminan en lo mismo para el servidor. */
type Origen = 'enlace' | 'gpx' | 'dibujo';

const ORIGENES: { valor: Origen; titulo: string; detalle: string; icono: string }[] = [
  {
    valor: 'enlace',
    titulo: 'Tengo el enlace',
    detalle: 'De Relive, Strava, Wikiloc, Komoot o Google My Maps',
    icono: '🔗',
  },
  {
    valor: 'gpx',
    titulo: 'Tengo el archivo GPX',
    detalle: 'El que exporta tu GPS o la app con la que grabaste',
    icono: '📁',
  },
  {
    valor: 'dibujo',
    titulo: 'No tengo ninguno',
    detalle: 'Lo marco yo sobre el mapa, tocando por dónde va',
    icono: '✏️',
  },
];

/**
 * Asistente para proponer un circuito.
 *
 * Antes era un formulario de trece campos en una sola pantalla que además exigía un
 * enlace de Relive o Strava: quien no había grabado su vuelta con ninguna app
 * simplemente no podía cargar el circuito que conoce. Ahora son cuatro pasos y tres
 * formas de dar el recorrido, y las tres llegan al servidor por el camino que ya
 * existía —el GPX dibujado se arma en el navegador—, sin endpoints nuevos.
 */
export function ProponerPage() {
  const session = useSession();
  const toast = useToast();

  const [paso, setPaso] = useState(0);
  const [pedirCuenta, setPedirCuenta] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // paso 1 · el recorrido
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [externalMapUrl, setExternalMapUrl] = useState('');
  const [verEmbed, setVerEmbed] = useState(false);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxCoords, setGpxCoords] = useState<[number, number][] | null>(null);
  const [dibujo, setDibujo] = useState<PuntoLonLat[]>([]);

  // paso 2 · dónde queda
  const [province, setProvince] = useState('la-rioja');
  const [locality, setLocality] = useState('');
  const [punto, setPunto] = useState<[number, number] | null>(null);

  // paso 3 · cómo es
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('enduro');
  const [difficulty, setDifficulty] = useState('intermedio');
  const [accessType, setAccessType] = useState('libre');
  const [km, setKm] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [description, setDescription] = useState('');

  // paso 4 · fotos y contacto
  const [fotos, setFotos] = useState<File[]>([]);
  const [telefono, setTelefono] = useState('');

  const [error, setError] = useState<string | null>(null);

  const mapaExterno = resolveExternalMap(externalMapUrl);
  const metros = Math.round(Number(km.replace(',', '.')) * 1000);
  /* el punto de partida sale del propio trazado: pedirlo de nuevo sería preguntar
     dos veces lo mismo */
  const necesitaPunto = origen === 'enlace';

  async function tomarGpx(file: File) {
    setGpxFile(file);
    try {
      setGpxCoords(parseGpxCoordinates(await file.text()));
    } catch {
      setGpxCoords([]);
    }
  }

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();

      if (origen === 'gpx' && gpxFile) form.append('gpx', gpxFile);
      if (origen === 'dibujo') {
        // el recorrido marcado a mano entra por la misma puerta que un archivo:
        // el servidor calcula el trazado, el arranque y la distancia igual que siempre
        const gpx = puntosAGpx(dibujo, name);
        form.append('gpx', new File([gpx], 'dibujado.gpx', { type: 'application/gpx+xml' }));
      }

      const campos: Record<string, string> = {
        name,
        discipline,
        province,
        difficulty,
        accessType,
        contactPhone: telefono.trim(),
      };
      if (origen === 'enlace') {
        campos.externalMapUrl = externalMapUrl.trim();
        campos.startLat = String(punto![1]);
        campos.startLon = String(punto![0]);
        campos.distanceM = String(metros);
      }
      if (locality.trim()) campos.locality = locality.trim();
      if (accessNotes.trim()) campos.accessNotes = accessNotes.trim();
      if (description.trim()) campos.description = description.trim();
      for (const [clave, valor] of Object.entries(campos)) form.append(clave, valor);

      const creado = await api.proponerCircuito(form);

      // las fotos van después y de a una: el multipart admite un archivo por pedido
      for (const foto of fotos.slice(0, MAX_FOTOS)) {
        const fotoForm = new FormData();
        fotoForm.append('file', await resizeImage(foto));
        await api.subirFotoPropuesta(creado.id, fotoForm);
      }
      return creado;
    },
    onSuccess: () => setEnviado(true),
    onError: (e) =>
      toast(
        e instanceof RequestError
          ? e.message
          : 'No pudimos enviar el circuito. Reintentá en un rato.',
      ),
  });

  /** Qué falta para poder avanzar. Null si el paso está completo. */
  function faltaEnElPaso(n: number): string | null {
    if (n === 0) {
      if (!origen) return 'Elegí cómo nos vas a pasar el recorrido';
      if (origen === 'enlace' && !mapaExterno) return 'Pegá el enlace del recorrido';
      if (origen === 'gpx' && !gpxFile) return 'Elegí el archivo GPX';
      if (origen === 'dibujo' && dibujo.length < 2) {
        return 'Marcá al menos dos puntos sobre el mapa';
      }
      return null;
    }
    if (n === 1) return necesitaPunto && !punto ? 'Marcá dónde arranca el circuito' : null;
    if (n === 2) {
      if (name.trim() === '') return 'Ponele un nombre al circuito';
      if (origen === 'enlace' && (!Number.isFinite(metros) || metros <= 0)) {
        return 'Cargá la distancia en kilómetros';
      }
      return null;
    }
    return telefono.trim().length < 6 ? 'Dejanos un teléfono para poder contactarte' : null;
  }

  function siguiente() {
    const falta = faltaEnElPaso(paso);
    if (falta) {
      setError(falta);
      return;
    }
    setError(null);
    setPaso((p) => Math.min(p + 1, PASOS.length - 1));
  }

  if (!session) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
        <div className="tarjeta p-6 text-center">
          <h1 className="titulo mb-2 text-2xl">Sumá un circuito que conocés</h1>
          <p className="mb-5 text-white/70">
            Para proponer un circuito necesitás una cuenta. Es gratis y toma un minuto: sirve para
            saber quién lo mandó y poder escribirte si falta algún dato.
          </p>
          <Button variante="primary" tamano="lg" ancho onClick={() => setPedirCuenta(true)}>
            Crear cuenta o ingresar
          </Button>
        </div>
        <Link
          to="/"
          className="mt-4 py-2 text-center text-sm font-medium text-white/65 hover:text-white"
        >
          ← Volver al mapa
        </Link>
        <PieSitio className="mt-6 justify-center text-xs text-white/40" />

        {pedirCuenta && (
          <AuthModal
            motivo="Con tu cuenta vas a poder proponer circuitos y ver las fichas completas."
            onClose={() => setPedirCuenta(false)}
            onListo={() => setPedirCuenta(false)}
          />
        )}
      </main>
    );
  }

  if (enviado) {
    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
        <div className="tarjeta p-6 text-center">
          <p aria-hidden="true" className="mb-3 text-4xl">
            ✓
          </p>
          <h1 className="titulo mb-2 text-2xl">¡Gracias! Ya nos llegó</h1>
          <p className="mb-5 text-white/70">
            Vamos a revisar los datos antes de publicarlo en el mapa. Si falta algo, te escribimos
            al teléfono que dejaste.
          </p>
          <ButtonLink to="/" variante="primary" tamano="lg" ancho>
            Volver al mapa
          </ButtonLink>
        </div>
        <PieSitio className="mt-6 justify-center text-xs text-white/40" />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-2xl px-4 pt-6 pb-32">
      <Link
        to="/"
        className="mb-4 inline-block py-2 text-sm font-medium text-white/65 hover:text-white"
      >
        ← Volver al mapa
      </Link>

      <h1 className="titulo mb-5 text-2xl">Sumá un circuito</h1>
      <Progreso actual={paso} />

      {/* la key remonta el bloque en cada avance: la animación de entrada sale sola */}
      <div key={paso}>
        {paso === 0 && (
          <Paso
            titulo="¿Cómo nos pasás el recorrido?"
            ayuda="Con cualquiera de las tres alcanza. Si grabaste la vuelta con una app, la primera es la más rápida."
          >
            <div className="grid gap-2">
              {ORIGENES.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={origen === opcion.valor}
                  onClick={() => {
                    setOrigen(opcion.valor);
                    setError(null);
                  }}
                  className={`flex items-center gap-3 rounded-xl p-3 text-left transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] ease-suave ${
                    origen === opcion.valor
                      ? 'bg-brand-500/15 ring-2 ring-brand-400'
                      : 'bg-white/6 ring-1 ring-white/12 hover:bg-white/12'
                  }`}
                >
                  <span aria-hidden="true" className="text-2xl">
                    {opcion.icono}
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold text-white">{opcion.titulo}</span>
                    <span className="block text-sm text-white/60">{opcion.detalle}</span>
                  </span>
                </button>
              ))}
            </div>

            {origen === 'enlace' && (
              <>
                <Field
                  label="Enlace al recorrido *"
                  id="externalMapUrl"
                  inputMode="url"
                  placeholder="https://www.relive.com/view/..."
                  value={externalMapUrl}
                  onChange={(e) => {
                    setExternalMapUrl(e.target.value);
                    setVerEmbed(false);
                  }}
                  error={
                    externalMapUrl.trim() !== '' && !mapaExterno
                      ? 'Tiene que ser un enlace que empiece con https://'
                      : undefined
                  }
                  ayuda={
                    mapaExterno
                      ? undefined
                      : 'Podés pegar el enlace o el código de insertar entero.'
                  }
                />
                {mapaExterno && (
                  <div className="rounded-xl bg-green-500/10 p-3 ring-1 ring-green-400/25">
                    <p className="text-sm font-medium text-green-300">
                      Reconocí {mapaExterno.providerName}
                      {mapaExterno.embedUrl
                        ? ': el recorrido se va a ver dentro de la ficha.'
                        : ': va a quedar como enlace, no se puede mostrar acá dentro.'}
                    </p>
                    {/* a pedido y no automático: el video pesa y mucha gente carga
                        esto con datos móviles */}
                    {mapaExterno.embedUrl && !verEmbed && (
                      <Button
                        variante="secondary"
                        tamano="sm"
                        className="mt-2"
                        onClick={() => setVerEmbed(true)}
                      >
                        Ver cómo queda
                      </Button>
                    )}
                  </div>
                )}
                {verEmbed && mapaExterno?.embedUrl && <ExternalMapEmbed url={mapaExterno.url} />}
              </>
            )}

            {origen === 'gpx' && (
              <div>
                <label htmlFor="gpx" className="mb-1.5 block text-sm font-medium text-white/80">
                  Archivo GPX *
                </label>
                <input
                  id="gpx"
                  type="file"
                  accept=".gpx,application/gpx+xml"
                  onChange={(e) => {
                    const file = e.target.files?.[0];
                    if (file) void tomarGpx(file);
                  }}
                  className="w-full text-sm text-white/70 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:text-sm file:font-semibold file:text-white"
                />
                {gpxCoords && gpxCoords.length > 1 && (
                  <div className="mt-3">
                    <GpxPreview coordinates={gpxCoords} />
                  </div>
                )}
                {gpxCoords?.length === 0 && (
                  <p className="mt-2 text-sm text-red-300">
                    No pudimos leer ese archivo. ¿Es un GPX con el recorrido adentro?
                  </p>
                )}
                <p className="mt-2 text-xs text-white/55">
                  La distancia y el punto de arranque salen del archivo: no hace falta cargarlos.
                </p>
              </div>
            )}

            {origen === 'dibujo' && <DibujarRecorrido puntos={dibujo} onChange={setDibujo} />}
          </Paso>
        )}

        {paso === 1 && (
          <Paso
            titulo="¿Dónde queda?"
            ayuda={
              necesitaPunto
                ? 'Buscá la localidad más cercana y tocá el mapa donde arranca.'
                : 'El punto de arranque ya salió del recorrido. Solo falta ubicarlo en el país.'
            }
          >
            <div className="grid gap-4 sm:grid-cols-2">
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
              <Field
                label="Localidad más cercana"
                id="locality"
                maxLength={200}
                placeholder="Chilecito"
                value={locality}
                onChange={(e) => setLocality(e.target.value)}
              />
            </div>
            {necesitaPunto && <LocationPicker value={punto} onChange={setPunto} />}
          </Paso>
        )}

        {paso === 2 && (
          <Paso titulo="¿Cómo es el circuito?" ayuda="Con esto la gente decide si es para ella.">
            <Field
              label="Nombre *"
              id="name"
              required
              maxLength={200}
              placeholder="Quebrada del Cóndor"
              value={name}
              onChange={(e) => setName(e.target.value)}
            />
            <Opciones
              label="Disciplina *"
              valor={discipline}
              opciones={DISCIPLINES.map((d) => ({ valor: d.slug, nombre: d.name }))}
              onChange={setDiscipline}
            />
            <Opciones
              label="Dificultad *"
              valor={difficulty}
              opciones={DIFFICULTIES.map((d) => ({ valor: d, nombre: DIFFICULTY_LABEL[d] }))}
              onChange={setDifficulty}
            />
            <Opciones
              label="Acceso *"
              valor={accessType}
              opciones={ACCESS_TYPES.map((a) => ({ valor: a, nombre: ACCESS_LABEL[a] }))}
              onChange={setAccessType}
            />
            {origen === 'enlace' && (
              <Field
                label="Distancia (km) *"
                id="km"
                inputMode="decimal"
                placeholder="12,5"
                value={km}
                onChange={(e) => setKm(e.target.value)}
              />
            )}
            <div>
              <label htmlFor="accessNotes" className="mb-1.5 block text-sm font-medium text-white/80">
                Cómo se entra
              </label>
              <textarea
                id="accessNotes"
                rows={2}
                maxLength={2000}
                placeholder="Se entra por la ruta 40, hay que avisarle al encargado…"
                className={textareaClass}
                value={accessNotes}
                onChange={(e) => setAccessNotes(e.target.value)}
              />
            </div>
            <div>
              <label htmlFor="description" className="mb-1.5 block text-sm font-medium text-white/80">
                Cómo es andar ahí
              </label>
              <textarea
                id="description"
                rows={3}
                maxLength={5000}
                placeholder="Arena floja los primeros kilómetros y después piedra suelta…"
                className={textareaClass}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
          </Paso>
        )}

        {paso === 3 && (
          <Paso
            titulo="Fotos y cómo ubicarte"
            ayuda="Las fotos son lo que más ayuda a decidir. El teléfono es solo para nosotros."
          >
            <div>
              <label htmlFor="fotos" className="mb-1.5 block text-sm font-medium text-white/80">
                Fotos (hasta {MAX_FOTOS})
              </label>
              <input
                id="fotos"
                type="file"
                accept="image/*"
                multiple
                onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, MAX_FOTOS))}
                className="w-full text-sm text-white/70 file:mr-3 file:min-h-11 file:rounded-xl file:border-0 file:bg-white/10 file:px-4 file:text-sm file:font-semibold file:text-white"
              />
              {fotos.length > 0 && (
                <ul className="mt-3 flex flex-wrap gap-2">
                  {fotos.map((foto, i) => (
                    <li key={foto.name + String(i)} className="relative">
                      <img
                        src={URL.createObjectURL(foto)}
                        alt=""
                        className="h-20 w-20 rounded-lg object-cover ring-1 ring-white/15"
                      />
                      <button
                        type="button"
                        aria-label={`Quitar la foto ${i + 1}`}
                        onClick={() => setFotos(fotos.filter((_, j) => j !== i))}
                        className="absolute -top-2 -right-2 flex h-7 w-7 items-center justify-center rounded-full bg-stone-900 text-white ring-1 ring-white/25"
                      >
                        ✕
                      </button>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <Field
              label="Tu teléfono *"
              id="contactPhone"
              type="tel"
              required
              maxLength={40}
              placeholder="3804 123456"
              value={telefono}
              onChange={(e) => setTelefono(e.target.value)}
              ayuda="Es para escribirte si falta algún dato. No se publica en ningún lado."
            />

            {/* repaso: es la última chance de ver lo cargado sin volver paso por paso */}
            <dl className="rounded-xl bg-white/6 p-3 text-sm">
              <div className="flex justify-between gap-3 py-0.5">
                <dt className="text-white/55">Circuito</dt>
                <dd className="truncate text-right font-medium text-white">{name || '—'}</dd>
              </div>
              <div className="flex justify-between gap-3 py-0.5">
                <dt className="text-white/55">Recorrido</dt>
                <dd className="text-right font-medium text-white">
                  {origen === 'enlace'
                    ? (mapaExterno?.providerName ?? 'Enlace')
                    : origen === 'gpx'
                      ? 'Archivo GPX'
                      : `Dibujado (${dibujo.length} puntos)`}
                </dd>
              </div>
              <div className="flex justify-between gap-3 py-0.5">
                <dt className="text-white/55">Fotos</dt>
                <dd className="text-right font-medium text-white">{fotos.length}</dd>
              </div>
            </dl>
          </Paso>
        )}
      </div>

      {error && (
        <p role="alert" className="mt-3 text-sm font-medium text-red-300">
          {error}
        </p>
      )}

      {/* al alcance del pulgar y siempre visibles: en un formulario largo, tener que
          buscar el botón de seguir es de lo que más cansa en el teléfono */}
      <div className="flotante fixed right-0 bottom-0 left-0 z-[600] flex gap-2 px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="mx-auto flex w-full max-w-2xl gap-2">
          <Button
            variante="secondary"
            tamano="lg"
            disabled={paso === 0 || mutation.isPending}
            onClick={() => {
              setError(null);
              setPaso((p) => Math.max(0, p - 1));
            }}
          >
            Atrás
          </Button>
          {paso < PASOS.length - 1 ? (
            <Button variante="primary" tamano="lg" className="flex-1" onClick={siguiente}>
              Siguiente
            </Button>
          ) : (
            <Button
              variante="primary"
              tamano="lg"
              className="flex-1"
              disabled={mutation.isPending}
              onClick={() => {
                const falta = faltaEnElPaso(3);
                if (falta) {
                  setError(falta);
                  return;
                }
                setError(null);
                mutation.mutate();
              }}
            >
              {mutation.isPending ? 'Enviando…' : 'Enviar circuito'}
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}
