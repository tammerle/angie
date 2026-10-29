import { lazy, Suspense, useEffect } from 'react'
import { useSitzung, wiederherstellen } from './daten/sitzung.ts'
import { Anmelden, Einrichtung } from './seiten/Anmelden.tsx'
import { Logo } from './ui/Logo.tsx'

const ladeInhalt = () => import('./AppInhalt.tsx')
const AppInhalt = lazy(ladeInhalt)

function Startbild() {
  return (
    <div className="startbild">
      <Logo art="gross" />
    </div>
  )
}

export default function App() {
  const { phase } = useSitzung()

  useEffect(() => {
    void wiederherstellen()
    // Die App hinter dem Login schon jetzt laden – die Anmeldung dauert ohnehin einen Moment.
    void ladeInhalt()
  }, [])

  if (phase === 'start') return <Startbild />
  if (phase === 'abgemeldet') return <Anmelden />
  if (phase === 'einrichtung') return <Einrichtung />
  return (
    <Suspense fallback={<Startbild />}>
      <AppInhalt />
    </Suspense>
  )
}
