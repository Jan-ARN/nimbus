<!-- ===== HERO (custom SVG — assets/banner.svg) — dusk sky, the ensemble fanning out from "now" ===== -->
<img width="100%" src="https://raw.githubusercontent.com/Jan-ARN/nimbus/main/assets/banner.svg?v=3" alt="Nimbus — multi-model weather; the forecast fans out from now"/>

<div align="center">

### A weather app that shows the spread, not just a number.

Compares several forecast models side by side and treats the deep forecast as what it is — a **distribution**, not a single degree. The background *is* the forecast: the ensemble fans out across the screen and the palette follows the real sky — hot day → amber, clear night → stars, rain → drops, storm → lightning. Cologne is home; add any place you like.

<br/>

![version](https://img.shields.io/badge/version-0.1.0-243F52?labelColor=162936&style=flat-square)
![license](https://img.shields.io/badge/license-MIT-456A82?labelColor=162936&style=flat-square)
![Vue 3 + Vite](https://img.shields.io/badge/Vue%203-Vite-F0C880?labelColor=162936&style=flat-square)
![static · no backend](https://img.shields.io/badge/static-no%20backend-456A82?labelColor=162936&style=flat-square)

**[→ View it live](https://jan-arn.github.io/nimbus/)**

</div>

## What's inside

- **Models** — current conditions (feels-like, humidity, wind & gusts, UV, pressure, cloud, air, pollen, sun) plus a side-by-side comparison of the individual models and an expandable **14-day** daily outlook.
- **Long range** — the temperature *tendency* out to ~35 days from an ensemble: expected daily high, an uncertainty band, and a "warmer / cooler than today" read.
- **Air** — European AQI, individual pollutants, and pollen.
- **Weather-reactive UI** — the ensemble field and colour palette track the active location's real conditions; DWD severe-weather warnings appear as a banner.
- **Two languages** — English & German, remembered in your browser (as are your saved places and the last one you viewed).

## How the numbers are made

Everything is computed in the browser from raw model output — there's no server doing the maths.

### Models tab

Up to seven global models from Open-Meteo, requested in one call (`&models=…`): **ICON** (DWD), **ECMWF IFS**, **GFS** (NOAA), **GEM** (Canada), **ARPEGE/AROME** (Météo-France), **JMA**, **UK Met Office**.

For the daily outlook, each day shows the **mean high/low across the selected models**, and the *disagreement* dot is half the model-to-model spread of the highs (`(max − min) / 2`) — green when the models concur, red when they diverge. Current conditions come from Open-Meteo's `best_match` blend.

### Long range — the ensemble

This is where a single number stops meaning anything, so the app doesn't show one. It uses the **GEFS ensemble** (`gfs_seamless`) — the one freely available ensemble that actually reaches far out (ICON-EPS stops near 7.5 days, ECMWF-ENS near 15). GEFS is **31 parallel runs of the same model**: one control run plus 30 members started from slightly perturbed initial conditions. How far they diverge over time *is* the forecast uncertainty.

From the raw hourly members Nimbus computes, per calendar day:

1. **each member's daily high** — the max temperature over that member's day (matching what a weather app calls "the high", not a 24-h average);
2. the **distribution of those 31 highs**, reduced to percentiles by linear interpolation:
   - **median (p50)** → the line — the expected high, robust against a few runaway runs (a plain mean gets dragged by them);
   - **p10 / p90** → the band — the cooler and warmer scenarios; the wider the band, the less certain the day.

The **trend** ("getting warmer / cooler / fairly stable") is an ordinary least-squares regression over the daily medians; its total change is classified with a ±1.5 °C dead-band. "Today" is the first day's median, so every anomaly is measured against a like-for-like expected high rather than a multi-day average.

A marker sits at **~14 days**: up to there the ensemble is genuinely informative; beyond it, read the direction, not the degrees.

> *A forecast is a range, not a number.*

## Data & stack

Fully static — every source is free, key-free and CORS-enabled, called straight from the browser. No backend, no API key.

- **[Open-Meteo](https://open-meteo.com)** — forecast, ensemble, air quality, geocoding
- **[Bright Sky](https://brightsky.dev)** — DWD severe-weather warnings

Vue 3 + Vite + TypeScript · Tailwind CSS + reka-ui · Pinia · TanStack Query · vue-i18n · lucide icons.
Fonts: Bricolage Grotesque / Hanken Grotesk / JetBrains Mono.

## Getting started

```bash
npm install
npm run dev        # http://localhost:5173
npm run build      # → dist/  (typecheck + static build)
```

Deploy to GitHub Pages runs on every push to `main` (see `.github/workflows/deploy.yml`).

<div align="center"><br/><sub>MIT License · made in Cologne</sub></div>

<!-- ===== FOOTER (custom SVG — assets/footer.svg) — the ensemble at dusk + a fitting quote ===== -->
<img width="100%" src="https://raw.githubusercontent.com/Jan-ARN/nimbus/main/assets/footer.svg?v=3" alt="&quot;Prediction is very difficult, especially about the future.&quot; — Niels Bohr · median & p10–p90 spread from 31 GEFS members"/>
