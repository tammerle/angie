import { Camera, Images, KeyRound, Lock, LogOut, User, UserX } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { SALON } from '../konfig.ts'
import { benutzerAvatarSetzen, profilAendern, statusSetzen, useDaten } from '../daten/aktionen.ts'
import { abmelden, passwortAendern, useSitzung } from '../daten/sitzung.ts'
import { PFAD } from '../daten/typen.ts'
import { useT } from '../i18n/index.ts'
import { BenutzerAvatar } from '../ui/Avatar.tsx'
import { Blatt } from '../ui/Blatt.tsx'
import { Feld, PasswortFeld } from '../ui/Felder.tsx'
import { useIstHandy } from '../ui/Fotos.tsx'
import { zeigeHinweis } from '../ui/Kleinteile.tsx'
import { StatusWahl } from '../ui/Status.tsx'

function PasswortKarte() {
  const t = useT()
  const [alt, setAlt] = useState('')
  const [neu, setNeu] = useState('')
  const [wdh, setWdh] = useState('')
  const [fehler, setFehler] = useState<{ feld: 'alt' | 'neu' | 'wdh' | 'allg'; text: string } | null>(null)
  const [arbeitet, setArbeitet] = useState(false)

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (neu.length < 8) return setFehler({ feld: 'neu', text: t.profil.passwortKurz })
    if (neu !== wdh) return setFehler({ feld: 'wdh', text: t.profil.passwortUngleich })
    if (neu === alt) return setFehler({ feld: 'neu', text: t.profil.passwortGleich })
    setFehler(null)
    setArbeitet(true)
    const ergebnis = await passwortAendern(alt, neu)
    setArbeitet(false)
    if (ergebnis === 'ok') {
      setAlt('')
      setNeu('')
      setWdh('')
      zeigeHinweis(t.profil.passwortGeaendert)
    } else if (ergebnis === 'falsch') setFehler({ feld: 'alt', text: t.profil.passwortFalsch })
    else if (ergebnis === 'netz') setFehler({ feld: 'allg', text: t.profil.passwortOffline })
    else if (ergebnis === 'getrennt') setFehler({ feld: 'allg', text: t.profil.passwortGetrennt })
    else setFehler({ feld: 'allg', text: t.einrichtung.fehlerZugang })
  }

  const p = { zeigen: t.anmelden.zeigen, verbergen: t.anmelden.verbergen }
  return (
    <section className="karte">
      <div className="karte__kopf">
        <h3 className="karte__titel">
          <KeyRound size={20} /> {t.profil.passwortTitel}
        </h3>
      </div>
      <form className="karte__inhalt formular" onSubmit={absenden}>
        <input type="text" name="username" autoComplete="username" value={useSitzung().benutzer ?? ''} readOnly hidden />
        <PasswortFeld
          {...p}
          label={t.profil.passwortAlt}
          symbol={Lock}
          autoComplete="current-password"
          value={alt}
          onChange={(e) => setAlt(e.target.value)}
          fehler={fehler?.feld === 'alt' ? fehler.text : null}
        />
        <PasswortFeld
          {...p}
          label={t.profil.passwortNeu}
          symbol={KeyRound}
          autoComplete="new-password"
          value={neu}
          onChange={(e) => setNeu(e.target.value)}
          fehler={fehler?.feld === 'neu' ? fehler.text : null}
          hinweis={t.profil.passwortHinweis}
        />
        <PasswortFeld
          {...p}
          label={t.profil.passwortWdh}
          symbol={KeyRound}
          autoComplete="new-password"
          value={wdh}
          onChange={(e) => setWdh(e.target.value)}
          fehler={fehler?.feld === 'wdh' ? fehler.text : null}
        />
        {fehler?.feld === 'allg' && <p className="feld__fehler">{fehler.text}</p>}
        <div className="zeile-rechts">
          <button type="submit" className="knopf knopf--primaer" disabled={arbeitet || !alt || !neu || !wdh}>
            {arbeitet ? <span className="knopf__dreher" /> : <KeyRound size={17} />}
            {t.profil.passwortKnopf}
          </button>
        </div>
      </form>
    </section>
  )
}

export function Profil() {
  const t = useT()
  const handy = useIstHandy()
  const { benutzer, anzeigenamen } = useSitzung()
  const { profile, bildStand } = useDaten()
  const profil = benutzer ? profile.get(benutzer) : undefined
  const anzeige = profil?.anzeigename ?? (benutzer ? anzeigenamen[benutzer] : '') ?? ''
  const [name, setName] = useState(anzeige)
  const [rolle, setRolle] = useState(profil?.rolle ?? '')
  const [bildBlatt, setBildBlatt] = useState(false)
  const kamera = useRef<HTMLInputElement>(null)
  const datei = useRef<HTMLInputElement>(null)

  useEffect(() => {
    setName(anzeige)
    setRolle(profil?.rolle ?? '')
  }, [anzeige, profil?.rolle])

  if (!benutzer) return null
  const hatBild = bildStand.has(PFAD.benutzerAvatar(benutzer))
  const geaendert = profil && (name.trim() !== profil.anzeigename || rolle.trim() !== profil.rolle)

  const bildWaehlen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    setBildBlatt(false)
    if (f) {
      await benutzerAvatarSetzen(f)
      zeigeHinweis(t.profil.gespeichert)
    }
  }

  return (
    <div className="seite profil">
      <section className="karte profilkopf erscheinen">
        <div className="kundenkopf__avatar">
          <BenutzerAvatar name={benutzer} anzeigename={anzeige} groesse={handy ? 96 : 120} />
          <button type="button" className="kundenkopf__kamera" onClick={() => setBildBlatt(true)} aria-label={t.profil.bildAendern}>
            <Camera size={16} />
          </button>
        </div>
        <div>
          <h1>{anzeige}</h1>
          <p className="gedaempft">{t.profil.salonRolle(profil?.rolle || 'Inhaberin', SALON)}</p>
          <p className="leise">@{benutzer}</p>
        </div>
      </section>

      <div className="profil__raster">
        <section className="karte">
          <div className="karte__kopf">
            <h3 className="karte__titel">{t.status.titel}</h3>
          </div>
          <div className="karte__inhalt">
            <StatusWahl status={profil?.status ?? null} waehlen={(s) => statusSetzen(s)} />
          </div>
        </section>

        <div className="profil__spalte">
          <section className="karte">
            <div className="karte__kopf">
              <h3 className="karte__titel">
                <User size={20} /> {t.profil.daten}
              </h3>
            </div>
            <form
              className="karte__inhalt formular"
              onSubmit={(e) => {
                e.preventDefault()
                if (!name.trim()) return
                profilAendern({ anzeigename: name.trim(), rolle: rolle.trim() })
                zeigeHinweis(t.profil.gespeichert)
              }}
            >
              <Feld label={t.profil.anzeigename} value={name} onChange={(e) => setName(e.target.value)} maxLength={30} />
              <Feld label={t.profil.rolle} value={rolle} onChange={(e) => setRolle(e.target.value)} maxLength={40} />
              <Feld label={t.profil.benutzername} value={benutzer} readOnly disabled />
              <div className="zeile-rechts">
                <button type="submit" className="knopf knopf--primaer" disabled={!geaendert || !name.trim()}>
                  {t.allgemein.speichern}
                </button>
              </div>
            </form>
          </section>
          <PasswortKarte />
        </div>
      </div>

      <button type="button" className="knopf knopf--rahmen knopf--breit nur-handy" onClick={abmelden}>
        <LogOut size={18} /> {t.navi.abmelden}
      </button>

      <input ref={kamera} type="file" accept="image/*" capture="user" hidden onChange={bildWaehlen} />
      <input ref={datei} type="file" accept="image/*" hidden onChange={bildWaehlen} />
      <Blatt offen={bildBlatt} schliessen={() => setBildBlatt(false)} titel={t.profil.bildAendern} groesse="s">
        <div className="aktionsliste">
          {handy && (
            <button type="button" className="aktionsliste__eintrag" onClick={() => kamera.current?.click()}>
              <Camera size={20} /> {t.fotos.aufnehmen}
            </button>
          )}
          <button type="button" className="aktionsliste__eintrag" onClick={() => datei.current?.click()}>
            <Images size={20} /> {handy ? t.fotos.auswaehlen : t.fotos.hochladen}
          </button>
          {hatBild && (
            <button
              type="button"
              className="aktionsliste__eintrag aktionsliste__eintrag--gefahr"
              onClick={() => {
                void benutzerAvatarSetzen(null)
                setBildBlatt(false)
              }}
            >
              <UserX size={20} /> {t.profil.bildEntfernen}
            </button>
          )}
        </div>
      </Blatt>
    </div>
  )
}
