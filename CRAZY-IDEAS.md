# Nimbus — Crazy Ideas

> *A weather app that shows the spread, not just a number — and is confident enough to grade itself in public.*

This is a brainstorm doc, not a spec. Everything here is buildable in a **static Vue app on free, key-free, CORS-enabled data** (Open-Meteo forecast + Ensemble API + ERA5 archive + pressure levels; NOAA SWPC for space weather; SunCalc-style math for astronomy). Every formula below is transcribed from a primary source (NOAA/NWS, AMS journals, BOM, ECMWF, Copernicus) and cited at the bottom. Nothing needs a backend.

## The thesis (our moat)

Mainstream apps hide three things on purpose — **uncertainty**, **model disagreement**, and **their own track record** — because one confident number tests better. Nimbus already shows all three. Every idea here is chosen to *deepen that one differentiator*. The tagline we're earning:

> **The weather app that tells you what it doesn't know — and proves how often it's right.**

---

# Part I — The four directions you picked

## 1. The self-grading scoreboard → a forecast that beats its own models ⭐ the leap

This turns the existing History tab from a feature into the app's whole argument. Three layers, each independently shippable.

### 1a. Live model leaderboard, for *this* location
For each model (ICON, ECMWF, GFS, GEM, ARPEGE, JMA, UKMO), per lead-time (day 1…14) and per variable, keep a rolling error table by scoring past forecasts against the ERA5/observed archive.

```
Bias (Mean Error):  ME  = (1/n) Σ (fᵢ − yᵢ)          signed → "ICON runs +1.2°C warm here"
MAE:                MAE = (1/n) Σ |fᵢ − yᵢ|
RMSE:               RMSE = √( (1/n) Σ (fᵢ − yᵢ)² )
Skill vs baseline:  SS  = 1 − MSE_model / MSE_reference
```

Baselines you already have data for: **persistence** (tomorrow = today's observed) and **climatology** (30-yr normal for that calendar day, from the archive). Beating climatology is the real bar; persistence is easy past day 1. The headline: *"For Cologne, ECMWF beats ICON at day-5 highs by 1.4 °C over the last 90 days. GFS runs warm."* **Nobody tells you which model to trust for your city.**

### 1b. The "Nimbus-corrected" forecast (MOS / bias correction)
Once you know each model's systematic error, subtract it. This is textbook Model Output Statistics.

**Start here — running-mean bias correction** (highest value-per-effort in the whole doc):
```
biasₜ = (1/N) Σₖ₌₁..N (fₜ₋ₖ − yₜ₋ₖ)      per lead-time, per hour-of-day, N ≈ 7–30 days
f_corrected = f_raw − biasₜ
```
Or an exponentially-weighted (Kalman-ish) update: `bias ← (1−α)·bias + α·(f−y)`, α≈0.1.

**Next — linear-regression MOS** (fixes conditional bias, e.g. "too warm only when it's warm"):
```
b = Σ(f−f̄)(y−ȳ) / Σ(f−f̄)²      a = ȳ − b·f̄      f_corr = a + b·f
```

The wow: *"Over 90 days, the Nimbus-corrected forecast beat every raw model by X °C"* — **proven with the same backtest.** An app that provably out-forecasts its own inputs.

### 1c. Smart multi-model blend (inverse-variance weighting)
Blend the (de-biased!) models weighted by recent measured accuracy — the classic minimum-variance combination:
```
wᵢ = (1/eᵢ²) / Σⱼ (1/eⱼ²)      eᵢ = recent RMSE of model i      blend = Σᵢ wᵢ·fᵢ
```
Transparent and honest — weights come purely from measured past error. De-bias each model first (§1b), add a small ε to avoid divide-by-zero, optionally floor weights so one bad window doesn't zero out a good model.

**Data flow — two sources, use both:**
- **Open-Meteo's `previous-runs-api`** already serves `temperature_2m_previous_dayN` (N ≤ 7) — i.e. *retrospective* forecast-vs-actual pairs you can verify against the ERA5 archive **today, no waiting**. This backs the **corrected-forecast demo (1b) on the blended `best_match` forecast** — ✅ *built & verified: for Cologne it finds a +1.2° day-1 warm bias and removes it for a ~27% accuracy gain (`src/lib/verify.ts`, wired into the History tab).*
- **localStorage / committed-JSON snapshots** (keyed by issue-date + lead) are still needed for what previous-runs can't give: the **per-model leaderboard (1a)** (previous-runs is blend-only, no per-model suffix) and **convergence replay past day 7**. *Start snapshotting now* — that value compounds with history. ✅ *Built: `src/lib/snapshots.ts` runs once per place per day (deduped), banks all 7 models' daily forecasts by target-date → lead → model, prunes >120 d, and shows a "N days banked" line in the History tab. The leaderboard/convergence views just read this store once it matures.*

**Honest-claim rule (baked into the engine):** a lead-N correction may only use verification pairs whose actual was known at issue time (target ≤ D − N − 2, since ERA5 lags ~2 days). A naive "last 30 days" window leaks a week of look-ahead and fakes the gain. Always report the real number — the engine slightly *worsens* near-zero-bias leads and says so, rather than scanning for the best-looking lead.

## 2. Records & streaks — instant, shareable facts

Pure archive queries, zero prediction risk, extremely shareable. Low effort, high delight.

- *"Warmest July 14 in Cologne since 1940."*
- *"41 days since measurable rain — 3rd-longest this decade."*
- *"Running 4.2 °C above the 1991–2020 normal for this week."*
- *"Last spring frost: April 22 (avg). First autumn frost: Oct 19 (avg)."* — from frost-date climatology.

**Climate anomaly framing** is the connective tissue: `anomaly = T_today − T_normal`, shown as a diverging chip (blue cooler / red warmer) behind the temp chart. It answers the question people actually *feel* — "is this weird?" — and almost no consumer app does it. Precompute normals once per location and cache.

## 3. Watch a forecast "make up its mind" (convergence replay)

Snapshot each day's forecast for a **fixed target date**, then animate how the day-7 forecast for, say, next Saturday drifted as it approached — band narrowing, median wobbling. Dramatizes the whole philosophy (a forecast is a range that sharpens).

Sibling feature: **"What changed since yesterday's forecast"** — overlay yesterday's forecast as a ghost line and annotate the churn: *"Saturday's high revised +3 °C since yesterday; rain chance dropped 40%→15%."* This is the thing users constantly wonder and no mainstream app shows. Same localStorage-snapshot plumbing as §1. History shows *"were we right?"*; churn shows *"are we changing our minds, and by how much?"*

## 4. Analog-day finder — "today's twin from the past"

Search the archive for past days whose state most resembles today's, then show what actually happened as a labeled soft prior.

```
Normalize each predictor (z-score against the archive), then:
D(t,k) = √( Σₚ wₚ · ((Pₚ,ₜ − Pₚ,ₖ)/σₚ)² )      over predictors p (T, MSLP, humidity, wind…)
```
Take the K nearest days (K≈20–50) → their **observed outcomes form an analog ensemble** → mean for a point read, quantiles for probabilities, or weight by a Gaussian kernel `exp(−D²/2h²)`. *"Today most resembles 14 April 2019 — which was followed by three days of rain."* Honest about being a loose analogy, not a prediction.

---

# Part II — The new bets (from the research)

## 5. Animated Hypothetical Outcome Plots (HOPs) — the sleeper top pick ⭐

Instead of only static p10/p50/p90 bands, **animate** the forecast: each frame draws one ensemble member's full trace, cycling through all 31 (~1 draw/400 ms). The eye integrates the flicker into an intuitive feel for the distribution. Peer-reviewed HCI work (UW Interactive Data Lab; Kale/Hullman, IEEE TVCG) shows untrained viewers judge trends and reliability-of-difference **more accurately** from animated draws than from static bands. It's the most honest possible way to show "this is a coin flip" vs "this is locked in" — and genuinely novel in a consumer app.

Highest value-per-effort of the new ideas: **you already fetch the members.** It's a new render mode over existing data — `requestAnimationFrame`, redraw one polyline per frame. Respect `prefers-reduced-motion` (fall back to a postage-stamp small-multiples grid).

✅ *Built: `src/components/EnsembleHopsChart.vue` + a Band ↔ Scenarios toggle in the Long-range tab (`ensembleMembers()` in `series.ts`). Cycles the 31 GEFS runs with a fading trail; reduced-motion shows all runs static. Verified against live Cologne data.*

## 6. Plain-language "why is it like this" narration

A short generated paragraph above the charts, **rule-based** over the data you already compute: *"Warmer and calmer than yesterday. Models agree through Thursday, then split on a weekend front — treat the weekend as low-confidence."* Deterministic templating (no LLM, no server, no hallucinations — that determinism *is* the differentiator vs AccuWeather's bot). It's where you spend your honesty budget in words non-experts trust.

## 7. Ensemble meteogram / EPSgram with bi-modality

Upgrade the smooth fan to a professional per-time-step box-and-whisker (min/p10/p25/median/p75/p90/max), toggleable. The real payoff: **plumes reveal bi-modality** — when the ensemble splits into two camps (front arrives Saturday *vs* Sunday), which a single smooth band flattens away and hides. That split is genuine forecast information. Same members you already have; compute quantiles per step, draw candlestick marks or per-step violins. Offer a "calm band ↔ detailed meteogram" toggle.

## 8. Wet-bulb & the human-survivability lens

Compute **wet-bulb temperature** (Stull 2011 — a closed-form fit, no iteration) and frame it against the ~35 °C thermodynamic survivability ceiling:
```
Tw = T·atan[0.151977·(RH+8.313659)^0.5] + atan(T+RH) − atan(RH−1.676331)
     + 0.00391838·RH^1.5·atan(0.023101·RH) − 4.686035        (atan in radians; T °C, RH %)
```
Above Tw ≈ 35 °C the body cannot shed metabolic heat *at all* — a hard physical limit, not comfort. A "how close to the human limit is today?" gauge is sobering, factual, and climate-relevant. Pair with the full comfort suite (heat index, humidex, wind chill, apparent temperature, WBGT) — all in Part IV.

## 9. Aurora watch (rare-but-magic)

Fetch live **Kp index** from NOAA SWPC (`services.swpc.noaa.gov/products/noaa-planetary-k-index.json`, key-free, CORS-ok). Cologne's geomagnetic latitude is ~48–49° N. Equatorward auroral-oval boundary ≈ `66° − 2°·Kp` (geomagnetic). Practically: **Kp ≥ 6–7** gives a horizon chance; Kp 8–9 is clearly visible. Dark 99% of the time — but when a geomagnetic storm hits, *"faint aurora possible low on the northern horizon over Cologne tonight"* is pure magic. Cheap: a fetch + threshold table.

## 10. Sun-path & golden-hour strip

Solar position via the NOAA/Meeus algorithm (or SunCalc, ~50 lines): azimuth/elevation now, sunrise/sunset, solar noon, day length. **Golden hour** = sun elevation +6° → −4°; **blue hour** = −4° → −6°. Cross with the cloud forecast: *"Best light tonight 21:14, 30 % cloud — decent."* Almost nobody pairs sun geometry with the cloud forecast. (Full 3D Shadowmap-style building shadows = a separate heavy project; skip for now.)

## 11. Minute-by-minute nowcast (the Dark Sky hook) — ambitious

The most-grieved dead feature in weather: *"light rain stopping in 20 min."* Open-Meteo exposes `minutely_15` precipitation; RainViewer offers free radar + nowcast tiles you can advect client-side (Dark Sky's original trick was just extrapolating radar-blob motion). Rendering is easy; **true minute-resolution sourcing is the gating item** — budget it as ambitious. Wow companion: on-screen rain particle density driven by the actual nowcast curve, so the screen visibly eases as the forecast says it will.

## 12. Sonification & shareable postcards (self-contained wow)

- **Listen to the forecast** (opt-in, Web Audio): temperature→pitch, precip→rain-noise density, wind→tremolo, **ensemble spread→dissonance/detune** (wider spread = audibly more uncertain — a legible, honest sonic metaphor).
- **Shareable weather cards**: render current conditions + the signature uncertainty fan to `<canvas>` → PNG / Web Share. Every card is an ad for "the honest weather app." **All shareable state lives in the URL** (location + issue-date + view), since there's no server.

## 13. Bust-risk flag & scrubbable timeline

- **Bust-risk badge** — a meta-forecast: days where models disagree strongly *and* it's on a rain/no-rain knife-edge get a "low confidence, high stakes" badge. Honest about when to distrust the app.
- **Unified scrubbable timeline** — one draggable time index that moves *everything* in sync (fan, background gradient, narration). Drag to 3 am → the reactive background becomes a deep-charcoal night. Turns the dashboard into an instrument. Architecture-touching; plan it.

---

# Part III — The math engine (reusable, honest, all client-side)

A small `lib/verify.ts` + `lib/calibrate.ts` powers §1–§4 and §7. All O(n) loops or O(m log m) sorts — trivial client-side.

### Probability of precipitation (from ensemble)
```
PoP(t) = (# members with precip(t) ≥ 0.1 mm) / (total members)
```

### CRPS — score a probabilistic forecast (use the *fair* estimator; GEFS m=31 is small)
```
CRPS_fair ≈ (1/m) Σᵢ |xᵢ − y|  −  (1/(2·m·(m−1))) Σᵢ Σⱼ |xᵢ − xⱼ|
```
Continuous generalization of the Brier score; collapses to MAE for a deterministic forecast, so it's directly comparable across deterministic and probabilistic. O(m²) is fine for m=31; sort for O(m log m) if aggregating over thousands of cases. Lower is better; same units as the variable.

### Brier score & skill (binary events like "rain > 0.1 mm", "T < 0 °C")
```
BS  = (1/n) Σ (pᵢ − oᵢ)²           BSS = 1 − BS / BS_ref     (BS_ref = ō(1−ō))
```

### Reliability diagram (calibration curve)
Bin forecast probs into 10 bins; plot mean forecast prob vs observed frequency; the diagonal is perfect. Below = overconfident, above = underconfident. Plot per-bin counts for sharpness.

### Rank histogram (Talagrand) — is the ensemble calibrated?
Per case, count members < obs → rank in 0…m; tally across cases.
- **Flat** → well-calibrated. **U-shaped** → under-dispersed (the common raw-ensemble failure — spread too small). **Dome** → over-dispersed. **Sloped** → biased.

### Spread–skill (one honest number)
For a calibrated ensemble, mean spread ≈ RMSE of the ensemble mean:
```
SSR = √(mean_case ensemble_variance) / RMSE(ensemble_mean)      ideal ≈ 1.0
```
`SSR < 1` = overconfident (usual; needs spread inflation). Aggregate the squared quantities, then root — don't average per-case ratios.

### EMOS / NGR — calibrated probabilities (do last; needs a tiny optimizer)
Outputs a full Gaussian whose variance tracks ensemble spread:
```
μ  = a + b·x̄            (x̄ = ensemble mean)
σ² = c + d·s²           (s² = ensemble variance; c,d ≥ 0)
```
Fit (a,b,c,d) by minimizing mean CRPS over a rolling ~30-day window. Needs the closed-form Gaussian CRPS (with `z=(y−μ)/σ`):
```
CRPS(N(μ,σ²),y) = σ·[ z(2Φ(z)−1) + 2φ(z) − 1/√π ]
```
and a ~60-line Nelder–Mead + an `erf`/Φ approximation (Abramowitz–Stegun 7.1.26). The only item in this doc beyond array arithmetic.

**Priority:** metrics + running-mean bias correction (§1b) → inverse-variance blend (§1c) → CRPS + rank histogram + spread-skill → analog ensemble (§4) → EMOS last.

---

# Part IV — The derived-index toolbox (fun-but-factual)

All pure arithmetic on Open-Meteo fields. **Unit gotchas:** US heat index & wind chill are °F/mph; humidex needs dew point in **Kelvin**; Australian AT wind is **m/s**; Stull `atan` in **radians**; contrail RH is w.r.t. **ice**. Convert explicitly.

**Heat / cold comfort**
- **Heat Index** (Rothfusz, NWS) — °F, RH%; the "feels like" in heat.
- **Humidex** (Canada): `H = Tair + 0.5555·(e − 10)`, `e = 6.11·exp[5417.7530·(1/273.16 − 1/Tdew_K)]`.
- **Wind Chill** (JAG/TI): `WC = 13.12 + 0.6215·Ta − 11.37·V^0.16 + 0.3965·Ta·V^0.16` (°C, km/h; Ta ≤ 10 °C, V > 4.8 km/h).
- **Apparent Temp** (BOM Steadman): `AT = Ta + 0.33·e − 0.70·ws − 4.00`, `e = (rh/100)·6.105·exp(17.27·Ta/(237.7+Ta))`.
- **WBGT (shade approx.)**: `0.567·Ta + 0.393·e + 3.94` — label as estimate.

**Humidity**
- **Magnus** (a=17.625, b=243.04): `es(T)=6.112·exp(aT/(b+T))`; `RH=100·es(Td)/es(T)`; `Td = b·γ/(a−γ)`, `γ=ln(RH/100)+aT/(b+T)`.
- **Dew-point mugginess scale**: <13 °C dry · 13–16 comfortable · 16–18 sticky · 18–21 humid · 21–24 oppressive · >24 miserable.

**Atmosphere**
- **Pressure tendency** (3 h ΔP): rising→settling; falling 1–2.5 hPa/3h→unsettled; >2.5→storm approaching; >6→gale.
- **Zambretti forecaster** — the 1915 analog "pointer" mapping MSLP + trend + season to ~26 canned forecasts (~90 % for 12 h). Copy an existing integer port verbatim (constant tables).

**Agriculture / seasonal**
- **Growing Degree Days**: `GDD = max(0, (Tmax+Tmin)/2 − Tbase)`, accumulate.
- **Chill Hours**: count hours 0 < T ≤ 7.2 °C (dormancy break).
- **Frost risk**: Tmin ≤ 0 °C; radiation-frost risk up on clear, calm nights + big dew-point depression.

**Sun / sky**
- **Day length**: `cos(H0) = −tan φ·tan δ` (−0.833° for refraction); `length = 2·H0/15` h.
- **Golden hour** elev +6°→−4°; **blue hour** −4°→−6°.
- **UV → time-to-burn**: `E_ery = UVI×0.025 W/m²`; `t_min = MED / E_ery / 60`; MED by Fitzpatrick I≈200 … VI≈600 J/m²; ×0.5–1.0 for cloud, +12 %/1000 m altitude.

**Astronomy**
- **Moon phase**: `Age = (JD − 2451550.09765) mod 29.530588853`; `illum = (1 − cos(360°·Age/S))/2`.
- **Aurora**: Kp threshold table vs geomagnetic latitude (§9).

**Aviation-ish**
- **Fog risk**: (T − Td) < 2.5 °C AND wind < 2 m/s AND clear/night.
- **Cloud base (Espy)**: `≈ 125·(T − Td)` m AGL.
- **Contrails**: upper-air (200–300 hPa) T < −40 °C AND RH_ice ≥ 100 % → persistent likely (pressure-level endpoint; convert RH water→ice).
- **Snow-to-liquid (Kuchera)**: `SLR = 12 + 2·(271.16 − T_K)` when T > 271.16 K (else shallower); ×liquid depth.

**Playful composites (real physical basis)**
- **Laundry drying index** ∝ `VPD·(1 + b·wind) + c·shortwave`, `VPD = es(T)·(1 − RH/100)` — hot/dry/breezy/sunny dries fast. Normalize 0–100.
- **Mosquito/tick activity** — temperature + humidity + recent-rain gated (label approximate, species-dependent).
- **Cycling / kite comfort** — composite of apparent temp, wind/gust, precip, UV.

---

# Suggested build order

1. **Snapshot forecasts to localStorage now** (unblocks §1, §3 — value compounds with history).
2. **Verification metrics + running-mean bias correction** (§1a/1b) — trivial, biggest accuracy win, drives the leaderboard + corrected forecast.
3. **Inverse-variance blend** (§1c) + **records/streaks/anomaly** (§2) — trivial, immediate delight.
4. **HOPs animation** (§5) — days, reuses existing member data, huge wow.
5. **Plain-language narration** (§6) + **sky-color background upgrade**.
6. **CRPS + rank histogram + spread-skill** (§III) into History/Compare tabs.
7. **Forecast-churn "what changed"** (§3) + **convergence replay**.
8. **Ensemble meteogram / bi-modality** (§7), **analog-day finder** (§4), **wet-bulb lens** (§8).
9. **Aurora watch** (§9), **sun-path strip** (§10), **sonification + shareable cards** (§12).
10. **Ambitious:** minute nowcast (§11), scrubbable timeline (§13), EMOS (§III).

---

# Sources

**Verification & post-processing:** ECMWF *Verification of Ensembles* (elibrary 15865); Hamill 2001 *Interpretation of Rank Histograms* (MWR); `scores` docs (Brier, CRPS for Ensembles); Zamo & Naveau 2018 (CRPS from ensembles, *Math. Geosci.*); Ferro 2014 (fair CRPS); Gneiting et al. 2005 / NGR (Wikipedia, IMPROVER); Fortin et al. *Why should ensemble spread match RMSE?*; WeatherBench 2 (arXiv 2308.15560); AtmoSwing analog model (GMD 2019).

**Phenomena & formulas:** NWS/WPC heat-index equation; NWS wind chill; BOM thermal stress (apparent T, WBGT); **Stull 2011** wet-bulb (*J. Appl. Meteor. Climatol.*); Alduchov–Eskridge Magnus; NOAA solar calc / Meeus *Astronomical Algorithms*; timeanddate & PhotoPills (golden/blue hour); NOAA SWPC aurora tips + planetary-K JSON; UBC ATSC Espy cloud base; Copernicus ACP 2024 (contrails); Kuchera SLR; W4KRL / DrKFS Zambretti ports.

**Visualization & UX:** UW Interactive Data Lab + Kale/Hullman IEEE TVCG (HOPs); ECMWF EPSgrams & plumes (Confluence); modelspread.com; The Weather Recap / forecastadvisor.com (accuracy tracking); AccuWeather plain-language + NWS Weather Story (narration); NOAA Climate.gov / NASA SVS (anomaly framing); Ventusky / Weather Spark / Windy (scrub & zoom); Gradient Weather (sky palette); Helioradar / TwoTone (sonification); Open-Meteo & RainViewer (nowcast data).
