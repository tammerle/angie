import { CloudCheck, CloudOff, Info, KeyRound, Languages, LoaderCircle, Moon, Palette, RefreshCw, Sun, TriangleAlert } from 'lucide-react'
import { profilAendern, syncJetzt, useDaten } from '../daten/aktionen.ts'
import { einrichtungOeffnen } from '../daten/sitzung.ts'
import { einstellungenSetzen, useEinstellungen } from '../daten/einstellungen.ts'
import type { Einstellungen as EinstellungenTyp } from '../daten/typen.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import type { Sprache } from '../i18n/texte.ts'
import { zeitFormat } from '../lib/hilfen.ts'
import { Segment } from '../ui/Felder.tsx'
import { useRelativeZeit } from '../ui/Kleinteile.tsx'

export function Einstellungen() {
  const t = useT()
  const gebiet = useGebiet()
  const relativ = useRelativeZeit()
  const e = useEinstellungen()
  const { sync } = useDaten()

  // Sofort auf dem Gerät, dazu im eigenen Profil (gilt dann auch auf anderen Geräten).
  const setzen = (neu: Partial<EinstellungenTyp>) => {
    einstellungenSetzen(neu)
    profilAendern({ einstellungen: { ...e, ...neu } })
  }

  const SyncSymbol =
    sync.zustand === 'laeuft' ? LoaderCircle : sync.zustand === 'offline' ? CloudOff : sync.zustand === 'bereit' ? CloudCheck : TriangleAlert
  const zustandText =
    sync.zustand === 'laeuft'
      ? t.sync.laeuft
      : sync.zustand === 'offline'
        ? t.sync.offline
        : sync.zustand === 'zugriff'
          ? t.sync.zugriff
          : sync.zustand === 'fehler'
            ? t.sync.fehler
            : t.sync.synchron

  return (
    <div className="seite einstellungen">
      <h1 className="seite__titel erscheinen">{t.einstellungen.titel}</h1>

      <section className="karte">
        <div className="karte__kopf">
          <h3 className="karte__titel">
            <Palette size={20} /> {t.einstellungen.design}
          </h3>
        </div>
        <div className="karte__inhalt">
          <Segment
            label={t.einstellungen.design}
            wert={e.design}
            aendern={(design) => setzen({ design })}
            optionen={[
              { wert: 'hell', text: t.einstellungen.hell, symbol: Sun },
              { wert: 'dunkel', text: t.einstellungen.dunkel, symbol: Moon },
            ]}
          />
        </div>
      </section>

      <section className="karte">
        <div className="karte__kopf">
          <h3 className="karte__titel">
            <Languages size={20} /> {t.einstellungen.sprache}
          </h3>
        </div>
        <div className="karte__inhalt">
          <Segment<Sprache>
            label={t.einstellungen.sprache}
            wert={e.sprache}
            aendern={(sprache) => setzen({ sprache })}
            optionen={[
              { wert: 'de', text: 'Deutsch' },
              { wert: 'it', text: 'Italiano' },
              { wert: 'en', text: 'English' },
            ]}
          />
        </div>
      </section>

      <section className="karte">
        <div className="karte__kopf">
          <h3 className="karte__titel">
            <RefreshCw size={20} /> {t.einstellungen.sync}
          </h3>
        </div>
        <div className="karte__inhalt synckarte">
          <div className={`synckarte__zustand synckarte__zustand--${sync.zustand}`}>
            <SyncSymbol size={20} className={sync.zustand === 'laeuft' ? 'sync__dreh' : ''} />
            <div>
              <strong>{zustandText}</strong>
              <small>
                {sync.zuletzt ? t.einstellungen.zuletzt(relativ(sync.zuletzt, (iso) => zeitFormat(iso, gebiet))) : t.einstellungen.nie}
              </small>
              <small>{sync.ausstehend ? t.einstellungen.ausstehend(sync.ausstehend) : t.einstellungen.allesGespeichert}</small>
            </div>
          </div>
          <button type="button" className="knopf knopf--sanft" onClick={syncJetzt} disabled={sync.zustand === 'laeuft'}>
            <RefreshCw size={17} /> {t.einstellungen.jetzt}
          </button>
        </div>
      </section>

      <section className="karte">
        <div className="karte__kopf">
          <h3 className="karte__titel">
            <KeyRound size={20} /> {t.einstellungen.schluessel}
          </h3>
        </div>
        <div className="karte__inhalt zeile-zwischen">
          <p className="gedaempft klein">{t.einstellungen.schluesselText}</p>
          <button type="button" className="knopf knopf--rahmen knopf--klein" onClick={einrichtungOeffnen}>
            {t.einstellungen.schluessel}
          </button>
        </div>
      </section>

      <section className="karte">
        <div className="karte__kopf">
          <h3 className="karte__titel">
            <Info size={20} /> {t.einstellungen.ueber}
          </h3>
        </div>
        <div className="karte__inhalt">
          <p className="gedaempft klein">{t.einstellungen.ueberText}</p>
          <p className="leise klein">
            {t.einstellungen.version} {__APP_VERSION__}
          </p>
        </div>
      </section>
    </div>
  )
}
