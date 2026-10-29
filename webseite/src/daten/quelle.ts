// Schnittstelle zum Speicherort der Daten. Im Betrieb ist das GitHub
// (github.ts), im lokalen Test ein Speicher im Browser (demoQuelle.ts).

export interface BaumEintrag {
  pfad: string
  sha: string
}

export interface Baum {
  /** null = seit dem letzten Abruf unverändert (ETag) */
  eintraege: BaumEintrag[] | null
  etag: string | null
}

export interface Quelle {
  baum(etag: string | null): Promise<Baum>
  /** Texte mehrerer Dateien nach Blob-SHA. */
  texte(shas: string[]): Promise<Map<string, string>>
  blob(sha: string): Promise<Blob>
  /** Aktueller Stand einer Datei oder null, wenn es sie nicht gibt. */
  lesen(pfad: string): Promise<{ sha: string; text: string } | null>
  /** Schreibt eine Datei; `sha` = erwarteter alter Stand (null = neu). Liefert den neuen SHA. */
  schreiben(pfad: string, base64: string, sha: string | null, nachricht: string): Promise<string>
  loeschen(pfad: string, sha: string, nachricht: string): Promise<void>
}

/** Die Datei hat sich inzwischen geändert (anderer SHA als erwartet). */
export class KonfliktFehler extends Error {
  pfad: string
  constructor(pfad: string) {
    super(`Konflikt: ${pfad}`)
    this.pfad = pfad
  }
}

/** Schlüssel ungültig, abgelaufen oder ohne Rechte. */
export class ZugriffFehler extends Error {
  status: number
  constructor(status: number) {
    super(`Kein Zugriff (${status})`)
    this.status = status
  }
}

/** Keine Verbindung oder GitHub nicht erreichbar. */
export class NetzFehler extends Error {}

export function textZuBase64(text: string): string {
  const bytes = new TextEncoder().encode(text)
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  return btoa(s)
}

export function base64ZuText(b64: string): string {
  const s = atob(b64.replace(/\s/g, ''))
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return new TextDecoder().decode(bytes)
}
