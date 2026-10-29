// Zugang ohne Server: Jede Benutzerin hat ein Passwort, aus dem Argon2id einen
// AES-Schlüssel ableitet (passwort.ts). Damit ist ein zufälliger Hauptschlüssel
// verpackt, der wiederum den GitHub-Schlüssel für das private Daten-Repo
// entschlüsselt. Gespeichert werden nur Salz, Parameter und verschlüsselte
// Blöcke – nie ein Passwort. Diese Datei enthält den AES-Teil (ohne Argon2).

export interface Argon2Parameter {
  /** Speicher in KiB */
  m: number
  t: number
  p: number
}

export interface Verschluesselt {
  iv: string
  daten: string
}

export interface ZugangBenutzer {
  name: string
  anzeigename: string
  salt: string
  schluessel: Verschluesselt
}

export interface DatenRepo {
  besitzer: string
  repo: string
  zweig: string
}

export interface Zugang {
  version: 1
  argon2: Argon2Parameter
  daten: DatenRepo
  benutzer: ZugangBenutzer[]
  token: Verschluesselt | null
}

const text = new TextEncoder()

export function zuBase64(bytes: Uint8Array): string {
  let s = ''
  for (let i = 0; i < bytes.length; i += 0x8000) {
    s += String.fromCharCode(...bytes.subarray(i, i + 0x8000))
  }
  return btoa(s)
}

export function ausBase64(b64: string): Uint8Array<ArrayBuffer> {
  const s = atob(b64)
  const bytes = new Uint8Array(s.length)
  for (let i = 0; i < s.length; i++) bytes[i] = s.charCodeAt(i)
  return bytes
}

export function zufallsBytes(n: number): Uint8Array<ArrayBuffer> {
  return crypto.getRandomValues(new Uint8Array(n))
}

export function benutzernameNormal(name: string): string {
  return name.trim().toLowerCase()
}

export async function aesSchluessel(roh: Uint8Array<ArrayBuffer>): Promise<CryptoKey> {
  return crypto.subtle.importKey('raw', roh, 'AES-GCM', false, ['encrypt', 'decrypt'])
}

export async function verschluesseln(key: CryptoKey, klartext: Uint8Array<ArrayBuffer>, zusatz: string): Promise<Verschluesselt> {
  const iv = zufallsBytes(12)
  const daten = await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv, additionalData: text.encode(zusatz) },
    key,
    klartext,
  )
  return { iv: zuBase64(iv), daten: zuBase64(new Uint8Array(daten)) }
}

export async function entschluesseln(key: CryptoKey, v: Verschluesselt, zusatz: string): Promise<Uint8Array<ArrayBuffer>> {
  const klar = await crypto.subtle.decrypt(
    { name: 'AES-GCM', iv: ausBase64(v.iv), additionalData: text.encode(zusatz) },
    key,
    ausBase64(v.daten),
  )
  return new Uint8Array(klar)
}

const ZUSATZ_TOKEN = 'salon-rose:token'

export async function tokenVerschluesseln(haupt: Uint8Array<ArrayBuffer>, token: string): Promise<Verschluesselt> {
  return verschluesseln(await aesSchluessel(haupt), text.encode(token.trim()), ZUSATZ_TOKEN)
}

export async function tokenEntschluesseln(haupt: Uint8Array<ArrayBuffer>, v: Verschluesselt): Promise<string> {
  const klar = await entschluesseln(await aesSchluessel(haupt), v, ZUSATZ_TOKEN)
  return new TextDecoder().decode(klar)
}
