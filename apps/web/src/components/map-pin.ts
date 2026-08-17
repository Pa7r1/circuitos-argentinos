/**
 * Marcador del mapa: un disco grafito con un anillo del color de la disciplina.
 *
 * Es un punto y no una gota por dos motivos. Uno, la gota mide 40 px de alto y
 * tapa el relieve justo arriba del lugar que está señalando, que es el terreno que
 * la persona quiere ver. Dos, con varios circuitos cercanos las gotas se pisan
 * entre sí; los discos, no.
 *
 * El cuerpo es del mismo grafito que el resto del cromo y el color queda reducido
 * al anillo y a la inicial: sobre una foto satelital ocre, tres discos saturados
 * eran tres manchas peleándose con el mapa.
 */
export function pinSvg(color: string, letter: string): string {
  return `
    <span class="pin" style="display:block; width:26px; height:26px">
      <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"
           style="display:block; overflow:visible">
        <!-- sombra propia: despega el disco del terreno sin usar un filtro CSS,
             que obligaría a repintar la capa en cada cuadro del paneo -->
        <circle cx="13" cy="13.8" r="10.5" fill="rgba(0,0,0,.35)" />
        <circle cx="13" cy="13" r="10.5" fill="#231f1c" />
        <circle cx="13" cy="13" r="10.5" fill="none" stroke="${color}" stroke-width="2.5" />
        <text x="13" y="17.4" text-anchor="middle" fill="${color}"
              font-family="'Archivo Variable', system-ui, sans-serif"
              font-size="11.5" font-weight="700" letter-spacing="-0.2">${letter}</text>
      </svg>
    </span>`;
}

/**
 * Varios circuitos que se pisan en pantalla, en un solo disco con la cantidad.
 *
 * Va en grafito y sin color de disciplina porque un grupo puede mezclarlas, y
 * pintarlo del color de uno solo mentiría sobre lo que hay adentro. Es del mismo
 * tamaño que un pin: la diferencia la hace el número, no el tamaño.
 */
export function clusterSvg(cantidad: number): string {
  return `
    <span class="pin" style="display:block; width:26px; height:26px">
      <svg width="26" height="26" viewBox="0 0 26 26" xmlns="http://www.w3.org/2000/svg"
           style="display:block; overflow:visible">
        <circle cx="13" cy="13.8" r="10.5" fill="rgba(0,0,0,.35)" />
        <circle cx="13" cy="13" r="10.5" fill="#231f1c" />
        <circle cx="13" cy="13" r="10.5" fill="none" stroke="#e7e5e4" stroke-width="2.5" />
        <text x="13" y="17.4" text-anchor="middle" fill="#e7e5e4"
              font-family="'Archivo Variable', system-ui, sans-serif"
              font-size="11.5" font-weight="700" letter-spacing="-0.2">${cantidad}</text>
      </svg>
    </span>`;
}

export const PIN_SIZE: [number, number] = [26, 26];
/** El disco se centra en la coordenada; no hay punta que anclar. */
export const PIN_ANCHOR: [number, number] = [13, 13];

/**
 * Resalta el pin del circuito abierto.
 *
 * El `scale` se aplica al `<span class="pin">` de adentro y NO al elemento que
 * Leaflet posiciona. Tocar el de afuera obligaba a pisarle el `transform-origin`
 * —que Leaflet fija en `0 0` para animar el zoom— y el pin se iba de lugar.
 * Escalando el hijo, Leaflet sigue siendo el único dueño del `transform` del padre.
 */
export function setPinSelected(root: HTMLElement, selected: boolean): void {
  const pin = root.querySelector<HTMLElement>('.pin');
  if (!pin) return;
  pin.style.transition = 'scale var(--duracion-media) var(--ease-salida), filter 150ms';
  pin.style.transformOrigin = 'center';
  pin.style.scale = selected ? '1.35' : '1';
  pin.style.filter = selected ? 'drop-shadow(0 0 6px rgba(255,255,255,.9))' : '';
  root.style.zIndex = selected ? '1000' : '';
}
