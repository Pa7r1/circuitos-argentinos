/**
 * Pin en forma de gota para los marcadores del mapa: se ancla en la punta,
 * lleva el color de la disciplina y contorno blanco para resaltar sobre la
 * foto satelital.
 *
 * OJO: MapLibre usa el `transform` del elemento raíz del marcador para
 * posicionarlo, así que el resaltado se aplica a un nodo interno.
 */
export function createPin(color: string, letter: string, label: string): HTMLButtonElement {
  const el = document.createElement('button');
  el.type = 'button';
  el.setAttribute('aria-label', label);
  el.className = 'block cursor-pointer';
  el.innerHTML = `
    <span class="block origin-bottom transition-transform duration-150" data-pin-inner>
      <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"
           style="display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45))">
        <path d="M14 35.5C14 35.5 26.5 21.9 26.5 13.5A12.5 12.5 0 1 0 1.5 13.5C1.5 21.9 14 35.5 14 35.5Z"
              fill="${color}" stroke="#fff" stroke-width="2.5" />
        <text x="14" y="18.5" text-anchor="middle" fill="#fff"
              font-family="system-ui, sans-serif" font-size="13" font-weight="700">${letter}</text>
      </svg>
    </span>`;
  return el;
}

/** Resalta el pin seleccionado sin tocar el transform que usa MapLibre. */
export function setPinSelected(root: HTMLElement, selected: boolean): void {
  const inner = root.querySelector<HTMLElement>('[data-pin-inner]');
  if (inner) inner.style.transform = selected ? 'scale(1.3)' : '';
  root.style.zIndex = selected ? '1' : '';
}
