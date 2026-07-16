import { describe, it, expect } from 'vitest'
import {
  saturationVapourPressure,
  vapourPressureKpa,
  vapourPressureFromDewpointKpa,
} from '../humidity'

describe('humidity', () => {
  it('saturation vapour pressure at 0°C ≈ 6.11 hPa', () => {
    expect(saturationVapourPressure(0)).toBeCloseTo(6.11, 1)
  })
  it('saturation vapour pressure rises with temperature', () => {
    expect(saturationVapourPressure(30)).toBeGreaterThan(saturationVapourPressure(10))
  })
  it('vapour pressure from RH scales linearly', () => {
    const full = vapourPressureKpa(20, 100)
    const half = vapourPressureKpa(20, 50)
    expect(half).toBeCloseTo(full / 2, 5)
  })
  it('dew point path equals RH path when Td makes es match', () => {
    // e from dew point = es(Td); at RH=100% dew point ≈ air temp
    expect(vapourPressureFromDewpointKpa(20)).toBeCloseTo(vapourPressureKpa(20, 100), 5)
  })
})
