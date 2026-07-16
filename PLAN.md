# Nimbus — Feature Plan: Decision Indices, Golden Window, Bio-Weather & House Forecast

> Status: **draft for review**. No feature code written yet. Decisions already made by you are marked ✅.
> North star: *honesty under uncertainty* — every derived metric ships **with its uncertainty** and **with its "so what."**

---

## 1. Codebase findings

### 1.1 Architecture & stack
- **Vue 3 + `<script setup>` + TypeScript**, Vite, Tailwind 3. Pinia for state, `vue-router` (`createWebHistory(BASE_URL)`), `@tanstack/vue-query` for data, `vue-i18n` (composition mode). Icons: `lucide-vue-next`.
- **Static app, no backend.** All data sources are keyless + CORS-enabled and called straight from the browser (`src/api/weather.ts`). Deploys to GitHub Pages.
- **Views/tabs** (`src/router.ts`): `/models` → `CompareView` (eager), `/outlook` → `LongRangeView`, `/air` → `AirView`, `/history` → `HistoryView`, `/records` → `RecordsView` (all lazy). Legacy redirects exist. `App.vue` renders header + shared `PlaceSelector` + `WarningsBanner`, and the tab bar (desktop pill nav + mobile bottom bar, both generated from one `tabs` array).

### 1.2 Data-fetching layer (`src/api/weather.ts`)
- One tiny `getJson(path, params)` over `fetch`; **no caching in the fetch layer** — caching is entirely `vue-query` (`queryKey` + `staleTime`) inside components.
- Endpoints: `forecast`, `ensemble`, `geocode`, `air`, `warnings` (Bright Sky/DWD), `archive` (ERA5), `previous` (previous-runs).
- **`fetchConditions(place, 14)`** is the key piggyback target. It is a single `best_match` call **shared app-wide** under query key `['conditions', id]` (used by `App.vue` for theming, `ConditionsHero`, `CompareView`, `RecordsView`). Adding fields here adds **no new request** (only a modest cost bump — Open-Meteo weights a call by its variable count). It currently fetches:
  - `current`: `temperature_2m, apparent_temperature, relative_humidity_2m, dew_point_2m, weather_code, wind_speed_10m, wind_gusts_10m, wind_direction_10m, uv_index, is_day, surface_pressure, precipitation, cloud_cover`
  - `hourly`: `temperature_2m, apparent_temperature, precipitation_probability, uv_index, relative_humidity_2m, wind_speed_10m, weather_code`
  - `daily`: `weather_code, temperature_2m_max/min, apparent_temperature_max/min, precipitation_sum, precipitation_probability_max, wind_speed_10m_max, wind_gusts_10m_max, uv_index_max, sunrise, sunset, sunshine_duration, daylight_duration`
- **`fetchMultiModelForecast`**: 7 curated models (`src/models.ts`), `hourly: temperature_2m, surface_pressure`; `daily: max/min, precip_sum, weather_code`.
- **`fetchEnsemble`** (`gfs_seamless`, 35 d): `hourly: temperature_2m, precipitation` — the only per-member data we have.
- **`fetchAirQuality`** (4 d): EAQI + pollutants + 6 pollen species, current + hourly.
- **`fetchArchive` / `fetchClimateArchive`** (ERA5, since 1940): daily tmax/tmin (+ precip). **`fetchForecastRuns` / `fetchRunEvolution`** (previous-runs, `best_match` only): `temperature_2m_previous_dayN`.

### 1.3 Existing weather math (so we do not duplicate) — `src/lib/`
There is **no** feels-like/apparent-temp, wind chill, wet-bulb, UTCI, dew-point/humidity conversion, degree-day, ET, or pressure-tendency code. Clean slate for physics. Reusable building blocks:

| Module | Reusable for the new work |
|---|---|
| `series.ts` | `quantiles`, `extent`, `dailyExtremeByDate`, **`aggregateEnsemble`** (p10/p25/median/p75/p90 of member highs), **`ensemblePrecip`** (PoP = fraction of wet members), `ensembleMembers`, `bimodalSplit`. These are the **uncertainty feedstock**. |
| `verify.ts` | `metrics` (ME/MAE/RMSE), `mse`, `skillScore`, **`causalBiasCorrect`**, `persistencePairs` → Phase 3 house forecast. |
| `climate.ts` | `ClimateDay`, `normalsForDay`, `calendarDayRecords`, **`drySpell`** (days-since-rain) → GDD & fire/drought. |
| `probability.ts` | `verbalProbability` (IPCC calibrated terms), `naturalFrequency` → communicate index probabilities. |
| `confidence.ts` | `spreadVerdict(spread)` → day-level model-agreement labels. |
| `format.ts` | Pattern to imitate: `uvLevel/aqiLevel/pollenLevel` return `{label,color,...}`; `tempColor` gradient-stop interpolation. **This is where category→label/color mapping lives (i18n-aware).** |
| `snapshots.ts` | localStorage per-model daily-forecast recorder → alternate no-look-ahead feed for Phase 3. |

### 1.4 Theming (sky state)
- `src/stores/sky.ts`: `classifySky(code, isDay, temp)` → `SkyKind` (`hot | clear-day | clear-night | clouds | fog | rain | storm | snow`). `hot` currently triggers on **raw air temp ≥ 28 °C** on a clear day. `setFromCurrent(current)` (called from `App.vue`) writes `document.documentElement.dataset.sky = kind`.
- `src/styles.css`: `:root` default + one `[data-sky='…']` block per kind overriding `--primary`, `--sky-1/2/3`, `--sky-glow`, `--shimmer-opacity`. `SkyCanvas.vue` reads `--primary` and the sky kind to animate a real GFS ensemble field + particles.

### 1.5 i18n
- `src/i18n.ts`: `legacy:false`, `fallbackLocale:'de'`, locale persisted in `localStorage['nimbus-locale']`, `<html lang>` synced, `localeTag()` → `'en-GB'`/`'de-DE'` for `Intl`. Locales `de.ts`/`en.ts` are nested objects grouped by feature/tab (`nav`, `app`, `hero`, `compare`, `longRange`, `air`, `history`, `records`, `focus`, `probability`, plus lookup tables `wmo`, `uv`, `aqi`, `pollenLevel`, `pollenName`). **Every new string goes in both files under a new feature group.**

---

## 2. Proposed architecture

### 2.1 Shared calculation core — `src/lib/wx/` (framework-agnostic, unit-tested)
All physics lives here as **pure functions returning numbers + enums** (no i18n, no Vue, no colors). UI layers map enums → labels/colors.

```
src/lib/wx/
  humidity.ts    saturationVapourPressure(T), vapourPressure(T,RH), vapourPressureFromDewpoint(Td)
  thermal.ts     wetBulbStull(T,RH), windChill(T,vKmh), utci(Ta,va,Tmrt,e), *category enums*
  radiation.ts   meanRadiantTemp({...radiation, solarElevation, albedo}) with v0/v1 (§4.3)
  pressure.ts    maxRollingDrop(series, windowH=24), rate3h(series)
  indices.ts     snowLine, thunderPotential, fogRisk, dryingIndex, fireStress, growingDegreeDays, rideRunComfort
  golden.ts      goldenScoreHour(inputs)->0..1, findBestWindow(hourlyScores,time)
  astro.ts       thin wrapper over suncalc: sunPosition, sunTimes(+twilight), moonPosition, moonIllumination
  categories.ts  shared enum tables (UTCI 10 bands, CAPE bands, thresholds) — values only
  __tests__/     vitest specs, validated against published reference values
```
- **Add `vitest`** (no test runner exists today) + a `test` script. Tests are the acceptance gate for every formula.
- Category → `{label(i18nKey), color}` mapping is added to `format.ts` (`utciLevel`, `capeLevel`, `fogRiskLevel`, …), mirroring `uvLevel`. Keeps `wx/` i18n-free.
- Add **`suncalc`** dependency (tiny, vetted) — no hand-rolled ephemeris.

### 2.2 Where features live — Information Architecture ✅ **New "Outdoors" tab**
- New route `/outdoors` → `OutdoorsView.vue` (lazy), added to the single `tabs` array in `App.vue` (auto-appears in both desktop pill + mobile bottom bar). Icon: lucide `Footprints` (or `Compass`). New i18n `nav.outdoors`.
- **Bottom bar goes 5 → 6.** Each item is already `flex:1 1 0` with ellipsizing labels; at 390 px that's ~64 px each (snug but fine). Mitigation: shorten labels ("Outdoors" / DE "Draußen") and reduce bottom-nav horizontal padding on the narrowest widths.
- `OutdoorsView` composes cards, top-to-bottom:
  1. **Golden-window hero** (headline sentence + hourly score strip).
  2. **Bio-weather**: UTCI "feels like properly" band + barometric wellbeing.
  3. **Decision-index grid** (laundry, snow line, fog, thunder, fire, GDD, ride/run) — each a compact tile with value, uncertainty, and one-line "so what."
  4. **Stargazing clock** (tonight's best dark-sky window).
- Reuses shared caches: `fetchConditions` (already app-wide), `fetchAirQuality`, `fetchEnsemble` (for uncertainty), `astro` (local compute). **The UTCI upgrade also feeds the hero on Models** (see §2.4).

### 2.3 Uncertainty integration (how each metric earns its band)
We only have per-member data for **temperature** (ensemble) and **precipitation** (ensemble), plus **multi-model** temperature + surface_pressure. Humidity/wind/radiation are single-model (`best_match`). Honest strategy:
- **Temperature-dominated indices** (wet-bulb, wind chill, UTCI, golden thermal term): recompute the index at ensemble temperature **p25/p75**, holding humidity/wind/radiation at the deterministic value → an honest first-order band. **Caveat found in review:** `aggregateEnsemble`/`ensembleMembers` collapse to *daily-high* distributions, but these are **hourly/instant** metrics — so we **add a new hourly per-member spread helper** to `series.ts` (`ensembleHourlySpread(res) → {time, p25, p50, p75}` from the hourly `temperature_2m_memberXX` series that `fetchEnsemble` already returns and `SkyCanvas` already reads). The center comes from `best_match`; the ensemble is GFS-only → express the band as a **relative spread applied to the deterministic value** (`det + (p25−p50)` … `det + (p75−p50)`), never GFS absolute percentiles. For metrics we deliberately keep at daily resolution, fall back to the day-level `spreadVerdict` chip instead of a per-hour band. Humidity/wind uncertainty stays unresolved (a stated limitation, not hidden).
- **Precipitation terms** (golden "no rain", laundry): reuse **`ensemblePrecip`** PoP directly.
- **Day-level confidence chips**: reuse **`spreadVerdict`** on the day's multi-model high spread ("models agree" vs "uncertain").
- **Barometric**: compute the 24 h drop **per model** from `fetchMultiModelForecast` `surface_pressure` → agreement across models is the confidence ("−9 hPa, models agree" vs "possible drop, low agreement").
- When inputs are missing/out-of-range (e.g. radiation at night, wind-chill above 10 °C), the function returns `null` and the UI **widens/greys the band** rather than faking precision.

### 2.4 UTCI → theming hook ✅ requirement
Rather than a competing theme driver, **upgrade the existing `hot` trigger to UTCI** and add a symmetric cold state:
- `classifySky` gains an optional `utci` input. Precip/storm/snow/fog states keep priority. On clear/low-cloud: `hot` fires when **UTCI ≥ +32** (strong heat stress) instead of raw ≥28 °C; add **`cold`** `SkyKind` when **UTCI ≤ −13** (strong cold stress), with a new icy `[data-sky='cold']` palette in `styles.css`.
- Requires UTCI in the theming path. Open-Meteo's `current=` may not expose the radiation trio, so compute the theme UTCI from **`hourly[nowIdx]`** (the radiation fields are added to `hourly` anyway for the golden score) rather than `current`. `App.vue` passes that UTCI to `classifySky` alongside the current record. This is the single, minimal, honest integration point — no new fields needed in `current`.

---

## 3. Phased roadmap (value vs effort)

**Guiding logic:** ship the shared core once, then front-load the features that (a) reuse it and (b) produce the most visible "wow" per unit effort. Golden window + UTCI are the headline; indices are cheap add-ons; barometric/stargazing need new fields/deps; house forecast is the deep, differentiated finale.

### Phase 1 — Core + first payoff  *(highest value/effort)*
**Ships:** `wx/` skeleton + vitest; `humidity.ts`; `thermal.ts` (wet-bulb, wind chill, UTCI); `radiation.ts` (MRT v0 + v1); `golden.ts`; snow-line + laundry indices; Outdoors tab shell with Golden-window hero + UTCI band + those two index tiles; UTCI theming hook; UTCI "feels like" upgrade surfaced in `ConditionsHero`.

| Item | New/changed files | New Open-Meteo fields (piggyback on `fetchConditions`) | Tests |
|---|---|---|---|
| Calc core + vitest | `src/lib/wx/*`, `vitest.config.ts`, `package.json` (`test`), `suncalc` dep | — | harness runs |
| Humidity | `wx/humidity.ts` | *(uses RH, dew point — present)* | `es(0°C)=6.11hPa`, RH/dewpoint round-trip |
| Wet-bulb (Stull 2011) | `wx/thermal.ts` | — | published Stull table points |
| Wind chill (NWS) | `wx/thermal.ts` | — | valid only T≤10 °C & v>4.8 km/h; null otherwise |
| **UTCI (Bröde 2012)** | `wx/thermal.ts`, `format.ts` (`utciLevel`), `styles.css` (`cold`), `stores/sky.ts`, `App.vue` (pass `hourly[nowIdx]` UTCI to `classifySky`) | `hourly`: `shortwave_radiation, direct_radiation, diffuse_radiation, direct_normal_irradiance` | validate vs `pythermalcomfort` reference outputs; 10-band mapping |
| Hourly ensemble band | `series.ts` (`ensembleHourlySpread`) | *(uses hourly member temps already in `fetchEnsemble`)* | relative spread vs deterministic; monotonic p25≤p50≤p75 |
| MRT | `wx/radiation.ts`, `wx/astro.ts` | *(uses radiation above + solar elevation via suncalc)* | night → Tmrt=Ta; clear-noon sanity band |
| Snow line | `wx/indices.ts`, `format.ts` | `hourly`: `freezing_level_height` | "rain in town / snow above ~Xm" thresholds |
| Laundry/drying | `wx/indices.ts` | `hourly`: `et0_fao_evapotranspiration` (+ RH, wind, precip prob present) | monotonic in ET & inverse in RH/precip |
| Golden window | `wx/golden.ts`, `OutdoorsView.vue`, `components/GoldenWindow*.vue` | `hourly`: `cloud_cover, sunshine_duration, visibility, wind_gusts_10m, dew_point_2m` | multiplicative gating (rain/dark ⇒ ~0); best-window extraction |
| Outdoors tab | `router.ts`, `App.vue` (`tabs`), `locales/*` (`nav.outdoors`, `outdoors.*`) | — | route renders; nav both bars |

### Phase 2 — Remaining indices + bio-weather + sky
**Ships:** thunder, fog, fire/drought, GDD, ride/run indices; barometric wellbeing (sensitivity slider); stargazing clock (astro + cloud-layer/aerosol).

| Item | New/changed files | New fields | Tests |
|---|---|---|---|
| Thunder potential | `wx/indices.ts`, `format.ts` (`capeLevel`) | `hourly`: `cape` (+ `weather_code` 95–99, precip present). ⚠ `thunderstorm_probability` availability unverified — fallback to CAPE+WMO+precip | CAPE band edges |
| Fog risk | `wx/indices.ts` | `hourly`: `visibility` (added P1), dew-point spread + wind + RH present | spread<2.5 °C & calm & high RH ⇒ high, sanity-checked vs visibility |
| Fire/drought | `wx/indices.ts` | `hourly`: `vapour_pressure_deficit` (+ et0 from P1, wind); **reuse `drySpell`** for days-since-rain | rises with VPD & dry streak |
| Growing degree days | `wx/indices.ts` | *(daily tmax/tmin from conditions + archive)* | `GDD=Σmax(0,(Tmax+Tmin)/2−10)` vs worked example |
| Ride/run comfort | `wx/indices.ts` | *(UTCI + wind + precip + EAQI + pollen — all present)* | per-hour go/no-go gating |
| Barometric wellbeing | `wx/pressure.ts`, `components/Barometric*.vue`, persisted `threshold` | *(uses multi-model `surface_pressure`; optional `pressure_msl`)* | max 24 h rolling drop; 3 h rate; threshold crossing |
| Stargazing clock | `wx/astro.ts` (extend), `components/Stargazing*.vue` | `hourly`: `cloud_cover_low/mid/high`; aerosol from `pm2_5` (air query). ⚠ upper-wind "seeing" (e.g. `wind_speed_250hPa`) = separate heavy request → **defer to v2** | astronomical darkness (sun<−18°); moon-up/illumination penalty |

### Phase 3 — Skill-weighted "house forecast"  *(largest lift, most unique)*
Close the loop **History → Models**: blend models by how well each has recently verified **at this place**, shown with earned confidence.

**Design (full spec):**
- **Verification feed.** Per model `m` and lead `L∈{1,3,5,7}`, gather (forecast@L, actual) pairs over a trailing window `W`. Two candidate sources:
  1. **App-owned `snapshots.ts`** — already records per-model daily forecasts to localStorage with no look-ahead. Honest but accretes slowly (needs the user to have opened the app over `W` days). *Preferred for correctness.*
  2. **Open-Meteo Historical-Forecast API** (per-model past forecasts) + ERA5 **Archive** for actuals, or **Previous-Runs/Single-Runs** per model. Faster to populate but per-model requests are expensive (see risks). *Preferred for cold-start.*
  → Plan: use snapshots when it has ≥`minSamples`, else backfill from the Historical-Forecast API; label which source produced the weights.
- **Per-model, per-lead skill.** Reuse `verify.ts`: `metrics` (MAE/bias), optional `causalBiasCorrect` to de-bias each model first, `skillScore` vs `persistencePairs` baseline.
- **Weights.** `w_{m,L} ∝ 1/MSE_{m,L}` (inverse-error) or `softmax(−MAE/τ)`; renormalize over **available** models only. Stratify by lead (skill decays with lead — weights differ at day 1 vs day 7). Guard: if `n < minSamples` for a model, fall back to equal weight and flag low confidence.
- **House forecast.** `Ŷ_L = Σ_m w_{m,L}·(biasCorrected forecast_{m,L})`. Confidence = blend of (a) weight concentration (Herfindahl — one model dominating + low spread ⇒ confident) and (b) inter-model spread via `spreadVerdict`.
- **"So what."** "Our blend leans **ECMWF** here this month (42 %); **GFS** has run **0.8 ° warm** and is down-weighted." Surfaced as a card in Models (and mirrored on Outdoors), with a link to History for the receipts.
- **Look-ahead-bias guard (critical).** Only pairs whose issue time precedes the target by exactly the lead may enter verification; weights used for a given target date derive **only** from targets already verified before it. Encode as a pure `wx/blend.ts` invariant with dedicated tests (feed future-dated actuals → must be excluded).

| Item | New/changed files | New fields | Tests |
|---|---|---|---|
| Weighting core | `wx/blend.ts` | — | inverse-error weights; renormalization on missing model; softmax τ; Herfindahl confidence |
| Verification feed | `api/weather.ts` (+`fetchModelHistory`), extend `snapshots.ts` | Historical-Forecast API per model (cold-start) | look-ahead guard; min-sample fallback |
| House-forecast UI | `components/HouseForecastCard.vue`, `CompareView`/`OutdoorsView`, `HistoryView` (expose weights), `locales/*` | — | renders weights + so-what copy |

---

## 4. Per-feature technical spec

### 4.1 Humidity helpers (`wx/humidity.ts`)
- `saturationVapourPressure(T)` (hPa), Tetens: `es = 6.108·exp(17.27·T/(237.3+T))` → `es(0 °C)=6.108 hPa` (align the unit test to this).
- `vapourPressure(T,RH) = es(T)·RH/100`; `vapourPressureFromDewpoint(Td) = es(Td)`. **`es(Td)` is the real path** for UTCI (we fetch dew point directly — more robust than RH). Return kPa where UTCI needs it.

### 4.2 Decision indices (`wx/thermal.ts`, `wx/indices.ts`)
- **Wet-bulb (Stull 2011)** — exact formula from brief; valid ~5–99 % RH near 1013 hPa; category: danger rises ≥28 °C, severe ≥31, lethal ≥35. "So what": humid-heat exertion warning.
- **Wind chill (NWS)** — `Twc = 13.12 + 0.6215T − 11.37v^0.16 + 0.3965·T·v^0.16` (T °C, v km/h @10 m); **return null unless T≤10 °C and v>4.8 km/h**.
- **Snow line** — `freezing_level_height` directly: "rain in town, snow above ~Xm"; compare to place elevation if available (else sea-level framing). Uncertainty: ensemble T p25/p75 shifts the level.
- **Thunder potential** — CAPE bands (<300 weak, 300–1000 moderate, 1000–2500 strong, >2500 extreme) AND (`weather_code`∈95–99 OR high precip prob). ⚠ verify `thunderstorm_probability` availability; fallback as stated.
- **Fog risk** — `(T − Td) < 2.5 °C` AND `wind_speed_10m` low AND `RH` high; sanity-check against `visibility` (downgrade if visibility already high). Category low/moderate/high.
- **Drying/laundry** — increasing in `et0_fao_evapotranspiration` & `wind_speed_10m`, decreasing in `relative_humidity_2m` & `precipitation_probability`; hard-zero when precip likely. Output 0–100 + best drying window (reuse `golden` window-finder).
- **Fire/drought stress** — increasing in `vapour_pressure_deficit`, `et0`, wind; scaled by **`drySpell`** days-since-rain (reuse `climate.ts`).
- **Growing degree days** — `GDD=Σ max(0,(Tmax+Tmin)/2 − 10)` over archive; season-to-date accumulation + forecast projection from daily tmax/tmin.
- **Ride/run comfort** — per-hour gate: UTCI in pleasant band, headwind (`wind_speed_10m` vs bearing), precip≈0, `european_aqi` acceptable, pollen low (for the active place's sensitive species). Output go/no-go + best hour.

### 4.3 UTCI + MRT (`wx/thermal.ts`, `wx/radiation.ts`)
- **UTCI:** port the **Bröde (2012) 6th-order polynomial coefficient table from `pythermalcomfort`** (BSD) — *do not transcribe by hand.* Signature `utci(Ta, va10m, Tmrt, e)`; convert wind km/h→m/s, clamp to valid ranges (Ta −50..50, va 0.5..17 m/s, Tmrt−Ta −30..70), return `null` outside. Map to the 10 stress bands from the brief. **Acceptance test = published reference values** (a table checked into `__tests__`).
- **MRT (modeling decision):**
  - **v0 fallback (always available):** `Tmrt = Ta`. Used at night, or whenever radiation fields are absent → UTCI degrades to a shade/wind "feels like." Transparent, and we can widen the uncertainty band when v0 is in effect.
  - **v1 primary (solar-adjusted, Thorsson 2007 / RayMan-style):** absorbed radiation on a rotationally-symmetric standing person: direct beam `direct_normal_irradiance · fp(solarElevation)` (Fanger projected-area factor), isotropic diffuse `diffuse_radiation` (view factor 0.5), ground-reflected `albedo·shortwave_radiation` (view factor 0.5, albedo default **0.2**); solve Stefan–Boltzmann (εp=0.97, shortwave absorptivity αk=0.7, σ) for `Tmrt`. Solar elevation from `wx/astro.ts` (suncalc). Test: `S=0 ⇒ Tmrt=Ta`.

### 4.4 Golden window (`wx/golden.ts`) ✅ band = **UTCI 18–26 °C**
- Per hour, sub-scores ∈[0,1]: **thermal** (1.0 inside 18–26 UTCI, cosine ramp to 0 across a ±margin), **daylight** (sun elevation>0 via astro), **sunshine** (from `cloud_cover`/`sunshine_duration`), **dry** (`(1−precip_prob/100)` × step(`precipitation`≈0)), **fog-free** (`visibility` + fog-risk), **calm** (penalize `wind_speed_10m`/`wind_gusts_10m` above comfort).
- **Combine by geometric mean (multiplicative gating)** so any hard blocker (rain, dark, fog) tanks the hour → honest: a warm rainy hour is *not* golden. Scale to 0–100.
- `findBestWindow` = longest contiguous run ≥ threshold (≈70); headline in plain language ("Saturday 14:00–17:00 looks perfect") + the limiting factor when none qualifies ("nothing golden this week — Sunday PM is the least-bad: breezy"). Attach confidence from that day's ensemble-T band + PoP.

### 4.5 Barometric wellbeing (`wx/pressure.ts`)
- `maxRollingDrop(pressureSeries, 24h)` and `rate3h`; flag windows where drop ≥ **user threshold** (default **6 hPa/24 h**, slider persisted in localStorage like locale/places). Compute **per model** (multi-model `surface_pressure`) → pair magnitude with agreement. **Copy is non-medical/non-diagnostic** ("many people report headaches when pressure falls quickly", never advice).

### 4.6 Astronomy + stargazing (`wx/astro.ts`)
- Wrap `suncalc`: sun position/times incl. civil/nautical/**astronomical** twilight (sun<−18°), moon position, moon illumination (phase + fraction). No API cost.
- Stargazing score tonight = darkness window × clearness (`cloud_cover_low/mid/high`) × low-moon (illumination + moon-up) × transparency (aerosol proxy `pm2_5`). Headline best dark-sky window + confidence. Upper-wind "seeing" deferred (extra request).

### Reconciliation with existing utils
Reuse (do **not** reimplement): `aggregateEnsemble`/`quantiles`/`ensemblePrecip` (uncertainty), `spreadVerdict` (agreement), `drySpell`/`normalsForDay` (climate feeds), `verbalProbability`/`naturalFrequency` (comms), `metrics`/`skillScore`/`causalBiasCorrect`/`persistencePairs` (Phase 3), `tempColor`/`uvLevel` pattern (scales in `format.ts`).

---

## 5. Open questions / decisions needing your input

All decided ✅ (approved 2026-07-16). Structural: IA = new **Outdoors** tab · Golden band = **UTCI 18–26 °C** · Plan depth = **all three phases in full**. Remaining calls locked to the recommended defaults:
1. **MRT & deps** ✅ — add `suncalc` + radiation fields to `fetchConditions` `hourly`; ship **v1 solar-adjusted MRT with v0 (Tmrt=Ta) fallback**, ground **albedo = 0.2**.
2. **Phase 3 verification** ✅ — trailing **W = 30 days, minSamples = 10 per model/lead**, lead-stratified weights; cold-start **snapshots-first, Historical-Forecast-API backfill**.
3. **Barometric** ✅ — default sensitivity **6 hPa/24 h**, slider **3–12**, strictly non-medical copy, **on by default**.
4. **Stargazing v1** ✅ — **without upper-wind "seeing"** (darkness + cloud layers + moon + aerosol only); revisit in v2.
5. **`thunderstorm_probability`** ✅ — verify availability; if absent, **derive from CAPE + WMO 95–99 + precip**.
6. **Cross-linking** ✅ — also surface the Golden-window headline and House-forecast card on **Models**, not only Outdoors.
7. **Units** ✅ — metric throughout (°C, km/h, hPa, m).

---

## 6. Risks

- **API budget.** Index/golden/UTCI fields **piggyback on the one shared `fetchConditions` call → no new request, only a modest per-call cost bump** (~12 new hourly vars × 14 days, variable-count weighted). Costly paths: multi-model (7 models = ~7×), ensemble (many members), and **Phase 3 per-model history** (N model requests). Open-Meteo weights calls by variable count and caps the free tier (~10 k/day). Mitigation: keep Phase 3 weight computation **daily + persisted**, prefer snapshots, renormalize over available models.
- **Formula edge cases.** Wind chill invalid >10 °C / low wind; wet-bulb invalid at extreme RH; UTCI valid ranges; MRT undefined without radiation (night). All return `null` and the UI widens/greys the band — no fake precision. Enforced by unit tests.
- **UTCI correctness.** Hand-transcription is the top defect risk → **port a vetted implementation and test against published values**; treat the reference table as the gate.
- **Theming conflict.** UTCI-driven `hot`/`cold` must not fight precip/storm states → precipitation states keep priority in `classifySky`; only clear/low-cloud gets UTCI treatment.
- **Look-ahead bias (Phase 3).** The subtle correctness trap → isolated pure `blend.ts` with adversarial tests (future-dated actuals must be excluded).
- **Performance.** ~14×24 hours × several indices, recomputed at ensemble percentiles → keep O(n), wrap in `computed`, avoid re-fetch (shared query keys). Vitest is dev-only.
- **Mobile IA.** 6th bottom-bar tab is snug at 390 px → shorten labels + trim padding; verify on device.
- **localStorage growth** (snapshots feeding Phase 3) → cap history to the verification window + prune.
