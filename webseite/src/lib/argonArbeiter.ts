// Argon2id braucht absichtlich viel Rechenzeit und Speicher. Im Worker bleibt die
// Oberfläche dabei flüssig (Lade-Animation am Login-Knopf).
import type { Argon2Parameter, Zugang } from './krypto.ts'
import { benutzerVerpacken, hauptschluesselOeffnen } from './passwort.ts'

export type ArgonAuftrag =
  | { id: number; art: 'oeffnen'; zugang: Zugang; name: string; passwort: string }
  | { id: number; art: 'verpacken'; name: string; anzeigename: string; passwort: string; haupt: Uint8Array<ArrayBuffer>; p: Argon2Parameter }

self.onmessage = async (e: MessageEvent<ArgonAuftrag>) => {
  const a = e.data
  try {
    if (a.art === 'oeffnen') {
      const ergebnis = await hauptschluesselOeffnen(a.zugang, a.name, a.passwort)
      self.postMessage({ id: a.id, ergebnis })
    } else {
      const ergebnis = await benutzerVerpacken(a.name, a.anzeigename, a.passwort, a.haupt, a.p)
      self.postMessage({ id: a.id, ergebnis })
    }
  } catch (fehler) {
    self.postMessage({ id: a.id, fehler: String(fehler) })
  }
}
