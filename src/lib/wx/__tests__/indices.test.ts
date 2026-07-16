import { describe, it, expect } from 'vitest'
import { snowLine, dryingIndex } from '../indices'

describe('snow line', () => {
  it('places the snow line ~200 m below the freezing level', () => {
    expect(snowLine(1200)).toEqual({ freezingLevelM: 1200, snowLineM: 1000 })
  })
  it('never goes below 0', () => {
    expect(snowLine(100).snowLineM).toBe(0)
  })
})

describe('drying index', () => {
  const base = { et0Mm: 0.4, relativeHumidityPct: 40, windKmh: 10, precipProbPct: 0 }
  it('produces a mid-range score for typical drying weather', () => {
    const s = dryingIndex(base)
    expect(s).toBeGreaterThan(20)
    expect(s).toBeLessThan(80)
  })
  it('increases with evapotranspiration', () => {
    expect(dryingIndex({ ...base, et0Mm: 0.5 })).toBeGreaterThan(dryingIndex({ ...base, et0Mm: 0.1 }))
  })
  it('decreases with humidity', () => {
    expect(dryingIndex({ ...base, relativeHumidityPct: 80 })).toBeLessThan(dryingIndex(base))
  })
  it('decreases with rain probability', () => {
    expect(dryingIndex({ ...base, precipProbPct: 90 })).toBeLessThan(dryingIndex(base))
  })
})
