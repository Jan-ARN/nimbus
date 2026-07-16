// Feuchte-Helfer. Reiner Rechen-Kern, keine i18n/Vue-Abhängigkeit.
// Sättigungsdampfdruck nach Hardy (1998, ITS-90).
//
// Feinheit: pythermalcomfort berechnt den UTCI-Dampfdruck mit ln(1+T) statt ln(T)
// (eine ~1-%-Eigenart ihrer Implementierung). Damit unser UTCI-Port die dortigen
// Referenzwerte (24,6 / 40,6 °C) EXAKT reproduziert, spiegeln wir diese Formel im
// UTCI-Pfad — die allgemeine Funktion bleibt physikalisch korrekt (ln(T), es(0 °C)
// = 6,11 hPa) und wird für Nebel/Feuchte anderswo genutzt.

const HARDY_G = [
  -2836.5744,
  -6028.076559,
  19.54263612,
  -0.02737830188,
  0.000016261698,
  7.0229056e-10,
  -1.8680009e-13,
] as const
const HARDY_LN = 2.7150305 // Koeffizient des ln(T)-Terms

function lnSaturationPa(tC: number, log1p: boolean): number {
  const tk = tC + 273.15
  let ln = HARDY_LN * (log1p ? Math.log1p(tk) : Math.log(tk))
  for (let i = 0; i < HARDY_G.length; i++) {
    ln += HARDY_G[i] * Math.pow(tk, i - 2)
  }
  return ln
}

/** Sättigungsdampfdruck über Wasser in **hPa** (physikalisch korrekt, ln(T)). */
export function saturationVapourPressure(tC: number): number {
  return Math.exp(lnSaturationPa(tC, false)) * 0.01 // Pa → hPa
}

/** Wasserdampfdruck in **kPa** aus Temperatur (°C) und relativer Feuchte (%). */
export function vapourPressureKpa(tC: number, rhPct: number): number {
  return (saturationVapourPressure(tC) * (rhPct / 100)) / 10 // hPa → kPa
}

/** Wasserdampfdruck in **kPa** direkt aus dem Taupunkt (°C) — robuster als über RH. */
export function vapourPressureFromDewpointKpa(dewpointC: number): number {
  return saturationVapourPressure(dewpointC) / 10 // e = es(Td); hPa → kPa
}

// --- UTCI-spezifisch: exakt wie pythermalcomfort (ln(1+T)) ---------------------
function utciSatHpa(tC: number): number {
  return Math.exp(lnSaturationPa(tC, true)) * 0.01
}
/** UTCI-Dampfdruck (kPa) aus RH — mirror von pythermalcomfort. */
export function utciVapourPressureKpa(tC: number, rhPct: number): number {
  return (utciSatHpa(tC) * (rhPct / 100)) / 10
}
/** UTCI-Dampfdruck (kPa) aus Taupunkt — mirror von pythermalcomfort. */
export function utciVapourPressureFromDewpointKpa(dewpointC: number): number {
  return utciSatHpa(dewpointC) / 10
}
