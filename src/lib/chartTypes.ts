import type { NumArr } from '@/lib/series'

export interface LineSeries {
  key: string
  label: string
  color: string
  values: NumArr
}
