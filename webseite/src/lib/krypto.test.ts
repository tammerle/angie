import { describe, expect, it } from 'vitest'
import { tokenEntschluesseln, tokenVerschluesseln, zufallsBytes, type Zugang } from './krypto.ts'
import { benutzerVerpacken, hauptschluesselOeffnen } from './passwort.ts'

// Kleine Parameter, damit der Test schnell bleibt; die App nutzt STANDARD_ARGON2.
const schnell = { m: 1024, t: 1, p: 1 }

async function testZugang() {
  const haupt = zufallsBytes(32)
  const zugang: Zugang = {
    version: 1,
    argon2: schnell,
    daten: { besitzer: 'x', repo: 'y', zweig: 'main' },
    benutzer: [await benutzerVerpacken('Mia', 'Mia', 'Test_123!', haupt, schnell)],
    token: await tokenVerschluesseln(haupt, 'geheim-123'),
  }
  return { haupt, zugang }
}

describe('krypto', () => {
  it('öffnet den Hauptschlüssel nur mit dem richtigen Passwort', async () => {
    const { haupt, zugang } = await testZugang()
    const ok = await hauptschluesselOeffnen(zugang, ' MIA ', 'Test_123!')
    expect(ok?.haupt).toEqual(haupt)
    expect(await hauptschluesselOeffnen(zugang, 'mia', 'test_123!')).toBeNull()
    expect(await hauptschluesselOeffnen(zugang, 'lea', 'Test_123!')).toBeNull()
  })

  it('entschlüsselt den GitHub-Schlüssel mit dem Hauptschlüssel', async () => {
    const { zugang } = await testZugang()
    const ok = await hauptschluesselOeffnen(zugang, 'mia', 'Test_123!')
    expect(await tokenEntschluesseln(ok!.haupt, zugang.token!)).toBe('geheim-123')
  })

  it('speichert kein Passwort im Klartext', async () => {
    const { zugang } = await testZugang()
    expect(JSON.stringify(zugang)).not.toContain('Test_123!')
  })
})
