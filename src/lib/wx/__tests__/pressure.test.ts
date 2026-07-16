import { describe, it, expect } from 'vitest'
import { maxRollingDrop, maxRate3h } from '../pressure'

describe('barometric change', () => {
  it('finds the largest fall to a later point within the window', () => {
    // 1020 → dips to 1008 (−12) then recovers
    const series = [1020, 1018, 1015, 1010, 1008, 1012, 1016]
    expect(maxRollingDrop(series, 24)).toBeCloseTo(12, 5)
  })
  it('ignores rises (drop is never negative)', () => {
    expect(maxRollingDrop([1000, 1005, 1010], 24)).toBe(0)
  })
  it('respects the window length', () => {
    // big fall only across 6 steps; window 3 can't see it
    const series = [1020, 1019, 1018, 1017, 1010, 1005, 1000]
    expect(maxRollingDrop(series, 3)).toBeLessThan(maxRollingDrop(series, 24))
  })
  it('skips nulls', () => {
    expect(maxRollingDrop([1015, null, 1005, null, 1010], 24)).toBeCloseTo(10, 5)
  })
  it('maxRate3h captures the steepest 3h fall', () => {
    const series = [1015, 1014, 1013, 1005] // index0→3 = 10 hPa/3h
    expect(maxRate3h(series)).toBeCloseTo(10, 5)
  })
})
