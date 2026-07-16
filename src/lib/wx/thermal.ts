// Thermische Indizes. Reiner Rechen-Kern.
//  • wetBulbStull  — Feuchtkugeltemperatur (Stull 2011), Schwül-Hitze-Gefahr
//  • windChill     — Windchill (NWS/Env. Canada), nur T≤10 °C & v>4,8 km/h gültig
//  • utci          — Universal Thermal Climate Index (Bröde 2012, operatives Polynom)
//
// Das UTCI-Polynom ist 1:1 aus pythermalcomfort (_utci_optimized) portiert und in
// den Tests gegen die dortigen Referenzwerte (24,6 / 40,6 °C) abgesichert — nicht
// von Hand „nacherfunden".
import { utciVapourPressureKpa, utciVapourPressureFromDewpointKpa } from './humidity'
import { utciCategory, type UtciCategory } from './categories'

/** Feuchtkugeltemperatur (°C) nach Stull (2011). T in °C, RH in %, ~1013 hPa. */
export function wetBulbStull(tC: number, rhPct: number): number {
  const rh = Math.min(100, Math.max(1, rhPct))
  return (
    tC * Math.atan(0.151977 * Math.sqrt(rh + 8.313659)) +
    Math.atan(tC + rh) -
    Math.atan(rh - 1.676331) +
    0.00391838 * Math.pow(rh, 1.5) * Math.atan(0.023101 * rh) -
    4.686035
  )
}

/**
 * Windchill (°C) nach NWS. T in °C, Wind in km/h (10 m). Nur gültig für
 * T ≤ 10 °C und v > 4,8 km/h — sonst null (kein sinnvoller Windchill).
 */
export function windChill(tC: number, windKmh: number): number | null {
  if (tC > 10 || windKmh <= 4.8) return null
  const vp = Math.pow(windKmh, 0.16)
  return 13.12 + 0.6215 * tC - 11.37 * vp + 0.3965 * tC * vp
}

/**
 * UTCI-Näherungspolynom (Bröde 2012). tdb/°C, v/(m/s @10 m),
 * delta = Tmrt − tdb (°C), pa = Wasserdampfdruck (kPa). Gibt UTCI in °C.
 */
export function utciApprox(tdb: number, v: number, delta: number, pa: number): number {
  const t = tdb
  const t2 = t * t, t3 = t2 * t, t4 = t3 * t, t5 = t4 * t, t6 = t5 * t
  const v2 = v * v, v3 = v2 * v, v4 = v3 * v, v5 = v4 * v, v6 = v5 * v
  const d = delta
  const d2 = d * d, d3 = d2 * d, d4 = d3 * d, d5 = d4 * d, d6 = d5 * d
  const p = pa
  const p2 = p * p, p3 = p2 * p, p4 = p3 * p, p5 = p4 * p, p6 = p5 * p

  return (
    t +
    0.607562052 +
    -0.0227712343 * t +
    8.06470249e-4 * t2 +
    -1.5427137e-4 * t3 +
    -3.24651735e-6 * t4 +
    7.32602852e-8 * t5 +
    1.35959073e-9 * t6 +
    -2.2583652 * v +
    0.0880326035 * t * v +
    0.00216844454 * t2 * v +
    -1.53347087e-5 * t3 * v +
    -5.72983704e-7 * t4 * v +
    -2.55090145e-9 * t5 * v +
    -0.751269505 * v2 +
    -0.00408350271 * t * v2 +
    -5.21670675e-5 * t2 * v2 +
    1.94544667e-6 * t3 * v2 +
    1.14099531e-8 * t4 * v2 +
    0.158137256 * v3 +
    -6.57263143e-5 * t * v3 +
    2.22697524e-7 * t2 * v3 +
    -4.16117031e-8 * t3 * v3 +
    -0.0127762753 * v4 +
    9.66891875e-6 * t * v4 +
    2.52785852e-9 * t2 * v4 +
    4.56306672e-4 * v5 +
    -1.74202546e-7 * t * v5 +
    -5.91491269e-6 * v6 +
    0.398374029 * d +
    1.83945314e-4 * t * d +
    -1.7375451e-4 * t2 * d +
    -7.60781159e-7 * t3 * d +
    3.77830287e-8 * t4 * d +
    5.43079673e-10 * t5 * d +
    -0.0200518269 * v * d +
    8.92859837e-4 * t * v * d +
    3.45433048e-6 * t2 * v * d +
    -3.77925774e-7 * t3 * v * d +
    -1.69699377e-9 * t4 * v * d +
    1.69992415e-4 * v2 * d +
    -4.99204314e-5 * t * v2 * d +
    2.47417178e-7 * t2 * v2 * d +
    1.07596466e-8 * t3 * v2 * d +
    8.49242932e-5 * v3 * d +
    1.35191328e-6 * t * v3 * d +
    -6.21531254e-9 * t2 * v3 * d +
    -4.99410301e-6 * v4 * d +
    -1.89489258e-8 * t * v4 * d +
    8.15300114e-8 * v5 * d +
    7.5504309e-4 * d2 +
    -5.65095215e-5 * t * d2 +
    -4.52166564e-7 * t2 * d2 +
    2.46688878e-8 * t3 * d2 +
    2.42674348e-10 * t4 * d2 +
    1.5454725e-4 * v * d2 +
    5.2411097e-6 * t * v * d2 +
    -8.75874982e-8 * t2 * v * d2 +
    -1.50743064e-9 * t3 * v * d2 +
    -1.56236307e-5 * v2 * d2 +
    -1.33895614e-7 * t * v2 * d2 +
    2.49709824e-9 * t2 * v2 * d2 +
    6.51711721e-7 * v3 * d2 +
    1.94960053e-9 * t * v3 * d2 +
    -1.00361113e-8 * v4 * d2 +
    -1.21206673e-5 * d3 +
    -2.1820366e-7 * t * d3 +
    7.51269482e-9 * t2 * d3 +
    9.79063848e-11 * t3 * d3 +
    1.25006734e-6 * v * d3 +
    -1.81584736e-9 * t * v * d3 +
    -3.52197671e-10 * t2 * v * d3 +
    -3.3651463e-8 * v2 * d3 +
    1.35908359e-10 * t * v2 * d3 +
    4.1703262e-10 * v3 * d3 +
    -1.30369025e-9 * d4 +
    4.13908461e-10 * t * d4 +
    9.22652254e-12 * t2 * d4 +
    -5.08220384e-9 * v * d4 +
    -2.24730961e-11 * t * v * d4 +
    1.17139133e-10 * v2 * d4 +
    6.62154879e-10 * d5 +
    4.0386326e-13 * t * d5 +
    1.95087203e-12 * v * d5 +
    -4.73602469e-12 * d6 +
    5.12733497 * p +
    -0.312788561 * t * p +
    -0.0196701861 * t2 * p +
    9.9969087e-4 * t3 * p +
    9.51738512e-6 * t4 * p +
    -4.66426341e-7 * t5 * p +
    0.548050612 * v * p +
    -0.00330552823 * t * v * p +
    -0.0016411944 * t2 * v * p +
    -5.16670694e-6 * t3 * v * p +
    9.52692432e-7 * t4 * v * p +
    -0.0429223622 * v2 * p +
    0.00500845667 * t * v2 * p +
    1.00601257e-6 * t2 * v2 * p +
    -1.81748644e-6 * t3 * v2 * p +
    -1.25813502e-3 * v3 * p +
    -1.79330391e-4 * t * v3 * p +
    2.34994441e-6 * t2 * v3 * p +
    1.29735808e-4 * v4 * p +
    1.2906487e-6 * t * v4 * p +
    -2.28558686e-6 * v5 * p +
    -0.0369476348 * d * p +
    0.00162325322 * t * d * p +
    -3.1427968e-5 * t2 * d * p +
    2.59835559e-6 * t3 * d * p +
    -4.77136523e-8 * t4 * d * p +
    8.6420339e-3 * v * d * p +
    -6.87405181e-4 * t * v * d * p +
    -9.13863872e-6 * t2 * v * d * p +
    5.15916806e-7 * t3 * v * d * p +
    -3.59217476e-5 * v2 * d * p +
    3.28696511e-5 * t * v2 * d * p +
    -7.10542454e-7 * t2 * v2 * d * p +
    -1.243823e-5 * v3 * d * p +
    -7.385844e-9 * t * v3 * d * p +
    2.20609296e-7 * v4 * d * p +
    -7.3246918e-4 * d2 * p +
    -1.87381964e-5 * t * d2 * p +
    4.80925239e-6 * t2 * d2 * p +
    -8.7549204e-8 * t3 * d2 * p +
    2.7786293e-5 * v * d2 * p +
    -5.06004592e-6 * t * v * d2 * p +
    1.14325367e-7 * t2 * v * d2 * p +
    2.53016723e-6 * v2 * d2 * p +
    -1.72857035e-8 * t * v2 * d2 * p +
    -3.95079398e-8 * v3 * d2 * p +
    -3.59413173e-7 * d3 * p +
    7.04388046e-7 * t * d3 * p +
    -1.89309167e-8 * t2 * d3 * p +
    -4.79768731e-7 * v * d3 * p +
    7.96079978e-9 * t * v * d3 * p +
    1.62897058e-9 * v2 * d3 * p +
    3.94367674e-8 * d4 * p +
    -1.18566247e-9 * t * d4 * p +
    3.34678041e-10 * v * d4 * p +
    -1.15606447e-10 * d5 * p +
    -2.80626406 * p2 +
    0.548712484 * t * p2 +
    -0.0039942841 * t2 * p2 +
    -9.54009191e-4 * t3 * p2 +
    1.93090978e-5 * t4 * p2 +
    -0.308806365 * v * p2 +
    0.0116952364 * t * v * p2 +
    4.95271903e-4 * t2 * v * p2 +
    -1.90710882e-5 * t3 * v * p2 +
    0.00210787756 * v2 * p2 +
    -6.98445738e-4 * t * v2 * p2 +
    2.30109073e-5 * t2 * v2 * p2 +
    4.1785659e-4 * v3 * p2 +
    -1.27043871e-5 * t * v3 * p2 +
    -3.04620472e-6 * v4 * p2 +
    0.0514507424 * d * p2 +
    -0.00432510997 * t * d * p2 +
    8.99281156e-5 * t2 * d * p2 +
    -7.14663943e-7 * t3 * d * p2 +
    -2.66016305e-4 * v * d * p2 +
    2.63789586e-4 * t * v * d * p2 +
    -7.01199003e-6 * t2 * v * d * p2 +
    -1.06823306e-4 * v2 * d * p2 +
    3.61341136e-6 * t * v2 * d * p2 +
    2.29748967e-7 * v3 * d * p2 +
    3.04788893e-4 * d2 * p2 +
    -6.42070836e-5 * t * d2 * p2 +
    1.16257971e-6 * t2 * d2 * p2 +
    7.68023384e-6 * v * d2 * p2 +
    -5.47446896e-7 * t * v * d2 * p2 +
    -3.5993791e-8 * v2 * d2 * p2 +
    -4.36497725e-6 * d3 * p2 +
    1.68737969e-7 * t * d3 * p2 +
    2.67489271e-8 * v * d3 * p2 +
    3.23926897e-9 * d4 * p2 +
    -0.0353874123 * p3 +
    -0.22120119 * t * p3 +
    0.0155126038 * t2 * p3 +
    -2.63917279e-4 * t3 * p3 +
    0.0453433455 * v * p3 +
    -0.00432943862 * t * v * p3 +
    1.45389826e-4 * t2 * v * p3 +
    2.1750861e-4 * v2 * p3 +
    -6.66724702e-5 * t * v2 * p3 +
    3.3321714e-5 * v3 * p3 +
    -0.00226921615 * d * p3 +
    3.80261982e-4 * t * d * p3 +
    -5.45314314e-9 * t2 * d * p3 +
    -7.96355448e-4 * v * d * p3 +
    2.53458034e-5 * t * v * d * p3 +
    -6.31223658e-6 * v2 * d * p3 +
    3.02122035e-4 * d2 * p3 +
    -4.77403547e-6 * t * d2 * p3 +
    1.73825715e-6 * v * d2 * p3 +
    -4.09087898e-7 * d3 * p3 +
    0.614155345 * p4 +
    -0.0616755931 * t * p4 +
    0.00133374846 * t2 * p4 +
    0.00355375387 * v * p4 +
    -5.13027851e-4 * t * v * p4 +
    1.02449757e-4 * v2 * p4 +
    -0.00148526421 * d * p4 +
    -4.11469183e-5 * t * d * p4 +
    -6.80434415e-6 * v * d * p4 +
    -9.77675906e-6 * d2 * p4 +
    0.0882773108 * p5 +
    -0.00301859306 * t * p5 +
    0.00104452989 * v * p5 +
    2.47090539e-4 * d * p5 +
    0.00148348065 * p6
  )
}

export interface UtciInputs {
  /** Lufttemperatur (°C) */
  tdb: number
  /** mittlere Strahlungstemperatur (°C) */
  tr: number
  /** Windgeschwindigkeit (km/h @10 m) */
  windKmh: number
  /** relative Feuchte (%) — genutzt, wenn kein Taupunkt vorliegt */
  rhPct?: number
  /** Taupunkt (°C) — bevorzugt (robuster für den Dampfdruck) */
  dewpointC?: number
}

// Gültigkeitsbereich (Bröde). v wird auf [0,5..17] geklemmt (Windstille ist
// normal), tdb/delta außerhalb → null statt Scheinwert.
const V_MIN = 0.5
const V_MAX = 17

/** UTCI (°C) aus App-Feldern; null außerhalb des Gültigkeitsbereichs. */
export function utci(inp: UtciInputs): number | null {
  const { tdb, tr } = inp
  const delta = tr - tdb
  if (tdb < -50 || tdb > 50) return null
  if (delta < -30 || delta > 70) return null
  const v = Math.min(V_MAX, Math.max(V_MIN, inp.windKmh / 3.6))
  const pa =
    inp.dewpointC != null
      ? utciVapourPressureFromDewpointKpa(inp.dewpointC)
      : utciVapourPressureKpa(tdb, inp.rhPct ?? 50)
  return utciApprox(tdb, v, delta, pa)
}

export { utciCategory }
export type { UtciCategory }
