# angie – Webseite

React 19 + TypeScript, gebaut mit Vite. Getestet mit Vitest und Testing Library, geprüft mit oxlint.

## Befehle

| Befehl | Was passiert |
| --- | --- |
| `npm install` | Pakete installieren (einmal nach dem Klonen) |
| `npm run dev` | Entwicklungsserver auf http://localhost:5200 |
| `npm run build` | Typprüfung und fertige Seite nach `dist/` |
| `npm run preview` | Gebaute Seite auf http://localhost:5201 ansehen |
| `npm test` | Tests einmal laufen lassen |
| `npm run test:watch` | Tests bei jeder Änderung neu laufen lassen |
| `npm run lint` | Code mit oxlint prüfen |
| `npm run check` | Typen, Lint und Tests in einem Schritt |

## Aufbau

- `src/main.tsx` – Einstieg, hängt `App` in `index.html` ein
- `src/App.tsx` – Startseite
- `src/index.css` – Grundstile mit Farben für hell und dunkel
- `src/test/setup.ts` – Testumgebung (jsdom, jest-dom-Matcher)
- `public/` – Dateien, die unverändert ausgeliefert werden (Favicon, Bilder)
