# Changelog

## 1.2.0 — 2026-09-18

- Karte, Editor, zugängliche Beschriftungen und eigene Fehlermeldungen übersetzt: Englisch als Standard/Fallback, dazu Deutsch, Niederländisch und Französisch.
- Automatische Sprachwahl anhand des Home-Assistant-Profils einschließlich regionaler Varianten und Sprachwechsel ohne Verlust des Editorzustands.
- Übersetzungen im Einzeldatei-Bundle; gemeinsamer Cache bleibt sprachunabhängig.
- Englische GitHub-README und Übersetzungsleitfaden. Buy-Me-a-Coffee-Link als ausdrücklich gekennzeichneter Dummy. Apache-2.0-Lizenz einschließlich Lizenztext im JavaScript-Bundle.

## 1.1.4 — 2026-09-18

- Optional zentrierte Szenentitel im internen Renderer.
- Kategorieüberschriften und getrennte Grids für aktuell sichtbare Presets, ohne leere Abschnitte.
- Aktualisierungssymbol optional ausblendbar; dazu passende Fehler- und Statushinweise.
- Alle drei Optionen im grafischen Editor unter Darstellung verfügbar.
- 15 Kernprüfungen und erweiterte Browsertests bestanden.

## 1.1.3 — 2026-09-18

- Infosymbole und Service-Aufrufvorschau vollständig entfernt, einschließlich Hold-/Kontextmenü-Handlern.
- Namensdarstellung nutzt den bisherigen Platz des Infosymbols.

## 1.1.2 — 2026-09-18

- Auslieferung als einzelne JavaScript-Datei: Versionswechsel aktualisiert jetzt auch Karte, Editor und alle Untermodulfunktionen.
- Sichtbare Versionsnummer im Editor und im Debug-Panel.
- Fehler mit gefülltem HTTP-Cache reproduziert und behobenes Verhalten in Chromium geprüft.
- Modularer Quellcode bleibt unter src/; reproduzierbarer Build mit esbuild.

## 1.1.1 — 2026-09-18

- HTTP 404 mit konkretem Hinweis zur Aktivierung der Integration und Retry im Editor.
- Kategorieauswahl zeigt nur Kategorien mit per Kartenfilter zugelassenen Presets; verwaiste Runtime-Auswahl wird zurückgesetzt.
- Editor mit getrennten, einklappbaren Abschnitten, verständlichen Feldnamen und Hilfetexten; Suchtexte und offene Bereiche bleiben erhalten.
- Sprachumfang dokumentiert: derzeit Deutsch, keine automatische Lokalisierung.
- 15 Kernprüfungen und erweiterte Chromium-Browsertests bestanden.

## 1.1.0 — 2026-09-18

- Automatische Preset-, Kategorie- und Bild-Discovery einschließlich Custom Presets.
- Modularer Adapter, gemeinsamer Cache und Fingerprint-Validierung.
- Normal/Dynamic, zentrale Targets, Overrides, Shuffle und Smart Shuffle.
- Include/Exclude, Suche, Kategorien und grafischer Editor.
- Interner Renderer und optionale Lovelace/button-card-Renderer mit Fallback.
- User/Global-Favoriten mit Namespaces, HA-Rechten und verfügbarer Live-Synchronisation.
- Runtime-Persistenz, Dynamic-Snapshot, Stop und Service-Preview.
- Externe Vertragsdokumentation und automatisierte Tests.
