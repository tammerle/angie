import { ClipboardPaste, CloudCheck, CloudOff, ExternalLink, KeyRound, ShieldCheck } from 'lucide-react'
import { useState } from 'react'
import { useDaten } from '../daten/aktionen.ts'
import { einrichten, type EinrichtungErgebnis } from '../daten/sitzung.ts'
import { useT } from '../i18n/index.ts'
import { PasswortFeld } from './Felder.tsx'
import { zeigeHinweis } from './Kleinteile.tsx'

const FEHLERTEXT: Record<Exclude<EinrichtungErgebnis, 'ok'>, 'fehlerUngueltig' | 'fehlerDaten' | 'fehlerZugang' | 'fehlerNetz'> = {
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

/** Karte in den Einstellungen: GitHub einmalig verbinden oder den Schlüssel erneuern. */
export function GithubVerbindung() {
  const t = useT()
  const { sync } = useDaten()
  const verbunden = sync.zustand !== 'getrennt' && sync.zustand !== 'zugriff'
  const [offen, setOffen] = useState(false)
  const [token, setToken] = useState('')
  const [pruefe, setPruefe] = useState(false)
  const [fehler, setFehler] = useState<string | null>(null)
  const formularZeigen = !verbunden || offen

  const pruefen = async (wert: string) => {
    if (!wert.trim() || pruefe) return
    setPruefe(true)
    setFehler(null)
    const ergebnis = await einrichten(wert)
    setPruefe(false)
    if (ergebnis === 'ok') {
      setToken('')
      setOffen(false)
      zeigeHinweis(t.einrichtung.erfolg)
    } else setFehler(t.einrichtung[FEHLERTEXT[ergebnis]])
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
    <section className="karte">
      <div className="karte__kopf">
        <h3 className="karte__titel">
          {verbunden ? <CloudCheck size={20} /> : <CloudOff size={20} />} {t.einrichtung.karte}
        </h3>
      </div>
      <div className="karte__inhalt verbindung">
        <p className="gedaempft klein">
          {sync.zustand === 'zugriff' ? t.einrichtung.abgelaufen : verbunden ? t.einrichtung.verbunden : t.einrichtung.getrennt}
        </p>
        {verbunden && !offen && (
          <button type="button" className="knopf knopf--rahmen knopf--klein" onClick={() => setOffen(true)}>
            <KeyRound size={15} /> {t.einrichtung.erneuern}
          </button>
        )}
        {formularZeigen && (
          <form
            className="erscheinen"
            onSubmit={(e) => {
              e.preventDefault()
              void pruefen(token)
            }}
          >
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
              <p className="feld__fehler" role="alert">
                {fehler}
              </p>
            )}
            <div className="zeile-zwischen verbindung__fuss">
              <p className="schritte__sicher">
                <ShieldCheck size={16} /> {t.einrichtung.sicherheit}
              </p>
              <button type="submit" className="knopf knopf--primaer" disabled={pruefe || !token.trim()}>
                {pruefe ? <span className="knopf__dreher" /> : null}
                {pruefe ? t.einrichtung.pruefe : t.einrichtung.knopf}
              </button>
            </div>
          </form>
        )}
      </div>
    </section>
  )
}
