// Hash-Router: läuft auf GitHub Pages ohne Server-Umleitungen. Seitenwechsel
// laufen über die View Transitions API, mit Richtung (vor/zurück/wechsel).
import { useSyncExternalStore } from 'react'
import { flushSync } from 'react-dom'

export interface Route {
  pfad: string
  teile: string[]
  suche: URLSearchParams
}

type Richtung = 'vor' | 'zurueck' | 'wechsel' | 'tab-vor' | 'tab-zurueck'

/** Reihenfolge der Bereiche wie in der unteren Leiste (Profil ganz rechts im Kopf). */
const REIHENFOLGE = ['kunden', 'uebersicht', 'notizen', 'einstellungen', 'profil']

function lesen(): Route {
  const roh = window.location.hash.replace(/^#/, '') || '/kunden'
  const [pfad = '/kunden', abfrage = ''] = roh.split('?')
  return { pfad, teile: pfad.split('/').filter(Boolean), suche: new URLSearchParams(abfrage) }
}

/** Tiefe einer Seite: bestimmt, ob ein Wechsel vor- oder zurückgeht. */
function tiefe(r: Route): number {
  const [a, b, c] = r.teile
  if (a === 'kunden') return b ? (c === 'bearbeiten' ? 2 : 1) : 0
  if (a === 'notizen') return b ? 1 : 0
  return 0
}

function bereich(r: Route): string {
  return r.teile[0] ?? 'kunden'
}

let aktuell = lesen()
const hoerer = new Set<() => void>()
let uaUebergang = false

function benachrichtigen() {
  for (const h of hoerer) h()
}

function richtungZwischen(alt: Route, neu: Route): Richtung {
  const a = REIHENFOLGE.indexOf(bereich(alt))
  const b = REIHENFOLGE.indexOf(bereich(neu))
  if (a !== b) return a >= 0 && b >= 0 ? (b > a ? 'tab-vor' : 'tab-zurueck') : 'wechsel'
  const d = tiefe(neu) - tiefe(alt)
  return d > 0 ? 'vor' : d < 0 ? 'zurueck' : 'wechsel'
}

const bewegungArm = () => window.matchMedia('(prefers-reduced-motion: reduce)').matches

function anwenden() {
  const neu = lesen()
  const alt = aktuell
  if (neu.pfad === alt.pfad && neu.suche.toString() === alt.suche.toString()) return
  const richtung = richtungZwischen(alt, neu)
  // Für Browser ohne View Transitions: CSS-Animation nach dieser Richtung (siehe rahmen.css).
  document.documentElement.dataset.letzteRichtung = richtung
  const uebergang = document.startViewTransition
  if (!uebergang || bewegungArm() || uaUebergang || document.visibilityState !== 'visible') {
    uaUebergang = false
    aktuell = neu
    benachrichtigen()
    return
  }
  document.documentElement.dataset.richtung = richtung
  const t = document.startViewTransition(() => {
    flushSync(() => {
      aktuell = neu
      benachrichtigen()
    })
  })
  t.finished.finally(() => {
    delete document.documentElement.dataset.richtung
  })
}

if (typeof window !== 'undefined') {
  if (!document.startViewTransition) document.documentElement.classList.add('ohne-vt')
  // Safari animiert die Wisch-Geste „zurück“ selbst – dann keine zweite Animation.
  window.addEventListener('popstate', (e) => {
    uaUebergang = Boolean((e as PopStateEvent & { hasUAVisualTransition?: boolean }).hasUAVisualTransition)
  })
  window.addEventListener('hashchange', anwenden)
}

export function useRoute(): Route {
  return useSyncExternalStore(
    (h) => {
      hoerer.add(h)
      return () => hoerer.delete(h)
    },
    () => aktuell,
  )
}

export function gehe(pfad: string, ersetzen = false) {
  const ziel = `#${pfad}`
  if (window.location.hash === ziel) return
  if (ersetzen) {
    history.replaceState(null, '', ziel)
    anwenden()
  } else {
    window.location.hash = pfad
  }
}

/** Zurück, wenn es eine vorige Seite der App gibt, sonst zum Ziel. */
export function zurueck(ersatz: string) {
  if (history.state?.app && history.length > 1) history.back()
  else gehe(ersatz, true)
}

// Merkt sich, dass Einträge im Verlauf von der App stammen.
if (typeof window !== 'undefined') {
  window.addEventListener('hashchange', () => {
    if (!history.state?.app) history.replaceState({ app: true }, '')
  })
}
