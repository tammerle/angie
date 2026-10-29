import { Cake, CalendarCheck, Images, NotebookPen, Users } from 'lucide-react'
import { useMemo, useState } from 'react'
import { statusSetzen, useDaten } from '../daten/aktionen.ts'
import { useSitzung } from '../daten/sitzung.ts'
import type { FotoInfo } from '../daten/typen.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import { datumFormat, naechsterGeburtstag, vollerName, zeitFormat } from '../lib/hilfen.ts'
import { gehe } from '../lib/router.ts'
import { BenutzerAvatar, KundenAvatar } from '../ui/Avatar.tsx'
import { Blatt } from '../ui/Blatt.tsx'
import { Vorschau } from '../ui/Fotos.tsx'
import { useRelativeZeit } from '../ui/Kleinteile.tsx'
import { StatusPille, StatusWahl } from '../ui/Status.tsx'

function Zahl({ symbol: S, wert, text, ziel }: { symbol: typeof Users; wert: number; text: string; ziel: string }) {
  return (
    <button type="button" className="zahl" onClick={() => gehe(ziel)}>
      <span className="zahl__symbol">
        <S size={20} />
      </span>
      <strong>{wert}</strong>
      <span>{text}</span>
    </button>
  )
}

export function Uebersicht() {
  const t = useT()
  const gebiet = useGebiet()
  const relativ = useRelativeZeit()
  const { benutzer, anzeigenamen } = useSitzung()
  const { kunden, kundeNach, notizen, alleFotos, profile } = useDaten()
  const [statusOffen, setStatusOffen] = useState(false)
  const ich = benutzer ? profile.get(benutzer) : undefined
  const team = useMemo(() => {
    const namen = new Set([...Object.keys(anzeigenamen), ...profile.keys()])
    return [...namen].sort((a, b) => (a === benutzer ? -1 : b === benutzer ? 1 : a.localeCompare(b)))
  }, [anzeigenamen, profile, benutzer])

  const geburtstage = useMemo(
    () =>
      kunden
        .map((k) => ({ k, g: naechsterGeburtstag(k.geburtsdatum) }))
        .filter((x): x is { k: (typeof kunden)[number]; g: { tage: number; alter: number } } => !!x.g && x.g.tage <= 30)
        .sort((a, b) => a.g.tage - b.g.tage)
        .slice(0, 6),
    [kunden],
  )
  const zuletzt = useMemo(
    () => kunden.filter((k) => k.letzterBesuch).sort((a, b) => b.letzterBesuch.localeCompare(a.letzterBesuch)).slice(0, 5),
    [kunden],
  )
  const neuesteNotizen = useMemo(() => [...notizen].sort((a, b) => b.geaendertAm.localeCompare(a.geaendertAm)).slice(0, 4), [notizen])
  const neuesteFotos = alleFotos.slice(0, 10)
  const heute = new Date().toLocaleDateString(gebiet, { weekday: 'long', day: 'numeric', month: 'long' })

  const fotoOeffnen = (f: FotoInfo) => gehe(`/kunden/${f.kundeId}/fotos`)

  return (
    <div className="seite uebersicht">
      <header className="uebersicht__gruss erscheinen">
        <p className="leise">{heute}</p>
        <h1>{t.uebersicht.hallo(ich?.anzeigename ?? (benutzer ? anzeigenamen[benutzer] : '') ?? '')}</h1>
      </header>

      <section className="karte team">
        <div className="karte__kopf">
          <h3 className="karte__titel">{t.status.team}</h3>
        </div>
        <div className="karte__inhalt team__liste">
          {team.map((name) => {
            const p = profile.get(name)
            const anzeige = p?.anzeigename ?? anzeigenamen[name] ?? name
            const meins = name === benutzer
            return (
              <div key={name} className="team__person">
                <BenutzerAvatar name={name} anzeigename={anzeige} groesse={48} />
                <div className="team__text">
                  <strong>{anzeige}</strong>
                  <StatusPille status={p?.status ?? null} onClick={meins ? () => setStatusOffen(true) : undefined} klein />
                  {p?.status && <small className="leise">{t.status.seit(relativ(p.status.gesetztAm, (iso) => zeitFormat(iso, gebiet)))}</small>}
                </div>
              </div>
            )
          })}
        </div>
      </section>

      <div className="zahlen">
        <Zahl symbol={Users} wert={kunden.length} text={t.uebersicht.kunden} ziel="/kunden" />
        <Zahl symbol={NotebookPen} wert={notizen.length} text={t.uebersicht.notizen} ziel="/notizen" />
        <Zahl symbol={Images} wert={alleFotos.length} text={t.uebersicht.fotos} ziel="/kunden" />
      </div>

      <div className="uebersicht__raster">
        <section className="karte">
          <div className="karte__kopf">
            <h3 className="karte__titel">
              <Cake size={20} /> {t.uebersicht.geburtstage}
            </h3>
          </div>
          <div className="karte__inhalt">
            {geburtstage.length === 0 ? (
              <p className="leise klein">{t.uebersicht.keineGeburtstage}</p>
            ) : (
              <ul className="miniliste">
                {geburtstage.map(({ k, g }) => (
                  <li key={k.id}>
                    <button type="button" onClick={() => gehe(`/kunden/${k.id}`)}>
                      <KundenAvatar kunde={k} groesse={36} />
                      <span className="miniliste__text">
                        <strong>{vollerName(k)}</strong>
                        <small>
                          {new Date(`${k.geburtsdatum}T12:00:00`).toLocaleDateString(gebiet, { day: 'numeric', month: 'long' })} ·{' '}
                          {t.uebersicht.wirdAlt(g.alter)}
                        </small>
                      </span>
                      <span className={`marke ${g.tage === 0 ? 'marke--akzent' : ''}`}>{t.uebersicht.inTagen(g.tage)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="karte">
          <div className="karte__kopf">
            <h3 className="karte__titel">
              <CalendarCheck size={20} /> {t.uebersicht.zuletztDa}
            </h3>
          </div>
          <div className="karte__inhalt">
            {zuletzt.length === 0 ? (
              <p className="leise klein">{t.uebersicht.nochNichts}</p>
            ) : (
              <ul className="miniliste">
                {zuletzt.map((k) => (
                  <li key={k.id}>
                    <button type="button" onClick={() => gehe(`/kunden/${k.id}`)}>
                      <KundenAvatar kunde={k} groesse={36} />
                      <span className="miniliste__text">
                        <strong>{vollerName(k)}</strong>
                        {k.telefon && <small>{k.telefon}</small>}
                      </span>
                      <span className="marke">{datumFormat(k.letzterBesuch, gebiet)}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>

        <section className="karte uebersicht__breit">
          <div className="karte__kopf">
            <h3 className="karte__titel">
              <Images size={20} /> {t.uebersicht.neuesteFotos}
            </h3>
          </div>
          <div className="karte__inhalt">
            {neuesteFotos.length === 0 ? (
              <p className="leise klein">{t.uebersicht.nochNichts}</p>
            ) : (
              <div className="fotostreifen">
                {neuesteFotos.map((f) => (
                  <figure key={f.id}>
                    <Vorschau foto={f} onClick={() => fotoOeffnen(f)} />
                    <figcaption>{kundeNach.get(f.kundeId) ? vollerName(kundeNach.get(f.kundeId)!) : ''}</figcaption>
                  </figure>
                ))}
              </div>
            )}
          </div>
        </section>

        <section className="karte uebersicht__breit">
          <div className="karte__kopf">
            <h3 className="karte__titel">
              <NotebookPen size={20} /> {t.uebersicht.neuesteNotizen}
            </h3>
          </div>
          <div className="karte__inhalt">
            {neuesteNotizen.length === 0 ? (
              <p className="leise klein">{t.uebersicht.nochNichts}</p>
            ) : (
              <ul className="notizreihe">
                {neuesteNotizen.map((n) => (
                  <li key={n.id}>
                    <button type="button" onClick={() => gehe(`/notizen/${n.id}`)}>
                      <strong>{n.titel || t.notizen.ohneTitel}</strong>
                      <span>{n.inhalt.replace(/⟦[^⟧]*⟧/g, '').slice(0, 120)}</span>
                      <small className="leise">{relativ(n.geaendertAm, (iso) => zeitFormat(iso, gebiet))}</small>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </section>
      </div>

      <Blatt offen={statusOffen} schliessen={() => setStatusOffen(false)} titel={t.status.titel}>
        <StatusWahl
          status={ich?.status ?? null}
          waehlen={(s) => {
            statusSetzen(s)
            setStatusOffen(false)
          }}
        />
      </Blatt>
    </div>
  )
}
