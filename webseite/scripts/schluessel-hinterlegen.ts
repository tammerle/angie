// Hinterlegt den GitHub-Schlüssel verschlüsselt in ../zugang/zugang.json, damit
// die App sich ohne Einrichtung automatisch verbindet. Der Schlüssel kommt nur
// über die Standardeingabe herein und wird nie ausgegeben oder im Klartext gespeichert.
//   <schluessel> | ANGIE_PASSWORT=… node scripts/schluessel-hinterlegen.ts
// Danach zugang/zugang.json committen und pushen.
import { readFileSync, writeFileSync } from 'node:fs'
import { tokenEntschluesseln, tokenVerschluesseln, type Zugang } from '../src/lib/krypto.ts'
import { hauptschluesselOeffnen } from '../src/lib/passwort.ts'

function fehler(text: string) {
  console.error(text)
  process.exitCode = 1
}

async function main() {
  const datei = new URL('../../zugang/zugang.json', import.meta.url)
  const passwort = process.env.ANGIE_PASSWORT ?? process.env.ELI_PASSWORT
  const name = process.env.ANGIE_PASSWORT ? 'angie' : 'eli'
  if (!passwort) {
    return fehler('Aufruf: <schluessel> | ANGIE_PASSWORT=… node scripts/schluessel-hinterlegen.ts')
  }

  let eingabe = ''
  for await (const stueck of process.stdin) eingabe += stueck
  const token = eingabe.trim()
  if (!token) {
    return fehler('Kein Schlüssel auf der Standardeingabe.')
  }

  const zugang = JSON.parse(readFileSync(datei, 'utf8')) as Zugang
  const offen = await hauptschluesselOeffnen(zugang, name, passwort)
  if (!offen) {
    return fehler('Passwort passt nicht zur Zugangsdatei.')
  }

  // Zugriff prüfen: Daten-Repo lesen und Schreibrecht melden lassen.
  const antwort = await fetch(`https://api.github.com/repos/${zugang.daten.besitzer}/${zugang.daten.repo}`, {
    headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
  })
  if (!antwort.ok) {
    return fehler(`Kein Zugriff auf ${zugang.daten.besitzer}/${zugang.daten.repo} (HTTP ${antwort.status}).`)
  }
  const rechte = ((await antwort.json()) as { permissions?: { push?: boolean } }).permissions
  if (rechte && !rechte.push) {
    return fehler('Der Schlüssel darf im Daten-Repo nicht schreiben.')
  }

  const neu: Zugang = { ...zugang, token: await tokenVerschluesseln(offen.haupt, token) }
  // Gegenprobe: lässt sich der Schlüssel wieder öffnen?
  if ((await tokenEntschluesseln(offen.haupt, neu.token!)) !== token) {
    return fehler('Gegenprobe fehlgeschlagen – nichts geschrieben.')
  }
  writeFileSync(datei, JSON.stringify(neu, null, 2) + '\n')
  console.log(`Schlüssel verschlüsselt hinterlegt (für alle Benutzerinnen): ${datei.pathname}`)
}

await main()
