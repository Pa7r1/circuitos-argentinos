/**
 * Chip de filtro por disciplina.
 *
 * El color quedó SOLO en el punto. Antes el chip entero se pintaba de naranja,
 * azul o violeta y, entre eso y el botón de acción, la pantalla tenía cuatro
 * colores saturados peleándose la atención; el naranja dejaba de significar
 * "tocá acá". Ahora la disciplina se identifica por el punto y el estado por el
 * relleno.
 *
 * Encendido y apagado se distinguen por tres señales a la vez —opacidad del
 * texto, relleno del chip y punto lleno contra punto hueco— más `aria-pressed`.
 * Ninguna es solo color: quien no distingue naranja de violeta igual ve cuál
 * está activo.
 */
export function DisciplineChip({
  nombre,
  color,
  activo,
  onToggle,
}: {
  nombre: string;
  color: string;
  activo: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      onClick={onToggle}
      aria-pressed={activo}
      // Los dos estados comparten el MISMO fondo opaco. Bajarle el alfa al apagado
      // se veía bien sobre la sierra oscura, pero sobre un arenal claro el fondo
      // subía de luminancia y el texto blanco se lavaba: el contraste de una
      // superficie translúcida depende de la foto que tenga debajo, que es
      // justamente lo único que no controlamos. La diferencia la hacen el texto,
      // el aro y el punto.
      className={`flotante flex min-h-11 items-center gap-2 rounded-full px-3.5 text-sm font-medium transition-[color] duration-[var(--duracion-rapida)] ease-suave ${
        activo ? 'text-white ring-white/25' : 'text-white/60'
      }`}
    >
      <span
        aria-hidden="true"
        className="h-2.5 w-2.5 shrink-0 rounded-full transition-[background-color,box-shadow] duration-[var(--duracion-rapida)]"
        style={
          activo
            ? { backgroundColor: color, boxShadow: `0 0 0 3px ${color}33` }
            : { boxShadow: `inset 0 0 0 1.5px ${color}` }
        }
      />
      {nombre}
    </button>
  );
}
