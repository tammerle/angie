// Dreiwege-Zusammenführung, wenn beide gleichzeitig dieselbe Datei geändert haben:
// Was nur eine geändert hat, wird übernommen. Haben beide denselben Text
// unterschiedlich geändert, bleiben beide Fassungen in zwei Blöcken erhalten.

export interface Fassung {
  wer: string
  wann: string
}

export interface Zusammenfuehrung {
  lokal: Fassung
  fern: Fassung
}

/** Felder, deren Inhalt bei Konflikt als zwei Blöcke erhalten bleibt. */
const TEXTFELDER = new Set(['inhalt', 'text', 'notiz'])

export const BLOCK_ANFANG = '⟦'
export const BLOCK_ENDE = '⟧'

export function konfliktText(lokal: string, fern: string, z: Zusammenfuehrung): string {
  const kopf = (f: Fassung) => `${BLOCK_ANFANG}${f.wer} · ${f.wann}${BLOCK_ENDE}`
  return `${kopf(z.fern)}\n${fern.trim()}\n\n${kopf(z.lokal)}\n${lokal.trim()}`
}

export interface Block {
  kopf: string | null
  text: string
}

/** Zerlegt einen Text mit Konfliktblöcken (für die Anzeige). */
export function bloecke(text: string): Block[] {
  const zeilen = text.split('\n')
  const ergebnis: Block[] = []
  let aktuell: Block = { kopf: null, text: '' }
  const kopfMuster = new RegExp(`^${BLOCK_ANFANG}(.+)${BLOCK_ENDE}$`)
  for (const z of zeilen) {
    const m = kopfMuster.exec(z.trim())
    if (m) {
      if (aktuell.kopf !== null || aktuell.text.trim()) ergebnis.push(aktuell)
      aktuell = { kopf: m[1]!, text: '' }
    } else {
      aktuell.text += (aktuell.text ? '\n' : '') + z
    }
  }
  ergebnis.push(aktuell)
  return ergebnis.map((b) => ({ ...b, text: b.text.trim() })).filter((b) => b.kopf !== null || b.text)
}

export function hatKonflikt(text: string): boolean {
  return bloecke(text).some((b) => b.kopf !== null)
}

function gleich(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

type Obj = Record<string, unknown>
const istObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v)
const istIdListe = (v: unknown): v is Obj[] =>
  Array.isArray(v) && v.every((x) => istObj(x) && typeof x.id === 'string')

function listeZusammenfuehren(basis: Obj[], lokal: Obj[], fern: Obj[], z: Zusammenfuehrung): Obj[] {
  const nachId = (l: Obj[]) => new Map(l.map((x) => [x.id as string, x]))
  const b = nachId(basis)
  const l = nachId(lokal)
  const f = nachId(fern)
  const ids = [...new Set([...lokal.map((x) => x.id as string), ...fern.map((x) => x.id as string)])]
  const ergebnis: Obj[] = []
  for (const id of ids) {
    const bi = b.get(id)
    const li = l.get(id)
    const fi = f.get(id)
    if (li && fi) ergebnis.push(objektZusammenfuehren(bi ?? null, li, fi, z))
    else if (li) {
      // Fern gelöscht: nur behalten, wenn lokal geändert (oder neu).
      if (!bi || !gleich(bi, li)) ergebnis.push(li)
    } else if (fi) {
      if (!bi || !gleich(bi, fi)) ergebnis.push(fi)
    }
  }
  return ergebnis
}

function wertZusammenfuehren(schluessel: string, b: unknown, l: unknown, f: unknown, z: Zusammenfuehrung): unknown {
  if (gleich(l, f)) return l
  if (gleich(l, b)) return f
  if (gleich(f, b)) return l
  if (istIdListe(l) && istIdListe(f)) return listeZusammenfuehren(istIdListe(b) ? b : [], l, f, z)
  if (istObj(l) && istObj(f)) return objektZusammenfuehren(istObj(b) ? b : null, l, f, z)
  if (TEXTFELDER.has(schluessel) && typeof l === 'string' && typeof f === 'string') {
    if (!l.trim()) return f
    if (!f.trim()) return l
    return konfliktText(l, f, z)
  }
  return l
}

export function objektZusammenfuehren<T extends object>(basis: T | null, lokal: T, fern: T, z: Zusammenfuehrung): T {
  const b = (basis ?? {}) as Obj
  const l = lokal as Obj
  const f = fern as Obj
  const ergebnis: Obj = {}
  for (const k of new Set([...Object.keys(l), ...Object.keys(f)])) {
    if (k === 'geaendertAm' || k === 'geaendertVon') continue
    const v = wertZusammenfuehren(k, b[k], l[k], f[k], z)
    if (v !== undefined) ergebnis[k] = v
  }
  if ('geaendertAm' in l || 'geaendertAm' in f) {
    const lokalNeuer = String(l.geaendertAm ?? '') >= String(f.geaendertAm ?? '')
    ergebnis.geaendertAm = lokalNeuer ? l.geaendertAm : f.geaendertAm
    ergebnis.geaendertVon = lokalNeuer ? l.geaendertVon : f.geaendertVon
  }
  return ergebnis as T
}
