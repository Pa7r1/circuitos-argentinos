import { ButtonLink } from '../components/Button';

/**
 * Cualquier dirección que no exista.
 *
 * Sin esta pantalla, un enlace mal copiado o una dirección vieja dejaban **el sitio
 * en blanco**: el router no encontraba ninguna ruta que pintar y la persona quedaba
 * mirando el fondo, sin saber si la app se rompió o si es que esa página no existe.
 *
 * Reusa la tarjeta y el botón del resto de los estados finales (el "Circuito no
 * encontrado" de la ficha); no inventa una pantalla aparte.
 */
export function NoEncontrado() {
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6">
      <div className="tarjeta p-6 text-center">
        {/*
          white/40 y no menos: a 36 px en negrita el piso de contraste es 3:1, y con
          el 25 % que tenía al principio quedaba en 2,27:1. Que sea decorativo no lo
          exime: si está escrito, se tiene que poder leer.
        */}
        <p aria-hidden="true" className="titulo mb-1 text-4xl text-white/40 tabular-nums">
          404
        </p>
        <h1 className="titulo mb-2 text-xl">Esta página no existe</h1>
        <p className="mb-5 text-white/70">
          Puede que el enlace esté mal escrito o que la página ya no esté publicada.
        </p>
        <ButtonLink to="/" variante="primary" tamano="lg" ancho>
          Ir al mapa
        </ButtonLink>
      </div>
    </main>
  );
}
