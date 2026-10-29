// Anmeldung, Einrichtung des GitHub-Schlüssels, Passwortwechsel und der
// Speicher der laufenden Sitzung. Die Sitzung lebt in sessionStorage: Wird die
// App geschlossen, ist beim nächsten Öffnen wieder Benutzername + Passwort nötig.
import { createStore, get, set } from 'idb-keyval'
import { useSyncExternalStore } from 'react'
import { DEMO } from '../konfig.ts'
import { oeffnen, verpacken } from '../lib/argon.ts'
import { zeitFormat } from '../lib/hilfen.ts'
import { ausBase64, tokenEntschluesseln, tokenVerschluesseln, zuBase64, type Zugang } from '../lib/krypto.ts'
import { GEBIETSSCHEMA } from '../i18n/texte.ts'
import { demoQuelle } from './demoQuelle.ts'
import { einstellungenSetzen } from './einstellungen.ts'
import { datenRepoPruefen, githubQuelle } from './github.ts'
import { Speicher } from './speicher.ts'
import { zugangLaden, zugangSchreiben, type ZugangStand } from './zugang.ts'

export type Phase = 'start' | 'abgemeldet' | 'einrichtung' | 'bereit'

export interface SitzungStand {
  phase: Phase
  benutzer: string | null
  speicher: Speicher | null
  einrichtungGrund: 'neu' | 'abgelaufen' | 'erneuern' | null
  anzeigenamen: Record<string, string>
}

const SITZUNG = 'salon-sitzung'

let stand: SitzungStand = { phase: 'start', benutzer: null, speicher: null, einrichtungGrund: null, anzeigenamen: {} }
let geheim: { token: string | null; haupt: Uint8Array<ArrayBuffer> | null; zugang: ZugangStand | null } = {
  token: null,
  haupt: null,
  zugang: null,
}
const hoerer = new Set<() => void>()

function setzen(teil: Partial<SitzungStand>) {
  stand = { ...stand, ...teil }
  for (const h of hoerer) h()
}

export function useSitzung(): SitzungStand {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => stand,
  )
}

export function aktuelleSitzung() {
  return stand
}

function gebiet() {
  return GEBIETSSCHEMA[(document.documentElement.lang as 'de' | 'it' | 'en') || 'de'] ?? 'de-DE'
}

function namenAus(zugang: Zugang): Record<string, string> {
  return Object.fromEntries(zugang.benutzer.map((b) => [b.name, b.anzeigename]))
}

function demoQuelleImBrowser() {
  const idb = createStore('salon-rose-demo-repo', 'dateien')
  return demoQuelle(
    {
      laden: () => get('alle', idb),
      sichern: (d) => set('alle', d, idb),
    },
    120,
  )
}

function sitzungSichern() {
  try {
    sessionStorage.setItem(
      SITZUNG,
      JSON.stringify({ benutzer: stand.benutzer, token: geheim.token, haupt: geheim.haupt ? zuBase64(geheim.haupt) : null }),
    )
  } catch {
    /* privater Modus: Sitzung nur im Speicher */
  }
}

function speicherStarten(token: string, zugang: Zugang, benutzer: string) {
  stand.speicher?.stoppen()
  const namen = namenAus(zugang)
  const speicher = new Speicher({
    quelle: DEMO ? demoQuelleImBrowser() : githubQuelle(token, zugang.daten),
    benutzer,
    anzeigename: (n) => stand.anzeigenamen[n] ?? namen[n] ?? n,
    zeitText: (iso) => zeitFormat(iso, gebiet()),
    datenbank: DEMO ? 'salon-rose-demo' : 'salon-rose',
  })
  const ab = speicher.abonnieren(() => {
    const s = speicher.holen()
    if (s.sync.zustand === 'zugriff' && stand.speicher === speicher) {
      ab()
      speicher.stoppen()
      setzen({ phase: 'einrichtung', einrichtungGrund: 'abgelaufen', speicher: null })
    }
  })
  setzen({ phase: 'bereit', benutzer, speicher, einrichtungGrund: null, anzeigenamen: namen })
  void speicher.starten()
}

/** Beim Öffnen der App: laufende Sitzung fortsetzen, sonst Login. */
export async function wiederherstellen() {
  try {
    const roh = sessionStorage.getItem(SITZUNG)
    if (roh) {
      const s = JSON.parse(roh) as { benutzer: string; token: string | null; haupt: string | null }
      const z = await zugangLaden()
      if (s.benutzer && z) {
        geheim = { token: s.token, haupt: s.haupt ? ausBase64(s.haupt) : null, zugang: z }
        if (s.token) {
          speicherStarten(s.token, z.zugang, s.benutzer)
          return
        }
        setzen({ phase: 'einrichtung', benutzer: s.benutzer, einrichtungGrund: 'neu', anzeigenamen: namenAus(z.zugang) })
        return
      }
    }
  } catch {
    /* neu anmelden */
  }
  setzen({ phase: 'abgemeldet' })
}

export async function anmelden(name: string, passwort: string): Promise<'ok' | 'falsch' | 'netz'> {
  const z = await zugangLaden()
  if (!z) return 'netz'
  const offen = await oeffnen(z.zugang, name, passwort)
  if (!offen) return 'falsch'
  geheim = { token: null, haupt: offen.haupt, zugang: z }
  const benutzer = offen.benutzer.name
  if (z.zugang.token) {
    try {
      geheim.token = await tokenEntschluesseln(offen.haupt, z.zugang.token)
    } catch {
      geheim.token = null
    }
  }
  if (geheim.token) {
    speicherStarten(geheim.token, z.zugang, benutzer)
  } else {
    setzen({ phase: 'einrichtung', benutzer, einrichtungGrund: 'neu', anzeigenamen: namenAus(z.zugang) })
  }
  sitzungSichern()
  return 'ok'
}

export type EinrichtungErgebnis = 'ok' | 'ungueltig' | 'kein-repo' | 'rechte' | 'netz' | 'abgemeldet'

/** Neuen GitHub-Schlüssel prüfen, verschlüsselt in der Zugangsdatei ablegen und starten. */
export async function einrichten(token: string): Promise<EinrichtungErgebnis> {
  const t = token.trim()
  if (!geheim.haupt || !stand.benutzer) return 'abgemeldet'
  const z = (await zugangLaden()) ?? geheim.zugang
  if (!z) return 'netz'
  if (!DEMO) {
    const probe = await datenRepoPruefen(t, z.zugang.daten)
    if (probe !== 'ok') return probe
  }
  const neu: Zugang = { ...z.zugang, token: await tokenVerschluesseln(geheim.haupt, t) }
  let ergebnis = await zugangSchreiben(t, neu, z.sha)
  if (!ergebnis.ok && ergebnis.grund === 'konflikt') {
    const frisch = await zugangLaden()
    if (frisch) ergebnis = await zugangSchreiben(t, { ...frisch.zugang, token: neu.token }, frisch.sha)
  }
  if (!ergebnis.ok) return ergebnis.grund === 'rechte' ? 'rechte' : 'netz'
  geheim = { ...geheim, token: t, zugang: ergebnis.stand }
  sitzungSichern()
  speicherStarten(t, ergebnis.stand.zugang, stand.benutzer)
  return 'ok'
}

export function einrichtungOeffnen() {
  setzen({ phase: 'einrichtung', einrichtungGrund: 'erneuern' })
}

export function einrichtungSchliessen() {
  if (geheim.token && geheim.zugang && stand.benutzer) speicherStarten(geheim.token, geheim.zugang.zugang, stand.benutzer)
}

export function abmelden() {
  stand.speicher?.stoppen()
  geheim = { token: null, haupt: null, zugang: geheim.zugang }
  try {
    sessionStorage.removeItem(SITZUNG)
  } catch {
    /* egal */
  }
  setzen({ phase: 'abgemeldet', benutzer: null, speicher: null, einrichtungGrund: null })
}

export type PasswortErgebnis = 'ok' | 'falsch' | 'netz' | 'rechte'

export async function passwortAendern(alt: string, neu: string): Promise<PasswortErgebnis> {
  const benutzer = stand.benutzer
  if (!benutzer || !geheim.token) return 'rechte'
  for (let versuch = 0; versuch < 2; versuch++) {
    const z = await zugangLaden()
    if (!z || (!DEMO && !navigator.onLine)) return 'netz'
    const offen = await oeffnen(z.zugang, benutzer, alt)
    if (!offen) return 'falsch'
    const eintrag = await verpacken(benutzer, offen.benutzer.anzeigename, neu, offen.haupt, z.zugang.argon2)
    const zugang: Zugang = { ...z.zugang, benutzer: z.zugang.benutzer.map((b) => (b.name === benutzer ? eintrag : b)) }
    const e = await zugangSchreiben(geheim.token, zugang, z.sha)
    if (e.ok) {
      geheim = { ...geheim, zugang: e.stand, haupt: offen.haupt }
      return 'ok'
    }
    if (e.grund !== 'konflikt') return e.grund === 'rechte' ? 'rechte' : 'netz'
  }
  return 'netz'
}

/** Profil-Einstellungen beim ersten Laden aufs Gerät übernehmen. */
export function profilEinstellungenUebernehmen(e: { design: 'hell' | 'dunkel'; sprache: 'de' | 'it' | 'en' } | undefined) {
  if (e) einstellungenSetzen(e)
}

export function anzeigenameSetzen(name: string, anzeige: string) {
  setzen({ anzeigenamen: { ...stand.anzeigenamen, [name]: anzeige } })
}
