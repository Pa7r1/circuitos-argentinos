import type { PasoTour } from '../../components/Tour';

/**
 * Recorrido del mapa, para quien entra por primera vez.
 *
 * Cinco pasos y ni uno más: una guía larga se saltea entera. Se explican solo las
 * cosas que no se deducen mirando —que los chips filtran, que el buscador es por
 * localidad y no por circuito, y qué se gana con una cuenta— y se deja afuera todo
 * lo que es evidente, como el zoom.
 *
 * El paso del pin se saltea solo si todavía no hay circuitos cargados: el motor
 * descarta los pasos cuyo elemento no está en pantalla.
 */
export const PASOS_MAPA: PasoTour[] = [
  {
    titulo: 'Circuitos off-road de Argentina',
    texto:
      'Cada punto del mapa es un circuito de enduro, motocross o MTB. Te muestro en veinte segundos cómo encontrar el tuyo.',
  },
  {
    ancla: 'chips',
    titulo: 'Mostrá solo tu disciplina',
    texto:
      'Tocá una para apagarla y que sus circuitos desaparezcan del mapa. El color del punto es el de la disciplina.',
  },
  {
    ancla: 'buscador',
    titulo: 'Buscá por localidad, no por circuito',
    texto:
      'Escribí un pueblo o un departamento y el mapa se acerca a esa zona. Al costado te dice cuántos circuitos quedaron a la vista.',
  },
  {
    ancla: 'pin',
    titulo: 'Tocá un punto para ver qué hay',
    texto:
      'Se abre una ficha con los kilómetros, la dificultad y si el acceso es libre. Desde ahí entrás al circuito completo.',
  },
  {
    ancla: 'cuenta',
    titulo: 'Con cuenta ves el circuito entero',
    texto:
      'El mapa es libre. Creando tu cuenta se suman el trazado sobre la foto satelital, cómo se entra, los horarios y el GPX para tu GPS o para Strava.',
  },
];
