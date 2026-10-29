// Zugang für den lokalen Testbetrieb (`npm run demo`) mit Testpasswörtern.
import { tokenVerschluesseln, zufallsBytes, type Zugang } from '../lib/krypto.ts'
import { benutzerVerpacken } from '../lib/passwort.ts'
import type { ZugangStand } from './zugang.ts'

export const DEMO_PASSWORT = 'Demo_123!'

export async function demoZugang(schluessel: string): Promise<ZugangStand> {
  const roh = localStorage.getItem(schluessel)
  if (roh) return JSON.parse(roh) as ZugangStand
  const haupt = zufallsBytes(32)
  const zugang: Zugang = {
    version: 1,
    argon2: { m: 65536, t: 3, p: 1 },
    daten: { besitzer: 'demo', repo: 'demo', zweig: 'main' },
    benutzer: [
      await benutzerVerpacken('angie', 'Angie', DEMO_PASSWORT, haupt),
      await benutzerVerpacken('eli', 'Eli', DEMO_PASSWORT, haupt),
    ],
    token: await tokenVerschluesseln(haupt, 'demo-token'),
  }
  const stand = { zugang, sha: 'demo' }
  localStorage.setItem(schluessel, JSON.stringify(stand))
  return stand
}
