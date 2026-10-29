import { X } from 'lucide-react'
import { useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { useT } from '../i18n/index.ts'

interface Eigenschaften {
  offen: boolean
  schliessen: () => void
  titel: string
  children: ReactNode
  fuss?: ReactNode
  groesse?: 's' | 'm' | 'l'
}

/** Unten hereinfahrendes Blatt auf dem Handy, Dialog in der Mitte am Computer. */
export function Blatt({ offen, schliessen, titel, children, fuss, groesse = 'm' }: Eigenschaften) {
  const t = useT()
  const [da, setDa] = useState(offen)
  const [zu, setZu] = useState(false)
  const flaeche = useRef<HTMLDivElement>(null)
  const zug = useRef<{ start: number; y: number } | null>(null)

  useEffect(() => {
    if (offen) {
      setDa(true)
      setZu(false)
      return
    }
    if (!da) return
    setZu(true)
    const timer = setTimeout(() => setDa(false), 230)
    return () => clearTimeout(timer)
  }, [offen, da])

  useEffect(() => {
    if (!da) return
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && schliessen()
    document.addEventListener('keydown', taste)
    document.documentElement.classList.add('gesperrt')
    return () => {
      document.removeEventListener('keydown', taste)
      document.documentElement.classList.remove('gesperrt')
    }
  }, [da, schliessen])

  // Nach unten wischen schließt das Blatt (Handy).
  const runter = (e: React.PointerEvent) => {
    if (window.matchMedia('(min-width: 1024px)').matches || (e.target as HTMLElement).closest('button')) return
    zug.current = { start: e.clientY, y: 0 }
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
  }
  const bewegen = (e: React.PointerEvent) => {
    if (!zug.current || !flaeche.current) return
    zug.current.y = Math.max(0, e.clientY - zug.current.start)
    flaeche.current.style.transition = 'none'
    flaeche.current.style.transform = `translateY(${zug.current.y}px)`
  }
  const loslassen = () => {
    if (!zug.current || !flaeche.current) return
    const weit = zug.current.y > 110
    flaeche.current.style.transition = ''
    flaeche.current.style.transform = ''
    zug.current = null
    if (weit) schliessen()
  }

  if (!da) return null
  return createPortal(
    <div className={`blatt ${zu ? 'blatt--zu' : ''}`} role="dialog" aria-modal="true" aria-label={titel}>
      <div className="blatt__hinter" onClick={schliessen} />
      <div className={`blatt__flaeche blatt__flaeche--${groesse}`} ref={flaeche}>
        <div className="blatt__zieh" onPointerDown={runter} onPointerMove={bewegen} onPointerUp={loslassen} onPointerCancel={loslassen}>
          <span className="blatt__griff" />
          <header className="blatt__kopf">
            <h2>{titel}</h2>
            <button type="button" className="symbol" onClick={schliessen} aria-label={t.allgemein.schliessen}>
              <X size={20} />
            </button>
          </header>
        </div>
        <div className="blatt__inhalt">{children}</div>
        {fuss && <footer className="blatt__fuss">{fuss}</footer>}
      </div>
    </div>,
    document.body,
  )
}

export function Bestaetigen({
  offen,
  titel,
  text,
  knopf,
  ja,
  nein,
}: {
  offen: boolean
  titel: string
  text?: string
  knopf: string
  ja: () => void
  nein: () => void
}) {
  const t = useT()
  return (
    <Blatt
      offen={offen}
      schliessen={nein}
      titel={titel}
      groesse="s"
      fuss={
        <>
          <button type="button" className="knopf knopf--rahmen" onClick={nein}>
            {t.allgemein.abbrechen}
          </button>
          <button type="button" className="knopf knopf--gefahr" onClick={ja} autoFocus>
            {knopf}
          </button>
        </>
      }
    >
      {text && <p className="gedaempft">{text}</p>}
    </Blatt>
  )
}
