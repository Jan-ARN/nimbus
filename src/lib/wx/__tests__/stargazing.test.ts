import { describe, it, expect } from 'vitest'
import { stargazeScore } from '../stargazing'

const clearMoonless = {
  cloudLowPct: 0,
  cloudMidPct: 0,
  cloudHighPct: 0,
  moonIllumination: 0,
  moonUp: false,
  aerosolPm25: 5,
}

describe('stargaze score', () => {
  it('clear, moonless, clean air ⇒ near 100', () => {
    expect(stargazeScore(clearMoonless)).toBeGreaterThan(95)
  })
  it('overcast low cloud ⇒ near 0', () => {
    expect(stargazeScore({ ...clearMoonless, cloudLowPct: 100 })).toBeLessThan(10)
  })
  it('full moon up washes out the sky', () => {
    const bright = stargazeScore({ ...clearMoonless, moonIllumination: 1, moonUp: true })
    expect(bright).toBeLessThan(stargazeScore(clearMoonless))
    expect(bright).toBeLessThan(40)
  })
  it('high (cirrus) cloud hurts less than low cloud', () => {
    const cirrus = stargazeScore({ ...clearMoonless, cloudHighPct: 60 })
    const strato = stargazeScore({ ...clearMoonless, cloudLowPct: 60 })
    expect(cirrus).toBeGreaterThan(strato)
  })
})
