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
import { Field, SelectField } from '../../components/Field';
import { PieSitio } from '../../components/PieSitio';
import { useToast } from '../../components/Toast';
import { api, RequestError } from '../../lib/api';
import { ACCESS_LABEL, DIFFICULTY_LABEL } from '../../lib/format';
import { resizeImage } from '../../lib/image';
import { useSession } from '../../lib/use-session';
import { AuthModal } from '../auth/AuthModal';
import { LocationPicker } from '../admin/LocationPicker';

/** Tope de fotos, el mismo que aplica el servidor. */
const MAX_FOTOS = 3;

const textareaClass =
  'w-full rounded-xl bg-white/8 px-3 py-2.5 text-base text-white ring-1 ring-white/12 transition-[background-color,box-shadow] duration-[var(--duracion-rapida)] focus:bg-white/12 focus:ring-2 focus:ring-brand-400 focus:outline-none placeholder:text-white/40';

/**
 * Formulario para que cualquiera con cuenta proponga un circuito.
 *
 * Es deliberadamente más corto que el del panel, que tiene diecisiete campos:
 * acá no hay horarios, ni estado, ni nada de administración. Lo que se manda
 * queda esperando revisión y no aparece en el mapa hasta que se aprueba.
 */
export function ProponerPage() {
  const session = useSession();
  const toast = useToast();

  const [name, setName] = useState('');
  const [discipline, setDiscipline] = useState('enduro');
  const [province, setProvince] = useState('la-rioja');
  const [locality, setLocality] = useState('');
  const [difficulty, setDifficulty] = useState('intermedio');
  const [accessType, setAccessType] = useState('libre');
  const [accessNotes, setAccessNotes] = useState('');
  const [description, setDescription] = useState('');
  const [telefono, setTelefono] = useState('');
  const [externalMapUrl, setExternalMapUrl] = useState('');
  const [punto, setPunto] = useState<[number, number] | null>(null);
  const [km, setKm] = useState('');
  const [fotos, setFotos] = useState<File[]>([]);
  const [enviado, setEnviado] = useState(false);
  const [pedirCuenta, setPedirCuenta] = useState(false);

  const mapaExterno = resolveExternalMap(externalMapUrl);
  const enlaceInvalido = externalMapUrl.trim() !== '' && mapaExterno === null;
  const metros = Math.round(Number(km.replace(',', '.')) * 1000);

  const mutation = useMutation({
    mutationFn: async () => {
      const form = new FormData();
      const campos: Record<string, string> = {
        name,
        discipline,
        province,
        difficulty,
        accessType,
        contactPhone: telefono.trim(),
        externalMapUrl: externalMapUrl.trim(),
        startLat: String(punto![1]),
        startLon: String(punto![0]),
        distanceM: String(metros),
      };
      if (locality.trim()) campos.locality = locality.trim();
      if (accessNotes.trim()) campos.accessNotes = accessNotes.trim();
      if (description.trim()) campos.description = description.trim();
      for (const [clave, valor] of Object.entries(campos)) form.append(clave, valor);

      const creado = await api.proponerCircuito(form);

      // las fotos van después y de a una, como en el panel: el multipart admite
      // un archivo por pedido. Se redimensionan antes porque una foto de celular
      // pesa 5-8 MB y el servidor corta en 5.
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
        e instanceof RequestError ? e.message : 'No pudimos enviar el circuito. Reintentá en un rato.',
      ),
  });

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
            Vamos a revisar los datos antes de publicarlo en el mapa. Si falta algo, te escribimos al
            teléfono que dejaste.
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
    <main className="mx-auto max-w-2xl px-4 py-6">
      <Link to="/" className="mb-4 inline-block py-2 text-sm font-medium text-white/65 hover:text-white">
        ← Volver al mapa
      </Link>

      <h1 className="titulo mb-1 text-2xl">Sumá un circuito</h1>
      <p className="mb-6 text-sm text-white/70">
        Contanos dónde queda y cómo es. Lo revisamos antes de publicarlo, así que no te preocupes si
        algún dato no es exacto.
      </p>

      <form
        className="space-y-4"
        onSubmit={(e) => {
          e.preventDefault();
          if (!mapaExterno) {
            toast('Pegá el enlace del recorrido (Relive, Strava, Wikiloc…)');
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
          mutation.mutate();
        }}
      >
        <Field
          label="Nombre del circuito *"
          id="name"
          required
          maxLength={200}
          placeholder="Quebrada del Cóndor"
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
        </div>

        <Field
          label="Localidad más cercana"
          id="locality"
          maxLength={200}
          placeholder="Chilecito"
          value={locality}
          onChange={(e) => setLocality(e.target.value)}
        />

        <div className="grid grid-cols-2 gap-3">
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
          label="Enlace al recorrido *"
          id="externalMapUrl"
          inputMode="url"
          placeholder="https://www.relive.com/view/..."
          value={externalMapUrl}
          onChange={(e) => setExternalMapUrl(e.target.value)}
          error={enlaceInvalido ? 'Tiene que ser un enlace que empiece con https://' : undefined}
          ayuda={
            mapaExterno ? (
              <span className="font-medium text-green-400">
                Reconocí {mapaExterno.providerName}: el recorrido se va a ver en la ficha.
              </span>
            ) : (
              'De Relive, Strava, Wikiloc, Komoot o Google My Maps. Podés pegar el código de insertar entero.'
            )
          }
        />

        <LocationPicker value={punto} onChange={setPunto} />

        <Field
          label="Distancia (km) *"
          id="km"
          inputMode="decimal"
          placeholder="12,5"
          value={km}
          onChange={(e) => setKm(e.target.value)}
        />

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
            <p className="mt-1.5 text-sm text-white/60">
              {fotos.length} {fotos.length === 1 ? 'foto elegida' : 'fotos elegidas'}
            </p>
          )}
        </div>

        <Button type="submit" variante="primary" tamano="lg" ancho disabled={mutation.isPending}>
          {mutation.isPending ? 'Enviando…' : 'Enviar circuito'}
        </Button>
      </form>

      <PieSitio className="justify-center pt-8 text-xs text-white/40" />
    </main>
  );
}
