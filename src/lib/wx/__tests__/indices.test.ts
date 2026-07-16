import { describe, it, expect } from 'vitest'
import {
  snowLine,
  dryingIndex,
  thunderPotential,
  fogRisk,
  fireStress,
  growingDegreeDays,
  rideRunComfort,
} from '../indices'

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

describe('thunder potential', () => {
  it('maps CAPE to bands', () => {
    expect(thunderPotential(null)).toBe('none')
    expect(thunderPotential(120)).toBe('none')
    expect(thunderPotential(600)).toBe('moderate')
    expect(thunderPotential(1800)).toBe('strong')
    expect(thunderPotential(3000)).toBe('extreme')
  })
})

describe('fog risk', () => {
  const still = { tempC: 8, dewpointC: 7.5, windKmh: 4, relativeHumidityPct: 96, visibilityM: 8000 }
  it('flags high risk on tiny dew-point spread, calm and humid', () => {
    expect(fogRisk(still)).toBe('high')
  })
  it('already-foggy visibility ⇒ high regardless', () => {
    expect(fogRisk({ ...still, tempC: 8, dewpointC: 2, windKmh: 20, relativeHumidityPct: 60, visibilityM: 400 })).toBe('high')
  })
  it('dry, breezy air ⇒ none', () => {
    expect(fogRisk({ tempC: 20, dewpointC: 6, windKmh: 25, relativeHumidityPct: 45, visibilityM: 30000 })).toBe('none')
  })
})

describe('fire/drought stress', () => {
  it('rises with VPD and drops with humidity', () => {
    const hot = fireStress({ vpdKpa: 2.5, et0Mm: 0.5, windKmh: 25, relativeHumidityPct: 20 })
    const mild = fireStress({ vpdKpa: 0.3, et0Mm: 0.05, windKmh: 5, relativeHumidityPct: 85 })
    expect(hot).toBeGreaterThan(mild)
    expect(hot).toBeGreaterThan(70)
    expect(mild).toBeLessThan(25)
  })
})

describe('growing degree days', () => {
  it('sums (mean − base), flooring negatives at 0', () => {
    // day1 mean 20 → 10; day2 mean 8 → 0; day3 mean 15 → 5  ⇒ 15
    expect(growingDegreeDays([25, 12, 20], [15, 4, 10], 10)).toBe(15)
  })
})

describe('ride/run comfort', () => {
  const good = { utci: 12, precipitationMm: 0, windKmh: 8, gustKmh: 14, aqi: 25, pollen: 5 }
  it('scores a cool, clean, calm hour high', () => {
    expect(rideRunComfort(good)).toBeGreaterThan(85)
  })
  it('rain lowers it meaningfully (but exertion isn’t fully gated like leisure)', () => {
    const wet = rideRunComfort({ ...good, precipitationMm: 3 })
    expect(wet).toBeLessThan(rideRunComfort(good) - 15)
    expect(wet).toBeLessThan(75)
  })
  it('bad air and high pollen lower it', () => {
    expect(rideRunComfort({ ...good, aqi: 110, pollen: 120 })).toBeLessThan(rideRunComfort(good))
  })
  it('null UTCI ⇒ 0', () => {
    expect(rideRunComfort({ ...good, utci: null })).toBe(0)
  })
})
