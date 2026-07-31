import type { PasoTour } from '../../components/Tour';

/**
 * Recorrido de la ficha, la primera vez que alguien con cuenta abre un circuito.
 *
 * Tres pasos. El que justifica todo el recorrido es el del GPX: es lo más útil que
 * ofrece la app y lo que nadie descubre solo, porque "GPX" no dice nada si no sabés
 * que ese archivo se abre en el GPS o en Strava.
 *
 * El paso de las acciones se saltea solo en un circuito sin trazado propio, donde
 * esa botonera no existe.
 */
export const PASOS_FICHA: PasoTour[] = [
  {
    ancla: 'trazado',
    titulo: 'El recorrido sobre el terreno',
    texto:
      'Esta es la traza real sobre la foto satelital. Podés acercarte para ver por dónde pasa, y cambiar a mapa de calles con el botón de abajo a la izquierda.',
  },
  {
    ancla: 'datos',
    titulo: 'Lo que define si es para vos',
    texto:
      'Los kilómetros, el desnivel y la dificultad. Fijate sobre todo en el acceso: hay circuitos que piden permiso o cobran entrada.',
  },
  {
    ancla: 'acciones',
    titulo: 'Llegar y llevarte el recorrido',
    texto:
      '«Cómo llegar» abre la app de mapas de tu teléfono en el punto de partida. «GPX» descarga el archivo del recorrido para abrirlo en tu GPS, en Strava o en Wikiloc.',
  },
];
