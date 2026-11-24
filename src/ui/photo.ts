/**
 * A photo from the camera or the gallery, made into a small square avatar on the phone: cropped to the middle (a
 * portrait photo keeps the face, which is usually high up), 112 px, JPEG of about 5–14 KB, so it fits on the player
 * document and needs no file storage.
 */

const SIZE = 112;
/** The data URL's length to stay under (lower quality until it fits). */
const MAX_LENGTH = 14000;

/** The photo as a JPEG data URL. Rejects when the file isn't an image the browser can read. */
export async function avatarFromPhoto(file: File): Promise<string> {
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise<HTMLImageElement>((ok, no) => {
      const i = new Image();
      i.onload = () => ok(i);
      i.onerror = no;
      i.src = url;
    });
    const c = document.createElement('canvas');
    c.width = c.height = SIZE;
    const w0 = img.naturalWidth,
      h0 = img.naturalHeight,
      side = Math.min(w0, h0);
    const sx = (w0 - side) / 2,
      sy = Math.max(0, (h0 - side) * 0.3);
    const g = c.getContext('2d') as CanvasRenderingContext2D;
    g.fillStyle = '#fff';
    g.fillRect(0, 0, SIZE, SIZE);
    g.drawImage(img, sx, sy, side, side, 0, 0, SIZE, SIZE);
    let q = 0.82,
      d = c.toDataURL('image/jpeg', q);
    while (d.length > MAX_LENGTH && q > 0.35) {
      q -= 0.1;
      d = c.toDataURL('image/jpeg', q);
    }
    return d;
  } finally {
    URL.revokeObjectURL(url);
  }
}
