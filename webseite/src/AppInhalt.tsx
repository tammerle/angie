// Alles nach dem Login. Wird schon beim Öffnen der Seite im Hintergrund
// geladen, damit nach der Anmeldung nichts mehr nachgeladen werden muss.
import { useEffect, useRef } from 'react'
import { profilAnlegen, standardProfil, useDaten } from './daten/aktionen.ts'
import { STANDARD, useEinstellungen } from './daten/einstellungen.ts'
import { profilEinstellungenUebernehmen, useSitzung } from './daten/sitzung.ts'
import { useRoute } from './lib/router.ts'
import { Einstellungen } from './seiten/Einstellungen.tsx'
import { KundeFormular } from './seiten/KundeFormular.tsx'
import { Kunden } from './seiten/Kunden.tsx'
import { Notizen } from './seiten/Notizen.tsx'
import { Profil } from './seiten/Profil.tsx'
import { neuerKundeOeffnen, Rahmen, useNeuerKunde } from './seiten/Rahmen.tsx'
import { Uebersicht } from './seiten/Uebersicht.tsx'
import { Hinweise } from './ui/Kleinteile.tsx'

/** Legt beim ersten Abgleich fehlende Profile an und übernimmt die Profil-Einstellungen. */
function ProfilAbgleich() {
  const { benutzer, anzeigenamen } = useSitzung()
  const { profile, sync } = useDaten()
  const einstellungen = useEinstellungen()
  const uebernommen = useRef(false)
  const profil = benutzer ? profile.get(benutzer) : undefined

  // Beide Profile anlegen, falls noch nicht vorhanden (das eigene mit den Geräte-Einstellungen).
  useEffect(() => {
    if (!benutzer || !sync.ersterAbgleich) return
    for (const [name, anzeige] of Object.entries(anzeigenamen)) {
      if (profile.has(name)) continue
      profilAnlegen(standardProfil(name, anzeige, name === benutzer ? einstellungen : STANDARD))
    }
  }, [benutzer, sync.ersterAbgleich, profile, anzeigenamen, einstellungen])

  useEffect(() => {
    if (profil && !uebernommen.current) {
      uebernommen.current = true
      profilEinstellungenUebernehmen(profil.einstellungen)
    }
  }, [profil])

  return null
}

function Seite() {
  const route = useRoute()
  switch (route.teile[0]) {
    case 'uebersicht':
      return <Uebersicht />
    case 'notizen':
      return <Notizen />
    case 'profil':
      return <Profil />
    case 'einstellungen':
      return <Einstellungen />
    default:
      return <Kunden />
  }
}

export default function AppInhalt() {
  const neu = useNeuerKunde()
  return (
    <>
      <ProfilAbgleich />
      <Rahmen>
        <Seite />
      </Rahmen>
      <KundeFormular offen={neu} schliessen={() => neuerKundeOeffnen(false)} />
      <Hinweise />
    </>
  )
}
