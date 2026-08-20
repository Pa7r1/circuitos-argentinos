import { Component, type ErrorInfo, type ReactNode } from 'react';
import { Button } from './Button';

/**
 * Última red de seguridad: si algo revienta al renderizar, acá se ve un mensaje en
 * vez de una pantalla en blanco.
 *
 * El caso que lo motivó es concreto. Tras publicar una versión nueva, una pestaña
 * vieja pide un chunk con hash que ya no existe; `recargarPorChunkAusente()` lo
 * resuelve recargando una sola vez, pero **no puede** cuando `sessionStorage` está
 * bloqueado —navegación privada, cookies de terceros restringidas—, porque sin poder
 * anotar el intento no hay guardia y un bucle de recargas es peor que el fallo. En
 * ese camino el `React.lazy` de `/admin` o `/proponer` rechaza, React desmonta el
 * árbol y quedaba la pantalla vacía, sin nada que leer ni que tocar.
 *
 * Es lo mismo que ya se hizo con la ruta comodín: una app rota y una página que no
 * existe se veían igual, y se separaron. Acá igual, un renglón más abajo.
 *
 * Es una clase y no una función a propósito: `componentDidCatch` y
 * `getDerivedStateFromError` no tienen equivalente en hooks. Es la única excepción a
 * la regla de "componentes de función" del proyecto, y la impone React.
 */
interface Props {
  children: ReactNode;
}

interface State {
  fallo: boolean;
}

export class LimiteDeError extends Component<Props, State> {
  override state: State = { fallo: false };

  static getDerivedStateFromError(): State {
    return { fallo: true };
  }

  override componentDidCatch(error: Error, info: ErrorInfo): void {
    // a la consola el detalle, que es donde sirve; a la pantalla, el mensaje de abajo
    console.error('Error no controlado al renderizar', error, info.componentStack);
  }

  override render(): ReactNode {
    if (!this.state.fallo) return this.props.children;

    return (
      <main className="mx-auto flex min-h-full max-w-md flex-col justify-center p-6 text-center">
        <h1 className="titulo mb-2 text-2xl">Se nos rompió esta pantalla</h1>
        <p className="mb-6 text-sm text-white/70">
          Puede ser que haya salido una versión nueva mientras la tenías abierta. Volvé a cargarla y
          debería andar.
        </p>
        <Button variante="primary" ancho onClick={() => window.location.reload()}>
          Volver a cargar
        </Button>
      </main>
    );
  }
}
