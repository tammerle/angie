// Lokal zuerst: Alles wird sofort im Browser gespeichert und angezeigt, eine
// Warteschlange lädt es im Hintergrund nach GitHub hoch. Änderungen der anderen
// kommen per Abgleich (Baum mit ETag) herein. Konflikte löst zusammenfuehren.ts.
import { createStore, del, delMany, get, getMany, set, setMany, type UseStore } from 'idb-keyval'
import { neueId, zeitAusId } from '../lib/hilfen.ts'
import { blobZuBase64 } from '../lib/bilder.ts'
import { KonfliktFehler, NetzFehler, textZuBase64, ZugriffFehler, type Quelle } from './quelle.ts'
import type { FotoInfo, Kunde, Notiz, Ordner, Profil } from './typen.ts'
import { objektZusammenfuehren, type Zusammenfuehrung } from './zusammenfuehren.ts'

/** getrennt = noch nicht mit GitHub verbunden, alles bleibt auf diesem Gerät */
export type SyncZustand = 'bereit' | 'laeuft' | 'offline' | 'fehler' | 'zugriff' | 'getrennt'

export interface Datenstand {
  geladen: boolean
  kunden: Kunde[]
  kundeNach: Map<string, Kunde>
  notizen: Notiz[]
  ordner: Ordner[]
  profile: Map<string, Profil>
  fotos: Map<string, FotoInfo[]>
  alleFotos: FotoInfo[]
  /** pfad → SHA bzw. „lokal“ für Bilder, die noch hochgeladen werden */
  bildStand: Map<string, string>
  sync: { zustand: SyncZustand; zuletzt: number | null; ausstehend: number; ersterAbgleich: boolean }
}

interface Basis {
  sha: string
  text: string
}

type Auftrag =
  | { id: string; art: 'json'; pfad: string; objekt: unknown; zeit: number }
  | { id: string; art: 'binaer'; pfad: string; blob: Blob; zeit: number }
  | { id: string; art: 'loeschen'; pfad: string; zeit: number }

export interface SpeicherOptionen {
  /** null: noch kein GitHub-Schlüssel – die App läuft lokal, die Warteschlange wartet */
  quelle: Quelle | null
  benutzer: string
  anzeigename: (name: string) => string
  zeitText: (iso: string) => string
  datenbank: string
  /** Wartezeit nach der letzten Änderung, bevor ein Text hochgeladen wird */
  ruhe?: number
  abgleichAlle?: number
}

const istJson = (p: string) => p.endsWith('.json')
const FOTO = /^fotos\/([^/]+)\/([^/]+)\.jpg$/

function nachPraefix<T>(objekte: Map<string, unknown>, praefix: string): T[] {
  const liste: T[] = []
  for (const [p, o] of objekte) if (p.startsWith(praefix) && p.indexOf('/', praefix.length) === -1) liste.push(o as T)
  return liste
}

export class Speicher {
  private o: Required<SpeicherOptionen>
  private idb: UseStore
  private baum = new Map<string, string>()
  private etag: string | null = null
  private basis = new Map<string, Basis>()
  private objekte = new Map<string, unknown>()
  private ausgang: Auftrag[] = []
  private inArbeit = new Set<string>()
  private lokaleBilder = new Map<string, Blob>()
  private hoerer = new Set<() => void>()
  private zustand: SyncZustand = 'bereit'
  private zuletzt: number | null = null
  private ersterAbgleich = false
  private lauf: Promise<void> | null = null
  private nochmal = false
  private sofortWunsch = false
  private timer: ReturnType<typeof setTimeout> | null = null
  private gestoppt = false
  private blobLaden = new Map<string, Promise<Blob | null>>()
  private stand: Datenstand

  constructor(optionen: SpeicherOptionen) {
    this.o = { ruhe: 1800, abgleichAlle: 15_000, ...optionen }
    this.idb = createStore(optionen.datenbank, 'daten')
    if (!optionen.quelle) {
      this.zustand = 'getrennt'
      this.ersterAbgleich = true
    }
    this.stand = this.berechnen(false)
  }

  private get q(): Quelle {
    if (!this.o.quelle) throw new NetzFehler('nicht verbunden')
    return this.o.quelle
  }

  // ---------- Lesen für die Oberfläche ----------

  abonnieren = (h: () => void) => {
    this.hoerer.add(h)
    return () => this.hoerer.delete(h)
  }

  holen = () => this.stand

  private melden() {
    this.stand = this.berechnen(true)
    for (const h of this.hoerer) h()
  }

  private berechnen(geladen: boolean): Datenstand {
    const kunden = nachPraefix<Kunde>(this.objekte, 'kunden/')
    const geloescht = new Set(this.ausgang.filter((a) => a.art === 'loeschen').map((a) => a.pfad))
    const bildStand = new Map<string, string>()
    for (const [p, sha] of this.baum) if (!istJson(p) && !geloescht.has(p)) bildStand.set(p, sha)
    for (const p of this.lokaleBilder.keys()) bildStand.set(p, `lokal:${p}`)

    const fotos = new Map<string, FotoInfo[]>()
    const alleFotos: FotoInfo[] = []
    for (const p of bildStand.keys()) {
      const m = FOTO.exec(p)
      if (!m) continue
      const [, kundeId, id] = m as unknown as [string, string, string]
      const info: FotoInfo = { id, kundeId, pfad: p, vorschauPfad: `vorschau/${kundeId}/${id}.jpg`, zeit: zeitAusId(id) }
      alleFotos.push(info)
      const liste = fotos.get(kundeId) ?? []
      liste.push(info)
      fotos.set(kundeId, liste)
    }
    const neueste = (a: FotoInfo, b: FotoInfo) => b.zeit - a.zeit
    alleFotos.sort(neueste)
    for (const l of fotos.values()) l.sort(neueste)

    return {
      geladen,
      kunden,
      kundeNach: new Map(kunden.map((k) => [k.id, k])),
      notizen: nachPraefix<Notiz>(this.objekte, 'notizen/'),
      ordner: nachPraefix<Ordner>(this.objekte, 'ordner/'),
      profile: new Map(nachPraefix<Profil>(this.objekte, 'benutzer/').map((p) => [p.name, p])),
      fotos,
      alleFotos,
      bildStand,
      sync: {
        zustand: this.zustand,
        zuletzt: this.zuletzt,
        ausstehend: this.ausgang.length,
        ersterAbgleich: this.ersterAbgleich,
      },
    }
  }

  // ---------- Start und Ende ----------

  async starten() {
    const meta = await get<{ baum: [string, string][]; etag: string | null }>('meta', this.idb)
    const ausgang = (await get<Auftrag[]>('ausgang', this.idb)) ?? []
    if (meta) {
      this.baum = new Map(meta.baum)
      this.etag = meta.etag
      const jsonPfade = meta.baum.map(([p]) => p).filter(istJson)
      const werte = await getMany<Basis | undefined>(jsonPfade.map((p) => `d:${p}`), this.idb)
      jsonPfade.forEach((p, i) => {
        const b = werte[i]
        if (!b) return
        this.basis.set(p, b)
        try {
          this.objekte.set(p, JSON.parse(b.text))
        } catch {
          /* defekte Datei überspringen */
        }
      })
    }
    this.ausgang = ausgang
    for (const a of ausgang) {
      if (a.art === 'json') this.objekte.set(a.pfad, a.objekt)
      else if (a.art === 'binaer') this.lokaleBilder.set(a.pfad, a.blob)
      else {
        this.objekte.delete(a.pfad)
        this.lokaleBilder.delete(a.pfad)
      }
    }
    this.melden()
    if (!this.o.quelle) return
    document.addEventListener('visibilitychange', this.sichtbar)
    window.addEventListener('online', this.sofort)
    void this.abgleichen()
  }

  stoppen() {
    this.gestoppt = true
    if (this.timer) clearTimeout(this.timer)
    document.removeEventListener('visibilitychange', this.sichtbar)
    window.removeEventListener('online', this.sofort)
  }

  private sichtbar = () => {
    if (document.visibilityState === 'visible') void this.abgleichen()
  }

  private sofort = () => void this.abgleichen()

  // ---------- Schreiben ----------

  speichern(pfad: string, objekt: unknown) {
    this.objekte.set(pfad, objekt)
    const offen = this.ausgang.find((a) => a.pfad === pfad && a.art === 'json' && !this.inArbeit.has(a.id))
    if (offen && offen.art === 'json') {
      offen.objekt = objekt
      offen.zeit = Date.now()
    } else {
      this.ausgang.push({ id: neueId(), art: 'json', pfad, objekt, zeit: Date.now() })
    }
    this.nachAenderung()
  }

  bildSpeichern(pfad: string, blob: Blob) {
    this.lokaleBilder.set(pfad, blob)
    this.ausgang = this.ausgang.filter((a) => !(a.pfad === pfad && a.art !== 'json' && !this.inArbeit.has(a.id)))
    this.ausgang.push({ id: neueId(), art: 'binaer', pfad, blob, zeit: Date.now() })
    this.nachAenderung()
  }

  loeschen(pfad: string) {
    this.objekte.delete(pfad)
    this.lokaleBilder.delete(pfad)
    // Noch nicht hochgeladene Aufträge für diese Datei sind überflüssig.
    this.ausgang = this.ausgang.filter((a) => a.pfad !== pfad || this.inArbeit.has(a.id))
    const warAufGithub = this.baum.has(pfad) || this.ausgang.some((a) => a.pfad === pfad)
    if (warAufGithub) this.ausgang.push({ id: neueId(), art: 'loeschen', pfad, zeit: Date.now() })
    this.nachAenderung()
  }

  private nachAenderung() {
    void set('ausgang', this.ausgang, this.idb)
    this.melden()
    this.planen(this.o.ruhe + 50)
  }

  // ---------- Bilder ----------

  async bild(pfad: string): Promise<Blob | null> {
    const lokal = this.lokaleBilder.get(pfad)
    if (lokal) return lokal
    const sha = this.baum.get(pfad)
    if (!sha) return null
    const laufend = this.blobLaden.get(sha)
    if (laufend) return laufend
    const p = (async () => {
      const gespeichert = await get<Blob>(`b:${sha}`, this.idb)
      if (gespeichert) return gespeichert
      try {
        const blob = await this.q.blob(sha)
        void set(`b:${sha}`, blob, this.idb)
        return blob
      } catch {
        return null
      }
    })()
    this.blobLaden.set(sha, p)
    const ergebnis = await p
    if (!ergebnis) this.blobLaden.delete(sha)
    return ergebnis
  }

  // ---------- Abgleich ----------

  private planen(ms: number) {
    if (this.gestoppt) return
    if (this.timer) clearTimeout(this.timer)
    this.timer = setTimeout(() => void this.abgleichen(), ms)
  }

  /** Lädt Wartendes hoch und holt Änderungen der anderen. Läuft schon ein
   *  Abgleich, wird er danach wiederholt; das Versprechen gilt für beides. */
  abgleichen(sofort = false): Promise<void> {
    if (this.gestoppt || !this.o.quelle) return Promise.resolve()
    if (sofort) this.sofortWunsch = true
    if (this.lauf) {
      this.nochmal = true
      return this.lauf
    }
    this.lauf = this.durchlauf().finally(() => {
      this.lauf = null
    })
    return this.lauf
  }

  private async durchlauf() {
    let naechster = this.o.abgleichAlle
    do {
      this.nochmal = false
      const sofort = this.sofortWunsch
      this.sofortWunsch = false
      naechster = this.o.abgleichAlle
      this.setzeZustand('laeuft')
      try {
        const rest = await this.hochladen(sofort)
        await this.herunterladen()
        this.zuletzt = Date.now()
        this.ersterAbgleich = true
        this.setzeZustand('bereit')
        if (rest !== null) naechster = Math.min(naechster, rest)
      } catch (e) {
        naechster = 10_000
        if (e instanceof ZugriffFehler) {
          this.setzeZustand('zugriff')
          naechster = 60_000
        } else if (e instanceof NetzFehler) this.setzeZustand('offline')
        else {
          console.error(e)
          this.setzeZustand('fehler')
        }
        break
      }
    } while (this.nochmal && !this.gestoppt)
    if (document.visibilityState === 'visible' || this.ausgang.length) this.planen(naechster)
  }

  private setzeZustand(z: SyncZustand) {
    this.zustand = z
    this.melden()
  }

  /** Liefert die Wartezeit bis zum nächsten fälligen Auftrag oder null. */
  private async hochladen(sofort: boolean): Promise<number | null> {
    const gesperrt = new Set<string>()
    let warten: number | null = null
    for (const a of [...this.ausgang]) {
      if (gesperrt.has(a.pfad)) continue
      const alter = Date.now() - a.zeit
      if (a.art === 'json' && !sofort && alter < this.o.ruhe) {
        gesperrt.add(a.pfad)
        warten = Math.min(warten ?? Infinity, this.o.ruhe - alter + 50)
        continue
      }
      this.inArbeit.add(a.id)
      try {
        if (a.art === 'json') await this.jsonHochladen(a)
        else if (a.art === 'binaer') await this.binaerHochladen(a)
        else await this.loeschenHochladen(a)
        this.ausgang = this.ausgang.filter((x) => x.id !== a.id)
        await set('ausgang', this.ausgang, this.idb)
        this.melden()
      } finally {
        this.inArbeit.delete(a.id)
      }
    }
    return warten
  }

  private nachricht(pfad: string, art: string) {
    return `${art} ${pfad} · ${this.o.benutzer}`
  }

  private zusammenfuehrung(fern: Record<string, unknown>): Zusammenfuehrung {
    const fernWer = typeof fern.geaendertVon === 'string' ? fern.geaendertVon : ''
    const fernWann = typeof fern.geaendertAm === 'string' ? fern.geaendertAm : new Date().toISOString()
    return {
      lokal: { wer: this.o.anzeigename(this.o.benutzer), wann: this.o.zeitText(new Date().toISOString()) },
      fern: { wer: this.o.anzeigename(fernWer), wann: this.o.zeitText(fernWann) },
    }
  }

  private async jsonHochladen(a: Extract<Auftrag, { art: 'json' }>) {
    const urspruenglich = a.objekt
    let objekt = a.objekt
    let sha = this.baum.get(a.pfad) ?? null
    let zusammengefuehrt = false
    for (let versuch = 0; versuch < 6; versuch++) {
      const text = JSON.stringify(objekt, null, 2) + '\n'
      try {
        const neu = await this.q.schreiben(a.pfad, textZuBase64(text), sha, this.nachricht(a.pfad, 'speichern'))
        this.baum.set(a.pfad, neu)
        this.basis.set(a.pfad, { sha: neu, text })
        await setMany([[`d:${a.pfad}`, { sha: neu, text }]], this.idb)
        await this.metaSichern()
        if (zusammengefuehrt) this.zusammengefuehrtUebernehmen(a, urspruenglich, objekt)
        return
      } catch (e) {
        if (!(e instanceof KonfliktFehler)) throw e
        const fern = await this.q.lesen(a.pfad)
        if (!fern) {
          sha = null
          continue
        }
        let fernObjekt: Record<string, unknown>
        try {
          fernObjekt = JSON.parse(fern.text)
        } catch {
          sha = fern.sha
          continue
        }
        const b = this.basis.get(a.pfad)
        const basisObjekt = b ? JSON.parse(b.text) : null
        objekt = objektZusammenfuehren(basisObjekt, objekt as object, fernObjekt, this.zusammenfuehrung(fernObjekt))
        this.basis.set(a.pfad, { sha: fern.sha, text: fern.text })
        sha = fern.sha
        zusammengefuehrt = true
      }
    }
    throw new NetzFehler(`zu viele Konflikte: ${a.pfad}`)
  }

  /** Neuere lokale Änderungen auf das Zusammengeführte setzen, Ansicht aktualisieren. */
  private zusammengefuehrtUebernehmen(a: Auftrag, urspruenglich: unknown, ergebnis: unknown) {
    const neuere = this.ausgang.filter((x) => x.pfad === a.pfad && x.id !== a.id && x.art === 'json')
    if (!neuere.length) {
      this.objekte.set(a.pfad, ergebnis)
      return
    }
    for (const n of neuere) {
      if (n.art !== 'json') continue
      n.objekt = objektZusammenfuehren(urspruenglich as object, n.objekt as object, ergebnis as object, {
        lokal: { wer: this.o.anzeigename(this.o.benutzer), wann: this.o.zeitText(new Date().toISOString()) },
        fern: { wer: this.o.anzeigename(this.o.benutzer), wann: this.o.zeitText(new Date().toISOString()) },
      })
      this.objekte.set(a.pfad, n.objekt)
    }
  }

  private async binaerHochladen(a: Extract<Auftrag, { art: 'binaer' }>) {
    const base64 = await blobZuBase64(a.blob)
    let sha = this.baum.get(a.pfad) ?? null
    for (let versuch = 0; versuch < 4; versuch++) {
      try {
        const neu = await this.q.schreiben(a.pfad, base64, sha, this.nachricht(a.pfad, 'bild'))
        this.baum.set(a.pfad, neu)
        void set(`b:${neu}`, a.blob, this.idb)
        if (!this.ausgang.some((x) => x.pfad === a.pfad && x.id !== a.id)) this.lokaleBilder.delete(a.pfad)
        await this.metaSichern()
        return
      } catch (e) {
        if (!(e instanceof KonfliktFehler)) throw e
        sha = (await this.q.lesen(a.pfad))?.sha ?? null
      }
    }
    throw new NetzFehler(`Bild: zu viele Konflikte: ${a.pfad}`)
  }

  private async loeschenHochladen(a: Extract<Auftrag, { art: 'loeschen' }>) {
    let sha = this.baum.get(a.pfad) ?? (await this.q.lesen(a.pfad))?.sha ?? null
    for (let versuch = 0; versuch < 4 && sha; versuch++) {
      try {
        await this.q.loeschen(a.pfad, sha, this.nachricht(a.pfad, 'löschen'))
        break
      } catch (e) {
        if (!(e instanceof KonfliktFehler)) throw e
        sha = (await this.q.lesen(a.pfad))?.sha ?? null
      }
    }
    this.baum.delete(a.pfad)
    this.basis.delete(a.pfad)
    await del(`d:${a.pfad}`, this.idb)
    await this.metaSichern()
  }

  private async herunterladen() {
    const b = await this.q.baum(this.etag)
    if (!b.eintraege) return
    const fern = new Map(b.eintraege.map((e) => [e.pfad, e.sha]))
    const wartend = new Set(this.ausgang.map((a) => a.pfad))
    const zuLaden: [string, string][] = []
    for (const [pfad, sha] of fern) {
      if (wartend.has(pfad) || !istJson(pfad)) continue
      if (this.basis.get(pfad)?.sha !== sha) zuLaden.push([pfad, sha])
    }
    const weg = [...this.baum.keys()].filter((p) => !fern.has(p) && !wartend.has(p))
    const texte = zuLaden.length ? await this.q.texte(zuLaden.map(([, s]) => s)) : new Map<string, string>()

    const naechster = new Map(fern)
    const neueBasis: [string, Basis][] = []
    for (const [pfad, sha] of zuLaden) {
      const text = texte.get(sha)
      if (text == null) {
        // Nicht geliefert: beim nächsten Mal erneut versuchen.
        const alt = this.baum.get(pfad)
        if (alt) naechster.set(pfad, alt)
        else naechster.delete(pfad)
        continue
      }
      try {
        this.objekte.set(pfad, JSON.parse(text))
        this.basis.set(pfad, { sha, text })
        neueBasis.push([`d:${pfad}`, { sha, text }])
      } catch {
        /* defekte Datei überspringen */
      }
    }
    for (const p of weg) {
      this.objekte.delete(p)
      this.basis.delete(p)
    }
    for (const p of wartend) {
      const alt = this.baum.get(p)
      if (alt) naechster.set(p, alt)
      else naechster.delete(p)
    }
    this.baum = naechster
    this.etag = b.etag
    if (neueBasis.length) await setMany(neueBasis, this.idb)
    if (weg.length) await delMany(weg.filter(istJson).map((p) => `d:${p}`), this.idb)
    await this.metaSichern()
    this.melden()
  }

  private metaSichern() {
    return set('meta', { baum: [...this.baum], etag: this.etag }, this.idb)
  }
}
