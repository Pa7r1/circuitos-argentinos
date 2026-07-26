/**
 * Pin en forma de gota para los marcadores: se ancla en la punta, lleva el color
 * de la disciplina y contorno blanco para resaltar sobre la foto satelital.
 */
export function pinSvg(color: string, letter: string): string {
  return `
    <svg width="28" height="36" viewBox="0 0 28 36" xmlns="http://www.w3.org/2000/svg"
         style="display:block; filter: drop-shadow(0 2px 3px rgba(0,0,0,.45))">
      <path d="M14 35.5C14 35.5 26.5 21.9 26.5 13.5A12.5 12.5 0 1 0 1.5 13.5C1.5 21.9 14 35.5 14 35.5Z"
            fill="${color}" stroke="#fff" stroke-width="2.5" />
      <text x="14" y="18.5" text-anchor="middle" fill="#fff"
            font-family="system-ui, sans-serif" font-size="13" font-weight="700">${letter}</text>
    </svg>`;
}

export const PIN_SIZE: [number, number] = [28, 36];
/** El ancla es la punta de la gota. */
export const PIN_ANCHOR: [number, number] = [14, 36];

/** Resalta el pin del circuito abierto. */
export function setPinSelected(root: HTMLElement, selected: boolean): void {
  root.style.transformOrigin = 'bottom center';
  root.style.transition = 'scale 150ms';
  root.style.scale = selected ? '1.3' : '1';
  root.style.zIndex = selected ? '1000' : '';
}
