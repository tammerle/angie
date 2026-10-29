import { Folder, FolderOpen, FolderPlus, Inbox, NotebookPen, Pencil, Pin, PinOff, Plus, Search, Trash2, TriangleAlert } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import {
  notizAendern,
  notizAnlegen,
  notizLoeschen,
  ordnerAnlegen,
  ordnerLoeschen,
  ordnerUmbenennen,
  useDaten,
} from '../daten/aktionen.ts'
import { useSitzung } from '../daten/sitzung.ts'
import type { Notiz, Ordner } from '../daten/typen.ts'
import { bloecke, hatKonflikt } from '../daten/zusammenfuehren.ts'
import { useGebiet, useT } from '../i18n/index.ts'
import { suchtext, zeitFormat } from '../lib/hilfen.ts'
import { gehe, useRoute, zurueck } from '../lib/router.ts'
import { Bestaetigen, Blatt } from '../ui/Blatt.tsx'
import { Feld } from '../ui/Felder.tsx'
import { useIstHandy } from '../ui/Fotos.tsx'
import { Leer, useRelativeZeit } from '../ui/Kleinteile.tsx'

type Filter = 'alle' | 'ohne' | string

function useWer() {
  const { anzeigenamen } = useSitzung()
  const { profile } = useDaten()
  return (name: string) => profile.get(name)?.anzeigename ?? anzeigenamen[name] ?? name
}

function ordnerLink(filter: Filter) {
  return filter === 'alle' ? '/notizen' : `/notizen?ordner=${filter}`
}

function OrdnerBlatt({ offen, ordner, schliessen }: { offen: boolean; ordner?: Ordner; schliessen: () => void }) {
  const t = useT()
  const [name, setName] = useState('')
  useEffect(() => {
    if (offen) setName(ordner?.name ?? '')
  }, [offen, ordner])
  const speichern = (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!name.trim()) return
    if (ordner) ordnerUmbenennen(ordner.id, name)
    else gehe(ordnerLink(ordnerAnlegen(name)), true)
    schliessen()
  }
  return (
    <Blatt
      offen={offen}
      schliessen={schliessen}
      titel={ordner ? t.notizen.ordnerUmbenennen : t.notizen.neuerOrdner}
      groesse="s"
      fuss={
        <>
          <button type="button" className="knopf knopf--rahmen" onClick={schliessen}>
            {t.allgemein.abbrechen}
          </button>
          <button type="submit" form="ordnerformular" className="knopf knopf--primaer" disabled={!name.trim()}>
            {t.allgemein.speichern}
          </button>
        </>
      }
    >
      <form id="ordnerformular" onSubmit={speichern}>
        <Feld label={t.notizen.ordnerName} symbol={Folder} value={name} onChange={(e) => setName(e.target.value)} autoFocus maxLength={60} />
      </form>
    </Blatt>
  )
}

function OrdnerLeiste({ filter, zaehlen }: { filter: Filter; zaehlen: (f: Filter) => number }) {
  const t = useT()
  const { ordner } = useDaten()
  const [blatt, setBlatt] = useState<{ offen: boolean; ordner?: Ordner }>({ offen: false })
  const [frage, setFrage] = useState<Ordner | null>(null)
  const sortiert = [...ordner].sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))
  const aktiver = ordner.find((o) => o.id === filter)

  const chip = (f: Filter, text: string, Symbol: typeof Folder) => (
    <button key={f} type="button" className={`ordnerchip ${filter === f ? 'ist-aktiv' : ''}`} onClick={() => gehe(ordnerLink(f), true)}>
      <Symbol size={16} />
      <span>{text}</span>
      <small>{zaehlen(f)}</small>
    </button>
  )

  return (
    <div className="ordnerleiste">
      <div className="ordnerleiste__kopf nur-desktop">
        <h2>{t.notizen.ordner}</h2>
      </div>
      <div className="ordnerleiste__liste">
        {chip('alle', t.notizen.alle, Inbox)}
        {sortiert.map((o) => chip(o.id, o.name, filter === o.id ? FolderOpen : Folder))}
        {chip('ohne', t.notizen.ohneOrdner, Folder)}
        <button type="button" className="ordnerchip ordnerchip--neu" onClick={() => setBlatt({ offen: true })}>
          <FolderPlus size={16} />
          <span>{t.notizen.neuerOrdner}</span>
        </button>
      </div>
      {aktiver && (
        <div className="ordnerleiste__aktionen erscheinen">
          <button type="button" className="knopf knopf--geist knopf--klein" onClick={() => setBlatt({ offen: true, ordner: aktiver })}>
            <Pencil size={15} /> {t.notizen.ordnerUmbenennen}
          </button>
          <button type="button" className="knopf knopf--geist knopf--klein" onClick={() => setFrage(aktiver)}>
            <Trash2 size={15} /> {t.allgemein.loeschen}
          </button>
        </div>
      )}
      <OrdnerBlatt offen={blatt.offen} ordner={blatt.ordner} schliessen={() => setBlatt({ offen: false })} />
      <Bestaetigen
        offen={!!frage}
        titel={frage ? t.notizen.ordnerLoeschenFrage(frage.name) : ''}
        text={t.notizen.ordnerLoeschenText}
        knopf={t.allgemein.loeschen}
        nein={() => setFrage(null)}
        ja={() => {
          if (frage) ordnerLoeschen(frage.id)
          setFrage(null)
          gehe('/notizen', true)
        }}
      />
    </div>
  )
}

function NotizKarte({ notiz, aktiv, ordnerName }: { notiz: Notiz; aktiv: boolean; ordnerName?: string }) {
  const t = useT()
  const gebiet = useGebiet()
  const wer = useWer()
  const relativ = useRelativeZeit()
  const vorschau = notiz.inhalt.replace(/⟦[^⟧]*⟧/g, '').replace(/\s+/g, ' ').trim()
  return (
    <li>
      <button type="button" className={`notizkarte ${aktiv ? 'ist-aktiv' : ''}`} onClick={() => gehe(`/notizen/${notiz.id}`)}>
        <span className="notizkarte__kopf">
          <strong>{notiz.titel || t.notizen.ohneTitel}</strong>
          {notiz.angeheftet && <Pin size={14} className="notizkarte__pin" />}
          {hatKonflikt(notiz.inhalt) && <TriangleAlert size={14} className="notizkarte__konflikt" />}
        </span>
        {vorschau && <span className="notizkarte__text">{vorschau}</span>}
        <span className="notizkarte__fuss">
          {t.notizen.zuletzt(relativ(notiz.geaendertAm, (iso) => zeitFormat(iso, gebiet)), wer(notiz.geaendertVon))}
          {ordnerName && <em>{ordnerName}</em>}
        </span>
      </button>
    </li>
  )
}

function Editor({ notiz }: { notiz: Notiz }) {
  const t = useT()
  const gebiet = useGebiet()
  const wer = useWer()
  const { ordner } = useDaten()
  const [titel, setTitel] = useState(notiz.titel)
  const [inhalt, setInhalt] = useState(notiz.inhalt)
  const [frage, setFrage] = useState(false)
  const bearbeitet = useRef(false)
  const textfeld = useRef<HTMLTextAreaElement>(null)

  // Änderungen der anderen übernehmen, solange hier nicht getippt wird.
  useEffect(() => {
    if (!bearbeitet.current) {
      setTitel(notiz.titel)
      setInhalt(notiz.inhalt)
    }
  }, [notiz.titel, notiz.inhalt])

  useEffect(() => {
    const el = textfeld.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${Math.max(el.scrollHeight, 240)}px`
  }, [inhalt])

  // Kurz nach dem letzten Tastendruck speichern.
  useEffect(() => {
    if (!bearbeitet.current) return
    const timer = setTimeout(() => {
      notizAendern(notiz.id, { titel, inhalt })
      bearbeitet.current = false
    }, 450)
    return () => clearTimeout(timer)
  }, [titel, inhalt, notiz.id])

  // Beim Verlassen: Ungespeichertes sichern, leere Notizen wieder entfernen.
  const neueste = useRef({ titel, inhalt })
  useEffect(() => {
    neueste.current = { titel, inhalt }
  }, [titel, inhalt])
  useEffect(
    () => () => {
      const { titel: ti, inhalt: inh } = neueste.current
      if (!ti.trim() && !inh.trim()) notizLoeschen(notiz.id)
      else if (bearbeitet.current) notizAendern(notiz.id, { titel: ti, inhalt: inh })
    },
    [notiz.id],
  )

  const konflikt = hatKonflikt(inhalt)
  const teile = konflikt ? bloecke(inhalt) : []

  return (
    <article className="editor erscheinen">
      <div className="editor__leiste">
        <label className="editor__ordner">
          <Folder size={16} />
          <select
            value={notiz.ordnerId ?? ''}
            onChange={(e) => notizAendern(notiz.id, { ordnerId: e.target.value || null })}
            aria-label={t.notizen.verschieben}
          >
            <option value="">{t.notizen.ohneOrdner}</option>
            {ordner.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>
        </label>
        <span className="editor__luecke" />
        <button
          type="button"
          className={`symbol ${notiz.angeheftet ? 'ist-aktiv' : ''}`}
          onClick={() => notizAendern(notiz.id, { angeheftet: !notiz.angeheftet })}
          aria-label={notiz.angeheftet ? t.notizen.loesen : t.notizen.anheften}
          aria-pressed={notiz.angeheftet}
        >
          {notiz.angeheftet ? <PinOff size={18} /> : <Pin size={18} />}
        </button>
        <button type="button" className="symbol" onClick={() => setFrage(true)} aria-label={t.allgemein.loeschen}>
          <Trash2 size={18} />
        </button>
      </div>
      <input
        className="editor__titel"
        placeholder={t.notizen.titelFeld}
        value={titel}
        onChange={(e) => {
          bearbeitet.current = true
          setTitel(e.target.value)
        }}
        aria-label={t.notizen.titelFeld}
      />
      <p className="editor__info">{t.notizen.zuletzt(zeitFormat(notiz.geaendertAm, gebiet), wer(notiz.geaendertVon))}</p>
      {konflikt && (
        <div className="konflikt erscheinen" role="status">
          <TriangleAlert size={18} />
          <div>
            <strong>{t.notizen.konfliktTitel}</strong>
            <p>{t.notizen.konfliktText}</p>
            <div className="konflikt__bloecke">
              {teile.map((b, i) => (
                <div key={i} className="konflikt__block">
                  {b.kopf && <span className="konflikt__kopf">{b.kopf}</span>}
                  <p>{b.text}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
      <textarea
        ref={textfeld}
        className="editor__inhalt"
        placeholder={t.notizen.inhaltFeld}
        value={inhalt}
        onChange={(e) => {
          bearbeitet.current = true
          setInhalt(e.target.value)
        }}
        aria-label={t.notizen.inhaltFeld}
      />
      <Bestaetigen
        offen={frage}
        titel={t.notizen.loeschenFrage}
        knopf={t.allgemein.loeschen}
        nein={() => setFrage(false)}
        ja={() => {
          setFrage(false)
          notizLoeschen(notiz.id)
          zurueck('/notizen')
        }}
      />
    </article>
  )
}

export function Notizen() {
  const t = useT()
  const route = useRoute()
  const handy = useIstHandy()
  const { notizen, ordner, sync } = useDaten()
  const [begriff, setBegriff] = useState('')
  const filter: Filter = route.suche.get('ordner') ?? 'alle'
  const notizId = route.teile[1]
  const aktuelle = notizId ? notizen.find((n) => n.id === notizId) : undefined
  const ordnerNamen = useMemo(() => new Map(ordner.map((o) => [o.id, o.name])), [ordner])

  const zaehlen = (f: Filter) =>
    f === 'alle' ? notizen.length : f === 'ohne' ? notizen.filter((n) => !n.ordnerId || !ordnerNamen.has(n.ordnerId)).length : notizen.filter((n) => n.ordnerId === f).length

  const liste = useMemo(() => {
    const s = suchtext(begriff.trim())
    return notizen
      .filter((n) =>
        filter === 'alle' ? true : filter === 'ohne' ? !n.ordnerId || !ordnerNamen.has(n.ordnerId) : n.ordnerId === filter,
      )
      .filter((n) => !s || suchtext(n.titel, n.inhalt).includes(s))
      .sort((a, b) => Number(b.angeheftet) - Number(a.angeheftet) || b.geaendertAm.localeCompare(a.geaendertAm))
  }, [notizen, filter, begriff, ordnerNamen])

  const neu = () => {
    const id = notizAnlegen(filter !== 'alle' && filter !== 'ohne' ? filter : null)
    gehe(`/notizen/${id}`)
  }

  // Handy: Editor als eigene Seite.
  if (handy && notizId) {
    return (
      <div className="seite seite--editor">
        {aktuelle ? <Editor key={aktuelle.id} notiz={aktuelle} /> : sync.ersterAbgleich ? <Leer symbol={NotebookPen} titel={t.notizen.waehlen} /> : null}
      </div>
    )
  }

  const listenTeil = (
    <section className="notizliste">
      <div className="notizliste__kopf">
        <h2>{filter === 'alle' ? t.notizen.alle : filter === 'ohne' ? t.notizen.ohneOrdner : ordnerNamen.get(filter) ?? t.notizen.titel}</h2>
        <button type="button" className="knopf knopf--primaer knopf--klein nur-desktop" onClick={neu}>
          <Plus size={17} /> {t.notizen.neu}
        </button>
      </div>
      <div className="kundenliste__suche">
        <Search size={18} className="feld__symbol" />
        <input
          className="eingabe eingabe--symbol"
          type="search"
          placeholder={t.notizen.suchen}
          aria-label={t.notizen.suchen}
          value={begriff}
          onChange={(e) => setBegriff(e.target.value)}
        />
      </div>
      {liste.length === 0 ? (
        <Leer symbol={NotebookPen} titel={t.notizen.leer} text={t.notizen.leerText} />
      ) : (
        <ul className="notizliste__liste">
          {liste.map((n) => (
            <NotizKarte key={n.id} notiz={n} aktiv={n.id === notizId} ordnerName={filter === 'alle' && n.ordnerId ? ordnerNamen.get(n.ordnerId) : undefined} />
          ))}
        </ul>
      )}
    </section>
  )

  if (handy) {
    return (
      <div className="seite notizen-handy">
        <OrdnerLeiste filter={filter} zaehlen={zaehlen} />
        {listenTeil}
        <button type="button" className="schwebeknopf" onClick={neu} aria-label={t.notizen.neu}>
          <Plus size={26} />
        </button>
      </div>
    )
  }

  return (
    <div className="notizen-desktop">
      <aside className="notizen-desktop__ordner">
        <OrdnerLeiste filter={filter} zaehlen={zaehlen} />
      </aside>
      <div className="notizen-desktop__liste">{listenTeil}</div>
      <div className="notizen-desktop__editor">
        {aktuelle ? <Editor key={aktuelle.id} notiz={aktuelle} /> : <Leer symbol={NotebookPen} titel={t.notizen.titel} text={t.notizen.waehlen} />}
      </div>
    </div>
  )
}
