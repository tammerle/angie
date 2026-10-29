import type { CSSProperties } from 'react'
import { useBildUrl } from '../daten/aktionen.ts'
import { PFAD } from '../daten/typen.ts'
import { avatarTon, initialen } from '../lib/hilfen.ts'

interface Eigenschaften {
  vorname: string
  nachname: string
  bildPfad?: string | null
  groesse: number
  schluessel: string
  /** Name für die Übergangsanimation (Liste → Detail auf dem Handy) */
  uebergang?: string
  className?: string
}

export function Avatar({ vorname, nachname, bildPfad, groesse, schluessel, uebergang, className = '' }: Eigenschaften) {
  const url = useBildUrl(bildPfad)
  const stil = {
    width: groesse,
    height: groesse,
    fontSize: Math.round(groesse * 0.36),
    ...(uebergang ? { '--vt': uebergang } : {}),
  } as CSSProperties
  return (
    <span className={`avatar avatar--${avatarTon(schluessel)} ${uebergang ? 'avatar--vt' : ''} ${className}`} style={stil} aria-hidden="true">
      {url ? <img src={url} alt="" draggable={false} /> : initialen(vorname, nachname)}
    </span>
  )
}

export function KundenAvatar({ kunde, groesse, uebergang }: { kunde: { id: string; vorname: string; nachname: string }; groesse: number; uebergang?: boolean }) {
  return (
    <Avatar
      vorname={kunde.vorname}
      nachname={kunde.nachname}
      bildPfad={PFAD.kundenAvatar(kunde.id)}
      groesse={groesse}
      schluessel={kunde.id}
      uebergang={uebergang ? `kunde-${kunde.id}` : undefined}
    />
  )
}

export function BenutzerAvatar({ name, anzeigename, groesse }: { name: string; anzeigename: string; groesse: number }) {
  return <Avatar vorname={anzeigename} nachname="" bildPfad={PFAD.benutzerAvatar(name)} groesse={groesse} schluessel={name} />
}
