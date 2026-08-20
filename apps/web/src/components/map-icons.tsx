/**
 * Íconos de los controles del mapa.
 *
 * Son SVG propios y no emojis: un 🛰️ lo dibuja cada sistema operativo a su manera
 * —en Android sale azul, en iOS gris, en Windows otra cosa— así que el control
 * cambiaba de color y de peso según el teléfono y ninguno combinaba con la
 * interfaz. Estos heredan `currentColor` y se ven igual en todos lados.
 *
 * Viven acá y no dentro de `MapControls` porque el selector de capa también los
 * usa desde la ficha del circuito.
 */
const traza = {
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
  'aria-hidden': true,
} as const;

export function IconoUbicacion({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...traza}>
      <circle cx="12" cy="12" r="7" />
      <circle cx="12" cy="12" r="2.5" fill="currentColor" stroke="none" />
      <path d="M12 1.5v3M12 19.5v3M1.5 12h3M19.5 12h3" />
    </svg>
  );
}

export function IconoSatelite({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...traza}>
      <path d="M4.5 12a7.5 7.5 0 0 1 7.5-7.5" />
      <path d="M2 19.5 8 13.5" />
      <rect x="7" y="12.5" width="5" height="5" rx="1" transform="rotate(45 9.5 15)" />
      <rect x="13" y="4" width="5" height="5" rx="1" transform="rotate(45 15.5 6.5)" />
      <path d="M12.5 10.5 15 8" />
    </svg>
  );
}

export function IconoMapa({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...traza}>
      <path d="M9 4.5 3.5 6.8v12.7L9 17.2l6 2.3 5.5-2.3V4.5L15 6.8z" />
      <path d="M9 4.5v12.7M15 6.8v12.7" />
    </svg>
  );
}

/**
 * Compartir y descargar. Viven acá con los del mapa por el mismo motivo que los
 * otros: la botonera de la ficha se queda sin texto en teléfono —los tres botones
 * pedían más ancho del que hay a 360 px— y el ícono pasa a ser lo único visible.
 * El nombre accesible lo sigue poniendo el `aria-label` del botón.
 */
export function IconoCompartir({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...traza}>
      <circle cx="18" cy="5.5" r="2.5" />
      <circle cx="6" cy="12" r="2.5" />
      <circle cx="18" cy="18.5" r="2.5" />
      <path d="m8.2 10.8 7.6-4M8.2 13.2l7.6 4" />
    </svg>
  );
}

export function IconoDescargar({ size = 20 }: { size?: number }) {
  return (
    <svg width={size} height={size} {...traza}>
      <path d="M12 3.5v11" />
      <path d="m7.5 10.5 4.5 4.5 4.5-4.5" />
      <path d="M4.5 17v2a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-2" />
    </svg>
  );
}
