import type { Argon2Parameter, Zugang, ZugangBenutzer } from './krypto.ts'
import type { ArgonAuftrag } from './argonArbeiter.ts'

type Offen = { haupt: Uint8Array<ArrayBuffer>; benutzer: ZugangBenutzer } | null

let arbeiter: Worker | null = null
let naechsteId = 1
const wartend = new Map<number, { ok: (v: unknown) => void; fehler: (e: Error) => void }>()

function holeArbeiter(): Worker | null {
  if (arbeiter || typeof Worker === 'undefined') return arbeiter
  try {
    arbeiter = new Worker(new URL('./argonArbeiter.ts', import.meta.url), { type: 'module' })
    arbeiter.onmessage = (e: MessageEvent<{ id: number; ergebnis?: unknown; fehler?: string }>) => {
      const w = wartend.get(e.data.id)
      if (!w) return
      wartend.delete(e.data.id)
      if (e.data.fehler) w.fehler(new Error(e.data.fehler))
      else w.ok(e.data.ergebnis)
    }
  } catch {
    arbeiter = null
  }
  return arbeiter
}

type OhneId<A> = A extends unknown ? Omit<A, 'id'> : never

function senden<T>(auftrag: OhneId<ArgonAuftrag>): Promise<T> | null {
  const w = holeArbeiter()
  if (!w) return null
  const id = naechsteId++
  return new Promise<T>((ok, fehler) => {
    wartend.set(id, { ok: ok as (v: unknown) => void, fehler })
    w.postMessage({ ...auftrag, id })
  })
}

// Argon2 (hash-wasm) wird nur im Worker gebraucht; der Rückfall lädt es bei Bedarf nach.
const krypto = () => import('./passwort.ts')

/** Login-Prüfung im Worker (Rückfall: im Hauptthread). */
export function oeffnen(zugang: Zugang, name: string, passwort: string): Promise<Offen> {
  return (
    senden<Offen>({ art: 'oeffnen', zugang, name, passwort }) ??
    krypto().then((k) => k.hauptschluesselOeffnen(zugang, name, passwort))
  )
}

export function verpacken(
  name: string,
  anzeigename: string,
  passwort: string,
  haupt: Uint8Array<ArrayBuffer>,
  p: Argon2Parameter,
): Promise<ZugangBenutzer> {
  return (
    senden<ZugangBenutzer>({ art: 'verpacken', name, anzeigename, passwort, haupt, p }) ??
    krypto().then((k) => k.benutzerVerpacken(name, anzeigename, passwort, haupt, p))
  )
}
