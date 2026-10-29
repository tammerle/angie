// Kleine Helfer ohne Abhängigkeiten: IDs, Namen, Initialen, Datum.

/** Zeitlich sortierbare ID: Millisekunden (base36) + Zufall. */
export function neueId(): string {
  const zufall = Array.from(crypto.getRandomValues(new Uint8Array(5)), (b) => (b % 36).toString(36)).join('')
  return `${Date.now().toString(36)}-${zufall}`
}

/** Zeitpunkt aus einer ID von neueId(). */
export function zeitAusId(id: string): number {
  const n = parseInt(id.split('-')[0] ?? '', 36)
  return Number.isFinite(n) ? n : 0
}

export function jetztIso(): string {
  return new Date().toISOString()
}

export function heuteIso(): string {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

/** Mindestens eines der Namensfelder enthält ein Wort (Buchstaben). */
export function nameGueltig(vorname: string, nachname: string): boolean {
  return /\p{L}/u.test(vorname) || /\p{L}/u.test(nachname)
}

export function vollerName(p: { vorname: string; nachname: string }): string {
  return [p.vorname.trim(), p.nachname.trim()].filter(Boolean).join(' ')
}

/** Anfangsbuchstaben: „Elena Gruber“ → EG, nur „Elena“ → E, „Anna Maria“ → AM. */
export function initialen(vorname: string, nachname: string): string {
  const woerter = (s: string) => s.trim().split(/\s+/).filter((w) => /\p{L}/u.test(w))
  const v = woerter(vorname)
  const n = woerter(nachname)
  const erster = (w?: string) => (w ? Array.from(w.replace(/^[^\p{L}]+/u, ''))[0] ?? '' : '')
  let teile: string[]
  if (v.length && n.length) teile = [erster(v[0]), erster(n[0])]
  else teile = (v.length ? v : n).slice(0, 2).map(erster)
  return teile.join('').toLocaleUpperCase() || '?'
}

/** Gleichmäßige Rosétöne für Initialen-Avatare. */
export function avatarTon(schluessel: string): number {
  let h = 0
  for (const z of schluessel) h = (h * 31 + z.charCodeAt(0)) >>> 0
  return h % 5
}

export function suchtext(...teile: string[]): string {
  return teile
    .join(' ')
    .toLocaleLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
}

export function datumFormat(iso: string, gebiet: string, art: 'kurz' | 'lang' = 'kurz'): string {
  if (!iso) return ''
  const d = iso.length === 10 ? new Date(`${iso}T12:00:00`) : new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return art === 'kurz'
    ? d.toLocaleDateString(gebiet, { day: '2-digit', month: '2-digit', year: 'numeric' })
    : d.toLocaleDateString(gebiet, { day: 'numeric', month: 'long', year: 'numeric' })
}

export function zeitFormat(iso: string, gebiet: string): string {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return ''
  return d.toLocaleString(gebiet, { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}

/** Tage bis zum nächsten Geburtstag (0 = heute) und das Alter an diesem Tag. */
export function naechsterGeburtstag(geburtsdatum: string, heute = new Date()): { tage: number; alter: number } | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(geburtsdatum)
  if (!m) return null
  const [jahr, monat, tag] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const h = new Date(heute.getFullYear(), heute.getMonth(), heute.getDate())
  let naechster = new Date(h.getFullYear(), monat - 1, tag)
  if (naechster < h) naechster = new Date(h.getFullYear() + 1, monat - 1, tag)
  const tage = Math.round((naechster.getTime() - h.getTime()) / 86_400_000)
  return { tage, alter: naechster.getFullYear() - jahr }
}
