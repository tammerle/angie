// Erzeugt App-Symbole (Home-Bildschirm, Favicon) aus der Rose des Logos.
//   node scripts/symbole-erzeugen.mjs
import { Resvg } from '@resvg/resvg-js'
import { mkdirSync, writeFileSync } from 'node:fs'

// Gleiche Pfade wie <Rose /> in src/ui/Logo.tsx
const ROSE = `
  <path d="M7 8.6c0 3.9 2.2 6.4 5 6.4s5-2.5 5-6.4" />
  <path d="M7 8.6c1-1.6 2.6-1.9 3.6-.8M17 8.6c-1-1.6-2.6-1.9-3.6-.8" />
  <path d="M10.6 7.8c.3-1.6 1.4-2.5 2.6-2.2 1.3.3 1.7 1.8.8 3-.8 1-2.3 1.1-2.9.2-.5-.7-.1-1.6.7-1.7" />
  <path d="M15 10.2c-.5 1.7-1.9 2.8-3.6 2.9" />
  <path d="M12 15v6" />
  <path d="M12 18.2c-1.2-1.6-3.2-2-4.6-1.2 1 1.7 3 2.2 4.6 1.2ZM12 17.3c1-1.3 2.7-1.6 3.9-1-.8 1.4-2.5 1.8-3.9 1Z" />`

function svg({ groesse = 512, anteil = 0.62, rund = 0 } = {}) {
  const s = (groesse * anteil) / 24
  // Die Rose reicht in y von 5.4 bis 21, in x von 7 bis 17: Mitte (12 | 13.2).
  const x = groesse / 2 - 12 * s
  const y = groesse / 2 - 13.2 * s
  return `<svg xmlns="http://www.w3.org/2000/svg" width="${groesse}" height="${groesse}" viewBox="0 0 ${groesse} ${groesse}">
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0" stop-color="#fcf1f4"/>
      <stop offset="1" stop-color="#f1d3dc"/>
    </linearGradient>
  </defs>
  <rect width="${groesse}" height="${groesse}" rx="${rund}" fill="url(#g)"/>
  <g transform="translate(${x} ${y}) scale(${s})" fill="none" stroke="#c25b7a" stroke-width="1.35" stroke-linecap="round" stroke-linejoin="round">${ROSE}
  </g>
</svg>`
}

const ziel = new URL('../public/symbole/', import.meta.url)
mkdirSync(ziel, { recursive: true })

const png = (s, groesse) => new Resvg(s, { fitTo: { mode: 'width', value: groesse } }).render().asPng()

writeFileSync(new URL('apple-touch-icon.png', ziel), png(svg({ groesse: 180 }), 180))
writeFileSync(new URL('icon-192.png', ziel), png(svg({ groesse: 192 }), 192))
writeFileSync(new URL('icon-512.png', ziel), png(svg({ groesse: 512 }), 512))
writeFileSync(new URL('maskable-512.png', ziel), png(svg({ groesse: 512, anteil: 0.48 }), 512))
writeFileSync(new URL('../favicon.svg', ziel), svg({ groesse: 64, anteil: 0.74, rund: 14 }))
console.log('Symbole geschrieben: public/symbole/, public/favicon.svg')
