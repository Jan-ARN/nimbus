import { describe, it, expect } from 'vitest'
import { goldenScoreHour, findBestWindow, type GoldenHourInputs } from '../golden'

const perfect: GoldenHourInputs = {
  utci: 22,
  solarElevationDeg: 40,
  cloudCoverPct: 10,
  precipitationMm: 0,
  precipProbPct: 5,
  visibilityM: 20000,
  windKmh: 6,
  gustKmh: 12,
}

describe('golden score', () => {
  it('scores a lovely hour high', () => {
    expect(goldenScoreHour(perfect)).toBeGreaterThan(85)
  })
  it('multiplicative gating: rain tanks the score', () => {
    expect(goldenScoreHour({ ...perfect, precipitationMm: 2 })).toBeLessThan(15)
  })
  it('multiplicative gating: darkness tanks the score', () => {
    expect(goldenScoreHour({ ...perfect, solarElevationDeg: -5 })).toBeLessThan(10)
  })
  it('null UTCI ⇒ not golden', () => {
    expect(goldenScoreHour({ ...perfect, utci: null })).toBe(0)
  })
})

describe('findBestWindow', () => {
  it('picks the longest contiguous run above threshold', () => {
    const scores = [10, 70, 80, 75, 20, 90, 60]
    const time = scores.map((_, i) => `2026-07-16T0${i}:00`)
    const w = findBestWindow(scores, time, 65)
    expect(w).not.toBeNull()
    expect(w!.startIdx).toBe(1)
    expect(w!.endIdx).toBe(3)
    expect(w!.hours).toBe(3)
  })
  it('returns null when nothing qualifies', () => {
    expect(findBestWindow([10, 20, 30], ['a', 'b', 'c'], 65)).toBeNull()
  })
})
