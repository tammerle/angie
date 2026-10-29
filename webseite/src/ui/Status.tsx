import {
  AlarmClock,
  Bird,
  Check,
  Coffee,
  Crosshair,
  Frown,
  Gem,
  Heart,
  Hourglass,
  Palmtree,
  Pencil,
  Rocket,
  Scale,
  Search,
  ShieldAlert,
  Smile,
  ThumbsUp,
  TriangleAlert,
  UserMinus,
  Users,
  Wallet,
  Zap,
  type LucideIcon,
} from 'lucide-react'
import { useState } from 'react'
import { STATUS_VORLAGEN, type Status, type StatusVorlage } from '../daten/typen.ts'
import { useT } from '../i18n/index.ts'

export const STATUS_INFO: Record<StatusVorlage, { symbol: LucideIcon; farbe: string }> = {
  sehrGluecklich: { symbol: Smile, farbe: '#2f9e6b' },
  hochmotiviert: { symbol: Rocket, farbe: '#3b6fd8' },
  wertgeschaetzt: { symbol: Heart, farbe: '#d2506f' },
  zufrieden: { symbol: ThumbsUp, farbe: '#3c9a5f' },
  ausgeglichen: { symbol: Scale, farbe: '#5b6f96' },
  fokussiert: { symbol: Crosshair, farbe: '#2e8c8c' },
  urlaubsreif: { symbol: Palmtree, farbe: '#c08a1e' },
  ueberlastet: { symbol: AlarmClock, farbe: '#d0543f' },
  unzufrieden: { symbol: Frown, farbe: '#c9504a' },
  unterfordert: { symbol: Hourglass, farbe: '#7c6ba8' },
  chefNervt: { symbol: TriangleAlert, farbe: '#d0792a' },
  teamStress: { symbol: Users, farbe: '#d37a35' },
  gehaltFrustriert: { symbol: Wallet, farbe: '#a67c3b' },
  ungerecht: { symbol: ShieldAlert, farbe: '#c2473f' },
  alleinGestellt: { symbol: UserMinus, farbe: '#6b7a8f' },
  sucheArbeit: { symbol: Search, farbe: '#5d63c4' },
  gucci: { symbol: Gem, farbe: '#b8902f' },
  aufKaffee: { symbol: Coffee, farbe: '#8b5e3c' },
  aufRedbull: { symbol: Zap, farbe: '#2d5bb5' },
  fly: { symbol: Bird, farbe: '#1e9bc9' },
}

const EIGEN_FARBE = '#9a5bc9'

export function StatusPille({
  status,
  aktiv,
  onClick,
  klein,
}: {
  status: Pick<Status, 'art' | 'schluessel' | 'text'> | null
  aktiv?: boolean
  onClick?: () => void
  klein?: boolean
}) {
  const t = useT()
  const info = status?.art === 'vorlage' && status.schluessel ? STATUS_INFO[status.schluessel] : null
  const Symbol = info?.symbol ?? (status ? Pencil : Smile)
  const text = !status
    ? t.status.keiner
    : status.art === 'vorlage' && status.schluessel
      ? t.status.vorlagen[status.schluessel]
      : status.text || t.status.eigen
  const farbe = info?.farbe ?? (status ? EIGEN_FARBE : '#8c7a83')
  const inhalt = (
    <>
      {aktiv ? <Check size={klein ? 13 : 15} /> : <Symbol size={klein ? 13 : 15} />}
      <span className="pille__text">{text}</span>
    </>
  )
  const klassen = `pille ${aktiv ? 'pille--aktiv' : ''} ${klein ? 'pille--klein' : ''}`
  const stil = { '--c': farbe } as React.CSSProperties
  return onClick ? (
    <button type="button" className={klassen} style={stil} onClick={onClick} aria-pressed={aktiv}>
      {inhalt}
    </button>
  ) : (
    <span className={klassen} style={stil}>
      {inhalt}
    </span>
  )
}

/** Auswahl wie im Vorbild: farbige Knöpfe, dazu „Eigen“ mit freiem Text. */
export function StatusWahl({ status, waehlen }: { status: Status | null; waehlen: (s: Omit<Status, 'gesetztAm'>) => void }) {
  const t = useT()
  const [eigen, setEigen] = useState(status?.art === 'eigen' ? status.text : '')
  const [eigenOffen, setEigenOffen] = useState(false)
  return (
    <div className="statuswahl">
      <div className="statuswahl__raster">
        {STATUS_VORLAGEN.map((s) => (
          <StatusPille
            key={s}
            status={{ art: 'vorlage', schluessel: s, text: '' }}
            aktiv={status?.art === 'vorlage' && status.schluessel === s}
            onClick={() => waehlen({ art: 'vorlage', schluessel: s, text: '' })}
          />
        ))}
        <StatusPille
          status={{ art: 'eigen', schluessel: null, text: status?.art === 'eigen' ? status.text : t.status.eigen }}
          aktiv={status?.art === 'eigen'}
          onClick={() => setEigenOffen((o) => !o)}
        />
      </div>
      {eigenOffen && (
        <form
          className="statuswahl__eigen erscheinen"
          onSubmit={(e) => {
            e.preventDefault()
            if (!eigen.trim()) return
            waehlen({ art: 'eigen', schluessel: null, text: eigen.trim().slice(0, 40) })
            setEigenOffen(false)
          }}
        >
          <input
            className="eingabe"
            value={eigen}
            maxLength={40}
            placeholder={t.status.eigenFeld}
            onChange={(e) => setEigen(e.target.value)}
            autoFocus
          />
          <button className="knopf knopf--primaer" type="submit" disabled={!eigen.trim()}>
            {t.allgemein.speichern}
          </button>
        </form>
      )}
    </div>
  )
}
