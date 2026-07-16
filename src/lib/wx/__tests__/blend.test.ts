import { describe, it, expect } from 'vitest'
import { blendWeights, weightConcentration, blendValue, type ModelSkill } from '../blend'

const skills: ModelSkill[] = [
  { modelId: 'a', mae: 1.0, bias: 0.5, mse: 1.5, n: 20 }, // best (lowest mse)
  { modelId: 'b', mae: 2.0, bias: -1.0, mse: 5.0, n: 20 },
  { modelId: 'c', mae: 3.0, bias: 0.2, mse: 10.0, n: 3 }, // too few samples
]

describe('blendWeights', () => {
  it('weights sum to 1 and favour the lower-error model', () => {
    const w = blendWeights(skills)
    const sum = w.reduce((a, x) => a + x.weight, 0)
    expect(sum).toBeCloseTo(1, 6)
    const a = w.find((x) => x.modelId === 'a')!
    const b = w.find((x) => x.modelId === 'b')!
    expect(a.weight).toBeGreaterThan(b.weight)
  })
  it('excludes models below the min-sample threshold', () => {
    const w = blendWeights(skills)
    expect(w.find((x) => x.modelId === 'c')).toBeUndefined()
  })
  it('falls back to equal weights when none qualify', () => {
    const few = skills.map((s) => ({ ...s, n: 2 }))
    const w = blendWeights(few)
    expect(w).toHaveLength(3)
    for (const x of w) expect(x.weight).toBeCloseTo(1 / 3, 6)
  })
})

describe('weightConcentration', () => {
  it('is 1 when one model dominates, 1/N when equal', () => {
    expect(weightConcentration([{ modelId: 'a', weight: 1, mae: 0, bias: 0, n: 9 }])).toBeCloseTo(1, 6)
    const eq = [0, 1, 2].map((i) => ({ modelId: String(i), weight: 1 / 3, mae: 0, bias: 0, n: 9 }))
    expect(weightConcentration(eq)).toBeCloseTo(1 / 3, 6)
  })
})

describe('blendValue', () => {
  it('applies each model’s bias correction before weighting', () => {
    // a: value 20, bias +0.5 → 19.5 ; b: value 22, bias −1.0 → 23.0
    const weights = [
      { modelId: 'a', weight: 0.75, mae: 1, bias: 0.5, n: 20 },
      { modelId: 'b', weight: 0.25, mae: 2, bias: -1.0, n: 20 },
    ]
    const v = blendValue(
      [
        { modelId: 'a', value: 20 },
        { modelId: 'b', value: 22 },
      ],
      weights,
    )
    // 0.75*19.5 + 0.25*23.0 = 20.375
    expect(v).toBeCloseTo(20.375, 5)
  })
  it('returns null when no model has a value', () => {
    expect(blendValue([{ modelId: 'a', value: null }], [{ modelId: 'a', weight: 1, mae: 1, bias: 0, n: 9 }])).toBeNull()
  })
})
