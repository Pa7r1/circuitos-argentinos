import { useMutation } from '@tanstack/react-query';
import { useState, type ReactNode } from 'react';
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
import { api, mensajeParaPersona } from '../../lib/api';
import { ACCESS_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { resizeImage } from '../../lib/image';
import { puntosAGpx, type PuntoLonLat } from '../../lib/puntos-a-gpx';
import { useTecladoAbierto } from '../../lib/use-teclado';
import { useSession } from '../../lib/use-session';
import { AuthModal } from '../auth/AuthModal';
import { GpxPreview, parseGpxCoordinates } from '../admin/GpxPreview';
import { LocationPicker } from '../admin/LocationPicker';
import { DibujarRecorrido } from './DibujarRecorrido';
import { Opciones, PASOS, Paso, Progreso } from './pasos';

const MAX_FOTOS = 3;

/*
 * El botón que dibuja el navegador para `input[type=file]` dice "Choose File" en el
 * idioma del navegador y no del sitio, y no se puede traducir. Así que el input va
 * escondido y lo que se ve es su etiqueta, que abre el mismo selector. `peer` lleva
 * el foco del teclado del input a la etiqueta, que es lo que se ve.
 */
const BOTON_ARCHIVO =
  'inline-flex min-h-11 cursor-pointer items-center rounded-xl bg-white/10 px-4 text-sm font-semibold text-white ring-1 ring-white/15 transition-[background-color] duration-[var(--duracion-rapida)] hover:bg-white/16 peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand-400';

const textareaClass =
  'scroll-mb-28 w-full rounded-xl bg-white/8 px-3 py-2.5 text-base text-white ring-1 ring-white/12 transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] focus:bg-white/12 focus:ring-2 focus:ring-brand-400 focus:outline-none placeholder:text-white/40';

/** Campo de texto largo. El mismo marco que `Field`, con la ayuda debajo. */
function CampoLargo({
  id,
  label,
  ayuda,
  filas,
  maxLength,
  placeholder,
  value,
  onChange,
}: {
  id: string;
  label: string;
  ayuda: string;
  filas: number;
  maxLength: number;
  placeholder: string;
  value: string;
  onChange: (valor: string) => void;
}) {
  return (
    <div>
      <label htmlFor={id} className="mb-1.5 block text-sm font-medium text-white/80">
        {label}
      </label>
      <textarea
        id={id}
        rows={filas}
        maxLength={maxLength}
        aria-describedby={`${id}-ayuda`}
        placeholder={placeholder}
        className={textareaClass}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
      <p id={`${id}-ayuda`} className="mt-1.5 text-xs text-white/55">
        {ayuda}
      </p>
    </div>
  );
}

/** De dónde sale el recorrido. Las tres terminan en lo mismo para el servidor. */
type Origen = 'enlace' | 'gpx' | 'dibujo';

/*
 * Íconos de las tres vías. Van como SVG y no como emoji: el emoji lo dibuja cada
 * sistema operativo a su manera, cambia de tamaño y de color entre teléfonos y no
 * hereda el color del texto.
 */
const ICONO: Record<Origen, ReactNode> = {
  enlace: (
    <>
      <path d="M10 13.5a4 4 0 0 0 5.66 0l3-3a4 4 0 0 0-5.66-5.66l-1.3 1.3" />
      <path d="M14 10.5a4 4 0 0 0-5.66 0l-3 3a4 4 0 1 0 5.66 5.66l1.3-1.3" />
    </>
  ),
  gpx: (
    <>
      <path d="M14 3v5h5" />
      <path d="M19 8v11a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h7Z" />
      <path d="M9 14.5h6M9 17.5h4" />
    </>
  ),
  dibujo: (
    <>
      <path d="M4 20.5 8 19l10.5-10.5a2.1 2.1 0 0 0-3-3L5 16l-1 4.5Z" />
      <path d="m14.5 6.5 3 3" />
    </>
  ),
};

const ORIGENES: { valor: Origen; titulo: string; detalle: string }[] = [
  {
    valor: 'enlace',
    titulo: 'Tengo el enlace',
    detalle: 'Grabé la vuelta y quedó publicada en Relive, Strava, Wikiloc, Komoot o Google Maps',
  },
  {
    valor: 'gpx',
    titulo: 'Tengo el archivo',
    detalle: 'El archivo del recorrido que descargué de esa app o del GPS (termina en .gpx)',
  },
  {
    valor: 'dibujo',
    titulo: 'No tengo ninguno',
    detalle: 'Conozco el circuito y lo marco yo sobre el mapa, tocando por dónde va',
  },
];

/**
 * Asistente para proponer un circuito.
 *
 * Antes era un formulario de trece campos en una sola pantalla que además exigía un
 * enlace de Relive o Strava: quien no había grabado su vuelta con ninguna app
 * simplemente no podía cargar el circuito que conoce. Ahora son cinco pasos y tres
 * formas de dar el recorrido, y las tres llegan al servidor por el camino que ya
 * existía —el GPX dibujado se arma en el navegador—, sin endpoints nuevos.
 *
 * Elegir la vía (paso 1) y cargarla (paso 2) están separados a propósito: son dos
 * decisiones distintas y juntas dejaban el mapa de dibujar apretado al fondo de una
 * pantalla que ya venía larga. Todo el estado vive acá arriba, así que volver atrás
 * a cambiar de idea no borra nada de lo cargado.
 */
export function ProponerPage() {
  const session = useSession();
  const toast = useToast();
  // con el teclado arriba no se navega, se escribe: la barra fija taparía el campo
  const tecladoAbierto = useTecladoAbierto();

  const [paso, setPaso] = useState(0);
  const [pedirCuenta, setPedirCuenta] = useState(false);
  const [enviado, setEnviado] = useState(false);

  // paso 1 · cómo nos lo pasás · paso 2 · el recorrido
  const [origen, setOrigen] = useState<Origen | null>(null);
  const [externalMapUrl, setExternalMapUrl] = useState('');
  const [verEmbed, setVerEmbed] = useState(false);
  const [gpxFile, setGpxFile] = useState<File | null>(null);
  const [gpxCoords, setGpxCoords] = useState<[number, number][] | null>(null);
  const [dibujo, setDibujo] = useState<PuntoLonLat[]>([]);

  // paso 3 · dónde queda
  const [province, setProvince] = useState('la-rioja');
  const [locality, setLocality] = useState('');
  const [punto, setPunto] = useState<[number, number] | null>(null);

  // paso 4 · cómo es
  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('enduro');
  const [difficulty, setDifficulty] = useState('intermedio');
  const [accessType, setAccessType] = useState('libre');
  const [km, setKm] = useState('');
  const [accessNotes, setAccessNotes] = useState('');
  const [description, setDescription] = useState('');

  // paso 5 · fotos y contacto
  const [fotos, setFotos] = useState<File[]>([]);
  const [telefono, setTelefono] = useState('');

  /* Si ya intentó avanzar con algo incompleto. Mientras es false, lo que falta se
     dice en gris al lado del botón; después, en rojo y pegado al campo. Avisar en
     rojo antes de que la persona haga nada es retarla por adelantado. */
  const [intento, setIntento] = useState(false);

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
    onError: (e) => toast(mensajeParaPersona(e)),
  });

  /** Qué falta para poder avanzar. Null si el paso está completo. */
  function faltaEnElPaso(n: number): string | null {
    if (n === 0) return origen ? null : 'Elegí cómo nos vas a pasar el recorrido';
    if (n === 1) {
      if (origen === 'enlace' && !mapaExterno) return 'Pegá el enlace del recorrido';
      if (origen === 'gpx' && !gpxFile) return 'Elegí el archivo del recorrido';
      if (origen === 'dibujo' && dibujo.length < 2) {
        return 'Marcá al menos dos puntos sobre el mapa';
      }
      return null;
    }
    if (n === 2) return necesitaPunto && !punto ? 'Marcá dónde arranca el circuito' : null;
    if (n === 3) {
      if (name.trim() === '') return 'Ponele un nombre al circuito';
      if (origen === 'enlace' && (!Number.isFinite(metros) || metros <= 0)) {
        return 'Cargá cuántos kilómetros tiene';
      }
      return null;
    }
    return telefono.trim().length < 6 ? 'Dejanos un teléfono para poder contactarte' : null;
  }

  const falta = faltaEnElPaso(paso);
  /** El error solo se pinta de rojo y pegado al campo después de intentar avanzar. */
  const errorDe = (mensaje: string | false): string | undefined =>
    intento && mensaje ? mensaje : undefined;

  function irAlPaso(n: number) {
    setIntento(false);
    setPaso(n);
  }

  function siguiente() {
    if (falta) {
      setIntento(true);
      return;
    }
    irAlPaso(Math.min(paso + 1, PASOS.length - 1));
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

  /*
   * El paso de dibujar ocupa la ventana entera y no scrollea: si la página se puede
   * desplazar, arrastrar para mover el mapa termina moviendo la página y marcar un
   * punto se vuelve imposible. `dvh` y no `vh` porque con `vh` la barra de
   * direcciones del teléfono corta el mapa por abajo.
   */
  const aPantalla = paso === 1 && origen === 'dibujo';

  return (
    <main
      className={
        aPantalla
          ? 'mx-auto flex h-dvh max-w-2xl flex-col overflow-hidden px-4 pt-4'
          : 'mx-auto max-w-2xl px-4 pt-6 pb-32'
      }
    >
      {!aPantalla && (
        <>
          <Link
            to="/"
            className="mb-4 inline-block py-2 text-sm font-medium text-white/65 hover:text-white"
          >
            ← Volver al mapa
          </Link>
          <h1 className="titulo mb-5 text-2xl">Sumá un circuito</h1>
        </>
      )}
      <Progreso actual={paso} />

      {/* la key remonta el bloque en cada avance: la animación de entrada sale sola */}
      <div key={paso} className={aPantalla ? 'flex min-h-0 flex-1 flex-col' : undefined}>
        {paso === 0 && (
          <Paso
            titulo="¿Cómo nos pasás el recorrido?"
            ayuda="Tocá la que te sirva y seguimos. Con cualquiera de las tres alcanza."
          >
            <div className="grid gap-2">
              {ORIGENES.map((opcion) => (
                <button
                  key={opcion.valor}
                  type="button"
                  aria-pressed={origen === opcion.valor}
                  onClick={() => {
                    // elegir ya es la respuesta: pedir además un "Siguiente" es un
                    // toque de más sobre una decisión que la persona ya tomó
                    setOrigen(opcion.valor);
                    irAlPaso(1);
                  }}
                  className={`flex min-h-11 w-full items-center gap-3 rounded-xl p-3 text-left transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] ease-suave ${
                    origen === opcion.valor
                      ? 'bg-brand-500/15 ring-2 ring-brand-400'
                      : 'bg-white/6 ring-1 ring-white/12 hover:bg-white/12'
                  }`}
                >
                  <svg
                    aria-hidden="true"
                    viewBox="0 0 24 24"
                    className="h-6 w-6 shrink-0 text-brand-300"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    {ICONO[opcion.valor]}
                  </svg>
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold text-white">{opcion.titulo}</span>
                    <span className="block text-sm text-white/65">{opcion.detalle}</span>
                  </span>
                  <span aria-hidden="true" className="shrink-0 text-white/40">
                    ›
                  </span>
                </button>
              ))}
            </div>
          </Paso>
        )}

        {paso === 1 && origen === 'enlace' && (
          <Paso
            titulo="Pegá el enlace del recorrido"
            ayuda="Es la dirección web de la vuelta que grabaste, la que compartís por WhatsApp."
          >
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
                  ? 'Ese enlace no lo reconocemos. Tiene que empezar con https:// y ser de Relive, Strava, Wikiloc, Komoot o Google My Maps.'
                  : errorDe(!mapaExterno && 'Pegá acá el enlace del recorrido.')
              }
              ayuda={
                mapaExterno
                  ? undefined
                  : 'Abrí la app donde grabaste, tocá Compartir y pegá lo que te copie. Si te da un código de insertar, también sirve.'
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
          </Paso>
        )}

        {paso === 1 && origen === 'gpx' && (
          <Paso
            titulo="Elegí el archivo del recorrido"
            ayuda="Es el archivo que descargaste de la app con la que grabaste, o del GPS. Su nombre termina en .gpx"
          >
            <div>
              <label htmlFor="gpx" className="mb-1.5 block text-sm font-medium text-white/80">
                Archivo del recorrido *
              </label>
              <input
                id="gpx"
                type="file"
                accept=".gpx,application/gpx+xml"
                aria-describedby="gpx-ayuda"
                onChange={(e) => {
                  const file = e.target.files?.[0];
                  if (file) void tomarGpx(file);
                }}
                className="peer sr-only"
              />
              <label htmlFor="gpx" className={BOTON_ARCHIVO}>
                {gpxFile ? 'Elegir otro archivo' : 'Buscar el archivo'}
              </label>
              <p id="gpx-ayuda" className="mt-2 text-xs text-white/55">
                Está en las descargas del teléfono. Si no lo encontrás, entrá a tu vuelta en Strava
                o Wikiloc y buscá la opción de exportar o descargar el recorrido.
              </p>
            </div>

            {gpxFile && (
              <p className="truncate text-sm text-white/70">
                Elegiste <strong className="font-semibold text-white">{gpxFile.name}</strong>
              </p>
            )}

            {gpxCoords && gpxCoords.length > 1 && (
              <div>
                <p className="mb-1.5 text-sm font-medium text-white/80">Así quedó el recorrido</p>
                <GpxPreview coordinates={gpxCoords} />
                <p className="mt-2 text-xs text-white/55">
                  Los kilómetros y el punto de arranque salen del archivo: no hace falta cargarlos.
                </p>
              </div>
            )}
            {gpxCoords?.length === 0 && (
              <p role="alert" className="text-sm font-medium text-red-300">
                No pudimos leer ese archivo. Fijate que sea el del recorrido, el que termina en
                .gpx, y no una foto ni un pantallazo.
              </p>
            )}
          </Paso>
        )}

        {paso === 1 && origen === 'dibujo' && (
          <div className="min-h-0 flex-1">
            <DibujarRecorrido puntos={dibujo} onChange={setDibujo} className="h-full" />
          </div>
        )}

        {paso === 2 && (
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
                ayuda="En qué provincia está el circuito."
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
                ayuda="El pueblo o ciudad desde donde se llega. Sirve para saber a cuánto queda."
              />
            </div>
            {necesitaPunto && <LocationPicker value={punto} onChange={setPunto} />}
          </Paso>
        )}

        {paso === 3 && (
          <Paso titulo="¿Cómo es el circuito?" ayuda="Con esto la gente decide si es para ella.">
            <Field
              label="Nombre *"
              id="name"
              required
              maxLength={200}
              placeholder="Quebrada del Cóndor"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errorDe(name.trim() === '' && 'Ponele un nombre al circuito.')}
              ayuda="Cómo lo llaman los que andan ahí."
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
                label="Cuántos kilómetros tiene *"
                id="km"
                inputMode="decimal"
                placeholder="12,5"
                value={km}
                onChange={(e) => setKm(e.target.value)}
                error={errorDe(
                  (!Number.isFinite(metros) || metros <= 0) && 'Poné los kilómetros de la vuelta.',
                )}
                ayuda="El largo de la vuelta completa, aunque sea a ojo."
              />
            )}
            <CampoLargo
              id="accessNotes"
              label="Cómo se entra"
              filas={2}
              maxLength={2000}
              placeholder="Se entra por la ruta 40, hay que avisarle al encargado…"
              value={accessNotes}
              onChange={setAccessNotes}
              ayuda="Por dónde se llega, si hay que pedir permiso o pagar algo."
            />
            <CampoLargo
              id="description"
              label="Cómo es andar ahí"
              filas={3}
              maxLength={5000}
              placeholder="Arena floja los primeros kilómetros y después piedra suelta…"
              value={description}
              onChange={setDescription}
              ayuda="El terreno, las subidas, en qué época conviene ir."
            />
          </Paso>
        )}

        {paso === 4 && (
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
                aria-describedby="fotos-ayuda"
                onChange={(e) => setFotos(Array.from(e.target.files ?? []).slice(0, MAX_FOTOS))}
                className="peer sr-only"
              />
              <label htmlFor="fotos" className={BOTON_ARCHIVO}>
                {fotos.length > 0 ? 'Elegir otras fotos' : 'Elegir fotos'}
              </label>
              <p id="fotos-ayuda" className="mt-2 text-xs text-white/55">
                Del terreno, la entrada o el paisaje. Podés sacarlas ahora con la cámara.
              </p>
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
              error={errorDe(telefono.trim().length < 6 && 'Dejanos un teléfono para escribirte.')}
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
                      ? 'Archivo del recorrido'
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

      {/* en el primer paso la acción son las tarjetas, que avanzan solas: una barra
          con un "Siguiente" apagado compite con ellas y no lleva a ninguna parte.
          Reaparece si se vuelve, porque ahí ya hay una vía elegida.

          al alcance del pulgar y siempre visible: en un formulario largo, tener que
          buscar el botón de seguir es de lo que más cansa en el teléfono. En el paso
          del dibujo no va fija, va como última fila de la columna, así el mapa
          termina justo encima y no queda nada tapado. */}
      {(paso > 0 || origen) && (
        <div
          className={`${
            aPantalla
              ? 'shrink-0 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]'
              : 'flotante fixed right-0 bottom-0 left-0 z-[600] px-4 pt-3 pb-[max(0.75rem,env(safe-area-inset-bottom))]'
          } ${tecladoAbierto ? 'hidden' : 'block'}`}
        >
          <div className="mx-auto w-full max-w-2xl">
            {/* qué falta, siempre a la vista: un botón apagado sin motivo deja a la
              persona tocando una y otra vez sin entender qué pasa */}
            {falta && paso > 0 && (
              <p
                role={intento ? 'alert' : undefined}
                className={`mb-2 text-sm ${intento ? 'font-medium text-red-300' : 'text-white/60'}`}
              >
                {falta}
              </p>
            )}
            <div className="flex gap-2">
              <Button
                variante="secondary"
                tamano="lg"
                disabled={paso === 0 || mutation.isPending}
                onClick={() => irAlPaso(Math.max(0, paso - 1))}
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
                    /*
                     * Se revisan TODOS los pasos, no solo este. Hoy no se puede
                     * llegar hasta acá con algo incompleto porque cada "Siguiente"
                     * valida lo suyo, pero el día que se pueda saltar tocando la
                     * barra de progreso, el envío es el punto sin retorno.
                     */
                    const incompleto = PASOS.findIndex((_, i) => faltaEnElPaso(i) !== null);
                    if (incompleto !== -1) {
                      setIntento(true);
                      setPaso(incompleto);
                      return;
                    }
                    mutation.mutate();
                  }}
                >
                  {mutation.isPending ? 'Enviando…' : 'Enviar circuito'}
                </Button>
              )}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
