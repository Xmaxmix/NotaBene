# Klavier-Übeplan

Kleine, serverlose Web-App für ein iPad am Klavier. Die Website kann statisch auf GitHub Pages liegen; Übungseinträge bleiben im Browser-Speicher dieses iPads.

## Dateien

- `index.html`: Oberfläche
- `style.css`: Gestaltung
- `app.js`: Kalender, Berechnung, Speicherung und Backup
- `stuecke.json`: Stückliste mit drei Beispielen

Alle vier Dateien gehören ins **gleiche Verzeichnis**. Die App ist nicht zum direkten Öffnen von `index.html` über `file://` vorgesehen: `stuecke.json` wird per `fetch` geladen und benötigt einen Webserver (etwa GitHub Pages).

## Auf GitHub Pages veröffentlichen

1. Kostenloses GitHub-Konto erstellen oder vorhandenes Konto nutzen.
2. Neues **öffentliches** Repository anlegen, zum Beispiel `klavier-uebeplan`. Die Stückliste und der Quellcode in diesem Repository sind öffentlich, nicht aber die auf dem iPad lokal gespeicherten Häkchen.
3. Diese vier Dateien ins Hauptverzeichnis des Repositorys hochladen. Achte auf exakt gleiche Dateinamen.
4. In den Repository-Einstellungen unter **Pages** die Veröffentlichung aus dem Branch `main` und dem Ordner `/ (root)` auswählen und speichern.
5. Die dort angezeigte Website-Adresse in Safari auf dem iPad öffnen. Wenn die Seite anfangs noch nicht erreichbar ist, kurz warten und erneut laden.
6. Über das Teilen-Menü in Safari **Zum Home-Bildschirm** wählen; wenn angeboten, **Als Web-App öffnen** aktivieren. Danach die App immer über dieses Symbol öffnen. Safari und Homescreen-Web-App können getrennte Speicherbereiche haben.

Zum Ändern eines Stücks die Datei `stuecke.json` im GitHub-Repository bearbeiten und die Website neu laden. Verwende keine doppelte `id` und ändere die `id` eines bereits genutzten Stücks nicht, sonst erscheinen seine bisherigen Häkchen nicht mehr unter diesem Stück. Die Beispieldaten dürfen vor dem ersten Gebrauch ersetzt werden. Wer nachträglich die Intervalle oder den ersten Termin ändert, ändert damit auch die rückwirkend berechneten historischen Fälligkeitsmarkierungen; tatsächliche Übungstage bleiben erhalten.

## Format der Stückliste

```json
[
  {
    "id": "bach-bwv-847",
    "titel": "Präludium und Fuge c-Moll",
    "werknummer": "BWV 847",
    "tonart": "c-Moll",
    "intervallTage": 3,
    "ersterTermin": "2026-09-25"
  }
]
```

`ersterTermin` muss im Format `JJJJ-MM-TT` stehen; `intervallTage` ist eine positive ganze Zahl. `id` darf nur Kleinbuchstaben ohne Umlaute, Ziffern, Bindestriche und Unterstriche enthalten und muss eindeutig sein. Um ein neues Stück hinzuzufügen, ergänze ein weiteres Objekt mit Komma zwischen den Objekten. Als Datum gilt der lokale Kalendertag des iPads.

## Berechnung

- Ein Stück ist am ersten Termin fällig, sofern es nicht geübt wurde.
- Nach einer Übung wird es `intervallTage` Kalendertage später wieder fällig.
- Wird ein Fälligkeitstag ausgelassen, bleibt das Stück bis zum tatsächlichen Üben täglich als überfällig markiert. Die alte Wiederholung wird nicht nachgeholt oder mehrfach aufaddiert.
- Vergangene Zellen zeigen den damaligen Zustand auf Basis der gespeicherten Übungstage; nur die heutige Zelle ist anklickbar. Ein Häkchen heute kann am selben Tag zurückgenommen werden.
- Zukünftige „Geplant“-Markierungen sind eine unverbindliche Vorschau: Wenn ein Stück heute bereits fällig oder überfällig ist, setzt die Vorschau eine mögliche Übung morgen voraus. Die tatsächliche künftige Folge beginnt erst, wenn du ein Häkchen setzt.

## Datensicherung und Grenzen

**Regelmäßig „Backup exportieren“** und die heruntergeladene JSON-Datei außerhalb der App aufbewahren. „Backup importieren“ ersetzt nach Rückfrage alle bisherigen Häkchen auf dem Gerät durch die Einträge im Backup; es verändert nicht die Stückliste. Löschen von Websitedaten, Neuinstallation oder Gerätewechsel kann lokal gespeicherte Häkchen entfernen. Private Browserfenster nicht verwenden. Die App ist nicht als Offline-Web-App eingerichtet: Zum Laden bzw. Aktualisieren braucht sie eine Internetverbindung. Wenn du später die Website-Adresse wechselst oder statt des Homescreen-Symbols Safari verwendest, können dort andere lokale Daten sichtbar sein; dann ein Backup importieren.

Hinweis: Der Browser wurde hier nicht automatisiert auf einem iPad getestet. Nach dem Veröffentlichen empfiehlt sich ein kurzer Funktionstest mit einem Probe-Häkchen, Rücknahme, Backup-Export und -Import.