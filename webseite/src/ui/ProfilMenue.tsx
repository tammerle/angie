import { LogOut, User } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { statusSetzen, useDaten } from '../daten/aktionen.ts'
import { abmelden, useSitzung } from '../daten/sitzung.ts'
import { useT } from '../i18n/index.ts'
import { gehe, useRoute } from '../lib/router.ts'
import { BenutzerAvatar } from './Avatar.tsx'
import { StatusPille, StatusWahl } from './Status.tsx'

/** Profil-Knopf oben rechts mit Menü: Wohlbefinden, Zu meinem Profil, Abmelden. */
export function ProfilMenue({ mitText }: { mitText?: boolean }) {
  const t = useT()
  const { benutzer, anzeigenamen } = useSitzung()
  const { profile } = useDaten()
  const route = useRoute()
  const [offen, setOffen] = useState(false)
  const [statusOffen, setStatusOffen] = useState(false)
  const huelle = useRef<HTMLDivElement>(null)
  const profil = benutzer ? profile.get(benutzer) : undefined
  const anzeige = profil?.anzeigename ?? (benutzer ? anzeigenamen[benutzer] : '') ?? ''

  useEffect(() => {
    setOffen(false)
  }, [route.pfad])

  useEffect(() => {
    if (!offen) {
      setStatusOffen(false)
      return
    }
    const klick = (e: PointerEvent) => {
      if (!huelle.current?.contains(e.target as Node)) setOffen(false)
    }
    const taste = (e: KeyboardEvent) => e.key === 'Escape' && setOffen(false)
    document.addEventListener('pointerdown', klick)
    document.addEventListener('keydown', taste)
    return () => {
      document.removeEventListener('pointerdown', klick)
      document.removeEventListener('keydown', taste)
    }
  }, [offen])

  if (!benutzer) return null
  return (
    <div className="profilmenue" ref={huelle}>
      <button
        type="button"
        className={mitText ? 'kopfknopf' : 'profilmenue__knopf'}
        aria-expanded={offen}
        aria-haspopup="menu"
        aria-label={t.navi.profil}
        onClick={() => setOffen((o) => !o)}
      >
        <BenutzerAvatar name={benutzer} anzeigename={anzeige} groesse={mitText ? 26 : 34} />
        {mitText && <span>{t.navi.profil}</span>}
      </button>
      {offen && (
        <div className="profilmenue__flaeche" role="menu">
          <div className="profilmenue__status">
            <span className="profilmenue__label">{t.status.titel}</span>
            <StatusPille status={profil?.status ?? null} onClick={() => setStatusOffen((s) => !s)} />
          </div>
          {statusOffen && (
            <div className="profilmenue__wahl erscheinen">
              <StatusWahl
                status={profil?.status ?? null}
                waehlen={(s) => {
                  statusSetzen(s)
                  setStatusOffen(false)
                }}
              />
            </div>
          )}
          <div className="profilmenue__trenner" />
          <button type="button" role="menuitem" className="profilmenue__eintrag" onClick={() => gehe('/profil')}>
            <User size={18} />
            {t.navi.zuMeinemProfil}
          </button>
          <button type="button" role="menuitem" className="profilmenue__eintrag" onClick={abmelden}>
            <LogOut size={18} />
            {t.navi.abmelden}
          </button>
        </div>
      )}
    </div>
  )
}
