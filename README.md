# Habbix UI, Funktionen & Angelplugin für habbo.am

Stand: 13.10.2026. Dieses Repository ergänzt einen bereits vorhandenen Octane-Client und einen passenden Polaris-Emulator. Es enthält normale Dateien und Ordner, kein vollständiges Octane-Projekt und keine Upload-ZIPs.

## Inhalt

- `client-ui/src`: geänderte und zusätzliche UI-Komponenten, Funktionen, CSS, Tests sowie sämtliche Client-Bilder, Icons und Schriftdateien. Unveränderte Client-Komponenten kommen aus dem vorhandenen Octane-Projekt.
- `client-ui/public`: zugehörige öffentliche Assets, eigene Fischgrafiken und deutsche Texte.
- `renderer-overlay`: die geänderten Renderer-Dateien für Verbindungsverwaltung und Raumeinladungen; kein kompletter Renderer.
- `polaris-overlay`: zusätzliche und geänderte Emulator-Dateien für die zugehörigen Funktionen; kein kompletter Emulator.
- `plugins/HabbixFishing`: Angelplugin-Quellcode, Tests und Kompatibilitäts-Builder.
- `plugins/website`: Website-WebSocket-Plugin-Quellcode mit den benötigten Backend-Funktionen.
- `plugins/HabbixFishing.jar` und `plugins/website-fishing.jar`: fertige Plugins für den kompatiblen Polaris-Stand.
- `cms/habbix-cms-polish.css`: CMS-Farben und UI-Anpassungen.
- `MANIFEST.json`: Dateiliste und SHA-256-Prüfsummen.

## Angelpark im Client einrichten

1. Betritt mit einem Account ab Rang 7 den gewünschten Angelraum.
2. Öffne **Eventmanager → Angelpark → Einrichtung → Aktuellen Raum laden**. Alternativ kannst du eine Raum-ID laden.
3. Klicke **Wasser auswählen**. Markiere einzelne Felder oder wähle mit **Fläche** zwei gegenüberliegende Ecken. Du kannst mehrere getrennte Wasserflächen hinzufügen. Wassermöbel lassen sich in der Möbelliste vollständig auswählen; ihre tatsächliche Größe und Drehung werden berücksichtigt.
4. Stelle den maximal erlaubten Abstand zum Wasser ein.
5. Klicke **Auswahl prüfen** und anschließend **Speichern & aktivieren**. **Als inaktiv speichern** speichert die Einrichtung ohne sie einzuschalten. Bis zum Speichern verändert die Auswahl nichts am Hotel.

Unter **Fische verwalten** kannst du Arten hinzufügen, bearbeiten oder für künftige Fänge deaktivieren. Namen, Fanghäufigkeit, Icons, Beschreibungen und Taler-/Diamantenpreise werden gespeichert. Bereits gefangene deaktivierte Arten bleiben verkaufbar.

Unter **Konfiguration** stellst du Passpreise, Fangzeiten, Fangchancen, EP pro Fang und Verkauf, Ruten-Upgrades, Verschleiß und Reparaturkosten ein. Ein gültiger Angelpass ist Pflicht.

## So spielen die Nutzer

Im festgelegten Angelraum erscheint die Angelübersicht oben mittig. Über **Pässe** kauft man einen Angelpass. Ohne gültigen Pass erscheint privat: „Deine Angel ist kaputt. Kaufe bitte einen Angelpass, um zu angeln.“

Spieler beginnen mit der Basisrute. Ein **Doppelklick aufs eingerichtete Wasser** wirft die Angel aus. Ein weiterer Doppelklick zieht bei einem Biss oder holt die Angel ein. Bewegung, Raumwechsel und Verbindungsabbruch beenden das Angeln. Zu großer Abstand und zu schnelles Klicken erzeugen private Meldungen. Fänge bringen EP und werden in der Fangtasche gespeichert. Verkäufe bringen die konfigurierten Taler, Diamanten und EP; **Ruten** schaltet bei ausreichend EP bessere Ruten frei. Öffentliche Fangtexte sind optional. Spieler brauchen keine Commands.

## Setup-Command

Ab Rang 7 kann im gewünschten Raum `:angelsetup raum` eingegeben werden. Das setzt den Angelraum zurück, entfernt seine bisherige Wasserauswahl und lässt ihn deaktiviert. **Dieser Command öffnet kein Fenster.** Für die grafische Einrichtung anschließend **Eventmanager → Angelpark → Einrichtung** öffnen. Der Assistent kann den aktuellen Raum direkt laden; dann ist der Command nicht nötig. `:angelsetup pruefen` zeigt den aktuellen Status privat an.

## Client einbinden

Vorher den vorhandenen Client sichern und in einem eigenen Git-Branch arbeiten. Die Dateien sind auf Client-Basis `787a3d0` und Renderer-Basis `5f7c4fba6d02eda062ca60df5ed34378dba5775a` abgestimmt. Bei abweichendem Stand Änderungen in die vorhandenen Dateien zusammenführen, statt sie blind zu ersetzen.

1. Den **Inhalt** von `client-ui/` in das vorhandene Octane-Verzeichnis übernehmen. Dadurch werden `src/` und `public/` ergänzt. Das komplette Octane-Projekt wird hier nicht mitgeliefert.
2. Die Dateien aus `renderer-overlay/` an dieselben relativen Pfade im vorhandenen Renderer übernehmen.
3. Bestehende `package.json`, Lockdateien, Vite-Konfiguration, SSO und Hotelkonfiguration behalten. Die neuen Komponenten nutzen die Bibliotheken des angegebenen vorhandenen Client-Stands, unter anderem React, Zustand und Framer Motion. Bei älteren Versionen Abhängigkeiten und APIs abgleichen.
4. In der Zielkonfiguration HTTP-/WebSocket-Endpunkte, API, Furni-Assets, STUN/TURN und Bootstrap passend zum eigenen Hotel einstellen. Exportierte feste Hoteladressen wurden auf `habbo.am` umgestellt. Den vorhandenen Loader und die SSO-Einbindung des Zielhotels verwenden.
5. Mit der im vorhandenen Projekt verwendeten Paketverwaltung installieren, Typecheck/Tests ausführen und den Client neu bauen. Mindestens Node.js 22.12 für den geprüften Stand verwenden.
6. Den eigenen Build in den Client-Webordner übertragen. Fischgrafiken müssen unter `/client/assets/fishing/` erreichbar sein; bei abweichendem Pfad die Icon-URLs in der Fischverwaltung anpassen.

Nur CSS zu kopieren aktiviert die zusätzlichen Funktionen nicht: Die Komponenten, ihre Imports, Renderer-Anpassungen und passenden Backend-Plugins gehören dazu.

## Polaris & Plugins unter Linux

Voraussetzungen: ein kompatibler Polaris-Fork mit den Economy-/Wallet-APIs `EconomyLedger` und `LedgerWalletMutation`, Java/JDK 25 für die fertigen JARs, Python 3 und MariaDB/MySQL. Emulator-Basis: `34bc0d49511c659fd0054d35d957669ebd6ce9ed`. Die Dateien aus `polaris-overlay/` müssen bei Bedarf in den passenden bestehenden Emulator-Quellstand integriert und dort gebaut werden. Ein fremder Core ohne diese APIs ist nicht automatisch kompatibel.

Vor Änderungen Emulator stoppen und Plugins, Client und Datenbank sichern. Die Tabellen des Angelplugins werden beim Start automatisch angelegt bzw. erweitert. Die Datenbankkennung des Emulators benötigt dafür Rechte für die eigenen Plugin-Tabellen. Ein Produktionsdump und Zugangsdaten sind nicht enthalten.

Adapter gegen die eigenen kompatiblen JARs bauen:

```sh
cd plugins/HabbixFishing
python3 build-compatible.py \
  --core /PFAD/ZUM/EMULATOR/habboje.jar \
  --website /PFAD/ZUM/EMULATOR/plugins/website.jar \
  --output ./built
```

`built/HabbixFishing.jar` und `built/website.jar` in den Plugin-Ordner übernehmen. Der Builder ersetzt im vorhandenen Website-JAR nur die drei Verwaltungs-/Sprachchat-Adapterklassen und erhält die übrigen Klassen. Fehlende APIs oder Abhängigkeiten brechen den Build ab. Für sämtliche erweiterten Client-Funktionen muss der komplette Website-Backend-Stand vorhanden sein; der Adapter ergänzt diese Funktionen nicht vollständig in ein beliebiges fremdes Plugin.

Die fertigen `plugins/HabbixFishing.jar` und `plugins/website-fishing.jar` sind für den geprüften passenden Fork gedacht. Letzteres heißt im Emulator-Plugin-Ordner `website.jar`; nicht zusätzlich zwei Website-Plugins laden. Danach Emulator starten, Website-WebSocket prüfen und den Setup-Assistenten im Client verwenden. Angeln wird nicht automatisch in einem beliebigen Raum eingeschaltet.

## Sprachchat & Rechte

Eventmanager → Sprachchat verwaltet Aktivierung, Onlinezeit, Namenslänge, Kanäle, Teilnehmer, Stummschaltung und Sperren. Einstellungen verwaltet die Mindestränge der drei neuen Bereiche; der Server erzwingt mindestens Rang 7. Teilnahme am Sprachchat bleibt eine Spielerfunktion. Tonübertragung benötigt HTTPS, Mikrofonfreigabe und eine funktionierende STUN/TURN-Konfiguration. Zugangsdaten sind nicht enthalten.

## Prüfung und Grenzen

28 gezielte Client-Tests, Typecheck und Produktionsbuild bestanden. 1.335 Java-Prüfungen einschließlich Verkäufen, Wallet-/Inventar-Rollback, EP und gleichzeitigen Doppelverkäufen bestanden in einem isolierten Schema. Produktives Angeln muss nach Auswahl echter Wasserflächen praktisch geprüft werden. Ein Sprachgespräch zwischen zwei Geräten wurde nicht durch diese Prüfungen bestätigt.

Die Prüfung gilt für den angegebenen Quellstand, nicht automatisch für eine andere Installation auf habbo.am. Bestehende GPL-Lizenztexte der Projekte gelten weiterhin. SSH-Schlüssel, Benutzer-Daten, Datenbank-Dumps, Produktions-Konfiguration, Logs und `node_modules` werden nicht veröffentlicht.
