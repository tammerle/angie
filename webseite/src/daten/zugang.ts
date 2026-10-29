// Lesen und Schreiben der öffentlichen Zugangsdatei (zugang/zugang.json im Repo angie).
import { DEMO, ZUGANG_ORT } from '../konfig.ts'
import type { Zugang } from '../lib/krypto.ts'
import { base64ZuText, textZuBase64 } from './quelle.ts'

const CACHE = 'salon-zugang'
const API = `https://api.github.com/repos/${ZUGANG_ORT.besitzer}/${ZUGANG_ORT.repo}/contents/${ZUGANG_ORT.pfad}`
const ROH = `https://raw.githubusercontent.com/${ZUGANG_ORT.besitzer}/${ZUGANG_ORT.repo}/${ZUGANG_ORT.zweig}/${ZUGANG_ORT.pfad}`

export interface ZugangStand {
  zugang: Zugang
  sha: string | null
}

interface Zwischenspeicher extends ZugangStand {
  etag: string | null
}

function ausCache(): Zwischenspeicher | null {
  try {
    const roh = localStorage.getItem(CACHE)
    return roh ? (JSON.parse(roh) as Zwischenspeicher) : null
  } catch {
    return null
  }
}

function inCache(z: Zwischenspeicher) {
  try {
    localStorage.setItem(CACHE, JSON.stringify(z))
  } catch {
    /* privater Modus */
  }
}

// Demo: Zugang mit Testpasswörtern, nur im lokalen Testbetrieb (eigene Datei,
// damit Argon2 nicht im Startpaket landet).
const DEMO_SCHLUESSEL = 'salon-demo-zugang'

/** Holt die Zugangsdatei: GitHub-API (mit ETag), sonst raw, sonst letzte bekannte Fassung. */
export async function zugangLaden(): Promise<ZugangStand | null> {
  if (DEMO) return (await import('./demoZugang.ts')).demoZugang(DEMO_SCHLUESSEL)
  const cache = ausCache()
  try {
    const a = await fetch(`${API}?ref=${ZUGANG_ORT.zweig}`, {
      cache: 'no-store',
      headers: {
        Accept: 'application/vnd.github+json',
        ...(cache?.etag ? { 'If-None-Match': cache.etag } : {}),
      },
    })
    if (a.status === 304 && cache) return cache
    if (a.ok) {
      const j = (await a.json()) as { sha: string; content: string }
      const stand = { zugang: JSON.parse(base64ZuText(j.content)) as Zugang, sha: j.sha, etag: a.headers.get('etag') }
      inCache(stand)
      return stand
    }
  } catch {
    /* weiter mit raw */
  }
  try {
    const a = await fetch(`${ROH}?t=${Date.now()}`, { cache: 'no-store' })
    if (a.ok) {
      const zugang = (await a.json()) as Zugang
      const stand = { zugang, sha: cache?.sha ?? null, etag: null }
      return stand
    }
  } catch {
    /* offline */
  }
  return cache
}

export type SchreibErgebnis = { ok: true; stand: ZugangStand } | { ok: false; grund: 'rechte' | 'netz' | 'konflikt' }

/** Schreibt die Zugangsdatei mit dem GitHub-Schlüssel. */
export async function zugangSchreiben(token: string, zugang: Zugang, sha: string | null): Promise<SchreibErgebnis> {
  if (DEMO) {
    const stand = { zugang, sha: 'demo' }
    localStorage.setItem(DEMO_SCHLUESSEL, JSON.stringify(stand))
    return { ok: true, stand }
  }
  try {
    const a = await fetch(API, {
      method: 'PUT',
      cache: 'no-store',
      headers: {
        Authorization: `Bearer ${token}`,
        'X-GitHub-Api-Version': '2022-11-28',
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: 'Zugang aktualisiert (Salon-Kartei)',
        content: textZuBase64(JSON.stringify(zugang, null, 2) + '\n'),
        branch: ZUGANG_ORT.zweig,
        ...(sha ? { sha } : {}),
      }),
    })
    if (a.status === 409 || a.status === 422) return { ok: false, grund: 'konflikt' }
    if (a.status === 401 || a.status === 403 || a.status === 404) return { ok: false, grund: 'rechte' }
    if (!a.ok) return { ok: false, grund: 'netz' }
    const j = (await a.json()) as { content: { sha: string } }
    const stand = { zugang, sha: j.content.sha }
    inCache({ ...stand, etag: null })
    return { ok: true, stand }
  } catch {
    return { ok: false, grund: 'netz' }
  }
}
