// Ein „GitHub zum Mitnehmen“ für Tests und den lokalen Demo-Betrieb:
// gleiche Regeln (SHA-Prüfung beim Schreiben), Daten nur im Speicher bzw. im Browser.
import { ausBase64 } from '../lib/krypto.ts'
import { KonfliktFehler, NetzFehler, type Quelle } from './quelle.ts'

interface Datei {
  sha: string
  bytes: Uint8Array<ArrayBuffer>
}

export interface DemoSpeicher {
  laden(): Promise<Record<string, Datei> | undefined>
  sichern(daten: Record<string, Datei>): Promise<void>
}

async function sha1(bytes: Uint8Array<ArrayBuffer>): Promise<string> {
  const h = new Uint8Array(await crypto.subtle.digest('SHA-1', bytes))
  return Array.from(h, (b) => b.toString(16).padStart(2, '0')).join('')
}

export function demoQuelle(speicher?: DemoSpeicher, verzoegerung = 0) {
  let dateien: Record<string, Datei> = {}
  let geladen = false
  let offline = false
  let stand = 0

  const warten = () => (verzoegerung ? new Promise((r) => setTimeout(r, verzoegerung)) : Promise.resolve())

  async function bereit() {
    if (offline) throw new NetzFehler('offline')
    await warten()
    if (!geladen) {
      dateien = (await speicher?.laden()) ?? {}
      geladen = true
    }
  }
  async function sichern() {
    stand++
    await speicher?.sichern(dateien)
  }

  const quelle: Quelle & { offline(v: boolean): void; alle(): Record<string, Datei> } = {
    offline(v) {
      offline = v
    },
    alle: () => dateien,

    async baum(etag) {
      await bereit()
      const neu = `"${stand}"`
      if (etag === neu) return { eintraege: null, etag }
      return { eintraege: Object.entries(dateien).map(([pfad, d]) => ({ pfad, sha: d.sha })), etag: neu }
    },
    async texte(shas) {
      await bereit()
      const m = new Map<string, string>()
      for (const d of Object.values(dateien)) if (shas.includes(d.sha)) m.set(d.sha, new TextDecoder().decode(d.bytes))
      return m
    },
    async blob(sha) {
      await bereit()
      const d = Object.values(dateien).find((x) => x.sha === sha)
      if (!d) throw new NetzFehler('blob fehlt')
      return new Blob([d.bytes], { type: 'image/jpeg' })
    },
    async lesen(pfad) {
      await bereit()
      const d = dateien[pfad]
      return d ? { sha: d.sha, text: new TextDecoder().decode(d.bytes) } : null
    },
    async schreiben(pfad, base64, sha) {
      await bereit()
      const alt = dateien[pfad]
      if ((alt?.sha ?? null) !== sha) throw new KonfliktFehler(pfad)
      const bytes = ausBase64(base64)
      const neu = { sha: await sha1(bytes), bytes }
      dateien = { ...dateien, [pfad]: neu }
      await sichern()
      return neu.sha
    },
    async loeschen(pfad, sha) {
      await bereit()
      const alt = dateien[pfad]
      if (!alt) return
      if (alt.sha !== sha) throw new KonfliktFehler(pfad)
      const { [pfad]: _weg, ...rest } = dateien
      dateien = rest
      await sichern()
    },
  }
  return quelle
}
