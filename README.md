<!-- ===== HERO (custom SVG — assets/banner.svg) — a dusk sky, the ensemble fanning out from "now" ===== -->
<img width="100%" src="https://raw.githubusercontent.com/Jan-ARN/nimbus/main/assets/banner.svg" alt="Nimbus — der Himmel über Köln"/>

<div align="center">

### Viele Wettermodelle, ein lebendiger Himmel.

Eine kleine Wetter-App für Köln, die **mehrere Vorhersagemodelle vergleicht** und deren ganzes UI sich **an die echte Wetterlage anpasst** — der Hintergrund *ist* die Vorhersage: die 31 Ensemble-Läufe fächern als lebendiges Bündel über den Bildschirm, heißer Tag → Amber, klare Nacht → Sterne, Regen → Tropfen, Gewitter → Blitze.

<br/>

![version](https://img.shields.io/badge/version-0.1.0-243F52?labelColor=162936&style=flat-square)
![license](https://img.shields.io/badge/license-MIT-456A82?labelColor=162936&style=flat-square)
![Vue 3 + Vite](https://img.shields.io/badge/Vue%203-Vite-F0C880?labelColor=162936&style=flat-square)
![just for fun](https://img.shields.io/badge/just-for%20fun-456A82?labelColor=162936&style=flat-square)

**[→ Live ansehen](https://jan-arn.github.io/nimbus/)**

</div>

> Ein kleines Hobbyprojekt — entstanden, weil der Sommer hart war und sich die Wetter-Apps ständig widersprochen haben. Kein Produkt, einfach zum Spaß gebaut.

## Was drin ist

- **Modelle** — aktuelle Lage (gefühlt, Wind, UV, Luft, Pollen, Sonne) plus Vergleich der Einzelmodelle (ICON, ECMWF, GFS, …) und ein aufklappbarer 16-Tage-Ausblick.
- **Langfrist** — bis ~35 Tage aus dem GEFS-Ensemble: Median-Höchstwert + Streuband (je breiter, desto unsicherer) und der Trend „wärmer/kälter als heute".
- **Luft** — Luftqualität (EAQI + Schadstoffe) und Pollenflug.
- **Lebendiger Himmel** — das Ensemble-Feld im Hintergrund und die Farbpalette folgen den echten Bedingungen des aktiven Orts. DWD-Unwetterwarnungen (Bright Sky) erscheinen als Banner.

## Ein bisschen Meteorologie

Jenseits von ~7–10 Tagen gibt es keine präzise Einzelzahl. Nimbus zeigt darum den **Median aus 31 Simulationen** plus ein Streuband, statt eine scharfe Grad-Zahl vorzugaukeln — im Nahbereich belastbar, weiter draußen ehrlich unsicher.

## Stack

Vue 3 + Vite + TypeScript · Tailwind CSS + reka-ui · Pinia · TanStack Query · lucide-Icons.
Fonts: Bricolage Grotesque / Hanken Grotesk / JetBrains Mono.

Rein statisch — alle Quellen ([Open-Meteo](https://open-meteo.com), [Bright Sky](https://brightsky.dev)) sind kostenlos, key-frei und CORS-fähig und werden direkt aus dem Browser aufgerufen. Kein Backend, kein API-Key.

## Loslegen

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/  (typecheck + statischer Build)
```

Deploy nach GitHub Pages passiert automatisch bei jedem Push auf `main` (siehe `.github/workflows/deploy.yml`).

<div align="center"><br/><sub>MIT · gebaut mit ☕ und zu viel Sonne über Köln</sub></div>
