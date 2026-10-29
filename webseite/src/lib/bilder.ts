// Fotos im Browser verkleinern, bevor sie hochgeladen werden: schnelleres
// Speichern, kleineres Repo, schnellere Vorschau. EXIF-Drehung übernimmt der Browser.

async function bitmap(datei: Blob): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(datei, { imageOrientation: 'from-image' })
  } catch {
    const url = URL.createObjectURL(datei)
    try {
      const bild = new Image()
      bild.decoding = 'async'
      bild.src = url
      await bild.decode()
      return bild
    } finally {
      URL.revokeObjectURL(url)
    }
  }
}

function masse(b: ImageBitmap | HTMLImageElement) {
  return 'naturalWidth' in b ? { w: b.naturalWidth, h: b.naturalHeight } : { w: b.width, h: b.height }
}

function alsJpeg(canvas: HTMLCanvasElement, qualitaet: number): Promise<Blob> {
  return new Promise((ok, fehler) =>
    canvas.toBlob((b) => (b ? ok(b) : fehler(new Error('toBlob'))), 'image/jpeg', qualitaet),
  )
}

/** Längste Seite auf `max` px, als JPEG. */
export async function verkleinern(datei: Blob, max: number, qualitaet: number): Promise<Blob> {
  const b = await bitmap(datei)
  const { w, h } = masse(b)
  const f = Math.min(1, max / Math.max(w, h))
  const canvas = document.createElement('canvas')
  canvas.width = Math.round(w * f)
  canvas.height = Math.round(h * f)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(b, 0, 0, canvas.width, canvas.height)
  if ('close' in b) b.close()
  return alsJpeg(canvas, qualitaet)
}

/** Quadratischer Ausschnitt aus der Mitte (für Profilbilder). */
export async function quadrat(datei: Blob, seite: number, qualitaet: number): Promise<Blob> {
  const b = await bitmap(datei)
  const { w, h } = masse(b)
  const s = Math.min(w, h)
  const canvas = document.createElement('canvas')
  canvas.width = canvas.height = Math.min(seite, s)
  const ctx = canvas.getContext('2d')!
  ctx.imageSmoothingQuality = 'high'
  ctx.drawImage(b, (w - s) / 2, (h - s) / 2, s, s, 0, 0, canvas.width, canvas.height)
  if ('close' in b) b.close()
  return alsJpeg(canvas, qualitaet)
}

export function blobZuBase64(blob: Blob): Promise<string> {
  return new Promise((ok, fehler) => {
    const r = new FileReader()
    r.onload = () => ok(String(r.result).split(',')[1] ?? '')
    r.onerror = () => fehler(r.error)
    r.readAsDataURL(blob)
  })
}
