import { useEffect, useState } from 'react';
import { api } from '../../lib/api';

/**
 * Una foto del panel, traída con la sesión de admin.
 *
 * `/media` sirve **solo circuitos publicados**, y el panel trabaja justamente con
 * los que no lo están: borradores, propuestas y rechazados. Un `<img src>` plano no
 * manda la cabecera de autorización, así que esas miniaturas daban 404 y se decidía
 * si publicar o borrar sin ver las fotos.
 *
 * Por eso el pedido va por `fetch` y la imagen se dibuja desde una URL de objeto,
 * que se libera al desmontar o al cambiar de foto: cada blob que no se revoca queda
 * en memoria hasta recargar la página, y el panel abre y cierra este modal muchas
 * veces seguidas.
 */
export function FotoDelPanel({
  circuitId,
  url,
  className = '',
}: {
  circuitId: string;
  url: string;
  className?: string;
}) {
  const [src, setSrc] = useState<string | null>(null);
  const [fallo, setFallo] = useState(false);

  useEffect(() => {
    let vigente = true;
    let objeto: string | null = null;

    api.admin
      .foto(circuitId, url)
      .then((blob) => {
        // si el modal se cerró mientras viajaba, no hay dónde dibujarla
        if (!vigente) return;
        objeto = URL.createObjectURL(blob);
        setSrc(objeto);
      })
      .catch((e: unknown) => {
        console.error(e);
        if (vigente) setFallo(true);
      });

    return () => {
      vigente = false;
      if (objeto) URL.revokeObjectURL(objeto);
    };
  }, [circuitId, url]);

  if (fallo) {
    return (
      <div
        className={`flex items-center justify-center bg-white/6 text-center text-[10px] text-white/50 ${className}`}
      >
        No se pudo cargar
      </div>
    );
  }

  // el hueco ocupa el mismo lugar que la foto: sin esto la fila salta al llegar
  if (!src) return <div className={`animate-pulse bg-white/8 ${className}`} />;

  return <img src={src} alt="" className={className} />;
}
