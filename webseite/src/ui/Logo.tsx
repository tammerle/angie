import { useT } from '../i18n/index.ts'

/** Kleine Rose als Zeichen des Salons (statt Herz). */
export function Rose({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M7 8.6c0 3.9 2.2 6.4 5 6.4s5-2.5 5-6.4" />
      <path d="M7 8.6c1-1.6 2.6-1.9 3.6-.8M17 8.6c-1-1.6-2.6-1.9-3.6-.8" />
      <path d="M10.6 7.8c.3-1.6 1.4-2.5 2.6-2.2 1.3.3 1.7 1.8.8 3-.8 1-2.3 1.1-2.9.2-.5-.7-.1-1.6.7-1.7" />
      <path d="M15 10.2c-.5 1.7-1.9 2.8-3.6 2.9" />
      <path d="M12 15v6" />
      <path d="M12 18.2c-1.2-1.6-3.2-2-4.6-1.2 1 1.7 3 2.2 4.6 1.2ZM12 17.3c1-1.3 2.7-1.6 3.9-1-.8 1.4-2.5 1.8-3.9 1Z" />
    </svg>
  )
}

export function Logo({ art = 'kopf' }: { art?: 'kopf' | 'gross' }) {
  const t = useT()
  return (
    <span className={`logo logo--${art}`} aria-label={`${t.app.name} – ${t.app.unter}`}>
      <span className="logo__wort">
        {t.app.name}
        <Rose className="logo__rose" />
      </span>
      <span className="logo__unter">{t.app.unter}</span>
    </span>
  )
}
