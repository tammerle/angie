import { Check, CloudOff, LoaderCircle, TriangleAlert, type LucideIcon } from 'lucide-react'
import { useLayoutEffect, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useDaten } from '../daten/aktionen.ts'
import { gehe } from '../lib/router.ts'
import { useT } from '../i18n/index.ts'

// ---------- Hinweise (Toasts) ----------

interface Hinweis {
  id: number
  text: string
  art: 'ok' | 'fehler'
}

let hinweise: Hinweis[] = []
const hinweisHoerer = new Set<() => void>()
let hinweisId = 1

export function zeigeHinweis(text: string, art: Hinweis['art'] = 'ok') {
  const h = { id: hinweisId++, text, art }
  hinweise = [...hinweise.slice(-2), h]
  hinweisHoerer.forEach((f) => f())
  setTimeout(() => {
    hinweise = hinweise.filter((x) => x.id !== h.id)
    hinweisHoerer.forEach((f) => f())
  }, 2600)
}

export function Hinweise() {
  const liste = useSyncExternalStore(
    (f) => {
      hinweisHoerer.add(f)
      return () => hinweisHoerer.delete(f)
    },
    () => hinweise,
  )
  return (
    <div className="hinweise" aria-live="polite">
      {liste.map((h) => (
        <div key={h.id} className={`hinweis hinweis--${h.art}`}>
          {h.art === 'ok' ? <Check size={17} /> : <TriangleAlert size={17} />}
          {h.text}
        </div>
      ))}
    </div>
  )
}

// ---------- Leerer Zustand ----------

export function Leer({ symbol: S, titel, text, children }: { symbol: LucideIcon; titel: string; text?: string; children?: ReactNode }) {
  return (
    <div className="leer erscheinen">
      <span className="leer__symbol">
        <S size={28} />
      </span>
      <p className="leer__titel">{titel}</p>
      {text && <p className="leer__text">{text}</p>}
      {children}
    </div>
  )
}

// ---------- Reiter mit gleitender Linie ----------

export function Reiter<T extends string>({
  reiter,
  wert,
  aendern,
}: {
  reiter: { wert: T; text: string }[]
  wert: T
  aendern: (w: T) => void
}) {
  const leiste = useRef<HTMLDivElement>(null)
  const [linie, setLinie] = useState({ x: 0, b: 0 })
  useLayoutEffect(() => {
    const messen = () => {
      const el = leiste.current?.querySelector<HTMLElement>('[aria-selected="true"]')
      if (el) setLinie({ x: el.offsetLeft, b: el.offsetWidth })
    }
    messen()
    const ro = new ResizeObserver(messen)
    if (leiste.current) ro.observe(leiste.current)
    return () => ro.disconnect()
  }, [wert, reiter])
  return (
    <div className="reiter" role="tablist" ref={leiste}>
      {reiter.map((r) => (
        <button key={r.wert} role="tab" type="button" className="reiter__knopf" aria-selected={r.wert === wert} onClick={() => aendern(r.wert)}>
          {r.text}
        </button>
      ))}
      <span className="reiter__linie" style={{ transform: `translateX(${linie.x}px)`, width: linie.b }} />
    </div>
  )
}

// ---------- Synchronisationsanzeige ----------

export function SyncAnzeige() {
  const t = useT()
  const { sync } = useDaten()
  const zeige = (klasse: string, text: string, inhalt: ReactNode) => (
    <button type="button" className={`sync ${klasse}`} title={text} aria-label={text} onClick={() => gehe('/einstellungen')}>
      {inhalt}
    </button>
  )
  if (sync.zustand === 'offline') return zeige('sync--offline', t.sync.offline, <CloudOff size={17} />)
  if (sync.zustand === 'fehler' || sync.zustand === 'zugriff')
    return zeige('sync--fehler', sync.zustand === 'zugriff' ? t.sync.zugriff : t.sync.fehler, <TriangleAlert size={17} />)
  if (sync.zustand === 'laeuft' && sync.ausstehend > 0)
    return zeige('', t.sync.laeuft, <LoaderCircle size={17} className="sync__dreh" />)
  return null
}

// ---------- Zeit relativ ----------

export function useRelativeZeit() {
  const t = useT()
  return (iso: string | number | null, absolut: (iso: string) => string) => {
    if (iso == null) return ''
    const ms = typeof iso === 'number' ? iso : new Date(iso).getTime()
    const diff = Date.now() - ms
    if (diff < 60_000) return t.zeit.geradeEben
    if (diff < 3_600_000) return t.zeit.minuten(Math.floor(diff / 60_000))
    if (diff < 6 * 3_600_000) return t.zeit.stunden(Math.floor(diff / 3_600_000))
    return absolut(new Date(ms).toISOString())
  }
}
