# Einkaufs-Anker — Hinweise für KI-Assistenten

Wochenliste, Vorratsschätzung und Verschwendungsrechnung aus eigenen
Kassenbons. Kein KI-Modell zur Laufzeit, kein Server, kein Konto —
alles läuft lokal im Browser bzw. in der iOS-App. Ausführlicher
Hintergrund und Architektur-Erklärung: siehe README.md, unbedingt
zuerst lesen bei größeren Änderungen.

## Architektur — WICHTIG, bevor du etwas änderst

Es gibt drei Ebenen, in dieser Reihenfolge:

1. `src/algo/` — die eigentliche Fachlogik (Rhythmus-Berechnung,
   Vorratsschätzung, Kalenderrechnung usw.), ca. 50 reine
   Node-Module, keine UI-Bezüge. Neue Module gehören in die Liste
   `MODULES` in `build.js`, sonst landen sie nicht im Bündel; der
   Build bricht ab, wenn zwei Module denselben Namen auf oberster
   Ebene vergeben (ein Bündel, ein Namensraum).
2. `src/ui/` — die Quelldateien der Oberfläche (HTML/CSS/JS, `sw.js`,
   Icons, Fonts). `src/ui/index.html` enthält den Platzhalter
   `%%BUILD%%` statt einer festen Build-Kennung.
3. `web/` — **generierter Output**, gebaut von `build.js` aus 1+2.
   `build.js` bündelt `src/algo` zu `web/bundle.js`, kopiert die
   Oberfläche aus `src/ui` nach `web/`, und ersetzt `%%BUILD%%` durch
   einen automatisch berechneten Fingerprint-Hash. Der Service-Worker-
   Cache-Name in `sw.js` hängt an diesem Build-Hash.

**Regel: `web/` niemals direkt von Hand bearbeiten.** Änderungen dort
gehen beim nächsten Build verloren bzw. laufen aus dem Ruder, weil die
Build-Kennung dann nicht mehr zum tatsächlichen Code passt. Stattdessen
immer in `src/algo/` bzw. `src/ui/` ändern und danach bauen:

```bash
npm run build     # entspricht: node build.js
```

Das schreibt `web/` komplett neu (inkl. neuer Build-Kennung/Cache-Name).

## iOS-App (Capacitor)

`ios/App/` ist ein von Capacitor generiertes Xcode-Projekt (Swift
Package Manager, keine CocoaPods). Es lädt einfach den Ordner `web/`
als native Hülle (siehe `capacitor.config.json`, `webDir: "web"`) —
**keine eigene Codebasis**, kein Duplizieren von Logik nötig. Nach
Änderungen an `web/` (bzw. nach `npm run build`): `npx cap copy ios`,
dann in Xcode neu bauen.

Es gibt aktuell keine eigene Unterscheidung natives-vs-PWA-Verhalten
im Code mehr (die frühere `Backup.isNative()`-Prüfung fiel mit
`src/ui/backup.js` weg, siehe README, Abschnitt „Sicherung entfernt").
Sollte künftig wieder natives Sonderverhalten nötig werden, dafür neu
auf `window.Capacitor?.isNativePlatform?.()` prüfen.

## Tests

```bash
npm install     # nur für die Tests (jsdom)
npm test        # kompletter Testlauf inkl. Simulation und Langzeitlauf
```

## Workflow zwischen den beiden KI-Sitzungen an diesem Projekt

- Web-/Funktionsänderungen (`src/algo`, `src/ui`) passieren meist über
  einen Cloud-Claude-Code-Chat, der direkt gegen den `main`-Branch auf
  GitHub arbeitet.
- Native iOS-Arbeit (Xcode-Build, Signing, App-Icons, Store-Upload)
  passiert in einer separaten Sitzung mit Mac-/Xcode-Zugriff.
- Beide arbeiten auf demselben Git-Repo (`main`-Branch ist der
  gemeinsame, aktuelle Stand) — vor größeren Änderungen immer
  `git pull`.

## Konventionen

- Commit-Messages auf Deutsch, im Stil bestehender Commits (z. B.
  "iOS: Capacitor-Huelle fuer Xcode hinzugefuegt").
- Eine Quelle der Wahrheit für Fachlogik: `src/algo` — nicht in der
  Oberfläche duplizieren.
