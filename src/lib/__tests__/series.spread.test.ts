import { describe, it, expect } from 'vitest'
import { ensembleHourlySpread, relativeSpreadBand } from '../series'
import type { EnsembleResponse } from '@/api/weather'

// Drei Member über zwei Stunden. Stunde 0: [18,20,22]; Stunde 1: [10,15,20].
const res: EnsembleResponse = {
  latitude: 0,
  longitude: 0,
  timezone: 'UTC',
  utc_offset_seconds: 0,
  hourly: {
    time: ['2026-07-16T00:00', '2026-07-16T01:00'],
    temperature_2m: [18, 10], // Kontrolllauf
    temperature_2m_member01: [20, 15],
    temperature_2m_member02: [22, 20],
  },
}

describe('ensembleHourlySpread', () => {
  it('produces monotone p25 ≤ p50 ≤ p75 per hour', () => {
    const s = ensembleHourlySpread(res)
    expect(s.time).toHaveLength(2)
    for (let i = 0; i < s.time.length; i++) {
      expect(s.p25[i]).toBeLessThanOrEqual(s.p50[i])
      expect(s.p50[i]).toBeLessThanOrEqual(s.p75[i])
    }
  })

  it('widens the band where members disagree more', () => {
    const s = ensembleHourlySpread(res)
    const w0 = s.p75[0] - s.p25[0] // hour 0 spread (18..22)
    const w1 = s.p75[1] - s.p25[1] // hour 1 spread (10..20) — wider
    expect(w1).toBeGreaterThan(w0)
  })

  it('applies spread relative to a deterministic value', () => {
    const s = ensembleHourlySpread(res)
    const band = relativeSpreadBand(s, 0, 30)! // det = 30°C
    // hour0 [18,20,22] → p25=19, median=20, p75=21 (interpolated)
    // band = 30 + (19-20) .. 30 + (21-20) = 29 .. 31
    expect(band.lo).toBeCloseTo(29, 5)
    expect(band.hi).toBeCloseTo(31, 5)
  })

  it('returns null band when no members at index', () => {
    const empty = ensembleHourlySpread({ ...res, hourly: { time: ['x'] } })
    expect(relativeSpreadBand(empty, 0, 20)).toBeNull()
  })
})
