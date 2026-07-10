<!-- ===== HERO (custom SVG — assets/banner.svg) — a dusk sky, the ensemble fanning out from "now" ===== -->
<img width="100%" src="https://raw.githubusercontent.com/Jan-ARN/nimbus/main/assets/banner.svg" alt="Nimbus — the sky over Cologne"/>

<div align="center">

### Many weather models, one living sky.

A small weather app for Cologne that **compares several forecast models** and whose entire UI **adapts to the actual conditions** — the background *is* the forecast: the 31 ensemble runs fan out as a living bundle across the screen, hot day → amber, clear night → stars, rain → drops, thunderstorm → lightning.

<br/>

![version](https://img.shields.io/badge/version-0.1.0-243F52?labelColor=162936&style=flat-square)
![license](https://img.shields.io/badge/license-MIT-456A82?labelColor=162936&style=flat-square)
![Vue 3 + Vite](https://img.shields.io/badge/Vue%203-Vite-F0C880?labelColor=162936&style=flat-square)
![EN · DE](https://img.shields.io/badge/EN-·%20DE-456A82?labelColor=162936&style=flat-square)

**[→ View it live](https://jan-arn.github.io/nimbus/)**

</div>

> A little hobby project — born because the summer was brutal and the weather apps kept contradicting each other. Not a product, just built to see the sky honestly.

## What's inside

- **Models** — current conditions (feels-like, wind, UV, air, pollen, sun) plus a comparison of the individual models (ICON, ECMWF, GFS, …) and an expandable 16-day outlook.
- **Long range** — out to ~35 days from the GEFS ensemble: median high + spread band (the wider, the more uncertain) and the trend "warmer/colder than today".
- **Air** — air quality (EAQI + pollutants) and pollen.
- **Living sky** — the ensemble field in the background and the color palette follow the real conditions of the active location. DWD severe-weather warnings (Bright Sky) appear as a banner.
- **Two languages** — English and German, toggled from the header and remembered in your browser.

## A little meteorology

Beyond ~7–10 days there is no precise single number. So Nimbus shows the **median of 31 simulations** plus a spread band instead of faking a sharp degree figure — reliable up close, honestly uncertain further out.

## Stack

Vue 3 + Vite + TypeScript · Tailwind CSS + reka-ui · Pinia · TanStack Query · vue-i18n · lucide icons.
Fonts: Bricolage Grotesque / Hanken Grotesk / JetBrains Mono.

Fully static — every source ([Open-Meteo](https://open-meteo.com), [Bright Sky](https://brightsky.dev)) is free, key-free and CORS-enabled, called straight from the browser. No backend, no API key.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/  (typecheck + static build)
```

Deploy to GitHub Pages happens automatically on every push to `main` (see `.github/workflows/deploy.yml`).

<div align="center"><br/><sub>MIT · built with ☕ and too much sun over Cologne</sub></div>

<!-- ===== FOOTER (custom SVG — assets/footer.svg) — the ensemble converging at dusk, the creed ===== -->
<img width="100%" src="https://raw.githubusercontent.com/Jan-ARN/nimbus/main/assets/footer.svg" alt="certain up close, honest far out — the sky is a spread, never a single number"/>
