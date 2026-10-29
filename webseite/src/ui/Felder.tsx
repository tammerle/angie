import { Eye, EyeOff, type LucideIcon } from 'lucide-react'
import { useId, useLayoutEffect, useRef, useState, type InputHTMLAttributes, type TextareaHTMLAttributes } from 'react'

interface FeldEigenschaften extends InputHTMLAttributes<HTMLInputElement> {
  label?: string
  symbol?: LucideIcon
  zusatz?: string
  fehler?: string | null
  hinweis?: string
}

export function Feld({ label, symbol: Symbol, zusatz, fehler, hinweis, className = '', ...rest }: FeldEigenschaften) {
  const id = useId()
  return (
    <label className={`feld ${className}`} htmlFor={id}>
      {label && (
        <span className="feld__label">
          {label} {zusatz && <small>({zusatz})</small>}
        </span>
      )}
      <span className="feld__huelle">
        {Symbol && <Symbol className="feld__symbol" size={18} />}
        <input id={id} className={`eingabe ${Symbol ? 'eingabe--symbol' : ''}`} {...rest} />
      </span>
      {fehler ? <span className="feld__fehler">{fehler}</span> : hinweis ? <span className="feld__hinweis">{hinweis}</span> : null}
    </label>
  )
}

export function PasswortFeld({
  label,
  symbol: Symbol,
  zeigen,
  verbergen,
  fehler,
  hinweis,
  ...rest
}: FeldEigenschaften & { zeigen: string; verbergen: string }) {
  const id = useId()
  const [sichtbar, setSichtbar] = useState(false)
  return (
    <label className="feld" htmlFor={id}>
      {label && <span className="feld__label">{label}</span>}
      <span className="feld__huelle">
        {Symbol && <Symbol className="feld__symbol" size={18} />}
        <input
          id={id}
          className={`eingabe eingabe--aktion ${Symbol ? 'eingabe--symbol' : ''}`}
          type={sichtbar ? 'text' : 'password'}
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          {...rest}
        />
        <button
          type="button"
          className="symbol feld__aktion"
          onClick={() => setSichtbar((s) => !s)}
          aria-label={sichtbar ? verbergen : zeigen}
          aria-pressed={sichtbar}
        >
          {sichtbar ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      </span>
      {fehler ? <span className="feld__fehler">{fehler}</span> : hinweis ? <span className="feld__hinweis">{hinweis}</span> : null}
    </label>
  )
}

/** Textfeld, das mit dem Inhalt mitwächst. */
export function Textbereich({
  label,
  minZeilen = 3,
  className = '',
  ...rest
}: TextareaHTMLAttributes<HTMLTextAreaElement> & { label?: string; minZeilen?: number }) {
  const id = useId()
  const ref = useRef<HTMLTextAreaElement>(null)
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight + 2}px`
  }, [rest.value])
  const feld = <textarea id={id} ref={ref} rows={minZeilen} className={`eingabe ${className}`} {...rest} />
  if (!label) return feld
  return (
    <label className="feld" htmlFor={id}>
      <span className="feld__label">{label}</span>
      {feld}
    </label>
  )
}

export function Segment<T extends string>({
  wert,
  optionen,
  aendern,
  label,
}: {
  wert: T
  optionen: { wert: T; text: string; symbol?: LucideIcon }[]
  aendern: (w: T) => void
  label: string
}) {
  const index = Math.max(0, optionen.findIndex((o) => o.wert === wert))
  return (
    <div className="segment" role="group" aria-label={label}>
      <span
        className="segment__marke"
        style={{ width: `calc((100% - 8px) / ${optionen.length})`, transform: `translateX(${index * 100}%)` }}
      />
      {optionen.map(({ wert: w, text, symbol: S }) => (
        <button key={w} type="button" className="segment__wahl" aria-pressed={w === wert} onClick={() => aendern(w)}>
          {S && <S size={17} />}
          {text}
        </button>
      ))}
    </div>
  )
}
