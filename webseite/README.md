# Salon · Karteikarten

Kundenkartei für den Salon Rose: Kunden mit Notizen und Fotos, gemeinsame Notizen mit Ordnern,
Profile mit Wohlbefinden. Mobile first fürs iPhone, genauso am Computer. Läuft komplett auf GitHub:
die Seite auf GitHub Pages (https://tammerle.github.io/angie/), die Daten in einem privaten Repo.

React 19 + TypeScript, gebaut mit Vite. Getestet mit Vitest und Testing Library, geprüft mit oxlint.

## So funktioniert es

- **Anmeldung:** zwei Benutzerinnen (angie, eli). Aus dem Passwort leitet Argon2id (64 MiB, 3 Durchläufe)
  im Browser einen Schlüssel ab. Er öffnet einen Hauptschlüssel, und der entschlüsselt den GitHub-Schlüssel
  (AES-GCM). Gespeichert ist nur `../zugang/zugang.json` mit Salzen und verschlüsselten Blöcken, nie ein Passwort.
- **Daten:** privates Repo `tammerle/angie-daten`, eine Datei je Kunde, Notiz, Ordner und Profil, Fotos als JPEG
  mit Vorschaubild. Beide sehen und bearbeiten alles.
- **Lokal zuerst:** Jede Änderung wirkt sofort und liegt in IndexedDB. Eine Warteschlange lädt im Hintergrund
  hoch (auch nach Offline-Phasen), alle 15 s und beim Zurückkehren in die App kommen Änderungen der anderen herein.
- **Konflikte:** Haben beide dieselbe Datei geändert, wird feldweise zusammengeführt. Wurde derselbe Text
  verschieden geändert, bleiben beide Fassungen in zwei Blöcken in der Notiz erhalten.
- **App-Gefühl:** Hash-Routing (kein Server nötig), Seitenwechsel mit View Transitions, Service Worker für
  schnelles Laden und Offline-Start, zum Home-Bildschirm hinzufügbar.

## Einrichtung (einmalig)

1. Auf GitHub ein **privates** Repository `angie-daten` anlegen (leer reicht).
2. Einen **Fine-grained Token** erstellen: Repository access „Only select repositories“ → `angie-daten` und `angie`,
   Permissions → Contents „Read and write“.
3. Die Seite öffnen, als angie oder eli anmelden und den Token unter „Einrichtung“ einfügen. Er wird verschlüsselt in
   `zugang/zugang.json` abgelegt; danach reicht auf jedem Gerät Benutzername + Passwort.

## Befehle

| Befehl | Was passiert |
| --- | --- |
| `npm install` | Pakete installieren (einmal nach dem Klonen) |
| `npm run dev` | Entwicklungsserver auf http://localhost:5200 (echte Daten über GitHub) |
| `npm run demo` | Testbetrieb ohne GitHub (Daten nur im Browser, Passwort `Demo_123!`) |
| `npm run build` | Typprüfung und fertige Seite nach `dist/` |
| `npm run preview` | Gebaute Seite auf http://localhost:5201 ansehen |
| `npm test` | Tests einmal laufen lassen |
| `npm run check` | Typen, Lint und Tests in einem Schritt |
| `node scripts/zugang-erzeugen.ts …` | Zugangsdatei neu erzeugen (Passwörter nur per Umgebungsvariable) |
| `node scripts/symbole-erzeugen.mjs` | App-Symbole aus der Rose neu erzeugen |

Jeder Push auf `main`, der `webseite/` ändert, baut und veröffentlicht die Seite (`.github/workflows/webseite.yml`).

## Aufbau

- `src/daten/` – Sitzung und Anmeldung, Speicher mit Warteschlange und Abgleich, GitHub-Anbindung, Zusammenführung
- `src/lib/` – Verschlüsselung (Argon2 im Worker, AES), Router, Bildverkleinerung, Helfer
- `src/seiten/` – Anmelden/Einrichtung, Kunden, Kunden-Detail, Notizen, Übersicht, Profil, Einstellungen
- `src/ui/` – Bausteine (Logo, Avatar, Felder, Blatt, Status, Fotos, Profilmenü)
- `src/i18n/` – Texte auf Deutsch, Italienisch und Englisch
- `src/styles/` – Farben (hell/dunkel), Rahmen, Seiten
- `public/` – Manifest, Service Worker, App-Symbole
