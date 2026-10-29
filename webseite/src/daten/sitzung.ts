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

export type Phase = 'start' | 'abgemeldet' | 'bereit'

export interface SitzungStand {
  phase: Phase
  benutzer: string | null
  speicher: Speicher | null
  anzeigenamen: Record<string, string>
}

const SITZUNG = 'salon-sitzung'

let stand: SitzungStand = { phase: 'start', benutzer: null, speicher: null, anzeigenamen: {} }
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

async function tokenAus(zugang: Zugang, haupt: Uint8Array<ArrayBuffer> | null): Promise<string | null> {
  if (!zugang.token || !haupt) return null
  try {
    return await tokenEntschluesseln(haupt, zugang.token)
  } catch {
    return null
  }
}

// Ohne GitHub-Schlüssel läuft die App lokal. Sobald jemand den Schlüssel
// hinterlegt (auch auf einem anderen Gerät), verbindet sie sich von selbst.
let nachSchluesselSehen: ReturnType<typeof setInterval> | null = null

function schluesselBeobachten(an: boolean) {
  if (nachSchluesselSehen) clearInterval(nachSchluesselSehen)
  nachSchluesselSehen = null
  if (!an) return
  nachSchluesselSehen = setInterval(async () => {
    if (document.visibilityState !== 'visible' || !stand.benutzer) return
    const z = await zugangLaden()
    const token = z ? await tokenAus(z.zugang, geheim.haupt) : null
    if (z && token && stand.benutzer) {
      geheim = { ...geheim, token, zugang: z }
      sitzungSichern()
      speicherStarten(token, z.zugang, stand.benutzer)
    }
  }, 60_000)
}

function speicherStarten(token: string | null, zugang: Zugang, benutzer: string) {
  stand.speicher?.stoppen()
  const namen = namenAus(zugang)
  const speicher = new Speicher({
    quelle: DEMO ? demoQuelleImBrowser() : token ? githubQuelle(token, zugang.daten) : null,
    benutzer,
    anzeigename: (n) => stand.anzeigenamen[n] ?? namen[n] ?? n,
    zeitText: (iso) => zeitFormat(iso, gebiet()),
    datenbank: DEMO ? 'salon-rose-demo' : 'salon-rose',
  })
  schluesselBeobachten(!DEMO && !token)
  setzen({ phase: 'bereit', benutzer, speicher, anzeigenamen: namen })
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
        const haupt = s.haupt ? ausBase64(s.haupt) : null
        const token = (await tokenAus(z.zugang, haupt)) ?? s.token
        geheim = { token, haupt, zugang: z }
        sitzungSichern()
        speicherStarten(token, z.zugang, s.benutzer)
        return
      }
    }
  } catch {
    /* neu anmelden */
  }
  setzen({ phase: 'abgemeldet' })
}

/** Login: nur Benutzername und Passwort. Fehlt der GitHub-Schlüssel noch, startet die App lokal. */
export async function anmelden(name: string, passwort: string): Promise<'ok' | 'falsch' | 'netz'> {
  const z = await zugangLaden()
  if (!z) return 'netz'
  const offen = await oeffnen(z.zugang, name, passwort)
  if (!offen) return 'falsch'
  const token = await tokenAus(z.zugang, offen.haupt)
  geheim = { token, haupt: offen.haupt, zugang: z }
  speicherStarten(token, z.zugang, offen.benutzer.name)
  sitzungSichern()
  return 'ok'
}

export type EinrichtungErgebnis = 'ok' | 'ungueltig' | 'kein-repo' | 'rechte' | 'netz' | 'abgemeldet'

/** Neuen GitHub-Schlüssel prüfen, verschlüsselt in der Zugangsdatei ablegen und verbinden. */
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

export function abmelden() {
  stand.speicher?.stoppen()
  schluesselBeobachten(false)
  geheim = { token: null, haupt: null, zugang: geheim.zugang }
  try {
    sessionStorage.removeItem(SITZUNG)
  } catch {
    /* egal */
  }
  setzen({ phase: 'abgemeldet', benutzer: null, speicher: null })
}

export type PasswortErgebnis = 'ok' | 'falsch' | 'netz' | 'rechte' | 'getrennt'

export async function passwortAendern(alt: string, neu: string): Promise<PasswortErgebnis> {
  const benutzer = stand.benutzer
  if (!benutzer) return 'rechte'
  const token = geheim.token ?? (DEMO ? 'demo-token' : null)
  if (!token) return 'getrennt'
  for (let versuch = 0; versuch < 2; versuch++) {
    const z = await zugangLaden()
    if (!z || (!DEMO && !navigator.onLine)) return 'netz'
    const offen = await oeffnen(z.zugang, benutzer, alt)
    if (!offen) return 'falsch'
    const eintrag = await verpacken(benutzer, offen.benutzer.anzeigename, neu, offen.haupt, z.zugang.argon2)
    const zugang: Zugang = { ...z.zugang, benutzer: z.zugang.benutzer.map((b) => (b.name === benutzer ? eintrag : b)) }
    const e = await zugangSchreiben(token, zugang, z.sha)
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
