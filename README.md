# 💞 kitti-hub

Eine kleine Handy-App für genau zwei Menschen. Was einer einträgt, sieht der
andere sofort – Kalender, Listen, Ausgaben und die Dinge, die nur euch gehören.

Technisch eine **PWA**: läuft im Browser, lässt sich auf dem Homescreen
installieren wie eine normale App, funktioniert offline und synchronisiert
über [Supabase](https://supabase.com) in Echtzeit.

## Was drin ist

| Bereich | Inhalt |
| --- | --- |
| **Wir** | Tage-zusammen-Zähler, nächster Jahrestag, was heute ansteht, Stimmungs-Check für beide, letzte Liebesnachricht |
| **Kalender** | Gemeinsame Termine als Agenda, kommend und vergangen, mit Ort und Notiz |
| **Listen** | To-dos (mit Fälligkeit und „wer macht's") und Einkaufsliste, beide live geteilt |
| **Geld** | Ausgaben erfassen, halbe-halbe oder ganz übernommen, laufender Saldo und Ausgleichsbuchung |
| **Extras** | Liebesnachrichten, Date-Bucketlist mit Zufallsgenerator, wiederkehrende Anlässe |
| **Mehr** | Profil, wer bin ich auf diesem Gerät, Verbindungsstatus, Einladungslink, Export |

## Einrichten (einmalig, ca. 5 Minuten)

### 1. Datenspeicher anlegen

1. Auf [supabase.com](https://supabase.com) kostenlos anmelden, neues Projekt anlegen.
2. Im Projekt **SQL Editor → New query** öffnen, den Inhalt von
   [`supabase/schema.sql`](supabase/schema.sql) einfügen und **Run** drücken.
3. Unter **Project Settings → API** zwei Werte kopieren:
   - `Project URL` (sieht aus wie `https://abcdefgh.supabase.co`)
   - `anon` `public` Key (der lange Schlüssel)

Der kostenlose Tarif reicht für zwei Personen mit großem Abstand.

### 2. App online stellen

Die App besteht nur aus statischen Dateien – jeder Static-Host tut es.
Mit GitHub Pages:

**Settings → Pages → Source: Deploy from a branch → Branch: `main` / `root`**

Nach ein bis zwei Minuten liegt sie unter
`https://<dein-name>.github.io/<repo>/`.

Lokal ausprobieren geht auch:

```bash
python3 -m http.server 8137   # dann http://localhost:8137 öffnen
```

> Wichtig: Nicht die `index.html` per Doppelklick öffnen – ES-Module und der
> Service Worker brauchen `http(s)://`.

### 3. Auf beiden Handys öffnen

1. **Du** öffnest die Seite, trägst eure Namen, euer Anfangsdatum, die
   Projekt-URL und den Anon Key ein. Der **Paar-Code** ist schon vorausgefüllt –
   er ist euer gemeinsamer Raum.
2. **Einladungslink teilen** (unter *Mehr → Verbindung*) schickst du an deine
   Freundin. Der Link enthält alle Verbindungsdaten; sie muss nur noch
   bestätigen, wer sie ist.
3. Beide: im Browsermenü **„Zum Home-Bildschirm hinzufügen"** – danach startet
   sie wie eine echte App, ohne Adressleiste.

## Wie der Sync funktioniert

Alles ist ein Eintrag: `{ id, room, kind, data, updated_at, deleted }`. Eine
Tabelle, ein Realtime-Kanal, eine Konfliktregel – der neuere Zeitstempel
gewinnt.

- Geschrieben wird **immer zuerst lokal** (`localStorage`), danach hochgeladen.
- Kein Netz? Der Eintrag wandert in eine Warteschlange und geht raus, sobald
  die Verbindung zurück ist. Der Status oben rechts zeigt „Live", „Offline"
  oder „Lokal".
- Gelöscht wird weich (`deleted = true`), sonst käme die Löschung beim Partner
  nie an.

## Zur Sicherheit – ehrlich gesagt

Die App hat bewusst **keine Benutzeranmeldung**: euer Paar-Code ist der
Schlüssel zum Raum, und der Anon Key darf lesen und schreiben. Das heißt:

- Wer **beides** kennt (Paar-Code *und* Anon Key), könnte eure Einträge sehen.
- Nehmt deshalb den langen, zufällig erzeugten Paar-Code aus der App und
  schickt den Einladungslink nur an sie – nicht in Gruppenchats.
- Für ein Zwei-Personen-Projekt ist das ein bewusster Tausch: keine Passwörter,
  keine Konten, kein Login-Frust. Wenn ihr es strenger wollt, ist Supabase Auth
  mit `auth.uid()`-Policies der nächste Schritt.

Für Bank- oder Gesundheitsdaten ist die App nicht gedacht.

## Aufbau

```
index.html              App-Hülle
css/styles.css          Design-System (hell + dunkel, mobil zuerst)
js/app.js               Einrichtung, Navigation, Rendering
js/store.js             Datenmodell, lokaler Cache, CRUD
js/sync.js              Supabase: Pull, Realtime, Upload-Warteschlange
js/model.js             Abgeleitete Werte (Saldo, Jahrestage, Agenda)
js/ui.js                DOM-Helfer, Icons, Datums-/Geldformatierung
js/views/*.js           Die sechs Tabs
js/vendor/supabase.js   supabase-js v2 (MIT), mitgeliefert statt per CDN
supabase/schema.sql     Datenbank-Setup
sw.js                   Service Worker (offline)
```

Kein Build-Schritt, keine Abhängigkeiten zum Installieren, kein `node_modules`.
Datei ändern, neu laden, fertig.

## Anpassen

- **Farben**: die Variablen ganz oben in `css/styles.css` (`--coral`, `--plum`, …).
- **Stimmungs-Emojis**: `MOODS` in `js/views/home.js`.
- **Ausgaben-Kategorien**: `CATEGORIES` in `js/views/money.js`.
- **Date-Kategorien**: `TAGS` in `js/views/us.js`.
- **Neuer Datentyp**: `KINDS` in `js/store.js` erweitern und eine View dazu –
  Sync und Offline-Verhalten gelten automatisch mit.
