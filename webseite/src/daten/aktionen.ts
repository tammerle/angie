// Alles, was die Oberfläche an Daten ändern kann. Jede Aktion wirkt sofort
// lokal; der Speicher lädt sie im Hintergrund nach GitHub hoch.
import { useEffect, useState, useSyncExternalStore } from 'react'
import { heuteIso, jetztIso, neueId } from '../lib/hilfen.ts'
import { quadrat, verkleinern } from '../lib/bilder.ts'
import { aktuelleSitzung, anzeigenameSetzen, useSitzung } from './sitzung.ts'
import type { Datenstand, Speicher } from './speicher.ts'
import {
  PFAD,
  type Einstellungen,
  type Kunde,
  type KundenNotiz,
  type Notiz,
  type Ordner,
  type Profil,
  type Status,
} from './typen.ts'

const LEER: Datenstand = {
  geladen: false,
  kunden: [],
  kundeNach: new Map(),
  notizen: [],
  ordner: [],
  profile: new Map(),
  fotos: new Map(),
  alleFotos: [],
  bildStand: new Map(),
  sync: { zustand: 'bereit', zuletzt: null, ausstehend: 0, ersterAbgleich: false },
}

const leerAbo = () => () => {}

export function useDaten(): Datenstand {
  const { speicher } = useSitzung()
  return useSyncExternalStore(speicher?.abonnieren ?? leerAbo, speicher?.holen ?? (() => LEER))
}

function sp(): Speicher {
  const s = aktuelleSitzung().speicher
  if (!s) throw new Error('Nicht angemeldet')
  return s
}

function ich(): string {
  return aktuelleSitzung().benutzer ?? ''
}

function stempel() {
  return { geaendertAm: jetztIso(), geaendertVon: ich() }
}

// ---------- Bilder ----------

const urlCache = new Map<string, string>()

/** Objekt-URL für ein Bild aus dem Repo (zwischengespeichert, auch offline). */
export function useBildUrl(pfad: string | null | undefined): string | null {
  const daten = useDaten()
  const { speicher } = useSitzung()
  const stand = pfad ? daten.bildStand.get(pfad) : undefined
  const schluessel = pfad && stand ? `${pfad}@${stand}` : null
  const [url, setUrl] = useState<string | null>(() => (schluessel ? urlCache.get(schluessel) ?? null : null))

  useEffect(() => {
    if (!schluessel || !pfad || !speicher) {
      setUrl(null)
      return
    }
    const fertig = urlCache.get(schluessel)
    if (fertig) {
      setUrl(fertig)
      return
    }
    let aktiv = true
    void speicher.bild(pfad).then((blob) => {
      if (!blob || !aktiv) return
      const u = urlCache.get(schluessel) ?? URL.createObjectURL(blob)
      urlCache.set(schluessel, u)
      setUrl(u)
    })
    return () => {
      aktiv = false
    }
  }, [schluessel, pfad, speicher])

  return url
}

// ---------- Kunden ----------

export type KundenEingabe = Pick<
  Kunde,
  'vorname' | 'nachname' | 'telefon' | 'email' | 'geburtsdatum' | 'adresse' | 'notiz' | 'letzterBesuch'
>

function bereinigt(e: KundenEingabe): KundenEingabe {
  return {
    vorname: e.vorname.trim(),
    nachname: e.nachname.trim(),
    telefon: e.telefon.trim(),
    email: e.email.trim(),
    geburtsdatum: e.geburtsdatum,
    adresse: e.adresse.trim(),
    notiz: e.notiz.trim(),
    letzterBesuch: e.letzterBesuch,
  }
}

export function kundeAnlegen(e: KundenEingabe): string {
  const id = neueId()
  const kunde: Kunde = {
    id,
    ...bereinigt(e),
    notizen: [],
    erstelltAm: jetztIso(),
    erstelltVon: ich(),
    ...stempel(),
  }
  sp().speichern(PFAD.kunde(id), kunde)
  return id
}

export function kundeAendern(id: string, aenderung: Partial<Kunde>) {
  const alt = sp().holen().kundeNach.get(id)
  if (!alt) return
  const neu = { ...alt, ...aenderung, ...stempel() }
  if ('vorname' in aenderung || 'telefon' in aenderung) Object.assign(neu, bereinigt(neu))
  sp().speichern(PFAD.kunde(id), neu)
}

export function kundeLoeschen(id: string) {
  const s = sp()
  for (const f of s.holen().fotos.get(id) ?? []) {
    s.loeschen(f.pfad)
    s.loeschen(f.vorschauPfad)
  }
  if (s.holen().bildStand.has(PFAD.kundenAvatar(id))) s.loeschen(PFAD.kundenAvatar(id))
  s.loeschen(PFAD.kunde(id))
}

function besuchNach(kunde: Kunde, datum: string): string {
  return !kunde.letzterBesuch || datum > kunde.letzterBesuch ? datum : kunde.letzterBesuch
}

export function kundenNotizHinzufuegen(kundeId: string, text: string, datum = heuteIso()) {
  const k = sp().holen().kundeNach.get(kundeId)
  if (!k || !text.trim()) return
  const notiz: KundenNotiz = { id: neueId(), datum, text: text.trim(), von: ich(), ...stempel() }
  kundeAendern(kundeId, { notizen: [notiz, ...k.notizen], letzterBesuch: besuchNach(k, datum) })
}

export function kundenNotizAendern(kundeId: string, notizId: string, aenderung: Partial<Pick<KundenNotiz, 'text' | 'datum'>>) {
  const k = sp().holen().kundeNach.get(kundeId)
  if (!k) return
  kundeAendern(kundeId, {
    notizen: k.notizen.map((n) => (n.id === notizId ? { ...n, ...aenderung, ...stempel() } : n)),
  })
}

export function kundenNotizLoeschen(kundeId: string, notizId: string) {
  const k = sp().holen().kundeNach.get(kundeId)
  if (!k) return
  kundeAendern(kundeId, { notizen: k.notizen.filter((n) => n.id !== notizId) })
}

/** Speichert Fotos direkt beim Kunden (verkleinert, mit Vorschaubild). */
export async function fotosHinzufuegen(kundeId: string, dateien: Blob[]): Promise<number> {
  const s = sp()
  let n = 0
  for (const datei of dateien) {
    try {
      const [gross, klein] = await Promise.all([verkleinern(datei, 1800, 0.82), verkleinern(datei, 520, 0.74)])
      const id = neueId()
      s.bildSpeichern(PFAD.vorschau(kundeId, id), klein)
      s.bildSpeichern(PFAD.foto(kundeId, id), gross)
      n++
    } catch (e) {
      console.error('Foto konnte nicht gelesen werden', e)
    }
  }
  const k = s.holen().kundeNach.get(kundeId)
  if (k && n) kundeAendern(kundeId, { letzterBesuch: besuchNach(k, heuteIso()) })
  return n
}

export function fotoLoeschen(pfad: string, vorschauPfad: string) {
  sp().loeschen(pfad)
  sp().loeschen(vorschauPfad)
}

export async function kundenAvatarSetzen(kundeId: string, datei: Blob | null) {
  if (!datei) {
    sp().loeschen(PFAD.kundenAvatar(kundeId))
    return
  }
  sp().bildSpeichern(PFAD.kundenAvatar(kundeId), await quadrat(datei, 480, 0.84))
}

export async function fotoAlsProfilbild(foto: { pfad: string; kundeId: string }): Promise<boolean> {
  const blob = await sp().bild(foto.pfad)
  if (!blob) return false
  await kundenAvatarSetzen(foto.kundeId, blob)
  return true
}

// ---------- Notizen und Ordner ----------

export function notizAnlegen(ordnerId: string | null): string {
  const id = neueId()
  const notiz: Notiz = {
    id,
    titel: '',
    inhalt: '',
    ordnerId,
    angeheftet: false,
    erstelltAm: jetztIso(),
    erstelltVon: ich(),
    ...stempel(),
  }
  sp().speichern(PFAD.notiz(id), notiz)
  return id
}

export function notizAendern(id: string, aenderung: Partial<Pick<Notiz, 'titel' | 'inhalt' | 'ordnerId' | 'angeheftet'>>) {
  const alt = sp().holen().notizen.find((n) => n.id === id)
  if (!alt) return
  sp().speichern(PFAD.notiz(id), { ...alt, ...aenderung, ...stempel() })
}

export function notizLoeschen(id: string) {
  sp().loeschen(PFAD.notiz(id))
}

export function ordnerAnlegen(name: string): string {
  const id = neueId()
  const ordner: Ordner = { id, name: name.trim(), erstelltAm: jetztIso(), erstelltVon: ich(), ...stempel() }
  sp().speichern(PFAD.ordner(id), ordner)
  return id
}

export function ordnerUmbenennen(id: string, name: string) {
  const alt = sp().holen().ordner.find((o) => o.id === id)
  if (!alt || !name.trim()) return
  sp().speichern(PFAD.ordner(id), { ...alt, name: name.trim(), ...stempel() })
}

export function ordnerLoeschen(id: string) {
  for (const n of sp().holen().notizen) if (n.ordnerId === id) notizAendern(n.id, { ordnerId: null })
  sp().loeschen(PFAD.ordner(id))
}

// ---------- Profil ----------

const STANDARD_STATUS: Record<string, Status['schluessel']> = { angie: 'gucci', eli: 'fly' }

export function standardProfil(name: string, anzeigename: string, einstellungen: Einstellungen): Profil {
  const schluessel = STANDARD_STATUS[name] ?? 'sehrGluecklich'
  return {
    name,
    anzeigename,
    rolle: 'Inhaberin',
    status: { art: 'vorlage', schluessel, text: '', gesetztAm: jetztIso() },
    einstellungen,
    ...stempel(),
  }
}

export function profilAnlegen(p: Profil) {
  sp().speichern(PFAD.benutzer(p.name), p)
}

function meinProfil(): Profil | undefined {
  return sp().holen().profile.get(ich())
}

export function profilAendern(aenderung: Partial<Pick<Profil, 'anzeigename' | 'rolle' | 'status' | 'einstellungen'>>) {
  const alt = meinProfil()
  if (!alt) return
  const neu = { ...alt, ...aenderung, ...stempel() }
  sp().speichern(PFAD.benutzer(alt.name), neu)
  if (aenderung.anzeigename) anzeigenameSetzen(alt.name, aenderung.anzeigename)
}

export function statusSetzen(status: Omit<Status, 'gesetztAm'> | null) {
  profilAendern({ status: status ? { ...status, gesetztAm: jetztIso() } : null })
}

export async function benutzerAvatarSetzen(datei: Blob | null) {
  const pfad = PFAD.benutzerAvatar(ich())
  if (!datei) sp().loeschen(pfad)
  else sp().bildSpeichern(pfad, await quadrat(datei, 480, 0.85))
}

export function syncJetzt() {
  void aktuelleSitzung().speicher?.abgleichen(true)
}
