import {
  Calendar,
  CalendarCheck,
  Camera,
  Ellipsis,
  Images,
  Mail,
  MapPin,
  NotebookPen,
  Pencil,
  Phone,
  Trash2,
  UserRound,
  UserX,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import {
  kundeLoeschen,
  kundenAvatarSetzen,
  kundenNotizAendern,
  kundenNotizHinzufuegen,
  kundenNotizLoeschen,
  useDaten,
} from '../daten/aktionen.ts'
import { useSitzung } from '../daten/sitzung.ts'
import { PFAD, type FotoInfo, type Kunde, type KundenNotiz } from '../daten/typen.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import { datumFormat, heuteIso, vollerName } from '../lib/hilfen.ts'
import { gehe } from '../lib/router.ts'
import { KundenAvatar } from '../ui/Avatar.tsx'
import { Bestaetigen, Blatt } from '../ui/Blatt.tsx'
import { Textbereich } from '../ui/Felder.tsx'
import { FotoKachel, FotoKnoepfe, Lichtbox, useIstHandy, Vorschau } from '../ui/Fotos.tsx'
import { Leer, Reiter, zeigeHinweis } from '../ui/Kleinteile.tsx'
import { Rose } from '../ui/Logo.tsx'
import { KundeFormular } from './KundeFormular.tsx'

type ReiterWert = 'uebersicht' | 'notizen' | 'fotos'

function Wert({ symbol: S, text, href, lang }: { symbol?: typeof Phone; text: string; href?: string; lang?: boolean }) {
  const t = useT()
  const klasse = `wert ${!text ? 'wert--leer' : ''} ${lang ? 'wert--lang' : ''}`
  const inhalt = (
    <>
      {S && <S size={16} />}
      <span>{text || t.kunde.leer}</span>
    </>
  )
  return href && text ? (
    <a className={klasse} href={href} target={href.startsWith('http') ? '_blank' : undefined} rel="noreferrer">
      {inhalt}
    </a>
  ) : (
    <div className={klasse}>{inhalt}</div>
  )
}

function Kundendaten({ kunde, bearbeiten }: { kunde: Kunde; bearbeiten: () => void }) {
  const t = useT()
  const gebiet = useGebiet()
  return (
    <section className="karte">
      <div className="karte__kopf">
        <h3 className="karte__titel">
          <UserRound size={20} />
          {t.kunde.kundendaten}
        </h3>
        <button type="button" className="textlink" onClick={bearbeiten}>
          <Pencil size={14} /> {t.allgemein.bearbeiten}
        </button>
      </div>
      <div className="karte__inhalt datenraster">
        <div className="feld">
          <span className="feld__label">{t.kunde.vorname}</span>
          <Wert text={kunde.vorname} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.nachname}</span>
          <Wert text={kunde.nachname} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.telefon}</span>
          <Wert symbol={Phone} text={kunde.telefon} href={`tel:${kunde.telefon.replace(/[^\d+]/g, '')}`} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.email}</span>
          <Wert symbol={Mail} text={kunde.email} href={`mailto:${kunde.email}`} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.geburtsdatum}</span>
          <Wert symbol={Calendar} text={datumFormat(kunde.geburtsdatum, gebiet)} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.adresse}</span>
          <Wert symbol={MapPin} text={kunde.adresse} href={`https://maps.apple.com/?q=${encodeURIComponent(kunde.adresse)}`} />
        </div>
        <div className="feld datenraster__voll">
          <span className="feld__label">{t.kunde.allgemeineNotizen}</span>
          <Wert text={kunde.notiz} lang />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.letzterBesuch}</span>
          <Wert symbol={CalendarCheck} text={datumFormat(kunde.letzterBesuch, gebiet)} />
        </div>
        <div className="feld">
          <span className="feld__label">{t.kunde.kundeSeit}</span>
          <Wert text={datumFormat(kunde.erstelltAm, gebiet)} />
        </div>
      </div>
    </section>
  )
}

function NotizEintrag({ kunde, notiz }: { kunde: Kunde; notiz: KundenNotiz }) {
  const t = useT()
  const gebiet = useGebiet()
  const { anzeigenamen } = useSitzung()
  const { profile } = useDaten()
  const [menue, setMenue] = useState(false)
  const [bearbeiten, setBearbeiten] = useState(false)
  const [text, setText] = useState(notiz.text)
  const [frage, setFrage] = useState(false)
  const wer = profile.get(notiz.von)?.anzeigename ?? anzeigenamen[notiz.von] ?? notiz.von

  return (
    <li className="kundennotiz erscheinen">
      <div className="kundennotiz__kopf">
        <span className="kundennotiz__datum">{datumFormat(notiz.datum, gebiet)}</span>
        <span className="kundennotiz__wer">{wer}</span>
        <div className="kleinmenue">
          <button type="button" className="symbol" onClick={() => setMenue((m) => !m)} aria-label={t.kunde.mehr} aria-expanded={menue}>
            <Ellipsis size={18} />
          </button>
          {menue && (
            <div className="kleinmenue__flaeche erscheinen" onMouseLeave={() => setMenue(false)}>
              <button
                type="button"
                onClick={() => {
                  setText(notiz.text)
                  setBearbeiten(true)
                  setMenue(false)
                }}
              >
                <Pencil size={16} /> {t.allgemein.bearbeiten}
              </button>
              <button
                type="button"
                className="kleinmenue__gefahr"
                onClick={() => {
                  setFrage(true)
                  setMenue(false)
                }}
              >
                <Trash2 size={16} /> {t.allgemein.loeschen}
              </button>
            </div>
          )}
        </div>
      </div>
      {bearbeiten ? (
        <form
          className="kundennotiz__bearbeiten"
          onSubmit={(e) => {
            e.preventDefault()
            if (!text.trim()) return
            kundenNotizAendern(kunde.id, notiz.id, { text: text.trim() })
            setBearbeiten(false)
          }}
        >
          <Textbereich value={text} onChange={(e) => setText(e.target.value)} minZeilen={2} autoFocus />
          <div className="zeile-rechts">
            <button type="button" className="knopf knopf--geist knopf--klein" onClick={() => setBearbeiten(false)}>
              {t.allgemein.abbrechen}
            </button>
            <button type="submit" className="knopf knopf--primaer knopf--klein" disabled={!text.trim()}>
              {t.allgemein.speichern}
            </button>
          </div>
        </form>
      ) : (
        <p className="kundennotiz__text">{notiz.text}</p>
      )}
      <Bestaetigen
        offen={frage}
        titel={t.kundenNotizen.loeschenFrage}
        knopf={t.allgemein.loeschen}
        nein={() => setFrage(false)}
        ja={() => {
          setFrage(false)
          kundenNotizLoeschen(kunde.id, notiz.id)
        }}
      />
    </li>
  )
}

function NotizEingabe({ kunde }: { kunde: Kunde }) {
  const t = useT()
  const [text, setText] = useState('')
  const [datum, setDatum] = useState(heuteIso())
  return (
    <form
      className="notizeingabe"
      onSubmit={(e) => {
        e.preventDefault()
        if (!text.trim()) return
        kundenNotizHinzufuegen(kunde.id, text, datum || heuteIso())
        setText('')
        setDatum(heuteIso())
      }}
    >
      <Textbereich placeholder={t.kundenNotizen.neu} value={text} onChange={(e) => setText(e.target.value)} minZeilen={2} aria-label={t.kundenNotizen.neu} />
      <div className="notizeingabe__leiste">
        <label className="notizeingabe__datum">
          <Calendar size={16} />
          <input type="date" value={datum} onChange={(e) => setDatum(e.target.value)} aria-label={t.kundenNotizen.datum} />
        </label>
        <button type="submit" className="knopf knopf--primaer knopf--klein" disabled={!text.trim()}>
          {t.kundenNotizen.hinzufuegen}
        </button>
      </div>
    </form>
  )
}

function KundenNotizen({ kunde, max }: { kunde: Kunde; max?: number }) {
  const t = useT()
  const liste = [...kunde.notizen].sort((a, b) => b.datum.localeCompare(a.datum) || b.id.localeCompare(a.id))
  const sichtbar = max ? liste.slice(0, max) : liste
  return (
    <div className="kundennotizen">
      <NotizEingabe kunde={kunde} />
      {liste.length === 0 ? (
        <p className="kundennotizen__leer">{t.kundenNotizen.leer}</p>
      ) : (
        <ul className="kundennotizen__liste">
          {sichtbar.map((n) => (
            <NotizEintrag key={n.id} kunde={kunde} notiz={n} />
          ))}
        </ul>
      )}
      {max && liste.length > max && (
        <button type="button" className="textlink kundennotizen__mehr" onClick={() => gehe(`/kunden/${kunde.id}/notizen`, true)}>
          {t.kundenNotizen.alle} ({liste.length})
        </button>
      )}
    </div>
  )
}

function FotosKarte({ kunde, fotos, oeffnen }: { kunde: Kunde; fotos: FotoInfo[]; oeffnen: (i: number) => void }) {
  const t = useT()
  return (
    <section className="karte">
      <FotoKachel
        fotos={fotos}
        oeffnen={oeffnen}
        kopf={
          <div className="karte__kopf">
            <h3 className="karte__titel">
              <Images size={20} />
              {t.fotos.titel}
              {fotos.length > 0 && <span className="zaehler">{fotos.length}</span>}
            </h3>
            {fotos.length > 4 && (
              <button type="button" className="textlink" onClick={() => gehe(`/kunden/${kunde.id}/fotos`, true)}>
                {t.fotos.alleAnsehen}
              </button>
            )}
          </div>
        }
      />
      <div className="karte__inhalt karte__inhalt--fotos">
        <FotoKnoepfe kundeId={kunde.id} kompakt />
      </div>
    </section>
  )
}

function AvatarAktionen({ kunde, offen, schliessen }: { kunde: Kunde; offen: boolean; schliessen: () => void }) {
  const t = useT()
  const handy = useIstHandy()
  const { bildStand } = useDaten()
  const kamera = useRef<HTMLInputElement>(null)
  const datei = useRef<HTMLInputElement>(null)
  const hatBild = bildStand.has(PFAD.kundenAvatar(kunde.id))
  const waehlen = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0]
    e.target.value = ''
    schliessen()
    if (f) {
      await kundenAvatarSetzen(kunde.id, f)
      zeigeHinweis(t.kunde.gespeichert)
    }
  }
  return (
    <>
      <input ref={kamera} type="file" accept="image/*" capture="user" hidden onChange={waehlen} />
      <input ref={datei} type="file" accept="image/*" hidden onChange={waehlen} />
      <Blatt offen={offen} schliessen={schliessen} titel={t.kunde.profilbild} groesse="s">
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
                void kundenAvatarSetzen(kunde.id, null)
                schliessen()
              }}
            >
              <UserX size={20} /> {t.fotos.entfernen}
            </button>
          )}
        </div>
      </Blatt>
    </>
  )
}

export function KundeDetail({ id, reiter: reiterRoh }: { id: string; reiter?: string }) {
  const t = useT()
  const gebiet = useGebiet()
  const handy = useIstHandy()
  const { kundeNach, fotos: alleFotos, sync } = useDaten()
  const kunde = kundeNach.get(id)
  const fotos = alleFotos.get(id) ?? []
  const reiter: ReiterWert = reiterRoh === 'notizen' || reiterRoh === 'fotos' ? reiterRoh : 'uebersicht'
  const [formular, setFormular] = useState(false)
  const [loeschFrage, setLoeschFrage] = useState(false)
  const [avatarAktion, setAvatarAktion] = useState(false)
  const [lichtbox, setLichtbox] = useState<number | null>(null)

  useEffect(() => {
    if (reiterRoh === 'bearbeiten') setFormular(true)
  }, [reiterRoh])

  if (!kunde) {
    if (!sync.ersterAbgleich) return <div className="seite"><div className="skelett" style={{ height: 180, borderRadius: 20 }} /></div>
    return (
      <div className="seite">
        <Leer symbol={UserX} titel={t.kunden.nichtGefunden} />
      </div>
    )
  }

  const name = vollerName(kunde)
  const wechseln = (w: ReiterWert) => gehe(w === 'uebersicht' ? `/kunden/${id}` : `/kunden/${id}/${w}`, true)

  return (
    <div className="seite kundedetail">
      <section className="karte kundenkopf">
        <div className="kundenkopf__avatar">
          <KundenAvatar kunde={kunde} groesse={handy ? 84 : 128} uebergang={handy} />
          <button type="button" className="kundenkopf__kamera" onClick={() => setAvatarAktion(true)} aria-label={t.kunde.profilbild}>
            <Camera size={16} />
          </button>
        </div>
        <div className="kundenkopf__text">
          <h1>
            {name}
            <Rose className="kundenkopf__rose" />
          </h1>
          <ul className="kundenkopf__liste">
            {kunde.telefon && (
              <li>
                <a href={`tel:${kunde.telefon.replace(/[^\d+]/g, '')}`}>
                  <Phone size={15} /> <span>{kunde.telefon}</span>
                </a>
              </li>
            )}
            {kunde.email && (
              <li>
                <a href={`mailto:${kunde.email}`}>
                  <Mail size={15} /> <span>{kunde.email}</span>
                </a>
              </li>
            )}
            {kunde.geburtsdatum && (
              <li>
                <Calendar size={15} /> <span>{datumFormat(kunde.geburtsdatum, gebiet)}</span>
              </li>
            )}
          </ul>
        </div>
        <div className="kundenkopf__spruch nur-desktop">
          <p>{t.kunde.spruch}</p>
          <Rose />
        </div>
        <div className="kundenkopf__aktionen">
          <button type="button" className="symbol" onClick={() => setFormular(true)} aria-label={t.allgemein.bearbeiten}>
            <Pencil size={18} />
          </button>
          <button type="button" className="symbol" onClick={() => setLoeschFrage(true)} aria-label={t.allgemein.loeschen}>
            <Trash2 size={18} />
          </button>
        </div>
      </section>

      <Reiter
        reiter={[
          { wert: 'uebersicht', text: t.kunde.uebersicht },
          { wert: 'notizen', text: `${t.kunde.notizen}${kunde.notizen.length ? ` · ${kunde.notizen.length}` : ''}` },
          { wert: 'fotos', text: `${t.kunde.fotos}${fotos.length ? ` · ${fotos.length}` : ''}` },
        ]}
        wert={reiter}
        aendern={wechseln}
      />

      <div className="reiterinhalt" key={reiter}>
        {reiter === 'uebersicht' && (
          <div className="kundenraster">
            <div className="kundenraster__haupt">
              <Kundendaten kunde={kunde} bearbeiten={() => setFormular(true)} />
              {!handy && (
                <section className="karte">
                  <div className="karte__kopf">
                    <h3 className="karte__titel">
                      <NotebookPen size={20} />
                      {t.kunde.notizen}
                    </h3>
                  </div>
                  <div className="karte__inhalt">
                    <KundenNotizen kunde={kunde} max={3} />
                  </div>
                </section>
              )}
            </div>
            <div className="kundenraster__seite">
              <FotosKarte kunde={kunde} fotos={fotos} oeffnen={setLichtbox} />
            </div>
          </div>
        )}
        {reiter === 'notizen' && <KundenNotizen kunde={kunde} />}
        {reiter === 'fotos' && (
          <div className="fotoseite">
            <FotoKnoepfe kundeId={kunde.id} />
            {fotos.length === 0 ? (
              <Leer symbol={Images} titel={t.fotos.leer} text={t.fotos.leerText} />
            ) : (
              <div className="fotoraster">
                {fotos.map((f, i) => (
                  <Vorschau key={f.id} foto={f} onClick={() => setLichtbox(i)} />
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {lichtbox !== null && <Lichtbox fotos={fotos} start={lichtbox} schliessen={() => setLichtbox(null)} />}
      <AvatarAktionen kunde={kunde} offen={avatarAktion} schliessen={() => setAvatarAktion(false)} />
      <KundeFormular
        offen={formular}
        kunde={kunde}
        schliessen={() => {
          setFormular(false)
          if (reiterRoh === 'bearbeiten') gehe(`/kunden/${id}`, true)
        }}
        loeschen={() => {
          setFormular(false)
          setLoeschFrage(true)
        }}
      />
      <Bestaetigen
        offen={loeschFrage}
        titel={t.kunde.loeschenFrage(name)}
        text={t.kunde.loeschenText}
        knopf={t.allgemein.loeschen}
        nein={() => setLoeschFrage(false)}
        ja={() => {
          setLoeschFrage(false)
          kundeLoeschen(id)
          zeigeHinweis(t.kunde.geloescht)
          gehe('/kunden', true)
        }}
      />
    </div>
  )
}
