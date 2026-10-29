import { Camera, ChevronLeft, ChevronRight, ImagePlus, Images, Trash2, UserRound, X } from 'lucide-react'
import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { fotoAlsProfilbild, fotoLoeschen, fotosHinzufuegen, useBildUrl } from '../daten/aktionen.ts'
import type { FotoInfo } from '../daten/typen.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import { datumFormat } from '../lib/hilfen.ts'
import { Bestaetigen } from './Blatt.tsx'
import { zeigeHinweis } from './Kleinteile.tsx'

export function useIstHandy() {
  const [handy, setHandy] = useState(() => !window.matchMedia('(min-width: 1024px)').matches)
  useEffect(() => {
    const m = window.matchMedia('(min-width: 1024px)')
    const f = () => setHandy(!m.matches)
    m.addEventListener('change', f)
    return () => m.removeEventListener('change', f)
  }, [])
  return handy
}

/** Unsichtbare Dateiauswahl: Kamera (Handy) oder Mediathek/Dateien. */
export function useFotoAuswahl(kundeId: string) {
  const t = useT()
  const kamera = useRef<HTMLInputElement>(null)
  const mediathek = useRef<HTMLInputElement>(null)
  const [arbeitet, setArbeitet] = useState(false)

  const verarbeiten = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const dateien = Array.from(e.target.files ?? [])
    e.target.value = ''
    if (!dateien.length) return
    setArbeitet(true)
    try {
      const n = await fotosHinzufuegen(kundeId, dateien)
      if (n) zeigeHinweis(t.fotos.gespeichert(n))
    } finally {
      setArbeitet(false)
    }
  }

  const eingaben = (
    <>
      <input ref={kamera} type="file" accept="image/*" capture="environment" hidden onChange={verarbeiten} />
      <input ref={mediathek} type="file" accept="image/*" multiple hidden onChange={verarbeiten} />
    </>
  )
  return {
    eingaben,
    arbeitet,
    aufnehmen: () => kamera.current?.click(),
    auswaehlen: () => mediathek.current?.click(),
  }
}

export function FotoKnoepfe({ kundeId, kompakt }: { kundeId: string; kompakt?: boolean }) {
  const t = useT()
  const handy = useIstHandy()
  const { eingaben, arbeitet, aufnehmen, auswaehlen } = useFotoAuswahl(kundeId)
  return (
    <div className="fotoknoepfe">
      {eingaben}
      {handy && (
        <button type="button" className={`knopf knopf--primaer ${kompakt ? 'knopf--klein' : ''}`} onClick={aufnehmen} disabled={arbeitet}>
          {arbeitet ? <span className="knopf__dreher" /> : <Camera size={18} />}
          {t.fotos.aufnehmen}
        </button>
      )}
      <button
        type="button"
        className={`knopf ${handy ? 'knopf--sanft' : 'knopf--primaer'} ${kompakt ? 'knopf--klein' : ''}`}
        onClick={auswaehlen}
        disabled={arbeitet}
      >
        {arbeitet && !handy ? <span className="knopf__dreher" /> : <ImagePlus size={18} />}
        {handy ? t.fotos.auswaehlen : t.fotos.hochladen}
      </button>
    </div>
  )
}

export function Vorschau({ foto, onClick }: { foto: FotoInfo; onClick?: () => void }) {
  const url = useBildUrl(foto.vorschauPfad)
  return (
    <button type="button" className="vorschau" onClick={onClick}>
      {url ? <img src={url} alt="" loading="lazy" draggable={false} /> : <span className="vorschau__platz skelett" />}
    </button>
  )
}

/** Kachel: immer 4 Fotos (2 × 2) auf einmal, horizontal weiterwischen. */
export function FotoKachel({ fotos, oeffnen, kopf }: { fotos: FotoInfo[]; oeffnen: (i: number) => void; kopf?: ReactNode }) {
  const t = useT()
  const spur = useRef<HTMLDivElement>(null)
  const [seite, setSeite] = useState(0)
  const seiten: FotoInfo[][] = []
  for (let i = 0; i < fotos.length; i += 4) seiten.push(fotos.slice(i, i + 4))

  const scrollen = () => {
    const el = spur.current
    if (el) setSeite(Math.round(el.scrollLeft / el.clientWidth))
  }
  const zu = (s: number) => spur.current?.scrollTo({ left: s * spur.current.clientWidth, behavior: 'smooth' })

  return (
    <div className="fotokachel">
      {kopf}
      {fotos.length === 0 ? (
        <div className="fotokachel__leer">
          <Images size={26} />
          <span>{t.fotos.leer}</span>
        </div>
      ) : (
        <>
          <div className="fotokachel__spur" ref={spur} onScroll={scrollen}>
            {seiten.map((s, si) => (
              <div className="fotokachel__seite" key={si}>
                {s.map((f, fi) => (
                  <Vorschau key={f.id} foto={f} onClick={() => oeffnen(si * 4 + fi)} />
                ))}
              </div>
            ))}
          </div>
          {seiten.length > 1 && (
            <div className="fotokachel__punkte">
              <button type="button" className="symbol" onClick={() => zu(Math.max(0, seite - 1))} disabled={seite === 0} aria-label={t.allgemein.zurueck}>
                <ChevronLeft size={18} />
              </button>
              {seiten.map((_, i) => (
                <button key={i} type="button" className={`punkt ${i === seite ? 'punkt--aktiv' : ''}`} onClick={() => zu(i)} aria-label={`${i + 1}`} />
              ))}
              <button
                type="button"
                className="symbol"
                onClick={() => zu(Math.min(seiten.length - 1, seite + 1))}
                disabled={seite === seiten.length - 1}
                aria-label={t.allgemein.weiter}
              >
                <ChevronRight size={18} />
              </button>
            </div>
          )}
        </>
      )}
    </div>
  )
}

function GrossesFoto({ foto, nah }: { foto: FotoInfo; nah: boolean }) {
  const klein = useBildUrl(foto.vorschauPfad)
  const gross = useBildUrl(nah ? foto.pfad : null)
  return (
    <div className="lichtbox__bild">
      {(gross ?? klein) ? <img src={gross ?? klein!} alt="" draggable={false} className={gross ? '' : 'lichtbox__unscharf'} /> : <span className="knopf__dreher" />}
    </div>
  )
}

/** Vollbild-Ansicht mit Wischen, Löschen und „Als Profilbild“. */
export function Lichtbox({ fotos, start, schliessen }: { fotos: FotoInfo[]; start: number; schliessen: () => void }) {
  const t = useT()
  const gebiet = useGebiet()
  const spur = useRef<HTMLDivElement>(null)
  const [index, setIndex] = useState(start)
  const [frage, setFrage] = useState(false)
  const foto = fotos[Math.min(index, fotos.length - 1)]

  useEffect(() => {
    const el = spur.current
    if (el) el.scrollLeft = start * el.clientWidth
  }, [start])

  useEffect(() => {
    if (!fotos.length) schliessen()
  }, [fotos.length, schliessen])

  const zu = useCallback((i: number) => {
    const el = spur.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }, [])

  useEffect(() => {
    const taste = (e: KeyboardEvent) => {
      if (e.key === 'Escape') schliessen()
      if (e.key === 'ArrowRight') zu(Math.min(fotos.length - 1, index + 1))
      if (e.key === 'ArrowLeft') zu(Math.max(0, index - 1))
    }
    document.addEventListener('keydown', taste)
    document.documentElement.classList.add('gesperrt')
    return () => {
      document.removeEventListener('keydown', taste)
      document.documentElement.classList.remove('gesperrt')
    }
  }, [index, fotos.length, schliessen, zu])

  if (!foto) return null
  return createPortal(
    <div className="lichtbox" role="dialog" aria-modal="true">
      <div className="lichtbox__leiste">
        <button type="button" className="lichtbox__knopf" onClick={schliessen} aria-label={t.allgemein.schliessen}>
          <X size={22} />
        </button>
        <span className="lichtbox__datum">
          {datumFormat(new Date(foto.zeit).toISOString(), gebiet, 'lang')} · {index + 1}/{fotos.length}
        </span>
        <span />
      </div>
      <div className="lichtbox__spur" ref={spur} onScroll={(e) => setIndex(Math.round(e.currentTarget.scrollLeft / e.currentTarget.clientWidth))}>
        {fotos.map((f, i) => (
          <GrossesFoto key={f.id} foto={f} nah={Math.abs(i - index) <= 1} />
        ))}
      </div>
      <div className="lichtbox__aktionen">
        <button
          type="button"
          className="lichtbox__aktion"
          onClick={async () => {
            if (await fotoAlsProfilbild(foto)) zeigeHinweis(t.kunde.gespeichert)
          }}
        >
          <UserRound size={20} />
          {t.fotos.alsProfilbild}
        </button>
        <button type="button" className="lichtbox__aktion lichtbox__aktion--gefahr" onClick={() => setFrage(true)}>
          <Trash2 size={20} />
          {t.allgemein.loeschen}
        </button>
      </div>
      <Bestaetigen
        offen={frage}
        titel={t.fotos.loeschenFrage}
        knopf={t.allgemein.loeschen}
        nein={() => setFrage(false)}
        ja={() => {
          setFrage(false)
          fotoLoeschen(foto.pfad, foto.vorschauPfad)
        }}
      />
    </div>,
    document.body,
  )
}
