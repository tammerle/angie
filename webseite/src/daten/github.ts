// GitHub als Datenbank: REST für Baum, Schreiben und Bilder, GraphQL zum
// gebündelten Laden vieler kleiner JSON-Dateien in einer Anfrage.
import type { DatenRepo } from '../lib/krypto.ts'
import { base64ZuText, KonfliktFehler, NetzFehler, ZugriffFehler, type Baum, type Quelle } from './quelle.ts'

const API = 'https://api.github.com'

export function githubQuelle(token: string, repo: DatenRepo): Quelle {
  const basis = `${API}/repos/${repo.besitzer}/${repo.repo}`
  const kopf = (extra: Record<string, string> = {}) => ({
    Authorization: `Bearer ${token}`,
    'X-GitHub-Api-Version': '2022-11-28',
    ...extra,
  })

  async function abruf(url: string, init: RequestInit = {}): Promise<Response> {
    let antwort: Response
    try {
      antwort = await fetch(url, { cache: 'no-store', ...init })
    } catch {
      throw new NetzFehler('offline')
    }
    if (antwort.status === 401) throw new ZugriffFehler(401)
    if (antwort.status === 403 && antwort.headers.get('x-ratelimit-remaining') !== '0') {
      throw new ZugriffFehler(403)
    }
    if (antwort.status >= 500 || antwort.status === 403 || antwort.status === 429) {
      throw new NetzFehler(`GitHub ${antwort.status}`)
    }
    return antwort
  }

  const pfadUrl = (pfad: string) => `${basis}/contents/${pfad.split('/').map(encodeURIComponent).join('/')}`

  async function blobText(sha: string): Promise<string> {
    const a = await abruf(`${basis}/git/blobs/${sha}`, { headers: kopf({ Accept: 'application/vnd.github+json' }) })
    if (!a.ok) throw new NetzFehler(`blob ${a.status}`)
    const j = (await a.json()) as { content: string }
    return base64ZuText(j.content)
  }

  return {
    async baum(etag): Promise<Baum> {
      const a = await abruf(`${basis}/git/trees/${encodeURIComponent(repo.zweig)}?recursive=1`, {
        headers: kopf({ Accept: 'application/vnd.github+json', ...(etag ? { 'If-None-Match': etag } : {}) }),
      })
      if (a.status === 304) return { eintraege: null, etag }
      // Leeres Repo (noch kein Commit) oder Zweig fehlt: einfach leer.
      if (a.status === 409 || a.status === 404) {
        const probe = await abruf(basis, { headers: kopf() })
        if (probe.status === 404) throw new ZugriffFehler(404)
        return { eintraege: [], etag: null }
      }
      if (!a.ok) throw new NetzFehler(`tree ${a.status}`)
      const j = (await a.json()) as { tree: { path: string; sha: string; type: string }[] }
      return {
        eintraege: j.tree.filter((e) => e.type === 'blob').map((e) => ({ pfad: e.path, sha: e.sha })),
        etag: a.headers.get('etag'),
      }
    },

    async texte(shas) {
      const ergebnis = new Map<string, string>()
      const offen = [...new Set(shas)]
      // GraphQL: bis zu 80 Dateien je Anfrage.
      for (let i = 0; i < offen.length; i += 80) {
        const stueck = offen.slice(i, i + 80)
        const felder = stueck.map((s, n) => `f${n}: object(oid: "${s}") { ... on Blob { text isTruncated } }`).join('\n')
        const abfrage = `query { repository(owner: "${repo.besitzer}", name: "${repo.repo}") { ${felder} } }`
        try {
          const a = await abruf(`${API}/graphql`, {
            method: 'POST',
            headers: kopf({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ query: abfrage }),
          })
          const j = (await a.json()) as { data?: { repository?: Record<string, { text: string | null; isTruncated: boolean } | null> } }
          const r = j.data?.repository
          stueck.forEach((s, n) => {
            const f = r?.[`f${n}`]
            if (f && f.text != null && !f.isTruncated) ergebnis.set(s, f.text)
          })
        } catch (e) {
          if (e instanceof ZugriffFehler && e.status === 401) throw e
        }
      }
      // Rückfall: was GraphQL nicht geliefert hat, einzeln per REST (6 parallel).
      const rest = offen.filter((s) => !ergebnis.has(s))
      let zeiger = 0
      await Promise.all(
        Array.from({ length: Math.min(6, rest.length) }, async () => {
          while (zeiger < rest.length) {
            const s = rest[zeiger++]!
            ergebnis.set(s, await blobText(s))
          }
        }),
      )
      return ergebnis
    },

    async blob(sha) {
      const a = await abruf(`${basis}/git/blobs/${sha}`, { headers: kopf({ Accept: 'application/vnd.github.raw+json' }) })
      if (!a.ok) throw new NetzFehler(`blob ${a.status}`)
      return a.blob()
    },

    async lesen(pfad) {
      const a = await abruf(`${pfadUrl(pfad)}?ref=${encodeURIComponent(repo.zweig)}`, {
        headers: kopf({ Accept: 'application/vnd.github+json' }),
      })
      if (a.status === 404) return null
      if (!a.ok) throw new NetzFehler(`contents ${a.status}`)
      const j = (await a.json()) as { sha: string; content?: string; encoding?: string }
      const text = j.content && j.encoding === 'base64' ? base64ZuText(j.content) : await blobText(j.sha)
      return { sha: j.sha, text }
    },

    async schreiben(pfad, base64, sha, nachricht) {
      const a = await abruf(pfadUrl(pfad), {
        method: 'PUT',
        headers: kopf({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: nachricht, content: base64, branch: repo.zweig, ...(sha ? { sha } : {}) }),
      })
      if (a.status === 409 || a.status === 422) throw new KonfliktFehler(pfad)
      // 404 mit SHA: Datei wurde inzwischen gelöscht; ohne SHA: kein Zugriff aufs Repo.
      if (a.status === 404) throw sha ? new KonfliktFehler(pfad) : new ZugriffFehler(404)
      if (!a.ok) throw new NetzFehler(`put ${a.status}`)
      const j = (await a.json()) as { content: { sha: string } }
      return j.content.sha
    },

    async loeschen(pfad, sha, nachricht) {
      const a = await abruf(pfadUrl(pfad), {
        method: 'DELETE',
        headers: kopf({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ message: nachricht, sha, branch: repo.zweig }),
      })
      if (a.status === 404) return
      if (a.status === 409 || a.status === 422) throw new KonfliktFehler(pfad)
      if (!a.ok) throw new NetzFehler(`delete ${a.status}`)
    },
  }
}

/** Prüft einen neuen Schlüssel: Zugriff auf das Daten-Repo. */
export async function datenRepoPruefen(token: string, repo: DatenRepo): Promise<'ok' | 'ungueltig' | 'kein-repo' | 'netz'> {
  try {
    const a = await fetch(`${API}/repos/${repo.besitzer}/${repo.repo}`, {
      cache: 'no-store',
      headers: { Authorization: `Bearer ${token}`, 'X-GitHub-Api-Version': '2022-11-28' },
    })
    if (a.status === 401) return 'ungueltig'
    if (!a.ok) return 'kein-repo'
    return 'ok'
  } catch {
    return 'netz'
  }
}
