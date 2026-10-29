import { describe, expect, it } from 'vitest'
import { bloecke, hatKonflikt, objektZusammenfuehren } from './zusammenfuehren.ts'

const z = { lokal: { wer: 'Eli', wann: '29.10.2026, 18:03' }, fern: { wer: 'Angie', wann: '29.10.2026, 18:02' } }

describe('objektZusammenfuehren', () => {
  const basis = { id: '1', titel: 'Einkauf', inhalt: 'Farbe', angeheftet: false, geaendertAm: '1', geaendertVon: 'angie' }

  it('übernimmt Änderungen an verschiedenen Feldern von beiden', () => {
    const lokal = { ...basis, titel: 'Einkauf Woche', geaendertAm: '3', geaendertVon: 'eli' }
    const fern = { ...basis, angeheftet: true, geaendertAm: '2', geaendertVon: 'angie' }
    const e = objektZusammenfuehren(basis, lokal, fern, z)
    expect(e.titel).toBe('Einkauf Woche')
    expect(e.angeheftet).toBe(true)
    expect(e.inhalt).toBe('Farbe')
    expect(e.geaendertVon).toBe('eli')
  })

  it('speichert bei gleichzeitigem Text beide Fassungen in zwei Blöcken', () => {
    const lokal = { ...basis, inhalt: 'Farbe + Folien' }
    const fern = { ...basis, inhalt: 'Farbe + Shampoo' }
    const e = objektZusammenfuehren(basis, lokal, fern, z)
    expect(hatKonflikt(e.inhalt)).toBe(true)
    const b = bloecke(e.inhalt)
    expect(b).toHaveLength(2)
    expect(b[0]).toEqual({ kopf: 'Angie · 29.10.2026, 18:02', text: 'Farbe + Shampoo' })
    expect(b[1]).toEqual({ kopf: 'Eli · 29.10.2026, 18:03', text: 'Farbe + Folien' })
  })

  it('führt Listen mit IDs zusammen (Kundennotizen)', () => {
    const n = (id: string, text: string) => ({ id, text, datum: '2026-10-29' })
    const b = { notizen: [n('a', 'alt')] }
    const lokal = { notizen: [n('l', 'von Eli'), n('a', 'alt')] }
    const fern = { notizen: [n('f', 'von Angie'), n('a', 'alt geändert')] }
    const e = objektZusammenfuehren(b, lokal, fern, z)
    expect(e.notizen.map((x) => x.id).sort()).toEqual(['a', 'f', 'l'])
    expect(e.notizen.find((x) => x.id === 'a')?.text).toBe('alt geändert')
  })

  it('respektiert Löschungen, wenn die andere Seite nichts geändert hat', () => {
    const n = (id: string) => ({ id, text: id })
    const b = { notizen: [n('a'), n('b')] }
    const lokal = { notizen: [n('a')] }
    const fern = { notizen: [n('a'), n('b'), n('c')] }
    expect(objektZusammenfuehren(b, lokal, fern, z).notizen.map((x) => x.id)).toEqual(['a', 'c'])
  })
})
