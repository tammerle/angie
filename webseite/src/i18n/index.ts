import { useEinstellungen } from '../daten/einstellungen.ts'
import { GEBIETSSCHEMA, TEXTE, type Texte } from './texte.ts'

export function useT(): Texte {
  return TEXTE[useEinstellungen().sprache]
}

/** Gebietsschema für Datumsformate (de-DE, it-IT, en-GB). */
export function useGebiet(): string {
  return GEBIETSSCHEMA[useEinstellungen().sprache]
}
