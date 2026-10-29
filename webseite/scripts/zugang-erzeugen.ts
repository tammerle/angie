// Erzeugt zugang/zugang.json für das öffentliche Repo angie.
// Passwörter kommen nur aus Umgebungsvariablen und landen nie in einer Datei:
//   ANGIE_PASSWORT=... ELI_PASSWORT=... node scripts/zugang-erzeugen.ts ../zugang/zugang.json
// Der GitHub-Schlüssel wird später in der App unter „Einrichtung“ hinterlegt.
import { writeFileSync } from 'node:fs'
import { zufallsBytes, type Zugang } from '../src/lib/krypto.ts'
import { benutzerVerpacken, STANDARD_ARGON2 } from '../src/lib/passwort.ts'

const ziel = process.argv[2]
const angie = process.env.ANGIE_PASSWORT
const eli = process.env.ELI_PASSWORT
if (!ziel || !angie || !eli) {
  console.error('Aufruf: ANGIE_PASSWORT=… ELI_PASSWORT=… node scripts/zugang-erzeugen.ts <ziel>')
  process.exit(1)
}

const haupt = zufallsBytes(32)
const zugang: Zugang = {
  version: 1,
  argon2: STANDARD_ARGON2,
  daten: { besitzer: 'tammerle', repo: 'angie-daten', zweig: 'main' },
  benutzer: [
    await benutzerVerpacken('angie', 'Angie', angie, haupt),
    await benutzerVerpacken('eli', 'Eli', eli, haupt),
  ],
  token: null,
}
writeFileSync(ziel, JSON.stringify(zugang, null, 2) + '\n')
console.log(`zugang.json geschrieben: ${ziel}`)
