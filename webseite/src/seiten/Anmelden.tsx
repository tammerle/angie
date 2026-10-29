import { ClipboardPaste, ExternalLink, KeyRound, Lock, LogOut, ShieldCheck, User } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import { DEMO, SALON } from '../konfig.ts'
import { abmelden, anmelden, einrichten, einrichtungSchliessen, useSitzung, type EinrichtungErgebnis } from '../daten/sitzung.ts'
import { useT } from '../i18n/index.ts'
import { Feld, PasswortFeld } from '../ui/Felder.tsx'
import { Logo } from '../ui/Logo.tsx'

// Hintergrundbilder (falls vorhanden) – fehlt eines, bleibt der Farbverlauf.
const bilder = import.meta.glob<string>('../assets/anmelden/*.webp', { eager: true, query: '?url', import: 'default' })
const bild = (name: string) => bilder[`../assets/anmelden/${name}.webp`]

function Buehne({ children }: { children: ReactNode }) {
  const hoch = bild('anmelden-hoch')
  const quer = bild('anmelden-quer')
  const mini = bild('anmelden-mini')
  const [geladen, setGeladen] = useState(false)
  return (
    <div className="buehne">
      <div className="buehne__bild" aria-hidden="true">
        {mini && <span className="buehne__mini" style={{ backgroundImage: `url(${mini})` }} />}
        {hoch && (
          <picture>
            {quer && <source media="(min-aspect-ratio: 4/5)" srcSet={quer} />}
            <img src={hoch} alt="" className={geladen ? 'ist-geladen' : ''} onLoad={() => setGeladen(true)} fetchPriority="high" />
          </picture>
        )}
      </div>
      <div className="buehne__inhalt">
        <div className="buehne__logo">
          <Logo art="gross" />
        </div>
        {children}
      </div>
    </div>
  )
}

export function Anmelden() {
  const t = useT()
  const [name, setName] = useState(DEMO ? 'angie' : '')
  const [passwort, setPasswort] = useState('')
  const [fehler, setFehler] = useState<string | null>(null)
  const [pruefe, setPruefe] = useState(false)
  const [wackeln, setWackeln] = useState(0)

  const absenden = async (e: React.FormEvent) => {
    e.preventDefault()
    if (pruefe) return
    if (!name.trim() || !passwort) {
      setFehler(t.anmelden.leer)
      setWackeln((w) => w + 1)
      return
    }
    setPruefe(true)
    setFehler(null)
    const ergebnis = await anmelden(name, passwort)
    setPruefe(false)
    if (ergebnis !== 'ok') {
      setFehler(ergebnis === 'falsch' ? t.anmelden.falsch : t.anmelden.keinZugang)
      setPasswort('')
      setWackeln((w) => w + 1)
    }
  }

  return (
    <Buehne>
      <form key={wackeln} className={`anmeldekarte ${wackeln ? 'anmeldekarte--wackeln' : ''}`} onSubmit={absenden} noValidate>
        <h1>{t.anmelden.titel}</h1>
        <p className="anmeldekarte__unter">{t.anmelden.untertitel}</p>
        <div className="anmeldekarte__felder">
          <Feld
            symbol={User}
            placeholder={t.anmelden.benutzername}
            aria-label={t.anmelden.benutzername}
            autoComplete="username"
            autoCapitalize="none"
            autoCorrect="off"
            spellCheck={false}
            value={name}
            onChange={(e) => setName(e.target.value)}
            enterKeyHint="next"
          />
          <PasswortFeld
            symbol={Lock}
            placeholder={t.anmelden.passwort}
            aria-label={t.anmelden.passwort}
            autoComplete="current-password"
            zeigen={t.anmelden.zeigen}
            verbergen={t.anmelden.verbergen}
            value={passwort}
            onChange={(e) => setPasswort(e.target.value)}
            enterKeyHint="go"
          />
        </div>
        {fehler && (
          <p className="anmeldekarte__fehler" role="alert">
            {fehler}
          </p>
        )}
        <button type="submit" className="knopf knopf--primaer knopf--breit anmeldekarte__knopf" disabled={pruefe}>
          {pruefe ? (
            <>
              <span className="knopf__dreher" /> {t.anmelden.pruefe}
            </>
          ) : (
            t.anmelden.knopf
          )}
        </button>
      </form>
      <p className="buehne__fuss">{t.anmelden.willkommen(SALON)}</p>
    </Buehne>
  )
}

const FEHLERTEXT: Record<Exclude<EinrichtungErgebnis, 'ok'>, keyof ReturnType<typeof useT>['einrichtung']> = {
  ungueltig: 'fehlerUngueltig',
  'kein-repo': 'fehlerDaten',
  rechte: 'fehlerZugang',
  netz: 'fehlerNetz',
  abgemeldet: 'fehlerNetz',
}

// Vorausgefülltes Formular für einen Fine-grained Token (Name, Besitzer, Laufzeit, Rechte).
const NEUER_TOKEN =
  'https://github.com/settings/personal-access-tokens/new?name=Salon-Kartei&description=Salon-Kartei%20(angie%20%2B%20angie-daten)&target_name=tammerle&expires_in=none&contents=write'

const SIEHT_AUS_WIE_TOKEN = /^(github_pat_|ghp_)[A-Za-z0-9_]{30,}$/

export function Einrichtung() {
  const t = useT()
  const { einrichtungGrund } = useSitzung()
  const [token, setToken] = useState('')
  const [pruefe, setPruefe] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)

  const pruefen = async (wert: string) => {
    if (!wert.trim() || pruefe) return
    setPruefe(true)
    setFehler(null)
    const ergebnis = await einrichten(wert)
    setPruefe(false)
    if (ergebnis !== 'ok') setFehler(t.einrichtung[FEHLERTEXT[ergebnis]] as string)
  }

  // Eingefügter Schlüssel wird sofort geprüft – kein weiterer Klick nötig.
  const aendern = (wert: string) => {
    setToken(wert)
    if (SIEHT_AUS_WIE_TOKEN.test(wert.trim())) void pruefen(wert)
  }

  const ausZwischenablage = async () => {
    try {
      aendern((await navigator.clipboard.readText()).trim())
    } catch {
      /* kein Zugriff: dann von Hand einfügen */
    }
  }

  return (
    <Buehne>
      <form
        className="anmeldekarte anmeldekarte--breit"
        onSubmit={(e) => {
          e.preventDefault()
          void pruefen(token)
        }}
      >
        <h1>{t.einrichtung.titel}</h1>
        <p className="anmeldekarte__unter">{einrichtungGrund === 'abgelaufen' ? t.einrichtung.abgelaufen : t.einrichtung.text}</p>
        <ol className="schritte">
          <li>
            <strong>{t.einrichtung.schritt1}</strong>
            <span>{t.einrichtung.schritt1Text}</span>
            <a className="textlink" href={NEUER_TOKEN} target="_blank" rel="noreferrer">
              {t.einrichtung.oeffnen} <ExternalLink size={14} />
            </a>
          </li>
          <li>
            <strong>{t.einrichtung.schritt2}</strong>
            <div className="schritte__einfuegen">
              <PasswortFeld
                symbol={KeyRound}
                placeholder={t.einrichtung.feld}
                aria-label={t.einrichtung.feld}
                autoComplete="off"
                zeigen={t.anmelden.zeigen}
                verbergen={t.anmelden.verbergen}
                value={token}
                onChange={(e) => aendern(e.target.value)}
              />
              {'clipboard' in navigator && 'readText' in navigator.clipboard && (
                <button type="button" className="knopf knopf--sanft" onClick={ausZwischenablage} disabled={pruefe}>
                  <ClipboardPaste size={17} /> {t.einrichtung.einfuegen}
                </button>
              )}
            </div>
          </li>
        </ol>
        {fehler && (
          <p className="anmeldekarte__fehler" role="alert">
            {fehler}
          </p>
        )}
        <button type="submit" className="knopf knopf--primaer knopf--breit" disabled={pruefe || !token.trim()}>
          {pruefe ? (
            <>
              <span className="knopf__dreher" /> {t.einrichtung.pruefe}
            </>
          ) : (
            t.einrichtung.knopf
          )}
        </button>
        <p className="schritte__sicher">
          <ShieldCheck size={16} /> {t.einrichtung.sicherheit}
        </p>
        <div className="anmeldekarte__unten">
          {einrichtungGrund === 'erneuern' ? (
            <button type="button" className="knopf knopf--geist knopf--klein" onClick={einrichtungSchliessen}>
              {t.allgemein.abbrechen}
            </button>
          ) : (
            <span />
          )}
          <button type="button" className="knopf knopf--geist knopf--klein" onClick={abmelden}>
            <LogOut size={16} /> {t.navi.abmelden}
          </button>
        </div>
      </form>
    </Buehne>
  )
}
