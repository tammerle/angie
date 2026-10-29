// Zwei Geräte (Angie und Eli) gegen denselben Speicherort: Abgleich,
// gleichzeitige Änderungen, Löschen und Offline-Warteschlange.
import { afterEach, describe, expect, it } from 'vitest'
import { demoQuelle } from './demoQuelle.ts'
import { Speicher } from './speicher.ts'
import { bloecke } from './zusammenfuehren.ts'
import type { Kunde, Notiz } from './typen.ts'

let laufend: Speicher[] = []
let zaehler = 0

function geraet(quelle: ReturnType<typeof demoQuelle>, benutzer: string) {
  const s = new Speicher({
    quelle,
    benutzer,
    anzeigename: (n) => (n === 'angie' ? 'Angie' : n === 'eli' ? 'Eli' : n),
    zeitText: (iso) => iso.slice(11, 16),
    datenbank: `test-${benutzer}-${zaehler++}`,
    ruhe: 0,
    abgleichAlle: 60_000,
  })
  laufend.push(s)
  return s
}

async function bereit(s: Speicher) {
  await s.starten()
  await s.abgleichen(true)
}

const notiz = (id: string, inhalt: string, von: string): Notiz => ({
  id,
  titel: 'Wocheneinkauf',
  inhalt,
  ordnerId: null,
  angeheftet: false,
  erstelltAm: '2026-10-29T10:00:00.000Z',
  erstelltVon: von,
  geaendertAm: new Date().toISOString(),
  geaendertVon: von,
})

afterEach(() => {
  laufend.forEach((s) => s.stoppen())
  laufend = []
})

describe('Speicher', () => {
  it('Angie legt an, Eli sieht es nach dem Abgleich', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    await bereit(e)
    a.speichern('notizen/n1.json', notiz('n1', 'Farbe bestellen', 'angie'))
    expect(a.holen().notizen).toHaveLength(1)
    await a.abgleichen(true)
    await e.abgleichen(true)
    expect(e.holen().notizen[0]?.inhalt).toBe('Farbe bestellen')
  })

  it('gleichzeitige Änderung am selben Text: beide Fassungen bleiben erhalten', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    a.speichern('notizen/n1.json', notiz('n1', 'Farbe', 'angie'))
    await a.abgleichen(true)
    await bereit(e)

    a.speichern('notizen/n1.json', { ...notiz('n1', 'Farbe + Shampoo', 'angie') })
    e.speichern('notizen/n1.json', { ...notiz('n1', 'Farbe + Folien', 'eli') })
    await a.abgleichen(true)
    await e.abgleichen(true)
    await a.abgleichen(true)

    for (const s of [a, e]) {
      const inhalt = s.holen().notizen[0]!.inhalt
      const b = bloecke(inhalt)
      expect(b.map((x) => x.text).sort()).toEqual(['Farbe + Folien', 'Farbe + Shampoo'])
      expect(b.every((x) => x.kopf)).toBe(true)
    }
  })

  it('verschiedene Felder gleichzeitig: ohne Konfliktblöcke zusammengeführt', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    a.speichern('notizen/n1.json', notiz('n1', 'Farbe', 'angie'))
    await a.abgleichen(true)
    await bereit(e)

    a.speichern('notizen/n1.json', { ...a.holen().notizen[0]!, titel: 'Einkauf Freitag' })
    e.speichern('notizen/n1.json', { ...e.holen().notizen[0]!, angeheftet: true })
    await a.abgleichen(true)
    await e.abgleichen(true)
    await a.abgleichen(true)
    expect(a.holen().notizen[0]).toMatchObject({ titel: 'Einkauf Freitag', angeheftet: true, inhalt: 'Farbe' })
    expect(e.holen().notizen[0]).toMatchObject({ titel: 'Einkauf Freitag', angeheftet: true, inhalt: 'Farbe' })
  })

  it('Kundennotizen von beiden gleichzeitig: keine geht verloren', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    const kunde: Kunde = {
      id: 'k1',
      vorname: 'Anna',
      nachname: 'Müller',
      telefon: '',
      email: '',
      geburtsdatum: '',
      adresse: '',
      notiz: '',
      letzterBesuch: '',
      notizen: [],
      erstelltAm: '2026-10-29T10:00:00.000Z',
      erstelltVon: 'angie',
      geaendertAm: '2026-10-29T10:00:00.000Z',
      geaendertVon: 'angie',
    }
    a.speichern('kunden/k1.json', kunde)
    await a.abgleichen(true)
    await bereit(e)
    const n = (id: string, von: string) => ({ id, datum: '2026-10-29', text: `Notiz ${von}`, von, geaendertAm: '', geaendertVon: von })
    a.speichern('kunden/k1.json', { ...kunde, notizen: [n('x', 'angie')] })
    e.speichern('kunden/k1.json', { ...kunde, telefon: '+39 333 1234567', notizen: [n('y', 'eli')] })
    await a.abgleichen(true)
    await e.abgleichen(true)
    await a.abgleichen(true)
    const k = a.holen().kundeNach.get('k1')!
    expect(k.notizen.map((x) => x.id).sort()).toEqual(['x', 'y'])
    expect(k.telefon).toBe('+39 333 1234567')
  })

  it('Löschen kommt beim anderen Gerät an', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    a.speichern('notizen/n1.json', notiz('n1', 'weg damit', 'angie'))
    await a.abgleichen(true)
    await bereit(e)
    expect(e.holen().notizen).toHaveLength(1)
    a.loeschen('notizen/n1.json')
    await a.abgleichen(true)
    await e.abgleichen(true)
    expect(e.holen().notizen).toHaveLength(0)
  })

  it('offline: Änderungen warten und werden später hochgeladen', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    await bereit(a)
    q.offline(true)
    a.speichern('notizen/n1.json', notiz('n1', 'im Keller notiert', 'angie'))
    await a.abgleichen(true)
    expect(a.holen().sync.zustand).toBe('offline')
    expect(a.holen().sync.ausstehend).toBe(1)
    expect(Object.keys(q.alle())).toHaveLength(0)
    q.offline(false)
    await a.abgleichen(true)
    expect(a.holen().sync.ausstehend).toBe(0)
    expect(Object.keys(q.alle())).toEqual(['notizen/n1.json'])
  })

  it('Warteschlange übersteht einen Neustart der App', async () => {
    const q = demoQuelle()
    const db = `test-neustart-${zaehler++}`
    const optionen = {
      quelle: q,
      benutzer: 'eli',
      anzeigename: (n: string) => n,
      zeitText: (iso: string) => iso,
      datenbank: db,
      ruhe: 0,
      abgleichAlle: 60_000,
    }
    const vorher = new Speicher(optionen)
    laufend.push(vorher)
    await vorher.starten()
    await vorher.abgleichen(true)
    q.offline(true)
    vorher.speichern('notizen/n2.json', notiz('n2', 'nicht verlieren', 'eli'))
    await vorher.abgleichen(true)
    vorher.stoppen()
    q.offline(false)

    const nachher = new Speicher(optionen)
    laufend.push(nachher)
    await nachher.starten()
    expect(nachher.holen().notizen[0]?.inhalt).toBe('nicht verlieren')
    await nachher.abgleichen(true)
    expect(Object.keys(q.alle())).toEqual(['notizen/n2.json'])
  })

  it('Bilder: Foto wird hochgeladen und erscheint beim anderen Gerät', async () => {
    const q = demoQuelle()
    const a = geraet(q, 'angie')
    const e = geraet(q, 'eli')
    await bereit(a)
    await bereit(e)
    const id = `${Date.now().toString(36)}-abcde`
    a.bildSpeichern(`vorschau/k1/${id}.jpg`, new Blob([new Uint8Array([1, 2, 3])], { type: 'image/jpeg' }))
    a.bildSpeichern(`fotos/k1/${id}.jpg`, new Blob([new Uint8Array([1, 2, 3, 4])], { type: 'image/jpeg' }))
    expect(a.holen().fotos.get('k1')).toHaveLength(1)
    await a.abgleichen(true)
    await e.abgleichen(true)
    const f = e.holen().fotos.get('k1')
    expect(f).toHaveLength(1)
    const blob = await e.bild(f![0]!.pfad)
    expect(blob?.size).toBe(4)
  })
})
