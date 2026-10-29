import { ArrowLeft, LayoutDashboard, LogOut, NotebookPen, Search, Settings, UserPlus, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react'
import { useDaten } from '../daten/aktionen.ts'
import { abmelden } from '../daten/sitzung.ts'
import { useT } from '../i18n/index.ts'
import { suchtext, vollerName } from '../lib/hilfen.ts'
import { gehe, useRoute, zurueck } from '../lib/router.ts'
import { KundenAvatar } from '../ui/Avatar.tsx'
import { SyncAnzeige } from '../ui/Kleinteile.tsx'
import { Logo } from '../ui/Logo.tsx'
import { ProfilMenue } from '../ui/ProfilMenue.tsx'

// „Neuer Kunde“ kann von überall geöffnet werden (Kopf, untere Leiste, Liste).
let neuOffen = false
const neuHoerer = new Set<() => void>()
export function neuerKundeOeffnen(offen = true) {
  neuOffen = offen
  neuHoerer.forEach((h) => h())
}
export function useNeuerKunde() {
  return useSyncExternalStore(
    (h) => {
      neuHoerer.add(h)
      return () => neuHoerer.delete(h)
    },
    () => neuOffen,
  )
}

function Schnellsuche() {
  const t = useT()
  const { kunden, notizen } = useDaten()
  const [begriff, setBegriff] = useState('')
  const [offen, setOffen] = useState(false)
  const [auswahl, setAuswahl] = useState(0)
  const huelle = useRef<HTMLDivElement>(null)

  const treffer = useMemo(() => {
    const s = suchtext(begriff.trim())
    if (!s) return []
    const k = kunden
      .filter((x) => suchtext(x.vorname, x.nachname, x.telefon, x.email).includes(s))
      .slice(0, 6)
      .map((x) => ({ art: 'kunde' as const, id: x.id, titel: vollerName(x), unter: x.telefon, kunde: x }))
    const n = notizen
      .filter((x) => suchtext(x.titel, x.inhalt).includes(s))
      .slice(0, 4)
      .map((x) => ({ art: 'notiz' as const, id: x.id, titel: x.titel || t.notizen.ohneTitel, unter: x.inhalt.slice(0, 60), kunde: null }))
    return [...k, ...n]
  }, [begriff, kunden, notizen, t])

  useEffect(() => {
    const klick = (e: PointerEvent) => !huelle.current?.contains(e.target as Node) && setOffen(false)
    document.addEventListener('pointerdown', klick)
    return () => document.removeEventListener('pointerdown', klick)
  }, [])

  const oeffnen = (i: number) => {
    const x = treffer[i]
    if (!x) return
    gehe(x.art === 'kunde' ? `/kunden/${x.id}` : `/notizen/${x.id}`)
    setBegriff('')
    setOffen(false)
  }

  return (
    <div className="schnellsuche" ref={huelle}>
      <Search size={18} className="schnellsuche__symbol" />
      <input
        className="eingabe eingabe--symbol schnellsuche__feld"
        type="search"
        placeholder={t.kunden.kopfSuche}
        aria-label={t.kunden.kopfSuche}
        value={begriff}
        onChange={(e) => {
          setBegriff(e.target.value)
          setOffen(true)
          setAuswahl(0)
        }}
        onFocus={() => setOffen(true)}
        onKeyDown={(e) => {
          if (e.key === 'ArrowDown') setAuswahl((a) => Math.min(treffer.length - 1, a + 1))
          if (e.key === 'ArrowUp') setAuswahl((a) => Math.max(0, a - 1))
          if (e.key === 'Enter') oeffnen(auswahl)
          if (e.key === 'Escape') setOffen(false)
        }}
      />
      {offen && begriff.trim() && (
        <div className="schnellsuche__liste erscheinen">
          {treffer.length === 0 && <p className="schnellsuche__leer">{t.kunden.keineTreffer}</p>}
          {treffer.map((x, i) => (
            <button
              key={`${x.art}-${x.id}`}
              type="button"
              className={`schnellsuche__treffer ${i === auswahl ? 'ist-aktiv' : ''}`}
              onMouseEnter={() => setAuswahl(i)}
              onClick={() => oeffnen(i)}
            >
              {x.kunde ? (
                <KundenAvatar kunde={x.kunde} groesse={32} />
              ) : (
                <span className="schnellsuche__notiz">
                  <NotebookPen size={16} />
                </span>
              )}
              <span className="schnellsuche__text">
                <strong>{x.titel}</strong>
                {x.unter && <small>{x.unter}</small>}
              </span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

function KopfKnopf({ symbol: S, text, aktiv, onClick }: { symbol: typeof Users; text: string; aktiv?: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`kopfknopf ${aktiv ? 'ist-aktiv' : ''}`} onClick={onClick} aria-current={aktiv ? 'page' : undefined}>
      <S size={22} strokeWidth={1.7} />
      <span>{text}</span>
    </button>
  )
}

function bereichVon(pfad: string) {
  return pfad.split('/')[1] ?? 'kunden'
}

/** Rückweg auf dem Handy: Detailseiten haben einen Zurück-Pfeil. */
function rueckZiel(teile: string[]): string | null {
  if ((teile[0] === 'kunden' || teile[0] === 'notizen') && teile[1]) return `/${teile[0]}`
  return null
}

const NAVI = [
  { id: 'kunden', symbol: Users, ziel: '/kunden' },
  { id: 'uebersicht', symbol: LayoutDashboard, ziel: '/uebersicht' },
  { id: 'notizen', symbol: NotebookPen, ziel: '/notizen' },
  { id: 'einstellungen', symbol: Settings, ziel: '/einstellungen' },
] as const

export function Rahmen({ children }: { children: ReactNode }) {
  const t = useT()
  const route = useRoute()
  const bereich = bereichVon(route.pfad)
  const naviIndex = NAVI.findIndex((n) => n.id === bereich)
  const ziel = rueckZiel(route.teile)

  return (
    <div className="rahmen">
      <header className="kopf">
        <div className="kopf__links">
          {ziel && (
            <button type="button" className="symbol kopf__zurueck nur-handy" onClick={() => zurueck(ziel)} aria-label={t.allgemein.zurueck}>
              <ArrowLeft size={22} />
            </button>
          )}
          <button type="button" className="kopf__logo" onClick={() => gehe('/kunden')} aria-label={t.navi.kunden}>
            <Logo />
          </button>
        </div>
        <div className="kopf__mitte nur-desktop">
          <Schnellsuche />
        </div>
        <nav className="kopf__rechts">
          <SyncAnzeige />
          <div className="nur-desktop kopf__knoepfe">
            <KopfKnopf symbol={Users} text={t.navi.kunden} aktiv={bereich === 'kunden'} onClick={() => gehe('/kunden')} />
            <KopfKnopf symbol={LayoutDashboard} text={t.navi.uebersicht} aktiv={bereich === 'uebersicht'} onClick={() => gehe('/uebersicht')} />
            <KopfKnopf symbol={NotebookPen} text={t.navi.notizen} aktiv={bereich === 'notizen'} onClick={() => gehe('/notizen')} />
            <KopfKnopf symbol={UserPlus} text={t.navi.neuerKunde} onClick={() => neuerKundeOeffnen()} />
            <KopfKnopf symbol={Settings} text={t.navi.einstellungen} aktiv={bereich === 'einstellungen'} onClick={() => gehe('/einstellungen')} />
            <ProfilMenue mitText />
            <KopfKnopf symbol={LogOut} text={t.navi.logout} onClick={abmelden} />
          </div>
          <div className="nur-handy kopf__knoepfe">
            <button
              type="button"
              className={`symbol ${bereich === 'einstellungen' ? 'ist-aktiv' : ''}`}
              onClick={() => gehe('/einstellungen')}
              aria-label={t.navi.einstellungen}
            >
              <Settings size={22} />
            </button>
            <ProfilMenue />
          </div>
        </nav>
      </header>

      <main className="inhalt">
        {/* Neu eingehängt je Bereich: ohne View Transitions spielt so die CSS-Animation. */}
        <div className="wechsel" key={bereich}>
          {children}
        </div>
      </main>

      <nav className="navi nur-handy" aria-label="Navigation">
        <div className="navi__spur">
          {/* Gleitende Markierung hinter dem aktiven Bereich */}
          <span
            className="navi__marke"
            aria-hidden="true"
            style={{ transform: `translateX(${Math.max(0, naviIndex) * 100}%)`, opacity: naviIndex < 0 ? 0 : 1 }}
          />
          {NAVI.map((n) => (
            <button
              key={n.id}
              type="button"
              className={`navi__knopf ${bereich === n.id ? 'ist-aktiv' : ''}`}
              aria-current={bereich === n.id ? 'page' : undefined}
              onClick={() => (bereich === n.id && route.teile.length > 1 ? zurueck(n.ziel) : gehe(n.ziel))}
            >
              <span className="navi__symbol">
                <n.symbol size={22} strokeWidth={bereich === n.id ? 2.1 : 1.7} />
              </span>
              {t.navi[n.id]}
            </button>
          ))}
        </div>
      </nav>
    </div>
  )
}
