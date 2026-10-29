// Argon2id: aus dem Passwort wird der Schlüssel abgeleitet, der den
// Hauptschlüssel verpackt. Läuft im Worker (argonArbeiter.ts).
import { argon2id } from 'hash-wasm'
import {
  aesSchluessel,
  ausBase64,
  benutzernameNormal,
  entschluesseln,
  verschluesseln,
  zufallsBytes,
  zuBase64,
  type Argon2Parameter,
  type Zugang,
  type ZugangBenutzer,
} from './krypto.ts'

export const STANDARD_ARGON2: Argon2Parameter = { m: 65536, t: 3, p: 1 }

async function passwortSchluessel(passwort: string, salt: Uint8Array<ArrayBuffer>, p: Argon2Parameter) {
  const roh = await argon2id({
    password: passwort.normalize('NFC'),
    salt,
    parallelism: p.p,
    iterations: p.t,
    memorySize: p.m,
    hashLength: 32,
    outputType: 'binary',
  })
  return aesSchluessel(new Uint8Array(roh))
}

const zusatzBenutzer = (name: string) => `salon-rose:benutzer:${name}`

/** Verpackt den Hauptschlüssel mit dem Passwort einer Benutzerin. */
export async function benutzerVerpacken(
  name: string,
  anzeigename: string,
  passwort: string,
  haupt: Uint8Array<ArrayBuffer>,
  p: Argon2Parameter = STANDARD_ARGON2,
): Promise<ZugangBenutzer> {
  const normal = benutzernameNormal(name)
  const salt = zufallsBytes(16)
  const key = await passwortSchluessel(passwort, salt, p)
  return {
    name: normal,
    anzeigename,
    salt: zuBase64(salt),
    schluessel: await verschluesseln(key, haupt, zusatzBenutzer(normal)),
  }
}

/** Prüft Benutzername und Passwort. Liefert den Hauptschlüssel oder null. */
export async function hauptschluesselOeffnen(
  zugang: Zugang,
  name: string,
  passwort: string,
): Promise<{ haupt: Uint8Array<ArrayBuffer>; benutzer: ZugangBenutzer } | null> {
  const benutzer = zugang.benutzer.find((b) => b.name === benutzernameNormal(name))
  if (!benutzer) {
    // Gleiche Rechenzeit wie bei einem echten Versuch, damit Namen nicht auffallen.
    await passwortSchluessel(passwort, zufallsBytes(16), zugang.argon2)
    return null
  }
  const key = await passwortSchluessel(passwort, ausBase64(benutzer.salt), zugang.argon2)
  try {
    const haupt = await entschluesseln(key, benutzer.schluessel, zusatzBenutzer(benutzer.name))
    return { haupt, benutzer }
  } catch {
    return null
  }
}
