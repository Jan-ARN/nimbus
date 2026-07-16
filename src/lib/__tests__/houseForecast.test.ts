import { describe, it, expect } from 'vitest'
import { computeHouseForecast } from '../houseForecast'
import type { DailyBundle } from '../series'
import type { PreviousRunsResponse, ArchiveResponse } from '@/api/weather'

// 6 vergangene Zieltage. 'good' forecast = actual + 0.5 (kleiner Bias); 'bad' = +4.
const dates = ['2026-07-04', '2026-07-05', '2026-07-06', '2026-07-07', '2026-07-08', '2026-07-09']
const actualMax = [20, 21, 22, 23, 24, 25]
const time = dates.map((d) => `${d}T12:00`)

const runs: PreviousRunsResponse = {
  hourly: {
    time,
    temperature_2m_previous_day3_good: actualMax.map((a) => a + 0.5),
    temperature_2m_previous_day3_bad: actualMax.map((a) => a + 4),
  },
}
const archive: ArchiveResponse = {
  daily: { time: dates, temperature_2m_max: actualMax },
}
// Aktuelle Prognose für zwei künftige Tage.
const currentDaily: DailyBundle = {
  time: ['2026-07-16', '2026-07-17'],
  models: [
    { modelId: 'good', max: [30, 31], min: [18, 19] },
    { modelId: 'bad', max: [34, 35], min: [20, 21] },
  ],
}

describe('computeHouseForecast', () => {
  const hf = computeHouseForecast(runs, archive, currentDaily, ['good', 'bad'], 3)!

  it('weights the more accurate model far higher', () => {
    const g = hf.weights.find((w) => w.modelId === 'good')!
    const b = hf.weights.find((w) => w.modelId === 'bad')!
    expect(g.weight).toBeGreaterThan(0.9)
    expect(g.weight).toBeGreaterThan(b.weight)
    expect(hf.lean?.modelId).toBe('good')
  })

  it('uses only verified past target days (6 samples)', () => {
    expect(hf.sampleDays).toBe(6)
  })

  it('blends the current forecast with bias correction (≈ good − 0.5)', () => {
    // dominated by 'good' (corrected 30−0.5 = 29.5)
    expect(hf.blended[0].value!).toBeCloseTo(29.5, 1)
  })

  it('flags the model with the worst bias', () => {
    expect(hf.worstBias?.modelId).toBe('bad')
  })
})
