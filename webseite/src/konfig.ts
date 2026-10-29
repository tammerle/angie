// Wo die Zugangsdatei liegt. Sie ist öffentlich lesbar und enthält nur
// Argon2-Salze und verschlüsselte Schlüssel (siehe lib/krypto.ts).
export const ZUGANG_ORT = {
  besitzer: 'tammerle',
  repo: 'angie',
  pfad: 'zugang/zugang.json',
  zweig: 'main',
} as const

/** Lokaler Testbetrieb ohne GitHub: `VITE_DEMO=1 npm run dev` */
export const DEMO = import.meta.env.VITE_DEMO === '1'

/** Wie oft im Hintergrund nach Änderungen der anderen gesucht wird (ms). */
export const ABGLEICH_ALLE = 15_000

export const SALON = 'Rose'
