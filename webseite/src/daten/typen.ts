import type { Sprache } from '../i18n/texte.ts'

export interface Geaendert {
  geaendertAm: string
  geaendertVon: string
}

export interface KundenNotiz extends Geaendert {
  id: string
  /** YYYY-MM-DD */
  datum: string
  text: string
  von: string
}

export interface Kunde extends Geaendert {
  id: string
  vorname: string
  nachname: string
  telefon: string
  email: string
  /** YYYY-MM-DD oder leer */
  geburtsdatum: string
  adresse: string
  notiz: string
  /** YYYY-MM-DD oder leer */
  letzterBesuch: string
  notizen: KundenNotiz[]
  erstelltAm: string
  erstelltVon: string
}

export interface Ordner extends Geaendert {
  id: string
  name: string
  erstelltAm: string
  erstelltVon: string
}

export interface Notiz extends Geaendert {
  id: string
  titel: string
  inhalt: string
  ordnerId: string | null
  angeheftet: boolean
  erstelltAm: string
  erstelltVon: string
}

export const STATUS_VORLAGEN = [
  'sehrGluecklich',
  'hochmotiviert',
  'wertgeschaetzt',
  'zufrieden',
  'ausgeglichen',
  'fokussiert',
  'urlaubsreif',
  'ueberlastet',
  'unzufrieden',
  'unterfordert',
  'chefNervt',
  'teamStress',
  'gehaltFrustriert',
  'ungerecht',
  'alleinGestellt',
  'sucheArbeit',
  'gucci',
  'aufKaffee',
  'aufRedbull',
  'fly',
] as const

export type StatusVorlage = (typeof STATUS_VORLAGEN)[number]

export interface Status {
  art: 'vorlage' | 'eigen'
  schluessel: StatusVorlage | null
  text: string
  gesetztAm: string
}

export type Design = 'hell' | 'dunkel'

export interface Einstellungen {
  design: Design
  sprache: Sprache
}

export interface Profil extends Geaendert {
  name: string
  anzeigename: string
  rolle: string
  status: Status | null
  einstellungen: Einstellungen
}

export interface FotoInfo {
  id: string
  kundeId: string
  pfad: string
  vorschauPfad: string
  zeit: number
}

export const PFAD = {
  kunde: (id: string) => `kunden/${id}.json`,
  notiz: (id: string) => `notizen/${id}.json`,
  ordner: (id: string) => `ordner/${id}.json`,
  benutzer: (name: string) => `benutzer/${name}.json`,
  foto: (kunde: string, id: string) => `fotos/${kunde}/${id}.jpg`,
  vorschau: (kunde: string, id: string) => `vorschau/${kunde}/${id}.jpg`,
  kundenAvatar: (id: string) => `avatare/kunden/${id}.jpg`,
  benutzerAvatar: (name: string) => `avatare/benutzer/${name}.jpg`,
}
