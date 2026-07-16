import { describe, it, expect } from 'vitest'
import { utci, utciApprox, utciCategory, wetBulbStull, windChill } from '../thermal'

describe('UTCI', () => {
  // Referenzwerte aus pythermalcomfort-Docstring (rh via Hardy-Dampfdruck):
  // utci(tdb=25, tr=25, v=1.0 m/s, rh=50) = 24.6 ; (tdb=40, …) = 40.6
  it('reproduces pythermalcomfort reference values', () => {
    expect(utci({ tdb: 25, tr: 25, windKmh: 3.6, rhPct: 50 })!).toBeCloseTo(24.6, 1)
    expect(utci({ tdb: 40, tr: 25, windKmh: 3.6, rhPct: 50 })!).toBeCloseTo(40.6, 1)
  })

  it('raw polynomial matches wrapper when pa supplied directly', () => {
    // pa(25°C,50%) ≈ 1.585 kPa → same as reference case 1
    expect(utciApprox(25, 1.0, 0, 1.585)).toBeCloseTo(24.6, 0)
  })

  it('clamps calm wind to the valid range instead of returning null', () => {
    expect(utci({ tdb: 20, tr: 20, windKmh: 0, rhPct: 50 })).not.toBeNull()
  })

  it('returns null outside validity (absurd temperature)', () => {
    expect(utci({ tdb: 80, tr: 80, windKmh: 3.6, rhPct: 50 })).toBeNull()
  })

  it('maps to the 10 stress categories', () => {
    expect(utciCategory(22)).toBe('noStress')
    expect(utciCategory(35)).toBe('strongHeat')
    expect(utciCategory(-20)).toBe('strongCold')
    expect(utciCategory(50)).toBe('extremeHeat')
  })
})

describe('wet-bulb (Stull 2011)', () => {
  it('equals air temp at 100% RH (approx) and is lower when drier', () => {
    const humid = wetBulbStull(25, 100)
    const dry = wetBulbStull(25, 40)
    expect(humid).toBeGreaterThan(dry)
    expect(humid).toBeCloseTo(25, 0) // near-saturated ⇒ Tw ≈ T
  })
  it('known point: 30°C / 50% ≈ 22°C', () => {
    expect(wetBulbStull(30, 50)).toBeCloseTo(22, 0)
  })
})

describe('wind chill (NWS)', () => {
  it('is null when too warm or wind too light', () => {
    expect(windChill(15, 20)).toBeNull()
    expect(windChill(5, 3)).toBeNull()
  })
  it('is colder than air temp in valid range', () => {
    const wc = windChill(0, 30)
    expect(wc).not.toBeNull()
    expect(wc!).toBeLessThan(0)
  })
})
