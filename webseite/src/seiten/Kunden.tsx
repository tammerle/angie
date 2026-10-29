import { ArrowUpDown, Ellipsis, Pencil, Plus, Search, Trash2, Users } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { kundeLoeschen, useDaten } from '../daten/aktionen.ts'
import type { Kunde } from '../daten/typen.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import { datumFormat, suchtext, vollerName } from '../lib/hilfen.ts'
import { gehe, useRoute } from '../lib/router.ts'
import { KundenAvatar } from '../ui/Avatar.tsx'
import { useIstHandy } from '../ui/Fotos.tsx'
import { Bestaetigen } from '../ui/Blatt.tsx'
import { Leer, zeigeHinweis } from '../ui/Kleinteile.tsx'
import { KundeDetail } from './KundeDetail.tsx'
import { KundeFormular } from './KundeFormular.tsx'
import { neuerKundeOeffnen } from './Rahmen.tsx'

type Sortierung = 'zuletzt' | 'name'

function useKundenListe(begriff: string, sortierung: Sortierung) {
  const { kunden } = useDaten()
  return useMemo(() => {
    const s = suchtext(begriff.trim())
    const gefiltert = s ? kunden.filter((k) => suchtext(k.vorname, k.nachname, k.telefon, k.email).includes(s)) : kunden
    const nachName = (a: Kunde, b: Kunde) =>
      vollerName(a).localeCompare(vollerName(b), undefined, { sensitivity: 'base' })
    return [...gefiltert].sort((a, b) =>
      sortierung === 'name'
        ? nachName(a, b)
        : (b.letzterBesuch || b.erstelltAm.slice(0, 10)).localeCompare(a.letzterBesuch || a.erstelltAm.slice(0, 10)) || nachName(a, b),
    )
  }, [kunden, begriff, sortierung])
}

// Nur der zuletzt geöffnete Eintrag bekommt einen Übergangsnamen – so bleibt
// der Seitenwechsel auch bei vielen Kunden leicht.
let zuletztGeoeffnet: string | null = null

/** „⋯“ an jedem Eintrag: Bearbeiten und Löschen direkt aus der Liste. */
function EintragMenue({ bearbeiten, loeschen }: { bearbeiten: () => void; loeschen: () => void }) {
  const t = useT()
  const [offen, setOffen] = useState(false)
  const huelle = useRef<HTMLDivElement>(null)
  useEffect(() => {
    if (!offen) return
    const klick = (e: PointerEvent) => !huelle.current?.contains(e.target as Node) && setOffen(false)
    document.addEventListener('pointerdown', klick)
    return () => document.removeEventListener('pointerdown', klick)
  }, [offen])
  return (
    <div className="kleinmenue kundeneintrag__menue" ref={huelle}>
      <button type="button" className="symbol" onClick={() => setOffen((o) => !o)} aria-label={t.kunde.mehr} aria-expanded={offen}>
        <Ellipsis size={18} />
      </button>
      {offen && (
        <div className="kleinmenue__flaeche erscheinen">
          <button
            type="button"
            onClick={() => {
              setOffen(false)
              bearbeiten()
            }}
          >
            <Pencil size={16} /> {t.allgemein.bearbeiten}
          </button>
          <button
            type="button"
            className="kleinmenue__gefahr"
            onClick={() => {
              setOffen(false)
              loeschen()
            }}
          >
            <Trash2 size={16} /> {t.allgemein.loeschen}
          </button>
        </div>
      )}
    </div>
  )
}

function Eintrag({
  kunde,
  aktiv,
  handy,
  bearbeiten,
  loeschen,
}: {
  kunde: Kunde
  aktiv: boolean
  handy: boolean
  bearbeiten: () => void
  loeschen: () => void
}) {
  const t = useT()
  const gebiet = useGebiet()
  const besuch = kunde.letzterBesuch ? datumFormat(kunde.letzterBesuch, gebiet) : ''
  return (
    <li className="kundeneintrag-huelle">
      <EintragMenue bearbeiten={bearbeiten} loeschen={loeschen} />
      <button
        type="button"
        className={`kundeneintrag ${aktiv ? 'ist-aktiv' : ''}`}
        onClick={(e) => {
          if (handy) {
            zuletztGeoeffnet = kunde.id
            const avatar = e.currentTarget.querySelector<HTMLElement>('.avatar')
            avatar?.style.setProperty('--vt', `kunde-${kunde.id}`)
            avatar?.classList.add('avatar--vt')
          }
          gehe(`/kunden/${kunde.id}`)
        }}
        aria-current={aktiv ? 'true' : undefined}
      >
        <KundenAvatar kunde={kunde} groesse={handy ? 50 : 40} uebergang={handy && kunde.id === zuletztGeoeffnet} />
        <span className="kundeneintrag__text">
          <strong>{vollerName(kunde)}</strong>
          {kunde.telefon && <small>{kunde.telefon}</small>}
          {handy && <small className="kundeneintrag__besuch">{besuch ? `${t.kunden.letzterBesuch}: ${besuch}` : t.kunden.keinBesuch}</small>}
        </span>
        {!handy && besuch && (
          <span className="kundeneintrag__datum">
            {besuch}
            <small>{t.kunden.letzterBesuch}</small>
          </span>
        )}
      </button>
    </li>
  )
}

function KundenListe({ aktivId }: { aktivId?: string }) {
  const t = useT()
  const handy = useIstHandy()
  const { kunden, sync } = useDaten()
  const [begriff, setBegriff] = useState('')
  const [sortierung, setSortierung] = useState<Sortierung>('zuletzt')
  const liste = useKundenListe(begriff, sortierung)
  const laedt = !sync.ersterAbgleich && kunden.length === 0
  const [bearbeiten, setBearbeiten] = useState<Kunde | null>(null)
  const [loeschen, setLoeschen] = useState<Kunde | null>(null)

  return (
    <section className="kundenliste">
      <div className="kundenliste__kopf">
        <h2>
          {t.kunden.titel}
          {kunden.length > 0 && <span className="zaehler">{kunden.length}</span>}
        </h2>
        <button
          type="button"
          className="knopf knopf--geist knopf--klein"
          onClick={() => setSortierung((s) => (s === 'zuletzt' ? 'name' : 'zuletzt'))}
          title={sortierung === 'zuletzt' ? t.kunden.sortName : t.kunden.sortZuletzt}
        >
          <ArrowUpDown size={15} />
          {sortierung === 'zuletzt' ? t.kunden.sortZuletzt : t.kunden.sortName}
        </button>
        <button type="button" className="symbol symbol--akzent" onClick={() => neuerKundeOeffnen()} aria-label={t.navi.neuerKunde}>
          <Plus size={20} />
        </button>
      </div>
      <div className="kundenliste__suche">
        <Search size={18} className="feld__symbol" />
        <input
          className="eingabe eingabe--symbol"
          type="search"
          placeholder={t.kunden.suchen}
          aria-label={t.kunden.suchen}
          value={begriff}
          onChange={(e) => setBegriff(e.target.value)}
        />
      </div>
      {laedt ? (
        <ul className="kundenliste__liste">
          {Array.from({ length: 6 }, (_, i) => (
            <li key={i} className="kundeneintrag kundeneintrag--skelett">
              <span className="skelett" style={{ width: handy ? 50 : 40, height: handy ? 50 : 40, borderRadius: '50%' }} />
              <span className="kundeneintrag__text">
                <span className="skelett" style={{ width: '60%', height: 14 }} />
                <span className="skelett" style={{ width: '40%', height: 11 }} />
              </span>
            </li>
          ))}
        </ul>
      ) : kunden.length === 0 ? (
        <Leer symbol={Users} titel={t.kunden.leerTitel} text={t.kunden.leerText}>
          <button type="button" className="knopf knopf--primaer" onClick={() => neuerKundeOeffnen()}>
            <Plus size={18} /> {t.navi.neuerKunde}
          </button>
        </Leer>
      ) : liste.length === 0 ? (
        <p className="kundenliste__leer">{t.kunden.keineTreffer}</p>
      ) : (
        <ul className="kundenliste__liste">
          {liste.map((k) => (
            <Eintrag
              key={k.id}
              kunde={k}
              aktiv={k.id === aktivId}
              handy={handy}
              bearbeiten={() => setBearbeiten(k)}
              loeschen={() => setLoeschen(k)}
            />
          ))}
        </ul>
      )}
      <KundeFormular
        offen={!!bearbeiten}
        kunde={bearbeiten ?? undefined}
        schliessen={() => setBearbeiten(null)}
        loeschen={() => {
          setLoeschen(bearbeiten)
          setBearbeiten(null)
        }}
      />
      <Bestaetigen
        offen={!!loeschen}
        titel={loeschen ? t.kunde.loeschenFrage(vollerName(loeschen)) : ''}
        text={t.kunde.loeschenText}
        knopf={t.allgemein.loeschen}
        nein={() => setLoeschen(null)}
        ja={() => {
          if (!loeschen) return
          kundeLoeschen(loeschen.id)
          zeigeHinweis(t.kunde.geloescht)
          if (aktivId === loeschen.id) gehe('/kunden', true)
          setLoeschen(null)
        }}
      />
    </section>
  )
}

export function Kunden() {
  const t = useT()
  const route = useRoute()
  const handy = useIstHandy()
  const id = route.teile[1]
  const reiter = route.teile[2]

  if (handy) return id ? <KundeDetail id={id} reiter={reiter} /> : <KundenListe />

  return (
    <div className="geteilt">
      <aside className="geteilt__seite">
        <KundenListe aktivId={id} />
      </aside>
      <div className="geteilt__haupt">
        {id ? (
          <KundeDetail key={id} id={id} reiter={reiter} />
        ) : (
          <Leer symbol={Users} titel={t.kunden.titel} text={t.kunden.waehlen}>
            <button type="button" className="knopf knopf--primaer" onClick={() => neuerKundeOeffnen()}>
              <Plus size={18} /> {t.navi.neuerKunde}
            </button>
          </Leer>
        )}
      </div>
    </div>
  )
}
