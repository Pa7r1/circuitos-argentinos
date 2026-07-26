/**
 * Redimensiona una imagen en el navegador antes de subirla: una foto de celular
 * pesa 5-8 MB y el límite de la API son 5 MB, así que sin esto la subida falla.
 */
const LADO_MAXIMO = 1600;
const CALIDAD = 0.8;

export async function resizeImage(file: File): Promise<File> {
  if (!file.type.startsWith('image/')) return file;

  const bitmap = await createImageBitmap(file);
  const escala = Math.min(1, LADO_MAXIMO / Math.max(bitmap.width, bitmap.height));
  const ancho = Math.round(bitmap.width * escala);
  const alto = Math.round(bitmap.height * escala);

  const canvas = document.createElement('canvas');
  canvas.width = ancho;
  canvas.height = alto;
  const ctx = canvas.getContext('2d');
  if (!ctx) return file;
  ctx.drawImage(bitmap, 0, 0, ancho, alto);
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, 'image/jpeg', CALIDAD),
  );
  if (!blob) return file;
  // si el original ya era más chico, no tiene sentido reemplazarlo
  if (blob.size >= file.size && escala === 1) return file;

  const nombre = file.name.replace(/\.[^.]+$/, '') + '.jpg';
  return new File([blob], nombre, { type: 'image/jpeg' });
}
