import { describe, it, expect } from 'vitest'
import { meanRadiantTemp } from '../radiation'

describe('mean radiant temperature', () => {
  it('falls back to air temp at night / no radiation (v0)', () => {
    expect(
      meanRadiantTemp({
        tdb: 10,
        shortwave: 0,
        diffuse: 0,
        directNormal: 0,
        solarElevationDeg: -8,
      }),
    ).toBe(10)
  })

  it('rises well above air temp under strong sun (v1)', () => {
    const tmrt = meanRadiantTemp({
      tdb: 25,
      shortwave: 700,
      diffuse: 120,
      directNormal: 800,
      solarElevationDeg: 50,
      albedo: 0.2,
    })
    expect(tmrt).toBeGreaterThan(25 + 15)
    expect(tmrt).toBeLessThan(25 + 50)
  })
})
