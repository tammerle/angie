import { Calendar, CalendarCheck, Mail, MapPin, Phone, Trash2, User } from 'lucide-react'
import { useEffect, useState } from 'react'
import { kundeAendern, kundeAnlegen, type KundenEingabe } from '../daten/aktionen.ts'
import type { Kunde } from '../daten/typen.ts'
import { useT } from '../i18n/index.ts'
import { nameGueltig } from '../lib/hilfen.ts'
import { gehe } from '../lib/router.ts'
import { Blatt } from '../ui/Blatt.tsx'
import { Feld, Textbereich } from '../ui/Felder.tsx'
import { zeigeHinweis } from '../ui/Kleinteile.tsx'

const LEER: KundenEingabe = {
  vorname: '',
  nachname: '',
  telefon: '',
  email: '',
  geburtsdatum: '',
  adresse: '',
  notiz: '',
  letzterBesuch: '',
}

function ausKunde(k: Kunde): KundenEingabe {
  const { vorname, nachname, telefon, email, geburtsdatum, adresse, notiz, letzterBesuch } = k
  return { vorname, nachname, telefon, email, geburtsdatum, adresse, notiz, letzterBesuch }
}

/** Neuer Kunde oder Bearbeiten. Pflicht ist nur ein Wort im Vor- oder Nachnamen. */
export function KundeFormular({
  offen,
  schliessen,
  kunde,
  loeschen,
}: {
  offen: boolean
  schliessen: () => void
  kunde?: Kunde
  loeschen?: () => void
}) {
  const t = useT()
  const [e, setE] = useState<KundenEingabe>(kunde ? ausKunde(kunde) : LEER)
  const [versucht, setVersucht] = useState(false)

  useEffect(() => {
    if (offen) {
      setE(kunde ? ausKunde(kunde) : LEER)
      setVersucht(false)
    }
    // Nur beim Öffnen übernehmen, nicht bei jeder Synchronisation.
  }, [offen])

  const gueltig = nameGueltig(e.vorname, e.nachname)
  const feld = (k: keyof KundenEingabe) => ({
    value: e[k],
    onChange: (ev: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setE((alt) => ({ ...alt, [k]: ev.target.value })),
  })

  const speichern = (ev?: React.FormEvent) => {
    ev?.preventDefault()
    setVersucht(true)
    if (!gueltig) return
    if (kunde) {
      kundeAendern(kunde.id, e)
      zeigeHinweis(t.kunde.gespeichert)
      schliessen()
    } else {
      const id = kundeAnlegen(e)
      zeigeHinweis(t.kunde.angelegt)
      schliessen()
      gehe(`/kunden/${id}`)
    }
  }

  return (
    <Blatt
      offen={offen}
      schliessen={schliessen}
      titel={kunde ? t.kunde.bearbeitenTitel : t.kunde.neu}
      fuss={
        <>
          {kunde && loeschen && (
            <button type="button" className="knopf knopf--gefahr blatt__links" onClick={loeschen} aria-label={t.allgemein.loeschen}>
              <Trash2 size={18} />
              <span className="nur-desktop">{t.allgemein.loeschen}</span>
            </button>
          )}
          <button type="button" className="knopf knopf--rahmen" onClick={schliessen}>
            {t.allgemein.abbrechen}
          </button>
          <button type="submit" form="kundeformular" className="knopf knopf--primaer" disabled={versucht && !gueltig}>
            {kunde ? t.allgemein.speichern : t.kunde.anlegen}
          </button>
        </>
      }
    >
      <form id="kundeformular" className="formular" onSubmit={speichern} noValidate>
        <div className="formular__zeile">
          <Feld label={t.kunde.vorname} symbol={User} autoComplete="off" autoCapitalize="words" {...feld('vorname')} autoFocus={!kunde} enterKeyHint="next" />
          <Feld label={t.kunde.nachname} autoComplete="off" autoCapitalize="words" {...feld('nachname')} enterKeyHint="next" />
        </div>
        {versucht && !gueltig ? (
          <p className="feld__fehler formular__pflicht">{t.kunde.nameNoetig}</p>
        ) : (
          <p className="feld__hinweis formular__pflicht">{t.kunde.nameNoetig}</p>
        )}
        <div className="formular__zeile">
          <Feld label={t.kunde.telefon} symbol={Phone} type="tel" inputMode="tel" autoComplete="off" zusatz={t.allgemein.optional} {...feld('telefon')} />
          <Feld label={t.kunde.email} symbol={Mail} type="email" inputMode="email" autoCapitalize="none" autoComplete="off" zusatz={t.allgemein.optional} {...feld('email')} />
        </div>
        <div className="formular__zeile">
          <Feld label={t.kunde.geburtsdatum} symbol={Calendar} type="date" zusatz={t.allgemein.optional} {...feld('geburtsdatum')} />
          <Feld label={t.kunde.letzterBesuch} symbol={CalendarCheck} type="date" zusatz={t.allgemein.optional} {...feld('letzterBesuch')} />
        </div>
        <Feld label={t.kunde.adresse} symbol={MapPin} autoComplete="off" zusatz={t.allgemein.optional} {...feld('adresse')} />
        <Textbereich label={t.kunde.allgemeineNotizen} minZeilen={3} {...feld('notiz')} />
      </form>
    </Blatt>
  )
}
