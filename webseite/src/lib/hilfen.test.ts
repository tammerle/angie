import { describe, expect, it } from 'vitest'
import { initialen, nameGueltig, naechsterGeburtstag, zeitAusId, neueId } from './hilfen.ts'

describe('initialen', () => {
  it('nimmt Vor- und Nachname', () => expect(initialen('Elena', 'Gruber')).toBe('EG'))
  it('nur Vorname: ein Buchstabe', () => expect(initialen('Elena', '')).toBe('E'))
  it('nur Nachname', () => expect(initialen('  ', 'gruber')).toBe('G'))
  it('Doppelname im Vornamen', () => expect(initialen('Anna Maria', '')).toBe('AM'))
  it('Umlaute', () => expect(initialen('Özge', 'Ünal')).toBe('ÖÜ'))
  it('ohne Namen', () => expect(initialen('', '')).toBe('?'))
})

describe('nameGueltig (Pflichtfeld)', () => {
  it('ein Wort in einem der Felder reicht', () => {
    expect(nameGueltig('Anna', '')).toBe(true)
    expect(nameGueltig('', 'Müller')).toBe(true)
  })
  it('leer, Leerzeichen oder nur Zahlen reichen nicht', () => {
    expect(nameGueltig('', '')).toBe(false)
    expect(nameGueltig('   ', ' ')).toBe(false)
    expect(nameGueltig('123', '-')).toBe(false)
  })
})

describe('naechsterGeburtstag', () => {
  it('rechnet Tage und Alter', () => {
    const heute = new Date(2026, 9, 29)
    expect(naechsterGeburtstag('1995-10-29', heute)).toEqual({ tage: 0, alter: 31 })
    expect(naechsterGeburtstag('1995-11-02', heute)).toEqual({ tage: 4, alter: 31 })
    expect(naechsterGeburtstag('1990-10-01', heute)?.alter).toBe(37)
    expect(naechsterGeburtstag('', heute)).toBeNull()
  })
})

describe('neueId', () => {
  it('enthält den Zeitpunkt', () => {
    const vorher = Date.now()
    expect(zeitAusId(neueId())).toBeGreaterThanOrEqual(vorher)
  })
})
