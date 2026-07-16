// „Haus-Prognose": mische die Modelle danach, wie gut sie zuletzt AN DIESEM ORT
// getroffen haben. Reiner Kern — die (look-ahead-freie) Paarbildung passiert im
// Assembly (houseForecast.ts); hier nur die Gewichtungs-Mathematik.

export interface ModelSkill {
  modelId: string
  mae: number // mittlerer absoluter Fehler (°C)
  bias: number // systematische Abweichung (Prognose − Realität)
  mse: number // mittlerer quadratischer Fehler (für inverse Gewichtung)
  n: number // Stichprobengröße (verifizierte Tage)
}

export interface ModelWeight {
  modelId: string
  weight: number // 0..1, Summe = 1
  mae: number
  bias: number
  n: number
}

export const MIN_SAMPLES = 5

/**
 * Inverse-Fehler-Gewichte (∝ 1/MSE), renormiert über Modelle mit genügend
 * Stichprobe. Reicht keines an MIN_SAMPLES heran → Gleichgewicht (ehrlich:
 * „noch keine belastbare Bilanz").
 */
export function blendWeights(skills: ModelSkill[], minSamples = MIN_SAMPLES): ModelWeight[] {
  const usable = skills.filter((s) => s.n >= minSamples && s.mse > 0)
  if (usable.length === 0) {
    const w = skills.length ? 1 / skills.length : 0
    return skills.map((s) => ({ modelId: s.modelId, weight: w, mae: s.mae, bias: s.bias, n: s.n }))
  }
  const raw = usable.map((s) => ({ s, r: 1 / s.mse }))
  const sum = raw.reduce((a, b) => a + b.r, 0)
  return raw.map(({ s, r }) => ({
    modelId: s.modelId,
    weight: r / sum,
    mae: s.mae,
    bias: s.bias,
    n: s.n,
  }))
}

/** Herfindahl-Konzentration 0..1 (1 = ein Modell dominiert, 1/N = alle gleich). */
export function weightConcentration(weights: ModelWeight[]): number {
  return weights.reduce((a, w) => a + w.weight * w.weight, 0)
}

/**
 * Bias-korrigierte, gewichtete Mischung der Modellwerte eines Tages. Jeder Wert
 * wird um seinen gemessenen Bias bereinigt, dann nach Gewicht gemittelt.
 */
export function blendValue(
  perModel: { modelId: string; value: number | null }[],
  weights: ModelWeight[],
): number | null {
  const wmap = new Map(weights.map((w) => [w.modelId, w]))
  let num = 0
  let den = 0
  for (const pm of perModel) {
    const w = wmap.get(pm.modelId)
    if (!w || pm.value == null) continue
    num += w.weight * (pm.value - w.bias)
    den += w.weight
  }
  return den > 0 ? num / den : null
}
