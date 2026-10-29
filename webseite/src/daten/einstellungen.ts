// Design und Sprache: sofort auf dem Gerät gespeichert (auch vor dem Login
// wirksam) und im Profil synchronisiert.
import { useSyncExternalStore } from 'react'
import type { Einstellungen } from './typen.ts'

const SCHLUESSEL = 'salon-einstellungen'
export const STANDARD: Einstellungen = { design: 'hell', sprache: 'de' }

function lesen(): Einstellungen {
  try {
    const roh = localStorage.getItem(SCHLUESSEL)
    if (roh) return { ...STANDARD, ...(JSON.parse(roh) as Partial<Einstellungen>) }
  } catch {
    /* Standard */
  }
  return STANDARD
}

let aktuell = lesen()
const hoerer = new Set<() => void>()

function anwenden(e: Einstellungen) {
  const root = document.documentElement
  root.dataset.theme = e.design === 'dunkel' ? 'dark' : 'light'
  root.lang = e.sprache
  const farbe = e.design === 'dunkel' ? '#171215' : '#faf4f3'
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', farbe)
}

anwenden(aktuell)

export function einstellungenSetzen(neu: Partial<Einstellungen>) {
  const naechste = { ...aktuell, ...neu }
  if (naechste.design === aktuell.design && naechste.sprache === aktuell.sprache) return
  aktuell = naechste
  try {
    localStorage.setItem(SCHLUESSEL, JSON.stringify(aktuell))
  } catch {
    /* privater Modus */
  }
  const wechsel = () => {
    anwenden(aktuell)
    for (const h of hoerer) h()
  }
  // Weicher Übergang beim Wechsel hell/dunkel.
  if (document.startViewTransition && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.documentElement.dataset.richtung = 'design'
    document.startViewTransition(wechsel).finished.finally(() => delete document.documentElement.dataset.richtung)
  } else wechsel()
}

export function useEinstellungen(): Einstellungen {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => aktuell,
  )
}
