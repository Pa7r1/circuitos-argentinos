/**
 * Enlaces para compartir en cada red.
 *
 * Instagram no está y no es un olvido: **no existe una URL de compartir de
 * Instagram**. La plataforma no acepta enlaces entrantes desde la web, así que un
 * botón suyo no llevaría a ningún lado. El camino real es la hoja nativa del
 * sistema —donde Instagram sí aparece si la app está instalada— o copiar el
 * enlace, y las dos cosas están en el modal.
 */
export interface DestinoCompartir {
  id: string;
  nombre: string;
  /** Color de la marca, para el disco del icono. */
  color: string;
  href: (url: string, texto: string) => string;
}

export const DESTINOS: DestinoCompartir[] = [
  {
    id: 'whatsapp',
    nombre: 'WhatsApp',
    color: '#25D366',
    // wa.me sirve para la app del teléfono y para WhatsApp Web con la misma URL
    href: (url, texto) => `https://wa.me/?text=${encodeURIComponent(`${texto} ${url}`)}`,
  },
  {
    id: 'facebook',
    nombre: 'Facebook',
    color: '#1877F2',
    href: (url) => `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`,
  },
  {
    id: 'telegram',
    nombre: 'Telegram',
    color: '#2AABEE',
    href: (url, texto) =>
      `https://t.me/share/url?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
  },
  {
    id: 'x',
    nombre: 'X',
    color: '#4b5563',
    href: (url, texto) =>
      `https://twitter.com/intent/tweet?url=${encodeURIComponent(url)}&text=${encodeURIComponent(texto)}`,
  },
];

/** Lo que se lee del otro lado antes de abrir el enlace. */
export function textoCompartir(nombre: string, localidad?: string | null): string {
  return localidad
    ? `Mirá este circuito: ${nombre}, en ${localidad}`
    : `Mirá este circuito: ${nombre}`;
}
